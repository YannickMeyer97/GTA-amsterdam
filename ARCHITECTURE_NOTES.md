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

#### 7.5.3 Kelderinhoud (beslissing 56)

De kelder krijgt een klein, eigen setje decor/interactie passend bij
het Amsterdamse-grachtenhuis-thema (bv. een wijnrek, kratten, een
tweede munitie- of upgradepunt) — geen nieuwe gameplaymechaniek, puur
ruimtelijke/visuele verrijking plus optioneel één bestaand
interactiepunt-type (zoals een bestaand koop/upgrade-punt) herplaatst
in de nieuwe ruimte. Geen nieuwe itemtypes in dit ticket.

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
