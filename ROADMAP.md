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

# v0.14+ — Architectuurronde (gepland, nog NIET geïmplementeerd)

Ontworpen door Claude Fable; uitvoering later door Claude Sonnet, één ticket
per keer. Lees eerst `ARCHITECTURE_NOTES.md` (codekaart + ontwerpbeslissingen)
en `SONNET_EXECUTION_PLAN.md` (volgorde + kant-en-klare prompts).
Fasen: 1 = balans (T1–T5), 2 = debug (T10), 3 = eventgolven (T6–T9),
4 = wave-redesign (T13–T15), 5 = Pack-a-Punch (T11–T12, bewust ná fase 4).

## Ticket 1 — Balance: wave-heal naar 60
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

## Ticket 2 — Power-ups: cooldown op sterke power-ups (2 golven)
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

## Ticket 3 — Power-ups: aparte Kerninslag-cooldown (4 golven)
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

## Ticket 4 — Zombie balance: Loper naar 2,2 m/s
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

## Ticket 5 — Zombie balance: Sjouwer naar 5 HP
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

## Ticket 6 — Eventgolven: basisframework
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

## Ticket 7 — Mistgolf: visueel effect
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

## Ticket 8 — Nieuwe zombie: Sluiper
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

## Ticket 9 — Mistgolf: spawngewichten
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

## Ticket 10 — Debug- en testhooks
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

## Ticket 11 — Pack-a-Punch: architectuur (data + schade, nog geen machine)
- **Type:** Feature (fundament)
- **Doel:** per-wapen upgrade-status en de nieuwe schadeformule, zonder
  zichtbare gameplay-wijziging (er is nog niets te koop).
- **Waarom:** de schadeformule raakt `raakOndode()` — het gevaarlijkste
  stukje code; dat wil je los testen vóór er een machine aan hangt.
  Per-wapen i.p.v. globaal: ontwerpbeslissing 8.
- **Concrete wijzigingen:**
  - Wapendefinities krijgen een `smederijConfig` (naamgeving: de machine
    heet in-game **De Smederij** — géén "Pack-a-Punch", zie IP-regels in
    CLAUDE.md en de eerder afgesproken naamtabel):
    Drukspuit `{ schadeBonus: 1, magazijnMax: 12 }`,
    Ratelaar `{ schadeBonus: 0.5, magazijnMax: 24 }`.
  - `nieuweWapenStaat()` krijgt veld `gesmeed: false`.
  - Schadeformule in `raakOndode()`:
    `basis = schadePerTreffer + (wapenStaat.gesmeed ? wapenStaat.definitie.smederijConfig.schadeBonus : 0)`
    `schade = basis + (kop ? HEADSHOT_EXTRA : 0)` (Eliminatiemodus-override
    blijft erboven staan). Fractioneel (0,5) is veilig: HP-checks zijn
    `<= 0`.
  - De globale schade-upgrade (`koopUpgrade`, `schadePerTreffer`) blijft
    exact zoals hij is — early-game pad.
  - Debug-export: `get gesmeedActief()` (status actief wapen),
    smederijConfigs.
- **Acceptatiecriteria:** zonder `gesmeed` is alle schade identiek aan nu
  (volledige regressie groen); met `gesmeed=true` via debug: Drukspuit
  bodyshot = schadePerTreffer+1, Ratelaar = +0.5; wisselen (Q) behoudt de
  status per wapen; Drukspuit smeden verandert Ratelaar-schade niet.
- **Risico's:** `raakOndode` wordt door tests direct aangeroepen met de
  actieve `wapenStaat` als impliciete context — dat blijft zo (bewust: de
  schade hoort bij het wapen waarmee geschoten wordt).
- **Testplan:** headless: schade-asserts per wapen × gesmeed × headshot ×
  upgrade-staat (8 combinaties); wissel-persistentie; volledige regressie.
- **Rollback:** `gesmeed`-veld + één term in de formule verwijderen.
- **Sonnet solo:** ja, maar pas ná Ticket 14 (schadewaarden zijn op de
  nieuwe HP-curve gebalanceerd).

## Ticket 12 — Pack-a-Punch: machine "De Smederij" (implementatie)
- **Type:** Feature
- **Doel:** koopbare machine (€3000 per wapen) op de binnenplaats die het
  ACTIEVE wapen smeedt: schadebonus (T11), groter magazijn, aangepast
  uiterlijk, sterker schoteffect, HUD-status.
- **Waarom:** late-game geldsink (ontwerpbeslissing 7); binnenplaats is de
  laatste zone dus de natuurlijke plek.
- **Concrete wijzigingen:**
  - `const SMEDERIJ_PRIJS = 3000;`
  - Interactiepunt volgens het bestaande patroon (`ratelaarPunt` als
    voorbeeld): positie op de binnenplaats via `PLAATS_*`-ankers (bv. tegen
    de noordmuur, vrij van schuurtje/kratten/spawn-ankers — check met
    `isVrijePlek`), `interactieMarkering(x, z, kleur)`, prompt toont actief
    wapen + prijs of "al gesmeed".
  - `koopSmederij()`: geld-check, `wapenStaat.gesmeed = true`,
    `magazijnMax` → smederijConfig-waarde (magazijn meteen bijvullen tot
    het nieuwe max is redelijk), eenmalig per wapen.
  - Visueel/audio: emissive accentkleur op de wapen-mesh van het gesmede
    wapen, feller `vlamLicht`, eigen `speelSmeed()`-piep; simpel houden
    (geen nieuwe geometrie nodig).
  - HUD: `updateHUD()`/`updateAmmoUI()` tonen een merkteken (bv. ster) bij
    de wapennaam als het actieve wapen gesmeed is.
  - Machine-decor: klein aambeeld/werkbankje van 2–3 boxen, GEEN collision
    (of een bewuste `registreerRechthoek` als hij vrij staat — dan ook de
    obstakel-count-test bijwerken).
- **Acceptatiecriteria:** Drukspuit smeden: €-3000, magazijn 8→12, schade
  +1, HUD-merkteken, tweede keer kopen doet niets; Ratelaar idem
  (16→24, +0.5) en onafhankelijk van de Drukspuit; met te weinig geld
  gebeurt niets (bestaand `speelGeenGeld`-patroon); golf 12–15 blijft
  uitspeelbaar ZONDER smeden (balanscheck, ontwerpbeslissing 12).
- **Risico's:** interactiepunt-plaatsing op een onvrije plek; vergeten
  magazijn-refill waardoor het nieuwe max pas na een reload zichtbaar is;
  obstakel-tests als het decor collision krijgt.
- **Testplan:** headless kooppad per wapen (zoals de bestaande
  `koopRatelaar`-tests); dubbele-aankoop-guard; wissel-gedrag; screenshot
  van machine + gesmeed wapen; volledige regressie.
- **Rollback:** interactiepunt + `koopSmederij` + decor verwijderen; T11
  blijft dan inert bestaan.
- **Sonnet solo:** ja, direct na T11.

## Ticket 13 — Wave redesign: threat-budget-architectuur
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

## Ticket 14 — Wave redesign: geleidelijke HP-schaling
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

## Ticket 15 — Wave redesign: spawn-cap en drukcontrole
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
