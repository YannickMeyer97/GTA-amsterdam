// Ticket 117 (v0.23, ronde 9 — Zombie V2 fundament): exacte V1-meting vóór
// er iets aan Zombie V2 gebouwd wordt (§0-§4 van de bronopdracht: "meten,
// niet aannemen"). Meet de vier scenario's uit het ticket (1 ondode
// dichtbij; 10; 18; 18 + snel schieten) en print JSON dat rechtstreeks in
// ZOMBIE_V2_BASELINE.md's "Zombie V1"-sectie past.
//
// GEEN testscript: geen check()/report(), geen exitcode-conventie, wordt
// bewust NIET automatisch opgepikt door run-all.mjs. Handmatig draaien:
//   node meet-zombie-v1-baseline.mjs
//
// Belangrijke beperking, expliciet i.p.v. verzwegen (zelfde discipline als
// T88/T116): FPS/frametijd/p95 zijn in deze headless SwiftShader-omgeving
// NIET betrouwbaar meetbaar (§10.3/§8.11) — dit script meet daarom alleen
// wat hier wél betrouwbaar is (scenegraaf-structuur, renderer.info), en
// laat de frametijd-velden expliciet leeg met die reden erbij. De F3-
// overlay (dit ticket) is precies het instrument waarmee de eigenaar die
// velden WEL kan meten, in de echte browser.
import { openVoorVisueleMeting, zetVisueelStandpunt, frames } from './helpers.mjs';

const { browser, page, errs } = await openVoorVisueleMeting();

// Structuurtelling van ÉÉN ondode (meshes/materialen/geometrieën/
// transformnodes/raycast-targets) — zelfde traversal-aanpak als
// meet-eindtoestand.mjs (T116), nu toegepast op een enkele ondode-groep
// i.p.v. de hele scene.
async function meetOndodeStructuur() {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const ondode = d.ondoden[0];
    if (!ondode) return null;
    let meshes = 0, transformNodes = 0, raycastTargets = 0;
    const materialen = new Set(), geometrieen = new Set();
    ondode.groep.traverse((o) => {
      transformNodes++;
      if (!o.isMesh) return;
      meshes++;
      geometrieen.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m) materialen.add(m);
      }
      // Elke ondode-mesh is standaard raycastbaar (schiet() raycast tegen
      // ondodenGroep); er is in V1 geen aparte proxy-laag.
      raycastTargets++;
    });
    return { meshes, materialen: materialen.size, geometrieen: geometrieen.size, transformNodes, raycastTargets };
  });
}

// Renderer-metrics voor het VOLLEDIGE frame — zelfde T88-patroon
// (autoReset uit, expliciet resetten, één hele rAF-frame laten lopen)
// als meet-eindtoestand.mjs, nu ook via de nieuwe F3-overlay-machinery
// (berekenPerfLichten/telZichtbarePerfOndoden) voor consistentie met wat
// de live overlay straks toont.
async function meetFrame() {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const r = d.renderer;
    r.info.autoReset = false;
    r.info.reset();
    return new Promise((res) => requestAnimationFrame(() => {
      const lichten = d.berekenPerfLichten();
      res({
        calls: r.info.render.calls,
        triangles: r.info.render.triangles,
        points: r.info.render.points,
        lines: r.info.render.lines,
        geometrieenTotal: r.info.memory.geometries,
        texturenTotal: r.info.memory.textures,
        ondodenActief: d.ondoden.length,
        ondodenZichtbaar: d.telZichtbarePerfOndoden(),
        lichtenTotaal: lichten.totaal,
        lichtenSchaduw: lichten.schaduw,
      });
    }));
  });
}

// Spawnt op de echte VENSTERS-posities (realistisch), maar verplaatst ze
// daarna in een zichtbare cluster vóór de speler — anders staan de meeste
// buiten de camera-frustum (VENSTERS liggen verspreid door de hele kaart) en
// meet dit scenario alleen de STATISCHE scene, niet de kosten van N
// zombies. Rijen van 6 op 0,7m onderlinge afstand, telkens 2m verder weg,
// ruim binnen het 70°-FOV op deze afstanden (halve breedte bij 6-10m ≈
// 4,2-7m, ruim boven de 6×0,7=4,2m rijbreedte).
async function spawnN(n) {
  await page.evaluate((n) => {
    const d = window.AmsterdamUndeadDebug;
    const p = d.speler.positie;
    for (let i = 0; i < n; i++) {
      const ondode = d.spawnOndode(i % d.VENSTERS.length, 'normaal');
      const rij = Math.floor(i / 6), kolom = i % 6;
      ondode.groep.position.set(p.x + (kolom - 2.5) * 0.7, 0, p.z - (6 + rij * 2));
    }
  }, n);
  await frames(page, 5);
}

async function ruimOndodenOp() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.ondodenGroep.remove(o.groep);
    d.ondoden.length = 0;
  });
}

const resultaat = {};
const FRAMETIJD_NIET_METEN = 'niet betrouwbaar meetbaar in headless SwiftShader (§10.3/§8.11) — meet met de F3-overlay in de echte browser';

// --- Scenario 1: 1 ondode dichtbij ------------------------------------------
{
  // yaw=0 kijkt naar -z (project-conventie, zie berekenVisueleStandpunten()
  // in helpers.mjs) — expliciet gezet, want de speler start op yaw=Math.PI
  // ("zicht op de ramen"), en anders staat "dichtbij" per ongeluk achter de
  // camera.
  const punten = await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.speler.yaw = 0;
    d.updateSpeler(0);
    return { x: d.speler.positie.x, z: d.speler.positie.z };
  });
  await page.evaluate(() => window.AmsterdamUndeadDebug.spawnOndode(0, 'normaal'));
  await page.evaluate((p) => {
    const d = window.AmsterdamUndeadDebug;
    // 5m, niet 2m: telZichtbarePerfOndoden() (F3-overlay) toetst de
    // WORTELpositie (voeten, y=0) tegen de camera-frustum — bij camera-
    // hoogte 1,7m en fov 70° valt een punt op de grond pas vanaf ~2,4m
    // binnen het verticale zicht (bij pitch 0, recht vooruit kijken). Op
    // 2m stonden de voeten van de zombie dus al ONDER de onderrand van het
    // beeld, ook al was de rest van 'm gewoon zichtbaar — een bekende,
    // gedocumenteerde grovigheid van de wortelpositie-schatting (zie de
    // toelichting bij telZichtbarePerfOndoden() in amsterdam-undead.html),
    // geen bug. 5m geeft hier een representatief "vlakbij"-scenario zonder
    // tegen die grens aan te lopen.
    d.ondoden[0].groep.position.set(p.x, 0, p.z - 5);
  }, punten);
  await frames(page, 5);
  resultaat.scenario1_1OndodeDichtbij = {
    structuur: await meetOndodeStructuur(),
    frame: await meetFrame(),
    fps: FRAMETIJD_NIET_METEN,
  };
  await ruimOndodenOp();
}

// --- Scenario 2: 10 ondoden --------------------------------------------------
{
  await spawnN(10);
  resultaat.scenario2_10Ondoden = {
    structuur: await meetOndodeStructuur(),
    frame: await meetFrame(),
    fps: FRAMETIJD_NIET_METEN,
  };
  await ruimOndodenOp();
}

// --- Scenario 3: 18 ondoden ---------------------------------------------------
{
  await spawnN(18);
  resultaat.scenario3_18Ondoden = {
    structuur: await meetOndodeStructuur(),
    frame: await meetFrame(),
    fps: FRAMETIJD_NIET_METEN,
  };
  // Niet opruimen — scenario 4 bouwt hierop voort (18 ondoden + schieten).
}

// --- Scenario 4: 18 ondoden tijdens snel schieten -----------------------------
{
  // "Snel schieten": AANTAL_SCHOTEN keer schiet() aanroepen (zelfde debug-
  // hook-aanpak als test-effecten-pool.mjs), gevolgd door de meting terwijl
  // de tracer-/impact-effecten nog actief zijn — dat is de belastingssituatie
  // die dit scenario onderscheidt van gewoon "18 ondoden staan stil".
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.wapenStaat.magazijn = 999;
    for (let i = 0; i < 20; i++) d.schiet();
  });
  await frames(page, 2);   // vlak NA de schoten, terwijl tracers/impacts nog leven
  resultaat.scenario4_18OndodenSnelSchieten = {
    structuur: await meetOndodeStructuur(),
    frame: await meetFrame(),
    fps: FRAMETIJD_NIET_METEN,
  };
  await ruimOndodenOp();
}

console.log(JSON.stringify(resultaat, null, 2));
console.log('\nerrors:', errs.length ? errs : 'geen');
await browser.close();
