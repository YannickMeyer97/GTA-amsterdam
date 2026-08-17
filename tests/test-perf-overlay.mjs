// Ticket 117 (v0.23, ronde 9 — Zombie V2 fundament): tijdelijk F3
// performance-debug-overlay. Dekt: (1) standaard onzichtbaar/uit, (2) de
// F3-toets zelf toggelt 'm (niet alleen de debug-hook-setter), (3) alle
// vereiste velden staan erin zodra hij aan staat, (4) renderer.info.autoReset
// wordt correct beheerd (aan bij actief, terug naar standaard bij uit —
// exact het T88-patroon, zie de toelichting in amsterdam-undead.html), (5)
// geen pointer-lock nodig (het is een ontwikkelaarshulpmiddel, geen
// gameplay-actie), (6) uitzetten laat geen kunstmatig opgehoopte
// renderer.info-telling achter.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Standaard uit en onzichtbaar, GEEN pointer lock actief -------------
const startTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('perfOverlayUI');
  return {
    actief: d.perfOverlayActief,
    display: el.style.display,
    autoReset: d.renderer.info.autoReset,
    pointerLockActief: document.pointerLockElement === d.renderer.domElement,
  };
});
check('perfOverlayActief staat standaard op false', startTest.actief === false, startTest);
check('#perfOverlayUI is standaard onzichtbaar (display:none)', startTest.display === 'none', startTest);
check('renderer.info.autoReset staat standaard op true (ongewijzigd standaardgedrag)',
  startTest.autoReset === true, startTest);
check('deze test draait bewust ZONDER pointer lock (het overlay moet ook dan werken)',
  startTest.pointerLockActief === false, startTest);

// --- 2. De F3-toets zelf toggelt (niet alleen de debug-hook) ---------------
const f3Test = await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true }));
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('perfOverlayUI');
  return { actiefNaF3: d.perfOverlayActief, displayNaF3: el.style.display, autoResetNaF3: d.renderer.info.autoReset };
});
check('F3 (zonder pointer lock) zet perfOverlayActief op true', f3Test.actiefNaF3 === true, f3Test);
check('F3 maakt #perfOverlayUI zichtbaar', f3Test.displayNaF3 === 'block', f3Test);
check('F3 zet renderer.info.autoReset op false (handmatig beheerd zolang actief)',
  f3Test.autoResetNaF3 === false, f3Test);

// --- 3. Alle vereiste velden staan in de overlay-tekst ----------------------
// Eerst een paar echte frames laten draaien zodat het frametijd-venster niet
// leeg is (frame 0 toont alleen "opwarmen…" voor FPS/frametijd/p95).
await frames(page, 5);
const veldenTest = await page.evaluate(() => {
  const tekst = document.getElementById('perfOverlayUI').textContent;
  return {
    tekst,
    heeftFps: /FPS ~\d+/.test(tekst),
    heeftFrametijd: /frametijd gem [\d.]+ms/.test(tekst),
    heeftP95: /p95 [\d.]+ms/.test(tekst),
    heeftCalls: /draw calls \d+/.test(tekst),
    heeftTriangles: /triangles \d+/.test(tekst),
    heeftPoints: /points \d+/.test(tekst),
    heeftLines: /lines \d+/.test(tekst),
    heeftGeometrieen: /geometrieën \d+/.test(tekst),
    heeftTexturen: /texturen \d+/.test(tekst),
    heeftOndoden: /ondoden actief \d+/.test(tekst),
    heeftZichtbaar: /zichtbaar ~\d+/.test(tekst),
    heeftLichten: /lichten \d+/.test(tekst),
    heeftSchaduw: /schaduwwerpend \d+/.test(tekst),
  };
});
check('overlay toont FPS', veldenTest.heeftFps, veldenTest);
check('overlay toont gemiddelde frametijd', veldenTest.heeftFrametijd, veldenTest);
check('overlay toont p95-frametijd', veldenTest.heeftP95, veldenTest);
check('overlay toont renderer.info.render.calls', veldenTest.heeftCalls, veldenTest);
check('overlay toont renderer.info.render.triangles', veldenTest.heeftTriangles, veldenTest);
check('overlay toont renderer.info.render.points', veldenTest.heeftPoints, veldenTest);
check('overlay toont renderer.info.render.lines', veldenTest.heeftLines, veldenTest);
check('overlay toont renderer.info.memory.geometries', veldenTest.heeftGeometrieen, veldenTest);
check('overlay toont renderer.info.memory.textures', veldenTest.heeftTexturen, veldenTest);
check('overlay toont actieve ondoden', veldenTest.heeftOndoden, veldenTest);
check('overlay toont zichtbare ondoden (frustum-schatting)', veldenTest.heeftZichtbaar, veldenTest);
check('overlay toont actieve lichten', veldenTest.heeftLichten, veldenTest);
check('overlay toont schaduwwerpende lichten', veldenTest.heeftSchaduw, veldenTest);

// --- 4. Het frametijd-venster vult zich (ring buffer, max PERF_FRAME_VENSTER) ---
const vensterTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { lengte: d.perfFrameTijden.length, max: d.PERF_FRAME_VENSTER };
});
check('perfFrameTijden vult zich na een paar frames en overschrijdt het venster nooit',
  vensterTest.lengte > 0 && vensterTest.lengte <= vensterTest.max, vensterTest);

// --- 5. berekenPerfLichten()/telZichtbarePerfOndoden() geven zinnige, met de
// rest van het spel consistente getallen (28 lichten, 1 schaduwwerpend —
// hetzelfde invariant als T88/ronde 8) -------------------------------------
const lichtenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.berekenPerfLichten();
});
check('berekenPerfLichten() telt 28 lichten (§10.2-invariant, ongewijzigd door dit ticket)',
  lichtenTest.totaal === 28, lichtenTest);
check('berekenPerfLichten() telt precies 1 schaduwwerpend licht', lichtenTest.schaduw === 1, lichtenTest);

// --- 6. Uitzetten herstelt autoReset en verbergt de overlay weer -----------
const uitTest = await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true }));
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('perfOverlayUI');
  return { actief: d.perfOverlayActief, display: el.style.display, autoReset: d.renderer.info.autoReset };
});
check('F3 nogmaals zet perfOverlayActief terug op false', uitTest.actief === false, uitTest);
check('F3 nogmaals verbergt #perfOverlayUI weer', uitTest.display === 'none', uitTest);
check('F3 nogmaals herstelt renderer.info.autoReset naar true (geen blijvend gewijzigd standaardgedrag)',
  uitTest.autoReset === true, uitTest);

// --- 7. Structureel bewijs dat dit ticket de zombie-code zelf niet raakt ---
// (geen mechanische test kan "geen regel gewijzigd" bewijzen, maar wél dat
// de bestaande zombie-functies nog precies doen wat ze deden: spawnen,
// hoofd-hitbox, headshot-markering — een snelle rooksignaaltest).
const zombieSanityTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const o = d.spawnOndode(0, 'normaal');
  return {
    heeftDelen: !!o.groep.userData.delen,
    hoofdIsKop: o.groep.userData.delen.hoofd.children.some(k => k.userData.lichaamsdeel === 'kop'),
  };
});
check('maakOndodeModel()/spawnOndode() ongewijzigd: delen bestaan en het hoofd draagt nog de kop-markering',
  zombieSanityTest.heeftDelen && zombieSanityTest.hoofdIsKop, zombieSanityTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 || errs.length > 0 ? 1 : 0);
