"""Opslag van tokens.

Twee achterkanten:

``bestand``        tokens.json in de datamap, mode 0600 (standaard, werkt overal)
``sleutelhanger``  de macOS Keychain via het ``security``-commando (opt-in)

De sleutelhanger is veiliger omdat de tokens dan versleuteld op schijf staan,
maar hij bestaat alleen op macOS. Valt hij weg, dan zegt de tool dat en
schakelt terug naar het bestand in plaats van te crashen.
"""

import json
import os
import subprocess
import sys

from .config import lees_json, schrijf_prive_json

SLEUTELHANGER_DIENST = "whoop-coach"
SLEUTELHANGER_ACCOUNT = "tokens"


class BestandOpslag(object):
    """Tokens in een JSON-bestand dat alleen de eigenaar mag lezen."""

    naam = "bestand"

    def __init__(self, pad):
        self.pad = pad

    def laad(self):
        return lees_json(self.pad, None)

    def bewaar(self, tokens):
        schrijf_prive_json(self.pad, tokens)

    def wis(self):
        if os.path.exists(self.pad):
            os.remove(self.pad)
            return True
        return False

    def beschrijving(self):
        return "bestand {} (alleen leesbaar voor jou)".format(self.pad)


class SleutelhangerOpslag(object):
    """Tokens in de macOS Keychain."""

    naam = "sleutelhanger"

    def __init__(self, dienst=SLEUTELHANGER_DIENST, account=SLEUTELHANGER_ACCOUNT):
        self.dienst = dienst
        self.account = account

    @staticmethod
    def beschikbaar():
        """Alleen op macOS met het ``security``-commando binnen handbereik."""
        if sys.platform != "darwin":
            return False
        try:
            subprocess.run(
                ["security", "-h"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                timeout=5,
            )
            return True
        except (OSError, subprocess.SubprocessError):
            return False

    def laad(self):
        try:
            klaar = subprocess.run(
                ["security", "find-generic-password", "-s", self.dienst,
                 "-a", self.account, "-w"],
                capture_output=True, text=True, timeout=15,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        if klaar.returncode != 0:
            return None
        try:
            return json.loads(klaar.stdout.strip())
        except json.JSONDecodeError:
            return None

    def bewaar(self, tokens):
        nuttig = json.dumps(tokens)
        # -U overschrijft een bestaand item in plaats van te klagen.
        subprocess.run(
            ["security", "add-generic-password", "-U", "-s", self.dienst,
             "-a", self.account, "-w", nuttig],
            capture_output=True, text=True, timeout=15, check=True,
        )

    def wis(self):
        klaar = subprocess.run(
            ["security", "delete-generic-password", "-s", self.dienst,
             "-a", self.account],
            capture_output=True, text=True, timeout=15,
        )
        return klaar.returncode == 0

    def beschrijving(self):
        return "de macOS Sleutelhanger (dienst '{}')".format(self.dienst)


def kies_opslag(instellingen, meldt=None):
    """Geef de opslag die bij de instellingen past, met terugval.

    ``meldt`` is een functie die een waarschuwing toont; zo blijft deze module
    vrij van aannames over hoe de CLI print.
    """
    gevraagd = (instellingen.token_opslag or "bestand").lower()
    if gevraagd in ("sleutelhanger", "keychain"):
        if SleutelhangerOpslag.beschikbaar():
            return SleutelhangerOpslag()
        if meldt:
            meldt(
                "De macOS Sleutelhanger is hier niet beschikbaar; tokens gaan "
                "naar {} in plaats daarvan.".format(instellingen.tokens_pad)
            )
    return BestandOpslag(instellingen.tokens_pad)
