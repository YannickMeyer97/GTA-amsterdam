// Ticket D14 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — robots vallen
// torens aan.
//
// De bomber kiest een bouwwerk binnen BOMBER_DOEL_STRAAL als doel en
// ontploft daar; andere types laten torens met rust (en slaan alleen op een
// hek dat hun route blokkeert, zie test-dnm-hek.mjs).
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// Laat één robot lopen (alleen updateRobots — torens schieten hier niet
// terug, zodat de uitkomst niet van toeval afhangt) tot hij weg is of de
// tijd op is.
const LOOP = `(robot, maxT) => {
  const d = window.DamChaosDebug;
  let t = 0;
  while (t < maxT && d.robots.includes(robot)) { d.updateRobots(1 / 30); t += 1 / 30; }
  return t;
}`;

// --- 1. Een bomber kiest een toren binnen bereik en beschadigt hem --------

const aanval = await page.evaluate((LOOP) => {
  const d = window.DamChaosDebug;
  const loop = eval(LOOP);
  const plek = d.plekVoor('Damstraat', 'knooppunt');
  d.geldZet(1000);
  d.spel.monumentHP = 100;
  const toren = d.bouwToren(plek, 'geschut');
  const obstakelsMetToren = d.obstakels.length;
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Damstraat');

  // Bomber 8 m van de toren, aan de poortkant.
  d.spawnRobot(poort, 'bomber');
  const b1 = d.robots[d.robots.length - 1];
  b1.groep.position.set(plek.positie.x + 8, 0, plek.positie.z);
  const doelBijStart = d.kiesBomberDoel(b1.groep.position) === toren;
  loop(b1, 30);
  const naEerste = { bomberWeg: !d.robots.includes(b1), torenHp: toren.hp, torenStaat: d.torens.includes(toren), monumentHP: d.spel.monumentHP };

  // Tweede bomber: toren sneuvelt.
  d.spawnRobot(poort, 'bomber');
  const b2 = d.robots[d.robots.length - 1];
  b2.groep.position.set(plek.positie.x + 8, 0, plek.positie.z);
  loop(b2, 30);
  const naTweede = { torenStaat: d.torens.includes(toren), plekVrij: plek.toren === null,
    obstakelWeg: obstakelsMetToren - d.obstakels.length, uitScene: toren.groep.parent === null, monumentHP: d.spel.monumentHP };

  // De plek is weer bebouwbaar.
  const nieuw = d.bouwToren(plek, 'geschut');
  const herbouwd = !!nieuw && plek.toren === nieuw;
  d.verwijderToren(nieuw);
  return { schade: d.BOMBER_TORENSCHADE, straal: d.BOMBER_DOEL_STRAAL, doelBijStart, naEerste, naTweede, herbouwd };
}, LOOP);
check('Een bomber binnen 10 m van een toren kiest die toren als doel', aanval.doelBijStart && aanval.straal === 10, aanval);
check('De bomber ontploft bij de toren: 45 schade (60 → 15), het monument blijft heel', aanval.naEerste.bomberWeg && aanval.naEerste.torenHp === 15 && aanval.naEerste.torenStaat && aanval.naEerste.monumentHP === 100, aanval.naEerste);
check('Een tweede bomber vernietigt de toren: weg uit de scene, obstakel weg, plek vrij', !aanval.naTweede.torenStaat && aanval.naTweede.plekVrij && aanval.naTweede.obstakelWeg === 1 && aanval.naTweede.uitScene && aanval.naTweede.monumentHP === 100, aanval.naTweede);
check('Na vernietiging is de plek weer bebouwbaar', aanval.herbouwd, aanval);

// --- 2. Zonder toren in de buurt: gewoon naar het monument ----------------

const zonderDoel = await page.evaluate((LOOP) => {
  const d = window.DamChaosDebug;
  const loop = eval(LOOP);
  d.spel.monumentHP = 100;
  // Een toren ver weg, bij een andere poort.
  const verrePlek = d.plekVoor('Nieuwendijk', 'voorpost');
  const verreToren = d.bouwToren(verrePlek, 'geschut');
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Damstraat');
  d.spawnRobot(poort, 'bomber');
  const b = d.robots[d.robots.length - 1];
  const doelBijStart = d.kiesBomberDoel(b.groep.position);
  loop(b, 90);
  const uit = { doelBijStart: doelBijStart === null, weg: !d.robots.includes(b), monumentHP: d.spel.monumentHP, verreTorenHp: verreToren.hp };
  d.verwijderToren(verreToren);
  return uit;
}, LOOP);
check('Een bomber zonder bouwwerk binnen 10 m gaat op het monument af (25 schade)', zonderDoel.doelBijStart && zonderDoel.weg && zonderDoel.monumentHP === 75 && zonderDoel.verreTorenHp === 60, zonderDoel);

// --- 3. Andere types laten torens met rust --------------------------------

const anderen = await page.evaluate((LOOP) => {
  const d = window.DamChaosDebug;
  const loop = eval(LOOP);
  d.spel.monumentHP = 100;
  const plek = d.plekVoor('Damstraat', 'knooppunt');
  const toren = d.bouwToren(plek, 'geschut');
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Damstraat');
  const uit = {};
  for (const type of ['normal', 'tank', 'sprinter']) {
    d.spel.monumentHP = 100;
    d.spawnRobot(poort, type);
    const r = d.robots[d.robots.length - 1];
    r.groep.position.set(plek.positie.x + 8, 0, plek.positie.z);
    loop(r, 90);
    uit[type] = { naarMonument: d.spel.monumentHP < 100, torenHp: toren.hp };
  }
  d.verwijderToren(toren);
  return uit;
}, LOOP);
check('Normale robots, tanks en sprinters lopen langs een toren door naar het monument, toren ongedeerd',
  Object.values(anderen).every(u => u.naarMonument && u.torenHp === 60), anderen);

// --- 4. Een bomber ontploft ook op een hek ---------------------------------

const hek = await page.evaluate((LOOP) => {
  const d = window.DamChaosDebug;
  const loop = eval(LOOP);
  d.spel.monumentHP = 100;
  const plek = d.plekVoor('Rokin', 'knooppunt');
  const h = d.bouwToren(plek, 'hek');
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Rokin');
  d.spawnRobot(poort, 'bomber');
  const b = d.robots[d.robots.length - 1];
  loop(b, 90);
  const uit = { weg: !d.robots.includes(b), hekHp: h.hp, monumentHP: d.spel.monumentHP };
  d.verwijderToren(h);
  return uit;
}, LOOP);
check('Een bomber die een hek tegenkomt, ontploft erop (120 → 75), monument heel', hek.weg && hek.hekHp === 75 && hek.monumentHP === 100, hek);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
