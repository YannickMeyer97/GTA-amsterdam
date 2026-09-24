// Ticket D33 (SONNET_EXECUTION_PLAN_monument.md §11.5, fase M) — vaste
// routes over de rijbanen.
//
// Robots lopen hun route af op afstand langs de route (s), in een eigen
// baan binnen de strook, met afstand tot een voorganger. Deze test gebruikt
// echte robots en de echte updateRobots(), geen nagebootste route.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// --- 1. Elke poort, elk robottype: via de route naar het monument --------

const perType = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  const uit = [];
  for (const poort of d.SPAWN_POORTEN) {
    for (const type of Object.keys(d.ROBOT_TYPES)) {
      for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
      d.spel.monumentHP = 100; d.spel.gameOver = false;
      d.spawnRobot(poort, type);
      const robot = d.robots[d.robots.length - 1];
      const route = d.ROUTES.get(poort.naam);
      let t = 0, maxBuiten = -Infinity, maxBuitenInfo = null, sTerug = false, vorigeS = 0;
      while (t < 120 && d.robots.includes(robot)) {
        d.updateRobots(DT); t += DT;
        if (!d.robots.includes(robot)) break;
        // Hoe ver steekt het midden van de robot buiten de strook uit? In een
        // bocht waar een brede rijbaan overgaat in een smalle strook geldt
        // de bredere van de twee (binnen 3 m langs de route): daar staat hij
        // nog op de rijbaan terwijl hij naar de strook toe stuurt.
        const pr = d.projecteerOpRoute(route, robot.groep.position.x, robot.groep.position.z);
        const breedte = Math.max(...[-3, 0, 3].map(ds => d.puntOp(route, Math.max(0, pr.s + ds)).breedte));
        const buiten = pr.afstand - breedte / 2;
        if (buiten > maxBuiten) { maxBuiten = buiten; maxBuitenInfo = { s: pr.s, afstand: pr.afstand, breedte: pr.segment.breedte }; }
        if (robot.s < vorigeS - 1e-9) sTerug = true;
        vorigeS = robot.s;
      }
      uit.push({ poort: poort.naam, type, bereikt: !d.robots.includes(robot) && d.spel.monumentHP < 100, tijd: +t.toFixed(1),
        maxBuiten: +maxBuiten.toFixed(2), maxBuitenInfo, sTerug, lengte: route.lengte });
    }
  }
  return uit;
});
for (const poort of [...new Set(perType.map(u => u.poort))]) {
  const rijen = perType.filter(u => u.poort === poort);
  check(`${poort}: een robot van elk type bereikt het monument via de route`, rijen.every(u => u.bereikt), rijen.map(u => [u.type, u.bereikt, u.tijd]));
  check(`${poort}: geen robot komt ooit buiten de strook (midden ≤ halve breedte)`, rijen.every(u => u.maxBuiten <= 0), rijen.map(u => [u.type, u.maxBuiten, u.maxBuitenInfo]));
  check(`${poort}: s loopt nooit terug`, rijen.every(u => !u.sTerug), rijen.map(u => [u.type, u.sTerug]));
}

// --- 2. Eigen baan: robots spreiden over de breedte van de strook ---------

const banen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Damrak');
  const uit = [];
  for (const f of [-1, 0, 1]) {
    d.spawnRobot(poort, 'normal');
    const r = d.robots[d.robots.length - 1];
    r.laanFractie = f;
    const p = d.robotRoutePunt(r, 10);
    uit.push({ f, x: +p.x.toFixed(2), z: +p.z.toFixed(2), baanRijbaan: +d.robotBaan(r, 10).toFixed(2), baanPlein: +d.robotBaan(r, d.ROUTES.get('Damrak').lengte - 3).toFixed(2) });
  }
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  return { uit, marge: d.ROBOT_BAAN_MARGE };
});
check('Op het Damrak (9 m) liggen de buitenste banen 7,4 m uit elkaar, de middelste in het midden',
  Math.abs(banen.uit[2].baanRijbaan - banen.uit[0].baanRijbaan - 2 * (4.5 - banen.marge)) < 1e-6 && banen.uit[1].baanRijbaan === 0, banen);
check('Op de strook over het plein (3 m) versmallen de banen tot ±0,7 m',
  Math.abs(banen.uit[2].baanPlein - (1.5 - banen.marge)) < 1e-6 && Math.abs(banen.uit[0].baanPlein + (1.5 - banen.marge)) < 1e-6, banen);

// --- 3. Onderlinge afstand: een snelle robot haalt in zijn baan niet in ---

const afstand = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.monumentHP = 100; d.spel.gameOver = false;
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Rokin');
  d.spawnRobot(poort, 'tank');
  const voor = d.robots[d.robots.length - 1];
  voor.laanFractie = 0.3;
  const vp = d.robotRoutePunt(voor, 0); voor.groep.position.set(vp.x, 0, vp.z);   // meteen in zijn baan, zoals bij een gewone spawn
  for (let i = 0; i < 45; i++) d.updateRobots(DT);   // 1,5 s voorsprong
  d.spawnRobot(poort, 'sprinter');
  const achter = d.robots[d.robots.length - 1];
  achter.laanFractie = 0.35;                          // zelfde baan
  const ap = d.robotRoutePunt(achter, 0); achter.groep.position.set(ap.x, 0, ap.z);
  let minVerschil = Infinity, heeftGewacht = false, t = 0;
  while (t < 60 && d.robots.includes(voor) && d.robots.includes(achter)) {
    const sVoor = achter.s;
    d.updateRobots(DT); t += DT;
    if (!d.robots.includes(voor) || !d.robots.includes(achter)) break;
    if (voor.modus === 'route' && achter.modus === 'route') minVerschil = Math.min(minVerschil, voor.s - achter.s);
    if (achter.s === sVoor) heeftGewacht = true;
  }
  return { minVerschil: +minVerschil.toFixed(3), heeftGewacht, onderling: d.ROBOT_ONDERLING, snelheden: [voor.snelheid, achter.snelheid] };
});
check('Een snelle robot achter een trage in dezelfde baan wacht (haalt niet in, stapelt niet)',
  afstand.heeftGewacht && afstand.minVerschil >= afstand.onderling - 0.15, afstand);

// --- 4. Het hek blokkeert de volle breedte van de strook ------------------

const hek = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  const uit = [];
  for (const plek of d.BOUWPLEKKEN.filter(b => b.index === 0)) {
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.spel.monumentHP = 100; d.spel.gameOver = false;
    d.geldZet(500);
    const hekToren = d.bouwToren(plek, 'hek');
    hekToren.hp = 1e9; hekToren.hpMax = 1e9;           // onverwoestbaar: we meten alleen of er iemand langs komt
    const poort = d.SPAWN_POORTEN.find(p => p.naam === plek.poort);
    const robots = [];
    for (const f of [-1, 0, 1]) {
      d.spawnRobot(poort, 'sprinter');
      const r = d.robots[d.robots.length - 1];
      r.laanFractie = f;
      robots.push(r);
    }
    let t = 0;
    while (t < 40) { d.updateRobots(DT); t += DT; }
    uit.push({
      plek: `${plek.poort} ver`, hekS: +plek.s.toFixed(1), breedte: plek.hekBreedte,
      voorbij: robots.filter(r => !d.robots.includes(r) || r.s > plek.s).length,
      slaan: robots.filter(r => d.hekVoorRobot(r) === hekToren).length,
    });
    d.verwijderToren(hekToren);
  }
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  return uit;
});
for (const h of hek) {
  check(`${h.plek}: geen enkele robot komt langs het hek, ook niet in de buitenste banen`, h.voorbij === 0, h);
  check(`${h.plek}: de voorste robot staat tegen het hek te slaan`, h.slaan >= 1, h);
}

// --- 5. De bomber: van de route af naar een bouwwerk, en weer terug -------

const bomber = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.monumentHP = 100; d.spel.gameOver = false;
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Damrak' && b.index === 0);
  d.geldZet(500);
  const toren = d.bouwToren(plek, 'geschut');
  toren.cooldown = 1e9;                                // schiet niet, zodat de bomber blijft leven
  const poort = d.SPAWN_POORTEN.find(p => p.naam === 'Damrak');
  d.spawnRobot(poort, 'bomber');
  const b = d.robots[d.robots.length - 1];
  const modi = [b.modus];
  let t = 0, weg = false;
  while (t < 90 && d.robots.includes(b)) {
    d.updateRobots(DT); t += DT;
    if (modi[modi.length - 1] !== b.modus) modi.push(b.modus);
    // Zodra hij van de route af is, het bouwwerk weghalen: hij moet terug.
    if (!weg && b.modus === 'bouwwerk' && d.torens.includes(toren)) {
      const afstand = Math.hypot(b.groep.position.x - toren.plek.positie.x, b.groep.position.z - toren.plek.positie.z);
      if (afstand < 4) { d.verwijderToren(toren); weg = true; }
    }
    if (d.torens.includes(toren)) toren.cooldown = 1e9;
  }
  return { modi, bereikt: !d.robots.includes(b) && d.spel.monumentHP < 100, tijd: +t.toFixed(1) };
});
check('Een bomber verlaat zijn route voor een toren, keert terug en loopt door naar het monument',
  bomber.modi.join('>') === 'route>bouwwerk>terug>route' && bomber.bereikt, bomber);

// --- 6. Een volle wave: niemand loopt vast --------------------------------

const wave = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.monumentHP = 1e6; d.spel.gameOver = false; d.spel.vastloopTeller = 0;
  const typen = Object.keys(d.ROBOT_TYPES);
  let gespawnd = 0, t = 0, volgende = 0, maxTegelijk = 0;
  // 40 robots, om de 0,4 s, verdeeld over alle vijf poorten en alle types.
  while (t < 240 && (gespawnd < 40 || d.robots.length > 0)) {
    if (gespawnd < 40 && t >= volgende) {
      d.spawnRobot(d.SPAWN_POORTEN[gespawnd % 5], typen[gespawnd % typen.length]);
      gespawnd++; volgende += 0.4;
    }
    d.updateRobots(DT); t += DT;
    maxTegelijk = Math.max(maxTegelijk, d.robots.length);
  }
  return { gespawnd, over: d.robots.length, vastlopers: d.spel.vastloopTeller, tijd: +t.toFixed(1), maxTegelijk };
});
check('Een volle wave van 40 robots over alle poorten: allemaal aangekomen', wave.gespawnd === 40 && wave.over === 0, wave);
check('...en de vastloop-detectie ging nul keer af', wave.vastlopers === 0, wave);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
