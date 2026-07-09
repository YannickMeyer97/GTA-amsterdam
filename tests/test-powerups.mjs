// Power-ups: drop/pickup/verval, de vier effecten, en de cooldowns op
// sterke power-ups (Tickets 2/3). Zie ARCHITECTURE_NOTES.md §1
// "Power-up drops" / "Power-up effecten".
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

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
    // Cooldowns resetten per poging: dit test alleen POWERUP_DROP_KANS zelf,
    // niet welk type gekozen wordt (dat wordt hieronder apart getest).
    d.laatsteSterkePowerupGolf = -Infinity;
    d.laatsteKerninslagGolf = -Infinity;
    d.laatsteMunitievoorraadGolf = -Infinity;
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

// --- 8. Ticket 2: cooldown op sterke power-ups (2 golven) -----------------
// laatsteMunitie staat standaard ver in het verleden zodat deze checks
// puur de sterke-cooldown testen (de eigen Munitievoorraad-cooldown wordt
// hieronder apart getest).
function sample(golf, laatsteSterke, n = 200, laatsteKerninslag = -Infinity, laatsteMunitie = -Infinity) {
  return page.evaluate(({ golf, laatsteSterke, laatsteKerninslag, laatsteMunitie, n }) => {
    const d = window.AmsterdamUndeadDebug;
    d.spelStaat.golf = golf;
    d.laatsteSterkePowerupGolf = laatsteSterke;
    d.laatsteKerninslagGolf = laatsteKerninslag;
    d.laatsteMunitievoorraadGolf = laatsteMunitie;
    const gezien = new Set();
    for (let i = 0; i < n; i++) gezien.add(d.kiesPowerupType());
    return [...gezien];
  }, { golf, laatsteSterke, laatsteKerninslag, laatsteMunitie, n });
}

const golf4 = await sample(4, 4);
check('Golf 4 (dezelfde golf als een sterke drop): uitsluitend munitievoorraad',
  golf4.length === 1 && golf4[0] === 'munitievoorraad', { golf4 });
const golf5 = await sample(5, 4);
check('Golf 5 (1 golf na sterke drop, cooldown=2): uitsluitend munitievoorraad',
  golf5.length === 1 && golf5[0] === 'munitievoorraad', { golf5 });
const golf6 = await sample(6, 4);
check('Golf 6 (2 golven na sterke drop): weer alle 4 types', golf6.length === 4, { golf6 });

// --- 8b. Feedbackronde: eigen cooldown op Munitievoorraad (2 golven) ------
const golf4Munitie = await sample(4, -Infinity, 200, -Infinity, 4);
check('Golf 4 (dezelfde golf als een Munitievoorraad-drop): Munitievoorraad niet, sterke types wel',
  !golf4Munitie.includes('munitievoorraad') && golf4Munitie.includes('kerninslag'), { golf4Munitie });
const golf5Munitie = await sample(5, -Infinity, 200, -Infinity, 4);
check('Golf 5 (1 golf na Munitievoorraad-drop, cooldown=2): nog steeds geen Munitievoorraad',
  !golf5Munitie.includes('munitievoorraad') && golf5Munitie.includes('dubbeleBeloning'), { golf5Munitie });
const golf6Munitie = await sample(6, -Infinity, 200, -Infinity, 4);
check('Golf 6 (2 golven na Munitievoorraad-drop): Munitievoorraad weer toegestaan',
  golf6Munitie.includes('munitievoorraad'), { golf6Munitie });

// Randgeval: alle vier types tegelijk op cooldown -> kiesPowerupType() geeft
// undefined, en spawnPowerupDrop() moet dat stilletjes negeren (geen crash).
const alleOpCooldown = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 4;
  d.laatsteSterkePowerupGolf = 4;
  d.laatsteKerninslagGolf = 4;
  d.laatsteMunitievoorraadGolf = 4;
  const gekozen = d.kiesPowerupType();
  const voorLengte = d.powerups.length;
  let crashte = false;
  try { d.spawnPowerupDrop(0, 0, gekozen); } catch { crashte = true; }
  const naLengte = d.powerups.length;
  d.laatsteSterkePowerupGolf = -Infinity;
  d.laatsteKerninslagGolf = -Infinity;
  d.laatsteMunitievoorraadGolf = -Infinity;
  return { gekozen, voorLengte, naLengte, crashte };
});
check('kiesPowerupType() geeft undefined als alle types op cooldown staan, en spawnPowerupDrop() negeert dat zonder crash',
  alleOpCooldown.gekozen === undefined && !alleOpCooldown.crashte && alleOpCooldown.voorLengte === alleOpCooldown.naLengte, alleOpCooldown);

const registratieMunitie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 8;
  d.laatsteMunitievoorraadGolf = -Infinity;
  const voor = d.laatsteMunitievoorraadGolf;
  d.spawnPowerupDrop(0, 0, 'munitievoorraad');
  const na = d.laatsteMunitievoorraadGolf;
  for (const p of [...d.powerups]) { const i = d.powerups.indexOf(p); if (i !== -1) d.powerups.splice(i, 1); }
  return { voor, na };
});
check('spawnPowerupDrop() met munitievoorraad zet laatsteMunitievoorraadGolf op de huidige golf',
  registratieMunitie.voor === -Infinity && registratieMunitie.na === 8, registratieMunitie);

const registratieSterk = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 7;
  d.laatsteSterkePowerupGolf = -Infinity;
  d.laatsteKerninslagGolf = -Infinity;
  const voor = d.laatsteSterkePowerupGolf;
  d.spawnPowerupDrop(0, 0, 'eliminatiemodus');
  const na = d.laatsteSterkePowerupGolf;
  for (const p of [...d.powerups]) { const i = d.powerups.indexOf(p); if (i !== -1) d.powerups.splice(i, 1); }
  return { voor, na };
});
check('spawnPowerupDrop() met een sterk type zet laatsteSterkePowerupGolf op de huidige golf',
  registratieSterk.voor === -Infinity && registratieSterk.na === 7, registratieSterk);

// --- 9. Ticket 3: aparte, langere Kerninslag-cooldown (4 golven) ---------
const golf7Mix = await sample(7, 5, 200, 5);
check('Golf 7 (sterke-cd verlopen, kerninslag-cd nog actief): andere sterke types wel, kerninslag niet',
  golf7Mix.includes('dubbeleBeloning') && golf7Mix.includes('eliminatiemodus') && !golf7Mix.includes('kerninslag'), { golf7Mix });
const golf9Mix = await sample(9, 5, 200, 5);
check('Golf 9 (4 golven na Kerninslag): alle 4 types weer mogelijk, incl. kerninslag',
  golf9Mix.length === 4 && golf9Mix.includes('kerninslag'), { golf9Mix });

const registratieKerninslag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 12;
  d.laatsteKerninslagGolf = -Infinity;
  d.spawnPowerupDrop(0, 0, 'kerninslag');
  const na = d.laatsteKerninslagGolf;
  for (const p of [...d.powerups]) { const i = d.powerups.indexOf(p); if (i !== -1) d.powerups.splice(i, 1); }
  return { na };
});
check('spawnPowerupDrop() met kerninslag zet laatsteKerninslagGolf op de huidige golf',
  registratieKerninslag.na === 12, registratieKerninslag);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
