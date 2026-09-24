// Ticket D32 (SONNET_EXECUTION_PLAN_monument.md §11.5, fase M) — het nieuwe
// fundament: de Dam op mensmaat 1:1, gebouwd uit één bron (DAM_LAYOUT).
//
// Wat deze test bewaakt:
// 1. DAM_LAYOUT in de game is gelijk aan het JSON-blok in
//    docs/defend-national-monument/PLATTEGROND.html. De plattegrond is bij
//    M1 goedgekeurd; zo blijft hij de bron en kan de game er niet stil van
//    afwijken.
// 2. Alle toetsen van de plattegrond zijn goed (routelengtes, wapenbereik,
//    bouwplekken, kerkklok, geen overlap, …). Door punt 1 gelden ze ook voor
//    de game.
// 3. "Rijbanen zijn heilig" (§11.3 punt 4) in de game zelf: geen enkel
//    geregistreerd obstakel ligt op een rijbaan, de trambaan of een
//    routestrook.
// 4. De wereld is echt 1:1: geen schaal op `wereld`, en elk gebouw uit de
//    layout staat er, met zijn voetafdruk als botsing.
// 5. Vloer: vloerHoogte volgt platform en stoepen, en elke vloertextuur is
//    deterministisch (twee keer tekenen geeft dezelfde pixels).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { openDefend, makeChecker, executablePathOptie } from '../helpers-defend.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLATTEGROND = path.join(__dirname, '..', '..', 'docs', 'defend-national-monument', 'PLATTEGROND.html');

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- De plattegrond zelf, in een eigen pagina -------------------------------

const eigenBrowser = globalThis.__AMSTERDAM_UNDEAD_SHARED_BROWSER__ ? null : await chromium.launch(executablePathOptie);
const plattegrondContext = await (globalThis.__AMSTERDAM_UNDEAD_SHARED_BROWSER__ ?? eigenBrowser).newContext();
const plattegrondPagina = await plattegrondContext.newPage();
await plattegrondPagina.goto(pathToFileURL(PLATTEGROND).href);
const plattegrond = await plattegrondPagina.evaluate(() => ({
  layout: window.PLATTEGROND.layout,
  toetsen: window.PLATTEGROND.toetsen,
}));
await plattegrondContext.close();
if (eigenBrowser) await eigenBrowser.close();

// --- 1 en 2: één bron --------------------------------------------------------

const gameLayout = await page.evaluate(() => window.DamChaosDebug.DAM_LAYOUT);
check('DAM_LAYOUT in de game is gelijk aan de plattegrond (PLATTEGROND.html)',
  JSON.stringify(gameLayout) === JSON.stringify(plattegrond.layout), { versieGame: gameLayout?.versie, versiePlattegrond: plattegrond.layout.versie });
const fout = plattegrond.toetsen.filter(t => !t.goed);
check(`Alle ${plattegrond.toetsen.length} toetsen van de plattegrond zijn goed`, fout.length === 0, fout);

// --- 3 t/m 5: de game zelf ---------------------------------------------------

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const L = d.DAM_LAYOUT;
  const heilig = L.vlakken.filter(v => v.soort === 'asfalt' || v.soort === 'trambaan');
  const afstandPuntRect = (x, z, o) => Math.hypot(Math.max(o.minX - x, 0, x - o.maxX), Math.max(o.minZ - z, 0, z - o.maxZ));
  const isMonument = o => Math.abs(o.minX - d.MONUMENT_BOX.minX) < 1e-6 && Math.abs(o.maxZ - d.MONUMENT_BOX.maxZ) < 1e-6;

  // Elk obstakel tegen elke routestrook: bemonsterd per 0,25 m, met 0,3 m
  // marge. De laatste 0,6 m van een route ligt tegen de speldoos aan: daar
  // moet de robot het monument juist raken.
  const opStrook = [];
  for (const o of d.obstakels) {
    if (isMonument(o)) continue;
    for (const route of d.ROUTES.values()) {
      for (let s = 0; s <= route.lengte - 0.6; s += 0.25) {
        const p = d.puntOp(route, s);
        if (afstandPuntRect(p.x, p.z, o) < p.breedte / 2 + 0.3) { opStrook.push({ route: route.poort, s, o }); break; }
      }
    }
  }
  const opRijbaan = d.obstakels.filter(o => heilig.some(v =>
    o.minX < v.rect[2] && o.maxX > v.rect[0] && o.minZ < v.rect[3] && o.maxZ > v.rect[1]));

  // Elk gebouw uit de layout staat in de wereld, met een obstakel per deel.
  const gebouwen = L.gebouwen.map(g => ({
    naam: g.naam,
    groep: d.gebouwGroepen.get(g.naam)?.parent === d.wereld,
    botsingen: g.delen.every(([x0, z0, x1, z1]) => d.obstakels.some(o =>
      Math.abs(o.minX - (x0 - 0.3)) < 1e-6 && Math.abs(o.maxX - (x1 + 0.3)) < 1e-6 && Math.abs(o.minZ - (z0 - 0.3)) < 1e-6 && Math.abs(o.maxZ - (z1 + 0.3)) < 1e-6)),
    hoogte: (() => {
      let max = 0;
      d.gebouwGroepen.get(g.naam)?.traverse(m => { if (m.isMesh) { m.geometry.computeBoundingBox(); m.updateWorldMatrix(true, false); max = Math.max(max, m.geometry.boundingBox.max.clone().applyMatrix4(m.matrixWorld).y); } });
      return max;
    })(),
    verwacht: g.hoogsteDeel,
  }));

  // Punten binnen GRENS.
  const G = d.GRENS;
  const binnen = ([x, z]) => x >= G.minX && x <= G.maxX && z >= G.minZ && z <= G.maxZ;
  const punten = [
    ...L.routes.map(rt => ['poort ' + rt.poort, rt.punten[0]]),
    ...L.bouwplekken.map(b => [`plek ${b.naam}`, b.positie]),
    ['commandopost', L.commandopost.spelerPlek], ['kerkklok', L.kerkklok.positie], ['start', L.spelerStart.positie],
  ];

  // Vloerhoogte: bovenop het platform, op een stoep, op het plein.
  const m = L.monument;
  const hoogtes = {
    platformBoven: d.vloerHoogte(m.midden[0] + m.treden[m.treden.length - 1] - 0.1, m.midden[1]),
    platformOnder: d.vloerHoogte(m.midden[0] + m.treden[0] - 0.1, m.midden[1]),
    stoep: d.vloerHoogte(-12.75, -40),
    plein: d.vloerHoogte(-30, 0),
  };

  // Determinisme: elke vloertextuur opnieuw tekenen met dezelfde seed en
  // de pixels vergelijken met de textuur die de game gebruikt.
  function hash(canvas) {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 2166136261;
    for (let i = 0; i < data.length; i += 7) { h ^= data[i]; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const texturen = Object.keys(d.TEXTUUR_TEKENAARS).map(patroon => {
    const tex = d.vloerTextuur(patroon);
    const kopie = document.createElement('canvas');
    kopie.width = kopie.height = tex.userData.canvas.width;
    // Zelfde zaad als de game (tekstZaad + mulberry32), hier nagebouwd.
    let h = 2166136261;
    for (let i = 0; i < patroon.length; i++) { h ^= patroon.charCodeAt(i); h = Math.imul(h, 16777619); }
    let t = h >>> 0;
    const rnd = () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    d.TEXTUUR_TEKENAARS[patroon](kopie.getContext('2d'), kopie.width, rnd);
    return { patroon, gelijk: hash(kopie) === hash(tex.userData.canvas) };
  });

  return {
    schaal: d.wereld.scale.toArray(),
    opStrook, opRijbaan, gebouwen,
    buitenGrens: punten.filter(([, p]) => !binnen(p)).map(([n]) => n),
    hoogtes, texturen,
    monumentBox: d.MONUMENT_BOX, speldoos: m.speldoos,
    start: [d.BEGINSTAAT.speler.positie.x, d.BEGINSTAAT.speler.positie.z], layoutStart: L.spelerStart.positie,
    poorten: d.SPAWN_POORTEN.map(p => [p.naam, p.positie.x, p.positie.z]),
    layoutPoorten: L.routes.map(rt => [rt.poort, ...rt.punten[0]]),
  };
});

check('De wereld is 1:1: geen schaal op `wereld`', r.schaal.every(v => v === 1), r.schaal);
check('Geen enkel obstakel ligt op een routestrook (0,3 m marge)', r.opStrook.length === 0, r.opStrook.slice(0, 5));
check('Geen enkel obstakel ligt op een rijbaan of de trambaan', r.opRijbaan.length === 0, r.opRijbaan.slice(0, 5));
for (const g of r.gebouwen) {
  check(`${g.naam}: staat in de wereld, met een botsing per deel en de hoogte uit de layout`,
    g.groep && g.botsingen && Math.abs(g.hoogte - g.verwacht) < 1.5, g);
}
check('Poorten, bouwplekken, commandopost, kerkklok en start liggen binnen GRENS', r.buitenGrens.length === 0, r.buitenGrens);
check('MONUMENT_BOX is de speldoos uit de layout', r.monumentBox.maxX - r.monumentBox.minX === 2 * r.speldoos, r.monumentBox);
check('De speler start op de startplek uit de layout', r.start[0] === r.layoutStart[0] && r.start[1] === r.layoutStart[1], r);
check('De poorten zijn het eerste punt van elke route', JSON.stringify(r.poorten) === JSON.stringify(r.layoutPoorten), r.poorten);
check('vloerHoogte: bovenop het platform 3 treden, onderaan 1, stoep 0,12, plein 0',
  Math.abs(r.hoogtes.platformBoven - 0.48) < 1e-9 && Math.abs(r.hoogtes.platformOnder - 0.16) < 1e-9 && r.hoogtes.stoep === 0.12 && r.hoogtes.plein === 0, r.hoogtes);
check('Elke vloertextuur is deterministisch (opnieuw tekenen geeft dezelfde pixels)', r.texturen.every(t => t.gelijk), r.texturen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
