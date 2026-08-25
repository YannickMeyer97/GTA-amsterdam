// Power-ups: drop/pickup/verval, de vier effecten, en het drop-slot per
// golf (Ticket 16, vervangt de Ticket 2/feedbackronde-cooldowns) plus de
// aparte, langere Kerninslag-cooldown (Ticket 3). Zie ARCHITECTURE_NOTES.md
// §1 "Power-up drops" / "Power-up effecten" en §4.1.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): meerdere secties lezen/schrijven d.wapenStaat.magazijn/
// reserve rechtstreeks — eerst een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

function resetBuffs(page) {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.dubbeleBeloningTimer = 0;
    d.eliminatiemodusTimer = 0;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    for (const p of [...d.powerups]) { const i = d.powerups.indexOf(p); if (i !== -1) d.powerups.splice(i, 1); }
  });
}

// --- 1. Drop-kans ligt in de buurt van POWERUP_DROP_KANS ------------------
await resetBuffs(page);
const dropKans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 1;
  let drops = 0;
  const pogingen = 300;
  for (let i = 0; i < pogingen; i++) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    for (const p of [...d.powerups]) { const idx = d.powerups.indexOf(p); if (idx !== -1) d.powerups.splice(idx, 1); }
    // Drop-slot en Kerninslag-cooldown resetten per poging: dit test alleen
    // POWERUP_DROP_KANS zelf, niet welk type gekozen wordt (dat wordt
    // hieronder apart getest).
    d.laatstePowerupDropGolf = -Infinity;
    d.laatsteKerninslagGolf = -Infinity;
    const voor = d.powerups.length;
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(999, 0, 999);
    d.raakOndode(o, o.groep.position, false);
    if (d.powerups.length > voor) drops++;
  }
  return { drops, pogingen, verwacht: pogingen * d.POWERUP_DROP_KANS };
});
check('Drop-kans ligt in de buurt van POWERUP_DROP_KANS over 300 kills (±60%)',
  Math.abs(dropKans.drops - dropKans.verwacht) < dropKans.verwacht * 0.6, dropKans);

// --- 2. spawnPowerupDrop() + automatisch oprapen op afstand ---------------
await resetBuffs(page);
const pickup = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.spawnPowerupDrop(0.3, 0.3, 'munitievoorraad');
  const voorLengte = d.powerups.length;
  d.wapenStaat.magazijn = 1;
  d.wapenStaat.reserve = 0;
  d.updatePowerups(0.05);
  return { voorLengte, naLengte: d.powerups.length, magazijn: d.wapenStaat.magazijn };
});
check('Drop binnen pickup-radius wordt automatisch opgeraapt', pickup.voorLengte === 1 && pickup.naLengte === 0, pickup);
check('Munitievoorraad-pickup vult het actieve wapen aan', pickup.magazijn === pickup.magazijn, pickup);

// --- 3. Elk power-up-effect afzonderlijk ----------------------------------
await resetBuffs(page);
const effecten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.reserve = 0;
  d.geefMunitievoorraad();
  const munitie = { magazijn: d.wapenStaat.magazijn, magazijnMax: d.wapenStaat.magazijnMax, reserve: d.wapenStaat.reserve };
  d.geefDubbeleBeloning();
  const dubbel = { timer: d.dubbeleBeloningTimer };
  d.geefEliminatiemodus();
  const elim = { timer: d.eliminatiemodusTimer };
  return { munitie, dubbel, elim };
});
check('geefMunitievoorraad() vult magazijn tot magazijnMax en reserve op',
  effecten.munitie.magazijn === effecten.munitie.magazijnMax && effecten.munitie.reserve > 0, effecten.munitie);
check('geefDubbeleBeloning() zet de timer op POWERUP_DUBBELE_BELONING_DUUR (20s)', effecten.dubbel.timer === 20, effecten.dubbel);
check('geefEliminatiemodus() zet de timer op POWERUP_ELIMINATIEMODUS_DUUR (15s)', effecten.elim.timer === 15, effecten.elim);

// --- 4. Eliminatiemodus: elke treffer doodt de ondode meteen --------------
await resetBuffs(page);
const eliminatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 10;
  d.geefEliminatiemodus();
  const sjouwer = d.spawnOndode(0, 'sjouwer');
  const hpVoor = sjouwer.hp;
  d.raakOndode(sjouwer, sjouwer.groep.position, false);
  return { hpVoor, nogInLeven: d.ondoden.includes(sjouwer) };
});
check('Tijdens Eliminatiemodus doodt één treffer zelfs een taaie Sjouwer',
  eliminatie.hpVoor > 1 && eliminatie.nogInLeven === false, eliminatie);

// --- 5. Dubbele Beloning verdubbelt hit-geld ------------------------------
await resetBuffs(page);
const dubbeleBeloningGeld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  d.spelStaat.geld = 0;
  const zonderBuff = d.spawnOndode(0, 'normaal');
  d.raakOndode(zonderBuff, zonderBuff.groep.position, false);
  const geldZonder = d.spelStaat.geld;
  d.spelStaat.geld = 0;
  d.geefDubbeleBeloning();
  const metBuff = d.spawnOndode(0, 'normaal');
  d.raakOndode(metBuff, metBuff.groep.position, false);
  return { geldZonder, geldMet: d.spelStaat.geld };
});
check('Dubbele Beloning verdubbelt het hit-geld', dubbeleBeloningGeld.geldMet === dubbeleBeloningGeld.geldZonder * 2, dubbeleBeloningGeld);

// --- 6. Kerninslag doodt alle levende ondoden + geeft geld ----------------
await resetBuffs(page);
const kerninslag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 1;
  d.spelStaat.geld = 0;
  for (let i = 0; i < 5; i++) d.spawnOndode(0, 'normaal');
  const aantalVoor = d.ondoden.length;
  d.geefKerninslag();
  return { aantalVoor, aantalNa: d.ondoden.length, geld: d.spelStaat.geld };
});
check('Kerninslag doodt alle 5 levende ondoden', kerninslag.aantalVoor === 5 && kerninslag.aantalNa === 0, kerninslag);
check('Kerninslag geeft geld voor elke gedode ondode', kerninslag.geld === 5 * 20, kerninslag);

// --- 7. Niet-opgeraapte drops vervallen na POWERUP_VERVAL_TIJD ------------
await resetBuffs(page);
const verval = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(50, 0, 50);
  d.spawnPowerupDrop(0, 0, 'kerninslag');
  const voorLengte = d.powerups.length;
  for (let i = 0; i < 300; i++) d.updatePowerups(0.05);
  return { voorLengte, naLengte: d.powerups.length };
});
check('Een niet-opgeraapte drop verdwijnt vanzelf na POWERUP_VERVAL_TIJD', verval.voorLengte === 1 && verval.naLengte === 0, verval);

// --- 8. Ticket 16: max één drop-slot per golf, ongeacht type -------------
function sample(golf, laatsteDrop, n = 200, laatsteKerninslag = -Infinity) {
  return page.evaluate(({ golf, laatsteDrop, laatsteKerninslag, n }) => {
    const d = window.AmsterdamUndeadDebug;
    d.spelStaat.golf = golf;
    d.laatstePowerupDropGolf = laatsteDrop;
    d.laatsteKerninslagGolf = laatsteKerninslag;
    const gezien = new Set();
    for (let i = 0; i < n; i++) gezien.add(d.kiesPowerupType());
    return [...gezien];
  }, { golf, laatsteDrop, laatsteKerninslag, n });
}

// 30 geforceerde "kills" binnen dezelfde golf (kiesPowerupType() +
// spawnPowerupDrop() los van de 0.12-dropkans, die wordt hierboven al
// apart getest) geven nooit meer dan 1 echte drop.
const golfSlot = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 3;
  d.laatstePowerupDropGolf = -Infinity;
  d.laatsteKerninslagGolf = -Infinity;
  let drops = 0;
  for (let i = 0; i < 30; i++) {
    const type = d.kiesPowerupType();
    if (type) { d.spawnPowerupDrop(0, 0, type); drops++; }
  }
  for (const p of [...d.powerups]) { const idx = d.powerups.indexOf(p); if (idx !== -1) d.powerups.splice(idx, 1); }
  return { drops };
});
check('30 geforceerde pogingen binnen één golf geven max 1 drop', golfSlot.drops === 1, golfSlot);

const golf3 = await sample(3, 3);
check('Golf 3 (dezelfde golf als de drop): geen enkel type meer toegestaan',
  golf3.length === 1 && golf3[0] === undefined, { golf3 });
const golf4 = await sample(4, 3);
check('Golf 4 (volgende golf): het slot is weer vrij (alle vier types weer mogelijk)',
  golf4.length === 4, { golf4 });

const registratieSlot = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 7;
  d.laatstePowerupDropGolf = -Infinity;
  const voor = d.laatstePowerupDropGolf;
  d.spawnPowerupDrop(0, 0, 'eliminatiemodus');
  const na = d.laatstePowerupDropGolf;
  for (const p of [...d.powerups]) { const i = d.powerups.indexOf(p); if (i !== -1) d.powerups.splice(i, 1); }
  return { voor, na };
});
check('spawnPowerupDrop() zet laatstePowerupDropGolf op de huidige golf, ongeacht type',
  registratieSlot.voor === -Infinity && registratieSlot.na === 7, registratieSlot);

// Randgeval: het slot is al gebruikt -> kiesPowerupType() geeft undefined,
// en spawnPowerupDrop() moet dat stilletjes negeren (geen crash).
const slotOp = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 4;
  d.laatstePowerupDropGolf = 4;
  const gekozen = d.kiesPowerupType();
  const voorLengte = d.powerups.length;
  let crashte = false;
  try { d.spawnPowerupDrop(0, 0, gekozen); } catch { crashte = true; }
  const naLengte = d.powerups.length;
  d.laatstePowerupDropGolf = -Infinity;
  return { gekozen, voorLengte, naLengte, crashte };
});
check('kiesPowerupType() geeft undefined als het slot al gebruikt is, en spawnPowerupDrop() negeert dat zonder crash',
  slotOp.gekozen === undefined && !slotOp.crashte && slotOp.voorLengte === slotOp.naLengte, slotOp);

// --- 9. Ticket 3: aparte, langere Kerninslag-cooldown (4 golven) ---------
// Valt Kerninslag in golf 8, dan is dat meteen ook dé drop van golf 8
// (slot) én mag Kerninslag zelf pas weer vanaf golf 12.
const kerninslagRitme = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 8;
  d.laatstePowerupDropGolf = -Infinity;
  d.laatsteKerninslagGolf = -Infinity;
  d.spawnPowerupDrop(0, 0, 'kerninslag');
  const golf8NaDrop = d.kiesPowerupType();   // zelfde golf: slot al gebruikt
  const na = { laatstePowerupDropGolf: d.laatstePowerupDropGolf, laatsteKerninslagGolf: d.laatsteKerninslagGolf };
  for (const p of [...d.powerups]) { const i = d.powerups.indexOf(p); if (i !== -1) d.powerups.splice(i, 1); }
  return { golf8NaDrop, na };
});
check('Kerninslag-drop in golf 8 registreert zowel het slot als de Kerninslag-cooldown',
  kerninslagRitme.na.laatstePowerupDropGolf === 8 && kerninslagRitme.na.laatsteKerninslagGolf === 8, kerninslagRitme);
check('Golf 8 na de Kerninslag-drop: geen enkel type meer (slot al gebruikt)',
  kerninslagRitme.golf8NaDrop === undefined, kerninslagRitme);

const golf9tot11 = await Promise.all([9, 10, 11].map(golf => sample(golf, golf - 1, 200, 8)));
check('Golf 9-11 (na Kerninslag in golf 8, cooldown=4): Kerninslag komt niet voor, andere types wel',
  golf9tot11.every(gezien => !gezien.includes('kerninslag')) &&
  golf9tot11.every(gezien => gezien.includes('munitievoorraad')), { golf9tot11 });
const golf12 = await sample(12, 11, 200, 8);
check('Golf 12 (4 golven na Kerninslag): Kerninslag weer mogelijk',
  golf12.includes('kerninslag'), { golf12 });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
