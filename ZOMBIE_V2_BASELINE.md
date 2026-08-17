# Zombie V2 — meetbasis (Ticket 117)

Nederlands, zoals de rest van de projectdocumentatie. Dit document is het
opleverproduct van Ticket 117 (SONNET_EXECUTION_PLAN.md, ronde 9): een exacte
meting van Zombie V1 en de renderer eromheen, vóór er ook maar één regel aan
Zombie V2 gebouwd wordt. De sectie "Zombie V2" hieronder blijft leeg tot
Ticket 129 (het eindrapport) 'm invult — de structuur is nu al identiek aan
wat dat rapport zal gebruiken, zodat V1 en V2 straks letterlijk naast elkaar
staan.

## Hoe dit gemeten is

Twee instrumenten, precies zoals het ticket vraagt ("meten, niet aannemen"):

1. **`tests/meet-zombie-v1-baseline.mjs`** — headless Playwright (dezelfde
   Chromium/CDN-intercept-opzet als de rest van `tests/`), gebaseerd op het
   `meet-eindtoestand.mjs`-patroon uit T116. Meet wat in deze omgeving
   betrouwbaar meetbaar is: scenegraaf-structuur (meshes/materialen/
   geometrieën per ondode) en renderer-tellingen (`renderer.info` — draw
   calls, driehoeken, geheugen), met `renderer.info.autoReset = false` +
   handmatige `reset()` vóór de render (zie de toelichting in
   `amsterdam-undead.html` bij het F3-overlay-blok: zonder dit ziet
   `renderer.info.render` aan het eind van een frame alleen de LAATSTE
   interne `renderer.render()`-aanroep van de 4-pass composer-pipeline, niet
   het hele frame — exact de val die T116 zelf al een keer greep).
2. **De F3-overlay** (dit ticket, in `amsterdam-undead.html`) — hetzelfde
   instrument, maar dan voor de LEVENDE game in een echte browser. Dit is
   waar FPS/gemiddelde frametijd/p95 vandaan moeten komen: die zijn in de
   headless SwiftShader-omgeving van dit project **niet betrouwbaar
   meetbaar** (§10.3/§8.11 van `ARCHITECTURE_NOTES.md`/`SONNET_EXECUTION_
   PLAN.md` — softwarerendering geeft geen zinnige GPU-tijd). Elke
   frametijd-waarde hieronder die ontbreekt, ontbreekt daarom EXPLICIET om
   die reden, niet omdat hij vergeten is.

**Vier scenario's**, exact zoals het ticket ze noemt:
1. **1 ondode dichtbij** — 5 m recht voor de speler (zie toelichting in het
   meetscript: op 2 m vallen de VOETEN van een 1,7 m-camera al net onder de
   frustum-onderrand bij fov 70°, wat de "zichtbaar"-telling vertekent —
   geen bug, wel een reden om de afstand iets te vergroten).
2. **10 ondoden** — gespawnd op de echte `VENSTERS`-posities (realistisch),
   daarna verplaatst naar een zichtbare cluster (6 per rij, 0,7 m
   tussenruimte, rijen 2 m dieper) vóór de speler. Zonder die verplaatsing
   meet dit scenario alleen de STATISCHE scene: `VENSTERS` liggen verspreid
   over de hele kaart, dus de meeste zombies vallen buiten de camera-
   frustum en dragen dan 0 bij aan de draw-call-telling (frustum-culling
   werkt precies zoals verwacht — dat bleek meteen uit de eerste meetronde,
   waar 10 en 18 ondoden identieke drawcalls gaven omdat geen van beide
   sets in beeld stond).
3. **18 ondoden** — zelfde clustertechniek, `effectiefMaxActief()`'s
   praktische bovengrens.
4. **18 ondoden tijdens snel schieten** — scenario 3, gevolgd door 20×
   `schiet()` via de debug-hook (`wapenStaat.magazijn` eerst opgehoogd om
   herladen te vermijden), gemeten vlak ná de laatste schoten terwijl
   tracers/impact-effecten nog leven.

Alle vier de scenario's herbruiken hetzelfde bevroren-meetpatroon als T88/
T116 (`openVoorVisueleMeting()`), dus geen lampflikker-/tijd-ruis in de
getallen.

## Zombie V1

### Structuur per ondode (één representatieve, willekeurig getraite ondode)

| Scenario | Meshes | Materialen | Geometrieën | Transformnodes | Raycast-targets |
| --- | --- | --- | --- | --- | --- |
| 1 ondode dichtbij | 13 | 11 | 8 | 20 | 13 |
| 10 ondoden | 13 | 11 | 8 | 20 | 13 |
| 18 ondoden | 13 | 11 | 8 | 20 | 13 |
| 18 + snel schieten | 13 | 11 | 8 | 20 | 13 |

De meshtelling varieert in werkelijkheid per ondode (11-13, afhankelijk van
het gelote variatieprofiel — `gebocheld` voegt een bochel-mesh toe, wat het
maximum verklaart), maar de STRUCTUUR bevestigt de aanname uit
`SONNET_EXECUTION_PLAN.md`'s ronde-9-intro exact: tot 13 zichtbare meshes,
tot 11 eigen materiaalinstanties (nooit gedeeld tussen onderdelen — elke
`maakOndodeMateriaal()`-aanroep is een verse `MeshStandardMaterial`), en
elk van die 13 meshes is een eigen raycast-target (geen aparte hitbox-laag
in V1 — `schiet()` raycast rechtstreeks tegen `ondodenGroep`, alle
descendant-meshes inbegrepen).

De 8 gedeelde geometrieën (`geoCache`) blijven constant, ongeacht het aantal
ondoden — dat is precies wat T69 (v0.20) beloofde: alle ondoden delen
dezelfde ~9 basisvormen (been/torso/schouder/bochel/buik/kern/hoofd/oog/arm/
hand, hier 8 zichtbaar omdat niet elke variant een bochel heeft).

### Renderer-tellingen per scenario (volledig frame, hele scene)

| Scenario | Draw calls | Driehoeken | Geometrieën (totaal) | Texturen (totaal) | Ondoden actief | Ondoden zichtbaar | Lichten | Schaduwwerpend |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 ondode dichtbij | 585 | 51.453 | 434 | 26 | 1 | 1 | 28 | 1 |
| 10 ondoden | 700 | 60.915 | 434 | 26 | 10 | 10 | 28 | 1 |
| 18 ondoden | 805 | 69.599 | 435 | 26 | 18 | 18 | 28 | 1 |
| 18 + snel schieten | 851 | 69.887 | 439 | 28 | 18 | 18 | 28 | 1 |

**Herleide kost per ondode:** tussen 1→10 ondoden: (700−585)/9 ≈ **12,8 draw
calls/ondode**; tussen 10→18: (805−700)/8 ≈ **13,1 draw calls/ondode**. Zeer
consistent, en bevestigt de "~13 draw calls per zombie"-aanname uit de
ronde-9-architectuur nu ook op scenario-niveau (niet alleen uit de
structuurtelling van één ondode). Bij `effectiefMaxActief()`'s praktische
piek van 18 is dat **tot ~234 zombie-draw-calls bovenop de rest van de
scene** (585 basis + 17×13 ≈ 806, wat nauwkeurig overeenkomt met de 805
gemeten voor 18 ondoden).

Schieten (scenario 4) voegt +46 draw calls / +288 driehoeken toe t.o.v.
scenario 3 — tracers, inslag-deeltjes en de mondingsvlam, geen
zombie-gerelateerde stijging.

**Lichten (28, waarvan 1 schaduwwerpend) en geometrieën/texturen blijven
overal binnen de verwachte marge** — geen enkel scenario voegt een licht toe
(bevestigt de §10.2-invariant die de hele ronde 9 bewaakt) en de
geometrie-/textuurtelling stijgt nauwelijks (434→439), wat past bij "N
ondoden delen dezelfde 8 basisgeometrieën" (T69).

### FPS / gemiddelde frametijd / p95

**Niet betrouwbaar meetbaar in deze omgeving** (headless Playwright op
SwiftShader-softwarerendering, §10.3/§8.11). Dit is precies waarom de
F3-overlay is gebouwd: open het spel in een echte browser
(`python3 -m http.server 8000`, zelfde procedure als T88/T91/T110), druk
F3, en laat de vier scenario's hierboven na met echte ondoden (`spawnOndode`
via de debug-console, of gewoon spelen tot golf 7-9 voor 18 actieve
ondoden). Noteer FPS/gemiddelde frametijd/p95 rechtstreeks uit het overlay
— dat is de ontbrekende regel in deze tabel, en de reden dat dit ticket
geen enkel frametijd-getal verzint.

### Vertexen (ter volledigheid)

Niet apart gemeten — Three.js' `renderer.info` rapporteert geen aparte
vertex-telling los van driehoeken voor niet-geïndexeerde/geïndexeerde
geometrie op een consistente manier; driehoeken (hierboven) is het
betrouwbare, al overal in dit project gebruikte kental (zie T88, T116).

## Zombie V2

*(De volledige vier-scenario-vergelijking (renderer.info per scenario, zoals
de V1-tabellen hierboven) komt pas uit Ticket 129's eindrapport, ná fase 1-6
van ronde 9 — animatie/hitdetectie/varianten bestaan voor V2 dan nog niet.
Wat hieronder staat is uitsluitend Ticket 118's eigen acceptatiecriterium:
"meshes/materialen/geometrieën per V2-ondode gemeten en naast de
T117-baseline gezet".)*

### Structuur per V2-ondode (Ticket 118, `type: 'normaal'`)

| | V1 (T117-baseline) | V2 (dit ticket) |
| --- | --- | --- |
| Meshes | 11-13 | **3** (1 SkinnedMesh + 2 oogjes) |
| Materialen | tot 11 | **2** (1 huid + 1 oog) |
| Geometrieën | 8 (gedeeld via geoCache) | **2** (1 samengestelde SkinnedMesh-geometrie, per instantie; 1 gedeelde oog-sphere) |
| Transformnodes | 20 | 13 (groep + skinnedMesh + root-bot + 8 botten [Ticket 119: + pelvis/chest] + 2 oogjes) |
| Raycast-targets | 13 | 3 |

Geen renderer.info-scenariometing hier: zonder animatie (T119)/hitdetectie op
botten (T120) zou een "18 V2-ondoden actief"-scenario nog geen eerlijke
vergelijking met V1's golf-gedrag zijn — dat is precies waarom die volledige
vergelijking pas in T129 landt. De structuurtelling hierboven staat wel al
vast: van tot 13 draw calls/materialen naar 3, ruim binnen de "~1-2 draw
calls per zombie"-belofte uit de ronde-9-architectuur (de 2 losse oogjes
zijn de enige overgebleven per-ondode meshes buiten de ene SkinnedMesh).

## Herkomst van de metingen

- `tests/meet-zombie-v1-baseline.mjs` — het script zelf, herbruikbaar zodra
  Zombie V2 bestaat (met de V1/V2-toggle uit Ticket 118 kan hetzelfde
  script straks ook tegen V2 draaien voor een directe vergelijking).
- De F3-overlay-implementatie: `amsterdam-undead.html`, het blok direct na
  `composer.addPass(new OutputPass());` ("TICKET 117"-commentaarblok).
- `tests/test-perf-overlay.mjs` — regressiedekking voor de overlay zelf
  (standaard uit/onzichtbaar, F3 toggelt 'm, alle velden aanwezig,
  `renderer.info.autoReset` correct beheerd, geen wijziging aan
  `maakOndodeModel()`/`spawnOndode()`/de hitbox-markering).
