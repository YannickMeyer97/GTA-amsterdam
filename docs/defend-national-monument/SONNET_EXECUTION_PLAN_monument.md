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
| 7 | Pariteit | **Testsuite + kwaliteitsinstellingen** *(touch geschrapt na de review, zie §10)* |
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

> **Meetresultaten D6:** bevestigd met `meet-dnm-afstanden.mjs`: Damstraat
> 6,7s, Rokin 8,9s, Damrak 9,1s bij het plafond — exact de voorspelde
> onder-de-drempel-uitkomst. Toegepast: optie 1 (poorten naar buiten, met een
> laterale i.p.v. pure radiale verschuiving — Damrak had op zijn
> oorspronkelijke bearing letterlijk geen 2 m ruimte meer) gecombineerd met
> een milde variant van optie 2 (snelheidsplafond 3,2 → 3,0, effectief
> 3,52 → 3,30 m/s). Herhaalde meting: alle vijf poorten 10,7–12,5s bij het
> plafond, wave 1 op 15,2–26,4s. Volledig verslag in
> `ROADMAP_monument.md` onder D6.

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

> **Volgorde (review na D6, §10):** uitvoeren **direct na D11**, niet na D14.
> Met 4,5 s tussen waves zijn D12–D14 niet eerlijk te speeltesten.

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

> **Meetresultaten D16** (`meet-dnm-economie.mjs`, volledige uitleg in
> `ROADMAP_monument.md`):
>
> - **Eerste meting, met de startwaarden uit dit plan.** Eén geschuttoren van
>   niveau 1 per actieve poort hield waves 1–9 alleen, zonder speler. Na
>   wave 5 had je €1.728, genoeg voor 3,2 volledig uitgeruste poorten (doel:
>   één).
> - **Bijgesteld.**
>   - Munt: €5–25 → €2–10.
>   - Wave-bonus: 40 + 15·wave → 25 + 10·wave.
>   - Geschuttoren: €150/200/300, 10/12/14 m, 1,2/1,0/1,0 s.
>   - Hek: €100/100/150.
> - **Na bijstelling.**
>   - Na wave 5 heb je €800 in het basisscenario (1,1 poort) en €1.330 bij goed
>     spel (1,9).
>   - Torens alleen houden het tot wave ~7 betaalbaar, vanaf wave 15 niet
>     meer.
> - **Nog open:** de speeltest door de eigenaar (acceptatiecriterium), met
>   als concrete vraag of de vroege waves met één toren per poort te makkelijk
>   zijn.

---

# FASE 4 — Oververhitting

*Doel: ritme in het schieten, zonder inventarisbeheer.*

> **Voorwaardelijk (review na D6, §10):** deze fase start pas nadat de
> eigenaar na fase 3 expliciet heeft beslist. Torens nemen een deel van het
> schietwerk over, en warmte duwt de speler dezelfde kant op — samen kan dat
> schieten als straf laten voelen. Opties bij het beslismoment: zoals
> beschreven, een mildere variant (alleen merkbaar bij hoge
> vuurtempo-upgrades) of schrappen.

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

> **Volgorde (review na D6, §10):** uitvoeren **direct na D9**, als laatste
> ticket van fase 2. Klein, puur visueel, geen afhankelijkheid van torens —
> en het monument moet al bedreigd voelen vóór de torenfase begint.

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

> **Ingekort (review na D6, §10):** alleen D21 en D22 blijven. D23–D26
> (touch) zijn **geschrapt** — deze game leunt op WASD, T, X en 1–4, en vier
> tickets touchwerk wegen daar niet tegen op. De specificaties blijven
> hieronder staan als referentie, mocht het ooit terugkomen.

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
- **Uitgevoerd (na D42):**
  - Presets Laag/Normaal/Hoog; standaard Hoog, op een grof-pointer-apparaat
    Laag.
  - Trams zitten er niet in: de tram staat stil (geparkeerd decor), dus er
    valt niets te besparen.
  - `test-dnm-kwaliteit` (12 checks) is groen. Zie het verslag in de
    ROADMAP, bij D42.

### Ticket D22 — Instellingenscherm

- **Doel:** kwaliteit, muisgevoeligheid (nu hard `0.0022`, regel 2287) en
  geluid aan/uit op één plek in het startscherm.
- **Acceptatie:** `test-dnm-instellingen.mjs`: elke instelling werkt en
  overleeft een herladen.

### Ticket D23 — Touch: besturingsgate loskoppelen van Pointer Lock ✗ GESCHRAPT (review na D6)

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

### Ticket D24 — Touch: lopen, kijken, vuren ✗ GESCHRAPT (review na D6)

- **Doel:** virtuele stick links, kijken rechts, vuurknop.
- **Let op:** de vuurknop mag de kijk-drag niet stelen — in Undead was dat een
  echte speeltest-bug (je kon niet vuren en tegelijk rondkijken). Bouw hem
  meteen goed: de vuurknop registreert óók als kijkvinger.
- **Acceptatie:** `test-dnm-touch.mjs` met Playwright's `hasTouch`-context.

### Ticket D25 — Touch: contextknop en bouwen met je duim ✗ GESCHRAPT (review na D6)

- **Doel:** T (interactie) en de bouwmenu's bruikbaar zonder toetsenbord.
- **Stappen:** contextknop die toont wat de huidige interactie is (bouwen,
  upgraden, repareren, kerkklok), plus een knop voor de special (X).
- **Let op:** de bouwmenu's uit fase 3 en de winkel leunen op `Digit1/2/3/4` —
  die moeten op touch een eigen knoppenrij krijgen.
- **Acceptatie:** `test-dnm-touch-bouwen.mjs`: een toren bouwen, upgraden en
  repareren met alleen aanrakingen.

### Ticket D26 — Touch: liggend, schermindeling, veilige zones ✗ GESCHRAPT (review na D6)

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
| 3 | Is de tower defense-kern leuk? Zo niet: bijstellen vóór fase 4, niet erna. **Plus (review na D6):** gaat fase 4 door zoals beschreven, als mildere variant, of niet? |
| 4 | Geeft oververhitting het beoogde ritme, of is het alleen maar hinderlijk? *(vervalt als fase 4 geschrapt wordt)* |
| 5 | *(vervallen — D20 is naar fase 2 verhuisd)* |
| 6 | Na D21/D22: is de game af genoeg, of pakken we D27 (pijlen) nog op? |

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
5. ~~**Wordt `kiesSpawnPoort()` gewogen?**~~ **Beslist in de review na D6:**
   geen gewogen loting maar aangekondigde poorten — zie D28 (§10). De
   speler weet vooraf waar de robots vandaan komen, dus een poortkeuze voor
   een toren wordt een voorspelling i.p.v. een gok.
6. **Moet de robot-botsstraal `config.schaal` gaan respecteren?** Nu botst een
   tank als een normale robot. Op de nieuwe schaal met smallere straten wordt
   dat zichtbaar — maar het repareren ervan maakt tanks meteen vatbaarder voor
   vastlopen. Meten in D6, beslissen daarna.

---

## 10. Bijsturing na de review (na D6)

Na D6 en de speeltest daarop is het resterende plan doorgelicht op de vraag
"wordt dit een goed en fijn spel". Twee bevindingen stuurden de keuzes:

1. **Het spawnritme is het echte probleem.** `updateWaveSysteem()` vult na
   elke kill direct aan tot `maxActieveRobots`, en `kiesSpawnPoort()` loot
   uniform over alle vijf poorten. Er lopen dus altijd 5–13 robots verspreid
   over de hele kaart — geen eb en vloed, geen "daar komen ze". Dat is de
   oorzaak van de speeltest-klacht over pijltjes overal (D27), en het maakt
   een toren per poort (D10) zwak: die dekt altijd maar 20 % van de spawns.
2. **De speler maakt torens overbodig.** Hitscan, one-shot voor vier van de
   vijf types, `raycaster.far` = 50 m — en de poorten liggen op 35–41 m van
   de monumentrand (gemeten, `meet-dnm-afstanden.mjs`). Vanaf het monument
   bereik je dus elke poort. Een toren van €120 met 12 m bereik voegt
   daar weinig aan toe.

Beide stonden in het oorspronkelijke plan als "beslissen na fase 3", maar ze
bepalen of fase 3 leuk wordt. Ze komen daarom nu vóór de torens.

### Besluiten van de eigenaar

| Onderwerp | Besluit |
|---|---|
| Spawnritme | **Aangekondigde poorten** → nieuw ticket D28 |
| Wapenbereik | **Beperken** zodat torens nodig worden → nieuw ticket D29 |
| Variatie na wave 5 | **Themagolven** → nieuw ticket D30 |
| Bouwfase | **D15 naar voren**, direct na D11 |
| Monumentschade | **D20 naar voren**, direct na D9 (einde fase 2) |
| Oververhitting | **Beslissen na fase 3** — fase 4 is voorwaardelijk |
| Touch | **Geschrapt** (D23–D26); alleen D21/D22 blijven |
| Pijlen (D27) | Blijft backlog; herbeoordelen ná D28 |

### Nieuwe uitvoeringsvolgorde

Fase 2: D7 → D8 → D9 → **D20**
Fase 3: **D28** → **D29** → D10 → D11 → **D15** → D12 → D13 → D14 → D16 → **D30**
Fase 4: D17 → D18 → D19 *(alleen na expliciet besluit)*
Fase 6: D21 → D22
Backlog: D27

Ticketnummers zijn bewust niet hernummerd — ze staan al in commits en
documenten. `ROADMAP_monument.md` toont de tabellen in deze volgorde.

### Ticket D28 — Aangekondigde poorten

- **Context:** zie bevinding 1 hierboven. Het `objectiveUI`-regeltje
  "Robots komen uit: …" toont nu `spel.laatsteSpawnPoort` en springt bij
  elke spawn naar een andere poort — informatie die niets betekent.
- **Doel:** elke wave komt uit een klein, vooraf bekend aantal poorten. De
  speler weet waar het gevaar vandaan komt en kan daarop positioneren (en
  vanaf fase 3 bouwen).
- **Stappen:**
  - `spel.actievePoorten` (array van poortnamen). Wave 1–2: **één** poort,
    vanaf wave 3: **twee**. Constanten bovenaan het blok met een
    waarom-comment.
  - `kiesActievePoorten(wave, vorige)`: kies de set, en nooit exact dezelfde
    set als de vorige wave (anders voelt het niet als een nieuwe wave).
  - `kiesSpawnPoort()` loot voortaan alléén uit `spel.actievePoorten`.
  - **Aankondigen vóór de wave, niet bij de start:** de set voor wave N+1
    wordt gekozen en getoond zodra wave N compleet is (het moment waarop nu
    de wave-bonus valt). Zo gebruikt de speler de pauze om te positioneren —
    en na D15 om te bouwen. Wave 1 kiest bij `startWave(1)`.
  - Aankondiging, drie lagen: (1) banner via de bestaande
    `toonWaveBanner()` ("Volgende wave via Damrak en Rokin"), (2) het
    `objectiveUI`-regeltje toont de actieve poorten, stabiel voor de hele
    wave, (3) een **lichtbaken** per actieve poort: een dunne, hoge,
    half-transparante kolom die boven de daken uitsteekt, zodat je hem vanaf
    het monument ziet zonder de HUD te lezen. Plus één geluid via `piep()`.
  - Minimap: actieve poorten gemarkeerd (kleine rand of pijlpunt aan de
    kaartrand) — `tekenMinimap()` bestaat al.
- **Niet veranderen:** `maxActieveRobots`, het aanvulmechanisme,
  `waveDoel`, de robot-AI en het Kalverstraat-`tussenpunt`. Alleen de
  poortkeuze verandert — zo blijft het effect meetbaar.
- **Let op:** `spel.laatsteSpawnPoort` wordt nog op meer plekken gezet
  (`spawnRobot`); zoek alle lezers op vóór je het regeltje ombouwt. D9's
  `resetRun()` moet `actievePoorten` meenemen (als D9 al af is: hier
  toevoegen, met een check in `test-dnm-reset.mjs`).
- **Acceptatie:** `test-dnm-poorten.mjs`: over een gesimuleerde wave komen
  alle spawns uit `spel.actievePoorten`; wave 1–2 heeft er één, wave 3+
  twee; twee opeenvolgende waves hebben nooit dezelfde set; de set van wave
  N+1 staat vast vóórdat wave N+1 start; de bakens staan precies bij de
  actieve poorten. **Plus speeltest:** herbeoordeel D27 (pijlen) direct na
  dit ticket.

### Ticket D29 — Wapenbereik beperken

- **Context:** zie bevinding 2. `raycaster.far = 150 * ARENA_SCHAAL` (50 m);
  poorten op 35,1–41,2 m van de monumentrand.
- **Doel:** vanaf het monument dek je het laatste stuk van een corridor,
  niet de poort zelf. Wie verder wil, moet lopen (en munten liggen dan ook
  verder weg) of een toren zetten.
- **Stappen:**
  - Eerst meten: breid `meet-dnm-afstanden.mjs` uit met, per poort, de
    afstand van de monumentrand tot de twee toekomstige bouwplekken op 25 %
    en 55 % van de lijn (formule uit D10). Dan pas het getal kiezen.
  - Startpunt: **~25 m** (de helft van nu). Dan reikt het schot vanaf het
    monument niet tot een poort, maar geeft het bij het plafondtempo
    (3,30 m/s) nog ~7,5 s vuurvenster per robot — genoeg om te reageren.
  - Eén constante `WAPEN_BEREIK` met waarom-comment, gebruikt voor
    `raycaster.far`.
  - **Feedback buiten bereik is verplicht.** Het schot is pure hitscan
    zonder spoor: een schot dat te kort komt, ziet er nu precies zo uit als
    een misser. Voeg een goedkope aanwijzing toe — bijvoorbeeld een kort
    vonkje of stofwolkje op het punt waar het bereik ophoudt, via de
    bestaande brokstukken-pool — zodat de speler leert "te ver" te herkennen.
  - Houd het spelersbereik ruim boven het torenbereik (12 m in D11); de
    speler blijft het sterkste individuele wapen, alleen niet overal
    tegelijk.
- **Niet veranderen:** schade, cooldown, one-shot-gedrag. Alleen het bereik.
- **Acceptatie:** `test-dnm-wapenbereik.mjs`: een robot net binnen
  `WAPEN_BEREIK` wordt geraakt, net erbuiten niet; vanaf de speler-startplek
  ligt geen enkele poort binnen bereik; het buiten-bereik-effect verschijnt
  alleen bij een schot dat niets raakt binnen bereik. **Plus speeltest** —
  voelt het als "ik moet kiezen" of als "ik kan niets"?

### Ticket D30 — Themagolven

- **Context:** vanaf wave 5 ligt de typemix vast; daarna stijgen alleen
  aantal en snelheid. Een eindeloze run wordt eentonig.
- **Doel:** af en toe een wave met een eigen karakter en naam.
- **Stappen:**
  - Elke **4e wave** (4, 8, 12, …) is een themagolf. Welke: roteren door de
    lijst (`(wave / 4 − 1) % aantal`), niet loten — deterministisch en dus
    testbaar, en de speler ziet ze allemaal voordat er één terugkomt.
  - `THEMAGOLVEN`-tabel + een **pure** `themaVoorWave(n)` die `null` of een
    thema teruggeeft. `startWave()` leest daaruit; niets muteert een
    basiswaarde die later "teruggezet" moet worden (architectuurregel 6).
  - Drie voorstellen (namen definitief bij uitvoering, eigen NL-namen, geen
    bestaande IP):
    1. **Tankkonvooi** — alleen tanks, `waveDoel` × 0,5, via één poort.
    2. **Spitsuur** — alleen sprinters, `waveDoel` × 1,3, via één poort.
    3. **Grachtenmist** — normale mix, maar de mist trekt dicht
       (`scene.fog.near/far` fors omlaag, gezet vanuit het thema bij
       `startWave`, en bij elke gewone wave weer uit de basiswaarden). Werkt
       samen met D29: je ziet ze pas als ze binnen bereik zijn.
  - Eigen banner via `waveBannerTekst()` en een iets hogere wave-bonus
    (te ijken; D16's meetscript opnieuw draaien).
  - De poortkeuze komt uit D28 (`kiesActievePoorten`); een thema mag het
    aantal poorten overschrijven.
- **Let op:** D16 meet eerst de basiscurve zónder thema's. Pas daarna dit
  ticket, anders meet D16 een curve met uitschieters.
- **Acceptatie:** `test-dnm-themagolven.mjs`: waves 4/8/12 krijgen het
  juiste thema in de juiste volgorde, de overrides gelden alleen die wave,
  de wave daarna is weer normaal (inclusief mist), en de banner toont de
  themanaam.

---

## 11. Fase M — Make-over van de Dam (na fase 3, vóór fase 4)

### 11.1 Aanleiding

Na fase 3 heeft de eigenaar gespeeld. Het oordeel: de kaart werkt niet
lekker. Robots lopen niet duidelijk, de kaart is onhandig en niet mooi, de
Bijenkorf-winkel staat "medium" gepositioneerd, en "eigenlijk alles is net
niet". De vraag was een complete make-over van de kaart en het
interactiesysteem, waarbij het wel de Dam moet blijven.

Wat de code daarover zegt:

- **Robots lopen rechtdoor en glijden langs gevels.** Er zijn geen routes;
  robots lopen in een rechte lijn naar het monument en lossen botsingen op.
  Bij Rokin en Nieuwendijk loopt die lijn door gebouwen heen, de
  Nieuwendijk-robots persen zich door een steeg van ~1,5 m, en de
  Kalverstraat heeft een hardgecodeerd tussenpunt nodig.
- **De wereld is als decor gebouwd, niet als speelveld.** Fase 3 moest
  bouwplekken en hekken aanpassen aan toevallige straatbreedtes, en zelfs
  een looproute simuleren om te weten waar robots eigenlijk lopen.
- **De gebouwen staan uitgerekt.** Sinds D4 is `wereld.scale` gelijk aan
  (1/3, 0,6, 1/3): horizontaal drie keer verkleind, verticaal maar 1,7 keer.
  Elk gebouw is daardoor bijna twee keer te hoog voor zijn breedte.
- **De interactie is versnipperd.** Er zijn vier soorten interactiepunten
  (winkel, kerkklok, reparatie, bouwplek), elk met net een andere
  bediening. Kerkklok en Reparatie liggen aan de westkant, de winkel aan de
  oostkant.

### 11.2 Besluiten van de eigenaar

| Onderwerp | Besluit |
|---|---|
| Timing | **Nu**, na fase 3 en vóór fase 4. Fase 3 is als basisstand vastgelegd. |
| Kaartopzet | **Compacte Dam-arena, maar realistisch.** Gebouwen moeten echter en herkenbaarder worden, de vloer deels kinderkopjes. |
| Detailniveau | **Herkenbaar en gedetailleerd, richting maximaal detail.** |
| Straten | **De vijf huidige:** Damrak, Rokin, Damstraat, Kalverstraat en Nieuwendijk. |
| Robotroutes | **Zichtbare vaste routes.** |
| Routes zichtbaar via | **Rijbaan als pad** + **oplichtende route bij de aankondiging.** |
| Interactie | **Commandopost bij het monument**, voor wapen-upgrades en monumentreparatie. De Kerkklok blijft bij de Nieuwe Kerk; torens beheer je op hun bouwplek. |

### 11.3 Ontwerpprincipes (hard)

1. **Topologisch echt, maatvoering speelgericht.** Alles staat op de juiste
   plek ten opzichte van elkaar: het Paleis west, de Nieuwe Kerk noordwest,
   het monument oost, Krasnapolsky erachter, de Bijenkorf op de hoek
   Dam–Damrak aan de oostkant van het Damrak, Hotel TwentySeven (Industria)
   op de zuidoosthoek bij het Rokin, de straten waar ze in het echt
   uitkomen. De ligging is in D31 opgezocht (`PLATTEGROND.html`, "Zo ziet de
   echte Dam eruit"). De afstanden op het plein
   worden gekozen op speelbaarheid, niet lineair uit de echte kaart, want de
   Kalverstraat en de Nieuwendijk liggen in het echt twee keer zo ver weg
   als het Damrak.
2. **Mensmaat 1:1, één schaal voor alles.** Er komt geen aparte
   hoogteschaal meer en ook geen `wereld.scale`: de wereld wordt direct in
   meters gebouwd. Deuren, verdiepingen, ramen en de pyloon hebben hun echte
   maat. Een gebouw mag korter of ondieper zijn dan in het echt (minder
   traveeën), maar wordt nooit vervormd: het Paleis krijgt 13 traveeën in
   plaats van 23, maar zijn koepel blijft ~51 m hoog.

   Het eerdere voorstel van ~1:2 is in D31 verworpen. Bij 1:2 wordt een deur
   1,1 m hoog en de speler van 1,7 m een reus, zodat de Dam oogt als een
   maquette.

   **Bij M2 aangevuld:** gebouwen rond het plein hebben ook minder
   verdiepingen dan in het echt (~25% lager). Het plein is 44 m breed in
   plaats van ~100 m; op echte hoogte werd het een smalle, hoge ruimte.
   Verdiepingen, deuren en ramen blijven op ware maat. De onderlinge
   verschillen blijven zoals in het echt: het Paleis met koepel het hoogst,
   dan de Nieuwe Kerk en de Beurstoren, dan de warenhuizen en hotels, dan de
   grachtenpanden.
3. **Eén bron voor de indeling.** Eén `DAM_LAYOUT`-object bevat plein,
   straten, rijbanen, routes, poorten, bouwplekken, commandopost en kerkklok.
   Gebouwen, botsingen, robotroutes, bouwplekken, bakens en minimap lezen
   allemaal daaruit. Niets wordt meer afgeleid door te simuleren waar robots
   toevallig lopen.
4. **Rijbanen zijn heilig.** Geen decor, obstakel of gebouwdeel op een
   rijbaan of routestrook. Een test bewaakt dat.
5. **Robots volgen routes.** Elke straat heeft een vaste route (een lijn met
   bochten) over de rijbaan naar het monument. Robots volgen die lijn met
   een kleine zijwaartse spreiding binnen de rijbaan, niet langer rechtdoor
   met botsingen oplossen.
6. **De gemeten speelmaten blijven randvoorwaarden.** Met vaste routes
   gelden ze voor de routelengte, niet voor de rechte lijn. Zo zijn ze in
   D31 vastgelegd:
   - **routelengte poort → monumentrand 38–52 m** (D6): bij het
     snelheidsplafond van 3,3 m/s is dat ≥ 11,5 s, voor de langzaamste
     wave-1-robot ≤ 36 s;
   - **`WAPEN_BEREIK` 22 m** (D29): geen poort binnen bereik van de
     monumentrand of de startplek, en per route één bouwplek binnen en één
     buiten bereik;
   - **verste bouwplek ≤ 40 m van de monumentrand** (D15): heen en terug
     ≤ 11,5 s, binnen de bouwfase van 20 s. Dit was ≤ 35 m. Het is in D31
     verruimd, zodat Kalverstraat en Nieuwendijk een plek in hun eigen
     straat krijgen, waar een hek de straat echt afsluit;
   - **Kerkklok heen en terug 10–15 s** (D5/D6), nu gemeten vanaf de
     commandopost.
7. **Grey-box eerst, detail daarna.** De nieuwe indeling wordt eerst met
   simpele blokken gebouwd en gespeeld. Pas als die speelt, gaat er tijd in
   gevels en detail.
8. **Alles blijft single-file, zonder externe assets.** Texturen worden
   procedureel op een canvas getekend, zoals Undead doet (kopiëren en
   aanpassen, geen gedeelde code).

### 11.4 Wat blijft en wat wordt vervangen

| Blijft (op de nieuwe kaart herplaatst) | Wordt vervangen |
|---|---|
| Poortaankondiging, bakens, themagolven (D28/D30) | De hele wereldbouw van STAP 2 (~2.060 regels) |
| Wapenbereik en stofwolkje (D29) | Rechtdoor lopen + `tussenpunt` + vastloop-uitwijken als hoofdmechaniek |
| Torens, hek, niveaus, bombers, bouwfase (D11–D15) | `looproute()`-simulatie en de afgeleide `BOUWPLEKKEN` (D10) |
| Economie (D16, herijkt in D43) | Bijenkorf-kiosk en Koninklijke Reparatiepost als losse plekken |
| Eindscherm, highscore, reset, monumentschade (fase 2) | `shopUI` en `bouwUI` als twee losse menu's |
| Het monumentmodel met schadestaten | `wereld.scale` met aparte hoogteschaal |

Het vastloop-uitwijken blijft als vangnet in de code, maar met vaste routes
op vrije rijbanen hoort het niet meer af te gaan. Een test meet dat.

### 11.5 Tickets

Nummering loopt door vanaf D30. Dit is een grotere fase dan fase 3; de twee
beslismomenten (M1, M2) zijn bedoeld om vroeg bij te sturen, niet pas aan
het eind.

#### Ticket D31 — Plattegrond ontwerpen en laten goedkeuren

- **Doel:** vóór er gebouwd wordt, ligt de nieuwe Dam vast op papier.
- **Stappen:**
  - Een plattegrond in bovenaanzicht (SVG of HTML-pagina), op schaal:
    - plein en gebouwvoetafdrukken;
    - de vijf straten met rijbanen en tramrails;
    - de vijf routes met bochten;
    - poorten, twee bouwplekken per route, commandopost, kerkklok,
      speler-startplek.
  - Per route de lengte tot de monumentrand, en toetsing aan de
    randvoorwaarden uit §11.3 punt 6.
  - Gebouwschaal kiezen, met per gebouw de maten. Gekozen is mensmaat 1:1
    (§11.3 punt 2).
  - Per gebouw een korte lijst kenmerken die er zeker in moeten (zie D37–D39),
    eventueel aangevuld met referentiefoto's van de eigenaar.
- **Acceptatie:** de eigenaar keurt de plattegrond goed → **beslismoment M1**.
- **Uitgevoerd:**
  - [`PLATTEGROND.html`](PLATTEGROND.html) bevat de indeling één keer, als
    JSON-blok (`dam-layout`). Tekening, maten en toetsing worden daar live
    uit berekend. In D32 wordt dat blok letterlijk `DAM_LAYOUT` in de game.
  - `tests/defend-national-monument/meet-dnm-plattegrond.mjs` laadt de
    pagina headless en faalt als één toets faalt. Stand: 37/37 goed (voorstel 2).
  - **M1:** voorstel 2 goedgekeurd door de eigenaar, na één correctie:
    Bijenkorf en Hotel TwentySeven op hun echte plek.

#### Ticket D32 — Nieuw fundament (grey-box)

- **Doel:** de nieuwe indeling speelbaar, met simpele blokken.
- **Stappen:**
  - `DAM_LAYOUT` als enige bron.
  - `GRENS`, botsingen (`registreerRechthoek` per voetafdruk) en speler-
    startplek komen daaruit.
  - Gebouwen als massieve blokken op de juiste voetafdruk en hoogte.
  - Vloer:
    - kinderkopjes op het plein (nieuwe procedurele textuur; de techniek is
      Undeads klinkertextuur, gekopieerd);
    - asfalt met tramrails op Damrak–Rokin;
    - stoepranden en trottoirs.
  - De oude wereldbouw van STAP 2 gaat eruit. Het monument en zijn
    schadestaten blijven.
- **Acceptatie:** `test-dnm-layout.mjs`:
  - `DAM_LAYOUT` in de game is gelijk aan het JSON-blok in
    `PLATTEGROND.html`, zodat de goedgekeurde plattegrond de bron blijft;
  - alle toetsen van de plattegrond gelden ook in de game;
  - elk geregistreerd obstakel ligt buiten elke rijbaan en routestrook (met
    marge);
  - `GRENS` omsluit poorten, bouwplekken, commandopost en kerkklok.

  De bestaande tests draaien mee; tests die aan de oude geometrie hingen,
  worden bijgewerkt, en per test staat vast waarom.
- **Uitgevoerd** (verslag in de roadmap):
  - **Afwijking 1:** naar voren gehaald uit D33. De bouwplekken komen al uit
    de layout (anders zouden ze op de nieuwe kaart op willekeurige plekken
    landen), en robots lopen de routepunten af in plaats van één
    tussenpunt. Het echte routevolgen op `s` blijft D33.
  - **Afwijking 2:** de schotschil (§11.7.3) is uitgesteld tot de eerste
    detailgevel (D37). Met één blok per gebouw is een raycast tegen
    `wereld` nog goedkoop.
  - **Tijdelijk tot D35:** reparatiepost en upgradekiosk staan bij de
    commandopost en voor de Bijenkorf.

#### Ticket D33 — Vaste routes over de rijbanen

- **Doel:** robots lopen herkenbaar hun straat af.
- **Stappen:**
  - Elke poort heeft een route: een lijst van punten uit `DAM_LAYOUT`.
  - Robots volgen die met een vaste zijwaartse positie binnen de rijbaan
    (bij het spawnen gekozen), draaien vloeiend in bochten en houden een
    minimumafstand tot een voorganger, zodat ze niet op één punt stapelen.
  - Vastgelegd in D31 (zie `PLATTEGROND.html`):
    - Damrak en Rokin volgen de rijbaan met tramrails, die west van het
      monument over het plein loopt, en buigen ~14 m voor het monument af
      naar de noord- of zuidzijde.
    - Damstraat komt langs Krasnapolsky en buigt op de hoek af naar de
      oostzijde.
    - Kalverstraat en Nieuwendijk zijn in het echt voetgangersstraten. Hun
      route loopt over een strook donkere klinkers tussen de kinderkopjes,
      steekt schuin het plein over en kruist de trambaan.
  - Bouwplekken komen uit `DAM_LAYOUT` en liggen op het trottoir naast de
    rijbaan. Een hek spant precies de breedte van de rijbaan, dus zonder de
    paaltjeslijn-truc van D13.
  - De bomber verlaat zijn route alleen voor een bouwwerk binnen bereik
    (D14) en keert daarna terug naar het dichtstbijzijnde routepunt.
- **Acceptatie:** `test-dnm-routes.mjs`:
  - per poort bereikt een robot van elk type het monument via de route;
  - hij wijkt nooit meer dan een halve rijbaan van de route af;
  - de vastloop-detectie gaat in een volle wave nul keer af;
  - een hek blokkeert de volle rijbaanbreedte.

  `test-dnm-hek.mjs`, `test-dnm-bouwplekken.mjs` en `test-dnm-kern.mjs` gaan
  over op de routes.
- **Uitgevoerd** (verslag in de roadmap). Twee afwijkingen van §11.7.4:
  - **`s` kinematisch.** `s` groeit met de loopsnelheid zolang de robot
    binnen 2 m van zijn routeplek is (`ROBOT_ACHTERSTAND`), niet via
    projectie; die blijft in bochten op het hoekpunt hangen.
  - **Laatste stuk.** Aan het eind van de route stuurt de robot recht op
    het monument af, zodat zijn baan hem niet net buiten de treffergrens
    laat eindigen.

#### Ticket D34 — Routes zichtbaar maken

- **Doel:** je ziet in de bouwfase waar de volgende wave langskomt.
- **Stappen:**
  - Tijdens de bouwfase lichten de routes van de aangekondigde poorten op,
    als een lichtspoor dat van de poort naar het monument over de rijbaan
    trekt. Tijdens de wave dimt het naar een zwak spoor.
  - Poortbakens verhuizen naar de straatingang, bij het straatnaambord.
  - De minimap tekent rijbanen en de actieve routes.
- **Acceptatie:** `test-dnm-route-zicht.mjs`: in de bouwfase lichten precies
  de aangekondigde routes op, in de wave zijn ze gedimd, en na een reset is
  niets meer aan. D27 (pijlen) wordt hierna opnieuw beoordeeld.
- **Uitgevoerd** (verslag in de roadmap). "Na een reset is niets meer aan"
  is getoetst als: geen fel spoor meer. Wave 1 heeft direct weer een actieve
  poort, dus die route is gedimd zichtbaar, net als zijn baken.

#### Ticket D35 — Commandopost bij het monument, één menu

- **Doel:** één plek voor upgrades en reparatie, en één bediening voor alles.
- **Stappen:**
  - Een commandopost aan de voet van het monument, aan de pleinkant: een
    klein paviljoen met luifel en toonbank.
  - T opent het menu: 1–3 wapen-upgrades (vuurtempo, bereik voor munten,
    loopsnelheid), 4 monument repareren.
  - De Bijenkorf-kiosk en de Koninklijke Reparatiepost verdwijnen als
    interactiepunt. De Kerkklok blijft bij de Nieuwe Kerk, als bewuste
    looproute met risico.
  - `shopUI` en `bouwUI` worden één menupaneel met dezelfde opbouw overal:
    - titel en genummerde opties met prijs;
    - "te duur" gemarkeerd;
    - T sluit, weglopen of pauzeren sluit ook.
  - HUD opruimen: de interactieprompt overlapt nu de besturingshulp onderin,
    en `waveUI`/`objectiveUI` overlappen op smalle schermen. Beide oplossen.
- **Acceptatie:** `test-dnm-commandopost.mjs`:
  - alle vier de opties werken, met de prijs zoals nu;
  - het menu sluit bij weglopen en bij pauze;
  - er zijn geen oude winkel- of reparatiepunten meer;
  - de overlapmeting van alle zichtbare vaste UI-rechthoeken op 1280×720 en
    1024×640 geeft geen enkele overlap.
- **Uitgevoerd** (verslag in de roadmap). De wrappers
  `bijenkorfShopOpenStand`, `bouwMenuStand` en `activeerBijenkorfUpgradeShop`
  blijven op de debug-hook, en lezen of openen nu het ene menu. Wacht op M2.

**Beslismoment M2 — speelt de grey-box?** De eigenaar speelt de nieuwe
indeling met simpele blokken. Lopen robots duidelijk, liggen bouwplekken en
commandopost goed, klopt het ritme? Zo niet, dan eerst bijstellen, vóór er
tijd in gevels gaat.

#### Ticket D36 — Textuurbibliotheek

- **Doel:** materialen die echt ogen.
- **Stappen:**
  - Undeads procedurele canvastexturen (baksteen, klinkers; seed per
    patroonnaam, texturen op wereldschaal) kopiëren en aanpassen.
  - Nieuw: kinderkopjes, zandsteen, natuursteen voor banden en lijsten,
    asfalt, leisteen voor daken, en glas.
  - Elke textuur is deterministisch (vaste seed), zodat elke laadbeurt er
    hetzelfde uitziet.
- **Acceptatie:** `test-dnm-texturen.mjs`: elke textuur bestaat, is
  deterministisch (twee keer tekenen geeft dezelfde bytes) en heeft de juiste
  wereldschaal.
- **Uitgevoerd:**
  - Baksteen, gele baksteen, zandsteen, natuursteen, leisteen en glas, naast
    de vloeren uit D32.
  - `TEXTUUR_STEEN`, `gevelMateriaal` en `textuurOpWereldschaal`.
  - De test toetst ook naadloosheid.
  - Zie het verslag in de ROADMAP.

#### Ticket D37 — Paleis op de Dam

- **Kenmerken:**
  - classicistisch, in lichte zandsteen die verweerd grijsgeel oogt;
  - drie bouwlagen plus zolder, met strakke rijen rechthoekige ramen;
  - een middenrisaliet met fronton en beeldhouwwerk;
  - geen grote hoofdingang, maar een rij kleine rondboogpoortjes op de
    begane grond;
  - de koepel met lantaarn en een windvaan in de vorm van een schip;
  - beelden op het dak.
- **Acceptatie:** schermafbeeldingen vanaf drie vaste standpunten, beoordeeld
  door de eigenaar, en het prestatiebudget uit D42 wordt niet overschreden.
- **Uitgevoerd:**
  - Alle kenmerken zijn gebouwd, samengevoegd tot 10 meshes; de draw calls
    zijn gedaald.
  - `test-dnm-paleis` telt de onderdelen met stralen.
  - D42 bestaat nog niet; het budget wordt daar vastgelegd, en het Paleis
    gaat ervan uit dat het daar ruim binnen valt.
  - De schermafbeeldingen liggen bij de eigenaar. Zie het verslag in de
    ROADMAP.

#### Ticket D38 — Nieuwe Kerk

- **Kenmerken:**
  - laatgotisch, baksteen met natuurstenen banden;
  - hoge spitsboogramen met maaswerk, en het grote transeptraam naar de Dam;
  - steile leien daken met een slank dakruitertje;
  - geen voltooide hoge toren, zoals in het echt.
- **Acceptatie:** als D37.
- **Uitgevoerd:**
  - Transeptgevel met het groot raam, maaswerk, portaal en traptorentjes.
  - Koor met apsis, ramen en steunberen.
  - Steile leien daken en de dakruiter tot 32 m.
  - `test-dnm-kerk`, en 9 meshes.
  - Zie het verslag in de ROADMAP.

#### Ticket D39 — Rond het monument: Bijenkorf, Krasnapolsky, Hotel TwentySeven, Madame Tussauds

- **Doel:** de gebouwen die je achter en naast het monument ziet, herkenbaar
  maken. Ligging en kenmerken zijn in D31 opgezocht; ze staan per gebouw in
  `PLATTEGROND.html`.
- **Stappen:**
  - **De Bijenkorf**, noordelijk van het monument, op de hoek Dam–Damrak aan
    de oostkant van het Damrak:
    - rode baksteen en natuursteen, vijf bouwlagen;
    - verticale pijlers op een sokkel, kroonlijst met attiek en balustrade;
    - segmentvormige frontons op de hoekpaviljoens en het midden, met een
      torenbekroning boven het midden;
    - alleen de naam in gewone letters, geen logo.
  - **Krasnapolsky**, oostelijk, recht achter het monument, tussen de
    Warmoesstraat en de Damstraat: een breed 19e-eeuws hotel met veel ramen,
    balkons en een luifel.
  - **Hotel TwentySeven in het Industria-gebouw**, op de zuidoosthoek, hoek
    Rokin:
    - bijna vrijstaand;
    - een asymmetrische Damgevel met een torenachtig bouwdeel onder een
      klokvormige koperen kap;
    - lichte baksteen met spaarzaam natuursteen.
  - **Het Peek & Cloppenburg-gebouw met Madame Tussauds**, tussen
    Kalverstraat en Rokin: vijf bouwlagen in lichte kalksteen.
- **De gevelnamen** staan er sinds M2 al, als letters op de grey-box
  (`GEVELNAMEN`); neem ze over in de echte gevels.
- **Direct na D39: besluit over de plek van de commandopost** (M2). Die
  blijft aan de monumentvoet, tenzij de eigenaar hem tegen de
  Bijenkorf-gevel wil. Daar staat hij ~14 m van het monument, en moeten de
  Kerkklok en de looptijden naar de verste bouwplekken opnieuw worden
  getoetst.
- **Acceptatie:** als D37.
- **Uitgevoerd:**
  - Alle vier de gevels, met de namen op het fries.
  - `test-dnm-rondom`.
  - Het besluit over de commandopost ligt bij de eigenaar.
  - Zie het verslag in de ROADMAP.

#### Ticket D40 — Straatwanden

- **Doel:** de vijf straten lezen als Amsterdamse straten.
- **Stappen:**
  - Gevelrijen met grachtenpandtypen (trap-, hals- en lijstgevels) in
    variatie.
  - Winkelpuien op de begane grond.
  - Kozijnen en ramen via instancing, zodat het detail niet in draw calls
    betaald wordt.
  - Een straatnaambord aan elke straatingang.
- **Acceptatie:** als D37, plus de draw calls per straatwand binnen budget.
- **Uitgevoerd:**
  - Rijen grachtenpanden in vier geveltypen met winkelpuien.
  - Vertexkleuren in plaats van instancing: ≤ 10 meshes per wand.
  - De Beurs van Berlage, en zeven tweezijdige straatnaamborden.
  - `test-dnm-straatwanden`.
  - Zie het verslag in de ROADMAP.

#### Ticket D41 — Sfeer en straatmeubilair

- **Stappen:**
  - Lantaarns, tramhaltes, fietsenrekken, bankjes, duiven en toeristen,
    uitsluitend buiten rijbanen en routestroken.
  - Licht en mist bijstellen voor de nieuwe materialen; de mist van
    Grachtenmist blijft werken.
  - Het decor rond het strijdtoneel bewust rustig houden (speeltest na D6).
- **Acceptatie:** `test-dnm-layout.mjs` blijft groen (niets op een rijbaan),
  plus schermafbeeldingen.
- **Uitgevoerd:**
  - Het meubilair staat in `DAM_LAYOUT` en is in de plattegrond
    getoetst.
  - `test-dnm-meubilair` en `test-dnm-layout` zijn groen.
  - De mist van Grachtenmist werkt ongewijzigd.
  - Zie het verslag in de ROADMAP.

#### Ticket D42 — Prestaties

- **Stappen:**
  - Meetscript `meet-dnm-prestaties.mjs`: draw calls, driehoeken,
    geometrieën, texturen en laadtijd, vanaf vaste standpunten.
  - Een budget vastleggen en halen, met instancing en samengevoegde
    geometrie, zodat het extra detail niet de framerate kost.
  - Direct aansluitend D21 (kwaliteitsinstellingen): met dit detailniveau is
    een Laag/Normaal/Hoog-schakelaar geen luxe meer.
- **Acceptatie:** het budget wordt gehaald op alle drie de standpunten, en de
  meetresultaten staan in de roadmap.
- **Uitgevoerd:**
  - Het budget staat in `test-dnm-prestaties` en wordt gehaald vanaf vijf
    standpunten; de meting staat in de ROADMAP.
  - Twee geheugenlekken gedicht (robots, effecten en munten maakten eigen
    geometrie die nooit werd opgeruimd).
  - D21 direct erna uitgevoerd, zie hieronder bij fase 6 en het verslag in
    de ROADMAP.

#### Ticket D43 — Herijken en eindspeeltest

- **Stappen:**
  - `meet-dnm-afstanden.mjs` en `meet-dnm-economie.mjs` op de nieuwe kaart
    draaien.
  - Poortafstanden, bouwplekken en economie bijstellen waar de nieuwe
    routes dat vragen. Dit ticket rondt ook de openstaande speeltest van D16
    af.
- **Acceptatie:** de meetscripts binnen de randvoorwaarden, de volledige
  suite groen, en de eigenaar heeft gespeeld → **beslismoment M3**: klopt de
  make-over? Daarna het uitgestelde beslismoment van fase 3 (hoe voelt de
  torenkern?) en de keuze over fase 4 (oververhitting).

### 11.6 Volgorde en beslismomenten

```
D31 plattegrond ── M1 (goedkeuring)
  → D32 fundament → D33 routes → D34 routes zichtbaar → D35 commandopost ── M2 (grey-box speeltest)
  → D36 texturen → D37 Paleis → D38 Nieuwe Kerk → D39 oost/zuid → D40 straatwanden → D41 sfeer
  → D42 prestaties (+ D21 kwaliteit) → D43 herijken ── M3 (eindspeeltest)
  → beslismoment fase 3 + keuze fase 4
```

### 11.7 Doelarchitectuur

Dit is hoe de game er na fase M technisch uitziet. Het is geschreven vóór
D32, zodat elk ticket hetzelfde doel heeft. Een beknopte versie staat in
`ARCHITECTURE_NOTES_monument.md` §15. Wijkt de uitvoering af, dan wordt deze
paragraaf in hetzelfde ticket bijgewerkt.

#### 11.7.1 Coördinaten, eenheden en hoogte

- **Meters, mensmaat 1:1.** +x is oost, +z is zuid, y is omhoog. De
  oorsprong ligt in het midden van het monument.
  - `MONUMENT_POSITIE` wordt (0, 0, 0); nu is het (14, 0, −1,33).
- **`wereld` blijft een `Group`, maar zonder schaal.** `ARENA_SCHAAL`,
  `GEBOUW_HOOGTE_SCHAAL`, `MONUMENT_HOOGTE_SCHAAL` en `MONUMENT_ROND_Y`
  verdwijnen.
  - Er is geen verschil meer tussen "wereldcoördinaat" en
    "gameplaycoördinaat". Valkuil 4.2 (vergeten ×ARENA_SCHAAL) bestaat
    daarmee niet meer.
- **Ooghoogte en snelheid blijven.** Ooghoogte 1,7 m, loopsnelheid 7 m/s.
  De plattegrond rekent met die 7 m/s.
- **`vloerHoogte(x, z)`.** De vloer is plat, op twee uitzonderingen na: de
  drie treden van het monumentplatform (3 × 0,16 m) en de stoepen
  (0,12 m).
  - Speler en robots krijgen `y = vloerHoogte(x, z)`.
  - De functie leest alleen `DAM_LAYOUT`: ringen voor het platform,
    rechthoeken voor stoepen.

#### 11.7.2 `DAM_LAYOUT` — één bron

- **Wat het is.** Bovenaan STAP 2 staat `const DAM_LAYOUT = { … }`. Dat is
  letterlijk het JSON-blok uit `PLATTEGROND.html`: dezelfde velden en
  dezelfde getallen, puur data, dus geen `THREE.Vector3`.
- **Afgeleide velden.** `bereidLayoutVoor()` maakt daar eenmalig bij het
  laden van:
  - `ROUTES`: een `Map` van poortnaam naar
    `{ punten, segmenten: [{ a, b, lengte, s0, breedte, richting, normaal }], lengte }`;
  - `MONUMENT_BOX`, `GRENS` en `BOUWPLEKKEN`;
  - de hekken per plek.
- **Wijzigen.** Een wijziging gebeurt in `PLATTEGROND.html` en de game
  tegelijk. `test-dnm-layout.mjs` eist dat de twee gelijk zijn, zodat de
  goedgekeurde plattegrond altijd de waarheid toont.

| Veld | Gelezen door |
|---|---|
| `grens` | spelerbeweging, `willekeurigePlek`, minimap |
| `monument` (speldoos, platform, treden) | `MONUMENT_BOX`, `afstandTotMonument`, `vloerHoogte`, monumentbouwer |
| `commandopost`, `kerkklok`, `spelerStart` | interactiepunten, `BEGINSTAAT` |
| `vlakken` (asfalt, stoep, trambaan, klinkers) | vloerbouwer, `vloerHoogte`, test "rijbanen zijn heilig" |
| `routes` (punten, breedtes) | robotbeweging, bakens, lichtspoor (D34), minimap, klinkerstroken |
| `hekBreedte` | hekbouwer |
| `bouwplekken` | `BOUWPLEKKEN`, bouwplektegels |
| `gebouwen` (delen, hoogte) | gebouwbouwers, botsingen, schotschil |
| `decor` | decorbouwer (geen botsing: buiten `GRENS`) |

**Invarianten.** `test-dnm-layout` bewaakt ze; het zijn alle toetsen van
`PLATTEGROND.html` plus:

1. Geen enkel geregistreerd obstakel en geen decor-bounding-box ligt op een
   rijbaan, trambaan of routestrook.
2. Gebouwen zijn assen-uitgelijnde rechthoeken (`delen`). Een gebouw met
   een uitstekend deel krijgt een extra deel, geen `Box3` die meegroeit.
3. Een bouwplek ligt nooit binnen 0,3 m van een strook; een hek steekt
   nergens in een gebouw.

#### 11.7.3 Wereldbouw

- **Volgorde bij het laden:**
  1. `bereidLayoutVoor()`;
  2. materialen en texturen (register);
  3. vloer;
  4. gebouwen;
  5. monument;
  6. straatmeubilair;
  7. botsingen;
  8. bouwplekken, commandopost en kerkklok;
  9. `bouwset.klaar()`.
- **Gebouwbouwers.** `GEBOUW_BOUWERS` is een object van gebouwnaam naar
  functie `(gebouw, bouwset) → Group`.
  - Een naam zonder eigen bouwer krijgt het grey-box-blok van D32: een
    massief blok per deel, op de hoogte uit de layout.
  - D37–D40 vervangen de bouwers één voor één. De rest van de game merkt
    daar niets van.
- **`bouwset` verzamelt, en tekent pas aan het eind.** Twee soorten
  onderdelen:
  - **Statisch en uniek** (gevelvlakken, daken, lijsten): de geometrie
    gaat per materiaal in een lijst. `klaar()` voegt elke lijst samen met
    `mergeGeometries` tot één mesh.
  - **Herhaald** (ramen, kozijnen, rondboogpoortjes, lantaarns, paaltjes):
    per onderdeelsoort één `InstancedMesh`.
  - Resultaat: een klein, vast aantal draw calls, onafhankelijk van hoeveel
    ramen er zijn.
- **Import.** `mergeGeometries` komt uit
  `three/addons/utils/BufferGeometryUtils.js`. De importmap krijgt daarvoor
  een `"three/addons/"`-regel naar hetzelfde CDN en dezelfde versie (0.160.0).
  De testhelper vangt `/examples/jsm/` al af.
- **Materiaalregister.**
  - `materiaal(naam)` geeft per naam altijd hetzelfde object terug.
  - Texturen worden op een canvas getekend met een PRNG die per
    patroonnaam een vaste seed krijgt (`tekstZaad`), en op wereldschaal
    gezet (`herschaalUVNaarWereldschaal`). Beide komen uit Undead:
    gekopieerd en aangepast, niet gedeeld.
- **Botsingen.**
  - Alleen `registreerRechthoek`, per `gebouw.delen`, met marge 0,3.
    `registreerObstakel` (`Box3`) wordt voor gebouwen niet meer gebruikt.
  - Straatmeubilair met botsing registreert een eigen kleine rechthoek.
- **Schoten en de wereld: de schotschil.** Schoten raken nu heel `wereld`
  via een recursieve raycast. Met samengevoegde meshes van tienduizenden
  driehoeken wordt dat duur, en de bounding sphere van een samengevoegde
  mesh sluit niets meer uit.
  - Daarom krijgt de wereld een onzichtbare **schotschil**: één box per
    gebouwdeel, plus het monument.
  - Schoten raycasten tegen robots en de schil. Alle detailmeshes krijgen
    `raycast = geenRaycast`.
  - Het buiten-bereik-effect van D29 gebruikt dezelfde schil.
- **Benoemde onderdelen.** Elke gebouwgroep krijgt `name = gebouw.naam`.
  Herkenbare onderdelen krijgen `userData.onderdeel`, zodat tests en
  schermafbeeldingen ze kunnen vinden, bijvoorbeeld:
  - `'koepel'` en `'fronton'` (Paleis);
  - `'transeptraam'` (Nieuwe Kerk);
  - `'pyloon'` (monument).

#### 11.7.4 Routes en robotbeweging

- **Robotstaat.**
  - `route`: een verwijzing naar `ROUTES`.
  - `s`: de afgelegde afstand langs de route.
  - `laanFractie`: bij het spawnen gekozen, tussen −1 en 1.
  - `modus`: `'route'`, `'bouwwerk'`, `'slaan'` of `'terug'`.
- **Zijwaartse positie.** De zijwaartse afwijking is
  `laanFractie × (breedte(s)/2 − 0,8)`. Een robot houdt dus zijn eigen
  "baan", en die versmalt vanzelf waar de strook smaller wordt (van 9 m op
  het Damrak naar 3 m op het plein).
- **Modus `route`**, per frame:
  1. `s` groeit met `v · dt`, tenzij er binnen 1,2 m voor hem een robot op
     dezelfde route loopt met een laanverschil onder 0,45. Dan wacht hij.
     Zo ontstaat een rij, geen klont.
  2. Het stuurpunt is `puntOp(route, s + 1,5)` plus de zijwaartse
     afwijking. Door dat vooruitkijken worden bochten vanzelf rond.
  3. De robot beweegt naar het stuurpunt en draait vloeiend
     (`dt × 6`, zoals nu).
- **Monument.** `afstandTotMonument(positie) < 0,6` blijft de enige
  waarheid voor een treffer.
- **Hek.** Een hek weet zijn `route` en `s`. Een robot op die route met
  `s ≥ hek.s − HEK_CONTACT_AFSTAND` gaat in modus `slaan`.
  - Er is geen meetkundige lijntest meer nodig, en het paaltjeslijn-trucje
    van D13 vervalt.
  - `hek.lijn` blijft bestaan voor tekenen en voor `bouwwerkPunt` van de
    bomber.
- **Bomber.** Modus `bouwwerk` verlaat de route naar het doel van
  `kiesBomberDoel`. Dat is ongewijzigd: binnen 10 m, en per frame opnieuw
  gekozen.
  - Sneuvelt het doel, dan gaat hij naar modus `terug`: hij stuurt naar het
    dichtstbijzijnde routepunt (projectie, dus een nieuwe `s`) en gaat
    verder in modus `route`.
  - Alleen in `bouwwerk` en `terug` draait `losBotsingenOp`.
- **Vastlopen wordt een meting.** `vastTijd` blijft, maar leidt niet meer
  tot uitwijken. De teller `spel.vastloopTeller` telt elk geval.
  `test-dnm-routes` eist 0 in een volle wave.
- **Wat vervalt:**
  - `tussenpunt` en `ontwijkOffset`;
  - de simulatie `looproute()`.
- **Wat blijft:** `puntOpRoute(poort, fractie)`, met dezelfde retourvorm
  `{ x, z, rx, rz }` maar op de vaste route. Meetscripts en tests die hem
  aanroepen, blijven dan werken.

#### 11.7.5 Bouwplekken, hekken, commandopost en menu

- **`BOUWPLEKKEN` komen uit de layout.** De veldnamen blijven waar dat kan:
  `poort`, `index` (0 = ver, 1 = nabij, dezelfde betekenis als nu),
  `positie`, `toren`, `groep`. Zo werkt de code van D11–D14 door.
  - `route` + `zijOffset` worden `s` + `hek` (`{ a, b, breedte }`).
  - De tegel wordt 1,8 m (was 2,4), zodat hij op een stoep van 2,5 m past.
    Het torenobstakel blijft 1,4 m.
- **Hek.** Een rij palen van `hek.a` naar `hek.b`, met per paal een
  `registreerRechthoek`, zodat hij ook schuin op het plein kan staan.
  - In een straat spant het hek de hele rijbaan of voetgangersstraat.
  - Op het plein spant het de strook plus 1 m aan weerszijden.
- **Commandopost.** Eén interactiepunt van type `'commandopost'` met menu:
  - 1–3: wapen-upgrades;
  - 4: monument repareren.

  De Bijenkorf-kiosk en de Koninklijke Reparatiepost vervallen. De
  Kerkklok verhuist naar `DAM_LAYOUT.kerkklok`.
- **Eén menupaneel, `menuUI`, in plaats van `shopUI` en `bouwUI`.**
  - Openen gaat met `openMenu({ titel, opties: [{ toets, tekst, prijs, beschikbaar, actie }] })`,
    sluiten met `sluitMenu()`.
  - Het menu sluit bij T, bij weglopen (straal + 1 m) en bij pauze.
  - De bestaande debug-exports `bijenkorfShopOpenStand` en `bouwMenuStand`
    blijven als dunne wrappers.

#### 11.7.6 Monument op 1:1

- **Opnieuw opgebouwd op ware grootte**, met een pyloon van 22 m, in een
  eigen groep in de oorsprong. Zonder niet-uniforme schaal zijn rook en
  licht vanzelf rond; `MONUMENT_ROND_Y` vervalt.
- **De schadestaten van D20 blijven.** `pasMonumentSchadeToe`,
  `zetMonumentDeelZichtbaar` en `userData.puurEffect` blijven; alleen de
  maten veranderen.
- **`MONUMENT_BOX` volgt uit `DAM_LAYOUT.monument.speldoos`** (±6 m). De
  handmatige kopie en valkuil §4.3 verdwijnen.

#### 11.7.7 Tram, decor en sfeer

- **De rijdende trams verdwijnen.** Ze kruisen routes en zijn bewegende
  obstakels (`bewegendeTrams`).
- **Eén geparkeerde tram** staat in het Rokin, voorbij de poort en buiten
  `GRENS`, als achtergrond. Hij heeft geen botsing.
- **Straatmeubilair** staat alleen buiten rijbanen, trambaan en stroken
  (invariant 1).
- **Mist.**
  - De mist wordt herijkt op afstanden van 1:1. `MIST_BASIS` en de
    Grachtenmist van D30 blijven werken.
  - De `far` van de camera (600) en het schaduwvlak van de zon worden op
    de nieuwe arena gezet:
    - schaduw: x −70..50 en z −50..50, plus de hoogte van de koepel;
    - `far`: ≥ 250 m, met de straten als achtergrond.

#### 11.7.8 Interfaces: wat verandert voor bestaande code

| Nu (fase 3) | Na fase M | Opmerking |
|---|---|---|
| `ARENA_SCHAAL`, `GEBOUW_HOOGTE_SCHAAL`, `MONUMENT_HOOGTE_SCHAAL`, `MONUMENT_ROND_Y` | vervallen | alles in meters |
| `wereld.scale` (1/3, 0,6, 1/3) | identiteit | `wereld` komt op de debug-hook |
| `MONUMENT_POSITIE` (14, 0, −1,33) | (0, 0, 0) | |
| `MONUMENT_BOX` (handkopie) | uit `DAM_LAYOUT.monument.speldoos` | |
| `GRENS` | `DAM_LAYOUT.grens` | |
| `SPAWN_POORTEN` `{ naam, positie, spreidingX/Z, tussenpunt }` | `{ naam, positie, route }` | positie is het eerste routepunt; spreiding wordt `laanFractie` |
| `looproute(poort)` (simulatie) | `ROUTES.get(naam)` (vast) | |
| `puntOpRoute(poort, fractie)` | blijft | zelfde retourvorm, op de vaste route |
| `BOUWPLEKKEN` met `route`, `zijOffset` | uit de layout, met `s` en `hek` | overige velden gelijk |
| `hekInContact(positie)` (lijntest) | `hekOpRoute(robot)` (op basis van `s`) | `hek.lijn` blijft |
| `interactiePunten`: 3 vaste + 10 plekken | commandopost + kerkklok + 10 plekken | |
| `shopUI`, `bouwUI` | `menuUI` | debug-wrappers blijven |
| `bewegendeTrams` | vervalt | |
| raycast tegen heel `wereld` | raycast tegen robots + schotschil | |

**De debug-hook `DamChaosDebug`** wordt alleen uitgebreid, niet hernoemd.
Nieuw erop:
- `DAM_LAYOUT`, `ROUTES`, `wereld`, `schotschil`;
- `vloerHoogte`, `puntOp`, `hekOpRoute`;
- `menuStand`, `openMenu`, `sluitMenu`.

#### 11.7.9 Testmigratie

| Test | Wat verandert | Ticket |
|---|---|---|
| `test-dnm-laadt` | verwachte aantallen (obstakels, interactiepunten) uit de layout | D32/D35 |
| `test-dnm-kern` | robots bereiken het monument via de vaste route, niet via de simulatie; 12 interactiepunten | D33/D35 |
| `test-dnm-poorten` | poortposities uit de layout; bakens aan de straatingang | D33/D34 |
| `test-dnm-wapenbereik` | vindt `wereld` via de debug-hook in plaats van `scale.x === ARENA_SCHAAL`; schiet tegen de schotschil | D32 |
| `test-dnm-bouwplekken` | plekken uit de layout in plaats van `looproute` | D33 |
| `test-dnm-hek` | hek op route-`s`; spant de volle strook | D33 |
| `test-dnm-reset` | momentopname zonder trams; spelerstart uit de layout | D32 |
| overige (toren-*, bouwfase, themagolven, eindscherm, highscore, monument-schade) | naar verwachting alleen posities | D32–D35 |
| nieuw: `test-dnm-layout`, `-routes`, `-route-zicht`, `-commandopost`, `-texturen` | | D32–D36 |
| `meet-dnm-afstanden`, `meet-dnm-economie`, nieuw `meet-dnm-prestaties` | opnieuw draaien | D42/D43 |

Regel: een test die aan de oude geometrie hing, wordt in hetzelfde ticket
bijgewerkt, met in de test zelf één zin waarom.

#### 11.7.10 Prestatiebudget (vast te leggen in D42)

- **Nulmeting.** De huidige game, gemeten op 1280×720 na het laden
  (scratchpad `meet-nul.mjs`, wordt in D42 `meet-dnm-prestaties.mjs`).
- **Standpunten:** de drie van de nulmeting, plus in D42 de commandopost en
  de Kalverstraat-mond.

| Meting | Nu: monument / plein west / Damrak | Budget Hoog | Budget Laag |
|---|---|---|---|
| draw calls | 1407 / 1421 / 2314 | ≤ 400 | ≤ 200 |
| driehoeken in beeld | 50k / 51k / 70k | ≤ 500k | ≤ 200k |
| geometrieën | 1978 | ≤ 300 | ≤ 300 |
| texturen | 23 | ≤ 24, elk ≤ 1024² | ≤ 24, elk ≤ 512² |
| shaderprogramma's | 7 | geen nieuwe na het laden | idem |
| laadtijd headless | 6,2 s | ≤ 6 s | ≤ 6 s |

Het detail "richting maximaal" betaalt zich in driehoeken, niet in draw
calls. Dat is precies waar instancing en samenvoegen voor zijn.

#### 11.7.11 Valkuilen die we vooraf kennen

1. **`mergeGeometries` geeft `null`** als de attributen niet overeenkomen:
   geïndexeerd en niet-geïndexeerd door elkaar, of een ontbrekende `uv`.
   `bouwset` normaliseert elke geometrie vóór het samenvoegen en gooit een
   fout bij `null`, zodat het niet stil misgaat.
2. **Instanties verdwijnen aan de beeldrand** als de bounding sphere van
   een `InstancedMesh` niet na het zetten van de matrices wordt berekend.
   Dus altijd `computeBoundingSphere()` in `klaar()`.
3. **Vloerlagen gaan flikkeren (z-fighting).** Plein, strook, trambaan en
   stoep liggen op elkaar. Ze krijgen vaste y-verschillen (0 / 0,004 /
   0,008 / 0,12) of `polygonOffset`.
4. **Tests zochten `wereld` via de schaal.** Na D32 werkt dat niet meer;
   ze gebruiken de debug-hook.
5. **Een canvastextuur met `Math.random`** ziet er elke laadbeurt anders
   uit. Alleen de PRNG met vaste seed gebruiken; `test-dnm-texturen`
   vergelijkt bytes.
6. **Het schaduwvlak en `camera.far` horen bij de oude, geschaalde
   wereld.** Zonder bijstellen vallen koepel en straten buiten beeld of
   buiten de schaduw.
7. **`DAM_LAYOUT` is JSON.** Een `THREE.Vector3` erin maakt de vergelijking
   met `PLATTEGROND.html` kapot. Omzetten gebeurt alleen in
   `bereidLayoutVoor()`.

### 11.8 Bijsturing na M2: speelbaarheid vóór de gevels

Na de grey-box-speeltest (M2) kwam de eigenaar met vier punten. Ze gaan
over het spel, niet over het uiterlijk, dus ze komen vóór D36.

- **Menu en kaart.** Zelf het menu openen is onhandig. De minimap moet
  meedraaien met de kijkrichting, zoals in Undead.
- **Bouwplekken aan een stille straat.** Er staan bouwplekken aan straten
  waar die wave niets vandaan komt. Dat voelt onlogisch: plekken moeten ook
  nuttig zijn als hun straat niet aan de beurt is.
- **Hek of toren.** Kiezen tussen hek en toren voelt "flat". De toren valt
  aan, dus die wint altijd.
- **Meer soorten torens.** Robots moeten op verschillende manieren
  aangepakt kunnen worden.

Besluiten van de eigenaar:
- bouwplekken worden **knooppunten + voorposten**;
- het hek krijgt een **eigen hekslot**;
- er komen twee nieuwe torens: de **Bovenleiding** en de **Muntpers**.

#### Ticket D44 — Minimap draait mee

- **Doel:** de kaart leest zoals je kijkt.
- **Stappen:** de speler staat in het midden en wijst altijd omhoog; de
  kaart draait eromheen ("heading-up"). Het principe komt uit Undead
  (Ticket 67), gekopieerd en aangepast.
- **Acceptatie:** `test-dnm-route-zicht` meet de minimap in de draaiende
  stand. Wat recht voor de speler ligt, staat recht boven het midden, bij
  elke kijkrichting.

#### Ticket D45 — Menu opent vanzelf

- **Doel:** geen extra toetsdruk om te kopen.
- **Stappen:**
  - Kom je bij de commandopost of een bouwplek, dan opent het menu vanzelf;
    cijfers kopen direct.
  - T sluit het menu. Het blijft dicht tot je wegloopt en terugkomt.
  - Weglopen sluit het menu, zoals nu.
  - De Kerkklok houdt T: die doet direct iets en heeft een wachttijd, dus
    per ongeluk langslopen mag hem niet afgaan.
- **Acceptatie:** `test-dnm-commandopost` toetst:
  - aankomen opent het menu, T sluit het;
  - na T blijft het dicht zolang je blijft staan;
  - weglopen en terugkomen opent het weer;
  - de Kerkklok gaat niet vanzelf af.

  De torentests lopen via het automatisch geopende menu.

#### Ticket D46 — Knooppunten en voorposten

- **Doel:** elke bouwplek is nuttig, ook als zijn straat niet aan de beurt
  is.
- **Stappen:**
  - **Knooppunten** liggen vlak bij het monument, waar routes samenkomen,
    en zijn dus altijd nuttig.
  - **Voorposten:** één per straat, in de straat zelf. Ze zijn sterk als die
    straat aangekondigd is.
  - De indeling gaat eerst via de plattegrond (nieuwe toetsen voor
    dekking), daarna naar `DAM_LAYOUT`.
- **Acceptatie:**
  - de plattegrondtoetsen zijn goed;
  - elke route ligt binnen het bereik van minstens één knooppunt;
  - `test-dnm-bouwplekken` en `test-dnm-layout` zijn groen.
- **Uitgevoerd:**
  - Drie knooppunten: Plein noord, Plein zuid en Plein oost.
  - Vijf voorposten.
  - Zuidoost en Trambaan-west vielen af: hun hek zou over een andere
    route of de speldoos lopen.
  - Een knooppunthek legt één lijn per route.
  - Zie het verslag in de ROADMAP.

#### Ticket D47 — Eigen hekslot

- **Doel:** het hek wordt een aanvulling op een toren, geen alternatief.
- **Stappen:**
  - Elke plek heeft een torenslot naast de route en een hekslot dwars
    erover.
  - Een knooppunt legt zijn hek over al zijn routes.
  - Het menu toont beide slots.
- **Acceptatie:** `test-dnm-hek`:
  - toren en hek staan samen op één plek;
  - robots staan stil in het vuur;
  - een knooppunthek houdt beide routes tegen;
  - verkopen of sneuvelen van het een laat het ander staan.
- **Uitgevoerd:**
  - `plek.toren` en `plek.hek` zijn losse slots.
  - Het menu toont beide slots, met cijfers tot 6, en blijft na bouwen en
    verkopen open.
  - Geen hekpaal op de tegel van de plek.
  - Zie het verslag in de ROADMAP.

#### Ticket D48 — De Bovenleiding

- **Doel:** een antwoord op drukke golven.
- **Stappen:** een tramdraadmast die per schot een stroomstoot geeft. De
  stoot springt over op tot 4 robots die dicht bij elkaar lopen, met
  aflopende schade per sprong. Ontwerp en beelden zijn origineel.
- **Acceptatie:** `test-dnm-bovenleiding`:
  - de sprong raakt maximaal 4 robots, alleen binnen de sprongafstand;
  - de schade loopt af per sprong;
  - de niveaus lopen op;
  - de toren vuurt niet zonder doelwit.
- **Uitgevoerd:**
  - Kettingtoren: tot 3 robots op niveau 1 en 4 op niveau 2–3.
  - Schadefactor 0,75 per sprong; een schild stopt de keten.
  - Zie het verslag in de ROADMAP.

#### Ticket D49 — De Muntpers

- **Doel:** een investering die zichzelf terugverdient.
- **Stappen:**
  - Een steuntoren zonder aanval.
  - Robots die in zijn bereik sneuvelen, door wie dan ook, leveren 50% meer
    geld op.
  - Meerdere persen stapelen niet.
- **Acceptatie:** `test-dnm-muntpers`:
  - +50% binnen bereik, niets erbuiten;
  - geen stapeling;
  - geen aanval;
  - de toren telt mee in bombers-doelwitten.
- **Uitgevoerd:**
  - +50% via `muntpersBonus` in `vernietigRobot`, voor speler- én
    torenkills.
  - Geen stapeling.
  - Een bereikring op de grond.
  - Zie het verslag in de ROADMAP.

#### Ticket D50 — Voorposten aan de overkant (speeltest na D49)

- **Doel:** minder lopen tussen de plekken om munten op te halen.
- **Stappen:** tegenover elk knooppunt één voorpost aan de andere kant
  van de weg, op de drie plekken die de eigenaar aanwees. Ze vervangen de
  vijf voorposten in de straten.
- **Acceptatie:**
  - de plattegrondtoetsen zijn goed: één voorpost per knooppunt aan de
    overkant, ≤ 16 m verderop, en elke voorpost dekt zijn routes;
  - `test-dnm-bouwplekken` en `test-dnm-hek` zijn groen.
- **Uitgevoerd:** zie het verslag in de ROADMAP.

#### Ticket D51 — Drukpers voor het Paleis (speeltest na D49)

- **Doel:** een geldbron die los staat van het vechten.
- **Stappen:**
  - De Muntpers (D49) gaat uit het torenmenu.
  - Drie eigen plekken voor het Paleis, alleen voor een drukpers.
  - Vast inkomen om de 10 s; elk niveau verdient zich gemiddeld in drie
    rondes terug.
- **Acceptatie:** `test-dnm-drukpers`:
  - de drukpers staat niet in het gewone menu;
  - drie plekken, geen toren of hek daarop;
  - de uitbetaling om de 10 s, met één popup;
  - los van de robots;
  - terugverdiend in 230–270 s;
  - verkopen en reset werken.
- **Uitgevoerd:** zie het verslag in de ROADMAP.

Volgorde: D44 → D45 → D46 → D47 → D48 → D49, daarna D36. De economie van
de nieuwe torens wordt in D43 herijkt, samen met de rest. Na de speeltest
tijdens D37 kwamen D50 en D51 erbij; daarna volgt D38.
