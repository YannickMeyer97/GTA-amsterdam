# CLAUDE.md — Dam Chaos Portaal

## Projectdoel
Klein browsergame-portaal met twee losse single-file Three.js games:
1. **Defend National Monument** (`defend-national-monument.html`) — de bestaande, stabiele game (voorheen `index.html`).
2. **Amsterdam Undead** (`amsterdam-undead.html`) — nieuwe first-person undead wave-survival in een Amsterdams grachtenhuis.
`index.html` wordt een simpel hoofdmenu met twee knoppen.

## IP-regels (hard)
- Amsterdam Undead is genre-geïnspireerd (wave survival), maar géén kopie van Call of Duty / Nazi Zombies of andere bestaande IP.
- Geen bestaande namen, perk-namen, wapennamen, UI, logo's, symbolen, audio, maps, easter eggs of assets uit bestaande games.
- Geen nazi-symboliek, nergens, ook niet "verwijzend".
- Alles origineel: eigen namen (NL/Amsterdams thema), eigen vormen, eigen geluiden via Web Audio.

## Bestandsstructuur
```
index.html                      → hoofdmenu (alleen HTML/CSS + 2 links, geen game-code)
defend-national-monument.html   → bestaande game, byte-voor-byte verplaatst
amsterdam-undead.html           → nieuwe game, single-file, zelfde technische regels
CLAUDE.md                       → dit bestand
ROADMAP.md                      → roadmap + tickets
README.md                       → speler-gerichte uitleg
```

## Werkwijze
- **Wijzig `defend-national-monument.html` NIET, tenzij de gebruiker er expliciet om vraagt.**
- Elke game blijft één zelfstandig HTML-bestand: geen frameworks, geen externe assets, geen textures/modellen, alleen Three.js via de bestaande importmap-CDN en simpele geometrieën.
- Hergebruik uit de bestaande game gaat via **kopiëren en aanpassen** in `amsterdam-undead.html`, nooit via gedeelde JS/CSS-bestanden of het aanpassen van de bestaande game.
- Kleine stappen: één ticket per keer (zie ROADMAP.md), na elke stap syntax-/laadcheck en de relevante tests.
- Commit/push alleen op expliciet verzoek van de gebruiker.
- Debug-hook patroon: exporteer testbare functies op `window.<GameNaam>Debug` (zoals `DamChaosDebug`), zodat headless Playwright-tests state kunnen inspecteren.

## Testinstructies
- Headless: Playwright + lokale Chromium (`executablePath: '/opt/pw-browsers/chromium'`), CDN-intercept die `three.module.js` lokaal serveert (zie bestaande testscripts in de scratchpad); pointer lock simuleren via `Object.defineProperty(document, 'pointerLockElement', ...)`.
- Handmatig (macOS): `python3 -m http.server 8000` in de repo-root, dan `http://localhost:8000/` in Chrome of Safari. Dubbelklikken op het bestand werkt meestal ook (CDN vereist internet).
- Bestaande regressiesuite voor Defend National Monument moet groen blijven; testscripts wijzen na Ticket 1 naar `defend-national-monument.html`.

## Bekende valkuilen
- De pauze-gate (`document.pointerLockElement === renderer.domElement`) bepaalt of de game-loop simuleert; tests moeten pointer lock simuleren.
- `registreerObstakel` (Box3) groeit mee met decor — gebruik expliciete `registreerRechthoek` voor gebouwen met uitstekende delen.
- Key-handlers: altijd `!e.repeat` + pointer-lock-check voor actie-toetsen (T/X-patroon).
