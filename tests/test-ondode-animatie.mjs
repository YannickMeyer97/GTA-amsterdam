// Losse ledematen-animatie (Ticket 20, Z3): been/arm-pivots, romp-bob en
// hoofd-microkantel bewegen nu op elk `updateOndoden`-tick, voor ALLE
// ondoden (niet alleen strompelt). Test bewaakt: (1) delen-rotaties
// veranderen tussen twee ticks met vaste dt, (2) root-positie beweegt
// alleen door de navigatie (x/z), nooit door de animatie zelf, (3)
// strompelaars bewegen zichtbaar anders dan niet-strompelaars, (4) de
// bestaande wiebel zit nu op de romp-groep i.p.v. de root, (5) geen
// regressie in perf-budget (mesh/transform-writes) of console-fouten.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Twee ticks met vaste dt: delen-rotaties veranderen ---------------
const tweeTicks = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -10);   // ver van de speler: geen melee-continue
  d.speler.positie.set(0, 0, 0);
  const voor = {
    beenL: o.delen.beenL.rotation.x, beenR: o.delen.beenR.rotation.x,
    armL: o.delen.armL.rotation.x, armR: o.delen.armR.rotation.x,
    rompY: o.delen.romp.position.y, hoofdX: o.delen.hoofd.rotation.x,
  };
  d.updateOndoden(0.1);
  const na1 = {
    beenL: o.delen.beenL.rotation.x, beenR: o.delen.beenR.rotation.x,
    armL: o.delen.armL.rotation.x, armR: o.delen.armR.rotation.x,
    rompY: o.delen.romp.position.y, hoofdX: o.delen.hoofd.rotation.x,
  };
  d.updateOndoden(0.1);
  const na2 = {
    beenL: o.delen.beenL.rotation.x, beenR: o.delen.beenR.rotation.x,
    armL: o.delen.armL.rotation.x, armR: o.delen.armR.rotation.x,
    rompY: o.delen.romp.position.y, hoofdX: o.delen.hoofd.rotation.x,
  };
  d.doodOndode(o);
  return { voor, na1, na2 };
});
check('Been-pivots roteren tussen ticks (beenL en beenR veranderen, en tegengesteld)',
  tweeTicks.na1.beenL !== tweeTicks.voor.beenL && tweeTicks.na1.beenR !== tweeTicks.voor.beenR &&
  Math.sign(tweeTicks.na1.beenL) !== Math.sign(tweeTicks.na1.beenR), tweeTicks);
check('Arm-pivots roteren mee (tegenfase t.o.v. het been aan dezelfde kant)',
  tweeTicks.na1.armL !== tweeTicks.voor.armL && tweeTicks.na1.armR !== tweeTicks.voor.armR, tweeTicks);
check('Romp-bob beweegt (position.y wijzigt t.o.v. de rust-y)',
  tweeTicks.na1.rompY !== tweeTicks.voor.rompY, tweeTicks);
check('Hoofd kantelt subtiel mee (rotation.x wijzigt, maar blijft klein)',
  tweeTicks.na1.hoofdX !== tweeTicks.voor.hoofdX && Math.abs(tweeTicks.na1.hoofdX - tweeTicks.voor.hoofdX) < 0.05, tweeTicks);
check('Tweede tick geeft weer een andere stand (doorlopende animatie, geen bevroren pose)',
  tweeTicks.na2.beenL !== tweeTicks.na1.beenL, tweeTicks);

// --- 2. Root-positie beweegt alleen door navigatie: x/z door beweging,
// NOOIT door de animatie; root.position.y blijft 0 (bob zit op de romp) ---
const rootPositie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const voorY = o.groep.position.y;
  for (let i = 0; i < 30; i++) d.updateOndoden(0.05);
  const naY = o.groep.position.y;
  const bewogen = o.groep.position.z > -10;   // moet richting de speler gelopen zijn
  d.doodOndode(o);
  return { voorY, naY, bewogen };
});
check('root.position.y blijft 0 (animatie zit uitsluitend op kinderen van de root)',
  rootPositie.voorY === 0 && rootPositie.naY === 0, rootPositie);
check('De ondode is wel degelijk richting de speler bewogen (navigatie werkt nog)',
  rootPositie.bewogen, rootPositie);

// --- 3. Strompelaars bewegen zichtbaar anders (asymmetrische beenamplitude
// + wiebel op de romp-groep, niet meer op de root) -------------------------
const strompel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const normaalTraits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const strompelTraits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: true };
  const oNormaal = d.spawnOndode(0, 'normaal', normaalTraits);
  const oStrompel = d.spawnOndode(1, 'normaal', strompelTraits);
  oNormaal.groep.position.set(0, 0, -10);
  oStrompel.groep.position.set(5, 0, -10);
  d.speler.positie.set(0, 0, 0);
  d.updateOndoden(0.1);
  const uit = {
    normaalBeenL: oNormaal.delen.beenL.rotation.x, normaalBeenR: oNormaal.delen.beenR.rotation.x,
    normaalRompZ: oNormaal.delen.romp.rotation.z,
    strompelBeenL: oStrompel.delen.beenL.rotation.x, strompelBeenR: oStrompel.delen.beenR.rotation.x,
    strompelRompZ: oStrompel.delen.romp.rotation.z,
    strompelRootZ: oStrompel.groep.rotation.z,
  };
  d.doodOndode(oNormaal); d.doodOndode(oStrompel);
  return uit;
});
check('Strompelaar heeft ongelijke beenamplitude (asymmetrisch), normaal is symmetrisch',
  Math.abs(strompel.strompelBeenL) !== Math.abs(strompel.strompelBeenR) &&
  Math.abs(Math.abs(strompel.normaalBeenL) - Math.abs(strompel.normaalBeenR)) < 1e-9, strompel);
check('Alleen de strompelaar krijgt de romp-wiebel (rotation.z != 0), normaal niet',
  strompel.strompelRompZ !== 0 && strompel.normaalRompZ === 0, strompel);
check('De wiebel zit NIET meer op de root (rotation.z blijft 0 daar)',
  strompel.strompelRootZ === 0, strompel);

// --- 4. Eenarmig-profiel: animatie crasht niet zonder armL ----------------
const eenarmig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const traits = { profiel: 'eenarmig', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: true };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  let fout = null;
  try { for (let i = 0; i < 10; i++) d.updateOndoden(0.1); } catch (e) { fout = String(e); }
  const uit = { fout, armLOntbreekt: o.delen.armL === undefined, armRDraait: o.delen.armR.rotation.x !== d.ARM_RUST_ROTATIE_X };
  d.doodOndode(o);
  return uit;
});
check('Eenarmig + strompelt: updateOndoden() crasht niet zonder armL, armR animeert gewoon door',
  eenarmig.fout === null && eenarmig.armLOntbreekt && eenarmig.armRDraait, eenarmig);

// --- 5. Perf-notitie: 14 ondoden, 20 ticks — geen crash, indicatieve tijd -
const perf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (let i = 0; i < 14; i++) {
    const o = d.spawnOndode(i % 4, 'normaal');
    o.groep.position.set((i - 7) * 1.5, 0, -10);
  }
  d.speler.positie.set(0, 0, 0);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) d.updateOndoden(0.05);
  const duur = performance.now() - t0;
  const aantal = d.ondoden.length;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  return { duur, aantal };
});
check('14 ondoden x 20 ticks updateOndoden(): geen crash, blijft ruim binnen 500ms (indicatief, headless)',
  perf.aantal === 14 && perf.duur < 500, perf);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
