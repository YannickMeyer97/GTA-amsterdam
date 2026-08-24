// Sfeer S2 (Ticket 39): vijandleesbaarheid — gang-ritme, geluid, mist-ogen.
// Bewaakt: per-type pasFactor/bobFactor meetbaar in de animatie-writes, de
// Sluiper gromt nooit (binnen 8m, 60 gesimuleerde seconden) terwijl andere
// types wél groms produceren, en de Mistgolf boost/herstelt de oog-
// intensiteit voor alle levende ondoden én voor nieuwe mist-spawns — incl.
// het randgeval waarbij mist eindigt midden in een windup/herstel-oogpuls.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. pasFactor: loopFase-groeisnelheid verschilt per type bij GELIJKE
// snelheid (isoleert het gang-ritme van de eigen snelheidMultiplier) -------
const pasTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const normaal = d.spawnOndode(0, 'normaal');
  const sjouwer = d.spawnOndode(0, 'sjouwer');
  const loper = d.spawnOndode(0, 'loper');
  // Snelheid gelijktrekken zodat alleen het gang-ritme (pasFactor) overblijft.
  normaal.snelheid = 2; sjouwer.snelheid = 2; loper.snelheid = 2;
  const faseVoor = { normaal: normaal.loopFase, sjouwer: sjouwer.loopFase, loper: loper.loopFase };
  for (let i = 0; i < 10; i++) d.updateOndoden(0.05);
  const deltaNormaal = normaal.loopFase - faseVoor.normaal;
  const deltaSjouwer = sjouwer.loopFase - faseVoor.sjouwer;
  const deltaLoper = loper.loopFase - faseVoor.loper;
  return { deltaNormaal, deltaSjouwer, deltaLoper };
});
check('Sjouwer (pasFactor 0.8) bouwt loopFase merkbaar TRAGER op dan normaal (pasFactor 1) bij gelijke snelheid',
  pasTest.deltaSjouwer < pasTest.deltaNormaal * 0.85, pasTest);
check('Loper (pasFactor 1.25) bouwt loopFase merkbaar SNELLER op dan normaal bij gelijke snelheid',
  pasTest.deltaLoper > pasTest.deltaNormaal * 1.15, pasTest);

// --- 2. Sjouwer-romp-bob-amplitude >= 1.5x die van normaal -----------------
const bobTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const normaal = d.spawnOndode(0, 'normaal');
  const sjouwer = d.spawnOndode(0, 'sjouwer');
  normaal.snelheid = 2; sjouwer.snelheid = 2;
  let piekNormaal = 0, piekSjouwer = 0;
  const baseYNormaal = normaal.delen.romp.userData.baseY, baseYSjouwer = sjouwer.delen.romp.userData.baseY;
  for (let i = 0; i < 60; i++) {
    d.updateOndoden(0.03);
    piekNormaal = Math.max(piekNormaal, normaal.delen.romp.position.y - baseYNormaal);
    piekSjouwer = Math.max(piekSjouwer, sjouwer.delen.romp.position.y - baseYSjouwer);
  }
  return { piekNormaal, piekSjouwer, verhouding: piekSjouwer / piekNormaal };
});
check('Sjouwer-romp-bob-piekamplitude is minstens 1.5x die van de normale ondode',
  bobTest.verhouding >= 1.5, bobTest);

// --- 3. Sluiper gromt NOOIT binnen 8m over 60 gesimuleerde seconden;
// andere types WEL (debug-teller) -------------------------------------------
function gromCode(type) {
  return `
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, '${type}');
    o.groep.position.set(d.speler.positie.x + 1, 0, d.speler.positie.z + 1);   // ruim < 8m
    o.gromTimer = 0.01;   // eerste check meteen
    const tellerVoor = d.ondodeGromTeller;
    for (let i = 0; i < 1200; i++) d.updateOndoden(0.05);   // 60s gesimuleerd
    return d.ondodeGromTeller - tellerVoor;
  `;
}
const sluiperGroms = await page.evaluate(new Function(gromCode('sluiper')));
const normaalGroms = await page.evaluate(new Function(gromCode('normaal')));
check('De Sluiper roept in 60 gesimuleerde seconden binnen 8m NOOIT speelOndodeGrom() aan',
  sluiperGroms === 0, { sluiperGroms });
check('Normaal roept in dezelfde 60 seconden binnen 8m WEL speelOndodeGrom() aan',
  normaalGroms > 0, { normaalGroms });

// --- 4. Grom-globale-cap: nooit sneller dan 1 grom per 0.6s ---------------
const capTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  // Twee ondoden vlak bij de speler, allebei met een meteen-afgelopen timer.
  const o1 = d.spawnOndode(0, 'normaal');
  const o2 = d.spawnOndode(0, 'sjouwer');
  for (const o of [o1, o2]) {
    o.groep.position.set(d.speler.positie.x + 0.5, 0, d.speler.positie.z + 0.5);
    o.gromTimer = 0.01;
    // Fix (flaky test, gevonden bij T132): op deze afstand (~0,7m) vallen
    // beide ondoden binnen AANVAL_START_BEREIK (1,4m), en spawnOndode() geeft
    // ze een willekeurige aanvalVertraging (0..AANVAL_START_JITTER = 0,35s).
    // Rolt die ≤ dt (0,05s), dan start updateOndoden() in DEZELFDE tick een
    // windup en `continue`t vóórdat de grom-code (verderop in de functie)
    // ooit bereikt wordt — ~14,3% kans per ondode, dus ~2% kans dat het BEIDE
    // overkomt en tellerNa op 0 uitkomt i.p.v. de bedoelde 1. Deze test gaat
    // over de grom-cap, niet over de aanvalstiming; zet de vertraging hier
    // expliciet ruim boven dt zodat geen van beide per ongeluk in windup kan
    // vallen — dezelfde soort determinisme-fix als NEUTRALE_TRAITS elders in
    // de suite (bv. test-camerabeweging.mjs).
    o.aanvalVertraging = 999;
  }
  d.laatsteGromKlok = -999;
  const tellerVoor = d.ondodeGromTeller;
  d.updateOndoden(0.05);   // beide timers lopen deze tick af
  return { tellerNa: d.ondodeGromTeller - tellerVoor };
});
check('Twee ondoden met een gelijktijdig verlopen grom-timer geven toch maar 1 grom (globale cap)',
  capTest.tellerNa === 1, capTest);

// --- 5. Mistgolf: oogboost voor levende ondoden + nieuwe mist-spawns,
// exacte terugkeer bij het einde ------------------------------------------
const mistTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const bestaand = d.spawnOndode(0, 'normaal');
  const voorMist = bestaand.delen.oogMateriaal.emissiveIntensity;

  d.startEventGolf('mist');
  const naStartBestaand = bestaand.delen.oogMateriaal.emissiveIntensity;
  const naStartBasisVeld = bestaand.oogBasisIntensiteit;

  const nieuweTijdensMist = d.spawnOndode(0, 'sluiper');
  const nieuweIntensiteit = nieuweTijdensMist.delen.oogMateriaal.emissiveIntensity;
  const nieuweBasisVeld = nieuweTijdensMist.oogBasisIntensiteit;

  d.eindigEventGolf(true);
  const naEindeBestaand = bestaand.delen.oogMateriaal.emissiveIntensity;
  const naEindeNieuw = nieuweTijdensMist.delen.oogMateriaal.emissiveIntensity;

  return { voorMist, naStartBestaand, naStartBasisVeld, nieuweIntensiteit, nieuweBasisVeld, naEindeBestaand, naEindeNieuw };
});
check('Vóór de mist staat de oog-intensiteit op de basiswaarde (1.4)',
  mistTest.voorMist === 1.4, mistTest);
check('startEventGolf("mist") boost een AL LEVENDE ondode meteen naar 2.6 (material + oogBasisIntensiteit)',
  mistTest.naStartBestaand === 2.6 && mistTest.naStartBasisVeld === 2.6, mistTest);
check('Een ondode die TIJDENS de mist spawnt, begint meteen op 2.6 (material + oogBasisIntensiteit)',
  mistTest.nieuweIntensiteit === 2.6 && mistTest.nieuweBasisVeld === 2.6, mistTest);
check('eindigEventGolf() herstelt beide ondoden exact terug naar 1.4',
  mistTest.naEindeBestaand === 1.4 && mistTest.naEindeNieuw === 1.4, mistTest);

// --- 6. Randgeval: mist eindigt MIDDEN in een windup-oogpuls — de puls
// rekent daarna gewoon weer vanaf de (herstelde) basiswaarde 1.4 -----------
const randgevalTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.startEventGolf('mist');
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(d.speler.positie.x, 0, d.speler.positie.z - 1);
  o.aanvalVertraging = 0;
  // Echte jaag -> windup-overgang forceren (zelfde patroon als bestaande T30-tests).
  let ticks = 0;
  while (o.aanvalStaat !== 'windup' && ticks < 200) { d.updateOndoden(0.02); ticks++; }
  const inWindupTijdensMist = { staat: o.aanvalStaat, oogTijdensWindup: o.delen.oogMateriaal.emissiveIntensity };
  // Mist eindigt terwijl de windup nog loopt.
  d.eindigEventGolf(true);
  const basisNaMistEinde = o.oogBasisIntensiteit;
  // Windup afmaken en de herstel-fase induiken.
  const profielWindup = d.AANVAL_PROFIELEN.normaal.windup;
  ticks = 0;
  while (o.aanvalStaat === 'windup' && ticks < 200) { d.updateOndoden(0.02); ticks++; }
  ticks = 0;
  while (o.aanvalStaat === 'herstel' && ticks < 500) { d.updateOndoden(0.02); ticks++; }
  return {
    inWindupTijdensMist, basisNaMistEinde,
    naHerstelStaat: o.aanvalStaat,
    naHerstelOog: o.delen.oogMateriaal.emissiveIntensity,
  };
});
check('Tijdens de mist bereikt de windup-oogpuls (correct) de piek van 2.6',
  randgevalTest.inWindupTijdensMist.staat === 'windup' && randgevalTest.inWindupTijdensMist.oogTijdensWindup > 2.0, randgevalTest);
check('Zodra de mist eindigt (ook midden in windup) staat oogBasisIntensiteit weer op 1.4',
  randgevalTest.basisNaMistEinde === 1.4, randgevalTest);
check('Na de volledige windup+herstel is de ondode terug in "jaag" met de oogintensiteit EXACT op 1.4 (niet op de oude mist-waarde)',
  randgevalTest.naHerstelStaat === 'jaag' && randgevalTest.naHerstelOog === 1.4, randgevalTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
