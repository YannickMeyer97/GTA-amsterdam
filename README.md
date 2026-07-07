# Amsterdam Arcade 🏛️🧟

Een klein browsergame-portaal met twee 3D arcade-games in de browser, beide
op de achtergrond in Amsterdam.

## Bestandsstructuur

| Bestand | Wat |
| --- | --- |
| `index.html` | Hoofdmenu met de twee games |
| `defend-national-monument.html` | **Defend National Monument** — verdedig het Nationaal Monument tegen golven robots (voorheen `index.html`) |
| `amsterdam-undead.html` | **Amsterdam Undead** — first-person undead wave-survival in een Amsterdams grachtenpand |

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

Verdedig het Nationaal Monument op de Dam in Amsterdam tegen golven robots
die uit de omliggende straten komen aanlopen. Bestand: `defend-national-monument.html`.
Gebruik de "← Menu"-knop rechtsboven om terug te gaan naar het hoofdmenu.

## Besturing

| Actie | Toets |
| --- | --- |
| Lopen | `W` `A` `S` `D` |
| Rondkijken | Muis (klik eerst in het spel) |
| Schieten | Linkermuisknop |
| Upgrade vuurtempo | `1` |
| Upgrade pickup-radius | `2` |
| Upgrade loopsnelheid | `3` |
| Pauze | `Esc` |

## Gameplay: Verdedig de Dam

- Robots spawnen uit vijf herkenbare straatopeningen: Damrak, Rokin,
  Damstraat, Kalverstraat en Nieuwendijk, en lopen recht op het Nationaal
  Monument af.
- Bereikt een robot het monument, dan verliest het monument HP (zichtbaar
  als percentage in de UI). Zakt het monument naar 0%, dan is het game over.
- Schiet robots neer voordat ze aankomen: ze vallen uiteen in brokstukken
  en laten een munt van €5–€25 achter.
- Elke wave heeft een kill-doel; haal je dat, dan krijg je een wave-bonus
  en begint de volgende, moeilijkere wave automatisch.
- Combo's, score, hitmarker en een korte camera-shake bij treffers en
  monumentschade geven het geheel een arcade-gevoel.
- Geld kun je tijdens het spelen direct besteden aan drie upgrades
  (vuurtempo, pickup-radius, loopsnelheid), elk tot max. niveau 5.

## Herkenbare Dam

Een compacte, gestileerde low-poly versie van het plein: het Koninklijk
Paleis, de Nieuwe Kerk, het Nationaal Monument, De Bijenkorf, Hotel
Krasnapolsky en Madame Tussauds (met leesbare gevelborden), straatnaam-
borden, tramrails met een rijdende tram en bel, grachtenpandjes met
trapgevels, zebrapaden, duiven, terrasjes, fietsenrekken, lantaarnpalen,
een straatmuzikant en een levend standbeeld.

## Amsterdam Undead

Een first-person undead wave-survival in een verlaten Amsterdams grachtenpand.
Bestand: `amsterdam-undead.html`. Gebruik de "← Menu"-knop linksboven om terug
te gaan naar het hoofdmenu.

### Besturing

| Actie | Toets |
| --- | --- |
| Lopen | `W` `A` `S` `D` |
| Rondkijken | Muis (klik eerst in het spel) |
| Schieten | Linkermuisknop |
| Herladen | `R` |
| Kopen / gebruiken | `T` (bij de deur, ammo-kist, upgradepunt of wandkooppunt) |
| Wissel van wapen | `Q` (pas nadat De Ratelaar gekocht is) |
| Pauze | `Esc` |

### Gameplay

- Overleef doorlopende **golven ondoden** die uit de vensters het pand
  binnendringen en op je afkomen. De eerste twee golven zijn ze fragiel
  (1 treffer), daarna taaier (2 treffers); elke golf komen er meer, en elke
  ontgrendelde zone verhoogt de spawndruk (sneller + meer gelijktijdig).
- **Trefzones tellen:** een lichaamstreffer doet 1 schade, een **headshot**
  het dubbele — én een dodelijke headshot levert 2x zoveel geld op als een
  gewone kill. Je startwapen (de Drukspuit) heeft een magazijn van 8 kogels
  (reserve 48); `R` herlaadt in 1,2 s (0,7 s na de Snelspanner-upgrade).
- Kom je te dicht bij een ondode, dan slaat 'ie (15 schade). Je HP (100)
  regenereert vanzelf na een paar seconden zonder klappen; een rode
  schermrand waarschuwt bij schade. Op 0 HP is het **game over** (klik
  "Opnieuw beginnen" om te herstarten).
- Je verdient **geld** per treffer en per kill.

### Drie zones, elk met een eigen doel

1. **De woonkamer** (start) — warm, veilig, leert je de basis. Ammo-kist
   (€300, +48 reserve-munitie) en het eerste upgradepunt (€500, schade +1,
   daarna MAX).
2. **De gang** — een smal, donker, kaal knelpunt tussen de woonkamer en het
   atelier; puur doorgang, geen interacties.
3. **Het schildersatelier** (achter deur 1, €500) — een L-vormige ruimte met
   koel daglicht via twee dakramen, een schildersezel als landmark, een
   voorraadnis met een eigen invalshoek, en de **Werkbank**: een eenmalige
   Snelspanner-upgrade (€600, herlaadtijd 1,2s → 0,7s).
4. **De binnenplaats** (achter deur 2, €1000, vanuit het atelier) — een
   ruime, open buitenruimte, verlicht door vier lantaarnpalen, met koud
   maanlicht op natte klinkers. De **Regenton** geeft eenmalig €400, de
   **Watertap** is herbruikbaar (€200 → +50 HP, gecapt op je max), en tegen
   de oostmuur staat het wandkooppunt van **De Ratelaar** (€750): een
   tweede, snellere wapen met zo'n dubbele munitiecapaciteit t.o.v. de
   Drukspuit. Wissel met `Q` tussen beide wapens; elk houdt zijn eigen
   magazijn en reservemunitie bij.

### Sfeer & techniek

Warme flikkerende lampen in de woonkamer, een kaal koud-groen gangetje, koel
daglicht in het atelier en blauw maanlicht op de binnenplaats geven elke zone
een eigen identiteit. Binnenhuis-mist en decoratieve meubels (bewust zonder
collision, zodat de pathing er niet op vasthaakt) maken het pand levendig
zonder de gameplay te verstoren. Net als de andere game draait alles in één zelfstandig
HTML-bestand met Three.js via CDN, botsingen via rechthoek-obstakels, en
live gegenereerde Web Audio-geluiden (geen audiobestanden). De meubels zijn
puur decor en hebben géén collision, zodat de pathing er niet op vasthaakt.

### Zelf experimenteren

Open de browserconsole (F12) en speel met `AmsterdamUndeadDebug`, bijvoorbeeld:

```js
AmsterdamUndeadDebug.spawnWillekeurigeOndode();  // spawn een ondode
AmsterdamUndeadDebug.startGolf();                 // start direct een nieuwe golf
AmsterdamUndeadDebug.spelStaat;                   // golf, geld, gameOver
AmsterdamUndeadDebug.spelerStaat;                 // speler-HP
AmsterdamUndeadDebug.wapenStaat;                  // magazijn / reserve / herladen
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
