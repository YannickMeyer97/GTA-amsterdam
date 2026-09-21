# GUNFEEL.md — wapengevoel in getallen

Ticket 141 (Ronde 11, fase 2), aangevuld met de bevindingen van T142-T144 en
mijlpaal M2. Dit document legt vast wat "precies en
gecontroleerd" (AMSTEL-9) en "agressief met oplopende straf" (Canal Ripper)
**in getallen en curves** betekenen, meet waar het spel vandaag staat, en
wijst aan welke modelonderdelen moeten kunnen bewegen.

Consumenten: **T142** (AMSTEL-9 behaviour), **T143** (Canal Ripper behaviour),
**T137** (visuele spec voor de tier-visuals).

Meetscript: `tests/meet-gunfeel.mjs`. Herbruikbaar — T142 en T143 draaien het
opnieuw om hun resultaat tegen de doelbanden hieronder af te toetsen.

---

## 0. Methode en één meetvalkuil

Alle getallen hieronder komen uit `tests/meet-gunfeel.mjs`, dat het échte
schade-, spread- en recoilpad aanroept (geen nagebouwde formules).

**De valkuil, gevonden tijdens het meten.** De twee recoil-decays telescoperen
over de som van `dt`:

```
cameraKick: k *= exp(-10*dt)   ->  k0 * exp(-10 * Σdt)
terugslag:  t -= dt*6          ->  t0 - 6 * Σdt
```

Dat maakt ze onafhankelijk van de framerate — maar `Σdt` is **gesimuleerde
tijd**, niet wall-clock. De gameLoop klemt elke frame op
`Math.min((nu - vorigeTijd)/1000, 0.05)` (de hitch-guard). Bij 60 fps
(dt 16,7 ms) valt die klem nooit aan en zijn de twee gelijk; bij zware
haperingen loopt de gesimuleerde tijd achter en duurt herstel in échte
seconden langer.

Een eerste meetpoging vergeleek tegen wall-clock en rapporteerde daardoor een
"afwijking" van veertien ordes van grootte — dat zei niets over de formule en
alles over de klem. De verificatie in het meetscript gebruikt nu geen externe
klok meer: de twee decays rekenen elkaars `Σdt` terug, en die moeten gelijk
zijn. Gemeten: **0,10000 s uit beide, verschil 0,000%.**

**Alle hersteltijden in dit document zijn gesimuleerde tijd.** T142/T143 moeten
hun recovery-doelen zo formuleren.

---

## 1. Gemeten basislijn (vandaag)

### 1.1 TTK-tabel — 48 cellen

Schade per treffer: `schadePerTreffer (1) + berekenSmederijBonus(tier)`, kop
`+ HEADSHOT_EXTRA (1)`. TTK = `(schoten − 1) × schotCooldown` — het eerste
schot valt op t=0. Dit is de theoretische ondergrens bij perfect getimed vuur
en elke kogel raak; de mikkant zit in §1.3.

Schade per lichaamstreffer per tier:

| tier | AMSTEL-9 | Canal Ripper |
|---|---|---|
| 0 | 1,0 | 1,0 |
| 1 | 2,5 | 2,0 |
| 2 | 3,0 | 2,5 |

> **SPEELTOETS-BIJSTELLING (na T139).** Tier 2 gaf eerst 5,0 en 3,8. Bij 5,0
> doodde de AMSTEL-9 élke HP-trap (max 4) in één lichaamsschot en viel er niets
> meer te mikken — het wapen had zijn eigen precisie-identiteit weggeüpgraded.
> De niveau-2-bonus is op beide wapens teruggebracht naar +0,5.
>
> Daarmee is niveau 2 een **kleinere schadesprong dan niveau 1** (+0,5 tegen
> +1,5 / +1,0), en dat is bewust: niveau 2 ontsluit óók het per-wapen effect
> (AMSTEL-9-explosie, Ripper-Doorboring). De totale stap is dus groter dan de
> schade alleen. Twee testasserties die "niveau 2 = grootste schadesprong"
> eisten zijn hierop aangepast; zie de toelichting in `test-smederij.mjs`.

**AMSTEL-9** (cadans 0,2 s):

| HP | tier 0 lichaam | tier 0 kop | tier 1 lichaam | tier 1 kop | tier 2 lichaam | tier 2 kop |
|---|---|---|---|---|---|---|
| 1 | 1 (0,00 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 2 | 2 (0,20 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 3 | 3 (0,40 s) | 2 (0,20) | 2 (0,20) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 4 | 4 (0,60 s) | 2 (0,20) | 2 (0,20) | 2 (0,20) | **2 (0,20)** | 1 (0,00) |

De enige cel die door de bijstelling verandert is HP 4 op tier 2: die kostte
één lichaamsschot en kost er nu twee — of één **kop**treffer. Precies het gat
waarin de precisiekeuze weer iets te presteren heeft.

**Canal Ripper** (cadans 0,1 s):

| HP | tier 0 lichaam | tier 0 kop | tier 1 lichaam | tier 1 kop | tier 2 lichaam | tier 2 kop |
|---|---|---|---|---|---|---|
| 1 | 1 (0,00 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 2 | 2 (0,10 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 3 | 3 (0,20 s) | 2 (0,10) | 2 (0,10) | 1 (0,00) | **2 (0,10)** | 1 (0,00) |
| 4 | 4 (0,30 s) | 2 (0,10) | 2 (0,10) | 2 (0,10) | 2 (0,10) | **2 (0,10)** |

### 1.2 Cadans, magazijn, herladen

| | AMSTEL-9 | Canal Ripper |
|---|---|---|
| schotCooldown | 0,20 s (5,0/s) | 0,10 s (10,0/s) |
| magazijn t0 / t1 / t2 | 8 / 12 / 16 | 16 / 24 / 32 |
| magazijnduur t0 / t1 / t2 | 1,6 / 2,4 / 3,2 s | 1,6 / 2,4 / 3,2 s |
| herladen normaal / snelspanner | 1,20 / 0,70 s | 1,50 / 0,90 s |

Beide wapens hebben per tier dezelfde magazijnduur — de Ripper vuurt twee keer
zo snel en heeft precies twee keer zoveel patronen.

### 1.3 Spreidingskegel (empirisch, 20.000 monsters, FOV 70°, aspect 1,6)

| | spreadNdc | max afwijking | gemiddelde | volle kegel |
|---|---|---|---|---|
| AMSTEL-9 | 0 | ±0,0000° | 0,0000° | 0,000° |
| Canal Ripper | 0,012 | ±0,4531° | 0,2432° | 0,906° |

### 1.4 Recoil

| | AMSTEL-9 | Canal Ripper |
|---|---|---|
| camera-kick per schot | 0,014 rad = **0,802°** | 0,006 rad = **0,344°** |
| camera-kick herstel tot 5% | 0,2996 s | 0,2996 s |
| model-terugslag piek (z) | 0,080 m | 0,044 m |
| model-terugslag tot 5% | 0,1583 s | 0,0871 s |
| model-terugslag volledig terug | 0,1667 s | 0,0917 s |

Camera-kick stapelt (`cameraKick +=`). Steady state bij maximale cadans:

```
AMSTEL-9:     0,014 / (1 − exp(−10·0,2)) = 0,0162 rad = 0,93°
Canal Ripper: 0,006 / (1 − exp(−10·0,1)) = 0,0095 rad = 0,54°
```

---

## 2. Wat de meting laat zien — twee gaten

**Gat 1: TTK onderscheidt de wapens nauwelijks, en waar het dat wél doet staat
het de bedoelde identiteit in de weg.** Met HP hard geplafonneerd op 4
(ontwerpbeslissing 10) doodt élk wapen in 1-4 schoten. In tier 0 en tier 1 is
de Canal Ripper in *elke* cel even snel of sneller dan de AMSTEL-9 — zelfde
aantal schoten, halve cadans. Pas in tier 2 wint de AMSTEL-9 één cel (HP 4
lichaam: 1 schot tegen 2).

Daaruit volgt de belangrijkste ontwerpconclusie van dit ticket: **de identiteit
van de AMSTEL-9 kan niet uit TTK komen.** Hij is per definitie de langzamere
doder. Zijn waarde moet zitten in *zekerheid* — elke kogel gaat waar je richt —
tegenover een wapen dat sneller doodt maar minder precies is. Dat is een
eerlijke ruil, en het is meteen de reden dat T142 geen schadewaarden aanraakt
(dat staat ook expliciet buiten scope).

**Gat 2: er bestaat vandaag geen enkele straf op ratelen.** Voor beide wapens:

- `spreadNdc` is een **constante** per wapen. Hij bouwt nergens op.
  `wapenStaat.spreadOpbouw` is in T132 gereserveerd en wordt nog nergens
  gelezen of geschreven.
- `cameraKick` is visueel-only en muteert `speler.pitch` nooit (harde
  randvoorwaarde) — hij verplaatst het beeld, niet het richtpunt.

Gevolg: **zo snel mogelijk klikken is vandaag strikt optimaal, voor beide
wapens.** Voor de AMSTEL-9 (spread 0) is spammen zelfs volledig gratis: geen
spreiding, geen aim-verlies, alleen een schuddend beeld. Dat is precies het
tegendeel van "goed richten wordt beloond".

Dit is wat T142 en T143 moeten dichten.

---

## 3. Doelspec — AMSTEL-9 (T142)

> Identiteit: precies, gecontroleerd, doelbewust. Geduld wordt beloond.

**First-shot accuracy als contract.** `spreadNdc = 0` bij schot 1, altijd,
onder alle omstandigheden — geen tier, power-up of bewegingstoestand mag dat
aantasten. Dit is toetsbaar en moet een test krijgen die het als contract
vastlegt, niet als toevalligheid.

**Spread-opbouw: NUL. Dit wapen dobbelt nooit.**

> **Correctie tijdens T142.** De eerste versie van deze spec schreef hier een
> oplopende spreiding voor als straf op ratelen (+0,012 per schot, afbouw
> 0,040/s). Bij implementatie brak dat meteen het contract dat
> `test-wapen-identiteit.mjs` al bewaakte: *twintig schoten van dit wapen
> moeten op exact hetzelfde punt landen.* De test had gelijk en de spec niet.
>
> Willekeurige spreiding is het verkeerde gereedschap voor het precisiewapen.
> Als je met de AMSTEL-9 mist, moet dat jouw fout zijn geweest en niet die van
> het wapen — anders is "precies en gecontroleerd" een loze belofte. Dat het
> mechanisme wél in de code staat is geen restant: T143 heeft het nodig voor de
> Canal Ripper, waar spreiding juist de identiteit ís.

**De straf op doorratelen is deterministisch: de camera klimt.** `cameraKick`
telt op bij elk schot en wordt door `updateSpeler()` op `camera.rotation.x`
gezet — en de raycast van het volgende schot vertrekt vanuit diezelfde camera.
Vuren voordat de kick hersteld is, schiet dus meetbaar hoger. `speler.pitch`
blijft daarbij onaangeraakt (harde randvoorwaarde): er is geen blijvende
aim-drift, alleen een beeld dat je zelf terugbrengt.

Dat verschil is het hele punt. Spreiding kun je alleen ondergaan; een klim die
bij dezelfde invoer altijd dezelfde uitkomst geeft, kun je leren compenseren.
**Dat is wat skill-based betekent voor een precisiewapen.**

**Ratel-straf (nieuw).**

```
factor = 1 + kickRatelStraf × (1 − min(1, gat / KICK_HERSTELVENSTER))
cameraKick += kickSterkte × factor
```

| parameter | waarde |
|---|---|
| `kickRatelStraf` | 0,8 |
| `KICK_HERSTELVENSTER` | `ln(20)/10` = 0,2996 s — afgeleid van de decay, niet ingetypt |

| gat tussen schoten | factor | kick dat schot |
|---|---|---|
| ≥ 0,30 s (hersteld) | 1,00 | 0,802° |
| 0,20 s (max cadans) | 1,27 | 1,016° |
| 0 s (theoretisch) | 1,80 | 1,443° |

Wat de speler daarvan merkt, is waar het vizier staat op het moment dat de
volgende kogel vertrekt (de kick ná decay, in evenwicht):

| cadans | evenwicht `cameraKick` | vizier-offset bij afvuren |
|---|---|---|
| 0,30 s (geduldig) | 0,0147 rad | **0,042°** |
| 0,20 s (ratelen) | 0,0205 rad | **0,159°** |

**Ratelen zet je vizier bijna vier keer zo ver van je richtpunt als geduldig
vuren — elke kogel gaat nog steeds exact waar de loop wijst, alleen wijst die
loop hoger.**

**Recoil-verdeling camera vs. model.** Camera-kick basis 0,014 rad per schot en
de decay-constante 10 blijven ongewijzigd — die vormen de referentie waar het
herstelvenster van afgeleid is. Model-terugslag piek 0,080 m op z (bestaand),
plus een **nieuwe model-kick op `rotation.x`** van 0,020 rad (1,15°), met
dezelfde lineaire afbouw als de z-terugslag (6/s → volledig terug in 0,167 s).

Die model-kick raakt de aim **niet** — hij zit op de wapen-Group, niet op de
camera. Hij is er puur voor het gewicht van het schot, en loopt via de
T140-presentatielaag, dus hij komt per constructie exact op de rustpose terug.

**Cadans.** Ongewijzigd op 0,20 s. De straf op sneller vuren is de camera-klim,
niet een langere cooldown — een cooldown-verlenging zou het wapen traag laten
*aanvoelen* in plaats van je te laten voelen dat je te snel was.

**Muzzle-feedback en herladen.** Ongewijzigd (mondingsflits 0,033 s; herladen
1,20 s / 0,70 s). De meting gaf geen aanleiding hier iets aan te veranderen: de
flits doet zijn werk als tell, en de herlaadduur is al de langzaamste van de
twee wapens. De nieuwe fysieke feedback van dit ticket is de model-kick
hierboven.

**Headshot-feedback.** Binnen de bestaande drie hitmarker-tiers — geen nieuwe
tier, geen nieuwe rang. De kop-tier gaat van 0,18 naar **0,24 s**, waarmee de
afstand tot een lichaamstreffer (0,12 s) verdubbelt in plaats van anderhalf
keer; kill (0,30 s) blijft daar duidelijk boven. Omdat de AMSTEL-9 zijn plek
naast de snellere Canal Ripper met zekerheid verdient en niet met TTK (§2),
moet een geslaagde koptreffer ook als beloning lézen.

---

## 4. Doelspec — Canal Ripper (T143)

> Identiteit: korte bursts blijven beheersbaar, volgehouden vuur wordt steeds
> moeilijker.

**Basisspreiding.** `spreadNdc = 0,012` blijft de **basis** (kegel 0,906°) —
hier ligt geen contract op nul; onnauwkeurigheid hoort bij dit wapen.

**Spread-opbouw.**

> **Bijgesteld na de M2-speeltest.** De eerste getallen (+0,005 per schot,
> plafond 0,048) waren véél te braaf. Een vol magazijn kwam uit op een kegel
> van 3,2° — op 5 m een afwijking van ~14 cm, waarmee je de romp gewoon nog
> raakt — en op een camera-klim van 1,05°, nauwelijks meer dan één enkel
> AMSTEL-9-schot. Doorratelen voelde daardoor letterlijk gratis. De meting
> klopte netjes met de spec; de spec zelf was te voorzichtig gekozen, en dat is
> precies het soort fout dat alleen spelen aan het licht brengt. De waarden
> hieronder zijn de bijgestelde.

| parameter | waarde |
|---|---|
| toename per schot | +0,010 NDC, **genormaliseerd op magazijngrootte** |
| afbouw, standaard | 0,040 NDC/s |
| afbouw, onder de drempel **én gestopt met vuren** | 0,150 NDC/s (3,75×) |
| burst-drempel | 0,025 NDC |
| "gestopt met vuren" | pauze > 1,5 × schotCooldown |
| plafond | 0,130 NDC |
| totale spread | `spreadNdc + spreadOpbouw` |

> **SPEELTOETS-BIJSTELLING (na T139): normalisatie op magazijngrootte.**
> Gemeld: op Smederij-tier 2 was de Ripper "aan het eind van het magazijn wel
> heel inaccuraat". Terecht — de toename per schot was een vast getal, dus met
> 32 kogels in plaats van 16 bereikte hij hetzelfde plafond op hetzelfde
> *schot*, en bleef daarna nog tien kogels op zijn slechtst hangen. Upgraden
> maakte het wapen dus onnauwkeuriger, terwijl het grotere magazijn juist de
> beloning was.
>
> Wat nu meeschaalt is de **netto** opbouw per schot (toename min wat de afbouw
> er in datzelfde schotinterval afhaalt), met factor
> `basismagazijn / huidig magazijn`. Daardoor ligt de spreiding op elk *punt in
> het magazijn* gelijk: bij kogel 20 van 32 precies zo groot als bij kogel 10
> van 16.
>
> Afbouwtempo, plafond en burst-drempel blijven **ongeschaald**. Een eerste
> versie schaalde die ook mee en de test ving dat meteen: het plafond werd dan
> relatief strenger dan de opbouw, en tier 2 kwam uit op 0,063 rad tegen 0,096
> voor ongesmeed — het wapen werd dus *nauwkeuriger* door te upgraden, het
> tegenovergestelde probleem. Ongeschaald laten houdt bovendien de hersteltijd
> na het vuren gelijk over alle tiers: bij gelijke spreiding hoort gelijk
> herstel.
>
> Gemeten eindspreiding na een vol magazijn, alle drie de tiers: 0,096 NDC.

Bij maximale cadans (0,10 s) is de netto opbouw +0,010 − 0,004 = **+0,006 NDC
per schot**. Over een vol tier-0-magazijn (16 patronen) is dat 0,090, dus een
totale spread van 0,102 → **kegel 7,70°**, ruim acht keer de basis.

| schot (0,10 s cadans) | totale spread | kegel |
|---|---|---|
| 1 | 0,012 | 0,91° |
| 4 | 0,030 | 2,27° |
| 8 | 0,054 | 4,08° |
| 16 | 0,102 | 7,70° |
| plafond | 0,142 | 10,72° |

De afbouw ging mee omhoog (0,030 → 0,040) omdat het herstel vanaf een leeg
magazijn anders ruim 3 s duurde — langer dan een herlaadbeurt, dus je stond ook
ná het herladen nog te spuiten. Op 0,040 ijlt de spreiding ongeveer één
herlaad lang na (**1,95 s** gemeten): je betaalt voor het leegjagen, maar niet
twee keer.

**Burst recovery — de kern van "korte bursts blijven belonend".** Direct ná
schot *k* staat de opbouw op `0,006k + 0,004`, dus een burst van **drie** kogels
eindigt op 0,022 en blijft daarmee onder de drempel van 0,025; vanaf de vierde
kogel gaat hij eroverheen (0,028).

> **Correctie tijdens T143.** De eerste versie van deze regel luidde alleen
> "onder de drempel bouwt hij drie keer zo snel af". Dat sprak zichzelf tegen:
> de versnelde afbouw gold dan óók tussen twee schoten van een salvo door, en
> die wist per interval méér weg (0,090 × 0,1 = 0,009) dan een schot oplevert
> (0,005). De opbouw kon de drempel dus nooit halen en bleef eeuwig op nul —
> het hele mechanisme deed niets. De test die het volle magazijn narekende
> vond dat meteen.
>
> De regel is nu: **de versnelde afbouw geldt alleen wanneer je bent gestopt
> met vuren**, gemeten als een pauze langer dan 1,5× de eigen cadans van het
> wapen (`SPREAD_GESTOPT_FACTOR`). Herstel is iets wat na het loslaten van de
> trekker gebeurt, niet tussen twee kogels door.

| situatie | afbouw | tijd tot schoon |
|---|---|---|
| burst van 3, dan loslaten | 0,150/s (onder drempel) | **0,15 s** |
| burst van 4, dan loslaten | eerst 0,040, dan 0,150 | ~0,25 s |
| vol magazijn (16), dan loslaten | eerst 0,040, dan 0,150 | **~1,95 s** |
| vanaf het plafond (0,130) | eerst 0,040, dan 0,150 | ~2,8 s |

**Sustained-fire recoil.** De camera-kick loopt mee met de opbouw in plaats van
per schot constant te zijn:

```
kick = kickSterkte × (1 + spreadOpbouw / 0,032)
```

Schot 1: 0,006 rad (0,34°, ongewijzigd). Aan het eind van een vol tier-0-
magazijn (opbouw 0,030): 0,0116 rad (**0,67°**) — bijna verdubbeld. Bij het
opbouwplafond (0,048): 0,015 rad (**0,86°**), net iets bóven de enkele
AMSTEL-9-kick van 0,80°. Dat is de bedoeling en niet in tegenspraak met de
identiteiten: de AMSTEL-9 stoot één keer hard en staat daarna weer stil, de
Ripper begint zacht en wordt gaandeweg het onrustigst van de twee — je betaalt
voor doorratelen, niet voor het eerste schot.

**Model movement.** Continue, ritmische beweging tijdens vuren via de
T140-laag — zie §5 voor welk onderdeel.

**Penetration feedback.** De Doorboring (Fix 5 tier 2) is vandaag alleen in
schade merkbaar. Hij krijgt een eigen hoorbare/zichtbare tell. **De
schadewaarden blijven ongemoeid** (`RIPPER_DOORBORING_SCHADEFACTOR`
ongewijzigd) — dit is puur feedback.

**Cadans en herladen.** Ongewijzigd (0,10 s; 1,50 s / 0,90 s).

---

## 5. Animeerbare onderdelen — input voor T137

T140 legde de conventie `groep.userData.onderdelen` vast met semantische namen.
Hieronder per wapen welke sleutels moeten kunnen bewegen en waarvoor. **Elke
tier die T137/T138/T139 ontwerpt, moet deze sleutels blijven leveren.**

### AMSTEL-9 (`wapenDrukspuit.userData.onderdelen`)

| sleutel | huidige mesh | moet bewegen voor | soort beweging |
|---|---|---|---|
| `romp` | tank | recoil-kick per schot | `rotation.x` + `position.z`, terug naar rust |
| `loop` | mondstuk | muzzle-tell bij het schot | korte `position.z`-stoot |
| `greep` | greep | — | blijft stil (referentiepunt van de hand) |
| `accent` | meterDrukspuit | herlaad-pacing: drukmeter loopt op tijdens herladen | `material.emissiveIntensity` |

### Canal Ripper (`wapenRatelaar.userData.onderdelen`)

| sleutel | huidige mesh | moet bewegen voor | soort beweging |
|---|---|---|---|
| `romp` | chassis | sustained-fire schud, schaalt met `spreadOpbouw` | `rotation.x`/`position.z`, ritmisch |
| `loop` | loop | muzzle-tell | `position.z` |
| `greep` | greepRatelaar | — | blijft stil |
| `accent` | tandwielRatelaar | **de ratel-identiteit**: draait door tijdens vuren, tempo volgt de cadans | `rotation.y`, continu |
| `magazijn` | magazijnkast | herlaad-pacing: valt weg en komt terug | `position.y`, gekoppeld aan `herlaadTimer` |
| `kolf` | kolf | — | blijft stil |

### Mes (`wapenMes.userData.onderdelen`)

Geen gunfeel-rol. `romp`/`loop`/`greep` bestaan voor de volledigheid van de
conventie; het mes kent geen recoil, spread of tiers (het kan niet gesmeed
worden, §12.6).

**Randvoorwaarde voor alle bovenstaande beweging:** ze loopt via
`updateWapenPresentatie()` (T140) of via een even expliciete eigenaar, en keert
altijd exact terug naar de rustpose. De pixelvangrail
`test-visuele-basislijn.mjs` meet het wapen in beeld mee — een onderdeel dat in
rust niet exact terugkomt, verschuift de basislijn.

---

## 6. Waarin de twee wapens meetbaar verschillen

Dit is de tabel waar T142/T143 op afgerekend worden. Links de huidige stand,
rechts het doel.

| dimensie | AMSTEL-9 nu → doel | Canal Ripper nu → doel |
|---|---|---|
| spread, élk schot | 0,00° → **0,00° (contract, altijd)** | 0,91° → 0,91° basis |
| spread na vol magazijn | 0,00° → **0,00°** | 0,91° → **7,70°** |
| tijd tot volledig schoon | n.v.t. (nooit vuil) | n.v.t. → **0,15 s** (burst van 3) / ~1,95 s (vol magazijn) |
| Doorboring-feedback | n.v.t. | alleen schade → **eigen toon + tracer** |
| ratel-detail in beweging | — | stil → **tandwiel draait mee, loopt uit** |
| straf op ratelen | geen → **deterministische camera-klim** | geen → **willekeurige spreiding** |
| vizier-offset, geduldig vuren | 0,042° → 0,042° | n.v.t. |
| vizier-offset, ratelen | 0,042° → **0,159°** (3,8×) | n.v.t. |
| camera-kick schot 1 | 0,80° → 0,80° | 0,34° → 0,34° |
| camera-kick eind magazijn | 0,93° → **1,17°** | 0,54° → **~3,5°** |
| model-kick `rotation.x` | geen → **1,15°** | geen → ritmisch, schaalt mee |
| hitmarker kop-duur | 0,18 s → **0,24 s** | 0,18 s → 0,24 s (gedeeld) |
| cadans | 5,0/s | 10,0/s |
| TTK HP4 lichaam t0 | 0,60 s | 0,30 s |

**De ruil in één zin:** de Canal Ripper doodt sneller maar wordt onbetrouwbaar
zodra je doorratelt; de AMSTEL-9 doodt langzamer maar gaat élke kogel precies
waar de loop wijst — en hoe hoog die loop staat, bepaal jij met je timing.

De twee wapens straffen doorratelen dus met **verschillende soorten** straf, en
dat is opzet: de een met iets wat je kunt leren compenseren, de ander met iets
wat je alleen kunt vermijden.

---

## 7. Handmatige speeltoets — afgerond

De handmatige toets uit de ticket-acceptatie is uitgevoerd, over twee rondes.

**Ronde 1** (vóór de Ripper-bijstelling in §4): de AMSTEL-9 voelde meteen
goed — precies, met een kickback die bij een krachtig handwapen past. De
Canal Ripper niet: een vol magazijn leegjagen gaf nauwelijks meer spreiding
of beeldbeweging dan één AMSTEL-9-schot. Dat leidde tot de eerste bijstelling
(kegel 3,2° → 7,7°, zie de correctie in §4).

**Ronde 2** (na die bijstelling): het beeld schudde nu wel merkbaar, maar het
richtpunt zelf bewoog niet — de speler hoefde niets te corrigeren. Dat bleek
geen tuningprobleem maar een architectuurkeuze: `cameraKick` was volledig
herstellend, dus er was structureel niets om te compenseren. Dat leidde tot
`pitchKickFractie` (§3/§4): een deel van elke kick blijft nu als echte
`speler.pitch`-verandering staan — 0 voor de AMSTEL-9 (geen aim-drift, zijn
goedgekeurde gevoel blijft exact), 0,35 voor de Ripper.

**Bevestigd:** met `pitchKickFractie` op deze waarden voelen beide wapens
goed. Geen verdere bijstelling nodig. De doelbanden in §3, §4 en §6 gelden
zoals vastgelegd, inclusief de twee correcties.

---

## 8. Mijlpaal M2 — kloppen de twee wapens sámen?

M2 stelt de vraag die T141 nog niet kón beantwoorden. De TTK-tabel in §1.1 ging
uit van *"elke kogel raakt"* en was dus puur een schade-/cadanssom. Sinds T143
mist de Canal Ripper een deel van zijn kogels en klimt zijn richtpunt. Zijn
rauwe TTK-voordeel — in tier 0 en 1 was hij in élke cel even snel of sneller —
hoefde dus niet meer te gelden.

Meetscript: `tests/meet-m2-wapenbalans.mjs`. Dat vuurt echte magazijnen op een
echte ondode via `schiet()` en telt hoeveel kogels de echte hitbox-proxies
raken. Twee scenario's per wapen, want daartussen zit de vaardigheidskloof die
het ontwerp bedoelt: **ongecompenseerd** (de speler trekt niet terug) en
**gecompenseerd** (de speler trekt de klim perfect terug).

### 8.1 Gemeten trefferkans (40 magazijnen per cel)

| | 3 m | 6 m | 10 m |
|---|---|---|---|
| AMSTEL-9, ongecomp. | 100% | 100% | 100% |
| AMSTEL-9, gecomp. | 100% | 100% | 100% |
| Canal Ripper, ongecomp. | 100% | 95,0% | 72,0% |
| Canal Ripper, gecomp. | 100% | 97,7% | 81,6% |

De AMSTEL-9 staat op 100% in élke cel — precies wat zijn contract (`spreadNdc`
exact 0, `pitchKickFractie` 0) belooft, en meteen de sanity-check dat de
meting klopt. Een eerdere versie van het meetscript liet `cameraKick`
ongeremd oplopen (die decayt in de cosmetische gameLoop-zone, niet in
`updateWapenPresentatie()` — T140 liet camera-effecten expliciet buiten scope)
en rapporteerde daardoor 58% voor een wapen dat per definitie niet kan missen.

### 8.2 Wat dat betekent voor de balans

**De straf van de Ripper is afstandsafhankelijk, en dat is niet neutraal.**
Op 3 m is doorratelen letterlijk gratis: 100%, ook zonder compenseren. Pas
vanaf ~6 m gaat het tellen, en op 10 m kost het een kwart tot een derde van je
kogels. Effectieve TTK op 6 m (rake schoten ÷ trefferkans × cadans) laat zien
dat de accuratesse-straf hem daar hooguit ~0,01 s kost: **hij blijft in tier 0
en 1 ongeveer twee keer zo snel als de AMSTEL-9.**

De conclusie van T141 staat dus overeind: *de AMSTEL-9 wint niet op TTK, en na
T142-T144 nog steeds niet.* Zijn waarde ligt in twee dingen die de meting wél
bevestigt:

1. **Zekerheid.** 100% op 10 m tegenover 72-82%.
2. **Het tier-2-moment.** Bij Smederij-tier 2 doodt hij élke HP-trap in één
   schot (0,00 s), óók HP 4 — waar de Ripper er dan nog twee nodig heeft. Dat
   is precies bij de taaiste late-game vijanden.

> **Achterhaald door de speeltoets-bijstelling na T139.** Punt 2 gold bij een
> tier-2-lichaamsschade van 5,0. Die is teruggebracht naar 3,0 (zie §1.1),
> juist omdát "alles gaat in één schot dood" het mikken zinloos maakte. HP 4
> kost nu twee lichaamsschoten óf één koptreffer.
>
> Het tier-2-moment is daarmee niet verdwenen maar **verplaatst**: van "elke
> kill is gratis" naar "elke kill is gratis als je de kop raakt". Dat is
> dichter bij de precisie-identiteit uit §3 dan de oude situatie was. Punt 1
> (zekerheid) is ongewijzigd — dat is een spread-eigenschap, geen schade.

### 8.3 Speeltoets M2 — afgerond

Het grootste deel van het gevecht in een grachtenpand speelt zich op korte
afstand af. Daar is de spreidingsstraf van de Ripper **niet voelbaar** (100%
op 3 m). Het risico was dus dat "agressie met oplopende straf" in de praktijk
zelden aangaat, en de Ripper simpelweg het betere wapen blijft — een
speelgevoel-vraag die de getallen alleen niet konden beantwoorden.

Drie gerichte vragen zijn tijdens de speeltoets bevestigd:
1. Het tier-2-moment van de AMSTEL-9 (eenschots-explosie) leest nog steeds
   duidelijk als een apart, herkenbaar moment naast de nieuwe kickback/ratel-
   straf — geen vermenging met de gewone terugslag.
2. De situatie hierboven — spreidingsstraf onzichtbaar op 3 m, wel voelbaar
   vanaf ~6-10 m — is in de praktijk geen probleem: op korte afstand is de
   Ripper bewust het sterkere wapen, en dat verschil met de AMSTEL-9 blijft op
   afstand aanwezig.
3. Fix 5's tier-2-beloningen (AMSTEL-9-explosie, Ripper-Doorboring) voelen
   nog steeds als een echte beloning bovenop de nieuwe gunfeel, niet
   overschaduwd door de T142/T143-aanpassingen.

**Bevestigd:** geen verdere bijstelling nodig op basis van deze speeltoets.

### 8.4 Fix 5 tier-2-beloningen

| | waarde |
|---|---|
| AMSTEL-9-explosie | radius 2 m, schadefactor 0,6 |
| Ripper-Doorboring | 1 extra doel, schadefactor 0,6 |
| Smederij-schadebonus | AMSTEL-9 +1,5 / **+0,5** · Ripper +1,0 / **+0,5** |

De twee effecten zijn door T142-T144 niet aangeraakt (alle drie sluiten
schadewaarden expliciet uit). T143 gaf de Doorboring wél voor het eerst een
eigen hoorbare en zichtbare tell — daarvóór was hij alleen in de schade
merkbaar.

De **schadebonus** van niveau 2 is ná T139 wél bijgesteld (van +2,5 / +1,8 naar
+0,5), om de reden in §1.1. De beloning van niveau 2 verschuift daarmee van
"veel meer schade" naar "het effect plus een groter magazijn" — en juist die
twee zijn wat het van niveau 1 onderscheidt.

### 8.5 Twee gemelde bugs in de AMSTEL-9-explosie

Uit dezelfde speeltoets, allebei in `schotExplosie()` en allebei dezelfde
oorzaak: de functie kreeg alleen `x` en `z` mee. De hoogte van het raakpunt
werd door beide aanroepers weggegooid en de flits stond op een vaste `y = 0.9`.

1. *"Het bolletje komt altijd op dezelfde plek, ook al schiet ik op zijn
   hoofd."* — klopt: de verticale positie was een constante.
2. *"In de kelder zie ik geen ontploffing."* — die hing op de hoogte van de
   begane grond, dus door het plafond heen.

De hoogte reist nu mee met het raakpunt. Meteen meegenomen: de **splash-schade**
was ook puur horizontaal (alleen `dx`/`dz`), waardoor een explosie in de kelder
ondoden recht daarboven raakte. Die is nu 3D, gemeten naar het verticale midden
van de lichaams-hitbox — niet naar `groep.position` (de voeten), want dan zou
de lichaamshoogte zelf als afstand meetellen en de effectieve radius kleiner
maken dan `AMSTEL9_EXPLOSIE_RADIUS` belooft.
