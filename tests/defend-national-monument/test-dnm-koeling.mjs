// Ticket D19 (SONNET_EXECUTION_PLAN_monument.md, fase 4) — koeling als
// vierde wapen-upgrade, bij de commandopost.
//
// Prijsformule, het effect per niveau (minder warmte per schot, snellere
// afkoeling), dat het aantal schoten tot oververhitting meetbaar stijgt, en
// dat een reset de koeling terugzet.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const w = d.wapenWarmte;
  const uit = {};
  d.resetRun();

  // 1. In het commandopostmenu, als vierde upgrade (toets 4).
  const cp = d.DAM_LAYOUT.commandopost;
  const punt = d.interactiePunten.find(p => p.type === 'commandopost');
  d.speler.positie.set(punt.positie.x, 0, punt.positie.z);
  d.updateInteracties(0);
  uit.menu = document.getElementById('menuUI').textContent;

  // 2. Prijzen: 125, 250, 375, …; maximaal niveau 5.
  d.geldZet(10000);
  const prijzen = [];
  for (let i = 0; i < 6; i++) { prijzen.push(d.upgradeKosten('koeling')); d.koopUpgrade('koeling'); }
  uit.prijzen = prijzen;
  uit.niveauNaZes = d.upgrades.koeling;
  uit.geldOver = d.geldStand();

  // 3. Effect per niveau.
  uit.perNiveau = [0, 1, 2, 3, 4, 5].map(n => { d.upgrades.koeling = n; return { n, perSchot: d.warmtePerSchot(), afkoeling: d.warmteAfkoeling() }; });

  // 4. Schoten tot oververhitting bij vuurtempo 3, per koelniveau.
  uit.schotenTotOververhit = [0, 2, 5].map(n => {
    d.resetRun();
    d.upgrades.vuurtempo = 3;
    d.upgrades.koeling = n;
    let schoten = 0, t = 0;
    while (!w.oververhit && t < 60) { schoten += d.simuleerVuren(1 / 60); t += 1 / 60; }
    // En hoe lang de blokkade daarna duurt.
    let blok = 0;
    while (w.oververhit && blok < 10) { d.simuleerVuren(1 / 60, false); blok += 1 / 60; }
    return { koeling: n, schoten, tijd: t, blok };
  });

  // 5. Reset zet de koeling terug.
  d.upgrades.koeling = 4;
  d.resetRun();
  uit.naReset = { koeling: d.upgrades.koeling, perSchot: d.warmtePerSchot() };
  return uit;
});

check('Het commandopostmenu biedt Koeling aan als vierde upgrade (toets 4), vóór de reparatie', /4, Koeling/.test(r.menu) && /5, Monument repareren/.test(r.menu), r.menu);
check('Prijs: €125 × (niveau + 1): 125, 250, 375, 500, 625', JSON.stringify(r.prijzen.slice(0, 5)) === JSON.stringify([125, 250, 375, 500, 625]), r.prijzen);
check('Maximaal niveau 5: een zesde koop doet niets', r.niveauNaZes === 5 && r.geldOver === 10000 - (125 + 250 + 375 + 500 + 625), r);
check('Per niveau minder warmte per schot en snellere afkoeling', r.perNiveau.every((x, i) => i === 0 || (x.perSchot < r.perNiveau[i - 1].perSchot && x.afkoeling > r.perNiveau[i - 1].afkoeling)), r.perNiveau);
check('Niveau 0 is precies de basis (geen verborgen effect)', r.perNiveau[0].perSchot === 4 && r.perNiveau[0].afkoeling === 28, r.perNiveau[0]);
const [k0, k2, k5] = r.schotenTotOververhit;
check('Het aantal schoten tot oververhitting stijgt meetbaar met de koeling (0 → 2 → 5)', k2.schoten > k0.schoten * 1.2 && k5.schoten > k2.schoten * 1.3, r.schotenTotOververhit);
check('Met koeling is de blokkade na oververhitting korter', k5.blok < k0.blok - 0.5, r.schotenTotOververhit);
check('Reset zet de koeling terug op 0', r.naReset.koeling === 0 && r.naReset.perSchot === 4, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
