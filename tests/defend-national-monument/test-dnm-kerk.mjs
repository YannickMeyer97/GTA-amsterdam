// Ticket D38 (SONNET_EXECUTION_PLAN_monument.md, §11.5) — de Nieuwe Kerk.
//
// Het uiterlijk beoordeelt de eigenaar op schermafbeeldingen; deze test
// bewaakt de meetbare kenmerken uit DAM_LAYOUT, met stralen op de echte
// (samengevoegde) geometrie: het grote transeptraam met vier lichten, vier
// koorramen, twee traptorentjes, steile daken, een dakruiter tot precies de
// hoogste maat en géén hoge toren. Verder: weinig meshes, de texturen uit
// D36 en niets dat op loophoogte door de botsing heen steekt.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const THREE = d.THREE;
  const K = d.KERK;
  const groep = d.gebouwGroepen.get('Nieuwe Kerk');
  groep.updateMatrixWorld(true);
  const meshes = [];
  groep.traverse(m => { if (m.isMesh) meshes.push(m); });
  const ray = new THREE.Raycaster();
  const raak = (o, v) => {
    ray.set(new THREE.Vector3(...o), new THREE.Vector3(...v).normalize());
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? { naam: hit.object.name, punt: hit.point } : null;
  };
  const tel = (naam, stralen) => {
    let stukken = 0, vorige = false;
    for (const [o, v] of stralen) { const is = raak(o, v)?.naam === naam; if (is && !vorige) stukken++; vorige = is; }
    return stukken;
  };
  const uit = { meshes: meshes.map(m => m.name), inWereld: groep.parent === d.wereld };
  const t = K.transept, A = K.apsis, T = K.traptoren;

  // Het grote raam: een horizontale lijn stralen vanuit het zuiden op 8 m.
  uit.transeptLichten = tel('glas', Array.from({ length: 600 }, (_, i) => [[t.x0 + 0.2 + (t.x1 - t.x0 - 0.4) * i / 599, 8, t.z1 + 6], [0, 0, -1]]));
  const midden = raak([(t.x0 + t.x1) / 2, 16.5, t.z1 + 6], [0, 0, -1]);
  uit.raamTot165 = midden?.naam;   // de kop van het raam reikt tot in de topgevel
  // Het portaal onder het raam.
  uit.portaal = raak([(t.x0 + t.x1) / 2, 1, t.z1 + 6], [0, 0, -1])?.naam;
  // De koorramen: stralen rondom de apsis, van buiten naar het midden.
  uit.koorRamen = tel('glas', Array.from({ length: 720 }, (_, i) => {
    const hoek = 0.02 + (Math.PI - 0.04) * i / 719;
    return [[A.x + 20 * Math.sin(hoek), 6, A.z + 20 * Math.cos(hoek)], [-Math.sin(hoek), 0, -Math.cos(hoek)]];
  }));
  // Traptorentjes: van bovenaf raak je hun spits boven de 21 m.
  uit.torentjes = [t.x0, t.x1].map(x => { const h = raak([x, 60, t.z1], [0, -1, 0]); return h ? { naam: h.naam, y: +h.punt.y.toFixed(2) } : null; });
  // Dakruiter op de kruising.
  const kr = raak([K.kruising.x, 60, K.kruising.z], [0, -1, 0]);
  uit.kruising = kr ? { naam: kr.naam, y: +kr.punt.y.toFixed(2) } : null;
  // Steile daken: helling van het schipdak tussen nok en halverwege.
  const nok = raak([-80, 60, (K.schip.z0 + K.schip.z1) / 2], [0, -1, 0]);
  const flank = raak([-80, 60, (K.schip.z0 + K.schip.z1) / 2 + 5], [0, -1, 0]);
  uit.dak = { nok: nok?.naam, nokY: nok?.punt.y, flankY: flank?.punt.y, helling: Math.atan2(nok.punt.y - flank.punt.y, 5) * 180 / Math.PI };
  // Geen hoge toren: op een raster over de hele kerk komt alleen rond de
  // kruising iets boven de 25 m.
  const hoog = [];
  for (let x = -99; x <= -47; x += 1) for (let z = -59; z <= -25; z += 1) {
    const h = raak([x, 60, z], [0, -1, 0]);
    if (h && h.punt.y > 25) hoog.push([x, z, +h.punt.y.toFixed(1)]);
  }
  uit.hoog = { aantal: hoog.length, verVanKruising: hoog.filter(([x, z]) => Math.hypot(x - K.kruising.x, z - K.kruising.z) > 2).length };
  const box = new THREE.Box3().setFromObject(groep);
  uit.maxY = box.max.y;
  uit.hoogsteDeel = d.DAM_LAYOUT.gebouwen.find(g => g.naam === 'Nieuwe Kerk').hoogsteDeel;
  // Op loophoogte: elk raakpunt vanaf de pleinkant ligt binnen een obstakel
  // + spelerstraal (anders loopt de camera door de muur).
  const straal = d.speler.straal, buiten = [];
  const binnenObstakel = p => d.obstakels.some(o => p.x >= o.minX - straal && p.x <= o.maxX + straal && p.z >= o.minZ - straal && p.z <= o.maxZ + straal);
  for (const y of [0.1, 0.7, 1.4, 2.1]) {
    for (let i = 0; i < 300; i++) {
      const x = -65.9 + (t.x1 - -65.9 + (A.x + A.r - t.x1)) * i / 299;   // zuidkanten van dwarsschip, schip en koor
      const h = raak([x, y, -15], [0, 0, -1]);
      if (h && !binnenObstakel(h.punt)) buiten.push(['zuid', +x.toFixed(2), y, +h.punt.z.toFixed(2)]);
      const hoek = 0.02 + (Math.PI - 0.04) * i / 299;
      const a = raak([A.x + 20 * Math.sin(hoek), y, A.z + 20 * Math.cos(hoek)], [-Math.sin(hoek), 0, -Math.cos(hoek)]);
      if (a && !binnenObstakel(a.punt)) buiten.push(['koor', +hoek.toFixed(2), y, +a.punt.x.toFixed(2), +a.punt.z.toFixed(2)]);
    }
  }
  uit.buitenBotsing = buiten.slice(0, 8);
  uit.aantalBuiten = buiten.length;
  // Botsing: per deel de voetafdruk + 0,3 m, plus de twee torentjes.
  uit.botsingDelen = d.DAM_LAYOUT.gebouwen.find(g => g.naam === 'Nieuwe Kerk').delen.every(([x0, z0, x1, z1]) =>
    d.obstakels.some(o => Math.abs(o.minX - (x0 - 0.3)) < 1e-6 && Math.abs(o.maxZ - (z1 + 0.3)) < 1e-6 && Math.abs(o.maxX - (x1 + 0.3)) < 1e-6));
  uit.botsingTorentjes = [t.x0, t.x1].every(x => d.obstakels.some(o => Math.abs(o.minX - (x - T.straal)) < 1e-6 && Math.abs(o.maxZ - (t.z1 + T.straal)) < 1e-6));
  const mat = n => meshes.find(m => m.name === n)?.material;
  uit.texturen = { gevel: mat('gevel')?.map === d.vloerTextuur('baksteen'), lijstwerk: mat('lijstwerk')?.map === d.vloerTextuur('natuursteen'), dak: mat('dak')?.map === d.vloerTextuur('leisteen'), glas: mat('glas')?.map === d.vloerTextuur('glasInLood') };
  return uit;
});

check('De Nieuwe Kerk staat in de wereld, samengevoegd tot hooguit 12 meshes', r.inWereld && r.meshes.length <= 12, r.meshes);
check('Alle onderdelen zijn er', ['gevel', 'lijstwerk', 'glas', 'dak', 'dakruiter', 'spitsen', 'goud', 'deur', 'openingen'].every(n => r.meshes.includes(n)), r.meshes);
check('Het grote transeptraam in de zuidgevel heeft vier lichten', r.transeptLichten === 4, r.transeptLichten);
check('De kop van het transeptraam reikt tot in de topgevel (16,5 m)', ['glas', 'lijstwerk'].includes(r.raamTot165), r.raamTot165);
check('Onder het raam een portaal', r.portaal === 'deur' || r.portaal === 'lijstwerk', r.portaal);
check('Vier spitsboogramen in de koorsluiting, elk met twee lichten (8 stukken glas tussen stijlen en steunberen)', r.koorRamen === 8, r.koorRamen);
check('Twee traptorentjes met een spits (boven 21 m)', r.torentjes.every(h => h && ['spitsen', 'goud'].includes(h.naam) && h.y > 21), r.torentjes);
check('Op de kruising het dakruitertje', r.kruising && ['goud', 'dakruiter'].includes(r.kruising.naam) && r.kruising.y > 30, r.kruising);
check(`De dakruiter raakt precies de hoogste maat uit DAM_LAYOUT (${r.hoogsteDeel} m)`, Math.abs(r.maxY - r.hoogsteDeel) < 0.05, r.maxY);
check('Steile leien daken: nok op 22 m, helling ≥ 35°', r.dak.nok === 'dak' && Math.abs(r.dak.nokY - 22) < 0.3 && r.dak.helling >= 35, r.dak);
check('Geen hoge toren: alleen de dakruiter komt boven de 25 m', r.hoog.verVanKruising === 0 && r.hoog.aantal > 0, r.hoog);
check('Botsing: elk deel met 0,3 m marge, plus de traptorentjes', r.botsingDelen && r.botsingTorentjes, r);
check('Op loophoogte steekt niets buiten botsing + spelerstraal', r.aantalBuiten === 0, r.buitenBotsing);
check('Baksteen, natuursteen, lei en glas-in-lood uit de textuurbibliotheek', Object.values(r.texturen).every(Boolean), r.texturen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
