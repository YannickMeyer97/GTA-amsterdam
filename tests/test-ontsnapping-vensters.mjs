// Ticket 54 (Doel D7): periodieke ontsnappingsvensters (ronde-gating). De
// boot ligt niet permanent klaar zodra de vluchtroute compleet is — hij
// meert alleen periodiek aan, vanaf golf 10 en daarna elke 4 golven (10,
// 14, 18, 22, …). Dit ticket VOEGT die golf-gating TOE aan de bestaande
// 3/3-voorwaarde uit Ticket 45, vervangt 'm niet.
// Ticket 55 (Doel D8) breidt dit uit met een tell: het venster opent niet
// meteen met het volledige interactiepunt, eerst een korte aankondigingsfase
// (ONTSNAPPING_AANKONDIGING_DUUR: hoorn + banner + lantaarnpuls), pas daarna
// verschijnt het echte punt. Bewaakt hier: de pure
// isOntsnappingsGolf()/golvenTotOntsnappingsVenster()-tabellen, dat het
// venster (aankondiging, geen punt) alleen opent met zowel 3/3 als een
// geldige ontsnappingsgolf, dat het punt pas na de aankondigingsduur
// verschijnt (zowel via directe functie-aanroepen als via een ECHTE,
// wall-clock-gedreven gameLoop — de klok-vs-dt-les), dat alles weer sluit
// (met vertrek-tell) zodra de golf niet langer een ontsnappingsgolf is, de
// eenmalige golf-10-melding, en de HUD in alle standen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. isOntsnappingsGolf(): pure tabeltest --------------------------------
const tabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const golven = [1, 9, 10, 11, 12, 13, 14, 17, 18, 21, 22, 25];
  return golven.map(g => ({ golf: g, ontsnappingsGolf: d.isOntsnappingsGolf(g) }));
});
const verwacht = { 1: false, 9: false, 10: true, 11: false, 12: false, 13: false, 14: true, 17: false, 18: true, 21: false, 22: true, 25: false };
check('isOntsnappingsGolf() klopt exact voor golf 1, 9-14, 17-18, 21-22, 25 (start 10, elke 4)',
  tabel.every(r => r.ontsnappingsGolf === verwacht[r.golf]), tabel);
check('ONTSNAPPING_START_GOLF is exact 10 en ONTSNAPPING_INTERVAL_GOLVEN is exact 4', await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.ONTSNAPPING_START_GOLF === 10 && d.ONTSNAPPING_INTERVAL_GOLVEN === 4;
}), null);

// --- 2. golvenTotOntsnappingsVenster(): pure tabeltest ----------------------
const golvenTabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const golven = [1, 9, 10, 11, 13, 14];
  return golven.map(g => ({ golf: g, resterend: d.golvenTotOntsnappingsVenster(g) }));
});
const verwachtResterend = { 1: 9, 9: 1, 10: 0, 11: 3, 13: 1, 14: 0 };
check('golvenTotOntsnappingsVenster() telt exact af naar het eerstvolgende venster (0 tijdens het venster zelf)',
  golvenTabel.every(r => r.resterend === verwachtResterend[r.golf]), golvenTabel);

// Kleine opruimhelper: verwijdert een eventueel bestaand ontsnappingspunt
// ECHT uit interactiePunten (i.p.v. alleen de losse variabele te nullen) en
// annuleert een eventuele lopende aankondiging, zodat elke check met schone
// staat begint — zelfde discipline als de productiecode zelf (T45/T54's
// eigen splice-patroon).
async function opruimOntsnapping() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const i = d.interactiePunten.indexOf(d.ontsnappingsPunt);
    if (i !== -1) d.interactiePunten.splice(i, 1);
    d.ontsnappingsPunt = null;
    d.ontsnappingAankondigingActief = false;
    d.ontsnappingAankondigingTimer = 0;
  });
}

// --- 3. Met 3/3 én een geldige ontsnappingsgolf: NIET meteen het punt, maar
// eerst de T55-aankondigingsfase (hoorn + banner + actieve timer) ----------
await opruimOntsnapping();
const metBeideTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  const hoornVoor = d.bootHoornTeller;
  d.updateOntsnappingsVenster();
  return {
    puntBestaatNog: d.ontsnappingsPunt !== null,
    aankondigingActief: d.ontsnappingAankondigingActief,
    timerOpVolleDuur: d.ontsnappingAankondigingTimer === d.ONTSNAPPING_AANKONDIGING_DUUR,
    hoornGespeeld: d.bootHoornTeller - hoornVoor === 1,
    hud: document.getElementById('ontsnappingVensterUI').textContent,
  };
});
check('Met 3/3 onderdelen én golf 10: het punt verschijnt NIET meteen',
  metBeideTest.puntBestaatNog === false, metBeideTest);
check('In plaats daarvan start de aankondigingsfase, met de volle duur op de timer',
  metBeideTest.aankondigingActief && metBeideTest.timerOpVolleDuur, metBeideTest);
check('De boothoorn speelt precies 1x bij het starten van de aankondiging',
  metBeideTest.hoornGespeeld, metBeideTest);
check('De HUD toont "Boot nadert…" tijdens de aankondiging',
  metBeideTest.hud === 'Boot nadert…', metBeideTest);

// --- 3b. Na afloop van de aankondigingsduur verschijnt het ECHTE punt -----
const naAankondigingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateOntsnappingAankondiging(d.ONTSNAPPING_AANKONDIGING_DUUR + 0.1);   // duwt 'm over de duur heen
  return {
    aankondigingNietMeerActief: d.ontsnappingAankondigingActief === false,
    puntBestaat: d.ontsnappingsPunt !== null,
    hud: document.getElementById('ontsnappingVensterUI').textContent,
  };
});
check('Na het verstrijken van ONTSNAPPING_AANKONDIGING_DUUR stopt de aankondiging',
  naAankondigingTest.aankondigingNietMeerActief, naAankondigingTest);
check('...en verschijnt PAS DAN het echte interactiepunt',
  naAankondigingTest.puntBestaat, naAankondigingTest);
check('De HUD toont nu "Boot ligt aan!"',
  naAankondigingTest.hud === 'Boot ligt aan!', naAankondigingTest);

// --- 4. Zonder 3/3 (ook al is het een ontsnappingsgolf): geen aankondiging,
// geen punt -------------------------------------------------------------
await opruimOntsnapping();
const zonderDrieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 2;
  d.spelStaat.golf = 10;
  d.updateOntsnappingsVenster();
  return { puntBestaat: d.ontsnappingsPunt !== null, aankondigingActief: d.ontsnappingAankondigingActief };
});
check('Zonder 3/3 onderdelen start GEEN aankondiging en verschijnt GEEN punt, ook al is golf 10 een ontsnappingsgolf',
  zonderDrieTest.puntBestaat === false && zonderDrieTest.aankondigingActief === false, zonderDrieTest);

// --- 5. Met 3/3 maar BUITEN een ontsnappingsgolf: geen aankondiging, geen
// punt --------------------------------------------------------------------
await opruimOntsnapping();
const buitenVensterTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 11;   // net na golf 10, geen ontsnappingsgolf
  d.updateOntsnappingsVenster();
  return {
    puntBestaat: d.ontsnappingsPunt !== null,
    aankondigingActief: d.ontsnappingAankondigingActief,
    hud: document.getElementById('ontsnappingVensterUI').textContent,
  };
});
check('Met 3/3 onderdelen maar buiten een ontsnappingsgolf (golf 11): geen aankondiging, geen punt',
  buitenVensterTest.puntBestaat === false && buitenVensterTest.aankondigingActief === false, buitenVensterTest);
check('De HUD toont in dat geval "Boot over 3 golven" (eerstvolgende venster op golf 14)',
  buitenVensterTest.hud === 'Boot over 3 golven', buitenVensterTest);

// --- 6. Vóór golf 10 blijft de HUD leeg (nog niet "ontgrendeld") -----------
await opruimOntsnapping();
const voorTienHudTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 3;
  d.updateOntsnappingVensterHUD();
  return { hud: document.getElementById('ontsnappingVensterUI').textContent };
});
check('Vóór golf 10 (nog niet ontgrendeld) blijft de HUD-indicatie leeg',
  voorTienHudTest.hud === '', voorTienHudTest);

// --- 7. Het venster sluit weer zodra de golf niet langer een
// ontsnappingsgolf is — via een ECHTE wave-complete-transitie in
// updateGolf(); mét de T55-vertrek-tell (geluid + banner) ------------------
await opruimOntsnapping();
const sluitTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  // Rechtstreeks het punt laten verschijnen (bypasst hier bewust de T55-
  // aankondiging — die is al gedekt in check 3/3b hierboven; dit blok focust
  // puur op de sluit-/vertreklogica in updateGolf()).
  d.toonOntsnappingspuntIndienKlaar();
  const puntVoorWave = d.ontsnappingsPunt;
  const vertrekVoor = d.bootVertrekTeller;
  // Wave-complete-conditie forceren: geen ondoden meer, budget op, golf actief.
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;
  d.spelStaat.spawnTimer = 999;
  d.updateGolf(0.016);
  return {
    puntVoorWaveBestond: puntVoorWave !== null,
    golfNa: d.spelStaat.golf,
    puntNa: d.ontsnappingsPunt,
    interactiePuntenBevatNietMeer: !d.interactiePunten.includes(puntVoorWave),
    hudNa: document.getElementById('ontsnappingVensterUI').textContent,
    vertrekGespeeld: d.bootVertrekTeller - vertrekVoor === 1,
  };
});
check('Vóór de wave-complete-transitie bestond het punt (golf 10)', sluitTest.puntVoorWaveBestond, sluitTest);
check('Na de wave-complete-transitie is golf 11 bereikt (geen ontsnappingsgolf meer)',
  sluitTest.golfNa === 11, sluitTest);
check('De boot vaart weer weg: het punt is verwijderd (ontsnappingsPunt === null, uit interactiePunten)',
  sluitTest.puntNa === null && sluitTest.interactiePuntenBevatNietMeer, sluitTest);
check('De HUD volgt mee: weer "Boot over N golven" i.p.v. "Boot ligt aan!"',
  sluitTest.hudNa === 'Boot over 3 golven', sluitTest);
check('Het vertrek-geluid speelt precies 1x, symmetrisch met de aankomst',
  sluitTest.vertrekGespeeld, sluitTest);

// --- 7b. Een aankondiging die nog loopt wanneer de golf eindigt wordt stil
// geannuleerd (geen punt, geen vertrek-tell — er is nog niets aangekomen) --
await opruimOntsnapping();
const annuleerTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  d.updateOntsnappingsVenster();   // start de aankondiging, NIET afwachten
  const aankondigingVoor = d.ontsnappingAankondigingActief;
  const vertrekVoor = d.bootVertrekTeller;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;
  d.spelStaat.spawnTimer = 999;
  d.updateGolf(0.016);
  return {
    aankondigingVoor,
    aankondigingNa: d.ontsnappingAankondigingActief,
    puntNa: d.ontsnappingsPunt,
    geenVertrekGespeeld: d.bootVertrekTeller === vertrekVoor,
  };
});
check('De aankondiging was actief vóór de wave-complete-transitie', annuleerTest.aankondigingVoor, annuleerTest);
check('Een nog lopende aankondiging wordt stil geannuleerd als de golf eindigt (geen punt, geen vertrek-geluid)',
  annuleerTest.aankondigingNa === false && annuleerTest.puntNa === null && annuleerTest.geenVertrekGespeeld, annuleerTest);

// --- 8. De golf-10-melding vuurt precies 1x, ook bij herhaalde
// startGolf()-achtige aanroepen op dezelfde en latere ontsnappingsgolven ---
await opruimOntsnapping();
const meldingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingUitgelegd = false;
  const voor = d.ontsnappingUitlegTeller;
  d.spelStaat.golf = 10;
  d.updateOntsnappingsVenster();
  d.updateOntsnappingsVenster();
  const naGolf10 = d.ontsnappingUitlegTeller - voor;
  d.spelStaat.golf = 14;   // de volgende ontsnappingsgolf
  d.updateOntsnappingsVenster();
  const naGolf14 = d.ontsnappingUitlegTeller - voor;
  return { naGolf10, naGolf14 };
});
check('De golf-10-melding vuurt precies 1x, ook al draait updateOntsnappingsVenster() twee keer op golf 10',
  meldingTest.naGolf10 === 1, meldingTest);
check('Op een latere ontsnappingsgolf (14) vuurt de melding NIET nogmaals',
  meldingTest.naGolf14 === 1, meldingTest);

await browser.close();

// --- 9. Klok-vs-dt-les: de aankondigingstimer via de ECHTE, draaiende
// gameLoop (wall-clock waitForTimeout), niet via directe functie-aanroepen —
// dekt de daadwerkelijke gameLoop-bedrading (updateOntsnappingAankondiging(dt)
// in de spelActief-tak) die de checks hierboven met directe aanroepen niet
// raken. ---------------------------------------------------------------
const { browser: b2, page: p2, errs: errs2 } = await openAmsterdamUndead({ simuleerPointerLock: true });
await p2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  d.updateOntsnappingsVenster();
});
const meteenNaStart = await p2.evaluate(() => window.AmsterdamUndeadDebug.ontsnappingsPunt !== null);
check('Direct na het starten van de aankondiging (echte gameLoop) bestaat het punt nog niet',
  meteenNaStart === false, { meteenNaStart });
// Klok-vs-dt-les: gameLoop's dt is per frame gekapt op 0.05s (tegen spikes na
// alt-tab/lag) — in deze headless omgeving loopt requestAnimationFrame merkbaar
// trager dan 20fps, dus de gesimuleerde spel-tijd loopt duidelijk trager dan
// de echte wall-clock (empirisch ~0.45 gesimuleerde seconde per reële
// seconde). Ruim marge nemen i.p.v. exact ONTSNAPPING_AANKONDIGING_DUUR
// wachten, anders is deze test zelf flaky i.p.v. de code.
await p2.waitForTimeout(2000);   // ruim binnen de duur (~0.9s gesimuleerd): nog geen punt
const nogNiet = await p2.evaluate(() => window.AmsterdamUndeadDebug.ontsnappingsPunt !== null);
check('Ruim binnen de aankondigingsduur (2s wall-clock) bestaat het punt nog steeds niet',
  nogNiet === false, { nogNiet });
await p2.waitForTimeout(13000);   // +13s wall-clock (~5.9s gesimuleerd extra) ruim voorbij de 5s-duur
const uiteindelijkWel = await p2.evaluate(() => window.AmsterdamUndeadDebug.ontsnappingsPunt !== null);
check('Na de volledige ONTSNAPPING_AANKONDIGING_DUUR (via de echte gameLoop) verschijnt het punt vanzelf',
  uiteindelijkWel === true, { uiteindelijkWel });
await b2.close();

const fails = report([...errs, ...errs2]);
process.exit(fails > 0 ? 1 : 0);
