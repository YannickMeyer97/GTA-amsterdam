// Ticket 102/103 (v0.22, §10.7-beslissing 82): subdivisie + ingebakken
// hoekocclusie voor grote vlakken (muren/vloeren/plafonds). Twee losse
// mechanismen die hier samen getest worden omdat T103 zonder T102's
// subdivisie geen vloeiende gradient zou kunnen bakken.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Er bestaat minstens één occlusie-gebakken wereldmesh (vertexColors
// + een color-attribuut) — het minimale bewijs dat blok()/vlak() de nieuwe
// machinery daadwerkelijk aanroepen, niet alleen dat de functies bestaan.
const tweelingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let occlusieMesh = null;
  d.wereld.traverse(kind => {
    if (occlusieMesh) return;
    if (kind.isMesh && kind.material.vertexColors === true && kind.geometry.getAttribute('color')) occlusieMesh = kind;
  });
  return {
    heeftOcclusieMesh: !!occlusieMesh,
    materiaalHeeftVertexColors: occlusieMesh ? occlusieMesh.material.vertexColors === true : null,
    materiaalHeeftKleurAttribuut: occlusieMesh ? !!occlusieMesh.geometry.getAttribute('color') : null,
  };
});
check('Er bestaat minstens één wereldmesh met vertexColors:true én een color-attribuut (een occlusie-gebakken vlak)',
  tweelingTest.heeftOcclusieMesh && tweelingTest.materiaalHeeftVertexColors && tweelingTest.materiaalHeeftKleurAttribuut, tweelingTest);

// --- 2. matMetVertexKleur() zelf: gecachete tweeling per basismateriaal,
// origineel blijft ongemoeid (geen vertexColors op het gedeelde origineel)
const cacheTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const basis = d.matFamilie('steen', 0x111111);
  const basisVoorVertexColors = basis.vertexColors;
  const tweelingA = d.matMetVertexKleur(basis);
  const tweelingB = d.matMetVertexKleur(basis);
  return {
    basisVoorVertexColors,           // moet false zijn: origineel niet gemuteerd
    basisNaVertexColors: basis.vertexColors,   // moet ook nog steeds false zijn
    tweelingIsAndersDanBasis: tweelingA !== basis,
    tweelingIsGecached: tweelingA === tweelingB,   // zelfde basismateriaal -> zelfde tweeling
    tweelingHeeftVertexColors: tweelingA.vertexColors === true,
  };
});
check('matMetVertexKleur() muteert het gedeelde basismateriaal nooit (vertexColors blijft false op het origineel)',
  cacheTest.basisVoorVertexColors === false && cacheTest.basisNaVertexColors === false, cacheTest);
check('matMetVertexKleur() geeft een ANDER object terug dan de basis (een tweeling, geen mutatie)',
  cacheTest.tweelingIsAndersDanBasis, cacheTest);
check('matMetVertexKleur() cachet: hetzelfde basismateriaal geeft dezelfde tweeling terug',
  cacheTest.tweelingIsGecached, cacheTest);
check('De tweeling zelf heeft vertexColors:true',
  cacheTest.tweelingHeeftVertexColors, cacheTest);

// --- 3. Bronvorm: bakMuurOcclusie() gebruikt UITSLUITEND de Y-component —
// nooit X of Z. Dit is de structurele garantie achter het "geen deurgat mag
// dichtsmeren"-ontwerp (§10.7): een muur se occlusie hangt alleen af van de
// afstand tot vloer/plafond, nooit van de afstand tot de linker/rechter rand
// (waar een deuropening zou kunnen zitten).
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    muurBron: d.bakMuurOcclusie.toString(),
    vlakBron: d.bakVlakOcclusie.toString(),
  };
});
check('bakMuurOcclusie() leest alleen pos.getY() — nooit getX()/getZ() (geen horizontale/zijkant-occlusie op muren)',
  /pos\.getY/.test(bronTest.muurBron) && !/pos\.getX/.test(bronTest.muurBron) && !/pos\.getZ/.test(bronTest.muurBron),
  bronTest);
check('bakVlakOcclusie() gebruikt zowel X als Y (alle vier de randen van vloer/plafond mogen wél meedoen)',
  /pos\.getX/.test(bronTest.vlakBron) && /pos\.getY/.test(bronTest.vlakBron), bronTest);

// --- 4. occlusieFactor(): grenswaarden. Op de rand zelf (afstand 0) het
// donkerste punt, ruim voorbij OCCLUSIE_BEREIK weer volledig 1 (geen effect).
const factorTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    opDeRand: d.occlusieFactor(0),
    ruimVoorbij: d.occlusieFactor(d.OCCLUSIE_BEREIK * 5),
    negatieveAfstandGeklemd: d.occlusieFactor(-1),   // moet hetzelfde zijn als 0 (Math.max(0, ...))
    sterkte: d.OCCLUSIE_STERKTE,
  };
});
check('occlusieFactor(0) (pal op de rand) is exact 1 - OCCLUSIE_STERKTE (het donkerste punt)',
  Math.abs(factorTest.opDeRand - (1 - factorTest.sterkte)) < 1e-6, factorTest);
check('occlusieFactor() ruim voorbij OCCLUSIE_BEREIK is weer volledig 1 (geen effect meer)',
  Math.abs(factorTest.ruimVoorbij - 1) < 1e-6, factorTest);
check('occlusieFactor() klemt een negatieve afstand naar 0 (geen crash, geen waarde > het randmaximum)',
  Math.abs(factorTest.negatieveAfstandGeklemd - factorTest.opDeRand) < 1e-6, factorTest);

// --- 5. Structureel bewijs: DIRECT NA het bouwen (vóór B6's vuil-pass) is
// elke muur/vloer/plafond-mesh die door blok()/vlak() met occlusie is
// gebouwd grijswaarde (R===G===B op elke vertex) — nooit een tint, net als
// T101's eerdere invariant voor de ondode-huid.
//
// B6 (vuil en slijtage, ná dit ticket) moduleert diezelfde color-attributen
// met een tintverschuiving (vuilbruin boven de grond, vochtig groen in de
// kelder) — een BEWUSTE, gedocumenteerde uitbreiding van dit contract, geen
// regressie. Deze test bewaakt daarom bakMuurOcclusie()/bakVlakOcclusie()
// zelf, geïsoleerd, met een verse geometrie — niet de staat van de wereld ná
// de volledige opbouw (die grijswaarde-eis is verhuisd naar
// test-vuil-slijtage.mjs, dat toetst dat SCHONE plekken exact 1 blijven en
// dat vuile plekken alleen richting de gedefinieerde tinten verschuiven).
const grijswaardeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Verse aanroepen ná het laden: blok()/vlak() voegen toe aan `wereld`, maar
  // B6's bakDecorVuil() draait precies ÉÉN keer, tijdens de wereldopbouw zelf
  // — dus deze twee nieuwe meshes bestonden op dat moment nog niet en kregen
  // (net als elk ander object dat een test achteraf toevoegt) nooit een
  // vuil-modulatie. Daarmee test dit precies de bakfuncties zelf, geïsoleerd
  // van B6, zonder de geometrie-constructie hier te dupliceren.
  const { segX, segZ } = d.muurSegmenten(2, 0.3);
  const muur = d.blok(2, 3, 0.3, 0xffffff, 0.9, 0, segX, d.SUBDIVISIE_SEGMENTEN, segZ, true);
  const vlak = d.vlak(0xffffff, 4, 5, 0, 0, 0, false);
  let gecontroleerd = 0, nietGrijs = 0;
  for (const geo of [muur.geometry, vlak.geometry]) {
    const kleur = geo.getAttribute('color');
    for (let i = 0; i < kleur.count; i++) {
      gecontroleerd++;
      const r = kleur.getX(i), g = kleur.getY(i), b = kleur.getZ(i);
      if (Math.abs(r - g) > 1e-6 || Math.abs(g - b) > 1e-6) nietGrijs++;
    }
  }
  return { gecontroleerd, nietGrijs };
});
check('Direct na bakMuurOcclusie()/bakVlakOcclusie() (vóór B6\'s vuil-pass) is de vertexkleur grijswaarde (R=G=B) op elke vertex',
  grijswaardeTest.gecontroleerd > 0 && grijswaardeTest.nietGrijs === 0, grijswaardeTest);

// --- 6. Geen enkele geometrie/collision-wijziging: obstakels.length en de
// vertrouwde geometrie-invarianten blijven exact zoals vóór T102/T103.
const obstakelsTest = await page.evaluate(() => window.AmsterdamUndeadDebug.obstakels.length);
check('obstakels.length blijft 56 (T102/T103 raken alleen visuele geometrie/materiaal, nooit collision)',
  obstakelsTest === 56, { obstakelsTest });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
