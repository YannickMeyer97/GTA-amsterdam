// Ticket 178-fix: het spel starten zoals een speler dat doet.
//
// WAAROM DEZE TEST BESTAAT. T176, T177 en T178 waren alle drie groen en het
// spel startte op een telefoon niet. De oorzaak: `startscherm`'s click-handler
// riep na T176 nog altijd rechtstreeks `renderer.domElement.requestPointerLock()`
// aan in plaats van `startBesturing()`. Op een telefoon bestaat pointer lock
// niet, dus die aanroep deed niets, `touchSessieActief` bleef false en er
// gebeurde helemaal niets — geen spel, geen knoppen.
//
// Drie tickets lang onzichtbaar, om één reden: elke touch-test riep
// `d.startBesturing()` RECHTSTREEKS aan. Daarmee toetsten ze alles behalve de
// enige weg die een speler echt neemt. Een test die de code aanroept die hij
// wil toetsen, toetst niet of die code ooit bereikt wordt.
//
// Deze test raakt daarom niets aan van de debug-hook om te STARTEN: hij tikt
// op een moeilijkheidsknop, net als een duim, en kijkt wat er gebeurt.
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ touch: true });
const { check, report } = makeChecker();

// Een echte TouchEvent-tik op een element, gevolgd door de click die de
// browser daar zelf achteraan stuurt.
async function tikOp(selector) {
  await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const maak = () => new Touch({
      identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y,
    });
    el.dispatchEvent(new TouchEvent('touchstart', {
      cancelable: true, bubbles: true,
      touches: [maak()], targetTouches: [maak()], changedTouches: [maak()],
    }));
    el.dispatchEvent(new TouchEvent('touchend', {
      cancelable: true, bubbles: true,
      touches: [], targetTouches: [], changedTouches: [maak()],
    }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, selector);
}

// Pointer lock bestaat NIET op dit "toestel" — precies zoals op iOS Safari.
// Dit is de kern van de test: als de startcode nog op pointer lock leunt,
// blijft het spel hier net zo dood als op een echte telefoon.
await page.evaluate(() => {
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return null; },
  });
  // Elke aanroep vastleggen, zodat we kunnen ZIEN of de startcode er nog op leunt.
  window.__lockAanroepen = 0;
  const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
  canvas.requestPointerLock = () => { window.__lockAanroepen++; };
});

// --- 1. Vóór de eerste aanraking ----------------------------------------
const voor = await page.evaluate(() => ({
  modus: window.AmsterdamUndeadDebug.besturingModus,
  startschermZichtbaar: getComputedStyle(document.getElementById('startscherm')).display !== 'none',
  touchLaagVerborgen: document.getElementById('touchBediening').hidden,
}));
check('Het startscherm staat open en de touch-laag is nog verborgen',
  voor.startschermZichtbaar && voor.touchLaagVerborgen && voor.modus === 'muis', voor);

// --- 2. De speler tikt op een moeilijkheidsknop --------------------------
// Dit is de hele startflow: één tik. De klik bubbelt door naar de
// startscherm-listener, die het spel hoort te starten.
await tikOp('[data-moeilijkheid="amsterdammer"]');

const na = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    modus: d.besturingModus,
    besturingActief: d.besturingActief(),
    touchSessie: d.touchSessieActief,
    startschermZichtbaar: getComputedStyle(document.getElementById('startscherm')).display !== 'none',
    touchLaagVerborgen: document.getElementById('touchBediening').hidden,
    lockAanroepen: window.__lockAanroepen,
    // `moeilijkheid` is het gekozen PROFIEL-object, niet de sleutel.
    moeilijkheid: d.moeilijkheid?.naam ?? null,
  };
});

check('Eén tik op een moeilijkheidsknop start het spel ook zonder pointer lock',
  na.besturingActief === true && na.touchSessie === true, na);
check('Het startscherm verdwijnt na die tik', na.startschermZichtbaar === false, na);
check('De touch-bediening staat na die tik in beeld — dit is wat er op de telefoon ontbrak',
  na.touchLaagVerborgen === false, na);
check('De startcode leunt niet meer op pointer lock in de touch-modus',
  na.lockAanroepen === 0, na);
check('De moeilijkheidskeuze is gewoon aangekomen', na.moeilijkheid === 'Amsterdammer', na);

// --- 3. Alle vijf de knoppen zijn er ook echt ----------------------------
const knoppen = await page.evaluate(() => {
  const out = {};
  for (const id of ['touchStick', 'touchVuur', 'touchContext', 'touchWissel', 'touchPauze']) {
    const el = document.getElementById(id);
    out[id] = !!el && getComputedStyle(el).display !== 'none';
  }
  return out;
});
check('Stick, vuurknop, contextknop, wisselknop en pauzeknop staan allemaal op het scherm',
  Object.values(knoppen).every(Boolean), knoppen);

/* --- 3b. Zonder mesknop moet VUUR het mes doen --------------------------
   De mesknop is op verzoek verwijderd. Dat kon alleen omdat
   `probeerTeSchieten()` zelf al steekt zolang er geen vuurwapen is:
   `if (!wapenStaat) { steekMes(); return; }`.

   Dat is geen detail maar de voorwaarde: het mes is het STARTwapen, dus
   zonder dat vangnet is golf 1 op een telefoon onspeelbaar — je kunt dan
   niets raken, dus geen geld verdienen, dus nooit een wapen kopen.

   Deze test is de juiste plek omdat het spel hier nog in zijn BEGINstaat
   is: net gestart, niets gekocht, mes actief. Elders in de suite zijn er al
   wapens gekocht en is die situatie niet meer echt na te bootsen. */
const beginstaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { wapenStaat: d.wapenStaat, actiefWapen: d.actiefWapenNaam };
});
check('Bij het starten is er nog geen vuurwapen — het mes is het actieve wapen',
  beginstaat.wapenStaat === null || beginstaat.wapenStaat === undefined, beginstaat);

const vuurknopSteekt = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.mesStaat.cooldownTimer = 0;
  const voor = d.mesStaat.cooldownTimer;
  const el = document.getElementById('touchVuur');
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const maak = () => new Touch({ identifier: 9, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  el.dispatchEvent(new TouchEvent('touchstart', {
    cancelable: true, bubbles: true,
    touches: [maak()], targetTouches: [maak()], changedTouches: [maak()],
  }));
  el.dispatchEvent(new TouchEvent('touchend', {
    cancelable: true, bubbles: true, touches: [], targetTouches: [], changedTouches: [maak()],
  }));
  return { voor, na: d.mesStaat.cooldownTimer };
});
check('Een tik op VUUR steekt met het mes zolang er geen vuurwapen is — zonder dit is golf 1 op een telefoon onspeelbaar',
  vuurknopSteekt.voor === 0 && vuurknopSteekt.na > 0, vuurknopSteekt);

// --- 4. Pauzeren en hervatten, allebei met een tik -----------------------
await page.evaluate(() => {
  const el = document.getElementById('touchPauze');
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const maak = () => new Touch({ identifier: 5, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  el.dispatchEvent(new TouchEvent('touchstart', {
    cancelable: true, bubbles: true,
    touches: [maak()], targetTouches: [maak()], changedTouches: [maak()],
  }));
  el.dispatchEvent(new TouchEvent('touchend', {
    cancelable: true, bubbles: true, touches: [], targetTouches: [], changedTouches: [maak()],
  }));
});
const gepauzeerd = await page.evaluate(() => ({
  actief: window.AmsterdamUndeadDebug.besturingActief(),
  startschermZichtbaar: getComputedStyle(document.getElementById('startscherm')).display !== 'none',
  kop: document.querySelector('#startscherm h2').textContent,
  label: document.getElementById('moeilijkheidLabel').textContent,
}));
check('De pauzeknop brengt het startscherm terug', gepauzeerd.actief === false
  && gepauzeerd.startschermZichtbaar === true, gepauzeerd);
check('De pauzetekst zegt op touch "tik", niet "klik"',
  /tik/i.test(gepauzeerd.kop) && !/klik/i.test(gepauzeerd.kop), gepauzeerd);
check('Ook het label onder de kop zegt "tik" in plaats van "klik"',
  /tik/i.test(gepauzeerd.label) && !/klik/i.test(gepauzeerd.label), gepauzeerd);

// Hervatten met een tik op het startscherm zelf.
await tikOp('#startscherm');
const hervat = await page.evaluate(() => ({
  actief: window.AmsterdamUndeadDebug.besturingActief(),
  touchLaagVerborgen: document.getElementById('touchBediening').hidden,
  lockAanroepen: window.__lockAanroepen,
}));
check('Een tik op het gepauzeerde scherm hervat het spel', hervat.actief === true, hervat);
check('En de knoppen komen weer terug', hervat.touchLaagVerborgen === false, hervat);
check('Ook bij hervatten wordt er geen pointer lock aangevraagd',
  hervat.lockAanroepen === 0, hervat);

// --- 5. En met een muis gaat het nog steeds via pointer lock -------------
// De omgekeerde kant: de desktopflow mag door deze fix niet verschoven zijn.
const muis = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('muis');
  window.__lockAanroepen = 0;
  document.getElementById('startscherm').dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true }));
  return {
    lockAanroepen: window.__lockAanroepen,
    kop: document.querySelector('#startscherm h2').textContent,
  };
});
check('In de muismodus vraagt het startscherm nog gewoon pointer lock aan',
  muis.lockAanroepen === 1, muis);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
