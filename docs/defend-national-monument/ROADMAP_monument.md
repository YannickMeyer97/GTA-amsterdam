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

---

## Tickets

Legenda: ☐ open · ◐ bezig · ☑ af

### Fase 0 — Fundament

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D0** | Testmap opsplitsen per game |
| ☐ | **D1** | Testinfrastructuur en debug-hooks uitbreiden |
| ☐ | **D2** | Gedragstests die een herschaling overleven |
| ☑ | **D3** | Documenten sorteren |

D0 komt vóór D1: de testmap moet gesplitst zijn voordat `helpers-defend.mjs`
en de eerste `test-dnm-*`-tests erin landen, anders verhuis je ze later
alsnog.

### Fase 1 — De arena op maat

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D4** | Schaalfundament (voorzichtig, nooit combineren) |
| ☐ | **D5** | Spelsystemen herijken op de nieuwe schaal |
| ☐ | **D6** | Meten en bijstellen |

### Fase 2 — De run krijgt een kop en een staart

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D7** | Eindscherm met statistieken |
| ☐ | **D8** | Highscore |
| ☐ | **D9** | Opnieuw spelen zonder verversen |

### Fase 3 — De tower defense-kern

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D10** | Bouwplekken |
| ☐ | **D11** | De geschuttoren |
| ☐ | **D12** | Torenniveaus en reparatie |
| ☐ | **D13** | Het hek |
| ☐ | **D14** | Robots vallen torens aan |
| ☐ | **D15** | Bouwfase tussen waves |
| ☐ | **D16** | Economie herijken |

### Fase 4 — Oververhitting

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D17** | De warmtemechaniek |
| ☐ | **D18** | Warmte zichtbaar en hoorbaar maken |
| ☐ | **D19** | Koeling als vierde upgrade |

### Fase 5 — Het monument wordt een personage

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D20** | Zichtbare schadestaten |

### Fase 6 — Platform

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D21** | Kwaliteitsinstellingen |
| ☐ | **D22** | Instellingenscherm |
| ☐ | **D23** | Touch: besturingsgate loskoppelen van Pointer Lock |
| ☐ | **D24** | Touch: lopen, kijken, vuren |
| ☐ | **D25** | Touch: contextknop en bouwen met je duim |
| ☐ | **D26** | Touch: liggend, schermindeling, veilige zones |

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
