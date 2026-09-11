"""Tests voor de demo-modus: die moet elke situatie aankunnen."""

import datetime as dt
import unittest

import hulp  # noqa: F401
from whoop_coach import coach, demo


class TestDemoData(unittest.TestCase):
    def setUp(self):
        self.omgeving = hulp.TijdelijkeOmgeving()

    def tearDown(self):
        self.omgeving.opruimen()

    def test_elke_situatie_geeft_een_advies(self):
        for situatie in demo.SITUATIES:
            data = demo.maak_data(situatie)
            advies = coach.advies_voor(data, self.omgeving.instellingen)
            self.assertTrue(advies.sessie, situatie)
            self.assertTrue(advies.redenen, situatie)
            self.assertIn(advies.naam,
                          ("RUST", "RUSTIG", "GEMATIGD", "ZWAAR"), situatie)

    def test_rood_geeft_geen_zware_sessie(self):
        data = demo.maak_data("rood")
        advies = coach.advies_voor(data, self.omgeving.instellingen)
        self.assertIn(advies.naam, ("RUST", "RUSTIG"))

    def test_overbelast_remt_ondanks_groen_herstel(self):
        data = demo.maak_data("overbelast")
        advies = coach.advies_voor(data, self.omgeving.instellingen)
        self.assertNotEqual(advies.naam, "ZWAAR")

    def test_groen_geeft_ruimte(self):
        data = demo.maak_data("groen")
        advies = coach.advies_voor(data, self.omgeving.instellingen)
        self.assertEqual(advies.naam, "ZWAAR")

    def test_geen_data_wordt_gemeld_maar_crasht_niet(self):
        data = demo.maak_data("geen-data")
        advies = coach.advies_voor(data, self.omgeving.instellingen)
        tekst = " ".join(r.tekst for r in advies.redenen)
        self.assertIn("dagen", tekst)
        self.assertNotEqual(advies.naam, "ZWAAR")

    def test_lopende_cyclus_zonder_eind_geeft_geen_crash(self):
        """De cyclus van vandaag heeft nog geen eindtijd."""
        data = demo.maak_data("normaal")
        vandaag = [c for c in data["cycli"] if c["end"] is None]
        self.assertTrue(vandaag, "demo hoort een lopende cyclus te bevatten")
        advies = coach.advies_voor(data, self.omgeving.instellingen)
        self.assertTrue(advies.sessie)

    def test_datum_is_instelbaar(self):
        toen = dt.date(2026, 5, 20)
        data = demo.maak_data("normaal", vandaag=toen)
        advies = coach.advies_voor(data, self.omgeving.instellingen,
                                   vandaag=toen)
        self.assertEqual(advies.analyse.vandaag, toen)


if __name__ == "__main__":
    unittest.main()
