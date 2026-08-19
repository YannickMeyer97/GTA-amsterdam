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

#### 7.5.10 Fix 3 v2: kelderlicht scheen door de nis-westmuur/deur5 heen

**Feedback:** "het licht van de kelder lijkt door de muur in het atelier
te schijnen" (met screenshot: een duidelijke lichtvlek rond de deur5-
doorgang, zichtbaar vanuit de nis). Empirisch bevestigd met een
voor/na-screenshotvergelijking vanuit de nis, kijkend naar deur5 — de
vlek was zichtbaar ONGEACHT of deur5 al gekocht was (dus ook door de
DICHTE, opake houten deur-mesh heen).

**Oorzaak:** puntlichten in deze scene casten geen schaduw (op de ene
shadow-invariant-lamp na, zie §7.9) — geometrie zoals `deur5Mesh` of de
nis-westmuur blokkeert dus HELEMAAL NIETS van hun licht; alleen de
inverse-kwadraat-afstandsval-off en de harde `bereik`-cutoff (Three.js'
`PointLight.distance`) begrenzen hoe ver een lamp reikt. Het
trap-koker-peertje (`kelderLamp(kokerCX, KOKER_LAMP_Y, KELDERTRAP_CZ, 9,
9, ...)`) stond met `bereik=9` middenin de trapkoker, maar op slechts
~2m van de deur5-doorgang — ruim binnen dat bereik — en scheen dus vrij
door de deur/muur heen de nis in.

**Fix:** `bereik` 9 → 3.5. Dekt de trapkoker zelf nog steeds volledig
(de koker is maar 4m lang), maar valt met kwadratische afstandsval-off
ruim voordat het licht de nis nog merkbaar bereikt. De onderkant van de
trap/kelderruimte krijgt sowieso zijn eigen, sterkere verlichting via de
`kelderLamp()`-aanroepen met `stroomVloer` (§7.5.5/§7.5.7-7.5.9) — die
zijn NIET aangepast, dus de zojuist getunede kelder-helderheid
(§7.5.7-7.5.9) blijft ongewijzigd.

**Verificatie:** visuele voor/na-screenshotvergelijking (canvas-
screenshot vanuit de nis, kijkend naar deur5, met en zonder deur5
gekocht) bevestigt dat de lichtvlek verdwijnt. `tests/test-kelder-
trap.mjs` §15 bewaakt de regressie: precies 1 lamp op `KELDERTRAP_CZ`
met `licht.distance <= 4`. Volledige regressie: `test-kelder-trap.mjs`
54/54 groen, `test-stroomuitval.mjs` 36/36 groen (ongewijzigd — deze
lamp heeft geen `stroomVloer`, dus geen kruisbesmetting met die suite).

##### 7.5.10.1 Fix 3 v3: 3.5m bleek nog niet kort genoeg

**Feedback:** "ik zie nog steeds het licht aan de linkermuur (west muur)
van het atelier" — later verduidelijkt met een screenshot: niet het
raam (`glasNW`, een blauw gloeiend, altijd al bestaand en volledig
legitiem venster op de noordwestmuur, ONgerelateerd aan de kelder —
bevestigd via een exacte raycast op de gemelde pixel-locatie, die recht
op `glasNW`'s positie uitkwam) maar een apart, WARM/geel lichtvlek vlak
bij deur5 zelf.

**Oorzaak:** `kokerCX` (de x-positie van het trap-peertje) ligt maar
~2m van de deur5-doorgang — bij `bereik=3.5` (§7.5.10) had het licht dus
nog altijd 1,5m "over" om voorbij de deur te reiken. Een screenshot vlak
bij de GESLOTEN deur bevestigde een duidelijke warme gloed rond het
kozijn, ook na de 3.5m-fix.

**Fix:** `bereik` 3.5 → 2.2 — dekt daarmee vrijwel alleen de eigen
onmiddellijke omgeving in de koker; de gecombineerde kwadratische
afstandsval-off + Three.js' venster-cutoff-functie brengt de
lichtbijdrage bij 2m al bijna op 0. Bewust een zwak lampje: dit was van
meet af aan bedoeld als "een klein beetje verlichting" (regel ~2143),
niet als volwaardige kamerverlichting — die komt van de bredere
`kelderLamp()`-aanroepen met hun eigen, ruimere bereik.

**Verificatie:** drie screenshots — (1) vlak bij de gesloten deur5: geen
merkbare gloed meer rond het kozijn; (2) verder terug in het atelier: nog
steeds schoon; (3) met deur5 gekocht, er recht induitkijkend: de trap
zelf blijft nog gewoon leesbaar verlicht (het peertje doet zijn werk
zodra je er ECHT induitkijkt, lekt alleen niet meer door een gesloten
deur/muur). `tests/test-kelder-trap.mjs` §15 aangescherpt naar
`licht.distance <= 2.5`. Volledige regressie: 48/48 scripts groen.

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

##### 7.7.1.1 Fix 2: de nevelklok was nauwelijks hoorbaar

**Feedback:** "ik hoor geloof ik geen geluid, kan dat kloppen?" — na
Fix 1 (de nevelklok, §hierboven). Geen wiring-bug (de audiograaf
`muziekOsc → nevelklokGainNode → muziekGainNode → masterGainNode` was
en is correct, geverifieerd via de bron-checks in
`test-achtergrondmuziek.mjs`) maar een STAPELING van drie
audibiliteitsproblemen die elkaar versterkten:

1. **Exponentiële opbouw is bijna de hele tijd stil.** De zwel-fase
   gebruikte `exponentialRampToValueAtTime(1, nu + 3s)` vanaf 0.0001 —
   zo'n curve legt het grootste deel van de stijging af in het LAATSTE
   kwart van de tijd (bij de helft van de 3s staat de gain nog maar op
   ~1% van de piek). Een luisteraar hoort dus vooral stilte, gevolgd
   door een korte "pop" vlak vóór de piek.
2. **Dubbele, gelijktijdige opbouw bij de allereerste beiering.**
   `nevelklokTimer` start op 0 (de eerste beiering triggert meteen bij
   het opstarten), maar `muziekGainNode` zelf start OOK op gain 0 en
   nadert zijn doelwaarde pas geleidelijk via `setTargetAtTime`
   (tijdconstante `MUZIEK_GLIJTIJD`=1.2s). Twee onafhankelijke, allebei
   nog-lage curves VERMENIGVULDIGD (de klok-envelope × de spelfase-
   volumesturing) maakten precies de EERSTE — en bij een korte test de
   enige — beiering extra zwak.
3. **Te lage grondtoon voor kleine speakers.** De partialen (E2/C#3/D3,
   82/139/147 Hz, overgenomen uit de aangeleverde preview-WAV) liggen
   in een bereik waar ingebouwde/laptop-speakers doorgaans zwaar dempen
   (vaak al merkbaar onder ~150 Hz).

**Fix:** (a) opbouw korter én LINEAIR i.p.v. exponentieel
(`NEVELKLOK_ZWEL_TIJD` 3s → 1.4s, `linearRampToValueAtTime` — een
lineaire curve staat na de helft van de tijd ook op de helft van het
volume, dus veel eerder daadwerkelijk hoorbaar; het verval blijft
bewust exponentieel, dat klinkt voor een wegstervende bel wél
natuurlijk); (b) alle drie de partialen een octaaf omhoog (E3/C#4/D4,
165/277/294 Hz) — zelfde kleine-secunde-wrijving/"beieren"-karakter,
ruim boven de dreigingsdrone (55/57 Hz) dus nog steeds gescheiden lagen,
maar binnen het bereik dat de meeste speakers goed reproduceren; (c)
`MUZIEK_VOLUME_PLAFOND`/`RUST`/`AANKONDIGING` opgehoogd (0.05/0.03/0.015
→ 0.08/0.05/0.025, zelfde trapjes/verhouding) — nog steeds ruim onder
een overstemmend niveau samen met de drone (0.08+0.07=0.15).

**Verificatie:** `test-achtergrondmuziek.mjs` §9/§10 controleren via
bron-inspectie (`speelNevelklokToon.toString()`/`initGeluid.toString()`)
dat de opbouw `linearRampToValueAtTime` gebruikt (niet exponentieel) en
dat de drie oscillators op de nieuwe, hogere frequenties staan — een
Web Audio-tijdlijn zelf vooruitspoelen kan niet in een headless test,
dus de scheduling-code-vorm is het dichtstbijzijnde verifieerbare bewijs.
Regressie: `test-achtergrondmuziek.mjs` 30/30 groen.

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

##### 7.8.2.2 Fix 1 v2: de pijl wees naar de speler toe i.p.v. ervan af

**Feedback:** "de richting aanwijzer bij schade lijkt verkeerd om te
staan qua teken... hij wijst naar mij toe in plaats van van mij af."
De ROTATIEHOEK zelf was (opnieuw empirisch bevestigd, zie §7.8.2.1) al
correct voor elke richting/yaw — de bug zat in de VORM van de driehoek
zelf, niet in zijn rotatie. De CSS-driehoektruc (0×0-box + transparante
zij-borders + één gekleurde border) gebruikte `border-top`, wat een
naar-BENEDEN wijzende driehoek (▼) oplevert. Bij hoek 0 (bron recht
vooruit) hangt de wedge via `translateY(-42vh)` BOVEN het canvasmidden —
een naar-beneden wijzende driehoek zou daar dus met de punt terug naar
het midden (de speler) wijzen: precies het gerapporteerde probleem.

**Fix:** `border-top` → `border-bottom` in de `.schadeWedge`-CSS-regel.
`border-bottom` levert een naar-BOVEN wijzende driehoek (▲) op — bij
hoek 0 wijst de punt dan verder omhoog, WEG van het canvasmidden (de
speler), voor élke rotatiehoek (de rotatie draait de hele vorm inclusief
zijn punt-richting mee, dus dit geldt voor alle standen, niet alleen
hoek 0). Puur een CSS-wijziging — de rotatieberekening zelf
(`berekenSchadeWedgeHoek()`, Fix 2 hierboven) blijft ongewijzigd correct.

**Verificatie:** `tests/test-schaderichting.mjs` §14 controleert via
`getComputedStyle()` dat `.schadeWedge` een niet-nul `border-bottom-
width` en een `0px` `border-top-width` heeft. Regressie:
`test-schaderichting.mjs` 29/29 groen.

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
| Vliering (+Y, disjuncte footprint, T87) | C | −11.5 … −4.5 | −17 … −8.9 | `VLIERING_X_WEST/OOST`, `VLIERING_Z_NOORD/ZUID`, `VLIERING_Y = 1.2` |
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

---

## 8. Architectuurronde 6 (v0.20) — Resourcebeheer, frame-budget en betrouwbaarheid

### 8.1 Scope en aanleiding

Deze ronde komt niet uit een feature-wens maar uit een **volledige
code-audit** op de stand van commit `da3524e` (senior engineer,
performance engineer, game designer). Anders dan rondes 1-5 voegt v0.20
daarom bewust nauwelijks nieuwe spelinhoud toe. Het gros is:

1. het dichten van een bevestigd, lineair groeiend GPU-resourcelek;
2. het weghalen van werk uit de per-frame hot path dat daar niet hoort;
3. het zichtbaar maken van faalmodi die nu volledig stil zijn;
4. het toevoegen van de testcategorie die deze klasse bugs had moeten
   vangen.

De audit-bevindingen zijn met metingen onderbouwd (§8.11). Waar een
bevinding NIET gemeten kon worden, staat dat er expliciet bij — die
gaan bewust niet als feit de tickets in.

**Belangrijke randvoorwaarde die deze ronde niet aanraakt.** De
één-bestand-regel uit CLAUDE.md blijft staan. Elk voorstel dat neerkomt
op "splits `amsterdam-undead.html` op in modules" valt daarmee buiten
scope, hoe aantrekkelijk het ook is bij 7.887 regels. De architectuur
wordt binnen die beperking verbeterd, niet eromheen.

### 8.2 Codekaart — nieuw relevante gebieden voor deze ronde

| Gebied | Waar | Waarom relevant |
| --- | --- | --- |
| `maakOndodeModel()` | STAP 6 | Bron van het geometrie-/materiaallek (beslissing 63) |
| `mat()` / `matFamilie()` | STAP 1-2 | Bestaand cache-sjabloon dat exact hergebruikt wordt |
| `doodOndode()` / `updateStervenden()` | STAP 6/7 | Opruimmoment voor ondode-modellen |
| `ontploiBrander()` / `spawnPowerupDrop()` | STAP 6 / power-ups | Overige wegwerp-objecten (beslissing 63) |
| `updateHUD()` | STAP 7 | 9 `getElementById` + ~8 writes, per frame aangeroepen (beslissing 64) |
| `updateSpelerRegen()` / `updatePowerups()` | STAP 7 / power-ups | De twee per-frame aanroepers van `updateHUD()` |
| `updateInteracties()` | STAP 9 | Per-frame DOM-write + string-allocatie (beslissing 64) |
| `updateOndoden()` — `rotation.y` | STAP 6 | Kijkrichting ≠ looprichting (beslissing 65) |
| Importmap + module-`<script>` | HTML-head | Stille faalmodus bij CDN-uitval (beslissing 66) |
| `leesHighscore()` / `schrijfHighscore()` | STAP 8 | Sjabloon voor spelerinstellingen (beslissing 67) |
| `tests/helpers.mjs` / `run-all.mjs` | tests/ | Resource-testcategorie + CI (beslissing 68) |
| `lampLichten` / `buitenLichten` | STAP 2 e.v. | 26 PointLights, forward-renderer-kosten (beslissing 69) |

### 8.3 Verbetergebied 1 — Resourcebeheer

#### 8.3.1 Gedeelde geometrie-cache en expliciet dispose-contract (beslissing 63)

**Het probleem.** `maakOndodeModel()` maakt per ondode ~9 verse
geometrieën én ~9 verse `MeshStandardMaterial`-instanties, en omzeilt
daarbij de twee caches die het project al heeft (`materiaalCache` via
`mat()`, `matFamilieCache` via `matFamilie()`) door de Three.js-
constructor rechtstreeks aan te roepen. `doodOndode()` haalt de groep
alleen uit de scene-graph. In het hele bestand komt `.dispose()`
**nul keer** voor. Three.js geeft GPU-buffers uitsluitend vrij op een
expliciete `dispose()` — dus lekt elke gedode ondode zijn geometrie
permanent.

**Waarom dit 68 tickets lang onopgemerkt bleef.** De symptomen zijn
onzichtbaar in elke bestaande test: gedrag, state en scene-graph zijn na
afloop volledig correct — `ondoden` is leeg, `stervenden` is leeg, de
groep zit nergens meer in. Alleen de GPU-zijde lekt, en daar keek geen
enkele test naar. Dit is precies de reden dat beslissing 68 (resource-
tests) in dezelfde ronde zit: de fix zonder de bewaking herhaalt zich.

**De oplossing.** Eén `geoCache(sleutel, fabriek)`-helper naar exact het
patroon van de bestaande materiaalcaches. De per-ondode maatvariatie
(`vorm.rompBreedte`, `profiel.rompFactor`, armlengte/-dikte) verhuist van
geometrie-parameters naar `mesh.scale`, zodat alle ondoden dezelfde ~9
gedeelde geometrieën hergebruiken. Daarnaast één
`ruimGroepOp(object3D)`-helper voor wat wél per keer uniek moet zijn.

**Waarom `scale` en niet "gewoon disposen".** Disposen alléén lost het
lek op maar houdt de allocatiekost per spawn in stand (~18 objecten per
ondode, tot 18 spawns per golf). De cache lost beide op. De prijs is dat
de maatvariatie een transform wordt in plaats van geometrie — wat
functioneel identiek is voor een `BoxGeometry`/`SphereGeometry`, maar
wél de hitbox raakt en dus geverifieerd moet worden (zie hieronder).

**Wat expliciet NIET gedeeld mag worden.** Het per-ondode
`oogMateriaal`: `emissiveIntensity` wordt per individu geanimeerd
(`zetOogBasis()`, de windup-puls, de mist-/stroomuitval-boost). Delen
zou alle ondoden tegelijk laten pulsen. Dat materiaal blijft uniek en
gaat in plaats daarvan door `ruimGroepOp()`.

**Het risico dat dit ticket VOORZICHTIG maakt.** De headshot-detectie
leunt op `userData.lichaamsdeel === 'kop'` én op de werkelijke
mesh-omvang. Een schaalfout verandert stilzwijgend de trefkans en
daarmee de moeilijkheidsgraad — zonder dat één test rood wordt, want
geen enkele bestaande test asserteert op absolute hitbox-afmetingen.
Vandaar de harde eis: wereld-bounding-box van kop én romp vóór en ná
identiek (≤ 1 mm) voor alle vijf types.

#### 8.3.2 Wat bewust NIET verandert

De effect-pools (`tracerPool` 8, `impactPool` 24, round-robin) zijn al
correct: begrensd, hergebruikt, nul allocatie in de hot path. Ze mogen
**niet** disposed worden — ze leven de hele run. Dat dit patroon al
bestond náást het ondode-lek is veelzeggend: de kennis was er, ze was
alleen niet op de vijandmodellen toegepast.

Gedeelde cache-materialen disposen zou álle objecten die ze delen zwart
maken. `ruimGroepOp()` moet ze aantoonbaar overslaan — markeer ze bij
aanmaak (bv. `material.userData.gedeeld = true`) in plaats van te
vertrouwen op een heuristiek.

### 8.4 Verbetergebied 2 — Frame-budget

#### 8.4.1 DOM-writes alleen bij een gewijzigde weergavewaarde (beslissing 64)

**Het probleem.** `updateHUD()` doet 9× `document.getElementById` plus
~8 DOM-writes, en wordt vanuit `updateSpelerRegen()` en
`updatePowerups()` élke frame aangeroepen zolang de speler regenereert
of een buff loopt. Gemeten: 60 writes/s naar `hpTekst`, dus ~540
`getElementById`-lookups per seconde. `updateInteracties()` schrijft
daarnaast élke frame `style.opacity` en bouwt bij een actief punt de
prompt-string opnieuw op.

**De regel die hieruit volgt.** *Een UI-element wordt alleen geschreven
als de te tonen waarde daadwerkelijk verandert.* De guard hoort IN de
schrijffunctie (`updateHUD()`, `toonInteractiePrompt()`), niet bij de
28 aanroepplekken — dat houdt de wijziging klein en voorkomt dat een
toekomstige aanroeper de regel per ongeluk omzeilt.

**Vergelijk op de weergegeven waarde, niet op de bron.** `spelerStaat.hp`
is een float die tijdens regeneratie élke frame verandert; `Math.round(hp)`
verandert ~1× per seconde. Vergelijken op de float levert nul winst op —
een valkuil die makkelijk over het hoofd te zien is.

**Waarom dit geen micro-optimalisatie is.** Het gaat niet om de kosten
van één write, maar om een structurele regel die voorkomt dat elke
volgende HUD-uitbreiding (zoals T76's ontsnappingsregel) er opnieuw 60
writes/s bij optelt.

### 8.5 Verbetergebied 3 — Vijandleesbaarheid

#### 8.5.1 Kijkrichting volgt looprichting (beslissing 65)

**Het probleem.** `updateOndoden()` zet de kijkrichting onvoorwaardelijk
op de richting náár de speler, terwijl de beweging het navigatiedoel
volgt (`volgendeDeur || tussenWaypoint || speler.positie`). Gemeten in
een cross-zone-scenario: bewegingshoek −156,4° tegenover kijkhoek
−166,9°, dus **10,5° mismatch**. Ligt het waypoint haaks op de
spelerrichting — rond een hoek, in de gang naar de gracht, bij de
kelderoost-deur — dan loopt dit structureel op richting 90°: de ondode
schuifelt zijwaarts terwijl hij je door een muur heen aanstaart.

**Waarom dit meer is dan cosmetiek.** De hele aanvals-tell uit T31
(armen omhoog, hoofd achterover, ogen pulsen) leunt erop dat je aan de
houding van een ondode kunt aflezen wat hij doet. Als de basisoriëntatie
al niet klopt met de beweging, wordt die tell moeilijker te lezen dan
ontworpen.

**De uitzondering die moet blijven.** Tijdens `aanvalStaat === 'windup'`
is naar de speler draaien juist correct — daar zit al een eigen,
beperkte bijdraai-limiet (`AANVAL_DRAAI_SNELHEID`) die het ontwijken
mogelijk maakt. Die tak blijft ongemoeid.

**Bewijslast.** Dit ticket mag uitsluitend de VISUELE oriëntatie
veranderen. De gelopen route (positiereeks over 60 ticks) moet
aantoonbaar identiek zijn vóór en ná — anders is het stilletjes een
pathing-wijziging geworden.

**Meetvalkuil, uit de audit.** Een eerste poging dit te meten gaf een
vals-negatief (0,0° verschil) doordat de test `deurGekocht` rechtstreeks
op `true` zette. Dat herbouwt `NAV_VOLGENDE` NIET — er was dus helemaal
geen navigatiedoel en beweging en blik vielen triviaal samen. De test
moet `koopDeur()` aanroepen zodat de nav-tabel echt herbouwd wordt.

### 8.6 Verbetergebied 4 — Betrouwbaarheid

#### 8.6.1 Zichtbare faalmodi (beslissing 66)

**Het probleem.** Three.js komt via een importmap van een CDN. Is die
onbereikbaar, dan wordt de module nooit uitgevoerd en gebeurt er
letterlijk niets: geen foutmelding, geen aanwijzing, alleen een dood
scherm. Het hele bestand bevat 2 `try`-blokken.

**De regel.** *Een faalmodus die de speler kan treffen, moet zichzelf
aankondigen.* Concreet: een klein klassiek (niet-module) scriptje vóór
de module-import zet een timer; bestaat `window.AmsterdamUndeadDebug`
na ~10 s nog niet, dan verschijnt een leesbare melding.

**Wat dit expliciet niet is.** Geen tweede CDN als uitwijk, geen
retry-logica, geen lokale Three.js-kopie in de repo — dat laatste zou de
"geen externe assets / single-file"-regel wél echt breken. Het doel is
uitsluitend: een begrijpelijk scherm in plaats van een zwart scherm.

**Validatie van opgeslagen data.** `leesHighscore()` doet `JSON.parse`
en gebruikt de velden ongevalideerd; corrupte opslag geeft geen crash
maar wel `Record: undefined` in beeld. Dezelfde stille-fallback-
filosofie als het bestaande `try/catch` krijgt er een vormcontrole bij.
Dit is nadrukkelijk **geen** beveiligingsmaatregel — zie §8.9.

#### 8.6.2 Spelerinstellingen (beslissing 67)

Muisgevoeligheid staat hardcoded (`0.0022`); er is geen enkele
spelerinstelling en ook geen plek waar zoiets zou horen. Deze ronde
introduceert er één, met het bestaande beschermde localStorage-patroon
(`leesHighscore`/`schrijfHighscore`) als sjabloon, plus twee
randvoorwaarden die uit eerdere feedback volgen: een corrupte waarde
wordt geklemd (anders is de camera onbestuurbaar en kan de speler er
niet meer uit), en het bedieningselement doet `stopPropagation()` zodat
klikken het spel niet ongewild start — exact de bug die Fix 4 bij de
geluidsknop opleverde.

### 8.7 Verbetergebied 5 — Spelerervaring

#### 8.7.1 De wincondition is niet ontdekbaar

Ontsnappen vereist drie dingen tegelijk: alle drie de vluchtonderdelen,
€2500, én een golf die aan `isOntsnappingsGolf()` voldoet. De HUD toont
daarvan alleen de onderdelen-teller en de boot-cadans. Het geldvereiste
komt nergens ter sprake vóórdat je bij het ontsnappingspunt staat.

Achter die voorwaarde zit een compleet winscherm met scorebonus — werk
uit T45 dat een gemiddelde speler waarschijnlijk nooit ziet. T76
verandert daarom uitsluitend de **communicatie**, niet de balans: geen
ander bedrag, geen ander aantal onderdelen, geen andere venstercadans.
Als de wincondition ná die verduidelijking nog steeds te zwaar blijkt,
is dát een apart balansbesluit met eigen meetwerk.

### 8.8 Verbetergebied 6 — Testinfrastructuur

#### 8.8.1 Resource- en levensduurtests als vaste categorie (beslissing 68)

De suite telt 48 scripts, allemaal integratietests op gedrag en state.
Geen enkele keek naar resourcegroei, DOM-groei, schrijffrequentie of
gedrag over een lange run — precies waardoor beslissing 63's lek 68
tickets lang onzichtbaar bleef. Deze ronde voegt die categorie toe als
permanent onderdeel van de suite.

**Twee meetvalkuilen, allebei in de audit zelf opgelopen.** Ze horen in
de test gedocumenteerd te staan, want beide leveren een vals-negatief
dat er geruststellend uitziet:

1. **Zonder gerenderde frames tussen spawn en kill registreert Three.js
   de geometrie nooit bij de renderer.** Een strakke synchrone
   spawn/kill-lus meet dan 0 groei terwijl het lek er wel degelijk is.
   De test moet echte `requestAnimationFrame`-ticks afwachten.
2. **Frustum culling kan meshes ongerenderd laten**, met hetzelfde
   effect. Zet in de meting expliciet `frustumCulled = false`.

**Harde eis aan de nieuwe test:** hij moet aantoonbaar FALEN op de code
van vóór beslissing 63 en slagen erna. Een test die nooit rood is
geweest, bewijst niets.

**Wat expliciet buiten scope blijft:** fps-/framerate-assercties. Deze
omgeving rendert via SwiftShader (software); de audit mat een mediaan
van 159 ms per frame, wat niets zegt over echte hardware. Framerate
hoort in DevTools op een echt apparaat, niet in de headless suite.

### 8.9 Beveiliging — expliciete positiebepaling

Voor de huidige scope is er **geen reëel beveiligingsrisico**: lokale
singleplayer, geen netwerk, geen secrets in de repo, `innerHTML`
uitsluitend met interne data. De validatie uit beslissing 66 is
robuustheid, geen beveiliging.

Wel expliciet vastleggen, omdat het later een verkeerde reflex kan
uitlokken: **alle score-, geld- en progressielogica staat client-side en
is via de debug-hook triviaal te manipuleren.** Dat is prima voor een
lokale game. Komt er ooit een gedeeld scorebord, dan is geen enkele
client-score te vertrouwen en hoort validatie serverside — dat is een
nieuw ontwerp, geen bugfix, en het heeft geen zin er client-side
tegenmaatregelen voor te bouwen.

### 8.10 Renderbudget (beslissing 69, voorwaardelijk)

De scene bevat 26 `PointLight`s plus 1 `HemisphereLight`. Three.js'
forward renderer neemt alle lichten op in de shader-uniforms en
evalueert ze per verlicht fragment, ongeacht afstand — er is geen
light-culling in de basisrenderer. Daarnaast: 486 meshes tegenover 445
unieke geometrieën (hergebruikratio 1,09, dus in de praktijk ~486 draw
calls) en 156 schaduwwerpende meshes bij één schaduwwerpend licht — een
`PointLight`, dus een cube shadow map met tot 6 passes.

**Dit is afgeleid uit de rendering-architectuur, niet gemeten op echte
hardware.** Daarom is T79 expliciet gegate op een profiling-stap: eerst
bevestigen dát dit de bottleneck is en hoeveel het scheelt, pas daarna
implementeren. Blijkt de winst verwaarloosbaar, dan wordt het ticket
gesloten zonder wijziging.

**Waarom dit het laatste ticket van de ronde is.** Lichtculling raakt de
helderheidsbalans die over vier feedbackrondes met pixelmetingen is
getuned (§7.5.5, §7.5.7-7.5.10). Elke wijziging moet met exact diezelfde
methode geverifieerd worden. Dat is een slechte plek om te beginnen en
een prima plek om te eindigen, ná het goedkope en zekere werk.

**Twee dwaalsporen die vastgelegd horen te worden.** `intensity = 0` is
géén culling — de uniform wordt nog steeds geëvalueerd, dus het lost
niets op; het moet `visible = false` of uit de scene. En overstappen op
een ander renderpad (deferred, baked lighting) is een herschrijving, geen
optimalisatie, en valt buiten deze ronde.

Geometrie-merging van statisch decor (`BufferGeometryUtils`) is om
dezelfde reden uitgesteld: het raakt `userData.materiaalFamilie`, dat de
impact-deeltjes gebruiken om de juiste kleur te kiezen. Pas overwegen ná
profiling, en dan als eigen ticket.

### 8.11 Nulmeting bij aanvang van deze ronde

Alle waarden gemeten op commit `da3524e`, headless Playwright met de
lokale Chromium. Ze dienen als vergelijkingsbasis voor de
acceptatiecriteria in ROADMAP T69-T79.

| Meting | Waarde | Methode |
| --- | --- | --- |
| Regressiescripts groen | 48/48 | `node run-all.mjs` |
| Regels in `amsterdam-undead.html` | 7.887 | `wc -l` |
| Meshes in de scene | 486 | `scene.traverse` |
| Unieke geometrieën | 445 (ratio 1,09) | `scene.traverse` + Set op uuid |
| Unieke materialen | 268 | idem |
| PointLights / HemisphereLights | 26 / 1 | idem |
| Schaduwwerpende lichten | 1 | idem (invariant §7.9) |
| Schaduwwerpende meshes | 156 | idem |
| Collision-obstakels | 52 | `obstakels.length` |
| Interactiepunten | 13 | `interactiePunten.length` |
| Muteerbare top-level `let` | 96 | `grep -cE '^let '` |
| `.dispose()`-aanroepen | **0** | `grep -c '\.dispose()'` |
| Geometrieën, scene leeg | 72 | `renderer.info.memory.geometries` |
| Geometrieën, 20 ondoden levend | 252 (**+9/ondode**) | idem, mét gerenderde frames |
| Geometrieën ná opruimen van die 20 | 252 (**niets vrijgegeven**) | idem |
| Geometrieën na 80 spawn/kill-cycli | 796 (lineair) | idem |
| HUD-writes tijdens regeneratie | 60/s | setter-spy op `hpTekst.textContent` |
| Kijk/loop-mismatch bij cross-zone-pathing | 10,5° | hoekvergelijking, nav-tabel herbouwd |
| 200 schot-raycasts | 20,3 ms (~0,1 ms/schot) | `performance.now()` — **prima, niet aanraken** |
| Frametijd | **niet betrouwbaar meetbaar** | SwiftShader-softwarerendering |

**Geëxtrapoleerde impact van het lek.** Bij het huidige budgetmodel
(`GOLF_BUDGET_BASIS` 5 + `GOLF_BUDGET_GROEI` 1,7/golf) spawnt een run
van 25 golven ~490 ondoden → ~4.400 gelekte geometrieën plus een
vergelijkbaar aantal materialen, permanent, groeiend met de speelduur.

---

## 9. Ronde 7 (v0.21) — Sfeer, wereld en verhaal

### 9.1 Scope en aanleiding

Deze ronde komt uit `IDEEEN.md` (de vooruitblik-sessie na v0.20), niet uit
een audit en niet uit een bugmelding. Acht ideeën zijn eruit gelicht:
E1 (zolderroute), E6 (etalages), I1 (richtinghoren), I4 (levend licht),
I5 (het geluid van Amsterdam), J3 (het stadsarchief), K1 (De Waterschouw)
en K2 (grachtengordel-namen).

Wat die acht gemeen hebben, en waarom ze samen één ronde vormen: ze
maken de wereld voelbaarder zonder de spelregels aan te raken. Geen
nieuw vijandtype, geen nieuw wapen, geen nieuwe upgrade, geen wijziging
aan het threat-budget. Dat is een bewuste keuze na v0.20: die ronde
raakte de fundering (resourcebeheer, frame-budget), en deze ronde bouwt
daarop verder in een richting waar de balans niet kan breken.

De zwaardere IDEEEN.md-gebieden (A kernlus, B vijanden, C wapens,
D speler-identiteit, G golfdoelen, H eindspel) blijven bewust buiten
deze ronde. Die raken allemaal wél de balans en horen in een eigen
ronde met een eigen balansverantwoording.

### 9.2 De invariant die deze ronde bewaakt

> **Geen enkel ticket in v0.21 mag een balansgetal wijzigen.**

Concreet verboden in deze ronde: `golfBudget()`, `GOLF_BUDGET_BASIS`,
`GOLF_BUDGET_GROEI`, `ONDODE_THREAT_KOSTEN`, `GOLF_MAX_ACTIEF`,
`ONDODE_HP_TRAPPEN`, `AANVAL_PROFIELEN`, alle `*_PRIJS`-constanten,
`GELD_PER_HIT`/`GELD_PER_KILL`, `POWERUP_DROP_KANS`, `SPELER_HP_MAX`,
`schadePerTreffer`/`WAPEN_SCHADE_MAX`.

Deze regel staat hier omdat sfeer-tickets een bekend faalpatroon hebben:
ze verschuiven de moeilijkheidsgraad ongemerkt. Een lamp die uitvalt op
het verkeerde moment, een geluidslaag die een tell overstemt, een zolder
die een gratis veilige plek blijkt — dat zijn alle drie balanswijzigingen
vermomd als sfeer. De tickets hieronder benoemen per stuk waar dat risico
zit.

### 9.3 Verbetergebied 1 — Ruimtelijk geluid (beslissing 70, T80)

**Het probleem.** Geluid in dit spel is nu binair: je hoort het of je
hoort het niet. Een grom van een ondode recht achter je klinkt akoestisch
identiek aan dezelfde grom recht vóór je. Voor een spel dat zoveel werk
in zichtbare leesbaarheid heeft gestoken (silhouetten per type, tells per
aanval, oogkleur per variant — zie §5.9 en Tickets 19-23/30-31) is de
auditieve leesbaarheid daarmee opvallend achtergebleven.

**Wat er al ligt.** De benodigde wiskunde bestaat al twee keer, los van
elkaar geïmplementeerd:

| Plek | Formule | Doel |
| --- | --- | --- |
| `berekenSchadeWedgeHoek()` (T68) | `kortsteHoekVerschil(Math.atan2(-dx, -dz), spelerYaw)` | CSS-rotatie van de schadepijl |
| `berekenBootHoornPanVolume()` (feedback) | idem, daarna `-Math.sin(hoek)` | StereoPanner van de boothoorn |

Ook de audio-graph-vorm ligt er al: `speelBootHoornGericht()` zet een
`StereoPannerNode` tussen de gain en `masterGainNode`. Dit is dus geen
nieuw systeem maar een generalisatie van twee bestaande.

**De beslissing.** Trek één gedeelde `berekenRelatieveHoek(bronX, bronZ,
spelerX, spelerZ, spelerYaw)` en één `hoekNaarPan(relatieveHoek)`, en
laat beide bestaande aanroepers daarop leunen. Geef `piep()` een optionele
`pan`-parameter.

**`piep()` moet achterwaarts compatibel blijven op graph-niveau.** Bij
`pan === 0` of een weggelaten argument mag er GEEN `StereoPannerNode`
worden aangemaakt: de keten blijft dan letterlijk `osc → gain →
masterGainNode`, precies zoals nu. Dat is geen microoptimalisatie maar
een testcontract: `test-geluidsknop.mjs` asserteert dat er precies één
`connect(audio.destination)` in de hele bron staat en dat alles via
`masterGainNode` loopt. Een panner die er altijd tussen zit, verandert 39
bestaande `piep()`-aanroepen tegelijk — dat wil je niet in hetzelfde
ticket als de functionele wijziging.

**De tekenval die dit ticket gevaarlijk maakt.** Er zitten twee
verschillende negaties in de bestaande code, om twee verschillende
redenen:

- De schadepijl negeert omdat CSS `rotate()` rechtsom-positief is,
  terwijl `atan2` linksom-positief is.
- De boothoorn negeert binnen `-Math.sin(...)` omdat de
  StereoPanner-conventie rechts = +1 is.

Die twee zijn NIET dezelfde negatie en mogen niet tot één "gewoon overal
een min" worden samengevat. Dit is exact de bugklasse die eerder al is
opgetreden (Fix 1: de schadepijl wees naar de speler toe in plaats van
ervandaan, zie §7.8.2.2). Daarom is de assertie in het testplan
richtinggevend geformuleerd (bron links ⇒ negatieve pan) en niet als
"pan is niet 0".

**Reikwijdte.** Alleen geluiden met een echte wereldpositie krijgen pan:
de ondode-grom (`speelOndodeGrom()`) en het breken van een plank
(`speelPlankBreek()`). Geluiden van de speler zelf (schot, herladen,
wisselen), UI-geluiden (koop, geen geld) en globale gebeurtenissen
(golfstart, stroomklap) blijven expliciet mono — die hebben geen bron in
de ruimte en pannen zou ze alleen maar verwarrend maken.

**Perf.** `speelOndodeGrom()` zit al achter een globale cap van 1 grom
per 0,6s (`ONDODE_GROM_GLOBALE_CAP`) en een bereikfilter van 8m
(`ONDODE_GROM_BEREIK`). Eén extra node per grom is daarmee begrensd op
~1,7 nodes/s, tegenover de bestaande piek van 10 schoten/s door de
Ratelaar die er geen krijgen.

**Wat dit NIET wordt.** Geen `PannerNode`/HRTF, geen afstandsdemping via
de Web Audio-panner. De bestaande handmatige volume-op-afstand-aanpak
(`BOOT_HOORN_VOLUME_VER`/`-DICHTBIJ`) blijft; alleen de links/rechts-as
komt erbij. Volledige 3D-audio is een eigen ticket met een eigen
luistertest, niet een bijproduct hiervan.

### 9.4 Verbetergebied 2 — Onbetrouwbaar licht en een levende stad

#### 9.4.1 Zeldzame lampuitval (beslissing 71, T81)

**Het idee.** Eens in de zoveel golven knipt één willekeurige lamp
0,3-0,5s volledig uit en weer aan, los van elke eventgolf.

**Waarom dit een eigen multiplier krijgt.** De flikkerloop
vermenigvuldigt nu al drie onafhankelijke factoren in
`l.licht.intensity`: de flikker-sinus (`amp1`/`amp2`), `lampDipFactor`
(T40, golfstart-dip) en `stroomFactorVoorLamp` (T46, Stroomuitval, met
een eigen kelder-vloer). Een vierde effect hoort daar als vierde,
onafhankelijke factor bij en mag NOOIT een van de bestaande drie
overschrijven. Anders herstelt de blackout bij het aflopen naar de
verkeerde waarde — precies het randgeval dat T46 al eens heeft gekost
(zie §6.5) — of erger: hij zet `stroomFactor` terug op 1 midden in een
Stroomuitval.

**Twee lampen zijn expliciet uitgesloten van blackout:**

1. **De enige schaduwwerpende lamp** (gemeten op positie `(0, 2.58, 0)`,
   woonkamer). Die uitzetten herstructureert 0,4s lang álle schaduwen in
   beeld. Dat leest niet als sfeer maar als een renderfout, en het raakt
   de schaduw-invariant uit §7.9 (precies één schaduwwerper) op de enige
   plek waar die zichtbaar is.
2. **De drie kelder-kamerlampen** (`l.stroomVloer !== undefined`). De
   kelder heeft geen ramen en geen daglicht; die lampen zijn daar de
   enige lichtbron. Een blackout is daar geen sfeer maar 0,4s volledige
   blindheid in een ruimte waar de speler juist veilig hoort te zijn.

Dat laat 5 van de 9 `lampLichten`-entries over als kandidaat. Die
uitsluiting is niet cosmetisch maar de reden dat dit ticket geen
balanswijziging is.

**Waarom niet gekoppeld aan een echte gebeurtenis.** Het is verleidelijk
om de blackout een voorbode te maken van iets (een golfmijlpaal, een
event). Bewust niet: zodra hij altijd iets betekent, wordt hij een
betrouwbare waarschuwing en dus een voordeel voor de speler — een
balanswijziging. Zodra hij nooit iets betekent, blijft het puur sfeer.
De keuze hier is "nooit", en dat is de veilige helft.

#### 9.4.2 Het Amsterdam-geluidsbed (beslissing 72, T82)

**Positie in de audio-graph.** Er hangen nu vier gain-nodes onder
`masterGainNode`: `dreigingsGainNode` (drone, plafond 0,07),
`muziekGainNode` (met `nevelklokGainNode` in serie ervóór, plafond 0,08),
en de losse `piep()`-ketens. Het stadsbed wordt de vijfde, met een
plafond van **0,03** — bewust lager dan beide bestaande permanente lagen.

**De harde regel: het stadsbed mag nooit een tell maskeren.** De
ondode-grom staat op volume 0,035-0,045 en is een gameplay-signaal (§5.9:
de Sluiper gromt níét, stilte is zijn tell). Een achtergrondlaag die
daar overheen komt, maakt een leesbaarheidssysteem kapot dat drie tickets
heeft gekost. Vandaar het plafond onder het gromvolume, en vandaar dat
het bed in dezelfde frequentieband als de drone (laag) blijft en niet in
de gromband (120-340 Hz) gaat zitten.

**Aansluiting op `masterGainNode`, niet op `audio.destination`.** Dit is
het contract uit Fix 4 (de geluidsknop): één enkele node op
`destination`, alles daarboven muteerbaar. `test-geluidsknop.mjs`
bewaakt dat met een bron-assertie.

**Throttling.** Zelfde patroon als `MUZIEK_THROTTLE_INTERVAL` /
`DREIGINGS_THROTTLE_INTERVAL`: de gain-schrijfacties gaan door een
throttle, nooit per frame. De losse gebeurtenissen (scheepshoorn,
kerkklok) zijn op zichzelf al zeldzaam en hebben geen throttle nodig,
maar wel een eigen timer los van de Nevelklok-cyclus — anders vallen ze
samen en klinkt het als één geluid.

### 9.5 Verbetergebied 3 — De wereld buiten het pand

#### 9.5.1 De Waterschouw (beslissing 73, T83)

**Het idee.** Een tweede boot die periodiek voorbijvaart en NOOIT stopt.

**De hoofdeis: onverwarbaar met de ontsnappingsboot.** De
ontsnappingsboot is een van de belangrijkste signalen in het spel (§6.4,
Tickets 54-55: aankondiging, hoorn, banner, lantaarnpuls, minimap-marker).
Een tweede boot die er ook maar een beetje op lijkt, kost de speler een
run. Drie scheidingen zijn daarom verplicht, niet optioneel:

1. **Andere hoorn.** De ontsnappingshoorn is 200 → 140 Hz over 1,1s. De
   schouw krijgt een duidelijk andere band en lengte (voorstel: hoger en
   korter), zodat de twee ook door een muur heen te onderscheiden zijn.
2. **Andere minimap-marker.** De boot-marker is nu een `arc`. De schouw
   mag geen `arc` zijn.
3. **Nooit een interactiepunt.** De schouw voegt niets aan
   `interactiePunten` toe, ooit.

**Eigen groep, eigen update.** `updateBootPositie()` schrijft élke frame
onvoorwaardelijk `bootGroep.position.x` op basis van de
ontsnappingsstaat. De schouw krijgt daarom een eigen `schouwGroep` en een
eigen updatefunctie; hij mag `bootGroep` niet aanraken. Zou hij dat wel
doen, dan vecht hij elke frame met `updateBootPositie()` om dezelfde
property.

**Bestaande test die MOET meebewegen.** `test-boot-aankondiging.mjs`
asserteert nu letterlijk "precies 1 boot-marker (arc) getekend" en "geen
boot-marker zonder aankondiging/venster". Zodra de schouw een marker
tekent, is die assertie te grof. Hij moet worden aangescherpt naar "de
ONTSNAPPINGS-marker (arc) wordt precies 1x getekend", niet verwijderd of
verzwakt. Dit staat hier expliciet omdat de reflex ("test faalt, dus test
aanpassen") hier precies de verkeerde kant op kan gaan.

#### 9.5.2 Het pand krijgt een adres (beslissing 74, T84)

Puur tekstueel: een verzonnen grachtnaam plus huisnummer op het
startscherm, het winscherm en een klein naambordje bij de voordeur.

**IP-regel (CLAUDE.md).** De naam moet **verzonnen** zijn. Geen bestaande
Amsterdamse gracht met een echt huisnummer — dat zou een bestaand,
aanwijsbaar adres in een zombiespel plaatsen. Een geloofwaardig
Nederlands klinkende, niet-bestaande naam voldoet aan zowel de sfeer-eis
als de IP-regel.

### 9.6 Verbetergebied 4 — Sporen van de run (beslissing 75, T85)

**Het idee.** Decor dat meeverandert met wat er in een run gebeurd is:
dichtgetimmerde ramen op golfmijlpalen, een vollere ereplank bij de
Smederij per gesmeed wapen, zichtbaar zwaarder bevochten zones.

**De hoofdrisico: dit is precies het patroon dat T69/T70 net hebben
opgeruimd.** Decor dat tijdens een run wordt bijgemaakt is per definitie
runtime-allocatie. Drie harde regels volgen daaruit:

1. **Materialen via `mat()`/`matFamilie()`**, nooit via een directe
   `new THREE.MeshStandardMaterial(...)`. Anders lekt elke mijlpaal een
   materiaal, en dat is letterlijk de bug die beslissing 63 dichtte.
2. **Geometrie via `geoCache()`** (T69), om dezelfde reden.
3. **Alleen op golfovergangen, nooit per frame.** De trigger hoort in
   `startGolf()` of het wave-complete-blok, niet in de gameLoop.

**Geen collision.** Nieuw decor mag niets aan `obstakels` toevoegen. De
kaart is via 52 obstakels zorgvuldig getuned en heeft een eigen
waypointlaag; een extra dichtgetimmerd raam dat ineens blokkeert,
verandert pathing en dus balans.

**Voorkeur voor "vervangen" boven "toevoegen".** Een raam dat
dichtgetimmerd raakt, hoort bij voorkeur een bestaande mesh van materiaal
te wisselen in plaats van er een nieuwe naast te zetten. Dat houdt de
mesh-telling constant en maakt de resourcetest uit T77 automatisch de
bewaker van dit ticket.

### 9.7 Verbetergebied 5 — Meta-progressie zonder powercreep (beslissing 76, T86)

**Waarom dit veilig is waar andere meta-progressie dat niet is.** Het
stadsarchief ontgrendelt uitsluitend cosmetische varianten (kleursets,
mondingsvlam-tint, intro-melodie). Het kan de balans niet raken, ook niet
per ongeluk, omdat er geen enkel getal in staat dat de spelregels leest.
Dat is het hele punt: het geeft een reden om terug te komen zonder de
arcade-lus te verschuiven. Het tegenargument uit `IDEEEN.md` J-sectie
(elke keuze vóór golf 1 kost directheid) geldt hier nauwelijks, want de
keuze is optioneel en heeft geen mechanische consequentie.

**Opslag.** Eigen `localStorage`-sleutel naast `amsterdamUndeadHighscore`
en `amsterdamUndeadGevoeligheid`, met exact het beschermde patroon uit
T74/T75: `try/catch` om elke toegang, vormvalidatie bij het lezen, veilige
default bij twijfel.

**Vooruit- en achterwaartscompatibel.** Onbekende sleutels in de opslag
worden genegeerd in plaats van als corrupt behandeld. Anders wist een
oudere versie de ontgrendelingen van een nieuwere. Dit is een klein
detail dat later duur wordt.

**Ontgrendelingen zijn additief en onomkeerbaar.** Eenmaal ontgrendeld
blijft ontgrendeld; er is geen pad dat iets terugneemt. Dat scheelt een
hele klasse aan randgevallen (halve staat, terugrol na een crash).

### 9.8 Verbetergebied 6 — Verticaliteit, en waarom de voor de hand liggende versie niet kan (beslissing 77, T87)

Dit is de belangrijkste architectuurbevinding van deze ronde.

**De invariant.** `berekenKelderY(x, z)` is een **pure functie van x en
z**. Dat is geen implementatiedetail maar de aanname waar vijf systemen
tegelijk op rusten:

| Systeem | Hoe het de invariant gebruikt |
| --- | --- |
| `updateSpeler()` | zet `speler.positie.y` rechtstreeks uit x/z |
| `updateOndoden()` | zet per ondode `positie.y = berekenKelderY(...)` |
| `losBotsingenOp()` | volledig 2D — kent geen hoogte |
| `zoneVan(x, z)` | volledig 2D |
| `tekenMinimap()` | 2D, met één kelder-uitzondering |

**Waarom de kelder wél kon.** De kelder heeft een **disjuncte
footprint**: hij ligt op x/z waar géén begane grond begaanbaar is (§7.11
noteert dat expliciet als "disjuncte footprint"). Daardoor blijft x/z → y
een functie, en hoefde geen van de vijf systemen iets te weten van
hoogte-als-toestand.

**Waarom een zolder bóven het atelier dat breekt.** Twee begaanbare
vloeren boven dezelfde x/z maken y een *relatie* in plaats van een
functie. Dan moet elk van de vijf systemen hierboven een verdiepingsbegrip
krijgen: de speler-Y, de ondode-Y, de collision (per verdieping andere
muren), `zoneVan()` (twee zones op dezelfde x/z) en de minimap (welke
verdieping teken je). Dat is geen ticket maar een architectuurwijziging
met vijf gelijktijdige risicopunten, midden in systemen die net in v0.20
zijn opgeschoond.

**De beslissing (T87): de Vliering, met een disjuncte footprint.**
Verticaliteit wordt toegevoegd volgens exact het kelder-precedent: een
verhoogde ruimte op x/z waar de begane grond niet begaanbaar is,
bereikbaar via een ladder/luik, met een uitzicht over een aangrenzende
zone. `berekenKelderY()` wordt hernoemd/uitgebreid tot een
`berekenVloerY(x, z)` die daar een positieve hoogte teruggeeft. Alle vijf
systemen blijven ongewijzigd werken, inclusief ondode-navigatie: ondoden
kunnen de vliering gewoon op, zonder één regel in `updateOndoden()`.

**De footprint-eis is een testeis, geen ontwerpsuggestie.** De exacte
coördinaten horen bij de implementatie, maar de voorwaarde is hard: de
vliering-footprint mag op geen enkel punt samenvallen met begaanbare
begane grond. Dat moet bewezen worden met een rastertest over de hele
kaart — het precedent bestaat al letterlijk in
`test-kelder-trap.mjs` ("berekenKelderY is exact 0 op ALLE 15327
bovengrondse rasterpunten"). Zonder die test is dit ticket niet af.

**Wat er expliciet NIET in T87 zit.** Geen nieuwe zone-id (de vliering
deelt zijn zone met de ruimte eronder/ernaast, net als de kelder zone 2
deelt met het atelier), geen wijziging aan `ZONE_GRAAF`, geen nieuwe
deur-aankoop in de zonegraaf, geen wijziging aan spawn-druk. De vliering
is ruimte, geen nieuwe zone.

**De afgewezen zware variant (backlog).** Een volwaardige verdiepingslaag
(`berekenVloerY(x, z, verdieping)`, per-verdieping collision, ondoden die
tussen verdiepingen navigeren, een minimap met verdiepingskeuze) staat in
de ROADMAP-backlog. Niet omdat het onmogelijk is, maar omdat de
kosten/risico-verhouding pas verantwoord is als er een concrete
speelreden voor is die de vliering niet al dekt. Wie dat ooit oppakt,
begint bij deze paragraaf.

#### 9.8.1 Implementatieverslag T87 (uitgevoerd)

**Gekozen footprint: de dode hoek ten zuiden van de nis.** Sinds v0.4
verzegelen de nis-afsluitmuur (z = `KAMER2_NIS_Z_ZUID`) en de
atelier-weststomp (x = `-KAMER2_HALF_B`) samen een rechthoek die op de
begane grond volledig onbereikbaar is. Dat is aangetoond, niet
aangenomen: een flood-fill vanaf de startpositie met ALLE deuren gekocht
vindt 9878 bereikbare rastercellen, waarvan er **0** in die hoek liggen.
Die flood-fill staat als sectie 1 in `tests/test-vliering.mjs` en is,
zoals het ticket eist, geschreven en groen gedraaid vóór er ook maar één
mesh gebouwd was.

**Waarom `isVrijePlek()` hier niet volstaat.** Die functie kijkt alleen
naar obstakel-overlap en GRENS, niet naar bereikbaarheid — hij meldt 221
punten in de dode hoek als "vrij", terwijl er geen enkele route heen
bestaat. Wie de footprint-eis met `isVrijePlek()` toetst, toetst dus iets
anders dan wat er staat. De flood-fill gebruikt hetzelfde primitief als
`losBotsingenOp()` zelf (cirkel-tegen-rechthoek + de GRENS-klem incl.
kelder-bypass).

**`berekenKelderY()` is NIET hernoemd.** Het ticket noemde
"uitgebreid/hernoemd tot `berekenVloerY(x, z)`", maar dat botste met de
eis dat `test-kelder-trap.mjs` ongewijzigd groen blijft: dat bestand
asserteert onder meer dat `berekenKelderY` exact 0 is op alle 15327
bovengrondse rasterpunten, en de vliering ligt binnen dat bereik.
Gekozen oplossing: `berekenKelderY()` blijft precies wat hij was (de
kelderTERM), `berekenVlieringY()` is de vlieringterm, en
`berekenVloerY()` is de nieuwe samengestelde vloerfunctie waar alle
consumenten doorheen gaan. Beide bestaande rasterassertie blijven
daardoor letterlijk waar én blijven bewaken wat ze bewaakten;
`test-kelder-trap.mjs` is niet aangeraakt en bleef 54/54 groen.

**Eén systeem minder aangeraakt dan bij T62.** De vlieringfootprint ligt
volledig binnen GRENS (x ≥ `GRENS.minX`), in tegenstelling tot de kelder
die ten westen daarvan ligt. `losBotsingenOp()` bleef daardoor letterlijk
ongewijzigd — geen tweede bypass naast `magKelderBinnen`. `zoneVan()`
bleef eveneens ongewijzigd: de hele vliering ligt op z < `GANG_Z_EIND`
en valt dus vanzelf in zone 2, precies zoals het ticket voorschreef
("de vliering is ruimte, geen nieuwe zone").

**Ondode-navigatie.** Zonder tussenstap duwt een ondode in het atelier
recht tegen de borstwering — dan zou de vliering "een gratis veilige plek
waar ondoden niet komen" zijn, oftewel een balanswijziging. Opgelost met
één extra intra-zone waypoint (`VLIERINGTRAP_VOET_PUNT`) in
`ZONE_WAYPOINTS[2]`, op exact dezelfde manier als de kelder-trap: het
punt ligt op zijn eigen zijde-drempel, zodat "aankomen" ook echt
"overgestoken" betekent. Getoetst met een trajectory-trace: een ondode
die midden in het atelier start, staat binnen 60s daadwerkelijk bovenop
de vliering, met zijn Y op vlieringhoogte.

**Licht.** De performancevoorwaarde ("geen extra licht") is gehaald: het
budget staat nog steeds op 26 PointLights en op exact 1 schaduwwerpend
licht. Zonder lichtbron rendert de ruimte echter praktisch zwart — je ziet
niet waar je staat. Opgelost met een lage `emissive` op het vloer- en
muurmateriaal (zelfde "emissive i.p.v. een echt licht"-techniek als de
Smederij-gloed), plus een emissief olielampje als visueel anker.

**Obstakels: 52 → 56** (gesplitste weststomp +1, vliering-westmuur +1,
vliering-zuidmuur +1, kokerwand +1). Vastgelegd in
`tests/test-vliering.mjs`; de bestaande tellers in `test-pand-adres.mjs`,
`test-etalages.mjs` en `test-resources.mjs` zijn meeverhoogd met behoud
van hun oorspronkelijke bedoeling (die assertie ging steeds over "deze
feature voegt zelf niets toe", niet over het absolute getal).

#### 9.8.2 Vervolg na de eerste speeltest (op verzoek)

Drie aanpassingen na feedback op de opgeleverde vliering:

1. **Plafond atelier/nis/vliering +12,5%** (3,2 → 3,6) via een eigen
   `ATELIER_HOOGTE`. De vliering deelde zijn stahoogte met het atelier en
   die was met 2,0 m krap. Bewust NIET `KAMER_HOOGTE` opgehoogd: dat zou
   elke kamer, deurhoogte en hanglamp in het pand veranderen én de
   vastgelegde invariant `KELDER_HOOGTE === KAMER_HOOGTE`
   (test-kelder-trap.mjs) breken. Alleen het atelier, de nis en de
   vliering gebruiken de nieuwe constante; alle muren die die ruimtes
   begrenzen én de erin hangende dakramen en deur2/deur5-meshes krijgen
   'm mee, zodat er nergens een kier ontstaat. Stahoogte op de vliering
   is nu 2,4 m.

2. **Traplampje bij de ingang.** Zonder lichtbron viel de trapopening in
   de weststomp niet op. Dit is een bewuste, gevraagde afwijking van de
   oorspronkelijke T87-performancevoorwaarde "geen extra licht": het
   lichtbudget gaat van 26 naar 27 PointLights. De schaduw-invariant
   (exact 1 schaduwwerpend licht) blijft ongewijzigd, en de lamp is in
   `lampLichten` geregistreerd zodat de bestaande flikker- en
   Stroomuitval-dimloop 'm automatisch meenemen. `lampLichten` moest
   daarvoor eerder in het bestand gedeclareerd worden — het
   vliering-geometrieblok draait vóór het oude declaratiepunt.

3. **De Zelflader** (€1000, koopbaar op de vliering): eenmalige upgrade
   die het herladen automatisch start zodra het magazijn leeg is, zodat
   R niet meer nodig is. Geldt na aankoop voor beide wapens (globale
   vlag, niet per `wapenStaat`). Bewust alleen op LEEG en niet bij een
   half magazijn — anders herlaadt hij ongevraagd midden in een
   vuurgevecht en verlies je reserve-kogels. Het interactiepunt staat op
   `positie.y = VLIERING_Y`, zodat de bestaande `KELDER_Y_MARGE`-check in
   `updateInteracties()` 'm alleen aanbiedt als je ook echt boven staat.
   `winkelMarkering()` kreeg daarvoor een optionele `y`-parameter (default
   0, dus alle bestaande aanroepen ongewijzigd).

   **Let op — dit is een echte gameplay-toevoeging, geen sfeer.** Hij valt
   daarmee buiten de v0.21-invariant uit §9.2 ("geen ticket in deze ronde
   wijzigt een balansgetal"). Dat is een expliciete keuze van de
   gebruiker, geen sluipende uitbreiding: er is een nieuw prijsgetal
   (`AUTOHERLADER_PRIJS`) bijgekomen, geen bestaand balansgetal gewijzigd.

#### 9.8.3 Vervolg na de tweede speeltest (op verzoek + bugmelding)

Drie punten na de eerste ronde vliering-feedback:

1. **Vlieringlamp gecentreerd tegen het plafond.** Stond eerst in een hoek
   op ~1,5 m hoogte ("ziet er wat random uit"); hangt nu aan een koord
   midden boven het hoofdvlak van de vliering (bewust het noordelijke,
   brede deel — niet het smalle zuidstrookje naast de trap, dat ligt uit
   het midden), tegen het plafond, zelfde silhouet als `hangLamp()`.
   Nog steeds puur decoratief, geen `PointLight` — lichtbudget blijft 27.

2. **De Zelflader kreeg een fysiek object.** Elk ander kooppunt heeft naast
   de abstracte ring+icoon-`winkelMarkering()` ook een eigen decor-mesh
   (watertap: paal+kraan; Smederij: aambeeld) — dat ontbrak hier. Nu een
   metalen sokkel + liggende kogeltrommel + een klein teal-emissief
   indicatielampje, exact op de plek van de markering.

3. **Bugfix: ondoden liepen vast op de vliering** zodra de speler naar een
   andere zone liep (gemeld: vanaf de binnenplaats). Twee onafhankelijke
   oorzaken, allebei gefixt:

   - **Routeringsbug in `updateOndoden()`.** `zoekWaypoint()` (de
     sub-area-chokepointlaag uit T64/T65, incl. het T87-vlieringpunt) werd
     vóór deze fix ALLEEN geraadpleegd als de ondode in dezelfde zone als
     de speler zat (`volgendeDeur === null`). Zodra de speler een andere
     zone in liep, werd `volgendeDeur` (het cross-zone deurpunt) direct als
     doel gekozen — zonder eerst de disjuncte vliering-/kelder-subruimte te
     verlaten via de eigen trap-/hellingwaypoint. Een ondode op de vliering
     liep dan recht tegen de borstwering aan: een gratis veilige plek,
     precies wat het ticket verbiedt. Fix: `zoekWaypoint()` draait nu
     ALTIJD en wint van `volgendeDeur` zodra de zijde-functie een mismatch
     geeft (`doelPunt = tussenWaypoint || volgendeDeur || speler.positie`).
     Binnen dezelfde zone was `volgendeDeur` altijd al `null`, dus dat pad
     is functioneel ongewijzigd — dit raakt uitsluitend het cross-zone
     geval. Werkt hierdoor ook meteen voor het kelder-equivalent van
     hetzelfde scenario, niet alleen de vliering.
   - **Geometrische val bij de treduitgang.** Onafhankelijk van de
     routeringsbug bleek de "noordwand van de trapkoker" (T87) tot precies
     de hoek van de opening in de oostmuur te lopen. Twee muren die in
     exact hetzelfde punt een rechte hoek vormen zijn een klassieke val
     voor een collisiestraal (`ONDODE_STRAAL` 0,4): een diagonale nadering
     raakt bijna onvermijdelijk beide muren tegelijk en kan geen kant op.
     Fix: die muur dekt nu alleen de westelijke (hoge) helft van de
     helling — waar het hoogteverschil bij zijwaarts afstappen het grootst
     is — en laat de oostelijke helft, dicht bij de uitgang waar de vloer
     toch al bijna op atelierniveau ligt, open.

   Beide fixes waren onafhankelijk nodig: de routeringsbug alleen had de
   ondode nog steeds bij de trapvoet-hoek vast laten lopen; de
   muurgeometrie alleen had niets uitgemaakt zolang `doelPunt` nooit naar
   de trapvoet wees. `tests/test-vliering.mjs` sectie 18-19 legt het exacte
   bugscenario (speler op de binnenplaats, ondode op de vliering) vast als
   regressie.

#### 9.8.4 Feedback: "Boot over N golven" was misleidend vóór een complete vluchtroute

T76 (§8.7.1) toonde de "Boot over N golven"-regel al zodra het EERSTE
vluchtonderdeel binnen was, met opzet — de wincondition moest
ontdekbaar zijn zonder toevallig bij de boot te staan. In de praktijk
bleek dat misleidend: de golf-aftelling klopte, maar
`probeerOntsnappingsVensterTeOpenen()`/`updateOntsnappingsVenster()`
eisen allebei `vluchtOnderdelenOpgepakt >= VLUCHT_ONDERDELEN.length`
(3/3) vóór het venster echt opengaat. Met 1 of 2 onderdelen verscheen de
boot die golf dus niet — de melding beloofde iets wat niet gebeurde.

Fix (in `updateOntsnappingVensterHUD()`): de regel blijft nu leeg totdat
de vluchtroute compleet is (3/3), ongeacht de golf. Zodra dat zo is,
verschijnt de melding meteen, ook vóór `ONTSNAPPING_START_GOLF` — dat
deel van T76's bedoeling (niet wachten tot golf 10 om de countdown te
tonen) blijft overeind, alleen de drempel is verschoven van "1e
onderdeel" naar "3e onderdeel". `updateVluchtrouteHUD()`'s eigen
`N/3 · €PRIJS nodig`-regel (zichtbaar vanaf het 1e onderdeel) blijft
ongewijzigd — die belofte klopt namelijk wel meteen: het geldvereiste
geldt zodra je er ook maar íets van hebt. Getest in
`tests/test-ontsnapping-vensters.mjs` (secties 6b/6c).

#### 9.8.5 Navigatie-refactor: van keten naar boom (feedbackronde)

Melding: "de waypoint-navigatie gaat niet goed — als ik op de vliering sta en
ze komen vanaf de kelderingang gaat het ook mis". Aanleiding om niet één
symptoom te fixen maar de hele kaart te meten.

**Meetopzet eerst.** `tests/test-navigatie-dekking.mjs` zet elke ondode-plek
tegen elke spelerplek (12 plekken, 132 paren) en eist aankomst binnen 60s. De
eerste meting gaf **15 vastlopers**; dat maakte de diagnose feitelijk in
plaats van speculatief, en elke fix hieronder is erdoor aangetoond.

**Kernbevinding: zone 2 is een BOOM geworden, geen keten.** Sinds de kelder,
kelderoost en de vliering deelt zone 2 zijn id met vijf deelruimtes:

```
atelier (hub)
  └── nis ──── keldertrap-koker ── kelderruimte ── kelderoost
  └── vlieringhelling ── vlieringvlak
```

De oude regel in `zoekWaypoint()` was "pak het DICHTSTBIJZIJNDE toepasselijke
waypoint". Dat klopt voor een keten, maar kiest in een boom structureel fout:
vanaf het vlakke deel van de vliering ligt de trapVOET dichterbij dan de
trapTOP, terwijl de kokernoordwand daar precies tussen staat. Vervangen door
een genest model — elk waypoint bewaakt één deelruimte met een `binnen(x,z)`
en een `niveau` — met de regel: *zit je in een deelruimte waar je doel niet in
zit, verlaat dan eerst de diepste daarvan; zit je erbuiten, betreed dan de
ondiepste die je doel wel bevat.* Nog steeds één lus zonder graaf-traversal.

**Drie fouten die de meting blootlegde, alle drie structureel:**

1. **Zelfterminatie.** Een waypointpunt dat aan de verkeerde kant van zijn
   eigen grens ligt, laat de ondode mikken op de plek waar hij al staat —
   nul-richting, dus stilstand. Elke doorgang heeft nu een aanlooppunt aan
   BEIDE kanten (`puntBuiten`/`puntBinnen`); verlaten mikt op buiten,
   binnengaan op binnen. Vastgelegd als losse invariant in de test.
2. **Tweetraps-nadering.** Een koker is vaak alleen langs zijn eigen as te
   bereiken. Mikte een ondode meteen op het punt aan de overkant, dan liep die
   lijn schuin door de muur ernaast. Hij mikt nu eerst op het punt aan zijn
   eigen kant en steekt pas over als hij daar is. De omschakeling gebeurt op
   de afstand tot het punt aan de OVERKANT — die is monotoon; een eerdere
   versie mat de afstand tot het eigen punt en liet de ondode precies op die
   cirkel omkeren.
3. **Gaten in de deelruimte-definities.** De deur6-opening viel tussen
   kelderoost (begint strikt oostelijker) en de kelderruimte (eindigt precies
   daar) in: een ondode dáár hoorde bij geen enkele deelruimte en mikte dwars
   door de massieve muur. Opgelost met `isKelderoostGebied()`, dat de
   deuropening expliciet meeneemt.

**Twee geometrische bijstellingen.** De trapopening van de vliering ging van
1,2 m naar 1,8 m (bij de trapmond komen twee muren onder een rechte hoek
samen; een ondode van 0,8 m breed hield daar net genoeg contact met beide om
vast te blijven zitten). En de nis kreeg een eigen doorgang in de boom: sinds
de vliering bestaat staat de 7 m lange borstwering pal tussen de vlieringtrap
en de nis, en de nis is bovendien de enige toegang tot het keldercomplex — hij
hoort dus ook hiërarchisch boven de kelder te staan.

**Wat NIET geholpen heeft** (genoteerd omdat het plausibel klinkt): een
"commit-regel" waarbij een ondode zich aan zijn gekozen waypoint vastlegt tot
hij er is. Dat verving de flipflop door een ondode die op zijn waypoint bleef
staan, en verdrievoudigde het aantal vastlopers (15 → 48). De echte oorzaak
zat in de puntplaatsing, niet in de besluitvorming.

**Eindstand: 0 van de 132 routeparen loopt vast**, langste legitieme route 33s
(gracht ↔ kelderoost, vijf chokepoints). De vliering is daarbij weer volledig
dicht met de helling als enige toegang, zoals gevraagd.

### 9.9 Wat deze ronde bewust niet doet

- **Geen balanswijziging** (§9.2), in geen enkel ticket.
- **Geen nieuw vijandtype, wapen of upgrade.** IDEEEN.md B/C/D zijn een
  eigen ronde met een eigen balansverantwoording.
- **Geen tweede winconditie.** IDEEEN.md E5/H behandelen dat; het raakt
  het zorgvuldig opgebouwde eindspel en hoort niet tussen sfeer-tickets.
- **Geen volledige 3D-audio.** §9.3 beperkt zich tot de links/rechts-as.
- **Geen procedurele kaart, geen modules, geen buildstap.** De
  één-bestand-regel en de hand-ontworpen kaart blijven (zie
  waarschuwing 48).

### 9.10 Nulmeting bij aanvang van deze ronde

Gemeten op de stand ná v0.20 (commit `ac3fa43`), met `node run-all.mjs`
en een debug-hook-traversal:

| Grootheid | Waarde | Meetmethode |
| --- | --- | --- |
| Regressiescripts groen | 52/52 | `node run-all.mjs` |
| Regels in `amsterdam-undead.html` | 8.197 | `wc -l` |
| `piep()`-aanroepen | 39 | `grep -c 'piep('` |
| `speel*()`-functies | 32 | `grep -c '^function speel'` |
| `StereoPannerNode`-gebruik | 1 (alleen boothoorn) | `grep -c 'createStereoPanner'` |
| Permanente audio-lagen op master | 4 | `grep -c 'connect(masterGainNode)'` |
| `lampLichten`-entries | 9 (waarvan 3 kelder) | `d.lampLichten` |
| Schaduwwerpende lichten | 1, op `(0, 2.58, 0)` | `scene.traverse` |
| PointLights totaal | 26 | idem |
| `buitenLichten` | 9 | `d.buitenLichten.length` |
| Collision-obstakels | 52 | `obstakels.length` |
| Interactiepunten | 13 | `interactiePunten.length` |
| Zones (`ZONE_NAMEN`) | 5 | idem |
| `localStorage`-sleutels | 2 (highscore, gevoeligheid) | `grep '_KEY ='` |

Deze getallen zijn de vergelijkingsbasis voor de acceptatiecriteria
hieronder. Vier ervan mogen door deze ronde veranderen (audio-lagen 4→5,
StereoPanner 1→2+, localStorage-sleutels 2→3, regels omhoog); de rest
hoort gelijk te blijven — met name **collision-obstakels (52)** en
**schaduwwerpende lichten (1)**.

---

## 10. Ronde 8 (v0.22) — Visuele architectuur

### 10.1 Scope en aanleiding

Deze ronde komt uit `VISUEEL.md` (de technical-artist-analyse na v0.21),
niet uit een audit en niet uit een bugmelding. Die analyse bracht de
huidige rendering-pipeline in kaart, mat de scene door, en formuleerde 47
visuele richtingen over negen gebieden. De eigenaar heeft daaruit
**23 richtingen** goedgekeurd, plus de vier infrastructuurstappen die ze
mogelijk maken.

Vier kaderkeuzes van de eigenaar sturen deze hele ronde:

| Keuze | Antwoord | Gevolg |
| --- | --- | --- |
| Visuele richting | **Donkerder en rijker** | Het bestaande DNA wordt versterkt, niet vervangen. Geen enkel ticket maakt de scene structureel lichter. |
| Doelhardware | **Gemiddelde laptop/browser** | Geen dedicated GPU verondersteld. Fragment-kosten zijn het schaarse goed (§10.3). |
| Scope | **Laag 1 + laag 2** | De risicovolle laag 4 uit VISUEEL.md §3.3 valt buiten deze ronde — met name de schaduw-wissel (A5). |
| Wereld buiten de kaart | **Ja** | Nachthemel en skyline-silhouet zijn toegestaan; de fogdiepte per zone is daar de voorwaarde voor. |

**Wat de 23 richtingen gemeen hebben.** Ze voegen geen enkele
gameplay-regel toe. Geen nieuw vijandtype, geen nieuw wapen, geen nieuwe
upgrade, geen wijziging aan het threat-budget. Ze veranderen uitsluitend
hoe de bestaande wereld eruitziet. Dat is dezelfde discipline als
ronde 7, en om dezelfde reden: een ronde waarin de balans niet kan
breken, is een ronde die je zonder speeltest-per-ticket kunt uitvoeren.

**Wat er expliciet buiten valt.** SSAO, echte volumetrische mist, echte
spiegelreflectie op water, extra echte lichtbronnen, een ander renderpad,
regen, mistslierten, de volledige kleurmigratie, de env-map, de
tonemapping-curve, en de schaduw-wissel (A5). De onderbouwing per stuk
staat in `VISUEEL.md` §3.4. Twee daarvan verdienen hier herhaling omdat
ze het budgetmodel van deze ronde definiëren — zie §10.3.

### 10.2 De invarianten die deze ronde bewaakt

Ronde 7 had één invariant (geen balansgetallen). Deze ronde heeft er
**zes**, en ze zijn alle zes machinaal controleerbaar. Dat is bewust: een
visuele ronde heeft geen natuurlijke faalsignalen — een te licht beeld
of een gezakte framerate meldt zichzelf niet, in tegenstelling tot een
crash of een vastlopende ondode.

> **1. De helderheidsbasislijn.** Elke wijziging aan licht, materiaal of
> post-processing wordt getoetst aan de per-zone helderheidsmeting uit
> T88. Buiten de vastgelegde band ⇒ het ticket is niet af.

> **2. Het lichtaantal blijft 28.** Geen enkel ticket in v0.22 voegt een
> `THREE.Light` toe of verwijdert er een. De scene houdt 1
> `HemisphereLight` + 27 `PointLight`s, waarvan er **precies één**
> schaduw werpt (§7.9, ongewijzigd).

> **3. Gameplay-leesbaarheid gaat boven schoonheid.** Een aanvallende
> ondode, een schotrichting en een interactiepunt moeten altijd
> afleesbaar blijven. Waar een ticket dat kan aantasten, staat het als
> expliciete acceptatie-eis in het testplan.

> **4. Geen balansgetallen.** De verbodenlijst uit §9.2 blijft
> onverkort gelden: `golfBudget()`, `GOLF_BUDGET_*`,
> `ONDODE_THREAT_KOSTEN`, `GOLF_MAX_ACTIEF`, `ONDODE_HP_TRAPPEN`,
> `AANVAL_PROFIELEN`, alle `*_PRIJS`-constanten, `GELD_PER_HIT`/
> `GELD_PER_KILL`, `POWERUP_DROP_KANS`, `SPELER_HP_MAX`,
> `schadePerTreffer`/`WAPEN_SCHADE_MAX`.

> **5. `obstakels` blijft 56.** Geen enkele visuele toevoeging krijgt
> collision. Contactschaduwen, lichtkegels, plinten, skyline: allemaal
> decor.

> **6. Het resourcecontract uit T69/T70 blijft heel.** Materialen via
> `mat()`/`matFamilie()`, geometrie via `geo()`/`geoCache`, wegwerp-
> objecten via `ruimGroepOp()`. Deze ronde voegt veel meshes en
> materialen toe en is dáármee de grootste bedreiging voor het contract
> sinds het gelegd werd.

### 10.3 Beslissing 78 — Het budgetmodel: deze ronde is fragment-bound

Dit is de belangrijkste architectuurbeslissing van de ronde, want hij
bepaalt welke richtingen zijn toegelaten en welke niet.

**De meting.** Headless Chromium via `tests/helpers.mjs`, met
`renderer.info.autoReset = false` en één `requestAnimationFrame` tussen
`reset()` en uitlezen. Draw calls en driehoeken zijn
resolutie-onafhankelijk en dus geldig; frametijd is dat niet
(SwiftShader-softwarerendering, zie §8.11).

| Meting | Leeg | 14 ondoden levend |
| --- | --- | --- |
| Meshes | 523 | 653 |
| Lichten (`isLight`) | 28 | 28 |
| Unieke materialen | 285 | 361 |
| Unieke geometrie-instanties | 482 | 489 |
| Driehoeken in de scene-graph | 17.782 | 32.902 |
| **Draw calls per frame** | — | **280** |
| **Driehoeken per frame** | — | **18.092** |
| Shaderprogramma's | — | 13 |
| GPU-geometrieën (`info.memory`) | 83 | 90 |
| Texturen (`info.memory`) | 16 | 16 |
| `castShadow`-meshes | 165 | — |
| Transparante meshes | 80 | — |
| Emissieve meshes | 64 | — |

**De redenering.** 280 draw calls en 18k driehoeken is voor een
browsergame ruim: dat is niet waar de tijd heen gaat. De tijd gaat naar
de fragment shader. Three.js' forward renderer neemt **alle** lichten op
in de shader-uniforms en evalueert ze **per verlicht fragment**,
ongeacht afstand — er is geen light-culling in de basisrenderer. Elk
vol-scherm fragment doet dus 27 puntlichtberekeningen plus een
hemisfeerterm, en daar bovenop komt de bloom-mipchain.

**De regel die daaruit volgt, en die elk ticket in deze ronde bindt:**

> Er is ruimte voor meer geometrie en meer draw calls. Er is nauwelijks
> ruimte voor meer per-fragment werk. Elke schermvullende pass en elke
> duurdere materiaal-shader concurreert rechtstreeks met die 27 lichten.

Dat verklaart de toelatingen en de afwijzingen:

- **Toegelaten, want nul fragment-kosten:** vertexocclusie (T103),
  per-instantie variatie (T104), afschuining (T105), camerabeweging
  (T92), fogdiepte (T93), skyline (T112). Deze mogen zonder meting.
- **Toegelaten met meting:** één eigen `ShaderPass` (T96), normal maps
  (T108), lichtkegels (T110). Alle drie kosten reëel fragmentwerk en
  hebben een expliciete afbreek-drempel in hun testplan.
- **Afgewezen:** SSAO (tweede volledige scene-render, +280 draw calls,
  en het maakt donker nog donkerder in een scene die al bijna zwart is);
  raymarched volumetrische mist (30-60 samples per fragment, en dan nog
  tijdens een eventgolf — de piekbelasting); een `Reflector` op het water
  (tweede scene-render voor één vlak in één zone).

**Het belangrijkste gevolg voor de pipeline-architectuur.** Deze ronde
voegt **precies één** nieuwe post-processing-pass toe (T96), en die
draagt vervolgens drie verschillende effecten (korrel, aberratie,
vignet, per-zone grading). Vier losse passes zouden vier keer een
full-screen lees/schrijf-cyclus betekenen; één pass met vier
uniform-gestuurde termen is één cyclus. Zie beslissing 83.

### 10.4 Beslissing 79 — De helderheidsbasislijn als vangrail (T88)

**Het probleem.** De helderheid van dit spel is over **vier
feedbackrondes** met pixelmetingen getuned (§7.5.5, §7.5.7-7.5.10). De
kelder is een keer als "te donker" teruggekomen, de binnenplaats is 20%
gedimd, het atelier ook, en de kelderlamp-doorschijn door de
atelier-westmuur heeft twee iteraties gekost. Die kalibratie is
kostbaar, ongedocumenteerd in getallen, en **elke ticket in deze ronde
kan hem verschuiven zonder dat iemand het merkt**.

Hoekocclusie maakt hoeken donkerder. Vertexvariatie verschuift kleuren.
Een grading-matrix raakt alle zones tegelijk. Texturen veranderen de
gemiddelde albedo. Een lichtkegel voegt additieve helderheid toe. Stuk
voor stuk klein; opgeteld over 29 tickets een spel dat er anders uitziet
dan bedoeld, zonder dat er één moment was waarop het "brak".

**De beslissing.** T88 legt vóór alle andere tickets een machinale
basislijn vast: `tests/test-visuele-basislijn.mjs` neemt op een vast
aantal camerastandpunten (één per zone, vaste positie en kijkrichting,
vaste vensterafmeting) een screenshot en berekent daaruit de gemiddelde
en de mediane pixelhelderheid, plus de verdeling over een paar
helderheidsbanden. Diezelfde test legt de rendermetrics uit §10.3 vast.

**De vorm van de assertie is bewust een band, geen exact getal.** Een
exacte pixelgelijkheid is onhaalbaar zodra er ruis (T96), variatie
(T104) of animatie in het beeld zit. De test asserteert daarom per zone
een toegestane afwijking ten opzichte van de vastgelegde waarde, en het
ticket dat de band overschrijdt móet de nieuwe waarde expliciet in de
test bijwerken mét onderbouwing in dit document. Dat is precies het
mechanisme dat `test-resources.mjs` voor geheugenlekken doet: niet
"voorkom de wijziging", maar "maak de wijziging zichtbaar en bewust".

#### 10.4.1 Twee meetvallen, allebei gemeten (correctie na review)

Dit hoofdstuk beschreef T88 aanvankelijk als "screenshot → gemiddelde
pixelhelderheid", zonder de meetomgeving te controleren. Twee metingen
achteraf laten zien dat die beschrijving te losjes was.

**Val 1 — de flikker maakt een naïeve band waardeloos.** Gemeten over 90
opeenvolgende frames op één vast camerastandpunt:

| Meting | Waarde |
| --- | --- |
| Laagste gemiddelde luminantie | 19,09 |
| Hoogste gemiddelde luminantie | 21,36 |
| Gemiddelde | 20,28 |
| **Spreiding** | **11,2%** |

Dat is geen ruis maar het flikkersysteem: de twee sinussen per lamp in
`lampLichten`, plus `lampDipFactor`. Een band die 11% breed moet zijn om
niet vals te alarmeren, vangt een echte regressie van 5% niet — en
precies zulke verschuivingen zijn wat T103 (hoekocclusie) en T107
(texturen) veroorzaken.

**Gevolg voor het ontwerp van T88:** de test moet de tijdafhankelijke
systemen **bevriezen** vóór hij meet. Concreet: de flikkerfase per lamp
op een vaste waarde, `lampDipFactor` op 1, `mistUitfaseTimer` op 0, en
`klok` op een vaste waarde. Pas dan is een smalle band (orde 1-2%)
zinvol, en pas dan meet de test wat hij beweert te meten.

**Val 2 — de in-page routes leveren zwart of leeg op.** De renderer
draait met `preserveDrawingBuffer: false`. Gemeten:

| Route | Resultaat |
| --- | --- |
| `page.screenshot()` (Playwright) | **werkt** — luminantie 30,91, 87% niet-zwart |
| `gl.readPixels()` **binnen** de rAF-callback | werkt — luminantie ~20 |
| `gl.readPixels()` **buiten** het rAF-venster | **0 (zwart)** |
| `canvas.toDataURL()` na rAF | **leeg** (2018 bytes) |

De screenshot-route klopt dus — Chromium composit de canvas — en dat is
de route die T88 moet gebruiken. Maar een testschrijver die intuïtief
naar `readPixels` of `toDataURL` grijpt (allebei voor de hand liggend
vanuit de pagina), krijgt stilzwijgend nullen terug en schrijft een test
die groen blijft terwijl hij niets bewaakt. Dat is de gevaarlijkste
soort test die er bestaat, en daarom staat het hier vastgelegd.

**Waarom dit ticket eerst moet.** Ná drie tickets weet je niet meer welk
ticket welke verschuiving veroorzaakte. Dit is hetzelfde patroon als
waarschuwing 42 (T77 vóór T69) en 57 (rastertest vóór de
vliering-geometrie): de vangrail moet er staan terwijl je bouwt, niet
erna.

#### 10.4.2 Implementatieverslag T88 (uitgevoerd)

Gebouwd: `visueleBevriesTijd` (amsterdam-undead.html, naast
`lampDipFactor`, met getter/setter op het debug-hook), `tests/test-visuele-
basislijn.mjs`, `tests/maak-beeldverslag.mjs`, en in `tests/helpers.mjs`
drie nieuwe gedeelde functies: `openVoorVisueleMeting()`,
`berekenVisueleStandpunten()`, `zetVisueelStandpunt()`.

**Acht standpunten, niet vijf.** §10.4 sprak van "één camerastandpunt per
zone". Uitgevoerd als vijf zoneVan()-zones (woonkamer/gang/atelier/
binnenplaats/bijkeuken) **plus** kelder, vliering en gracht — drie
deelgebieden die een zoneVan()-index delen met een buurzone maar een eigen,
materieel onderscheiden rendercontext hebben (eigen lampen, eigen
verdieping) en die latere tickets (T98, T103, T107, T114) met naam
noemen. Coördinaten worden IN de pagina berekend uit de bestaande
kaartconstanten (`d.PLAATS_CX`, `d.KELDER_X_WEST`, enz.), nooit als losse
letterlijke getallen gekopieerd — dat voorkomt dat deze lijst ooit uit de
pas loopt met de kaart.

**Twee EXTRA meetvallen, gevonden tijdens het bouwen, niet vooraf
voorzien.** §10.4.1 documenteerde er twee (de flikker, de kapotte
in-page-routes); tijdens de implementatie kwamen er nog twee bij die het
architectuurdocument nu ook draagt (zie de code-comments in `helpers.mjs`
voor het volledige verhaal):

1. **`simuleerPointerLock` (het gebruikelijke testpatroon) is hier fout.**
   Die optie mockt `document.pointerLockElement`, en dat maakt `spelActief`
   in `gameLoop` permanent waar. Alles wat daarbinnen hangt — de klok, de
   kelderhals-druppel, de winkelmarkering-puls, de stofwolken, de golf-/
   ondoden-simulatie — bleef dus gewoon doorlopen tijdens de meting, geen
   van allen gedekt door `visueleBevriesTijd`/`lampDipFactor`/
   `mistUitfaseTimer`. **Oplossing:** een nieuwe `openVoorVisueleMeting()`
   die het DOM-startscherm verbergt en de HUD-chrome toont — exact wat de
   `pointerlockchange`-handler in het spel zelf doet — **zonder**
   `document.pointerLockElement` te overschrijven. `spelActief` blijft
   daardoor voorgoed false; `updateSpeler()` en de flikkerloop +
   `composer.render()` blijven wél draaien (die staan buiten die if-tak).
   Resultaat: 0,000% spreiding over 10 metingen op hetzelfde standpunt,
   binnen één testrun.
2. **Elke lamp krijgt bij het bouwen een WILLEKEURIGE flikkerfase**
   (`hangLamp()`: `fase: Math.random() * Math.PI * 2`) — dus een andere bij
   elke page-load. `visueleBevriesTijd` bevriest alleen de tijd-term;
   `Math.sin(t*7+fase)` op `t=0` is nog steeds `Math.sin(fase)`, een andere
   constante per run. Dat gaf 0% spreiding *binnen* één testrun maar tot
   6% spreiding *tussen* losse testruns — zichtbaar in kamers met
   `lampLichten` (woonkamer 6,2%, kelder 3,8%, bijkeuken 2,2%, gang 1,5%),
   afwezig waar het licht van stabiele `buitenLichten`/
   `stroomGevoeligeDaklichten` komt (binnenplaats, gracht, atelier,
   vliering: 0%) — die twee cijferreeksen bevestigen elkaar en wijzen
   ondubbelzinnig naar de fase als oorzaak. **Oplossing:**
   `openVoorVisueleMeting()` pint ook `lampLichten[].fase = 0`. Geverifieerd:
   <0,05% restspreiding over 4 losse browserruns (waarschijnlijk
   floating-point-optelvolgorde in SwiftShare, niet meer de moeite van het
   verder najagen waard op dit niveau).

**Waarom dit "gevonden tijdens het bouwen" is en niet "een derde/vierde
onzorgvuldigheid in het document".** §10.4.1's twee vallen waren met een
losse Node-probe te vinden zonder ooit een testbestand te schrijven. Deze
twee zaten dieper: ze werden pas zichtbaar bij het daadwerkelijk schrijven
van `zetVisueelStandpunt()` en het draaien van de test *meerdere keren
achter elkaar* (val 1 vereiste een cross-page-load-vergelijking, val 2
een cross-frame-binnen-één-run-vergelijking eerst, dán cross-run). Dat is
precies waarom §10.18's les — "elke bewering over runtime-gedrag hoort
gemeten te zijn vóór hij als beslissing wordt opgeschreven" — een
grens heeft: sommige gedragingen zijn pas meetbaar zodra de bouwer er
grondig doorheen gaat. Vandaar dat dit verslag er is: de volgende
architectuurronde leunt op `openVoorVisueleMeting()`/
`zetVisueelStandpunt()` als bewezen bouwstenen, niet op een aanname.

**Vastgelegde basislijn** (commit waarop dit ticket is gebouwd; volledige
tabel in `test-visuele-basislijn.mjs`): gemiddelde/mediane luminantie en
draw calls/driehoeken per standpunt, band 2% (helderheid) resp. 25%
(rendermetrics). 40/40 checks groen, drie keer achter elkaar herhaald op
losse browserruns om precies de bovenstaande cross-run-stabiliteit te
bevestigen.

**`tests/maak-beeldverslag.mjs`** (beslissing 93) hergebruikt dezelfde
`openVoorVisueleMeting()`/`zetVisueelStandpunt()` en schrijft genummerde
PNG's naar `tests/beeldverslag/<label>/` (gitignored). De "voor"-set voor
de hele ronde is met `node maak-beeldverslag.mjs voor-ronde8` opgeleverd.

### 10.5 Beslissing 80 — Emissieve hiërarchie, en bloom als art-direction-knop (T89)

**Wat er nu is.** 64 emissieve meshes met waarden die van 0,9 (lampbol
in `hangLamp()`) tot 3,4 (`OOG_INTENSITEIT_STROOMUITVAL`) lopen, zonder
onderliggend systeem. `glasMateriaal` staat op 1,6, `kernMateriaal` van
de Brander ook op 1,6, de lantaarnbollen op 1,32, de bootlamp op 1,8.
Die getallen zijn stuk voor stuk lokaal beredeneerd en nooit tegen
elkaar afgewogen.

De `UnrealBloomPass` staat op threshold **0,82** — hoog, zodat alleen de
echt felle elementen gloeien. Dat werkt vandaag, maar het werkt bij
toeval: er is geen regel die zegt welk soort object boven of onder die
drempel hoort te zitten.

**Waarom dat een probleem wordt in deze ronde.** Vier tickets voegen
emissief materiaal toe of verhogen bestaande waarden: T90 (mondingsvlam),
T100 (rimlight), T110 (lichtkegels), T113 (verre raampjes). Zonder
hiërarchie is elke bloom-aanpassing daarna giswerk, en levert elke
verhoging van de bloom-sterkte een wasachtig beeld op in plaats van een
dramatisch beeld.

**De beslissing.** Drie benoemde niveaus, vastgelegd als constanten, met
een expliciete regel welk soort object waar hoort:

| Niveau | Richtwaarde | Wie | Gloeit (boven threshold)? |
| --- | --- | --- | --- |
| **Accent** | ~0,4 | achtergrondramen in de verte, zwakke decoraccenten | nee |
| **Bron** | ~1,2-1,6 | lampbollen, raamglas, winkelmarkeringen (basisgloed), Brander-kern | randgeval, bewust net eronder/erop |
| **Signaal** | ~2,6-3,4 | ondode-ogen (bij alarm) | ja |

De bloom-threshold wordt daarmee één knop die de hele hiërarchie stuurt:
verlagen laat de Bron-laag meegloeien, verhogen isoleert de
Signaal-laag. Dat is de art-direction-knop die er nu niet is.

**De harde grens.** De Signaal-laag is een **gameplay**-laag. Ondode-ogen
zitten daar niet omdat ze mooi zijn maar omdat de speler ze moet kunnen
vinden. Geen enkel ticket mag een decoratief element naar Signaal
tillen, en geen enkel ticket mag ze eronder duwen.

**Correctie tijdens implementatie: "actieve koopmarkering" hoort niet in
de Signaal-rij.** Deze paragraaf noemde oorspronkelijk zowel
"winkelmarkeringen" (Bron) als "actieve koopmarkering" (Signaal) als twee
verschillende dingen — een tegenspraak binnen dezelfde tabel, geschreven
vóór het bestaande winkel-affordance-systeem echt was doorgelicht. Het
bestaande systeem (`updateWinkelMarkeringen()`, T37/ontwerpbeslissing 30)
signaleert "beschikbaar" al via de ringkleur/-opacity-puls plus het
gedeelde, proximity-gestuurde `winkelLicht` (een `PointLight`, dus sowieso
buiten het bereik van deze materiaal-hiërarchie) — niet via een hogere
`emissiveIntensity` op het icoon. Er bestaat geen "actieve koopmarkering"
op materiaalniveau, en die retrofitten zou een geheel nieuw, zichtbaar
gedrag toevoegen — precies wat dit ticket uitsluit. De Signaal-laag is
daarmee exclusief voor ondode-ogen (T89) en de mondingsvlam (T90, een
bestaand licht dat harder aangaat, geen materiaal).

**Dit ticket levert geen zichtbaar effect op.** Het is een inventarisatie
plus een tabel plus het corrigeren van de uitschieters. Het staat vooraan
omdat vier latere tickets erop leunen, niet omdat het op zichzelf iets
oplevert.

**Implementatieverslag (uitgevoerd).** Alle 32 emissieve call-sites in
`amsterdam-undead.html` zijn nagelopen en voorzien van een classificerende
comment. Zes lagen exact op een Bron/Signaal-grenswaarde en zijn vervangen
door de nieuwe `EMISSIE_*`-constanten (zuivere naamgeving, geen
gedragswijziging: `glasMateriaal`, `kernMateriaal`,
`OOG_INTENSITEIT_AANVAL/_MIST/_STROOMUITVAL`). Zes duidelijke uitschieters
onder Bron (0,9, meerdere lampbollen + de powerup-kern) zijn opgetild naar
`EMISSIE_BRON_MIN` (1,2) — elk afzonderlijk getoetst tegen T88's
basislijn. Eén kandidaat-correctie (`meterDrukspuit`, het drukmeter-
lampje op de Drukspuit) is **bewust teruggedraaid**: dat lampje hangt aan
`camera` en staat dus in ELK standpunt in beeld, in tegenstelling tot een
kamerlamp. Optillen duwde de mediane helderheid van het gracht-standpunt
met 3,9% omheen — over T88's 2%-band — precies omdat het in een verder
donkere buitenscène disproportioneel meeweegt in de mediaanrangschikking.
Dat is precies het risico dat §10.4's "geen zichtbaar effect"-eis bedoelt
te voorkomen bij een element dat *alle* standpunten tegelijk raakt, in
tegenstelling tot een lamp die maar één kamer raakt. Twee materialen
(de vliering-vloer/muur) vallen expliciet BUITEN de hiërarchie: geen
"gloeiend ding" maar een basisverlichting-substituut (T87 mag de vliering
geen PointLight geven). `test-visuele-basislijn.mjs` bleef na alle
correcties 40/40 groen, en de volledige regressiesuite 61/61.

### 10.6 Beslissing 81 — Licht als vorm, zonder één nieuwe lichtbron

**Het probleem.** Het spel *heeft* licht maar *toont* geen licht. Er zijn
27 puntlichten en geen enkele zichtbare bundel, kegel of projectie. Een
speler leest een ruimte aan lichtval — waar het vandaan komt, waar het op
valt, waar het niet komt — en die informatie ontbreekt volledig. De vier
lichtvlekken op de binnenplaats (`CircleGeometry(1.25, 24)` met opacity
0,12, plat op y = 0,012 in `bouwLantaarn()`) zijn de enige plek waar
licht als vórm bestaat, en ze bewijzen dat de techniek hier past.

**De beslissing.** Drie tickets maken licht zichtbaar, en **geen van
drieën voegt een `THREE.Light` toe.** Dat is geen toevalligheid maar de
kern van de aanpak: bij 27 bestaande lichten in een forward renderer is
elke extra lichtbron duurder dan de hele geometrie die het effect
simuleert. Het precedent staat al in de code — bij de Smederij-visuals is
een ember-puntlicht met een bereik van 0,9 m weer verwijderd na een
pixelmeting, met de notitie dat zo'n licht "de fragment-shader evenveel
kost als een lamp die een hele kamer verlicht".

**T90 — De mondingsvlam wordt een lichtmoment.** `vlamLichtDrukspuit`
bestaat al als `PointLight(0x9fffb8, 1.1, 6)` met `visible = false`
tussen schoten door. Intensiteit 1,1 in een scene waar de zwakste
lantaarn op 9 staat, betekent dat een schot de kamer niet verlicht. De
ingreep is het licht dat er al is één tot twee frames op een orde van
15-25 zetten, de vlamgeometrie van een bol naar twee gekruiste quads met
een canvas-getekende stervorm brengen, en een korte piek op de
bloom-sterkte. **Het lichtaantal verandert niet** — dit is een bestaand
licht dat harder aangaat.

De harde eis: bij de Ratelaar (automatisch vuur) mag dit geen
stroboscoop worden. De flits moet korter zijn dan het vuurinterval en de
piek mag **niet** meeschalen met vuursnelheid, anders wordt aanhoudend
vuur verblindend op precies het moment dat de speler het meest moet
zien.

**Implementatieverslag T90 (uitgevoerd).** De vlamgeometrie is vervangen
door `bouwMondingsVlam()`: twee `PlaneGeometry`'s 45° uit elkaar, één
gedeeld `MeshBasicMaterial` met een canvas-getekende viertak-ster
(`bouwVlamTextuur()`, 64×64, `AdditiveBlending`, `depthWrite: false`).
`vlamLichtDrukspuit`/`vlamLichtRatelaar` gingen van intensiteit 1,1 naar
respectievelijk **18** en **22** — in de Signaal-band (`EMISSIE_SIGNAAL_*`)
van §10.5, passend bij het karakter van een flits die maar 1-2 frames
bestaat. Elk schot zet `vlam.rotation.z` en `vlam.scale` op een nieuwe
willekeurige waarde, zodat opeenvolgende schoten niet identiek ogen.
`vlamTimer` was al vóór dit ticket een **harde reset** (`vlamTimer =
VLAM_FLITS_DUUR`), geen optelling — de bestaande architectuur (één
vlam-instantie per wapen, geen pool) maakt stapeling van flitsen
structureel onmogelijk, ook bij de Ratelaar. `VLAM_FLITS_DUUR = 0,033`s
zit ruim (3×) onder de Ratelaar-`schotCooldown` (0,1s), dus de piek
schaalt niet mee met vuursnelheid en blijft een losse flits, geen
stroboscoop.

`test-mondingsvlam.mjs` (21 checks, nieuw) bevestigt: structuur (Group
van 2 vlakken op 1 gedeeld materiaal), Signaal-bereik-intensiteit per
schot, zichtbaarheid valt na ~20 frames terug naar `false`, geen
stapeling (object-identiteit, intensiteit verdubbelt niet, timer reset
i.p.v. optelt, precies 1 licht ongeacht vuursnelheid), geen meeschalen
met vuursnelheid Ratelaar-vs-Drukspuit, exacte Smederij-boost, en
per-schot randomisatie over 8 schoten (uniek + binnen bounds).
`test-visuele-basislijn.mjs` bleef 46/46 groen (T90 roept `schiet()`
nooit aan tijdens die meting). De eerste volledige-suite-run legde een
echte regressie bloot: twee al bestaande tests (`test-smederij.mjs`,
`test-stadsarchief.mjs`) lazen nog `wapenStaat.definitie.vlam.material.
color` — dat pad bestond bij de oude bol-mesh, maar `vlam` is met dit
ticket een `Group` geworden (twee vlakken, geen eigen `.material`), dus
die aanroepen crashten. Beide zijn omgezet naar `definitie.vlamMateriaal.
color`, het gedeelde-materiaal-pad dat al voor dit doel bestond. Na de
fix bleef de volledige regressiesuite (62 scripts, incl. het nieuwe
testbestand) **62/62 groen, 0 FAIL**. Beeldverslag
(donkerste hoek van de startkamer, standpunt (−3, 0, 3), yaw 3π/4):
Drukspuit-schot toont een duidelijke groenige lichtopleving die na 20
frames weer volledig weg is; het Ratelaar-schot vanaf hetzelfde
standpunt toont dezelfde soort opleving in de eigen kleur, zonder
stapeling of overbelichting.

**Nabrander: hitch-garantie (speeltest, na oplevering).** De speler
meldde dat de flits niet bij elk schot zichtbaar was, met soms een
merkbare stilte ertussen. Root cause: `dt` in de gameLoop is geclipt op
0,05s (`Math.min(..., 0.05)`, een hitch-guard tegen rare sprongen), ruimer
dan `VLAM_FLITS_DUUR` (0,033s). `schiet()` en de aftel-/verberglogica
draaien in hetzelfde gameLoop-tick: als precies dát tick een grote `dt`
heeft (bijv. een golf die spawnt — precies de momenten met veel schoten),
werd `vlamTimer` gezet én in dezelfde beurt alweer met die volledige `dt`
afgeboekt, vóór de eerste render. Zo'n schot kreeg dan **nul zichtbare
frames**, niet één-tot-twee. Fix: een `vlamNetGezet`-vlag die het eerste
frame na een schot altijd garandeert — de aftelling wordt dat ene frame
overgeslagen, ongeacht hoe groot `dt` toevallig uitvalt; `wisselWapen()`
reset de vlag mee zodat hij nooit naar het volgende wapen doorlekt. Twee
nieuwe checks in `test-mondingsvlam.mjs` leggen dit vast: `vlamTimer`
direct na een schot én na het eerste daaropvolgende frame is exact gelijk
(het gegarandeerde frame), pas na het tweede frame telt hij normaal af.
(Het testen hiervan bleek zelf een valkuil: schiet() en de eerste meting
moeten in dezelfde `page.evaluate()` gebeuren met geneste
`requestAnimationFrame`-callbacks — gameLoop's eigen rAF-lus blijft altijd
doorlopen, dus tussen twee LOSSE `page.evaluate()`-round-trips kan hij al
onopgemerkt getikt hebben, wat eerst een vals-negatief gaf.) Volledige
regressiesuite na de fix: **62/62 groen, 0 FAIL**.

**T109 — Raamprojecties.** Een canvas-getekend kozijnpatroon,
geprojecteerd als quad op de vloer onder elk dakraam en elk gevelraam:
exact het bestaande `lichtvlek`-patroon, maar met een patroon in plaats
van een egale cirkel. Statisch, dus het klopt niet meer zodra er iets
tussen raam en vloer staat — in een donkere scene met fog is dat een
aanvaardbare cheat, en het is de reden dat dit ticket op vlakke vloeren
blijft (niet op de kelder-ramp, niet op de vlieringtrap).

Bewust géén `SpotLight.map`: Three.js kan gobo's via een spotlight, maar
dat introduceert een nieuw lichttype en breekt invariant 2.

**T110 — Zichtbare lichtkegels.** Open `ConeGeometry` met een eigen
`ShaderMaterial`: additive blending, `depthWrite: false`, opacity die
naar de rand uitfadet via een fresnel-term en naar beneden via de lokale
y. Onder de vier binnenplaats-lantaarns, de gracht-lantaarn en de
grootste dakramen.

Dit is **de duurste toegelaten richting van de ronde**. Grote,
overlappende, camera-nabije additieve transparantie is puur overdraw, en
op een scherm met `pixelRatio` 2 telt dat dubbel. Drie eisen volgen
daaruit:

1. Het aantal kegels heeft een harde bovengrens en de lichte uitvoering
   (statische fresnel-fade, geen noise, zes kegels) is het startpunt —
   niet de volledige uitvoering.
2. De kegel-opacity moet meeliften op `buitenLichten`/`lampLichten`,
   anders blijft er tijdens een Stroomuitval licht in de lucht hangen
   dat nergens vandaan komt.
3. De shader moet de fog respecteren. Een kegel die door
   `FOG_NORMAAL`/`FOG_MIST` heen fel blijft, ziet er fout uit.

**De volgorde binnen dit gebied is niet willekeurig.** T90 eerst (nul
kosten, direct voelbaar), dan T109 (de goedkope, statische vorm van
"licht neemt de vorm van zijn opening aan"), dan pas T110. Blijkt T110
op de doelhardware te duur, dan staat de helft van het effect er al.

**Implementatieverslag T109 (uitgevoerd, MET een bewuste scope-reductie).**
Eén gedeelde canvas-textuur (`bouwRaamProjectiePatroon()`, 128x128, een
2x3-roedeverdeling met zachte gloed per ruit) op dezelfde soort quad als
de bestaande lantaarn-lichtvlek (`MeshBasicMaterial`, transparant,
`depthWrite: false`, `DoubleSide`) — alleen met een patroon i.p.v. een
egale cirkel, exact zoals de beslissing vooraf aankondigde. Bewust GEEN
`SpotLight.map`: geen nieuw lichttype, geen invariant-2-schending.

**Scope: "elk gevelraam" is 6 ramen, niet alle vensterpunten.** De
`VENSTERS*`-arrays bevatten ook niet-glazen doorgangen (`VENSTERS_PLAATS`
is de poort-/kelderdeuropening op de binnenplaats) — die kregen bewust
GEEN projectie, want er is geen raam om te projecteren. De 6 echte
gevelramen (2 woonkamer, 3 atelier: noordwest/oost/nis, 1 bijkeuken-
steegdeur) plus de 4 atelier-dakramen zijn wél allemaal gedekt: 10
projecties in totaal.

**Twee generieke plaatsingsfuncties, twee soorten geometrie.** Een
dakraam laat licht recht naar beneden vallen: `bouwDakraamProjectie()`
zet de quad ONGEWIJZIGD onder x/z van de opening, 1,35x uitvergroot
(spreiding tijdens de val). Een gevelraam zit in een muur op kozijnhoogte
en het licht valt schuin de kamer in: `bouwRaamProjectie()` neemt een
richtingsvector (`richtingX`/`richtingZ`, "de kamer in") en zet de quad
`RAAM_PROJECTIE_INSET` (1,1m) van de muur af in die richting. Voor elk
gevelraam is die richting handmatig afgeleid uit welke kant van de muur
de kamer ligt (bv. de woonkamer-zuidramen: richting (0,-1), want
`HALF_DIEPTE` is de zuidgrens en de kamer ligt bij kleinere z).

**Bewust alleen vlakke vloeren**, zoals de beslissing vooraf al
vastlegde: geen enkele projectie op de kelder-ramp of de vlieringtrap —
dat zijn de enige twee niet-vlakke vloeren in het pand, en een statische
projectie zou daar zichtbaar door de helling heen "zweven".

**Laadtijd-optimalisatie tijdens het bouwen zelf gevonden.** De eerste
versie van T108's `bouwNormaalKaart()` (zie hieronder) riep per texel 8x
een closure aan die zelf ook een modulo deed — ~2 miljoen closure-calls
voor een 512x512 kaart, ~100ms. Herschreven naar vooraf berekende
wrap-indices (`links`/`rechts`-Int32Array's per rij/kolom) en een platte
`Uint8Array` als hoogtebron zonder functie-aanroep in de hot loop: 3x
sneller (~33ms voor beide kaarten samen).

**Geen zichtbaar/meetbaar effect op de helderheidsbasislijn.**
`test-visuele-basislijn.mjs` bleef **65/65 groen** zonder één enkele
waarde bij te werken — bij `RAAM_PROJECTIE_OPACITY = 0,1` en een
oppervlak van hooguit een paar vierkante meter per projectie op een
kamer van tientallen vierkante meters blijft de bijdrage aan het
gemeten gemiddelde/mediaan ruim binnen de 2%-band. Dat is geen falen van
het ticket — het bewijst dat het effect subtiel genoeg is om niet als
"plotseling een ander licht"-schok te lezen, precies de "cheat, geen
nieuw lichtmoment"-aard die de beslissing vooraf beschrijft.

`test-raamprojecties.mjs` (8 checks, nieuw) bevestigt: precies 10
projecties, allemaal op de vaste vloeroffset (y=0,012), de inset-/
richtinglogica klopt voor zowel een gevelraam als een dakraam, alle
materialen delen hetzelfde patroon-canvas (geen 10 aparte texturen),
depthWrite staat overal uit, de obstakel-telling is ongewijzigd (puur
decoratief) en er is geen enkele `SpotLight` toegevoegd.

**Implementatieverslag T110 (uitgevoerd, exact volgens de drie
eisen).** Een eigen `THREE.ShaderMaterial` op een open `ConeGeometry`,
additive, `depthWrite: false`: fresnel-fade (`pow(dot(viewDir, normal), macht)`,
felst recht op de camera af, dooft uit naar de rand) x hoogte-fade
(1 bij de apex/lampbron, 0 bij de open basis onderin). Precies zes kegels
— de vier binnenplaats-lantaarns (`bouwLantaarn()`), de gracht-lantaarn en
alleen het HOOFD-dakraam van het atelier (1,8x1,8m, veruit het grootste
van de vier — de drie kleinere daklichten blijven zonder kegel, een
bewuste toepassing van "de grootste dakramen" uit de beslissing, niet
alle vier).

**Eis 1 (harde bovengrens) zit in `bouwLichtkegel()` zelf, niet bij de
aanroepers.** Een module-teller (`lichtkegelTelling`) telt op bij elke
succesvolle bouw; een aanroep bóven `LICHTKEGEL_MAX` (6) geeft `null`
terug zonder een mesh te bouwen. Zo kan een latere ronde gerust meer
`bouwLichtkegel()`-aanroepen toevoegen zonder de bovengrens ergens anders
te hoeven bewaken — de zevende (en elke latere) aanroep is vanzelf een
no-op.

**Eis 2 (meeliften op Stroomuitval) hergebruikt de BESTAANDE flikkerloop,
geen nieuw per-frame-systeem.** `bouwLichtkegel()` geeft de mesh terug;
de aanroeper stopt 'm in hetzelfde object als het bijbehorende licht
(`buitenLichten.push({ licht, ..., kegel })`,
`stroomGevoeligeDaklichten.push({ licht, ..., kegel })`). De twee
bestaande loops die toch al `bl.licht.intensity`/`dl.licht.intensity`
herberekenen krijgen één extra regel die `kegel.material.uniforms.
opacity.value` met exact dezelfde factor schaalt (`buitenFactor` resp.
`stroomFactor` — bewust NIET `DAKRAAM_STROOM_EXTRA`, dat is een losse
helderheidsbudget-tuning van het PointLight zelf, geen Stroomuitval-
signaal). Geen enkele kegel kan dus ooit blijven branden terwijl zijn
licht uit is.

**Eis 3 (fog) leverde de enige echte bug van dit ticket, gevonden door de
volledige regressiesuite (niet vooraf voorzien).** `fog: true` alleen is
NIET genoeg voor een custom `ShaderMaterial`: de `#include <fog_pars_
fragment>`-chunk verwacht dat `uniforms.fogColor`/`fogNear`/`fogFar`
daadwerkelijk bestaan, want Three.js' interne `refreshFogUniforms()`
schrijft er ELK FRAME in zodra er een render met dat materiaal gebeurt.
Zonder `THREE.UniformsLib.fog` erbij te mergen crashte dat met "Cannot
read properties of undefined (reading 'value')" — op ELK frame, in ELKE
kamer met actieve fog (dus vrijwel overal). Effect: de eerste volledige
regressiesweep na dit ticket gaf 21 FAILs in `test-visuele-basislijn.mjs`
met exact DEZELFDE gemeten waarde op alle vijf `zoneVan()`-zones (28.67/
15.59) — een duidelijk signaal dat er geen echte per-zone meting
plaatsvond, maar een bevroren/kapotte renderstaat. Fix: `uniforms:
THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { ...eigen uniforms
}])` — de standaard, door Three.js zelf gedocumenteerde manier om fog aan
een custom ShaderMaterial te koppelen.

**Geen zichtbaar/meetbaar effect op de helderheidsbasislijn** (65/65
groen, na de fog-fix, geen enkele waarde bijgewerkt) — op de acht vaste,
bevroren meetstandpunten (gekozen voor brede zone-representativiteit, niet
voor een grazing close-up bij een lantaarn) blijft de bijdrage van zes
lage-opaciteit kegels (0,055-0,08) ruim binnen de 2%-band. Een handmatige
close-up vlak bij een binnenplaats-lantaarn (buiten de acht meetpunten)
toont wél een zachte, warme gloed rond de lantaarnvoet — zichtbaar maar
terughoudend, precies de "lichte uitvoering als startpunt" die de
beslissing voorschrijft.

`test-lichtkegels.mjs` (17 checks, nieuw) bevestigt: precies 6 kegels, de
bovengrens wordt daadwerkelijk gehandhaafd (een 7e aanroep bouwt niets),
alle materialen zijn additive/depthWrite:false/fog:true, alle 5 relevante
buitenLichten en het dakraam-licht hebben een gekoppelde kegel, een ECHTE
gesimuleerde Stroomuitval (`startGolf()` op golf 10, zelfde patroon als
`test-stroomuitval.mjs`) laat zowel het licht als de kegel-opacity
evenredig dalen, de lichttelling blijft op 28 (geen nieuw lichttype), en
elke kegel-apex staat exact op de opgegeven lamppositie.

### 10.7 Beslissing 82 — Waardestructuur zonder licht (T91, T102, T103)

**Het probleem, en waarom dit het belangrijkste gebied van de ronde is.**
Objecten staan niet op de vloer — ze zweven erboven. Hoeken zijn even
helder als vlakken, wat elke kamer plat maakt. Er is geen enkele plek
waar een object een écht donkere kant heeft, want 27 schaduwloze
puntlichten lichten alles van drie kanten diffuus aan. Dat is precies de
"prototype"-look.

Dit is ook waar de één-schaduw-regel pijnlijk wordt: §7.9.1 stelt zelf
vast dat de enige schaduwwerpende lamp maximaal **12/255 pixelverschil**
maakt. We betalen zes cube-shadow-passes per frame voor iets dat je niet
ziet. De echte oplossing daarvoor (A5, een gerichte `DirectionalLight`)
valt buiten deze ronde omdat hij een vastgelegde invariant raakt. Wat
overblijft is de vraag: **hoe krijg je waardestructuur zonder licht?**

**De beslissing.** Waardestructuur wordt ingebakken in de geometrie in
plaats van berekend door de renderer. Twee schalen:

**T91 — Contactschaduwen (de kleine schaal).** Eén gedeelde radiale
gradient-canvastextuur op een gedeelde `PlaneGeometry`, plat op de
vloer, geschaald naar de bounding box van het object erboven. Volledig
statisch: één keer plaatsen bij het bouwen, nooit per frame aanraken.
`MeshBasicMaterial` doorloopt geen enkele lichtberekening, dus de
fragment-kosten zijn verwaarloosbaar. Het plaatsingspatroon staat al in
de code als de lantaarn-`lichtvlek`.

De complicatie is de vloerhoogte. `berekenVloerY(x, z)` levert die, maar
op de kelder-ramp en de vlieringtrap loopt hij — daar hoort geen
contactschaduw, of hij moet per object de juiste y krijgen. Simpelste
veilige regel: alleen op vlakke vloerdelen.

**Implementatieverslag T91 (uitgevoerd).** `bouwContactschaduw(x, z,
straalX, straalZ = straalX, rotY = 0)` — vóór regel 833 gedeclareerd
(beslissing 90, zelfde reden als T89's `EMISSIE_*`-constanten), samen met
één module-brede `CONTACTSCHADUW_GEO` (`CircleGeometry(1, 24)`) en één
`CONTACTSCHADUW_MAT` (`MeshBasicMaterial` met een 64×64 canvas-radiale-
gradient als `map`, `transparent: true`, `depthWrite: false`). De hoogte
komt uit `berekenVloerY(x, z) + 0,012` (dezelfde offset als de bestaande
lichtvlek), niet uit een vaste constante — daarmee staat de schaduw ook
correct op de vliering, mocht daar ooit decor bijkomen. Elliptische
schaduwen (de tafel: `straalX=0,78, straalZ=0,5`, meeroterend met de
tafel-`rotY`) worden gerealiseerd door de gedeelde eenheidscirkel
non-uniform te schalen (`vlak.scale.set(straalX, straalZ, 1)`) op een
losse `Group` per instantie — geometrie én materiaal blijven letterlijk
hetzelfde object, alleen de `Group`-transform verschilt per plaatsing.
Vier aanroepers, elf instanties: `bouwTafel()` (1), `bouwKratten()` (3),
`bouwVat()` (3), `bouwLantaarn()` (4× op de binnenplaats, een klein
strak vlekje aan de voet van de paal, los van de bredere warme
lichtvlek). Geen van de aanroepen ligt op de kelder-ramp of de
vlieringtrap, dus de "alleen vlakke vloerdelen"-regel hierboven was in
de praktijk geen keuze die iets hoefde uit te sluiten.

`test-contactschaduw.mjs` (14 checks, nieuw) bevestigt: alle elf
instanties delen exact één geometrie én één materiaal-object,
`obstakels.length` blijft 56, het lichtaantal blijft 28, en elke
schaduw-y komt exact overeen met `berekenVloerY()` op diezelfde x/z.
`test-visuele-basislijn.mjs` bleef 46/46 groen — de patches zijn klein
en liggen ver onder ooghoogte, dus ze verschuiven de mediane
framehelderheid op geen van de acht standpunten meetbaar (T91's eigen
acceptatie-eis: "basislijn binnen de band"). Volledige regressiesuite:
**63/63 groen, 0 FAIL**. Beeldverslag: een ooghoogte-overzicht van de
startkamer met tafel, kratten en vat (schaduw onder de tafel goed
zichtbaar); de lantaarnpaal op de binnenplaats (het kleine contactvlekje
gaat grotendeels op in de bredere lichtvlek — verwacht, geen bug); en
een dichtbij, sterk omlaaggericht standpunt bij de kratten waar het
contactvlak zelf duidelijk als donkere ovale vlek afsteekt tegen de
vloer.

**T102 — Subdivisie-helper (het fundament).** De grote vlakken (muren,
vloeren, plafonds) zijn nu `BoxGeometry` (24 vertices) of een
ongesubdivideerde `PlaneGeometry`. Voor een vloeiende
occlusie-gradient is dat veel te grof. Eén gedeelde helper die deze
vlakken met bijvoorbeeld 8×8 segmenten opbouwt, is het fundament voor
T103 — en later ook voor vertex-jitter en vuil (buiten deze ronde).

Dit tilt het driehoekstal van ~18k naar mogelijk 40-60k per frame. Dat
is ruim binnen budget (§10.3: er is ruimte voor geometrie, niet voor
fragments) en verandert het aantal draw calls niet.

**T103 — Ingebakken hoekocclusie.** Per vertex bepalen hoe dicht die bij
een andere geregistreerde rechthoek uit `obstakels` ligt, en de
vertexkleur navenant dimmen; `vertexColors: true` op de betrokken
materialen. Vertexkleuren worden in de vertex shader geïnterpoleerd en in
de fragment shader met de basiskleur vermenigvuldigd: **nul extra
texture-samples, nul extra passes, nul extra lichten.**

Dit is de richting met de hoogste impact-per-kosten in het hele
document, en dus het zwaartepunt van de ronde. Twee dingen maken hem
tegelijk gevaarlijk:

1. **Hij raakt de helderheidsbalans het hardst van alle tickets.** Alles
   donkerder maken in de hoeken is precies het soort verschuiving waar
   §7.5.5-7.5.10 vier rondes over hebben gedaan. T88's basislijn is hier
   niet optioneel.
2. **Hij botst met de materiaalcache — en de voor de hand liggende
   uitweg maakt het spel zwart.** `mat()` en `matFamilie()` cachen op
   kleur/ruwheid/metaal respectievelijk familie/kleur. Materialen met
   `vertexColors: true` hebben dus een eigen cache-tak nodig.

   > **Gemeten, r160, egaal belichte plane zonder color-attribuut:**
   > `vertexColors: false` ⇒ gemiddelde kanaalwaarde **244**;
   > `vertexColors: true` ⇒ **0**.
   >
   > Een ongebonden vertex-attribuut levert in WebGL de generieke
   > waarde `(0, 0, 0, 1)`, en die wordt met de basiskleur
   > vermenigvuldigd. `vertexColors` globaal aanzetten maakt daarmee
   > **elk vlak zonder color-attribuut pikzwart** — het is geen
   > neutrale vlag.

   De enige twee veilige routes zijn daarom: (a) een **aparte
   cache-tak** voor materialen met `vertexColors: true`, of (b)
   `vertexColors` globaal aanzetten **en** elk betrokken vlak
   verplicht een color-attribuut geven (wit waar er geen occlusie is).

   Route (a) is de voorkeur: hij raakt alleen de vlakken die
   daadwerkelijk occlusie krijgen, en hij faalt zichtbaar in plaats van
   stilzwijgend. Route (b) is goedkoper in cachegrootte maar heeft een
   catastrofale faalmodus — één vergeten vlak is een zwart gat in de
   wereld. De cache verdubbelt niet werkelijk: alleen de families die
   occlusie krijgen (steen, hout, tegel) krijgen een tweede tak.

**Een deurgat mag niet dichtsmeren.** De occlusieberekening kijkt naar
`obstakels`, en een deuropening is de afwezigheid van een obstakel — maar
de muur eromheen is er wel. Zonder aandacht wordt de rand van elk deurgat
donker en lijkt de opening kleiner dan hij is. Dat is een
leesbaarheidsprobleem, niet alleen een schoonheidsfout.

**`obstakels` is een beperkte bron, en de bake moet een na-pass zijn.**
Twee dingen die bij het schrijven van dit hoofdstuk over het hoofd zijn
gezien:

- **`obstakels` is 2D en telt maar 56 entries.** Er zit geen Y in, dus
  plafondhoeken zijn er niet uit af te leiden (die moeten uit de
  bekende `KAMER_HOOGTE`/`ATELIER_HOOGTE`/`KELDER_HOOGTE` komen). En
  decor — tafels, kisten, tonnen — zit er bewust níét in, dus occlusie
  rond meubels komt uit T91 (contactschaduwen), niet uit T103.
- **De array wordt tijdens het bouwen gevuld.** `bouwMuur()` roept
  `registreerRechthoek()` aan terwijl de wereld wordt opgebouwd, dus een
  muur die vroeg gebouwd wordt, kent de muur die er later naast komt
  niet. **De occlusie-bake moet daarom een expliciete na-pass zijn over
  alle verzamelde vlakken, ná het volledige geometrieblok** — niet een
  berekening binnen `bouwMuur()` zelf. Dat vraagt om een lijst van
  "vlakken die occlusie krijgen" die tijdens het bouwen wordt
  verzameld en aan het eind in één keer wordt verwerkt.

Een bijkomend gevolg: gekochte deuren verwijderen hun obstakel
(`deurObstakel` e.a.), maar de gebakken occlusie blijft staan. Dat is
aanvaardbaar (de vertexkleur rond een geopend deurgat is een fractie te
donker), maar het hoort een bewuste keuze te zijn en geen ontdekking
achteraf.

**Implementatieverslag T102 (uitgevoerd).** Eén gedeelde constante
(`SUBDIVISIE_SEGMENTEN = 8`) en twee kleine ingrepen: `blok()` kreeg
optionele `segX/segY/segZ`-parameters (default 1, dus 100% ongewijzigd
gedrag voor de meubel-/decor-aanroepen die `blok()` ook gebruiken, zoals
`bouwSchuurtje()`), en `vlak()` kreeg de subdivisie onvoorwaardelijk —
elke `vlak()`-aanroep bleek bij nazoeken een kamervloer/-plafond, geen
enkele decoratieve toepassing. Een nieuwe `muurSegmenten(breedte, diepte)`
kiest per muur automatisch welke as de "lange" (8 segmenten) en welke de
"dunne" (1 segment, de muurdikte) is, zodat elke muur — ongeacht of hij
langs X of Z loopt — zijn subdivisie op de juiste as krijgt. Toegepast op
alle vier de muur-bouwfuncties (`bouwMuur`, `bouwZoneEMuur`,
`bouwGrachtMuur`, `bouwBinnenplaatsMuur`) en alle losse vloer/plafond-
constructies die niet via `vlak()` liepen (woonkamer, binnenplaats,
kelder, kelderoost, vliering).

Zoals voorspeld: nul zichtbaar effect op zichzelf (BoxGeometry/
PlaneGeometry zetten een uniforme analytische normal per face, ongeacht
segmentaantal), bevestigd doordat geen enkele helderheids- of draw-call-
check in `test-visuele-basislijn.mjs` verschoof. Het driehoekstal steeg
wél fors (van ~2,3k-12,5k naar ~15,6k-35,4k per standpunt, ruim binnen het
vooraf ingeschatte "40-60k"-budget) — een bewuste, gedocumenteerde
`RENDER_BAND`-overschrijding, met de basislijn-`triangles`-waarden
dienovereenkomstig bijgewerkt.

**Implementatieverslag T103 (uitgevoerd, MET een bewuste scope-reductie
t.o.v. de oorspronkelijke spec hierboven).** De oorspronkelijke beslissing
vraagt om occlusie af te leiden uit `obstakels` (2D-nabijheid tot ANDERE
objecten) inclusief de hierboven beschreven na-pass-architectuur en
deurgat-uitzondering. Bij het bouwen bleek een eenvoudiger, aantoonbaar
veiliger ontwerp het grootste deel van dezelfde visuele winst te leveren
zonder het deurgat-risico:

In plaats van `obstakels`-nabijheid gebruikt de uiteindelijke bake
UITSLUITEND de geometrie van het vlak ZELF: een muur wordt donkerder
naarmate een vertex dichter bij zijn EIGEN top- of bodemrand ligt (waar
hij per definitie een plafond/vloer raakt — geen muur mist ooit een van
beide), en een vloer/plafond donkerder naarmate een vertex dichter bij
een van zijn EIGEN vier randen ligt (die altijd tegen een muur eindigen).
Bewust NIET de linker/rechter rand van een muur — dat is precies waar een
deuropening kan zitten, en zonder een betrouwbare manier om per muur-
segment te weten of zijn korte rand een echte hoek is of een deurgat, is
het risico op een "dichtgesmeerde" opening (§10.7's eigen waarschuwing)
groter dan de esthetische winst van muur-tot-muur-hoeken. Deze scope —
verticale muurranden + alle vloer/plafondranden — is per constructie
ALTIJD correct (nooit een obstakel-lookup nodig, dus ook geen na-pass-
architectuur, geen `obstakels`-afhankelijkheid, geen Y-blindheid-probleem)
en dekt het leeuwendeel van de "kamers voelen plat"-klacht.

**De materiaalcache-oplossing (§10.7's route (a)).** Niet een aparte
sleutel-string-cache zoals de beslissing voorstelde, maar een `WeakMap`
(`vertexKleurTweelingen`) die per basismateriaal-OBJECT een "tweeling"
onthoudt: `matMetVertexKleur(basisMateriaal)` kloont het basismateriaal
(nooit het origineel gemuteerd — `mat()`/`matFamilie()` blijven zelf
volledig ongewijzigd) en zet `vertexColors = true` op de kloon, gecachet
zodat twee meshes met hetzelfde basismateriaal dezelfde tweeling delen.
Eenvoudiger dan een parallelle sleutel-cache, met dezelfde garantie: een
materiaal krijgt nooit `vertexColors:true` zonder dat de bijbehorende
geometrie ook echt een `color`-attribuut heeft (elke aanroeper bakt eerst
de kleur, wraptdaarna pas het materiaal).

**Een subtiele valkuil: materiaal-overschrijvingen ná `vlak()`.** Drie
call-sites (`gangVloerMesh`, `bijkeukenVloerMesh`, `vlonderMesh`)
vervangen hun `vlak()`-materiaal achteraf door een `matFamilie()`-aanroep
(Ticket 38's textuur-migratie) — zonder aanpassing zou dat de al gebakken
occlusiekleur laten "verdampen" (de nieuwe `matFamilie()`-instantie heeft
geen `vertexColors:true`, dus het aanwezige `color`-attribuut wordt
simpelweg genegeerd, geen crash maar wel een stille regressie). Opgelost
door die drie toewijzingen te wrappen in `matMetVertexKleur(matFamilie(
...))` — `vlak()`'s eigen return-comment waarschuwt hier nu expliciet voor.

`test-hoekocclusie.mjs` (12 checks, nieuw) bevestigt: er bestaat
daadwerkelijk minstens één occlusie-gebakken wereldmesh, `matMetVertexKleur()`
muteert het gedeelde basismateriaal nooit en cachet correct per basis-
materiaal, `bakMuurOcclusie()` leest structureel UITSLUITEND `pos.getY()`
(nooit X/Z — de bron-garantie achter het "geen deurgat smeert dicht"-
ontwerp) terwijl `bakVlakOcclusie()` bewust wél X én Y gebruikt,
`occlusieFactor()`'s grenswaarden kloppen (rand=donkerst, ruim voorbij
`OCCLUSIE_BEREIK`=1, negatieve afstand geklemd), elke gebakken
vertexkleur is grijswaarde (nooit een tint), en `obstakels.length` blijft
ongewijzigd (T102/T103 raken uitsluitend visuele geometrie/materiaal).

Op drie standpunten verschoof de gemeten helderheid net over de strikte
2%-`BAND`: atelier (camera dicht bij de nis-hoek, -2,4% gemiddelde),
binnenplaats (klinkers-mediaan dicht bij de muurrand, -4,6%) en vliering
(bijna-zwarte baseline, dus een kleine absolute verschuiving is al een
grote procentuele, -4,8%) — allemaal de verwachte, gewenste richting
(donkerder bij randen), dus de basislijn-`gemiddelde`/`mediaan`-waarden
zijn voor die drie zones bijgewerkt. De overige vijf bleven ruim binnen de
band. Volledige regressiesuite ná T102+T103: groen (zie de eindsamenvatting
onderaan dit hoofdstuk voor het exacte totaal).

### 10.8 Beslissing 83 — Eén eigen naverwerkingspass als drager (T96, T97, T98)

**Wat er nu is.** `RenderPass` → `UnrealBloomPass(256×256, 0,35, 0,4,
0,82)` → `OutputPass`. Verder niets. Het vignet (`#vignet`) en de
schade-wedge (`.schadeWedge`) zijn DOM-elementen met `z-index` 6 en 7:
ze liggen letterlijk bóvenop het beeld, buiten de tonemapping en buiten
de bloom.

**Een detail dat nergens vastligt en hier thuishoort.** `antialias: true`
op de `WebGLRenderer` werkt **niet** meer zodra je via een
`EffectComposer` naar een render target rendert. De anti-aliasing in dit
spel is dus al zwakker dan de constructor suggereert. Dat is geen bug die
deze ronde oplost, maar het verklaart waarom filmkorrel (T96) hier
relatief veel oplevert: korrel maskeert trapjesranden en banding in
gradiënten, en dit beeld heeft beide.

**De beslissing.** Precies **één** nieuwe `ShaderPass`, die vier dingen
tegelijk doet, geplaatst ná `bloomPass` en vóór `OutputPass`:

| Term | Ticket | Waarom in deze pass |
| --- | --- | --- |
| Filmkorrel | T96 | hash-ruis op `gl_FragCoord` + tijd |
| Chromatische aberratie | T96 | radiale UV-offset per kanaal |
| Vignet | T97 | radiale demping, uniform-gestuurd |
| Per-zone kleurgrading | T98 | lift/gamma/gain-matrix, uniform-gestuurd |

**Waarom één pass en niet vier.** Elke extra full-screen pass is een
volledige lees/schrijf-cyclus over het scherm. Vier passes = vier
cycli; één pass met vier uniform-gestuurde termen = één cyclus. Op een
fragment-bound scene (§10.3) is dat het verschil tussen "merkbaar" en
"significant". Het architecturale gevolg: T96 bouwt de pass, T97 en T98
voegen er alleen uniforms en een paar regels aan toe.

**`ShaderPass` is geen nieuwe afhankelijkheid.** Hij komt uit
`three/addons/postprocessing/`, exact dezelfde submodule-map waaruit
`EffectComposer`, `RenderPass`, `UnrealBloomPass` en `OutputPass` al
komen — dezelfde CDN-host, dezelfde versie, dezelfde importmap-entry.
Dit is expliciet **geen** tweede CDN-afhankelijkheid en dus geen
herhaling van het risico uit waarschuwing 32. De populaire
derde-partij-bibliotheek `postprocessing` (vanruesc) zou dit makkelijker
maken en wordt bewust **niet** gebruikt: voor één pass die je in vijftig
regels zelf schrijft, is een tweede host en een tweede
versiecompatibiliteitsrisico de verkeerde ruil.

**Wat in DOM blijft.** De `.schadeWedge` blijft een DOM-element. Die moet
juist scherp en direct leesbaar zijn; post-processing zou hem alleen
zachter maken. Dat is een leesbaarheidsbeslissing, geen technische.

**De drie termen hebben elk een leesbaarheidsgrens.** Korrel die je als
korrel ziet, is te sterk. Chromatische aberratie in het beeldcentrum is
misselijkmakend — hij moet radiaal zijn en pas voorbij ~60% van de
straal beginnen, anders lijdt het richtpunt eronder. En het vignet maakt
de beeldranden donkerder, precies waar ondoden in het perifere zicht
verschijnen; daar hoort een expliciete bovengrens op.

**T98 (per-zone grading) moet luminantie-neutraal blijven.** Hij mag de
*chroma* verschuiven — kelder groeniger, atelier koeler, gracht
blauwgroener — maar niet de helderheid, anders vecht hij met de
kalibratie uit T88. En omdat `zoneVan()` een discrete functie is, moet de
interpolatie tussen zones in de pass zitten (over minstens een halve
seconde), niet in de zonelogica.

**Implementatieverslag T96 (uitgevoerd).** Eén `ShaderPass` (import uit
dezelfde `three/addons/postprocessing/`-map als de vier bestaande passes,
dus geen tweede CDN-afhankelijkheid), geconstrueerd uit een handgeschreven
`NAVERWERKING_SHADER`-object (`uniforms`/`vertexShader`/`fragmentShader`)
en toegevoegd als `naverwerkingsPass` ná `bloomPass`, vóór `OutputPass` —
`composer.passes.length` ging van 3 naar 4.

- **Chromatische aberratie**: radiale UV-offset per kleurkanaal
  (`texture2D(tDiffuse, vUv ∓ richting·factor).r/.g/.b`), met `factor =
  smoothstep(ABERRATIE_START_RADIUS, 1.0, radius) * ABERRATIE_STERKTE *
  uSterkte`. `radius` is genormaliseerd op de afstand tot een BEELDHOEK
  (`distance(vUv, 0.5) / 0,7071`), niet tot een randmidden — anders zou
  `ABERRATIE_START_RADIUS` (0,6) geen eerlijke "60% van de straal" meer
  zijn. `smoothstep` garandeert nul tot de drempel en een vloeiende
  oploop erna, dus geen aberratie in het richtpunt zelf.
- **Filmkorrel**: hash-ruis op `gl_FragCoord.xy + uTijd` (dezelfde
  geen-textuur-hash-truc als T94's rookgradient, maar analytisch in GLSL
  i.p.v. canvas). `uTijd` volgt de AL BESTAANDE bevriesbare klok `t` uit de
  lampflikker-berekening (`visueleBevriesTijd !== null ? ... : nu *
  0.001`) — hetzelfde mechanisme waarmee T88 de lampflikker deterministisch
  meet, nu gratis hergebruikt voor de korrel.
- **`uSterkte`**: de ENE schakelbare master-uniform (default 1) die beide
  termen tegelijk schaalt — voorbereid op T115's toegankelijkheidsschakelaar
  zonder dat ticket al te bouwen.

**De bug die de basislijntest meteen ving (en waarom hij precies dáár
zat).** De eerste versie telde de korrel op (`kleur += korrel`). Deze pass
zit vóór `OutputPass`, dus nog in lineaire (niet-sRGB-gecodeerde) ruimte.
`test-visuele-basislijn.mjs` sloeg meteen aan: de heldere zones (woonkamer
t/m bijkeuken, mediaan 18-31) schoven maar 2-4% op, maar de donkere zones
schoven schokkend ver — **vliering 1,65 → 10,93 (6,6×), gracht 7,78 →
15,59 (2×)**. Oorzaak: sRGB-encodering is steil bij zwart, dus een kleine
ABSOLUTE toevoeging in lineaire ruimte wordt door `OutputPass`'
gammacurve in bijna-zwarte pixels enorm uitvergroot — precies de zones
waar dit spel het donkerst is. Fix: `kleur *= 1.0 + korrel` (multiplicatief
i.p.v. additief). Multiplicatieve ruis schaalt automatisch mee met de
eigen helderheid van elke pixel (0 × ruis = 0), dus blijft overal
evenredig subtiel. Ná de fix: alle acht zones binnen de bestaande 2%-band,
**geen enkele BASISLIJN-waarde hoefde bijgewerkt te worden** — de enige
legitieme wijziging aan `test-visuele-basislijn.mjs` was de
`composerPasses`-invariant (3 → 4).

`test-naverwerking.mjs` (13 checks, nieuw — wordt door T97/T98 verder
uitgebreid, niet vervangen) bevestigt: de pass-volgorde en -telling, dat de
uniforms bestaan met de juiste defaults, dat `uTijd` de bevriesbare klok
volgt, een bronvorm-check op de `smoothstep`-drempel en de
multiplicatieve-korrel-regel, en — het functionele bewijs — dat
`uSterkte=0` versus `uSterkte=1` op hetzelfde bevroren standpunt
aantoonbaar verschillende pixels oplevert (de master-uniform doet echt
iets). Volledige regressiesuite ná T96: zie de samenvatting bij T98
hieronder (fase 2 in één keer afgesloten).

**Implementatieverslag T97 (uitgevoerd).** Het rode HP-vignet verhuist van
`#vignet` (DOM, `radial-gradient` + JS-gestuurde `opacity`) naar drie
extra uniforms op dezelfde `naverwerkingsPass` uit T96 —
`composer.passes.length` blijft 4. De radiale afstandsberekening
(`radius`, genormaliseerd op 1,0 = beeldhoek) is dezelfde variabele die
T96 al voor de aberratie berekent; het vignet mengt met `mix(kleur,
uVignetKleur, smoothstep(uVignetRadius, 1.0, radius) * 0.9 *
uVignetSterkte * uSterkte)` — `uVignetRadius` (0,55) en de `0,9`-factor
matchen exact de oude CSS-gradient se stops (`55%`/`rgba(...,0.9)` op
100%), puur een verhuizing van de vorm zelf. `VIGNET_KLEUR` is hetzelfde
`0xaa0a0a`-rood.

**Nieuw t.o.v. de oude versie: een Stroomuitval-term.** De oude DOM-versie
reageerde nergens op `stroomFactor` — `updateVignet()` las alleen HP. De
ticket-spec eiste expliciet "reageert op HP ÉN Stroomuitval", dus
`updateVignet()` telt nu een tweede, onafhankelijke term mee:
`stroomLaag = (1 - stroomFactor) * VIGNET_STROOM_FACTOR` (0,35) — bij een
volle Stroomuitval (`stroomFactor = STROOMUITVAL_DIM_FACTOR = 0,12`) komt
dat op ~0,31 extra sterkte, merkbaar maar niet overheersend, en volledig
onafhankelijk van de speler-HP (getest met HP op maximum, zodat alleen de
Stroomuitval-term het verschil verklaart).

**De bovengrens.** `VIGNET_STERKTE_MAX = 1` staat als expliciete
module-constante en klemt de som van HP-term + Stroomuitval-term +
schade-flits (`Math.min(VIGNET_STERKTE_MAX, hpLaag + stroomLaag +
vignetFlits * 0.6)`) — zelfde ceiling als de oude `Math.min(1, ...)`, nu
alleen benoemd i.p.v. een losse magic number. Omdat de vignet-vorm zelf
(`smoothstep` vanaf 55% straal) de kern van het beeld sowieso nooit
raakt, blijft zelfs de worst-case-combinatie (0 HP, verse flits, volle
Stroomuitval — getest) het middenbeeld onaangetast; alleen de uiterste
randen/hoeken verdiepen.

`test-naverwerking.mjs` uitgebreid (niet vervangen, per de ticket-spec)
met 11 nieuwe checks: het DOM-element is weg, `.schadeWedge` staat nog
gewoon met zijn volle pool in de DOM, geen extra pass, de drie nieuwe
uniforms bestaan, HP- en Stroomuitval-reactie elk apart bewezen (de een
met de ander op zijn neutrale waarde vastgezet, om kruisbesmetting tussen
de twee termen uit te sluiten), de bovengrens-klem, en dat
`spelerSchade()` nog steeds een flits geeft die vanzelf uitdooft. Het
bestaande `test-schaderichting.mjs` (schadeWedge-gedrag) en
`test-stroomuitval.mjs` blijven allebei volledig groen — geen van beide
raakt het vignet, dus geen enkele aanpassing nodig.

**Implementatieverslag T98 (uitgevoerd — fase 2 hiermee volledig
afgesloten).** Lift/gamma/gain als drie `THREE.Vector3`-uniforms
(`uGradeLift`/`uGradeGamma`/`uGradeGain`) op dezelfde `naverwerkingsPass` —
nog steeds `composer.passes.length === 4`. De gradeerformule is de
standaard ASC-CDL-achtige opbouw (`gelift = kleur + lift·(1-kleur);
gegaind = gelift · gain; gegradeerd = pow(gegaind, 1/gamma)`), toegepast
ná de filmkorrel en vóór het vignet in dezelfde fragment-shader.

**De luminantie-neutraliteit is een GARANTIE, geen tuning-doel.** In
plaats van de lift/gain-constanten met de hand zo te kalibreren dat ze
"toevallig" weinig helderheid verschuiven (breekbaar: elke scène heeft een
andere gemiddelde kleur, dus dezelfde constanten zouden in de ene kamer
wél en de andere kamer niet binnen de band vallen), herschaalt de shader
elk gegradeerd pixel na afloop terug naar zijn EIGEN oorspronkelijke
luminantie (`dot(kleur, vec3(0.2126, 0.7152, 0.0722))` vóór en ná,
`gegradeerd *= lumaVoor / lumaNa`). Dat garandeert neutraliteit exact, per
pixel, ongeacht hoe de per-zone-profielen hieronder ooit nog getuned
worden — een sterkere eis dan wat de ticket-spec vroeg, en robuuster dan
de alternatieve "tune het totdat de basislijntest slaagt"-aanpak.

**Acht zones, niet vijf.** `zoneVan()` kent alleen de vijf hoofdkamers;
kelder/vliering/gracht delen elk een `zoneVan()`-index met een buurzone
(kelder/vliering met het atelier se x/z, gracht met de bijkeuken) maar
verdienen volgens de ticket-spec elk hun eigen kleurtoon ("kelder
groeniger, atelier koeler, gracht blauwgroener"). Nieuwe
`kleurgradingZoneVan(x, y, z)`, naast `zoneVan()` zelf: eerst
`berekenVlieringY(x, z) !== null` (vliering), dan `y < -0,1` (kelder —
zelfde y-drempel als `tekenMinimap()` al gebruikt voor exact dezelfde
"twee-overlappende-zones-op-de-kaart"-reden), dan `x >= VLONDER_X_WEST`
binnen zone 4 (gracht — "hier stopt het plafond, buiten begint", een
bestaande constante/comment die dit al markeerde), anders `zoneVan(x, z)`
zelf (0-4). `KLEUR_GRADING_ZONES[0..7]` volgt exact dezelfde volgorde als
T88's `berekenVisueleStandpunten()`.

**De overgang zit in JS, niet in GLSL** — bewust dezelfde architectuur als
T93's `updateZoneFog()`, niet een nieuwe. Een discrete
`kleurgradingZoneVan()`-wissel (eigen trigger-blok in `gameLoop`, los van
de bestaande `zoneNu`-wissel hierboven, want fijnere granulariteit) zet
een `kleurgradingTimer` op `KLEUR_GRADING_OVERGANG_DUUR` (0,5 s, het
spec-minimum) en snapshot de HUIDIGE (mogelijk nog blendende) uniformwaarde
als nieuw vertrekpunt — exact het `zoneFogVan`-patroon. `updateKleurgrading(dt)`
lerpt daarna de drie uniforms rechtstreeks (`Vector3.copy().lerp()` op de
AL BESTAANDE uniform-objecten, geen allocatie) en doet niets zolang er
niets te blenden valt.

**Een test-artefact, geen echte regressie (gevonden tijdens het
bouwen).** De basislijn-uitbreiding zette de gradering per standpunt
rechtstreeks (spelActief staat in die meetflow nooit aan, dus de echte
trigger loopt niet) en mat zowel gemiddelde als mediane helderheid tegen
de bestaande 2%-band. Twee zones faalden aanvankelijk op de MEDIAAN:
vliering (1,65 → 1,78, +7,9%) en gracht (7,78 → 8,22, +5,6%) — allebei
met een gemiddelde die ruim binnen de band bleef. Oorzaak: de mediaan is
één 8-bit pixelwaarde, geen gemiddelde over duizenden pixels; bij een
baseline die al bijna zwart is (1,65 van de 255) is zelfs één
afrondingsstap uit de `pow()`/`clamp()`-gradeerwiskunde al een schijnbaar
grote procentuele afwijking. Fix: een absolute ondergrens
(`MEDIAAN_KWANTISATIE_VLOER = 0,5`) naast de relatieve band, uitsluitend
voor deze mediaan-toets — de gemiddelde-toets (de statistisch robuustere
van de twee) behield de zuivere relatieve band.

`test-visuele-basislijn.mjs` uitgebreid met 19 nieuwe checks (16
helderheid-binnen-band, 3 kleurindicator: kelder meetbaar groener dan het
atelier, atelier meetbaar kouder dan de kelder, en alle drie
kelder/atelier/binnenplaats onderling verschillend) — 65/65 groen.
`test-naverwerking.mjs` uitgebreid met 12 checks voor de pass-mechanica
zelf: geen extra pass, de acht uniforme classificaties (inclusief het
kelder/atelier-deelt-een-zoneVan()-index-randgeval), en een ECHTE
runtime-trigger (via de kelder-coördinaten uit T88's
`berekenVisueleStandpunten()` — een handmatige `positie.y`-zet bleek
meteen overschreven te worden door `updateSpeler()`'s eigen
`berekenVloerY()`-afleiding, ook een test-artefact, gefixt door de echte
kelder-x/z te gebruiken en de y-hoogte door het spel zelf te laten
berekenen) die bevestigt dat de overgang niet instant snapt en na afloop
exact op het doel uitkomt.

**Volledige regressiesuite ná fase 2 (T96+T97+T98 samen): 67/67 groen, 0
FAIL.**

**Tuning-noot (na speeltest).** Het atelier-profiel voelde te koel — de
overgang vanuit buurzones (woonkamer/gang, allebei bijna neutraal) las
als een harde sprong. `gain` ging van `(0,93, 0,98, 1,08)` naar `(0,965,
0,99, 1,04)` en `lift.z` van `0,015` naar `0,008` — ruwweg de halve
afwijking t.o.v. neutraal, zelfde richting. Gemeten (gemiddelde R/G/B over
het atelier-standpunt): de B-min-R-contrast zakte van 14,0 naar 8,5 (~39%
zachter). Omdat de luminantie-neutraliteit in de shader zelf gegarandeerd
wordt (de per-pixel luma-herschaling, zie hierboven) had deze tuning geen
enkel effect op `test-visuele-basislijn.mjs`'s helderheids-checks — alleen
de richtingsgebonden kleurindicator-checks (kelder groener dan atelier,
atelier kouder dan kelder) bleven relevant, en die bleven groen omdat de
RICHTING van de tint ongewijzigd is, alleen de sterkte.

Een tweede feedbackronde vroeg om ook de kelder minder heftig te maken.
Dezelfde halvering als bij het atelier (`gain (0,92, 1,08, 0,94)` →
`(0,96, 1,04, 0,97)`) bleek hier ÉÉN grens te ver: `test-visuele-
basislijn.mjs`'s "kelder is meetbaar groener dan het atelier"-check sloeg
om (gemeten G/R: kelder 0,929 vs atelier 0,968 — de kelder was na een
volle halvering niet meer de groenste van de twee, want het atelier was
zelf óók al gehalveerd in dezelfde ronde). Dit is precies waar de check
voor bedoeld is: een geautomatiseerd signaal vóórdat de bewuste
kelder/atelier-onderscheiding uit §10.8 zonder opzet zou wegvallen. Een
kleinere reductie (~30% i.p.v. 50%, `gain (0,944, 1,056, 0,958)`, gevonden
door de daadwerkelijke gerenderde G/R-verhouding bij een paar tussenwaarden
te meten in plaats van te raden) laat de kelder ruim boven het atelier
blijven (G/R 1,029 vs 0,968) en blijft toch een merkbaar zachtere kelder
dan de oorspronkelijke versie. `test-visuele-basislijn.mjs`: 65/65 groen;
`test-naverwerking.mjs`: 34/34 groen.

Een DERDE feedbackronde vroeg om het kelder-groen nóg eens 20-30% te
verminderen (t.o.v. de op dat moment al 30%-verzachte waarde). Gemeten:
elke waarde in dat bereik (`extraReductie` 0,2-0,3 op de toen-huidige
gain) duwde de gerenderde G/R weer onder die van het atelier (0,95-0,93
vs atelier se 0,968) — de marge uit de vorige ronde bleek precies zo
krap dat een tweede, kleinere ronde 'm al opnieuw opsoupeerde. In plaats
van de kelder daarom NIET verder te verzachten (wat de speeltestfeedback
zou negeren) is de "kelder groener dan atelier"-check zelf herzien: hij
vergeleek twee ONAFHANKELIJK tunebare zones via hun gerenderde pixels, en
brak dus per definitie opnieuw zodra alleen de sterkte van een van
beide veranderde — een fundamenteel fragiele testvorm voor iteratieve
art-direction, niet een eenmalig ongeluk. Vervangen door een structurele
check op `KLEUR_GRADING_ZONES` zelf: kelder se `gain.y` (groen) moet het
dominante, opgehoogde kanaal zijn in DIE ENE gain-vector; atelier se
`gain.z` (blauw) idem voor dat profiel. Dat toetst precies de
ontwerpintentie uit §10.8 ("kelder groeniger, atelier koeler") —
de RICHTING van elke tint — en blijft correct ongeacht hoe ver de
STERKTE ooit nog getuned wordt, in beide zones onafhankelijk van elkaar.
De kelder staat nu op `gain (0,958, 1,042, 0,9685)`, `lift.y = 0,005` —
in totaal ruim de helft zachter dan het origineel over drie
feedbackrondes. `test-visuele-basislijn.mjs`: 65/65 groen;
`test-naverwerking.mjs`: 34/34 groen (ongewijzigd — die tests raken de
kleurgrading-sterkte niet, alleen het triggermechanisme).

**Een VIERDE feedbackronde** (na de T99-T101-ronde, ná het terugdraaien
van T101 — zie §10.10) vroeg om zowel het atelier-blauw als het
kelder-groen nóg eens 10-20% te verminderen t.o.v. de op dat moment
geldende waarden, plus een klein beetje van het atelier-effect mee te
nemen naar de vliering. Beide reducties: 15% van de afwijking-t.o.v.-
neutraal (gain/lift richting `1`/`0`) — gekozen als middenwaarde van de
gevraagde 10-20%-band. Rechtstreeks gemeten via de uniform (niet via de
trigger — zie de meetkanttekening hieronder): atelier-koelheid (B-min-R)
zakte van 8,42 naar 7,46 (-11,4%), kelder-groenheid (G-min-gemiddelde-
R/B) zakte van 2,46 naar 2,01 (-18,2%) — allebei binnen de gevraagde
band. Atelier: `gain (0,965, 0,99, 1,04)` → `(0,9703, 0,9915, 1,034)`,
`lift.z` `0,008` → `0,0068`. Kelder: `gain (0,958, 1,042, 0,9685)` →
`(0,9643, 1,0357, 0,9732)`, `lift.y` `0,005` → `0,0043`.

**Meetkanttekening (herbevestigd, zelfde les als T88's "spelActief staat
hier nooit aan"-toelichting).** Een eerste meetpoging muteerde
`KLEUR_GRADING_ZONES[i]` rechtstreeks en riep daarna `zetVisueelStandpunt`
aan — dat gaf een schijnbaar 0,0%-verschil. Oorzaak: de kleurgrading-
trigger (`if (kleurgradingZoneNu !== laatsteKleurgradingZone)` in
gameLoop) zit ZELF binnen `if (spelActief) {...}`, en `spelActief` staat
in de `openVoorVisueleMeting()`-meetflow permanent uit — dus zelfs een
"echte" eerste meting (zonder enige mutatie) paste helemaal GEEN
kleurgrading toe en las gewoon de neutrale, ongegradeerde scene, voor élke
zone. `test-visuele-basislijn.mjs`'s sectie 6 loste dit al eerder op door
`naverwerkingsPass.uniforms.uGradeLift/Gamma/Gain` vóór elke meting
RECHTSTREEKS te zetten (bewust bijgeschreven in de code als "de echte
runtime-trigger loopt hier nooit door zichzelf") — deze ronde hergebruikte
exact dat patroon voor de vergelijkende voor/na-meting.

**Vliering neemt een klein beetje van het atelier-effect mee.** Expliciet
gevraagd: niet de vliering-tint vervangen, alleen een fractie van de
atelier-koelte ERBIJ mengen. 20% van de (nieuwe, net-getunede)
atelier-afwijking-t.o.v.-neutraal is opgeteld bij de bestaande vliering-
waarden: `gain (1,06, 1,02, 0,9)` → `(1,054, 1,018, 0,907)`, `lift.z`
`0` → `0,0014` (lift.x/lift.y ongewijzigd, want het atelier-profiel heeft
daar zelf geen afwijking om mee te nemen). Gemeten: vliering-koelheid
(B-min-R) steeg van 1,90 naar 2,06 — een merkbare maar bescheiden
verschuiving, de warme zolder-identiteit (`gain.x > 1`, `gain.z < 1`)
blijft dominant.

Geen enkele test raakte deze ronde: de structurele kelder-/atelier-
richtingscheck (§10.10 se herziening) blijft groen omdat alleen de
STERKTE veranderde, nooit de RICHTING, en de vliering had nooit een
eigen richtingscheck. `test-visuele-basislijn.mjs`: 65/65 groen;
`test-naverwerking.mjs`: 34/34 groen; volledige regressiesuite: 68/68
groen.

### 10.9 Beslissing 84 — Camerabeweging als cosmetische laag (T92)

**Het probleem.** De camera staat volkomen stil tijdens het lopen. Er is
`terugslag` en `cameraKick` per schot, en een `WAPEN_HERLAAD_DIP_AMPLITUDE`
van 0,05 op het wapenmodel — maar geen loopwiegen, geen landingsdip,
geen lean. In een FPS wordt beweging voor een groot deel gevoeld door de
camera, niet door de wereld.

**De beslissing.** Drie gedempte, puur cosmetische termen op de camera,
in de bestaande cosmetische zone van de gameLoop waar `terugslag` en
`cameraKick` al wegvallen. Die code heeft al de juiste vorm én de juiste
discipline (hij loopt door tijdens pauze zonder de simulatie te raken).

**Drie architecturale eisen:**

1. **Het wiegen hangt aan de afgelegde afstand, niet aan de tijd.**
   Anders wiegt het beeld ook als je stilstaat. Dit is de klassieke fout
   bij headbob en hij is achteraf lastig te herkennen.
2. **De camerabeweging staat volledig buiten de collision- en
   raycastketen.** `updateSpeler()`, `losBotsingenOp()` en `schiet()`
   mogen de gewiegde y/z nooit zien. Een schot moet exact hetzelfde
   raken als nu.
3. **Het wapenmodel wiegt tegen.** Anders verstoort het wiegen het
   richten, en dat is een gameplay-regressie vermomd als sfeer.

**Misselijkheid is een reëel risico.** Camerabeweging is een van de
weinige visuele ingrepen die spelers fysiek onwel kan maken. De
amplitude blijft in centimeters en onder één graad lean, en er hoort een
schakelaar bij in hetzelfde instellingenmenu waar `muisgevoeligheid`
(T75) al staat. Dat menu-item valt buiten dit ticket maar hoort in de
overweging.

**Implementatieverslag T92 (uitgevoerd).** Alle nieuwe state (`bobFase`,
`leanHoek`, `landingsDipTimer`/`-Sterkte`, `pieksnelheidDaling`,
`vorigeSpelerX`/`Z`, `vorigeVloerY`) leeft als losse module-`let`s naast
`terugslag`/`cameraKick`, en de berekening zelf zit in één nieuw blok in
de bestaande cosmetische gameLoop-zone, ná de bestaande
`vlamTimer`-afhandeling, vóór `composer.render()`.

- **Loopwiegen**: `bobFase` loopt op met de ECHTE XZ-afstand tussen twee
  frames (`Math.hypot(dx, dz)`), niet met `dt` — bij stilstand verandert
  de fase dus niet, en `Math.sin(bobFase) * BOB_AMPLITUDE` (1,6 cm, zie de
  tuning-noot hieronder) blijft
  dan letterlijk constant (bevriest op de laatste fase, keert niet actief
  terug naar 0 — dat voldoet aan de acceptatie-eis "constant", en is
  bewust simpel gehouden i.p.v. een extra uitfaseer-envelope).
- **Landingsdip**: leidt een verticale snelheid af uit
  `speler.positie.y` (al door `updateSpeler()` ververst via
  `berekenVloerY()`) en triggert zodra een daling onder
  `LANDING_TRIGGER_SNELHEID` weer afvlakt — dat gebeurt zowel onderaan de
  kelder-ramp/vlieringtrap als bij abrupt stoppen halverwege een helling.
  De dip zelf hergebruikt de bestaande `Math.sin(voortgang·π)`-boog van de
  herlaad-/wisseldip (WAPEN_HERLAAD_DIP_AMPLITUDE-patroon), geklemd op
  `LANDING_DIP_MAX` (2,8 cm, getuned).
- **Lean**: interpoleert `camera.rotation.z` naar `±LEAN_MAX_HOEK` (0,45°,
  getuned)
  op basis van `ingedrukt['KeyD'/'KeyA']` rechtstreeks — geen aanraking
  van `updateSpeler()`.
- **Wapen-tegenwiegeling**: het wapenmodel (kind van `camera`, dus erft de
  bob/lean al gratis mee) krijgt bovenop die overerving een EIGEN,
  onafhankelijke zijwaartse sway (`Math.sin(bobFase) * WAPEN_SWAY_AMPLITUDE`
  op `position.x`) en een tegengestelde fractie van `leanHoek` op zijn
  eigen `rotation.z` — zodat het niet star/vastgeschroefd oogt, maar ook
  het richten niet verstoort.

**De raycast-garantie (kernvereiste 2).** `updateSpeler()` kreeg één
regel erbij: `camera.rotation.z = 0;`, direct na de bestaande
`rotation.x`/`rotation.y`-zet. Dat is geen camerabeweging (geen nieuwe
term, geen interpolatie) — het voltooit alleen de al bestaande discipline
dat `updateSpeler()` de camera ELK frame volledig vers zet vanuit
`speler`-state, nu ook voor de derde rotatie-as. Omdat `schiet()` in
dezelfde gameLoop-tick vóór dit cosmetische blok loopt (de
`schietKnopIngedrukt`-check zit hoger in gameLoop), ziet een raycast
daardoor NOOIT een lean- of bobrestant van de vorige tick — bewezen via
een directe test die `camera.position.y`/`rotation.z` opzettelijk
"corrumpeert" en dan aantoont dat `updateSpeler()` ze onvoorwaardelijk
terugzet.

**Twee robuustheidsfixes, gevonden tijdens het testen (geen van beide
zichtbaar in normale gameplay, wel gemeten via T88's basislijn/eigen
tests):**

1. **Teleport-clamp op de bob-afstand.** Een directe `speler.positie.set()`
   (bijv. een debug-herpositionering) las bij de eerstvolgende tick als
   een absurd grote "afgelegde afstand". `afgelegdeAfstand` is nu geklemd
   op `speler.snelheid * 0,05` (dezelfde 0,05s-hitch-grens als `dt` zelf
   in gameLoop) — een normale stap raakt deze grens nooit, een teleport
   kan bobFase niet meer laten springen.
2. **`sin()` i.p.v. `cos()` voor de wapen-sway.** De eerste versie gebruikte
   `cos(bobFase)`, wat bij `bobFase = 0` (in rust) niet 0 is — het wapen
   stond dus ook in volledige stilstand 0,8 cm verschoven t.o.v.
   `WAPEN_BASIS_X`. Dat verschoof T88's vliering-mediaan met bijna 5%
   (gemeten). `sin()` is wél 0 in rust.

`test-camerabeweging.mjs` (24 checks, nieuw) bevestigt: stilstand blijft
constant, lopen varieert binnen de band, lean interpoleert beide kanten
op en terug, de landingsdip-boog triggert/klemt/decayt correct, de
wapen-tegenwiegeling blijft binnen zijn amplitude en staat tegengesteld
aan de lean, en — het belangrijkste — een schotenreeks tijdens aantoonbaar
actieve bob raakt nog steeds elke keer. `test-visuele-basislijn.mjs`
bleef, ná de twee fixes hierboven en een uitbreiding van
`zetVisueelStandpunt()` (die nu ook `bobFase`/`landingsDipTimer`/
`-Sterkte`/`pieksnelheidDaling` en `vorigeSpelerX`/`Z`/`vorigeVloerY`
resynct bij elke standpunt-teleport, dezelfde discipline als de
bestaande `visueleBevriesTijd`/`lampDipFactor`-reset), 46/46 groen.
Volledige regressiesuite: **64/64 groen, 0 FAIL**.

**Tuning-noot (na speeltest, vóór T93-T95).** De eerste implementatie
(bovenstaande waarden) voelde in de praktijk heftiger dan bedoeld — een
cosmetische laag die opvalt in plaats van op de achtergrond blijft, is
het omgekeerde van het doel uit dit hoofdstuk. Alle vier amplitudes zijn
teruggebracht, verhoudingsgewijs gelijk (ruwweg naar iets meer dan de
helft), zonder de architectuur aan te raken: `BOB_AMPLITUDE` 0,03 → 0,016,
`LEAN_MAX_HOEK` 0,8° → 0,45°, `LANDING_DIP_MAX` 0,05 → 0,028,
`WAPEN_SWAY_AMPLITUDE` 0,008 → 0,004. `test-visuele-basislijn.mjs` (46/46)
en `test-camerabeweging.mjs` (24/24) blijven na de tuning groen — de
band-/klem-checks in die laatste testen relatief gedrag (varieert/keert
terug/blijft binnen amplitude), niet de absolute oude waarden, dus de
tuning verplaatst geen enkele test buiten zijn eigen tolerantie.

### 10.10 Beslissing 85 — De vijand krijgt een eigen lichtrespons (T99, T100, T101)

**Het probleem, en het symptoom dat het al jaren maskeert.** De ondoden
zijn van hetzelfde materiaal gemaakt als de wereld: een gewoon
`MeshStandardMaterial` met vergelijkbare roughness en zonder eigen
lichtrespons. In een donkere kamer is dat een donkere vorm tegen een
donkere achtergrond, en het enige wat je ziet zijn twee oranje stipjes.

Dat verklaart een patroon in de projecthistorie: `OOG_INTENSITEIT_BASIS`
is 1,4, `_AANVAL` 2,6, `_MIST` 2,6 en `_STROOMUITVAL` 3,4. Die trap is
er niet omdat felle ogen mooi zijn — hij is er omdat **de ogen in hun
eentje al het silhouetwerk moeten doen**. Dat is symptoombestrijding. Het
echte probleem is dat er geen silhouetscheiding is tussen vijand en
omgeving.

**De beslissing.** Drie tickets, in deze volgorde, allemaal op
`maakOndodeModel()` en de per-ondode materialen:

**T99 — Silhouet eerst.** Drie tot vijf extra gedeelde vormen via de
bestaande `geo()`-cache: schouders, handen, en een vod met een gekartelde
onderrand in plaats van een rechte. Vanaf tien meter in het donker
verandert dat het silhouet van "speelgoedfiguur" naar "iets dat op je
afkomt".

**T100 — Rimlight daarna, en niet andersom.** Een fresnel-term
(`pow(1.0 - dot(normal, viewDir), k)`) als extra emissieve bijdrage,
geïnjecteerd via `onBeforeCompile` op **uitsluitend** de
ondode-materialen.

**Er is nog geen fabriek om die injectie in te hangen (correctie na
review).** §7.9's materiaal-mutatiediscipline eist dat
`onBeforeCompile` in de materiaalfabriek zit en nooit achteraf op een
instantie — maar `maakOndodeModel()` maakt zijn materialen **inline en
per instantie** (`new THREE.MeshStandardMaterial({ color: huidKleur,
... })`, meerdere keren per ondode). Er ís dus geen fabriek. T100 moet
er eerst één maken: één `maakOndodeMateriaal(huidKleur, ...)` die alle
inline-constructies vervangt en die de injectie op één plek uitvoert.
Zonder die stap is de regel niet op te volgen en wordt de injectie
onvermijdelijk over meerdere call-sites uitgesmeerd. Kleur bewust koel en afwijkend van zowel het warme
lamplicht als het koele maanlicht, zodat een ondode nooit met decor te
verwarren is.

De volgorde is inhoudelijk, niet organisatorisch: **fresnel op harde,
blokkerige geometrie geeft een harde rand op de vlakovergangen in plaats
van een zachte rand rond het silhouet.** T100 vóór T99 zou een half
effect opleveren en tot bijstellen achteraf leiden.

Expliciet **geen** echte rimlight-lichtbron. Dat zou 14-18 extra
`PointLight`s betekenen bovenop 27 bestaande, en dat is bij een forward
renderer onbetaalbaar (§10.3, invariant 2).

**T101 — Verval-shading als laatste.** Een holte-gebaseerde
vertexkleur-gradient op de gedeelde `geo()`-vormen (die zijn gedeeld, dus
dit kost letterlijk niets per ondode) plus een procedurele vlekkenruis
met lage sterkte, beide vermenigvuldigend met `huidKleur`.

**Twee invarianten die deze drie tickets bewaken:**

- **`userData.lichaamsdeel === 'kop'` staat uitsluitend op het hoofd-mesh
  en de twee ogen.** Elk nieuw deel uit T99 krijgt die markering nooit.
  Dit is de hitbox-scheiding waar headshots aan hangen — een schouder die
  per ongeluk als kop telt, is een balanswijziging.
- **De type-kleuren uit `ONDODE_TYPES` zijn een gameplay-signaal.** Een
  speler moet een Brander van een Loper kunnen onderscheiden. T101's
  vervalkleur mag daarom in *waarde* variëren, niet in *tint*. Hetzelfde
  geldt voor `STADSARCHIEF_KLEURSET_TINT` (T86), dat al met `huidKleur`
  vermenigvuldigt en gewoon moet blijven werken.

**Schaal.** Extra meshes per ondode schalen met `effectiefMaxActief()` —
nu 14, met zone-bonus tot 18. Vijf extra meshes betekent tot 90 extra
draw calls in de piek (280 → ~370). Dat past binnen het budget uit
§10.3, maar het is de grootste draw-call-toename van de ronde en hoort
gemeten.

**Implementatieverslag T99 (uitgevoerd).** Vier nieuwe meshes per ondode
(niet vijf — de vod is een GEOMETRIE-vervanging, geen extra mesh), alle
via de bestaande `geo()`-cache dus automatisch `userData.gedeeld = true`:

- **Twee schouders** (`geo('schouder', ...)`, `BoxGeometry(0.14, 0.14,
  0.16)`), kind van de `romp`-groep (niet van de arm-pivot — schouders
  horen bij de romp en mogen niet met de arm meependelen), op lokale
  positie `(±0.19, 0.24, 0.01)`. Dicht de silhouet-overgang tussen romp
  (breedte 0.36) en arm (bevestigd op x = ±0,24).
- **Twee handen** (`geo('hand', ...)`, `BoxGeometry(0.08, 0.08, 0.08)`),
  SIBLING van `arm` binnen dezelfde pivot-`Group` (niet een kind van
  `arm` zelf) — `arm.scale` (dikte-/lengtevariatie) mag de handgrootte
  niet meeschalen. Positie `y = -armLengte` (de volle, per-instance
  armlengte onder de pivot), dus de hand volgt automatisch mee als
  `traits.armVerschil` de arm langer/korter maakt.
- **Gerafelde vod**: de oude `BoxGeometry(0.06, 0.32, 0.02)` (rechte
  rand) vervangen door `bouwGerafeldeVodGeometry()`, een handgeschreven
  `BufferGeometry` — expliciet **geen** `PlaneGeometry`, want de
  ticket-spec eist een écht gekartelde onderrand (5 "tanden",
  afwisselend op de basislijn en 5 cm dieper). Eén vlak (voorkant) met
  `side: THREE.DoubleSide` op het material i.p.v. een los achtervlak —
  op een lapje van 2 cm dik zie je het verschil toch niet, en dit
  halveert het driehoekstal van dit detail. `VOD_MATERIAAL` is nu een
  eigen gedeelde module-constante (zelfde patroon als `kernMateriaal`)
  in plaats van via `mat()`: de oude vod-kleur was al gedeeld (geen
  per-instance tint), maar `mat()`'s `extra`-parameter forceert altijd
  een VERSE instantie (bestaand contract, zie T104's toelichting elders
  in dit hoofdstuk) — `side: DoubleSide` via die route had het
  gedeeld-zijn dus juist gekost, precies het omgekeerde van de bedoeling.

**Geen van de vier nieuwe delen draagt ooit `userData.lichaamsdeel ===
'kop'`** — expliciet niet gezet, en `test-ondode-model.mjs`'s bestaande
generieke traverse-check (die AL het hele model doorloopt) ving dat al
generiek af; een nieuwe, naam-gebonden sectie (zie hieronder) maakt het
ook expliciet zoals de ticket-spec vraagt.

`test-ondode-model.mjs` uitgebreid met 5 checks: elk van de vijf
`ONDODE_TYPES` krijgt exact 2 schouders en 2 handen (met neutrale traits,
zodat het 'eenarmig'-profiel de telling niet toevallig verstoort), de vod
gebruikt de nieuwe gedeelde `vodGerafeld`-geometrie, geen van de nieuwe
delen draagt ooit een kop-markering, en `geoCache.size` blijft exact
gelijk over 50 spawn/kill-cycli (de drie nieuwe geometrieën blijven
precies 1 entry, ongeacht hoeveel ondoden ooit gespawned zijn). Bestaande
tests ongewijzigd groen: `test-ondode-model.mjs`'s hitbox-/headshot-
contract (24 checks, inclusief de al bestaande "geen enkel ander
mesh-deel draagt een lichaamsdeel-markering"-check), `test-resources.mjs`
(18 checks, incl. de 100-cycli-geometriegroei-band en de 25-golven-
meshtelling), en `test-visuele-basislijn.mjs` (65 checks — dit ticket
raakt alleen het ondode-model, niet de statische scene die de basislijn
meet, dus logischerwijs geen enkele verschuiving).

**Implementatieverslag T100 (uitgevoerd).** Eerst de fabriek die de
ticket-spec als niet-optionele stap 1 eiste: `maakOndodeMateriaal(kleur,
ruwheid = 0.85)` vervangt alle zeven inline
`new THREE.MeshStandardMaterial({ color: huidKleur, ... })`-constructies
in `maakOndodeModel()` (torso, twee schouders, bochel, buik, hoofd, arm,
hand — de laatste twee zijn T99's toevoegingen). `kernMateriaal` en
`oogMateriaal` gaan er bewust NIET doorheen: die hebben allebei al hun
eigen emissieve systeem (T89's Signaal-hiërarchie), en `VOD_MATERIAAL`
(T99) blijft ook ongemoeid — geen van drie is "huid".

**De fresnel-rim.** `onBeforeCompile` injecteert twee stukken in de
gecompileerde `MeshStandardMaterial`-shader: de uniform-declaraties ná
`#include <common>`, en de eigenlijke term ná `#include
<emissivemap_fragment>` — de plek waar three.js' eigen fragment-shader
`totalEmissiveRadiance` al vult, dus de natuurlijke aansluiting voor nóg
een emissieve bijdrage. De term zelf: `pow(1 - max(dot(normal,
normalize(vViewPosition)), 0), 3) * uRimKleur * uRimSterkte`, opgeteld bij
`totalEmissiveRadiance`. Vastgelegd (chunk-namen zijn geen publieke
three.js-API): chunk `<emissivemap_fragment>`, varying `vViewPosition`,
three@0.160.0.

**Eén gedeeld uniform-paar, niet één per materiaal.** `RIM_UNIFORMS =
{ kleur: {value:...}, sterkte: {value:...} }` staat op moduleniveau; elke
`onBeforeCompile`-aanroep wijst `shader.uniforms.uRimKleur`/`uRimSterkte`
naar DEZELFDE twee objecten (niet gekloond). Een toekomstige schrijf op
`RIM_UNIFORMS.sterkte.value` verandert dus in één keer de rim op alle
ondoden tegelijk — de infrastructuur die de ticket-spec vraagt ("zodat
hij mee kan bewegen met de eventgolven"), zonder dat dit ticket zelf al
bepaalt WANNEER dat gebeurt (`RIM_STERKTE_BASIS` is voor nu een vaste
waarde — zie de design-review na T101 verderop in deze sectie voor de
uiteindelijke waarde).

**De kleur.** `0x55e0b0`, een koel teal-groen, gekozen om zichtbaar af te
wijken van zowel het warme lamplicht (`0xffc06a`) als het koele maanlicht
(`0xc8ddff`) — gemeten (Euclidische RGB-afstand op een 0-1-schaal): 0,50
tot lamplicht, 0,32 tot maanlicht, allebei ruim boven de 0,3-drempel die
`test-rimlight.mjs` aanhoudt.

**Geen extra Light.** De rim is uitsluitend shaderwerk op het materiaal;
`scene.traverse()` telt nog steeds precies 28 lichten (1 hemisfeer + 27
point, invariant 2 uit §10.2 blijft intact).

`test-rimlight.mjs` (9 checks, nieuw) bevestigt: het lichtaantal, dat de
injectie UITSLUITEND op ondode-huidmaterialen zit (een steekproef van 239
wereldmaterialen via `wereld.traverse()` heeft 'm nergens, `kernMateriaal`/
`oogMateriaal`/`VOD_MATERIAAL` blijven ongemoeid), de kleurafstand tot
lamp/maanlicht, en — functioneel bewijs — dat `RIM_UNIFORMS.sterkte` op 0
versus uitvergroot een aantoonbaar ander beeld oplevert op hetzelfde
bevroren standpunt.

**Een test-valkuil, gevonden en meteen opgelost.** De eerste versie van de
injectie-check gebruikte `typeof materiaal.onBeforeCompile === 'function'`
— dat bleek voor ELK materiaal in de scene waar te zijn, ook materialen
die deze ticket nooit heeft aangeraakt: `THREE.Material.onBeforeCompile`
is standaard al een no-op-functie (three.js' eigen default), niet
`undefined`. De echte marker moest de INHOUD zijn:
`materiaal.onBeforeCompile.toString().includes('uRimSterkte')` — een
bronvorm-check, hetzelfde soort techniek als elders in deze testsuite
(bv. T94's `setTimeout`-afwezigheidscheck).

Bestaande tests ongewijzigd groen: `test-ondode-model.mjs` (29 checks),
`test-resources.mjs` (18 checks), `test-visuele-basislijn.mjs` (65
checks) — dit ticket raakt alleen het materiaal, niet de geometrie of de
statische scene.

**T101 gebouwd, beoordeeld, en teruggedraaid.** T101 is geïmplementeerd
zoals hierboven gespecificeerd — twee grijswaarde-vervaltermen (per-vertex
holte-gradient + per-pixel vlekkenruis) — en met volledige testdekking
groen gekregen (zie de sessiegeschiedenis voor de implementatiedetails en
een genuanceerde testvalkuil rond stale gameLoop-state in de metingen).

Bij de daaropvolgende visuele review bleek het effect echter niet de
juiste afweging op te leveren, en is het **teruggedraaid**:

- Op een sterkte die de type-kleuren (het echte gameplaysignaal) niet
  overstemt, was het effect in de praktijk vrijwel onwaarneembaar — pas
  bij een sterkte 3-6× hoger dan wat de §10.10-invariant toestond, werd
  het duidelijk zichtbaar in een test-render.
- Belangrijker: het effect paste niet bij de kunststijl. Het spel is
  bewust vlak, low-poly en textuurloos (CLAUDE.md: "geen textures/
  modellen, alleen simpele geometrieën") — cavity/grime-shading is een
  realismecue die bij die stijl geen natuurlijke plek heeft, en de kosten
  (een tweede shader-injectie, een vertexColors-attribuut per gedeelde
  geo()-vorm, extra testoppervlak) wogen niet op tegen een effect dat
  niemand tijdens het spelen zou opmerken.

**De rimlight (T100) bleef wél overeind, maar iets te sterk.** Bij
dezelfde review gold het omgekeerde oordeel: de rim lost een reëel,
eerder gedocumenteerd probleem op (silhouetherkenning in donkere kamers)
tegen verwaarloosbare kosten (geen extra Light), en is een gangbare
techniek in dit genre. `RIM_STERKTE_BASIS` ging wel omlaag, van 0,6 naar
**0,12** (20% van de oorspronkelijke waarde) — merkbaar subtieler, zonder
de silhouetscheiding zelf te verliezen.

**Wat er is teruggedraaid.** `voegVervalKleurToe()`, `VERVAL_HOLTE_STERKTE`,
`VERVAL_VLEK_STERKTE`, de `<color_fragment>`-shaderinjectie en
`vertexColors: true` in `maakOndodeMateriaal()` zijn verwijderd; de zeven
`geo()`-aanroepen (torso/schouder/bochel/buik/hoofd/arm/hand) bouwen hun
geometrie weer rechtstreeks. De bijbehorende testdekking (de gerenderde-
kleurafstand- en bronvorm-checks in `test-ondode-model.mjs`, en de
aanvullende sectie in `test-stadsarchief.mjs`) is met de code mee
verwijderd. `RIM_UNIFORMS`/`maakOndodeMateriaal()` zelf (T100) blijven
ongewijzigd van vorm, alleen `RIM_STERKTE_BASIS` is aangepast.

Regressie na het terugdraaien: `test-ondode-model.mjs` weer op 29 checks,
`test-stadsarchief.mjs` weer op 40, `test-rimlight.mjs` ongewijzigd op 9
(die test leest `RIM_STERKTE_BASIS` dynamisch, dus de waardewijziging
raakt 'm niet).

<details>
<summary>Oorspronkelijk implementatieverslag T101 (historisch, de code hieronder bestaat niet meer)</summary>

Twee vervaltermen, allebei **grijswaarde-vermenigvuldigers** (nooit een tint) —
de harde invariant uit §10.10 hierboven.

**1. Per-vertex holte-gradient.** `voegVervalKleurToe(geometry)` leest de
al-berekende `normal`-attribute en schrijft een `color`-attribute
(R=G=B) via `holte = (1 - normal.y) / 2` (0 voor omhoogwijzende
vlakken, 1 voor omlaagwijzende) en `factor = 1 - VERVAL_HOLTE_STERKTE *
holte` (`VERVAL_HOLTE_STERKTE = 0,25`). Onderkanten van dozen (buik
onder de bochel, onderkant van de armen) worden zo een kwart donkerder
dan bovenkanten — een goedkope benadering van cavity/grime-schaduw
zonder een echte AO-pass. Gewrapt om de bestaande geometrie-constructors
in alle zeven huid-`geo()`-sleutels (torso, schouder, bochel, buik,
hoofd, arm, hand); omdat `geo()` per sleutel al deelt, wordt dit
**precies één keer per gedeelde vorm** berekend, nooit per ondode-
instantie. `maakOndodeMateriaal()` kreeg `vertexColors: true`.

**2. Procedurele vlekkenruis.** Een tweede `onBeforeCompile`-injectie in
dezelfde fabriek als T100's rimlight, ditmaal in `<color_fragment>` (ná
three.js' eigen `vertexcolor_fragment`-toepassing, dus stapelt bovenop
de holte-gradient): een 3D-sinusruis op `vViewPosition * 12,0`,
`vlek = 1 - VERVAL_VLEK_STERKTE * (0,5 + 0,5 * sin(...) * sin(...))`
(`VERVAL_VLEK_STERKTE = 0,12`), toegepast als `diffuseColor.rgb *=
vlek`.

**Een misgreep, gevonden via een shader-compile-fout.** De eerste versie
gebruikte `vUv` als ruis-input. `MeshStandardMaterial` declareert `vUv`
echter alleen als er daadwerkelijk een texture-map-feature actief is
(`#ifdef`-bewaakte chunk) — deze huid-materialen hebben geen `map`, dus
compileren zonder `vUv`, en de eerste poging crashte met "'vUv' :
undeclared identifier" (zichtbaar via de load-check console-error-
listener). Opgelost door `vViewPosition` te hergebruiken — al bewezen
altijd beschikbaar via T100's rim-term — met het geaccepteerde neveneffect
dat het vlekkenpatroon licht "zwemt" als de camera om het model beweegt
(bij deze lage sterkte niet storend).

**Testdekking: een tweede, hardnekkiger valkuil dan de shadercode zelf.**
De ticket-spec eist een RENDER-niveau bewijs dat twee `ONDODE_TYPES` op
de gerenderde pixel nog meetbaar in kleur verschillen (het type-signaal,
bv. Brander vs. Loper, mag niet wegvallen tegen de nieuwe grijswaarde-
termen). Een eerste, brede crop rond "waar het lichaam ongeveer staat"
mat twee bijna identieke kleuren — geen echte regressie, maar drie
gestapelde meetfouten in de testopzet zelf, alle drie voortkomend uit
hetzelfde patroon dat T88's `openVoorVisueleMeting()` al documenteerde
(cosmetische systemen die alleen in de `spelActief`-gated zone van
`gameLoop` vervallen, draaien hier nooit omdat dit testbestand bewust
géén `simuleerPointerLock` gebruikt):

1. **`#startscherm` bleef zichtbaar** — een screenshot ving de DOM-
   overlay (titel/instructietekst op een donkere achtergrond), niet de
   3D-canvas erachter. Beide types maten daardoor dezelfde
   overlay-achtergrond.
2. **`#gameOverScherm` bleek soms actief** — de bestaande mik-sectie
   verderop in hetzelfde bestand spawnt herhaaldelijk een ondode vlak
   voor de speler; in de reële wall-clock tijd tussen losse
   `page.evaluate()`-round-trips bleef `gameLoop` intussen echt draaien,
   en die ondode viel de speler soms daadwerkelijk aan. Cumulatief kon dat
   de speler doden en het game-over-scherm tonen, met dezelfde
   contaminatie als (1).
3. **Bevroren, wit-oplichtende "lijken" stapelden zich op** — elke
   `doodOndode()`-aanroep (ook de opruim-aanroepen tussen testsecties)
   zet een korte witte kill-flits (T95, `mat.emissive`/
   `emissiveIntensity`) en laat de ondode omvallen via `stervenden`, en
   dat vervalt normaal élke frame in `updateStervenden(dt)` — óók
   gated achter `spelActief`. Zonder die vervalstap bleven **tientallen**
   bevroren, wit-emissieve lijken op hun oude posities staan, inclusief
   bovenop de eigen testpositie, en dat domineerde de crop tot een
   vrijwel uniform wit vlak voor beide types.

Root cause dus niet het shadereffect, maar drie stuks niet-opgeruimde
testtoestand. Opgelost door in de meethelper expliciet: `#startscherm`
en `#gameOverScherm` te verbergen, `spelerStaat.hp` te herstellen,
`actieveEffecten` leeg te maken, en — de doorslaggevende regel —
`d.updateStervenden(999)` aan te roepen: één reuze-`dt` rondt de hele
val-/doofanimatie in één klap af en ruimt elk lijk meteen op, in plaats
van te wachten op een vervaltimer die in dit testbestand nooit vanzelf
loopt. Camera-aiming hergebruikt de al bewezen `mikCode()`-aanpak (vaste
afstand z=-3, `scale.setScalar(1)` om schaalverschil tussen types uit
te sluiten, yaw/pitch exact op de torso `(0, 1,1)` gemikt); een gekloonde
lamp (geen losse `THREE`-referentie nodig — de debug-hook exposeert er
geen) dichtbij en fel genoeg gezet zodat de diffuse albedo niet wegvalt
tegen de donkere, warmgetinte hoek van de kaart waar toevallig getest
wordt.

`test-ondode-model.mjs` uitgebreid met 2 checks: een gerenderde
kleurafstand (Euclidisch, RGB 0-255) tussen 'normaal' en 'sjouwer' op
dezelfde crop >5 (na de fix ruim daarboven), en een bronvorm-check dat
`maakOndodeMateriaal` de vlekterm als `diffuseColor.rgb *= vlek`
toepast (scalair, nooit een kleur). `test-stadsarchief.mjs` kreeg
dezelfde meetopzet als aanvullende sectie: bevestigt dat
`STADSARCHIEF_KLEURSET_TINT` (T86) ook ná deze twee nieuwe shaderlagen
nog een meetbaar verschil geeft op de gerenderde pixel, niet alleen op
`material.color` (dat laatste was al gedekt door een bestaande,
exacte JS-niveau check die dit ticket ongemoeid liet).

Bestaande tests ongewijzigd groen (op dat moment): `test-ondode-model.mjs`
(29 → 31 checks), `test-rimlight.mjs` (9 checks), `test-resources.mjs` (18
checks), `test-stadsarchief.mjs` (40 → 41 checks), `test-visuele-
basislijn.mjs` (65 checks).

</details>

### 10.11 Beslissing 86 — Van roughnessMap-only naar een echte oppervlakteset (T106, T107, T108)

**Wat er nu is, en waarom het niet werkt.** `bouwCanvasTextuur()`
genereert drie 128×128 canvas-texturen (steen-ruis, houtnerf, geborsteld
metaal) met `RepeatWrapping` en `repeat.set(4, 4)`. Ze worden
**uitsluitend als `roughnessMap`** toegepast, nooit als `map` — een
bewuste keuze uit §7.3, zodat de basiskleur van elk oppervlak exact
hetzelfde blijft.

Dat was destijds de juiste voorzichtige stap. Het gevolg is alleen dat
het effect vrijwel onzichtbaar is: een `roughnessMap` rond wit
(`#e8e8e8` met ruis tussen 205 en 250) op een `MeshStandardMaterial` in
een scene met veel zwakke puntlichten en nauwelijks specular geeft bijna
geen signaal. `renderer.info.memory.textures` telt 16 texturen, waarvan
de meeste UI en naambordjes zijn: er zijn drie oppervlaktetexturen in het
hele spel en die zie je niet.

Daar komt een tweede probleem bovenop: `repeat.set(4, 4)` staat op de
**gedeelde textuur**, dus een muur van 9 m breed en een kist van 40 cm
krijgen dezelfde textuurschaal. De kist ziet er korreliger uit dan de
muur. Het patroon draagt geen maat.

**De beslissing.** Drie tickets, strikt in deze volgorde:

**T106 — Wereldschaal-UV's (fundament).** De `repeat` verhuist van de
gedeelde textuur naar het `uv`-attribuut van de geometrie, per vlak
geschaald naar de wereldafmetingen. Voor een `BoxGeometry` betekent dat
zes vlakken met elk hun eigen schaal.

**Dit ticket levert in isolatie bijna geen zichtbaar effect op** — een
`roughnessMap` rond wit stretch je nauwelijks merkbaar. Het staat er
omdat T107 zonder dit een prachtige baksteentextuur oplevert die op elk
vlak een andere maat heeft, en dat is erger dan geen textuur. Dat hoort
er eerlijk bij: dit is een fundament-ticket, geen verbetering.

Triplanar mapping in de shader is het alternatief en is beter (het werkt
ook op geroteerde blokken en heeft geen UV's nodig), maar het kost drie
texture-samples per map per fragment in plaats van één. Op een
fragment-bound scene is dat de verkeerde ruil — **UV-herschaling is de
gekozen route.**

**T107 — De echte texturenset.** `CANVAS_TEXTUUR_TEKENAARS` gaat van drie
ruispatronen naar een set tekenfuncties op 512×512: baksteenverband met
per-steen kleurvariatie en donkere voegen, planken met richting, naden en
knoesten, pleisterwerk met vlekken, klinkers in keperverband. Elke
tekenaar levert **drie** maps: albedo (`map`), ruwheid (`roughnessMap`,
wat er nu al is) en hoogte (bron voor T108).

Dit is de logische voortzetting van de §7.3-beslissing, niet een nieuwe
uitzondering: "geen textures" leest daar al als "geen extern geladen
bestanden, geen derde-partij-frameworks", en deze texturen zijn 100%
runtime met de 2D Canvas-API getekend.

**Twee risico's die dit ticket definiëren.** Ten eerste stijl:
fotorealistische baksteen op blokgeometrie ziet er *slechter* uit dan
effen kleur — dan zie je pas echt dat het dozen zijn. De texturen moeten
gestileerd blijven, in lijn met het "geverfde maquette"-DNA. Ten tweede
laadtijd: 512×512 met duizenden canvas-operaties per tekenaar kan
tientallen milliseconden per textuur kosten, en er zijn er acht. Dat moet
gemeten worden en zo nodig over frames verspreid.

**T108 — Normal maps uit dezelfde hoogtekaarten.** Een Sobel-achtige
gradient over de hoogtekaart van T107, opgeslagen als RGB, als
`normalMap` met een instelbare `normalScale`.

**Dit is de duurste per-fragment-richting van de ronde** en hij schaalt
met het aantal lichten: normal mapping doet per licht extra werk, en er
zijn er 27. Als de fillrate-aanname uit §10.3 klopt, is dit de eerste
richting die op zwakke hardware teruggedraaid moet worden — vandaar de
lichte uitvoering (alleen baksteen en hout, lage `normalScale`, alleen
grote vlakken) als startpunt.

Aandachtspunt: zonder tangents op de geometrie valt Three.js terug op een
afgeleide berekening in de shader, wat op grote vlakke
`PlaneGeometry`-vlakken artefacten kan geven.

**Implementatieverslag T106 (uitgevoerd).** Eén universele functie,
`herschaalUVNaarWereldschaal(geometrie, texelsPerMeter = 1)`, i.p.v. de
BoxGeometry-per-face-UV-layout te reverse-engineeren. De oorspronkelijke
overweging ("voor een BoxGeometry betekent dat zes vlakken met elk hun
eigen schaal") ging uit van het herschalen van de BESTAANDE UV-waarden per
face — maar die aanpak botst met T102/T103: elke muur krijgt daar een
ANDER segmentaantal per as (`muurSegmenten()`), dus er is geen vaste
vertex-volgorde/-telling per face om op te bouwen zonder de exacte
BoxGeometry-broncode te dupliceren.

**De gekozen route: UV afleiden uit lokale positie + normal, niet uit de
bestaande UV.** Voor elke vertex bepaalt de functie welke as de normal het
sterkst op wijst (die as valt af) en zet `uv = (de twee overige lokale
coördinaten) × texelsPerMeter`. Dat werkt ONVERANDERD voor een
`BoxGeometry` (elk van de 6 vlakken, ongeacht segmentaantal) ÉN voor een
platte `PlaneGeometry` (lokaal altijd normal `(0,0,1)`, dus simpelweg
`u=x, v=y`) — één functie voor zowel `blok()` als `vlak()`, ongeacht
wereld-rotatie (lokale coördinaten zijn rotatie-onafhankelijk) of
segmentaantal. Bewust GEEN triplanar mapping in de shader (het genoemde
alternatief) — dat kost drie texture-samples per map per fragment i.p.v.
één, de verkeerde ruil op deze fragment-bound scene (§10.3).

**Scope: alleen waar het ertoe doet.** `blok()` (gebruikt door
`bouwSchuurtje()` e.a. voor NIET-getextureerd meubilair, altijd via
`mat()`) kreeg BEWUST geen aanroep — er is daar nooit een `map`/
`roughnessMap` om de UV's voor te herschalen, dus dat zou pure verspilling
zijn. `vlak()` kreeg de aanroep wél onvoorwaardelijk (elke `vlak()`-vloer/
-plafond kan later alsnog naar `matFamilie()` worden overgezet, zie de
valkuil hieronder), plus de losstaande `matFamilie('steen', ...)`-
constructies die niet via `blok()`/`vlak()` lopen: de complete kelder
(vloer, plafond, perimeter-muren, trap, koker-dak/-wanden/-sluitpanelen)
en de binnenplaats-klinkersvloer. Deur-/kist-/plank-`matFamilie('hout',
...)`-aanroepen zijn BEWUST buiten scope gehouden (kleine objecten, het
"kist van 40cm"-schaalprobleem uit de probleemstelling is daar veel
kleiner dan bij een muur van 9m) — een kandidaat voor een latere ronde.

`bouwCanvasTextuur()` verloor zijn vaste `.repeat.set(4, 4)` (nu default
`(1,1)`, `RepeatWrapping` blijft aan zodat de — nu wereldschaal-grote —
UV-waarden vanzelf herhalen). Zoals voorspeld: nul zichtbaar/meetbaar
effect op zichzelf (geen enkele helderheids-/driehoekscheck verschoof) —
de roughnessMap-teksturen zijn nog steeds bijna-wit-met-ruis, en zonder
T107's albedo `map` is er niets dat de herschaalde UV's daadwerkelijk
zichtbaar maakt. `test-wereldschaal-uv.mjs` (4 checks, nieuw) bevestigt:
een echte getextureerde vloer heeft een UV-bereik dat overeenkomt met zijn
wereldafmeting (niet meer vast 0..1), de kelder-vloer se UV komt exact
overeen met `lokale positie × TEXELS_PER_METER`, en de roughnessMap van
een `matFamilie()`-materiaal heeft geen vaste repeat meer.

**Implementatieverslag T107 (uitgevoerd, MET een bewuste scope-reductie).**
Drie van de vier genoemde patronen: baksteenverband (`steen`), planken met
nerf/knoesten (`hout`), en klinkers in een VEREENVOUDIGD keperverband
(`natSteen` — een grid van afwisselend horizontaal/verticaal
georiënteerde straatsteentjes, geen echt interlocking patroon, maar
visueel wel als "keperverband" leesbaar op deze schaal). "Pleisterwerk"
is NIET geïmplementeerd: geen van de vijf bestaande `MATERIAAL_FAMILIES`
komt daar eenduidig mee overeen (geen `pleister`-familie bestaat), en het
zou een nieuwe familie hebben vereist zonder een duidelijke aanroeper —
een kandidaat voor een latere ronde zodra zo'n aanroeper bestaat. `metaal`
is ONGEWIJZIGD gelaten (blijft zijn oude roughness-only pad) — de
ticket-spec noemt alleen baksteen/planken/pleisterwerk/klinkers, geen
metaalupgrade.

**Grijswaarde, net als T101/T103/T104.** Elke tekenaar (`steen`/`hout`/
`natSteen`) kreeg een tweede parameter (`basisWit`) en tekent uitsluitend
`rgb(g,g,g)` — nooit een eigen hue. Dezelfde tekenfunctie wordt TWEE keer
gerenderd door de nieuwe `bouwCanvasTextuurPaar()`: één keer met
`T107_ALBEDO_BASIS=232` (voor `map`) en één keer met
`T107_RUWHEID_BASIS=224` (voor `roughnessMap`, dicht bij de
oorspronkelijke "bijna wit"-conventie van vóór dit ticket). De
BASISKLEUR komt nog steeds van `MATERIAAL_FAMILIES`/de meegegeven
`kleur` (§7.3's garantie) — nu via `color × albedoMap` i.p.v. alleen
`color`, maar zonder dat de map zelf ooit een hue bijdraagt.
`test-texturenset.mjs` bevestigt dit met een directe pixelinspectie (0
niet-grijze pixels over drie 64×64-steekproeven).

**Twee texturen per familie, niet één hergebruikt voor beide rollen.**
`map` en `roughnessMap` zijn twee VOLLEDIG APARTE `CanvasTexture`-objecten
(elk hun eigen canvas, met een ander `basisWit`) — nooit dezelfde texture
voor beide toegepast. De albedo-map krijgt expliciet
`colorSpace = THREE.SRGBColorSpace` (een kleurmap, moet door de sRGB-
pijplijn van `renderer.outputColorSpace`); de roughnessMap blijft op zijn
lineaire default (een datamap, geen kleur) — een detail dat zonder
aandacht een net-niet-goede albedo-helderheid had opgeleverd.

**Stijl- en laadtijd-risico's, beide gecontroleerd.** De patronen blijven
laag-contrast en simpel getekend (rechte rijen/rechthoeken, geen
gradients, geen fotorealistische ruis) — in lijn met het "geverfde
maquette"-DNA, niet fotorealistisch. Laadtijd, rechtstreeks gemeten: alle
drie de texturenparen (512×512, albedo+roughness, dus 6 canvassen) samen
bouwen in **~6ms** — ruim onder de "tientallen milliseconden per
textuur"-zorg uit de probleemstelling (die zorg gold voor acht tekenaars;
deze ronde bouwt er drie, en zelfs die drie zijn met simpele
rechthoek-/lijntekenoperaties goedkoper dan de zorg vooronderstelde).

**Helderheid verschoof wél degelijk, en terecht.** Een albedo-map met
duidelijk donkerdere voeg-/naadlijnen (tot -95 t.o.v. het steenoppervlak
zelf) trekt het gemiddelde omlaag t.o.v. de oude situatie (geen `map`,
dus effectief altijd factor 1) — precies het bedoelde, zichtbare effect
van "een echte textuur" i.p.v. "roughness-only". Twee zones met veel
beeldvullend getextureerd oppervlak schoven het hardst: binnenplaats
(klinkersvloer vult het beeld, -12%) en kelder (steen rondom, vloer tot
plafond, -10%); twee andere zones schoven een fractie mee via zichtbare
spillover door een deuropening naar een naburige getextureerde ruimte
(woonkamer -2,2%, bijkeuken -2,3% mediaan). `test-visuele-basislijn.mjs`'s
`gemiddelde`/`mediaan`-waarden voor die vier zones zijn bijgewerkt; de
overige vier bleven ruim binnen de 2%-band.

`test-texturenset.mjs` (12 checks, nieuw) bevestigt verder: `steen`/
`hout`/`natSteen` krijgen beide maps, `metaal`/`tegel` blijven op hun oude
pad, `map`/`roughnessMap` zijn aantoonbaar twee aparte objecten, de
colorSpace-instelling klopt voor beide, en het cache-gedrag is correct
(twee `matFamilie('steen', ...)`-aanroepen met verschillende kleuren
delen dezelfde textures maar behouden elk hun eigen `material.color`).

**Vervolgronde: klinkerrealisme (op verzoek, na visuele beoordeling).** De
klinkervloer op de binnenplaats las als geborsteld metaal. Vier oorzaken,
alle vier aangepakt.

*1. De roughnessMap stond OMGEKEERD — een echte fout, niet een
smaakkwestie.* Three.js past een roughnessMap vermenigvuldigend toe
(`roughness *= texel.g`), dus donker in die kaart betekent LAGERE ruwheid,
oftewel glanzender. `bouwCanvasTextuurPaar()` rende dezelfde tekenaar twee
keer, waardoor de voegen in beide kaarten donker waren — en de voegen dus
het glanzendst werden. Bij `natSteen` (basisruwheid 0,32) kwam de voeg op
~0,19 uit tegen ~0,29 voor het steenvlak: een raster van donkere,
spiegelende naden tussen lichtere vlakken. Dat is precies de visuele
handtekening van plaatmetaal, en fysiek het omgekeerde van de werkelijkheid
(voegspecie is dof en poreus, de klinker glad). De roughnessMap wordt nu
AFGELEID uit de albedo-pixels, geïnverteerd rond `T107_RUWHEID_BASIS`. Dat
loste meteen een tweede, niet eerder opgemerkte fout op: de tekenaars
gebruiken willekeur, dus twee losse renders leverden twee NIET-
corresponderende patronen op (de tintvariatie in de albedo hoorde bij
andere stenen dan die in de roughnessMap). Eén tekenronde in plaats van
twee scheelt bovendien bouwtijd.

*2. `metalness: 0,12` op natSteen.* Steen is nooit metallic. In de metallic
workflow geldt diffuus = albedo x (1 - metalness), dus die 0,12 haalde 12%
van de diffuse respons weg en stopte 'm in een getinte speculaire lob —
letterlijk "een beetje metaal maken". Nu 0. Dit is meteen de reden dat de
binnenplaats meetbaar lichter werd (zie de basislijn-toelichting in
`test-visuele-basislijn.mjs`): dat diffuse deel komt overal terug.

*3. Basisruwheid 0,32 was te glad voor een heel vlak.* Nu 0,45. De natte
glans hoort PLAATSELIJK te zijn, en dat was al geregeld: de plassen staan
apart op `roughness: 0,07`. Die dragen het natte accent nu alleen.

*4. Het patroon zelf.* Het oude "keperverband" was er geen: het legde één
steen midden in een cel met lege ruimte eromheen. Nu blokverband
(mandjesverband) — twee stenen per cel van 21x21 cm, om en om liggend en
staand. Bewust dit verband: **echt keperverband heeft een schuin
translatierooster en sluit dus niet naadloos aan op een vierkante,
herhalende textuurtegel**, terwijl blokverband dat per constructie wel doet
(periode 2 cellen; `test-texturenset.mjs` legt de even-cellen-eis vast).
Verder: stenen op hun echte maat (21x10,5 cm) via een tegel van
`KLINKER_TEGEL_METERS` = 4,2 m in plaats van de globale 1 meter — over de
binnenplaats van 17x16 m herhaalt het patroon nu ~16 keer in plaats van
~270 keer. Daar bovenop een grootschalige slijtagelaag (in alle negen
wrap-posities getekend, dus naadloos) die de resterende herhaling breekt,
plus afgesleten hoeken, scheefstand en af en toe een verweerde steen.

**Determinisme, alsnog.** De tekenaars draaiden op `Math.random()`, dus elke
laadbeurt gaf een andere textuur. Dat kwam pas boven water toen de
helderheidsmeting tussen runs bleef schommelen (28,14 -> 27,3 -> ...) en de
2%-vangrail daardoor niet stabiel te zetten was. Zelfde keuze als T104
(§10.12): variatie mag, willekeur per laadbeurt niet — een speler hoort het
pand niet elke sessie anders te zien. Elke tekenaar krijgt nu een vaste
stroom (mulberry32, gezaaid vanuit de patroonnaam). Na die wijziging: 27,29
in twee opeenvolgende runs.

**De vangrail stuurde een inhoudelijke keuze.** De inversiesterkte
(`T107_RUWHEID_INVERSIE`) is niet gekozen maar GEMETEN. Bij 0,25 en 0,4
zakte de kelder — die op `steen` draait en waar de wrongly-glossy voegen
meetbaar aan de helderheid bijdroegen — zo ver weg dat zijn eigen
kleurgrading niet langer luminantie-neutraal mat: het gat
gegradeerd/ongegradeerd liep op tot 0,79 tegen een toegestane 0,5. Die
grading heeft een ADDITIEVE groen-lift, en hoe donkerder de zone, hoe
zwaarder die relatief doortelt. Bij 0,12 blijft het gat op 0,29 en klopt
de fysieke richting nog steeds. Belangrijk om vast te leggen: de vangrail
wees hier niet op een kapotte grading maar op een te donker geworden zone,
en de door de gebruiker zelf afgestelde kelder-grading is expres NIET
aangeraakt.

**Pleisterwerk op de atelier-muren: geprobeerd, teruggedraaid (grondslag
blijft liggen).** De vierde tekenaar uit de oorspronkelijke T107-opzet
bestaat als volwaardige `pleister`-familie (wolkige ondergrond,
afbladderende plekken met een donkerdere onderlaag, haarscheuren — alles
in wrap-posities getekend, want pleister heeft geen eigen periodiciteit
die een naad zou kunnen maskeren). Op verzoek is dit even ECHT op de 9
ateliermuur-segmenten toegepast (`BAKSTEEN` -> een nieuwe
`ATELIER_PLEISTER`-kleur), via een tijdelijke uitbreiding van
`blok()`/`bouwMuur()` met een optionele `familie`-parameter — de eerste
echte aanroeper van matFamilie() voor muren, precies het "kandidaat voor
een latere ronde" waar T106/T107 dit bewust voor openlieten. Na beoordeling
op beeld beviel het resultaat niet, en is de toepassing volledig
teruggedraaid: de muren zijn weer `BAKSTEEN`, `blok()`/`bouwMuur()` hebben
hun oude signatuur terug (geen `familie`-parameter meer — die diende alleen
deze ene, nu ongedaan gemaakte toepassing), en de helderheidsbasislijn
staat weer op de waarden van vóór de poging. De `pleister`-familie zelf
blijft ongewijzigd bestaan als ongebruikte grondslag (`test-texturenset.mjs`
bewaakt weer expliciet dat 'ie nergens wordt toegepast) — mocht een latere
ronde 'm alsnog ergens willen inzetten, dan hoeft alleen de toepassing
teruggebouwd te worden, niet de tekenaar zelf.

**Implementatieverslag T108 (uitgevoerd, MET een bewuste scope-
reductie).** Normal maps uit dezelfde hoogtebron als T107's
ruwheidsinversie: een donkere albedo-pixel (voeg, naad) is fysiek een
verdieping, dus dezelfde grijswaarde die al voor de ruwheid diende, dient
hier ook als hoogtekaart voor een 3x3-Sobel-gradient — geen aparte
hoogtetekenaar nodig, en de drie kaarten (albedo/ruwheid/normaal)
corresponderen daardoor gegarandeerd.

**"Alleen grote vlakken" is hier een PER-MESH-eis, niet een per-familie-
eis — en dat is een echt architecturaal probleem.** `matFamilie()` cachet
per (naam, kleur): een normalMap op de familie zelf toevoegen zou 'm
automatisch ook op elke kleine 'steen'/'hout'-aanroep zetten (deurpanelen,
kratten, kelder-treden), precies wat de beslissing vooraf uitsluit. De
oplossing hergebruikt het bestaande "twin"-WeakMap-patroon van
`matMetVertexKleur()`: `matFamilieReliëf(naam, kleur)` cachet een
GEKLOONDE tweeling per gedeeld basismateriaal (nooit het origineel
muteren) met `normalMap`/`normalScale` erop, en alleen de aanroepers die
dat EXPLICIET opvragen krijgen 'm. Toegepast op: gang-vloer, kelder-vloer
(x2, incl. kelderoost), kelderwanden (`kelderWand()`/`kokerWand()`), en de
vlonder — een bewust kleinere set dan "de complete kelder rondom" uit
T107's eerdere brightness-verslag (kelder-treden, sluitpaneel en koker-dak
blijven op de kale, ongetextureerde basis; kandidaat voor een latere
ronde). `NORMAAL_FAMILIES = new Set(['steen', 'hout'])` — 'pleister' (net
toegevoegd voor het atelier) krijgt dus BEWUST geen normal map deze ronde,
exact zoals de beslissing alleen baksteen/hout noemt.

Laadtijd was het eerst gemeten risico: de naïeve Sobel-implementatie
(closure-aanroep + modulo per texel) kostte ~100ms voor twee 512x512-
kaarten — zie de optimalisatie hierboven bij T109 (dezelfde functie,
gevonden tijdens hetzelfde debug-moment). Na de optimalisatie: ~33ms.
`normalScale` staat op 0,5 ("laag" gehouden, zoals voorgeschreven).

Geen enkele helderigheids-/kleurcheck in `test-visuele-basislijn.mjs`
verschoof (65/65 groen, geen enkele waarde bijgewerkt) — een normalMap
herverdeelt licht over het oppervlak (richtingsgevoelig), maar
verandert de GEMIDDELDE gereflecteerde energie over een vlak vlak niet
genoeg om de 2%-band te raken; precies zoals verwacht voor een subtiel
reliëf-effect. `test-normal-maps.mjs` (15 checks, nieuw) bevestigt: de
reliëf-materialen krijgen een normalMap, de gedeelde basismaterialen
blijven ongemoeid, de vier niet-scope-families (`tegel`/`metaal`/
`natSteen`/`pleister`) krijgen expliciet GEEN normalMap via
`matFamilieReliëf()`, de kaart is subtiel (gemiddeld blauw-kanaal > 200/
255) maar niet vlak, en de bouwtijd blijft ruim onder 100ms.

**Vals alarm tijdens de regressiesweep: `test-camerabeweging.mjs`.** Eén
volledige `run-all.mjs`-sweep na T107 gaf 72/73 groen met precies deze
test als enige FAIL (geen schade over 20 schoten, terwijl dezelfde test
vlak vóór T106/T107 nog gewoon groen was). Uitgebreid geïsoleerd
onderzocht: een losse probe die exact dezelfde 20-schoten-lus van de
falende sectie repliceert (inclusief de echte rAF-warmup die bobFase
aantoonbaar actief maakt) haalde wél gewoon raak op elk schot. Bij
herhaald losstaand draaien van het testbestand bleek het bovendien
herhaaldelijk vast te lopen op `requestAnimationFrame`-wachten in een
HELE ANDERE, aan T106/T107 ongerelateerde sectie (wapen-sway, sectie 6 —
geen materiaal/UV-code in de buurt). Dat bevestigt wat de eigen
testcommentaren al waarschuwen (§10.9-sectie 8: "onvoorspelbaar traag/
variabel in deze headless omgeving"): dit is omgevingsflakiness in de
sandbox rond rAF-timing, geen echte regressie door T106/T107 — T106/T107
raken `updateSpeler()`, de camera, `bobFase` of ondode-code helemaal niet
aan, alleen muur-/vloermaterialen en hun UV's. Een volledige herhaalde
`run-all.mjs`-sweep erna kwam uit op 73/73 groen, inclusief deze test.

**Fase 5 (T106+T107) afgerond, T108 buiten scope (niet gevraagd).**
Volledige regressiesuite groen; zie de eindsamenvatting onderaan dit
hoofdstuk voor het exacte totaal.

### 10.12 Beslissing 87 — Variatie zonder cachebreuk (T104, T105)

**Het probleem.** Er is geen enkele plek waar twee bakstenen van elkaar
verschillen. Elke kist is exact dezelfde kleur als elke andere kist. Dat
"copy-paste"-gevoel is het meest verraderlijke kenmerk van procedureel
gebouwde werelden, want het valt pas op als je het benoemt.

**De beslissing (T104).** Een per-mesh kleurtint als vertexkleur, die met
de materiaalkleur vermenigvuldigt. Zo blijft het materiaal gedeeld en
gecachet, en varieert toch elk object.

**De cruciale nuance.** De ondode-modellen doen dit al conceptueel met
`const tint = 0.85 + Math.random() * 0.3` — maar die krijgen er wél een
**nieuw materiaal per instantie** voor. Dat is precies wat hier vermeden
moet worden, en de meting bevestigt waarom: er zijn **285 unieke
materialen** in een lege scene tegenover een `mat()`-cache die veel meer
zou moeten delen. Veel call-sites geven `extra` mee en krijgen daarmee
per definitie een uncached instantie (het cache-contract van `mat()`:
niet-lege `extra` ⇒ altijd een verse instantie).

Vertexkleur-variatie maakt dus niet alleen het beeld rijker, het maakt
méér materiaaldeling mogelijk. T104 komt daarom ná T103, dat de
`vertexColors`-infrastructuur al heeft neergezet.

**Twee eisen.** De tint moet **deterministisch** zijn (een hash van de
positie, niet `Math.random()`), anders is hij elke sessie anders en
worden tests instabiel. En het bereik blijft klein (±10%, zoals bij de
ondoden): te veel variatie maakt de scene rommelig.

**T105 — Afgeschuinde randen.** Elke rand in dit spel is oneindig scherp,
en een oneindig scherpe rand vangt geen licht. In het echt is elke rand
een beetje rond, en die millimeter licht langs de rand is wat een object
aanwezig maakt.

Een `blokAfgeschuind`-variant naast `blok()`/`meubelBox()`, met een
afschuining van 1-2 cm, gecachet in dezelfde stijl als `geo()`. Wel op
tafels, kisten, deuren en werkbanken; **niet op `bouwMuur()`** — muren
hebben geen zichtbare vrije rand en het zou het driehoekstal onnodig
verdrievoudigen.

De collision-geometrie (`obstakels`) blijft rechthoekig. Bij 1-2 cm is
de afwijking onmerkbaar; bij meer zou je net naast een hoek vast lijken
te lopen.

**Implementatieverslag T104 (uitgevoerd).** Scope bewust beperkt tot
`meubelBox()` — de functie achter `bouwKratten()`/`bouwVat()` en zes
andere herhaalde meubelplaatsingen, en daarmee letterlijk de "elke kist
is dezelfde kleur"-klacht uit de probleemstelling. Muren/vloeren/
plafonds (T103) zijn NIET meegenomen: die zijn niet werkelijk "gekopieerd"
op de manier die deze ticket bedoelt (elke muur heeft al een eigen,
onderscheidende afmeting/positie), dus de "copy-paste"-klacht is daar
minder van toepassing, en het zou vereist hebben dat `blok()` de
wereldpositie van de muur kent — die wordt pas NA de `blok()`-aanroep
gezet (`muur.position.set(...)` gebeurt in `bouwMuur()`, niet in `blok()`
zelf).

`hashNaarEenheid(x, y, z)` — een simpele sinus-gebaseerde hash, GEEN
`Math.random()` — geeft een deterministische waarde in [0, 1) per
wereldpositie. `meubelBox()` bakt daarmee een UNIFORME (niet-gradiënte,
in tegenstelling tot T103's randocclusie) vertexkleur-factor binnen
±`TINT_VARIATIE` (10%, zelfde bereik als de bestaande ondode-huidtint) en
wrapt het gedeelde basismateriaal via T103's `matMetVertexKleur()`.

**Een plaatsingsvalkuil, gevonden vóór de test het kon bevestigen.** De
oorspronkelijke `const TINT_VARIATIE`/`hashNaarEenheid`/`bakUniformeTint`
stonden eerst vlak boven `meubelBox()` zelf (verderop in het bestand, bij
de meubel-bouwfuncties). `meubelBox()` als FUNCTIE is overal aanroepbaar
door function-hoisting, maar de `const`s die zijn body nodig heeft
bestaan pas zodra de script-executie die regel echt gepasseerd is — en de
allereerste `meubelBox()`-aanroep (het bijkeuken-keukenblok) staat
ruim eerder in de laadvolgorde. Resultaat: `ReferenceError: Cannot access
'TINT_VARIATIE' before initialization`, gevangen door `check-load.mjs`
vóór er ook maar één test draaide. Opgelost door het hele blokje te
verplaatsen naar vlak ná `vlak()`, ruim vóór de eerste meubel-aanroep.

`test-kleurtint-variatie.mjs` (9 checks, nieuw) bevestigt: de hash is
deterministisch en valt in [0,1), twee `meubelBox()`-instanties met
hetzelfde basismateriaal DELEN dat materiaal (geen cache-verdubbeling)
maar krijgen een verschillende tint, elke tint blijft binnen ±10%, alle
vertices van één instantie delen precies dezelfde factor (uniform, geen
gradient), de bron gebruikt nooit `Math.random()`, en de echte wereld
bevat meerdere uniform-getinte meshes met minstens twee verschillende
waarden (de kratten/vaten variëren daadwerkelijk).

**Implementatieverslag T105 (uitgevoerd, MET een bewuste afwijking van de
"gecachet zoals `geo()`"-spec hierboven).** `RoundedBoxGeometry` (al
aanwezig in hetzelfde three@0.160.0-pakket als de rest van het project,
`three/addons/geometries/RoundedBoxGeometry.js`) met een lage straal
(`AFSCHUINING_STRAAL = 0,015`, 1,5 cm) en een laag segmentaantal
(`AFSCHUINING_SEGMENTEN = 2`, een gefacetteerde schuine rand i.p.v. een
vloeiende ronding). Het echte visuele effect komt niet van een
vertexkleur-truc maar puur van de GEOMETRIE zelf: een afgeschuinde rand
heeft continu variërende normals, en dat alleen al laat gewoon
Standard-materiaallicht een lichtstreepje langs de rand vangen — de enige
van de vier T102-T105-tickets die geen `vertexColors` nodig heeft.

**De cache-afwijking.** De oorspronkelijke spec vroeg om `geoAfgeschuind()`
te cachen op een sleutel (afmetingen), net als `geo()`. Bij het bouwen
bleek dat te botsen met T104: `meubelBox()` combineert de afschuining MET
een per-instantie vertexkleur-tint, en die tint wordt ALS ATTRIBUUT op de
geometrie zelf gebakken — een gedeelde/gecachete geometrie zou die
vertexkleur dan voor ALLE instanties tegelijk overschrijven (de laatst
gebakken tint "wint" voor iedereen die dezelfde afmetingen deelt, precies
het "geen twee kisten zijn gelijk"-probleem dat T104 net had opgelost, nu
weer terug via de achterdeur). `geoAfgeschuind()` bouwt daarom bij ELKE
aanroep een verse `RoundedBoxGeometry` — geen cache, geen sleutel. Dat is
overigens geen nieuwe asymmetrie in de codebase: `blok()`/`bouwMuur()`
(T102/T103) deden dit al net zo, nooit via de `geo()`-cache.

Toegepast op `meubelBox()` (dus automatisch op kratten, vaten-nabije
decor, het keukenblok, de kelderluik-afdekking, de boekenkast en de
planken — acht call-sites "gratis" via één centrale wijziging) plus de
twee losstaande tafelblad-constructies (`bouwTafel()`, de werkbank in het
atelier) via een nieuwe `blokAfgeschuind()`-wrapper. Deuren zijn NIET
meegenomen in deze ronde (bewuste scope-beperking, geen los deurblad-
mesh-patroon gevonden dat zich net zo eenvoudig centraal liet aanpassen
als `meubelBox()`) — een kandidaat voor een latere ronde.

Een afgeschuinde box kost ~30-40 driehoeken meer dan een platte
`BoxGeometry` (24 vertices), dus het totale driehoekstal steeg opnieuw
fors in zones met veel meubilair (atelier: werkbank, binnenplaats:
kratten/vat, kelder: kelderluik, vliering: De Zelflader-meubilair,
gracht: kratten bij de vlonder) — dezelfde soort bewuste `RENDER_BAND`-
overschrijding als T102, geen enkele helderheidscheck verschoof.

`test-afgeschuinde-randen.mjs` (6 checks, nieuw) bevestigt: `geoAfgeschuind()`
bouwt daadwerkelijk een `RoundedBoxGeometry` (niet een platte box) met
merkbaar meer vertices, cachet bewust NIET (twee aanroepen met identieke
afmetingen geven verschillende objecten), `meubelBox()` roept 'm ook echt
aan, de straal blijft binnen de 1-2cm-marge, en het totaal aantal
`RoundedBoxGeometry`-meshes in de wereld blijft laag (meubilair, geen
tientallen muren die per ongeluk meegingen).

**Fase 4 (T102-T105) afgerond.** Volledige regressiesuite groen op elke
tussenstap; de basislijn-`triangles`-waarden in `test-visuele-basislijn.mjs`
zijn cumulatief bijgewerkt over T102 en T105 (T103/T104 raakten alleen
helderheid resp. niets meetbaars in de bestaande render-metrics).

### 10.13 Beslissing 88 — De wereld buiten de kaart (T93, T111, T112, T113)

**Het probleem.** `scene.background` is `0x05080b` — een egale
bijna-zwarte kleur. `FOG_NORMAAL.far` is 24 m en `camera.far` is 50 m,
dus alles voorbij ~24 m is volledig weg. Sta je op de binnenplaats en
kijk je omhoog, dan is er niets. Dat is geen nacht, dat is leegte. Een
grachtenpand staat tussen andere panden, onder een hemel; het spel
vertelt nu dat er buiten de kaart niets is.

Dat kost het grootste gevoel dat een buitenzone kan geven: **openheid als
contrast met de krappe binnenruimtes.**

**De beslissing, en de volgorde die eruit volgt.**

**T93 — Fogdiepte per zone, eerst.** `scene.fog.near`/`far`
interpoleren op basis van `zoneVan()`, met dezelfde zachte overgang die
`mistUitfaseTimer` al gebruikt. Binnen blijft dicht (6/24), buiten opent
naar ~40 m.

Dit ticket staat vroeg in de ronde en niet bij de andere I-tickets, om
twee redenen. Ten eerste is het op zichzelf al waardevol: het maakt het
binnen/buiten-contrast dat de kaart in zijn ontwerp heeft, voor het
eerst fysiek voelbaar. Ten tweede is het de **voorwaarde** voor T111 en
T112 — een skyline op 40 m is onzichtbaar zolang de fog op 24 m alles
uitdooft.

Twee complicaties. De Mistgolf-logica overschrijft de fog nu volledig;
de twee systemen moeten netjes op elkaar stapelen in plaats van elkaar
te overschrijven. En fog-afstand is een **gameplay**-parameter: hij
bepaalt op hoeveel meter je een ondode ziet aankomen. Buiten verder zien
is vermoedelijk positief (de binnenplaats is de open zone waar overzicht
hoort), maar het is een bijeffect dat expliciet benoemd en getest moet
worden, niet stilzwijgend meegenomen.

**T111 — Nachthemel.** Een grote `SphereGeometry` met `side: BackSide`,
`depthWrite: false` en `fog: false`, met een `ShaderMaterial`: verticale
gradient van donker staalblauw naar bijna-zwart, een sterrenveld uit
hash-ruis, en een traag scrollende wolkenlaag uit fractale ruis.

De dome moet met de camera meebewegen — `camera.far` op 50 m maakt hem
relatief klein en anders is de parallax bij het lopen zichtbaar. En hij
moet **donker en onopvallend** blijven: een sterrenhemel als in een
openwereldspel trekt de aandacht weg van waar die hoort. Meer "er is een
boven" dan "kijk eens hoe mooi".

**T112 — Skyline-silhouet.** Twee tot drie lagen platte, zwarte
silhouetgeometrie op 30/40/45 m, opgebouwd uit `blok()`-primitieven plus
driehoeken voor de geveltoppen, met een aangepaste fogbehandeling zodat
ze niet in het niets oplossen.

**De IP-regel uit CLAUDE.md geldt hier onverkort.** Geen herkenbare
bestaande Amsterdamse gebouwen, geen Westertoren, geen Munttoren.
Generieke grachtenpand-silhouetten en verzonnen torens — dezelfde lijn
als het verzonnen adres uit T84.

Het echte risico is **schaal**: staat het silhouet te dichtbij of te
groot, dan voelt de binnenplaats kleiner in plaats van groter.

**T113 — Verlichte raampjes in de verte.** Emissieve quads in T112's
silhouetlagen op het **Accent**-niveau uit beslissing 80 (dus onder de
bloom-threshold — een gloeiend raampje op 40 m concurreert met de
Signaal-laag die de speler moet kunnen vinden). Kleur uit
`PALET.raamWarmAmber`/`raamWarmZacht`, net als de bestaande
gevelraampjes. Zeer trage toestandswisselingen, en allemaal uit tijdens
een Stroomuitval.

Dit ticket bestaat niet zonder T112 en is een klein detail. Het staat
erin omdat de koppeling aan `stroomFactor` het van decoratie naar
verhaal tilt: tijdens een Stroomuitval zie je dat het niet alleen jouw
pand is.

**Implementatieverslag T93 (uitgevoerd; T112/T113 blijven ontwerp-only
voor deze ronde, T111 hieronder).** `FOG_BUITEN = { kleur: FOG_NORMAAL.kleur,
near: FOG_NORMAAL.near, far: 40 }` — alleen `far` wijkt af, zodat een
overgang nooit ook de kleur/dichtbij-band laat springen. `ZONE_BUITEN =
[false, false, false, true, false]` classificeert alleen `zoneVan()`-index
3 (de Binnenplaats) als buiten; zone 4 (Bijkeuken/"de weg naar de gracht")
telt bewust als binnen, want die heeft zijn eigen `BIJKEUKEN_PLAFOND` en
`zoneVan()` zelf is in dit ticket niet herzien — een bekende, geaccepteerde
vereenvoudiging.

De overgang hergebruikt letterlijk het `mistUitfaseTimer`-sjabloon: een
nieuw `zoneFogTimer`/`zoneFogVan`/`zoneFogDoel`-drietal, `2 s`
(`ZONE_FOG_OVERGANG_DUUR`), en een `updateZoneFog(dt)` die `scene.fog.near`/
`far`/`color` lineair interpoleert. De trigger zit in het BESTAANDE
zone-wissel-blok van `gameLoop` (dezelfde plek die het HUD-zonelabel al
bijwerkt), niet in een nieuwe per-frame check, en vuurt alleen bij een
echte binnen/buiten-*profielwissel* — twee binnenzones na elkaar (bv.
Woonkamer → Gang) laten `zoneFogTimer` op 0 staan.

**Het samenspel met de Mistgolf** was de kern van het ticket: een
Mistgolf blijft tijdens zijn hele duur leidend (de trigger hierboven is
expliciet gegate op `actieveEventGolf !== 'mist'`, dus een zone-wissel
tijdens mist doet niets), en `eindigEventGolf()` berekent zijn
terugkeerdoel nu dynamisch — `ZONE_BUITEN[zoneVan(speler.positie.x,
speler.positie.z)] ? FOG_BUITEN : FOG_NORMAAL` — in plaats van de oude
hardgecodeerde `FOG_NORMAAL`. Een Mistgolf die eindigt terwijl de speler
buiten staat, keert dus terug naar `FOG_BUITEN`, niet naar de krappere
binnenwaarde.

`test-fogdiepte.mjs` (21 checks, nieuw) bevestigt: de structuur van beide
profielen, dat alle vijf zones na de overgang op het juiste profiel
uitkomen, dat de overgang zelf zacht is (een tussenwaarde strikt tussen
24 en 40, geen instant-snap), dat twee binnenzones na elkaar geen
overgang triggeren, en het volledige Mistgolf-samenspel (blijft
`FOG_MIST` ongeacht zonewissels tijdens de golf; keert na afloop terug
naar het profiel van de HUIDIGE zone, getest zowel eindigend-binnen als
eindigend-buiten). Volledige regressiesuite ná T93+T94 samen: **65/66
groen** — de ene aanvankelijke fail was `test-camerabeweging.mjs`'s
schotenreeks-test, root-cause en fix hieronder bij T94/T95.

**Implementatieverslag T111 (uitgevoerd, Fase 7 — "De wereld buiten").**
Eén `THREE.Mesh` (`nachthemel`) met `SphereGeometry(NACHTHEMEL_STRAAL=46,
24, 16)` — de straal ruim onder `camera.far` (50 m), zodat T112's skyline
(tot ~40 m, zie de eigen implementatieverslag hieronder) er straks nog net
binnen past zonder dat de dome zelf geclipt wordt. Een eigen
`ShaderMaterial` (`side: BackSide` — de camera zit
BINNEN de bol —, `depthWrite: false`, en bewust `fog: false`: de dome IS
de achtergrond, `fog: true` zou 'm juist naar `scene.background` toe
laten vervagen in plaats van andersom). De fragment-shader doet drie
dingen, elk goedkoop gehouden (§10.3, fragment-bound budget): een
verticale gradient (`mix(kleurHorizon, kleurZenit, pow(hoogte, 0.55))`,
donker staalblauw naar bijna-zwart), een stilstaand sterrenveld uit een
enkele hash-sample op de richtingsvector (spaarzaam gedrempeld,
`step(0.9925, ...)`, dus het overgrote deel van de hemel blijft leeg),
en een traag scrollende wolkenlaag uit een 3-octaven fbm (uniform `tijd`,
laag contrast, alleen zichtbaar dicht bij zenit zodat de wolken de
horizon niet verdringen). Geen enkel CDN-asset — alles hash-/fbm-ruis in
GLSL, zelfde discipline als de rest van het spel.

De dome volgt de camera (`updateNachthemel()` zet `nachthemel.position =
camera.position`, elke frame, in de bestaande cosmetische zone van
`gameLoop` direct na `updateBootPositie()`) — op een straal van "maar"
46 m zou de parallax bij het lopen anders zichtbaar worden. Het
`tijd`-uniform wordt gevoed met `klok`, niet `dt`/`nu`: `klok` loopt
alleen op tijdens `spelActief`, dus de wolken bevriezen automatisch
tijdens pauze/measurement-modus (T88) zonder dat er een nieuw
bevries-mechanisme nodig was — hetzelfde patroon als de bootpositie en
de gracht-lantaarnpuls.

**De T110-postmortem betaalde zich meteen uit.** Na de fog-uniforms-crash
van T110 (`fog: true` zonder `THREE.UniformsLib.fog` gemerged in de
uniforms crashte elke frame in een gefogde kamer) is een proactieve
`page.on('pageerror', ...)`-sweep over alle acht standpunten nu vaste
prik ná elke nieuwe `ShaderMaterial`. Voor T111 leverde die sweep **nul**
fouten op — verwacht, want de dome kiest bewust `fog: false` en heeft dus
geen `THREE.UniformsLib.fog`-uniforms nodig, maar de check bevestigt dat
in plaats van het aan te nemen.

**Basislijn-impact, twee losse effecten.** `test-visuele-basislijn.mjs`
(65/65 na bijwerking) moest op twee onafhankelijke punten worden
aangepast:

  * BINNENPLAATS en GRACHT, gemiddelde helderheid duidelijk OMHOOG
    (binnenplaats 33,81 → 39,26; gracht 19,01 → 40,24, bijna
    verdubbeld). Dit is de bedoelde werking van het ticket, geen bug: de
    dome vervangt een vlakke `scene.background` (`0x05080b`,
    bijna-zwart) door een echte horizonband die BEWUST lichter is
    (`kleurHorizon = 0x2a3a52`, een reëel nachtelijk
    hemellicht-effect). Beide standpunten kijken vlak op die horizon —
    de gracht heeft `pitch: 0` recht over het water (geen dak dat de
    hemel afschermt), de binnenplaats is de enige standpunt-zone die
    letterlijk "buitenlucht, geen dekking" is (`ZONE_FLAVOUR[3]`). De
    overige zes standpunten kijken een kamer/gang/kelder in en zien de
    dome nauwelijks — die brightness-checks verschoven dan ook niet. Een
    voor/na-schermafbeelding van de gracht (zie hieronder) laat het
    verschil meteen zien: van een vlak zwart niets naar een zichtbare
    sterrenhemel boven het water.
  * ALLE ACHT zones, driehoeken +704 tot +812 (de 720-driehoeks
    bol, altijd in beeld want ze omsluit de camera). Op zichzelf ruim
    binnen de 25%-RENDER_BAND. Bij twee zones (gang, bijkeuken) kwam die
    kleine toevoeging bovenop reeds bestaande, nooit expliciet
    bijgewerkte driehoeksdrift uit eerdere tickets (T106-T110 raakten de
    telling niet noemenswaardig, maar de laatst vastgelegde
    BASISLIJN-waarde was daardoor al ~20% achterhaald — onder de
    25%-grens, dus tot nu toe onopgemerkt) — samen precies over de band.
    Bij deze gelegenheid zijn de triangles/calls van alle acht zones
    ververst naar de daadwerkelijk gemeten waarden.

`tests/test-nachthemel.mjs` (nieuw, 15 checks): de dome is een Mesh met
`SphereGeometry` op de verwachte straal, het materiaal is een eigen
`ShaderMaterial` met `side:BackSide`/`depthWrite:false`/`fog:false`/niet
transparant, hangt precies één keer in `wereld`, `updateNachthemel()`
zet de positie exact gelijk aan `camera.position` en het tijd-uniform
exact gelijk aan het doorgegeven argument, twee metingen op hetzelfde
standpunt geven bit-voor-bit identieke screenshots (determinisme onder
`openVoorVisueleMeting()`), geen van de ronde-brede invarianten (28
lichten, 56 obstakels, 14 interactiepunten) is geraakt, en zes echte
frames met de dome actief geven nul pageerrors. Volledige regressiesuite
na T111: groen (zie run-all.mjs-log).

**Implementatieverslag T112 (uitgevoerd, MET een bewuste afwijking van de
architectuurschets — zie hieronder).** Drie lagen platte
silhouetgebouwen: een noordlaag (5 gebouwen per laag, zichtbaar vanaf de
binnenplaats, voorgevel naar +Z/zuid) en een oostlaag (4 gebouwen per
laag, zichtbaar vanaf de gracht/vlonder, voorgevel naar -X/west via
`rotY=-PI/2` op de hele groep) — samen 27 gebouwen. Elk gebouw is een
`THREE.Group` met een `BoxGeometry`-romp (dezelfde bouwsteen als `blok()`,
maar zonder `blok()` letterlijk te hergebruiken — zie hieronder) en,
voor ongeveer een derde van de gebouwen (`rnd() < 0.35`), een
driehoekige puntgevel via een gedeelde `THREE.Shape`/`ShapeGeometry`.
Breedte/hoogte/dak-keuze/positie-jitter komen uit een deterministische
PRNG (`maakZaadRandom(tekstZaad('skyline-v112'))`, hetzelfde patroon als
T107's klinkerrealisme) — reproduceerbaar per page-load, geen
`Math.random()`.

**Materiaal: bewust GEEN `blok()`/`matFamilie()`.** Een silhouet moet
vlak zwart blijven ongeacht scene-lichten (een PBR-materiaal zou op het
hemisfeerlicht/de puntlichten reageren) én ongeacht fog (`fog: true` zou
het naar `scene.fog.color` laten vervagen — bij de twee verste lagen zou
dat het silhouet vrijwel onzichtbaar maken, exact het "oplossen in het
niets" dat dit ticket vermijdt, dezelfde afweging als de T111-dome). Drie
gedeelde `MeshBasicMaterial`s (`SKYLINE_KLEUREN`, één per laag, iets
lichter naar achteren als zachte diepte-cue, altijd ruim donkerder dan
de hemel-horizon), `side: DoubleSide` zodat de platte geveltop-driehoek
vanaf elke hoek zichtbaar blijft. `test-skyline.mjs` bevestigt: precies 3
gedeelde materialen voor 27 gebouwen (geen 27 losse), en dat élk gebouw
`fog:false`/`MeshBasicMaterial` heeft.

**De schaal-afweging (het risico dat §10.13 al benoemde) kostte twee
mislukte iteraties, hier vastgelegd omdat het de kern van dit ticket
is.** De architectuurschets noemt "30/40/45 m" zonder een referentiepunt
te specificeren. Eerste poging: die afstanden gemeten vanaf de bestaande
T88-standpunten (binnenplaats/gracht), met een brede horizontale
spreiding voor een natuurlijke skyline-uitstraling. Dat zag er in een
screenshot vanaf het standpunt zelf goed uit, maar `camera.far` is een
vaste, harde grens (50 m, invariant) en de speler staat niet vastgeklonken
op het standpunt — de binnenplaats is zelf ~17x16 m. Een test die de
afstand meet vanaf de daadwerkelijke speelbare UITHOEKEN (niet alleen het
standpunt) tegen elk skyline-gebouw legde bloot dat de verste laag, vanaf
de ongunstigste hoek, tot ~52 m kon oplopen — voorbij `camera.far`,
zichtbaar wegklappende gebouwen zodra de speler naar de rand liep. Tweede
poging: de dieptes drastisch verkleind (20/26/32 m) om ruim binnen de
grens te blijven. Dat loste de clipping op, maar een beeldverslag-
screenshot liet meteen zien dat dít precies het risico uit §10.13 was:
de gebouwen vulden het beeld als een blokkerende muur, de binnenplaats
voelde kleiner in plaats van groter. Derde, uiteindelijke poging: de
diepte zo dicht mogelijk bij de architectuurschets gehouden (noordlaag
26/30/34 m, oostlaag — de smalle gracht/vlonder-strook heeft nauwelijks
eigen "reikwijdte", dus die blijft dichter bij het origineel — 30/36/40
m) met een iets smallere spreiding op de verste laag (de dominante factor
in de wegklap-afstand bleek de spreiding, niet de diepte zelf).
`test-skyline.mjs` test dit expliciet tegen de vier speelbare
GRENS-uithoeken van beide zones: elke laag blijft vanaf elke speelbare
positie minstens 4 m binnen `camera.far`. Twee voor/na-beeldverslagen
(de mislukte tweede poging vs. de uiteindelijke plaatsing) tonen het
verschil.

`test-skyline.mjs` (nieuw, 13 checks): 27 gebouwen (9 per laag, 5 noord +
4 oost), elk precies 1 romp en 0-of-1 dak (consistent met
`userData.skylineDak`), minstens één maar niet alle gebouwen hebben een
dak (variatie), 3 gedeelde materialen, `fog:false`/`MeshBasicMaterial`
overal, de camera.far-marge-check hierboven, en de bestaande
§10.2-invarianten (56 obstakels, 14 interactiepunten, 28 lichten — de
skyline zelf is geen lichtbron, dat is T113) blijven intact.

**Basislijn-impact.** Alleen BINNENPLAATS en GRACHT (dezelfde twee zones
als T111, om dezelfde reden), en ditmaal juist weer een stuk DONKERDER
(binnenplaats 39,26 → 35,21; gracht 40,24 → 34,37): de donkere
silhouetten onttrekken een deel van T111's lichtere horizonband aan het
gezichtsveld — de bedoelde werking. De overige zes standpunten zien de
skyline niet. Volledige regressiesuite na T112: groen (zie
run-all.mjs-log).

**Implementatieverslag T113 (uitgevoerd, MET een bewuste
scope-reductie — zie hieronder).** Kleine `PlaneGeometry`-vlakjes
(0,32x0,46m) op de voorgevel van T112's silhouetgebouwen, kleur
`PALET.raamWarmAmber`/`raamWarmZacht` (dezelfde twee kleuren als de
bestaande gevelraampjes van `bouwAchterGevel()`), `MeshBasicMaterial`
(`transparent`, `depthWrite:false`, `fog:false` — zelfde afweging als de
romp/de dome). In tegenstelling tot de romp/het dak (3 gedeelde
materialen voor 27 gebouwen) krijgt ÉLK raampje een EIGEN
materiaal-instantie: elk raampje animeert zijn eigen opacity
onafhankelijk, dat kan niet via één gedeeld materiaal.

**Animatie: sign(sin()) i.p.v. een puls.** Elk raampje krijgt bij het
bouwen een deterministische fase (`rnd() * 2π`). `updateSkylineRaampjes
(klokTijd, stroomFactorWaarde)` — aangeroepen vanuit gameLoop's bestaande
`klok`-gedreven cosmetische zone, direct na `updateNachthemel(klok)` —
zet de opacity per raampje op `basis * (sin(klok * RAAMPJE_FREQUENTIE +
fase) > 0 ? 1 : 0) * stroomNormaal`. `RAAMPJE_FREQUENTIE=0,006 rad/s` is
bewust extreem laag: een sign()-drempel op een trage sinus geeft
zeldzame, harde aan/uit-wissels ("iemand liet het licht aan of uit"),
geen puls of ademhaling (dat zou eerder lezen als een signaal dat om
aandacht vraagt, het tegenovergestelde van een Accent-tier achtergrond-
detail). Doordat de update op `klok` draait (niet `dt`/`nu`), bevriest
het patroon automatisch tijdens pauze/measurement-modus (T88) — zelfde
gratis determinisme als T111's dome, bevestigd in
`test-skyline-raampjes.mjs` met een bit-voor-bit identieke-opacity-check.

**Stroomuitval: bewust GEEN vloer.** `stroomNormaal` mapt
`STROOMUITVAL_DIM_FACTOR` (0,12, de bestaande blackout-bodem) naar
PRECIES 0 — niet naar een kleine restwaarde zoals `BUITEN_STROOM_VLOER`
(0,5) dat doet voor de lichten van het EIGEN pand. Dat verschil is
opzettelijk: de eis uit §10.13 is dat de speler tijdens een Stroomuitval
ziet dat "het niet alleen jouw pand is" — een skyline die net als het
eigen pand op een vloer bleef doorgloeien zou die pointe tegenspreken.
`test-skyline-raampjes.mjs` bevestigt: bij `stroomFactor=1` staat een
natuurlijke deelverzameling aan, bij `stroomFactor=STROOMUITVAL_DIM_FACTOR`
staat ELK raampje op opacity exact 0.

**De scope-reductie: van een dicht rooster naar een hard budget van 2 per
gebouw — een performance-verrassing, niet een ontwerpwens.** De eerste
versie vulde een compleet rooster (kolommen/rijen op basis van
gebouwbreedte/-hoogte, 65% vulkans) — gemiddeld ~4,6 raampjes per gebouw,
125 in totaal. Een basislijn-hermeting daarna liet iets onverwachts zien:
de draw calls stegen niet alleen op binnenplaats/gracht, maar in VRIJWEL
ELKE zone (woonkamer +149, gang +149, atelier +149, bijkeuken +149,
kelder +64, vliering +136), inclusief kamers die kilometers ver van de
skyline af liggen én er met muren en verdiepingen tussenin voor staan.
Root cause: Three.js doet standaard GEEN occlusion-culling, alleen
frustum-culling — een object dat binnen de camera-KEGEL van een
standpunt valt, telt mee als draw call zodra het binnen `camera.far`
ligt, OOK als een muur het object voor de speler onzichtbaar maakt (de
GPU depth-test verbergt het correct ACHTER de muur, maar de call zelf is
al gedaan). Zeven van de acht T88-standpunten hebben toevallig
`yaw=0` ("kijk naar het noorden") — exact de richting van de
noordlaag-skyline — dus elk raampje daar viel binnen het frustum van
bijna elke kamer, ondanks dat de speler het nooit kan zien. Met 125 objecten werd
dat voor het eerst zichtbaar in de RENDER_BAND (10-16 losse T109/T110-
objecten eerder deze ronde bleven daar altijd ruim onder). Oplossing:
géén per-cel-kans meer (die schaalt met roostergrootte), maar een HARD
budget van hoogstens 2 raampjes per gebouw, willekeurig gekozen uit de
kandidaat-cellen (15% kans op 0, anders 1, met 40% kans op een 2e) — 125
→ 28 raampjes. Dat is minder dicht dan de eerste, mooiere schets, maar op
26-40m afstand is een raampje toch maar een paar pixels; het
beeldverslag laat zien dat het effect (een paar zichtbare, warme
lichtjes in de verte) overeind blijft.

`test-skyline-raampjes.mjs` (nieuw, 15 checks): structuur
(PlaneGeometry/MeshBasicMaterial/transparent/depthWrite/fog), UNIEK
materiaal per raampje (in tegenstelling tot de gedeelde romp-materialen),
kleur uit het bestaande `PALET`, bescheiden opacity-bereik (0,2-0,45,
ruim onder de bloom-threshold van 0,82 na compositie tegen de donkere
gevel), het volledig-uit-gedrag bij `STROOMUITVAL_DIM_FACTOR` (geen
vloer), determinisme (dezelfde klok-waarde ⇒ bit-voor-bit dezelfde
opacities), zes frames zonder pageerror, en de bestaande invarianten
(56 obstakels, 14 interactiepunten, 28 lichten — de raampjes zijn geen
lichtbron, puur materiaal-opacity).

**Basislijn-impact (na de scope-reductie naar 28 raampjes).** Alleen
GRACHT, en alleen de "MET kleurgrading"-gemiddelde-check, kwam nog net
(2,5%) over de 2%-band (33,72 gemeten vs. 34,37 basislijn) — de kleine
extra warme-raampjes-bijdrage onder grading. Bijgewerkt naar 33,72; de
ONgegradeerde gracht-meting (1,9%) en alle andere 63 checks bleven al
binnen de band. Volledige regressiesuite na T113: groen (zie
run-all.mjs-log) — hiermee is Fase 7 ("De wereld buiten") compleet:
T111 (nachthemel), T112 (skyline-silhouet) en T113 (verlichte raampjes)
zijn alle drie geïmplementeerd, getest en gedocumenteerd.

### 10.14 Beslissing 89 — Levend water zonder tweede scene-render (T114)

**Het probleem.** `waterMesh` is één `PlaneGeometry(8, gangDiepte + 2)`
met `MeshStandardMaterial({ color: 0x1a3a34, roughness: 0.15,
metalness: 0.2, transparent: true, opacity: 0.85 })`. Volstrekt stil,
geen golfjes, geen reflectie. Een gracht is per definitie bewegend,
spiegelend water; dit is een geverfde plaat. Het is het meest
opvallende afzonderlijke object in het spel dat er niet uitziet als wat
het voorstelt.

**De beslissing.** Twee lagen, en expliciet **niet** de derde:

1. **Vertex-deining.** Een gesubdivideerd `waterMesh` met twee tot drie
   gekruiste sinussen in een vertex-shader. Gratis (vertexwerk, geen
   fragmentwerk) en direct overtuigend.
2. **Gebroken specular.** Een procedurele normal-verstoring uit
   scrollende ruis, zodat het licht van `grachtLantaarnLicht` in een
   lange, trillende streep breekt in plaats van als één vlek te liggen.

**Wat expliciet afvalt:** een echte spiegelreflectie via Three.js'
`Reflector` uit `three/addons/objects/`. Dat is een **nieuwe
addons-import** én een tweede scene-render, voor één vlak dat de speler
alleen in zone 4 ziet, in het donker, waar de reflectie toch grotendeels
zwart is met één lichtstreep erin. De fake-variant — de lantaarnstreep
als verticaal uitgerekte gradient-quad die met de golfnormaal vervormt —
kost een fractie en is in dit licht nauwelijks te onderscheiden.

**Randvoorwaarden.** Het water ligt op y = −0,05 en de speler kan er niet
in (er is een obstakel aan de vlonderrand). De golven mogen nooit boven
de vlonderrand uitkomen. En `bootGroep` mag meedeinen, maar
`updateBootPositie()` schrijft die groep elke frame — de deining moet
daar bovenop komen, niet in plaats van.

Dit ticket staat achteraan omdat het volledig zelfstandig is: zone 4,
één mesh, geen enkele afhankelijkheid. Het is een goede afsluiter en
een veilige plek om te stoppen als de ronde uitloopt.

**Implementatieverslag T114 (uitgevoerd — Fase 8, exact de twee lagen uit
de beslissing, expliciet niet de derde).** `waterMesh` kreeg eerst
subdivisie (`PlaneGeometry(WATER_BREEDTE, gangDiepte+2, 24, 12)` i.p.v.
1x1 — zonder subdivisie heeft een plane maar 4 hoekpunten en is
vertex-deining onzichtbaar), daarna een `bouwWaterMateriaal()`-fabriek:
dezelfde `MeshStandardMaterial` als voorheen, met een `onBeforeCompile`-
injectie (zelfde chunk-patroon als `maakOndodeMateriaal()`/de rimlight uit
T100 — `#include <common>` voor uniform/varying-declaraties,
`#include <begin_vertex>` voor de deining, `#include <normal_fragment_maps>`
voor de gebroken specular, three@0.160.0).

**Laag 1 (deining).** Drie gekruiste sinussen op de lokale (pre-rotatie)
x/y van elke vertex, opgeteld bij `transformed.z` (die as wordt na de
bestaande `rotation.x=-PI/2` de wereld-hoogte-as — zelfde conventie als
elke `vlak()`-vloer). Bewust GEEN los `ShaderMaterial`: dat zou fog en
PBR-lichtrespons opnieuw met de hand moeten regelen (de T110-postmortem),
terwijl `onBeforeCompile` op de bestaande `MeshStandardMaterial` die twee
dingen gratis gedaan houdt.

**Brontabel, niet losse constanten.** De drie sinustermen (amplitude/
frequentie-x/frequentie-z/frequentie-t) staan in `GOLF_AMPLITUDE`/
`GOLF_FREQ_X`/`GOLF_FREQ_Z`/`GOLF_FREQ_T` — dezelfde tabel voedt zowel de
gegenereerde GLSL (`GOLF_GLSL`, een `.map()` over de tabel naar
shader-regels) als een JS-spiegel `golfHoogte(x, z, t)`. Reden: de
vertex-shader draait op de GPU en is niet terug te lezen vanuit een test
zonder een render-naar-textuur-omweg; een JS-functie met exact dezelfde
wiskunde is direct testbaar (`test-levend-water.mjs` verifieert de
amplitude-grens hiermee) én is meteen bruikbaar voor de twee dingen
hieronder die WEL in JS moeten gebeuren.

**De randvoorwaarde "nooit boven de vlonderrand".** Som van de drie
amplitudes = 0,062 m. Water op y=−0,05, vlonderrand-obstakel-top op
y≈0,4 — een marge van >0,3 m, ruim voorbij wat de golf ooit haalt.
`test-levend-water.mjs` bewijst dit met een brute-force sweep over
x/z/t i.p.v. het manueel na te rekenen.

**Laag 2 (gebroken specular).** Een procedurele normal-verstoring uit
scrollende hash-ruis (zelfde hash-functie-stijl als T111's nachthemel,
geen nieuwe textuur/asset) toegepast op de reeds-bestaande view-space
`normal` uit `<normal_fragment_maps>`, vlak vóór de lichtberekening 'm
gebruikt. Het resultaat: het licht van `grachtLantaarnLicht` breekt in
een onrustige, bewegende highlight i.p.v. één scherpe vlek.

**Boot-deining, gestapeld — niet vervangen.** `updateBootPositie()`
(bestaand, elders in `gameLoop`) schrijft uitsluitend `bootGroep.position.x`.
`updateWaterAnimatie(klokTijd)` — nieuw, in dezelfde `klok`-gedreven
cosmetische zone direct na `updateSkylineRaampjes` — zet `.position.y` en
een lichte `.rotation.z`-kanteling via `golfHoogte()` op de boot's eigen
positie, dus de boot deint in tempo met het water eronder. Omdat de twee
functies verschillende properties aanraken, stapelen ze zonder conflict —
`test-levend-water.mjs` bewijst dit expliciet: een `updateBootPositie()`-
aanroep NA de deining laat `.position.y` ongemoeid.

**De fake lantaarnstreep — bewust GEEN Reflector.** Een losse, kleine,
handgesubdivideerde `PlaneGeometry` (2,6x0,22 m) met een handgetekend
vertex-color-verloop (warm in het midden, zwart aan alle vier de randen —
geen canvas-textuur, geen nieuw asset) als `MeshBasicMaterial`,
transparant, `depthWrite:false`, plat op het water. "Vervormt met de
golfnormaal" is geïmplementeerd als een lichte `rotation.z`-wobble
afgeleid van dezelfde `golfHoogte()` (i.p.v. de GPU-normal terug te lezen,
wat een render-naar-textuur-omweg zou vergen voor een effect dat de
architectuurschets zelf al "nauwelijks te onderscheiden" noemt) —
goedkoop, en precies de "fake variant" die decision 89 vraagt i.p.v. een
`Reflector` (nieuwe addons-import + tweede scene-render).

`tests/test-levend-water.mjs` (nieuw, 21 checks): structuur (subdivisie,
`MeshStandardMaterial` met `onBeforeCompile`, fog blijft aan), de
shader-uniform wordt pas gevuld ná de EERSTE render van `waterMesh`
(getest door de speler eerst naar het grachtstandpunt te zetten — een
val die dit testbestand zelf blootlegde: `onBeforeCompile` vuurt lazy, bij
het eerste daadwerkelijke draw-call, niet bij materiaal-constructie),
`golfHoogte()`'s amplitude-grens en determinisme, de boot-deining
gestapeld-niet-vervangen-eis, de reflectiestreep's structuur/wobble,
bit-voor-bit determinisme onder `openVoorVisueleMeting()` (dezelfde
klok-bevriezing als T111/T113), zes frames zonder pageerror, en de
bestaande invarianten (28 lichten, 56 obstakels, 14 interactiepunten).

**Basislijn-impact.** Alleen GRACHT (het enige standpunt met het water in
beeld), duidelijk DONKERDER (gemiddelde 33,72 → 31,62, −6,2%; mediaan
25,89 → 25,60, −1,1%, net binnen de band). Twee samenhangende, begrepen
oorzaken: de gebroken-specular-laag verstrooit het lantaarnlicht over een
breder, minder fel gebied i.p.v. één scherpe highlight, en de deining
kantelt een deel van het watervlak weg van de camera — beide precies de
bedoelde werking (een levend, onrustig oppervlak i.p.v. een vlakke,
gelijkmatig verlichte plaat), geen bug. Driehoeken/calls: kleine,
verwachte toename door de watersubdivisie en de nieuwe
reflectiestreep-mesh, ruim binnen de band, niet bijgewerkt. Volledige
regressiesuite na T114: groen (zie run-all.mjs-log) — hiermee is Fase 8
("Water") compleet.

**Feedback-ronde na Fase 8: drie fixes, één gedeelde grondoorzaak.** De
gebruiker meldde twee losse dingen na het spelen. Ze bleken grotendeels
hetzelfde probleem, en dat is de moeite van het vastleggen waard: **T111
maakte bestaande, altijd al aanwezige gaten in de wereldgeometrie voor
het eerst zichtbaar.** Vóór de nachthemel stond overal de bijna-zwarte
`scene.background` achter; een kier in een muur toonde zwart-op-zwart en
viel niemand op. De koepel verving dat door een lichte kleur — en dus
lichtten al die kieren ineens blauw op. Geen van de gaten was nieuw.

*Fix 1 — de koepel onder de horizon (de grondoorzaak).* De
fragment-shader deed `float hoogte = clamp(r.y, 0.0, 1.0)`, met in de
code ernaast de expliciete aanname "de dome is BackSide dus alleen het
bovenste halfrond is ooit echt zichtbaar". Die aanname is fout: de koepel
is een volledige bol óm de camera, en de onderste helft is zichtbaar door
elk gaatje. Door de clamp kreeg die hele onderhelft bovendien de volle,
relatief lichte horizonkleur (0x2a3a52) — het slechtst denkbare geval.
Nu zakt alles onder de horizon via een `smoothstep` weg naar een nieuwe
`kleurGrond`-uniform (0x020406), donkerder dan de donkerste kamer. Dit is
niet alleen een pleister op de lekken: een hemelkoepel die ónder de
horizon licht is, is op zichzelf al verkeerd — daar hoort grond of water
te zijn. De gebruiker verwoordde precies die regel ("vanaf de horizon
beneden moet de vloer altijd donker zijn").

*Fix 2 — de twee echte kieren dichtmetselen.* Diagnose met een
tijdelijk **fel-magenta koepel** (alle drie de kleur-uniforms op
0xff00ff) en een pixelteller over een yaw/pitch-raster: elke magenta
pixel is per definitie een plek waar je door de wereld heen kijkt. Die
methode vond precies de twee plekken die de gebruiker noemde. Nieuwe
helper `bouwVulMuur(x, z, breedte, diepte, vanY, totY, kleur)` — een
muurstuk tussen twee hoogtes, **zonder** `registreerRechthoek()`, want de
collision in dit spel is 2D en zou anders een beloopbare doorgang
blokkeren:
  * **Boven de gangopening.** Het atelier is `ATELIER_HOOGTE` (3,6) hoog,
    de gang erachter maar `KAMER_HOOGTE` (3,2). De zuidmuur van het
    atelier werd in twee segmenten links en rechts van de opening
    gebouwd, maar er was nooit een bovendorpel — die 40 cm stond open,
    dus keek je vanuit het atelier over het gangplafond heen de koepel
    in.
  * **Onder de zuidmuur van de vliering.** `vlieringMuur()` begint op
    `VLIERING_Y` (1,2 m), logisch voor een muur óp de vliering, maar
    daaronder bleef de strook tot de vloer open — en daar ligt geen
    atelier meer (dat stopt bij `VLIERING_X_OOST`). Vanaf de trap keek je
    dus ónder die muur door naar buiten. De collisierechthoek was hier al
    door `vlieringMuur()` geregistreerd, dus de vulmuur is puur visueel.

*Fix 3 — het water doortrekken.* Melding: "bij de boot is maar een
rechthoekig stuk water, je ziet de huizen erachter." Klopt: het watervlak
was 8x4 m (alleen het vaarwater tot `BOOT_VERTREK_X`) en eindigde in het
niets, terwijl de T112-skyline op ~47 m staat. Alles daartussen was leeg.
Twee nieuwe constanten (`WATER_VLAK_LENGTE` 28 m, `WATER_VLAK_DIEPTE`
36 m) beschrijven nu het VISUELE vlak, met het vaarwater erbinnen; het
loopt door tot net vóór de dichtstbijzijnde skyline-laag, die daarmee op
de verre oever komt te staan in plaats van achter een zwevende
rechthoek. Rekenkosten waren de zorg van de gebruiker, maar een plat vlak
is goedkoop: de kosten zitten in driehoeken, en die groeien alleen omdat
de subdivisie meeschaalt met de afmeting (~0,7 m per segment — nodig
omdat de golflengte van de T114-deining 3-5 m is en een grovere stap zou
gaan aliassen). Dat is één zone (gracht) die de 25%-RENDER_BAND passeert,
verder niets.

Basislijn: alleen GRACHT verschoof in helderheid (31,62 -> 22,07
gemiddeld), en door beide fixes dezelfde kant op — waar vroeger lichte
hemel onder de horizon stond, staat nu donker water en donkere grond. De
zeven andere standpunten kijken een kamer in en raakten niets. Daarnaast
zijn de draw calls/driehoeken van alle acht zones ververst: die stonden
nog op de T112-waarden en waren sinds T113 (raampjes) en T114 (water)
opgelopen tot net over de band.

**Tweede feedback-ronde: de wereld moest ergens op staan.** Twee nieuwe
meldingen, allebei over hetzelfde onderliggende gebrek — geometrie die
in de lucht eindigt in plaats van ergens op te rusten.

*"Bij de boot lijken de huizen in de verte te zweven in het niks."* Dat
klopte letterlijk. De skylinelagen staan op y=0, maar er lag niets
ONDER ze: het water hield eerder op en daarachter was leegte, dus je zag
de onderkant van elke gevel tegen de hemelkoepel aftekenen. Erger nog,
de dichtstbijzijnde oostlaag (x≈47,25) stond IN het water, dat na de
vorige fix tot 47,5 doorliep. Opgelost met een verre oever:
`bouwVerreGrond()` legt één plat vlak per skylinegroep, en het water is
2 m ingekort (`WATER_VLAK_LENGTE` 28 → 26) zodat de oever ruimte heeft.
De truc die dit zonder zichtbare "rand van de wereld" laat werken is de
kleur: de oever krijgt exact `kleurGrond` (0x020406), dezelfde kleur die
de koepel ónder de horizon heeft sinds de vorige fix. Waar het vlak
ophoudt gaat het dus naadloos over in de koepel — je ziet nooit een
overgang, alleen een horizon. De skylinegebouwen zijn een fractie
lichter en blijven als silhouet leesbaar tegen de lichtere hemel.

*"Het is een beetje gek dat er geen gevel of iets is van de gebouwen."*
Ook terecht, en een blinde vlek die al sinds de bouw van de binnenplaats
bestond: de BUURpanden kregen met `bouwAchterGevel()` netjes gevels,
maar de wand van het eigen pand — de oostmuur van het atelier, de hele
westzijde van de binnenplaats — was een kale plaat met alleen een
deurgat. Wat een muur tot gevel maakt is geleding, dus die is
toegevoegd: een daklijst met overstek (het belangrijkste element; het
geeft de muur een bovenkant in plaats van hem in het niets te laten
ophouden), een goot als horizontale lichtlijn eronder, een plint waar
hij de klinkers raakt, acht kozijnen op twee verdiepingen, en een
regenpijp als verticale tegenhanger. Daarnaast kreeg
`bouwBinnenplaatsMuur()` in de fabriek zelf een muurafdekking, zodat
alle drie de perimetermuren automatisch een bovenkant hebben. Niets
hiervan registreert collision: de muurrechthoeken bestaan al en alle
delen steken hooguit 6-25 cm uit (zelfde lijn als de bestaande
regenpijp-/balkondecoratie).

Twee dingen die het bouwen zelf corrigeerde. Het verlichtingspatroon van
de kozijnen kwam eerst uit een gezaaide PRNG, maar bij acht ramen geeft
toeval te vaak een scheve verdeling — de eerste seed liet er 2 van 8
branden, allebei aan dezelfde kant, waardoor het pand er verlaten
uitzag. Nu een handgeschreven patroon (5 van 8, beneden vaker dan
boven). En het "uit"-glas was aanvankelijk bijna zwart, wat als gaten in
de muur las in plaats van als ramen; onverlicht glas weerspiegelt 's
nachts de hemel, dus het is nu een koele blauwgrijze tint met lagere
dekking.

Eén hypothese sneuvelde onderweg, hier vastgelegd omdat de conclusie
nuttig is: de gracht werd na deze ronde 1,2 punt lichter, en de
verklaring leek een tone-mapping-verschil (een `MeshBasicMaterial` gaat
door tone mapping + exposure, de koepel-`ShaderMaterial` schrijft rauw
weg, dus dezelfde hexwaarde zou twee pixelwaarden kunnen geven).
`toneMapped: false` op de oever gaf echter **exact dezelfde getallen** —
de hypothese is dus weerlegd en de wijziging teruggedraaid in plaats van
als "principiële fix" te blijven staan. De oorzaak is niet verder
uitgezocht: het gaat om 1,2 helderheidspunt op een donkere zone, het
beeld is visueel naadloos en er is geen aanwijzing voor een fout.

**Derde feedback-ronde: donkerder buiten, licht dat door muren lekte, en
het ontsnappingsvaartuig.**

*De binnenplaats moest donkerder, maar alleen buiten de Stroomuitval.* De
gebruiker was expliciet: tijdens een lichtuitval-ronde klopte de
helderheid al, daarbuiten mocht het "een stuk donkerder". Dat is een
verzoek om de twee standen UIT ELKAAR te trekken, niet om alles te
dimmen. Uitgevoerd door de basisintensiteiten van de vier lantaarns,
beide maanlichten en de vulgloed nog eens ~25% te verlagen en
`BUITEN_STROOM_VLOER` evenredig te VERHOGEN (0,5 -> 0,667): het product
basis x vloer — de absolute helderheid tijdens een Stroomuitval — blijft
daardoor vrijwel gelijk (8,90 -> 8,41), terwijl de normale ronde
merkbaar donkerder werd. Tegelijk kregen de vloer-lichtvlekken een
radiale alpha-uitloop (gedeelde `LICHTVLEK_TEXTUUR`, zelfde truc als de
contactschaduw) i.p.v. een vlakke schijf met een harde rand, en een
STERKERE kern — de gebruiker vroeg om een donkerdere plaats waarin het
lichtpunt juist beter uitspringt.

*Licht dat door muren scheen.* Melding: lichtplassen op de
binnenplaatsklinkers zonder zichtbare bron. Oorzaak: een `PointLight` in
Three.js wordt niet door geometrie tegengehouden — alleen een
schaduwwerpende lamp doet dat, en daarvan is er per §10.2 maar één
(perf-invariant). Twee lampen reikten met hun `distance` dwars door de
buitenmuur: de gracht-lantaarn (bereik 13 m, staat 7,7 m van de
zuidmuur) en de bijkeukenlamp (bereik 10 m, staat 4 m van die muur). De
enige goedkope rem is het bereik zelf, dus `hangLamp()` kreeg een
`afstand`-optie en beide lampen een bereik dat net vóór de muur ophoudt.
De kelderhals-lamp is bewust ONgemoeid gelaten: die staat pal bij deur 3,
dus licht dat daar de binnenplaats op valt komt door de deuropening en
hoort er te zijn.

*Het ontsnappingsvaartuig, in vier iteraties.* De oude boot was een
liggende cilinder met een plankje — een boomstam. De weg naar het
eindresultaat is leerzaam genoeg om vast te leggen:
  1. Vervangen door een motorboot met een `ExtrudeGeometry`-romp (spitse
     boeg via twee quadratic curves). Beter, maar nog niet herkenbaar.
  2. De echte oorzaak bleek de ORIËNTATIE, niet het model: hij lag met de
     kop van de kade af, dus je keek vanaf het ontsnappingspunt recht op
     de spiegel — het minst leesbare aanzicht van een vaartuig.
  3. Op verzoek twee kandidaten naast elkaar gebouwd (RIB en jetski) en
     in het water vergeleken. De jetski won op herkenbaarheid: neus,
     stuur en zadel lezen ook in het donker, terwijl de donkere drijvers
     van de RIB tegen het water wegvielen. De RIB-code is daarna
     VERWIJDERD, niet uitgeschakeld — geen dode tweede variant.
  4. De hoek is gekozen uit een reeks van acht 45-graden-varianten
     (`BOOT_HOEK_DOK` = 315 gr).

Twee dingen die het meten zelf opleverde. Ten eerste: de eerste
inspectie-screenshots lieten de jetski helemaal niet op de aanlegplek
zien. `updateBootPositie()` draait in de altijd-lopende cosmetische
sectie en zette de boot elke frame terug naar zijn vertrekpositie, dus
een handmatige `position`-write vóór de screenshot werd meteen
overschreven — vandaar dat het vaartuig klein en uit het midden leek. De
juiste manier is het debug-hook-setter-pad (`ontsnappingsPunt` zetten),
zodat de functie zélf voor de aanlegplek kiest. Ten tweede: het
scheepslampje stond op emissie 1,8 en blies met de bloom-pass de vorm van
zo'n klein vaartuig volledig weg; terug naar 1,25 (midden in Bron, §10.5)
maakt het een baken zonder het voertuig te overstralen.

Tot slot vaart hij nu SCHUIN aan en draait hij in. `BOOT_VERTREK_Z` legt
een startpositie links in het water vast, zodat de route diagonaal loopt;
`updateBootPositie()` interpoleert daarnaast de koers tussen
`BOOT_HOEK_VAART` (225 gr, exact de richting van de route, dus vooruit
varend) en `BOOT_HOEK_DOK` (315 gr), waarbij het indraaien pas in de
laatste 35% van de route gebeurt. Zonder die interpolatie zou hij met een
vaste koers diagonaal wegschuiven — precies het zijwaartse "crabben" waar
de gebruiker eerder terecht over viel.

**Vierde feedback-ronde: de mist op de vlonder (`mistDekking()`).**

*"De mist ziet er raar uit als ik op het platform bij de jetski sta."*
Gereproduceerd met een geforceerd `FOG_MIST`-profiel vanaf het
gracht-standpunt, en het beeld was inderdaad kapot — maar de oorzaak zat
niet in de mist. Hij zat in een aanname die T111, T112 en T113 alle drie
onafhankelijk van elkaar hebben gemaakt, en die alleen bij het NORMALE
fog-profiel klopt.

Alles wat ver weg staat is namelijk bewust `fog: false`: de hemelkoepel
(T111), de drie skylinelagen én hun raampjes (T112/T113) en de verre
oever (T112). Dat is voor de normale fog precies goed — met `far` 24-40 m
zou een gefogde skyline op 40-45 m compleet oplossen in het niets, exact
wat T112 wilde vermijden. Maar tijdens een Mistgolf staat `far` op 9,35 m
en is de fogkleur (0x39443f) veel LICHTER dan de nachtscene. Het water is
een gewoon `MeshStandardMaterial` en wordt dus wél mistig: het verzadigt
over zijn volle 26 m naar die grijsgroene tint. De hemel, de silhouetten
en de oever erachter blijven ondertussen pikzwart. Resultaat: een vlakke,
lichte waterplaat met een keiharde, uitgesneden horizon erboven, en zwarte
panden die als gaten in de mistbank staan. Binnen valt dat niet op — daar
staat elke muur binnen 9,35 m — maar op de vlonder is het het enige wat je
ziet. De klacht wees dus feilloos naar de enige plek op de kaart waar deze
combinatie zichtbaar is.

De fix is één gedeelde maat in plaats van drie losse reparaties:
`mistDekking()` geeft 0 bij `FOG_NORMAAL`/`FOG_BUITEN`, 1 bij `FOG_MIST`,
en evenredig ertussenin. Bewust afgeleid uit de LIVE `scene.fog.far` en
niet uit een eigen timer: `mistUitfaseTimer` (T93) en `zoneFogTimer` (T93)
schrijven daar al in, dus elke bestaande blend loopt automatisch mee en er
is geen tweede staat die uit de pas kan lopen. Die maat gaat naar drie
plekken:

  - de koepel-shader krijgt `mistKleur`/`mistDekking` als uniforms en
    mengt zijn eindkleur ernaartoe. `mistKleur` volgt `scene.fog.color`
    en niet de `FOG_MIST`-constante — halverwege een uitfade hoort de
    koepel exact de tint van het gefogde water ervoor te hebben, anders
    is de naad er alsnog;
  - `updateVerteMist()` lerpt de vijf `fog:false`-materialen (drie
    skylinetinten, twee oevers) van hun basiskleur naar de fogkleur. Dat
    IS wat de fog-pass zelf zou doen; het verschil is dat wij de factor
    bepalen, zodat de normale fog het silhouet nog steeds niet aanvreet;
  - `updateSkylineRaampjes()` krijgt een `mistFactor` en dooft de
    raampjes mee — ze zijn `fog:false` en zouden anders als scherpe
    oranje stipjes dwars door een mistbank blijven prikken.

Bij `mistDekking() === 0` is elk van deze drie een exacte no-op, dus de
normale nacht en de T88-basislijn veranderen geen pixel — dat was de
voorwaarde om dit zonder hermeting te kunnen doen.

Eén detail dat pas uit het beeld bleek. De eerste versie mengde de hele
koepel volledig naar de misttint, en dan is het scherm over de volle
hoogte één vlakke kleur: dat leest als dagmist en haalt alle oriëntatie
weg. Een hoogtedemping (recht omhoog blijft 22% nacht staan) lost dat op,
maar moet pas BOVEN de skyline inzetten. Met de demping vanaf de horizon
werd de hemel daar ietsje minder gemist dan de volledig gemiste
silhouetten ervóór, en tekenden die zich af als LICHTERE vlekken — een
omkering die in echte mist niet bestaat. Vandaar `smoothstep(0.45, 0.95,
hoogte)`: tot ruim boven de hoogste gevel is de mix volledig.

`tests/test-verte-mist.mjs` (15 checks) dekt de maat zelf, de doorwerking
naar alle drie de soorten verte-objecten, het terugkeren naar de exacte
basiskleuren na een mistbeurt (geen drift), en met echte pixels vanaf de
vlonder dat de hemelband tijdens een Mistgolf oplicht in plaats van zwart
te blijven en dat de sprong over de horizon klein is.

### 10.14.1 Beslissing 90 — Declaratievolgorde: elke nieuwe cache vóór regel 833

**Het probleem, en waarom het deze ronde bijna zeker zou toeslaan.** Dit
project heeft een terugkerende bugklasse: een `const`/`let` die
textueel ná zijn eerste gebruik staat, terwijl dat gebruik tijdens
module-load draait. Het is al vier keer gebeurd (`PAND_ADRES`,
`lampLichten`, `autoHerladerGekocht`, `DOORGANG_MARGE`), elke keer met
een harde `ReferenceError` bij het laden.

Ronde 8 loopt er recht op af. Drie tickets introduceren een gedeelde
cache of helper die vanuit de wereldopbouw wordt aangeroepen:

| Ticket | Wat | Aangeroepen vanuit |
| --- | --- | --- |
| T91 | contactschaduw-textuur + gedeelde `PlaneGeometry` | `bouwTafel()`, `bouwLantaarn()`, decor-bouwers |
| T102 | subdivisie-helper | `bouwMuur()`, de vloer-/plafondblokken |
| T105 | afschuinings-geometriecache | `blok()`, `meubelBox()` |

En de bestaande declaratieposities zijn:

```
regel  689   const obstakels
regel  698   const materiaalCache        <- mat()
regel  759   const canvasTextuurCache    <- bouwCanvasTextuur()
regel  833   function blok()             <- eerste wereldopbouw begint hier
regel 1040   function bouwMuur()
regel 2780   function meubelBox()
regel 5500   const geoCache              <- geo(), pas NA de hele wereldopbouw
```

**T105 zoals oorspronkelijk beschreven ("gecachet zoals `geo()` dat
doet") crasht dus gegarandeerd**: `geoCache` staat op regel 5500 en
`blok()` draait vanaf 833. `geo()` is bruikbaar voor de
ondode-modellen (die worden pas tijdens een run aangemaakt), maar niet
voor wereldgeometrie.

**De regel voor deze ronde:**

> Elke nieuwe gedeelde cache, textuur of geometrie-helper die vanuit de
> wereldopbouw wordt aangeroepen, wordt gedeclareerd **vóór regel 833**,
> naast `materiaalCache` en `canvasTextuurCache` — met een comment dat
> uitlegt waarom hij daar staat, precies zoals `lampLichten` en
> `buitenLichten` dat al doen.

Dat is geen stijlvoorkeur maar de enige structurele verdediging tegen
deze bugklasse: de load-check vangt hem wel, maar pas nadat je het
ticket al hebt gebouwd.

### 10.14.2 Beslissing 91 — De performancepoort krijgt een procedure

**Het probleem.** §10.3 stelt dat frametijd niet betrouwbaar meetbaar is
in de testomgeving (SwiftShader-softwarerendering), en tegelijk gaten
T108 en T110 op "een echte GPU-meting". Zonder procedure is dat een
onafdwingbare poort — en er is precedent: **T79 was gegate op profiling
en is nooit uitgevoerd.** De ronde mikt bovendien expliciet op 60fps op
een gemiddelde laptop, en er was geen enkel ticket dat fps meet.

**De beslissing.** Twee lagen, want de automatische laag kan het niet
alleen.

**Laag 1 — machinaal, in elke regressierun.** T88 legt de proxies vast
die wél betrouwbaar zijn in SwiftShader: draw calls per frame,
driehoeken per frame, aantal shaderprogramma's, aantal texturen,
aantal lichten. Die getallen zijn resolutie- en hardware-onafhankelijk.
Ze meten geen fps, maar ze vangen wel de meeste manieren waarop je fps
verliest (een pass erbij, een materiaal dat niet deelt, een licht dat
erbij komt).

**Laag 2 — handmatig, met een vaste procedure, alleen bij de vier
tickets die fragmentwerk toevoegen (T96, T108, T110, en T107 voor
laadtijd).** De procedure staat vast zodat de meting herhaalbaar is:

1. `python3 -m http.server 8000` in de repo-root, spel openen in Chrome.
2. Speel tot golf 8 (of gebruik de debug-hook om 14 ondoden te spawnen).
3. Ga staan op het vastgelegde meetpunt in de startkamer, kijkrichting
   noord — hetzelfde punt dat T88 gebruikt.
4. Chrome DevTools → Performance → 10 seconden opnemen.
5. Noteer de **mediane** frametijd en het aantal frames boven 16,7 ms.
6. Herhaal met het ticket uitgeschakeld (zie beslissing 92).

**De afbreekdrempel, vooraf vastgelegd zodat hij niet achteraf wordt
opgerekt:** meer dan 10% van de frames boven 16,7 ms, of een mediane
frametijd die met meer dan 15% stijgt ten opzichte van dezelfde meting
zonder het ticket ⇒ het ticket gaat terug naar zijn lichte uitvoering.
Helpt dat niet, dan gaat hij uit.

**Wie meet.** Dit is de enige stap in de hele ronde die niet
geautomatiseerd kan worden en die de eigenaar op zijn eigen machine moet
doen. Dat hoort expliciet in de planning te staan, niet als voetnoot —
zonder die meting zijn T108 en T110 op goed vertrouwen gebouwd.

### 10.14.3 Beslissing 92 — Elke fragment-toevoeging krijgt een schakelaar

**Het probleem.** Deze ronde raakt een helderheidskalibratie die over
vier feedbackrondes is opgebouwd, en voegt fragmentwerk toe aan een
scene waarvan de framerate op doelhardware niet gemeten is. Als iets
achteraf te duur of te donker blijkt, is "het ticket terugdraaien" een
git-operatie die ook alle latere tickets meesleept.

**De beslissing.** Elk ticket dat per-fragment werk toevoegt of de
helderheid structureel verschuift, komt achter één benoemde constante te
staan die het effect volledig uitschakelt:

| Ticket | Schakelaar dekt |
| --- | --- |
| T96 | korrel + aberratie (de pass blijft, de termen worden 0) |
| T97 | vignet-sterkte |
| T98 | grading (identiteitsmatrix) |
| T100 | rimlight-sterkte |
| T103 | occlusiesterkte (0 = geen dimming) |
| T108 | `normalScale` (0 = platte oppervlakken) |
| T110 | kegel-opacity + aantal |

Dat maakt de handmatige meting uit beslissing 91 pas uitvoerbaar (je
kunt A/B meten zonder te herbouwen), het geeft de eigenaar een
smaakknop, en het maakt een probleem in golf 20 oplosbaar zonder de
ronde terug te draaien. De constanten horen bij elkaar te staan, niet
verspreid door het bestand.

Dit is geen instellingenmenu — dat is T115. Dit zijn constanten in de
broncode.

### 10.14.4 Beslissing 93 — Elk ticket levert een beeldverslag

**Het probleem.** Dit is een ronde waarin het resultaat per definitie
niet in tekst te vangen is. "De hoeken lopen zachter donker" en "de
lichtrand maakt het silhouet leesbaar" zijn beweringen die je moet
zíén om te kunnen beoordelen. Bij de vorige rondes kon een groene test
het werk grotendeels aantonen; hier kan dat niet — een test bewijst dat
de helderheid binnen de band bleef, niet dat het er beter uitziet.

Daar komt bij dat de eigenaar de enige is die kan beoordelen of een
ticket het beoogde beeld oplevert, en dat oordeel is de facto het enige
acceptatiecriterium dat over smaak gaat.

**De beslissing.** Elk ticket in deze ronde levert naast zijn testresultaat
een **beeldverslag**: minimaal één voor- en één na-opname vanaf een
vast, voor dát ticket relevant camerastandpunt.

**T88 levert de gereedschapskist.** De basislijntest bevriest al de
tijdafhankelijke systemen (flikker, `lampDipFactor`, `mistUitfaseTimer`,
`klok`) en kent al een vaste camerastand per zone. Datzelfde mechanisme
levert de beeldopnamen: `tests/maak-beeldverslag.mjs` produceert op
commando een genummerde set opnamen vanaf de vastgelegde standpunten.

Dat de opnamen uit de **bevroren** opstelling komen is essentieel. Twee
opnamen van een scene met een 11,2% flikkerswing (§10.4.1) verschillen
zichtbaar zonder dat er iets veranderd is — dan vergelijk je ruis en
concludeer je iets over je ticket. Bevriezen maakt voor/na-vergelijking
pas betekenisvol.

**Wat een beeldverslag moet tonen.** Niet "de scene", maar het punt
waar het ticket over gaat, van dichtbij genoeg om het te zien. Voor
hoekocclusie is dat een kamerhoek, niet een overzichtsbeeld. Voor de
mondingsvlam is het één frame tijdens een schot in de donkerste hoek van
de startkamer. Elk ticket in SONNET_EXECUTION_PLAN.md benoemt daarom
zijn eigen standpunt.

**Drie tickets tonen bewust géén verschil.** T89 (emissieve hiërarchie),
T102 (subdivisie) en T106 (wereldschaal-UV's) horen het beeld niet te
veranderen. Hun beeldverslag is het bewijs daarvan: twee opnamen die
identiek horen te zijn. Zichtbaar verschil betekent daar dat er iets
mis is — het beeldverslag is voor die drie dus een test, geen
illustratie.

**Waar ze blijven.** In een map buiten de repo-inhoud die ertoe doet
(bijvoorbeeld de scratchpad), of als bijlage bij de oplevering van het
ticket. Ze horen **niet** in de repository: het zijn tientallen PNG's per
ronde en ze hebben geen historische waarde zodra het volgende ticket
eroverheen bouwt.

### 10.14.5 Beslissing 94 — De ronde eindigt met een meting, niet met een ticket (T116)

**Het probleem.** De ronde is opgezet rond twee onbewezen aannames: dat
het spel na 28 tickets nog 60fps haalt op een gemiddelde laptop, en dat
de fillrate-analyse uit §10.3 klopt. Beide zijn gedurende de ronde
alleen per ticket getoetst, nooit als geheel. En dat geheel is wat de
speler krijgt.

Daarnaast is er een openstaande vraag die aan het begin van de ronde
bewust is geparkeerd: **laag 3 en laag 4 uit `VISUEEL.md` §3.3 zijn
grotendeels buiten scope gebleven**, deels op basis van een
kosteninschatting die gemaakt is vóórdat er ook maar iets gebouwd was.
Na 28 tickets is die inschatting achterhaald — in beide richtingen. Een
techniek kan duurder blijken dan gedacht, maar ook goedkoper, of
overbodig omdat een ander ticket het effect al levert.

**Wat er buiten de ronde is gebleven.** Uit laag 3 zijn B3 (normal maps,
T108), I1 (nachthemel, T111) en I2 (skyline, T112) alsnog naar binnen
gehaald. Wat overblijft:

| | Richting | Oorspronkelijke inschatting |
| --- | --- | --- |
| **Laag 3** | B6 — vuil en slijtage | nul rendertijd, vereist T103 |
| | C3 — vertex-jitter | nul rendertijd, vereist T102 |
| | F1 — hoogtemist | klein, gameplaygevoelig |
| | F4 — stof per zone | nul, maar pas zichtbaar mét T110 |
| | G3 — eventkleuren | nul bovenop T98 |
| | H3 — blijvende inslagen | klein |
| | E5 — dissolve bij de dood | klein-middel, raakt opruimcontract |
| **Laag 4** | A5 — gerichte `DirectionalLight` | mogelijk negatief; raakt §7.9 |
| | B5 — procedurele env map | middel-groot, onzeker effect |
| | D6 — tonemapping-curve | nul, raakt alle kalibratie |
| | F3 — regen en natte klinkers | middel |
| | F5 — mistslierten | groot in de piek |
| | G1 — volledige kleurmigratie | nul, grote doorlooptijd |

**De beslissing.** T116 is geen bouwticket maar een **meet- en
adviesticket**, en het is het enige ticket in de ronde met een document
als opleverproduct in plaats van code. Het doet drie dingen:

1. **Meet wat er staat.** De volledige procedure uit beslissing 91, maar
   dan op de eindtoestand: mediane frametijd en frames boven 16,7 ms,
   op alle vastgelegde standpunten, met 14 ondoden actief. Plus de
   rendermetrics uit T88 en een vergelijking met de nulmeting in §10.17.
2. **Beoordeelt hoe het speelt.** Een echte speelsessie tot voorbij golf
   10, met expliciete aandacht voor de vijf leesbaarheidsrisico's uit
   waarschuwing 72. Haperingen, stroboscoop-effecten, onleesbare
   momenten — dat zijn dingen die geen enkele test vangt.
3. **Herbeoordeelt laag 3 en 4** tegen de gemeten werkelijkheid in
   plaats van tegen de schatting vooraf.

**Waarom dit expliciet een apart ticket is en geen afsluitende
handeling.** De verleiding aan het eind van een lange ronde is om te
stoppen zodra het laatste bouwticket groen is. Dan blijft de vraag "haalt
dit 60fps?" onbeantwoord, precies zoals T79's profiling-poort nooit is
doorlopen. Een ticket met een eigen opleverproduct is moeilijker over te
slaan dan een voornemen.

### 10.15 De uitvoeringsvolgorde en waarom die zo ligt

29 tickets in tien fasen. De volgorde optimaliseert op vier dingen
tegelijk: afhankelijkheden eerst, vangrails vóór risico, tickets die
dezelfde code raken bij elkaar (één regressierun per codegebied), en
zichtbare winst vroeg.

| Fase | Tickets | Waarom hier |
| --- | --- | --- |
| **0. Vangrail** | T88 | Zonder basislijn is elke latere verschuiving onzichtbaar |
| **1. Directe winst** | T89, T90, T91, T92, T93, T94, T95 | Nul of lage afhankelijkheden, nul fragment-kosten, direct voelbaar |
| **2. De naverwerkingsketen** | T96, T97, T98 | T96 bouwt de pass; T97/T98 rijden er gratis op mee |
| **3. De vijand** | T99, T100, T101 | Eén codeblok (`maakOndodeModel()`), en T99 moet vóór T100 |
| **4. Ruimtelijke diepte** | T102, T103, T104, T105 | T102 is fundament voor T103; T103 legt `vertexColors` neer voor T104 |
| **5. Oppervlak** | T106, T107, T108 | Strikte keten: UV's → texturen → normals |
| **6. Licht als vorm** | T109, T110 | Goedkope statische versie vóór de dure volumetrische |
| **7. De wereld buiten** | T111, T112, T113 | Vereist T93 (fogdiepte) uit fase 1 |
| **8. Water** | T114 | Volledig zelfstandig, veilige afsluiter |
| **9. Toegankelijkheid** | T115 | Optioneel; vereist T92 en T96 |
| **10. Eindmeting** | T116 | Meet de eindtoestand en herbeoordeelt laag 3/4 |

**De harde afhankelijkheden, expliciet:**

- T88 vóór **alles** (het is de meetlat)
- T89 vóór T90, T110, T113 (emissieve hiërarchie)
- T93 vóór T111, T112 (zonder fogdiepte geen zichtbare verte)
- T96 vóór T97, T98 (de pass moet bestaan)
- T99 vóór T100 (fresnel op een verfijnd silhouet, niet op dozen)
- T102 vóór T103 (subdivisie vóór occlusie)
- T103 vóór T104 (`vertexColors` moet er al liggen)
- T106 vóór T107 vóór T108 (UV's → texturen → normals)
- T112 vóór T113 (raampjes zonder skyline bestaan niet)

**Waar je veilig kunt stoppen.** Na fase 1 staat er al een merkbaar
ander spel voor ongeveer twee weken werk, zonder dat er iets
onomkeerbaars is gebeurd. Na fase 4 staat de kern van de nieuwe
identiteit. Fase 5 is de grootste tijdsinvestering van de ronde en de
meest kunstzinnige; fase 6-9 zijn losse afsluiters.

**De omvang, eerlijk (correctie na review).** Dit hoofdstuk noemde
nergens de totale doorlooptijd, wat de ronde kleiner deed lijken dan hij
is. Bij elkaar opgeteld uit de per-ticket-schattingen:

| Fase | Tickets | Ruwe schatting |
| --- | --- | --- |
| 0 — Vangrail | 1 | 2-3 dagen |
| 1 — Directe winst | 7 | ~2 weken |
| 2 — Naverwerking | 3 | ~1 week |
| 3 — De vijand | 3 | ~1 week |
| 4 — Ruimtelijke diepte | 4 | 2-3 weken |
| 5 — Oppervlak | 3 | 2-4 weken |
| 6 — Licht als vorm | 2 | ~1 week |
| 7 — De wereld buiten | 3 | ~1 week |
| 8 — Water | 1 | 2-3 dagen |
| 9 — Toegankelijkheid | 1 | 2-3 dagen |
| 10 — Eindmeting | 1 | 2-3 dagen |
| **Totaal** | **29** | **~3 maanden** |

Dat is geen argument om het niet te doen — het is een argument om fase 1
als eerste mijlpaal te behandelen en pas daarna te besluiten of de rest
volgt. De schattingen voor fase 4 en 5 zijn bovendien het minst
betrouwbaar: dat is het werk waar "af" een kunstzinnig oordeel is en
niet een groene test.

### 10.16 Wat deze ronde bewust niet doet

- **De schaduw-wissel (A5).** Eén gerichte `DirectionalLight` in plaats
  van de huidige `PointLight`-cube-shadow is potentieel de grootste
  visuele sprong die dit spel kan maken, en waarschijnlijk **goedkoper**
  dan wat er nu staat: één shadow-pass in plaats van zes. §7.9.1 stelt
  bovendien zelf vast dat de huidige schaduw maximaal 12/255
  pixelverschil maakt — we betalen zes passes voor iets dat je niet
  ziet. Hij valt buiten deze ronde omdat hij een expliciet vastgelegde
  invariant raakt (§7.9), doorlekken tussen verdiepingen een reëel
  gevaar is (§7.5's geschiedenis met kelderlicht door de
  atelier-westmuur), en hij een eigen GPU-meting verdient. **Dit is de
  eerste kandidaat voor een volgende ronde.**
- **SSAO, raymarched mist, `Reflector`-water, env-map, regen,
  mistslierten, tonemapping-curve, volledige kleurmigratie.**
  Onderbouwing per stuk in `VISUEEL.md` §3.4.
- **Extra echte lichtbronnen, in welke vorm dan ook.** Invariant 2.
- **Doorschijnende ondode-silhouetten (E3).** Technisch goedkoop, maar
  het geeft de speler informatie die hij nu niet heeft. Dat is een
  ontwerpbeslissing, geen visuele — en een spel over ondoden in het
  donker leeft van niet-weten.
- ~~**Een instellingenmenu met visuele schakelaars.**~~ **Correctie na
  review:** dit stond hier als "buiten scope", terwijl T92 (camerawieg)
  en T96 (korrel) allebei in hun eigen tekst stelden dat er een
  schakelaar bij hoort — een tegenspraak binnen hetzelfde hoofdstuk.
  Opgelost door het als **T115** aan de ronde toe te voegen, achteraan
  en optioneel. De camerawieg is de doorslaggevende reden: die kan
  spelers fysiek onwel maken, en dan is een schakelaar geen luxe maar
  toegankelijkheid.

### 10.17 Nulmeting bij aanvang van deze ronde

Gemeten op commit `a4210a4`, headless Playwright met de lokale Chromium.
Vergelijkingsbasis voor de acceptatiecriteria van T88-T114.

| Meting | Waarde | Methode |
| --- | --- | --- |
| Regressiescripts groen | zie `run-all.mjs` | `node run-all.mjs` |
| Regels in `amsterdam-undead.html` | 9.384 | `wc -l` |
| Objecten in de scene-graph | 606 | `scene.traverse` |
| Meshes (leeg / 14 ondoden) | 523 / 653 | idem |
| Unieke geometrie-instanties | 482 / 489 | `Set` op identiteit |
| Unieke materialen | 285 / 361 | idem |
| Lichten totaal | 28 (1 hemisfeer + 27 point) | `isLight` |
| **Schaduwwerpende lichten** | **1** | invariant §7.9 |
| `castShadow`-meshes | 165 | `scene.traverse` |
| `receiveShadow`-meshes | 108 | idem |
| Transparante meshes | 80 | idem |
| Emissieve meshes | 64 | idem |
| Driehoeken in de scene-graph | 17.782 / 32.902 | idem |
| **Draw calls per frame (14 ondoden)** | **280** | `info.render` na `reset()` |
| **Driehoeken per frame** | **18.092** | idem |
| Shaderprogramma's | 13 | `info.programs.length` |
| GPU-geometrieën | 83 / 90 | `info.memory.geometries` |
| Texturen | 16 | `info.memory.textures` |
| Collision-obstakels | **56** | `obstakels.length` |
| Interactiepunten | 14 | `interactiePunten.length` |
| Post-processing-passes | 3 | `composer.passes.length` |
| Canvas-oppervlaktetexturen | 3 | `CANVAS_TEXTUUR_TEKENAARS` |
| Materiaalfamilies | 5 | `MATERIAAL_FAMILIES` |
| Frametijd | **niet betrouwbaar meetbaar** | SwiftShader (§8.11) |

**Wat door deze ronde mág veranderen:** meshes, geometrieën, materialen,
driehoeken, draw calls, texturen, shaderprogramma's, passes (3 → 4),
canvas-texturen (3 → ~8), regels.

**Wat gelijk moet blijven:** lichten (**28**), schaduwwerpende lichten
(**1**), collision-obstakels (**56**), interactiepunten (**14**), en elk
balansgetal uit §9.2.

### 10.18 Reviewverslag: wat er na het schrijven van dit hoofdstuk is gecorrigeerd

Dit hoofdstuk is in één keer geschreven en daarna kritisch nagelopen,
waarbij vier aannames zijn getest in plaats van beredeneerd. Drie ervan
bleken onjuist. Ze staan hier bij elkaar omdat de correcties verspreid
door §10 zijn doorgevoerd, en omdat een fout die je niet vastlegt
terugkomt.

**1. `vertexColors` zonder color-attribuut is zwart, niet wit
(§10.7).** Het hoofdstuk beval oorspronkelijk aan om `vertexColors`
globaal aan te zetten, met als onderbouwing dat een ontbrekend
color-attribuut zich "als wit, dus neutraal" gedraagt. Gemeten in r160
op een egaal belichte plane: **`false` ⇒ 244, `true` zonder attribuut
⇒ 0.** Een ongebonden vertex-attribuut levert `(0,0,0,1)` en dat
vermenigvuldigt de basiskleur weg. Het opvolgen van de oorspronkelijke
aanbeveling had elk vlak zonder color-attribuut pikzwart gemaakt — in
T103, het ticket dat als zwaartepunt van de ronde is aangewezen. De
aanbeveling is omgedraaid naar een aparte cache-tak.

**2. De flikker maakt een naïeve helderheidsband waardeloos
(§10.4.1).** Gemeten over 90 frames op één camerastandpunt: spreiding
**11,2%** (19,09 tot 21,36), afkomstig van de flikkersinussen in
`lampLichten` en `lampDipFactor`. T88 was gespecificeerd met "een band"
zonder die spreiding te kennen; een band die breed genoeg is om de
flikker te verdragen, vangt geen enkele realistische regressie. T88
moet de tijdafhankelijke systemen bevriezen vóór hij meet.

**3. Twee van de drie voor de hand liggende meetroutes leveren zwart of
leeg op (§10.4.1).** `preserveDrawingBuffer` staat op `false`.
`gl.readPixels()` buiten het rAF-venster geeft 0; `canvas.toDataURL()`
geeft een leeg beeld. `page.screenshot()` werkt wél. De oorspronkelijke
tekst noemde alleen "screenshot" en was daarmee toevallig goed, maar
zonder de val te benoemen waar een testschrijver vrijwel zeker in
loopt.

**4. Wat niet fout was maar wel te vaag (§10.7, §10.10, §10.14.1).**
Drie punten die bij nalezen niet uitvoerbaar bleken zoals opgeschreven:

- `obstakels` is 2D, telt 56 entries, bevat geen decor, en wordt
  *tijdens* het bouwen gevuld — de occlusie-bake van T103 moet dus een
  expliciete na-pass zijn, niet een berekening binnen `bouwMuur()`.
- T100 zou `onBeforeCompile` "in de materiaalfabriek" hangen, maar
  `maakOndodeModel()` maakt zijn materialen inline per instantie. Die
  fabriek bestaat niet en moet eerst gemaakt worden.
- T105 zou geometrie cachen "zoals `geo()` dat doet", maar `geoCache`
  staat op regel 5500 terwijl `blok()` vanaf regel 833 tijdens
  module-load draait. Dat is een gegarandeerde TDZ-crash, en precies de
  bugklasse die dit project al vier keer heeft geraakt. Vandaar de
  expliciete declaratievolgorde-regel in beslissing 90.

**5. Drie structurele gaten (beslissingen 91 en 92, en T115).** De ronde
mikte op 60fps zonder één ticket dat fps meet; de performancepoort was
onafdwingbaar (dezelfde val als T79, dat op profiling was gegate en
nooit is uitgevoerd); er was geen systematische terugvalstrategie; en
het hoofdstuk sprak zichzelf tegen over de instellingen-schakelaar. Alle
vier opgelost.

**Wat dit zegt over de methode.** De drie feitelijke fouten hadden één
ding gemeen: het waren claims over hoe Three.js of de testomgeving zich
gedraagt, opgeschreven vanuit redenering in plaats van meting. De
architectuurredenering zelf (welke richtingen passen, in welke volgorde,
tegen welk budget) hield wél stand. Voor een volgende ronde is de les
smal en concreet: **elke bewering over runtime-gedrag die een ticket
draagt, hoort gemeten te zijn vóór hij als beslissing wordt
opgeschreven** — niet omdat redeneren onbetrouwbaar is, maar omdat het
hier drie keer een claim opleverde die overtuigend klonk en fout was.

### 10.19 Implementatieverslagen T94 en T95 (Directe winst, uitgevoerd)

T94 en T95 staan zonder eigen beslissingsnummer in dit hoofdstuk (zie de
tabel in §10.15: beide vallen onder "Directe winst" — nul afhankelijkheden,
nul fragment-kosten). Ze zijn kleine, in zichzelf besloten
gevoel-verbeteringen op bestaand gedrag (respectievelijk de inslagen van
`schiet()` en de dood van een ondode), niet architecturale beslissingen
die een eigen §10.x rechtvaardigen. Dit verslag documenteert wat er is
gebouwd.

**T94 — Rijkere inslagen.** `spawnImpact(punt, kleur, aantal, normaal =
null)` kreeg een optioneel vierde argument. Zonder normaal (de bestaande
aanroep in `raakOndode()`, voor ondode-treffers) is het gedrag
byte-identiek aan vóór dit ticket — bewust, want "uit het oppervlak" is
geen betekenisvol concept voor een lichaamstreffer. Mét een normaal (de
wereld-raycast in `schiet()`, tegen muren/vloer/plafond) krijgen de
deeltjes een snelheidscomponent langs die normaal (`normaal * 1,5-3,0 +
spreiding`) en een langgerekte "vonk"-vorm (`scale(0,012, 0,012,
0,09+rand)`) via dezelfde lookAt-georiënteerde truc die `spawnTracer()`
al gebruikte. Een nieuwe `langgerekt`-vlag per actief effect laat
`updateEffecten()` de vonk ELK frame opnieuw op zijn (door zwaartekracht
kromme) baan richten, niet alleen bij het spawnen.

Een tweede, kleine pool (`rookPool`, `ROOK_MAX = 8`) geeft elke
wereld-inslag ook een korte (`ROOK_LEVENSDUUR = 0,4 s`) opzwellende
rookpluim: een camera-facing `PlaneGeometry` met een canvas-gegenereerde
radiale gradient-textuur (dezelfde canvas-textuurtechniek als eerdere
tickets), eenmalig `lookAt(camera.position)` bij het spawnen — bij zo'n
korte levensduur is een per-frame billboard-update de moeite niet waard.
`schiet()`'s wereld-treffer-tak berekent de wereldruimte-normaal via
`raak[0].face.normal` getransformeerd met `raak[0].object.matrixWorld`
(een nieuwe scratch-vector `_tmpVecNormaal`, naast de bestaande
`_tmpVecA/B/C` — geen allocatie in de hot path) en geeft die door aan
zowel `spawnImpact()` als de nieuwe `spawnRook()`.

`test-inslagen-rijker.mjs` (17 checks, nieuw) bevestigt: het
achterwaarts-compatibele gedrag zonder normaal, het directionele/
langgerekte gedrag mét normaal, de per-frame heroriëntatie, de volledige
rookpluim-levenscyclus, een ECHT schot op een muur dat beide effecten
met eindige (niet-NaN) snelheden spawnt, en een stress-test van 200
schoten die bevestigt dat `impactPool`/`rookPool`/`tracerPool` nooit
groeien.

**T95 — De kill als gebeurtenis.** Elke dodelijke treffer krijgt een
korte emissive flits op de ondode zelf plus een groter impact-burst, zodat
een kill een zichtbaar moment is in plaats van dat de ondode stilletjes
verdwijnt. Twee architecturale keuzes bepaalden waar de code moest komen:

1. **`ontploiBrander()`'s kettingreactie roept `doodOndode()` rechtstreeks
   aan**, bewust langs `raakOndode()` heen (geen speler-treffer, dus geen
   geld/kill-bonus voor een kettingkill). Dat betekent dat de
   flits/burst-logica in `doodOndode()` zelf moet zitten — niet in
   `raakOndode()` — anders zou een Brander-kettingreactie nooit een
   burst/flits krijgen.
2. **`maakOndodeModel()` maakt torso/bochel/buik/hoofd/arm-materialen
   allemaal per instantie** (`new THREE.MeshStandardMaterial(...)` per
   ondode), maar `kernMateriaal` (de Brander-kern) en de been-/
   vod-materialen (via de gedeelde `mat()`-cache) zijn dat expliciet
   NIET. Een nieuwe `delen.huidMaterialen`-array verzamelt alleen de
   per-instance materialen tijdens het bouwen (elke `.push()` direct na
   de materiaal-constructie, zie de vijf plekken in
   `maakOndodeModel()`) — `oogMateriaal` is bewust buiten deze lijst
   gehouden (die heeft al zijn eigen T89-Signaal-systeem; een tweede,
   overlappende control-laag daarop voegt niets toe).

`doodOndode(ondode, punt = null, kop = false)` kreeg twee nieuwe
parameters (`punt`/`kop` — bekend bij een speler-treffer via
`raakOndode()`, onbekend/`null`/`false` bij een Brander-kettingkill, dan
valt de burst terug op `ondode.groep.position`). De functie roept nu
altijd eerst `spawnKillBurst(punt ?? ondode.groep.position, kop)` aan
(vóór de Brander-early-return, dus ook een Branderdood krijgt zijn
burst), en flitst daarna — alleen voor niet-Branders — elk material in
`delen.huidMaterialen` naar `emissive = wit`, `emissiveIntensity =
KILL_FLITS_PIEK (3)`. Branders slaan de flits over: hun `groep` is al
bovenaan `doodOndode()` onvoorwaardelijk uit `ondodenGroep` verwijderd,
dus een material-flits zou toch niet renderen. De flits-timer
(`KILL_FLITS_DUUR = 0,15 s`) en de materiaal-referenties reizen mee in
de bestaande `stervenden`-entry en worden afgeteld in
`updateStervenden()`, ruim binnen de val-animatie (`STERVEN_DUUR`).

`raakOndode()`'s oude, onvoorwaardelijke `spawnImpact()`-aanroep aan het
eind is verplaatst naar uitsluitend de overlevende-treffer-tak — een
dodelijke treffer loopt nu via `doodOndode()`'s eigen, grotere burst, dus
een kill kreeg zonder deze verplaatsing TWEE bursts.

**Het samenvalvenster.** `spawnKillBurst()` degradeert de burst-grootte
van `KILL_BURST_AANTAL_GROOT` (10) naar `KILL_BURST_AANTAL_KLEIN` (4)
zodra `klok - laatsteKillBurstTijd < KILL_BURST_SAMENVAL_VENSTER` (0,06 s
— zelfde sjabloon en zelfde grootte-orde als de bestaande
`HITMARKER_SAMENVAL_VENSTER`). Zonder dit zou een Brander die vier
buren binnen bereik meesleurt in één synchrone kettingreactie in
potentie 5×10 = 50 deeltjes claimen uit een pool van 24 — met degradatie
wordt dat 10 + 4×4 = 26, nog steeds boven de poolgrootte, maar de
bestaande recycle-strategie in `pakEffectSlot()` (oudste actieve slot
hergebruiken i.p.v. een nieuw object alloceren) ving dat al af vóór dit
ticket; T95 verkleint alleen hoeveel er per keer wordt aangevraagd.

`test-hitmarker-audio.mjs` is uitgebreid (in plaats van een nieuw
bestand — de ticket-spec vroeg expliciet om het bestaande kill-/
hitmarker-testscript uit te breiden) met 12 nieuwe checks: de
structuur van de nieuwe constanten, dat één kill exact de vier
verwachte per-instance materialen (torso/hoofd/armL/armR bij een
neutraal-profiel "normaal"-ondode) naar `KILL_FLITS_PIEK` flitst terwijl
`kernMateriaal` daar nooit tussen zit, dat de flits binnen een handvol
`updateStervenden()`-ticks weer op 0 staat, dat twee kills vlak na
elkaar (buiten resp. binnen het venster) `GROOT` resp. `KLEIN`
opleveren, en — de scenario die het ticket zelf vroeg — een ECHTE
Brander-kettingreactie met vier slachtoffers binnen
`BRANDER_EXPLOSIE_RADIUS`: alle 5 sterven zonder fouten, `impactPool`
blijft exact zijn vaste grootte, de gezamenlijke burst-omvang blijft
ruim onder het "5× de volle burst"-scenario, en de Brander zelf slaat
de material-flits aantoonbaar over.

**Een niet-gerelateerde, maar door dit werk blootgelegde test-flake.**
`test-camerabeweging.mjs`'s schotenreeks-integratietest (§10.9) spawnt
een ondode recht vooruit zonder expliciete traits en verwacht dat een
kaarsrechte raycast 'm altijd raakt. `kiesOndodeTraits()` loot echter een
`lengte`-multiplier (0,9-1,12) die de HELE groep, inclusief hoofdhoogte,
schaalt — bij een ongelukkige (korte) worp zakt het hoofd ver genoeg
onder de camera-ooghoogte (1,7 m) dat de ray het net mist. Gemeten via
een geïsoleerde probe: bij een concrete worp stond het hoofd op
wereld-y 1,824 met een verticale straal van ~0,21 (RNG-afhankelijk),
ruim binnen de marge om te missen bij een kortere worp. Dit is
RNG-gedreven testflakiness in een T92-testbestand, losstaand van T93,
T94 of T95 zelf — maar hij blokkeerde de volledige-suite-validatie van
dit werk, dus is meteen gefixt: de test spawnt de ondode nu met
expliciete neutrale traits (`lengte: 1`, zelfde patroon als
`test-ondode-hitreacties.mjs`'s `NEUTRALE_TRAITS`), waarmee de treffer
deterministisch wordt.

Volledige regressiesuite ná T93+T94+T95 (en de bovenstaande testfix):
**66/66 groen, 0 FAIL.**

### 10.20 T116 — Eindmeting van ronde 8 (uitgevoerd)

Dit is het opleverproduct van T116 (beslissing 94): geen code, maar een
meting van de eindtoestand plus een herbeoordeling van laag 3 en 4 tegen
de gemeten werkelijkheid. Gemeten met `tests/meet-eindtoestand.mjs`,
hetzelfde harnas (headless Playwright, lokale Chromium, bevroren T88-
standpunten) als de nulmeting in §10.17.

**Laag 1 — machinaal. Nulmeting → eindtoestand.**

| Meting | Nulmeting (§10.17) | Eindtoestand | Verschil |
| --- | --- | --- | --- |
| Regels in `amsterdam-undead.html` | 9.384 | **12.450** | +33% |
| Objecten in de scene-graph | 606 | **798** | +32% |
| Meshes (leeg / 14 ondoden) | 523 / 653 | **674 / 852** | +29% / +30% |
| Unieke geometrie-instanties | 482 / 489 | **616 / 625** | +28% |
| Unieke materialen | 285 / 361 | **365 / 489** | +28% / +35% |
| Lichten totaal | 28 | **28** | **gelijk (invariant)** |
| Schaduwwerpende lichten | 1 | **1** | **gelijk (invariant)** |
| `castShadow`-meshes | 165 | **179** | +8% |
| `receiveShadow`-meshes | 108 | **114** | +6% |
| Transparante meshes | 80 | **159** | +99% |
| Emissieve meshes | 64 | **64 / 92** | gelijk (leeg) |
| Driehoeken in de scene-graph | 17.782 / 32.902 | **41.176 / 56.364** | +132% / +71% |
| **Draw calls per frame (woonkamer)** | **280** | **627** | **+124%** |
| **Driehoeken per frame (woonkamer)** | **18.092** | **50.147** | **+177%** |
| Shaderprogramma's | 13 | **33** | +154% |
| GPU-geometrieën | 83 / 90 | **549** | +510% |
| Texturen | 16 | **27** | +69% |
| Collision-obstakels | 56 | **56** | **gelijk (invariant)** |
| Interactiepunten | 14 | **14** | **gelijk (invariant)** |
| Post-processing-passes | 3 | **4** | +1 (voorzien) |
| Canvas-oppervlaktetexturen | 3 | **5** | voorzien was ~8 |
| Materiaalfamilies | 5 | **6** | +1 |

**Alle vier de harde invarianten staan.** 28 lichten, 1 schaduwwerper, 56
obstakels, 14 interactiepunten — precies de vier getallen die §10.17
"moeten gelijk blijven" noemt. De volledige regressiesuite is groen
(**81/81 scripts**, `test-visuele-basislijn.mjs` 65/65; `test-golf-variatielimiter.mjs` viel één keer om op zijn bekende RNG-gevoeligheid en was groen bij de ingebouwde herkansing én bij drie losse herhalingen).

Draw calls en driehoeken per frame, per standpunt (eindtoestand):

| Standpunt | Draw calls | Driehoeken |
| --- | --- | --- |
| woonkamer | 627 | 50.147 |
| bijkeuken | 586 | 47.119 |
| gang | 458 | 35.283 |
| atelier | 273 | 25.457 |
| binnenplaats | 273 | 25.833 |
| vliering | 264 | 28.068 |
| gracht | 197 | 27.221 |
| kelder | 187 | 23.368 |

**Wat opvalt, en wat het betekent.**

*De grootste stijging zit niet waar §10.3 hem verwachtte.* Dat hoofdstuk
stelt dat deze ronde **fragment-bound** is: het scherm wordt zes tot acht
keer per pixel beschreven, en geometrie zou het probleem niet zijn.
Gemeten is de fragmentkant inderdaad beheerst gebleven (één pass erbij,
3 → 4, exact zoals gepland), maar de **geometriekant is meer dan
verdubbeld**: 280 → 627 draw calls en 18k → 50k driehoeken per frame in
de zwaarste kamer. Dat is geen weerlegging van de fillrate-analyse — het
is een tweede kostenpost die het hoofdstuk niet had voorzien.

*De oorzaak is bekend en per ticket herleidbaar.* T102 (subdivisie) en
T103 (hoekocclusie) vermenigvuldigen driehoeken per muurvlak; T105
(afgeschuinde randen) en T104 (kleurtint per mesh) breken geometrie- en
materiaaldeling op; T112/T113 voegen losse verre objecten toe. Dat is
zichtbaar in het cijfer dat er het hardst uitspringt: **GPU-geometrieën
83 → 549**. Elke gesubdivideerde muur, elk afgeschuind meubel en elke
per-mesh getinte plank is een eigen buffer geworden.

*Het T113-precedent geldt breder dan T113.* Three.js doet
frustum-culling maar **geen occlusion-culling**. Dat werd bij T113
ontdekt (raampjes die je niet kunt zien tellen tóch mee als draw call) en
verklaart ook waarom de woonkamer met 627 calls de duurste kamer is: die
kijkt langs de hele gang naar het atelier én heeft de skyline in de
kegel. Wie hier verder wil optimaliseren, moet daar beginnen — niet bij
het aantal driehoeken.

*Wat de 14 ondoden kosten, is met dit harnas niet gemeten.* Ze zitten wél
in de scene (+178 meshes, +15k driehoeken in de graaf), maar de draw
calls per standpunt zijn met en zonder ondoden **identiek**: de acht
bevroren T88-standpunten kijken geen van alle naar een spawnvenster, dus
er valt er nooit één in de camerakegel. Dat is een echte beperking van
deze meting en hoort niet weggeschreven te worden — de kosten van veertien
ondoden ín beeld zijn onbekend.

**Laag 2 — handmatig, staat nog open.** De frametijdmeting uit beslissing
91 (`python3 -m http.server 8000`, spelen tot golf 8, DevTools →
Performance → 10 s opnemen, mediane frametijd + frames boven 16,7 ms
noteren) kan in deze omgeving **niet** worden gedaan: de testomgeving
draait op SwiftShader-softwarerendering, waar frametijd betekenisloos is
(§8.11/§10.3). Dit is de enige stap in de hele ronde die de eigenaar op
eigen hardware moet uitvoeren, en gezien de +124% draw calls hierboven is
het geen formaliteit meer maar de belangrijkste openstaande vraag van de
ronde. Het meetpunt met de hoogste kans op een probleem is de
**woonkamer, kijkrichting noord** — hetzelfde punt dat T88 gebruikt.

**Herbeoordeling van laag 3 en 4** (beslissing 94, punt 3), tegen de
gemeten werkelijkheid in plaats van de schatting vooraf:

| | Richting | Oordeel na meting |
| --- | --- | --- |
| **Laag 3** | B6 — vuil en slijtage | **Nog steeds goede prijs.** Werkt via de bestaande vertexkleur-laag van T103, kost geen draw calls en geen fragmentwerk. Beste eerstvolgende kandidaat. |
| | C3 — vertex-jitter | **Duurder dan gedacht.** "Nul rendertijd" klopt, maar hij breekt geometriedeling verder op — en dát is precies de as die deze ronde met 510% is gestegen. Alleen doen op geometrie die tóch al uniek is. |
| | F1 — hoogtemist | **Aantrekkelijker geworden.** De verte-mistkoppeling (`mistDekking()`, vierde feedback-ronde) heeft de infrastructuur al gelegd: één gedeelde maat die koepel, silhouetten en oever aanstuurt. Hoogtemist erop is nu een kleinere stap dan de oorspronkelijke schatting. |
| | F4 — stof per zone | **Onveranderd klein**, maar voegt losse transparante quads toe — en transparante meshes zijn al met 99% gestegen. Klein houden. |
| | G3 — eventkleuren | **Onveranderd goedkoop.** Zit volledig in de bestaande T98-gradingmatrix, nul extra objecten. |
| | H3 — blijvende inslagen | **Afgeraden zonder harde limiet.** Elke blijvende inslag is een draw call die nooit meer weggaat, in een scene die al op 627 zit. Alleen met een strikte pool en hergebruik. |
| | E5 — dissolve bij de dood | **Onveranderd.** Raakt het opruimcontract (T70); dat contract staat en is getest, dus het risico is kleiner dan vooraf ingeschat. |
| **Laag 4** | A5 — gerichte `DirectionalLight` | **Sterker aan te raden dan vooraf.** De meting bevestigt de aanname onder §7.9.1: er is nog steeds precies 1 schaduwwerper met een cube-shadow (6 passes) en 179 `castShadow`-meshes. Eén gerichte lamp is één pass — bij de nu gemeten geometrie-omvang is dat een grotere besparing dan toen de analyse werd geschreven. |
| | B5 — procedurele env map | **Blijft onzeker.** Geen nieuw bewijs in beide richtingen. |
| | D6 — tonemapping-curve | **Afgeraden.** Nul rendertijd, maar de hele helderheidskalibratie is inmiddels over vijf feedbackrondes met pixelmetingen vastgelegd; dit zou álles opnieuw moeten worden gemeten. |
| | F3 — regen en natte klinkers | **Onveranderd middel.** |
| | F5 — mistslierten | **Afgeraden in de piek.** De scene is fragment-bound én inmiddels ook geometrie-zwaar; dit is het duurste item uit de hele lijst. De vierde feedback-ronde heeft bovendien juist de goedkope route gekozen (de bestaande fog koppelen aan de verte) en die ziet er goed uit. |
| | G1 — volledige kleurmigratie | **Onveranderd: nul rendertijd, grote doorlooptijd.** |

**Aanbeveling.** Niet meteen doorbouwen. Eerst laag 2 draaien op echte
hardware; als de woonkamer daar 60fps haalt, is B6 de beste volgende
stap en A5 de grootste. Haalt hij het niet, dan wijst de meting de weg:
de winst zit in dedupliceren van geometrie (T104/T105 terugschroeven op
objecten waar de variatie toch niet opvalt) en in het beperken van wat er
in de camerakegel valt, niet in minder fragmentwerk.

### 10.21 B6 — Vuil, aanslag en slijtage (uitgevoerd)

Het eerste ticket ná de T116-eindmeting, en gekozen op grond van die meting:
§10.20 wees B6 aan als de beste prijs-kwaliteitverhouding uit laag 3, omdat
het meelift op de vertexkleur-laag die T103 al heeft gelegd.

**Wat het doet.** Drie lagen vuil, alle drie als modulatie van het
`color`-attribuut dat T103 op elk groot bouwkundig vlak aanmaakt:

1. een **aanslagband** waar de muur de vloer raakt (30% donkerder pal op de
   vloerlijn, uitdovend over 1,15 m);
2. een zwakkere **naadschaduw** langs het plafond (9%, 0,5 m);
3. **grofschalige vuilvlekken** uit een deterministisch ruisveld op
   wereldcoördinaten, met een periode van 2,6 m — bewust groter dan de
   baksteentextuur uit T107.

Plus een tintverschuiving die met het vuil meeschaalt: boven de grond naar
vuilbruin (minder blauw), in de kelder naar vochtig groen (minder rood).
Alles is multiplicatief en nooit lichter dan 1, dus de emissiehiërarchie uit
T89 blijft ongemoeid.

**Twee bewuste afwijkingen van de VISUEEL-spec.**

*Vertexkleur in plaats van een tweede canvas-textuur.* VISUEEL stelt laag (3)
voor als een "grofgeschaalde vuilkaart uit canvas-noise". Dat is hier een
vertexkleur-veld geworden, en de reden staat in §10.20: de as die deze ronde
uit de hand liep is geometrie en geheugen (GPU-geometrieën 83 → 549, texturen
16 → 27), niet fragmentwerk. Een extra textuurkanaal per materiaalfamilie
kost een tweede sample per fragment én meer texturen; dit kost nul van
allebei. De prijs is resolutie: met `SUBDIVISIE_SEGMENTEN = 8` ligt er
ongeveer één vertex per meter, dus dit veld kan variatie op meterschaal en
geen scherpe vlekranden.

*Geen vochtstreep onder de dakramen, geen sleetplek rond de deurgrepen.* Om
diezelfde reden. Beide zijn detail van 10-30 cm; op een raster van een meter
worden dat vage vegen van een halve muur breed. Ze horen bij een textuur- of
decal-oplossing en zijn dus geen onderdeel van dit ticket — dat is een
inperking van de spec, geen omissie.

**Wat het bouwen zelf corrigeerde, en waarom dat hier staat.**

*De eerste versie was een dimming, geen vlekkenpatroon.* Waarde-ruis ligt
symmetrisch rond 0,5, dus `sterkte × ruis` geeft élke vertex ongeveer een
halve dosis vuil. Het resultaat was een pand dat overal een paar procent
donkerder was en nergens vuil — de slechtst denkbare uitkomst, want het kost
de volle basislijnverschuiving zonder één zichtbare vlek. Opgelost met een
contrastvenster (`VUIL_VLEK_DREMPEL_VAN/TOT`, 0,52-0,92): de onderste helft
van het ruisbereik blijft volledig schoon, alleen de bovenste staart wordt
vuil. `test-vuil-slijtage.mjs` bewaakt dat expliciet — meer dan een kwart van
de bemonsterde wereld moet exact 0 vuil hebben.

*De kelder had helemaal geen vertexkleuren.* Bij het testen bleek dat er nul
muren met een vuil-markering onder de grond stonden. Oorzaak: `kelderWand()`
bouwde een kale `BoxGeometry` zonder subdivisie — de enige muren in het pand
zonder. Dat was al een stil gat in T103 (de randocclusie is daar nooit
geland; op 8 hoekpunten kán dat ook niet) en B6 zou het overerven. Omdat de
spec van B6 de kelderwanden expliciet noemt, is dat binnen dit ticket
gerepareerd: `kelderWand()` gebruikt nu `muurSegmenten()` +
`bakMuurOcclusie()` + de vertexkleur-tweeling, net als `bouwMuur()`.

*De kelder-tint werd op de verkeerde vertex getoetst.* "Is dit de kelder"
stond eerst op `maxY < -0.5`, maar een keldermuur staat op -3,3 en reikt tot
ongeveer -0,1 — de hele kelder viel dus buiten de vochtige tint. Nu op
`minY`, en de beslissing valt per geometrie, niet per vertex.

**De hoisting-val, en dat beslissing 90 werkt.** Het blok staat vlak achter
de T103-bakfuncties (~regel 2100), ruim vóór `VLIERING_Y` (~2330) en
`KELDER_DIEPTE` (~2700). De vloerniveaus stonden er eerst als
`const VUIL_VLOERNIVEAUS = [0, -KELDER_DIEPTE, VLIERING_Y]` — dat is precies
de `ReferenceError`-bugklasse die dit project al vier keer heeft gehad. Nu
een functie (`vuilVloerNiveaus()`), die pas bij de aanroep leest.

**Twee testverwachtingen bijgewerkt.** `test-hoekocclusie.mjs` had een
harde invariant "elke gebakken occlusie-vertexkleur is grijswaarde" die de
HELE `wereld` traverseerde — en dat was tot dit ticket ook waar. B6
verlegt die invariant bewust (vuil is per definitie een kleurverschuiving),
dus de test toetst nu `bakMuurOcclusie()`/`bakVlakOcclusie()` in isolatie,
op een verse `blok()`/`vlak()`-aanroep die na de eenmalige vuil-pass wordt
gedaan en dus nooit vuil krijgt. De volledige "wereld is consistent vuil"-
garantie staat in `test-vuil-slijtage.mjs` zelf.

**De meting.** Draw calls in alle acht de T88-standpunten **exact
ongewijzigd** (627/458/273/273/586/187/264/197) — dat is de kernclaim en hij
houdt. Driehoeken stijgen met 2,4k-3,7k per standpunt, volledig uit de negen
nu gesubdivideerde keldermuren, niet uit het vuil. Helderheid daalt 0,6% tot
3,4% per zone; de kelder het meest (-3,4% gemiddeld, -8,2% mediaan), en ook
dat komt van de gerepareerde occlusie. Gracht en vliering bewegen geen
duizendste — daar staat geen vuil-gemarkeerd vlak in beeld, wat bevestigt dat
de pass alleen raakt wat hij hoort te raken.

**Waar de pass draait, en waarom daar.** Op de laatste regel van de
wereldopbouw, vóór STAP 3. Hij leest WERELDposities, dus hij moet na de
laatste `wereld.add()` draaien: alleen zo krijgen twee identiek gebouwde
muren een verschillend vuilpatroon, en alleen zo is te zien of een muur
werkelijk op een vloer staat. Muren die dat niet doen — de vulmuren boven de
deuropeningen, die per definitie zweven — vallen daardoor automatisch buiten
de aanslagband, zonder dat hun bouwcode iets van B6 hoeft te weten.

### 10.22 Twee kleine feedback-fixes: het deur3-gat en het watervlak rond de vlonder

**Fix 1 — de deur naar de bijkeuken was net niet hoog genoeg.** Klopte
letterlijk: het deurgat in de binnenplaats-zuidmuur is `ZUIDMUUR_HOOGTE`
(2,25 m) hoog, maar `deur3Mesh` is bewust 0,2 m korter dan zijn kozijn —
dezelfde "past net in de opening"-marge als elke andere deur in dit pand.
Zonder lintel bleef die 0,2 m er ONgevuld, en daar keek de speler zo de
onverlichte kelderhals in. Dat las als een gat in de muur, niet als een
deuropening. Opgelost met dezelfde `bouwVulMuur()` die de gang-lintel
(T87-fix) al gebruikt: een strook van 2,05 m tot 2,25 m, breedte
`DEUR3_HALF*2`, kleur `GANG_PLEISTER` (de zuidmuur zelf is met die kleur
gebouwd, niet met de `bouwVulMuur()`-default `BAKSTEEN`).

**Fix 2 — geen water rond de vlonder tijdens de mistgolf.** Ook terecht,
en het was structureel, niet mist-specifiek — de mistgolf maakte het
alleen zichtbaar. De steiger (`vlonderMesh`) is een smal dek van 4,5 x
2 m (x ∈ [15, 19,5], z ∈ [-1, 1]); het watervlak begon pas bij
`VLONDER_X_OOST` (19,5), dus alleen recht VOOR de steiger. Naast het dek
— zelfde x-bereik, maar |z| > 1 — lag helemaal niets: geen vloer, geen
water. In de normale fog (far 24 m) viel dat niet op, want de
hemelkoepel se `kleurGrond` vult zo'n gat op afstand onopvallend op. De
mistgolf (far 9,35 m) trekt de zichtbaarheid zo dichtbij dat de speler
precies op die grens komt te staan.

Een steiger heeft in het echt water rondom én eronder, dus de fix is de
westrand van het watervlak te verleggen naar `VLONDER_X_WEST` (15) —
exact waar de overdekte gang ophoudt, dat stuk blijft terecht droog. De
oostrand (`WATER_VLAK_OOST`, 45,5, waar Fix A's verre oever op aansluit)
verschuift bewust NIET mee: die naad stond al goed. Het dek zelf blijft
op y=0,02 boven het water (y=-0,05) uitsteken — dit is puur een correcte
dekking eronder/ernaast, geen wijziging aan de steiger.

Eén ding gecontroleerd voordat dit als veilig gold: de boot-deining
(`bootGroep.position.y/rotation.z` in `updateWaterAnimatie()`) leest
`golfHoogte(bootGroep.position.x - VLONDER_X_OOST, ...)` — een vaste
constante, niet `waterMesh.position.x`. Het verschuiven van het watervlak
raakt die berekening dus op geen enkele manier; alleen het zichtbare
oppervlak zelf werd breder.

`test-gracht-dock.mjs` had een expliciete check dat de westrand van het
water op `VLONDER_X_OOST` lag — een vroegere, bewuste beslissing die deze
fix nu ongedaan maakt. Bijgewerkt naar de nieuwe (en correctere) eis: de
westrand op `VLONDER_X_WEST`, de oostrand ongewijzigd op
`WATER_VLAK_OOST`.

## 11. Ronde 9 (v0.23) — Zombie V2-architectuur

### 11.1 Scope en aanleiding

Waar ronde 8 de wereld herzag, herziet deze ronde de ondode zelf.
`SONNET_EXECUTION_PLAN.md` opende ronde 9 met een diagnose die niet uit
een bugmelding kwam maar uit de structuur zelf: `maakOndodeModel()` (nu
`maakOndodeModelV1()`) bouwde elke ondode op uit tot 13 losse
`THREE.Mesh`-objecten, elk met een eigen materiaalinstantie en een eigen
`THREE.Group`-pivot voor animatie — tot 11 materiaalinstanties, 13
raycast-doelen en 20 transformnodes per ondode, terwijl T69's gedeelde
`geoCache` de geometrie al wél deelde. Bij `effectiefMaxActief()`'s
praktische piek van 18 ondoden is dat tot 234 losse draw calls die
uitsluitend uit ÉÉN vijandtype voortkomen.

Het plan koos een parallelle-bouw-strategie in plaats van een rewrite ter
plekke: V2 (één samengestelde `SkinnedMesh` + botskelet) werd naast V1
gebouwd achter een module-toggle (`ZOMBIE_RENDER_VERSIE`), fase voor fase
tot pariteit, gemeten tegen een expliciete V1-baseline (T117,
`ZOMBIE_V2_BASELINE.md`), en pas na een eigen eindrapport (T127) en een
speeltest door de eigenaar ter beoordeling voorgelegd. T129 — het
onderwerp van dit hoofdstuk se slotparagraaf — is de daadwerkelijke,
onomkeerbare stap: V1 verwijderen en V2 tot de enige architectuur maken.
Net als ronde 7 en 8 verandert geen enkel ticket in deze ronde een
gameplaygetal — dit is uitsluitend hoe de ondode gebouwd en getekend
wordt, nooit hoe hij zich gedraagt.

### 11.2 De architectuur

Eén ondode is nu:

- **Eén `SkinnedMesh`** met één samengestelde `BufferGeometry`
  (`bouwOndodeGeometrieV2()`) die romp, armen, benen, hoofd en (voor de
  Sjouwer) een bochel in dezelfde vertex-buffer samenvoegt, plus
  `skinIndex`/`skinWeight`-attributen voor de skinning en een
  `color`-attribuut voor per-deel-helderheid (het "multiplicatieve
  vertex-color-model": de per-instance huidkleur wordt vermenigvuldigd
  met een per-vertex factor, niet met een tweede materiaal).
- **Eén `THREE.Skeleton`, PLAT** — elk bot (`root`, `pelvis`, `romp`,
  `chest`, `hoofd`, `beenL`/`beenR`, `armL`/`armR`) hangt rechtstreeks
  aan `root`, geen kinematische ouder-kind-keten zoals V1's
  Group-hiërarchie. Omdat `THREE.Bone` een `Object3D`-subklasse is,
  werken de bestaande `delen.armL.rotation.x = …`-schrijfacties uit
  `updateOndoden()`/`raakOndode()`/`doodOndode()`/`schiet()` gewoon tegen
  een bot — dat is de kernarchitectuurtruc en de reden dat geen van die
  functies zelf iets van bones hoefde te weten.
- **Eén materiaalinstantie** per ondode (`maakOndodeMateriaal()`), met de
  T100-rimlight-injectie via `onBeforeCompile` —§7.9's
  materiaal-mutatiediscipline (injectie hoort in de fabriek, nooit
  achteraf op een instantie) gold dus al vóór dit hoofdstuk en bleef
  ongewijzigd staan.
- **Vaste, onzichtbare hitbox-proxies** (`HITBOX_KOP_STRAAL = 0,18`,
  losse lichaam-proxy) op een eigen `ONDODE_HITBOX_LAYER`, gescheiden van
  de zichtbare mesh se `ONDODE_MESH_LAYER` — `schiet()` raycast tegen de
  proxies, nooit tegen de zichtbare geometrie. Twee raycast-doelen per
  ondode in plaats van V1's dertien, en de headshot-straal (0,18) is
  bewust identiek aan V1's vroegere zichtbare hoofd-mesh, dus geen
  balansverschuiving.
- **Eén erkende uitzondering**: de Brander se gloeiende kern blijft een
  losse mesh (2 draw calls voor dat type), omdat `raakOndode()` de kern
  onafhankelijk van de romp moet kunnen opschalen voor de kernpuls — een
  regio binnen één `SkinnedMesh` staat dat niet toe.

Vorm en houding zijn expliciet gesplitst: **vorm** (rompbreedte, bochel,
buik, arm-dikte/-lengte, ontbrekende arm) is een GEOMETRIE-parameter en
moet vóór het samenvoegen van de `BufferGeometry` vaststaan; **houding**
(kromme rug, ingedoken kop, slepend been, scheve nek) is een
BOT-transform die pas ná `skinnedMesh.bind()` gezet mag worden, omdat
`bind()` de dan geldende botstanden vastlegt als rustpose — alles wat
ervóór op een bot gezet wordt is per definitie onzichtbaar. `delen.
vormParams` bewaart de toegepaste vormparameters expliciet voor
toetsbaarheid, omdat een bounding box door de ARMEN bepaald wordt, niet
door de romp, en dus geen betrouwbare torsobreedte-meting oplevert.

### 11.3 Hoe de fasering liep (T118–T128)

Volledige cijfers, per-fase tabellen en de A/B-metingen staan in
`ZOMBIE_V2_BASELINE.md` (opgeleverd door T117/T127/T129); hier de
samenvatting van de beslissingen die de architectuur bepaald hebben:

- **T118 (fundament).** SkinnedMesh + plat skelet + de
  `ZOMBIE_RENDER_VERSIE`-toggle. Structuur meteen naar 3 meshes/2
  materialen (tegenover V1's 11-13/tot 11).
- **T119 (animatie).** Pelvis-/chest-sway en -bob, gedreven door
  dezelfde `loopFase`-sinus als de bestaande been-/armzwaai (geen nieuwe
  klok), met een vaste faseverschuiving voor de chest.
- **T120 (hitdetectie).** De onzichtbare hitbox-proxies en de
  layer-scheiding tussen raycast-doel en zichtbare mesh, getest over een
  matrix van zes bewegingsstaten (rust, loopcyclus, kromme rug,
  aanval-windup, flinch, sterven).
- **T121 (anatomie/triangle-budget).** Twee kandidaat-detailniveaus echt
  gebouwd, gefotografeerd en pixel-vergeleken op close-up ÉN
  speelafstand; `midden` verdubbelde het budget voor 0,11% zichtbaar
  verschil op speelafstand en is afgewezen. Gekozen: `laag` (~2.320
  driehoeken/ondode), met `zetZombieV2Detail('midden')` als schakelbare
  achterdeur voor later.
- **T122 (1-draw-call-belofte).** De ogen verhuisden van twee losse
  meshes naar een emissieve fragment-shader-regio; `delen.oogMateriaal`
  werd een facade-object met alleen een levende `emissiveIntensity`-
  property, zodat het bestaande T31-oogcontract ongewijzigd bleef
  werken zonder dat de callers ooit wisten dat het geen echt
  `THREE.Material` meer is.
- **T123 (normal map).** Eén A/B-meting (huidplooien met/zonder
  hoogtekaart), teruggedraaid van de eerste versie (horizontale
  "zwachtel"-banden door de cilindrische UV) naar willekeurig
  georiënteerde plooien op sterkte 0,28 — structureel: één gedeelde
  textuur, nul extra draw calls, nul extra driehoeken.
- **T124–T126 (types/profielen).** `ONDODE_TYPES[..].vorm` en
  `VARIATIE_PROFIELEN` verwerkt op de V2-basis, met dezelfde brondata en
  formules als V1, alleen anders toegepast (bochel als vertexregio i.p.v.
  losse mesh; Sluiper-oogleesbaarheid via de regiogrootte, niet via
  `emissiveIntensity`, om niet in conflict te komen met de per-tick
  gameplay-state die die waarde stuurt).
- **T127 (eindrapport, "meten niet aannemen").** Zeven scenario's
  paarsgewijs gemeten (`meet-zombie-v2-benchmark.mjs`, inmiddels
  verwijderd — zie §11.4). Resultaat: 25–41% minder draw calls in elk
  scenario met meerdere ondoden, 85% minder raycast-doelen (13 → 2),
  tegenover 11–21% meer driehoeken; geen geheugenlek in 60 spawn/kill-
  cycli op beide versies; `ONDODE_TYPES` diff-bevestigd onaangeraakt.
  Conclusie: V2 kan V1 vervangen, met één voorbehoud — frametijd is in
  headless SwiftShader niet meetbaar (§10.3/§8.11), dus moest de
  eigenaar de F3-overlay (T117) zelf in een echte browser draaien vóór
  T129 de onomkeerbare stap zet.
- **Speeltest-fixes (na T127, vóór T129).** Na een echte speelsessie
  meldde de eigenaar dat V2 merkbaar houteriger bewoog dan V1 en dat de
  T123-huidtextuur als mummie las in plaats van zombie. Beide zijn
  onderzocht en gefixt zonder V1 aan te raken (volledige onderbouwing in
  `ZOMBIE_V2_BASELINE.md`): de romp-bob/-twist bereikte via
  skin-weight-demping maar een band van 6 cm van torso, gefixt door
  pelvis/chest dezelfde offset als romp te geven; de armen kregen
  daardoor zichtbaar loshangende schouders, gefixt door ze chest se
  sway/bob/twist te laten spiegelen; het schoudergewricht bleek ook
  STATISCH te klein (0,058 tegenover een deltoïde van 0,067) en trok los
  tijdens de swing, vergroot naar 0,085/0,080; de huidtextuur kreeg
  grotere onregelmatige necroseplekken en een sterkte van 0,28 → 0,4,
  plus een echte kleurverschuiving via vertex-color-rottingsvlekken; en
  de loopcyclus kreeg een knie-illusie (`beenL/R.scale.y` verkort tijdens
  de zwaaihelft) plus dezelfde illusie kruislings op de armen.

### 11.4 Beslissing 95 (T129) — V1 verwijderen: V2 wordt de enige architectuur

Dit is de onomkeerbare stap die T127's rapport aankondigde en die
uitdrukkelijk een aparte, expliciete opdracht van de eigenaar vereiste
bovenop het groene licht uit T127/T128 — geen ticket in deze ronde mag
zichzelf de vrijheid geven om V1 te slopen. Die opdracht is gegeven ná de
speeltest-fixes in §11.3.

**Wat verdween.** `maakOndodeModelV1()` (de complete, ~225 regels tellende
per-body-part-Group-bouwer), de `ZOMBIE_RENDER_VERSIE`-moduleconstante en
zijn laadtijd-override (`ZOMBIE_VERSIE_OVERRIDE`,
`window.__AMSTERDAM_UNDEAD_ZOMBIE_VERSIE__`), `zetZombieRenderVersie()`,
en de twee V1-EXCLUSIEVE geometrie-/materiaalhulpen die nergens anders
gebruikt werden: `VOD_MATERIAAL` en `bouwGerafeldeVodGeometry()` (de
vodrand-mesh — V2 heeft, en had, geen vod; dat blijft een bewust
geaccepteerd verschil, geen nieuwe schuld). `spawnOndode()` bouwt nu
onvoorwaardelijk `maakOndodeModelV2(typeInfo, traits)`.

**Wat uitdrukkelijk NIET veranderde.** De ticketopdracht was scherp: "niets
aan V2 zelf — dit ticket ruimt uitsluitend V1 op." Een paar plekken die
door de opruiming permanent "dood-waar" werden — zoals
`maakOndodeMateriaal()`'s `if (oogUniforms && ZOMBIE_V2_NORMAL_MAP)`, en
elke `if (delen.pelvis)`/`if (delen.chest)`-guard in `updateOndoden()`/
`raakOndode()` die ooit ook een V1-pad moest overslaan — zijn bewust
ongemoeid gelaten. Het opruimen van permanent-ware voorwaarden is een
aparte, kleinere herstructurering die dit ticket niet claimt.

**Twee tools die met V1 verdwenen.** `meet-zombie-v2-benchmark.mjs` en
`maak-zombie-beeldverslag.mjs` bestonden uitsluitend om V1 en V2
paarsgewijs te vergelijken (T123/T127) — zonder V1 kunnen ze niet meer
draaien en zijn ze verwijderd, niet aangepast. `meet-normalmap-ab.mjs`
(de A/B tussen wél/geen normal map) bleef, met alleen de overbodig
geworden `zetZombieRenderVersie()`-aanroepen eruit: die vergelijking
gaat niet over V1/V2 en blijft zinvol.

**Testsuite.** Elk regressiebestand dat tegen de toggle of tegen V1's
mesh-structuur testte is bijgewerkt naar de enige overgebleven
werkelijkheid: `test-ondode-model-v2.mjs`, `test-stadsarchief.mjs`,
`test-hitmarker-audio.mjs`, `test-ondode-vormen.mjs`,
`test-ondode-animatie.mjs`, `test-ondode-hitreacties.mjs`,
`test-ondode-model.mjs` (de V1-only hitbox-/silhouet-secties die tegen
inmiddels-verwijderde `geoCache`-sleutels als `'schouder'`/`'vodGerafeld'`
testten zijn vervallen, niet vervangen — die geometrie bestaat niet meer,
op geen enkele versie), `test-varianten.mjs` en `test-rimlight.mjs` (waar
`VOD_MATERIAAL` als los controlepunt verdween en de
`oogMateriaal`-injectie-check een guard kreeg voor V2's facade-object,
dat — anders dan een echt `THREE.Material` — geen `onBeforeCompile`
draagt). `tests/helpers.mjs` verloor de bijbehorende
`AMSTERDAM_UNDEAD_ZOMBIE_VERSIE`-omgevingsvariabele-hook.

**Resultaat.** Functioneel en visueel identiek aan de laatst goedgekeurde
V2-staat uit T127/de speeltest-fixes — dit ticket verplaatst geen enkele
pixel, het verwijdert alleen het pad dat toch al niet meer gekozen werd.
