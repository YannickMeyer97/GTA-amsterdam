// Ticket D13 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — het hek.
//
// Op alle bouwplekken, en op een knooppunt voor elk van zijn routes (D46):
// een echte robot loopt vanaf zijn poort de echte route (updateRobots), moet
// bij het hek blijven staan en erop slaan, en loopt na het sneuvelen van het
// hek ongehinderd door naar het monument. Zo vangt deze test ook een corridor
// waar robots om het hek heen glippen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// --- 1. Bouwen, via het bouwmenu (de hekoptie na de torens) ---------------

const bouw = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const plek = d.plekVoor('Damrak', 'knooppunt');
  d.geldZet(200);
  const obstakelsVoor = d.obstakels.length;
  d.speler.positie.set(plek.positie.x, 0, plek.positie.z);
  d.updateInteracties(0);   // Ticket D45: het menu opent vanzelf
  const menu = document.getElementById('menuUI').textContent;
  // Het nummer van de hekoptie: na alle torentypes (D47/D48).
  const nr = Object.entries(d.TOREN_TYPES).filter(([t, cfg]) => t !== 'hek' && !cfg.alleenOp).length + 1;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: `Digit${nr}` }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: `Digit${nr}` }));
  const hek = plek.hek;
  const uit = { menu, nr, type: hek?.type, geld: d.geldStand(), hp: hek?.hp, palen: hek?.obstakelHandles.length,
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
check('Het bouwmenu biedt het hek aan als laatste optie, na de torens', bouw.menu.includes(`${bouw.nr}, Hek €${bouw.prijs}`), bouw.menu);
check('Die optie bouwt een hek (prijs afgeschreven, HP van niveau 1)', bouw.type === 'hek' && bouw.geld === 200 - bouw.prijs && bouw.hp === bouw.cfgHp, bouw);
check('Het hek bestaat uit meerdere paaltjes, elk met een eigen obstakel', bouw.palen >= 5 && bouw.obstakels === bouw.palen, bouw);
check('Een hek schiet niet', bouw.robotOngedeerd, bouw);
check('Verwijderen haalt alle paal-obstakels weer weg', bouw.naVerwijderen === 0, bouw);

// --- 2. Op alle bouwplekken en routes: stoppen, slaan, sneuvelen, doorlopen

const scenario = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  const uitkomsten = [];
  for (const plek of d.BOUWPLEKKEN) for (const routeNaam of plek.routes) {
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.spel.monumentHP = 100; d.spel.gameOver = false;
    const obstakelsVoor = d.obstakels.length;
    d.geldZet(500);
    const hek = d.bouwToren(plek, 'hek');
    const poort = d.SPAWN_POORTEN.find(p => p.naam === routeNaam);
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
    const naSneuvelen = { plekVrij: plek.hek === null, obstakelsTerug: d.obstakels.length === obstakelsVoor, uitScene: hek.groep.parent === null };
    // Fase C: doorlopen naar het monument.
    let monumentBereikt = false;
    while (t < 300) {
      d.updateRobots(DT); t += DT;
      if (!d.robots.includes(robot)) { monumentBereikt = d.spel.monumentHP < 100; break; }
    }
    uitkomsten.push({ plek: `${plek.naam} (${routeNaam})`, lijnen: hek.lijnen.length, routes: plek.routes.length, contactNa, stilGestaan, hpNa10s, gesneuveld, ...naSneuvelen, monumentBereikt,
      positieBijHek: [positieBijHek.x.toFixed(1), positieBijHek.z.toFixed(1)] });
    if (d.torens.includes(hek)) d.verwijderToren(hek);
  }
  return uitkomsten;
});
check('Een hek heeft een lijn per route van zijn plek (D46)', scenario.every(u => u.lijnen === u.routes) && scenario.some(u => u.lijnen === 2), scenario.map(u => [u.plek, u.lijnen]));
check('Het scenario loopt over 9 combinaties van plek en route (3 knooppunten, 3 voorposten, D50)', scenario.length === 9, scenario.length);
for (const u of scenario) {
  check(`${u.plek}: de robot bereikt het hek en blijft er staan (glipt er niet omheen)`, u.contactNa !== null && u.stilGestaan, u);
  check(`${u.plek}: het hek verliest HP door de klappen (10 s × 6 per 0,8 s ≈ 72)`, u.hpNa10s !== null && u.hpNa10s <= 120 - 60 && u.hpNa10s > 0, u);
  check(`${u.plek}: bij 0 HP verdwijnen hek én obstakels, de plek komt vrij`, u.gesneuveld && u.plekVrij && u.obstakelsTerug && u.uitScene, u);
  check(`${u.plek}: daarna loopt de robot ongehinderd door naar het monument`, u.monumentBereikt, u);
}

// --- 3. Klapschade per robottype -------------------------------------------

const typen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const plek = d.plekVoor('Damstraat', 'knooppunt');
  d.geldZet(500);
  const hek = d.bouwToren(plek, 'hek');
  const uit = {};
  for (const type of ['normal', 'tank']) {
    hek.hp = hek.hpMax;
    d.spawnRobot(null, type);
    const r = d.robots[d.robots.length - 1];
    const { ax, az, bx, bz } = hek.lijnen[0];
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

// --- 4. Ticket D47: eigen hekslot naast het torenslot ----------------------

const slots = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 30;
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const leeg = () => { for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); } };
  leeg();
  d.spel.monumentHP = 100; d.spel.gameOver = false;
  const plek = d.plekVoor('Damrak', 'knooppunt');
  const uit = {};
  // a. Via het menu: 1 = geschuttoren, daarna 4 = hek (optie na de 3 torenopties).
  d.geldZet(1000);
  d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z);
  d.updateInteracties(0);
  toets('Digit1');
  uit.naToren = document.getElementById('menuUI').textContent;
  toets('Digit4');
  uit.beide = { toren: plek.toren?.type, hek: plek.hek?.type, menu: document.getElementById('menuUI').textContent };
  d.speler.positie.set(plek.positie.x + 30, 0, plek.positie.z);
  d.updateInteracties(0);
  // b. Geen hekpaal op de tegel van de plek: de toren staat vrij.
  uit.paalOpTegel = d.BOUWPLEKKEN.some(pl => {
    d.geldZet(1000);
    const eigen = pl.hek ?? d.bouwToren(pl, 'hek');
    const fout = eigen.groep.children.some(m => m.geometry?.parameters?.height === 1.3 && d.opPlekTegel(pl, m.position.x, m.position.z));
    if (eigen !== plek.hek) d.verwijderToren(eigen);
    return fout;
  });
  // c. Robots op beide routes van het knooppunt blijven staan en sneuvelen
  // in het vuur van de toren, terwijl het hek overeind blijft.
  plek.hek.hp = plek.hek.hpMax = 1e6;
  const robots = plek.routes.map(naam => { d.spawnRobot(d.SPAWN_POORTEN.find(p => p.naam === naam), 'normal'); return d.robots[d.robots.length - 1]; });
  // Taai genoeg om het hek te halen: de toren begint al te schieten zodra
  // ze binnen 10 m komen.
  for (const r of robots) r.hp = 25;
  const contact = new Set();
  let t = 0;
  while (t < 90 && robots.some(r => d.robots.includes(r))) {
    d.updateRobots(DT); d.updateTorens(DT); t += DT;
    for (const r of robots) if (d.robots.includes(r) && d.hekVoorRobot(r) === plek.hek) contact.add(r);
  }
  uit.vuur = { allemaalDood: robots.every(r => !d.robots.includes(r)), beideBijHek: contact.size === robots.length, monument: d.spel.monumentHP, hekStaat: d.torens.includes(plek.hek), tijd: +t.toFixed(1) };
  leeg();
  // d. Verkopen van het hek laat de toren staan; sneuvelen van de toren laat
  // een nieuw hek staan.
  const toren = plek.toren;
  d.verkoopToren(plek.hek);
  uit.naHekVerkoop = { hek: plek.hek, torenStaat: plek.toren === toren && d.torens.includes(toren) };
  d.geldZet(1000);
  const hek2 = d.bouwToren(plek, 'hek');
  d.beschadigToren(toren, 1e6);
  uit.naTorenSneuvelt = { toren: plek.toren, hekStaat: plek.hek === hek2 && d.torens.includes(hek2) };
  d.verwijderToren(hek2);
  return uit;
});
check('D47: na de toren biedt het menu het hek aan als optie 4', slots.naToren.includes('4, Hek €'), slots.naToren);
check('D47: toren en hek staan samen op één plek', slots.beide.toren === 'geschut' && slots.beide.hek === 'hek', slots.beide);
check('D47: het menu toont beide slots (6 opties)', slots.beide.menu.includes('6, Hek verkopen'), slots.beide.menu);
check('D47: geen hekpaal op de tegel van een plek', !slots.paalOpTegel, slots.paalOpTegel);
check('D47: robots van beide knooppuntroutes staan stil voor het hek en sneuvelen in het vuur', slots.vuur.allemaalDood && slots.vuur.beideBijHek && slots.vuur.monument === 100 && slots.vuur.hekStaat, slots.vuur);
check('D47: het hek verkopen laat de toren staan', slots.naHekVerkoop.hek === null && slots.naHekVerkoop.torenStaat, slots.naHekVerkoop);
check('D47: de toren die sneuvelt laat het hek staan', slots.naTorenSneuvelt.toren === null && slots.naTorenSneuvelt.hekStaat, slots.naTorenSneuvelt);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
