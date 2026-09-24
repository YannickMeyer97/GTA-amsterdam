// Ticket D12 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — torenniveaus,
// reparatie en verkopen.
//
// Sinds D16 (economie herijkt) komen alle getallen uit TOREN_TYPES.geschut.
// niveaus; de test toetst de REGELS (prijs = niveauprijs, effect loopt op,
// schade blijft behouden, reparatie evenredig, verkoop = fractie van de
// investering), niet de balanswaarden van dit moment.
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
  return { rij, verder, geldNaVerder: d.geldStand() - geldVoor4, niveauNaVerder: t.niveau, cfg: d.TOREN_TYPES.geschut.niveaus };
});
const [n1, n2, n3] = niveaus.rij;
const [c1, c2, c3] = niveaus.cfg;
check('Upgradeprijzen zijn de niveauprijzen van niveau 2 en 3, daarna geen', n1.prijs === c2.prijs && n2.prijs === c3.prijs && n3.prijs === null, niveaus.rij.map(r => r.prijs));
check('Upgraden schrijft precies de upgradeprijs af', n2.betaald === c2.prijs && n3.betaald === c3.prijs, niveaus.rij);
check('Bereik loopt per niveau op', n1.stats.bereik < n2.stats.bereik && n2.stats.bereik < n3.stats.bereik, niveaus.rij.map(r => r.stats.bereik));
check('Tempo en schade: niveau 2 vuurt sneller, niveau 3 doet meer schade per schot', n2.stats.schotInterval < n1.stats.schotInterval && n3.stats.schadePerSchot > n1.stats.schadePerSchot, niveaus.rij.map(r => r.stats));
check('Maximale HP loopt per niveau op', n1.hpMax === c1.hp && n2.hpMax === c2.hp && n3.hpMax === c3.hp && c1.hp < c2.hp && c2.hp < c3.hp, niveaus.rij.map(r => r.hpMax));
check('Niveau is zichtbaar aan de ringen (0 → 1 → 2)', n1.ringen === 0 && n2.ringen === 1 && n3.ringen === 2, niveaus.rij.map(r => r.ringen));
check('Niveau 3 kan niet verder: geen upgrade, geen geld weg', niveaus.verder === false && niveaus.geldNaVerder === 0 && niveaus.niveauNaVerder === 3, niveaus);
const totaalInvestering = c1.prijs + c2.prijs + c3.prijs;
check('Geïnvesteerd bedrag telt bouwen + upgrades op', n3.geinvesteerd === totaalInvestering, n3);

// --- 2. Upgrade behoudt schade; te weinig geld ----------------------------

const schade = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const plek = d.BOUWPLEKKEN.find(b => b.poort === 'Rokin' && b.index === 0);
  d.geldZet(500);
  const t = d.bouwToren(plek, 'geschut');
  const [c1, c2, c3] = d.TOREN_TYPES.geschut.niveaus;
  t.hp = c1.hp - 10;
  d.upgradeToren(t);
  const naUpgrade = { hp: t.hp, hpMax: t.hpMax, verwachtHp: c2.hp - 10, verwachtMax: c2.hp };
  d.geldZet(c3.prijs - 1);
  const lukt = d.upgradeToren(t);
  return { naUpgrade, teWeinig: { lukt, niveau: t.niveau, geld: d.geldStand(), verwachtGeld: c3.prijs - 1 } };
});
check('Een upgrade behoudt de opgelopen schade (10 HP kwijt blijft 10 HP kwijt)', schade.naUpgrade.hp === schade.naUpgrade.verwachtHp && schade.naUpgrade.hpMax === schade.naUpgrade.verwachtMax, schade.naUpgrade);
check('Te weinig geld voor een upgrade (€1 te kort): niets gebeurt', schade.teWeinig.lukt === false && schade.teWeinig.niveau === 2 && schade.teWeinig.geld === schade.teWeinig.verwachtGeld, schade.teWeinig);

// --- 3. Reparatie: kosten evenredig aan ontbrekende HP --------------------

const reparatie = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const t = d.torens.find(x => x.niveau === 3);
  const perHp = d.TOREN_REPARATIE_PER_HP;
  t.hp = t.hpMax - 30;
  const kosten30 = d.reparatieKosten(t);
  t.hp = t.hpMax - 65;
  const kosten65 = d.reparatieKosten(t);
  d.geldZet(kosten65 - 1);
  const teWeinig = d.repareerToren(t);
  const hpNaMislukt = t.hp;
  d.geldZet(200);
  const lukt = d.repareerToren(t);
  const naReparatie = { hp: t.hp, hpMax: t.hpMax, geld: d.geldStand(), verwachtGeld: 200 - kosten65 };
  const alHeel = d.repareerToren(t);
  return { perHp, kosten30, kosten65, teWeinig, hpNaMislukt, verwachtHpNaMislukt: t.hpMax - 65, lukt, naReparatie, alHeel, kostenHeel: d.reparatieKosten(t) };
});
check('Reparatiekosten zijn evenredig aan de ontbrekende HP (30 HP en 65 HP)', reparatie.kosten30 === Math.ceil(30 * reparatie.perHp) && reparatie.kosten65 === Math.ceil(65 * reparatie.perHp) && reparatie.kosten65 > reparatie.kosten30, reparatie);
check('Te weinig geld voor de reparatie: niets gebeurt', reparatie.teWeinig === false && reparatie.hpNaMislukt === reparatie.verwachtHpNaMislukt, reparatie);
check('Repareren zet de HP op het maximum en kost precies de reparatieprijs', reparatie.lukt && reparatie.naReparatie.hp === reparatie.naReparatie.hpMax && reparatie.naReparatie.geld === reparatie.naReparatie.verwachtGeld, reparatie.naReparatie);
check('Een hele toren repareren kost niets en doet niets', reparatie.alHeel === false && reparatie.kostenHeel === 0, reparatie);

// --- 4. Niveau 3 doet in het gevecht ook echt dubbele schade -------------

const gevecht = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const t = d.torens.find(x => x.niveau === 3);
  const [c1, , c3] = d.TOREN_TYPES.geschut.niveaus;
  d.spawnRobot(null, 'tank');
  const tank = d.robots[d.robots.length - 1];
  const afstand = c3.bereik - 1;   // binnen niveau 3, buiten niveau 1
  tank.groep.position.set(t.plek.positie.x + afstand, 0, t.plek.positie.z);
  t.cooldown = 0;
  d.updateTorens(0);
  const hp = tank.hp;
  d.scene.remove(tank.groep); d.robots.splice(d.robots.indexOf(tank), 1);
  return { hp, afstand, buitenNiveau1: afstand > c1.bereik, verwachtHp: 3 - c3.schadePerSchot };
});
check('Niveau 3 raakt buiten het niveau-1-bereik en doet zijn eigen schade per schot', gevecht.buitenNiveau1 && gevecht.hp === gevecht.verwachtHp, gevecht);

// --- 5. Verkopen ----------------------------------------------------------

const verkoop = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const t = d.torens.find(x => x.niveau === 3);
  const plek = t.plek;
  const obstakels = d.obstakels.length, geld = d.geldStand(), verdiend = d.runStats.verdiendGeld;
  const investering = d.TOREN_TYPES.geschut.niveaus.reduce((a, n) => a + n.prijs, 0);
  const opbrengst = d.verkoopToren(t);
  return { opbrengst, investering, verwacht: Math.round(investering * d.TOREN_VERKOOP_FRACTIE), geld: d.geldStand() - geld, verdiend: d.runStats.verdiendGeld - verdiend,
    plekLeeg: plek.toren === null, obstakelWeg: obstakels - d.obstakels.length, inTorens: d.torens.includes(t), uitScene: t.groep.parent === null };
});
check('Verkopen levert de verkoopfractie (de helft) van de totale investering op', verkoop.opbrengst === verkoop.verwacht && verkoop.verwacht === Math.round(verkoop.investering / 2) && verkoop.geld === verkoop.opbrengst, verkoop);
check('Verkopen maakt de plek weer vrij en haalt toren en obstakel weg', verkoop.plekLeeg && verkoop.obstakelWeg === 1 && !verkoop.inTorens && verkoop.uitScene, verkoop);

// --- 6. Het menu op een bezette plek, met de toetsen ----------------------

const menu = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const t = d.torens[0];
  const plek = t.plek;
  const bouwUI = document.getElementById('menuUI');
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  d.geldZet(1000);
  d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z);
  // Ticket D45: het menu opent vanzelf; eerst T om het te sluiten en de
  // "druk T"-prompt te zien, dan T om het weer te openen.
  d.updateInteracties(0);
  toets('KeyT');
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
