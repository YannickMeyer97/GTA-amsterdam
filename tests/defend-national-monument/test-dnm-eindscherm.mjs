// Ticket D7 (SONNET_EXECUTION_PLAN_monument.md, Fase 2) — eindscherm met
// statistieken, en: na game over valt álles stil.
//
// Pointer lock blijft in deze test bewust gesimuleerd AAN na game over. In
// het echte spel verlaat eindigRun() de lock, maar precies de "lock nog aan"-
// situatie bewijst dat de game-over-gate zelf werkt en niet leunt op het
// toevallig wegvallen van de lock.
import { openDefend, frames, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Wave-systeem even leeg laten lopen zodat alleen onze eigen robots bestaan.
await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// --- 1. Statistieken tijdens een gesimuleerde run --------------------------

const tijdensRun = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const s = d.runStats;
  const start = JSON.parse(JSON.stringify(s));

  // Treffer: robot recht voor de camera, dan één echt schot.
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);
  d.spawnRobot(null, 'normal');
  const doel = d.robots[d.robots.length - 1];
  doel.groep.position.set(d.speler.positie.x, 0, d.speler.positie.z - 6);
  doel.groep.updateMatrixWorld(true);
  d.schiet();
  const naTreffer = { schoten: s.schoten, treffers: s.treffers, normal: s.kills.normal, robotWeg: !d.robots.includes(doel) };

  // Misser: recht omhoog in de lucht.
  d.speler.pitch = 1.4;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);
  d.schiet();
  const naMisser = { schoten: s.schoten, treffers: s.treffers };

  // Kill van een ander type, rechtstreeks.
  d.spawnRobot(null, 'tank');
  d.vernietigRobot(d.robots[d.robots.length - 1]);

  // Geld: een bonus via verdienGeld, en een munt die echt opgeraapt wordt.
  const geldVoor = d.geldStand();
  d.verdienGeld(37);
  const muntenVoor = d.munten.length;
  d.legMuntNeer(d.speler.positie.clone(), 1);
  const munt = d.munten[d.munten.length - 1];
  const muntBedrag = munt.bedrag;
  d.updateMunten(0);

  return {
    start, naTreffer, naMisser,
    tank: s.kills.tank,
    verdiend: s.verdiendGeld - start.verdiendGeld,
    verwachtVerdiend: 37 + muntBedrag,
    geldGestegen: d.geldStand() - geldVoor,
    muntOpgeraapt: d.munten.length === muntenVoor,
    hoogsteCombo: s.hoogsteCombo,
    combo: d.spel.combo,
  };
});

check('Een schot telt als schot', tijdensRun.naTreffer.schoten === tijdensRun.start.schoten + 1, tijdensRun);
check('Een raak schot op een robot telt als treffer', tijdensRun.naTreffer.treffers === tijdensRun.start.treffers + 1, tijdensRun);
check('De geraakte normale robot is vernietigd en telt als kill "normal"', tijdensRun.naTreffer.robotWeg && tijdensRun.naTreffer.normal === 1, tijdensRun);
check('Een misser telt als schot maar niet als treffer', tijdensRun.naMisser.schoten === tijdensRun.start.schoten + 2 && tijdensRun.naMisser.treffers === tijdensRun.start.treffers + 1, tijdensRun);
check('Kills worden per type bijgehouden (tank)', tijdensRun.tank === 1, tijdensRun);
check('verdiendGeld telt bonus + opgeraapte munt precies op', tijdensRun.verdiend === tijdensRun.verwachtVerdiend, tijdensRun);
check('...en komt overeen met wat er werkelijk bij geld bijkwam', tijdensRun.geldGestegen === tijdensRun.verwachtVerdiend, tijdensRun);
check('De munt is echt opgeraapt', tijdensRun.muntOpgeraapt, tijdensRun);
check('hoogsteCombo volgt de combo (2 kills op rij)', tijdensRun.hoogsteCombo >= 2 && tijdensRun.hoogsteCombo >= tijdensRun.combo, tijdensRun);

// --- 2. Speelduur telt alleen actief spel ---------------------------------

const duurActiefVoor = await page.evaluate(() => window.DamChaosDebug.runStats.speelduur);
await frames(page, 20);
const duurActiefNa = await page.evaluate(() => window.DamChaosDebug.runStats.speelduur);
check('Speelduur loopt op tijdens actief spel', duurActiefNa > duurActiefVoor, { duurActiefVoor, duurActiefNa });

const duurPauze = await page.evaluate(async () => {
  const canvas = window.DamChaosDebug.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  const voor = window.DamChaosDebug.runStats.speelduur;
  await new Promise(r => { let i = 0; const t = () => (++i >= 20 ? r() : requestAnimationFrame(t)); requestAnimationFrame(t); });
  const na = window.DamChaosDebug.runStats.speelduur;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return { voor, na };
});
check('Speelduur staat stil tijdens de pauze', duurPauze.na === duurPauze.voor, duurPauze);

// --- 3. Game over: eindscherm met kloppende inhoud ------------------------

const eind = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const eindscherm = document.getElementById('eindscherm');
  const zichtbaarVoor = getComputedStyle(eindscherm).display !== 'none';
  d.spawnRobot(null, 'normal');
  const robot = d.robots[d.robots.length - 1];
  d.spel.monumentHP = d.ROBOT_TYPES.normal.monumentSchade;
  d.robotRaaktMonument(robot);
  const s = d.runStats;
  const totaalKills = Object.values(s.kills).reduce((a, b) => a + b, 0);
  return {
    zichtbaarVoor,
    zichtbaarNa: getComputedStyle(eindscherm).display !== 'none',
    gameOver: d.spel.gameOver,
    tekst: eindscherm.textContent,
    score: d.spel.score,
    wave: d.spel.wave,
    totaalKills,
    trefferPct: Math.round((s.treffers / s.schoten) * 100),
    verdiend: s.verdiendGeld,
  };
});
check('Eindscherm is verborgen tijdens het spel', !eind.zichtbaarVoor, eind);
check('Eindscherm verschijnt bij game over', eind.zichtbaarNa && eind.gameOver, eind);
check('Eindscherm toont de score', eind.tekst.includes(String(eind.score)), eind);
check('Eindscherm toont de bereikte wave', eind.tekst.includes(`Wave ${eind.wave} bereikt`), eind);
check('Eindscherm toont het totaal aantal kills', eind.tekst.includes(`Robots vernietigd${eind.totaalKills}`), eind);
check('Eindscherm toont het trefferpercentage', eind.tekst.includes(`${eind.trefferPct}%`), eind);
check('Eindscherm toont het verdiende geld', eind.tekst.includes(`€${eind.verdiend}`), eind);
check('Eindscherm toont kills per type met weergavenaam', eind.tekst.includes('Grunt 1') && eind.tekst.includes('Tank 1'), eind);

// --- 4. Na game over valt alles stil (pointer lock nog gesimuleerd aan) ----

const stil = await page.evaluate(async () => {
  const d = window.DamChaosDebug;
  d.spawnRobot(null, 'normal');
  const robot = d.robots[d.robots.length - 1];
  const posVoor = robot.groep.position.clone();
  const geldVoor = d.geldStand();
  d.legMuntNeer(d.speler.positie.clone(), 1);
  const muntenVoor = d.munten.length;
  const schotenVoor = d.runStats.schoten;
  const duurVoor = d.runStats.speelduur;
  await new Promise(r => { let i = 0; const t = () => (++i >= 30 ? r() : requestAnimationFrame(t)); requestAnimationFrame(t); });
  d.probeerTeSchieten();
  window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  return {
    robotVerplaatst: robot.groep.position.distanceTo(posVoor),
    muntNogDaar: d.munten.length === muntenVoor,
    geldGelijk: d.geldStand() === geldVoor,
    schotenGelijk: d.runStats.schoten === schotenVoor,
    duurGelijk: d.runStats.speelduur === duurVoor,
  };
});
check('Na game over bewegen robots niet meer', stil.robotVerplaatst === 0, stil);
check('Na game over wordt een munt onder je voeten niet opgeraapt', stil.muntNogDaar && stil.geldGelijk, stil);
check('Na game over doet een schot niets (ook niet via mousedown)', stil.schotenGelijk, stil);
check('Na game over loopt de speelduur niet door', stil.duurGelijk, stil);

// --- 5. Pointer lock wegvallen / startscherm klikken na game over ----------

const schermen = await page.evaluate(() => {
  const canvas = window.DamChaosDebug.renderer.domElement;
  let lockVerzoeken = 0;
  canvas.requestPointerLock = () => { lockVerzoeken++; };
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  document.getElementById('startscherm').click();
  return {
    startscherm: getComputedStyle(document.getElementById('startscherm')).display,
    eindscherm: getComputedStyle(document.getElementById('eindscherm')).display,
    lockVerzoeken,
  };
});
check('Na game over toont het wegvallen van pointer lock NIET het pauzescherm', schermen.startscherm === 'none', schermen);
check('...het eindscherm blijft staan', schermen.eindscherm !== 'none', schermen);
check('Een klik op het (verborgen) startscherm vraagt geen pointer lock meer aan', schermen.lockVerzoeken === 0, schermen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
