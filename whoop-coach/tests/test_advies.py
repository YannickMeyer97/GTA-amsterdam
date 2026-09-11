"""Tests voor de adviesmotor: geeft elk scenario het advies dat we bedoelen?"""

import datetime as dt
import unittest

import hulp  # noqa: F401
from mock_whoop import Scenario
from whoop_coach import coach
from whoop_coach.advies import (NIVEAU_MATIG, NIVEAU_RUST, NIVEAU_RUSTIG,
                                NIVEAU_ZWAAR, bepaal_advies)
from whoop_coach.config import Instellingen

VANDAAG = dt.date(2026, 9, 11)


class AdviesBasis(unittest.TestCase):
    """Basis die een scenario door de echte pijplijn haalt."""

    def setUp(self):
        self.omgeving = hulp.TijdelijkeOmgeving()
        self.instellingen = self.omgeving.instellingen

    def tearDown(self):
        self.omgeving.opruimen()

    def advies_van(self, scenario, vandaag=VANDAAG):
        data = {
            "cycli": scenario.cycli,
            "herstel": scenario.herstel,
            "slaap": scenario.slaap,
            "trainingen": scenario.trainingen,
            "lichaamsmaten": scenario.lichaamsmaten,
            "waarschuwingen": [],
        }
        analyse = coach.bouw_analyse(data, self.instellingen, vandaag=vandaag)
        return bepaal_advies(analyse)

    def bouw(self, dagen=21, **standaard):
        """Een rustige basisperiode waarin we daarna dagen overschrijven."""
        scenario = Scenario(vandaag=VANDAAG)
        for geleden in range(dagen, 0, -1):
            scenario.voeg_dag_toe(
                geleden,
                strain=standaard.get("strain", 9.0),
                herstelscore=standaard.get("herstelscore", 65),
                hrv=standaard.get("hrv", 60.0),
                rhr=standaard.get("rhr", 52),
                slaapprestatie=standaard.get("slaapprestatie", 85),
                slaapuren=standaard.get("slaapuren", 7.6),
            )
        return scenario

    def redenen_tekst(self, advies):
        return " | ".join(r.tekst for r in advies.redenen)


class TestHerstelniveaus(AdviesBasis):
    def test_groen_en_rustige_week_geeft_zwaar(self):
        scenario = self.bouw(strain=8.0)
        scenario.voeg_dag_toe(0, strain=None, herstelscore=82, hrv=72.0,
                              rhr=50, slaapprestatie=92, slaapuren=8.2)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_ZWAAR)
        self.assertIn("groen", self.redenen_tekst(advies))

    def test_geel_geeft_gematigd(self):
        scenario = self.bouw()
        scenario.voeg_dag_toe(0, herstelscore=52, hrv=58.0, rhr=53,
                              slaapprestatie=82, slaapuren=7.4)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_MATIG)

    def test_rood_geeft_actief_herstel(self):
        scenario = self.bouw()
        scenario.voeg_dag_toe(0, herstelscore=30, hrv=42.0, rhr=57,
                              slaapprestatie=70, slaapuren=6.5)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_RUSTIG)

    def test_diep_rood_geeft_rust(self):
        scenario = self.bouw()
        scenario.voeg_dag_toe(0, herstelscore=18, hrv=35.0, rhr=62,
                              slaapprestatie=55, slaapuren=5.0)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_RUST)
        self.assertIn("Niet trainen", advies.sessie)


class TestSlaapremt(AdviesBasis):
    def test_slechte_slaap_remt_groen_herstel_af(self):
        """Groen herstel maar 4 uur slaap: geen zware sessie."""
        scenario = self.bouw()
        scenario.voeg_dag_toe(0, herstelscore=80, hrv=70.0, rhr=50,
                              slaapprestatie=48, slaapuren=4.2)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_RUSTIG)
        self.assertIn("Slaapprestatie", self.redenen_tekst(advies))

    def test_matige_slaap_zet_plafond_op_gematigd(self):
        scenario = self.bouw()
        scenario.voeg_dag_toe(0, herstelscore=80, hrv=70.0, rhr=50,
                              slaapprestatie=68, slaapuren=6.4)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_MATIG)


class TestHrvEnRusthartslag(AdviesBasis):
    def test_sterk_verlaagde_hrv_remt_af(self):
        scenario = self.bouw(hrv=70.0)
        scenario.voeg_dag_toe(0, herstelscore=72, hrv=45.0, rhr=52,
                              slaapprestatie=88, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_RUSTIG)
        self.assertIn("HRV", self.redenen_tekst(advies))

    def test_verhoogde_rusthartslag_remt_af(self):
        scenario = self.bouw(rhr=50)
        scenario.voeg_dag_toe(0, herstelscore=75, hrv=64.0, rhr=59,
                              slaapprestatie=88, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertLessEqual(advies.niveau, NIVEAU_RUSTIG)
        self.assertIn("Rusthartslag", self.redenen_tekst(advies))

    def test_hrv_zonder_basislijn_remt_niet(self):
        """Eerste dagen met WHOOP: geen basislijn, dus geen valse rem."""
        scenario = Scenario(vandaag=VANDAAG)
        scenario.voeg_dag_toe(0, herstelscore=78, hrv=40.0, rhr=55,
                              slaapprestatie=88, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertNotIn("onder je basislijn", self.redenen_tekst(advies))


class TestBelasting(AdviesBasis):
    def test_zware_dag_gisteren_verhindert_tweede_zware_dag(self):
        """Groen herstel, maar gisteren zwaar: geen twee op een rij."""
        scenario = self.bouw(strain=8.0)
        scenario.voeg_dag_toe(1, strain=17.0, herstelscore=70, hrv=62.0,
                              rhr=52, slaapprestatie=86, slaapuren=7.8)
        scenario.voeg_training_toe(1, "weightlifting", strain=16.0)
        scenario.voeg_dag_toe(0, herstelscore=80, hrv=70.0, rhr=50,
                              slaapprestatie=90, slaapuren=8.2)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_MATIG)
        self.assertIn("twee zware sessies zo kort na elkaar",
                      self.redenen_tekst(advies))

    def test_hoge_weekbelasting_remt_groen_herstel(self):
        """Zware en rustige dagen afgewisseld, maar het weekgemiddelde is hoog."""
        scenario = Scenario(vandaag=VANDAAG)
        for geleden in range(21, 0, -1):
            # Om en om zwaar en rustig: geen reeks zware dagen op rij, wel
            # een weekgemiddelde boven de drempel.
            strain = 19.0 if geleden % 2 == 0 else 9.5
            scenario.voeg_dag_toe(geleden, strain=strain, herstelscore=68,
                                  hrv=62.0, rhr=52, slaapprestatie=86,
                                  slaapuren=7.8)
        scenario.voeg_dag_toe(0, herstelscore=78, hrv=68.0, rhr=51,
                              slaapprestatie=88, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_MATIG)
        self.assertIn("weekgemiddelde", self.redenen_tekst(advies).lower())

    def test_wekenlang_zwaar_geeft_actief_herstel(self):
        """Drie weken elke dag zwaar: dan is groen herstel geen vrijbrief."""
        scenario = self.bouw(strain=15.5)
        scenario.voeg_dag_toe(0, herstelscore=78, hrv=68.0, rhr=51,
                              slaapprestatie=88, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_RUSTIG)
        self.assertIn("op rij", self.redenen_tekst(advies))

    def test_drie_zware_dagen_op_rij_geeft_actief_herstel(self):
        scenario = self.bouw(strain=8.0)
        for geleden in (1, 2, 3):
            scenario.voeg_dag_toe(geleden, strain=17.5, herstelscore=68,
                                  hrv=60.0, rhr=53, slaapprestatie=84,
                                  slaapuren=7.5)
        scenario.voeg_dag_toe(0, herstelscore=75, hrv=66.0, rhr=51,
                              slaapprestatie=88, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_RUSTIG)
        self.assertIn("op rij", self.redenen_tekst(advies))

    def test_rustige_week_geeft_ruimte_opmerking(self):
        scenario = Scenario(vandaag=VANDAAG)
        for geleden in range(25, 7, -1):
            scenario.voeg_dag_toe(geleden, strain=12.0, herstelscore=70,
                                  hrv=62.0, rhr=51, slaapprestatie=88,
                                  slaapuren=8.0)
        for geleden in range(7, 0, -1):
            scenario.voeg_dag_toe(geleden, strain=5.0, herstelscore=70,
                                  hrv=62.0, rhr=51, slaapprestatie=88,
                                  slaapuren=8.0)
        scenario.voeg_dag_toe(0, herstelscore=85, hrv=74.0, rhr=48,
                              slaapprestatie=93, slaapuren=8.4)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_ZWAAR)
        self.assertIn("ruimte", self.redenen_tekst(advies).lower())


class TestModaliteit(AdviesBasis):
    def test_duwtje_richting_hardlopen_als_je_niet_loopt(self):
        scenario = self.bouw(strain=8.0)
        for geleden in (2, 5, 9, 12):
            scenario.voeg_training_toe(geleden, "weightlifting", strain=11.0)
        scenario.voeg_dag_toe(0, herstelscore=84, hrv=73.0, rhr=49,
                              slaapprestatie=92, slaapuren=8.3)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_ZWAAR)
        self.assertIn("duurloop", advies.sessie.lower())
        self.assertIn("hardlopen", self.redenen_tekst(advies).lower())

    def test_kracht_als_je_al_genoeg_loopt(self):
        scenario = self.bouw(strain=8.0)
        for geleden in (2, 6, 10):
            scenario.voeg_training_toe(geleden, "running", strain=12.0,
                                       afstand_km=7.0, minuten=40)
        scenario.voeg_training_toe(4, "weightlifting", strain=11.0)
        scenario.voeg_dag_toe(0, herstelscore=84, hrv=73.0, rhr=49,
                              slaapprestatie=92, slaapuren=8.3)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_ZWAAR)
        self.assertIn("krachttraining", advies.sessie.lower())

    def test_gematigd_hardlopen_blijft_zone_2(self):
        scenario = self.bouw()
        scenario.voeg_training_toe(3, "weightlifting", strain=11.0)
        scenario.voeg_dag_toe(0, herstelscore=55, hrv=58.0, rhr=53,
                              slaapprestatie=80, slaapuren=7.2)
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_MATIG)
        self.assertIn("zone 2", advies.sessie.lower())
        self.assertNotIn("zone 4", advies.sessie.lower())

    def test_zware_hardloopsessie_noemt_zone_4(self):
        scenario = self.bouw(strain=8.0)
        scenario.voeg_dag_toe(0, herstelscore=84, hrv=73.0, rhr=49,
                              slaapprestatie=92, slaapuren=8.3)
        advies = self.advies_van(scenario)
        self.assertIn("zone 4", advies.sessie.lower())


class TestHartslagzones(AdviesBasis):
    def test_zones_uit_werkelijke_max_hartslag(self):
        scenario = self.bouw(strain=8.0)
        scenario.lichaamsmaten = {"max_heart_rate": 190}
        scenario.voeg_dag_toe(0, herstelscore=84, hrv=73.0, rhr=49,
                              slaapprestatie=92, slaapuren=8.3)
        advies = self.advies_van(scenario)
        # Zone 4 is 80-90% van 190: 152-171.
        self.assertIn("152-171", advies.sessie)
        self.assertNotIn("schatting", advies.sessie)

    def test_zonder_max_hartslag_waarschuwen_we(self):
        scenario = self.bouw(strain=8.0)
        scenario.lichaamsmaten = {}
        scenario.voeg_dag_toe(0, herstelscore=84, hrv=73.0, rhr=49,
                              slaapprestatie=92, slaapuren=8.3)
        advies = self.advies_van(scenario)
        self.assertTrue(any("maximale hartslag" in w
                            for w in advies.waarschuwingen))
        self.assertIn("schatting", advies.sessie)


class TestOntbrekendeData(AdviesBasis):
    def test_geen_whoop_gedragen_vannacht(self):
        """Geen verse meting: gematigd, met uitleg, geen crash."""
        scenario = self.bouw(dagen=10)
        advies = self.advies_van(scenario, vandaag=VANDAAG)
        self.assertLessEqual(advies.niveau, NIVEAU_MATIG)
        self.assertIn("dag", self.redenen_tekst(advies))

    def test_helemaal_geen_herstelscores(self):
        scenario = Scenario(vandaag=VANDAAG)
        for geleden in range(5, 0, -1):
            scenario.voeg_dag_toe(geleden, score_state="PENDING_SCORE")
        advies = self.advies_van(scenario)
        self.assertEqual(advies.niveau, NIVEAU_MATIG)
        self.assertIn("Geen herstelscore", self.redenen_tekst(advies))

    def test_kalibrerende_gebruiker_wordt_gemeld(self):
        scenario = self.bouw(dagen=3)
        scenario.voeg_dag_toe(0, herstelscore=88, hrv=70.0, rhr=50,
                              slaapprestatie=90, slaapuren=8.0)
        scenario.herstel[-1]["score"]["user_calibrating"] = True
        advies = self.advies_van(scenario)
        self.assertIn("kalibreert", self.redenen_tekst(advies))
        self.assertEqual(advies.niveau, NIVEAU_MATIG)

    def test_zonder_trainingen_geen_crash(self):
        scenario = self.bouw(dagen=8)
        scenario.voeg_dag_toe(0, herstelscore=80, hrv=68.0, rhr=50,
                              slaapprestatie=90, slaapuren=8.0)
        advies = self.advies_van(scenario)
        self.assertTrue(advies.sessie)
        self.assertTrue(any("geen trainingen" in w.lower()
                            for w in advies.waarschuwingen))


class TestJsonUitvoer(AdviesBasis):
    def test_alles_is_serialiseerbaar(self):
        import json
        scenario = self.bouw(strain=8.0)
        scenario.voeg_training_toe(2, "weightlifting", strain=11.0)
        scenario.voeg_dag_toe(0, herstelscore=80, hrv=70.0, rhr=50,
                              slaapprestatie=90, slaapuren=8.0)
        advies = self.advies_van(scenario)
        tekst = json.dumps(advies.als_dict())
        terug = json.loads(tekst)
        self.assertEqual(terug["datum"], "2026-09-11")
        self.assertIn(terug["niveau"], ("RUST", "RUSTIG", "GEMATIGD", "ZWAAR"))
        self.assertIn("meetwaarden", terug)
        self.assertIn("herstelscore", terug["meetwaarden"])


class TestAanpasbareRegels(AdviesBasis):
    def test_eigen_drempel_verandert_het_advies(self):
        """Wie de groen-grens optrekt, krijgt bij 70% geen zware sessie meer."""
        from whoop_coach.config import schrijf_prive_json
        scenario = self.bouw(strain=8.0)
        scenario.voeg_dag_toe(0, herstelscore=70, hrv=66.0, rhr=50,
                              slaapprestatie=90, slaapuren=8.0)
        self.assertEqual(self.advies_van(scenario).niveau, NIVEAU_ZWAAR)

        schrijf_prive_json(self.instellingen.regels_pad,
                           {"herstel": {"groen_vanaf": 85}})
        self.instellingen = Instellingen(self.omgeving.map)
        self.assertEqual(self.advies_van(scenario).niveau, NIVEAU_MATIG)

    def test_ongeldige_rules_json_geeft_nette_fout(self):
        from whoop_coach.errors import ConfiguratieFout
        with open(self.instellingen.regels_pad, "w") as bestand:
            bestand.write("{dit is geen json")
        with self.assertRaises(ConfiguratieFout):
            self.instellingen.regels()


if __name__ == "__main__":
    unittest.main()
