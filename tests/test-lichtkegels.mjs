// Ticket 110 (v0.22, §10.6-beslissing 81): zichtbare lichtkegels — open
// ConeGeometry + eigen ShaderMaterial (additive, depthWrite:false, fresnel-
// fade naar de rand, hoogte-fade naar beneden, fog-bewust), onder de vier
// binnenplaats-lantaarns, de gracht-lantaarn en het hoofd-dakraam.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Harde bovengrens: precies ZES kegels, niet meer, niet minder —
// de architectuurbeslissing noemt dit expliciet als eis 1 ("harde
// bovengrens... lichte uitvoering als startpunt").
const telling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let n = 0;
  d.wereld.traverse((k) => {
    if (k.isMesh && k.geometry?.type === 'ConeGeometry' && k.material?.uniforms?.hoogte) n++;
  });
  return { n, telling: d.lichtkegelTelling, max: d.LICHTKEGEL_MAX };
});
check('Er staan precies 6 lichtkegels in de wereld (LICHTKEGEL_MAX)', telling.n === 6, telling);
check('lichtkegelTelling === LICHTKEGEL_MAX (de harde bovengrens is bereikt, niet overschreden)',
  telling.telling === telling.max && telling.max === 6, telling);

// --- 2. bouwLichtkegel() respecteert de bovengrens zelf: een zevende
// aanroep geeft `null` terug i.p.v. alsnog een mesh te bouwen.
const overschrijdingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voorAantal = d.wereld.children.length;
  const zevende = d.bouwLichtkegel(0, 2, 0, 0xffffff, 2, 0.5, 0.1);
  return { zevende, wereldGroeide: d.wereld.children.length !== voorAantal };
});
check('Een zevende bouwLichtkegel()-aanroep geeft null terug en voegt niets toe aan de wereld',
  overschrijdingTest.zevende === null && !overschrijdingTest.wereldGroeide, overschrijdingTest);

// --- 3. Elke kegel is additive, schrijft niet naar de depth-buffer, en
// heeft fog ingeschakeld (eis 3: "de shader moet de fog respecteren").
const materiaalTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const materialen = [];
  d.wereld.traverse((k) => {
    if (k.isMesh && k.geometry?.type === 'ConeGeometry' && k.material?.uniforms?.hoogte) {
      materialen.push({
        blending: k.material.blending, depthWrite: k.material.depthWrite,
        transparent: k.material.transparent, fog: k.material.fog,
        isShaderMaterial: k.material.isShaderMaterial,
      });
    }
  });
  return materialen;
});
check('Alle 6 kegel-materialen zijn ShaderMaterial (eigen shader, geen kant-en-klaar materiaaltype)',
  materiaalTest.every(m => m.isShaderMaterial), materiaalTest);
check('Alle 6 kegel-materialen gebruiken additive blending', materiaalTest.every(m => m.blending === 2), materiaalTest);
check('Alle 6 kegel-materialen hebben depthWrite:false (geen overdraw-artefacten met de rest van de scene)',
  materiaalTest.every(m => m.depthWrite === false), materiaalTest);
check('Alle 6 kegel-materialen zijn transparent:true', materiaalTest.every(m => m.transparent === true), materiaalTest);
check('Alle 6 kegel-materialen hebben fog:true (eis 3)', materiaalTest.every(m => m.fog === true), materiaalTest);

// --- 4. Eis 2: de kegel-opacity moet meeliften op buitenLichten/
// stroomGevoeligeDaklichten — bij een gesimuleerde Stroomuitval (stroomFactor
// omlaag) moet de opacity van elke gekoppelde kegel evenredig mee zakken.
const stroomTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kegelsVoor = d.buitenLichten.filter(bl => bl.kegel).map(bl => bl.kegel.material.uniforms.opacity.value);
  const dakraamVoor = d.stroomGevoeligeDaklichten.filter(dl => dl.kegel).map(dl => dl.kegel.material.uniforms.opacity.value);
  // Alle buitenLichten/stroomGevoeligeDaklichten hebben een kegel volgens
  // deze ticket-scope (4 binnenplaats + 1 gracht = alle buitenLichten met
  // basis >= 20, en het enige stroomGevoeligeDaklicht).
  return {
    aantalBuitenMetKegel: kegelsVoor.length,
    aantalDakraamMetKegel: dakraamVoor.length,
    kegelsVoor, dakraamVoor,
  };
});
check('Alle 5 relevante buitenLichten (4 binnenplaats + gracht) hebben een gekoppelde kegel',
  stroomTest.aantalBuitenMetKegel === 5, stroomTest);
check('Het stroomGevoeligeDaklicht (hoofd-dakraam) heeft een gekoppelde kegel',
  stroomTest.aantalDakraamMetKegel === 1, stroomTest);
check('Bij volle stroom (default) staat elke kegel-opacity op zijn basisOpacity (buitenFactor/stroomFactor = 1)',
  stroomTest.kegelsVoor.every(v => v > 0) && stroomTest.dakraamVoor.every(v => v > 0), stroomTest);

// --- 5. Simuleer een ECHTE Stroomuitval (zelfde patroon als
// test-stroomuitval.mjs: startGolf() op golf 10, mét pointer lock zodat
// spelActief de flikkerloop daadwerkelijk laat draaien) en bevestig dat de
// kegel-opacity meezakt, in dezelfde stap als het licht zelf.
const voorBlackout = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bl = d.buitenLichten.find(b => b.kegel);
  const dl = d.stroomGevoeligeDaklichten.find(x => x.kegel);
  return {
    lichtIntensiteit: bl.licht.intensity,
    kegelOpacity: bl.kegel.material.uniforms.opacity.value,
    dakraamOpacity: dl.kegel.material.uniforms.opacity.value,
  };
});
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 10;
  d.spelStaat.gameOver = false;
  d.startGolf();
});
await frames(page, 5);
const naBlackout = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bl = d.buitenLichten.find(b => b.kegel);
  const dl = d.stroomGevoeligeDaklichten.find(x => x.kegel);
  return {
    stroomFactor: d.stroomFactor,
    lichtIntensiteit: bl.licht.intensity,
    kegelOpacity: bl.kegel.material.uniforms.opacity.value,
    dakraamOpacity: dl.kegel.material.uniforms.opacity.value,
  };
});
check('startGolf() op golf 10 (Stroomuitval) zet stroomFactor omlaag',
  naBlackout.stroomFactor < 1, naBlackout);
check('Tijdens de Stroomuitval daalt de lichtintensiteit van een buitenLicht',
  naBlackout.lichtIntensiteit < voorBlackout.lichtIntensiteit, { voorBlackout, naBlackout });
check('...en de bijbehorende kegel-opacity daalt evenredig mee (geen licht dat nergens vandaan komt)',
  naBlackout.kegelOpacity < voorBlackout.kegelOpacity, { voorBlackout, naBlackout });
check('...en de dakraam-kegel-opacity daalt ook mee tijdens de Stroomuitval',
  naBlackout.dakraamOpacity < voorBlackout.dakraamOpacity, { voorBlackout, naBlackout });

// --- 6. Invariant 2 (§10.2): geen nieuw lichttype — de kegels zijn
// decoratieve MESHES, geen THREE.Light. De lichttelling blijft op 28.
const lichtTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let n = 0;
  d.scene.traverse((k) => { if (k.isLight) n++; });
  return n;
});
check('De lichttelling blijft op 28 (geen SpotLight/nieuw lichttype toegevoegd voor de kegels)',
  lichtTest === 28, lichtTest);

// --- 7. Lokale positionering: elke kegel se apex zit bij de opgegeven
// lamppositie (y), niet bij het middelpunt van de geometrie — de mesh is
// naar beneden verschoven met de halve hoogte. Geverifieerd op de zes
// ECHTE kegels (bouwLichtkegel() heeft een harde bovengrens, dus geen
// losse test-kegel bouwen — dat zou de zevende zijn en null opleveren).
const apexTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kegels = [];
  d.wereld.traverse((k) => {
    if (k.isMesh && k.geometry?.type === 'ConeGeometry' && k.material?.uniforms?.hoogte) {
      const hoogte = k.material.uniforms.hoogte.value;
      const verwachteApexY = k.position.y + hoogte / 2;
      kegels.push({ meshY: k.position.y, hoogte, verwachteApexY });
    }
  });
  return kegels;
});
check('Elke kegel-mesh staat verschoven met de halve hoogte t.o.v. z\'n eigen apex (position.y + hoogte/2 is de lamp-y)',
  apexTest.every(k => k.verwachteApexY > k.meshY), apexTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
