// Ticket D56 (SONNET_EXECUTION_PLAN_monument.md, §12, fase P) — het
// baassysteem.
//
// Een baaswave (5, 10, 15, en sinds D69 20) spawnt precies één baas, als eerste, uit één
// poort, met een half zo groot escorte. De HP-balk bovenin volgt de baas;
// een kill geeft een vaste beloning en een banner, het monument halen een
// zware klap. De aankondiging noemt de baas met een tip, en een reset ruimt
// alles op. Het eigen gedrag per baas toetst test-dnm-bazen (D57).
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const leeg = () => { for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); } };
  const ui = () => ({
    zichtbaar: getComputedStyle(document.getElementById('baasUI')).display !== 'none',
    naam: document.getElementById('baasNaam').textContent,
    breedte: parseFloat(document.getElementById('baasVul').style.width),
  });

  // 1. Welke waves.
  uit.rooster = {};
  for (let w = 1; w <= 30; w++) { const b = d.baasVoorWave(w); if (b) uit.rooster[w] = b; }

  // 2. Baaswave 5: één poort, doel = half escorte + 1, de eerste spawn is de baas.
  d.resetRun();
  d.spel.volgendePoorten = [];
  d.startWave(5);
  uit.wave5 = { poorten: d.spel.actievePoorten.length, doel: d.spel.waveDoel, verwachtDoel: Math.round(d.waveBasisAantal(5) * d.BAAS_ESCORTE_FACTOR) + 1, banner: document.getElementById('waveBanner').textContent };
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  const baas = d.robots[0];
  uit.eerste = { type: baas?.type, baas: baas?.baas, hp: baas?.hp, hpMax: baas?.hpMax, laan: baas?.laanFractie, schaal: baas?.groep.scale.x, poort: d.spel.actievePoorten[0], route: baas?.route?.poort };
  uit.uiBijSpawn = ui();
  // De hele wave uitspawnen: nooit een tweede baas.
  d.spel.maxActieveRobots = 999;
  d.updateWaveSysteem(0);
  uit.bazenInWave = d.robots.filter(x => x.baas).length;
  uit.totaal = d.robots.length;

  // 3. Raken: de balk volgt.
  d.raakRobot(baas, 15, 'speler');
  uit.naRaak = { hp: baas.hp, ui: ui() };

  // 4. Kill: vaste beloning, banner, balk weg, telling.
  const geldVoor = d.geldStand(), scoreVoor = d.spel.score;
  d.raakRobot(baas, 1000, 'toren');
  uit.naKill = { geld: d.geldStand() - geldVoor, score: d.spel.score - scoreVoor, beloning: d.BAZEN.sloopkogel.beloning, ui: ui(), levend: !!d.levendeBaas(), stat: d.runStats.bazenVerslagen, banner: document.getElementById('waveBanner').textContent };

  // 5. De baas haalt het monument: zware klap, balk weg.
  d.resetRun();
  d.spel.volgendePoorten = [];
  d.startWave(10);
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  const b10 = d.levendeBaas();
  const hpVoor = d.spel.monumentHP;
  d.robotRaaktMonument(b10);
  uit.monument = { type: b10.type, schade: hpVoor - d.spel.monumentHP, verwacht: d.ROBOT_TYPES.dijkbreker.monumentSchade, ui: ui() };

  // 6. De aankondiging vóór een baaswave noemt de baas en een tip.
  d.resetRun();
  d.spel.volgendePoorten = [];
  d.startWave(14);
  leeg();
  d.spel.teSpawnen = 0;
  for (let i = 0; i < 25; i++) d.updateWaveSysteem(0.1);
  const banner = document.getElementById('waveBanner');
  uit.aankondiging = { tekst: banner.textContent, tip: banner.querySelector('.tip')?.textContent ?? null, poorten: d.spel.volgendePoorten.length };

  // 7. Reset midden in een baaswave: geen baas, balk weg, telling 0.
  d.startWave(15);
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  uit.voorReset = { baas: d.levendeBaas()?.type, ui: ui() };
  d.resetRun();
  uit.naReset = { baas: d.levendeBaas(), ui: ui(), spelBaas: d.spel.baas, stat: d.runStats.bazenVerslagen };

  // 8. Een gewone wave heeft geen baas.
  d.startWave(6);
  d.spel.maxActieveRobots = 999;
  d.updateWaveSysteem(0);
  uit.gewoon = { baas: d.spel.baas, bazen: d.robots.filter(x => x.baas).length };
  d.resetRun();
  return uit;
});

check('Bazen op wave 5, 10, 15 en 20 (D69), en nergens anders (ook niet na de run)', JSON.stringify(r.rooster) === JSON.stringify({ 5: 'sloopkogel', 10: 'dijkbreker', 15: 'stoomwals', 20: 'heimachine' }), r.rooster);
check('Een baaswave komt uit één poort, met de baas plus een half zo groot escorte', r.wave5.poorten === 1 && r.wave5.doel === r.wave5.verwachtDoel, r.wave5);
check('De wavebanner noemt de baas', /Wave 5: De Sloopkogel!/.test(r.wave5.banner), r.wave5.banner);
check('De eerste spawn is de baas, met vol HP, midden op de strook, groot, op de route van de actieve poort',
  r.eerste.type === 'sloopkogel' && r.eerste.baas && r.eerste.hp === r.eerste.hpMax && r.eerste.laan === 0 && r.eerste.schaal > 1.5 && r.eerste.route === r.eerste.poort, r.eerste);
check('Bij de spawn verschijnt de balk met de naam, vol', r.uiBijSpawn.zichtbaar && r.uiBijSpawn.naam === 'DE SLOOPKOGEL' && r.uiBijSpawn.breedte === 100, r.uiBijSpawn);
check('Precies één baas in de hele wave', r.bazenInWave === 1 && r.totaal === r.wave5.doel, r);
check('De balk volgt de HP (15 van 60 eraf → 75%)', r.naRaak.hp === 45 && Math.abs(r.naRaak.ui.breedte - 75) < 1e-9, r.naRaak);
check('Kill: vaste beloning, 1000 punten, banner en telling; balk weg', r.naKill.geld === r.naKill.beloning && r.naKill.score === 1000 && !r.naKill.ui.zichtbaar && !r.naKill.levend && r.naKill.stat === 1 && /verslagen/.test(r.naKill.banner), r.naKill);
check('Haalt de baas het monument: de zware klap van zijn type, balk weg', r.monument.type === 'dijkbreker' && r.monument.schade === r.monument.verwacht && r.monument.schade >= 40 && !r.monument.ui.zichtbaar, r.monument);
check('De aankondiging vóór wave 15 noemt de Stoomwals, met een tip, en één poort', /Volgende wave: De Stoomwals!/.test(r.aankondiging.tekst) && r.aankondiging.tip && r.aankondiging.poorten === 1, r.aankondiging);
check('Reset midden in een baaswave: geen baas, balk weg, telling op 0', r.voorReset.baas === 'stoomwals' && r.voorReset.ui.zichtbaar && r.naReset.baas === null && !r.naReset.ui.zichtbaar && r.naReset.spelBaas === null && r.naReset.stat === 0, r);
check('Een gewone wave heeft geen baas', r.gewoon.baas === null && r.gewoon.bazen === 0, r.gewoon);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
