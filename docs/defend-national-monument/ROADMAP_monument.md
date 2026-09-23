# ROADMAP_monument.md — Defend National Monument

Voortgangsoverzicht van `defend-national-monument.html`. Tegenhanger van
`docs/amsterdam-undead/ROADMAP_undead.md`; de twee games delen geen code en
deze twee roadmaps delen geen tickets.

- **Wat er gebouwd moet worden en waarom** staat in
  `SONNET_EXECUTION_PLAN_monument.md` — daar staat per ticket de volledige
  opdracht, de acceptatiecriteria en de onderbouwing.
- **Hoe de game in elkaar zit** staat in `ARCHITECTURE_NOTES_monument.md`.
- **Dit bestand** houdt alleen bij wat af is, wat loopt en wat er onderweg is
  veranderd.

---

## Waar de game nu staat

Versie v4, 3.518 regels. Wave-survival op de Dam: vijf spawnpoorten, vijf
robottypes, drie upgrades, een combosysteem en de Kerkklok Boost. Speelbaar en
stabiel.

De game heeft lang stilgelegen terwijl Amsterdam Undead doorontwikkelde. De
diagnose daarvan — kaart te groot, geen ritme in het schieten, monument is
decor, geen ruimtelijke beslissingen, run zonder staart, nul testdekking —
staat in `SONNET_EXECUTION_PLAN_monument.md` §2.

**Testdekking: 0 scripts.** Alle 117 testscripts in `tests/` gaan over Amsterdam
Undead. Dit is de reden dat het plan bij testinfrastructuur begint en niet bij
de herschaling.

**Stand na D6 (bijgewerkt):** fase 0 en 1 zijn af, de game staat op 3.844
regels met twee testscripts (`test-dnm-laadt.mjs`, `test-dnm-kern.mjs`) plus
één meetscript. Na D6 volgde een review van het resterende plan; de
bijsturing daaruit staat in `SONNET_EXECUTION_PLAN_monument.md` §10 en is
hieronder al in de volgorde verwerkt.

---

## Tickets

Legenda: ☐ open · ◐ bezig · ☑ af · ✗ geschrapt

**Volgorde na de review (na D6):** de tabellen hieronder staan in
uitvoeringsvolgorde, niet in nummervolgorde. Ticketnummers zijn bewust NIET
hernummerd (ze staan in commits en documenten); nieuwe tickets kregen de
eerstvolgende vrije nummers D28–D30. Onderbouwing: plan §10.

### Fase 0 — Fundament

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D0** | Testmap opsplitsen per game |
| ☑ | **D1** | Testinfrastructuur en debug-hooks uitbreiden |
| ☑ | **D2** | Gedragstests die een herschaling overleven |
| ☑ | **D3** | Documenten sorteren |

D0 komt vóór D1: de testmap moet gesplitst zijn voordat `helpers-defend.mjs`
en de eerste `test-dnm-*`-tests erin landen, anders verhuis je ze later
alsnog.

### Fase 1 — De arena op maat

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D4** | Schaalfundament (voorzichtig, nooit combineren) |
| ☑ | **D5** | Spelsystemen herijken op de nieuwe schaal |
| ☑ | **D6** | Meten en bijstellen (gespeeld en bevestigd; opvolgpunten hieronder) |

### Fase 2 — De run krijgt een kop en een staart

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D7** | Eindscherm met statistieken |
| ☐ | **D8** | Highscore |
| ☐ | **D9** | Opnieuw spelen zonder verversen |
| ☐ | **D20** | Zichtbare schadestaten *(naar voren gehaald uit fase 5)* |

### Fase 3 — De tower defense-kern

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D28** | Aangekondigde poorten *(nieuw)* |
| ☐ | **D29** | Wapenbereik beperken *(nieuw)* |
| ☐ | **D10** | Bouwplekken |
| ☐ | **D11** | De geschuttoren |
| ☐ | **D15** | Bouwfase tussen waves *(naar voren, direct na D11)* |
| ☐ | **D12** | Torenniveaus en reparatie |
| ☐ | **D13** | Het hek |
| ☐ | **D14** | Robots vallen torens aan |
| ☐ | **D16** | Economie herijken |
| ☐ | **D30** | Themagolven *(nieuw)* |

### Fase 4 — Oververhitting *(voorwaardelijk: beslissen na fase 3)*

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D17** | De warmtemechaniek |
| ☐ | **D18** | Warmte zichtbaar en hoorbaar maken |
| ☐ | **D19** | Koeling als vierde upgrade |

### Fase 5 — Het monument wordt een personage

D20 is naar fase 2 verhuisd; deze fase is daarmee leeg.

### Fase 6 — Platform

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D21** | Kwaliteitsinstellingen |
| ☐ | **D22** | Instellingenscherm |
| ✗ | **D23** | Touch: besturingsgate loskoppelen van Pointer Lock |
| ✗ | **D24** | Touch: lopen, kijken, vuren |
| ✗ | **D25** | Touch: contextknop en bouwen met je duim |
| ✗ | **D26** | Touch: liggend, schermindeling, veilige zones |

### Backlog — bewust ná alle bovenstaande tickets

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D27** | Richtingspijlen herzien |

**D27 — Richtingspijlen herzien.** Speeltest-feedback op de
richtingspijlen-implementatie uit de "Speeltest-feedback na D6"-ronde
(zie hieronder): "je ziet nu constant overal wat pijltjes" — te druk/
rommelig zodra er meerdere robots tegelijk buiten beeld zijn (de pool van 5
kan dus alle 5 tegelijk tonen, en dat voelt niet goed). Expliciet verzoek van
de eigenaar: **dit ticket bewust ná alle andere tickets oppakken**, niet nu.
Geen oplossingsrichting vastgelegd — dat is voor als dit ticket aan de beurt
is. De minimap zelf kreeg geen kritiek en blijft ongewijzigd.

**Na de review:** de drukte is vooral een gevolg van het spawnritme (altijd
5–13 robots verspreid over alle vijf poorten), niet van de pijlen zelf. D28
(aangekondigde poorten) raakt die oorzaak. Herbeoordeel D27 dus pas ná D28 —
misschien is het dan al opgelost.

---

## Afgerond

### D0 — Testmap opsplitsen per game

`tests/` was één vlakke map met 117 test-/check-scripts en 22 hulp-/
meetscripts, allemaal voor Amsterdam Undead. Alles daarvan is verhuisd naar
`tests/amsterdam-undead/`; `node_modules`, `run-all.mjs`,
`run-all-parallel.mjs`, `helpers.mjs`, `README.md` en de package-bestanden
blijven gedeeld op `tests/`-niveau. `tests/defend-national-monument/` volgt
in D1, met de eerste `test-dnm-*`-tests.

**Wat er is aangepast:**
- `run-all.mjs` en `run-all-parallel.mjs`: de vlakke `readdirSync(__dirname)`
  is vervangen door een functie die één niveau diep in elke submap zoekt.
  Vond exact dezelfde 117 scripts als vóór de verhuizing.
- De `HERKANSING`-set matcht nu op de bestandsnaam (`path.basename`), niet op
  het volledige pad — anders zou geen enkel bekend timing-gevoelig script
  meer herkend worden.
- 136 `import … from './helpers.mjs'` herschreven naar `'../helpers.mjs'`.

**Negen scripts bleken hun eigen paden onafhankelijk van `helpers.mjs` te
resolven** (een eigen CDN-intercept, of een losse broncode-inspectie van
`amsterdam-undead.html`), en waren dus stuk na de verhuizing totdat ze
gecontroleerd zijn: `maak-geluidsverslag.mjs`, `meet-audio-budget.mjs`,
`meet-eindtoestand.mjs`, `meet-ruislaag.mjs`, `test-faalmodi.mjs`,
`test-audioregistry.mjs` en `test-arsenaal.mjs`. Elk teruggevonden door een
gerichte grep op `__dirname`/`node_modules`/`amsterdam-undead.html` over de
hele verplaatste map, niet door aan te nemen dat de importfix voldoende was.

**Verificatie:** de volledige suite (`node run-all.mjs`) draaide **117/117
groen** — geen enkele FAIL, ook niet de bekende flake uit een eerdere run.
Dit ticket veranderde geen enkele assertie, alleen paden.

### D1 — Testinfrastructuur en debug-hooks uitbreiden

`window.DamChaosDebug` bestond al (zie D3's bevinding); dit ticket heeft 'm
uitgebreid, niets opnieuw aangemaakt. Twintig nieuwe exports:
`GRENS`, `MONUMENT_POSITIE`, `MONUMENT_BOX`, `MONUMENT_MAX_HP`,
`SPAWN_POORTEN`, `afstandTotMonument`, `upgradeKosten`, `losBotsingenOp`,
`updateRobots`, `koopUpgrade`, `koopMonumentReparatie`, `legMuntNeer`,
`updateInteracties`, `activeerHuidigeInteractie`,
`activeerBijenkorfUpgradeShop`, `updateMunten`, `updateSpeler`,
`probeerTeSchieten`, en twee getters voor `let`-variabelen —
`klokStand: () => klok` en `huidigeInteractieStand: () => huidigeInteractie`
— naar het bestaande patroon van `geldStand`. Elke naam eerst gecontroleerd
op aanwezigheid vóór toevoeging: geen enkele overlapte met wat er al stond.

Nieuw: `tests/helpers-defend.mjs`, een bewust zelfstandige kopie van
`helpers.mjs` (geen gedeelde imports tussen de twee testinfra's, zelfde
regel als tussen de twee games zelf) met `openDefend()`,
`executablePathOptie`, `frames()` en `makeChecker()`. Hergebruikt de
bestaande gedeelde-browser-global uit `run-all.mjs`
(`__AMSTERDAM_UNDEAD_SHARED_BROWSER__`) zodat de suite niet trager wordt
door een tweede browserlaunch — de naam is historisch en dekt inmiddels
beide games, maar hernoemen is bewust buiten scope gehouden.

Eerste test: `tests/defend-national-monument/test-dnm-laadt.mjs` (20
checks) — de game laadt zonder console-errors, de wereld heeft obstakels,
wave 1 staat klaar volgens de bestaande formules, het monument staat op
100 HP, en alle 33 bestaande plus 20 nieuwe debug-sleutels zijn aanwezig
(sleutel-aanwezigheid, geen gedrag — dat is D2). Een korte steekproef
roept de nieuwe exports ook echt aan, zodat een `ReferenceError` niet
alleen door de sleutelcheck heen glipt.

**Verificatie:** `node run-all.mjs` (118 scripts, beide games) draaide
**117/118 groen**; de ene uitvaller (`test-nachthemel.mjs`, een
screenshot-determinismetoets) draaide 3× schoon in isolatie — een
bestaande load-gevoelige flake, geen regressie. De nieuwe D1-test zelf:
20/20. `amsterdam-undead.html` en `index.html` zijn niet aangeraakt.

### D2 — Gedragstests die een herschaling overleven

Nieuw: `tests/defend-national-monument/test-dnm-kern.mjs`, 70 checks in acht
secties — spawnpoorten binnen `GRENS`, interactiepunten binnen `GRENS` en
bereikbaar, geen twee interactiepunten binnen elkaars radius, een
route-simulatie per poort (normale én tank-botsstraal), de wave-formules
voor n = 1/5/10/13/20, `kiesRobotTypeVoorWave` per wave, `upgradeKosten` voor
alle niveaus, `huidigeSchotCooldown` en `robotRaaktMonument`. Alles in
verhoudingen, geen absolute coördinaten — dit bestand is de referentie
waartegen D4's herschaling wordt afgezet.

Geen enkele gameplay-constante aangeraakt; alleen het nieuwe testbestand.

**Twee aannames uit het plan bleken bij het bouwen onjuist, allebei vóór het
eerste testrun gecorrigeerd:**

1. **"Elk interactiepunt ligt op een vrije plek" klopt niet.** De Kerkklok-
   en Reparatie-markering staan zelf op hun eigen, kleine geregistreerde
   rechthoek (dat is de bedoeling — je loopt niet doorheen de markering).
   `isVrijePlek()` op het exacte coördinaat gaf dus `false` voor allebei,
   ook al zijn ze overduidelijk speelbaar. Vervangen door een
   "bereikbaar"-check: 24 hoeken bemonsteren op 75% van de interactieradius
   en eisen dat minstens één richting vrij is. Dat bewaakt wat er echt toe
   doet — kan de speler er binnen bereik van komen — in plaats van een
   toevallige eigenschap van de markering zelf.
2. **De tank-botsstraal (0,45 × 1,4 = 0,63) kan de echte aankomstdrempel
   (0,6) NOOIT halen** — dat is meetkunde, geen routeprobleem: een lichaam
   met straal 0,63 kan nooit dichter dan 0,63 bij de monumentdoos komen,
   dus de vaste 0,6 zou de test altijd laten falen, ook op een verder
   probleemloze route. De drempel is nu straal-relatief (`straal + 0,15`,
   dezelfde marge die de echte 0,6 t.o.v. de echte botsstraal 0,45 al
   had). Met die correctie bereikten alle 5 poorten × 2 botsstraal-
   varianten het monument in 280–621 stappen — geen enkele vastloper op de
   huidige schaal.
3. **`huidigeSchotCooldown()` haalt het plafond van 0,07s niet op
   vuurtempo-niveau 5 alleen.** De formule is
   `max(0.07, (0.26 - niveau·0,035) × getComboVuurtempoMultiplier())`; op
   niveau 5 zonder combo geeft dat 0,085s. Het plafond vereist niveau 5 ÉN
   combo ≥ 10 (multiplier 0,7×). Beide gevallen worden nu apart getest.

**Verificatie:** 70/70 groen, 3× schoon in isolatie gedraaid (de
route-simulatie en de 1000-trekkingen-per-wave typecheck zijn de
RNG-gevoelige onderdelen). Volledige suite (`node run-all.mjs`, 119
scripts): **118/119 groen** — de ene uitvaller is opnieuw
`test-nachthemel.mjs`, dezelfde bestaande flake als bij D1, niet door dit
ticket aangeraakt. Zowel `test-dnm-kern.mjs` (70/70) als `test-dnm-laadt.mjs`
(20/20) draaiden binnen de volledige suite schoon. Geen enkele
gameplay-constante in `defend-national-monument.html` aangeraakt — alleen
het nieuwe testbestand en de twee documenten.

### D3 — Documenten sorteren

Alle documentatie verhuisd naar `docs/<game>/`. De drie HTML-bestanden blijven
in de root omdat dat de live URL's van GitHub Pages zijn. Documenten die per
game bestaan kregen een achtervoegsel (`_undead` / `_monument`) zodat ze in een
editor-tab of zoekresultaat zonder pad uit elkaar te houden zijn; losse
rapporten die maar voor één game bestaan hielden hun kale naam.

Nieuw aangemaakt: `ARCHITECTURE_NOTES_monument.md` (uit de code gelezen, met
narekenbare maten en de bestaande invarianten) en dit bestand.

Daarna zijn beide monument-documenten volledig uitgewerkt tegen de code, zodat
de tickets uitvoerbaar zijn zonder dat er nog ontwerpwerk nodig is. Dat leverde
vijf correcties op het oorspronkelijke plan op:

1. **`window.DamChaosDebug` bestaat al** met ~30 exports. Het plan wilde bij D1
   een nieuwe `window.DefendDebug` maken. Nu: uitbreiden, naam blijft.
2. **De robotsnelheid was fout berekend.** `maakRobot` zet
   `snelheid: 1.4 + Math.random()`, maar `spawnRobot` overschrijft die
   onmiddellijk met `min(1,35 + rnd·0,7 + wave·0,07, 3,2) × 1,1 × typefactor` —
   een formule die **meeschaalt met de wave** en afvlakt op 3,52 m/s. Alle
   looptijdtabellen zijn hierop herrekend.
3. **De afstandstabel mat naar het middelpunt** van het monument, terwijl
   `afstandTotMonument()` naar de rand van `MONUMENT_BOX` meet — ~10 m
   verschil. Beide conventies staan nu naast elkaar.
4. **Negen `registreerRechthoek`-aanroepen, niet tien** (en negen
   `registreerObstakel`). De lijst met regelnummers staat in de
   architectuurnotities.
5. **`spelActief` in de gameloop checkt `spel.gameOver` niet.** Na game over
   blijft de loop draaien: je kunt schieten, munten oprapen en rondlopen. D7 en
   D9 zijn hierop aangescherpt.

Daarnaast vijf stukken dode code gevonden en gedocumenteerd (`ROBOT_AANTAL`,
`respawnLijst`, `vindDichtstbijzijndeInteractie`, `robot.pauze`, en de
overschreven `robot.snelheid`), plus een nieuw ticket **D0** voor het
opsplitsen van de testmap.

### D4 — Schaalfundament

De arena is 3× verkleind (`ARENA_SCHAAL = 1/3` op afstanden/voetafdrukken,
`GEBOUW_HOOGTE_SCHAAL = 0,6` op hoogtes, `MONUMENT_HOOGTE_SCHAAL = 0,8` op het
monument specifiek). `GRENS` gaat van 283×224 m naar 94,3×74,7 m.

**Belangrijkste bevinding, vóór er één regel code werd geschreven:** het
oorspronkelijke plan noemde als to-do-lijst "grondvlak, damPleinPunten, alle
bouwfuncties, plaatsGevelrij, straatmeubilair, railpad, zebrapaden" — dat bleek
overbodig. `wereld` (de gedeelde ouder-Group van letterlijk alle ~40
bouwfuncties, geverifieerd door alle 11 `scene.add()`-aanroepen in het bestand
na te lopen) hoeft maar **één regel** te krijgen —
`wereld.scale.set(ARENA_SCHAAL, GEBOUW_HOOGTE_SCHAAL, ARENA_SCHAAL)`, gezet
vóórdat er iets gebouwd wordt — en de hele zichtbare stad (positie, voetafdruk
én hoogte) schaalt in één keer mee, zonder dat er ook maar één hardgecodeerde
coördinaat in een bouwfunctie hoefde te veranderen. De volledige uitleg,
inclusief waarom dat werkt, staat in `ARCHITECTURE_NOTES_monument.md` §4.2.

**Wat wél met de hand moest, in drie categorieën:**
1. De negen `registreerRechthoek()`-aanroepen (kale getallen, geen
   wereldmatrix) — alle vijf argumenten (vier coördinaten + marge)
   × `ARENA_SCHAAL`.
2. De marge-parameter van alle acht `registreerObstakel()`-aanroepen (een
   vast bufferzone-getal dat niet door de wereldmatrix loopt).
3. De rijdende tram — de enige plek in het bestand die een `obstakels`-
   rechthoek rechtstreeks uit `g.position.x/z` (lokale coördinaten) bouwt,
   in plaats van via een van de twee registratiefuncties. `TRAM_HALF_X`/
   `TRAM_HALF_Z` schalen mee; `snelheid` en `zMin`/`zMax` blijven bewust
   ongewijzigd (lokale grootheden die tegen elkaar vergeleken worden, dus de
   rittijd in seconden blijft gelijk).

Het monument kreeg een **eigen, extra `g.scale.y`** bovenop `wereld`'s
hoogteschaal (`MONUMENT_HOOGTE_SCHAAL / GEBOUW_HOOGTE_SCHAAL`), zodat het
relatief hoger blijft dan de rest — precies zoals gepland, en narekenbaar:
22 m × 0,6 × (0,8/0,6) = 17,6 m, exact de doelwaarde uit het plan.

De schaduwcamera-frustum (±110 → ±36,7) schaalt mee voor een scherpere
schaduw op de kleinere kaart.

**Bijvangst: een latente bug uit D1 gevonden en gefixt.**
`window.DamChaosDebug` exporteerde nooit `renderer`, terwijl
`helpers-defend.mjs`'s `simuleerPointerLock`-optie die sinds D1 al aanriep —
een `TypeError` die nooit afging omdat geen enkele D1/D2-test die optie
gebruikte. Toegevoegd, nodig voor de verificatieschermafbeeldingen hieronder
en voor elke latere ticket die wél pointer lock nodig heeft.

**De verwachte, tijdelijke rode uitslag van D2 — met bewijs dat het geen
regressie is.** `test-dnm-kern.mjs` geeft na D4 13 FAILs: de vijf
spawnpoort-binnen-GRENS-checks, de zes interactiepunt-checks, en de
Kalverstraat-route (beide botsstraal-varianten). Oorzaak: `SPAWN_POORTEN` en
`interactiePunten` zijn D5-scope en staan dus nog op hun oude, ongeschaalde
coördinaten, terwijl `GRENS` nu al geschaald is — precies het venster dat
"nooit combineren" bewust openlaat tussen twee losse commits. Geverifieerd,
niet aangenomen: met de Kalverstraat-poort en zijn tussenpunt HANDMATIG
vooruitlopend geschaald (dus zoals D5 ze zal opleveren) bereikt de route het
monument gewoon in 263–265 stappen, exact in lijn met de andere vier poorten.
De vier andere "geslaagde" routechecks zijn op dit moment overigens ZELF ook
niet betrouwbaar — Damstraat "slaagt" nu in 9 stappen, een artefact van
toevallige overlap tussen de oude, nog ongeschaalde `MONUMENT_BOX` en de
nieuwe `GRENS`, niet een bewijs dat die route klopt. D5 lost dit in zijn
geheel op door `SPAWN_POORTEN`/`interactiePunten`/`MONUMENT_POSITIE`/
`MONUMENT_BOX`/de speler-startplek consistent te schalen.

**Visuele verificatie:** vier schermafbeeldingen genomen vanaf een punt bij
het (nieuwe, echte) monument, richting noord/oost/zuid/west. Geen
console-errors, geen z-fighting, geen gaten in de geometrie. De gebouwen
torenen nog duidelijk boven straatmeubilair (lantaarns, bankjes, de tram) —
geen "poppenhuis"-effect, precies het ontwerpdoel uit §3 van het plan.

**Verificatie:** `node run-all.mjs` (119 scripts, beide games): **118/119
groen**. De 13 fails zijn precies en uitsluitend de hierboven gediagnosticeerde,
verwachte D4/D5-venster-fails in `test-dnm-kern.mjs` (57/70) — geen enkele
andere. `test-dnm-laadt.mjs` blijft 20/20 (gebruikt geen `GRENS`-vergelijking,
dus geen last van het venster) en **alle 117 Amsterdam Undead-scripts blijven
ongewijzigd groen** — deze ticket raakte dat bestand op geen enkele manier.
Geen console-errors, geen syntaxfouten, geen onverwachte regressies.

### D5 — Spelsystemen herijken op de nieuwe schaal

Het D4/D5-venster is dicht. Elke gameplay-wereldcoördinaat die GEEN kind van
`wereld` is — en dus niet automatisch meeschaalde via `wereld.scale.set(...)`
(zie D4) — kreeg een handmatige `× ARENA_SCHAAL`, op de declaratieplek zelf
(dus als `42 * ARENA_SCHAAL`, niet als vooraf uitgerekende decimalen 14,00):
`MONUMENT_POSITIE`, `MONUMENT_BOX`, alle vijf `SPAWN_POORTEN` (positie +
spreidingX/Z + Kalverstraat's tussenpunt), de drie `interactiePunten`-posities,
`speler.positie` en `raycaster.far` (150 → 50, dezelfde verhouding
wapenbereik/kaartdiagonaal als vóór de herschaling, omdat de diagonaal van
`GRENS` door de uniforme x/z-schaling ook exact met `ARENA_SCHAAL` meeschaalt).

Alle uitkomsten kwamen exact overeen met de doelwaarden uit het plan —
narekenbaar, niet toevallig: MONUMENT_POSITIE (14,00, 0, −1,33),
MONUMENT_BOX halve maat ±3,57, speler-startplek (5,33, 0, 10,00), allemaal
geverifieerd rechtstreeks tegen de levende pagina, niet alleen berekend.

**Bewust NIET geschaald**, zoals het plan voorschreef: `interactiePunten[].
radius` (4 m, mensenmaat), de aankomstdrempel `0,6`, de robot-botsstraal
`0,45`/`speler.straal 0,4` (lichaamsmaten), `isVrijePlek`'s marge en de 2 m-
rand op `GRENS`, en (buiten D5's scope, D6 straks) muntwaarden, HP, schade,
wave-formules en robotsnelheid.

**Eén vondst tijdens het implementeren, niet in het plan genoemd:** de
"dichtbij genoeg"-afstand voor Kalverstraat's tussenpunt (`< 6` in
`updateRobots`) is met opzet ONgeschaald gelaten — geen stuk-risico (een
relatief grotere tolerantiezone maakt de aankomstcheck juist makkelijker),
maar wel iets voor D6 om op het gevoel te beoordelen. Zie
`ARCHITECTURE_NOTES_monument.md` §6.3.

**Verificatie:**
- `test-dnm-kern.mjs`: **70/70 groen** — inclusief alle vijf routechecks (nu
  voor het eerst op consistente, geschaalde coördinaten, dus voor het eerst
  ook echt betekenisvol) en de drie interactiepunt-bereikbaarheid/overlap-
  checks.
- Handmatige controle van de speler-startplek: `isVrijePlek(5,33, 10,00,
  0,4)` → `true`, binnen `GRENS` → `true` — het tweede deel van D5's eigen
  acceptatiecriterium, dat D2 niet apart test.
- `node run-all.mjs` (119 scripts, beide games): **118/119 groen**. De ene
  fail (`test-golf1-economie.mjs`, Amsterdam Undead) is een al eerder
  vastgestelde RNG-flake (1 van 5 camp-and-melee-trials stierf) — 3× schoon
  in isolatie herbevestigd, geen regressie en geen relatie met dit ticket.

Geen enkele gameplay-constante buiten de expliciet genoemde lijst aangeraakt.

### D6 — Meten en bijstellen

**Bevestigd, niet alleen berekend.** `tests/defend-national-monument/
meet-dnm-afstanden.mjs` (nieuw meetscript, geen `test-`-prefix, draait niet
in `run-all.mjs`) meet de looptijden rechtstreeks tegen de levende pagina.
Uitkomst: exact het probleem dat D4/D5 al voorspelden — Damrak (9,1s),
Rokin (8,9s) en Damstraat (6,7s) zakten bij het robot-snelheidsplafond onder
de reactiedrempel van 10s, terwijl Kalverstraat (11,5s) en Nieuwendijk
(11,7s) erboven bleven.

**Gekozen oplossing: optie 1 uit het plan (poorten naar buiten), gecombineerd
met een milde variant van optie 2 (plafondverlaging)** — precies de
voorkeur die het plan al aangaf. Reden om NIET puur optie 1 te gebruiken:
Damrak zat al binnen 2 m van `GRENS` op zijn oorspronkelijke bearing (verder
naar buiten op dezelfde lijn vanaf de oorsprong kwam bij een positie die zelf
niet eens `isVrijePlek()` was); pure herpositionering op de bestaande bearing
gaf voor alle drie hooguit 32-34 m, en zelfs op de meetkundig best haalbare
plek net onder de drempel (35,2 m is de ECHTE grens bij het oude plafond
3,2 — niet 35 m zoals het plan afrondde: `35,2 / 3,52 m/s = 10,0s` exact).

**Wat er precies veranderd is:**
- Drie poortposities verplaatst met een **bewuste laterale verschuiving**
  (niet puur radiaal vanaf de oorsprong) tot een geverifieerd veilige plek
  ruim voorbij 35 m: Damrak (0, −35,33) → (−4, −37,2), Rokin (0,67, 32,00) →
  (−6, 33,3), Damstraat (41,00, 1,33) → (53, 2). Elke nieuwe positie
  gecontroleerd — niet aangenomen — op `isVrijePlek() === true`, binnen de
  `GRENS`-marge, én een geslaagde route-simulatie (`test-dnm-kern.mjs`).
  Kalverstraat en Nieuwendijk ongewijzigd (al ruim boven de drempel).
- Het robot-snelheidsplafond in `spawnRobot()` (de bestaande
  `Math.min(..., 3.2)` in de basissnelheid-formule): 3,2 → 3,0 (effectief
  3,52 → 3,30 m/s). Een bewust milde 6,25%-verlaging — genoeg voor een echte
  marge (~0,6-0,7s boven de drempel i.p.v. 0,0-0,1s), niet zo veel dat de
  late-game-snelheidsspanning verdwijnt.

**Resultaat, opnieuw gemeten:** alle vijf poorten nu 10,7-12,5s bij het
plafond (was 6,7-11,7s), en wave 1 op 15,2-22,7s voor de dichtstbijzijnde
poort — precies binnen het ontwerpdoel van 15-25s. Steunpunt-retour vanaf
het monument: Kerkklok 10,9s, Reparatie 10,7s (doel 10-15s ✓), Bijenkorf
2,1s (blijft vlak bij het monument, zoals bedoeld). Speler-doorkruistijd:
13,5s (doel 10-15s ✓, ongewijzigd sinds D4/D5).

**Verificatie:**
- `meet-dnm-afstanden.mjs` opnieuw gedraaid: alle vijf poorten ✓, geen enkele
  meer onder de reactiedrempel.
- `test-dnm-kern.mjs`: **70/70 groen**, inclusief de route-simulatie vanaf de
  drie NIEUWE poortposities — bevestigt dat ze niet alleen "vrij" zijn maar
  ook daadwerkelijk een pad naar het monument hebben.
- Vier schermafbeeldingen vanaf de drie verplaatste poorten (richting het
  monument): open straatbeeld, geen clipping door gebouwen, geen visuele
  afwijkingen.
- Volledige suite (`node run-all.mjs`, 119 scripts, beide games): **119/119
  groen** — perfecte score, ook geen van de bekende flakes
  (`test-nachthemel.mjs`, `test-golf1-economie.mjs`) deze keer.

**Dit ticket is pas formeel af als de eigenaar het gespeeld heeft** (eigen
acceptatiecriterium uit het plan) — het bestand is na deze ronde gestuurd
om te spelen.

---

### Speeltest-feedback na D6

De eigenaar heeft gespeeld en drie punten teruggegeven: "opzich prima, maar
nog wat onoverzichtelijk door de vele decor dingen", "robots voelen nog net
iets te groot" (10-20% kleiner gevraagd), en "lastig te bepalen waar de
robots zijn en vandaan komen" (expliciet om opties gevraagd). Voor de laatste
twee punten is met `AskUserQuestion` de scope vastgesteld i.p.v. aangenomen:
robot-zichtbaarheid via **richtingspijlen aan de schermrand** én een
**simpele minimap** (beide gekozen, niet één van de twee), decor-overzicht
via **minder decor rond het strijdtoneel** specifiek (niet overal, niet een
andere optie uit het lijstje).

**Wat er veranderd is:**
- **Robots 15% kleiner** (binnen de gevraagde 10-20%-band): elke
  `schaal`-waarde in `ROBOT_TYPES` × 0,85 (was 1,0/0,85/1,4/1,05/1,0, nu
  0,85/0,7225/1,19/0,8925/0,85). Puur visueel — zie §6.4 in
  ARCHITECTURE_NOTES_monument.md: de botsstraal in `updateRobots()` is
  hardgecodeerd 0,45 en negeert `schaal`, dus de hitbox is ongewijzigd.
- **Decor rond het strijdtoneel uitgedund**: de paaltjesring om het monument
  in `bouwNationaalMonument()` van 20 naar 10 palen gehalveerd, en het
  fietsenrek dat op ~19 m van het monument stond (midden in het strijdtoneel)
  verwijderd.
- **Drie straatnaamborden verschoven** (Damrak/Rokin/Damstraat) zodat ze weer
  overeenkomen met de poortposities die D6 al verplaatste — dit was géén
  aparte "vandaan komen"-maatregel, maar het rechttrekken van een
  documentatie-mismatch die D6 per ongeluk had laten staan.
- **Richtingspijlen aan de schermrand**: vaste pool van 5 herbruikbare
  `.robotpijl`-divs (zelfde pooling-patroon als brokstukken), één per
  dichtstbijzijnde off-screen robot, gepositioneerd en geroteerd via
  `THREE.Vector3.project(camera)` → NDC-coördinaten, geklemd op een
  schermrand-marge, driehoekje wijst naar de robot.
- **Simpele minimap**: vast 2D-`<canvas>` rechtsonder, robots (rode stip),
  monument (gele stip) en speler (wit driehoekje, geroteerd op `speler.yaw`)
  lineair gemapt vanuit de `GRENS`-rechthoek naar canvas-pixels, elk frame
  herberekend zolang `spelActief`.
- **Bugfix tijdens het bouwen van bovenstaande, geen apart verzoek**: in
  `gameLoop()` liepen `tekenMinimap()`/`updateRichtingspijlen()` vóór
  `renderer.render()`, maar `updateSpeler(dt)` zet alleen
  `camera.position`/`camera.rotation` — de gecachte `matrixWorldInverse`
  waar `.project(camera)` op leunt wordt pas ververst tijdens `render()`.
  Zonder fix liepen pijlen/minimap dus altijd één frame (~16ms) achter op de
  camera-oriëntatie, merkbaar bij snel omkijken. Fix: expliciete
  `camera.updateMatrixWorld()` vlak vóór die twee aanroepen. Ontdekt via een
  functionele test die de projectie leek om te draaien; bleek eerst een
  testfout (geen `updateMatrixWorld()` na handmatig de camera verzetten in
  de test), maar bij het narekenen bleek de echte call-volgorde in
  `gameLoop()` hetzelfde euvel te hebben — dus wel degelijk een echte,
  zij het kleine, bug.

**Verificatie:** syntax-/laadcheck, `test-dnm-laadt.mjs` (20/20) en
`test-dnm-kern.mjs` (70/70) na elke deelstap, een losse functionele test van
`projecteerOpScherm()`/`tekenMinimap()`/`updateRichtingspijlen()` (robot
vlak voor de speler → op scherm, robot ver achter de speler → buiten
scherm, bevestigd via een echt gameLoop-frame i.p.v. handmatige state),
en de volledige regressiesuite (`node run-all.mjs`, beide games) na alle
deelstappen samen.

---

## Openstaande verbeteringen uit de bevroren periode

Deze drie punten stonden in `ROADMAP_undead.md` genoteerd toen deze game
bevroren was. Ze zijn hier nu opgenomen en alle drie door het plan gedekt:

- **Performance verbeteren** → D21 (kwaliteitsinstellingen)
- **Wave balancing testen** → D2, D6, D16
- **Game over en restart flow verbeteren** → D7, D8, D9

---

## Regels

- Werk aan één game tegelijk en schrijf in de documenten van díe game
  (zie CLAUDE.md).
- Geen gedeelde engine, geen gedeelde JS/CSS met Amsterdam Undead. Hergebruik
  gaat via kopiëren en aanpassen.
- Elke game blijft single-file; geen externe assets.
- Elke stap eerst testen (headless + handmatig) voordat die naar `main` gaat.
- Nieuwe tests krijgen het voorvoegsel `test-dnm-`.
- D4 raakt uitsluitend geometrie, D5 uitsluitend spelsystemen. Nooit
  combineren in één commit — zie het plan voor waarom.
