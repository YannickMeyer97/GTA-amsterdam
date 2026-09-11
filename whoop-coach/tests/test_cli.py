"""Tests voor de commandoregel: doen de commando's wat ze beloven?"""

import io
import json
import os
import unittest
import contextlib

import hulp  # noqa: F401
from mock_whoop import MockWhoop, standaard_scenario

from whoop_coach import cli


class CliBasis(unittest.TestCase):
    def setUp(self):
        self.mock = MockWhoop(scenario=standaard_scenario()).start()
        self.omgeving = hulp.TijdelijkeOmgeving(self.mock)
        access, refresh = self.mock.geef_token_uit()
        self.omgeving.schrijf_tokens(access, refresh)

    def tearDown(self):
        self.mock.stop()
        self.omgeving.opruimen()

    def draai(self, *argumenten):
        """Draai de CLI en vang uitvoer en foutuitvoer op."""
        uit, fout = io.StringIO(), io.StringIO()
        argv = ["--datamap", self.omgeving.map, "--geen-kleur"] + list(argumenten)
        with contextlib.redirect_stdout(uit), contextlib.redirect_stderr(fout):
            code = cli.main(argv)
        return code, uit.getvalue(), fout.getvalue()


class TestAdviesCommando(CliBasis):
    def test_advies_geeft_leesbaar_rapport(self):
        code, uit, _ = self.draai("advies", "--datum", "2026-09-11")
        self.assertEqual(code, 0)
        self.assertIn("WHOOP TRAININGSADVIES", uit)
        self.assertIn("Herstel", uit)
        self.assertIn("Slaap", uit)
        self.assertIn("VANDAAG:", uit)
        self.assertIn("Waarom:", uit)

    def test_advies_is_het_standaardcommando(self):
        code, uit, _ = self.draai("--datum", "2026-09-11")
        self.assertEqual(code, 0)
        self.assertIn("WHOOP TRAININGSADVIES", uit)

    def test_json_uitvoer_is_geldige_json(self):
        code, uit, _ = self.draai("advies", "--json", "--datum", "2026-09-11")
        self.assertEqual(code, 0)
        data = json.loads(uit)
        self.assertEqual(data["datum"], "2026-09-11")
        self.assertIn(data["niveau"], ("RUST", "RUSTIG", "GEMATIGD", "ZWAAR"))
        self.assertTrue(data["sessie"])
        self.assertTrue(data["redenen"])
        self.assertIn("herstelscore", data["meetwaarden"])

    def test_rules_json_wordt_aangemaakt(self):
        self.assertFalse(os.path.exists(self.omgeving.instellingen.regels_pad))
        self.draai("advies", "--json", "--datum", "2026-09-11")
        self.assertTrue(os.path.exists(self.omgeving.instellingen.regels_pad))
        with open(self.omgeving.instellingen.regels_pad) as bestand:
            regels = json.load(bestand)
        self.assertIn("herstel", regels)
        self.assertIn("groen_vanaf", regels["herstel"])

    def test_uitvoer_blijft_binnen_de_breedte(self):
        """Tekst moet netjes afbreken, ook in een smalle terminal."""
        _, uit, _ = self.draai("advies", "--datum", "2026-09-11")
        for regel in uit.splitlines():
            self.assertLessEqual(len(regel), 80, "te lange regel: " + regel)


class TestSportenCommando(CliBasis):
    def test_sporten_toont_en_bewaart_de_indeling(self):
        code, uit, _ = self.draai("sporten")
        self.assertEqual(code, 0)
        self.assertIn("SPORTEN IN JOUW WHOOP-HISTORIE", uit)
        self.assertIn("weightlifting", uit)
        self.assertIn("kracht", uit)
        self.assertTrue(os.path.exists(self.omgeving.instellingen.sports_pad))
        with open(self.omgeving.instellingen.sports_pad) as bestand:
            opgeslagen = json.load(bestand)
        self.assertEqual(opgeslagen["weightlifting"], "kracht")
        self.assertEqual(opgeslagen["running"], "hardlopen")

    def test_sporten_json(self):
        code, uit, _ = self.draai("sporten", "--json")
        self.assertEqual(code, 0)
        data = json.loads(uit)
        self.assertIn("indeling", data)
        self.assertIn("statistieken", data)

    def test_geen_trainingen_geeft_geen_crash(self):
        self.mock.scenario.trainingen = []
        code, uit, _ = self.draai("sporten")
        self.assertEqual(code, 0)
        self.assertIn("Geen trainingen", uit)


class TestStatusCommando(CliBasis):
    def test_status_van_een_werkende_koppeling(self):
        code, uit, _ = self.draai("status")
        self.assertEqual(code, 0)
        self.assertIn("Verbonden als", uit)
        self.assertIn("Yannick", uit)
        self.assertIn("Refresh token", uit)

    def test_client_secret_staat_niet_in_de_uitvoer(self):
        """Geheimen horen niet in beeld te verschijnen."""
        _, uit, _ = self.draai("status")
        self.assertNotIn("test-secret", uit)
        self.assertNotIn("test-client", uit)


class TestOntkoppelen(CliBasis):
    def test_ontkoppelen_verwijdert_de_tokens(self):
        self.assertTrue(os.path.exists(self.omgeving.tokens_pad))
        code, uit, _ = self.draai("ontkoppel")
        self.assertEqual(code, 0)
        self.assertFalse(os.path.exists(self.omgeving.tokens_pad))
        self.assertIn("verwijderd", uit.lower())

    def test_ontkoppelen_zonder_tokens_is_geen_fout(self):
        self.draai("ontkoppel")
        code, uit, _ = self.draai("ontkoppel")
        self.assertEqual(code, 0)
        self.assertIn("geen tokens", uit.lower())


class TestFoutmeldingen(unittest.TestCase):
    def setUp(self):
        self.omgeving = hulp.TijdelijkeOmgeving()

    def tearDown(self):
        self.omgeving.opruimen()

    def draai(self, *argumenten):
        uit, fout = io.StringIO(), io.StringIO()
        argv = ["--datamap", self.omgeving.map, "--geen-kleur"] + list(argumenten)
        with contextlib.redirect_stdout(uit), contextlib.redirect_stderr(fout):
            code = cli.main(argv)
        return code, uit.getvalue(), fout.getvalue()

    def test_advies_zonder_koppeling_legt_uit_wat_te_doen(self):
        code, _, fout = self.draai("advies")
        self.assertEqual(code, 3)
        self.assertIn("Nog niet gekoppeld", fout)
        self.assertIn("koppel", fout)

    def test_status_zonder_koppeling(self):
        code, uit, _ = self.draai("status")
        self.assertEqual(code, 1)
        self.assertIn("nog niet gekoppeld", uit.lower())

    def test_koppelen_zonder_credentials_geeft_instructies(self):
        omgeving = hulp.TijdelijkeOmgeving()
        # Haal de testcredentials weg om een verse installatie na te bootsen.
        os.remove(omgeving.instellingen.config_pad)
        uit, fout = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(uit), contextlib.redirect_stderr(fout):
            code = cli.main(["--datamap", omgeving.map, "--geen-kleur", "koppel"])
        tekst = uit.getvalue()
        omgeving.opruimen()
        self.assertEqual(code, 2)
        self.assertIn("developer.whoop.com", tekst)
        self.assertIn("Redirect URI", tekst)
        self.assertIn("http://localhost:8765/callback", tekst)
        self.assertIn("read:recovery", tekst)
        self.assertIn("offline", tekst)

    def test_onbereikbare_server_geeft_netwerkfout(self):
        """Een dichte poort mag geen traceback opleveren."""
        self.omgeving.instellingen.zet("api_basis", "http://127.0.0.1:9/developer/v2")
        self.omgeving.instellingen.bewaar_config()
        self.omgeving.schrijf_tokens("access-x", "refresh-x")
        code, _, fout = self.draai("advies")
        self.assertEqual(code, 4)
        self.assertIn("bereiken", fout.lower())
        self.assertIn("internetverbinding", fout.lower())

    def test_hulp_werkt(self):
        uit = io.StringIO()
        with contextlib.redirect_stdout(uit):
            with self.assertRaises(SystemExit):
                cli.main(["--help"])
        self.assertIn("koppel", uit.getvalue())


if __name__ == "__main__":
    unittest.main()
