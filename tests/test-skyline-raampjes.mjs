// Ticket 113 (v0.22, §10.13-beslissing 88): verlichte raampjes in de verte
// — kleine emissieve vlakjes op T112's skylinesilhouetten, Accent-tier
// (blijft ruim onder de bloom-threshold 0,82), kleur uit
// PALET.raamWarmAmber/raamWarmZacht, zeer trage aan/uit-wissels, en
// volledig uit tijdens een Stroomuitval.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Structuur: elk raampje is een klein, transparant PlaneGeometry-
// vlak met een EIGEN materiaal (niet gedeeld — elk raampje animeert zijn
// eigen opacity onafhankelijk), fog:false, geen depthWrite, kleur uit het
// bestaande PALET.
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ramen = [];
  d.wereld.traverse((k) => {
    if (k.userData?.skylineRaam) {
      ramen.push({
        geometryType: k.geometry.type,
        isBasicMaterial: k.material.isMeshBasicMaterial,
        transparent: k.material.transparent,
        depthWrite: k.material.depthWrite,
        fog: k.material.fog,
        kleur: k.material.color.getHex(),
        basis: k.userData.raampjeBasis,
        fase: k.userData.raampjeFase,
      });
    }
  });
  return { ramen, raamWarmAmber: d.PALET.raamWarmAmber, raamWarmZacht: d.PALET.raamWarmZacht };
});
check('Er staan raampjes in de wereld (het budget levert een niet-triviaal aantal op, niet 0)',
  structuur.ramen.length > 10, structuur.ramen.length);
check('Elk raampje is een PlaneGeometry', structuur.ramen.every(r => r.geometryType === 'PlaneGeometry'), structuur.ramen.length);
check('Elk raampje heeft MeshBasicMaterial (geen lichtrespons)', structuur.ramen.every(r => r.isBasicMaterial), structuur.ramen.length);
check('Elk raampje is transparent:true met depthWrite:false', structuur.ramen.every(r => r.transparent && r.depthWrite === false), structuur.ramen.length);
check('Elk raampje heeft fog:false (zelfde afweging als de dome/skyline-romp)', structuur.ramen.every(r => r.fog === false), structuur.ramen.length);
check('Elk raampje heeft een van de twee PALET-warmtinten (raamWarmAmber/raamWarmZacht)',
  structuur.ramen.every(r => r.kleur === structuur.raamWarmAmber || r.kleur === structuur.raamWarmZacht), { kleuren: [...new Set(structuur.ramen.map(r => r.kleur))] });

// --- 2. Materiaal-onafhankelijkheid: GEEN twee raampjes delen hetzelfde
// materiaal-object (in tegenstelling tot de romp/het dak van T112, die WEL
// gedeeld materiaal gebruiken) — nodig omdat elk raampje zijn eigen
// opacity-animatie heeft.
const materiaalUniekTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const materialen = new Set();
  let totaal = 0;
  d.wereld.traverse((k) => { if (k.userData?.skylineRaam) { materialen.add(k.material); totaal++; } });
  return { uniek: materialen.size, totaal };
});
check('Elk raampje heeft een eigen, uniek materiaal-object (geen gedeeld materiaal zoals bij de romp)',
  materiaalUniekTest.uniek === materiaalUniekTest.totaal, materiaalUniekTest);

// --- 3. Emissieve hiërarchie / bloom-veiligheid (§10.5): de basis-opacity
// blijft in een bescheiden bereik dat, gecomponeerd tegen een donkere
// silhouetgevel, ruim onder de bloom-threshold (0,82 luminantie) blijft —
// een "Accent"-achtig, nooit-gloeiend accent.
const opacityTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bases = [];
  d.wereld.traverse((k) => { if (k.userData?.skylineRaam) bases.push(k.userData.raampjeBasis); });
  return bases;
});
check('Alle basis-opacities liggen in een bescheiden bereik (0,2-0,45) — subtiel accent, geen fel signaal',
  opacityTest.every(b => b >= 0.2 && b <= 0.45), opacityTest);

// --- 4. updateSkylineRaampjes(klok, stroomFactor): bij volle stroom
// (stroomFactor=1) staat een raampje met een positieve sin-fase op zijn
// basis-opacity; bij de Stroomuitval-vloer (stroomFactor=STROOMUITVAL_DIM_FACTOR)
// staat ELK raampje op opacity 0 — geen vloer, in tegenstelling tot de
// buitenLichten van het eigen pand (eis: "je ziet dat het niet alleen
// jouw pand is").
const stroomTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateSkylineRaampjes(0, 1);
  const volleStroom = [];
  d.wereld.traverse((k) => { if (k.userData?.skylineRaam) volleStroom.push(k.material.opacity); });
  d.updateSkylineRaampjes(0, d.STROOMUITVAL_DIM_FACTOR);
  const blackout = [];
  d.wereld.traverse((k) => { if (k.userData?.skylineRaam) blackout.push(k.material.opacity); });
  // Terug naar volle stroom, netjes voor de rest van de test.
  d.updateSkylineRaampjes(0, 1);
  return {
    aantalAanBijVolleStroom: volleStroom.filter(o => o > 0).length,
    aantalAanBijBlackout: blackout.filter(o => o > 0).length,
    totaal: volleStroom.length,
  };
});
check('Bij volle stroom staat minstens één (maar niet elk) raampje aan (positieve sin-fase, natuurlijke variatie)',
  stroomTest.aantalAanBijVolleStroom > 0 && stroomTest.aantalAanBijVolleStroom < stroomTest.totaal, stroomTest);
check('Bij de Stroomuitval-vloer (STROOMUITVAL_DIM_FACTOR) staat ELK raampje op opacity 0 — geen vloer, allemaal uit',
  stroomTest.aantalAanBijBlackout === 0, stroomTest);

// --- 5. Determinisme: dezelfde klok-waarde geeft altijd dezelfde
// aan/uit-toestand (elk raampje heeft een vaste, deterministische fase),
// en `klok` bevriest tijdens pauze/measurement — zelfde patroon als T111.
const determinismeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateSkylineRaampjes(123.4, 1);
  const meting1 = [];
  d.wereld.traverse((k) => { if (k.userData?.skylineRaam) meting1.push(k.material.opacity); });
  d.updateSkylineRaampjes(123.4, 1);
  const meting2 = [];
  d.wereld.traverse((k) => { if (k.userData?.skylineRaam) meting2.push(k.material.opacity); });
  d.updateSkylineRaampjes(0, 1);   // terug naar de standaardstand
  return meting1.every((v, i) => v === meting2[i]);
});
check('Dezelfde klok-waarde geeft bit-voor-bit dezelfde raampjes-opacities (deterministisch, geen Math.random() per frame)',
  determinismeTest, determinismeTest);

// --- 6. Zes echte frames zonder pageerror (dezelfde proactieve check als
// na elke nieuwe geanimeerde toevoeging deze ronde).
await frames(page, 6);
check('Zes echte frames met de raampjes actief geven geen enkele pageerror', errs.length === 0, { fouten: errs.slice() });

// --- 7. Geen enkel raampje is een obstakel, interactiepunt of licht: puur
// decoratief.
const invarianten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0;
  d.scene.traverse((k) => { if (k.isLight) lichten++; });
  return { obstakels: d.obstakels.length, interactiePunten: d.interactiePunten.length, lichten };
});
check('obstakels.length blijft 58 (T131-baseline)', invarianten.obstakels === 58, invarianten);
check('interactiePunten.length blijft 14 (Ticket 134: AMSTEL-9)', invarianten.interactiePunten === 14, invarianten);
check('Lichttelling blijft op 28 (de raampjes zijn geen lichtbron, puur materiaal-opacity)', invarianten.lichten === 28, invarianten);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
