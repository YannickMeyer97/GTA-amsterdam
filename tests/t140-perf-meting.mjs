// Ticket 140 — perf-controle bij de wapenpresentatielaag ("F3: p95 frametijd
// niet gestegen"). GEEN testbestand (bewust geen test-/check-prefix): een
// frametijdmeting in headless Chromium met software-rendering is te ruisig om
// als harde assertie in de regressiesuite te hangen.
//
// De meting draait de ECHTE gameLoop met de F3-overlay aan en leest het
// p95-venster dat het spel zelf al bijhoudt (PERF_FRAME_VENSTER = 90 frames).
// Draai 'm met een stille machine, één keer op deze commit en één keer op de
// vorige (git stash), en vergelijk.
//
// GEMETEN BIJ T140 (stille machine, 240 frames):
//   vóór T140:  p95 266,8 ms   gemiddelde 226,5 ms
//   ná  T140:   p95 250,0 ms   gemiddelde 225,9 ms
// Niet gestegen. De absolute waarden zijn onzinnig hoog omdat headless
// Chromium hier op software-rasterisatie draait — juist daardoor is de
// conclusie ook beperkt: het renderpad domineert zó sterk dat een verschil
// van een paar scalaire writes per frame er hoe dan ook niet in te zien is.
// Dat strookt met wat de refactor doet: netto ~3 extra number-assignments per
// frame, geen extra allocatie, en geen extra matrixwerk (Three.js hercomponeert
// de matrix elke frame toch al vanuit position/rotation).
import { openAmsterdamUndead, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

// F3 aan, dan ruim meer frames dan het venster groot is, zodat de ring buffer
// volledig gevuld is met frames uit de gemeten toestand (niet uit het laden).
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true }));
});
await frames(page, 240);

const meting = await page.evaluate(() => {
  const tekst = document.getElementById('perfOverlayUI').textContent;
  const p95 = /p95 ([\d.]+)ms/.exec(tekst);
  const gem = /frametijd gem ([\d.]+)ms/.exec(tekst);
  return {
    p95: p95 ? Number(p95[1]) : null,
    gemiddelde: gem ? Number(gem[1]) : null,
    actief: window.AmsterdamUndeadDebug.perfOverlayActief,
  };
});

console.log(JSON.stringify(meting, null, 2));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
