// Ticket D49 (SONNET_EXECUTION_PLAN_monument.md, §11.8) — de Muntpers.
//
// Een steuntoren zonder aanval. Robots die binnen zijn bereik sneuvelen,
// door wie dan ook, laten een munt achter die 50% meer waard is. Meerdere
// persen stapelen niet. Math.random staat vast, zodat het muntbedrag
// vergelijkbaar is.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const leeg = () => { for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); } };
  d.spel.teSpawnen = 0;
  leeg();
  const plek = d.plekVoor('Damstraat', 'knooppunt');
  const P = plek.positie;
  const echtRandom = Math.random;
  Math.random = () => 0;
  // Een tank (beloning x2,5) op afstand `a` oostwaarts van de pers laten
  // sneuvelen; geeft het bedrag van de munt die hij achterlaat.
  function kill(a, bron = 'speler') {
    leeg();
    d.spel.combo = 0;
    d.spawnRobot(null, 'tank');
    const robot = d.robots[d.robots.length - 1];
    robot.groep.position.set(P.x + a, 0, P.z);
    const voor = d.munten.length;
    d.raakRobot(robot, 99, bron);
    return d.munten.length > voor ? d.munten[d.munten.length - 1].bedrag : null;
  }
  const uit = {};
  uit.zonderPers = kill(3);

  // 1. Bouwen via het menu: optie 3 op een lege plek.
  d.geldZet(500);
  d.speler.positie.set(P.x + 1.4, 0, P.z);
  d.updateInteracties(0);
  uit.menu = document.getElementById('menuUI').textContent;
  toets('Digit3');
  const pers = plek.toren;
  uit.bouw = { type: pers?.type, geld: d.geldStand(), prijs: d.TOREN_TYPES.muntpers.prijs, ring: pers?.spoor.parent === d.scene };
  d.speler.positie.set(P.x - 40, 0, P.z);
  d.updateInteracties(0);

  // 2. +50% binnen bereik, door speler én toren; niets erbuiten.
  const bereik1 = d.MUNTPERS_NIVEAUS[0].bereik;
  uit.binnen = kill(3);
  uit.binnenToren = kill(bereik1 - 0.5, 'toren');
  uit.buiten = kill(bereik1 + 1);
  uit.bonusKills = pers.bonusKills;
  // Buiten bereik maar gedood door een toren: ook geen bonus.
  uit.buitenToren = kill(bereik1 + 1, 'toren');
  uit.zonderPersToren = (() => { const b = pers.bonusKills; const x = kill(bereik1 + 1, 'toren'); return { bedrag: x, telt: pers.bonusKills - b }; })();

  // 3. Geen aanval: een robot die 10 s in bereik staat, blijft heel.
  leeg();
  d.spawnRobot(null, 'normal');
  const staand = d.robots[d.robots.length - 1];
  staand.groep.position.set(P.x + 2, 0, P.z);
  for (let i = 0; i < 100; i++) d.updateTorens(0.1);
  uit.geenAanval = { hp: staand.hp, leeft: d.robots.includes(staand) };
  leeg();

  // 4. Geen stapeling: een tweede pers met (voor deze toets) groot bereik,
  // zodat beide dezelfde plek dekken.
  const tweedePlek = d.plekVoor('Rokin', 'knooppunt');
  d.geldZet(500);
  const pers2 = d.bouwToren(tweedePlek, 'muntpers');
  const oud = d.MUNTPERS_NIVEAUS[0].bereik;
  d.MUNTPERS_NIVEAUS[0].bereik = 60;
  uit.beideDekken = !!d.muntpersVoor({ x: P.x + 3, z: P.z }) && Math.hypot(tweedePlek.positie.x - P.x - 3, tweedePlek.positie.z - P.z) <= 60;
  uit.gestapeld = kill(3);
  d.MUNTPERS_NIVEAUS[0].bereik = oud;
  d.verkoopToren(pers2);

  // 5. Upgrade: meer bereik. Een kill op 9 m telt pas vanaf niveau 2.
  uit.op9Niveau1 = kill(9);
  d.geldZet(1000);
  d.upgradeToren(pers);
  d.updateTorens(0.1);
  uit.op9Niveau2 = kill(9);
  uit.ringSchaal = pers.spoor.scale.x;
  uit.niveau2Bereik = d.MUNTPERS_NIVEAUS[1].bereik;

  // 6. Bomberdoel, en de stempel slaat bij een bonuskill.
  leeg();
  uit.bomberDoel = d.kiesBomberDoel({ x: P.x + 3, y: 0, z: P.z })?.type;
  kill(3);
  uit.stempelSlaat = pers.stempelTimer > 0;
  d.updateTorens(0.17);
  uit.stempelOmlaag = pers.stempel.position.y < 1.45;

  // 7. Verkopen ruimt pers en bereikring op.
  const ring = pers.spoor;
  d.verkoopToren(pers);
  uit.naVerkoop = { plek: plek.toren, ringWeg: ring.parent === null, bonus: d.muntpersVoor({ x: P.x + 3, z: P.z }) };
  Math.random = echtRandom;
  leeg();
  return uit;
});

const plus50 = (met, zonder) => met !== null && zonder !== null && Math.abs(met - zonder * 1.5) <= 1 && met > zonder;
check('Het bouwmenu biedt de Muntpers aan als optie 3', r.menu.includes(`3, Muntpers €${r.bouw.prijs}`), r.menu);
check('3 bouwt een Muntpers in het torenslot, met een bereikring op de grond', r.bouw.type === 'muntpers' && r.bouw.geld === 500 - r.bouw.prijs && r.bouw.ring, r.bouw);
check('Een kill door de speler binnen bereik levert 50% meer op', plus50(r.binnen, r.zonderPers), r);
check('Een kill door een toren binnen bereik levert ook 50% meer op', plus50(r.binnenToren, r.zonderPers), r);
check('Buiten bereik geen bonus (speler en toren)', r.buiten === r.zonderPers && r.buitenToren === r.zonderPers && r.zonderPersToren.telt === 0, r);
check('De pers telt zijn bonuskills', r.bonusKills === 2, r.bonusKills);
check('De Muntpers valt niet aan (robot 10 s in bereik blijft heel)', r.geenAanval.leeft && r.geenAanval.hp === 1, r.geenAanval);
check('Twee persen die dezelfde plek dekken, stapelen niet (+50%, niet +125%)', r.beideDekken && plus50(r.gestapeld, r.zonderPers), r);
check('Upgrade vergroot het bereik: een kill op 9 m telt pas vanaf niveau 2', r.op9Niveau1 === r.zonderPers && plus50(r.op9Niveau2, r.zonderPers), r);
check('De bereikring groeit mee met het niveau', r.ringSchaal === r.niveau2Bereik, r);
check('Een bomber kiest de Muntpers als doelwit', r.bomberDoel === 'muntpers', r.bomberDoel);
check('Bij een bonuskill slaat de stempel neer', r.stempelSlaat && r.stempelOmlaag, r);
check('Verkopen ruimt pers en bereikring op; daarna geen bonus meer', r.naVerkoop.plek === null && r.naVerkoop.ringWeg && r.naVerkoop.bonus === null, r.naVerkoop);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
