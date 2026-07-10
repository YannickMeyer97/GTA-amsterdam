// Ondode-varianten: Loper/Sjouwer/Brander (Ticket v0.7 + balanspatch
// Tickets 4/5). Zie ARCHITECTURE_NOTES.md §1 "Zombie-typedefinities".
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. spawnOndode() zonder type-argument blijft 'normaal' --------------
const standaard = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const o = d.spawnOndode(0);
  return { type: o.type, geldMultiplier: o.geldMultiplier };
});
check("spawnOndode(idx) zonder type is altijd 'normaal'",
  standaard.type === 'normaal' && standaard.geldMultiplier === 1, standaard);

// --- 2. ondodeTypeGewichten(): varianten pas vanaf hun eigen golf --------
const gewichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 1;
  const golf1 = d.ondodeTypeGewichten();
  d.spelStaat.golf = 4;
  const golf4 = d.ondodeTypeGewichten();
  return { golf1, golf4 };
});
check('Golf 1: alleen normaal heeft gewicht', gewichten.golf1.loper === 0 &&
  gewichten.golf1.sjouwer === 0 && gewichten.golf1.brander === 0 && gewichten.golf1.normaal > 0, gewichten.golf1);
check('Golf 4: alle drie varianten hebben een gewicht > 0',
  gewichten.golf4.loper > 0 && gewichten.golf4.sjouwer > 0 && gewichten.golf4.brander > 0, gewichten.golf4);

// --- 3. Loper: 2,2 m/s (Ticket 4), minder HP -------------------------------
const loperStats = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const loper = d.spawnOndode(0, 'loper');
  const normaal = d.spawnOndode(0, 'normaal');
  return { loperSnelheid: loper.snelheid, normaalSnelheid: normaal.snelheid, loperHp: loper.hp, normaalHp: normaal.hp };
});
check('Loper-snelheid is ~2.205 m/s (±0.01)', Math.abs(loperStats.loperSnelheid - 2.205) < 0.01, loperStats);
check('Loper is sneller en heeft minder HP dan normaal',
  loperStats.loperSnelheid > loperStats.normaalSnelheid && loperStats.loperHp < loperStats.normaalHp, loperStats);

// --- 4. Sjouwer: 5 HP op golf 5-10 (Ticket 5 + 14), trager, meer geld -----
// Ticket 14: basis-HP is nu een trap (golf 3 -> basis 1 -> sjouwer 3);
// de klassieke "sjouwer = 5" geldt op de 2-HP-trap (golf 5-10).
const sjouwerStats = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const sjouwer = d.spawnOndode(0, 'sjouwer');
  const normaal = d.spawnOndode(0, 'normaal');
  return { hp: sjouwer.hp, snelheid: sjouwer.snelheid, normaalSnelheid: normaal.snelheid, normaalHp: normaal.hp };
});
check('Op golf 5-10 (basis 2): sjouwer.hp === 5', sjouwerStats.hp === 5, sjouwerStats);
check('Sjouwer is trager en heeft meer HP dan normaal',
  sjouwerStats.snelheid < sjouwerStats.normaalSnelheid && sjouwerStats.hp > sjouwerStats.normaalHp, sjouwerStats);

// --- 4b. Ticket 14: HP-trap over golf 1-25 + Sjouwer-plafond 8 ------------
const hpTabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (let golf = 1; golf <= 25; golf++) {
    d.spelStaat.golf = golf;
    const normaal = d.spawnOndode(0, 'normaal');
    const sjouwer = d.spawnOndode(0, 'sjouwer');
    const loper = d.spawnOndode(0, 'loper');
    const sluiper = d.spawnOndode(0, 'sluiper');
    uit[golf] = { basis: d.ondodeStartHP(), normaal: normaal.hp, sjouwer: sjouwer.hp, loper: loper.hp, sluiper: sluiper.hp };
    for (const o of [...d.ondoden]) d.doodOndode(o);
  }
  return uit;
});
const trapKlopt = [[1, 1], [4, 1], [5, 2], [10, 2], [11, 3], [15, 3], [16, 4], [25, 4]]
  .every(([golf, hp]) => hpTabel[golf].normaal === hp);
check('Normaal-HP volgt de trap: 1(g1-4) 2(g5-10) 3(g11-15) 4(g16+, plafond)', trapKlopt,
  Object.fromEntries([1, 4, 5, 10, 11, 15, 16, 25].map(g => [g, hpTabel[g].normaal])));
const sjouwerNooitBoven8 = Object.values(hpTabel).every(rij => rij.sjouwer <= 8);
check('Sjouwer-HP is nooit hoger dan 8 (golf 16+: min(round(4x2.5), 8) = 8)',
  sjouwerNooitBoven8 && hpTabel[16].sjouwer === 8 && hpTabel[11].sjouwer === 8, hpTabel[16]);
const minimum1 = Object.values(hpTabel).every(rij => rij.loper >= 1 && rij.sluiper >= 1);
check('Loper en Sluiper zakken nooit onder 1 HP', minimum1, { golf1: hpTabel[1] });

// --- 5. Brander: normale HP, ontploft bij overlijden ----------------------
const branderType = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const brander = d.spawnOndode(0, 'brander');
  const normaal = d.spawnOndode(0, 'normaal');
  return { type: brander.type, hp: brander.hp, normaalHp: normaal.hp };
});
check("Brander heeft type 'brander' en normale HP", branderType.type === 'brander' && branderType.hp === branderType.normaalHp, branderType);

const explosie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 1;
  d.spelerStaat.hp = 100;
  d.speler.positie.set(0, 0, 0);
  const brander = d.spawnOndode(0, 'brander');
  brander.groep.position.set(0.5, 0, 0.5);
  const slachtoffer = d.spawnOndode(0, 'normaal');
  slachtoffer.groep.position.set(1.0, 0, 0.5);
  slachtoffer.hp = 1;
  const hpVoor = d.spelerStaat.hp;
  d.doodOndode(brander);
  return { hpVoor, hpNa: d.spelerStaat.hp, slachtofferNogInLeven: d.ondoden.includes(slachtoffer) };
});
check('Ontploffing van een Brander doet schade aan de speler in bereik', explosie.hpNa === explosie.hpVoor - 25, explosie);
check('Ontploffing van een Brander doodt een andere ondode in bereik', explosie.slachtofferNogInLeven === false, explosie);

// --- 6. Kill-geld schaalt mee met geldMultiplier --------------------------
const geld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.dubbeleBeloningTimer = 0;
  d.eliminatiemodusTimer = 0;
  d.spelStaat.golf = 1;
  d.spelStaat.geld = 0;
  const sjouwer = d.spawnOndode(0, 'sjouwer');   // hp = round(1*2.5) = 3 op golf 1
  for (let i = 0; i < 10 && d.ondoden.includes(sjouwer); i++) d.raakOndode(sjouwer, sjouwer.groep.position, false);
  return { geld: d.spelStaat.geld };
});
check('Sjouwer-kill levert meer geld op dan een normale kill (GELD_PER_KILL * 2.2, afgerond)',
  geld.geld === Math.round(20 * 2.2) + 5 * 2, geld);

// --- 7. golfSpawnStap() gebruikt kiesOndodeType() (echte golf-spawns) ----
const golfSpawnType = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 10;
  for (const v of d.VENSTERS) v.planken = 0;
  const types = new Set();
  for (let i = 0; i < 60; i++) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.budget = 999;   // Ticket 13: golfSpawnStap checkt nu budget
    const o = d.golfSpawnStap();
    if (o) types.add(o.type);
  }
  return [...types];
});
check('golfSpawnStap() produceert op golf 10 meerdere verschillende types over 60 spawns',
  golfSpawnType.length > 1, golfSpawnType);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
