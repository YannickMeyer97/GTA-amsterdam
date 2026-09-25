# ARCHITECTURE_NOTES_monument.md — Defend National Monument

Invarianten, contracten en valkuilen van `defend-national-monument.html`.
Tegenhanger van `docs/amsterdam-undead/ARCHITECTURE_NOTES_undead.md`; de twee
games delen géén code, dus de twee documenten delen geen inhoud.

**Status:** dit document beschrijft de game zoals die er vandaag uit ziet, ná
D0–D6, de eerste speeltest-feedbackronde daarna (robots 15% kleiner,
minder decor rond het strijdtoneel, minimap + richtingspijlen) en fase 2
(D7 eindscherm, D8 highscore, D9 opnieuw spelen, D20 monumentschade) en
fase 3 (poorten, wapenbereik, bouwplekken, torens, hek, bouwfase, economie,
themagolven — zie §14). Fase 1
(de herschaling) is volledig afgerond en gemeten, niet alleen berekend.
Alles hieronder is uit de code gelezen en narekenbaar.
**Let op, fase M is begonnen:** sinds D32 is de wereld vervangen door de
grey-box-Dam op 1:1 uit `DAM_LAYOUT`. Wat §3 (de wereld), §4.2 en §4.3
(schaal en monumentdoos) en §3.5 (rijdende trams) over `ARENA_SCHAAL`,
`wereld.scale` en de oude bouwers zeggen, geldt niet meer. De actuele stand
staat in §15.5.
**Regelnummers zijn sinds D4/D5/D6 op sommige plekken bewust niet meer
exact** (het bestand groeide met de toelichtingen) — behandel ze als een
globale vingerwijzing, niet als een contract; de secties die D4/D5/D6/de
speeltest-feedbackronde/fase 2 rechtstreeks raakten (§1.1, §2, §3.1, §3.5,
§4.2, §4.3, §5, §6.1, §6.2, §6.3, §7.7, §8, §9.3–§9.6, §10, §12, §13, §14) zijn
wel bijgewerkt.

**Leeswijzer voor wie een ticket uitvoert:** §10 (valkuilen) en §11 (dode code)
zijn de twee secties die je fout kunt ingaan zonder het te merken. Lees die
eerst.

---

## Inhoud

| § | Onderwerp |
|---|---|
| 1 | Bestandsopbouw en de acht STAP-blokken |
| 2 | Renderer, camera, licht |
| 3 | De wereld: maten, palet, bouwers |
| 4 | Botsingen |
| 5 | De speler |
| 6 | Robots: types, spawn, AI |
| 7 | Spelsystemen: waves, economie, combo, boost, special |
| 8 | Wapen, schot en deeltjes |
| 9 | UI, audio, game-loop |
| 10 | Valkuilen |
| 11 | Dode code |
| 12 | Debug-hook |
| 13 | Testdekking |
| 14 | De torenkern (fase 3): poorten, bereik, bouwplekken, torens, hek, bouwfase, economie, themagolven |
| 15 | Doelarchitectuur fase M (make-over van de Dam) — nog niet gebouwd |

---

## 1. Bestandsopbouw

Eén zelfstandig HTML-bestand. Three.js r0.160.0 via importmap-CDN, verder geen
afhankelijkheden, geen buildstap, geen externe assets. Dezelfde harde kaders
als Amsterdam Undead (zie `CLAUDE.md`).

De module is verdeeld in acht genummerde blokken met een ASCII-kop. De
nummering loopt niet netjes op — **STAP 3.5 staat fysiek ná STAP 4** (regel
2645, terwijl STAP 4 op 2405 begint). Dat is geen fout maar het is wel
verwarrend bij het zoeken.

| Blok | Regels | Inhoud |
|---|---:|---|
| CSS + DOM | 1–388 | Stijl en de UI-laag bovenop het canvas |
| STAP 1 | 392–438 | Scene, camera, renderer, licht, resize |
| STAP 2 | 440–2202 | De wereld (verreweg het grootste blok) |
| STAP 3 | 2203–2404 | Speler, invoer, pointer lock, botsingen |
| STAP 4 | 2405–2644 | Monument, poorten, waves, upgrades |
| STAP 3.5 | 2645–2888 | Interactiepunten, Kerkklok Boost, special |
| (vervolg 4) | 2889–3113 | Robotmodel, spawn, AI |
| STAP 5 | 3114–3323 | Wapen, schot, brokstukken |
| STAP 6 | 3325–3399 | Geld en munten |
| STAP 7 | 3401–3446 | Audio |
| STAP 8 | 3448–3517 | Game-loop en debug-hook |

### 1.1 De DOM-laag (regel 340–377)

Zestien vaste elementen, allemaal `position: fixed` bovenop het canvas:

`menuLink` · `geldUI` · `scoreUI` · `specialUI` · `waveUI` · `objectiveUI` ·
`comboUI` · `hitmarker` · `waveBanner` · `shopUI` · `interactiePrompt` ·
`kerkklokBanner` · `richtkruis` · `popups` · `hulpUI` · `startscherm`

Sindsdien bijgekomen: `minimapUI` en `robotPijlenUI` (speeltest-feedback na
D6, §9.4) en **`eindscherm`** (D7, §9.5) — dezelfde CSS-taal als het
startscherm, maar met een hogere `z-index` (30) zodat het ook boven
`menuLink` ligt. Het eindscherm heeft een eigen menulink.

---

## 2. Renderer, camera, licht (regel 400–438)

| Wat | Waarde |
|---|---|
| Achtergrond / mist | `0x87ceeb`, `Fog(0x87ceeb, 140, 340)` |
| Camera | `PerspectiveCamera(75, aspect, 0.1, 600)`, `rotation.order = 'YXZ'` |
| Renderer | `antialias: true`, `pixelRatio = min(devicePixelRatio, 2)` |
| Schaduwen | `shadowMap.enabled = true`, `PCFSoftShadowMap` |
| Kleur / tonemapping | `SRGBColorSpace`, `ACESFilmicToneMapping`, exposure 1.08 |
| Zon | `DirectionalLight(0xfff2d0, 2.6)` op (70, 100, 45), shadow map 2048² |
| Schaduwcamera | ±36,7 in x en y (was ±110, Ticket D4), near 10, far 300 |
| Vulling | `HemisphereLight(0xbfe3ff, 0x9b8f7a, 1.15)` |

**Alles staat hard aan.** Geen kwaliteitsniveaus, geen `pixelRatio`-plafond
dat je kunt verlagen, geen schakelaar voor schaduwen. Dat is het hele
onderwerp van D21.

**Sinds D4** staat `left/right/top/bottom` op ±36,7 (`110 × ARENA_SCHAAL`),
gezet direct ná `wereld.scale.set(...)` in STAP 2 (niet meer bij `zon`'s
eigen creatie in STAP 1 — `ARENA_SCHAAL` bestaat daar nog niet, TDZ). Dezelfde
2048²-shadowmap dekt nu een 3× kleiner gebied: merkbaar scherpere
schaduwranden, zonder extra rendercost. `updateProjectionMatrix()` erna is
nodig, want Three.js herberekent de projectie niet vanzelf na het zetten van
deze vier velden ná de eerste render-init.

De resize-handler (regel 434) werkt `camera.aspect` en `renderer.setSize` bij,
maar **niet** `setPixelRatio`. Bij het slepen tussen schermen met een andere
DPR blijft de oude ratio staan.

---

## 3. De wereld

### 3.1 Maten en vaste punten

**Ná D5 zijn deze weer volledig consistent.** Tussen D4 en D5 was `GRENS` al
geschaald terwijl `MONUMENT_POSITIE`/`MONUMENT_BOX`/de speler-startplek nog
op hun oude waarde stonden — dat venster is nu dicht. Alle gameplay-
wereldcoördinaten die GEEN kind van `wereld` zijn (dus niet automatisch mee
schalen via `wereld.scale`, zie §4.2) zijn met de hand × `ARENA_SCHAAL`
gezet, op de declaratieplek zelf (niet als vooraf uitgerekende decimalen) —
narekenbaar en correct als `ARENA_SCHAAL` ooit verandert.

| Wat | Waarde | Regel |
| --- | --- | --- |
| `GRENS` | x ∈ [−39,33, 55], z ∈ [−39,33, 35,33] | 465 e.v. |
| Arena-afmeting | 94,3 m breed × 74,7 m diep | afgeleid |
| Grondvlak (gerenderd) | 207 × 207 | STAP 2 |
| `MONUMENT_POSITIE` | (14, 0, −1,33) | 2510 e.v. |
| `MONUMENT_BOX` | x ∈ [10,43, 17,57], z ∈ [−4,90, 2,23] (halve maat ±3,57) | 2513 e.v. |
| `MONUMENT_MAX_HP` | 100 (geen ruimtelijke maat, ongewijzigd) | 2651 e.v. |
| Speler-startplek | (5,33, 0, 10,00) | 2306 e.v. |

`MONUMENT_POSITIE` en `MONUMENT_BOX` zijn geschreven als `42 * ARENA_SCHAAL`
resp. `(42 ± 10,7) * ARENA_SCHAAL` — exact dezelfde vorm als de
`registreerRechthoek()`-registratie van het monument-obstakel (D4, regel
1410), dus de twee blijven per constructie gelijk (zie §4.3).

Assenstelsel: **x = west-oost, z = noord-zuid, noord is negatieve z**, en één
game-unit is ongeveer één meter (comment op regel 450) — dat geldt nog steeds
voor LOKALE coördinaten binnen `wereld`; wereldcoördinaten zijn sinds D4
lokaal × `ARENA_SCHAAL`/`GEBOUW_HOOGTE_SCHAAL`, zie §4.2.

### 3.2 Het palet (regel 468)

`PAL` is één object met 27 benoemde kleuren. Alle bouwers lezen daaruit; er
staan vrijwel geen losse hex-waarden in de bouwcode. Dat maakt een visuele
herkleuring goedkoop.

### 3.3 Materiaalcache (regel 509)

`mat(kleur, ruwheid, metaal, extra)` hergebruikt materialen via een `Map` op
sleutel. **Alleen wanneer `extra` gevuld is** wordt een uniek materiaal
gemaakt, omdat `extra` niet betrouwbaar in de sleutel te vatten is (comment op
regel 503). Dat scheelt op een plein vol gevels honderden materialen en draw
calls.

> Wie een nieuw materiaal met `emissive` nodig heeft, krijgt dus
> gegarandeerd een uniek object. Dat is bedoeld — maar het betekent ook dat
> honderd emissive-objecten honderd materialen zijn. Bij nieuwe systemen
> (torens, warmte-gloed) is dat een echte kostenpost.

### 3.4 De bouwers

Ongeveer veertig functies bouwen het decor. De grote, benoemde gebouwen:

`bouwKoninklijkPaleis` (1027) · `bouwNieuweKerk` (1174) ·
`bouwKerkklok` (1255) · `bouwNationaalMonument` (1284) ·
`bouwBijenkorf` (1369) · `bouwKrasnapolsky` (1417) ·
`bouwGassanHotel27` (1458) · `bouwMadameTussaudsBlok` (1626) ·
`bouwReparatiepost` (1141)

Plus generieke bouwers: `maakGrachtenpand` (1503), `plaatsGevelrij` (1593),
`zadeldak`, `driehoekFacade`, `maakRamenRij`, `maakSpitsboogRaam`,
`maakSteunbeer`, `maakZuilenrij`, `maakDaklijst`, `maakEtalage`,
`maakGevelTekst`.

En decor: `lantaarn`, `bankje`, `terras`, `fietsenrek`, `upgradeKiosk`, `boom`,
`tram`, `bollardsLangsLijn`, `vlag`, `toerist`, `straatNaambord`,
`straatOpening`, `straatMuzikant`, `levendStandbeeld`, `zebrapad`,
`railCurve`, `tegelRaster`, `vloerRechthoek`, `vloerPoly`, `lijnOpGrond`,
`interactieMarkering`.

### 3.5 Bewegend decor

- **Rijdende tram** (`maakRijdendeTram`, `updateBewegendeTrams`): één tram,
  snelheid 5,5 (lokale eenheden/s), pendelt tussen lokale z = −112 en z = 106,
  belt elke 5 s. Heeft een meebewegend obstakel. **De tram is de ENIGE plek in
  het hele bestand die een eigen `obstakels`-rechthoek bouwt uit
  `g.position.x/z` rechtstreeks** (bevestigd: er zijn maar drie
  `obstakels.push(`-aanroepen in het hele bestand — de twee
  registratiefuncties en deze) — en dat is precies waarom hij sinds D4 een
  eigen fix nodig had, zie §4.2. `TRAM_HALF_X`/`TRAM_HALF_Z` (2,4/8,1 vóór D4)
  schalen mee met `ARENA_SCHAAL` zodat de botsbox proportioneel blijft met de
  visueel kleinere tram. `snelheid` (5,5) en `zMin`/`zMax` (−112/106) blijven
  bewust **ongewijzigd**: dat zijn lokale grootheden die tegen elkaar
  vergeleken worden (`t.groep.position.z` is lokaal), dus de rittijd in
  seconden blijft precies gelijk — alleen de wereld die de tram doorkruist is
  nu kleiner.
- **Duiven** (`maakDuif`, `plaatsDuif`, `updateDuiven`): 18 stuks. Anders dan
  de tram zijn duiven GEEN kind van `wereld` (`scene.add(duif)`, niet
  `wereld.add`) — hun spawnpositie komt uit `willekeurigePlek()`, die leest
  van het al-geschaalde `GRENS`, dus ze spawnen na D4 vanzelf binnen de
  nieuwe, kleinere arena zonder dat er iets aan duiven-code hoeft te
  veranderen.

### 3.6 Determinisme

`seededRandomFactory(seed = 12345)` (regel 922) levert `rnd()` en `kies(arr)`
voor de decorplaatsing, zodat de stad er elke run hetzelfde uitziet. **Alles
wat daarná komt — robotsnelheid, spawnspreiding, muntbedragen, brokstukken —
gebruikt gewoon `Math.random()` en is dus niet reproduceerbaar.**

> **Voor tests:** er is geen seed-hook voor de gameplay-RNG. Een test die op
> een exact bedrag of een exacte snelheid assert, is per definitie flaky. Test
> op bandbreedtes, of stub `Math.random` in de pagina.

---

## 4. Botsingen

### 4.1 Het model

Alles is een **as-gerichte rechthoek in het xz-vlak**. Geen hoogte, geen
rotatie, geen mesh-collision. `obstakels` is een platte array van
`{minX, maxX, minZ, maxZ}`.

`losBotsingenOp(positie, straal)` (regel 2308) duwt een cirkel uit elke
rechthoek: het dichtstbijzijnde punt op de doos bepalen, en als de afstand
kleiner is dan de straal, naar buiten duwen. Staat het punt er middenin
(afstand² ≤ 1e−6), dan wordt het naar de dichtstbijzijnde zijkant geduwd.
Daarna klemt de functie op `GRENS`.

**Dit is een lus over álle obstakels, elke frame, voor de speler én voor elke
robot.** Geen ruimtelijke index, geen broad phase. Met 13 robots en N
obstakels zijn dat 14·N doostoetsen per frame.

`isVrijePlek(x, z, marge = 1)` (regel 2342) is de goedkope variant zonder
duwen, gebruikt bij het spawnen.

### 4.2 De twee registratiefuncties, en hoe D4 ze daadwerkelijk raakte

- `registreerObstakel(object, marge)` doet `updateWorldMatrix(true, true)` +
  `Box3.setFromObject`. De doos **volgt de wereldmatrix**, dus een schaal op
  een ouder-Group werkt automatisch door.
- `registreerRechthoek(minX, maxX, minZ, maxZ, marge)` neemt kale getallen aan
  en doet dat **niet**.

**Wat D4 hier daadwerkelijk deed, geverifieerd vóór het schrijven — dit is
substantieel eenvoudiger dan het oorspronkelijke plan veronderstelde:**

`wereld = new THREE.Group()` is de gedeelde ouder van **letterlijk alle
statische stadsgeometrie** — geverifieerd door alle 11 `scene.add()`-aanroepen
in het bestand na te lopen: licht (2×), `wereld` zelf, wolken, duiven, robots,
camera, brokstukken, twee soorten vonken en munten. Geen daarvan is een
bouwfunctie; alle ~40 bouwfuncties gaan via `wereld.add()`, rechtstreeks of
via de gedeelde primitieven (`blok`, `vloerRechthoek`, `vloerPoly`,
`lijnOpGrond`, …), die zelf ook allemaal `wereld.add()` doen.

**Dat betekent: `wereld.scale.set(ARENA_SCHAAL, GEBOUW_HOOGTE_SCHAAL,
ARENA_SCHAAL)` — één regel, gezet vóór alle bouwfuncties draaien — schaalt de
HELE stad in één keer: positie, voetafdruk én hoogte, voor alle ~40
bouwfuncties, zonder dat er ook maar één hardgecodeerde coördinaat in hun
lichaam hoefde te veranderen.** Reden: een kind-object op lokale positie
`(x, z)` rendert op wereldpositie `(x, z) × wereld.scale` zodra de ouder een
schaal heeft — Three.js doet dat al voor je bij elke `updateWorldMatrix`.
`registreerObstakel()` leest die wereldmatrix, dus die 8 aanroepen (zie
onder) kregen hun juiste, geschaalde botsbox helemaal gratis.

**Wat WEL met de hand moest, en waarom — drie categorieën:**

1. **De negen `registreerRechthoek()`-aanroepen.** Ze rekenen met kale
   getallen, buiten elke wereldmatrix om, dus D4 vermenigvuldigde alle vijf
   argumenten (de vier coördinaten én de marge) met `ARENA_SCHAAL`, op de
   plek waar de functie ZELF de rechthoek opbouwt — niet op de call-site.
   Reden voor dat onderscheid: bij de zes parameterversies (bv.
   `bouwReparatiepost(x, z)`) wordt `x`/`z` OOK gebruikt om `g.position.set(x,
   0, z)` te zetten — dat moet ONGEWIJZIGD blijven (dat is al een lokale
   coördinaat die via `wereld.scale` vanzelf goed komt); alleen de
   `registreerRechthoek(x ± …, z ± …)`-berekening daaronder moest zelf
   `× ARENA_SCHAAL`. De call-site aanpassen zou dubbel schalen.

   | Regel | Wat |
   |---:|---|
   | 1163 | Koninklijk Paleis |
   | 1200 | Reparatiepost-markering |
   | 1281 | Nieuwe Kerk |
   | 1312 | Kerkklok |
   | 1410 | **Nationaal Monument** |
   | 1726 | Lantaarnpaal |
   | 1781 | Terras |
   | 1895 | Upgradekiosk |
   | 1915 | Boom |

2. **De marge van alle 8 `registreerObstakel()`-aanroepen.** De doos zelf
   komt automatisch goed (zie boven), maar de marge (0,1–0,5, een vaste
   bufferzone in meters rond de doos) is een los getal dat NIET door de
   wereldmatrix loopt — zonder correctie zou die marge na D4 relatief 3× zo
   groot zijn t.o.v. het nu kleinere gebouw. Elke marge kreeg daarom een
   call-site `× ARENA_SCHAAL`.
3. **De tram** (§3.5) — het enige geval waar KIND-positie handmatig als
   wereldpositie werd (her)gebruikt buiten de twee registratiefuncties om.

**GRENS, de schaduwcamera en de monument-hoogte** zijn de drie dingen die
GEEN kind van `wereld` zijn en dus ook met de hand moesten: `GRENS` is een
losse gameplay-grens (§3.1), de schaduwcamera hoort bij `zon` (§2), en het
monument kreeg een EIGEN, extra `g.scale.y` bovenop `wereld`'s hoogteschaal
om op `MONUMENT_HOOGTE_SCHAAL` (0,8) uit te komen i.p.v. de generieke
`GEBOUW_HOOGTE_SCHAAL` (0,6) — x/z van die extra schaal blijven op 1, anders
zou de voetafdruk van het monument onbedoeld méé opgeblazen worden.

> **Correctie op het oorspronkelijke plan:** de tickettekst noemde als
> to-do-lijst "grondvlak, damPleinPunten, alle bouwfuncties, plaatsGevelrij,
> straatmeubilair, railpad, zebrapaden" — geen van die hoefde aangeraakt te
> worden. Dat was een onvolledig begrip van de group-scale-truc ten tijde
> van het schrijven van het plan: de "technische meevaller" gold niet alleen
> voor `registreerObstakel()`'s botsboxen, maar voor de HELE zichtbare stad.

### 4.3 `MONUMENT_BOX` is een handmatige kopie

De monument-registratie (regel 1410, §4.2) registreert
`(42 ± 10,5, −4 ± 10,5) × ARENA_SCHAAL` met marge `0,2 × ARENA_SCHAAL`.
`MONUMENT_BOX` (regel 2513, §3.1) herhaalt dat met de hand, sinds D5 in
dezelfde geschreven vorm (`(42 ± 10,7) * ARENA_SCHAAL`). **Twee plekken, één
waarheid** — D4 en D5 hielden ze allebei bewust in exact dezelfde vorm, dus
ze staan weer gelijk, maar er is nog steeds niets dat dat AFDWINGT: wijzigt
een toekomstig ticket de een, dan moet de ander met de hand mee.

---

## 5. De speler (regel 2305)

| Veld | Waarde |
|---|---|
| `positie` | (5,33, 0, 10,00) (was (16, 0, 30), Ticket D5: `× ARENA_SCHAAL`) |
| `yaw` / `pitch` | 2,35 / 0, pitch geklemd op ±1,45 |
| `hoogte` | 1,7 m (ongewijzigd — lichaamsmaat, geen wereldafstand) |
| `straal` | 0,4 m (ongewijzigd — lichaamsmaat) |
| `snelheid` | 7 m/s (ongewijzigd, D6-scope), **+0,65 per snelheid-upgrade** |

Muisgevoeligheid: `0,0022` rad per pixel, niet instelbaar.

Beweging (regel 2368): WASD → richtingsvector uit `yaw`, genormaliseerd zodat
diagonaal niet sneller is, dan `losBotsingenOp`, dan camera op ooghoogte met
een loopwiebel van `sin(bobTijd) · 0,035`.

### 5.1 De pauze-gate

`document.pointerLockElement === renderer.domElement` is dé schakelaar. Hij
komt op **vier** plekken voor: `updateSpeler` (2370), de T-handler (2238), de
X-handler (2244), en `gameLoop` (3473).

Bij verlies van pointer lock (regel 2261) worden alle toetsen losgelaten,
`schietKnopIngedrukt` expliciet gereset (een mouseup kan gemist zijn terwijl
het venster geen focus had), de Bijenkorf-winkel gesloten en de
interactieprompt verborgen.

> **Voor tests:** simuleer pointer lock met
> `Object.defineProperty(document, 'pointerLockElement', ...)`. Zonder dat
> staat alles stil en slaagt elke assertie over beweging per ongeluk.

> **Voor D23 (touch):** deze gate is óók de reden dat touch nu niet werkt. Een
> telefoon heeft geen Pointer Lock. D23 moet de gate vervangen door een
> `besturingActief()`-functie die beide gevallen dekt — precies zoals Amsterdam
> Undead het doet.

---

## 6. Robots

### 6.1 Types (regel 2905)

**Sinds de speeltest-feedback na D6 staat hier niet meer de ontwerpwaarde
maar × 0,85** (speeltest: "robots voelen nog net iets te groot", 10-20%
kleiner gevraagd, 15% gekozen). Puur de `schaal`-kolom is geraakt — de rest
van de tabel staat nog op de D6-waarden.

| Key | Spelernaam | hpMax | snelheid× | beloning× | schade | schaal |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `normal` | Grunt | 1 | 1,0 | 1,0 | 8 | 0,85 |
| `sprinter` | Runner | 1 | 1,6 | 0,6 | 8 | 0,7225 |
| `tank` | Tank | 3 | 0,55 | 2,5 | 8 | 1,19 |
| `bomber` | Bomber | 1 | 1,15 | 1,0 | **25** | 0,8925 |
| `shieldbot` | Shield Bot | 1 | 0,85 | 1,8 | 10 | 0,85 |

`shieldbot` heeft daarnaast `schildDuur: 1.8` en `schildPauze: 1.0`.

**De interne keys zijn bevroren** (comment op regel 2901):
`kiesRobotTypeVoorWave`, de debug-exports en alle UI-teksten hangen eraan.
Alleen de weergavenaam mag wijzigen.

Het model (`maakRobot`, 2929) is een `Group` van blokken: twee benen, lijf met
gloeiend borstpaneel, twee armen, kop met twee ogen en een antenne met bolletje.
`groep.scale.setScalar(config.schaal)` doet het formaatverschil.
`groep.userData.robot = robot` is hoe een raak schot de robot terugvindt.

### 6.2 Snelheid — let op, hier zit een valkuil

`maakRobot` zet `snelheid: 1.4 + Math.random()` (regel 2993). **Die waarde
wordt nooit gebruikt.** `spawnRobot` overschrijft hem onmiddellijk:

```js
// Ticket D6: plafond 3,2 -> 3,0 (was 3,52 m/s effectief, nu 3,3).
const basisSnelheid = Math.min(1.35 + Math.random() * 0.7 + spel.wave * 0.07, 3.0) * 1.1;
robot.snelheid = basisSnelheid * config.snelheidMultiplier;
```

De **echte** basissnelheid loopt dus op met de wave en is geplafonneerd:

| Wave | Basissnelheid (m/s) |
|---:|---|
| 1 | 1,56 – 2,33 |
| 5 | 1,87 – 2,64 |
| 10 | 2,26 – 3,03 |
| ≥ 24 | 3,30 (plafond, `3.0 × 1.1`, was 3,52 vóór D6) |

Het plafond wordt bij `Math.random() = 1` al rond wave 14 geraakt en bij
`Math.random() = 0` pas rond wave 24 (was 17/27 vóór D6 — de lagere
plafondwaarde wordt logischerwijs iets eerder bereikt).

> Dit is een **onbedoelde wave-moeilijkheidsknop** die nergens gedocumenteerd
> staat en niet in de HUD zichtbaar is. D6 heeft 'm bewust met 6,25%
> verlaagd (§6.3) om drie poorten boven de reactiedrempel te tillen — een
> mild ingrijpen, geen herontwerp. Bij D16 (economie herijken) moet je hem
> blijven kennen, anders schrijf je effecten toe aan de verkeerde oorzaak.

### 6.3 Spawnen

**Ná D6 zijn zowel de posities als het robot-snelheidsplafond bijgesteld op
basis van een meting**, niet alleen op berekening. `SPAWN_POORTEN` (regel
2540), vijf stuks. `kiesSpawnPoort()` loot **volledig uniform** — geen
weging, geen geheugen, geen spreiding over de kaart. `spawnPlekVoorPoort`
probeert 30× een vrije plek binnen de spreiding van de poort en valt anders
terug op de poortpositie zelf.

Afstand tot het monument is hieronder gegeven tot de doos — **de game rekent
met de doos**, niet met het middelpunt. `afstandTotMonument()` klemt de
positie op `MONUMENT_BOX`.

| Poort | Positie | → doos | Status |
| --- | --- | ---: | --- |
| Damstraat | (53, 0, 2) | 35,4 m | ⚙️ D6: verplaatst (was 23,4 m) |
| Rokin | (−6, 0, 33,3) | 35,1 m | ⚙️ D6: verplaatst (was 31,3 m) |
| Damrak | (−4, 0, −37,2) | 35,4 m | ⚙️ D6: verplaatst (was 32,2 m) |
| Kalverstraat | (−18,33, 0, 30,67) | 40,4 m | ongewijzigd sinds D5 |
| Nieuwendijk | (−17,33, 0, −35,33) | 41,2 m | ongewijzigd sinds D5 |

**Waarom een laterale verschuiving, niet pure radiale verplaatsing.** De
voor de hand liggende aanpak — een poort verder naar buiten schuiven op
dezelfde bearing vanaf de oorsprong — bleek voor Damrak niet genoeg: die zat
al binnen 2 m van `GRENS` op zijn oorspronkelijke lijn, en de verst haalbare
plek daarop was zelf geen `isVrijePlek()`. Elke nieuwe positie is in plaats
daarvan gevonden door te zoeken binnen de `GRENS`-marge naar de verste
`isVrijePlek()`-plek in de buurt van de oorspronkelijke straat, en pas
geaccepteerd na een geslaagde route-simulatie ernaartoe.

**Reistijden**, ná D6's gecombineerde fix (verplaatste poorten + plafond
3,2 → 3,0, zie §6.2):

| Poort | `normal`, wave 1 | `normal`, wave 10 | `normal`, plafond |
| --- | --- | --- | --- |
| Damstraat | 15,2 – 22,7 s | 11,7 – 15,7 s | 10,7 s ✓ (was 6,7 s ✗) |
| Rokin | 15,1 – 22,5 s | 11,6 – 15,6 s | 10,7 s ✓ (was 8,9 s ✗) |
| Damrak | 15,2 – 22,6 s | 11,7 – 15,7 s | 10,7 s ✓ (was 9,1 s ✗) |
| Kalverstraat | 17,3 – 25,9 s | 13,4 – 17,9 s | 12,3 s ✓ (was 11,5 s) |
| Nieuwendijk | 17,7 – 26,4 s | 13,6 – 18,3 s | 12,5 s ✓ (was 11,7 s) |

Alle vijf nu boven de 10s-reactiedrempel, met 0,6–2,5s marge — geen
millimeterwerk rond de grens. Wave 1 valt voor de dichtstbijzijnde poorten
binnen het ontwerpdoel van 15–25s. Gemeten met
`tests/defend-national-monument/meet-dnm-afstanden.mjs`, niet alleen
berekend.

**Kalverstraat heeft een `tussenpunt`** (−15, 0, 15), ongewijzigd sinds D5.
Geen navigatiesysteem maar één hardgecodeerde pleister: zonder dat punt
liepen Kalverstraat-robots rakelings langs het Madame Tussauds-blok en
kwamen ze in dezelfde oostelijke corridor uit als de Rokin-robots, waardoor
het leek alsof ze van poort wisselden.

**De "dichtbij genoeg"-afstand voor dat tussenpunt (`< 6` in `updateRobots`)
bleef ook in D6 ongewijzigd** — geen stuk-risico, wel nog steeds een
navigatiegevoel-vraag voor een latere polijstronde als het bij het spelen
opvalt.

### 6.4 De AI (`updateRobots`, regel 3027)

Per frame, per robot:

1. `ontwijkTimer` aftellen.
2. Shieldbot: `schildTimer` aftellen, schild omklappen, mesh-zichtbaarheid mee.
3. Tussenpunt bereikt? (`< 6 m`) → `tussenpuntBereikt = true`.
4. Doel = tussenpunt of `MONUMENT_POSITIE`; richting = doel + `ontwijkOffset` − positie.
5. **`afstandTotMonument(positie) < 0.6` → `robotRaaktMonument()` en klaar.**
6. Stap zetten met `snelheid × getRobotSpeedMultiplier() × dt`, dan
   `losBotsingenOp(positie, 0.45)`.
7. Vastlopen: kwam hij minder dan 15 % van de bedoelde stap vooruit, dan loopt
   `vastTijd` op. Boven 1,5 s wordt een `ontwijkOffset` van 10 m loodrecht op
   de looprichting gezet, willekeurig links of rechts, voor 3 s.
8. Rotatie draait met `min(1, dt·6)` naar de looprichting.
9. Loopanimatie: benen en armen zwaaien op `sin(stapfase)`, en de robot
   stuitert met `|sin(stapfase)| · 0,06` in y.

> **De botsstraal is hardgecodeerd `0.45`** (regel 3082) en houdt **geen
> rekening met `config.schaal`**. Een tank is 1,4× zo groot maar botst als een
> normale robot; zijn model steekt dus door muren heen. Bij een 1:3-arena met
> smallere straten wordt dat zichtbaar.

---

## 7. Spelsystemen

### 7.1 `spel` (regel 2436)

```
score · wave · waveKills · waveDoel · teSpawnen · maxActieveRobots
monumentHP · combo · comboTimer · tussenWaveTimer · waveBonusGegeven
gameOver · laatsteSpawnPoort · waveGeenMonumentSchade · specialMeter
```

Eén plat object, geen nesting, geen setters. Alles wordt direct gemuteerd.

### 7.2 Waves (`startWave` 2530, `updateWaveSysteem` 2543)

```
waveDoel         = 7 + nummer * 3
maxActieveRobots = min(5 + floor(nummer * 0.65), 13)
tussenWaveTimer  > 4.5 s   → volgende wave
wave-bonus       = 40 + wave * 15
perfecte-wave    = 50 + wave * 10   (geen enkele monument-hit)
```

`maxActieveRobots` bereikt het plafond 13 bij wave 13.

Spawnen gebeurt in een `while`-lus: zolang er nog te spawnen robots zijn én
`robots.length < maxActieveRobots`, komt er één bij. Een wave is klaar als
`teSpawnen <= 0 && robots.length === 0`.

`spel.waveGeenMonumentSchade` wordt in `startWave()` gereset, **niet** in het
wave-compleet-blok. Dat is bewust (comment op regel 2537): reset je het in het
compleet-blok, dan telt de laatste hit van de vorige wave door.

Typemix (`kiesRobotTypeVoorWave`, 2515), gewogen loting:

| Vanaf wave | Type | Gewicht |
|---:|---|---:|
| 1 | normal | 10 |
| 2 | sprinter | 5 |
| 3 | tank | 3 |
| 4 | bomber | 3 |
| 5 | shieldbot | 3 |

Vanaf wave 5 is de mix dus vast op 10/5/3/3/3. **Na wave 5 verandert alleen
nog het aantal en de snelheid.**

### 7.3 Economie

| Bron | Waarde |
|---|---|
| Munt per kill | €5–25 × beloningMultiplier, geklemd op **€150** |
| Wave-bonus | €40 + wave·15 |
| Perfecte wave | €50 + wave·10 |
| Score per kill | `100 × max(1, combo)` |
| Reparatie | €100 → +25 monument-HP |
| Upgrades | `basis + niveau·basis`, basis 100/150/200, max niveau 5 |

Munten (`legMuntNeer`, 3334) zweven, draaien, en verdwijnen na
`MUNT_MAX_LEEFTIJD = 45` s. Oprapen gebeurt binnen
`1.4 + upgrades.pickup * 0.45` meter.

Het plafond van €150 zit er omdat Kerkklok (2×) × tank (2,5×) × combo (2×)
samen tot ~10× kunnen oplopen (comment op regel 3335). **Dit is de enige plek
waar alle multipliers samenkomen.**

De volledige upgradekosten-ladder:

| Niveau | Vuurtempo | Pickup | Snelheid |
|---:|---:|---:|---:|
| 1 | €100 | €150 | €200 |
| 2 | €200 | €300 | €400 |
| 3 | €300 | €450 | €600 |
| 4 | €400 | €600 | €800 |
| 5 | €500 | €750 | €1000 |
| **totaal** | **€1500** | **€2250** | **€3000** |

### 7.4 Multipliers zijn pure functies — de belangrijkste invariant

`getRobotSpeedMultiplier()`, `getRewardMultiplier()`,
`getComboGeldMultiplier()` en `getComboVuurtempoMultiplier()` (regels
2669–2696) lezen live state af en geven een factor terug. **Ze schrijven nooit
naar `robot.snelheid` of een andere basiswaarde.** Daardoor kan er niets
blijven plakken na afloop van een boost, ook niet bij respawns, en is stacking
onmogelijk.

> **Regel: een nieuwe tijdelijke buff volgt dit patroon of hij komt er niet
> in.** Een buff die een basiswaarde vermenigvuldigt en later "terugzet" is
> precies de bug die dit patroon voorkomt.

**Eén uitzondering, en die is bewust permanent:** de snelheid-upgrade doet
`speler.snelheid += 0.65` (regel 2634). Dat is een blijvende aankoop, geen
tijdelijke buff, dus het patroon geldt daar niet — maar het betekent wel dat
`speler.snelheid` na vijf niveaus op 10,25 m/s staat en dat er geen enkele
plek is waar dat wordt teruggezet. Bij D9 (herstarten zonder verversen) moet
dat expliciet terug naar 7.

### 7.5 Combo

| Drempel | Geld | Vuurtempo |
|---:|---|---|
| 3 | 1,25× | — |
| 5 | — | 0,85× |
| 6 | 1,5× | — |
| 10 | 2,0× | 0,7× |

`comboTimer` = 3,2 s normaal, 4,5 s tijdens de Kerkklok Boost. Een
monument-hit zet de combo direct op 0.

`comboTier()` (regel 2698) bestaat apart zodat de tier-popup één keer per
drempel verschijnt in plaats van bij elke kill in een hoge tier.

In `vernietigRobot` wordt de combo **eerst opgehoogd en dán pas de munt
neergelegd** (regel 3303), zodat de beloning van díe kill de net bereikte tier
al meeneemt.

### 7.6 Kerkklok Boost en special (regel 2655)

30 s actief, 60 s cooldown, 1,4× robotsnelheid en 2× beloning. Bereikbaar via
de T-interactie bij de Nieuwe Kerk én via de special-meter (X).

De special (`gebruikSpecial`, 2740) vult 8 per kill tot 100 en slaat de
cooldown-**gate** over, maar deelt verder de hele body (`startKerkklokBoost`).
De cooldown ná afloop loopt in beide gevallen via `updateKerkklokBoost()`,
zodat een gratis special nooit een gratis loop wordt.

> Merk op dat de "boost" robots **sneller** maakt in ruil voor dubbel geld.
> Het is een risico-knop, geen power-up. Dat is een goed ontwerp en het is het
> enige echte spanningsmoment dat de game nu heeft.

### 7.7 Interactiepunten (regel 2903)

| Naam | Type | Positie | Radius | → monumentrand |
|---|---|---|---:|---:|
| Kerkklok Boost | `kerkklok` | (−22,33, 0, −12,67) | 4 | ~33,7 m |
| Koninklijke Reparatie | `reparatie` | (−23,33, 0, 1,67) | 4 | ~33,8 m |
| Bijenkorf Upgrades | `upgradeShop` | (20,00, 0, −5,67) | 4 | ~2,6 m |

`updateInteracties` kiest het dichtstbijzijnde punt binnen zijn radius. De
check is **puur euclidisch, zonder zichtlijn of muurcontrole**. Dat is hier
onschadelijk omdat 4 m klein is ten opzichte van de gebouwen.

**Sinds D5** blijft `radius` bewust ongeschaald (4 m — een interactieafstand op
mensenmaat, geen wereldafstand), maar de POSITIES zijn wel × `ARENA_SCHAAL`
verplaatst. D5 controleerde expliciet dat dat geen overlap veroorzaakt:
Kerkklok en Reparatie liggen nu 14,4 m uit elkaar (som van de radii is 8 m) —
ruim genoeg, bevestigd door `test-dnm-kern.mjs`'s overlap-check. In Amsterdam
Undead heeft exact deze constructie ooit wél een bug opgeleverd, toen een
radius daar naar ~16 m groeide: je kon door muren en ongekochte deuren heen
interacteren. Hier is dat risico dus bewust vermeden door de radius NIET mee
te schalen.

De Bijenkorf-winkel sluit zichzelf zodra hij niet meer het dichtstbijzijnde
punt is (regel 2859), zodat de 1/2/3-hotkeys niet actief blijven als je
wegloopt.

**Twee van de drie punten liggen zelf NIET op een vrije plek** — gevonden bij
D2. De Kerkklok- en Reparatie-markering staan op hun eigen, kleine
geregistreerde rechthoek (regel 1168/1278: de markering zelf is een
obstakel, zodat je er niet doorheen loopt). `isVrijePlek(x, z)` op het
exacte punt-coördinaat geeft voor beide dus `false`, ook al zijn ze
overduidelijk speelbaar — de speler nadert van opzij, niet via het
middelpunt. **De juiste vraag is niet "is het punt zelf vrij", maar "kan de
speler ergens binnen de interactieradius gaan staan"** — dat is wat
`test-dnm-kern.mjs` bemonstert (24 hoeken op 75% van de radius). Bij D10
(tien nieuwe bouwplekken) geldt dezelfde valkuil: een bouwplek-markering zal
zelf ook een obstakel zijn.

---

## 8. Wapen en schot

Het wapenmodel (regel 3125) is een kind van de camera: loop, kast, greep en
een **oranje dopje** op de loop — bewust speelgoed, geen echt wapen. Plus een
mondingsvlam (`SphereGeometry`) en een `PointLight(0xffb347, 1.35, 7)`.

```js
huidigeSchotCooldown() = max(0.07, (0.26 - upgrades.vuurtempo * 0.035) * getComboVuurtempoMultiplier())
```

| Vuurtempo-niveau | Cooldown | Met combo ≥ 10 |
|---:|---:|---:|
| 0 | 0,260 s | 0,182 s |
| 3 | 0,155 s | 0,109 s |
| 5 | 0,085 s | **0,070 s** (plafond) |

Het schot (`schiet`) is een hitscan-raycast vanuit het schermmidden,
`raycaster.far = 50` (was 150, Ticket D5: `× ARENA_SCHAAL` — de verhouding
wapenbereik/kaartdiagonaal blijft zo gelijk aan vóór de herschaling), tegen
`robots.map(r => r.groep).concat([wereld])`. Bij een treffer loopt de code
omhoog door `parent` tot hij `userData.robot` vindt.

Een actief shieldbot-schild blokkeert het schot **volledig en vóór** de
hitmarker, camera shake en `raakRobot` — anders krijgt de speler misleidende
"het werkte"-feedback (comment op regel 3254).

**Er is geen munitie, geen herladen, geen wapenwissel, geen spread en geen
terugslag op het richtpunt.** Het enige dat het vuren begrenst is de cooldown.
Dat is de hele reden voor fase 4 (oververhitting).

Brokstukken (`maakBrokstuk`, 3175): zwaartekracht 14 m/s², stuiteren met
factor −0,35 en wrijving 0,7, krimpen vanaf 1,6 s en verdwijnen onder schaal
0,05. **Ongelimiteerd in aantal** — één tank levert ~12 meshes op.

---

## 9. UI, audio, game-loop

### 9.1 `updateArcadeUI()` (regel 2472)

Werkt in één keer score, wave, objective, combo, special en de **volledige
`shopUI.innerHTML`** bij. Dat laatste gebeurt dus ook bij elke kill, terwijl
het menu meestal dicht is. Goedkoop genoeg om te negeren, maar het is een
onnodige DOM-herbouw in de hot path.

### 9.2 Audio (regel 3408)

Eén `AudioContext`, geïnitialiseerd bij de eerste klik op het startscherm
(browserregel). Eén hulpfunctie:

```js
piep(type, startHz, eindHz, duur, volume)
```

Zes geluiden: `speelSchot`, `speelTramBel`, `speelMunt`, `speelExplosie`,
`speelKerkklok`, `speelSchildBlok`. Geen mixer, geen master gain, geen
registry, geen ruislaag, geen positioneel geluid.

> **Bewust buiten scope** (zie het plan §3). Nieuwe systemen krijgen geluid via
> diezelfde `piep()`, niet via een nieuw audiosysteem.

### 9.3 De game-loop (regel 3459)

```js
const dt = Math.min((nu - vorigeTijd) / 1000, 0.05);   // plafond 50 ms
klok += dt;
updateSpeler(dt);                                       // ALTIJD
const spelActief = document.pointerLockElement === renderer.domElement && !spel.gameOver;   // sinds D7
if (spelActief) { runStats.speelduur += dt; … update-functies … } else { verbergInteractiePrompt(); … }
```

Let op de volgorde: **`updateSpeler` draait ook tijdens de pauze.** Dat is
nodig omdat `losBotsingenOp` en de camerapositie anders bevriezen op een
tussenstand, maar het betekent wel dat de speler-collision tijdens de pauze
blijft draaien.

> **Sinds D7 checkt `spelActief` ook `spel.gameOver`.** Daarvoor draaide na
> game over alles door behalve `updateWaveSysteem` en `updateRobots` (die
> stoppen zelf al): je kon munten oprapen en de speelduur liep door. Omdat
> niet alles via de game-loop loopt, zijn ook `probeerTeSchieten()` (die de
> mousedown-handler rechtstreeks aanroept), de T- en X-toets, lopen in
> `updateSpeler()` en de startscherm-klik apart op `gameOver` afgedekt.

### 9.4 Minimap en richtingspijlen (speeltest-feedback na D6, STAP 7.5)

Antwoord op "lastig te bepalen waar de robots zijn en vandaan komen" — de
eigenaar koos via `AskUserQuestion` expliciet **beide** opties, niet één:

- **`tekenMinimap()`**: vast 2D-`<canvas>` (`#minimapCanvas`, 140×140px,
  rechtsonder). Lineaire projectie van de `GRENS`-rechthoek naar canvas-
  pixels (`(x - GRENS.minX) / (GRENS.maxX - GRENS.minX) * breedte`, idem
  voor z/hoogte). Monument = gele stip, robots = rode stippen, speler = wit
  driehoekje geroteerd op `-speler.yaw`. Elk frame volledig herberekend
  zolang `spelActief`, geen incrementele state.
- **`updateRichtingspijlen()`**: vaste pool van 5 herbruikbare
  `.robotpijl`-divs (`robotPijlenPool`, zelfde pool-i.p.v.-recreate-patroon
  als brokstukken). Per robot: `projecteerOpScherm()` geeft NDC-coördinaten
  via `Vector3.project(camera)`; robots die al op scherm staan worden
  overgeslagen, de rest gesorteerd op afstand en de dichtstbijzijnde 5
  krijgen een pijl. Richting: de NDC-hoek geklemd op een schermrand-marge
  (`0.85`), rotatie via `atan2(dx, -dy)` (driehoekje wijst standaard omhoog).
  **Robots verder dan de pool-grootte krijgen simpelweg geen pijl** — bewust
  geen queue of prioriteit-heuristiek buiten "dichtstbijzijnde eerst".

> **`projecteerOpScherm()` leunt op `camera.matrixWorldInverse`, een
> gecachte matrix die alleen ververst tijdens `updateMatrixWorld()`.**
> `updateSpeler(dt)` zet alleen `camera.position`/`camera.rotation` (de
> lokale transform) — niet de gecachte wereldmatrix. Zonder een expliciete
> `camera.updateMatrixWorld()` vóór `tekenMinimap()`/`updateRichtingspijlen()`
> gebruiken beide de camera-oriëntatie van het VORIGE frame (normaal
> onzichtbaar, ~16ms, maar wel een echte bug — gevonden via een functionele
> test die de projectie leek om te draaien). De game-loop roept die update nu
> expliciet aan vlak vóór beide functies; zie §10, punt 12.

### 9.5 Eindscherm, highscore en opnieuw spelen (D7, D8, D9)

- **`eindigRun()`** is de enige ingang naar game over (aangeroepen vanuit
  `robotRaaktMonument()` bij 0 HP). Volgorde telt: eerst `spel.gameOver =
  true`, dan pas `exitPointerLock()` — de pointerlockchange-handler leest
  `gameOver` om het pauzescherm te onderdrukken.
- **`runStats`** (gemaakt door `nieuweRunStats()`): kills per type,
  schoten, treffers (alleen met effect, een schild-blok telt niet),
  verdiend geld, hoogste combo, hoogste wave, speelduur (alleen actieve
  frames). **Alle inkomsten lopen via `verdienGeld(bedrag)`**; wie een
  nieuwe geldbron toevoegt en rechtstreeks `geld +=` schrijft, laat
  `verdiendGeld` stil achterlopen. Uitgaven gaan wel nog via `geld -=`.
- **Highscore** (`HIGHSCORE_KEY = 'defendNationalMonumentHighscore'`):
  `leesHighscore()` valideert de vorm en geeft alleen `{ score, wave, datum }`
  terug; `schrijfHighscore()` slikt een geweigerde localStorage in;
  `verwerkHighscore()` vergelijkt en bewaart (score 0 is nooit een record).
- **`resetRun()`** zet een momentopname terug (`BEGINSTAAT`, genomen bij het
  laden vóór `startWave(1)`) van `spel`, `upgrades`, `kerkklokBoost` en de
  speler. Nieuwe velden in die vier objecten worden dus vanzelf mee-
  gereset. **Dat geldt NIET voor losse `let`-variabelen op moduleniveau** —
  die staan met de hand in `resetRun()` én in de getter `runStateStand()`,
  zodat `test-dnm-reset.mjs` ze kan vergelijken. Zie §10, punt 14.

### 9.6 Zichtbare monumentschade (D20)

`monumentSchade = { tier, overgangen, delen }` staat vóór
`bouwNationaalMonument()`, omdat die functie tijdens het laden al
`pasMonumentSchadeToe(0)` aanroept. Om dezelfde reden staan
`MONUMENT_SCHADE_DREMPELS` en `MONUMENT_SCHEEFSTAND` daar (TDZ — zelfde
valkuil als de schaduwcamera in D4).

- **`monumentSchadeTier(hpProcent)`**: puur, drempels 66/33/10 → tier 1/2/3.
- **`updateMonumentSchade()`**: aanroepen na elke wijziging van
  `spel.monumentHP` (nu: `robotRaaktMonument`, `koopMonumentReparatie`). Doet
  alleen iets bij een tier-wissel; alleen verslechtering krijgt melding,
  geluid en camerashake. `resetRun()` zet de staat rechtstreeks terug
  (inclusief `overgangen = 0`).
- **`pasMonumentSchadeToe(tier)`** leidt de complete zichtbare staat uit de
  tier af, zonder vorige stand te onthouden — daardoor schakelt herstel
  vanzelf terug.
- **`updateMonumentEffecten()`** (game-loop, alleen actief spel): rook laten
  opstijgen, alarm laten knipperen. Doet niets onder tier 2.

Zuil en spits zitten sinds D20 in een eigen `pyloon`-groep (draaipunt op de
voet, y = 2) voor de scheefstand; wereldposities zijn ongewijzigd. Rook en
alarm krijgen `scale.y × MONUMENT_ROND_Y` (= `ARENA_SCHAAL /
MONUMENT_HOOGTE_SCHAAL`) om de niet-uniforme monumentschaal op te heffen —
anders worden bollen hoge, smalle ellipsen. Het alarm is bewust géén
`PointLight` (aan/uit schakelen dwingt shader-hercompilatie af).

---

## 10. Valkuilen

1. **De pauze-gate.** Tests moeten pointer lock simuleren, anders staat alles
   stil en slaagt elke beweging-assertie per ongeluk. Zie §5.1.
2. **`robot.snelheid` uit `maakRobot` is dood.** De echte waarde komt uit
   `spawnRobot` en **schaalt met de wave**. Zie §6.2.
3. **`MONUMENT_BOX` is een handmatige kopie** van de obstakel-rechthoek op
   regel 1365. Zie §4.3.
4. **`afstandTotMonument` meet tot de dóós, niet tot het middelpunt.** ~10 m
   verschil. Wie in een test het middelpunt gebruikt, zit er structureel naast.
5. **De robot-botsstraal `0.45` negeert `config.schaal`.** Een tank botst als
   een normale robot. Zie §6.4.
6. **`registreerRechthoek` schaalt niet mee, `registreerObstakel` wel.** Negen
   aanroepen van elk. Zie §4.2.
7. ~~**`spelActief` checkt `gameOver` niet.**~~ Opgelost in D7. Zie §9.3.
8. **`speler.snelheid` wordt permanent opgehoogd** door de upgrade. Binnen een
   run blijft dat zo; sinds D9 zet `resetRun()` hem terug. Zie §7.4 en §9.5.
9. **De gameplay-RNG heeft geen seed.** Alleen het decor is deterministisch.
   Zie §3.6.
10. **De resize-handler zet `setPixelRatio` niet opnieuw.** Zie §2.
11. ~~**Er is geen enkele test.**~~ Sinds D1 wel; zie §13.
12. **`Vector3.project(camera)` leunt op een gecachte matrix die niet
    vanzelf meebeweegt met `camera.position`/`camera.rotation`.** Wie ergens
    anders in de code (of in een test) de camera handmatig verzet en direct
    daarna projecteert, moet zelf `camera.updateMatrixWorld()` aanroepen —
    anders projecteer je tegen het vorige frame. Zie §9.4.
13. **De raycaster van het wapen slaat onzichtbare objecten niet over.**
    `raycaster.intersectObjects(…, true)` kijkt niet naar `visible`. Een
    verborgen mesh in `wereld` houdt dus gewoon schoten tegen. Verberg je
    iets dat groot genoeg is om geraakt te worden, zet dan ook zijn
    `raycast` uit (zie `zetMonumentDeelZichtbaar()`, §9.6).
14. **Een nieuwe `let` op moduleniveau die run-state bevat, moet met de hand
    in `resetRun()` én in `runStateStand()`.** Velden in `spel`, `upgrades`,
    `kerkklokBoost` en `speler` gaan automatisch mee via `BEGINSTAAT`; losse
    variabelen niet. Zie §9.5.
15. **`registreerRechthoek()` geeft sinds D11 een handle terug.** Wie een
    obstakel weer wil weghalen, bewaart die handle en gebruikt
    `verwijderObstakel(handle)`. Nooit op index uit `obstakels` splicen: de
    array heeft geen id's en groeit/krimpt met torens en hekken. Zie §14.4.
16. **De volgorde in `updateRobots()` is een contract.** Monument-contact →
    bomberdoel (D14) → hek slaan (D13) → lopen. Een robot die slaat, slaat
    ook de vastloop-detectie over; anders wijkt hij na 1,5 s uit en loopt om
    het hek heen. Zie §14.5.
17. **Themagolven veranderen `waveDoel`, het robottype en het aantal poorten
    voor waves 6, 10, 14, …** Een test die `7 + 3·wave` of "twee poorten
    vanaf wave 3" aanneemt, moet `themaVoorWave()` /
    `aantalPoortenVoorWave()` gebruiken. Zie §14.8.
18. **De mist wordt op twee plekken gezet** (STAP 1 en opnieuw in STAP 2).
    `MIST_BASIS` wordt daarom pas na het bouwen van de wereld vastgelegd. Zie
    §14.8.
19. **Balanswaarden horen niet hard in tests.** Sinds D16 lezen de
    torentests hun verwachtingen uit `TOREN_TYPES`, zodat een volgende
    balansronde geen tests breekt, alleen gedrag.

---

## 11. Dode code

Vijf stuks, alle vijf geverifieerd met een zoekopdracht over het hele bestand:

| Wat | Regel | Waarom dood |
|---|---:|---|
| `ROBOT_AANTAL = 0` | 2889 | Nergens gelezen; v4 gebruikt het wave-systeem |
| `respawnLijst = []` | 2891 | Aangemaakt, nooit gevuld of gelezen |
| `vindDichtstbijzijndeInteractie()` | 2866 | Gedefinieerd, nergens aangeroepen |
| `robot.pauze` | 2992 | Veld gezet, nergens gelezen |
| `robot.snelheid` in `maakRobot` | 2993 | Overschreven door `spawnRobot` |

Geen van deze vijf doet kwaad, maar ze sturen een lezer op het verkeerde been
— punt 5 heeft mij bij het opstellen van dit document een foute
snelheidstabel opgeleverd. **Opruimen mag in elk ticket dat toch in dat blok
komt, maar niet als losse "opruimcommit" tussendoor.**

---

## 12. Debug-hook (regel 3516)

**`window.DamChaosDebug` bestaat al** en is breed — Ticket D1 heeft 'm
uitgebreid, niet aangemaakt. De naam blijft — hernoemen breekt niets
functioneels maar levert alleen ruis op.

Sinds D1 geëxporteerd (33 stuks, van vóór D1):

```
scene · camera · speler · robots · munten · obstakels · interactiePunten
spel · upgrades · ROBOT_TYPES · kerkklokBoost
spawnRobot · spawnRobotVanafPoort · vernietigRobot · raakRobot · schiet
kiesRobotTypeVoorWave · waveBannerTekst · startWave · updateWaveSysteem
robotRaaktMonument · huidigeSchotCooldown · isVrijePlek
geldStand() · geldZet(n) · bijenkorfShopOpenStand()
getRobotSpeedMultiplier · getRewardMultiplier
getComboGeldMultiplier · getComboVuurtempoMultiplier
gebruikSpecial · activeerKerkklokBoost · updateKerkklokBoost
```

Door D1 toegevoegd (20 stuks):

```
GRENS · MONUMENT_POSITIE · MONUMENT_BOX · MONUMENT_MAX_HP · SPAWN_POORTEN
afstandTotMonument · upgradeKosten · losBotsingenOp · updateRobots
koopUpgrade · koopMonumentReparatie · legMuntNeer · updateInteracties
activeerHuidigeInteractie · activeerBijenkorfUpgradeShop
updateMunten · updateSpeler · probeerTeSchieten
klokStand() · huidigeInteractieStand()
```

Door D4 toegevoegd (1 stuk — een bugfix, geen D4-scope-uitbreiding):

```
renderer
```

Door de speeltest-feedback na D6 toegevoegd (6 stuks, zie §9.4):

```
tekenMinimap · updateRichtingspijlen · verbergRichtingspijlen
projecteerOpScherm · robotPijlenPool · ARENA_SCHAAL
```

Door fase 3 toegevoegd (zie §14):

```
aantalActievePoorten · kiesActievePoorten · kiesSpawnPoort · poortBakens · updatePoortBakens      (D28)
WAPEN_BEREIK · raycaster                                                                        (D29)
BOUWPLEKKEN · BOUWPLEK_RADIUS · puntOpRoute · looproute                                         (D10)
TOREN_TYPES · torens · bouwToren · verwijderToren · updateTorens · activeerBouwplek
kiesTorenDoel · verwijderObstakel · bouwMenuStand()                                             (D11)
BOUWFASE_DUUR · VROEGE_START_BONUS_PER_SECONDE · inBouwfase · bouwfaseResterend
startVolgendeWaveNu                                                                             (D15)
torenStats · upgradePrijs · reparatieKosten · verkoopOpbrengst · upgradeToren · repareerToren
verkoopToren · TOREN_VERKOOP_FRACTIE · TOREN_REPARATIE_PER_HP                                   (D12)
ROBOT_HEK_SCHADE · ROBOT_SLAG_INTERVAL · HEK_CONTACT_AFSTAND · hekInContact · afstandTotHek
hekPaalOffsets · beschadigToren · vernietigToren                                                (D13)
BOMBER_DOEL_STRAAL · BOMBER_TORENSCHADE · kiesBomberDoel · bouwwerkPunt                         (D14)
MUNT_BASIS_MIN · MUNT_BASIS_MAX · WAVE_BONUS_BASIS · WAVE_BONUS_PER_WAVE
PERFECT_BONUS_BASIS · PERFECT_BONUS_PER_WAVE                                                    (D16)
THEMAGOLVEN · THEMA_VOLGORDE · THEMA_EERSTE_WAVE · THEMA_INTERVAL · THEMA_BONUS_FACTOR
themaVoorWave · themaSleutelVoorWave · aantalPoortenVoorWave · robotTypeVoorLopendeWave
MIST_BASIS                                                                                      (D30)
```

`runStateStand()` kreeg er `bouwMenuPlek`, `aantalTorens` en
`aantalObstakels` bij, zodat `test-dnm-reset.mjs` ook torens en obstakels op
lekken controleert.

Door fase 2 toegevoegd (D7, D8, D9, D20; zie §9.5 en §9.6):

```
runStats · eindigRun · toonEindscherm · verdienGeld                       (D7)
HIGHSCORE_KEY · leesHighscore · schrijfHighscore · verwerkHighscore        (D8)
resetRun · BEGINSTAAT · runStateStand()                                    (D9)
monumentSchade · monumentSchadeTier · updateMonumentSchade
pasMonumentSchadeToe · MONUMENT_SCHADE_DREMPELS                            (D20)
```

`runStateStand()` volgt het `…Stand`-getterpatroon maar bundelt negen losse
`let`-variabelen in één object (`geld`, `laatsteSchotTijd`, `terugslag`,
`vlamTimer`, `hitmarkerTimer`, `cameraShake`, `schietKnopIngedrukt`,
`huidigeInteractie`, `bijenkorfShopOpen`) — precies de set die `resetRun()`
met de hand terugzet.

**`renderer` ontbrak, en dat was een latent, tot dan toe onopgemerkt gat.**
`tests/helpers-defend.mjs`'s `openDefend({ simuleerPointerLock: true })` las
sinds D1 al `window.DamChaosDebug.renderer.domElement` (gekopieerd van
Undead's `helpers.mjs`-patroon), maar `renderer` stond niet in D1's
exportlijst — een `TypeError` die nooit afging omdat geen enkele D1/D2-test
`simuleerPointerLock: true` gebruikte. Gevonden en gefixt tijdens D4 (nodig
voor de verificatieschermafbeeldingen), vóórdat een latere ticket die wél
pointer lock nodig heeft erop zou stuklopen.

Patroon voor `let`-variabelen: een getter, niet de waarde zelf — anders
bevriest de export de waarde op moduleniveau. `klokStand`/`huidigeInteractieStand`
volgen hier het bestaande `geldStand`-patroon (een `…Stand`-functie, geen
kale eigenschapsnaam die de waarde van het moment van export zou bevriezen).

`tests/helpers-defend.mjs` opent de game via `openDefend()` en gebruikt dit
object voor alles: `test-dnm-laadt.mjs` controleert de aanwezigheid van de
D1-sleutels hierboven bij elke wijziging aan dit bestand (nog niet
uitgebreid met een check op `renderer` — dat mag een kleine aanvulling zijn
bij de eerste gelegenheid die dit bestand tóch alweer aanraakt).

---

## 13. Testdekking

Ná fase 3: vijftien bestanden, 387 checks in totaal. De fase-3-bestanden:
`test-dnm-poorten.mjs` (D28, 17), `test-dnm-wapenbereik.mjs` (D29, 10),
`test-dnm-bouwplekken.mjs` (D10, 44), `test-dnm-toren-geschut.mjs` (D11, 19),
`test-dnm-bouwfase.mjs` (D15, 12), `test-dnm-toren-niveaus.mjs` (D12, 21),
`test-dnm-hek.mjs` (D13, 46 — een echte robot per bouwplek), 
`test-dnm-toren-aanval.mjs` (D14, 7), `test-dnm-themagolven.mjs` (D30, 13).
Daaronder de stand ná fase 2:

- `tests/defend-national-monument/test-dnm-laadt.mjs` (D1, 20 checks): de
  game laadt, de wereld is gebouwd, wave 1 staat klaar, en alle 53
  debug-sleutels zijn aanwezig.
- `tests/defend-national-monument/test-dnm-kern.mjs` (D2, 70 checks):
  gedragstests in verhoudingen — poorten en interactiepunten binnen `GRENS`
  en bereikbaar, een route-simulatie per poort die ook na D4's herschaling
  nog betekenis heeft, de wave-/upgrade-/cooldown-formules, en
  `robotRaaktMonument()`.
- `test-dnm-eindscherm.mjs` (D7, 26 checks): runStats tijdens een run, het
  eindscherm en zijn inhoud, en dat na game over alles stilvalt — met
  pointer lock bewust nog gesimuleerd aan.
- `test-dnm-highscore.mjs` (D8, 25 checks): roundtrip, tien corrupte vormen,
  record over een herlaadbeurt heen, geweigerde localStorage.
- `test-dnm-reset.mjs` (D9, 12 checks): momentopname → volledige run →
  reset → diepe vergelijking van elke geëxporteerde teller (plus het aantal
  scene-kinderen en de monumentstaat), daarna echt weer spelen, en de
  Opnieuw-knop.
- `test-dnm-monument-schade.mjs` (D20, 25 checks): tier-grenzen, zichtbare
  staat per tier, overgangen bij heen-en-weer, reparatie, raakbaarheid van
  verborgen/effectonderdelen, animatie van rook en alarm.

Plus twee meetscripts (`meet-dnm-afstanden.mjs`, D6/D29, en
`meet-dnm-economie.mjs`, D16), die bewust niet in
`run-all.mjs` meedraait.

Vóór D0/D1 was dit **nul**: alle 117 (nu 118) testscripts in `tests/` gingen
uitsluitend over `amsterdam-undead.html`. Dat was de reden om met
testinfrastructuur te beginnen in plaats van met de herschaling: een arena
1:3 verkleinen zonder testvangnet is een wijziging waarvan je de schade pas
ziet als je er zelf tegenaan loopt.

Nieuwe tests krijgen het voorvoegsel **`test-dnm-`**, zodat `run-all.mjs` ze
vanzelf oppikt zonder dat de undead-suite verandert.

---

## 14. De torenkern (fase 3)

### 14.1 Aangekondigde poorten (D28)

`spel.actievePoorten` (lopende wave) en `spel.volgendePoorten` (al gekozen
voor de volgende, gevuld zodra een wave compleet is). `startWave()` neemt
`volgendePoorten` over als die er zijn, anders kiest hij zelf (wave 1, reset).
`kiesSpawnPoort()` loot alleen uit de actieve poorten. De lichtbakens
(`poortBakens`, één per poort) staan rechtstreeks in de scene en hebben een
lege `raycast` — ze houden nooit een schot tegen (§10, punt 13).

### 14.2 Wapenbereik (D29)

`WAPEN_BEREIK = 22` is `raycaster.far`. Raakt een schot binnen bereik niets,
dan doet `toonBuitenBereik()` een tweede raycast met
`BUITEN_BEREIK_CONTROLE` (50 m) en zet bij een treffer verderop een
stofwolkje op 22 m. Die functie zet `raycaster.far` daarna altijd terug.

### 14.3 Bouwplekken en looproutes (D10)

`looproute(poort)` simuleert bij het laden (en gecached) de echte route: stap
0,25 m, botsstraal 0,45, tussenpunt binnen 6 m. **Niet de rechte lijn** — die
loopt bij Rokin en Nieuwendijk door gebouwen. `puntOpRoute(poort, fractie)`
geeft een punt plus de lokale looprichting (over ±8 stappen gemiddeld).

Elke `BOUWPLEKKEN`-entry heeft:
- `poort`, `index` en `positie`;
- `route` (het routepunt ernaast, met richting) en `zijOffset` (hoe ver de
  plek loodrecht naast de route ligt; het hek gebruikt die twee);
- `toren` (of `null`), `groep` en `kaderMateriaal`.

Plekken zijn ook interactiepunten (type `'bouwplek'`).

### 14.4 Torens en hekken (D11–D13)

Eén datamodel voor beide soorten bouwwerk, in `torens`:

```
{ type: 'geschut'|'hek', plek, groep, niveau, geinvesteerd, hp, hpMax,
  obstakelHandles: [...], hpBalk,
  // geschut: kop, spoor, spoorTimer, cooldown, doel, ringen
  // hek: lijn { ax, az, bx, bz } }
```

- **Stats per niveau** komen uit `TOREN_TYPES[type].niveaus[niveau - 1]`,
  via `torenStats()`. De velden op het type zelf zijn niveau 1.
- **Obstakels:**
  - een toren registreert één rechthoek van 1,4 × 1,4 m;
  - een hek registreert één rechthoek per paaltje (0,6 m, 0,3 m tussenruimte),
    omdat een schuin hek geen assen-uitgelijnde rechthoek is;
  - `verwijderToren()` haalt ze allemaal via hun handles weg (§10, punt 15).
- **Kills door een toren** (`raakRobot(robot, schade, 'toren')`) geven een
  munt en score, maar geen combo en geen special-meter.
- **Bouwmenu:** `bouwMenuPlek` + `bouwUI`, zelfde patroon als de Bijenkorf.
  Op een lege plek bouw je (1 toren, 2 hek), op een bezette plek upgrade je
  (1), repareer je (2) of verkoop je (3). Het menu sluit bij weglopen en bij
  pauze.

### 14.5 Robot-AI na fase 3 (D13, D14)

Per robot, in deze volgorde (§10, punt 16):
1. Monument geraakt? → `robotRaaktMonument`.
2. Bomber met een bouwwerk binnen `BOMBER_DOEL_STRAAL`? → daarop af; bij
   contact `bomberOntploftBijToren` (45 schade).
3. Hek in contact (`HEK_CONTACT_AFSTAND`)? → stilstaan, elke 0,8 s
   `ROBOT_HEK_SCHADE[type]`, vastloop-detectie overslaan.
4. Anders lopen zoals voorheen (inclusief vastloop-uitwijken).

`beschadigToren()` / `vernietigToren()` zijn de enige manier om een bouwwerk
schade te doen of te laten sneuvelen: brokstukken, melding, menu dicht, plek
vrij.

### 14.6 Bouwfase (D15)

`inBouwfase()` is waar zodra een wave compleet is (bonus gegeven, niets meer
te spawnen, geen robots). De volgende wave start na `BOUWFASE_DUUR` (20 s) of
met G via `startVolgendeWaveNu()` (bonus €2 per overgeslagen seconde). De
aftelling in `waveUI` ververst alleen per hele seconde
(`spel.bouwfaseAftelling`).

### 14.7 Economie (D16)

Alle geldconstanten staan bij elkaar en zijn gemeten met
`meet-dnm-economie.mjs`:
- `MUNT_BASIS_MIN/MAX` (€2–10);
- `WAVE_BONUS_*` (25 + 10·wave);
- `PERFECT_BONUS_*` (50 + 10·wave, ongewijzigd);
- `VROEGE_START_BONUS_PER_SECONDE`;
- `TOREN_TYPES`-prijzen, `TOREN_VERKOOP_FRACTIE` en
  `TOREN_REPARATIE_PER_HP`.

Wie iets bijstelt, draait het meetscript opnieuw. De meetresultaten staan in
`ROADMAP_monument.md` (D16).

### 14.8 Themagolven en mist (D30)

`themaSleutelVoorWave(n)` en `themaVoorWave(n)` zijn pure functies: een thema
op wave 6, 10, 14, … in vaste roulatie. `startWave()` zet `spel.thema` en
schaalt `waveDoel`; `aantalPoortenVoorWave()` laat een thema het aantal poorten
bepalen (ook bij de aankondiging vooraf); `robotTypeVoorLopendeWave()` laat een
thema het robottype bepalen, zonder `kiesRobotTypeVoorWave()` aan te passen.
`pasMistToe(thema)` zet de mist elke wave opnieuw uit het thema of uit
`MIST_BASIS`, vastgelegd ná het bouwen van de wereld (§10, punt 18).

---

## 15. Doelarchitectuur fase M — nog niet gebouwd

**Dit beschrijft de game ná fase M (D32–D43), niet de game van vandaag.**
Zolang een ticket niet af is, gelden §1–§14. Het volledige ontwerp met de
motivering staat in `SONNET_EXECUTION_PLAN_monument.md` §11.7; de
plattegrond met alle maten in `PLATTEGROND.html`. Hieronder staan de
contracten die elk ticket van fase M moet respecteren. Werk deze sectie per
ticket bij en verplaats wat gebouwd is naar de gewone secties.

### 15.1 Eén bron: `DAM_LAYOUT`

- `DAM_LAYOUT` is puur JSON en gelijk aan het `dam-layout`-blok in
  `PLATTEGROND.html`. `test-dnm-layout` vergelijkt de twee.
- Alles wat een plek heeft, leest daaruit:
  - `GRENS` en `MONUMENT_BOX`;
  - routes, poorten, bouwplekken en hekken;
  - commandopost, kerkklok en spelerstart;
  - gebouwvoetafdrukken, botsingen en de schotschil.
- Afgeleide structuren (`ROUTES`, `BOUWPLEKKEN`) maakt
  `bereidLayoutVoor()` één keer, bij het laden. Daarna wordt niets meer
  gesimuleerd of afgeleid uit waar robots toevallig lopen.

### 15.2 Coördinaten

- Meters, 1:1, zonder `wereld.scale`. +x oost, +z zuid, oorsprong in het
  midden van het monument.
- `ARENA_SCHAAL` en alle hoogteschalen vervallen, en daarmee valkuil §4.2.
- `vloerHoogte(x, z)` geeft het reliëf: platformtreden en stoepen.

### 15.3 Contracten

1. **Rijbanen zijn heilig.** Geen obstakel, decor of gebouwdeel op een
   rijbaan, de trambaan of een routestrook.
2. **Robots volgen routes op `s`.** Een robot heeft `route`, `s`,
   `laanFractie` en `modus`.
   - Een hek werkt op route-`s`, zonder lijntest.
   - Alleen de bomber verlaat zijn route (voor een bouwwerk) en keert
     terug via projectie.
   - `afstandTotMonument < 0,6` blijft de enige monumenttreffer.
3. **Vastlopen is een meting, geen mechaniek.** `spel.vastloopTeller` moet
   in een volle wave 0 blijven.
4. **Gebouwen zijn rechthoeken.** Botsing gaat via `registreerRechthoek`
   per `gebouw.delen`, nooit via een `Box3` die met decor meegroeit.
5. **Tekenen via de `bouwset`.** Uniek statisch detail wordt per materiaal
   samengevoegd (`mergeGeometries`); herhaald detail wordt `InstancedMesh`.
   Budget: ≤ 400 draw calls op Hoog, ≤ 200 op Laag. De nulmeting staat in
   plan §11.7.10.
6. **Schoten raken de schotschil**: onzichtbare boxen per gebouwdeel plus
   het monument, niet de detailmeshes (`raycast = geenRaycast`).
7. **Eén menu.** `menuUI` met `openMenu` en `sluitMenu`. Het sluit bij T,
   bij weglopen en bij pauze. De commandopost bedient wapen-upgrades en
   monumentreparatie; torens beheer je op hun plek.
8. **Texturen zijn deterministisch**: een canvas met een PRNG met vaste
   seed per patroonnaam, en UV op wereldschaal.

### 15.4 Wat verdwijnt

- `looproute()`, `tussenpunt` en `ontwijkOffset` als hoofdmechaniek.
- `bewegendeTrams`.
- De Bijenkorf-kiosk en de Koninklijke Reparatiepost als interactiepunt.
- `shopUI` en `bouwUI`.
- `MONUMENT_ROND_Y`.

De volledige overgangstabel staat in plan §11.7.8, de testmigratie in
§11.7.9.

### 15.5 Stand na D32 — wat al gebouwd is

- **`DAM_LAYOUT`** staat bovenaan STAP 2 en is gelijk aan de plattegrond
  (`test-dnm-layout`). Er is geen `wereld.scale` en geen `ARENA_SCHAAL`
  meer.
  - `MONUMENT_POSITIE` is (0, 0, 0).
  - `MONUMENT_BOX` is ±`speldoos` uit de layout, dezelfde bron als het
    obstakel. Valkuil §4.3 is weg.
- **Afgeleid bij het laden:**
  - `ROUTES` (`segmenten` met `ax`, `az`, `rx`, `rz`, `lengte`, `s0`,
    `breedte`);
  - `puntOp(route, s)` en `projecteerOpRoute(route, x, z)`;
  - `vloerHoogte(x, z)`: 3 × 0,16 m treden, stoepen 0,12 m. De speler-
    camera en de robots staan erop.
- **Vloer.** Lagen op vaste hoogte (`VLOER_Y`: plein 0, straat 0,006,
  strook 0,012, rail 0,03).
  - Texturen: `TEXTUUR_TEKENAARS` met `tekstZaad` en mulberry32, UV op
    wereldschaal (`herschaalUVNaarWereldschaal`). De tegelmaat per
    patroon staat in `TEXTUUR_TEGEL`.
- **Gebouwen.** `bouwGreyboxGebouw` maakt per deel een blok met kroonlijst,
  plus een tijdelijk herkenningspunt uit `GREYBOX_BEKRONING`. Dat staat
  bewust niet in de layout.
  - Groepen staan in `gebouwGroepen` (naam → Group).
  - Botsing: `registreerRechthoek` per deel, met marge 0,3.
- **Poorten en robots.** `SPAWN_POORTEN` wordt afgeleid uit `ROUTES`:
  - `positie` is het eerste routepunt;
  - de spreiding ligt dwars op de eerste strook;
  - `routePunten` bevat de overige punten.

  `routePunten` wordt sinds D33 alleen nog door meetscripts gebruikt.
- **Bouwplekken** komen uit `DAM_LAYOUT.bouwplekken`:
  - index 0 = ver, 1 = nabij;
  - `s`, `route`, `zijOffset` en `hekBreedte` worden afgeleid;
  - een hek spant `hekBreedte`, gecentreerd op de route;
  - de tegel is 1,8 m.
- **Weg:** rijdende trams (`bewegendeTrams`), de oude bouwers,
  `registreerObstakel` en de paaltjesring rond het monument. Duiven en
  wolken bleven.

### 15.6 Stand na D33 — routevolgen

- **Robotvelden:** `route` (uit `ROUTES`, of null), `s`, `laanFractie`
  (−1..1) en `modus`:
  - `route`: de route aflopen;
  - `bouwwerk`: een bomber op weg naar een toren of hek;
  - `terug`: na een verdwenen bouwwerk terug naar de route;
  - `vrij`: een robot zonder poort; recht naar het monument, met
    botsingen, zoals vóór fase M.
- **Hulpfuncties:**
  - `robotBaan(robot, s)`: `laanFractie × (breedte/2 − 0,8)`;
  - `robotRoutePunt(robot, s)`: middellijn plus baan, + = links van de
    looprichting;
  - `robotMoetWachten(robot)`: vergelijkt de banen op de s van de
    voorganger; bij gelijke s gaat de eerder gespawnde voor;
  - `hekVoorRobot(robot)`: in modus `route` op s, anders de lijntest
    `hekInContact`.
- **Contracten:**
  1. In modus `route` geen `losBotsingenOp`. De strook is vrij
     (`test-dnm-layout`); een botsing zou de robot van zijn route duwen.
  2. `s` loopt nooit terug en groeit alleen als de robot binnen
     `ROBOT_ACHTERSTAND` (2 m) van `robotRoutePunt(s)` is. Haal `s` niet
     uit een projectie (bochtprobleem, zie de roadmap).
  3. Aan het eind (`s ≥ lengte`) is het stuurdoel `MONUMENT_POSITIE`. De
     treffer blijft `afstandTotMonument < 0,6`.
  4. Een hek werkt alleen op robots van zijn eigen route (`plek.poort`) of
     op robots buiten hun route. Een hek dat een andere route kruist, houdt
     die robots dus niet tegen; de plattegrond legt geen hek over een
     andere route.
- **Constanten:**

  | Naam | Waarde |
  |---|---:|
  | `ROBOT_VOORUITKIJK` | 1,5 |
  | `ROBOT_BAAN_MARGE` | 0,8 |
  | `ROBOT_ONDERLING` | 1,2 |
  | `ROBOT_BAAN_BOTSING` | 0,9 |
  | `ROBOT_TERUG_BEREIKT` | 0,5 |
  | `ROBOT_ACHTERSTAND` | 2,0 |

### 15.7 Stand na D34 — routes zichtbaar

- **`routeSporen`** (poortnaam → Mesh): één band per route, direct in de
  scene.
  - Eigenschappen: `userData.puurEffect`, `raycast` uitgezet, `toneMapped:
    false`, `polygonOffset` tegen de vloer.
  - Eén gedeelde `spoorTextuur`; `animeerPoortBakens` schuift de offset met
    `klok`. v groeit met s (één pijlpunt per `SPOOR_PIJL_METERS`).
- **`updatePoortBakens()` is de enige plek die zichtbaarheid zet**, voor
  bakens én sporen:
  - bouwfase (`volgendePoorten` niet leeg): de aangekondigde, fel;
  - anders: de actieve, gedimd.

  Wie de poortkeuze verandert, roept hem aan; niets anders hoeft te weten
  dat er sporen zijn.
- **`straatIngang(route)`:** het eerste routepunt dat niet op asfalt,
  voetgangersstraat of steeg ligt (de trambaan telt als plein). Bakens
  staan daar (`baken.userData.ingang`), straatnaamborden rechts ernaast
  (`straatNaamborden`).
- **De minimap** leest `DAM_LAYOUT.vlakken` (behalve stoepen) en
  `routeSporen`. Hij tekent op `GRENS`, dus bij een andere verhouding
  vervormt hij.

### 15.8 Stand na D35 — commandopost en één menu

- **Menu-contract.** `menu` is `null` of een object met:
  - `bron`: `'commandopost'` of de bouwplek;
  - `titel()`;
  - `opties()`: elke optie heeft `{ tekst, prijs, klaar, sluit, actie }`;
  - `hoortBij(interactiepunt)`.

  Verder:
  - `renderMenu()` tekent het paneel opnieuw; `updateGeldUI` en
    `updateArcadeUI` roepen hem aan.
  - `kiesMenuOptie(i)` voert een optie uit en sluit bij `sluit`.
  - Cijfertoetsen 1–4 werken alleen binnen pointer lock, met `!e.repeat`.
  - `updateInteracties` sluit het menu zodra het huidige interactiepunt er
    niet bij hoort; `pointerlockchange` (pauze) en `resetRun` sluiten het
    ook.
- **`COMMANDOPOST_MENU`** is een vast object. Vergelijk met
  `menu === COMMANDOPOST_MENU`, niet met de titel.
- **Bouwplekmenu:** `bouwMenu(plek)` maakt per opening een nieuw object;
  vergelijk met `menu?.bron === plek`. Bouwen en verkopen sluiten het menu,
  upgraden en repareren laten het open.
- **HUD-indeling** (bewaakt door `test-dnm-commandopost`):

  | Plek | Elementen |
  |---|---|
  | Bovenste rij | geld, doel, score |
  | Links | wave (tot 38vw breed) |
  | Rechts | special, menu-link |
  | Midden | combo, kerkklokbanner |
  | Linksonder | menu |
  | Onderaan | prompt en hulp, elk één regel |
  | Rechtsonder | minimap |

  Een nieuw vast HUD-element hoort in die meting.

### 15.9 Na M2

- **Richtingspijlen verwijderd.** Weg zijn `updateRichtingspijlen`,
  `robotPijlenPool`, `#robotPijlenUI` en `.robotpijl`. De minimap is het
  enige overzichtsmiddel naast spoor en bakens. D27 is geschrapt.
- **Gevelnamen.** `GEVELNAMEN` (in STAP 2, na de gebouwbouw) hangt per naam
  een `maakGevelTekst`-bord zonder achtergrond aan de gebouwgroep
  (`userData.onderdeel = 'gevelnaam'`, niet raakbaar). D37–D39 nemen ze over.
- **Kerkklok:** op `DAM_LAYOUT.kerkklok` (voor het Paleis), op schaal 1,7.
  De botsing is ±1,7 m (+0,3 marge); de markering staat 3,2 m ernaast.
- **Hoogtes** zijn ~25% lager dan in het echt (plan §11.3 punt 2). Ze
  staan alleen in `DAM_LAYOUT.gebouwen`, dus een wijziging gaat via de
  plattegrond.

### 15.10 Bouwplekken na D46

- **Layout.** `DAM_LAYOUT.bouwplekken` heeft per plek:
  - `naam`;
  - `soort`: `knooppunt` of `voorpost`;
  - `routes`: een lijst routenamen;
  - `positie`.

  `torenBereik` (10) is alleen voor de plattegrondtoetsen.
- **Plek in de game:**
  `{ naam, soort, routes, positie, hoek, toren, kaderMateriaal, groep, hekLijnen }`.
  - `hekLijnen[i]` = `{ poort, s, x, z, rx, rz, breedte }`: het routepunt
    naast de plek, per route.
  - Weg zijn `poort`, `index`, `route`, `s`, `zijOffset` en `hekBreedte`.
  - Tekst in meldingen en menu's gebruikt `plek.naam`.
- **Hek.** `toren.lijnen[i]` = `{ poort, s, ax, az, bx, bz, mx, mz }`,
  één per route van de plek.
  - `hekOpRoute(robot)` geeft `{ hek, lijn }`, voor het eerstvolgende hek
    op de eigen route. `sGrens` = `lijn.s − 0,3`.
  - `afstandTotHek` en `bouwwerkPunt` gebruiken de dichtstbijzijnde lijn
    (`dichtsteHekLijn`).
- **D50:** een voorpost heeft `overkantVan` (de naam van zijn knooppunt)
  en hoeft niet elke route van dat knooppunt te dekken.
- **D51:** `DRUKPERSPLEKKEN` is een aparte lijst, met dezelfde vorm als
  een bouwplek (`soort: 'drukpers'`, geen routes, geen hekLijnen). Hij
  zit bewust niet in `BOUWPLEKKEN`, want code en tests nemen daar routes
  aan.
  - `TOREN_TYPES.drukpers.alleenOp = 'drukpers'`: `bouwToren` weigert een
    type op de verkeerde soort plek.
  - Het inkomen loopt via `updateDrukpersen` (in `updateTorens`), op één
    gedeelde tik.
- **Valkuil:** een knooppunt hoort bij twee routes. Code die "de plek van
  route X" zoekt, gebruikt `plekVoor(X, soort)`. Twee actieve poorten
  kunnen dus dezelfde plek aanwijzen; `meet-dnm-economie` slaat een al
  bebouwde plek over.
- **Slots (D47).**
  - Een plek heeft `toren` én `hek`. Elk bouwwerk kent zijn slot
    (`toren.slot`, via `slotVan(type)`).
  - `verwijderToren` zet alleen `plek[toren.slot]` op null en tekent een
    open menu opnieuw.
  - Code die "staat er iets op deze plek" vraagt, moet kiezen welk slot ze
    bedoelt: `plek.toren` betekent alleen het torenslot.
  - Nieuwe torentypes (D48, D49) vallen vanzelf in het torenslot: alles
    behalve `hek`.
- **Torentypes toevoegen (D48).** Een type heeft:
  - een `niveaus`-tabel;
  - `niveauTekst(n)`, voor de upgraderegel in het menu;
  - een bouwer in de tabel in `bouwToren`;
  - een tak in `updateTorens`.

  Een zichtbaar effect is één herbruikbare `toren.spoor`-lijn, die
  `verwijderToren` opruimt. De Bovenleiding tekent zijn boog met
  `setDrawRange`.

### 15.11 Texturen (D36)

- **Eén bibliotheek voor vloer en gevel:** `TEXTUUR_TEKENAARS`, met
  `TEXTUUR_TEGEL` (meters per tegel) en `vloerTextuur(patroon)` (canvas,
  cache, seed uit de patroonnaam). De naam `vloerTextuur` is historisch.
- **Steenpatronen** rekenen hun maat uit `TEXTUUR_STEEN` via
  `steenPixels`. Wie een tegelmaat verandert, houdt een geheel aantal
  stenen per tegel, anders sluit hij niet.
- **Gevels:** geometrie eerst naar wereldpositie verschuiven, dan
  `textuurOpWereldschaal(geo, patroon)`, dan `gevelMateriaal(patroon,
  kleur)`. Zo lopen voegen door van gevel naar gevel.
- **Valkuil:** `gevelMateriaal` deelt materialen. Wie er één aanpast (bijv.
  `opacity`), past ze allemaal aan; maak dan een `clone()`.

### 15.12 Echte gebouwen (D37 en verder)

- **`GEBOUW_BOUWERS[naam]`** vervangt per gebouw `bouwGreyboxGebouw`. Een
  bouwer levert een groep met `userData.gebouw` en registreert zijn eigen
  botsing: de voetafdruk + 0,3 m, zodat `test-dnm-layout` hem vindt.
- **Samenvoegen.** `maakBouwer()`:
  - `voeg(naam, materiaal, geo, patroon)` neemt geometrie die al op haar
    wereldplek staat;
  - `bouw(groep)` maakt één mesh per naam.

  De meshnaam is ook `userData.onderdeel`, en tests raken hem met stralen.
- **Gevelstelsel.** u loopt langs de gevel, y omhoog, d naar buiten.
  `uNaarX` en `rotY` per gevel zorgen dat een vorm in het XY-vlak (Shape,
  Extrude) met de juiste kant naar buiten staat, zonder gespiegelde
  driehoeken.
- **Hoogte.** De hoogste mesh moet `hoogsteDeel` uit `DAM_LAYOUT` raken
  (±1,5 m, `test-dnm-layout`); het Paleis zet zijn windvaan er exact op.
- **Valkuil:** alles wat op loophoogte uitsteekt, mag niet verder komen
  dan botsing + spelerstraal (0,4 m). Anders loopt de camera door steen.
- **D38, algemene gevelstelsels.**
  - `gevelStelsel(richting, vlak)` werkt voor elke as-uitgelijnde muur
    (zuid, noord, oost, west).
  - `apsisStelsel(cx, cz, apothema, hoek)` werkt voor een schuin vlak; de
    hoek volgt CylinderGeometry: x = sin θ, z = cos θ.
  - Een Shape of Extrude in het XY-vlak staat daarmee altijd met de
    voorkant naar buiten.
  - Glas in een Shape gebruikt de vormcoördinaten (meters) als UV; daarom
    is de tegel van `glasInLood` precies 1 m.
- **D40, vertexkleuren.**
  - `bouwer.voeg(naam, materiaal, geo, patroon, kleur)` geeft een geometrie
    een kleurattribuut. `voegGeometrieenSamen` voegt het samen, en
    onderdelen zonder kleur worden wit.
  - Het materiaal moet `vertexColors: true` hebben; zie
    `straatwandMaterialen()`, met een kloon van het gedeelde
    baksteenmateriaal.
  - Zo krijgt elk pand een eigen tint zonder eigen mesh.
- **Straatwanden:** `STRAATWANDEN[naam]` = lijst van
  `[richting, vlak, a, e, opties]`. `bouwGevelrij` verdeelt elk stuk in
  panden; `groep.userData.panden` bewaart de uitkomst voor tests.
- **Testpatroon voor uitsteken:** schiet op loophoogte stralen op de gevel
  en eis dat elk raakpunt binnen een obstakel + spelerstraal ligt
  (`test-dnm-kerk`). Dat werkt voor schuine vlakken en torentjes, niet
  alleen voor rechte gevels.
