// Performance-audit (bevinding A1): THREE.Points-decor (bouwStofwolk(), T40)
// zat op layer 0 in `wereld` — Raycaster.intersectObject() test alleen
// object.layers, nooit object.visible, dus een onzichtbaar stofwolkje was
// nog gewoon raycastbaar. Een Points-intersectie heeft geen `face`, terwijl
// schiet() op het misser-pad onvoorwaardelijk `raak[0].face.normal` leest —
// een gemist schot vanaf ~22% van de atelier-vloer (gemeten raster) gooide
// daardoor een TypeError die de rest van dat gameLoop()-frame liet
// overslaan. Fix: bouwStofwolk() zet `punten` nu op WERELD_DECOR_LAYER
// (alleen door de camera geënabled, niet door de raycaster) i.p.v. layer 0.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Elk WEL-raycastbaar niet-Mesh object in `wereld` (Points/Line/
// Sprite — Group en Light implementeren geen zinvolle .raycast() en zijn
// dus sowieso nooit een treffer, layer of niet) staat NIET op layer 0 — de
// architecturale garantie die A1 voorkomt, niet alleen het stofwolk-geval.
const laagCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const nietMeshOpLaag0 = [];
  d.wereld.traverse(o => {
    if (o === d.wereld) return;
    const raycastbaar = o.isPoints || o.isLine || o.isLineSegments || o.isSprite;
    if (raycastbaar && o.layers.test({ mask: 1 })) {
      nietMeshOpLaag0.push({ type: o.type, naam: o.name || null });
    }
  });
  return { nietMeshOpLaag0 };
});
check('Geen enkel raycastbaar niet-Mesh object (Points/Line/Sprite) in `wereld` staat op layer 0',
  laagCheck.nietMeshOpLaag0.length === 0, laagCheck);

// --- 2. De stofwolken specifiek: op WERELD_DECOR_LAYER, niet op layer 0 --
const stofCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const wolken = [];
  d.wereld.traverse(o => {
    if (o.isPoints) wolken.push({ opLaag0: o.layers.test({ mask: 1 }), opDecorLaag: o.layers.test({ mask: 1 << d.WERELD_DECOR_LAYER }) });
  });
  return { aantal: wolken.length, wolken };
});
check('Er zijn stofwolken om te testen', stofCheck.aantal === 2, stofCheck);
check('Elke stofwolk staat op WERELD_DECOR_LAYER en NIET op layer 0',
  stofCheck.wolken.every(w => w.opDecorLaag && !w.opLaag0), stofCheck);

// --- 3. De camera rendert de decor-laag nog gewoon (geen visuele regressie)
const cameraCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { camEnabled: d.camera.layers.test({ mask: 1 << d.WERELD_DECOR_LAYER }) };
});
check('De camera heeft WERELD_DECOR_LAYER enabled (stofwolken blijven zichtbaar)',
  cameraCheck.camEnabled, cameraCheck);

// --- 4. De eigenlijke regressie: een raycast tegen `wereld` vanaf het
// positieraster uit de audit levert nergens meer een Points-treffer (en dus
// nooit meer `face === null`) op als eerste resultaat. -------------------
const rasterCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const stof = [];
  d.wereld.traverse(o => { if (o.isPoints) stof.push(o); });
  const wolk = stof[0];
  const rc = new THREE.Raycaster();
  rc.far = 30;
  let puntTreffers = 0, totaal = 0;
  for (let dx = -3; dx <= 3; dx += 0.5) {
    for (let dz = 2; dz <= 8; dz += 1) {
      totaal++;
      const oog = new THREE.Vector3(wolk.position.x + dx, 1.6, wolk.position.z + dz);
      rc.set(oog, new THREE.Vector3(0, 0, -1));
      const hits = rc.intersectObject(d.wereld, true);
      if (hits.length && hits[0].face === null) puntTreffers++;
    }
  }
  return { totaal, puntTreffers };
});
check('Geen enkele positie in het atelier-raster levert nog een face:null-treffer (was 20/91)',
  rasterCheck.puntTreffers === 0, rasterCheck);

// --- 5. Einde-tot-einde: schiet() zelf loopt zonder fout af vanaf een
// positie die vóór de fix crashte (recht omhoog kijken in de stofkolom). -
const schietCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const stof = [];
  d.wereld.traverse(o => { if (o.isPoints) stof.push(o); });
  const wolk = stof[0];
  if (!d.wapenStaten.drukspuit) d.wapenStaten.drukspuit = d.nieuweWapenStaat(d.WAPEN_DRUKSPUIT);
  d.activeerVuurwapen('drukspuit');
  d.initGeluid();
  d.speler.positie.set(wolk.position.x, 0, wolk.position.z);
  d.updateSpeler(0);
  d.camera.position.set(wolk.position.x, 1.6, wolk.position.z);
  d.camera.rotation.set(Math.PI / 2 * 0.98, 0, 0);   // vrijwel recht omhoog, de stofkolom in
  d.camera.updateMatrixWorld(true);
  d.wapenStaat.magazijn = 30;
  d.wapenStaat.schietCooldown = 0;
  try { d.schiet(); return { ok: true }; }
  catch (e) { return { ok: false, fout: e.constructor.name + ': ' + e.message }; }
});
check('schiet() vanuit de stofkolom (recht omhoog) loopt zonder fout af', schietCheck.ok, schietCheck);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
