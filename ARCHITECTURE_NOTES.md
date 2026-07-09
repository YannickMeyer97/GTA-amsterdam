# ARCHITECTURE_NOTES.md — Amsterdam Undead

Geschreven door Claude Fable (architectuurronde, geen code gewijzigd).
Doel: alles wat een uitvoerende sessie (Claude Sonnet) moet weten over de
huidige code voordat de tickets in `ROADMAP.md` (sectie "v0.14+") worden
uitgevoerd. Regelnummers zijn een momentopname en verschuiven bij elke edit —
zoek altijd op symboolnaam, niet op regelnummer.

Alle gamecode staat in één bestand: `amsterdam-undead.html` (single-file,
Three.js via CDN-importmap, geen build-stap). Dat blijft zo.

---

## 1. Codekaart — waar zit wat

### Wave-heal
- Constante: `WAVE_HEAL_MIN = 75` (~r1910, blok "Balanswaarden golven").
- Toegepast in `updateGolf(dt)` in de wave-complete-branch:
  `spelerStaat.hp = Math.max(spelerStaat.hp, WAVE_HEAL_MIN);` — verhoogt dus
  alleen, verlaagt nooit. De branch triggert zodra
  `teSpawnen === 0 && ondoden.length === 0`, en doet daar ook: `golf++`,
  `rustTimer = GOLF_RUST_TIJD (8s)`, wave-bonus
  (`WAVE_BONUS_BASIS 75 + golf * WAVE_BONUS_PER_GOLF 15`), banner
  "Wave cleared", `speelGolfKlaar()`.
- Let op: de tekst "minimaal 75 HP" staat óók in `README.md` — bij een
  balanswijziging meenemen.

### Power-up drops
- Dropkans: `POWERUP_DROP_KANS = 0.12` (~r1917).
- Droppunt: in `raakOndode()` — ná een dodelijke treffer:
  `if (Math.random() < POWERUP_DROP_KANS) spawnPowerupDrop(x, z, kiesPowerupType());`
- Typekeuze: `kiesPowerupType()` — nu een **uniforme** loting over alle vier
  `POWERUP_TYPES`-sleutels, zonder enige cooldown of weging. Dit is het
  aangrijpingspunt voor de cooldown-tickets (2 en 3).
- Drop-lifecycle: `spawnPowerupDrop()` (octahedron-mesh + PointLight, in
  `powerups[]`), `updatePowerups(dt)` (draai/zweef-animatie, verval na
  `POWERUP_VERVAL_TIJD = 12`s, automatische pickup binnen
  `POWERUP_PICKUP_RADIUS = 0.9` m), `raapPowerupOp()` (verwijdert +
  activeert effect + `speelKoop()`).

### Power-up effecten
- `POWERUP_TYPES` (~r1922): map met `{ naam, kleur, effect }` per type:
  `munitievoorraad`, `dubbeleBeloning`, `eliminatiemodus`, `kerninslag`.
- Effect-functies: `geefMunitievoorraad()` (vult magazijn + reserve van ALLE
  gekochte wapens naar hun definitie-max), `geefDubbeleBeloning()` (zet
  `dubbeleBeloningTimer = 20`), `geefEliminatiemodus()` (zet
  `eliminatiemodusTimer = 15`), `geefKerninslag()` (zie hieronder).
- Timers tellen af in `updatePowerups(dt)`, HUD-weergave in `updateHUD()`
  via `#powerupStatusUI`.
- Buffs grijpen in op `raakOndode()`:
  - Eliminatiemodus: `schade = eliminatiemodusTimer > 0 ? ondode.hp : ...`
    (elke treffer meteen dodelijk).
  - Dubbele Beloning: `geldFactor = dubbeleBeloningTimer > 0 ? 2 : 1` op
    zowel hit- als kill-geld.

### Kerninslag (huidige werking)
- `geefKerninslag()`: itereert over een kopie van `ondoden`, roept per stuk
  `doodOndode()` aan en telt `GELD_PER_KILL * geldMultiplier * (dubbele
  beloning-factor)` bij elkaar op. Branders ontploffen daarbij gewoon
  (`doodOndode` triggert `ontploiBrander`, kettingreacties mogelijk — de
  loop checkt daarom `if (!ondoden.includes(o)) continue`).
- Geen limiet op aantal kills, geen cooldown: bij een volle kaart (tot 26
  ondoden) is dit een gratis wave-wipe + flinke geldinjectie. **Dit is de
  reden voor de aparte, langere cooldown in Ticket 3.**

### Zombie-typedefinities
- `ONDODE_TYPES` (~r1845): per type
  `{ snelheidMultiplier, hpMultiplier, geldMultiplier, kleur, oogKleur, schaal, [explodeert] }`.
  Huidig: `normaal` (1/1/1), `loper` (1.8/0.5/0.6, schaal 0.9),
  `sjouwer` (0.55/4/2.2, schaal 1.35), `brander` (1/1/1.3, explodeert).
- Introductiegolven: `ONDODE_TYPE_MIN_GOLF = { loper: 2, sjouwer: 3, brander: 4 }`.
- Golfweging: `ondodeTypeGewichten()` → `{ normaal: 10, loper: 4, sjouwer: 3,
  brander: 3 }` (0 vóór de min-golf); `kiesOndodeType()` doet de gewogen
  loting. **Alleen** `golfSpawnStap()` gebruikt dit; directe
  `spawnOndode(idx)`-aanroepen (tests, debug-console) blijven bewust
  standaard `'normaal'`. Dit contract niet breken.

### Hoe Loper/Sjouwer aan snelheid/HP/beloning komen
- In `spawnOndode(vensterIndex, type = 'normaal')` (~r2034):
  - `hp: Math.max(1, Math.round(ondodeStartHP() * typeInfo.hpMultiplier))`
  - `snelheid: ONDODE_SNELHEID (1.5) * typeInfo.snelheidMultiplier`
  - `geldMultiplier: typeInfo.geldMultiplier` (gebruikt in `raakOndode` en
    `geefKerninslag`).
- Effectieve waarden nu: Loper 2.7 m/s / 1 HP; Sjouwer 0.825 m/s / 8 HP op
  golf 3+ (basis-HP is daar 2, want `ONDODE_HP_GOLFGRENS = 2`).
- Brander-explosie: `ontploiBrander()` — radius 3.0, 25 schade speler,
  3 schade per andere ondode in bereik.

### Waves: starten, spawnen, eindigen
- `spelStaat` (~r2450): `{ golf, geld, gameOver, golfActief, teSpawnen,
  spawnTimer, rustTimer }`.
- `startGolf()`: `teSpawnen = GOLF_BASIS_AANTAL (5) + (golf-1) *
  GOLF_AANTAL_GROEI (2)`; banner "GOLF X" met subtekst (aantal + hint +
  zones); `speelGolfStart()`.
- `updateGolf(dt)`: rust-timer → `startGolf()`; spawn-tick elke
  `effectiefSpawnInterval()` (basis 1.1s, −15% per extra ontgrendelde zone)
  zolang `ondoden.length < effectiefMaxActief()` (18 + 4 per extra zone,
  dus max 26); spawns lopen via `golfSpawnStap()`.
- `golfSpawnStap()`: kiest venster (`kiesVensterIndex()`, afstands-gewogen),
  beukt eerst een barricadeplank (`beukBarricade`, telt NIET als spawn) en
  spawnt pas bij 0 planken echt: `spawnOndode(idx, kiesOndodeType())`.
- Einde: `teSpawnen === 0 && ondoden.length === 0` → bonus/heal/banner
  (zie Wave-heal hierboven).
- **Aantal ondoden per golf is dus puur lineair** (5, 7, 9, 11, …) — golf 10
  = 23 stuks, golf 15 = 33. Dit is wat het threat-budget (Ticket 13) moet
  vervangen.

### Zombie-HP-schaling
- `ondodeStartHP()` (~r1835): golf ≤ `ONDODE_HP_GOLFGRENS (2)` → 1 HP,
  daarna hard 2 HP. Eén sprong, daarna vlak — verdere moeilijkheid komt nu
  alleen uit aantallen/varianten. Ticket 14 vervangt dit door trapsgewijze
  schaling.

### Wapenschade
- Globale staat: `schadePerTreffer` (start 1), `WAPEN_SCHADE_MAX = 2`,
  `HEADSHOT_EXTRA = 1` (~r1896).
- Berekening: uitsluitend in `raakOndode(ondode, punt, kop)`:
  `schade = schadePerTreffer + (kop ? HEADSHOT_EXTRA : 0)` (of `ondode.hp`
  tijdens Eliminatiemodus). Er is GEEN per-wapen schadecomponent — dat is
  precies wat Pack-a-Punch (Tickets 11/12) toevoegt.
- Raycast/headshot-detectie: in `schiet()` via
  `userData.lichaamsdeel === 'kop'` op hoofd- en oog-meshes.
- Schade-upgrade: `koopUpgrade()` (€500, `UPGRADE_PRIJS`), verhoogt
  `schadePerTreffer` tot `WAPEN_SCHADE_MAX`, daarna "MAX" in HUD en
  gedoofde markering (`doofMarkering`).

### Wapens, magazijnen, reserve, reload, HUD
- Definities: `WAPEN_DRUKSPUIT` `{ magazijnMax: 8, reserve: 48,
  schotCooldown: 0.2, herlaadDuurNormaal: 1.2, herlaadDuurSnel: 0.7 }` en
  `WAPEN_RATELAAR` `{ 16, 96, 0.1, 1.5, 0.9 }` (~r1634), elk met eigen
  mesh/vlam-referenties.
- Per-wapen runtime-staat: `nieuweWapenStaat(definitie)` →
  `{ definitie, magazijn, magazijnMax, reserve, herladen, herlaadTimer,
  herlaadDuur }`. `wapenStaten = { drukspuit, ratelaar }` — de ratelaar-staat
  ontstaat pas bij `koopRatelaar()` (€750).
- `wapenStaat` is de actieve referentie; `wisselWapen()` (toets Q) herbindt
  'm en togglet mesh-visibility. **Per-wapen-staat overleeft wisselen al** —
  dit is precies de plek waar per-wapen Pack-a-Punch-status bij kan
  (`wapenStaat.pap`).
- Reload: `herladen()` + timer in `updateWapen(dt)`; Snelheidselixer
  (`koopSnelspanner`, €600) verlaagt `herlaadDuur` van beide wapens.
- HUD: `updateHUD()` (HP-balk, geld, golf, schade/herladen/wapen-regel,
  power-up-buffregel `#powerupStatusUI`); ammo apart via `updateAmmoUI()`.

### Fog, banners, HUD, meldingen
- Fog: `scene.fog = new THREE.Fog(0x060a0e, 6, 24);` — één regel, ~r339,
  direct bij scene-setup. Geen andere plek muteert 'm. Voor de Mistgolf:
  originele waarden als constanten vastleggen en na afloop terugzetten.
- Restart = `location.reload()` (knop `#opnieuwKnop`, ~r1402) — een restart
  reset de fog dus sowieso; alleen `gameOver()` (~r2425) heeft een expliciete
  fog-restore nodig zodat het death-scherm niet in de mist hangt.
- Wave-banner: `toonGolfBanner(titel, sub)` → `#golfBanner`, fade na 2,2s.
- Meldingen: `toonMelding(tekst)` → `#meldingUI`, fade na 1,8s.
- Audio: `piep(type, startHz, eindHz, duur, volume)` + `speel*`-functies —
  nieuwe geluiden (mist-start, PaP-koop) volgen dit patroon, geen bestanden.

### Debug-/testinfrastructuur
- Debug-hook: `window.AmsterdamUndeadDebug` (~r3090+) — één groot object met
  live-referenties, functies, constanten en getters/setters. **Projectregel
  (CLAUDE.md): elk nieuw systeem exporteert hier zijn testbare delen, elk
  verwijderd systeem wordt hier ook opgeruimd.**
- Headless tests: Playwright-scripts (patroon: lokale Chromium op
  `/opt/pw-browsers/chromium`, CDN-intercept die `three.module.js` lokaal
  serveert, pointer lock via `Object.defineProperty`). **Belangrijk: de
  bestaande testscripts staan in een sessie-scratchpad en zijn NIET
  gecommit.** Een toekomstige sessie heeft ze niet. Aanbeveling: bij Ticket
  10 een `tests/`-map in de repo aanmaken en de belangrijkste checks daar
  als `.mjs`-scripts vastleggen (met een kleine README hoe ze te draaien).
- Bestaande test-asserties die bij deze tickets MOETEN meebewegen (anders
  vals alarm): heal-naar-75 (Ticket 1), `teSpawnen`-semantiek en
  "5 te spawnen op golf 1" (Ticket 13), obstakel-/cap-grenzen (Ticket 15),
  Sjouwer-geldbedrag `round(20*2.2)` (blijft gelijk, geldMultiplier
  verandert niet).

### Herbruikbare systemen voor de nieuwe features
| Nieuw | Hergebruik |
| --- | --- |
| Eventgolven | `startGolf`/`updateGolf`-structuur, `toonGolfBanner`, `spelStaat` |
| Mistgolf | `scene.fog` (één object), `toonMelding`, `piep`-audio |
| Sluiper | `ONDODE_TYPES`-map + `maakOndodeModel(typeInfo)` + `ondodeTypeGewichten()` — een nieuw type is puur data + één gate |
| Power-up-cooldowns | `kiesPowerupType()` is het enige keuzepunt; `spelStaat.golf` is de klok |
| Pack-a-Punch | `wapenStaten`-per-wapen-staat, `interactiePunten`-systeem (T-toets, zie `ratelaarPunt` als voorbeeld), `interactieMarkering()`, HUD-regel |
| Threat budget | `golfSpawnStap()` + `kiesOndodeType()` + `spelStaat.teSpawnen` (wordt budget) |

---

## 2. Expliciete ontwerpbeslissingen

1. **Wave-heal naar 60.** Op 75 is de speler na elke golf vrijwel op
   driekwart en voelt schade in de vorige golf zelden door. Op 60 blijft een
   slechte golf twee à drie golven voelbaar (regen is 5 HP/s met 4s
   vertraging — bijheelbaar, maar het kost actief veilige tijd), en wordt de
   Watertap (€200 → +50 HP) en Pantserdrank weer een echte afweging i.p.v.
   dood geld. 60 is bewust nog boven 4x melee-schade (15): één fout blijft
   vergeeflijk.

2. **Sterke power-ups op cooldown.** Dubbele Beloning, Eliminatiemodus en
   Kerninslag veranderen de golf fundamenteel; twee daarvan kort na elkaar
   maken de economie en de spanning stuk (met 12% dropkans en 20+ kills per
   golf valt er nu gemiddeld ±2,5 drop per golf, waarvan 75% sterk).
   Munitievoorraad is een utility die schaars ammo-beheer verlicht zonder de
   golf te trivialiseren — die mag vaak vallen. Cooldown wordt geteld in
   GOLVEN (niet in seconden): golven zijn de natuurlijke maat van dit spel
   en het is debugbaar met één integer.

3. **Kerninslag een eigen, langere cooldown (4 golven).** Kerninslag is
   categorisch sterker dan de andere twee: het is geen buff maar een
   onmiddellijke wave-wipe inclusief volledige geldbeloning. Zonder aparte
   cooldown domineert 'ie de sterke-pool (1 op 3 sterke drops). Op de
   generieke 2-golven-cooldown zou hij alsnog elke 2 golven kunnen vallen.
   - **Open ontwerpvraag (NIET implementeren):** Kerninslag later begrenzen
     tot max ~8 kills of ~70% van de levende ondoden (dichtstbijzijnde
     eerst sparen zodat er druk blijft)? Noteren, meten na Ticket 3, dan
     beslissen.
   - **Beslissing cooldown-registratie:** de "laatste sterke/Kerninslag-golf"
     wordt gezet op het moment van DROPPEN (spawn), niet bij oprapen.
     Simpeler, en voorkomt dat een bewust genegeerde drop de cooldown omzeilt.

4. **Loper naar 2,2 m/s (multiplier 1.8 → 1.47).** Speler loopt 4,5 m/s.
   Op 2,7 m/s haalt een Loper een achteruitlopende, schietende speler in
   smalle ruimtes te makkelijk in (achteruit + richten voelt als ~50%
   tempo); op 2,2 m/s blijft hij duidelijk sneller dan de rest (1,5) en
   dwingt hij prioriteit, maar verlies je alleen terrein als je écht fout
   staat. 2.2/1.5 = 1.4667 → afronden op **1.47** (effectief 2,205 m/s).

5. **Sjouwer naar 5 HP (multiplier 4 → 2.5).** Op 8 HP kost één Sjouwer
   met een basiswapen (schade 1–2) vier à acht schoten — dat is geen
   spanning maar wachttijd, zeker met zijn 0,55 m/s. Op 5 HP: met
   geüpgradede schade (2/3 headshot) is hij in 2 headshots of 3 bodyshots
   weg — voelbaar tanky, geen bullet sponge. Golf-3-basis is 2 HP, dus
   `round(2 * 2.5) = 5` exact. Let op interactie met Ticket 14 (zie punt 11).

6. **Eventgolven: variatie i.p.v. volume.** Elke 5e golf krijgt een eigen
   identiteit door de REGELS te veranderen (zicht, samenstelling, tempo) in
   plaats van door meer ondoden. Dit geeft een memorabel ritme ("golf 15
   komt eraan…"), kost geen performance, en is uitbreidbaar als data
   (event-type → fog/spawngewichten/modifiers) zonder het reguliere
   golfsysteem te raken. De Mistgolf is het proefmodel: één visueel effect
   (fog dichter), één exclusief vijandtype (Sluiper), banner + eindmelding.

7. **Pack-a-Punch als late-game geldsink.** Na Snelheidselixer (600),
   schade-MAX (500), Pantserdrank (1000), Ratelaar (750) en beide deuren
   (1500) is alles koopbaar rond golf 7–9 en stapelt geld doelloos op —
   wave-bonussen en Dubbele Beloning maken dat erger. €3000 per wapen (dus
   €6000 totaal) geeft de economie weer een horizon voor golf 10–15+,
   zonder de vroege curve te raken.

8. **Pack-a-Punch per wapen, niet globaal.** (a) Twee losse aankopen à
   €3000 = een langere sink dan één globale. (b) Per wapen kun je karakter
   tunen: de Drukspuit (traag, 8 schoten) verdraagt +1 schade; de Ratelaar
   (0,1s cooldown, 16 schoten) zou met +1 een DPS-monster worden — die
   krijgt +0,5 en een groter magazijn. (c) Het bewaart de wapenidentiteit:
   geüpgraded blijft de Drukspuit de precisie-keuze en de Ratelaar de
   volume-keuze. Fractionele schade (0,5) is veilig: HP-checks zijn
   `hp <= 0`-vergelijkingen, geen integer-aannames.

9. **Threat budget i.p.v. lineair meer zombies.** Het huidige systeem kan
   alleen "meer" (golf 15 = 33 stuks) — dat loopt tegen het perf-plafond,
   maakt elke golf hetzelfde soort drukte en devalueert de varianten (alles
   verzuipt in aantallen). Een budget waarbij zware types meer "kosten"
   laat de moeilijkheid stijgen via SAMENSTELLING: golf 12 kan 9 ondoden
   zijn waarvan 2 Sjouwers en 2 Branders — minder stuks, meer dreiging.
   Bijkomend: de spawn-cap kan omlaag (Ticket 15) zonder dat de
   moeilijkheidscurve afvlakt.

10. **Bullet-sponge-preventie.** Drie borgen: (a) normale HP capt op 4
    (Ticket 14) — nooit hoger, druk komt daarna uit budget/samenstelling;
    (b) Pack-a-Punch-schade groeit mee (PaP-Drukspuit doet 3/4 per schot,
    dus zelfs 4-HP-ondoden blijven 1–2 schoten); (c) speciale types krijgen
    caps/afvlakking op hun multipliers i.p.v. mee-explosie met de basis-HP.

11. **Sjouwer × HP-schaling.** Na Ticket 14 zou multiplier 2.5 op basis 3–4
    HP → 8–10 HP geven: precies de sponge die we niet willen. Beslissing:
    Sjouwer-HP wordt `min(round(basis * 2.5), 8)` — hard plafond op 8.
    (Alternatief, additief `basis + 3`, mag Sonnet voorstellen als de cap
    raar aanvoelt in tests.)

12. **Pack-a-Punch mag niet verplicht worden.** De HP-cap van 4 (punt 10a)
    is de garantie: een niet-geüpgradede speler met schade-MAX (2/3) blijft
    elke ondode in max 2 headshots doden. PaP versnelt en verrijkt, maar de
    kill-TTK zonder PaP blijft eindig en constant vanaf golf 16. Balanstest
    in Ticket 12: golf 12–15 uitspelbaar zonder PaP.

13. **Debug-hook-conventie (afwijking van de opdrachttekst).** De opdracht
    noemt `window.__AMSTERDAM_UNDEAD_TEST__`; het project heeft al jaren de
    conventie `window.AmsterdamUndeadDebug` (CLAUDE.md, alle bestaande
    tests). We introduceren GEEN tweede global — Ticket 10 breidt de
    bestaande hook uit. Twee parallelle test-globals is een klassieke bron
    van half-bijgewerkte exports.

---

## 3. Risicogebieden (voor de uitvoerder)

- **`updateGolf()` wave-complete-branch**: heal, bonus, banner, event-afloop
  (fog-restore) en straks budget-reset komen hier allemaal samen. Wijzig 'm
  per ticket minimaal en draai daarna altijd de golf-tests.
- **`raakOndode()`**: schadeberekening, geldberekening, drops én
  buff-overrides zitten in één functie van ±20 regels. Tickets 2, 3, 11
  raken 'm alle drie — één ticket per keer, niet combineren.
- **`spelStaat.teSpawnen`**: HUD-banner, tests en `updateGolf` lezen dit.
  Ticket 13 verandert de semantiek — dit is het riskantste ticket van de
  reeks; zie het gefaseerde plan daar.
- **Debug-export**: elk ticket dat state toevoegt MOET de export bijwerken,
  anders zijn de acceptatietests niet schrijfbaar.
- **`defend-national-monument.html` en `index.html`**: NIET aanraken.
- **Fog**: er is precies één `scene.fog`-object; Mistgolf mag het muteren
  maar moet gegarandeerd herstellen op golf-einde ÉN in `gameOver()`
  (restart is een page-reload en herstelt zichzelf).
