// Ticket 81: zeldzame lampuitval — een vierde, onafhankelijke factor op
// lampLichten-intensiteit. Bewaakt: de schaduwwerpende lamp en de drie
// kelder-kamerlampen doen NOOIT mee (categorisch uitgesloten, geen
// lampBlackoutTimer), een gedwongen uitval dooft een gewone lamp naar
// intensity 0 en herstelt daarna weer boven 0 (geen drift), en een uitval
// tijdens een actieve Stroomuitval laat stroomFactor met rust.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Zelfde aanpak als elders in deze suite: de flikkerloop draait op de
// ECHTE, gecapte dt van de gameLoop (max 0.05s/frame) — poll tot de
// conditie klopt i.p.v. een wandklok-marge gokken.
async function wachtTotConditie(evalFn, klaarFn, arg, { timeoutMs = 8000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let laatste = await page.evaluate(evalFn, arg);
  while (!klaarFn(laatste) && Date.now() < deadline) {
    await page.waitForTimeout(intervalMs);
    laatste = await page.evaluate(evalFn, arg);
  }
  return laatste;
}

// --- 1. Categorische uitsluiting: schaduwlamp + 3 kelderlampen krijgen
// nooit een lampBlackoutTimer, ook niet na veel echte frames. ---------------
await frames(page, 10);
const uitsluiting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const schaduwLamp = d.lampLichten.find(l => l.licht.castShadow);
  const kelderLampen = d.lampLichten.filter(l => l.stroomVloer !== undefined);
  const gewoneLampen = d.lampLichten.filter(l => !l.licht.castShadow && l.stroomVloer === undefined);
  return {
    aantalLampen: d.lampLichten.length,
    aantalKelderLampen: kelderLampen.length,
    aantalGewoneLampen: gewoneLampen.length,
    schaduwLampTimer: schaduwLamp.lampBlackoutTimer,
    kelderTimers: kelderLampen.map(l => l.lampBlackoutTimer),
    gewoneTimersGezet: gewoneLampen.every(l => typeof l.lampBlackoutTimer === 'number'),
  };
});
check('lampLichten heeft 9 entries, waarvan 3 kelderlampen (5 blijven over als kandidaat)',
  uitsluiting.aantalLampen === 9 && uitsluiting.aantalKelderLampen === 3 && uitsluiting.aantalGewoneLampen === 5, uitsluiting);
check('De schaduwwerpende lamp krijgt NOOIT een lampBlackoutTimer',
  uitsluiting.schaduwLampTimer === undefined, uitsluiting);
check('De drie kelderlampen krijgen NOOIT een lampBlackoutTimer',
  uitsluiting.kelderTimers.every(t => t === undefined), uitsluiting);
check('Alle 5 overige (gewone) lampen krijgen wél een lampBlackoutTimer (getal)',
  uitsluiting.gewoneTimersGezet, uitsluiting);

// --- 2. Gedwongen uitval: een gewone lamp dooft naar intensity 0 -----------
const voorUitval = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lamp = d.lampLichten.find(l => !l.licht.castShadow && l.stroomVloer === undefined);
  const idx = d.lampLichten.indexOf(lamp);
  d.lampLichten[idx].lampBlackoutTimer = 0.001;   // forceer bijna-meteen een uitval
  return { idx, intensiteitVoor: lamp.licht.intensity, basis: lamp.basis };
});
await wachtTotConditie(
  (idx) => window.AmsterdamUndeadDebug.lampLichten[idx].licht.intensity,
  (intensiteit) => intensiteit === 0,
  voorUitval.idx,
);
const tijdensUitval = await page.evaluate((idx) => {
  const d = window.AmsterdamUndeadDebug;
  return { intensiteit: d.lampLichten[idx].licht.intensity, duur: d.lampLichten[idx].lampBlackoutDuur };
}, voorUitval.idx);
check('Tijdens de gedwongen uitval staat de lamp op intensity 0',
  tijdensUitval.intensiteit === 0 && tijdensUitval.duur > 0, { voorUitval, tijdensUitval });
check('LAMP_BLACKOUT_DUUR ligt binnen 0.3-0.5s',
  tijdensUitval.duur >= 0.3 && tijdensUitval.duur <= 0.5, tijdensUitval);

// --- 3. Herstel: na afloop van de uitval staat de lamp weer > 0 (geen drift,
// geen permanente 0-blijver). --------------------------------------------
const naHerstel = await wachtTotConditie(
  (idx) => window.AmsterdamUndeadDebug.lampLichten[idx].licht.intensity,
  (intensiteit) => intensiteit > 0,
  voorUitval.idx,
  { timeoutMs: 5000 },
);
check('Na afloop van de uitval (max 0.5s) herstelt de lamp weer naar een positieve intensiteit',
  naHerstel > 0, { naHerstel });
const naHerstelVolledig = await page.evaluate((idx) => {
  const d = window.AmsterdamUndeadDebug;
  const lamp = d.lampLichten[idx];
  return { intensiteit: lamp.licht.intensity, basis: lamp.basis, minFactor: lamp.minFactor };
}, voorUitval.idx);
check('Die herstelde intensiteit ligt weer in het normale flikkerbereik (geen restant-dip)',
  naHerstelVolledig.intensiteit > naHerstelVolledig.basis * naHerstelVolledig.minFactor * 0.5, naHerstelVolledig);

// --- 4. Een uitval tijdens een actieve Stroomuitval laat stroomFactor
// volledig met rust. ---------------------------------------------------
const stroomTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.actieveEventGolf = 'stroomuitval';   // blokkeert het bestaande, ongerelateerde stroomFactor-herstel
  d.stroomFactor = 0.12;
  const lamp = d.lampLichten.find(l => !l.licht.castShadow && l.stroomVloer === undefined);
  const idx = d.lampLichten.indexOf(lamp);
  d.lampLichten[idx].lampBlackoutTimer = 0.001;
  d.lampLichten[idx].lampBlackoutDuur = 0;
  return { idx };
});
await wachtTotConditie(
  (idx) => window.AmsterdamUndeadDebug.lampLichten[idx].licht.intensity,
  (intensiteit) => intensiteit === 0,
  stroomTest.idx,
);
await wachtTotConditie(
  (idx) => window.AmsterdamUndeadDebug.lampLichten[idx].licht.intensity,
  (intensiteit) => intensiteit > 0,
  stroomTest.idx,
  { timeoutMs: 5000 },
);
const stroomNa = await page.evaluate(() => window.AmsterdamUndeadDebug.stroomFactor);
check('stroomFactor blijft exact 0.12 tijdens/na een lampuitval (de uitval raakt stroomFactor nooit aan)',
  stroomNa === 0.12, { stroomNa });
await page.evaluate(() => { window.AmsterdamUndeadDebug.actieveEventGolf = null; });   // opruimen

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
