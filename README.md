# Dam Chaos 🤖💥

Een klein, vrolijk 3D open-wereld spel in de browser, gesitueerd op en rond
de Dam in Amsterdam. Schiet op rondwandelende robots en verzamel de munten
die ze achterlaten.

## Spelen

Open gewoon `index.html` in een moderne browser (Chrome, Firefox, Edge,
Safari) — er is geen server of build-stap nodig. Het spel is één enkel
HTML-bestand en kan dus ook direct als static site gehost worden
(bijvoorbeeld via GitHub Pages).

> Let op: er is een internetverbinding nodig, omdat de Three.js-bibliotheek
> vanaf een CDN wordt geladen.

## Besturing

| Actie | Toets |
| --- | --- |
| Lopen | `W` `A` `S` `D` |
| Rondkijken | Muis (klik eerst in het spel) |
| Schieten | Linkermuisknop |
| Pauze | `Esc` |

## Wat zit erin?

- Een compacte, gestileerde low-poly versie van de Dam: het Koninklijk
  Paleis, de Nieuwe Kerk, het Nationaal Monument, grachtenpandjes met
  trapgevels, het Damrak en het Rokin.
- Amsterdamse sfeer: duiven (die opvliegen als je te dichtbij komt),
  fietsenrekken, terrasjes met parasols, lantaarnpalen, bankjes en bomen.
- Robot-NPC's die zelfstandig over het plein wandelen. Schiet je er één
  neer, dan valt hij uit elkaar en laat hij een munt van €5–€25 achter.
- Loop over een munt om hem op te pakken; je totaal staat linksboven.
- Robots komen na een paar seconden ergens anders weer tevoorschijn.

## Techniek

- [Three.js](https://threejs.org/) (via CDN) voor de 3D-weergave.
- Alle code staat becommentarieerd in `index.html`, opgebouwd in acht
  duidelijke stappen: basis → wereld → speler → robots → schieten → geld
  → geluid → game-loop.
- Botsingen werken met simpele rechthoeken (obstakels) waar de speler en
  de robots uit weggeduwd worden.
- De geluidjes worden live gemaakt met de Web Audio API, dus er zijn geen
  audiobestanden nodig.

## Zelf experimenteren

Open de browserconsole (F12) en speel met `DamChaosDebug`, bijvoorbeeld:

```js
DamChaosDebug.spawnRobot();     // extra robot
DamChaosDebug.geldStand();      // huidig geldbedrag
```
