#!/bin/bash
# Dubbelklik dit bestand om (opnieuw) te koppelen aan WHOOP.
# Je browser opent dan het toestemmingsscherm van WHOOP.

cd "$(dirname "$0")" || exit 1

python3 -m whoop_coach koppel
UITKOMST=$?

echo
echo "Druk op Enter om dit venster te sluiten."
read -r _
exit $UITKOMST
