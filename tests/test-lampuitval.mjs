// Ticket 81: zeldzame lampuitval — een vierde, onafhankelijke factor op
// lampLichten-intensiteit. Bewaakt: de schaduwwerpende lamp en de drie
// kelder-kamerlampen doen NOOIT mee (categorisch uitgesloten, geen
// lampBlackoutTimer), een gedwongen uitval is een echte FLIKKERREEKS
// (meerdere aan/uit-segmenten over 0.6-1.0s, niet één ononderbroken "uit"
// — feedback: dat las als een renderglitch) die daarna weer stabiel
// herstelt (geen drift), en een uitval tijdens een actieve Stroomuitval
// laat stroomFactor met rust.
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
// +1 sinds het vliering-traplampje (op verzoek na T87): 9 -> 10 entries, dus
// 6 gewone kandidaten voor de lampuitval i.p.v. 5.
check('lampLichten heeft 10 entries, waarvan 3 kelderlampen (6 blijven over als kandidaat)',
  uitsluiting.aantalLampen === 10 && uitsluiting.aantalKelderLampen === 3 && uitsluiting.aantalGewoneLampen === 6, uitsluiting);
check('De schaduwwerpende lamp krijgt NOOIT een lampBlackoutTimer',
  uitsluiting.schaduwLampTimer === undefined, uitsluiting);
check('De drie kelderlampen krijgen NOOIT een lampBlackoutTimer',
  uitsluiting.kelderTimers.every(t => t === undefined), uitsluiting);
check('Alle 5 overige (gewone) lampen krijgen wél een lampBlackoutTimer (getal)',
  uitsluiting.gewoneTimersGezet, uitsluiting);

// --- 2. Gedwongen uitval: een gewone lamp dooft naar intensity 0. Wacht EN
// lees atomisch binnen ÉÉN page.evaluate() (rAF-poll in de pagina zelf) —
// twee losse evaluate()-round-trips zouden hier, met segmenten van maar
// 90ms, een echte race kunnen zijn (het volgende segment kan al zijn
// omgeslagen tussen "wachten tot 0" en "lees de waarde" in). -------------
const voorUitval = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lamp = d.lampLichten.find(l => !l.licht.castShadow && l.stroomVloer === undefined);
  const idx = d.lampLichten.indexOf(lamp);
  return { idx, intensiteitVoor: lamp.licht.intensity, basis: lamp.basis };
});
const uitvalStart = await page.evaluate((idx) => new Promise((resolve) => {
  const d = window.AmsterdamUndeadDebug;
  d.lampLichten[idx].lampBlackoutTimer = 0.001;   // forceer bijna-meteen een uitval
  const deadline = performance.now() + 5000;   // ruime marge: trage frames rekken de gesimuleerde tijd op
  function tik() {
    const l = d.lampLichten[idx];
    if (l.licht.intensity === 0 || performance.now() > deadline) {
      // lampBlackoutDuur telt al af zodra de reeks gestart is — op het
      // moment dat we intensity===0 zien is er al (minstens) 1 frame
      // verstreken, dus die live waarde ligt per definitie iets ONDER de
      // oorspronkelijke roll. lampBlackoutTotaalDuur is de vaste waarde
      // die bij de trigger is vastgelegd en nooit meer verandert — dáár
      // toetsen we het interval tegen.
      resolve({ intensiteit: l.licht.intensity, duur: l.lampBlackoutDuur, totaalDuur: l.lampBlackoutTotaalDuur });
    } else {
      requestAnimationFrame(tik);
    }
  }
  requestAnimationFrame(tik);
}), voorUitval.idx);
check('Tijdens de gedwongen uitval staat de lamp op intensity 0',
  uitvalStart.intensiteit === 0 && uitvalStart.duur > 0, { voorUitval, uitvalStart });
check('LAMP_BLACKOUT_DUUR (totale flikkerreeks, vastgelegd bij de trigger) ligt binnen 0.6-1.0s',
  uitvalStart.totaalDuur >= 0.6 && uitvalStart.totaalDuur <= 1.0, uitvalStart);

// --- 3. Echte flikkerreeks: meerdere aan/uit-overgangen binnen de reeks. --
// CI-fix: een wandklok-tijdvenster (was 1500ms) faalde op de echte
// GitHub-Actions-runner ({"stijgend":1,"dalend":1,"aantalSamples":5}) —
// bij ~300ms/frame op een zwaarbelaste runner passen maar 5 frames in
// 1500ms. Een FRAME-geteld venster is hiertegen bewijsbaar robuust: dt is
// gecapt op 0.05s/frame, dus een traag frame draagt NOOIT minder dan een
// snel frame bij aan de gesimuleerde tijd (eerder meer, tot het plafond) —
// N frames garanderen dus altijd minstens N * (echte of gecapte) dt aan
// gesimuleerde tijd, ongeacht hoe traag de runner daadwerkelijk is. 50
// frames geeft ruim boven de 1.0s max-reeks aan gesimuleerde tijd in zowel
// het trage (50*0.05=2.5s gecapt) als het snelle (~50*0.016≈0.8s, ruim
// genoeg voor meerdere 0.09s-segmenten) geval.
// Geen nieuwe trigger hier: sectie 2 heeft de reeks al gestart (nog steeds
// bezig, lampBlackoutDuur > 0 — pas als de reeks daadwerkelijk afloopt leest
// de flikkerloop lampBlackoutTimer opnieuw), dus dit bemonstert gewoon de
// rest van diezelfde, al lopende reeks.
const flikkerData = await page.evaluate((idx) => new Promise((resolve) => {
  const d = window.AmsterdamUndeadDebug;
  const samples = [];
  const AANTAL_FRAMES = 50;
  let i = 0;
  function tik() {
    samples.push(d.lampLichten[idx].licht.intensity);
    if (++i < AANTAL_FRAMES) requestAnimationFrame(tik);
    else resolve(samples);
  }
  requestAnimationFrame(tik);
}), voorUitval.idx);
let stijgend = 0, dalend = 0;
for (let i = 1; i < flikkerData.length; i++) {
  const vorigUit = flikkerData[i - 1] === 0, nuUit = flikkerData[i] === 0;
  if (vorigUit && !nuUit) stijgend++;
  if (!vorigUit && nuUit) dalend++;
}
check('De uitval bestaat uit MEERDERE aan/uit-overgangen (een echte flikkerreeks, geen enkele "uit")',
  stijgend >= 2 && dalend >= 2, { stijgend, dalend, aantalSamples: flikkerData.length });

// --- 4. Herstel: wacht op het ECHTE einde-signaal van de reeks
// (lampBlackoutDuur terug op exact 0, gezet door de flikkerloop zelf zodra
// de reeks afloopt) i.p.v. een geschatte wandklok-marge — structureel
// robuust, ongeacht hoe traag frames op dat moment lopen. ------------------
const naAfloop = await page.evaluate((idx) => new Promise((resolve) => {
  const d = window.AmsterdamUndeadDebug;
  const deadline = performance.now() + 10000;
  function tik() {
    const l = d.lampLichten[idx];
    if (l.lampBlackoutDuur === 0 || performance.now() > deadline) {
      resolve({ intensiteit: l.licht.intensity, duurNu: l.lampBlackoutDuur });
    } else {
      requestAnimationFrame(tik);
    }
  }
  requestAnimationFrame(tik);
}), voorUitval.idx);
check('Zodra lampBlackoutDuur weer op 0 staat (de reeks is echt afgelopen), is de lamp stabiel positief (geen drift)',
  naAfloop.duurNu === 0 && naAfloop.intensiteit > 0, naAfloop);

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
