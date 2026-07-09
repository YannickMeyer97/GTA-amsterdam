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
