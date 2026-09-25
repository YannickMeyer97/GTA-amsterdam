// Ticket D40 (SONNET_EXECUTION_PLAN_monument.md, §11.5) — de straatwanden.
//
// Rijen grachtenpanden langs de vijf straten, de Beurs in de verte en een
// straatnaambord aan elke straatingang. Het uiterlijk beoordeelt de
// eigenaar; deze test bewaakt: variatie in geveltypen en kleuren, ramen in
// elk pand, winkelpuien, weinig meshes per wand, de hoogste maat, niets op
// loophoogte buiten de botsing, en dezelfde straat bij elke laadbeurt.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const meet = () => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const THREE = d.THREE;
  const ray = new THREE.Raycaster();
  const straal = d.speler.straal;
  const binnenObstakel = p => d.obstakels.some(o => p.x >= o.minX - straal && p.x <= o.maxX + straal && p.z >= o.minZ - straal && p.z <= o.maxZ + straal);
  const uit = { wanden: {} };
  // Een punt op gevel `richting` met vlak `vlak`, op plek u, d meter ervoor.
  const punt = (richting, vlak, u, y, d) => ({
    zuid: [u, y, vlak + d], noord: [u, y, vlak - d], oost: [vlak + d, y, u], west: [vlak - d, y, u],
  })[richting];
  const naarBinnen = { zuid: [0, 0, -1], noord: [0, 0, 1], oost: [-1, 0, 0], west: [1, 0, 0] };
  for (const naam of Object.keys(d.STRAATWANDEN)) {
    const gebouw = d.DAM_LAYOUT.gebouwen.find(g => g.naam === naam);
    const groep = d.gebouwGroepen.get(naam);
    groep.updateMatrixWorld(true);
    const meshes = groep.children.filter(m => m.isMesh);
    const raak = (o, v) => { ray.set(new THREE.Vector3(...o), new THREE.Vector3(...v).normalize()); return ray.intersectObjects(meshes, false)[0]; };
    const panden = groep.userData.panden;
    const w = { meshes: meshes.map(m => m.name), maxY: new THREE.Box3().setFromObject(groep).max.y, hoogsteDeel: gebouw.hoogsteDeel, panden: panden.length };
    w.lijst = panden.map(p => `${p.richting}:${p.u0.toFixed(2)}-${p.u1.toFixed(2)}:${p.type}:${p.top.toFixed(2)}:${p.winkel}`);
    w.typen = [...new Set(panden.map(p => p.type))];
    w.breedtes = [Math.min(...panden.map(p => p.u1 - p.u0)), Math.max(...panden.map(p => p.u1 - p.u0))];
    // Per gevel het vlak: uit STRAATWANDEN.
    const gevels = d.STRAATWANDEN[naam];
    const vlakVan = r => gevels.find(g => g[0] === r)[1];
    // Ramen: langs de raamrij van de eerste verdieping, per pand minstens één raam.
    w.zonderRaam = panden.filter(p => {
      const vlak = gevels.find(g => g[0] === p.richting && p.u0 >= Math.min(g[2], g[3]) - 1e-6 && p.u1 <= Math.max(g[2], g[3]) + 1e-6)[1];
      for (let i = 1; i < 40; i++) {
        const u = p.u0 + (p.u1 - p.u0) * i / 40;
        if (raak(punt(p.richting, vlak, u, 5.0, 4), naarBinnen[p.richting])?.object.name.startsWith('ramen')) return false;
      }
      return true;
    }).length;
    // Winkelpuien: op 1,7 m midden voor het pand glas, pui of deur.
    w.winkels = panden.filter(p => p.winkel).length;
    w.puiGeraakt = panden.filter(p => p.winkel).filter(p => {
      const vlak = gevels.find(g => g[0] === p.richting && p.u0 >= Math.min(g[2], g[3]) - 1e-6 && p.u1 <= Math.max(g[2], g[3]) + 1e-6)[1];
      const h = raak(punt(p.richting, vlak, (p.u0 + p.u1) / 2 - 0.4, 1.7, 4), naarBinnen[p.richting]);
      return ['etalages', 'puien', 'deuren'].includes(h?.object.name);
    }).length;
    // Kleuren: verschillende vertexkleuren op de bakstenen gevels.
    const kleur = meshes.find(m => m.name === 'gevel')?.geometry.getAttribute('color');
    const kleuren = new Set();
    if (kleur) for (let i = 0; i < kleur.count; i += 12) kleuren.add(`${kleur.getX(i).toFixed(2)},${kleur.getY(i).toFixed(2)},${kleur.getZ(i).toFixed(2)}`);
    w.kleuren = kleuren.size;
    // Loophoogte: langs elke gevel stralen naar binnen.
    let buiten = 0;
    for (const [richting, vlak, a, e] of gevels) for (const y of [0.1, 1.0, 2.0]) for (let i = 1; i < 120; i++) {
      const h = raak(punt(richting, vlak, a + (e - a) * i / 120, y, 5), naarBinnen[richting]);
      if (h && !binnenObstakel(h.point)) buiten++;
    }
    w.buiten = buiten;
    uit.wanden[naam] = w;
  }
  // De Beurs: toren met wijzerplaat en spits tot hoogsteDeel.
  const beurs = d.gebouwGroepen.get('Beurs van Berlage');
  uit.beurs = { meshes: beurs.children.filter(m => m.isMesh).map(m => m.name), maxY: new THREE.Box3().setFromObject(beurs).max.y, hoogsteDeel: d.DAM_LAYOUT.gebouwen.find(g => g.naam === 'Beurs van Berlage').hoogsteDeel };
  // Straatnaamborden: aan elke straatingang, tweezijdig.
  uit.borden = [...d.straatNaamborden.entries()].map(([naam, bord]) => {
    const vlakken = [];
    bord.traverse(m => { if (m.isMesh && m.geometry.type === 'PlaneGeometry') vlakken.push(m.getWorldDirection(new THREE.Vector3())); });
    return { naam, vlakken: vlakken.length, tegengesteld: vlakken.length === 2 && vlakken[0].dot(vlakken[1]) < -0.99, inWereld: bord.parent === d.wereld };
  });
  return uit;
});

const r = await meet();
for (const [naam, w] of Object.entries(r.wanden)) {
  check(`${naam}: hooguit 10 meshes, hoeveel panden er ook staan (${w.panden})`, w.meshes.length <= 10, w.meshes);
  check(`${naam}: de hoogste top raakt hoogsteDeel (${w.hoogsteDeel} m)`, Math.abs(w.maxY - w.hoogsteDeel) < 0.05, w.maxY);
  check(`${naam}: panden van 3,8–8 m breed`, w.breedtes[0] >= 3.8 - 1e-6 && w.breedtes[1] <= 8, w.breedtes);
  check(`${naam}: elk pand heeft ramen op de eerste verdieping`, w.zonderRaam === 0, w.zonderRaam);
  check(`${naam}: elke winkelpui is geraakt op ooghoogte`, w.puiGeraakt === w.winkels, w);
  check(`${naam}: op loophoogte steekt niets buiten botsing + spelerstraal`, w.buiten === 0, w.buiten);
}
const alleTypen = new Set(Object.values(r.wanden).flatMap(w => w.typen));
check('Alle vier de geveltypen komen voor: trap-, hals-, lijst- en tuitgevel', ['trap', 'hals', 'lijst', 'tuit'].every(t => alleTypen.has(t)), [...alleTypen]);
check('De lange wanden hebben minstens drie verschillende geveltypen', ['Damrak-westwand', 'Kalverstraat-westwand', 'Damstraat-zuidwand'].every(n => r.wanden[n].typen.length >= 3), Object.fromEntries(Object.entries(r.wanden).map(([n, w]) => [n, w.typen])));
check('Panden verschillen in kleur (≥ 3 baksteentinten op de lange wanden)', ['Damrak-westwand', 'Kalverstraat-westwand'].every(n => r.wanden[n].kleuren >= 3), Object.fromEntries(Object.entries(r.wanden).map(([n, w]) => [n, w.kleuren])));
check('De meeste panden in de winkelstraten hebben een winkelpui', r.wanden['Kalverstraat-westwand'].winkels >= r.wanden['Kalverstraat-westwand'].panden / 2, r.wanden['Kalverstraat-westwand']);
check('De Beurs van Berlage: toren met wijzerplaat en spits tot hoogsteDeel', r.beurs.meshes.includes('wijzerplaat') && Math.abs(r.beurs.maxY - r.beurs.hoogsteDeel) < 0.05, r.beurs);
check('Een straatnaambord aan elke straatingang: vijf routes plus Warmoesstraat en Nes', r.borden.length === 7 && ['Warmoesstraat', 'Nes'].every(n => r.borden.some(b => b.naam === n)), r.borden.map(b => b.naam));
check('Elk straatnaambord is aan beide kanten leesbaar en staat in de wereld', r.borden.every(b => b.tegengesteld && b.inWereld), r.borden);

// Dezelfde straat bij elke laadbeurt.
await page.reload();
await page.waitForFunction(() => window.DamChaosDebug?.gebouwGroepen);
const r2 = await meet();
check('Elke laadbeurt dezelfde panden (vaste seed per gebouw)', Object.keys(r.wanden).every(n => JSON.stringify(r.wanden[n].lijst) === JSON.stringify(r2.wanden[n].lijst)), '');

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
