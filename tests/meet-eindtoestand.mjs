// T116 (v0.22, §10.14.5-beslissing 94) — EINDMETING van ronde 8, laag 1.
//
// Meet exact de tabel uit §10.17 (de nulmeting bij aanvang van deze ronde) op
// de EINDtoestand, zodat de twee kolommen naast elkaar te leggen zijn. Dit is
// de machinale laag uit beslissing 91: draw calls, driehoeken, programma's,
// texturen en lichten zijn resolutie- en hardware-onafhankelijk en dus wél
// betrouwbaar in SwiftShader. Frametijd staat er bewust NIET in — die is in
// deze omgeving niet betrouwbaar meetbaar (§8.11/§10.3) en hoort bij laag 2,
// de handmatige DevTools-meting die de eigenaar op eigen hardware doet.
//
// GEEN testscript: geen check()/report(), geen exitcode-conventie, wordt
// bewust NIET opgepikt door run-all.mjs (de bestandsnaam begint niet met
// test-/check-). Handmatig draaien:
//   node meet-eindtoestand.mjs
import { openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, frames } from './helpers.mjs';
import { readFileSync } from 'fs';

const { browser, page, errs } = await openVoorVisueleMeting();

const regels = readFileSync(new URL('../amsterdam-undead.html', import.meta.url), 'utf8').split('\n').length;

// Scene-graph-telling. Twee keer gemeten: leeg (zoals de wereld laadt) en met
// 14 ondoden actief — precies de twee kolommen die §10.17 gebruikt.
async function scenegraaf() {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    let objecten = 0, meshes = 0, castShadow = 0, receiveShadow = 0, transparant = 0, emissief = 0, lichten = 0, schaduwLichten = 0, driehoeken = 0;
    const geos = new Set(), mats = new Set();
    d.scene.traverse((o) => {
      objecten++;
      if (o.isLight) { lichten++; if (o.castShadow) schaduwLichten++; }
      if (!o.isMesh) return;
      meshes++;
      if (o.castShadow) castShadow++;
      if (o.receiveShadow) receiveShadow++;
      geos.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m) continue;
        mats.add(m);
        if (m.transparent) transparant++;
        if (m.emissive && m.emissive.getHex() !== 0) emissief++;
      }
      const idx = o.geometry.index;
      const pos = o.geometry.getAttribute('position');
      if (idx) driehoeken += idx.count / 3;
      else if (pos) driehoeken += pos.count / 3;
    });
    return {
      objecten, meshes, geometrieen: geos.size, materialen: mats.size,
      castShadow, receiveShadow, transparant, emissief, lichten, schaduwLichten,
      driehoeken: Math.round(driehoeken),
    };
  });
}

const leeg = await scenegraaf();
const punten = await berekenVisueleStandpunten(page);
const perStandpuntLeeg = await meetStandpunten();

// 14 ondoden, dezelfde manier als de nulmeting: rechtstreeks via de
// debug-hook, verdeeld over de vensters zodat ze niet op één plek stapelen.
// Let op: `kiesOndodeTraits()` loot per ondode een profiel, dus het aantal
// meshes/materialen schommelt een paar stuks tussen runs — de draw calls per
// standpunt niet, want die hangen af van wat er in de camerakegel valt.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (let i = 0; i < 14; i++) d.spawnOndode(i % d.VENSTERS.length, 'normaal');
});
await frames(page, 5);
const vol = await scenegraaf();
const perStandpuntVol = await meetStandpunten();

// Renderer-metrics per frame, op elk vastgelegd standpunt (T88).
async function meetStandpunten() {
const perStandpunt = [];
for (const sp of punten) {
  await zetVisueelStandpunt(page, sp);
  await frames(page, 3);
  // Zelfde meetwijze als test-visuele-basislijn.mjs: autoReset UIT, expliciet
  // resetten en dan één hele frame laten lopen. Zonder dat leest `info.render`
  // alleen de LAATSTE render-aanroep van de frame — dat is de fullscreen
  // composer-pass, en die geeft 1 call / 1 driehoek in plaats van de scene.
  const m = await page.evaluate(() => {
    const r = window.AmsterdamUndeadDebug.renderer;
    r.info.autoReset = false;
    r.info.reset();
    return new Promise((res) => requestAnimationFrame(() =>
      res({ calls: r.info.render.calls, triangles: r.info.render.triangles })));
  });
  perStandpunt.push({ naam: sp.naam, ...m });
}
return perStandpunt;
}

const overig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const r = d.renderer;
  return {
    programmas: r.info.programs.length,
    gpuGeometrieen: r.info.memory.geometries,
    texturen: r.info.memory.textures,
    obstakels: d.obstakels.length,
    interactiePunten: d.interactiePunten.length,
    passes: d.composer.passes.length,
    canvasTekenaars: Object.keys(d.CANVAS_TEXTUUR_TEKENAARS ?? {}).length,
    materiaalFamilies: Object.keys(d.MATERIAAL_FAMILIES ?? {}).length,
  };
});

console.log(JSON.stringify({
  regels, leeg, vol, perStandpuntLeeg, perStandpuntVol, overig,
  consoleErrors: errs,
}, null, 2));

await browser.close();
