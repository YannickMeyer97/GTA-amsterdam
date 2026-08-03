// Ticket 66: permanente achtergrondmuziek-laag — een eigen akkoordbed
// (drie sines, A-mineur-triade) door een eigen gainNode, zelfde
// nooit-gestopt/herstart-patroon als de bestaande dreigingsdrone (Ticket 49),
// met een eigen volumeplafond (0.05) en een aparte, langzamere glijtijd. De
// gain-doelwaarde volgt de spelfase: zachter tijdens een golf-aankondiging,
// voller zodra er ondoden actief zijn, anders een rustig basisniveau.
// Zie ROADMAP.md Ticket 66 en ARCHITECTURE_NOTES.md §7.7.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. berekenMuziekGain(): pure functie, exact -------------------------
const formule = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    rustGeenOndoden: d.berekenMuziekGain(false, 0),
    combatMetOndoden: d.berekenMuziekGain(false, 3),
    aankondigingGeenOndoden: d.berekenMuziekGain(true, 0),
    aankondigingMetOndoden: d.berekenMuziekGain(true, 5),   // aankondiging wint altijd
    plafond: d.MUZIEK_VOLUME_PLAFOND,
    rust: d.MUZIEK_VOLUME_RUST,
    aankondiging: d.MUZIEK_VOLUME_AANKONDIGING,
  };
});
check('Geen aankondiging, geen ondoden: rustniveau (0.03)', formule.rustGeenOndoden === 0.03, formule);
check('Geen aankondiging, wel ondoden: volle plafond (0.05)', formule.combatMetOndoden === 0.05, formule);
check('Tijdens aankondiging (geen ondoden): zachter (0.015)', formule.aankondigingGeenOndoden === 0.015, formule);
check('Aankondiging wint altijd, ook met veel ondoden actief', formule.aankondigingMetOndoden === 0.015, formule);
check('MUZIEK_VOLUME_PLAFOND (0.05) < DREIGINGS_VOLUME_PLAFOND (0.07), en samen ruim onder 1.0 (niet overstemmend)',
  formule.plafond === 0.05 && formule.plafond + 0.07 < 0.2, formule);
check('MUZIEK_VOLUME_RUST < MUZIEK_VOLUME_PLAFOND en MUZIEK_VOLUME_AANKONDIGING < MUZIEK_VOLUME_RUST (duidelijke trapjes)',
  formule.aankondiging < formule.rust && formule.rust < formule.plafond, formule);

// --- 2. Throttle: zelfde patroon als de dreigingsdrone-test ---------------
const throttleTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.muziekThrottleTimer = d.MUZIEK_THROTTLE_INTERVAL;   // schone start
  const schrijvenVoor = d.muziekGainSchrijfTeller;
  const perStap = d.MUZIEK_THROTTLE_INTERVAL / 10;
  for (let i = 0; i < 9; i++) d.updateAchtergrondmuziek(perStap);
  const naNegen = d.muziekGainSchrijfTeller - schrijvenVoor;
  d.updateAchtergrondmuziek(perStap * 2);
  const naTien = d.muziekGainSchrijfTeller - schrijvenVoor;
  return { naNegen, naTien };
});
check('9 aanroepen van elk 1/10e van de throttle-interval schrijven NOG NIET', throttleTest.naNegen === 0, throttleTest);
check('Zodra de opgetelde tijd de interval overschrijdt, schrijft de volgende aanroep precies 1x',
  throttleTest.naTien === 1, throttleTest);

// --- 3. updateAchtergrondmuziek() volgt echt ondoden.length + de aankondigingstimer
const inhoudTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.muziekAankondigingTimer = 0;
  d.muziekThrottleTimer = 0;
  d.updateAchtergrondmuziek(0.001);
  const rust = d.muziekGainDoel;

  const o1 = d.spawnOndode(0, 'normaal');
  d.muziekThrottleTimer = 0;
  d.updateAchtergrondmuziek(0.001);
  const metOndode = d.muziekGainDoel;

  d.muziekAankondigingTimer = 2.2;
  d.muziekThrottleTimer = 0;
  d.updateAchtergrondmuziek(0.001);
  const tijdensAankondiging = d.muziekGainDoel;

  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.muziekAankondigingTimer = 0;
  return { rust, metOndode, tijdensAankondiging };
});
check('Geen ondoden: rustniveau (0.03)', inhoudTest.rust === 0.03, inhoudTest);
check('Zodra er een ondode actief is: volle plafond (0.05)', inhoudTest.metOndode === 0.05, inhoudTest);
check('Tijdens een aankondiging (ook met ondode actief): zachter (0.015)', inhoudTest.tijdensAankondiging === 0.015, inhoudTest);

// --- 4. De aankondigingstimer telt elke frame af, ook als de gain-write
// zelf gethrottled is (anders zou de banner al weg zijn voordat de muziek
// het merkt) ----------------------------------------------------------------
const timerAftellenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.muziekAankondigingTimer = 1.0;
  d.muziekThrottleTimer = 999;   // schrijft dus niet mee, timer moet toch aftellen
  d.updateAchtergrondmuziek(0.4);
  const naEen = d.muziekAankondigingTimer;
  d.updateAchtergrondmuziek(0.4);
  const naTwee = d.muziekAankondigingTimer;
  return { naEen, naTwee };
});
check('De aankondigingstimer telt af, ongeacht de gain-write-throttle',
  Math.abs(timerAftellenTest.naEen - 0.6) < 0.001 && timerAftellenTest.naTwee <= 0.2 + 0.001, timerAftellenTest);

// --- 5. toonGolfBanner() zet de aankondigingstimer -------------------------
const bannerTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.muziekAankondigingTimer = 0;
  d.toonGolfBanner('TEST', 'sub');
  return { timerNa: d.muziekAankondigingTimer };
});
check('toonGolfBanner() zet muziekAankondigingTimer op 2.2 (matcht de 2200ms visuele bannerduur)',
  bannerTest.timerNa === 2.2, bannerTest);

// --- 6. Pauze stuurt de doelgain niet actief aan (updateAchtergrondmuziek
// wordt alleen vanuit de spelActief-tak aangeroepen) ------------------------
const pauzeTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o1 = d.spawnOndode(0, 'normaal');
  d.muziekAankondigingTimer = 0;
  d.muziekThrottleTimer = 0;
  d.updateAchtergrondmuziek(0.001);
  const tijdensSpel = d.muziekGainDoel;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return { tijdensSpel };
});
await page.waitForTimeout(150);
const naPauze = await page.evaluate(() => window.AmsterdamUndeadDebug.muziekGainDoel);
check('Vlak vóór de pauze stond de doelgain op 0.05 (een ondode actief)', pauzeTest.tijdensSpel === 0.05, pauzeTest);
check('Na de pauze verandert de doelgain niet meer (updateAchtergrondmuziek loopt niet door)', naPauze === pauzeTest.tijdensSpel, { naPauze, ...pauzeTest });

await page.evaluate(() => {
  // Ticket 67 voegde #minimapUI toe (vóór de renderer-canvas in de DOM),
  // dus expliciet de renderer-canvas i.p.v. de eerste <canvas> in de DOM.
  const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  for (const o of [...window.AmsterdamUndeadDebug.ondoden]) window.AmsterdamUndeadDebug.doodOndode(o);
});

// --- 7. Node-identiteit + source-check: nooit gestopt/herstart -------------
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const initBron = d.initGeluid.toString();
  const updateBron = d.updateAchtergrondmuziek.toString();
  d.initGeluid();   // eerste ECHTE aanroep in deze testrun (helpers.mjs doet dit niet automatisch)
  const nodeVoor = d.muziekGainNode;
  d.initGeluid();   // tweede aanroep: mag geen nieuwe node aanmaken (if (!audio) guard)
  const nodeNa = d.muziekGainNode;
  return {
    initHeeftDrieMuziekStarts: (initBron.match(/muziekOsc\d\.start\(\)/g) || []).length === 3,
    initHeeftGeenStop: !/\.stop\(/.test(initBron),
    updateHeeftGeenStartStop: !/\.start\(|\.stop\(/.test(updateBron),
    zelfdeNode: nodeVoor === nodeNa,
  };
});
check('initGeluid() start precies de drie muziek-oscillators (3x .start())', bronTest.initHeeftDrieMuziekStarts, bronTest);
check('initGeluid() bevat geen .stop()-aanroep', bronTest.initHeeftGeenStop, bronTest);
check('updateAchtergrondmuziek() start/stopt zelf geen oscillators (alleen gain-sturing)', bronTest.updateHeeftGeenStartStop, bronTest);
check('Een tweede initGeluid()-aanroep hergebruikt dezelfde muziekGainNode (geen her-creatie)', bronTest.zelfdeNode, bronTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
