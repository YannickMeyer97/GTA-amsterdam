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
   globale schade-upgrade (500), Pantserdrank (1000), Ratelaar (750) en
   beide deuren (1500) is alles koopbaar rond golf 7-9 en stapelt geld
   doelloos op. Wave-bonussen en Dubbele Beloning maken dat erger. €3000 per
   wapen (dus €6000 totaal) geeft de economie weer een horizon voor golf
   10-15+, terwijl de vroege curve beheersbaar blijft. De globale
   schade-upgrade blijft bestaan als early-game pad, maar wordt kleiner:
   `schadePerTreffer` gaat van `1` naar maximaal `1.5` i.p.v. `2`, zodat de
   grootste damage-stap naar De Smederij verschuift.

8. **Pack-a-Punch per wapen, niet globaal.** (a) Twee losse aankopen à
   €3000 = een langere sink dan één globale. (b) Per wapen kun je karakter
   tunen: de Drukspuit (traag, 8 schoten) mag na smeden harder pieken en
   krijgt +1.5 schade plus magazijn 8->12; de Ratelaar (0,1s cooldown, 16
   schoten) krijgt minder schade per kogel maar meer volume, dus +1 schade
   plus magazijn 16->24. (c) Het bewaart de wapenidentiteit: geüpgraded
   blijft de Drukspuit de precisie-keuze en de Ratelaar de volume-keuze.
   Fractionele schade is veilig: HP-checks zijn `hp <= 0`-vergelijkingen,
   geen integer-aannames. Maximale bodyshot-schade wordt Drukspuit `3`
   (`1.5` globale schade + `1.5` Smederij) en Ratelaar `2.5` (`1.5` globale
   schade + `1` Smederij). Headshots blijven daarbovenop `+HEADSHOT_EXTRA`.
  

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

*(Beslissingen 14–20 horen bij de Fable-architectuurronde 2, zie §4 en
ROADMAP.md sectie v0.15+.)*

14. **Eén power-up-drop per golf (vervangt het cooldown-trio).** De drie
    cooldowns uit v0.14 (sterk 2 golven, Kerninslag 4, Munitievoorraad 2 uit
    de feedbackronde) losten stapeling per soort op, maar een golf kan nog
    steeds meerdere drops krijgen (utility + sterk door elkaar). Nieuwe
    regel: **maximaal één power-up-drop per golf, ongeacht het type** —
    `Munitievoorraad`, `Dubbele Beloning` en `Eliminatiemodus` concurreren
    om dat ene slot (elk dus impliciet ook max 1× per golf), en
    **Kerninslag houdt daarbovenop zijn eigen 1-per-4-golven-ritme**
    (`KERNINSLAG_COOLDOWN_GOLVEN = 4` blijft). Valt de Kerninslag, dan is
    dat meteen ook dé drop van die golf. Registratie blijft op
    **DROP-moment** (zelfde argument als beslissing 3: een genegeerde drop
    mag de limiet niet omzeilen). `POWERUP_DROP_KANS` (0.12 per kill) blijft
    een losse knop: de kans bepaalt OF er iets valt, de limiet bepaalt WAT
    er nog mag vallen — tuning blijft zo onafhankelijk. De states
    `laatsteSterkePowerupGolf`/`laatsteMunitievoorraadGolf` en hun
    constanten vervallen (dood datamodel is ruis); de bestaande
    `if (!type) return;`-guard in `spawnPowerupDrop()` vangt het
    alles-op-slot-geval al af.

15. **Smederij-visuals: vooraf gebouwd, onzichtbaar tot gesmeed.** De
    visuele extra's van een gesmeed wapen (gloeiringen, draaiend tandwiel,
    ember-licht) worden bij startup als één `Group` per wapen aan de
    bestaande wapen-groep gehangen met `visible = false`; `koopSmederij()`
    zet alleen de vlag om. Zo volgt zichtbaarheid bij wapenwissel gratis de
    bestaande group-toggle in `wisselWapen()`, is de HUD-ster per definitie
    consistent met de visuals (beide lezen `wapenStaat.gesmeed`), en is de
    feature test- en rollbackvriendelijk (één `visible`-boolean). Puur
    cosmetisch: geen gameplay-effect bovenop de bestaande T11/T12-bonussen.

16. **Modulair ondode-model met een vast hitbox-contract.** Het huidige
    model is één `Group` met 8 losse meshes zonder pivots — animatie kan
    daardoor alleen het hele lichaam laten wiebelen. De herwerking hangt
    delen aan scharnier-groepen (been-pivots op heuphoogte, arm-pivots aan
    de schouder, romp-groep, hoofd-groep) en bewaart referenties op
    `ondode.delen`. Het hitbox-contract is heilig en verandert NIET:
    `userData.lichaamsdeel === 'kop'` staat uitsluitend op de hoofd-mesh en
    de twee ogen; elk ander deel is lichaam. Variatieprofielen mogen
    ledematen weglaten of vervormen, maar nooit het hoofd verkleinen onder
    de huidige spheremaat (0.18 × schaal) — headshots moeten haalbaar
    blijven op elke variant.

17. **Doodsanimaties buiten de gameplay-arrays.** Een stervende ondode
    verhuist bij `doodOndode()` meteen uit `ondoden` én uit `ondodenGroep`
    naar een aparte `stervenden`-lijst + eigen scene-`Group`. Redenen:
    (a) golf-einde telt `ondoden.length === 0` — lijken mogen een golf
    niet rekken; (b) `schiet()` raycast op `ondodenGroep` (recursief) —
    een lijk mag geen kogels vangen; (c) melee/collision-loops itereren
    `ondoden` — een lijk mag niet slaan of duwen. De val-animatie is puur
    visueel (rotatie-lerp + zakken, ±0,7 s) en de Brander behoudt zijn
    directe explosie zonder lijk.

18. **Zone E telt mee als spawn-zone, maar het pacing-plafond blijft op
    drie zones gecapt.** De lus (v0.15) voegt een vierde ontgrendelbare
    zone toe. `effectiefSpawnInterval()`/`effectiefMaxActief()` gaan rekenen
    met `min(aantalOntgrendeldeZones(), 3)`: het plafond blijft 14/16/18 en
    het interval daalt niet verder. De lus voegt ROUTE en dekking toe, geen
    extra volume — moeilijkheid komt sinds Ticket 13 uit het threat-budget,
    niet uit dichtheid. De terugdeur (deur 4) ontgrendelt bewust géén eigen
    zone: die opent alleen een verbinding.

19. **Zone-navigatie wordt een graaf met next-hop-tabel.** De lineaire
    spine (`zoneVan` + `ZONE_DEURPUNTEN`, v0.12) kan geen lus aan: "lagere
    zone → volgend deurpunt" veronderstelt een rij. Vervanging: een klein
    zone-graafje (5 knopen, 5 kanten, elke kant = deurpunt + open-conditie)
    waaruit bij elke deuraankoop een next-hop-tabel wordt herbouwd (BFS —
    goedkoop, gebeurt alleen op koopmomenten). `updateOndoden()` leest
    alleen nog `NAV_VOLGENDE[eigenZone][spelerZone]`. Zolang deur 3/4 dicht
    zijn is de graaf een lijn en is het gedrag per constructie identiek aan
    vandaag — dat is het regressie-anker van het pathing-ticket.

20. **Lus-balans: beide richtingen moeten risico houden.** Een gesloten
    lus nodigt uit tot eindeloos rondjes kiten. Borgen in het ontwerp:
    (a) spawn-dekking aan beide uiteinden (A-vensters zuid, E-venster oost,
    D drie spawns) zodat "vooruit lopen" altijd ergens tegenaan loopt;
    (b) de kelderhals is smal (2 m) — één Sjouwer is daar een plug;
    (c) de kratten-stapel op de binnenplaats staat vlak bij de
    deur 3-uitgang en breekt de vluchtlijn; (d) de next-hop-navigatie
    stuurt achtervolgers via de kortste kant — een groep splitst zich
    effectief en knijpt de speler in. Events die tijdelijk een route
    blokkeren zijn backlog, geen onderdeel van deze ronde.

21. **Aanvallen krijgen een expliciete state machine met wind-up
    (ronde 3).** De huidige melee is contactschade: op de eerste frame
    binnen `MELEE_BEREIK` (1.2 m) valt er 15 schade, zonder enige
    waarschuwing (`ondode.meleeTimer` wordt buiten bereik zelfs elke frame
    op 0 gezet — "meteen slaan bij aankomst"). Dat is per definitie niet
    ontwijkbaar. Vervanging: per ondode een `aanvalStaat`
    ('jaag' → 'windup' → slag-MOMENT → 'herstel' → 'jaag') met dt-timers.
    De raakcheck gebeurt discreet, op de overgang windup→herstel, en test
    drie dingen: afstand ≤ raakBereik, hoek tussen kijkrichting en
    speler-richting ≤ raakHoek, én het middelpunt tussen ondode en speler
    is vrij (`isVrijePlek` — nooit door een muur of dichte deur heen
    slaan). Tijdens de wind-up staat de ondode STIL en draait hij maar
    beperkt mee (`AANVAL_DRAAI_SNELHEID`) — zijwaarts uitstappen of
    achteruit sprinten werkt dus echt. Discreet checken (niet "gedurende
    het actieve venster") is frame-delta-robuust: één overgang per frame,
    schade kan nooit dubbel of overgeslagen worden, en de bestaande
    dt-clamp (0.05 s in `gameLoop`) begrenst de rest. DPS-pariteit:
    oud = 15 HP per 1.0 s contact; nieuw (normaal) = 15 HP per
    0.55 + 0.7 = 1.25 s als de speler NIET reageert — bewust iets zachter,
    want de dreiging komt nu uit posities in plaats van aanraking.

22. **Aanvalsprofielen per type, één gedeelde machine.** Geen per-type
    code-forks in `updateOndoden()`: één `AANVAL_PROFIELEN`-tabel (zelfde
    patroon als `ONDODE_TYPES`) levert per type windup-duur, herstel-duur,
    raakbereik/-hoek, schade en onderbreekbaarheid. De Sjouwer wordt de
    trage dreun (lange wind-up 0.85 s, 25 schade, breed bereik), de
    Loper/Sluiper snelle prikken (0.4/0.35 s, minder schade, wél door een
    lichaamstreffer te onderbreken — het zijn de breekbare types), Brander
    = normaal (zijn echte dreiging is de explosie). Zo blijft het
    verschil tussen types ook in het GEDRAG leesbaar, niet alleen in het
    silhouet.

23. **Anti-omsingeling: maximaal 2 gelijktijdige aanvallers.** Een
    module-teller `actieveAanvallers` (verhoogd bij windup-start, verlaagd
    bij herstel-einde/dood/onderbreking) laat maar `MAX_AANVALLERS = 2`
    ondoden tegelijk een wind-up beginnen; de rest blijft gewoon jagen
    en drukt op. Plus een kleine willekeurige startvertraging (0–0.35 s)
    per aanvalspoging zodat twee tells nooit exact synchroon vallen.
    Bewust géén onkwetsbaarheids-frames op de speler: 2 × 15 gestapelde
    schade is eerlijk zolang beide tells zichtbaar waren, en i-frames
    zouden de Brander-explosie-balans stilletjes raken.

24. **Onderbrekingsregels: headshot altijd, lichaamstreffer per type.**
    Een headshot tijdens een wind-up breekt de aanval ALTIJD af (de
    bestaande flinch uit T21 is de zichtbare reactie; de staat gaat naar
    'herstel' met halve herstelduur). Een lichaamstreffer onderbreekt
    alleen types met `onderbreekbaarLichaam: true` (Loper, Sluiper) —
    anders zou de Ratelaar (0.1 s cooldown) elke Sjouwer-aanval permanent
    stunlocken en wordt de wind-up nooit gezien. Het slag-moment zelf is
    één frame en kent geen onderbreking; tijdens 'herstel' start geen
    nieuwe wind-up. Dit maakt de headshot ook defensief waardevol
    (aanval afbreken) i.p.v. alleen economisch.

25. **Combat-effecten: gepoold, dt-geklokt, nooit `setTimeout`.** De
    huidige `vonk`/`bloedvonk` maken per schot/treffer een nieuwe
    geometry + material aan en ruimen op via `setTimeout` (wall-clock:
    loopt door tijdens pauze, en alloceert in het heetste pad van het
    spel). Ronde 3 vervangt dat door één effectenpool: vooraf gebouwde
    meshes (tracers, impact-deeltjes) die via `visible`-toggles rouleren,
    geüpdatet met dt in de `spelActief`-tak (bevriest netjes tijdens
    pauze), met harde plafonds (8 tracers, 24 impact-deeltjes) en
    oudste-eerst-recycling. Restart is een page-reload (bestaand patroon)
    — dat blijft de ultieme cleanup. De Brander-explosieflits (zeldzaam,
    220 ms, 1 licht) mag als gedocumenteerde uitzondering op het oude
    patroon blijven.

26. **Hitmarker als HUD-DOM met drie tiers.** Treffer-feedback hoort op
    het vaste aandachtspunt van de speler: het crosshair. Eén herbruikbaar
    DOM-element (vier streepjes rond het crosshair) met drie
    CSS-varianten: lichaamstreffer (wit, klein, 120 ms), headshot (amber,
    groter), kill (oranjerood, grootst, langst zichtbaar). DOM i.p.v.
    scene-meshes: past bij de bestaande HUD-conventie, kost geen
    draw-calls, en de lifecycle is een enkele timer. Audio krijgt dezelfde
    drie tiers via `piep()` met ±5% pitch-variatie per afspeling zodat de
    Ratelaar geen machinegeweer-monotonie wordt.

27. **Camera-kick is visueel-only; spread hoort bij één wapen.** Recoil
    gaat naar een aparte `cameraKick`-offset die bij het composeren van de
    camera bij `speler.pitch` wordt opgeteld en exponentieel naar 0
    terugvalt — `speler.pitch` zelf blijft onaangeroerd (geen blijvende
    aim-drift; dit is een arcade-shooter, geen recoil-management-game).
    Wapenidentiteit: de Drukspuit is de precisiekeuze (grote enkele kick,
    géén spread), de Ratelaar de volumekeuze (kleine kick per schot, vaste
    lichte spread van ±0.8°). De nieuwe per-wapen feedbackvelden komen in
    de bestaande `WAPEN_DRUKSPUIT`/`WAPEN_RATELAAR`-definities — geen
    nieuwe registry.

28. **De Smederij verhuist naar de bijkeuken-zuidwand (6.8, 3.5).**
    Waarom: (a) de lus (v0.15 fase 9) gaf zone E een route maar geen
    blijvende bestemming — met de Smederij (dé late-game geldsink,
    beslissing 7) náást de Provisiekast wordt de bijkeuken het late-game
    anker, met de terugdeur als vluchtroute; (b) de binnenplaats had drie
    winkels (Watertap, Ratelaar, Smederij) en wordt zo evenwichtiger; (c)
    de machine, markering, het kooppunt én het koollicht zijn allemaal op
    `SMEDERIJ_X/SMEDERIJ_Z` gebouwd, dus de verhuizing is een
    constanten-wijziging — er kan geen tweede Smederij ontstaan en er
    blijft niets actiefs achter. Positie (6.8, 3.5): 2.3 m van de gedeelde
    west-muur met de woonkamer (zelfde marge als de deur4Punt-bugfix —
    interactieradius 1.6 kan nooit door de muur heen reiken), 3.5 m van
    het deur4-kooppunt (radii overlappen niet), ±5.4 m van het
    E-spawnvenster (geen spawn-camping op een winkelende speler), en
    ruim buiten de looproute terugdeur ↔ kelderhals.

29. **Winkel-taal: functie bepaalt de vorm, kleur is nooit het enige
    kanaal.** Elke winkel krijgt een eigen icoon-silhouet boven de
    bestaande vloerring (vervangt de generieke kubus), maar winkels met
    DEZELFDE functie delen bewust hetzelfde silhouet: de ammo-kist en de
    Provisiekast zijn allebei "munitie" en horen er hetzelfde uit te zien
    — twee verschillende vormen voor identiek gedrag zou de visuele taal
    juist breken. Uniciteit geldt per functiecategorie: munitie (kogel),
    schade-upgrade (pijl omhoog), Snelheidselixer (slanke fles),
    Pantserdrank (schildvorm), Watertap (druppel), Ratelaar-wandrek
    (tandwiel), Smederij (hamer), deuren (sleutel). Status wordt
    ANIMATIE, niet alleen kleur: beschikbaar = pulserende ring + draaiend
    icoon; te duur = zelfde kleur maar stilstaand; gekocht/MAX = gedoofd
    grijs (bestaand `doofMarkering`-patroon); tijdelijk n.v.t. (Watertap
    bij volle HP) = ontkleurd maar niet gedoofd. Kleurenblinde spelers
    lezen vorm + beweging; kleur is de derde laag.

30. **Eén gedeeld winkellicht i.p.v. een licht per winkel.** Twaalf
    winkels een eigen PointLight geven zou het lichtbudget (nu ±17
    permanente lichten, waarvan precies 1 met schaduw) bijna verdubbelen.
    In plaats daarvan: één `winkelLicht` (PointLight zonder schaduw) dat
    zich hecht aan de dichtstbijzijnde niet-gedoofde winkel binnen 6 m van
    de speler, met kleur-lerp naar de winkelkleur en zachte puls. Op
    afstand dragen de emissive ringen/iconen de herkenbaarheid (emissive
    werkt ook in de Mistgolf); het licht is alleen nabij-feedback. De
    bestaande kool-/ember-/vlamlichten blijven ongemoeid.

31. **Materiaalgevoel zonder textures.** CLAUDE.md verbiedt textures —
    ook canvas-gegenereerde blijven uit den boze (de regel is er niet
    voor de bestandsgrootte maar voor de stijl: simpele geometrie).
    Materiaalgevoel komt dus uit (a) een kleine `matFamilie`-cache
    (hout/steen/tegel/metaal/natSteen) met per familie afgestemde
    roughness/metalness, gedeeld i.p.v. per aanroep een nieuw material;
    (b) micro-geometrie die er al is (voegen, plinten, kozijnen); (c)
    `userData.materiaalFamilie` op de grote oppervlakken zodat
    wereld-impacts (beslissing 25) per ondergrond een eigen
    deeltjeskleur krijgen. Gecachete familie-materialen zijn immutabel:
    wie een variant nodig heeft, vraagt een nieuwe cache-key op —
    muteren zou alle gebruikers tegelijk herschilderen. Renderer staat al
    op `SRGBColorSpace` + `ACESFilmicToneMapping` (regel 360-362); dat
    blijft zo.

32. **Vijandleesbaarheid: silhouet eerst, kleur laatst.** Elke variant
    moet herkenbaar zijn via minstens drie kanalen die óók in de mist
    en in donkere hoeken werken: (1) silhouet en houding (bestaat sinds
    T19, wordt aangescherpt met per-type gang-ritmes: pas-frequentie,
    romp-bob en amplitude als data op `ONDODE_TYPES`); (2) geluid (per
    type een eigen grom-register op een random timer — en de Sluiper
    gromt NOOIT: stilte is zíjn tell); (3) oog-emissive (per type al
    een eigen kleur; tijdens de Mistgolf gaat de intensiteit
    event-gedreven omhoog zodat ogen het mist-kanaal worden); (4) als
    laatste pas de lijfkleur. Aanvalsgedrag (beslissing 22) is het
    vijfde kanaal: de trage dreun van de Sjouwer versus de snelle prik
    van de Loper leest ook zonder één pixel kleurverschil. Harde grens:
    het hoofd-hoogte-anker (±0.03) en het hitbox-contract (beslissing
    16) blijven onaantastbaar — ritme en rotatie zijn de veilige
    knoppen, posities en schalen niet.

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

---

## 4. Fable-architectuurronde 2 (v0.15+) — power-ups, Smederij-visuals, zombie-herwerking en map-lus

Geschreven ná de uitvoering van v0.14 (fases 1–5 zijn geïmplementeerd).
Waar §1 hierboven nog de pre-v0.14-toestand beschrijft, geldt: zoek op
symboolnaam en vertrouw de code. De belangrijkste verschuivingen sinds §1:
`spelStaat.teSpawnen` heet nu `spelStaat.budget` (threat-budget, T13),
`ondodeStartHP()` is een trap 1/2/3/4 via `ONDODE_HP_TRAPPEN` (T14),
`GOLF_MAX_ACTIEF = 14` + `ZONE_MAX_ACTIEF_BONUS = 2` (T15),
`kiesPowerupType()` heeft drie cooldowns (T2/T3 + feedbackronde), en De
Smederij bestaat (T11/T12: `smederijConfig`, `wapenStaat.gesmeed`,
`koopSmederij`, `SMEDERIJ_PRIJS/X/Z`, HUD-ster).

### 4.1 Codekaart — power-ups (huidige staat)

- `kiesPowerupType()` bouwt een toegestane-lijst met drie onafhankelijke
  gates: `laatsteSterkePowerupGolf + STERKE_POWERUP_COOLDOWN_GOLVEN (2)`
  voor de drie `sterk: true`-types, daarbovenop
  `laatsteKerninslagGolf + KERNINSLAG_COOLDOWN_GOLVEN (4)` voor kerninslag,
  en `laatsteMunitievoorraadGolf + MUNITIEVOORRAAD_COOLDOWN_GOLVEN (2)`
  voor munitievoorraad. Lege lijst → `undefined`.
- `spawnPowerupDrop(x, z, type)` begint met `if (!type) return;` en
  registreert de cooldowns op DROP-moment. **Ticket 16 hergebruikt beide
  mechanieken** en vervangt de drie gates door één drop-slot per golf
  (ontwerpbeslissing 14).
- Droppunt ongewijzigd: kill-branch van `raakOndode()`, kans
  `POWERUP_DROP_KANS = 0.12`.

### 4.2 Codekaart — wapens en Smederij-visuals (huidige staat)

- Wapen-meshes zijn kinderen van `camera` via `wapenDrukspuit` /
  `wapenRatelaar` (Groups); `wisselWapen()` togglet `groep.visible` —
  alles wat aan die groepen hangt, wisselt dus gratis mee.
- Bestaande gesmeed-accenten (T12): `meterDrukspuit` en `tandwielRatelaar`
  krijgen bij `koopSmederij()` de kleur `SMEDERIJ_ACCENT_KLEUR (0xff7a1f)`;
  `schiet()` vermenigvuldigt `vlamLichtBasis` met
  `SMEDERIJ_VLAM_BOOST (1.5)` als `wapenStaat.gesmeed`. Meer visueel
  verschil is er nog niet — dat is Ticket 17.
- De mondingsflits per wapen (`vlamDrukspuit`/`vlamRatelaar`) heeft een
  eigen `MeshBasicMaterial` — een kleurshift per wapen is dus veilig
  (geen gedeeld materiaal).
- Haakje voor animatie: de gameLoop heeft al een `vlamTimer`-blok en een
  terugslag-blok die per frame aan het actieve wapen zitten; een
  `updateSmederijVisuals(dt)`-aanroep past daar naast.

### 4.3 Codekaart — ondode-model, animatie en dood (huidige staat)

- `maakOndodeModel(typeInfo, traits)`: één `Group` met **8 meshes zonder
  pivots** — `benen` (één blok!), `torso`, `hoofd` (sphere,
  `userData.lichaamsdeel = 'kop'`), 2 armen, `vod`, 2 ogen (ook `'kop'`).
  Traits (`kiesOndodeTraits()`: kromme/slepend/armVerschil/lengte/
  strompelt) werken via statische rotaties/offsets bij het bouwen.
- Animatie zit in `updateOndoden(dt)` en is minimaal: `rotation.y` naar de
  kijkrichting + (alleen bij `strompelt`) een `rotation.z`-wiebel op de
  HELE groep via `loopFase`. Er beweegt geen ledemaat afzonderlijk.
- `updateOndoden(dt)` heeft twee helften: de **navigatie-helft**
  (zoneVan/deurpunten/ontwijk-bursts, zie 4.5) en de **animatie-helft**
  (kijkrichting + wiebel). Fase 8 (zombie-herwerking) herschrijft de
  animatie-helft; fase 9 (map-lus) de navigatie-helft — daarom staat in
  het uitvoeringsplan dat fase 8 vóór fase 9 afgerond moet zijn.
- `doodOndode(ondode)`: verwijdert de groep DIRECT uit `ondodenGroep` en
  het object uit `ondoden`; een Brander ontploft daarbij
  (`ontploiBrander`, met kettingreacties). Er is geen lijk, geen animatie.
- `schiet()` raycast: `raycaster.intersectObject(ondodenGroep, true)` —
  **alles** in die groep vangt kogels. Headshot = eerste hit met
  `userData.lichaamsdeel === 'kop'`. Twee contracten voor de herwerking:
  lijken moeten de groep verlaten (beslissing 17), en elk nieuw
  lichaamsdeel zonder `'kop'`-markering is automatisch lichaamstreffer.
- Treffer-feedback: `raakOndode()` spawnt een `bloedvonk` (mesh, 150 ms
  via `setTimeout`) — herbruikbaar patroon voor hitreactie-accenten.

### 4.4 Codekaart — map-layout (huidige staat, gecontroleerd op de code)

Oriëntatie: **+x = oost, −z = noord** ("noordmuur" ligt bij lagere z).
Alle waarden komen uit de constanten in `amsterdam-undead.html`:

| Ruimte | Zone | x-bereik | z-bereik | Sleutelconstanten |
| --- | --- | --- | --- | --- |
| Woonkamer | A (0) | −4.5 … 4.5 | −5 … 5 | `HALF_BREEDTE`, `HALF_DIEPTE`, `DEUR_Z = −5` |
| Gang | B (1) | −1 … 1 | −8 … −5 | `DEUR_HALF`, `GANG_LENGTE = 3`, `GANG_Z_EIND = −8` |
| Atelier | C (2) | −4.5 … 4.5 | −23 … −8 | `KAMER2_HALF_B`, `KAMER2_DIEPTE = 15`, `KAMER2_Z_NOORD = −23` |
| Voorraadnis (deel van C) | C | −11.5 … −4.5 | −23 … −17 | `KAMER2_NIS_X_WEST`, `KAMER2_NIS_Z_ZUID`, `KAMER2_NIS_CX/CZ` |
| Binnenplaats | D (3) | 4.5 … 20.5 | −24 … −7 | `DEUR2_X = 4.5`, `PLAATS_X_OOST = 20.5`, `PLAATS_Z_NOORD/ZUID = −24/−7`, `PLAATS_CX = 12.5`, `DEUR2_Z = −15.5` |

- Deur 1: noordmuur woonkamer, opening x ∈ [−1, 1] op z = −5
  (`deurPunt` op (0, −4.3)). Deur 2: oostmuur atelier, opening
  z ∈ [−16.5, −14.5] op x = 4.5 (`deur2Punt` aan de atelierkant).
- **Muursegmenten die voor de lus relevant zijn:**
  - Woonkamer-oostmuur: één doorlopende `bouwMuur` op x = 4.65,
    z ∈ [−5, 5] — moet voor de terugdeur worden gesplitst in twee
    segmenten + deurgat (zelfde patroon als de noordmuur van de
    woonkamer bij deur 1).
  - Binnenplaats-zuidmuur: één `bouwBinnenplaatsMuur` op z = −6.85
    (hoogte 2.25), x ∈ [4.2, 20.8] — moet voor deur 3 worden gesplitst.
  - De hoekafdichtingen zijn op botsingsradius-toleranties gebouwd
    (kieren < 0.7 m zijn onpasseerbaar door `ONDODE_STRAAL = 0.4` en de
    spelerradius); wie muren verplaatst moet met `isVrijePlek`-probes
    verifiëren, niet op het oog.
- **Vensters (spawns):** A: (−2, 4.6) en (2, 4.6) zuidmuur;
  C: noordraam (−3.2, −22.6), oostraam (4.1, −17.2), nisraam (−11.1, −20);
  D: poort NO (20.1, −23.6), kelderdeur ZO (20.1, −7.4), poort noordmuur
  (12.5, −23.6). Elk venster heeft een barricade (3 planken,
  `bouwBarricade`) en een `zone`-veld.
- **Interactiepunten:** A: deur (0, −4.3), ammo-kist (3, −2), upgrade
  (−3, −2); C: werkbank (−2.8, −17.5), Pantserdrank (2.5, −13), deur 2
  (3.8, −15.5); D: Watertap (14, −17.1), Ratelaar (19.9, −10.5),
  Smederij (7, −22.8).
- **Objecten met echte collision** (naast muren/deuren): schuurtje
  (15, −21.5) en kratten (8, −9.5) op de binnenplaats. Fietsenrek,
  lantaarns (7.5/17.5, −20.5/−10.5), waslijn (noordrand), plassen en
  gevels zijn decor zonder collision.
- **De vrije "pocket":** het gebied x ∈ [4.5, 20.5], z ∈ [−7, 5] ligt
  al BINNEN `GRENS` maar is volledig ommuurd en onbereikbaar — de
  natuurlijke plek voor de lus-uitbreiding, zonder `GRENS`-wijziging.
  Let op: in die pocket staat één nepgevel (`bouwAchterGevel` op
  (16, −5.95), breedte 4.6, hoogte 3.8, geen collision) die bewust boven
  de zuidmuur van de binnenplaats uitsteekt. Het lus-ontwerp hieronder
  laat die gevel in de restpocket staan (buiten de nieuwe kamers), zodat
  het aanzicht vanaf de binnenplaats ongewijzigd blijft.

### 4.5 Codekaart — zone-navigatie (huidige staat)

- `zoneVan(x, z)`: eerst `z > DEUR_Z` → 0 (woonkamer), dan `x >= DEUR2_X`
  → 3 (binnenplaats), dan `z > GANG_Z_EIND` → 1 (gang), anders 2
  (atelier). Volgorde is betekenisvol (gedocumenteerd in de code):
  `DEUR2_X` en `HALF_BREEDTE` zijn toevallig allebei 4.5.
- `ZONE_DEURPUNTEN[0..2]`: (0,−5), (0,−8), (4.5,−15.5) — een LIJN.
  `updateOndoden`: ondode in lagere zone dan de speler mikt op
  `ZONE_DEURPUNTEN[eigenZone]`, hogere op `[eigenZone − 1]`, zelfde zone
  → rechtstreeks. Dit model kan per constructie geen lus aan
  (ontwerpbeslissing 19 beschrijft de vervanging).
- De nis-opening is bewust géén zone-grens (breed genoeg voor de lokale
  ontwijk-logica) — de kelderhals hieronder is dat WEL (smal + twee
  haakse hoeken).

### 4.6 ASCII-plattegrond — huidige map

**(Historisch — deze plattegrond is vóór de map-lus/kelder/gracht-ronde.
Zie §7.11 voor de bijgewerkte plattegrond met alle 5 zones, de kelder en
de gracht-gang.)**

```
                        NOORD (−z)
   x=−11.5   x=−4.5           x=4.5              x=20.5
z=−24 ┌────────┬─────────────────┬──────────────────┐
      │  NIS   │                 │s        s        │  s = spawn-venster
z=−23 │ (C)   s│   ATELIER (C)   │                  │  D-spawns: poort NO,
      ├────────┘                s│  BINNENPLAATS    │  poort noord, kelder-
z=−17 │         werkbank  deur2 ═╡      (D)         │  deur ZO
      │         pantserdrank    ═╡ smederij watertap│
      │                          │ kratten ratelaar │
z=−8  └──────────┬─────┬─────────┤ schuurtje       s│
                 │GANG │  (dode  │                  │
                 │ (B) │  hoek)  │                  │
z=−5  ┌──────────┴═════┴─────────┼──────────────────┤
      │          deur1           │                  │
      │      WOONKAMER (A)       │   ── pocket ──   │
      │  upgrade      ammo       │  (ommuurd, leeg, │
      │                          │   binnen GRENS)  │
z=5   └──────s──────────s────────┴──────────────────┘
   x=−4.5                      x=4.5              x=20.5
                        ZUID (+z, gracht)
```

(Schematisch, niet op schaal; `═` = deuropening. De gang is 2 m breed op
x ∈ [−1, 1]; de dode hoek x ∈ [1, 4.5], z ∈ [−8, −5] is en blijft
onbereikbaar.)

### 4.7 Nieuwe-map-voorstel — de lus (zone E: bijkeuken + kelderhals)

Route: woonkamer → gang → atelier → binnenplaats → **kelderhals** →
**bijkeuken** → terugdeur → woonkamer. Alles past in de bestaande pocket;
`GRENS` verandert niet.

```
                        NOORD (−z)
   x=−11.5   x=−4.5           x=4.5              x=20.5
z=−24 ┌────────┬─────────────────┬──────────────────┐
      │  NIS   │                 │s        s        │
z=−23 │ (C)   s│   ATELIER (C)   │                  │
      ├────────┘                s│  BINNENPLAATS    │
z=−17 │         werkbank  deur2 ═╡      (D)         │
      │         pantserdrank    ═╡ smederij watertap│
      │                          │ kratten ratelaar │
z=−8  └──────────┬─────┬─────────┤ schuurtje       s│
                 │GANG │  (dode  │    deur3         │
                 │ (B) │  hoek)  ├───═══───┬────────┤
z=−5  ┌──────────┴═════┴─────────┤KELDER-  │ rest-  │
      │          deur1           │HALS (E) │ pocket │
z=−4.5│      WOONKAMER (A)      ═╡───┬─────┘(gevel) │
      │  upgrade      ammo  deur4╡   │              │
      │                         ═╡ BIJKEUKEN (E)    │
      │                          │  provisiekast   s│
z=5   └──────s──────────s────────┴──────────────────┘
   x=−4.5                      x=4.5   x=12       x=20.5
                        ZUID (+z, gracht)
```

- **Bijkeuken** (kamer, zone E): x ∈ [4.5, 12.0], z ∈ [−4.5, 4.5]
  (7,5 × 9 m). Sfeer: oude achterkeuken van het grachtenpand — koel
  tegelvloertje (eigen tint), keukenblok/fornuis-blokken, provisiekast-
  planken tegen de oostmuur, hangende potten (decor, geen collision).
  Gameplayfunctie: **de Provisiekast** — een tweede ammo-kist (€350,
  zelfde `AMMO_KIST_KOGELS`-patroon als de bestaande) zodat herbevoorraden
  niet altijd een terugtocht naar zone A is; plus één spawn-venster met
  barricade in de oostmuur ("de steegdeur", (11.6, 2), `spanX: false`).
- **Kelderhals** (smalle gang, zone E): x ∈ [9.0, 11.0], z ∈ [−7, −4.5]
  (2 × 2,5 m, twee haakse hoeken). Sfeer: kaal, laag peertje met de
  bestaande gang-flikker (V4-patroon), een dicht kelderluik als decor —
  sluit thematisch aan op de kelderdeur-spawn van de binnenplaats.
  Bewust smal: dit is de risico-knijper van de lus (beslissing 20).
- **Deur 3** (€1200): opening x ∈ [9, 11] in de binnenplaats-zuidmuur
  (die éne muur wordt twee segmenten), kooppunt aan de plaats-kant
  (patroon `deur2Punt`), banner "DE BIJKEUKEN". Kratten (8, −9.5) staan
  vlak bij de uitgang — bewust: dekking én vluchtlijn-breker.
- **Deur 4 / terugdeur** (€800): opening z ∈ [−1, 1] in de woonkamer-
  oostmuur (splitsen in twee segmenten), kooppunt aan de BIJKEUKEN-kant
  — je koopt de terugweg pas als je de lus al bijna rond bent. Ontgrendelt
  géén zone (beslissing 18), alleen de verbinding.
- **Voorgestelde nieuwe constanten** (zelfde stijl als `PLAATS_*`):
  `BIJKEUKEN_X_OOST = 12`, `BIJKEUKEN_Z_NOORD = −4.5`,
  `BIJKEUKEN_CX/CZ`, `KELDERHALS_X_WEST = 9`, `KELDERHALS_X_OOST = 11`,
  `DEUR3_X = 10` (in de zuidmuur op z = −7), `DEUR3_HALF = 1`,
  `DEUR4_Z = 0` (in de oostmuur op x = 4.5), `DEUR4_HALF = 1`,
  `PROVISIEKAST_PRIJS = 350`, `DEUR3_PRIJS = 1200`, `DEUR4_PRIJS = 800`,
  `VENSTERS_BIJKEUKEN` (1 entry, zone 'E').
- **Zone-detectie:** `zoneVan` krijgt de E-tak VÓÓR de woonkamer-check:
  `if (x >= DEUR2_X) return z > PLAATS_Z_ZUID ? 4 : 3;` — daarna de
  bestaande checks. (Bijkeuken ligt op z > −5; zonder deze volgorde zou
  hij als woonkamer tellen.)
- **Navigatie:** zie ontwerpbeslissing 19 — zone-graaf
  A–B–C–D–E–A met deurpunten (0,−5), (0,−8), (4.5,−15.5), (10,−7),
  (4.5,0) en open-condities (deur 1/2/3/4); next-hop-tabel herbouwen bij
  elke deuraankoop.
- **Spawning:** `VENSTERS_BIJKEUKEN` wordt bij `koopDeur3()` in
  `VENSTERS` geduwd (patroon `koopDeur2`); `kiesVensterIndex()` is
  afstands-gewogen en heeft geen wijziging nodig. Het E-venster zit in de
  oostmuur van de bijkeuken — niet in de kelderhals (te smal, unfair) en
  niet naast de terugdeur (spawn-camping op het kooppunt).

### 4.8 Balansanalyse — de rondlopende route

- **Vooruit (A→D)** blijft de koopprogressie; **achteruit (A→E→D)** is na
  de unlock een snelle route naar Smederij/Ratelaar/Watertap, maar voert
  langs het E-venster en door de smalle kelderhals.
- Kiten rond de lus wordt geremd door beslissing 20 (spawn-dekking,
  kelderhals-plug, kratten, next-hop-omsingeling). De lus-omtrek is grofweg
  55–60 m; met spelersnelheid 4,5 m/s en Loper 2,205 m/s haalt een enkele
  achtervolger de speler nooit in — de dreiging moet dus uit tegemoet-
  komende spawns en de omsingelende navigatie komen, en die zijn er.
- Economie: deur 3 + deur 4 (€2000 samen) passen tussen deur 2 (€1000) en
  de Smederij (2 × €3000) — de lus is een mid-game aankoop, de Smederij
  blijft de eind-sink (beslissing 7). De Provisiekast (€350) maakt de
  bijkeuken blijvend relevant zonder de ammo-economie te verdubbelen: zelfde
  kogels, andere plek.
- Oude ruimtes blijven relevant: de enige upgrade-punten voor schade
  (zone A), herladen (C) en HP (C/D) verhuizen niet.

### 4.9 Performanceanalyse — zombie-herwerking

- Budget per ondode: **max 14 meshes** (nu 8; herwerking richt op ~12:
  2 benen, romp, vod, 2 armen, hoofd, 2 ogen + 2–3 profiel-extra's zoals
  een Brander-kern of bochel), **0 lights per ondode** (de Brander-kern is
  een emissive mesh, geen PointLight), geen textures.
- Animatiebudget: ≤ 10 transform-writes per ondode per frame (been/arm-
  pivots, romp-bob, hoofd) — allemaal `rotation`/`position`-mutaties,
  geen nieuwe allocaties in de frame-loop (het bestaande
  `new THREE.Vector3()`-gebruik in `updateOndoden` niet verergeren).
- Plafond: 14 actieve ondoden (T15) + een handvol stervenden (±0,7 s
  levensduur) ≈ 18 × 12 meshes ≈ 220 meshes worst-case — ruim binnen wat
  de scene nu al aan decor tekent.
- Hitreacties en doodsanimaties zijn timer-gedreven lerps op bestaande
  delen; geen physics, geen skeletal skinning, geen morph targets.

### 4.10 Risicogebieden — ronde 2

- **`updateOndoden()` is de drukste functie van het spel geworden**:
  navigatie, ontwijk-bursts, melee, straks ledematen-animatie, flinches
  én de nav-tabel. Fase 8 (animatie-helft) en fase 9 (navigatie-helft)
  raken 'm allebei — nooit twee van die tickets tegelijk, en fase 8 eerst.
- **Raycast-contract**: alles in `ondodenGroep` vangt kogels; lijken
  moeten er dus uit (beslissing 17) en elk nieuw mesh-deel zonder
  `'kop'`-markering telt als lichaamstreffer — dat is gewenst, maar een
  vergeten `'kop'` op een nieuw hoofd-onderdeel maakt headshots stuk.
- **Muur-splitsingen** (woonkamer-oostmuur, binnenplaats-zuidmuur): de
  hoekafdichtingen elders leunen op botsingsradius-toleranties; na elke
  geometrie-wijziging de bestaande reachability-tests draaien én nieuwe
  probes op de nieuwe naden.
- **`kiesPowerupType()`/`spawnPowerupDrop()`**: Ticket 16 VERVANGT de
  cooldown-architectuur van T2/T3/feedbackronde — de bestaande
  `tests/test-powerups.mjs`-cooldownchecks moeten in hetzelfde ticket mee,
  anders is de suite rood terwijl het spel klopt.
- **Zone-audio**: `plaatsBetreden`-detectie checkt `x > DEUR2_X` — de
  bijkeuken ligt óók op x > DEUR2_X. De zone-E-tickets moeten die trigger
  op de nieuwe `zoneVan` aansluiten, anders speelt de windvlaag in de
  bijkeuken.
- **HUD/banner-teksten**: startscherm en README beschrijven de
  drie-zones-route; de lus-tickets werken die teksten bij (zelfde patroon
  als v0.6/v0.10).

### 4.11 Herbruikbare systemen — ronde 2

| Nieuw | Hergebruik |
| --- | --- |
| Drop-slot per golf | `kiesPowerupType()`-toegestane-lijst, `spawnPowerupDrop()`-registratie + `!type`-guard, `spelStaat.golf` als klok |
| Smederij-visuals | wapen-Groups aan de camera (visibility-toggle van `wisselWapen`), `piep()`-audio, lampflikker-patroon (V4) voor ember-flikker, `SMEDERIJ_ACCENT_KLEUR` |
| Modulair ondode-model | `maakOndodeModel`-opbouw, `kiesOndodeTraits`, `userData.lichaamsdeel`-contract, `groep.userData.ondode`-backlink |
| Hitreacties | `bloedvonk`-patroon (timer-mesh), `raakOndode` als enige treffer-ingang |
| Doodsanimaties | `doodOndode` als enige dood-ingang, aparte scene-`Group` (patroon `ondodenGroep`) |
| Lus-geometrie | `bouwMuur`/`vlak`/`bouwBinnenplaatsMuur`, deur-kooppatroon (mesh + obstakel + punt + banner, zie `koopDeur2`), `bouwBarricade`, `interactieMarkering` |
| Lus-navigatie | `zoneVan`-structuur, `ZONE_DEURPUNTEN`-idee (wordt graaf), `losBotsingenOp` |
| Zone-E-inhoud | ammo-kist-kooppatroon, zone-banners (V8), eenmalige zone-audio (`gangBetreden`-patroon) |

---

## 5. Fable-architectuurronde 3 (v0.16) — combat-leesbaarheid, schietfeedback, winkel-identiteit en sfeer

Geschreven ná de uitvoering van v0.15 (fases 6–9: power-up-slot,
Smederij-visuals, zombie-herwerking Z1–Z6, map-lus M1–M6 zijn allemaal
geïmplementeerd; de zone-navigatie is een graaf met `NAV_VOLGENDE`).
Regelnummers hieronder zijn indicatief voor de huidige staat — zoek altijd
op symboolnaam. Ontwerpbeslissingen 21–32 in §2 horen bij deze ronde.

### 5.1 Codekaart — melee & speler-schade (huidige staat)

- Balanswaarden: `ONDODE_SNELHEID 1.5`, `MELEE_BEREIK 1.2`,
  `MELEE_SCHADE 15`, `MELEE_COOLDOWN 1.0` (regel ±2148-2162).
- `updateOndoden(dt)` (±2857) heeft drie "helften": (1) de MELEE-branch
  bovenaan (`afstand <= MELEE_BEREIK` → `meleeTimer` aftellen →
  `spelerSchade(MELEE_SCHADE)` → `continue`), (2) de NAVIGATIE-helft
  (zone-graaf `NAV_VOLGENDE`, ontwijk-bursts), (3) de ANIMATIE-helft
  (ledematen, flinch). Cruciale quirk: onderaan de loop staat
  `ondode.meleeTimer = 0` — buiten bereik wordt de timer elke frame
  gereset, dus de EERSTE frame binnen bereik doet meteen schade.
- Eén repo-test verankert dat oude gedrag expliciet:
  `tests/test-ondode-hitreacties.mjs` ("meleeTimer wordt nog altijd elk
  frame gereset"). Het aanvals-ticket moet die check in hetzelfde ticket
  vervangen door state-machine-checks.
- `spelerSchade(bedrag)` (±3102): HP-af, `vignetFlits = 1`,
  `speelSpelerAu()`, game over op 0. Aanroepers: de melee-branch en
  `ontploiBrander()`. Dat blijven de enige twee.
- Ondode-state op het object (`spawnOndode`, ±2738): `groep, type, hp,
  snelheid, geldMultiplier, strompelt, loopFase, delen, flinch,
  meleeTimer, vastTijd, ontwijkTimer, ontwijkZijkant, ontwijkStartPos`.
  `delen` bevat `beenL/beenR/romp/hoofd/armL?/armR?/kern?` (arm-pivots
  kunnen ontbreken: 'eenarmig'-profiel heeft geen `armL`).
- `gameLoop` klemt dt op 0.05 s (regel ±3951) — timers kunnen nooit
  meer dan 50 ms per frame verspringen.

### 5.2 Aanvals-state-machine (ontwerp — beslissingen 21–24)

Nieuwe state op de ondode: `aanvalStaat` ('jaag' | 'windup' | 'herstel'),
`aanvalTimer` (s), `aanvalVertraging` (s, de anti-synchroon-jitter).
`meleeTimer` vervalt volledig. Nieuw constants-blok naast `MELEE_*`
(de oude drie constanten vervallen of worden hernoemd — geen dubbele
waarheden laten staan):

```js
const AANVAL_START_BEREIK   = 1.4;   // vanaf hier mag een wind-up beginnen
const AANVAL_DRAAI_SNELHEID = 2.0;   // rad/s bijdraaien tijdens de wind-up
const MAX_AANVALLERS        = 2;     // gelijktijdige wind-ups (beslissing 23)
const AANVAL_START_JITTER   = 0.35;  // 0..dit aan willekeurige startvertraging
const AANVAL_PROFIELEN = {
  //           windup  herstel  raakBereik  raakHoek  schade  onderbreekbaarLichaam
  normaal: { windup: 0.55, herstel: 0.70, raakBereik: 1.6, raakHoek: 1.15, schade: 15, onderbreekbaarLichaam: false },
  loper:   { windup: 0.40, herstel: 0.90, raakBereik: 1.5, raakHoek: 1.15, schade: 10, onderbreekbaarLichaam: true },
  sjouwer: { windup: 0.85, herstel: 1.00, raakBereik: 1.8, raakHoek: 1.40, schade: 25, onderbreekbaarLichaam: false },
  brander: { windup: 0.55, herstel: 0.70, raakBereik: 1.6, raakHoek: 1.15, schade: 15, onderbreekbaarLichaam: false },
  sluiper: { windup: 0.35, herstel: 0.80, raakBereik: 1.5, raakHoek: 1.15, schade: 12, onderbreekbaarLichaam: true },
};
```

Stroom (vervangt de hele melee-branch; navigatie- en animatie-helft
blijven onaangeraakt behalve waar hieronder expliciet genoemd):

1. **jaag** — bestaand gedrag. Als afstand ≤ `AANVAL_START_BEREIK` én
   `actieveAanvallers < MAX_AANVALLERS`: `aanvalVertraging` aftellen
   (init `Math.random() * AANVAL_START_JITTER`); op 0 → windup starten
   (`actieveAanvallers++`, timer = profiel.windup). Buiten bereik reset
   `aanvalVertraging` naar een nieuwe loting.
2. **windup** — positie bevroren (geen `addScaledVector`), rotatie
   hooguit `AANVAL_DRAAI_SNELHEID * dt` richting de speler (klem het
   verschil, geen `atan2`-snap). Timer op 0 → het SLAG-MOMENT: raak als
   (a) afstand ≤ profiel.raakBereik, (b) hoekverschil ≤ profiel.raakHoek,
   (c) `isVrijePlek((x+sx)/2, (z+sz)/2, 0.05)` — het middelpunt is niet
   in een muur/deur-obstakel. Raak → `spelerSchade(profiel.schade)` +
   raak-audio; mis → mis-audio (whoosh). Beide → 'herstel',
   `actieveAanvallers--`.
3. **herstel** — beweegt op 40% snelheid mee (voelt als bijkomen), start
   geen nieuwe wind-up. Timer op 0 → 'jaag'.
4. **onderbreking** (in `raakOndode`, na de flinch-set): headshot tijdens
   'windup' → altijd afbreken; lichaamstreffer alleen bij
   `onderbreekbaarLichaam`. Afbreken = 'herstel' met `herstel * 0.5`,
   `actieveAanvallers--`. `doodOndode` op een windup-ondode moet de
   teller óók verlagen (anders lekt een slot).
5. **flinch/knockback** (T21) blijft puur cosmetisch bovenop alles; de
   knockback kan een aanvaller buiten raakbereik schuiven — dan mist de
   slag vanzelf (gewenst emergent gedrag).

Edge-cases: meerdere ondoden in de kelderhals (2 m breed) — het
midden-punt-check laat aanvallen door de open doorgang gewoon toe (geen
obstakel), maar blokkeert slaan door de deur3/deur4-meshes (die staan als
obstakel-rechthoek geregistreerd zolang niet gekocht). Lage framerate:
dt-clamp 0.05 + discrete overgangen = hooguit 50 ms vertraging op een
slag, nooit dubbele schade. Game over: `spelerSchade` checkt al
`spelStaat.gameOver`; de state-machine hoeft niets extra's.

### 5.3 Aanvals-tells (ontwerp — presentatielaag, apart ticket)

- **Visueel**: tijdens windup lerpen beide arm-pivots van
  `ARM_RUST_ROTATIE_X` (-0.5) naar -1.9 rad (hoog geheven), het hoofd
  kantelt licht achterover, en de ogen pulsen fel
  (`delen.oogMateriaal.emissiveIntensity` van 1.4 → 2.6 met de
  windup-fractie). Daarvoor moet `maakOndodeModel` het oog-materiaal op
  `delen.oogMateriaal` zetten (het is al één gedeeld materiaal per
  ondode voor beide ogen). In 'herstel' zakken de armen over de halve
  herstelduur terug. De arm-writes VERVANGEN de loop-zwaai-writes voor
  die ondode (zelfde properties) — netto 0 extra transform-writes;
  alleen de oog-materiaalwrite en een eventuele romp-kanteling komen
  erbij, en dat uitsluitend voor de ≤ 2 actieve aanvallers.
- **Audio**: `speelAanvalGrom(type)` bij windup-start — stijgende grom,
  per type een eigen register (Sjouwer laag/lang, Loper/Sluiper kort en
  schril, normaal middenin); `speelSlagRaak()` (doffe dreun) bij raak
  bovenop het bestaande `speelSpelerAu()`; `speelSlagMis()` (whoosh) bij
  mis. Allemaal `piep()`-composities, geen bestanden.
- **Eenarmigen** ('eenarmig'-profiel, geen `armL`): de tell werkt met
  één arm — alle arm-writes moeten `if (delen.armX)` blijven checken
  (bestaand patroon in de animatie-helft).

### 5.4 Codekaart — schieten & feedback (huidige staat)

- `probeerTeSchieten()` (±2043): cooldown via `klok`, leeg magazijn →
  `speelDroogKlik()`. `schiet()` (±2054): magazijn--, `terugslag = 1`,
  vlam + vlamLicht 0.05 s aan (`vlamTimer`), `speelSchot()` (identiek
  voor beide wapens), center-raycast → eerst `ondodenGroep` (kop via
  `userData.lichaamsdeel`), anders `wereld` → `vonk` (nieuwe mesh +
  `setTimeout` 150 ms — HET te vervangen patroon).
- `raakOndode(ondode, punt, kop)` (±3059): schade/geld/kill/flinch +
  `bloedvonk` (zelfde setTimeout-patroon; kop = groter/feller — de enige
  bestaande headshot-differentiatie naast geld).
- Terugslag/vlam-afhandeling in `gameLoop` ná de `spelActief`-tak
  (±4006-4013): decay op wall-frame-dt — cosmetisch, mag zo blijven.
- Herlaad-audio: `speelHerlaad()` speelt de tweede piep via een VASTE
  `setTimeout(900)` — klopt niet met `herlaadDuurSnel` (0.7/0.9 s) en
  loopt door tijdens pauze. Wordt vervangen door twee losse geluiden:
  start in `herladen()`, klaar in `updateWapen()` op het echte
  voltooiingsmoment.
- Wapens: `WAPEN_DRUKSPUIT` (mag 8, cd 0.2 s, herlaad 1.2/0.7) en
  `WAPEN_RATELAAR` (mag 16, cd 0.1 s, herlaad 1.5/0.9), elk met eigen
  `vlam`/`vlamLicht`(+basis/kleuren) en `smederijConfig`. `wisselWapen()`
  is een instant visibility-toggle zonder geluid of animatie.
- Wat er NIET is: hitmarker, tracers, camera-kick, spread, impact-
  deeltjes, kill-audio, wissel-/droogklik-visual, materiaalafhankelijke
  wereld-impacts.

### 5.5 Effecten-architectuur (ontwerp — beslissing 25)

Eén klein systeem, in het bestaand single-file-idioom:

```js
const TRACER_MAX = 8;
const IMPACT_MAX = 24;                  // deeltjes totaal, over alle bursts
const tracerPool = [];                  // vooraf gebouwde meshes, visible=false
const impactPool = [];
const actieveEffecten = [];             // { mesh, timer, duur, soort, vx?, vy?, vz? }
```

- Geometrie/material-cache: één `BoxGeometry(1,1,1)` gedeeld; tracers
  schalen 'm (`scale.set(0.012, 0.012, lengte)`), impact-deeltjes klein
  (`0.035`). Materials per kleur gecachet (`MeshBasicMaterial` — geen
  licht-interactie nodig, goedkoopst).
- `spawnTracer(vanWereldPos, naarPunt, kleur)`: pak uit pool (of recycle
  de oudste actieve), positioneer op het midden, `lookAt(naarPunt)`,
  levensduur 0.08 s, opacity-fade. Oorsprong = wereldpositie van de
  vlam-mesh (`vlam.getWorldPosition(_tmpVec)`).
- `spawnImpact(punt, kleur, aantal)`: 3–5 deeltjes met kleine random
  snelheid + zwaartekracht, levensduur 0.3 s.
- `updateEffecten(dt)` in de `spelActief`-tak van `gameLoop` (bevriest
  tijdens pauze); klaar → `visible = false`, terug in de pool.
- Module-scope temp-vectors (`_tmpVecA/_tmpVecB`) — géén `new
  THREE.Vector3()` in `schiet()`/`raakOndode()`-hot-paths erbij.
- `vonk` en `bloedvonk` VERVALLEN (vervangen door `spawnImpact`);
  headshot = meer deeltjes + lichtere tint, kill = idem + de
  hitmarker/audio-tier draagt het verschil.
- Wereld-impactkleur: `raak[0].object.userData.materiaalFamilie ?? 'steen'`
  → kleurtabel (families komen in het materiaal-ticket; tot die tijd
  bestaat alleen 'steen' als default en 'vijand').

### 5.6 Wapen-identiteit (ontwerp — beslissing 27)

Nieuwe velden op de bestaande definities (naast `smederijConfig`):

| Veld | Drukspuit | Ratelaar | Gebruik |
| --- | --- | --- | --- |
| `kickSterkte` | 0.014 | 0.006 | rad camera-kick per schot |
| `spreadNdc` | 0 | 0.012 | random offset op `setFromCamera` |
| `terugslagSterkte` | 1.0 | 0.55 | schaal op de bestaande `terugslag = 1` |
| `schotToon` | `{start:480, eind:120, duur:0.09}` | `{start:620, eind:210, duur:0.06}` | per-wapen `speelSchot` |

- `cameraKick` (module-let): `schiet()` doet `cameraKick +=
  kickSterkte`; waar de camera-pitch wordt gecomponeerd (in
  `updateSpeler`, zoek `camera.rotation` / pitch-toepassing) telt
  `cameraKick` op; decay `cameraKick *= Math.exp(-10 * dt)` in dezelfde
  functie. `speler.pitch` zelf NOOIT muteren.
- Spread: `raycaster.setFromCamera({ x: (Math.random()-0.5) *
  spreadNdc, y: ... }, camera)` — de tracer volgt het echte raakpunt,
  dus wat je ziet klopt met wat je raakt.
- Herlaad-dip: tijdens `wapenStaat.herladen` kantelt de actieve
  wapen-groep met een sinus-boog omlaag/omhoog op
  `herlaadTimer/herlaadDuur` — geen aparte timer, geen nieuwe state.
- Wisselen: `wisselTimer = 0.16` in `wisselWapen()` + korte
  y-dip-animatie op de binnenkomende groep in de bestaande
  terugslag-zone van `gameLoop`; `speelWissel()` (nieuw piep-geluidje).
  De bestaande vlam-doof-fix in `wisselWapen()` blijft.

### 5.7 Winkel-inventaris (huidige staat) en winkelstijl-architectuur

Twaalf interactiepunten in `interactiePunten` (±3919), plus dynamische
barricade-reparatiepunten (buiten deze ronde). Huidige markering:
`interactieMarkering(x, z, kleur)` = vloerring + generieke zwevende
kubus (±3470). Statusweergave beperkt tot `doofMarkering()` (grijs, V7)
voor upgrade/werkbank/pantserdrank/ratelaar. Kleuren overlappen deels
(deur2 = deur3 = `0x9fc0e8`, pantserdrank ≈ watertap-blauw).

| Punt | Functie-categorie | Icoon (nieuw) | Primaire kleur (nieuw) |
| --- | --- | --- | --- |
| `ammoPunt` (3, −2) | munitie | kogel (cilinder + kop) | `0x6bd0ff` (bestaand) |
| `provisiekastPunt` (10.7, −0.5) | munitie | kogel (zelfde) | `0xd8c47a` (bestaand) |
| `upgradePunt` (−3, −2) | schade-upgrade | pijl omhoog (cone op zuiltje) | `0xffd75e` (bestaand) |
| `werkbankPunt` | Snelheidselixer | slanke fles (cilinder + halsje) | `0xff9f5a` (bestaand) |
| `pantserdrankPunt` | pantser | schild (afgeplatte box + punt) | `0x9fd8ff` → iets verschuiven naar `0xb8c8ff` (weg van watertap-blauw) |
| `watertapPunt` | genezing | druppel (bol + omgekeerde cone) | `0x54c8e8` |
| `ratelaarPunt` | wapen | tandwiel (torus, bestaande vormtaal) | `0xd9a05a` (bestaand) |
| `smederijPunt` | smeden | hamer (2 boxes) | `0xff7a1f` (= `SMEDERIJ_ACCENT_KLEUR`) |
| `deurPunt` … `deur4Punt` | doorgang | sleutel (ring + steel) | bestaande per-deur kleuren |

- Centrale config `WINKEL_STIJLEN` (object, key = stijlnaam): `{ kleur,
  bouwIcoon(groep), status() }`. `status()` retourneert 'beschikbaar' |
  'teDuur' | 'gekocht' | 'nvt' op basis van de BESTAANDE flags
  (`spelStaat.geld`, `snelspannerGekocht`, `ratelaarGekocht`,
  `wapenStaat.gesmeed`, HP-vol-check, …). Deuren verdwijnen bij aankoop
  (bestaand gedrag) en hebben alleen 'beschikbaar'/'teDuur'.
- Nieuwe `winkelMarkering(x, z, stijlNaam)` vervangt ALLE
  `interactieMarkering`-aanroepen; de bestaande exportnamen
  (`upgradeMarkering`, `werkbankMarkering`, `smederijMarkering`,
  `deur*Markering`, …) blijven bestaan en blijven `doofMarkering`-
  compatibel (zelfde Group-structuur: ring + icoon-kinderen).
- Statusanimatie in een nieuwe `updateWinkelMarkeringen(dt)`
  (`spelActief`-tak): beschikbaar = ringopacity 0.4–0.7-sinus + icoon
  `rotation.y += dt * 0.8`; teDuur = stilstand op 0.35; gekocht =
  `doofMarkering` (eenmalig, geen animatie meer — sla gedoofde markers
  over in de loop); nvt = kleur naar grijsblauw maar opacity 0.3.
  Koop-flits: koop-functies roepen naast `speelKoop()` ook
  `flitsMarkering(markering)` aan (ring kort naar schaal 1.25/opacity
  0.9, decays in de update-loop).
- `winkelLicht` (beslissing 30): één PointLight (intensiteit ≤ 3,
  range 5, decay 2, `castShadow = false`), elke frame: dichtstbijzijnde
  niet-gedoofde winkel binnen 6 m → positie boven de ring (y 1.2),
  `color.lerp(doelkleur, dt * 5)`, intensiteit met dezelfde puls als de
  ring; geen winkel in de buurt → intensiteit naar 0 lerpen.
- Mistgolf: emissive iconen + ring blijven binnen fog-far (9.35 m)
  leesbaar; geen extra werk, wél een acceptatiecriterium.

### 5.8 Smederij-verhuizing (ontwerp — beslissing 28)

- Huidig: `SMEDERIJ_X = DEUR2_X + 2.5` (= 7.0), `SMEDERIJ_Z =
  PLAATS_Z_NOORD + 1.2` — noordwest-binnenplaats. Machineblok
  (±1510-1528): aambeeld (castShadow), aambeeldpunt, voet, kool
  (emissive) en `koolLicht` (PointLight 1.4/4) — ALLE posities zijn
  `SMEDERIJ_X/Z`-afgeleiden; `smederijMarkering` (±1529) en
  `smederijPunt` (±3910) idem. Geen collision, geen zonecheck.
- Nieuw: `SMEDERIJ_X = 6.8`, `SMEDERIJ_Z = 3.5` (bijkeuken, tegen de
  zuidwand). Onderbouwing en marges: zie beslissing 28. De machine
  hoeft niet te draaien (aambeeld ligt langs de X-as, prima parallel aan
  de zuidwand); wie wil mag de meshes in een Group zetten, maar
  constanten-verplaatsing volstaat en is de kleinste diff.
- Verlichting: de kool + `koolLicht` verhuizen automatisch mee en zijn
  het lokale accent; het gedeelde `winkelLicht` (5.7) doet de rest.
  GEEN extra hangLamp — de zuidwand mag schemerig blijven (ember-gloed
  is het thema van dit punt).
- Wat te controleren (testplan hoort bij het ticket): oude positie
  (7.0, −14.3) heeft geen prompt/markering/mesh meer; nieuwe positie
  werkt met deur 3 dicht (debug-teleport) én open; vanuit de woonkamer
  op (4.4, 3.5) — 0.1 m van de muur — verschijnt GEEN Smederij-prompt
  (de deur4Punt-bugles); `isVrijePlek`-probes op de route terugdeur ↔
  kelderhals blijven vrij; `schaduw === 1`-invariant intact (koolLicht
  werpt geen schaduw); beide wapens blijven smeedbaar; README-regel over
  de Smederij-locatie bijgewerkt.

### 5.9 Vijandleesbaarheid & sfeer (ontwerp — beslissingen 31 en 32)

- **Poses (build-time, gratis)**: `ONDODE_TYPES[type].gang = {
  pasFactor, bobFactor, ampFactor }` — Sjouwer trage zware pas
  (pasFactor 0.8, bobFactor 1.6), Loper snelle pas (1.25, 0.8), Sluiper
  korte snelle pasjes met lage bob (1.4, 0.5, amp 0.7). Toegepast in de
  BESTAANDE animatie-writes (zelfde properties, andere factoren — netto
  0 extra writes). Het hoofd-hoogte-anker (±0.03-band, zie beslissing
  16) blijft onaantastbaar: GEEN nieuwe y-offsets op de hoofdgroep.
- **Geluidsprofiel per type**: `ondode.gromTimer` (init 4–9 s, dt-af);
  op 0 én afstand tot speler < 8 m → per-type grom (`piep`-compositie),
  nieuwe timer. Sluiper gromt NOOIT — stilte is zijn tell. Globale cap:
  max één grom per 0.6 s (module-let `laatsteGromKlok`).
- **Ogen in de mist**: `startEventGolf('mist')` zet
  `delen.oogMateriaal.emissiveIntensity` op 2.6 voor alle levende
  ondoden (en `spawnOndode` doet het bij mist-spawns); `eindigEventGolf`
  zet terug naar 1.4. Event-gedreven, geen per-frame kosten.
- **Sfeer-details** (apart ticket): stofdeeltjes in de
  atelier-daglichtkolommen (2 × `THREE.Points` ±30 punten, alleen
  zichtbaar als `zoneVan(speler) === 2`, animatie = trage
  groep-rotatie + y-sinus, géén attribute-writes per frame);
  druppel-lek in de kelderhals (één mesh, val-timer 3–6 s, tik-geluid
  alleen < 8 m); golfstart-lichtdip (module-let `lampDipFactor` 0.6 → 1
  over 0.8 s, vermenigvuldigd in de bestaande lampflikker-loop).
- **Materiaal-pass**: `matFamilie(naam, kleur)` cache (beslissing 31)
  toegepast op de 6–8 grote vloeren/oppervlakken (binnenplaats-klinkers
  → natSteen-glans, bijkeuken → tegel, gang → dof steen, kelderluik →
  hout) + `userData.materiaalFamilie` voor de impact-koppeling (5.5).
  Props NIET massaal herschilderen — alleen de grote vlakken.

### 5.10 Performancebudgetten — ronde 3

- **Effecten**: ≤ 8 tracers + ≤ 24 impact-deeltjes actief; pools
  vooraf gebouwd; 0 nieuwe allocaties per schot/treffer in
  `schiet()`/`raakOndode()` na opwarmen (geen `new THREE.*`, geen
  closures-per-schot, temp-vectors hergebruiken). Geen `setTimeout`
  voor nieuwe effecten.
- **Lights**: +1 permanent (`winkelLicht`, geen schaduw). De
  `schaduw === 1`-invariant (precies één schaduwwerpende lamp) blijft
  keihard. Vlam-/ember-/kool-/brander-lichten ongewijzigd.
- **Ondode-budget**: ≤ 14 meshes en ≤ 10 transform-writes per ondode
  per frame blijven gelden; de aanvals-tell mag daar bovenop uitsluitend
  voor de ≤ 2 actieve aanvallers ≤ 3 extra writes doen (armen vervangen
  bestaande writes; oog-emissive is een material-write, geen transform).
- **Winkels**: statusanimatie ≤ 2 writes per niet-gedoofde markering
  per frame (ringopacity + icoonrotatie); gedoofde markers worden
  overgeslagen. `winkelLicht` = 1 positie- + 1 kleur- + 1
  intensiteit-write.
- **Materialen**: familie-cache voorkomt material-groei; gecachete
  materialen zijn immutabel. Geen nieuwe transparante full-screen
  vlakken; `THREE.Points`-wolken ≤ 2 actief, ≤ 30 punten elk.
- **HUD**: hitmarker = 1 DOM-element met klasse-toggles; geen
  per-frame DOM-reads.

### 5.11 Risicogebieden — ronde 3

- **`updateOndoden()` wordt voor de DERDE keer aangeraakt** (fase 8 =
  animatie, fase 9 = navigatie, nu de melee-branch). Het aanvals-ticket
  raakt UITSLUITEND de melee-branch + nieuwe state-velden; de tell komt
  in een APART ticket dat uitsluitend de animatie-/audio-kant doet.
  Nooit die twee combineren.
- **`tests/test-ondode-hitreacties.mjs`** verankert het oude
  meleeTimer-gedrag ("wordt elk frame gereset") — die check MOET in het
  aanvals-ticket mee veranderen, anders is de suite rood terwijl het
  spel klopt (zelfde les als T16/test-powerups).
- **`schiet()`/`raakOndode()` zijn hot paths**: elke regel die daar per
  schot alloceert is een regressie. De effecten-pool moet er eerst
  staan; daarna pas headshot-/kill-tiers erbovenop.
- **Gedeelde materialen muteren**: `doofMarkering` muteert
  material-kleuren — dat mag alleen omdat elke markering eigen
  materials heeft. De nieuwe familie-cache (5.9) deelt materials wél:
  daar geldt "nooit muteren". Iconen van winkelMarkering krijgen dus
  EIGEN materials (ze moeten doofbaar blijven), vloeren gedeelde.
- **Hoofd-hoogte-anker**: pose-tickets mogen de hoofdgroep-y niet
  verschuiven (±0.03-band in `tests/test-ondode-model.mjs`); ritme- en
  amplitudeverschillen zijn de veilige knoppen.
- **Markering-vervanging**: `winkelMarkering` moet dezelfde
  Group-structuur teruggeven als `interactieMarkering` (ring als kind 0
  is nergens gegarandeerd, maar `doofMarkering` traverset — het échte
  contract is: alle materials doofbaar). Exportnamen behouden.
- **Smederij-verhuizing raakt drie plekken via twee constanten** —
  machineblok, markering, kooppunt volgen `SMEDERIJ_X/Z` vanzelf, maar
  screenshots vóór/na zijn verplicht: een vergeten hard-coded offset
  (bv. in een later toegevoegd decor-item) valt alleen visueel op.
- **Audio-overload**: de Ratelaar (10 schoten/s) × hit-tiks × groms kan
  clippen. Regels: pitch-variatie, korte duur (≤ 0.09 s), globale
  grom-cap, en GEEN nieuwe geluiden in dezelfde frame stapelen boven de
  bestaande `piep`-volumes (≤ 0.16).

### 5.12 Herbruikbare systemen — ronde 3

| Nieuw | Hergebruik |
| --- | --- |
| Aanvals-state-machine | `ondode`-statevelden-patroon, `isVrijePlek`, dt-clamp, `spelerSchade`, flinch (T21) als onderbrekingsvisual |
| Aanvals-tells | arm-/hoofd-pivots (T18/T20), `ARM_RUST_ROTATIE_X`, oog-materiaal per ondode, `piep()` |
| Effecten-pool | `vlam.getWorldPosition`-patroon, `spelActief`-tak van `gameLoop`, bestaande raycast-punten |
| Hitmarker | HUD-DOM-conventie (`ammoUI`/`vignet`-patroon), CSS-transities, `updateVignet`-achtige decay |
| Wapen-identiteit | `WAPEN_*`-definities, `terugslag`-zone in `gameLoop`, `wisselWapen`-vlamfix |
| Winkelstijl | `interactieMarkering`-structuur, `doofMarkering`, koop-functies + `speelKoop`, `updateInteracties` |
| winkelLicht | lampflikker-patroon (puls), `interactiePunten` als positie-bron |
| Smederij-verhuizing | `SMEDERIJ_X/Z`-afleiding overal, deur4Punt-marge-les (2.3 m), `isVrijePlek`-probes |
| Materiaal-families | `mat()`-helper als binnenkant van `matFamilie`, `userData`-conventie |
| Sfeer-details | `zoneVan()` voor zichtbaarheid, lampflikker-loop voor de dip, zone-audio-patroon voor de druppel-tik |

## 6. Fable-architectuurronde 4 (v0.17) — doel, score, arsenaal en late game

Gekozen scope (designer-pitch, selectie door de gebruiker): score/stats/
highscore, moeilijkheidsgraden, de Vluchtroute als win-conditie, de
Stroomuitval-eventgolf, De Hagelketel als derde wapen, dreigingsaudio,
zone-naambanners en een golf-16+ pacing-audit. Tickets 42–51 in
ROADMAP.md; ontwerpbeslissingen 33–42 hieronder.

**Feedbackronde ná speeltest (§6.12-6.17, ontwerpbeslissingen 43-48):**
nadat T42-45 waren geïmplementeerd en gespeeld kwam concrete feedback
terug — de ontsnappingslocatie voelde random, de vluchtroute-onderdelen
vielen niet op, en de gebruiker wil een ronde-gebonden ontsnappings-
ritme in plaats van "altijd beschikbaar zodra 3/3". Verwerkt als
Tickets 52-56 (§6.12-6.15). Een tweede feedbackronde op het T56-ontwerp
zelf voegde een "item+rustvlak verdwijnen samen"-eis toe, plus Ticket 57: dezelfde
zwevende-planken-fout uit de binnenplaats-fix blijkt zich elders ook
voor te doen (§6.16, beslissing 48). Tegelijk is De Hagelketel (T47/T48)
op verzoek van de gebruiker naar de Backlog verplaatst (§6.17) — §6.6
blijft als ontwerpreferentie staan, maar telt niet meer mee in de
actieve performancebudgetten hieronder.

### 6.1 Codekaart — run-state, schermen en persistentie (huidige staat)

- **`spelStaat`** (~regel 4032): golf/geld/gameOver/golfActief/budget/
  timers. Er bestaan GEEN statistiektellers en er is GEEN persistentie —
  localStorage is in het hele bestand ongebruikt.
- **Schermen**: `startscherm` (~336-353 DOM, ~2053 click → pointer lock),
  `gameOverScherm` (~336-341, getoond in `gameOver()` ~3995). De
  pointerlockchange-handler (~2060-2071) bevat de éne guard die bepaalt
  welk overlay zichtbaar is; elke nieuwe overlay (winscherm, T45) MOET
  daar door.
- **HUD**: `updateHUD()` (~4005) schrijft alleen bij events (koop,
  schade, golfwissel), nooit per frame. Nieuwe HUD-elementen
  (vluchtroute-teller T44, zonelabel T50) volgen die regel.
- **Wapens**: definities `WAPEN_DRUKSPUIT`/`WAPEN_RATELAAR` (~2368-2400),
  `wapenStaten`-map + `actiefWapenNaam` + herbindbare `wapenStaat`
  (~2406), `wisselWapen()` (~2429) is nu een tweewapen-toggle.
  `schiet()` (~2671) is een hot path (§5.10-regels blijven keihard).
- **Eventgolven**: framework ~4052-4110 (`isEventGolf`, `kiesEventType`,
  `startEventGolf`, `eindigEventGolf`), bewust generiek gehouden ("latere
  types kunnen aan kiesEventType worden toegevoegd zonder dit framework
  te raken"). Mist-oogboost via `zetOogBasis` (~3491 in `spawnOndode`).
- **Verlichting**: `lampLichten` (5 entries: {licht, basis, fase, amp1,
  amp2, minFactor}, ~1231), flikker-loop + `lampDipFactor`-ramp
  (~4893-4896). De bol-mesh van de peer zit NIET in de entry (nodig voor
  T46). Buitenverlichting (lantaarns, maanlicht) staat los van
  `lampLichten`.
- **Zones**: `zoneVan()` (~3536): 0 woonkamer, 1 gang, 2 atelier,
  3 binnenplaats, 4 bijkeuken/kelderhals. Zone-audio-triggers
  (`gangBetreden`/`plaatsBetreden`) in de gameLoop ~4866-4872.
- **Audio**: `initGeluid()`/`piep()` (~2730-2749); alle geluiden zijn
  one-shots — er bestaat nog geen doorlopende laag (T49 introduceert de
  eerste).
- **Interactiepunten**: `interactiePunten`-array (~4804) telt bij laden
  exact 12; `test-smederij-verhuizing.mjs` bewaakt dat getal hard.

### 6.2 Score en runStats (beslissing 33)

`runStats` is een plat object met tellers; increments zijn kale
`x++`-regels op bestaande plekken (geen helper-refactor van de
geld-uitkering — te riskant voor het hot path). De score wordt UITSLUITEND
aan het einde berekend (`berekenScore()`), nooit per frame. Headshots
tellen als kop-TREFFERS (consistent met de hitmarker-tiers), niet alleen
kop-kills. Persistentie via `leesHighscore()`/`schrijfHighscore()` die
localStorage-toegang ALTIJD in try/catch wikkelen: file://-context,
privacy-modes of testomgevingen mogen het spel nooit breken; bij een
weigering doet het spel gewoon alsof er geen record is.

### 6.3 Moeilijkheidsgraden (beslissing 34)

Drie graden als data (`MOEILIJKHEDEN`), géén nieuwe systemen: alleen
budgetFactor (op `golfBudget()`), regenFactor (op de gebruiksplek van
`SPELER_REGEN_PER_SEC`), scoreFactor (op de T42-formule) en startGeld.
`amsterdammer` is per definitie {1, 1, 1, 0} = het huidige gedrag —
regressietests draaien ongewijzigd op die graad. Prijzen worden NIET
geschaald (12 koopplekken + promptteksten + tests zouden allemaal
meebewegen — te invasief voor wat het oplevert). De keuze is éénmalig per
run, op het startscherm vóór de eerste pointer lock; de pauze-flow blijft
byte-voor-byte bestaand gedrag.

### 6.4 Vluchtroute en Ontsnapping (beslissingen 35 en 36)

**35 — dynamische interactiepunten.** Vluchtroute-onderdelen (en het
ontsnappingspunt) worden PAS aan `interactiePunten` toegevoegd op het
moment dat ze in het spel verschijnen, en er weer uit gehaald na gebruik.
Daardoor blijft de laadtijd-telling van 12 punten intact en hoeft
`test-smederij-verhuizing.mjs` er niet voor open (alleen T48's statische
kooppunt verhoogt dat getal). Onderdelen verschijnen op vaste drempelgolven
(3/6/9), ook als hun zone nog op slot zit — ze wachten daar; dat is
bewust: de speler ziet ze bij het openen van de zone al staan.

**36 — winnen is geen game over.** Het winscherm pauzeert het spel via
het bestaande pointer-lock-mechanisme (`exitPointerLock` → pauze-gate),
NIET via `spelStaat.gameOver` — "Speel door" hoeft dan alleen de lock
opnieuw aan te vragen. Consequentie: de pointerlockchange-guard (~2065)
moet drie overlays kennen (start/gameOver/win) met de regel "één overlay
tegelijk, win- en gameOver-scherm winnen van het startscherm". De
ontsnappingsbonus (+1000) gaat vóór de moeilijkheids-multiplier.

### 6.5 Eventgolf Stroomuitval (beslissing 37)

Eigen `stroomFactor`-vermenigvuldiger in de bestaande flikker-regel,
NAAST `lampDipFactor` (niet hergebruiken: de dip is een 0.8s-accent, de
stroomuitval een golf-lange toestand met eigen herstel-ramp). De
peer-emissive dimt mee — daarvoor gaat de bol-mesh alsnog de
`lampLichten`-entry in (kleine, veilige uitbreiding van `hangLamp`). De
buitenverlichting blijft bewust AAN: buiten = vluchtheuvel, binnen =
gevaar, en het spaart het hele licht-/schaduwbudget. De oog-boost loopt
via het bestaande `zetOogBasis`-kanaal met dezelfde waarde als de mist;
de mist-check in `spawnOndode()` generaliseert naar "actief event boost
ogen". Er is altijd hooguit ÉÉN actief event (`actieveEventGolf`), dus de
twee events kunnen elkaars herstel niet doorkruisen.
`kiesEventType()` wisselt deterministisch (testbaar, gegarandeerde
variatie): mist op golf 5, stroomuitval op 10, mist op 15, …

**Feedback ná speeltest (2 bugs + 1 aanvulling):** de speler zag amper
verschil. Bug 1: de flikker-loop paste `stroomFactor` alleen toe op de
peer-emissive, niet op `l.licht.intensity` zelf — de kamer bleef dus
even fel verlicht. Bug 2: de ateliers-dakramen (het hoofdlicht van die
zone) zaten nooit in `lampLichten`, dus deden sowieso niet mee — nieuwe,
losse `stroomGevoeligeDaklichten`-array (blijft bewust stabiel/niet-
flikkerend, dimt wel mee met `stroomFactor`). Zelfs met beide bugs
gefixt bleef de kamer bij een pixel-steekproef maar ~15-20% donkerder:
het scene-brede `HemisphereLight` (geen afstandsval-off, dus overal
gelijk) domineerde nog. Aanvulling: `hemisfeerLicht.intensity` en
`renderer.toneMappingExposure` dimmen nu ook mee, elk met een EIGEN,
hogere vloer (35% resp. 40%) dan de puntlichten (12%) — bewust nooit
naar 0, want die twee zijn scene-breed en zouden ook de buitenlichten
(die zelf ongewijzigd blijven) visueel platdrukken. Gemeten eindresultaat:
atelier/woonkamer ~38-43% donkerder, binnenplaats ~32% (blijft relatief
duidelijk lichter dankzij de eigen, sterke, niet-gedimde buitenlichten).

### 6.6 De Hagelketel en de driewapen-wissel (beslissingen 38 en 39)

**38 — pelletAantal generaliseert het schot.** Eén nieuw definitieveld;
`schiet()` krijgt een pellet-lus waarbij `pelletAantal = 1` het EXACT
bestaande pad is (bestaande wapens byte-voor-byte ongewijzigd — dat is
het regressiecontract). Volle schade per pellet; balans komt uit
vuurtempo (~1.1s), magazijn (4), prijs (€2800) en munitieschaarste, niet
uit een aparte schadeformule. Hot-path-regels: de lus hergebruikt de
bestaande temp-vectoren en raycaster, nul allocaties per trekker; de
effect-pools (8/24 + oudste-recycling) vangen de plafonds al af. De
lichttelling gaat bewust 23 → 24 (eigen vlam-PointLight volgens het
wapenpatroon; alleen zichtbaar bij een schot); de Hagelketel-smederijvisual
krijgt GEEN eigen ember-licht (gloeiband, alleen emissive).

**39 — WAPEN_VOLGORDE-cycle.** `wisselWapen()` stapt door een vaste
array en slaat niet-gekochte wapens over. De toggle-implementatie
verdwijnt; met twee gekochte wapens gedraagt de cycle zich identiek aan
de oude toggle (regressiecontract voor de bestaande wisseltests).

### 6.7 Dreigingsaudio (beslissing 40)

Twee licht gedetuneerde oscillators (55/57 Hz, zweving) die bij
`initGeluid()` starten en daarna nooit meer stoppen — alleen de gain
beweegt (start/stop klikt hoorbaar). De gain-doelwaarde komt uit een
pure, exporteerbare functie `berekenDreigingsGain(aantal, afstand)` met
plafond 0.1 (ver onder de piep-volumes; de drone mag nooit met de
aanvals-tells concurreren). Sturing met een ~0.25s-throttle in de
`spelActief`-tak; de niet-actieve tak stuurt 0 (pauze/menu/game over
zwijgen). Testbaarheid komt uit de pure functie + getters, niet uit
geluidsmeting.

**Feedback ná speeltest:** het oorspronkelijke plafond (0.05) bleek in
de praktijk vrijwel onhoorbaar — bij 1-2 ondoden dichtbij (de meest
voorkomende situatie) haalt de curve nooit meer dan ~0.03. Plafond +
curve zijn evenredig verdubbeld (0.008→0.016, 0.02→0.04, 0.05→0.1) zodat
de drone al bij één nabije ondode duidelijk hoorbaar wordt, met dezelfde
architectuur en dezelfde relatieve marge onder de piep-volumes.

**Tweede feedbackronde:** de continue formule (elke ondode een beetje
volume, elke stap dichterbij een beetje meer) verving door een simpele
drempel — `berekenDreigingsGain(aantalBinnenBereik)`:
`aantalBinnenBereik >= DREIGINGS_NABIJHEID_MINIMUM (2) ? 0.07 : 0`.
`updateDreigingsAudio()` telt nu ondoden binnen `DREIGINGS_NABIJHEID_BEREIK`
(1.5 m), niet meer de dichtstbijzijnde afstand. Puur aan/uit is duidelijker
te lezen dan een sluipend oplopend volume, en het plafond ging ook iets
omlaag (0.1 → 0.07) — de drone is een signaal voor "het wordt druk vlak
bij je", niet een permanente sfeerlaag.

### 6.8 Zone-presentatie (beslissing 41)

Zone-banners hergebruiken `toonGolfBanner` (bestaand, getest, één
banner-systeem) met een `bezochteZones`-Set; het HUD-zonelabel schrijft
alleen bij een zonewissel (cache `laatsteZone`). De bestaande
`gangBetreden`/`plaatsBetreden`-audio-triggers blijven aparte, ongemoeide
mechanismen: ze vuren op posities (drempels), niet op zones, en dat
verschil is bewust.

### 6.9 Performancebudgetten — ronde 4

- **Lights**: 23 → 24, uitsluitend door de nieuwe vlonder-lantaarn
  (T52, §6.12) — de Hagelketel-vlam die deze +1 oorspronkelijk zou
  leveren is naar de Backlog verplaatst (§6.17), dus geen dubbele
  toevoeging. De `schaduw === 1`-invariant blijft keihard. Stroomuitval
  voegt NIETS toe (dimmen is een intensity-write). De nieuwe lantaarn
  is een buitenlicht: geen schaduw, niet in `lampLichten`.
- **Hot paths**: `schiet()`/`raakOndode()` blijven allocatievrij — de
  runStats-increments zijn kale writes; de bestaande source-checks
  bewaken dit en moeten groen blijven. Geen van T52-56 raakt deze
  functies.
- **Effecten**: plafonds ongewijzigd (8 tracers / 24 impacts).
- **HUD/DOM**: vluchtroute-teller, zonelabel én het nieuwe
  boot-/ontsnappingsvenster-label (T54) schrijven alleen bij een
  verandering; het winscherm is een event-overlay. Geen per-frame
  DOM-reads of -writes erbij.
- **Audio**: drone-gain max 0.05, throttle ~0.25s, nul
  oscillator-herstarts; alle nieuwe one-shots (incl. de T55-boothoorn)
  ≤ 0.16 volume (bestaande regel) en spelen exact 1x per aankomst/
  vertrek, niet per frame.
- **Persistentie**: localStorage alleen bij run-einde
  (gameover/ontsnapping) en scherm-opbouw — nooit in de loop.

### 6.10 Risicogebieden — ronde 4

- **De schermen-guard (~2065)** is de gevaarlijkste plek van de ronde:
  drie overlays (start/gameOver/win) delen één pointerlockchange-handler.
  T45 raakt 'm; elke wijziging vereist de bestaande pauze-/gameover-tests
  én de nieuwe win-tests groen.
- **Exacte-tellingschecks in bestaande tests**: `test-ontsnapping.mjs`'s
  kelderluik-positie-assertie wordt in T53 zelf bijgewerkt naar de
  nieuwe vlonder-coördinaten; de lichttelling (≤ 23 → ≤ 24) wordt in T52
  zelf bijgewerkt — zelfde les als T16/test-powerups en T30/hitreacties,
  nu ook toegepast op de feedbackronde.
- **T54/T55-volgorde**: bouw eerst de mechaniek (golf-gating,
  interactiepunt-toevoegen/-verwijderen) VOLLEDIG en getest, dan pas de
  tell (aankondigingstimer, geluid, licht) eromheen. Nooit combineren —
  zelfde les als T30/T31.
- **Eventgolf-symmetrie**: mist en stroomuitval delen het oog-kanaal en
  het budget-/gewichten-mechanisme. Elke stroomuitval-test hoort
  mist-regressiechecks te bevatten (boost + exacte reset + windup-
  randgeval, het T39-patroon).
- **localStorage in tests**: headless file://-context heeft meestal
  werkende localStorage, maar de guard (try/catch) is verplicht gedrag
  en wordt zelf getest (gemockte weigering).
- **Startscherm-flow (T43/T45)**: de moeilijkheidsknoppen mogen de
  pauze-hervatting en de game-over-flow niet raken; "klik om verder te
  spelen" blijft knoppenloos.
- **wisselWapen-contract**: bestaande tests toggelen tussen twee wapens;
  de cycle moet met precies twee gekochte wapens identiek gedrag geven.
- **Klok-vs-dt-testles** (drie keer geleerd in ronde 3): alles wat op de
  module-`klok` draait (drone-throttle als die zo gebouwd wordt,
  banners met echte timers) in tests via `waitForTimeout` + draaiende
  gameLoop meten, niet via handmatige ticks.

### 6.11 Herbruikbare systemen — ronde 4

| Nieuw | Hergebruik |
| --- | --- |
| runStats/score | bestaande uitkeer-/trefferplekken, gameOver-DOM-patroon |
| Moeilijkheid | `.knop`-styling, `golfBudget()`, regen-gebruiksplek |
| Vluchtroute | `interactiePunten`-mechaniek, `winkelMarkering`+`WINKEL_STIJLEN`, `toonGolfBanner`, `isVrijePlek`-probes |
| Ontsnapping | `gameOverScherm`-opzet, pointer-lock-pauze-gate, T42-statsrender |
| Stroomuitval | eventgolf-framework, `zetOogBasis`-kanaal, `lampDipFactor`-ramp-patroon, `eventSpawnGewichten` |
| Gang naar de Gracht (T52) | `GANG_*`-gangpatroon, `bouwZoneEMuur`, `bouwLantaarn`-patroon (kopiëren), `isVrijePlek`-probes |
| Ontsnapping-verhuizing (T53) | T45's bestaande `toonOntsnappingspuntIndienKlaar()`-structuur, alleen de bron van `x`/`z` verandert |
| Periodieke vensters (T54) | `isEventGolf`-pure-functiestijl, T44's dynamische-interactiepunten-patroon, `startGolf()`/`updateGolf()`-haakpunten |
| Boot-tell (T55) | T31-tell-patroon (zicht+geluid apart van de mechaniek), `piep()`, lampflikker-patroon |
| Vluchtroute-prominentie (T56) | bestaande prim-decorpatronen (kratten/planken), `flitsMarkering`-puls-idee |
| Dreigingsaudio | `initGeluid()`/`piep()`-init-patroon, `spelActief`-takken van de gameLoop |
| Zone-banners | `zoneVan()`, `toonGolfBanner`, HUD-write-bij-verandering-conventie |
| Pacing-audit | threat-budget-simulatiepatroon uit de bestaande golf-tests, scratchpad-perfcount-aanpak |

### 6.12 Gang naar de Gracht: vlonder, water, boot, lantaarn (beslissing 43)

De bijkeuken-oostmuur (`BIJKEUKEN_X_OOST` = 12) was tot nu toe een
dichte "nepgevel"-grens naar een onbenutte pocket (zie de
Zone-E-comment, §6.1). Die pocket ligt volledig binnen de bestaande
`GRENS` (`GRENS.maxX` = `PLAATS_X_OOST` − 0.05 ≈ 20.45) en ver van
andere zones — de binnenplaats ligt rond `DEUR2_Z` ≈ −15.5, de nieuwe
gang/vlonder blijft in het bijkeuken-z-bereik [−4.5, 4.5] — vandaar de
keuze om de nieuwe ontsnappingslocatie HIER te bouwen in plaats van
GRENS te vergroten of een bestaande zone te herschikken. Ontwerp: een
smalle gang (zelfde patroon als de bestaande `GANG_*` tussen
woonkamer/atelier) die uitkomt op een vlonder met drie nieuwe
decorlagen — water (plat vlak, geen simulatie, puur silhouet), boot
(decor tot T53) en een lantaarnpaal (kopie van het
`bouwLantaarn`-patroon, §6.1 — die functie is lokaal gescoped, dus
"kopiëren en aanpassen", CLAUDE.md). De lantaarn is bewust een
BUITENLICHT: geen schaduw, niet in `lampLichten` (geen flikker/dip
nodig), zelfde categorie als de binnenplaats-lantaarns en de
Stroomuitval-buitenverlichting (§6.5) — dit houdt het lichtbudget
voorspelbaar: 23 → 24, één permanente toevoeging voor de hele
feedbackronde (T52-56 voegt verder GEEN lichten toe).

### 6.13 Ontsnapping verhuist + periodieke vensters (beslissingen 44 en 45)

**44 — verhuizing is een pure positie-wijziging.** T45's
`toonOntsnappingspuntIndienKlaar()` bouwt het interactiepunt al op een
expliciete `x`/`z` — T53 vervangt alleen de bron
(`kelderluikMesh.position` → de T52-vlonder-/bootcoördinaten). Geen
ander gedrag verandert: prijs, prompt-structuur, winscherm-flow blijven
identiek. Dit isoleert het risico tot precies één test-assertie (de
kelderluik-positie-check in `test-ontsnapping.mjs`), dezelfde discipline
als eerdere positie-/tellingwijzigingen in dit project.

**45 — golf-gating ALS TOEVOEGING, niet als vervanging.** De feedback
vroeg om een ronde-gebonden ontsnappingsvenster (vanaf golf 10, dan
elke 4 golven), maar noemde de bestaande 3/3-onderdelen-eis niet.
Beslissing: BEIDE voorwaarden gelden — de boot moet er zijn (golf-gate,
T54) ÉN de speler moet klaar zijn (3/3 + geld, bestaand T45-contract).
Dit is een bewuste ontwerpkeuze (hier expliciet gedocumenteerd zodat
'm kan worden teruggedraaid als de gebruiker liever alleen golf-gating
wil, zonder de onderdelen-eis): het beloont vooruitplannen — ben je
niet op tijd klaar voor golf 10, dan wacht je gewoon tot golf 14. De
golf-voorwaarde wordt een PURE, tabel-testbare functie
(`isOntsnappingsGolf`), zelfde stijl als `isEventGolf` — geen state,
alleen golfnummer in, boolean uit. De venster-open/-dicht-logica hangt
aan de AL BESTAANDE `startGolf()`/`updateGolf()`-haakpunten (geen
nieuwe game-loop-tak nodig), zelfde patroon als T44's
`toonVluchtOnderdelenIndienDrempel()`.

### 6.14 Boot-aankomst: tell vóór mechaniek (beslissing 46)

Zelfde les als T30/T31 (aanvals-state-machine vs. tells): de mechaniek
(wanneer is het venster open, wanneer verschijnt het interactiepunt) en
de PRESENTATIE (hoe merkt de speler dat) zijn bewust twee tickets. T55
introduceert een korte aankondigingsfase VOORDAT het interactiepunt (en
dus de "Druk T"-prompt) verschijnt — rechtstreeks antwoord op "je niet
meteen ontsnapt ziet staan". De aankondiging zelf hergebruikt
uitsluitend bestaande patronen (banner, `piep()`, lampflikker) — geen
nieuwe presentatie-infrastructuur.

### 6.15 Vluchtroute-onderdelen: rustvlak i.p.v. zwevend, en één group om samen te verdwijnen (beslissing 47)

Dezelfde categorie fout als de zwevende barricadeplanken (eerder deze
sessie gefixt, zie de git-historie): een los object zonder duidelijk
draagvlak leest niet als "hier ligt iets om op te rapen". T56 voegt een
klein rustvlak per onderdeel toe — geen nieuwe systemen, alleen een
extra mesh per `bouw*Mesh()`-functie (Ticket 44). Blijft binnen het
bestaande perf-budget (§5.10/§6.9): drie kleine, statische
toevoegingen, geen nieuwe lichten of per-frame writes buiten de al
bestaande puls-cyclus.

**Uitbreiding ná tweede feedbackronde:** het rustvlak wordt
een KIND van dezelfde `THREE.Group` als het item-mesh zelf
(`onderdeel.mesh`), niet een los, blijvend object ernaast. Dat is
bewust: `raapVluchtOnderdeelOp()` (Ticket 44) doet nu al
`wereld.remove(onderdeel.mesh)` — door het rustvlak in diezelfde group
te hangen, verdwijnt het COMPLETE stukje decor (item + krat/plank/
vensterbank) automatisch in één keer bij het oprapen, zonder dat die
functie zelf ook maar één regel hoeft te veranderen. Dit is exact het
"geen nieuwe mechaniek, alleen de juiste plek in de bestaande
group-hiërarchie"-principe dat dit project al vaker toepast (bv. de
winkelMarkering-ring+icoon-group, §5.7).

### 6.16 Zwevende barricadeplanken elders: audit (beslissing 48)

De binnenplaats-fix (`VENSTERS_PLAATS`, `basisY`-override in
`bouwBarricade()`) loste het probleem alleen daar op. Twee screenshots
van de gebruiker (golf 6) tonen dat hetzelfde soort visuele mismatch
zich elders voordoet. Vooronderzoek voor Ticket 57:

- **`VENSTERS`/`VENSTERS_KAMER2`** (woonkamer resp. atelier) delen
  hetzelfde kozijn (`BoxGeometry(1.3, 1.6, 0.12)` op y=1.9 → opening
  y≈1.1-2.7). De standaard-plankstapel (y=1.2/1.6/2.0, spant
  1.14-2.06) past daar wél BINNEN de opening — geen letterlijke
  overshoot — maar laat ~0.6m kozijn/glas zichtbaar BOVEN de planken,
  wat ook als "niet kloppend" kan ogen.
- **`VENSTERS_BIJKEUKEN`** (de "steegdeur") heeft HELEMAAL GEEN eigen
  kozijn-mesh — de barricade hangt daar zonder enig omlijnend
  referentiepunt. Dit is de sterkste kandidaat voor een letterlijk
  "zweeft in het niets"-effect, en dus vermoedelijk wat de screenshots
  laten zien.

Ticket 57 is bewust een AUDIT-ticket, geen blinde fix: eerst
reproduceren met de exacte HUD-staat uit de screenshots (golf 6,
Vluchtroute 1/3), dan alle overgebleven vensters visueel narekenen, en
per gevonden mismatch dezelfde `basisY`-mechaniek toepassen die de
binnenplaats-fix al introduceerde — geen nieuwe infrastructuur nodig,
alleen zorgvuldig per-venster narekenen wat de binnenplaats-ticket
(destijds) niet deed.

### 6.17 Hagelketel naar de Backlog

Op verzoek van de gebruiker staat de Hagelketel (T47/T48,
ontwerpbeslissingen 38-39, §6.6) NIET meer in de actieve ronde. §6.6
blijft ongewijzigd staan als ontwerpreferentie (mocht dit ooit
terugkomen — zie ROADMAP.md's Backlog-sectie); de
performance-/risicobudgetten hierboven (§6.9-6.11) zijn bijgewerkt om
de Hagelketel NIET meer mee te rekenen — de lichttelling 23→24 komt nu
van T52's lantaarn, niet van een wapenvlam.

## 7. Fable-architectuurronde 5 (v0.19) — Visuele/ruimtelijke diepte, AI en oriëntatie

### 7.1 Scope en aanleiding

Deze ronde is een reactie op een expliciete gebruikersopdracht met 9
verbeterpunten uit 5 categorieën (Graphics, Ruimtes & leveldesign,
Vijanden & AI, Audio & sfeer, UI/UX & feedback). Dit is een
**architectuur-/ticketronde, GEEN implementatieronde**: er wordt in
deze stap geen regel code in `amsterdam-undead.html` aangeraakt. De
tickets (58-68, ROADMAP.md) en Sonnet-prompts (ronde 5,
SONNET_EXECUTION_PLAN.md) staan klaar om — één voor één, op
toekomstige expliciete opdracht — uitgevoerd te worden.

De 9 punten zijn vertaald naar 5 "Verbetergebieden" voor deze ronde
(nummering per-ronde, net als in rondes 2-4):

1. **Visuele kwaliteit** — art direction, materiaaldiepte,
   post-processing, silhouetten (Graphics-categorie, T58-T61).
2. **Ruimtelijke diepte** — verticaliteit via een nieuwe kelderzone
   (T62-T63).
3. **Vijandintelligentie** — waypoint-navigatiegraaf i.p.v. de
   ad-hoc chokepoint-code van ronde 4 (T64-T65).
4. **Sfeer/audio** — achtergrondmuziek (T66).
5. **Spelerfeedback & oriëntatie** — minimap + richtingsfeedback bij
   schade (T67-T68).

Ticketrange: **T58-T68** (ROADMAP.md). Beslissingrange: **49-60**
(deze sectie). Sonnet-promptrange: SONNET_EXECUTION_PLAN.md,
"ronde 5 (v0.19)", waarschuwingen **32 e.v.**

### 7.2 Codekaart — nieuw relevante gebieden voor deze ronde

- **Materialen**: `MATERIAAL_FAMILIES`/`matFamilie(naam, kleur)`
  (regel ~559-575) — een klein aantal gedeelde, immutable
  `MeshStandardMaterial`-varianten (o.a. `steen` als fallback) met
  vaste ruwheid/metaalwaarden per familie, gecachet via
  `matFamilieCache`. T58/T59 bouwen hier bovenop, niet omheen.
- **Renderer/scene-opzet**: de huidige render-loop gebruikt een kale
  `renderer.render(scene, camera)` (geen composer). T60 introduceert
  hier de enige plek waar dat verandert.
- **Speler/beweging**: `speler.positie` (regel ~2348 e.v.) heeft in
  de bestaande code uitsluitend x/z-mutaties tijdens normale
  gameplay; `speler.hoogte = 1.7` is een vaste oog-hoogte-offset bij
  het renderen, geen echte Y-positie. Botsingen
  (`registreerRechthoek`, `losBotsingenOp`, `isVrijePlek`) zijn
  volledig 2D (X/Z-rechthoeken, Y-onwetend). T62 moet hiermee
  rekenen.
- **Zone-navigatie**: `zoneVan()` (regel 4037), `ZONE_GRAAF` (4072),
  `NAV_VOLGENDE`/`herbouwNavTabel()` (4094-4118) — een kleine
  handgeschreven BFS-graaf die uitsluitend CROSS-zone routing regelt;
  binnen een zone loopt een ondode altijd in een rechte lijn naar de
  speler. Dat "rechte lijn binnen een zone"-gedrag is precies wat de
  twee bugs van deze sessie veroorzaakte (`GRACHTGANG_DREMPEL`,
  `eigenInGracht`/`spelerInGracht`/`inZoneVier`, regel 4204-4228).
  T64/T65 vervangen dit ad-hoc lappendeken door een generieke
  intra-zone waypointgraaf.
- **Audio-graaf**: de "dreigingsaudio"-drone (regel 3135-3172,
  `dreigingsGainNode`/`zetDreigingsGain()`) is een permanente
  oscillator/gain-laag die NOOIT gestopt of herstart wordt, alleen
  via `gain.setTargetAtTime()` aangestuurd. Dit is het architecturale
  sjabloon voor T66's achtergrondmuziek.
- **Effecten-pools**: `tracerPool`/`impactPool` (regel 2957-2959)
  zijn vooraf aangemaakte, vaste-grootte object-pools, hergebruikt
  per hit i.p.v. `new` per frame. Sjabloon voor T68's DOM-wedge-pool.
- **HUD-structuur**: alle HUD-elementen zijn losse, vooraf in de HTML
  gedeclareerde `<div>`'s (regel 390-410, bv. `hudUI`, `vignet`,
  `zoneLabelUI`) die via `style.display`/tekst worden aangestuurd —
  geen canvas-UI, geen framework. T67 (minimap) en T68
  (richtingsfeedback) volgen dit patroon (een nieuwe `<div>`/
  `<canvas>` erbij, geen nieuwe renderlaag).

### 7.3 Verhouding tot de "geen frameworks/assets/textures"-regel (beslissing 49)

CLAUDE.md en SONNET_EXECUTION_PLAN.md's architectuurregels verbieden
letterlijk "textures/modellen" en "nieuwe dependencies, textures,
modellen of audio-bestanden". Twee van de gevraagde punten
(materiaaldiepte, post-processing) lijken daarmee op gespannen voet
te staan. De interpretatie voor deze ronde — die T58-T60 letterlijk
zo uitvoeren — is:

- De regel is bedoeld om **extern geladen, netwerk-afhankelijke
  binaire assets** (afbeeldingsbestanden, 3D-modellen, audiobestanden
  van een CDN/bestandssysteem) en **derde-partij-frameworks** buiten
  de deur te houden — niet om Three.js' eigen, in de bestaande
  importmap al aanwezige bouwstenen te verbieden.
- **Textures/materiaaldiepte (T59)** wordt dus NIET met
  `TextureLoader`+een PNG/JPG gedaan, maar met **procedureel
  gegenereerde `THREE.CanvasTexture`** — getekend met de 2D Canvas
  API, at runtime, zonder enig bestand op schijf of CDN. Dit blijft
  single-file en zelfstandig, exact zoals de bestaande
  `matFamilie()`-aanpak.
- **Post-processing (T60)** wordt gedaan met Three.js' eigen
  `examples/jsm/postprocessing/*`-submodules (`EffectComposer`,
  `RenderPass`, `UnrealBloomPass` of een vergelijkbare ingebouwde
  pass), geladen via **dezelfde bestaande CDN-importmap-host** als de
  kern-`three.module.js` (géén nieuwe CDN, géén nieuwe dependency-
  registratie, wél een nieuwe importmap-entry naar een module die al
  onderdeel is van hetzelfde Three.js-pakket). Dit is bewust GEEN
  derde-partij-postprocessing-library.
- Beide beslissingen worden hier expliciet vastgelegd zodat dit geen
  stille regelovertreding is maar een beargumenteerde uitzondering:
  "geen assets" = geen extern geladen binaire bestanden, niet "geen
  enkele visuele verrijking".

**Uitvoeringsnotitie (T58-60, geïmplementeerd):** deze interpretatie
botste in de praktijk met een EERDERE, expliciete beslissing in de code
zelf: Ticket 38's commentaar bij `MATERIAAL_FAMILIES` stelde destijds
letterlijk "geen textures — CLAUDE.md verbiedt ook canvas-gegenereerde".
Dit is dus niet stilzwijgend overschreven — de gebruiker is hierover
expliciet geraadpleegd (drie opties voorgelegd: strikte lezing
aanhouden, losse lezing gebruiken zoals hierboven, of T59 on hold
zetten) en koos voor de losse lezing uit deze sectie. Dat is nu de
geldende interpretatie voor het hele project, niet alleen voor deze
ronde.

### 7.4 Verbetergebied 1 — Visuele kwaliteit

#### 7.4.1 PALET-systeem en art direction (beslissing 50)

Een consistente art direction wordt vormgegeven als een klein,
centraal **PALET**-object (vergelijkbaar met `MATERIAAL_FAMILIES` qua
opzet): een handvol benoemde kleurgroepen (bv. `PALET.steenwarm`,
`PALET.metaalkoud`, `PALET.hout`, `PALET.accentDreiging`,
`PALET.accentVeilig`) die de bestaande losse hex-kleuren in
bouwfuncties (`bouwAchterGevel`, `bouwLantaarn`, etc.) geleidelijk
vervangen. Dit is een **opt-in refactor, geen big-bang**: T58 raakt
alleen de nieuwe/gewijzigde call-sites die het ticket zelf aanwijst
(gevel- en straatkleuren), niet elke kleur in het bestand — een
volledige omzetting is expliciet buiten scope om regressierisico op
bestaande, al goedgekeurde scenes te vermijden.

**Geïmplementeerd als:** `gevelKoud`/`gevelWarm` (arrays van resp. 3/2
bijna-zwarte gevelbasistinten), `raamWarmAmber`/`raamWarmZacht`/
`raamKoelBlauw`/`raamKoelLicht` (de 3 bijna-identieke warme raamtinten
van vóór deze ronde samengevoegd tot 2), `straatNat`/`straatPlas`.
Toegepast op de 5 `bouwAchterGevel()`-aanroepen + klinkers + plassen.

#### 7.4.2 Procedurele texturen (beslissing 51)

Materiaaldiepte komt van een kleine set **runtime-getekende
`CanvasTexture`s** (bv. een subtiel steen-ruis-patroon, een
houtnerf-patroon, een geborsteld-metaal-gradient), elk eenmalig
getekend op een klein canvas (max ~128×128) bij scene-opbouw en
daarna gecachet — zelfde cachingfilosofie als `matFamilieCache`. Ze
worden gekoppeld aan de bestaande `MATERIAAL_FAMILIES`-varianten via
een nieuw `map`/`roughnessMap`-veld, dus bestaande call-sites van
`matFamilie()` hoeven niet te wijzigen. Zie §7.3 voor de
regel-interpretatie.

**Geïmplementeerd als `roughnessMap`, niet `map`:** een `map` (albedo)
vermenigvuldigt de basiskleur per pixel met de textuurwaarde — bij een
gemiddeld-grijze textuur zou dat alle bestaande, al goedgekeurde scenes
merkbaar verdonkeren. Een `roughnessMap` raakt de kleur niet; met een
bijna-witte textuur (205-250 van 255) blijft `roughness * textuur.g`
dicht bij de oorspronkelijke waarde, met alleen een subtiele lokale
variatie. `hout`/`steen`/`metaal` kregen elk een eigen 128×128-patroon
(`repeat.set(4,4)`); `tegel`/`natSteen` blijven ongewijzigd (buiten
scope, zoals gepland).

#### 7.4.3 Post-processing-pipeline (beslissing 52)

Eén `EffectComposer` met een klein, vast aantal passes (RenderPass +
maximaal één subtiele bloom/vignet-achtige pass) vervangt de kale
`renderer.render()`-call in de hoofdloop. Belangrijk
architectuurpunt: de composer moet **resize-bewust** zijn (huidige
`onresize`-handler moet ook `composer.setSize()` aanroepen) en mag
**geen tweede shadow-pass** introduceren — het bestaande
`schaduw === 1`-invariant (1 shadow-castende light in de hele scene)
verandert niet. CDN-risico: de postprocessing-submodules moeten via
dezelfde CDN-host als de kern-Three.js-versie geladen worden;
bestaat die combinatie niet, dan is dit ticket geblokkeerd tot een
werkende importmap-entry gevonden is (zie SONNET_EXECUTION_PLAN.md-
waarschuwing 32).

**Uitvoeringsnotitie:** de live CDN was vanuit de ontwikkelomgeving niet
direct bereikbaar (netwerkbeleid blokkeert directe curl/fetch-checks
naar `cdn.jsdelivr.net`); geverifieerd is in plaats daarvan dat het
lokale `three@0.160.0`-npm-pakket (dat de tests al gebruiken om de CDN
te onderscheppen) `examples/jsm/postprocessing/*` 1-op-1 bevat voor
exact de gepinde versie — jsdelivr serveert npm-pakketten direct, dus
dit is sterke indirecte bevestiging. `EffectComposer` + `RenderPass` +
`UnrealBloomPass` + `OutputPass` zijn toegevoegd via een nieuwe
`three/addons/` → `.../examples/jsm/`-importmap-entry.
**Belangrijke tuning-correctie:** `UnrealBloomPass` werd eerst
geïnitialiseerd met de volledige schermresolutie als interne
bloom-resolutie — dat bleek de blur-mipchain (5 niveaus) onnodig zwaar
te maken en verlaagde de framerate merkbaar in het headless/software-
gerenderde testklimaat, genoeg om twee wall-clock-timinggevoelige
bestaande tests te doen haperen (de gameLoop's dt-cap van 0.05s/frame
laat gesimuleerde tijd sneller achterlopen bij lagere fps). Gefixt door
een kleine VASTE interne resolutie (256×256, de eigen default van de
pass) te gebruiken — in een echte, hardware-versnelde browser is het
verschil verwaarloosbaar, maar dit is nu wel de vaste, bewuste keuze.

#### 7.4.4 Vloeiendere silhouetten (beslissing 53) — VOORZICHTIG

Ondode- en wapenmodellen bestaan uit simpele primitieve geometrieën
(boxen/cilinders/cones). "Vloeiender" wordt hier NIET bereikt met
nieuwe geometrie-types of hogere polycount an sich, maar met:
gestapelde/afgeschuinde vormen (bv. `THREE.CylinderGeometry` met
meer radiale segmenten op zichtbare randen, kleine
`bevelSegments`-achtige overgangen via extra tussen-primitieven) en
zachtere materiaal-shading. **Hard contract**: de
hoofd-hoogte-anker (beslissing 16) — de Y-positie van de
head-group — en alle hitbox-mesh-schalen mogen NIET veranderen. Elke
silhouet-wijziging is dus puur cosmetisch, nooit een
transform-wijziging op een object dat ook hitbox-detectie draagt. Dit
ticket wordt gemarkeerd VOORZICHTIG en moet los van elk ander ticket
worden uitgevoerd, met een voor/na-screenshot én een
hitbox-regressietest.

**Geïmplementeerd als:** voor de ondoden uitsluitend hogere
segment-aantallen op bestaande `SphereGeometry`s (hoofd, ogen, bochel,
buik, kern) — straal/positie van elk deel ongewijzigd. Voor de wapens
(die GEEN hitbox dragen — nooit geraycast als treffer-doel, zie
`schiet()`) is de scope bewust ruimer: cilinders kregen meer segmenten
en de twee grepen zijn van `BoxGeometry` naar `CapsuleGeometry`
omgezet (zelfde lengte, natuurlijker rond handvat). De Ratelaar's
identiteitsbepalende blokkerige chassis/magazijnkast/kolf (Ticket 34)
zijn bewust ongewijzigd gelaten — die "boxy"-vorm is zelf een
ontwerpkeuze, geen toevallige hoekigheid om weg te polijsten.

**Bugfix ontdekt tijdens implementatie:** met het hoofd op 20×16
segmenten (was 8×8) bleken de twee oogbolletjes — die op hun oude
positie al net binnen de bolstraal lagen (afstand 0.153 tegen straal
0.18) — volledig onder het gladdere oppervlak te verdwijnen. Bij het
oude lage-poly-hoofd waren ze zichtbaar dankzij een facet-deuk in het
oppervlak op precies die plek; die deuk verdween met de vloeiendere
tessellatie. Opgelost door de oog-z (lokaal, t.o.v. het hoofdcentrum)
van 0.14 naar 0.165 te verplaatsen (nieuwe afstand ≈0.171, net onder
de straal) zodat de ogen weer zichtbaar op het oppervlak liggen. Dit
is de enige positie-wijziging in dit ticket; ze raakt uitsluitend de
zeer kleine (straal 0.02) oog-hitbox-regio, niet het hoofd zelf of het
hoofd-hoogte-anker, en is dus geen schending van het hard contract
hierboven — wel een bewuste, hier gedocumenteerde afwijking van het
"alleen segmenten aanpassen"-plan.

### 7.5 Verbetergebied 2 — Ruimtelijke diepte

#### 7.5.1 Kelder: geometrie en Y-beweging (beslissing 54)

Een nieuwe kelderzone krijgt een **eigen, disjuncte X/Z-footprint**
buiten de bestaande `GRENS`-rechthoek (dus geen overlap met bestaande
kamers/binnenplaats), bereikbaar via een vaste trap-corridor met een
**deterministische Y-ramp**: binnen een smal, vooraf vastgelegd
X/Z-band interpoleert `speler.positie.y` lineair tussen 0 (begane
grond) en een vaste kelderdiepte (bv. -2.6), puur als functie van de
positie langs de trap-as — geen zwaartekracht, geen sprong-fysica,
geen algemene 3D-collision. Buiten die band blijft `positie.y` exact
zoals nu: ongebruikt/impliciet 0. Dit is bewust de MINIMALE ingreep
in de 2D-collision-architectuur, niet een generieke Y-physics-laag.
`GRENS` zelf wordt niet aangepast; de kelder-footprint krijgt een
eigen lokale grenscontrole binnen de trap-/kelderfuncties.

**Geïmplementeerd als:** een trapband op vaste Z (`KELDERTRAP_CZ =
−21.8`, breedte 1,2 m) die vanaf een nieuw deurgat in de westmuur van
de atelier-nis (`KAMER2_NIS_X_WEST`) verder naar het westen loopt
(`KELDERTRAP_X_OOST` → `KELDERTRAP_X_WEST` → `KELDER_X_WEST`), ruim
voorbij `GRENS.minX` (−11.45). De locatie is bewust gekozen op verzoek
van de gebruiker (atelier-westhoek, niet de bijkeuken) en omdat de
nis-westmuur toch al de smalste afstand tot een GRENS-rand heeft —
een korte, natuurlijke oversteek naar disjuncte kaartruimte.
**Herziening tijdens implementatie:** de eerste versie deelde de
footprint bewust met de binnenplaats-vloer (zie het rollback-relaas
in ROADMAP.md Ticket 62) — dat bleek een directe schending van de
"buiten GRENS"-eis hierboven én de reden dat de nieuwe geometrie
onzichtbaar bleef (verscholen onder/tussen bestaande binnenplaats-
vloer en -decor). Na verplaatsing naar de echt disjuncte nis-westkant
kregen de trap-/kelderwanden gewone `registreerRechthoek()`-obstakels
(in plaats van "bewust geen nieuwe obstakels" uit de eerste versie) —
correct, want dit stuk kaart deelt zijn X/Z nu met niets anders.
**Lokale grenscontrole, speler-only:** `losBotsingenOp(positie,
straal, magKelderBinnen = false)` kreeg een derde, optionele
parameter. Alleen de speler-aanroep in `updateSpeler()` geeft
`magKelderBinnen = true` door; alle drie de ondode-aanroepen in
`updateOndoden()` laten dit weg (blijft `false`), dus `GRENS.minX`
blijft voor ondoden altijd hard — geen enkele kan de trapband ooit in,
ook niet direct achter de speler aan. Dit loopt vooruit op de
"geen ondode kan er ooit binnenkomen"-eis van beslissing 55 hieronder,
al is de formele veilige-zone-status zelf pas Ticket 63.
**Toegang via deur 5 (scope-uitbreiding op verzoek):** de trap is
niet vanaf het begin open — een nieuwe koopbare deur (`deur5`, €900,
zelfde mesh/klink/obstakel/interactiePunt/WINKEL_STIJLEN-patroon als
deuren 1-4) blokkeert de opening tot aankoop, naast de bestaande
deur 2 (binnenplaats) als vroege strategische keuze.

**Herziening v3 (op verzoek): grondplan = nis+atelier, i.p.v. een eigen
disjuncte footprint.** De gebruiker vroeg direct na oplevering om een
veel grotere kelder ("onder het atelier", ongeveer atelier-formaat of
+10% groter, plafondhoogte ≈ `KAMER_HOOGTE`). Een letterlijke
+10%-schaling rond hetzelfde midden bleek bij verificatie overal
bestaande muren te raken (atelier-noord/oost/zuid, gang-zijmuren) —
dus is het bestaande, al-ommuurde nis+atelier-L-vorm-grondplan zelf
hergebruikt (177 m², ruim groter dan het atelier alleen) als de
veilige invulling. De trap draait 180°: vanaf dezelfde deur 5 daalt hij
niet meer wég van de nis (het lege westen van v2), maar juist ín de
nis (oostwaarts) — `berekenKelderY(x,z)` checkt nu eerst of `(x,z)`
binnen het nis- óf atelier-grondplan valt (anders altijd 0), en past
daarbinnen dezelfde lineaire X-interpolatie toe tussen
`KELDERTRAP_X_BOVEN` (bij de deur, Y=0) en `KELDERTRAP_X_ONDER`
(Y=-`KELDER_DIEPTE`, ruim binnen de nis). `KELDER_DIEPTE` ging van 2,6
naar 3,3 m (moet > `KELDER_HOOGTE` blijven, anders steekt het plafond
door de atelier-vloer heen); `KELDER_HOOGTE` van 2,3 naar 3,2 m.

Dit deelt wéér bewust de X/Z-footprint met een bestaande ruimte — net
als de foute v1, maar ditmaal correct, om twee redenen die v1 allebei
miste: (a) de vloer van nis/atelier zelf blijft volledig intact — de
trap in de nis-westmuur is de ENIGE verbinding tussen boven- en
ondergronds, dus geen enkel zichtbaarheidsrisico (je kunt de kelder
nooit "erdoorheen" zien vanaf de begane grond, alleen bereiken via de
trap); (b) de bestaande, al-geregistreerde nis/atelier-muren zijn
Y-blind en begrenzen de kelder dus "gratis" op elke Y — de drie oude
`kelderWand()`-obstakels (west/noord/zuid van de kleine v2-kelder) zijn
daarom verwijderd (obstakel-totaal 43 → 40); wat overblijft is zuiver
zichtbare "huid" (`kelderVisueleWand()`, geen `registreerRechthoek()`)
op de exacte plek van de zes echte wand-segmenten (nis-west, nis-zuid,
atelier-noord, -oost, -zuid, en de binnenhoek tussen nis en atelier).

**Y-aanname-audit, ronde 2 — een échte bug ditmaal.** Deze herziening
onthulde iets wat v2 nog niet raakte: `updateInteracties()` en
`updateWinkelMarkeringen()` (winkelLicht-nabijheid) waren altijd al
X/Z-only — Y was overal impliciet 0, dus onschuldig zolang niets
underground lag. Zodra de kelder dezelfde X/Z deelt met het atelier
erboven, zou een kelder-interactiepunt zonder correctie ook vanaf de
begane grond bruikbaar zijn — precies de bugklasse die §7.9 al als
risicogebied benoemde. Fix: een nieuwe `KELDER_Y_MARGE`-constante
(1 m, ruim minder dan `KELDER_DIEPTE`) laat beide functies kandidaten
overslaan waarvan `|puntY − spelerY|` die marge overschrijdt — 100%
no-op voor elk bestaand (boven-grond) punt, en exact de eigenschap die
nodig is voor de Pantserdrank-verplaatsing hieronder.

**Pantserdrank verplaatst naar de kelder** (op verzoek, §7.5.3-achtige
inhoud vooruitgehaald uit Ticket 63): `PANTSERDRANK_X`/`_Z` blijven
ongewijzigd (die waren toch al relatief aan het atelier, en vallen nu
vanzelf binnen de kelder-footprint); alleen de Y van mesh, markering en
interactiePunt verschuift naar `-KELDER_DIEPTE`. Geverifieerd: vanaf
dezelfde X/Z op de begane grond reageert het punt niet meer (dankzij
`KELDER_Y_MARGE`), alleen op de kelderdiepte zelf.

**Lichten:** de kleine v2-kelder had genoeg aan 1 lamp; de ~4× grotere
v3-ruimte kreeg er een tweede bij (nis-deel + atelier-deel) —
lichttelling 26 → 27.

**Bugfix v4: `berekenKelderY()` kan sinds v3 principieel niet meer puur
functioneel zijn — dat werd pas ná oplevering, via een gebruikersmelding,
duidelijk.** Zolang de kelder-footprint disjunct was (v1-v3-ontwerp,
vóór de v3-herziening hierboven), was "puur functie van (x,z)" een
correcte aanname: die footprint bestond nergens anders, dus elke
`(x,z)` had precies één geldige Y. Zodra v3 het hele nis+atelier-
grondplan hergebruikte, werd die aanname stilzwijgend ongeldig: dezelfde
`(x,z)` bestaat nu op TWEE geldige Y's (atelier-vloer=0 vanaf de gang,
keldervloer=`-KELDER_DIEPTE` vanaf de trap) — en een pure functie van
alleen de huidige positie kan die twee per definitie niet uit elkaar
houden. Het concrete symptoom: elk punt binnen het atelier voldeed toch
al aan `x >= KELDERTRAP_X_ONDER` (de nis-brede trap-drempel), dus wie
via de normale route (startkamer → gang → atelier, niets met deur 5 of
de trap te maken) het atelier binnenliep, "viel" meteen naar de
kelderdiepte.

**Fix: `spelerInKelder`-state**, module-scoped, bijgewerkt UITSLUITEND
binnen de smalle trapband zelf (`z` binnen `KELDERTRAP_CZ ±
KELDERTRAP_HALF_BREEDTE`, de enige plek die nog wél ondubbelzinnig is —
niets anders in het spel deelt die band). Binnen de trapband: bij
`x <= KELDERTRAP_X_BOVEN` wordt de state `false` (en Y=0); bij
`x >= KELDERTRAP_X_ONDER` wordt de state `true` (en Y=`-KELDER_DIEPTE`);
daartussen interpoleert Y lineair en volgt de state de dichtstbijzijnde
kant (`fractie >= 0.5`). Buiten de trapband — de rest van nis+atelier,
waar de ambiguïteit optreedt — levert de functie puur de laatst bekende
state terug; verlaat de speler het hele nis+atelier-grondplan (kan
alleen via de gang-opening, Y-blind net als alle obstakels), dan wordt
de state expliciet `false` geforceerd, zodat een latere herintrede via
diezelfde gang nooit een "vastzittende" kelder-state kan meenemen.

Dit is een bewuste afwijking van de oorspronkelijke "puur functioneel,
geen state"-eis uit de allereerste §7.5.1-tekst — die eis was correct
voor het toen bedoelde ontwerp (disjuncte footprint), maar is
principieel onhaalbaar geworden zodra een latere herziening (op
verzoek) de footprint met een bestaande ruimte liet delen. Geverifieerd
met een gesimuleerde speelsessie (startkamer → gang → atelier/nis,
zonder de trap aan te raken: Y blijft overal exact 0) en een volledige
heen-en-terug-reis via de trap (0 → `-KELDER_DIEPTE` → weer 0, state
klopt bij elke stap) — zie de nieuwe checks in `tests/test-kelder-trap.mjs`.

**Herziening v5 — de gedeelde footprint is definitief losgelaten; dit is
de blijvende conclusie van dit ticket.** De v4-state-fix loste het
"vallen via de gang"-geval op, maar niet het onderliggende probleem: de
trapkoker liep in v3/v4 vanaf de nis-westmuur oostwaarts de nis ín, en de
nis is vrij beloopbaar — dus liep je zonder deur 5 te kopen gewoon de
trap op. Om dát te repareren zou de koker op de begane grond ommuurd
moeten worden, maar de bodem ervan moet juist open zijn naar de kelder,
op precies dezelfde X/Z. Dat vraagt obstakels die per verdieping
verschillen (Y-bewuste collision) — exact de generieke 3D-laag die dit
ticket expliciet buiten scope houdt.

**De generaliseerbare les:** in deze codebase kan een ruimte alleen
onder een andere ruimte liggen als je bereid bent de complete
collisionlaag Y-bewust te maken. Zolang obstakels, `GRENS`,
`losBotsingenOp()` en `isVrijePlek()` 2D zijn, moet elke nieuwe
verdieping een **disjuncte X/Z-footprint** hebben — niet als voorkeur,
maar als harde randvoorwaarde. De oorspronkelijke §7.5.1-eis was dus
correct; de twee bugs kwamen allebei voort uit het loslaten ervan.

**Definitieve opzet:** trapkoker én kelderruimte liggen ten westen van
`KAMER2_NIS_X_WEST`, volledig buiten `GRENS`, waar geen enkele andere
geometrie staat. De ruimte is 15 x 9,9 m = 148,5 m² (= atelier + 10%,
de gevraagde schaal) met `KELDER_HOOGTE = KAMER_HOOGTE`.
`berekenKelderY()` is weer volledig puur; `spelerInKelder` is verwijderd.
De eerste regel van die functie (`if (x >= KELDERTRAP_X_BOVEN) return 0`)
is meteen de structurele garantie dat Y nergens in het huis kan
veranderen — geverifieerd met een raster van 15.327 punten over de hele
bovengrondse kaart, zie `tests/test-kelder-trap.mjs`.

`KELDER_Z_NOORD` (−23,9) ligt bewust net binnen `GRENS.minZ` (−23,95):
de z-klem in `losBotsingenOp()` is NIET versoepeld, dus de ruimte moet
binnen die band passen. Alleen de x-klem kent een uitzondering, en die
geldt uitsluitend voor de speler (`magKelderBinnen`) binnen de
kelder-z-band — ondoden blijven altijd op `GRENS.minX` staan, ook na
aankoop van deur 5.

**Feedbackronde — helderheid ongeveer gelijk aan de startkamer.** Een
eerste poging verhoogde alleen de twee kamerlampen (12/8 → 18/10,
intensiteit/bereik). Een screenshot-vergelijking (speler naast een lamp,
kijkend naar de vloer) liet zien dat dit niet volstond: de stenen
basiskleuren (`KELDER_TINT` voor de muren, een aparte kleur voor de
vloer) waren zo donker (albedo bijna zwart) dat geen enkele
lichtsterkte ze zichtbaar liet oplichten — diffuse reflectie schaalt
met de albedo, dus een bijna-zwart oppervlak blijft bijna zwart onder
elke lichtsterkte. Fix: `KELDER_TINT` van `0x1c1a17` naar `0x4a443c`,
de keldervloer van `0x141210` naar `0x3d352c` (beide ~2,5-3x lichter).
Het plafond (`0x08090a`) bleef bewust ongewijzigd — plafonds zijn
overal in het spel opzettelijk bijna zwart (ook de startkamer:
`0x14100c`), dat is stijl, geen helderheidsbron waar de speler op let.

#### 7.5.2 Kelder als permanente veilige zone (beslissing 55)

De kelder wordt bewust **buiten `ZONE_GRAAF` gehouden** en krijgt
**geen spawn-vensters**: geen ondode kan er ooit spawnen of
binnenkomen. Dit is een expliciete architecturale keuze om de exacte
bugklasse van deze sessie (cross-zone-pathing-aannames die niet
kloppen voor een net-toegevoegde zone) NIET opnieuw te introduceren —
in plaats van de kelder als "nog een zone die overal in de
pathing-logica moet worden meegenomen", is het een permanente
safe-room die de bestaande AI/zone-code helemaal niet hoeft te weten.
`zoneVan()` mag een kelder-coördinaat herkennen (voor HUD/label-
doeleinden), maar niets in `ZONE_GRAAF`/`NAV_VOLGENDE`/
`updateOndoden()` mag ooit naar de kelder verwijzen.

**Ticket 63 bevestigde dit numeriek** in plaats van er iets aan te
wijzigen: alle vijf deuren kopen (worstcasescenario — elke
`VENSTERS_*`-array actief, de hele `ZONE_GRAAF` open), 27 ondoden
spawnen over alle vensters, en 600 simulatieframes draaien met een
speler die van zone wisselt (zodat elke ondode een cross-zone-
navigatiepad probeert, zie `tests/test-kelder-trap.mjs` sectie 10). Bij
elke tick geteld: nul ondoden ooit in de kelder-footprint/-trapband, en
geen enkele ondode ooit voorbij `GRENS.minX`. `zoneVan()`-herkenning van
de kelder is bewust NIET toegevoegd: de kelder toont voorlopig gewoon
"Het Atelier" in de HUD (§7.5.1's gedeelde-footprint-erfenis — de kelder
ligt weliswaar zelf disjunct, maar `zoneVan()` classificeert puur op
x/z-rechthoeken zonder Y, en de kelder-x/z valt toevallig nog niet onder
een eigen check). Een 6e zone-id toevoegen puur voor het HUD-label zou
`ZONE_NAMEN`/`ZONE_FLAVOUR`/spawn-weging/banner-logica moeten raken voor
een zuiver cosmetisch effect — dat woog niet op tegen het risico,
vandaar expliciet ongedaan gelaten (de ticket-tekst noemt dit "mag",
niet "moet").

#### 7.5.3 Kelderinhoud (beslissing 56)

De kelder kreeg een klein, eigen setje decor, passend bij het
Amsterdamse-grachtenhuis-thema: een wijnrek (rugpaneel + 3 planken met
flessen) tegen de westmuur, en een kratten-/vatstapel in de
zuidwesthoek — beide met ruime afstand tot de trap-uitgang en de
Pantserdrank-marker. Puur ruimtelijke/visuele verrijking, geen nieuwe
gameplaymechaniek: net als de bestaande `bouwKratten()`/`bouwVat()`
elders in het bestand hebben deze meshes geen collision (`kelderMeubel()`
is een eigen kleine helper, omdat de bestaande meubel-helpers een vloer
op y=0 aannemen — dezelfde reden waarom de kelder al een eigen
`kelderLamp()` had in plaats van `hangLamp()` te hergebruiken). Het
"optioneel één bestaand interactiepunt herplaatst"-deel van de
acceptatiecriteria was al vervuld: Pantserdrank staat sinds T62b al
midden in de kelderruimte. Geen nieuwe itemtypes.

#### 7.5.4 Herziening (feedback): gedeeltelijke instroom i.p.v. permanente
veiligheid (beslissing 55 herroepen)

**§7.5.2's "permanente veilige zone" is op expliciet verzoek weer
losgelaten** — de speler wilde dat zombies wél de kelder in kunnen
komen, maar niet allemaal tegelijk, en dat wie boven blijft door de
kaart loopt i.p.v. voor de deur te wachten. Gevraagd en gekozen (via
`AskUserQuestion`): (1) instroom = alleen ondoden die al dichtbij de
trap-ingang staan op het moment dat de speler afdaalt, (2) wie boven
blijft dwaalt rond in zijn eigen zone, (3) dit geldt al vanaf golf 1
(geen aparte veilige periode).

**Waarom dit niet vanzelf werkte door simpelweg de GRENS-bypass te
verruimen.** `zoneVan()` kent de kelder zelf geen eigen zone-id toe
(die deelt x/z met zone 2, het atelier — een blijvend gevolg van
§7.5.1's ontwerp). Zodra de speler ondergronds is, is `zoneVan(speler)`
dus nog steeds `2`. Voor een ondode die toevallig al in zone 2 staat,
was `eigenZone === spelerZone` dan `true`, en de bestaande
"rechtstreeks op de speler af"-tak stuurt zo'n ondode simpelweg naar
`speler.positie` — d.w.z. naar de dichte deuropening, waar hij door de
bestaande GRENS-klem blijft steken. Alle ondoden in zone 2 zouden dus
gelijktijdig naar diezelfde plek lopen en daar opstapelen: precies het
"niet direct wachten boven de trap"-probleem dat vermeden moest worden.

**Oplossing: een permanente per-ondode vlag i.p.v. een globale teller
of percentage.** Elke `ondode` kreeg drie nieuwe velden:
`magKelderBinnen` (bool, start `false`), `wanderDoel`/`wanderTimer`
(voor het dwaalgedrag). In `updateOndoden()`, vlak vóór de bestaande
`volgendeDeur`-berekening:

```js
const spelerInKelder = speler.positie.y < -0.05;
if (!ondode.magKelderBinnen && spelerInKelder) {
  const dx = positie.x - KAMER2_NIS_X_WEST, dz = positie.z - KELDERTRAP_CZ;
  if (dx * dx + dz * dz <= KELDER_NABIJ_AFSTAND * KELDER_NABIJ_AFSTAND) ondode.magKelderBinnen = true;
}
const wachtBoven = eigenZone === 2 && spelerInKelder && !ondode.magKelderBinnen;
```

`speler.positie.y < -0.05` is het enige signaal dat nodig is — Y is
verder overal exact 0, dus dit is ondubbelzinnig "de speler staat op de
trap of in de kelder" zonder enige nieuwe globale state. Zodra
`magKelderBinnen` eenmaal `true` is, blijft het dat **permanent** (geen
enkele plek zet het terug op `false`) — de ondode "kent" de trap dan
voorgoed, ook als hij later weer ver van de deur afdwaalt of de speler
weer boven komt. Dit is bewust een sticky per-ondode vlag en geen
per-frame herberekening: een herberekening zou een ondode die al
halverwege de trap staat plotseling weer kunnen uitsluiten zodra hij
toevallig niet meer "dichtbij" is volgens de afstandstest.

Voor `magKelderBinnen`-ondoden werkt de trap-mechaniek daarna exact als
bij de speler: `losBotsingenOp(positie, ONDODE_STRAAL, ondode.magKelderBinnen)`
geeft dezelfde GRENS-bypass door, en `positie.y = berekenKelderY(positie.x, positie.z)`
laat hem even soepel af-/opdalen (puur functioneel, geen state — zelfde
garantie als bij de speler, zie §7.5.1). De bestaande 3D-afstandscheck
voor windup/melee (`rechtstreeks = speler.positie - positie`, volledige
x/y/z) zorgt er *vanzelf* voor dat een boven-blijvende ondode nooit een
aanval tegen een ondergrondse speler kan starten: het Y-verschil alleen
al (≥ 1,65 m) ligt ruim boven `AANVAL_START_BEREIK` (1,4 m) — geen
aparte guard nodig.

**Dwalen i.p.v. wachten.** Voor `wachtBoven`-ondoden wordt `doelPunt`
niet `speler.positie` maar `ondode.wanderDoel`: een willekeurig punt
binnen dezelfde zone, gekozen door de nieuwe `kiesWanderDoel(positie, zone)`
(een punt op 2-6 m in een willekeurige richting, geaccepteerd als
`zoneVan(...) === zone && isVrijePlek(...)`, anders een nieuwe poging —
max. 6 keer). Geen aparte per-zone grensrechthoeken nodig: `zoneVan()`
en `isVrijePlek()` bestonden al en garanderen samen dat het doel zowel
bereikbaar als in dezelfde zone blijft. Het doel wordt om de 3-6
seconden (of zodra het bereikt is) opnieuw geloot. Cross-zone-verkeer
(ondoden die van een ANDERE zone naar zone 2 onderweg zijn omdat de
speler daar "is") blijft ongewijzigd via de bestaande
`NAV_VOLGENDE`-route lopen — dat is precies het gevraagde "boven
blijven lopen door de kaart" i.p.v. star op één plek te blijven staan.

**Waarom geen vaste cap/percentage/tijdklok** (de andere opties uit de
`AskUserQuestion`-ronde): die zouden een aparte teller of cooldown-state
nodig hebben gehad, los van waar ondoden al toevallig stonden — een
mooie balans, maar niet wat gevraagd werd. De gekozen aanpak is volledig
emergent: hoeveel ondoden er meekomen hangt puur af van hoeveel er
toevallig al bij de deur stonden op het moment van afdalen, precies
zoals gevraagd.

**Testresultaat:** `tests/test-kelder-trap.mjs` sectie 11 (7 nieuwe
checks): een dichtbij-ondode krijgt `magKelderBinnen` en gebruikt de
trap daadwerkelijk (komt voorbij het deurgat, `y < 0`); een
ver-weg-ondode krijgt het niet, blijft voor altijd geklemd op
`GRENS.minX`, beweegt merkbaar (dwaalt) en blijft daarbij altijd in zijn
eigen zone; en de permanentie van `magKelderBinnen` is expliciet
getest (blijft `true` nadat de speler weer boven is). Sectie 10 (de
oude "kelder blijft altijd leeg"-test) is qua code ongewijzigd gebleven
en slaagt nog steeds: die simuleert een speler die nooit ondergronds
komt, en voor dat scenario is er inderdaad niets veranderd. Volledige
regressie: 42/42 groen.

#### 7.5.5 Herziening (feedback): kelder-helderheid t.o.v. de woonkamer

**Feedback:** "Hoe fel is het licht in de kelder tijdens Stroomuitval?
ik wil dat dit ongeveer 5-10% donkerder is dan het atelier." Meting met
Playwright + pixel-helderheid (zelfde methode als elders in dit
document: schermafbeelding → gemiddelde luminantie van een
vloer-steekproef, `0.2126*r + 0.7152*g + 0.0722*b`) liet zien dat de
kelder tijdens een Stroomuitval destijds ~93% donkerder was dan het
atelier — geen 5-10%, een orde van grootte mis. Na deze meting is
gevraagd om in plaats daarvan te vergelijken met de **woonkamer** (de
beginruimte): "Ik wil dat de kelder ongeveer even licht is als de
beginruimte in normale en lichtuitval stand. is dat nu al zo? bekijk
dit en geef me dan opties." Ook dat bleek niet zo (kelder fors donkerder
in beide standen). Van de aangeboden opties (kleuren verder ophogen /
lampen sterker maken / gecombineerde aanpak) is gekozen: "Allebei, met
kleinere stappen in elk."

**Grondoorzaak:** materiaalkleur (albedo) is een harde bovengrens voor
haalbare helderheid — diffuse reflectie is multiplicatief met de
basiskleur, dus een donkere steenkleur kan nooit even licht ogen als
een lichte kleur bij gelijke belichting. De kelder-wanden (`KELDER_TINT`)
en -vloer waren aanzienlijk donkerder gekozen dan de woonkamer-kleuren,
wat samen met de al bestaande, per-lamp gedimde `stroomFactor`-vloer
(die kelderlampen precies zo hard liet dimmen als elke andere hanglamp)
de dubbele oorzaak was.

**Aanpak, in kleine stappen zoals gevraagd:** drie hefbomen tegelijk,
elk met een bescheiden stap, iteratief gemeten en bijgesteld:
1. `KELDER_TINT` (wanden) en de kelder-vloerkleur geleidelijk
   opgelicht: `0x4a443c → 0x7d7366 → 0x8c8171` (wanden),
   `0x3d352c → 0x6b5d4d → 0x7d6d5a` (vloer).
2. De twee kamer-hanglampen in de kelder iets sterker en met iets meer
   bereik: `intensiteit 18 → 22`, `bereik 10 → 10.5`.
3. Een nieuw, per-lamp mechanisme specifiek voor Stroomuitval-gedrag:
   `stroomVloer`.

**`stroomVloer`: dezelfde vloer-aanpak als `HEMISFEER_STROOM_VLOER` e.a.,
nu ook per lamp.** In plaats van kelderlampen tijdens een Stroomuitval
even hard te laten dimmen als alle andere lampen, krijgen de twee
kamerlampen een eigen, hogere dim-vloer:

```js
const stroomFactorVoorLamp = l.stroomVloer === undefined
  ? stroomFactor
  : l.stroomVloer + (1 - l.stroomVloer) * stroomFactor;
l.licht.intensity = l.basis * Math.max(l.minFactor, factor) * lampDipFactor * stroomFactorVoorLamp;
```

Dit is exact hetzelfde patroon als het bestaande
`HEMISFEER_STROOM_VLOER`/`EXPOSURE_STROOM_VLOER`/`BUITEN_STROOM_VLOER`
(`VLOER + (1-VLOER)*stroomFactor`), nu toegepast per lamp via een
optioneel veld op het `lampLichten`-item (`undefined` = geen effect,
bestaand gedrag ongewijzigd). Het cruciale voordeel van dit
vloer-patroon: het is wiskundig neutraal (`=1`) zolang `stroomFactor=1`
(normale stand), en heeft alléén effect zodra `stroomFactor` richting
zijn gedimde minimum zakt. `kelderLamp()` kreeg een optioneel
`stroomVloer`-argument dat wordt doorgegeven aan het `lampLichten`-item;
de trap-lamp laat dit argument weg (blijft bewust net zo dof als
voorheen — "klein beetje verlichting" bij de trap, zie §7.5.3).

**Eerdere misstap, zelf ontdekt en gecorrigeerd:** de eerste
implementatie gebruikte een onvoorwaardelijke `stroomExtra`-vermenigvuldiger
(`* (l.stroomExtra ?? 1)`) die **altijd** meetelde, ook in de normale
stand. Gecombineerd met de opgehoogde lampintensiteit en lichtere
kleuren schoot de normale-stand-helderheid daardoor fors door (kelder
werd ~35% líchter dan de woonkamer i.p.v. gelijk). Dit is bij de eigen
meting opgevallen vóórdat het aan de gebruiker werd voorgelegd, en
opgelost door over te stappen op de vloer-gebaseerde `stroomVloer` —
consistent met het bestaande codebase-patroon in plaats van een nieuw,
niet-neutraal mechanisme te verzinnen.

**Iteratieve afstelling** (kleine stappen, telkens opnieuw gemeten):
na meerdere rondes van bijstellen van kleur, lampintensiteit/-bereik en
`stroomVloer` (eindwaarde `0.36`, na tussenstappen `0.55` en `0.48`)
kwamen beide verhoudingen (kelder-luminantie / woonkamer-luminantie)
dicht bij 1,0 uit:
- **Normale stand:** kelder ~50,1 vs. woonkamer ~56,2 → ratio ~0,89
  (kelder ca. 11% donkerder — een redelijke "ongeveer" match).
- **Stroomuitval:** kelder ~10,3 vs. woonkamer ~10,3 → ratio ~1,01
  (nagenoeg exacte pariteit).

**Testresultaat:** `tests/test-stroomuitval.mjs` uitgebreid met:
sectie 1b (vóór elke Stroomuitval-activatie) bevestigt dat
`stroomVloer` geen enkel effect heeft zolang `stroomFactor === 1` (de
kelder-lampfractie en een gewone-lampfractie liggen binnen 0,15 van
elkaar — ruimer dan de `<0,02` van de niet-flikkerende
hemisfeer/exposure/buiten-checks, omdat kelderlampen wél een eigen
per-lamp flikker-fase hebben); sectie 4 bevestigt tijdens een actieve
Stroomuitval-tick dat er precies twee kelder-kamerlampen met
`stroomVloer === 0.36` zijn, dat hun fractie rond
`0,36 + 0,64×0,12 = 0,4368` ligt (`<0,1` tolerantie, zelfde
flikker-reden) en dat ze merkbaar minder hard dimmen dan een gewone
hanglamp. Volledige regressie: 42/42 groen.

#### 7.5.6 Herziening (feedback): kelder gehalveerd + volgafstand naar 12m

**Feedback:** "De kelder is veel te groot, maar de kelder ongeveer de helft
zo diep naar het westen (breedte). De lengte mag hetzelfde blijven.
Verplaats de pantserdrank iets naar het oosten zodat deze goed in de
kelder blijft. De zombies mogen me tot 12 meter volgen in de kelder, pas
dit aan." Drie aparte, met elkaar samenhangende wijzigingen.

**1) Breedte gehalveerd, lengte ongewijzigd.** `KELDER_X_WEST` (de
westmuur, het enige punt dat de X-breedte van de kamer bepaalt — de
oostmuur ligt vast bij `KELDERTRAP_X_ONDER`, aan de trap) ging van
`KELDERTRAP_X_ONDER - 15` naar `KELDERTRAP_X_ONDER - 7.5`: de westmuur
schuift 7,5 m naar het oosten, de kamer krimpt dus uitsluitend aan de
westkant. `KELDER_Z_NOORD`/`KELDER_Z_ZUID` (de noord-zuidlengte, 9,9 m)
zijn niet aangeraakt. Omdat `kamerCX`/`kamerBreedteX`/`kelderVloer`/
`kelderPlafond`/`kelderWand(...)` allemaal afgeleid zijn van
`KELDER_X_WEST` in plaats van een losse hardcoded breedte, volgde de hele
geometrie automatisch mee — geen enkele meshdefinitie hoefde apart te
worden aangepast. Resultaat: 7,5 x 9,9 = 74,25 m² (exact de helft van de
vorige 148,5 m²).

**2) Decor herpositioneren — waarom dat NIET vanzelf ging.** Twee stukken
decor waren met een vaste offset gedefinieerd (`KELDER_X_WEST + N` of
`KELDERTRAP_X_ONDER - N`), gecalibreerd op de oude 15m-breedte:
- De twee kamerlampen stonden op `KELDERTRAP_X_ONDER - 3.5` en
  `KELDER_X_WEST + 4`. Bij de nieuwe 7,5m-breedte zijn dat *exact dezelfde
  absolute positie* (`KELDER_X_WEST + 4 === KELDERTRAP_X_ONDER - 3.5`
  wanneer breedte = 7,5) — de twee lampen zouden op elkaar vallen. Fix:
  offsets herschaald naar `KELDERTRAP_X_ONDER - 2` en `KELDER_X_WEST + 2`
  (elk 2 m van de dichtstbijzijnde muur, 3,5 m van elkaar) — bewust een
  kleinere, symmetrische afstand die past bij de kleinere kamer, in
  plaats van de oude (te grote) offsets te laten staan.
- **Pantserdrank** stond op `KELDER_X_WEST + 6` (6 m van de westmuur, dus
  9 m van de oostmuur/trapkoker in de oude kamer). Met de nieuwe, dichter-
  bij-de-trap-liggende westmuur zou diezelfde offset (`+6`) hem nog maar
  3,5 m van de oostmuur zetten — te krap, en in absolute coördinaten een
  significante sprong. Op verzoek is de offset verkleind naar `+4`: nu
  4 m van de westmuur en 3,5 m van de oostmuur/trapkoker, goed
  gecentreerd in de kleinere kamer. Genummerd geverifieerd via
  Playwright (`d.KELDERTRAP_X_ONDER - d.PANTSERDRANK_X` = 3,5;
  `d.PANTSERDRANK_X - d.KELDER_X_WEST` = 4) en visueel via een
  screenshot vanaf de westmuur: de fust staat duidelijk vrij van beide
  muren.
- De wijnrek/kratten (`KELDER_X_WEST + 0.5`/`+1.3`) stonden altijd al
  vlak tegen de westmuur aan en zijn ongemoeid gelaten — die blijven met
  de muur meeschuiven, precies zoals bedoeld.

**3) `KELDER_NABIJ_AFSTAND` 6 → 12 m.** Zelfde constante als de eerdere
herziening in §7.5.4 (toen van 3,5 naar 6 m gezet); nu nogmaals verhoogd
op verzoek. Geen codewijziging nodig buiten de constante zelf — de
grant-logica in `updateOndoden()` gebruikt hem al puur als
straal-vergelijking.

**Testgevolg: de "ver weg"-test in sectie 11 moest opnieuw worden
aangescherpt.** Deze test (zie ook §7.5.4's flakiness-fix) plaatst een
ondode in de fysieke zuidoosthoek van het atelier — de verst haalbare
plek binnen zone 2, zo'n 20,1 m hemelsbreed van het deurgat — en simuleert
daarna een aantal ticks om te bevestigen dat hij nooit `magKelderBinnen`
krijgt. Met de straal nu op 12 m (was 6 m) slinkt de marge tussen
"startafstand" en "stralen" van 14,1 m naar 8,1 m. Omdat dit al de
fysieke hoek van de zone is, kan de teststartpositie niet verder weg
gezet worden om de marge te herstellen. In plaats daarvan is de
simulatieduur verkort van 100 naar 30 ticks (10 s → 3 s): bij
`ONDODE_SNELHEID` (1,5 m/s) is de theoretisch maximale verplaatsing in
3 s slechts 4,5 m, ruim onder de 8,1 m marge — het willekeurige
dwaalgedrag (`kiesWanderDoel`, 2-6 m per stap) kan de ondode dus
onmogelijk binnen bereik van de deur brengen binnen het testvenster,
ook al zou de RNG daarbij precies meewerken. De kortere simulatieduur is
nog steeds ruim voldoende voor de overige checks in die sectie (de
"dichtbij"-ondode krijgt binnen 1 tick al toegang, aangezien hij al bij
het deurgat gespawnd wordt; "beweegt merkbaar" (>0,3 m) wordt in 3 s bij
1,5 m/s makkelijk gehaald). Stabiel bevestigd over 4 herhaalde runs.

**Overige testaanpassingen:** sectie 7 (kelderafmetingen) checkt nu
expliciet dat de breedte 7,5 m is, de lengte 9,9 m (ongewijzigd) en het
oppervlak 74,25 m² — in plaats van de oude "atelier + 10%"-vergelijking,
die na deze herziening niet meer klopt (de kamer is niet langer
schaalgebonden aan het atelier).

**Volledige regressie:** 42/42 groen in `test-kelder-trap.mjs` (4x
herhaald voor stabiliteit) en 41/42 in de volledige suite — de ene
overgebleven fail (`test-ontsnapping-vensters.mjs`, een wall-clock-
gevoelige timing-check rond `ONTSNAPPING_AANKONDIGING_DUUR`) is
geverifieerd **pre-existing en losstaand** van deze wijziging: dezelfde
test faalt identiek op de ongewijzigde, reeds gecommitte code (bevestigd
via `git stash`).

#### 7.5.7 Herziening (feedback): kelder-restrictie volledig verwijderd + 20% donkerder

**Feedback:** "1. Laat alle zombies gewoon de kelder inlopen, verwijder de
code om ze boven te laten of binnen x meter te laten volgen. 2. de kelder
is nu redelijk licht, maak de kelder ongeveer 20% donkerder." Twee
onafhankelijke wijzigingen.

**1) Geen restrictie meer — de hele §7.5.2/§7.5.4/§7.5.6-mechaniek
verwijderd.** Sinds T63 (§7.5.2) kon geen ondode ooit de kelder in; sinds
de eerste herziening (§7.5.4) mocht een ondode die al dichtbij het
deurgat stond mee naar beneden (`KELDER_NABIJ_AFSTAND`, later opgehoogd
in §7.5.6), terwijl wie verder weg stond boven bleef dwalen
(`wachtBoven`/`kiesWanderDoel`/`wanderDoel`/`wanderTimer`). Op expliciet
verzoek is dit hele systeem nu verwijderd: `updateOndoden()` geeft voor
elke ondode gewoon **altijd** `magKelderBinnen=true` door aan
`losBotsingenOp()` en werkt `positie.y` altijd bij via
`berekenKelderY()` — exact hetzelfde patroon als de speler in
`updateSpeler()`, zonder enige uitzondering. Verwijderd: de
`KELDER_NABIJ_AFSTAND`-constante, de `kiesWanderDoel()`-functie, en de
`magKelderBinnen`/`wanderDoel`/`wanderTimer`-velden op het
`ondode`-object (die bestaan niet meer — een ondode heeft simpelweg geen
per-instance kelder-state meer nodig, precies zoals vóór T63's
gedeeltelijke-toegang-herziening).

**Waarom dit veilig is zonder extra guards.** `losBotsingenOp()` behoudt
zijn `magKelderBinnen = false`-default als verdedigingslinie voor de
primitive zelf (getest in `test-kelder-trap.mjs` sectie 8), maar de
productiecode roept hem nooit meer zonder het param aan. Vóór de aankoop
van deur 5 blokkeert `deur5Obstakel` het deurgat nog steeds fysiek — dat
obstakel-mechanisme is volledig los van `magKelderBinnen` — dus ondoden
kunnen ook nu niet naar binnen vóórdat de speler de deur heeft gekocht.
Na aankoop volgen ondoden gewoon `speler.positie` (binnen dezelfde zone,
zie `doelPunt`), en `zoneVan()` kent de kelder geen eigen zone-id toe,
dus zodra de speler er is, is dat automatisch ook het navigatiedoel van
elke ondode in zone 2 — geen aparte "ga naar de kelder"-logica nodig.

**Testgevolg:** sectie 11 van `test-kelder-trap.mjs` (voorheen
"kelder-balans": dichtbij kreeg toegang, ver weg dwaalde rond) is
vervangen door een test die precies het NIEUWE gedrag bevestigt: zowel
een ondode vlak bij de deur als een ondode in de fysieke zuidoosthoek van
het atelier (~20 m hemelsbreed, exact de positie die voorheen juist
NOOIT toegang kreeg) bereiken nu allebei de kelder en dalen af, binnen
een ruim bemeten simulatievenster (600 ticks / 60 sim-seconden — bij
`ONDODE_SNELHEID` 1,5 m/s ruim voldoende voor de ~20 m plus de trap).
Sectie 8 is hernoemd/herschreven om te verduidelijken dat hij nu de
`losBotsingenOp()`-primitive test (default-veiligheid), niet meer
"exact zoals de productiecode het doet" (want dat doet de productiecode
niet meer — die geeft altijd expliciet `true` door). Sectie 10 (de oude
"kelder blijft leeg tijdens golven"-test, voor het scenario waarin de
speler nooit afdaalt) bleef ONGEWIJZIGD en slaagt nog steeds: die test
zet de speler nooit onder y=0, dus ondoden die gewoon `speler.positie`
volgen, komen ook nooit in de buurt van de trap — geen aparte guard
nodig om dat te garanderen, het volgt vanzelf uit "ze lopen naar de
speler, en de speler is er niet."

**2) Kelder ~20% donkerder.** Kleuren zijn de hefboom (niet de
lampintensiteit): `KELDER_TINT` (wanden) `0x8c8171 -> 0x776e60`, de
keldervloer `0x7d6d5a -> 0x6a5d4d`. Empirisch getuned met dezelfde
pixelmeting-methode als eerder in dit document (screenshot vanuit het
midden van de kelderruimte, luminantie `0.2126r+0.7152g+0.0722b`
gemiddeld over het onderste deel van het beeld): een eerste gok van
factor 0,8 op alle RGB-kanalen bleek 27% donkerder op te leveren
(overshoot — de resulterende helderheid schaalt niet lineair met de
albedo-factor, vermoedelijk doordat de kamerlampen zelf een
factor-onafhankelijke lichtbijdrage toevoegen). Teruggerekend naar
factor ≈0,851 kwam de meting op ~21% donkerder uit (61,4 -> 48,2),
binnen de gevraagde "ongeveer 20%". De Stroomuitval-`stroomVloer`-
mechaniek (§7.5.5) en de lampintensiteit/-bereik zijn ongemoeid gebleven
— dit is puur een albedo-aanpassing, dus zowel de normale als de
Stroomuitval-stand worden proportioneel donkerder (bevestigd doordat
`test-stroomuitval.mjs` — die uitsluitend de lichtintensiteit-fracties
test, niet de renderkleur — ongewijzigd 36/36 groen blijft).

**Volledige regressie:** `test-kelder-trap.mjs` 37/37 groen (3x herhaald
voor stabiliteit), `test-stroomuitval.mjs` 36/36 groen, volledige suite
41/42 — de ene overgebleven fail is opnieuw `test-ontsnapping-
vensters.mjs`, dezelfde pre-existing timing-flake als in §7.5.6 (een
losse herhaling liet ook `test-golf-variatielimiter.mjs` ooit falen: een
bekende kansafhankelijke assertie over 300 willekeurige golf-profielen
die op zichzelf, in isolatie, 3x op rij foutloos slaagde — eveneens
losstaand van deze wijziging).

#### 7.5.8 Herziening (feedback): kelder nog eens 15-20% donkerder

**Feedback:** "maak de kelder nog 15-20% donkerder" — bovenop de
20%-verdonkering uit §7.5.7. Zelfde hefboom (wand-/vloerkleur), zelfde
pixelmeting-methode (screenshot vanuit het midden van de kelderruimte,
luminantie gemiddeld over het onderste deel van het beeld).

**Iteratieve tuning (3 metingen):**
1. Baseline (kleuren uit §7.5.7, `0x776e60`/`0x6a5d4d`): 47,39.
2. Eerste gok, kleurfactor 0,87 (`0x686054`/`0x5c5143`): 41,93 — slechts
   11,5% donkerder, te weinig.
3. Tweede gok, kleurfactor 0,87² ≈0,757 vanaf de baseline
   (`0x635b50`/`0x574d40`): 37,36 — 21,2% donkerder, net iets te veel.
4. Lineair geïnterpoleerd tussen meting 2 en 3 naar het midden van de
   gevraagde 15-20%-range (18%): `0x655d51`/`0x594e41`, uitkomend op
   **38,83 — 18,1% donkerder dan de §7.5.7-kleuren**, binnen de gevraagde
   marge.

Zelfde niet-lineariteit als in §7.5.7 (een kleurfactor van bv. 0,87 geeft
NIET automatisch 13% minder helderheid — de kamerlampen zelf dragen een
factor-onafhankelijk deel bij), dus ook hier was directe berekening
onvoldoende en was een tweede meetronde nodig.

**Volledige regressie:** `test-kelder-trap.mjs` 37/37 groen,
`test-stroomuitval.mjs` 36/36 groen (bevestigt opnieuw dat de
Stroomuitval-lichtfracties ongemoeid blijven — puur een albedo-aanpassing),
volledige suite 42/42 groen (de eerder bekende `test-ontsnapping-
vensters.mjs`-timing-flake trad deze run niet op, consistent met een
wall-clock-gevoelige flake i.p.v. een structurele regressie).

#### 7.5.9 Herziening (feedback): kelder 20% donkerder, ALLEEN in de normale stand

**Feedback:** "de kelder mag 20% donkerder in normale stand, in
stroomuitval is de huidige helderheid goed." Dit verschilt fundamenteel
van §7.5.7/§7.5.8: die rondes gingen er (op basis van
`test-stroomuitval.mjs`, dat alleen lichtintensiteit-*fracties* test, niet
gerenderde helderheid) vanuit dat een albedo-wijziging de normale én de
Stroomuitval-stand altijd evenredig donkerder maakt. Deze keer moest het
juist NIET evenredig — de Stroomuitval-stand moest exact even licht
blijven als vóór de wijziging.

**Meetmethode:** zelfde soort pixelmeting als eerder (luminantie
`0.2126r+0.7152g+0.0722b`), maar nu via een eigen headless Playwright-script
(canvas-screenshot + Pillow-luminantie in plaats van de eerdere
in-browser-canvas-methode) vanuit het midden van de hoofdkelderruimte,
gemiddeld over het onderste 45% van het beeld — voor zowel de normale
stand (`stroomFactor=1`) als een geforceerde Stroomuitval
(`actieveEventGolf='stroomuitval'`, `stroomFactor=STROOMUITVAL_DIM_FACTOR`),
in dezelfde paginasessie zodat beide metingen dezelfde (willekeurige)
lampflikker-fase delen.

**Resultaat (3 metingen, `KELDER_TINT`/vloerkleur, factor t.o.v. de
§7.5.8-kleuren `0x655d51`/`0x594e41`):**
1. Factor 0,8 (`0x514a41`/`0x473e34`): normaal 16,06 → 13,77, **14,3%
   donkerder** — te weinig.
2. Factor 0,7 (`0x474139`/`0x3e372e`): normaal 16,06 → 12,33, **23,2%
   donkerder** — te veel.
3. Lineair geïnterpoleerd naar factor ≈0,736 (`0x4a443c`/`0x423930`):
   normaal 16,06 → 12,72, **20,8% donkerder** — binnen de gevraagde
   "ongeveer 20%".

**De Stroomuitval-meting bleef bij alle drie de kleurkeuzes tussen 9,44 en
9,48**, tegenover een baseline van 9,65 vóór de wijziging — een verschil
van ~2%, en een HERHAALDE meting met identieke (eind-)kleuren gaf zelf al
~0,3% onderlinge variatie (pure lampflikker-ruis). Met andere woorden: de
albedo-verandering die de normale stand ~21% donkerder maakt, verandert de
Stroomuitval-stand niet meetbaar boven de eigen meetruis. Verklaring: in
Stroomuitval is de scène al gedimd tot dicht bij zwart (`stroomVloer=0.36`
op de keldermuren + de verlaagde `toneMappingExposure`/`hemisfeerLicht`),
en tone mapping comprimeert het onderste deel van het helderheidsbereik
niet-lineair — dezelfde albedo-factor die in de heldere normale stand een
duidelijk zichtbaar verschil geeft, verdwijnt in de Stroomuitval-stand
grotendeels in die compressie. Geen aparte `stroomVloer`-ophoging nodig:
het bestaande mechanisme (§7.5.5) hield de Stroomuitval-stand al vanzelf
voldoende ongewijzigd.

**Volledige regressie:** `test-kelder-trap.mjs` 51/51 groen,
`test-stroomuitval.mjs` 36/36 groen.

### 7.6 Verbetergebied 3 — Vijandintelligentie

#### 7.6.1 Waypoint-navigatiegraaf — architectuur (beslissing 57)

Een generieke, data-gedreven **intra-zone waypointgraaf** vervangt op
termijn de ad-hoc chokepoint-code
(`GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/`inZoneVier`,
regel 4204-4228 e.o.). Ontwerp: per zone een kleine, hand-geplaatste
lijst waypoints (net als `ZONE_GRAAF` nu al hand-geauteurd is, maar
dan één niveau dieper); een ondode kiest bij het betreden van een
zone het dichtstbijzijnde waypoint op een rechte-lijn-naar-speler pad
(eenvoudige zichtlijn-achtige heuristiek, geen volledig A*) en
loopt via de waypointketen richting de speler in plaats van altijd
in een kaarsrechte lijn. Dit generaliseert zowel het bestaande
cross-zone-graaf-idee als de ad-hoc gang-chokepoint-fix tot **één**
mechanisme.

#### 7.6.2 Waypoint-integratie vervangt ad-hoc code (beslissing 58)

Ticket T65 moet, in dezelfde diff die de waypointgraaf invoert, de
oude `GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/
`inZoneVier`-special-case **verwijderen** (niet ernaast laten staan)
— exact het "verwijder de oude code in hetzelfde ticket als het
nieuwe systeem"-principe dat dit project al op andere plekken
hanteert (zie ROADMAP.md's Regels-sectie). De volledige
regressiesuite (met name `test-gracht-dock.mjs`, dat de twee bugs van
deze sessie afdekt) moet na T65 nog steeds slagen — dat is het
belangrijkste acceptatiecriterium van dit ticket.

#### 7.6.3 Uitvoering T64/T65 (beslissing 62)

T64 en T65 zijn in één diff uitgevoerd (de dataset zou zonder de
integratie toch geen enkel waarneembaar effect hebben, en het risico
zit vooral in de integratie-stap zelf). Het uiteindelijke ontwerp is
lichter dan de oorspronkelijke "zichtlijn-heuristiek + waypointketen"
uit §7.6.1: in de praktijk was er maar één zone (4, de bijkeuken/
gracht-gang) waar de lokale reactieve ontwijk-logica (`ondode.
ontwijkTimer`) het chokepoint niet zelf oplost — de atelier-nis en de
binnenplaats-obstakels (schuurtje/kratten) zijn vrijstaande
hindernissen in een verder open ruimte, en die vond de bestaande
lokale logica al aantoonbaar zelf (nu vastgelegd als regressie-anker,
zie hieronder). Een generieke ketting van meerdere waypoints per zone
zou dus ongebruikte complexiteit zijn geweest voor precies nul extra
gedekte gevallen.

**Dataset (T64):** `ZONE_WAYPOINTS` is een `{ [zoneId]: [{ punt,
zijde(x,z) }] }`-object; `zijde()` bucket een positie in een kant-id
(net als de oude `eigenInGracht`/`spelerInGracht`-booleans, maar nu
als herbruikbare functie i.p.v. inline logica). `zoekWaypoint(zone,
vanPos, naarPos)` itereert de lijst voor `zone` en geeft het eerste
waypoint terug waarvan `vanPos` en `naarPos` aan verschillende kanten
zitten, of `null`. Zone 4 heeft precies één entry, met `punt` =
dezelfde `GRACHTGANG_DREMPEL`-Vector3-instantie als voorheen (data
hergebruikt, geen kopie) — zo blijft de doelpositie voor de bestaande
chokepoint-scenario's exact identiek.

**Integratie (T65):** in `updateOndoden()` is
`eigenInGracht !== spelerInGracht ? GRACHTGANG_DREMPEL : speler.positie`
vervangen door `zoekWaypoint(eigenZone, positie, speler.positie) ||
speler.positie`, met dezelfde `volgendeDeur`-precedentie als voorheen
(cross-zone-routing via `NAV_VOLGENDE` gaat altijd voor). De
`eigenInGracht`/`spelerInGracht`/`inZoneVier`-lokale variabelen bestaan
niet meer. Omdat `zoekWaypoint` zelf op `eigenZone` filtert (alleen
zone 4 heeft een entry), is het eerder gefixte randgeval — een ondode
op de binnenplaats (zone 3, x < `GRACHTGANG_X_WEST`) mag NOOIT naar
`GRACHTGANG_DREMPEL` gestuurd worden ook al ligt de speler op x ≥
`GRACHTGANG_X_WEST` van diezelfde binnenplaats — automatisch nog
steeds gedekt: zone 3 heeft simpelweg geen `ZONE_WAYPOINTS`-entry.

**Performance:** `zoekWaypoint` is een lineaire scan over een array
van lengte 1 (voor de enige zone die er een heeft) zonder allocaties —
ruim binnen de hot-path-voorwaarde uit §7.9.

**Testdekking:** `test-gracht-dock.mjs` bleef **ongewijzigd** groen
(zelfde asserties, `GRACHTGANG_DREMPEL` blijft gewoon geëxporteerd als
herbruikte waypoint-data) — het sterkste bewijs dat de vervanging
gedragsneutraal was. Nieuw: `tests/test-waypoint-navigatie.mjs` dekt
de T64-dataset/lookup als unit-achtige checks, en twee trajectory-trace-
tests (atelier-nis-hoek, binnenplaats-schuurtje) die bevestigen dat
pursuit-gedrag in de twee andere obstakel-zones ongewijzigd correct
blijft (het regressierisico dat T65 expliciet als hoogste van de ronde
noemde).

#### 7.6.4 Kelder-trap chokepoint (feedback, na T64/T65)

**Feedback:** "ze kunnen niet altijd goed de kelder in lopen." De
kelder-trap (`KELDERTRAP_*`, zie §7.5.1/§7.5.2) is een smalle (1,2m
brede), lange (4m) koker tussen de open nis (6m breed) en de
kelderruimte — een muur-chokepoint dat qua vorm sterk lijkt op de
gracht-gang-opening uit §7.6.3, maar met een extra complicatie: er zijn
TWEE muuropeningen na elkaar (boven bij de nis, onder bij de
kelderruimte), niet één.

**Diagnose:** een gesimuleerde ondode die van opzij (niet uitgelijnd met
de 1,2m-brede opening) de trap nadert, blijft ~9 seconden tegen de muur
naast de opening "hangen" voordat de lokale reactieve ontwijk-logica
(`ondode.ontwijkTimer`, een reeks willekeurige zijwaartse pogingen) bij
toeval de opening vindt — precies het gemelde symptoom, en precies het
soort chokepoint waarvoor T64/T65 de waypointgraaf bouwden.

**Waarom één waypoint niet volstaat.** De gracht-opening (§7.6.3) heeft
maar één muur om — een enkel waypoint op de opening lost het symmetrisch
op, ongeacht de looprichting. De kelder-trap heeft een 4m-lange koker
tussen twee openingen: vanuit de nis moet een ondode eerst naar de
BOVENkant van de koker mikken (anders schampt hij de muur naast de
opening), en pas ná het betreden van de koker naar de ONDERkant — het
omgekeerde geldt vanuit de kelderruimte. Eén symmetrisch waypoint zou in
de ene richting goed werken en in de andere richting alsnog een
diagonale lijn dwars door de smalle koker sturen.

**Oplossing: twee waypoints + een "dichtstbijzijnde"-regel.**
`ZONE_WAYPOINTS[2]` kreeg twee entries (`KELDERTRAP_BOVEN_PUNT` op
`(KELDERTRAP_X_BOVEN, KELDERTRAP_CZ)`, `KELDERTRAP_ONDER_PUNT` op
`(KELDERTRAP_X_ONDER, KELDERTRAP_CZ)`), en `zoekWaypoint()` is
gegeneraliseerd: in plaats van de EERSTE entry in de lijst waarvan
`vanPos`/`naarPos` aan verschillende kanten staan, geeft de functie nu de
entry terug wiens `punt` het DICHTST bij `vanPos` ligt, onder alle
entries die van toepassing zijn. Voor zone 4 (met maar één waypoint)
verandert dit niets — voor zone 2 zorgt het ervoor dat een ondode vanuit
de nis eerst de bovenkant kiest, en vanuit de kelder eerst de onderkant,
zonder dat er een aparte "welke kant kom ik vandaan"-vertakking nodig
is. Nog steeds O(waypoints-per-zone), nog steeds geen allocaties (alleen
een paar aftrekkingen voor de kwadratische afstand, geen `Math.sqrt`
nodig omdat alleen de RELATIEVE afstand telt).

**Resultaat:** dezelfde simulatie die vóór de fix ~9s vastzat, steekt de
opening nu binnen ~2,5s over (gemeten), en de totale reistijd naar een
speler diep in de kelderruimte daalt van ~20s naar ~12s. Zie
`tests/test-waypoint-navigatie.mjs` secties 6-7 voor de lookup-checks per
richting en de trajectory-trace die het 3s-plafond bewaakt.
`test-kelder-trap.mjs` (Y-beweging, deur 5, sectie 11 "vrije toegang")
bleef ongewijzigd groen — dezelfde ~9s-vertraging zat daar al binnen de
ruime 60s-simulatiemarge van die test verstopt, vandaar dat de bug pas
via speeltest-feedback aan het licht kwam, niet via de bestaande suite.

#### 7.6.5 Kelderoost-chokepoint (feedback, na de kelderoost-uitbreiding)

**Feedback:** "de waypoint routes in de kelder, de zombies lopen nog niet
goed" — nadat kelderoost (een tweede kelderruimte achter deur6, zie de
kelderoost-sectie hieronder) een DERDE chokepoint aan zone 2 toevoegde,
naast de bestaande trapkoker (§7.6.4).

**Waarom dit anders is dan de trapkoker.** Kelderoost deelt zijn hele
x-bereik (`KELDEROOST_X_WEST..X_OOST`) met de trapkoker
(`KELDERTRAP_X_ONDER..X_BOVEN`), maar ligt op een eigen, zuidelijkere
z-band, gescheiden door een massief muursegment tussen de twee
deuropeningen. Dat schept twee gekoppelde problemen die de trapkoker
zelf niet had: (a) `KELDERTRAP_ONDER_PUNT`'s zijde-test (`x <=
KELDERTRAP_X_ONDER`) leest élke positie in kelderoost óók als "andere
kant" dan de hoofdkelder (want kelderoost ligt óók voorbij die
x-drempel), en (b) een rechte lijn van de trapvoet naar een
kelderoost-deurpunt loopt dwars door dat tussenliggende muursegment.

**Twee mislukte tussenversies (empirisch verworpen, ter waarschuwing voor
toekomstig werk aan deze laag).**
1. `KELDEROOST_DEUR_PUNT` op `DEUR6_X` (het muurcentrum, x ≈ -15,375)
   i.p.v. op de echte `isKelderoost()`-x-drempel (`KELDEROOST_X_WEST`,
   x = -15,5). Zelfde self-terminatie-eis als `KELDERTRAP_ONDER_PUNT`
   (§7.6.4): het waypoint-punt moet op zijn EIGEN zijde-drempel liggen,
   anders wordt "aankomen" bij het punt nooit "isKelderoost" en blijft
   een terugkerende ondode voor altijd op zijn eigen doelpunt hangen
   (bevestigd: een ondode net voorbij de deur, op weg naar de nis, kwam
   nooit verder dan x ≈ -15,38).
2. Een los, statisch "hub"-tussenpunt in het hoofdkelder-interieur (om de
   muur uit punt (b) te ontwijken), gecombineerd met de gefixte
   deur-drempel uit punt 1. Dit loste de heen-richting (trapvoet ->
   kelderoost) op, maar introduceerde een NIEUWE permanente pingpong: zodra
   de ondode het hub-punt bijna bereikte, werd de stuurvector daarheen
   bijna nul, en won `KELDEROOST_DEUR_PUNT` (al dichterbij) de eerstvolgende
   "nearest"-vergelijking terug — waarna de ondode weer terug naar het
   hub-punt gestuurd werd, enzovoort. Een variant met een DYNAMISCH
   hub-punt (altijd 2m ten westen van de ondode zelf, om de
   convergentie-nul-stuurvector te vermijden) loste díe pingpong op, maar
   zonder een harde afstand-drempel bleef het hub-punt voor ALTIJD
   "differs" opleveren tegen niet-kelderoost-doelen (zoals de nis), met een
   ondode die tot in de westmuur van de hoofdkelder doorliep als gevolg —
   en MET een harde drempel kwam de oorspronkelijke pingpong terug, nu
   tegen die drempel. Beide hub-varianten zijn losse commits geweest tijdens
   het debuggen en uiteindelijk verworpen; de kern van het probleem was dat
   een STATISCH of "vaste-afstand-tot-doel"-hub-punt structureel niet
   samengaat met het bestaande "dichtstbijzijnde wint"-arbitragemechanisme
   van `zoekWaypoint()` zodra er een derde, verweg-gelegen concurrerend punt
   (de deur) in het spel is.

**Uiteindelijke oplossing: alleen de deur-drempel fixen, geen hub.** Met
`KELDEROOST_DEUR_PUNT` exact op de `isKelderoost()`-x-drempel (fix 1
hierboven) én `KELDERTRAP_ONDER_PUNT`'s zijde-test uitgebreid met
`isKelderoost(x, z) ||` (zodat kelderoost-posities als "dezelfde kant"
als de hoofdkelder gelden, i.p.v. als "andere kant"), blijkt de
BESTAANDE lokale ontwijk-logica in `updateOndoden()` (dezelfde
`ontwijkTimer`-gebaseerde zijwaartse-dodge die de trapkoker zelf óók al
zonder waypoint kon vinden, zij het traag, zie §7.6.4) de muur tussen
trapvoet en deur6 zelf al betrouwbaar te omzeilen. `ZONE_WAYPOINTS[2]`
heeft dus uiteindelijk drie entries (boven-/onderkant van de trap +
kelderoost-deur), geen vier — de dodge-logica vervangt wat een hub-punt
had moeten doen.

**Resultaat:** beide richtingen bereiken hun doel betrouwbaar (nooit
permanent vast), binnen 7-22s afhankelijk van de willekeurige
dodge-richting (`Math.random()`-gebaseerd, dus niet deterministisch) —
ruimer dan de trapkoker's eigen 3s-garantie (die WEL een dedicated
waypoint-paar heeft), maar altijd eindig, in tegenstelling tot de
voorheen permanent vastlopende situatie. Zie
`tests/test-waypoint-navigatie.mjs` secties 9-10 voor de lookup-checks en
de trajectory-traces (met een ruime 30s-marge i.p.v. de trapkoker's 3s,
precies om reden van de dodge-afhankelijkheid); `test-kelder-trap.mjs`
sectie 12-14 voor de Y-as-/geometrie-/koopmechaniek-regressie van
kelderoost zelf.

### 7.7 Verbetergebied 4 — Sfeer/audio

#### 7.7.1 Achtergrondmuziek-architectuur (beslissing 59)

Achtergrondmuziek volgt letterlijk het bestaande
dreigingsaudio-drone-patroon (regel 3135-3172): een permanente,
eenmalig aangemaakte oscillator/gain-laag (of een klein setje
oscillators voor een simpel origineel motief/akkoordbed), die **nooit
gestopt of herstart wordt**, alleen via `gain.setTargetAtTime()`
omhoog/omlaag gestuurd — bijvoorbeeld zachter tijdens golf-aankondi-
gingen, iets voller tijdens combat, zonder ooit de oscillator zelf te
raken. Volumeplafond expliciet laag en apart van de bestaande
dreigings-drone (bv. muziekgain-plafond 0.05, drone blijft op zijn
bestaande 0.07-plafond) zodat de twee lagen samen niet over de
algehele audio-discipline heen stapelen. 100% Web Audio, eigen
compositie/motief — geen samples, geen bestaande herkenbare
game-muziek of -motieven (IP-regel, CLAUDE.md).

### 7.8 Verbetergebied 5 — Spelerfeedback & oriëntatie

#### 7.8.1 Minimap (beslissing 60)

De minimap is een klein, vast gepositioneerd 2D-`<canvas>`-element
bovenop de bestaande HUD (zelfde plaatsingspatroon als `hudUI` c.s.),
elke frame (of licht doorbelast, bv. elke 2-3 frames) opnieuw
getekend met de 2D Canvas-API: een top-down projectie van de
speler-positie/-richting, bekende zone-omtrekken (statische lijnen,
afgeleid van de bestaande zone-/muurconstantes, dus geen nieuwe
geometrie-tracking) en nabije ondoden als stippen. Geen 3D-rendering,
geen extra Three.js-camera/render-target — puur 2D Canvas, dezelfde
bouwsteen als T59's procedurele texturen, dus geen nieuwe
technologie in het project.

**Heading-up rotatie (feedback: "laat de minimap meedraaien met waar
ik naartoe kijk").** Oorspronkelijk was de minimap north-up:
`minimapTransform(x, z)` projecteerde wereld-coördinaten direct en
wereld-vast op het canvas (`GRENS`-midden → canvasmidden), en alleen
de speler-driehoek zelf roteerde met `speler.yaw` mee. Dat is
vervangen door een speler-relatieve, roterende projectie:

- `minimapLokaal(x, z)` geeft de (nog ongeroteerde) afstand tot de
  speler terug, geschaald: `{ lx: (x - speler.positie.x) * schaal,
  lz: (z - speler.positie.z) * schaal }`. De speler zelf projecteert
  dus altijd op `(0, 0)`.
- `tekenMinimap()` tekent alles wat wél moet meedraaien (zone-
  omtrekken, ondode-stippen, boot-marker) binnen één
  `ctx.translate(midden, midden); ctx.rotate(speler.yaw);` blok, en
  tekent de speler-driehoek zelf DAARNA, in een apart
  `ctx.save()/ctx.restore()`-blok zonder rotatie — de driehoek staat
  dus vast en wijst altijd "omhoog"; de kaart eromheen draait.

**Tekenafleiding (waarom `ctx.rotate(speler.yaw)` en niet
`-speler.yaw`).** `updateSpeler()`'s bewegingscode gebruikt de
vooruit-richting `(-sin(yaw), -cos(yaw))` bij `yaw = 0` wijst de
speler dus naar wereld-`-z`. Een punt recht vóór de speler op
afstand `d` ligt op wereld-`(-d·sin(yaw), -d·cos(yaw))` relatief aan
de speler, dus in `minimapLokaal`-coördinaten op
`(-d·sin(yaw)·s, -d·cos(yaw)·s)` (met `s` de schaal). Canvas'
`ctx.rotate(θ)` roteert rechtsom-positief:
`(x, y) → (x·cosθ - y·sinθ, x·sinθ + y·cosθ)`. Vul `θ = yaw` in:

```
cx = (-d·sinγ·s)·cosγ - (-d·cosγ·s)·sinγ = -d·s·(sinγ·cosγ - cosγ·sinγ) = 0
cy = (-d·sinγ·s)·sinγ + (-d·cosγ·s)·cosγ = -d·s·(sin²γ + cos²γ) = -d·s
```

(waarbij `γ = yaw`) — dus voor élke `yaw` komt het punt recht vóór
de speler uit op `(0, -d·s)`: exact recht "boven" het canvasmidden,
ongeacht de kijkrichting. Met `-speler.yaw` zou de teller van `cy`
omdraaien naar `+d·s` (het punt zou "onder" uitkomen, of bij een
niet-nul yaw op een compleet verkeerde hoek) — vandaar de positieve
rotatie. Geverifieerd in `tests/test-minimap.mjs` §1b door de echte
`ctx.rotate`-transformatie na te bootsen voor vier verschillende
yaw-waarden (0, π/2, π, -1.3) en te controleren dat het altijd op
canvas-boven uitkomt, plus een losse check dat de speler-driehoek
zelf (de `moveTo`-coördinaten) volledig yaw-onafhankelijk blijft.

##### 7.8.1.1 Fix 5: "spookmuren" op open doorgangen

**Feedback:** "op de kaart zie ik soms muren staan terwijl die er niet
zijn, bijvoorbeeld van de beginruimte door de gang naar het atelier. Of
in het atelier zelf." Root cause: elke `MINIMAP_ZONES`-entry tekende zijn
EIGEN volledige rechthoek-omtrek (`strokeRect`) — overal waar twee zones
een echte, deurloze of gekochte doorgang delen (gang↔woonkamer,
gang↔atelier, atelier↔nis, kelderhals↔bijkeuken, bijkeuken↔grachtgang, en
— minder zichtbaar, want een klein deel van een verder correcte lange
muur — atelier↔binnenplaats via deur 2) tekenden BEIDE zones daar hun
eigen randlijn: een muurlijn precies op een plek waar de 3D-wereld gewoon
doorloopbaar is.

**Eerste ontwerp, EMPIRISCH VERWORPEN: silhouet-vulling + erosie.**
Aantrekkelijk omdat generiek (geen per-zone-paar-code): vul alle gekochte
zones als rechthoeken (creëert de unie-silhouet), krimp daarna elke
rechthoek naar binnen met `MINIMAP_MUUR_DIKTE` en knip dat weg via
`globalCompositeOperation = 'destination-out'` — wat overblijft zou een
dunne rand moeten zijn, alleen waar geen andere zone eromheen zit.
Gefaald bij een pixelmeting: voor zones die elkaar alleen RAKEN zonder
oppervlakte-overlap (bv. woonkamer en gang delen precies de lijn
`z=DEUR_Z`, geen gedeeld gebied) reikt de erosie van zone A nooit in zone
B's rechthoek — dus de buitenste `MINIMAP_MUUR_DIKTE`-brede rand van
ALLEBEI de zones bleef gewoon staan. Drie van de vier spookmuur-
kandidaten maten daarna nog exact dezelfde alpha als een bevestigde échte
muur (89 vs. 89), in plaats van de verwachte lage alpha. Wiskundig: erosie
van een VERENIGING van rechthoeken is niet gelijk aan de vereniging van
per-rechthoek-erosies — het verschil zit precies op gedeelde randen, ons
exacte probleem.

**Uiteindelijke, WERKENDE oplossing: expliciete, met de hand
geverifieerde muur-segmenten.** Elke `MINIMAP_ZONES`-entry kreeg een
`muren`-array (losse `[x0,z0,x1,z1]`-lijnstukken), rechtstreeks afgeleid
van de bestaande `bouwMuur()`/`bouwZoneEMuur()`-aanroepen elders in het
bestand (dezelfde bron als de 3D-geometrie zelf, dus per constructie
consistent) — een muursegment bestaat NIET over de breedte van een echte
deur- of open-doorgang, en een gedeelde muur (bv. bijkeuken-westmuur =
woonkamer-oostmuur, `BIJKEUKEN_X_WEST = HALF_BREEDTE`) wordt maar door
ÉÉN zone getekend, niet dubbel. `tekenMinimap()` doet nu simpelweg
`stroke()` per segment i.p.v. `strokeRect()` per zone. 8 zones, samen 31
muursegmenten (woonkamer 5, gang 2, atelier 6, atelier-nis 3, binnenplaats
6, kelderhals 2, bijkeuken 5, gracht/vlonder 2 — dat laatste bewust
alleen voor het overdekte gangdeel, niet de buiten-vlonder waar de
3D-wereld ook geen muren heeft).

**Verificatie:** `tests/test-minimap.mjs` §8 bootst de daadwerkelijke
rendering na (canvas-`getImageData`, max-alpha in een klein venster rond
elk kandidaat-punt) en bevestigt nu voor alle vier de eerder foute
kandidaten een duidelijk LAGERE alpha dan een bevestigde echte muur —
i.e. het bewijs dat de vorige poging niet kon leveren. Volledige
regressie: `test-minimap.mjs` 37/37 groen, `test-boot-aankondiging.mjs`
19/19 groen (gebruikt `tekenMinimap()` ook, voor de boot-marker).

#### 7.8.2 Richtingsfeedback bij schade (beslissing 61)

Bij het oplopen van schade verschijnt een korte, richtinggevoelige
DOM-indicator (een "wedge"/pijl-vormig element aan de rand van het
beeld, georiënteerd op de hoek tussen de kijkrichting van de speler
en de richting waar de schade vandaan kwam) die kort oplicht en
uitfaded. Implementatie volgt het bestaande effects-pool-patroon
(`tracerPool`/`impactPool`, regel 2957-2959): een klein, vast aantal
vooraf aangemaakte DOM-wedge-elementen die hergebruikt worden per
hit, nooit `document.createElement` in de hot path
(`raakOndode()`/schade-afhandeling). Puur CSS/DOM-transform-gestuurd,
geen nieuwe canvas-laag nodig.

##### 7.8.2.1 Fix 2: de pijl bevroor op het hit-moment i.p.v. de bron te blijven volgen

**Feedback:** "de richtingsfeedback werkt nog niet helemaal goed."
Geometrisch klopte de rotatieformule al voor élke yaw (cardinale én
willekeurige hoeken, empirisch geverifieerd via `getBoundingClientRect()`
vóór deze fix) — de bug zat in de TIJDSDIMENSIE: `toonSchadeRichting()`
berekende `relatieveHoek` één keer, op het hit-moment, en zette die als
vaste CSS-`transform` op de wedge. Draaide de speler daarna (tijdens de
0.5s zichtbaarheid van de wedge) zijn kijkrichting verder — vrijwel
altijd het geval midden in gevecht — dan bleef de pijl op die bevroren
schermhoek staan i.p.v. de wérkelijke, inmiddels veranderde relatieve
richting van de bron te tonen.

**Fix:** `berekenSchadeWedgeHoek(bronX, bronZ, spelerX, spelerZ,
spelerYaw)` als pure, herbruikbare functie; elke wedge-slot onthoudt nu
ook `bronX`/`bronZ` (niet alleen `timer`). `updateSchadeWedges(dt)` (al
elke frame aangeroepen voor de opacity-fade) herberekent nu OOK de
rotatie-transform, met de ACTUELE `speler.yaw`, zolang de wedge nog
zichtbaar is — dezelfde bron blijft dus correct "gevolgd" ongeacht hoeveel
de speler ondertussen ronddraait.

**Verificatie:** `tests/test-schaderichting.mjs` §12 zet de speler op
yaw=0 met een bron recht vooruit (hoek ≈0), draait de speler dan een
kwartslag ZONDER nieuwe hit, en bevestigt dat `updateSchadeWedges()` de
transform bijwerkt (hoek verandert, en verandert naar de correcte nieuwe
relatieve hoek — de bron staat nu "rechts" na de kwartslag). §13 test
`berekenSchadeWedgeHoek()` zelf als pure functie. Regressie:
`test-schaderichting.mjs` 28/28 groen.

### 7.9 Performancebudgetten en risicogebieden (ronde 5)

- **Shadow-invariant blijft ongewijzigd**: exact 1 shadow-castende
  light in de hele scene, ook na T60 (post-processing) en T62
  (kelder) — geen van beide tickets voegt een tweede shadow-light
  toe.
- **Hot-path-verboden blijven gelden**: T61 (silhouetten), T64/T65
  (waypointgraaf) en T68 (richtingsfeedback-pool) raken code die
  potentieel per-frame/per-ondode draait (`schiet()`, `raakOndode()`,
  `updateOndoden()`) — geen allocaties, geen `setTimeout`, geen
  closures per aanroep in die functies. De waypointgraaf-lookup moet
  een simpele array-/object-indexering zijn, geen graaf-traversal
  die per frame opnieuw wordt opgebouwd.
- **CDN-risico (T60)**: de postprocessing-submodules zijn een nieuwe
  importmap-entry op een bestaande host. Dit MOET eerst geverifieerd
  worden (bestaat de module op die CDN, in de juiste Three.js-
  versie?) vóór er code tegenaan geschreven wordt — zie
  SONNET_EXECUTION_PLAN.md-waarschuwing 32.
- **2D-collision-risico (T62)**: de kelder-Y-ramp is de EERSTE plek
  in het hele project waar `positie.y` structureel gebruikt wordt.
  Elke andere plek die met `speler.positie` rekent
  (schietrichting, botsingen, zone-lookup) moet expliciet
  gecontroleerd worden op impliciete "Y is altijd 0"-aannames vóór
  dit ticket als afgerond geldt.
- **Materiaal-mutatiediscipline (T58/T59)**: `matFamilie`-materialen
  zijn gedeeld/immutable; texture-toevoeging via T59 moet per-familie
  gebeuren (nieuwe gedeelde texture-referentie in
  `MATERIAAL_FAMILIES`), nooit per-instantie gemuteerd — anders breekt
  de bestaande cache-aanname stilzwijgend voor alle gebruikers van die
  familie.
- **Audio-volumeplafond (T66)**: nieuwe muziekgain moet apart
  begrensd worden van de bestaande dreigings-drone (zie 7.7.1) —
  gecombineerd volume mag het gevoel van de bestaande sfeer-audio niet
  overstemmen.

#### 7.9.1 Herziening (feedback): performance-audit doorgevoerd

**Feedback:** "de game kan soms wat haperig worden, is de game al te
zwaar?" gevolgd door een audit-verzoek, daarna "voer door" op de drie
gevonden optimalisaties. Het audit-rapport (voor/na-screenshots, zie de
gesprekshistorie) vond drie onafhankelijke ingrepen; alle drie zijn nu
doorgevoerd.

**1) Schaduw-resolutie 512 → 256.** `hangLamp()`'s
`shadow.mapSize.set(512, 512)` is verkleind naar 256×256. De
`schaduw===1`-invariant (§7.9 hierboven) blijft volledig intact — dit
raakt alleen de resolutie van de ÉÉN bestaande schaduwwerpende lamp, geen
enkele tweede shadow-light toegevoegd of verwijderd. Onderbouwing:
voor/na-pixelmeting (dezelfde scene, mét de overige 26 lichten erbovenop)
liet al zien dat deze schaduw sowieso wegvalt tegen de rest van de
verlichting (max. 12/255 pixelverschil bij schaduw volledig UIT) — een
kwart van de pixels renderen kost dus geen zichtbare kwaliteit.

**2) Twee ember-lichtjes met bereik 0,9m verwijderd.** De Smederij-visuals
(Drukspuit- én Ratelaar-variant, Ticket 17) hadden elk een eigen
`PointLight(SMEDERIJ_ACCENT_KLEUR, 0.3, 0.9, 2)` naast het emissive
ringmateriaal. Voor/na-pixelmeting (banner-vrije crop, zelfde standpunt)
liet een verschil van max. 36/255 zien — de gloed komt vrijwel volledig
van het emissive materiaal zelf, dat onafhankelijk van scene-lichten
blijft stralen. Beide `PointLight`-objecten zijn verwijderd; de
`ringMateriaal`/tandwiel/hitteband-emissive bleef ongewijzigd. Dit brengt
de totale lichttelling van 28 naar 26 (test-gracht-dock.mjs sectie 6 en
test-smederij.mjs's budget-check zijn bijgewerkt naar de nieuwe telling).

**3) Vector3-allocaties in `updateOndoden()` vervangen door hergebruikte
temp-vectors.** Zeven `new THREE.Vector3()`/`.clone()`-aanroepen per
ondode per frame (`rechtstreeks`, `naarDoel`, `direct`, `zijwaarts`,
`richting`, `voorPos`, `testPos`) zijn vervangen door zeven module-scope
`const _tmpX = new THREE.Vector3();`-instanties, hergebruikt via
`.subVectors()`/`.copy()`/`.set()` in plaats van `new`/`.clone()`. Bij 14
ondoden op 60fps was dit ~5.900 allocaties/seconde voor de garbage
collector — de vermoedelijke daadwerkelijke oorzaak van het gemelde
haperen (GC-pauzes voelen als incidentele schokjes, niet als een
structureel lagere framerate, precies het gemelde symptoom). Puur een
geheugenbeheer-wijziging: geen enkele waarde of volgorde van berekeningen
veranderde, dus geen visueel of gameplay-verschil mogelijk — bevestigd
door de volledige regressie (zie hieronder), niet door een screenshot
(die zou toch identiek zijn).

**Waarom niet ook castShadow van decor-meshes afhalen.** De audit
overwoog ook het aantal schaduwcasters (146 meshes) te verlagen door
`castShadow` van kleine decorstukken (tafels, kratten, vaten) te
verwijderen. Dat raakt gedeelde helperfuncties
(`bouwTafel`/`bouwKratten`/`bouwVat`/etc.) die door de hele kaart heen
worden hergebruikt — een grotere, risicovollere ingreep dan de
mapSize-verlaging voor een onzekere aanvullende winst (WebGLShadowMap
frustum-cult objecten buiten het bereik van het licht toch al vóór de
render-pass). Bewust buiten scope gehouden voor deze ronde.

**Volledige regressie:** twee testbestanden bijgewerkt (zie hierboven),
verder ongewijzigde tests. 42/42 groen, 3x herhaald voor stabiliteit.

### 7.10 Herbruikbare systemen uit deze ronde

- **PALET** (7.4.1) is bedoeld als groeiend systeem — latere rondes
  kunnen er nieuwe kleurgroepen aan toevoegen zonder opnieuw een
  hele art-direction-discussie te voeren.
- **Procedurele CanvasTexture-cache** (7.4.2) kan later hergebruikt
  worden voor andere materiaaldiepte-wensen (bv. vloertexturen) zonder
  nieuw ontwerpwerk.
- **Waypointgraaf** (7.6.1) is de generieke opvolger van zowel
  `ZONE_GRAAF` als alle toekomstige ad-hoc intra-zone-fixes — nieuwe
  zones met complexe interne geometrie hoeven geen eigen
  chokepoint-special-case meer te krijgen, alleen een eigen
  waypoint-lijst.
- **DOM-wedge-pool** (7.8.2) is een direct herbruikbaar patroon voor
  toekomstige korte, richtinggevoelige HUD-indicatoren (bv. een
  toekomstig "item hier"-pijltje).

### 7.11 Plattegrond (bijgewerkt) — de volledige huidige kaart

Vervangt §4.6 als de actuele plattegrond (§4.6 blijft staan als
historisch document van de kaart vóór de map-lus/kelder/gracht-ronde).
Bron van waarheid blijft altijd de code (`amsterdam-undead.html`); zie
§4.4 voor de oorspronkelijke coördinatentabel-conventie, hieronder
uitgebreid met alle zones die sindsdien zijn toegevoegd.

**Topologie** (de zone-lus zoals `ZONE_GRAAF`/`NAV_VOLGENDE` 'm ook
kennen — dit is een graaf-diagram, geen schaaltekening):

```
┌────────────────┐           ┌────────────────┐           ┌────────────────┐           ┌────────────────┐           ┌────────────────┐
│ WOONKAMER (A)  │───deur1───│    GANG (B)    │───open────│ATELIER+NIS (C) │───deur2───│BINNENPLAATS (D)│───deur3───│ BIJKEUKEN (E)  │
└────────────────┘           └────────────────┘           └────────────────┘           └────────────────┘           └────────────────┘
         │                                                                                                                   │
         ▲───────────────────────────────────────── deur4 — terugweg, sluit de lus ──────────────────────────────────────────┘
```

Twee aftakkingen die niet in de lus zelf liggen:

- **Vanuit C (via de nis):** open → NIS → trap/**deur5** (koop, €900,
  eenmalig, forceert de deur) → **KELDER (-Y)**, met Pantserdrank.
  Permanente veilige zone qua gameplay-restricties (§7.5.7: geen enkele
  ondode-restrictie meer, elke ondode volgt de speler er gewoon naartoe)
  — maar sinds §7.6.4 ook een eigen intra-zone-waypointpaar
  (`ZONE_WAYPOINTS[2]`) zodat ondoden de smalle trap-koker vlot vinden
  i.p.v. er minutenlang tegen de muur naast te hangen.
- **Vanuit E (bijkeuken):** open → gracht-gang → vlonder → water → boot
  (met een gracht-lantaarn en een boot-lichtje). De vlonder is de plek
  van De Ontsnapping (het winscherm, periodieke ontsnappingsvensters).

**Coördinatentabel** (alle waarden uit de constanten in
`amsterdam-undead.html`; oriëntatie **+x = oost, −z = noord**):

| Ruimte | Zone | x-bereik | z-bereik | Sleutelconstanten |
| --- | --- | --- | --- | --- |
| Woonkamer | A (0) | −4.5 … 4.5 | −5 … 5 | `HALF_BREEDTE`, `HALF_DIEPTE`, `DEUR_Z` |
| Gang | B (1) | −1 … 1 | −8 … −5 | `DEUR_HALF`, `GANG_Z_EIND` |
| Atelier | C (2) | −4.5 … 4.5 | −23 … −8 | `KAMER2_HALF_B`, `KAMER2_Z_NOORD` |
| Voorraadnis (deel van C) | C | −11.5 … −4.5 | −23 … −17 | `KAMER2_NIS_X_WEST`, `KAMER2_NIS_Z_ZUID` |
| Kelder-trap (koker, deel van C qua `zoneVan`) | C | −15.5 … −11.5 | trapband rond −21.8 | `KELDERTRAP_X_BOVEN/-ONDER`, `KELDERTRAP_CZ`, `KELDERTRAP_HALF_BREEDTE` |
| Kelder (−Y, disjuncte footprint) | C | −23 … −15.5 | −23.9 … −14 | `KELDER_X_WEST`, `KELDER_Z_NOORD/ZUID`, `KELDER_DIEPTE = 3.3` |
| Binnenplaats | D (3) | 4.5 … 20.5 | −24 … −7 | `DEUR2_X`, `PLAATS_X_OOST`, `PLAATS_Z_NOORD/ZUID`, `PLAATS_CX` |
| Kelderhals (deel van E, verbindt D↔bijkeuken) | E | 9 … 11 | −7 … −4.5 | `KELDERHALS_X_WEST/OOST`, `KELDERHALS_Z_NOORD/ZUID` |
| Bijkeuken | E (4) | 4.5 … 12 | −4.5 … 4.5 | `BIJKEUKEN_X_WEST/OOST`, `BIJKEUKEN_Z_NOORD/ZUID` |
| Gracht-gang | E | 12 … 15 | smalle band rond z=0 | `GRACHTGANG_X_WEST`, `GRACHTGANG_LENGTE`, `GRACHTGANG_HALF` |
| Vlonder | E | 15 … 19.5 | idem | `VLONDER_X_WEST/OOST`, `VLONDER_DIEPTE` |
| Water/boot | E | 19.5 … ~24.3 | idem | `BOOT_DOK_X`, `BOOT_VERTREK_X`, `WATER_BREEDTE` |

**Deuren** (alle koopbaar/forceerbaar via `T`, zie de bijbehorende
`koopDeurN()`-functies): deur1 (A↔B, noordmuur woonkamer), deur2 (C↔D,
oostmuur atelier), deur3 (D↔E, zuidmuur binnenplaats → kelderhals),
deur4 (E↔A, "terugweg", sluit de lus), deur5 (nis → kelder, geen
zone-overgang, eenmalig €900).

**Belangrijkste interactiepunten:** upgrade + ammo-kist (woonkamer),
werkbank/Snelheidselixer (atelier), Pantserdrank (in de kelder, sinds
§7.5.6), Watertap + Ratelaar (binnenplaats), Smederij (bijkeuken, sinds
Ticket 35 — niet meer op de binnenplaats), De Ontsnapping (vlonder).

**Objecten met echte collision** (naast muren/deuren): schuurtje
(binnenplaats) en kratten (binnenplaats) — zie §7.6.1 voor waarom deze
GEEN eigen waypoint-entry hebben (vrijstaande obstakels, geen
muur-chokepoint).
