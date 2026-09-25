# ROADMAP_monument.md — Defend National Monument

Voortgangsoverzicht van `defend-national-monument.html`. Tegenhanger van
`docs/amsterdam-undead/ROADMAP_undead.md`; de twee games delen geen code en
deze twee roadmaps delen geen tickets.

- **Wat er gebouwd moet worden en waarom** staat in
  `SONNET_EXECUTION_PLAN_monument.md` — daar staat per ticket de volledige
  opdracht, de acceptatiecriteria en de onderbouwing.
- **Hoe de game in elkaar zit** staat in `ARCHITECTURE_NOTES_monument.md`.
- **Dit bestand** houdt alleen bij wat af is, wat loopt en wat er onderweg is
  veranderd.

---

## Waar de game nu staat

Versie v4, 3.518 regels. Wave-survival op de Dam: vijf spawnpoorten, vijf
robottypes, drie upgrades, een combosysteem en de Kerkklok Boost. Speelbaar en
stabiel.

De game heeft lang stilgelegen terwijl Amsterdam Undead doorontwikkelde. De
diagnose daarvan — kaart te groot, geen ritme in het schieten, monument is
decor, geen ruimtelijke beslissingen, run zonder staart, nul testdekking —
staat in `SONNET_EXECUTION_PLAN_monument.md` §2.

**Testdekking: 0 scripts.** Alle 117 testscripts in `tests/` gaan over Amsterdam
Undead. Dit is de reden dat het plan bij testinfrastructuur begint en niet bij
de herschaling.

**Stand na fase 3 (bijgewerkt):** fase 0 t/m 3 zijn gebouwd. Naast het
eindscherm, de highscore en het afbrokkelende monument (fase 2) heeft de game
nu aangekondigde poorten met lichtbakens, een beperkt wapenbereik, tien
bouwplekken met geschuttorens en hekken (drie niveaus, repareren, verkopen),
bombers die bouwwerken aanvallen, een bouwfase van 20 s tussen waves, een
herijkte economie en themagolven. Vijftien testscripts (`test-dnm-*.mjs`,
387 checks) plus twee meetscripts. D16 wacht nog op de speeltest van de
eigenaar (acceptatiecriterium uit het plan). Na D6 volgde een review van het resterende plan; de bijsturing
daaruit staat in `SONNET_EXECUTION_PLAN_monument.md` §10 en is hieronder al
in de volgorde verwerkt.

---

## Tickets

Legenda: ☐ open · ◐ bezig · ☑ af · ✗ geschrapt

**Volgorde na de review (na D6):** de tabellen hieronder staan in
uitvoeringsvolgorde, niet in nummervolgorde. Ticketnummers zijn bewust NIET
hernummerd (ze staan in commits en documenten); nieuwe tickets kregen de
eerstvolgende vrije nummers D28–D30. Onderbouwing: plan §10.

### Fase 0 — Fundament

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D0** | Testmap opsplitsen per game |
| ☑ | **D1** | Testinfrastructuur en debug-hooks uitbreiden |
| ☑ | **D2** | Gedragstests die een herschaling overleven |
| ☑ | **D3** | Documenten sorteren |

D0 komt vóór D1: de testmap moet gesplitst zijn voordat `helpers-defend.mjs`
en de eerste `test-dnm-*`-tests erin landen, anders verhuis je ze later
alsnog.

### Fase 1 — De arena op maat

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D4** | Schaalfundament (voorzichtig, nooit combineren) |
| ☑ | **D5** | Spelsystemen herijken op de nieuwe schaal |
| ☑ | **D6** | Meten en bijstellen (gespeeld en bevestigd; opvolgpunten hieronder) |

### Fase 2 — De run krijgt een kop en een staart

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D7** | Eindscherm met statistieken |
| ☑ | **D8** | Highscore |
| ☑ | **D9** | Opnieuw spelen zonder verversen |
| ☑ | **D20** | Zichtbare schadestaten *(naar voren gehaald uit fase 5)* |

### Fase 3 — De tower defense-kern

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D28** | Aangekondigde poorten *(nieuw)* |
| ☑ | **D29** | Wapenbereik beperken *(nieuw)* |
| ☑ | **D10** | Bouwplekken |
| ☑ | **D11** | De geschuttoren |
| ☑ | **D15** | Bouwfase tussen waves *(naar voren, direct na D11)* |
| ☑ | **D12** | Torenniveaus en reparatie |
| ☑ | **D13** | Het hek |
| ☑ | **D14** | Robots vallen torens aan |
| ◐ | **D16** | Economie herijken (gemeten en bijgesteld; speeltest verhuist naar D43) |
| ☑ | **D30** | Themagolven *(nieuw)* |

### Fase M — Make-over van de Dam *(na de speeltest van fase 3, vóór fase 4)*

Na fase 3 werkte de kaart niet lekker: robots liepen niet duidelijk, de kaart
was onhandig en niet mooi, en de interactie was versnipperd. Het volledige
plan, met de besluiten van de eigenaar, staat in
`SONNET_EXECUTION_PLAN_monument.md` §11.

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D31** | Plattegrond ontwerpen en laten goedkeuren → **M1** *(voorstel 2 goedgekeurd)* |
| ☑ | **D32** | Nieuw fundament (grey-box): `DAM_LAYOUT`, vloer met kinderkopjes, rijbanen, tramrails |
| ☑ | **D33** | Vaste routes over de rijbanen; bouwplekken en hekken uit de layout |
| ☑ | **D34** | Routes zichtbaar: oplichtend bij de aankondiging, bakens aan de straatingang |
| ☑ | **D35** | Commandopost bij het monument, één menupaneel, HUD zonder overlap → **M2** (grey-box speeltest) *(M2 gespeeld)* |
| ☑ | **D44** | Minimap draait mee (heading-up) — *na M2* |
| ☑ | **D45** | Menu opent vanzelf bij commandopost en bouwplek — *na M2* |
| ☑ | **D46** | Bouwplekken: knooppunten bij het monument + een voorpost per straat — *na M2* |
| ☑ | **D47** | Eigen hekslot naast het torenslot — *na M2* |
| ☑ | **D48** | Nieuwe toren: Bovenleiding (stroomstoot springt over naar tot 4 robots) — *na M2* |
| ☑ | **D49** | Nieuwe toren: Muntpers (+50% geld voor kills in bereik) — *na M2; vervangen door D51* |
| ☑ | **D50** | Voorposten aan de overkant van de knooppunten — *speeltest na D49* |
| ☑ | **D51** | Drukpers op eigen plekken voor het Paleis, vast inkomen — *speeltest na D49* |
| ☑ | **D36** | Textuurbibliotheek (gekopieerd uit Undead + kinderkopjes, zandsteen, leisteen, …) |
| ☑ | **D37** | Paleis op de Dam — *schermafbeeldingen bij de eigenaar* |
| ☑ | **D38** | Nieuwe Kerk — *schermafbeeldingen bij de eigenaar* |
| ☑ | **D39** | Rond het monument: Bijenkorf, Krasnapolsky, Hotel TwentySeven (Industria), Madame Tussauds; daarna **besluit plek commandopost** (M2) — *schermafbeeldingen en besluit bij de eigenaar* |
| ☑ | **D40** | Straatwanden van de vijf straten — *schermafbeeldingen bij de eigenaar* |
| ☑ | **D41** | Sfeer en straatmeubilair — *schermafbeeldingen bij de eigenaar* |
| ☑ | **D42** | Prestaties (budget, instancing), direct gevolgd door D21 *(D21 ook ☑)* |
| ☐ | **D43** | Herijken op de nieuwe kaart + eindspeeltest → **M3** |

**D31 — stand.** De plattegrond staat in
[`PLATTEGROND.html`](PLATTEGROND.html): bovenaanzicht op schaal, routes met
looptijden, bouwplekken, gebouwmaten en kenmerken. De indeling staat één keer
in de pagina, als JSON; alles wordt daaruit berekend. In D32 wordt dat blok
`DAM_LAYOUT`.
- **Schaal: mensmaat 1:1** in plaats van ~1:2 (plan §11.3 punt 2).
- **Routes:**

  | Route | Lengte |
  |---|---:|
  | Damrak | 43,8 m |
  | Rokin | 43,8 m |
  | Damstraat | 43,4 m |
  | Kalverstraat | 49,8 m |
  | Nieuwendijk | 49,8 m |

  - Bij het plafond duurt de snelste route 13,2 s, de langste 15,1 s.
  - Voor de langzaamste wave-1-robot duurt een route 29–34 s.
- **Bouwplekken:** de verste ligt 38,7 m van de monumentrand. Het criterium
  is verruimd van 35 naar 40 m, zodat Kalverstraat en Nieuwendijk een plek
  in hun eigen straat krijgen (plan §11.3 punt 6).
- **Kerkklok:** 13,9 s heen en terug vanaf de commandopost.
- **Voorstel 2, na feedback van de eigenaar:** de Bijenkorf staat op de hoek
  Dam–Damrak aan de oostkant van het Damrak, en Hotel TwentySeven
  (Industria) op de zuidoosthoek bij het Rokin. De Warmoesstraat en de Nes
  zijn toegevoegd als doodlopende stegen. De ligging rondom is opgezocht
  (bronnen in de plattegrond).
- **Toetsing:** `meet-dnm-plattegrond.mjs` geeft 37/37 toetsen goed.
- **Doelarchitectuur:** plan §11.7, beknopt in `ARCHITECTURE_NOTES_monument.md`
  §15.

**D32 — nieuw fundament, verslag.**
- **De oude wereldbouw is eruit** (~2.060 regels). De Dam wordt nu op
  mensmaat 1:1 gebouwd uit `DAM_LAYOUT`, letterlijk het JSON-blok uit de
  plattegrond. `ARENA_SCHAAL`, `GEBOUW_HOOGTE_SCHAAL`,
  `MONUMENT_HOOGTE_SCHAAL` en `MONUMENT_ROND_Y` bestaan niet meer.
- **Vloer:**
  - kinderkopjes op het plein;
  - asfalt met tramrails op Damrak, Rokin en Damstraat;
  - natuursteen op de trambaan over de Dam;
  - stoepen met een stoeprand van 0,12 m;
  - lichte klinkers in de voetgangersstraten;
  - donkere klinkerstroken waar een route over het plein loopt.

  Alle texturen worden procedureel getekend met een vaste seed (techniek
  gekopieerd uit Undead).
- **Gebouwen:** massieve blokken op hun voetafdruk en hoogte, met één
  herkenningspunt per landmark: de koepel van het Paleis, de spits van de
  Nieuwe Kerk, de toren van de Bijenkorf, de koperen kap van Industria.
  Botsing per deel via `registreerRechthoek`.
- **Monument:** opnieuw opgebouwd op 1:1 (pyloon 22 m) met alle
  schadestaten van D20. De paaltjesring is weg; de leeuwen staan op de
  treden, de urnenmuur alleen aan de noordoostkant.
- **Naar voren gehaald uit D33:**
  - de bouwplekken komen al uit de layout, met een hek over de volle
    rijbaan- of straatbreedte;
  - robots lopen de routepunten van hun poort af.

  Het echte routevolgen (baan, onderlinge afstand, hek op route-`s`) blijft
  D33.
- **Tijdelijk tot D35:** de reparatie staat op de plek van de commandopost,
  de upgradekiosk op het plein voor de Bijenkorf.
- **Tests:**
  - nieuw: `test-dnm-layout.mjs` (23 checks). Die eist dat de game-layout
    gelijk is aan de plattegrond, dat alle plattegrondtoetsen goed zijn,
    dat er geen obstakel op een rijbaan of strook ligt, en dat de vloer
    klopt en de texturen deterministisch zijn;
  - bijgewerkt: `test-dnm-bouwplekken` (plekken uit de layout, afstand tot
    de strookrand) en `test-dnm-wapenbereik` (`wereld` via de debug-hook,
    richten vanaf de echte ooghoogte).
- **Prestaties** (1280×720, zelfde standpunten als de nulmeting):

  | Standpunt | Draw calls (was) | Driehoeken (was) |
  |---|---:|---:|
  | monument | 240 (1407) | 9k (50k) |
  | plein west | 265 (1421) | 9k (51k) |
  | Damrak | 350 (2314) | 13k (70k) |

  Laadtijd headless 2,9 s (was 6,2 s).

**D33 — vaste routes, verslag.**
- **Routevolgen.** Een robot met een poort volgt zijn route op afstand
  langs de route (`s`):
  - in een eigen baan (`laanFractie`), die vanzelf versmalt van 9 m op het
    Damrak naar 3 m op de strook over het plein;
  - met een stuurpunt 1,5 m vooruit, zodat bochten rond worden;
  - op 1,2 m afstand van een voorganger in dezelfde baan. Een snelle robot
    wacht, er ontstaat een rij, geen klont.
- **`s` groeit met de loopsnelheid**, zolang de robot binnen 2 m van zijn
  plek op de route is. Eerst werd `s` uit een projectie gehaald, maar aan de
  binnenkant van een bocht bleef die op het hoekpunt hangen en liepen robots
  vast.
- **Eind van de route:** het laatste stukje gaat recht op het monument af.
  Met de eigen baan erbij kwam het eindpunt anders net buiten de
  treffergrens.
- **Hek:** werkt op route-`s` (`hekVoorRobot`), dus ook de buitenste banen
  komen er niet langs. De oude verdeling van palen over "overkant + plek" is
  weg.
- **Bomber:** verlaat zijn route voor een bouwwerk (`bouwwerk`), keert terug
  via de dichtstbijzijnde routeplek (`terug`) en loopt verder (`route`).
- **Vastlopen** is op de route een meting: `spel.vastloopTeller`. Het
  zijwaarts uitwijken blijft alleen buiten de route.
- **Nieuw: `test-dnm-routes.mjs`** (31 checks, 5× op rij groen). Getoetst
  met echte robots:
  - elke poort × elk type bereikt het monument, nooit buiten de strook, `s`
    loopt nooit terug;
  - de banen spreiden zoals bedoeld en een snelle robot haalt niet in;
  - een onverwoestbaar hek houdt alle drie de banen tegen op elke verre
    plek;
  - de bomber doorloopt route → bouwwerk → terug → route;
  - een wave van 40 robots komt volledig aan, met 0 keer vastlopen.

**D34 — routes zichtbaar, verslag.**
- **Lichtspoor per route:** een band van 1,6 m met pijlpunten van poort tot
  monument, die met de looprichting mee schuiven.
  - In de bouwfase branden de aangekondigde routes fel (opacity 0,85).
  - Tijdens de wave branden de actieve routes gedimd (0,2).
  - Het spoor volgt dezelfde keuze als de bakens (`updatePoortBakens`), dus
    ook na een reset klopt het vanzelf.
  - Geen tone mapping op het spoor: ACES dempte het oranje tot een flets
    goud.
- **Bakens bij de straatingang.** Het baken staat nu waar de straat op het
  plein uitkomt (`straatIngang`), niet meer bij de poort diep in de straat.
  Ernaast staat een grey-box-straatnaambord (D40 maakt er een echt bord
  van).
- **Minimap:** tekent straten en rijbanen, en de route van elke poort met
  een spoor (fel of gedimd). De poortring staat bij de straatingang.
- **Nieuw: `test-dnm-route-zicht.mjs`** (18 checks):
  - fel in de bouwfase, gedimd in de wave;
  - het spoor dekt de hele route en houdt geen schot tegen;
  - bakens en borden staan bij de straatingang;
  - de minimap tekent oranje op de route en grijs op een rijbaan zonder
    dreiging;
  - na een reset brandt er niets fel.
- **D27 (pijlen), het eerdere besluit:** herbeoordelen ná D34. Nu het spoor
  en de bakens de routes tonen, beoordeelt de eigenaar dat bij M2.

**D35 — commandopost en één menu, verslag.**
- **De commandopost** staat aan de westvoet van het monument (plek en maat
  uit `DAM_LAYOUT.commandopost`): een paviljoen met luifel, een toonbank
  naar het plein en een bord. Botsing op de voetafdruk.
  - Menu: 1 vuurtempo, 2 pickup radius, 3 loopsnelheid (prijzen zoals nu),
    4 monument repareren (€100, +25 HP).
  - De Bijenkorf-kiosk en de Koninklijke Reparatiepost zijn weg. Er zijn nu
    12 interactiepunten: Kerkklok, commandopost en 10 bouwplekken.
- **Eén menupaneel** (`menuUI`, `openMenu`, `sluitMenu`, `kiesMenuOptie`)
  voor de commandopost en de bouwplekken.
  - Opbouw overal gelijk: titel, genummerde opties met prijs, "te duur" in
    rood, "klaar" in groen.
  - T sluit; weglopen (één regel via `menu.hoortBij`) en pauze sluiten ook.
  - `shopUI`, `bouwUI` en de dubbele toetsafhandeling zijn weg.
- **HUD zonder overlap op 1280×720 en 1024×640** (gemeten met alle 12 vaste
  elementen tegelijk in hun breedste stand):
  - het doel staat in de bovenste rij tussen geld en score;
  - special, menu-link, combo en kerkklokbanner zijn een stuk omlaag
    geschoven;
  - de interactieprompt en de besturingshulp staan altijd op één regel;
  - het menupaneel staat erboven.
- **Nieuw: `test-dnm-commandopost.mjs`** (19 checks). Bijgewerkt:
  `test-dnm-kern` (12 interactiepunten) en de drie torentests (paneel
  `menuUI`).

**Beslismoment M2 — gespeeld.** De grey-box is gespeeld en goedgekeurd,
met deze besluiten:

| Vraag | Besluit | Verwerkt |
|---|---|---|
| Lopen robots duidelijk? | Ja. | — |
| Ritme (looptijden, bouwfase 20 s)? | Prima. | — |
| Richtingspijlen (D27) nog nodig? | Nee. | D27 geschrapt; de randpijlen naar robots buiten beeld zijn verwijderd. |
| Kerkklok | Niet direct te zien; zet hem voor het Paleis. | Midden voor het Paleis (−61, 0), 1,7× zo groot; 13,6 s heen en terug vanaf de commandopost. |
| Commandopost | Misschien liever tegen de Bijenkorf, afhankelijk van hoe die eruit gaat zien. | Blijft aan het monument; het besluit valt direct na D39. |
| Hoogtes | Nieuwe Kerk en Krasnapolsky voelen te hoog. Alles rond het plein lager, met de verschillen zoals in het echt. | Alles ~25% lager, via minder verdiepingen; de onderlinge verhoudingen kloppen. Oorzaak: het plein is 44 m breed in plaats van ~100 m. |
| Namen | Zoals in het echt, nu al. | Gevelletters op Bijenkorf, Krasnapolsky, Madame Tussauds/Peek & Cloppenburg en Hotel TwentySeven, in gewone letters, zonder logo. Paleis en Nieuwe Kerk dragen in het echt geen naam. |

Nieuwe hoogtes (m, gevel / hoogste deel):

| Gebouw | Gevel | Hoogste deel |
|---|---:|---:|
| Paleis | 20 | 38 |
| Nieuwe Kerk | 22 | 32 |
| Beurs van Berlage | 17 | 30 |
| Hotel TwentySeven (Industria) | 17 | 24 |
| Bijenkorf | 17 | 23 |
| Krasnapolsky | 18 | 20 |
| Madame Tussauds | 17 | 17 |
| Gevelrijen | 11–13 | 11–13 |

De plattegrond is bijgewerkt (versie M2-1, 37/37 toetsen) en de game volgt
hem (`test-dnm-layout`).

**D44 — minimap draait mee, verslag.**
- **Heading-up**, zoals Undead: jij staat in het midden en wijst omhoog,
  de kaart draait eromheen.
- **Straal van de kaart:** 55 m (`MINIMAP_BEREIK`).
- **Nu ook op de kaart:** gebouwen, als donkere vlakken.
- **Hulpfunctie:** `naarMinimap(x, z)` rekent een wereldpunt om naar een
  punt op de kaart; tests gebruiken hem ook.
- **Test:** `test-dnm-route-zicht` toetst dat wat 20 m voor je ligt, bij
  elke kijkrichting recht boven het midden staat.

**D45 — menu opent vanzelf, verslag.**
- Bij de commandopost en bij een bouwplek opent het menu vanzelf; cijfers
  kopen direct.
- T sluit het. Het blijft dicht tot je wegloopt en terugkomt
  (`menuHandmatigGesloten`).
- Na bouwen of verkopen blijft het ook dicht.
- De Kerkklok houdt T.
- `test-dnm-commandopost` heeft 22 checks. De torentests en de hektest
  lopen via het automatisch geopende menu.

**Hekfix (gevonden tijdens D45).** Een robot kon soms op 1–2 m vóór het
hek gaan staan slaan, omdat de hektoets alleen op `s` keek. Nu begrenst
het eerstvolgende hek op de route (`hekOpRoute`) `s` en het stuurpunt vlak
vóór het hek, en slaat een robot pas bij echt contact (lijntest). Hij kan
er nog steeds niet langs. De hektest is 3× op rij groen, en ook een
reproductie die eerder 1 op de 4 keer faalde, faalt niet meer.

**D46 — knooppunten en voorposten, verslag.**
- **Nieuwe indeling (8 plekken, was 10).**
  - Drie knooppunten op het plein:
    - Plein noord: Damrak en Nieuwendijk;
    - Plein zuid: Rokin en Kalverstraat;
    - Plein oost: de hoek van de Damstraat.
  - Vijf voorposten, één per straat, op de plek van de oude "verre" plek.
  - De oude "nabije" plekken zijn weg; de knooppunten vervangen ze.
- **Afgevallen:** Zuidoost (tussen Rokin en Damstraat) en Trambaan-west,
  uit het eerdere voorstel.
  - Daar komen de stroken van verschillende routes zo dicht bij elkaar dat
    een hek over een andere route of over de speldoos zou lopen.
  - Een hek dat wel vrij ligt, zou 12–19 m van de plek staan, buiten het
    torenbereik.
  - Een toets in de plattegrond legt dit vast.
- **Dekking bij torenbereik 10 m (niveau 1):**

  | Route | Knooppunt | Stuk route binnen bereik |
  |---|---|---|
  | Damrak | Plein noord | 23 m |
  | Nieuwendijk | Plein noord | 15,5 m |
  | Rokin | Plein zuid | 23 m |
  | Kalverstraat | Plein zuid | 15,5 m |
  | Damstraat | Plein oost | 14 m |

- **Hek op een knooppunt.** Het hek legt één lijn over elk van zijn routes,
  met één HP-pot. Een robot van elk van die routes loopt ertegenaan.
- **Plattegrond:** versie D46, 46/46 toetsen goed. Nieuwe toetsen:
  - voorpost per route, buiten het wapenbereik;
  - dekking per route;
  - hek ≤ 7 m van zijn plek;
  - geen hek over een andere route of de speldoos.
- **Tests.**
  - `test-dnm-bouwplekken` is herschreven (45 checks).
  - `test-dnm-hek` loopt alle 10 combinaties van plek en route af,
    inclusief beide routes van een knooppunt (48 checks).
  - `test-dnm-routes`, `-kern`, `-layout` en de torentests zijn bijgewerkt
    via `plekVoor(route, soort)`.

**D47 — eigen hekslot, verslag.**
- **Twee slots per plek.** `plek.toren` staat naast de route, `plek.hek`
  ligt dwars erover. Bouwen, verkopen en sneuvelen raken alleen het eigen
  slot. De keuze toren-óf-hek is weg: een hek houdt robots vast in het vuur
  van de toren ernaast.
- **Menu.**
  - Eerst het torenslot, dan het hekslot. Een lege plek toont
    "1 Geschuttoren, 2 Hek".
  - Met toren en hek zijn er zes opties (upgraden, repareren, verkopen, per
    slot). De cijfertoetsen gaan daarom tot 6.
  - Het menu blijft na bouwen en verkopen open, zodat het andere slot
    meteen te kopen is.
- **Geen hekpaal op de tegel** (`opPlekTegel`). Het hek valt daar uiteen in
  stukken met eigen dwarsliggers. De contactlijn blijft heel, dus robots
  kunnen er niet door.
- **Minimap:** een plek is gevuld zodra er een toren of een hek staat.
- **Tests.** `test-dnm-hek` heeft 55 checks. Nieuw daarin:
  - toren en hek samen, via het menu;
  - zes opties;
  - geen paal op een tegel;
  - robots van beide knooppuntroutes staan tegen het hek en sneuvelen in
    het vuur;
  - verkopen of sneuvelen van het een laat het ander staan.

  `test-dnm-toren-geschut` en `-niveaus` toetsen dat het menu openblijft.

**D48 — de Bovenleiding, verslag.**
- **Wat het is:** een tramdraadmast in het torenslot. Groene mast met een
  uitlegger, isolatoren en een stuk rijdraad; de uitlegger wijst naar de
  route. De kop gloeit op bij een stoot. Eigen vorm en eigen geluid (Web
  Audio, `speelStroomstoot`).
- **Werking:**
  - de stoot treft de dichtstbijzijnde robot binnen bereik;
  - daarna springt hij naar de dichtstbijzijnde nog niet getroffen robot
    binnen de sprongafstand van de vorige;
  - de schade daalt per sprong met factor 0,75;
  - een actief schild vangt de stoot op en stopt de keten;
  - zonder doelwit vuurt hij niet.
- **Niveaus (startwaarden, te ijken in D43):**

  | Niveau | Prijs | Bereik | Schade | Robots | Sprong | Interval | HP |
  |---|---|---|---|---|---|---|---|
  | 1 | €175 | 10 m | 1 | 3 | 4 m | 2,0 s | 50 |
  | 2 | €200 | 11 m | 1,5 | 4 | 4,5 m | 1,8 s | 75 |
  | 3 | €300 | 12 m | 2 | 4 | 5 m | 1,6 s | 110 |

- **Menu:** een lege plek toont nu "1 Geschuttoren, 2 Bovenleiding,
  3 Hek". De upgradetekst komt per type uit `niveauTekst`.
- **Tests:** `test-dnm-bovenleiding` (19 checks). `test-dnm-hek` leest het
  nummer van de hekoptie nu uit het aantal torentypes.

**D49 — de Muntpers, verslag.**
- **Wat het is:** een gietijzeren pers in het torenslot: sokkel, twee
  zuilen, een zware kopbalk en een stempel boven een gouden munt. Een lage
  gouden ring op de grond toont het bereik.
- **Werking:**
  - een robot die binnen het bereik sneuvelt, door de speler of door een
    toren, laat een munt achter die 50% meer waard is (`muntpersBonus` in
    `vernietigRobot`);
  - de stempel slaat bij elke bonuskill;
  - twee persen stapelen niet;
  - hij valt niet aan, maar telt wel als doelwit voor bombers.
- **Niveaus (startwaarden, te ijken in D43):**

  | Niveau | Prijs | Bereik | HP |
  |---|---|---|---|
  | 1 | €150 | 8 m | 60 |
  | 2 | €150 | 10 m | 90 |
  | 3 | €200 | 12 m | 130 |

  Upgrades geven meer bereik en HP, niet meer bonus.
- **Menu:** een lege plek toont nu "1 Geschuttoren, 2 Bovenleiding,
  3 Muntpers, 4 Hek". De omschrijvingen zijn ingekort, zodat zes opties
  ook op 1024×640 zonder overlap passen.
- **Test:** `test-dnm-muntpers` (13 checks), met `Math.random` vastgezet.
- **Stapelen in de praktijk:** de knooppunten liggen 26–31 m uit elkaar,
  dus twee persen overlappen nu nooit. De regel staat er toch, voor als de
  plekken ooit verschuiven.

**D36 — textuurbibliotheek, verslag.**
- **Zes nieuwe patronen** in `TEXTUUR_TEKENAARS`, naast de zes vloeren uit
  D32:

  | Patroon | Voor | Maat |
  |---|---|---|
  | baksteen | Bijenkorf, Nieuwe Kerk, grachtenpanden | waalformaat, 22 × 6,6 cm met voeg |
  | geleBaksteen | Industria / Hotel TwentySeven | idem |
  | zandsteen | Paleis | blokken van 60 × 30 cm, verweringsstrepen |
  | natuursteen | banden, lijsten, plinten | platen van 120 × 40 cm |
  | leisteen | daken | leien van 30 × 20 cm |
  | glas | ramen en etalages | schuine reflectiebanen |

- **Aanpak:** het verband is gekopieerd uit Undead (halfsteens,
  seed per patroonnaam); de rest is nieuw.
  - Alles is in kleur getekend, net als de vloeren.
  - Elk patroon is naadloos, ook in kleur: `tekenSteenRij` geeft de steen
    die over de rand valt dezelfde kleur als die links binnenkomt.
- **Wereldschaal:** `TEXTUUR_STEEN` legt de echte steenmaat vast;
  `steenPixels` rekent die om naar een geheel aantal stenen per tegel.
- **Gebruik in D37–D40:**
  - `gevelMateriaal(patroon, kleur)` is gedeeld per patroon en kleur; glas
    glanst, steen niet.
  - `textuurOpWereldschaal(geo, patroon)` zet de UV's.
- **Nog niet toegepast:** de grey-box ziet er hetzelfde uit. D37–D40
  bouwen de gevels met deze bibliotheek.
- **Test:** `test-dnm-texturen` (44 checks):
  - per patroon: bestaat, deterministisch, naadloos;
  - steen op wereldschaal, binnen 5%;
  - UV's op wereldschaal;
  - materialen gedeeld;
  - alle patronen verschillend.
- `THREE` staat nu op de debug-hook.

**D37 — Paleis op de Dam, verslag.**
- **Gevel aan de Dam, 13 traveeën (2 + 2 + 5 + 2 + 2):**
  - middenrisaliet van 5 traveeën, 0,35 m naar voren; hoekpaviljoens
    0,2 m;
  - een lage onderbouw met zeven rondboogpoortjes in de middenrisaliet,
    ernaast kleine vensters;
  - twee orden, elk met een rij hoge ramen en een rij lage
    tussenverdiepingsramen; pilasters tussen alle traveeën;
  - plint, twee banden, kroonlijst en dekplaat in natuursteen;
  - fronton boven de middenrisaliet: schuine lijsten, een timpaan met een
    cartouche en liggende figuren, en drie bronzen beelden erop.
- **Zijgevels** (noord en zuid): 10 traveeën met dezelfde ramen en lijsten.
  De achtergevel ligt buiten de kaart.
- **Dak en koepel:**
  - een laag loden schilddak;
  - de koepel: vierkante voet, achtkantige trommel met open bogen en
    zuilen, loden koepel, lantaarn;
  - bovenop een vergulde bol met een windvaan in de vorm van een schip;
    de mast raakt precies 38 m.
- **Beeldhouwwerk** bestaat uit eigen, algemene vormen; er is niets
  nagetekend.
- **Techniek:**
  - `maakBouwer()` verzamelt onderdelen per materiaal en voegt ze samen
    (`voegGeometrieenSamen`). Het hele Paleis is 10 meshes.
  - Onderdelen worden in een gevelstelsel (u, y, d) gebouwd en met
    `opGevel` op de gevel gezet.
  - De ramen gebruiken nieuwe roedetexturen (`roedeRaam`,
    `roedeRaamLaag`).
- **Prestaties, vanaf drie vaste standpunten:**

  | Standpunt | Draw calls voor | Draw calls na | Driehoeken voor | Driehoeken na |
  |---|---|---|---|---|
  | plein | 111 | 103 | 3,7k | 18k |
  | plein zuidoost | 110 | 108 | 3,9k | 19k |
  | noordhoek | 92 | 83 | 3,6k | 18k |

  De laadtijd is ~1,4 s, ~0,1 s meer dan ervoor. D42 legt het budget
  vast; dit zit er ruim onder.
- **Botsing:** ongewijzigd (voetafdruk + 0,3 m). Op loophoogte steekt
  niets verder uit dan botsing + spelerstraal; alleen het lijstwerk hoog
  in de gevel steekt tot 1 m uit.
- **Test:** `test-dnm-paleis` (13 checks). Onderdelen worden geteld met
  stralen op de echte geometrie:
  - 7 poortjes;
  - 13 ramen per rij;
  - 8 onderbouwvensters;
  - 3 beelden;
  - fronton boven 23 m, windvaan op 38 m.

  Verder: texturen, botsing en uitsteken op loophoogte.

**Speeltest na D49 (tijdens D37).** Twee punten van de eigenaar:
1. De voorposten in de straten liggen te ver om munten te halen. Zet ze
   aan de overkant van de weg tegenover de knooppunten, op drie plekken:
   - voor de zuidgevel van de Damrak-westwand;
   - aan de noordkant van de Kalverstraat-route, net ten westen van de
     tramrails;
   - boven de noordwesthoek van de Damstraat-zuidwand.
2. De muntpers voelt raar als toren. Haal hem uit het torenmenu en geef
   hem drie eigen aankooppunten voor het Paleis, met een vast inkomen los
   van de robots, dat zich gemiddeld in drie rondes terugverdient.

Drie plekken voor vijf voorposten is gelezen als: de drie vervangen alle
vijf. Elk hoort bij het knooppunt aan de overkant van zijn weg.

**D50 — voorposten aan de overkant, verslag.**

| Voorpost | Tegenover | Afstand | Routes (hek) | Dekking bij 10 m |
|---|---|---|---|---|
| Damrak west (-25, -19) | Plein noord | 12,8 m | Damrak + Nieuwendijk | 15 m + 15,5 m |
| Kalverstraat noord (-26,5, 8,4) | Plein zuid | 14,8 m | Kalverstraat | 18 m |
| Damstraat zuid (17,2, 17,75) | Plein oost | 14,4 m | Damstraat | 17,5 m |

- **Nu 6 plekken, was 8.** De verste plek ligt op 23 m van de
  monumentrand, waar dat 38,7 m was.
- **Kalverstraat noord dekt de Rokin niet.** Dichter bij de Rokin-bocht
  zou zijn hek over de Rokin-strook lopen, of 8 m van de plek komen te
  liggen. De Rokin ligt al voor 23 m onder Plein zuid.
- **Plattegrond:** versie D50, 47/47 goed. De toets "één voorpost per
  straat" is vervangen door twee toetsen:
  - één voorpost aan de overkant van elk knooppunt, ≤ 16 m verderop;
  - elke voorpost dekt zijn eigen routes.
- **`plekVoor(route, 'voorpost')`:** zonder eigen voorpost geeft het de
  voorpost tegenover het knooppunt van die route (Rokin → Kalverstraat
  noord).
- **Tests:** `test-dnm-bouwplekken` (38), `test-dnm-hek` (9 combinaties
  van plek en route) en `test-dnm-kern` (11 interactiepunten) zijn
  bijgewerkt.

**D51 — Drukpers voor het Paleis, verslag.**
- **Weg uit het torenmenu.** Een gewone plek toont weer "1 Geschuttoren,
  2 Bovenleiding, 3 Hek". De +50%-bonus op kills is verwijderd.
- **Drie drukpersplekken** (`DAM_LAYOUT.drukpersplekken`): noord (-62, -9)
  en zuid (-62, 9) naast de Kerkklok, en midden (-53,5, 0) ervoor.
  - Ze liggen ≥ 6,5 m van de Kerkklok, zodat de interacties niet
    overlappen, en 19 m van elke route.
  - Ze hebben een gouden rand. Het menu biedt alleen de drukpers, zonder
    hekslot en zonder reparatie.
- **Inkomen:** om de 10 s betalen alle persen samen uit, met één popup
  ("+€12 drukpers"). Alleen in het actieve spel, dus niet tijdens pauze
  of na game over.
- **Terugverdienen in 3 rondes:**
  - een ronde is ~85 s: de waves 1–12 duren gemeten 55–84 s, gemiddeld
    ~72 s met robots die tot aan het monument lopen, iets korter als de
    speler schiet; daarbij komt de bouwfase van 20 s;
  - elk niveau verdient zijn totale investering daarom in 250 s terug
    (`DRUKPERS_TERUGVERDIEN_S`).

  | Niveau | Prijs | Totaal geïnvesteerd | Inkomen |
  |---|---|---|---|
  | 1 | €150 | €150 | €6 per 10 s |
  | 2 | €150 | €300 | €12 per 10 s |
  | 3 | €200 | €500 | €20 per 10 s |

  Met drie persen op niveau 3 is dat €6 per seconde. D43 ijkt dat, samen
  met de rest van de economie.
- **Test:** `test-dnm-drukpers` (16 checks) vervangt `test-dnm-muntpers`.

**D38 — Nieuwe Kerk, verslag.**
- **Zuidgevel van het dwarsschip,** de kant die je vanaf de Dam ziet, 2 m
  achter de noordoosthoek van het Paleis:
  - een baksteen topgevel met stenen afdekking en een pinakel;
  - het grote spitsboograam: vier lichten, maaswerk met bogen per licht
    en per paar, en een roos in de kop;
  - een spitsboogportaal eronder;
  - twee achtkantige traptorentjes met stenen banden, lichtspleten en een
    loden spits.
- **Koor aan de Nieuwendijk:** een veelhoekige sluiting met vier
  spitsboogramen van twee lichten, en steunberen in twee versnijdingen.
- **Verder:**
  - een raam op de oostkant van het dwarsschip en op het stukje schip
    tussen dwarsschip en koor;
  - plint, lekdrempelband en gootlijst in natuursteen;
  - steile leien zadeldaken, met de nok op 22 m (koor 20 m) en een
    helling van ~39°;
  - een topgevel waar het schip boven het lagere koor uitkomt.
- **Dakruiter op de kruising:** een achtkantige loden lantaarn met
  spitsboogopeningen en een slanke spits, met een vergulde bol op precies
  32 m. Geen hoge toren, zoals in het echt.
- **Nieuw:**
  - een glas-in-lood-textuur (ruitjes met loodlijnen), naadloos, en
    toegevoegd aan `test-dnm-texturen`;
  - `gevelStelsel(richting, vlak)`, het gevelstelsel van D37 voor elke
    muur;
  - `apsisStelsel`, voor de vlakken van de apsis;
  - `kerkRaam` en `steunbeer`.
- **Prestaties, vanaf drie vaste standpunten:**

  | Standpunt | Draw calls voor | Draw calls na | Driehoeken voor | Driehoeken na |
  |---|---|---|---|---|
  | plein → dwarsschip | 79 | 80 | 18k | 33k |
  | Nieuwendijk → koor | 51 | 44 | 15k | 30k |
  | monument | 114 | 107 | 19k | 34k |

  De hele kerk is 9 meshes.
- **Botsing:** per deel de voetafdruk + 0,3 m, plus de twee
  traptorentjes, die 0,95 m voor de zuidgevel uitsteken. De steunberen
  van het koor passen binnen de voetafdruk.
- **Test:** `test-dnm-kerk` (14 checks), met stralen op de echte
  geometrie:
  - 4 lichten in het transeptraam, dat tot in de topgevel reikt;
  - een portaal;
  - 4 koorramen van 2 lichten;
  - 2 torentjes;
  - een dakruiter op 32 m, en verder niets boven de 25 m;
  - dakhelling ≥ 35°.

  Verder: texturen, botsing, en op loophoogte steekt niets buiten botsing
  + spelerstraal.

**D39 — rond het monument, verslag.**
- **Bijenkorf** (rode baksteen met natuursteen), aan de Dam en langs het
  Damrak:
  - etalages op de begane grond, en aan de Dam de glazen hoofdingang met
    een luifel;
  - drie verdiepingen tussen stenen lisenen;
  - een fries met de naam, kroonlijst, dakverdieping en balustrade;
  - hoekpaviljoens en midden springen 0,25 m voor en dragen een
    segmentfronton;
  - boven het midden een torentje met open bogen en een koperen koepel
    tot 23 m.
- **Krasnapolsky** (lichte, gepleisterde steen), aan de Dam, de
  Warmoesstraat en de Damstraat:
  - een geblokte begane grond met rondboogramen;
  - de ingang onder een glazen luifel aan trekstangen;
  - drie verdiepingen met veel ramen, en smeedijzeren balkons op de eerste
    twee;
  - een fries met de naam, kroonlijst en dakverdieping;
  - een leien mansardekap tot 20 m.
- **Hotel TwentySeven / Industria** (gele baksteen, spaarzaam natuursteen):
  - een asymmetrische gevel met op de hoek Dam–Rokin een torendeel van
    6 × 6 m;
  - onderin het torendeel de juwelierspui, bovenin rondboogvensters;
  - een vierkante, klokvormige koperen kap tot 24 m, waarvan de rand iets
    buiten de toren uitsteekt, zodat je hem ook vanaf het plein ziet;
  - daarnaast vier gewone traveeën aan de Dam en acht langs het Rokin.
- **Peek & Cloppenburg / Madame Tussauds** (lichte kalksteen), aan de Dam,
  het Rokin en de Kalverstraat:
  - een grote winkelpui;
  - sterke pijlers, dikker op de hoeken;
  - vijf bouwlagen;
  - twee bronzen beelden in eigen, eenvoudige vorm op de hoeken aan de
    Dam.

  De gevelnaam is nu donker, want wit op lichte kalksteen las slecht.
- **Gedeeld:**
  - `raamMetOmlijsting`, `etalage`, `balustrade`, `segmentVorm` en
    `rondboogRaam`;
  - `gevelMaterialen()`;
  - etalages hebben een warme gloed van binnen (`emissive`), anders lezen
    ze als zwarte gaten.
- **Gevelnamen:** ze staan op het fries van de echte gevels. De Bijenkorf
  staat op het vooruitspringende midden en de Industria-naam midden boven
  de gewone traveeën. De test toetst dat geen gevelonderdeel ervoor zit.
- **Prestaties:** 64–125 draw calls vanaf vier vaste standpunten (het
  meeste komt van robots, HUD en het monument), 15k–37k driehoeken en
  ~1,5 s laadtijd. Elk gebouw is 8–12 meshes.
- **Test:** `test-dnm-rondom` (34 checks). Per gebouw:
  - meshes, hoogsteDeel, textuur;
  - de naam zichtbaar vóór de gevel;
  - op loophoogte niets buiten botsing + spelerstraal.

  Met stralen geteld:
  - Bijenkorf: 13 stukken etalageglas en 3 segmentfrontons;
  - Krasnapolsky: 5 balkons aan de Dam;
  - Industria: kap boven 22 m;
  - Tussauds: 2 beelden.

  Verder: koepel, luifel, kap, juwelierspui en winkelpui.
- **Nog te beslissen: de plek van de commandopost** (zie plan D39). Die
  staat aan de monumentvoet, tenzij de eigenaar hem tegen de
  Bijenkorf-gevel wil.

**Besluit commandopost (na D39).** De eigenaar koos niet voor de
Bijenkorf, maar zei: "ga door met de rest van de tickets". Volgens het plan
blijft de commandopost dan aan de monumentvoet. Tegen de Bijenkorf zou hij
de looptijden flink verlengen:
- de Kerkklok van 13,6 naar 20,3 s heen en terug;
- de middelste drukpers van 11,5 naar 18,2 s;
- Kalverstraat noord van 4,4 naar 12,3 s.

Dit kan later alsnog, als de eigenaar dat wil.

**D40 — straatwanden, verslag.**
- **Grachtenpanden in plaats van grijze blokken,** langs het Damrak (twee
  kanten plus de hoek aan de Dam), de Nieuwendijk, de Kalverstraat
  (straat en pleinkant), het Rokin en de Damstraat (straat, hoekpand en de
  Nes).
  - Panden zijn 3,8–7,6 m breed.
  - Vier geveltypen: trap-, hals- (met klauwstukken en een fronton),
    lijst- en tuitgevel (met hijsbalk).
  - Rode, donkere, bruine of okergele baksteen, of wit gepleisterd.
  - Witte ramen met stenen lateien, en winkelpuien in zes kleuren met een
    etalage en een deur.
  - Een leien dak achter elke top.
  - De verdeling is vast per gebouw (seed uit de naam), dus elke laadbeurt
    geeft dezelfde straat.
- **Prestaties:** de kleur per pand zit in vertexkleuren onder één
  materiaal (`maakBouwer` kan nu vertexkleuren samenvoegen). Een hele
  straatwand is daardoor ≤ 10 meshes; dat doet hier wat instancing zou
  doen.

  | Standpunt | Draw calls voor | Draw calls na |
  |---|---|---|
  | Damrak | 59 | 75 |
  | Kalverstraat | 56 | 73 |
  | Damstraat | 39 | 58 |
  | Nieuwendijk | 48 | 65 |

  Er zijn 27k–53k driehoeken, en de laadtijd is ~1,5 s.
- **Beurs van Berlage** (in de verte, langs het Damrak): een lange
  bakstenen gevel met rondboogvensters en de klokkentoren met wijzerplaat
  en spits tot 30 m.
- **Straatnaamborden:** een geëmailleerd bordje met rand op een zwarte
  paal met beugel, aan beide kanten leesbaar. Er zijn nu zeven borden: de
  vijf routestraten plus de Warmoesstraat en de Nes.
- **Test:** `test-dnm-straatwanden` (38 checks), per wand:
  - meshes, hoogsteDeel en breedte van de panden;
  - ramen in elk pand (met stralen);
  - elke winkelpui geraakt;
  - loophoogte.

  Verder over het geheel:
  - alle vier de geveltypen;
  - ≥ 3 typen en ≥ 3 kleuren op de lange wanden;
  - de Beurs, en 7 tweezijdige borden;
  - dezelfde panden na herladen.

**D41 — sfeer en straatmeubilair, verslag.**
- **Plekken in `DAM_LAYOUT.meubilair`,** eerst in de plattegrond getoetst
  (versie D41, 51/51 goed):
  - elk meubel ≥ 0,8 m van elke routestrook;
  - niet op een rijbaan of de trambaan, niet in een gebouw;
  - ≥ 2,5 m van elk interactiepunt;
  - niets binnen 11 m van het monumentmidden: het strijdtoneel blijft
    rustig;
  - Amsterdammertjes op de stoeprand;
  - het perron naast de trambaan.
- **In de game:**
  - 33 lantaarns, zwarte palen met een gloeiende kap (emissive, geen eigen
    lichtbron);
  - 144 Amsterdammertjes langs de stoepranden van Damrak, Rokin en
    Damstraat, in eigen vorm en zonder het stadswapen;
  - 4 banken;
  - 3 fietsenrekken met fietsen in zes kleuren;
  - de tramhalte Dam: perron met witte rand, abri met glas, dak, bankje
    en haltebord;
  - 11 toeristen in vier groepjes, aan de randen van het plein, met
    telkens één fotograaf.
- **Decor en spel:**
  - het decor houdt geen schoten tegen;
  - lantaarns, banken, rekken, abri en de groepjes hebben een kleine
    botsing; de paaltjes niet;
  - alles is één groep van 12 meshes, met vertexkleuren voor fietsen en
    kleding.
- **Licht en mist:** gecontroleerd met Grachtenmist. De gevels lossen
  netjes op in de mist, en de gloeiende lampen en etalages blijven
  zichtbaar. Er was niets bij te stellen.
- **Test:** `test-dnm-meubilair` (9 checks):
  - aantallen;
  - afstand tot routestroken;
  - niet op een rijbaan;
  - niet bij interactiepunten;
  - rustig rond het monument;
  - niet raakbaar;
  - gloed en kleuren.

**D42 — prestaties, verslag.**
- **Meetscript** `meet-dnm-prestaties.mjs` (geen test): vijf vaste
  standpunten (monument, plein-west, Damrak, Paleis, Damstraat), draw calls
  en driehoeken van de hoofdpass, een drukke scene met 30 robots in beeld,
  en voor de hele scene meshes, schaduwwerpers, geometrieën, texturen en de
  laadtijd.
- **Wat er is samengevoegd:**
  - alle vloervlakken en de tramrails: één mesh per materiaal;
  - de statische groepen (afsluitingen, bouwplektegels) via
    `voegGroepSamen`;
  - de duif: lijf in één mesh met vertexkleuren, de kop apart (die pikt);
  - het straatnaambord: paal, knop, beugel en plaat in één mesh;
  - de robot: romp (lijf, kop, antenne) en gloed (paneel, ogen,
    antennebol), 11 → 6 meshes (7 voor de Shield Bot).
- **Platte onderdelen werpen geen schaduw** (`GEEN_SCHADUW`: ramen,
  puien, etalages, wijzerplaten, …): 200 → 147 schaduwwerpers.
- **Twee geheugenlekken gedicht.** Elke robot maakte eigen geometrieën, en
  elke munt, elk vonkje, elk stofwolkje en elke brok maakte nieuwe
  geometrie en materialen. Niets daarvan werd opgeruimd, dus in een lange
  run liepen ze op tot duizenden. Nu delen ze allemaal dezelfde geometrie
  (`ROBOT_GEO`, `EFFECT_GEO`, `EFFECT_MAT`); alleen de gloed wordt één keer
  per accentkleur gebouwd. Tekstvlakken met dezelfde tekst en opties delen
  textuur, materiaal en geometrie (`GEVELTEKST_CACHE`): beide kanten van
  een straatnaambord en van een markeringsicoon.
- **Meting, kwaliteit Hoog** (640×400 headless; draw calls in de
  hoofdpass):

  | Standpunt | Draw calls voor | Draw calls na | Driehoeken na |
  |---|---|---|---|
  | monument | 155 | 123 | 69k |
  | plein-west | 200 | 146 | 70k |
  | Damrak | 65 | 58 | 66k |
  | Paleis | 83 | 74 | 66k |
  | Damstraat | 45 | 43 | 48k |

  | Scene | Voor | Na |
  |---|---|---|
  | meshes (zonder robots) | 468 | 359 |
  | schaduwwerpers | 200 | 147 |
  | geometrieën | 378 | 256 |
  | texturen | 32 | 27 |
  | meshes per robot | 11 | 6–7 |
  | 30 robots in beeld | — | 332 draw calls |
  | laadtijd tot de debug-hook | ~1,6 s | ~1,6 s |

  Tegenover de nulmeting van vóór fase M (1407 / 1421 / 2314 draw calls
  vanaf monument, plein-west en Damrak) is dat een factor 10 tot 40.
- **Budget,** vastgelegd in `test-dnm-prestaties` (17 checks), met ruimte
  boven de meting zodat een volgend ticket het merkt als het veel toevoegt:
  ≤ 170 draw calls per standpunt, ≤ 120k driehoeken, ≤ 380 draw calls met
  30 robots, ≤ 7 meshes per robot, ≤ 380 meshes, ≤ 170 schaduwwerpers,
  ≤ 300 geometrieën, ≤ 32 texturen van elk ≤ 1024² pixels, laadtijd ≤ 4 s,
  en geen lek: 40 robots en 40 schoten laten geen geometrie of textuur
  achter.
  - Het plan noemde ≤ 24 texturen. Dat was vóór de textuurbibliotheek (D36)
    en de zeven straatnaamborden (D40); 32 laat ruimte en houdt het klein.
  - Het plan noemde ≤ 400 draw calls; de meting ligt daar ruim onder, dus
    het budget is strakker gezet.
- **Instancing** was niet nodig: samenvoegen per materiaal met
  vertexkleuren gaf al meer dan het budget vroeg, en houdt de onderdelen
  raakbaar voor tests.
- **Bekend, bewust gelaten:** een gesloopte toren ruimt zijn geometrie niet
  op. Dat is begrensd door het aantal bouwacties (enkele tientallen per
  run) en is geen lek van betekenis.

**D21 — kwaliteitsinstellingen, verslag.**
- **Laag / Normaal / Hoog** op het startscherm, onder de startknop, met
  dezelfde opzet als Undead (`KWALITEIT_PRESETS`, bewaard in
  `localStorage` onder `defendNationalMonumentKwaliteit`):

  | | Laag | Normaal | Hoog |
  |---|---|---|---|
  | pixelratio tot | 0,75 | 1 | 2 |
  | anti-aliasing | uit | aan | aan |
  | schaduwen | uit | 1024² | 2048² |
  | duiven | 6 | 12 | 18 |
  | toeristen | nee | ja | ja |
  | brokstukken blijven liggen | 0,8 s | 1,2 s | 1,6 s |

- **Standaard Hoog**: dat is de stand van vóór D21, waarop alle
  schermafbeeldingen van fase M zijn beoordeeld. Op een apparaat met grove
  aanwijzer (telefoon, tablet) zonder eigen keuze is het Laag.
- **De twee lessen uit Undead:**
  1. alles wordt bij het laden uit de preset gelezen, niet pas bij een
     klik (T187);
  2. de test zet de keuze vóór het laden in `localStorage`; hij schakelt
     maar één keer runtime om, om de knoppen zelf te toetsen.
- **Runtime omschakelen** werkt voor alles behalve anti-aliasing, die
  alleen bij het aanmaken van de renderer kan en dus pas na herladen geldt.
  Schaduwen aan of uit laat de shaders één keer opnieuw compileren; dat
  gebeurt alleen op het startscherm.
- **Laag** scheelt vooral de schaduwpass en de pixels (pixelratio,
  anti-aliasing). Het aantal draw calls in de hoofdpass daalt maar een
  beetje (bijvoorbeeld plein-west 146 → 137), omdat de gebouwen gelijk
  blijven.
- **Startscherm op een laag scherm:** op 400 px hoog (een telefoon liggend)
  vielen de knoppen buiten beeld. Onder 560 px hoog wordt het startscherm
  compacter.
- **Test:** `test-dnm-kwaliteit` (12 checks): standaard Hoog op desktop;
  bewaard Laag en Normaal gelden bij het laden (ook anti-aliasing); een
  corrupte sleutel valt stil terug; grove aanwijzer → Laag, maar een
  bewaarde keuze wint; een klik op Laag en terug naar Hoog, met de keuze
  bewaard en zonder dat het spel start.
- **Testhulp:** `openDefend` neemt nu `contextOpties` (bijvoorbeeld
  `isMobile`, `hasTouch`) en een `initScript` dat vóór het laden draait.

### Fase 4 — Oververhitting *(voorwaardelijk: beslissen na fase 3)*

| | Ticket | Kern |
| --- | --- | --- |
| ☐ | **D17** | De warmtemechaniek |
| ☐ | **D18** | Warmte zichtbaar en hoorbaar maken |
| ☐ | **D19** | Koeling als vierde upgrade |

### Fase 5 — Het monument wordt een personage

D20 is naar fase 2 verhuisd; deze fase is daarmee leeg.

### Fase 6 — Platform

| | Ticket | Kern |
| --- | --- | --- |
| ☑ | **D21** | Kwaliteitsinstellingen *(naar voren: uitgevoerd direct na D42, zie het verslag bij D42 in fase M)* |
| ☐ | **D22** | Instellingenscherm |
| ✗ | **D23** | Touch: besturingsgate loskoppelen van Pointer Lock |
| ✗ | **D24** | Touch: lopen, kijken, vuren |
| ✗ | **D25** | Touch: contextknop en bouwen met je duim |
| ✗ | **D26** | Touch: liggend, schermindeling, veilige zones |

### Backlog — bewust ná alle bovenstaande tickets

| | Ticket | Kern |
| --- | --- | --- |
| ✗ | **D27** | Richtingspijlen herzien *(geschrapt bij M2: pijlen verwijderd)* |

**D27 — geschrapt bij M2.** De eigenaar heeft ze niet meer nodig nu het
lichtspoor en de bakens (D34) de routes tonen; de pijlen zijn uit de game
verwijderd. Hieronder de oorspronkelijke aanleiding.

**D27 — Richtingspijlen herzien.** Speeltest-feedback op de
richtingspijlen-implementatie uit de "Speeltest-feedback na D6"-ronde
(zie hieronder): "je ziet nu constant overal wat pijltjes" — te druk/
rommelig zodra er meerdere robots tegelijk buiten beeld zijn (de pool van 5
kan dus alle 5 tegelijk tonen, en dat voelt niet goed). Expliciet verzoek van
de eigenaar: **dit ticket bewust ná alle andere tickets oppakken**, niet nu.
Geen oplossingsrichting vastgelegd — dat is voor als dit ticket aan de beurt
is. De minimap zelf kreeg geen kritiek en blijft ongewijzigd.

**Na de review:** de drukte is vooral een gevolg van het spawnritme (altijd
5–13 robots verspreid over alle vijf poorten), niet van de pijlen zelf. D28
(aangekondigde poorten) raakt die oorzaak. Herbeoordeel D27 dus pas ná D28 —
misschien is het dan al opgelost.

**Stand na fase 3:** D28 is af, dus robots komen nu uit hooguit twee
aangekondigde poorten tegelijk. De pijlen zelf zijn niet aangepast; of ze nu
nog te druk zijn, is aan de speeltest.

**Na het make-overplan:** herbeoordelen ná D34, als de routes zelf al
zichtbaar oplichten.

---

## Afgerond

### D0 — Testmap opsplitsen per game

`tests/` was één vlakke map met 117 test-/check-scripts en 22 hulp-/
meetscripts, allemaal voor Amsterdam Undead. Alles daarvan is verhuisd naar
`tests/amsterdam-undead/`; `node_modules`, `run-all.mjs`,
`run-all-parallel.mjs`, `helpers.mjs`, `README.md` en de package-bestanden
blijven gedeeld op `tests/`-niveau. `tests/defend-national-monument/` volgt
in D1, met de eerste `test-dnm-*`-tests.

**Wat er is aangepast:**
- `run-all.mjs` en `run-all-parallel.mjs`: de vlakke `readdirSync(__dirname)`
  is vervangen door een functie die één niveau diep in elke submap zoekt.
  Vond exact dezelfde 117 scripts als vóór de verhuizing.
- De `HERKANSING`-set matcht nu op de bestandsnaam (`path.basename`), niet op
  het volledige pad — anders zou geen enkel bekend timing-gevoelig script
  meer herkend worden.
- 136 `import … from './helpers.mjs'` herschreven naar `'../helpers.mjs'`.

**Negen scripts bleken hun eigen paden onafhankelijk van `helpers.mjs` te
resolven** (een eigen CDN-intercept, of een losse broncode-inspectie van
`amsterdam-undead.html`), en waren dus stuk na de verhuizing totdat ze
gecontroleerd zijn: `maak-geluidsverslag.mjs`, `meet-audio-budget.mjs`,
`meet-eindtoestand.mjs`, `meet-ruislaag.mjs`, `test-faalmodi.mjs`,
`test-audioregistry.mjs` en `test-arsenaal.mjs`. Elk teruggevonden door een
gerichte grep op `__dirname`/`node_modules`/`amsterdam-undead.html` over de
hele verplaatste map, niet door aan te nemen dat de importfix voldoende was.

**Verificatie:** de volledige suite (`node run-all.mjs`) draaide **117/117
groen** — geen enkele FAIL, ook niet de bekende flake uit een eerdere run.
Dit ticket veranderde geen enkele assertie, alleen paden.

### D1 — Testinfrastructuur en debug-hooks uitbreiden

`window.DamChaosDebug` bestond al (zie D3's bevinding); dit ticket heeft 'm
uitgebreid, niets opnieuw aangemaakt. Twintig nieuwe exports:
`GRENS`, `MONUMENT_POSITIE`, `MONUMENT_BOX`, `MONUMENT_MAX_HP`,
`SPAWN_POORTEN`, `afstandTotMonument`, `upgradeKosten`, `losBotsingenOp`,
`updateRobots`, `koopUpgrade`, `koopMonumentReparatie`, `legMuntNeer`,
`updateInteracties`, `activeerHuidigeInteractie`,
`activeerBijenkorfUpgradeShop`, `updateMunten`, `updateSpeler`,
`probeerTeSchieten`, en twee getters voor `let`-variabelen —
`klokStand: () => klok` en `huidigeInteractieStand: () => huidigeInteractie`
— naar het bestaande patroon van `geldStand`. Elke naam eerst gecontroleerd
op aanwezigheid vóór toevoeging: geen enkele overlapte met wat er al stond.

Nieuw: `tests/helpers-defend.mjs`, een bewust zelfstandige kopie van
`helpers.mjs` (geen gedeelde imports tussen de twee testinfra's, zelfde
regel als tussen de twee games zelf) met `openDefend()`,
`executablePathOptie`, `frames()` en `makeChecker()`. Hergebruikt de
bestaande gedeelde-browser-global uit `run-all.mjs`
(`__AMSTERDAM_UNDEAD_SHARED_BROWSER__`) zodat de suite niet trager wordt
door een tweede browserlaunch — de naam is historisch en dekt inmiddels
beide games, maar hernoemen is bewust buiten scope gehouden.

Eerste test: `tests/defend-national-monument/test-dnm-laadt.mjs` (20
checks) — de game laadt zonder console-errors, de wereld heeft obstakels,
wave 1 staat klaar volgens de bestaande formules, het monument staat op
100 HP, en alle 33 bestaande plus 20 nieuwe debug-sleutels zijn aanwezig
(sleutel-aanwezigheid, geen gedrag — dat is D2). Een korte steekproef
roept de nieuwe exports ook echt aan, zodat een `ReferenceError` niet
alleen door de sleutelcheck heen glipt.

**Verificatie:** `node run-all.mjs` (118 scripts, beide games) draaide
**117/118 groen**; de ene uitvaller (`test-nachthemel.mjs`, een
screenshot-determinismetoets) draaide 3× schoon in isolatie — een
bestaande load-gevoelige flake, geen regressie. De nieuwe D1-test zelf:
20/20. `amsterdam-undead.html` en `index.html` zijn niet aangeraakt.

### D2 — Gedragstests die een herschaling overleven

Nieuw: `tests/defend-national-monument/test-dnm-kern.mjs`, 70 checks in acht
secties — spawnpoorten binnen `GRENS`, interactiepunten binnen `GRENS` en
bereikbaar, geen twee interactiepunten binnen elkaars radius, een
route-simulatie per poort (normale én tank-botsstraal), de wave-formules
voor n = 1/5/10/13/20, `kiesRobotTypeVoorWave` per wave, `upgradeKosten` voor
alle niveaus, `huidigeSchotCooldown` en `robotRaaktMonument`. Alles in
verhoudingen, geen absolute coördinaten — dit bestand is de referentie
waartegen D4's herschaling wordt afgezet.

Geen enkele gameplay-constante aangeraakt; alleen het nieuwe testbestand.

**Twee aannames uit het plan bleken bij het bouwen onjuist, allebei vóór het
eerste testrun gecorrigeerd:**

1. **"Elk interactiepunt ligt op een vrije plek" klopt niet.** De Kerkklok-
   en Reparatie-markering staan zelf op hun eigen, kleine geregistreerde
   rechthoek (dat is de bedoeling — je loopt niet doorheen de markering).
   `isVrijePlek()` op het exacte coördinaat gaf dus `false` voor allebei,
   ook al zijn ze overduidelijk speelbaar. Vervangen door een
   "bereikbaar"-check: 24 hoeken bemonsteren op 75% van de interactieradius
   en eisen dat minstens één richting vrij is. Dat bewaakt wat er echt toe
   doet — kan de speler er binnen bereik van komen — in plaats van een
   toevallige eigenschap van de markering zelf.
2. **De tank-botsstraal (0,45 × 1,4 = 0,63) kan de echte aankomstdrempel
   (0,6) NOOIT halen** — dat is meetkunde, geen routeprobleem: een lichaam
   met straal 0,63 kan nooit dichter dan 0,63 bij de monumentdoos komen,
   dus de vaste 0,6 zou de test altijd laten falen, ook op een verder
   probleemloze route. De drempel is nu straal-relatief (`straal + 0,15`,
   dezelfde marge die de echte 0,6 t.o.v. de echte botsstraal 0,45 al
   had). Met die correctie bereikten alle 5 poorten × 2 botsstraal-
   varianten het monument in 280–621 stappen — geen enkele vastloper op de
   huidige schaal.
3. **`huidigeSchotCooldown()` haalt het plafond van 0,07s niet op
   vuurtempo-niveau 5 alleen.** De formule is
   `max(0.07, (0.26 - niveau·0,035) × getComboVuurtempoMultiplier())`; op
   niveau 5 zonder combo geeft dat 0,085s. Het plafond vereist niveau 5 ÉN
   combo ≥ 10 (multiplier 0,7×). Beide gevallen worden nu apart getest.

**Verificatie:** 70/70 groen, 3× schoon in isolatie gedraaid (de
route-simulatie en de 1000-trekkingen-per-wave typecheck zijn de
RNG-gevoelige onderdelen). Volledige suite (`node run-all.mjs`, 119
scripts): **118/119 groen** — de ene uitvaller is opnieuw
`test-nachthemel.mjs`, dezelfde bestaande flake als bij D1, niet door dit
ticket aangeraakt. Zowel `test-dnm-kern.mjs` (70/70) als `test-dnm-laadt.mjs`
(20/20) draaiden binnen de volledige suite schoon. Geen enkele
gameplay-constante in `defend-national-monument.html` aangeraakt — alleen
het nieuwe testbestand en de twee documenten.

### D3 — Documenten sorteren

Alle documentatie verhuisd naar `docs/<game>/`. De drie HTML-bestanden blijven
in de root omdat dat de live URL's van GitHub Pages zijn. Documenten die per
game bestaan kregen een achtervoegsel (`_undead` / `_monument`) zodat ze in een
editor-tab of zoekresultaat zonder pad uit elkaar te houden zijn; losse
rapporten die maar voor één game bestaan hielden hun kale naam.

Nieuw aangemaakt: `ARCHITECTURE_NOTES_monument.md` (uit de code gelezen, met
narekenbare maten en de bestaande invarianten) en dit bestand.

Daarna zijn beide monument-documenten volledig uitgewerkt tegen de code, zodat
de tickets uitvoerbaar zijn zonder dat er nog ontwerpwerk nodig is. Dat leverde
vijf correcties op het oorspronkelijke plan op:

1. **`window.DamChaosDebug` bestaat al** met ~30 exports. Het plan wilde bij D1
   een nieuwe `window.DefendDebug` maken. Nu: uitbreiden, naam blijft.
2. **De robotsnelheid was fout berekend.** `maakRobot` zet
   `snelheid: 1.4 + Math.random()`, maar `spawnRobot` overschrijft die
   onmiddellijk met `min(1,35 + rnd·0,7 + wave·0,07, 3,2) × 1,1 × typefactor` —
   een formule die **meeschaalt met de wave** en afvlakt op 3,52 m/s. Alle
   looptijdtabellen zijn hierop herrekend.
3. **De afstandstabel mat naar het middelpunt** van het monument, terwijl
   `afstandTotMonument()` naar de rand van `MONUMENT_BOX` meet — ~10 m
   verschil. Beide conventies staan nu naast elkaar.
4. **Negen `registreerRechthoek`-aanroepen, niet tien** (en negen
   `registreerObstakel`). De lijst met regelnummers staat in de
   architectuurnotities.
5. **`spelActief` in de gameloop checkt `spel.gameOver` niet.** Na game over
   blijft de loop draaien: je kunt schieten, munten oprapen en rondlopen. D7 en
   D9 zijn hierop aangescherpt.

Daarnaast vijf stukken dode code gevonden en gedocumenteerd (`ROBOT_AANTAL`,
`respawnLijst`, `vindDichtstbijzijndeInteractie`, `robot.pauze`, en de
overschreven `robot.snelheid`), plus een nieuw ticket **D0** voor het
opsplitsen van de testmap.

### D4 — Schaalfundament

De arena is 3× verkleind (`ARENA_SCHAAL = 1/3` op afstanden/voetafdrukken,
`GEBOUW_HOOGTE_SCHAAL = 0,6` op hoogtes, `MONUMENT_HOOGTE_SCHAAL = 0,8` op het
monument specifiek). `GRENS` gaat van 283×224 m naar 94,3×74,7 m.

**Belangrijkste bevinding, vóór er één regel code werd geschreven:** het
oorspronkelijke plan noemde als to-do-lijst "grondvlak, damPleinPunten, alle
bouwfuncties, plaatsGevelrij, straatmeubilair, railpad, zebrapaden" — dat bleek
overbodig. `wereld` (de gedeelde ouder-Group van letterlijk alle ~40
bouwfuncties, geverifieerd door alle 11 `scene.add()`-aanroepen in het bestand
na te lopen) hoeft maar **één regel** te krijgen —
`wereld.scale.set(ARENA_SCHAAL, GEBOUW_HOOGTE_SCHAAL, ARENA_SCHAAL)`, gezet
vóórdat er iets gebouwd wordt — en de hele zichtbare stad (positie, voetafdruk
én hoogte) schaalt in één keer mee, zonder dat er ook maar één hardgecodeerde
coördinaat in een bouwfunctie hoefde te veranderen. De volledige uitleg,
inclusief waarom dat werkt, staat in `ARCHITECTURE_NOTES_monument.md` §4.2.

**Wat wél met de hand moest, in drie categorieën:**
1. De negen `registreerRechthoek()`-aanroepen (kale getallen, geen
   wereldmatrix) — alle vijf argumenten (vier coördinaten + marge)
   × `ARENA_SCHAAL`.
2. De marge-parameter van alle acht `registreerObstakel()`-aanroepen (een
   vast bufferzone-getal dat niet door de wereldmatrix loopt).
3. De rijdende tram — de enige plek in het bestand die een `obstakels`-
   rechthoek rechtstreeks uit `g.position.x/z` (lokale coördinaten) bouwt,
   in plaats van via een van de twee registratiefuncties. `TRAM_HALF_X`/
   `TRAM_HALF_Z` schalen mee; `snelheid` en `zMin`/`zMax` blijven bewust
   ongewijzigd (lokale grootheden die tegen elkaar vergeleken worden, dus de
   rittijd in seconden blijft gelijk).

Het monument kreeg een **eigen, extra `g.scale.y`** bovenop `wereld`'s
hoogteschaal (`MONUMENT_HOOGTE_SCHAAL / GEBOUW_HOOGTE_SCHAAL`), zodat het
relatief hoger blijft dan de rest — precies zoals gepland, en narekenbaar:
22 m × 0,6 × (0,8/0,6) = 17,6 m, exact de doelwaarde uit het plan.

De schaduwcamera-frustum (±110 → ±36,7) schaalt mee voor een scherpere
schaduw op de kleinere kaart.

**Bijvangst: een latente bug uit D1 gevonden en gefixt.**
`window.DamChaosDebug` exporteerde nooit `renderer`, terwijl
`helpers-defend.mjs`'s `simuleerPointerLock`-optie die sinds D1 al aanriep —
een `TypeError` die nooit afging omdat geen enkele D1/D2-test die optie
gebruikte. Toegevoegd, nodig voor de verificatieschermafbeeldingen hieronder
en voor elke latere ticket die wél pointer lock nodig heeft.

**De verwachte, tijdelijke rode uitslag van D2 — met bewijs dat het geen
regressie is.** `test-dnm-kern.mjs` geeft na D4 13 FAILs: de vijf
spawnpoort-binnen-GRENS-checks, de zes interactiepunt-checks, en de
Kalverstraat-route (beide botsstraal-varianten). Oorzaak: `SPAWN_POORTEN` en
`interactiePunten` zijn D5-scope en staan dus nog op hun oude, ongeschaalde
coördinaten, terwijl `GRENS` nu al geschaald is — precies het venster dat
"nooit combineren" bewust openlaat tussen twee losse commits. Geverifieerd,
niet aangenomen: met de Kalverstraat-poort en zijn tussenpunt HANDMATIG
vooruitlopend geschaald (dus zoals D5 ze zal opleveren) bereikt de route het
monument gewoon in 263–265 stappen, exact in lijn met de andere vier poorten.
De vier andere "geslaagde" routechecks zijn op dit moment overigens ZELF ook
niet betrouwbaar — Damstraat "slaagt" nu in 9 stappen, een artefact van
toevallige overlap tussen de oude, nog ongeschaalde `MONUMENT_BOX` en de
nieuwe `GRENS`, niet een bewijs dat die route klopt. D5 lost dit in zijn
geheel op door `SPAWN_POORTEN`/`interactiePunten`/`MONUMENT_POSITIE`/
`MONUMENT_BOX`/de speler-startplek consistent te schalen.

**Visuele verificatie:** vier schermafbeeldingen genomen vanaf een punt bij
het (nieuwe, echte) monument, richting noord/oost/zuid/west. Geen
console-errors, geen z-fighting, geen gaten in de geometrie. De gebouwen
torenen nog duidelijk boven straatmeubilair (lantaarns, bankjes, de tram) —
geen "poppenhuis"-effect, precies het ontwerpdoel uit §3 van het plan.

**Verificatie:** `node run-all.mjs` (119 scripts, beide games): **118/119
groen**. De 13 fails zijn precies en uitsluitend de hierboven gediagnosticeerde,
verwachte D4/D5-venster-fails in `test-dnm-kern.mjs` (57/70) — geen enkele
andere. `test-dnm-laadt.mjs` blijft 20/20 (gebruikt geen `GRENS`-vergelijking,
dus geen last van het venster) en **alle 117 Amsterdam Undead-scripts blijven
ongewijzigd groen** — deze ticket raakte dat bestand op geen enkele manier.
Geen console-errors, geen syntaxfouten, geen onverwachte regressies.

### D5 — Spelsystemen herijken op de nieuwe schaal

Het D4/D5-venster is dicht. Elke gameplay-wereldcoördinaat die GEEN kind van
`wereld` is — en dus niet automatisch meeschaalde via `wereld.scale.set(...)`
(zie D4) — kreeg een handmatige `× ARENA_SCHAAL`, op de declaratieplek zelf
(dus als `42 * ARENA_SCHAAL`, niet als vooraf uitgerekende decimalen 14,00):
`MONUMENT_POSITIE`, `MONUMENT_BOX`, alle vijf `SPAWN_POORTEN` (positie +
spreidingX/Z + Kalverstraat's tussenpunt), de drie `interactiePunten`-posities,
`speler.positie` en `raycaster.far` (150 → 50, dezelfde verhouding
wapenbereik/kaartdiagonaal als vóór de herschaling, omdat de diagonaal van
`GRENS` door de uniforme x/z-schaling ook exact met `ARENA_SCHAAL` meeschaalt).

Alle uitkomsten kwamen exact overeen met de doelwaarden uit het plan —
narekenbaar, niet toevallig: MONUMENT_POSITIE (14,00, 0, −1,33),
MONUMENT_BOX halve maat ±3,57, speler-startplek (5,33, 0, 10,00), allemaal
geverifieerd rechtstreeks tegen de levende pagina, niet alleen berekend.

**Bewust NIET geschaald**, zoals het plan voorschreef: `interactiePunten[].
radius` (4 m, mensenmaat), de aankomstdrempel `0,6`, de robot-botsstraal
`0,45`/`speler.straal 0,4` (lichaamsmaten), `isVrijePlek`'s marge en de 2 m-
rand op `GRENS`, en (buiten D5's scope, D6 straks) muntwaarden, HP, schade,
wave-formules en robotsnelheid.

**Eén vondst tijdens het implementeren, niet in het plan genoemd:** de
"dichtbij genoeg"-afstand voor Kalverstraat's tussenpunt (`< 6` in
`updateRobots`) is met opzet ONgeschaald gelaten — geen stuk-risico (een
relatief grotere tolerantiezone maakt de aankomstcheck juist makkelijker),
maar wel iets voor D6 om op het gevoel te beoordelen. Zie
`ARCHITECTURE_NOTES_monument.md` §6.3.

**Verificatie:**
- `test-dnm-kern.mjs`: **70/70 groen** — inclusief alle vijf routechecks (nu
  voor het eerst op consistente, geschaalde coördinaten, dus voor het eerst
  ook echt betekenisvol) en de drie interactiepunt-bereikbaarheid/overlap-
  checks.
- Handmatige controle van de speler-startplek: `isVrijePlek(5,33, 10,00,
  0,4)` → `true`, binnen `GRENS` → `true` — het tweede deel van D5's eigen
  acceptatiecriterium, dat D2 niet apart test.
- `node run-all.mjs` (119 scripts, beide games): **118/119 groen**. De ene
  fail (`test-golf1-economie.mjs`, Amsterdam Undead) is een al eerder
  vastgestelde RNG-flake (1 van 5 camp-and-melee-trials stierf) — 3× schoon
  in isolatie herbevestigd, geen regressie en geen relatie met dit ticket.

Geen enkele gameplay-constante buiten de expliciet genoemde lijst aangeraakt.

### D6 — Meten en bijstellen

**Bevestigd, niet alleen berekend.** `tests/defend-national-monument/
meet-dnm-afstanden.mjs` (nieuw meetscript, geen `test-`-prefix, draait niet
in `run-all.mjs`) meet de looptijden rechtstreeks tegen de levende pagina.
Uitkomst: exact het probleem dat D4/D5 al voorspelden — Damrak (9,1s),
Rokin (8,9s) en Damstraat (6,7s) zakten bij het robot-snelheidsplafond onder
de reactiedrempel van 10s, terwijl Kalverstraat (11,5s) en Nieuwendijk
(11,7s) erboven bleven.

**Gekozen oplossing: optie 1 uit het plan (poorten naar buiten), gecombineerd
met een milde variant van optie 2 (plafondverlaging)** — precies de
voorkeur die het plan al aangaf. Reden om NIET puur optie 1 te gebruiken:
Damrak zat al binnen 2 m van `GRENS` op zijn oorspronkelijke bearing (verder
naar buiten op dezelfde lijn vanaf de oorsprong kwam bij een positie die zelf
niet eens `isVrijePlek()` was); pure herpositionering op de bestaande bearing
gaf voor alle drie hooguit 32-34 m, en zelfs op de meetkundig best haalbare
plek net onder de drempel (35,2 m is de ECHTE grens bij het oude plafond
3,2 — niet 35 m zoals het plan afrondde: `35,2 / 3,52 m/s = 10,0s` exact).

**Wat er precies veranderd is:**
- Drie poortposities verplaatst met een **bewuste laterale verschuiving**
  (niet puur radiaal vanaf de oorsprong) tot een geverifieerd veilige plek
  ruim voorbij 35 m: Damrak (0, −35,33) → (−4, −37,2), Rokin (0,67, 32,00) →
  (−6, 33,3), Damstraat (41,00, 1,33) → (53, 2). Elke nieuwe positie
  gecontroleerd — niet aangenomen — op `isVrijePlek() === true`, binnen de
  `GRENS`-marge, én een geslaagde route-simulatie (`test-dnm-kern.mjs`).
  Kalverstraat en Nieuwendijk ongewijzigd (al ruim boven de drempel).
- Het robot-snelheidsplafond in `spawnRobot()` (de bestaande
  `Math.min(..., 3.2)` in de basissnelheid-formule): 3,2 → 3,0 (effectief
  3,52 → 3,30 m/s). Een bewust milde 6,25%-verlaging — genoeg voor een echte
  marge (~0,6-0,7s boven de drempel i.p.v. 0,0-0,1s), niet zo veel dat de
  late-game-snelheidsspanning verdwijnt.

**Resultaat, opnieuw gemeten:** alle vijf poorten nu 10,7-12,5s bij het
plafond (was 6,7-11,7s), en wave 1 op 15,2-22,7s voor de dichtstbijzijnde
poort — precies binnen het ontwerpdoel van 15-25s. Steunpunt-retour vanaf
het monument: Kerkklok 10,9s, Reparatie 10,7s (doel 10-15s ✓), Bijenkorf
2,1s (blijft vlak bij het monument, zoals bedoeld). Speler-doorkruistijd:
13,5s (doel 10-15s ✓, ongewijzigd sinds D4/D5).

**Verificatie:**
- `meet-dnm-afstanden.mjs` opnieuw gedraaid: alle vijf poorten ✓, geen enkele
  meer onder de reactiedrempel.
- `test-dnm-kern.mjs`: **70/70 groen**, inclusief de route-simulatie vanaf de
  drie NIEUWE poortposities — bevestigt dat ze niet alleen "vrij" zijn maar
  ook daadwerkelijk een pad naar het monument hebben.
- Vier schermafbeeldingen vanaf de drie verplaatste poorten (richting het
  monument): open straatbeeld, geen clipping door gebouwen, geen visuele
  afwijkingen.
- Volledige suite (`node run-all.mjs`, 119 scripts, beide games): **119/119
  groen** — perfecte score, ook geen van de bekende flakes
  (`test-nachthemel.mjs`, `test-golf1-economie.mjs`) deze keer.

**Dit ticket is pas formeel af als de eigenaar het gespeeld heeft** (eigen
acceptatiecriterium uit het plan) — het bestand is na deze ronde gestuurd
om te spelen.

---

### Speeltest-feedback na D6

De eigenaar heeft gespeeld en drie punten teruggegeven: "opzich prima, maar
nog wat onoverzichtelijk door de vele decor dingen", "robots voelen nog net
iets te groot" (10-20% kleiner gevraagd), en "lastig te bepalen waar de
robots zijn en vandaan komen" (expliciet om opties gevraagd). Voor de laatste
twee punten is met `AskUserQuestion` de scope vastgesteld i.p.v. aangenomen:
robot-zichtbaarheid via **richtingspijlen aan de schermrand** én een
**simpele minimap** (beide gekozen, niet één van de twee), decor-overzicht
via **minder decor rond het strijdtoneel** specifiek (niet overal, niet een
andere optie uit het lijstje).

**Wat er veranderd is:**
- **Robots 15% kleiner** (binnen de gevraagde 10-20%-band): elke
  `schaal`-waarde in `ROBOT_TYPES` × 0,85 (was 1,0/0,85/1,4/1,05/1,0, nu
  0,85/0,7225/1,19/0,8925/0,85). Puur visueel — zie §6.4 in
  ARCHITECTURE_NOTES_monument.md: de botsstraal in `updateRobots()` is
  hardgecodeerd 0,45 en negeert `schaal`, dus de hitbox is ongewijzigd.
- **Decor rond het strijdtoneel uitgedund**: de paaltjesring om het monument
  in `bouwNationaalMonument()` van 20 naar 10 palen gehalveerd, en het
  fietsenrek dat op ~19 m van het monument stond (midden in het strijdtoneel)
  verwijderd.
- **Drie straatnaamborden verschoven** (Damrak/Rokin/Damstraat) zodat ze weer
  overeenkomen met de poortposities die D6 al verplaatste — dit was géén
  aparte "vandaan komen"-maatregel, maar het rechttrekken van een
  documentatie-mismatch die D6 per ongeluk had laten staan.
- **Richtingspijlen aan de schermrand**: vaste pool van 5 herbruikbare
  `.robotpijl`-divs (zelfde pooling-patroon als brokstukken), één per
  dichtstbijzijnde off-screen robot, gepositioneerd en geroteerd via
  `THREE.Vector3.project(camera)` → NDC-coördinaten, geklemd op een
  schermrand-marge, driehoekje wijst naar de robot.
- **Simpele minimap**: vast 2D-`<canvas>` rechtsonder, robots (rode stip),
  monument (gele stip) en speler (wit driehoekje, geroteerd op `speler.yaw`)
  lineair gemapt vanuit de `GRENS`-rechthoek naar canvas-pixels, elk frame
  herberekend zolang `spelActief`.
- **Bugfix tijdens het bouwen van bovenstaande, geen apart verzoek**: in
  `gameLoop()` liepen `tekenMinimap()`/`updateRichtingspijlen()` vóór
  `renderer.render()`, maar `updateSpeler(dt)` zet alleen
  `camera.position`/`camera.rotation` — de gecachte `matrixWorldInverse`
  waar `.project(camera)` op leunt wordt pas ververst tijdens `render()`.
  Zonder fix liepen pijlen/minimap dus altijd één frame (~16ms) achter op de
  camera-oriëntatie, merkbaar bij snel omkijken. Fix: expliciete
  `camera.updateMatrixWorld()` vlak vóór die twee aanroepen. Ontdekt via een
  functionele test die de projectie leek om te draaien; bleek eerst een
  testfout (geen `updateMatrixWorld()` na handmatig de camera verzetten in
  de test), maar bij het narekenen bleek de echte call-volgorde in
  `gameLoop()` hetzelfde euvel te hebben — dus wel degelijk een echte,
  zij het kleine, bug.

**Verificatie:** syntax-/laadcheck, `test-dnm-laadt.mjs` (20/20) en
`test-dnm-kern.mjs` (70/70) na elke deelstap, een losse functionele test van
`projecteerOpScherm()`/`tekenMinimap()`/`updateRichtingspijlen()` (robot
vlak voor de speler → op scherm, robot ver achter de speler → buiten
scherm, bevestigd via een echt gameLoop-frame i.p.v. handmatige state),
en de volledige regressiesuite (`node run-all.mjs`, beide games) na alle
deelstappen samen.

---

### D7 — Eindscherm met statistieken

Game over opent nu een eigen `#eindscherm` in de vormtaal van het
startscherm: bereikte wave, score, robots vernietigd (plus per type met
weergavenaam), trefferpercentage, verdiend geld, hoogste combo en
speelduur. `spel.gameOver` blijft de bron van waarheid; de nieuwe
`eindigRun()` zet hem en regelt de rest.

**Na game over valt álles stil.** `spelActief` in de game-loop is nu
`pointer lock && !spel.gameOver` (was: alleen pointer lock — munten werden na
game over nog opgeraapt en de speelduur liep door). Daarnaast los afgedekt:
`probeerTeSchieten()`, de T- en X-toets, lopen in `updateSpeler()`, en de
startscherm-klik (die anders stil de lock heraanvroeg en de dode run
hervatte). De pointerlockchange-handler toont na game over het eindscherm,
niet het pauzescherm — daarvoor zet `eindigRun()` `gameOver` bewust vóór
`exitPointerLock()`.

**Afwijking van de tickettekst:** het plan noemde `legMuntNeer()` als plek om
verdiend geld te tellen, maar daar wordt een munt alleen neergelegd — geld
komt pas binnen bij het oprapen, en ook via de wave- en perfect-bonus. Alle
drie de inkomstenbronnen lopen nu via één `verdienGeld(bedrag)`, zodat
`runStats.verdiendGeld` er geen kan missen. Speelduur telt alleen actieve
frames (pauze niet), treffers alleen schoten met effect (een schild-blok
telt niet).

**Verificatie:** `test-dnm-eindscherm.mjs` (26 checks) — met pointer lock
bewust nog gesimuleerd AAN na game over, zodat de gate zelf bewezen wordt en
niet het toevallig wegvallen van de lock. Mutatiecheck: met de
`!spel.gameOver` uit de game-loop gehaald faalt de test op precies de twee
verwachte punten (munt opgeraapt, speelduur loopt door).

### D8 — Highscore

Sleutel `defendNationalMonumentHighscore`, waarde `{ score, wave, datum }`.
Gekopieerd en aangepast van het Undead-patroon, met strengere vormvalidatie:
arrays (`typeof [] === 'object'`) en negatieve scores worden geweigerd, en
`leesHighscore()` geeft alleen de drie bekende velden terug — extra velden
worden genegeerd, een ongeldige wave of datum kost alleen dat veld, niet het
record. Op het eindscherm: "NIEUW RECORD!" of "Record: N (wave W)". Een
score van 0 is nooit een record.

**Verificatie:** `test-dnm-highscore.mjs` (25 checks): roundtrip, tien
corrupte vormen (o.a. niet-JSON, array, `null`, score als string, negatief,
`NaN` letterlijk én via `JSON.stringify`), een record dat een herlaadbeurt
overleeft, en een volledig geweigerde localStorage (getItem en setItem
gooien) waarbij game over gewoon werkt.

### D9 — Opnieuw spelen zonder verversen

Een "Opnieuw spelen"-knop op het eindscherm (plus een link terug naar het
menu). `resetRun()` zet **niet een handgeschreven lijst beginwaarden** terug,
maar een momentopname (`BEGINSTAAT`) van `spel`, `upgrades`,
`kerkklokBoost` en de speler, genomen bij het laden vóór `startWave(1)` —
een veld dat later aan `spel` wordt toegevoegd krijgt zo automatisch zijn
beginwaarde terug. Daarnaast: robots/munten/brokstukken leeg én uit de
scene, alle losse `let`-state (`geld`, `laatsteSchotTijd`, `terugslag`,
`vlamTimer`, `hitmarkerTimer`, `cameraShake`, `schietKnopIngedrukt`,
`huidigeInteractie`, `bijenkorfShopOpen`), en de zichtbare restanten (open
winkel, wapenterugslag, mondingsvuur, boost-banner).

De knop zet eerst het startscherm aan als vangnet en vraagt dan de pointer
lock: weigert de browser, dan staat de speler voor "klik om te spelen" en
niet voor een leeg scherm.

**Verificatie:** `test-dnm-reset.mjs` (12 checks): momentopname bij het
laden, een volledige run (60 frames spel, vijf snelheid-upgrades, boost,
kills, munten, schoten, monument kapot, game over), reset, en dan een
diepe vergelijking van élke geëxporteerde teller — inclusief het aantal
scene-kinderen, als vangnet voor objecten die wel uit de array maar niet uit
de scene gaan. Daarna echt weer spelen (robots spawnen, schieten telt). De
mutatiecheck (de `speler.snelheid`-reset weggehaald) wordt gevangen met een
leesbare melding: `speler.snelheid: 7 → 10.25`.

### D20 — Zichtbare schadestaten (naar voren gehaald)

Drie drempels (66 / 33 / 10 % HP), opgebouwd uit onderdelen die bij het
laden al gebouwd en verborgen worden:

| Tier | HP | Wat je ziet |
|---|---|---|
| 1 | ≤ 66 % | scheuren op twee zijvlakken van de pyloon, wat puin op de trede |
| 2 | ≤ 33 % | spits afgebroken (stomp + splinter), twee van de zes figuren weg, zwaardere scheuren, meer puin, rook, lichte scheefstand |
| 3 | ≤ 10 % | dikkere rook, meer scheefstand, knipperend rood alarmlicht op de top |

Zelfde patroon als `comboTier()`: een pure `monumentSchadeTier()` plus een
bewaarde vorige tier, zodat een overgang precies één keer per
grensoverschrijding vuurt. `pasMonumentSchadeToe(tier)` leidt de hele
zichtbare staat uit de tier af, dus herstel (Koninklijke Reparatie, reset)
schakelt vanzelf terug. Alleen verslechtering krijgt een melding, geluid en
camerashake.

Drie dingen die onderweg opvielen:
- **Zuil en spits zitten nu in een eigen `pyloon`-groep** met het draaipunt
  op de voet, zodat de scheefstand om de voet kantelt. Wereldposities zijn
  exact gelijk gebleven.
- **De raycaster van het wapen slaat onzichtbare objecten niet over.** Een
  verborgen stomp of rookwolk zou schoten tegenhouden. Verborgen onderdelen
  verliezen daarom hun raycast, en puur visuele delen (scheuren, rook,
  alarm) zijn nooit raakbaar. De test ving hier een echte bug: de scheuren
  kregen bij het zichtbaar worden hun raycast terug.
- **Geen `PointLight` voor het alarm**: een lichtbron die aan/uit gaat laat
  Three.js alle materialen hercompileren, precies op het spannendste moment.
  Een onverlicht rood bolletje met een gloedschil leest net zo goed. De
  gloed gebruikt gewone transparantie, want additieve menging kleurde tegen
  de lichte lucht bijna wit.

**Verificatie:** `test-dnm-monument-schade.mjs` (25 checks): de tier-functie
op en rond elke grens, de zichtbare staat per tier, overgangen bij heen-en-
weer over 66 % (zes grensoverschrijdingen = zes overgangen, meldingen alleen
bij verslechtering), de echte bronnen (robottreffer en Koninklijke
Reparatie), raakbaarheid van verborgen en effectonderdelen, en dat rook en
alarm echt animeren. `test-dnm-reset.mjs` controleert ook de monumentstaat.
Schermafbeeldingen van alle vier de tiers vanaf het plein gecontroleerd.

### D28 — Aangekondigde poorten (nieuw na de review)

Elke wave komt uit één poort (wave 1–2) of twee (vanaf wave 3), nooit exact
dezelfde set als de vorige wave. De set voor wave N+1 ligt vast zodra wave N
compleet is, zodat de pauze gebruikt kan worden om te positioneren en te
bouwen. De aankondiging heeft vier lagen:
- een banner na de "gehaald"-banner (frame-gestuurd, geen `setTimeout` dat
  een reset kan overleven);
- een tweede regel in `waveUI` die de hele wave blijft staan;
- een oranje lichtbaken per poort, 42 m hoog, dat boven de daken uitsteekt;
- een ring op de minimap.

**Onderweg gevonden:** de oude regel "Robots komen uit: …" stond in `shopUI`,
en was dus alleen zichtbaar met de winkel open. Hij versprong bovendien bij
elke spawn naar een andere poort. De poortinformatie staat nu in `waveUI`.
De bakens zijn na een eerste screenshot breder en verzadigder gemaakt: tegen
de lichte lucht vervaagde transparant oranje tot een flets streepje.

**Verificatie:** `test-dnm-poorten.mjs` (17 checks): 300 lotingen per
poortaantal, echte spawns alleen bij de actieve poort, 8 opeenvolgende waves
(aankondiging = gestarte set, bakens, HUD, bannertiming), bakens nooit
raakbaar, reset.

### D29 — Wapenbereik beperken (nieuw na de review)

**Eerst gemeten** (`meet-dnm-afstanden.mjs` uitgebreid). Vanaf de monumentrand:
- bouwplek op 55 %: 13–17 m;
- bouwplek op 25 %: 25–31 m;
- poort: 35–41 m.

Het plan noemde ~25 m als startpunt, maar dat viel voor drie poorten precies
op de verre bouwplek (25,2–25,7 m). **Gekozen: 22 m** (`WAPEN_BEREIK`, was
50 m). Vanaf het monument raak je nu de binnenste helft van elke corridor,
niet de poort. Bij het robot-snelheidsplafond blijft er ~6,7 s vuurvenster.

Het schot is pure hitscan zonder spoor, dus een schot dat tekort kwam, zag
eruit als een misser. Nu verschijnt op 22 m een klein stofwolkje, maar alleen
als er verderop écht iets in de schotlijn staat (een tweede raycast met
groter bereik). Schieten in de lucht toont niets.

**Verificatie:** `test-dnm-wapenbereik.mjs` (10 checks): zoekt eerst een vrije
schietrichting van 30 m (zodat een toevallige muur de test niet vervalst),
dan robot op 20 m geraakt, op 24 m niet (en stofwolkje), lucht geen effect,
`raycaster.far` na het controleschot hersteld.

### D10 — Bouwplekken

Tien plekken, twee per poort, op 25 % en 55 % van de route.

**Afwijking: "de route" is de gesimuleerde looproute, niet de rechte lijn.**
Bij Rokin en Nieuwendijk loopt de rechte lijn poort → monument dwars door
gebouwen; robots glijden daar langs de gevels. `looproute(poort)` simuleert de
route bij het laden met dezelfde regels als de robot-AI (en als
`test-dnm-kern.mjs`). Bij de Nieuwendijk lopen robots tussen ~16 % en ~38 %
door een steeg van ~1,5 m breed waar geen tegel past. Daarom schuift de
zoektocht langs de route (tot ±15 %, plek 1 richting de poort, plek 2 richting
het monument).

**Afwijking in de acceptatie:** "elke plek ligt dichter bij zijn eigen poort
dan bij elke andere" is meetkundig onhaalbaar. De Kalverstraat-plek op 55 %
ligt ~1 m dichter bij de Rokin-POORT, maar ruim 10 m van de Rokin-ROUTE.
Getoetst is daarom: dichter bij de eigen route dan bij elke andere route.

`test-dnm-kern.mjs` telt nu 13 interactiepunten (3 steunpunten + 10
bouwplekken). De overlap- en bereikbaarheidschecks van D2 gelden dus voor alle
13. **Verificatie:** `test-dnm-bouwplekken.mjs` (44 checks).

### D11 — De geschuttoren

Bouwmenu op een lege bouwplek (T, dan 1), zelfde patroon als de
Bijenkorf-winkel. De toren zoekt het dichtstbijzijnde doel binnen bereik,
draait zijn kop mee en vuurt met een kort schotspoor (één herbruikbare lijn
per toren). Een actief schild blokkeert ook torenschoten. De toren
registreert één obstakel.

- **`registreerRechthoek()` geeft nu een handle terug**, en
  `verwijderObstakel(handle)` haalt precies dát obstakel weg. Dat is de door
  het plan (D13) voorgeschreven aanpak, al in D11 nodig voor verkopen en
  vernietigen.
- **`raakRobot(robot, schade = 1, bron = 'speler')`**: de standaardwaarden
  laten het spelerswapen exact zoals het was.
- **Een torenkill (`bron = 'toren'`)** laat een munt achter en geeft +100
  score, maar bouwt géén combo en géén special-meter op: die belonen wat de
  speler zelf doet. Het eindscherm toont "(N door torens)" en het aantal
  gebouwde torens.

**Verificatie:** `test-dnm-toren-geschut.mjs` (19 checks).
`test-dnm-reset.mjs` bouwt nu ook een schietende toren in zijn run, zodat
torenmodellen, schotsporen en obstakels op lekken gecontroleerd worden.

### D15 — Bouwfase tussen waves (naar voren, direct na D11)

De pauze tussen waves is van 4,5 s naar 20 s gegaan, met een aftelling in de
HUD. Met G start je de volgende wave vroeg, voor €2 per overgeslagen seconde.
In de bouwfase spawnt niets. De verste bouwplek ligt ~33 m van het monument:
heen en terug is dat ~9,5 s op 7 m/s, dus 20 s is genoeg. De aftelling ververst
alleen als de hele seconde verandert, omdat `updateArcadeUI` ook de winkel
opnieuw opbouwt.

**Verificatie:** `test-dnm-bouwfase.mjs` (12 checks). `test-dnm-poorten.mjs`
is aangepast op de langere pauze.

### D12 — Torenniveaus en reparatie

Drie niveaus. Elk niveau verbetert iets anders (bereik, tempo, schade) en is
zichtbaar aan gouden ringen om de zuil. T op een bezette plek geeft drie
opties:
- **1, upgraden:** houdt de opgelopen schade;
- **2, repareren:** €1 per ontbrekende HP;
- **3, verkopen:** levert de helft van de investering op (bouwen +
  upgrades, geen reparaties).

**Verificatie:** `test-dnm-toren-niveaus.mjs` (21 checks).

### D13 — Het hek

Een rij paaltjes loodrecht op de looproute, door het routepunt naast de
bouwplek: van 3,5 m aan de overkant tot 1 m voorbij de bouwplek. Paaltjes zijn
0,6 m breed met 0,3 m tussenruimte, te smal voor een robot (0,9 m). **Elk
paaltje is een eigen obstakel**: `obstakels` kent alleen assen-uitgelijnde
rechthoeken, en een schuin hek dwars over een diagonale route is dat niet.

Robots die het hek raken, blijven staan en slaan erop, 6–15 schade per 0,8 s
per type. Ze slaan daarbij de vastloop-detectie over, anders zouden ze na
1,5 s zijwaarts uitwijken en om het hek heen lopen. Sneuvelt het hek, dan gaan
model en alle paal-obstakels weg en komt de plek vrij. Torens en hekken hebben
sinds D13 een HP-balk die alleen bij schade zichtbaar is.

**Verificatie:** `test-dnm-hek.mjs` (46 checks). Op **alle tien** de
bouwplekken loopt een echte robot de echte route: hij stopt bij het hek, het
hek verliest HP, het sneuvelt en ruimt op, en de robot loopt door naar het
monument. Geen enkele corridor waar robots om het hek heen glippen.

### D14 — Robots vallen torens aan

De bomber kiest het dichtstbijzijnde bouwwerk (toren of hek) binnen 10 m als
doel en ontploft daar voor 45 schade. Een toren van niveau 1 overleeft er
één, niet twee. Het doel wordt elke frame opnieuw gekozen, dus sneuvelt het
bouwwerk onderweg, dan loopt de bomber gewoon door naar het monument. Andere
types laten torens met rust. **Volgorde in de robot-AI:** monument →
bomberdoel → hek slaan → lopen.

**Verificatie:** `test-dnm-toren-aanval.mjs` (7 checks).

### D16 — Economie herijken (gemeten en bijgesteld; wacht op speeltest)

`meet-dnm-economie.mjs` meet twee dingen:
- **Inkomsten per wave**, uit de spelformules zelf.
- **Welke verdediging een wave zónder speler houdt.** Het script simuleert elke
  wave echt en probeert oplopende configuraties per actieve poort.

**Eerste meting (plan-startwaarden):**
- **Torens veel te sterk.** Eén toren van niveau 1 per actieve poort hield
  waves 1–9 alleen, zonder speler.
- **Geld te ruim.** Na wave 5 had je €1.728, genoeg voor 3,2 volledig
  uitgeruste poorten, terwijl het doel er één is.

**Bijgesteld, in twee meetrondes:**

| Wat | Was | Nu |
|---|---|---|
| Munt (basis) | €5–25 | €2–10 |
| Wave-bonus | 40 + 15·wave | 25 + 10·wave |
| Geschuttoren niv. 1/2/3 | €120/150/250 · 12/14/16 m · 0,8/0,6/0,6 s | €150/200/300 · 10/12/14 m · 1,2/1,0/1,0 s |
| Hek niv. 1/2/3 | €80/80/120 | €100/100/150 |

**Resultaat:**
- **Inkomsten:** na wave 5 €800 in het basisscenario (1,1 poort, het doel). Een
  goed spelende speler heeft €1.330 (1,9 poort).
- **Torens zonder speler:** één toren houdt het nog in de vroege waves (1–4
  en 6), toren + hek tot wave ~7, daarna wordt het snel duur. Vanaf wave 15
  houdt geen enkele configuratie het alleen: dan moet de speler zelf vechten.

De torentests (D11/D12/D13) lezen hun verwachte waarden sindsdien uit
`TOREN_TYPES`. Ze toetsen de regels, niet de balans van dit moment, en
overleven dus een volgende bijstelling.

**Open voor de speeltest:** met één toren per poort kun je de vroege waves
misschien té makkelijk wegzetten. De actieve poorten wisselen per wave, dus
dat vraagt torens bij álle vijf poorten (5 × €150), maar dat is rond wave 5–6
betaalbaar. Dit is een vraag voor het beslismoment na fase 3, niet iets om
zonder speeltest verder bij te stellen.

### D30 — Themagolven (nieuw na de review)

Elke 4e wave vanaf wave 6 (6, 10, 14, …) krijgt een thema, in vaste
roulatie:
- **Tankkonvooi:** alleen tanks, half zoveel, via één poort.
- **Spitsuur:** alleen sprinters, 1,3× zoveel, via één poort.
- **Grachtenmist:** normale mix, maar de mist trekt dicht tot ~38 m zicht.

Een themagolf geeft 1,5× wave-bonus, een eigen banner en een aankondiging met
de themanaam. **Afwijking:** start bij wave 6, niet bij 4 zoals het plan zei.
Waves 2–5 introduceren elk een nieuw robottype (wave 4 = de bomber), en een
tank-themagolf zou die introductie overschrijven.

De mist wordt elke wave opnieuw gezet uit `MIST_BASIS` (vastgelegd na het
bouwen van de wereld) of het thema. Een tijdelijke staat wordt dus nooit
"teruggezet" (architectuurregel 6).

**Verificatie:** `test-dnm-themagolven.mjs` (13 checks). `test-dnm-kern.mjs`
en `test-dnm-poorten.mjs` houden rekening met themagolven via
`themaVoorWave()` / `aantalPoortenVoorWave()`.

---

## Openstaande verbeteringen uit de bevroren periode

Deze drie punten stonden in `ROADMAP_undead.md` genoteerd toen deze game
bevroren was. Ze zijn hier nu opgenomen en alle drie door het plan gedekt:

- **Performance verbeteren** → D21 (kwaliteitsinstellingen)
- **Wave balancing testen** → D2, D6, D16
- **Game over en restart flow verbeteren** → D7, D8, D9

---

## Regels

- Werk aan één game tegelijk en schrijf in de documenten van díe game
  (zie CLAUDE.md).
- Geen gedeelde engine, geen gedeelde JS/CSS met Amsterdam Undead. Hergebruik
  gaat via kopiëren en aanpassen.
- Elke game blijft single-file; geen externe assets.
- Elke stap eerst testen (headless + handmatig) voordat die naar `main` gaat.
- Nieuwe tests krijgen het voorvoegsel `test-dnm-`.
- D4 raakt uitsluitend geometrie, D5 uitsluitend spelsystemen. Nooit
  combineren in één commit — zie het plan voor waarom.
