// Ticket 123 (v0.23, ronde 9): de verplichte, losstaande normal-map-A/B.
// Variant A = V2-materiaal ZONDER normal map, variant B = MET. Alles verder
// identiek: dezelfde scene, camera, zombies, verlichting, pixelRatio en
// dezelfde seeded loting — er mag precies één ding verschillen.
//
// Meet in het 18-ondoden-scenario dat het ticket voorschrijft:
//   - draw calls + driehoeken (renderer.info, T88/T116/T117-patroon met
//     autoReset uit en handmatige reset — anders zie je alleen de laatste
//     interne render van de 4-pass composer)
//   - texturen/geometrieën in geheugen
//   - het VISUELE verschil, als pixelpercentage op een close-up
//
// Frametijd/p95 staan bewust NIET in deze meting: die zijn in deze headless
// SwiftShader-omgeving niet betrouwbaar meetbaar (§10.3/§8.11, en ditzelfde
// voorbehoud staat al in ZOMBIE_V2_BASELINE.md bij T117). Daar is de
// F3-overlay in een echte browser voor — dit script meet uitsluitend wat
// hier wél hard is.
//
// Gebruik: node meet-normalmap-ab.mjs
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openVoorVisueleMeting } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'beeldverslag', 'T123-normalmap-ab');
mkdirSync(outDir, { recursive: true });

const { browser, page, errs } = await openVoorVisueleMeting();

await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const key = new THREE.PointLight(0xfff0dd, 26, 14);
  key.position.set(2.6, 2.9, -1.3);
  const fill = new THREE.PointLight(0xbcd0ff, 10, 14);
  fill.position.set(-3.0, 1.8, -2.3);
  d.scene.add(key); d.scene.add(fill);
  for (const id of ['hudUI', 'ammoUI', 'minimapUI', 'hulpUI', 'richtkruis', 'menuLink', 'geluidsKnop']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  for (const naam of ['WAPEN_DRUKSPUIT', 'WAPEN_RATELAAR']) {
    const w = d[naam];
    if (w && w.groep) w.groep.visible = false;
  }
});

async function meetVariant(metNormalMap) {
  return page.evaluate(async (metNormalMap) => {
    const d = window.AmsterdamUndeadDebug;
    // Écht opruimen (niet alleen uit de scene halen): anders tellen de
    // geometrieën/materialen van de vorige variant nog mee in
    // renderer.info.memory en lijkt de normal map 18 geometrieën te kosten
    // die in werkelijkheid van de vorige meetronde zijn.
    for (const o of [...d.ondoden]) {
      d.ondodenGroep.remove(o.groep);
      d.ruimGroepOp(o.groep);
    }
    d.ondoden.length = 0;

    const origRandom = Math.random;
    let seed = 0x9e3779b9;
    Math.random = function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    d.zetZombieV2NormalMap(metNormalMap);
    const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
    try {
      // 18 ondoden = effectiefMaxActief()'s praktische piek, in een raster
      // vóór de speler zodat ze allemaal binnen de frustum vallen (anders
      // meet je frustum-culling i.p.v. de normal map — de val die T117 al
      // een keer greep).
      for (let i = 0; i < 18; i++) {
        const o = d.spawnOndode(0, 'normaal', { ...traits });
        const rij = Math.floor(i / 6), kolom = i % 6;
        o.groep.position.set((kolom - 2.5) * 0.95, 0, -3.4 - rij * 1.5);
        o.groep.rotation.y = 0;
        o.groep.scale.set(1, 1, 1);
      }
    } finally {
      Math.random = origRandom;
    }

    d.speler.positie.set(0, 0, 0.6);
    d.speler.yaw = 0;
    d.speler.pitch = -0.05;
    d.visueleBevriesTijd = 0;
    d.lampDipFactor = 1;
    d.stroomFactor = 1;
    d.updateSpeler(0);

    const r = d.renderer;
    r.info.autoReset = false;
    // Twee frames: de eerste compileert de (nieuwe) shader, de tweede is de
    // eerlijke meting.
    await new Promise((res) => requestAnimationFrame(res));
    r.info.reset();
    return new Promise((res) => requestAnimationFrame(() => {
      const o0 = d.ondoden[0];
      res({
        calls: r.info.render.calls,
        driehoeken: r.info.render.triangles,
        geometrieen: r.info.memory.geometries,
        texturen: r.info.memory.textures,
        ondoden: d.ondoden.length,
        heeftNormalMap: !!o0.delen.huidMaterialen[0].normalMap,
      });
    }));
  }, metNormalMap);
}

const A = await meetVariant(false);
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(outDir, 'A-zonder-normalmap.png') });

const B = await meetVariant(true);
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(outDir, 'B-met-normalmap.png') });

// Close-up van één ondode, beide varianten — daar moet het verschil zichtbaar
// zijn als het ergens zichtbaar is.
async function closeup(metNormalMap, bestand) {
  await meetVariant(metNormalMap);
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.speler.positie.set(-2.375, 0, -2.3);
    d.speler.yaw = 0;
    d.speler.pitch = 0.02;
    d.updateSpeler(0);
    d.camera.position.y = 1.4;
    d.camera.updateMatrixWorld(true);
  });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(outDir, bestand) });
}
await closeup(false, 'A-closeup-zonder.png');
await closeup(true, 'B-closeup-met.png');

console.log(JSON.stringify({ A_zonderNormalMap: A, B_metNormalMap: B }, null, 2));
console.log('\nconsole errors:', errs.length ? errs : 'geen');
console.log(`Opnamen in ${outDir}`);
await browser.close();
