"""Uitzoeken welke sporten in jouw historie kracht en hardlopen zijn.

We gokken niet welke sport-aanduiding wat betekent, maar kijken naar wat er
echt in jouw trainingen staat. De volgorde is:

1. **Jouw eigen indeling** uit ``sports.json``. Die wint altijd.
2. **De naam van de sport.** De v2-API geeft ``sport_name`` terug, bijvoorbeeld
   ``"running"`` of ``"weightlifting"``. Herkenbare namen delen we in.
3. **Het gedrag van de training.** Zit er afstand in en klopt het tempo met
   hardlopen, dan is het hardlopen. Geen afstand, wel een lange duur met een
   gematigde hartslag, dan lijkt het op krachttraining.

Wat we na stap 3 nog niet zeker weten, blijft ``onbekend``: dat melden we, met
de cijfers erbij, zodat jij het in ``sports.json`` kunt vastleggen.
"""

from .config import lees_json, schrijf_prive_json

KRACHT = "kracht"
HARDLOPEN = "hardlopen"
ANDERS = "anders"
ONBEKEND = "onbekend"

#: Woorddelen in een sportnaam die op krachttraining wijzen.
KRACHT_WOORDEN = (
    "weightlifting", "weight_lifting", "powerlifting", "strength",
    "functional_fitness", "crossfit", "bodybuilding", "resistance",
    "kracht", "gym",
)
#: Woorddelen die op hardlopen wijzen.
HARDLOOP_WOORDEN = (
    "running", "trail_run", "treadmill", "jogging", "hardlopen", "marathon",
)
#: Sporten die duidelijk iets anders zijn; die hoeven we niet te bevragen.
ANDERS_WOORDEN = (
    "cycling", "swimming", "walking", "hiking", "rowing", "yoga", "pilates",
    "boxing", "tennis", "padel", "football", "soccer", "basketball", "golf",
    "skiing", "snowboarding", "surfing", "climbing", "elliptical", "spin",
    "meditation", "stretching", "activity",
)


def _normaliseer(label):
    return str(label or "").strip().lower().replace(" ", "_").replace("-", "_")


def classificeer_op_naam(label):
    """Deel in op basis van de sportnaam, of geef None bij twijfel."""
    naam = _normaliseer(label)
    if not naam or naam.startswith("sport_id:"):
        return None
    for woord in HARDLOOP_WOORDEN:
        if woord in naam:
            return HARDLOPEN
    for woord in KRACHT_WOORDEN:
        if woord in naam:
            return KRACHT
    for woord in ANDERS_WOORDEN:
        if woord in naam:
            return ANDERS
    return None


def classificeer_op_gedrag(stat):
    """Deel in op basis van hoe de trainingen eruitzien, of geef None.

    Bewust voorzichtig: liever ``onbekend`` melden dan een verkeerd advies
    baseren op een slechte gok.
    """
    aantal = stat.get("aantal") or 0
    if aantal < 2:
        return None

    afstand_deel = stat.get("deel_met_afstand") or 0.0
    gem_afstand = stat.get("gemiddelde_afstand_km")
    gem_duur = stat.get("gemiddelde_duur_minuten")

    # Hardlopen: vrijwel altijd afstand, en een tempo tussen 3 en 12 min/km.
    if afstand_deel >= 0.8 and gem_afstand and gem_duur and gem_afstand >= 1.5:
        tempo = gem_duur / gem_afstand
        if 3.0 <= tempo <= 12.0:
            return HARDLOPEN

    # Kracht: nooit afstand, wel substantiele sessies.
    if afstand_deel <= 0.1 and gem_duur and gem_duur >= 25.0:
        return KRACHT

    return None


def analyseer(trainingen):
    """Vat de historie samen per sportaanduiding."""
    per_label = {}
    for training in trainingen:
        label = training.label
        stat = per_label.setdefault(label, {
            "label": label,
            "aantal": 0,
            "met_afstand": 0,
            "totale_duur_minuten": 0.0,
            "duur_metingen": 0,
            "totale_afstand_km": 0.0,
            "afstand_metingen": 0,
            "totale_strain": 0.0,
            "strain_metingen": 0,
            "totale_hartslag": 0.0,
            "hartslag_metingen": 0,
            "laatste_datum": None,
        })
        stat["aantal"] += 1
        if training.afstand_meter and training.afstand_meter > 0:
            stat["met_afstand"] += 1
            stat["totale_afstand_km"] += training.afstand_meter / 1000.0
            stat["afstand_metingen"] += 1
        duur = training.duur_minuten
        if duur:
            stat["totale_duur_minuten"] += duur
            stat["duur_metingen"] += 1
        if training.strain is not None:
            stat["totale_strain"] += training.strain
            stat["strain_metingen"] += 1
        if training.gemiddelde_hartslag:
            stat["totale_hartslag"] += training.gemiddelde_hartslag
            stat["hartslag_metingen"] += 1
        if stat["laatste_datum"] is None or training.datum > stat["laatste_datum"]:
            stat["laatste_datum"] = training.datum

    for stat in per_label.values():
        stat["deel_met_afstand"] = (
            stat["met_afstand"] / stat["aantal"] if stat["aantal"] else 0.0)
        stat["gemiddelde_duur_minuten"] = (
            stat["totale_duur_minuten"] / stat["duur_metingen"]
            if stat["duur_metingen"] else None)
        stat["gemiddelde_afstand_km"] = (
            stat["totale_afstand_km"] / stat["afstand_metingen"]
            if stat["afstand_metingen"] else None)
        stat["gemiddelde_strain"] = (
            stat["totale_strain"] / stat["strain_metingen"]
            if stat["strain_metingen"] else None)
        stat["gemiddelde_hartslag"] = (
            stat["totale_hartslag"] / stat["hartslag_metingen"]
            if stat["hartslag_metingen"] else None)

    return sorted(per_label.values(), key=lambda s: s["aantal"], reverse=True)


class Sportindeling(object):
    """Weet van elke sportaanduiding of het kracht, hardlopen of iets anders is."""

    def __init__(self, indeling=None, herkomst=None):
        self.indeling = {_normaliseer(k): v for k, v in (indeling or {}).items()}
        #: Waar de indeling vandaan komt, per label: eigen/naam/gedrag.
        self.herkomst = herkomst or {}

    def soort(self, label):
        return self.indeling.get(_normaliseer(label), ONBEKEND)

    def is_kracht(self, training):
        return self.soort(training.label) == KRACHT

    def is_hardlopen(self, training):
        return self.soort(training.label) == HARDLOPEN

    def onbekende_labels(self):
        return sorted(l for l, s in self.indeling.items() if s == ONBEKEND)

    def als_dict(self):
        return dict(self.indeling)


def bepaal_indeling(statistieken, eigen_indeling=None):
    """Bouw de indeling uit de statistieken, met jouw keuzes bovenaan."""
    eigen = {_normaliseer(k): v for k, v in (eigen_indeling or {}).items()
             if k and not str(k).startswith("_")}
    indeling = {}
    herkomst = {}

    for stat in statistieken:
        label = _normaliseer(stat["label"])
        if label in eigen:
            indeling[label] = eigen[label]
            herkomst[label] = "eigen"
            continue
        op_naam = classificeer_op_naam(stat["label"])
        if op_naam:
            indeling[label] = op_naam
            herkomst[label] = "naam"
            continue
        op_gedrag = classificeer_op_gedrag(stat)
        if op_gedrag:
            indeling[label] = op_gedrag
            herkomst[label] = "gedrag"
            continue
        indeling[label] = ONBEKEND
        herkomst[label] = "onbepaald"

    # Labels die jij zelf hebt vastgelegd maar die (nog) niet in de opgehaalde
    # periode voorkomen, blijven staan.
    for label, soort in eigen.items():
        if label not in indeling:
            indeling[label] = soort
            herkomst[label] = "eigen"

    return Sportindeling(indeling, herkomst)


def laad_eigen_indeling(instellingen):
    data = lees_json(instellingen.sports_pad, {}) or {}
    return {k: v for k, v in data.items() if not str(k).startswith("_")}


def bewaar_indeling(instellingen, sportindeling, statistieken=None):
    """Schrijf de indeling weg zodat je hem kunt nalezen en aanpassen."""
    data = {
        "_uitleg": (
            "Welke WHOOP-sporten bij jou meetellen als krachttraining of "
            "hardlopen. Geldige waarden: 'kracht', 'hardlopen', 'anders', "
            "'onbekend'. Wat jij hier invult wint van de automatische "
            "herkenning."
        ),
        "_bijgewerkt": True,
    }
    for label in sorted(sportindeling.indeling):
        data[label] = sportindeling.indeling[label]
    if statistieken:
        data["_gezien"] = {
            stat["label"]: {
                "aantal": stat["aantal"],
                "gemiddelde_duur_minuten": _rond(stat.get("gemiddelde_duur_minuten")),
                "gemiddelde_afstand_km": _rond(stat.get("gemiddelde_afstand_km")),
                "gemiddelde_strain": _rond(stat.get("gemiddelde_strain")),
            }
            for stat in statistieken
        }
    schrijf_prive_json(instellingen.sports_pad, data)


def _rond(waarde, cijfers=1):
    return round(waarde, cijfers) if isinstance(waarde, (int, float)) else None
