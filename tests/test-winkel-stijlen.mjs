// Winkel W2 (Ticket 36): winkelstijl-register + functie-iconen. Bewaakt:
// alle 11 markeringen bestaan met de juiste kinderen-inventaris (ring +
// icoon-meshes), gedeelde geometrie-cache met EIGEN materials per instantie,
// uniciteit van de (categorie->icoon+kleur)-mapping (behalve het bewust
// gedeelde deur-silhouet), doofMarkering() blijft ring+icoon doven, en het
// kopen van deur 1 verwijdert zijn markering nog steeds.
// Feedback: het Provisiekast-munitiepunt (dat het ammo-silhouet bewust
// deelde) is verwijderd — 12 markeringen/13 stijlen -> 11/12, en de
// munitie-categorie is nu een gewone singleton, net als de meeste andere.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Alle 12 winkelmarkeringen zijn gebouwd, ring + icoon-kinderen -----
const opbouw = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    aantal: d.winkelMarkeringen.length,
    perGroep: d.winkelMarkeringen.map(g => ({
      totaalKinderen: g.children.length,
      // Eerste kind is altijd de vloerring (RingGeometry); de rest is icoon.
      isRingEerst: g.children[0].geometry.type === 'RingGeometry',
    })),
  };
});
check('Er zijn precies 14 winkelmarkeringen gebouwd (één per interactiepunt, incl. deur5, deur6/kelderoost, De Zelflader en — Ticket 134 — de AMSTEL-9)',
  opbouw.aantal === 14, opbouw);
check('Elke markering heeft 2 of 3 kinderen: 1 ring + 1-2 icoon-meshes (budget <= 3 meshes)',
  opbouw.perGroep.every(g => g.totaalKinderen === 2 || g.totaalKinderen === 3), opbouw);
check('Bij elke markering is het eerste kind de vloerring',
  opbouw.perGroep.every(g => g.isRingEerst), opbouw);
check('Precies 1 markering (de Ratelaar-tandwiel) heeft maar 2 kinderen (ring + 1 torus-icoon)',
  opbouw.perGroep.filter(g => g.totaalKinderen === 2).length === 1, opbouw);

// --- 2. WINKEL_STIJLEN: gedeelde geometrie-cache + eigen material per keer -
const stijlInventaris = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const namen = Object.keys(d.WINKEL_STIJLEN);
  const uit = {};
  for (const naam of namen) {
    const container1 = new d.scene.constructor();
    d.WINKEL_STIJLEN[naam].bouwIcoon(container1);
    const container2 = new d.scene.constructor();
    d.WINKEL_STIJLEN[naam].bouwIcoon(container2);
    uit[naam] = {
      kleur: d.WINKEL_STIJLEN[naam].kleur,
      aantalMeshes: container1.children.length,
      geometrieSignatuur: container1.children.map(c => c.geometry.uuid).sort().join(','),
      // Zelfde stijl 2x gebouwd: geometrie moet HERGEBRUIKT zijn (gelijke
      // uuid's), material moet elke keer NIEUW zijn (verschillende uuid's).
      geometrieHergebruikt: container1.children.every((c, i) => c.geometry.uuid === container2.children[i].geometry.uuid),
      materialAltijdNieuw: container1.children.every((c, i) => c.material.uuid !== container2.children[i].material.uuid),
    };
  }
  return uit;
});
const stijlNamen = Object.keys(stijlInventaris);
check('Er staan 15 stijlen in WINKEL_STIJLEN (14 statische interactiepunten, incl. deur5, deur6, De Zelflader en — Ticket 134 — de AMSTEL-9, + de gedeelde Ticket-44-vluchtroutestijl)',
  stijlNamen.length === 15, stijlInventaris);
check('Voor elke stijl is de icoon-geometrie hergebruikt tussen twee bouwIcoon()-aanroepen (gedeelde cache)',
  stijlNamen.every(n => stijlInventaris[n].geometrieHergebruikt), stijlInventaris);
check('Voor elke stijl krijgt elke bouwIcoon()-aanroep verse materials (geen materiaal-cache, blijft doofbaar)',
  stijlNamen.every(n => stijlInventaris[n].materialAltijdNieuw), stijlInventaris);

// --- 3. Uniciteit: geen twee VERSCHILLENDE functiecategorieën delen zowel
// hetzelfde silhouet als dezelfde kleur (ontwerpbeslissing 29) -------------
// Feedback: de munitieGroep (ammo + provisiekast) is vervallen — ammo is nu
// een gewone singleton-categorie, net als werkbank/pantserdrank/etc.
const deurGroep = ['deur1', 'deur2', 'deur3', 'deur4', 'deur5', 'deur6'];   // deur5/deur6 hergebruiken bewust hetzelfde sleutel-silhouet
const verwachteGedeeldeSets = [deurGroep];
const signatuurGroepen = {};
for (const naam of stijlNamen) {
  const sig = stijlInventaris[naam].geometrieSignatuur + '|' + stijlInventaris[naam].kleur;
  (signatuurGroepen[sig] ??= []).push(naam);
}
// Een gevonden groep is verwacht/onschuldig zodra AL zijn leden uit
// DEZELFDE functiecategorie-set komen (bv. deur2+deur3 delen toevallig ook
// nog de kleur, bovenop hun gedeelde silhouet — dat blijft prima, het zijn
// geen VERSCHILLENDE categorieën). Alleen een groep die leden uit
// verschillende categorieën mengt (of een singleton buiten elke bekende
// set) is een echte, onbedoelde overlap.
const onverwachteOverlap = Object.values(signatuurGroepen).filter(groep => {
  if (groep.length <= 1) return false;
  return !verwachteGedeeldeSets.some(verwacht => groep.every(n => verwacht.includes(n)));
});
check('Alle zes de deuren delen bewust hetzelfde sleutel-silhouet',
  deurGroep.every(n => stijlInventaris[n].geometrieSignatuur === stijlInventaris.deur1.geometrieSignatuur), stijlInventaris);
check('Geen enkele ONVERWACHTE overlap: geen twee andere stijlen delen zowel silhouet als kleur',
  onverwachteOverlap.length === 0, { onverwachteOverlap, signatuurGroepen });
check('Pantserdrank heeft de nieuwe, van watertap onderscheiden kleur (0xb8c8ff, weg van watertap-blauw)',
  stijlInventaris.pantserdrank.kleur === 0xb8c8ff, stijlInventaris.pantserdrank);
check('Watertap heeft zijn eigen kleur (0x54c8e8), niet meer gelijk aan de ammo-kist',
  stijlInventaris.watertap.kleur === 0x54c8e8 && stijlInventaris.watertap.kleur !== stijlInventaris.ammo.kleur, stijlInventaris);

// --- 4. doofMarkering() dooft nog steeds ring EN icoon van een echte,
// live-gebouwde markering --------------------------------------------------
const doofTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.werkbankMarkering.children.map(c => ({
    kleur: c.material.color?.getHex(), emissive: c.material.emissive?.getHex(), opacity: c.material.opacity,
  }));
  d.doofMarkering(d.werkbankMarkering);
  const na = d.werkbankMarkering.children.map(c => ({
    kleur: c.material.color?.getHex(), emissive: c.material.emissive?.getHex(), opacity: c.material.opacity,
  }));
  return { voor, na };
});
check('doofMarkering() zet ELK kind (ring + beide icoon-meshes) naar grijs/gedoofd',
  doofTest.na.every(c => c.kleur === 0x555555 && (c.emissive === undefined || c.emissive === 0x000000)), doofTest);
check('De markering had vóór het doven nog de eigen kleur (niet al grijs)',
  doofTest.voor.some(c => c.kleur !== 0x555555), doofTest);

// --- 5. Deur 1 kopen verwijdert zijn markering nog steeds uit de scene ----
const deurKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  const voorParent = d.deurMarkering.parent !== null;
  d.koopDeur();
  const naParent = d.deurMarkering.parent !== null;
  return { voorParent, naParent };
});
check('Vóór aankoop staat de deur1-markering nog in de scene (parent !== null)',
  deurKoop.voorParent === true, deurKoop);
check('Na het kopen van deur 1 is de markering uit de scene verwijderd (parent === null)',
  deurKoop.naParent === false, deurKoop);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
