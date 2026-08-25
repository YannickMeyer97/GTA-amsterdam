# GUNFEEL.md — wapengevoel in getallen

Ticket 141 (Ronde 11, fase 2). Dit document legt vast wat "precies en
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
| 2 | 5,0 | 3,8 |

**AMSTEL-9** (cadans 0,2 s):

| HP | tier 0 lichaam | tier 0 kop | tier 1 lichaam | tier 1 kop | tier 2 lichaam | tier 2 kop |
|---|---|---|---|---|---|---|
| 1 | 1 (0,00 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 2 | 2 (0,20 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 3 | 3 (0,40 s) | 2 (0,20) | 2 (0,20) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 4 | 4 (0,60 s) | 2 (0,20) | 2 (0,20) | 2 (0,20) | 1 (0,00) | 1 (0,00) |

**Canal Ripper** (cadans 0,1 s):

| HP | tier 0 lichaam | tier 0 kop | tier 1 lichaam | tier 1 kop | tier 2 lichaam | tier 2 kop |
|---|---|---|---|---|---|---|
| 1 | 1 (0,00 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 2 | 2 (0,10 s) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 3 | 3 (0,20 s) | 2 (0,10) | 2 (0,10) | 1 (0,00) | 1 (0,00) | 1 (0,00) |
| 4 | 4 (0,30 s) | 2 (0,10) | 2 (0,10) | 2 (0,10) | 2 (0,10) | 1 (0,00) |

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

**Spread-opbouw (nieuw, via `wapenStaat.spreadOpbouw`).**

| parameter | waarde |
|---|---|
| toename per schot | +0,012 NDC |
| afbouw | 0,040 NDC/s |
| plafond | 0,030 NDC (kegel 2,27°) |
| toegepaste waarde | de stand **vóór** dit schot; daarna pas optellen |

Die laatste regel is wat het first-shot-contract bewaart: schot 1 vuurt op 0.

De afbouw is bewust op de camera-kick-hersteltijd afgestemd:

```
0,012 NDC / 0,040 NDC/s = 0,30 s  ≈  camera-kick herstel tot 5% (0,2996 s)
```

**Daarmee is de regel voor de speler één zin: wacht tot het beeld stil staat en
elk schot is exact zuiver; ratel door en je spreiding loopt op.**

Gedrag bij maximale cadans (0,20 s): per schot netto +0,012 − 0,008 = **+0,004
NDC**. Schot *n* vuurt dus op `(n−1) × 0,004`; het plafond wordt pas bij schot 9
geraakt — op tier 0 (magazijn 8) loopt de spreiding precies één magazijn lang op
zonder het plafond te halen.

| schot (0,20 s cadans) | spread bij afvuren | kegel |
|---|---|---|
| 1 | 0,000 | 0,00° |
| 2 | 0,004 | 0,30° |
| 3 | 0,008 | 0,60° |
| 5 | 0,016 | 1,21° |
| 8 (laatste van tier-0-magazijn) | 0,028 | 2,11° |
| 9+ | 0,030 (plafond) | 2,27° |

Bij 0,30 s tussen de schoten blijft elke waarde 0,000.

**Recoil.** Camera-kick 0,014 rad per schot en de decay-constante 10 blijven
ongewijzigd — die verhouding is de basis waar de spread-afbouw op is
afgestemd. De verdeling camera vs. model: camera 0,014 rad (bestaand),
model-terugslag piek 0,080 m op z (bestaand) plus een **nieuwe model-kick op
`rotation.x`** van 0,020 rad (1,15°), met dezelfde lineaire afbouw als de
z-terugslag (6/s → volledig terug in 0,167 s). Die loopt via de T140-laag en
moet exact op de rustpositie terugkomen.

**Cadans.** Ongewijzigd op 0,20 s. De straf op sneller vuren is de spread, niet
een langere cooldown — een cooldown-verlenging zou het wapen traag laten
*aanvoelen* in plaats van onnauwkeurig.

**Herladen.** Ongewijzigd (1,20 s / 0,70 s).

---

## 4. Doelspec — Canal Ripper (T143)

> Identiteit: korte bursts blijven beheersbaar, volgehouden vuur wordt steeds
> moeilijker.

**Basisspreiding.** `spreadNdc = 0,012` blijft de **basis** (kegel 0,906°) —
hier ligt geen contract op nul; onnauwkeurigheid hoort bij dit wapen.

**Spread-opbouw.**

| parameter | waarde |
|---|---|
| toename per schot | +0,005 NDC |
| afbouw boven de burst-drempel | 0,030 NDC/s |
| afbouw onder de burst-drempel | 0,090 NDC/s (3×) |
| burst-drempel | 0,010 NDC |
| plafond | 0,048 NDC |
| totale spread | `spreadNdc + spreadOpbouw` |

Bij maximale cadans (0,10 s) is de netto opbouw +0,005 − 0,003 = **+0,002 NDC
per schot**. Over een vol tier-0-magazijn (16 patronen) is dat 0,032, dus een
totale spread van 0,044 → **kegel 3,32°**, ruim drie keer de basis.

| schot (0,10 s cadans) | totale spread | kegel |
|---|---|---|
| 1 | 0,012 | 0,91° |
| 4 | 0,018 | 1,36° |
| 8 | 0,026 | 1,96° |
| 16 | 0,042 | 3,17° |
| plafond | 0,060 | 4,53° |

**Burst recovery — de kern van "korte bursts blijven belonend".** Direct ná
schot *k* staat de opbouw op `0,002k + 0,003`, dus een burst van **drie** kogels
eindigt op 0,009 en blijft daarmee onder de drempel van 0,010; vanaf de vierde
kogel gaat hij eroverheen (0,011). Onder de drempel valt de opbouw drie keer zo
snel terug: 0,010 / 0,090 = **0,11 s** om volledig schoon te zijn. Een burst van
drie is dus praktisch gratis, terwijl doorratelen boven de drempel komt en dan
met 0,030/s afbouwt — 1,6 s vanaf het plafond.

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
| spread schot 1 | 0,00° → **0,00° (contract)** | 0,91° → 0,91° |
| spread na vol magazijn | 0,00° → **2,27°** | 0,91° → **3,17°** |
| spread na 0,30 s pauze | 0,00° → **0,00°** | 0,91° → 0,91° |
| tijd tot volledig schoon | n.v.t. → **0,30 s** | n.v.t. → **0,11 s** (burst) / 1,6 s (plafond) |
| camera-kick schot 1 | 0,80° → 0,80° | 0,34° → 0,34° |
| camera-kick eind magazijn | 0,93° → 0,93° | 0,54° → **0,67°** |
| model-kick `rotation.x` | geen → **1,15°** | geen → ritmisch, schaalt mee |
| cadans | 5,0/s | 10,0/s |
| TTK HP4 lichaam t0 | 0,60 s | 0,30 s |

**De ruil in één zin:** de Canal Ripper doodt sneller maar wordt onbetrouwbaar
zodra je doorratelt; de AMSTEL-9 doodt langzamer maar is exact zo zuiver als
jouw geduld.

---

## 7. Open punt

De handmatige toets uit de ticket-acceptatie (beide wapens vijf minuten spelen
met de meetwaarden erbij, om te controleren of de getallen overeenkomen met wat
je voelt) staat nog open. De doelbanden in §3, §4 en §6 zijn onderbouwd met de
meting maar nog niet met de hand geverifieerd; als het spelen iets anders
uitwijst, worden ze hier bijgesteld vóór T142/T143 ze implementeren.
