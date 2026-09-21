# SONNET_EXECUTION_PLAN_national-monument.md — Defend National Monument

Handoff van architect naar uitvoerder, voor `defend-national-monument.html`.
Dit document staat volledig los van `SONNET_EXECUTION_PLAN.md` (dat gaat over
Amsterdam Undead). **Ticketnummers in dit bestand dragen een `D`-prefix**
(D1, D2, …) zodat ze nooit te verwarren zijn met de Undead-tickets in
`ROADMAP.md`.

---

## 1. Waar deze game vandaan komt

`defend-national-monument.html` is de oorspronkelijke game van dit project:
een first-person arcade-shooter op de Dam in Amsterdam, waarin je het
Nationaal Monument verdedigt tegen golven robots. Eén bestand, Three.js via
CDN-importmap, geen build-stap, geen assets — dezelfde technische regels als
Undead.

**De game is sinds de splitsing niet meer aangeraakt.** Undead groeide in die
tijd van 0 naar 19.741 regels en 116 testbestanden; deze game staat nog op
3.518 regels en **nul tests**. De opmerking in `CLAUDE.md` over "de bestaande
regressiesuite voor Defend National Monument" klopt niet meer: die suite
bestaat niet, alle 116 testbestanden richten zich op Undead.

### Wat er nu in zit (gemeten, niet geschat)

| Systeem | Staat |
|---|---|
| Wereld | De Dam: Paleis, Nieuwe Kerk, Monument, Bijenkorf, Krasnapolsky, gevelrijen, trams, duiven, toeristen |
| Kaart | `GRENS` 283 × 224 m, grondvlak 620 × 620 |
| Speler | 7 m/s, ooghoogte 1,7, straal 0,4 |
| Wapen | Eén hitscan-geweer, `raycaster.far = 150`, cooldown 0,26 s → 0,07 s met upgrades, **geen munitie, geen herladen** |
| Vijanden | 5 types (`normal`/`sprinter`/`tank`/`bomber`/`shieldbot`), lopen rechtstreeks op het monument af |
| Golven | `waveDoel = 7 + wave·3`, `maxActieveRobots = min(5 + wave·0,65, 13)` |
| Monument | 100 HP, schade 8/10/25 per robottype, game over bij 0 |
| Economie | Munten €5–25 per kill (×multipliers, plafond €150), wave-bonus €40 + wave·15, perfecte-wave-bonus €50 + wave·10 |
| Upgrades | 3 stuks (vuurtempo/pickup/snelheid), resetten elke run |
| Steunpunten | Kerkklok Boost, Koninklijke Reparatie (€100, +25 HP), Bijenkorf Upgrades |
| Extra's | Combo-meter, special-meter (X), perfecte-wave-bonus, hitmarker, brokstukken |
| Game over | Eén regel tekst: *"Refresh om opnieuw te spelen."* |

---

## 2. De diagnose

Alles hieronder is gemeten in de code, niet aangevoeld.

### 2.1 De kaart is te groot — en dat is een gameplayprobleem, geen smaakkwestie

| Poort | Afstand tot monument | Robot-looptijd (1,5–3,2 m/s) |
|---|---|---|
| Damstraat | 81 m | 25–54 s |
| Damrak | 110 m | 34–74 s |
| Rokin | 108 m | 34–72 s |
| Kalverstraat | 136 m | 43–91 s |
| Nieuwendijk | 139 m | 43–**92 s** |

Een trage robot uit Kalverstraat loopt **anderhalve minuut** voordat hij iets
doet. Dat is geen opbouw van spanning, dat is wachttijd.

Erger: van de drie steunpunten liggen er twee op 112–114 m van het monument.
Eén reparatie kost **32 seconden heen-en-terug** — in die tijd lopen er bij
`maxActieveRobots` 5 tot 13 robots binnen. Die twee punten zijn tijdens een
wave dus feitelijk onbruikbaar; ze bestaan alleen op papier.

De lange as van de kaart doorkruisen kost de speler 40 s. Je kunt de vijf
poorten dus niet dekken, en je kunt er ook niet zinnig tussen kiezen — je
staat gewoon bij het monument te wachten.

### 2.2 Er zit geen ritme in het schieten

Eén wapen, hitscan, one-shot voor vier van de vijf types, geen munitie, geen
herladen, geen wisselen. Je houdt de linkermuisknop ingedrukt en dat is het.
Er is nooit een moment waarop je iets anders moet doen dan richten.

### 2.3 Het monument is decor

Je "verdedigt" het, maar het is een getal in de HUD. Geen zichtbare
schadestaten, geen eigen rol in het gevecht, geen reden om er in de buurt te
zijn behalve dat robots daarheen lopen.

### 2.4 Er zijn geen ruimtelijke beslissingen

Vijf poorten, en je kunt er niets mee: niet afsluiten, niet versterken, niet
bewaken. De enige keuze in het hele spel is "waar sta ik", en omdat de kaart
te groot is, is het antwoord altijd "bij het monument".

### 2.5 De run heeft geen staart

Game over is één regel tekst met de instructie om te verversen. Geen
eindscherm, geen statistieken, geen highscore, geen knop. Vergelijk Undead:
volledig eindscherm met score, kills, headshots, trefferpercentage, record en
een Opnieuw-knop.

### 2.6 Nul testdekking

116 testbestanden, allemaal voor Undead. Elke wijziging in deze game is nu
gokwerk, en dit plan bevat een herschaling die letterlijk elke coördinaat
raakt. Dit moet als eerste opgelost, niet als laatste.

### 2.7 Robot-AI is één regel met pleisters

Robots lopen rechtstreeks op het monument af. Vastlopen wordt opgevangen met
`vastTijd`/`ontwijkTimer` (tijdelijk zijwaarts uitwijken) en één hardgecodeerd
`tussenpunt` voor de Kalverstraat-poort. Undead heeft hiervoor een
waypoint-navigatiegraaf.

---

## 3. De gekozen richting

Acht beslissingen, allemaal expliciet door de eigenaar gemaakt:

| # | Keuze | Besluit |
|---|---|---|
| 1 | Schaal | **1:3 op de afstanden, gebouwen bijna op hoogte** |
| 2 | Speltype | **Tower defense hybride** |
| 3 | Combat | **Oververhitting in plaats van munitie** |
| 4 | Mapstructuur | **Alleen de documenten sorteren**, HTML blijft op de root |
| 5 | Bouwen | **Vaste bouwplekken bij de poorten** |
| 6 | Runstructuur | **Arcade + eindscherm + highscore** (geen meta-progressie) |
| 7 | Pariteit | **Testsuite + mobiel/touch + kwaliteitsinstellingen** |
| 8 | Omvang | **Volledig plan, gefaseerd**, met beslismomenten per fase |

### Bewust NIET in dit plan

- **Audio-overhaul.** De eigenaar heeft deze bewust niet aangevinkt. De zes
  hardgecodeerde `piep()`-geluiden blijven zoals ze zijn. Nieuwe systemen
  (torens, oververhitting) krijgen wél geluid, maar via diezelfde bestaande
  `piep()`-helper — geen audioregistry, geen ruislaag, geen `AUDIO.md`-port.
- **Meta-progressie.** Geen Stadsarchief-equivalent. Elke run staat op
  zichzelf; alleen de highscore blijft bewaard.
- **Waypoint-navigatiegraaf.** De bestaande rechtstreekse route blijft. Als na
  de herschaling blijkt dat robots vastlopen in de smallere straten, staat
  daar in D6 een meetpunt voor — dan pas beslissen, niet nu vooruit bouwen.
- **Verplaatsen van de HTML-bestanden.** De live-URL's blijven werken.

---

## 4. Architectuurregels (hard)

1. Alles blijft in `defend-national-monument.html` — single-file, geen
   frameworks, geen assets, alleen Three.js-geometrie en Web Audio via de
   bestaande `piep()`.
2. **`amsterdam-undead.html` en `index.html` NIET aanraken.** Hergebruik uit
   Undead gaat via *kopiëren en aanpassen*, nooit via gedeelde bestanden.
3. IP-regels uit `CLAUDE.md` gelden onverkort: geen bestaande gamenamen,
   geen nazi-symboliek, alles origineel. De bestaande namen (Kerkklok Boost,
   Koninklijke Reparatie, Bijenkorf Upgrades) blijven.
4. Debug-hook: alles testbaars exporteren op **`window.DefendDebug`**
   (getters/setters voor `let`-variabelen). Eén global, geen tweede.
5. Balansconstanten bovenaan hun blok met een comment dat uitlegt *waarom*
   die waarde. Geen magic numbers diep in functies.
6. Elke wijziging: eerst headless load-check (geen console errors), dan de
   relevante tests, dan pas klaar melden.
7. **Commit/push alleen op expliciet verzoek van de eigenaar.**

## 5. Wat je WEL doet

- Eén ticket per keer, in de fasevolgorde hieronder.
- Minimale diff per ticket; bestaand gedrag behouden tenzij het ticket het
  expliciet verandert.
- Tests die door de wijziging van verwachting veranderen: in **hetzelfde**
  ticket bijwerken, met een comment dat uitlegt waaróm de verwachting
  verschuift.
- Debug-exports bijwerken bij elke nieuwe state.
- Bij twijfel over een balansgetal: meten, dan pas kiezen.

## 6. Wat je NIET doet

- Geen tickets combineren of vooruitwerken ("nu ik hier toch ben…").
- Geen refactors buiten de ticketscope.
- Geen nieuwe dependencies, textures, modellen of audiobestanden.
- **D4 (de herschaling) nooit tegelijk met iets anders uitvoeren.**

---

## 7. Testinfrastructuur — die bestaat nog niet

De bestaande `tests/`-map werkt uitsluitend met Undead: `helpers.mjs` heeft
één hardgecodeerde `GAME_PATH` naar `amsterdam-undead.html`, en `run-all.mjs`
pakt alles op wat `test-*.mjs` heet.

**Aanpak (D1):** naast `helpers.mjs` komt `helpers-defend.mjs`, met dezelfde
opzet (lokale Chromium op `/opt/pw-browsers/chromium` met CI-terugval, de
CDN-intercept die Three.js lokaal serveert, pointer-lock-simulatie) maar met
`defend-national-monument.html` als doel. Testbestanden krijgen het prefix
`test-dnm-*.mjs` zodat ze in dezelfde map kunnen staan en automatisch door
`run-all.mjs` worden opgepakt, zonder dat er twee runners hoeven te bestaan.

De CI-workflow (`.github/workflows/tests.yml`) draait `run-all.mjs` al op
elke push en hoeft dus niet te veranderen.

---

# FASE 0 — Fundament

*Doel: kunnen meten en kunnen terugvallen, vóórdat er één coördinaat
verschuift. Zonder deze fase is de herschaling in fase 1 blind werk.*

### Ticket D1 — Testinfrastructuur en debug-hooks
- **Context:** er is geen enkele test en geen enkele debug-export. Niets in
  deze game is van buitenaf inspecteerbaar.
- **Doel:** `window.DefendDebug` met alles wat de latere tickets nodig hebben,
  plus `tests/helpers-defend.mjs` en een eerste rooktest.
- **Stappen:**
  - Debug-object aan het eind van de module, met minimaal: `scene`, `camera`,
    `speler`, `spel`, `upgrades`, `robots`, `obstakels`, `munten`,
    `interactiePunten`, `GRENS`, `MONUMENT_POSITIE`, `MONUMENT_BOX`,
    `SPAWN_POORTEN`, `ROBOT_TYPES`, `afstandTotMonument`, `isVrijePlek`,
    `losBotsingenOp`, `spawnRobot`, `spawnRobotVanafPoort`, `startWave`,
    `updateWaveSysteem`, `updateRobots`, `schiet`, `raakRobot`,
    `vernietigRobot`, `robotRaaktMonument`, `koopUpgrade`, `upgradeKosten`,
    `legMuntNeer`, `updateInteracties`, `activeerHuidigeInteractie`, `geld`
    (getter+setter), `klok` (getter).
  - `tests/helpers-defend.mjs`: kopie van `helpers.mjs` met `GAME_PATH` naar
    `defend-national-monument.html`, `openDefend({ simuleerPointerLock })` en
    dezelfde `makeChecker()`/`frames()`-helpers. Hergebruik de bestaande
    browser-cache-global zodat `run-all.mjs` niet trager wordt.
  - `tests/test-dnm-laadt.mjs`: de game laadt zonder console-errors, de
    wereld is gebouwd (`obstakels.length > 0`), wave 1 staat klaar, het
    monument staat op 100 HP.
- **Niet veranderen:** geen gameplay, geen enkele constante.
- **Acceptatie:** `node test-dnm-laadt.mjs` groen, `run-all.mjs` pakt het
  bestand automatisch op, Undead-tests ongewijzigd groen.

### Ticket D2 — Gedragstests die een herschaling overleven
- **Context:** D4 verschuift elke coördinaat. Tests die absolute posities
  vastleggen zijn dan waardeloos; tests die *relaties* vastleggen niet.
- **Doel:** een vangnet dat de herschaling kan betrappen op echte fouten,
  zonder bij elke coördinaatwijziging om te vallen.
- **Stappen:** `tests/test-dnm-kern.mjs` met checks die in **verhoudingen**
  denken, niet in absolute meters:
  - Elke poort in `SPAWN_POORTEN` ligt binnen `GRENS`.
  - Elk interactiepunt ligt binnen `GRENS` en op een vrije plek.
  - Een robot die vanaf elke poort simuleert (kleine stappen richting
    monument, `losBotsingenOp` per stap) bereikt het monument binnen een
    ruime stappenlimiet — dit is de vastloper-detector.
  - Een tank (`schaal` 1,4) haalt dezelfde route: zelfde test met de grotere
    botsstraal, want dat is het type dat als eerste klem komt te zitten.
  - `startWave(n)` zet `waveDoel`/`maxActieveRobots` volgens de formule, voor
    n = 1, 5, 10, 20.
  - `robotRaaktMonument()` trekt exact `monumentSchade` af en zet de combo op
    0; bij HP ≤ 0 volgt `gameOver`.
- **Niet veranderen:** geen gameplay.
- **Acceptatie:** alle checks groen op de HUIDIGE schaal. Deze test is de
  referentie waartegen D4 straks wordt afgezet.

### Ticket D3 — Documenten sorteren
- **Context:** tien markdown-documenten staan door elkaar op de root, en
  vrijwel alle inhoud gaat over Undead. Alleen dit plan gaat over deze game.
- **Doel:** scheiding zonder de live-URL's te breken.
- **Stappen:**
  - `docs/amsterdam-undead/`: `ROADMAP.md`, `SONNET_EXECUTION_PLAN.md`,
    `ARCHITECTURE_NOTES.md`, `AUDIO.md`, `FINALE.md`, `GUNFEEL.md`,
    `TIERVISUALS.md`, `VISUEEL.md`, `ZOMBIE_V2_BASELINE.md`,
    `PERFORMANCE_AUDIT.md`, `IDEEEN.md`.
  - `docs/defend-national-monument/`: dit plan.
  - `CLAUDE.md` en `README.md` blijven op de root (projectbreed).
  - **De twee HTML-bestanden en `index.html` blijven staan** — de live-URL's
    veranderen niet.
  - Verwijzingen bijwerken: `git grep -n "ROADMAP.md\|ARCHITECTURE_NOTES.md"`
    over alle `.md`-bestanden én de HTML-comments.
  - `CLAUDE.md`: de bestandsstructuur-sectie bijwerken, en de onjuiste zin
    over "de bestaande regressiesuite voor Defend National Monument"
    corrigeren — die suite bestaat niet, D1/D2 bouwen hem.
- **Let op:** `git mv` gebruiken zodat de geschiedenis meeverhuist.
- **Acceptatie:** `run-all.mjs` groen, `index.html` werkt, geen dode
  verwijzingen (`git grep` op de oude paden geeft niets).

---

# FASE 1 — De arena op maat

*Doel: de kaart speelbaar maken. Dit is de wijziging met de grootste
gevoelsimpact van het hele plan, en de enige die elke coördinaat raakt.*

### Ticket D4 — Schaalfundament (VOORZICHTIG, nooit combineren)
- **Context:** `GRENS` is 283 × 224 m. Alle wereldgeometrie staat met
  hardgecodeerde coördinaten in `bouwKoninklijkPaleis()`, `bouwNieuweKerk()`,
  `plaatsGevelrij()` en ~30 andere bouwfuncties.
- **Doel:** afstanden ×1/3, gebouwen bijna op hoogte.
- **Technische meevaller:** `registreerObstakel()` gebruikt
  `object.updateWorldMatrix(true, true)` + `Box3().setFromObject(object)` —
  dat leest **wereld**-coördinaten. Zet je `wereld.scale` vóórdat de
  geometrie geregistreerd wordt, dan komen die 10 botsboxen automatisch goed
  mee. De 10 `registreerRechthoek()`-calls rekenen met rauwe getallen en
  moeten wél met de hand mee.
- **Stappen:**
  - Drie constanten bovenaan het wereldblok, elk met comment:
    - `ARENA_SCHAAL = 1/3` — alle x/z-posities en gebouwvoetafdrukken.
    - `GEBOUW_HOOGTE_SCHAAL = 0,6` — alleen hoogtes.
    - `MONUMENT_HOOGTE_SCHAAL = 0,8` — het monument krimpt minder, want het
      moet het visuele anker van de arena blijven.
  - **Waarom niet één factor:** bij ×1/3 over alles wordt het Paleis (22 m)
    7,3 m en de monumentpyloon (22 m) óók 7,3 m, terwijl robots 1,9 m blijven.
    Dan speel je in een poppenhuis en is het monument een tuinornament. Bij
    hoogte ×0,6 wordt het Paleis 13,2 m en de pyloon (×0,8) 17,6 m: de arena
    blijft omsloten en het monument blijft torenen.
  - Toepassen op: grondvlak (620 → 207), `damPleinPunten`, alle bouwfuncties,
    `plaatsGevelrij`, straatmeubilair, railpad, tramroute, zebrapaden.
  - De 10 `registreerRechthoek()`-calls handmatig ×`ARENA_SCHAAL`.
  - `GRENS` ×`ARENA_SCHAAL` → ongeveer `{ minX: -39,3, maxX: 55, minZ: -39,3,
    maxZ: 35,3 }` (94 × 75 m).
- **Niet veranderen:** `speler.hoogte` (1,7), `speler.straal` (0,4),
  robotafmetingen en `ROBOT_TYPES.schaal`, robotsnelheden. Juist dóórdat die
  gelijk blijven, worden de looptijden 3× korter — dat is het hele punt.
- **Risico dat je expliciet moet controleren:** straten krimpen óók 3×. Een
  straat van 8 m wordt 2,7 m, en een tank heeft een botsstraal van ~0,5 m.
  Als een corridor te smal wordt, lopen robots klem. D2's route-test met de
  tank is precies daarvoor gebouwd — die moet groen blijven.
- **Acceptatie:** D2 volledig groen (met name de route- en tank-tests), geen
  console-errors, en een screenshot per windrichting ter visuele controle.

### Ticket D5 — Spelsystemen herijken op de nieuwe schaal
- **Context:** buiten `wereld` staan losse wereldcoördinaten die D4 niet
  raakt.
- **Doel:** alles wat in meters denkt meeschalen, en wat dat niet moet
  expliciet met rust laten.
- **Stappen:**
  - `MONUMENT_POSITIE` (42, −4) en `MONUMENT_BOX` (±10,7) ×`ARENA_SCHAAL`.
  - Alle vijf `SPAWN_POORTEN` (positie, `spreidingX`, `spreidingZ`,
    `tussenpunt`) ×`ARENA_SCHAAL`.
  - De drie `interactiePunten`-posities ×`ARENA_SCHAAL`; `radius` (4) blijft
    óngeschaald — dat is een interactieafstand op mensenmaat, geen
    wereldafstand. Controleer wel dat 4 m in de nieuwe arena niet
    onbedoeld twee punten laat overlappen.
  - `speler.positie` (startplek) ×`ARENA_SCHAAL`.
  - `raycaster.far`: 150 → 55. Op de oude schaal was 150 m ruim de halve
    kaart; op de nieuwe zou het de hele arena plus de skybox raken.
  - De aankomstdrempel `afstandTotMonument(...) < 0,6` blijft 0,6 — dat is
    een contactafstand, geen wereldafstand.
  - `willekeurigePlek(minAfstand)` en `isVrijePlek(x, z, marge)`: de
    marges blijven, de aanroepende afstanden schalen mee.
- **Niet veranderen:** muntwaarden, HP, schade, wave-formules. Die komen in
  D6 aan de beurt, ná de meting.
- **Acceptatie:** D2 groen, een robot uit elke poort bereikt het monument, de
  speler start op een vrije plek, alle drie de interactiepunten zijn
  bereikbaar.

### Ticket D6 — Meten en bijstellen
- **Context:** D4 en D5 zijn gebouwd op een berekening. Of het *speelt* is
  daarmee nog niet bewezen.
- **Doel:** de looptijden verifiëren tegen de ontwerpdoelen en bijstellen wat
  ernaast zit.
- **Ontwerpdoelen (waartegen je meet):**
  - Robot van poort naar monument: **15–25 s** voor de dichtstbijzijnde poort,
    tot ~35 s voor de verste. Korter dan 10 s betekent dat je niet kunt
    reageren; langer dan 40 s is weer wachttijd.
  - Speler kruist de lange as: **10–15 s**.
  - Steunpunt heen-en-terug: **10–15 s** — een echte afweging, geen
    onmogelijkheid.
- **Stappen:** `tests/meet-dnm-afstanden.mjs` (meetscript, géén `test-`
  prefix, zelfde conventie als `meet-*.mjs` bij Undead) dat per poort de
  afstand en de looptijd bij minimum- en maximumsnelheid print, plus de
  speler-doorkruistijd en de drie steunpunt-trips. Daarna: alleen bijstellen
  wat buiten het doelvenster valt, en per bijstelling noteren waaróm.
- **Mogelijke uitkomsten om op voor te bereiden:** als de dichtstbijzijnde
  poort onder de 10 s zakt, verplaats die poort naar buiten in plaats van de
  robots trager te maken — snelheid is gevoel, afstand is pacing.
- **Acceptatie:** het meetscript draait en de uitkomsten staan in dit
  document onder D6 genoteerd. Dit ticket is pas af als de eigenaar het
  gespeeld heeft.

---

# FASE 2 — De run krijgt een kop en een staart

*Doel: het grootste polijstgat dichten. Klein werk, groot effect — en het
maakt alle latere balansfases meetbaar, want je ziet eindelijk hoe een run
afliep.*

### Ticket D7 — Eindscherm met statistieken
- **Context:** game over is nu `objectiveUI.textContent = 'Game over, het
  Monument is gevallen. Refresh om opnieuw te spelen.'` Verder gebeurt er
  niets: de gameloop draait door, robots blijven staan.
- **Doel:** een echt eindscherm, in de stijl van het bestaande startscherm.
- **Stappen:**
  - Run-statistieken bijhouden in een `runStats`-object: kills (per type),
    schoten, treffers, verdiend geld, hoogste combo, hoogste wave, gebouwde
    torens (leeg tot fase 3), speelduur.
  - `toonEindscherm()`: overlay met wave, score, kills, trefferpercentage,
    verdiend geld en hoogste combo.
  - Pointer lock loslaten; de gameloop bevriezen zoals de bestaande
    pauze-gate dat al doet.
  - `spel.gameOver` blijft de bron van waarheid.
- **Niet veranderen:** de bestaande game-over-banner mag weg zodra het
  scherm er is; `objectiveUI` blijft voor de lopende run.
- **Acceptatie:** `test-dnm-eindscherm.mjs`: monument naar 0 HP → scherm
  zichtbaar, statistieken kloppen met de gesimuleerde run, gameloop staat
  stil (robots bewegen niet meer).

### Ticket D8 — Highscore
- **Context:** geen enkele vorm van opslag.
- **Doel:** één bewaard record, met hetzelfde veilige-terugval-patroon als
  Undead gebruikt (`leesHighscore()`/`schrijfHighscore()` met vormvalidatie).
- **Stappen:**
  - Sleutel `defendNationalMonumentHighscore`, waarde
    `{ score, wave, datum }`.
  - Lezen met try/catch en vormvalidatie: een corrupte of onbekende waarde
    mag het spel nooit breken, die valt stil terug op "geen record".
  - Op het eindscherm: "NIEUW RECORD!" of "Record: N".
- **Acceptatie:** `test-dnm-highscore.mjs`: schrijven/teruglezen, corrupte
  waarde, geweigerde localStorage (privacymodus) — geen van drieën crasht.

### Ticket D9 — Opnieuw spelen zonder verversen
- **Context:** de enige manier om opnieuw te beginnen is F5.
- **Doel:** een Opnieuw-knop die de hele runstaat terugzet.
- **Stappen:** `resetRun()` die alle robots/munten/brokstukken opruimt,
  `spel`, `upgrades`, `geld`, `runStats`, de combo/special-meters, de
  kerkklok-cooldown en (later) de torens terugzet naar hun beginwaarde, en
  `startWave(1)` aanroept.
- **Let op:** dit is precies het soort functie waar state-lekken zich
  verstoppen. De test moet daarom een volledige run simuleren, resetten, en
  dan **elke** geëxporteerde teller vergelijken met de beginwaarde.
- **Acceptatie:** `test-dnm-reset.mjs` met die volledige vergelijking.

---

# FASE 3 — De tower defense-kern

*Doel: de vijf poorten betekenis geven. Dit is de grootste fase en de
inhoudelijke kern van de verbouwing.*

### Ticket D10 — Bouwplekken
- **Context:** er is nog geen enkel bouwsysteem.
- **Doel:** vaste sokkels bij de poorten, zichtbaar en aanspreekbaar.
- **Ontwerp:** 5 poorten × 2 sokkels = 10 bouwplekken, geplaatst in de
  aanloopcorridor van hun eigen poort — niet rond het monument. Dat is wat
  poortkeuze betekenisvol maakt: een toren dekt één route, niet alles.
- **Stappen:**
  - `BOUWPLEKKEN`-dataset: positie (afgeleid van de poortpositie en het
    tussenpunt richting monument), bijbehorende poortnaam, `toren: null`.
  - Visualisatie: een gemarkeerde vloertegel met een lage rand; leeg = een
    zwak pulserend kader in de poortkleur.
  - Elk plek wordt een interactiepunt via het bestaande `interactiePunten`-
    mechanisme, zodat T en de bestaande prompt-UI gewoon werken.
- **Niet veranderen:** het interactiesysteem zelf.
- **Acceptatie:** `test-dnm-bouwplekken.mjs`: 10 plekken, allemaal binnen
  `GRENS`, allemaal op een vrije plek, geen enkele binnen de monument-box,
  en elke plek ligt dichter bij zijn eigen poort dan bij elke andere.

### Ticket D11 — De geschuttoren
- **Doel:** de eerste en belangrijkste toren: schiet automatisch op robots
  binnen bereik.
- **Stappen:**
  - `TOREN_TYPES.geschut`: `prijs`, `bereik`, `schadePerSchot`,
    `schotInterval`, `hp`.
  - Bouwmenu: T op een lege plek opent een compact paneel met 1/2/3, exact
    hetzelfde patroon als de bestaande `bijenkorfShopOpen` + `Digit1/2/3`.
    Geen nieuwe UI-laag, geen bouwmodus.
  - `updateTorens(dt)`: zoekt het dichtstbijzijnde doel binnen bereik, vuurt
    op interval, tekent een kort schotlijntje, hergebruikt `raakRobot()`.
  - Toren draait zijn loop naar het doel — dat is de goedkoopste manier om
    hem levend te laten ogen.
- **Balans-startpunt (te ijken in D16):** €120, bereik 12 m, 1 schade per
  0,8 s, 60 HP.
- **Acceptatie:** `test-dnm-toren-geschut.mjs`: koopt met genoeg/te weinig
  geld, schiet alleen binnen bereik, raakt het dichtstbijzijnde doel,
  respecteert het interval, en doodt een normale robot in het verwachte
  aantal schoten.

### Ticket D12 — Torenniveaus en reparatie
- **Doel:** een toren is geen eenmalige aankoop maar een investering.
- **Stappen:**
  - Drie niveaus per toren, met oplopende prijs en effect (`bereik`,
    `schadePerSchot`, `hp`), zichtbaar aan een extra ring/segment op het
    model.
  - T op een bezette plek: upgraden, of repareren als de HP onder het maximum
    staat (kosten evenredig aan de ontbrekende HP).
  - Verkopen tegen een deel van de investering, zodat een verkeerde poortkeuze
    niet permanent is.
- **Acceptatie:** `test-dnm-toren-niveaus.mjs`: prijsformule, effect per
  niveau, reparatiekosten evenredig, verkoopopbrengst, en dat niveau 3 niet
  verder kan.

### Ticket D13 — Het hek
- **Doel:** een tweede toren met een compleet ander karakter: hij schiet
  niet, hij kóópt tijd.
- **Stappen:**
  - `TOREN_TYPES.hek`: blokkeert de corridor fysiek (eigen obstakel-
    registratie), heeft HP, en robots die er tegenaan lopen slaan erop in
    plaats van door te lopen.
  - Robot-gedrag: binnen aanvalsbereik van een hek → stilstaan en slaan,
    met een zichtbare slaganimatie en hekschade per tik.
  - Als het hek sneuvelt: obstakel deregistreren, robots lopen door.
- **Let op:** het obstakel moet écht uit `obstakels` verdwijnen, anders blijft
  er een onzichtbare muur staan. Dat is precies de fout die een test moet
  vangen.
- **Acceptatie:** `test-dnm-hek.mjs`: robot stopt bij het hek, hek verliest
  HP, bij 0 HP verdwijnt zowel het model als het obstakel, en een robot die
  daarna langskomt loopt ongehinderd door.

### Ticket D14 — Robots vallen torens aan
- **Context:** zonder dit zijn torens gratis. Een toren die nooit kapot kan,
  verandert het spel in wachten.
- **Doel:** torens onder druk zetten, en de bestaande `bomber` eindelijk een
  eigen rol geven.
- **Stappen:**
  - `bomber` krijgt torens als primair doel binnen een bepaalde straal, en
    doet bij aankomst zware schade aan de toren in plaats van aan het
    monument.
  - Andere types blijven op het monument gericht, maar halen uit naar een
    hek dat hun route blokkeert (D13).
  - Toren vernietigd: brokstukken via de bestaande `maakBrokstuk()`, plek
    komt weer vrij.
- **Acceptatie:** `test-dnm-toren-aanval.mjs`: een bomber kiest een toren
  binnen straal, doet er schade aan, en de plek is na vernietiging weer
  bebouwbaar.

### Ticket D15 — Bouwfase tussen waves
- **Context:** `spel.tussenWaveTimer > 4.5` start nu automatisch de volgende
  wave. Met torens erbij is 4,5 s te kort om een beslissing te nemen.
- **Doel:** een expliciete voorbereidingsfase.
- **Stappen:**
  - Pauze tussen waves naar ~20 s, met een aftelling in de HUD en een
    duidelijke "Wave N start over …"-regel.
  - Een manier om de wave vroeg te starten (toets), met een bonus als beloning
    voor het risico — dat houdt het tempo hoog voor wie snel wil.
  - Tijdens de bouwfase spawnen er geen robots.
- **Acceptatie:** `test-dnm-bouwfase.mjs`: geen spawns tijdens de fase, de
  aftelling loopt, vroeg starten werkt en geeft de bonus.

### Ticket D16 — Economie herijken
- **Context:** de huidige economie (munten €5–25, wave-bonus €40 + wave·15)
  is gekalibreerd op een spel zónder torens. Met torens erbij is geld
  opeens de centrale keuze: wapen-upgrade of verdediging?
- **Doel:** één afgestemde curve, gemeten in plaats van gegokt.
- **Stappen:** `tests/meet-dnm-economie.mjs` simuleert 20 waves en print per
  wave: inkomsten, wat je ervan kon bouwen, en hoeveel torens je nodig had om
  de wave zonder monumentschade door te komen. Daarna pas bijstellen.
- **Ontwerpdoel:** rond wave 5 moet de speler ongeveer één poort volledig
  hebben kunnen uitrusten, niet alle vijf. De schaarste ís de keuze.
- **Acceptatie:** het meetscript draait, de uitkomsten staan onder D16
  genoteerd, en de eigenaar heeft het gespeeld.

---

# FASE 4 — Oververhitting

*Doel: ritme in het schieten, zonder inventarisbeheer.*

### Ticket D17 — De warmtemechaniek
- **Context:** `huidigeSchotCooldown()` is de enige rem op het vuren, en
  upgrades maken die alleen maar korter (0,26 → 0,07 s).
- **Doel:** blijven vuren wordt zelfbeperkend.
- **Stappen:**
  - `warmte` 0–100. Per schot `+WARMTE_PER_SCHOT`. Koelt af met
    `WARMTE_AFKOELING` per seconde, met een korte vertraging
    (`WARMTE_AFKOEL_VERTRAGING`) nadat je stopt met vuren — anders koelt hij
    tussen twee schoten door al af en voelt de meter nergens naar.
  - Bij 100: `oververhit = true`, vuren geblokkeerd tot de warmte onder
    `WARMTE_HERVAT_DREMPEL` zakt. Dat is een hysterese, geen harde grens:
    zonder die tweede drempel zit je bij 99 in een gestotter van
    blokkeren-en-weer-mogen.
  - **Startwaarden:** +9 per schot (≈11 schoten tot oververhit),
    28/s afkoeling, 0,35 s vertraging, hervatten bij 35.
  - Interactie met bestaande systemen: `vuurtempo`-upgrade en de
    combo-vuurtempo-multiplier laten je sneller vuren en dus sneller
    oververhitten. Dat is bewust: de upgrade krijgt eindelijk een keerzijde.
- **Acceptatie:** `test-dnm-warmte.mjs`: opbouw per schot, afkoeling met
  vertraging, blokkade bij 100, hervatten pas onder 35, en dat een hogere
  vuurtempo-upgrade aantoonbaar sneller oververhit.

### Ticket D18 — Warmte zichtbaar en hoorbaar maken
- **Context:** een onzichtbare meter is een onbestuurbare meter.
- **Doel:** de speler moet zonder HUD-staren voelen hoe heet het wapen is.
- **Stappen:**
  - HUD-balk die van koel naar rood loopt, met een duidelijke oververhit-stand.
  - Het wapenmodel gloeit mee (emissive op de loop, oplopend met de warmte).
  - Stoompluim bij oververhitting via de bestaande brokstukken-pool.
  - Eén geluid bij oververhitting via de bestaande `piep()` — geen nieuw
    audiosysteem (zie "Bewust NIET in dit plan").
- **Acceptatie:** `test-dnm-warmte-hud.mjs`: de balk volgt `warmte`, de
  gloed-intensiteit loopt mee, en de oververhit-stand is visueel
  onderscheidbaar.

### Ticket D19 — Koeling als vierde upgrade
- **Doel:** de speler een tegenwicht geven tegen zijn eigen vuurtempo.
- **Stappen:** vierde upgrade in de Bijenkorf-winkel (`Digit4`): verlaagt
  `WARMTE_PER_SCHOT` en/of verhoogt de afkoeling per niveau.
- **Let op:** de hotkey-afhandeling zit nu op `Digit1/2/3` binnen
  `bijenkorfShopOpen`; die lijst moet mee en de winkel-UI ook.
- **Acceptatie:** `test-dnm-koeling.mjs`: prijsformule, effect per niveau, en
  dat het aantal schoten tot oververhitting meetbaar stijgt.

---

# FASE 5 — Het monument wordt een personage

### Ticket D20 — Zichtbare schadestaten
- **Context:** `spel.monumentHP` is alleen een getal in de HUD. Je ziet niet
  dat het monument eraan gaat.
- **Doel:** de staat van het monument afleesbaar maken zonder naar de HUD te
  kijken — dat is wat een verdedigingsspel spannend maakt.
- **Stappen:** drie drempels (bijvoorbeeld 66 %, 33 %, 10 %) met oplopende
  zichtbare schade: scheuren, ontbrekende blokken, scheefstand, rook, en bij
  de laatste trap een knipperend rood licht. Alles met de bestaande
  `blok()`/`mat()`-helpers; geen textures.
- **Acceptatie:** `test-dnm-monument-schade.mjs`: elke drempel schakelt de
  juiste staat, herstel via Koninklijke Reparatie schakelt terug, en de
  overgangen gebeuren precies één keer per drempel.

---

# FASE 6 — Platform

*Doel: dezelfde bereikbaarheid als Undead. Deze fase heeft geen invloed op de
gameplay en kan dus veilig als laatste.*

### Ticket D21 — Kwaliteitsinstellingen
- **Doel:** Laag/Normaal/Hoog, met dezelfde opzet als Undead (`KWALITEIT_
  PRESETS`, opgeslagen keuze, apparaat-afhankelijke terugval).
- **Stappen:** pixelratio, schaduwen aan/uit, schaduwresolutie, aantal
  duiven/toeristen/trams, brokstuk-levensduur. Bij het laden de opgeslagen
  keuze toepassen; op een grof-pointer-apparaat standaard `laag`.
- **Let op:** neem meteen de les uit Undead's T187 mee — pass-vlaggen moeten
  bij het **laden** uit de preset gelezen worden, niet alleen bij een
  knopdruk, anders gelden ze pas na de eerste wijziging.
- **Acceptatie:** `test-dnm-kwaliteit.mjs`, inclusief de laad-terugval.

### Ticket D22 — Instellingenscherm
- **Doel:** kwaliteit, muisgevoeligheid en geluid aan/uit op één plek in het
  startscherm.
- **Acceptatie:** `test-dnm-instellingen.mjs`: elke instelling werkt en
  overleeft een herladen.

### Ticket D23 — Touch: besturingsgate loskoppelen van Pointer Lock
- **Context:** identiek probleem als Undead's T176: `document.pointerLock
  Element === renderer.domElement` staat overal in de code en bestaat niet op
  mobiel.
- **Doel:** één `besturingActief()`-functie met een modus (`muis`/`touch`),
  precies zoals Undead het heeft opgelost.
- **Let op:** de modus wordt gezet door de **eerste echte invoer**, niet door
  UA-sniffing of `maxTouchPoints` — die liegen allebei. Dit is een geleerde
  les uit Undead, neem hem over.
- **Acceptatie:** `test-dnm-besturingsgate.mjs`: beide modi, en de bestaande
  muisbesturing onveranderd.

### Ticket D24 — Touch: lopen, kijken, vuren
- **Doel:** virtuele stick links, kijken rechts, vuurknop.
- **Let op:** de vuurknop mag de kijk-drag niet stelen — in Undead was dat een
  echte speeltest-bug (je kon niet vuren en tegelijk rondkijken). Bouw hem
  meteen goed: de vuurknop registreert óók als kijkvinger.
- **Acceptatie:** `test-dnm-touch.mjs` met Playwright's `hasTouch`-context.

### Ticket D25 — Touch: contextknop en bouwen met je duim
- **Doel:** T (interactie) en de bouwmenu's bruikbaar zonder toetsenbord.
- **Stappen:** contextknop die toont wat de huidige interactie is (bouwen,
  upgraden, repareren, kerkklok), plus een knop voor de special (X).
- **Let op:** de bouwmenu's uit fase 3 leunen op `Digit1/2/3` — die moeten op
  touch een eigen knoppenrij krijgen.
- **Acceptatie:** `test-dnm-touch-bouwen.mjs`: een toren bouwen, upgraden en
  repareren met alleen aanrakingen.

### Ticket D26 — Touch: liggend, schermindeling, veilige zones
- **Doel:** draaischerm bij staande stand, `env(safe-area-inset-*)`,
  fullscreen bij het starten, wake lock, en een HUD die op 740 × 360 past.
- **Let op:** neem de overlap-meting uit Undead over — alle zichtbare vaste
  UI-rechthoeken op 740 × 360, geen enkele mag overlappen of buiten beeld
  vallen. Dat is de goedkoopste manier om deze hele klasse fouten te vangen.
- **Acceptatie:** `test-dnm-mobiel.mjs` met die overlap-meting.

---

## 8. Beslismomenten

Na elke fase stopt de uitvoerder en vraagt of we doorgaan:

| Na fase | Vraag aan de eigenaar |
|---|---|
| 0 | Staat het vangnet goed genoeg om de herschaling in te gaan? |
| 1 | **Speelt de nieuwe schaal?** Dit is het belangrijkste beslismoment van het plan — als 1:3 niet goed voelt, is 1:4 of 1:2,5 nog een kleine ingreep, maar alleen nu. |
| 2 | Voelt de run af genoeg om er systemen bovenop te bouwen? |
| 3 | Is de tower defense-kern leuk? Zo niet: bijstellen vóór fase 4, niet erna. |
| 4 | Geeft oververhitting het beoogde ritme, of is het alleen maar hinderlijk? |
| 5 | Nog door met platformwerk, of is de game af genoeg? |

## 9. Openstaande ontwerpvragen (bewust nog niet beslist)

Deze staan hier genoteerd zodat ze niet stilletjes door de uitvoerder worden
ingevuld:

1. **Derde torentype.** Fase 3 levert er twee (geschut, hek). Een derde —
   vertrager, mijnenveld of schijnwerper — pas beslissen als die twee
   gebalanceerd zijn en we weten welk gat er nog is.
2. **Wat doen de torens tussen runs?** Nu: alles weg bij reset. Alternatief
   zou meta-progressie zijn, maar dat is expliciet buiten scope gehouden.
3. **Blijft de special-meter (X) zoals hij is?** Met torens erbij kan die
   overbodig of juist essentieel worden. Meten in D16, niet nu beslissen.
4. **Moeilijkheidsgraden.** Undead heeft ze, deze game niet. Pas zinvol als de
   basiscurve na fase 3 staat.
