#!/usr/bin/env python3
"""Ticket 154 — bouwt de Klankkast: een HTML-pagina met elk geluid van
Amsterdam Undead afspeelbaar, ingedeeld per categorie, met wanneer je het in
het spel hoort en een voor/na-vergelijking van de ruislaag.

Leest de uitvoer van `maak-geluidsverslag.mjs` (manifest + fragmenten +
spectra) en giet die in `klankkast-sjabloon.html`. De audio gaat als
base64 data-URI de pagina in, dus het resultaat is één zelfstandig bestand —
zelfde regel als het spel zelf.

Draaien (na maak-geluidsverslag.mjs, en de mp3/spectra-stap eromheen):
    python3 maak-klankkast.py
"""
import json, os

BASIS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'geluidsverslag')
man = json.load(open(f'{BASIS}/manifest.json'))
frag = json.load(open(f'{BASIS}/fragmenten.json'))
spec = json.load(open(f'{BASIS}/spectra.json'))

GROEPEN = [
    ('Wapens', 'Wat je in je handen hebt. Elke tik hoort je zonder te kijken te vertellen wat er gebeurde.',
     ['schotAmstel', 'schotRipper', 'droogKlik', 'herlaad', 'herlaadKlaar', 'wissel', 'mesSteek',
      'raakTik', 'kopTik', 'killKnak', 'doorboring']),
    ('Ondoden', 'Waar ze zijn, welk type het is, en of er nu een klap aankomt.',
     ['gromNormaal', 'gromSjouwer', 'gromBrander', 'aanvalGromSjouwer', 'aanvalGromSluiper',
      'aanvalGromNormaal', 'slagRaak', 'slagMis']),
    ('Speler en wereld', 'Schade, barricades en het einde van de stroom.',
     ['spelerAu', 'plankBreek', 'explosie', 'stroomklap', 'stroomHerstel']),
    ('Golf en meta', 'De klok van het spel: waar je in de run zit.',
     ['golfStart', 'golfKlaar', 'gameOver', 'finaleLosgooien', 'introMelodie']),
    ('Economie', 'Abstracte signalen, bewust geen realisme — een pictogram werkt beter dan een foto.',
     ['koop', 'geenGeld', 'smeed']),
    ('Omgeving', 'Het pand en de stad eromheen. Zeldzaam, zacht, en altijd buiten de gromband.',
     ['druppelTik', 'gangKraak', 'bijkeukenKraak', 'windvlaag', 'grachtklok',
      'verreScheepshoorn', 'verreStadsklok']),
    ('Boot en de lagen eronder', 'De ontsnapping, en de twee klanken die permanent onder alles door lopen.',
     ['bootHoorn', 'bootVertrek', 'bootHoornGericht', 'dreigingsdrone', 'nevelklok']),
]

# gemeten ruis/toon-verhouding (meet-ruislaag.mjs)
GEMETEN = {
    'schotAmstel': -2.1, 'schotRipper': -2.1, 'droogKlik': -3.3, 'herlaad': -4.7,
    'herlaadKlaar': -5.8, 'mesSteek': -4.6, 'raakTik': -6.5, 'kopTik': -6.7,
    'killKnak': -6.8, 'slagRaak': -6.1, 'slagMis': -0.8, 'plankBreek': -1.7,
    'explosie': -3.6, 'gangKraak': -5.0, 'bijkeukenKraak': -4.0, 'windvlaag': 1.2,
    'gromNormaal': -5.2, 'gromSjouwer': -5.5, 'gromBrander': -6.4,
}

items = {f"{i['sleutel']}__{i['variant']}": i for i in man['items']}
sleutels = []
for _, _, lijst in GROEPEN:
    sleutels += lijst
ontbreekt = [s for s in sleutels if not any(k.startswith(s + '__') for k in items)]
extra = sorted({k.rsplit('__', 1)[0] for k in items} - set(sleutels))
assert not ontbreekt, f'ontbreekt: {ontbreekt}'
assert not extra, f'niet ingedeeld: {extra}'

data = {}
for s in sleutels:
    varianten = {k.rsplit('__', 1)[1]: k for k in items if k.rsplit('__', 1)[0] == s}
    it = items[list(varianten.values())[0]]
    data[s] = {
        'titel': it['titel'], 'wanneer': it['wanneer'],
        'ab': 'voor' in varianten,
        'db': GEMETEN.get(s),
        'audio': {v: frag[k] for v, k in varianten.items()},
        'spec': {v: spec['spectra'][k] for v, k in varianten.items()},
        'duur': round(it['lengte'], 2),
    }

groepen_uit = [{'naam': n, 'intro': i, 'sleutels': l} for n, i, l in GROEPEN]

sjabloon = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'klankkast-sjabloon.html')).read()
uit = sjabloon.replace('"__DATA__"', json.dumps({'groepen': groepen_uit, 'geluiden': data}, separators=(',', ':')))
pad = os.path.join(BASIS, 'klankkast.html')
open(pad, 'w').write(uit)
print(f'{pad}  {len(uit)/1024/1024:.2f} MB')
