"""Tests voor het omzetten van ruwe API-records."""

import datetime as dt
import unittest

import hulp  # noqa: F401  (zet sys.path goed)
from whoop_coach import model


class TestTijdOntleden(unittest.TestCase):
    def test_z_achtervoegsel(self):
        moment = model.ontleed_tijd("2026-09-11T06:40:00.000Z")
        self.assertEqual(moment.tzinfo, dt.timezone.utc)
        self.assertEqual(moment.hour, 6)

    def test_veel_decimalen(self):
        """WHOOP stuurt soms meer dan zes decimalen mee."""
        self.assertIsNotNone(model.ontleed_tijd("2026-09-11T06:40:00.1234567Z"))

    def test_weinig_decimalen(self):
        self.assertIsNotNone(model.ontleed_tijd("2026-09-11T06:40:00.12Z"))

    def test_onzin_geeft_none(self):
        self.assertIsNone(model.ontleed_tijd("gisteren"))
        self.assertIsNone(model.ontleed_tijd(None))
        self.assertIsNone(model.ontleed_tijd(""))

    def test_offset(self):
        zone = model.ontleed_offset("+02:00")
        self.assertEqual(zone.utcoffset(None), dt.timedelta(hours=2))
        self.assertEqual(model.ontleed_offset("-05:00").utcoffset(None),
                         dt.timedelta(hours=-5))
        self.assertIsNone(model.ontleed_offset("kaas"))


class TestLokaleDatum(unittest.TestCase):
    def test_nacht_over_middernacht_telt_voor_de_ochtend(self):
        """Een nacht die 00:30 lokaal eindigt hoort bij de nieuwe dag."""
        record = {"start": "2026-09-10T21:00:00.000Z",
                  "end": "2026-09-10T22:30:00.000Z",
                  "timezone_offset": "+02:00"}
        # 22:30 UTC is 00:30 lokaal op 11 september.
        self.assertEqual(model.lokale_datum(record), dt.date(2026, 9, 11))

    def test_zonder_offset_blijft_utc(self):
        record = {"start": "2026-09-10T21:00:00.000Z",
                  "end": "2026-09-10T22:30:00.000Z"}
        self.assertEqual(model.lokale_datum(record), dt.date(2026, 9, 10))


class TestScorestatus(unittest.TestCase):
    def test_pending_geeft_geen_score(self):
        cyclus = model.Dagcyclus({"id": 1, "score_state": "PENDING_SCORE",
                                  "start": "2026-09-11T02:00:00.000Z",
                                  "end": "2026-09-12T02:00:00.000Z",
                                  "score": {"strain": 9.0}})
        self.assertIsNone(cyclus.strain)

    def test_unscorable_geeft_geen_score(self):
        herstel = model.Herstel({"cycle_id": 1, "score_state": "UNSCORABLE",
                                 "created_at": "2026-09-11T02:00:00.000Z"})
        self.assertIsNone(herstel.score)
        self.assertIsNone(herstel.kleur)

    def test_ontbrekend_score_object(self):
        slaap = model.Slaap({"id": "a", "score_state": "SCORED",
                             "start": "2026-09-10T21:00:00.000Z",
                             "end": "2026-09-11T05:00:00.000Z"})
        self.assertIsNone(slaap.prestatie)
        self.assertIsNone(slaap.uren)
        self.assertIsNone(slaap.tekort_uren)


class TestSlaapRekenen(unittest.TestCase):
    def maak(self, in_bed_uren, wakker_uren, nodig_uren):
        return model.Slaap({
            "id": "a", "nap": False,
            "start": "2026-09-10T21:00:00.000Z",
            "end": "2026-09-11T05:00:00.000Z",
            "score_state": "SCORED",
            "score": {
                "sleep_performance_percentage": 80,
                "stage_summary": {
                    "total_in_bed_time_milli": in_bed_uren * 3600000,
                    "total_awake_time_milli": wakker_uren * 3600000,
                    "total_no_data_time_milli": 0,
                },
                "sleep_needed": {"baseline_milli": nodig_uren * 3600000},
            },
        })

    def test_uren_en_tekort(self):
        slaap = self.maak(8, 1, 8)
        self.assertAlmostEqual(slaap.uren, 7.0)
        self.assertAlmostEqual(slaap.uren_nodig, 8.0)
        self.assertAlmostEqual(slaap.tekort_uren, 1.0)

    def test_geen_negatief_tekort(self):
        slaap = self.maak(10, 0.5, 8)
        self.assertEqual(slaap.tekort_uren, 0.0)


class TestTrainingLabel(unittest.TestCase):
    def test_v2_gebruikt_sport_name(self):
        training = model.Training({"id": "a", "sport_name": "running",
                                   "start": "2026-09-11T15:00:00.000Z",
                                   "end": "2026-09-11T15:40:00.000Z"})
        self.assertEqual(training.label, "running")
        self.assertAlmostEqual(training.duur_minuten, 40.0)

    def test_v1_sport_id_blijft_bruikbaar(self):
        """Oudere data zonder sport_name mag niet omvallen."""
        training = model.Training({"id": "a", "sport_id": 45,
                                   "start": "2026-09-11T15:00:00.000Z",
                                   "end": "2026-09-11T16:00:00.000Z"})
        self.assertEqual(training.label, "sport_id:45")

    def test_zonder_sport(self):
        training = model.Training({"id": "a",
                                   "start": "2026-09-11T15:00:00.000Z",
                                   "end": "2026-09-11T16:00:00.000Z"})
        self.assertEqual(training.label, "onbekend")


class TestHerstelKoppeling(unittest.TestCase):
    def test_datum_komt_van_de_cyclus(self):
        cycli = model.bouw_cycli([{
            "id": 77, "start": "2026-09-10T02:00:00.000Z",
            "end": "2026-09-11T02:00:00.000Z", "timezone_offset": "+02:00",
            "score_state": "SCORED", "score": {"strain": 10.0}}])
        herstel = model.bouw_herstel([{
            "cycle_id": 77, "score_state": "SCORED",
            "created_at": "2026-09-11T05:00:00.000Z",
            "score": {"recovery_score": 70, "hrv_rmssd_milli": 60.0,
                      "resting_heart_rate": 50}}], cycli)
        self.assertEqual(herstel[0].datum, cycli[0].datum)
        self.assertEqual(herstel[0].kleur, "groen")


if __name__ == "__main__":
    unittest.main()
