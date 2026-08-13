// Ticket 88 (v0.22, §10.4-beslissing 79, §10.4.1, nulmeting §10.17): de
// visuele basislijn en helderheidsvangrail voor ronde 8 (v0.22). Vóór alle
// andere v0.22-tickets, want ná drie tickets weet je niet meer welk ticket
// welke verschuiving veroorzaakte (zelfde patroon als T77 vóór T69, en de
// rastertest vóór de vliering-geometrie in T87).
//
// Bewaakt twee dingen:
//   1. De pixelhelderheid op acht vaste standpunten blijft binnen een SMALLE
//      band (orde 1-2%) van de vastgelegde waarde.
//   2. De zes ronde-brede invarianten uit §10.2 blijven intact: 28 lichten,
//      1 schaduwwerper, 56 obstakels, 14 interactiepunten, 3 composer-
//      passes (ongewijzigd tot T96).
//
// Twee meetvallen zijn hier de reden dat dit ticket bestaat en niet triviaal
// is (zie §10.4.1 + het reviewverslag §10.18):
//   - De lampflikker geeft 11,2% spreiding over 90 frames als je 'm niet
//     bevriest. `visueleBevriesTijd` (amsterdam-undead.html) lost dat op.
//   - `gl.readPixels()`/`canvas.toDataURL()` leveren zwart/leeg op
//     (preserveDrawingBuffer: false) — alleen `page.screenshot()` werkt.
// Twee EXTRA vallen, tijdens het bouwen van dit ticket zelf gevonden en dus
// niet in het architectuurdocument vastgelegd toen dat geschreven werd:
//   - Met pointer lock gesimuleerd (het gebruikelijke testpatroon) staat
//     spelActief permanent aan, en dan blijven de kelderhals-druppel, de
//     winkelmarkering-puls en de stofwolken (allemaal dt-gedreven, niet
//     gedekt door visueleBevriesTijd/lampDipFactor/mistUitfaseTimer) gewoon
//     doorlopen tijdens de meting. `openVoorVisueleMeting()` (helpers.mjs)
//     verbergt het DOM-startscherm ZONDER pointer lock te mocken, zodat
//     spelActief nooit aan gaat — gemeten: 0,000% spreiding over 10
//     metingen op hetzelfde standpunt, BINNEN één testrun.
//   - TUSSEN losse testruns bleef daarna nog tot 6% spreiding over
//     (zichtbaar in kamers met `lampLichten`, afwezig waar het licht van
//     stabiele `buitenLichten` komt) — `hangLamp()` geeft elke lamp een
//     willekeurige flikkerfase bij het bouwen van de wereld
//     (`Math.random()`, dus anders bij elke page-load), en die fase blijft
//     ONgemoeid door visueleBevriesTijd (dat bevriest alleen de tijd-term,
//     `Math.sin(t*7+fase)` is op t=0 nog steeds `Math.sin(fase)`, een
//     andere constante per run). `openVoorVisueleMeting()` pint nu ook
//     `lampLichten[].fase = 0` — geverifieerd: <0,05% restspreiding over
//     4 losse browserruns.
import { openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, makeChecker } from './helpers.mjs';
import { PNG } from 'pngjs';

const { browser, page, errs } = await openVoorVisueleMeting();
const { check, report } = makeChecker();

// Middenblok van het 640x400-scherm (15%-85% op beide assen) — vermijdt de
// uiterste randen zonder de HUD-chrome bewust weg te snijden: die is nu
// volledig deterministisch (spelActief staat nooit aan) en hoort dus gewoon
// mee te tellen in "hoe ziet het spel eruit", net als de rest van het beeld.
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
      som += l;
      vals.push(l);
    }
  }
  vals.sort((a, b) => a - b);
  return { gemiddelde: som / vals.length, mediaan: vals[Math.floor(vals.length / 2)] };
}

async function meetRenderInfo(page) {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.renderer.info.autoReset = false;
    d.renderer.info.reset();
    return new Promise(res => requestAnimationFrame(() =>
      res(JSON.parse(JSON.stringify(d.renderer.info.render)))));
  });
}

const punten = await berekenVisueleStandpunten(page);
check('Acht visuele standpunten berekend (vijf zoneVan()-zones + kelder/vliering/gracht)',
  punten.length === 8, punten.map(p => p.naam));

// --- 1. Zelf-check: bewijs dat de bevriezing werkt vóórdat we 'm gebruiken.
// Tien opeenvolgende metingen op hetzelfde standpunt — twee is niet genoeg
// om de flikkercyclus te vangen (§10.4.1: 11,2% spreiding gemeten over 90
// frames zónder bevriezing).
const zelfCheckPunt = punten.find(p => p.naam === 'woonkamer');
const zelfCheckReeks = [];
for (let i = 0; i < 10; i++) {
  await zetVisueelStandpunt(page, zelfCheckPunt);
  const buf = await page.screenshot({ type: 'png' });
  zelfCheckReeks.push(pixelstats(buf).gemiddelde);
}
const zcMin = Math.min(...zelfCheckReeks), zcMax = Math.max(...zelfCheckReeks);
const zcGem = zelfCheckReeks.reduce((a, b) => a + b, 0) / zelfCheckReeks.length;
const zcSpreidingPct = ((zcMax - zcMin) / zcGem) * 100;
check('Zelf-check: 10 metingen op hetzelfde standpunt blijven binnen 2% spreiding (was 11,2% zonder bevriezing)',
  zcSpreidingPct <= 2, { reeks: zelfCheckReeks.map(v => +v.toFixed(3)), spreidingPct: +zcSpreidingPct.toFixed(3) });

// --- 2. Per-zone helderheidsbasislijn -------------------------------------
// Vastgelegde waarden, gemeten op commit a54a2f4 (ná de reviewcorrecties,
// vóór enig v0.22-bouwticket). BAND is bewust smal (2%, "orde 1-2%" uit
// §10.4.1) — een ticket dat 'm overschrijdt moet de nieuwe waarde HIER
// expliciet bijwerken, mét onderbouwing in ARCHITECTURE_NOTES.md §10 (zelfde
// mechanisme als test-resources.mjs voor geheugenlekken: niet "voorkom de
// wijziging", maar "maak de wijziging zichtbaar en bewust").
const BAND = 0.02;
// RENDER_BAND is ruimer: draw calls/driehoeken zijn een informatieve
// rendermetric (§10.3), geen getunede helderheid — een ticket mag hier
// legitiem overheen gaan (T99 telt bijvoorbeeld extra ondode-meshes), maar
// een sprong van >25% hoort een bewuste keuze te zijn, geen toevalstreffer.
const RENDER_BAND = 0.25;
const BASISLIJN = {
  woonkamer:    { gemiddelde: 31.25, mediaan: 18.08, calls: 486, triangles: 12474 },
  gang:         { gemiddelde: 35.14, mediaan: 17.49, calls: 346, triangles: 6654 },
  atelier:      { gemiddelde: 37.20, mediaan: 20.97, calls: 187, triangles: 2952 },
  binnenplaats: { gemiddelde: 35.53, mediaan: 31.16, calls: 198, triangles: 3504 },
  bijkeuken:    { gemiddelde: 29.58, mediaan: 19.65, calls: 438, triangles: 9838 },
  kelder:       { gemiddelde: 18.82, mediaan: 15.59, calls: 140, triangles: 2402 },
  vliering:     { gemiddelde: 11.54, mediaan: 1.65,  calls: 195, triangles: 3806 },
  gracht:       { gemiddelde: 19.01, mediaan: 7.78,  calls: 126, triangles: 2274 },
};

const gemeten = {};
for (const sp of punten) {
  await zetVisueelStandpunt(page, sp);
  const render = await meetRenderInfo(page);
  const buf = await page.screenshot({ type: 'png' });
  const px = pixelstats(buf);
  gemeten[sp.naam] = { ...px, calls: render.calls, triangles: render.triangles };

  const basis = BASISLIJN[sp.naam];
  const binnenBand = (waarde, verwacht, band) =>
    verwacht === 0 ? waarde === 0 : Math.abs(waarde - verwacht) / verwacht <= band;

  check(`${sp.naam}: gemiddelde helderheid binnen ${BAND * 100}% van de basislijn`,
    binnenBand(px.gemiddelde, basis.gemiddelde, BAND),
    { gemeten: +px.gemiddelde.toFixed(2), verwacht: basis.gemiddelde });
  check(`${sp.naam}: mediane helderheid binnen ${BAND * 100}% van de basislijn`,
    binnenBand(px.mediaan, basis.mediaan, BAND),
    { gemeten: +px.mediaan.toFixed(2), verwacht: basis.mediaan });
  check(`${sp.naam}: draw calls binnen ${RENDER_BAND * 100}% van de basislijn`,
    binnenBand(render.calls, basis.calls, RENDER_BAND),
    { gemeten: render.calls, verwacht: basis.calls });
  check(`${sp.naam}: driehoeken binnen ${RENDER_BAND * 100}% van de basislijn`,
    binnenBand(render.triangles, basis.triangles, RENDER_BAND),
    { gemeten: render.triangles, verwacht: basis.triangles });
}

// --- 3. De zes ronde-brede invarianten uit §10.2 --------------------------
const invarianten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0, schaduwwerpers = 0;
  d.scene.traverse(o => { if (o.isLight) { lichten++; if (o.castShadow) schaduwwerpers++; } });
  return {
    lichten, schaduwwerpers,
    obstakels: d.obstakels.length,
    interactiePunten: d.interactiePunten.length,
    composerPasses: d.composer.passes.length,
  };
});
check('Invariant 2: precies 28 lichten (1 hemisfeer + 27 point)', invarianten.lichten === 28, invarianten);
check('Invariant 2: precies 1 schaduwwerpend licht', invarianten.schaduwwerpers === 1, invarianten);
check('Invariant 5: obstakels.length blijft 56', invarianten.obstakels === 56, invarianten);
check('interactiePunten.length blijft 14', invarianten.interactiePunten === 14, invarianten);
check('Post-processing blijft 3 passes (RenderPass/Bloom/Output, tot T96)', invarianten.composerPasses === 3, invarianten);

// --- 4. Bronvorm van de assertie: een band, geen exact getal --------------
// Bewijst dat BAND daadwerkelijk als relatieve afwijking werkt en niet per
// ongeluk altijd waar is (bv. door een == 0-bug in binnenBand hierboven).
check('BAND-logica: 5% afwijking op een niet-nul basiswaarde faalt de 2%-toets',
  Math.abs(105 - 100) / 100 > BAND, { afwijkingPct: 5, band: BAND * 100 });

console.log('\nGemeten waarden (voor eventuele bijwerking van BASISLIJN):');
console.log(JSON.stringify(gemeten, null, 2));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
