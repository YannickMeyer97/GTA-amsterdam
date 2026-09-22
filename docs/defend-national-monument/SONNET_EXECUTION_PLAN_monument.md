# SONNET_EXECUTION_PLAN_monument.md — Defend National Monument

Handoff van architect naar uitvoerder, voor `defend-national-monument.html`.
Dit document staat volledig los van `SONNET_EXECUTION_PLAN_undead.md` (dat gaat
over Amsterdam Undead). **Ticketnummers dragen een `D`-prefix** (D0, D1, …)
zodat ze nooit te verwarren zijn met de Undead-tickets in `ROADMAP_undead.md`.

**Voordat je een ticket uitvoert:** lees `ARCHITECTURE_NOTES_monument.md` §10
(valkuilen) en §11 (dode code). Daar staan vijf dingen die je stil de verkeerde
kant op sturen — één ervan heeft bij het opstellen van dít document al een
foute tabel opgeleverd.

---

## 1. Waar deze game vandaan komt

`defend-national-monument.html` is de oorspronkelijke game van dit project: een
first-person arcade-shooter op de Dam in Amsterdam, waarin je het Nationaal
Monument verdedigt tegen golven robots. Eén bestand, Three.js via
CDN-importmap, geen buildstap, geen assets — dezelfde technische regels als
Undead.

**De game is sinds de splitsing niet meer aangeraakt.** Undead groeide in die
tijd naar 19.741 regels en 117 testscripts; deze game staat nog op 3.518 regels
en **nul tests**.

### Wat er nu in zit (gemeten, niet geschat)

| Systeem | Staat |
|---|---|
| Wereld | De Dam: Paleis, Nieuwe Kerk, Monument, Bijenkorf, Krasnapolsky, Madame Tussauds, gevelrijen, trams, duiven, toeristen |
| Kaart | `GRENS` 283 × 224 m, grondvlak 620 × 620 |
| Speler | 7 m/s (+0,65 per upgrade), ooghoogte 1,7, straal 0,4 |
| Wapen | Eén hitscan-geweer, `raycaster.far = 150`, cooldown 0,26 → 0,07 s, **geen munitie, geen herladen** |
| Vijanden | 5 types, lopen rechtstreeks op het monument af |
| Golven | `waveDoel = 7 + wave·3`, `maxActieveRobots = min(5 + wave·0,65, 13)` |
| Robotsnelheid | `min(1,35 + rnd·0,7 + wave·0,07, 3,2) × 1,1 × typefactor` — **loopt op met de wave** |
| Monument | 100 HP, schade 8/10/25 per type, game over bij 0 |
| Economie | Munt €5–25 (×multipliers, plafond €150), wave-bonus €40 + wave·15, perfect €50 + wave·10 |
| Upgrades | 3 stuks, 5 niveaus, resetten niet (er is geen reset) |
| Steunpunten | Kerkklok Boost, Koninklijke Reparatie (€100, +25 HP), Bijenkorf Upgrades |
| Extra's | Combo-meter, special-meter (X), perfecte-wave-bonus, hitmarker, brokstukken |
| Game over | Eén regel tekst in `objectiveUI`: *"Refresh om opnieuw te spelen."* |

---

## 2. De diagnose

Alles hieronder is gemeten in de code, niet aangevoeld.

### 2.1 De kaart is te groot — een gameplayprobleem, geen smaakkwestie

Afstanden zijn tot de **rand** van `MONUMENT_BOX`, want dat is wat
`afstandTotMonument()` meet (regel 2419). Tot het middelpunt is het ~10 m meer;
beide staan in `ARCHITECTURE_NOTES_monument.md` §6.3.

Robotsnelheid komt uit `spawnRobot` (regel 3020) en **schaalt met de wave**:

```js
min(1.35 + Math.random() * 0.7 + spel.wave * 0.07, 3.2) * 1.1 * config.snelheidMultiplier
```

> Let op: `maakRobot` zet óók een `snelheid` (regel 2993), maar die is dood —
> `spawnRobot` overschrijft hem meteen. Wie die waarde gebruikt, rekent fout.

| Poort | Afstand | `normal` wave 1 | `tank` wave 1 | `normal` bij plafond |
|---|---:|---|---|---|
| Damstraat | 70 m | 30 – 45 s | 55 – 82 s | 20 s |
| Rokin | 94 m | 40 – 60 s | 73 – 109 s | 27 s |
| Damrak | 97 m | 41 – 62 s | 75 – 112 s | 27 s |
| Kalverstraat | 121 m | 52 – 78 s | 95 – 141 s | 34 s |
| Nieuwendijk | 124 m | 53 – 79 s | 96 – **144 s** | 35 s |

Een tank uit Nieuwendijk in wave 1 is bijna twee en een halve minuut onderweg
voordat hij iets doet. Dat is geen opbouw van spanning, dat is wachttijd.

Erger: van de drie steunpunten liggen er twee op ~101 m van de monumentrand —
de Kerkklok op (−67, −38) en de Koninklijke Reparatie op (−70, 5). Eén
reparatie kost **~29 s heen-en-terug** op 7 m/s. In die tijd lopen er bij
`maxActieveRobots` 5 tot 13 robots binnen. Die twee punten zijn tijdens een
wave dus feitelijk onbruikbaar; ze bestaan alleen op papier. Alleen de
Bijenkorf-winkel ligt bruikbaar dichtbij (~8 m).

De lange as doorkruisen kost de speler 40 s. Je kunt de vijf poorten dus niet
dekken, en er ook niet zinnig tussen kiezen — je staat gewoon bij het monument
te wachten.

### 2.2 Er zit geen ritme in het schieten

Eén wapen, hitscan, one-shot voor vier van de vijf types, geen munitie, geen
herladen, geen wisselen. Je houdt de linkermuisknop ingedrukt en dat is het.
De vuurtempo-upgrade maakt de enige rem (`huidigeSchotCooldown`) alleen maar
korter, van 0,26 naar 0,07 s. Er is nooit een moment waarop je iets anders
moet doen dan richten.

### 2.3 Het monument is decor

Je "verdedigt" het, maar het is een getal in de HUD. Geen zichtbare
schadestaten, geen eigen rol in het gevecht, geen reden om er in de buurt te
zijn behalve dat robots daarheen lopen.

### 2.4 Er zijn geen ruimtelijke beslissingen

Vijf poorten, en je kunt er niets mee: niet afsluiten, niet versterken, niet
bewaken. `kiesSpawnPoort()` loot bovendien volledig uniform — geen weging,
geen geheugen. De enige keuze in het hele spel is "waar sta ik", en omdat de
kaart te groot is, is het antwoord altijd "bij het monument".

### 2.5 De run heeft geen staart

Game over is één regel tekst met de instructie om te verversen. Geen
eindscherm, geen statistieken, geen highscore, geen knop. En de gameloop
stopt niet eens: `spelActief` checkt `spel.gameOver` niet, dus je kunt na game
over gewoon blijven rondlopen en schieten.

### 2.6 Nul testdekking

117 testscripts, allemaal voor Undead. Elke wijziging in deze game is nu
gokwerk, en dit plan bevat een herschaling die letterlijk elke coördinaat
raakt. Dit moet als eerste opgelost, niet als laatste.

### 2.7 Robot-AI is één regel met pleisters

Robots lopen rechtstreeks op het monument af. Vastlopen wordt opgevangen met
`vastTijd`/`ontwijkTimer` (tijdelijk 10 m zijwaarts uitwijken) en één
hardgecodeerd `tussenpunt` voor de Kalverstraat-poort. Undead heeft hiervoor
een waypoint-navigatiegraaf.

Bijkomend: de robot-botsstraal is hardgecodeerd `0.45` en negeert
`config.schaal`, dus een tank (1,4×) botst als een normale robot en steekt
door muren.

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

- **Audio-overhaul.** Niet aangevinkt door de eigenaar. De zes hardgecodeerde
  `piep()`-geluiden blijven. Nieuwe systemen krijgen wél geluid, maar via
  diezelfde `piep()` — geen audioregistry, geen ruislaag, geen `AUDIO.md`-port.
- **Meta-progressie.** Geen Stadsarchief-equivalent. Elke run staat op
  zichzelf; alleen de highscore blijft bewaard.
- **Waypoint-navigatiegraaf.** De rechtstreekse route blijft. Blijkt na de
  herschaling dat robots vastlopen in smallere straten, dan is daar in D6 een
  meetpunt voor — dán pas beslissen.
- **Verplaatsen van de HTML-bestanden.** De live-URL's blijven werken.
- **Een tweede wapen.** Fase 4 lost het schietritme op met warmte. Een
  wapenwissel is een heel ander ontwerp en hoort niet in dit plan.

---

## 4. Architectuurregels (hard)

1. Alles blijft in `defend-national-monument.html` — single-file, geen
   frameworks, geen assets, alleen Three.js-geometrie en Web Audio via de
   bestaande `piep()`.
2. **`amsterdam-undead.html` en `index.html` NIET aanraken.** Hergebruik uit
   Undead gaat via *kopiëren en aanpassen*, nooit via gedeelde bestanden.
3. IP-regels uit `CLAUDE.md` gelden onverkort. De bestaande namen (Kerkklok
   Boost, Koninklijke Reparatie, Bijenkorf Upgrades) blijven.
4. Debug-hook: alles testbaars exporteren op de **al bestaande
   `window.DamChaosDebug`** (getters voor `let`-variabelen). Eén global, geen
   tweede, en niet hernoemen.
5. Balansconstanten bovenaan hun blok met een comment dat uitlegt *waarom* dat
   getal zo staat — niet alleen wat het doet.
6. **Tijdelijke buffs zijn pure functies.** Zie `ARCHITECTURE_NOTES_monument.md`
   §7.4. Een buff die een basiswaarde muteert en later "terugzet" komt er niet
   in.
7. Nieuwe tests heten `test-dnm-*.mjs`, meetscripts `meet-dnm-*.mjs`.

## 5. Wat je WEL doet

- Per ticket één commit, met een boodschap die uitlegt waarom.
- Na elke wijziging: laadcheck + de tests van dat ticket + de volle suite.
- Getallen meten vóór je ze bijstelt.
- Dode code opruimen in het blok waar je tóch al zit.

## 6. Wat je NIET doet

- Twee tickets in één commit (D4 en D5 al helemaal niet).
- Een constante "even" aanpassen buiten het ticket om.
- Een test schrijven die op een exacte RNG-uitkomst assert — de
  gameplay-RNG heeft geen seed (zie `ARCHITECTURE_NOTES_monument.md` §3.6).
- Een losse opruimcommit tussendoor.

---

## 7. Testinfrastructuur — die bestaat nog niet

De `tests/`-map werkt uitsluitend met Undead: `helpers.mjs` heeft één
hardgecodeerde `GAME_PATH` naar `amsterdam-undead.html`, en `run-all.mjs` pakt
alles op wat `check-*.mjs` of `test-*.mjs` heet — 117 scripts, plat in één map,
plus 22 hulp- en meetscripts. **D0 splitst die map eerst op per game.**

**Aanpak (D1):** naast `helpers.mjs` komt `helpers-defend.mjs`, met dezelfde
opzet (lokale Chromium op `/opt/pw-browsers/chromium`, de CDN-intercept die
Three.js lokaal serveert, pointer-lock-simulatie) maar met
`defend-national-monument.html` als doel.

De CI-workflow (`.github/workflows/tests.yml`) draait `run-all.mjs` al op elke
push en hoeft niet te veranderen.

---

# FASE 0 — Fundament

*Doel: kunnen meten en kunnen terugvallen, vóórdat er één coördinaat
verschuift. Zonder deze fase is de herschaling in fase 1 blind werk.*

### Ticket D0 — Testmap opsplitsen per game

- **Context:** `tests/` bevat 117 testscripts en 22 hulp-/meetscripts, plat in
  één map, allemaal voor Undead. Daar komen straks `test-dnm-*`-bestanden bij.
  Nu splitsen is één keer werk; later splitsen betekent de nieuwe tests
  verhuizen die je er net in hebt gezet.
- **Doel:** per game een eigen submap, met gedeelde infrastructuur op
  `tests/`-niveau.
- **Indeling:**
  ```
  tests/
    node_modules/          blijft
    run-all.mjs            blijft, wordt recursief
    run-all-parallel.mjs   blijft
    helpers.mjs            blijft
    helpers-defend.mjs     komt in D1
    README.md              blijft
    amsterdam-undead/      117 tests + de meet-/t*-scripts
    defend-national-monument/   de nieuwe test-dnm-*
  ```
- **De drie concrete obstakels:**
  1. `run-all.mjs` doet `readdirSync(__dirname)` (regel 32) op één vlakke map.
     Dat moet recursief worden, **met behoud van de uitsluitingslijst** voor de
     scripts die niet parallel mogen (regels 99-102).
  2. `helpers.mjs` resolvet `node_modules` (regel 10, 18) én
     `../amsterdam-undead.html` (regel 11) relatief aan `__dirname`. Eén niveau
     dieper klopt `..` niet meer.
  3. Elke `import … from './helpers.mjs'` in 117 bestanden wordt
     `'../helpers.mjs'`.
- **Volgorde:** vóór D1, zodat `helpers-defend.mjs` en de eerste
  `test-dnm-*`-tests meteen op hun definitieve plek landen.
- **Acceptatie:** `node run-all.mjs` vindt exact 117 scripts (evenveel als nu)
  en is groen. Dit ticket verandert geen enkele assertie — alleen paden.

### Ticket D1 — Testinfrastructuur en debug-hooks

- **Context:** er is geen enkele test. Er is wél al een debug-export:
  **`window.DamChaosDebug` bestaat** (regel 3516) met ~30 exports. Dit ticket
  **breidt uit**, het maakt niets nieuws aan.
- **Doel:** de ontbrekende exports erbij, plus `tests/helpers-defend.mjs` en
  een eerste rooktest.
- **Stappen:**
  - `window.DamChaosDebug` aanvullen met wat nu ontbreekt en later nodig is:
    `GRENS`, `MONUMENT_POSITIE`, `MONUMENT_BOX`, `MONUMENT_MAX_HP`,
    `SPAWN_POORTEN`, `afstandTotMonument`, `upgradeKosten`, `losBotsingenOp`,
    `updateRobots`, `koopUpgrade`, `koopMonumentReparatie`, `legMuntNeer`,
    `updateInteracties`, `activeerHuidigeInteractie`,
    `activeerBijenkorfUpgradeShop`, `updateMunten`, `updateSpeler`,
    `probeerTeSchieten`, `klok` (getter), `huidigeInteractie` (getter).
    Controleer per naam of hij al bestaat vóór je hem toevoegt.
  - `tests/helpers-defend.mjs`: kopie van `helpers.mjs` met `GAME_PATH` naar
    `defend-national-monument.html`, een `openDefend({ simuleerPointerLock })`
    en dezelfde `makeChecker()`/`frames()`-helpers. Hergebruik de bestaande
    browser-cache-global zodat `run-all.mjs` niet trager wordt.
  - `tests/defend-national-monument/test-dnm-laadt.mjs`: de game laadt zonder
    console-errors, `obstakels.length > 0`, wave 1 staat klaar,
    `spel.monumentHP === 100`, en `DamChaosDebug` bevat elke naam uit de lijst
    hierboven (assert op de sleutels, niet op gedrag — dat vangt een vergeten
    export meteen).
- **Niet veranderen:** geen gameplay, geen enkele constante.
- **Acceptatie:** `test-dnm-laadt.mjs` groen, `run-all.mjs` pakt het bestand
  automatisch op, Undead-tests ongewijzigd groen.

### Ticket D2 — Gedragstests die een herschaling overleven

- **Context:** D4 verschuift elke coördinaat. Tests die absolute posities
  vastleggen zijn dan waardeloos; tests die *relaties* vastleggen niet.
- **Doel:** een vangnet dat de herschaling kan betrappen op echte fouten,
  zonder bij elke coördinaatwijziging om te vallen.
- **Stappen:** `test-dnm-kern.mjs` met checks die in **verhoudingen** denken:
  - Elke poort in `SPAWN_POORTEN` ligt binnen `GRENS`.
  - Elk interactiepunt ligt binnen `GRENS` en op een vrije plek
    (`isVrijePlek`).
  - Geen twee interactiepunten liggen binnen elkaars `radius` — anders kan het
    dichtstbijzijnde-punt-systeem het verkeerde kiezen.
  - **De route-test:** een robot die vanaf elke poort simuleert (stappen van
    0,25 m richting monument, `losBotsingenOp(positie, 0.45)` per stap) bereikt
    `afstandTotMonument < 0.6` binnen een ruime stappenlimiet. Dit is de
    vastloper-detector.
  - **De tank-variant:** zelfde route met botsstraal 0,45 × 1,4 = 0,63, want
    dat is het type dat als eerste klem komt te zitten. *(Merk op dat de game
    zelf deze straal niet gebruikt — zie `ARCHITECTURE_NOTES_monument.md` §6.4.
    De test is hier strenger dan de game, met opzet: hij bewaakt of het model
    door een muur zou steken.)*
  - `startWave(n)` zet `waveDoel = 7 + n·3` en
    `maxActieveRobots = min(5 + floor(n·0,65), 13)`, voor n = 1, 5, 10, 13, 20.
  - `kiesRobotTypeVoorWave(n)` levert alleen types die op wave n ontgrendeld
    zijn (1000 trekkingen per wave, verzameling vergelijken).
  - `robotRaaktMonument()` trekt exact `monumentSchade` af, zet de combo op 0
    en `waveGeenMonumentSchade` op false; bij HP ≤ 0 volgt `gameOver`.
  - `upgradeKosten(type)` volgt `basis + niveau·basis` voor alle vijf niveaus.
  - `huidigeSchotCooldown()` respecteert het plafond 0,07 bij niveau 5.
- **Niet veranderen:** geen gameplay.
- **Acceptatie:** alle checks groen op de HUIDIGE schaal. Deze test is de
  referentie waartegen D4 wordt afgezet.

### Ticket D3 — Documenten sorteren ☑ AFGEROND

Alle documentatie verhuisd naar `docs/<game>/`, met achtervoegsels voor de
documenten die per game bestaan. `ARCHITECTURE_NOTES_monument.md` en
`ROADMAP_monument.md` nieuw aangemaakt. 19 verwijzingen in
`amsterdam-undead.html` en tientallen in tests en documenten herschreven.
`CLAUDE.md` bijgewerkt, inclusief de onjuiste zin over een bestaande
regressiesuite voor deze game.

Bevindingen onderweg, die dit plan hebben gecorrigeerd:
`window.DamChaosDebug` bestond al; de afstandstabel mat naar het middelpunt in
plaats van de doos; de robotsnelheid in `maakRobot` is dode code en de echte
formule schaalt met de wave.

---

# FASE 1 — De arena op maat

*Doel: de kaart speelbaar maken. Dit is de wijziging met de grootste
gevoelsimpact van het hele plan, en de enige die elke coördinaat raakt.*

### Ticket D4 — Schaalfundament (VOORZICHTIG, nooit combineren)

- **Context:** `GRENS` is 283 × 224 m. Alle wereldgeometrie staat met
  hardgecodeerde coördinaten in ~40 bouwfuncties.
- **Doel:** afstanden ×1/3, gebouwen bijna op hoogte.
- **Technische meevaller:** `registreerObstakel()` leest **wereld**-coördinaten
  (`updateWorldMatrix(true, true)` + `Box3.setFromObject`). Zet je
  `wereld.scale` vóórdat de geometrie geregistreerd wordt, dan komen die negen
  botsboxen automatisch mee. De negen `registreerRechthoek()`-aanroepen rekenen
  met rauwe getallen en moeten met de hand mee — zie de lijst in
  `ARCHITECTURE_NOTES_monument.md` §4.2.
- **De drie constanten**, bovenaan het wereldblok, elk met comment:
  ```js
  const ARENA_SCHAAL = 1 / 3;            // alle x/z-posities en voetafdrukken
  const GEBOUW_HOOGTE_SCHAAL = 0.6;      // alleen hoogtes
  const MONUMENT_HOOGTE_SCHAAL = 0.8;    // het monument krimpt minder
  ```
- **Waarom niet één factor.** Bij ×1/3 over alles wordt het Paleis (hoofdblok
  22 m, regel 1030) 7,3 m en de monumentpyloon (`CylinderGeometry(1.35, 2.75,
  22, 4)`, regel 1298) óók 7,3 m, terwijl robots 1,9 m blijven. Dan speel je in
  een poppenhuis en is het monument een tuinornament. Bij hoogte ×0,6 wordt het
  Paleis 13,2 m en de pyloon (×0,8) 17,6 m: de arena blijft omsloten en het
  monument blijft torenen.
- **Doelwaarden na de schaling** (narekenbaar, gebruik deze als checklist):

  | Wat | Nu | Na D4 |
  |---|---|---|
  | `GRENS.minX` / `maxX` | −118 / 165 | −39,33 / 55,00 |
  | `GRENS.minZ` / `maxZ` | −118 / 106 | −39,33 / 35,33 |
  | Arena | 283 × 224 m | **94,3 × 74,7 m** |
  | Grondvlak | 620 × 620 | 207 × 207 |
  | Paleis hoofdblok (h) | 22 m | 13,2 m |
  | Monumentpyloon (h) | 22 m | 17,6 m |

- **Toepassen op:** grondvlak, `damPleinPunten`, alle bouwfuncties,
  `plaatsGevelrij`, straatmeubilair, railpad, tramroute (`zMin`/`zMax` van de
  rijdende tram!), zebrapaden, `TRAM_HALF_X`/`TRAM_HALF_Z`.
- **Niet veranderen:** `speler.hoogte` (1,7), `speler.straal` (0,4),
  robotafmetingen, `ROBOT_TYPES.schaal`, robotsnelheden. Juist dóórdat die
  gelijk blijven worden de looptijden 3× korter — dat is het hele punt.
- **Risico dat je expliciet moet controleren:** straten krimpen óók 3×. Een
  straat van 8 m wordt 2,7 m, en een tank zou een botsstraal van 0,63 m hebben.
  D2's route-test met de tank-variant is precies daarvoor gebouwd.
- **Ook meenemen:** de schaduwcamera staat op ±110 (regel 422), afgestemd op de
  oude arena. Mee schalen naar ±37 geeft bij dezelfde 2048²-map een ~3× zo
  scherpe schaduw. Gratis winst, maar doe het bewust.
- **Acceptatie:** D2 volledig groen (met name route- en tank-tests), geen
  console-errors, en een screenshot per windrichting ter visuele controle.

### Ticket D5 — Spelsystemen herijken op de nieuwe schaal

- **Context:** buiten `wereld` staan losse wereldcoördinaten die D4 niet raakt.
- **Doel:** alles wat in meters denkt meeschalen, en wat dat niet moet expliciet
  met rust laten.
- **De concrete lijst, met doelwaarden:**

  | Wat | Nu | Na D5 |
  |---|---|---|
  | `MONUMENT_POSITIE` | (42, 0, −4) | (14,00, 0, −1,33) |
  | `MONUMENT_BOX` halve maat | ±10,7 | ±3,57 |
  | Damstraat | (123, 0, 4) | (41,00, 0, 1,33) |
  | Rokin | (2, 0, 96) | (0,67, 0, 32,00) |
  | Damrak | (0, 0, −106) | (0, 0, −35,33) |
  | Kalverstraat | (−55, 0, 92) | (−18,33, 0, 30,67) |
  | ↳ `tussenpunt` | (−45, 0, 45) | (−15,00, 0, 15,00) |
  | Nieuwendijk | (−52, 0, −106) | (−17,33, 0, −35,33) |
  | Kerkklok Boost | (−67, 0, −38) | (−22,33, 0, −12,67) |
  | Koninklijke Reparatie | (−70, 0, 5) | (−23,33, 0, 1,67) |
  | Bijenkorf Upgrades | (60, 0, −17) | (20,00, 0, −5,67) |
  | `speler.positie` | (16, 0, 30) | (5,33, 0, 10,00) |
  | `raycaster.far` | 150 | **50** |

  Ook `spreidingX`/`spreidingZ` van elke poort ×`ARENA_SCHAAL`.

- **`raycaster.far` = 50, afgeleid:** de oude arena heeft een diagonaal van
  `hypot(283, 224) = 361` m; 150/361 = 0,415. De nieuwe diagonaal is
  `hypot(94,3, 74,7) = 120` m, dus 0,415 × 120 ≈ 50. Zelfde verhouding tussen
  wapenbereik en kaart.
- **Bewust NIET schalen:**
  - `interactiePunten[].radius` (4 m) — dat is een interactieafstand op
    mensenmaat, geen wereldafstand. **Maar controleer wel** dat 4 m in de
    nieuwe arena geen twee punten laat overlappen: Kerkklok en Reparatie komen
    op (−22,33, −12,67) en (−23,33, 1,67), dus 14,4 m uit elkaar. Ruim genoeg.
    D2 heeft hier een check voor.
  - De aankomstdrempel `afstandTotMonument(...) < 0.6` — contactafstand.
  - De robot-botsstraal `0.45` en `speler.straal` 0,4 — lichaamsmaten.
  - `isVrijePlek`'s `marge` en de 2 m-rand op `GRENS`.
- **Niet veranderen:** muntwaarden, HP, schade, wave-formules, robotsnelheid.
  Die komen in D6 aan de beurt, ná de meting.
- **Acceptatie:** D2 groen, een robot uit elke poort bereikt het monument, de
  speler start op een vrije plek, alle drie de interactiepunten zijn
  bereikbaar en niet-overlappend.

### Ticket D6 — Meten en bijstellen

- **Context:** D4 en D5 zijn gebouwd op een berekening. Of het *speelt* is
  daarmee niet bewezen.
- **Ontwerpdoelen:**
  - Robot van poort naar monument: **15–25 s** voor de dichtstbijzijnde poort,
    tot ~35 s voor de verste. Korter dan 10 s betekent dat je niet kunt
    reageren; langer dan 40 s is weer wachttijd.
  - Speler kruist de lange as: **10–15 s**.
  - Steunpunt heen-en-terug: **10–15 s** — een echte afweging, geen
    onmogelijkheid.
- **Wat de berekening vooraf al zegt** (controleer of de meting dit bevestigt):

  | Meting | Afstand | `normal` wave 1 | Bij snelheidsplafond |
  |---|---:|---|---|
  | Damstraat | 23,4 m | 10 – 15 s | **6,7 s** ✗ |
  | Rokin | 31,3 m | 13 – 20 s | **8,9 s** ✗ |
  | Damrak | 32,2 m | 14 – 21 s | **9,1 s** ✗ |
  | Kalverstraat | 40,4 m | 17 – 26 s | 11,5 s ✓ |
  | Nieuwendijk | 41,2 m | 18 – 26 s | 11,7 s ✓ |

  | Overige meting | Verwacht | Doel |
  |---|---|---|
  | Speler lange as | 94,3 / 7 = 13,5 s | 10–15 s ✓ |
  | Steunpunt retour (Kerkklok, Reparatie) | 2 × 33,7 / 7 = 9,6 s | 10–15 s, **randje** |
  | Steunpunt retour (Bijenkorf) | 2 × 2,6 / 7 = 0,7 s | blijft vlak naast het monument |

- **Het probleem dat je gaat vinden.** Bij hoge waves loopt de robotsnelheid op
  naar 3,52 m/s, en dan zakken **drie van de vijf poorten** onder de
  reactiedrempel van 10 s: Damstraat 6,7 s, Rokin 8,9 s en Damrak 9,1 s. Alleen
  Kalverstraat en Nieuwendijk blijven erboven.

  De ondergrens van wave 1 is bovendien óók al krap: Damstraat haalt 10–15 s
  tegen een doel van 15–25 s.

  **Drie opties, kies bewust:**
  1. **De drie dichtstbijzijnde poorten naar buiten verplaatsen** tot ze op de
     nieuwe schaal minstens 35 m van de monumentrand liggen. Afstand is pacing.
  2. **Het snelheidsplafond verlagen** van 3,2 naar ~2,4 (→ 2,64 m/s
     effectief). Dan haalt Damstraat 8,9 s — nog steeds onder de drempel, dus
     dit alleen lost het niet op.
  3. **`ARENA_SCHAAL` op 1/2,5 in plaats van 1/3.** Alles wordt 20 % ruimer:
     Damstraat 28,1 m → 8,0 s bij het plafond. Ook niet genoeg, en het
     verzwakt de hele reden voor de herschaling.

  **Voorkeur: optie 1**, eventueel gecombineerd met een milde variant van 2.
  Optie 1 raakt geen balansgetal dat ook elders doorwerkt; het plafond verlagen
  raakt óók de late-game-spanning die nu juist uit oplopende snelheid komt.

  Dit is precies het soort uitkomst waarvoor dit ticket bestaat: de herschaling
  legt een probleem bloot dat er in de oude arena al zat (Damstraat was daar
  met 20 s bij het plafond ook al de uitschieter), maar dat je pas ziet als de
  rest klopt.
- **Stappen:** `tests/defend-national-monument/meet-dnm-afstanden.mjs`
  (meetscript, géén `test-`-prefix) dat per poort de afstand en de looptijd
  print bij minimum- en maximumsnelheid, voor wave 1, 10 en bij het plafond,
  plus de speler-doorkruistijd en de drie steunpunt-trips. Daarna: alleen
  bijstellen wat buiten het doelvenster valt, en per bijstelling noteren
  waaróm.
- **Acceptatie:** het meetscript draait, de uitkomsten staan hieronder
  genoteerd, en de eigenaar heeft het gespeeld.

> **Meetresultaten D6:** *(vul in bij uitvoering)*

---

# FASE 2 — De run krijgt een kop en een staart

*Doel: het grootste polijstgat dichten. Klein werk, groot effect — en het maakt
alle latere balansfases meetbaar, want je ziet eindelijk hoe een run afliep.*

### Ticket D7 — Eindscherm met statistieken

- **Context:** game over zet alleen `objectiveUI.textContent` (regel 2476). De
  gameloop draait door: `spelActief` checkt `spel.gameOver` niet, dus je kunt
  blijven schieten en rondlopen. `updateWaveSysteem` en `updateRobots` stoppen
  zelf, de rest niet.
- **Doel:** een echt eindscherm, in de stijl van het bestaande startscherm.
- **Stappen:**
  - `runStats`-object: kills per type, schoten, treffers, verdiend geld,
    hoogste combo, hoogste wave, speelduur, (later) gebouwde torens.
    Bijhouden in `schiet()`, `vernietigRobot()`, `legMuntNeer()` en
    `startWave()`.
  - Nieuw DOM-element `#eindscherm`, dezelfde CSS-taal als `#startscherm`.
  - `toonEindscherm()`: wave, score, kills, trefferpercentage, verdiend geld,
    hoogste combo, speelduur.
  - `document.exitPointerLock()` aanroepen, en `spelActief` in de gameloop
    uitbreiden naar `besturingActief() && !spel.gameOver` zodat álles stilvalt,
    niet alleen robots en waves.
  - `spel.gameOver` blijft de bron van waarheid.
- **Niet veranderen:** `objectiveUI` blijft voor de lopende run; alleen de
  game-over-tekst daarin mag weg zodra het scherm er is.
- **Acceptatie:** `test-dnm-eindscherm.mjs`: monument naar 0 HP → scherm
  zichtbaar, statistieken kloppen met de gesimuleerde run, en **na game over
  bewegen robots niet meer, worden munten niet opgeraapt en doet een schot
  niets**.

### Ticket D8 — Highscore

- **Context:** geen enkele vorm van opslag.
- **Doel:** één bewaard record, met hetzelfde veilige-terugval-patroon als
  Undead gebruikt.
- **Stappen:**
  - Sleutel `defendNationalMonumentHighscore`, waarde `{ score, wave, datum }`.
  - `leesHighscore()` met try/catch **en vormvalidatie**: geen object → geen
    record; `score` geen eindig getal ≥ 0 → geen record; onbekende extra velden
    negeren. Een corrupte waarde mag het spel nooit breken.
  - `schrijfHighscore()` met try/catch — in privacymodus gooit
    `localStorage.setItem`.
  - Op het eindscherm: "NIEUW RECORD!" of "Record: N".
- **Acceptatie:** `test-dnm-highscore.mjs`: schrijven/teruglezen, minstens zes
  corrupte vormen (niet-JSON, array, `null`, score als string, negatieve score,
  `NaN`), en een geweigerde `localStorage`. Geen enkele crasht.

### Ticket D9 — Opnieuw spelen zonder verversen

- **Context:** de enige manier om opnieuw te beginnen is F5.
- **Doel:** een Opnieuw-knop die de hele runstaat terugzet.
- **Stappen:** `resetRun()` die terugzet:
  - `robots`, `munten`, `brokstukken` — leeghalen **én uit de scene
    verwijderen** (drie arrays, drie `scene.remove`-lussen).
  - `spel`: elk veld naar de beginwaarde, inclusief `specialMeter`,
    `waveGeenMonumentSchade`, `laatsteSpawnPoort`, `gameOver`.
  - `upgrades` → alle drie op 0, **en `speler.snelheid` terug naar 7** — die
    wordt permanent opgehoogd door de upgrade (regel 2634) en nergens gereset.
    Dit is het state-lek dat je gaat missen als je er niet op let.
  - `geld` → 0, `runStats` → leeg, `speler.positie` → startplek,
    `speler.yaw`/`pitch` → beginwaarde.
  - `kerkklokBoost` → `active` false, `resterend` 0, `cooldownResterend` 0.
  - `laatsteSchotTijd` → −999, `terugslag`/`vlamTimer`/`cameraShake` → 0.
  - Daarna `startWave(1)`.
- **Let op:** dit is precies het soort functie waar state-lekken zich
  verstoppen. De test moet een volledige run simuleren, resetten, en dan
  **elke** geëxporteerde teller vergelijken met een vóóraf genomen momentopname
  van de beginstaat.
- **Acceptatie:** `test-dnm-reset.mjs` met die volledige vergelijking, plus een
  expliciete check op `speler.snelheid === 7` na vijf snelheid-upgrades.

---

# FASE 3 — De tower defense-kern

*Doel: de vijf poorten betekenis geven. Dit is de grootste fase en de
inhoudelijke kern van de verbouwing.*

### Ticket D10 — Bouwplekken

- **Doel:** vaste sokkels bij de poorten, zichtbaar en aanspreekbaar.
- **Ontwerp:** 5 poorten × 2 sokkels = **10 bouwplekken**, in de
  aanloopcorridor van hun eigen poort — niet rond het monument. Dat is wat
  poortkeuze betekenisvol maakt: een toren dekt één route, niet alles.
- **Plaatsing:** op 25 % en 55 % van de lijn poort → monument, met een zijwaartse
  offset van ~2 m zodat ze de corridor niet blokkeren (dat is het hek, D13).
  Voor Kalverstraat loopt die lijn via het `tussenpunt`.
- **Stappen:**
  - `BOUWPLEKKEN`-dataset: `{ positie, poort, toren: null }`.
  - Visualisatie: gemarkeerde vloertegel met lage rand; leeg = zwak pulserend
    kader in de poortkleur.
  - Elke plek wordt een interactiepunt via het bestaande
    `interactiePunten`-mechanisme, zodat T en de prompt-UI gewoon werken.
- **Let op:** `interactiePunten` groeit van 3 naar 13. Het
  dichtstbijzijnde-punt-systeem is een lineaire lus — dat is prima op 13, maar
  de radius-overlapcheck uit D2 wordt nu echt belangrijk.
- **Niet veranderen:** het interactiesysteem zelf.
- **Acceptatie:** `test-dnm-bouwplekken.mjs`: 10 plekken, allemaal binnen
  `GRENS`, allemaal op een vrije plek, geen enkele binnen de monument-box, geen
  twee binnen elkaars radius, en elke plek ligt dichter bij zijn eigen poort
  dan bij elke andere.

### Ticket D11 — De geschuttoren

- **Doel:** de eerste en belangrijkste toren: schiet automatisch op robots
  binnen bereik.
- **Stappen:**
  - `TOREN_TYPES.geschut`: `prijs`, `bereik`, `schadePerSchot`,
    `schotInterval`, `hp`.
  - Bouwmenu: T op een lege plek opent een compact paneel met 1/2/3, exact
    hetzelfde patroon als `bijenkorfShopOpen` + `Digit1/2/3`. Geen nieuwe
    UI-laag, geen bouwmodus.
  - `updateTorens(dt)`: dichtstbijzijnde doel binnen bereik, vuren op interval,
    kort schotlijntje, hergebruikt `raakRobot()`.
  - Toren draait zijn loop naar het doel — goedkoopste manier om hem levend te
    laten ogen.
- **Balans-startpunt (te ijken in D16):** €120, bereik 12 m, 1 schade per
  0,8 s, 60 HP. Op de nieuwe schaal is 12 m ongeveer de halve afstand van
  Damstraat naar het monument, dus één toren dekt een echt stuk corridor.
- **Let op:** `raakRobot()` doet `robot.hp -= 1`. Wil je `schadePerSchot`
  anders dan 1, dan moet die functie een parameter krijgen —
  **met een standaardwaarde van 1**, zodat het spelerswapen onveranderd blijft.
- **Acceptatie:** `test-dnm-toren-geschut.mjs`: koopt met genoeg/te weinig
  geld, schiet alleen binnen bereik, raakt het dichtstbijzijnde doel,
  respecteert het interval, en doodt een normale robot in het verwachte aantal
  schoten. Plus: het spelerswapen doodt nog steeds in één schot.

### Ticket D12 — Torenniveaus en reparatie

- **Doel:** een toren is geen eenmalige aankoop maar een investering.
- **Stappen:**
  - Drie niveaus, oplopende prijs en effect (`bereik`, `schadePerSchot`, `hp`),
    zichtbaar aan een extra ring/segment op het model.
  - T op een bezette plek: upgraden, of repareren als de HP onder het maximum
    staat (kosten evenredig aan de ontbrekende HP).
  - Verkopen tegen een deel van de investering, zodat een verkeerde poortkeuze
    niet permanent is.
- **Acceptatie:** `test-dnm-toren-niveaus.mjs`: prijsformule, effect per
  niveau, reparatiekosten evenredig, verkoopopbrengst, en dat niveau 3 niet
  verder kan.

### Ticket D13 — Het hek

- **Doel:** een tweede toren met een compleet ander karakter: hij schiet niet,
  hij kóópt tijd.
- **Stappen:**
  - `TOREN_TYPES.hek`: blokkeert de corridor fysiek (eigen
    obstakel-registratie), heeft HP, en robots die ertegenaan lopen slaan erop
    in plaats van door te lopen.
  - Robot-gedrag: binnen aanvalsbereik van een hek → stilstaan en slaan, met
    zichtbare slaganimatie en hekschade per tik.
  - Sneuvelt het hek: obstakel deregistreren, robots lopen door.
- **Let op:** het obstakel moet écht uit `obstakels` verdwijnen. `obstakels` is
  een platte array zonder id's — je moet dus de referentie bewaren die
  `registreerRechthoek` heeft gepusht, of die functie een handle laten
  teruggeven. **Doe dat laatste**, dat is de enige manier die niet stilletjes
  het verkeerde element verwijdert.
- **Acceptatie:** `test-dnm-hek.mjs`: robot stopt bij het hek, hek verliest HP,
  bij 0 HP verdwijnt zowel het model als het obstakel, `obstakels.length` is
  terug op de oude waarde, en een robot die daarna langskomt loopt ongehinderd
  door.

### Ticket D14 — Robots vallen torens aan

- **Context:** zonder dit zijn torens gratis. Een toren die nooit kapot kan,
  verandert het spel in wachten.
- **Doel:** torens onder druk zetten, en de bestaande `bomber` eindelijk een
  eigen rol geven — die heeft nu alleen meer monumentschade (25) en verder
  niets eigens.
- **Stappen:**
  - `bomber` krijgt torens als primair doel binnen een straal, en doet bij
    aankomst zware schade aan de toren in plaats van aan het monument.
  - Andere types blijven op het monument gericht, maar halen uit naar een hek
    dat hun route blokkeert (D13).
  - Toren vernietigd: brokstukken via `maakBrokstuk()`, plek komt weer vrij.
- **Acceptatie:** `test-dnm-toren-aanval.mjs`: een bomber kiest een toren
  binnen straal, doet er schade aan, de plek is na vernietiging weer bebouwbaar,
  en een bomber zónder toren in de buurt gaat nog steeds op het monument af.

### Ticket D15 — Bouwfase tussen waves

- **Context:** `spel.tussenWaveTimer > 4.5` start nu automatisch de volgende
  wave. Met torens erbij is 4,5 s te kort om een beslissing te nemen.
- **Doel:** een expliciete voorbereidingsfase.
- **Stappen:**
  - Pauze naar ~20 s, met aftelling in de HUD en een "Wave N start over …"-regel.
  - Een toets om de wave vroeg te starten, met een bonus als beloning voor het
    risico — dat houdt het tempo hoog voor wie snel wil.
  - Tijdens de bouwfase spawnen er geen robots.
- **Let op:** de speler moet in 20 s heen en terug naar een bouwplek kunnen. Op
  de nieuwe schaal is de verste plek ~35 m, dus 10 s retour. Dat past, maar
  controleer het met de D6-meting in de hand.
- **Acceptatie:** `test-dnm-bouwfase.mjs`: geen spawns tijdens de fase, de
  aftelling loopt, vroeg starten werkt en geeft de bonus.

### Ticket D16 — Economie herijken

- **Context:** de huidige economie is gekalibreerd op een spel zónder torens.
  Met torens erbij is geld opeens de centrale keuze: wapen-upgrade of
  verdediging? De volledige upgradeladder kost nu €6.750 voor alle drie de
  upgrades op niveau 5 (zie `ARCHITECTURE_NOTES_monument.md` §7.3).
- **Doel:** één afgestemde curve, gemeten in plaats van gegokt.
- **Stappen:** `meet-dnm-economie.mjs` simuleert 20 waves en print per wave:
  inkomsten, wat je ervan kon bouwen, en hoeveel torens je nodig had om de wave
  zonder monumentschade door te komen. Daarna pas bijstellen.
- **Ontwerpdoel:** rond wave 5 moet de speler ongeveer **één poort** volledig
  hebben kunnen uitrusten, niet alle vijf. De schaarste ís de keuze.
- **Let op bij het meten:** de robotsnelheid loopt op met de wave (§2.1) en de
  typemix ligt vanaf wave 5 vast. Na wave 5 verandert er dus alleen nog
  *aantal* en *snelheid* — als de curve daar afvlakt, ligt dat daaraan en niet
  aan de economie.
- **Acceptatie:** het meetscript draait, de uitkomsten staan hieronder
  genoteerd, en de eigenaar heeft het gespeeld.

> **Meetresultaten D16:** *(vul in bij uitvoering)*

---

# FASE 4 — Oververhitting

*Doel: ritme in het schieten, zonder inventarisbeheer.*

### Ticket D17 — De warmtemechaniek

- **Context:** `huidigeSchotCooldown()` is de enige rem, en upgrades maken die
  alleen korter (0,26 → 0,07 s).
- **Doel:** blijven vuren wordt zelfbeperkend.
- **Constanten:**
  ```js
  const WARMTE_PER_SCHOT       = 9;    // ≈11 schoten tot oververhit
  const WARMTE_AFKOELING       = 28;   // per seconde
  const WARMTE_AFKOEL_VERTRAGING = 0.35; // s nadat je stopt met vuren
  const WARMTE_HERVAT_DREMPEL  = 35;   // hysterese, zie hieronder
  ```
- **Waarom een tweede drempel.** Zonder `WARMTE_HERVAT_DREMPEL` zit je bij 99
  in een gestotter van blokkeren-en-weer-mogen. De hysterese maakt
  oververhitting een echte onderbreking van ~2,3 s (65 punten ÷ 28/s).
- **Waarom een afkoelvertraging.** Zonder die vertraging koelt het wapen tussen
  twee schoten door al af: bij cooldown 0,26 s is dat 7,3 punten per schot,
  bijna evenveel als de 9 die je erbij doet. De meter zou dan nergens naar
  voelen.
- **Interactie met bestaande systemen:** de `vuurtempo`-upgrade en de
  combo-vuurtempo-multiplier laten je sneller vuren en dus sneller
  oververhitten. Dat is bewust: de upgrade krijgt eindelijk een keerzijde.
  Reken het na — bij cooldown 0,07 s vuur je 14,3 schoten/s = 129 warmte/s
  tegen 28/s afkoeling, dus oververhit in 0,9 s. Dat is streng; D19 is het
  tegenwicht.
- **Acceptatie:** `test-dnm-warmte.mjs`: opbouw per schot, afkoeling met
  vertraging, blokkade bij 100, hervatten pas onder 35, en dat een hogere
  vuurtempo-upgrade aantoonbaar sneller oververhit.

### Ticket D18 — Warmte zichtbaar en hoorbaar maken

- **Doel:** de speler moet zonder HUD-staren voelen hoe heet het wapen is.
- **Stappen:**
  - HUD-balk van koel naar rood, met een duidelijke oververhit-stand.
  - Het wapenmodel gloeit mee (emissive op de loop, oplopend met de warmte).
    **Let op:** `mat()` levert voor materialen met `extra` altijd een uniek
    object (zie `ARCHITECTURE_NOTES_monument.md` §3.3) — hier is dat precies
    wat je wilt, want het is één materiaal voor één wapen.
  - Stoompluim bij oververhitting via de bestaande brokstukken-pool.
  - Eén geluid via de bestaande `piep()` — geen nieuw audiosysteem.
- **Acceptatie:** `test-dnm-warmte-hud.mjs`: de balk volgt `warmte`, de
  gloed-intensiteit loopt mee, en de oververhit-stand is visueel
  onderscheidbaar.

### Ticket D19 — Koeling als vierde upgrade

- **Doel:** de speler een tegenwicht geven tegen zijn eigen vuurtempo.
- **Stappen:** vierde upgrade in de Bijenkorf-winkel (`Digit4`): verlaagt
  `WARMTE_PER_SCHOT` en/of verhoogt `WARMTE_AFKOELING` per niveau.
- **Let op:** de hotkey-afhandeling zit op `Digit1/2/3` binnen
  `bijenkorfShopOpen` (regel 2228) — die lijst moet mee, de winkel-UI in
  `updateArcadeUI()` ook, en `upgradeKosten()` krijgt een vierde basisprijs.
  En D9's `resetRun()` moet de vierde upgrade meenemen.
- **Acceptatie:** `test-dnm-koeling.mjs`: prijsformule, effect per niveau, en
  dat het aantal schoten tot oververhitting meetbaar stijgt.

---

# FASE 5 — Het monument wordt een personage

### Ticket D20 — Zichtbare schadestaten

- **Context:** `spel.monumentHP` is alleen een getal in de HUD.
- **Doel:** de staat van het monument afleesbaar maken zonder naar de HUD te
  kijken — dat is wat een verdedigingsspel spannend maakt.
- **Stappen:** drie drempels (66 %, 33 %, 10 %) met oplopende zichtbare schade:
  scheuren, ontbrekende blokken, scheefstand, rook, en bij de laatste trap een
  knipperend rood licht. Alles met de bestaande `blok()`/`mat()`-helpers; geen
  textures.
- **Let op:** herstel via de Koninklijke Reparatie (+25 HP) moet terugschakelen,
  en de overgang mag maar één keer per drempel vuren. Gebruik hetzelfde patroon
  als `comboTier()` (regel 2698): een aparte tier-functie plus een bewaarde
  vorige tier, niet een reeks losse `if`-checks.
- **Acceptatie:** `test-dnm-monument-schade.mjs`: elke drempel schakelt de
  juiste staat, herstel schakelt terug, en de overgangen gebeuren precies één
  keer per drempel (ook bij herhaald heen-en-weer over de grens).

---

# FASE 6 — Platform

*Doel: dezelfde bereikbaarheid als Undead. Deze fase raakt de gameplay niet en
kan dus veilig als laatste.*

### Ticket D21 — Kwaliteitsinstellingen

- **Context:** alles staat hard aan: `antialias: true`, `pixelRatio` tot 2,
  `PCFSoftShadowMap`, 2048²-shadowmap, 18 duiven, toeristen, een rijdende tram.
  Geen enkele schakelaar.
- **Doel:** Laag/Normaal/Hoog, met dezelfde opzet als Undead
  (`KWALITEIT_PRESETS`, opgeslagen keuze, apparaat-afhankelijke terugval).
- **Stappen:** pixelratio, schaduwen aan/uit, schaduwresolutie, aantal
  duiven/toeristen/trams, brokstuk-levensduur. Bij het laden de opgeslagen
  keuze toepassen; op een grof-pointer-apparaat standaard `laag`.
- **Let op — twee lessen uit Undead, neem ze over:**
  1. Pass-vlaggen moeten bij het **laden** uit de preset gelezen worden, niet
     alleen bij een knopdruk (T187), anders gelden ze pas na de eerste
     wijziging.
  2. Kwaliteit runtime omschakelen forceert tientallen shader-recompilaties.
     Tests moeten de keuze vóór navigatie in `localStorage` zetten, niet
     achteraf omschakelen — anders worden ze flaky.
- **Acceptatie:** `test-dnm-kwaliteit.mjs`, inclusief de laad-terugval.

### Ticket D22 — Instellingenscherm

- **Doel:** kwaliteit, muisgevoeligheid (nu hard `0.0022`, regel 2287) en
  geluid aan/uit op één plek in het startscherm.
- **Acceptatie:** `test-dnm-instellingen.mjs`: elke instelling werkt en
  overleeft een herladen.

### Ticket D23 — Touch: besturingsgate loskoppelen van Pointer Lock

- **Context:** identiek probleem als Undead's T176.
  `document.pointerLockElement === renderer.domElement` staat op **vier**
  plekken (regels 2238, 2244, 2370, 3473) en bestaat niet op mobiel.
- **Doel:** één `besturingActief()`-functie met een modus (`muis`/`touch`),
  precies zoals Undead het heeft opgelost.
- **Let op:** de modus wordt gezet door de **eerste echte invoer**, niet door
  UA-sniffing of `maxTouchPoints` — die liegen allebei. Geleerde les uit
  Undead.
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
- **Let op:** de bouwmenu's uit fase 3 en de winkel leunen op `Digit1/2/3/4` —
  die moeten op touch een eigen knoppenrij krijgen.
- **Acceptatie:** `test-dnm-touch-bouwen.mjs`: een toren bouwen, upgraden en
  repareren met alleen aanrakingen.

### Ticket D26 — Touch: liggend, schermindeling, veilige zones

- **Doel:** draaischerm bij staande stand, `env(safe-area-inset-*)`, fullscreen
  bij het starten, wake lock, en een HUD die op 740 × 360 past.
- **Let op:** de HUD heeft nu **zestien** vaste elementen (zie
  `ARCHITECTURE_NOTES_monument.md` §1.1), en daar komen de warmtebalk, de
  bouwfase-aftelling en de touchknoppen nog bij. Neem de overlap-meting uit
  Undead over: alle zichtbare vaste UI-rechthoeken op 740 × 360, geen enkele
  mag overlappen of buiten beeld vallen. Dat is de goedkoopste manier om deze
  hele klasse fouten te vangen.
- **Ook meenemen:** de Wake Lock API laat automatisch los bij `document hide` —
  dat vereist een `visibilitychange`-handler die opnieuw aanvraagt. In
  touchmodus is er geen pointer-lock-signaal dat dat voor je doet.
- **Acceptatie:** `test-dnm-mobiel.mjs` met die overlap-meting.

---

## 8. Beslismomenten

Na elke fase stopt de uitvoerder en vraagt of we doorgaan:

| Na fase | Vraag aan de eigenaar |
|---|---|
| 0 | Staat het vangnet goed genoeg om de herschaling in te gaan? |
| 1 | **Speelt de nieuwe schaal?** Het belangrijkste beslismoment van het plan — als 1:3 niet goed voelt, is 1:4 of 1:2,5 nog een kleine ingreep, maar alleen nu. |
| 2 | Voelt de run af genoeg om er systemen bovenop te bouwen? |
| 3 | Is de tower defense-kern leuk? Zo niet: bijstellen vóór fase 4, niet erna. |
| 4 | Geeft oververhitting het beoogde ritme, of is het alleen maar hinderlijk? |
| 5 | Nog door met platformwerk, of is de game af genoeg? |

## 9. Openstaande ontwerpvragen (bewust nog niet beslist)

Genoteerd zodat ze niet stilletjes door de uitvoerder worden ingevuld:

1. **Derde torentype.** Fase 3 levert er twee (geschut, hek). Een derde —
   vertrager, mijnenveld of schijnwerper — pas beslissen als die twee
   gebalanceerd zijn en we weten welk gat er nog is.
2. **Wat doen de torens tussen runs?** Nu: alles weg bij reset. Alternatief zou
   meta-progressie zijn, maar dat is expliciet buiten scope gehouden.
3. **Blijft de special-meter (X) zoals hij is?** Met torens erbij kan die
   overbodig of juist essentieel worden. Meten in D16.
4. **Moeilijkheidsgraden.** Undead heeft ze, deze game niet. Pas zinvol als de
   basiscurve na fase 3 staat.
5. **Wordt `kiesSpawnPoort()` gewogen?** Hij loot nu volledig uniform. Met
   torens erbij wordt "welke poort komt er nu" een veel scherpere vraag — maar
   een gewogen loting die je poortkeuze straft, kan ook oneerlijk voelen.
   Beslissen na fase 3.
6. **Moet de robot-botsstraal `config.schaal` gaan respecteren?** Nu botst een
   tank als een normale robot. Op de nieuwe schaal met smallere straten wordt
   dat zichtbaar — maar het repareren ervan maakt tanks meteen vatbaarder voor
   vastlopen. Meten in D6, beslissen daarna.
