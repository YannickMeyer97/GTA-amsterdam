# Dam Chaos — Verdedig de Dam v4 🤖🏛️

Een klein, vrolijk 3D arcade-shooter in de browser: verdedig het Nationaal
Monument op de Dam in Amsterdam tegen golven robots die uit de omliggende
straten komen aanlopen.

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

## Techniek

- [Three.js](https://threejs.org/) (via CDN) voor de 3D-weergave.
- Alle code staat becommentarieerd in `index.html`, opgebouwd in acht
  duidelijke stappen: basis → wereld → speler → robots/waves → schieten →
  geld/upgrades → geluid → game-loop.
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
