"""OAuth 2.0 authorization-code flow tegen WHOOP.

Het koppelen gebeurt eenmalig:

1. we starten een servertje op 127.0.0.1 dat alleen de redirect opvangt;
2. we openen je browser op de autorisatiepagina van WHOOP;
3. jij geeft toestemming, WHOOP stuurt je terug naar het servertje met een code;
4. we ruilen die code bij WHOOP om voor een access- en refresh token.

Daarna verlengt :class:`TokenBeheer` het access token vanzelf zolang het
refresh token geldig blijft (daarvoor is de scope ``offline`` nodig).
"""

import http.server
import secrets
import threading
import time
import urllib.parse
import webbrowser

from . import http_hulp
from .config import SCOPES
from .errors import AuthenticatieFout, ConfiguratieFout, TokenVerlopenFout

#: Zoveel seconden voor het echte verlopen beschouwen we een token al als oud.
VEILIGHEIDSMARGE_SECONDEN = 120
#: Zo lang wachten we tot je in de browser toestemming hebt gegeven.
WACHT_OP_TOESTEMMING_SECONDEN = 300


# --- lokale opvang van de redirect ------------------------------------------

_PAGINA = """<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>{titel}</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; background:#0f1115;
         color:#e7e9ee; display:flex; min-height:100vh; margin:0;
         align-items:center; justify-content:center; }}
  .kaart {{ max-width:30rem; padding:2rem 2.25rem; background:#171a21;
           border:1px solid #262b36; border-radius:14px; }}
  h1 {{ margin:0 0 .5rem; font-size:1.35rem; color:{kleur}; }}
  p  {{ margin:.5rem 0 0; line-height:1.55; color:#aeb4c0; }}
</style></head>
<body><div class="kaart"><h1>{titel}</h1><p>{tekst}</p></div></body></html>
"""


class _RedirectAfhandelaar(http.server.BaseHTTPRequestHandler):
    """Vangt precies een redirect op en legt het resultaat op de server neer."""

    def do_GET(self):  # noqa: N802 (naam ligt vast in http.server)
        ontleed = urllib.parse.urlparse(self.path)
        vraag = urllib.parse.parse_qs(ontleed.query)

        if ontleed.path != self.server.verwacht_pad:
            self._stuur(404, "Niet gevonden",
                        "Deze pagina hoort niet bij het koppelproces.", "#f0803c")
            return

        fout = vraag.get("error", [None])[0]
        if fout:
            beschrijving = vraag.get("error_description", [""])[0]
            self.server.resultaat = {
                "fout": fout,
                "beschrijving": beschrijving or "geen toelichting van WHOOP",
            }
            self._stuur(400, "Koppelen afgebroken",
                        "WHOOP gaf terug: {}. Je kunt dit tabblad sluiten en "
                        "het in de terminal opnieuw proberen.".format(fout),
                        "#e5484d")
            return

        code = vraag.get("code", [None])[0]
        state = vraag.get("state", [None])[0]

        if not code:
            self.server.resultaat = {"fout": "geen_code",
                                     "beschrijving": "WHOOP stuurde geen code mee"}
            self._stuur(400, "Koppelen mislukt",
                        "Er kwam geen autorisatiecode terug. Probeer het "
                        "opnieuw in de terminal.", "#e5484d")
            return

        # State-controle tegen CSRF: hoort bij dezelfde koppelpoging als die
        # wij zijn begonnen.
        if not state or not secrets.compare_digest(state, self.server.verwacht_state):
            self.server.resultaat = {
                "fout": "state_klopt_niet",
                "beschrijving": "de state-waarde kwam niet overeen",
            }
            self._stuur(400, "Koppelen geweigerd",
                        "De beveiligingscontrole (state) mislukte. Start het "
                        "koppelen opnieuw in de terminal.", "#e5484d")
            return

        self.server.resultaat = {"code": code}
        self._stuur(200, "Gelukt",
                    "WHOOP is gekoppeld. Je kunt dit tabblad sluiten en "
                    "teruggaan naar de terminal.", "#30a46c")

    def _stuur(self, status, titel, tekst, kleur):
        pagina = _PAGINA.format(titel=titel, tekst=tekst, kleur=kleur).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(pagina)))
        self.end_headers()
        self.wfile.write(pagina)

    def log_message(self, *_args):
        """Stil: de toegangslog van het servertje hoort niet in de uitvoer."""


class _OpvangServer(http.server.HTTPServer):
    """HTTPServer met ruimte voor het verwachte pad, de state en het resultaat."""

    allow_reuse_address = True

    def __init__(self, adres, verwacht_pad, verwacht_state):
        super().__init__(adres, _RedirectAfhandelaar)
        self.verwacht_pad = verwacht_pad
        self.verwacht_state = verwacht_state
        self.resultaat = None


# --- de koppeling zelf ------------------------------------------------------

def bouw_autorisatie_url(instellingen, state):
    """Zet de URL in elkaar waar de gebruiker toestemming geeft."""
    params = {
        "response_type": "code",
        "client_id": instellingen.client_id,
        "redirect_uri": instellingen.redirect_uri,
        "scope": " ".join(SCOPES),
        "state": state,
    }
    return instellingen.autorisatie_url + "?" + urllib.parse.urlencode(params)


def koppel(instellingen, opslag, meldt=print, open_browser=True):
    """Voer de eenmalige koppeling uit en bewaar de tokens.

    Geeft het tokenpakket terug zoals het is opgeslagen.
    """
    instellingen.eis_credentials()

    # WHOOP eist een state van minstens 8 tekens; 32 hex-tekens is ruim genoeg.
    state = secrets.token_hex(16)
    ontleed = urllib.parse.urlparse(instellingen.redirect_uri)
    pad = ontleed.path or "/"
    poort = ontleed.port or instellingen.redirect_poort

    try:
        server = _OpvangServer(("127.0.0.1", poort), pad, state)
    except OSError as fout:
        raise ConfiguratieFout(
            "Kan poort {} niet openen om de WHOOP-redirect op te vangen: {}".format(
                poort, fout),
            suggestie=(
                "Er draait waarschijnlijk al iets op die poort. Sluit dat af, "
                "of kies een andere poort met --poort en pas de redirect-URI "
                "in je WHOOP-app daarop aan."
            ),
        )

    draad = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.2})
    draad.daemon = True
    draad.start()

    url = bouw_autorisatie_url(instellingen, state)
    meldt("Je browser opent nu de toestemmingspagina van WHOOP.")
    meldt("Lukt dat niet, open dan zelf deze link:\n\n    {}\n".format(url))

    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            meldt("(De browser openen lukte niet; gebruik de link hierboven.)")

    meldt("Wachten op je toestemming ...")
    grens = time.time() + WACHT_OP_TOESTEMMING_SECONDEN
    try:
        while server.resultaat is None and time.time() < grens:
            time.sleep(0.2)
        resultaat = server.resultaat
    finally:
        server.shutdown()
        server.server_close()

    if resultaat is None:
        raise AuthenticatieFout(
            "Er kwam binnen {} seconden geen antwoord van WHOOP terug.".format(
                WACHT_OP_TOESTEMMING_SECONDEN),
            suggestie="Draai 'koppel' opnieuw en rond het toestemmingsscherm "
                      "in de browser af.",
        )

    if "fout" in resultaat:
        raise AuthenticatieFout(
            "WHOOP weigerde de koppeling: {} ({}).".format(
                resultaat["fout"], resultaat["beschrijving"]),
            suggestie=_koppelfout_suggestie(resultaat["fout"], instellingen),
        )

    tokens = wissel_code_in(instellingen, resultaat["code"])
    opslag.bewaar(tokens)
    return tokens


def _koppelfout_suggestie(code, instellingen):
    if code in ("invalid_client", "unauthorized_client"):
        return ("Controleer je client id en secret; die moeten letterlijk "
                "overeenkomen met je app op developer.whoop.com.")
    if code in ("invalid_request", "invalid_redirect_uri", "redirect_uri_mismatch"):
        return ("De redirect-URI in je WHOOP-app moet exact '{}' zijn, "
                "inclusief http, poort en pad.".format(instellingen.redirect_uri))
    if code == "access_denied":
        return "Je hebt de toestemming geweigerd. Draai 'koppel' opnieuw."
    return "Draai 'koppel' opnieuw; zie de README voor de instellingen van de app."


def wissel_code_in(instellingen, code):
    """Ruil de autorisatiecode om voor tokens."""
    client_id, client_secret = instellingen.eis_credentials()
    antwoord = http_hulp.verzoek(
        instellingen.token_url,
        methode="POST",
        formulier={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": instellingen.redirect_uri,
        },
    )
    if antwoord.status != 200:
        raise AuthenticatieFout(
            "WHOOP wilde de autorisatiecode niet omruilen (status {}).".format(
                antwoord.status),
            suggestie=_tokenfout_suggestie(antwoord, instellingen),
        )
    return _tokens_uit_antwoord(antwoord.json())


def ververs(instellingen, tokens):
    """Haal een nieuw access token op met het refresh token.

    WHOOP rouleert het refresh token: het antwoord bevat een nieuw exemplaar
    dat we moeten bewaren, anders werkt de volgende verversing niet meer.
    """
    refresh_token = (tokens or {}).get("refresh_token")
    if not refresh_token:
        raise TokenVerlopenFout(
            "Er is geen refresh token opgeslagen.",
            suggestie="Draai 'python3 -m whoop_coach koppel' om opnieuw te koppelen.",
        )

    client_id, client_secret = instellingen.eis_credentials()
    antwoord = http_hulp.verzoek(
        instellingen.token_url,
        methode="POST",
        formulier={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
            # WHOOP adviseert offline ook bij het verversen mee te sturen,
            # anders krijg je geen nieuw refresh token terug.
            "scope": "offline",
        },
    )
    if antwoord.status != 200:
        raise TokenVerlopenFout(
            "Het verversen van je WHOOP-token mislukte (status {}).".format(
                antwoord.status),
            suggestie=(
                "Je koppeling is waarschijnlijk ingetrokken of verlopen. "
                "Draai 'python3 -m whoop_coach koppel' om opnieuw te koppelen."
            ),
        )
    nieuw = _tokens_uit_antwoord(antwoord.json())
    # Geeft WHOOP geen nieuw refresh token terug, dan houden we het oude.
    if not nieuw.get("refresh_token"):
        nieuw["refresh_token"] = refresh_token
    return nieuw


def _tokenfout_suggestie(antwoord, instellingen):
    body = (antwoord.tekst or "").lower()
    if "redirect" in body:
        return ("De redirect-URI in je WHOOP-app moet exact '{}' zijn.".format(
            instellingen.redirect_uri))
    if "client" in body:
        return "Controleer je client id en secret op developer.whoop.com."
    return "Draai 'koppel' opnieuw; zie de README voor de app-instellingen."


def _tokens_uit_antwoord(data):
    """Normaliseer het tokenantwoord en reken het verloopmoment uit."""
    if not isinstance(data, dict) or not data.get("access_token"):
        raise AuthenticatieFout(
            "WHOOP stuurde geen access token terug.",
            suggestie="Probeer opnieuw te koppelen.",
        )
    geldig = int(data.get("expires_in") or 3600)
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "token_type": data.get("token_type", "Bearer"),
        "scope": data.get("scope", " ".join(SCOPES)),
        "expires_in": geldig,
        "verloopt_op": time.time() + geldig,
        "opgehaald_op": time.time(),
    }


class TokenBeheer(object):
    """Levert een geldig access token en ververst als dat nodig is."""

    def __init__(self, instellingen, opslag):
        self.instellingen = instellingen
        self.opslag = opslag
        self._tokens = None

    @property
    def tokens(self):
        if self._tokens is None:
            self._tokens = self.opslag.laad()
        return self._tokens

    def gekoppeld(self):
        return bool((self.tokens or {}).get("access_token"))

    def verloopt_over(self):
        """Seconden tot het access token verloopt, of None als onbekend."""
        tokens = self.tokens or {}
        if not tokens.get("verloopt_op"):
            return None
        return tokens["verloopt_op"] - time.time()

    def eis_koppeling(self):
        if not self.gekoppeld():
            raise AuthenticatieFout(
                "Nog niet gekoppeld aan WHOOP.",
                suggestie="Draai eerst: python3 -m whoop_coach koppel",
            )

    def access_token(self, forceer_verversen=False):
        """Geef een bruikbaar access token, zo nodig na verversen."""
        self.eis_koppeling()
        resterend = self.verloopt_over()
        moet_verversen = (
            forceer_verversen
            or resterend is None
            or resterend < VEILIGHEIDSMARGE_SECONDEN
        )
        if moet_verversen:
            nieuw = ververs(self.instellingen, self.tokens)
            self.opslag.bewaar(nieuw)
            self._tokens = nieuw
        return self._tokens["access_token"]

    def ontkoppel(self):
        self._tokens = None
        return self.opslag.wis()
