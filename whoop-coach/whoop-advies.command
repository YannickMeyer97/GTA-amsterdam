#!/bin/bash
# Dubbelklik dit bestand in Finder om je advies van vandaag te zien.
#
# macOS opent het in Terminal. Werkt dat de eerste keer niet, geef het
# bestand dan uitvoerrechten:
#     chmod +x whoop-advies.command

cd "$(dirname "$0")" || exit 1

python3 -m whoop_coach advies
UITKOMST=$?

echo
if [ $UITKOMST -ne 0 ]; then
    echo "Er ging iets mis (code $UITKOMST). Lees de melding hierboven."
fi
echo "Druk op Enter om dit venster te sluiten."
read -r _
exit $UITKOMST
