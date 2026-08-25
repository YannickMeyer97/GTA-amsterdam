// Ticket 142 (Ronde 11, fase 2): de precisie-identiteit van de AMSTEL-9.
//
// De kern van dit ticket is een CONTRACT en een correctie op de T141-spec.
// Het contract: dit wapen dobbelt nooit — élk schot gaat exact waar de loop
// wijst, ongeacht hoe snel je vuurt. De correctie: de eerste versie van de
// spec strafte doorratelen met oplopende spreiding, en dat brak precies dat
// contract (zie GUNFEEL.md §3). De straf is nu deterministisch: de camera
// klimt harder als je vuurt vóórdat de vorige kick hersteld is.
//
// Waarom dat verschil ertoe doet: spreiding kun je alleen ondergaan, een
// voorspelbare klim kun je leren compenseren. Dit bestand bewaakt beide
// helften — dat de willekeur er niet is, én dat de straf er wél is.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

await geefSpelerVuurwapen(page);

// --- 1. Het first-shot-contract is een ELK-shot-contract -------------------
const contract = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (d.actiefWapenNaam !== 'drukspuit') d.activeerVuurwapen('drukspuit');
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 999;
  d.wapenStaat.spreadOpbouw = 0;
  d.speler.positie.set(0, 0, -1.5);
  d.speler.yaw = Math.PI;
  d.speler.pitch = 0;
  d.camera.position.set(0, d.speler.hoogte, -1.5);
  d.camera.rotation.set(d.speler.pitch, d.speler.yaw, 0);
  d.camera.updateMatrixWorld(true);

  const punten = [];
  const opbouwNa = [];
  for (let i = 0; i < 40; i++) {
    d.schiet();
    const tracer = d.actieveEffecten.filter(e => e.soort === 'tracer').slice(-1)[0];
    punten.push(`${Math.round(tracer.slot.mesh.position.x * 1e6)},${Math.round(tracer.slot.mesh.position.y * 1e6)}`);
    opbouwNa.push(d.wapenStaat.spreadOpbouw);
  }
  return {
    uniekePunten: new Set(punten).size,
    spreadNdc: d.wapenStaat.definitie.spreadNdc,
    opbouwPerSchot: d.wapenStaat.definitie.spreadOpbouwPerSchot,
    opbouwMaxGezien: Math.max(...opbouwNa),
    pitchNa: d.speler.pitch,
  };
});
check('spreadNdc van de AMSTEL-9 is exact 0 — het contract, niet een toevalligheid',
  contract.spreadNdc === 0, contract);
check('40 achtereenvolgende schoten landen op EXACT hetzelfde punt (geen enkele willekeur)',
  contract.uniekePunten === 1, contract);
check('Dit wapen bouwt GEEN spreiding op, hoe snel je ook vuurt (correctie op de eerste T141-spec)',
  contract.opbouwPerSchot === 0 && contract.opbouwMaxGezien === 0, contract);
check('speler.pitch blijft na 40 schoten exact 0 — geen blijvende aim-drift',
  contract.pitchNa === 0, contract);

// --- 2. De straf op ratelen: deterministische camera-klim ------------------
// Zelfde schot, alleen een ander GAT sinds het vorige schot. De uitkomst moet
// volledig door dat gat bepaald worden — dat is wat "deterministisch" hier
// betekent, en het is meteen waarom een speler het kan leren.
const ratel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // `klok` staat bij het openen van de pagina al niet meer op 0, dus het gat
  // moet RELATIEF daaraan gezet worden. Binnen deze evaluate loopt de klok niet
  // door (geen frames), dus `klok - vorigSchotKlok` is precies het ingestelde gat.
  const meetKick = (gat) => {
    d.cameraKick = 0;
    d.vorigSchotKlok = d.klok - gat;
    d.schiet();
    return d.cameraKick;
  };
  const basis = d.WAPEN_DRUKSPUIT.kickSterkte;
  return {
    basis,
    venster: d.KICK_HERSTELVENSTER,
    straf: d.WAPEN_DRUKSPUIT.kickRatelStraf,
    hersteld: meetKick(0.30),      // ruim voorbij het herstelvenster -> factor 1
    ruimHersteld: meetKick(5.0),   // idem, moet identiek zijn (geklemd op 1)
    maxCadans: meetKick(0.20),     // de snelste cadans die het spel toelaat
    directAchterElkaar: meetKick(0),
    herhaalbaar: meetKick(0.20),   // zelfde invoer -> zelfde uitkomst
  };
});
check('Vuren ná het herstelvenster kost geen extra kick (factor exact 1)',
  Math.abs(ratel.hersteld - ratel.basis) < 1e-12, ratel);
check('De factor is geklemd: nóg langer wachten levert niets extra op',
  ratel.hersteld === ratel.ruimHersteld, ratel);
check('Vuren op maximale cadans (0,20 s) kost meetbaar méér kick dan geduldig vuren',
  ratel.maxCadans > ratel.hersteld * 1.2, ratel);
check('De straf loopt op naarmate het gat kleiner is (0 s kost het meest)',
  ratel.directAchterElkaar > ratel.maxCadans && ratel.maxCadans > ratel.hersteld, ratel);
check('Bij 0 s is de factor exact 1 + kickRatelStraf',
  Math.abs(ratel.directAchterElkaar - ratel.basis * (1 + ratel.straf)) < 1e-12, ratel);
check('Deterministisch: dezelfde invoer geeft bit-voor-bit dezelfde uitkomst',
  ratel.maxCadans === ratel.herhaalbaar, ratel);

// --- 3. De twee wapens straffen doorratelen met een ANDERE soort straf -----
// Dit is de kern van het onderscheid uit GUNFEEL.md §6, en het is precies wat
// dit ticket besloot: de AMSTEL-9 met een leerbare camera-klim, de Canal
// Ripper (T143) met willekeurige spreiding. Zou een van de twee er allebei
// krijgen, dan vervaagt het verschil in handling tot een verschil in cijfers.
const strafSoorten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lees = (def) => ({
    kickRatelStraf: def.kickRatelStraf,
    spreadOpbouwPerSchot: def.spreadOpbouwPerSchot,
    spreadNdc: def.spreadNdc,
    modelKickX: def.modelKickX,
  });
  return { amstel9: lees(d.WAPEN_DRUKSPUIT), ripper: lees(d.WAPEN_RATELAAR) };
});
check('De AMSTEL-9 straft met camera-klim en NOOIT met spreiding',
  strafSoorten.amstel9.kickRatelStraf > 0 && strafSoorten.amstel9.spreadOpbouwPerSchot === 0
  && strafSoorten.amstel9.spreadNdc === 0, strafSoorten);
check('De Canal Ripper straft met spreiding en NIET met een extra camera-klim',
  strafSoorten.ripper.spreadOpbouwPerSchot > 0 && strafSoorten.ripper.kickRatelStraf === 0,
  strafSoorten);
check('Alleen de AMSTEL-9 heeft de enkele model-kick; de Ripper beweegt ritmisch (T143)',
  strafSoorten.amstel9.modelKickX > 0 && strafSoorten.ripper.modelKickX === 0, strafSoorten);
check('De basisspreiding van de Ripper is ongewijzigd 0.012', strafSoorten.ripper.spreadNdc === 0.012, strafSoorten);

// --- 4. Model-kick: zichtbaar, en exact terug naar rust -------------------
// Deze zit op de wapen-Group, niet op de camera, en raakt de aim dus niet.
// Hij loopt via de T140-presentatielaag (de enige schrijver van die transform).
const modelKick = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.bobFase = 0;
  d.wapenKickX = 0;
  d.terugslag = 0;
  d.updateWapenPresentatie(0);
  const rustRotX = d.inHandGroep.rotation.x;

  d.vorigSchotKlok = -5;   // hersteld, dus de kale modelKickX zonder ratel-straf
  d.schiet();
  d.updateWapenPresentatie(0);
  const naSchot = { kick: d.wapenKickX, rotX: d.inHandGroep.rotation.x };

  // Afbouw 6/s -> vanaf 0.020 volledig terug in 0,00333 s... ruim doorstappen.
  for (let i = 0; i < 40; i++) d.updateWapenPresentatie(0.016);
  const naHerstel = { kick: d.wapenKickX, rotX: d.inHandGroep.rotation.x };

  return { rustRotX, naSchot, naHerstel, ingesteld: d.WAPEN_DRUKSPUIT.modelKickX };
});
check('Een schot zet een model-kick op rotation.x (zichtbaar gewicht, los van de camera)',
  Math.abs(modelKick.naSchot.kick - modelKick.ingesteld) < 1e-12 && modelKick.naSchot.rotX > modelKick.rustRotX,
  modelKick);
check('De model-kick bouwt af tot exact 0 en de groep staat weer precies op de rustpose',
  modelKick.naHerstel.kick === 0 && modelKick.naHerstel.rotX === modelKick.rustRotX, modelKick);

// --- 5. Headshot-feedback binnen de bestaande tiers -----------------------
const hitmarker = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    lichaam: d.HITMARKER_TIERS.lichaam.duur,
    kop: d.HITMARKER_TIERS.kop.duur,
    kill: d.HITMARKER_TIERS.kill.duur,
    rangen: d.HITMARKER_RANG,
    aantalTiers: Object.keys(d.HITMARKER_TIERS).length,
  };
});
check('Er zijn nog steeds precies drie hitmarker-tiers met dezelfde rangorde (geen nieuwe tier)',
  hitmarker.aantalTiers === 3 && hitmarker.rangen.lichaam === 0
  && hitmarker.rangen.kop === 1 && hitmarker.rangen.kill === 2, hitmarker);
check('De kop-tier duurt nu 0,24 s — precies twee keer een lichaamstreffer (was 1,5x)',
  hitmarker.kop === 0.24 && Math.abs(hitmarker.kop / hitmarker.lichaam - 2) < 1e-12, hitmarker);
check('Kill blijft duidelijk boven kop', hitmarker.kill > hitmarker.kop, hitmarker);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
