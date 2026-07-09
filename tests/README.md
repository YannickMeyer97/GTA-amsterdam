# Amsterdam Undead — headless testsuite

Headless Playwright-tests tegen `../amsterdam-undead.html`, rechtstreeks via
`window.AmsterdamUndeadDebug` (zie CLAUDE.md voor de debug-hook-conventie).
Deze map bestaat sinds Ticket 10 van de v0.14+ architectuurronde
(zie `../ROADMAP.md` en `../SONNET_EXECUTION_PLAN.md`) — daarvoor stonden
deze tests alleen in een sessie-scratchpad en overleefden ze geen nieuwe
sessie.

## Installeren

```bash
cd tests
npm install
```

Playwright zelf host geen eigen browser-download nodig in deze omgeving:
het patroon uit CLAUDE.md gebruikt de al aanwezige lokale Chromium op
`/opt/pw-browsers/chromium` (zie `helpers.mjs`). Op een andere machine kan
in plaats daarvan `npx playwright install chromium` nodig zijn — pas dan
`executablePath` in `helpers.mjs` aan of verwijder die optie.

## Draaien

```bash
node check-load.mjs        # snelle load-check (geen console errors)
node test-golf-cyclus.mjs  # golf start/spawn/einde, wave-rewards, heal
node test-varianten.mjs    # ondode-varianten (Loper/Sjouwer/Brander)
node test-powerups.mjs     # power-up drop/pickup/effecten + cooldowns

node run-all.mjs           # alle scripts na elkaar + samenvatting
```

Elk script eindigt met exit code 0 (alles groen) of 1 (minstens één FAIL),
en drukt console-errors van de pagina zelf af — een script dat "console
errors: geen" mist, wijst op een JS-fout in `amsterdam-undead.html`.

## Patroon (voor nieuwe testscripts)

Gebruik `helpers.mjs`:

```js
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const resultaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // ... state opzetten, functie aanroepen, resultaat teruggeven ...
});
check('omschrijving', resultaat === verwacht, resultaat);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
```

Achterliggend patroon (zie ook CLAUDE.md): lokale Chromium via
`executablePath: '/opt/pw-browsers/chromium'`, een route-intercept die de
CDN-url van `three.module.js` lokaal serveert (geen internet nodig), en
`Object.defineProperty(document, 'pointerLockElement', ...)` om pointer
lock te simuleren wanneer een test de echte game-loop nodig heeft
(`openAmsterdamUndead({ simuleerPointerLock: true })`).

## Waarom niet alle scratchpad-tests hier staan

Deze map bevat de kernchecks (load, golf-cyclus, varianten, power-ups) —
niet elk testscript dat ooit tijdens de ontwikkeling is geschreven.
Voeg per nieuw ticket gerichte checks toe aan het relevante bestand, of
maak een nieuw `test-<naam>.mjs` volgens het patroon hierboven.

## Bekende beperking van dit ticket (Ticket 10)

Ticket 10 noemt in `ROADMAP.md` ook exports voor `isEventGolf`,
`kiesEventType` en `actieveEventGolf` — die horen bij Ticket 6
(eventgolf-framework, Fase 3) en bestaan dus nog niet in de code op het
moment dat dit ticket is uitgevoerd. Ticket 6 voegt die exports zelf toe
zodra het framework er is (staat al zo in zijn eigen taakomschrijving).
Alle state uit Tickets 1–5 (balanspatch) is wél volledig geëxporteerd.
