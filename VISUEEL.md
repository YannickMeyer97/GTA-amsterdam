# VISUEEL.md — Hoe Amsterdam Undead visueel echt mooi wordt

Analyse en richtingen door een technical-artist-bril. Dit document bouwt
niets: het beschrijft wat er nu op het scherm staat, waarom dat er zo
uitziet, en welke visuele richtingen er open liggen binnen de harde kaders
van dit project (één HTML-bestand, geen buildstap, geen externe assets,
Three.js r160 via CDN, 60fps tijdens een volle golf).

Het gaat over `amsterdam-undead.html` (de brief noemt het bestand
`amsterdamundead.html`; de echte naam heeft een koppelteken). Alle
regelverwijzingen en getallen komen uit de huidige `main`, 9.384 regels.

**Leeswijzer.** Stap 1 is de nulmeting: wat er is, met code-verwijzingen en
gemeten cijfers. Stap 2 zijn 47 richtingen over negen gebieden, elk in een
vast format. Stap 3 is de synthese: welke richtingen samen een identiteit
vormen, wat ik eerst zou doen, en wat ik bewust niet zou doen.

---

# Stap 1 — Het huidige beeld

## 1.1 Rendering-pipeline

De hele pipeline staat tussen regel 594 en 672, in één blok.

```
WebGLRenderer({ antialias: true })
setPixelRatio(Math.min(devicePixelRatio, 2))
shadowMap.enabled = true, type = PCFSoftShadowMap
outputColorSpace = SRGBColorSpace
toneMapping = ACESFilmicToneMapping, toneMappingExposure = 1.0
```

De camera is een `PerspectiveCamera(70, aspect, 0.1, 50)` met
`rotation.order = 'YXZ'`. Die far-plane van 50 is belangrijk voor later:
de wereld is fysiek klein genoeg dat 50 meter ruim voldoende is, dus er is
geen enkele geometrie "in de verte" — alles wat je ziet staat binnen 50 m.

De composer heeft drie passes:

```js
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.82);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
```

De bloom draait bewust op een interne resolutie van 256×256 in plaats van
schermresolutie — het commentaar bij die regel legt uit waarom: de
UnrealBloom-mipchain is vijf niveaus diep, dus tot ~10 extra full-screen
passes, en gloed heeft geen scherpe resolutie nodig. De threshold van 0,82
is hoog: alleen de echt felle emissieve elementen (lampbollen, ogen,
winkelaccenten) halen de drempel. De rest van het beeld gaat er ongemoeid
doorheen.

`OutputPass` staat er omdat de composer anders de sRGB/ACES-conversie zou
overslaan; zonder die pass zou het hele beeld verkeerd gegradeerd zijn.

**Wat dit betekent voor het uiterlijk.** ACES + exposure 1,0 op een scene
die grotendeels bijna-zwart is, geeft een zachte, licht ontzadigde
schaduwrol. Dat is goed voor de sfeer, maar het betekent ook dat de
donkere delen zeer weinig kleurinformatie dragen: waar geen lamp is, is het
niet donkerblauw of donkerbruin, het is bijna letterlijk `0x060a0e`. Dat is
het belangrijkste visuele feit van dit spel.

## 1.2 Licht

Er zijn **28 lichtobjecten** in de scene: 1 `HemisphereLight` en 27
`PointLight`s. Geen `DirectionalLight`, geen `SpotLight`, geen IBL.

| Licht | Kleur | Intensiteit | Waar | Regel |
| --- | --- | --- | --- | --- |
| `hemisfeerLicht` | `0x2b3a54` / `0x201811` | 1.5 (`HEMISFEER_BASIS`) | globaal | 665 |
| `hangLamp(-1.8,-3,true)` | `0xffb877` | 16 (`LAMP_INTENSITEIT`) | startkamer — **enige schaduwwerper** | 2280 |
| `hangLamp(1.8, 2.2)` | idem | 16 | startkamer | 2313 |
| `maanlicht` | `0xc8ddff` | 28.8 | binnenplaats | 1687 |
| `maanlichtDeur` | `0xc8ddff` | 20.4 | bij deur 2 | 1693 |
| `plaatsVulling` | `0x8fb8e8` | 13.2 | binnenplaats-vulling | 1698 |
| 4× lantaarn (`bouwLantaarn`) | `0xffd6a0` | 20.4 elk | binnenplaats | 1724 |
| `grachtLantaarnLicht` | `0xffd6a0` | 34 | vlonder | 2100 |
| `bootLicht` | `0xffd6a0` | 9 | kind van `bootGroep` | 2074 |
| 4× dakraamlicht | `0xaacdf0` | 10.8–13.2 | atelier + nis | 2657–2706 |
| kelderlampen | warm | — | kelder | 2531 |
| vliering-traplamp | `0xffb877` | 6 | vlieringtrap | 1479 |
| `winkelLicht`, `koolLicht` | `0xff7a3d` e.a. | — | Smederij/koopplekken | 3313, 3458 |
| `vlamLichtDrukspuit` / Ratelaar | `0x9fffb8` / `0xffcf8a` | 1.1 | mondingsvlam, `visible=false` | 3986, 4075 |
| powerup-gloed, brander-explosie | — | — | tijdelijk | 5299, 6818 |

**De één-schaduw-regel.** Alleen `hangLamp(-1.8, -3, true)` heeft
`castShadow = true`, met `licht.shadow.mapSize.set(256, 256)`. Dat is een
`PointLight`, dus een cube shadow map: zes render-passes van 256×256 per
frame. ARCHITECTURE_NOTES §7.9 legt dit vast als invariant, en §7.9.1
documenteert waarom de resolutie van 512 naar 256 ging: een
voor/na-pixelmeting liet zien dat deze schaduw sowieso wegvalt tegen de
overige 27 lichten — maximaal 12/255 pixelverschil met schaduw volledig uit.

Dat laatste is het meest onderbelichte feit in het hele dossier. **De enige
echte schaduw in dit spel is visueel bijna onzichtbaar.** Niet omdat hij
slecht is, maar omdat er zo veel schaduwloze puntlichten omheen staan dat
elk oppervlak van drie kanten wordt aangelicht. Er is dus geen
schaduwbudget-probleem — er is een schaduw-*aanwezigheids*-probleem.

**Dynamiek die er al is.** Drie onafhankelijke systemen:

- `lampLichten[]` — elke `hangLamp` pusht `{ licht, bolMateriaal,
  bolEmissiefBasis, basis, fase, amp1, amp2, minFactor }`. De gameLoop
  moduleert intensiteit met twee sinussen (flikkeren) plus `lampDipFactor`
  (een dip bij golfstart, `startGolf()` zet 'm op 0,6).
- `buitenLichten[]` — maanlicht, lantaarns, bootlamp. Dimmen mee tijdens
  Stroomuitval maar met een eigen, hogere vloer (`BUITEN_STROOM_VLOER =
  0.5`) zodat buiten leesbaar blijft.
- `stroomGevoeligeDaklichten[]` — de vier dakramen.

Tijdens een Stroomuitval-eventgolf zakken `stroomFactor`,
`HEMISFEER_STROOM_VLOER` (0.35) en `toneMappingExposure`
(`EXPOSURE_BASIS` 1.0 → `EXPOSURE_STROOM_VLOER` 0.4) samen. Dat de
tonemapping-exposure zelf een gameplaydimensie is, is een sterke keuze die
in Stap 2/G verder uitgebaat kan worden.

## 1.3 Materialen

**285 unieke materiaal-instanties** in de scene, verdeeld over twee caches
en een lange staart van losse instanties.

`mat(kleur, ruwheid, metaal, extra)` (regel 699) cachet op
`` `${kleur}|${ruwheid}|${metaal}` ``. Belangrijk contract: **zodra `extra`
niet leeg is, wordt de cache overgeslagen en krijg je een unieke
instantie.** Elk gedeeld materiaal krijgt `userData.gedeeld = true` zodat
`ruimGroepOp()` (T70) het nooit dispose't.

`matFamilie(naam, kleur)` (regel 822) cachet op `familienaam|kleur` over:

```js
const MATERIAAL_FAMILIES = {
  hout:     { ruwheid: 0.75, metaal: 0.05, textuur: 'hout' },
  steen:    { ruwheid: 0.9,  metaal: 0,    textuur: 'steen' },
  tegel:    { ruwheid: 0.55, metaal: 0.05 },
  metaal:   { ruwheid: 0.35, metaal: 0.65, textuur: 'metaal' },
  natSteen: { ruwheid: 0.32, metaal: 0.12 },
};
```

`bouwCanvasTextuur(patroon, tekenFn, 128)` genereert 128×128 canvas-
texturen met `RepeatWrapping` en `repeat.set(4, 4)`, en die worden
**uitsluitend als `roughnessMap` toegepast, nooit als `map`**. De
tekenaars in `CANVAS_TEXTUUR_TEKENAARS` vullen eerst bijna-wit (`#e8e8e8`)
en tekenen daarna laag-contrast ruis, houtnerf of geborsteld metaal. Dat is
een bewuste, gedocumenteerde keuze (§7.3): de basiskleur van elk oppervlak
blijft exact hetzelfde, alleen de lokale ruwheid varieert subtiel.

**Dit is precies waar het huidige beeld vastloopt.** Een `roughnessMap`
rond wit op een `MeshStandardMaterial` in een scene met veel zwakke
puntlichten geeft bijna geen zichtbaar signaal. Er is geen `map`, geen
`normalMap`, geen `aoMap`, geen `envMap`. `renderer.info.memory.textures`
telt 16 texturen, waarvan de meeste UI/naambordjes zijn — er zijn maar drie
oppervlaktetexturen in het hele spel, en die zijn nauwelijks zichtbaar.

`PALET` (regel 720) groepeert gevelkleuren, raamgloed en straattinten onder
semantische namen. Het is bewust beperkt tot de gevel-/straatdecor-
call-sites van T58; de rest van het spel gebruikt nog losse hex-waarden.
`PALET` is dus vandaag meer een intentieverklaring dan een systeem.

## 1.4 Geometrie

Drie bouwstenen doen bijna al het werk:

- `blok(breedte, hoogte, diepte, kleur, ruwheid, metaal)` (regel 833) —
  `BoxGeometry` + `mat()`, `castShadow` én `receiveShadow` aan.
- `meubelBox(b, h, d, kleur, x, y, z, ruw, rotY)` (regel 2780) — idem,
  direct in `wereld`.
- `bouwMuur(x, z, breedte, diepte, kleur, hoogte)` (regel 1040).

Daarnaast per zone losse bouwfuncties (`bouwTafel`, `bouwLantaarn`,
`bouwStofwolk`, de dakraam-blokken, de kelder-, vliering- en
gracht-blokken).

Gemeten: **523 meshes, 482 unieke geometrie-instanties**. Hergebruikratio
1,09 — vrijwel elke mesh heeft zijn eigen `BoxGeometry`. Dat is geen
geheugenprobleem (17.782 driehoeken totaal), maar het betekent wel dat
**elke mesh een eigen draw call is**: er is geen instancing, geen merging.

De ondode-modellen zijn de uitzondering. `maakOndodeModel()` (regel 5517)
gebruikt sinds T69 de `geo(sleutel, fabriek)`-cache: negen gedeelde
basisvormen (`been`, `torso`, `bochel`, `buik`, `kern`, `vod`, `hoofd`,
`oog`, `arm`), waarbij de per-ondode maatvariatie via `mesh.scale` gaat.
Kleurvariatie: `const tint = 0.85 + Math.random() * 0.3` op een `Color`-
kopie. Silhouetvariatie via `ONDODE_TYPES[...].vorm` en
`VARIATIE_PROFIELEN` (kromme rug, bochel, slepend been, rompbreedte).

De wapenmodellen (`wapenDrukspuit` regel ~3920, `wapenRatelaar` regel
~4000) hangen als kind aan `camera`. De Drukspuit is een cilindertank +
mondstuk + capsule-greep + een emissief drukmeter-bolletje; de Ratelaar is
bewust boxy als identiteitskeuze (T61). Dit zijn de enige modellen die de
speler van 30 cm afstand ziet, en ze hebben vijf tot acht onderdelen.

## 1.5 Post-processing

Zoals hierboven: `RenderPass` → `UnrealBloomPass` → `OutputPass`. Verder
niets. Geen SSAO, geen FXAA/SMAA (MSAA komt van `antialias: true`, maar dat
werkt níét meer zodra je via een composer rendert naar een render target —
in de praktijk is de anti-aliasing hier dus zwakker dan het lijkt), geen
grain, geen aberratie, geen DOF.

Het vignet en de schade-wedge zijn **geen post-processing**: `#vignet`
(regel 240) is een `radial-gradient` DOM-element met `z-index: 6`, en
`.schadeWedge` (regel 257) is een CSS-driehoek via `border`. Ze worden
per frame via JS-opacity gestuurd. Dat werkt, maar het betekent dat ze
buiten de tonemapping en buiten de bloom vallen — ze liggen letterlijk
bovenop het beeld in plaats van erin.

## 1.6 Fog en sfeer-systemen

```js
const FOG_NORMAAL = { kleur: 0x060a0e, near: 6,    far: 24   };
const FOG_MIST    = { kleur: 0x39443f, near: 2.13, far: 9.35 };
const MIST_UITFADE_DUUR = 4;
scene.background = new THREE.Color(0x05080b);
```

Lineaire `THREE.Fog`, geen exponentiële. Bij een Mistgolf schakelt hij naar
het groenige `FOG_MIST` en na afloop faseert `mistUitfaseTimer` hem over 4
seconden terug — een goed detail.

Verder aan sfeer:

- **Stofwolken** — twee `THREE.Points` van 22 punten (`bouwStofwolk`,
  regel 2718), `PointsMaterial` 0.028 groot, opacity 0.32, `depthWrite:
  false`. Alleen zichtbaar als `zoneVan(...) === 2` (het atelier).
  Geanimeerd via groepsrotatie en een y-sinus op de groep, nooit op de
  BufferAttribute.
- **Druppel** — `druppelMesh` (regel 2157), één vallende druppel van
  plafond naar plas.
- **Lichtvlekken** — elke lantaarn krijgt een `CircleGeometry(1.25, 24)`
  met `MeshBasicMaterial`, opacity 0.12, `depthWrite: false` plat op de
  grond. Dit is al een primitieve vorm van "fake light pooling", en het is
  het bewijs dat die techniek hier past.
- **Emissieve accenten** — `glasMateriaal` (`emissive: 0x5fa0c8`,
  intensity 1.6), lampbollen (0.9), ondode-ogen
  (`OOG_INTENSITEIT_BASIS` 1.4 → `_AANVAL` 2.6 → `_STROOMUITVAL` 3.4),
  `kernMateriaal` van de Brander (1.6). 64 emissieve meshes in totaal.
- **Water** — `waterMesh`, één `PlaneGeometry(8, gangDiepte+2)` met
  `MeshStandardMaterial({ color: 0x1a3a34, roughness: 0.15, metalness:
  0.2, transparent: true, opacity: 0.85 })`. Geen golfjes, geen reflectie,
  geen beweging. Een egaal donkergroen vlak.

## 1.7 Performance-context (gemeten)

Gemeten in headless Chromium (SwiftShader) via `tests/helpers.mjs`, met
`renderer.info.autoReset = false` en één `requestAnimationFrame` tussen
`reset()` en uitlezen. Draw calls en driehoeken zijn resolutie-onafhankelijk
en dus geldig; frametijd is dat niet (§8.11 stelt dit al vast).

| Meting | Leeg (start) | 14 ondoden levend |
| --- | --- | --- |
| Objecten in de scene-graph | 606 | — |
| Meshes | 523 | 653 |
| Lichten (`isLight`) | 28 | 28 |
| `THREE.Points` | 2 | 2 |
| Unieke materialen | 285 | 361 |
| Unieke geometrie-instanties | 482 | 489 |
| Driehoeken in de scene-graph | 17.782 | 32.902 |
| **Draw calls per frame** | — | **280** |
| **Driehoeken per frame** | — | **18.092** |
| Shaderprogramma's | — | 13 |
| GPU-geometrieën (`info.memory`) | 83 | 90 |
| Texturen (`info.memory`) | 16 | 16 |
| `castShadow`-meshes | 165 | — |
| `receiveShadow`-meshes | 108 | — |
| Transparante meshes | 80 | — |
| Emissieve meshes | 64 | — |
| Collision-obstakels | 56 | — |

De 280 draw calls per frame zijn inclusief de cube-shadow-pass (6×) en de
bloom-mipchain. Het aantal geometrieën dat de GPU daadwerkelijk kent (83 van
482) laat zien dat frustum culling flink werk doet: je ziet nooit de hele
kaart tegelijk.

**Wat dit budget betekent.** 280 draw calls en 18k driehoeken is voor een
browsergame ruim: op middenklasse hardware is dit niet waar de tijd heen
gaat. **De tijd gaat naar de fragment shader.** 27 `PointLight`s in Three.js'
forward renderer worden *allemaal* in de shader-uniforms geladen en *per
verlicht fragment* geëvalueerd, ongeacht afstand. Elk vol-scherm fragment
doet dus 27 puntlichtberekeningen plus een hemisfeerterm, en daar bovenop
komt de bloom-mipchain.

Concreet: **er is ruimte voor meer geometrie en meer draw calls, maar
nauwelijks voor meer per-fragment werk.** Elke richting hieronder die een
schermvullende pass of een duurdere fragment-shader toevoegt, concurreert
rechtstreeks met die 27 lichten. Dat is de belangrijkste
budgetteringsregel van dit hele document — en het maakt lichtreductie
(A5, G4) tot een *enabler* voor de rest, niet tot een losse optimalisatie.

## 1.8 Het visuele DNA, in vijf zinnen

Amsterdam Undead is een **donker, nat, laat-nachtelijk grachtenpand waar
warm lamplicht vecht tegen koud maanlicht**, en waar het contrast tussen
die twee kleurtemperaturen de hele ruimtelijke leesbaarheid draagt: je weet
waar je bent aan de kleur van het licht dat je raakt. De ruimtes zijn krap
en gestapeld — kelder, begane grond, vliering — en de fog op 6/24 m maakt
elke doorgang tot een mond van zwart, waardoor het pand groter voelt dan de
plattegrond eigenlijk is. Alles is met de hand gebouwd uit blokken, en het
spel draagt dat eerlijk: de esthetiek is die van een uit karton en verf
gebouwde maquette, niet die van een gescande ruimte. De enige echte
kleurvlekken zijn emissief — lampbollen, raamruiten, oranje ogen in het
donker — en de bloom-threshold van 0,82 zorgt ervoor dat precies díé dingen
gloeien en verder niets. Het spel is nu al sfeervol; wat ontbreekt is niet
sfeer maar **oppervlak**: er is bijna geen informatie tussen de silhouetten
in, dus elk vlak leest als kleur in plaats van als materiaal.

Dat DNA is het ding dat versterkt moet worden. Een mooier Amsterdam Undead
is niet een lichter, kleurrijker of realistischer spel — het is hetzelfde
spel waarin je de baksteen kunt vóélen.

## 1.9 Onzekerheden

1. **Frametijd op echte hardware is niet gemeten.** Alles hierboven komt uit
   SwiftShader-softwarerendering. Ik weet dus wél hoeveel werk er per frame
   wordt aangeboden, maar niet hoeveel marge er is op bijvoorbeeld een
   MacBook Air of een Intel Iris. §8.11 stelt dit expliciet vast en T79
   (lichtculling) is er zelfs op gegate. **Iedere richting in dit document
   die "middel" of "groot" kost, hoort een echte GPU-meting vóór zich te
   hebben.**
2. **De fillrate-aanname.** Mijn stelling dat 27 puntlichten de bottleneck
   zijn, volgt uit hoe Three.js' forward renderer werkt, niet uit een
   profielmeting. Als het in werkelijkheid CPU-bound blijkt (280 draw calls,
   veel losse materialen), verschuift de prioriteitsvolgorde in Stap 3
   richting merging/instancing in plaats van shaderwerk.
3. **Schermresolutie in de praktijk.** `setPixelRatio(min(dpr, 2))` op een
   Retina-scherm betekent 4× zoveel fragments als op een gewoon scherm. Een
   speler op een 4K-monitor betaalt voor elke fragment-richting hieronder
   vier keer zoveel. Ik weet niet op wat voor schermen dit gespeeld wordt.
4. **Hoe zichtbaar is de bestaande schaduw echt?** §7.9.1 zegt max. 12/255
   pixelverschil bij schaduw volledig uit. Als dat klopt, is de
   één-licht-regel vandaag geen visuele beperking maar een dode letter — en
   dan is A5 een veel goedkopere winst dan hij lijkt. Dat wil ik met een
   verse voor/na-opname bevestigd zien.
5. **Smaak.** Ik weet niet of "mooier" hier betekent: rijker en donkerder
   (mijn aanname), of juist leesbaarder en kleurrijker. Dat verandert G
   volledig. Zie vraag 1 in §3.5.

---

# Stap 2 — De visuele richtingen

47 richtingen over negen gebieden. Waar een richting er vooral staat om de
spreiding compleet te maken, zeg ik dat er expliciet bij.

---

## A. Licht en schaduw

**Wat er nu gebeurt.** 27 `PointLight`s zonder afstandsculling, één
schaduwwerper waarvan §7.9.1 zelf vaststelt dat je hem nauwelijks ziet, en
één `HemisphereLight` op 1,5 die de bodem van het beeld bepaalt. Er zijn
geen `SpotLight`s, dus geen enkele lichtkegel; er is geen IBL, dus geen
enkele reflectie van de omgeving. De vier lichtvlekken op de binnenplaats
(`CircleGeometry` met opacity 0.12) zijn de enige plek waar licht *als
vorm* zichtbaar is in plaats van als helderheid op een oppervlak.

**Waarom dit het zwakste punt is.** Een speler leest een ruimte aan
lichtval: waar licht vandaan komt, waar het op valt, waar het níét komt. In
dit spel valt licht overal gelijkmatig. Objecten staan niet op de vloer —
ze zweven erboven, want er is geen contactschaduw en geen occlusie in de
hoeken. Hoeken zijn even helder als vlakken, wat een kamer plat maakt. En
omdat 27 lichten van alle kanten aanlichten, is er nergens een écht donkere
kant van een object: alles is van drie kanten diffuus verlicht, wat precies
de "prototype"-look geeft die de brief beschrijft. Wat de speler onbewust
mist, is niet meer licht — het is **richting** en **verval**.

---

### A1: Contactschaduwen — alles gaat op de grond staan

**Het effect** Onder elke tafel, kist, stoel, ton en lantaarnpaal ligt een
zachte, donkere vlek die het meubel aan de vloer vastnagelt. Van een halve
meter afstand zie je hem niet als "vlek" maar als het donker onder een
meubel. Het beeld wordt onmiddellijk minder zwevend, en de vloer wordt een
oppervlak in plaats van een gekleurd vlak.

**Hoe je dat bereikt** Een gedeelde radiale gradient-canvastextuur (zwart in
het midden, transparant aan de rand, één keer getekend) op een gedeelde
`PlaneGeometry`, in een `InstancedMesh` of gewoon per object als
`MeshBasicMaterial({ transparent: true, depthWrite: false, blending:
NormalBlending })` plat op de vloer, iets boven y=0 (zoals de bestaande
lichtvlekken al doen op y=0.012). Schaal per object afgeleid van de
bounding box. Volledig statisch: één keer plaatsen bij het bouwen, nooit
per frame aanraken.

**Waarom dit werkt binnen de regels** De textuur komt uit
`bouwCanvasTextuur()`, hetzelfde mechanisme dat al voor steen/hout/metaal
draait. Geen extern bestand, geen shader, geen extra light. De
één-licht-regel wordt niet aangeraakt: dit is geometrie, geen verlichting.

**Aangrijpingspunt in de code** Een nieuwe helper naast `meubelBox()` en
`blok()` — bijvoorbeeld `zetContactschaduw(mesh, straal)` — die `meubelBox`,
`bouwTafel`, `bouwLantaarn` en de kist-/ton-bouwers aanroepen. Het
plaatsingspatroon staat er al: de `gLichtvlek`/`lichtvlek` bij de
lantaarns is precies deze constructie.

**Wat het kost** **Klein.** Eén gedeelde 128×128 textuur, één gedeelde
geometry, ~80–120 extra transparante quads. Draw calls stijgen met
maximaal ~100 (naar ~380/frame) of blijven gelijk bij `InstancedMesh`.
Fragment-kosten zijn verwaarloosbaar: `MeshBasicMaterial` doorloopt geen
enkele lichtberekening. Bouwtijd: een avond.

**Risico** Transparante quads sorteren op afstand en kunnen tegen elkaar
aan flikkeren waar twee schaduwen overlappen. Op een ongelijke vloer
(kelderramp, vliering-trap) moet de hoogte per object bepaald worden, en de
kelder-Y-invariant maakt dat niet triviaal. Verder: te donker of te scherp
en het leest als een sticker.

**Lichte versus zware uitvoering** Licht: één vaste ronde gradient, uniform
op alles, alleen op vlakke vloeren. Zwaar: schaduwvorm afgeleid van de
footprint (rechthoekig voor kisten, ovaal voor tonnen), intensiteit
afhankelijk van hoe dicht het object boven de grond zit, en zachte
verticale fade langs muren zodat ook muur-vloer-naden donkerder worden.

---

### A2: Ingebakken hoekocclusie via vertex colors

**Het effect** Waar twee muren elkaar raken, waar een muur op de vloer
staat en waar een plafond een hoek maakt, loopt het beeld zacht donkerder.
Kamers krijgen diepte: je ziet de doos waar je in staat, in plaats van vier
losse gekleurde vlakken. Dit is het verschil tussen een maquette en een
ruimte.

**Hoe je dat bereikt** Bij het bouwen (eenmalig, niet per frame) een
`color`-attribuut op de muur-/vloer-/plafondgeometrieën zetten en
`vertexColors: true` op het materiaal. Per vertex bepaal je hoe dicht die
bij een andere geregistreerde rechthoek uit `obstakels` ligt en dim je
navenant. Voor een `BoxGeometry` met 24 vertices is dat te grof, dus die
vlakken worden met `PlaneGeometry(b, d, segX, segZ)` gesubdivideerd
(bijvoorbeeld 8×8) zodat de gradient vloeiend is.

**Waarom dit werkt binnen de regels** Puur geometrie-data, berekend in JS
bij het bouwen. Geen texture, geen pass, geen light. `vertexColors`
vermenigvuldigt met de basiskleur, dus de bestaande kleurbalans blijft
herkenbaar — het beeld wordt alleen in de hoeken donkerder, nooit lichter.

**Aangrijpingspunt in de code** `bouwMuur()` (regel 1040), `blok()` (833),
de vloer-/plafond-`PlaneGeometry`-blokken (o.a. regel 1013, 2452, 2501) en
de `obstakels`-array als bron voor "waar zit er iets naast me". Botst met
de `mat()`/`matFamilie()`-cache: materialen met `vertexColors: true` moeten
een eigen cache-tak krijgen (of de vlag globaal aan, wat veiliger is —
zonder color-attribuut gedraagt Three.js zich dan als wit).

**Wat het kost** **Middel.** Rendertijd: nul (het is een vertex-attribuut,
geen extra werk in de fragment shader). Geheugen: verwaarloosbaar.
Bouwtijd: dit is het lastigste deel — de occlusie-berekening moet kloppen
op een kaart met kelder, ramp en vliering, en subdivisie verhoogt het
driehoekstal van ~18k naar mogelijk 40–60k (nog steeds ruim binnen budget).
Reken op enkele dagen, en op iteratie tot het klopt.

**Risico** Het echte risico is niet performance maar **regressie op de
lichtbalans**: §7.5.5–7.5.10 documenteren vier feedbackrondes waarin de
helderheid met pixelmetingen is getuned. Alles donkerder maken in de hoeken
raakt die balans, en de kelder is al eens als "te donker" teruggekomen.
Elke wijziging hier hoort met dezelfde pixelmeetmethode geverifieerd te
worden. Tweede risico: te veel occlusie en de kamer wordt vies in plaats van
diep.

**Lichte versus zware uitvoering** Licht: alleen een verticale gradient
langs muurvoeten en muurkoppen — geen echte occlusieberekening, gewoon
"onderaan donkerder". Dat geeft verrassend veel van het effect voor een
fractie van het werk. Zwaar: echte per-vertex occlusie op basis van
`obstakels`, inclusief plafondhoeken en de openingen (deurgaten mogen niet
dichtsmeren).

---

### A3: Zichtbare lichtkegels onder lantaarns en dakramen

**Het effect** Onder elke lantaarn op de binnenplaats hangt een zachte,
naar beneden verbredende kegel van licht in de nachtlucht. Je ziet niet
alleen dat er licht op de grond valt, je ziet het licht *staan*. In het
atelier vallen vier koele kolommen door de dakramen naar binnen, en de
bestaande stofdeeltjes uit `bouwStofwolk()` drijven er zichtbaar doorheen —
wat die stofwolken voor het eerst echt laat lonen.

**Hoe je dat bereikt** Per lichtbron één `ConeGeometry` (open, geen bodem)
met een `ShaderMaterial`: additive blending, `depthWrite: false`, opacity
die uitfadet naar de rand via een fresnel-term (`dot(normal, viewDir)`) en
naar beneden via de lokale y. Facultatief een langzaam scrollende
noise-textuur voor "levendige" lucht. Onderaan zacht laten oplossen zodat er
geen harde rand op de grond staat.

**Waarom dit werkt binnen de regels** `ShaderMaterial`/GLSL is expliciet
toegestaan. Geen extra light — de kegel is puur geometrie die *doet alsof*.
Geen externe assets: de noise komt uit een canvas of uit GLSL zelf.

**Aangrijpingspunt in de code** `bouwLantaarn()` (regel 1706), de vier
dakraam-blokken (2640–2712), `grachtLantaarnLicht` (2100) en
`hangLamp()` (2280). De bestaande `lichtvlek`-`CircleGeometry` is de
grondprojectie van precies deze kegel en zou er logisch bij horen. De
kegel-opacity kan meeliften op `buitenLichten`/`lampLichten` zodat hij
mee-dimt en mee-flikkert tijdens Stroomuitval — anders blijft er licht in
de lucht hangen dat nergens vandaan komt.

**Wat het kost** **Middel.** ~10 extra transparante meshes met een eigen
shader. De fragment-kosten zijn reëel: additive, overlappende, camera-nabije
transparantie is overdraw, en de binnenplaats heeft vier lantaarns die
elkaar kunnen overlappen. Op een 4K-scherm is dit het duurste van alle
"goedkope" richtingen. Bouwtijd: twee tot drie dagen inclusief tuning.

**Risico** Overdraw-cliff op zwakke GPU's als de speler met zijn neus in een
kegel staat (fullscreen additive fragment). Stijlbreuk-risico: te sterk en
het wordt mist-in-een-discotheek in plaats van nachtlucht. En het botst met
de fog: een kegel die door de fog heen fel blijft, ziet er fout uit — de
shader moet de fog respecteren.

**Lichte versus zware uitvoering** Licht: statische kegels met een vaste
fresnel-fade, geen noise, geen animatie, alleen op de vier binnenplaats-
lantaarns en de twee grootste dakramen (zes stuks totaal). Dat geeft
makkelijk 70% van de indruk. Zwaar: geanimeerde noise, dichtheid die
reageert op `FOG_MIST` tijdens een Mistgolf, en per-fragment schaduwing van
de kegel waar geometrie ertussen staat (raymarch — dan zit je in F1-gebied
en wordt het echt duur).

---

### A4: Rimlight — de scheidingslijn tussen ding en donker

**Het effect** Alles wat vóór een donkere achtergrond staat, krijgt een
dunne, koele lichtrand langs zijn silhouetranden, alsof er ergens achter
altijd een beetje maanlicht hangt. Een ondode die uit een donkere gang komt,
tekent zich af vóórdat je hem echt kunt zien. Een kist in een hoek wordt een
kist in plaats van een donkerder vlak.

**Hoe je dat bereikt** Een fresnel-term (`pow(1.0 - dot(normal, viewDir),
k)`) die als extra emissieve bijdrage bovenop de standaard-shading komt.
Geïnjecteerd via `material.onBeforeCompile` op de gedeelde materialen uit
`matFamilie()`, zodat je geen materiaalsysteem hoeft te herschrijven. Sterkte
en kleur per familie instelbaar: metaal krijgt meer, steen minder.

**Waarom dit werkt binnen de regels** Geen extra light, geen pass, geen
asset — puur een shader-chunk-injectie op bestaande materialen.

**Aangrijpingspunt in de code** `matFamilie()` (822) en `mat()` (699). De
`onBeforeCompile`-hook hoort in de cache-fabriek te zitten, één keer per
gedeeld materiaal, met een gedeelde uniform-object zodat je de sterkte
globaal kunt sturen (bijvoorbeeld omhoog tijdens Stroomuitval, waar de ogen
al `OOG_INTENSITEIT_STROOMUITVAL` krijgen).

**Wat het kost** **Klein tot middel.** Een handvol extra instructies per
fragment op materialen die er al 27 lichtberekeningen doen — relatief
goedkoop. Complexiteit: `onBeforeCompile` op *gedeelde, gecachete*
materialen is precies het soort mutatie waar §7.9's
"materiaal-mutatiediscipline" voor waarschuwt; het moet in de fabriek
gebeuren, nooit achteraf op een instantie.

**Risico** Shader-injectie breekt bij een Three.js-versiewissel (de
chunk-namen zijn geen publieke API). Verder: te sterk en alles krijgt een
plastic randje — het is de klassieke manier om een scene er goedkoop-mooi
in plaats van mooi uit te laten zien. Bij E1 komt dezelfde techniek
gerichter terug op alleen de ondoden, en ik denk dat dat de betere
toepassing is.

**Lichte versus zware uitvoering** Licht: alleen op de ondode-materialen
(zie E1), niet op de wereld — grootste gameplaywinst, kleinste stijlrisico.
Zwaar: per materiaalfamilie afgestemde rimkleur en -sterkte, gekoppeld aan
de dichtstbijzijnde lichtbron zodat de rand van de goede kant komt.

---

### A5: De één-schaduw-regel herzien — één gerichte `DirectionalLight`

**Het effect** Door de dakramen valt scherp, gericht maanlicht dat harde,
langgerekte schaduwen van de raamranden over de atelier-vloer trekt. Een
ondode die door zo'n baan loopt, werpt een schaduw die over de vloer
meebeweegt. Voor het eerst heeft het beeld een *lichtrichting* in plaats van
alleen lichtsterkte.

**Hoe je dat bereikt** De schaduwrol verhuizen van de `PointLight` in
`hangLamp(-1.8,-3,true)` naar één `DirectionalLight` die van boven-schuin
door het pand valt, met een strak begrensde `shadow.camera` (orthografisch,
alleen de zone waar de speler is) en `shadow.mapSize` van 1024. De
`PointLight` blijft bestaan voor zijn lichtbijdrage, maar zonder
`castShadow`.

**Waarom dit werkt binnen de regels** Het is geen tweede schaduwlicht — het
is *dezelfde ene* schaduwwerper, van type gewisseld. **Maar het stelt §7.9
wel degelijk ter discussie, dus expliciet:** de regel bestaat om de kosten
van meerdere shadow maps te vermijden. Een `PointLight`-schaduw is een
*cube* map: zes render-passes per frame. Eén `DirectionalLight` is één pass.
Zelfs op 1024×1024 is dat vermoedelijk **goedkoper dan de huidige 6×256**,
en visueel onvergelijkbaar veel sterker. §7.9.1 stelt zelf vast dat de
huidige schaduw maximaal 12/255 pixelverschil maakt — we betalen nu zes
passes voor iets dat je niet ziet. Dit is de enige plek in dit document waar
ik een vastgelegde regel actief zou willen wijzigen, en ik denk dat de regel
in de geest ervan juist gerespecteerd wordt: exact één schaduwwerper,
efficiënter en zichtbaar.

**Aangrijpingspunt in de code** `hangLamp()` (2280), specifiek de
`if (schaduw) licht.shadow.mapSize.set(256,256)`-tak; een nieuwe
`DirectionalLight` naast `hemisfeerLicht` (665); en de 165 meshes met
`castShadow = true` uit `blok()`/`meubelBox()` — die zijn nu grotendeels
voor niets gemarkeerd en zouden per zone gesnoeid moeten worden.

**Wat het kost** **Middel.** Waarschijnlijk netto *negatief* in rendertijd
(één pass in plaats van zes). De kosten zitten in het bouwen: de
shadow-camera moet meebewegen met de speler zonder dat de schaduw zichtbaar
"schuift" of aliast, en op een kaart met verdiepingen (kelder, vliering) moet
je voorkomen dat een schaduw van boven op de verkeerde verdieping landt.

**Risico** Het grootste risico van alle richtingen in dit document, want het
raakt een expliciet vastgelegde invariant én de helderheidsbalans van vier
feedbackrondes. Schaduw-acne en peter-panning op grote vlakke oppervlakken
zijn zeker. Doorlekken tussen verdiepingen is een reëel gevaar (zie §7.5's
geschiedenis met kelderlicht dat door de atelier-westmuur scheen). Dit is
geen ticket voor een losse avond.

**Lichte versus zware uitvoering** Licht: `DirectionalLight` met een vaste,
niet-meebewegende shadow-camera die alleen het atelier dekt — de ene ruimte
met dakramen, waar gericht licht het meest logisch is. Zwaar: shadow-camera
die per zone omschakelt, cascade-achtige focus, en `castShadow` per mesh
opgeschoond zodat alleen wat ertoe doet in de pass zit.

---

### A6: Raamprojecties — gobo's op vloer en muur

**Het effect** Op de vloer onder elk raam ligt een scheve, licht vervormde
rechthoek van licht met de kruisverdeling van het kozijn erin. Bij de
etalages en de kelderluiken valt een smalle streep door de kier. Het beeld
krijgt precies het detail dat een echte ruimte heeft en een maquette niet:
licht dat de vorm van zijn opening aanneemt.

**Hoe je dat bereikt** Een gedeelde canvas-textuur met het kozijnpatroon
(dezelfde soort tekenfunctie als `CANVAS_TEXTUUR_TEKENAARS`), geprojecteerd
als een quad op de vloer/muur met `MeshBasicMaterial`, additive blending en
`depthWrite: false` — precies het bestaande `lichtvlek`-patroon, maar met
een patroon in plaats van een egale cirkel. De vorm en scheefheid worden
statisch berekend uit de raampositie.

**Waarom dit werkt binnen de regels** Canvas-textuur + geometrie. Geen extra
light, geen pass, geen `SpotLight`-map (Three.js kan gobo's via
`SpotLight.map`, maar dat vereist een `SpotLight` en dus een nieuw
lichttype — deze aanpak vermijdt dat volledig).

**Aangrijpingspunt in de code** De raam-/glasblokken rond `glasMateriaal`
(2182–2245), de dakraam-blokken (2640–2712), en het `lichtvlek`-patroon uit
`bouwLantaarn()` als bouwsteen. `PALET.raamWarmAmber`/`raamKoelBlauw`
bepalen de kleur, wat het meteen consistent maakt met de gevel-ramen buiten.

**Wat het kost** **Klein.** ~15 extra quads, één of twee gedeelde
texturen, geen shader. Bouwtijd: een dag, plus tuning van scheefheid per
raam.

**Risico** De projectie is statisch, dus zodra iets tussen raam en vloer
staat (een ondode, een meubel), klopt hij niet meer — het licht loopt over
het object heen. In een donkere scene met veel fog valt dat nauwelijks op,
maar het is een echte cheat. Tweede risico: op een ongelijke vloer (kelder,
ramp) moet de quad opgesplitst of weggelaten worden.

**Lichte versus zware uitvoering** Licht: alleen de vier dakramen in het
atelier, waar de speler het meest komt en de vloer plat is. Zwaar: alle
ramen, inclusief de gevel-ramen die vanaf de binnenplaats naar binnen
schijnen, plus een langzaam bewegende variant onder de zwaaiende hanglamp.

---

## B. Materialen en oppervlaktedetail

**Wat er nu gebeurt.** Vijf materiaalfamilies met een vaste roughness/
metalness, drie 128×128 canvas-texturen die uitsluitend als `roughnessMap`
worden gebruikt (`bouwCanvasTextuur`, regel 756), en een `mat()`-cache voor
alles daarbuiten. Geen `map`, geen `normalMap`, geen `aoMap`, geen `envMap`
in het hele bestand. Alle UV's komen uit `BoxGeometry`/`PlaneGeometry`
zonder herschaling, met `repeat.set(4, 4)` als enige aanpassing.

**Waarom dit het zwakste punt is — samen met A.** Dit is waar het spel
letterlijk "low-poly met effen vlakken" wordt. Een muur van 9 m breed en een
kist van 40 cm krijgen dezelfde textuurschaal, dus de kist ziet er
korreliger uit dan de muur — het patroon draagt geen maat. Er is geen enkele
plek waar twee stenen van elkaar verschillen, geen vuil in de hoeken, geen
water op de vloer dat het lantaarnlicht anders terugkaatst. Een speler
verwacht onbewust dat een oppervlak *variatie op verschillende schalen*
heeft: grote vlekken, middelgroot patroon, fijne korrel. Nu is er alleen
fijne korrel, en die is bijna onzichtbaar omdat hij op een `roughnessMap`
rond wit zit in een scene waar bijna geen specular is.

---

### B1: Wereldschaal-UV's — einde aan stretching en maatverlies

**Het effect** Een baksteen op een muur van 9 meter is even groot als een
baksteen op een muurtje van 1 meter. Planken op de vliering hebben dezelfde
breedte als planken op de vloer. Voor het eerst geven oppervlakken je een
gevoel van *hoe groot iets is* — het pand voelt meteen als een echt gebouw
in plaats van een verzameling geschaalde dozen.

**Hoe je dat bereikt** Bij het bouwen per mesh de UV's herschalen naar de
wereldafmetingen van dat vlak (`repeat` per instantie werkt niet, want de
textuur is gedeeld — dus het moet in het `uv`-attribuut van de geometrie,
of via een `uvTransform`-achtige uniform per materiaalvariant). Voor
`BoxGeometry` betekent dat de zes vlakken elk hun eigen schaal geven op
basis van breedte/hoogte/diepte. Het alternatief is triplanar mapping in de
shader: projecteer op de drie wereldassen en blend op de normal — dan zijn
UV's helemaal niet meer nodig en werken zelfs geroteerde blokken correct.

**Waarom dit werkt binnen de regels** Geometrie-attributen of een
shader-injectie. Geen assets, geen passes.

**Aangrijpingspunt in de code** `blok()` (833), `meubelBox()` (2780),
`bouwMuur()` (1040) en de vloer-/plafond-planes. De texturen zelf
(`bouwCanvasTextuur`, `repeat.set(4,4)`) blijven ongewijzigd — de `repeat`
verhuist van de gedeelde textuur naar de geometrie, wat meteen het huidige
"alles 4×4"-probleem oplost.

**Wat het kost** **Klein voor de UV-variant, middel voor triplanar.**
UV-herschaling is bouwtijd-werk, nul rendertijd. Triplanar kost drie
texture-samples per map per fragment in plaats van één — op een scene die
al fillrate-bound is, is dat niet gratis. Bouwtijd: UV-variant twee dagen,
triplanar een week met tuning.

**Risico** Laag. Het grootste risico is dat het effect pas zichtbaar wordt
als er ook echte `map`/`normalMap` is (B2/B3) — in isolatie zie je hier
bijna niets, want een `roughnessMap` rond wit stretch je nauwelijks
merkbaar. **Dit is daarom een fundament-richting, geen zelfstandige
verbetering,** en dat hoort er eerlijk bij.

**Lichte versus zware uitvoering** Licht: alleen de grote vlakken (muren,
vloeren, plafonds) op wereldschaal; klein decor laten zoals het is. Zwaar:
volledige triplanar met blendscherpte op de normal, zodat ook de
kelder-ramp en geroteerde meubels kloppen.

---

### B2: Een echte procedurele texturenset — baksteen, plank, pleister, klinker

**Het effect** De muur is geen bruin vlak meer maar metselwerk: je ziet
verband, voegen, kleurverschil per steen, en een aanslag die naar beneden
toe donkerder wordt. De vloer is geen plaat maar planken met naden en
knoesten. De binnenplaats is geen grijs vlak maar klinkers in keperverband
met plassen ertussen. Dit is de grootste enkele visuele sprong die dit spel
kan maken.

**Hoe je dat bereikt** `CANVAS_TEXTUUR_TEKENAARS` uitbreiden van drie
ruispatronen naar een echte set tekenfuncties op grotere canvassen
(512×512): een baksteenverband met per-steen kleurvariatie en donkere
voegen; planken met richting, naadlijnen en knoesten; pleisterwerk met
vlekken en craquelé; klinkers met een keperpatroon. Elke tekenaar levert
niet één maar **drie** maps: albedo (`map`), ruwheid (`roughnessMap`, wat er
nu al is) en hoogte (bron voor B3).

**Waarom dit werkt binnen de regels** Exact hetzelfde mechanisme dat er al
staat — `bouwCanvasTextuur()` met de 2D Canvas-API, runtime getekend, geen
bestand, geen netwerkverzoek. §7.3 heeft de precedent-discussie ("geen
textures" leest als "geen extern geladen bestanden") al gevoerd en
vastgelegd. Dit is de logische voortzetting van die beslissing, niet een
nieuwe uitzondering.

**Aangrijpingspunt in de code** `CANVAS_TEXTUUR_TEKENAARS` (regel 770),
`bouwCanvasTextuur()` (756), `MATERIAAL_FAMILIES` (810) en `matFamilie()`
(822). Het `textuur`-veld per familie wordt een objectje met drie
map-verwijzingen. `PALET` (720) zou de kleuren moeten leveren zodat de
tekenaars geen eigen hex-waarden verzinnen.

**Wat het kost** **Middel tot groot — maar bijna alleen in bouwtijd.**
Rendertijd: het toevoegen van een `map` waar er nu geen is, kost één
texture-sample per fragment per materiaal; verwaarloosbaar. Geheugen: ~8
texturen van 512×512 RGBA ≈ 8 MB, plus mipmaps; prima. Genereertijd bij het
laden: 512×512 met duizenden canvas-operaties per tekenaar kan tientallen
milliseconden per textuur kosten, dus de laadtijd stijgt merkbaar — dat moet
gemeten, en eventueel verspreid over frames. **Het echte werk is
kunstzinnig:** een overtuigende baksteentekenaar schrijven is dagen
proberen, niet uren.

**Risico** Het grootste risico is stijlbreuk in de verkeerde richting.
Fotorealistische baksteen op blokgeometrie ziet er slechter uit dan effen
kleur — dan zie je pas echt dat het dozen zijn. De texturen moeten
gestileerd blijven, in lijn met het "geverfde maquette"-DNA. Tweede risico:
de gedeelde `matFamilie`-cache betekent dat *alle* steen dezelfde textuur
krijgt; zonder B4 wordt het beeld daarmee juist eentoniger in plaats van
rijker.

**Lichte versus zware uitvoering** Licht: alleen baksteen en hout, 256×256,
als `map` + de bestaande `roughnessMap`. Twee texturen, en het overgrote
deel van het zichtbare oppervlak in het pand is gedekt. Zwaar: de volle set
inclusief pleister, klinkers, tegel en natte steen, elk met een
seizoens-/vervuilingsparameter zodat de kelder er anders bij staat dan het
atelier.

---

### B3: Normal maps uit dezelfde tekenaars

**Het effect** De voegen tussen de bakstenen vangen het lamplicht en werpen
een minuscule schaduw. Als je langs een muur loopt, beweegt dat mee — het
oppervlak leeft. Houtnerf krijgt reliëf. Waar nu een plat gekleurd vlak was,
zit nu iets waar je met je hand overheen zou willen gaan.

**Hoe je dat bereikt** Uit de hoogtekaart die B2's tekenaars al opleveren,
per pixel een normal berekenen (Sobel-achtige gradient in x en y, opgeslagen
als RGB), en dat als `normalMap` op het materiaal zetten met een
instelbare `normalScale`. Volledig in JS bij het genereren, één keer.

**Waarom dit werkt binnen de regels** Canvas-gegenereerd, runtime, geen
bestand. Precies dezelfde redenering als §7.3 voor de `roughnessMap`.

**Aangrijpingspunt in de code** `bouwCanvasTextuur()` (756) krijgt een
zustertje dat een hoogtecanvas naar een normal-canvas omzet;
`matFamilie()` (822) zet de `normalMap` en `normalScale` per familie.

**Wat het kost** **Klein bovenop B2.** Rendertijd: één extra
texture-sample plus een tangent-space-transformatie per fragment. Op een
scene met 27 puntlichten is dat merkbaar maar niet dramatisch — normal
mapping schaalt met het aantal lichten, dus dit is de eerste richting waar
lichtreductie (A5/G4) direct geld oplevert. Geheugen: verdubbelt B2.
Bouwtijd: één tot twee dagen, want de moeilijkheid zit in B2 al.

**Risico** Zonder tangents op de geometrie valt Three.js terug op een
afgeleide berekening in de shader, wat op grote vlakke `PlaneGeometry`-
vlakken artefacten kan geven. `normalScale` te hoog en het oppervlak ziet
eruit als reliëfbehang. En: dit is de duurste per-fragment-richting in
gebied B; als de fillrate-aanname uit §1.9 klopt, is dit de eerste die
teruggedraaid moet worden op zwakke hardware.

**Lichte versus zware uitvoering** Licht: alleen op baksteen en hout, met
een lage `normalScale`, en alleen op grote vlakken (niet op klein decor
waar je het toch niet ziet). Zwaar: alle families, plus een tweede
detail-normal op een andere schaal die vlak bij de camera inblendt (fijne
korrel dichtbij, groot patroon veraf).

---

### B4: Variatie per instantie zonder de cache te breken

**Het effect** Geen twee bakstenen muren zijn precies dezelfde kleur. Een
kist in de kelder is een tint vochtiger dan dezelfde kist op zolder. De ene
plank is grijzer uitgeslagen dan de andere. Het beeld verliest zijn
"copy-paste"-gevoel — het meest verraderlijke kenmerk van procedureel
gebouwde werelden.

**Hoe je dat bereikt** Een per-mesh kleurtint als *vertex color* (of via
`InstancedMesh`' `instanceColor`), die met de materiaalkleur
vermenigvuldigt. Zo blijft het materiaal gedeeld en gecachet, en varieert
toch elk object. De ondode-modellen doen dit al conceptueel met
`const tint = 0.85 + Math.random() * 0.3` (regel 5519) — alleen krijgen die
er wél een nieuw materiaal per instantie voor, wat hier juist vermeden moet
worden.

**Waarom dit werkt binnen de regels** Geometrie-attribuut. Geen assets,
geen passes, geen extra materialen.

**Aangrijpingspunt in de code** `blok()` (833), `meubelBox()` (2780),
`matFamilie()` (822, `vertexColors` aanzetten). Belangrijk: dit lost ook een
bestaand probleem op — er zijn nu **285 unieke materialen** in de scene, wat
betekent dat de `mat()`-cache lang niet zo veel deelt als de opzet suggereert
(veel call-sites geven `extra` mee en krijgen dus per definitie een unieke
instantie). Kleurvariatie via vertex colors zou juist méér materiaaldeling
mogelijk maken.

**Wat het kost** **Klein.** Nul rendertijd, verwaarloosbaar geheugen. Het
enige werk is een consistente tint-functie (afhankelijk van positie in
plaats van `Math.random()`, zodat hij deterministisch is en tests stabiel
blijven). Bouwtijd: een dag.

**Risico** Laag. Te veel variatie en de scene wordt rommelig; het bereik
moet klein blijven (±10% zoals bij de ondoden). De `mat()`/`matFamilie()`-
cache-contracten en `userData.gedeeld` mogen niet stilzwijgend breken —
§7.9's materiaal-mutatiediscipline geldt hier onverkort.

**Lichte versus zware uitvoering** Licht: één tint-multiplier per mesh op
basis van een hash van de positie. Zwaar: tint die correleert met de
omgeving — vochtiger naar de kelder toe, uitgebleekter bij de dakramen,
roetiger bij de Smederij — zodat de variatie ook *betekent* iets.

---

### B5: Nattigheid en reflectie via een procedurele omgevingskaart

**Het effect** De natte klinkers op de binnenplaats spiegelen het
lantaarnlicht in lange, vervormde strepen. Het water bij de gracht
weerkaatst het blauw van de nachthemel. Metaal — het aambeeld bij de
Smederij, de deurklinken, de wapenloop — krijgt eindelijk het glanzende
oppervlak waar `metalness: 0.65` om vraagt maar dat nu nergens zichtbaar is,
omdat er geen omgeving is om in te spiegelen.

**Hoe je dat bereikt** Een kleine procedurele cubemap of equirect-textuur
uit canvas: een verticale gradient van bijna-zwart onderin naar koel
nachtblauw bovenin, met een paar warme vlekken op lantaarnhoogte. Door
`PMREMGenerator` halen en als `scene.environment` zetten, zodat alle
`MeshStandardMaterial`s hem gebruiken. `envMapIntensity` per familie:
hoog voor `metaal` en `natSteen`, bijna nul voor `steen` en `hout`.

**Waarom dit werkt binnen de regels** Nadrukkelijk: de brief verbiedt "HDR-
omgevingskaarten" als *asset*. Dit is er geen — de kaart wordt runtime uit
een canvas getekend, precies zoals `bouwCanvasTextuur()` dat al doet.
`PMREMGenerator` zit in de Three.js-kern, geen extra CDN-import.

**Aangrijpingspunt in de code** Naast `hemisfeerLicht` (665) een
`scene.environment` zetten; `MATERIAAL_FAMILIES` (810) krijgt een
`envIntensiteit`-veld dat `matFamilie()` (822) doorzet. `waterMesh` (2032)
en de `natSteen`-familie zijn de grootste begunstigden.

**Wat het kost** **Middel.** De PMREM-generatie is eenmalig (tientallen ms
bij het laden). Rendertijd: `envMap`-sampling per fragment op elk
`MeshStandardMaterial` — dat is de duurste toevoeging in gebied B, en hij
raakt *elk* oppervlak in beeld tegelijk. Geheugen: een gefilterde cubemap
van 256 px per face ≈ 2–3 MB.

**Risico** Een environment map licht de héle scene op, ook de delen die
bewust bijna zwart zijn. Dat kan het donkere DNA rechtstreeks ondermijnen:
je krijgt een grijzige, "gewassen" look in plaats van een donker pand. De
helderheidsbalans uit §7.5.5–7.5.10 komt hier direct in gevaar. Dit is de
richting waarvan ik het minst zeker weet of hij het spel mooier of juist
vlakker maakt, en ik zou hem niet zonder een A/B-pixelmeting doorvoeren.

**Lichte versus zware uitvoering** Licht: geen `scene.environment`, maar
een `envMap` alleen op de handvol metaal-materialen en op `waterMesh` —
zeer gericht, zeer goedkoop, en 70% van de winst zit sowieso in het water en
het metaal. Zwaar: volledige `scene.environment` met per-familie intensiteit
en een variant die tijdens een Stroomuitval meedimt.

---

### B6: Vuil, aanslag en slijtage op de plekken waar het hoort

**Het effect** Waar de muur de vloer raakt, zit een donkere aanslagband.
Rond de deurgrepen is het hout lichter gesleten. Onder de dakramen loopt een
vochtstreep naar beneden. De kelderwanden zijn naar onderen toe donkerder en
groeniger. Het pand ziet eruit alsof er ooit iemand woonde en het daarna
lang leegstond — precies het verhaal dat het spel vertelt.

**Hoe je dat bereikt** Twee lagen: (1) een gradient-vertexcolor langs
muurvoeten, plafondnaden en rond openingen, in dezelfde stap als A2; (2) een
tweede, grofgeschaalde "vuilkaart" uit canvas-noise die met een lage
sterkte over de basiskleur wordt gemoduleerd, zodat vlekken op een grotere
schaal variëren dan de baksteentextuur. Vloerplassen op de binnenplaats
bestaan al als `PALET.straatPlas`-quads (regel 1527); die kunnen hier
consistent bij aansluiten.

**Waarom dit werkt binnen de regels** Vertex-data plus een canvas-textuur.

**Aangrijpingspunt in de code** Dezelfde plekken als A2 (`bouwMuur`,
`blok`, de vloer-planes) en `PALET` (720) voor de vuiltinten. Bouwt
letterlijk voort op A2's vertex-color-infrastructuur — los van A2 is deze
richting veel duurder om te bouwen.

**Wat het kost** **Klein bovenop A2, middel als losstaande richting.** Nul
tot minimale rendertijd. Bouwtijd: de kunstzinnige beslissingen (waar hoort
vuil?) kosten meer tijd dan de code.

**Risico** Vuil is verslavend om toe te voegen en maakt een scene snel
modderig. Het gevaar is dat het contrast tussen warm en koel licht — het
kern-DNA — verdrinkt in bruin. Regel: vuil mag de *waarde* verlagen, nooit
de *kleurtemperatuur* verschuiven.

**Lichte versus zware uitvoering** Licht: alleen de muurvoet-aanslagband,
overal, één gradient. Dat is één parameter en het scheelt verrassend veel.
Zwaar: per zone een eigen vuilprofiel (kelder vochtig-groen, Smederij
roetig-zwart, atelier stoffig-grijs), gekoppeld aan de zone-indeling die
`zoneVan()` al kent.

---

## C. Geometrie en silhouet

**Wat er nu gebeurt.** 523 meshes, 482 unieke geometrieën, 17.782
driehoeken. Vrijwel alles is een `BoxGeometry` via `blok()` (833),
`meubelBox()` (2780) of `bouwMuur()` (1040). Er zijn een paar cilinders
(lantaarnpalen, bootromp, wapentank), een handvol bollen (lampbollen,
klinken, drukmeter) en één kegel (boeg). T61 heeft de wapenloop en -greep al
vloeiender gemaakt (`CapsuleGeometry` in plaats van `BoxGeometry`) en de
Brander-bochel meer segmenten gegeven; dat is de enige plek waar
tessellatie bewust is verhoogd.

**Waarom dit onbenut is.** Met 18k driehoeken per frame gebruikt dit spel
misschien 2% van wat een middenklasse GPU aankan. Het polygonbudget is geen
beperking — het is gewoon nooit uitgegeven. En het valt vooral op langs
**randen**: elke rand in dit spel is oneindig scherp, en een oneindig
scherpe rand vangt geen licht. In het echt is elke rand een beetje rond, en
juist die millimeter licht langs de rand is wat een object *aanwezig* maakt.
Wat de speler onbewust mist, is de lichtstreep op de hoek van de tafel.

---

### C1: Afgeschuinde randen op alles wat het silhouet draagt

**Het effect** De hoek van de tafel, de rand van de kist, de dorpel van de
deuropening vangen een dun streepje lamplicht. Objecten krijgen gewicht en
maakbaarheid — ze lijken uit hout gezaagd in plaats van uit een blokkendoos
gepakt. Dit is het detail dat het verschil maakt tussen "programmeurskunst"
en "gemaakt door iemand die ernaar keek".

**Hoe je dat bereikt** Een `blokAfgeschuind(b, h, d, afschuining)`-helper
die in plaats van `BoxGeometry` een `ExtrudeGeometry` met `bevelEnabled`
oplevert, of — goedkoper en beter beheersbaar — een handgeschreven
box-met-chamfer-geometrie (24 → 48 vertices). Cachen in dezelfde stijl als
`geo()` (5500) zodat gelijke maten dezelfde geometrie delen. Afschuining
van 1–2 cm; groter en het wordt cartoonesk.

**Waarom dit werkt binnen de regels** Puur geometrie, gegenereerd in code.
Geen assets.

**Aangrijpingspunt in de code** `blok()` (833) en `meubelBox()` (2780)
krijgen een variant; `bouwTafel()` (2791), de kisten/tonnen en de
deurpanelen (`deurMesh`, 2765) zijn de eerste kandidaten. `bouwMuur()`
juist **niet** — muren hebben geen zichtbare vrije rand en het zou het
driehoekstal onnodig verdrievoudigen.

**Wat het kost** **Klein.** Ruwweg 2–3× het driehoekstal van de behandelde
objecten. Als je 150 meubels/decorstukken afschuint, ga je van 18k naar
misschien 30k driehoeken per frame — nog steeds ver onder elk budget. Draw
calls veranderen niet. Bouwtijd: twee tot drie dagen, waarvan het meeste in
het uitzoeken van *welke* objecten het verdienen.

**Risico** Zeer laag. Het enige echte risico is dat een afschuining de
collision-geometrie visueel laat afwijken van `obstakels` (die blijven
rechthoekig), waardoor je net naast een hoek vast lijkt te lopen. Bij 1–2 cm
is dat onmerkbaar.

**Lichte versus zware uitvoering** Licht: alleen tafels, kisten, deuren en
werkbanken — de tien meest bekeken objecten. Zwaar: een systematische
afschuinregel op alle vrijstaande geometrie, plus grotere afschuiningen op
oude/versleten objecten zodat de mate van afronding het verhaal vertelt.

---

### C2: Lijstwerk, plinten en balken als geïnstantieerde profielen

**Het effect** Waar muur en vloer elkaar raakt, loopt een plint. Onder het
plafond loopt een lijst. In het atelier lopen zichtbare moerbalken over de
breedte. De ruimtes lezen als een 17e-eeuws grachtenpand in plaats van als
een doos — en ze krijgen horizontale lijnen die het oog leiden, wat de
diepte enorm helpt.

**Hoe je dat bereikt** Eén geprofileerde `ExtrudeGeometry` (of gewoon twee
gestapelde dunne boxen) langs elke muurvoet en muurkop, geplaatst met een
`InstancedMesh` per zone. Balken zijn simpele langgerekte blokken met een
klein chamfer (C1).

**Waarom dit werkt binnen de regels** Geometrie in code.

**Aangrijpingspunt in de code** `bouwMuur()` (1040) zou zijn eigen plint en
lijst kunnen plaatsen; de kamerhoogtes staan al vast in `KAMER_HOOGTE`
(3.2) en `ATELIER_HOOGTE` (3.6), dus de lijsthoogte is af te leiden.
`obstakels` levert de muurpositie-informatie.

**Wat het kost** **Klein tot middel.** Met `InstancedMesh` is het één draw
call per profieltype. Driehoeken: enkele duizenden. Bouwtijd: het lastige
is dat plinten *rond de openingen heen* moeten — deurgaten, de vlieringtrap,
de kelderkoker — en dat is fiddly handwerk per zone.

**Risico** Laag qua techniek, middel qua tijd: dit is het soort richting dat
80% snel af is en de laatste 20% (elke uitzondering rond elk deurgat) weken
kost. Ook: plinten verkleinen de effectieve doorloopbreedte visueel terwijl
`obstakels` ongewijzigd blijft, dus de speler kan door een plint lopen.

**Lichte versus zware uitvoering** Licht: alleen moerbalken in het atelier
en de startkamer, waar het plafond hoog genoeg is dat je ze ziet. Zwaar:
volledig lijstwerk in elke zone, met per zone een andere stijl (kaal in de
kelder, geprofileerd in de woonkamer).

---

### C3: Vertex-jitter — niets is meer perfect recht

**Het effect** De vloerplanken liggen niet exact vlak. De muren bollen
minimaal. Het pand is oud en verzakt, en je voelt dat zonder het te kunnen
aanwijzen. Dit is het goedkoopste middel dat er bestaat tegen de
"CAD-tekening"-uitstraling.

**Hoe je dat bereikt** Bij het bouwen, eenmalig, een kleine deterministische
ruis op de positie-attributen van de gesubdivideerde vloer-/muur-planes
(±1–3 cm). Deterministisch (positie-hash, geen `Math.random()`) zodat het
elke sessie identiek is en tests stabiel blijven. Normals opnieuw berekenen.

**Waarom dit werkt binnen de regels** Geometrie-data in code.

**Aangrijpingspunt in de code** De vloer-/plafond-`PlaneGeometry`-blokken
(1013, 1022, 2452, 2501), `bouwMuur()` (1040). Vereist subdivisie, dus dit
deelt zijn fundament met A2 — subdivideer één keer, gebruik het voor
occlusie én jitter.

**Wat het kost** **Klein.** Nul rendertijd. Subdivisie tilt het
driehoekstal, maar we hebben ruimte zat. Bouwtijd: een dag.

**Risico** Muren en vloeren mogen niet zó gaan golven dat er kieren
ontstaan waar twee vlakken samenkomen — de naden moeten vastgepind blijven.
En de speler loopt op een *vlakke* collision-vloer, dus de visuele vloer mag
nooit zo ver afwijken dat je zichtbaar zweeft. Bij ±2 cm is dat geen issue.

**Lichte versus zware uitvoering** Licht: alleen de vloeren, alleen in de
kelder (de ruimte waar verzakking het meest logisch is). Zwaar: alle
horizontale en verticale vlakken, met de jitter-amplitude gekoppeld aan de
"ouderdom" van de zone.

---

### C4: De ondode-modellen — handen, schouders en gerafelde randen

**Het effect** Een ondode is niet langer een stapel dozen met een bol
erbovenop. Je ziet schouders, je ziet handen aan het eind van de armen, en
de vodden om het middel hebben een gescheurde onderrand in plaats van een
rechte. Vanaf tien meter, in het donker, verandert dat het silhouet van
"speelgoedfiguur" naar "iets dat op je afkomt".

**Hoe je dat bereikt** Aan `maakOndodeModel()` (5517) drie tot vijf extra
gedeelde vormen toevoegen via de bestaande `geo()`-cache: een schouderblok
of -capsule, twee handen (kleine afgeplatte bollen), en een vod-geometrie
met een gekartelde onderrand (in code gegenereerde `BufferGeometry` met
alternerende y-waarden langs de onderrand in plaats van een `PlaneGeometry`).

**Waarom dit werkt binnen de regels** Gedeelde geometrie via `geo()`,
precies het patroon dat T69 heeft neergezet.

**Aangrijpingspunt in de code** `maakOndodeModel()` (5517), `geo()` (5500),
`ONDODE_TYPES[...].vorm` en `VARIATIE_PROFIELEN` (5439) voor de variatie.
Belangrijk: `userData.lichaamsdeel === 'kop'` mag *uitsluitend* op hoofd en
ogen blijven staan — nieuwe delen krijgen die markering nooit, anders
verandert de hitbox-logica in `schiet()`/`raakOndode()` stilzwijgend.

**Wat het kost** **Klein.** Vijf extra gedeelde geometrieën, ~5 extra
meshes per ondode. Bij 14 ondoden zijn dat 70 extra draw calls (280 → ~350).
Driehoeken: enkele duizenden. Bouwtijd: twee dagen.

**Risico** De hitbox-invariant hierboven is het echte risico — dit raakt
code waar gameplay-leesbaarheid aan hangt. Verder: meer meshes per ondode
schaalt lineair met `effectiefMaxActief()` (nu 14, met zone-bonus tot 18),
dus dit is de enige richting in gebied C waar de piekbelasting echt
meetelt.

**Lichte versus zware uitvoering** Licht: alleen handen en een gekartelde
vodrand — twee toevoegingen, het grootste deel van het silhouet-effect.
Zwaar: volledige schouderpartij per type, en per `VARIATIE_PROFIELEN`-
profiel een andere combinatie zodat je aan het silhouet ziet welk type
eraan komt (dat raakt gameplay-leesbaarheid positief, als bijeffect).

---

### C5: Wapendetail — het enige model dat je van 30 cm ziet

**Het effect** De Drukspuit heeft zichtbare klinknagels op de tank, een
gevlochten greepwikkeling, een slangetje van tank naar mondstuk, en een
drukmeter met een wijzertje dat zakt naarmate het magazijn leegloopt. De
Ratelaar heeft een tandwiel dat bij elk schot een tand verder klikt. Omdat
dit permanent onderin beeld staat, is elke polygon hier meer waard dan
overal elders in het spel.

**Hoe je dat bereikt** Meer, kleinere onderdelen in de bestaande
wapengroepen; `TorusGeometry`-ringen; een `TubeGeometry` of gebogen cilinder
voor het slangetje; een kleine emissieve wijzer die aan
`wapenStaat.magazijn` gekoppeld is (visuele koppeling, geen gameplay-
wijziging). C1's afschuining hoort hier ook thuis.

**Waarom dit werkt binnen de regels** Geometrie in code.

**Aangrijpingspunt in de code** De `wapenDrukspuit`-groep (~3920) en
`wapenRatelaar` (~4000), `meterDrukspuit` (3947) en `tandwielRatelaar`
(4000). T61 legt al vast dat de Ratelaar bewust boxy blijft als
identiteitskeuze — detail toevoegen mag dat silhouet niet verzachten.

**Wat het kost** **Klein.** ~20 extra meshes, permanent zichtbaar, dus ~20
draw calls constant. Driehoeken: verwaarloosbaar. Bouwtijd: twee tot drie
dagen per wapen, en het is bijna volledig kunstzinnig werk.

**Risico** Het wapen mag nooit het zicht op een aanvallende ondode
blokkeren — gameplay-leesbaarheid gaat voor. Meer massa onderin beeld is
precies wat dat aantast. Houd de silhouetomvang gelijk en voeg alleen
*binnen* de bestaande omtrek toe.

**Lichte versus zware uitvoering** Licht: alleen de drukmeter met een
bewegende wijzer en een slangetje — twee toevoegingen die de speler
gegarandeerd ziet. Zwaar: volledige detaillering van beide wapens plus een
subtiele idle-animatie (het wapen ademt mee met de camera).

---

## D. Post-processing en cameragevoel

**Wat er nu gebeurt.** `RenderPass` → `UnrealBloomPass(256×256, 0.35, 0.4,
0.82)` → `OutputPass`. Verder niets in de composer. Camerabeweging bestaat
uit `terugslag` (4080), een exponentieel wegvallende z-verschuiving van het
wapenmodel, en `cameraKick` (4083), een visuele kick per schot. Het wapen
dipt tijdens herladen via `WAPEN_HERLAAD_DIP_AMPLITUDE` (0.05). Vignet
(`#vignet`, 240) en schade-wedge (`.schadeWedge`, 257) zijn DOM-elementen
bovenop het canvas, dus buiten de composer.

**Waarom dit onbenut is.** Een game die door een lens gefilmd lijkt, voelt
onmiddellijk duurder dan een game die door een raam wordt bekeken. Er is nu
geen enkele "lensvervuiling": geen korrel, geen randonscherpte, geen
kleurafwijking aan de beeldrand, geen vignettering in het beeld zelf. Het
resultaat is chirurgisch schoon — wat voor een horror-setting precies het
verkeerde gevoel is. Bovendien loopt de camera **volkomen stil** tijdens
lopen: er is geen loopwiegen, geen landingsdip, geen lean. Beweging in een
FPS wordt voor een groot deel gevoeld door de camera, niet door de wereld.

Dit is het gebied met de beste verhouding tussen zichtbaar effect en
bouwtijd in het hele document, en tegelijk het gebied waar overdrijving het
snelst tot spijt leidt.

---

### D1: Filmkorrel en chromatische aberratie in één eigen pass

**Het effect** Over het hele beeld ligt een fijne, bewegende korrel — het
sterkst in de donkere delen, bijna afwezig in de lichte. Aan de beeldranden
splitsen de kleurkanalen minimaal, zoals bij een goedkope lens. Het beeld
voelt gefilmd. Als bijvangst verdwijnt de **banding** in de fog-gradiënten,
die in donkere scenes met lineaire fog gegarandeerd zichtbaar is op
8-bit-schermen.

**Hoe je dat bereikt** Eén custom `ShaderPass` (Three.js' eigen
`ShaderPass` uit dezelfde addons-set die al gebruikt wordt) met een
handgeschreven fragment shader: hash-noise op `gl_FragCoord` + `uTijd` voor
de korrel, en een radiale UV-offset per kleurkanaal voor de aberratie.
Beide in één pass, want twee passes betekent twee keer full-screen lezen en
schrijven.

**Waarom dit werkt binnen de regels** `ShaderPass` zit in
`three/addons/postprocessing/`, dezelfde submodule-set waaruit
`EffectComposer`, `RenderPass`, `UnrealBloomPass` en `OutputPass` al komen
— dus **geen nieuwe CDN-import**, alleen een extra entry uit een al
gebruikte map. De shader is handgeschreven GLSL, geen asset.

**Aangrijpingspunt in de code** De composer-opbouw (regel 650–660). De pass
hoort **vóór** `OutputPass` maar **na** `bloomPass`, zodat korrel op het
uiteindelijke beeld ligt en niet mee-bloomt.

**Wat het kost** **Klein.** Eén extra full-screen pass met een goedkope
shader (een handvol instructies, drie texture-samples voor de aberratie).
Op 1080p is dat sub-milliseconde; op 4K met `pixelRatio` 2 merkbaar maar
acceptabel. Bouwtijd: één tot twee dagen inclusief tuning.

**Risico** Overdrijving. Korrel die je *ziet* als korrel is te sterk; hij
hoort onder de bewuste waarneemdrempel te blijven en alleen te merken zijn
als je hem uitzet. Chromatische aberratie in het beeldcentrum is
misselijkmakend — hij moet radiaal zijn en pas voorbij ~60% van de straal
beginnen, anders lijdt de leesbaarheid van het richtpunt. Op zwakke
hardware is dit de eerste pass die je zou willen kunnen uitzetten, dus zet
er meteen een schakelaar op.

**Lichte versus zware uitvoering** Licht: alleen korrel, geen aberratie,
vaste sterkte. Dat is 70% van het "gefilmd"-gevoel en de banding-winst.
Zwaar: korrelsterkte gekoppeld aan de lokale luminantie (meer korrel in het
donker, zoals echte film), aberratie die opzwelt tijdens een Stroomuitval
of bij lage HP.

---

### D2: Het vignet naar binnen halen en reactief maken

**Het effect** De beeldranden lopen zacht donker weg, altijd. Bij lage HP
kruipt de duisternis naar binnen en krijgt hij een rode ondertoon; tijdens
een Stroomuitval wordt hij dieper en kouder. Anders dan nu ligt hij *in* het
beeld: de bloom van een lantaarn aan de beeldrand dooft er correct in weg in
plaats van er bovenop te liggen.

**Hoe je dat bereikt** De radiale demping verhuizen van het DOM-element
`#vignet` naar dezelfde `ShaderPass` als D1 (één pass, meer werk — geen
extra full-screen kosten). Parameters (sterkte, kleur, radius) als uniforms
die de bestaande HP-/eventlogica per frame zet.

**Waarom dit werkt binnen de regels** Zelfde argument als D1.

**Aangrijpingspunt in de code** `#vignet` (CSS, regel 240) en de JS die zijn
`opacity` per frame zet (regel 3667 e.v.); `stroomFactor` en
`EXPOSURE_STROOM_VLOER` (7326) als extra invoer. De `.schadeWedge` (257)
kan bewust **in DOM blijven** — die moet juist scherp en direct leesbaar
zijn, en post-processing zou hem alleen zachter maken.

**Wat het kost** **Klein.** Nul extra passes als hij bij D1 inligt.
Bouwtijd: een halve dag bovenop D1.

**Risico** Een vignet is een van de makkelijkste manieren om een game er
goedkoop uit te laten zien. Sterkte laag houden. Tweede risico: het vignet
maakt de beeldranden donkerder, en juist daar verschijnen ondoden in je
perifere zicht — te sterk en het kost gameplay-leesbaarheid. Dat is
zwaarwegend genoeg dat ik hier een expliciete bovengrens zou vastleggen.

**Lichte versus zware uitvoering** Licht: statisch vignet in de shader, de
bestaande HP-rode variant blijft in DOM. Zwaar: volledig reactief, met een
aparte "dreiging"-term die reageert op hoeveel ondoden er dichtbij zijn —
al raakt dat laatste de grens met gameplay-feedback.

---

### D3: Screen-space ambient occlusion

**Het effect** Elke hoek, elke naad, elke plek waar twee objecten elkaar
raken, wordt zachter donker. Het beeld krijgt in één klap de ruimtelijke
samenhang waar A1 en A2 met handwerk naartoe werken.

**Hoe je dat bereikt** `SSAOPass` uit `three/addons/postprocessing/`, of
een handgeschreven, goedkopere variant op halve resolutie.

**Waarom dit werkt binnen de regels** `SSAOPass` zit in dezelfde
addons-map — geen nieuwe host, wel een nieuwe module-import die expliciet
benoemd moet worden.

**Aangrijpingspunt in de code** De composer (650). Vereist een depth- en
normal-render van de scene, wat in Three.js' `SSAOPass` neerkomt op een
**tweede volledige scene-render** met een override-materiaal.

**Wat het kost** **Groot.** Een tweede scene-render (280 draw calls erbij,
naar ~560) plus een full-screen AO-pass met 8–16 samples plus een blur-pass.
Op een scene die volgens §1.7 al fragment-bound is, is dit veruit de duurste
richting in dit document.

**Risico** Vrijwel zeker een performance-cliff op middenklasse hardware, en
precies het soort ingreep waar de "60fps tijdens een volle golf"-eis op
sneuvelt. Daarbovenop: SSAO in een scene die al bijna zwart is in de
schaduwen, voegt nauwelijks zichtbaar signaal toe — je maakt donker nog
donkerder.

**Lichte versus zware uitvoering** Licht: niet doen; doe A2 in plaats
hiervan, die geeft 80% van het effect voor 0% van de rendertijd. Zwaar:
half-resolutie SSAO met agressieve blur, alleen aan op high-end.

**Eerlijk oordeel:** deze richting staat hier vooral voor de volledigheid
van het spectrum, en om te kunnen vastleggen dat ik hem **afraad**. Zie ook
§3.4.

---

### D4: Scherptediepte, alleen op het wapen

**Het effect** Het wapen onderin beeld is een fractie onscherp aan de
randen, alsof de camera op de wereld scherpstelt en niet op wat er vlak voor
de lens hangt. Het duwt het wapen visueel weg van de scene en geeft het
beeld onmiddellijk fotografische diepte, zonder dat de wereld zelf ooit
onscherp wordt.

**Hoe je dat bereikt** Niet met een echte DOF-pass over de hele scene (te
duur, en het maakt de wereld onleesbaar), maar door het wapenmodel in een
**tweede render-laag** te zetten die apart en licht geblurd overheen wordt
samengesteld. Alternatief en veel goedkoper: een subtiele blur-gradient
alleen in de onderste ~25% van het scherm, in de D1-pass.

**Waarom dit werkt binnen de regels** Shader/pass, geen assets.

**Aangrijpingspunt in de code** `camera.add(wapenDrukspuit)` (3978) en
`camera.add(wapenRatelaar)` (4068); de composer (650).

**Wat het kost** **Middel voor de echte variant, klein voor de
schermgradient-truc.** De layer-variant vereist een tweede render + compose.
De gradient-truc kost nul extra passes bovenop D1.

**Risico** Elke vorm van blur onderin beeld raakt het gebied waar de speler
naar het wapen én naar naderende ondoden kijkt. En echte DOF in een spel
waarin je constant richt, is zelden een verbetering. Ik noem het omdat de
brief er expliciet naar vraagt, maar ik zou hooguit de goedkope variant
doen.

**Lichte versus zware uitvoering** Licht: schermgradient-blur onderin, één
regel in de D1-shader. Zwaar: layer-gebaseerde near-field DOF met een echte
bokeh-kernel.

---

### D5: De camera gaat leven — wiegen, dippen, leunen

**Het effect** Als je loopt, wiegt het beeld nauwelijks merkbaar op en neer
in het ritme van je stappen; sprint je, dan sneller en dieper. Spring je van
de vliering af, dan dipt de camera bij de landing en veert terug. Strafe je
naar links, dan kantelt het beeld een halve graad mee. Je hebt een lichaam.
Van alle richtingen in dit document is dit degene die het snelst voelbaar
is — binnen drie seconden na het opstarten.

**Hoe je dat bereikt** Een sinus op `camera.position.y` gekoppeld aan de
afgelegde afstand (niet aan de tijd — anders wiegt het beeld ook als je
stilstaat), een korte gedempte veer op de landing, en een `camera.rotation.z`
die naar de zijwaartse invoer toe interpoleert. Alles puur cosmetisch,
buiten de collision-berekening om.

**Waarom dit werkt binnen de regels** Pure JS, geen assets, geen passes.

**Aangrijpingspunt in de code** De cosmetische zone van de gameLoop waar
`terugslag` en `cameraKick` al wegvallen (8939–8952) — die code heeft
letterlijk al de juiste vorm en dezelfde "loopt door tijdens pauze"-
discipline. `updateSpeler()` levert de snelheid; `berekenVloerY()` levert
het moment van landen.

**Wat het kost** **Klein.** Nul rendertijd. Bouwtijd: één dag voor de
basis, plus een paar uur tuning.

**Risico** Camerabeweging is een van de weinige visuele ingrepen die
mensen **misselijk** kan maken. De amplitude moet klein zijn (enkele
centimeters, minder dan een graad lean), en er hoort een schakelaar bij in
hetzelfde instellingenmenu waar `muisgevoeligheid` (T75) al staat. Tweede
risico: de wiegende camera verstoort het richten. Het wapenmodel moet
tegenwiegen zodat de vizierlijn stil blijft.

**Lichte versus zware uitvoering** Licht: alleen loopwiegen, één sinus,
vaste amplitude. Zwaar: wiegen + landingsdip + lean + een klein
"adem"-drift bij stilstand, alles snelheids- en toestandsafhankelijk.

---

### D6: De tonemapping-curve als art-direction-instrument

**Het effect** De donkere delen van het beeld behouden kleur in plaats van
naar neutraal grijs-zwart te zakken. Het blauw van het maanlicht blijft
blauw tot in de diepste schaduw; het warme lamplicht loopt naar oranje in
plaats van naar wit. Het beeld wordt rijker zonder lichter te worden — een
verandering die je niet kunt aanwijzen maar wel voelt.

**Hoe je dat bereikt** `ACESFilmicToneMapping` vervangen door
`THREE.CustomToneMapping` met een eigen curve (AgX-achtig: sterkere
kleurbehoud in de schaduwen, zachtere schouder in de highlights), of ACES
behouden en er een aparte grading-stap voor zetten: lift/gamma/gain per
kanaal in de D1-pass. Dat laatste is beheersbaarder en omkeerbaar.

**Waarom dit werkt binnen de regels** `CustomToneMapping` is kern-Three.js
en vervangt alleen een shader-chunk. De grading-variant is een paar regels
in een pass die er al is.

**Aangrijpingspunt in de code** `renderer.toneMapping` en
`renderer.toneMappingExposure` (regel 634–635), en `EXPOSURE_BASIS` /
`EXPOSURE_STROOM_VLOER` (7326–7327) die de exposure al als spelmechanisme
gebruiken.

**Wat het kost** **Klein.** Nul extra passes. Bouwtijd: het is uren werk en
dagen kijken.

**Risico** Hoog, in de zin dat het **elke** eerdere kalibratie raakt. De
helderheid van dit spel is over vier feedbackrondes met pixelmetingen
getuned (§7.5.5–7.5.10); een andere tonemapping verschuift dat allemaal
tegelijk. Dit is de laatste richting die je zou doen, niet de eerste — als
fundamentele grading-stap ná alle materiaal- en lichtwijzigingen, niet
ervoor.

**Lichte versus zware uitvoering** Licht: ACES behouden, alleen een subtiele
kleurbalans-matrix in de D1-pass (koeler in de schaduwen, warmer in de
highlights). Zwaar: eigen tonemapping-curve plus per-zone grading (zie G2).

---

## E. Vijanden: hoe ze eruitzien en bewegen

**Wat er nu gebeurt.** `maakOndodeModel()` (5517) bouwt uit negen gedeelde
`geo()`-vormen: twee benen in pivots, een romp-groep met torso en vod,
optioneel bochel/buik/kern, hoofd en twee ogen, twee armen. Kleurvariatie
via `tint = 0.85 + Math.random() * 0.3` op een `Color`-kopie, silhouet via
`ONDODE_TYPES[...].vorm` en `VARIATIE_PROFIELEN` (5439: rompbreedte,
bochel, kromme rug, slepend been). De ogen zijn het enige emissieve deel
(`OOG_INTENSITEIT_BASIS` 1.4, → 2.6 tijdens de aanval-windup, → 3.4 tijdens
Stroomuitval), en de Brander heeft een emissieve `kernMateriaal` (1.6).
Loopanimatie gaat via pivot-rotaties en een romp-bob.

**Waarom dit het zwakste punt is.** De ondoden zijn **van hetzelfde
materiaal gemaakt als de wereld**: `MeshStandardMaterial` met vergelijkbare
roughness, zonder eigen lichtrespons. In een donkere kamer betekent dat een
donkere vorm tegen een donkere achtergrond, en het enige wat je ziet zijn
twee oranje stipjes. De ogen doen dus al het werk — wat verklaart waarom ze
in de loop van het project steeds feller zijn gemaakt (1.4 → 2.6 → 3.4). Dat
is een symptoombestrijding: het echte probleem is dat er **geen
silhouetscheiding** is tussen vijand en omgeving. Wat de speler mist, is dat
een ondode *anders op licht reageert* dan een muur.

Dit is tegelijk het gebied waar visuele winst en gameplay-leesbaarheid het
sterkst samenvallen, en dat maakt het waardevoller dan zijn plek in de
brief suggereert.

---

### E1: Rimlight uitsluitend op de ondoden

**Het effect** Een ondode die uit een donkere gang komt, krijgt een koele,
dunne lichtrand langs schouders, hoofd en armen — nog vóórdat je zijn ogen
ziet. Hij snijdt zich uit het donker in plaats van erin op te lossen. Elke
ondode leest onmiddellijk als een figuur, ook op vijftien meter in de fog.

**Hoe je dat bereikt** Een fresnel-term, geïnjecteerd via
`onBeforeCompile` op uitsluitend de materialen die `maakOndodeModel()`
aanmaakt. Kleur licht koel-groen of koel-blauw — bewust een andere
kleurtemperatuur dan zowel het warme lamplicht als het koele maanlicht,
zodat ondoden nooit met decor te verwarren zijn.

**Waarom dit werkt binnen de regels** Shader-injectie op bestaande
materialen. Geen extra light (belangrijk: het alternatief — een echte
rimlight per ondode — zou 14 extra `PointLight`s betekenen en dat is
volstrekt onbetaalbaar bij 27 bestaande lichten).

**Aangrijpingspunt in de code** `maakOndodeModel()` (5517), waar per ondode
al `new THREE.MeshStandardMaterial({ color: huidKleur, ... })` wordt
gemaakt. Het gedeelde `kernMateriaal` (5514) moet **buiten** de injectie
blijven (dat is al emissief). De rimsterkte kan als gedeelde uniform mee met
`OOG_INTENSITEIT_MIST`/`_STROOMUITVAL`, zodat ondoden tijdens een
Stroomuitval nog sterker uit het donker springen — precies wanneer dat nodig
is.

**Wat het kost** **Klein.** Een handvol extra instructies per fragment op
14–18 modellen die samen een klein deel van het scherm beslaan. Bouwtijd:
één tot twee dagen.

**Risico** Fresnel op harde, blokkerige geometrie geeft een harde rand op de
vlakovergangen in plaats van een zachte rand rond het silhouet — het effect
is aanzienlijk beter met C4/C1 erbij. Verder: te sterk en de ondoden zien
eruit alsof ze gloeien in plaats van belicht worden, wat de horror-toon
richting sci-fi duwt.

**Lichte versus zware uitvoering** Licht: vaste rimsterkte en -kleur op alle
ondoden. Zwaar: rimkleur per `ONDODE_TYPES`-type (de Brander warmer, de
Sluiper kouder), en rimsterkte die opzwelt tijdens de aanval-windup naast de
bestaande oogpuls — een tweede leesbaarheidssignaal voor precies het moment
waarop het ertoe doet.

---

### E2: Verval-shading — de huid vertelt dat er iets mis is

**Het effect** De huid van een ondode is niet één egale kleur meer. Rond de
gewrichten, in de holtes en langs de onderkant van de romp is hij donkerder
en groeniger; op de uitstekende delen bleker. Van dichtbij zie je vlekkerige
verkleuring. Zelfs zonder één enkele textuurpixel ziet hij eruit als iets
dat aan het rotten is.

**Hoe je dat bereikt** Twee lagen: (1) een verticale/holte-gebaseerde
vertexcolor-gradient, één keer berekend op de gedeelde `geo()`-vormen (die
zijn gedeeld, dus dit kost letterlijk niets per ondode); (2) een
procedurele vlekkenruis in de shader op basis van de wereld- of
objectpositie, met een lage sterkte. Beide vermenigvuldigen met `huidKleur`
zodat de bestaande type-kleuren en de `tint`-variatie intact blijven.

**Waarom dit werkt binnen de regels** Vertexcolors + GLSL-ruis. Geen
texturen.

**Aangrijpingspunt in de code** `geo()` (5500) — de gedeelde vormen krijgen
eenmalig een `color`-attribuut; `maakOndodeModel()` (5517) zet
`vertexColors: true`. De `STADSARCHIEF_KLEURSET_TINT` (T86) vermenigvuldigt
al met `huidKleur` en blijft dus gewoon werken.

**Wat het kost** **Klein.** Vertexcolors: nul. De ruis-term: een paar
instructies per fragment. Bouwtijd: twee dagen, waarvan het meeste aan het
afstemmen van "vies genoeg maar niet groen-monster".

**Risico** De type-kleuren uit `ONDODE_TYPES` zijn een
gameplay-leesbaarheidssignaal (je moet een Brander van een Loper kunnen
onderscheiden). Extra kleurvariatie mag dat onderscheid nooit vertroebelen —
de vervalkleur moet in *waarde* variëren, niet in *tint*.

**Lichte versus zware uitvoering** Licht: alleen de holte-gradient op de
gedeelde geometrieën. Nul rendertijd, en het maakt de modellen meteen
minder plastic. Zwaar: plus de procedurele vlekken, plus een
"vervalgraad"-parameter per ondode zodat sommige verser lijken dan andere.

---

### E3: Doorschijnend silhouet achter geometrie

**Het effect** Een ondode die net achter een deurpost of een kist staat,
tekent zich af als een zwak gekleurde contour door dat object heen. Je weet
dat er iets staat voordat je het ziet. In het donker, waar dit spel om
draait, verandert dat het hele gevoel van dreiging: je wordt niet verrast,
je wordt *achtervolgd*.

**Hoe je dat bereikt** Een tweede, iets opgeschaalde kopie van het
ondode-silhouet (of dezelfde meshes in een tweede render-laag) met
`depthTest: false`, een lage opacity en een vlakke kleur, gerenderd ná de
scene. Om te voorkomen dat het altijd zichtbaar is, alleen renderen als de
ondode daadwerkelijk occluded is — of simpelweg de opacity zo laag houden
dat hij in het zicht niet opvalt.

**Waarom dit werkt binnen de regels** Geometrie + rendervolgorde, geen
assets.

**Aangrijpingspunt in de code** `maakOndodeModel()` (5517) en de
ondoden-update in `updateOndoden()`. Extra meshes per ondode betekent
`ruimGroepOp()` (T70) moet ze meenemen bij het opruimen — anders lek je
precies het soort resource dat T69/T70 hebben opgelost.

**Wat het kost** **Middel.** Verdubbelt het aantal ondode-meshes (bij 14
ondoden: ~140 extra draw calls, van 280 naar ~420). Dat is de grootste
draw-call-toename van alle richtingen in dit document.

**Risico** Dit is de richting die het dichtst bij een **gameplay**-ingreep
zit: het geeft informatie die de speler nu niet heeft. Dat is een
ontwerpbeslissing, geen visuele. Het kan de spanning wegnemen in plaats van
opbouwen — een spel over ondoden in het donker leeft van niet-weten. Ik zou
dit als visuele richting **niet aanraden** zonder expliciete instemming, en
noem het hier omdat het technisch tot dit gebied hoort.

**Lichte versus zware uitvoering** Licht: alleen tijdens een Stroomuitval,
als tijdelijk compensatiemiddel voor de extreme duisternis. Zwaar: altijd
aan, met afstandsafhankelijke opacity.

---

### E4: Loopdeformatie — naijlende vodden en hangende schouders

**Het effect** De vodden om het middel zwaaien een fractie na op de
loopbeweging. De schouders rollen tegengesteld aan de heupen. Het hoofd
loopt een tel achter op de romp bij het draaien. Een ondode beweegt als
iets dat zijn eigen lichaam niet helemaal onder controle heeft, in plaats
van als een marionet met scharnieren.

**Hoe je dat bereikt** Twee opties. Goedkoop: extra pivot-groepen met een
gedempte-veer-interpolatie in JS, precies zoals de bestaande been-pivots en
romp-bob al werken. Duur maar mooier: een vertex-shader die de vod-geometrie
laat golven op basis van tijd en loopsnelheid, met de amplitude toenemend
naar de onderrand.

**Waarom dit werkt binnen de regels** JS-transformaties of GLSL. Geen
assets.

**Aangrijpingspunt in de code** `maakOndodeModel()` (5517), de
`delen`-referenties die naar `spawnOndode()` doorlopen, en de loop-animatie
in `updateOndoden()`. De bestaande romp-`userData.baseY` (T20) is precies
het patroon dat uitgebreid moet worden.

**Wat het kost** **Klein voor de JS-variant, klein-middel voor de
shader-variant.** JS: enkele extra transformaties per ondode per frame op
maximaal 18 ondoden — verwaarloosbaar, mits geen allocaties (§7.9's
hot-path-verbod geldt hier onverkort: `updateOndoden()` is een hot path).

**Risico** De aanval-windup is een gameplay-leesbaarheidssignaal
(`AANVAL_PROFIELEN`, de oogpuls). Meer secundaire beweging kan die
wind-up-houding minder afleesbaar maken. Regel: secundaire beweging moet
stoppen of bevriezen zodra de wind-up begint, zodat de aanval juist
*scherper* leest tegen de bewegende rest.

**Lichte versus zware uitvoering** Licht: alleen naijlende vodden, via één
pivot met veerinterpolatie. Zwaar: volledige secundaire beweging op hoofd,
schouders, armen en vodden, met per `VARIATIE_PROFIELEN`-profiel een eigen
demping.

---

### E5: De dood als gebeurtenis — dissolve in plaats van verdwijnen

**Het effect** Een ondode die valt, zakt niet weg en klapt niet uit beeld:
zijn silhouet vreet van onderaf weg in een gerafelde rand met een korte,
gloeiende zoom, alsof hij tot as uiteenvalt. Twee seconden lang is er iets
te zien, en dan is er niets. Een kill voelt als een gebeurtenis in plaats
van als een object dat de scene verlaat.

**Hoe je dat bereikt** Een dissolve-shader: een procedurele ruiswaarde per
fragment vergeleken met een oplopende drempel-uniform; boven de drempel
`discard`, net onder de drempel een emissieve rand. De drempel loopt in twee
seconden van 0 naar 1, waarna het model wordt opgeruimd.

**Waarom dit werkt binnen de regels** GLSL-ruis, geen textuur nodig.

**Aangrijpingspunt in de code** De sterf-/opruimlogica rond `raakOndode()`
(6905 e.o.) en `ruimGroepOp()` (T70). Cruciaal: de dissolve mag het
opruimcontract niet ondermijnen — de ondode moet uit `ondoden` verdwijnen op
het moment van sterven (gameplay), terwijl alleen de *visuele* groep nog
twee seconden blijft leven in een aparte, begrensde lijst. Anders lek je
geometrieën, precies het probleem dat §8.11 als 4.400 gelekte geometrieën per
25-golven-run heeft vastgelegd.

**Wat het kost** **Klein tot middel.** Een handvol extra meshes die tijdelijk
blijven leven. Bij een plafond van bijvoorbeeld zes gelijktijdige
dissolves is dat ~60 extra draw calls in de piek. De shader zelf is
goedkoop, maar `discard` schakelt early-z uit op de betrokken meshes.

**Risico** Het opruimcontract, zoals hierboven. En: een gedode ondode die
nog twee seconden zichtbaar is, kan verward worden met een levende — een
gameplay-leesbaarheidsrisico dat het effect zelf grotendeels teniet doet
als de dissolve te traag is. Kort houden.

**Lichte versus zware uitvoering** Licht: een snelle (0,4 s) uitfade van
opacity plus een korte impact-deeltjesburst uit de bestaande
`spawnImpact()` — 70% van het "gebeurtenis"-gevoel voor een fractie van het
werk. Zwaar: echte dissolve met gloeiende rand, plus een asdeeltjeswolk die
kort opstijgt.

---

## F. Atmosfeer: mist, stof, water, lucht

**Wat er nu gebeurt.** Lineaire `THREE.Fog` op `0x060a0e`, near 6, far 24
(`FOG_NORMAAL`, regel 617), die tijdens een Mistgolf omschakelt naar
`FOG_MIST` (`0x39443f`, near 2.13, far 9.35) en daarna over
`MIST_UITFADE_DUUR` = 4 s terugfaseert. Twee stofwolken van 22 `Points`
(`bouwStofwolk`, 2718), alleen zichtbaar in het atelier. Eén vallende
druppel (`druppelMesh`, 2157). Eén watervlak: `waterMesh` (2032), een egale
`PlaneGeometry(8, …)` met `roughness: 0.15, metalness: 0.2, opacity: 0.85`,
volstrekt stil.

**Waarom dit onbenut is.** De fog doet zijn werk als *afstandsmaskering*
maar niet als *lucht*: hij is uniform van vloer tot plafond, hij reageert
niet op licht, en hij heeft geen structuur. Daardoor voelt de ruimte leeg in
plaats van vol — je kijkt door helder niets naar een grijze muur, in plaats
van door lucht. Het water is de meest opvallende zwakte van het hele spel:
een gracht is per definitie bewegend, spiegelend water, en hier is het een
donkergroen vlak dat er letterlijk uitziet als een geverfde plaat. En de
stofdeeltjes zijn er al, maar zonder A3's lichtkegels hebben ze niets om
zichtbaar in te zijn — ze zweven in het donker waar je ze niet ziet.

---

### F1: Hoogtemist — de vloer verdwijnt in nevel

**Het effect** Op de binnenplaats en langs de gracht ligt een lage nevel tot
kniehoogte, waar je doorheen loopt en die om de lantaarnpalen heen staat. In
de kelder kruipt hij over de vloer. Boven blijft de lucht helder, dus je
ziet het plafond nog. De ruimte krijgt een boven en een onder.

**Hoe je dat bereikt** Three.js' standaard-fog vervangen door een eigen
fog-berekening via `onBeforeCompile` op de gedeelde materialen: naast de
afstandsterm een hoogteterm (`exp(-hoogte * dichtheid)`), zodat de mist
dikker is naar de vloer toe. De bestaande `FOG_NORMAAL`/`FOG_MIST`-
waarden blijven de basis; er komt één dichtheidsparameter bij.

**Waarom dit werkt binnen de regels** Shader-injectie op bestaande
materialen. Geen assets, geen pass.

**Aangrijpingspunt in de code** `scene.fog` (regel 626), de Mistgolf-logica
rond `mistUitfaseTimer`/`mistUitfaseVan` (622–624), en `mat()`/
`matFamilie()` als plek voor de `onBeforeCompile`-hook. Ook: `A3`'s
lichtkegels moeten dezelfde fog-formule respecteren, anders klopt het niet.

**Wat het kost** **Klein.** Een paar extra instructies per fragment,
bovenop een fog-berekening die er al is. Bouwtijd: twee tot drie dagen,
waarvan het meeste in het niet-breken van de bestaande Mistgolf-overgang.

**Risico** Fog-chunk-injectie is versiegevoelig (zelfde argument als A4).
Belangrijker: de fog bepaalt hoe ver je een naderende ondode ziet, en dat is
een gameplay-parameter die over meerdere rondes is getuned. Hoogtemist die
de vloer maskeert, kan een kruipende of lage ondode onzichtbaar maken.

**Lichte versus zware uitvoering** Licht: alleen buiten (binnenplaats,
gracht), waar de vloer plat is en er geen ondode-leesbaarheidsprobleem
ontstaat, en dan als geometrie in plaats van als fog — een paar grote
horizontale quads met een zachte noise-textuur, additive. Dat is
laagdrempelig en al behoorlijk overtuigend. Zwaar: echte hoogtemist in de
shader, voor de hele kaart, met per zone een eigen dichtheid.

---

### F2: Water dat leeft — golfjes en spiegeling

**Het effect** Het grachtwater beweegt: langzame, brede deining met kleine
rimpels erin, en het licht van de gracht-lantaarn breekt er in een lange,
trillende streep in. De boot deint mee als hij aanmeert. Van alle
afzonderlijke objecten in dit spel is dit het object waar de sprong van
"gemaakt in een middag" naar "gemaakt met zorg" het grootst is.

**Hoe je dat bereikt** Drie lagen, oplopend in kosten. (1) Een
vertex-shader op een gesubdivideerd `waterMesh` met twee tot drie
gekruiste sinussen — deining, gratis, direct overtuigend. (2) Een
procedurele normal-verstoring in de fragment shader (scrollende noise) zodat
het specular highlight van de lantaarn breekt. (3) Een echte
spiegelreflectie via een tweede render vanuit de gespiegelde camera in een
render target — of, veel goedkoper, een fake: de lantaarnstreep als
handgetekende, verticaal uitgerekte gradient-quad die met de golfnormaal
vervormt.

**Waarom dit werkt binnen de regels** GLSL en geometrie. De echte reflectie
zou Three.js' `Reflector` uit `three/addons/objects/` vragen — een **nieuwe
addons-import**, die dus expliciet verdedigd moet worden. Mijn oordeel: dat
is het hier niet waard; de fake-variant kost een fractie en het water is in
het donker toch grotendeels zwart met één lichtstreep erin.

**Aangrijpingspunt in de code** `waterMesh` (2032) en `WATER_BREEDTE`
(1895); `grachtLantaarnLicht` (2100) als bron van de lichtstreep;
`bootGroep` (2043) voor het meedeinen.

**Wat het kost** **Klein voor lagen 1–2, groot voor laag 3.** De vertex-golf
kost een subdivisie van één plane (~2.000 driehoeken) en een paar
instructies per vertex. Een echte reflector kost een tweede scene-render —
zie D3 voor waarom dat hier onbetaalbaar is. Bouwtijd: laag 1 een dag, laag
2 twee dagen.

**Risico** Zeer laag voor lagen 1–2. Het water zit in zone 4 (de
grachtgang), een ruimte die de speler pas laat in een run bereikt, dus zelfs
een fout heeft beperkte impact. Enige aandachtspunt: het water ligt op
y = −0,05 en de speler kan er niet in, dus golven mogen nooit boven de
vlonderrand uitkomen.

**Lichte versus zware uitvoering** Licht: vertex-sinusdeining plus een
verticaal uitgerekte, licht vervormende lantaarnstreep-quad. Zwaar: volledige
golf-normal-shader met breking, schuim langs de vlonderrand, en de boot die
op de golven meedeint.

---

### F3: Regen buiten en natte oppervlakken

**Het effect** Boven de binnenplaats valt fijne motregen, zichtbaar als
lichte strepen in de lantaarnkegels en als tikkende ringetjes in de plassen.
De klinkers glimmen. Als je van binnen naar buiten stapt, verandert niet
alleen het licht maar ook de *lucht* — en het pand voelt daardoor als een
schuilplaats.

**Hoe je dat bereikt** Regen als één `Points`-systeem of `InstancedMesh`
van ~300 langgerekte quads binnen een kubus rond de speler, die per frame
naar beneden bewegen en bovenaan opnieuw beginnen (geen allocaties, een
ringbuffer — precies het patroon van `tracerPool`/`impactPool`). Plassen als
`PALET.straatPlas`-quads met een hogere `metalness` en, met B5, een
`envMap`-bijdrage. Rimpelringen als kortlevende, opschalende ringen uit een
pool.

**Waarom dit werkt binnen de regels** Geometrie + JS-animatie.

**Aangrijpingspunt in de code** De binnenplaats-geometrie rond regel 1511 en
de bestaande `plas`-quads (1527); de effectenpool-architectuur (4275–4350)
als sjabloon voor de rimpelringen; `zoneVan()` om het regensysteem alleen
te updaten als de speler buiten is (dezelfde toggle als `updateStofwolken`).

**Wat het kost** **Middel.** ~300 transparante quads permanent zichtbaar
buiten = één draw call met `InstancedMesh`, maar reële overdraw als ze het
scherm vullen. De per-frame positie-update van 300 instanties is
verwaarloosbaar mits het via `InstancedMesh`-matrices zonder allocaties
gaat. Bouwtijd: drie tot vier dagen.

**Risico** Regen die door plafonds heen valt is de klassieke bug hier — het
systeem moet strikt aan de buitenzones gekoppeld zijn, en de kaart heeft
overdekte delen (de grachtgang, de vlonder). Verder: bewegende strepen over
het hele scherm concurreren rechtstreeks met de zichtbaarheid van naderende
ondoden.

**Lichte versus zware uitvoering** Licht: alleen natte klinkers en plassen
(geen vallende regen) — dat verandert het licht op de binnenplaats al
merkbaar en kost bijna niets. Zwaar: volledig regensysteem met rimpels,
druppels op de camera-lens (een quad vóór de camera met een
druppel-normalmap) en dampend water.

---

### F4: Stof en zwevend vuil in elke zone

**Het effect** In elke ruimte hangt fijn stof in de lucht, langzaam
drijvend, alleen zichtbaar waar licht op valt. In de kelder is het grover en
vochtiger; bij de Smederij zweven er gloeiende asdeeltjes omhoog; in het
atelier is het het bestaande fijne stof in de daklichten. De lucht is nooit
meer leeg.

**Hoe je dat bereikt** Het bestaande `bouwStofwolk()`-patroon uitbreiden
naar één `Points`-systeem per zone, met per zone een eigen kleur, dichtheid
en driftsnelheid. Dezelfde discipline aanhouden die er al staat: animeren
via groepsrotatie en groeps-y-sinus, **nooit** per-frame writes naar het
`BufferAttribute` (§5.10). Alleen zichtbaar in de zone waar de speler is —
dat mechanisme staat al in `updateStofwolken()`.

**Waarom dit werkt binnen de regels** Uitbreiding van bestaande code, geen
nieuwe techniek.

**Aangrijpingspunt in de code** `bouwStofwolk()` (2718),
`updateStofwolken()` (2745), `zoneVan()` (5817).

**Wat het kost** **Klein.** ~8 extra `Points`-objecten van 22–40 punten, met
maximaal één zichtbaar tegelijk. Nul allocaties, nul rendertijd van betekenis.
Bouwtijd: een dag.

**Risico** Vrijwel geen. De belangrijkste beperking is dat stof zonder A3's
lichtkegels grotendeels **onzichtbaar** blijft — deze richting is in isolatie
zwak en wordt pas waardevol samen met A3. Dat hoort er eerlijk bij: op zichzelf
is dit de zwakste richting in gebied F.

**Lichte versus zware uitvoering** Licht: dezelfde twee wolken, maar in elke
zone geplaatst. Zwaar: per zone een eigen deeltjeskarakter, plus opstijgende
sintels bij de Smederij en neerdalend stof dat opwervelt als er een ondode
langsloopt.

---

### F5: De Mistgolf wordt écht mist

**Het effect** Tijdens een Mistgolf drijven er dikke, traag bewegende
slierten door de ruimte die het licht van de lampen opslokken en er zacht
omheen gloeien. Je verliest ondoden uit het oog achter een sliert, en dan
komt hij eruit. De huidige Mistgolf verandert de fog-waarden; deze versie
verandert wat er in de kamer *hangt*.

**Hoe je dat bereikt** Een handvol grote, camera-gerichte billboard-quads
(soft particles) met een scrollende procedurele noise-textuur, semi-
transparant, `depthWrite: false`, die traag door de zone drijven. Om harde
snijranden waar een quad een muur raakt te vermijden: een soft-particle-
fade op basis van diepteverschil (vereist de depth buffer, of — goedkoper —
gewoon de quads klein en laag genoeg houden dat ze nooit door geometrie
snijden).

**Waarom dit werkt binnen de regels** Canvas- of GLSL-noise + geometrie.

**Aangrijpingspunt in de code** `FOG_MIST` (620), `startEventGolf()` /
`eindigEventGolf()` (7347 e.o.), `mistUitfaseTimer` (623). De slierten
moeten dezelfde 4-seconden-uitfade volgen als de fog zelf, anders blijft er
mist hangen na afloop.

**Wat het kost** **Middel.** Grote transparante quads dicht bij de camera
zijn puur overdraw; tien overlappende sheets die het scherm vullen is
effectief tien keer de scherminhoud renderen. Dit is de duurste richting in
gebied F qua fillrate, en hij treedt op **tijdens een eventgolf** — precies
de piekbelasting. Bouwtijd: drie dagen.

**Risico** Fillrate-cliff op het slechtst mogelijke moment. En de Mistgolf
is al de moeilijkst leesbare eventgolf (de fog-far zakt naar 9,35 m);
slierten die daar bovenop komen, kunnen hem onspeelbaar maken. Er hoort een
harde bovengrens op het aantal gelijktijdige sheets, en de ondode-ogen
(`OOG_INTENSITEIT_MIST` 2.6) moeten er doorheen blijven branden.

**Lichte versus zware uitvoering** Licht: drie tot vier grote, trage sheets
per zone met een lage opacity — genoeg voor de indruk van beweging in de
lucht, ver onder de fillrate-drempel. Zwaar: een echt volumetrisch
raymarched mistvolume, wat ik hier zou afraden (zie §3.4).

---

### F6: Adem in de kou

**Het effect** Als je buiten stilstaat, ontsnapt er een klein wolkje damp
uit het beeld — je eigen adem, net onder in het gezichtsveld. Binnen niet.
Het is minuscuul, maar het maakt de speler tot een lichaam dat het koud
heeft.

**Hoe je dat bereikt** Een kleine, kortlevende `Points`-burst of een enkele
zachte quad met opacity-fade, elke paar seconden getriggerd, als kind van de
camera, net buiten het scherpstelvlak.

**Waarom dit werkt binnen de regels** Geometrie + JS.

**Aangrijpingspunt in de code** `camera.add(...)` (3978), `zoneVan()`
(5817) voor de binnen/buiten-test, de effectenpool (4275) als sjabloon.

**Wat het kost** **Zeer klein.** Eén quad, af en toe zichtbaar.

**Risico** Iets vlak voor de camera is altijd een leesbaarheidsrisico. Klein
en doorzichtig houden.

**Eerlijk oordeel:** deze richting staat hier vooral om het gebied compleet
te maken. Het is een leuk detail, geen visuele verbetering van betekenis, en
ik zou hem pas doen als F1–F3 staan.

**Lichte versus zware uitvoering** Licht: één quad met opacity-fade. Zwaar:
een klein deeltjessysteem dat met de kijkrichting meedraait en door
lantaarnlicht wordt aangelicht.

---

## G. Kleur en art direction

**Wat er nu gebeurt.** `PALET` (720) definieert acht kleurgroepen voor
gevels, raamgloed en straat, bewust beperkt tot de T58-call-sites. De rest
van het spel gebruikt losse hex-waarden. De belangrijkste kleurstructuur is
impliciet en klopt al: **warm (`0xffb877`, `0xffd6a0`, `0xffc36a`) binnen en
bij lantaarns, koel (`0xc8ddff`, `0xaacdf0`, `0x8fb8e8`) buiten en bij
dakramen, oranje (`0xff7a1f`) voor ondode-ogen en de Brander-kern.**
Eventgolven werken vandaag als *dimming*: `stroomFactor`,
`BUITEN_STROOM_VLOER`, `HEMISFEER_STROOM_VLOER`, `EXPOSURE_STROOM_VLOER`.

**Waarom dit onbenut is.** De kleurregel die het spel al hanteert, is nergens
*vastgelegd* en dus ook nergens consequent doorgevoerd. En de eventgolven
veranderen alleen de helderheid, niet de kleur — een Stroomuitval maakt het
beeld donkerder maar niet *anders*. Kleur is het goedkoopste
art-direction-instrument dat er bestaat (nul rendertijd) en het is hier het
minst uitgebaat.

---

### G1: De kleurregel expliciet maken en doorvoeren

**Het effect** Elke plek waar de speler veilig is of iets kan kopen, is
warm oranjegeel verlicht. Elke plek waar iets vandaan komt, is koel
blauwgrijs. Alles wat je wil doden, heeft een giftig oranje accent dat in
geen van beide families past. Zonder dat de speler het doorheeft, leest hij
de hele kaart aan kleur — en het beeld wordt samenhangender omdat elke tint
in het spel bij een van drie families hoort.

**Hoe je dat bereikt** `PALET` uitbreiden van een decor-hulpje naar een
volledig, semantisch kleursysteem: `warmVeilig`, `koelDreiging`,
`giftigVijand`, elk met een handvol tinten en een expliciete regel wanneer
je welke gebruikt. Vervolgens de losse hex-waarden in de rest van het
bestand er systematisch naartoe migreren — waarbij het uitgangspunt is dat
kleuren *dichter naar elkaar toe* worden geschoven, niet vervangen.

**Waarom dit werkt binnen de regels** Constanten.

**Aangrijpingspunt in de code** `PALET` (720) en elke `mat()`/
`matFamilie()`-call-site. `MATERIAAL_KLEUREN` (4293, de impact-
deeltjeskleuren per familie) hoort er ook bij — die tabel is nu een losse
kleurset die met niets anders correspondeert.

**Wat het kost** **Klein qua techniek, middel qua doorlooptijd.** Nul
rendertijd. Het werk is een systematische, saaie migratie door een bestand
van 9.384 regels, met na elke stap een pixelmeting om te bewijzen dat de
helderheidsbalans niet verschuift.

**Risico** Elke kleurwijziging raakt de gekalibreerde balans uit
§7.5.5–7.5.10. De veilige aanpak is per zone migreren en per zone meten,
niet in één klap. Verder: de type-kleuren van ondoden zijn
gameplay-signalen en mogen niet in het warm/koel-schema opgaan.

**Lichte versus zware uitvoering** Licht: het systeem vastleggen in `PALET`
en alleen op nieuwe content toepassen (wat de oorspronkelijke T58-intentie
was). Zwaar: volledige migratie van alle bestaande kleuren.

---

### G2: Per-zone kleurgrading

**Het effect** De kelder is niet alleen donkerder, hij is groener en
vochtiger. Het atelier is koeler en stoffiger. De grachtgang trekt naar
blauwgroen. Als je door een deur loopt, verschuift de kleur van het beeld
over een halve seconde mee — je *voelt* dat je van ruimte wisselt, ook met
je ogen dicht voor de plattegrond.

**Hoe je dat bereikt** Een lift/gamma/gain-kleurmatrix per zone, toegepast
als uniform in de D1-shaderpass, geïnterpoleerd bij een zoneovergang. Geen
LUT-textuur nodig; drie vectoren per zone volstaan.

**Waarom dit werkt binnen de regels** Uniforms in een pass die er al is
(als D1 gebouwd is).

**Aangrijpingspunt in de code** `zoneVan()` (5817) levert de zone; de
D1-pass levert de plek. `EXPOSURE_BASIS`/`EXPOSURE_STROOM_VLOER` (7326)
tonen dat het spel dit type globale beeldsturing al doet.

**Wat het kost** **Klein.** Nul extra passes bovenop D1, een paar
instructies per fragment. Bouwtijd: twee dagen, waarvan het meeste kijken.

**Risico** Grading kan de zorgvuldig getunede helderheid per zone
ondermijnen; het moet luminantie-neutraal blijven en alleen de *chroma*
verschuiven. Tweede risico: een harde overgang op de zonegrens is
lelijk — de interpolatie moet over minstens een halve seconde lopen, en
`zoneVan()` is een discrete functie, dus de blend moet in de pass zitten,
niet in de zonelogica.

**Lichte versus zware uitvoering** Licht: drie zones met een merkbaar maar
subtiel verschil (kelder, binnen, buiten). Zwaar: elke zone een eigen
grading, plus een grading-verschuiving tijdens eventgolven (zie G3).

---

### G3: Eventgolven krijgen een kleurhandtekening

**Het effect** Tijdens een Stroomuitval is het niet alleen donkerder — het
beeld trekt naar staalblauw, de kleuren ontzadigen, en de enige warme dingen
die overblijven zijn de noodlantaarns buiten en de oranje ogen. Tijdens een
Mistgolf trekt alles naar het groenige `FOG_MIST`-groen en verliest het
beeld contrast, alsof je door vuil glas kijkt. Elke eventgolf heeft een
kleur waaraan je 'm herkent voordat je weet wat er gebeurt.

**Hoe je dat bereikt** De bestaande dim-systemen uitbreiden met een
kleurcomponent: naast `stroomFactor` een `stroomKleurFactor` die de
grading-matrix uit G2 naar een event-specifieke doelmatrix interpoleert.
`MIST_UITFADE_DUUR` levert al de juiste timing.

**Waarom dit werkt binnen de regels** Uniforms + bestaande logica.

**Aangrijpingspunt in de code** `startEventGolf()`/`eindigEventGolf()`
(7347 e.o.), `stroomFactor`, `EXPOSURE_STROOM_VLOER` (7327),
`BUITEN_STROOM_VLOER` (7338), `mistUitfaseTimer` (623). Ook de
oog-intensiteiten (`OOG_INTENSITEIT_STROOMUITVAL` 3.4, `_MIST` 2.6) horen
hier logisch bij: die zijn nu de enige event-specifieke visuele respons
buiten dimming, en met een kleurhandtekening erbij worden ze onderdeel van
een systeem in plaats van een losse compensatie.

**Wat het kost** **Klein.** Nul extra passes bovenop D1/G2.

**Risico** De ontzadiging tijdens een Stroomuitval mag de oranje ogen —
het enige leesbaarheidsanker in die golf — niet mee-ontzadigen. Dat vraagt
om een grading die emissieve delen ontziet, wat lastiger is dan het klinkt:
een pass ziet geen materiaalonderscheid meer. De praktische oplossing is de
oogintensiteit *verhogen* naarmate de grading ontzadigt, wat het spel al
doet.

**Lichte versus zware uitvoering** Licht: één kleurverschuiving per
eventtype, statisch, geen interpolatie behalve de bestaande uitfade. Zwaar:
volledige grading-transitie met per-eventfase een eigen doelmatrix
(inzetten, hoogtepunt, uitdoven).

---

### G4: Emissive-hiërarchie — bepalen wat mag gloeien

**Het effect** Alleen wat er echt toe doet, gloeit. Lampbollen, ondode-ogen,
de Brander-kern, de gracht-lantaarn en de actieve winkelaccenten hebben een
zichtbare halo; al het andere emissieve materiaal blijft eronder. Het beeld
krijgt een duidelijke hiërarchie in plaats van een verzameling gelijkwaardig
oplichtende dingen, en de speler leert kijken naar wat gloeit.

**Hoe je dat bereikt** Een vastgelegde schaal met drie niveaus (bijvoorbeeld
0.4 / 1.2 / 2.6) en een regel welk soort object op welk niveau zit, in
plaats van de huidige situatie waarin 64 meshes emissief zijn met waarden
die van 0.9 (lampbol) tot 3.4 (ogen tijdens Stroomuitval) lopen. De
bloom-threshold (0.82) bepaalt vervolgens welk niveau daadwerkelijk gloeit —
dat is dus één knop waarmee je de hele hiërarchie stuurt.

**Waarom dit werkt binnen de regels** Constanten en één
`UnrealBloomPass`-parameter.

**Aangrijpingspunt in de code** `bloomPass` (656), `glasMateriaal` (2182),
de lampbollen in `hangLamp()` (2295) en `bouwLantaarn()` (1719),
`kernMateriaal` (5514), `OOG_INTENSITEIT_*` (4966–4975), de
winkelmarkeringen (`winkelMarkering`, `flitsMarkering`, `doofMarkering`).

**Wat het kost** **Klein.** Nul rendertijd. Het is een inventarisatie plus
een tabel.

**Risico** Laag. Het enige risico is dat het verlagen van emissieve waarden
de leesbaarheid van winkelpunten aantast — die gloed is er niet voor de
schoonheid maar om te zien wáár je iets kunt kopen.

**Eerlijk oordeel:** dit is geen visueel effect, het is een besluit. Het
staat hier omdat het de *voorwaarde* is voor alles wat met bloom te maken
heeft — zonder hiërarchie levert elke verhoging van de bloom-sterkte een
wasachtig beeld op in plaats van een dramatisch beeld. Het is de goedkoopste
richting in het hele document en de minst spectaculaire.

**Lichte versus zware uitvoering** Licht: de tabel opstellen en alleen de
uitschieters corrigeren. Zwaar: volledige herkalibratie met de bloom-
threshold als bewust art-direction-instrument, inclusief een tweede,
zachtere bloompas voor de laagste laag.

---

## H. Combat-visuals

**Wat er nu gebeurt.** Een uitgekiende effectenpool (regel 4275–4360, T32):
`TRACER_MAX` 8 en `IMPACT_MAX` 24 vooraf gebouwde slots met een gedeelde
`EFFECT_GEOMETRY` (`BoxGeometry(1,1,1)`) en **een eigen material per slot**,
zodat opacity-fades elkaar nooit kruisen. `pakEffectSlot()` recyclet de slot
met de kortste resterende levensduur; geen allocaties, geen `setTimeout` in
`schiet()`/`raakOndode()`. Tracers leven 0,08 s, impacts 0,3 s.
`MATERIAAL_KLEUREN` (4293) geeft per materiaalfamilie een eigen
inslagkleur. De mondingsvlam is `vlamDrukspuit`, een `SphereGeometry(0.035)`
met `MeshBasicMaterial`, plus `vlamLichtDrukspuit` (`PointLight`,
intensiteit 1.1, `visible = false` tot een schot). De hitmarker is een
DOM-element met drie tiers.

**Waarom dit onbenut is.** De architectuur is uitstekend en de *inhoud* is
minimaal. Een tracer is een dun wit boxje van 1,2 cm dat 0,08 s bestaat; een
inslag is drie tot vijf kubusjes van 3,5 cm. De mondingsvlam is een bolletje
met een puntlicht dat 1,1 sterk is — in een scene waar de zwakste lantaarn
op 9 staat, betekent dat het schot **de kamer niet verlicht**. Wat de speler
mist bij het schieten, is *impact*: het gevoel dat er kracht loskomt. Dit is
het gebied waar de bestaande infrastructuur het meeste toelaat voor het
minste werk — de pool staat er, hij is alleen leeg.

---

### H1: De mondingsvlam wordt een lichtmoment

**Het effect** Elk schot verlicht één frame lang de hele kamer: de muren
tegenover je springen op, je eigen wapen werpt een korte schaduw, en de
bloom laat de vlam kort uitwaaieren. In een donker pand is elk schot een
flits — en dat is precies waarom je in het donker schiet.

**Hoe je dat bereikt** Drie ingrepen samen: (1) `vlamLichtDrukspuit` van
1,1 naar iets in de orde van 15–25 tillen voor precies één tot twee frames;
(2) de vlamgeometrie vervangen door twee gekruiste quads met een
canvas-getekende stervorm die per schot willekeurig roteert en schaalt;
(3) een korte, één-frame-verhoging van `toneMappingExposure` of van de
bloom-sterkte.

**Waarom dit werkt binnen de regels** Bestaande objecten, andere waarden.
Geen nieuwe light (het licht bestaat al, het staat alleen bijna uit), geen
nieuwe pass.

**Aangrijpingspunt in de code** `vlamDrukspuit`/`vlamLichtDrukspuit` (3982–
3989) en het Ratelaar-paar (4070–4078); `schiet()` (4443 e.o.) waar de vlam
al zichtbaar wordt gezet; `EXPOSURE_BASIS` (7326) en `bloomPass` (656).

**Wat het kost** **Zeer klein.** Twee quads in plaats van een bol, en een
intensiteitswaarde. Nul extra objecten, nul extra passes. Bouwtijd: een dag.

**Risico** Bij de Ratelaar (automatisch vuur) betekent dit een stroboscoop.
De flits moet per schot korter zijn dan het vuurinterval, en de
exposure-piek moet **niet** meeschalen met vuursnelheid — anders wordt
aanhoudend vuur letterlijk verblindend, wat gameplay-leesbaarheid kost op
precies het moment dat je het meest moet zien. Er hoort een bovengrens en
een minimum-interval op.

**Lichte versus zware uitvoering** Licht: alleen de lichtintensiteit
verhogen en de duur op één frame zetten. Eén constante, en het is meteen
een compleet ander wapengevoel. Zwaar: plus de gekruiste vlamquads, de
exposure-piek en een korte rookpluim uit de loop na een salvo.

---

### H2: Inslagen met richting, rook en vonkstaarten

**Het effect** Een kogel in baksteen slaat een wolkje gruis los dat in de
richting van de kogel wegspat, met een kort rookpluimpje erachter dat blijft
hangen. Een treffer op metaal geeft vonken met een naijlend staartje. Een
treffer op een ondode geeft een donkere spat die naar beneden valt. Je ziet
waar je raakt, en waarop.

**Hoe je dat bereikt** De pool-architectuur staat er al. Uitbreiden met:
richting (deeltjes krijgen een snelheidscomponent langs de inslagnormaal
in plaats van willekeurig), een langgerekte vorm voor snelle vonken
(schaal langs de bewegingsrichting, precies wat `spawnTracer()` al doet), en
een tweede pool voor korte, opzwellende en uitfadende rookquads.

**Waarom dit werkt binnen de regels** Uitbreiding van bestaande code.

**Aangrijpingspunt in de code** `spawnImpact()` (4353), `bouwEffectSlot()`
(4299), `pakEffectSlot()` (4320), `IMPACT_MAX` (4285),
`MATERIAAL_KLEUREN` (4293), en de `raak[0].face.normal` die `schiet()` al
uit de raycast krijgt.

**Wat het kost** **Klein.** `IMPACT_MAX` van 24 naar bijvoorbeeld 48 en een
rookpool van 12: 36 extra vooraf gebouwde slots, altijd in de scene maar
meestal `visible = false`. Bouwtijd: twee dagen.

**Risico** Zeer laag — dit is de veiligste richting in het document. Enige
punt van aandacht: `pakEffectSlot()`'s recycle-logica loopt lineair over
`actieveEffecten`, dus een veel grotere pool maakt die lus duurder in een
hot path. Bij enkele tientallen is dat verwaarloosbaar.

**Lichte versus zware uitvoering** Licht: alleen richting en langgerekte
vonken toevoegen aan de bestaande pool — nul nieuwe systemen. Zwaar: plus
een rookpool, plus per materiaalfamilie een eigen deeltjesgedrag (gruis
valt, vonken stuiteren, houtsplinters tollen).

---

### H3: Kogelinslagen die blijven staan

**Het effect** Na een intense golf zit de muur bij het raam vol putjes en
schroeivlekken. Je ziet waar je gevochten hebt. De ruimte draagt de
geschiedenis van je run — en dat is het soort detail waar spelers
screenshots van maken.

**Hoe je dat bereikt** Een decal-pool: N vooraf gebouwde quads (bijvoorbeeld
48) die bij een wereldinslag naar de inslagpositie verplaatst worden,
uitgelijnd op de face-normal, iets van het oppervlak af om z-fighting te
vermijden. Ringbuffer: inslag 49 hergebruikt de oudste. Textuur: één gedeelde
canvas-getekende inslagvorm.

**Waarom dit werkt binnen de regels** Zelfde patroon als `tracerPool`, plus
een canvas-textuur.

**Aangrijpingspunt in de code** De effectenpool-architectuur (4275) als
sjabloon, `schiet()` (4443) waar de wereldinslag al bekend is inclusief
`face.normal` en `point`.

**Wat het kost** **Klein.** 48 quads, permanent in de scene, meestal
zichtbaar → tot 48 extra draw calls (280 → ~330). Met een `InstancedMesh`
één. Bouwtijd: twee dagen.

**Risico** Z-fighting op gebogen of ongelijke oppervlakken (de kelder-ramp,
de bootromp), en decals die over een hoek heen steken en in de lucht hangen.
De simpele oplossing is decals alleen toestaan op vlakken waarvan de normal
sterk axis-aligned is — wat in een wereld van blokken vrijwel altijd zo is.

**Lichte versus zware uitvoering** Licht: 24 decals, één vorm, alleen op
muren. Zwaar: 64 decals met per materiaalfamilie een eigen vorm en kleur
(schroei op hout, wit gruis op steen, blanke krassen op metaal), plus een
langzaam vervagen zodat oude inslagen ruimte maken.

---

### H4: De kill als gebeurtenis

**Het effect** Een dodelijke treffer geeft een korte, felle flits op de
ondode zelf, een burst deeltjes die naar buiten spat, en een merkbare
verandering in het silhouet — de ondode klapt niet uit beeld maar geeft het
op. Samen met E5's dissolve wordt doden bevredigend in plaats van
administratief.

**Hoe je dat bereikt** Bij de kill: (1) één frame de emissieve waarde van
de ondode-materialen omhoog (ze zijn per instantie aangemaakt, dus dat mag
— in tegenstelling tot de gedeelde wereldmaterialen); (2) een grotere
`spawnImpact()`-burst met de bestaande `MATERIAAL_KLEUREN.vijand`/
`vijandKop`; (3) de bestaande hitmarker-tier `kill` versterken.

**Waarom dit werkt binnen de regels** Bestaande systemen, andere waarden.

**Aangrijpingspunt in de code** `raakOndode()` (6896 e.o.), waar de
kill-afhandeling en de bestaande impact-burst al zitten; de
hitmarker-tiers (4238–4263); `HITMARKER_SAMENVAL_VENSTER`.

**Wat het kost** **Zeer klein.** Bouwtijd: een dag.

**Risico** Laag. Bij veel gelijktijdige kills (een Brander-explosie die er
vijf tegelijk neemt) kan de flits het beeld overspoelen; er hoort een
samenvalvenster op, precies zoals de hitmarker dat al heeft.

**Lichte versus zware uitvoering** Licht: grotere deeltjesburst plus
emissieve flits. Zwaar: plus E5's dissolve, plus een korte, gerichte
schokgolf-ring op de vloer bij een headshot.

---

### H5: Tracers met snelheid

**Het effect** Een schot is geen instant streep meer maar een kort
lichtspoor dat zichtbaar wegschiet en onderweg vervaagt, met een lichte
kromming door de camerabeweging. Bij automatisch vuur van de Ratelaar zie je
een ritmische stroom in plaats van geflikker.

**Hoe je dat bereikt** In plaats van één mesh over de volle afstand voor
0,08 s: een korte streep die over enkele frames van de loop naar het
inslagpunt beweegt, met opacity die naar het einde toe uitdooft. Dezelfde
pool, andere update-logica.

**Waarom dit werkt binnen de regels** Bestaande code, andere animatie.

**Aangrijpingspunt in de code** `spawnTracer()` (4338), `updateEffecten()`
(8767), `TRACER_LEVENSDUUR` (4287), `TRACER_MAX` (4284).

**Wat het kost** **Zeer klein.** Nul extra objecten. Bouwtijd: een dag.

**Risico** Een langzamere tracer is langer zichtbaar, dus bij hoge
vuursnelheid staan er meer tegelijk — `TRACER_MAX` van 8 kan dan te krap
worden, en `pakEffectSlot()` gaat oudere tracers wegkappen, wat als
haperen leest. Verhogen naar 16 lost dat op.

**Eerlijk oordeel:** dit is een detail. Het is goedkoop en het voelt goed,
maar het verandert het beeld veel minder dan H1. Het staat hier omdat het
gebied H anders te dun zou zijn.

**Lichte versus zware uitvoering** Licht: bewegende streep met uitdovende
opacity. Zwaar: plus een kort naijlend gloedspoor en een subtiele
lichtbijdrage op nabije oppervlakken.

---

## I. De wereld op afstand

**Wat er nu gebeurt.** `scene.background = new THREE.Color(0x05080b)` (regel
613) — een egale bijna-zwarte kleur. `FOG_NORMAAL.far` is 24 m en de
camera-far is 50 m, dus alles voorbij ~24 m is volledig weg. De
binnenplaats heeft achtergevels (`PALET.gevelKoud`/`gevelWarm`, regel 1597
e.v.) met kleine verlichte raampjes — dat is het enige "buiten" dat er is.
Er is geen skybox, geen sterren, geen skyline.

**Waarom dit onbenut is.** Als je op de binnenplaats staat en omhoog kijkt,
zie je niets — een egale bijna-zwarte kleur. Dat is geen nacht, dat is
leegte. Een grachtenpand in Amsterdam staat tussen andere panden, onder een
hemel; het spel vertelt nu dat er buiten de kaart niets is. Dat kost het
grootste enkele gevoel dat een buitenzone kan geven: **openheid als contrast
met de krappe binnenruimtes.**

Dit is tegelijk het gebied met de minste ondersteuning in de bestaande code
en het grootste risico op sfeerbreuk, want alles wat je hier toevoegt is per
definitie iets dat er nu niet is.

---

### I1: Een echte nachthemel

**Het effect** Boven de binnenplaats hangt een diepe nachthemel: van
donker staalblauw aan de horizon naar bijna-zwart in het zenit, met een
paar honderd zwakke sterren en een dun wolkendek dat traag doortrekt. Als je
omhoog kijkt op de binnenplaats, is er ergens om te kijken — en het maanlicht
dat er al is (`maanlicht`, `0xc8ddff`) krijgt eindelijk een bron.

**Hoe je dat bereikt** `scene.background` vervangen door een grote
`SphereGeometry` (of een `CubeTexture` uit canvas) met een
`ShaderMaterial`: verticale gradient plus een sterrenveld uit hash-noise
plus een langzaam scrollende wolkenlaag uit fractale noise. `side:
BackSide`, `depthWrite: false`, geen fog. Ook bruikbaar als bron voor B5's
environment map — dan zijn het twee vliegen in één klap.

**Waarom dit werkt binnen de regels** GLSL of canvas, runtime gegenereerd.

**Aangrijpingspunt in de code** `scene.background` (613); `camera.far` (50)
is ruim genoeg voor een dome van radius 45. De fog (`FOG_NORMAAL`) mag de
dome niet raken, anders wordt hij egaal grijs — de hemel hoort `fog: false`
te hebben.

**Wat het kost** **Klein.** Eén extra mesh, één shader, weinig fragments
(alleen waar je door een opening naar boven kijkt — binnen zie je er niets
van). Bouwtijd: twee tot drie dagen, waarvan het meeste in de wolken-shader.

**Risico** Een te mooie hemel breekt de stijl: dit spel is een donker,
benauwd pand, en een sterrenhemel als in een openwereldspel trekt de
aandacht weg van waar het hoort. Hij moet donker, mistig en onopvallend
zijn — meer "er is een boven" dan "kijk eens hoe mooi". Tweede punt: `far`
op 50 m maakt de dome relatief klein, dus parallax bij het lopen kan
zichtbaar zijn. Oplossing: de dome met de camera meebewegen.

**Lichte versus zware uitvoering** Licht: alleen de verticale gradient plus
sterren, geen wolken. Zwaar: plus fractale wolken, een subtiele maan die
overeenkomt met de `maanlicht`-positie, en de dome hergebruikt als
`scene.environment` voor B5.

---

### I2: Een silhouet van de stad achter de daken

**Het effect** Boven de gevels van de binnenplaats steken de contouren van
andere panden uit — trapgevels, klokgevels, een kerktoren in de verte, een
kraan. Alles pikzwart, alleen als vorm tegen de hemel. De binnenplaats
verandert van "kamer zonder plafond" in "binnenhof in een stad".

**Hoe je dat bereikt** Twee tot drie lagen platte, zwarte silhouetgeometrie
op verschillende afstanden (30, 40, 45 m), opgebouwd uit de bestaande
`blok()`-primitieven plus een paar driehoeken voor de geveltoppen. Met
`fog: false` (of een aangepaste fogdichtheid), zodat ze niet in het niets
oplossen. De lagen kunnen langzaam parallaxen door ze met de camera mee te
bewegen op een fractie van de snelheid.

**Waarom dit werkt binnen de regels** Geometrie in code. Belangrijk: **geen
herkenbare bestaande Amsterdamse gebouwen** — CLAUDE.md's IP-regels en de
"verzonnen adres"-lijn uit T84 gelden hier onverkort. Generieke
grachtenpand-silhouetten, verzonnen torens.

**Aangrijpingspunt in de code** De binnenplaats-gevels rond regel 1597 (die
al `PALET.gevelKoud`/`gevelWarm` gebruiken) en de gracht-zone (1975 e.v.).
`camera.far` (50) begrenst hoe ver de lagen mogen staan.

**Wat het kost** **Klein.** ~50–100 extra meshes, maar alleen zichtbaar
vanuit twee zones en grotendeels gecullled. Met `InstancedMesh` of één
samengevoegde geometrie per laag: enkele draw calls. Bouwtijd: twee dagen,
plus het tekenen van een overtuigende skyline.

**Risico** Laag qua techniek. Het echte risico is **schaal**: als het
silhouet te dichtbij of te groot staat, voelt de binnenplaats kleiner in
plaats van groter. En de fog-uitzondering is delicaat — geometrie die
*niet* wegdooft in een spel waarin alles wegdooft, kan opvallend fout
lijken.

**Lichte versus zware uitvoering** Licht: één laag silhouet, alleen zichtbaar
vanaf de binnenplaats, statisch. Zwaar: drie parallaxende lagen, ook zichtbaar
vanaf de gracht en door de dakramen, met I3's verlichte ramen erin.

---

### I3: Leven in de verte — ramen die aan- en uitgaan

**Het effect** In het skyline-silhouet branden hier en daar warme raampjes.
Heel af en toe gaat er eentje uit, of juist aan. Er is nog iemand anders in
deze stad, en je bent alleen. Tijdens een Stroomuitval gaan ze allemaal uit
— dan zie je dat het niet alleen jouw pand is.

**Hoe je dat bereikt** Emissieve quads in de silhouetlagen van I2, met een
zeer trage willekeurige toestandsverandering (één wissel per tientallen
seconden). Kleur uit `PALET.raamWarmAmber`/`raamWarmZacht`, precies zoals
de bestaande achtergevel-raampjes op de binnenplaats (regel 1581).

**Waarom dit werkt binnen de regels** Geometrie + bestaande kleuren.

**Aangrijpingspunt in de code** I2's silhouetgeometrie; de bestaande
gevelraampjes (1581–1615) als sjabloon; `buitenLichten`/`stroomFactor`
(7317 e.o.) voor de Stroomuitval-koppeling.

**Wat het kost** **Zeer klein.** Enkele tientallen emissieve quads, één
timer.

**Risico** Vrijwel geen. Wel: ze halen mogelijk de bloom-threshold (0.82) en
gaan dan gloeien in de verte, wat afleidt van de gloeiende dingen die ertoe
doen — zie G4.

**Eerlijk oordeel:** dit is een klein detail dat volledig afhangt van I2.
Los daarvan bestaat het niet.

**Lichte versus zware uitvoering** Licht: statische verlichte raampjes,
geen animatie. Zwaar: trage toestandswisselingen plus de Stroomuitval-
koppeling.

---

### I4: Fogdiepte per zone — binnen knus, buiten wijd

**Het effect** Binnen blijft de fog dicht (near 6, far 24): elke gang eindigt
in zwart en het pand voelt benauwd. Zodra je de binnenplaats op stapt, trekt
de fog open naar 40 m en zie je de overkant, de gevels, het silhouet erachter.
Het verschil tussen binnen en buiten wordt fysiek voelbaar — precies het
contrast dat de kaart al in zijn ontwerp heeft maar visueel niet uitdrukt.

**Hoe je dat bereikt** `scene.fog.near`/`far` interpoleren op basis van
`zoneVan()`, met dezelfde soort zachte overgang die `mistUitfaseTimer` al
gebruikt. Geen nieuwe techniek — het is dezelfde knop die de Mistgolf al
omzet.

**Waarom dit werkt binnen de regels** Bestaande code, andere waarden.

**Aangrijpingspunt in de code** `FOG_NORMAAL` (617), `scene.fog` (626),
`mistUitfaseTimer`/`mistUitfaseVan` (623–624) als sjabloon voor de
interpolatie, `zoneVan()` (5817). Belangrijk: de Mistgolf-logica overschrijft
de fog nu volledig, dus de twee systemen moeten netjes op elkaar stapelen in
plaats van elkaar te overschrijven.

**Wat het kost** **Zeer klein.** Nul rendertijd, nul objecten. Bouwtijd: een
dag, waarvan het meeste aan de interactie met de Mistgolf.

**Risico** Fog-afstand is een gameplay-parameter: hij bepaalt op hoeveel
meter je een ondode ziet aankomen. Buiten de fog openen betekent dat je
ondoden op de binnenplaats eerder ziet — een gameplay-bijeffect dat hier
eerlijk benoemd moet worden, en dat vermoedelijk positief is (de
binnenplaats is de open zone waar overzicht hoort). Tweede risico: verder
zien betekent meer geometrie binnen de fog, dus iets meer te renderen —
verwaarloosbaar op deze kaart.

**Lichte versus zware uitvoering** Licht: twee fogprofielen (binnen /
buiten), harde wissel bij een zoneovergang. Zwaar: per zone een eigen
profiel, zacht geïnterpoleerd, en gekoppeld aan G2's kleurgrading zodat
fogkleur en grading samen bewegen.

---

# Stap 3 — Samenhang en prioriteit

## 3.1 Een visuele stijlgids in het klein

Als ik uit de 47 richtingen een identiteit moest samenstellen — niet de
mooiste losse ideeën, maar een geheel dat klopt — kies ik vijf clusters. Ze
versterken alle vijf hetzelfde DNA: **een donker, tastbaar, gefilmd
grachtenpand waarin warm en koud licht om de ruimte vechten.**

**1. Ingebakken occlusie (A1, A2, B6).** Dit is het fundament, en het is
niet toevallig het goedkoopste. Contactschaduwen zetten elk object op de
grond; hoekocclusie geeft elke kamer een binnenkant; vuil op de muurvoet
maakt van de overgang een naad. Samen leveren ze wat het spel het hardst
mist: **waardestructuur zonder licht**. In een scene die grotendeels
bijna-zwart is, is waardestructuur het enige wat leest — een diffuse
textuur in het donker zie je niet, een donkere hoek wel. Nul rendertijd,
wat gezien de fillrate-bevinding in §1.7 doorslaggevend is.

**2. Zichtbaar licht (A3, F4, A6).** Op dit moment *heeft* het spel licht
maar *toont* het geen licht. Kegels onder de lantaarns en door de dakramen,
met stof dat er zichtbaar doorheen drijft en raamprojecties op de vloer,
maken van elke lichtbron een gebeurtenis in de ruimte. Dit is het cluster
dat de screenshots maakt. Het is ook het cluster dat het DNA het meest
direct versterkt: het contrast warm-binnen/koel-buiten wordt pas echt
dramatisch als je de lichtbundel zelf ziet.

**3. Tastbaar oppervlak (B1, B2, B3, B4).** Wereldschaal-UV's, een echte
procedurele texturenset, normal maps uit dezelfde tekenaars, en variatie per
instantie. Dit is het duurste cluster in bouwtijd en het meest kunstzinnige,
maar het is ook wat de brief letterlijk vraagt: los komen van egale
kleurvlakken. Cruciaal is dat de texturen **gestileerd** blijven — dit spel
is een geverfde maquette, geen scan, en fotorealistische baksteen op
blokgeometrie ziet er slechter uit dan effen kleur.

**4. De vijand springt eruit (E1, E2, C4).** Rimlight, verval-shading en een
beter silhouet. Dit is het enige cluster waar visuele winst en
gameplay-leesbaarheid volledig samenvallen, en het lost een echt probleem
op: de oogintensiteit is over het project heen van 1,4 naar 3,4 geklommen
omdat de ogen al het silhouetwerk moesten doen. Met rimlight mogen ze weer
gewoon ogen zijn.

**5. Gefilmd beeld (D1, D2, D5).** Korrel, een vignet dat ín het beeld ligt,
en een camera die meebeweegt met het lopen. Dit cluster kost bijna niets en
verandert binnen drie seconden hoe het spel *aanvoelt*. Het is ook het
cluster dat het makkelijkst te ver gaat — alle drie horen ze onder de
bewuste waarneemdrempel te blijven.

**Wat deze vijf samen zijn, en wat ze niet zijn.** Ze zijn geen stap richting
fotorealisme. Ze maken het spel niet lichter, niet kleurrijker en niet
gedetailleerder in de zin van "meer dingen". Ze doen één ding: **ze geven
het bestaande beeld diepte, oppervlak en camera.** Dat is precies waarom ze
samen kloppen — ze concurreren nergens met elkaar, ze werken op vier
verschillende schalen (ruimte, licht, oppervlak, lens) en op de vijfde
schaal (de vijand) zorgen ze dat de gameplay leesbaar blijft terwijl de rest
donkerder en rijker wordt.

## 3.2 Impact-tegen-kostenmatrix

Rendertijd = kosten per frame tijdens een volle golf. Bouwtijd = mijn
schatting inclusief tuning. Impact = hoeveel het beeld er zichtbaar op
vooruitgaat.

| # | Richting | Impact | Rendertijd | Bouwtijd | Oordeel |
| --- | --- | --- | --- | --- | --- |
| A1 | Contactschaduwen | Hoog | Verwaarloosbaar | 1 dag | **Eerst doen** |
| A2 | Hoekocclusie (vertex colors) | Zeer hoog | Nul | 3–5 dagen | **Eerst doen** |
| A3 | Zichtbare lichtkegels | Zeer hoog | Middel (overdraw) | 2–3 dagen | Kern |
| A4 | Rimlight op de wereld | Middel | Klein | 1–2 dagen | Doe E1 in plaats hiervan |
| A5 | `DirectionalLight` i.p.v. cube shadow | Zeer hoog | Waarschijnlijk negatief | 1–2 weken | Meten, dan beslissen |
| A6 | Raamprojecties (gobo's) | Middel-hoog | Verwaarloosbaar | 1 dag | Goede prijs |
| B1 | Wereldschaal-UV's | Laag alleen | Nul | 2 dagen | **Fundament, geen effect** |
| B2 | Procedurele texturenset | Zeer hoog | Klein | 1–2 weken | Kern, duurste in tijd |
| B3 | Normal maps | Hoog | Middel (schaalt met lichten) | 1–2 dagen na B2 | Kern |
| B4 | Variatie per instantie | Middel-hoog | Nul | 1 dag | Uitstekende prijs |
| B5 | Procedurele env map | Onzeker | Middel-groot | 3 dagen | Alleen gericht op metaal/water |
| B6 | Vuil en slijtage | Middel-hoog | Nul | 2 dagen na A2 | Goede prijs |
| C1 | Afgeschuinde randen | Hoog | Klein | 2–3 dagen | Goede prijs |
| C2 | Lijstwerk en plinten | Middel | Klein | 1 week | Veel handwerk |
| C3 | Vertex-jitter | Middel | Nul | 1 dag na A2 | Goede prijs |
| C4 | Ondode-silhouet | Hoog | Klein (×14) | 2 dagen | Kern |
| C5 | Wapendetail | Middel-hoog | Klein | 2–3 dagen/wapen | Permanent in beeld |
| D1 | Korrel + aberratie | Hoog | Klein (1 pass) | 1–2 dagen | **Eerst doen** |
| D2 | Vignet in de composer | Middel | Nul bovenop D1 | 0,5 dag | Goede prijs |
| D3 | SSAO | Middel | **Groot** | 3 dagen | **Afgeraden** |
| D4 | Near-field DOF | Laag | Klein–middel | 1–3 dagen | Alleen goedkope variant |
| D5 | Camerawieg / dip / lean | Hoog (gevoel) | Nul | 1 dag | **Eerst doen** |
| D6 | Tonemapping-curve | Middel-hoog | Nul | 1 dag + veel kijken | Als laatste |
| E1 | Rimlight op ondoden | Zeer hoog | Klein | 1–2 dagen | **Eerst doen** |
| E2 | Verval-shading | Middel-hoog | Nul–klein | 2 dagen | Kern |
| E3 | Doorschijnend silhouet | Middel | Middel (×2 meshes) | 2 dagen | **Ontwerpvraag, niet visueel** |
| E4 | Loopdeformatie | Middel | Nul | 2 dagen | Goede prijs |
| E5 | Dissolve bij de dood | Middel-hoog | Klein–middel | 3 dagen | Let op opruimcontract |
| F1 | Hoogtemist | Hoog | Klein | 2–3 dagen | Kern, gameplay-gevoelig |
| F2 | Levend water | Hoog (lokaal) | Klein (laag 1–2) | 1–3 dagen | Uitstekende prijs |
| F3 | Regen en natte klinkers | Middel-hoog | Middel | 3–4 dagen | Licht-variant eerst |
| F4 | Stof per zone | Laag alleen, hoog met A3 | Nul | 1 dag | **Afhankelijk van A3** |
| F5 | Mistslierten | Middel-hoog | **Groot in de piek** | 3 dagen | Alleen lichte variant |
| F6 | Adem in de kou | Zeer laag | Nul | 0,5 dag | **Vulling, eerlijk gezegd** |
| G1 | Kleurregel doorvoeren | Middel | Nul | 1 week migratie | Fundament voor content |
| G2 | Per-zone grading | Hoog | Nul bovenop D1 | 2 dagen | Uitstekende prijs |
| G3 | Eventkleuren | Middel-hoog | Nul | 1 dag na G2 | Goede prijs |
| G4 | Emissive-hiërarchie | Laag als effect | Nul | 1 dag | **Voorwaarde, geen effect** |
| H1 | Mondingsvlam als lichtmoment | Zeer hoog | Verwaarloosbaar | 1 dag | **Eerst doen** |
| H2 | Rijkere inslagen | Hoog | Klein | 2 dagen | **Eerst doen** |
| H3 | Blijvende inslagen | Middel-hoog | Klein | 2 dagen | Goede prijs |
| H4 | De kill als gebeurtenis | Hoog | Verwaarloosbaar | 1 dag | **Eerst doen** |
| H5 | Bewegende tracers | Laag-middel | Nul | 1 dag | Detail |
| I1 | Nachthemel | Middel-hoog | Klein | 2–3 dagen | Goede prijs |
| I2 | Skyline-silhouet | Hoog (buitenzones) | Klein | 2 dagen | Goede prijs, let op IP |
| I3 | Ramen in de verte | Laag | Nul | 0,5 dag | **Afhankelijk van I2** |
| I4 | Fogdiepte per zone | Hoog | Nul | 1 dag | **Eerst doen** |

**De drie beste verhoudingen impact/moeite**, en dus waar ik zou beginnen:

1. **H1 — de mondingsvlam als lichtmoment.** Eén dag, één
   intensiteitsconstante van 1,1 naar ~20, en elk schot verlicht de kamer.
   Er is geen andere ingreep in dit document die zoveel gevoel oplevert voor
   zo weinig werk, en de infrastructuur (`vlamLichtDrukspuit` bestaat al,
   staat alleen bijna uit) is er al.
2. **A1 — contactschaduwen.** Eén dag, één gedeelde canvas-gradient, en de
   hele wereld gaat op de grond staan. Nul rendertijd. Het patroon staat al
   in de code als `lichtvlek` bij de lantaarns.
3. **E1 — rimlight op de ondoden.** Eén tot twee dagen shader-injectie, en
   de vijanden snijden zich uit het donker. Dit is de enige ingreep die
   tegelijk het beeld mooier en het spel leesbaarder maakt.

Vlak daarachter: **D5** (camerawieg, één dag, verandert het spelgevoel
onmiddellijk), **I4** (fogdiepte per zone, één dag, maakt het
binnen/buiten-contrast fysiek) en **H2/H4** (rijkere inslagen en kills,
samen drie dagen op een pool die er al ligt).

## 3.3 Volgorde van bouwen

**Fundament — bouwen anderen op voort, doe deze eerst.**

- **G4 (emissive-hiërarchie).** Geen effect op zichzelf, maar zonder deze
  tabel is elke bloom-wijziging giswerk. Eén dag.
- **B1 (wereldschaal-UV's).** Zonder dit heeft B2 geen zin: een prachtige
  baksteentextuur die op elk vlak een andere maat heeft, is erger dan geen
  textuur. Eerlijk gezegd is B1 in isolatie bijna onzichtbaar — dat is
  precies waarom het fundament is en niet een resultaat.
- **Subdivisie van muren/vloeren/plafonds.** Eén keer doen, en A2
  (hoekocclusie), C3 (vertex-jitter) en B6 (vuil) gebruiken alle drie
  dezelfde geometrie. Los uitvoeren betekent drie keer dezelfde bouwstap.
- **D1 (de eigen `ShaderPass`).** Zodra deze pass bestaat, zijn D2
  (vignet), G2 (per-zone grading), G3 (eventkleuren) en D4-licht bijna
  gratis. Zonder de pass heeft elk van die vier een eigen full-screen pass
  nodig, wat vier keer zo duur is.

**Laag 1 — snelle winst, in willekeurige volgorde, elk binnen een dag of
twee.** H1, A1, E1, D5, I4, H2, H4, D2, B4, A6.

Na deze laag ziet het spel er merkbaar anders uit voor ongeveer twee weken
werk, en er is nog niets onomkeerbaars gebeurd.

**Laag 2 — de kern van de identiteit.** A2 (hoekocclusie), A3
(lichtkegels), B2 (texturenset), C4 (ondode-silhouet), C1 (afschuining),
E2 (verval-shading), G2 (per-zone grading), F2 (levend water).

Dit is waar de meeste tijd heen gaat en waar de meeste iteratie nodig is.
Elk van deze raakt de gekalibreerde helderheid en hoort met dezelfde
pixelmeetmethode geverifieerd te worden die §7.5.5–7.5.10 hanteren.

**Laag 3 — bovenop laag 2.** B3 (normal maps, vereist B2), B6 (vuil,
vereist A2), C3 (jitter, vereist subdivisie), F4 (stof, vereist A3), F1
(hoogtemist), I1+I2 (hemel en skyline), G3 (eventkleuren, vereist G2), H3
(blijvende inslagen), E5 (dissolve).

**Laag 4 — pas na een echte GPU-meting.** A5 (`DirectionalLight`), B5 (env
map), D6 (tonemapping), F3 (regen), F5 (mistslierten), G1 (volledige
kleurmigratie). Dit zijn de richtingen die ofwel een vastgelegde invariant
raken, ofwel de helderheidskalibratie in één klap verschuiven, ofwel een
fillrate-risico dragen. Geen van vieren is verstandig zonder cijfers.

**Losstaand, op elk moment.** C5 (wapendetail), C2 (lijstwerk), E4
(loopdeformatie), H5 (tracers), I3 (verre ramen), F6 (adem), D4 (DOF).
Geen van deze blokkeert of vereist iets anders.

## 3.4 Wat ik bewust niet zou doen

**SSAO (D3).** De voor de hand liggende keuze in elk "mooiere game"-gesprek,
en hier de verkeerde. Het kost een tweede volledige scene-render (280 draw
calls erbij) plus een AO- en een blur-pass, op een scene die volgens §1.7
al fragment-bound is. En de opbrengst is klein: in een beeld dat in de
schaduwen al bijna zwart is, voegt donkerder-maken weinig zichtbaar signaal
toe. A2 levert 80% van hetzelfde effect voor 0% van de rendertijd.

**Echte volumetrische mist (raymarched).** Dertig tot zestig samples per
fragment over de hele schermruimte. Dat is precies het soort techniek dat op
een RTX-kaart prachtig is en op een MacBook Air het spel halveert in
framerate — en dan nog tijdens een eventgolf, de piekbelasting. F5's lichte
variant (een handvol billboardsheets) geeft genoeg.

**Een echte spiegelreflectie op het water (`Reflector`).** Tweede
scene-render voor één vlak dat de speler in één zone ziet, in het donker,
waar de reflectie toch grotendeels zwart met één lichtstreep is. De
fake-variant in F2 kost een fractie en is in dit licht nauwelijks te
onderscheiden.

**Meer echte lichten — in welke vorm dan ook.** Een rimlight per ondode, een
puntlicht per inslag, een lichtje bij elk winkelpunt: alle drie klinken
redelijk en alle drie zijn onbetaalbaar. Three.js' forward renderer
evalueert **elk** licht per **elk** verlicht fragment; 27 is al veel en 14
ondoden × 1 licht zou het aantal verdubbelen. De precedent staat al in de
code: bij de Smederij-visuals (regel ~3970) is een ember-puntlicht met een
bereik van 0,9 m er weer uitgehaald na een pixelmeting, met de notitie dat
zo'n licht "de fragment-shader evenveel kost als een lamp die een hele kamer
verlicht". Dat is de juiste regel en die zou ik niet verlaten. **Uitzondering:
A5, en juist omdat die het aantal niet verhoogt maar de schaduw-pass van zes
naar één brengt.**

**Overstappen op een ander renderpad (deferred, clustered, baked lighting).**
§8.10 legt dit al vast als "een herschrijving, geen optimalisatie", en dat
klopt. Het zou het hele materiaalsysteem (`mat()`, `matFamilie()`,
`userData.materiaalFamilie`) raken, waar de impact-deeltjeskleuren aan
hangen, en het past niet in een single-file bestand zonder buildstap.

**Geometrie-merging vóór een profiling-meting.** Ook al vastgelegd in §8.10:
het breekt `userData.materiaalFamilie`, dat T32's impactkleuren gebruiken.
Met 280 draw calls per frame is dit sowieso geen bottleneck — merging lost
een probleem op dat dit spel niet heeft.

**Fotorealistische materialen.** Een `envMap` over de hele scene (B5-zwaar)
plus fotorealistische texturen (B2 verkeerd uitgevoerd) trekt het spel naar
een look waarin je pas echt ziet dat alles dozen zijn. De stilering is hier
geen tekortkoming maar een keuze, en die zou ik versterken in plaats van
verlaten. Concreet: texturen mogen patroon en vuil toevoegen, geen
oppervlakterealisme.

**Extra postprocessing-pakketten van andere CDN's.** Alles wat ik voorstel
past binnen `three/addons/postprocessing/` (`ShaderPass` voor D1/D2/G2/G3)
of binnen handgeschreven GLSL. `postprocessing` (de populaire
derde-partij-bibliotheek van vanruesc) zou D1 makkelijker maken maar
introduceert een tweede CDN-afhankelijkheid en een tweede
versie-compatibiliteitsrisico — voor één pass die je in vijftig regels zelf
schrijft, is dat de verkeerde ruil. §7.9 noemt CDN-risico al expliciet als
aandachtspunt bij T60.

**E3 (doorschijnende ondode-silhouetten).** Niet omdat het duur is, maar
omdat het geen visuele beslissing is: het geeft de speler informatie die hij
nu niet heeft. Dat verandert het spel, en de brief vraagt uitdrukkelijk niet
om gameplayvoorstellen.

## 3.5 Vragen aan de eigenaar

1. **Rijker en donkerder, of leesbaarder en kleurrijker?** Dit hele document
   gaat ervan uit dat "mooier" betekent: dieper, tastbaarder, donkerder,
   filmischer. Als de wens juist is dat het spel *helderder en
   toegankelijker* wordt, kantelt gebied G volledig en verandert de
   volgorde in §3.3 ingrijpend.
2. **Welk performance-budget mag dit kosten, en op welke hardware?** Ik heb
   geen frametijdmeting op echte hardware (§1.9). Als de eis "60fps op een
   MacBook Air uit 2020 tijdens een volle golf" is, vallen A3, B3, B5, F3 en
   F5 in de risicozone en wordt de A5-vraag urgent. Als er een moderne GPU
   verondersteld mag worden, is er ruimte voor veel meer.
3. **Is §7.9 (één schaduwwerper) onderhandelbaar?** A5 stelt hem ter
   discussie met wat ik denk dat een goed argument is: van zes shadow-passes
   naar één, en van onzichtbaar naar dramatisch. Maar het is een expliciet
   vastgelegde invariant en dat verdient een expliciet antwoord, geen
   sluipende wijziging.
4. **Mag de wereld buiten de kaart bestaan?** Gebied I voegt een hemel en
   een skyline toe die er nu niet zijn. Dat is een sfeerbeslissing: het maakt
   de buitenzones opener, maar het maakt het pand ook minder afgesloten. Er
   is een goed argument voor "je ziet niets buiten, want dat is enger".
5. **Mag de laadtijd omhoog?** B2 genereert texturen bij het opstarten. Een
   volledige set van 512×512 kan honderden milliseconden kosten. Is dat
   acceptabel, of moet het spel binnen een vaste tijd starten?
6. **Mag er een instellingenmenu met visuele schakelaars komen?** D1, D5, A3
   en F3 zijn allemaal kandidaten voor "uit kunnen zetten". Het menu waar
   `muisgevoeligheid` (T75) en de geluidsknop al in staan, is de logische
   plek — maar dat is een UI-beslissing die buiten deze opdracht valt.
7. **Hoeveel iteratie is er beschikbaar?** De kern van dit document (B2,
   A2, A3) is niet "bouwen en klaar" maar "bouwen en dan twee weken kijken
   en bijstellen". Als die tijd er niet is, is laag 1 uit §3.3 een veel
   verstandiger einddoel dan een half afgemaakte laag 2.

## 3.6 Mijn oordeel: de ene ingreep

Als ik één ingreep mocht doen, zou het **A2 zijn — ingebakken hoekocclusie
via vertex colors**, met A1 (contactschaduwen) als onafscheidelijke
metgezel, want het is dezelfde gedachte op een andere schaal.

**Waarom precies die.** Mijn eigen DNA-beschrijving in §1.8 eindigt met de
kern van het probleem: *er is bijna geen informatie tussen de silhouetten
in, dus elk vlak leest als kleur in plaats van als materiaal*. Er zijn twee
manieren om dat op te lossen — je legt detail óp het vlak (gebied B), of je
geeft het vlak een waardestructuur (A1/A2). In een spel dat grotendeels
bijna-zwart is, wint de tweede manier overtuigend. Een prachtige
baksteentextuur op een muur die op vier lux staat, zie je niet. Een muur die
naar de hoek toe wegzakt in het donker, zie je altijd — want waardeverschil
is het enige signaal dat overleeft bij lage helderheid.

Daar komt bij dat A2 raakt wat je het vaakst ziet. De brief vraagt hoe het
spel loskomt van "low-poly met egale kleurvlakken", en de grootste egale
kleurvlakken in dit spel zijn de muren, vloeren en plafonds — samen verreweg
het meeste schermoppervlak. Elke andere richting verbetert een deel van het
beeld; A2 verbetert het deel dat er altijd is.

En dan het argument dat de doorslag geeft: **het kost niets.** Vertex colors
worden in de vertex shader geïnterpoleerd en in de fragment shader met de
basiskleur vermenigvuldigd — nul extra texture-samples, nul extra passes,
nul extra lichten. Op een scene waarvan §1.7 aannemelijk maakt dat hij
fragment-bound is, is een richting met zeer hoge impact en nul rendertijd
zeldzaam genoeg om hem als eerste te kiezen. Alle andere kandidaten voor
"grootste verschil" — A3's lichtkegels, B2's texturen, A5's gerichte
schaduw — kosten allemaal iets, en twee ervan kosten mogelijk te veel.

**Wat ik erbij zou zeggen.** A2 is niet de leukste ingreep en hij levert geen
spectaculaire screenshot op. Hij levert iets beters op: een beeld waarin
alle *andere* verbeteringen ineens werken. Afgeschuinde randen (C1) hebben
een donkere hoek nodig om tegen af te steken. Rimlight (E1) heeft een donkere
achtergrond nodig. Texturen (B2) hebben schaduwvariatie nodig om diepte te
suggereren. Zonder occlusie liggen die alle drie op een egaal aangelicht
vlak, en dan doen ze half werk.

Als de vraag was welke ingreep de mooiste screenshot oplevert, zou mijn
antwoord **A3** zijn: lichtkegels onder de lantaarns met stof dat erdoorheen
drijft. Maar de vraag was welke het grootste verschil maakt, en dat is de
ingreep waar de rest op kan staan.

---

*Geen enkele wijziging is voor dit document in de code aangebracht. De
gemeten cijfers in §1.7 komen uit een read-only Playwright-probe in de
scratchpad, die na afloop is verwijderd.*



