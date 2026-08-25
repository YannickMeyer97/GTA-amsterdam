// Ticket 143 (Ronde 11, fase 2): de Canal Ripper — agressie met oplopende straf.
//
// Waar de AMSTEL-9 doorratelen bestraft met een LEERBARE camera-klim
// (test-amstel9-precisie.mjs), doet dit wapen het met WILLEKEURIGE spreiding:
// iets wat je alleen kunt vermijden, niet compenseren. Dat verschil in soort
// straf is de kern van GUNFEEL.md §6.
//
// Korte bursts moeten belonend blijven — vandaar de burst-drempel, waaronder de
// opbouw drie keer zo snel terugvalt. Dit bestand bewaakt die hele curve.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

await geefSpelerVuurwapen(page);
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 1000000;
  if (!d.wapenStaten.ratelaar) d.koopRatelaar();
  if (d.actiefWapenNaam !== 'ratelaar') d.activeerVuurwapen('ratelaar');
});

// --- 1. Spread bij schot 1 is exact de vastgelegde basiswaarde -------------
const schotEen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 999;
  d.wapenStaat.spreadOpbouw = 0;
  const gebruiktBijSchot1 = d.wapenStaat.definitie.spreadNdc + d.wapenStaat.spreadOpbouw;
  d.schiet();
  return {
    gebruiktBijSchot1,
    basis: d.wapenStaat.definitie.spreadNdc,
    opbouwNaSchot1: d.wapenStaat.spreadOpbouw,
    perSchot: d.wapenStaat.definitie.spreadOpbouwPerSchot,
  };
});
check('Schot 1 vuurt op exact de basisspreiding (0.012), zonder opbouw',
  schotEen.gebruiktBijSchot1 === 0.012 && schotEen.basis === 0.012, schotEen);
check('Ná schot 1 staat de opbouw op precies één keer de toename per schot',
  schotEen.opbouwNaSchot1 === schotEen.perSchot, schotEen);

// --- 2. Een vol magazijn maakt de spreiding meetbaar groter ---------------
// Gesimuleerd op maximale cadans: per schot +0,005 opbouw, en tussen de schoten
// bouwt hij 0,030/s x 0,1 s = 0,003 af. Netto dus +0,002 per schot.
const volMagazijn = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.spreadOpbouw = 0;
  d.wapenStaat.magazijn = 999;
  const cadans = d.wapenStaat.definitie.schotCooldown;
  const bijAfvuren = [];
  for (let i = 0; i < 16; i++) {
    bijAfvuren.push(d.wapenStaat.definitie.spreadNdc + d.wapenStaat.spreadOpbouw);
    d.schiet();
    // Doorlopend vuren: de pauze tussen twee schoten is exact de cadans, dus
    // binnen het "nog niet gestopt"-venster (zie updateWapen()).
    d.vorigSchotKlok = d.klok;
    d.updateWapen(cadans);
  }
  return {
    eerste: bijAfvuren[0],
    laatste: bijAfvuren[15],
    reeks: bijAfvuren.map(v => Number(v.toFixed(5))),
    monotoon: bijAfvuren.every((v, i) => i === 0 || v >= bijAfvuren[i - 1]),
    plafond: d.wapenStaat.definitie.spreadOpbouwMax,
  };
});
check('De spreiding loopt monotoon op tijdens een vol magazijn op maximale cadans',
  volMagazijn.monotoon, volMagazijn);
check('Het 16e schot heeft meetbaar meer spreiding dan het eerste (minstens 3x)',
  volMagazijn.laatste >= volMagazijn.eerste * 3, volMagazijn);
check('De totale spreiding aan het eind van het magazijn ligt rond 0,042 (GUNFEEL §4)',
  Math.abs(volMagazijn.laatste - 0.042) < 0.002, volMagazijn);

// --- 3. De opbouw bouwt aantoonbaar af tijdens een vuurpauze --------------
const afbouw = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const def = d.wapenStaat.definitie;
  d.wapenStaat.spreadOpbouw = def.spreadOpbouwMax;   // plafond
  const start = d.wapenStaat.spreadOpbouw;
  d.updateWapen(0.5);
  const naHalveSec = d.wapenStaat.spreadOpbouw;
  // Doortellen tot volledig schoon; de laatste 0,010 gaat versneld.
  let stappen = 0;
  while (d.wapenStaat.spreadOpbouw > 0 && stappen < 2000) { d.updateWapen(0.01); stappen++; }
  return { start, naHalveSec, tijdTotSchoon: Number((stappen * 0.01).toFixed(3)), eind: d.wapenStaat.spreadOpbouw };
});
check('Tijdens een vuurpauze daalt de opbouw daadwerkelijk', afbouw.naHalveSec < afbouw.start, afbouw);
check('En hij komt volledig op 0 uit (geen restje dat blijft hangen)', afbouw.eind === 0, afbouw);

// --- 4. Burst recovery: korte salvo's blijven belonend --------------------
// Direct ná schot k staat de opbouw op 0,002k + 0,003. Een burst van drie
// eindigt dus op 0,009 en blijft onder de drempel van 0,010; vanaf de vierde
// kogel ga je eroverheen en zit je aan de trage afbouw vast.
const burst = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const def = d.wapenStaat.definitie;
  const cadans = def.schotCooldown;
  // De klok loopt binnen een page.evaluate niet door, dus "vuren" en "gestopt"
  // worden hier gesimuleerd via vorigSchotKlok: tijdens het salvo staat die op
  // nu (dus binnen de cadans = niet gestopt), en voor de herstelfase zetten we
  // 'm ver terug — precies wat er in het spel gebeurt als je de trekker loslaat.
  const salvo = (aantal) => {
    d.wapenStaat.spreadOpbouw = 0;
    d.wapenStaat.magazijn = 999;
    for (let i = 0; i < aantal; i++) {
      d.schiet();
      if (i < aantal - 1) { d.vorigSchotKlok = d.klok; d.updateWapen(cadans); }
    }
    const naSalvo = d.wapenStaat.spreadOpbouw;
    d.vorigSchotKlok = d.klok - 999;   // trekker losgelaten
    let stappen = 0;
    while (d.wapenStaat.spreadOpbouw > 0 && stappen < 5000) { d.updateWapen(0.005); stappen++; }
    return { naSalvo, schoonNaSec: Number((stappen * 0.005).toFixed(3)) };
  };
  return {
    drempel: def.spreadBurstDrempel,
    traag: def.spreadOpbouwAfbouw, snel: def.spreadOpbouwAfbouwSnel,
    burst3: salvo(3),
    burst4: salvo(4),
    burst16: salvo(16),
  };
});
check('De snelle afbouw onder de drempel is exact drie keer de trage',
  Math.abs(burst.snel / burst.traag - 3) < 1e-9, burst);
check('Een burst van drie blijft ONDER de burst-drempel (praktisch gratis)',
  burst.burst3.naSalvo < burst.drempel, burst);
check('Een burst van vier komt er wél overheen (de drempel doet echt iets)',
  burst.burst4.naSalvo > burst.drempel, burst);
check('Een burst van drie is duidelijk sneller schoon dan een vol magazijn',
  burst.burst3.schoonNaSec < burst.burst16.schoonNaSec / 4, burst);
check('Een burst van drie is binnen ~0,11 s schoon (GUNFEEL §4)',
  burst.burst3.schoonNaSec <= 0.12, burst);

// --- 5. Sustained-fire recoil: de kick loopt mee met de opbouw ------------
const sustained = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const def = d.wapenStaat.definitie;
  const kickBij = (opbouw) => {
    d.wapenStaat.spreadOpbouw = opbouw;
    d.wapenStaat.magazijn = 999;
    d.cameraKick = 0;
    d.vorigSchotKlok = d.klok - 5;   // ruim hersteld: isoleert de spread-schaling
    d.schiet();
    return d.cameraKick;
  };
  return {
    basis: def.kickSterkte,
    schaal: def.kickSpreadSchaal,
    bijNul: kickBij(0),
    bijEindMagazijn: kickBij(0.030),
    bijPlafond: kickBij(def.spreadOpbouwMax),
  };
});
check('Zonder opbouw is de kick exact de basiswaarde (schaalfactor 1)',
  Math.abs(sustained.bijNul - sustained.basis) < 1e-12, sustained);
check('Aan het eind van een vol magazijn is de kick bijna verdubbeld',
  sustained.bijEindMagazijn > sustained.basis * 1.9 && sustained.bijEindMagazijn < sustained.basis * 2.0,
  sustained);
check('De kick loopt monotoon op met de opbouw',
  sustained.bijPlafond > sustained.bijEindMagazijn && sustained.bijEindMagazijn > sustained.bijNul,
  sustained);

// --- 6. Het tandwiel draait tijdens vuren en loopt uit --------------------
// Bewust op het ONDERDEEL (userData.onderdelen.accent) en niet op de Group:
// die heeft sinds T140 één eigenaar met een vaste rustpose, waar een
// doordraaiend tandwiel nooit exact op zou terugkomen.
const tandwiel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const accent = d.inHandGroep.userData.onderdelen.accent;
  d.ripperTandwielSnelheid = 0;
  d.updateWapenPresentatie(0.016);
  const hoekVoor = accent.rotation.y;
  const groepRotVoor = d.inHandGroep.rotation.y;

  d.wapenStaat.magazijn = 999;
  d.schiet();
  const snelheidNaSchot = d.ripperTandwielSnelheid;
  d.updateWapenPresentatie(0.016);
  const hoekNaEenFrame = accent.rotation.y;

  for (let i = 0; i < 120; i++) d.updateWapenPresentatie(0.016);
  return {
    hoekVoor, hoekNaEenFrame, snelheidNaSchot,
    ingesteld: d.WAPEN_RATELAAR.tandwielSpinPerSchot,
    snelheidNaUitloop: d.ripperTandwielSnelheid,
    groepRotOngewijzigd: d.inHandGroep.rotation.y === groepRotVoor,
  };
});
check('Een schot zet het tandwiel in beweging op de ingestelde snelheid',
  Math.abs(tandwiel.snelheidNaSchot - tandwiel.ingesteld) < 1e-12, tandwiel);
check('Het tandwiel draait daadwerkelijk door in de presentatielaag',
  tandwiel.hoekNaEenFrame > tandwiel.hoekVoor, tandwiel);
check('De draaisnelheid loopt uit tot exact 0 (geen eeuwig draaiend tandwiel)',
  tandwiel.snelheidNaUitloop === 0, tandwiel);
check('De Group-rotatie zelf blijft ongemoeid — alleen het onderdeel draait',
  tandwiel.groepRotOngewijzigd, tandwiel);

// --- 7. Doorboring-tell: hoorbaar én zichtbaar, schade ongewijzigd --------
const doorboring = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    heeftEigenGeluid: typeof d.speelDoorboring === 'function',
    tellerVoor: d.doorboringTeller,
    schadeFactor: d.RIPPER_DOORBORING_SCHADEFACTOR,
  };
});
check('De Doorboring heeft een eigen geluid (was alleen in schade merkbaar)',
  doorboring.heeftEigenGeluid, doorboring);
check('RIPPER_DOORBORING_SCHADEFACTOR is ongewijzigd — dit ticket raakt alleen feedback',
  doorboring.schadeFactor === 0.6, doorboring);

const telt = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.doorboringTeller;
  d.speelDoorboring();
  return { voor, na: d.doorboringTeller };
});
check('speelDoorboring() telt zijn eigen teller op (test-haak, zelfde patroon als de andere tikken)',
  telt.na === telt.voor + 1, telt);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
