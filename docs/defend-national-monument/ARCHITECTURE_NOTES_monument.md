# ARCHITECTURE_NOTES_monument.md — Defend National Monument

Invarianten, contracten en valkuilen van `defend-national-monument.html`.
Tegenhanger van `docs/amsterdam-undead/ARCHITECTURE_NOTES_undead.md`; de twee
games delen géén code, dus de twee documenten delen geen inhoud.

**Status:** dit document begint bij de bestaande game zoals die er vandaag uit
ziet, vóór ticket D1. Alles hieronder is uit de code gelezen en narekenbaar —
regelnummers verwijzen naar `defend-national-monument.html` (3.518 regels).
Zodra fase 1 (de herschaling) landt, wijzigen de meetwaarden in §2 en §3 en
moet dit document mee.

---

## 1. Wat dit bestand is

Eén zelfstandig HTML-bestand, 3.518 regels, 135 KB. Three.js via de importmap-
CDN, verder geen afhankelijkheden, geen buildstap, geen externe assets. First
person; je verdedigt het Nationaal Monument op de Dam tegen golven robots die
uit vijf straten komen aanlopen.

Zelfde harde kaders als Amsterdam Undead (zie CLAUDE.md): geen frameworks,
geen textures of modellen van buiten, alleen simpele geometrieën en
procedurele audio.

---

## 2. De wereld — maten en vaste punten

| Wat | Waarde | Regel |
| --- | --- | --- |
| `GRENS` | x ∈ [−118, 165], z ∈ [−118, 106] | 465 |
| Arena-afmeting | 283 m breed × 224 m diep | afgeleid |
| `MONUMENT_POSITIE` | (42, 0, −4) | 2415 |
| `MONUMENT_BOX` | x ∈ [31,3, 52,7], z ∈ [−14,7, 6,7] (±10,7) | 2418 |
| `MONUMENT_MAX_HP` | 100 | 2651 |
| Speler-startplek | (16, 0, 30) | 2213 |
| Speler-loopsnelheid | 7 m/s | 2218 |
| Speler-ooghoogte / botsstraal | 1,7 m / 0,4 m | 2216-2217 |

### 2.1 De vijf spawnpoorten (regel 2429)

Afstand tot het monument is hier tweemaal gegeven, omdat het verschil ertoe
doet: **de game zelf rekent met de doos**, niet met het middelpunt.
`afstandTotMonument()` (regel 2419) klemt de positie op `MONUMENT_BOX` en meet
daarnaartoe. Wie het middelpunt gebruikt, meet er structureel ~10 m naast.

| Poort | Positie | → doos | → middelpunt |
| --- | --- | ---: | ---: |
| Damstraat | (123, 0, 4) | 70,3 m | 81,4 m |
| Rokin | (2, 0, 96) | 94,0 m | 107,7 m |
| Damrak | (0, 0, −106) | 96,5 m | 110,3 m |
| Kalverstraat | (−55, 0, 92) | 121,3 m | 136,5 m |
| Nieuwendijk | (−52, 0, −106) | 123,6 m | 138,7 m |

**Looptijden.** Speler op 7 m/s doet er 10,0 s (Damstraat) tot 17,7 s
(Nieuwendijk) over; de arena in de breedte oversteken kost 40 s. Robots lopen
op `1,4 + Math.random()` m/s (regel 2993), dus 1,4–2,4 m/s met gemiddelde 1,9,
maal `snelheidMultiplier` van hun type. Een `normal` robot is daarmee 37 s
(Damstraat) tot 65 s (Nieuwendijk) onderweg; een `tank` (0,55×) tot ~118 s.

Dat spreidingsgetal is de kern van de schaalanalyse in
`SONNET_EXECUTION_PLAN_monument.md` §2.1: je kunt niet op twee poorten tegelijk
staan, en de reistijd is zo lang dat de speler de uitkomst van een poort al
niet meer beïnvloedt op het moment dat hij er aankomt.

**Kalverstraat heeft een `tussenpunt`** (−45, 0, 45). Dat is geen
navigatiesysteem maar één hardgecodeerde pleister: zonder dat punt liepen
Kalverstraat-robots rakelings langs het Madame Tussauds-blok en kwamen ze in
dezelfde oostelijke corridor uit als de Rokin-robots, waardoor het leek alsof
ze van poort wisselden. Zie de comment op regel 2424.

---

## 3. Spelsystemen

### 3.1 Waves (`startWave`, regel 2530)

```
waveDoel        = 7 + nummer * 3
maxActieveRobots = min(5 + floor(nummer * 0.65), 13)
tussenWaveTimer  > 4.5 s  → volgende wave
wave-bonus       = 40 + wave * 15
perfecte wave    = 50 + wave * 10   (geen enkele monument-hit)
```

`spel.waveGeenMonumentSchade` wordt in `startWave()` gereset, **niet** in het
wave-compleet-blok. Dat is bewust (comment op regel 2537): reset je het in het
compleet-blok, dan telt de laatste hit van de vorige wave door.

### 3.2 Robottypes (regel 2905)

| Key | Spelernaam | hpMax | snelheid× | beloning× | schade |
| --- | --- | ---: | ---: | ---: | ---: |
| `normal` | Grunt | 1 | 1,0 | 1,0 | 8 |
| `sprinter` | Runner | 1 | 1,6 | 0,6 | 8 |
| `tank` | Tank | 3 | 0,55 | 2,5 | 8 |
| `bomber` | Bomber | 1 | 1,15 | 1,0 | 25 |
| `shieldbot` | Shield Bot | 1 | 0,85 | 1,8 | 10 |

**De interne keys zijn bevroren.** `kiesRobotTypeVoorWave`, de debug-exports en
alle UI-teksten hangen eraan; alleen de weergavenaam mag wijzigen. Zie de
comment op regel 2901.

### 3.3 Upgrades (regel 2455)

Drie stuks — `vuurtempo`, `pickup`, `snelheid` — elk maximaal niveau 5.
`upgradeKosten(type) = basis + niveau * basis`, met basis 100 / 150 / 200.
Kopen gaat via de Bijenkorf-winkel.

### 3.4 Multipliers: allemaal pure functies, nooit opgeslagen

Dit is de belangrijkste invariant van de game.

`getRobotSpeedMultiplier()`, `getRewardMultiplier()`,
`getComboGeldMultiplier()` en `getComboVuurtempoMultiplier()` (regels
2669-2696) lezen live state af en geven een factor terug. **Ze schrijven
nooit naar `robot.snelheid` of een andere basiswaarde.** Daardoor kan er niets
blijven plakken na afloop van een Kerkklok Boost, ook niet bij respawns, en is
stacking onmogelijk.

> **Regel: een nieuwe tijdelijke buff volgt dit patroon of hij komt er niet in.**
> Een buff die een basiswaarde vermenigvuldigt en later "terugzet" is precies
> de bug die dit patroon voorkomt.

Combo-drempels: 3 / 6 / 10 voor geld (1,25× / 1,5× / 2,0×), 5 / 10 voor
vuurtempo (0,85× / 0,7×). `comboTier()` bestaat apart zodat de tier-popup één
keer per drempel verschijnt in plaats van bij elke kill.

### 3.5 Kerkklok Boost (regel 2655)

30 s actief, 60 s cooldown, 1,4× robotsnelheid en 2× beloning. Bereikbaar via
de T-interactie bij de Nieuwe Kerk én via de special-meter. De special slaat
de cooldown-check bewust over maar deelt verder de hele body
(`startKerkklokBoost`), zodat een gratis special nooit een gratis loop wordt —
de cooldown ná afloop loopt in beide gevallen via `updateKerkklokBoost()`.

---

## 4. Botsingen en interacties

### 4.1 `registreerObstakel` vs `registreerRechthoek` (regel 546/557)

Zelfde valkuil als in Amsterdam Undead, en hij wordt bij de herschaling
scherp:

- `registreerObstakel(object, marge)` doet `updateWorldMatrix(true, true)` en
  `Box3.setFromObject`. De doos **groeit mee met decor** en volgt automatisch
  een schaal op een ouder-Group.
- `registreerRechthoek(minX, maxX, minZ, maxZ, marge)` neemt kale getallen aan
  en doet dat **niet**.

> **Bij ticket D4:** elke `registreerRechthoek`-aanroep moet handmatig door de
> schaalfactor; de `registreerObstakel`-aanroepen niet. Ze door elkaar halen
> levert onzichtbare muren of doorloopbare gebouwen op.

`MONUMENT_BOX` is een aparte, met de hand bijgehouden kopie van de
geregistreerde monument-rechthoek (comment op regel 2416). Wijzigt de één,
dan moet de ander mee.

### 4.2 Interactiepunten (regel 2802)

Drie punten — Kerkklok Boost, Koninklijke Reparatie, Bijenkorf-winkel — elk met
`radius: 4`. Eén gedeeld "loop ernaartoe en druk op T"-systeem.

De check is **puur euclidisch, zonder zichtlijn of muurcontrole**. Dat is hier
onschadelijk omdat 4 m klein is ten opzichte van de gebouwen. In Amsterdam
Undead heeft dezelfde constructie wél een bug opgeleverd toen de radius naar
~16 m groeide: je kon door muren en ongekochte deuren heen interacteren.

> **Bij de herschaling:** 4 m is een absolute waarde in een wereld die 1/3 zo
> klein wordt. Ongewijzigd laten betekent relatief 3× zo groot — en dan komt
> de doormuur-bug hier alsnog. Mee schalen, of een zichtlijncontrole erbij.

---

## 5. Debug-hook (regel 3516)

**`window.DamChaosDebug` bestaat al** en is breed. Hij hoeft niet gemaakt te
worden, alleen uitgebreid. De naam blijft `DamChaosDebug` — hernoemen breekt
niets functioneels maar levert alleen ruis op.

Nu geëxporteerd:

```
scene, camera, speler, robots, munten, obstakels, interactiePunten,
spel, upgrades, ROBOT_TYPES, kerkklokBoost,
spawnRobot, spawnRobotVanafPoort, vernietigRobot, raakRobot, schiet,
kiesRobotTypeVoorWave, waveBannerTekst, startWave, updateWaveSysteem,
robotRaaktMonument, huidigeSchotCooldown, isVrijePlek,
koopUpgrade-ondersteuning via geldZet(n), geldStand(),
bijenkorfShopOpenStand(),
getRobotSpeedMultiplier, getRewardMultiplier,
getComboGeldMultiplier, getComboVuurtempoMultiplier,
gebruikSpecial, activeerKerkklokBoost, updateKerkklokBoost
```

Wat er voor de testsuite (D1) nog bij moet: `afstandTotMonument`,
`SPAWN_POORTEN`, `GRENS`, `MONUMENT_BOX`, `upgradeKosten`, en de schaal-
constanten zodra D4 die introduceert.

---

## 6. Valkuilen

1. **De pauze-gate.** Net als bij Amsterdam Undead bepaalt Pointer Lock of de
   game-loop simuleert. Headless tests moeten
   `Object.defineProperty(document, 'pointerLockElement', ...)` zetten, anders
   staat alles stil en slaagt elke assertie over beweging per ongeluk.
2. **`MONUMENT_BOX` is een handmatige kopie.** Zie §4.1.
3. **`afstandTotMonument` meet tot de doos, niet tot het middelpunt.** Wie in
   een test of berekening het middelpunt gebruikt zit er ~10 m naast.
4. **Robot-basissnelheid is willekeurig per robot** (1,4–2,4 m/s). Elke test
   over reistijd moet met die spreiding rekenen of de snelheid vastzetten.
5. **`ROBOT_AANTAL = 0`** (regel 2889) is dood maar blijft staan: v4 gebruikt
   het wave-systeem in plaats van een vast aantal robots.
6. **Er is geen enkele test.** Zie §7.

---

## 7. Testdekking

**Nul.** De 117 testscripts in `tests/` gaan allemaal over `amsterdam-undead.html`.
Voor deze game bestaat er geen enkele test, geen helper en geen meetscript.

Dat is de reden dat `SONNET_EXECUTION_PLAN_monument.md` bij D1 begint en niet
bij de herschaling: een arena 1:3 verkleinen zonder testvangnet is een
wijziging waarvan je de schade pas ziet als je hem handmatig tegenkomt.

Nieuwe tests krijgen het voorvoegsel **`test-dnm-`**, zodat `run-all.mjs` ze
vanzelf oppikt zonder dat de undead-suite erdoor verandert.
