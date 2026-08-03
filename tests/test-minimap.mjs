// Ticket 67: minimap — vaste wereld-naar-canvas-projectie (geen scroll/zoom),
// speler-positie/-richting, statische zone-omtreklijnen (afgeleid van
// bestaande muur-/deurconstanten) en nabije ondoden als stippen. De kelder
// ligt structureel buiten GRENS (zie GRENS-commentaar in het hoofdbestand),
// dus toont de minimap daar een simpel "KELDER"-label i.p.v. een sublaag.
// Zie ROADMAP.md Ticket 67 en ARCHITECTURE_NOTES.md §7.8.1.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. minimapTransform()/minimapSchaal(): pure functies, exact ----------
const transform = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const midden = d.minimapTransform((d.GRENS.minX + d.GRENS.maxX) / 2, (d.GRENS.minZ + d.GRENS.maxZ) / 2);
  const west = d.minimapTransform(d.GRENS.minX, (d.GRENS.minZ + d.GRENS.maxZ) / 2);
  const oost = d.minimapTransform(d.GRENS.maxX, (d.GRENS.minZ + d.GRENS.maxZ) / 2);
  return {
    midden, west, oost,
    schaal: d.minimapSchaal(),
    canvasGrootte: d.MINIMAP_CANVAS_GROOTTE,
    padding: d.MINIMAP_PADDING,
  };
});
check('Het wereldmidden projecteert exact op het canvasmidden',
  Math.abs(transform.midden.cx - transform.canvasGrootte / 2) < 0.01 &&
  Math.abs(transform.midden.cy - transform.canvasGrootte / 2) < 0.01, transform);
check('Westgrens ligt links van het midden, oostgrens rechts (correcte x-richting)',
  transform.west.cx < transform.midden.cx && transform.oost.cx > transform.midden.cx, transform);
check('minimapSchaal() is positief en de breedste as (hier: x) vult het canvas exact tot aan de padding',
  transform.schaal > 0 &&
  Math.abs((transform.oost.cx - transform.west.cx) - (transform.canvasGrootte - 2 * transform.padding)) < 0.01, transform);

// --- 2. MINIMAP_ZONES: 8 rechthoeken, elk met een bekend, herkenbaar punt --
const zonesTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  function bevat(zone, x, z) {
    return x >= Math.min(zone.x0, zone.x1) && x <= Math.max(zone.x0, zone.x1) &&
      z >= Math.min(zone.z0, zone.z1) && z <= Math.max(zone.z0, zone.z1);
  }
  return {
    aantal: d.MINIMAP_ZONES.length,
    woonkamerBevatOrigin: d.MINIMAP_ZONES.some(z => bevat(z, 0, 0)),
    atelierBevatNis: d.MINIMAP_ZONES.some(z => bevat(z, d.KAMER2_NIS_CX, d.KAMER2_NIS_CZ)),
    binnenplaatsBevatMidden: d.MINIMAP_ZONES.some(z => bevat(z, (d.DEUR2_X + d.PLAATS_X_OOST) / 2, (d.PLAATS_Z_NOORD + d.PLAATS_Z_ZUID) / 2)),
  };
});
check('Er zijn precies 8 minimap-zones', zonesTest.aantal === 8, zonesTest);
check('De woonkamer-zone bevat de oorsprong (0,0)', zonesTest.woonkamerBevatOrigin, zonesTest);
check('Eén zone bevat het midden van de atelier-nis', zonesTest.atelierBevatNis, zonesTest);
check('Eén zone bevat het midden van de binnenplaats', zonesTest.binnenplaatsBevatMidden, zonesTest);

// --- 3. tekenMinimap() tekent zone-rechthoeken + speler-driehoek in de
// normale (boven-de-grond) stand, en NIETS daarvan in de kelder-stand -------
const tekenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let strokeRectAantal = 0, fillTextAantal = 0, moveToAantal = 0;
  const origStrokeRect = ctx.strokeRect.bind(ctx);
  const origFillText = ctx.fillText.bind(ctx);
  const origMoveTo = ctx.moveTo.bind(ctx);
  ctx.strokeRect = (...a) => { strokeRectAantal++; return origStrokeRect(...a); };
  ctx.fillText = (...a) => { fillTextAantal++; return origFillText(...a); };
  ctx.moveTo = (...a) => { moveToAantal++; return origMoveTo(...a); };

  d.speler.positie.set(0, 0, 0);
  d.tekenMinimap();
  const bovenGronds = { strokeRectAantal, fillTextAantal, moveToAantal };

  strokeRectAantal = 0; fillTextAantal = 0; moveToAantal = 0;
  d.speler.positie.set(d.KELDER_X_WEST + 2, -d.KELDER_DIEPTE, (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2);
  d.tekenMinimap();
  const kelder = { strokeRectAantal, fillTextAantal, moveToAantal };

  ctx.strokeRect = origStrokeRect;
  ctx.fillText = origFillText;
  ctx.moveTo = origMoveTo;
  d.speler.positie.set(0, 0, 0);
  return { bovenGronds, kelder };
});
check('Boven de grond: 8 zone-rechthoeken getekend (strokeRect)', tekenTest.bovenGronds.strokeRectAantal === 8, tekenTest);
check('Boven de grond: de speler-driehoek wordt getekend (moveTo aangeroepen)', tekenTest.bovenGronds.moveToAantal > 0, tekenTest);
check('Boven de grond: geen "KELDER"-label (geen fillText)', tekenTest.bovenGronds.fillTextAantal === 0, tekenTest);
check('In de kelder: GEEN zone-rechthoeken (geen sublaag-tekening)', tekenTest.kelder.strokeRectAantal === 0, tekenTest);
check('In de kelder: GEEN speler-driehoek (vervangen door het label)', tekenTest.kelder.moveToAantal === 0, tekenTest);
check('In de kelder: het "KELDER"-label wordt getekend (fillText)', tekenTest.kelder.fillTextAantal === 1, tekenTest);

// --- 4. Nabije ondoden binnen MINIMAP_ONDODE_RADIUS krijgen een stip, verder
// weg staande niet ----------------------------------------------------------
const ondodenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const dichtbij = d.spawnOndode(0, 'normaal');
  dichtbij.groep.position.set(5, 0, 0);   // binnen MINIMAP_ONDODE_RADIUS (25)
  const ver = d.spawnOndode(0, 'normaal');
  ver.groep.position.set(d.MINIMAP_ONDODE_RADIUS + 20, 0, 0);   // ruim buiten bereik

  const ctx = d.minimapUI.getContext('2d');
  let arcAantal = 0;
  const origArc = ctx.arc.bind(ctx);
  ctx.arc = (...a) => { arcAantal++; return origArc(...a); };
  d.tekenMinimap();
  ctx.arc = origArc;

  for (const o of [...d.ondoden]) d.doodOndode(o);
  // arc() wordt ook 1x gebruikt door... nee, alleen door ondode-stippen (de
  // speler is een driehoek via moveTo/lineTo, geen arc) — dus arcAantal moet
  // exact het aantal ondoden BINNEN bereik zijn (hier: 1).
  return { arcAantal };
});
check('Precies 1 ondode-stip getekend (de dichtbije, niet de verre)', ondodenTest.arcAantal === 1, ondodenTest);

// --- 5. updateMinimap(): throttle, zelfde patroon als de audio-throttles ---
const throttleTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let tekenAantal = 0;
  const origClearRect = ctx.clearRect.bind(ctx);
  ctx.clearRect = (...a) => { tekenAantal++; return origClearRect(...a); };

  d.minimapThrottleTimer = d.MINIMAP_TEKEN_INTERVAL;
  const perStap = d.MINIMAP_TEKEN_INTERVAL / 10;
  for (let i = 0; i < 9; i++) d.updateMinimap(perStap);
  const naNegen = tekenAantal;
  d.updateMinimap(perStap * 2);
  const naTien = tekenAantal;

  ctx.clearRect = origClearRect;
  return { naNegen, naTien };
});
check('9 aanroepen van elk 1/10e van de teken-interval tekenen NOG NIET opnieuw', throttleTest.naNegen === 0, throttleTest);
check('Zodra de opgetelde tijd de interval overschrijdt, wordt er precies 1x opnieuw getekend',
  throttleTest.naTien === 1, throttleTest);

// --- 6. HTML/zichtbaarheid: canvas bestaat, en volgt hudUI/ammoUI's
// display-toggle bij pointerlockchange --------------------------------------
const zichtbaarheidTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bestaat: !!d.minimapUI,
    isCanvas: d.minimapUI.tagName === 'CANVAS',
    tijdensSpel: d.minimapUI.style.display,
  };
});
check('#minimapUI is een <canvas>-element', zichtbaarheidTest.bestaat && zichtbaarheidTest.isCanvas, zichtbaarheidTest);
check('Tijdens actief spel staat de minimap op display:block', zichtbaarheidTest.tijdensSpel === 'block', zichtbaarheidTest);

const pauzeTest = await page.evaluate(async () => {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return window.AmsterdamUndeadDebug.minimapUI.style.display;
});
check('Tijdens pauze verdwijnt de minimap (display:none), zelfde patroon als hudUI/ammoUI', pauzeTest === 'none', { pauzeTest });

await page.evaluate(() => {
  const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
