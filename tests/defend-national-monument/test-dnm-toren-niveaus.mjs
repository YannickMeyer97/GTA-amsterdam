// Ticket D12 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — torenniveaus,
// reparatie en verkopen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
});

// --- 1. Prijzen en effect per niveau -------------------------------------

const niveaus = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Damstraat' && b.index === 0);
  d.geldZet(2000);
  const t = d.bouwToren(plek, 'geschut');
  const rij = [];
  const meet = () => ({ niveau: t.niveau, prijs: d.upgradePrijs(t), stats: { ...d.torenStats(t) }, hp: t.hp, hpMax: t.hpMax,
    ringen: t.ringen.filter(r => r.visible).length, geinvesteerd: t.geinvesteerd });
  rij.push(meet());
  const geldVoor2 = d.geldStand();
  d.upgradeToren(t);
  rij.push({ ...meet(), betaald: geldVoor2 - d.geldStand() });
  const geldVoor3 = d.geldStand();
  d.upgradeToren(t);
  rij.push({ ...meet(), betaald: geldVoor3 - d.geldStand() });
  const geldVoor4 = d.geldStand();
  const verder = d.upgradeToren(t);
  return { rij, verder, geldNaVerder: d.geldStand() - geldVoor4, niveauNaVerder: t.niveau };
});
const [n1, n2, n3] = niveaus.rij;
check('Upgradeprijzen: niveau 2 €150, niveau 3 €250, daarna geen', n1.prijs === 150 && n2.prijs === 250 && n3.prijs === null, niveaus.rij.map(r => r.prijs));
check('Upgraden schrijft precies de upgradeprijs af', n2.betaald === 150 && n3.betaald === 250, niveaus.rij);
check('Bereik loopt op: 12 → 14 → 16 m', n1.stats.bereik === 12 && n2.stats.bereik === 14 && n3.stats.bereik === 16, niveaus.rij.map(r => r.stats.bereik));
check('Tempo en schade: niveau 2 sneller (0,6 s), niveau 3 dubbele schade', n2.stats.schotInterval === 0.6 && n3.stats.schadePerSchot === 2 && n1.stats.schadePerSchot === 1, niveaus.rij.map(r => r.stats));
check('Maximale HP loopt op: 60 → 90 → 130', n1.hpMax === 60 && n2.hpMax === 90 && n3.hpMax === 130, niveaus.rij.map(r => r.hpMax));
check('Niveau is zichtbaar aan de ringen (0 → 1 → 2)', n1.ringen === 0 && n2.ringen === 1 && n3.ringen === 2, niveaus.rij.map(r => r.ringen));
check('Niveau 3 kan niet verder: geen upgrade, geen geld weg', niveaus.verder === false && niveaus.geldNaVerder === 0 && niveaus.niveauNaVerder === 3, niveaus);
check('Geïnvesteerd bedrag telt bouwen + upgrades op (€520)', n3.geinvesteerd === 520, n3);

// --- 2. Upgrade behoudt schade; te weinig geld ----------------------------

const schade = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Rokin' && b.index === 0);
  d.geldZet(500);
  const t = d.bouwToren(plek, 'geschut');
  t.hp = 50;
  d.upgradeToren(t);
  const naUpgrade = { hp: t.hp, hpMax: t.hpMax };
  d.geldZet(100);
  const lukt = d.upgradeToren(t);
  return { naUpgrade, teWeinig: { lukt, niveau: t.niveau, geld: d.geldStand() } };
});
check('Een upgrade behoudt de opgelopen schade (50/60 → 80/90)', schade.naUpgrade.hp === 80 && schade.naUpgrade.hpMax === 90, schade.naUpgrade);
check('Te weinig geld voor een upgrade: niets gebeurt', schade.teWeinig.lukt === false && schade.teWeinig.niveau === 2 && schade.teWeinig.geld === 100, schade.teWeinig);

// --- 3. Reparatie: kosten evenredig aan ontbrekende HP --------------------

const reparatie = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const t = d.torens.find(x => x.niveau === 3);
  t.hp = 100;
  const kosten30 = d.reparatieKosten(t);
  t.hp = 65;
  const kosten65 = d.reparatieKosten(t);
  d.geldZet(40);
  const teWeinig = d.repareerToren(t);
  const hpNaMislukt = t.hp;
  d.geldZet(200);
  const lukt = d.repareerToren(t);
  const naReparatie = { hp: t.hp, geld: d.geldStand() };
  const alHeel = d.repareerToren(t);
  return { kosten30, kosten65, teWeinig, hpNaMislukt, lukt, naReparatie, alHeel, kostenHeel: d.reparatieKosten(t) };
});
check('Reparatiekosten zijn evenredig: 30 HP kwijt = €30, 65 HP kwijt = €65', reparatie.kosten30 === 30 && reparatie.kosten65 === 65, reparatie);
check('Te weinig geld voor de reparatie: niets gebeurt', reparatie.teWeinig === false && reparatie.hpNaMislukt === 65, reparatie);
check('Repareren zet de HP op het maximum en kost precies de reparatieprijs', reparatie.lukt && reparatie.naReparatie.hp === 130 && reparatie.naReparatie.geld === 135, reparatie.naReparatie);
check('Een hele toren repareren kost niets en doet niets', reparatie.alHeel === false && reparatie.kostenHeel === 0, reparatie);

// --- 4. Niveau 3 doet in het gevecht ook echt dubbele schade -------------

const gevecht = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const t = d.torens.find(x => x.niveau === 3);
  d.spawnRobot(null, 'tank');
  const tank = d.robots[d.robots.length - 1];
  tank.groep.position.set(t.plek.positie.x + 15, 0, t.plek.positie.z);   // 15 m: alleen binnen bereik van niveau 3 (16 m)
  t.cooldown = 0;
  d.updateTorens(0);
  const hp = tank.hp;
  d.scene.remove(tank.groep); d.robots.splice(d.robots.indexOf(tank), 1);
  return { hp };
});
check('Niveau 3 raakt op 15 m (buiten niveau-1-bereik) en doet 2 schade', gevecht.hp === 1, gevecht);

// --- 5. Verkopen ----------------------------------------------------------

const verkoop = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const t = d.torens.find(x => x.niveau === 3);
  const plek = t.plek;
  const obstakels = d.obstakels.length, geld = d.geldStand(), verdiend = d.runStats.verdiendGeld;
  const opbrengst = d.verkoopToren(t);
  return { opbrengst, verwacht: Math.round(520 * d.TOREN_VERKOOP_FRACTIE), geld: d.geldStand() - geld, verdiend: d.runStats.verdiendGeld - verdiend,
    plekLeeg: plek.toren === null, obstakelWeg: obstakels - d.obstakels.length, inTorens: d.torens.includes(t), uitScene: t.groep.parent === null };
});
check('Verkopen levert de helft van de investering op (€260 van €520)', verkoop.opbrengst === 260 && verkoop.verwacht === 260 && verkoop.geld === 260, verkoop);
check('Verkopen maakt de plek weer vrij en haalt toren en obstakel weg', verkoop.plekLeeg && verkoop.obstakelWeg === 1 && !verkoop.inTorens && verkoop.uitScene, verkoop);

// --- 6. Het menu op een bezette plek, met de toetsen ----------------------

const menu = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const t = d.torens[0];
  const plek = t.plek;
  const bouwUI = document.getElementById('bouwUI');
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  d.geldZet(1000);
  d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z);
  d.updateInteracties(0);
  const prompt = document.getElementById('interactiePrompt').textContent;
  toets('KeyT');
  const tekst = bouwUI.textContent;
  const niveauVoor = t.niveau;
  toets('Digit1');
  const naUpgrade = { niveau: t.niveau, menuOpen: d.bouwMenuStand() === plek, tekst: bouwUI.textContent };
  toets('Digit3');
  return { prompt, tekst, niveauVoor, naUpgrade, naVerkoop: { plekLeeg: plek.toren === null, menuDicht: d.bouwMenuStand() === null } };
});
check('De prompt bij een toren noemt niveau, HP en "T voor opties"', menu.prompt.includes('niv. 2') && menu.prompt.includes('T voor opties'), menu.prompt);
check('T op een bezette plek toont upgraden, repareren en verkopen', menu.tekst.includes('Upgrade naar niveau 3') && menu.tekst.includes('Repareren') && menu.tekst.includes('Verkopen'), menu.tekst);
check('1 upgradet en laat het menu open (met bijgewerkte tekst)', menu.niveauVoor === 2 && menu.naUpgrade.niveau === 3 && menu.naUpgrade.menuOpen && menu.naUpgrade.tekst.includes('Maximaal niveau'), menu.naUpgrade);
check('3 verkoopt en sluit het menu', menu.naVerkoop.plekLeeg && menu.naVerkoop.menuDicht, menu.naVerkoop);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
