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
  d.spelStaat.budget = 0;
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
  d.spelStaat.budget = 0;
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
  d.spelStaat.budget = 0;
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
  d.spelStaat.budget = 0;
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
  d.spelStaat.budget = 0;
  d.updateGolf(0.1);
  const el = document.getElementById('golfBanner');
  return el.textContent;
});
check('Banner toont "Wave cleared" met een bonusbedrag', banner.includes('Wave cleared') && banner.includes('€'), { banner });

// --- 5. startGolf() zet het dreigingsbudget en toont de "GOLF X"-banner ---
// Ticket 13: teSpawnen (aantal) is vervangen door spelStaat.budget (dreiging).
const start = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 3;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const el = document.getElementById('golfBanner');
  return { budget: d.spelStaat.budget, golfActief: d.spelStaat.golfActief, banner: el.textContent };
});
check('startGolf() op golf 3 zet het budget op 8 (round(5 + 1.7x2))',
  start.budget === 8 && start.golfActief === true, start);
check('startGolf() toont de "GOLF 3"-banner met dreiging i.p.v. aantal',
  start.banner.includes('GOLF 3') && start.banner.includes('dreiging 8'), start);

// --- 6. Ticket 13: volledige golf-cyclus onder budget-semantiek -----------
// Simuleert golf 1 en golf 9 volledig (spawn-ticks -> uitroeien -> golf++):
// de kern-acceptatie van het threat-budget.
async function draaiGolf(golf) {
  return page.evaluate((golf) => {
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    for (const v of d.VENSTERS) v.planken = 0;
    d.spelStaat.golf = golf;
    d.spelStaat.gameOver = false;
    d.spelerStaat.hp = 100;
    d.startGolf();
    const perType = {};
    let totaal = 0, ticks = 0;
    while (d.spelStaat.golfActief && ticks < 500) {
      const voor = d.ondoden.length;
      d.updateGolf(2);   // ruim boven het spawn-interval: elke tick één stap
      if (d.ondoden.length > voor) {
        const nieuwste = d.ondoden[d.ondoden.length - 1];
        perType[nieuwste.type] = (perType[nieuwste.type] || 0) + 1;
        totaal++;
      }
      for (const o of [...d.ondoden]) d.doodOndode(o);
      ticks++;
    }
    return { totaal, perType, golfNa: d.spelStaat.golf, actiefNa: d.spelStaat.golfActief };
  }, golf);
}

const cyclus1 = await draaiGolf(1);
check('Golf 1: budget 5 -> exact 5 normale ondoden, daarna golf++',
  cyclus1.totaal === 5 && cyclus1.perType.normaal === 5 && cyclus1.golfNa === 2 && cyclus1.actiefNa === false, cyclus1);

const cyclus9 = await draaiGolf(9);
check('Golf 9: minder ondoden dan het oude lineaire aantal (21), maar met zwaardere types',
  cyclus9.totaal < 21 && Object.keys(cyclus9.perType).length > 1 && cyclus9.golfNa === 10, cyclus9);

// Budget-uitputting met een duur type: een Sjouwer (3) op restbudget 2 is te
// duur -> terugval op normaal (1); op restbudget 0.5 stopt de golf.
const uitputting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (const v of d.VENSTERS) v.planken = 0;
  d.spelStaat.golf = 6;   // geen event, sjouwer/brander toegestaan
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0.5;
  const spawn = d.golfSpawnStap();
  return { spawn: spawn ? spawn.type : null, budget: d.spelStaat.budget };
});
check('Restbudget 0.5: zelfs "normaal" (kosten 1) is te duur -> geen spawn, budget op 0',
  uitputting.spawn === null && uitputting.budget === 0, uitputting);

// Barricades beuken kost geen budget.
const barricade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (const v of d.VENSTERS) v.planken = 3;
  d.spelStaat.golf = 1;
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 5;
  const spawn = d.golfSpawnStap();   // beukt een plank, spawnt niets
  const na = { spawn: spawn === null, budget: d.spelStaat.budget };
  for (const v of d.VENSTERS) v.planken = 0;
  return na;
});
check('Een barricade-beuk spawnt niets en laat het budget onaangetast (5)',
  barricade.spawn === true && barricade.budget === 5, barricade);

// --- 7. Ticket 15: spawn-cap 14, +2 per extra ontgrendelde zone -----------
// LET OP: koopt deuren en hoort daarom als laatste blok in dit bestand.
const caps = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const zone1 = d.effectiefMaxActief();
  d.spelStaat.geld = 5000;
  d.koopDeur();
  const zone2 = d.effectiefMaxActief();
  d.koopDeur2();
  const zone3 = d.effectiefMaxActief();
  return { zone1, zone2, zone3, max: d.GOLF_MAX_ACTIEF };
});
check('Spawn-cap per zonestand is 14/16/18 (GOLF_MAX_ACTIEF 14, bonus 2 per zone)',
  caps.zone1 === 14 && caps.zone2 === 16 && caps.zone3 === 18 && caps.max === 14, caps);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
