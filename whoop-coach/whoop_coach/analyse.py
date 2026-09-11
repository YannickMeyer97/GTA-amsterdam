"""Van losse records naar de cijfers waar het advies op steunt.

Alles wat hier uitkomt is een getal of ``None``. ``None`` betekent echt
"dit weten we niet" en wordt nergens stilzwijgend als nul behandeld: geen
WHOOP gedragen is iets anders dan een strain van 0.
"""

import datetime as dt


def _mediaan(waarden):
    schoon = sorted(w for w in waarden if w is not None)
    if not schoon:
        return None
    midden = len(schoon) // 2
    if len(schoon) % 2:
        return schoon[midden]
    return (schoon[midden - 1] + schoon[midden]) / 2.0


def _gemiddelde(waarden):
    schoon = [w for w in waarden if w is not None]
    if not schoon:
        return None
    return sum(schoon) / len(schoon)


class Analyse(object):
    """De samengevatte toestand van vandaag, met de historie eromheen."""

    def __init__(self, vandaag, cycli, herstel, slaap, trainingen,
                 sportindeling, regels, max_hartslag=None):
        self.vandaag = vandaag
        self.regels = regels
        self.sportindeling = sportindeling
        self.max_hartslag = max_hartslag

        self.cycli = cycli
        self.herstel = herstel
        self.slaap = slaap
        self.trainingen = trainingen

        self.waarschuwingen = []

        self._bereken_herstel()
        self._bereken_slaap()
        self._bereken_belasting()
        self._bereken_trainingsmix()

    # -- herstel, HRV en rusthartslag ---------------------------------------

    def _bereken_herstel(self):
        gescoord = [h for h in self.herstel if h.score is not None]
        self.laatste_herstel = gescoord[-1] if gescoord else None

        self.herstelscore = None
        self.herstelkleur = None
        self.herstel_datum = None
        self.herstel_ouderdom_dagen = None
        self.kalibreert = False

        if self.laatste_herstel is not None:
            self.herstelscore = self.laatste_herstel.score
            self.herstelkleur = self.laatste_herstel.kleur
            self.herstel_datum = self.laatste_herstel.datum
            self.herstel_ouderdom_dagen = (self.vandaag - self.herstel_datum).days
            self.kalibreert = self.laatste_herstel.kalibreert

        # Basislijnen berekenen we zonder de meting van vandaag, anders
        # vergelijk je de dag met zichzelf.
        dagen = int(self.regels["hrv"]["basislijn_dagen"])
        eerdere = [h for h in gescoord if h is not self.laatste_herstel][-dagen:]

        self.hrv = self.laatste_herstel.hrv if self.laatste_herstel else None
        self.hrv_basislijn = _mediaan([h.hrv for h in eerdere])
        self.hrv_verhouding = None
        if self.hrv and self.hrv_basislijn:
            self.hrv_verhouding = self.hrv / self.hrv_basislijn

        rhr_dagen = int(self.regels["rusthartslag"]["basislijn_dagen"])
        eerdere_rhr = [h for h in gescoord if h is not self.laatste_herstel][-rhr_dagen:]
        self.rusthartslag = self.laatste_herstel.rusthartslag if self.laatste_herstel else None
        self.rusthartslag_basislijn = _mediaan([h.rusthartslag for h in eerdere_rhr])
        self.rusthartslag_verschil = None
        if self.rusthartslag and self.rusthartslag_basislijn:
            self.rusthartslag_verschil = self.rusthartslag - self.rusthartslag_basislijn

        self.herstel_reeks = [(h.datum, h.score) for h in gescoord][-14:]

    # -- slaap ---------------------------------------------------------------

    def _bereken_slaap(self):
        nachten = [s for s in self.slaap if not s.dutje and s.prestatie is not None]
        self.laatste_slaap = nachten[-1] if nachten else None

        self.slaapprestatie = None
        self.slaapuren = None
        self.slaaptekort_uren = None
        self.slaap_datum = None
        self.slaap_ouderdom_dagen = None

        if self.laatste_slaap is not None:
            self.slaapprestatie = self.laatste_slaap.prestatie
            self.slaapuren = self.laatste_slaap.uren
            self.slaaptekort_uren = self.laatste_slaap.tekort_uren
            self.slaap_datum = self.laatste_slaap.datum
            self.slaap_ouderdom_dagen = (self.vandaag - self.slaap_datum).days

        self.slaapprestatie_week = _gemiddelde([s.prestatie for s in nachten[-7:]])

    # -- trainingsbelasting --------------------------------------------------

    def _bereken_belasting(self):
        # Cycli met een strain, op datum, zonder de cyclus van vandaag: die
        # loopt nog en telt dus een halve dag mee.
        per_dag = {}
        for cyclus in self.cycli:
            if cyclus.strain is not None and cyclus.datum is not None:
                per_dag[cyclus.datum] = cyclus.strain
        self.strain_per_dag = per_dag

        self.strain_vandaag = per_dag.get(self.vandaag)
        self.strain_gisteren = per_dag.get(self.vandaag - dt.timedelta(days=1))

        afgesloten = {d: s for d, s in per_dag.items() if d < self.vandaag}

        def venster(dagen):
            grens = self.vandaag - dt.timedelta(days=dagen)
            return [s for d, s in afgesloten.items() if grens <= d < self.vandaag]

        self.strain_3d = venster(3)
        self.strain_7d = venster(7)
        self.strain_28d = venster(int(self.regels["venster"]["analyse_dagen"]))

        self.strain_3d_som = sum(self.strain_3d) if self.strain_3d else None
        self.strain_7d_gemiddeld = _gemiddelde(self.strain_7d)
        self.strain_28d_gemiddeld = _gemiddelde(self.strain_28d)

        # Acuut-chronisch: de week tegenover de maand. Boven de 1,3 bouw je
        # sneller op dan je lichaam gewend is.
        self.acuut_chronisch = None
        if self.strain_7d_gemiddeld and self.strain_28d_gemiddeld:
            if self.strain_28d_gemiddeld > 0:
                self.acuut_chronisch = (
                    self.strain_7d_gemiddeld / self.strain_28d_gemiddeld)

        drempel = float(self.regels["belasting"]["zware_sessie_strain_vanaf"])
        self.zware_sessie_drempel = drempel

        # Hoeveel dagen geleden was de laatste zware sessie?
        self.dagen_sinds_zwaar = None
        zware_dagen = sorted(
            [t.datum for t in self.trainingen
             if t.strain is not None and t.strain >= drempel and t.datum < self.vandaag],
            reverse=True,
        )
        # Een zware dag kan ook uit de dagstrain blijken zonder losse training.
        zware_dagen += sorted(
            [d for d, s in afgesloten.items()
             if s >= float(self.regels["belasting"]["dagstrain_hoog_vanaf"])],
            reverse=True,
        )
        if zware_dagen:
            self.dagen_sinds_zwaar = (self.vandaag - max(zware_dagen)).days
        self.zware_dagen = sorted(set(zware_dagen), reverse=True)

        # Hoeveel zware dagen op rij, direct voor vandaag?
        self.zware_dagen_op_rij = 0
        loper = self.vandaag - dt.timedelta(days=1)
        while loper in set(self.zware_dagen):
            self.zware_dagen_op_rij += 1
            loper -= dt.timedelta(days=1)

    # -- verhouding kracht tegenover hardlopen -------------------------------

    def _bereken_trainingsmix(self):
        def in_venster(dagen):
            grens = self.vandaag - dt.timedelta(days=dagen)
            return [t for t in self.trainingen if grens <= t.datum <= self.vandaag]

        self.trainingen_7d = in_venster(7)
        self.trainingen_14d = in_venster(14)

        indeling = self.sportindeling
        self.kracht_7d = [t for t in self.trainingen_7d if indeling.is_kracht(t)]
        self.kracht_14d = [t for t in self.trainingen_14d if indeling.is_kracht(t)]
        self.hardlopen_7d = [t for t in self.trainingen_7d if indeling.is_hardlopen(t)]
        self.hardlopen_14d = [t for t in self.trainingen_14d if indeling.is_hardlopen(t)]
        self.overig_7d = [
            t for t in self.trainingen_7d
            if not indeling.is_kracht(t) and not indeling.is_hardlopen(t)]

        self.laatste_kracht = self.kracht_14d[-1].datum if self.kracht_14d else None
        self.laatste_hardloop = self.hardlopen_14d[-1].datum if self.hardlopen_14d else None

        self.dagen_sinds_kracht = (
            (self.vandaag - self.laatste_kracht).days if self.laatste_kracht else None)
        self.dagen_sinds_hardloop = (
            (self.vandaag - self.laatste_hardloop).days if self.laatste_hardloop else None)

    # -- hartslagzones -------------------------------------------------------

    def zone(self, nummer):
        """Het hartslagbereik van een zone, als (onder, boven) in slagen."""
        zones = self.regels["hartslagzones"]
        sleutel = "zone{}".format(nummer)
        if sleutel not in zones:
            return None
        maximum = self.max_hartslag or zones.get("standaard_max_hartslag")
        if not maximum:
            return None
        onder, boven = zones[sleutel]
        return int(round(maximum * onder)), int(round(maximum * boven))

    @property
    def max_hartslag_is_geschat(self):
        return not self.max_hartslag

    # -- volledigheid van de data -------------------------------------------

    def vertrouwen(self):
        """Hoe stevig het advies staat: hoog, gemiddeld of laag."""
        punten = 0
        if self.herstelscore is not None and (self.herstel_ouderdom_dagen or 0) <= 1:
            punten += 2
        elif self.herstelscore is not None:
            punten += 1
        if self.slaapprestatie is not None and (self.slaap_ouderdom_dagen or 0) <= 1:
            punten += 1
        if self.strain_7d:
            punten += 1
        if self.hrv_basislijn is not None:
            punten += 1
        if self.kalibreert:
            punten -= 2

        if punten >= 5:
            return "hoog"
        if punten >= 3:
            return "gemiddeld"
        return "laag"
