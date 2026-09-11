"""De commandoregel van de trainingsadviseur.

    python3 -m whoop_coach koppel     eenmalig koppelen aan WHOOP
    python3 -m whoop_coach advies     het dagelijkse advies (standaard)
    python3 -m whoop_coach sporten    welke sporten kracht/hardlopen zijn
    python3 -m whoop_coach status     werkt de koppeling nog?
    python3 -m whoop_coach ontkoppel  tokens weggooien
"""

import argparse
import datetime as dt
import json
import sys

from . import auth, coach, demo, model, opslag, rapport, sporten
from .api import WhoopClient
from .config import SCOPES, Instellingen
from .errors import ApiFout, WhoopCoachError


def _schrijver(argumenten):
    kleur = False if getattr(argumenten, "geen_kleur", False) else None
    return rapport.Schrijver(kleur=kleur)


def _instellingen(argumenten):
    instellingen = Instellingen(getattr(argumenten, "datamap", None))
    if getattr(argumenten, "poort", None):
        instellingen.zet("redirect_poort", argumenten.poort)
    return instellingen


def _melder(argumenten):
    """Schrijver voor voortgang en waarschuwingen: altijd naar stderr."""
    kleur = False if getattr(argumenten, "geen_kleur", False) else None
    return rapport.Schrijver(stroom=sys.stderr, kleur=kleur)


def _opslag(instellingen, uit):
    return opslag.kies_opslag(
        instellingen, meldt=lambda tekst: uit.regel("Let op: " + tekst, "geel"))


def _client(instellingen, uit):
    tokenbeheer = auth.TokenBeheer(instellingen, _opslag(instellingen, uit))
    tokenbeheer.eis_koppeling()
    return WhoopClient(instellingen, tokenbeheer), tokenbeheer


def _naam_van_gebruiker(client, uit):
    """De voornaam voor de kop; een fout hier mag het advies niet blokkeren."""
    try:
        profiel = client.profiel() or {}
        return profiel.get("first_name")
    except (ApiFout, WhoopCoachError):
        return None


# --- commando's -------------------------------------------------------------

def commando_koppel(argumenten):
    uit = _schrijver(argumenten)
    instellingen = _instellingen(argumenten)

    if argumenten.client_id:
        instellingen.zet("client_id", argumenten.client_id.strip())
    if argumenten.client_secret:
        instellingen.zet("client_secret", argumenten.client_secret.strip())
    if argumenten.sleutelhanger:
        instellingen.zet("token_opslag", "sleutelhanger")
    if argumenten.client_id or argumenten.client_secret or argumenten.poort \
            or argumenten.sleutelhanger:
        instellingen.bewaar_config()

    if not instellingen.client_id or not instellingen.client_secret:
        uit.regel()
        uit.regel("Je WHOOP client id en secret ontbreken nog.", "vet", "geel")
        uit.regel()
        uit.regel("Maak eenmalig een app aan op https://developer.whoop.com:")
        uit.regel("  1. Log in en ga naar je dashboard, kies 'Create new app'.")
        uit.regel("  2. Naam: bijvoorbeeld 'Mijn trainingsadviseur'.")
        uit.regel("  3. Redirect URI: exact deze regel, inclusief poort en pad:")
        uit.regel("         {}".format(instellingen.redirect_uri), "vet")
        uit.regel("  4. Scopes: zet deze allemaal aan:")
        for scope in SCOPES:
            uit.regel("         {}".format(scope))
        uit.regel("  5. Sla op en kopieer de Client ID en Client Secret.")
        uit.regel()
        uit.regel("Draai daarna:")
        uit.regel("  python3 -m whoop_coach koppel --client-id <ID> "
                  "--client-secret <SECRET>", "vet")
        uit.regel()
        return 2

    bewaarplek = _opslag(instellingen, uit)
    uit.regel()
    uit.regel("Koppelen aan WHOOP ...", "vet")
    auth.koppel(instellingen, bewaarplek,
                meldt=lambda tekst: uit.regel(tekst),
                open_browser=not argumenten.geen_browser)

    instellingen.schrijf_standaardregels_indien_afwezig()
    uit.regel()
    uit.regel("Gelukt. De koppeling is opgeslagen in {}.".format(
        bewaarplek.beschrijving()), "groen", "vet")
    uit.regel()
    uit.regel("Draai nu eenmalig 'sporten' om je krachttraining en hardlopen")
    uit.regel("te laten herkennen, en daarna dagelijks 'advies'.")
    uit.regel()
    return 0


def commando_advies(argumenten):
    uit = _schrijver(argumenten)
    instellingen = _instellingen(argumenten)
    instellingen.schrijf_standaardregels_indien_afwezig()

    dagen = argumenten.dagen or int(instellingen.regels()["venster"]["analyse_dagen"])
    vandaag = None
    if argumenten.datum:
        vandaag = dt.datetime.strptime(argumenten.datum, "%Y-%m-%d").date()

    client = None
    if argumenten.demo:
        if not argumenten.json:
            _melder(argumenten).regel(
                "DEMO: verzonnen data, geen WHOOP-koppeling.", "geel")
        data = demo.maak_data(argumenten.demo, dagen=dagen, vandaag=vandaag)
    else:
        client, _ = _client(instellingen, _melder(argumenten))
        if not argumenten.json:
            _melder(argumenten).regel("WHOOP-data ophalen ...", "dof")
        data = coach.haal_data(client, dagen=dagen)

    resultaat = coach.advies_voor(data, instellingen, vandaag=vandaag)

    if argumenten.json:
        sys.stdout.write(json.dumps(resultaat.als_dict(), indent=2,
                                    ensure_ascii=False) + "\n")
        return 0

    naam = None
    if client is not None and not argumenten.kort:
        naam = _naam_van_gebruiker(client, uit)
    rapport.toon_advies(resultaat, schrijver=uit, naam=naam,
                        regels_pad=instellingen.regels_pad)
    return 0


def commando_sporten(argumenten):
    uit = _schrijver(argumenten)
    instellingen = _instellingen(argumenten)
    client, _ = _client(instellingen, _melder(argumenten))

    dagen = argumenten.dagen or 180
    if not argumenten.json:
        _melder(argumenten).regel(
            "Trainingen van de afgelopen {} dagen ophalen ...".format(dagen),
            "dof")

    nu = dt.datetime.now(dt.timezone.utc)
    records = client.trainingen(
        coach.iso_utc(nu - dt.timedelta(days=dagen)), coach.iso_utc(nu))
    trainingen = model.bouw_trainingen(records)

    statistieken = sporten.analyseer(trainingen)
    indeling = sporten.bepaal_indeling(
        statistieken, sporten.laad_eigen_indeling(instellingen))

    if argumenten.json:
        sys.stdout.write(json.dumps({
            "statistieken": [
                {k: (v.isoformat() if hasattr(v, "isoformat") else v)
                 for k, v in stat.items()}
                for stat in statistieken
            ],
            "indeling": indeling.als_dict(),
            "herkomst": indeling.herkomst,
        }, indent=2, ensure_ascii=False, default=str) + "\n")
        return 0

    sporten.bewaar_indeling(instellingen, indeling, statistieken)
    rapport.toon_sporten(statistieken, indeling, schrijver=uit,
                         pad=instellingen.sports_pad)
    return 0


def commando_status(argumenten):
    uit = _schrijver(argumenten)
    instellingen = _instellingen(argumenten)
    bewaarplek = _opslag(instellingen, uit)
    tokenbeheer = auth.TokenBeheer(instellingen, bewaarplek)

    uit.regel()
    uit.regel("STATUS", "vet")
    uit.streep("=")
    uit.regel("Datamap        {}".format(instellingen.datamap))
    uit.regel("Tokens         {}".format(bewaarplek.beschrijving()))
    uit.regel("Redirect-URI   {}".format(instellingen.redirect_uri))
    uit.regel("API            {}".format(instellingen.api_basis))
    uit.regel("Client id      {}".format(
        _gemaskeerd(instellingen.client_id) or "ontbreekt"))

    if not tokenbeheer.gekoppeld():
        uit.regel("Koppeling      {}".format(
            uit.verf("nog niet gekoppeld", "geel")))
        uit.regel()
        uit.regel("Draai: python3 -m whoop_coach koppel")
        uit.regel()
        return 1

    resterend = tokenbeheer.verloopt_over()
    if resterend is None:
        leeftijd = "onbekend"
    elif resterend > 0:
        leeftijd = "nog {:.0f} minuten geldig".format(resterend / 60.0)
    else:
        leeftijd = "verlopen, wordt bij het volgende verzoek ververst"
    uit.regel("Access token   {}".format(leeftijd))
    uit.regel("Refresh token  {}".format(
        "aanwezig" if (tokenbeheer.tokens or {}).get("refresh_token")
        else uit.verf("ontbreekt (opnieuw koppelen)", "geel")))

    uit.regel()
    uit.regel("Verbinding testen ...", "dof")
    client = WhoopClient(instellingen, tokenbeheer)
    profiel = client.profiel() or {}
    naam = " ".join(filter(None, [profiel.get("first_name"), profiel.get("last_name")]))
    uit.regel("Verbonden als  {}".format(
        uit.verf(naam or "onbekend", "groen", "vet")))
    uit.regel()
    return 0


def commando_ontkoppel(argumenten):
    uit = _schrijver(argumenten)
    instellingen = _instellingen(argumenten)
    bewaarplek = _opslag(instellingen, uit)
    verwijderd = auth.TokenBeheer(instellingen, bewaarplek).ontkoppel()
    uit.regel()
    if verwijderd:
        uit.regel("Tokens verwijderd uit {}.".format(bewaarplek.beschrijving()),
                  "groen")
        uit.regel("Je client id en secret staan nog in {}.".format(
            instellingen.config_pad))
    else:
        uit.regel("Er stonden geen tokens opgeslagen.", "geel")
    uit.regel()
    return 0


def _gemaskeerd(waarde):
    if not waarde:
        return None
    tekst = str(waarde)
    if len(tekst) <= 8:
        return "*" * len(tekst)
    return tekst[:4] + "..." + tekst[-4:]


# --- argumenten -------------------------------------------------------------

def _globale_opties(ontleder):
    """Opties die zowel voor als na het commando mogen staan.

    De standaardwaarde is SUPPRESS: zonder dat zou het subcommando de waarde
    die voor het commando is meegegeven weer op None zetten.
    """
    ontleder.add_argument("--datamap", default=argparse.SUPPRESS,
                          help="andere map voor tokens en instellingen")
    ontleder.add_argument("--geen-kleur", action="store_true",
                          dest="geen_kleur", default=argparse.SUPPRESS,
                          help="uitvoer zonder kleuren")
    return ontleder


COMMANDOS = ("koppel", "advies", "sporten", "status", "ontkoppel")


def bouw_ontleder():
    ontleder = argparse.ArgumentParser(
        prog="whoop-coach",
        description="Dagelijks trainingsadvies op basis van je WHOOP-data.",
    )
    _globale_opties(ontleder)

    # Dezelfde opties nog eens op elk subcommando, zodat zowel
    # "--geen-kleur status" als "status --geen-kleur" werkt.
    gedeeld = _globale_opties(argparse.ArgumentParser(add_help=False))

    sub = ontleder.add_subparsers(dest="commando")

    p_koppel = sub.add_parser("koppel", parents=[gedeeld],
                              help="eenmalig koppelen aan WHOOP")
    p_koppel.add_argument("--client-id", dest="client_id")
    p_koppel.add_argument("--client-secret", dest="client_secret")
    p_koppel.add_argument("--poort", type=int,
                          help="poort van het lokale opvangservertje")
    p_koppel.add_argument("--sleutelhanger", action="store_true",
                          help="tokens in de macOS Sleutelhanger bewaren")
    p_koppel.add_argument("--geen-browser", action="store_true",
                          dest="geen_browser",
                          help="de browser niet automatisch openen")
    p_koppel.set_defaults(functie=commando_koppel)

    p_advies = sub.add_parser("advies", parents=[gedeeld],
                              help="het advies van vandaag")
    p_advies.add_argument("--json", action="store_true",
                          help="uitvoer als JSON in plaats van tekst")
    p_advies.add_argument("--dagen", type=int,
                          help="hoeveel dagen historie meenemen")
    p_advies.add_argument("--datum", help="doe alsof het deze datum is (JJJJ-MM-DD)")
    p_advies.add_argument("--kort", action="store_true",
                          help="geen profielnaam ophalen")
    p_advies.add_argument("--demo", nargs="?", const="normaal",
                          choices=demo.SITUATIES,
                          help="draai op verzonnen data, zonder koppeling "
                               "(kies: {})".format(", ".join(demo.SITUATIES)))
    p_advies.set_defaults(functie=commando_advies)

    p_sporten = sub.add_parser(
        "sporten", parents=[gedeeld],
        help="welke sporten bij jou kracht en hardlopen zijn")
    p_sporten.add_argument("--json", action="store_true")
    p_sporten.add_argument("--dagen", type=int,
                           help="hoeveel dagen historie doorzoeken (standaard 180)")
    p_sporten.set_defaults(functie=commando_sporten)

    p_status = sub.add_parser("status", parents=[gedeeld],
                              help="controleer de koppeling")
    p_status.set_defaults(functie=commando_status)

    p_ontkoppel = sub.add_parser("ontkoppel", parents=[gedeeld],
                                 help="opgeslagen tokens wissen")
    p_ontkoppel.set_defaults(functie=commando_ontkoppel)

    return ontleder


def main(argv=None):
    ontleder = bouw_ontleder()
    argv = list(sys.argv[1:] if argv is None else argv)
    # Zonder commando geven we het advies: dat is wat je dagelijks wilt.
    vraagt_hulp = any(a in ("-h", "--help") for a in argv)
    if not vraagt_hulp and not any(a in COMMANDOS for a in argv):
        argv = ["advies"] + argv
    argumenten = ontleder.parse_args(argv)

    if not getattr(argumenten, "functie", None):
        ontleder.print_help()
        return 0

    try:
        return argumenten.functie(argumenten)
    except WhoopCoachError as fout:
        uit = rapport.Schrijver(stroom=sys.stderr,
                                kleur=None if not getattr(argumenten, "geen_kleur", False) else False)
        uit.regel()
        uit.regel("Er ging iets mis: {}".format(fout.boodschap), "rood", "vet")
        if fout.suggestie:
            uit.regel()
            for regel in str(fout.suggestie).split("\n"):
                uit.regel(regel)
        uit.regel()
        return fout.exit_code
    except KeyboardInterrupt:
        sys.stderr.write("\nAfgebroken.\n")
        return 130
