// Ticket D34 (SONNET_EXECUTION_PLAN_monument.md §11.5, fase M) — routes
// zichtbaar maken.
//
// In de bouwfase lichten de routes van de aangekondigde poorten fel op, als
// een spoor van pijlpunten van de poort naar het monument; tijdens de wave
// is het spoor van de actieve routes gedimd. Het baken staat bij de
// straatingang, naast een straatnaambord, en de minimap tekent rijbanen en
// de routes met een spoor.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  for (const rb of [...d.robots]) { d.scene.remove(rb.groep); d.robots.splice(d.robots.indexOf(rb), 1); }
  const zichtbaar = () => [...d.routeSporen].filter(([, s]) => s.visible).map(([n, s]) => [n, s.material.opacity]).sort();

  // Bouwfase: twee routes aangekondigd.
  d.spel.actievePoorten = ['Rokin'];
  d.spel.volgendePoorten = ['Damrak', 'Kalverstraat'];
  d.updatePoortBakens();
  const bouwfase = zichtbaar();

  // Wave: de aankondiging is de nieuwe actieve set.
  d.spel.actievePoorten = ['Damrak', 'Kalverstraat'];
  d.spel.volgendePoorten = [];
  d.updatePoortBakens();
  const wave = zichtbaar();

  // Een spoor volgt de hele route en houdt nooit een schot tegen.
  const spoor = d.routeSporen.get('Damrak');
  spoor.geometry.computeBoundingBox();
  const bb = spoor.geometry.boundingBox;
  const route = d.ROUTES.get('Damrak');
  const [px, pz] = route.punten[0], [ex, ez] = route.punten[route.punten.length - 1];
  const dekt = bb.min.z <= Math.min(pz, ez) + 0.01 && bb.max.z >= Math.max(pz, ez) - 0.01 && bb.min.x <= Math.min(px, ex) + 0.01 && bb.max.x >= Math.max(px, ex) - 0.01;
  const raycaster = new d.raycaster.constructor(new spoor.position.constructor(px, 5, pz), new spoor.position.constructor(0, -1, 0), 0, 10);
  const raak = raycaster.intersectObject(spoor);

  // Bakens en straatnaamborden bij de straatingang.
  const ingangen = d.SPAWN_POORTEN.map(p => {
    const baken = d.poortBakens.get(p.naam);
    const ingang = baken.userData.ingang;
    const bord = d.straatNaamborden.get(p.naam);
    const bordPos = bord.position;
    return {
      naam: p.naam,
      totPoort: +Math.hypot(baken.position.x - p.positie.x, baken.position.z - p.positie.z).toFixed(1),
      opRoute: d.projecteerOpRoute(d.ROUTES.get(p.naam), baken.position.x, baken.position.z).afstand < 0.01,
      sIngang: +ingang.s.toFixed(1),
      bordBijIngang: Math.hypot(bordPos.x - baken.position.x, bordPos.z - baken.position.z) < ingang.breedte / 2 + 2,
      bordNaastStrook: Math.hypot(bordPos.x - baken.position.x, bordPos.z - baken.position.z) > ingang.breedte / 2,
      bordInWereld: bord.parent === d.wereld,
    };
  });

  return { bouwfase, wave, dekt, raak: raak.length, ingangen, helder: d.SPOOR_HELDER, gedimd: d.SPOOR_GEDIMD };
});

check('Bouwfase: precies de sporen van de aangekondigde routes branden, fel',
  JSON.stringify(r.bouwfase) === JSON.stringify([['Damrak', r.helder], ['Kalverstraat', r.helder]]), r.bouwfase);
check('Wave: de sporen van de actieve routes zijn gedimd (minder dan de helft van fel)',
  JSON.stringify(r.wave) === JSON.stringify([['Damrak', r.gedimd], ['Kalverstraat', r.gedimd]]) && r.gedimd < r.helder / 2, r.wave);
check('Het spoor loopt over de hele route, van poort tot monument', r.dekt, r);
check('Het spoor houdt nooit een schot tegen', r.raak === 0, r);
for (const i of r.ingangen) {
  check(`${i.naam}: het baken staat op de route bij de straatingang, niet bij de poort`, i.opRoute && i.totPoort >= 5 && i.sIngang > 0, i);
  check(`${i.naam}: naast de strook, bij het baken, staat een straatnaambord`, i.bordBijIngang && i.bordNaastStrook && i.bordInWereld, i);
}

// --- Het spoor beweegt mee met de looprichting ------------------------------

const beweging = await page.evaluate(async () => {
  const d = window.DamChaosDebug;
  d.animeerPoortBakens();
  const a = d.spoorTextuur.offset.y;
  const klokA = d.klokStand();
  await new Promise(res => setTimeout(res, 400));
  d.animeerPoortBakens();
  return { a, b: d.spoorTextuur.offset.y, klokA, klokB: d.klokStand() };
});
check('De pijlpunten schuiven met de tijd (textuur-offset verandert)', beweging.a !== beweging.b || beweging.klokA === beweging.klokB, beweging);

// --- Minimap: draait mee (D44), rijbanen en het spoor van de actieve route --

const minimap = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.actievePoorten = []; d.spel.volgendePoorten = ['Damstraat'];
  d.updatePoortBakens();
  const doek = document.getElementById('minimapCanvas');
  const ctx = doek.getContext('2d');
  // Heading-up: een punt 20 m recht vóór de speler staat bij elke
  // kijkrichting recht boven het midden.
  const vooruit = [0, 1.1, 2.6, -2.2].map(yaw => {
    d.speler.positie.set(8, 0, 6); d.speler.yaw = yaw;
    const [x, y] = d.naarMinimap(8 - Math.sin(yaw) * 20, 6 - Math.cos(yaw) * 20);
    return [yaw, +x.toFixed(3), +y.toFixed(3)];
  });
  const schaal = (doek.width / 2) / d.MINIMAP_BEREIK;
  // Spoor en rijbaan: speler op het plein, schuin kijkend.
  d.speler.positie.set(8, 0, 6); d.speler.yaw = 0.7;
  d.tekenMinimap();
  const pixel = (x, z) => { const [cx, cz] = d.naarMinimap(x, z); return [...ctx.getImageData(Math.round(cx), Math.round(cz), 1, 1).data]; };
  return { vooruit, midden: [doek.width / 2, doek.height / 2], schaal, spoorPixel: pixel(30, 14), rijbaanPixel: pixel(-19, -35) };
});
check('Minimap draait mee: wat 20 m voor je ligt, staat bij elke kijkrichting recht boven het midden',
  minimap.vooruit.every(([, x, y]) => Math.abs(x - minimap.midden[0]) < 0.01 && Math.abs(y - (minimap.midden[1] - 20 * minimap.schaal)) < 0.01), minimap.vooruit);
const [sr, sg, sb] = minimap.spoorPixel;
const [rr, rg, rb] = minimap.rijbaanPixel;
check('Minimap: de aangekondigde route is oranje getekend', sr > 200 && sg > 120 && sb < 110, minimap);
check('Minimap: een rijbaan zonder dreiging is grijs, niet oranje', Math.abs(rr - rb) < 40 && rr < 170, minimap);

// --- Na een reset: geen fel spoor meer, alleen wave 1 gedimd ---------------

const naReset = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.volgendePoorten = ['Damrak', 'Rokin', 'Nieuwendijk'];
  d.updatePoortBakens();
  d.resetRun();
  const aan = [...d.routeSporen].filter(([, s]) => s.visible);
  return { aan: aan.map(([n, s]) => [n, s.material.opacity]), actief: [...d.spel.actievePoorten], helder: d.SPOOR_HELDER };
});
check('Na resetRun(): geen fel spoor meer; alleen de actieve route van wave 1, gedimd',
  naReset.aan.length === naReset.actief.length && naReset.aan.every(([n, o]) => naReset.actief.includes(n) && o < naReset.helder), naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
