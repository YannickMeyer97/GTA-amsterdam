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

### Fase 4 (T121–T123): anatomie, materiaal en de normal-map-A/B

| | T118-basis | na T121 | na T122 | na T123 |
| --- | --- | --- | --- | --- |
| Zichtbare meshes (= draw calls) | 3 | 3 | **1** (Brander 2) | 1 |
| Materialen | 2 | 2 | **1** (+ gedeeld kernMateriaal) | 1 |
| Driehoeken/ondode | 1.144 | 2.324 | 1.988 | 1.988 |
| Texturen (scene, 18 ondoden) | — | — | 44 | **45** |

**T121 — triangle-budget, gekozen met de meetlat.** Beide onderzoeksvarianten
zijn echt gebouwd en gefotografeerd, waarna de pixelverschillen zijn geteld
met `tests/vergelijk-opnamen.mjs` (close-up = 1,15 m ≈ meleeafstand,
speelafstand = 8,7 m ≈ de overkant van een kamer):

| Vergelijking | Close-up | Speelafstand | Driehoeken |
| --- | --- | --- | --- |
| T118-basis → `laag` | ~9,8 % pixels anders | — | 1.144 → 2.324 |
| `laag` → `midden` | 1,4 % | **0,11 %** | 2.324 → 4.668 |

De ticket-regel is "verhoog alleen als het verschil op scherm aantoonbaar is
(close-up **ÉN** op speelafstand)". Die EN-voorwaarde haalt `midden` niet:
0,11 % op speelafstand is niet waarneembaar, terwijl het budget verdubbelt
(bij 18 ondoden ~42.000 extra driehoeken per frame). **Gekozen: `laag`**
(~2.320 driehoeken). De winst van dit ticket zit dus in de VORM, niet in de
tessellatie — bijna 10 % beeldverandering bij de eerste stap, nog geen
1,5 % bij de tweede. `midden` blijft schakelbaar via
`zetZombieV2Detail('midden')` zodat deze afweging later opnieuw te maken is.

**T122 — de "1 draw call"-belofte gehaald.** De ogen zijn van twee losse
mesh-objecten naar een emissieve REGIO in het lichaamsmateriaal verhuisd,
bepaald in de fragment-shader op basis van de rustpose-coördinaat. Bewust
géén vertex-attribuut-masker: een oog is ~3 cm breed terwijl de vertexafstand
op het hoofd ~5,7 cm is, dus een vertexmasker zou het oog niet eens kunnen
opvangen. `delen.oogMateriaal` is nu een facade met één levende property
(`emissiveIntensity`), zodat het complete T31-contract ongewijzigd blijft
werken. De Brander-kern blijft een losse mesh (2 draw calls) — dat is de
gedocumenteerde uitzondering, omdat `raakOndode()` die onafhankelijk moet
kunnen schalen en een regio binnen één SkinnedMesh dat niet toelaat.

**T123 — normal map: A/B gemeten, en één keer teruggestuurd.**

| | A (zonder) | B (met) |
| --- | --- | --- |
| Draw calls (18 ondoden) | 636 | 636 |
| Driehoeken | 83.229 | 83.229 |
| Geometrieën | 477 | 477 |
| Texturen | 44 | **45** |
| Pixelverschil t.o.v. A | — | 2,4 % close-up / 2,3 % bij 18 ondoden |

De eerste versie van de hoogtekaart tekende de huidplooien horizontaal plus
zeven evenwijdige "ribben"-bogen. Op papier klopte dat (§18 noemt ribben
expliciet), maar romp/armen/benen krijgen hun uv **cilindrisch** — u is de
hoek rondom — dus elke horizontale lijn werd een band die helemaal om het
lichaam heen loopt: de zombies lazen als mummies in zwachtels. Opgelost door
de plooien willekeurig te oriënteren en de ribben te schrappen (die horen uit
GEOMETRIE te komen, en T121's ribbenkastprofiel doet dat al), plus de sterkte
van 0,55 naar 0,28. **Behouden**: de structurele kosten zijn precies één
gedeelde textuur, nul extra draw calls en nul extra driehoeken.

### Fase 5 (T124–T126): types en variatieprofielen

Vóór deze fase negeerde `maakOndodeModelV2()` `typeInfo.vorm` en `traits`
volledig: alle vijf types waren identiek op huid-/oogkleur na. Nu verwerkt V2
exact dezelfde brondata als V1 (`ONDODE_TYPES[..].vorm`,
`VARIATIE_PROFIELEN`, `kiesOndodeTraits()`) — met dezelfde getallen en
formules, alleen anders TOEGEPAST.

De kernsplitsing die de architectuur afdwingt:

- **Vorm → geometrie** (rompbreedte, bochel, buik, armlengte/-dikte,
  ontbrekende arm). Dit moet vóór het samenvoegen gebeuren, want het zijn
  vertexposities.
- **Houding → bot-transform ná `skinnedMesh.bind()`** (kromme rug, ingedoken
  kop, slepend been, scheve nek). Cruciaal: `bind()` legt de dan geldende
  botstanden vast ALS rustpose, dus alles wat je ervóór op een bot zet is per
  definitie onzichtbaar. Dit is dezelfde valkuil die bij T118 de hele
  rustpose verkeerd zette.

Twee afgeleide beslissingen:

- **Bochel als vertexregio, niet als losse mesh.** T124 vraagt dit expliciet
  te toetsen. Anders dan de Brander-kern (die `raakOndode()` onafhankelijk
  moet kunnen schalen voor de kernpuls) heeft de bochel geen eigen animatie —
  hij hoeft alleen met de bovenrug mee te bewegen, en dat doet hij vanzelf
  als hij aan het `chest`-bot hangt. Dus gewoon extra driehoeken in dezelfde
  geometrie, en het draw-call-budget uit T122 blijft staan: **1 per ondode,
  2 voor de Brander**.
- **Sluiper-"leesbare ogen" via de oogREGIO, niet via `emissiveIntensity`.**
  Het ticket stelt een hogere basisintensiteit voor, maar die waarde is
  per-ondode gameplay-state die `updateOndoden()`/`zetOogBasis()` elke tick
  terugzetten naar `ondode.oogBasisIntensiteit` — een bump daar zou stil weer
  verdwijnen én de T89-emissiehiërarchie vertroebelen. De regiogrootte
  (1,35x) is puur shadergeometrie en raakt geen enkele state.

`delen.vormParams` is nieuw en bestaat puur voor toetsbaarheid: de toegepaste
rompbreedte/rughoek/armdikte zijn niet uit de samengestelde geometrie terug
te meten, want een bounding box wordt door de ARMEN bepaald (x = ±0,30), niet
door de romp — een eerste testversie viel precies in die val.

Gameplay-invariant: alle bestaande V1-asserts in `test-varianten.mjs` draaien
ongewijzigd door, plus expliciete diff-checks dat `ONDODE_TYPES.loper/
.sjouwer/.brander/.sluiper` letterlijk niet zijn aangeraakt. Dát is het
bewijs dat deze fase uitsluitend cosmetisch is.

**Frametijd/p95 ontbreken hier bewust** — niet betrouwbaar meetbaar in
headless SwiftShader (§10.3/§8.11), exact dezelfde reden als bij de
V1-baseline hierboven. De F3-overlay is het instrument om die in een echte
browser alsnog te meten.

Geen renderer.info-scenariometing hier: zonder animatie (T119)/hitdetectie op
botten (T120) zou een "18 V2-ondoden actief"-scenario nog geen eerlijke
vergelijking met V1's golf-gedrag zijn — dat is precies waarom die volledige
vergelijking pas in T129 landt. De structuurtelling hierboven staat wel al
vast: van tot 13 draw calls/materialen naar 3, ruim binnen de "~1-2 draw
calls per zombie"-belofte uit de ronde-9-architectuur (de 2 losse oogjes
zijn de enige overgebleven per-ondode meshes buiten de ene SkinnedMesh).

## Eindrapport (Ticket 127)

Gemeten met `tests/meet-zombie-v2-benchmark.mjs`: de zeven scenario's uit §35,
elk paarsgewijs voor V1 en V2 met dezelfde camera, posities, types,
verlichting, pixelRatio, postprocessing en dezelfde seeded loting — alleen
`ZOMBIE_RENDER_VERSIE` verschilt. Opgewarmd met 6 frames vóór elke meting
(shaders compileren pas bij de eerste echte render).

### Structuur per ondode

| | V1 | V2 |
| --- | --- | --- |
| Meshes | 13 | 3 |
| **Zichtbare meshes (= draw calls)** | **13** | **1** (Brander 2) |
| Materialen | 11 | 2 (1 huid + 1 gedeeld hitbox-materiaal) |
| Geometrieën | 8 (gedeeld via `geoCache`) | 3 (1 uniek samengesteld + 2 gedeelde proxies) |
| Transformnodes | 20 | 13 |
| Botten | 0 (Group-pivots) | 9 |
| **Raycast-doelen** | **13** (elke zichtbare mesh) | **2** (alleen de onzichtbare proxies) |

### Benchmark — zeven scenario's

| Scenario | Draw calls V1 → V2 | Driehoeken V1 → V2 |
| --- | --- | --- |
| 1. 1 ondode dichtbij | 640 → 628 (−1,9 %) | 51.443 → 52.285 (+1,6 %) |
| 2. 10 ondoden | 760 → 639 (−15,9 %) | 62.773 → 69.751 (+11,1 %) |
| 3. 18 ondoden | 866 → 648 (−25,2 %) | 72.253 → 84.445 (+16,9 %) |
| 4. 18 + snel schieten | 915 → 697 (−23,8 %) | 72.797 → 84.989 (+16,7 %) |
| 5. 18 in binnenomgeving | 833 → 615 (−26,2 %) | 68.089 → 80.281 (+17,9 %) |
| 6. Zware binnenplaats (lichtkegels) | 434 → 287 (−33,9 %) | 41.273 → 49.911 (+20,9 %) |
| 7. Zware gracht (levend water) | 359 → 212 (−40,9 %) | 41.497 → 50.135 (+20,8 %) |

Lichten blijven in élk scenario 28 (de §10.2-invariant houdt).

**FPS / gemiddelde frametijd / p95 ontbreken — bewust.** Niet betrouwbaar
meetbaar in headless SwiftShader (§10.3/§8.11). De bronopdracht verbiedt zelf
het verzinnen van performancecijfers; een geschat getal zou hier erger zijn
dan een ontbrekend getal. De F3-overlay (T117) is het instrument om deze drie
in een echte browser alsnog te meten, met exact dezelfde zeven scenario's.

### CPU — wat is goedkoper geworden

- **Draw calls: 13 → 1 per ondode.** Bij 18 gelijktijdige ondoden scheelt dat
  ~216 calls per frame. De winst schaalt lineair met het aantal ondoden en is
  daarom het grootst in precies de scenario's die er het meest toe doen (3–5)
  en relatief het grootst in de dunbevolkte scenario's (6–7), waar de ondoden
  een groter deel van het totaal uitmaken.
- **Raycast-doelen: 13 → 2.** `schiet()` doorzoekt per ondode nog twee
  eenvoudige primitieven i.p.v. dertien getrianguleerde meshes.
- **Materiaalinstanties: 11 → 2**, dus minder GL-state-switches per ondode.
- **Transformnodes: 20 → 13**, iets minder matrixwerk per frame.

### GPU — wat is duurder geworden

- **Driehoeken: +11 % tot +21 %** (1.054 → 1.988 per ondode). Dat is de prijs
  van de anatomie uit T121 en is bewust laag gehouden: de gemeten afweging
  wees het dubbele budget ('midden', 4.668) af omdat het op speelafstand maar
  0,11 % van de pixels veranderde.
- **+1 gedeelde textuur** (de normal map uit T123), gedeeld door alle ondoden.
  *Let op:* de textuurteller in de scenariometing hierboven is géén schone
  delta — V1 en V2 worden na elkaar in dezelfde pagina gemeten, dus die kolom
  is besmet door volgorde. De gezaghebbende cijfers zijn T123's geïsoleerde
  A/B (44 → 45) en de lektest hieronder (0 groei).
- **Skinning** verplaatst het poseren van CPU-matrices naar de vertex-shader.
  Netto-effect niet los meetbaar in deze omgeving.

### Resources

60 spawn/kill-cycli over alle vijf types, valanimaties volledig afgelopen:

| | Geometrieën vóór → na | Texturen vóór → na |
| --- | --- | --- |
| V1 | 566 → 566 (**0**) | 30 → 30 (**0**) |
| V2 | 566 → 566 (**0**) | 30 → 30 (**0**) |

Geen geheugenlek in beide versies. `ruimGroepOp()` is in T118 uitgebreid met
`skeleton.dispose()`; die toevoeging is hiermee ook op schaal bevestigd.

### Visuele verbetering

Anatomisch hoofd (schedel, kaak, jukbeenderen, oogkassen), geloofwaardige
schouderlijn/ribbenkast/taille, onderscheid boven-/onderarm en dij/knie/kuit,
voeten, huidstructuur via normal map, en vijf types die op speelafstand
onmiddellijk uit elkaar te houden zijn. Beeldbewijs: `tests/beeldverslag/`
(`fase4-closeup.png`, `fase4-groep.png`, `fase5-types.png`,
`fase5-profielen.png`).

### Performancekosten per visuele feature

| Feature | Classificatie | Onderbouwing |
| --- | --- | --- |
| Eén samengestelde SkinnedMesh (T118) | **Winst** | −12 draw calls/ondode |
| Pelvis/chest-sway (T119) | **Vrijwel gratis** | 2 extra botten, 2 rotatie-writes/frame |
| Hitbox-proxies (T120) | **Winst** | 13 → 2 raycast-doelen |
| Anatomie (T121, 'laag') | **Merkbaar** | +934 driehoeken/ondode |
| Anatomie 'midden' (T121) | **Bewust afgewezen** | +101 % driehoeken voor 0,11 % pixels op speelafstand |
| Ogen in de shader (T122) | **Winst** | −2 draw calls/ondode |
| Brander-kern als losse mesh (T122) | **Goedkoop, beargumenteerd** | +1 draw call, alleen voor dit type; nodig voor de kernpuls-schaal |
| Normal map (T123) | **Goedkoop** | +1 gedeelde textuur, 0 draw calls, 0 driehoeken |
| Normal map op 0,55 sterkte (T123) | **Bewust afgewezen** | las als mummiezwachtels door cilindrische uv |
| Bochel als vertexregio (T124) | **Vrijwel gratis** | driehoeken i.p.v. een extra object |

### Conclusie

**Is V2 sneller, gelijk of langzamer dan V1?** Op de betrouwbaar meetbare
assen duidelijk goedkoper: 25–41 % minder draw calls in elk scenario met
meerdere ondoden, en 85 % minder raycast-doelen. Daar staat 11–21 % meer
driehoeken tegenover. Deze scene is volgens §10.3 fragment-bound, niet
draw-call-bound, dus de doorslaggevende frametijdmeting moet in een echte
browser gebeuren — en die kan dit rapport niet leveren.

**Is V2 duidelijk mooier?** Ja, en dat is met beeld én pixelmetingen
onderbouwd, niet met een mening.

**Is de gameplay ongewijzigd?** Ja. `ONDODE_TYPES` is met diff-checks
vastgelegd als onaangeraakt, alle bestaande balans-/timing-tests draaien
ongewijzigd, en de hitbox-matrix uit T120 dekt zes bewegingsstaten.

**Aanbeveling: V2 kan V1 vervangen — met één voorbehoud.** Alle
acceptatiecriteria die in deze omgeving toetsbaar zijn, zijn gehaald. Maar
§5's interpretatieregels draaien om frametijd, en juist die is hier niet
meetbaar. **De eigenaar moet de F3-overlay in een echte browser draaien op
scenario 3 en 5 vóór T129 (V1 verwijderen) wordt uitgevoerd** — dat is de
onomkeerbare stap, en die hoort niet op een meting te leunen die dit rapport
expliciet niet heeft kunnen doen. Zolang de frametijd daar gelijk of beter
is, is de aanbeveling: doorgaan naar T129.

## Naar aanleiding van speeltest (na T127, vóór T129)

De eigenaar heeft de F3-overlay in een echte browser gedraaid (het
voorbehoud hierboven) en gaf daarnaast twee stukken kwalitatieve feedback
die geen van beide met frametijd te maken hebben: V2 beweegt merkbaar
minder goed dan V1, en de huidverval-normal-map (T123) is te onopvallend en
leest als mummie in plaats van zombie. Beide zijn onderzocht en gefixt,
buiten de tickets 118-128 om (geen van beide raakt V1):

**1. Romp-bob/twist bewoog nauwelijks mee (skin-weight-demping).** V1's
`romp`-Group is ouder van torso+schouders+bochel+buik+vod, dus de loop-bob
en de lichaamstreffer-twist bewegen daar de hele torsomassa rigide mee. V2's
torso is over drie PLATTE botten (pelvis/romp/chest) met skin-weight-
blending verdeeld (T121); de bob/twist-writes gingen nog uitsluitend naar
`romp`. Gemeten (`scratchpad/meet-romp-gewicht-profiel.mjs`): van V1's volle
bob-hoogte (~0,80-1,41 m) kreeg maar een band van 6 cm (1,08-1,14 m) het
volle effect. Fix: pelvis/chest krijgen nu DEZELFDE Y-offset/twist als romp
— lineaire skinning blendt bot-transforms gewogen, dus gedeelde beweging
valt bij gelijke waarden weg uit de weging (w_p+w_r+w_c=1) en de hele torso
bobt/twist weer als geheel. De bestaande, verschillende pelvis-/chest-sway
(T119, rotation.z) blijft intact.

**2. Armen leken soms los van de romp te staan.** Zelfde onderliggende
oorzaak: de schouderzone van de rompmesh hangt vrijwel volledig aan `chest`
(wChest≈1 daar), maar `armL`/`armR` zijn eigen botten die nooit met chest
meebewogen — dus zodra chest ging swayen/bobben (punt 1 hierboven maakte dit
zichtbaarder) trok het schoudervlak zichtbaar los van de arm. Fix: armen
mirroren nu chest se sway (rotation.z), bob (position.y) en lichaams-
treffer-twist (rotation.y), op andere assen dan hun eigen swing
(rotation.x) — geen conflict. Geverifieerd met exacte waarde-vergelijking
(chest/armL/armR identiek per frame), niet alleen visueel.

**2b. Vervolg (nieuwe screenshots van de eigenaar, na 2): het gat was er nog
steeds, tijdens het lopen.** Deze fix loste alleen de DYNAMISCHE desync op
(chest die wegzwaait terwijl de arm stilstaat); er bleek daarnaast een
STATISCHE geometrie-oorzaak te zijn. Het schoudergewricht (V2_ARM_PROFIEL,
t=0,00) had straal 0,058 — kleiner dan de deltoïde eronder (0,067) — en de
arm draait tijdens de loopcyclus om die pivot, die in rust maar ~2 cm van
het rompoppervlak zit. Bij een naar-achteren-swing draait die kleine ring
zichtbaar los van de romp (bevestigd met renders op loopFase = ±π/2: gat in
de ene swing-richting, geen gat in de andere — precies wat een te kleine,
ronddraaiende ring geeft). V1 had dit niet: zijn schouderblok (T99) is een
STILSTAAND object dat nooit met de arm meedraait, dus altijd overlapt; V2
heeft zoiets niet. Fix: het schoudergewricht vergroot van 0,058/0,056 naar
0,085/0,080 (rx/rz) — groot genoeg om bij beide swing-uitersten in het
rompoppervlak te blijven steken. Eerst op 0,095 geprobeerd (sloot het gat
volledig) maar dat gaf een nieuw, kleiner artefact (een bultje bij de nek,
omdat de vergrote ring ook verder omhoog/achterom uitsteekt); 0,085 is het
best geteste compromis — getest op beide swing-uitersten EN het 'mager'-
profiel (dunnere armen via armDikteFactor, dus het smalste geval). Puur
cosmetisch (raycasting loopt via de aparte T120-hitbox-proxies, niet via
deze mesh), geen enkele test raakt deze radii.

**3. Huidverval leest als mummie, niet als zombie.** De T123-tekenaar loste
de letterlijke zwachtelbanden op maar bleef qua KARAKTER een geweven
textuur (veel kleine, dunne, gelijkmatig verspreide tekens). Fix, na een
optiemenu met de eigenaar doorgenomen: een paar grote onregelmatige
necroseplekken i.p.v. alleen kleine lijntjes, clusterpunten waar plooien/
scheuren zich omheen verdichten, hardere/gerafelde gapingen (was: nette
littekens), en `V2_NORMAAL_STERKTE` 0,28 → 0,4. Aanvullend: vertex-color
rottingsvlekken (optie 6) — ECHTE kleurverschuiving (R relatief minder
onderdrukt dan G/B), niet alleen helderheid, via een nieuwe `{r,g,b}`-vorm
die de tint-functie in `bouwOndodeGeometrieV2()` nu ook mag teruggeven.
Bewust GEEN bloedrood: vertex colors zijn een vermenigvuldiging op de
basismateriaalkleur (die al donker/arm-aan-rood is), dus kan alleen
donkerder maken — geverifieerd met een preview-render vóór dit in de
modelopbouw kwam. Echt rood zou een nieuw emissief kanaal nodig hebben
(zoals de ogen), en dat is een grotere beslissing dan deze fix (nieuwe
categorie in T89's emissiehiërarchie) — bewust niet stilzwijgend toegevoegd.

**4. Loopcyclus oogt houterig.** V2's benen zijn platte, enkelvoudige botten
zonder knie (T119's platte-structuur-eis staat geen aparte knie-keten toe)
— een volledig stijf been dat als een pendel door de lucht zwaait is een
klassieke "houten speelgoedsoldaat"-tell, los van hoe vloeiend de fase zelf
al was. Fix zonder nieuwe botten: `delen.beenL/beenR.scale.y` verkort tot
16% tijdens de zwaaihelft van elk been se eigen cyclus (voet deelt hetzelfde
bot, komt dus vanzelf mee omhoog) en strekt weer bij het neerzetten.
Bend-formule `Math.max(0, ±Math.cos(loopFase))`: cos is de hoeksnelheid van
faseL (afgeleide van sin), piekt precies wanneer het been door het midden
zwaait (snelste beweging = hoogste optil) en is 0 bij beide uitersten
(hiel-neer/afzet) — exact waar een echte knie ook gestrekt zou zijn. Been R
in tegenfase (teken keert om), dus nooit beide benen tegelijk gebogen.
Geverifieerd met close-up renders op beide fases (π/2 en 0): bij de
uitersten beide benen gelijke lengte (normale wijde pas), bij het midden
zichtbaar één been korter/opgetild — leest als een stap, niet als hurken.
V2-only (`if (delen.pelvis)`), dus V1's beenanimatie letterlijk ongewijzigd.

**4b. Vervolg (op verzoek): zelfde illusie op de armen.** Arm L zwaait in
tegenfase t.o.v. been L (dus IN fase met been R) — dezelfde piek-formule van
been R hergebruikt voor arm L se elleboog, en omgekeerd voor arm R/been L.
Geverifieerd: op loopFase=0 bogen armR (0,87) én beenL (0,84) samen, op
loopFase=π andersom (armL/beenR) — bevestigt de kruislingse, contralaterale
koppeling die een natuurlijke pas ook heeft (rechterarm mee met linkerbeen).
Factor iets subtieler dan de knie (0,13 i.p.v. 0,16): een arm die zichtbaar
verkort én de hand meesleept oogt sneller overdreven dan een been.

**Losstaand, geen bug:** de eigenaar meldde na deze fix ook "benen staan
soms schuin onder het lichaam" — dat bleek het bestaande `slepend`-trait
(één been sleept, `rotation.z = traits.slepend * 0,14`, ongewijzigd
overgenomen van V1) en niet iets dat de knie-buig-fix veroorzaakte:
dezelfde render met `slepend: 0` toont op alle geteste fases rechte,
niet-schuine benen; pas met `slepend: 1` verschijnt de kanteling, identiek
op beide versies. Bestaande, bedoelde variatie tussen ondoden — geen actie
ondernomen.

Alle vijf: puur additief, gated op `delen.pelvis`/`delen.chest`/V2-only
constructie, dus V1 blijft volledig ongewijzigd. Regressiesuite opnieuw
gedraaid ná elke fix: 80-81/84 groen (de rest is het al langer bekende
CPU-contentie-flaky-setje: texturenset/normal-maps-perfbudget,
hitmarker-audio/omgeving-sfeer-timing — zie de HERKANSING-set in
`run-all.mjs`), geen van de fixes voegde een nieuwe faalcategorie toe.

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
