// Ticket 41 — integratie: eindregressie + performance-audit voor de hele
// v0.16-ronde (T30-T40 samen). Bewaakt de vier expliciete audits uit
// ROADMAP.md/SONNET_EXECUTION_PLAN.md: lichttelling <= bestaand (22,
// geverifieerd tegen commit b59c794, direct vóór Ticket 30) + 1 nieuwe
// permanente lamp (winkelLicht), precies 1 schaduwwerpende lamp, effect-
// plafonds na een stress-golf van ECHTE schiet()-aanroepen (een aanvulling
// op de directe spawnTracer/spawnImpact-spam die test-effecten-pool.mjs al
// dekt) en pool-hergebruik (poolgroottes blijven vast). Sectie 3 is een
// chaos-smoke-run (Mistgolf + alle deuren open + winkel-aankopen + combat
// tegelijk, real-time via de al draaiende gameLoop) die de "speeltest golf
// 8+, alle deuren open, Mistgolf met winkels/tells/ogen"-eis van het ticket
// dekt: geen enkele console-error terwijl alle T30-T40-systemen samen lopen.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();
// Ticket 134 (§12.8): dit bestand gebruikt d.schiet() als middel om schade
// toe te brengen, niet om het wapensysteem zelf te testen — de speler start
// sinds T134 met een mes, dus eerst een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

// --- 1. Lichttelling + schaduw-invariant -----------------------------------
const lichtenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lichten = [];
  d.scene.traverse(o => { if (o.isLight) lichten.push({ type: o.type, castShadow: o.castShadow }); });
  return { totaal: lichten.length, schaduw: lichten.filter(l => l.castShadow).length };
});
check('Lichttelling blijft binnen budget: bestaand (22, pre-Ticket-30-baseline) + winkelLicht (23) + Ticket 52 gracht-lantaarn (24) + boot-lichtje (25, Feedback: fysieke aankomst) + Ticket 62 kelder (trap + 2 kamerlampen, 28)',
  lichtenTest.totaal <= 28, lichtenTest);
check('Precies 1 schaduwwerpende lamp in de hele scene (de schaduw===1-invariant)',
  lichtenTest.schaduw === 1, lichtenTest);

// --- 2. Stress-golf via ECHTE schiet()-aanroepen: effect-plafonds +
// pool-hergebruik ------------------------------------------------------------
const stressTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.actieveEffecten.length = 0;
  for (const slot of d.tracerPool) { slot.actief = false; slot.mesh.visible = false; }
  for (const slot of d.impactPool) { slot.actief = false; slot.mesh.visible = false; }

  const tracerPoolMaatVoor = d.tracerPool.length;
  const impactPoolMaatVoor = d.impactPool.length;

  // Speler naar het noorden laten kijken, taaie ondoden (hoge HP, overleven
  // de hele stress-golf) er recht voor zetten zodat elk schot ook echt raakt.
  d.speler.positie.set(0, 1.7, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.camera.position.copy(d.speler.positie);
  d.camera.rotation.set(0, 0, 0);
  d.camera.updateMatrixWorld(true);
  for (let i = 0; i < 5; i++) {
    const o = d.spawnOndode(0, 'normaal');
    o.hp = 100000;
    o.groep.position.set(0, 0, -2 - i * 0.4);
  }

  // 50 echte schoten; magazijn/herladen elke keer resetten zodat alleen de
  // effect-/pool-paden onder stress komen, niet de munitie-economie.
  for (let i = 0; i < 50; i++) {
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
    d.wapenStaat.herladen = false;
    d.schiet();
  }

  return {
    tracerPoolMaatVoor, impactPoolMaatVoor,
    tracerPoolMaatNa: d.tracerPool.length,
    impactPoolMaatNa: d.impactPool.length,
    tracerMax: d.TRACER_MAX, impactMax: d.IMPACT_MAX,
    tracersActief: d.actieveEffecten.filter(e => e.soort === 'tracer').length,
    impactsActief: d.actieveEffecten.filter(e => e.soort === 'impact').length,
    winkelMarkeringenLengte: d.winkelMarkeringen.length,
    lampLichtenLengte: d.lampLichten.length,
    stofwolkenLengte: d.stofwolken.length,
  };
});
check('Na 50 echte schiet()-aanroepen blijft de tracer-pool precies TRACER_MAX groot (geen groei)',
  stressTest.tracerPoolMaatNa === stressTest.tracerPoolMaatVoor && stressTest.tracerPoolMaatNa === stressTest.tracerMax, stressTest);
check('Na 50 echte schiet()-aanroepen blijft de impact-pool precies IMPACT_MAX groot (geen groei)',
  stressTest.impactPoolMaatNa === stressTest.impactPoolMaatVoor && stressTest.impactPoolMaatNa === stressTest.impactMax, stressTest);
check('Actieve tracers blijven binnen TRACER_MAX, ook na de stress-golf',
  stressTest.tracersActief <= stressTest.tracerMax, stressTest);
check('Actieve impact-deeltjes blijven binnen IMPACT_MAX, ook na de stress-golf',
  stressTest.impactsActief <= stressTest.impactMax, stressTest);
// De getallen zijn kaartbrede tellers (+1 elk sinds De Zelflader resp. het
// vliering-traplampje); de strekking is onveranderd: ze GROEIEN NIET tijdens
// combat-stress.
check('Winkelmarkeringen groeien niet mee met combat-stress (blijft 14, incl. deur5 + deur6 + De Zelflader + Ticket 134 AMSTEL-9)',
  stressTest.winkelMarkeringenLengte === 14, stressTest);
check('lampLichten groeit niet mee met combat-stress (blijft 10, incl. kelder (3) + kelderoost (1) + vliering (1))',
  stressTest.lampLichtenLengte === 10, stressTest);
check('stofwolken groeit niet mee met combat-stress (blijft 2)',
  stressTest.stofwolkenLengte === 2, stressTest);

// --- 3. Chaos-smoke-run: Mistgolf + alle deuren open + winkel-aankopen +
// combat tegelijk, real-time via de al draaiende gameLoop -------------------
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.geld = 100000;
  d.spelStaat.golf = 8;
  d.koopDeur(); d.koopDeur2(); d.koopDeur3(); d.koopDeur4();
  d.koopRatelaar();
  d.startEventGolf('mist');
  d.speler.positie.set(0, 1.7, 0);
  const types = ['normaal', 'sjouwer', 'sluiper'];
  for (let i = 0; i < types.length; i++) {
    const o = d.spawnOndode(0, types[i]);
    o.groep.position.set(i - 1, 0, -2 - i);
  }
});
await page.waitForTimeout(1500);   // meerdere echte gameLoop-frames: AI, effecten, winkel-status, stof, druppel, lampflikker allemaal tegelijk
const chaosNa = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { levendeOndoden: d.ondoden.length, mistNogActief: d.actieveEventGolf === 'mist' };
});
check('Na 1.5s Mistgolf + alle deuren open + winkel-aankopen + combat tegelijk: geen enkele console-error',
  errs.length === 0, errs);
check('De simulatie draaide daadwerkelijk door (levende ondoden bevestigen dat de gameLoop actief bleef)',
  chaosNa.levendeOndoden > 0, chaosNa);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
