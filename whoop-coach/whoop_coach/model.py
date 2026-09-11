"""Ruwe API-records omzetten naar iets waar de adviesmotor mee kan rekenen.

Twee dingen waar het hier vooral om gaat:

* **Scorestatus.** WHOOP geeft records terug met ``score_state`` ``SCORED``,
  ``PENDING_SCORE`` of ``UNSCORABLE``. Alleen ``SCORED`` bevat een ``score``;
  de rest behandelen we als ontbrekende data in plaats van als nul.
* **Lokale datum.** Tijden komen in UTC binnen, met een aparte
  ``timezone_offset`` (bijvoorbeeld ``"+02:00"``). Een nacht die om 00:30 in
  Amsterdam eindigt, is in UTC nog de vorige dag. We rekenen daarom alles om
  naar jouw lokale tijd voordat we op datum groeperen.
"""

import datetime as dt
import re

SCORE_OK = "SCORED"

_OFFSET_PATROON = re.compile(r"^([+-])(\d{2}):?(\d{2})$")


def ontleed_tijd(tekst):
    """ISO 8601 naar een tijdzonebewuste datetime; None als het niet lukt."""
    if not tekst:
        return None
    genormaliseerd = tekst.strip()
    if genormaliseerd.endswith("Z"):
        genormaliseerd = genormaliseerd[:-1] + "+00:00"
    # fromisoformat kan voor Python 3.11 maar 3 of 6 decimalen aan.
    genormaliseerd = re.sub(
        r"\.(\d{1,6})\d*",
        lambda m: "." + m.group(1).ljust(6, "0"),
        genormaliseerd,
    )
    try:
        moment = dt.datetime.fromisoformat(genormaliseerd)
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=dt.timezone.utc)
    return moment


def ontleed_offset(tekst):
    """``"+02:00"`` naar een timezone; None bij onbruikbare invoer."""
    if not tekst:
        return None
    treffer = _OFFSET_PATROON.match(tekst.strip())
    if not treffer:
        return None
    teken, uren, minuten = treffer.groups()
    delta = dt.timedelta(hours=int(uren), minutes=int(minuten))
    if teken == "-":
        delta = -delta
    return dt.timezone(delta)


def lokale_datum(record, veld="end", terugval_zone=None):
    """De lokale kalenderdatum waar een record bij hoort.

    We gebruiken standaard het einde: een cyclus of nacht telt voor de dag
    waarop hij afloopt, en dat is de dag waarvoor het advies geldt.
    """
    moment = ontleed_tijd(record.get(veld)) or ontleed_tijd(record.get("start"))
    if moment is None:
        return None
    zone = ontleed_offset(record.get("timezone_offset")) or terugval_zone
    if zone is not None:
        moment = moment.astimezone(zone)
    return moment.date()


def score_van(record):
    """De ``score``-dict, of None als WHOOP hem (nog) niet heeft."""
    if not isinstance(record, dict):
        return None
    if record.get("score_state") != SCORE_OK:
        return None
    score = record.get("score")
    return score if isinstance(score, dict) else None


def _getal(waarde):
    """Maak er een float van, of None. Voorkomt rekenen met strings of None."""
    if waarde is None or isinstance(waarde, bool):
        return None
    try:
        getal = float(waarde)
    except (TypeError, ValueError):
        return None
    if getal != getal:  # NaN
        return None
    return getal


class Dagcyclus(object):
    """Een fysiologische cyclus: in de praktijk je dag, met dagstrain.

    Een cyclus begint als je wakker wordt en loopt door tot de volgende
    ochtend. Hij hoort dus bij de dag waarop hij *begint*: het herstel dat
    erbij hoort is die ochtend gemeten, en de strain bouwt zich die dag op.
    """

    def __init__(self, record, terugval_zone=None):
        self.ruw = record
        self.id = record.get("id")
        self.datum = lokale_datum(record, "start", terugval_zone)
        self.start = ontleed_tijd(record.get("start"))
        self.eind = ontleed_tijd(record.get("end"))
        self.loopt_nog = record.get("end") in (None, "")
        score = score_van(record)
        self.strain = _getal((score or {}).get("strain"))
        self.gemiddelde_hartslag = _getal((score or {}).get("average_heart_rate"))
        self.kilojoule = _getal((score or {}).get("kilojoule"))

    def __repr__(self):
        return "<Dagcyclus {} strain={}>".format(self.datum, self.strain)


class Herstel(object):
    """Herstelscore met de onderliggende HRV en rusthartslag."""

    def __init__(self, record, cyclus_datums=None):
        self.ruw = record
        self.cycle_id = record.get("cycle_id")
        self.sleep_id = record.get("sleep_id")
        self.bijgewerkt = ontleed_tijd(record.get("updated_at")) or ontleed_tijd(
            record.get("created_at"))
        # Herstel hoort bij een cyclus; die weet de lokale datum. Zonder
        # cyclus vallen we terug op de aanmaakdatum van het record.
        self.datum = (cyclus_datums or {}).get(self.cycle_id)
        if self.datum is None and self.bijgewerkt is not None:
            self.datum = self.bijgewerkt.date()
        score = score_van(record)
        self.score = _getal((score or {}).get("recovery_score"))
        self.hrv = _getal((score or {}).get("hrv_rmssd_milli"))
        self.rusthartslag = _getal((score or {}).get("resting_heart_rate"))
        self.spo2 = _getal((score or {}).get("spo2_percentage"))
        self.huidtemperatuur = _getal((score or {}).get("skin_temp_celsius"))
        self.kalibreert = bool((score or {}).get("user_calibrating"))

    @property
    def kleur(self):
        """WHOOP's eigen indeling: groen, geel of rood."""
        if self.score is None:
            return None
        if self.score >= 67:
            return "groen"
        if self.score >= 34:
            return "geel"
        return "rood"

    def __repr__(self):
        return "<Herstel {} score={}>".format(self.datum, self.score)


class Slaap(object):
    """Een slaapsessie. Dutjes tellen apart mee."""

    def __init__(self, record, terugval_zone=None):
        self.ruw = record
        self.id = record.get("id")
        self.dutje = bool(record.get("nap"))
        self.start = ontleed_tijd(record.get("start"))
        self.eind = ontleed_tijd(record.get("end"))
        self.datum = lokale_datum(record, "end", terugval_zone)
        score = score_van(record)
        self.prestatie = _getal((score or {}).get("sleep_performance_percentage"))
        self.consistentie = _getal((score or {}).get("sleep_consistency_percentage"))
        self.efficientie = _getal((score or {}).get("sleep_efficiency_percentage"))
        self.ademhaling = _getal((score or {}).get("respiratory_rate"))

        stadia = (score or {}).get("stage_summary") or {}
        in_bed = _getal(stadia.get("total_in_bed_time_milli")) or 0.0
        wakker = _getal(stadia.get("total_awake_time_milli")) or 0.0
        geen_data = _getal(stadia.get("total_no_data_time_milli")) or 0.0
        self.licht = _getal(stadia.get("total_light_sleep_time_milli"))
        self.diep = _getal(stadia.get("total_slow_wave_sleep_time_milli"))
        self.rem = _getal(stadia.get("total_rem_sleep_time_milli"))
        self.verstoringen = _getal(stadia.get("disturbance_count"))
        #: Daadwerkelijk geslapen tijd in uren (in bed min wakker min gaten).
        self.uren = None
        if in_bed:
            self.uren = max(0.0, in_bed - wakker - geen_data) / 3600000.0

        nodig = (score or {}).get("sleep_needed") or {}
        totaal_nodig = sum(
            _getal(nodig.get(sleutel)) or 0.0
            for sleutel in (
                "baseline_milli",
                "need_from_sleep_debt_milli",
                "need_from_recent_strain_milli",
                "need_from_recent_nap_milli",
            )
        )
        self.uren_nodig = (totaal_nodig / 3600000.0) if totaal_nodig else None

    @property
    def tekort_uren(self):
        """Hoeveel uur je tekortkwam ten opzichte van je behoefte."""
        if self.uren is None or self.uren_nodig is None:
            return None
        return max(0.0, self.uren_nodig - self.uren)

    def __repr__(self):
        return "<Slaap {} prestatie={}>".format(self.datum, self.prestatie)


class Training(object):
    """Een losse training: sport, strain, duur en hartslagzones."""

    def __init__(self, record, terugval_zone=None):
        self.ruw = record
        self.id = record.get("id")
        # v2 geeft sport_name (tekst). v1 gaf sport_id (getal); we lezen beide,
        # zodat oude exports en eventuele afwijkingen ook werken.
        self.sport_naam = record.get("sport_name")
        self.sport_id = record.get("sport_id")
        self.start = ontleed_tijd(record.get("start"))
        self.eind = ontleed_tijd(record.get("end"))
        self.datum = lokale_datum(record, "start", terugval_zone)

        score = score_van(record)
        self.strain = _getal((score or {}).get("strain"))
        self.gemiddelde_hartslag = _getal((score or {}).get("average_heart_rate"))
        self.max_hartslag = _getal((score or {}).get("max_heart_rate"))
        self.afstand_meter = _getal((score or {}).get("distance_meter"))
        self.kilojoule = _getal((score or {}).get("kilojoule"))
        self.percentage_opgenomen = _getal((score or {}).get("percent_recorded"))

        zones = (score or {}).get("zone_durations") or (score or {}).get("zone_duration") or {}
        self.zone_minuten = {}
        for nummer in range(6):
            sleutel = "zone_{}_milli".format(nummer)
            waarde = _getal(zones.get(sleutel))
            if waarde is not None:
                self.zone_minuten[nummer] = waarde / 60000.0

    @property
    def duur_minuten(self):
        if self.start is None or self.eind is None:
            return None
        return max(0.0, (self.eind - self.start).total_seconds() / 60.0)

    @property
    def label(self):
        """De sportaanduiding zoals wij hem verder gebruiken."""
        if self.sport_naam:
            return str(self.sport_naam)
        if self.sport_id is not None:
            return "sport_id:{}".format(self.sport_id)
        return "onbekend"

    def __repr__(self):
        return "<Training {} {} strain={}>".format(self.datum, self.label, self.strain)


def bouw_cycli(records, terugval_zone=None):
    cycli = [Dagcyclus(r, terugval_zone) for r in records or []]
    return sorted([c for c in cycli if c.datum], key=lambda c: c.datum)


def bouw_herstel(records, cycli):
    datums = {c.id: c.datum for c in cycli}
    herstel = [Herstel(r, datums) for r in records or []]
    return sorted([h for h in herstel if h.datum], key=lambda h: h.datum)


def bouw_slaap(records, terugval_zone=None):
    slaap = [Slaap(r, terugval_zone) for r in records or []]
    return sorted([s for s in slaap if s.datum], key=lambda s: s.datum)


def bouw_trainingen(records, terugval_zone=None):
    trainingen = [Training(r, terugval_zone) for r in records or []]
    return sorted([t for t in trainingen if t.datum], key=lambda t: t.datum)
