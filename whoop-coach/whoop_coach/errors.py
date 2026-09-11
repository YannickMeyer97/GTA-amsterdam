"""Foutsoorten van de adviseur.

Alles wat misgaat krijgt een eigen type met een Nederlandse boodschap, zodat
de CLI nooit met een kale traceback stopt maar met uitleg en een suggestie.
"""


class WhoopCoachError(Exception):
    """Basisklasse: elke fout die we zelf herkennen en netjes kunnen melden."""

    #: Exit-code waarmee de CLI afsluit bij deze fout.
    exit_code = 1

    def __init__(self, boodschap, suggestie=None):
        super().__init__(boodschap)
        self.boodschap = boodschap
        self.suggestie = suggestie

    def __str__(self):
        return self.boodschap


class ConfiguratieFout(WhoopCoachError):
    """Ontbrekende of onbruikbare configuratie (client id/secret, rules.json)."""

    exit_code = 2


class AuthenticatieFout(WhoopCoachError):
    """Niet gekoppeld, of de koppeling is niet meer te herstellen."""

    exit_code = 3


class TokenVerlopenFout(AuthenticatieFout):
    """Access token verlopen en verversen lukte niet: opnieuw koppelen nodig."""


class NetwerkFout(WhoopCoachError):
    """Geen internet, DNS-fout, of WHOOP is onbereikbaar."""

    exit_code = 4


class ApiFout(WhoopCoachError):
    """WHOOP antwoordde met een foutstatus."""

    exit_code = 5

    def __init__(self, boodschap, status=None, body=None, suggestie=None):
        super().__init__(boodschap, suggestie=suggestie)
        self.status = status
        self.body = body


class RateLimitFout(ApiFout):
    """Te veel verzoeken; de limiet van WHOOP is geraakt."""


class DataOntbreektFout(WhoopCoachError):
    """Er is te weinig data om uberhaupt een advies op te baseren."""

    exit_code = 6
