// Feedback F3 (Ticket 34): wapen-identiteit — camera-kick, spread, herlaad-
// dip en wisselanimatie. Bewaakt: de Drukspuit/Ratelaar-velden verschillen
// zoals in ARCHITECTURE_NOTES §5.6, cameraKick is visueel-only (speler.pitch
// blijft ongemoeid) en vervalt exponentieel, spread geeft de Ratelaar
// spreiding maar de Drukspuit blijft exact op het midden, de herlaad-dip
// beweegt de wapen-groep en keert exact terug, en de wisselanimatie zet een
// timer + geluid.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

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

// Ticket 60 (v0.19): composer.render() (post-processing) is iets duurder dan
// renderer.render(), dus in dit headless/software-gerenderde testklimaat
// daalt de fps merkbaar en blijft de gameLoop's gecapte dt (max 0.05s/frame,
// zie gameLoop) verder achter op de echte klok — vandaar een ruimere marge
// dan voorheen (was 500ms) om de vervaltijd zeker te halen.
await page.waitForTimeout(1500);   // ruim boven de exponentiële-vervaltijd (echte klok)

const kickNa = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { cameraKick: d.cameraKick, pitch: d.speler.pitch };
});
check('Na 0.5s is cameraKick terug binnen 5% van de oorspronkelijke kick (0.014 * 0.05 = 0.0007)',
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
  if (d.actiefWapenNaam !== 'drukspuit') d.wisselWapen();
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.reserve = 48;
  d.wapenStaat.definitie.groep.position.y = d.WAPEN_BASIS_Y;
  d.herladen();
  const voorY = d.wapenStaat.definitie.groep.position.y;   // vlak bij het begin: nog dicht bij rust
  let laagstePunt = voorY;
  let ticks = 0;
  while (d.wapenStaat.herladen && ticks < 500) {
    d.updateWapen(0.02);
    laagstePunt = Math.min(laagstePunt, d.wapenStaat.definitie.groep.position.y);
    ticks++;
  }
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

// Ticket 60 (v0.19): zelfde reden als hierboven — ruimere marge dan het
// oorspronkelijke 400ms i.v.m. de iets lagere fps door composer.render().
await page.waitForTimeout(900);   // ruim boven WISSEL_DUUR (echte klok, cosmetische zone)

const wisselNa = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { wisselTimer: d.wisselTimer, y: d.wapenStaat.definitie.groep.position.y, basisY: d.WAPEN_BASIS_Y };
});
check('Na WISSEL_DUUR is wisselTimer 0 en staat de actieve wapen-groep weer exact op de rust-y',
  wisselNa.wisselTimer === 0 && wisselNa.y === wisselNa.basisY, wisselNa);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
