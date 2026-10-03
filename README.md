# Amsterdam Arcade 🏛️🧟

Een klein browsergame-portaal met twee 3D arcade-games in de browser, beide
op de achtergrond in Amsterdam.

## Bestandsstructuur

| Bestand | Wat |
| --- | --- |
| `index.html` | Hoofdmenu met de twee games |
| `defend-national-monument.html` | **Defend National Monument** — verdedig het Nationaal Monument tegen golven robots (voorheen `index.html`) |
| `amsterdam-undead.html` | **Amsterdam Undead** — first-person undead wave-survival in een Amsterdams grachtenpand |
| `docs/amsterdam-undead/` | Alle documentatie van Amsterdam Undead (roadmap, architectuur, uitvoeringsplan, rapporten) |
| `docs/defend-national-monument/` | Alle documentatie van Defend National Monument |
| `tests/` | Headless Playwright-regressiesuite |

## Spelen

Open `index.html` in een moderne browser (Chrome, Firefox, Edge, Safari) en
kies een game — er is geen build-stap nodig. Elke game is één zelfstandig
HTML-bestand en kan ook direct als static site gehost worden (bijvoorbeeld
via GitHub Pages).

> Let op: er is een internetverbinding nodig, omdat Three.js vanaf een CDN
> wordt geladen.

### Lokaal testen (macOS)

```bash
cd /pad/naar/GTA-amsterdam
python3 -m http.server 8000
```

Open daarna `http://localhost:8000/` in de browser. Rechtstreeks dubbelklikken
op een `.html`-bestand werkt meestal ook, zolang er internet is voor de CDN.

## Defend National Monument

Verdedig het Nationaal Monument op de Dam in Amsterdam tegen robots die uit
de omliggende straten komen. Overleef 20 waves en versla vier bazen, dan is
de Dam gered. Daarna kun je eindeloos doorspelen voor je highscore.
Bestand: `defend-national-monument.html`. Gebruik de "← Menu"-knop
rechtsboven om terug te gaan naar het hoofdmenu.

### Besturing

| Actie | Toets |
| --- | --- |
| Lopen | `W` `A` `S` `D` |
| Rondkijken | Muis (klik eerst in het spel) |
| Schieten | Linkermuisknop (ingedrukt houden = doorvuren) |
| Kiezen in een menu | `1`–`6` (het menu opent vanzelf bij een bouwplek of de commandopost) |
| Menu sluiten / Kerkklok luiden | `T` |
| Volgende wave meteen starten | `G` (in de pauze tussen twee waves, met een kleine bonus) |
| Klokslag (special) | `X` (als de meter vol is): robots om je heen lopen even veel trager, je wapen blijft koel |
| Pauze en instellingen | `Esc` |

### Op je telefoon of tablet

Speel liggend. Een tik op het startscherm zet de touchbediening aan:

| Actie | Touch |
| --- | --- |
| Lopen | Linkerduim: de stick verschijnt waar je duim landt |
| Rondkijken | Rechterduim vegen |
| Schieten | **VUUR** vasthouden; vegen vanaf de knop richt tegelijk |
| Bouwen, upgraden, kopen | Tik een regel in het menu (opent vanzelf bij een bouwplek of de commandopost) |
| Menu openen/sluiten, Kerkklok | De actieknop boven VUUR (zegt wat hij nu doet) |
| Klokslag | 🔔 (als de meter in de knop vol is) |
| Volgende wave eerder | ▶ Volgende (in de pauze tussen twee waves) |
| Pauze | ⏸ linksonder |

- **Richthulp:** op touch telt een schot dat net naast een robot gaat toch,
  en het richtkruis kleeft een beetje aan een robot. Met de muis niet.
- **iPhone:** Safari kan geen volledig scherm maken. Tik op deel ⬆︎ en kies
  **Zet op beginscherm**; vanaf daar start de game zonder adresbalk.
- **Geen geluid?** Op een iPhone dempt de stille modus (het schakelaartje
  opzij) ook het geluid van de game.
- Staand houden pauzeert het spel en vraagt je te draaien.
- **Beeldkwaliteit** staat ook op een telefoon standaard op Hoog. Hapert
  het, kies dan Normaal of Laag op het startscherm; die keuze wordt onthouden.

### Zo speel je

- **Robots** lopen over vaste routes door vijf straten (Damrak, Rokin,
  Damstraat, Kalverstraat en Nieuwendijk) naar het monument. Een lichtbaken
  en een oplichtend spoor laten zien waar de volgende wave vandaan komt.
  Haalt een robot het monument, dan kost dat monument-HP; bij 0% is het game
  over. Vanaf wave 11 komen ze uit drie straten tegelijk.
- **Elite-robots** komen na de eerste baas: de **Pantserbot** (torens doen
  maar een derde van hun schade, dus schiet hem zelf) en de **Splitser**
  (valt bij zijn dood uiteen in twee snelle splinters).
- **Torens** bouw je op de gouden cirkels langs de straten, ook tijdens een
  wave:
  - de **Geschuttoren** schiet een zware kogel en pakt de taaiste robot:
    goed tegen tanks;
  - de **Bovenleiding** geeft een stroomstoot die overspringt naar een
    groepje robots: goed tegen zwermen;
  - het **Hek** blokkeert de straat.

  Op niveau 3 kies je een richting (bijvoorbeeld Kanon of Scherpschutter).
- **Munten** laten robots achter; raap ze op. Bij de **commandopost** aan de
  voet van het monument koop je upgrades (vuurtempo,
  loopsnelheid, koeling, en voor later in de run zware kogels) en repareer
  je het monument. Een **drukpers** voor
  het Paleis levert vast geld op.
- **De Kerkklok** bij de Nieuwe Kerk (`T`): 30 seconden dubbel geld, maar
  de robots lopen dan ook sneller. Een gok, geen gratis bonus.
- **Oververhitting:** lang doorvuren maakt het wapen te heet. De meter onder
  het richtkruis laat zien hoe ver je bent; laat even los om af te koelen.
- **Bazen** komen op wave 5 (de Sloopkogel), 10 (de Dijkbreker), 15 (de
  Stoomwals) en 20 (de Heimachine, die torens in de buurt stillegt). Elke baas vraagt een eigen aanpak; de aankondiging geeft een
  tip.
- **Sterren:** win je de run, dan krijg je 1 tot 3 sterren, naar de schade
  die het monument in de hele run opliep (3 sterren bij hooguit 10%;
  repareren telt niet mee). Met sterren en
  verslagen bazen speel je nieuwe torenrichtingen, de moeilijkheid Zwaar en
  een avondsfeer vrij.
- **Instellingen** op het startscherm (ook met `Esc`): beeldkwaliteit,
  muisgevoeligheid, volume en camera-schok. In het ontgrendelpaneel kun je
  je voortgang wissen (met bevestiging).

### Herkenbare Dam

Een gestileerde versie van het plein op mensmaat: het Paleis op de Dam, de
Nieuwe Kerk, het Nationaal Monument, De Bijenkorf, Hotel Krasnapolsky, Hotel
TwentySeven en Madame Tussauds, rijen grachtenpanden met trap-, hals-,
lijst- en tuitgevels langs de vijf straten, tramrails met een tramhalte,
Amsterdammertjes, lantaarns, fietsenrekken, duiven en toeristen.

## Amsterdam Undead

Een first-person undead wave-survival in een verlaten Amsterdams grachtenpand.
Bestand: `amsterdam-undead.html`. Gebruik de "← Menu"-knop linksboven om terug
te gaan naar het hoofdmenu.

### Besturing

Het spel merkt zelf of je met een muis of met je vingers speelt — dat gebeurt
op de eerste aanraking, niet op basis van wat voor apparaat je hebt. De uitleg
op het startscherm en de hintbalk onderin passen zich daar meteen op aan, dus
je hoeft niets in te stellen.

| Actie | Toetsenbord + muis | Aanraakscherm |
| --- | --- | --- |
| Lopen | `W` `A` `S` `D` | Duim op de linkerhelft — de stick verschijnt waar je hem neerzet, en half duwen is half zo snel |
| Rondkijken | Muis (klik eerst in het spel) | Slepen op de rechterhelft |
| Schieten | Linkermuisknop | De ronde **VUUR**-knop rechtsonder |
| Herladen | `R` | De ⚡-knop, als er niets anders te doen is |
| Kopen / gebruiken | `T` (bij de deur, ammo-kist, upgradepunt of wandkooppunt) | Dezelfde ⚡-knop: hij toont wat er op die plek te doen is |
| Steken | `V` | 🔪 |
| Wissel van wapen | `Q` (pas nadat De Ratelaar gekocht is) | 🔄 |
| Pauze | `Esc` | ⏸ linksboven |

Een knop die op dat moment niets kan doen — geen twee wapens om tussen te
wisselen, een vol magazijn — grijst uit en blijft op zijn plek staan, zodat je
nooit misgrijpt omdat er een knop verschoven is.

### Gameplay

- **Kies een moeilijkheidsgraad** op het startscherm voordat je begint:
  **Toerist** (makkelijker: minder budget per golf, snellere regen, meer
  startgeld), **Amsterdammer** (standaard) of **Nachtwacht** (zwaarder
  budget en regen, maar een hogere score-multiplier). De keuze is verplicht
  en staat de hele run vast.
- Overleef doorlopende **golven ondoden** die de ramen barricaderen en
  op je afkomen. Ze worden trapsgewijs taaier (1 HP in golf 1-4, 2 vanaf
  golf 5, 3 vanaf golf 11, maximaal 4 vanaf golf 16); elke golf brengt meer **dreiging** — niet per se méér
  ondoden, maar zwaardere samenstellingen — en elke ontgrendelde zone
  verhoogt de spawndruk (sneller + meer gelijktijdig).
- **Drie varianten** mengen zich vanaf een bepaalde golf door de gewone
  ondoden heen: de **Loper** (golf 2+, snel maar breekbaar, weinig geld),
  de **Sjouwer** (golf 3+, traag maar erg taai, veel geld) en de
  **Brander** (golf 4+, normale stats, maar ontploft bij overlijden — schade
  aan jou én aan andere ondoden in de buurt, inclusief kettingreacties).
  Elke ondode heeft ook een eigen, puur cosmetisch tikje: sommigen
  strompelen, slepen een been, lopen krom of hebben een net iets andere
  lengte/armlengte, zodat een golf niet uit identieke kloontjes bestaat.
- **Barricades:** elk venster heeft 3 planken. Een ondode moet ze eerst stuk
  beuken voordat hij naar binnen kan — dat kost 'm tijd. Sta je dichtbij een
  beschadigd venster, dan kun je met `T` een plank herstellen: dat levert
  meteen €20 op, maar maakt je wel even kwetsbaar.
- **Trefzones tellen:** een lichaamstreffer doet 1 schade, een **headshot**
  het dubbele — én een dodelijke headshot levert 2x zoveel geld op als een
  gewone kill. Je startwapen (de Drukspuit) heeft een magazijn van 8 kogels
  (reserve 48); `R` herlaadt in 1,2 s (0,7 s na de Snelheidselixer).
- Kom je te dicht bij een ondode, dan slaat 'ie (15 schade). Je HP (100,
  of 200 met Pantserdrank) regenereert vanzelf na een paar seconden zonder
  klappen; een rode schermrand waarschuwt bij schade. Op 0 HP is het
  **game over** (klik "Opnieuw beginnen" om te herstarten).
- Je verdient **geld** per treffer en per kill. Na elke golf krijg je een
  **"Wave cleared"**-bonus (die oploopt met het golfnummer) en heel je
  automatisch aan tot minimaal 60 HP — de rustpauze tussen golven duurt
  8 seconden, genoeg om te repareren, te kopen en op adem te komen.
- **Power-ups:** een dodelijke treffer laat soms een gloeiend, zwevend
  kristal vallen — loop erover heen om 'm meteen te gebruiken (geen `T`
  nodig, dit moet snel gaan). Vier effecten: **Munitievoorraad** (vult al
  je wapens volledig aan), **Dubbele Beloning** (tijdelijk 2x geld per
  hit/kill), **Eliminatiemodus** (tijdelijk doodt elke treffer de ondode
  meteen) en **Kerninslag** (doodt alle levende ondoden nu meteen + geld
  per stuk). Raap je 'm niet binnen 12 seconden op, dan verdwijnt-ie weer.
- **Eventgolven:** elke 5e golf is anders. Een **Mistgolf** trekt dikke mist
  door het pand en laat alleen **Sluipers** spawnen (snel, licht, maar met
  goed zichtbare gloeiende ogen). Een **Stroomuitval** dooft juist alle
  binnenverlichting — je ziet alleen nog de gloeiende ogen van de ondoden en
  het licht van buiten — en spawnt een mix van normale ondoden, Lopers en
  Sluipers. Beide types wisselen elkaar deterministisch af.
- **Score en record:** elke run bouwt statistieken op (kills, headshots,
  schoten, geld verdiend, powerups) en eindigt in een score, geschaald met
  je moeilijkheidsgraad. Je beste run wordt lokaal onthouden en getoond op
  het startscherm.
- **De Vluchtroute en De Ontsnapping:** verspreid over drie zones liggen een
  **Roeispaan**, een **Touwbundel** en een **Scheepslantaarn**, elk pas
  zichtbaar (en oppakbaar) vanaf een eigen golf. Heb je alle drie
  verzameld én genoeg geld (€2500), dan verschijnt **De Ontsnapping** — haal
  'm om de run succesvol af te sluiten met een scorebonus.

### Vijf zones in een lus, elk met een eigen doel

Het huis is een rondlopende route: woonkamer → gang → atelier → binnenplaats
→ kelderhals/bijkeuken → **terugdeur**, terug naar de woonkamer. Je kunt de
lus dus in beide richtingen bewandelen — vooruit via de gewone koopdeuren,
of achteruit vanuit de bijkeuken zodra je de terugdeur hebt opengemaakt.

1. **De woonkamer** (start) — warm, veilig, leert je de basis. Ammo-kist
   (€300, +48 reserve-munitie) en het eerste upgradepunt (€500, schade +1,
   daarna MAX).
2. **De gang** — een smal, donker, kaal knelpunt tussen de woonkamer en het
   atelier; puur doorgang, geen interacties.
3. **Het schildersatelier** (achter deur 1, €500) — een grote, L-vormige
   ruimte met koel daglicht via vier dakramen, een schildersezel als
   landmark, een voorraadnis met een eigen invalshoek en de **Werkbank**
   (eenmalige Snelheidselixer, €600, herlaadtijd 1,2s → 0,7s).
   In de westmuur van de voorraadnis zit een tweede koopbare deur:
   **deur 5** (€900). Daarachter daalt een verlichte trap van tien treden
   af naar **de kelder** — het eerste stukje echte verticaliteit in het
   spel, en de enige plek waar je omhoog of omlaag kunt. De kelder zelf
   is een compacte, lage gewelfkelder (kleiner dan het atelier, met een
   even hoog plafond, en merkbaar donkerder dan de woonkamer waar je
   begint), met een wijnrek en een kratten-/vatstapel als decor. Zombies
   kunnen er niet spawnen en komen niet vanuit een spawn-venster
   binnen, maar zodra je de trap af bent, volgt gewoon elke zombie die
   op je jaagt je naar beneden — geen restrictie, geen veilige hoek. De
   kelder is ook de plek van **Pantserdrank** (€1000, eenmalig,
   verdubbelt je maximale HP naar 200). Vroeg in het spel is dit een
   echte keuze naast deur 2: eerst de binnenplaats openen, of eerst de
   kelder?
4. **De binnenplaats** (achter deur 2, €1000, vanuit het atelier) — een
   grote, open buitenruimte, verlicht door vier lantaarnpalen en sterk
   maanlicht op natte klinkers, met gevels/nepdoorgangen/balkonnetjes tegen
   de muren, een schuurtje en een kratten-stapel als tactische obstakels.
   De **Watertap** is herbruikbaar (€200 → +50 HP, gecapt op je max), en
   tegen de oostmuur staat het wandkooppunt van **De Ratelaar** (€750): een
   tweede, snellere wapen met zo'n dubbele munitiecapaciteit t.o.v. de
   Drukspuit. Wissel met `Q` tussen beide wapens; elk houdt zijn eigen
   magazijn en reservemunitie bij.
5. **De kelderhals en de bijkeuken** (achter deur 3, €1200, vanuit de
   binnenplaats) — een smalle, kale kelderhals met een kaal flikkerpeertje
   (dezelfde sfeer als de gang) die uitkomt in de bijkeuken: een oude
   achterkeuken met een eigen spawn-venster ("de steegdeur") en de
   **Provisiekast** (€350, herbruikbaar, +48 reserve-munitie — een tweede
   ammo-kist zodat je niet steeds helemaal terug naar de woonkamer hoeft) en,
   tegen de zuidwand, de **Smederij** (€3000, per wapen, late-game
   schade-upgrade) — samen maken ze de bijkeuken je late-game anker.
   Vanuit de bijkeuken opent de **terugdeur** (€800) een directe kortere
   weg naar de woonkamer — ontgrendelt zelf geen nieuwe zone, maar sluit de
   lus: ondoden vinden je voortaan via de kortste kant, ook al kom je de
   andere kant op.

### Sfeer & techniek

Warme flikkerende lampen in de woonkamer, een kaal koud-groen gangetje, koel
daglicht in het atelier en blauw maanlicht op de binnenplaats geven elke zone
een eigen identiteit. Binnenhuis-mist en decoratieve meubels (bewust zonder
collision, zodat de pathing er niet op vasthaakt) maken het pand levendig
zonder de gameplay te verstoren. Betreed je een zone voor het eerst, dan zie
je kort de naam van die zone in beeld; een klein label in de HUD houdt
bovendien altijd bij waar je nu bent. Onder de actie door speelt een zachte
drone zodra er 2 of meer ondoden vlak bij je staan (binnen anderhalve
meter) — een subtiel signaal dat het dringen wordt. Net als
de andere game draait alles in één zelfstandig
HTML-bestand met Three.js via CDN, botsingen via rechthoek-obstakels, en
live gegenereerde Web Audio-geluiden (geen audiobestanden). De meubels zijn
puur decor en hebben géén collision, zodat de pathing er niet op vasthaakt.
Een subtiele post-processing-laag (bloom) laat lantaarns, winkelaccenten
en ogen in het donker zachtjes gloeien; steen/hout/metaal-oppervlakken
hebben een beetje procedureel getekende materiaaldiepte i.p.v. vlakke
kleur — beide 100% Three.js/canvas, zonder externe afbeeldingen. De
koppen van de ondoden en de wapenmodellen zijn vloeiender afgerond
i.p.v. hoekig-blokkerig, zonder dat dit ook maar iets aan de
speelbepalende hitboxen verandert.



### Zelf experimenteren

Open de browserconsole (F12) en speel met `AmsterdamUndeadDebug`, bijvoorbeeld:

```js
AmsterdamUndeadDebug.spawnWillekeurigeOndode();  // spawn een ondode
AmsterdamUndeadDebug.startGolf();                 // start direct een nieuwe golf
AmsterdamUndeadDebug.spelStaat;                   // golf, geld, gameOver
AmsterdamUndeadDebug.spelerStaat;                 // speler-HP
AmsterdamUndeadDebug.wapenStaat;                  // magazijn / reserve / herladen
AmsterdamUndeadDebug.spawnOndode(0, 'sjouwer');   // spawn een specifieke variant (loper/sjouwer/brander)
AmsterdamUndeadDebug.geefKerninslag();            // trigger een power-up-effect direct
AmsterdamUndeadDebug.kiesMoeilijkheid('nachtwacht');   // zet de moeilijkheidsgraad (ook vóór het klikken op start)
AmsterdamUndeadDebug.runStats;                    // kills, headshots, schoten, geldTotaal van de huidige run
AmsterdamUndeadDebug.startEventGolf('stroomuitval');   // forceer een eventgolf direct
```

## Techniek

- [Three.js](https://threejs.org/) (via CDN) voor de 3D-weergave.
- Alle code staat becommentarieerd in `defend-national-monument.html`,
  opgebouwd in acht duidelijke stappen: basis → wereld → speler →
  robots/waves → schieten → geld/upgrades → geluid → game-loop.
- Botsingen werken met simpele rechthoeken (obstakels) waar de speler en
  de robots uit weggeduwd worden. De hitbox waarmee robots het monument
  "raken" is gelijk aan de werkelijk geregistreerde monument-rechthoek,
  zodat de HP ook echt daalt zodra een robot het vlak bereikt.
- De geluidjes worden live gemaakt met de Web Audio API, dus er zijn geen
  audiobestanden nodig.

## Zelf experimenteren

Open de browserconsole (F12) en speel met `DamChaosDebug`, bijvoorbeeld:

```js
DamChaosDebug.spawnRobotVanafPoort();  // extra robot vanuit een willekeurige straat
DamChaosDebug.startWave(5);            // spring naar wave 5
DamChaosDebug.spel;                    // score, wave, monumentHP, combo
DamChaosDebug.upgrades;                // huidige upgrade-niveaus
DamChaosDebug.geldStand();             // huidig geldbedrag
```
