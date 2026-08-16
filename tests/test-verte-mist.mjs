// Feedback-fix (gebruiker: "de mist ziet er raar uit als ik op het platform
// bij de jetski sta"). Alles wat ver weg staat is bewust `fog:false` — de
// hemelkoepel (T111), de drie skylinelagen + raampjes (T112/T113) en de verre
// oever (T112). Goed voor de normale fog, fout tijdens een Mistgolf: het
// water (gewoon MeshStandardMaterial, dus WEL mistig) verzadigde over z'n
// volle 26 m naar de lichte misttint terwijl hemel/silhouetten/oever pikzwart
// bleven — een vlakke lichte waterplaat met een harde, uitgesneden horizon.
//
// De fix koppelt die verte alsnog aan de mist via één gedeelde maat,
// mistDekking() (0 bij FOG_NORMAAL/FOG_BUITEN, 1 bij FOG_MIST, afgeleid uit
// de LIVE scene.fog.far zodat elke bestaande blend automatisch meeloopt).
// Deze test dekt drie dingen af: de maat zelf, de doorwerking naar de drie
// soorten verte-objecten, en — met echte pixels — dat de hemel tijdens een
// Mistgolf daadwerkelijk mee oplicht i.p.v. zwart te blijven.
import { openVoorVisueleMeting, zetVisueelStandpunt, makeChecker, frames } from './helpers.mjs';
import { PNG } from 'pngjs';

const { browser, page, errs } = await openVoorVisueleMeting();
const { check, report } = makeChecker();

// Zet de fog hard op een profiel en laat de gameLoop één keer doordraaien,
// zodat updateNachthemel()/updateVerteMist() de nieuwe stand hebben verwerkt.
// GEEN eigen timer aanzetten: dit test de STAND, niet de overgang (die is al
// gedekt door test-fogdiepte.mjs).
async function zetFog(profielNaam) {
  await page.evaluate((naam) => {
    const d = window.AmsterdamUndeadDebug;
    const p = d[naam];
    d.scene.fog.color.setHex(p.kleur);
    d.scene.fog.near = p.near;
    d.scene.fog.far = p.far;
  }, profielNaam);
  await frames(page, 3);
}

// --- 1. mistDekking(): de gedeelde maat ---------------------------------
const maat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const meet = (near, far, kleur) => {
    d.scene.fog.near = near; d.scene.fog.far = far; d.scene.fog.color.setHex(kleur);
    return d.mistDekking();
  };
  const normaal = meet(d.FOG_NORMAAL.near, d.FOG_NORMAAL.far, d.FOG_NORMAAL.kleur);
  const buiten = meet(d.FOG_BUITEN.near, d.FOG_BUITEN.far, d.FOG_BUITEN.kleur);
  const mist = meet(d.FOG_MIST.near, d.FOG_MIST.far, d.FOG_MIST.kleur);
  const half = meet(d.FOG_MIST.near, (d.FOG_NORMAAL.far + d.FOG_MIST.far) / 2, d.FOG_MIST.kleur);
  return { normaal, buiten, mist, half };
});
check('mistDekking() = 0 bij het normale binnenprofiel', maat.normaal === 0, maat);
check('mistDekking() = 0 (niet negatief) bij het ruimere buitenprofiel', maat.buiten === 0, maat);
check('mistDekking() = 1 bij het volle Mistgolf-profiel', Math.abs(maat.mist - 1) < 1e-9, maat);
check('mistDekking() loopt evenredig: halverwege far geeft ~0,5', Math.abs(maat.half - 0.5) < 0.01, maat);

// --- 2. Hemelkoepel: uniforms volgen de live fog ------------------------
await zetFog('FOG_NORMAAL');
const koepelNormaal = await page.evaluate(() => {
  const u = window.AmsterdamUndeadDebug.nachthemelMateriaal.uniforms;
  return { dekking: u.mistDekking.value, kleur: u.mistKleur.value.getHex() };
});
check('Zonder mist staat de koepel-mistDekking op 0 (exacte no-op, geen pixel verandert)',
  koepelNormaal.dekking === 0, koepelNormaal);

await zetFog('FOG_MIST');
const koepelMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const u = d.nachthemelMateriaal.uniforms;
  return { dekking: u.mistDekking.value, kleur: u.mistKleur.value.getHex(), fogKleur: d.scene.fog.color.getHex() };
});
check('Bij volle mist staat de koepel-mistDekking op 1', Math.abs(koepelMist.dekking - 1) < 1e-9, koepelMist);
check('De koepel neemt de LIVE fogkleur over (niet een vaste FOG_MIST-constante), zodat de naad bij de horizon dicht blijft tijdens een blend',
  koepelMist.kleur === koepelMist.fogKleur, koepelMist);

// --- 3. Skyline + verre oever: fog:false-materialen kleuren mee ---------
// De materialen zijn gedeeld en gecached; dit leest ze via de meshes in
// `wereld` (zelfde traverse-patroon als test-skyline.mjs).
async function verteKleuren() {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const skyline = new Set(), oever = new Set();
    d.wereld.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.userData.verreGrond) oever.add(o.material.color.getHexString());
      else if (o.userData.skylineRaam) { /* apart, zie 4 */ }
      else if (o.parent && o.parent.userData && o.parent.userData.skyline) skyline.add(o.material.color.getHexString());
    });
    return { skyline: [...skyline].sort(), oever: [...oever].sort(), fog: d.scene.fog.color.getHexString() };
  });
}
const verteMist = await verteKleuren();
check('Bij volle mist staat de verre oever exact op de fogkleur (hij was 0x020406 en zou anders als zwart gat in de mistbank blijven staan)',
  verteMist.oever.length > 0 && verteMist.oever.every((k) => k === verteMist.fog), verteMist);
check('Bij volle mist staan ook alle skyline-silhouetten op de fogkleur (geen uitgesneden zwarte panden meer)',
  verteMist.skyline.length > 0 && verteMist.skyline.every((k) => k === verteMist.fog), verteMist);

await zetFog('FOG_NORMAAL');
const verteNormaal = await verteKleuren();
check('Terug in de normale fog staan de silhouetten weer op hun eigen, ongemiste tinten (geen drift na een mistbeurt)',
  verteNormaal.skyline.join() === '03050a,070b13,0b101b', verteNormaal);
check('Terug in de normale fog staat de verre oever weer op 0x020406 — exact de kleurGrond van de koepel, dus opnieuw naadloos',
  verteNormaal.oever.every((k) => k === '020406'), verteNormaal);

// --- 4. Raampjes doven mee ---------------------------------------------
const raamNormaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateSkylineRaampjes(0, 1, 1);
  let max = 0, n = 0;
  d.wereld.traverse((o) => { if (o.userData.skylineRaam) { n++; max = Math.max(max, o.material.opacity); } });
  return { max, n };
});
check('Zonder mist branden er raampjes (controle: de meting hieronder zegt dan iets)',
  raamNormaal.n > 0 && raamNormaal.max > 0, raamNormaal);

const raamMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateSkylineRaampjes(0, 1, 0);   // mistFactor 0 = volle mist
  let max = 0;
  d.wereld.traverse((o) => { if (o.userData.skylineRaam) max = Math.max(max, o.material.opacity); });
  return { max };
});
check('Bij volle mist zijn alle raampjes volledig gedoofd (ze zijn fog:false en zouden anders als scherpe stipjes door de mistbank prikken)',
  raamMist.max === 0, raamMist);

// --- 5. Echte pixels vanaf de vlonder ------------------------------------
// Het standpunt uit de klacht: op het platform bij de jetski, kijkend over
// het water. De bovenste 35% van het beeld is daar hemel + skyline; die
// bleef vóór deze fix pikdonker terwijl het water ervoor volledig naar de
// misttint verzadigde. De assert is dus richtinggevend, niet cosmetisch:
// de hemel MOET bij volle mist substantieel oplichten.
const standpunt = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { x: (d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2, z: d.BIJKEUKEN_CZ, yaw: -Math.PI / 2, pitch: -0.12 };
});
await zetVisueelStandpunt(page, standpunt);

// Gemiddelde luminantie van een horizontale band. Via page.screenshot() +
// pngjs, precies zoals test-visuele-basislijn.mjs: de renderer draait met
// preserveDrawingBuffer:false, dus gl.readPixels()/canvas.toDataURL() in de
// pagina zelf leveren zwart op (die val staat daar uitgeschreven).
// Alleen de LINKERHELFT van het beeld: rechtsboven staat de HUD-kaart, die
// een vaste, mistloze bijdrage zou geven en de meting zou verwateren.
async function bandLuminantie(vanFractie, totFractie) {
  const buf = await page.screenshot();
  const png = PNG.sync.read(buf);
  const y0 = Math.floor(png.height * vanFractie);
  const y1 = Math.floor(png.height * totFractie);
  const x1 = Math.floor(png.width * 0.5);
  let som = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      som += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  }
  return som / n;
}

await zetFog('FOG_NORMAAL');
await zetVisueelStandpunt(page, standpunt);
const hemelNormaal = await bandLuminantie(0.05, 0.35);
await zetFog('FOG_MIST');
const hemelMist = await bandLuminantie(0.05, 0.35);
check('Vanaf de vlonder licht de hemelband tijdens een Mistgolf duidelijk op i.p.v. donker te blijven — zonder deze fix bleef dit stuk beeld praktisch ongewijzigd terwijl het water eronder wél verzadigde',
  hemelMist > hemelNormaal * 1.5, { hemelNormaal: +hemelNormaal.toFixed(2), hemelMist: +hemelMist.toFixed(2) });

// De horizon zelf: de band net onder de skyline (water) en de band net
// erboven (hemel) horen bij volle mist naar dezelfde tint te trekken. Vóór
// de fix was dat een sprong van bijna zwart naar de volle misttint.
const bovenHorizon = await bandLuminantie(0.38, 0.44);
const onderHorizon = await bandLuminantie(0.48, 0.54);
const verschil = Math.abs(bovenHorizon - onderHorizon);
check('Bij volle mist is de sprong over de horizon klein (hemel en water komen op dezelfde misttint uit) — dit was de "uitgesneden horizon" uit de klacht',
  verschil < 12, { bovenHorizon: +bovenHorizon.toFixed(2), onderHorizon: +onderHorizon.toFixed(2), verschil: +verschil.toFixed(2) });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 || errs.length > 0 ? 1 : 0);
