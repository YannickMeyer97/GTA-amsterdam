"""Client voor de WHOOP Developer API v2.

Endpoints die we gebruiken (basis: https://api.prod.whoop.com/developer/v2):

    GET /cycle                    fysiologische cycli, met dagstrain
    GET /recovery                 herstelscore, HRV en rusthartslag
    GET /activity/sleep           slaapsessies met slaapprestatie
    GET /activity/workout         losse trainingen met sport en strain
    GET /user/profile/basic       naam (alleen voor de begroeting)
    GET /user/measurement/body    onder meer je maximale hartslag

De collectie-endpoints zijn gepagineerd: elk antwoord bevat ``records`` en een
``next_token`` die leeg is zodra je aan het eind bent.
"""

import time

from . import http_hulp
from .config import VERZOEKEN_PER_MINUUT
from .errors import ApiFout, AuthenticatieFout, TokenVerlopenFout

#: WHOOP staat maximaal 25 records per pagina toe.
MAX_PER_PAGINA = 25
#: Harde bovengrens op het aantal pagina's, zodat een rare next_token-lus
#: nooit eindeloos doordraait.
MAX_PAGINAS = 40


class Snelheidsrem(object):
    """Simpele rem die onder WHOOP's 100 verzoeken per minuut blijft."""

    def __init__(self, per_minuut):
        self.per_minuut = max(1, int(per_minuut))
        self._momenten = []

    def wacht_indien_nodig(self, slaap=time.sleep, nu=time.monotonic):
        huidig = nu()
        self._momenten = [m for m in self._momenten if huidig - m < 60.0]
        if len(self._momenten) >= self.per_minuut:
            wachttijd = 60.0 - (huidig - self._momenten[0]) + 0.05
            if wachttijd > 0:
                slaap(wachttijd)
            huidig = nu()
            self._momenten = [m for m in self._momenten if huidig - m < 60.0]
        self._momenten.append(huidig)


class WhoopClient(object):
    """Praat met de WHOOP API namens een gekoppelde gebruiker."""

    def __init__(self, instellingen, tokenbeheer, snelheidsrem=None):
        self.instellingen = instellingen
        self.tokens = tokenbeheer
        self.rem = snelheidsrem or Snelheidsrem(VERZOEKEN_PER_MINUUT)

    # -- laag niveau ---------------------------------------------------------

    def _haal(self, pad, params=None):
        """Doe een GET met bearer token; ververs eenmalig bij een 401."""
        url = self.instellingen.api_basis + pad

        for poging in (1, 2):
            self.rem.wacht_indien_nodig()
            token = self.tokens.access_token(forceer_verversen=(poging == 2))
            antwoord = http_hulp.verzoek(
                url, params=params,
                headers={"Authorization": "Bearer " + token},
            )

            if antwoord.status == 200:
                return antwoord.json()

            if antwoord.status == 401 and poging == 1:
                # Token vroegtijdig ongeldig (bijvoorbeeld ingetrokken of
                # een klokverschil): een keer verversen en opnieuw proberen.
                continue

            self._werp_apifout(antwoord, pad)

        # Onbereikbaar: de lus eindigt altijd in een return of een fout.
        raise ApiFout("Onverwacht einde van het verzoek naar {}.".format(pad))

    def _werp_apifout(self, antwoord, pad):
        status = antwoord.status
        if status == 401:
            raise TokenVerlopenFout(
                "WHOOP accepteert je koppeling niet meer.",
                suggestie="Draai 'python3 -m whoop_coach koppel' om opnieuw "
                          "te koppelen.",
            )
        if status == 403:
            raise AuthenticatieFout(
                "WHOOP staat dit verzoek niet toe ({}).".format(pad),
                suggestie=(
                    "Waarschijnlijk mist je app een scope. Controleer op "
                    "developer.whoop.com of alle scopes aan staan en koppel "
                    "daarna opnieuw."
                ),
            )
        if status == 404:
            raise ApiFout(
                "WHOOP kent het endpoint {} niet.".format(pad),
                status=status,
                suggestie="Mogelijk is de API gewijzigd; controleer de "
                          "documentatie op developer.whoop.com.",
            )
        raise ApiFout(
            "WHOOP gaf een foutmelding (status {}) op {}.".format(status, pad),
            status=status,
            body=(antwoord.tekst or "")[:400],
            suggestie="Probeer het later opnieuw; blijft het fout gaan, "
                      "controleer dan status.whoop.com.",
        )

    def _verzamel(self, pad, start=None, eind=None, maximum=None):
        """Loop door alle pagina's heen en geef alle records terug."""
        records = []
        volgende = None
        for _ in range(MAX_PAGINAS):
            params = {"limit": MAX_PER_PAGINA}
            if start:
                params["start"] = start
            if eind:
                params["end"] = eind
            if volgende:
                params["nextToken"] = volgende

            data = self._haal(pad, params=params) or {}
            deel = data.get("records") or []
            records.extend(deel)

            if maximum is not None and len(records) >= maximum:
                return records[:maximum]

            volgende = data.get("next_token")
            if not volgende or not deel:
                break
        return records

    # -- endpoints -----------------------------------------------------------

    def profiel(self):
        return self._haal("/user/profile/basic")

    def lichaamsmaten(self):
        """Onder andere max_heart_rate, nodig voor de hartslagzones."""
        return self._haal("/user/measurement/body")

    def cycli(self, start=None, eind=None, maximum=None):
        return self._verzamel("/cycle", start, eind, maximum)

    def herstel(self, start=None, eind=None, maximum=None):
        return self._verzamel("/recovery", start, eind, maximum)

    def slaap(self, start=None, eind=None, maximum=None):
        return self._verzamel("/activity/sleep", start, eind, maximum)

    def trainingen(self, start=None, eind=None, maximum=None):
        return self._verzamel("/activity/workout", start, eind, maximum)
