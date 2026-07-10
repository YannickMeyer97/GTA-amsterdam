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
