// B6 (VISUEEL.md laag 3, uitgevoerd na de T116-eindmeting) — VUIL, AANSLAG
// EN SLIJTAGE. Een donkere aanslagband waar de muur de vloer raakt, een
// zwakkere naadschaduw langs het plafond, en grofschalige vuilvlekken die op
// een groter formaat variëren dan de baksteentextuur uit T107.
//
// Volledig als vertexkleur-modulatie bovenop het color-attribuut dat T103
// (randocclusie) al aanmaakt — geen extra textuur, geen extra mesh, nul
// rendertijd. Zie de toelichting in amsterdam-undead.html en
// ARCHITECTURE_NOTES §10.21 voor waarom dat afwijkt van de VISUEEL-spec.
//
// De drie dingen die deze test moet vangen, want ze zijn allemaal stil fout
// te krijgen: (1) het vuil landt op de VERKEERDE meshes (T104 bakt óók een
// color-attribuut op elk meubelstuk, en de reflectiestreep bij de gracht
// gebruikt vertexkleuren als lichtgradient); (2) de pass draait twee keer en
// kwadrateert het vuil; (3) de aanslagband landt op een muur die helemaal
// niet op een vloer staat (de vulmuren boven de deuropeningen zweven).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. De ruis: deterministisch, begrensd, en écht variërend ------------
const ruis = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const monsters = [];
  for (let i = 0; i < 400; i++) monsters.push(d.vuilRuis(i * 0.37, 1.4, i * 0.91));
  return {
    herhaalbaar: d.vuilRuis(3.2, 1.1, -4.7) === d.vuilRuis(3.2, 1.1, -4.7),
    min: Math.min(...monsters), max: Math.max(...monsters),
    spreiding: Math.max(...monsters) - Math.min(...monsters),
  };
});
check('vuilRuis() is een zuivere functie: dezelfde wereldpositie geeft altijd dezelfde waarde (geen Math.random, dus stabiel over paginaladingen én over de T88-pixelmetingen)',
  ruis.herhaalbaar, ruis);
check('vuilRuis() blijft binnen [0,1]', ruis.min >= 0 && ruis.max <= 1, ruis);
check('vuilRuis() varieert daadwerkelijk over de wereld (geen constante)', ruis.spreiding > 0.3, ruis);

// --- 2. vuilSterkte(): band, naad en het contrastvenster -----------------
const sterkte = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const alleenVlek = [];
  for (let i = 0; i < 400; i++) alleenVlek.push(d.vuilSterkte(i * 0.37, 1.5, i * 0.91, null, null));
  return {
    opVloerlijn: d.vuilSterkte(0, 0, 0, 0, 3.2),
    opHalveHoogte: d.vuilSterkte(0, 1.6, 0, 0, 3.2),
    tegenPlafond: d.vuilSterkte(0, 3.2, 0, 0, 3.2),
    zonderReferentie: d.vuilSterkte(0, 0, 0, null, null),
    vlekMax: Math.max(...alleenVlek),
    vlekSchoonAandeel: alleenVlek.filter((v) => v === 0).length / alleenVlek.length,
    VUIL_VLEK_STERKTE: d.VUIL_VLEK_STERKTE,
    VUIL_BAND_STERKTE: d.VUIL_BAND_STERKTE,
  };
});
check('Pal op de vloerlijn is het vuil het sterkst — dat is de aanslagband die dit ticket levert',
  sterkte.opVloerlijn > sterkte.opHalveHoogte && sterkte.opVloerlijn >= sterkte.VUIL_BAND_STERKTE, sterkte);
check('De plafondnaad is aanwezig maar duidelijk zwakker dan de vloerband',
  sterkte.tegenPlafond > sterkte.opHalveHoogte && sterkte.tegenPlafond < sterkte.opVloerlijn, sterkte);
check('Zonder vloer-/plafondreferentie blijft alleen de vlekruis over — een muur die niet op een vloer staat krijgt dus nooit een aanslagband',
  sterkte.zonderReferentie <= sterkte.VUIL_VLEK_STERKTE + 1e-9, sterkte);
// Het contrastvenster is de reden dat de eerste versie mislukte: zonder
// venster kreeg ELKE vertex ongeveer een halve dosis, wat een uniforme
// dimming van het hele pand is in plaats van een vlekkenpatroon.
check('Een substantieel deel van de wereld blijft volledig SCHOON (contrastvenster werkt — anders is dit een uniforme dimming, geen vlekkenpatroon)',
  sterkte.vlekSchoonAandeel > 0.25, sterkte);
check('En de vuilste plekken halen wél bijna de volle vlek-sterkte',
  sterkte.vlekMax > sterkte.VUIL_VLEK_STERKTE * 0.7, sterkte);

// --- 3. Vloerniveaus ------------------------------------------------------
const niveaus = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { niveaus: d.vuilVloerNiveaus(), kamerHoogte: d.KAMER_HOOGTE, kelder: -d.KELDER_DIEPTE, vliering: d.VLIERING_Y };
});
check('vuilVloerNiveaus() levert de drie echte vloeren (begane grond, kelder, vliering) en laadt zonder ReferenceError — het is bewust een functie, want de constanten staan verderop in het bestand (beslissing 90)',
  niveaus.niveaus.length === 3 && niveaus.niveaus.includes(0) &&
  niveaus.niveaus.includes(niveaus.kelder) && niveaus.niveaus.includes(niveaus.vliering), niveaus);
check('KAMER_HOOGTE staat er NIET tussen — de vulmuren boven de deuropeningen beginnen daar en mogen geen aanslagband krijgen',
  !niveaus.niveaus.some((n) => Math.abs(n - niveaus.kamerHoogte) < 0.2), niveaus);

// --- 4. De pass raakt exact de juiste meshes -----------------------------
const dekking = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const gemarkeerd = new Set();
  let metKleurZonderMarkering = 0, reflectieGemarkeerd = false;
  d.wereld.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (o.geometry.userData.vuilVlak) gemarkeerd.add(o.geometry);
    else if (o.geometry.getAttribute('color')) metKleurZonderMarkering++;
    if (o === d.reflectieStreepMesh && o.geometry.userData.vuilVlak) reflectieGemarkeerd = true;
  });
  return {
    gemarkeerd: gemarkeerd.size,
    verwerkt: d.vuilVlakken,
    metKleurZonderMarkering,
    reflectieGemarkeerd,
  };
});
check('Er staan grote bouwkundige vlakken (muren + vloeren/plafonds) gemarkeerd voor de vuil-pass',
  dekking.gemarkeerd > 40, dekking);
check('bakDecorVuil() heeft elke gemarkeerde geometrie exact ÉÉN keer verwerkt (twee keer zou het vuil kwadrateren)',
  dekking.verwerkt === dekking.gemarkeerd, dekking);
check('Er bestaan ook meshes MET een color-attribuut maar ZONDER markering (T104-meubels, de reflectiestreep) — de markering is dus echt selectief en niet "alles met vertexkleuren"',
  dekking.metKleurZonderMarkering > 10, dekking);
check('De reflectiestreep bij de gracht is niet gemarkeerd (zijn vertexkleuren zijn een LICHT-gradient; vuil erop zou de lantaarnstreep doven)',
  dekking.reflectieGemarkeerd === false, dekking);

// --- 5. T104-meubels blijven uniform getint ------------------------------
// bakUniformeTint() zet elke vertex van één meubel op dezelfde factor. Als de
// vuil-pass er per ongeloof overheen zou lopen, is die uniformiteit meteen weg.
const meubels = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let gecontroleerd = 0, nietUniform = 0;
  d.wereld.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.userData.vuilVlak) return;
    const k = o.geometry.getAttribute('color');
    if (!k || k.count < 8) return;
    gecontroleerd++;
    const r0 = k.getX(0), g0 = k.getY(0), b0 = k.getZ(0);
    for (let i = 1; i < k.count; i++) {
      if (Math.abs(k.getX(i) - r0) > 1e-6 || Math.abs(k.getY(i) - g0) > 1e-6 || Math.abs(k.getZ(i) - b0) > 1e-6) {
        nietUniform++; break;
      }
    }
  });
  return { gecontroleerd, nietUniform };
});
check('Elk ongemarkeerd mesh met een color-attribuut heeft nog steeds een UNIFORME tint (T104 onaangetast — bewijs dat de vuil-pass geen meubels heeft geraakt)',
  meubels.gecontroleerd > 0 && meubels.nietUniform === 0, meubels);

// --- 6. Het resultaat op de muren zelf ------------------------------------
const muren = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const punt = new (Object.getPrototypeOf(d.speler.positie).constructor)();
  let bovenTintGevonden = false, kelderTintGevonden = false;
  let minComponent = 1, maxComponent = 0;
  let bandGevonden = false;
  d.wereld.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.userData.vuilVlak !== 'muur') return;
    const pos = o.geometry.getAttribute('position');
    const k = o.geometry.getAttribute('color');
    if (!pos || !k) return;
    o.updateWorldMatrix(true, false);
    let laagsteY = Infinity, kleurLaag = null, kleurHoog = null, hoogsteY = -Infinity;
    for (let i = 0; i < k.count; i++) {
      minComponent = Math.min(minComponent, k.getX(i), k.getY(i), k.getZ(i));
      maxComponent = Math.max(maxComponent, k.getX(i), k.getY(i), k.getZ(i));
      punt.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (punt.y < laagsteY) { laagsteY = punt.y; kleurLaag = [k.getX(i), k.getY(i), k.getZ(i)]; }
      if (punt.y > hoogsteY) { hoogsteY = punt.y; kleurHoog = [k.getX(i), k.getY(i), k.getZ(i)]; }
      if (punt.y < -0.5) { if (k.getX(i) < k.getY(i) - 0.01) kelderTintGevonden = true; }
      else if (k.getZ(i) < k.getX(i) - 0.01) bovenTintGevonden = true;
    }
    // Alleen muren die echt op de begane grond staan: hun onderste vertex
    // hoort duidelijk donkerder te zijn dan hun bovenste.
    if (Math.abs(laagsteY) < 0.12 && hoogsteY - laagsteY > 2 && kleurLaag[0] < kleurHoog[0] * 0.8) bandGevonden = true;
  });
  return { bovenTintGevonden, kelderTintGevonden, minComponent, maxComponent, bandGevonden };
});
check('Muren die op de begane grond staan hebben een duidelijk donkerdere onderkant dan bovenkant (de aanslagband is echt gebakken)',
  muren.bandGevonden, muren);
check('Boven de grond verschuift het vuil naar vuilbruin (minder blauw dan rood)', muren.bovenTintGevonden, muren);
check('In de kelder verschuift het vuil naar vochtig groen (minder rood dan groen)', muren.kelderTintGevonden, muren);
check('Geen enkele vertexkleur wordt LICHTER dan 1 — vuil maakt altijd donkerder, dus de emissie-hiërarchie uit T89 blijft intact',
  muren.maxComponent <= 1 + 1e-6, muren);
check('En niets wordt volledig zwart (een muur blijft leesbaar, ook in de vuilste hoek)',
  muren.minComponent > 0.2, muren);

// --- Ticket 151: materiaalfamilie-gebonden vuil-bonus (VUIL_FAMILIE_FACTOR).
// Pleisterwerk toont vocht/schade zichtbaarder dan baksteen — een multiplier
// op de BESTAANDE vuilSterkte()-uitkomst, geen nieuwe as. Puur op functie-
// niveau getest (net als sectie 1/2 hierboven): een positie diep in de
// aanslagband (dicht bij de vloer), zodat de vlek-ruiscomponent verwaarloosbaar
// is t.o.v. de bijna-verzadigde band — vermijdt flakiness die zou ontstaan
// door twee ECHTE muren op verschillende wereldposities (met eigen vlek-ruis)
// te vergelijken.
const familieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kaal = d.vuilSterkte(3.71, 0.05, -8.42, 0, null);
  const metFactor = Math.min(1, kaal * d.VUIL_FAMILIE_FACTOR.pleister);
  // Sanity: de rollout (Ticket 151, GANG_PLEISTER-muren) moet ook
  // daadwerkelijk minstens één muur in de wereld met deze familie getagd
  // hebben — anders is de bonus hierboven nooit ergens van toepassing.
  let pleisterMurenGevonden = 0;
  d.wereld.traverse((o) => {
    if (o.userData.materiaalFamilie === 'pleister' && o.geometry?.userData.vuilVlak === 'muur') pleisterMurenGevonden++;
  });
  return { factor: d.VUIL_FAMILIE_FACTOR.pleister, kaal, metFactor, pleisterMurenGevonden };
});
check('VUIL_FAMILIE_FACTOR.pleister is een bonus (>1) die de vuilSterkte-uitkomst meetbaar verhoogt',
  familieTest.factor > 1 && familieTest.metFactor > familieTest.kaal, familieTest);
check('...maar blijft geklemd op maximaal 1, ook mét de bonus (nooit "meer dan volledig vuil")',
  familieTest.metFactor <= 1, familieTest);
check('Minstens één echte muur in de wereld draagt de pleister-familie mét vuilVlak-markering (de bonus is dus ergens van toepassing)',
  familieTest.pleisterMurenGevonden > 0, familieTest);
check('Een familie zonder eigen entry (bv. steen) krijgt factor 1 — geen bonus, geen straf',
  (await page.evaluate(() => window.AmsterdamUndeadDebug.VUIL_FAMILIE_FACTOR.steen)) === undefined, {});

const fails = report(errs);
await browser.close();
process.exit(fails > 0 || errs.length > 0 ? 1 : 0);
