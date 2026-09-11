"""De adviesmotor: van cijfers naar "vandaag: dit doen".

De opbouw is bewust simpel te volgen:

1. **Basisniveau** uit je herstelscore. Groen geeft ruimte voor zwaar, geel
   voor gematigd, rood voor rustig of rust.
2. **Plafonds.** Elke waarschuwing (slechte slaap, verlaagde HRV, verhoogde
   rusthartslag, veel belasting de afgelopen dagen, gisteren al zwaar) legt
   een maximum op. Het laagste plafond wint.
3. **Invulling.** Bij het gekozen niveau hoort een concrete sessie, met een
   duwtje richting hardlopen als je dat weinig hebt gedaan.

Elke stap noteert waarom hij iets doet, zodat het advies onderbouwd is en je
kunt zien welke regel je moet aanpassen als je het er niet mee eens bent.
Alle drempelwaarden staan in ``rules.json``.
"""

NIVEAU_RUST = 0
NIVEAU_RUSTIG = 1
NIVEAU_MATIG = 2
NIVEAU_ZWAAR = 3

NIVEAU_NAAM = {
    NIVEAU_RUST: "RUST",
    NIVEAU_RUSTIG: "RUSTIG",
    NIVEAU_MATIG: "GEMATIGD",
    NIVEAU_ZWAAR: "ZWAAR",
}

NIVEAU_KOP = {
    NIVEAU_RUST: "Rust",
    NIVEAU_RUSTIG: "Actief herstel",
    NIVEAU_MATIG: "Gematigd trainen",
    NIVEAU_ZWAAR: "Ruimte voor een zware sessie",
}


class Reden(object):
    """Een regel die is afgegaan, met zijn effect op het niveau."""

    def __init__(self, soort, tekst, plafond=None):
        #: ``basis``, ``rem`` (verlaagt), ``ruimte`` (bevestigt) of ``let_op``.
        self.soort = soort
        self.tekst = tekst
        self.plafond = plafond

    def als_dict(self):
        return {"soort": self.soort, "tekst": self.tekst, "plafond": self.plafond}

    def __repr__(self):
        return "<Reden {} {!r}>".format(self.soort, self.tekst)


class Advies(object):
    """Het eindresultaat: niveau, kop, sessie en onderbouwing."""

    def __init__(self, niveau, redenen, sessie, alternatief, waarschuwingen,
                 analyse):
        self.niveau = niveau
        self.naam = NIVEAU_NAAM[niveau]
        self.kop = NIVEAU_KOP[niveau]
        self.redenen = redenen
        self.sessie = sessie
        self.alternatief = alternatief
        self.waarschuwingen = waarschuwingen
        self.analyse = analyse

    def als_dict(self):
        analyse = self.analyse
        return {
            "datum": analyse.vandaag.isoformat(),
            "niveau": self.naam,
            "niveau_nummer": self.niveau,
            "kop": self.kop,
            "sessie": self.sessie,
            "alternatief": self.alternatief,
            "redenen": [r.als_dict() for r in self.redenen],
            "waarschuwingen": list(self.waarschuwingen),
            "vertrouwen": analyse.vertrouwen(),
            "meetwaarden": {
                "herstelscore": analyse.herstelscore,
                "herstelkleur": analyse.herstelkleur,
                "herstel_datum": (analyse.herstel_datum.isoformat()
                                  if analyse.herstel_datum else None),
                "hrv": analyse.hrv,
                "hrv_basislijn": analyse.hrv_basislijn,
                "hrv_verhouding": _rond(analyse.hrv_verhouding, 2),
                "rusthartslag": analyse.rusthartslag,
                "rusthartslag_basislijn": analyse.rusthartslag_basislijn,
                "rusthartslag_verschil": _rond(analyse.rusthartslag_verschil, 1),
                "slaapprestatie": analyse.slaapprestatie,
                "slaapuren": _rond(analyse.slaapuren, 2),
                "slaaptekort_uren": _rond(analyse.slaaptekort_uren, 2),
                "strain_gisteren": _rond(analyse.strain_gisteren, 1),
                "strain_3d_som": _rond(analyse.strain_3d_som, 1),
                "strain_7d_gemiddeld": _rond(analyse.strain_7d_gemiddeld, 1),
                "strain_28d_gemiddeld": _rond(analyse.strain_28d_gemiddeld, 1),
                "acuut_chronisch": _rond(analyse.acuut_chronisch, 2),
                "dagen_sinds_zware_sessie": analyse.dagen_sinds_zwaar,
                "kracht_7d": len(analyse.kracht_7d),
                "kracht_14d": len(analyse.kracht_14d),
                "hardlopen_7d": len(analyse.hardlopen_7d),
                "hardlopen_14d": len(analyse.hardlopen_14d),
                "max_hartslag": analyse.max_hartslag,
                "max_hartslag_is_geschat": analyse.max_hartslag_is_geschat,
            },
        }


def _rond(waarde, cijfers=1):
    return round(waarde, cijfers) if isinstance(waarde, (int, float)) else None


def bepaal_advies(analyse):
    """Pas alle regels toe en geef het advies."""
    regels = analyse.regels
    redenen = []
    waarschuwingen = list(analyse.waarschuwingen)

    niveau, basisreden = _basisniveau(analyse, regels)
    redenen.append(basisreden)

    plafonds = []
    for maker in (_rem_slaap, _rem_hrv, _rem_rusthartslag, _rem_belasting,
                  _rem_datakwaliteit):
        for reden in maker(analyse, regels):
            redenen.append(reden)
            if reden.plafond is not None:
                plafonds.append(reden.plafond)

    if plafonds:
        niveau = min(niveau, min(plafonds))

    redenen.extend(_ruimte_opmerkingen(analyse, regels, niveau))

    sessie, alternatief, keuze_redenen = _vul_sessie_in(analyse, regels, niveau)
    redenen.extend(keuze_redenen)
    waarschuwingen.extend(_waarschuwingen(analyse))

    return Advies(niveau, redenen, sessie, alternatief, waarschuwingen, analyse)


# --- stap 1: basisniveau uit het herstel ------------------------------------

def _basisniveau(analyse, regels):
    grenzen = regels["herstel"]
    score = analyse.herstelscore

    if score is None:
        return NIVEAU_MATIG, Reden(
            "let_op",
            "Geen herstelscore beschikbaar, dus we gaan uit van gematigd: "
            "zonder meting nemen we geen risico met een zware sessie.",
            NIVEAU_MATIG,
        )

    ouderdom = analyse.herstel_ouderdom_dagen or 0
    achtervoegsel = ""
    if ouderdom >= 1:
        achtervoegsel = " (van {} dag{} geleden)".format(
            ouderdom, "" if ouderdom == 1 else "en")

    if score >= grenzen["groen_vanaf"]:
        return NIVEAU_ZWAAR, Reden(
            "basis",
            "Herstel {:.0f}% is groen{}: je lichaam staat open voor "
            "belasting.".format(score, achtervoegsel),
        )
    if score >= grenzen["geel_vanaf"]:
        return NIVEAU_MATIG, Reden(
            "basis",
            "Herstel {:.0f}% is geel{}: trainen kan, maar niet op je "
            "maximum.".format(score, achtervoegsel),
        )
    if score >= grenzen["diep_rood_tot"]:
        return NIVEAU_RUSTIG, Reden(
            "basis",
            "Herstel {:.0f}% is rood{}: vandaag herstellen, niet "
            "presteren.".format(score, achtervoegsel),
        )
    return NIVEAU_RUST, Reden(
        "basis",
        "Herstel {:.0f}% is diep rood{}: je lichaam vraagt om rust.".format(
            score, achtervoegsel),
    )


# --- stap 2: de remmen ------------------------------------------------------

def _rem_slaap(analyse, regels):
    grenzen = regels["slaap"]
    uit = []
    prestatie = analyse.slaapprestatie

    if prestatie is None:
        uit.append(Reden(
            "let_op",
            "Geen slaapdata van afgelopen nacht gevonden; slaap telt daarom "
            "niet mee in dit advies.",
        ))
    else:
        ouderdom = analyse.slaap_ouderdom_dagen or 0
        if ouderdom >= 2:
            uit.append(Reden(
                "let_op",
                "De laatste slaapmeting is van {} dagen geleden; behandel de "
                "slaapcijfers met voorzichtigheid.".format(ouderdom),
            ))
        if prestatie < grenzen["slecht_tot"]:
            uit.append(Reden(
                "rem",
                "Slaapprestatie {:.0f}% is laag: te weinig geslapen om zwaar "
                "te belasten.".format(prestatie),
                NIVEAU_RUSTIG,
            ))
        elif prestatie < grenzen["matig_tot"]:
            uit.append(Reden(
                "rem",
                "Slaapprestatie {:.0f}% is matig: houd de intensiteit "
                "beheerst.".format(prestatie),
                NIVEAU_MATIG,
            ))

    tekort = analyse.slaaptekort_uren
    if tekort is not None and tekort >= grenzen["tekort_uren_alarm"]:
        uit.append(Reden(
            "rem",
            "Je kwam {:.1f} uur tekort op je slaapbehoefte.".format(tekort),
            NIVEAU_MATIG,
        ))
    return uit


def _rem_hrv(analyse, regels):
    grenzen = regels["hrv"]
    verhouding = analyse.hrv_verhouding
    if verhouding is None:
        return []
    if verhouding < grenzen["sterk_verlaagd_onder_ratio"]:
        return [Reden(
            "rem",
            "HRV {:.0f} ms ligt {:.0f}% onder je basislijn van {:.0f} ms: "
            "een duidelijk teken van belasting.".format(
                analyse.hrv, (1 - verhouding) * 100, analyse.hrv_basislijn),
            NIVEAU_RUSTIG,
        )]
    if verhouding < grenzen["verlaagd_onder_ratio"]:
        return [Reden(
            "rem",
            "HRV {:.0f} ms ligt onder je basislijn van {:.0f} ms.".format(
                analyse.hrv, analyse.hrv_basislijn),
            NIVEAU_MATIG,
        )]
    return []


def _rem_rusthartslag(analyse, regels):
    grenzen = regels["rusthartslag"]
    verschil = analyse.rusthartslag_verschil
    if verschil is None:
        return []
    if verschil >= grenzen["sterk_verhoogd_vanaf_bpm"]:
        return [Reden(
            "rem",
            "Rusthartslag {:.0f} ligt {:.0f} slagen boven je basislijn: dat "
            "wijst op onvoldoende herstel of iets onder de leden.".format(
                analyse.rusthartslag, verschil),
            NIVEAU_RUSTIG,
        )]
    if verschil >= grenzen["verhoogd_vanaf_bpm"]:
        return [Reden(
            "rem",
            "Rusthartslag {:.0f} ligt {:.0f} slagen boven je basislijn.".format(
                analyse.rusthartslag, verschil),
            NIVEAU_MATIG,
        )]
    return []


def _rem_belasting(analyse, regels):
    """De belastingsregels: niet twee zware dagen op elkaar stapelen."""
    grenzen = regels["belasting"]
    uit = []

    # Tussen twee zware sessies hoort minstens een rustige dag te zitten.
    minimum_tussen = int(grenzen["min_dagen_tussen_zware_sessies"])
    if (analyse.dagen_sinds_zwaar is not None
            and analyse.dagen_sinds_zwaar <= minimum_tussen):
        wanneer = ("gisteren" if analyse.dagen_sinds_zwaar == 1
                   else "{} dagen geleden".format(analyse.dagen_sinds_zwaar))
        uit.append(Reden(
            "rem",
            "Je trainde {} al zwaar; twee zware sessies zo kort na elkaar "
            "leveren meer vermoeidheid op dan vooruitgang.".format(wanneer),
            NIVEAU_MATIG,
        ))

    # Stapelen meerdere zware dagen zich op, dan moet de reeks echt gebroken.
    op_rij = analyse.zware_dagen_op_rij
    if op_rij >= int(grenzen["zware_dagen_op_rij_rustig"]):
        uit.append(Reden(
            "rem",
            "Je hebt {} zware dagen op rij achter de rug: tijd om de "
            "belasting echt te breken.".format(op_rij),
            NIVEAU_RUSTIG,
        ))
    elif op_rij >= int(grenzen["zware_dagen_op_rij_matig"]):
        uit.append(Reden(
            "rem",
            "Je hebt {} zware dagen op rij achter de rug.".format(op_rij),
            NIVEAU_MATIG,
        ))

    if (analyse.strain_7d_gemiddeld is not None
            and analyse.strain_7d_gemiddeld >= grenzen["week_gemiddelde_hoog_vanaf"]):
        uit.append(Reden(
            "rem",
            "Je weekgemiddelde strain is {:.1f}: de afgelopen week was al "
            "stevig.".format(analyse.strain_7d_gemiddeld),
            NIVEAU_MATIG,
        ))

    if (analyse.strain_3d_som is not None
            and analyse.strain_3d_som >= grenzen["drie_daagse_som_hoog_vanaf"]):
        uit.append(Reden(
            "rem",
            "De laatste drie dagen tellen op tot strain {:.1f}.".format(
                analyse.strain_3d_som),
            NIVEAU_MATIG,
        ))

    if (analyse.acuut_chronisch is not None
            and analyse.acuut_chronisch >= grenzen["acuut_chronisch_hoog_vanaf"]):
        uit.append(Reden(
            "rem",
            "Je week ligt {:.0f}% boven je maandgemiddelde: je bouwt sneller "
            "op dan je lichaam gewend is.".format(
                (analyse.acuut_chronisch - 1) * 100),
            NIVEAU_MATIG,
        ))

    return uit


def _rem_datakwaliteit(analyse, regels):
    uit = []
    if analyse.kalibreert:
        uit.append(Reden(
            "let_op",
            "WHOOP kalibreert je basislijn nog; de herstelscore is voorlopig "
            "minder betrouwbaar.",
            NIVEAU_MATIG,
        ))
    if analyse.herstel_ouderdom_dagen is not None and analyse.herstel_ouderdom_dagen >= 2:
        uit.append(Reden(
            "let_op",
            "Je laatste herstelscore is {} dagen oud; waarschijnlijk heb je "
            "je WHOOP niet gedragen.".format(analyse.herstel_ouderdom_dagen),
            NIVEAU_MATIG,
        ))
    return uit


# --- stap 3: bevestigende opmerkingen ---------------------------------------

def _ruimte_opmerkingen(analyse, regels, niveau):
    grenzen = regels["belasting"]
    uit = []
    if niveau < NIVEAU_ZWAAR:
        return uit

    if (analyse.acuut_chronisch is not None
            and analyse.acuut_chronisch <= grenzen["acuut_chronisch_laag_tot"]):
        uit.append(Reden(
            "ruimte",
            "Je week ligt onder je maandgemiddelde: er is ruimte om er weer "
            "een schep bovenop te doen.",
        ))
    elif analyse.strain_7d_gemiddeld is not None:
        uit.append(Reden(
            "ruimte",
            "Weekgemiddelde strain {:.1f} is behapbaar naast dit "
            "herstel.".format(analyse.strain_7d_gemiddeld),
        ))
    if analyse.dagen_sinds_zwaar is not None and analyse.dagen_sinds_zwaar >= 3:
        uit.append(Reden(
            "ruimte",
            "Je laatste zware sessie was {} dagen geleden.".format(
                analyse.dagen_sinds_zwaar),
        ))
    return uit


# --- stap 4: de sessie zelf -------------------------------------------------

def _zone_tekst(analyse, nummer):
    bereik = analyse.zone(nummer)
    if not bereik:
        return "zone {}".format(nummer)
    achtervoegsel = " (schatting)" if analyse.max_hartslag_is_geschat else ""
    return "zone {} ({}-{} slagen{})".format(nummer, bereik[0], bereik[1], achtervoegsel)


def _kies_modaliteit(analyse, regels):
    """Kracht of hardlopen? Hardlopen krijgt een duwtje als je het laat liggen.

    Geeft (keuze, reden-of-None) terug.
    """
    balans = regels["balans"]
    hardlopen_recent = len(analyse.hardlopen_14d)
    kracht_recent = len(analyse.kracht_7d)

    if hardlopen_recent < int(balans["hardlopen_duwtje_onder"]):
        toelichting = (
            "je liep de afgelopen 14 dagen {} keer hard".format(hardlopen_recent)
            if hardlopen_recent else
            "je hebt de afgelopen 14 dagen niet hardgelopen")
        return "hardlopen", Reden(
            "ruimte",
            "Duwtje richting hardlopen: {}, en voor je algemene conditie is "
            "dat de grootste winst.".format(toelichting),
        )

    if kracht_recent >= int(balans["kracht_doel_per_7_dagen"]):
        return "hardlopen", Reden(
            "ruimte",
            "Je deed deze week al {} krachtsessies; afwisselen met hardlopen "
            "spreidt de belasting.".format(kracht_recent),
        )

    return "kracht", None


def _vul_sessie_in(analyse, regels, niveau):
    """Maak van het niveau een concrete sessie plus een alternatief."""
    if niveau == NIVEAU_RUST:
        return (
            "Niet trainen. Wandelen, licht rekken en vroeg naar bed. Een "
            "gemiste dag kost je niets; doortrainen op dit herstel wel.",
            "Heb je bewegingsdrang: maximaal 20-30 minuten rustig wandelen, "
            "zonder de hartslag op te jagen.",
            [],
        )

    if niveau == NIVEAU_RUSTIG:
        return (
            "Actief herstel. 30-45 minuten wandelen of heel rustig fietsen, "
            "onder {}. Eventueel 15 minuten mobiliteit of techniek met een "
            "lege stang.".format(_zone_tekst(analyse, 2)),
            "Voelt het halverwege slechter, stop dan. Dit is herstel, geen "
            "training.",
            [],
        )

    keuze, duwtje = _kies_modaliteit(analyse, regels)
    keuze_redenen = [duwtje] if duwtje is not None else []

    if niveau == NIVEAU_MATIG:
        if keuze == "hardlopen":
            hoofd = (
                "Rustige duurloop van 30-45 minuten, volledig in {}. Kun je "
                "er niet bij praten, dan loop je te hard.".format(
                    _zone_tekst(analyse, 2))
            )
            alt = (
                "Liever kracht: submaximaal, 3-4 oefeningen van 3 sets, 8-12 "
                "herhalingen op RPE 6-7. Stop 2-3 herhalingen voor falen."
            )
        else:
            hoofd = (
                "Submaximale krachttraining. 4-5 oefeningen, 3 sets van 8-12 "
                "herhalingen op RPE 6-7 (2-3 herhalingen in reserve). Geen "
                "maximale sets, geen sets tot falen."
            )
            alt = (
                "Liever hardlopen: 30-40 minuten in {}, niet harder.".format(
                    _zone_tekst(analyse, 2))
            )
        return hoofd, alt, keuze_redenen

    # NIVEAU_ZWAAR
    if keuze == "hardlopen":
        hoofd = (
            "Intensieve duurloop. 10 minuten inlopen, dan 5-6 x 3 minuten in "
            "{} met 2 minuten dribbelen ertussen, 10 minuten uitlopen. "
            "Samen ongeveer 45-55 minuten.".format(_zone_tekst(analyse, 4))
        )
        alt = (
            "Liever kracht: zware basisoefeningen, 4-5 sets van 3-6 "
            "herhalingen op RPE 8-9."
        )
    else:
        hoofd = (
            "Zware krachttraining. 2-3 basisoefeningen (squat, deadlift of "
            "bankdrukken) met 4-5 sets van 3-6 herhalingen op RPE 8-9, daarna "
            "2 assistentie-oefeningen van 3 x 8-10."
        )
        alt = (
            "Liever hardlopen: intervallen in {}, bijvoorbeeld 5 x 3 minuten "
            "met 2 minuten herstel.".format(_zone_tekst(analyse, 4))
        )

    return hoofd, alt, keuze_redenen


# --- losse waarschuwingen ---------------------------------------------------

def _waarschuwingen(analyse):
    uit = []
    if analyse.max_hartslag_is_geschat:
        uit.append(
            "Je maximale hartslag is niet uit WHOOP gekomen; de zones zijn "
            "gebaseerd op een schatting van {} slagen. Vul je eigen waarde in "
            "rules.json onder hartslagzones.standaard_max_hartslag.".format(
                analyse.regels["hartslagzones"]["standaard_max_hartslag"])
        )
    onbekend = analyse.sportindeling.onbekende_labels()
    if onbekend:
        uit.append(
            "Deze sporten kon ik niet indelen als kracht of hardlopen: {}. "
            "Draai 'sporten' om ze zelf vast te leggen.".format(
                ", ".join(onbekend))
        )
    if not analyse.trainingen:
        uit.append(
            "Er staan geen trainingen in de opgehaalde periode, dus de "
            "verdeling tussen kracht en hardlopen kon ik niet wegen."
        )
    return uit
