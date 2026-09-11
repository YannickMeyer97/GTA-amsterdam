"""Dunne HTTP-laag bovenop urllib.

Alleen wat de adviseur nodig heeft: JSON ophalen, formulieren posten, en
netwerkellende vertalen naar begrijpelijke fouten in plaats van tracebacks.
"""

import json
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

from .errors import ApiFout, NetwerkFout, RateLimitFout

STANDAARD_TIMEOUT = 20.0
USER_AGENT = "whoop-coach/1.0 (+lokale trainingsadviseur)"


class Antwoord(object):
    """Het resultaat van een verzoek: status, headers en ontlede JSON."""

    def __init__(self, status, headers, tekst):
        self.status = status
        self.headers = headers or {}
        self.tekst = tekst

    def json(self):
        if not self.tekst:
            return None
        try:
            return json.loads(self.tekst)
        except json.JSONDecodeError:
            raise ApiFout(
                "WHOOP gaf een antwoord dat geen geldige JSON is.",
                status=self.status,
                body=self.tekst[:400],
                suggestie="Waarschijnlijk tijdelijk. Probeer het later opnieuw.",
            )


def _kopkaart(headers):
    """urllib-headers naar een gewone dict met kleine-letter-sleutels."""
    return {sleutel.lower(): waarde for sleutel, waarde in (headers or {}).items()}


def verzoek(url, methode="GET", params=None, formulier=None, headers=None,
            timeout=STANDAARD_TIMEOUT, pogingen=3):
    """Doe een HTTP-verzoek en geef een :class:`Antwoord`.

    Netwerkfouten en 5xx/429 worden een paar keer opnieuw geprobeerd met
    oplopende wachttijd. 4xx (behalve 429) komt direct terug: daar helpt
    wachten niet.
    """
    if params:
        gefilterd = {k: v for k, v in params.items() if v is not None}
        if gefilterd:
            url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(gefilterd)

    body = None
    alle_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if formulier is not None:
        body = urllib.parse.urlencode(formulier).encode("utf-8")
        alle_headers["Content-Type"] = "application/x-www-form-urlencoded"
    alle_headers.update(headers or {})

    laatste_fout = None
    for poging in range(1, pogingen + 1):
        aanvraag = urllib.request.Request(url, data=body, headers=alle_headers, method=methode)
        try:
            with urllib.request.urlopen(aanvraag, timeout=timeout) as reactie:
                tekst = reactie.read().decode("utf-8", errors="replace")
                return Antwoord(reactie.status, _kopkaart(dict(reactie.headers)), tekst)

        except urllib.error.HTTPError as fout:
            tekst = ""
            try:
                tekst = fout.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            kop = _kopkaart(dict(fout.headers or {}))
            antwoord = Antwoord(fout.code, kop, tekst)

            if fout.code == 429:
                wacht = _wachttijd_uit_header(kop) or _oploop(poging)
                if poging < pogingen:
                    time.sleep(wacht)
                    laatste_fout = antwoord
                    continue
                raise RateLimitFout(
                    "WHOOP's snelheidslimiet is geraakt (100 verzoeken per "
                    "minuut, 10.000 per dag).",
                    status=429,
                    body=tekst[:400],
                    suggestie="Wacht een minuut en draai het commando opnieuw.",
                )

            if 500 <= fout.code < 600 and poging < pogingen:
                time.sleep(_oploop(poging))
                laatste_fout = antwoord
                continue

            return antwoord

        except (urllib.error.URLError, socket.timeout, ssl.SSLError, OSError) as fout:
            laatste_fout = fout
            if poging < pogingen:
                time.sleep(_oploop(poging))
                continue
            raise NetwerkFout(
                "Kan WHOOP niet bereiken: {}".format(_netwerkreden(fout)),
                suggestie="Controleer je internetverbinding en probeer het "
                          "opnieuw. WHOOP kan ook tijdelijk uit de lucht zijn.",
            )

    # Alleen bereikbaar als de laatste poging een herhaalbaar antwoord gaf.
    if isinstance(laatste_fout, Antwoord):
        return laatste_fout
    raise NetwerkFout("Kan WHOOP niet bereiken.", suggestie="Probeer het later opnieuw.")


def _oploop(poging):
    """Wachttijd die per poging verdubbelt: 1s, 2s, 4s."""
    return min(2 ** (poging - 1), 8)


def _wachttijd_uit_header(headers):
    ruw = headers.get("retry-after")
    if not ruw:
        return None
    try:
        return max(0.0, min(float(ruw), 60.0))
    except (TypeError, ValueError):
        return None


def _netwerkreden(fout):
    """Maak van een urllib-fout een zin die iets zegt."""
    reden = getattr(fout, "reason", fout)
    tekst = str(reden)
    if "Name or service not known" in tekst or "nodename nor servname" in tekst:
        return "de naam api.prod.whoop.com is niet op te lossen (DNS). " \
               "Waarschijnlijk geen internetverbinding."
    if "timed out" in tekst.lower():
        return "de verbinding liep in een time-out."
    if "Connection refused" in tekst:
        return "de verbinding werd geweigerd."
    if "certificate" in tekst.lower():
        return "het TLS-certificaat kon niet worden gecontroleerd ({}).".format(tekst)
    return tekst or fout.__class__.__name__
