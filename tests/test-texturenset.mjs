// Ticket 107 (v0.22, §10.11-beslissing 86): de echte texturenset —
// baksteenverband/planken/klinkers als albedo (map) + roughness
// (roughnessMap), i.p.v. de oude ruispatronen die alleen roughnessMap
// gebruikten.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. matFamilie() geeft de drie geüpgradede families ('steen'/'hout'/
// 'natSteen') zowel een `map` als een `roughnessMap`; 'metaal'/'tegel'
// blijven op hun oude pad.
const mapTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const steen = d.matFamilie('steen', 0x111111);
  const hout = d.matFamilie('hout', 0x222222);
  const natSteen = d.matFamilie('natSteen', 0x333333);
  const metaal = d.matFamilie('metaal', 0x444444);
  const tegel = d.matFamilie('tegel', 0x555555);
  return {
    steenHeeftMap: !!steen.map, steenHeeftRuwheid: !!steen.roughnessMap,
    houtHeeftMap: !!hout.map, houtHeeftRuwheid: !!hout.roughnessMap,
    natSteenHeeftMap: !!natSteen.map, natSteenHeeftRuwheid: !!natSteen.roughnessMap,
    metaalHeeftMap: !!metaal.map, metaalHeeftRuwheid: !!metaal.roughnessMap,
    tegelHeeftMap: !!tegel.map, tegelHeeftRuwheid: !!tegel.roughnessMap,
  };
});
check("'steen' krijgt zowel map als roughnessMap", mapTest.steenHeeftMap && mapTest.steenHeeftRuwheid, mapTest);
check("'hout' krijgt zowel map als roughnessMap", mapTest.houtHeeftMap && mapTest.houtHeeftRuwheid, mapTest);
check("'natSteen' krijgt zowel map als roughnessMap (was voorheen HELEMAAL geen textuur)",
  mapTest.natSteenHeeftMap && mapTest.natSteenHeeftRuwheid, mapTest);
check("'metaal' blijft roughness-only (geen map) — bewust niet geüpgraded deze ronde",
  !mapTest.metaalHeeftMap && mapTest.metaalHeeftRuwheid, mapTest);
check("'tegel' blijft ongetextureerd (geen map, geen roughnessMap) — had al geen textuur",
  !mapTest.tegelHeeftMap && !mapTest.tegelHeeftRuwheid, mapTest);

// --- 1b. Ticket 107-vervolg (klinkerrealisme): de roughnessMap is de
// INVERSE van de albedo. Three.js past 'm vermenigvuldigend toe
// (roughness *= texel.g), dus donker = glanzender. Toen beide kaarten met
// dezelfde tekenaar werden gerenderd, waren de donkere voegen dus juist het
// glanzendst — fysiek omgekeerd, en de directe oorzaak van de "geborsteld
// metaal"-indruk op de klinkervloer. Deze check bewaakt de richting: waar de
// albedo het DONKERST is (voeg/scheur/verweerde steen) moet de roughnessMap
// het HOOGST staan (dofst), en omgekeerd.
const inversieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lees = (tex) => {
    const c = tex.image;
    return { data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w: c.width };
  };
  const uit = {};
  for (const [naam, info] of Object.entries(d.MATERIAAL_FAMILIES)) {
    if (!info.albedo) continue;
    const { albedo, ruwheid } = d.bouwCanvasTextuurPaar(
      info.textuur, d.CANVAS_TEXTUUR_TEKENAARS[info.textuur], info.grootte);
    const a = lees(albedo), r = lees(ruwheid);
    let donkerst = 0, lichtst = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if (a.data[i] < a.data[donkerst]) donkerst = i;
      if (a.data[i] > a.data[lichtst]) lichtst = i;
    }
    uit[naam] = {
      zelfdeAfmeting: a.w === r.w,
      ruwheidOpDonkersteAlbedo: r.data[donkerst],
      ruwheidOpLichtsteAlbedo: r.data[lichtst],
    };
  }
  return uit;
});
for (const [naam, m] of Object.entries(inversieTest)) {
  check(`'${naam}': waar de albedo het donkerst is (voeg/naad) staat de roughnessMap HOGER dan waar de albedo het lichtst is — de kaart is inverse, niet identiek`,
    m.ruwheidOpDonkersteAlbedo > m.ruwheidOpLichtsteAlbedo, { naam, ...m });
  check(`'${naam}': albedo en roughnessMap hebben dezelfde afmeting (de roughness is uit dezelfde pixels afgeleid, dus per definitie corresponderend)`,
    m.zelfdeAfmeting, { naam, ...m });
}

// --- 1c. natSteen is geen metaal meer. metalness 0,12 tintte de highlight
// richting de basiskleur en gaf gepolijst-plaatwerk; de natte glans komt nu
// uit ruwheid (en vooral uit de plassen, die apart op roughness 0,07 staan).
const natSteenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const nat = d.matFamilie('natSteen', 0x3a4650);
  const steen = d.matFamilie('steen', 0x1c1a16);
  return { metaal: nat.metalness, ruwheid: nat.roughness, steenRuwheid: steen.roughness };
});
check('natSteen heeft metalness 0 (steen is nooit metallic)', natSteenTest.metaal === 0, natSteenTest);
check('natSteen blijft wél duidelijk glanzender dan gewone steen (leesbaar als vochtig plaveisel)',
  natSteenTest.ruwheid < natSteenTest.steenRuwheid, natSteenTest);

// --- 2. De map en de roughnessMap van dezelfde familie zijn TWEE
// VERSCHILLENDE textures (elk apart canvas), niet dezelfde texture
// hergebruikt voor beide rollen.
const paarTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const steen = d.matFamilie('steen', 0x666666);
  return { verschillend: steen.map !== steen.roughnessMap };
});
check('map en roughnessMap zijn twee aparte texture-objecten (niet dezelfde canvas voor beide rollen)',
  paarTest.verschillend, paarTest);

// --- 3. De albedo-map staat in sRGB-kleurruimte (kleurmap), de
// roughnessMap NIET (data, lineair) — anders krijgt de albedo een verkeerde
// helderheidscurve op renderer.outputColorSpace = SRGBColorSpace.
const colorSpaceTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const steen = d.matFamilie('steen', 0x777777);
  return { albedoColorSpace: steen.map.colorSpace, ruwheidColorSpace: steen.roughnessMap.colorSpace };
});
check('De albedo-map staat in SRGBColorSpace',
  colorSpaceTest.albedoColorSpace === 'srgb', colorSpaceTest);
check('De roughnessMap staat NIET in SRGBColorSpace (blijft lineaire data)',
  colorSpaceTest.ruwheidColorSpace !== 'srgb', colorSpaceTest);

// --- 4. Cache-gedrag: bouwCanvasTextuurPaar() bouwt elk patroon maar ÉÉN
// keer (net als de bestaande materiaalcaches) — herhaalde matFamilie()-
// aanroepen met dezelfde familie hergebruiken hetzelfde texturenpaar.
const cacheTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = d.matFamilie('steen', 0x888888);
  const b = d.matFamilie('steen', 0x999999);   // andere kleur, ZELFDE familie -> zelfde textuur, ander color
  return {
    zelfdeMap: a.map === b.map,
    zelfdeRuwheid: a.roughnessMap === b.roughnessMap,
    verschillendeKleur: a.color.getHex() !== b.color.getHex(),
  };
});
check('Twee matFamilie(\'steen\', ...)-aanroepen met verschillende kleuren delen dezelfde albedo/roughness-textures',
  cacheTest.zelfdeMap && cacheTest.zelfdeRuwheid, cacheTest);
check('...maar behouden wél hun eigen material.color (de kleur-tint blijft per aanroep instelbaar)',
  cacheTest.verschillendeKleur, cacheTest);

// --- 5. Grijswaarde-garantie: elke canvas-tekenaar (steen/hout/natSteen)
// tekent uitsluitend R=G=B — geen hue-verschuiving in de textuur zelf, de
// kleur komt van MATERIAAL_FAMILIES/de meegegeven `kleur` (§7.3, dezelfde
// "waarde, geen tint"-invariant als T101/T103/T104).
const grijswaardeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const naam of ['steen', 'hout', 'natSteen', 'pleister']) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    d.CANVAS_TEXTUUR_TEKENAARS[naam](canvas.getContext('2d'), 64, 232);
    const px = canvas.getContext('2d').getImageData(0, 0, 64, 64).data;
    let nietGrijs = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (Math.abs(px[i] - px[i + 1]) > 1 || Math.abs(px[i + 1] - px[i + 2]) > 1) nietGrijs++;
    }
    uit[naam] = nietGrijs;
  }
  return uit;
});
check('Elke geüpgradede tekenaar (steen/hout/natSteen/pleister) tekent uitsluitend grijswaarde (R≈G≈B), geen hue',
  Object.values(grijswaardeTest).every(n => n === 0), grijswaardeTest);

// --- 5b. Ticket 107-vervolg: de klinkertegel staat op WERELDSCHAAL en moet
// naadloos herhalen. Het gekozen verband (blokverband: elke cel twee stenen,
// om en om liggend/staand) heeft periode 2 cellen in beide richtingen — met
// een EVEN aantal cellen per tegel sluit het patroon dus per constructie op
// zichzelf aan. Keperverband zou dat niet doen (schuin translatierooster) en
// is daarom bewust niet gekozen; deze check legt die eis vast.
const tegelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let klinkerUV = null;
  d.wereld.traverse((kind) => {
    if (klinkerUV || kind.userData.materiaalFamilie !== 'natSteen' || !kind.geometry?.getAttribute) return;
    const uv = kind.geometry.getAttribute('uv');
    const pos = kind.geometry.getAttribute('position');
    let maxU = -Infinity, minU = Infinity, maxX = -Infinity, minX = Infinity;
    for (let i = 0; i < uv.count; i++) {
      maxU = Math.max(maxU, uv.getX(i)); minU = Math.min(minU, uv.getX(i));
      maxX = Math.max(maxX, pos.getX(i)); minX = Math.min(minX, pos.getX(i));
    }
    klinkerUV = { uvBereik: maxU - minU, wereldBereik: maxX - minX };
  });
  return {
    cellen: d.KLINKER_CELLEN,
    tegelMeters: d.KLINKER_TEGEL_METERS,
    ...klinkerUV,
  };
});
check('Het aantal cellen per klinkertegel is EVEN — vereist voor een naadloos blokverband (periode 2 cellen)',
  tegelTest.cellen % 2 === 0, tegelTest);
check(`De klinkervloer herhaalt per KLINKER_TEGEL_METERS (${tegelTest.tegelMeters}m), niet per meter — UV-bereik = wereldmaat / tegelmaat`,
  Math.abs(tegelTest.uvBereik - tegelTest.wereldBereik / tegelTest.tegelMeters) < 1e-6, tegelTest);
check('Eén klinkertegel beslaat meerdere meters (anders herhaalt het patroon zichtbaar elke meter over een plaats van 17x16m)',
  tegelTest.tegelMeters >= 3, tegelTest);

// --- 5c. De pleister-familie bestaat als grondslag voor een eventuele
// toekomstige muur-uitrol, maar wordt (nog) NERGENS door de wereldopbouw
// aangeroepen — een eerdere toepassing op de atelier-muren is op verzoek
// weer teruggedraaid naar baksteen (niet mooi genoeg bevonden), dus dit
// ticket levert alleen de tekenaar, niet de toepassing.
const pleisterTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const p = d.matFamilie('pleister', 0x2e332c);
  let inGebruik = 0;
  d.wereld.traverse((kind) => {
    if (kind.userData.materiaalFamilie === 'pleister') inGebruik++;
  });
  return { heeftMap: !!p.map, heeftRuwheid: !!p.roughnessMap, ruwheid: p.roughness, metaal: p.metalness, inGebruik };
});
check("'pleister' bestaat als volwaardige familie (map + roughnessMap, mat en niet-metallic)",
  pleisterTest.heeftMap && pleisterTest.heeftRuwheid && pleisterTest.metaal === 0 && pleisterTest.ruwheid > 0.8, pleisterTest);
check("'pleister' wordt nog NERGENS in de wereld toegepast (alleen de grondslag is gelegd)",
  pleisterTest.inGebruik === 0, pleisterTest);

// --- 6. Laadtijd-risico uit ARCHITECTURE_NOTES §10.11 ("tientallen
// milliseconden per textuur... moet gemeten worden"): alle drie de
// texturenparen samen blijven ruim onder 100ms.
// Gemeten op de ECHTE formaten die het spel gebruikt (natSteen staat op
// 1024 voor scherpe voegen op de grote binnenplaatsvloer, de rest op 512).
const tijdTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.canvasTextuurPaarCache.clear();
  const t0 = performance.now();
  for (const info of Object.values(d.MATERIAAL_FAMILIES)) {
    if (info.albedo) d.bouwCanvasTextuurPaar(info.textuur, d.CANVAS_TEXTUUR_TEKENAARS[info.textuur], info.grootte);
  }
  return performance.now() - t0;
});
check(`Alle texturenparen samen (echte formaten, albedo+afgeleide roughness) bouwen in < 100ms (gemeten: ${tijdTest.toFixed(1)}ms)`,
  tijdTest < 100, { tijdTest });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
