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
