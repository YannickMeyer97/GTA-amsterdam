// Ticket 82: het geluid van Amsterdam — een vijfde, permanente audiolaag
// (stadGainNode) met een vast plafond (0.03, aantoonbaar onder het
// gromvolume 0.035-0.045) en twee zeldzame, willekeurig getimede
// gebeurtenissen (verre scheepshoorn, verre stadsklok) die BUITEN de
// gromband (120-340 Hz) blijven en via stadGainNode -> masterGainNode lopen
// (nooit rechtstreeks audio.destination). Zie ROADMAP.md Ticket 82 en
// ARCHITECTURE_NOTES.md §9.4.2.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Plafond: aantoonbaar onder het gromvolume, en past ruim onder de
// bestaande vier lagen (geen overstemming). ---------------------------------
const plafondTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    plafond: d.STADSBED_VOLUME_PLAFOND,
    dreiging: d.DREIGINGS_VOLUME_PLAFOND,
    muziek: d.MUZIEK_VOLUME_PLAFOND,
  };
});
check('STADSBED_VOLUME_PLAFOND (0.03) ligt onder het KLEINSTE gromvolume (0.035, de Loper)',
  plafondTest.plafond < 0.035, plafondTest);
check('STADSBED_VOLUME_PLAFOND + dreiging + muziek blijft ruim onder 1.0 (geen overstemming)',
  plafondTest.plafond + plafondTest.dreiging + plafondTest.muziek < 0.2, plafondTest);

// --- 2. Bron-check: stadPiep() loopt via stadGainNode, nooit rechtstreeks
// op masterGainNode of audio.destination. -----------------------------------
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bron = d.stadPiep.toString();
  const initBron = d.initGeluid.toString();
  return {
    connectStadGainNode: /connect\(stadGainNode\)/.test(bron),
    geenDirecteMasterGain: !/connect\(masterGainNode\)/.test(bron),
    geenDirecteDestination: !/connect\(audio\.destination\)/.test(bron),
    stadGainNodeOpMasterGain: /stadGainNode\.connect\(masterGainNode\)/.test(initBron),
  };
});
check('stadPiep() connect op stadGainNode', bronTest.connectStadGainNode, bronTest);
check('stadPiep() connect NIET rechtstreeks op masterGainNode', bronTest.geenDirecteMasterGain, bronTest);
check('stadPiep() connect NIET rechtstreeks op audio.destination', bronTest.geenDirecteDestination, bronTest);
check('stadGainNode zelf connect op masterGainNode (in initGeluid())', bronTest.stadGainNodeOpMasterGain, bronTest);

// --- 3. Frequentie-check: beide gebeurtenissen blijven buiten de gromband
// (120-340 Hz), zodat een speler ze nooit met een grom kan verwarren. -------
const freqTest = await page.evaluate(() => new Promise((resolve) => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.stadGainNode.context;
  const orig = ctx.createOscillator.bind(ctx);
  const freqs = [];
  ctx.createOscillator = (...a) => {
    const o = orig(...a);
    const origSet = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { freqs.push(v); return origSet(v, t); };
    return o;
  };
  d.speelVerreScheepshoorn();
  d.speelVerreStadsklok();
  setTimeout(() => { ctx.createOscillator = orig; resolve({ freqs }); }, 500);
}));
check('Er zijn minstens 3 oscillator-starts gevangen (1 hoorn + 2 stadsklok-tonen)',
  freqTest.freqs.length >= 3, freqTest);
check('Alle gevangen frequenties blijven buiten de gromband (120-340 Hz)',
  freqTest.freqs.every(f => f < 120 || f > 340), freqTest);

// --- 4. Tellers: elke aanroep verhoogt zijn eigen teller met exact 1 -------
const tellerTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const hoornVoor = d.stadHoornTeller, klokVoor = d.stadKlokTeller;
  d.speelVerreScheepshoorn();
  d.speelVerreStadsklok();
  return { hoornNa: d.stadHoornTeller - hoornVoor, klokNa: d.stadKlokTeller - klokVoor };
});
check('speelVerreScheepshoorn() verhoogt stadHoornTeller met exact 1', tellerTest.hoornNa === 1, tellerTest);
check('speelVerreStadsklok() verhoogt stadKlokTeller met exact 1', tellerTest.klokNa === 1, tellerTest);

// --- 5. Throttle: zelfde patroon als test-achtergrondmuziek.mjs -----------
const throttleTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadThrottleTimer = d.STAD_THROTTLE_INTERVAL;   // schone start
  d.stadHoornTimer = 9999; d.stadKlokTimer = 9999;   // geen gebeurtenissen tijdens deze meting
  const schrijvenVoor = d.stadGainSchrijfTeller;
  const perStap = d.STAD_THROTTLE_INTERVAL / 10;
  for (let i = 0; i < 9; i++) d.updateStadsGeluid(perStap);
  const naNegen = d.stadGainSchrijfTeller - schrijvenVoor;
  d.updateStadsGeluid(perStap * 2);
  const naTien = d.stadGainSchrijfTeller - schrijvenVoor;
  return { naNegen, naTien };
});
check('9 aanroepen van elk 1/10e van de throttle-interval schrijven NOG NIET', throttleTest.naNegen === 0, throttleTest);
check('Zodra de opgetelde tijd de interval overschrijdt, schrijft de volgende aanroep precies 1x',
  throttleTest.naTien === 1, throttleTest);
const doelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { stadGainDoel: d.stadGainDoel, plafond: d.STADSBED_VOLUME_PLAFOND };
});
check('De throttled write schrijft altijd exact het plafond (geen andere doelwaarde bestaat)',
  doelTest.stadGainDoel === doelTest.plafond, doelTest);

// --- 6. updateStadsGeluid(): losse, onafhankelijke timers per gebeurtenis --
const timerTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadHoornTimer = 0.001;   // forceer een hoorn deze tick
  d.stadKlokTimer = 9999;     // klok NIET deze tick
  const hoornVoor = d.stadHoornTeller, klokVoor = d.stadKlokTeller;
  d.updateStadsGeluid(0.01);
  return {
    hoornNa: d.stadHoornTeller - hoornVoor,
    klokNa: d.stadKlokTeller - klokVoor,
    nieuweHoornTimer: d.stadHoornTimer,
  };
});
check('Alleen de verlopen timer (hoorn) triggert, de klok-timer blijft met rust',
  timerTest.hoornNa === 1 && timerTest.klokNa === 0, timerTest);
check('Na een trigger wordt een nieuwe, willekeurige hoorn-timer binnen het interval gepland',
  timerTest.nieuweHoornTimer >= 50 && timerTest.nieuweHoornTimer <= 110, timerTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
