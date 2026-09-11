"""Verzonnen data om de tool te bekijken zonder WHOOP-koppeling.

Handig om te zien hoe het advies eruitziet voordat je een developer-app
aanmaakt, en om een regelwijziging in rules.json te testen zonder je echte
gegevens af te wachten.
"""

import datetime as dt
import uuid

TIJDZONE = "+02:00"
ZONE = dt.timezone(dt.timedelta(hours=2))

#: Kant-en-klare situaties om mee te spelen.
SITUATIES = ("normaal", "groen", "geel", "rood", "overbelast", "geen-data")


def _iso(moment):
    return moment.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _profiel(situatie, dagen_geleden):
    """Geeft (strain, herstel, hrv, rhr, slaapprestatie, slaapuren) per dag."""
    vandaag = dagen_geleden == 0
    if situatie == "groen":
        return (7.5, 84 if vandaag else 72, 74.0 if vandaag else 66.0,
                48 if vandaag else 51, 93 if vandaag else 88, 8.3)
    if situatie == "geel":
        return (11.0, 51 if vandaag else 62, 55.0 if vandaag else 63.0,
                55 if vandaag else 52, 74 if vandaag else 85, 6.8)
    if situatie == "rood":
        return (12.0, 24 if vandaag else 58, 38.0 if vandaag else 62.0,
                61 if vandaag else 52, 54 if vandaag else 84, 5.2)
    if situatie == "overbelast":
        return (16.5, 70 if vandaag else 62, 60.0, 54, 80, 7.0)
    # normaal: drie krachtdagen per week, af en toe hardlopen
    weekdag = (dt.date.today() - dt.timedelta(days=dagen_geleden)).weekday()
    kracht = weekdag in (0, 2, 4)
    strain = 8.0 + (4.5 if kracht else 0.0)
    return (strain, 71 if vandaag else 66, 65.0, 51, 87, 7.7)


def maak_data(situatie="normaal", dagen=28, vandaag=None):
    """Bouw een dataset in exact de vorm die de API teruggeeft."""
    vandaag = vandaag or dt.date.today()
    cycli, herstel, slaap, trainingen = [], [], [], []

    if situatie == "geen-data":
        # Wel historie, maar de laatste twee dagen geen band gedragen.
        stop_bij = 2
    else:
        stop_bij = 0

    for geleden in range(dagen, stop_bij - 1, -1):
        datum = vandaag - dt.timedelta(days=geleden)
        strain, herstelscore, hrv, rhr, slaapprestatie, slaapuren = _profiel(
            situatie, geleden)

        cycle_id = 900000 + (dagen - geleden)
        start = dt.datetime.combine(datum, dt.time(6, 45), tzinfo=ZONE)
        cyclus = {
            "id": cycle_id, "user_id": 1, "created_at": _iso(start),
            "updated_at": _iso(start), "start": _iso(start),
            "timezone_offset": TIJDZONE, "score_state": "SCORED",
            "score": {"strain": strain, "kilojoule": 8100.0,
                      "average_heart_rate": 67, "max_heart_rate": 150},
        }
        if geleden > 0:
            cyclus["end"] = _iso(start + dt.timedelta(days=1))
        else:
            # De cyclus van vandaag loopt nog: WHOOP stuurt dan geen eind mee.
            cyclus["end"] = None
            cyclus["score"]["strain"] = strain * 0.3
        cycli.append(cyclus)

        slaap_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, "demo-%s" % datum))
        herstel.append({
            "cycle_id": cycle_id, "sleep_id": slaap_id, "user_id": 1,
            "created_at": _iso(start), "updated_at": _iso(start),
            "score_state": "SCORED",
            "score": {"user_calibrating": False,
                      "recovery_score": herstelscore,
                      "resting_heart_rate": rhr,
                      "hrv_rmssd_milli": hrv,
                      "spo2_percentage": 96.2, "skin_temp_celsius": 33.4},
        })

        bed = dt.datetime.combine(datum - dt.timedelta(days=1),
                                  dt.time(23, 10), tzinfo=ZONE)
        in_bed = (slaapuren + 0.6) * 3600000
        slaap.append({
            "id": slaap_id, "user_id": 1, "created_at": _iso(bed),
            "updated_at": _iso(bed), "start": _iso(bed),
            "end": _iso(bed + dt.timedelta(hours=slaapuren + 0.6)),
            "timezone_offset": TIJDZONE, "nap": False,
            "score_state": "SCORED",
            "score": {
                "stage_summary": {
                    "total_in_bed_time_milli": int(in_bed),
                    "total_awake_time_milli": int(0.6 * 3600000),
                    "total_no_data_time_milli": 0,
                    "total_light_sleep_time_milli": int(slaapuren * 0.5 * 3600000),
                    "total_slow_wave_sleep_time_milli": int(slaapuren * 0.22 * 3600000),
                    "total_rem_sleep_time_milli": int(slaapuren * 0.28 * 3600000),
                    "sleep_cycle_count": 5, "disturbance_count": 9,
                },
                "sleep_needed": {"baseline_milli": int(8.0 * 3600000),
                                 "need_from_sleep_debt_milli": int(0.4 * 3600000),
                                 "need_from_recent_strain_milli": int(0.3 * 3600000),
                                 "need_from_recent_nap_milli": 0},
                "respiratory_rate": 14.4,
                "sleep_performance_percentage": slaapprestatie,
                "sleep_consistency_percentage": 70,
                "sleep_efficiency_percentage": 92.0,
            },
        })

        weekdag = datum.weekday()
        if situatie == "overbelast":
            doet_kracht, doet_hardlopen = weekdag != 6, weekdag == 6
        else:
            doet_kracht, doet_hardlopen = weekdag in (0, 2, 4), weekdag == 6
        if doet_kracht and geleden > 0:
            trainingen.append(_training(datum, "weightlifting", 58, 11.4))
        if doet_hardlopen and geleden > 7:
            trainingen.append(_training(datum, "running", 38, 12.8, 6.4))

    return {
        "cycli": cycli, "herstel": herstel, "slaap": slaap,
        "trainingen": trainingen,
        "lichaamsmaten": {"height_meter": 1.84, "weight_kilogram": 83.0,
                          "max_heart_rate": 188},
        "waarschuwingen": ["Dit is verzonnen demo-data, niet je echte WHOOP."],
    }


def _training(datum, sport_name, minuten, strain, km=None):
    start = dt.datetime.combine(datum, dt.time(17, 30), tzinfo=ZONE)
    score = {"strain": strain, "average_heart_rate": 134,
             "max_heart_rate": 171, "kilojoule": 1750.0,
             "percent_recorded": 100.0}
    if km:
        score["distance_meter"] = km * 1000.0
    return {
        "id": str(uuid.uuid4()), "user_id": 1, "created_at": _iso(start),
        "updated_at": _iso(start), "start": _iso(start),
        "end": _iso(start + dt.timedelta(minutes=minuten)),
        "timezone_offset": TIJDZONE, "sport_name": sport_name,
        "score_state": "SCORED", "score": score,
    }
