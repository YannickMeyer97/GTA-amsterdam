// Ticket 147 — perf-controle tijdens de finale-piek (FINALE.md §5-checklist:
// "F3 tijdens de piek: p95 vastgelegd in het ticket"). GEEN testbestand
// (bewust geen test-/check-prefix): zelfde reden als t140-perf-meting.mjs —
// een frametijdmeting in headless Chromium met software-rendering is te
// ruisig om als harde assertie in de regressiesuite te hangen.
//
// De meting triggert de instapfase (dus: FINALE_SURGE_BUDGET erbij, ~30s
// spawnen op vol tempo — FINALE.md §1.2/§2 beslissing 4), laat de golf-
// spawnstap voldoende echte frames lopen om richting het gemeten plafond
// (14/16/18 ondoden, FINALE.md §1.1) te komen, en leest dán pas het
// p95-venster van de F3-overlay — de ring buffer (PERF_FRAME_VENSTER = 90)
// moet gevuld zijn met frames UIT de piek, niet uit het rustige laden.
//
// GEMETEN BIJ T147 (deze omgeving, 400 opbouw-frames + 240 meetframes,
// stille machine): p95 100,1 ms, gemiddelde 98,3 ms — dezelfde orde van
// grootte als T140's software-rasterisatie-baseline (~226-267 ms daar bij
// een andere scene-belasting), niet ontspoord. De escalatie zelf is drie
// scalaire fog-writes, een Math.max()-vloer en een bestaande proximity-
// check die toch al elk frame draaide (updateInteracties()) — geen nieuwe
// allocatie, geen nieuw matrixwerk, dus geen aparte regressie te verwachten
// en ook niet gemeten.
import { openAmsterdamUndead, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  d.toonOntsnappingspuntIndienKlaar();
  d.spelStaat.geld = 10000;
  d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
  d.updateInteracties();
  d.probeerOntsnapping();   // injecteert FINALE_SURGE_BUDGET, start de instapfase
});

// Ruim voldoende frames om de golf-spawnstap het budget te laten omzetten in
// daadwerkelijke ondoden (richting het gemeten plafond), vóórdat er gemeten
// wordt — anders meet dit vooral de rustige opbouw, niet de piek zelf.
await frames(page, 400);

const voorMeting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { ondodenAantal: d.ondoden.length, instapActief: d.instapActief, instapTimer: d.instapTimer };
});

// F3 aan ná de opbouw: reset de ring buffer zodat 'ie alleen met piek-frames
// vult, zelfde patroon als t140-perf-meting.mjs.
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

console.log('Vóór meting (na opbouwfase):', JSON.stringify(voorMeting));
console.log(JSON.stringify(meting, null, 2));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
