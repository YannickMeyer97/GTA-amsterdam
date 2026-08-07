// Ticket 85: Etalages — sporen van de run. Drie puur decoratieve ramen
// (los van de VENSTERS-barricadesystemen) die op golfmijlpalen 5/10/15
// dichtgetimmerd raken (materiaal-wissel, geen nieuwe mesh), plus een
// ereplank bij de Smederij die per gesmeed wapen een medaillon oplicht.
// Zie ROADMAP.md Ticket 85 en ARCHITECTURE_NOTES.md §9.6. De groei-vrije
// mesh-/materiaal-/obstakeltelling over 25 golven zit in test-resources.mjs
// (sectie f) — dit bestand bewaakt de FUNCTIONELE correctheid.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Bewaar het originele (glazen) materiaal van raam 0 vóór ELKE mutatie
// hieronder, zodat sectie 5 verderop 'm weer terug kan zetten voor een
// zinvolle voor/na-materiaalcheck (mat() zelf is niet geëxporteerd).
await page.evaluate(() => {
  window.__origineelGlasMateriaal = window.AmsterdamUndeadDebug.etalageRamen[0].material;
});

// --- 1. Drie ramen bestaan, elk als losstaande mesh, geen collision --------
const basisTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    aantalRamen: d.etalageRamen.length,
    allemaalMesh: d.etalageRamen.every(r => r.isMesh),
    mijlpalen: d.ETALAGE_MIJLPALEN,
    obstakelAantal: d.obstakels.length,
  };
});
check('Er zijn precies 3 etalageramen, elk een echte THREE.Mesh', basisTest.aantalRamen === 3 && basisTest.allemaalMesh, basisTest);
check('ETALAGE_MIJLPALEN is [5, 10, 15]', JSON.stringify(basisTest.mijlpalen) === JSON.stringify([5, 10, 15]), basisTest);
check('obstakels.length is 52 (de ramen voegen geen collision toe)', basisTest.obstakelAantal === 52, basisTest);

// --- 2. Vóór elke mijlpaal: nog geen enkel raam gewisseld -------------------
const voorMijlpaalTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.etalageVoltooid = 0;
  d.spelStaat.golf = 4;
  d.updateEtalageSporen();
  return { etalageVoltooid: d.etalageVoltooid };
});
check('Onder de eerste mijlpaal (golf 4 < 5): etalageVoltooid blijft 0', voorMijlpaalTest.etalageVoltooid === 0, voorMijlpaalTest);

// --- 3. Op/na elke mijlpaal: het bijbehorende raam wisselt van materiaal ---
const mijlpaalTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.etalageVoltooid = 0;
  const materiaalVoor = d.etalageRamen.map(r => r.material);

  d.spelStaat.golf = 5;
  d.updateEtalageSporen();
  const naGolf5 = { voltooid: d.etalageVoltooid, raam0Gewisseld: d.etalageRamen[0].material !== materiaalVoor[0] };

  d.spelStaat.golf = 9;
  d.updateEtalageSporen();
  const naGolf9 = { voltooid: d.etalageVoltooid };   // nog geen tweede mijlpaal

  d.spelStaat.golf = 12;
  d.updateEtalageSporen();
  const naGolf12 = { voltooid: d.etalageVoltooid, raam1Gewisseld: d.etalageRamen[1].material !== materiaalVoor[1] };

  d.spelStaat.golf = 20;   // ruim voorbij de laatste mijlpaal (15)
  d.updateEtalageSporen();
  const naGolf20 = {
    voltooid: d.etalageVoltooid,
    raam2Gewisseld: d.etalageRamen[2].material !== materiaalVoor[2],
    allemaalHetzelfdeMateriaal: d.etalageRamen[0].material === d.etalageRamen[1].material &&
      d.etalageRamen[1].material === d.etalageRamen[2].material,
  };
  return { naGolf5, naGolf9, naGolf12, naGolf20 };
});
check('Op golf 5: precies raam 0 wisselt van materiaal (etalageVoltooid: 1)',
  mijlpaalTest.naGolf5.voltooid === 1 && mijlpaalTest.naGolf5.raam0Gewisseld, mijlpaalTest);
check('Op golf 9 (tussen de mijlpalen in): geen extra raam gewisseld (etalageVoltooid blijft 1)',
  mijlpaalTest.naGolf9.voltooid === 1, mijlpaalTest);
check('Op golf 12: ook raam 1 is nu gewisseld (etalageVoltooid: 2)',
  mijlpaalTest.naGolf12.voltooid === 2 && mijlpaalTest.naGolf12.raam1Gewisseld, mijlpaalTest);
check('Ruim voorbij de laatste mijlpaal (golf 20): alle drie gewisseld (etalageVoltooid: 3), geen vierde poging',
  mijlpaalTest.naGolf20.voltooid === 3 && mijlpaalTest.naGolf20.raam2Gewisseld, mijlpaalTest);
check('De drie dichtgetimmerde ramen delen hetzelfde (gecachete) matFamilie-materiaal',
  mijlpaalTest.naGolf20.allemaalHetzelfdeMateriaal, mijlpaalTest);

// --- 4. updateEtalageSporen() is idempotent: nogmaals aanroepen op dezelfde
// golf verandert niets meer. --------------------------------------------
const idempotentTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const materiaalVoor = d.etalageRamen.map(r => r.material);
  const voltooidVoor = d.etalageVoltooid;
  d.updateEtalageSporen();
  d.updateEtalageSporen();
  return {
    voltooidOngewijzigd: d.etalageVoltooid === voltooidVoor,
    materialenOngewijzigd: d.etalageRamen.every((r, i) => r.material === materiaalVoor[i]),
  };
});
check('Herhaald aanroepen op dezelfde golf is een veilige no-op (idempotent)',
  idempotentTest.voltooidOngewijzigd && idempotentTest.materialenOngewijzigd, idempotentTest);

// --- 5. startGolf() roept updateEtalageSporen() daadwerkelijk aan ----------
// Reset raam 0 eerst expliciet terug naar een glazen materiaal (secties 2-4
// hierboven hebben 'm al dichtgetimmerd) — anders is een materiaal-
// identiteitscheck hier zinloos (het staat toevallig al op de "gewisseld"-
// waarde uit een eerdere sectie).
const startGolfTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.etalageRamen[0].material = window.__origineelGlasMateriaal;
  d.etalageVoltooid = 0;
  const materiaalVoor = d.etalageRamen[0].material;
  d.spelStaat.golf = 5;
  d.spelStaat.gameOver = false;
  d.startGolf();
  return { voltooid: d.etalageVoltooid, raam0Gewisseld: d.etalageRamen[0].material !== materiaalVoor };
});
check('startGolf() roept updateEtalageSporen() aan (raam 0 wisselt bij een echte golfstart op golf 5)',
  startGolfTest.voltooid >= 1 && startGolfTest.raam0Gewisseld, startGolfTest);

// --- 6. Ereplank: twee medaillons, gedoofd totdat het bijbehorende wapen
// gesmeed wordt. -----------------------------------------------------------
const ereplankVoorTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    medaillonsBestaan: !!d.ereplankMedaillonDrukspuit && !!d.ereplankMedaillonRatelaar,
    verschillendeObjecten: d.ereplankMedaillonDrukspuit !== d.ereplankMedaillonRatelaar,
    drukspuitGedoofdKleur: d.ereplankMedaillonDrukspuit.material.color.getHex(),
  };
});
check('Beide ereplank-medaillons bestaan en zijn verschillende objecten',
  ereplankVoorTest.medaillonsBestaan && ereplankVoorTest.verschillendeObjecten, ereplankVoorTest);
check('Het Drukspuit-medaillon begint gedoofd (grijs, niet de ember-accentkleur)',
  ereplankVoorTest.drukspuitGedoofdKleur !== 0xff7a1f, ereplankVoorTest);

const ereplankNaTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  const ratelaarKleurVoor = d.ereplankMedaillonRatelaar.material.color.getHex();
  d.koopSmederij();   // smeedt het actieve wapen (Drukspuit, standaard bij het laden)
  return {
    drukspuitKleurNa: d.ereplankMedaillonDrukspuit.material.color.getHex(),
    ratelaarOngewijzigd: d.ereplankMedaillonRatelaar.material.color.getHex() === ratelaarKleurVoor,
  };
});
check('Na koopSmederij() (Drukspuit): het Drukspuit-medaillon licht op (ember-accentkleur)',
  ereplankNaTest.drukspuitKleurNa === 0xff7a1f, ereplankNaTest);
check('Het Ratelaar-medaillon blijft ongemoeid (nog niet gesmeed)',
  ereplankNaTest.ratelaarOngewijzigd, ereplankNaTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
