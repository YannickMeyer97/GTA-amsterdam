"""Het geheel aan elkaar knopen: data ophalen, analyseren, advies geven."""

import datetime as dt

from . import model, sporten
from .advies import bepaal_advies
from .analyse import Analyse
from .errors import ApiFout, AuthenticatieFout, DataOntbreektFout


def iso_utc(moment):
    """UTC-tijdstip in de vorm die WHOOP verwacht."""
    return moment.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def haal_data(client, dagen=28, nu=None):
    """Haal alle collecties op voor het analysevenster.

    Geeft een dict met ruwe records plus de lichaamsmaten. Een endpoint dat
    weigert (bijvoorbeeld een ontbrekende scope) laat de rest overeind.
    """
    nu = nu or dt.datetime.now(dt.timezone.utc)
    # Een dag extra marge aan beide kanten: cycli lopen niet gelijk met
    # middernacht, en een nacht kan net buiten het venster beginnen.
    start = iso_utc(nu - dt.timedelta(days=dagen + 1))
    eind = iso_utc(nu + dt.timedelta(days=1))

    waarschuwingen = []

    def veilig(naam, functie, standaard):
        try:
            return functie()
        except AuthenticatieFout:
            # Een geweigerde scope mag het advies niet tegenhouden, maar de
            # gebruiker moet het wel weten.
            raise
        except ApiFout as fout:
            waarschuwingen.append(
                "{} kon niet worden opgehaald ({}).".format(naam, fout.boodschap))
            return standaard

    data = {
        "cycli": veilig("Cycli", lambda: client.cycli(start, eind), []),
        "herstel": veilig("Herstel", lambda: client.herstel(start, eind), []),
        "slaap": veilig("Slaap", lambda: client.slaap(start, eind), []),
        "trainingen": veilig("Trainingen", lambda: client.trainingen(start, eind), []),
        "lichaamsmaten": veilig("Lichaamsmaten", client.lichaamsmaten, {}) or {},
        "waarschuwingen": waarschuwingen,
    }
    return data


def bouw_analyse(data, instellingen, vandaag=None, eigen_sportindeling=None):
    """Zet ruwe records om in een :class:`Analyse`."""
    regels = instellingen.regels()

    cycli = model.bouw_cycli(data.get("cycli"))
    herstel = model.bouw_herstel(data.get("herstel"), cycli)
    slaap = model.bouw_slaap(data.get("slaap"))
    trainingen = model.bouw_trainingen(data.get("trainingen"))

    if vandaag is None:
        vandaag = _vandaag_uit_data(cycli, slaap)

    statistieken = sporten.analyseer(trainingen)
    if eigen_sportindeling is None:
        eigen_sportindeling = sporten.laad_eigen_indeling(instellingen)
    indeling = sporten.bepaal_indeling(statistieken, eigen_sportindeling)

    max_hartslag = (data.get("lichaamsmaten") or {}).get("max_heart_rate")
    try:
        max_hartslag = float(max_hartslag) if max_hartslag else None
    except (TypeError, ValueError):
        max_hartslag = None

    analyse = Analyse(
        vandaag=vandaag,
        cycli=cycli,
        herstel=herstel,
        slaap=slaap,
        trainingen=trainingen,
        sportindeling=indeling,
        regels=regels,
        max_hartslag=max_hartslag,
    )
    analyse.waarschuwingen.extend(data.get("waarschuwingen") or [])
    analyse.sportstatistieken = statistieken
    return analyse


def _vandaag_uit_data(cycli, slaap):
    """Bepaal 'vandaag' in jouw tijdzone.

    We leunen op de tijdzone die WHOOP bij je laatste cyclus meestuurt, zodat
    het advies klopt als je in een andere tijdzone zit dan de computer.
    """
    laatste = None
    for verzameling in (cycli, slaap):
        if verzameling:
            kandidaat = verzameling[-1]
            zone = model.ontleed_offset((kandidaat.ruw or {}).get("timezone_offset"))
            if zone is not None:
                laatste = zone
                break
    nu = dt.datetime.now(laatste or dt.timezone.utc) if laatste else dt.datetime.now()
    return nu.date()


def advies_voor(data, instellingen, vandaag=None):
    """Haal in een keer het advies uit opgehaalde data."""
    analyse = bouw_analyse(data, instellingen, vandaag=vandaag)
    if not analyse.herstel and not analyse.cycli and not analyse.slaap:
        raise DataOntbreektFout(
            "WHOOP gaf geen enkele meting terug voor de afgelopen weken.",
            suggestie=(
                "Draag je band een nacht en probeer het morgen opnieuw. "
                "Controleer anders met 'status' of de koppeling nog werkt."
            ),
        )
    return bepaal_advies(analyse)
