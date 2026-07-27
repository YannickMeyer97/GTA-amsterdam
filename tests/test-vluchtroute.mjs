// Ticket 44: de Vluchtroute-onderdelen. Bewaakt: vóór de drempelgolf bestaat
// er geen extra interactiepunt (laadtijd-telling blijft 11 — was 12 vóór
// Feedback het Provisiekast-punt verwijderde), elk onderdeel
// verschijnt exact op zijn drempelgolf (ook als de zone nog op slot zit),
// oppakken werkt in willekeurige volgorde en verwijdert mesh + punt +
// markering, de HUD-teller klopt, en alle drie de posities liggen in hun
// bedoelde zone op een vrije plek.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Bij het laden: exact 11 interactiepunten, geen vluchtroute-punten -
const laadTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    interactiePuntenLengte: d.interactiePunten.length,
    onderdelenZichtbaar: d.VLUCHT_ONDERDELEN.map(o => o.zichtbaar),
    meshesOnzichtbaar: d.VLUCHT_ONDERDELEN.map(o => o.mesh.visible),
  };
});
check('Bij het laden zijn er nog steeds precies 11 interactiepunten (laadtijd-telling ongewijzigd t.o.v. Ticket 44 zelf)',
  laadTest.interactiePuntenLengte === 11, laadTest);
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

// --- 2b. Ticket 56: elke mesh-group staat ECHT op (x, 0, z) — vóór dit
// ticket bleef mesh.position altijd op de wereld-oorsprong staan (bug: alleen
// de winkelMarkering-ring en het interactiepunt zaten al op de juiste plek).
// Elk onderdeel heeft nu ook een rustvlak (krat/kistrand/plank) als EERSTE
// kind van dezelfde group — dat kind verdwijnt zo automatisch mee via de
// bestaande wereld.remove(onderdeel.mesh) in raapVluchtOnderdeelOp(), zonder
// die functie te hoeven wijzigen. userData.pulsMesh (de permanente puls,
// hergebruik van het flitsMarkering-idee) moet ook een kind van de group zijn.
const rustvlakTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.VLUCHT_ONDERDELEN.map(o => ({
    naam: o.naam,
    meshPos: o.mesh.position.toArray(),
    verwacht: [o.x, 0, o.z],
    kinderen: o.mesh.children.length,
    eersteKindIsRustvlak: o.mesh.children[0].geometry.type === 'BoxGeometry',
    pulsMeshIsKind: o.mesh.children.includes(o.mesh.userData.pulsMesh),
  }));
});
check('Elke groep staat exact op (onderdeel.x, 0, onderdeel.z) — de mesh.position-bug is gefixt',
  rustvlakTest.every(r => r.meshPos[0] === r.verwacht[0] && r.meshPos[1] === r.verwacht[1] && r.meshPos[2] === r.verwacht[2]),
  rustvlakTest);
check('Elk onderdeel heeft een rustvlak (Box-geometrie) als eerste kind van dezelfde group',
  rustvlakTest.every(r => r.eersteKindIsRustvlak), rustvlakTest);
check('Elk onderdeel heeft 3 of 4 kinderen (rustvlak + item-onderdelen, binnen het perf-budget)',
  rustvlakTest.every(r => r.kinderen === 3 || r.kinderen === 4), rustvlakTest);
check('De permanente puls-mesh (userData.pulsMesh) is een kind van dezelfde group, dus verdwijnt mee bij het oprapen',
  rustvlakTest.every(r => r.pulsMeshIsKind), rustvlakTest);

// --- 2c. De permanente puls: alleen zichtbare, niet-opgeraapte onderdelen
// krijgen een schaalpuls; opgehaalde/verborgen onderdelen blijven met rust.
// Zet bewust ALLEEN de zichtbaar-/mesh.visible-vlaggen direct (i.p.v. via
// toonVluchtOnderdelenIndienDrempel()/spelStaat.golf), en herstelt ze weer —
// zodat sectie 3 hierna nog met echt schone staat (golf 1, niets zichtbaar)
// begint.
const pulsTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const roeispaan = d.VLUCHT_ONDERDELEN[0];
  const touwbundel = d.VLUCHT_ONDERDELEN[1];
  roeispaan.zichtbaar = true;
  roeispaan.mesh.visible = true;
  const schaalVoor = roeispaan.mesh.userData.pulsMesh.scale.x;
  d.updateVluchtOnderdelenPuls(0.3);
  const schaalNa = roeispaan.mesh.userData.pulsMesh.scale.x;
  // Touwbundel blijft bewust onzichtbaar: dekt dat de puls een nog niet
  // getoond onderdeel niet aanraakt.
  const touwbundelSchaalVoor = touwbundel.mesh.userData.pulsMesh.scale.x;
  d.updateVluchtOnderdelenPuls(0.3);
  const touwbundelSchaalNa = touwbundel.mesh.userData.pulsMesh.scale.x;
  // Opruimen voor sectie 3 hieronder.
  roeispaan.zichtbaar = false;
  roeispaan.mesh.visible = false;
  roeispaan.mesh.userData.pulsMesh.scale.setScalar(1);
  return { schaalVoor, schaalNa, touwbundelSchaalVoor, touwbundelSchaalNa };
});
check('De puls verandert de schaal van een zichtbaar, nog niet opgeraapt onderdeel',
  pulsTest.schaalNa !== pulsTest.schaalVoor, pulsTest);
check('De puls raakt een nog onzichtbaar onderdeel (drempelgolf niet bereikt) niet aan',
  pulsTest.touwbundelSchaalNa === pulsTest.touwbundelSchaalVoor, pulsTest);

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
check('interactiePunten is nu 11 + 3 = 14 (alle drie tegelijk aanwezig)',
  drempelTest.interactiePuntenNa === 14, drempelTest);

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
  // Ticket 54: het ontsnappingsVENSTER (niet meteen het punt zelf) opent
  // sinds dit ticket alleen nog tijdens een geldige ontsnappingsgolf (golf
  // 10, 14, 18, …). Ticket 55 voegt daar bovenop een korte aankondigingsfase
  // tussen: de laatste pickup hieronder start (via
  // probeerOntsnappingsVensterTeOpenen()) dus de aankondiging, niet meteen
  // het interactiepunt zelf — dat verschijnt pas na
  // ONTSNAPPING_AANKONDIGING_DUUR (zie test-ontsnapping-vensters.mjs voor de
  // volledige timer-dekking).
  d.spelStaat.golf = 10;
  const hoornVoor = d.bootHoornTeller;
  d.raapVluchtOnderdeelOp(scheepslantaarn);
  const naAlle = {
    teller: d.vluchtOnderdelenOpgepakt,
    hud: document.getElementById('vluchtrouteUI').textContent,
    interactiePuntenNa: d.interactiePunten.length,
    aankondigingActief: d.ontsnappingAankondigingActief,
    hoornGespeeld: d.bootHoornTeller - hoornVoor === 1,
  };
  return { hudVoor, naEen, naAlle };
});
check('vóór het oppakken toont de HUD "Vluchtroute: 0/3"',
  oppakTest.hudVoor === 'Vluchtroute: 0/3', oppakTest);
check('Na het oppakken van de Touwbundel (als tweede, niet als eerste): teller op 1, mesh+punt weg, Roeispaan blijft ongemoeid',
  oppakTest.naEen.teller === 1 && oppakTest.naEen.touwbundelWeg && oppakTest.naEen.roeispaanNogAanwezig, oppakTest.naEen);
check('De HUD update meteen mee naar "Vluchtroute: 1/3"',
  oppakTest.naEen.hud === 'Vluchtroute: 1/3', oppakTest.naEen);
// interactiePunten: 11 basis + de 3 vluchtroute-punten allemaal weer weg =
// 11 — het ontsnappingspunt zelf verschijnt (sinds Ticket 55) pas na de
// aankondigingsduur, dus meteen na de derde pickup is het nog 11, niet 12.
check('Na alle drie: teller op 3, HUD toont 3/3, interactiePunten blijft op 11 (het ontsnappingspunt verschijnt pas na de T55-aankondiging)',
  oppakTest.naAlle.teller === 3 && oppakTest.naAlle.hud === 'Vluchtroute: 3/3' && oppakTest.naAlle.interactiePuntenNa === 11,
  oppakTest.naAlle);
check('De derde pickup start wél meteen de T55-aankondigingsfase (hoorn + actieve timer)',
  oppakTest.naAlle.aankondigingActief && oppakTest.naAlle.hoornGespeeld, oppakTest.naAlle);

// --- 6. Regressie: bestaande winkelmarkeringen-telling groeit met precies 3
// (de gedeelde vluchtroute-stijl levert 3 extra markeringen, boven op de
// bestaande 12 statische winkels) -------------------------------------------
const winkelRegressie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { winkelMarkeringenLengte: d.winkelMarkeringen.length };
});
check('winkelMarkeringen bevat de 11 bestaande + 3 (inmiddels opgepakte, dus nog wel gebouwde) vluchtroute-markeringen = 14',
  winkelRegressie.winkelMarkeringenLengte === 14, winkelRegressie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
