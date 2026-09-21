# TIERVISUALS.md — visuele spec en budget voor de Smederij-tiers

Ticket 137 (Ronde 11, fase 3). Dit document legt vast hoe basis / 1x gesmeed /
2x gesmeed er per wapen uitzien, wat dat mag kosten, en wat het met de
pixelvangrail doet. Het is de directe input voor T138 (AMSTEL-9) en T139
(Canal Ripper): na dit document staat er geen ontwerpkeuze meer open.

Zelfde rol als `GUNFEEL.md` voor T142-T144, en bewust in die volgorde:
ontwerpbeslissing 102 zet de gunfeel-spec vóór de visuele spec, zodat T138/T139
bouwen tegen animatie-eisen die niet alleen gespecificeerd maar geïmplementeerd
en gemeten zijn.

Meetscripts: `tests/meet-tiervisuals.mjs` en `tests/meet-tiervisuals-hud.mjs`.

---

## 0. Methode

Alle pixelcijfers hieronder komen uit exact hetzelfde harnas als
`test-visuele-basislijn.mjs`: `openVoorVisueleMeting()` (geen pointer lock, dus
`spelActief` blijft uit en alle dt-gedreven cosmetiek staat stil), dezelfde acht
standpunten, hetzelfde 15-85%-meetvenster.

**Kruiscontrole vooraf.** Voordat één conclusie is getrokken is het harnas tegen
de vastgelegde basislijn gelegd, met het mes in de hand — de wapenstand waarin
die basislijn is opgenomen:

| standpunt | basislijn gem/med | gemeten gem/med | afwijking |
|---|---|---|---|
| woonkamer | 28,03 / 16,51 | 28,09 / 16,51 | +0,2% / 0,0% |
| gang | 29,39 / 15,59 | 29,44 / 15,59 | +0,2% / 0,0% |
| atelier | 31,69 / 16,66 | 31,79 / 16,66 | +0,3% / 0,0% |
| binnenplaats | 23,07 / 21,03 | 23,14 / 21,03 | +0,3% / 0,0% |
| bijkeuken | 27,39 / 16,80 | 27,45 / 16,80 | +0,2% / 0,0% |
| kelder | 13,39 / 10,12 | 13,46 / 10,12 | +0,5% / 0,0% |
| vliering | 10,73 / 2,92 | 10,80 / 2,92 | +0,7% / -0,1% |
| gracht | 22,15 / 15,66 | 22,22 / 15,66 | +0,3% / 0,0% |

Acht van acht binnen 0,7%, alle medianen op de komma gelijk. Wat hieronder
"verschuiving" heet, is dus een echte verschuiving en geen meetverschil.

---

## 1. Gemeten uitgangssituatie

### 1.1 Budget en structuur

| | basismodel | tier-Group nu | ruimte binnen vangrail 1 |
|---|---|---|---|
| AMSTEL-9 | 4 meshes | 2 meshes, 0 lichten | **3 meshes** |
| Canal Ripper | 6 meshes | 2 meshes, 0 lichten | **3 meshes** |
| Mes | 3 meshes | n.v.t. | n.v.t. |

Vangrail 2 is gecontroleerd en intact: beide `vlam`-Groups zijn een Group van
exact twee `PlaneGeometry`-vlakken.

`userData.onderdelen` vandaag — de sleutels die élke tier moet blijven leveren
(GUNFEEL.md §5):

| wapen | sleutels |
|---|---|
| AMSTEL-9 | `romp`, `loop`, `greep`, `accent` |
| Canal Ripper | `romp`, `loop`, `greep`, `accent`, `magazijn`, `kolf` |
| Mes | `romp`, `loop`, `greep` |

### 1.2 Wat elke tier vandaag visueel doet

| tier | AMSTEL-9 | Canal Ripper |
|---|---|---|
| 0 | koud basismodel | koud basismodel |
| 1 (★) | 2 ember-gloeiringen om de tank + `accent` (drukmeter) wordt ember | ember-tandwiel + hitteband om de loop + `accent` (tandwiel) wordt ember |
| 2 (★★) | **niets** | **niets** |

Dat "niets" is geen inschatting maar gemeten, langs twee onafhankelijke wegen.

Ten eerste zijn draw calls en driehoeken tussen tier 1 en tier 2 **byte-identiek**
— 637/52013 voor de AMSTEL-9, 639/51809 voor de Ripper. Er komt geen enkele mesh
bij. `koopSmederij()` past bij niveau 2 dezelfde tier-1-visual nog een keer toe;
de code zegt dat ook met zoveel woorden ("onschuldig idempotent, geen apart
visual nodig").

Ten tweede levert de tier-2-aankoop met de HUD verborgen een **pixel-voor-pixel
identiek beeld** op:

| wapen | standpunt | t1 → t2, met HUD | t1 → t2, zonder HUD |
|---|---|---|---|
| AMSTEL-9 | kelder | +0,20% | **0,000%** |
| AMSTEL-9 | vliering | +0,33% | **0,000%** |
| Canal Ripper | kelder | +2,08% | **0,000%** |
| Canal Ripper | vliering | +3,69% | **0,000%** |

De 1,5-3,7% die de Ripper leek te winnen, komt dus volledig uit de **HUD**:
smeden verandert de munitietekst (24 → 32) en het wapenlabel (★ → ★★), en die
chrome valt bewust binnen het 15-85%-meetvenster. Dat de AMSTEL-9 minder
verschuift klopt met een kleinere tekstwijziging (12 → 16). Ter kalibratie: het
verbergen van de HUD haalt op de vliering ruim de helft van de helderheid weg
(14,32 → 6,71) — dat standpunt is bijna zwart, dus daar wéégt HUD-tekst zwaar.
Datzelfde precedent staat al in de basislijn zelf vastgelegd, toen alleen de
HUD-tekst "Drukspuit" → "AMSTEL-9" de vliering-mediaan van 7,69 naar 9,06 duwde.

Twee metingen van exact dezelfde staat verschillen 0,000%, dus deze nullen zijn
echte nullen en geen afronding.

### 1.3 Wat een tier-visual met de pixelvangrail doet

Dit is de begroting die de ticket-acceptatie vraagt, en het antwoord is
gunstiger dan §12.7 vangrail 4 vreesde.

**De basislijn meet het mes in de hand.** Sinds T134 start de speler wapenloos
met alleen een mes, en `test-visuele-basislijn.mjs` roept `geefSpelerVuurwapen()`
niet aan. Geen van de acht standpunten ziet ooit een vuurwapen, dus ook geen
tier-visual daarvan.

**Gevolg: T138 en T139 verschuiven de basislijn niet.** Nul standpunten, nul
herijking — zolang ze uitsluitend de twee vuurwapens aanraken. Dat is de reden
dat §5 hieronder het mes met rust laat.

Ter onderbouwing van hoe groot het effect wél zou zijn als een vuurwapen in
beeld stond, gemeten t.o.v. het mes:

| standpunt | AMSTEL-9 tier 0 | AMSTEL-9 tier 1 | Ripper tier 0 | Ripper tier 1 |
|---|---|---|---|---|
| vliering (mediaan) | +210% | +242% | +235% | +242% |
| kelder | +18,6% | +51,1% | +18,3% | +25,5% |
| gracht | +18,2% | +47,5% | +9,3% | +14,8% |
| binnenplaats | +8,6% | +18,3% | +8,0% | +11,4% |

En de tier-op-tier-stap op zichzelf, binnen hetzelfde wapen:

| standpunt | AMSTEL-9 t0→t1 | AMSTEL-9 t1→t2 | Ripper t0→t1 | Ripper t1→t2 |
|---|---|---|---|---|
| kelder | +27,5% | +0,20% | +6,0% | +2,1% |
| gracht | +24,7% | +0,10% | +5,1% | +1,5% |
| vliering | +19,5% | +0,33% | +5,1% | +3,7% |
| binnenplaats | +8,9% | +0,17% | +3,2% | +1,7% |

Wat eruit springt: de **t0→t1-stap is enorm** — de twee ember-ringen van de
AMSTEL-9 zijn goed voor +27% helderheid in de kelder, ruim tien keer de 2%-band.
Een tier-visual is dus geen detail; hij domineert het beeld zodra hij in beeld
staat. De t1→t2-kolommen zijn daarentegen volledig HUD-effect, zoals §1.2
aantoont — de scene zelf is daar onveranderd.

### 1.4 Renderkosten

Op het duurste standpunt (woonkamer, 634 draw calls met het mes):

| stand | draw calls | driehoeken |
|---|---|---|
| mes | 634 | 51.145 |
| AMSTEL-9 tier 0 | 635 | 51.501 |
| AMSTEL-9 tier 1 en 2 | 637 | 52.013 |
| Canal Ripper tier 0 | 637 | 51.409 |
| Canal Ripper tier 1 en 2 | 639 | 51.809 |

Een tier-set van 2 meshes kost +2 draw calls. Drie meshes erbij kost dus ~+3
calls op 634 — **0,5%**, tegen een `RENDER_BAND` van 25%. Het mesh-budget uit
vangrail 1 is de bindende grens, niet de renderkosten.

---

## 2. Het gat

Eén zin: **tier 2 kost het meeste geld, geeft het sterkste effect, en is als
enige tier onzichtbaar.**

De speler betaalt `SMEDERIJ2_PRIJS` (meer dan niveau 1) en krijgt daarvoor de
grootste schadesprong plus het per-wapen tier-2-effect — de AMSTEL-9 laat élk
raakpunt ontploffen, de Canal Ripper krijgt Doorboring. M2 stelde vast dat dat
tier-2-moment precies de plek is waar de AMSTEL-9 zijn bestaan rechtvaardigt:
hij doodt dan élke HP-trap in één schot, óók HP 4. Aan het wapen in je handen
is daar niets van te zien.

---

## 3. Doelspec — de gedeelde tier-grammatica

Beide wapens volgen dezelfde regel, zodat de speler één ding leert in plaats van
twee losse trucjes:

| tier | wat de gloed doet | leesbaar als |
|---|---|---|
| 0 | geen ember | koud, zoals gekocht |
| 1 (★) | ember **om** het bestaande volume — banden en ringen op de romp | het wapen is behandeld |
| 2 (★★) | ember schuift **naar voren, richting de monding**, plus één vorm die het tier-2-effect uitbeeldt | het wapen is dóórgloeid tot in de loop |

**Hoe verder naar voren de gloed staat, hoe hoger de tier.** Dat is de hele
grammatica, en hij werkt op beide wapens zonder dat de vormen op elkaar lijken.

**Tier 2 onderscheidt zich door MEER en VERDER NAAR VOREN, nooit door FELLER.**
Vangrail 3 is bindend: het gesmede accent zit op Bron-niveau (`emissiveIntensity`
1,3-1,4) en daar blijft het. Alle tier-meshes delen het bestaande ember-recept —
`color`/`emissive` op `SMEDERIJ_ACCENT_KLEUR` (0xff7a1f), `emissiveIntensity`
1.3, `roughness` 0.4 — precies zoals de huidige tier-1-meshes.

**Over de coördinaten in §4 en §5.** Die zijn rekenkundig getoetst tegen de
bestaande modelgeometrie — elke ring past om het onderdeel dat hij omsluit, elke
plaatsing zit op of tegen het volume waar hij bij hoort, en de toelichtingskolom
noemt per regel welke bestaande maat de controle is. Ze zijn níét visueel
gecontroleerd; dat kan alleen met het beeld erbij. Ze zijn dus een onderbouwd
vertrekpunt, geen eindwaarde: het voor/na-beeldverslag uit T139 is de plek waar
ze definitief worden, en afwijken mag zolang het budget en de grammatica
hierboven staan blijven.

---

## 4. Doelspec — AMSTEL-9

Tier-2-mechaniek: `schotExplosie()` op elk raakpunt. Vormtaal: **het drukvat
staat onder overdruk.**

| # | naam | tier | vorm | plaats | waarom |
|---|---|---|---|---|---|
| 1 | gloeiring achter | 1 | `TorusGeometry(0.05, 0.008, 8, 16)` | `(0, 0.02, -0.02)` | de enige tier-1-ring |
| 2 | gloeiring midden | 2 | `TorusGeometry(0.05, 0.008, 8, 16)` | `(0, 0.02, -0.09)` | zelfde maat als #1, zodat de twee als één paar lezen |
| 3 | overdrukventiel | 2 | `CylinderGeometry(0.008, 0.010, 0.026, 10)`, rechtop | `(0, 0.062, -0.05)` | steekt half uit de tankbovenkant (y = 0,064); leest als een afblaasventiel onder spanning |
| 4 | ladingsring | 2 | `TorusGeometry(0.022, 0.006, 8, 14)` om het mondstuk | `(0, 0.02, -0.24)` | binnenstraal 0,016 om een mondstuk van ~0,0155 — precies waar de lading het wapen verlaat |

**Totaal 4 meshes, 0 lichten — binnen vangrail 1 (max 5).**

> **SPEELTOETS-BIJSTELLING (na T139).** De eerste uitvoering had er vijf: tier 1
> hield twee ringen en tier 2 legde er een derde bij (een dikkere "drukband" op
> z = -0,14). Dat stond te vol. Nu houdt tier 1 alleen de achterste ring over,
> komt de middelste terug als tier-2-onderdeel, en is de drukband helemaal
> vervallen. Netto bij tier 2: twee ringen op de tank plus één bij de monding.

Silhouet-effect: tier 1 leest als "er zit een band omheen", tier 2 als "het vat
gloeit door tot aan de monding". Doordat de twee tankringen identiek van maat
zijn lezen ze als een paar, en springt de kleinere ring bij het mondstuk er
juist uit — dat is het onderdeel dat de tier-2-mechaniek uitbeeldt.

---

## 5. Doelspec — Canal Ripper

Tier-2-mechaniek: Doorboring — de kogel gaat dwars door een doel heen. Vormtaal:
**het drijfwerk is doorgloeid tot ín de loop.**

| # | naam | tier | vorm | plaats | waarom |
|---|---|---|---|---|---|
| 1 | drijfwerk-tandwiel | 1 | `TorusGeometry(0.02, 0.007, 6, 12)` | `(0.045, 0.02, -0.05)` | bestaand, ongewijzigd (draait in `updateSmederijVisuals`) |
| 2 | hitteband | 1 | `TorusGeometry(0.03, 0.007, 8, 16)` | `(0, 0.03, -0.12)` | bestaand, ongewijzigd |
| 3 | hitteband voor | 2 | `TorusGeometry(0.028, 0.007, 8, 16)` | `(0, 0.03, -0.27)` | binnenstraal 0,021 om een loop van ~0,0168; met de eerste band leest het als escalatie langs de loop |
| 4 | gloeipen | 2 | `CylinderGeometry(0.004, 0.007, 0.10, 8)`, `rotation.x = PI/2` (taps naar voren) | `(0, 0.03, -0.35)` | zit 5 cm ín de loop verankerd en steekt 5 cm vóór de monding uit |
| 5 | drijfwerkbout | 2 | `TorusGeometry(0.016, 0.006, 6, 10)`, `rotation.y = PI/2` | `(0.045, 0.02, 0.10)` | tweede tandwiel naast het tier-1-rad |

**Totaal 5 meshes, 0 lichten — exact op vangrail 1.**

De gloeipen is de identiteitsdrager: het enige onderdeel op beide wapens dat
vóór de monding uitsteekt, en het hoort uitsluitend bij Doorboring.

Twee dingen om bij het bouwen op te letten. **Hij moet uitsteken om te bestaan:**
de loop is ondoorzichtig en de speler kijkt er van schuin achter tegenaan, dus
een kern die volledig ín de loop zit is per definitie onzichtbaar. Vandaar de
verankering half binnen, half buiten. En **hij loopt door de mondingsvlam heen**
(`vlamRatelaar` staat op z = -0,36): dat is geen conflict maar versterking — een
gloeiende pen midden in de flits leest als de bron ervan. De `vlam`-structuur
zelf blijft ongemoeid (vangrail 2).

### 5.1 Drie animaties — het mesh-budget is vol, beweging is gratis

> **SPEELTOETS-BIJSTELLING (na T139).** Gemeld: de Ripper zag er op tier 2 "nog
> iets saai" uit. Terecht — het waren drie stilstaande ember-vormen, en twee
> daarvan (gloeipen, drijfwerkbout) vallen vanuit spelersperspectief nauwelijks
> op. Het budget zat op 5/5, dus er kon geen mesh bij; beweging kost niets.

| # | wat | waar |
|---|---|---|
| 1 | **Tweede tandwiel.** De drijfwerkbout draait tijdens vuren tegengesteld aan het tier-1-rad (−1,9 rad/s tegen +1,2). Twee raderen die in elkaar grijpen lezen als opgevoerd drijfwerk. | `updateSmederijVisuals()` |
| 2 | **Oververhittingsgloed.** De twee hittebanden gloeien feller naarmate `spreadOpbouw` oploopt, en doven als je stopt. Je ziet aan je eigen wapen dat je te lang doorratelt — dezelfde grootheid die de spreiding stuurt, nu ook zichtbaar. Genormaliseerd op het plafond, dus "volle gloed" = "maximaal vuil" bij elke tier. | idem |
| 3 | **Pompende gloeipen.** De pen slaat per schot 3 cm terug en loopt uit, als een slagpin. `schiet()` zet de stoot, de update laat 'm aflopen. | `schiet()` + idem |

Drie randvoorwaarden die deze animaties respecteren:

- **Emissie-hiërarchie (vangrail 3).** De gloed loopt van 0,6 tot 1,3 — Bron-
  niveau is het plafond en dat wordt niet overschreden.
- **Nul extra meshes en lichten.** Alledrie zijn transform- of
  materiaalmutaties op onderdelen die er al waren.
- **De pen keert exact terug op zijn rustpositie** (`RIPPER_GLOEIPEN_RUST_Z`).
  Dat is dezelfde eis die T140 aan de presentatielaag stelde: alles wat beweegt
  moet exact op zijn rustpose uitkomen, anders verschuift de pixelvangrail
  zodra het onderdeel ooit in beeld komt. Vastgelegd in een test.

De animaties draaien alleen als de tier-2-set daadwerkelijk zichtbaar is, en
alleen tijdens actief spel — `updateSmederijVisuals()` zit in de `spelActief`-
tak van de gameLoop.

---

## 6. Het mes: één vaste look, en het model blijft ongewijzigd

Het mes kan niet gesmeed worden (§12.6), dus het kent per definitie geen tiers.
Eén vaste look.

**T138/T139 laten het mesmodel ook verder ongemoeid.** Dat is een expliciete
keuze, geen vergetelheid — de code bij `wapenMes` noemt het huidige model nog
"VOORLOPIG: T137/T138 herzien het uiterlijk". Die opdracht wordt hier gesloten,
om drie redenen:

1. **De aanleiding is al verholpen.** T133 schreef "voorlopig" omdat het eerste
   mes een donkere spriet langs de onderrand was. Datzelfde ticket heeft het
   model toen al ongeveer verdubbeld en een pareerstang gegeven; het silhouet
   leest nu als mes.
2. **Er ligt geen eis meer op.** GUNFEEL.md §5 stelde vast dat het mes geen
   gunfeel-rol heeft: geen recoil, geen spread, geen tiers. De onderdelen
   `romp`/`loop`/`greep` bestaan er puur voor de volledigheid van de conventie.
3. **De kosten zijn gemeten en hoog.** Het mes is het enige wapen dat in álle
   acht basislijn-standpunten in beeld staat. Elke wijziging eraan herijkt de
   hele pixelvangrail — het vervangen van de AMSTEL-9 door dit mes verschoof de
   vliering-mediaan destijds met -68%.

Wil de gebruiker het uiterlijk alsnog anders, dan is dat een eigen ticket met
een eigen, onderbouwde herijking van alle acht standpunten — niet iets wat
T138/T139 en passant meenemen.

---

## 7. Wat expliciet NIET per tier meeschaalt

De Ronde 11-uitbreiding op dit ticket vraagt om drie antwoorden. Alle drie zijn
**nee**, en dat is niet uit voorzichtigheid.

**7.1 De recoil-amplitude schaalt niet mee per tier.**
T142/T143 hebben de terugslag per wapen getuned en de gebruiker heeft die
waarden in twee speeltoetsrondes bevestigd (GUNFEEL.md §7). Recoil per tier zou
dat bevestigde gevoel tot één van drie varianten maken. Bovendien is de M2-tabel
met gemeten trefferkansen (100% / 95,0% / 72,0% …) per wapen opgesteld; een
tier-afhankelijke recoil vermenigvuldigt die tabel met drie en maakt de
balansconclusie ongeldig. De tier-beloning blijft wat hij is: schade, magazijn
en het tier-2-effect.

**7.2 De rustpositie verandert niet per tier.**
Die komt sinds T140 uit de ARSENAAL-`presentatie`-entry, per wápen. Tier-meshes
hangen additief aan dezelfde Group op dezelfde rustpose. Zou de rustpositie per
tier verschillen, dan had `updateWapenPresentatie()` een tier-afhankelijke basis
nodig en kreeg de invariant "keert altijd exact terug naar de rustpose" een
derde variabele erbij.

**7.3 `userData.onderdelen` verandert niet per tier.**
De sleutels wijzen naar het **basismodel** en nooit naar een tier-mesh. Daardoor
haalt T138/T139 zijn extra acceptatiecriterium ("elke tier levert de in
T140/T141 afgesproken sleutels") automatisch: de tier voegt toe, het basismodel
blijft staan. Een tier-mesh in `onderdelen` zetten zou betekenen dat
`updateWapenPresentatie()` een onderdeel kan aanspreken dat er in tier 0 niet
is — precies het soort voorwaardelijkheid dat T140 uit die functie heeft
gehaald.

---

## 8. Structuur: één Group, zichtbaarheid per tier

Vandaag zet `koopSmederij()` de héle `smederijVisuals*`-Group zichtbaar. Met
tier-2-meshes in diezelfde Group zou tier 1 die meteen meetonen. T138/T139
lossen dat zo op:

- Elke mesh in de Group krijgt `userData.tier` (1 of 2), gezet in het bouwblok.
- Bij het bouwen staan de tier-2-meshes op `visible = false`.
- `koopSmederij()` zet per kind `kind.visible = kind.userData.tier <= niveau`,
  en de Group zelf zichtbaar vanaf tier 1 — precies zoals nu.

**Waarom één Group en geen tweede `smederijVisuals*Niveau2`:** vangrail 1 telt
per Group. Een tweede Group verdubbelt het budget zonder dat de vangrail iets
merkt. Eén Group met ≤ 5 meshes over álle tiers samen is de eerlijke lezing van
die grens, en `test-smederij.mjs` hoeft er niet voor versoepeld te worden.

Een reset hoeft niet: herstarten is een volledige `location.reload()`, dus de
bouwstand is meteen weer de begintoestand.

---

## 9. Budget-afrekening

| | meshes tier 1 | meshes tier 2 | totaal | grens | lichten |
|---|---|---|---|---|---|
| AMSTEL-9 | 1 | 3 | **4** | 5 | 0 |
| Canal Ripper | 2 | 3 | **5** | 5 | 0 |

Het budget wordt niet verruimd. De Canal Ripper zit exact op de grens; bij de
AMSTEL-9 is na de speeltoets-bijstelling (§4) één plek vrijgekomen. Verder
uitbreiden vraagt een onderbouwde verruiming — of, zoals bij de Ripper in §5.1,
beweging in plaats van geometrie.

Renderkosten: ~+3 draw calls per wapen (0,5% van 634), ruim binnen de 25%
`RENDER_BAND`.

Pixelvangrail: **nul standpunten verschuiven** — de basislijn ziet alleen het
mes, en dat blijft ongewijzigd (§6).

---

## 10. Checklist voor T138 en T139 — afgerond

- [x] Drie tier-2-meshes toegevoegd aan de bestaande `smederijVisuals*`-Group,
      volgens de tabellen in §4 (AMSTEL-9: drukband, overdrukventiel,
      ladingsring) en §5 (Canal Ripper: hittebandVoor, gloeipen, drijfwerkbout).
- [x] `userData.tier` op elk kind; tier-2-meshes starten op `visible = false`.
- [x] `koopSmederij()` schakelt zichtbaarheid per kind op basis van het niveau
      (wapen-agnostisch: dezelfde code bedient beide wapens sinds T138).
- [x] Ember-materiaalrecept hergebruikt (0xff7a1f, `emissiveIntensity` 1.3,
      `roughness` 0.4) — geen nieuwe emissie-niveaus.
- [x] `userData.onderdelen` ongewijzigd; geen tier-mesh in die tabel.
- [x] Geen `PointLight`, in geen enkele tier.
- [x] `vlam` blijft een Group van exact twee `PlaneGeometry`-vlakken.
- [x] `test-smederij.mjs` (64/64) en `test-mondingsvlam.mjs` (26/26) groen
      zonder versoepelde asserties. De budget-check daar is `meshes <= 5` en
      bleef dus vanzelf groen bij 5 — precies waarom de tier-zichtbaarheidstest
      hieronder nodig was: zonder die test zou een Group van 5 meshes waarvan
      er 3 nooit zichtbaar worden er in de suite identiek hebben uitgezien als
      een correcte implementatie.
- [x] `test-visuele-basislijn.mjs` groen **zonder herijking** (65/65, beide
      tickets) — de basislijn ziet nooit een vuurwapen (T134: speler start
      met het mes), dus geen enkel standpunt verschoof.
- [x] Nieuwe tests die vastleggen dat de drie tiers een verschillend aantal
      zichtbare meshes tonen (0 / 2 / 5), per wapen — voorkomt dat "tier 2 is
      visueel leeg" terugkomt.
- [x] Afsluitend (T139): voor/na-beeldverslag van alle tiers naast elkaar —
      `tests/beeldverslag/fase-tiervisuals-t138-t139.png`. Bij beide wapens
      leest tier 2 visueel duidelijk als "meer, en verder naar voren" t.o.v.
      tier 1, zoals de grammatica in §3 beoogde.
- [x] Volledige regressiesuite: 87/91 groen op de T139-run (86/91 op T138) —
      de resterende 4 zijn bekende wall-clock-timingtests
      (`test-omgeving-sfeer.mjs`, `test-ontsnapping-vensters.mjs`,
      `test-achtergrondmuziek.mjs`, `test-hitmarker-audio.mjs`, plus
      `test-nachthemel.mjs` op de T138-run), stuk voor stuk opnieuw groen
      geverifieerd in isolatie, geen van alle in een bestand dat dit ticket
      aanraakte.
- [x] Het mesmodel is, zoals besloten in §6, ongewijzigd gebleven — geen
      Smederij-upgrade voor het mes, dus geen tier-eis.
