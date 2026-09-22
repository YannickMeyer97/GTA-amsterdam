// Ticket 176 (v0.34, ronde 20): de besturingsgate losgekoppeld van Pointer Lock.
//
// WAAROM. Tot dit ticket hing alles aan `document.pointerLockElement ===
// renderer.domElement` — op vijftien plekken. Die vergelijking bepaalde of de
// wereld simuleerde, of de HUD zichtbaar was, of je kon schieten en of
// R/T/Q/V iets deden. Pointer Lock bestaat niet op iOS Safari, dus op een
// telefoon faalde `requestPointerLock()` stil en gebeurde er niets.
//
// DRIE DINGEN DIE DIT BESTAND BEWAAKT:
//
//  1. De muismodus is BIT-VOOR-BIT het oude gedrag. Dat is geen nettigheid
//     maar een harde eis: tien testbestanden en `helpers.mjs` mocken
//     `document.pointerLockElement` om precies deze uitkomst te sturen.
//  2. De modus volgt wat de speler DOET, niet wat het toestel beweert te
//     zijn. Geen user-agent, geen maxTouchPoints, geen (pointer: coarse).
//  3. `touchSessieActief` begint op false en gaat alleen aan door een echte
//     aanraking — anders zou `openVoorVisueleMeting()` (die bewust géén
//     pointer lock mockt, zodat de wereld stilstaat) ineens een lopende
//     wereld krijgen en gaan alle visuele basislijnmetingen zwerven.
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. De standaard is de muismodus, en die is ongewijzigd -------------
const standaard = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const canvas = d.renderer.domElement;
  const zetLock = (aan) => Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return aan ? canvas : null; },
  });
  const uit = { modus: d.besturingModus, touchVlag: d.touchSessieActief };
  zetLock(false);
  uit.zonderLock = d.besturingActief();
  zetLock(true);
  uit.metLock = d.besturingActief();
  zetLock(false);
  return uit;
});
check('Het spel start in de muismodus — geen apparaatdetectie bij het laden',
  standaard.modus === 'muis', standaard);
check('De touch-sessie staat uit tot er echt aangeraakt wordt',
  standaard.touchVlag === false, standaard);
check('In de muismodus is de gate exact de oude pointer-lock-vergelijking',
  standaard.zonderLock === false && standaard.metLock === true, standaard);

// --- 2. De touch-modus werkt ZONDER pointer lock ------------------------
// Dit is de hele reden dat het ticket bestaat.
const touch = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return null; },   // pointer lock bestaat niet
  });
  let lockAangevraagd = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = function (...a) { lockAangevraagd++; return orig.apply(this, a); };

  d.zetBesturingModus('touch');
  const voorStart = d.besturingActief();
  d.startBesturing();
  const naStart = d.besturingActief();
  const hudZichtbaar = document.getElementById('hudUI').style.display;
  const startschermWeg = document.getElementById('startscherm').style.display;
  d.verlaatBesturing();
  const naVerlaten = d.besturingActief();

  d.renderer.domElement.requestPointerLock = orig;
  d.zetBesturingModus('muis');
  return { voorStart, naStart, naVerlaten, hudZichtbaar, startschermWeg, lockAangevraagd };
});
check('In de touch-modus is de gate dicht tot het spel gestart wordt',
  touch.voorStart === false, touch);
check('Starten opent de gate zonder dat er pointer lock aan te pas komt — dát is de bug die dit ticket oplost',
  touch.naStart === true && touch.lockAangevraagd === 0, touch);
check('En het toont dezelfde HUD-chrome als de muismodus (één functie voor beide)',
  touch.hudZichtbaar === 'block' && touch.startschermWeg === 'none', touch);
check('Verlaten sluit de gate weer, ook zonder browser-event',
  touch.naVerlaten === false, touch);

// --- 3. Wisselen van modus laat geen gate openstaan ---------------------
// Hier zat tijdens het bouwen een echte bug: de modus werd eerst omgezet en
// pas daarna de oude besturing afgesloten, waardoor de afsluitcode al naar de
// NIEUWE modus keek en pointer lock gewoon vast bleef zitten.
const wisselen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const canvas = d.renderer.domElement;
  let lockActief = true;
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return lockActief ? canvas : null; },
  });
  let exitAangeroepen = 0;
  const origExit = document.exitPointerLock;
  document.exitPointerLock = function () { exitAangeroepen++; lockActief = false; };

  // muis -> touch, terwijl pointer lock vastzit
  d.zetBesturingModus('muis');
  lockActief = true;
  d.zetBesturingModus('touch');
  const naNaarTouch = { exitAangeroepen, gateOpen: d.besturingActief(), lockNogVast: lockActief };

  // touch -> muis, terwijl er een touch-sessie loopt
  d.startBesturing();
  const touchSessieLiep = d.besturingActief();
  d.zetBesturingModus('muis');
  lockActief = false;
  const naNaarMuis = { gateOpen: d.besturingActief(), touchVlag: d.touchSessieActief };

  document.exitPointerLock = origExit;
  d.zetBesturingModus('muis');
  return { naNaarTouch, touchSessieLiep, naNaarMuis };
});
check('Wisselen naar touch laat pointer lock los in plaats van hem vast te laten zitten',
  wisselen.naNaarTouch.exitAangeroepen === 1 && wisselen.naNaarTouch.lockNogVast === false, wisselen);
check('...en laat geen open gate achter', wisselen.naNaarTouch.gateOpen === false, wisselen);
check('Wisselen naar muis beëindigt een lopende touch-sessie',
  wisselen.touchSessieLiep === true && wisselen.naNaarMuis.gateOpen === false
  && wisselen.naNaarMuis.touchVlag === false, wisselen);

// --- 4. Geen apparaatdetectie in de bron -------------------------------
// De regel uit het ticket, machinaal bewaakt: het spel mag niet gaan raden
// op grond van wat het toestel beweert te zijn.
const bron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tekst = [d.besturingActief, d.zetBesturingModus, d.startBesturing, d.verlaatBesturing]
    .map(f => f.toString()).join('\n');
  const verboden = ['userAgent', 'maxTouchPoints', 'platform', 'ontouchstart',
    'pointer: coarse', 'hover: none', 'iPhone', 'Android'];
  return { gevonden: verboden.filter(t => tekst.includes(t)) };
});
check('De besturingscode raadt nergens naar het apparaat — de modus volgt de invoer, niet de user-agent',
  bron.gevonden.length === 0, bron);

// --- 5. De visuele-meting-uitzondering blijft heel ---------------------
// `openVoorVisueleMeting()` mockt bewust GEEN pointer lock, zodat `spelActief`
// false blijft en klok, druppels, stofwolken en ondoden stilstaan tijdens een
// meting. Zou de touch-vlag daar per ongeluk aangaan, dan gaan alle visuele
// basislijnmetingen zwerven — en dat merk je pas rondes later.
const meting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return null; },
  });
  d.zetBesturingModus('muis');
  return { modus: d.besturingModus, touchVlag: d.touchSessieActief, gate: d.besturingActief() };
});
check('Zonder pointer lock én zonder aanraking blijft de gate dicht — de wereld staat stil tijdens een visuele meting',
  meting.gate === false && meting.touchVlag === false, meting);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
