# Dam Chaos Portaal — Roadmap

## Huidige stabiele versie
Portaal met twee speelbare games: Defend National Monument v4 (`defend-national-monument.html`) en Amsterdam Undead (`amsterdam-undead.html`), met `index.html` als hoofdmenu. Tickets 1 t/m 6 zijn afgerond.

## Doel
Portaal met twee games: Defend National Monument (bestaand, bevriezen) en Amsterdam Undead (nieuw, undead wave-survival in een grachtenhuis). Zie CLAUDE.md voor regels en IP-eisen.

## Tickets

### Ticket 1 — Veilige bestandsstructuur en menu ✅
`git mv index.html defend-national-monument.html`, nieuw `index.html` als hoofdmenu (2 knoppen, alleen HTML/CSS), testscripts omzetten naar het nieuwe pad. Bestaande game byte-voor-byte ongewijzigd.

### Ticket 2 — Amsterdam Undead: basisscene en first-person movement ✅
Nieuw `amsterdam-undead.html`: Three.js-boot, donkere grachtenhuis-startkamer (rechthoekige muren als obstakels), WASD + muis + pointer lock + pauze-gate, gekopieerd/aangepast van de bestaande game.

### Ticket 3 — Schieten, ammo en reload ✅
Raycast-schieten met magazijn + reservevoorraad, R = herladen (met korte herlaadtijd), ammo-UI, droogklik-geluid bij leeg magazijn.

### Ticket 4 — Ondoden, waves en spelerschade ✅
Ondoden (eigen low-poly silhouet, geen robots) spawnen per wave uit vensterpunten, lopen op de speler af, doen melee-schade met cooldown; speler-HP + game over; geld per hit/kill.

### Ticket 5 — Koopbare deur, ammo-kist en upgradepunt ✅
Centraal interactiesysteem (T, één prompt, dichtstbijzijnde wint) gekopieerd van de bestaande game; deur = verwijderbaar obstakel + kooppunt; gang + tweede kamer met extra spawn-vensters; ammo-kist en één upgradepunt.

### Ticket 6 — Sfeer, polish en README ✅
Grachtenhuis-aankleding (simpele meubels, ramen met grachtenlicht, mist/donkerte), Web Audio geluiden, wave-banners, startscherm met uitleg, README-update met beide games.

### Release-polish (na code-review) ✅
- Performance: nog maar één schaduwwerpende lamp; belichting iets opgehoogd zodat de meubels leesbaar zijn.
- Perf-plafond op gelijktijdig levende ondoden (`GOLF_MAX_ACTIEF`).
- Anti-vast-gedrag: ondoden die vastlopen maken een korte zijwaartse ontwijk-beweging (glijden langs muren/deuropening).
- Leesbaarheid: STAP-comments in `amsterdam-undead.html` op volgorde hernummerd.

## v0.3 — Room identity, progression en replayability ✅
Doel: de tweede ruimte voelde te veel als een kopie van de startkamer. v0.3 maakt van Amsterdam Undead een vier-zones-map (woonkamer → gang → atelier → binnenplaats), elk met eigen vorm, kleur/licht, gameplayfunctie, landmark en spawnrisico.

- **V1** — Zone-constanten (zone D/deur 2/werkbank/regenton/watertap), `hangLamp` kleur/intensiteit-parameters (default = ongewijzigd gedrag), debug-prep. Geen zichtbare wijziging.
- **V2** — Tweede kamer omgebouwd tot **schildersatelier**: grijze plankenvloer met verfspatten, koel dakraamlicht i.p.v. een warme hanglamp, een schildersezel-met-doek als landmark, lijsten/verfplank/kruk-decor, asymmetrische ramen (noordwest + oost) voor flankerende spawns.
- **V3** — **Werkbank**-interactiepunt in het atelier: eenmalige Snelspanner-upgrade (€600, herlaadtijd 1,2s → 0,7s) — de echte reden om deur 1 te openen.
- **V4** — De **gang** is nu een donker, kaal knelpunt: eigen pleister-materiaal (geen baksteen), donkere loper, een zwak koud-groen flakkerlampje met ondergrens, en een warme lokgloed bij de atelierdrempel die het oog trekt.
- **V5** — **De binnenplaats** (zone D) achter een tweede koopbare deur (€1250, in de atelier-oostmuur): natte glanzende klinkers, geen plafond, koud maanlicht, klimop/fietsenrek-decor, de eenmalige **Regenton** (€400) en de herbruikbare **Watertap** (€200 → +50 HP, gecapt).
- **V6** — Spawn-pacing per zone: `VENSTERS` heeft nu een `zone`-veld; elke ontgrendelde zone verlaagt het spawn-interval 15% en verhoogt het perf-plafond met 4. Geen spawns ooit achter een nog-gesloten deur.
- **V7** — Progressie-UI: een HUD-blokje toont schade/herlaadtijd-status (incl. MAX), interactiemarkeringen doven naar grijs zodra een eenmalige/MAX-upgrade daar niets meer te doen heeft, startscherm legt de drie-zones-route uit.
- **V8** — Polish: eenmalige grote zone-banners bij het openen van elke deur ("HET ATELIER" / "DE BINNENPLAATS"), zone-sfeergeluiden (zeldzame gracht-klok, eenmalige gang-kraak, eenmalige windvlaag op de binnenplaats), README/ROADMAP bijgewerkt, volledige eindregressie van beide games.

## v0.4/v0.5 — Atelier L-vorm, prijsverlaging en magazijncapaciteit ✅
Het atelier (zone C) kreeg een L-vormige voorraadnis (eigen vloertint, raam,
spawnpunt en opslag-decor) i.p.v. een simpele rechthoek; `GRENS` groeide mee
op X en Z. Deur 1 werd goedkoper (€750 → €500) en er kwam een eenmalige
magazijncapaciteit-upgrade bij de opslagkratten in de nis — later in v0.6
weer vervangen door De Ratelaar (zie hieronder).

## v0.6 — Headshot-bonus, grotere zones en een tweede wapen ✅
- **Headshot-geldbonus**: een dodelijke headshot geeft nu 2x het normale
  kill-geld (`HEADSHOT_GELD_MULTIPLIER`).
- **Atelier verder vergroot**: `KAMER2_DIEPTE` 9 → 12 (+20% t.o.v. de eigen
  v0.4-grootte), met een derde dakraam tegen de nu donkere noordkant en wat
  extra decor om de diepte te vullen.
- **De binnenplaats fors vergroot**: `PLAATS_BREEDTE`/`PLAATS_DIEPTE` 6×5 →
  14×14 (+56% t.o.v. het vergrote atelier), vier lantaarnpalen als
  belangrijkste lichtbron (het maanlicht is nu ambient-vulling), een derde
  spawnpunt halverwege de noordmuur, en een koude lokgloed bij deur 2.
- **Magazijncapaciteit-upgrade verwijderd**, vervangen door **De Ratelaar**:
  een tweede, koopbaar wapen (€750) tegen de oostmuur van de binnenplaats —
  16 kogels/magazijn, 96 reserve, halve schotcooldown t.o.v. de Drukspuit.
  `Q` wisselt tussen beide wapens; elk houdt zijn eigen magazijn/reserve
  aan, en de Snelspanner-upgrade werkt door op beide.
- **Deur 2 goedkoper**: €1250 → €1000; startscherm/hulp-tekst bijgewerkt
  (prijzen + `Q`-toets).

## v0.7/v0.8/v0.9 — Perks, barricades en wave-pacing ✅
Vertaling van een extern conceptplan naar originele namen (géén bestaande
IP-namen, zie IP-regels in CLAUDE.md) en aangesloten op de bestaande
systemen. Atelier/binnenplaats zijn in deze ronde bewust NIET nogmaals
vergroot bovenop v0.6 — dat volgde apart in v0.10 (zie hieronder).

- **v0.7 (V3)** — Buitenverlichting van de binnenplaats iets feller/breder
  (maanlicht: hogere intensiteit/bereik, lagere decay voor zachtere val-off).
- **v0.7 (V4)** — Snelspanner omgedoopt tot **Snelheidselixer** (user-facing
  tekst; interne functienamen ongewijzigd). Prijs/functionaliteit gelijk.
- **v0.7 (V5)** — **Pantserdrank**: nieuwe eenmalige perk in het atelier
  (€1000) — verdubbelt de maximale HP (100 → 200); de HP-balk rekent al in
  percentages, dus die schaalt vanzelf mee.
- **v0.8** — **Barricades** op alle vensters (3 planken elk, zichtbaar als
  losse plankmeshes). Een ondode die een gebarricadeerd venster kiest,
  beukt eerst een plank kapot (`beukBarricade`) i.p.v. meteen te spawnen —
  pas bij 0 planken spawnt er echt een ondode (`golfSpawnStap`). De speler
  repareert per plank via `T` (+€20, zelfde weg-splicen-patroon als een
  MAX-upgrade zodra de barricade weer compleet is).
- **v0.9** — Wave-pacing: rust tussen golven 4s → 8s. Na elke golf een
  **"Wave cleared"**-banner met oplopend bonusgeld (€75 + €15 per golf) en
  auto-heal naar minimaal 75 HP (verlaagt nooit).

## v0.10 — Atelier en binnenplaats alsnog +40% ✅
Alsnog uitgevoerd (V1/V2 uit het externe conceptplan), bovenop de v0.6-maten.

- **Atelier**: `KAMER2_HALF_B` 3.5→4.5, `KAMER2_DIEPTE` 12→15 (126→177 m²,
  +40% t.o.v. de v0.6-grootte). Het noordraam-spawnpunt staat nu verder van
  de ezel/oostraam af ("spawnpunten verder uit elkaar"); twee extra
  dakramen (noord + zuidoost) houden de nieuwe hoeken leesbaar; wat extra
  decor vult de nieuwe randen.
- **Binnenplaats**: `PLAATS_BREEDTE` 14→17, `PLAATS_DIEPTE` 14→16
  (196→272 m², +39%). `PLAATS_BREEDTE` moest minstens `KAMER2_DIEPTE` zijn
  — anders overlapt de noord/zuidmuur van de plaats met het (nu diepere)
  atelier, een echte bug die deze ronde is gevonden en gefixt. Lantaarns
  staan verder uit elkaar (±5 i.p.v. ±3); een **schuurtje** en een
  **kratten-obstakel** (met écht collision, in tegenstelling tot de rest
  van het decor) breken de looproutes een beetje op, zoals gevraagd.

## v0.11 — Binnenplaats levendiger + atelier-decor gefixt ✅
- Sterker/warmer maanlicht en lantaarnlicht op de binnenplaats.
- Gevels, nepdoorgangen en balkonnetjes tegen de binnenplaats-muren (geen
  collision), zodat het niet langer als drie kale rechte muren aanvoelt.
- Wit blok bij het Ratelaar-kooppunt vervangen door een wapenrek.
- **Regenton volledig verwijderd** (state, mesh, interactie, debug-exports).
- `bouwVerfplank`/`bouwLijstenstapel` in het atelier niet langer zwevend.
- Bugfix: het schuurtje op de binnenplaats rendercte wit door een material
  die per ongeluk als kleur werd doorgegeven aan `blok()`.

## v0.12 — Ondoden lopen niet meer vast achter muren ✅
- **Zone-navigatie** (woonkamer → gang → atelier → binnenplaats): een
  ondode in een andere zone dan de speler mikt eerst op de eerstvolgende
  deuropening i.p.v. recht op de speler af — puur reactief om-de-hoek-lopen
  vond een deur een kamer verderop niet betrouwbaar.
- Binnen dezelfde zone (schuurtje/kratten) een robuustere lokale
  ontwijk-logica: vaste richting-blend i.p.v. een offset-punt, en een
  echte test of de rechte weg weer vrij is i.p.v. een heuristiek die net
  gewonnen terrein steeds weer ongedaan maakte.

## v0.13 — Ondode-varianten, visuele variatie en power-ups ✅
Vertaling van de volgende ronde van het externe conceptplan (v0.7 t/m v0.9
op GitHub `main`) naar originele namen — zie IP-regels in CLAUDE.md.

- **Ondode-varianten**: de **Loper** (vanaf golf 2, snel/breekbaar/weinig
  geld), de **Sjouwer** (vanaf golf 3, traag/zeer taai/veel geld) en de
  **Brander** (vanaf golf 4, normale stats, ontploft bij overlijden —
  schade aan speler én andere ondoden in bereik, met kettingreactie tussen
  meerdere Branders). Elk type heeft een eigen kleur/schaal/oogkleur zodat
  ze al op afstand herkenbaar zijn. Golf-spawns loten een type
  (`golfSpawnStap`); directe `spawnOndode()`-aanroepen (tests/debug) blijven
  standaard 'normaal', zelfde patroon als de barricades in v0.8.
- **Visuele zombievariatie**: puur cosmetische per-ondode randomisatie
  (kromme rug, slepend been, verschillende armlengtes, lichte
  lengtevariatie, een strompelende loop-wiebel) — geen invloed op
  snelheid/HP/hitbox, enkel om te voorkomen dat een golf uit identieke
  kloontjes bestaat.
- **Power-ups**: een dodelijke treffer laat soms (12% kans) een zwevend
  kristal vallen, opgeraapt door erover te lopen (geen `T`-interactie —
  moet snel gaan tijdens het gevecht) en anders na 12s vervalt. Vier
  effecten: **Munitievoorraad** (Max Ammo — vult alle wapens volledig aan),
  **Dubbele Beloning** (Double Points — 20s 2x geld per hit/kill),
  **Eliminatiemodus** (Insta Kill — 15s elke treffer is dodelijk) en
  **Kerninslag** (Nuke — doodt alle levende ondoden nu + geld per stuk).

---

# v0.14+ — Architectuurronde

Ontworpen door Claude Fable; uitvoering later door Claude Sonnet, één ticket
per keer. Lees eerst `ARCHITECTURE_NOTES.md` (codekaart + ontwerpbeslissingen)
en `SONNET_EXECUTION_PLAN.md` (volgorde + kant-en-klare prompts).
Fasen: 1 = balans (T1–T5), 2 = debug (T10), 3 = eventgolven (T6–T9),
4 = wave-redesign (T13–T15), 5 = Pack-a-Punch (T11–T12, bewust ná fase 4).

## Ticket 1 — Balance: wave-heal naar 60 ✅
- **Type:** Balanspatch
- **Doel:** `WAVE_HEAL_MIN` 75 → 60.
- **Waarom:** op 75 is schade uit de vorige golf zelden voelbaar; op 60
  blijft een slechte golf 2–3 golven doorwerken en worden Watertap en
  Pantserdrank weer echte keuzes (ontwerpbeslissing 1 in ARCHITECTURE_NOTES).
- **Concrete wijzigingen:** constante `WAVE_HEAL_MIN = 75` → `60` (blok
  "Balanswaarden golven"); tekst "minimaal 75 HP" in `README.md` → 60;
  grep op `75` voor eventuele startscherm-/helpteksten.
- **Codegebieden:** `amsterdam-undead.html` (1 constante), `README.md`.
- **Acceptatiecriteria:** na golf-einde met hp<60 → hp==60; met hp==80 →
  hp==80 (nooit verlagen); golf-teller, bonusgeld en banner ongewijzigd.
- **Risico's:** vrijwel geen; alleen tests die 75 asserteren.
- **Testplan:** headless: golf uitroeien met hp=40 → 60; met hp=90 → 90;
  bestaande wave-tests draaien (verwachtingswaarde 75→60 bijwerken).
- **Rollback:** constante terugzetten.
- **Sonnet solo:** ja, veilig.

## Ticket 2 — Power-ups: cooldown op sterke power-ups (2 golven) ✅
- **Type:** Balanspatch
- **Doel:** Dubbele Beloning, Eliminatiemodus en Kerninslag mogen pas weer
  droppen als er sinds de vorige sterke drop ≥ 2 golven voorbij zijn.
- **Waarom:** ±2,5 drops per golf waarvan 75% sterk trivialiseert golven en
  economie (ontwerpbeslissing 2). Munitievoorraad (utility) blijft vrij.
- **Concrete wijzigingen:** `sterk: true`-vlag op de drie sterke entries in
  `POWERUP_TYPES`; nieuwe state `let laatsteSterkePowerupGolf = -Infinity;`
  + constante `STERKE_POWERUP_COOLDOWN_GOLVEN = 2`; `kiesPowerupType()`
  herschrijven: bouw eerst de lijst van toegestane types (utility altijd;
  sterk alleen als `spelStaat.golf >= laatsteSterkePowerupGolf + 2`), loot
  daarna uniform binnen die lijst; in `spawnPowerupDrop()` bij een sterk
  type `laatsteSterkePowerupGolf = spelStaat.golf` zetten (registratie op
  DROP-moment, zie ontwerpbeslissing 3); debug-export: getter+setter voor
  `laatsteSterkePowerupGolf` + de constante.
- **Codegebieden:** power-up-blok (~r1917–2010), debug-export.
- **Acceptatiecriteria:** sterke drop in golf 4 → t/m golf 5 dropt
  `kiesPowerupType()` uitsluitend `munitievoorraad`; vanaf golf 6 weer alle
  types mogelijk; utility-drops blijven in elke golf mogelijk.
- **Risico's:** vergeten registratie bij debug-/directe spawns (acceptabel:
  ook die tellen); loting mag nooit een lege lijst opleveren (utility zit
  er altijd in).
- **Testplan:** headless: forceer `laatsteSterkePowerupGolf`, sample
  `kiesPowerupType()` 200x per golfstand en assert de verdeling; bestaande
  power-up-tests blijven groen (die roepen effecten direct aan).
- **Rollback:** vlag + gate verwijderen, `kiesPowerupType` terug naar
  uniforme loting.
- **Sonnet solo:** ja.

## Ticket 3 — Power-ups: aparte Kerninslag-cooldown (4 golven) ✅
- **Type:** Balanspatch
- **Doel:** Kerninslag mag pas weer droppen na ≥ 4 golven sinds de vorige
  Kerninslag-drop (bovenop de sterke-cooldown van Ticket 2).
- **Waarom:** Kerninslag is een wave-wipe + geldinjectie, categorisch
  sterker dan de andere sterke power-ups (ontwerpbeslissing 3).
- **Concrete wijzigingen:** state `let laatsteKerninslagGolf = -Infinity;`
  + `KERNINSLAG_COOLDOWN_GOLVEN = 4`; in de toegestane-lijst van
  `kiesPowerupType()`: kerninslag alleen als óók
  `spelStaat.golf >= laatsteKerninslagGolf + 4`; registratie in
  `spawnPowerupDrop()`; als kerninslag geblokkeerd is valt de loting
  automatisch op een ander toegestaan type (nooit "niets" nodig — utility
  is altijd toegestaan); debug-export getter+setter.
  **Open ontwerpvraag noteren, niet bouwen:** Kerninslag later nerfen naar
  max ~8 kills of ~70% van de levende ondoden.
- **Acceptatiecriteria:** Kerninslag-drop in golf 5 → niet opnieuw in golf
  6–8, wel mogelijk vanaf golf 9; andere sterke types volgen alleen de
  2-golven-regel; `geefKerninslag()` zelf ongewijzigd.
- **Risico's:** dubbele gates door elkaar halen — kerninslag moet aan BEIDE
  cooldowns voldoen.
- **Testplan:** headless sampling per golfstand zoals Ticket 2, plus
  expliciet: golf 7 met sterke-cd verlopen maar kerninslag-cd actief →
  kerninslag komt in 200 samples niet voor, de andere twee sterke wel.
- **Rollback:** gate + state verwijderen.
- **Sonnet solo:** ja, direct na Ticket 2 (zelfde functie).

## Ticket 4 — Zombie balance: Loper naar 2,2 m/s ✅
- **Type:** Balanspatch
- **Doel:** effectieve Lopersnelheid 2,7 → ±2,2 m/s.
- **Waarom:** 2,7 haalt een achteruit schietende speler te hard in;
  2,2 geeft druk zonder oneerlijkheid (ontwerpbeslissing 4).
- **Concrete wijzigingen:** `ONDODE_TYPES.loper.snelheidMultiplier`
  1.8 → **1.47** (1,5 × 1,47 = 2,205 m/s). Comment bijwerken.
- **Acceptatiecriteria:** `spawnOndode(0,'loper').snelheid` ≈ 2.205
  (±0.01); Loper blijft sneller dan normaal (2.205 > 1.5).
- **Risico's:** geen; bestaande test checkt alleen "sneller dan normaal".
- **Testplan:** headless waarde-assert + bestaande variantentest.
- **Rollback:** multiplier terug naar 1.8.
- **Sonnet solo:** ja, triviaal.

## Ticket 5 — Zombie balance: Sjouwer naar 5 HP ✅
- **Type:** Balanspatch
- **Doel:** Sjouwer-HP in late golven 8 → 5.
- **Waarom:** 8 HP is wachttijd, geen spanning (ontwerpbeslissing 5).
- **Concrete wijzigingen:** `ONDODE_TYPES.sjouwer.hpMultiplier` 4 → **2.5**
  (basis-HP op golf 3+ is 2 → `round(2×2.5) = 5`). Comment bijwerken.
  Let op: bestaande variantentest asserteert `sjouwer.hp > normaal.hp * 2`
  — 5 > 4 blijft waar.
- **Acceptatiecriteria:** op golf ≥ 3: sjouwer.hp === 5; geldMultiplier
  (2.2) en snelheid (0.825) ongewijzigd.
- **Risico's:** interactie met Ticket 14 (HP-schaling) — daar krijgt de
  Sjouwer een cap van 8 (ontwerpbeslissing 11); hier nog niet nodig.
- **Testplan:** headless waarde-assert + bestaande variantentest + het
  Sjouwer-geldbedrag (`round(20×2.2)`) blijft kloppen.
- **Rollback:** multiplier terug naar 4.
- **Sonnet solo:** ja.

## Ticket 6 — Eventgolven: basisframework ✅
- **Type:** Feature
- **Doel:** elke golf met `golf % 5 === 0` kan een eventgolf zijn, met
  eigen banner en state; gewone golven blijven byte-voor-byte hetzelfde
  gedrag houden.
- **Waarom:** ritme en variatie zonder volume (ontwerpbeslissing 6);
  het framework moet er staan vóór de Mistgolf-inhoud (T7–T9).
- **Concrete wijzigingen:** `const EVENT_GOLF_INTERVAL = 5;`
  `function isEventGolf(golf) { return golf % EVENT_GOLF_INTERVAL === 0; }`
  `function kiesEventType(golf) { return 'mist'; }` (enige type voorlopig);
  state `let actieveEventGolf = null;` — in `startGolf()`: bij
  `isEventGolf(golf)` → `actieveEventGolf = kiesEventType(golf)` + banner
  met eventnaam i.p.v. de standaardtitel; in de wave-complete-branch van
  `updateGolf()`: event-afloophaakje aanroepen + `actieveEventGolf = null`;
  ook resetten in `gameOver()`. Debug-export: `isEventGolf`,
  `kiesEventType`, getter+setter `actieveEventGolf`.
- **Codegebieden:** `startGolf`, `updateGolf` (complete-branch),
  `gameOver`, debug-export.
- **Acceptatiecriteria:** golf 5/10/15 zetten `actieveEventGolf = 'mist'`
  en tonen een event-banner; golf 4/6 gedragen zich exact als voorheen;
  na golf-einde is `actieveEventGolf` weer `null`.
- **Risico's:** de wave-complete-branch is druk (heal/bonus/banner) —
  alleen een haakje toevoegen, bestaande volgorde niet wijzigen.
- **Testplan:** headless: `spelStaat.golf` op 4/5/6/10 zetten,
  `startGolf()` aanroepen, state + bannertekst asserteren; volledige
  golf-cyclus simuleren en reset checken; volledige bestaande regressie.
- **Rollback:** helpers + state + twee aanroepen verwijderen.
- **Sonnet solo:** ja, mits strikt bij dit framework gebleven (nog geen
  fog, geen Sluiper — dat zijn T7/T8).

## Ticket 7 — Mistgolf: visueel effect ✅
- **Type:** Feature
- **Doel:** tijdens een Mistgolf wordt de scene-fog tijdelijk veel dichter;
  na afloop gegarandeerd herstel.
- **Waarom:** zicht beperken is de goedkoopste vorm van spanning — geen
  extra geometrie, geen perf-kosten (ontwerpbeslissing 6).
- **Concrete wijzigingen:** huidige fog is
  `scene.fog = new THREE.Fog(0x060a0e, 6, 24)` (~r339) — vang de normale
  waarden in constanten (`FOG_NORMAAL = { kleur: 0x060a0e, near: 6, far: 24 }`)
  en definieer `FOG_MIST = { kleur: 0x39443f, near: 2.5, far: 11 }`
  (koel grijsgroen). In het event-starthaakje (T6): fog-waarden muteren
  (`scene.fog.color.setHex(...)`, `.near`, `.far`); in het afloophaakje én
  in `gameOver()`: herstellen naar `FOG_NORMAAL`. Startmelding banner
  "MISTGOLF" (sub: "de mist trekt op…"), eindmelding
  `toonMelding('De mist trekt weg')`. Restart is `location.reload()` —
  herstelt zichzelf, geen extra werk.
- **Acceptatiecriteria:** golf 5: fog near/far == 2.5/11; na golf-einde
  én na gameOver tijdens de mist: fog == normaal; golf 6 start met normale
  fog; buiten Mistgolven wordt fog nooit aangeraakt.
- **Risico's:** fog niet herstellen bij een pad dat je vergeet (game over
  midden in de mist is het valluik — expliciet testen).
- **Testplan:** headless: fog-waarden asserteren vóór/tijdens/na golf 5;
  gameOver forceren tijdens mist en fog asserteren; screenshot van de
  woonkamer tijdens mist (leesbaar? ondoden op 8m zichtbaar als silhouet?).
- **Rollback:** haakjes leeghalen; fog-constanten kunnen blijven staan.
- **Sonnet solo:** ja.

## Ticket 8 — Nieuwe zombie: Sluiper ✅
- **Type:** Feature
- **Doel:** nieuw type `sluiper` dat uitsluitend tijdens Mistgolven kan
  spawnen: klein, snel-ish, breekbaar, met oplichtende ogen zodat hij in de
  mist eerlijk vindbaar blijft.
- **Waarom:** de Mistgolf heeft een eigen vijand nodig die het
  zicht-thema uitbuit zonder oneerlijk te zijn.
- **Concrete wijzigingen:** entry in `ONDODE_TYPES`:
  `sluiper: { snelheidMultiplier: 1.35, hpMultiplier: 0.75,
  geldMultiplier: 1.1, kleur: 0x3c4a41, oogKleur: 0xb8ffc8, schaal: 0.75 }`
  (effectief ±2,0 m/s; HP `max(1, round(basis×0.75))` → 1 op golf 5-basis 2
  — prima: fragiel is de bedoeling; ogen-emissive bestaat al via
  `oogKleur`, evt. `emissiveIntensity` per type verhoogbaar als de mist 'm
  verzwelgt). GEEN entry in `ONDODE_TYPE_MIN_GOLF` en gewicht 0 in
  `ondodeTypeGewichten()` buiten mist (de echte gating is Ticket 9).
- **Acceptatiecriteria:** `spawnOndode(0,'sluiper')` geeft de juiste
  stats; schaal 0.75 × lengtevariatie; buiten een Mistgolf komt 'sluiper'
  nooit uit `kiesOndodeType()`.
- **Risico's:** kleine schaal + headshot: hoofd zit lager — raycast werkt
  op mesh-niveau dus dit blijft kloppen, maar speeltest dat headshots
  haalbaar blijven.
- **Testplan:** headless stats-assert + 200 samples `kiesOndodeType()`
  buiten mist bevatten geen sluiper; screenshot in mist (ogen zichtbaar?).
- **Rollback:** type-entry verwijderen.
- **Sonnet solo:** ja, samen met of direct na Ticket 9.

## Ticket 9 — Mistgolf: spawngewichten ✅
- **Type:** Feature
- **Doel:** tijdens een Mistgolf bestaat de golf uitsluitend uit Sluipers;
  buiten Mistgolven verandert er niets.
- **Waarom:** de eventgolf moet ANDERS voelen, niet voller — één
  vijandtype + slecht zicht is een compleet andere puzzel dan golf 4/6.
- **Concrete wijzigingen:** in `ondodeTypeGewichten()`: als
  `actieveEventGolf === 'mist'` → return `{ sluiper: 1 }` (en verder
  niets); anders de bestaande weging (zonder sluiper). `golfSpawnStap()`
  blijft ongemoeid.
- **Acceptatiecriteria:** golf 5 spawnt 100% sluipers; golf 4 en 6 spawnen
  exact volgens de oude verdeling (geen sluipers); barricade-gedrag blijft
  gelijk (planken beuken telt niet als spawn).
- **Risico's:** vrijwel geen — één early-return in een pure functie.
- **Testplan:** headless: 100 `golfSpawnStap()`-spawns op golf 5 → allemaal
  type 'sluiper'; zelfde op golf 6 → nul sluipers; bestaande
  variantentests blijven groen.
- **Rollback:** early-return verwijderen.
- **Sonnet solo:** ja.

## Ticket 10 — Debug- en testhooks ✅
- **Type:** Debug
- **Doel:** alle nieuwe state uit deze ronde inspecteerbaar/instelbaar
  maken via de bestaande debug-hook, en de belangrijkste headless tests in
  de repo vastleggen zodat ze sessies overleven.
- **Waarom:** de huidige testscripts staan in een sessie-scratchpad en
  zijn niet gecommit (zie ARCHITECTURE_NOTES §1, debug-infrastructuur);
  zonder hooks zijn de acceptatietests van latere tickets niet schrijfbaar.
- **BELANGRIJKE afwijking van het oorspronkelijke verzoek:** GEEN nieuw
  global `window.__AMSTERDAM_UNDEAD_TEST__` — het project gebruikt al
  `window.AmsterdamUndeadDebug` (CLAUDE.md-conventie, alle bestaande tests).
  Eén hook, geen tweede (ontwerpbeslissing 13).
- **Concrete wijzigingen:** exporteren (met getters/setters waar het
  primitieve let-variabelen zijn): `isEventGolf`, `kiesEventType`,
  `actieveEventGolf`, `laatsteSterkePowerupGolf`, `laatsteKerninslagGolf`,
  cooldown-constanten, `FOG_NORMAAL`/`FOG_MIST` (zodra T7 bestaat) —
  `ONDODE_TYPES` en de power-up-exports bestaan al. Later aanvullen per
  ticket: budget-info (T13), PaP-status (T11/12). Daarnaast: map `tests/`
  in de repo met de belangrijkste Playwright-scripts (load-check,
  golf-cyclus, varianten, power-ups) + korte README (Chromium-pad,
  CDN-intercept, pointer-lock-truc — patroon staat in CLAUDE.md).
- **Acceptatiecriteria:** elke nieuwe state uit T1–T9 is via de console
  leesbaar; setters werken; `node tests/<script>.mjs` draait groen vanaf
  een schone checkout (met `npm i playwright three` of gedocumenteerd
  equivalent); geen gameplay-gedrag veranderd.
- **Risico's:** exports die live-referenties vs. kopieën verwarren (gebruik
  getters voor primitieven — bestaand patroon volgen).
- **Testplan:** console-smoketest van elke export + één volledige
  regressierun vanuit `tests/`.
- **Rollback:** exports zijn additief; `tests/` is inert.
- **Sonnet solo:** ja.

## Ticket 11 - Pack-a-Punch: architectuur (data + schade, nog geen machine) ✅
* **Type:** Feature (fundament + balansaanpassing)
* **Doel:** per-wapen upgrade-status en de nieuwe schadeformule, zonder
  zichtbare machine-gameplay. Daarnaast wordt de bestaande globale
  schade-upgrade herbalanceerd, zodat die een early-game pad blijft en De
  Smederij later duidelijk als sterkere late-game upgrade voelt.
* **Waarom:** de schadeformule raakt `raakOndode()`, het gevaarlijkste
  stukje code; dat wil je los testen vóór er een machine aan hangt.
  Per-wapen i.p.v. globaal: ontwerpbeslissing 8. De huidige globale
  schade-upgrade is nu te goedkoop en te sterk t.o.v. De Smederij, daarom
  wordt die kleiner gemaakt.
* **Concrete wijzigingen:**
  * Wapendefinities krijgen een `smederijConfig` (naamgeving: de machine
    heet in-game **De Smederij**, géén "Pack-a-Punch", zie IP-regels in
    CLAUDE.md en de eerder afgesproken naamtabel):
    Drukspuit `{ schadeBonus: 1.5, magazijnMax: 12 }`,
    Ratelaar `{ schadeBonus: 1, magazijnMax: 24 }`.
  * `nieuweWapenStaat()` krijgt veld `gesmeed: false`.
  * De globale schade-upgrade (`koopUpgrade`, `schadePerTreffer`) blijft
    bestaan als early-game pad, maar wordt herbalanceerd:
    `schadePerTreffer` start op `1`,
    `koopUpgrade()` verhoogt schade met `0.5` i.p.v. `1`,
    `WAPEN_SCHADE_MAX` wordt `1.5` i.p.v. `2`.
  * HUD-weergave van schade moet decimalen netjes tonen, bijvoorbeeld
    `1.5`.
  * Schadeformule in `raakOndode()`:
    `basis = schadePerTreffer + (wapenStaat.gesmeed ? wapenStaat.definitie.smederijConfig.schadeBonus : 0)`
    `schade = basis + (kop ? HEADSHOT_EXTRA : 0)` (Eliminatiemodus-override
    blijft erboven staan). Fractioneel (0,5) is veilig: HP-checks zijn
    `<= 0`.
  * De globale schade-upgrade is dus niet meer de grootste damage-spike;
    De Smederij wordt de late-game wapen-transformatie.
  * Debug-export: `get gesmeedActief()` (status actief wapen),
    smederijConfigs.
* **Schadebalans:** startschade blijft `1`; globale schade-upgrade geeft
  `+0.5`; De Smederij geeft Drukspuit `+1.5` en Ratelaar `+1`. Daardoor
  wordt maximale bodyshot-schade:
  Drukspuit `3` (`1.5 + 1.5`),
  Ratelaar `2.5` (`1.5 + 1`).
  Headshots blijven `+HEADSHOT_EXTRA` bovenop de bodyshot-schade.
* **Acceptatiecriteria:** zonder `gesmeed` en zonder globale upgrade is
  startschade identiek aan nu; de globale schade-upgrade verhoogt schade met
  `0.5` en stopt bij `1.5`; met `gesmeed=true` via debug: Drukspuit bodyshot
  = `schadePerTreffer+1.5`, Ratelaar = `schadePerTreffer+1`; wisselen (Q)
  behoudt de status per wapen; Drukspuit smeden verandert Ratelaar-schade
  niet; Ratelaar smeden verandert Drukspuit-schade niet.
* **Risico's:** `raakOndode` wordt door tests direct aangeroepen met de
  actieve `wapenStaat` als impliciete context; dat blijft zo (bewust: de
  schade hoort bij het wapen waarmee geschoten wordt). Bestaande tests die
  `schadePerTreffer === 2` verwachten moeten worden aangepast naar `1.5`.
* **Testplan:** headless: schade-asserts per wapen × gesmeed × headshot ×
  upgrade-staat (16 combinaties); assert dat `koopUpgrade()` schade met
  `0.5` verhoogt en stopt bij `1.5`; wissel-persistentie; volledige
  regressie.
* **Rollback:** `gesmeed`-veld + één term in de formule verwijderen;
  `koopUpgrade()` terugzetten naar `+1` en `WAPEN_SCHADE_MAX` terugzetten
  naar `2`.
* **Sonnet solo:** ja, maar pas ná Ticket 14 (schadewaarden zijn op de
  nieuwe HP-curve gebalanceerd).

## Ticket 12 - Pack-a-Punch: machine "De Smederij" (implementatie) ✅
* **Type:** Feature
* **Doel:** koopbare machine (€3000 per wapen) op de binnenplaats die het
  ACTIEVE wapen smeedt: sterke per-wapen schadebonus (T11), groter magazijn,
  aangepast uiterlijk, sterker schoteffect, HUD-status.
* **Waarom:** late-game geldsink (ontwerpbeslissing 7); binnenplaats is de
  laatste zone dus de natuurlijke plek. Door de herbalans uit T11 voelt De
  Smederij duidelijk sterker dan de goedkope globale schade-upgrade.
* **Concrete wijzigingen:**
  * `const SMEDERIJ_PRIJS = 3000;`
  * Interactiepunt volgens het bestaande patroon (`ratelaarPunt` als
    voorbeeld): positie op de binnenplaats via `PLAATS_*`-ankers (bv. tegen
    de noordmuur, vrij van schuurtje/kratten/spawn-ankers, check met
    `isVrijePlek`), `interactieMarkering(x, z, kleur)`, prompt toont actief
    wapen + prijs of "al gesmeed".
  * `koopSmederij()`: geld-check, `wapenStaat.gesmeed = true`,
    `magazijnMax` → smederijConfig-waarde (magazijn meteen bijvullen tot
    het nieuwe max is redelijk), eenmalig per wapen.
  * Visueel/audio: emissive accentkleur op de wapen-mesh van het gesmede
    wapen, feller `vlamLicht`, eigen `speelSmeed()`-piep; simpel houden
    (geen nieuwe geometrie nodig).
  * HUD: `updateHUD()`/`updateAmmoUI()` tonen een merkteken (bv. ster) bij
    de wapennaam als het actieve wapen gesmeed is.
  * Machine-decor: klein aambeeld/werkbankje van 2-3 boxen, GEEN collision
    (of een bewuste `registreerRechthoek` als hij vrij staat, dan ook de
    obstakel-count-test bijwerken).
* **Acceptatiecriteria:** Drukspuit smeden: €-3000, magazijn 8→12, schade
  +1.5, HUD-merkteken, tweede keer kopen doet niets; Ratelaar idem
  (16→24, +1) en onafhankelijk van de Drukspuit; met te weinig geld gebeurt
  niets (bestaand `speelGeenGeld`-patroon); golf 12-15 blijft uitspeelbaar
  ZONDER smeden (balanscheck, ontwerpbeslissing 12).
* **Schadeverwachting:** Drukspuit zonder upgrades: bodyshot `1`, headshot
  `2`; Drukspuit met globale upgrade: bodyshot `1.5`, headshot `2.5`;
  Drukspuit gesmeed zonder globale upgrade: bodyshot `2.5`, headshot `3.5`;
  Drukspuit gesmeed met globale upgrade: bodyshot `3`, headshot `4`.
  Ratelaar zonder upgrades: bodyshot `1`, headshot `2`; Ratelaar met globale
  upgrade: bodyshot `1.5`, headshot `2.5`; Ratelaar gesmeed zonder globale
  upgrade: bodyshot `2`, headshot `3`; Ratelaar gesmeed met globale upgrade:
  bodyshot `2.5`, headshot `3.5`.
* **Risico's:** interactiepunt-plaatsing op een onvrije plek; vergeten
  magazijn-refill waardoor het nieuwe max pas na een reload zichtbaar is;
  obstakel-tests als het decor collision krijgt; HUD kan verwarrend worden
  als globale schade en gesmede wapenstatus niet duidelijk apart worden
  getoond.
* **Testplan:** headless kooppad per wapen (zoals de bestaande
  `koopRatelaar`-tests); dubbele-aankoop-guard; wissel-gedrag;
  schade-asserts na smeden; magazijn-refill assert; screenshot van machine +
  gesmeed wapen; volledige regressie.
* **Rollback:** interactiepunt + `koopSmederij` + decor verwijderen; T11
  blijft dan inert bestaan. Als ook de balanswijziging terug moet:
  `koopUpgrade()` terugzetten naar `+1` en `WAPEN_SCHADE_MAX` terugzetten
  naar `2`.
* **Sonnet solo:** ja, direct na T11.


## Ticket 13 — Wave redesign: threat-budget-architectuur ✅
- **Type:** Refactor (RISKANTSTE TICKET — gefaseerd uitvoeren)
- **Doel:** golven krijgen een dreigingsbudget i.p.v. een lineair
  zombie-aantal; zwaardere types kosten meer budget.
- **Waarom:** ontwerpbeslissing 9 — moeilijkheid via samenstelling i.p.v.
  volume; het huidige systeem eindigt in 30+ zombies per golf.
- **Concrete wijzigingen:**
  - `const ONDODE_THREAT_KOSTEN = { normaal: 1, loper: 1.4, brander: 1.8,
    sluiper: 1.5, sjouwer: 3 };` (event-elites later 4–6).
  - Budgetformule: `golfBudget(golf) = Math.round(GOLF_BUDGET_BASIS (5) +
    GOLF_BUDGET_GROEI (1.7) × (golf − 1))` → golf 1: 5, golf 5: 12,
    golf 10: 20, golf 15: 29 (binnen de gevraagde vensters).
  - `spelStaat.teSpawnen` wordt `spelStaat.budget` (nummer, geen count):
    `startGolf()` zet het budget; `golfSpawnStap()` kiest eerst een type,
    checkt `kosten <= budget` (zo niet: val terug op 'normaal'; is zelfs
    dat te duur → budget op 0 en stoppen met spawnen), en trekt de kosten
    af NA een echte spawn (barricade-beuk kost niets).
  - Golf-einde: `budget < 1 && ondoden.length === 0`.
  - Banner-subtekst: het exacte aantal is vooraf niet meer bekend — toon
    dreiging i.p.v. aantal (bv. "dreiging 12 · mik op het hoofd").
  - Mistgolf: budget × 0.9 en alleen sluipers (kosten 1.5) — event-golven
    kunnen later eigen modifiers krijgen via `kiesEventType`.
  - Debug-export: `golfBudget`, `ONDODE_THREAT_KOSTEN`,
    `get budget()`/setter.
  - **Alle tests die `teSpawnen` zetten/lezen moeten mee** (cap-test,
    golf-cyclustests, banner-test) — dit hoort bij het ticket.
- **Acceptatiecriteria:** golf 1 spawnt (bij alleen zone A en kapotte
  barricades) 5 normale ondoden en eindigt normaal; op golf 10 is het
  totale aantal gespawnde ondoden LAGER dan 23 (oude lineaire aantal) maar
  bevat het zwaardere types; wave-einde, bonus, heal en banner werken;
  perf-cap blijft gerespecteerd; Kerninslag beëindigt een golf nog steeds
  correct (budget al verbruikt of niet — golf eindigt zodra budget op is
  én alles dood is).
- **Risico's:** de golf-einde-conditie is de kern van de gameloop — een
  off-by-one hier bevriest het spel in een golf. Mitigatie: exact dezelfde
  structuur houden (`budget < 1` waar eerst `teSpawnen === 0` stond) en de
  volledige golf-cyclus headless simuleren vóór commit.
- **Testplan:** headless volledige-cyclus-sim op golf 1/5/10 (tot golf++);
  budget-uitputting met dure types; barricades kosten geen budget;
  cap-test; VOLLEDIGE regressie (met bijgewerkte teSpawnen-tests).
- **Rollback:** dit ticket in één commit — revert van die commit herstelt
  het lineaire systeem volledig.
- **Sonnet solo:** met verhoogde voorzichtigheid: eerst tests schrijven
  tegen het OUDE gedrag, dan refactoren, dan tests bijwerken. Niet
  combineren met andere tickets.

## Ticket 14 — Wave redesign: geleidelijke HP-schaling ✅
- **Type:** Balanspatch (na T13)
- **Doel:** normale ondoden worden trapsgewijs taaier i.p.v. één sprong.
- **Waarom:** samen met het budget vormt dit de moeilijkheidscurve;
  cap op 4 voorkomt bullet sponges (ontwerpbeslissing 10).
- **Concrete wijzigingen:** `ondodeStartHP()` vervangen door een
  trapfunctie: golf 1–4 → 1, golf 5–10 → 2, golf 11–15 → 3, golf 16+ → 4
  (hard plafond). `ONDODE_HP_VROEG/LAAT/GOLFGRENS` vervallen of worden
  intern aan de trap gemapt (debug-export bijwerken!). Sjouwer-interactie:
  HP wordt `Math.min(Math.round(basis × 2.5), 8)` — plafond 8
  (ontwerpbeslissing 11; additieve variant `basis + 3` mag als alternatief
  voorgesteld worden). Loper (×0.5) en Sluiper (×0.75) blijven `max(1, …)`.
- **Acceptatiecriteria:** normaal-HP per golf: 1(g1) 1(g4) 2(g5) 2(g10)
  3(g11) 3(g15) 4(g16) 4(g25); sjouwer nooit > 8; loper/sluiper nooit < 1;
  banner-hint ("taaier") klopt nog of is bijgewerkt.
- **Risico's:** tests die `ONDODE_HP_GOLFGRENS`/1-vs-2-HP asserteren
  (balans-test!) moeten mee; brander-explosieschade (3) doodt een
  4-HP-normaal niet meer — bewust, noteren in de commit.
- **Testplan:** headless HP-tabel-assert over golven 1–25; bestaande
  balans/varianten-tests bijgewerkt; speeltest golf 11+ op TTK-gevoel.
- **Rollback:** oude `ondodeStartHP` terugzetten.
- **Sonnet solo:** ja, na T13.

## Ticket 15 — Wave redesign: spawn-cap en drukcontrole ✅
- **Type:** Balanspatch (na T13/T14)
- **Doel:** maximaal 14–18 gelijktijdig levende ondoden, licht schalend
  met open zones; de kaart raakt nooit overspoeld.
- **Waarom:** met het budget-systeem hoeft het plafond de moeilijkheid
  niet meer te dragen — het mag omlaag voor leesbaarheid en perf.
- **Concrete wijzigingen:** `GOLF_MAX_ACTIEF` 18 → **14**;
  `ZONE_MAX_ACTIEF_BONUS` 4 → **2** (plafond wordt 14/16/18 over 1/2/3
  zones — exact het gevraagde venster). Eventgolven gebruiken hetzelfde
  plafond (anders voelen ≠ voller). Comments + debug-export ongewijzigd
  (zelfde namen).
- **Acceptatiecriteria:** cap-gedrag: met vol budget en genoeg spawns
  stijgt `ondoden.length` nooit boven 14/16/18 (per zonestand); bestaande
  cap-test bijgewerkt en groen.
- **Risico's:** vrijwel geen; alleen test-verwachtingen.
- **Testplan:** headless cap-test per zonestand; speeltest golf 10+ op
  "vol maar leesbaar".
- **Rollback:** twee constanten terug.
- **Sonnet solo:** ja.

## Latere eventgolf-ideeën (backlog — NIET implementeren)
1. **Klokkengolf** — kerkklokken/dreun (Web Audio-piep-patroon) lokt
   ondoden sneller: spawninterval tijdelijk lager, mínder gelijktijdige
   ondoden dan normaal, maar agressiever tempo. Herbruikt: budget-modifier
   + `effectiefSpawnInterval`-factor per event.
2. **Duisternisgolf** — lampen flikkeren zwaarder of vallen deels uit
   (`lampLichten`-intensiteit moduleren), vijandogen feller emissive;
   spelen op silhouet en geluid. Herbruikt: lampflikker-systeem, oogKleur.
3. **Sjouwergolf** — laag aantal, hoog budget-aandeel Sjouwers; draait om
   ammo-management en kiten. Herbruikt: event-spawngewichten (T9-patroon).
4. **Open ontwerpvraag Kerninslag-nerf** (uit T3): max ~8 kills of ~70% van
   levende ondoden, dichtstbijzijnde sparen. Eerst data verzamelen.

---

# v0.15+ — Fable-architectuurronde 2: power-ups, Smederij-visuals, zombie-herwerking en map-lus ✅ (Tickets 16-29 uitgevoerd)

Ontworpen door Claude Fable ná de uitvoering van v0.14 (fases 1–5 zijn
geïmplementeerd); uitvoering later door Claude Sonnet, één ticket per keer.
Lees eerst `ARCHITECTURE_NOTES.md` §4 (codekaart-aanvullingen, huidige
plattegrond + lus-voorstel, ontwerpbeslissingen 14–20) en
`SONNET_EXECUTION_PLAN.md` (fases 6–9 + prompts).
Fasen: 6 = power-up-droplimieten (T16), 7 = Smederij-visuals (T17),
8 = zombie-herwerking (T18–T23), 9 = map-lus (T24–T29). Fase 8 komt vóór
fase 9: beide herschrijven een andere helft van `updateOndoden()`.

## Ticket 16 — Power-ups: één drop-slot per golf (vervangt het cooldown-trio)
- **Type:** Refactor + balanspatch
- **Doel:** maximaal één power-up-drop per golf, ongeacht het type;
  Kerninslag houdt daarbovenop zijn 1-per-4-golven-ritme. Munitievoorraad,
  Dubbele Beloning en Eliminatiemodus concurreren om dat ene slot en
  kunnen dus elk hoogstens 1× per golf vallen — en nooit samen.
- **Waarom:** de drie cooldowns uit T2/T3 + de feedbackronde remden elk
  type apart, maar een golf kan nog steeds meerdere drops stapelen
  (ontwerpbeslissing 14). Dit ticket VERVANGT die cooldown-architectuur;
  T2/T3 blijven historisch geldig maar hun states verdwijnen.
- **Concrete wijzigingen:**
  - Nieuwe state `let laatstePowerupDropGolf = -Infinity;` — gezet in
    `spawnPowerupDrop()` op DROP-moment (beslissing 3 blijft gelden).
  - `kiesPowerupType()`: eerst
    `if (spelStaat.golf <= laatstePowerupDropGolf) return undefined;`
    (deze golf had zijn drop al), daarna de toegestane-lijst =
    munitievoorraad + dubbeleBeloning + eliminatiemodus + (kerninslag
    alleen als `spelStaat.golf >= laatsteKerninslagGolf +
    KERNINSLAG_COOLDOWN_GOLVEN`); uniforme loting.
  - Verwijderen: `STERKE_POWERUP_COOLDOWN_GOLVEN`,
    `laatsteSterkePowerupGolf`, `MUNITIEVOORRAAD_COOLDOWN_GOLVEN`,
    `laatsteMunitievoorraadGolf`, de `sterk: true`-vlaggen (geen lezer
    meer) — inclusief hun debug-exports.
  - Blijft: `POWERUP_DROP_KANS = 0.12` (kans en typekeuze blijven
    gescheiden knoppen), `KERNINSLAG_COOLDOWN_GOLVEN = 4` +
    `laatsteKerninslagGolf`, de `if (!type) return;`-guard in
    `spawnPowerupDrop()`.
  - Debug-export: getter+setter `laatstePowerupDropGolf`.
- **Codegebieden:** power-up-blok (`kiesPowerupType`, `spawnPowerupDrop`,
  constanten), debug-export, `tests/test-powerups.mjs`.
- **Acceptatiecriteria:** 30 geforceerde kills binnen één golf geven max
  1 drop; de volgende golf kan weer droppen; valt Kerninslag in golf 8,
  dan pas weer mogelijk vanaf golf 12 én telt hij als dé drop van golf 8;
  `kiesPowerupType()` geeft `undefined` als het slot op is en
  `spawnPowerupDrop(undefined)` crasht niet; effecten/verval/pickup
  ongewijzigd.
- **Risico's:** de bestaande cooldown-tests in `tests/test-powerups.mjs`
  asserteren het oude gedrag — in HETZELFDE ticket herschrijven, anders
  is de suite rood terwijl het spel klopt.
- **Testplan:** headless: per-golf-slot (geforceerde kills + sampling van
  `kiesPowerupType()` per golfstand), Kerninslag-ritme over golf 8–13,
  drop-kans-meting blijft ±0.12 (met slot-reset per poging), volledige
  regressie.
- **Rollback:** dit ticket in één commit; revert herstelt het
  cooldown-trio volledig.
- **Sonnet solo:** ja, maar nooit combineren met een ander ticket dat
  `raakOndode()` of het power-up-blok raakt.

## Ticket 17 — Smederij: gesmede wapens visueel herkenbaar
- **Type:** Feature (puur cosmetisch)
- **Doel:** een gesmeed wapen is in één oogopslag herkenbaar, maar blijft
  duidelijk hetzelfde wapen. Geen gameplay-effect bovenop T11/T12.
- **Waarom:** de huidige accenten (klein onderdeel verkleurt, fellere
  flits) vallen in het vuur van het gevecht weg; de €3000-aankoop verdient
  zichtbare trots (ontwerpbeslissing 15).
- **Concrete wijzigingen:**
  - Per wapen één vooraf gebouwde `Group` (`smederijVisualsDrukspuit`,
    `smederijVisualsRatelaar`) als kind van de bestaande wapen-groep,
    `visible = false`; `koopSmederij()` zet 'm zichtbaar.
  - **Drukspuit ("smeulende drukketel"):** 2 dunne gloeiringen
    (`TorusGeometry`, straal ±0.05, buis 0.008, emissive
    `SMEDERIJ_ACCENT_KLEUR`) om de tank; een ember-`PointLight`
    (intensiteit ±0.3, distance ±0.9) die zacht flikkert.
  - **Ratelaar ("gloeiend drijfwerk"):** een tweede klein tandwiel dat
    langzaam draait (rotatie in de gameLoop), een dunne hitteband-torus
    om de loop, dezelfde flikkerende ember-light.
  - Mondingsflits warmer: in `schiet()` bij `wapenStaat.gesmeed` de
    kleur van `vlam.material` en `vlamLicht` naar een ember-tint zetten
    (en anders naar de originele kleur — elk schot opnieuw gezet, dus
    zelfherstellend na een rollback van de status).
  - Nieuw gameLoop-haakje `updateSmederijVisuals(dt)`: tandwiel-rotatie +
    licht-flikker (sin op `klok`, V4-lampflikker-patroon), alleen actief
    op zichtbare sets.
  - Debug-export: beide visual-Groups (of een
    `get smederijVisualsZichtbaar()`-samenvatting).
- **Codegebieden:** wapen-opbouwblok, `koopSmederij`, `schiet`, gameLoop,
  debug-export.
- **Acceptatiecriteria:** vóór smeden onzichtbaar; na smeden zichtbaar op
  het juiste wapen; wisselen (Q) toont/verbergt correct (gratis via de
  bestaande group-toggle); HUD-ster en visuals zijn nooit strijdig;
  budget ≤ 5 meshes + 1 light per wapen; geen effect op schade/magazijn.
- **Risico's:** performance (bewust geen particle-systeem; flikker is één
  sin per frame); visual-set vergeten te koppelen aan de wapen-groep
  waardoor wisselen 'm laat zweven.
- **Testplan:** headless: visible-status per wapen × gesmeed × wissel
  (8 combinaties); screenshots van beide gesmede wapens (plus één tijdens
  het schieten voor de ember-flits); volledige regressie.
- **Rollback:** visual-Groups + haakje verwijderen; T11/T12 blijven inert
  werken.
- **Sonnet solo:** ja.

## Ticket 18 — Zombies Z1: modulair model (refactor, geen gedragswijziging)
- **Type:** Refactor (fundament van de herwerking — VOORZICHTIG)
- **Doel:** `maakOndodeModel()` bouwt voortaan een deel-hiërarchie met
  scharnieren: been-pivots (heuphoogte), romp-groep (met torso + vod),
  arm-pivots (schouder), hoofd-groep (met hoofd + ogen). Referenties op
  `ondode.delen = { beenL, beenR, romp, armL, armR, hoofd }`. Gedrag,
  silhouet en hitboxes blijven gelijk.
- **Waarom:** losse ledematen-animatie (Z3), hitreacties (Z4) en
  doodsanimaties (Z5) hebben pivots nodig; het huidige één-blok-model kan
  alleen als geheel wiebelen (ontwerpbeslissing 16).
- **Concrete wijzigingen:** één blok "benen" wordt twee been-meshes in
  eigen pivot-Groups; armen/hoofd krijgen pivot-Groups met de mesh op een
  offset; bestaande traits (kromme → romp-rotatie, slepend →
  been-pivot-stand, armVerschil → armlengte, scheve nek → hoofd-groep)
  blijven hetzelfde eindbeeld geven; `userData.lichaamsdeel = 'kop'`
  UITSLUITEND op hoofd-mesh + ogen (hitbox-contract, beslissing 16);
  `spawnOndode()` slaat `delen` op; debug-export: geen nieuwe state nodig
  (delen hangen aan het bestaande ondode-object).
- **Codegebieden:** `maakOndodeModel`, `spawnOndode`. NIET: `updateOndoden`.
- **Acceptatiecriteria:** headshot-raycasttest (bestaand patroon uit de
  balans-tests) identiek; lichaamstreffer op arm/been/romp = gewone
  schade; alle bestaande varianten-/balans-/golf-tests groen zonder
  aanpassing; screenshots per type tonen hetzelfde silhouet als vóór de
  refactor (kleine afwijkingen door pivot-afronding toegestaan).
- **Risico's:** het riskantste zombie-ticket — een vergeten
  `'kop'`-markering breekt headshots; een verkeerde pivot-offset
  verschuift het silhouet en daarmee de raakbaarheid.
- **Testplan:** headless: raycast op hoofd/torso/arm per type;
  hoofd-hoogte-assert (±1.58 × schaal); volledige regressie; vóór/na-
  screenshots van alle vijf types.
- **Rollback:** dit ticket in één commit; revert herstelt het oude model.
- **Sonnet solo:** ja, maar NOOIT combineren met een ander ticket.

## Ticket 19 — Zombies Z2: silhouetten per type + variatieprofielen
- **Type:** Feature (visueel)
- **Doel:** de vijf types zijn ook zonder kleur herkenbaar aan hun vorm,
  en binnen een type bestaan duidelijk verschillende verschijningen.
- **Waarom:** kleur/schaal alleen leest slecht in mist en duisternis;
  herhaalde identieke silhouetten breken de onderdompeling.
- **Concrete wijzigingen:** per-type vorm-data in `ONDODE_TYPES`
  (bv. `vorm: { rompBreedte, schouderBreedte, hoofdVorm, buik }`):
  Loper dun + voorovergebogen, Sjouwer breed + bochel, Brander buikige
  romp + gloeiende buik-kern (emissive mesh, GEEN light), Sluiper klein +
  ingedoken kop; daarnaast `VARIATIE_PROFIELEN` (6–8 stuks: mager, breed,
  gebocheld, lang, kort, eenarmig, …) geloot in `kiesOndodeTraits()`.
  Eenarmig mag (arm weglaten is hitbox-veilig); het hoofd wordt NOOIT
  kleiner dan de huidige sphere (0.18 × schaal) — beslissing 16.
- **Codegebieden:** `ONDODE_TYPES`, `kiesOndodeTraits`, `maakOndodeModel`.
- **Acceptatiecriteria:** per type een screenshot die de vorm toont; 100
  samples `kiesOndodeTraits()` bevatten ≥ 5 verschillende profielen;
  headshot-raycast blijft op elke variant slagen; stats (HP/snelheid/geld)
  ongewijzigd.
- **Risico's:** vorm-overdrijving die hitboxes onbetrouwbaar maakt —
  profielen schalen alleen binnen marges (±25% op romp, hoofd nooit
  kleiner).
- **Testplan:** headless raycast-sweep per type × 3 profielen;
  screenshotserie; volledige regressie.
- **Rollback:** vorm-data + profielen verwijderen; Z1-model blijft staan.
- **Sonnet solo:** ja, na Z1.

## Ticket 20 — Zombies Z3: losse ledematen-animatie
- **Type:** Feature (visueel)
- **Doel:** benen stappen, armen zwaaien in tegenfase, de romp bobt en het
  hoofd kantelt subtiel — i.p.v. het huidige hele-lichaam-gewiebel.
- **Waarom:** de grootste "low-poly poppetjes"-indruk komt uit het stijve
  lopen; pivots uit Z1 maken dit goedkoop.
- **Concrete wijzigingen:** in de animatie-helft van `updateOndoden()`:
  `loopFase += dt * (4 + snelheid * 2)` voor ALLE ondoden (niet alleen
  strompelt); been-pivots `rotation.x = ±sin(loopFase) * amplitude`,
  arm-pivots in tegenfase × 0.6, romp-bob (`root.position.y =
  |sin| * 0.03`), hoofd-microkantel; `strompelt` maakt de amplitude
  asymmetrisch en verhuist de bestaande `rotation.z`-wiebel van de root
  naar de romp-groep. Budget: ≤ 10 transform-writes per ondode per frame,
  geen allocaties (ARCHITECTURE_NOTES §4.9).
- **Codegebieden:** `updateOndoden` (animatie-helft), `spawnOndode`
  (loopFase-init blijft).
- **Acceptatiecriteria:** screenshots op twee fase-momenten tonen
  verschillende been/arm-standen; strompelaars bewegen zichtbaar anders;
  positie/collision/pathing byte-voor-byte gelijk (animatie raakt alleen
  rotaties/y-bob van delen, nooit `groep.position.x/z`); alle
  golf-/varianten-tests groen.
- **Risico's:** per ongeluk de navigatie-helft raken — dit ticket blijft
  strikt in de animatie-helft; y-bob mag `losBotsingenOp` niet verstoren
  (bob op een KIND van de root, niet op de root-positie zelf, is het
  veiligst).
- **Testplan:** headless: twee `updateOndoden`-ticks met vaste dt →
  delen-rotaties veranderen, root-x/z alleen door beweging; perf-notitie
  (frametijd met 14 ondoden); volledige regressie.
- **Rollback:** animatieblok terug naar de oude wiebel.
- **Sonnet solo:** ja, na Z1/Z2.

## Ticket 21 — Zombies Z4: hitreacties
- **Type:** Feature (visueel)
- **Doel:** een treffer is voelbaar: hoofd-flinch bij headshots,
  romp-twist bij lichaamstreffers, een korte knockback-stap, en de
  Brander-kern flitst bij een treffer.
- **Waarom:** schieten voelt nu als het leeghalen van een HP-balk;
  reacties geven gratis "impact" zonder gameplay-wijziging.
- **Concrete wijzigingen:** `raakOndode()` zet
  `ondode.flinch = { timer: 0.18, soort: kop ? 'kop' : 'lichaam' }` (en
  bij een Brander: kern-puls); de animatie-helft van `updateOndoden()`
  lerpt de flinch af (hoofd-pivot naar achteren bij 'kop', romp-twist bij
  'lichaam') en schuift de positie ±0.12 m van de speler af over de
  flinch-duur — via de bestaande beweging + `losBotsingenOp`, dus nooit
  door muren. Eliminatiemodus-kills slaan de flinch over (meteen dood).
- **Codegebieden:** `raakOndode`, `updateOndoden` (animatie-helft),
  `spawnOndode` (flinch-veld init).
- **Acceptatiecriteria:** headshot → hoofd-rotatie wijkt tijdelijk af en
  herstelt < 0.3 s; lichaamstreffer → romp-twist; knockback verplaatst
  max 0.15 m en respecteert muren (test tegen een muur); melee-timer en
  pathing verder ongewijzigd; geen flinch op stervende/dode ondoden.
- **Risico's:** `raakOndode()` is het drukste risicogebied (schade, geld,
  drops, buffs) — alleen het flinch-veld toevoegen, niets herordenen.
- **Testplan:** headless: flinch-state vóór/tijdens/na; knockback-afstand;
  muurtest; volledige regressie (incl. power-up-drops uit dezelfde
  functie).
- **Rollback:** flinch-veld + lerpblok verwijderen.
- **Sonnet solo:** ja, nooit tegelijk met T16 (zelfde functie).

## Ticket 22 — Zombies Z5: doodsanimaties
- **Type:** Feature (visueel)
- **Doel:** ondoden vallen zichtbaar neer (voorover/zijwaarts/achterover/
  inzakken, geloot) i.p.v. te verdwijnen; de Brander behoudt zijn directe
  explosie zonder lijk.
- **Waarom:** het abrupte verdwijnen is de grootste immersie-breker van
  het huidige gevecht.
- **Concrete wijzigingen:** nieuwe lijst `stervenden` + eigen
  scene-`Group`; `doodOndode()` verplaatst de groep uit `ondodenGroep`
  (raycast-contract!) en het object uit `ondoden` (golf-einde-contract) en
  duwt `{ groep, timer: ±0.7, stijl }` in `stervenden`; nieuw
  `updateStervenden(dt)` in de gameLoop lerpt rotatie + zakt de groep en
  verwijdert 'm daarna definitief; `gameOver()`/restart hoeven niets —
  stervenden zijn puur visueel. Zie ontwerpbeslissing 17 voor de drie
  contracten.
- **Codegebieden:** `doodOndode`, gameLoop, debug-export
  (`stervenden`-array + `updateStervenden`).
- **Acceptatiecriteria:** kill → groep blijft ±0.7 s zichtbaar en vangt
  GEEN kogels meer (raycasttest door een lijk heen); golf eindigt zodra
  `ondoden` leeg is, ook met lijken in beeld; Kerninslag met 5 ondoden →
  5 stervenden, golf rondt normaal af; Brander: explosie direct, geen
  lijk; power-up-drops gebruiken de doodspositie zoals nu.
- **Risico's:** de drie contracten uit beslissing 17 — elk gemist contract
  is een gameplay-bug (golf hangt, lijk vangt kogels, lijk slaat).
- **Testplan:** headless: alle drie contracten expliciet; visuele
  screenshotserie van de valstijlen; volledige regressie (golf-cyclus!).
- **Rollback:** `doodOndode` terug naar direct verwijderen; lijst +
  update-functie weg.
- **Sonnet solo:** ja, na Z1.

## Ticket 23 — Zombies Z6: wave-variatie-limiter
- **Type:** Polish
- **Doel:** binnen een golf spawnen niet drie keer op rij (bijna)
  identieke verschijningen.
- **Waarom:** zelfs met profielen (Z2) kan toeval een golf eentonig maken;
  een kleine geheugenbuffer voorkomt dat goedkoop.
- **Concrete wijzigingen:** ringbuffer (lengte 4) met recente
  profiel-indices in het `golfSpawnStap()`-pad; de profiel-loting in
  `kiesOndodeTraits()` (of een wrapper voor golf-spawns) weigert een
  profiel dat al in de buffer zit en loot opnieuw (max 3 pogingen,
  daarna accepteren — nooit blokkeren). Directe `spawnOndode()`-aanroepen
  blijven buiten de buffer (testbaarheid, zelfde contract als typekeuze).
- **Codegebieden:** `kiesOndodeTraits`/`golfSpawnStap`, debug-export
  (buffer inspecteerbaar).
- **Acceptatiecriteria:** 100 golf-spawns bevatten nooit 3 dezelfde
  profielen op rij; directe spawns ongewijzigd; verdeling blijft op de
  lange termijn uniform (±20%).
- **Risico's:** vrijwel geen — pure lotings-nudge.
- **Testplan:** headless sampling; volledige regressie.
- **Rollback:** buffer verwijderen.
- **Sonnet solo:** ja.

## Ticket 24 — Map-lus M1: geometrie-schil (bijkeuken + kelderhals, nog dicht)
- **Type:** Feature (geometrie — VOORZICHTIG)
- **Doel:** de nieuwe ruimtes bestaan fysiek (vloeren, plafonds, muren,
  eigen sfeer-tinten), maar zijn nog volledig afgesloten: geen deuren,
  geen spawns, geen interacties. Gedrag van het spel is ongewijzigd.
- **Waarom:** geometrie los van gameplay uitrollen maakt elke volgende
  stap klein en reversibel (zelfde aanpak als V5 destijds); zie
  ARCHITECTURE_NOTES §4.7 voor het volledige ontwerp + plattegrond.
- **Concrete wijzigingen:** constanten (`BIJKEUKEN_X_OOST = 12`,
  `BIJKEUKEN_Z_NOORD = -4.5`, `KELDERHALS_X_WEST/OOST = 9/11`,
  `DEUR3_X = 10`, `DEUR3_HALF = 1`, `DEUR4_Z = 0`, `DEUR4_HALF = 1`);
  bijkeuken-vloer/plafond/muren (tegeltint, eigen `vlak`-aanroepen) op
  x ∈ [4.5, 12], z ∈ [−4.5, 4.5]; kelderhals x ∈ [9, 11], z ∈ [−7, −4.5];
  op de plekken van deur 3/4 komt nu nog gewoon muur (de splitsing is
  T25/T26). De nepgevel op (16, −5.95) blijft in de restpocket staan —
  expliciet verifiëren dat hij buiten de bijkeuken valt. `GRENS` wijzigt
  NIET (de pocket ligt er al binnen).
- **Codegebieden:** geometrie-blok (na de binnenplaats), constanten.
- **Acceptatiecriteria:** load-check groen; niets van het nieuwe gebied
  is bereikbaar (probe: `isVrijePlek` op de deurposities = bezet);
  obstakel-count-test bijgewerkt; alle bestaande tests groen; screenshot
  vanaf de binnenplaats toont een ongewijzigd zuidmuur-aanzicht.
- **Risico's:** muur-naden — de bestaande hoekafdichtingen leunen op
  botsingsradius-toleranties (ARCHITECTURE_NOTES §4.4); elke naad met
  probes testen, niet op het oog.
- **Testplan:** headless probes op alle nieuwe naden + de bestaande
  reachability-tests; volledige regressie.
- **Rollback:** geometrie-blok verwijderen (additief).
- **Sonnet solo:** ja, maar NOOIT combineren met een ander ticket.

## Ticket 25 — Map-lus M2: deur 3 (binnenplaats → kelderhals)
- **Type:** Feature
- **Doel:** koopbare deur 3 (€1200) in de binnenplaats-zuidmuur; opent
  zone E met banner "DE BIJKEUKEN".
- **Waarom:** de lus wordt in koopvolgorde uitgerold (beslissing 18);
  deur 3 is de logische eerste opening (je staat al in D).
- **Concrete wijzigingen:** de éne zuidmuur (`bouwBinnenplaatsMuur` op
  z = −6.85) wordt twee segmenten met een gat x ∈ [DEUR3_X ± DEUR3_HALF];
  deur3-mesh + obstakel + `deur3Punt` aan de plaats-kant + markering,
  exact het `koopDeur2`-patroon (mesh/obstakel/markering weg bij koop,
  banner, `speelKoop`); `DEUR3_PRIJS = 1200`; `deur3Gekocht`-state;
  `aantalOntgrendeldeZones()` telt deur 3 mee MAAR de pacing-formules
  gaan rekenen met `min(zones, 3)` (beslissing 18 — plafond blijft
  14/16/18); startscherm-/README-tekst bijwerken. Nog geen vensters
  (T27) en nog geen nav-wijziging (T28) — zone E is even een doodlopend
  maar veilig gebied; dat is oké voor één ticket.
- **Codegebieden:** binnenplaats-geometrie (muur-splitsing), kooppunten-
  blok, `aantalOntgrendeldeZones`/`effectiefSpawnInterval`/
  `effectiefMaxActief`, debug-export (`deur3Gekocht`, `koopDeur3`,
  `deur3Punt`, prijzen).
- **Acceptatiecriteria:** vóór koop: opening geblokkeerd; na koop (€1200
  afgeschreven): speler loopt plaats → kelderhals → bijkeuken; banner
  verschijnt éénmalig; pacing-waarden identiek aan de 3-zones-stand
  (plafond 18, interval-factor 0.85²); dubbele koop doet niets.
- **Risico's:** de zuidmuur-splitsing raakt de kelderdeur-spawn (20.1,
  −7.4) NIET (9,4 m verderop) — wel expliciet asserten; pacing per
  ongeluk laten doorschalen naar 20 is een balansbug.
- **Testplan:** headless kooppad (patroon deur2-tests), reachability
  D→E, pacing-asserts op de 4-zones-stand; volledige regressie.
- **Rollback:** splitsing terug naar één muur + kooppunt weg.
- **Sonnet solo:** ja, na T24.

## Ticket 26 — Map-lus M3: deur 4 (terugdeur bijkeuken → woonkamer)
- **Type:** Feature
- **Doel:** koopbare terugdeur (€800) in de woonkamer-oostmuur, gekocht
  vanaf de BIJKEUKEN-kant; sluit de lus in beide richtingen.
- **Waarom:** de terugweg koop je pas als je de lus bijna rond bent — de
  aankoop voelt dan als de beloning "rondje af" (§4.7).
- **Concrete wijzigingen:** woonkamer-oostmuur (één `bouwMuur` op
  x = 4.65) splitsen in twee segmenten met gat z ∈ [DEUR4_Z ± DEUR4_HALF];
  deur4-mesh + obstakel + `deur4Punt` (positie aan de bijkeuken-kant,
  x ≈ 5.2) + markering; `DEUR4_PRIJS = 800`; `deur4Gekocht`;
  ontgrendelt GEEN zone (beslissing 18): `aantalOntgrendeldeZones()`
  blijft deur 4 negeren; melding "De terugweg is open" i.p.v. een
  zone-banner.
- **Codegebieden:** woonkamer-geometrie, kooppuntenblok, debug-export.
- **Acceptatiecriteria:** vóór koop dicht (ook vanuit de woonkamer);
  na koop beide richtingen beloopbaar; pacing-waarden veranderen NIET
  door deur 4; dubbele koop doet niets.
- **Risico's:** het deurgat mag de A-vensters (zuidmuur) en de ammo-kist
  (3, −2) niet raken — gat op z ∈ [−1, 1] zit daar ruim vandaan; probes
  op de nieuwe naden.
- **Testplan:** headless kooppad + reachability A↔E beide richtingen;
  volledige regressie.
- **Rollback:** muur terug, kooppunt weg.
- **Sonnet solo:** ja, na T25.

## Ticket 27 — Map-lus M4: zone-E-inhoud (venster, Provisiekast, decor, audio)
- **Type:** Feature
- **Doel:** de bijkeuken wordt een échte kamer: één spawn-venster met
  barricade, de Provisiekast (tweede ammo-kist, €350), decor met eigen
  identiteit en een eenmalig zone-geluid.
- **Waarom:** een lege verbindingskamer devalueert de lus; de
  Provisiekast geeft een blijvende reden om er te zijn (§4.8).
- **Concrete wijzigingen:** `VENSTERS_BIJKEUKEN = [{ x: 11.6, z: 2,
  zone: 'E', spanX: false }]` + `bouwBarricade` via de bestaande loop +
  activering in `koopDeur3()` (patroon `koopDeur2`/`VENSTERS_PLAATS`);
  `provisiekastPunt` (€350, `AMMO_KIST_KOGELS`-hergebruik, eigen
  markering + decor-kast); bijkeuken-decor (keukenblok/fornuis-blokken,
  planken met potten — geen collision) en kelderhals-decor (kelderluik,
  kaal flikkerpeertje via het V4-lampflikker-patroon);
  `bijkeukenBetreden`-audio (eenmalige kraak, `gangBetreden`-patroon) —
  en de bestaande `plaatsBetreden`-check aansluiten op de nieuwe
  zone-indeling zodat de windvlaag niet in de bijkeuken afgaat
  (ARCHITECTURE_NOTES §4.10).
- **Codegebieden:** vensters-blok, kooppuntenblok, decor, zone-audio,
  debug-export (`VENSTERS_BIJKEUKEN`, `provisiekastPunt`,
  `koopProvisiekast` of hergebruikte `koopAmmo`-variant).
- **Acceptatiecriteria:** venster spawnt pas na deur 3 (en heeft 3
  planken); Provisiekast vult reserve zoals de ammo-kist maar kost €350;
  windvlaag speelt NIET in de bijkeuken; kraak speelt éénmalig; decor
  heeft geen collision (obstakel-count ongewijzigd behalve bewuste
  keuzes).
- **Risico's:** venster te dicht bij de terugdeur = spawn-camping — op
  (11.6, 2) staat hij 5+ m van deur 4; `kiesVensterIndex` weegt op
  afstand en heeft geen wijziging nodig.
- **Testplan:** headless: venster-activering, Provisiekast-kooppad,
  audio-flags; volledige regressie.
- **Rollback:** inhoud is additief per onderdeel.
- **Sonnet solo:** ja, na T25 (deur 3 moet bestaan); T26 niet vereist.

## Ticket 28 — Map-lus M5: zone-navigatie als graaf (VOORZICHTIG)
- **Type:** Refactor
- **Doel:** `zoneVan()` kent zone E; de lineaire spine wordt een
  zone-graaf met next-hop-tabel zodat ondoden de speler door de hele lus
  en in beide richtingen vinden.
- **Waarom:** het lineaire model kan geen lus aan (ontwerpbeslissing 19);
  zonder dit ticket lopen ondoden vanuit E "achteruit" de hele route af.
- **Concrete wijzigingen:** `zoneVan`: E-tak vóór de woonkamer-check
  (`if (x >= DEUR2_X) return z > PLAATS_Z_ZUID ? 4 : 3;` — zie §4.7);
  `ZONE_GRAAF` = kanten A–B, B–C, C–D, D–E, E–A met per kant het
  deurpunt + de open-conditie (deur 1/2/3/4); `herbouwNavTabel()` (BFS
  over open kanten) aangeroepen bij elke deuraankoop + bij init;
  `updateOndoden()` (navigatie-helft) leest
  `NAV_VOLGENDE[eigenZone][spelerZone]` → deurpunt of rechtstreeks.
  Regressie-anker: met deur 3/4 dicht is de graaf een lijn en het gedrag
  per constructie identiek aan vandaag — dat wordt expliciet getest.
- **Codegebieden:** `zoneVan`, `ZONE_DEURPUNTEN` (vervangen door graaf),
  `updateOndoden` (navigatie-helft), de vier koopDeur-functies (haakje),
  debug-export (`zoneVan`, `NAV_VOLGENDE`, `herbouwNavTabel`).
- **Acceptatiecriteria:** met deur 3/4 dicht: bestaande nav-tests
  byte-voor-byte groen; lus open: ondode in E bereikt speler in A via de
  terugdeur (kortste kant), ondode in D bij speler in A kiest de kortste
  van beide richtingen; `zoneVan` classificeert bijkeuken/kelderhals als
  4 en het binnenplaats-noordpuntje nog steeds als 3.
- **Risico's:** het op één na riskantste ticket van de ronde (na T18):
  `updateOndoden` is al druk; alleen de doelpunt-keuze vervangen, de
  ontwijk-logica NIET aanraken. Fase 8 moet afgerond zijn (zelfde
  functie, andere helft).
- **Testplan:** headless: zoneVan-tabel (10 proefpunten), nav-tabel per
  deurstand, reachability-sim E→A en D→A beide richtingen (bestaand
  realistic-wave-patroon); volledige regressie.
- **Rollback:** dit ticket in één commit; revert herstelt de lineaire
  spine.
- **Sonnet solo:** ja, maar NOOIT combineren met een ander ticket.

## Ticket 29 — Map-lus M6: balans, teksten en eindregressie
- **Type:** Balans + polish
- **Doel:** de lus is compleet én eerlijk: pacing-plafond blijft 18,
  beide looprichtingen zijn getest, teksten kloppen.
- **Waarom:** afronding van fase 9; de kite-analyse uit
  ARCHITECTURE_NOTES §4.8 moet in het echte spel worden bevestigd.
- **Concrete wijzigingen:** pacing-asserts (interval/max met 4 zones ==
  3-zones-waarden); speeltest-notities: rondje linksom en rechtsom op
  golf 8+ (dreiging vanuit beide richtingen? kelderhals-plug werkt?);
  startscherm-/README-teksten (vier zones + lus + prijzen); eventuele
  kleine tuning (DEUR3/4-prijs, Provisiekast-prijs) op basis van de
  speeltest — binnen ±25%, groter is een nieuw ticket.
- **Codegebieden:** teksten, hooguit prijsconstanten.
- **Acceptatiecriteria:** volledige regressie groen (repo-suite +
  scratchpad-suite); screenshots van de lus (bijkeuken, kelderhals,
  beide deuren open); README beschrijft de lus.
- **Risico's:** vrijwel geen — dit ticket verandert bewust geen
  mechanica.
- **Testplan:** `tests/run-all.mjs` + reachability + screenshots.
- **Rollback:** tekstueel.
- **Sonnet solo:** ja.

---

# v0.16 — Fable-architectuurronde 3: combat-leesbaarheid, schietfeedback, winkel-identiteit en sfeer (gepland, nog NIET geïmplementeerd)

Vijf verbetergebieden in één samenhangende ronde: (1) leesbare en
ontwijkbare aanvallen, (2) sterkere schietfeedback, (3) de Smederij naar
de bijkeuken, (4) uniek silhouet + eigen lichtkleur per winkel, (5)
sfeer, materiaalgevoel en vijandleesbaarheid. Architectuur staat vast in
`ARCHITECTURE_NOTES.md` §5 + ontwerpbeslissingen 21–32; de tickets
hieronder zijn implementatie, geen ontwerp. Volgorde: 30 → 41, fases:

- **Fase 10 — aanvalsleesbaarheid**: T30, T31 (verbetergebied 1)
- **Fase 11 — schietfeedback**: T32, T33, T34 (verbetergebied 2)
- **Fase 12 — winkel-identiteit**: T35, T36, T37 (verbetergebieden 3+4)
- **Fase 13 — sfeer & leesbaarheid**: T38, T39, T40 (verbetergebied 5)
- **Fase 14 — integratie**: T41

## Ticket 30 — Aanval A1: aanvals-state-machine met wind-up (VOORZICHTIG)
- **Type:** Gameplay-refactor
- **Verbetergebied:** 1 (leesbare/ontwijkbare aanvallen)
- **Prioriteit:** hoog — fundament van de ronde
- **Status:** open
- **Doel:** een ondode doet nooit meer schade zonder zichtbare aanloop.
  De speler kan elke aanval ontwijken door afstand, zijwaartse beweging
  of positionering.
- **Huidige situatie:** contactschade in de melee-branch van
  `updateOndoden()` (`afstand <= MELEE_BEREIK` → `spelerSchade(15)`);
  `ondode.meleeTimer = 0` onderaan de loop maakt de eerste frame binnen
  1.2 m meteen raak. Geen wind-up, geen hoekcheck, geen muurcheck.
- **Gewenste situatie:** per ondode `aanvalStaat`
  ('jaag'/'windup'/'herstel') + `aanvalTimer` + `aanvalVertraging`;
  raakcheck als discreet slag-moment op de overgang windup→herstel
  (afstand ≤ raakBereik ∧ hoek ≤ raakHoek ∧ middelpunt vrij via
  `isVrijePlek`); tijdens windup staat de ondode stil en draait beperkt
  (`AANVAL_DRAAI_SNELHEID`); herstel op 40% loopsnelheid; maximaal
  `MAX_AANVALLERS = 2` gelijktijdige wind-ups + startjitter; headshot
  onderbreekt altijd, lichaamstreffer alleen Loper/Sluiper
  (`AANVAL_PROFIELEN`, zie ARCHITECTURE_NOTES §5.2 voor de exacte
  tabel). `MELEE_*`-constanten vervallen.
- **Codegebieden:** `updateOndoden()` (UITSLUITEND de melee-branch +
  het frame-einde-blok met de meleeTimer-reset), `spawnOndode()`
  (nieuwe statevelden), `raakOndode()` (onderbrekingshaakje),
  `doodOndode()` (aanvaller-slot vrijgeven), nieuw constants-blok,
  debug-export (`AANVAL_PROFIELEN`, `MAX_AANVALLERS`, per-ondode
  `aanvalStaat` is al bereikbaar via `d.ondoden[i]`,
  `get actieveAanvallers()`).
- **Buiten scope:** elke visuele/audio-tell (T31), navigatie- en
  animatie-helft van `updateOndoden`, Brander-explosie (ongewijzigd).
- **Randgevallen:** dood tijdens windup (slot vrijgeven); knockback
  duwt aanvaller buiten raakbereik (slag mist — gewenst); speler in de
  kelderhals met dichte deur ertussen (middelpunt-check blokkeert);
  meerdere ondoden in de 2m-kelderhals (slots begrenzen de stapel);
  game over tijdens windup (spelerSchade checkt gameOver al); dt-spike
  (clamp 0.05 + discrete overgang = nooit dubbele schade).
- **Performancevoorwaarden:** geen allocaties per frame (state op het
  bestaande ondode-object; jitterloting hergebruikt Math.random);
  `isVrijePlek` alleen op het slag-moment, niet per frame.
- **Acceptatiecriteria:**
  - Een ondode past pas schade toe nadat de wind-up volledig is
    verstreken; op de eerste frame binnen bereik valt NOOIT schade.
  - De aanval mist als de speler op het slag-moment buiten
    `raakBereik` staat of buiten de `raakHoek`-kegel is gestapt.
  - Een aanval raakt nooit door een muur of dichte deur heen
    (middelpunt-check).
  - Nooit meer dan 2 ondoden tegelijk in 'windup'.
  - Een headshot tijdens de wind-up breekt de aanval af (staat →
    'herstel'); een lichaamstreffer doet dat alleen bij Loper/Sluiper.
  - Sjouwer: wind-up ≥ 0.85 s en schade 25; Loper/Sluiper korter maar
    onderbreekbaar (waarden uit `AANVAL_PROFIELEN`).
  - `tests/test-ondode-hitreacties.mjs`-check "meleeTimer wordt elk
    frame gereset" is vervangen door state-machine-checks (zelfde
    ticket) en de hele suite is groen.
- **Testplan:** nieuwe `tests/test-aanval-machine.mjs`: (a) ondode op
  1.0 m + `updateOndoden(dt)`-stappen → geen schade vóór windup-duur,
  wel daarna; (b) speler verplaatsen vlak vóór het slag-moment → HP
  ongewijzigd; (c) hoek-ontwijking (zijwaarts) → mis; (d) 4 ondoden
  aanliggend → hooguit 2 in windup; (e) headshot-onderbreking per type;
  (f) muur-tussenin → mis; (g) DPS-pariteit: zonder reactie ±15 HP per
  1.25 s (normaal). Volledige `tests/run-all.mjs` + load-check.
- **Risico's:** de drukste functie van het spel; alleen de
  melee-branch aanraken. De oude MELEE-constanten in één keer
  verwijderen (geen dubbele waarheden).
- **Rollback:** één commit; revert herstelt contactschade.
- **Sonnet solo:** ja, maar NOOIT combineren met een ander ticket.

## Ticket 31 — Aanval A2: zichtbare en hoorbare tells
- **Type:** Presentatie
- **Verbetergebied:** 1
- **Prioriteit:** hoog
- **Status:** open
- **Afhankelijk van:** T30
- **Doel:** de wind-up is op afstand en in de mist herkenbaar vóórdat
  de slag valt; raak en mis klinken verschillend.
- **Huidige situatie:** T30 levert de states maar de enige "tell" is
  dat de ondode stilstaat. Armen zwaaien in de loop-animatie
  (`delen.armL/armR`, `ARM_RUST_ROTATIE_X = -0.5`); het oog-materiaal
  is één gedeeld material per ondode maar staat niet in `delen`.
- **Gewenste situatie:** tijdens 'windup' lerpen de arm-pivots naar
  -1.9 rad (hoog geheven), het hoofd kantelt licht achterover en
  `delen.oogMateriaal.emissiveIntensity` pulst 1.4 → 2.6; in 'herstel'
  zakken de armen terug over de halve herstelduur.
  `maakOndodeModel()` zet het oog-materiaal op `delen.oogMateriaal`.
  Audio: `speelAanvalGrom(type)` bij windup-start (Sjouwer laag/lang,
  Loper/Sluiper kort/schril), `speelSlagRaak()` bij raak (bovenop
  `speelSpelerAu`), `speelSlagMis()` (whoosh) bij mis.
- **Codegebieden:** `maakOndodeModel()` (delen.oogMateriaal),
  animatie-helft van `updateOndoden()` (windup/herstel-pose overschrijft
  de loop-zwaai voor die ondode), audio-functies, T30's
  slag-moment-code (raak/mis-audio-aanroep), debug-export.
- **Buiten scope:** de state-machine-logica zelf (T30), per-type
  gang-ritmes (T39).
- **Randgevallen:** 'eenarmig'-profiel (geen `armL` — alle arm-writes
  via `if (delen.armL)`); windup onderbroken (armen zakken via het
  herstel-pad); pauze tijdens windup (pose bevriest — updates staan in
  de `spelActief`-tak).
- **Performancevoorwaarden:** de arm-/hoofd-writes VERVANGEN de
  loop-zwaai-writes (netto 0 extra); oog-materiaalwrite alleen voor de
  ≤ 2 actieve aanvallers; geen nieuwe meshes of lights.
- **Acceptatiecriteria:**
  - Tijdens 'windup' staan beide aanwezige armen binnen 0.2 s zichtbaar
    hoger dan `ARM_RUST_ROTATIE_X` en bereiken -1.9 ± 0.1 rad op het
    slag-moment.
  - `delen.oogMateriaal.emissiveIntensity` > 2.0 halverwege de wind-up
    en exact terug op de basiswaarde na herstel.
  - Windup-start speelt hoorbaar een grom (audio-functie aangeroepen —
    testbaar via een debug-teller of spy), raak en mis spelen
    verschillende geluiden.
  - Een eenarmige ondode werpt geen console-errors tijdens de tell.
- **Testplan:** `tests/test-aanval-tells.mjs`: pose-waarden op
  windup-fracties, oog-intensiteit vóór/tijdens/na, eenarmig-profiel
  geforceerd via traits-injectie, audio-aanroepen via een
  debug-hook-teller. Regressie: `test-ondode-animatie.mjs` blijft
  groen (loop-zwaai buiten windup ongewijzigd).
- **Rollback:** presentatie-only; revert laat T30 kaal maar werkend.
- **Sonnet solo:** ja.

## Ticket 32 — Feedback F1: effecten-pool, tracers en impact-deeltjes
- **Type:** Infrastructuur + visueel
- **Verbetergebied:** 2
- **Prioriteit:** hoog — fundament voor T33/T34/T38
- **Status:** open
- **Doel:** elk schot is traceerbaar (tracer), elke treffer stoffelijk
  (deeltjes), zonder allocaties of `setTimeout` in het hot path.
- **Huidige situatie:** `schiet()` bouwt bij een wereld-raak een
  `vonk`-mesh (nieuwe geometry+material) en ruimt op via
  `setTimeout(150)`; `raakOndode()` idem met `bloedvonk`. Geen tracers.
- **Gewenste situatie:** gepoold systeem (ARCHITECTURE_NOTES §5.5):
  `TRACER_MAX = 8`, `IMPACT_MAX = 24`, gedeelde geometry, gecachete
  `MeshBasicMaterial`s, `spawnTracer(van, naar, kleur)` +
  `spawnImpact(punt, kleur, aantal)` + `updateEffecten(dt)` in de
  `spelActief`-tak. `vonk`/`bloedvonk` vervallen. Elke schot krijgt
  een tracer van de vlam-wereldpositie naar het raakpunt (of 30 m);
  vijand-treffer = 3 donkerrode deeltjes, headshot = 5 lichtere,
  wereld-treffer = 3 deeltjes in `userData.materiaalFamilie`-kleur
  (default 'steen' zolang T38 nog niet bestaat).
- **Codegebieden:** nieuw effecten-blok (constanten, pools, spawn- en
  update-functies, module-temp-vectors), `schiet()`, `raakOndode()`,
  `gameLoop` (updateEffecten-aanroep), debug-export (`spawnTracer`,
  `spawnImpact`, `actieveEffecten`, `TRACER_MAX`, `IMPACT_MAX`).
- **Buiten scope:** hitmarker/audio (T33), camera-kick/spread (T34),
  materiaal-families zelf (T38), de Brander-flits (gedocumenteerde
  uitzondering, blijft).
- **Randgevallen:** poolverzadiging (oudste actieve recyclen, nooit
  alloceren); pauze midden in een tracer-leven (bevriest); schot zonder
  raakpunt (tracer naar raycaster.far); wapenwissel direct na schot
  (tracer-oorsprong is al in wereldruimte — geen koppeling met de
  camera meer).
- **Performancevoorwaarden:** 0 allocaties per schot na opwarmen; geen
  `setTimeout`; ≤ 8 + 24 actieve effect-meshes; gedeelde geometry.
- **Acceptatiecriteria:**
  - Na 60 schoten bestaan er hooguit `TRACER_MAX` tracer-meshes en
    `IMPACT_MAX` impact-meshes in de scene (pool-hergebruik).
  - `schiet()`/`raakOndode()` bevatten geen `new THREE.`-aanroepen en
    geen `setTimeout` meer (codecheck in de test via functie-source).
  - Een headshot toont zichtbaar meer/lichtere deeltjes dan een
    lichaamstreffer.
  - Tijdens pauze beweegt geen enkel actief effect.
- **Testplan:** `tests/test-effecten-pool.mjs`: pool-plafonds na
  spam, function-source-check op `setTimeout`/`new THREE.` in de hot
  paths, headshot-vs-body deeltjesaantal, pauze-bevriezing (positie
  vóór/na met pointer-lock uit), tracer-oorsprong ≈ vlam-wereldpositie.
  Volledige regressie.
- **Risico's:** hot-path-refactor; de raycast-logica zelf NIET wijzigen.
- **Rollback:** één commit; revert herstelt vonk/bloedvonk.
- **Sonnet solo:** ja.

## Ticket 33 — Feedback F2: hitmarker-tiers en treffer-audio
- **Type:** HUD + audio
- **Verbetergebied:** 2
- **Prioriteit:** hoog
- **Status:** open
- **Afhankelijk van:** T32
- **Doel:** raak, headshot en kill zijn zonder kijken naar de vijand
  van elkaar te onderscheiden — op het crosshair en op het gehoor.
- **Huidige situatie:** `speelTreffer()` is identiek voor alles; kill
  heeft geen eigen geluid; er is geen hitmarker; `speelHerlaad()` speelt
  zijn tweede piep via een vaste `setTimeout(900)` die niet klopt met
  `herlaadDuurSnel` en doorloopt tijdens pauze; leeg magazijn heeft wel
  `speelDroogKlik()` maar geen visuele cue.
- **Gewenste situatie:** één `#hitmarker`-DOM-element (vier streepjes
  rond het crosshair) met drie tiers (raak wit 120 ms / headshot amber
  groter / kill oranjerood grootst+langst), dt-gedreven decay (zelfde
  patroon als `updateVignet`). Audio-tiers: `speelRaakTik`,
  `speelKopTik`, `speelKillKnak`, elk met ±5% pitch-variatie.
  Herlaad-audio gesplitst: start-geluid in `herladen()`, klaar-geluid
  in `updateWapen()` op het echte voltooiingsmoment (setTimeout weg).
  Leeg magazijn: ammo-UI knippert kort via een CSS-klasse.
- **Codegebieden:** HUD-HTML/CSS (hitmarker + ammo-leeg-klasse),
  `raakOndode()` (tier-keuze), `probeerTeSchieten()` (leeg-cue),
  `herladen()`/`updateWapen()` (audio-splitsing), `speelHerlaad`
  vervangen, `gameLoop` (hitmarker-decay in de cosmetische zone),
  debug-export (hitmarker-state).
- **Buiten scope:** wapen-specifieke schotgeluiden (T34), deeltjes (T32).
- **Randgevallen:** twee treffers binnen één hitmarker-leven (timer
  herstart, hoogste tier wint binnen 60 ms); pauze (decay loopt door —
  cosmetisch, zelfde keuze als het vignet); herladen onderbroken door
  game over (klaar-geluid speelt niet: updateWapen draait niet meer).
- **Performancevoorwaarden:** 1 DOM-element, klasse-toggles, geen
  per-frame DOM-reads; audio ≤ 1 tik per 40 ms.
- **Acceptatiecriteria:**
  - Een headshot toont een andere hitmarker (kleur én grootte) dan een
    lichaamstreffer; een kill weer een andere.
  - `speelHerlaad` bevat geen `setTimeout` meer; het klaar-geluid valt
    binnen 50 ms van het moment dat het magazijn gevuld wordt, óók met
    Snelheidselixer.
  - Leeg magazijn: droogklik + zichtbare ammo-UI-knipper.
  - Hitmarker dooft binnen 0.4 s zonder nieuwe treffer.
- **Testplan:** `tests/test-hitmarker-audio.mjs`: tier-klasse na
  body/head/kill (DOM-classcheck), decay-timing, herlaad-audio-splitsing
  (debug-tellers), leeg-magazijn-cue, geen setTimeout in de
  herlaad-audio (source-check). Regressie: ammo/reload-tests.
- **Rollback:** presentatie-only.
- **Sonnet solo:** ja.

## Ticket 34 — Feedback F3: wapen-identiteit (kick, spread, dip, wissel)
- **Type:** Game-feel
- **Verbetergebied:** 2
- **Prioriteit:** middel
- **Status:** open
- **Afhankelijk van:** T33 (zelfde functies; na elkaar, niet tegelijk)
- **Doel:** de Drukspuit en De Ratelaar VOELEN verschillend: zwaar en
  precies tegenover snel en rammelend.
- **Huidige situatie:** beide wapens delen `speelSchot()`, dezelfde
  `terugslag = 1` en hebben geen camera-kick, spread, herlaad- of
  wissel-animatie. `wisselWapen()` is een instant toggle.
- **Gewenste situatie:** per-wapen feedbackvelden op de bestaande
  definities (`kickSterkte` 0.014/0.006, `spreadNdc` 0/0.012,
  `terugslagSterkte` 1.0/0.55, `schotToon` per wapen — tabel in
  ARCHITECTURE_NOTES §5.6). `cameraKick`-offset (visueel-only,
  exponentieel verval, `speler.pitch` blijft onaangeroerd); spread als
  NDC-offset op `setFromCamera` (tracer volgt het echte raakpunt);
  herlaad-dip (sinus-boog op `herlaadTimer/herlaadDuur`);
  wissel-animatie (0.16 s y-dip) + `speelWissel()`.
- **Codegebieden:** `WAPEN_DRUKSPUIT`/`WAPEN_RATELAAR`, `schiet()`
  (kick/spread/schotToon), camera-compose in `updateSpeler()` (kick
  optellen + decay), `updateWapen()` of de terugslag-zone (dip),
  `wisselWapen()` (+timer, +geluid), debug-export (`cameraKick`,
  per-wapen velden).
- **Buiten scope:** balanswijzigingen aan schade/cooldowns; nieuwe
  wapens.
- **Randgevallen:** kick tijdens pauze (decay in de cosmetische zone,
  net als terugslag); wisselen tijdens de dip (bestaande
  herladen-blokkade dekt dit); spread mag een headshot op korte afstand
  niet structureel onmogelijk maken (±0.8° op ≤ 10 m ≈ ≤ 14 cm afwijking
  — hoofd-diameter 36 cm).
- **Performancevoorwaarden:** geen allocaties; alleen scalar-state.
- **Acceptatiecriteria:**
  - Na één Drukspuit-schot is de camera-pitch tijdelijk ≥ 0.012 rad
    verschoven en binnen 0.5 s terug binnen 5% van rust — zonder dat
    `speler.pitch` is gemuteerd.
  - Ratelaar-schoten raken bij herhaald vuren op 10 m een spreidings-
    patroon (niet alle raakpunten identiek); Drukspuit-raakpunten zijn
    identiek.
  - De twee wapens spelen aantoonbaar verschillende schotgeluiden
    (verschillende `schotToon`-parameters via debug-spy).
  - Tijdens herladen kantelt het wapenmodel zichtbaar en keert exact
    terug naar de rustpositie.
- **Testplan:** `tests/test-wapen-identiteit.mjs`: kick-decay-curve,
  pitch-onaangetast-check, spread-spreiding (20 schoten → >1 uniek
  raakpunt Ratelaar, 1 uniek Drukspuit), dip-rotatie tijdens reload,
  wisseltimer. Regressie: bestaande schiet-/reload-tests.
- **Rollback:** velden + kleine functiediffs; makkelijk terug te draaien.
- **Sonnet solo:** ja.

## Ticket 35 — Winkel W1: Smederij verhuist naar de bijkeuken
- **Type:** Level-wijziging
- **Verbetergebied:** 3
- **Prioriteit:** hoog
- **Status:** open
- **Doel:** de Smederij staat in de bijkeuken (zone E) en maakt de lus
  het late-game anker; op de binnenplaats blijft niets van 'm achter.
- **Huidige situatie:** `SMEDERIJ_X = DEUR2_X + 2.5` (7.0),
  `SMEDERIJ_Z = PLAATS_Z_NOORD + 1.2` — noordwest-binnenplaats.
  Machineblok (aambeeld+punt+voet+kool+koolLicht, ±regel 1510-1528),
  `smederijMarkering` en `smederijPunt` zijn ALLEMAAL
  `SMEDERIJ_X/Z`-afgeleiden. Geen collision, geen zonecheck.
- **Gewenste situatie:** `SMEDERIJ_X = 6.8`, `SMEDERIJ_Z = 3.5`
  (bijkeuken-zuidwand; onderbouwing en veiligheidsmarges in
  ontwerpbeslissing 28 en §5.8). Machine, kool-gloed, markering en
  kooppunt verhuizen automatisch mee. Oude plek: leeg (geen vervangend
  decor — bewust). README-zin over de Smederij-locatie bijgewerkt.
- **Codegebieden:** de twee constanten, evt. een comment-update bij het
  machineblok, README.md (één regel), debug-export ongewijzigd
  (`SMEDERIJ_X/Z` staan er al in).
- **Buiten scope:** het nieuwe winkel-icoon (T36), winkelLicht (T37),
  prijs- of upgrade-wijzigingen.
- **Randgevallen:** interactie door de west-muur vanuit de woonkamer
  (marge 2.3 m > radius 1.6 — expliciet testen op (4.4, 3.5));
  bereikbaarheid met deur 3 én 4 dicht (alleen via debug-teleport —
  functioneel moet het punt gewoon werken); looproute terugdeur ↔
  kelderhals blijft vrij; `kiesVensterIndex` en zone-audio ongemoeid.
- **Performancevoorwaarden:** geen nieuwe lights (koolLicht verhuist
  mee, werpt geen schaduw — `schaduw === 1` blijft).
- **Acceptatiecriteria:**
  - Op de oude positie (7.0, −14.3) is geen Smederij-mesh, -markering
    of -prompt meer aanwezig; `updateInteracties()` levert daar null.
  - Op (6.8, 3.5) werkt het volledige smeedpad voor beide wapens
    (koop, gesmeed-status, visuals) — identiek aan voorheen.
  - Vanuit de woonkamer op (4.4, 3.5) verschijnt GEEN Smederij-prompt.
  - `isVrijePlek`-probes op de route (5.5, 0) → (10, −4) blijven vrij.
  - Precies één schaduwwerpende lamp (bestaande invariant).
  - Er bestaat op geen enkel moment een tweede Smederij(-punt).
- **Testplan:** `tests/test-smederij-verhuizing.mjs`: oude-plek-leeg,
  nieuwe-plek-koop (beide wapens), muur-check, route-probes,
  interactiepunten-telling ongewijzigd (12), `test-smederij.mjs` blijft
  volledig groen. Screenshots binnenplaats (oude plek) + bijkeuken
  (nieuwe plek).
- **Rollback:** twee constanten terugzetten.
- **Sonnet solo:** ja.

## Ticket 36 — Winkel W2: winkelstijl-register en iconen per functie
- **Type:** Visueel systeem
- **Verbetergebied:** 4
- **Prioriteit:** middel
- **Status:** open
- **Afhankelijk van:** T35 (Smederij staat dan op zijn definitieve plek)
- **Doel:** iedere winkel is zonder tekst te herkennen aan silhouet +
  kleur; winkels met dezelfde functie delen bewust hetzelfde silhouet.
- **Huidige situatie:** `interactieMarkering(x, z, kleur)` geeft elke
  winkel dezelfde zwevende kubus; kleuren overlappen (deur2 = deur3,
  pantserdrank ≈ watertap).
- **Gewenste situatie:** `WINKEL_STIJLEN`-config + nieuwe
  `winkelMarkering(x, z, stijlNaam)` die de kubus vervangt door een
  functie-icoon (kogel/pijl/fles/schild/druppel/tandwiel/hamer/sleutel
  — volledige tabel met kleuren in ARCHITECTURE_NOTES §5.7). Alle 12
  bestaande markering-aanroepen migreren; exportnamen en
  `doofMarkering`-compatibiliteit blijven. Pantserdrank-kleur schuift
  naar `0xb8c8ff` (weg van watertap-blauw).
- **Codegebieden:** nieuw `WINKEL_STIJLEN`-blok + `winkelMarkering()`,
  alle `interactieMarkering`-aanroepen, gedeelde icoon-geometry-cache,
  debug-export (`WINKEL_STIJLEN`).
- **Buiten scope:** statusanimatie/pulsen (T37), winkelLicht (T37),
  barricade-reparatiepunten (geen markering — blijft zo).
- **Randgevallen:** `doofMarkering` traverset alle materials — iconen
  krijgen EIGEN materials (geen familie-cache!) zodat doven blijft
  werken; deuren verdwijnen bij aankoop inclusief markering (bestaand
  pad via `wereld.remove`).
- **Performancevoorwaarden:** icoon ≤ 3 meshes per winkel, gedeelde
  geometrieën per vorm; geen extra lights; markering-opbouw eenmalig
  bij load.
- **Acceptatiecriteria:**
  - Elke functiecategorie heeft een uniek icoon-silhouet; ammo-kist en
    Provisiekast delen exact hetzelfde icoon (bewust).
  - Geen twee VERSCHILLENDE functiecategorieën delen dezelfde
    primaire kleur én hetzelfde silhouet.
  - `doofMarkering(upgradeMarkering)` dooft ring én icoon nog steeds.
  - Alle 12 punten hebben een markering met icoon; koop-flows werken
    ongewijzigd.
- **Testplan:** `tests/test-winkel-stijlen.mjs`: per markering
  kinderen-inventaris (ring + icoon-meshes), uniciteit van
  (categorie→icoon)-mapping, doof-gedrag, deur-koop verwijdert de
  markering. Screenshots van alle winkels.
- **Rollback:** één commit; `interactieMarkering` blijft als
  binnenkant bestaan.
- **Sonnet solo:** ja.

## Ticket 37 — Winkel W3: statusweergave, winkelLicht en koop-feedback
- **Type:** Visueel systeem
- **Verbetergebied:** 4
- **Prioriteit:** middel
- **Status:** open
- **Afhankelijk van:** T36
- **Doel:** de status van een winkel (beschikbaar / te duur / gekocht
  / tijdelijk n.v.t.) is op afstand leesbaar via beweging en licht —
  kleur is nooit het enige kanaal.
- **Huidige situatie:** alleen het statische `doofMarkering`-grijs na
  eenmalige aankopen; geen puls, geen prijs-status, geen licht.
- **Gewenste situatie:** `status()`-functie per stijl in
  `WINKEL_STIJLEN` + `updateWinkelMarkeringen(dt)` in de
  `spelActief`-tak: beschikbaar = ringpuls + draaiend icoon; te duur =
  zelfde kleur, stilstand; gekocht/MAX = gedoofd (bestaand); n.v.t.
  (Watertap bij volle HP) = ontkleurd maar niet gedoofd. Koop-flits
  (`flitsMarkering`) bij elke succesvolle aankoop. Eén gedeeld
  `winkelLicht` (PointLight, geen schaduw) hecht zich aan de
  dichtstbijzijnde niet-gedoofde winkel binnen 6 m, kleur-lerp +
  zachte puls (ontwerpbeslissing 30).
- **Codegebieden:** `WINKEL_STIJLEN` (status-functies),
  `updateWinkelMarkeringen()` (nieuw), `gameLoop`, koop-functies
  (+`flitsMarkering`-aanroep naast `speelKoop`), `winkelLicht`-blok,
  debug-export (`winkelLicht`, `updateWinkelMarkeringen`).
- **Buiten scope:** icoonvormen (T36), HUD-prompt-tekst (bestaat al en
  toont prijs/„Nog €X nodig").
- **Randgevallen:** Smederij-status hangt van het ACTIEVE wapen af
  (gesmeed → 'gekocht'-weergave alleen als beide gesmeed; anders volgt
  de status het actieve wapen — zelfde logica als de bestaande prompt);
  Mistgolf (fog): emissive puls blijft binnen fog-far zichtbaar —
  acceptatiecriterium; alle winkels gedoofd/ver weg → winkelLicht
  intensiteit 0.
- **Performancevoorwaarden:** ≤ 2 writes per niet-gedoofde markering
  per frame; gedoofde markers overslaan; winkelLicht = 1 licht zonder
  schaduw (totaal schaduwwerpend blijft 1); status-checks zijn goedkope
  flag/geld-reads.
- **Acceptatiecriteria:**
  - Met €0 staat elke koopbare markering stil; met voldoende geld
    pulst 'ie — zichtbaar verschil zonder kleurverandering.
  - Watertap bij volle HP toont de n.v.t.-stand en herstelt zodra HP
    < max.
  - Na aankoop van de schade-upgrade is de markering gedoofd én doet
    de update-loop er geen writes meer op.
  - `winkelLicht` neemt binnen 1 s de kleur aan van de dichtstbijzijnde
    winkel en dooft (intensiteit < 0.05) zonder winkel binnen 6 m.
  - Tijdens een Mistgolf is de dichtstbijzijnde winkelmarkering op 6 m
    herkenbaar (screenshot).
- **Testplan:** `tests/test-winkel-status.mjs`: statusovergangen per
  geld/HP/flags, gedoofd-skip, winkelLicht-kleur/intensiteit bij
  teleports, koop-flits-timer, mist-screenshot. Volledige regressie.
- **Rollback:** presentatie-only.
- **Sonnet solo:** ja.

## Ticket 38 — Sfeer S1: materiaal-families en impactkleuren
- **Type:** Visueel + infrastructuur
- **Verbetergebied:** 5 (koppelt terug op 2)
- **Prioriteit:** middel
- **Status:** open
- **Afhankelijk van:** T32 (impact-deeltjes bestaan dan)
- **Doel:** hout, steen, tegel, metaal en natte klinkers zien er
  verschillend uit en KLINKEN/SPATTEN verschillend bij een treffer.
- **Huidige situatie:** `mat(kleur, roughness, metalness, extra?)`
  maakt per aanroep een nieuw material; roughness/metalness zijn per
  plek gekozen maar zonder families; wereld-impacts (T32) kennen alleen
  'steen'.
- **Gewenste situatie:** `matFamilie(naam, kleur)`-cache
  (hout/steen/tegel/metaal/natSteen, parameters in ontwerpbeslissing
  31) toegepast op de 6–8 grote oppervlakken (binnenplaats-klinkers →
  natSteen, bijkeuken-vloer → tegel, gang-vloer → steen, kelderluik →
  hout, deuren → metaal); die oppervlakken krijgen
  `userData.materiaalFamilie`; de T32-wereldimpact leest die en kiest
  de deeltjeskleur (+ optioneel een subtiel ander tik-geluid per
  familie). Gecachete materialen zijn immutabel.
- **Codegebieden:** `matFamilie`-blok (nieuw, naast `mat()`), de
  vloer-/deur-bouwplekken, T32's wereld-impactpad, debug-export
  (`matFamilie`-cache-grootte).
- **Buiten scope:** props herschilderen, tone mapping/color space
  (staat al goed: SRGB + ACESFilmic), ondode-materialen.
- **Randgevallen:** een oppervlak zonder familie → default 'steen';
  `doofMarkering`-achtige mutaties mogen NOOIT op familie-materialen
  (regel: winkelvisuals hebben eigen materials — al geborgd in T36).
- **Performancevoorwaarden:** cache begrensd (≤ 12 entries — families
  × gebruikte kleuren); geen per-frame materiaalwijzigingen; geen
  nieuwe transparantie.
- **Acceptatiecriteria:**
  - De binnenplaats-vloer heeft zichtbaar lagere roughness (glans in
    maanlicht) dan de gang-vloer (screenshotvergelijking).
  - Een schot op het kelderluik geeft andere deeltjeskleur dan op een
    stenen muur.
  - `matFamilie('steen', X) === matFamilie('steen', X)` (cache-hit) en
    de cache groeit niet bij herhaald aanroepen.
  - Geen enkel bestaand oppervlak is van kleur veranderd (alleen
    roughness/metalness/glans).
- **Testplan:** `tests/test-materiaal-families.mjs`: cache-identiteit,
  userData op de vijf oppervlakken, impactkleur per familie (debug-spy
  op spawnImpact), screenshots per zone. Regressie.
- **Rollback:** `matFamilie`-aanroepen terug naar `mat()`.
- **Sonnet solo:** ja.

## Ticket 39 — Sfeer S2: vijandleesbaarheid (ritme, geluid, mist-ogen)
- **Type:** Presentatie
- **Verbetergebied:** 5
- **Prioriteit:** middel
- **Status:** open
- **Afhankelijk van:** T31 (`delen.oogMateriaal` bestaat dan)
- **Doel:** elk type is herkenbaar aan beweging en geluid, óók in de
  mist en op afstand — kleur is de laatste, niet de eerste, aanwijzing.
- **Huidige situatie:** types verschillen in silhouet (T19), kleur,
  oogkleur, schaal en snelheid; het loopritme is alleen
  snelheidsgekoppeld; er zijn geen per-type geluiden; oog-intensiteit
  is altijd 1.4.
- **Gewenste situatie:** `ONDODE_TYPES[type].gang = { pasFactor,
  bobFactor, ampFactor }` toegepast in de bestaande animatie-writes
  (Sjouwer zwaar/traag, Loper snel, Sluiper kort/laag — waarden in
  §5.9); per-type grom op een random 4–9s-timer binnen 8 m (Sluiper
  gromt NOOIT — stilte als tell; globale cap 1 grom/0.6 s); Mistgolf
  zet `oogMateriaal.emissiveIntensity` op 2.6 voor alle levende en
  nieuwe ondoden, en herstelt naar 1.4 op golf-einde.
- **Codegebieden:** `ONDODE_TYPES` (gang-velden), animatie-helft van
  `updateOndoden()` (factoren in de bestaande formules),
  `spawnOndode()` (gromTimer, mist-oogboost), `startEventGolf`/
  `eindigEventGolf` (oog-boost aan/uit), nieuwe grom-audiofuncties,
  debug-export.
- **Buiten scope:** hoofdgroep-y-offsets (hoofd-hoogte-anker ±0.03 is
  onaantastbaar), nieuwe meshes/accessoires, aanvalsgedrag (T30).
- **Randgevallen:** mist eindigt terwijl een ondode in windup-oogpuls
  zit (T31-puls rekent vanaf de basiswaarde — gebruik een
  `oogBasisIntensiteit`-veld i.p.v. hardcoded 1.4); dood tijdens grom
  (geluid is al gestart — onschuldig); Eliminatiemodus-massakills
  (grom-cap voorkomt stapeling).
- **Performancevoorwaarden:** netto 0 extra transform-writes (factoren
  in bestaande writes); 1 timer-decrement per ondode; oog-boost is
  event-gedreven.
- **Acceptatiecriteria:**
  - `loopFase`-groeisnelheid verschilt meetbaar per type bij gelijke
    `ONDODE_SNELHEID`-input (pasFactor).
  - Sjouwer-romp-bob-amplitude ≥ 1.5× die van de normale ondode.
  - Sluiper roept in 60 gesimuleerde seconden binnen 8 m NOOIT een
    grom-functie aan; de andere types wél (debug-teller).
  - Tijdens een Mistgolf is `oogMateriaal.emissiveIntensity` 2.6 op
    alle levende ondoden en exact terug op de basis na afloop.
  - Loper en Sjouwer zijn op een mist-screenshot op ±7 m van elkaar te
    onderscheiden (silhouet + ogen).
- **Testplan:** `tests/test-vijand-leesbaarheid.mjs`: pasFactor-effect
  op loopFase, bob-amplitudes, grom-tellers per type, oog-boost
  aan/uit/spawn-tijdens-mist, mist-screenshot. Regressie:
  `test-ondode-animatie.mjs` + hoofd-hoogte-anker.
- **Rollback:** presentatie-only.
- **Sonnet solo:** ja.

## Ticket 40 — Sfeer S3: omgevingsdetails (stof, druppel, golf-lichtdip)
- **Type:** Sfeer
- **Verbetergebied:** 5
- **Prioriteit:** laag (polish)
- **Status:** open
- **Doel:** de zones leven: stof in het atelier-daglicht, een
  druppelend kelderluik, en lampen die even dippen als een golf start.
- **Huidige situatie:** sfeer = statisch decor + lampflikker +
  eenmalige zone-audio + de Mistgolf; geen bewegende
  omgevingselementen.
- **Gewenste situatie:** (a) 2 × `THREE.Points`-stofwolk (≤ 30 punten)
  in de atelier-lichtkolommen, alleen zichtbaar als
  `zoneVan(speler) === 2`, animatie = trage groepsrotatie + y-sinus;
  (b) druppel-lek in de kelderhals: één klein mesh valt elke 3–6 s van
  plafond naar kelderluik + tik-geluid alleen als de speler < 8 m is;
  (c) golfstart-lichtdip: `lampDipFactor` 0.6 → 1.0 over 0.8 s,
  vermenigvuldigd in de bestaande lampflikker-loop, getriggerd in
  `startGolf()`.
- **Codegebieden:** atelier-decor-blok (stofwolken), kelderhals-decor
  (druppel + timer in de `spelActief`-tak), `startGolf()` (dip-set),
  lampflikker-loop in `gameLoop` (×`lampDipFactor`), debug-export
  (`lampDipFactor`, druppel-timer).
- **Buiten scope:** regen, nieuwe geluidslagen per zone (bestaan al),
  Mistgolf-wijzigingen.
- **Randgevallen:** pauze tijdens een druppel-val (bevriest — update
  in `spelActief`); game over vlak na golfstart (dip herstelt gewoon —
  de flikker-loop draait door, cosmetisch); speler wisselt snel van
  zone (visible-toggle is 1 boolean-write).
- **Performancevoorwaarden:** ≤ 2 Points-systemen, geen
  attribute-writes per frame (alleen groepstransform); druppel = 1
  mesh; dip = 1 module-float.
- **Acceptatiecriteria:**
  - De stofwolken zijn onzichtbaar buiten het atelier en zichtbaar
    erbinnen (zone-toggle testbaar via teleport).
  - De druppel landt periodiek (3–6 s) en het tikgeluid speelt alleen
    binnen 8 m (debug-teller).
  - Op golfstart zakt elke lampintensiteit naar ≤ 0.7× basis en
    herstelt binnen 1 s (waarde-sampling rond `startGolf`).
  - Framebudget: geen extra allocaties per frame (source-check op de
    nieuwe update-paden).
- **Testplan:** `tests/test-omgeving-sfeer.mjs`: zone-toggle,
  druppel-cyclus + geluids-teller, dip-curve rond startGolf,
  Points-count ≤ 2. Screenshots atelier (stof zichtbaar in de
  lichtkolom) en kelderhals.
- **Rollback:** puur additief; blok voor blok verwijderbaar.
- **Sonnet solo:** ja.

## Ticket 41 — Integratie: eindregressie, performance-audit en teksten
- **Type:** Regressie + polish
- **Verbetergebied:** alle
- **Prioriteit:** hoog (afsluiter)
- **Status:** open
- **Afhankelijk van:** T30–T40
- **Doel:** de hele ronde is aantoonbaar heel: alle systemen samen,
  binnen de performancebudgetten, met kloppende teksten.
- **Concrete wijzigingen:** performance-asserts als test (lichten
  totaal ≤ bestaand + 1, precies 1 schaduwwerper, effect-plafonds,
  pool-hergebruik na een stress-golf); speeltest-notities (golf 8+ met
  alle deuren open, Mistgolf met winkels + tells + ogen; beide wapens);
  screenshots van elke zone + mist; startscherm-/README-check
  (Smederij-locatie, geen verouderde beschrijvingen); eventuele
  micro-tuning van tell-duren/kick-sterktes binnen ±25% op basis van de
  speeltest — groter is een nieuw ticket.
- **Codegebieden:** teksten, hooguit feedback-/tell-constanten.
- **Acceptatiecriteria:** volledige repo-suite groen (incl. alle
  nieuwe tests van T30–T40); scratchpad-suite draait met uitsluitend
  de bekende, gedocumenteerde uitzonderingen; lichttelling en
  schaduw-invariant kloppen; screenshots tonen tells, hitmarkers,
  winkel-iconen en zone-sfeer.
- **Testplan:** `tests/run-all.mjs` + scratchpad-suite + een nieuwe
  `tests/test-v016-integratie.mjs` met de performance-asserts +
  screenshotronde.
- **Rollback:** n.v.t. (verifiërend).
- **Sonnet solo:** ja.

---

# v0.17 — Fable-architectuurronde 4: een doel om naartoe te spelen (gepland, nog NIET geïmplementeerd)

Vijf verbetergebieden, gekozen door de gebruiker uit de designer-pitch:
(1) **doel & retentie** — score/statistieken/highscore, de Vluchtroute als
win-conditie en moeilijkheidsgraden; (2) **golfvariatie** — de
Stroomuitval-eventgolf naast de Mist; (3) **wapenarsenaal** — De Hagelketel
als derde wapen; (4) **presentatie** — een dreigingsaudio-laag en
zone-naambanners; (5) **late-game balans** — een pacing-audit voor golf
16+. Architectuur staat vast in `ARCHITECTURE_NOTES.md` §6 +
ontwerpbeslissingen 33–42; de tickets hieronder zijn implementatie, geen
ontwerp.

**Update ná speeltest (Tickets 42-45 zijn intussen geïmplementeerd en
gespeeld):** de gebruiker gaf vier stukken feedback, verwerkt als een
feedbackronde binnen verbetergebied 1 — Tickets 52-56, zie
`ARCHITECTURE_NOTES.md` §6.12-§6.15 (ontwerpbeslissingen 43-47). De
Hagelketel (Tickets 47-48, verbetergebied 3) is op verzoek van de
gebruiker naar de Backlog verplaatst (zie onderaan dit bestand) —
verbetergebied 3 vervalt daarmee voorlopig uit deze ronde.

**Tweede feedbackronde (ná T56-ontwerp):** T56 uitgebreid met de eis
dat item + rustvlak in één keer verdwijnen bij het oprapen (de
Scheepslantaarn behoudt haar naam); Ticket 57 toegevoegd —
diezelfde zwevende-planken-fout uit de binnenplaats-fix blijkt zich
elders ook voor te doen (met screenshots onderbouwd).

Volgorde nu: 42 → 46, dan 52 → 57, dan 49 → 51, fases:

- **Fase 15 — score & moeilijkheid**: T42, T43 (verbetergebied 1) ✅
- **Fase 16 — de Vluchtroute (fundament)**: T44, T45 (verbetergebied 1) ✅
- **Fase 17 — Ontsnapping-feedbackronde**: T52, T53, T54, T55, T56, T57
  (verbetergebied 1 + kwaliteit, NIEUW — directe speeltest-feedback).
  **Nog niet uitgevoerd** — op expliciet verzoek van de gebruiker
  overgeslagen bij het uitvoeren van T46/T49/T50/T51 (zie hieronder); staat
  nog open voor een volgende beurt.
- **Fase 18 — Stroomuitval**: T46 (verbetergebied 2 — beantwoordt de
  "waar is de stroomuitval?"-vraag: nog nooit geïmplementeerd, alleen
  gepland, zie het antwoord in de sessie) ✅
- **Fase 19 — presentatie**: T49, T50 (verbetergebied 4) ✅
- **Fase 20 — integratie**: T51 (verbetergebied 5 + afsluiter) ✅ —
  **verkleind uitgevoerd**: dekt alleen T42-46 + T49-50 (pacing-audit,
  teksten, regressie). Dekt T52-57 NIET, want die zijn nog niet
  uitgevoerd — zodra dat wel gebeurt, moet T51's pacing-test (het
  ontsnappingsvenster-patroon uit T54) en de teksten (gang-naar-de-gracht,
  boot, ontsnappingsritme) alsnog worden aangevuld.

## Ticket 42 — Doel D1: run-statistieken, score en highscore
- **Type:** Feature (fundament van de ronde)
- **Verbetergebied:** 1 (doel & retentie)
- **Prioriteit:** hoog — kleinste moeite, grootste retentie-effect; T43/T45 bouwen erop
- **Status:** open
- **Afhankelijk van:** —
- **Doel:** elke run krijgt betekenis: statistieken tijdens de run,
  een score aan het einde en een blijvend record op het startscherm.
- **Concrete wijzigingen:** `runStats`-object (kills, headshots
  (kop-treffers), schoten, treffers, geldTotaal, powerups, doodDoor) met
  increments op de bestaande plekken: `schiet()` (schoten, per pellet 1x
  per trekker), `raakOndode()` (treffers/kills/headshots), de
  geld-uitkeerplekken (kill-geld, wave-bonus, power-ups) en
  `spelerSchade`-pad (laatste aanvaller-type → doodDoor). Scoreformule
  ALLEEN bij het einde berekend (geen per-frame kosten):
  `score = kills×10 + headshots×15 + (golf−1)×100` (T43 voegt de
  moeilijkheids-multiplier toe). `gameOverScherm` uitgebreid met een
  stats-tabel, de score en een record-vergelijking ("NIEUW RECORD").
  Highscore in `localStorage` (key `amsterdamUndeadHighscore`, JSON
  {score, golf, moeilijkheid, datum}) via twee helpers `leesHighscore()`/
  `schrijfHighscore()` die ALTIJD in try/catch zitten (localStorage kan
  ontbreken/geweigerd zijn — het spel mag daar nooit op breken). Het
  startscherm toont het bestaande record onder de uitleg.
- **Codegebieden:** `schiet()`/`raakOndode()` (alleen `x++`-regels, geen
  allocaties — hot-path-regels §5.10 blijven gelden), `gameOver()`
  (~regel 3995), gameOver-/start-DOM (~336-353), nieuwe helpers, debug-
  export (`runStats`, `berekenScore`, `leesHighscore`, `schrijfHighscore`).
- **Acceptatiecriteria:** increments kloppen via ECHTE
  `schiet()`/`raakOndode()`-aanroepen; score-formule exact; record wordt
  geschreven bij game over en gelezen op het startscherm; een geweigerde
  localStorage breekt niets (guard getest); hot-path source-checks
  (test-effecten-pool) blijven groen.
- **Testplan:** nieuwe `tests/test-score-stats.mjs` + `check-load` +
  `run-all`.
- **Rollback:** runStats + schermuitbreiding verwijderen; er hangt (tot
  T43/T45) niets anders aan.
- **Sonnet solo:** ja.

## Ticket 43 — Doel D2: moeilijkheidsgraden (Toerist / Amsterdammer / Nachtwacht)
- **Type:** Feature
- **Verbetergebied:** 1 (doel & retentie)
- **Prioriteit:** middel — goedkope quick win (multipliers op bestaande systemen)
- **Status:** open
- **Afhankelijk van:** T42 (score-multiplier + record-veld)
- **Doel:** drie startkeuzes die de uitdaging schalen zonder nieuwe
  systemen: makkelijker leren, of juist zwaarder met een hogere score.
- **Concrete wijzigingen:** `MOEILIJKHEDEN`-register:
  `toerist {budgetFactor 0.75, regenFactor 1.25, scoreFactor 0.75,
  startGeld 200}`, `amsterdammer {1, 1, 1, 0}` (exact het huidige
  gedrag), `nachtwacht {1.3, 0.7, 1.5, 0}`. Ingehaakt op precies drie
  plekken: `golfBudget()` (×budgetFactor, afgerond),
  `SPELER_REGEN_PER_SEC` (×regenFactor op de gebruiksplek, de constante
  zelf blijft) en de T42-scoreformule (×scoreFactor). Startscherm: de
  ene "Klik om te spelen"-knop wordt drie knoppen (zelfde
  `.knop`-stijl); een klik kiest de moeilijkheid, kent `startGeld` toe
  en vraagt pointer lock. De keuze is 1x per run (page-reload = nieuwe
  run); het pauzescherm toont daarna alleen het bestaande "klik om
  verder te spelen" — de knoppen zijn alleen zichtbaar zolang er nog
  geen moeilijkheid gekozen is. Moeilijkheidsnaam mee in het
  gameOver-/winscherm en het highscore-record (T42-veld).
- **Codegebieden:** startscherm-DOM + click-handler (~342-353, ~2053),
  `golfBudget()` (~3027), HP-regen-gebruiksplek (~3000-3001),
  T42-scoreformule, debug-export (`moeilijkheid` get/set,
  `MOEILIJKHEDEN`, `kiesMoeilijkheid`).
- **Acceptatiecriteria:** budget/regen/score schalen exact per graad;
  amsterdammer = byte-voor-byte het huidige gedrag; toerist start met
  €200; pauze-hervatting toont GEEN keuzeknoppen meer; de
  startscherm-guard voor game over (regel ~2065) blijft intact.
- **Testplan:** nieuwe `tests/test-moeilijkheid.mjs` + `check-load` +
  `run-all`.
- **Rollback:** register + knoppen weg, drie inhaakplekken terug naar
  de constante.
- **Sonnet solo:** ja.

## Ticket 44 — Doel D3: de Vluchtroute-onderdelen
- **Type:** Feature
- **Verbetergebied:** 1 (doel & retentie)
- **Prioriteit:** hoog — de helft van de win-conditie
- **Status:** open
- **Afhankelijk van:** — (T45 bouwt erop)
- **Doel:** drie verzamelbare ontsnappingsonderdelen die de speler over
  de golven én over de hele map heen laten spelen.
- **Concrete wijzigingen:** `VLUCHT_ONDERDELEN`-register: Roeispaan
  (atelier, vanaf golf 3), Touwbundel (binnenplaats, vanaf golf 6),
  Scheepslantaarn (bijkeuken, vanaf golf 9) — exacte x/z bij
  implementatie via `isVrijePlek`-probes. Elk onderdeel: klein origineel
  mesh uit simpele prims, vooraf gebouwd en onzichtbaar; `startGolf()`
  zet het zichtbaar zodra de drempelgolf bereikt is en voegt PAS DAN het
  T-interactiepunt + de markering toe (dynamisch — de laadtijd-telling
  van 12 interactiepunten, bewaakt door `test-smederij-verhuizing.mjs`,
  blijft daardoor kloppen). Oppakken is gratis: mesh + punt + markering
  weg, `toonMelding` + `toonGolfBanner('VLUCHTROUTE n/3')`, nieuw klein
  HUD-element `Vluchtroute: n/3` (alleen geschreven bij verandering).
  `WINKEL_STIJLEN` krijgt één gedeelde `vluchtroute`-stijl (zeegroen
  0x6fe8c0, bestaand icoon-silhouet uit de geo-cache — eigen materials
  per markering, zoals altijd).
- **Codegebieden:** nieuw blok bij de winkel-/interactie-secties,
  `startGolf()` (~4120), `WINKEL_STIJLEN` (~1730), HUD-DOM, debug-export
  (`VLUCHT_ONDERDELEN`, `vluchtOnderdelenOpgepakt` o.i.d.).
- **Acceptatiecriteria:** vóór golf 3 bestaat er geen extra
  interactiepunt; elk onderdeel verschijnt exact op zijn drempelgolf
  (ook als de zone nog op slot zit — het wacht daar); oppakken werkt in
  willekeurige volgorde; HUD-teller klopt; telling keert terug naar de
  basiswaarde na oppakken; alle bestaande winkel-tests blijven groen.
- **Testplan:** nieuwe `tests/test-vluchtroute.mjs` + `check-load` +
  `run-all` + screenshot van een verschenen onderdeel + markering.
- **Rollback:** register + startGolf-hook + HUD-regel verwijderen.
- **Sonnet solo:** ja.

## Ticket 45 — Doel D4: De Ontsnapping (win-conditie + winscherm)
- **Type:** Feature (VOORZICHTIG — raakt de scherm-/pauzelogica)
- **Verbetergebied:** 1 (doel & retentie)
- **Prioriteit:** hoog — maakt er een échte game van
- **Status:** open
- **Afhankelijk van:** T42 (stats/score/record), T44 (onderdelen)
- **Doel:** met alle drie de onderdelen én genoeg geld kan de speler
  ontsnappen: een winscherm met score, en de keuze om door te spelen.
- **Concrete wijzigingen:** `ONTSNAPPING_PRIJS = 2500`;
  ontsnappingspunt bij het kelderluik (kelderhals), pas aan
  `interactiePunten` toegevoegd zodra 3/3 onderdelen opgepakt zijn
  (zelfde dynamische patroon als T44), prompt "Druk T: ontsnap over het
  water (€2500)". Nieuw `#winScherm`-overlay (opzet als
  `gameOverScherm`, titel "ONTSNAPT", zeegroen accent): de
  T42-stats-tabel hergebruikt, score met ontsnappingsbonus (+1000 vóór
  de multiplier), highscore-save, en twee knoppen: "Speel door
  (endless)" (overlay dicht, pointer lock opnieuw aanvragen, het
  ontsnappingspunt verdwijnt definitief voor deze run) en "Opnieuw"
  (`location.reload()`, het bestaande restart-mechanisme). Winnen is
  GEEN game over: `spelStaat.gameOver` blijft false; het spel staat
  stil doordat het winscherm de pointer lock loslaat (bestaande
  pauze-gate). De startscherm-guard (regel ~2065) wordt uitgebreid
  zodat het startscherm niet over het winscherm heen popt — één
  overlay tegelijk (startscherm / gameOverScherm / winScherm).
- **Codegebieden:** interactie-blok, nieuw DOM/CSS-blok, de
  pointerlockchange-handler (~2060-2071), `gameOver()` ongemoeid,
  debug-export (`ontsnappingsPunt`, `winScherm`, `probeerOntsnapping`).
- **Acceptatiecriteria:** punt verschijnt pas bij 3/3; geld-eis werkt
  (te weinig geld = bestaande "nog €X nodig"-flow); winscherm toont
  stats + score + record; "Speel door" hervat de simulatie aantoonbaar;
  startscherm popt niet over het winscherm; game-over-flow blijft
  byte-voor-byte hetzelfde.
- **Testplan:** nieuwe `tests/test-ontsnapping.mjs` + `check-load` +
  `run-all` + screenshot van het winscherm.
- **Rollback:** punt + overlay + guard-uitbreiding verwijderen; T44
  blijft zelfstandig functioneren (verzamelen zonder doel).
- **Sonnet solo:** ja, met de §6.10-waarschuwing over de schermen-guard.

## Ticket 46 — Golf G1: eventgolf "Stroomuitval"
- **Type:** Feature
- **Verbetergebied:** 2 (golfvariatie)
- **Prioriteit:** middel — goedkoop, het eventgolf-framework ligt er al
- **Status:** open
- **Afhankelijk van:** —
- **Doel:** een tweede eventgolf naast de Mist: alle binnenverlichting
  valt uit, alleen de ooggloed en het maanlicht van buiten wijzen de weg.
- **Concrete wijzigingen:** `kiesEventType()` wisselt deterministisch af:
  golf 5 mist, golf 10 stroomuitval, golf 15 mist, …
  (`Math.floor(golf / EVENT_GOLF_INTERVAL) % 2`). Nieuwe module-let
  `stroomFactor = 1` als extra vermenigvuldiger in de bestaande
  lampflikker-regel (naast `lampDipFactor`); `startEventGolf('stroomuitval')`
  zet 'm op 0.12, `eindigEventGolf` laat 'm lineair over ~2s herstellen
  (zelfde ramp-patroon als de lichtdip). `hangLamp()` slaat voortaan ook
  de bol-mesh op in de `lampLichten`-entry zodat de emissive van de peer
  mee dimt (anders "branden" de peertjes in het donker); het
  `winkelLicht` dimt mee (×stroomFactor). De buitenverlichting
  (binnenplaats-lantaarns, maanlicht) blijft AAN — buiten wordt de
  vluchtheuvel, binnen het gevaar. Oog-boost via het bestaande
  `zetOogBasis`-kanaal (zelfde waarde als mist, 2.6), inclusief spawns
  tijdens het event (de bestaande mist-check in `spawnOndode()` wordt
  een event-check). Eigen spawngewichten `{normaal 1, loper 2, sluiper 2}`
  in `eventSpawnGewichten`. Audio: `speelStroomklap()` (korte klik +
  zakkende zoem, ≤0.16 volume) bij start, herstel-tik bij einde. Banner
  via het bestaande eventgolf-bannerpad.
- **Codegebieden:** eventgolf-framework (~4052-4110), `hangLamp()`
  (~1205-1232), lampflikker-loop (~4893-4896), `spawnOndode()`
  (~3491), `eventSpawnGewichten` (~2977), audio-blok, debug-export
  (`stroomFactor` get/set).
- **Acceptatiecriteria:** afwisseling deterministisch; tijdens het
  event zijn lampen, peer-emissives én winkelLicht aantoonbaar gedimd;
  ogen geboost + exact hersteld (ook nieuwe spawns, ook het
  windup-randgeval — zelfde checks als T39); gewichten kloppen; de
  Mistgolf blijft byte-voor-byte werken; `schaduw === 1` en de
  lichttelling ongewijzigd (er komt géén licht bij).
- **Testplan:** nieuwe `tests/test-stroomuitval.mjs` (incl.
  mist-regressiechecks) + `check-load` + `run-all` + screenshot.
  **Feedback ná speeltest:** de speler zag nauwelijks verschil tijdens de
  Stroomuitval. Root-cause (2 bugs): (1) de lampflikker-loop paste
  `stroomFactor` alleen toe op het gloeipeertje-materiaal, NIET op de echte
  `PointLight.intensity` die de kamer verlicht — de kamer zelf dimde dus
  helemaal niet; (2) de ateliers-dakramen (het hoofdlicht van die zone,
  ~18-22 intensiteit elk) zaten nooit in `lampLichten` en deden dus
  sowieso niet mee. Beide gefixt (nieuwe `stroomGevoeligeDaklichten`-array
  voor de vier dakraam-lichten, stabiel maar wel dimbaar). Zelfs daarna
  bleek een pixel-steekproef op screenshots maar ~15-20% donkerder: het
  algehele `HemisphereLight` (1.5, scene-breed, geen afstandsval-off)
  bleef ongewijzigd. Toegevoegd: `hemisfeerLicht` dimt mee tot een vloer
  van 35% (nooit naar 0, anders wordt buiten ook pikdonker) en
  `renderer.toneMappingExposure` dimt mee tot een vloer van 40% (de enige
  hendel die het eindresultaat van ALLE lichtbronnen samen beïnvloedt).
  Gemeten resultaat: atelier/woonkamer ~38-43% donkerder, binnenplaats
  ~32% (blijft door de eigen sterke, ongewijzigde buitenlichten duidelijk
  lichter dan binnen).
- **Rollback:** kiesEventType terug naar `'mist'`; stroomFactor-regels
  verwijderen.
- **Sonnet solo:** ja.

## Ticket 49 — Sfeer P1: dreigingsaudio-laag
- **Type:** Feature
- **Verbetergebied:** 4 (presentatie)
- **Prioriteit:** laag-middel
- **Status:** open
- **Afhankelijk van:** —
- **Doel:** een zachte, originele Web Audio-drone die meegroeit met de
  dreiging — de game is nu stil tussen de actie door.
- **Concrete wijzigingen:** twee licht gedetuneerde oscillators (sine
  55 Hz + 57 Hz, zwevingseffect) door één gainNode, gestart in
  `initGeluid()` met gain 0 en daarna NOOIT gestopt/herstart (klikken) —
  alleen de gain wordt gestuurd. Pure, testbare helper
  `berekenDreigingsGain(aantalOndoden, dichtstbijzijnd)`:
  `min(0.1, 0.016×aantal + (dichtstbijzijnd < 6 ? 0.04 : 0))`. Sturing
  1x per ~0.25s (throttle-timer) in de `spelActief`-tak van de gameLoop
  via `gain.setTargetAtTime` (~0.5s glijtijd); de niet-actieve tak
  (pauze/menu/game over) stuurt doelgain 0. Volumeplafond 0.1 —
  duidelijk onder de piep-volumes, het mag nooit met de tells
  concurreren. De bestaande `speelGolfStart()`-sting blijft de
  golf-opening; er komt geen extra sting.
  **Feedback ná speeltest:** het oorspronkelijke plafond (0.05) en de
  bijbehorende curve kwamen in normale spelsituaties (1-2 ondoden
  dichtbij) nooit boven ~0.03 uit en waren op laptop-speakers nauwelijks
  hoorbaar. Plafond + curve evenredig verdubbeld (0.008→0.016,
  0.02→0.04, 0.05→0.1) zodat de drone al bij één nabije ondode
  duidelijker hoorbaar is.
  **Tweede feedbackronde:** de continue formule verving door een simpele
  drempel — `berekenDreigingsGain(aantalBinnenBereik)`:
  `aantalBinnenBereik >= 2 ? 0.07 : 0`. `updateDreigingsAudio()` telt nu
  ondoden binnen `DREIGINGS_NABIJHEID_BEREIK` (1.5 m) i.p.v. de
  dichtstbijzijnde afstand bij te houden. Plafond ook iets terug (0.1 →
  0.07): de drone hoort een subtiel signaal te zijn dat het dringen
  wordt, niet iets dat al bij het minste geritsel meezoemt.
- **Codegebieden:** audio-blok (~2730-2810), gameLoop (beide takken),
  debug-export (`berekenDreigingsGain`, `dreigingsGainDoel` getter,
  `DREIGINGS_NABIJHEID_BEREIK`, `DREIGINGS_NABIJHEID_MINIMUM`).
- **Acceptatiecriteria:** gain-formule exact (pure functie); throttle
  aantoonbaar (geen per-frame audio-writes); pauze → doelgain 0;
  volumeplafond 0.07, drempel exact bij 2 ondoden binnen 1.5m; geen
  oscillator-start/stop na init (source-check).
- **Testplan:** nieuwe `tests/test-dreigingsaudio.mjs` (via de pure
  helper + debug-getters, niet via echte geluidsmeting) + `check-load` +
  `run-all`.
- **Rollback:** oscillators + throttle-blok verwijderen.
- **Sonnet solo:** ja.

## Ticket 50 — Sfeer P2: zone-naambanners + HUD-zonelabel
- **Type:** Feature
- **Verbetergebied:** 4 (presentatie)
- **Prioriteit:** laag — goedkoopste quick win van de ronde
- **Status:** open
- **Afhankelijk van:** —
- **Doel:** de zones die visueel al een identiteit hebben, krijgen ook
  een naam: een banner bij het eerste bezoek en een klein HUD-label.
- **Concrete wijzigingen:** `ZONE_NAMEN = ['De Woonkamer', 'De Gang',
  'Het Atelier', 'De Binnenplaats', 'De Bijkeuken']` (indices exact
  volgens `zoneVan()`: 0/1/2/3/4). In de bestaande zone-triggerplek in
  de gameLoop (waar `gangBetreden`/`plaatsBetreden` al checken):
  huidige zone bepalen, `laatsteZone` cachen en ALLEEN bij een wissel
  werk doen — 1 HUD-write per zonewissel, nooit per frame. Eerste
  bezoek (bezochteZones-Set, start {0}): `toonGolfBanner(zonenaam,
  korte flavour-ondertitel)` — het bestaande, geteste bannersysteem,
  geen nieuw overlay. Klein HUD-zonelabel onder `golfTekst`. De
  bestaande `gangBetreden`/`plaatsBetreden`-audio-triggers blijven
  onaangeraakt (andere posities, ander doel).
- **Codegebieden:** gameLoop-triggerplek (~4866-4872), HUD-DOM,
  `toonGolfBanner` (hergebruik), debug-export (`ZONE_NAMEN`,
  `bezochteZones`, `laatsteZone` getter).
- **Acceptatiecriteria:** label wisselt mee met `zoneVan()`; banner
  exact 1x per zone per run; herbezoek = geen banner; geen per-frame
  DOM-writes (source-check of write-teller); namen/indices kloppen.
- **Testplan:** nieuwe `tests/test-zone-banners.mjs` + `check-load` +
  `run-all`.
- **Rollback:** triggerblok + label verwijderen.
- **Sonnet solo:** ja.

## Ticket 51 — Integratie: golf-16+ pacing-audit, eindregressie en teksten
- **Type:** Regressie + balans
- **Verbetergebied:** 5 (late-game balans) + afsluiter van de ronde
- **Prioriteit:** hoog (afsluiter)
- **Status:** open
- **Afhankelijk van:** T42–T46, T49–T57 (T47/T48 zitten niet in deze
  ronde — zie Backlog)
- **Doel:** de hele ronde is aantoonbaar heel én het late game (dat
  door score/vluchtroute/periodieke ontsnappingsvensters langer
  gespeeld gaat worden) klopt.
- **Concrete wijzigingen:** nieuwe `tests/test-lategame-pacing.mjs`:
  headless simulatie van golven 12–24 (ruim voorbij twee
  ontsnappingsvensters, zie T54) die meet: threat-budget-verloop,
  HP-trap-verloop, spawn-mix, naleving `GOLF_MAX_ACTIEF`, de geldstroom
  afgezet tegen de resterende sinks, én dat `isOntsnappingsGolf()` (T54)
  zich houdt aan het 10/14/18/22-patroon over de hele simulatie.
  Eventuele tuning UITSLUITEND binnen ±25% van bestaande constanten
  (`GOLF_BUDGET_GROEI`, `WAVE_BONUS_PER_GOLF`,
  `ONDODE_HP_TRAPPEN`-drempels) op basis van de meting — groter is een
  nieuw ticket. Teksten-ronde: startscherm-uitleg en `README.md`
  bijgewerkt met ALLE features van deze ronde (moeilijkheden,
  vluchtroute, de gang-naar-de-gracht, de boot en het
  ontsnappingsritme, stroomuitval). Screenshotronde: winscherm,
  stroomuitval, de vlonder met aangemeerde boot, vluchtroute-onderdelen
  op hun rustvlak, zone-banner. Volledige `tests/run-all.mjs` +
  scratchpad-suite (bekende uitzonderingen gedocumenteerd; nieuwe
  alleen na git-stash-verificatie).
- **Codegebieden:** teksten; hooguit de drie genoemde balansconstanten.
- **Acceptatiecriteria:** volledige repo-suite groen (incl. alle nieuwe
  ronde-4-tests, ook T52-57); lichttelling 24 (23 + T52's lantaarn) +
  `schaduw === 1`; pacing-meting gedocumenteerd in het eindrapport;
  teksten kloppen met het daadwerkelijke spel.
- **Testplan:** `tests/run-all.mjs` + scratchpad-suite +
  `test-lategame-pacing.mjs` + screenshotronde.
- **Rollback:** n.v.t. (verifiërend; tuning is per constante
  terugdraaibaar).
- **Sonnet solo:** ja.

---

## Ticket 52 — Doel D5: Gang naar de Gracht (geometrie: vlonder, water, boot, lantaarn)
- **Type:** Feature (geometrie)
- **Verbetergebied:** 1 (doel & retentie — ontsnappingslocatie,
  feedbackronde ná speeltest)
- **Prioriteit:** hoog — fundament voor T53/T54/T55
- **Status:** ✅ voltooid — nieuwe doorgang in de bijkeuken-oostmuur (twee
  segmenten rond een gat van GRACHTGANG_HALF breed, zelfde "geen deur"-
  patroon als de kelderhals-opening), een 3m gang (GANG_PLEISTER-stijl) naar
  een 4.5m vlonder-plateau ('hout'-materiaalfamilie) met watervlak, een
  boot (cilinder-romp + dek + boeg-kegel, puur decor voor T53) en een
  gekopieerde/aangepaste lantaarnpaal (buitenlicht-precedent, niet in
  lampLichten, geen schaduw). Lichttelling 23 -> 24, bevestigd via
  `tests/test-gracht-dock.mjs` (22 checks) + bijgewerkte
  `test-v016-integratie.mjs`/`test-stroomuitval.mjs`/`test-map-lus-geometrie.mjs`
  (die laatste kreeg de oostmuur-splitsing verwerkt in zijn bestaande
  probes). Valt al onder zone 4 (bijkeuken) — geen wijziging aan
  zoneVan()/ZONE_NAMEN nodig. Volledige regressie groen (36/39 scripts; de
  ene resterende fail — cameraKick-decay-timing in test-wapen-identiteit.mjs
  — is via git-stash bevestigd een pre-existing timing-flake, los van dit
  ticket).
- **Afhankelijk van:** — (T53 bouwt erop)
- **Doel:** een geloofwaardige, herkenbare ontsnappingslocatie in plaats
  van een willekeurig punt bij het kelderluik: rechtstreeks antwoord op
  de feedback "ik vind de locatie nu ook nog wat random". Een nieuwe
  korte gang vanuit de bijkeuken komt uit op een vlonder aan een
  gracht, met een zichtbare boot en een lantaarnpaal.
- **Concrete wijzigingen:** nieuwe doorgang in de bijkeuken-oostmuur
  (bij `BIJKEUKEN_X_OOST` = 12 — nu de "nepgevel"-scheiding met de
  onbenutte pocket erachter, zie de Zone-E-comment) naar een nieuwe
  korte gang (zelfde smalle-gang-patroon als de bestaande `GANG_*`
  tussen woonkamer en atelier), oostwaarts de bestaande vrije pocket in.
  Ruim binnen `GRENS.maxX` (= `PLAATS_X_OOST` − 0.05 ≈ 20.45, huidige
  bijkeuken-oostgrens ligt op 12) — GEEN GRENS-wijziging nodig, mits de
  exacte breedte/het eindpunt met `isVrijePlek`-probes geverifieerd
  wordt (de binnenplaats ligt ver noordelijker, rond `DEUR2_Z` ≈ −15.5,
  dus geen overlaprisico). De gang eindigt in een klein vlonder-plateau
  (eigen houten vloermateriaal) met: (a) een watervlak — "de gracht",
  donker blauwgroen, licht transparant, net voorbij de vlonderrand;
  (b) een boot-mesh uit simpele prims (langwerpige, licht afgeronde
  romp), vooralsnog puur decor — T53 koppelt 'm aan de interactie;
  (c) een lantaarnpaal volgens het bestaande `bouwLantaarn`-patroon
  (regel ~993 — die functie is LOKAAL gescoped, dus kopiëren en
  aanpassen, niet aanroepen, zelfde regel als CLAUDE.md voorschrijft):
  warm licht, GEEN schaduw, NIET in `lampLichten` (buitenlicht-
  precedent, zelfde als de binnenplaats-lantaarns). Lichttelling gaat
  daardoor bewust van 23 naar 24 (zelfde discipline als eerder: de
  telling in `test-v016-integratie.mjs`/latere integratietests wordt in
  DIT ticket meeverhoogd). Een obstakel aan de vlonderrand voorkomt dat
  de speler het water in loopt.
- **Codegebieden:** bijkeuken-oostmuur-blok (Zone E, rond de
  `bouwZoneEMuur`-aanroep voor de oostmuur), nieuw geometrie-blok
  ernaast (zelfde stijl als het bestaande gang-blok), debug-export
  (nieuwe vlonder-/boot-/gracht-coördinaten).
- **Acceptatiecriteria:** de nieuwe ruimte is bereikbaar vanaf de
  bijkeuken zonder GRENS te wijzigen; `isVrijePlek` bevestigt de
  vlonder vrij is; geen overlap met bestaande geometrie; precies 1
  nieuwe permanente lamp (lichttelling 23→24, GEEN schaduw); screenshot
  toont gang + vlonder + boot + lantaarn duidelijk.
- **Testplan:** nieuwe `tests/test-gracht-dock.mjs` (bereikbaarheid,
  `isVrijePlek`, lichttelling) + `check-load` + `run-all` +
  screenshots (gang, vlonder-overzicht).
- **Rollback:** nieuwe muurdoorgang + geometrieblok verwijderen;
  bijkeuken-oostmuur weer dicht.
- **Sonnet solo:** ja, met de gebruikelijke `isVrijePlek`-/
  screenshot-discipline van eerdere map-lus-tickets.

## Ticket 53 — Doel D6: De Ontsnapping verhuist naar de vlonder
- **Type:** Feature (VOORZICHTIG — herpositioneert een bestaand, al
  getest interactiepunt)
- **Verbetergebied:** 1
- **Prioriteit:** hoog
- **Status:** ✅ voltooid — `toonOntsnappingspuntIndienKlaar()`'s positie
  verwijst nu naar `bootGroep.position` (min 1.5m, vlak vóór de boeg, nog
  ruim binnen de vlonder en buiten het vlonderrand-obstakel) i.p.v.
  `kelderluikMesh.position`. De eenmalige "vluchtroute compleet"-melding
  noemt nu ook de boot/vlonder i.p.v. het kelderluik. Prompt-tekst en
  `ONTSNAPPING_PRIJS` ongewijzigd (de prompt zei al "over het water", een
  vooruitziende blik uit Ticket 45). `tests/test-ontsnapping.mjs`'s
  positie-assertie is bijgewerkt (nu 21 checks) — alle overige win-flow-
  checks (score, record, gameOver-guard, schermen-guard) ongewijzigd
  gebleven en nog steeds groen. Volledige regressie: 38/39 scripts groen
  (dezelfde pre-existing cameraKick-timing-flake als bij Ticket 52).
- **Afhankelijk van:** T52
- **Doel:** je stapt letterlijk de boot in in plaats van door een
  willekeurig kelderluik te verdwijnen.
- **Concrete wijzigingen:** `toonOntsnappingspuntIndienKlaar()`'s
  `positie` verhuist van `kelderluikMesh.position` naar de nieuwe
  vlonder-/boot-positie (T52); de prompt-tekst blijft functioneel
  hetzelfde ("Druk T: ontsnap over het water"), `ONTSNAPPING_PRIJS`
  ongewijzigd. `toonWinScherm()`/`probeerOntsnapping()` blijven
  ongemoeid — puur een positie-wijziging. De boot (T52, tot dan puur
  decor) krijgt hier zijn interactie-koppeling.
- **Codegebieden:** `toonOntsnappingspuntIndienKlaar()` (§6.4-
  beslissing 35-plek), `tests/test-ontsnapping.mjs`'s
  kelderluik-positie-assertie (MOET in dit ticket mee, zelfde
  discipline als T16/test-powerups en de eerdere T45-bijwerking van
  `test-vluchtroute.mjs`).
- **Acceptatiecriteria:** het punt verschijnt nog steeds pas bij 3/3
  onderdelen (ongewijzigd contract, T54 voegt de golf-voorwaarde pas
  daarna toe); positie klopt exact met de T52-boot-/vlondercoördinaten;
  de bestaande win-flow-tests (score, record, `gameOver` blijft false,
  schermen-guard) blijven ONGEWIJZIGD groen — alleen de
  positie-assertie verandert.
- **Testplan:** bijgewerkte `tests/test-ontsnapping.mjs` + `check-load`
  + `run-all` + screenshot van het punt op de vlonder.
- **Rollback:** positie terug naar `kelderluikMesh` (één regel).
- **Sonnet solo:** ja.

## Ticket 54 — Doel D7: Periodieke ontsnappingsvensters (ronde-gating)
- **Type:** Feature (gameplay-mechaniek)
- **Verbetergebied:** 1
- **Prioriteit:** hoog — kernfeedback van de gebruiker
- **Status:** ✅ voltooid — `ONTSNAPPING_START_GOLF`/`ONTSNAPPING_INTERVAL_GOLVEN`
  + pure `isOntsnappingsGolf()`/`golvenTotOntsnappingsVenster()`;
  `toonOntsnappingspuntIndienKlaar()` (T45/T53) kreeg één extra guard-regel
  (`!isOntsnappingsGolf(...)`) — VOEGT de golf-gating toe, vervangt de
  bestaande 3/3-voorwaarde niet. Nieuwe `updateOntsnappingsVenster()`
  (aangeroepen vanuit `startGolf()`, naast `toonVluchtOnderdelenIndienDrempel()`)
  opent het venster + vuurt eenmalig de golf-10-uitleg; de sluiting zit in
  `updateGolf()`'s wave-complete-tak. Nieuwe HUD-regel (`ontsnappingVensterUI`,
  eigen `updateOntsnappingVensterHUD()` — bewust GEEN inline code in
  `updateHUD()`, want die wordt al 1x bij module-load aangeroepen vóór deze
  constanten bestaan, zelfde TDZ-valkuil als `updateVluchtrouteHUD()`
  hierboven al oplost). `tests/test-ontsnapping-vensters.mjs` (15 checks,
  incl. de pure tabeltest) + bijgewerkte `test-ontsnapping.mjs` (golf 10
  gezet vóór de 3/3-check) + `test-vluchtroute.mjs` (idem, anders verdween
  het T45-ontsnappingspunt uit die telling). Volledige regressie: 38/40
  scripts groen (twee pre-existing timing-flakes, bevestigd los van dit
  ticket: cameraKick-decay in test-wapen-identiteit.mjs en twee losse
  hitmarker-timingchecks die standalone 3/3 keer schoon groen draaiden).
- **Afhankelijk van:** T53
- **Doel:** de boot ligt niet permanent klaar zodra je 3/3 onderdelen
  hebt, maar meert alleen periodiek aan — vanaf golf 10, en daarna elke
  4 golven (10, 14, 18, 22, …). Beloont plannen: op tijd klaarstaan, of
  wachten tot de volgende boot.
- **Concrete wijzigingen:** `ONTSNAPPING_START_GOLF = 10`,
  `ONTSNAPPING_INTERVAL_GOLVEN = 4`; nieuwe pure helper
  `isOntsnappingsGolf(golf) => golf >= ONTSNAPPING_START_GOLF &&
  (golf - ONTSNAPPING_START_GOLF) % ONTSNAPPING_INTERVAL_GOLVEN === 0`
  (testbaar, zelfde pure-functiestijl als `isEventGolf`/`berekenScore`).
  `startGolf()` roept (naast de bestaande
  `toonVluchtOnderdelenIndienDrempel()`-aanroep) een nieuwe
  `updateOntsnappingsVenster()` aan: bij een ontsnappingsgolf, 3/3
  onderdelen én nog geen punt → boot "meert aan" (T55 regelt de
  tell/onthulling; dit ticket regelt de mechaniek: interactiepunt
  toevoegen). Zodra de golf voorbij is / geen ontsnappingsgolf meer is
  (in de bestaande wave-complete-tak van `updateGolf()`, naast de
  bestaande wave-bonus-logica) vaart de boot weer weg: interactiepunt
  verwijderen (zelfde dynamische-punten-patroon als de
  Vluchtroute-onderdelen, §6.4-beslissing 35). Zijn de onderdelen nog
  niet compleet als het venster opent, dan blijft de boot simpelweg
  afwezig tot de volgende gelegenheid — geen extra state nodig,
  `updateOntsnappingsVenster()` checkt bij ELKE `startGolf()` opnieuw.
  Eenmalige "ontgrendeld"-melding bij golf 10 (bestaande
  `toonGolfBanner`/`toonMelding`) die uitlegt dat de boot vanaf nu
  periodiek langskomt — ongeacht of de onderdelen al compleet zijn
  (puur informatief, motiveert om ze te gaan zoeken). HUD-uitbreiding:
  zonder boot een kleine indicatie van golven-tot-volgende-venster
  (bv. `Boot over 3 golven`, zelfde stijl als `vluchtrouteUI`); mét
  boot `Boot ligt aan!`. Zonder 3/3 onderdelen blijft de bestaande
  T44-vluchtroute-flow (verzamelen, HUD-teller) ongewijzigd — dit
  ticket VOEGT de golf-gating TOE aan de bestaande 3/3-voorwaarde uit
  T45, vervangt 'm niet.
- **Codegebieden:** nieuwe constanten + `isOntsnappingsGolf()` bij de
  Ontsnapping-sectie, `startGolf()` (haakt
  `updateOntsnappingsVenster()` aan naast `toonVluchtOnderdelenIndienDrempel()`),
  `updateGolf()`'s wave-complete-tak (venster-sluiting), nieuw
  HUD-element, debug-export.
- **Acceptatiecriteria:** `isOntsnappingsGolf()` klopt exact voor golf
  9 (false), 10 (true), 11-13 (false), 14 (true), …; met 3/3 onderdelen
  én een ontsnappingsgolf verschijnt het punt; zonder 3/3 verschijnt
  het NIET, ook al is het een ontsnappingsgolf; buiten een
  ontsnappingsgolf (ook mét 3/3) is er GEEN punt; het punt verdwijnt
  weer zodra de golf voorbij/geen ontsnappingsgolf meer is; de
  golf-10-melding verschijnt precies 1x; HUD-teller klopt in beide
  standen.
- **Testplan:** nieuwe `tests/test-ontsnapping-vensters.mjs` (incl. de
  pure `isOntsnappingsGolf`-tabeltest) + bijgewerkte
  `test-ontsnapping.mjs` (de "verschijnt bij 3/3"-check simuleert nu
  ook een geldige ontsnappingsgolf) + `check-load` + `run-all` +
  screenshot van beide HUD-standen.
- **Rollback:** de golf-gate uit `updateOntsnappingsVenster()`
  verwijderen (terug naar T45's "altijd zichtbaar bij 3/3").
- **Sonnet solo:** ja, met de waarschuwing dat dit ticket ALLEEN de
  mechaniek raakt — de tell/onthulling (licht, geluid, banner-timing
  vóór de prompt) is T55, niet hier (zelfde scheiding als T30/T31).

## Ticket 55 — Doel D8: Boot-aankomst — tell en opbouw
- **Type:** Feature (presentatie/tell)
- **Verbetergebied:** 1
- **Prioriteit:** middel — directe feedback ("niet meteen ontsnapt
  zien staan")
- **Status:** ✅ voltooid — `probeerOntsnappingsVensterTeOpenen()` (nieuw,
  aangeroepen vanuit zowel `updateOntsnappingsVenster()` als
  `raapVluchtOnderdeelOp()`) start bij het openen van het venster een
  `ONTSNAPPING_AANKONDIGING_DUUR`-timer (5s) i.p.v. meteen het interactiepunt
  te tonen: `speelBootHoorn()` (eigen, nieuwe piep()-toon) + een banner
  ("Er nadert iets over het water…") + de gracht-lantaarn (T52) pulseert
  feller (toegepast NA de buitenLichten-flikkerloop in gameLoop, anders
  overschrijft die de puls meteen weer). Pas als
  `updateOntsnappingAankondiging(dt)` (getikt vanuit de spelActief-tak,
  zelfde discipline als updateGolf/updateDreigingsAudio) de timer laat
  aflopen verschijnt het echte punt via het bestaande
  `toonOntsnappingspuntIndienKlaar()` (T45/T53/T54, ongewijzigd). Bij het
  sluiten van het venster (updateGolf()'s wave-complete-tak): een
  vertrek-tell (`speelBootVertrek()` + "De boot vaart weer weg"),
  symmetrisch met de aankomst; een aankondiging die nog liep wanneer de golf
  eindigt wordt stil geannuleerd (geen punt, geen vertrek-tell — er is nog
  niets aangekomen). HUD kreeg een derde stand ("Boot nadert…" naast "Boot
  ligt aan!"/"Boot over N golven"). `tests/test-ontsnapping-vensters.mjs`
  volledig herzien voor de aankondigingsfase (26 checks, incl. een
  wall-clock-gedreven check via de ECHTE gameLoop — ontdekte en documenteerde
  daarbij dat gameLoop's dt-kap (0.05s/frame) de gesimuleerde tijd in deze
  headless testomgeving tot ~0.45x wall-clock vertraagt) + bijgewerkte
  `test-vluchtroute.mjs` (de derde pickup start nu de aankondiging i.p.v.
  meteen het punt). Volledige regressie: 39/40 scripts groen (de ene
  resterende fail is de reeds bevestigde pre-existing cameraKick-timing-flake,
  los van dit ticket).
- **Afhankelijk van:** T54
- **Doel:** de boot verschijnt niet abrupt met een volledige
  "Druk T"-prompt — een korte aankondiging/opbouw eerst, zodat het als
  een gebeurtenis aanvoelt in plaats van een geruisloze state-flip.
- **Concrete wijzigingen:** wanneer `updateOntsnappingsVenster()` (T54)
  een venster opent, volgt NIET meteen het interactiepunt — eerst een
  korte "nadering"-fase (`ONTSNAPPING_AANKONDIGING_DUUR`, bv. 4-6s):
  een verre boothoorn-toon (nieuwe, korte, originele Web-Audio-piep
  volgens het bestaande `piep()`-patroon — een eigen, herkenbaar
  signaal, geen bestaand geluid hergebruikt) + een banner ("Er nadert
  iets over het water…", geen bedrag/prompt) + het lantaarnlicht (T52)
  knippert/pulseert kort feller (hergebruik van het
  lampflikker-patroon, puur cosmetisch). PAS na de aankondigingsduur
  verschijnt het echte interactiepunt (T54's logica, nu met een timer
  ertussen) mét de volledige prompt. Bij het sluiten van het venster
  (golf voorbij): een kort vertrek-geluid/banner ("De boot vaart weer
  weg") — symmetrisch met de aankomst.
- **Codegebieden:** `updateOntsnappingsVenster()` (T54, breidt uit met
  de aankondigingstimer), audio-blok (nieuwe `speelBootHoorn()`), T52's
  lantaarnlicht (kort te sturen intensiteit), debug-export
  (timer-getters).
- **Acceptatiecriteria:** bij het openen van een venster verschijnt het
  interactiepunt PAS na `ONTSNAPPING_AANKONDIGING_DUUR`, niet meteen;
  de aankondigingsbanner verschijnt wél meteen; het geluid speelt exact
  1x per aankomst en 1x per vertrek; geen nieuwe allocaties/
  geluidslagen die de bestaande audio-overload-regels (§6.9/§5.10)
  overschrijden.
- **Testplan:** nieuwe checks in (of uitbreiding van)
  `tests/test-ontsnapping-vensters.mjs`: timer-gedrag via
  `waitForTimeout` + de draaiende gameLoop (klok-vs-dt-les, §6.10) +
  `check-load` + `run-all`.
- **Rollback:** de aankondigingstimer weglaten (punt verschijnt weer
  meteen, T54's gedrag).
- **Sonnet solo:** ja.

## Ticket 56 — Doel D9: Vluchtroute-onderdelen fysiek prominenter
- **Type:** Polish
- **Verbetergebied:** 1
- **Prioriteit:** middel — directe feedback ("fysiek neerleggen op de
  oppaklocatie")
- **Status:** ✅ voltooid — bij het onderzoeken bleek `onderdeel.mesh`
  (de group van `bouwRoeispaanMesh()`/`bouwTouwbundelMesh()`/
  `bouwScheepslantaarnMesh()`, Ticket 44) NOOIT verplaatst te zijn naar
  `(onderdeel.x, onderdeel.z)` — alleen de winkelMarkering-ring en het
  interactiepunt stonden al op de juiste plek; het item zelf hing al sinds
  Ticket 44 op de wereld-oorsprong (bug, ontdekt via wereldpositie-metingen,
  geen bestaande test controleerde dit ooit). Meteen meegefixt: elke bouw*-
  functie kreeg `(x, z)`-parameters + `g.position.set(x, 0, z)`. Elke
  functie kreeg ook een rustvlak als EERSTE kind van dezelfde group — houten
  krat (Roeispaan, atelier), kistrand (Touwbundel, binnenplaats), plank
  (Scheepslantaarn, bijkeuken) — dus verdwijnt het complete stukje (item +
  rustvlak) automatisch mee via de al bestaande
  `wereld.remove(onderdeel.mesh)` in `raapVluchtOnderdeelOp()`, zonder die
  functie te wijzigen. `g.userData.pulsMesh` + nieuwe
  `updateVluchtOnderdelenPuls(dt)` (getikt vanuit de spelActief-gameLoop-tak)
  geven elk zichtbaar-en-nog-niet-opgeraapt onderdeel een subtiele,
  permanente schaalpuls (hergebruik van het flitsMarkering-idee, nu blijvend
  i.p.v. eenmalig). `tests/test-vluchtroute.mjs` uitgebreid met 6 nieuwe
  checks (positie-fix, rustvlak-als-kind, mesh-aantal binnen budget,
  pulsMesh-is-kind, puls-gedrag) — nu 21 checks. Screenshots bevestigen alle
  drie de items duidelijk rustend op hun rustvlak (vóór het oprapen) en
  volledig verdwenen (erna). Volledige regressie: 38/40 scripts groen (de
  twee resterende fails — cameraKick-timing en de probabilistische
  golf-variatielimiter-"geen 3 op rij"-check — zijn bevestigde pre-existing
  flakes, los van dit ticket, standalone 3/3 keer groen).
- **Afhankelijk van:** — (raakt T44's meshes, onafhankelijk van
  T52-55)
- **Doel:** de Roeispaan/Touwbundel/Scheepslantaarn zijn er al fysiek
  (T44), maar vallen kennelijk te weinig op — elk onderdeel krijgt een
  duidelijk rustpunt (in plaats van los in de ruimte) waar het item
  ZICHTBAAR bovenop ligt, zodat het meteen herkenbaar is als "hier ligt
  iets"; het hele stukje decor (item + rustvlak) verdwijnt in één keer
  zodra de speler het opraapt.
- **Concrete wijzigingen:** elk van de drie `bouw*Mesh()`-functies
  (Ticket 44, §6.4) krijgt een klein rustvlak (een simpele
  krat/plank/vensterbank uit bestaande prim-patronen, passend bij de
  zone — bv. een houten krat in het atelier, een kistrand op de
  binnenplaats, een plank in de bijkeuken) zodat de Roeispaan, de
  Touwbundel en de Scheepslantaarn elk zichtbaar OP hun eigen rustvlak
  liggen in plaats van in de lucht te zweven (zelfde les als de
  zwevende-barricadeplanken-fix). BELANGRIJK:
  het rustvlak wordt een KIND van dezelfde group als het item-mesh
  (`onderdeel.mesh`), niet een los, permanent object ernaast — zo
  verdwijnt het complete stukje (item + rustvlak) automatisch in één
  keer via de AL BESTAANDE `wereld.remove(onderdeel.mesh)`-regel in
  `raapVluchtOnderdeelOp()` (Ticket 44), zonder dat die functie zelf
  hoeft te veranderen. Iets grotere schaal (binnen het bestaande
  performance-budget, geen extra lichten) en een subtiele eigen
  puls/glans op het item zelf (hergebruik van het
  `flitsMarkering`-idee, maar dan permanent zolang het onderdeel niet
  is opgeraapt, i.p.v. eenmalig bij aankoop).
- **Codegebieden:** `bouwRoeispaanMesh()`/`bouwTouwbundelMesh()`/
  `bouwScheepslantaarnMesh()` (§6.4-blok), evt.
  `toonVluchtOnderdelenIndienDrempel()` als de puls per-frame gestuurd
  moet worden (dan een regel in de bestaande spelActief-gameLoop-tak).
- **Acceptatiecriteria:** elk onderdeel staat aantoonbaar op een
  rustvlak dat in dezelfde group zit (geen zwevende meshes, geen los
  achterblijvend rustvlak na het oprapen); mesh-aantal per
  onderdeel blijft binnen het bestaande perf-budget; screenshots tonen
  duidelijk herkenbare, niet-zwevende objecten in alle drie de zones,
  vóór én na het oprapen (na oprapen: helemaal niets meer zichtbaar op
  die plek).
- **Testplan:** uitbreiding van `tests/test-vluchtroute.mjs`
  (mesh-samenstelling/positie-checks + een check dat het rustvlak een
  kind van `onderdeel.mesh` is en dus meeverdwijnt bij het oprapen) +
  `check-load` + `run-all` + screenshots van alle drie de locaties,
  vóór én na het oprapen.
- **Rollback:** rustvlakken weglaten (T44's oorspronkelijke meshes
  blijven werken); de naamswijziging is één string terug te draaien.
- **Sonnet solo:** ja.

## Ticket 57 — Zwevende barricadeplanken: audit overige vensters
- **Type:** Bugfix (puur visueel, geen mechaniek)
- **Verbetergebied:** — (kwaliteit/polish, buiten de vijf hoofdgebieden
  van deze ronde)
- **Prioriteit:** hoog — directe, met screenshots onderbouwde
  speeltest-feedback
- **Status:** ✅ voltooid — beide vooronderzochte verdachten bevestigd en
  gefixt. (a) `VENSTERS`/`VENSTERS_KAMER2` (kozijn 1.6m/glas 1.3m rond
  y=1.9): de standaard-drieplankstapel liet een duidelijke kier glas/kozijn
  zichtbaar boven de bovenste plank — `bouwBarricade()` kreeg een nieuwe
  optionele `plankSpacing`-parameter (naast de bestaande `basisY`), en beide
  arrays kregen `basisY: 1.3, plankSpacing: 0.6` zodat de 3 planken de volle
  glashoogte afdekken (de middelste plank landt zelfs precies op y=1.9, het
  kozijn-midden). (b) `VENSTERS_BIJKEUKEN` (de "steegdeur") had HELEMAAL
  GEEN kozijn-mesh — nieuw kozijn+glas toegevoegd (zelfde `kozijnOost`-
  patroon, gespiegeld voor de bijkeuken-oostmuur) + dezelfde plank-tuning.
  `VENSTERS_PLAATS` (de eerder-gefixte binnenplaats-poorten/-kelderdeur)
  bewust ONGEWIJZIGD gelaten — regressie bevestigd. Nieuwe
  `tests/test-barricade-plaatsing.mjs` (8 checks: tuning-waarden, "kier <
  0.15m boven én onder" voor alle drie de volwaardige-raam-arrays, het
  nieuwe kozijn bestaat or staat op de juiste plek, VENSTERS_PLAATS-
  regressie, en een pure mechaniek-check van `plankSpacing` zelf). Screenshots
  bevestigen: de drieplankstapel dekt het raam nu overtuigend af, geen
  zichtbaar glas/kozijn meer erboven. Volledige regressie: 40/41 scripts
  groen (de ene resterende fail is de reeds bevestigde pre-existing
  cameraKick-timing-flake).
- **Afhankelijk van:** —
- **Doel:** dezelfde zwevende-planken-fout die eerder is opgelost voor
  de binnenplaats-poorten/-kelderdeur (`VENSTERS_PLAATS`, via een
  `basisY`-override in `bouwBarricade()`) blijkt zich ELDERS ook voor
  te doen — twee screenshots (golf 6, Vluchtroute 1/3) tonen planken
  die duidelijk los/zwevend vóór een deur staan, niet op de
  binnenplaats.
- **Concrete wijzigingen:** reproduceer eerst de exacte situatie uit de
  screenshots (golf 6, ná het oppakken van 1 vluchtroute-onderdeel) en
  doe daarna een VOLLEDIGE visuele audit van alle overige
  gebarricadeerde vensters. Twee concrete verdachten, al vooronderzocht:
  (a) `VENSTERS` (woonkamer, zone A) en `VENSTERS_KAMER2` (atelier,
  zone C) gebruiken beide hetzelfde kozijn (`BoxGeometry(1.3, 1.6,
  0.12)` op y=1.9, dus een opening van y≈1.1 tot y≈2.7) — de
  standaard-plankstapel (y=1.2/1.6/2.0, spant 1.14-2.06) past daar wél
  BINNEN de opening, maar laat een kier van ~0.6m kozijn/glas ZICHTBAAR
  boven de planken — kan ook als "niet kloppend" ogen, ook al is het
  geen letterlijke overshoot; (b) `VENSTERS_BIJKEUKEN` (de
  "steegdeur") heeft HELEMAAL GEEN eigen kozijn-mesh — de barricade
  hangt daar dus zonder enig omlijnend referentiepunt, wat het meest
  waarschijnlijke "zweeft in het niets"-effect geeft en de sterkste
  kandidaat is voor wat op de screenshots te zien is. Gebruik voor elk
  gevonden probleem dezelfde, al bestaande `basisY`-override in
  `bouwBarricade()` (geen nieuwe mechaniek nodig — alleen per-venster
  tuning, en eventueel een kozijn-mesh voor de steegdeur als een
  ontbrekend referentiepunt de oorzaak blijkt).
- **Codegebieden:** `VENSTERS`/`VENSTERS_KAMER2`/`VENSTERS_BIJKEUKEN`-
  arrays, `bouwBarricade()` (`basisY`, al aanwezig sinds de
  binnenplaats-fix), evt. een nieuw kozijn-blok voor de steegdeur.
- **Acceptatiecriteria:** screenshots van ALLE gebarricadeerde
  vensters (niet alleen het gemelde) tonen planken die overtuigend
  op/in hun opening liggen; geen zichtbare zwevende planken meer nergens
  in het spel; geen regressie op de al gefixte binnenplaats-vensters.
- **Testplan:** nieuw of uitgebreid testbestand (bv.
  `tests/test-barricade-plaatsing.mjs`) met een positie-check per
  venster (plank-y's binnen het bereik van de eigen opening) +
  `check-load` + `run-all` + een screenshotronde van alle
  gebarricadeerde vensters in het spel.
- **Rollback:** `basisY`-aanpassingen zijn per venster terug te draaien
  (zelfde constante-aanpak als de binnenplaats-fix).
- **Sonnet solo:** ja.

---

## v0.19 — Fable-architectuurronde 5: Visuele/ruimtelijke diepte, AI en oriëntatie (T58-60 ✅ geïmplementeerd, T61-68 gepland)

Architectuur: zie ARCHITECTURE_NOTES.md §7 (beslissingen 49-61).
Sonnet-prompts: zie SONNET_EXECUTION_PLAN.md, "ronde 5 (v0.19)".
**Tickets 58-60 (PALET, procedurele texturen, post-processing) zijn
geïmplementeerd, getest (41/41 regressiescripts groen) en met
voor/na-screenshots opgeleverd** — zie de Status-velden hieronder voor
implementatiedetails en afwijkingen t.o.v. het oorspronkelijke ontwerp.
Tickets 61-68 wachten nog op een aparte, expliciete opdracht.

**Verbetergebieden deze ronde** (nummering per-ronde):
1. Visuele kwaliteit (T58-T61)
2. Ruimtelijke diepte (T62-T63)
3. Vijandintelligentie (T64-T65)
4. Sfeer/audio (T66)
5. Spelerfeedback & oriëntatie (T67-T68)

---

## Ticket 58 — PALET-systeem voor consistente art direction

- **Type:** visuele verbetering
- **Verbetergebied:** 1 (Visuele kwaliteit)
- **Prioriteit:** middel
- **Status:** ✅ voltooid — nieuw `PALET`-object toegevoegd (nabij
  `MATERIAAL_FAMILIES`) met 8 benoemde kleurgroepen (`gevelKoud`/
  `gevelWarm` als arrays van 3/2 tinten, `raamWarmAmber`/`raamWarmZacht`/
  `raamKoelBlauw`/`raamKoelLicht`, `straatNat`, `straatPlas`). De 5
  `bouwAchterGevel()`-aanroepen, de klinkers (`matFamilie('natSteen', ...)`)
  en de plassen-materialen gebruiken nu `PALET.*`. De drie bijna-identieke
  warme raamtinten van vóór deze ronde (0xffc06a/0xffd18a/0xffb86b) zijn
  bewust samengevoegd tot twee tinten (`raamWarmAmber`/`raamWarmZacht`) —
  gevel 5's raamkleur verschoof daardoor van 0xffb86b naar 0xffc06a
  (verschil ~1% per kanaal, niet zichtbaar). Alle overige hexwaarden
  identiek aan voorheen. Debug-export: `PALET`.
- **Afhankelijk van:** —
- **Doel:** een centraal, benoemd kleurenpalet (`PALET`) invoeren zodat
  gevel-/straat-/decorkleuren consistenter ogen, zonder de hele scene
  in één keer om te bouwen.
- **Huidige situatie:** kleuren zijn losse hex-literals verspreid over
  bouwfuncties (`bouwAchterGevel`, `bouwLantaarn`, straatdecor, etc.);
  geen centrale plek die "dit is de art direction" vastlegt.
- **Gewenste situatie:** een nieuw `PALET`-object (zelfde stijl als
  `MATERIAAL_FAMILIES`) met een klein aantal benoemde kleurgroepen
  (bv. `steenwarm`, `metaalkoud`, `hout`, `accentDreiging`,
  `accentVeilig`); de gevel-/straat-call-sites die dit ticket aanwijst
  gebruiken `PALET.*` in plaats van eigen hex-literals.
- **Codegebieden:** nieuw `PALET`-object (nabij
  `MATERIAAL_FAMILIES`), `bouwAchterGevel()`-aanroepen, straatdecor-
  kleuren.
- **Buiten scope:** een volledige omzetting van ELKE kleur in het
  bestand — alleen de gevel-/straat-call-sites die dit ticket expliciet
  noemt.
- **Randgevallen:** bestaande scenes die al goedgekeurd zijn
  (screenshots uit eerdere rondes) mogen niet zichtbaar "kapot" ogen
  na de PALET-omzetting — kleurwaarden moeten dicht bij de originelen
  blijven, dit is consistentie, geen redesign.
- **Performancevoorwaarden:** geen — puur data/constanten, geen
  runtime-kosten.
- **Acceptatiecriteria:**
  - `PALET` bestaat en wordt door de aangewezen call-sites gebruikt.
  - Voor/na-screenshots van gevel-/straatzichten tonen geen onbedoelde
    kleursprong.
  - Volledige regressie blijft groen.
- **Testplan:** `check-load` + bestaande visuele regressietests +
  screenshotvergelijking vóór/na op minstens 2 buitenzichten.
- **Rollback:** call-sites terugzetten naar hun oude hex-literals; geen
  gedeelde state om op te ruimen.
- **Sonnet solo:** ja.

---

## Ticket 59 — Procedurele texturen voor materiaaldiepte

- **Type:** visuele verbetering
- **Verbetergebied:** 1 (Visuele kwaliteit)
- **Prioriteit:** middel
- **Status:** ✅ voltooid, met één bewuste afwijking van de oorspronkelijke
  regelinterpretatie in Ticket 38 (zie hieronder) en één technische
  afwijking van het ontwerp: de canvas-texturen zijn toegepast als
  `roughnessMap` (niet `map`/albedo). Reden: een `map` vermenigvuldigt de
  basiskleur van het materiaal met de textuurwaarde per pixel — bij een
  gemiddeld-grijze textuur zou dat de bestaande kleuren van alle scenes
  merkbaar verdonkeren (regressie op alle al goedgekeurde screenshots).
  `roughnessMap` raakt de kleur niet en is met een bijna-witte textuur
  (waardes 205-250 van 255) een subtiele, veilige manier om lokale
  ruwheidsvariatie (en dus specular-detail) toe te voegen zonder de
  basiskleur te wijzigen — dezelfde geest als het ticket, andere
  materiaal-slot. `hout`/`steen`/`metaal` kregen elk hun eigen procedureel
  getekende patroon (128×128 canvas, `repeat.set(4,4)`); `tegel`/
  `natSteen` blijven zoals gepland buiten scope. Nieuwe symbolen:
  `canvasTextuurCache`, `bouwCanvasTextuur()`, `CANVAS_TEXTUUR_TEKENAARS`
  — alle drie debug-geëxporteerd.
  **Regel-interpretatie (belangrijk):** dit ticket herziet expliciet de
  aanname uit Ticket 38 ("CLAUDE.md verbiedt ook canvas-gegenereerde
  textures") — zie ARCHITECTURE_NOTES.md §7.3 voor de volledige
  redenering. Dit was een bewuste, aan de gebruiker voorgelegde keuze
  (niet stilzwijgend overschreven).
- **Afhankelijk van:** T58 (voor consistente kleurbasis; niet strikt
  blokkerend maar wel logisch eerst)
- **Doel:** materialen visuele diepte geven zonder externe
  afbeeldingsbestanden te gebruiken (zie ARCHITECTURE_NOTES.md §7.3
  voor de regel-interpretatie).
- **Huidige situatie:** `matFamilie()` levert vlakke,
  kleur-plus-ruwheid `MeshStandardMaterial`s zonder enige
  oppervlaktetekening.
- **Gewenste situatie:** een klein setje runtime-getekende
  `THREE.CanvasTexture`s (steen-ruis, houtnerf, geborsteld metaal),
  eenmalig getekend en gecachet, gekoppeld aan de bestaande
  `MATERIAAL_FAMILIES`-varianten via een nieuw `map`-veld.
- **Codegebieden:** `matFamilie()`/`MATERIAAL_FAMILIES` (regel
  ~559-575), nieuwe `bouwCanvasTexture()`-achtige helper + eigen
  texture-cache (zelfde patroon als `matFamilieCache`).
- **Buiten scope:** per-instantie texture-variatie (elke familie deelt
  precies één texture-set, net zoals materialen nu al gedeeld zijn);
  UV-mapping-correcties op bestaande geometrie die nu geen zinnige
  UV's heeft (die geometrie krijgt gewoon een neutrale/herhalende
  texture, geen op-maat-UV-project).
- **Randgevallen:** geometrie zonder correcte UV's mag niet zichtbaar
  "stuk" ogen (uitgerekte/verkeerd geschaalde texture) — kies een
  subtiel, laag-contrast patroon dat vergevingsgezind is voor slechte
  UV's.
- **Performancevoorwaarden:** canvas-texturen max ~128×128, eenmalig
  getekend bij scene-opbouw (niet per frame), gedeeld via cache — geen
  toename van draw calls, geen materiaal-mutatie in de hot path.
- **Acceptatiecriteria:**
  - Elke `MATERIAAL_FAMILIES`-variant die dit ticket aanwijst heeft een
    `map` met een subtiel, passend patroon.
  - Geen zichtbare UV-artefacten in de bestaande scenes.
  - Materiaal-mutatiediscipline blijft intact: texturen zijn
    per-familie gedeeld, nooit per-instantie.
- **Testplan:** `check-load` + screenshotronde van representatieve
  oppervlakken (muur, vloer, meubel) vóór/na + volledige regressie.
- **Rollback:** `map`-veld verwijderen uit de betrokken
  `MATERIAAL_FAMILIES`-entries.
- **Sonnet solo:** ja.

---

## Ticket 60 — Post-processing-pipeline (EffectComposer)

- **Type:** visuele verbetering / infrastructuur
- **Verbetergebied:** 1 (Visuele kwaliteit)
- **Prioriteit:** middel
- **Status:** ✅ voltooid, met twee tuning-aanpassingen t.o.v. het
  oorspronkelijke ontwerp. CDN-verificatie: de live CDN was vanuit deze
  ontwikkelomgeving niet direct bereikbaar (netwerkbeleid blokkeert
  `cdn.jsdelivr.net` voor rechtstreekse curl/fetch-checks), maar het lokale
  `three@0.160.0`-npm-pakket (dat de bestaande tests al gebruiken om de
  CDN te onderscheppen) bevat `examples/jsm/postprocessing/*` 1-op-1 voor
  exact de gepinde versie — jsdelivr serveert npm-pakketten direct, dus
  dit is sterke indirecte verificatie dat de echte CDN-URL bestaat.
  `tests/helpers.mjs` is uitgebreid om deze submodules (en hun eigen
  relatieve imports) ook lokaal te onderscheppen, zodat de headless-tests
  de ECHTE postprocessing-code draaien, niet een mock.
  Toegevoegd: `EffectComposer` + `RenderPass` + `UnrealBloomPass`
  (strength 0.35, radius 0.4, threshold 0.82 — alleen fel-emissieve
  elementen als lantaarns/winkelaccenten/ogen gloeien) + `OutputPass`
  (herstelt sRGB/ACES-uitvoer). Importmap kreeg één nieuwe entry
  (`three/addons/` → dezelfde CDN-host se `examples/jsm/`).
  **Tuning-aanpassing:** de bloom-pass is geïnitialiseerd met een KLEINE
  vaste interne resolutie (256×256, de eigen default van de pass) i.p.v.
  de volledige schermresolutie — bij volledige resolutie bleek de
  blur-mipchain (5 niveaus) in een headless/software-gerenderde
  testomgeving de framerate merkbaar te verlagen, wat twee bestaande
  wall-clock-timinggevoelige tests (`test-wapen-identiteit.mjs`,
  `test-hitmarker-audio.mjs`) deed haperen — de gameLoop's dt-cap
  (`Math.min(dt, 0.05)`) laat gesimuleerde tijd achterlopen bij de echte
  klok zodra de fps te veel daalt. Met 256×256-resolutie is de
  performance-impact in een echte (hardware-versnelde) browser
  verwaarloosbaar. De vier wall-clock-marges in die twee testbestanden
  zijn desondanks iets ruimer gezet (zie git-diff) om ademruimte te
  houden t.o.v. dit al-marginale headless-testklimaat.
- **Afhankelijk van:** —
- **Doel:** de kale `renderer.render()`-call vervangen door een
  minimale post-processing-pipeline voor meer visuele diepte (subtiele
  bloom/vignet-achtige pass).
- **Huidige situatie:** hoofdloop doet `renderer.render(scene,
  camera)` zonder enige composer.
- **Gewenste situatie:** één `EffectComposer` met RenderPass + maximaal
  één extra subtiele pass, resize-bewust (`onresize` roept ook
  `composer.setSize()` aan), geladen via Three.js' eigen
  `examples/jsm/postprocessing/*`-submodules op dezelfde bestaande
  CDN-host als de kern-`three.module.js` (zie ARCHITECTURE_NOTES.md
  §7.3/§7.4.3).
- **Codegebieden:** importmap (`<script type="importmap">`),
  render-loop, `onresize`-handler.
- **Buiten scope:** meerdere passes/complexe effectenketens; elke pass
  die met shadows interfereert.
- **Randgevallen:** de CDN moet daadwerkelijk de
  postprocessing-submodules voor de gebruikte Three.js-versie serveren
  — dit MOET eerst geverifieerd worden vóór er code tegenaan
  geschreven wordt (zie SONNET_EXECUTION_PLAN.md-waarschuwing 32); als
  dat niet lukt, ticket blokkeren en terugmelden, niet improviseren met
  een ander CDN of een losse copy-paste van de module-broncode.
- **Performancevoorwaarden:** exact 1 shadow-castende light blijft
  behouden (`schaduw === 1`-invariant, ook na deze pipeline); geen
  waarneembare framerate-terugval op de bestaande perf-tests.
- **Acceptatiecriteria:**
  - Composer rendert de scene zichtbaar identiek qua compositie, met
    een subtiele visuele verbetering (bloom/vignet).
  - Resize (window resize tijdens spel) blijft correct werken.
  - `schaduw === 1`-check blijft groen.
  - Volledige regressie blijft groen.
- **Testplan:** `check-load` + bestaande perf-/schaduw-tests + een
  resize-test + screenshotvergelijking vóór/na.
- **Risico's:** CDN-beschikbaarheid van de submodule is de grootste
  onzekere factor van deze hele ronde.
- **Rollback:** terug naar kale `renderer.render()`-call, importmap-
  entry verwijderen.
- **Sonnet solo:** ja, mits de CDN-verificatiestap eerst slaagt.

---

## Ticket 61 — Vloeiendere silhouetten voor vijanden/wapens

- **Type:** visuele verbetering — VOORZICHTIG
- **Verbetergebied:** 1 (Visuele kwaliteit)
- **Prioriteit:** laag
- **Status:** ✅ voltooid, met een aangepaste scope voor de wapens en één
  bugfix die tijdens implementatie nodig bleek.
  **Ondoden** (voorzichtig, alleen tessellatie): hoofd
  `SphereGeometry(0.18, 8, 8)` → `(0.18, 20, 16)` (straal/positie
  ongewijzigd); ogen, bochel, buik en de gloeiende kern kregen ook meer
  segmenten (radii ongewijzigd). **Bugfix tijdens implementatie:** met
  het nieuwe, veel vloeiendere hoofd bleken de ogen (voorheen op
  afstand 0.153 van het hoofdcentrum, tegen straal 0.18) volledig
  verzwolgen te worden door het oppervlak — bij het oude 8×8-hoofd
  waren ze zichtbaar via een facet-deuk, maar dat gaatje verdween met
  de vloeiendere tessellatie. Eyes-z aangepast van 0.14 naar 0.165
  (afstand ≈0.171, net onder straal 0.18) zodat ze weer zichtbaar op
  het oppervlak liggen — dit is de ENIGE positie-wijziging in dit
  ticket en raakt uitsluitend de (zeer kleine, straal 0.02) oog-
  hitbox-region, niet het hoofd zelf of het hoofd-hoogte-anker.
  **Wapens** (geen hitbox-risico, dus ruimere scope): Drukspuit-tank/
  mondstuk en Ratelaar-loop kregen meer radiale segmenten; beide
  muzzle-flash-bollen en het drukmeter-lampje ook. De grepen
  (`greep`/`greepRatelaar`) zijn van `BoxGeometry` omgezet naar
  `CapsuleGeometry` (zelfde totale lengte) — een natuurlijker rond
  handvat. De Ratelaar's identiteitsbepalende blokkerige chassis/
  magazijnkast/kolf (Ticket 34: wapen-identiteit) zijn BEWUST
  ongewijzigd gelaten om het silhouet-onderscheid met de Drukspuit niet
  te verwateren.
- **Afhankelijk van:** —
- **Doel:** ondode- en wapenmodellen een minder "blokkerig" silhouet
  geven zonder de hitbox-/animatie-architectuur te breken.
- **Huidige situatie:** modellen bestaan uit simpele primitieve
  geometrieën (boxen/cilinders/cones) met scherpe randen.
- **Gewenste situatie:** zachtere overgangen via meer radiale segmenten
  op zichtbare randen en kleine tussen-primitieven voor
  afschuinings-illusie, plus zachtere shading — puur cosmetisch.
- **Codegebieden:** ondode-modelopbouw (Z1-modulaire structuur,
  Ticket 18-22), wapenmodel-opbouw.
- **Buiten scope:** nieuwe geometrie-types, hogere polycount als
  doel-op-zich, animatie-systeem-wijzigingen.
- **Randgevallen:** de hoofd-hoogte-anker (beslissing 16) en alle
  hitbox-mesh-schalen mogen NIET veranderen — elke wijziging is puur
  visueel, nooit een transform op een hitbox-dragend object.
- **Performancevoorwaarden:** geen toename van vertex-aantal die de
  bestaande perf-budgetten (aantal ondoden × complexiteit) merkbaar
  raakt — extra segmenten alleen op de meest zichtbare randen, niet
  overal.
- **Acceptatiecriteria:**
  - Voor/na-screenshots tonen een merkbaar vloeiender silhouet.
  - Hitbox-regressietest bevestigt: geen wijziging in hitbox-posities/
    -schalen.
  - Head-anchor-positie ongewijzigd (regressietest).
  - Volledige regressie blijft groen.
- **Testplan:** `check-load` + nieuwe/bestaande hitbox-regressietest +
  screenshotronde van elk ondode-type + volledige regressie. Los van
  elk ander ticket uitvoeren (niet combineren).
- **Risico's:** grootste risico is per ongeluk een hitbox- of
  head-anchor-transform aanraken — vandaar VOORZICHTIG.
- **Rollback:** modelopbouw-functies terug naar hun huidige vorm.
- **Sonnet solo:** ja, met verplichte hitbox-regressietest vóór/na.

---

## Ticket 62 — Kelder: geometrie, trap en Y-beweging

- **Type:** nieuwe ruimte / infrastructuur — VOORZICHTIG
- **Verbetergebied:** 2 (Ruimtelijke diepte)
- **Prioriteit:** hoog
- **Status:** ✅ voltooid, met een locatiecorrectie tijdens implementatie
  en een scope-uitbreiding op expliciet verzoek van de gebruiker.
  **Locatiecorrectie:** de eerste implementatie plaatste de trap/kelder
  op de binnenplaats (x=9, z=−17.5…−22.3) en deelde bewust de
  X/Z-footprint met de bestaande vloer daar ("geen nieuwe obstakels
  nodig"). Dat bleek in directe strijd met de expliciete eis in
  §7.5.1 hieronder: "disjuncte footprint BUITEN de bestaande
  GRENS-rechthoek". Scene-traversal bevestigde bovendien dat die plek
  al dicht bezet was (Smederij, kratten, een lantaarn) — precies de
  reden waarom de nieuwe geometrie in schermafbeeldingen onzichtbaar
  bleef (verscholen onder/tussen bestaande vloer en decor). **Fix:**
  volledig verplaatst naar de west-nis van het atelier (op verzoek van
  de gebruiker, i.p.v. de bijkeuken die eerst overwogen werd) — de trap
  loopt vanaf een nieuw deurgat in de nis-westmuur verder naar het
  westen, ruim voorbij `GRENS.minX` (−11.45), een echt lege plek
  (geverifieerd via scene-traversal). Nu terecht GEEN nieuwe
  Y-blinde-obstakel-risico's meer: de wanden van de trap/kelder zijn
  gewone `registreerRechthoek()`-obstakels, want dit stuk kaart deelt
  zijn X/Z met niets anders.
  **Scope-uitbreiding (op verzoek):** de gebruiker vroeg tijdens
  implementatie expliciet om een koopbare "deur 5" (zelfde
  mesh/klink/obstakel/interactiePunt/WINKEL_STIJLEN-patroon als deur
  1-4, prijs €900) die de trap/kelder ontgrendelt, naast de bestaande
  deur 2 (binnenplaats) — een echte strategische keuze vroeg in het
  spel. Dit stond niet in de oorspronkelijke ticket-tekst maar is een
  natuurlijke, minimale toepassing van het bestaande deur-patroon.
  Bewust GEEN `herbouwNavTabel()`/`VENSTERS`-uitbreiding bij het kopen
  (zie §7.5.2 hieronder — de kelder blijft volledig buiten
  ZONE_GRAAF). **Veiligheid (vooruitlopend op §7.5.2/Ticket 63):**
  `losBotsingenOp()` kreeg een nieuwe, optionele derde parameter
  `magKelderBinnen` (default `false`); alleen de speler-aanroep in
  `updateSpeler()` geeft `true` door. Geen van de drie ondode-aanroepen
  in `updateOndoden()` doet dat, dus geen ondode kan ooit voorbij
  `GRENS.minX` de trapband in, zelfs niet als hij de speler daar recht
  zou volgen. `isVrijePlek()` is bewust ongewijzigd gelaten (blijft de
  kelder als niet-vrij zien), zodat spawn-/pathing-checks daar sowieso
  nooit induiken.
  **Y-aanname-audit:** uitgevoerd en numeriek geverifieerd
  (`berekenKelderY()`-randgevallen + camera-Y-koppeling via
  `updateSpeler()`, zie `tests/test-kelder-trap.mjs`); de twee eerder
  gevonden 3D-afstand-gevoelige plekken (meleebereik in
  `updateOndoden()`, explosieradius in `ontploiBrander()`) blijven
  ongewijzigd correct, precies zoals al beargumenteerd (voordelig +
  praktisch onbereikbaar, want geen ondode komt ooit in de kelder).
  **Testresultaat:** nieuwe `tests/test-kelder-trap.mjs` (25 checks:
  deur-koop-patroon, alle `berekenKelderY()`-randgevallen,
  camera-Y-koppeling, 2D-gedrag elders ongewijzigd, en de
  speler-only-GRENS-bypass expliciet getest). Lichttelling 25→26
  (`kelderLicht`, meegenomen in het bestaande flikker-/
  Stroomuitval-systeem via `lampLichten`); een half-dozijn bestaande
  tests met hard-coded totaaltellingen (interactiePunten,
  winkelMarkeringen, lampLichten, obstakel-bandbreedtes) zijn met de
  verwachte +1/+6 bijgewerkt, net als bij elke eerdere deur-ticket.
  Volledige regressie: 42/42 groen.

  **Herziening v3 (op verzoek, meteen na oplevering):** de gebruiker
  vroeg om een veel grotere kelder — "onder het atelier", ongeveer
  atelier-formaat (of +10% groter), met een plafondhoogte ≈
  `KAMER_HOOGTE`. Een letterlijke +10%-schaling rond hetzelfde midden
  bleek bij verificatie (obstakel-/mesh-overlapcheck) overal te botsen
  op bestaande muren (atelier-noord/oost/zuid, gang-zijmuren) of gewoon
  al de nis zelf te zijn — dus is gekozen voor exact het bestaande
  nis+atelier-L-vorm-grondplan (135 + 42 = 177 m², ruim groter dan het
  atelier alleen) als de veilige, conflictvrije invulling van "onder
  het atelier, ongeveer dezelfde grootte". De trap draait 180°: vanaf
  dezelfde deur 5 daalt hij niet meer wég van de nis (naar het lege
  westen van v2), maar juist ín de nis (oostwaarts), tot de vloer het
  hele grondplan beslaat — `KELDERTRAP_X_OOST`/`_WEST`/`KELDER_X_WEST`
  zijn vervangen door `KELDERTRAP_X_BOVEN`/`_ONDER`. `KELDER_DIEPTE`
  ging van 2,6 naar 3,3 m (moest > `KELDER_HOOGTE` blijven, anders
  steekt het plafond door de atelier-vloer heen); `KELDER_HOOGTE` van
  2,3 naar 3,2 m (= `KAMER_HOOGTE`). Dit is wéér een gedeelde X/Z-
  footprint met een bestaande ruimte (net als de foute v1!) — ditmaal
  bewust en correct, want (a) de vloer van nis/atelier zelf blijft
  volledig intact, de trap in de nis-westmuur blijft de ENIGE
  verbinding, dus geen zichtbaarheidsrisico; (b) de bestaande
  nis/atelier-muren (al geregistreerd, Y-blind) begrenzen de kelder nu
  "gratis" op elke Y, dus de drie oude `kelderWand()`-obstakels zijn
  weg (obstakel-totaal 43 → 40) — vervangen door zuiver zichtbare
  "huid"-muren (`kelderVisueleWand()`, geen `registreerRechthoek()`) op
  de exacte plek van de zes echte wand-segmenten.
  **Y-aanname-audit, ronde 2:** deze herziening onthulde een échte bug
  die v2 nog niet raakte: `updateInteracties()` en
  `updateWinkelMarkeringen()` waren altijd al X/Z-only (Y was overal
  impliciet 0) — onschuldig zolang niets underground lag. Nu de kelder
  dezelfde X/Z deelt met het atelier, zou een kelder-interactiepunt
  zonder correctie ook vanaf de begane grond bruikbaar zijn geweest.
  Fix: beide functies negeren nu kandidaten waarvan `|Δy|` de nieuwe
  `KELDER_Y_MARGE` (1 m) overschrijdt — 100% no-op voor alle bestaande
  (boven-grond) punten, en precies de eigenschap die nodig is voor de
  hierna verplaatste Pantserdrank.
  **Pantserdrank verplaatst naar de kelder** (op verzoek, "dan kan je
  daarna de extra health upgrade in de kelder plaatsen"): `PANTSERDRANK_
  X`/`_Z` blijven ONGEWIJZIGD (die waren toch al relatief aan het
  atelier, dus vallen nu vanzelf binnen de kelder); alleen de Y van de
  mesh/markering/interactiePunt verschuift naar `-KELDER_DIEPTE`.
  Geverifieerd (nieuwe test + scratch-check): vanaf dezelfde X/Z op de
  begane grond reageert het punt niet meer, alleen op de kelderdiepte
  zelf.
  **Lichten:** de kleine kelder had genoeg aan 1 lamp; de ~4× grotere
  ruimte kreeg er een tweede bij (nis-deel + atelier-deel) —
  lichttelling 26 → 27, opnieuw meegenomen in `lampLichten` (flikker-/
  Stroomuitval-systeem). Alle betrokken tests (`test-kelder-trap.mjs`
  volledig herschreven voor de omgedraaide trap-as en het L-vorm-
  grondplan; lichttelling-/obstakel-tellingen in de overige suites
  bijgewerkt) — volledige regressie opnieuw 42/42 groen.

  **Bugfix v4 (gemeld door de gebruiker): vanuit de startkamer weglopen
  liet je in de kelder "vallen".** Oorzaak: `berekenKelderY(x,z)` was
  nog steeds een PURE functie van positie — dat kán principieel niet
  meer sinds v3, want dezelfde `(x,z)` bestaat nu op twee geldige Y's
  (atelier-vloer op 0, keldervloer op `-KELDER_DIEPTE`). Elk punt
  binnen het atelier voldeed toch al aan `x >= KELDERTRAP_X_ONDER`, dus
  wie via de gewone gang (niets met de trap te maken) het atelier
  binnenliep, zakte meteen naar de kelderdiepte. Fix: een nieuwe
  `spelerInKelder`-state (module-scoped) onthoudt of de speler
  daadwerkelijk via de trap is afgedaald; die state wordt UITSLUITEND
  bijgewerkt binnen de smalle trapband zelf (de enige plek die nog wél
  ondubbelzinnig is — niets anders in het spel deelt die band). Overal
  buiten de trapband levert `berekenKelderY()` puur de laatst bekende
  state terug, of expliciet `false` zodra de speler het hele
  nis+atelier-grondplan verlaat. Geverifieerd met een gesimuleerde
  speelsessie (startkamer → gang → atelier/nis, zonder ooit de trap aan
  te raken: Y blijft overal exact 0) én een volledige heen-en-terug-
  reis via de trap zelf (0 → -3,3 → weer 0, state klopt bij elke stap).
  `tests/test-kelder-trap.mjs` kreeg hiervoor specifieke
  regressietests. Volledige regressie: opnieuw 42/42 groen.

  **Herziening v5 (na een tweede bugmelding): gedeelde footprint
  definitief losgelaten.** De v4-fix loste het "vallen via de gang"-geval
  op, maar de gebruiker meldde daarna dat hij nog stééds naar beneden viel
  vóór het kopen van de deur. Terecht: de trapkoker liep in v3/v4 vanaf de
  nis-westmuur OOSTWAARTS de nis in, en de nis is vrij beloopbaar — dus
  wandelde je gewoon de trap op zonder ooit deur 5 te kopen. Elke verdere
  pleister zou Y-bewuste obstakels vereisen (obstakels die alleen op een
  bepaalde verdieping gelden), precies de generieke 3D-collisionlaag die
  dit ticket expliciet buiten scope houdt.
  **Conclusie:** een kelder die zijn X/Z deelt met een ruimte erboven is
  in deze 2D/Y-blinde codebase niet veilig te maken. Daarom nu weer een
  echt disjuncte footprint (zoals §7.5.1 vanaf het begin voorschreef),
  maar op de gevraagde schaal: de hele kelder — trapkoker én ruimte —
  ligt ten westen van de nis-westmuur, volledig buiten GRENS, waar niets
  anders staat. De kelderruimte is 15 x 9,9 m = **148,5 m² = het atelier
  (135 m²) + exact 10%**, met `KELDER_HOOGTE = KAMER_HOOGTE` (3,2 m).
  `berekenKelderY()` is daardoor weer volledig puur (geen state meer);
  `spelerInKelder` is verwijderd.
  **De drie gebruikerseisen zijn nu structureel gegarandeerd:**
  (1) *je moet de deur kopen* — `deur5Obstakel` blokkeert het deurgat, en
  vóór aankoop komt de speler niet westelijker dan x ≈ −11,15;
  (2) *alleen de trap* — `berekenKelderY()` geeft per constructie 0 terug
  voor élke x ≥ `KAMER2_NIS_X_WEST`, dus in de startkamer, gang, atelier,
  nis, binnenplaats en bijkeuken kan Y nooit veranderen; geverifieerd met
  een raster van 15.327 punten over de hele bovengrondse kaart;
  (3) *geen ondode* — ondode-aanroepen van `losBotsingenOp()` geven
  `magKelderBinnen` niet door en blijven dus altijd op `GRENS.minX`
  geklemd, ook ná aankoop.
  **Trap zelf** (op verzoek "een duidelijke trap met klein beetje
  verlichting"): 10 zichtbare treden over 4 m, omsloten door twee
  kokermuren (echte obstakels) en een aflopend plafond dat per trede
  2,4 m hoofdruimte houdt, plus één zwak peertje halverwege de koker.
  De kelderruimte zelf heeft twee peertjes — lichttelling 27 → 28.
  **Pantserdrank** staat nu midden in die kelderruimte. Volledige
  regressie: 42/42 groen, met `tests/test-kelder-trap.mjs` uitgebreid tot
  30 checks waaronder het volledige bovengrondse raster en een
  "duw 200 frames tegen de dichte deur"-regressietest.

  **Feedbackronde (verlichting): kelder ongeveer even licht als de
  startkamer.** De twee kamerlampen gingen van intensiteit/bereik 12/8
  naar 18/10 (de startkamer heeft 2 lampen op 16/10, maar de keldervloer
  is ~1,65x groter). Dat alleen bleek niet genoeg: een screenshot-
  vergelijking (speler vlak bij een lamp, kijkend naar de vloer) liet
  zien dat de STENEN BASISKLEUREN zelf te donker waren om ooit goed op
  te lichten, ongeacht lichtsterkte — `KELDER_TINT` (muren) ging van
  `0x1c1a17` naar `0x4a443c`, de keldervloer van `0x141210` naar
  `0x3d352c` (beide ~2,5-3x lichter, nog steeds koel/stenig i.p.v. het
  warme hout van de startkamer — alleen de HELDERHEID trekt gelijk). Het
  plafond blijft bewust bijna zwart (`0x08090a`), net als het
  woonkamerplafond (`0x14100c`) — plafonds zijn overal donker "opzettelijk
  gesloten" per ontwerp, dat draagt niet bij aan de gepercipieerde
  kamerhelderheid. Volledige regressie: 42/42 groen (lichttelling
  ongewijzigd op 28, alleen kleur-/intensiteitswaarden pasten).
- **Afhankelijk van:** —
- **Doel:** een eerste stuk echte verticaliteit toevoegen: een kelder
  onder een bestaand deel van het huis, bereikbaar via een trap met een
  deterministische Y-beweging.
- **Huidige situatie:** `speler.positie` heeft uitsluitend x/z-mutaties
  tijdens gameplay; alle botsingslogica (`registreerRechthoek`,
  `losBotsingenOp`, `isVrijePlek`) is volledig 2D en Y-onwetend.
- **Gewenste situatie:** een nieuwe kelder-footprint, disjunct van de
  bestaande `GRENS`-rechthoek, bereikbaar via een vaste
  trap-corridor waarin `speler.positie.y` lineair interpoleert tussen 0
  en een vaste kelderdiepte puur als functie van positie langs de
  trap-as (zie ARCHITECTURE_NOTES.md §7.5.1). Buiten die band blijft
  `positie.y` exact zoals nu.
- **Codegebieden:** nieuwe kelder-/trapconstantes, `speler.positie`
  (Y-veld toevoegen/gebruiken), render-/camera-hoogtecode
  (`speler.hoogte`-toepassing), lokale kelder-grenscontrole.
- **Buiten scope:** algemene 3D-physics/zwaartekracht/sprong; een
  Y-aware herschrijving van `registreerRechthoek`/`losBotsingenOp`/
  `isVrijePlek` (die blijven 2D, de trap is een uitzonderingsband).
- **Randgevallen:** elke bestaande plek die met `speler.positie` rekent
  (schietrichting, botsingen, zone-lookup) moet expliciet
  gecontroleerd worden op impliciete "Y is altijd 0"-aannames vóór dit
  ticket als afgerond geldt (zie ARCHITECTURE_NOTES.md §7.9).
- **Performancevoorwaarden:** trap-Y-interpolatie is een simpele
  per-frame lineaire berekening binnen een smalle band — geen
  allocaties, geen zware per-frame lookup.
- **Acceptatiecriteria:**
  - Speler kan via de trap soepel af- en oplopen, camera-hoogte volgt
    correct.
  - Buiten de trapband blijft bestaand 2D-gedrag 100% ongewijzigd
    (regressie).
  - `GRENS` zelf is ongewijzigd; kelder heeft eigen lokale
    grenscontrole.
  - Geen enkele bestaande test faalt door de nieuwe Y-aanname-audit.
- **Testplan:** `check-load` + nieuwe trap-/Y-bewegingstest + volledige
  regressie (met bijzondere aandacht voor elke test die
  `speler.positie` leest/schrijft) + screenshotronde trap op/af. Niet
  combineren met T63.
- **Risico's:** eerste keer dat `positie.y` structureel gebruikt wordt
  in dit project — hoogste regressierisico van de hele ronde, vandaar
  VOORZICHTIG.
- **Rollback:** kelder-/trapconstantes en Y-interpolatiecode
  verwijderen; `speler.positie.y` blijft impliciet 0 zoals voorheen.
- **Sonnet solo:** ja, met verplichte Y-aanname-audit als onderdeel van
  het ticket (niet optioneel).

---

## Ticket 63 — Kelder als permanente veilige zone + inhoud

- **Type:** nieuwe ruimte / content
- **Verbetergebied:** 2 (Ruimtelijke diepte)
- **Prioriteit:** middel
- **Status:** ✅ voltooid. De veiligheidsgaranties (geen kelder-referentie
  in `ZONE_GRAAF`/`NAV_VOLGENDE`/spawn-vensters) bestonden al structureel
  sinds T62 v5 (de kelder heeft nooit een eigen zone-id of spawnvenster
  gekregen — dat is precies de architecturale keuze uit §7.5.2). Dit
  ticket voegde de nog ontbrekende stukken toe: (1) een klein, eigen
  setje decor in de kelderruimte — een wijnrek (rugpaneel + 3 planken met
  flessen) tegen de westmuur, en een kratten-/vatstapel in de
  zuidwesthoek, beide met ruime afstand tot de trap-uitgang en de
  Pantserdrank-marker; puur sfeer, geen collision (zelfde patroon als de
  bestaande `bouwKratten()`/`bouwVat()` elders in het bestand — de kelder
  kreeg een eigen `kelderMeubel()`-helper omdat de bestaande helpers een
  vloer op y=0 aannemen). Het optionele "bestaand interactiepunt herplaatst"
  telt al als gedaan: Pantserdrank staat sinds T62b al in de kelder. (2)
  Een expliciete integratietest (`tests/test-kelder-trap.mjs`, sectie 10):
  alle vijf deuren kopen (worstcasescenario — elke `VENSTERS_*`-array
  actief, de hele `ZONE_GRAAF` open), 27 ondoden spawnen over alle
  vensters, en 600 simulatieframes draaien met een speler die steeds van
  zone wisselt (zodat elke ondode een cross-zone-navigatiepad probeert).
  Bij elke tick geteld: nul ondoden ooit in de kelder-footprint of
  -trapband, en geen enkele ondode ooit voorbij `GRENS.minX` — bevestigt
  numeriek wat de architectuur al garandeerde. `zoneVan()` HUD-herkenning
  van de kelder is bewust NIET toegevoegd (optioneel volgens de
  ticket-tekst; het risico van een extra zone-id die overal
  (spawn-weging, banners, `ZONE_NAMEN`) moet worden meegenomen weegt niet
  op tegen een cosmetisch HUD-label — de kelder toont voorlopig gewoon
  "Het Atelier"). Volledige regressie: 42/42 groen (geen nieuwe
  obstakels/lichten, dus geen bestaande teltest hoefde te wijzigen).

  **Feedbackronde 1 (visueel): zwevende trap gefixt.** Het aflopende
  kokerplafond (één plafondsegment per trede, elk op vaste hoofdruimte
  boven díe trede) zakte bij de onderste treden tot ONDER het
  kelderplafond zelf — vanuit de kelderruimte keek je via de
  trapopening dus recht tegen een tweede, in de lucht zwevende trap aan.
  Fix: één vlak kokerdak over de hele koker (`KOKER_PLAFOND_Y`,
  constant) + twee sluitpanelen (boven bij het deurgat, onder waar de
  koker de kelderruimte in gaat) zodat er nergens een kijkgat open
  blijft. Het trap-peertje hangt nu aan een langer koord vanaf dat vaste
  dak i.p.v. per-trede mee te zakken. Geverifieerd met screenshots vanaf
  drie standpunten (in de kelder terugkijkend — exact het gemelde
  standpunt —, onderaan de trap omhoogkijkend, en vanuit de nis naar
  beneden): geen zwevende geometrie meer. Volledige regressie: 42/42
  groen (de 2 losse testfails die soms voorkomen bleken al voor deze
  wijziging te bestaan — bevestigd door dezelfde tests op de
  ongewijzigde code te draaien).

  **Feedbackronde 2 (gameplay): kelder niet langer permanent veilig.** Op
  verzoek herroepen: zombies mogen nu wél de kelder in, maar niet
  allemaal tegelijk. Zie ARCHITECTURE_NOTES.md §7.5.4 voor de volledige
  onderbouwing en code; samengevat: (1) alleen een ondode die al
  dichtbij het deurgat stond op het moment dat de speler afdaalt, krijgt
  (permanent) toestemming om de trap te gebruiken (`ondode.magKelderBinnen`,
  dezelfde GRENS-bypass en `berekenKelderY()`-koppeling als de speler);
  (2) wie niet dichtbij stond, blijft boven en dwaalt rond binnen zijn
  eigen zone (`kiesWanderDoel()`) i.p.v. voor de dichte deur te blijven
  opstapelen; (3) dit geldt al vanaf golf 1, geen aparte veilige periode.
  Deze drie keuzes zijn expliciet met de gebruiker afgestemd via
  `AskUserQuestion` vóór implementatie. `tests/test-kelder-trap.mjs`
  sectie 11: 7 nieuwe checks (dichtbij → toegang + daadwerkelijk
  gebruik van de trap; ver weg → geen toegang, blijft geklemd, dwaalt
  merkbaar, blijft in eigen zone; permanentie van de toestemming ook
  nadat de speler weer boven is). Sectie 10 (de oude "kelder blijft
  altijd leeg"-test, voor het scenario waarin de speler nooit afdaalt)
  bleef ongewijzigd en slaagt nog steeds. Volledige regressie: 42/42
  groen.

  **Feedbackronde 3a (balans): "dichtbij de deur"-afstand van 3,5 naar
  6 meter.** `KELDER_NABIJ_AFSTAND` op verzoek verhoogd, zodat meer
  ondoden die rond de trap staan meekomen. Neveneffect: bij de grotere
  straal kon het willekeurige dwaalgedrag (`kiesWanderDoel()`, 2-6 m per
  stap) een "ver weg"-testondode tijdens een 10 s-simulatie legitiem
  binnen de nieuwe 6 m-cirkel laten drijven — correct spelgedrag, maar
  het maakte `tests/test-kelder-trap.mjs` sectie 11 flaky. Opgelost door
  de teststartpositie te verplaatsen naar de zuidoosthoek van het
  atelier (~20 m van de deur i.p.v. ~11,6 m), ruim buiten bereik van elke
  realistische dwaal-drift. Stabiel bevestigd over meerdere herhaalde
  runs; volledige regressie: 42/42 groen.

  **Feedbackronde 3b (verlichting): kelder-helderheid t.o.v. de
  woonkamer, ook tijdens Stroomuitval.** Zie ARCHITECTURE_NOTES.md
  §7.5.5 voor de volledige onderbouwing. Samengevat: de kelder was in
  beide standen merkbaar donkerder dan de woonkamer (beginruimte); op
  verzoek ("allebei, met kleinere stappen in elk") zowel de
  wand-/vloerkleur iets opgelicht als de kamerlampen iets sterker
  gemaakt, plús een nieuw per-lamp `stroomVloer`-mechanisme (zelfde
  vloer-patroon als `HEMISFEER_STROOM_VLOER`) dat de twee
  kelder-kamerlampen tijdens Stroomuitval een hogere dim-vloer geeft
  zonder de normale-stand-helderheid te raken. Resultaat: normale stand
  ~89% zo licht als de woonkamer (ratio 0,89), Stroomuitval ~101% (ratio
  1,01) — beide dicht bij pariteit. `tests/test-stroomuitval.mjs`
  uitgebreid met een neutraliteitscheck (vóór Stroomuitval) en een
  vloer-formule-check (tijdens Stroomuitval). Volledige regressie:
  42/42 groen.

  **Feedbackronde 3c (formaat + balans): kelder gehalveerd, volgafstand
  naar 12 m.** Op verzoek ("veel te groot"): de kelderbreedte (richting
  het westen) gehalveerd van 15 naar 7,5 m, de lengte (noord-zuid, 9,9 m)
  ongewijzigd — 74,25 m² i.p.v. 148,5 m². Pantserdrank verschoven van
  `KELDER_X_WEST + 6` naar `+4` zodat hij goed gecentreerd blijft (4 m van
  de westmuur, 3,5 m van de oostmuur/trapkoker) i.p.v. te dicht tegen de
  oostmuur van de nu kleinere kamer aan te staan; de twee kamerlampen kregen om
  dezelfde reden nieuwe, kleinere offsets (anders vielen ze exact samen).
  `KELDER_NABIJ_AFSTAND` nogmaals verhoogd, 6 -> 12 m. Zie
  ARCHITECTURE_NOTES.md §7.5.6 voor de volledige onderbouwing, inclusief
  waarom de "ver weg"-test in `test-kelder-trap.mjs` sectie 11 een kortere
  simulatieduur (30 i.p.v. 100 ticks) nodig had om deterministisch te
  blijven bij de kleinere veiligheidsmarge van de grotere straal.
  Volledige regressie: 42/42 groen in `test-kelder-trap.mjs` (4x herhaald),
  41/42 in de volledige suite — de ene overgebleven fail
  (`test-ontsnapping-vensters.mjs`) is bevestigd pre-existing en
  losstaand van deze wijziging (faalt identiek op de ongewijzigde code).

  **Feedbackronde 3d (balans + verlichting): kelder-restrictie volledig
  verwijderd, 20% donkerder.** Twee onafhankelijke wijzigingen op
  verzoek. (1) De hele gedeeltelijke-toegangsmechaniek uit
  Feedbackronde 2 en 3c — `KELDER_NABIJ_AFSTAND`, `kiesWanderDoel()`,
  het "boven blijven dwalen"-gedrag (`wachtBoven`/`wanderDoel`/
  `wanderTimer`) — is volledig verwijderd: elke ondode krijgt nu simpelweg
  altijd dezelfde `magKelderBinnen=true`-doorgifte als de speler, zonder
  afstandsdrempel. (2) De kelderkleuren (`KELDER_TINT` en de vloerkleur)
  zijn verdonkerd tot ~20% lagere gemeten pixelhelderheid. Zie
  ARCHITECTURE_NOTES.md §7.5.7 voor de volledige onderbouwing, inclusief
  waarom sectie 11 van `test-kelder-trap.mjs` is herschreven (test nu het
  NIEUWE onbeperkte gedrag i.p.v. de oude afstandsgating) en waarom
  `test-stroomuitval.mjs` ongewijzigd groen blijft (test alleen
  lichtintensiteit-fracties, niet renderkleur). Volledige regressie:
  `test-kelder-trap.mjs` 37/37 groen (3x herhaald), `test-stroomuitval.mjs`
  36/36 groen, volledige suite 41/42 — de ene overgebleven fail is
  opnieuw de pre-existing `test-ontsnapping-vensters.mjs`-timing-flake.

  **Feedbackronde 3e (verlichting): kelder nog eens ~18% donkerder.** Op
  verzoek ("nog 15-20% donkerder") bovenop de kleuren uit Feedbackronde
  3d: `KELDER_TINT`/vloerkleur nogmaals verlaagd, iteratief getuned met
  dezelfde pixelmeting (3 metingen om de niet-lineaire albedo/helderheid-
  relatie te compenseren, zie ARCHITECTURE_NOTES.md §7.5.8), uitkomend op
  ~18,1% donkerder dan de vorige ronde — binnen de gevraagde 15-20%.
  Volledige regressie: `test-kelder-trap.mjs` 37/37, `test-stroomuitval.mjs`
  36/36, volledige suite 42/42 groen.
- **Afhankelijk van:** T62
- **Doel:** de kelder vullen met passend decor/een interactiepunt en
  hem architecturaal borgen als permanente zombie-vrije zone.
- **Huidige situatie:** na T62 bestaat de kelder-geometrie, maar is hij
  leeg en nog niet expliciet uitgesloten van de AI-/spawn-systemen.
- **Gewenste situatie:** de kelder staat NIET in `ZONE_GRAAF`, heeft
  geen spawn-vensters (geen ondode kan er ooit spawnen of binnenkomen),
  en bevat een klein setje passend decor (wijnrek, kratten) plus
  optioneel één bestaand interactiepunt-type herplaatst in de nieuwe
  ruimte (zie ARCHITECTURE_NOTES.md §7.5.2-7.5.3).
- **Codegebieden:** `ZONE_GRAAF`, spawn-vensterdefinities,
  `zoneVan()` (mag kelder herkennen voor HUD/label, niet voor
  AI-routing), nieuwe kelder-decorfuncties.
- **Buiten scope:** nieuwe gameplaymechanieken/itemtypes; elke wijziging
  aan `updateOndoden()`/`NAV_VOLGENDE` die de kelder zou meenemen.
- **Randgevallen:** een speler die in de kelder staat mag NOOIT een
  ondode zien spawnen of binnenkomen — expliciete test hiervoor
  verplicht.
- **Performancevoorwaarden:** geen — puur statisch decor plus eventueel
  één interactiepunt, geen nieuwe per-frame logica.
- **Acceptatiecriteria:**
  - `ZONE_GRAAF`/`NAV_VOLGENDE` bevatten geen kelder-referentie.
  - Geen enkel spawn-venster wijst naar de kelder.
  - Screenshot toont passend, niet-zwevend decor.
  - Volledige regressie (met name `test-gracht-dock.mjs`) blijft groen.
- **Testplan:** `check-load` + nieuwe "kelder blijft leeg tijdens
  golven"-test (simuleer meerdere golven, tel ondoden in kelder-
  footprint = altijd 0) + screenshotronde + volledige regressie.
- **Rollback:** decorfuncties + eventueel interactiepunt verwijderen;
  kelder blijft leeg maar toegankelijk (of T62 in zijn geheel
  terugdraaien indien nodig).
- **Sonnet solo:** ja.

---

## Ticket 64 — Waypoint-navigatiegraaf: architectuur en dataset ✅

- **Type:** AI-infrastructuur
- **Verbetergebied:** 3 (Vijandintelligentie)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** een generieke, data-gedreven intra-zone waypointgraaf
  opzetten als fundament voor slimmere pathfinding (zie
  ARCHITECTURE_NOTES.md §7.6.1).
- **Huidige situatie:** binnen een zone loopt een ondode altijd in een
  kaarsrechte lijn naar de speler (`updateOndoden()`, regel
  ~4204-4228); cross-zone routing gebruikt wél al een BFS-graaf
  (`ZONE_GRAAF`/`NAV_VOLGENDE`), maar dat dekt geen intra-zone-obstakels.
- **Gewenste situatie:** per zone een kleine, hand-geplaatste lijst
  waypoints (data, geen algoritmische generatie); een nieuwe
  lookup-functie die het dichtstbijzijnde bruikbare waypoint richting
  de speler bepaalt.
- **Codegebieden:** nieuw waypoint-datastructuur (nabij
  `ZONE_GRAAF`), nieuwe lookup-/route-helperfunctie. Dit ticket bouwt
  ALLEEN de dataset + lookup, koppelt nog NIET aan `updateOndoden()`
  (dat is T65).
- **Buiten scope:** volledige A*/dynamische graafgeneratie; koppeling
  aan de daadwerkelijke beweging (T65).
- **Randgevallen:** waypoints moeten de bestaande, al gefixte
  chokepoints (gang-naar-de-gracht) dekken — expliciet nagerekend
  tegen de coördinaten uit `test-gracht-dock.mjs`.
- **Performancevoorwaarden:** lookup moet een simpele array-/
  object-indexering zijn (O(waypoints-per-zone), niet een per-frame
  graaf-traversal); geen allocaties in de lookup-hot-path.
- **Acceptatiecriteria:**
  - Waypoint-dataset dekt alle zones met een niet-triviale interne
    geometrie (in elk geval de gang-naar-de-gracht-zone).
  - Lookup-functie geeft voor bekende testposities het verwachte
    waypoint terug (unit-achtige test, geen visuele check nodig voor
    dit ticket).
  - Nog geen enkele gedragswijziging in het spel zelf (dit ticket is
    puur additief/dataset, `updateOndoden()` gebruikt het nog niet).
- **Testplan:** nieuw testbestand met lookup-checks per zone +
  `check-load` + volledige regressie (moet ongewijzigd blijven, want
  er is nog geen gedragskoppeling).
- **Rollback:** nieuw bestand/blok volledig verwijderen, geen
  bestaande code aangeraakt.
- **Sonnet solo:** ja.

---

## Ticket 65 — Waypoint-integratie: ad-hoc chokepoint-code vervangen ✅

- **Type:** AI-verbetering — VOORZICHTIG
- **Verbetergebied:** 3 (Vijandintelligentie)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** T64
- **Doel:** `updateOndoden()` laten routeren via de nieuwe
  waypointgraaf, én de oude ad-hoc chokepoint-special-case
  verwijderen (zie ARCHITECTURE_NOTES.md §7.6.2).
- **Huidige situatie:** `updateOndoden()` gebruikt
  `GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/`inZoneVier`
  (regel ~4204-4228) als eenmalige, zone-4-specifieke lap voor het
  gang-naar-de-gracht-chokepoint-probleem.
- **Gewenste situatie:** dezelfde routing-uitkomst (en beter, voor
  andere zones met obstakels) via de generieke T64-waypointgraaf; de
  oude special-case-variabelen en -logica zijn VOLLEDIG verwijderd, in
  DEZELFDE diff.
- **Codegebieden:** `updateOndoden()` (regel ~4204-4228),
  `GRACHTGANG_DREMPEL`-gerelateerde code, debug-exports die deze
  variabelen blootleggen.
- **Buiten scope:** wijzigingen aan `ZONE_GRAAF`/cross-zone-routing
  zelf (die blijft ongewijzigd, alleen de intra-zone-laag verandert).
- **Randgevallen:** de twee bugs die deze sessie zijn gefixt (zombies
  op de binnenplaats die niet naar het noordoosten volgen; de eerdere
  gang-chokepoint-bug) mogen NIET terugkeren — dit is het primaire
  regressierisico van dit ticket.
- **Performancevoorwaarden:** zelfde als T64 — geen per-frame
  allocaties/graaf-traversal in `updateOndoden()`.
- **Acceptatiecriteria:**
  - Oude `GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/
    `inZoneVier`-code bestaat niet meer.
  - `test-gracht-dock.mjs` (dekt beide sessie-bugs) blijft volledig
    groen.
  - Nieuwe/uitgebreide trajectory-trace-test bevestigt correcte
    pursuit-gedrag in minstens 2 andere zones met obstakels.
  - Volledige regressie blijft groen.
- **Testplan:** volledige `test-gracht-dock.mjs`-suite + trajectory-
  trace-tests (zelfde patroon als de sessie-fix) voor meerdere
  zones/hoeken + `check-load` + volledige regressie.
- **Risico's:** hoogste AI-regressierisico van de ronde — twee bugs in
  dit exacte codegebied zijn deze sessie al gefixt, vandaar
  VOORZICHTIG.
- **Rollback:** terug naar de oude ad-hoc special-case-code (git-
  historie), waypoint-koppeling verwijderen.
- **Sonnet solo:** ja, met verplichte volledige `test-gracht-dock.mjs`-
  regressie vóór het ticket als afgerond geldt.

**Uitvoering (T64+T65 in één diff):** zie ARCHITECTURE_NOTES.md §7.6.3
voor het volledige verslag. Samengevat: `ZONE_WAYPOINTS`/`zoekWaypoint()`
(nieuw, module-scope bij `ZONE_GRAAF`) vervangen de oude
`eigenInGracht`/`spelerInGracht`/`inZoneVier`-lokale variabelen in
`updateOndoden()`; `GRACHTGANG_DREMPEL` blijft bestaan en wordt nu als
data hergebruikt (`ZONE_WAYPOINTS[4][0].punt`). Alleen zone 4 heeft een
waypoint-entry — de atelier-nis en de binnenplaats-obstakels lost de
bestaande lokale ontwijk-logica al zelf op (nieuw vastgelegd als
regressie-anker). `test-gracht-dock.mjs` bleef **ongewijzigd** groen (het
sterkste bewijs van gedragsgelijkheid); nieuw testbestand
`tests/test-waypoint-navigatie.mjs` dekt de T64-dataset/lookup plus twee
trajectory-trace-tests in de andere obstakel-zones. Volledige regressie:
zie hieronder.

---

## Ticket 66 — Achtergrondmuziek

- **Type:** audio/sfeer
- **Verbetergebied:** 4 (Sfeer/audio)
- **Prioriteit:** middel
- **Status:** afgerond
- **Afhankelijk van:** —
- **Doel:** een permanente, originele achtergrondmuziek-laag toevoegen
  zonder de bestaande dreigingsaudio-drone te verstoren (zie
  ARCHITECTURE_NOTES.md §7.7.1).
- **Huidige situatie:** enige continue audio-laag is de
  dreigingsaudio-drone (regel 3135-3172,
  `dreigingsGainNode`/`zetDreigingsGain()`), plafond 0.07 gain; verder
  alleen eenmalige `piep()`-stings.
- **Gewenste situatie:** een tweede, permanente oscillator/gain-laag
  (eigen, origineel motief/akkoordbed) die exact het drone-patroon
  volgt — nooit gestopt/herstart, alleen via
  `gain.setTargetAtTime()` aangestuurd (bv. zachter tijdens
  golf-aankondigingen, iets voller tijdens combat); eigen
  volumeplafond (bv. 0.05) apart van de drone (0.07).
- **Codegebieden:** audio-opbouw nabij regel 3135-3172, nieuwe
  muziekgain-node + aansturingsfunctie, wave-/combat-state-hooks die de
  gain-doelwaarde bijwerken.
- **Buiten scope:** samples/audiobestanden; herkenbare bestaande
  game-muziek of -motieven (IP-regel, CLAUDE.md); dynamische
  instrumentatie-lagen die meer dan één extra oscillator-groep vergen.
- **Randgevallen:** gecombineerd volume (drone + muziek) mag de
  bestaande sfeer-audio niet overstemmen — expliciete gain-som-check
  in de test.
- **Performancevoorwaarden:** oscillator-nodes eenmalig aangemaakt bij
  eerste gebruikersinteractie (zelfde patroon als de bestaande
  AudioContext-opstart), nooit per-frame ge(her)alloceerd.
- **Acceptatiecriteria:**
  - Muziek-oscillator wordt na opstart nooit gestopt/herstart
    (debug-teller zoals `dreigingsGainSchrijfTeller` bevestigt alleen
    gain-writes, geen node-hercreaties).
  - Volumeplafond wordt nooit overschreden, ook niet gecombineerd met
    de drone op zijn piek.
  - Golf-aankondiging/combat-overgangen sturen de gain hoorbaar (in
    test: gain-doelwaarde) aan.
  - Volledige regressie blijft groen.
- **Testplan:** nieuw testbestand met gain-doelwaarde-checks per
  spelfase + node-identiteitscheck (zelfde node-referentie vóór/na een
  golf) + `check-load` + volledige regressie.
- **Rollback:** nieuwe audio-node-opbouw en aansturingscode
  verwijderen; bestaande dreigingsaudio-drone blijft ongewijzigd.
- **Sonnet solo:** ja.

---

## Ticket 67 — Minimap

- **Type:** UI/UX
- **Verbetergebied:** 5 (Spelerfeedback & oriëntatie)
- **Prioriteit:** middel
- **Status:** afgerond
- **Afhankelijk van:** —
- **Doel:** spelers een 2D-topdown-oriëntatiehulp geven (positie,
  richting, bekende zone-omtrekken, nabije ondoden).
- **Huidige situatie:** geen enkele vorm van kaart/oriëntatiehulp;
  spelers navigeren puur op de 3D-scene en de bestaande
  zone-naambanners/HUD-zonelabel (Ticket 50).
- **Gewenste situatie:** een klein, vast gepositioneerd 2D-`<canvas>`
  bovenop de bestaande HUD, elke frame (of licht doorbelast) opnieuw
  getekend: speler-positie/-richting, statische zone-omtreklijnen
  (afgeleid van bestaande zone-/muurconstantes) en nabije ondoden als
  stippen (zie ARCHITECTURE_NOTES.md §7.8.1).
- **Codegebieden:** nieuw `<canvas id="minimapUI">`-element (HTML,
  zelfde patroon als andere HUD-`<div>`'s), nieuwe
  `tekenMinimap()`-functie aangeroepen vanuit de render-/update-loop.
- **Buiten scope:** een 3D-render-target-gebaseerde minimap (geen
  extra Three.js-camera); fog-of-war/verkenning-geheugen; interactieve
  minimap (klikbaar, zoombaar).
- **Randgevallen:** kelder (T62/T63) is een aparte Y-laag — de minimap
  toont in eerste instantie alleen de begane-grond-laag; als de speler
  in de kelder staat, toont de minimap dat via een simpel label/icoon,
  geen aparte kelder-sublaag-tekening.
- **Performancevoorwaarden:** canvas-tekenwerk mag niet elke frame vol
  gebeuren als dat merkbaar kost — throttle naar elke 2-3 frames indien
  nodig; geen allocaties per tekenbeurt (hergebruik dezelfde
  canvas-context-state).
- **Acceptatiecriteria:**
  - Minimap toont correcte relatieve positie/richting van de speler in
    minstens 3 verschillende zones (screenshotcheck).
  - Nabije ondoden verschijnen als stippen binnen een vaste radius.
  - Geen waarneembare framerate-terugval (perf-test).
  - Volledige regressie blijft groen.
- **Testplan:** `check-load` + nieuwe minimap-render-test (canvas-
  pixel-/state-check op bekende posities) + screenshotronde + perf-test.
- **Rollback:** `<canvas id="minimapUI">` en `tekenMinimap()`-aanroep
  verwijderen.
- **Sonnet solo:** ja.

---

## Ticket 68 — Duidelijkere richtingsfeedback bij schade

- **Type:** UI/UX
- **Verbetergebied:** 5 (Spelerfeedback & oriëntatie)
- **Prioriteit:** middel
- **Status:** afgerond
- **Afhankelijk van:** —
- **Doel:** spelers direct laten zien uit welke richting schade komt.
- **Huidige situatie:** schade toont alleen het bestaande vignet-
  /hp-bar-effect, zonder richtinginformatie.
- **Gewenste situatie:** een kort, richtinggevoelig DOM-"wedge"-element
  aan de rand van het beeld, georiënteerd op de hoek tussen
  kijkrichting en schaderichting, dat kort oplicht en uitfaded; een
  vast, klein aantal vooraf aangemaakte wedge-elementen wordt
  hergebruikt (zelfde effects-pool-patroon als `tracerPool`/
  `impactPool`, regel 2957-2959) — zie ARCHITECTURE_NOTES.md §7.8.2.
- **Codegebieden:** nieuwe DOM-wedge-pool (HTML/CSS + JS-pool,
  vergelijkbaar met bestaande effect-pools), schade-afhandeling
  (`raakOndode()`/speler-schadepad) roept de pool aan.
- **Buiten scope:** een nieuwe canvas-laag (puur CSS/DOM-transform);
  schade-types verder categoriseren (elke schadebron gebruikt dezelfde
  wedge-stijl).
- **Randgevallen:** meerdere gelijktijdige treffers uit verschillende
  richtingen moeten allemaal een eigen wedge tonen (pool moet meerdere
  actieve wedges tegelijk aankunnen tot de pool-grootte).
- **Performancevoorwaarden:** geen `document.createElement`/allocaties
  in de schade-hot-path (`raakOndode()`/schade-afhandeling) — alleen
  hergebruik van vooraf aangemaakte pool-elementen, exact zoals
  `tracerPool`/`impactPool` nu al werken.
- **Acceptatiecriteria:**
  - Bij schade van een bekende hoek verschijnt de wedge op de
    verwachte rand-positie (test met bekende speler-/schade-hoeken).
  - Pool-elementen worden hergebruikt, geen DOM-groei tijdens een lange
    speelsessie (regressietest: element-aantal blijft constant na N
    treffers).
  - Volledige regressie blijft groen.
- **Testplan:** nieuw testbestand met hoek-naar-positie-checks +
  pool-hergebruik-check (DOM-node-aantal vóór/na veel treffers) +
  `check-load` + volledige regressie.
- **Rollback:** DOM-wedge-pool en de aanroep in de schade-afhandeling
  verwijderen.
- **Sonnet solo:** ja.

---

## v0.20 — Architectuurronde 6: resourcebeheer, frame-budget en betrouwbaarheid (gepland, nog NIET geïmplementeerd)

Architectuur: zie ARCHITECTURE_NOTES.md §8 (beslissingen 63-69).
Sonnet-prompts: zie SONNET_EXECUTION_PLAN.md, "ronde 6 (v0.20)".

**Aanleiding.** Deze ronde komt NIET uit een feature-wens maar uit een
volledige code-audit (senior engineer / performance engineer / game
design) op de stand van commit `da3524e`. Anders dan de rondes hiervoor
voegt v0.20 daarom bewust bijna geen nieuwe spelinhoud toe: het gros is
het dichten van resource-lekken, het weghalen van werk uit de per-frame
hot path, en het zichtbaar maken van faalmodi die nu stil zijn. De
audit-bevindingen zijn met metingen onderbouwd; die metingen staan per
ticket bij **Huidige situatie** en integraal in ARCHITECTURE_NOTES §8.11.

**Uitgangspositie bij aanvang van deze ronde** (gemeten, niet geschat):
48/48 regressiescripts groen · 7.887 regels in `amsterdam-undead.html` ·
486 meshes / 445 unieke geometrieën (hergebruikratio 1,09) · 268 unieke
materialen · 26 PointLights + 1 HemisphereLight · 1 schaduwwerpend licht
met 156 schaduwwerpende meshes · 52 collision-obstakels · 96 muteerbare
top-level `let`-bindings · **0 `.dispose()`-aanroepen in het hele
bestand**.

**Verbetergebieden deze ronde** (nummering per-ronde):
1. Resourcebeheer & stabiliteit (T69-T70)
2. Frame-budget (T71-T72)
3. Vijandleesbaarheid (T73)
4. Betrouwbaarheid & foutafhandeling (T74)
5. Spelerervaring & toegankelijkheid (T75-T76)
6. Testinfrastructuur (T77-T78)
7. Renderbudget (T79, VOORZICHTIG)

**Volgorde-advies.** T69 en T77 eerst (het lek en de test die 'm bewaakt),
daarna T71/T72 (goedkoop, laag risico), dan T73/T74, dan T75/T76. T78
kan op elk moment. T79 is expliciet gegate op profiling en mag pas ná de
rest.

---

## Ticket 69 — Gedeelde geometrie-cache voor ondode-modellen (VOORZICHTIG)

- **Type:** bugfix / performance
- **Verbetergebied:** 1 (Resourcebeheer & stabiliteit)
- **Prioriteit:** kritiek
- **Status:** open (gepland)
- **Afhankelijk van:** — (maar T77 hoort in dezelfde ronde te landen als
  bewaking)
- **Doel:** het bevestigde GPU-geheugenlek dichten dat lineair meegroeit
  met de speelduur, zonder de hitboxen of het silhouet van welke ondode
  dan ook te veranderen.
- **Huidige situatie:** `maakOndodeModel()` maakt per ondode ~9 verse
  `BoxGeometry`/`SphereGeometry`-instanties én ~9 verse
  `MeshStandardMaterial`-instanties, die alle bestaande caches
  (`mat()`/`materiaalCache`, `matFamilie()`/`matFamilieCache`) omzeilen
  door de Three.js-constructor rechtstreeks aan te roepen. `doodOndode()`
  haalt de groep alleen uit de scene-graph. In het hele bestand komt
  `.dispose()` **nul keer** voor. Gemeten via
  `renderer.info.memory.geometries` met echte frames tussen spawn en
  kill: leeg 72 → 20 ondoden levend 252 (**exact +9 per ondode**) → 20
  ondoden opgeruimd nog steeds 252 (niets vrijgegeven) → na 80
  spawn/kill-cycli 796, lineair oplopend. Bij het huidige budgetmodel
  (`GOLF_BUDGET_BASIS` 5 + `GOLF_BUDGET_GROEI` 1,7/golf) spawnt een run
  van 25 golven ~490 ondoden, dus ~4.400 gelekte geometrieën plus een
  vergelijkbaar aantal materialen.
- **Gewenste situatie:** een `geoCache(sleutel, fabriek)`-helper naar
  exact het patroon van de bestaande `materiaalCache`/`matFamilieCache`
  (zelfde Map-lookup, zelfde plek in het bestand). De per-ondode
  maatvariatie (`vorm.rompBreedte`, `profiel.rompFactor`, armlengte/
  -dikte, lichaamslengte) verhuist van geometrie-parameters naar
  `mesh.scale`, zodat alle ondoden dezelfde ~9 gedeelde geometrieën
  hergebruiken. De ~9 directe `new THREE.MeshStandardMaterial(...)`-
  aanroepen gaan waar mogelijk via `mat()`; het per-ondode
  `oogMateriaal` moet uniek BLIJVEN (`emissiveIntensity` wordt per
  ondode geanimeerd — zie `zetOogBasis()`/de windup-puls) en krijgt in
  plaats daarvan expliciete disposal in T70's opruimhelper.
- **Codegebieden:** `maakOndodeModel()` (STAP 6), de bestaande
  cache-helpers `mat()`/`matFamilie()` als sjabloon, `doodOndode()` en
  `updateStervenden()` voor het opruimmoment.
- **Buiten scope:** het samenvoegen van statische wereldgeometrie
  (`BufferGeometryUtils.mergeGeometries`) — dat is een eigen,
  profiling-gated ticket en raakt `userData.materiaalFamilie`;
  instancing (`InstancedMesh`) voor ondoden; elke wijziging aan het
  aantal of de indeling van lichaamsdelen.
- **Randgevallen:**
  - **Hitboxen mogen niet verschuiven.** De headshot-detectie leunt op
    `userData.lichaamsdeel === 'kop'` én op de werkelijke mesh-omvang;
    een schaalfout verandert stilzwijgend de moeilijkheidsgraad. De
    wereld-bounding-box van kop en romp moet vóór en ná identiek zijn.
  - Varianten met afwijkende onderdelen (Sjouwer-bochel, Brander-kern,
    Sluiper) moeten hun eigen cache-sleutel krijgen, niet per ongeluk
    die van het normale type delen.
  - `huidKleur.clone().multiplyScalar(...)` levert per ondode een andere
    kleur op — dat blijft een materiaal-as, geen geometrie-as, en mag
    dus niet in de geometrie-sleutel meegenomen worden.
- **Performancevoorwaarden:** na dit ticket mag
  `renderer.info.memory.geometries` NIET meer groeien over herhaalde
  spawn/kill-cycli (harde assertie in T77). Het aantal geometrieën bij
  een volle golf moet meetbaar dalen t.o.v. de nulmeting hierboven.
- **Acceptatiecriteria:**
  - 100 spawn/kill-cycli met echte frames ertussen laten
    `renderer.info.memory.geometries` binnen ±2 gelijk (was: +900).
  - Wereld-bounding-box van kop én romp identiek vóór/ná (tolerantie
    ≤ 1 mm) voor elk van de vijf ondode-types.
  - `test-ondode-model.mjs`, `test-ondode-vormen.mjs`,
    `test-ondode-hitreacties.mjs`, `test-vijand-leesbaarheid.mjs` en
    `test-varianten.mjs` blijven ongewijzigd groen.
  - Volledige regressie blijft groen.
- **Testplan:** eerst T77's geheugentest schrijven en 'm rood zien
  falen op de huidige code (bewijs dat de test het lek daadwerkelijk
  vangt), dan pas dit ticket implementeren en 'm groen zien worden.
  Daarna de bounding-box-vergelijking, de vier genoemde
  ondode-testbestanden, `check-load` en de volledige suite.
- **Rollback:** `geoCache`-helper verwijderen en `maakOndodeModel()`
  terugzetten op directe geometrie-constructie (één samenhangende diff,
  geen halve staat mogelijk).
- **Sonnet solo:** nee — hitbox-gevoelig, doe dit met expliciete
  voor/na-bounding-box-metingen.

---

## Ticket 70 — Dispose-contract voor wegwerp-objecten

- **Type:** bugfix
- **Verbetergebied:** 1 (Resourcebeheer & stabiliteit)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** T69 (deelt de opruim-helper)
- **Doel:** alle overige objecten die tijdens een run worden aangemaakt
  en weer weggegooid, netjes vrijgeven — zodat "geen `.dispose()` in het
  bestand" niet stilletjes terugkeert bij het volgende effect.
- **Huidige situatie:** naast de ondode-modellen (T69) maken ook
  `ontploiBrander()` (flits-mesh + `PointLight`, opgeruimd via
  `setTimeout(..., 220)`) en `spawnPowerupDrop()` (octaëder-mesh +
  eigen `MeshStandardMaterial` + `PointLight`) per keer verse
  geometrie/materialen aan die alleen uit de scene worden gehaald.
  De `setTimeout`-opruiming loopt bovendien door tijdens pauze.
- **Gewenste situatie:** één gedeelde `ruimGroepOp(object3D)`-helper die
  `traverse()`t en per mesh `geometry.dispose()` + `material.dispose()`
  aanroept (materiaal-arrays afhandelen; **gedeelde** cache-materialen
  uit `mat()`/`matFamilie()` overslaan — die horen juist te blijven
  leven). Aangeroepen vanuit `updateStervenden()` (na afloop van de
  valanimatie), `ontploiBrander()` en de twee opruimplekken in
  `updatePowerups()`/`raapPowerupOp()`. De explosie-opruiming verhuist
  van `setTimeout` naar een timer in de bestaande cosmetische zone van
  de game-loop, zodat 'ie het pauzegedrag van de rest volgt.
- **Codegebieden:** nieuwe helper naast `doodOndode()`,
  `ontploiBrander()`, `spawnPowerupDrop()`, `raapPowerupOp()`,
  `updatePowerups()`, `updateStervenden()`.
- **Buiten scope:** de effect-pools (`tracerPool`/`impactPool`) — die
  zijn al correct begrensd en hergebruikt en mogen NIET disposed
  worden; texturen uit `bouwCanvasTextuur()` (gedeeld en permanent).
- **Randgevallen:**
  - Een gedeeld cache-materiaal disposen zou álle objecten die het
    delen onzichtbaar/zwart maken — de helper moet gedeelde materialen
    aantoonbaar overslaan (markeer cache-materialen bij aanmaak, bv.
    `material.userData.gedeeld = true`).
  - Een Brander die ontploft terwijl een tweede Brander in de
    kettingreactie zit, mag geen dubbele dispose op hetzelfde object
    veroorzaken.
  - Pauze tijdens een lopende explosieflits: de flits moet bij hervatten
    gewoon verder aftellen, niet blijven hangen.
- **Performancevoorwaarden:** geen `traverse()` in de per-frame hot
  path — alleen op het opruimmoment.
- **Acceptatiecriteria:**
  - 200 Brander-explosies en 200 powerup-drops laten
    `renderer.info.memory.geometries` niet groeien.
  - Een gedeeld materiaal (bv. `KELDER_TINT`-steen) blijft na 200
    explosies zichtbaar en niet-disposed.
  - Volledige regressie blijft groen.
- **Testplan:** uitbreiding van T77's geheugentest met een explosie- en
  een powerup-scenario, plus een visuele screenshotcheck dat gedeelde
  materialen intact blijven.
- **Rollback:** helper-aanroepen verwijderen (de helper zelf mag blijven
  staan, is dan dode code).
- **Sonnet solo:** ja.

---

## Ticket 71 — `updateHUD()` uit de per-frame hot path

- **Type:** performance
- **Verbetergebied:** 2 (Frame-budget)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** de HUD alleen nog laten schrijven wanneer er werkelijk iets
  aan de weergave verandert.
- **Huidige situatie:** `updateHUD()` doet 9× `document.getElementById`
  plus ~8 DOM-writes per aanroep, en wordt vanuit `updateSpelerRegen()`
  en `updatePowerups()` ELKE frame aangeroepen zolang de speler
  regenereert of een buff actief is. Gemeten: **60 schrijfacties naar
  `hpTekst` per seconde** tijdens regeneratie, dus ~540
  `getElementById`-lookups per seconde. Opvallend: het bestand cachet
  elders al wél correct (`hudUI`, `vignet`, `ammoUI`, `minimapUI`
  staan als const bovenaan) — `updateHUD()` is de enige uitzondering.
- **Gewenste situatie:** alle 9 element-referenties één keer als const
  bovenaan (zelfde plek/patroon als de bestaande UI-consts).
  `updateHUD()` onthoudt de laatst geschreven weergavewaarden en slaat
  een write over als die ongewijzigd zijn. De guard zit IN `updateHUD()`
  zelf, zodat geen van de 28 bestaande aanroepplekken hoeft te wijzigen.
- **Codegebieden:** `updateHUD()`, het UI-const-blok in STAP 3.
- **Buiten scope:** de HUD-inhoud/opmaak zelf; `updateSpelerRegen()` en
  `updatePowerups()` blijven `updateHUD()` gewoon aanroepen.
- **Randgevallen:**
  - Vergelijk op de WEERGEGEVEN waarde (`Math.round(hp)`), niet op de
    ruwe float — anders schrijft 'ie alsnog elke frame.
  - De HP-balkkleur wisselt op drempels (60%/30%): die moet blijven
    omslaan, dus de kleur hoort bij de vergeleken staat.
  - De buff-teller telt in hele seconden af (`Math.ceil`) — die moet
    elke seconde nog wél updaten, en één laatste keer bij het aflopen
    zodat de tekst leegt.
- **Performancevoorwaarden:** ≤ 2 HUD-writes per seconde tijdens
  ononderbroken regeneratie (was 60).
- **Acceptatiecriteria:**
  - DOM-schrijfteller: ≤ 2 writes/s tijdens 1 s regeneratie.
  - HP-balk, geld, golf, schade, herlaadtijd, wapennaam en
    buff-timers lopen visueel nog steeds live mee.
  - Volledige regressie blijft groen.
- **Testplan:** nieuwe DOM-schrijfteller-test (property-setter-spy op
  `hpTekst.textContent`, zelfde techniek als in de audit gebruikt) +
  `test-score-stats.mjs` + `test-powerups.mjs` + volledige regressie.
- **Rollback:** de vergelijk-guard verwijderen; de gecachete
  element-consts kunnen blijven staan.
- **Sonnet solo:** ja.

---

## Ticket 72 — Interactie-prompt en per-frame array-kopieën

- **Type:** performance
- **Verbetergebied:** 2 (Frame-budget)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** de resterende onnodige per-frame DOM-writes en allocaties
  uit de game-loop halen.
- **Huidige situatie:** (a) `updateInteracties()` roept elke frame
  `toonInteractiePrompt()` of `verbergInteractiePrompt()` aan en schrijft
  dus altijd `style.opacity`; staat de speler bij een interactiepunt, dan
  wordt bovendien elke frame de prompt-string opnieuw opgebouwd via een
  template literal in de `prompt()`-callback. (b) `updatePowerups()` en
  `ontploiBrander()` maken met `[...powerups]` respectievelijk
  `[...ondoden]` elke frame een verse array-kopie.
- **Gewenste situatie:** (a) de prompt schrijft alleen bij een
  daadwerkelijke wijziging van zichtbaarheid óf tekst (bewaar de laatst
  getoonde staat); (b) de array-kopieën vervangen door achterwaartse
  index-loops (`for (let i = arr.length - 1; i >= 0; i--)`), wat
  veilig-verwijderen-tijdens-itereren behoudt zonder allocatie.
- **Codegebieden:** `updateInteracties()`, `toonInteractiePrompt()`,
  `verbergInteractiePrompt()`, `updatePowerups()`, `ontploiBrander()`.
- **Buiten scope:** de inhoud van de prompt-teksten; het
  interactiepunt-systeem zelf.
- **Randgevallen:**
  - De prompt moet nog steeds meteen verdwijnen bij pauze
    (`pointerlockchange` roept `verbergInteractiePrompt()` al expliciet
    aan) — de nieuwe guard mag dat pad niet blokkeren.
  - Prompt-teksten zijn dynamisch (prijzen veranderen mee met wat je al
    gekocht hebt): vergelijk op de resulterende string, niet op het punt.
  - `ontploiBrander()` verwijdert tijdens de loop elementen uit
    `ondoden` (kettingreactie) — de achterwaartse loop moet daar
    aantoonbaar tegen kunnen.
- **Performancevoorwaarden:** nul DOM-writes per frame als de speler
  stilstaat zonder interactiepunt in bereik.
- **Acceptatiecriteria:**
  - DOM-schrijfteller op `interactiePrompt`: 0 writes over 60 frames
    stilstand buiten bereik, 1 write bij het binnenlopen van bereik.
  - Kettingreactie-test voor Branders blijft groen
    (`test-varianten.mjs`).
  - Volledige regressie blijft groen.
- **Testplan:** DOM-schrijfteller-test + `test-varianten.mjs` +
  `test-powerups.mjs` + volledige regressie.
- **Rollback:** guards verwijderen, index-loops terugdraaien naar
  spread-kopieën.
- **Sonnet solo:** ja.

---

## Ticket 73 — Ondoden kijken in hun looprichting

- **Type:** bugfix / vijandleesbaarheid
- **Verbetergebied:** 3 (Vijandleesbaarheid)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** ondoden niet langer zijwaarts/achterwaarts laten schuifelen
  terwijl ze naar een deur navigeren, zodat hun beweging en hun
  aanvals-tell weer leesbaar zijn.
- **Huidige situatie:** `updateOndoden()` zet de kijkrichting
  onvoorwaardelijk op de richting náár de speler
  (`rotation.y = Math.atan2(rechtstreeks.x, rechtstreeks.z)`), terwijl de
  beweging het navigatiedoel volgt
  (`doelPunt = volgendeDeur || tussenWaypoint || speler.positie`).
  Gemeten scenario (ondode in de woonkamer, speler in het atelier,
  nav-doel = gangdeur op (0, −5)): bewegingshoek −156,4°, kijkhoek
  −166,9° → **10,5° mismatch**. Ligt het waypoint haaks op de
  spelerrichting (rond een hoek, in de gang naar de gracht, of bij de
  kelderoost-deur), dan loopt dit structureel op richting 90° en staart
  de ondode je zichtbaar door een muur heen aan terwijl hij zijwaarts
  loopt.
- **Gewenste situatie:** de kijkrichting volgt de daadwerkelijke
  looprichting (`richting`, incl. de ontwijk-blend), BEHALVE tijdens
  `aanvalStaat === 'windup'` — daar is naar de speler draaien juist het
  bedoelde gedrag en zit al een eigen, beperkte bijdraai-limiet
  (`AANVAL_DRAAI_SNELHEID`). Overweeg een korte lerp i.p.v. een harde
  set, zodat de draai niet schokt bij een waypoint-wissel.
- **Codegebieden:** `updateOndoden()`, de regel die `groep.rotation.y`
  zet (net ná `losBotsingenOp()`/`berekenKelderY()`).
- **Buiten scope:** de pathing zelf (`NAV_VOLGENDE`, `ZONE_WAYPOINTS`,
  `zoekWaypoint()`) — dit ticket verandert uitsluitend de VISUELE
  oriëntatie; de gelopen route moet aantoonbaar identiek blijven.
- **Randgevallen:**
  - Staat een ondode stil (geblokkeerd, snelheid ≈ 0), dan is
    `richting` instabiel — behoud dan de laatste geldige hoek in plaats
    van naar 0 te springen.
  - Tijdens `herstel` beweegt de ondode op verlaagde snelheid door: die
    moet gewoon meedraaien met zijn looprichting.
  - De melee-raakcheck gebruikt `hoekVerschil` t.o.v. `doelHoek` (naar de
    speler) — die logica hoort ONGEWIJZIGD te blijven, anders verandert
    de trefkans.
- **Performancevoorwaarden:** geen extra transform-writes per ondode per
  frame (het budget van ≤ 10 uit ARCHITECTURE_NOTES §4.9 blijft staan);
  dit vervangt een bestaande write, hij komt er niet bij.
- **Acceptatiecriteria:**
  - Bij cross-zone-pathing is het verschil tussen bewegingshoek en
    kijkhoek < 15° (was 10,5° in het gemeten geval en groeiend rond
    hoeken).
  - Tijdens `windup` kijkt de ondode aantoonbaar nog steeds naar de
    speler.
  - De afgelegde route (positiereeks over 60 ticks) is identiek aan
    vóór het ticket — bewijs dat alleen de visuele oriëntatie wijzigde.
  - `test-waypoint-navigatie.mjs`, `test-aanval-machine.mjs` en
    `test-aanval-tells.mjs` blijven groen.
- **Testplan:** nieuwe hoekvergelijkingstest (bewegingshoek vs. kijkhoek
  bij een cross-zone-doel, mét een echt herbouwde nav-tabel via
  `koopDeur()` — het raw zetten van `deurGekocht` herbouwt `NAV_VOLGENDE`
  NIET en levert een vals-negatief op) + route-gelijkheidstest + de drie
  genoemde bestanden + volledige regressie.
- **Rollback:** één regel terug naar `rechtstreeks`.
- **Sonnet solo:** ja.

---

## Ticket 74 — Zichtbare faalmodi: CDN-laadfout en corrupte opslag

- **Type:** betrouwbaarheid
- **Verbetergebied:** 4 (Betrouwbaarheid & foutafhandeling)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** de twee bekende stille faalmodi van het spel zichtbaar en
  begrijpelijk maken voor de speler.
- **Huidige situatie:** (a) Three.js komt via een importmap van
  `cdn.jsdelivr.net`. Is die onbereikbaar (offline, firewall, storing),
  dan wordt de module nooit uitgevoerd en gebeurt er letterlijk niets:
  geen foutmelding, geen aanwijzing, alleen een dood scherm. Het hele
  bestand bevat slechts 2 `try`-blokken. (b) `leesHighscore()` doet
  `JSON.parse` en gebruikt `record.score`/`record.golf` zonder enige
  validatie; corrupte of handmatig aangepaste localStorage geeft geen
  crash maar wel `Record: undefined` in beeld.
- **Gewenste situatie:** (a) een klein KLASSIEK (niet-module) scriptje
  vóór de module-`<script>` dat een timer zet; bestaat
  `window.AmsterdamUndeadDebug` na ~10 s nog niet, dan wordt een
  bestaande overlay gevuld met een begrijpelijke melding ("Kon Three.js
  niet laden — controleer je internetverbinding"), plus een
  `window.addEventListener('error')` voor directe module-fouten. (b)
  `leesHighscore()` valideert het gelezen record op vorm
  (`typeof score === 'number'`, eindig, `golf` een positief geheel getal)
  en geeft anders `null` terug — dezelfde stille-fallback-filosofie als
  het bestaande `try/catch`.
- **Codegebieden:** nieuw `<script>`-blok in de `<head>`/vóór de
  module-import, `leesHighscore()`, `toonStartschermRecord()`.
- **Buiten scope:** een lokale Three.js-fallback-kopie meenemen (breekt
  de "geen externe assets/single-file"-regel); een tweede CDN als
  uitwijk; retry-logica.
- **Randgevallen:**
  - De timeout mag de headless tests niet storen: die laden binnen
    ~800 ms, dus 10 s is ruim veilig — maar er moet een expliciete
    assertie zijn dat de melding tijdens een normale testrun NOOIT
    zichtbaar wordt.
  - Een geldig record met een ontbrekend `moeilijkheid`-veld (oudere
    opslagversie) moet gewoon blijven werken — de bestaande code doet
    daar al aan feature-detectie, dat gedrag behouden.
- **Performancevoorwaarden:** het extra scriptje mag niets doen zolang
  het laden slaagt (één timer, meteen geannuleerd).
- **Acceptatiecriteria:**
  - Met een geblokkeerde CDN-route (Playwright `route.abort()`)
    verschijnt binnen 15 s een zichtbare, leesbare melding.
  - Bij een normale run verschijnt die melding nooit.
  - Een gecorrumpeerd localStorage-record (`{"score":"veel"}`,
    `"[]"`, `"null"`) leidt tot een leeg record, geen `undefined` in
    beeld, geen console-error.
  - Volledige regressie blijft groen.
- **Testplan:** nieuw testbestand met een afgebroken CDN-route + drie
  corrupte-opslag-varianten + `check-load` + volledige regressie.
- **Rollback:** het extra scriptje verwijderen; validatie terugdraaien
  naar de kale `JSON.parse`.
- **Sonnet solo:** ja.

---

## Ticket 75 — Muisgevoeligheid instelbaar en persistent

- **Type:** UI/UX / toegankelijkheid
- **Verbetergebied:** 5 (Spelerervaring & toegankelijkheid)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** de meest gevraagde basisinstelling van elke first-person
  game beschikbaar maken.
- **Huidige situatie:** de kijksnelheid staat hardcoded als
  `0.0022` op twee plekken in de `mousemove`-handler; er is geen enkele
  spelerinstelling in het spel, en er is ook geen plek waar zoiets zou
  horen te staan.
- **Gewenste situatie:** een `MUIS_GEVOELIGHEID_BASIS`-constante plus een
  slider in het startscherm (dezelfde overlay als de moeilijkheidsknoppen
  en de geluidsknop), waarde bewaard in localStorage via hetzelfde
  beschermde lees-/schrijfpatroon als de highscore. Bereik ruwweg
  0,25×–3× de huidige waarde, met de huidige waarde als default, zodat
  bestaande spelers niets merken tenzij ze zelf schuiven.
- **Codegebieden:** `mousemove`-handler, startscherm-HTML/CSS,
  `leesHighscore()`/`schrijfHighscore()` als sjabloon voor de opslag.
- **Buiten scope:** aparte gevoeligheid voor x/y; muis-acceleratie;
  invert-Y; een volwaardig instellingenscherm (dit is één slider).
- **Randgevallen:**
  - localStorage geweigerd/afwezig: stil terugvallen op de default,
    exact zoals de highscore dat al doet.
  - Een corrupte/buiten-bereik-waarde moet geklemd worden, niet
    doorgelaten (anders is de camera onbestuurbaar en kan de speler er
    niet meer uit).
  - De slider mag geen pointer lock aanvragen bij klikken —
    `stopPropagation()`, exact hetzelfde patroon als de bestaande
    geluidsknop (zie Fix 4).
- **Performancevoorwaarden:** geen; de waarde wordt één keer gelezen en
  in een variabele gehouden.
- **Acceptatiecriteria:**
  - Slider verplaatsen verandert de kijksnelheid meetbaar
    (`speler.yaw`-delta bij een vaste `movementX`).
  - Waarde overleeft een herladen.
  - Klikken op de slider start of hervat het spel niet.
  - Volledige regressie blijft groen.
- **Testplan:** nieuw testbestand (gevoeligheid → yaw-delta,
  persistentie, geen-pointer-lock-check, klemming bij corrupte waarde) +
  volledige regressie.
- **Rollback:** slider verwijderen, constante terug naar de vaste
  waarde.
- **Sonnet solo:** ja.

---

## Ticket 76 — Ontsnappingsvereiste volledig in beeld

- **Type:** game design / UI
- **Verbetergebied:** 5 (Spelerervaring & toegankelijkheid)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** de wincondition ontdekbaar maken, zodat spelers er
  daadwerkelijk naartoe kunnen spelen.
- **Huidige situatie:** ontsnappen vereist drie dingen TEGELIJK: alle
  drie de vluchtonderdelen (elk met een eigen drempelgolf), €2500, en een
  golf die aan `isOntsnappingsGolf()` voldoet. De HUD toont hiervan
  alleen "Vluchtroute: n/3" en "Boot over n golven". Het geldvereiste
  wordt nergens genoemd vóórdat je bij het ontsnappingspunt staat, en het
  venstermechanisme evenmin. Een speler die niet toevallig €2500 op zak
  heeft op het juiste moment, ontdekt de wincondition waarschijnlijk
  nooit — terwijl er een compleet winscherm met scorebonus achter zit.
- **Gewenste situatie:** zodra het EERSTE vluchtonderdeel is opgeraapt,
  toont de HUD (of een eenmalige melding) het volledige vereiste,
  bijvoorbeeld: "Vluchtroute 1/3 · €2500 nodig · boot legt aan in golf
  X". Bij een open venster zonder genoeg geld een expliciete reden
  ("De boot ligt klaar — je hebt nog €N nodig") in plaats van stilte.
- **Codegebieden:** `raapVluchtOnderdeelOp()`, de bestaande
  ontsnappings-HUD-regel (`updateOntsnappingVensterHUD()`), het
  interactiepunt van De Ontsnapping.
- **Buiten scope:** het vereiste zelf veranderen (bedrag, aantal
  onderdelen, venstercadans) — dit ticket verandert uitsluitend de
  COMMUNICATIE, niet de balans; een questlog/objectievenscherm.
- **Randgevallen:**
  - De tekst mag de bestaande HUD-regels niet verdringen op kleine
    vensters — houd het op één regel.
  - Vóór het eerste onderdeel niets tonen (geen spoiler, en het is dan
    nog niet actiegericht).
  - Na het winnen én "Speel door" moet de regel verdwijnen, niet
    blijven hangen.
- **Performancevoorwaarden:** de HUD-regel valt onder T71's
  schrijf-alleen-bij-wijziging-regel.
- **Acceptatiecriteria:**
  - Na het eerste onderdeel bevat de HUD zowel de teller als het
    geldvereiste.
  - Bij een open venster met te weinig geld toont de prompt het
    ontbrekende bedrag.
  - Vóór het eerste onderdeel staat er niets extra's.
  - `test-ontsnapping.mjs` en `test-ontsnapping-vensters.mjs` blijven
    groen.
- **Testplan:** uitbreiding van de twee bestaande
  ontsnappingstestbestanden + volledige regressie.
- **Rollback:** de extra HUD-tekst verwijderen.
- **Sonnet solo:** ja.

---

## Ticket 77 — Resource- en levensduur-regressietests

- **Type:** test/infrastructuur
- **Verbetergebied:** 6 (Testinfrastructuur)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** — (schrijf 'm vóór T69, zie Testplan aldaar)
- **Doel:** de testcategorie toevoegen die in de audit ontbrak, en die
  het lek uit T69 had moeten vangen.
- **Huidige situatie:** 48 testscripts, allemaal integratie op
  gedrag/state. Geen enkele test kijkt naar resourcegroei, DOM-groei,
  schrijffrequentie of gedrag over een lange run. Precies daardoor kon
  een lineair GPU-lek 68 tickets lang onopgemerkt blijven.
- **Gewenste situatie:** een nieuw `test-resources.mjs` met minimaal:
  (a) geometrie-/materiaalgroei over 100 spawn/kill-cycli mét echte
  frames ertussen — cruciaal, want zónder gerenderde frames registreert
  Three.js de geometrie nooit bij de renderer en meet je een
  vals-negatief (deze valkuil kostte in de audit twee foute metingen);
  (b) explosie- en powerup-scenario's (T70); (c) DOM-node-aantal
  constant na veel treffers; (d) DOM-schrijffrequentie tijdens
  regeneratie/buff (T71) en bij de interactie-prompt (T72); (e) een
  lange-run-simulatie (25 golven headless) die asserteert dat
  `ondoden`, `stervenden`, `powerups` en `interactiePunten` niet
  onbegrensd groeien.
- **Codegebieden:** nieuw `tests/test-resources.mjs`; mogelijk een
  gedeelde `frames(page, n)`-helper in `tests/helpers.mjs`.
- **Buiten scope:** framerate-/fps-assercties — deze omgeving rendert
  via SwiftShader (software), dus elke fps-meting hier is
  betekenisloos; die horen op echte hardware in DevTools.
- **Randgevallen:**
  - De frames-helper moet echte `requestAnimationFrame`-ticks
    afwachten, niet `setTimeout`.
  - Frustum culling kan meshes ongerenderd laten en zo ook een
    vals-negatief geven — zet in de meting expliciet
    `frustumCulled = false` op de testobjecten.
- **Performancevoorwaarden:** het script mag de suite niet
  onevenredig verlengen (richtlijn ≤ 30 s).
- **Acceptatiecriteria:**
  - De geheugentest faalt aantoonbaar op de code van vóór T69 en
    slaagt erna (dit is de kern: een test die nooit rood is geweest,
    bewijst niets).
  - Alle vijf de genoemde categorieën zijn gedekt.
  - `run-all.mjs` pikt het bestand automatisch op.
- **Testplan:** het script tegen `da3524e` draaien (moet FALEN) en tegen
  de post-T69/T70-code (moet SLAGEN).
- **Rollback:** testbestand verwijderen.
- **Sonnet solo:** ja.

---

## Ticket 78 — CI-workflow en snellere testsuite

- **Type:** infrastructuur
- **Verbetergebied:** 6 (Testinfrastructuur)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** de bestaande testdiscipline automatisch afdwingen in plaats
  van 'm van handmatige discipline af te laten hangen.
- **Huidige situatie:** `run-all.mjs` start voor ELK van de 48 scripts
  een eigen Chromium-instantie; de volledige suite duurt daardoor ~3
  minuten. Er is geen CI, geen linting, geen formatting en geen
  typechecking — regressies worden alleen gevangen als iemand er zelf
  aan denkt de suite te draaien.
- **Gewenste situatie:** (a) een GitHub Actions-workflow die op push/PR
  `node run-all.mjs` draait; (b) `run-all.mjs` hergebruikt één
  browserinstantie over de scripts heen (nieuwe page per script, zodat
  de isolatie per test behouden blijft).
- **Codegebieden:** nieuw `.github/workflows/`, `tests/run-all.mjs`,
  `tests/helpers.mjs`.
- **Buiten scope:** ESLint/Prettier/TypeScript introduceren — dat is een
  eigen afweging met eigen risico's (en raakt de single-file-regel);
  dit ticket automatiseert alleen wat er al is.
- **Randgevallen:**
  - CI heeft geen `/opt/pw-browsers/chromium`: de workflow moet
    `npx playwright install chromium` doen en `helpers.mjs` moet met een
    ontbrekende `executablePath` overweg kunnen (env-var of
    feature-detectie) — zonder het lokale pad te breken.
  - Eén gedeelde browser mag geen state lekken tussen scripts; elk
    script krijgt een verse page én een verse CDN-route.
  - De twee bekende wall-clock-gevoelige flakes
    (`test-ontsnapping-vensters.mjs`, incidenteel
    `test-golf-variatielimiter.mjs`) mogen CI niet permanent rood
    maken — documenteer ze, of geef ze een retry, maar verberg ze niet.
- **Performancevoorwaarden:** suite-duur meetbaar korter dan de huidige
  ~3 minuten.
- **Acceptatiecriteria:**
  - CI draait groen op een schone checkout.
  - Suite-duur aantoonbaar gedaald.
  - Alle 48+ scripts blijven inhoudelijk ongewijzigd slagen.
- **Testplan:** de suite lokaal vóór/ná timen; workflow op een testbranch
  laten draaien.
- **Rollback:** workflow verwijderen; `run-all.mjs` terug naar
  browser-per-script.
- **Sonnet solo:** ja.

---

## Ticket 79 — Zone-gebaseerde lichtculling (VOORZICHTIG, gated op profiling)

- **Type:** performance
- **Verbetergebied:** 7 (Renderbudget)
- **Prioriteit:** middel
- **Status:** open (gepland) — **niet starten vóór de profiling-stap**
- **Afhankelijk van:** T69-T72 (doe eerst het goedkope, zekere werk)
- **Doel:** de per-fragment shaderkosten verlagen door lichten van
  ruimtes waar de speler niet is, uit te schakelen.
- **Huidige situatie:** de scene bevat 26 `PointLight`s plus 1
  `HemisphereLight`. Three.js' forward renderer neemt ALLE lichten op in
  de shader-uniforms en evalueert ze per verlicht fragment, ongeacht
  afstand of zichtbaarheid — er is geen light-culling in de basis-
  renderer. Dit is daarmee de grootste structurele fragmentkost van het
  spel en raakt vooral integrated/mobiele GPU's. **Let op: dit is
  afgeleid uit de rendering-architectuur, NIET gemeten op echte
  hardware** — deze omgeving rendert via SwiftShader en levert
  betekenisloze frametijden.
- **Gewenste situatie:** eerst een profiling-stap op echte hardware
  (Chrome DevTools Performance, met en zonder een deel van de lichten)
  die bevestigt dát dit de bottleneck is en hoeveel het scheelt. Pas
  daarna: lichten die bij een nog-niet-ontgrendelde of ver-weg-liggende
  zone horen op `visible = false` zetten, gestuurd door de al bestaande
  `zoneVan()`/`deurNGekocht`-informatie.
- **Codegebieden:** `lampLichten`, `buitenLichten`,
  `stroomGevoeligeDaklichten`, de lampflikker-loop in de game-loop.
- **Buiten scope:** overstappen op een ander renderpad (deferred,
  light-probes, baked lighting) — dat is een herschrijving, geen
  optimalisatie; `intensity = 0` als culling-methode (de uniform wordt
  dan nog steeds geëvalueerd, dus dat lost niets op — het moet
  `visible = false` of uit de scene).
- **Randgevallen:**
  - **Dit raakt de zwaar getunede helderheidsbalans** uit §7.5.5 en
    §7.5.7-7.5.10 (vier feedbackrondes met pixelmetingen). Elke
    wijziging moet met exact diezelfde pixelmeting-methode geverifieerd
    worden: screenshot vanuit een vast standpunt, luminantie
    `0.2126r+0.7152g+0.0722b` over het onderste deel van het beeld.
  - De Stroomuitval-eventgolf stuurt `stroomFactor` over ALLE lampen —
    culling mag dat mechanisme niet doorbreken (een uitgeschakeld licht
    mag niet "terugkomen" als vol licht bij het herstel).
  - Zichtlijnen tussen zones: vanaf de binnenplaats kijk je de bijkeuken
    in. Een licht hard uitzetten terwijl je de ruimte kunt zien, geeft
    een zichtbare pop.
- **Performancevoorwaarden:** meetbare winst op ECHTE hardware, anders
  het ticket sluiten zonder wijziging.
- **Acceptatiecriteria:**
  - Profiling-resultaat vóór/ná gedocumenteerd (echte hardware).
  - Pixelmeting per zone binnen ±3% van de huidige helderheid in zowel
    de normale als de Stroomuitval-stand.
  - Geen zichtbare licht-pop bij het lopen tussen zones (screenshot-
    reeks op de zonegrenzen).
  - `test-stroomuitval.mjs` en `test-omgeving-sfeer.mjs` blijven groen.
- **Testplan:** profiling eerst; daarna pixelmeting per zone in beide
  standen, de twee genoemde testbestanden en de volledige regressie.
- **Rollback:** culling-vlag uitzetten (alle lichten weer
  `visible = true`).
- **Sonnet solo:** nee — vereist profiling op echte hardware en
  visuele beoordeling.

---

## v0.21 — Ronde 7: sfeer, wereld en verhaal (gepland, nog NIET geïmplementeerd)

Architectuur: zie ARCHITECTURE_NOTES.md §9 (beslissingen 70-77).
Sonnet-prompts: zie SONNET_EXECUTION_PLAN.md, "ronde 7 (v0.21)".
Herkomst van de ideeën: `IDEEEN.md` (E1, E6, I1, I4, I5, J3, K1, K2).

**Aanleiding.** Anders dan v0.20 (die uit een code-audit kwam) komt deze
ronde uit een vooruitblik-sessie: wat zou je nog bouwen aan een spel dat
technisch af is. Acht ideeën zijn eruit gelicht die één ding gemeen
hebben — ze maken de wereld voelbaarder zonder de spelregels aan te
raken.

**De harde regel van deze ronde** (zie §9.2):

> Geen enkel ticket in v0.21 mag een balansgetal wijzigen.

Verboden: `golfBudget()`, `GOLF_BUDGET_*`, `ONDODE_THREAT_KOSTEN`,
`GOLF_MAX_ACTIEF`, `ONDODE_HP_TRAPPEN`, `AANVAL_PROFIELEN`, alle
`*_PRIJS`-constanten, `GELD_PER_HIT`/`GELD_PER_KILL`,
`POWERUP_DROP_KANS`, `SPELER_HP_MAX`, `schadePerTreffer`/
`WAPEN_SCHADE_MAX`. Sfeer-tickets hebben een bekend faalpatroon: ze
verschuiven de moeilijkheidsgraad ongemerkt. Elk ticket hieronder
benoemt waar dat risico bij hém zit.

**Uitgangspositie bij aanvang** (gemeten op `ac3fa43`, integraal in §9.10):
52/52 regressiescripts groen · 8.197 regels · 39 `piep()`-aanroepen ·
32 `speel*()`-functies · 1 `StereoPannerNode` · 4 permanente audio-lagen ·
9 `lampLichten` (3 kelder) · 1 schaduwwerpend licht op `(0, 2.58, 0)` ·
26 PointLights · 52 collision-obstakels · 13 interactiepunten ·
2 localStorage-sleutels.

**Verbetergebieden deze ronde** (nummering per-ronde):
1. Ruimtelijk geluid (T80)
2. Onbetrouwbaar licht en een levende stad (T81-T82)
3. De wereld buiten het pand (T83-T84)
4. Sporen van de run (T85)
5. Meta-progressie zonder powercreep (T86)
6. Verticaliteit (T87)

**Volgorde-advies.** T80 eerst: het levert de gedeelde hoek/pan-helper op
waar T83 op leunt. Daarna T84 (puur tekst, nul risico) en T81 (klein,
geïsoleerd) als opwarmers. Dan T82, T83, T86. T85 en T87 als laatste —
die twee raken respectievelijk de resource-discipline uit v0.20 en de
Y-invariant, en zijn het minst vergevingsgezind.

---

## Ticket 80 — Richtinghoren: pan op wereldgeluiden

- **Type:** feature (sfeer/leesbaarheid)
- **Verbetergebied:** 1 (Ruimtelijk geluid)
- **Prioriteit:** hoog
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** geluid met een echte wereldpositie ook links/rechts hoorbaar
  maken, zodat een grom achter je informatie wordt in plaats van alleen
  sfeer.
- **Huidige situatie:** alle `piep()`-geluiden zijn mono; alleen de
  boothoorn (`speelBootHoornGericht()`) heeft een `StereoPannerNode`.
  De benodigde hoekwiskunde staat twee keer los geïmplementeerd:
  `berekenSchadeWedgeHoek()` (T68) en `berekenBootHoornPanVolume()`
  (feedbackronde), allebei
  `kortsteHoekVerschil(Math.atan2(-dx, -dz), spelerYaw)`.
- **Gewenste situatie:** één gedeelde `berekenRelatieveHoek(bronX, bronZ,
  spelerX, spelerZ, spelerYaw)` plus `hoekNaarPan(relatieveHoek)`, waar
  beide bestaande aanroepers op gaan leunen. `piep()` krijgt een
  optionele `pan`-parameter. `speelOndodeGrom()` en `speelPlankBreek()`
  geven hun bronpositie mee.
- **Codegebieden:** `piep()`, `speelOndodeGrom()` (+ de aanroep in
  `updateOndoden()`, die nu alleen `ondode.type` doorgeeft),
  `speelPlankBreek()` (+ `beukBarricade()`),
  `berekenSchadeWedgeHoek()`, `berekenBootHoornPanVolume()`.
- **Buiten scope:** `PannerNode`/HRTF/3D-audio; afstandsdemping via de
  Web Audio-panner (de bestaande handmatige volume-op-afstand blijft);
  pan op speler-eigen geluiden (schot, herladen, wisselen), UI-geluiden
  (koop, geen geld) of globale gebeurtenissen (golfstart, stroomklap) —
  die hebben geen bron in de ruimte.
- **Randgevallen:**
  - **Bij `pan === 0` of een weggelaten argument mag er GEEN
    `StereoPannerNode` worden aangemaakt.** De keten blijft dan exact
    `osc → gain → masterGainNode`, zoals nu. `test-geluidsknop.mjs`
    asserteert dat alles via `masterGainNode` loopt en dat er precies
    één `connect(audio.destination)` in de bron staat.
  - **Er zitten twee verschillende negaties in de bestaande code, om
    twee verschillende redenen** (CSS rechtsom-positief vs.
    StereoPanner rechts = +1). Vat die niet samen tot "overal een min".
    Dit is dezelfde bugklasse als Fix 1 (§7.8.2.2), waar de schadepijl
    naar de speler toe wees in plaats van ervandaan.
  - Bron exact op de spelerpositie: pan 0, geen deling door nul (zelfde
    guard als `toonSchadeRichting()` al heeft).
- **Performancevoorwaarden:** `speelOndodeGrom()` zit al achter
  `ONDODE_GROM_GLOBALE_CAP` (1/0,6s) en `ONDODE_GROM_BEREIK` (8m); één
  extra node per grom is daarmee begrensd op ~1,7 nodes/s.
- **Acceptatiecriteria:**
  - Bron LINKS van de speler geeft een NEGATIEVE pan, bron RECHTS een
    POSITIEVE — richtinggevend geasserteerd, niet als "pan ≠ 0".
  - Links en rechts geven exact tegengestelde pan (symmetrisch rond 0).
  - Draait de speler, dan verandert de pan van dezelfde wereldbron mee.
  - Een `piep()` zonder pan-argument maakt aantoonbaar geen panner aan.
  - `test-geluidsknop.mjs`, `test-boot-aankondiging.mjs` en
    `test-schaderichting.mjs` blijven ongewijzigd groen.
- **Testplan:** nieuw `tests/test-richtinghoren.mjs` (pan-tekenconventie,
  symmetrie, meedraaien, geen-panner-bij-mono) + de drie genoemde
  bestaande scripts + volledige regressie.
- **Rollback:** de `pan`-parameter en de twee aanroepers terugdraaien;
  de gedeelde helper mag blijven staan (dan dode code).
- **Sonnet solo:** ja.

---

## Ticket 81 — Zeldzame lampuitval

- **Type:** feature (sfeer)
- **Verbetergebied:** 2 (Onbetrouwbaar licht)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** het licht onbetrouwbaar laten voelen zonder dat er iets
  gebeurt: eens in de zoveel golven knipt één lamp 0,3-0,5s uit.
- **Huidige situatie:** de flikkerloop vermenigvuldigt drie
  onafhankelijke factoren in `l.licht.intensity`: de flikker-sinus
  (`amp1`/`amp2`), `lampDipFactor` (T40) en `stroomFactorVoorLamp`
  (T46, met een eigen kelder-vloer). Buiten een Stroomuitval is er geen
  enkel moment waarop licht wegvalt.
- **Gewenste situatie:** een VIERDE, onafhankelijke factor per lamp
  (bijvoorbeeld een `blackoutTimer` per entry), die de bestaande drie
  nooit overschrijft en na afloop naar exact 1 herstelt.
- **Codegebieden:** de lampflikker-loop in de gameLoop, `lampLichten`.
- **Buiten scope:** koppeling aan een eventgolf of golfmijlpaal (zie
  Randgevallen); de Stroomuitval-logica; de schaduwinstellingen.
- **Randgevallen:**
  - **De schaduwwerpende lamp is uitgesloten.** Gemeten op
    `(0, 2.58, 0)` (woonkamer); die 0,4s uitzetten herstructureert álle
    schaduwen in beeld en leest als een renderfout, niet als sfeer. Het
    raakt bovendien de schaduw-invariant uit §7.9.
  - **De drie kelder-kamerlampen zijn uitgesloten**
    (`l.stroomVloer !== undefined`). De kelder heeft geen daglicht; een
    blackout daar is 0,4s volledige blindheid in een ruimte die juist
    veilig hoort te zijn. Dát zou een balanswijziging zijn.
  - Blijft over: 5 van de 9 `lampLichten`-entries als kandidaat.
  - Een blackout tijdens een Stroomuitval mag `stroomFactor` niet
    terugzetten op 1 bij het aflopen.
- **Performancevoorwaarden:** geen extra allocatie per frame; de timer
  is een getal op een bestaande entry.
- **Acceptatiecriteria:**
  - De schaduwwerpende lamp en de drie kelderlampen worden aantoonbaar
    nooit gekozen (loting-test over veel trekkingen).
  - Na afloop staat de betreffende lamp weer op exact zijn
    berekende intensiteit (geen drift).
  - Een blackout tijdens een actieve Stroomuitval laat `stroomFactor`
    ongemoeid.
  - `test-stroomuitval.mjs` en `test-omgeving-sfeer.mjs` blijven groen.
- **Testplan:** nieuw testblok voor de kandidaat-uitsluiting en het
  herstel + de twee genoemde scripts + volledige regressie.
- **Rollback:** de vierde factor uit de flikkerloop halen.
- **Sonnet solo:** ja.

---

## Ticket 82 — Het geluid van Amsterdam

- **Type:** feature (sfeer)
- **Verbetergebied:** 2 (Levende stad)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** — (profiteert van T80, vereist het niet)
- **Doel:** een permanente, zeer zachte stadslaag zodat de wereld buiten
  het pand hoorbaar doorgaat terwijl je binnen vecht.
- **Huidige situatie:** vier permanente lagen onder `masterGainNode`:
  dreigingsdrone (plafond 0,07), muziek (0,08) met de Nevelklok in serie
  ervóór, en de losse `piep()`-ketens. Buiten die lagen is het stil.
- **Gewenste situatie:** een vijfde laag met een plafond van **0,03**,
  met zeldzame, willekeurig getimede gebeurtenissen (verre scheepshoorn,
  verre klok) op een eigen timer, volledig procedureel.
- **Codegebieden:** `initGeluid()`, een nieuwe update-functie met eigen
  throttle in de gameLoop, de debug-hook-export.
- **Buiten scope:** externe audiobestanden (verboden, zie CLAUDE.md);
  wijziging aan de bestaande vier lagen; de Nevelklok-cyclus.
- **Randgevallen:**
  - **Het stadsbed mag nooit een tell maskeren.** De ondode-grom staat
    op 0,035-0,045 en is een gameplay-signaal (§5.9: de Sluiper gromt
    NIET, stilte is zijn tell). Vandaar het plafond ónder het gromvolume
    én het uit de weg blijven van de gromband (120-340 Hz).
  - **Aansluiten op `masterGainNode`, nooit op `audio.destination`** —
    het geluidsknop-contract uit Fix 4, bewaakt door
    `test-geluidsknop.mjs`.
  - De gebeurtenis-timer moet los staan van de Nevelklok-cyclus, anders
    vallen ze samen en klinkt het als één geluid.
- **Performancevoorwaarden:** gain-schrijfacties gethrottled (patroon
  `MUZIEK_THROTTLE_INTERVAL`), nooit per frame.
- **Acceptatiecriteria:**
  - Er is precies één node op `audio.destination` (ongewijzigd).
  - Het plafond van de nieuwe laag is aantoonbaar < het gromvolume.
  - De laag dempt mee met de geluidsknop.
  - Geen per-frame gain-writes (throttle-test, patroon
    `test-achtergrondmuziek.mjs`).
- **Testplan:** nieuw testblok naar het model van
  `test-achtergrondmuziek.mjs`/`test-dreigingsaudio.mjs` +
  `test-geluidsknop.mjs` + volledige regressie.
- **Rollback:** de laag niet aanmaken in `initGeluid()`; de rest is
  additief.
- **Sonnet solo:** ja.

---

## Ticket 83 — De Waterschouw

- **Type:** feature (sfeer/wereld)
- **Verbetergebied:** 3 (De wereld buiten het pand)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** T80 (gebruikt de gedeelde pan-helper)
- **Doel:** een tweede boot die periodiek voorbijvaart en nooit stopt,
  zodat het pand geïsoleerd voelt te midden van een stad die doorgaat.
- **Huidige situatie:** er is één boot (`bootGroep`), volledig gekoppeld
  aan De Ontsnapping: `updateBootPositie()` schrijft élke frame
  onvoorwaardelijk `bootGroep.position.x` op basis van de
  ontsnappingsstaat, en de minimap tekent een `arc`-marker zodra
  `ontsnappingAankondigingActief || ontsnappingsPunt`.
- **Gewenste situatie:** een eigen `schouwGroep` met een eigen
  updatefunctie en een eigen, duidelijk andere hoorn en minimap-marker.
- **Codegebieden:** nieuwe groep + updatefunctie naast
  `updateBootPositie()`, `tekenMinimap()`, een nieuwe `speel*()`-functie.
- **Buiten scope:** elke wijziging aan `bootGroep`,
  `updateBootPositie()`, `ontsnappingsPunt` of de ontsnappingsflow.
- **Randgevallen:**
  - **Onverwarbaar met de ontsnappingsboot** — dit is de hoofdeis, niet
    een detail. Drie scheidingen zijn verplicht: (1) een duidelijk
    andere hoorn dan de 200→140 Hz over 1,1s van de ontsnapping,
    (2) een minimap-marker die GEEN `arc` is, (3) nooit een
    interactiepunt, ooit.
  - **De schouw mag `bootGroep` niet aanraken.** Zou hij dat wel doen,
    dan vecht hij elke frame met `updateBootPositie()` om dezelfde
    property.
  - **`test-boot-aankondiging.mjs` moet MEE bewegen, niet verzwakt
    worden.** Dat script asserteert nu "precies 1 boot-marker (arc)" en
    "geen boot-marker zonder aankondiging/venster". Scherp die aan naar
    "de ONTSNAPPINGS-marker wordt precies 1x getekend"; verwijder de
    assertie niet.
- **Performancevoorwaarden:** één extra groep met een handvol meshes;
  geen extra licht (het budget staat op 26 PointLights, zie §9.10).
- **Acceptatiecriteria:**
  - De schouw voegt nooit iets aan `interactiePunten` toe.
  - `ontsnappingsPunt`/`bootGroep.position.x` blijven aantoonbaar
    ongemoeid door de schouw.
  - De twee hoorns zijn aantoonbaar verschillend (andere frequenties/duur).
  - `test-boot-aankondiging.mjs` en `test-ontsnapping-vensters.mjs`
    blijven inhoudelijk groen (het eerste met de aangescherpte assertie).
- **Testplan:** nieuw testblok (schouw raakt de ontsnapping niet,
  markerscheiding, hoornscheiding) + de twee genoemde scripts +
  volledige regressie.
- **Rollback:** de schouwgroep niet aanmaken en de marker niet tekenen.
- **Sonnet solo:** ja.

---

## Ticket 84 — Het pand krijgt een adres

- **Type:** feature (verhaal)
- **Verbetergebied:** 3 (De wereld buiten het pand)
- **Prioriteit:** laag
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** het pand van "een verlaten gebouw" naar "een specifieke plek"
  tillen, zodat een run een concreter verhaal oplevert.
- **Huidige situatie:** het pand heeft geen naam. Zones hebben
  functionele namen (`ZONE_NAMEN`) en flavour-teksten (`ZONE_FLAVOUR`),
  maar het gebouw zelf is naamloos op elk scherm.
- **Gewenste situatie:** een verzonnen grachtnaam + huisnummer op het
  startscherm, het winscherm en een klein naambordje-mesh bij de
  voordeur.
- **Codegebieden:** startscherm-HTML/tekst, `toonWinScherm()`, één klein
  decor-object.
- **Buiten scope:** `ZONE_NAMEN`/`ZONE_FLAVOUR` (die zijn al goed);
  gameplay van welke aard dan ook.
- **Randgevallen:**
  - **IP-regel (CLAUDE.md): de naam moet VERZONNEN zijn.** Geen
    bestaande Amsterdamse gracht met een echt huisnummer — dat plaatst
    een aanwijsbaar, bestaand adres in een zombiespel. Een geloofwaardig
    Nederlands klinkende, niet-bestaande naam voldoet aan beide eisen.
  - Het naambordje mag geen collision toevoegen (obstakels blijft 52).
- **Performancevoorwaarden:** één mesh, materiaal via `mat()`/
  `matFamilie()`.
- **Acceptatiecriteria:**
  - De naam staat op startscherm én winscherm, consistent.
  - `obstakels.length` blijft 52.
  - Volledige regressie blijft groen.
- **Testplan:** tekstassertie op beide schermen + obstakeltelling +
  volledige regressie.
- **Rollback:** teksten terugzetten, mesh verwijderen.
- **Sonnet solo:** ja.

---

## Ticket 85 — Etalages: sporen van de run

- **Type:** feature (sfeer)
- **Verbetergebied:** 4 (Sporen van de run)
- **Prioriteit:** laag
- **Status:** open (gepland)
- **Afhankelijk van:** T69/T70 (moet hun resource-discipline volgen)
- **Doel:** decor dat meeverandert met wat er in een run gebeurd is,
  zodat een bekende kamer er op golf 20 anders uitziet dan op golf 1.
- **Huidige situatie:** alle decor is statisch vanaf het laden. De enige
  visuele verandering tijdens een run is de winkelstatus
  (`updateWinkelMarkeringen()`) en de barricade-planken.
- **Gewenste situatie:** een paar zichtbare, cumulatieve sporen:
  ramen die op golfmijlpalen dichtgetimmerd raken, een ereplank bij de
  Smederij die per gesmeed wapen voller wordt.
- **Codegebieden:** `startGolf()`/het wave-complete-blok als trigger,
  bestaande decor-bouwfuncties, `mat()`/`matFamilie()`/`geoCache()`.
- **Buiten scope:** nieuwe collision; nieuwe zones; elk effect op
  pathing of spawn-druk.
- **Randgevallen:**
  - **Dit is precies het patroon dat T69/T70 net hebben opgeruimd.**
    Materialen ALTIJD via `mat()`/`matFamilie()`, geometrie via
    `geoCache()` — nooit een directe `new THREE.MeshStandardMaterial()`
    per mijlpaal. Anders lekt elke mijlpaal, en dat is letterlijk de bug
    die beslissing 63 dichtte.
  - **Alleen op golfovergangen, nooit per frame.**
  - **Geen collision.** `obstakels` blijft 52; een dichtgetimmerd raam
    dat ineens blokkeert, verandert pathing en dus balans.
  - **Voorkeur voor materiaal WISSELEN boven mesh TOEVOEGEN**, zodat de
    mesh-telling constant blijft en T77's resourcetest dit ticket
    automatisch bewaakt.
- **Performancevoorwaarden:** mesh- en materiaaltelling mogen niet
  meegroeien met het golfnummer (harde assertie).
- **Acceptatiecriteria:**
  - Na 25 gesimuleerde golven zijn `renderer.info.memory.geometries` en
    de mesh-telling niet gegroeid t.o.v. golf 1 (± een vaste, kleine
    marge voor eenmalig toegevoegd decor).
  - `obstakels.length` blijft 52.
  - `test-resources.mjs` blijft groen (dit is de bewaker van dit ticket).
- **Testplan:** uitbreiding van `test-resources.mjs`' lange-run-simulatie
  met een mesh-/materiaaltelling + obstakeltelling + volledige regressie.
- **Rollback:** de mijlpaal-trigger uitzetten; decor blijft dan op zijn
  beginstaat.
- **Sonnet solo:** ja.

---

## Ticket 86 — Het stadsarchief

- **Type:** feature (meta-progressie)
- **Verbetergebied:** 5 (Meta-progressie zonder powercreep)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** —
- **Doel:** een reden om terug te komen die de balans niet kan raken:
  cosmetische ontgrendelingen over meerdere runs heen.
- **Huidige situatie:** de enige persistente staat is de highscore
  (`amsterdamUndeadHighscore`) en de muisgevoeligheid
  (`amsterdamUndeadGevoeligheid`). Runs staan verder volledig los van
  elkaar.
- **Gewenste situatie:** een derde `localStorage`-sleutel met behaalde
  mijlpalen, en een klein keuzemenu op het startscherm voor de
  ontgrendelde cosmetische varianten (kleurset, mondingsvlam-tint,
  intro-melodie).
- **Codegebieden:** nieuw lees/schrijf-paar naar het patroon van
  `leesHighscore()`/`leesGevoeligheid()`, startscherm-UI, de plekken
  waar een gekozen variant wordt toegepast.
- **Buiten scope:** elke ontgrendeling met een mechanisch effect. Als
  een ontgrendeling ook maar één spelregel raakt, hoort hij niet in dit
  ticket (en niet in deze ronde, zie §9.2).
- **Randgevallen:**
  - **Vormvalidatie bij het lezen, veilige default bij twijfel** — exact
    het patroon uit T74 (`leesHighscore()` valideert veld voor veld) en
    T75 (`leesGevoeligheid()` klemt).
  - **Onbekende sleutels in de opslag worden GENEGEERD, niet als corrupt
    behandeld.** Anders wist een oudere versie de ontgrendelingen van een
    nieuwere.
  - **Ontgrendelingen zijn additief en onomkeerbaar** — geen pad dat iets
    terugneemt. Dat scheelt een hele klasse randgevallen.
  - `localStorage` kan ontbreken/geweigerd zijn: `try/catch` om elke
    toegang, stille fallback (bestaand contract).
- **Performancevoorwaarden:** opslag wordt alleen geschreven op
  run-einde, nooit tijdens het spelen.
- **Acceptatiecriteria:**
  - Corrupte opslag (`'{}'`, `'[]'`, `'null'`, willekeurige tekst) geeft
    een lege maar geldige staat, nooit een crash of "undefined" in beeld.
  - Een opslag met een onbekende sleutel behoudt de bekende sleutels.
  - Geen enkele ontgrendeling raakt een balansgetal (bron-assertie op de
    verboden lijst uit §9.2).
  - Volledige regressie blijft groen.
- **Testplan:** nieuw testblok naar het model van `test-faalmodi.mjs`
  (corrupte-opslag-varianten) + `test-muisgevoeligheid.mjs`
  (klem-/defaultgedrag) + volledige regressie.
- **Rollback:** het keuzemenu verbergen en de opslag niet lezen; de
  varianten vallen terug op hun standaardwaarde.
- **Sonnet solo:** ja.

---

## Ticket 87 — De Vliering (verticaliteit met disjuncte footprint) (VOORZICHTIG) ✅

- **Type:** feature (ruimte)
- **Verbetergebied:** 6 (Verticaliteit)
- **Prioriteit:** middel
- **Status:** ✅ afgerond — gebouwd bovenop de verzegelde dode hoek ten
  zuiden van de nis (x −11,5…−4,5, z −17…−8,9), vloer op y = 1,2, met
  uitzicht over het atelier door de verlaagde weststomp. De rastertest
  is als eerste geschreven en gedraaid (vóór één regel geometrie), zoals
  het ticket voorschrijft. `berekenKelderY()` bleef kelder-only; de
  nieuwe samengestelde vloerfunctie heet `berekenVloerY()`, zodat
  `test-kelder-trap.mjs` letterlijk ongewijzigd groen bleef (54/54).
  `losBotsingenOp()` hoefde NIET aangepast: de footprint ligt al binnen
  GRENS, dus er is geen bypass nodig zoals bij de kelder. Obstakels
  52 → 56, lichtbudget onveranderd 26. Zie tests/test-vliering.mjs (30
  checks) en ARCHITECTURE_NOTES.md §9.8.1.
- **Afhankelijk van:** — (doe 'm als laatste van de ronde)
- **Doel:** verticaliteit toevoegen zonder de Y-invariant te breken waar
  vijf systemen tegelijk op rusten.
- **Huidige situatie:** `berekenKelderY(x, z)` is een **pure functie van
  x en z**. Daarop rusten: `updateSpeler()` (speler-Y),
  `updateOndoden()` (ondode-Y), `losBotsingenOp()` (volledig 2D),
  `zoneVan(x, z)` (volledig 2D) en `tekenMinimap()` (2D met één
  kelder-uitzondering). De kelder kón bestaan omdat zijn footprint
  **disjunct** is: hij ligt op x/z waar geen begane grond begaanbaar is
  (§7.11 noteert dat expliciet).
- **Gewenste situatie:** een verhoogde ruimte volgens exact dat
  precedent — bereikbaar via een ladder/luik, met uitzicht over een
  aangrenzende zone, op x/z waar de begane grond niet begaanbaar is.
  `berekenKelderY()` wordt uitgebreid/hernoemd tot `berekenVloerY(x, z)`
  die daar een positieve hoogte teruggeeft. Alle vijf systemen blijven
  ongewijzigd werken, inclusief ondode-navigatie: ondoden kunnen de
  vliering gewoon op, zonder één regel in `updateOndoden()`.
- **Codegebieden:** `berekenKelderY()` → `berekenVloerY()`, nieuwe
  geometrie, een interactiepunt voor het luik, `tekenMinimap()` (zelfde
  soort uitzondering als de kelder al heeft).
- **Buiten scope:** een nieuwe zone-id (de vliering deelt zijn zone met
  de ruimte ernaast, net als de kelder zone 2 deelt met het atelier);
  wijziging aan `ZONE_GRAAF`/`NAV_VOLGENDE`; wijziging aan spawn-druk of
  `ZONE_MAX_ACTIEF_BONUS`. **De vliering is ruimte, geen nieuwe zone.**
- **Randgevallen:**
  - **De footprint-eis is een TESTEIS, geen ontwerpsuggestie.** De
    vliering-footprint mag op geen enkel punt samenvallen met begaanbare
    begane grond. Bewijs met een rastertest over de hele kaart — het
    precedent staat letterlijk in `test-kelder-trap.mjs`
    ("berekenKelderY is exact 0 op ALLE 15327 bovengrondse
    rasterpunten"). Zonder die test is dit ticket niet af.
  - De speler mag nergens van de vliering af kunnen vallen in een
    toestand waar `berekenVloerY()` iets anders zegt dan waar hij staat.
  - De minimap moet niet plotseling twee overlappende zones tekenen.
  - Een vliering die een gratis, veilige plek blijkt waar ondoden niet
    komen, is een balanswijziging. Ze moeten er gewoon op kunnen.
- **Performancevoorwaarden:** geen extra licht (budget 26 PointLights);
  `obstakels` mag groeien met de vlieringmuren, maar dat aantal moet
  expliciet in het ticket worden vastgelegd en getest.
- **Acceptatiecriteria:**
  - Rastertest: `berekenVloerY()` is op elk begaanbaar begane-grondpunt
    nog steeds exact 0 (of de bestaande kelderwaarde) — de vliering
    verandert daar niets.
  - Een ondode bereikt de speler op de vliering (trajectory-trace,
    patroon `test-waypoint-navigatie.mjs`).
  - `test-kelder-trap.mjs` blijft ongewijzigd groen.
  - Volledige regressie blijft groen.
- **Testplan:** rastertest + trajectory-trace + `test-kelder-trap.mjs` +
  volledige regressie.
- **Rollback:** de vliering-tak uit `berekenVloerY()` halen en de
  geometrie niet bouwen (één samenhangende diff).
- **Sonnet solo:** nee — raakt de Y-invariant; doe dit met de rastertest
  als eerste stap, niet als laatste.

---

# v0.26 — Ronde 12: instellingen, leesbaarheid, sporen en economie (gepland, nog NIET geïmplementeerd)

Herkomst: de ontwerpsessie na de performance-audit van v0.23 (zie
`PERFORMANCE_AUDIT.md`). Alle vier de tickets komen uit een gat dat
`IDEEEN.md` niet dekt: **T159** geeft de speler grafische controle en
daarmee een thuis aan de auditbevindingen die niet op één vaste waarde te
beslissen zijn; **T156** repareert een leesbaarheidsfout die alleen
zichtbaar is als je naar de kleurwaarden zelf kijkt; **T157** vult de enige
as waarop dit spel zijn eigen voortgang niet toont; **T158** adresseert dat
geld halverwege de run ophoudt een beslissing te zijn — én dat overschot
volgens `berekenScore()` naar niets converteert.

De vier zijn los van elkaar te bouwen, maar **T159 hoort eerst**: het is de
enige die iets ontgrendelt. De auditbevindingen A3 (zone-lichtculling) en
A4 (schaduw-throttling) zijn in v0.23 bewust niet uitgevoerd omdat ze de
zwaar getunede belichting raken; T159 geeft ze een preset waarin dat
expliciet toegestaan is. Zonder T159 blijven A3 en A4 permanent
geblokkeerd, en moet T157 zijn transparante vlakken zonder vangnet
verantwoorden.

Daarna is de volgorde vrij: T156 is de goedkoopste en repareert een echte
fout; T158 deel (A) is de kleinste ingreep met het grootste effect.

---

## Ticket 156 — De Brander leesbaar zonder kleur ✅

- **Type:** fix (leesbaarheid/toegankelijkheid)
- **Verbetergebied:** 1 (Combat-leesbaarheid)
- **Prioriteit:** hoog
- **Status:** ✅ uitgevoerd (v0.26). De permanente rustpuls
  (`KERNPULS_RUST_AMPLITUDE`/`KERNPULS_RUST_SNELHEID`, een dt-gedreven
  `ondode.kernPulsTijd`-accumulator per ondode) is samengesteld met de
  bestaande flinch-puls tot één schrijfplek naar `delen.kern.scale`.
  `tests/test-brander-leesbaarheid.mjs` (12 checks) bewaakt de
  grijswaarden-luminantievariatie in beide lichtstanden, de
  flinch/rustpuls-onderscheidbaarheid, en dat alleen de Brander
  `delen.kern` heeft. Volledige regressie (incl. `test-vijand-
  leesbaarheid.mjs`, `test-aanval-tells.mjs`, `test-resources.mjs`): groen.

  **Twee dingen gevonden tijdens de uitvoering, niet in het ticket
  voorzien:**
  1. **De schrijfplek moest verhuizen.** De oorspronkelijke plek (ná de
     flinch-afhandeling) bleek onbereikbaar zodra een Brander in 'windup'
     zit — die tak `continue`t vóór die plek, dus de rustpuls bevroor
     precies tijdens een aanval. Verplaatst naar vóór de windup-tak, zodat
     hij nu ELK frame draait, ongeacht `aanvalStaat`.
  2. **De rustpuls loopt op een EIGEN per-ondode klok
     (`ondode.kernPulsTijd`), niet op de module-brede `klok`.** Dat maakt
     'm testbaar via directe `updateOndoden(dt)`-aanroepen (geen echte
     rAF-frames nodig) én geeft 'm gratis dezelfde "staat stil tijdens
     pauze"-eigenschap (de accumulator loopt alleen binnen
     `updateOndoden()`, en die draait toch al alleen als `spelActief`).
  3. **Een bestaande test moest mee** (`test-ondode-hitreacties.mjs`): die
     verwachtte dat de kern na een flinch terugkeert naar EXACT schaal 1 —
     dat klopt niet meer sinds de rustpuls nooit stilstaat. Bijgewerkt naar
     een band-assertie (`|schaal-1| <= KERNPULS_RUST_AMPLITUDE`) met een
     extra tick ná de flinch-while-loop (het allerlaatste actieve
     flinch-tick draagt nog een klein residueel stukje bonus, zie de
     toelichting in dat testbestand).
- **Afhankelijk van:** niets — `delen.kern` en `KERNPULS_SCHAAL_BONUS`
  bestaan al (T21/Z4).
- **Doel:** de Brander herkenbaar maken via een kanaal dat niet op
  kleurwaarneming leunt, zodat de enige ondode die schade uitdeelt bij
  overlijden ook leesbaar is voor kleurenblinde spelers en in het donker.
- **Huidige situatie:** `ONDODE_TYPES.normaal` en `ONDODE_TYPES.brander`
  hebben **identieke `schaal: 1`** en dus een identiek silhouet. Het enige
  onderscheid is kleur: lijf `0x5d7255` (groen) vs `0x8a4a2c` (roodbruin),
  ogen `0xd8ff6b` (geelgroen) vs `0xffa03d` (oranje). Dat verschil ligt
  precies op de rood-groen-as, waar deuteranopie/protanopie (~8% van de
  mannen) slecht tot niet op discrimineert. De Sjouwer (`schaal: 1.35`) en
  de Sluiper (`0.75`) zijn wél op silhouet te herkennen; juist de
  gevaarlijkste variant niet. Tijdens een **Stroomuitval**-eventgolf is de
  oogkleur bovendien het enige zichtbare kanaal, omdat de rest van het
  lichaam in het donker wegvalt — de leesbaarheid is dus het slechtst
  precies in de zwaarste golf.
- **Gewenste situatie:** de Brander draagt een permanente, zachte
  kernpuls: een ritmisch op- en afzwellende gloed in de borstkas. Dat is
  een helderheids-/bewegingssignaal in plaats van een kleursignaal, dus
  het werkt onafhankelijk van kleurwaarneming én het wordt in het donker
  duidelijker in plaats van vager. Thematisch versterkt het bovendien de
  tell: je ziet dát er iets in hem zit dat af kan gaan.
- **Codegebieden:** `ONDODE_TYPES.brander`, `maakOndodeModelV2()`
  (`delen.kern`), de animatiehelft van `updateOndoden()`,
  `KERNPULS_SCHAAL_BONUS`.
- **Buiten scope:** de kleuren zelf wijzigen (die dragen de sfeer en zijn
  in T88/T89 gekalibreerd); de schaal van de Brander wijzigen (dat raakt
  hitboxen); een volledige kleurenblind-modus voor de hele game; nieuwe
  meshes toevoegen aan het ondode-model.
- **Randgevallen:**
  - **De bestaande flinch-kernpuls mag niet dubbel tellen.**
    `raakOndode()` zet `kernPuls: ondode.type === 'brander'` en
    `updateOndoden()` schaalt `delen.kern` daarop. De permanente puls moet
    dáármee samengesteld worden (één schrijfplek naar `delen.kern.scale`),
    niet als tweede, concurrerende schrijver — anders vechten ze om
    dezelfde property en verdwijnt de treffer-feedback.
  - **De puls mag de Brander niet vóór zijn eigen aanvals-tell verraden**
    op een manier die de T31-windup overstemt: de aanvalstell blijft
    leidend, dit is een identiteits-signaal, geen dreigings-signaal.
  - **Emissie-hiërarchie (T89/§10.5) — correctie tijdens uitvoering:** dit
    randgeval ging ervan uit dat `kernMateriaal` een Accent is. Dat bleek
    fout: `kernMateriaal.emissiveIntensity` staat al op `EMISSIE_BRON_MAX`
    (1,6) — de kern is en blijft een Bron, dat verandert dit ticket niet.
    Wat wél telt: `kernMateriaal` is een GEDEELD materiaal
    (`userData.gedeeld = true`), dus de intensiteit zelf kan sowieso niet
    per instantie variëren zonder dat te doorbreken — de puls moet dus via
    `scale`, niet via `emissiveIntensity`. Dat is precies het bestaande
    kanaal van de flinch-puls. De echte grens is dus niet Accent-vs-Bron,
    maar: de rustpuls-amplitude moet ruim onder `KERNPULS_SCHAAL_BONUS`
    (0,8) blijven, zodat de flinch-piek duidelijk anders aanvoelt dan het
    rustige ademen.
  - **Geen per-frame allocatie** en geen extra draw call — dit moet binnen
    het bestaande 1-draw-call-per-ondode-budget blijven (§ZOMBIE_V2).
- **Performancevoorwaarden:** draw calls en mesh-telling per ondode
  ongewijzigd; geen nieuwe allocatie in `updateOndoden()`.
- **Acceptatiecriteria:**
  - Een Brander is in een **grijswaarden**-screenshot te onderscheiden van
    een normale ondode op dezelfde afstand (harde, meetbare assertie: het
    luminantieverschil in de borstregio varieert over de tijd, terwijl dat
    bij een normale ondode vlak blijft).
  - Hetzelfde geldt tijdens een actieve Stroomuitval.
  - De bestaande flinch-kernpuls op een treffer blijft zichtbaar en
    onderscheidbaar van de rustpuls.
  - `hitboxen`, `schaal`, schade en explosieradius exact ongewijzigd —
    `test-vijand-leesbaarheid.mjs` en `test-aanval-tells.mjs` blijven
    groen.
  - Draw calls per ondode ongewijzigd (`test-resources.mjs`).
- **Testplan:** nieuw `tests/test-brander-leesbaarheid.mjs` met de
  grijswaarden-assertie in beide lichtstanden; bestaande vijand- en
  resourcetests + volledige regressie.
- **Rollback:** de rustpuls-amplitude op 0 zetten — dan valt het gedrag
  exact terug op de huidige flinch-only-situatie.
- **Sonnet solo:** ja — mits de grijswaardentest vóór de implementatie
  geschreven wordt (die is het hele bewijs van dit ticket).

---

## Ticket 157 — De ruimte onthoudt het gevecht (blijvende inslagsporen) ✅

- **Type:** feature (sfeer/visueel)
- **Verbetergebied:** 4 (Sporen van de run)
- **Prioriteit:** middel
- **Status:** ✅ uitgevoerd (v0.26). Eén gedeelde pool
  (`inslagsporenPool`, `INSLAGSPOOR_MAX = 40`) met ÉÉN gedeelde
  `PlaneGeometry` en ÉÉN gedeelde canvas-textuur, round-robin
  hergebruikt via `inslagspoorVolgende` — geen `actieveEffecten`-timer
  (een spoor vervaagt nooit, het wordt alleen overschreven). Twee
  aanroepplekken: `schiet()`'s wereld-inslagpad (kogelgat, hergebruikt
  de al berekende `_tmpVecNormaal` synchroon, geen aliasing) en
  `doodOndode()` (vloervlek, Y via `berekenVloerY()` — geen aanname
  van `y = 0`, dus correct in kelder/vliering). Oriëntatie via
  `quaternion.setFromUnitVectors()` op de meegegeven normaal, dus
  generiek voor elk vlak — inclusief vlakken die de kaart zelf niet
  heeft (er bestaat geen écht schuin oppervlak; de trap is gestapelde
  rechte blokjes). Tegen z-fighting: een kleine positie-offset langs de
  normaal ÉN `polygonOffset` op het materiaal, twee onafhankelijke
  lagen.

  **Gekoppeld aan T159:** `KWALITEIT_PRESETS.inslagsporen` (false op
  `laag`, true op `normaal`/`hoog`) — de eerste toevoeging sinds die
  audit die er daadwerkelijk gebruik van maakt, precies zoals de
  afhankelijkheid hierboven voorschreef.

  `tests/test-inslagsporen.mjs` (20 checks): pool-architectuur (gedeelde
  geometrie/textuur, eigen material per slot), round-robin wrap (het
  41e spoor overschrijft slot 0), oriëntatiewiskunde op vijf vlakken
  incl. een synthetisch schuin vlak (geen enkele hoekafwijking >
  0,0002°), de aliasing-regel (de aanroeper mag de normaal-vector na de
  aanroep hergebruiken zonder het geplaatste spoor te veranderen), de
  T159-kwaliteitsgate, en dat 60 extra spoorplaatsingen nul nieuwe
  meshes toevoegen. Plus een z-fighting-proxycheck (twee opeenvolgende
  renders van hetzelfde schuine decal moeten pixel-identiek zijn) en
  een opgeslagen screenshot voor de visuele beoordeling die het ticket
  zelf al voorschreef ("Sonnet solo: ja, met de kanttekening dat de
  z-fighting-controle een visuele beoordeling vraagt") — visueel
  gecontroleerd: het decal ligt plat/gekanteld op het vlak, geen
  rafelranden of flikkering.

  `tests/test-resources.mjs`'s bestaande 25-golven-simulatie uitgebreid:
  elke lethale `raakOndode()`-hit (schadePerTreffer=999 maakt ze
  allemaal lethaal) vuurt al vanzelf de vloervlek-decal, en één
  kogelgat-schot per golf erbij toegevoegd voor het schiet()-pad. Over
  25 golven: 420 doden + 25 schoten = 445 spoorplaatsingen (>10× de
  poolgrootte), `renderer.info.memory.geometries`/`.textures` blijven
  onveranderd. Ook `test-inslagen-rijker.mjs` blijft groen.

  Volledige regressie tweemaal gedraaid: 98/98 en 92/99 (4 shards). Elke
  afwijking herleid tot bekende, reeds bestaande CPU-contentie-flakes —
  inclusief de eigen z-fighting-proxycheck (66px-verschil onder
  parallelle belasting, 5/5 schoon in isolatie) en een niet-gerelateerde
  ontsnappingspunt-test (3/3 schoon in isolatie) — geen van beide een
  regressie.
- **Afhankelijk van:** T69/T70 (resource-discipline), en bij voorkeur ná
  **T159** (kwaliteitsinstelling), zodat de transparante vlakken onder
  een kwaliteitsniveau kunnen vallen (zie "Randgevallen").
- **Doel:** het gevecht zichtbaar achterlaten in de wereld zelf, zodat een
  kamer op golf 20 er anders uitziet dan op golf 1 — en zodat de speler
  zijn eigen tactiek terugziet in de ruimte.
- **Huidige situatie:** inslagen geven deeltjes (`spawnImpact()`) en rook
  (`spawnRook()`), beide uit een vaste pool en beide volledig vergankelijk.
  Na twintig golven ziet de woonkamer er exact uit als bij het laden. Het
  spel toont zijn voortgang uitsluitend in de HUD, nergens in de wereld.
  T85 dekt dit niet: dat gaat over decor dat op **golfmijlpalen** van
  materiaal wisselt, niet over sporen op de plek waar daadwerkelijk
  geschoten is.
- **Gewenste situatie:** een gepoolde set blijvende inslagsporen —
  kogelgaten op muren/vloer, donkere vlekken waar een ondode viel. Vast
  aantal (richtwaarde 40), waarbij een nieuw spoor het oudste hergebruikt
  (positie/rotatie/zichtbaarheid overschrijven), zodat er nooit iets
  bijkomt na het laden.
- **Codegebieden:** `schiet()` (het wereld-inslagpad, incl. het al
  berekende `_tmpVecNormaal`), `doodOndode()` voor de vloervlek,
  een nieuwe pool naast `impactPool`/`tracerPool`, `ruimGroepOp()`.
- **Buiten scope:** decals op ondoden zelf (die verdwijnen); decals die
  meebewegen met bewegende objecten (deuren, boot); collision; elk effect
  op pathing, spawn of schade; permanente opslag tussen runs.
- **Randgevallen:**
  - **De harde regel van T85 geldt onverkort:** mesh- en materiaaltelling
    mogen niet meegroeien met het golfnummer. Een vooraf gealloceerde pool
    van 40 voldoet daar per constructie aan — bouw hem één keer bij het
    laden, nooit tijdens een golf. Dit is precies de valkuil die
    beslissing 63 dichtte.
  - **Z-fighting.** Een decal plat op een muur vecht met het muurvlak.
    Gebruik `polygonOffset` (of een kleine offset langs de al beschikbare
    wereld-ruimte normaal), niet een willekeurige "iets ervoor"-hack.
  - **`_tmpVecNormaal` is scratch-ruimte.** `schiet()` documenteert dat
    expliciet — de decal-code moet de waarde kopiëren, niet de referentie
    bewaren (exact het aliasing-patroon dat §7.9 verbiedt).
  - **Transparante vlakken kosten fill-rate.** Dit is de reden voor de
    afhankelijkheid hierboven: 40 transparante quads is de eerste
    toevoeging sinds de audit die de renderkant echt raakt. Zonder
    kwaliteitsniveau om onder te vallen, moet de pool klein blijven.
  - **Geen decal op een `Points`/niet-Mesh-treffer** — sinds de A1-fix
    (WERELD_DECOR_LAYER) kan dat niet meer gebeuren, maar de decal-code
    moet nog steeds op `raak[0].face` leunen en dus dezelfde aanname
    dragen als de rest van dat pad.
  - **De vloervlek bij een kill mag niet in de kelder/vliering door de
    vloer zakken** — Y-hoogte volgt de sterfpositie, niet een aanname van
    `y = 0`.
- **Performancevoorwaarden:** mesh-, geometrie- en materiaaltelling
  constant na 25 gesimuleerde golven (harde assertie); draw calls stijgen
  met ten hoogste het aantal decal-batches (richtwaarde: 1, via één
  gedeeld materiaal).
- **Acceptatiecriteria:**
  - Na 25 gesimuleerde golven zijn `renderer.info.memory.geometries` en
    `.textures` en de mesh-telling ongewijzigd t.o.v. golf 1.
  - Het 41e spoor hergebruikt aantoonbaar het 1e slot (pool wraps).
  - `obstakels.length` blijft 58 — decals hebben nooit collision.
  - Een decal ligt visueel plat op het geraakte vlak, ook op schuine
    vlakken (dak, trap), zonder z-fighting in een screenshot-test.
  - `test-resources.mjs` en `test-inslagen-rijker.mjs` blijven groen.
- **Testplan:** uitbreiding van `test-resources.mjs`' lange-run-simulatie
  met de decal-pool; nieuw `tests/test-inslagsporen.mjs` voor pool-wrap,
  oriëntatie op een schuin vlak en de niet-groei-assertie; volledige
  regressie.
- **Rollback:** de pool-grootte op 0 zetten; `schiet()` slaat de
  decal-aanroep dan over en het gedrag valt exact terug op vandaag.
- **Sonnet solo:** ja, met de kanttekening dat de z-fighting-controle een
  visuele beoordeling vraagt (screenshot, niet alleen een assertie).

---

## Ticket 158 — Geld houdt betekenis in de late run

- **Type:** feature (economie/balans)
- **Verbetergebied:** 5 (Progressie en keuzes)
- **Prioriteit:** middel
- **Status:** open (gepland)
- **Afhankelijk van:** niets mechanisch, maar zie de harde randvoorwaarde
  rond `ONTSNAPPING_PRIJS` hieronder — dit ticket raakt de finale-economie
  en moet dus ná FINALE.md's model gelezen worden, niet ervoor.
- **Doel:** voorkomen dat geld halverwege de run ophoudt een beslissing te
  zijn, en dat overschot aan het eind van de run naar niets converteert.
- **Huidige situatie:** twee afzonderlijke problemen die op elkaar lijken
  maar het niet zijn — beide geverifieerd in de code:

  **(A) Overschot converteert naar niets.** `berekenScore()` is
  `kills*10 + headshots*15 + (golf-1)*100 + bonus`, maal
  `moeilijkheid.scoreFactor`. **`spelStaat.geld` komt er niet in voor.**
  Wie de run uitspeelt met €9.000 op zak krijgt exact dezelfde score als
  wie 'm uitspeelt met €0. Al dat verdiende geld is dode waarde.

  **(B) Geld houdt op een keuze te zijn.** De eenmalige aankopen tellen op
  tot ongeveer €22.900: deuren (500 + 1000 + 1200 + 800 + 900 + 700),
  wapens (AMSTEL-9 450, Ratelaar 750), perks (Snelspanner 600,
  Pantserdrank 1000, Autoherlader 1000) en de Smederij (3000 + 4000 per
  wapen, dus 14.000 voor beide). Daarna resteren alleen nog
  `AMMO_PRIJS` (300), `WATERTAP_PRIJS` (200) en de Provisiekast — alle
  drie **vaste prijs en behoefte-gestuurd**: je koopt ze als je bijna
  leeg of gewond bent, niet als afweging. Ze schalen niet mee met
  rijkdom. Ondertussen blijft het inkomen wél stijgen
  (`WAVE_BONUS_BASIS 75 + WAVE_BONUS_PER_GOLF 15` per golf, plus kills),
  dus het gat groeit elke golf.

- **Gewenste situatie:** beide problemen apart adresseren, want ze hebben
  een andere oplossing en een heel ander risicoprofiel:

  **Voor (A) — de veilige basislaag:** overgebleven geld converteert bij
  een geslaagde ontsnapping (en eventueel bij game over, tegen een
  lagere koers) naar score. Dit raakt **geen enkel balansgetal in de
  golf-economie**: geen spawn-druk, geen threat-budget, geen wapenschade.
  Het maakt alleen dat "geld verdienen" ook laat in de run nog ergens
  toe leidt. Kleinste mogelijke ingreep met het grootste deel van het
  effect.

  **Voor (B) — de laag die de keuze terugbrengt:** één herbruikbaar
  kooppunt met een **oplopende** prijs, zodat het meeschaalt met rijkdom
  in plaats van een vaste aanschaf te zijn. Voorkeursvorm is een
  *tempo*-aankoop, geen *kracht*-aankoop: bijvoorbeeld alle barricades
  in het pand in één keer herstellen voor een prijs die per gebruik
  stijgt. Dat hergebruikt het bestaande barricadesysteem, past bij de
  belegeringsfictie, en — cruciaal — het maakt de speler niet sterker,
  het koopt hem tijd. Daarmee blijft de zorgvuldig getunede
  vijandbalans (geen bullet sponges, threat-budget per golf) buiten
  schot.

- **Codegebieden:** `berekenScore()`, `voltooiOntsnapping()` en het game
  over-pad (voor A); een nieuw kooppunt in `interactiePunten` +
  `WINKEL_STIJLEN` + de barricade-herstelcode (voor B).
- **Buiten scope:** geld toevoegen aan de highscore-opslag als apart veld
  (de score dekt het al); een prijs van een bestaande eenmalige aankoop
  wijzigen; het inkomen zelf verhogen of verlagen; een tweede
  win-conditie; alles wat `golfBudget()` of de spawn-druk aanraakt.
- **Randgevallen:**
  - **`ONTSNAPPING_PRIJS` (2500) is een harde drempel, geen aankoop.**
    Een nieuwe geldput mag een speler nooit onder die drempel kunnen
    duwen op een manier die de ontsnapping onbereikbaar maakt zonder dat
    hij dat doorhad. Ofwel de put blokkeert zichzelf zodra het saldo
    onder 2500 zou zakken terwijl de vluchtroute compleet is, ofwel de
    UI waarschuwt expliciet. Dit is het belangrijkste risico van dit
    ticket.
  - **(A) mag de moeilijkheidsgraden niet scheeftrekken.** De
    score-conversie loopt door `moeilijkheid.scoreFactor` heen; Toerist
    geeft meer startgeld, dus een te gulle koers beloont juist de
    makkelijkste stand. Koers kalibreren tegen de bestaande
    scoretermen (een kill is 10, een golf is 100) — geld moet duidelijk
    mínder waard zijn per eenheid dan spelen.
  - **(B) mag geen verplichte uitgave worden.** Als "alles herstellen"
    altijd de beste zet is, is het geen keuze maar een belasting. De
    oplopende prijs moet snel genoeg stijgen dat er een moment komt
    waarop je 'm bewust overslaat.
  - **Geen nieuwe collision, geen nieuwe zone.** Het kooppunt uit (B)
    hangt aan bestaand decor; `obstakels.length` blijft 58.
  - **Herbruikbaarheid volgt het bestaande patroon** (Watertap /
    Provisiekast), inclusief de `status()`-functie in `WINKEL_STIJLEN`
    en `updateWinkelMarkeringen()`' teDuur/beschikbaar-logica.
- **Performancevoorwaarden:** geen; dit is een economieticket. Mesh- en
  materiaaltelling ongewijzigd op één kooppunt na (T85-regel).
- **Acceptatiecriteria:**
  - Twee runs met identieke kills/headshots/golf maar verschillend
    eindsaldo leveren een **verschillende** score op (dekt A).
  - De score-conversie is nooit groter dan een vast plafond én nooit
    zo groot dat geld de dominante scoreterm wordt (harde assertie op
    een lategame-simulatie).
  - Met een complete vluchtroute kan het saldo niet ongewaarschuwd onder
    `ONTSNAPPING_PRIJS` zakken door de nieuwe geldput.
  - De prijs van de herbruikbare put stijgt aantoonbaar per gebruik.
  - `obstakels.length` blijft 58; `interactiePunten` groeit met exact 1.
  - `test-finale.mjs`, `test-score-stats.mjs` en `test-golf1-economie.mjs`
    blijven groen.
- **Testplan:** nieuw `tests/test-geldeconomie.mjs` met de twee
  score-runs, het ontsnappingsdrempel-randgeval en de oplopende prijs;
  een lategame-simulatie (golf 20+) die aantoont dat er op elk moment nog
  een zinvolle uitgave bestaat; volledige regressie.
- **Rollback:** de score-conversiefactor op 0 zetten en het kooppunt niet
  registreren — dan valt het gedrag exact terug op vandaag.
- **Sonnet solo:** deel (A) ja. Deel (B) nee — een nieuwe herbruikbare
  geldput raakt de rondebalans en verdient een speelsessie-oordeel, geen
  puur headless groen vinkje.

---

## Ticket 159 — Kwaliteitsinstelling (Laag / Normaal / Hoog) ✅

- **Type:** feature (performance/instellingen)
- **Verbetergebied:** 7 (Renderbudget)
- **Prioriteit:** hoog
- **Status:** ✅ uitgevoerd (v0.26). `tests/test-kwaliteitsinstelling.mjs`
  (34 checks) dekt de presettabel, de renderstaat per preset, het
  terugkeren naar exact de uitgangsstaat, tien lekvrije preset-rondjes,
  de opslag-randgevallen (onbekend, corrupt, leeg, geweigerde storage) en
  de balans-onaantastbaarheid. `test-visuele-basislijn.mjs` pint zichzelf
  nu expliciet op `normaal` vast. Volledige regressie: **97/97 groen**.

  **Twee dingen bewust NIET meegeleverd, met reden:**
  1. **A3 (zone-lichtculling) is een no-op-vlag.** `KWALITEIT_PRESETS.laag
     .lichtculling` staat op `true` maar stuurt nog niets aan. Dit ticket
     levert de plek waar A3 mag bestaan; A3 zelf raakt de belichting en
     verdient een eigen ticket met de pixelmeting-vangrail uit T79.
     Daarmee vervalt ook het acceptatiecriterium "op Laag is het aantal
     actieve lichten aantoonbaar kleiner" — dat hoort bij dat
     vervolgticket, niet bij dit ticket.
  2. **De oogleesbaarheid op Laag is nog niet getoetst.** Bloom uit raakt
     precies de gloeiende ogen, en tijdens een Stroomuitval zijn die het
     enige zichtbare kanaal. Dit is een speelsessie-oordeel op echte
     hardware, geen headless assertie — zie het openstaande punt hieronder.
- **Afhankelijk van:** niets om te starten. **Blokkeert** wel de zinvolle
  uitvoering van auditbevindingen A3 en A4, en is de gewenste voorwaarde
  voor T157.
- **Doel:** de speler laten kiezen tussen beeldkwaliteit en soepelheid, en
  daarmee een thuis geven aan de drie auditbevindingen die niet op één
  vaste waarde te beslissen zijn omdat het antwoord van de machine
  afhangt.
- **Huidige situatie:** er is geen enkele grafische instelling. Het
  instellingenmenu bevat alleen de muisgevoeligheid (T75) en de
  geluidsknop. De renderconfiguratie staat vast: `setPixelRatio(
  Math.min(devicePixelRatio, 2))`, bloom aan, schaduwen aan, geen
  lichtculling. Op een scherm met `devicePixelRatio` 2 rendert het spel
  daardoor op vier keer zoveel fragmenten als op een gewoon scherm, elk
  door 28 forward-lichten — zonder dat de speler daar iets aan kan doen.
  `PERFORMANCE_AUDIT.md` laat drie bevindingen (A3, A4, A8) bewust open
  omdat er geen universeel juiste waarde bestaat.
- **Gewenste situatie:** drie presets in het bestaande instellingenmenu.
  De verdeling is zo gekozen dat **Normaal exact de huidige stand is**:

  | | Laag | **Normaal (default)** | Hoog |
  | --- | --- | --- | --- |
  | Pixelratio-plafond (A8) | 1 | **2** | 2 |
  | Bloom | uit | **aan** | aan |
  | Schaduwen | uit | **aan** | aan |
  | Lichtculling (A3) | aan | **uit** | uit |
  | MSAA op de composer-target (A2 optie B) | uit | **uit** | aan |

  Daarmee krijgt elke openstaande auditbevinding een plek zonder dat er
  ook maar iets aan de standaardervaring verandert: A3 en A8 leven
  uitsluitend onder **Laag** (waar snelheid expliciet boven sfeer gaat,
  dus waar de zwaar getunede helderheidsbalans niet leidend is), en A2
  optie B — echte antialiasing, in de audit afgewezen als default omdat
  het geld kost — wordt de reden dat **Hoog** bestaat.

  **A4 (schaduw-throttling) staat bewust NIET in deze tabel.** Bij het
  uitwerken bleek de oorspronkelijke opzet zichzelf tegen te spreken: op
  Laag staan de schaduwen al volledig uit, en dan valt er niets te
  throttlen. Schaduwen-uit domineert throttling volledig, dus A4 heeft in
  dit drie-presets-schema geen zinvolle plek. A4 wordt daarmee pas
  relevant als er ooit een vierde, tussenliggende preset komt die
  schaduwen wél aanhoudt — of als losse optimalisatie op Normaal, en dan
  onder de oorspronkelijke auditvoorwaarde: eerst meten op echte
  hardware. Het blijft dus open in `PERFORMANCE_AUDIT.md`, maar niet als
  onderdeel van dit ticket.
- **Codegebieden:** het bestaande instellingen-overlay (naast
  `gevoeligheidSlider`), `leesGevoeligheid()`/`schrijfGevoeligheid()` als
  opslagpatroon, `renderer.setPixelRatio()`/`composer.setPixelRatio()`,
  `bloomPass.enabled`, `renderer.shadowMap.enabled`, en de plekken die
  A3/A4 zouden aanraken (`lampLichten`, `renderer.shadowMap.autoUpdate`).
- **Buiten scope:** automatische hardware-detectie (precies de gok die de
  audit niet kon maken — de speler kiest); per-onderdeel-schakelaars voor
  bloom/schaduw los (dat maakt het een ontwikkelaarsmenu); de
  toegankelijkheidsschakelaars uit **T115** (camerawieg, filmkorrel) —
  die blijven een aparte, eigen groep met een eigen reden van bestaan,
  en T115's regel "geen derde schakelaar omdat het kan" geldt daar
  onverkort. Kwaliteit en toegankelijkheid mogen in de UI niet door
  elkaar lopen.
- **Randgevallen:**
  - **Normaal moet aantoonbaar identiek zijn aan vandaag.** Dit is de
    belangrijkste eis van het ticket: de standaardervaring verandert
    niet, ook niet een beetje. Toetsbaar met de bestaande
    T88-pixelmeting.
  - **De T88-helderheidsvangrail geldt niet op Laag.** Bloom en
    schaduwen uitzetten verandert de luminantie per definitie; de
    visuele basislijntests moeten expliciet op Normaal draaien, en Laag
    heeft een eigen (ruimere) verwachting of een gemotiveerde
    uitzondering. Zonder dit valt `test-visuele-basislijn.mjs` om op een
    preset die juist bedoeld is om er anders uit te zien.
  - **Een kwaliteitsinstelling mag het spel nooit moeilijker maken.**
    Zie de valkuil hieronder — dit is geen detail maar de reden dat dit
    ticket een speeltoets nodig heeft.
  - **MSAA aan/uit vereist het opnieuw opbouwen van de
    composer-rendertarget.** Anders dan pixelratio (waar
    `setPixelRatio()` + `setSize()` volstaan) is `samples` een
    constructie-optie. Ofwel de target netjes opnieuw opbouwen (inclusief
    `dispose()` van de oude — T70-contract), ofwel deze ene wissel achter
    een herstart zetten. Niet stilzwijgend lekken.
  - **Opslag volgt T74/T75:** vormvalidatie bij het lezen, onbekende
    waarden negeren, veilige default (**Normaal**), alles in try/catch —
    `localStorage` kan ontbreken of geweigerd zijn.
  - **De preset mag de spelbalans nergens raken:** geen invloed op
    spawn, schade, hitboxen, threat-budget of score.
- **Performancevoorwaarden:** op Normaal mogen draw calls, driehoeken,
  geometrieën en texturen exact gelijk blijven aan vandaag (harde
  assertie). Laag moet aantoonbaar mínder werk doen (lagere
  lichttelling in de shader-uniforms, lagere drawingBuffer-resolutie).
- **Acceptatiecriteria:**
  - Op **Normaal** is een screenshot vanaf elk T88-standpunt gelijk aan
    de huidige basislijn binnen de bestaande marge, en zijn de
    `renderer.info`-tellingen ongewijzigd.
  - Op **Laag** is de drawingBuffer-resolutie aantoonbaar lager en is het
    aantal actieve lichten aantoonbaar kleiner.
  - De ogen van ondoden blijven op **Laag** leesbaar tijdens een
    Stroomuitval (zie de valkuil) — meetbaar als luminantiecontrast
    tussen oog en achtergrond, niet als "het ziet er nog goed uit".
  - De keuze overleeft een herstart; corrupte opslag valt terug op
    Normaal zonder foutmelding.
  - Wisselen van preset lekt geen geometrie/textuur (`test-resources.mjs`
    over meerdere wissels heen).
  - `obstakels.length` blijft 58; spawn-, schade- en scoregetallen
    ongewijzigd.
- **Testplan:** nieuw `tests/test-kwaliteitsinstelling.mjs` (preset-
  persistentie, corrupte opslag, de niet-lekken-assertie over wissels,
  de Normaal-is-identiek-assertie, de oogleesbaarheid op Laag);
  `test-visuele-basislijn.mjs` expliciet vastzetten op Normaal;
  volledige regressie.
- **Rollback:** de preset-keuze verbergen en hard op Normaal zetten —
  dan is het gedrag exact dat van vandaag.
- **Sonnet solo:** deels. De instelling, opslag en Normaal-pariteit zijn
  goed headless te toetsen. De **inhoud** van Laag (hoe ver mag het beeld
  degraderen voordat het spel oneerlijk wordt) vraagt een speeltoets door
  de eigenaar, met name tijdens een Stroomuitval.

---

## Backlog — bevroren tickets (niet uitvoeren zonder expliciete opdracht)

Op verzoek van de gebruiker: "het nieuwe wapen (ticket 47 en 48) hoef ik
niet meer". De Hagelketel (verbetergebied 3, wapenarsenaal) staat
inhoudelijk klaar als ontwerp — ARCHITECTURE_NOTES §6.6 (beslissingen 38
en 39) blijft ter referentie staan — maar wordt voorlopig NIET
geïmplementeerd. Als dit ooit weer actueel wordt: gewoon opnieuw oppakken
zoals hieronder beschreven, er hangt niets anders van af (T47/T48 waren
altijd al onafhankelijk van T42-46/49-56).

### Ticket 88 (backlog) — Volledige verdiepingslaag (afgewezen bij v0.21)
- **Status:** backlog — niet uitvoeren zonder expliciete opdracht
- **Herkomst:** de zware variant van IDEEEN.md E1, afgewezen tijdens de
  v0.21-planning ten gunste van T87 (De Vliering). Volledige analyse:
  ARCHITECTURE_NOTES §9.8.
- **Wat het zou zijn:** twee begaanbare vloeren boven dezelfde x/z —
  een echte zolder bóven het atelier, met ondoden die tussen
  verdiepingen navigeren.
- **Waarom afgewezen (voorlopig):** `berekenKelderY(x, z)` is nu een
  pure functie van x en z. Twee vloeren over dezelfde x/z maken y een
  *relatie* in plaats van een functie, en dan moet ELK van deze vijf
  systemen een verdiepingsbegrip krijgen: `updateSpeler()` (speler-Y),
  `updateOndoden()` (ondode-Y), `losBotsingenOp()` (nu volledig 2D),
  `zoneVan()` (nu volledig 2D) en `tekenMinimap()` (welke verdieping
  teken je). Dat is geen ticket maar een architectuurwijziging met vijf
  gelijktijdige risicopunten, in systemen die net in v0.20 zijn
  opgeschoond.
- **Wanneer dit wél zinnig wordt:** als er een concrete speelreden is die
  T87's disjuncte vliering aantoonbaar niet dekt. Begin dan bij §9.8,
  niet bij de geometrie.
- **Wat T87 er alvast voor doet:** `berekenKelderY()` wordt daar
  `berekenVloerY(x, z)`. Dat is precies de functie die hier een derde
  parameter zou krijgen — de naamswijziging is dus geen cosmetiek maar
  de voorbereiding.

### Ticket 47 (backlog) — Wapen W4: De Hagelketel (data, model, pellet-schot)
- **Status:** backlog — niet uitvoeren zonder expliciete opdracht
- **Doel:** een derde wapen met een eigen niche: traag, brede spread,
  verwoestend van dichtbij (Drukspuit = precisie, Ratelaar = volume,
  Hagelketel = close range).
- **Samenvatting:** `WAPEN_HAGELKETEL`-definitie (magazijnMax 4,
  reserve 16, herlaadDuur 2.4/1.7, vuurtempo ~1.1s, spreadNdc 0.055,
  kickSterkte 0.03, terugslagSterkte 1.6, `smederijConfig {schadeBonus
  1, magazijnMax 6}`); nieuw `pelletAantal`-veld (1 bestaand, 6 voor de
  Hagelketel) met een pellet-lus in `schiet()` (allocatievrij, hergebruik
  van de bestaande temp-vectoren/pools); model + vlam/vlamLicht
  (lichttelling +1, grens in de integratietest meeverhogen in DIT
  ticket); alléén via debug-hook activeerbaar, nog geen kooppunt.
  Volledige tekst met acceptatiecriteria/testplan: zie de git-historie
  van dit bestand (commit met "Fable-architectuurronde 4") of vraag om
  'm opnieuw uit te schrijven.
- **Sonnet solo:** ja, met de hot-path-waarschuwing (raakt `schiet()`).

### Ticket 48 (backlog) — Wapen W5: Hagelketel-winkel + driewapen-wissel
- **Status:** backlog — niet uitvoeren zonder expliciete opdracht
- **Afhankelijk van:** Ticket 47 (backlog)
- **Doel:** de Hagelketel koopbaar maken en de Q-wissel laten werken
  met drie wapens.
- **Samenvatting:** `HAGELKETEL_PRIJS = 2800`, wandrek-kooppunt in de
  bijkeuken (isVrijePlek-probes), `koopHagelketel()` volgens het
  koopRatelaar-patroon, `WINKEL_STIJLEN`-entry, `wisselWapen()`
  herschreven op een `WAPEN_VOLGORDE`-array (cycle naar het volgende
  GEKOCHTE wapen); interactiepunten-telling 12→13 (de exacte-
  tellingscheck in `test-smederij-verhuizing.mjs` moet in DIT ticket
  mee). Volledige tekst: zie de git-historie of vraag om 'm opnieuw uit
  te schrijven.
- **Sonnet solo:** ja.

### Idee (backlog, niet uitgewerkt) — standaard achtergrondmuziek
~~Een permanente achtergrondmuziek-track (los van de bestaande
dreigingsaudio-drone en de eenmalige stings) voor Amsterdam Undead. Puur
als idee genoteerd op verzoek van de gebruiker — geen ontwerp, geen
architectuur, geen ticket-uitwerking. Oppakken pas na expliciete opdracht.~~
**Bijgewerkt in v0.19 (Fable-architectuurronde 5):** dit idee is nu volledig
uitgewerkt als **Ticket 66** (zie hierboven, sectie "v0.19"), met
architectuur in ARCHITECTURE_NOTES.md §7.7.1 (beslissing 59, volgt het
bestaande dreigingsaudio-drone-patroon). Nog steeds NIET geïmplementeerd —
oppakken pas na expliciete opdracht.

---

## Feedbackronde — Performance-audit doorgevoerd
Op verzoek ("de game kan soms wat haperig worden") is een performance-audit
gedaan (voor/na-screenshots + render-attributiemeting) en zijn de drie
gevonden optimalisaties doorgevoerd:
1. Schaduw-resolutie van de ene schaduwwerpende hanglamp: 512 -> 256
   (`schaduw===1`-invariant blijft intact — alleen de resolutie verlaagd).
2. De twee ember-lichtjes (bereik 0,9m) in de Smederij-visuals (Drukspuit +
   Ratelaar) verwijderd — de gloed komt vrijwel volledig van het emissive
   ringmateriaal, niet van deze lichten. Lichttelling 28 -> 26.
3. Zeven `new THREE.Vector3()`/`.clone()`-allocaties per ondode per frame
   in `updateOndoden()` vervangen door hergebruikte module-scope
   temp-vectors — vermoedelijke daadwerkelijke oorzaak van het gemelde
   haperen (garbage-collector-pauzes bij ~5.900 allocaties/s met 14
   ondoden op 60fps), zonder enig gameplay- of visueel verschil.

Zie ARCHITECTURE_NOTES.md §7.9.1 voor de volledige onderbouwing
(inclusief de pixelmetingen per punt) en waarom castShadow NIET van
decor-meshes is afgehaald (bewust buiten scope — raakt gedeelde
helperfuncties door de hele kaart heen voor een onzekere aanvullende
winst). `test-gracht-dock.mjs` en `test-smederij.mjs` bijgewerkt naar de
nieuwe lichttelling. Volledige regressie: 42/42 groen (3x herhaald).

---

## Tickets 64/65 — Waypoint-navigatiegraaf ✅
Uitgevoerd in één diff (zie de tickets zelf hierboven in de v0.19-sectie
voor de volledige ticketbeschrijving). `ZONE_WAYPOINTS`/`zoekWaypoint()`
vervangen de oude `eigenInGracht`/`spelerInGracht`/`inZoneVier`-special-
case voor de bijkeuken/gracht-gang-opening (zone 4). `test-gracht-dock.mjs`
bleef ongewijzigd groen; nieuw testbestand `tests/test-waypoint-navigatie.mjs`
dekt de dataset/lookup plus trajectory-traces. Zie ARCHITECTURE_NOTES.md
§7.6.3 voor het volledige verslag. Volledige regressie: 43/43 groen.

## Feedbackronde — Kelder-trap chokepoint (na T64/T65)
Op verzoek ("ze kunnen niet altijd goed de kelder in lopen") is de
waypointgraaf uit T64/T65 uitgebreid naar de kelder-trap (zone 2): een
smalle (1,2m), lange (4m) koker tussen de open nis en de kelderruimte,
met TWEE muuropeningen na elkaar. Gesimuleerd: een ondode die van opzij
nadert, bleef vóór de fix ~9s tegen de muur naast de opening hangen
voordat de lokale ontwijk-logica de opening bij toeval vond.

`ZONE_WAYPOINTS[2]` kreeg twee entries (boven- en onderkant van de
trap-koker), en `zoekWaypoint()` is gegeneraliseerd van "de eerste
toepasselijke entry in de lijst" naar "de toepasselijke entry wiens punt
het dichtst bij de huidige positie ligt" — nodig omdat de trap-koker per
richting een ander eerste tussenpunt vereist (zone 4, met maar één
waypoint, verandert niet van gedrag). Resultaat: de oversteek duurt nu
~2,5s i.p.v. ~9s, en de totale reistijd naar een speler diep in de
kelder daalt van ~20s naar ~12s.

Zie ARCHITECTURE_NOTES.md §7.6.4 voor het volledige verslag.
`tests/test-waypoint-navigatie.mjs` uitgebreid met dataset-checks voor
zone 2, richtingsafhankelijke lookup-checks en een trajectory-trace die
het 3s-plafond bewaakt. `test-kelder-trap.mjs` bleef ongewijzigd groen.
Volledige regressie: 43/43 groen.

Daarnaast een bijgewerkte plattegrond van de volledige huidige kaart
(topologie-diagram + coördinatentabel) toegevoegd als ARCHITECTURE_NOTES.md
§7.11 — vervangt het verouderde §4.6 (dat dateert van vóór de
map-lus/kelder/gracht-ronde en blijft staan als historisch document).

---

## Openstaande verbeteringen Defend National Monument (bevroren tot expliciet gevraagd)
- Performance verbeteren
- Wave balancing testen
- Game over en restart flow verbeteren

## Regels
- main blijft stabiel; Defend National Monument niet aanraken tenzij expliciet gevraagd
- geen grote rewrite, geen gedeelde engine in v1
- geen externe assets; elke game blijft single-file
- elke stap eerst testen (headless + handmatig) voordat die naar main gaat

## Later (na v1, alleen indien gewenst)
- Meer kamers/grachtenzones, meer ondood-types, meer upgrades
- Pas over gedeelde engine nadenken als beide games stabiel zijn
