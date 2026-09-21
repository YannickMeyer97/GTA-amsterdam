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
| ☐ | **D1** | Testinfrastructuur en debug-hooks |
| ☐ | **D2** | Gedragstests die een herschaling overleven |
| ☑ | **D3** | Documenten sorteren |

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

### D3 — Documenten sorteren

Alle documentatie verhuisd naar `docs/<game>/`. De drie HTML-bestanden blijven
in de root omdat dat de live URL's van GitHub Pages zijn. Documenten die per
game bestaan kregen een achtervoegsel (`_undead` / `_monument`) zodat ze in een
editor-tab of zoekresultaat zonder pad uit elkaar te houden zijn; losse
rapporten die maar voor één game bestaan hielden hun kale naam.

Nieuw aangemaakt: `ARCHITECTURE_NOTES_monument.md` (uit de code gelezen, met
narekenbare maten en de bestaande invarianten) en dit bestand.

Onderweg bleek bij het uitlezen van de code dat **`window.DamChaosDebug` al
bestaat** en een brede export heeft — het plan ging er bij D1 van uit dat er
nog niets was en wilde een nieuwe `window.DefendDebug` maken. D1 is daarop
bijgesteld: uitbreiden in plaats van aanmaken, en de bestaande naam blijft.

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
