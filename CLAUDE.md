# CLAUDE.md — Amsterdam Arcade (repo: GTA-amsterdam)

Dit bestand is het startpunt voor elke nieuwe Claude-sessie. Het vat samen wat
eerder alleen in gesprekken stond: wie de eigenaar is, hoe er gewerkt wordt,
welke beslissingen vastliggen en waar je moet opletten. De details per game
staan in `docs/<game>/`; dit bestand vertelt waar je moet zoeken.

---

## 1. Het project in het kort

Een klein browsergame-portaal met twee losse single-file Three.js-games, live
via GitHub Pages: **https://yannickmeyer97.github.io/GTA-amsterdam/**

| Bestand | Wat |
| --- | --- |
| `index.html` | Hoofdmenu "Amsterdam Arcade": twee kaarten met een knop, alleen HTML/CSS, geen game-code. Werkt staand en liggend op een telefoon (D89). |
| `defend-national-monument.html` | **Defend National Monument** (DNM, ~8.700 regels). Tower defense + first-person schieten op de Dam: robots lopen via vijf straten naar het Nationaal Monument. 20 waves, vier bazen, torens, commandopost, sterren, ontgrendelingen. Speelbaar met muis en op een telefoon (touch, fase T). |
| `amsterdam-undead.html` | **Amsterdam Undead** (~19.700 regels). First-person wave-survival tegen ondoden in een Amsterdams grachtenpand: vijf zones in een lus, koopdeuren, wapens, smederij, vluchtroute + ontsnapping per boot, archief/winkel tussen runs. Ook speelbaar op een telefoon (T176–T181). |

**Stand (november 2026):** beide games zijn af en stabiel; er staan geen
geplande tickets open. CI is groen (169/169). Wat er nog ligt, staat in §9.

---

## 2. De eigenaar en hoe je samenwerkt

- **Taal:** de eigenaar schrijft Nederlands; antwoord in het Nederlands. Code,
  commentaar, commits en documentatie zijn ook Nederlands.
- **Kort en concreet.** Zeg wat er voor de speler verandert, niet alleen wat er
  in de code gebeurde. Eindig met een duidelijke vraag als er een beslissing
  nodig is (bv. "Zal ik het naar main pushen?").
- **Eerlijk over wat niet getest is.** Bijvoorbeeld: "alleen getest in
  Chromium met telefoonformaten, niet op een echte iPhone in Safari".
- **Vragen stellen mag**, maar alleen bij een echte keuze (de eigenaar zegt
  zelf "stel vragen indien nodig"). Geef dan een aanbeveling als eerste optie.
- **Speeltests doet de eigenaar zelf**, op macOS (Chrome/Safari) en op een
  **iPhone**. In de DNM-roadmap heten die mijlpalen **M1, M2, …**; zet er
  concrete vragen bij. Hun bevindingen worden het volgende werk.
- **Eerdere keuzes van de eigenaar** (niet opnieuw ter discussie stellen):
  - DNM op touch: twee duimen + vuurknop, lichte richthulp alleen op touch,
    iPhone als doeltoestel (route via "Zet op beginscherm", Safari kent geen
    fullscreen).
  - DNM-commandopost: pickup radius is geschrapt, het menu had te veel opties
    (D88).
  - DNM-kwaliteit staat ook op een telefoon standaard op **Hoog** (D90).
  - Richtingspijlen in DNM zijn geschrapt (D27); lichtspoor en bakens tonen
    de routes.

---

## 3. Harde regels

### IP
- Amsterdam Undead is genre-geïnspireerd (wave survival), maar géén kopie van
  Call of Duty / Nazi Zombies of andere bestaande IP.
- Geen bestaande namen, perk-namen, wapennamen, UI, logo's, symbolen, audio,
  maps, easter eggs of assets uit bestaande games.
- Geen nazi-symboliek, nergens, ook niet "verwijzend".
- Alles origineel: eigen namen (NL/Amsterdams thema), eigen vormen, eigen
  geluiden via Web Audio.

### Techniek
- **Elke game is één zelfstandig HTML-bestand**: geen frameworks, geen externe
  assets, geen textures of modellen. Alleen Three.js via de bestaande
  importmap-CDN, en simpele geometrieën. Texturen worden procedureel gemaakt
  (canvas), geluid procedureel (Web Audio).
  - **Eén uitzondering (Undead T175):** ingesloten audiofragmenten voor
    menselijke stem, als base64 data-URI, nooit als los bestand. Elk fragment
    krijgt een regel in `ASSETS.md` met bron, auteur, licentie (CC0 of
    gelijkwaardig), datum en SHA-256. `ASSETS.md` bestaat nog niet: maak hem
    aan bij het eerste fragment. Geldt niet voor beeld, en audio uit bestaande
    games blijft uitgesloten.
- **Geen gedeelde code tussen de games.** Hergebruik gaat via kopiëren en
  aanpassen in het andere bestand, nooit via een gedeeld JS/CSS-bestand.
- **Debug-hook per game**: testbare state en functies staan op
  `window.DamChaosDebug` (DNM) en `window.AmsterdamUndeadDebug` (Undead).
  Nieuwe functionaliteit die een test moet kunnen zien, exporteer je daar.
- De drie HTML-bestanden blijven in de root: dat zijn de live URL's.

### Documentatie: per game, nooit kruislings
- Een wijziging aan `defend-national-monument.html` leg je vast in
  `docs/defend-national-monument/`, een wijziging aan `amsterdam-undead.html`
  in `docs/amsterdam-undead/`.
- Een testfix of CI-fix noteer je in de roadmap van de game waar de test bij
  hoort (Undead-testfixes staan onder "CI-onderhoud" in `ROADMAP_undead.md`).
- Portaalbrede wijzigingen (`index.html`, de CI-workflow, `run-all.mjs`) zijn
  tot nu toe als D-ticket in `ROADMAP_monument.md` vastgelegd (D87–D89).

---

## 4. Git, CI en publiceren

- **`main` = live.** GitHub Pages publiceert vanaf `main` (root); een deploy
  staat er een halve tot hele minuut na de push. Mobiele browsers cachen
  hard: een update zie je soms pas na een harde refresh.
- **Werkbranch:** ontwikkel op de branch die de sessie voorschrijft (eerder
  `claude/dam-chaos-3d-game-e38l89`). Main wordt daaruit bijgewerkt met een
  **fast-forward push** (`git push origin HEAD:main`); er zijn geen merges en
  geen PR's. Controleer eerst dat main niets eigens heeft
  (`git rev-list --count HEAD..origin/main` moet 0 zijn).
- **Werkwijze van de eigenaar:**
  - Commit en push naar de werkbranch zodra een ticket af is en de relevante
    tests groen zijn ("commit en push als het groen is").
  - **Naar `main` alleen als de eigenaar daar expliciet om vraagt**, ook al
    is het een fast-forward. Een "ja" geldt voor die ene push, niet voor
    volgende.
  - Geen pull requests, tenzij gevraagd.
- **Commitberichten**: Nederlands, beginnen met het ticket, bijvoorbeeld
  `D90: op een telefoon standaard kwaliteit Hoog` of
  `Undead CI-onderhoud: test-nachthemel warmt eerst op`. Een witregel, daarna
  in een paar regels wat en waarom. Volg de attributieregels die de omgeving
  voorschrijft. **Zet nooit model-ID's** in commits, PR's, code of documenten.
- **CI** (`.github/workflows/tests.yml`): draait `node run-all.mjs` in
  `tests/` op elke push en PR. Gebruikt `ubuntu-latest`, Node 24,
  `actions/checkout@v7` en `actions/setup-node@v7`, met Playwright's eigen
  Chromium (de *headless shell*, niet de lokale Chromium). Een volledige run
  duurt 40–100 minuten.
- **CI-logs lezen:** GitHub toont alleen de staart van het log, en het
  volledige log is vanuit de sessie meestal niet te downloaden. Daarom zet
  `run-all.mjs` onderaan een blok **`Rood:`** met elk rood script, zijn
  `[FAIL]`-regels en bij een gegooide fout een `[FOUT]`-regel. Lees dat met
  de GitHub-tools (`get_job_logs` met een `tail`). Filter de lijst met runs
  níet op branch: die filter gaf eerder een verouderde lijst.
- Push je naar main voordat de CI-run klaar is, kijk dan achteraf of die run
  groen werd en meld het.

---

## 5. Bestandsstructuur

```
index.html                      → hoofdmenu
defend-national-monument.html   → game 1 (DNM)
amsterdam-undead.html           → game 2 (Undead)
CLAUDE.md                       → dit bestand (portaalbreed)
README.md                       → speler-gerichte uitleg (portaalbreed): besturing, ook touch
.github/workflows/tests.yml     → CI

docs/defend-national-monument/
  ROADMAP_monument.md               → fasen, tickets D0–D90, verslagen, M-mijlpalen, backlog
  ARCHITECTURE_NOTES_monument.md    → invarianten, contracten, valkuilen (§15.x per fase)
  SONNET_EXECUTION_PLAN_monument.md → het oorspronkelijke uitvoeringsplan (D1–D43, §10/§12 bijsturing)
  AUDIT.md                          → audit na fase P en de status van elk punt
  PLATTEGROND.html                  → plattegrond van fase M (D31), bron van DAM_LAYOUT

docs/amsterdam-undead/
  ROADMAP_undead.md                 → tickets 1–187 + "CI-onderhoud", "Later (na v1)"
  ARCHITECTURE_NOTES_undead.md      → invarianten, contracten, valkuilen
  SONNET_EXECUTION_PLAN_undead.md   → uitvoeringsplan
  AUDIO · FINALE · GUNFEEL · IDEEEN · PERFORMANCE_AUDIT · TIERVISUALS · VISUEEL · ZOMBIE_V2_BASELINE (.md)
                                    → losse rapporten en metingen

tests/
  run-all.mjs, run-all-parallel.mjs → de suite (beide games)
  helpers.mjs                       → Undead-helpers
  helpers-defend.mjs                → DNM-helpers
  amsterdam-undead/                 → 117 test-/check-scripts + meet-/maak-scripts
  defend-national-monument/         → 52 test-dnm-scripts + meet-dnm-scripts
  README.md                         → uitleg van de suite (deels nog Undead-gericht)
```

**Naamgeving:** documenten die per game bestaan krijgen een achtervoegsel
(`_undead` / `_monument`). Losse rapporten die maar voor één game bestaan
houden hun kale naam.

---

## 6. Tickets en documentatie

**Kleine stappen: één ticket per keer.** Na elke stap: laadcheck, de
relevante tests, documentatie, commit.

### Defend National Monument
- Tickets heten **D0, D1, …** (laatste: **D90**). Mijlpalen voor speeltests
  van de eigenaar heten **M1–M6**.
- De fasen staan in `ROADMAP_monument.md`, met per fase een tabel
  (`| ☑ | **D86** | … |`):
  - 0–3: fundament, arena, run, tower defense;
  - M: make-over van de Dam;
  - 4: oververhitting;
  - P: een run met een doel (bazen, sterren, ontgrendelingen);
  - de audit-ronde: D67–D80;
  - T: mobiel speelbaar (D81–D86);
  - daarna losse tickets D87–D90.
- **Verslag per ticket** in de sectie van de fase, als
  `**D88 — korte titel, verslag.**`, gevolgd door bullets: aanleiding, wat
  er veranderd is, gevolgen voor spelers, tests (met aantal checks),
  documentatie. Bij een nieuw contract ook een stuk in
  `ARCHITECTURE_NOTES_monument.md` (§15.x).
- Een nieuw testscript heet `test-dnm-<naam>.mjs`. Een meetscript heet
  `meet-dnm-<naam>.mjs` en draait niet mee in de suite.

### Amsterdam Undead
- Tickets heten **Ticket N / TN** (laatste: **T187**). Per ticket een sectie
  `## Ticket 187 — titel ✅` met bullets **Status**, **Type**, aanleiding,
  uitvoering en testsuite.
- Testfixes zonder spelwijziging staan onder
  `## CI-onderhoud: … ✅`.

### Altijd
- **README.md** bijwerken als de speler iets merkt (besturing, regels,
  instellingen).
- **CLAUDE.md** bijwerken als het aantal testscripts verandert (§7) of als er
  een nieuwe conventie of beslissing bij komt.

---

## 7. Testen

### Draaien
```bash
cd tests && npm install         # eenmalig
node run-all.mjs                # hele suite, sequentieel; de gezaghebbende vorm
node run-all-parallel.mjs       # sneller, in shards; voor tussendoor
node defend-national-monument/test-dnm-kern.mjs   # één script
```
- **169 scripts:** 117 voor Undead (`test-*`/`check-*` in
  `tests/amsterdam-undead/`), 52 voor DNM (`test-dnm-*`). Elk script eindigt
  met `N OK, M FAIL` en `console errors: …`, en exitcode 0/1.
- **De hele suite duurt lang.** Voor een DNM-ticket draai je alle 52
  DNM-scripts, plus het Undead-script dat je eventueel raakte. Een simpele
  lus is genoeg:
  ```bash
  for t in defend-national-monument/test-dnm-*.mjs; do node $t | grep -E '^[0-9]+ OK'; done
  ```
- **Handmatig:** `python3 -m http.server 8000` in de repo-root, dan
  `http://localhost:8000/`. Dubbelklikken op het bestand werkt meestal ook
  (de CDN vraagt internet).

### Hoe de tests werken
- Playwright, headless.
  - **Browser:** lokaal `/opt/pw-browsers/chromium` als die bestaat, anders
    Playwright's standaardbrowser.
  - **Three.js** komt niet van de CDN: een route-intercept serveert
    `three.module.js` uit `tests/node_modules`.
- **`TEST_BROWSER`:** `TEST_BROWSER=<pad>` draait in een andere browser, en
  `TEST_BROWSER=ci` neemt Playwright's standaardbrowser. Zo speel je
  CI-fouten lokaal na. Lokaal staat een headless shell op
  `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`
  (CI gebruikt een nieuwere build).
- **Helpers:**
  - **DNM** (`helpers-defend.mjs`): `openDefend({ simuleerPointerLock,
    contextOpties, initScript })`, `frames(page, n)` en `makeChecker()`.
    Met `contextOpties: { isMobile: true, hasTouch: true, viewport }` krijg
    je een telefoon.
  - **Undead** (`helpers.mjs`): `openAmsterdamUndead({ simuleerPointerLock,
    touch, kwaliteit, query, initScript })`, `openVoorVisueleMeting()`,
    `berekenVisueleStandpunten()`, `zetVisueelStandpunt()`,
    `geefSpelerVuurwapen()`, `frames()` en `makeChecker()`.
- **Pointer lock simuleren:** `Object.defineProperty(document,
  'pointerLockElement', { get: () => canvas })` plus een
  `pointerlockchange`-event. De helpers doen dat met
  `simuleerPointerLock: true`.
- **`HERKANSING`** in `run-all.mjs`: een handvol bekende,
  timing-gevoelige Undead-scripts krijgt één herkansing. Twee keer rood is
  een echte fout.

### Lessen uit de CI-reparaties (D87, Undead CI-onderhoud) — houd je hieraan
- **Nooit een vaste wachttijd op speltijd.** De simulatie kapt `dt` op
  0,05 s per frame. Headless loopt de speltijd daardoor op ~0,35 (lokaal)
  tot nog minder (CI) speltijd-seconde per echte seconde. Poll op de
  toestand, met een ruime deadline of een voortgangsdeadline ("wacht zolang
  de timer nog daalt").
- **De headless shell van CI gedraagt zich anders:**
  - een echte Wake Lock wordt altijd geweigerd;
  - `requestFullscreen` lukt echt, en daarna weigert `setViewportSize`.

  Boots beide na met `initScript`.
- **Laadtijd** is in CI trager: `test-dnm-prestaties` heeft een eigen
  budget als `process.env.CI` gezet is.
- **Geen sessiepaden in tests** (zoals `/tmp/claude-0/…`): schrijf naar
  `os.tmpdir()`.
- **Toeval in de game:** ondoden krijgen ook met vaste traits nog een
  willekeurige schaal. Richt in een test dus op de borst, niet op de rand
  van het hoofd (T120: de hitboxen staan op `ONDODE_HITBOX_LAYER`; een
  eigen raycaster moet die laag aanzetten).
- **Screenshots vergelijken:** doe eerst een ongemeten opwarmronde (met
  screenshot), want een lazy shader-compile kan anders tussen twee metingen
  landen.
- **Hints in DNM wachten op de wavebanner** (D71): verberg de banner eerst
  (`d.verbergWaveBanner()`) als een test een hint wil zien.
- **Aanpak van een flake:**
  1. Draai het script los opnieuw, een paar keer en met beide browsers.
  2. Zoek de oorzaak met diagnose in de check-details (toestand, posities,
     timers).
  3. Repareer de test, niet de game, tenzij de game echt fout zit.
  4. Noteer het in de roadmap van die game.

  Een script alleen in `HERKANSING` zetten is een laatste redmiddel.

---

## 8. Technische valkuilen per game

### Gedeeld
- Key-handlers voor actietoetsen: altijd `!e.repeat` plus de
  besturingscheck (het T/X-patroon).
- **Botsing:** gaat via expliciete rechthoeken met
  `registreerRechthoek(minX, maxX, minZ, maxZ, marge)`, in beide games. Geen
  bounding box van het decor afleiden: die groeit mee met uitstekende delen.
  In DNM geeft `registreerRechthoek` een handle terug; weghalen (toren
  verkocht, hek gesneuveld) gaat alleen via `verwijderObstakel(handle)`.
- Bij een test zonder render ertussen: `updateMatrixWorld(true)` op camera en
  doel, anders rekent een raycast met verouderde matrices.

### Defend National Monument
- **De besturingsgate is `besturingActief()`** (D81), niet meer pointer lock.
  - In de muismodus is het `document.pointerLockElement ===
    renderer.domElement`; in de touchmodus `touchSessieActief`.
  - Starten en pauzeren gaan via `startBesturing()` / `verlaatBesturing()`,
    nooit rechtstreeks via `requestPointerLock`.
  - Details staan in ARCHITECTURE_NOTES §15.21.
- **Touch:**
  - `<html>` krijgt de classes `touchModus`, `speelt` en `menuOpen`.
  - Interactieve elementen hebben `data-touch-eigen`; de rest van de HUD
    heeft op touch `pointer-events: none`.
  - Toetsteksten gaan door `voorInvoer()`, hints door de vervangingen in
    `toonHint()`.
  - Een HUD-wijziging moet overlapvrij blijven op 667×375, 844×390, 932×430
    en 1024×768 (`test-dnm-mobiel`).
- **Kwaliteit:** `KWALITEIT_PRESETS` laag/normaal/hoog; zonder eigen keuze
  overal `hoog` (D90). De stand wordt bij het laden gelezen, vóór de
  renderer bestaat (anti-aliasing kan alleen bij het aanmaken).
- **Commandopost:** 1 vuurtempo, 2 loopsnelheid, 3 koeling, 4 repareren,
  5 zware kogels. Munten raap je op binnen `MUNT_PICKUP_STRAAL = 1.4` m.
- **De kaart** komt uit `DAM_LAYOUT`, dat afgeleid is van `PLATTEGROND.html`
  (fase M).
- **Balans** wordt gemeten met `meet-dnm-run.mjs` (hele runs met een
  trefkans), `meet-dnm-bazen.mjs` en `meet-dnm-economie.mjs`, niet geschat.

### Amsterdam Undead
- **Besturingsgate** losgekoppeld van pointer lock in T176, met touch in
  T177–T179.
- **Kwaliteit:** `hoog` is de referentiestand waarop alle visuele basislijnen
  gemeten zijn. `openVoorVisueleMeting()` zet hem daarom expliciet op hoog
  en bevriest de tijd (`visueleBevriesTijd`).
- **Het archief** (twee valuta, winkel en itemcatalogus) loopt tussen runs
  door, zie T160–T169. Opslag gaat altijd via try/catch: localStorage kan
  ontbreken of kapot zijn.
- Lees `ARCHITECTURE_NOTES_undead.md` vóór je aan systemen komt: daar staan
  de invarianten (hot-path-regels zonder allocaties, de spelActief-tak
  tegenover de cosmetische tak van de gameLoop, enz.).

---

## 9. Wat er nog ligt

**Voor de eigenaar (speeltests van DNM):**
- **M5:** speeltest na D67–D80. De vragen staan in `ROADMAP_monument.md`
  onder D70 en D80.
- **M6:** speeltest op de iPhone. Zeven vragen staan onder D86; vraag 7
  (soepel of haperend) gaat sinds D90 over Hoog.

**Aangeboden, nog niet besloten:**
- **Verouderde labels in `ROADMAP_undead.md`:** Tickets 30–39 staan op
  "Status: open" en de rondes v0.20/v0.21 heten "gepland, nog NIET
  geïmplementeerd". Dat werk zit al in de game; alleen de labels lopen
  achter.
- **Taal op `index.html`:** de ondertitel ("Two browser games set in
  Amsterdam") en de eerste zin op de Undead-kaart zijn Engels, de rest
  Nederlands. Welke taal het wordt, is aan de eigenaar.

**Bekend, klein:**
- In `ROADMAP_monument.md` is "Waar de game nu staat" (bovenaan) verouderd: er
  staat nog v4, 3.518 regels en 0 testscripts.
- `tests/README.md` is deels nog alleen op Undead geschreven.
- Undead T180 (prestaties op een telefoon) staat op ⚠️: deel A is alleen op
  een echt toestel te meten.

**Backlog:** DNM heeft geen open tickets. Undead heeft alleen
"Later (na v1, alleen indien gewenst)": meer kamers, ondoodtypes en
upgrades. Pas aan een gedeelde engine denken als beide games stabiel zijn.

---

## 10. Checklist per ticket

1. Lees de relevante sectie in de roadmap en ARCHITECTURE_NOTES van die game.
2. Wijzig alleen dat ene game-bestand (plus tests en docs van die game).
3. Laadcheck: geen console errors (elk testscript meldt
   `console errors: geen`).
4. Draai de relevante tests. Een nieuw gedrag krijgt een check, en controleer
   dat de check op de oude code faalt.
5. Schrijf het verslag in de roadmap van die game, plus README of
   ARCHITECTURE_NOTES als dat nodig is.
6. Commit (Nederlands, met ticketnummer) en push naar de werkbranch.
7. Meld de eigenaar kort wat er voor de speler verandert, wat niet getest is,
   en vraag of het naar main mag.
