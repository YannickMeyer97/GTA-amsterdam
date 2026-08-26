# FINALE.md — ontwerp van de instapfase

Ticket 145 (Ronde 11, fase 4). Dit document legt vast hoe de aankomende boot
een climax van ~30 seconden wordt, **als uitbreiding van de bestaande
ontsnappingsmachine** — niet als nieuw encounter-systeem (ontwerpbeslissing
103). Het is de directe input voor T146 (state-machine + UI) en T147
(escalatie + vertrek): na dit document staat er geen ontwerpkeuze meer open.

Zelfde rol als `GUNFEEL.md` voor T142-T144 en `TIERVISUALS.md` voor T138/T139.

Meetscript: `tests/meet-finale-budget.mjs`.

---

## 0. Waar we vandaan komen

Vandaag is `T` bij de boot één regel gameplay:

```js
function probeerOntsnapping() {
  if (spelStaat.geld < ONTSNAPPING_PRIJS) { … return; }
  spelStaat.geld -= ONTSNAPPING_PRIJS;
  updateHUD();
  toonWinScherm();
}
```

Je betaalt €2500 en het spel is voorbij. Alles eromheen — de boot die
aan komt varen, de hoorn, de banner, de lantaarnpuls, het venster dat weer
sluit — is al gebouwd en werkt. Wat ontbreekt is dat er tussen "ik druk op T"
en "ik heb gewonnen" **niets gebeurt**.

De machine die er al staat:

| onderdeel | wat het doet |
|---|---|
| `probeerOntsnappingsVensterTeOpenen()` | start de aankondiging (hoorn, banner, timer van 5 s) |
| `updateOntsnappingAankondiging(dt)` | telt die timer af, `spelActief`-gated |
| `toonOntsnappingspuntIndienKlaar()` | zet het interactiepunt bij de vlonder neer |
| `updateBootPositie()` | vaart de boot fysiek aan en weer weg, idempotent |
| `updateOntsnappingVensterHUD()` | schrijft de statusregel in `#ontsnappingVensterUI` |
| wave-complete-tak van `updateGolf()` | sluit het venster als de golf geen ontsnappingsgolf meer is |
| `toonWinScherm()` | het eindpunt, inclusief score en stats |

**De hele finale is een fase die tússen het interactiepunt en `toonWinScherm()`
past.** Dat is de kern van dit ontwerp.

---

## 1. Gemeten begroting

Alle getallen uit `tests/meet-finale-budget.mjs`.

### 1.1 Correctie op ARCHITECTURE_NOTES §13.6

Dat document zegt: *"Bij ~30 s past een surge van ~25 spawns binnen
`effectiefMaxActief()` (max 26)."*

**Het werkelijke plafond is 18, niet 26.**

| ontgrendelde zones | `effectiefMaxActief()` | `effectiefSpawnInterval()` | spawnpogingen in 30 s |
|---|---|---|---|
| 1 | 14 | 1,100 s | 27 |
| 2 | 16 | 0,935 s | 32 |
| 3 | 18 | 0,795 s | 37 |
| 4 | 18 | 0,795 s | 37 |

De formule is `GOLF_MAX_ACTIEF (14) + ZONE_MAX_ACTIEF_BONUS (2) × (min(zones,3) − 1)`,
dus 14 → 16 → 18 en daarna vlak (de `min` clampt op 3). `test-eventgolven.mjs`
legt datzelfde al vast: *"Spawn-cap per zonestand is 14/16/18"*. De 26 in §13.6
is niet uit de code te herleiden.

**Waarom dit ertoe doet.** Het plafond is niet alleen een perf-grens, het is de
vorm van de finale. Bij 18 kun je niet "overspoeld" worden met veertig ondoden
tegelijk. De druk zit dus **niet in het aantal op het scherm** maar in het
tempo waarmee er een nieuwe binnenkomt zodra je er één doodt: elke 0,8 s, dertig
seconden lang. Dat is een andere ervaring dan §13.6 suggereerde, en T147 moet
daarop ontwerpen — een surge die op "aantal" mikt, loopt gewoon tegen de klem
en voelt vlak.

Prettige bijvangst: de acceptatie-eis van T147 (*"`ondoden.length` overschrijdt
nooit `effectiefMaxActief()`"*) is **automatisch waar** zolang de surge via
`golfSpawnStap()` loopt. De klem zit al in het bestaande spawnpad; er is geen
aparte bewaking voor nodig.

### 1.2 Budget

| | waarde |
|---|---|
| threat-kosten per type | normaal 1 · loper 1,4 · sluiper 1,5 · brander 1,8 · sjouwer 3 |
| gemiddeld per spawn | 1,74 |
| 37 spawnpogingen × 1,74 | **≈ 64 budget** |

Ter ijking, het budget van een hele golf: golf 10 → 20, golf 13 → 25,
golf 16 → 31, golf 19 → 36, golf 22 → 41.

Een surge op vol tempo is dus **ruim anderhalve golf aan dreiging in dertig
seconden**. Dat is fors, en het hoort fors te zijn — maar het is ook precies de
knop die T147 moet kunnen draaien zonder iets anders aan te raken.

### 1.3 Invarianten om te bewaken

| | nu | verwachting na T146/T147 |
|---|---|---|
| `interactiePunten` | 14 | **14** — de instapfase hergebruikt het bestaande ontsnappingspunt, er komt er geen bij |
| lichten | 28 | **28** — geen nieuwe lichten (harde eis T147) |
| effect-pools | impact 24 · tracer 8 · rook 8 | **ongewijzigd** |

### 1.4 Bestaande ritmes, ter ijking van de duur

`GOLF_RUST_TIJD` 8 s · `ONTSNAPPING_AANKONDIGING_DUUR` 5 s ·
`BOOT_HOORN_HERHAAL_INTERVAL` 7 s · `ONTSNAPPING_PRIJS` €2500.

---

## 2. De zes beslissingen

### Beslissing 1 — `T` start de instapfase, en wint niet meteen

`probeerOntsnapping()` splitst in tweeën:

- **`probeerOntsnapping()`** — controleert het geld, schrijft het af, en start
  de instapfase.
- **`voltooiOntsnapping()`** — wordt door de timer aangeroepen en doet wat
  `probeerOntsnapping()` nu aan het eind doet: `toonWinScherm()`.

`toonWinScherm()` zelf blijft **volledig ongewijzigd**, inclusief de score- en
statsberekening. Dat is de reden om precies hier te splitsen: alles wat na de
fase komt, is al af.

**Het geld wordt bij de START afgeschreven**, niet bij voltooiing. Drie redenen:

1. De prompt zegt al *"Druk T: ontsnap over het water (€2500)"* — je koopt de
   overtocht, en die begint op dat moment.
2. Anders toont de HUD dertig seconden lang €2500 die je feitelijk al kwijt
   bent.
3. Het sluit een echt randgeval: met beslissing 3 mag je weglopen, en er staan
   winkels elders in het pand. Zou het geld pas bij voltooiing afgaan, dan kun
   je tijdens je eigen instapfase je overtocht opmaken bij de Smederij en met
   te weinig geld terugkomen. Afschrijven bij start maakt die vraag
   betekenisloos in plaats van dat T146 er een regel voor moet verzinnen.

### Beslissing 2 — Duur: 30 seconden

Midden in de gevraagde 20-45 s, en het past op de bestaande ritmes: ruim vier
keer `GOLF_RUST_TIJD`, zes keer de aankondigingsduur, ruim vier keer het
boothoorn-interval (dus de hoorn kan hoorbaar versnellen zonder ratelend te
worden).

Tegen 0,795 s per spawn zijn dat 37 spawnpogingen — genoeg om het plafond van
18 meermaals te vullen, ook als de speler goed doodt.

### Beslissing 3 — Faalgedrag en weglopen

**Geen aparte faalstaat.** Doodgaan tijdens de instapfase is gewoon game over
via het bestaande pad. Dat scheelt een compleet herstel-scenario en past bij
§13.6.

**Weglopen pauzeert de timer; terugkomen hervat 'm.** Dit maakt de fase een
echte *holdout*: je moet die plek vasthouden, want vooruitgang bestaat alleen
terwijl je er staat. Wegrennen voor de horde is geen strategie meer, maar één
keer teruggeduwd worden door een Sjouwer kost je ook niet je hele run — de
timer wacht gewoon.

De detectie is gratis: `updateInteracties()` berekent élke frame al of de
speler binnen de radius van een interactiepunt staat. De fase leest dat
resultaat en hoeft zelf niets te meten.

> **Alternatief dat is afgevallen: instap breekt af.** Dat leest hard en
> straft één ongelukkige knockback met een volledige herstart van de fase —
> terwijl de knockback zelf al straf genoeg is. Pauzeren geeft dezelfde
> "je moet hier blijven"-druk zonder de frustratiepiek.

### Beslissing 4 — Escalatiebronnen

Alle vier de lagen lopen mee, elk via een bestaand kanaal. **Nul nieuwe
systemen.**

| laag | kanaal | wat er gebeurt |
|---|---|---|
| Meer ondoden | `spelStaat.budget` + `golfSpawnStap()` | budget-injectie bij de start van de fase; het bestaande spawnpad doet de rest |
| Geluid | `dreigingsGainNode`, boothoorn-interval | de dreigingslaag zwelt aan; de hoorn gaat sneller toeteren naarmate het vertrek nadert |
| Beeld | `scene.fog`, `OOG_INTENSITEIT_*`, `lampDipFactor`, `vignetFlits` | mist trekt op, ogen feller, lampen dippen, vignet knijpt |
| Laatste seconden | banner + HUD + hoorn | de slotfase krijgt een eigen, herkenbare tell |

**Alles is een functie van de resterende tijd.** De escalatie heeft daardoor
*geen eigen state*: T147 leest `instapTimer / FINALE_DUUR` en leidt daar elk
kanaal uit af. Dat is de reden dat T147 niets aan de state-machine van T146
hoeft toe te voegen.

**De harde eis die hierbij hoort:** elk kanaal moet op élk exitpad terug naar
zijn rustwaarde — winst, game over, én de speler die wegloopt terwijl de fase
gepauzeerd staat. Het precedent staat in de code: `scene.fog` moest een
expliciete restore in `gameOver()` krijgen omdat het death-scherm anders in de
mist hing, en `eindigEventGolf(direct = true)` bestaat precies daarvoor. T147
volgt dat patroon per kanaal.

### Beslissing 5 — Objective-UI

Hergebruikt `#ontsnappingVensterUI`, het element dat nu al *"Boot ligt aan!"*
en *"Boot nadert…"* toont. Er komt één regel bij in
`updateOntsnappingVensterHUD()`:

| situatie | tekst |
|---|---|
| vluchtroute onvolledig | *(leeg)* |
| boot nadert | `Boot nadert…` |
| boot ligt aan | `Boot ligt aan!` |
| **instap loopt** | `Losgooien… {n}s` |
| **instap gepauzeerd** | `Blijf bij de boot!` |
| geen venster open | `Boot over N golven` |

De pauze-tekst is bewust een *opdracht* en geen statusmelding: hij verschijnt
precies op het moment dat de speler iets moet doen.

`toonGolfBanner()` markeert de twee overgangen (start van de instap, en de
slotfase uit beslissing 4) — hetzelfde middel waarmee de aankondiging en
"De boot vaart weer weg" nu al worden aangekondigd.

### Beslissing 6 — Golfgrens

**Zodra de instapfase loopt, houdt de golfgrens het venster niet meer tegen.**
De boot wacht op de speler.

Vandaag sluit de wave-complete-tak van `updateGolf()` het venster zodra de
nieuwe golf geen ontsnappingsgolf meer is: interactiepunt weg, `speelBootVertrek()`,
banner *"De boot vaart weer weg"*, uitvaar-animatie. Dat blok krijgt één extra
voorwaarde: **niet als de instapfase actief is.**

De reden is speelgevoel: zonder die uitzondering kun je 28 van de 30 seconden
overleven en alsnog je boot zien wegvaren omdat de golf toevallig eindigde. Dat
is geen spannende faalstaat maar een willekeurige.

> **Alternatief dat is afgevallen: golf-einde uitstellen.** Zuiverder in
> theorie, maar het raakt het golfsysteem zelf — en dat legt het ticket
> expliciet buiten scope. De uitzondering in de wave-complete-tak is één
> conditie op één plek.

**Dit is de gevaarlijkste plek van het hele ticket.** `test-ontsnapping-vensters.mjs`
is 432 regels en bewaakt precies dit blok, inclusief de zeldzame tak waarin de
aankondiging nog loopt als de golf eindigt. T146 leest dat bestand vóór het die
regel aanraakt.

---

## 3. Wat er precies bijkomt

### 3.1 Nieuwe state — twee variabelen

```js
let instapActief = false;
let instapTimer  = 0;
```

Exact het patroon van `ontsnappingAankondigingActief` / `-Timer` ernaast, met
dezelfde discipline: getikt vanuit de `spelActief`-tak van de gameLoop, dus
pauzeerbaar, en niet te omzeilen door het spel te pauzeren.

Meer is er niet nodig. De escalatie (T147) is een functie van `instapTimer`; de
"speler is erbij"-check komt uit `updateInteracties()`; het geld is bij de start
al afgeschreven.

### 3.2 Hergebruikte functies — de hele rest

`toonWinScherm()` · `toonGolfBanner()` · `updateOntsnappingVensterHUD()` ·
`updateInteracties()` · `golfSpawnStap()` · `speelBootHoorn()` ·
`updateBootPositie()` · `gameOver()` · het complete `interactiePunten`-systeem.

### 3.3 Waarom hier géén encounter-engine hoort

Een generieke encounter-engine zou trigger-condities, fase-definities,
escalatiecurves en herstelregels als data moeten modelleren. Dit spel heeft
**één** encounter, die **één keer per run** kan afgaan, met een vaste duur en
vier escalatiekanalen die allemaal al bestaan.

De rekensom: de engine zou honderden regels nieuwe abstractie kosten om iets te
beschrijven dat met twee variabelen en één extra conditie in een bestaande
if-tak werkt. Elke regel daarvan is nieuw oppervlak voor bugs in code die verder
niets oplost — en het bouwt een generieke laag voor een tweede en derde
encounter die niet bestaan en niet gepland zijn.

Mocht er ooit een tweede finale-achtig moment komen, dan is dít de goedkoopste
manier om erachter te komen wat zo'n laag écht zou moeten kunnen.

---

## 4. Verwachte testimpact — afgerond (T146)

| bestand | regels | uitkomst |
|---|---|---|
| `test-ontsnapping.mjs` | 219 → 233 | **Gewijzigd, zoals verwacht.** Sectie 4/5 riepen `probeerOntsnapping()` aan en verwachtten meteen het winscherm; roepen nu daarna expliciet `voltooiOntsnapping()` aan om bij dezelfde inhoud (score/stats/record) te komen — die inhoud zelf is onaangeraakt. 25/25 groen. |
| `test-ontsnapping-vensters.mjs` | 432 → 481 | **Gewijzigd op precies één punt, zoals verwacht.** Twee nieuwe subsecties (7d/7e) bewaken de uitzondering uit beslissing 6 én het tegendeel (zonder instap sluit het venster nog gewoon — bewijst dat de uitzondering niet per ongeluk permanent is). Alle 44 bestaande checks **ongewijzigd** gebleven. 49/49 groen. |
| `test-boot-aankondiging.mjs` | 179 | **Ongewijzigd**, zoals verwacht. 19/19 groen. |
| `test-vluchtroute.mjs` | 222 | **Ongewijzigd**, zoals verwacht. 21/21 groen. |
| `test-eventgolven.mjs` | 195 | Niet aangeraakt in T146 (raakt pas relevant bij T147). |
| `tests/test-finale.mjs` | *nieuw*, 178 | Start via een echte `KeyT` + positie, dubbele `T` is een no-op, timer telt af/pauzeert/hervat via de ECHTE gameLoop (wall-clock, geen gesimuleerde tijd), automatische voltooiing, game over midden in de fase + opruiming, `interactiePunten`-invariant. Escalatie **en herstel** volgen in T147, met eigen dekking bovenop dit bestand. 16/16 groen. |

**Een bug gevonden tijdens het testen, niet in het ontwerp voorzien:** `voltooiOntsnapping()` liet de statusregel op de laatst geschreven instapfase-tekst staan ("Blijf bij de boot!"/"Losgooien… Ns") in plaats van terug te springen naar "Boot ligt aan!" — `toonWinScherm()` raakt die regel niet aan, en niets anders ververste 'm totdat "Speel door" het punt weer volledig opruimde. Gefixt met één extra `updateOntsnappingVensterHUD()`-aanroep in `voltooiOntsnapping()`, vóór `toonWinScherm()`.

---

## 5. Checklist voor T146 en T147

**T146 — de machine — afgerond**

- [x] `probeerOntsnapping()` gesplitst; `toonWinScherm()` ongewijzigd gelaten.
- [x] Geld afgeschreven bij de start (beslissing 1).
- [x] `instapActief` / `instapTimer` (+ `FINALE_INSTAP_DUUR = 30`), getikt via
      `updateFinaleInstap(dt)` in de `spelActief`-tak, ná `updateInteracties()`.
- [x] Timer loopt alleen terwijl `huidigeInteractie === ontsnappingsPunt`
      (beslissing 3) — hergebruikt de bestaande proximity-check, geen eigen
      afstandsmeting.
- [x] Uitzondering in de wave-complete-tak (beslissing 6), met companion-test
      die bewijst dat de uitzondering precies smal genoeg is.
- [x] Twee nieuwe HUD-regels (beslissing 5): `Losgooien… {n}s` (bij de boot),
      `Blijf bij de boot!` (weg). De interactie-prompt van het punt zelf toont
      tijdens de instap dezelfde aftelling in plaats van de nu-onjuiste
      "Druk T"-instructie.
- [x] Doodgaan tijdens de fase = normale game over; `gameOver()` ruimt
      `instapActief`/`instapTimer` expliciet op.
- [x] `tests/test-finale.mjs` (nieuw, 16 checks); `interactiePunten`-invariant
      bewaakt (verandert niet door het starten/voltooien/afbreken van de fase).
- [x] Volledige regressiesuite groen (zie hieronder).

**T147 — de escalatie**

- [ ] Budget-injectie bij de start; grep bevestigt nul nieuwe spawnpaden.
- [ ] Escalatie als functie van `instapTimer / FINALE_INSTAP_DUUR` — geen
      nieuwe state (de constante heet in de code `FINALE_INSTAP_DUUR`, niet
      `FINALE_DUUR`).
- [ ] Vier kanalen (spawn, audio, beeld, slotfase) uit beslissing 4.
- [ ] **Elk kanaal herstelt op élk exitpad**: winst, game over, en pauze door
      weglopen. Dit is de bekende valkuil; volg het `eindigEventGolf(direct)`-precedent.
- [ ] Lichten blijven 28; poolgroottes ongewijzigd.
- [ ] Ontwerp op **tempo**, niet op aantal — het plafond van 18 (§1.1) maakt
      "meer op het scherm" onmogelijk voorbij dat punt.
- [ ] F3 tijdens de piek: p95 vastgelegd in het ticket.
