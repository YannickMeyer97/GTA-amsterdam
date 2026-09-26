// Ticket D51 (speeltest na D49) — de Drukpers op eigen plekken voor het Paleis.
//
// De Muntpers (D49) was een toren op een gewone bouwplek die kills in zijn
// buurt meer liet opleveren. Na de speeltest: weg uit het torenmenu, drie
// eigen plekken voor het Paleis, en een vast inkomen om de 10 s, los van de
// robots, dat zich gemiddeld in drie rondes terugverdient.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const menuTekst = () => document.getElementById('menuUI').textContent;
  const bij = plek => { d.speler.positie.set(plek.positie.x + 1.2, 0, plek.positie.z); d.updateInteracties(0); };
  const weg = () => { d.speler.positie.set(-30, 0, 0); d.updateInteracties(0); };
  d.spel.teSpawnen = 0;
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  const uit = {};

  // 1. Weg uit het gewone torenmenu; niet te bouwen op een gewone plek.
  const gewoon = d.plekVoor('Damrak', 'knooppunt');
  d.geldZet(1000);
  bij(gewoon);
  uit.gewoonMenu = menuTekst();
  weg();
  uit.opGewonePlek = d.bouwToren(gewoon, 'drukpers');

  // 2. Drie eigen plekken voor het Paleis, niet bij de Kerkklok.
  const kk = d.DAM_LAYOUT.kerkklok.positie;
  uit.plekken = d.DRUKPERSPLEKKEN.map(p => ({
    naam: p.naam, x: p.positie.x, z: p.positie.z, soort: p.soort,
    interactie: d.interactiePunten.some(ip => ip.bouwplek === p),
    totKerkklok: Math.hypot(p.positie.x - kk[0], p.positie.z - kk[1]),
  }));
  const [p1, p2] = d.DRUKPERSPLEKKEN;
  uit.andersOpPers = ['geschut', 'bovenleiding', 'hek'].map(t => d.bouwToren(p1, t));

  // 3. Het menu op een drukpersplek: alleen de drukpers; 1 bouwt hem.
  d.geldZet(1000);
  bij(p1);
  uit.persMenu = menuTekst();
  toets('Digit1');
  uit.naBouw = { type: p1.toren?.type, geld: d.geldStand(), menu: menuTekst() };
  weg();

  // 4. Inkomen: om de 10 s, één uitbetaling voor alle persen samen.
  d.bouwToren(p2, 'drukpers');
  d.geldZet(0);
  const cfg = d.DRUKPERS_NIVEAUS[0];
  const popupsVoor = document.querySelectorAll('#popups .popup').length;
  const geldReeks = [];
  for (let i = 0; i < 250; i++) { d.updateTorens(0.1); if (i % 100 === 49) geldReeks.push(d.geldStand()); }
  uit.inkomen = { geldReeks, perPers: cfg.inkomen, interval: d.DRUKPERS_INTERVAL, popups: document.querySelectorAll('#popups .popup').length - popupsVoor, verdiend: [p1.toren.verdiend, p2.toren.verdiend] };

  // 5. Los van de robots: geen robots nodig, en een kill naast de pers
  // levert niet meer op dan elders.
  const echt = Math.random; Math.random = () => 0;
  const kill = (x, z) => { d.spel.combo = 0; d.spawnRobot(null, 'tank'); const rb = d.robots.at(-1); rb.groep.position.set(x, 0, z); d.raakRobot(rb, 99, 'speler'); return d.munten.at(-1).bedrag; };
  uit.killBijPers = kill(p1.positie.x + 2, p1.positie.z);
  uit.killElders = kill(0, 20);
  Math.random = echt;

  // 6. Upgraden: meer inkomen; terugverdientijd per niveau.
  d.geldZet(1000);
  const voorUpgrade = d.torenStats(p1.toren).inkomen;
  d.upgradeToren(p1.toren);
  uit.upgrade = { voor: voorUpgrade, na: d.torenStats(p1.toren).inkomen, niveau: p1.toren.niveau };
  uit.terugverdien = d.DRUKPERS_NIVEAUS.map((n, i) => {
    const investering = d.DRUKPERS_NIVEAUS.slice(0, i + 1).reduce((s, x) => s + x.prijs, 0);
    return { niveau: i + 1, investering, inkomen: n.inkomen, seconden: investering / (n.inkomen / d.DRUKPERS_INTERVAL) };
  });
  // Menu op een bebouwde plek: upgraden en verkopen, geen hek of reparatie.
  bij(p1);
  uit.bezetMenu = menuTekst();
  weg();

  // 7. Verkopen en reset.
  d.geldZet(0);
  const opbrengst = d.verkoopToren(p2.toren);
  uit.verkoop = { opbrengst, plekLeeg: p2.toren === null, geld: d.geldStand() };
  d.resetRun();
  uit.naReset = { persen: d.torens.filter(t => t.type === 'drukpers').length, timer: d.drukpersTimerStand() };
  return uit;
});

check('Het gewone torenmenu biedt geen drukpers of muntpers meer aan', !/Drukpers|Muntpers/.test(r.gewoonMenu) && r.gewoonMenu.includes('3, Hek'), r.gewoonMenu);
check('Een drukpers kan niet op een gewone bouwplek', r.opGewonePlek === null, r.opGewonePlek);
check('Drie drukpersplekken voor het Paleis (x tussen -66 en -50), elk een interactiepunt', r.plekken.length === 3 && r.plekken.every(p => p.soort === 'drukpers' && p.x > -66 && p.x < -50 && p.interactie), r.plekken);
check('Geen drukpersplek overlapt de Kerkklok (≥ 6,5 m)', r.plekken.every(p => p.totKerkklok >= 6.5), r.plekken);
check('Op een drukpersplek kan geen toren en geen hek', r.andersOpPers.every(x => x === null), r.andersOpPers);
check('Het menu op een drukpersplek biedt alleen de drukpers', r.persMenu.includes('1, Drukpers €150') && !r.persMenu.includes('2,'), r.persMenu);
check('1 bouwt de drukpers', r.naBouw.type === 'drukpers' && r.naBouw.geld === 850, r.naBouw);
check('Om de 10 s betalen de persen uit: 2 persen → €0 na 5 s, 2× het inkomen na 15 s, 4× na 25 s', r.inkomen.geldReeks.join() === `0,${2 * r.inkomen.perPers},${4 * r.inkomen.perPers}`, r.inkomen);
check('Eén popup per uitbetaling, niet één per pers', r.inkomen.popups === 2, r.inkomen);
check('Elke pers houdt bij wat hij verdiend heeft', r.inkomen.verdiend.every(v => v === 2 * r.inkomen.perPers), r.inkomen.verdiend);
check('Los van de robots: een kill naast de pers levert hetzelfde als elders', r.killBijPers === r.killElders, r);
check('Upgraden verhoogt het inkomen', r.upgrade.niveau === 2 && r.upgrade.na > r.upgrade.voor, r.upgrade);
// Ticket D43: een ronde met verdediging duurt gemeten ~65 s (was aangenomen ~85 s).
check('Elk niveau verdient zich in ~3 rondes (van ~65 s) terug: 180–215 s', r.terugverdien.every(t => t.seconden >= 180 && t.seconden <= 215), r.terugverdien);
check('Een bezette drukpersplek: upgraden en verkopen, geen hek en geen reparatie', r.bezetMenu.includes('Drukpers naar niveau 3') && r.bezetMenu.includes('Drukpers verkopen') && !r.bezetMenu.includes('Hek') && !r.bezetMenu.includes('repareren'), r.bezetMenu);
check('Verkopen levert de helft op en maakt de plek vrij', r.verkoop.opbrengst === 75 && r.verkoop.plekLeeg && r.verkoop.geld === 75, r.verkoop);
check('Een nieuwe run begint zonder persen en met de teller op nul', r.naReset.persen === 0 && r.naReset.timer === 0, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
