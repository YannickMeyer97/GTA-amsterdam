// Ticket D85 (fase T) — lichte richthulp, alleen op touch.
//
// Een robot vrij op het plein, 10 m voor de speler. Telkens wordt er een
// paar graden naast gericht en geschoten:
// - 4° naast (0,7 m, voorbij de armen): met de muis mis, op touch raak;
// - 10° naast: ook op touch mis;
// - een robot achter het monument: geen treffer via de trefmarge (vrij zicht);
// - kleven: vlak bij een robot draait een duimveeg trager, ver ervan niet.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const M = d.MONUMENT_POSITIE;
  const uit = {};
  d.resetRun();
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0;
  // Speler op het plein, kijkend naar -z; robot 10 m voor hem.
  const sp = { x: M.x + 4, z: M.z + 24 };
  d.spawnRobot(null, 'normal');
  const robot = d.robots.at(-1);
  robot.snelheid = 0; robot.hp = 1000;
  robot.groep.position.set(sp.x, 0, sp.z - 10);
  robot.groep.updateMatrixWorld(true);
  const richt = graden => {
    d.speler.positie.set(sp.x, 0, sp.z);
    d.speler.yaw = graden * Math.PI / 180;   // yaw 0 = naar -z
    d.speler.pitch = Math.atan2(1.1 * robot.groep.scale.x - 1.6, 10);   // op borsthoogte
    d.updateSpeler(0);
    d.camera.updateMatrixWorld(true);
    d.scene.updateMatrixWorld(true);
  };
  const schot = graden => { richt(graden); const hp = robot.hp; d.schiet(); return hp - robot.hp; };
  uit.recht = schot(0);
  uit.muis4 = schot(4);
  d.zetBesturingModus('touch');
  uit.touch4 = schot(4);
  uit.touch10 = schot(10);
  uit.touchRecht = schot(0);
  // Kleven: binnen of buiten de kleefhoek (de echte veeg staat onderaan).
  uit.kleefDichtbij = (richt(3), d.robotBijRichtkruis(d.RICHTHULP_KLEEF_HOEK) === robot);
  uit.kleefVer = (richt(15), d.robotBijRichtkruis(d.RICHTHULP_KLEEF_HOEK) === robot);
  // Achter het monument: de speler aan de ene kant, de robot pal erachter.
  robot.groep.position.set(M.x, 0, M.z - 8);
  robot.groep.updateMatrixWorld(true);
  d.speler.positie.set(M.x, 0, M.z + 9);
  d.speler.yaw = 2 * Math.PI / 180; d.speler.pitch = 0;
  d.updateSpeler(0); d.camera.updateMatrixWorld(true); d.scene.updateMatrixWorld(true);
  uit.achterMonument = { inMarge: d.robotBijRichtkruis(d.RICHTHULP_HOEK) === robot, treffer: !!d.richthulpTreffer() };
  // Terug naar de muis: geen hulp.
  d.zetBesturingModus('muis');
  uit.muisHulp = d.robotBijRichtkruis(Math.PI);
  return uit;
});
check('Recht op de robot: raak (zonder hulp)', r.recht > 0, r);
check('Met de muis: 4° naast (0,7 m, voorbij de armen) is mis (geen richthulp)', r.muis4 === 0, r);
check('Op touch: 4° naast is raak (trefmarge)', r.touch4 > 0, r);
check('Op touch: 10° naast blijft mis', r.touch10 === 0, r);
check('Op touch: recht erop blijft gewoon raak', r.touchRecht > 0, r);
check('Kleven: binnen 6° van een robot wel, op 15° niet', r.kleefDichtbij && !r.kleefVer, r);
check('Geen treffer door het monument heen, ook niet als de robot binnen de marge staat', r.achterMonument.inMarge && !r.achterMonument.treffer, r.achterMonument);
check('Met de muis zoekt de richthulp niets', r.muisHulp === null, r.muisHulp);

// Kleven in het echt: dezelfde veeg (100 px) vlak bij een robot draait minder.
const { browser: b2, page: p2, errs: e2 } = await openDefend({ contextOpties: { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } } });
const k = await p2.evaluate(() => { const r = document.querySelector('#startscherm .knop').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await p2.touchscreen.tap(...k);
await p2.waitForTimeout(200);
const cdp = await p2.context().newCDPSession(p2);
const veeg = async () => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 200, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 610, y: 200, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const opzet = (metRobot) => p2.evaluate((metRobot) => {
  const d = window.DamChaosDebug;
  const M = d.MONUMENT_POSITIE;
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0; d.spel.maxActieveRobots = 0;
  d.speler.positie.set(M.x + 4, 0, M.z + 24); d.speler.yaw = 0; d.speler.pitch = 0;
  if (metRobot) { d.spawnRobot(null, 'normal'); const r = d.robots.at(-1); r.snelheid = 0; r.groep.position.set(M.x + 4, 0, M.z + 14); }
  d.updateSpeler(0); d.camera.updateMatrixWorld(true);
  return d.speler.yaw;
}, metRobot);
const yawZonder0 = await opzet(false); await veeg();
const zonder = yawZonder0 - await p2.evaluate(() => window.DamChaosDebug.speler.yaw);
const yawMet0 = await opzet(true); await veeg();
const met = yawMet0 - await p2.evaluate(() => window.DamChaosDebug.speler.yaw);
check('Een duimveeg vlak bij een robot draait trager (factor 0,55)', zonder > 0 && Math.abs(met / zonder - 0.55) < 0.02, { zonder, met });
await b2.close();

const fails = report([...errs, ...e2]);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
