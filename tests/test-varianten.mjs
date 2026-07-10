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

// --- 4. Sjouwer: 5 HP op golf >= 3 (Ticket 5), trager, meer geld ---------
const sjouwerStats = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 3;
  const sjouwer = d.spawnOndode(0, 'sjouwer');
  const normaal = d.spawnOndode(0, 'normaal');
  return { hp: sjouwer.hp, snelheid: sjouwer.snelheid, normaalSnelheid: normaal.snelheid, normaalHp: normaal.hp };
});
check('Op golf >= 3: sjouwer.hp === 5', sjouwerStats.hp === 5, sjouwerStats);
check('Sjouwer is trager en heeft meer HP dan normaal',
  sjouwerStats.snelheid < sjouwerStats.normaalSnelheid && sjouwerStats.hp > sjouwerStats.normaalHp, sjouwerStats);

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
