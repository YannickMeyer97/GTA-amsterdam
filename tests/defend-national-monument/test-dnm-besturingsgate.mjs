// Ticket D81 (fase T) — de besturingsgate: muis of touch, los van pointer lock.
//
// Muis: de gate is letterlijk de pointer-lock-vergelijking (zoals alle
// andere tests hem mocken). Touch: de eerste echte aanraking zet de modus,
// een tik op het startscherm start het spel, verlaatBesturing pauzeert, en
// game over toont het eindscherm. Een klik met een echte muis zet de modus
// terug.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];

// 1. Muis (de gewone tests): niets veranderd.
{
  const { browser, page, errs } = await openDefend({ simuleerPointerLock: true });
  const r = await page.evaluate(() => {
    const d = window.DamChaosDebug;
    return { modus: d.besturingModusStand(), actief: d.besturingActief(), touchKlasse: document.documentElement.classList.contains('touchModus') };
  });
  check('Standaard de muismodus; met pointer lock is het spel actief', r.modus === 'muis' && r.actief && !r.touchKlasse, r);
  alleErrs.push(...errs);
  await browser.close();
}

// 2. Touch.
const { browser, page, errs } = await openDefend({ contextOpties: { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } } });
const stand = () => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const zichtbaar = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  return {
    modus: d.besturingModusStand(), actief: d.besturingActief(), speelduur: d.runStats.speelduur,
    startscherm: zichtbaar('startscherm'), eindscherm: zichtbaar('eindscherm'), richtkruis: zichtbaar('richtkruis'),
    kop: document.querySelector('#startscherm h2').textContent, touchKlasse: document.documentElement.classList.contains('touchModus'),
  };
});
const tikStart = async () => {
  const b = await page.evaluate(() => { const r = document.querySelector('#startscherm .knop').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(b.x, b.y);
};
const voor = await stand();
check('Vóór de eerste aanraking: nog muismodus, spel niet actief', voor.modus === 'muis' && !voor.actief && voor.startscherm, voor);

await tikStart();   // een tik op 'Tik om te spelen'
await page.waitForTimeout(300);
const na = await stand();
check('Een tik zet de touchmodus (met de klasse touchModus) en start het spel', na.modus === 'touch' && na.touchKlasse && na.actief && !na.startscherm && na.richtkruis, na);
check('Het spel loopt: de speelduur telt op', na.speelduur > 0, na);

// Toetsen werken in de touchmodus ook (een iPad met toetsenbord).
const g = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0; d.updateWaveSysteem(0.1);
  const wave = d.spel.wave;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
  dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyG' }));
  return { voor: wave, na: d.spel.wave };
});
check('In de touchmodus werkt een toets nog (G start de volgende wave)', g.na === g.voor + 1, g);

// Pauzeren.
await page.evaluate(() => window.DamChaosDebug.verlaatBesturing());
const pauze1 = await stand();
await page.waitForTimeout(300);
const pauze2 = await stand();
check('verlaatBesturing pauzeert: startscherm "Gepauzeerd", de tijd staat stil', !pauze1.actief && pauze1.startscherm && /Gepauzeerd/.test(pauze1.kop) && pauze2.speelduur === pauze1.speelduur, { pauze1, pauze2 });
await tikStart();
await page.waitForTimeout(200);
const verder = await stand();
check('Een tik hervat', verder.actief && !verder.startscherm, verder);

// Game over in de touchmodus: het eindscherm, niet het pauzescherm.
await page.evaluate(() => { const d = window.DamChaosDebug; d.spel.monumentHP = 0; d.eindigRun(); });
const eind = await stand();
check('Game over: het eindscherm, niet het startscherm; het spel staat stil', eind.eindscherm && !eind.startscherm && !eind.actief, eind);

// Opnieuw spelen vanuit het eindscherm, met een tik.
await page.evaluate(() => document.getElementById('opnieuwKnop').scrollIntoView());
const knop = await page.evaluate(() => { const b = document.getElementById('opnieuwKnop').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
await page.touchscreen.tap(knop.x, knop.y);
await page.waitForTimeout(300);
const opnieuw = await stand();
check('Opnieuw spelen met een tik: wave 1 en meteen actief', opnieuw.actief && !opnieuw.eindscherm && !opnieuw.startscherm, opnieuw);

// Een klik met een echte muis zet de muismodus terug (en stopt de touchsessie).
await page.mouse.click(10, 10);
await page.waitForTimeout(200);
const muis = await stand();
check('Een muisklik zet de muismodus terug; zonder pointer lock is het spel niet actief', muis.modus === 'muis' && !muis.touchKlasse && !muis.actief, muis);

alleErrs.push(...errs);
await browser.close();
const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
