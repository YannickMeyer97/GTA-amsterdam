// Ticket D73 (audit 9) — bereikcirkels bij het bouwen.
//
// Zolang het menu van een bouwplek open is, liggen er cirkels op straat:
// op een lege plek geschut (11 m) en Bovenleiding (10 m); bij een toren het
// huidige bereik fel en dat van het volgende niveau of van de ontgrendelde
// richtingen vaag. Menu dicht: cirkels weg. De menuopties hebben een stip
// in de kleur van hun cirkel. De geometrie wordt hergebruikt.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const zichtbaar = () => d.bereikRingen.filter(x => x.visible).map(x => ({
    straal: Math.round(x.geometry.parameters.outerRadius * 10) / 10,
    kleur: x.material.color.getHex(), fel: x.material.opacity === d.BEREIK_FEL, vulling: x.userData.vulling.visible,
    x: x.position.x, z: x.position.z,
  })).sort((a, b) => a.straal - b.straal);
  const open = plek => { d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z); d.updateInteracties(0); };
  const weg = () => { d.speler.positie.set(0, 0, 60); d.updateInteracties(0); };
  d.resetRun();
  d.geldZet(1e6);
  d.voortgang.bazen.sloopkogel = false;

  // 1. Lege plek: geschut en Bovenleiding.
  const plek = d.plekVoor('Rokin', 'knooppunt');
  open(plek);
  uit.leeg = { ringen: zichtbaar(), plek: { x: plek.positie.x, z: plek.positie.z }, menu: document.getElementById('menuUI').innerHTML };
  weg();
  uit.dicht = zichtbaar().length;

  // 2. Geschut niveau 1: 11 fel, 13 vaag.
  const t = d.bouwToren(plek, 'geschut');
  open(plek);
  uit.niv1 = zichtbaar();
  // 3. Niveau 2, Scherpschutter op slot: alleen 13 (het Kanon heeft ook 13).
  d.upgradeToren(t);
  open(plek); weg(); open(plek);
  uit.niv2slot = zichtbaar();
  // 4. Scherpschutter open: 13 fel, 22 vaag.
  d.voortgang.bazen.sloopkogel = true;
  weg(); open(plek);
  uit.niv2open = zichtbaar();
  // 5. Kanon (niveau 3): alleen 13.
  d.upgradeToren(t, 'kanon');
  weg(); open(plek);
  uit.kanon = zichtbaar();
  // 6. Bovenleiding op een andere plek: blauw.
  const plek2 = d.plekVoor('Rokin', 'voorpost');
  d.bouwToren(plek2, 'bovenleiding');
  weg(); open(plek2);
  uit.bovenleiding = zichtbaar();
  // 7. Een drukpersplek: geen cirkels.
  weg(); open(d.DRUKPERSPLEKKEN[0]);
  uit.drukpers = { ringen: zichtbaar().length, menu: document.getElementById('menuUI').style.display };
  // 8. Hergebruik: vaak open en dicht maakt geen nieuwe ringen of geometrie.
  // (renderer.info telt pas wat gerenderd is: eerst één ronde open en renderen.)
  weg(); open(plek); d.renderer.render(d.scene, d.camera); weg(); open(plek2); d.renderer.render(d.scene, d.camera);
  const voor = { ringen: d.bereikRingen.length, geos: d.renderer.info.memory.geometries };
  for (let i = 0; i < 20; i++) { weg(); open(plek); weg(); open(plek2); }
  d.renderer.render(d.scene, d.camera);
  uit.hergebruik = { voor, na: { ringen: d.bereikRingen.length, geos: d.renderer.info.memory.geometries } };
  // 9. Een reset sluit het menu en de cirkels.
  d.resetRun();
  uit.naReset = zichtbaar().length;
  return uit;
});

const GOUD = 0xffd75e, BLAUW = 0x7fd4ff;
check('Lege plek: twee felle cirkels, Bovenleiding 10 m (blauw) en geschut 11 m (goud), op de plek', r.leeg.ringen.length === 2 && r.leeg.ringen[0].straal === 10 && r.leeg.ringen[0].kleur === BLAUW && r.leeg.ringen[1].straal === 11 && r.leeg.ringen[1].kleur === GOUD && r.leeg.ringen.every(x => x.fel && x.vulling && x.x === r.leeg.plek.x && x.z === r.leeg.plek.z), r.leeg.ringen);
check('Het menu heeft een stip in de kleur van elke cirkel', r.leeg.menu.includes('#ffd75e') && r.leeg.menu.includes('#7fd4ff') && r.leeg.menu.includes('●'), r.leeg.menu);
check('Menu dicht: geen cirkels', r.dicht === 0, r.dicht);
check('Geschut niveau 1: 11 m fel, niveau 2 (13 m) vaag zonder vulling', JSON.stringify(r.niv1.map(x => [x.straal, x.fel, x.vulling])) === JSON.stringify([[11, true, true], [13, false, false]]), r.niv1);
check('Niveau 2 met de Scherpschutter op slot: alleen 13 m (het Kanon reikt even ver)', r.niv2slot.length === 1 && r.niv2slot[0].straal === 13 && r.niv2slot[0].fel, r.niv2slot);
check('Scherpschutter ontgrendeld: 13 m fel en 22 m vaag', JSON.stringify(r.niv2open.map(x => [x.straal, x.fel])) === JSON.stringify([[13, true], [22, false]]), r.niv2open);
check('Kanon (niveau 3, maximaal): alleen zijn eigen 13 m', r.kanon.length === 1 && r.kanon[0].straal === 13, r.kanon);
check('Bovenleiding: blauwe cirkels, 10 m fel en 11 m vaag', r.bovenleiding.length === 2 && r.bovenleiding.every(x => x.kleur === BLAUW) && r.bovenleiding[0].straal === 10 && r.bovenleiding[1].straal === 11, r.bovenleiding);
check('Drukpersplek: menu open, geen cirkels', r.drukpers.ringen === 0 && r.drukpers.menu === 'block', r.drukpers);
check('Vaak open en dicht: geen nieuwe ringen of geometrie', r.hergebruik.na.ringen === r.hergebruik.voor.ringen && r.hergebruik.na.geos === r.hergebruik.voor.geos, r.hergebruik);
check('Een reset haalt de cirkels weg', r.naReset === 0, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
