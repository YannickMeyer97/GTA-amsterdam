// Ticket 44: de Vluchtroute-onderdelen. Bewaakt: vóór de drempelgolf bestaat
// er geen extra interactiepunt (laadtijd-telling blijft 12), elk onderdeel
// verschijnt exact op zijn drempelgolf (ook als de zone nog op slot zit),
// oppakken werkt in willekeurige volgorde en verwijdert mesh + punt +
// markering, de HUD-teller klopt, en alle drie de posities liggen in hun
// bedoelde zone op een vrije plek.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Bij het laden: exact 12 interactiepunten, geen vluchtroute-punten -
const laadTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    interactiePuntenLengte: d.interactiePunten.length,
    onderdelenZichtbaar: d.VLUCHT_ONDERDELEN.map(o => o.zichtbaar),
    meshesOnzichtbaar: d.VLUCHT_ONDERDELEN.map(o => o.mesh.visible),
  };
});
check('Bij het laden zijn er nog steeds precies 12 interactiepunten (laadtijd-telling ongewijzigd)',
  laadTest.interactiePuntenLengte === 12, laadTest);
check('Bij het laden is geen enkel vluchtroute-onderdeel al zichtbaar',
  laadTest.onderdelenZichtbaar.every(v => v === false) && laadTest.meshesOnzichtbaar.every(v => v === false), laadTest);

// --- 2. Elk onderdeel staat in zijn bedoelde zone, op een vrije plek ------
const zoneTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.VLUCHT_ONDERDELEN.map(o => ({ naam: o.naam, zone: d.zoneVan(o.x, o.z), vrij: d.isVrijePlek(o.x, o.z, 0.5) }));
});
check('Roeispaan staat in het atelier (zone 2) op een vrije plek',
  zoneTest[0].zone === 2 && zoneTest[0].vrij, zoneTest);
check('Touwbundel staat op de binnenplaats (zone 3) op een vrije plek',
  zoneTest[1].zone === 3 && zoneTest[1].vrij, zoneTest);
check('Scheepslantaarn staat in de bijkeuken (zone 4) op een vrije plek',
  zoneTest[2].zone === 4 && zoneTest[2].vrij, zoneTest);

// --- 3. Elk onderdeel verschijnt EXACT op zijn drempelgolf, ook als de
// zone nog op slot zit -------------------------------------------------------
const drempelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const resultaten = [];
  for (const onderdeel of d.VLUCHT_ONDERDELEN) {
    d.spelStaat.golf = onderdeel.drempelGolf - 1;
    d.toonVluchtOnderdelenIndienDrempel();
    const voorDrempel = { zichtbaar: onderdeel.zichtbaar, meshZichtbaar: onderdeel.mesh.visible, puntAanwezig: d.interactiePunten.includes(onderdeel.punt) };
    d.spelStaat.golf = onderdeel.drempelGolf;
    d.toonVluchtOnderdelenIndienDrempel();
    const opDrempel = { zichtbaar: onderdeel.zichtbaar, meshZichtbaar: onderdeel.mesh.visible, puntAanwezig: d.interactiePunten.includes(onderdeel.punt) };
    resultaten.push({ naam: onderdeel.naam, voorDrempel, opDrempel });
  }
  return { resultaten, interactiePuntenNa: d.interactiePunten.length };
});
check('Vóór de drempelgolf is geen enkel onderdeel zichtbaar of aanwezig als interactiepunt',
  drempelTest.resultaten.every(r => r.voorDrempel.zichtbaar === false && r.voorDrempel.meshZichtbaar === false && r.voorDrempel.puntAanwezig === false),
  drempelTest);
check('Op de drempelgolf zelf wordt elk onderdeel zichtbaar én krijgt het een interactiepunt',
  drempelTest.resultaten.every(r => r.opDrempel.zichtbaar === true && r.opDrempel.meshZichtbaar === true && r.opDrempel.puntAanwezig === true),
  drempelTest);
check('interactiePunten is nu 12 + 3 = 15 (alle drie tegelijk aanwezig)',
  drempelTest.interactiePuntenNa === 15, drempelTest);

// --- 4. Herhaald aanroepen van toonVluchtOnderdelenIndienDrempel() creëert
// GEEN dubbele punten/markeringen (idempotent zodra al zichtbaar) ----------
const idempotentTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lengteVoor = d.interactiePunten.length;
  for (let i = 0; i < 5; i++) d.toonVluchtOnderdelenIndienDrempel();
  return { lengteNa: d.interactiePunten.length, lengteVoor };
});
check('Herhaald aanroepen na de drempel voegt niets dubbel toe',
  idempotentTest.lengteNa === idempotentTest.lengteVoor, idempotentTest);

// --- 5. Oppakken in willekeurige volgorde: mesh + punt + markering weg,
// teller en HUD kloppen, resterende onderdelen blijven intact --------------
const oppakTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 0;
  d.updateVluchtrouteHUD();
  const hudVoor = document.getElementById('vluchtrouteUI').textContent;

  const [roeispaan, touwbundel, scheepslantaarn] = d.VLUCHT_ONDERDELEN;
  // Bewust NIET in volgorde: eerst het tweede, dan het eerste, dan het derde.
  d.raapVluchtOnderdeelOp(touwbundel);
  const naEen = {
    teller: d.vluchtOnderdelenOpgepakt,
    touwbundelWeg: touwbundel.mesh.parent === null && !d.interactiePunten.includes(touwbundel.punt),
    roeispaanNogAanwezig: roeispaan.mesh.parent !== null && d.interactiePunten.includes(roeispaan.punt),
    hud: document.getElementById('vluchtrouteUI').textContent,
  };
  d.raapVluchtOnderdeelOp(roeispaan);
  d.raapVluchtOnderdeelOp(scheepslantaarn);
  const naAlle = {
    teller: d.vluchtOnderdelenOpgepakt,
    hud: document.getElementById('vluchtrouteUI').textContent,
    interactiePuntenNa: d.interactiePunten.length,
  };
  return { hudVoor, naEen, naAlle };
});
check('vóór het oppakken toont de HUD "Vluchtroute: 0/3"',
  oppakTest.hudVoor === 'Vluchtroute: 0/3', oppakTest);
check('Na het oppakken van de Touwbundel (als tweede, niet als eerste): teller op 1, mesh+punt weg, Roeispaan blijft ongemoeid',
  oppakTest.naEen.teller === 1 && oppakTest.naEen.touwbundelWeg && oppakTest.naEen.roeispaanNogAanwezig, oppakTest.naEen);
check('De HUD update meteen mee naar "Vluchtroute: 1/3"',
  oppakTest.naEen.hud === 'Vluchtroute: 1/3', oppakTest.naEen);
// interactiePunten: 12 basis + de 3 vluchtroute-punten allemaal weer weg,
// MAAR Ticket 45 voegt bij 3/3 automatisch het ontsnappingspunt toe
// (toonOntsnappingspuntIndienKlaar(), aangeroepen vanuit raapVluchtOnderdeelOp)
// — dus 12 + 1 = 13, niet 12. Bewust bijgewerkt in Ticket 45, zelfde
// discipline als de T16/test-powerups- en T30/hitreacties-precedenten.
check('Na alle drie: teller op 3, HUD toont 3/3, interactiePunten op 12 + het nieuwe ontsnappingspunt (T45) = 13',
  oppakTest.naAlle.teller === 3 && oppakTest.naAlle.hud === 'Vluchtroute: 3/3' && oppakTest.naAlle.interactiePuntenNa === 13,
  oppakTest.naAlle);

// --- 6. Regressie: bestaande winkelmarkeringen-telling groeit met precies 3
// (de gedeelde vluchtroute-stijl levert 3 extra markeringen, boven op de
// bestaande 12 statische winkels) -------------------------------------------
const winkelRegressie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { winkelMarkeringenLengte: d.winkelMarkeringen.length };
});
check('winkelMarkeringen bevat de 12 bestaande + 3 (inmiddels opgepakte, dus nog wel gebouwde) vluchtroute-markeringen = 15',
  winkelRegressie.winkelMarkeringenLengte === 15, winkelRegressie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
