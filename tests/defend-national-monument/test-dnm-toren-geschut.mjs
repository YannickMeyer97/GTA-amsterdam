// Ticket D11 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — de geschuttoren.
//
// Sinds D16 (economie herijkt) leest deze test prijs, bereik, interval en HP
// uit TOREN_TYPES in plaats van ze hard te coderen: het GEDRAG (bereikgrens,
// interval, dichtstbijzijnde doel, …) blijft even streng getoetst, maar de
// test overleeft een volgende balansronde.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// Schone uitgangssituatie: geen robots, geen spawns.
await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// --- 1. Kopen: te weinig en genoeg geld ------------------------------------

const kopen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Damstraat' && b.index === 1);
  const obstakelsVoor = d.obstakels.length;
  d.geldZet(100);
  const teDuur = d.bouwToren(plek, 'geschut');
  const naTeDuur = { toren: teDuur, geld: d.geldStand(), plekLeeg: plek.toren === null, torens: d.torens.length };
  d.geldZet(500);
  const toren = d.bouwToren(plek, 'geschut');
  const naKoop = { gebouwd: !!toren, geld: d.geldStand(), verwachtGeld: 500 - d.TOREN_TYPES.geschut.prijs, verwachtHp: d.TOREN_TYPES.geschut.hp, plekBezet: plek.toren === toren, torens: d.torens.length,
    obstakels: d.obstakels.length - obstakelsVoor, gebouwdStat: d.runStats.torensGebouwd, hp: toren?.hp, inScene: toren?.groep.parent === d.scene };
  const nogmaals = d.bouwToren(plek, 'geschut');
  return { prijs: d.TOREN_TYPES.geschut.prijs, naTeDuur, naKoop, nogmaals, geldNaNogmaals: d.geldStand() };
});
check('Een geschuttoren kost meer dan €100 (anders klopt de te-weinig-geld-check hieronder niet)', kopen.prijs > 100 && kopen.prijs <= 500, kopen);
check('Te weinig geld: niets gebouwd, geld ongewijzigd', kopen.naTeDuur.toren === null && kopen.naTeDuur.geld === 100 && kopen.naTeDuur.plekLeeg && kopen.naTeDuur.torens === 0, kopen.naTeDuur);
check('Genoeg geld: toren gebouwd, precies de prijs afgeschreven, plek bezet', kopen.naKoop.gebouwd && kopen.naKoop.geld === kopen.naKoop.verwachtGeld && kopen.naKoop.plekBezet && kopen.naKoop.torens === 1, kopen.naKoop);
check('De toren staat in de scene, heeft de HP van niveau 1, en registreert één obstakel', kopen.naKoop.inScene && kopen.naKoop.hp === kopen.naKoop.verwachtHp && kopen.naKoop.obstakels === 1, kopen.naKoop);
check('runStats.torensGebouwd telt mee', kopen.naKoop.gebouwdStat === 1, kopen.naKoop);
check('Op een bezette plek kun je niet nog eens bouwen', kopen.nogmaals === null && kopen.geldNaNogmaals === kopen.naKoop.verwachtGeld, kopen);

// --- 2. Het bouwmenu: T opent, 1 bouwt, weglopen sluit ---------------------

const menu = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Rokin' && b.index === 1);
  const ander = d.BOUWPLEKKEN.find(b => b.poort === 'Damrak' && b.index === 1);
  const bouwUI = document.getElementById('bouwUI');
  d.geldZet(300);
  d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z);
  d.updateInteracties(0);
  const prompt = document.getElementById('interactiePrompt').textContent;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT' }));
  const open = { stand: d.bouwMenuStand() === plek, zichtbaar: bouwUI.style.display === 'block', tekst: bouwUI.textContent };
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1' }));
  const naBouw = { gebouwd: plek.toren !== null, menuDicht: d.bouwMenuStand() === null && bouwUI.style.display === 'none', geld: d.geldStand() };
  // Menu op een andere plek openen en dan weglopen.
  d.speler.positie.set(ander.positie.x + 1.4, 0, ander.positie.z);
  d.updateInteracties(0);
  d.activeerBouwplek(ander);
  const openBijAnder = d.bouwMenuStand() === ander;
  d.speler.positie.set(ander.positie.x + 15, 0, ander.positie.z);
  d.updateInteracties(0);
  return { prompt, open, naBouw, openBijAnder, dichtNaWeglopen: d.bouwMenuStand() === null && bouwUI.style.display === 'none', prijs: d.TOREN_TYPES.geschut.prijs };
});
check('Bij een lege bouwplek vraagt de prompt om T', menu.prompt.includes('Druk T om te bouwen'), menu);
check('T op een lege bouwplek opent het bouwmenu met de geschuttoren', menu.open.stand && menu.open.zichtbaar && menu.open.tekst.includes(`Geschuttoren €${menu.prijs}`), menu.open);
check('1 in het bouwmenu bouwt de toren en sluit het menu', menu.naBouw.gebouwd && menu.naBouw.menuDicht && menu.naBouw.geld === 300 - menu.prijs, menu.naBouw);
check('Weglopen van de bouwplek sluit een open bouwmenu', menu.openBijAnder && menu.dichtNaWeglopen, menu);

// --- 3. Schieten: bereik, dichtstbijzijnde doel, interval ------------------

const schieten = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const toren = d.torens[0];
  const p = toren.plek.positie;
  const cfg = d.TOREN_TYPES.geschut;
  const zet = (type, afstand, hoek = 0) => {
    d.spawnRobot(null, type);
    const r = d.robots[d.robots.length - 1];
    r.groep.position.set(p.x + Math.cos(hoek) * afstand, 0, p.z + Math.sin(hoek) * afstand);
    return r;
  };
  const leeg = () => { for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); } };
  const uit = {};
  for (const t of d.torens) t.cooldown = 0;

  // Net buiten bereik: niets.
  leeg();
  const ver = zet('normal', cfg.bereik + 1);
  toren.cooldown = 0;
  d.updateTorens(0);
  uit.buitenBereik = { leeft: d.robots.includes(ver), cooldown: toren.cooldown };

  // Net binnen bereik: één schot, dood.
  leeg();
  const dichtbij = zet('normal', cfg.bereik - 1);
  toren.cooldown = 0;
  d.updateTorens(0);
  uit.binnenBereik = { dood: !d.robots.includes(dichtbij), cooldown: toren.cooldown, interval: cfg.schotInterval };

  // Twee doelen (allebei binnen bereik): de dichtstbijzijnde eerst.
  leeg();
  const a = zet('tank', cfg.bereik - 1, 0), b = zet('tank', 3, Math.PI);
  toren.cooldown = 0;
  d.updateTorens(0);
  uit.dichtstbij = { verreHp: a.hp, dichteHp: b.hp };

  // Interval: tank (3 HP) op 5 m.
  leeg();
  const tank = zet('tank', 5);
  toren.cooldown = 0;
  const hp = [];
  d.updateTorens(0);                          hp.push(tank.hp);   // schot 1
  d.updateTorens(cfg.schotInterval - 0.3);    hp.push(tank.hp);   // cooldown nog 0,3 s
  d.updateTorens(0.31);                       hp.push(tank.hp);   // schot 2
  d.updateTorens(cfg.schotInterval + 0.01);   hp.push(d.robots.includes(tank) ? tank.hp : 'dood');   // schot 3
  uit.interval = hp;

  // Schild blokkeert.
  leeg();
  const schild = zet('shieldbot', 5);
  schild.schildActief = true;
  toren.cooldown = 0;
  d.updateTorens(0);
  uit.schild = { leeft: d.robots.includes(schild), hp: schild.hp };
  leeg();
  return uit;
});
check('Een robot 1 m buiten het bereik wordt niet beschoten', schieten.buitenBereik.leeft && schieten.buitenBereik.cooldown === 0, schieten.buitenBereik);
check('Een normale robot 1 m binnen het bereik wordt in één schot vernietigd', schieten.binnenBereik.dood && schieten.binnenBereik.cooldown === schieten.binnenBereik.interval, schieten.binnenBereik);
check('Bij twee doelen raakt de toren de dichtstbijzijnde', schieten.dichtstbij.dichteHp === 2 && schieten.dichtstbij.verreHp === 3, schieten.dichtstbij);
check('Het schotinterval wordt gerespecteerd; een tank sneuvelt in precies 3 schoten',
  JSON.stringify(schieten.interval) === JSON.stringify([2, 2, 1, 'dood']), schieten.interval);
check('Een actief schild blokkeert ook torenschoten', schieten.schild.leeft && schieten.schild.hp === 1, schieten.schild);

// --- 4. Torenkill vs spelerskill -------------------------------------------

const kills = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const toren = d.torens[0];
  const p = toren.plek.positie;
  d.spel.combo = 0; d.spel.specialMeter = 0;
  const muntenVoor = d.munten.length, scoreVoor = d.spel.score, torenKillsVoor = d.runStats.torenKills;
  d.spawnRobot(null, 'normal');
  const r = d.robots[d.robots.length - 1];
  r.groep.position.set(p.x + 4, 0, p.z);
  toren.cooldown = 0;
  d.updateTorens(0);
  const naToren = { dood: !d.robots.includes(r), combo: d.spel.combo, special: d.spel.specialMeter,
    munt: d.munten.length === muntenVoor + 1, score: d.spel.score - scoreVoor, torenKills: d.runStats.torenKills - torenKillsVoor };
  // Spelerswapen: raakRobot met standaardwaarden doodt nog steeds in één schot.
  d.spawnRobot(null, 'normal');
  const s = d.robots[d.robots.length - 1];
  d.raakRobot(s);
  const naSpeler = { dood: !d.robots.includes(s), combo: d.spel.combo, special: d.spel.specialMeter, torenKills: d.runStats.torenKills - torenKillsVoor };
  return { naToren, naSpeler };
});
check('Torenkill: munt en +100 score, maar geen combo en geen special-meter', kills.naToren.dood && kills.naToren.munt && kills.naToren.score === 100 && kills.naToren.combo === 0 && kills.naToren.special === 0, kills.naToren);
check('Torenkill telt als runStats.torenKills', kills.naToren.torenKills === 1, kills.naToren);
check('Het spelerswapen doodt nog steeds in één schot en bouwt wél combo en special op', kills.naSpeler.dood && kills.naSpeler.combo === 1 && kills.naSpeler.special > 0 && kills.naSpeler.torenKills === 1, kills.naSpeler);

// --- 5. Reset ruimt torens en obstakels op ---------------------------------

const reset = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const obstakelsMetTorens = d.obstakels.length;
  const aantal = d.torens.length;
  const groepen = d.torens.map(t => t.groep);
  d.resetRun();
  return { aantal, obstakelsWeg: obstakelsMetTorens - d.obstakels.length, torens: d.torens.length,
    plekkenLeeg: d.BOUWPLEKKEN.every(b => b.toren === null), uitScene: groepen.every(g => g.parent === null) };
});
check('Na resetRun(): alle torens weg, hun obstakels ook, alle plekken weer leeg',
  reset.aantal === 2 && reset.torens === 0 && reset.obstakelsWeg === 2 && reset.plekkenLeeg && reset.uitScene, reset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
