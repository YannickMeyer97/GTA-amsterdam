"""De uitvoer in de terminal.

Kleur via ANSI, maar alleen als de uitvoer echt naar een terminal gaat; in een
pipe of logbestand blijft het gewone tekst.
"""

import os
import sys

from .advies import NIVEAU_MATIG, NIVEAU_RUST, NIVEAU_RUSTIG, NIVEAU_ZWAAR

BREEDTE = 66

_KLEUREN = {
    "reset": "\033[0m",
    "vet": "\033[1m",
    "dof": "\033[2m",
    "rood": "\033[31m",
    "groen": "\033[32m",
    "geel": "\033[33m",
    "blauw": "\033[34m",
    "cyaan": "\033[36m",
}

NIVEAU_KLEUR = {
    NIVEAU_RUST: "rood",
    NIVEAU_RUSTIG: "rood",
    NIVEAU_MATIG: "geel",
    NIVEAU_ZWAAR: "groen",
}

HERSTEL_KLEUR = {"groen": "groen", "geel": "geel", "rood": "rood"}

REDEN_TEKEN = {
    "basis": "*",
    "rem": "v",
    "ruimte": "^",
    "let_op": "!",
}


def kleuren_aan(stroom=None):
    stroom = stroom or sys.stdout
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("WHOOP_COACH_KLEUR") == "0":
        return False
    return bool(getattr(stroom, "isatty", lambda: False)())


class Schrijver(object):
    """Schrijft regels, met of zonder kleur."""

    def __init__(self, stroom=None, kleur=None):
        self.stroom = stroom or sys.stdout
        self.kleur = kleuren_aan(self.stroom) if kleur is None else kleur

    def verf(self, tekst, *stijlen):
        if not self.kleur or not stijlen:
            return tekst
        voor = "".join(_KLEUREN.get(s, "") for s in stijlen)
        return voor + tekst + _KLEUREN["reset"]

    def regel(self, tekst="", *stijlen):
        self.stroom.write(self.verf(tekst, *stijlen) + "\n")

    def streep(self, teken="-"):
        self.regel(self.verf(teken * BREEDTE, "dof"))


def _omwikkel(tekst, breedte=BREEDTE, inspring=""):
    """Breek tekst af op woordgrenzen; bestaande regeleinden blijven staan."""
    uit = []
    for alinea in str(tekst).split("\n"):
        woorden = alinea.split()
        if not woorden:
            uit.append("")
            continue
        huidig = inspring
        for woord in woorden:
            kandidaat = (huidig + " " + woord) if huidig.strip() else (inspring + woord)
            if len(kandidaat) > breedte and huidig.strip():
                uit.append(huidig)
                huidig = inspring + woord
            else:
                huidig = kandidaat
        uit.append(huidig)
    return uit


def _waarde(waarde, formaat="{:.0f}", leeg="-"):
    if waarde is None:
        return leeg
    try:
        return formaat.format(waarde)
    except (TypeError, ValueError):
        return str(waarde)


def toon_advies(advies, schrijver=None, naam=None, regels_pad=None):
    """Print het volledige dagrapport."""
    uit = schrijver or Schrijver()
    analyse = advies.analyse

    uit.regel()
    kop = "WHOOP TRAININGSADVIES  {}".format(analyse.vandaag.strftime("%a %d %b %Y"))
    if naam:
        kop = "WHOOP TRAININGSADVIES VOOR {}  {}".format(
            naam.upper(), analyse.vandaag.strftime("%d %b %Y"))
    uit.regel(kop, "vet")
    uit.streep("=")

    # -- meetwaarden ---------------------------------------------------------
    herstelkleur = HERSTEL_KLEUR.get(analyse.herstelkleur, "dof")
    uit.regel("{}  {}   {}".format(
        uit.verf("Herstel", "dof").ljust(20),
        uit.verf(_waarde(analyse.herstelscore, "{:.0f}%").ljust(8), herstelkleur, "vet"),
        uit.verf(_herstel_bijschrift(analyse), "dof"),
    ))
    uit.regel("{}  {}   {}".format(
        uit.verf("Slaap", "dof").ljust(20),
        _waarde(analyse.slaapprestatie, "{:.0f}%").ljust(8),
        uit.verf(_slaap_bijschrift(analyse), "dof"),
    ))
    uit.regel("{}  {}   {}".format(
        uit.verf("HRV", "dof").ljust(20),
        _waarde(analyse.hrv, "{:.0f} ms").ljust(8),
        uit.verf(_hrv_bijschrift(analyse), "dof"),
    ))
    uit.regel("{}  {}   {}".format(
        uit.verf("Rusthartslag", "dof").ljust(20),
        _waarde(analyse.rusthartslag, "{:.0f}").ljust(8),
        uit.verf(_rhr_bijschrift(analyse), "dof"),
    ))
    uit.regel("{}  {}   {}".format(
        uit.verf("Strain week", "dof").ljust(20),
        _waarde(analyse.strain_7d_gemiddeld, "{:.1f}").ljust(8),
        uit.verf(_strain_bijschrift(analyse), "dof"),
    ))
    uit.regel("{}  {}   {}".format(
        uit.verf("Laatste 14 dagen", "dof").ljust(20),
        "".ljust(8),
        uit.verf("{}x kracht, {}x hardlopen".format(
            len(analyse.kracht_14d), len(analyse.hardlopen_14d)), "dof"),
    ))

    # -- het advies ----------------------------------------------------------
    uit.regel()
    uit.streep("=")
    niveaukleur = NIVEAU_KLEUR.get(advies.niveau, "cyaan")
    uit.regel("VANDAAG: {}".format(advies.kop.upper()), "vet", niveaukleur)
    uit.streep("=")
    uit.regel()
    for regel in _omwikkel(advies.sessie):
        uit.regel(regel)
    if advies.alternatief:
        uit.regel()
        for regel in _omwikkel(advies.alternatief, inspring=""):
            uit.regel(uit.verf(regel, "dof"))

    # -- onderbouwing --------------------------------------------------------
    uit.regel()
    uit.regel("Waarom:", "vet")
    for reden in advies.redenen:
        teken = REDEN_TEKEN.get(reden.soort, "-")
        kleur = {"rem": "geel", "ruimte": "groen", "let_op": "cyaan"}.get(reden.soort)
        stijlen = (kleur,) if kleur else ()
        regels = _omwikkel(reden.tekst, BREEDTE - 4, "")
        for nummer, regel in enumerate(regels):
            voorvoegsel = "  {} ".format(uit.verf(teken, *stijlen)) if nummer == 0 else "    "
            uit.regel(voorvoegsel + regel)

    # -- waarschuwingen ------------------------------------------------------
    if advies.waarschuwingen:
        uit.regel()
        uit.regel("Let op:", "vet", "geel")
        for waarschuwing in advies.waarschuwingen:
            for nummer, regel in enumerate(_omwikkel(waarschuwing, BREEDTE - 4)):
                uit.regel(("  - " if nummer == 0 else "    ") + regel)

    vertrouwen = analyse.vertrouwen()
    uit.regel()
    uit.regel(uit.verf("Vertrouwen in dit advies: {}.".format(vertrouwen), "dof"))
    if regels_pad:
        uit.regel(uit.verf("Regels aanpassen: {}".format(regels_pad), "dof"))
    uit.regel()


def _herstel_bijschrift(analyse):
    if analyse.herstelscore is None:
        return "geen meting gevonden"
    delen = [analyse.herstelkleur or ""]
    if analyse.herstel_ouderdom_dagen:
        delen.append("{} dag(en) oud".format(analyse.herstel_ouderdom_dagen))
    if analyse.kalibreert:
        delen.append("WHOOP kalibreert nog")
    return ", ".join(d for d in delen if d)


def _slaap_bijschrift(analyse):
    if analyse.slaapprestatie is None:
        return "geen slaapdata"
    delen = []
    if analyse.slaapuren is not None:
        delen.append("{:.1f} u geslapen".format(analyse.slaapuren))
    if analyse.slaaptekort_uren:
        delen.append("{:.1f} u tekort".format(analyse.slaaptekort_uren))
    return ", ".join(delen) or "gemeten"


def _hrv_bijschrift(analyse):
    if analyse.hrv is None:
        return "geen meting"
    if analyse.hrv_basislijn is None:
        return "nog geen basislijn"
    verschil = (analyse.hrv_verhouding - 1) * 100
    if abs(verschil) < 0.5:
        return "gelijk aan basislijn ({:.0f} ms)".format(analyse.hrv_basislijn)
    richting = "boven" if verschil > 0 else "onder"
    return "{:.0f}% {} basislijn ({:.0f} ms)".format(
        abs(verschil), richting, analyse.hrv_basislijn)


def _rhr_bijschrift(analyse):
    if analyse.rusthartslag is None:
        return "geen meting"
    if analyse.rusthartslag_verschil is None:
        return "nog geen basislijn"
    if abs(analyse.rusthartslag_verschil) < 0.5:
        return "gelijk aan basislijn ({:.0f})".format(
            analyse.rusthartslag_basislijn)
    teken = "+" if analyse.rusthartslag_verschil > 0 else ""
    return "{}{:.0f} t.o.v. basislijn ({:.0f})".format(
        teken, analyse.rusthartslag_verschil, analyse.rusthartslag_basislijn)


def _strain_bijschrift(analyse):
    delen = []
    if analyse.strain_gisteren is not None:
        delen.append("gisteren {:.1f}".format(analyse.strain_gisteren))
    if analyse.acuut_chronisch is not None:
        delen.append("week/maand {:.2f}".format(analyse.acuut_chronisch))
    return ", ".join(delen) or "te weinig historie"


def toon_sporten(statistieken, indeling, schrijver=None, pad=None):
    """Print wat we in je historie aan sporten hebben gevonden."""
    uit = schrijver or Schrijver()
    uit.regel()
    uit.regel("SPORTEN IN JOUW WHOOP-HISTORIE", "vet")
    uit.streep("=")
    if not statistieken:
        uit.regel("Geen trainingen gevonden in de opgehaalde periode.")
        uit.regel()
        return

    uit.regel("{}  {}  {}  {}  {}".format(
        uit.verf("sport".ljust(22), "dof"),
        uit.verf("n".rjust(3), "dof"),
        uit.verf("duur".rjust(7), "dof"),
        uit.verf("afstand".rjust(8), "dof"),
        uit.verf("indeling", "dof"),
    ))
    for stat in statistieken:
        label = stat["label"]
        soort = indeling.soort(label)
        herkomst = indeling.herkomst.get(label.lower().replace(" ", "_"), "")
        kleur = {"kracht": "blauw", "hardlopen": "cyaan",
                 "onbekend": "geel"}.get(soort)
        stijlen = (kleur,) if kleur else ("dof",)
        uit.regel("{}  {}  {}  {}  {}".format(
            label[:22].ljust(22),
            str(stat["aantal"]).rjust(3),
            _waarde(stat.get("gemiddelde_duur_minuten"), "{:.0f} min").rjust(7),
            _waarde(stat.get("gemiddelde_afstand_km"), "{:.1f} km").rjust(8),
            uit.verf("{} ({})".format(soort, herkomst), *stijlen),
        ))

    onbekend = indeling.onbekende_labels()
    uit.regel()
    if onbekend:
        uit.regel("Nog niet in te delen: {}".format(", ".join(onbekend)), "geel")
    if pad:
        uit.regel(uit.verf(
            "Aanpassen kan in {} (jouw keuze wint altijd).".format(pad), "dof"))
    uit.regel()
