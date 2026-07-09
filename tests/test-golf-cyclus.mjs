// Golf-cyclus: start/spawn/einde, wave-rewards en auto-heal.
// Zie ARCHITECTURE_NOTES.md §1 ("Waves: starten, spawnen, eindigen") voor
// de exacte symbolen (startGolf/updateGolf/spelStaat).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. GOLF_RUST_TIJD is 8s (v0.9) --------------------------------------
const rust = await page.evaluate(() => window.AmsterdamUndeadDebug.GOLF_RUST_TIJD);
check('GOLF_RUST_TIJD is 8', rust === 8, { rust });

// --- 2. Bonusgeld schaalt met het voltooide golfnummer -------------------
const bonusGolf1 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 1;
  d.spelStaat.geld = 0;
  d.spelStaat.golfActief = true;
  d.spelStaat.teSpawnen = 0;
  d.spelerStaat.hp = 100;
  d.updateGolf(0.1);
  return { geld: d.spelStaat.geld, golf: d.spelStaat.golf };
});
check('Bonus na golf 1 is €90 (WAVE_BONUS_BASIS 75 + 1x15), golf gaat naar 2',
  bonusGolf1.geld === 90 && bonusGolf1.golf === 2, bonusGolf1);

const bonusGolf5 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 5;
  d.spelStaat.geld = 0;
  d.spelStaat.golfActief = true;
  d.spelStaat.teSpawnen = 0;
  d.updateGolf(0.1);
  return { geld: d.spelStaat.geld };
});
check('Bonus na golf 5 is €150 (75 + 5x15) — schaalt mee met golfnummer',
  bonusGolf5.geld === 150, bonusGolf5);

// --- 3. Auto-heal naar minimaal WAVE_HEAL_MIN, verlaagt nooit (Ticket 1) -
const healLaag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.teSpawnen = 0;
  d.spelerStaat.hp = 20;
  d.updateGolf(0.1);
  return { hp: d.spelerStaat.hp, min: d.WAVE_HEAL_MIN };
});
check('HP wordt geheeld naar WAVE_HEAL_MIN als die eronder zit',
  healLaag.hp === healLaag.min, healLaag);

const healHoog = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.teSpawnen = 0;
  d.spelerStaat.hp = 90;
  d.updateGolf(0.1);
  return d.spelerStaat.hp;
});
check('HP wordt nooit verlaagd als die al boven WAVE_HEAL_MIN zit', healHoog === 90, { healHoog });

// --- 4. Banner-tekst is "Wave cleared" met bonusbedrag --------------------
const banner = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 2;
  d.spelStaat.golfActief = true;
  d.spelStaat.teSpawnen = 0;
  d.updateGolf(0.1);
  const el = document.getElementById('golfBanner');
  return el.textContent;
});
check('Banner toont "Wave cleared" met een bonusbedrag', banner.includes('Wave cleared') && banner.includes('€'), { banner });

// --- 5. startGolf() zet teSpawnen en toont de "GOLF X"-banner ------------
const start = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 3;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const el = document.getElementById('golfBanner');
  return { teSpawnen: d.spelStaat.teSpawnen, golfActief: d.spelStaat.golfActief, banner: el.textContent };
});
check('startGolf() op golf 3 zet 9 te spawnen ondoden klaar (5 + 2x2)',
  start.teSpawnen === 9 && start.golfActief === true, start);
check('startGolf() toont de "GOLF 3"-banner', start.banner.includes('GOLF 3'), start);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
