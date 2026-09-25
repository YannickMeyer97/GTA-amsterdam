// Ticket D42 — meetscript prestaties (geen test; wordt niet door run-all
// gedraaid). Meet vanaf vijf vaste standpunten: draw calls (hoofdpass en
// met schaduwpass), driehoeken, en voor de hele scene het aantal meshes,
// geometrieën en texturen, plus de laadtijd. Gebruik: node meet-dnm-prestaties.mjs
import { openDefend } from '../helpers-defend.mjs';

export const STANDPUNTEN = [
  ['monument', [-14, 0, 2], [0, 8, 0]],
  ['plein-west', [-30, 0, 0], [5, 6, 0]],
  ['damrak', [-19, 0, -24], [-19, 5, -60]],
  ['paleis', [-40, 0, 5], [-66, 12, -5]],
  ['damstraat', [10, 0, 12], [40, 5, 14]],
];

export async function meet(page) {
  return page.evaluate((STANDPUNTEN) => {
    const d = window.DamChaosDebug;
    const r = d.renderer;
    const uit = { standpunten: [] };
    const cam = d.camera.clone();
    for (const [naam, pos, doel] of STANDPUNTEN) {
      cam.position.set(pos[0], pos[1] + 1.7, pos[2]);
      cam.lookAt(doel[0], doel[1], doel[2]);
      cam.updateMatrixWorld();
      r.shadowMap.needsUpdate = true;
      r.render(d.scene, cam);
      const met = { calls: r.info.render.calls, triangles: r.info.render.triangles };
      const schaduw = r.shadowMap.enabled;
      r.shadowMap.enabled = false;
      r.render(d.scene, cam);
      const zonder = { calls: r.info.render.calls, triangles: r.info.render.triangles };
      r.shadowMap.enabled = schaduw;
      uit.standpunten.push({ naam, calls: met.calls, callsHoofdpass: zonder.calls, triangles: met.triangles, trianglesHoofdpass: zonder.triangles });
    }
    // Druk: 30 robots op het plein, in beeld vanaf plein-west.
    for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
    for (let i = 0; i < 30; i++) {
      d.spawnRobot(null, ['normal', 'sprinter', 'tank', 'bomber', 'shieldbot'][i % 5]);
      d.robots[d.robots.length - 1].groep.position.set(-12 + (i % 6) * 2.5, 0, -6 + Math.floor(i / 6) * 3);
    }
    cam.position.set(-30, 1.7, 0); cam.lookAt(5, 6, 0); cam.updateMatrixWorld();
    r.render(d.scene, cam);
    uit.druk = { robots: 30, calls: r.info.render.calls, triangles: r.info.render.triangles };
    for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
    let meshes = 0, schaduwwerpers = 0;
    d.scene.traverse(m => { if (m.isMesh) { meshes++; if (m.castShadow && m.visible) schaduwwerpers++; } });
    uit.scene = { meshes, schaduwwerpers, geometries: r.info.memory.geometries, textures: r.info.memory.textures };
    return uit;
  }, STANDPUNTEN);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const { browser, page } = await openDefend();
  const laadtijd = Date.now() - t0;
  const r = await meet(page);
  console.log('standpunt      calls (hoofdpass)   driehoeken (hoofdpass)');
  for (const s of r.standpunten) console.log(`${s.naam.padEnd(14)} ${String(s.calls).padStart(5)} (${String(s.callsHoofdpass).padStart(4)})     ${String(s.triangles).padStart(7)} (${s.trianglesHoofdpass})`);
  console.log('druk (30 robots, plein-west):', JSON.stringify(r.druk));
  console.log('scene:', JSON.stringify(r.scene), `laadtijd ${laadtijd} ms`);
  await browser.close();
}
