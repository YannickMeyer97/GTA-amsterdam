// Ticket 108 (v0.22, §10.11-beslissing 86): normal maps uit dezelfde
// hoogtebron als T107's ruwheidsinversie (Sobel-achtige gradient), alleen
// toegepast op 'steen'/'hout' via matFamilieReliëf(), alleen op de grote
// vlakken (gang-/kelder-/kelderoost-vloer, kelderwanden, vlonder) — nooit
// op de kleine objecten (deurpanelen, kratten, treden) die dezelfde
// familie delen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. matFamilieReliëf() geeft 'steen'/'hout' een normalMap, en laat de
// gedeelde basis-materialen (matFamilie(), gebruikt door de kleine
// objecten) volledig ongemoeid.
const basisTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const steenReliëf = d.matFamilieReliëf('steen', 0x1c1a16);
  const houtReliëf = d.matFamilieReliëf('hout', 0x2a241d);
  const steenBasis = d.matFamilie('steen', 0x1c1a16);
  const houtBasis = d.matFamilie('hout', 0x2a241d);
  return {
    steenReliëfHeeftNormalMap: !!steenReliëf.normalMap,
    houtReliëfHeeftNormalMap: !!houtReliëf.normalMap,
    steenBasisBlijftOngemoeid: !steenBasis.normalMap,
    houtBasisBlijftOngemoeid: !houtBasis.normalMap,
    verschillendeObjecten: steenReliëf !== steenBasis && houtReliëf !== houtBasis,
    normalScale: [steenReliëf.normalScale.x, steenReliëf.normalScale.y],
  };
});
check("matFamilieReliëf('steen', ...) krijgt een normalMap", basisTest.steenReliëfHeeftNormalMap, basisTest);
check("matFamilieReliëf('hout', ...) krijgt een normalMap", basisTest.houtReliëfHeeftNormalMap, basisTest);
check('De gedeelde matFamilie()-basis (gebruikt door kleine objecten) blijft ONGEMOEID zonder normalMap',
  basisTest.steenBasisBlijftOngemoeid && basisTest.houtBasisBlijftOngemoeid, basisTest);
check('matFamilieReliëf() geeft een APART materiaal-object terug, geen mutatie van de gedeelde basis',
  basisTest.verschillendeObjecten, basisTest);
check('normalScale is "laag" gehouden (<= 0,7), zoals de architectuurbeslissing voorschrijft',
  basisTest.normalScale[0] <= 0.7 && basisTest.normalScale[0] > 0, basisTest);

// --- 2. Scope-bewaking: alleen 'steen'/'hout' krijgen een normalMap via
// matFamilieReliëf() — 'tegel'/'metaal'/'natSteen'/'pleister' NIET (de
// architectuurbeslissing noemt expliciet alleen baksteen/hout als
// startpunt).
const scopeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const naam of ['tegel', 'metaal', 'natSteen', 'pleister']) {
    const basis = d.matFamilie(naam, 0x808080);
    const reliëf = d.matFamilieReliëf(naam, 0x808080);
    uit[naam] = { heeftNormalMap: !!reliëf.normalMap, zelfdeAlsBasis: reliëf === basis };
  }
  return uit;
});
for (const [naam, r] of Object.entries(scopeTest)) {
  check(`'${naam}' krijgt GEEN normalMap via matFamilieReliëf() (buiten scope, geeft de kale basis terug)`,
    !r.heeftNormalMap && r.zelfdeAlsBasis, { naam, ...r });
}

// --- 3. De normalMap zelf is per definitie NIET grijswaarde (een geldige
// tangent-normal wijst zelden recht naar (0,0,1)) — het inverse van de
// grijswaarde-garantie bij albedo/roughness. Wel moet het overgrote deel
// van de texels dicht bij "vlak" (blauw-kanaal dicht bij 255) liggen: het
// reliëf is subtiel, geen agressief reliëf.
const reliëfTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const steen = d.matFamilieReliëf('steen', 0x333333);
  const c = steen.normalMap.image;
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let somBlauw = 0, minBlauw = 255;
  for (let i = 0; i < data.length; i += 4) {
    somBlauw += data[i + 2];
    minBlauw = Math.min(minBlauw, data[i + 2]);
  }
  return { gemBlauw: somBlauw / (data.length / 4), minBlauw, grootte: c.width };
});
check('De normalMap is subtiel: het gemiddelde blauw-kanaal (nz) ligt ruim boven 200/255 ("bijna vlak")',
  reliëfTest.gemBlauw > 200, reliëfTest);
check('...maar niet perfect vlak: er zit wel degelijk reliëf in (minimum blauw-kanaal < 255)',
  reliëfTest.minBlauw < 255, reliëfTest);

// --- 4. Toepassing: de grote vlakken (gang-vloer, kelder-vloer x2,
// kelderwanden, vlonder) gebruiken daadwerkelijk matFamilieReliëf() —
// zichtbaar doordat hun material.normalMap bestaat. De kleine 'steen'/
// 'hout'-objecten (kelder-treden, deurpanelen, kratten) blijven op de
// kale basis.
const toepassingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    gangVloerHeeftReliëf: !!d.gangVloerMesh.material.normalMap,
    vlonderHeeftReliëf: !!d.vlonderMesh.material.normalMap,
  };
});
check('gangVloerMesh gebruikt het reliëf-materiaal (normalMap aanwezig)', toepassingTest.gangVloerHeeftReliëf, toepassingTest);
check('vlonderMesh gebruikt het reliëf-materiaal (normalMap aanwezig)', toepassingTest.vlonderHeeftReliëf, toepassingTest);

// --- 5. Laadtijd: beide normal maps (steen + hout, 512x512, Sobel) samen
// ruim onder 100ms — de architectuurbeslissing noemt dit expliciet als
// risico ("de duurste per-fragment-richting van de ronde").
const tijdTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.canvasNormaalCache.clear();
  const t0 = performance.now();
  d.bouwCanvasNormaalKaart('steen', d.CANVAS_TEXTUUR_TEKENAARS.steen);
  d.bouwCanvasNormaalKaart('hout', d.CANVAS_TEXTUUR_TEKENAARS.hout);
  return performance.now() - t0;
});
check(`Beide normal maps samen bouwen in < 100ms (gemeten: ${tijdTest.toFixed(1)}ms)`, tijdTest < 100, { tijdTest });

// --- 6. Cache-gedrag: herhaalde matFamilieReliëf()-aanroepen met dezelfde
// (naam, kleur) hergebruiken hetzelfde tweeling-materiaal (WeakMap-twin-
// patroon, net als matMetVertexKleur()).
const cacheTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = d.matFamilieReliëf('steen', 0x1c1a16);
  const b = d.matFamilieReliëf('steen', 0x1c1a16);
  return { zelfdeObject: a === b };
});
check('Twee matFamilieReliëf(\'steen\', dezelfde kleur)-aanroepen geven hetzelfde tweeling-object terug (geen dubbele materialen)',
  cacheTest.zelfdeObject, cacheTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
