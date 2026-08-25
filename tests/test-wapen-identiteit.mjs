// Feedback F3 (Ticket 34): wapen-identiteit — camera-kick, spread, herlaad-
// dip en wisselanimatie. Bewaakt: de Drukspuit/Ratelaar-velden verschillen
// zoals in ARCHITECTURE_NOTES §5.6, cameraKick is visueel-only (speler.pitch
// blijft ongemoeid) en vervalt exponentieel, spread geeft de Ratelaar
// spreiding maar de Drukspuit blijft exact op het midden, de herlaad-dip
// beweegt de wapen-groep en keert exact terug, en de wisselanimatie zet een
// timer + geluid.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// CI-fix: de cameraKick-/wisselTimer-decay draait op de gameLoop's ECHTE,
// gecapte dt (max 0.05s/frame) — hoe traag een frame écht rendert (SwiftShader,
// zwaarder op een gedeelde CI-runner dan lokaal) bepaalt dus hoeveel
// gesimuleerde tijd een vaste wandklok-wacht daadwerkelijk oplevert. Een vast
// aantal ms gokken (was 1500/900ms, al eens verhoogd vanaf 500/400ms) blijft
// fundamenteel fragiel: op GitHub Actions bleek zelfs 1500ms niet genoeg
// (cameraKick strandde op 0.00115 i.p.v. ≤0.0007). In plaats van nóg een
// gok: poll de daadwerkelijke conditie tot 'ie klopt, met een ruime
// deadline — zo wacht de test nooit langer dan nodig, en nooit te kort.
async function wachtTotConditie(evalFn, klaarFn, { timeoutMs = 10000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let laatste = await page.evaluate(evalFn);
  while (!klaarFn(laatste) && Date.now() < deadline) {
    await page.waitForTimeout(intervalMs);
    laatste = await page.evaluate(evalFn);
  }
  return laatste;
}

// --- 0. Per-wapen velden verschillen zoals in de §5.6-tabel ---------------
const velden = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    drukspuit: {
      kickSterkte: d.WAPEN_DRUKSPUIT.kickSterkte, spreadNdc: d.WAPEN_DRUKSPUIT.spreadNdc,
      terugslagSterkte: d.WAPEN_DRUKSPUIT.terugslagSterkte, schotToon: d.WAPEN_DRUKSPUIT.schotToon,
    },
    ratelaar: {
      kickSterkte: d.WAPEN_RATELAAR.kickSterkte, spreadNdc: d.WAPEN_RATELAAR.spreadNdc,
      terugslagSterkte: d.WAPEN_RATELAAR.terugslagSterkte, schotToon: d.WAPEN_RATELAAR.schotToon,
    },
  };
});
check('Drukspuit: kickSterkte 0.014, spreadNdc 0 (precisiekeuze, geen spread)',
  velden.drukspuit.kickSterkte === 0.014 && velden.drukspuit.spreadNdc === 0, velden);
check('Ratelaar: kickSterkte 0.006, spreadNdc 0.012 (volumekeuze, lichte spread)',
  velden.ratelaar.kickSterkte === 0.006 && velden.ratelaar.spreadNdc === 0.012, velden);
check('terugslagSterkte verschilt (Drukspuit 1.0, Ratelaar 0.55)',
  velden.drukspuit.terugslagSterkte === 1.0 && velden.ratelaar.terugslagSterkte === 0.55, velden);
check('De twee wapens hebben aantoonbaar verschillende schotToon-parameters',
  JSON.stringify(velden.drukspuit.schotToon) !== JSON.stringify(velden.ratelaar.schotToon), velden);

// --- 1. Camera-kick: visueel-only, speler.pitch blijft ongemoeid ----------
const kickVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Ticket 134: de speler start met het mes, niet met de Drukspuit — eerst
  // garanderen dat de AMSTEL-9 bezeten is (wisselWapen() no-opt anders
  // stilzwijgend, want die vereist twee bezeten vuurwapens).
  if (!d.wapenStaten.drukspuit) { d.spelStaat.geld = 100000; d.koopAmstel9(); }
  if (d.actiefWapenNaam !== 'drukspuit') d.wisselWapen();
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.speler.pitch = 0.2;
  d.cameraKick = 0;
  d.schiet();
  return { cameraKickDirectNa: d.cameraKick, pitch: d.speler.pitch };
});
check('Eén Drukspuit-schot verhoogt cameraKick direct naar exact kickSterkte (0.014)',
  Math.abs(kickVoor.cameraKickDirectNa - 0.014) < 1e-9, kickVoor);
check('speler.pitch is door het schot niet gemuteerd (blijft 0.2)',
  kickVoor.pitch === 0.2, kickVoor);

const kickNa = await wachtTotConditie(
  () => { const d = window.AmsterdamUndeadDebug; return { cameraKick: d.cameraKick, pitch: d.speler.pitch }; },
  (u) => u.cameraKick <= 0.014 * 0.05,
);
check('cameraKick vervalt exponentieel terug tot binnen 5% van de oorspronkelijke kick (0.014 * 0.05 = 0.0007)',
  kickNa.cameraKick <= 0.014 * 0.05, kickNa);
check('speler.pitch is nog steeds ongemoeid (blijft 0.2, ook na de vervaltijd)',
  kickNa.pitch === 0.2, kickNa);

// De Ratelaar moet gekocht zijn om ernaar te kunnen wisselen (wisselWapen()
// no-opt anders stilzwijgend) — vóór de spread-test alvast aanschaffen.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (!d.ratelaarGekocht) { d.spelStaat.geld = 100000; d.koopRatelaar(); }
});

// --- 2. Spread: Drukspuit exact hetzelfde raakpunt, Ratelaar spreiding ----
// Speler kijkt vanuit de startpositie (default yaw = Math.PI) recht op de
// zuidmuur ("de ramen") — een gegarandeerd wereld-treffer binnen raycaster.far.
// De tracer-mesh (midden tussen vlam en raakpunt) volgt het echte raakpunt,
// dus de spreiding daarin is een directe proxy voor de raakpunt-spreiding.
function verzamelRaakpuntenCode(wapenNaam) {
  return `
    const d = window.AmsterdamUndeadDebug;
    // Ticket 134: garandeer bezit van ${wapenNaam} vóórdat er gewisseld wordt.
    if ('${wapenNaam}' === 'drukspuit' && !d.wapenStaten.drukspuit) { d.spelStaat.geld = 100000; d.koopAmstel9(); }
    if ('${wapenNaam}' === 'ratelaar' && !d.wapenStaten.ratelaar) { d.spelStaat.geld = 100000; d.koopRatelaar(); }
    if (d.actiefWapenNaam !== '${wapenNaam}') d.wisselWapen();
    d.wapenStaat.herladen = false;
    d.wapenStaat.magazijn = 999;
    d.speler.positie.set(0, 0, -1.5);
    d.speler.yaw = Math.PI;
    d.speler.pitch = 0;
    d.camera.position.set(0, d.speler.hoogte, -1.5);
    d.camera.rotation.y = d.speler.yaw;
    d.camera.rotation.x = d.speler.pitch;
    d.camera.updateMatrixWorld(true);
    const puntenX = [];
    for (let i = 0; i < 20; i++) {
      d.schiet();
      const laatsteTracer = d.actieveEffecten.filter(e => e.soort === 'tracer').slice(-1)[0];
      puntenX.push(Math.round(laatsteTracer.slot.mesh.position.x * 1000) / 1000);
    }
    return puntenX;
  `;
}
const drukspuitPunten = await page.evaluate(new Function(verzamelRaakpuntenCode('drukspuit')));
const ratelaarPunten = await page.evaluate(new Function(verzamelRaakpuntenCode('ratelaar')));
const uniekDrukspuit = new Set(drukspuitPunten).size;
const uniekRatelaar = new Set(ratelaarPunten).size;
check('Drukspuit (spreadNdc 0): alle 20 raakpunten zijn identiek (1 unieke x-waarde)',
  uniekDrukspuit === 1, { drukspuitPunten, uniekDrukspuit });
check('Ratelaar (spreadNdc 0.012): de 20 raakpunten geven meer dan 1 unieke x-waarde (spreiding)',
  uniekRatelaar > 1, { ratelaarPunten, uniekRatelaar });

// --- 3. Herlaad-dip: sinus-boog omlaag/omhoog, exact terug naar rust ------
const dip = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (!d.wapenStaten.drukspuit) { d.spelStaat.geld = 100000; d.koopAmstel9(); }
  if (d.actiefWapenNaam !== 'drukspuit') d.wisselWapen();
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.reserve = 48;
  d.wapenStaat.definitie.groep.position.y = d.WAPEN_BASIS_Y;
  d.herladen();
  const voorY = d.wapenStaat.definitie.groep.position.y;   // vlak bij het begin: nog dicht bij rust
  let laagstePunt = voorY;
  let ticks = 0;
  // Ticket 140: de herlaad-DIP is verhuisd uit updateWapen() (die houdt nu
  // alleen nog de timer en de munitie-overheveling) naar
  // updateWapenPresentatie(), de enige schrijver van de wapen-transform. Eén
  // frame "wapen" is dus die twee samen, in deze volgorde — precies zoals de
  // gameLoop ze aanroept. De asserties hieronder zijn ongewijzigd: de dip
  // zelf, zijn amplitude en de exacte terugkeer naar rust zijn hetzelfde.
  while (d.wapenStaat.herladen && ticks < 500) {
    d.updateWapen(0.02);
    d.updateWapenPresentatie(0.02);
    laagstePunt = Math.min(laagstePunt, d.wapenStaat.definitie.groep.position.y);
    ticks++;
  }
  d.updateWapenPresentatie(0.02);   // afsluitende frame: herladen is net false, dip terug op 0
  const naY = d.wapenStaat.definitie.groep.position.y;
  return { voorY, laagstePunt, naY, basisY: d.WAPEN_BASIS_Y, amplitude: d.WAPEN_HERLAAD_DIP_AMPLITUDE };
});
check('Tijdens het herladen zakt de wapen-groep duidelijk onder de rust-y (sinus-boog)',
  dip.laagstePunt < dip.basisY - dip.amplitude * 0.5, dip);
check('Na afloop van het herladen staat de wapen-groep weer EXACT op de rust-y',
  dip.naY === dip.basisY, dip);

// --- 4. Wisselanimatie: timer + geluid, exacte terugkeer naar rust --------
const wissel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (!d.wapenStaten.drukspuit) { d.spelStaat.geld = 100000; d.koopAmstel9(); }
  if (!d.ratelaarGekocht) { d.spelStaat.geld = 100000; d.koopRatelaar(); }
  if (d.actiefWapenNaam !== 'drukspuit') d.wisselWapen();
  d.wapenStaat.herladen = false;
  const tellerVoor = d.wisselTeller;
  d.wisselWapen();
  return {
    wisselTimerDirectNa: d.wisselTimer, wisselDuur: d.WISSEL_DUUR,
    tellerVoor, tellerNa: d.wisselTeller, actiefNa: d.actiefWapenNaam,
  };
});
check('wisselWapen() zet wisselTimer meteen op WISSEL_DUUR (0.16)',
  wissel.wisselTimerDirectNa === wissel.wisselDuur, wissel);
check('wisselWapen() roept speelWissel() precies 1x aan',
  wissel.tellerNa === wissel.tellerVoor + 1, wissel);

const wisselNa = await wachtTotConditie(
  () => { const d = window.AmsterdamUndeadDebug;
    return { wisselTimer: d.wisselTimer, y: d.wapenStaat.definitie.groep.position.y, basisY: d.WAPEN_BASIS_Y }; },
  (u) => u.wisselTimer === 0,
);
check('Na WISSEL_DUUR is wisselTimer 0 en staat de actieve wapen-groep weer exact op de rust-y',
  wisselNa.wisselTimer === 0 && wisselNa.y === wisselNa.basisY, wisselNa);

// --- 5. Ticket 132: het ARSENAAL en de twee schakelklassen ---------------
const arsenaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    sleutels: Object.keys(d.ARSENAAL),
    klassen: Object.fromEntries(Object.entries(d.ARSENAAL).map(([k, v]) => [k, v.klasse])),
    definitieKlopt: d.ARSENAAL.drukspuit.definitie === d.WAPEN_DRUKSPUIT
      && d.ARSENAAL.ratelaar.definitie === d.WAPEN_RATELAAR,
    heeftPresentatie: Object.values(d.ARSENAAL).every(v => v.presentatie && v.audio),
  };
});
check('ARSENAAL bevat beide vuurwapens, elk met klasse "vuurwapen"',
  arsenaal.sleutels.length === 2 && arsenaal.klassen.drukspuit === 'vuurwapen'
  && arsenaal.klassen.ratelaar === 'vuurwapen', arsenaal);
check('ARSENAAL-entries wijzen naar de bestaande WAPEN_*-definities (geen kopie)',
  arsenaal.definitieKlopt, arsenaal);
check('Elke ARSENAAL-entry heeft een presentatie- en audio-subobject (vorm voor T140/T137/T153)',
  arsenaal.heeftPresentatie, arsenaal);

const gate = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const metBeide = d.bezitTweeVuurwapens();
  const bewaard = d.wapenStaten.ratelaar;
  d.wapenStaten.ratelaar = null;
  const metEen = d.bezitTweeVuurwapens();
  d.wapenStaten.ratelaar = bewaard;
  return { metBeide, metEen, herstel: d.bezitTweeVuurwapens() };
});
check('bezitTweeVuurwapens(): waar met twee vuurwapens, onwaar met één (vervangt de ratelaarGekocht-vlag als Q-gate)',
  gate.metBeide === true && gate.metEen === false && gate.herstel === true, gate);

// --- 6. Ticket 132: nieuwe runtimevelden, gereserveerd maar ongebruikt ----
const velden132 = await page.evaluate(() => {
  const s = window.AmsterdamUndeadDebug.nieuweWapenStaat(window.AmsterdamUndeadDebug.WAPEN_DRUKSPUIT);
  return { spreadOpbouw: s.spreadOpbouw, recoilFase: s.recoilFase };
});
check('nieuweWapenStaat() reserveert spreadOpbouw en recoilFase, allebei op 0 (T142/T143 vullen ze)',
  velden132.spreadOpbouw === 0 && velden132.recoilFase === 0, velden132);

// --- 7. Ticket 132 / ontwerpbeslissing 100: inHandGroep volgt het wapen ---
const inHand = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voorNaam = d.actiefWapenNaam;
  const voorKlopt = d.inHandGroep === d.wapenStaat.definitie.groep;
  d.wapenStaat.herladen = false;
  d.wisselWapen();
  return {
    voorNaam, voorKlopt, naNaam: d.actiefWapenNaam,
    naKlopt: d.inHandGroep === d.wapenStaat.definitie.groep,
    isGroep: !!d.inHandGroep && d.inHandGroep.isObject3D === true,
  };
});
check('inHandGroep wijst naar de Group van het actieve wapen, vóór én na een wissel',
  inHand.voorKlopt && inHand.naKlopt && inHand.voorNaam !== inHand.naNaam, inHand);
check('inHandGroep is een echte Object3D (nooit null)', inHand.isGroep, inHand);

// --- 8. Ticket 132 / §13.3: het null-contract van wapenStaat -------------
// De kern van dit ticket. Vanaf T134 is `wapenStaat` null zodra de speler een
// mes vasthoudt; de sway/lean-write in de gameLoop draaide toen nog ELKE
// frame zonder guard en zou dan meteen crashen. Deze test bewijst dat een
// frame met wapenStaat === null geen enkele fout meer oplevert.
const foutenVoorNulTest = errs.length;
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  window.__bewaardeWapenStaat = d.wapenStaat;
  d.wapenStaat = null;
});
// Ruim genoeg frames om alle geconditioneerde takken (terugslag, wisseldip,
// vlamdoving) minstens één keer voorbij te laten komen.
await frames(page, 12);
await page.waitForTimeout(200);   // pageerror-events komen asynchroon binnen
const nulTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const groepNogSteeds = !!d.inHandGroep;
  d.wapenStaat = window.__bewaardeWapenStaat;   // herstellen vóór de rest van de suite
  delete window.__bewaardeWapenStaat;
  return { groepNogSteeds, hersteld: !!d.wapenStaat };
});
check('Met wapenStaat === null draaien 12 frames zonder één console-/page-error (§13.3, OB100)',
  errs.length === foutenVoorNulTest, { nieuweFouten: errs.slice(foutenVoorNulTest) });
check('inHandGroep blijft bestaan terwijl wapenStaat null is (presentatie los van gameplay)',
  nulTest.groepNogSteeds === true, nulTest);
check('wapenStaat is na de null-test correct hersteld', nulTest.hersteld === true, nulTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
