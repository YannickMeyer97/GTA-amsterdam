// Ticket D9 (SONNET_EXECUTION_PLAN_monument.md, Fase 2) — opnieuw spelen
// zonder verversen.
//
// resetRun() is precies het soort functie waar state-lekken zich verstoppen.
// Daarom: momentopname van de beginstaat bij het laden, een volledige run
// simuleren (upgrades, boost, kills, munten, schoten, game over), resetten,
// en dan ELKE geëxporteerde teller vergelijken met die momentopname — niet
// een handvol velden die we toevallig bedenken.
import { openDefend, frames, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// Dezelfde functie wordt vóór en ná de run in de pagina uitgevoerd.
const MOMENTOPNAME = `(() => {
  const d = window.DamChaosDebug;
  const spel = JSON.parse(JSON.stringify(d.spel));
  // Ticket D28: welke poort wave 1 krijgt is bewust willekeurig — geen lek.
  // Het AANTAL (1 in wave 1) moet wel kloppen.
  spel.actievePoorten = spel.actievePoorten.length;
  return {
    spel,
    upgrades: { ...d.upgrades },
    kerkklokBoost: { ...d.kerkklokBoost },
    runStats: JSON.parse(JSON.stringify(d.runStats)),
    speler: { x: d.speler.positie.x, y: d.speler.positie.y, z: d.speler.positie.z,
              yaw: d.speler.yaw, pitch: d.speler.pitch, snelheid: d.speler.snelheid, bobTijd: d.speler.bobTijd },
    losseState: d.runStateStand(),
    aantalRobots: d.robots.length,
    aantalMunten: d.munten.length,
    sceneKinderen: d.scene.children.length,
    // Ticket D20: de zichtbare monumentschade hoort bij de run.
    monument: { tier: d.monumentSchade.tier, overgangen: d.monumentSchade.overgangen,
                spits: d.monumentSchade.delen.top.visible, rook: d.monumentSchade.delen.rook.visible,
                scheef: d.monumentSchade.delen.pyloon.rotation.z },
    eindschermZichtbaar: getComputedStyle(document.getElementById('eindscherm')).display !== 'none',
  };
})()`;

async function zetPointerLock(aan) {
  await page.evaluate((aan) => {
    const canvas = window.DamChaosDebug.renderer.domElement;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return aan ? canvas : null; } });
    document.dispatchEvent(new Event('pointerlockchange'));
  }, aan);
}

// Geeft een lijst "pad: begin → nu" van elk verschil tussen twee objecten.
function verschillen(a, b, pad = '') {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return Object.is(a, b) ? [] : [`${pad}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
  }
  const sleutels = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...sleutels].flatMap(k => verschillen(a[k], b[k], pad ? `${pad}.${k}` : k));
}

// --- 1. Beginstaat, vóór er iets gespeeld is -------------------------------

const begin = await page.evaluate(MOMENTOPNAME);

// --- 2. Een volledige run --------------------------------------------------

await zetPointerLock(true);
await frames(page, 60);   // wave-systeem draait, robots spawnen, speelduur loopt

const tijdensRun = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.geldZet(100000);
  for (let i = 0; i < 5; i++) d.koopUpgrade('snelheid');
  for (let i = 0; i < 2; i++) d.koopUpgrade('vuurtempo');
  d.koopUpgrade('pickup');
  d.activeerKerkklokBoost();
  // Ticket D11: een toren die ook echt schiet (schotspoor, obstakel, torenkill).
  const toren = d.bouwToren(d.BOUWPLEKKEN[0], 'geschut');
  d.spawnRobot(null, 'normal');
  d.robots[d.robots.length - 1].groep.position.set(toren.plek.positie.x + 4, 0, toren.plek.positie.z);
  d.updateTorens(0);

  // Een paar kills: munten en brokstukken belanden in de scene, combo en
  // special-meter lopen op.
  for (let i = 0; i < 4; i++) {
    d.spawnRobot(null, i % 2 ? 'tank' : 'normal');
    d.vernietigRobot(d.robots[d.robots.length - 1]);
  }
  d.schiet(); d.schiet();

  d.speler.positie.set(d.speler.positie.x + 5, 0, d.speler.positie.z - 4);
  d.speler.yaw = 0.4; d.speler.pitch = -0.3;
  return { snelheid: d.speler.snelheid, boost: d.kerkklokBoost.active, torens: d.torens.length, torenKills: d.runStats.torenKills };
});

await frames(page, 30);

const voorReset = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  // Monument onderuit: eerst een gewone treffer (perfect-wave weg), dan de doodsklap.
  d.spawnRobot(null, 'normal');
  d.robotRaaktMonument(d.robots[d.robots.length - 1]);
  d.spawnRobot(null, 'bomber');
  d.spel.monumentHP = 1;
  d.robotRaaktMonument(d.robots[d.robots.length - 1]);
  return { gameOver: d.spel.gameOver, munten: d.munten.length, robots: d.robots.length, score: d.spel.score,
    monumentTier: d.monumentSchade.tier };
});

check('De run liet echt sporen na (snelheid-upgrade, boost, munten, score, monument kapot, game over)',
  tijdensRun.snelheid > 7 && tijdensRun.boost && tijdensRun.torens === 1 && tijdensRun.torenKills === 1 && voorReset.munten > 0 && voorReset.score > 0 && voorReset.monumentTier === 3 && voorReset.gameOver,
  { tijdensRun, voorReset });

// --- 3. Reset, en alles vergelijken met de beginstaat ----------------------

await zetPointerLock(false);
await page.evaluate(() => window.DamChaosDebug.resetRun());
const na = await page.evaluate(MOMENTOPNAME);

const lekken = verschillen(begin, na);
check('Na resetRun() is ELKE geëxporteerde teller terug op de beginstaat', lekken.length === 0, lekken);
check('speler.snelheid is terug op 7 na vijf snelheid-upgrades', na.speler.snelheid === 7, na.speler);
check('Geen robots, munten of brokstukken meer in de scene (aantal scene-kinderen gelijk aan het begin)',
  na.sceneKinderen === begin.sceneKinderen && na.aantalRobots === 0 && na.aantalMunten === 0,
  { begin: begin.sceneKinderen, na: na.sceneKinderen });
check('Het eindscherm is weg na de reset', !na.eindschermZichtbaar, na);

// --- 4. Na de reset is het spel echt weer speelbaar ------------------------

await zetPointerLock(true);
await frames(page, 30);
const weerSpelen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const schotenVoor = d.runStats.schoten;
  d.probeerTeSchieten();
  return {
    robots: d.robots.length,
    wave: d.spel.wave,
    gameOver: d.spel.gameOver,
    schotGeteld: d.runStats.schoten === schotenVoor + 1,
    speelduur: d.runStats.speelduur,
  };
});
check('Na de reset spawnen er weer robots in wave 1', weerSpelen.robots > 0 && weerSpelen.wave === 1 && !weerSpelen.gameOver, weerSpelen);
check('Na de reset werkt schieten weer', weerSpelen.schotGeteld, weerSpelen);
check('Na de reset loopt de speelduur weer vanaf 0 op', weerSpelen.speelduur > 0 && weerSpelen.speelduur < 5, weerSpelen);

// --- 5. De Opnieuw-knop op het eindscherm ---------------------------------

const knop = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  let lockVerzoeken = 0;
  d.renderer.domElement.requestPointerLock = () => { lockVerzoeken++; };
  d.spel.monumentHP = 1;
  d.spawnRobot(null, 'normal');
  d.robotRaaktMonument(d.robots[d.robots.length - 1]);
  const eindschermVoor = getComputedStyle(document.getElementById('eindscherm')).display !== 'none';
  document.getElementById('opnieuwKnop').click();
  return {
    eindschermVoor,
    eindschermNa: getComputedStyle(document.getElementById('eindscherm')).display !== 'none',
    startschermNa: getComputedStyle(document.getElementById('startscherm')).display,
    gameOver: d.spel.gameOver,
    hp: d.spel.monumentHP,
    lockVerzoeken,
  };
});
check('De Opnieuw-knop staat op het eindscherm na game over', knop.eindschermVoor, knop);
check('Klik op Opnieuw: run gereset (geen game over, monument 100)', !knop.gameOver && knop.hp === 100, knop);
check('Klik op Opnieuw: eindscherm weg en pointer lock aangevraagd', !knop.eindschermNa && knop.lockVerzoeken === 1, knop);
check('Klik op Opnieuw: startscherm staat als vangnet klaar tot de lock er is', knop.startschermNa === 'flex', knop);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
