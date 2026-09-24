// Ticket D13 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — het hek.
//
// Op alle tien de bouwplekken: een echte robot loopt vanaf zijn poort de
// echte route (updateRobots), moet bij het hek blijven staan en erop slaan,
// en loopt na het sneuvelen van het hek ongehinderd door naar het monument.
// Zo vangt deze test ook een corridor waar robots om het hek heen glippen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// --- 1. Bouwen, via het bouwmenu (optie 2) --------------------------------

const bouw = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Damrak' && b.index === 1);
  d.geldZet(200);
  const obstakelsVoor = d.obstakels.length;
  d.speler.positie.set(plek.positie.x, 0, plek.positie.z);
  d.updateInteracties(0);
  d.activeerBouwplek(plek);
  const menu = document.getElementById('menuUI').textContent;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2' }));
  const hek = plek.toren;
  const uit = { menu, type: hek?.type, geld: d.geldStand(), hp: hek?.hp, palen: hek?.obstakelHandles.length,
    obstakels: d.obstakels.length - obstakelsVoor, prijs: d.TOREN_TYPES.hek.prijs, cfgHp: d.TOREN_TYPES.hek.hp };
  // Een hek schiet niet: robot vlakbij, updateTorens, robot ongedeerd.
  d.spawnRobot(null, 'normal');
  const r = d.robots[d.robots.length - 1];
  r.groep.position.set(plek.positie.x + 5, 0, plek.positie.z);
  d.updateTorens(0.5);
  uit.robotOngedeerd = d.robots.includes(r) && r.hp === 1;
  d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1);
  d.verwijderToren(hek);
  uit.naVerwijderen = d.obstakels.length - obstakelsVoor;
  return uit;
});
check('Het bouwmenu biedt het hek aan als optie 2', bouw.menu.includes(`2, Hek €${bouw.prijs}`), bouw.menu);
check('2 bouwt een hek (prijs afgeschreven, HP van niveau 1)', bouw.type === 'hek' && bouw.geld === 200 - bouw.prijs && bouw.hp === bouw.cfgHp, bouw);
check('Het hek bestaat uit meerdere paaltjes, elk met een eigen obstakel', bouw.palen >= 5 && bouw.obstakels === bouw.palen, bouw);
check('Een hek schiet niet', bouw.robotOngedeerd, bouw);
check('Verwijderen haalt alle paal-obstakels weer weg', bouw.naVerwijderen === 0, bouw);

// --- 2. Op alle tien de bouwplekken: stoppen, slaan, sneuvelen, doorlopen --

const scenario = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  const uitkomsten = [];
  for (const plek of d.BOUWPLEKKEN) {
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.spel.monumentHP = 100; d.spel.gameOver = false;
    const obstakelsVoor = d.obstakels.length;
    d.geldZet(500);
    const hek = d.bouwToren(plek, 'hek');
    const poort = d.SPAWN_POORTEN.find(p => p.naam === plek.poort);
    d.spawnRobot(poort, 'normal');
    const robot = d.robots[d.robots.length - 1];
    let contactNa = null, hpNa10s = null, t = 0;
    // Fase A: lopen tot het hek, dan 10 s slaan.
    while (t < 90) {
      d.updateRobots(DT); t += DT;
      if (!d.robots.includes(robot)) break;   // monument bereikt: om het hek heen geglipt
      if (contactNa === null && d.afstandTotHek(hek, robot.groep.position) <= d.HEK_CONTACT_AFSTAND) contactNa = t;
      if (contactNa !== null && t - contactNa >= 10) { hpNa10s = hek.hp; break; }
    }
    const positieBijHek = robot.groep.position.clone();
    const stilGestaan = contactNa !== null && d.afstandTotHek(hek, robot.groep.position) <= d.HEK_CONTACT_AFSTAND;
    // Fase B: hek kapot laten slaan.
    let gesneuveld = false;
    while (t < 200 && d.robots.includes(robot)) {
      d.updateRobots(DT); t += DT;
      if (!d.torens.includes(hek)) { gesneuveld = true; break; }
    }
    const naSneuvelen = { plekVrij: plek.toren === null, obstakelsTerug: d.obstakels.length === obstakelsVoor, uitScene: hek.groep.parent === null };
    // Fase C: doorlopen naar het monument.
    let monumentBereikt = false;
    while (t < 300) {
      d.updateRobots(DT); t += DT;
      if (!d.robots.includes(robot)) { monumentBereikt = d.spel.monumentHP < 100; break; }
    }
    uitkomsten.push({ plek: `${plek.poort} ${plek.index + 1}`, contactNa, stilGestaan, hpNa10s, gesneuveld, ...naSneuvelen, monumentBereikt,
      positieBijHek: [positieBijHek.x.toFixed(1), positieBijHek.z.toFixed(1)] });
    if (d.torens.includes(hek)) d.verwijderToren(hek);
  }
  return uitkomsten;
});
for (const u of scenario) {
  check(`${u.plek}: de robot bereikt het hek en blijft er staan (glipt er niet omheen)`, u.contactNa !== null && u.stilGestaan, u);
  check(`${u.plek}: het hek verliest HP door de klappen (10 s × 6 per 0,8 s ≈ 72)`, u.hpNa10s !== null && u.hpNa10s <= 120 - 60 && u.hpNa10s > 0, u);
  check(`${u.plek}: bij 0 HP verdwijnen hek én obstakels, de plek komt vrij`, u.gesneuveld && u.plekVrij && u.obstakelsTerug && u.uitScene, u);
  check(`${u.plek}: daarna loopt de robot ongehinderd door naar het monument`, u.monumentBereikt, u);
}

// --- 3. Klapschade per robottype -------------------------------------------

const typen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Damstraat' && b.index === 1);
  d.geldZet(500);
  const hek = d.bouwToren(plek, 'hek');
  const uit = {};
  for (const type of ['normal', 'tank']) {
    hek.hp = hek.hpMax;
    d.spawnRobot(null, type);
    const r = d.robots[d.robots.length - 1];
    const { ax, az, bx, bz } = hek.lijn;
    // Pal tegen het midden van het hek zetten.
    r.groep.position.set((ax + bx) / 2 + (bz - az) * 0.001, 0, (az + bz) / 2);
    r.slagTimer = 0.001;
    d.updateRobots(0.01);
    uit[type] = hek.hpMax - hek.hp;
    d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1);
  }
  d.verwijderToren(hek);
  return { uit, tabel: d.ROBOT_HEK_SCHADE };
});
check('Een normale robot slaat 6, een tank 15 per klap', typen.uit.normal === typen.tabel.normal && typen.uit.tank === typen.tabel.tank && typen.uit.tank > typen.uit.normal, typen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
