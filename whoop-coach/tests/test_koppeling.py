"""End-to-end tests tegen de nagebootste WHOOP-server.

Dekt de hele keten: koppelen, tokens verversen, pagineren, en de foutpaden
die in de praktijk voorkomen (verlopen token, geen internet, 429, 500).
"""

import os
import threading
import time
import unittest
import urllib.request

import hulp  # noqa: F401
from mock_whoop import MockWhoop, standaard_scenario

from whoop_coach import auth, coach, opslag
from whoop_coach.api import Snelheidsrem, WhoopClient
from whoop_coach.errors import (AuthenticatieFout, NetwerkFout, RateLimitFout,
                                TokenVerlopenFout)


class MockBasis(unittest.TestCase):
    def setUp(self):
        self.mock = MockWhoop(scenario=self.maak_scenario()).start()
        self.omgeving = hulp.TijdelijkeOmgeving(self.mock)
        self.instellingen = self.omgeving.instellingen
        self.opslag = opslag.BestandOpslag(self.omgeving.tokens_pad)

    def maak_scenario(self):
        return standaard_scenario()

    def tearDown(self):
        self.mock.stop()
        self.omgeving.opruimen()

    def client_met_token(self, verloopt_over=3600):
        access, refresh = self.mock.geef_token_uit()
        self.omgeving.schrijf_tokens(access, refresh, verloopt_over)
        beheer = auth.TokenBeheer(self.instellingen, self.opslag)
        return WhoopClient(self.instellingen, beheer), beheer


class TestKoppelen(MockBasis):
    def test_volledige_oauth_flow(self):
        """Koppelen van begin tot eind, met een nagebootste browser."""
        self.instellingen.zet("redirect_poort", 8799)
        gereed = threading.Event()

        def bootst_browser_na(url):
            # De 'browser' volgt de redirect van WHOOP naar ons servertje.
            try:
                urllib.request.urlopen(url, timeout=10).read()
            except Exception:
                pass
            gereed.set()
            return True

        origineel = auth.webbrowser.open
        auth.webbrowser.open = bootst_browser_na
        try:
            tokens = auth.koppel(self.instellingen, self.opslag,
                                 meldt=lambda *_: None)
        finally:
            auth.webbrowser.open = origineel

        self.assertTrue(gereed.wait(timeout=5))
        self.assertTrue(tokens["access_token"].startswith("access-"))
        self.assertTrue(tokens["refresh_token"].startswith("refresh-"))
        self.assertGreater(tokens["verloopt_op"], time.time())

        # En de tokens staan op schijf, alleen leesbaar voor de eigenaar.
        opgeslagen = self.opslag.laad()
        self.assertEqual(opgeslagen["access_token"], tokens["access_token"])
        rechten = os.stat(self.omgeving.tokens_pad).st_mode & 0o777
        self.assertEqual(rechten, 0o600)

    def test_state_die_niet_klopt_wordt_geweigerd(self):
        """Een redirect met een vreemde state mag geen koppeling opleveren."""
        self.instellingen.zet("redirect_poort", 8798)
        self.mock.scenario.stuur_verkeerde_state = True
        auth.WACHT_OP_TOESTEMMING_SECONDEN = 8

        def bootst_browser_na(url):
            try:
                urllib.request.urlopen(url, timeout=5).read()
            except Exception:
                pass
            return True

        origineel = auth.webbrowser.open
        auth.webbrowser.open = bootst_browser_na
        try:
            with self.assertRaises(AuthenticatieFout) as vangst:
                auth.koppel(self.instellingen, self.opslag, meldt=lambda *_: None)
        finally:
            auth.webbrowser.open = origineel
            auth.WACHT_OP_TOESTEMMING_SECONDEN = 300
        self.assertIn("state", str(vangst.exception).lower())

    def test_geweigerde_toestemming_geeft_uitleg(self):
        self.instellingen.zet("redirect_poort", 8797)
        self.mock.scenario.weiger_autorisatie = "access_denied"
        auth.WACHT_OP_TOESTEMMING_SECONDEN = 8

        def bootst_browser_na(url):
            try:
                urllib.request.urlopen(url, timeout=5).read()
            except Exception:
                pass
            return True

        origineel = auth.webbrowser.open
        auth.webbrowser.open = bootst_browser_na
        try:
            with self.assertRaises(AuthenticatieFout) as vangst:
                auth.koppel(self.instellingen, self.opslag, meldt=lambda *_: None)
        finally:
            auth.webbrowser.open = origineel
            auth.WACHT_OP_TOESTEMMING_SECONDEN = 300
        self.assertIn("geweigerd", str(vangst.exception).lower())


class TestTokensVerversen(MockBasis):
    def test_verlopen_token_wordt_vanzelf_ververst(self):
        client, beheer = self.client_met_token(verloopt_over=-10)
        oud = beheer.tokens["access_token"]
        profiel = client.profiel()
        self.assertEqual(profiel["first_name"], "Yannick")
        self.assertNotEqual(beheer.tokens["access_token"], oud)
        # Het nieuwe token is ook echt bewaard voor de volgende run.
        self.assertEqual(self.opslag.laad()["access_token"],
                         beheer.tokens["access_token"])

    def test_refresh_token_roulatie_wordt_bewaard(self):
        """WHOOP geeft elke keer een nieuw refresh token; dat moeten we volgen."""
        client, beheer = self.client_met_token(verloopt_over=-10)
        eerste_refresh = beheer.tokens["refresh_token"]
        client.profiel()
        tweede_refresh = beheer.tokens["refresh_token"]
        self.assertNotEqual(eerste_refresh, tweede_refresh)
        # Nog een ronde moet ook werken met het nieuwe token.
        beheer.tokens["verloopt_op"] = time.time() - 1
        client.profiel()
        self.assertNotEqual(beheer.tokens["refresh_token"], tweede_refresh)

    def test_onverwachte_401_leidt_tot_een_herkansing(self):
        client, beheer = self.client_met_token()
        self.mock.scenario.faal_eenmalig_met_401 = True
        profiel = client.profiel()
        self.assertEqual(profiel["first_name"], "Yannick")

    def test_ingetrokken_koppeling_geeft_duidelijke_melding(self):
        client, beheer = self.client_met_token(verloopt_over=-10)
        self.mock.scenario.weiger_refresh = True
        with self.assertRaises(TokenVerlopenFout) as vangst:
            client.profiel()
        self.assertIn("koppel", str(vangst.exception.suggestie).lower())

    def test_zonder_refresh_token_vragen_we_opnieuw_koppelen(self):
        from whoop_coach.config import schrijf_prive_json
        schrijf_prive_json(self.omgeving.tokens_pad, {
            "access_token": "verlopen", "refresh_token": None,
            "verloopt_op": time.time() - 100})
        beheer = auth.TokenBeheer(self.instellingen, self.opslag)
        with self.assertRaises(TokenVerlopenFout):
            beheer.access_token()


class TestPaginering(MockBasis):
    def test_alle_paginas_worden_opgehaald(self):
        """30 dagen data past niet in een pagina van 25."""
        client, _ = self.client_met_token()
        cycli = client.cycli()
        self.assertEqual(len(cycli), len(self.mock.scenario.cycli))
        self.assertGreater(len(cycli), 25)
        ids = [c["id"] for c in cycli]
        self.assertEqual(len(ids), len(set(ids)), "geen dubbele records")

    def test_lege_collectie_geeft_lege_lijst(self):
        client, _ = self.client_met_token()
        self.mock.scenario.trainingen = []
        self.assertEqual(client.trainingen(), [])

    def test_maximum_begrenst_het_aantal(self):
        client, _ = self.client_met_token()
        self.assertEqual(len(client.cycli(maximum=10)), 10)


class TestFoutpaden(MockBasis):
    def test_rate_limit_wordt_opnieuw_geprobeerd(self):
        client, _ = self.client_met_token()
        self.mock.scenario.faal_eenmalig_met_429 = True
        # Eenmalig 429 met Retry-After 0: de tweede poging slaagt.
        self.assertEqual(client.profiel()["first_name"], "Yannick")

    def test_aanhoudende_rate_limit_geeft_nette_fout(self):
        """Blijft WHOOP 429 geven, dan stoppen we met een begrijpelijke fout."""
        client, _ = self.client_met_token()
        self.mock.scenario.faal_endpoints_met["/user/profile/basic"] = 429
        with self.assertRaises(RateLimitFout) as vangst:
            client.profiel()
        self.assertIn("minuut", str(vangst.exception).lower())

    def test_serverfout_geeft_nette_fout(self):
        from whoop_coach.errors import ApiFout
        client, _ = self.client_met_token()
        self.mock.scenario.faal_endpoints_met["/cycle"] = 500
        with self.assertRaises(ApiFout) as vangst:
            client.cycli()
        self.assertEqual(vangst.exception.status, 500)

    def test_ontbrekende_scope_geeft_uitleg(self):
        client, _ = self.client_met_token()
        self.mock.scenario.faal_endpoints_met["/user/measurement/body"] = 403
        with self.assertRaises(AuthenticatieFout) as vangst:
            client.lichaamsmaten()
        self.assertIn("scope", str(vangst.exception.suggestie).lower())

    def test_geen_internet_geeft_nette_fout(self):
        """Server plat: dat moet een NetwerkFout worden, geen traceback."""
        client, _ = self.client_met_token()
        self.mock.stop()
        with self.assertRaises(NetwerkFout) as vangst:
            client.profiel()
        self.assertIn("bereiken", str(vangst.exception).lower())
        # De mock is al gestopt; tearDown mag daar niet over vallen.
        self.mock.stop = lambda: None


class TestHeleKeten(MockBasis):
    def test_van_api_tot_advies(self):
        """De echte weg: data ophalen, analyseren, advies opstellen."""
        client, _ = self.client_met_token()
        data = coach.haal_data(client, dagen=28)
        self.assertTrue(data["cycli"])
        self.assertTrue(data["herstel"])
        self.assertTrue(data["trainingen"])

        advies = coach.advies_voor(data, self.instellingen,
                                   vandaag=self.mock.scenario.vandaag)
        self.assertIn(advies.naam, ("RUST", "RUSTIG", "GEMATIGD", "ZWAAR"))
        self.assertTrue(advies.sessie)
        self.assertTrue(advies.redenen)
        # De sportindeling moet kracht en hardlopen hebben herkend.
        analyse = advies.analyse
        self.assertTrue(analyse.kracht_14d, "krachttraining niet herkend")
        self.assertEqual(analyse.max_hartslag, 189.0)

    def test_ontbrekend_endpoint_blokkeert_het_advies_niet(self):
        """Valt een collectie weg, dan komt er toch een advies met een melding."""
        client, _ = self.client_met_token()
        self.mock.scenario.faal_endpoints_met["/activity/workout"] = 500
        data = coach.haal_data(client, dagen=28)
        self.assertEqual(data["trainingen"], [])
        self.assertTrue(data["waarschuwingen"])
        advies = coach.advies_voor(data, self.instellingen,
                                   vandaag=self.mock.scenario.vandaag)
        self.assertTrue(advies.sessie)
        self.assertTrue(any("Trainingen" in w for w in advies.waarschuwingen))

    def test_helemaal_geen_data_geeft_uitleg(self):
        from whoop_coach.errors import DataOntbreektFout
        client, _ = self.client_met_token()
        self.mock.scenario.cycli = []
        self.mock.scenario.herstel = []
        self.mock.scenario.slaap = []
        self.mock.scenario.trainingen = []
        data = coach.haal_data(client, dagen=28)
        with self.assertRaises(DataOntbreektFout) as vangst:
            coach.advies_voor(data, self.instellingen)
        self.assertIn("band", str(vangst.exception.suggestie).lower())

    def test_venster_vraagt_de_juiste_periode_op(self):
        client, _ = self.client_met_token()
        self.mock.scenario.verzoeken = []
        coach.haal_data(client, dagen=28)
        cyclusverzoeken = [v for p, v in self.mock.scenario.verzoeken
                           if p.endswith("/cycle")]
        self.assertTrue(cyclusverzoeken)
        self.assertIn("start", cyclusverzoeken[0])
        self.assertIn("limit", cyclusverzoeken[0])
        self.assertEqual(cyclusverzoeken[0]["limit"], ["25"])


class TestSnelheidsrem(unittest.TestCase):
    def test_rem_blijft_onder_de_limiet(self):
        rem = Snelheidsrem(5)
        klok = [0.0]
        geslapen = []

        def slaap(seconden):
            geslapen.append(seconden)
            klok[0] += seconden

        for _ in range(6):
            rem.wacht_indien_nodig(slaap=slaap, nu=lambda: klok[0])
        self.assertEqual(len(geslapen), 1)
        self.assertGreater(geslapen[0], 59)

    def test_onder_de_limiet_wordt_niet_gewacht(self):
        rem = Snelheidsrem(90)
        geslapen = []
        klok = [0.0]
        for _ in range(20):
            rem.wacht_indien_nodig(slaap=geslapen.append, nu=lambda: klok[0])
        self.assertEqual(geslapen, [])


if __name__ == "__main__":
    unittest.main()
