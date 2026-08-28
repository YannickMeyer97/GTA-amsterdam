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
  const sluiper = d.spawnOndode(0, 'sluiper');
  // Snelheid gelijktrekken zodat alleen het gang-ritme (pasFactor) overblijft.
  normaal.snelheid = 2; sjouwer.snelheid = 2; sluiper.snelheid = 2;
  const faseVoor = { normaal: normaal.loopFase, sjouwer: sjouwer.loopFase, sluiper: sluiper.loopFase };
  for (let i = 0; i < 10; i++) d.updateOndoden(0.05);
  const deltaNormaal = normaal.loopFase - faseVoor.normaal;
  const deltaSjouwer = sjouwer.loopFase - faseVoor.sjouwer;
  const deltaSluiper = sluiper.loopFase - faseVoor.sluiper;
  return { deltaNormaal, deltaSjouwer, deltaSluiper };
});
check('Sjouwer (pasFactor 0.8) bouwt loopFase merkbaar TRAGER op dan normaal (pasFactor 1) bij gelijke snelheid',
  pasTest.deltaSjouwer < pasTest.deltaNormaal * 0.85, pasTest);
check('Sluiper (pasFactor 1.4) bouwt loopFase merkbaar SNELLER op dan normaal bij gelijke snelheid',
  pasTest.deltaSluiper > pasTest.deltaNormaal * 1.15, pasTest);

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

// --- Ticket 150: type-persoonlijkheid op de drie assen die T148/T149
// toevoegden. Alledrie zijn zuivere vermenigvuldigers uit
// ONDODE_TYPES[..].gang op writes die er al stonden — deze tests meten dus
// het EFFECT in de animatie, niet de tabelwaarde zelf (die zou een
// tautologie zijn). Elke spawnOndode() hieronder krijgt expliciet het
// 'standaard'-profiel (i.p.v. de default willekeurige kiesOndodeTraits()):
// zonder dat kiest de loting soms 'eenarmig' (delen.armL bestaat dan niet),
// wat deze drie metingen — die allemaal delen.armL/pelvis lezen — flaky
// maakte. Puur een testfix, geen gedragswijziging. ------------------------

// 5. gewichtFactor: zijwaartse pelvis-uitslag over een volledige loopcyclus,
// bij GELIJKE snelheid (isoleert het gewicht van pasFactor/snelheid).
const gewichtTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of ['normaal', 'sjouwer', 'brander', 'sluiper']) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, type, { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false });
    o.groep.position.set(0, 0, -14);
    o.snelheid = 2;
    let maxAbs = 0;
    for (let i = 0; i < 120; i++) {
      d.updateOndoden(0.05);
      if (o.delen.pelvis) maxAbs = Math.max(maxAbs, Math.abs(o.delen.pelvis.position.x));
    }
    uit[type] = maxAbs;
  }
  return uit;
});
check('Sjouwer helt per pas duidelijk verder zijwaarts over dan normaal (gewichtFactor 1.9)',
  gewichtTest.sjouwer > gewichtTest.normaal * 1.5, gewichtTest);
check('Sluiper glijdt: de laagste zijwaartse gewichtsoverdracht van alle types',
  gewichtTest.sluiper < gewichtTest.normaal * 0.5
  && Math.min(...Object.values(gewichtTest)) === gewichtTest.sluiper, gewichtTest);
check('Brander is topzwaar: meer overhelling dan normaal, minder dan de Sjouwer',
  gewichtTest.brander > gewichtTest.normaal && gewichtTest.brander < gewichtTest.sjouwer, gewichtTest);

// 6. anticipatieExponent: hoe ver is de arm geheven op de HELFT van de eigen
// windup? Genormaliseerd als fractie van de volle heffing, zodat types met
// een verschillende windup-DUUR (0,30s vs 0,85s) eerlijk vergelijkbaar zijn —
// dit meet puur de vorm van de curve, niet de lengte van de windup.
const anticipatieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of ['normaal', 'sjouwer', 'brander', 'sluiper']) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.speler.positie.set(0, 0, 0);
    const o = d.spawnOndode(0, type, { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false });
    o.groep.position.set(0, 0, -1.0);
    o.aanvalVertraging = 0;
    const dt = 1 / 60;
    let n = 0;
    while (o.aanvalStaat !== 'windup' && n < 5) { d.updateOndoden(dt); n++; }
    const windupDuur = d.AANVAL_PROFIELEN[type].windup;
    for (let i = 0; i < Math.round((windupDuur / 2) / dt); i++) d.updateOndoden(dt);
    uit[type] = (o.delen.armL.rotation.x - d.ARM_RUST_ROTATIE_X)
      / (d.AANVAL_ARM_HOEK_WINDUP - d.ARM_RUST_ROTATIE_X);
  }
  return uit;
});
check('Sjouwer telegrafeert het duidelijkst: arm al ruim over de helft geheven halverwege zijn windup (exponent < 1)',
  anticipatieTest.sjouwer > 0.55 && anticipatieTest.sjouwer > anticipatieTest.normaal, anticipatieTest);
check('Sluiper kondigt het minst aan: arm nog nauwelijks geheven halverwege (hoogste exponent)',
  anticipatieTest.sluiper < 0.25
  && Math.min(...Object.values(anticipatieTest)) === anticipatieTest.sluiper, anticipatieTest);
check('normaal houdt exact de globale AANVAL_ANTICIPATIE_EXPONENT aan (basislijn ongewijzigd)',
  Math.abs(anticipatieTest.normaal - Math.pow(0.5, await page.evaluate(() => window.AmsterdamUndeadDebug.AANVAL_ANTICIPATIE_EXPONENT))) < 0.02,
  anticipatieTest);

// 7. flinchFactor: romp-twist vlak na een OVERLEEFDE lichaamstreffer.
const flinchTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of ['normaal', 'sjouwer', 'brander', 'sluiper']) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.speler.positie.set(0, 0, 0);
    const o = d.spawnOndode(0, type, { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false });
    o.groep.position.set(0, 0, -6);
    o.hp = 99;   // moet de treffer overleven, anders is er geen flinch
    d.raakOndode(o, o.groep.position, false, 1, false, 0);
    d.updateOndoden(1 / 60);
    uit[type] = o.delen.romp.rotation.y;
  }
  return uit;
});
check('Sjouwer is nauwelijks te verzetten: de kleinste flinch-uitslag van alle types',
  flinchTest.sjouwer < flinchTest.normaal * 0.6
  && Math.min(...Object.values(flinchTest)) === flinchTest.sjouwer, flinchTest);
check('Brander lurcht het hardst (visuele hint dat hij instabiel is)',
  Math.max(...Object.values(flinchTest)) === flinchTest.brander, flinchTest);

// 8. Acceptatiecriterium "alle gameplaymultipliers ongewijzigd" — de
// persoonlijkheid mag uitsluitend in presentatie zitten, nooit in balans.
const statsOngewijzigd = await page.evaluate(() => {
  const t = window.AmsterdamUndeadDebug.ONDODE_TYPES;
  return {
    normaal: [t.normaal.snelheidMultiplier, t.normaal.hpMultiplier, t.normaal.geldMultiplier],
    sjouwer: [t.sjouwer.snelheidMultiplier, t.sjouwer.hpMultiplier, t.sjouwer.geldMultiplier, t.sjouwer.hpMax],
    brander: [t.brander.snelheidMultiplier, t.brander.hpMultiplier, t.brander.geldMultiplier],
    sluiper: [t.sluiper.snelheidMultiplier, t.sluiper.hpMultiplier, t.sluiper.geldMultiplier],
  };
});
check('Ticket 150 raakt geen enkele gameplaymultiplier (snelheid/HP/geld/hpMax onveranderd)',
  JSON.stringify(statsOngewijzigd) === JSON.stringify({
    normaal: [1, 1, 1], sjouwer: [0.55, 2.5, 2.2, 8],
    brander: [1, 1, 1.3], sluiper: [1.35, 0.75, 1.1],
  }), statsOngewijzigd);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
