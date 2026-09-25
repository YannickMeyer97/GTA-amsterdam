// Ticket D37 (SONNET_EXECUTION_PLAN_monument.md, §11.5) — het Paleis op de Dam.
//
// De eigenaar beoordeelt het uiterlijk op schermafbeeldingen; deze test
// bewaakt wat meetbaar is. Onderdelen worden geteld met stralen op de echte
// geometrie (na het samenvoegen zijn er geen losse meshes meer om te tellen):
// zeven poortjes, dertien ramen per rij aan de Dam, drie beelden op het
// fronton. Daarnaast: weinig draw calls, niets steekt voorbij de botsing, en
// de silhouetmaten uit DAM_LAYOUT.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const THREE = d.THREE;
  const groep = d.gebouwGroepen.get('Paleis op de Dam');
  const P = d.PALEIS;
  groep.updateMatrixWorld(true);
  const meshes = [];
  groep.traverse(m => { if (m.isMesh) meshes.push(m); });
  const ray = new THREE.Raycaster();
  // Wat raakt een straal van oorsprong o in richting v als eerste (naam)?
  function raak(o, v) {
    ray.set(new THREE.Vector3(...o), new THREE.Vector3(...v).normalize());
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? { naam: hit.object.name, punt: hit.point } : null;
  }
  // Aantal aaneengesloten stukken met naam `naam` langs een lijn van stralen.
  function tel(naam, punten, v) {
    let stukken = 0, vorige = false;
    for (const o of punten) {
      const is = raak(o, v)?.naam === naam;
      if (is && !vorige) stukken++;
      vorige = is;
    }
    return stukken;
  }
  const langsGevel = (y, z0 = P.z0 + 0.1, z1 = P.z1 - 0.1) => Array.from({ length: 900 }, (_, i) => [P.x1 + 5, y, z0 + (z1 - z0) * i / 899]);

  const uit = {};
  uit.meshes = meshes.map(m => m.name);
  uit.inWereld = groep.parent === d.wereld;
  uit.poortjes = tel('poortjes', langsGevel(1.4), [-1, 0, 0]);
  uit.ramenRij1 = tel('ramen', langsGevel(6.6), [-1, 0, 0]);
  uit.ramenTussen = tel('ramenLaag', langsGevel(9.9), [-1, 0, 0]);
  uit.ramenRij2 = tel('ramen', langsGevel(13.6), [-1, 0, 0]);
  uit.ramenOnderbouw = tel('ramenLaag', langsGevel(2.4), [-1, 0, 0]);
  // Beelden: van bovenaf langs de voet van het fronton.
  uit.beelden = tel('beelden', Array.from({ length: 900 }, (_, i) => [P.x1 + 0.1, 45, -10 + 20 * i / 899]), [0, -1, 0]);
  // Fronton: recht boven de middenrisaliet reikt de gevel tot boven de 24 m;
  // naast de risaliet eindigt hij op de dekplaat.
  const top = z => raak([P.x1 + 0.3, 60, z], [0, -1, 0]);
  uit.frontonTop = top(0.9)?.punt.y ?? 0;
  uit.naastRisaliet = top(12)?.punt.y ?? 0;
  // Koepel en windvaan.
  const koepel = raak([P.koepel.x, 60, P.koepel.z], [0, -1, 0]);
  uit.koepel = koepel ? { naam: koepel.naam, y: koepel.punt.y } : null;
  // Omvang en botsing.
  const box = new THREE.Box3().setFromObject(groep);
  uit.box = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, maxY: box.max.y };
  uit.botsing = d.obstakels.find(o => Math.abs(o.minX - (P.x0 - 0.3)) < 1e-6 && Math.abs(o.maxX - (P.x1 + 0.3)) < 1e-6);
  uit.spelerStraal = d.speler.straal;
  // Wat steekt er op loophoogte (0,1–2,2 m) het verst uit? Kroonlijsten
  // hoog in de gevel mogen verder uitsteken: daar loopt niemand.
  const hoogtes = [0.1, 0.6, 1.2, 1.8, 2.2];
  let oost = -Infinity, noord = Infinity, zuid = -Infinity;
  for (const y of hoogtes) for (let i = 0; i < 400; i++) {
    const z = P.z0 + (P.z1 - P.z0) * i / 399, x = P.x0 + (P.x1 - P.x0) * i / 399;
    const o = raak([P.x1 + 5, y, z], [-1, 0, 0]); if (o) oost = Math.max(oost, o.punt.x);
    const n = raak([x, y, P.z0 - 5], [0, 0, 1]); if (n) noord = Math.min(noord, n.punt.z);
    const zd = raak([x, y, P.z1 + 5], [0, 0, -1]); if (zd) zuid = Math.max(zuid, zd.punt.z);
  }
  uit.loophoogte = { oost, noord, zuid };
  // Materialen: zandsteen en natuursteen uit de D36-bibliotheek.
  const mat = n => meshes.find(m => m.name === n)?.material;
  uit.texturen = { gevel: mat('gevel')?.map === d.vloerTextuur('zandsteen'), lijstwerk: mat('lijstwerk')?.map === d.vloerTextuur('natuursteen'), dak: mat('dak')?.map === d.vloerTextuur('leisteen') };
  uit.hoogsteDeel = d.DAM_LAYOUT.gebouwen.find(g => g.naam === 'Paleis op de Dam').hoogsteDeel;
  return uit;
});

check('Het Paleis staat in de wereld, samengevoegd tot hooguit 12 meshes (één per materiaal)', r.inWereld && r.meshes.length <= 12, r.meshes);
check('Alle onderdelen zijn er', ['gevel', 'lijstwerk', 'ramen', 'ramenLaag', 'poortjes', 'beelden', 'dak', 'koepel', 'windvaan', 'openingen'].every(n => r.meshes.includes(n)), r.meshes);
check('Zeven rondboogpoortjes op de begane grond, geen grote hoofdingang', r.poortjes === 7, r.poortjes);
check('Dertien traveeën: 13 hoge ramen in de eerste orde, 13 in de tweede, 13 op de tussenverdieping', r.ramenRij1 === 13 && r.ramenRij2 === 13 && r.ramenTussen === 13, r);
check('Onderbouw: kleine vensters naast de middenrisaliet (2 × 4)', r.ramenOnderbouw === 8, r.ramenOnderbouw);
check('Drie beelden op het fronton', r.beelden === 3, r.beelden);
check('Het fronton steekt boven de middenrisaliet uit (> 23 m), ernaast eindigt de gevel op ~20 m', r.frontonTop > 23 && r.naastRisaliet < 21, r);
check('Boven het midden van het dak staat de koepel met de windvaan', r.koepel && ['windvaan', 'koepel'].includes(r.koepel.naam) && r.koepel.y > 35, r.koepel);
check(`De windvaan raakt precies de hoogste maat uit DAM_LAYOUT (${r.hoogsteDeel} m)`, Math.abs(r.box.maxY - r.hoogsteDeel) < 0.05, r.box);
check('De botsing is de voetafdruk + 0,3 m, zoals bij de grey-box', !!r.botsing, r.botsing);
check('Op loophoogte steekt niets verder uit dan botsing + spelerstraal (de speler loopt er niet in)', r.loophoogte.oost <= r.botsing.maxX + r.spelerStraal && r.loophoogte.noord >= r.botsing.minZ - r.spelerStraal && r.loophoogte.zuid <= r.botsing.maxZ + r.spelerStraal, { loophoogte: r.loophoogte, botsing: r.botsing, straal: r.spelerStraal });
check('Hoger in de gevel steekt het lijstwerk hooguit 1 m uit', r.box.maxX <= -65 + 1e-3 && r.box.minZ >= -23 && r.box.maxZ <= 23, r.box);
check('Gevel in zandsteen, lijstwerk in natuursteen, dak in lei (texturen uit D36)', r.texturen.gevel && r.texturen.lijstwerk && r.texturen.dak, r.texturen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
