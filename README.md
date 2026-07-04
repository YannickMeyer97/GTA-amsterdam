# Amsterdam Arcade 🏛️🧟

Een klein browsergame-portaal met twee 3D arcade-games in de browser, beide
op de achtergrond in Amsterdam.

## Bestandsstructuur

| Bestand | Wat |
| --- | --- |
| `index.html` | Hoofdmenu met de twee games |
| `defend-national-monument.html` | **Defend National Monument** — verdedig het Nationaal Monument tegen golven robots (voorheen `index.html`) |
| `amsterdam-undead.html` | **Amsterdam Undead** — undead survival in een Amsterdams grachtenpand (voorlopig een placeholderpagina, wordt in volgende stappen uitgebouwd) |

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

Een nieuwe undead survival-modus in een Amsterdams grachtenpand. Bestand:
`amsterdam-undead.html`. Momenteel een placeholderpagina (sfeervolle
statische scene + "Terug naar menu"); de echte first-person-gameplay
(bewegen, schieten, golven, koopbare deuren) volgt in latere stappen — zie
`ROADMAP.md`.

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
