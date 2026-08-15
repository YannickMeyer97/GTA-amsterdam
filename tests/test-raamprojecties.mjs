// Ticket 109 (v0.22, §10.6-beslissing 80): raamprojecties — "licht neemt de
// vorm van zijn opening aan" op de vlakke vloer onder elk dakraam en elk
// gevelraam, dezelfde soort quad als de bestaande lantaarn-lichtvlek maar
// met een canvas-getekend kozijnpatroon i.p.v. een egale cirkel.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Precies 10 projecties: 2 woonkamer + 3 atelier-gevelramen (NW,
// Oost, Nis) + 1 bijkeuken-steegdeur + 4 atelier-dakramen. VENSTERS_PLAATS
// (binnenplaats) is bewust uitgesloten: dat zijn poort-/kelderdeur-
// doorgangen, geen glazen ramen.
const telling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let n = 0;
  const posities = [];
  d.wereld.traverse((k) => {
    if (k.isMesh && k.material?.map === d.raamProjectieTextuur) {
      n++;
      posities.push({ x: +k.position.x.toFixed(2), y: +k.position.y.toFixed(3), z: +k.position.z.toFixed(2) });
    }
  });
  return { n, posities };
});
check('Er staan precies 10 raamprojecties in de wereld (6 gevelramen: 2 woonkamer + 3 atelier + 1 bijkeuken, plus 4 atelier-dakramen)',
  telling.n === 10, telling);

// --- 2. Alle projecties liggen op vloerhoogte (y ≈ 0,012, zelfde offset
// als de bestaande lichtvlek — voorkomt z-fighting met de vloer).
const yTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ys = [];
  d.wereld.traverse((k) => {
    if (k.isMesh && k.material?.map === d.raamProjectieTextuur) ys.push(k.position.y);
  });
  return ys;
});
check('Alle raamprojecties liggen exact op y = 0,012 (dezelfde vloeroffset als de lantaarn-lichtvlek)',
  yTest.every(y => Math.abs(y - 0.012) < 1e-9), yTest);

// --- 3. Gevelraam-projecties liggen INGEDEEPT vanaf hun raam (RAAM_PROJECTIE_INSET),
// niet op de muur zelf — bewijst dat de richting/inset-logica daadwerkelijk werkt.
const insetTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Woonkamerraam op x=-2, HALF_DIEPTE (zuidmuur) — projectie moet op
  // z = HALF_DIEPTE - RAAM_PROJECTIE_INSET liggen (de kamer in).
  let gevonden = null;
  d.wereld.traverse((k) => {
    if (gevonden) return;
    if (k.isMesh && k.material?.map === d.raamProjectieTextuur &&
        Math.abs(k.position.x - (-2)) < 0.01) {
      gevonden = k.position.z;
    }
  });
  return { z: gevonden, verwacht: d.HALF_DIEPTE - d.RAAM_PROJECTIE_INSET };
});
check('De woonkamerraam-projectie (x=-2) ligt op de verwachte, ingedeepte z-positie (de kamer in, niet op de muur)',
  Math.abs(insetTest.z - insetTest.verwacht) < 0.01, insetTest);

// --- 4. Dakraam-projecties liggen PAL onder hun dakraam (geen inset — het
// licht valt recht naar beneden), en zijn groter dan de dakraam-opening
// zelf (spreiding tijdens de val).
const dakraamTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let gevonden = null;
  d.wereld.traverse((k) => {
    if (gevonden) return;
    // Het hoofd-dakraam staat op (0, ATELIER_HOOGTE-0.02, ATELIER_MIDDEN_Z),
    // grootte 1.8x1.8 -> projectie 1.8*1.35 = 2.43.
    if (k.isMesh && k.material?.map === d.raamProjectieTextuur &&
        Math.abs(k.position.x) < 0.01 && Math.abs(k.geometry.parameters.width - 2.43) < 0.01) {
      gevonden = { x: k.position.x, z: k.position.z };
    }
  });
  return { gevonden, verwachtZ: d.ATELIER_MIDDEN_Z };
});
check('De hoofd-dakraamprojectie ligt exact onder het dakraam (x=0, z=ATELIER_MIDDEN_Z) — geen inset',
  dakraamTest.gevonden && Math.abs(dakraamTest.gevonden.z - dakraamTest.verwachtZ) < 0.01, dakraamTest);

// --- 5. Alle raamprojecties zijn transparant, schrijven niet naar de
// depth-buffer (kunnen dus nooit een echt object "voor" doen lijken) en
// gebruiken hetzelfde gedeelde patroon-object (één canvas, niet 10 aparte
// — dezelfde efficiëntie-eis als de bestaande texture-caches).
const materiaalTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const materialen = [];
  d.wereld.traverse((k) => {
    if (k.isMesh && k.material?.map === d.raamProjectieTextuur) {
      materialen.push({ transparent: k.material.transparent, depthWrite: k.material.depthWrite, side: k.material.side });
    }
  });
  return materialen;
});
check('Alle 10 raamprojecties zijn transparant met depthWrite:false (zelfde als de lichtvlek-conventie)',
  materiaalTest.every(m => m.transparent === true && m.depthWrite === false), materiaalTest);
check('Alle 10 raamprojecties delen hetzelfde patroon-canvas (bouwRaamProjectiePatroon() cachet en bouwt maar één keer)',
  materiaalTest.length === 10, materiaalTest);

// --- 6. Geen enkele projectie is een obstakel of interactiepunt: puur
// decoratief, geen invloed op collision/gameplay (obstakel-telling ongewijzigd
// t.o.v. de bestaande, vastgelegde bandbreedte).
const obstakelTest = await page.evaluate(() => window.AmsterdamUndeadDebug.obstakels.length);
check('Obstakel-telling blijft in de bestaande bandbreedte (20-58): raamprojecties zijn geen collision-decor',
  obstakelTest >= 20 && obstakelTest <= 58, obstakelTest);

// --- 7. Bewust GEEN SpotLight.map (gobo) — dat zou invariant 2 (§10.2, het
// vastgelegde lichttype-repertoire) breken. De raamprojecties zijn allemaal
// MeshBasicMaterial-quads, geen lichten.
const lichtTypeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let spotlights = 0;
  d.scene.traverse((k) => { if (k.isSpotLight) spotlights++; });
  return spotlights;
});
check('Er is geen enkele SpotLight in de scene toegevoegd (geen gobo-route, blijft bij de statische quad-projectie)',
  lichtTypeTest === 0, lichtTypeTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
