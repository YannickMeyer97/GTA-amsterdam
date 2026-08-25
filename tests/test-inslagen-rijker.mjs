// Ticket 94 (v0.22): rijkere inslagen — richting langs de inslagnormaal,
// langgerekte vonken, en een korte opzwellende rookpluim. Nul allocaties/
// setTimeout in schiet()/raakOndode() blijft de invariant (bestaande pools
// vooraf gebouwd, IMPACT_MAX/ROOK_MAX begrensd).
import { openAmsterdamUndead, makeChecker, frames, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();
// Ticket 134 (§12.8): dit bestand gebruikt d.schiet() als middel om echte
// wereld-inslagen te produceren — eerst een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

// --- 1. spawnImpact() zonder normaal: bestaand, volledig willekeurig
// gedrag blijft exact ongewijzigd (raakOndode()'s aanroep-signatuur) ------
const zonderNormaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const vrijVoor = d.impactPool.filter(s => !s.actief).length;
  d.spawnImpact({ x: 0, y: 1, z: 0 }, d.MATERIAAL_KLEUREN.vijand, 3);
  const actieven = d.actieveEffecten.filter(e => e.soort === 'impact').slice(-3);
  return {
    vrijVoor,
    aantalNieuw: actieven.length,
    langgerekt: actieven.map(e => e.langgerekt),
    schalen: actieven.map(e => ({ x: e.slot.mesh.scale.x, z: e.slot.mesh.scale.z })),
  };
});
check('spawnImpact() zonder normaal-argument: markeert de deeltjes niet als langgerekt',
  zonderNormaal.langgerekt.every(l => l === false), zonderNormaal);
check('...en de schaal blijft de oude uniforme kubus (x === z, dus niet langgerekt)',
  zonderNormaal.schalen.every(s => Math.abs(s.x - s.z) < 1e-9), zonderNormaal);

// --- 2. spawnImpact() MET normaal: directionele snelheid + langgerekte vorm
const metNormaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const normaal = { x: 0, y: 1, z: 0 };   // recht omhoog, voor een ondubbelzinnige check
  d.spawnImpact({ x: 2, y: 0, z: 2 }, d.MATERIAAL_KLEUREN.steen, 5, normaal);
  const actieven = d.actieveEffecten.filter(e => e.soort === 'impact').slice(-5);
  return {
    langgerekt: actieven.map(e => e.langgerekt),
    schalen: actieven.map(e => ({ x: e.slot.mesh.scale.x, z: e.slot.mesh.scale.z })),
    vy: actieven.map(e => e.slot.vy),
  };
});
check('spawnImpact() MET normaal: alle deeltjes gemarkeerd als langgerekt',
  metNormaal.langgerekt.every(l => l === true), metNormaal);
check('...de vorm is langgerekt (z ruim groter dan x, i.p.v. de oude uniforme kubus)',
  metNormaal.schalen.every(s => s.z > s.x * 2), metNormaal);
check('...en vy krijgt een positieve component langs de (omhoog wijzende) normaal',
  metNormaal.vy.every(vy => vy > 0.5), metNormaal);   // basissnelheid 1.5-3.0, ruime marge voor de spreiding

// --- 3. Langgerekte vonken volgen hun (door zwaartekracht kromme) pad ----
const koersVolgt = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const normaal = { x: 0, y: 1, z: 0 };
  const vrijeSlotIndex = d.impactPool.findIndex(s => !s.actief);
  d.spawnImpact({ x: -2, y: 1, z: -2 }, d.MATERIAAL_KLEUREN.hout, 1, normaal);
  const eff = d.actieveEffecten[d.actieveEffecten.length - 1];
  const rotatieVoor = eff.slot.mesh.rotation.clone ? { x: eff.slot.mesh.rotation.x, y: eff.slot.mesh.rotation.y } : null;
  for (let i = 0; i < 10; i++) await new Promise(res => requestAnimationFrame(res));
  const rotatieNa = { x: eff.slot.mesh.rotation.x, y: eff.slot.mesh.rotation.y };
  return { vrijeSlotIndex, rotatieVoor, rotatieNa, actief: eff.slot.actief };
});
check('Een langgerekte vonk her-oriënteert zich na verloop van tijd (zwaartekracht kromt de baan)',
  koersVolgt.rotatieVoor && (koersVolgt.rotatieNa.x !== koersVolgt.rotatieVoor.x || koersVolgt.rotatieNa.y !== koersVolgt.rotatieVoor.y),
  koersVolgt);

// --- 4. Rookpluim: spawnt, zwelt op, vervaagt, en verdwijnt op tijd -------
const rookVerslag = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const vrijVoor = d.rookPool.filter(s => !s.actief).length;
  d.spawnRook({ x: 1, y: 1, z: 1 });
  const eff = d.actieveEffecten[d.actieveEffecten.length - 1];
  const netNaSpawn = { schaal: eff.slot.mesh.scale.x, opacity: eff.slot.mesh.material.opacity, zichtbaar: eff.slot.mesh.visible };
  for (let i = 0; i < 12; i++) await new Promise(res => requestAnimationFrame(res));   // ~0,2s @ 60fps, ruim binnen ROOK_LEVENSDUUR (0,4s)
  const middenin = { schaal: eff.slot.mesh.scale.x, opacity: eff.slot.mesh.material.opacity };
  for (let i = 0; i < 40; i++) await new Promise(res => requestAnimationFrame(res));   // ruim voorbij ROOK_LEVENSDUUR
  const naAfloop = { actief: eff.slot.actief, zichtbaar: eff.slot.mesh.visible };
  return { vrijVoor, netNaSpawn, middenin, naAfloop, ROOK_SCHAAL_BEGIN: d.ROOK_SCHAAL_BEGIN, ROOK_SCHAAL_EIND: d.ROOK_SCHAAL_EIND };
});
check('spawnRook(): start zichtbaar op ROOK_SCHAAL_BEGIN, halve opacity',
  rookVerslag.netNaSpawn.zichtbaar === true &&
  Math.abs(rookVerslag.netNaSpawn.schaal - rookVerslag.ROOK_SCHAAL_BEGIN) < 1e-9 &&
  Math.abs(rookVerslag.netNaSpawn.opacity - 0.5) < 1e-9, rookVerslag);
check('Middenin de levensduur: de pluim is gegroeid (opgezwollen) t.o.v. het begin',
  rookVerslag.middenin.schaal > rookVerslag.netNaSpawn.schaal, rookVerslag);
check('Middenin de levensduur: de opacity is verder afgenomen (vervaagt)',
  rookVerslag.middenin.opacity < rookVerslag.netNaSpawn.opacity, rookVerslag);
check('Ruim na ROOK_LEVENSDUUR: de slot is weer vrij en onzichtbaar',
  rookVerslag.naAfloop.actief === false && rookVerslag.naAfloop.zichtbaar === false, rookVerslag);

// --- 5. Een echt schot op de wereld (muur) spawnt zowel een directionele
// impact-burst als een rookpluim, met de correcte, genormaliseerde richting
const echteWereldinslag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.updateSpeler(0);
  const rookVoor = d.actieveEffecten.filter(e => e.soort === 'rook').length;
  const impactVoor = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;
  d.schiet();
  const rookNa = d.actieveEffecten.filter(e => e.soort === 'rook');
  const impactNa = d.actieveEffecten.filter(e => e.soort === 'impact' && e.langgerekt);
  return {
    rookGespawned: rookNa.length > rookVoor,
    nieuweLanggerekteImpacts: impactNa.length > 0,
    // Elke normaal-gebaseerde snelheid moet een reële, eindige richting geven
    // (geen NaN/Infinity door een verkeerd getransformeerde nul-normaal).
    snelhedenEindig: impactNa.every(e => Number.isFinite(e.slot.vx) && Number.isFinite(e.slot.vy) && Number.isFinite(e.slot.vz)),
  };
});
check('Een echt schot op de muur spawnt een rookpluim',
  echteWereldinslag.rookGespawned, echteWereldinslag);
check('...en directionele (langgerekte) impact-deeltjes',
  echteWereldinslag.nieuweLanggerekteImpacts, echteWereldinslag);
check('...met eindige, geldige snelheidsvectoren (geen NaN uit de normal-transform)',
  echteWereldinslag.snelhedenEindig, echteWereldinslag);

// --- 6. Nul allocaties/groei: 200 schoten laten de pools exact even groot -
const stressTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.updateSpeler(0);
  const impactPoolMaatVoor = d.impactPool.length;
  const rookPoolMaatVoor = d.rookPool.length;
  const tracerPoolMaatVoor = d.tracerPool.length;
  for (let i = 0; i < 200; i++) {
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
    d.wapenStaat.herladen = false;
    d.schiet();
  }
  return {
    impactPoolMaatVoor, rookPoolMaatVoor, tracerPoolMaatVoor,
    impactPoolMaatNa: d.impactPool.length,
    rookPoolMaatNa: d.rookPool.length,
    tracerPoolMaatNa: d.tracerPool.length,
    impactMax: d.IMPACT_MAX, rookMax: d.ROOK_MAX,
    actieveImpacts: d.actieveEffecten.filter(e => e.soort === 'impact').length,
    actieveRook: d.actieveEffecten.filter(e => e.soort === 'rook').length,
  };
});
check('Na 200 echte schiet()-aanroepen blijft de impactPool exact IMPACT_MAX groot (geen groei)',
  stressTest.impactPoolMaatNa === stressTest.impactPoolMaatVoor && stressTest.impactPoolMaatNa === stressTest.impactMax, stressTest);
check('...en de rookPool blijft exact ROOK_MAX groot',
  stressTest.rookPoolMaatNa === stressTest.rookPoolMaatVoor && stressTest.rookPoolMaatNa === stressTest.rookMax, stressTest);
check('...en de tracerPool blijft ongewijzigd (dit ticket raakt tracers niet)',
  stressTest.tracerPoolMaatNa === stressTest.tracerPoolMaatVoor, stressTest);
check('Actieve impact-/rook-effecten blijven binnen hun eigen pool-maximum',
  stressTest.actieveImpacts <= stressTest.impactMax && stressTest.actieveRook <= stressTest.rookMax, stressTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
