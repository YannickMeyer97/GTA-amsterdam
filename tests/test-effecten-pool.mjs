// Feedback F1 (Ticket 32): effecten-pool voor tracers en impact-deeltjes.
// Bewaakt: pool-plafonds na spam (nooit meer dan TRACER_MAX/IMPACT_MAX
// actief), geen `new THREE.`/`setTimeout` meer in de hot paths
// (schiet()/raakOndode()), headshot geeft meer deeltjes dan een
// lichaamstreffer, effecten bevriezen tijdens pauze, en de tracer-oorsprong
// klopt met de vlam-wereldpositie.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

// Bewust ZONDER simuleerPointerLock: het spel staat dus vanaf het begin al
// gepauzeerd (spelActief === false), wat precies is wat de pauze-freeze-
// check (§5) nodig heeft — de andere checks roepen de effecten-functies
// rechtstreeks via de debug-hooks aan en zijn dus onafhankelijk van de
// pointer-lock-staat.
const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Pool-plafonds: nooit meer dan TRACER_MAX/IMPACT_MAX actieve slots -
const poolPlafonds = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // 60 tracers spammen (ruim boven TRACER_MAX).
  for (let i = 0; i < 60; i++) d.spawnTracer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, 0xd8ffe0);
  const tracersActief = d.tracerPool.filter(s => s.actief).length;
  const tracersZichtbaar = d.tracerPool.filter(s => s.mesh.visible).length;
  // 60 impact-bursts van 3 deeltjes elk (ruim boven IMPACT_MAX).
  for (let i = 0; i < 60; i++) d.spawnImpact({ x: 0, y: 0, z: 0 }, 0xb9ec3f, 3);
  const impactsActief = d.impactPool.filter(s => s.actief).length;
  const impactsZichtbaar = d.impactPool.filter(s => s.mesh.visible).length;
  return {
    tracersActief, tracersZichtbaar, impactsActief, impactsZichtbaar,
    tracerMax: d.TRACER_MAX, impactMax: d.IMPACT_MAX,
    totaalTracerMeshes: d.tracerPool.length, totaalImpactMeshes: d.impactPool.length,
  };
});
check('Na 60 tracer-spawns blijven er nooit meer dan TRACER_MAX actieve tracer-slots',
  poolPlafonds.tracersActief <= poolPlafonds.tracerMax && poolPlafonds.tracersZichtbaar <= poolPlafonds.tracerMax, poolPlafonds);
check('Na 60 impact-bursts (180 deeltjes) blijven er nooit meer dan IMPACT_MAX actieve impact-slots',
  poolPlafonds.impactsActief <= poolPlafonds.impactMax && poolPlafonds.impactsZichtbaar <= poolPlafonds.impactMax, poolPlafonds);
check('De tracer-pool zelf blijft precies TRACER_MAX meshes groot (geen nieuwe meshes gealloceerd door de spam)',
  poolPlafonds.totaalTracerMeshes === poolPlafonds.tracerMax, poolPlafonds);
check('De impact-pool zelf blijft precies IMPACT_MAX meshes groot (geen nieuwe meshes gealloceerd door de spam)',
  poolPlafonds.totaalImpactMeshes === poolPlafonds.impactMax, poolPlafonds);

// --- 2. Source-check: schiet()/raakOndode() bouwen geen nieuwe mesh/
// geometry/material meer (het oude vonk/bloedvonk-patroon) en geen
// setTimeout meer. Let op: raakOndode() bevat WEL nog een bestaande, buiten
// de scope van dit ticket vallende `new THREE.Vector3()` (Ticket 21,
// knockback-richting) — dat is geen mesh-allocatie en blijft terecht staan;
// de check mikt daarom specifiek op Mesh/Geometry/Material-constructors.
const sourceCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const schietBron = d.schiet.toString();
  const raakOndodeBron = d.raakOndode.toString();
  const meshPatroon = /new\s+THREE\.(Mesh|.*Geometry|.*Material)\(/;
  return {
    schietHeeftNewThree: meshPatroon.test(schietBron),
    schietHeeftSetTimeout: /setTimeout/.test(schietBron),
    raakOndodeHeeftNewThree: meshPatroon.test(raakOndodeBron),
    raakOndodeHeeftSetTimeout: /setTimeout/.test(raakOndodeBron),
  };
});
check('schiet() bevat geen nieuwe mesh/geometry/material-allocatie meer (geen vonk-allocatie in het hot path)',
  sourceCheck.schietHeeftNewThree === false, sourceCheck);
check('schiet() bevat geen setTimeout meer',
  sourceCheck.schietHeeftSetTimeout === false, sourceCheck);
check('raakOndode() bevat geen "new THREE." meer (geen bloedvonk-allocatie in het hot path)',
  sourceCheck.raakOndodeHeeftNewThree === false, sourceCheck);
check('raakOndode() bevat geen setTimeout meer',
  sourceCheck.raakOndodeHeeftSetTimeout === false, sourceCheck);

// --- 3. Headshot geeft meer deeltjes dan een lichaamstreffer --------------
const deeltjesAantal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.actieveEffecten.length = 0;
  for (const slot of d.impactPool) { slot.actief = false; slot.mesh.visible = false; }
  const o1 = d.spawnOndode(0, 'normaal');
  o1.hp = 1000;
  const voorLichaam = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  d.raakOndode(o1, o1.groep.position, false);   // lichaamstreffer
  const naLichaam = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  d.doodOndode(o1);

  const o2 = d.spawnOndode(0, 'normaal');
  o2.hp = 1000;
  const voorKop = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  d.raakOndode(o2, o2.groep.position, true);   // headshot
  const naKop = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  d.doodOndode(o2);

  return { lichaamDeeltjes: naLichaam - voorLichaam, koptDeeltjes: naKop - voorKop };
});
check('Een lichaamstreffer geeft 3 impact-deeltjes',
  deeltjesAantal.lichaamDeeltjes === 3, deeltjesAantal);
check('Een headshot geeft 5 impact-deeltjes (meer dan een lichaamstreffer)',
  deeltjesAantal.koptDeeltjes === 5 && deeltjesAantal.koptDeeltjes > deeltjesAantal.lichaamDeeltjes, deeltjesAantal);

// --- 4. Tracer-oorsprong klopt met de vlam-wereldpositie ------------------
const tracerOorsprong = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const vlamPos = d.wapenStaat.definitie.vlam.getWorldPosition(d.wapenStaat.definitie.vlam.position.clone());
  const doel = vlamPos.clone().add({ x: 0, y: 0, z: -3 });
  d.spawnTracer(vlamPos, doel, 0xd8ffe0);
  const nieuwsteTracer = d.actieveEffecten.filter(e => e.soort === 'tracer').slice(-1)[0];
  const midpunt = vlamPos.clone().add(doel).multiplyScalar(0.5);
  const afstandTotVerwachtMidpunt = nieuwsteTracer.slot.mesh.position.distanceTo(midpunt);
  const afstandVlamTotMidpunt = vlamPos.distanceTo(nieuwsteTracer.slot.mesh.position);
  return { afstandTotVerwachtMidpunt, afstandVlamTotMidpunt, lengte: nieuwsteTracer.slot.mesh.scale.z };
});
check('spawnTracer() plaatst de mesh op het midden tussen vanWereldPos en naarPunt',
  tracerOorsprong.afstandTotVerwachtMidpunt < 0.01, tracerOorsprong);
check('De afstand van de vlam-wereldpositie tot het tracer-midden is ongeveer de halve lengte',
  Math.abs(tracerOorsprong.afstandVlamTotMidpunt - tracerOorsprong.lengte / 2) < 0.01, tracerOorsprong);

// --- 5. Pauze-bevriezing: effecten bewegen niet tijdens pauze -------------
const pauzeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.actieveEffecten.length = 0;
  for (const slot of d.impactPool) { slot.actief = false; slot.mesh.visible = false; }
  d.spawnImpact({ x: 1, y: 1, z: 1 }, 0xb9ec3f, 3);
  const eff = d.actieveEffecten.filter(e => e.soort === 'impact').slice(-1)[0];
  return { positieVoor: { x: eff.slot.mesh.position.x, y: eff.slot.mesh.position.y, z: eff.slot.mesh.position.z }, opacityVoor: eff.slot.mesh.material.opacity };
});
await page.evaluate(() => {
  // Pauze: pointer lock "verliezen" (zelfde patroon als de bestaande
  // pauze-tests) zodat de spelActief-tak van gameLoop (incl. updateEffecten)
  // stilstaat.
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});
await page.waitForTimeout(300);   // meerdere echte rAF-frames tijdens pauze
const pauzeNa = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const eff = d.actieveEffecten.find(e => e.soort === 'impact');
  if (!eff) return { verdwenen: true };
  return {
    verdwenen: false,
    positieNa: { x: eff.slot.mesh.position.x, y: eff.slot.mesh.position.y, z: eff.slot.mesh.position.z },
    opacityNa: eff.slot.mesh.material.opacity,
  };
});
check('Tijdens pauze verdwijnt het impact-deeltje niet vanzelf (updateEffecten draait niet)',
  pauzeNa.verdwenen === false, pauzeNa);
check('Tijdens pauze verandert de positie van het impact-deeltje niet (geen zwaartekracht-integratie)',
  !pauzeNa.verdwenen && pauzeNa.positieNa.x === pauzeTest.positieVoor.x &&
  pauzeNa.positieNa.y === pauzeTest.positieVoor.y && pauzeNa.positieNa.z === pauzeTest.positieVoor.z,
  { pauzeTest, pauzeNa });
check('Tijdens pauze verandert de opacity (fade) van het impact-deeltje niet',
  !pauzeNa.verdwenen && pauzeNa.opacityNa === pauzeTest.opacityVoor, { pauzeTest, pauzeNa });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
