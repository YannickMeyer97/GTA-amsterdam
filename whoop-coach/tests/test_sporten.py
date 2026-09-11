"""Tests voor het herkennen van krachttraining en hardlopen."""

import datetime as dt
import unittest

import hulp  # noqa: F401
from whoop_coach import model, sporten


def training(sport_name=None, minuten=55, km=None, dagen_geleden=1,
             strain=11.0, sport_id=None):
    start = dt.datetime(2026, 9, 11, 17, 0, tzinfo=dt.timezone.utc) \
        - dt.timedelta(days=dagen_geleden)
    record = {
        "id": "t{}{}".format(sport_name, dagen_geleden),
        "start": start.isoformat().replace("+00:00", "Z"),
        "end": (start + dt.timedelta(minutes=minuten)).isoformat().replace("+00:00", "Z"),
        "score_state": "SCORED",
        "score": {"strain": strain, "average_heart_rate": 135},
    }
    if sport_name:
        record["sport_name"] = sport_name
    if sport_id is not None:
        record["sport_id"] = sport_id
    if km:
        record["score"]["distance_meter"] = km * 1000.0
    return model.Training(record)


class TestOpNaam(unittest.TestCase):
    def test_bekende_krachtnamen(self):
        for naam in ("weightlifting", "powerlifting", "functional_fitness",
                     "strength_trainer"):
            self.assertEqual(sporten.classificeer_op_naam(naam), sporten.KRACHT,
                             "{} zou kracht moeten zijn".format(naam))

    def test_bekende_hardloopnamen(self):
        for naam in ("running", "trail_running", "Treadmill"):
            self.assertEqual(sporten.classificeer_op_naam(naam),
                             sporten.HARDLOPEN,
                             "{} zou hardlopen moeten zijn".format(naam))

    def test_andere_sporten(self):
        for naam in ("cycling", "swimming", "padel", "yoga"):
            self.assertEqual(sporten.classificeer_op_naam(naam), sporten.ANDERS)

    def test_onbekende_naam_geeft_none(self):
        self.assertIsNone(sporten.classificeer_op_naam("zaterdagritueel"))

    def test_v1_sport_id_wordt_niet_gegokt(self):
        """Een kaal nummer zegt niets; dat raden we niet."""
        self.assertIsNone(sporten.classificeer_op_naam("sport_id:45"))


class TestOpGedrag(unittest.TestCase):
    def test_afstand_en_tempo_wijzen_op_hardlopen(self):
        trainingen = [training("raadsel", minuten=40, km=7.0,
                               dagen_geleden=i) for i in range(4)]
        stats = sporten.analyseer(trainingen)
        self.assertEqual(sporten.classificeer_op_gedrag(stats[0]),
                         sporten.HARDLOPEN)

    def test_lange_sessie_zonder_afstand_wijst_op_kracht(self):
        trainingen = [training("raadsel", minuten=60, dagen_geleden=i)
                      for i in range(4)]
        stats = sporten.analyseer(trainingen)
        self.assertEqual(sporten.classificeer_op_gedrag(stats[0]),
                         sporten.KRACHT)

    def test_te_weinig_data_geeft_geen_oordeel(self):
        stats = sporten.analyseer([training("raadsel", minuten=60)])
        self.assertIsNone(sporten.classificeer_op_gedrag(stats[0]))

    def test_wandeltempo_is_geen_hardlopen(self):
        """15 min/km is wandelen; dat mag niet als hardlopen tellen."""
        trainingen = [training("raadsel", minuten=60, km=4.0,
                               dagen_geleden=i) for i in range(4)]
        stats = sporten.analyseer(trainingen)
        self.assertIsNone(sporten.classificeer_op_gedrag(stats[0]))


class TestIndeling(unittest.TestCase):
    def test_eigen_keuze_wint_van_de_naam(self):
        trainingen = [training("running", km=6.0, dagen_geleden=i)
                      for i in range(3)]
        stats = sporten.analyseer(trainingen)
        indeling = sporten.bepaal_indeling(stats, {"running": "anders"})
        self.assertEqual(indeling.soort("running"), "anders")
        self.assertEqual(indeling.herkomst["running"], "eigen")

    def test_herkomst_wordt_bijgehouden(self):
        trainingen = ([training("weightlifting", dagen_geleden=i) for i in range(3)]
                      + [training("raadsel", minuten=45, km=7.5, dagen_geleden=i)
                         for i in range(3)])
        stats = sporten.analyseer(trainingen)
        indeling = sporten.bepaal_indeling(stats)
        self.assertEqual(indeling.herkomst["weightlifting"], "naam")
        self.assertEqual(indeling.herkomst["raadsel"], "gedrag")

    def test_onbekend_blijft_onbekend(self):
        stats = sporten.analyseer([training("raadsel", minuten=12)])
        indeling = sporten.bepaal_indeling(stats)
        self.assertEqual(indeling.soort("raadsel"), sporten.ONBEKEND)
        self.assertIn("raadsel", indeling.onbekende_labels())

    def test_hoofdletters_en_spaties_maken_niet_uit(self):
        stats = sporten.analyseer([training("Weight Lifting", dagen_geleden=1)])
        indeling = sporten.bepaal_indeling(stats)
        self.assertEqual(indeling.soort("Weight Lifting"), sporten.KRACHT)
        self.assertEqual(indeling.soort("weight_lifting"), sporten.KRACHT)

    def test_eigen_label_buiten_de_periode_blijft_staan(self):
        indeling = sporten.bepaal_indeling([], {"kettlebells": "kracht"})
        self.assertEqual(indeling.soort("kettlebells"), "kracht")


class TestStatistieken(unittest.TestCase):
    def test_gemiddelden_kloppen(self):
        trainingen = [training("running", minuten=30, km=5.0, dagen_geleden=1),
                      training("running", minuten=50, km=10.0, dagen_geleden=2)]
        stat = sporten.analyseer(trainingen)[0]
        self.assertEqual(stat["aantal"], 2)
        self.assertAlmostEqual(stat["gemiddelde_duur_minuten"], 40.0)
        self.assertAlmostEqual(stat["gemiddelde_afstand_km"], 7.5)
        self.assertAlmostEqual(stat["deel_met_afstand"], 1.0)

    def test_gesorteerd_op_aantal(self):
        trainingen = ([training("running", km=5.0, dagen_geleden=i) for i in range(2)]
                      + [training("weightlifting", dagen_geleden=i) for i in range(5)])
        stats = sporten.analyseer(trainingen)
        self.assertEqual(stats[0]["label"], "weightlifting")


class TestOpslaan(unittest.TestCase):
    def setUp(self):
        self.omgeving = hulp.TijdelijkeOmgeving()

    def tearDown(self):
        self.omgeving.opruimen()

    def test_bewaren_en_terugleggen(self):
        trainingen = [training("weightlifting", dagen_geleden=i) for i in range(3)]
        stats = sporten.analyseer(trainingen)
        indeling = sporten.bepaal_indeling(stats)
        sporten.bewaar_indeling(self.omgeving.instellingen, indeling, stats)

        terug = sporten.laad_eigen_indeling(self.omgeving.instellingen)
        self.assertEqual(terug["weightlifting"], sporten.KRACHT)
        # De uitleg-sleutels horen niet als sport terug te komen.
        self.assertNotIn("_uitleg", terug)
        self.assertNotIn("_gezien", terug)


if __name__ == "__main__":
    unittest.main()
