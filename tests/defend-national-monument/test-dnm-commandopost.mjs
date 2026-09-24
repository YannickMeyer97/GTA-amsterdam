// Ticket D35 (SONNET_EXECUTION_PLAN_monument.md §11.5, fase M) — de
// commandopost bij het monument, één menupaneel en een HUD zonder overlap.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- 1. De commandopost bestaat, de oude punten niet meer ------------------

const opzet = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const c = d.DAM_LAYOUT.commandopost;
  const punt = d.interactiePunten.find(p => p.type === 'commandopost');
  return {
    gebouw: d.wereld.children.some(g => g.name === 'Commandopost'),
    punt: punt && [punt.positie.x, punt.positie.z], spelerPlek: c.spelerPlek,
    oud: d.interactiePunten.filter(p => p.type === 'upgradeShop' || p.type === 'reparatie').map(p => p.naam),
    types: d.interactiePunten.map(p => p.type),
    oudePanelen: ['shopUI', 'bouwUI'].filter(id => document.getElementById(id)),
    botsing: d.obstakels.some(o => Math.abs(o.minX - (c.midden[0] - c.maat[0] / 2)) < 1e-6 && Math.abs(o.maxZ - (c.midden[1] + c.maat[1] / 2)) < 1e-6),
  };
});
check('De commandopost staat in de wereld, met een botsing op zijn voetafdruk', opzet.gebouw && opzet.botsing, opzet);
check('Het interactiepunt van de commandopost ligt op de spelerplek voor de toonbank', JSON.stringify(opzet.punt) === JSON.stringify(opzet.spelerPlek), opzet);
check('Geen Bijenkorf-kiosk of Koninklijke Reparatie meer als interactiepunt', opzet.oud.length === 0, opzet.types);
check('Geen losse shopUI of bouwUI meer: één menupaneel', opzet.oudePanelen.length === 0, opzet.oudePanelen);

// --- 2. T opent het menu, 1–4 werken met de prijzen van nu -----------------

const menu = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const menuUI = document.getElementById('menuUI');
  const c = d.DAM_LAYOUT.commandopost;
  d.spel.teSpawnen = 0;
  d.speler.positie.set(c.spelerPlek[0], 0, c.spelerPlek[1]);
  d.updateInteracties(0);
  const prompt = document.getElementById('interactiePrompt').textContent;
  d.geldZet(1000);
  const prijzen = { vuurtempo: d.upgradeKosten('vuurtempo'), pickup: d.upgradeKosten('pickup'), snelheid: d.upgradeKosten('snelheid') };
  toets('KeyT');
  const open = { stand: d.menuStand() === d.COMMANDOPOST_MENU, zichtbaar: menuUI.style.display === 'block', tekst: menuUI.textContent };

  const uit = { prompt, prijzen, open, stappen: [] };
  const snelheidVoor = d.speler.snelheid;
  for (const [code, type] of [['Digit1', 'vuurtempo'], ['Digit2', 'pickup'], ['Digit3', 'snelheid']]) {
    const geld = d.geldStand(), niveau = d.upgrades[type];
    toets(code);
    uit.stappen.push({ type, betaald: geld - d.geldStand(), niveauErbij: d.upgrades[type] - niveau, menuOpen: d.menuStand() === d.COMMANDOPOST_MENU });
  }
  uit.snelheidErbij = +(d.speler.snelheid - snelheidVoor).toFixed(2);
  uit.naKoop = menuUI.textContent;

  // 4: monument repareren (eerst schade).
  d.spel.monumentHP = 60;
  d.renderMenu();
  const geld = d.geldStand();
  toets('Digit4');
  uit.reparatie = { hp: d.spel.monumentHP, betaald: geld - d.geldStand(), menuOpen: d.menuStand() === d.COMMANDOPOST_MENU };
  d.spel.monumentHP = d.MONUMENT_MAX_HP;
  const geldVoorHeel = d.geldStand();
  toets('Digit4');
  uit.alHeel = { hp: d.spel.monumentHP, betaald: geldVoorHeel - d.geldStand() };

  // Te weinig geld (en een beschadigd monument): alle vier gemarkeerd.
  d.spel.monumentHP = 50;
  d.geldZet(10);
  uit.teDuur = menuUI.querySelectorAll('.te-duur').length;

  // T sluit.
  d.spel.monumentHP = d.MONUMENT_MAX_HP;
  toets('KeyT');
  uit.naT = { stand: d.menuStand(), zichtbaar: menuUI.style.display };
  return uit;
});
check('De prompt bij de commandopost noemt upgrades en reparatie', menu.prompt.includes('commandopost') && menu.prompt.includes('repareren'), menu.prompt);
check('T opent het menupaneel met titel Commandopost en vier opties',
  menu.open.stand && menu.open.zichtbaar && menu.open.tekst.includes('Commandopost') && ['1, Vuurtempo', '2, Pickup', '3, Loopsnelheid', '4, Monument repareren'].every(t => menu.open.tekst.includes(t)), menu.open);
check('1–3 kopen de upgrades voor de prijs van nu en het menu blijft open',
  menu.stappen.every(s => s.betaald === menu.prijzen[s.type] && s.niveauErbij === 1 && s.menuOpen), menu.stappen);
check('Loopsnelheid werkt echt (+0,65 m/s)', menu.snelheidErbij === 0.65, menu);
check('Het menu toont na een aankoop het nieuwe niveau', menu.naKoop.includes('(niv. 1)'), menu.naKoop);
check('4 repareert het monument: +25 HP voor €100, menu blijft open', menu.reparatie.hp === 85 && menu.reparatie.betaald === 100 && menu.reparatie.menuOpen, menu.reparatie);
check('Een heel monument repareren kost niets', menu.alHeel.hp === 100 && menu.alHeel.betaald === 0, menu.alHeel);
check('Te weinig geld: de opties zijn als "te duur" gemarkeerd', menu.teDuur === 4, menu);
check('T sluit het menu weer', menu.naT.stand === null && menu.naT.zichtbaar === 'none', menu.naT);

// --- 3. Weglopen en pauzeren sluiten het menu ------------------------------

const sluiten = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const c = d.DAM_LAYOUT.commandopost;
  d.speler.positie.set(c.spelerPlek[0], 0, c.spelerPlek[1]);
  d.updateInteracties(0);
  d.activeerCommandopost();
  const openVoorLopen = d.menuStand() === d.COMMANDOPOST_MENU;
  d.speler.positie.set(c.spelerPlek[0] - 6, 0, c.spelerPlek[1]);
  d.updateInteracties(0);
  const naLopen = d.menuStand();
  d.speler.positie.set(c.spelerPlek[0], 0, c.spelerPlek[1]);
  d.updateInteracties(0);
  d.activeerCommandopost();
  const openVoorPauze = d.menuStand() === d.COMMANDOPOST_MENU;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return { openVoorLopen, naLopen, openVoorPauze, naPauze: d.menuStand(), zichtbaar: document.getElementById('menuUI').style.display };
});
check('Weglopen van de commandopost sluit het menu', sluiten.openVoorLopen && sluiten.naLopen === null, sluiten);
check('Pauzeren sluit het menu', sluiten.openVoorPauze && sluiten.naPauze === null && sluiten.zichtbaar === 'none', sluiten);

// --- 4. De HUD overlapt nergens --------------------------------------------
//
// Alle vaste UI-rechthoeken tegelijk zichtbaar, in hun breedste stand:
// menu open, prompt aan, combo en kerkklokbanner aan, special gereed,
// en de lange wave-regel van de bouwfase.

async function meetOverlap(breedte, hoogte) {
  await page.setViewportSize({ width: breedte, height: hoogte });
  return page.evaluate(() => {
    const d = window.DamChaosDebug;
    const c = d.DAM_LAYOUT.commandopost;
    const canvas = d.renderer.domElement;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
    document.dispatchEvent(new Event('pointerlockchange'));
    d.speler.positie.set(c.spelerPlek[0], 0, c.spelerPlek[1]);
    d.updateInteracties(0);
    d.activeerCommandopost();
    d.spel.volgendePoorten = ['Kalverstraat', 'Nieuwendijk'];
    d.spel.specialMeter = 100;
    d.spel.combo = 12; d.spel.comboTimer = 5;
    d.geldZet(123456);
    d.updateArcadeUI();
    for (const id of ['comboUI', 'kerkklokBanner', 'interactiePrompt']) document.getElementById(id).style.opacity = '1';
    const ids = ['geldUI', 'scoreUI', 'specialUI', 'menuLink', 'waveUI', 'objectiveUI', 'comboUI', 'kerkklokBanner', 'menuUI', 'interactiePrompt', 'hulpUI', 'minimapUI'];
    const rects = ids.map(id => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { id, zichtbaar: getComputedStyle(el).display !== 'none' && r.width > 0, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
    }).filter(r => r.zichtbaar);
    const overlap = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) overlap.push(`${a.id} × ${b.id}`);
    }
    const buitenBeeld = rects.filter(r => r.x0 < 0 || r.y0 < 0 || r.x1 > innerWidth || r.y1 > innerHeight).map(r => r.id);
    d.sluitMenu();
    for (const id of ['comboUI', 'kerkklokBanner', 'interactiePrompt']) document.getElementById(id).style.opacity = '0';
    return { aantal: rects.length, overlap, buitenBeeld, rects: rects.map(r => [r.id, Math.round(r.x0), Math.round(r.y0), Math.round(r.x1), Math.round(r.y1)]) };
  });
}
for (const [b, h] of [[1280, 720], [1024, 640]]) {
  const m = await meetOverlap(b, h);
  check(`HUD op ${b}×${h}: alle ${m.aantal} vaste UI-rechthoeken zichtbaar, geen enkele overlap`, m.aantal === 12 && m.overlap.length === 0, m);
  check(`HUD op ${b}×${h}: alles binnen beeld`, m.buitenBeeld.length === 0, m);
}

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
