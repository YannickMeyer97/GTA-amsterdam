# ARCHITECTURE_NOTES_monument.md — Defend National Monument

Invarianten, contracten en valkuilen van `defend-national-monument.html`.
Tegenhanger van `docs/amsterdam-undead/ARCHITECTURE_NOTES_undead.md`; de twee
games delen géén code, dus de twee documenten delen geen inhoud.

**Status:** dit document beschrijft de game zoals die er vandaag uit ziet, vóór
ticket D1. Alles hieronder is uit de code gelezen en narekenbaar —
regelnummers verwijzen naar `defend-national-monument.html` (3.518 regels,
132 KB). Zodra fase 1 (de herschaling) landt wijzigen de meetwaarden in §3
(wereld) en §6 (robots) en moet dit document mee.

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

**Er is geen eindscherm-element.** Game over wordt getoond door de tekst van
`objectiveUI` te vervangen (regel 2476). Dat is precies wat D7 verandert.

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
| Schaduwcamera | ±110 in x en y, near 10, far 300 |
| Vulling | `HemisphereLight(0xbfe3ff, 0x9b8f7a, 1.15)` |

**Alles staat hard aan.** Geen kwaliteitsniveaus, geen `pixelRatio`-plafond
dat je kunt verlagen, geen schakelaar voor schaduwen. Dat is het hele
onderwerp van D21.

> **Bij de herschaling (D4):** de schaduwcamera is ±110 groot, afgestemd op de
> huidige arena. Wordt de arena 1/3, dan dekt die frustum straks de hele kaart
> ruim — dat is gratis schaduwkwaliteit die je moet meenemen: `left/right/
> top/bottom` mee schalen geeft een veel scherpere schaduw bij dezelfde
> 2048² map. Doe dat bewust, niet per ongeluk.

De resize-handler (regel 434) werkt `camera.aspect` en `renderer.setSize` bij,
maar **niet** `setPixelRatio`. Bij het slepen tussen schermen met een andere
DPR blijft de oude ratio staan.

---

## 3. De wereld

### 3.1 Maten en vaste punten

| Wat | Waarde | Regel |
| --- | --- | --- |
| `GRENS` | x ∈ [−118, 165], z ∈ [−118, 106] | 465 |
| Arena-afmeting | 283 m breed × 224 m diep | afgeleid |
| Grondvlak | 620 × 620 | STAP 2 |
| `MONUMENT_POSITIE` | (42, 0, −4) | 2415 |
| `MONUMENT_BOX` | x ∈ [31,3, 52,7], z ∈ [−14,7, 6,7] | 2418 |
| `MONUMENT_MAX_HP` | 100 | 2651 |
| Speler-startplek | (16, 0, 30) | 2213 |

Assenstelsel: **x = west-oost, z = noord-zuid, noord is negatieve z**, en één
game-unit is ongeveer één meter (comment op regel 450).

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

- **Rijdende tram** (`maakRijdendeTram` 2049, `updateBewegendeTrams` 2080):
  één tram, snelheid 5,5 m/s, pendelt tussen z = −112 en z = 106, belt elke
  5 s. Heeft een meebewegend obstakel.
- **Duiven** (`maakDuif` 2138, `plaatsDuif` 2155, `updateDuiven` 2168):
  18 stuks, geplaatst bij het opstarten (regel 3457).

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

### 4.2 De twee registratiefuncties — de belangrijkste valkuil van D4

- `registreerObstakel(object, marge)` (regel 546) doet
  `updateWorldMatrix(true, true)` + `Box3.setFromObject`. De doos **volgt de
  wereldmatrix**, dus een schaal op een ouder-Group werkt automatisch door.
- `registreerRechthoek(minX, maxX, minZ, maxZ, marge)` (regel 557) neemt kale
  getallen aan en doet dat **niet**.

**Negen aanroepen van elk.** De negen `registreerRechthoek`-aanroepen:

| Regel | Wat |
|---:|---|
| 1134 | Koninklijk Paleis |
| 1168 | Reparatiepost-markering |
| 1248 | Nieuwe Kerk |
| 1278 | Kerkklok |
| 1365 | **Nationaal Monument** |
| 1680 | Lantaarnpaal |
| 1734 | Terras |
| 1847 | Upgradekiosk |
| 1865 | Boom |

> **D4-regel:** elke `registreerRechthoek`-aanroep moet handmatig door de
> schaalfactor, de `registreerObstakel`-aanroepen niet. Door elkaar halen
> levert onzichtbare muren of doorloopbare gebouwen op — en dat merk je pas
> als je er tegenaan loopt, want er is geen enkele test.

### 4.3 `MONUMENT_BOX` is een handmatige kopie

Regel 1365 registreert `(42 ± 10,5, −4 ± 10,5)` met marge 0,2 → effectief
±10,7. Regel 2418 herhaalt dat met de hand als `MONUMENT_BOX`. **Twee plekken,
één waarheid.** Wijzigt de één, dan moet de ander mee, en er is niets dat dat
bewaakt.

---

## 5. De speler (regel 2212)

| Veld | Waarde |
|---|---|
| `positie` | (16, 0, 30) |
| `yaw` / `pitch` | 2,35 / 0, pitch geklemd op ±1,45 |
| `hoogte` | 1,7 m |
| `straal` | 0,4 m |
| `snelheid` | 7 m/s, **+0,65 per snelheid-upgrade** (regel 2634) |

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

| Key | Spelernaam | hpMax | snelheid× | beloning× | schade | schaal |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `normal` | Grunt | 1 | 1,0 | 1,0 | 8 | 1,0 |
| `sprinter` | Runner | 1 | 1,6 | 0,6 | 8 | 0,85 |
| `tank` | Tank | 3 | 0,55 | 2,5 | 8 | 1,4 |
| `bomber` | Bomber | 1 | 1,15 | 1,0 | **25** | 1,05 |
| `shieldbot` | Shield Bot | 1 | 0,85 | 1,8 | 10 | 1,0 |

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
wordt nooit gebruikt.** `spawnRobot` overschrijft hem onmiddellijk (regel 3020):

```js
const basisSnelheid = Math.min(1.35 + Math.random() * 0.7 + spel.wave * 0.07, 3.2) * 1.1;
robot.snelheid = basisSnelheid * config.snelheidMultiplier;
```

De **echte** basissnelheid loopt dus op met de wave en is geplafonneerd:

| Wave | Basissnelheid (m/s) |
|---:|---|
| 1 | 1,56 – 2,33 |
| 5 | 1,87 – 2,64 |
| 10 | 2,26 – 3,03 |
| ≥ 26 | 3,52 (plafond, `3.2 × 1.1`) |

Het plafond wordt bij `Math.random() = 1` al rond wave 17 geraakt en bij
`Math.random() = 0` pas rond wave 27.

> Dit is een **onbedoelde wave-moeilijkheidsknop** die nergens gedocumenteerd
> staat en niet in de HUD zichtbaar is. Bij D16 (economie herijken) en D6
> (meten) moet je hem kennen, anders schrijf je effecten toe aan de verkeerde
> oorzaak.

### 6.3 Spawnen

`SPAWN_POORTEN` (regel 2429), vijf stuks. `kiesSpawnPoort()` (2580) loot
**volledig uniform** — geen weging, geen geheugen, geen spreiding over de
kaart. `spawnPlekVoorPoort` (2584) probeert 30× een vrije plek binnen de
spreiding van de poort en valt anders terug op de poortpositie zelf.

Afstand tot het monument is hieronder tweemaal gegeven, omdat het verschil
ertoe doet: **de game rekent met de doos**, niet met het middelpunt.
`afstandTotMonument()` (regel 2419) klemt de positie op `MONUMENT_BOX`.

| Poort | Positie | Spreiding | → doos | → middelpunt |
| --- | --- | --- | ---: | ---: |
| Damstraat | (123, 0, 4) | 2 × 8 | 70,3 m | 81,4 m |
| Rokin | (2, 0, 96) | 8 × 3 | 94,0 m | 107,7 m |
| Damrak | (0, 0, −106) | 8 × 3 | 96,5 m | 110,3 m |
| Kalverstraat | (−55, 0, 92) | 6 × 4 | 121,3 m | 136,5 m |
| Nieuwendijk | (−52, 0, −106) | 6 × 4 | 123,6 m | 138,7 m |

**Reistijden**, met de échte snelheden uit §6.2:

| Poort | `normal`, wave 1 | `tank`, wave 1 | `normal`, plafond |
| --- | --- | --- | --- |
| Damstraat | 30 – 45 s | 55 – 82 s | 20 s |
| Nieuwendijk | 53 – 79 s | 96 – **144 s** | 35 s |

Een tank uit Nieuwendijk in wave 1 is dus bijna twee en een halve minuut
onderweg voordat hij iets doet. Dat is de kern van de schaaldiagnose in
`SONNET_EXECUTION_PLAN_monument.md` §2.1.

**Kalverstraat heeft een `tussenpunt`** (−45, 0, 45). Geen navigatiesysteem
maar één hardgecodeerde pleister: zonder dat punt liepen Kalverstraat-robots
rakelings langs het Madame Tussauds-blok en kwamen ze in dezelfde oostelijke
corridor uit als de Rokin-robots, waardoor het leek alsof ze van poort
wisselden (comment op regel 2424).

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

### 7.7 Interactiepunten (regel 2802)

| Naam | Type | Positie | Radius | → monumentrand |
|---|---|---|---:|---:|
| Kerkklok Boost | `kerkklok` | (−67, 0, −38) | 4 | ~101 m |
| Koninklijke Reparatie | `reparatie` | (−70, 0, 5) | 4 | ~101 m |
| Bijenkorf Upgrades | `upgradeShop` | (60, 0, −17) | 4 | ~8 m |

`updateInteracties` (2835) kiest het dichtstbijzijnde punt binnen zijn radius.
De check is **puur euclidisch, zonder zichtlijn of muurcontrole**. Dat is hier
onschadelijk omdat 4 m klein is ten opzichte van de gebouwen.

> **Bij de herschaling:** 4 m is een absolute waarde in een wereld die 1/3 zo
> klein wordt — ongewijzigd laten betekent relatief 3× zo groot. In Amsterdam
> Undead heeft exact deze constructie een bug opgeleverd toen de radius naar
> ~16 m groeide: je kon door muren en ongekochte deuren heen interacteren. Mee
> schalen, of een zichtlijncontrole erbij.

De Bijenkorf-winkel sluit zichzelf zodra hij niet meer het dichtstbijzijnde
punt is (regel 2859), zodat de 1/2/3-hotkeys niet actief blijven als je
wegloopt.

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

Het schot (`schiet`, 3232) is een hitscan-raycast vanuit het schermmidden,
`raycaster.far = 150`, tegen `robots.map(r => r.groep).concat([wereld])`. Bij
een treffer loopt de code omhoog door `parent` tot hij `userData.robot` vindt.

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
const spelActief = document.pointerLockElement === renderer.domElement;
if (spelActief) { … acht update-functies … } else { verbergInteractiePrompt(); }
```

Let op de volgorde: **`updateSpeler` draait ook tijdens de pauze.** Dat is
nodig omdat `losBotsingenOp` en de camerapositie anders bevriezen op een
tussenstand, maar het betekent wel dat de speler-collision tijdens de pauze
blijft draaien.

> **`spelActief` checkt `spel.gameOver` NIET.** Na game over blijft de loop
> gewoon draaien: je kunt schieten, munten oprapen en rondlopen.
> `updateWaveSysteem` en `updateRobots` stoppen zelf (beide `if (spel.gameOver)
> return`), maar de rest niet. D7 en D9 moeten dit expliciet afmaken.

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
7. **`spelActief` checkt `gameOver` niet.** Zie §9.3.
8. **`speler.snelheid` wordt permanent opgehoogd** door de upgrade en nergens
   gereset. Zie §7.4.
9. **De gameplay-RNG heeft geen seed.** Alleen het decor is deterministisch.
   Zie §3.6.
10. **De resize-handler zet `setPixelRatio` niet opnieuw.** Zie §2.
11. **Er is geen enkele test.** Zie §13.

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

**`window.DamChaosDebug` bestaat al** en is breed. Hij hoeft niet gemaakt te
worden, alleen uitgebreid. De naam blijft — hernoemen breekt niets
functioneels maar levert alleen ruis op.

Nu geëxporteerd:

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

Wat D1 moet toevoegen:

```
GRENS · MONUMENT_POSITIE · MONUMENT_BOX · MONUMENT_MAX_HP · SPAWN_POORTEN
afstandTotMonument · upgradeKosten · losBotsingenOp · updateRobots
koopUpgrade · koopMonumentReparatie · legMuntNeer · updateInteracties
activeerHuidigeInteractie · activeerBijenkorfUpgradeShop
updateMunten · updateSpeler · probeerTeSchieten
klok (getter) · huidigeInteractie (getter)
```

Patroon voor `let`-variabelen: een getter, niet de waarde zelf — anders
bevriest de export de waarde op moduleniveau. `geldStand`/`geldZet` zijn het
bestaande voorbeeld.

---

## 13. Testdekking

**Nul.** De 117 testscripts in `tests/` gaan allemaal over
`amsterdam-undead.html`. Voor deze game bestaat er geen enkele test, geen
helper en geen meetscript.

Dat is de reden dat `SONNET_EXECUTION_PLAN_monument.md` bij D1 begint en niet
bij de herschaling: een arena 1:3 verkleinen zonder testvangnet is een
wijziging waarvan je de schade pas ziet als je er zelf tegenaan loopt.

Nieuwe tests krijgen het voorvoegsel **`test-dnm-`**, zodat `run-all.mjs` ze
vanzelf oppikt zonder dat de undead-suite verandert.
