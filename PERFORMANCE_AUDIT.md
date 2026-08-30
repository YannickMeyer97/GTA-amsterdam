# Performance- en code-audit — Amsterdam Undead

**Datum:** 2026-08-30 · **Commit:** `3ba54f7` (Ticket 155) · **Bestand:**
`amsterdam-undead.html` (16 500 regels, 886 KB)

**Status: het rapport hieronder is de oorspronkelijke, ongewijzigde review
(uitsluitend meten, geen code aangeraakt). Ná afronding is in overleg met
de eigenaar bevinding A1 (§3.1) alsnog opgelost — dat is de enige
wijziging aan `amsterdam-undead.html` die volgde uit dit rapport. Zie de
kanttekening bij A1 hieronder voor wat er precies gebeurde.**

---

## 1. Executive summary

Het spel is in technisch opzicht in betere staat dan een audit gewoonlijk
aantreft. De CPU-kant van de game-loop is **geen bottleneck en kan dat op
de eigen spelplafonds ook niet worden**: `updateOndoden()` kost 0,030 ms
bij het harde maximum van 18 gelijktijdige ondoden (`GOLF_MAX_ACTIEF = 14`
+ `ZONE_MAX_ACTIEF_BONUS × 2`), en alle overige per-frame-functies samen
blijven onder 0,02 ms. Inclusief de matrix-traversal komt de totale
JavaScript-kost per frame uit op grofweg **0,2–0,3 ms van een budget van
16,7 ms**. Er is geen resource-lek: over vijf volledige spawn/opruim-cycli
blijven `renderer.info.memory.geometries` en `.textures` exact vlak.

De echte kosten zitten dus aan de **render-/GPU-kant**, en precies daar
kan deze omgeving niets betrouwbaars meten — de headless Chromium draait
op SwiftShader (CPU-rasterizer). Dat is niet theoretisch: bij de
verificatiemeting bleek het **uitzetten** van de bloom- of de
naverwerkingspass het renderen consequent *langzamer* te maken (527 ms →
928 ms). Dat is fysiek onmogelijk voor echt werk en betekent dat de meting
volledig gedomineerd wordt door SwiftShader-artefacten (welke pass
`renderToScreen` is, en dus de MSAA-resolve naar de default framebuffer
betaalt). **Elke uitspraak in dit rapport over GPU-kosten is daarom
architectuur-afgeleid, niet gemeten.** Ik label ze consequent als zodanig.

Het belangrijkste resultaat van deze audit is geen optimalisatie maar een
**bug**: `THREE.Points` (de twee stofwolken uit T40) zit in de `wereld`-
groep, en de wereld-raycast in `schiet()` leest onvoorwaardelijk
`raak[0].face.normal`. Een `Points`-treffer heeft `face === null`. Op een
raster van 91 realistische schietposities in het atelier is bij **20
posities (22 %)** een stofdeeltje de dichtstbijzijnde wereldtreffer.
Elk gemist schot vanaf zo'n positie gooit een `TypeError` die de rest van
`gameLoop()` — inclusief `updateOndoden()` en `composer.render()` — voor
dat frame overslaat.

Verder: twee concrete render-architectuurbevindingen (verspilde MSAA;
28 forward-lichten zonder culling, precies waar T79 al voor openstaat),
één gratis code-hoist, en een vrij lange lijst van dingen die ik expliciet
**niet** zou aanraken.

**Aantal bevindingen: 8.** Dat is bewust weinig. Ik heb ongeveer twintig
kandidaten getoetst en weggestreept omdat ze óf al opgelost waren, óf
gemeten verwaarloosbaar bleken, óf meer risico dan winst opleveren. Die
staan in §3.2 met de reden erbij, zodat ze niet in een volgende audit
opnieuw "ontdekt" worden.

---

## 2. Wat al goed is — niet aanraken

Dit is geen beleefdheidsparagraaf. Dit zijn optimalisaties die er *al*
zijn, met de meting erbij, zodat een volgende ronde ze niet opnieuw
voorstelt.

| Wat | Bewijs |
| --- | --- |
| **Scratch-vector-discipline** | Een allocatiescan over de volledige per-frame call-graph vond exact vijf allocatieplekken, alle vijf koud of onvermijdelijk (een template-string in de bannertekst bij golfovergang, twee `THREE.Color`-lerps in de fog-fade, één `.slice(1)` over 14 winkelmarkeringen, één style-string in de schadewedge). `updateOndoden()` gebruikt zeven module-scope `_tmp*`-vectoren met een expliciete anti-aliasing-toelichting. |
| **Effect-pools** | `TRACER_MAX`, `IMPACT_MAX`, `ROOK_MAX` zijn vast en vooraf gealloceerd; `actieveEffecten` is daardoor begrensd. Geen `setTimeout` meer in `schiet()`/`raakOndode()` (T70). |
| **Dispose-contract** | Vijf volledige spawn/opruim-cycli met 18 zichtbare ondoden: geometrieën 458 → 477 → 459, texturen 28 → 47 → 29, elke cyclus identiek. Geen lek. |
| **Herstart** | `location.reload()` (regel 6675/6681) — elke herstart is een verse pagina, dus in-page herstart-lekken bestaan per constructie niet. |
| **Throttling** | `updateMinimap` 20 Hz (0,008 ms per teken), `updateHUD` uit de hot path (T71), zone-label alleen bij wissel, dreigings-/muziek-/stadsaudio gethrottled. Allemaal al gedaan. |
| **Zombie V2-renderarchitectuur** | 1 draw call per ondode (2 voor de Brander), ogen als shaderregio in plaats van meshes, onzichtbare hitbox-proxies op een eigen layer zodat de high-detail SkinnedMesh nooit geraycast wordt. Dit is precies goed. |
| **Bloom-resolutie** | Bewust op 256×256 in plaats van schermresolutie, met de mipchain-redenering erbij. |
| **F3-overlay (T117)** | Frametijd + p95 + draw calls + triangles + geometrieën + texturen + lichten, met correct `renderer.info.autoReset = false`-beheer, en **nul kost als hij uitstaat**. Dit is het instrument waarmee de rest van dit rapport op echte hardware geverifieerd moet worden. |
| **Meetdiscipline in de repo** | `ZOMBIE_V2_BASELINE.md` zegt zelf al dat frametijden hier niet betrouwbaar meetbaar zijn; T79 staat expliciet "niet starten vóór de profiling-stap". Die houding klopt en dit rapport verandert daar niets aan. |

---

## 3. Bevindingen

Ernst-schaal: **P0** = bug · **P1** = waarschijnlijk betekenisvolle
winst · **P2** = kleiner maar nuttig · **P3** = onderhoudbaarheid ·
**NIET DOEN** = getoetst en afgeraden.

### 3.1 De bevindingen

---

#### **A1 — `THREE.Points` in `wereld` laat `schiet()` crashen** · P0 — **opgelost**

> **Nawoord.** Opgelost direct na dit rapport, via optie 1 hieronder: een
> nieuwe `WERELD_DECOR_LAYER` (zelfde patroon als T120's
> `ONDODE_MESH_LAYER`/`ONDODE_HITBOX_LAYER`), geënabled op de camera maar
> niet op de raycaster. `bouwStofwolk()` zet de `Points` daar nu op i.p.v.
> op layer 0. Geregressiedekt door het nieuwe `tests/test-decor-raycast.mjs`
> (6 checks, incl. het exacte positieraster hieronder en een echte
> `schiet()`-aanroep vanuit de stofkolom). Volledige regressiesuite:
> 96/96 groen (het ene incident tijdens de parallelle run —
> `test-levend-water.mjs`, een screenshot-determinisme-check die niets met
> raycasting/lagen te maken heeft — bleek 3× groen in isolatie: de bekende,
> al eerder gedocumenteerde CPU-contentie-flake van de 4-shard-runner, geen
> regressie van deze fix).

| | |
| --- | --- |
| **Categorie** | correctheid (bug) |
| **Bestand + regel** | `amsterdam-undead.html:5605` (`wereld.add(punten)`) → `:8715` (`intersectObject(wereld, true)`) → **`:8727` (`raak[0].face.normal`)** |
| **Ernst** | P0 |
| **Impact** | Elk gemist schot vanaf ~22 % van de atelier-vloer gooit een uncaught `TypeError`; het frame wordt niet gerenderd en alle spellogica in dat frame wordt overgeslagen. |
| **Confidence** | **Bewezen.** Exacte fout gereproduceerd, plus een positieraster. |

**Huidige situatie.** `bouwStofwolk()` (T40) maakt twee `THREE.Points`-
objecten (22 deeltjes elk) en hangt ze in `wereld`. `schiet()` doet op het
misser-pad `raycaster.intersectObject(wereld, true)` en leest daarna
onvoorwaardelijk `raak[0].face.normal`.

**Waarom dit een probleem is.** Drie dingen komen samen:

1. `Points.raycast()` levert intersecties met **`face: null`** op —
   `Points` heeft geen faces. `raak[0].face.normal` gooit dan
   `TypeError: Cannot read properties of null (reading 'normal')`.
   *Gereproduceerd, letterlijk deze melding.*
2. `raycaster.params.Points.threshold` staat nergens gezet en is dus de
   Three.js-default **1,0** — de straal hoeft maar binnen één meter van
   een deeltje te passeren. Dat is enorm ruim.
3. `Raycaster.intersectObject()` test **alleen `object.layers`, nooit
   `object.visible`** (geverifieerd in de three-r160-bron,
   `three.module.js:51042`). De wolken staan buiten het atelier op
   `visible = false`, maar zijn nog volledig raycastbaar. Het probleem
   bestaat dus ook wanneer er niets te zien is.

**Bereikbaarheid, gemeten.** Raster van 91 realistische standposities in
het atelier (x −3…+3 m, z +2…+8 m rond de kolom), horizontaal schot op
ooghoogte 1,6 m: bij **20 van de 91 posities (22 %)** is een stofdeeltje
de eerste wereldtreffer, op afstanden van 2,05 m tot 8 m. Dat is precies
het midden van het atelier, onder het dakraam.

**Gevolg in de game-loop.** `probeerTeSchieten()` staat op regel 15551,
midden in `gameLoop()`, zonder `try`/`catch`. `requestAnimationFrame()`
staat op regel 15536 (de eerste regel), dus de loop overleeft — maar
alles ná de worp wordt dat frame overgeslagen: `updateWapen`,
`updateOndoden`, `updateGolf`, `updateEffecten` én `composer.render()`.
Voor de speler is dat een bevroren frame plus een schot dat geen inslag,
geen rook en (AMSTEL-9 niveau 2) geen explosie oplevert. De
`window.addEventListener('error')` op regel 592 is gated op
`!window.AmsterdamUndeadDebug` en toont dus terecht geen CDN-banner — de
fout is voor de speler volledig stil. *(Dit gevolg is uit de code
afgeleid, niet in de draaiende game gereproduceerd; de `TypeError` zelf
wél.)*

**Oplossing (drie opties, mijn voorkeur is 1).**

1. **De stofwolken uit het raycast-pad halen** — dezelfde
   layer-architectuur die T120 al voor de ondode-meshes gebruikt: geef de
   `Points` een eigen laag die de camera wél en de raycaster niet enablet.
   Past bij het bestaande patroon, één regel per wolk, en lost het
   principieel op (ook voor toekomstige niet-mesh-decor).
2. `raak[0].face` defensief testen en zulke treffers overslaan. Kleinste
   diff, maar behandelt het symptoom en laat de deeltjes wel schoten
   "blokkeren" in de tracer-lengte.
3. `raycaster.params.Points.threshold = 0` — vermindert de kans, sluit
   hem niet uit, en is een gedeelde raycaster-instelling (zelfde valkuil
   als `raycaster.far` in `steekMes()`).

**Risico.** Optie 1 raakt niets zichtbaars: de camera blijft de wolken
renderen, alleen de raycaster ziet ze niet meer. Geen enkel element uit de
beschermde lijst (schade, hitboxes, spawn, verlichting, timing) verandert.

**Meetmethode.** Een regressietest die het positieraster hierboven
herhaalt en assert dat `intersectObject(wereld, true)[0].face !== null`
vanaf elke positie — en dat `schiet()` vanaf al die posities zonder worp
doorloopt. Plus `test-inslagen.mjs`/`test-omgeving-sfeer.mjs` groen.

---

#### **A2 — `antialias: true` levert nul beeldwinst en betaalt wel** · P1

| | |
| --- | --- |
| **Categorie** | GPU / bandbreedte |
| **Bestand + regel** | `:727` (`new THREE.WebGLRenderer({ antialias: true })`) t.o.v. `:745` (`new EffectComposer(renderer)`) |
| **Ernst** | P1 |
| **Impact** | Een 4× multisample-buffer op volledige schermresolutie wordt elk frame gealloceerd én geresolved, terwijl er geen enkele geometrierand doorheen gaat. |
| **Confidence** | **Hoog op het mechanisme** (uit de renderer-state en de three-bron geverifieerd), **niet gemeten** wat het kost. |

**Huidige situatie.** Gemeten renderer-state:
`{"antialias":true,"samples":4,"pixelRatio":1,"drawingBuffer":[1280,720]}`.
Gemeten composer-state:
`{"passes":4,"rt1":{"w":1280,"h":720,"samples":0,"type":1016}}`.

**Waarom dit een probleem is.** `antialias: true` zet MSAA op de
**default framebuffer**. De scene wordt door `RenderPass` echter naar
`composer.renderTarget1` gerenderd, en die is in three r160 aangemaakt
*zonder* `samples`-optie — dus `samples: 0`, niet multisampled
(geverifieerd in `EffectComposer.js`). Het enige dat ooit naar de
gemultisamplede default framebuffer tekent, is de full-screen quad van
`OutputPass`: twee driehoeken die het hele scherm vullen en waarvan de
enige randen de schermranden zijn. Er is dus letterlijk niets om te
antialiassen. De multisample-buffer wordt wel gealloceerd (4× de
kleurbuffer-bandbreedte) en elk frame geresolved.

Dit is geen "misschien" — het is een architectuurfeit dat direct uit de
twee gemeten state-objecten volgt. Wat het in milliseconden kost, is dat
wél: dat hangt volledig van de GPU en de resolutie af en is hier niet te
meten.

**Oplossing — dit is een keuze, geen fix.**

- **A.** `antialias: false`. De MSAA-buffer verdwijnt. **Het beeld
  verandert niet**, want de MSAA deed al niets. Puur besparing.
- **B.** `antialias: false` én de composer een gemultisamplede render
  target geven (`new THREE.WebGLRenderTarget(w, h, { samples: 4 })` als
  vierde constructorargument van `EffectComposer`). Dan krijgt de scene
  **echte** antialiasing op alle geometrieranden — een zichtbare
  beeldverbetering die vandaag ontbreekt — tegen reële kosten.

A en B zijn tegengesteld: A koopt performance, B koopt beeldkwaliteit die
er nu ten onrechte voor betaald wordt. Beide zijn beter dan de huidige
stand, die betaalt zonder te leveren. Dit is een eigenaarskeuze.

**Risico.** A: geen visueel risico (bewijsbaar geen effect). B: raakt het
hele beeld en dus de T88-helderheidskalibratie — die moet met dezelfde
pixelmeting opnieuw gecontroleerd worden.

**Meetmethode.** F3-overlay op echte hardware, frametijd + p95, vanuit een
vast standpunt, voor/na. Plus voor B de T88-luminantiemeting per zone.

---

#### **A3 — 28 forward point lights zonder culling (T79 staat al open)** · P1

| | |
| --- | --- |
| **Categorie** | GPU / fragmentkost |
| **Bestand + regel** | scene-breed; 21 `new THREE.PointLight(...)`-plekken, `lampLichten` (10 stuks) is de grootste groep |
| **Ernst** | P1 |
| **Impact** | Three.js' forward renderer evalueert **elke** lichtbron voor **elk** verlicht fragment, ongeacht afstand of zichtbaarheid. Dit is architecturaal de grootste fragmentkost van het spel. |
| **Confidence** | **Mechanisme zeker, omvang onbekend.** Niet gemeten. |

**Huidige situatie.** Gemeten: 28 lichten in de scene, waarvan 1
schaduwwerpend. Het spel speelt zich af in vijf zones die elkaar
grotendeels niet zien; de speler staat altijd in precies één ervan.

**Waarom dit een probleem is.** Er is geen light-culling in de
basisrenderer. Ook een lamp in de kelder, achter twee dichte deuren, zit
in de shader-uniforms van elke muur op de binnenplaats. Dit raakt vooral
integrated en mobiele GPU's, en het schaalt met de schermresolutie — dus
op een Retina-scherm met `devicePixelRatio 2` viervoudig.

**Oplossing.** Dit is exact **T79**, dat al gepland is met de juiste gate
erop ("niet starten vóór de profiling-stap"). Mijn advies is die gate te
respecteren en er niets aan te veranderen behalve dit: de profiling-stap
kan nu, want het instrument (F3-overlay) bestaat sinds T117 en de
`ZOMBIE_V2_BASELINE`-cijfers zijn er. **Concreet meetplan:** zet vanuit de
console een deel van `lampLichten` op `visible = false` en lees de
F3-frametijd op echte hardware. Verandert p95 niet meetbaar → sluit T79
zonder wijziging (dat is een geldige uitkomst en scheelt een risicovolle
ingreep). Verandert hij wel → T79 uitvoeren met de pixelmeting-vangrail
die het ticket al voorschrijft.

**Risico.** Hoog als het blind gebeurt: T79's eigen randgevallen noemen de
zwaar getunede helderheidsbalans (§7.5.5–7.5.10, vier feedbackrondes), de
Stroomuitval-interactie, en zichtlijnen tussen zones (van de binnenplaats
kijk je de bijkeuken in — een licht daar hard uitzetten geeft een
zichtbare pop). Niet doen zonder de meting.

**Meetmethode.** F3-overlay, echte hardware, per zone. Zie hierboven.

---

#### **A4 — Schaduw-cubemap wordt elk frame volledig herbouwd** · P1

| | |
| --- | --- |
| **Categorie** | GPU / render |
| **Bestand + regel** | `:730-731` (`shadowMap.enabled/type`), `:5143` (`shadow.mapSize.set(256,256)`), `:5153` (`hangLamp(-1.8, -3, true)` — de enige schaduwwerper) |
| **Ernst** | P1 |
| **Impact** | Zes cube-faces × 43 `castShadow`-meshes worden elk frame opnieuw gerasterd, terwijl het licht statisch is en verreweg de meeste casters dat ook zijn. |
| **Confidence** | **Mechanisme zeker** (`shadowMap.autoUpdate` staat nergens uit, dus de Three.js-default `true`). **Omvang niet betrouwbaar gemeten** — zie hieronder. |

**Huidige situatie.** Eén schaduwwerpende `PointLight` op een vaste plek in
de startkamer, `mapSize` al verstandig teruggebracht naar 256×256 met een
pixelmeting-onderbouwing in de code. 43 meshes hebben `castShadow = true`.

**Waarom dit een probleem is.** Een `PointLight`-schaduw is een cubemap:
zes render-passes per frame. Het licht beweegt nooit. De enige dynamische
casters zijn de ondoden en het wapenmodel. De statische meubels, muren en
gevels worden dus 6× per frame voor niets opnieuw getekend.

**Wat de meting hier wél en niet zei.** Met `shadowMap.autoUpdate = false`
zakte de SwiftShader-rendertijd reproduceerbaar van ~528 ms naar ~285 ms
(twee onafhankelijke ronden gaven 527/530 en 285/286). Dat suggereert dat
de schaduwpas een substantieel deel van het rasterwerk is. **Maar** in
dezelfde meetreeks maakte het uitzetten van de bloompass het renderen
*trager* (546 ms) en het uitzetten van de naverwerkingspass nog trager
(928 ms) — fysiek onmogelijk, en het bewijs dat SwiftShader hier de
uitkomst bepaalt. Ik hecht daarom **geen** waarde aan het getal en label
dit als architectuur-afgeleid.

**Oplossing.** Niet direct ingrijpen. Three.js heeft geen ingebouwde
statisch/dynamisch-schaduwsplit; de enige knop is
`shadowMap.autoUpdate = false` met een handmatige `needsUpdate` op een
lagere cadans — en dat betekent dat **ondode-schaduwen achterlopen op de
ondode zelf**, wat direct de beschermde lijst raakt (lighting, zombie
movement). Dit hoort thuis in dezelfde profiling-stap als A3, en pas
daarna als apart ticket.

**Risico.** Hoog bij een naïeve implementatie (schaduwen die "hikken"
achter bewegende ondoden aan). Laag als het bij meten blijft.

**Meetmethode.** F3-overlay op echte hardware met
`renderer.shadowMap.autoUpdate` aan/uit vanuit de console, vanuit een
standpunt in de startkamer waar de schaduw daadwerkelijk in beeld is.

---

#### **A5 — Doorboring doet dezelfde wereld-raycast meerdere keren per schot** · P2

| | |
| --- | --- |
| **Categorie** | CPU / hot path |
| **Bestand + regel** | `amsterdam-undead.html:8696` |
| **Ernst** | P2 |
| **Impact** | 0,192 ms per overbodige aanroep, 1–3× extra per Doorboring-schot. |
| **Confidence** | **Gemeten** (kosten) en **zeker** (lus-invariantie volgt uit de code). |

**Huidige situatie.**

```js
for (let i = 1; i < ondodeRaak.length; i++) {
  let obj2 = ondodeRaak[i].object;
  while (obj2 && !obj2.userData.ondode) obj2 = obj2.parent;
  if (!obj2 || obj2.userData.ondode === obj.userData.ondode) continue;
  const muurErtussen = raycaster.intersectObject(wereld, true);   // <- lus-invariant
  ...
}
```

**Waarom dit een probleem is.** De `raycaster` wordt binnen de lus niet
aangeraakt, dus `muurErtussen` is elke iteratie identiek. En de lus doet
juist vaak meerdere iteraties: een ondode heeft meerdere hitbox-proxies
(kop én lichaam), dus `ondodeRaak` bevat regelmatig 2–3 treffers op
*dezelfde* ondode, die allemaal via `continue` worden overgeslagen — met
telkens een verse raycast over 634 meshes ervoor.

**Gemeten.** `intersectObject(wereld, true)` = **0,192 ms** per aanroep
(400 metingen, 634 meshes, 745 objecten in `wereld`). Een
Doorboring-schot betaalt dat dus 1–3× extra, oftewel 0,2–0,6 ms boven op
het schot. Onder één frame, maar volledig gratis weg te halen.

**Oplossing.** De aanroep vóór de lus hijsen. Het resultaat is per
constructie identiek — dit is een pure hoist, geen gedragswijziging.

**Risico.** Nul. Geen enkele beschermde eigenschap verandert: dezelfde
straal, dezelfde treffers, dezelfde schade, dezelfde
`RIPPER_DOORBORING_SCHADEFACTOR`.

**Meetmethode.** `test-arsenaal.mjs` en `test-smederij.mjs` blijven groen
(die dekken het Doorboring-gedrag al met een omstander-opstelling).

---

#### **A6 — Eerste `spawnOndode()` van een run kost 20 ms** · P2

| | |
| --- | --- |
| **Categorie** | CPU / frametijd-piek |
| **Bestand + regel** | `:11526` (`spawnOndode`) → `:11165` (`maakOndodeModelV2`) |
| **Ernst** | P2 |
| **Impact** | Eén zichtbare hapering van ~20 ms bij de eerste spawn van golf 1. |
| **Confidence** | **Gemeten.** |

**Huidige situatie, gemeten over 24 opeenvolgende spawns:**

| spawn | 1 | 2 | 3 | 4 | 5 | 6–24 |
| --- | --- | --- | --- | --- | --- | --- |
| ms | **20,1** | 4,3 | 5,6 | 4,0 | 1,8 | 1,0–2,5 (mediaan **1,5**) |

Per type: Sjouwer 1,3 ms, Brander 1,2 ms — geen typeverschil.

**Waarom dit (beperkt) een probleem is.** `maakOndodeModelV2()` bouwt per
ondode ~12 procedurele geometrieën (loft-profielen, een vervormde
schedel), voegt ze samen met `mergeGeometries()`, zet skin-attributen en
disposet de bronnen. Dat is **bewust** niet gecachet — de traits gebruiken
continue `Math.random()`-waarden (`armVerschil`, `rugHoek`, tint,
vervalplekken), dus elke ondode is echt uniek. De steady-state 1,5 ms
landt op precies één frame per spawn-interval (`GOLF_SPAWN_INTERVAL = 1,1`
s, tot 0,79 s bij drie zones) — ~9 % van één frame op ~1 frame per 50. Dat
is geen hapering. De **20 ms van de eerste spawn** is dat wel: dat is een
gemist frame, precies op het spannendste moment van de run.

De 20 ms is JIT-/warmloopkost (de meting deed geen enkele render), niet
shadercompilatie.

**Oplossing.** Eén weggooi-ondode bouwen tijdens het laden (bouwen +
meteen `ruimGroepOp()`), zodat het warmloopwerk in het laadscherm valt in
plaats van in golf 1. Kosten: ~20 ms extra laadtijd op een pagina die nu
~800 ms laadt.

**Waarom ik dit toch maar P2 noem.** Het is één frame, één keer per run.
Als de eigenaar dit in de praktijk nooit merkt, is niets doen een prima
uitkomst — het is geen bug.

**Risico.** Laag, maar niet nul: de weggooi-ondode mag niet in `ondoden`
of `ondodenGroep` belanden en moet netjes gedisposed worden, anders raakt
het T70-dispose-contract vervuild. `test-resources.mjs` moet dat afdekken.

**Meetmethode.** Dezelfde spawn-timing-meting, met de verwachting dat
spawn 1 dan op ~1,5 ms uitkomt. Plus `test-resources.mjs` groen.

---

#### **A7 — `setPixelRatio()` wordt niet opnieuw toegepast bij resize** · P3

| | |
| --- | --- |
| **Categorie** | correctheid (klein) |
| **Bestand + regel** | `:729` (`setPixelRatio`) vs. `:1097-1102` (resize-handler) |
| **Ernst** | P3 |
| **Impact** | Na browser-zoom of het verslepen van het venster naar een scherm met een andere DPI rendert het canvas op de oude pixelratio: onscherp of onnodig zwaar. |
| **Confidence** | Zeker (uit de code). |

**Huidige situatie.** De resize-handler doet `camera.aspect`,
`updateProjectionMatrix()`, `renderer.setSize()` en `composer.setSize()` —
correct — maar niet `renderer.setPixelRatio()`. `devicePixelRatio`
verandert wél bij browser-zoom. Bijkomend: `EffectComposer` bevriest
`renderer.getPixelRatio()` in zijn constructor, dus ook `composer` blijft
op de oude waarde hangen tot `composer.setPixelRatio()` wordt aangeroepen.

**Oplossing.** Twee regels in de bestaande resize-handler.

**Risico.** Laag. Wel opletten dat de T88-pixelmetingen een vaste
viewport gebruiken (dat doen ze).

---

#### **A8 — `devicePixelRatio`-plafond van 2 is de grootste beschikbare knop** · P3 (beslissing, geen fix)

| | |
| --- | --- |
| **Categorie** | GPU / eigenaarskeuze |
| **Bestand + regel** | `:729` |
| **Confidence** | Mechanisme zeker; effect niet gemeten. |

Op een Retina-laptop (`devicePixelRatio = 2`) rendert een venster van
1440×900 CSS-pixels op 2880×1800 = 5,2 megapixel. Elk van die fragmenten
loopt door 28 forward-lichten (A3) en vier composer-passes. Een plafond
van 1,5 in plaats van 2 halveert het fragmentwerk bijna, ten koste van
scherpte.

Dit is **geen bug en geen aanbeveling** — het is de knop met verreweg de
grootste hefboom, en de enige waarop de eigenaar met de F3-overlay in
dertig seconden zelf een oordeel kan vellen. Ik noem hem hier zodat hij
bewust is, niet omdat hij verzet moet worden.

---

### 3.2 Getoetst en bewust afgeraden — **NIET DOEN**

Deze staan er expliciet in zodat een volgende audit ze niet opnieuw
"ontdekt".

| Voorstel | Waarom niet |
| --- | --- |
| **`matrixAutoUpdate = false` op de statische wereld** | **Gemeten:** een volledige `updateMatrixWorld()` over 1 059 objecten kost **0,17 ms** — ~1 % van het frame. En geforceerd (0,170 ms) vs. normaal (0,161 ms) is vrijwel gelijk, dus er valt hooguit 0,15 ms te halen. Het risico is groot en stil: elk object dat later tóch beweegt (deuren, barricadeplanken, roterende winkelicoontjes, omvallende lijken, de boot) stopt zonder foutmelding met bewegen. Slechte ruil. |
| **Zombie-AI / `updateOndoden()` optimaliseren** | **Gemeten:** 1,2–1,9 µs per ondode. Bij het harde plafond van 18 gelijktijdige ondoden is dat **0,030 ms = 0,18 % van een frame**. Er is niets te halen. |
| **Spatial index / BVH voor de wereld-raycast** | 0,192 ms, en alleen op frames waarin geschoten wordt. Een BVH betekent bovendien een externe afhankelijkheid — verboden door de single-file-regel. Los A5 op (gratis) en laat de rest. |
| **Ondode-geometrie cachen** | De traits gebruiken continue `Math.random()`-waarden; cachen vereist kwantiseren en dat vermindert de zichtbare variatie. Dat is het hele punt van V2. |
| **`knokRichting`/`flinch`-allocatie poolen** (`:13324`) | Eén kleine `Vector3` + één objectliteral per **overlevende** treffer, en het is *bewaarde state*, geen scratch. Bij ~10 treffers/s is dat verwaarloosbare GC-druk; poolen van bewaarde waarden voegt alleen aliasing-risico toe. |
| **`.slice(1)` in `updateWinkelMarkeringen`** | **Gemeten:** de héle functie kost 0,0044 ms voor 14 markeringen, en de lus `continue`t al meteen op gekochte winkels. |
| **Minimap/HUD/interacties verder throttlen** | **Gemeten:** `tekenMinimap` 0,008 ms op 20 Hz, `updateInteracties` 0,0013 ms. Al klaar (T67/T71/T72). |
| **Ondoden instancen (`InstancedMesh`)** | Onmogelijk zonder de per-ondode identiteit op te geven: elke ondode heeft eigen skinning, een eigen huidtint (T104) en een eigen oogpuls-uniform. 1 draw call per ondode is al het optimum voor deze architectuur. |
| **De `stervenden`-lijst begrenzen** | Al begrensd — er kunnen nooit meer lijken zijn dan het ondode-plafond van 18, en ze worden na `STERVEN_DUUR` gedisposed. |
| **De naverwerkingsshader vereenvoudigen** | Hij doet 3 texture-samples per pixel (de chromatische aberratie) en verder alleen ALU. Dat is voor een full-screen pass zuinig, en de aberratie is een bewuste designkeuze uit T96. Niets aan te doen zonder het effect te verliezen. |

---

## 4. Top 5

1. **A1 — de `Points`-crash in `schiet()`.** Het enige echte defect in
   dit rapport, bewezen reproduceerbaar, met een nette oplossing die het
   bestaande layer-patroon van T120 hergebruikt. Dit staat los van alle
   performancevragen en zou als eerste opgelost moeten worden.
2. **A2 — de verspilde MSAA.** Het spel betaalt vandaag voor
   antialiasing die aantoonbaar niets doet. Of je stopt met betalen
   (optie A, nul visueel risico) of je gaat het krijgen (optie B). De
   huidige stand is de enige die geen zin heeft.
3. **A3 — de profiling-stap van T79 daadwerkelijk uitvoeren.** Niet het
   ticket, de *meting*. Het instrument bestaat sinds T117. De uitkomst
   mag heel goed "sluiten zonder wijziging" zijn — dan is er een
   risicovol ticket minder.
4. **A5 — de lus-invariante raycast hijsen.** Gratis, aantoonbaar
   gedragsidentiek, 0,2–0,6 ms per Doorboring-schot.
5. **A4 — de schaduwcubemap meenemen in diezelfde profiling-stap.** Niet
   apart aanpakken; het is dezelfde meting op echte hardware, en zonder
   die meting is elke ingreep hier een gok die de belichting raakt.

---

## 5. CPU versus GPU

**De CPU is niet de bottleneck, en kan dat op de eigen spelplafonds ook
niet worden.** Alles hieronder is gemeten in deze omgeving; JavaScript-
kosten zijn hier wél representatief (dezelfde V8 als op de desktop).

| Onderdeel | Kosten per frame | % van 16,7 ms |
| --- | --- | --- |
| `updateOndoden()` bij 18 ondoden (het harde plafond) | 0,030 ms | 0,18 % |
| `scene.updateMatrixWorld()` over 1 059 objecten | 0,17 ms | 1,0 % |
| `updateWinkelMarkeringen()` (14 markeringen) | 0,0044 ms | 0,03 % |
| `updateInteracties()` (14 punten) | 0,0013 ms | 0,01 % |
| `tekenMinimap()` (20 Hz, dus 1 op 3 frames) | 0,008 ms | 0,05 % |
| `losBotsingenOp()` per aanroep (58 obstakels) | 0,000284 ms | — |
| `zoneVan()` per aanroep | 0,000012 ms | — |
| **Totaal JS per frame, ruwe schatting** | **0,2–0,3 ms** | **~1,5 %** |

Niet-elk-frame, maar wel het noemen waard:
`intersectObject(wereld, true)` 0,192 ms (per schot),
`intersectObject(ondodenGroep, true)` 0,0098 ms bij 24 ondoden (per
schot), `spawnOndode()` 1,5 ms mediaan (per spawn, dus ~1× per seconde).

**De GPU-kant is hier niet meetbaar.** Dat is geen slag om de arm maar een
vastgesteld feit: in de verificatiereeks werd het renderen *sneller* met
de bloompass **aan** dan uit (528 ms vs. 546 ms) en fors sneller met de
naverwerkingspass aan dan uit (528 ms vs. 928 ms). Zulke omkeringen
kunnen alleen ontstaan doordat SwiftShader (CPU-rasterizer) de meting
domineert — welke pass toevallig `renderToScreen` is en dus de
MSAA-resolve naar de default framebuffer betaalt, bepaalt de uitkomst meer
dan het werk zelf. **Ik heb daarom geen enkel GPU-getal in dit rapport
als winst geclaimd.** A2, A3, A4 en A8 zijn stuk voor stuk uit de
render-architectuur en de gemeten renderer-*state* afgeleid, niet uit
frametijden.

Wat wél als GPU-signaal betrouwbaar is, zijn de tellingen (die komen uit
`renderer.info`, niet uit een klok), bij 1280×720 met manuele
`info.reset()` vóór de render:

| ondoden | draw calls | driehoeken | texturen |
| --- | --- | --- | --- |
| 0 | 633 | 50 475 | 28 |
| 10 | 643 | 69 435 | — |
| 18 | 685 | 103 851 | 47 |
| 30 | 715 | 160 731 | — |
| 45 | 760 | 246 051 | 132 |

Dat is ~1 draw call en ~3 000 driehoeken per ondode: precies wat de V2-
architectuur belooft. 685 draw calls bij vol spel is voor een desktop-
browser ruim binnen de marge; de fragmentkant (28 lichten × pixelratio²)
is waar het geld zit.

**Conclusie:** dit is een fragment-/fill-rate-gebonden spel, niet een
CPU- of draw-call-gebonden spel. Elke minuut die in CPU-optimalisatie
gaat zitten, is een verspilde minuut.

---

## 6. Schaalbaarheid

**Aantal ondoden.** Het plafond is hard: `GOLF_MAX_ACTIEF = 14` plus
`ZONE_MAX_ACTIEF_BONUS = 2` per ontgrendelde zone boven de eerste,
gecapt op drie zones → **18**. `updateGolf()` spawnt bovendien altijd
precies één ondode per `spawnTimer`-tick, nooit een batch, dus de 1,5 ms
spawnkost landt nooit gestapeld op één frame. Bij 18 ondoden is de
CPU-kant 0,030 ms en zijn er 685 draw calls. **Er is geen
schaalbaarheidsprobleem, en de metingen tot 60 ondoden (0,115 ms) laten
zien dat er ook geen zou zijn als het plafond verdrievoudigde.**

**Aantal wereldobjecten.** 1 059 objecten in de scene, 745 in `wereld`,
634 meshes, 58 collision-obstakels, 28 lichten, 14 interactiepunten. De
twee plekken die lineair meeschalen met dit aantal zijn de wereld-raycast
(0,192 ms, alleen bij schoten) en de matrix-traversal (0,17 ms, elk
frame). Beide schalen mild en beide zijn nu al klein. Een nieuwe zone
erbij (~+150 objecten) zou die twee met ~20 % verhogen: 0,03 ms extra per
frame. Verwaarloosbaar.

**Waar het wél gaat knellen bij uitbreiding.** Niet bij objecten of
ondoden, maar bij **lichten**. Elke nieuwe zone brengt lampen mee, en die
kosten niets in de CPU-tellingen hierboven maar wel in elk fragment van
het hele scherm — óók fragmenten in zones waar dat licht niet komt. Met
28 lichten is dat vandaag al de zwaarste post; bij 40 wordt A3 van
"waarschijnlijk de moeite" naar "vrijwel zeker nodig". **Advies: koppel
elke toekomstige zone-uitbreiding aan een F3-meting, en beschouw T79 als
voorwaarde voor zone 6.**

**Sessieduur.** Geen lek gevonden over vijf spawn/opruim-cycli, en
herstart is een volledige `location.reload()`. Lange sessies zijn geen
risico.

---

## 7. Architectuuradvies

**Het single-file-model is hier geen probleem en moet zo blijven.** Bij
16 500 regels is dat een legitieme vraag, maar de repo heeft er al een
antwoord op dat aantoonbaar werkt: datagestuurde tabellen
(`ARSENAAL`, `GELUIDEN`, `GROM_PROFIELEN`, `ONDODE_TYPES`,
`AANVAL_PROFIELEN`, `WINKEL_STIJLEN`) in plaats van modulesplitsing, met
grep-audits in de tests die verbieden dat gedrag daarbuiten wordt
gedupliceerd. T155 liet zien dat dat patroon schaalt. Ik zou het
uitbreiden, niet vervangen.

**Wat ik wél zou aanscherpen, is de raycast-laag.** A1 is geen toevallige
bug maar een architectuurgat: `wereld` is tegelijk "alles wat gerenderd
wordt" én "alles waar je op kunt schieten", en die twee zijn niet
hetzelfde. T120 heeft dat onderscheid voor de ondoden al netjes gemaakt
met `ONDODE_MESH_LAYER`/`ONDODE_HITBOX_LAYER`. Datzelfde denken ontbreekt
aan de wereldkant, en daardoor kon puur decor (stofdeeltjes) in het
schietpad belanden. **Advies: trek de layer-conventie door naar de
wereld** — een expliciete `DECOR_LAYER` voor alles wat wel zichtbaar maar
niet raakbaar is, met een testregel die assert dat elk niet-`Mesh`-
renderable in `wereld` op die laag staat. Dat lost A1 op én voorkomt de
volgende variant ervan.

**Tweede aanscherping: maak de renderconfiguratie expliciet.** A2 kon
ontstaan doordat `antialias: true` (regel 727) en de composer (regel 745)
onafhankelijk van elkaar zijn ingesteld, achttien regels uit elkaar, en
niemand de interactie tussen die twee heeft opgeschreven. Er staat veel
uitstekende toelichting in dit bestand — over de bloomresolutie, over
`info.autoReset`, over waarom de korrel multiplicatief is — maar niet
over de MSAA-keten. **Advies: één commentaarblok bij de renderer dat
vastlegt welke buffer welke sampling heeft en waarom**, in dezelfde stijl
als de bestaande blokken. Dat is geen documentatie om de documentatie: het
is precies het soort blok dat deze bug had voorkomen.

**Derde: de meetdiscipline verdient een vaste plek.** `AUDIO.md` heeft
laten zien wat er gebeurt als een test nominale getallen vergelijkt in
plaats van het echte effect te meten (de T154-ruiskalibratie zat er 5–23
dB naast met een groene test). Dit rapport heeft dezelfde vorm gevonden
aan de renderkant: de headless suite kan de GPU-kant niet zien en zal
daarover ook nooit alarm slaan. **Advies: leg in `ARCHITECTURE_NOTES.md`
vast dat renderkosten uitsluitend via de F3-overlay op echte hardware
beoordeeld worden, en dat een groene headless suite daar expliciet geen
uitspraak over doet.** Dat is de conclusie die deze audit het langst
houdbaar maakt.

---

## 8. Voorgestelde implementatievolgorde

Elke stap is los af te ronden, met een eigen groene testsuite ertussen.

**Stap 1 — A1: de `Points`-crash.** Los, klein, en het enige echte defect.
Via de layer-oplossing (optie 1), met de positieraster-test erbij. Geen
enkele beschermde eigenschap verandert. *Sonnet solo: ja.*

**Stap 2 — A5: de lus-invariante raycast hijsen.** Twee regels, bewijsbaar
gedragsidentiek, gedekt door bestaande tests. Kan meeliften op stap 1 of
apart. *Sonnet solo: ja.*

**Stap 3 — A7: `setPixelRatio()` in de resize-handler.** Twee regels,
correctheidsfix. *Sonnet solo: ja.*

*Na stap 3 is alles gedaan wat zonder metingen op echte hardware
verantwoord is.*

**Stap 4 — de profilingsessie (eigenaar, echte hardware, ~30 minuten).**
Dit is de scharnierstap; alles daarna hangt ervan af. Met de F3-overlay,
vanuit twee vaste standpunten (startkamer met de schaduw in beeld, en de
binnenplaats met zicht op de bijkeuken), telkens frametijd + p95 noteren:

1. basislijn;
2. `renderer.shadowMap.autoUpdate = false` (→ A4);
3. de helft van `lampLichten` op `visible = false` (→ A3);
4. `renderer.setPixelRatio(1)` (→ A8);
5. basislijn opnieuw, om drift uit te sluiten.

Vier getallen, en daarmee is de rest van dit rapport beslisbaar in plaats
van speculatief.

**Stap 5 — A2: de MSAA-keuze.** Kan technisch al eerder, maar hoort na
stap 4 omdat de meting laat zien of optie B (echte AA erbij) budgettair
past. Optie A is altijd veilig. Bij B: T88-pixelmeting per zone opnieuw.

**Stap 6 — A3/T79, alleen als stap 4 het rechtvaardigt.** Met de
vangrails die het ticket zelf al voorschrijft. **Als stap 4 geen meetbaar
verschil laat zien: sluit T79 zonder wijziging** — dat is een geldige en
waardevolle uitkomst.

**Stap 7 — A4, alleen als stap 4 het rechtvaardigt.** Apart ticket, na
T79, met expliciete aandacht voor achterlopende ondode-schaduwen.

**Stap 8 — A6 (spawn-warmloop), optioneel.** Alleen als de eigenaar de
hapering bij de eerste spawn daadwerkelijk merkt. Anders overslaan.

---

## Bijlage — hoe er gemeten is

Alle metingen zijn gedaan met tijdelijke Playwright-scripts tegen de
échte `amsterdam-undead.html` (lokale Chromium, CDN-intercept die
`three.module.js` lokaal serveert, viewport 1280×720), via
`window.AmsterdamUndeadDebug`. Die scripts zijn na afloop verwijderd; de
werkboom is onveranderd (`git status` schoon op `3ba54f7`).

Timings zijn gemiddelden over 200–2 000 aanroepen na een warmloop.
`renderer.info`-tellingen zijn gelezen met `autoReset = false` en een
handmatige `reset()` vóór de render, omdat `composer.render()` intern
meerdere `renderer.render()`-aanroepen doet.

**Wat níet gemeten kon worden:** frametijden en alles wat van
GPU-rasterisatie afhangt. De omgeving gebruikt SwiftShader; de
verificatiereeks in §5 laat zien dat die metingen intern tegenstrijdig
zijn. Conclusies over A2, A3, A4 en A8 zijn architectuur-afgeleid en
gemarkeerd als "niet gemeten".
