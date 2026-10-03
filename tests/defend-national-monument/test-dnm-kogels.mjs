// Ticket D78 (audit 14) — Zware kogels: een dure bestemming voor geld.
//
// Optie 6 bij de commandopost: +50% schade per treffer, twee niveaus
// (€500, €1000), daarna maximaal. Een treffer van de speler doet dan 1,5
// of 2 schade; torens veranderen niet. Een reset zet ze terug.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  d.resetRun();
  uit.start = { schade: d.spelerSchade(), prijs: d.upgradeKosten('kogels'), max: d.upgradeMax('kogels'), andereMax: d.upgradeMax('vuurtempo') };
  d.geldZet(499);
  d.koopUpgrade('kogels');
  uit.teWeinig = { niveau: d.upgrades.kogels, geld: d.geldStand() };
  d.geldZet(3000);
  d.koopUpgrade('kogels');
  uit.niv1 = { niveau: d.upgrades.kogels, betaald: 3000 - d.geldStand(), schade: d.spelerSchade(), volgende: d.upgradeKosten('kogels') };
  const voor = d.geldStand();
  d.koopUpgrade('kogels');
  uit.niv2 = { niveau: d.upgrades.kogels, betaald: voor - d.geldStand(), schade: d.spelerSchade() };
  const voor3 = d.geldStand();
  d.koopUpgrade('kogels');
  uit.max = { niveau: d.upgrades.kogels, betaald: voor3 - d.geldStand() };
  // Het menu bij de commandopost.
  d.openMenu?.(d.COMMANDOPOST_MENU);
  d.renderMenu();
  uit.menu = document.getElementById('menuUI').textContent;
  // Een echte treffer: een Pantserbot (5 HP) verliest 2 per treffer.
  // Op het open plein voor het monument, zodat er niets tussen zit.
  const M = d.MONUMENT_POSITIE;
  d.spawnRobot(null, 'pantserbot');
  const p = d.robots.at(-1);
  p.snelheid = 0;
  p.groep.position.set(M.x, 0, M.z + 12);
  const hp0 = p.hp;
  d.speler.positie.set(M.x, 0, M.z + 18);
  d.camera.position.set(M.x, 1.6, M.z + 18);
  d.camera.lookAt(M.x, 1.1, M.z + 12);
  d.camera.updateMatrixWorld(true);
  d.scene.updateMatrixWorld(true);
  d.schiet();
  uit.treffer = { hp0, hp: p.hp };
  // Torens doen niet meer dan eerst.
  uit.toren = d.torenStats({ type: 'geschut', niveau: 1 }).schadePerSchot;
  d.resetRun();
  uit.naReset = { niveau: d.upgrades.kogels, schade: d.spelerSchade() };
  return uit;
});

check('Zonder upgrade doet een treffer 1; de eerste kost €500; maximaal 2 niveaus (de rest 5)', r.start.schade === 1 && r.start.prijs === 500 && r.start.max === 2 && r.start.andereMax === 5, r.start);
check('Te weinig geld: niets gekocht', r.teWeinig.niveau === 0 && r.teWeinig.geld === 499, r.teWeinig);
check('Niveau 1: €500, 1,5 schade per treffer; het volgende kost €1000', r.niv1.niveau === 1 && r.niv1.betaald === 500 && r.niv1.schade === 1.5 && r.niv1.volgende === 1000, r.niv1);
check('Niveau 2: €1000, 2 schade per treffer', r.niv2.niveau === 2 && r.niv2.betaald === 1000 && r.niv2.schade === 2, r.niv2);
check('Daarna maximaal: niets meer te kopen', r.max.niveau === 2 && r.max.betaald === 0, r.max);
check('Het menu toont "5, Zware kogels …, maximaal (niv. 2)" (5 sinds D88)', /5, Zware kogels, \+50% schade per treffer, maximaal \(niv\. 2\)/.test(r.menu), r.menu.slice(-120));
check('Een treffer op een Pantserbot doet nu 2 schade', r.treffer.hp0 - r.treffer.hp === 2, r.treffer);
check('Torens doen niet meer schade dan eerst', r.toren === 2, r.toren);
check('Een reset zet de kogels terug', r.naReset.niveau === 0 && r.naReset.schade === 1, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
