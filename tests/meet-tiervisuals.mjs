// Ticket 137 — visuele spec en budget voor de tier-visuals.
//
// Geen testbestand (bewust geen test-/check-prefix): dit meet en rapporteert,
// zodat T137 zijn spec op getallen kan baseren in plaats van op inschatting.
//
// Vier vragen die de ticket-acceptatie stelt en die je niet kunt beantwoorden
// zonder te meten:
//
//   A. Hoeveel ruimte is er nog binnen vangrail 1 (<= 5 meshes, 0 lichten per
//      `smederijVisuals*`-Group)? Tier 2 moet er nog bij passen.
//   B. Wat doet een tier-visual met `test-visuele-basislijn.mjs` (vangrail 4)?
//      Welke standpunten verschuiven, en met hoeveel? Dit is de meting die het
//      ticket letterlijk vraagt te BEGROTEN.
//   C. Wat kost een tier aan draw calls/driehoeken? De RENDER_BAND is 25%.
//   D. Welke `userData.onderdelen`-sleutels levert elk wapen vandaag? Die
//      moeten alle drie de tiers blijven leveren (GUNFEEL.md §5).
//
// Meetopzet: exact dezelfde harnas als test-visuele-basislijn.mjs —
// `openVoorVisueleMeting()` (geen pointer lock, dus `spelActief` blijft uit en
// alle dt-gedreven cosmetiek staat stil), dezelfde acht standpunten, hetzelfde
// 15-85%-venster. Alleen zo zijn de cijfers hieronder direct vergelijkbaar met
// de vastgelegde BASISLIJN.
import { openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt } from './helpers.mjs';
import { PNG } from 'pngjs';

const { browser, page, errs } = await openVoorVisueleMeting();

function pixelstats(buf) {
  const png = PNG.sync.read(buf);
  const vals = [];
  let som = 0;
  const x0 = Math.floor(png.width * 0.15), x1 = Math.floor(png.width * 0.85);
  const y0 = Math.floor(png.height * 0.15), y1 = Math.floor(png.height * 0.85);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      vals.push(l); som += l;
    }
  }
  vals.sort((a, b) => a - b);
  return { gemiddelde: som / vals.length, mediaan: vals[vals.length >> 1] };
}

const punten = await berekenVisueleStandpunten(page);

// De vastgelegde basislijn uit test-visuele-basislijn.mjs, ter kruiscontrole:
// die is gemeten MET HET MES in de hand (T134 maakte het mes het startwapen en
// het bestand roept `geefSpelerVuurwapen()` niet aan). Als de mes-meting
// hieronder daarop uitkomt, meet dit script hetzelfde als de vangrail.
const BASISLIJN = {
  woonkamer:    { gemiddelde: 28.03, mediaan: 16.51 },
  gang:         { gemiddelde: 29.39, mediaan: 15.59 },
  atelier:      { gemiddelde: 31.69, mediaan: 16.66 },
  binnenplaats: { gemiddelde: 23.07, mediaan: 21.03 },
  bijkeuken:    { gemiddelde: 27.39, mediaan: 16.80 },
  kelder:       { gemiddelde: 13.39, mediaan: 10.12 },
  vliering:     { gemiddelde: 10.73, mediaan: 2.92 },
  gracht:       { gemiddelde: 22.15, mediaan: 15.66 },
};

// --- A + D + E: structuur, budget en onderdelen (geen pixels nodig) --------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const telGroep = (groep) => {
    let meshes = 0, lichten = 0;
    for (const kind of groep.children) { if (kind.isPointLight) lichten++; else meshes++; }
    return { meshes, lichten };
  };
  const vlamVorm = (groep) => {
    // Vangrail 2: elke `vlam` blijft een Group van exact twee PlaneGeometry's.
    const vlam = groep.children.find(k => k.isGroup && k.userData && k.userData.vlamMateriaal);
    if (!vlam) return null;
    return {
      kinderen: vlam.children.length,
      types: vlam.children.map(k => k.geometry && k.geometry.type),
    };
  };
  return {
    budget: {
      drukspuit: telGroep(d.smederijVisualsDrukspuit),
      ratelaar: telGroep(d.smederijVisualsRatelaar),
    },
    onderdelen: {
      drukspuit: Object.keys(d.WAPEN_DRUKSPUIT.groep.userData.onderdelen),
      ratelaar: Object.keys(d.WAPEN_RATELAAR.groep.userData.onderdelen),
      mes: Object.keys(d.wapenMes.userData.onderdelen),
    },
    // Hoeveel meshes hangt er aan het BASISMODEL zelf (los van de tier-Group)?
    basisMeshes: {
      drukspuit: d.WAPEN_DRUKSPUIT.groep.children.filter(k => k.isMesh).length,
      ratelaar: d.WAPEN_RATELAAR.groep.children.filter(k => k.isMesh).length,
      mes: d.wapenMes.children.filter(k => k.isMesh).length,
    },
    vlam: {
      drukspuit: vlamVorm(d.WAPEN_DRUKSPUIT.groep),
      ratelaar: vlamVorm(d.WAPEN_RATELAAR.groep),
    },
  };
});

// --- B + C: pixel- en renderkosten per wapen-in-de-hand, per tier ----------
// Het wapen in rust neerzetten: de wisseldip, terugslag en model-kick zijn
// allemaal dt-gedreven offsets die de rustpose verschuiven. Nul zetten en één
// keer de presentatielaag draaien geeft exact de rustpose.
async function zetWapen(wapenNaam) {
  await page.evaluate((naam) => {
    const d = window.AmsterdamUndeadDebug;
    d.spelStaat.geld = 10000000;
    if (naam === 'drukspuit' && !d.wapenStaten.drukspuit) d.koopAmstel9();
    if (naam === 'ratelaar' && !d.wapenStaten.ratelaar) d.koopRatelaar();
    d.activeerVuurwapen(naam);
    d.wisselTimer = 0;
    d.terugslag = 0;
    d.wapenKickX = 0;
    d.bobFase = 0;
    d.updateWapenPresentatie(0);
  }, wapenNaam);
}

async function meetAlleStandpunten() {
  const uit = {};
  for (const sp of punten) {
    await zetVisueelStandpunt(page, sp);
    // zetVisueelStandpunt() draait drie frames; de gameLoop staat stil
    // (spelActief uit), maar de presentatielaag opnieuw op dt=0 draaien
    // garandeert dat het wapen op zijn rustpose staat.
    await page.evaluate(() => window.AmsterdamUndeadDebug.updateWapenPresentatie(0));
    // Zelfde meetwijze als test-visuele-basislijn.mjs: autoReset uit, resetten
    // en pas ná één echte frame uitlezen — anders lees je de telling van de
    // vórige frame.
    const render = await page.evaluate(() => {
      const d = window.AmsterdamUndeadDebug;
      d.renderer.info.autoReset = false;
      d.renderer.info.reset();
      return new Promise(res => requestAnimationFrame(() =>
        res({ calls: d.renderer.info.render.calls, triangles: d.renderer.info.render.triangles })));
    });
    const px = pixelstats(await page.screenshot({ type: 'png' }));
    uit[sp.naam] = { ...px, ...render };
  }
  return uit;
}

const metingen = {};

// 1) Het mes — de huidige, vastgelegde basislijn.
metingen['mes'] = await meetAlleStandpunten();

// 2) Beide vuurwapens, tier voor tier. Smeden is eenrichtingsverkeer, dus per
//    wapen oplopend: tier 0 -> 1 -> 2.
for (const wapen of ['drukspuit', 'ratelaar']) {
  for (const tier of [0, 1, 2]) {
    await zetWapen(wapen);
    if (tier > 0) {
      await page.evaluate((t) => {
        const d = window.AmsterdamUndeadDebug;
        d.spelStaat.geld = 10000000;
        while ((d.gesmeedActief ? 1 : 0) + (d.gesmeedNiveau2Actief ? 1 : 0) < t) {
          const voor = (d.gesmeedActief ? 1 : 0) + (d.gesmeedNiveau2Actief ? 1 : 0);
          d.spelStaat.geld = 10000000;
          d.koopSmederij();
          if ((d.gesmeedActief ? 1 : 0) + (d.gesmeedNiveau2Actief ? 1 : 0) === voor) break;
        }
      }, tier);
    }
    metingen[`${wapen}-t${tier}`] = await meetAlleStandpunten();
  }
}

// Na het smeden: hoeveel meshes staan er dan zichtbaar in elke tier-Group?
const budgetNaSmeden = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const telZichtbaar = (groep) => ({
    zichtbaar: groep.visible,
    meshes: groep.children.filter(k => !k.isPointLight).length,
    lichten: groep.children.filter(k => k.isPointLight).length,
  });
  return {
    drukspuit: telZichtbaar(d.smederijVisualsDrukspuit),
    ratelaar: telZichtbaar(d.smederijVisualsRatelaar),
  };
});

// --- rapportage ------------------------------------------------------------
console.log('=== A. Budget per smederijVisuals-Group (vangrail 1: <= 5 meshes, 0 lichten) ===');
for (const [naam, b] of Object.entries(structuur.budget)) {
  console.log(`${naam.padEnd(12)} ${b.meshes} meshes, ${b.lichten} lichten  -> ruimte over: ${5 - b.meshes} meshes`);
}
console.log('Na volledig smeden (beide niveaus):', JSON.stringify(budgetNaSmeden));
console.log('Meshes in het BASISmodel zelf:', JSON.stringify(structuur.basisMeshes));

console.log('\n=== D. userData.onderdelen-sleutels (moeten alle tiers blijven leveren) ===');
for (const [naam, sleutels] of Object.entries(structuur.onderdelen)) {
  console.log(`${naam.padEnd(12)} ${sleutels.join(', ')}`);
}

console.log('\n=== E. vlam-structuur (vangrail 2: Group van exact 2 PlaneGeometry) ===');
console.log(JSON.stringify(structuur.vlam));

console.log('\n=== B. Kruiscontrole: meet dit script hetzelfde als de vangrail? ===');
console.log('standpunt      basislijn gem/med    gemeten (mes) gem/med    afwijking');
for (const sp of punten) {
  const b = BASISLIJN[sp.naam], m = metingen['mes'][sp.naam];
  const dG = ((m.gemiddelde - b.gemiddelde) / b.gemiddelde) * 100;
  const dM = ((m.mediaan - b.mediaan) / b.mediaan) * 100;
  console.log(`${sp.naam.padEnd(14)} ${b.gemiddelde.toFixed(2)}/${b.mediaan.toFixed(2)}`.padEnd(38)
    + `${m.gemiddelde.toFixed(2)}/${m.mediaan.toFixed(2)}`.padEnd(27)
    + `${dG >= 0 ? '+' : ''}${dG.toFixed(2)}% / ${dM >= 0 ? '+' : ''}${dM.toFixed(2)}%`);
}

console.log('\n=== B. Pixelverschuiving per wapen-in-de-hand t.o.v. het mes (= de basislijn) ===');
console.log('Positief = helderder dan de vastgelegde basislijn. De 2%-BAND is de grens.');
console.log('\nstandpunt      ' + Object.keys(metingen).filter(k => k !== 'mes').map(k => k.padEnd(17)).join(''));
for (const sp of punten) {
  const basis = metingen['mes'][sp.naam];
  const cellen = Object.keys(metingen).filter(k => k !== 'mes').map(k => {
    const m = metingen[k][sp.naam];
    const dG = ((m.gemiddelde - basis.gemiddelde) / basis.gemiddelde) * 100;
    const dM = ((m.mediaan - basis.mediaan) / basis.mediaan) * 100;
    return `${dG >= 0 ? '+' : ''}${dG.toFixed(1)}/${dM >= 0 ? '+' : ''}${dM.toFixed(1)}`.padEnd(17);
  });
  console.log(sp.naam.padEnd(14) + cellen.join(''));
}
console.log('(cel = verschuiving gemiddelde% / mediaan%)');

console.log('\n=== B2. Tier-op-tier: wat voegt ELKE tier toe binnen hetzelfde wapen? ===');
for (const wapen of ['drukspuit', 'ratelaar']) {
  console.log(`\n${wapen}:`);
  console.log('standpunt      t0->t1 gem/med      t1->t2 gem/med');
  for (const sp of punten) {
    const t0 = metingen[`${wapen}-t0`][sp.naam];
    const t1 = metingen[`${wapen}-t1`][sp.naam];
    const t2 = metingen[`${wapen}-t2`][sp.naam];
    const pct = (a, b) => `${b.gemiddelde >= a.gemiddelde ? '+' : ''}${(((b.gemiddelde - a.gemiddelde) / a.gemiddelde) * 100).toFixed(2)}%/`
      + `${b.mediaan >= a.mediaan ? '+' : ''}${(((b.mediaan - a.mediaan) / a.mediaan) * 100).toFixed(2)}%`;
    console.log(`${sp.naam.padEnd(14)} ${pct(t0, t1).padEnd(20)} ${pct(t1, t2)}`);
  }
}

console.log('\n=== C. Renderkosten (draw calls / driehoeken), standpunt "woonkamer" ===');
for (const [naam, m] of Object.entries(metingen)) {
  console.log(`${naam.padEnd(16)} calls ${String(m.woonkamer.calls).padEnd(5)} driehoeken ${m.woonkamer.triangles}`);
}

console.log('\n=== JSON ===');
console.log(JSON.stringify({ structuur, budgetNaSmeden, metingen }));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
