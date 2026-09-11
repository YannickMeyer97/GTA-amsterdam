"""Configuratie: paden, credentials en instelbare regels.

Alle gebruikersdata staat in een enkele map (standaard ``~/.whoop-coach``):

    config.json   client id/secret en voorkeuren
    tokens.json   access/refresh token (alleen leesbaar voor jou, mode 0600)
    sports.json   welke WHOOP-sportnamen bij jou kracht of hardlopen zijn
    rules.json    de drempelwaarden van de adviesmotor

Elk pad en elke URL is te overschrijven via een omgevingsvariabele, zodat de
testsuite tegen een mockserver in een wegwerpmap kan draaien.
"""

import copy
import json
import os
import stat

from .errors import ConfiguratieFout

# --- Vaste endpoints van WHOOP (geverifieerd tegen de v2-documentatie) -------

STANDAARD_API_BASIS = "https://api.prod.whoop.com/developer/v2"
STANDAARD_AUTORISATIE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
STANDAARD_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"

#: De scopes die de adviseur nodig heeft. ``offline`` levert het refresh token.
SCOPES = [
    "read:recovery",
    "read:cycles",
    "read:sleep",
    "read:workout",
    "read:profile",
    "read:body_measurement",
    "offline",
]

#: Poort van het lokale opvangservertje voor de OAuth-redirect.
STANDAARD_REDIRECT_POORT = 8765
#: Pad van de redirect. Samen met de poort vormt dit de redirect-URI die je
#: bij WHOOP registreert; die moet letterlijk gelijk zijn.
STANDAARD_REDIRECT_PAD = "/callback"

#: WHOOP staat 100 verzoeken per minuut toe; we blijven daar bewust onder.
VERZOEKEN_PER_MINUUT = 90


def standaard_datamap():
    """De map met tokens en instellingen, te verzetten via WHOOP_COACH_HOME."""
    eigen = os.environ.get("WHOOP_COACH_HOME")
    if eigen:
        return os.path.abspath(os.path.expanduser(eigen))
    return os.path.join(os.path.expanduser("~"), ".whoop-coach")


def zorg_voor_map(pad):
    """Maak de datamap aan als hij nog niet bestaat, alleen voor de eigenaar."""
    if not os.path.isdir(pad):
        os.makedirs(pad, mode=0o700, exist_ok=True)
    return pad


def schrijf_prive_json(pad, data):
    """Schrijf JSON weg met mode 0600, atomisch via een tijdelijk bestand.

    Atomisch omdat een half weggeschreven tokens.json de koppeling sloopt:
    beter de oude inhoud houden dan een kapot bestand achterlaten.
    """
    zorg_voor_map(os.path.dirname(pad))
    tijdelijk = pad + ".tmp"
    with open(tijdelijk, "w", encoding="utf-8") as bestand:
        json.dump(data, bestand, indent=2, ensure_ascii=False)
        bestand.write("\n")
    os.chmod(tijdelijk, stat.S_IRUSR | stat.S_IWUSR)
    os.replace(tijdelijk, pad)
    return pad


def lees_json(pad, standaard=None):
    """Lees JSON; een ontbrekend bestand is geen fout, kapotte inhoud wel."""
    if not os.path.exists(pad):
        return copy.deepcopy(standaard)
    try:
        with open(pad, "r", encoding="utf-8") as bestand:
            return json.load(bestand)
    except json.JSONDecodeError as fout:
        raise ConfiguratieFout(
            "Het bestand {} is geen geldige JSON ({}).".format(pad, fout),
            suggestie="Herstel het bestand of verwijder het; de tool maakt "
                      "dan een nieuwe met standaardwaarden aan.",
        )
    except OSError as fout:
        raise ConfiguratieFout(
            "Kan {} niet lezen: {}".format(pad, fout),
            suggestie="Controleer de rechten op de map.",
        )


# --- Instelbare adviesregels ------------------------------------------------

#: Alle drempelwaarden van de adviesmotor op een plek. Wordt bij de eerste run
#: als rules.json weggeschreven; wat daar staat wint van deze waarden.
STANDAARD_REGELS = {
    "_uitleg": (
        "Drempelwaarden van de adviesmotor. Pas gerust aan; de tool leest dit "
        "bestand bij elke run opnieuw. Verwijder het bestand om terug te "
        "gaan naar de standaardwaarden."
    ),
    "herstel": {
        "groen_vanaf": 67,
        "geel_vanaf": 34,
        "diep_rood_tot": 25,
    },
    "slaap": {
        "slecht_tot": 60,
        "matig_tot": 75,
        "tekort_uren_alarm": 2.0,
    },
    "hrv": {
        "basislijn_dagen": 14,
        "verlaagd_onder_ratio": 0.85,
        "sterk_verlaagd_onder_ratio": 0.75,
    },
    "rusthartslag": {
        "basislijn_dagen": 14,
        "verhoogd_vanaf_bpm": 4.0,
        "sterk_verhoogd_vanaf_bpm": 7.0,
    },
    "belasting": {
        "zware_sessie_strain_vanaf": 14.0,
        "dagstrain_hoog_vanaf": 15.0,
        "week_gemiddelde_hoog_vanaf": 13.0,
        "drie_daagse_som_hoog_vanaf": 40.0,
        "acuut_chronisch_hoog_vanaf": 1.30,
        "acuut_chronisch_laag_tot": 0.80,
        "min_dagen_tussen_zware_sessies": 1,
        "zware_dagen_op_rij_matig": 2,
        "zware_dagen_op_rij_rustig": 3,
    },
    "balans": {
        "hardloop_doel_per_14_dagen": 2,
        "kracht_doel_per_7_dagen": 3,
        "hardlopen_duwtje_onder": 2,
    },
    "hartslagzones": {
        "_uitleg": "Percentages van je maximale hartslag uit WHOOP.",
        "zone2": [0.60, 0.70],
        "zone3": [0.70, 0.80],
        "zone4": [0.80, 0.90],
        "zone5": [0.90, 1.00],
        "standaard_max_hartslag": 190,
    },
    "venster": {
        "analyse_dagen": 28,
        "recente_dagen": 7,
    },
}


def diep_samenvoegen(basis, overschrijving):
    """Voeg twee geneste dicts samen; de overschrijving wint per sleutel."""
    resultaat = copy.deepcopy(basis)
    for sleutel, waarde in (overschrijving or {}).items():
        if (
            sleutel in resultaat
            and isinstance(resultaat[sleutel], dict)
            and isinstance(waarde, dict)
        ):
            resultaat[sleutel] = diep_samenvoegen(resultaat[sleutel], waarde)
        else:
            resultaat[sleutel] = waarde
    return resultaat


class Instellingen(object):
    """Bundelt paden, credentials, endpoints en regels voor een run."""

    def __init__(self, datamap=None):
        self.datamap = datamap or standaard_datamap()
        self.config_pad = os.path.join(self.datamap, "config.json")
        self.tokens_pad = os.path.join(self.datamap, "tokens.json")
        self.sports_pad = os.path.join(self.datamap, "sports.json")
        self.regels_pad = os.path.join(self.datamap, "rules.json")
        self._config = lees_json(self.config_pad, {}) or {}

    # -- ruwe configwaarden --------------------------------------------------

    def haal(self, sleutel, standaard=None):
        return self._config.get(sleutel, standaard)

    def zet(self, sleutel, waarde):
        self._config[sleutel] = waarde

    def bewaar_config(self):
        schrijf_prive_json(self.config_pad, self._config)

    # -- credentials ---------------------------------------------------------

    @property
    def client_id(self):
        """Client ID uit de omgeving, anders uit config.json."""
        return os.environ.get("WHOOP_CLIENT_ID") or self._config.get("client_id")

    @property
    def client_secret(self):
        return os.environ.get("WHOOP_CLIENT_SECRET") or self._config.get("client_secret")

    def eis_credentials(self):
        """Geef (id, secret) of leg uit hoe je ze aanmaakt."""
        if not self.client_id or not self.client_secret:
            raise ConfiguratieFout(
                "Geen WHOOP client id/secret gevonden.",
                suggestie=(
                    "Maak eenmalig een app aan op developer.whoop.com en draai "
                    "daarna:\n"
                    "    python3 -m whoop_coach koppel --client-id ... "
                    "--client-secret ...\n"
                    "Zie de README voor precies wat je op developer.whoop.com "
                    "invult (let op: de redirect-URI moet exact overeenkomen "
                    "met {}).".format(self.redirect_uri)
                ),
            )
        return self.client_id, self.client_secret

    # -- endpoints (overschrijfbaar voor tests) ------------------------------

    @property
    def api_basis(self):
        return (
            os.environ.get("WHOOP_COACH_API_BASIS")
            or self._config.get("api_basis")
            or STANDAARD_API_BASIS
        ).rstrip("/")

    @property
    def autorisatie_url(self):
        return (
            os.environ.get("WHOOP_COACH_AUTORISATIE_URL")
            or self._config.get("autorisatie_url")
            or STANDAARD_AUTORISATIE_URL
        )

    @property
    def token_url(self):
        return (
            os.environ.get("WHOOP_COACH_TOKEN_URL")
            or self._config.get("token_url")
            or STANDAARD_TOKEN_URL
        )

    @property
    def redirect_poort(self):
        uit_omgeving = os.environ.get("WHOOP_COACH_REDIRECT_POORT")
        if uit_omgeving:
            return int(uit_omgeving)
        return int(self._config.get("redirect_poort", STANDAARD_REDIRECT_POORT))

    @property
    def redirect_uri(self):
        """De redirect-URI. Moet letterlijk zo bij WHOOP geregistreerd staan."""
        eigen = os.environ.get("WHOOP_COACH_REDIRECT_URI") or self._config.get("redirect_uri")
        if eigen:
            return eigen
        return "http://localhost:{}{}".format(self.redirect_poort, STANDAARD_REDIRECT_PAD)

    @property
    def token_opslag(self):
        """``bestand`` (standaard) of ``sleutelhanger`` voor de macOS Keychain."""
        return os.environ.get("WHOOP_COACH_TOKEN_OPSLAG") or self._config.get(
            "token_opslag", "bestand"
        )

    # -- regels --------------------------------------------------------------

    def regels(self):
        """De adviesregels: standaardwaarden met rules.json eroverheen."""
        eigen = lees_json(self.regels_pad, None)
        if eigen is None:
            return copy.deepcopy(STANDAARD_REGELS)
        return diep_samenvoegen(STANDAARD_REGELS, eigen)

    def schrijf_standaardregels_indien_afwezig(self):
        """Zet rules.json neer zodat de drempels zichtbaar en aanpasbaar zijn."""
        if not os.path.exists(self.regels_pad):
            schrijf_prive_json(self.regels_pad, STANDAARD_REGELS)
            return True
        return False
