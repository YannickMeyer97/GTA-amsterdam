// Ticket 91 (v0.22, §10.7-beslissing 82): contactschaduwen onder elk
// vrijstaand decor-object (tafel, kratten, vat, lantaarnpaal) — één gedeelde
// radiale gradient-textuur op één gedeelde vlak-geometrie, puur
// MeshBasicMaterial (geen lichtberekening). Puur decoratief: geen nieuwe
// obstakels, geen nieuwe lichten, geen wijziging aan berekenVloerY() zelf.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Structuur: gedeelde textuur + gedeelde geometrie -------------------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const schaduwen = [];
  d.scene.traverse(o => { if (o.userData && o.userData.contactschaduw) schaduwen.push(o); });
  const geometrieen = new Set(schaduwen.map(s => s.geometry));
  const materialen = new Set(schaduwen.map(s => s.material));
  return {
    aantal: schaduwen.length,
    aantalGeometrieen: geometrieen.size,
    aantalMaterialen: materialen.size,
    zelfdeAlsDebugGeo: schaduwen.every(s => s.geometry === d.CONTACTSCHADUW_GEO),
    zelfdeAlsDebugMat: schaduwen.every(s => s.material === d.CONTACTSCHADUW_MAT),
    isPlaneAchtig: schaduwen.every(s => s.geometry.type === 'CircleGeometry'),
    heeftTextuur: schaduwen.every(s => s.material.map != null),
  };
});
check('Er staan meerdere contactschaduwen in de scene (tafel + 3x kratten + 3x vat + 4x lantaarnpaal = 11)',
  structuur.aantal === 11, structuur);
check('Alle contactschaduwen delen exact ÉÉN geometrie-instantie',
  structuur.aantalGeometrieen === 1 && structuur.zelfdeAlsDebugGeo, structuur);
check('Alle contactschaduwen delen exact ÉÉN materiaal-instantie (dus ook één gedeelde textuur)',
  structuur.aantalMaterialen === 1 && structuur.zelfdeAlsDebugMat, structuur);
check('De gedeelde geometrie is een CircleGeometry (vlak, geen 3D-vorm)',
  structuur.isPlaneAchtig, structuur);
check('Het gedeelde materiaal heeft een textuur (de radiale gradient)',
  structuur.heeftTextuur, structuur);

// --- 2. Geen nieuwe obstakels, geen nieuwe lichten --------------------------
const invarianten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0;
  d.scene.traverse(o => { if (o.isLight) lichten++; });
  return { obstakels: d.obstakels.length, lichten };
});
check('obstakels.length blijft exact 58 (T131-baseline; contactschaduwen zijn puur decor, geen collision)',
  invarianten.obstakels === 58, invarianten);
check('Lichtaantal blijft 28 (geen nieuw licht toegevoegd door dit ticket)',
  invarianten.lichten === 28, invarianten);

// --- 3. Elke schaduw staat op de juiste vloerhoogte (berekenVloerY) --------
const hoogtes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const schaduwen = [];
  d.scene.traverse(o => { if (o.userData && o.userData.contactschaduw) schaduwen.push(o); });
  return schaduwen.map(s => {
    const groep = s.parent;   // bouwContactschaduw() zet x/y/z op de omhullende Group
    const verwacht = d.berekenVloerY(groep.position.x, groep.position.z) + d.CONTACTSCHADUW_Y_OFFSET;
    return { x: groep.position.x, z: groep.position.z, y: groep.position.y, verwacht };
  });
});
check('Elke contactschaduw staat precies op berekenVloerY(x, z) + CONTACTSCHADUW_Y_OFFSET',
  hoogtes.every(h => Math.abs(h.y - h.verwacht) < 1e-9), hoogtes);
check('Geen enkele contactschaduw staat op een negatieve (kelder-)hoogte — alle vier de aanroepers liggen op vlakke begane-grondvloeren',
  hoogtes.every(h => h.y >= 0), hoogtes);

// --- 4. bouwContactschaduw() rechtstreeks: schaal en rotatie ---------------
const directeAanroep = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const groep = d.bouwContactschaduw(1.23, -4.56, 0.6, 0.35, Math.PI / 3);
  const vlak = groep.children[0];
  return {
    positie: { x: groep.position.x, y: groep.position.y, z: groep.position.z },
    rotatieY: groep.rotation.y,
    vlakRotatieX: vlak.rotation.x,
    schaal: { x: vlak.scale.x, y: vlak.scale.y },
    verwachtY: d.berekenVloerY(1.23, -4.56) + d.CONTACTSCHADUW_Y_OFFSET,
  };
});
check('bouwContactschaduw(x,z,straalX,straalZ,rotY): positie x/z klopt en y volgt berekenVloerY()',
  directeAanroep.positie.x === 1.23 && directeAanroep.positie.z === -4.56 &&
  Math.abs(directeAanroep.positie.y - directeAanroep.verwachtY) < 1e-9, directeAanroep);
check('rotY wordt toegepast op de omhullende Group (niet op het vlak zelf)',
  directeAanroep.rotatieY === Math.PI / 3, directeAanroep);
check('Het vlak zelf ligt plat (rotation.x = -π/2)',
  Math.abs(directeAanroep.vlakRotatieX + Math.PI / 2) < 1e-9, directeAanroep);
check('straalX/straalZ komen terug als scale.x/scale.y op het vlak (elliptische schaduw)',
  directeAanroep.schaal.x === 0.6 && directeAanroep.schaal.y === 0.35, directeAanroep);

// --- 5. straalZ is optioneel (default = straalX): cirkelvormige schaduw ---
const cirkelvormig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const groep = d.bouwContactschaduw(0, 0, 0.4);
  const vlak = groep.children[0];
  return { x: vlak.scale.x, y: vlak.scale.y };
});
check('Zonder straalZ-argument is de schaduw een cirkel (scale.x === scale.y)',
  cirkelvormig.x === 0.4 && cirkelvormig.y === 0.4, cirkelvormig);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
