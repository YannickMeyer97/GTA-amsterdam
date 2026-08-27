// Ticket 148 — perf-controle ("F3 met 26 actieve ondoden: p95 ongewijzigd").
// GEEN testbestand (bewust geen test-/check-prefix): zelfde reden als
// t140-perf-meting.mjs — een frametijdmeting in headless Chromium met
// software-rendering is te ruisig om als harde assertie in de
// regressiesuite te hangen.
//
// 26 ondoden, verspreid en ALLEMAAL echt bewegend (niet stilstaand) zodat de
// nieuwe afstandsgekoppelde loopFase (Ticket 148) daadwerkelijk elke frame
// wordt uitgerekend, plus de nieuwe pelvis-/chest-position.x-writes — precies
// het pad dat dit ticket verzwaart. F3 AAN ná een opbouwfase, zodat de ring
// buffer (PERF_FRAME_VENSTER = 90) alleen piek-frames bevat.
//
// Draai 'm met een stille machine, één keer op deze commit en één keer op de
// vorige (git stash), en vergelijk (zelfde workflow als t140).
//
// GEMETEN BIJ T148 (deze omgeving, 26 ondoden, 60 opbouw- + 240 meetframes):
//   vóór T148 (HEAD):  p95 349,9 ms   gemiddelde 327,2 ms
//   ná  T148 (3x):     p95 316,7/350,0/283,4 ms   gemiddelde 300,7/333,9/275,7 ms
// Ruim binnen dezelfde ruis-band als de vóór-meting (headless software-
// rasterisatie, zie t140's toelichting) — geen systematische stijging. De
// nieuwe writes per frame zijn twee extra scalaire position.x-assignments
// (pelvis/chest) en een iets andere (niet duurdere) loopFase-formule; geen
// extra allocatie, geen extra matrixwerk.
import { openAmsterdamUndead, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  // Verspreid over een ruime cirkel rond de speler, zodat ze allemaal
  // daadwerkelijk moeten lopen (geen twee op precies dezelfde route).
  for (let i = 0; i < 26; i++) {
    const hoek = (i / 26) * Math.PI * 2;
    const straal = 6 + (i % 3);
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(Math.cos(hoek) * straal, 0, Math.sin(hoek) * straal - 2);
  }
});

await frames(page, 60);   // opbouw: laat de navigatie/animatie op gang komen

await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true }));
});
await frames(page, 240);

const meting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tekst = document.getElementById('perfOverlayUI').textContent;
  const p95 = /p95 ([\d.]+)ms/.exec(tekst);
  const gem = /frametijd gem ([\d.]+)ms/.exec(tekst);
  return {
    p95: p95 ? Number(p95[1]) : null,
    gemiddelde: gem ? Number(gem[1]) : null,
    aantalOndoden: d.ondoden.length,
    actief: d.perfOverlayActief,
  };
});

console.log(JSON.stringify(meting, null, 2));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
