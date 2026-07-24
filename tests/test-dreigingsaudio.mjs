// Ticket 49: dreigingsaudio-laag — zachte drone (twee licht gedetuneerde
// oscillators, nooit herstart) die AAN gaat zodra het dringen wordt vlak bij
// de speler. Tweede feedbackronde: van een continue "meer ondoden/dichterbij
// = meer volume"-formule naar een simpele drempel (2+ ondoden binnen 1.5m ->
// vast volume 0.07, anders stil) — minder subtiel aan/uit-geruis bij elk
// klein beetje dreiging. Getest via de pure helper + debug-getters/tellers,
// niet via echte geluidsmeting (headless Chromium heeft geen audio-output).
// Zie ARCHITECTURE_NOTES.md §6.7 en ROADMAP.md Ticket 49.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. berekenDreigingsGain(): pure drempelfunctie, exact -----------------
const formule = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    leeg: d.berekenDreigingsGain(0),
    een: d.berekenDreigingsGain(1),
    twee: d.berekenDreigingsGain(2),
    drie: d.berekenDreigingsGain(3),
    plafondConstante: d.DREIGINGS_VOLUME_PLAFOND,
    bereikConstante: d.DREIGINGS_NABIJHEID_BEREIK,
    minimumConstante: d.DREIGINGS_NABIJHEID_MINIMUM,
  };
});
check('0 ondoden binnen bereik: gain 0', formule.leeg === 0, formule);
check('1 ondode binnen bereik: nog steeds gain 0 (drempel is 2)', formule.een === 0, formule);
check('2 ondoden binnen bereik: gain springt naar het volle plafond (0.07)',
  formule.twee === 0.07, formule);
check('3 ondoden binnen bereik: gain blijft op het plafond (geen verdere opbouw)',
  formule.drie === 0.07, formule);
check('DREIGINGS_VOLUME_PLAFOND is exact 0.07 (feedback: iets lager dan 0.1)',
  formule.plafondConstante === 0.07, formule);
check('DREIGINGS_NABIJHEID_BEREIK is exact 1.5 (m) en DREIGINGS_NABIJHEID_MINIMUM is exact 2',
  formule.bereikConstante === 1.5 && formule.minimumConstante === 2, formule);

// --- 2. Throttle: snel-achter-elkaar aanroepen met kleine dt schrijft NIET
// bij elke aanroep, pas zodra de opgetelde tijd de interval haalt ----------
const throttleTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.dreigingsThrottleTimer = d.DREIGINGS_THROTTLE_INTERVAL;   // schone start
  const schrijvenVoor = d.dreigingsGainSchrijfTeller;
  const perStap = d.DREIGINGS_THROTTLE_INTERVAL / 10;
  const schrijfMomenten = [];
  for (let i = 0; i < 9; i++) {
    d.updateDreigingsAudio(perStap);
    schrijfMomenten.push(d.dreigingsGainSchrijfTeller - schrijvenVoor);
  }
  // 9 stappen van 1/10e interval = 0.9x interval: nog geen enkele write.
  const naNegen = d.dreigingsGainSchrijfTeller - schrijvenVoor;
  d.updateDreigingsAudio(perStap * 2);   // duwt 'm over de interval-grens
  const naTien = d.dreigingsGainSchrijfTeller - schrijvenVoor;
  return { schrijfMomenten, naNegen, naTien };
});
check('9 aanroepen van elk 1/10e van de throttle-interval schrijven NOG NIET (geen per-frame writes)',
  throttleTest.naNegen === 0, throttleTest);
check('Zodra de opgetelde tijd de interval overschrijdt, schrijft de volgende aanroep precies 1x',
  throttleTest.naTien === 1, throttleTest);

// --- 3. updateDreigingsAudio() telt echt alleen ondoden BINNEN het bereik,
// en gaat pas aan bij de drempel (2), niet eerder --------------------------
const inhoudTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  // Eén ondode ver weg (buiten bereik) + één net binnen 1.5m: dat is pas 1
  // binnen bereik, dus nog geen geluid.
  const verweg = d.spawnOndode(0, 'normaal');
  verweg.groep.position.set(d.speler.positie.x + 10, 0, d.speler.positie.z);
  const dichtbij1 = d.spawnOndode(0, 'normaal');
  dichtbij1.groep.position.set(d.speler.positie.x + 1.0, 0, d.speler.positie.z);
  d.dreigingsThrottleTimer = 0;
  d.updateDreigingsAudio(0.001);
  const bijEen = d.dreigingsGainDoel;

  // Een tweede ondode ook binnen 1.5m erbij: nu 2 binnen bereik -> AAN.
  const dichtbij2 = d.spawnOndode(0, 'normaal');
  dichtbij2.groep.position.set(d.speler.positie.x - 1.2, 0, d.speler.positie.z);
  d.dreigingsThrottleTimer = 0;
  d.updateDreigingsAudio(0.001);
  const bijTwee = d.dreigingsGainDoel;

  for (const o of [...d.ondoden]) d.doodOndode(o);
  return { bijEen, bijTwee };
});
check('Met maar 1 ondode binnen het bereik (de andere staat op 10m) blijft de gain 0',
  inhoudTest.bijEen === 0, inhoudTest);
check('Zodra een 2e ondode ook binnen 1.5m komt, springt de gain naar 0.07',
  inhoudTest.bijTwee === 0.07, inhoudTest);

// --- 4. Pauze (spelActief === false) stuurt doelgain naar 0 ----------------
const pauzeTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  // Eerst een niet-nul doelgain forceren (2 ondoden vlak bij de speler):
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o1 = d.spawnOndode(0, 'normaal');
  o1.groep.position.set(d.speler.positie.x + 0.8, 0, d.speler.positie.z);
  const o2 = d.spawnOndode(0, 'normaal');
  o2.groep.position.set(d.speler.positie.x - 0.8, 0, d.speler.positie.z);
  d.dreigingsThrottleTimer = 0;
  d.updateDreigingsAudio(0.001);
  const tijdensSpel = d.dreigingsGainDoel;
  // Pauze simuleren: pointer lock loslaten.
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return { tijdensSpel };
});
await page.waitForTimeout(150);   // echte gameLoop-tick(s) tijdens pauze
const naPauze = await page.evaluate(() => window.AmsterdamUndeadDebug.dreigingsGainDoel);
check('Vlak vóór de pauze stond de doelgain op 0.07 (2 ondoden binnen bereik)', pauzeTest.tijdensSpel === 0.07, pauzeTest);
check('Na de pauze (spelActief false) staat de doelgain weer op 0', naPauze === 0, { naPauze });

// Pointer lock herstellen voor de rest van de suite (andere checks in dit
// bestand verwachten weer een actief spel).
await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});

// --- 5. Geen oscillator-start/stop buiten initGeluid() (source-check) -----
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const initBron = d.initGeluid.toString();
  const updateBron = d.updateDreigingsAudio.toString();
  return {
    initHeeftTweeStarts: (initBron.match(/\.start\(\)/g) || []).length === 2,
    initHeeftGeenStop: !/\.stop\(/.test(initBron),
    updateHeeftGeenStartStop: !/\.start\(|\.stop\(/.test(updateBron),
  };
});
check('initGeluid() start precies de twee dreigings-oscillators (2x .start())', bronTest.initHeeftTweeStarts, bronTest);
check('initGeluid() bevat geen .stop()-aanroep', bronTest.initHeeftGeenStop, bronTest);
check('updateDreigingsAudio() start/stopt zelf geen oscillators (alleen gain-sturing)', bronTest.updateHeeftGeenStartStop, bronTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
