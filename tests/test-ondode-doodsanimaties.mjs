// Doodsanimaties (Ticket 22, Z5): een dode ondode valt zichtbaar neer i.p.v.
// meteen te verdwijnen. Bewaakt de drie contracten uit ontwerpbeslissing 17:
// (1) golf-einde telt `ondoden`, niet lijken; (2) `schiet()`-raycast raakt
// `ondodenGroep`, een lijk mag geen kogels meer vangen; (3) melee/collision
// itereren `ondoden`, een lijk kan niet meer slaan. Brander behoudt zijn
// directe explosie zonder lijk.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

function opruimen() {
  return `
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    for (const s of [...d.stervenden]) { d.stervendenGroep.remove(s.groep); }
    d.stervenden.length = 0;
    d.eliminatiemodusTimer = 0;
    d.dubbeleBeloningTimer = 0;
  `;
}

// --- 1. Contract A: golf eindigt zodra `ondoden` leeg is, ook met lijken --
const golfEinde = await page.evaluate(new Function(`
  ${opruimen()}
  d.spelStaat.golf = 1;
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;   // geen spawn-werk meer -> updateGolf mag afronden
  for (let i = 0; i < 3; i++) {
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(0, 0, -5 - i);
    d.doodOndode(o);
  }
  const ondodenNa = d.ondoden.length;
  const stervendenNa = d.stervenden.length;
  d.updateGolf(0.1);
  const golfActiefNa = d.spelStaat.golfActief;
  const golfNummerNa = d.spelStaat.golf;
  return { ondodenNa, stervendenNa, golfActiefNa, golfNummerNa };
`));
check('Na 3 kills: ondoden is leeg, maar er staan 3 lijken (stervenden)',
  golfEinde.ondodenNa === 0 && golfEinde.stervendenNa === 3, golfEinde);
check('updateGolf() rondt de golf toch af terwijl er nog lijken in beeld staan',
  golfEinde.golfActiefNa === false && golfEinde.golfNummerNa === 2, golfEinde);

// --- 2. Contract B: schiet()-raycast raakt geen lijk, wél de levende ondode
// er direct achter (bewijst dat het lijk geen kogels meer vangt) ----------
const raycastDoorLijk = await page.evaluate(new Function(`
  ${opruimen()}
  d.spelStaat.golf = 1;
  d.schadePerTreffer = 1;
  d.wapenStaat.magazijn = 8;
  const lijkKandidaat = d.spawnOndode(0, 'normaal');
  lijkKandidaat.groep.position.set(0, 0, -3);
  lijkKandidaat.groep.scale.setScalar(1);
  d.doodOndode(lijkKandidaat);   // wordt meteen een lijk (stervenden), blijft zichtbaar staan
  const inOndodenGroep = d.ondodenGroep.children.includes(lijkKandidaat.groep);
  const inStervendenGroep = d.stervendenGroep.children.includes(lijkKandidaat.groep);

  const erAchter = d.spawnOndode(0, 'normaal');
  erAchter.hp = 1000;
  erAchter.groep.position.set(0, 0, -8);   // recht achter het lijk, zelfde lijn
  erAchter.groep.scale.setScalar(1);

  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  d.speler.pitch = Math.atan2(1.58 - d.speler.hoogte, 8);
  d.camera.position.set(0, d.speler.hoogte, 0);
  d.camera.rotation.y = 0;
  d.camera.rotation.x = d.speler.pitch;
  lijkKandidaat.groep.updateMatrixWorld(true);
  erAchter.groep.updateMatrixWorld(true);
  d.camera.updateMatrixWorld(true);
  const hpVoor = erAchter.hp;
  d.schiet();
  const schadeOpDeLevendeAchter = hpVoor - erAchter.hp;
  return { inOndodenGroep, inStervendenGroep, schadeOpDeLevendeAchter };
`));
check('Een lijk verlaat ondodenGroep en staat in stervendenGroep',
  raycastDoorLijk.inOndodenGroep === false && raycastDoorLijk.inStervendenGroep === true, raycastDoorLijk);
check('schiet() raakt het lijk niet: de kogel gaat erdoorheen en raakt de levende ondode erachter',
  raycastDoorLijk.schadeOpDeLevendeAchter > 0, raycastDoorLijk);

// --- 3. Contract C: melee/collision itereren `ondoden` — een lijk kan niet
// meer slaan (staat simpelweg niet meer in de array) ------------------------
const geenMeleeAlsLijk = await page.evaluate(new Function(`
  ${opruimen()}
  const o = d.spawnOndode(0, 'normaal');
  d.doodOndode(o);
  return { nogInOndoden: d.ondoden.includes(o) };
`));
check('Een lijk staat niet meer in `ondoden` (kan dus niet meer melee-slaan)',
  geenMeleeAlsLijk.nogInOndoden === false, geenMeleeAlsLijk);

// --- 4. Brander: directe explosie, GEEN lijk -------------------------------
const branderGeenLijk = await page.evaluate(new Function(`
  ${opruimen()}
  const b = d.spawnOndode(0, 'brander');
  b.groep.position.set(999, 0, 999);   // ver van de speler: geen schade/geluid-ruis
  d.doodOndode(b);
  return { stervendenNa: d.stervenden.length };
`));
check('Een Brander laat GEEN lijk achter (directe explosie, ontwerpbeslissing 17)',
  branderGeenLijk.stervendenNa === 0, branderGeenLijk);

// --- 5. Kerninslag met 5 ondoden -> 5 stervenden, golf rondt normaal af ---
const kerninslag = await page.evaluate(new Function(`
  ${opruimen()}
  d.spelStaat.golf = 1;
  d.spelStaat.golfActief = true;
  d.spelStaat.geld = 0;
  for (let i = 0; i < 5; i++) {
    const o = d.spawnOndode(i % 4, 'normaal');
    o.groep.position.set(i * 2, 0, -6);
  }
  d.geefKerninslag();
  const ondodenNa = d.ondoden.length;
  const stervendenNa = d.stervenden.length;
  d.spelStaat.budget = 0;
  d.updateGolf(0.1);
  return { ondodenNa, stervendenNa, golfActiefNa: d.spelStaat.golfActief };
`));
check('Kerninslag op 5 ondoden geeft 5 stervenden (lijken)',
  kerninslag.ondodenNa === 0 && kerninslag.stervendenNa === 5, kerninslag);
check('Golf rondt na Kerninslag gewoon af, ook met 5 lijken in beeld',
  kerninslag.golfActiefNa === false, kerninslag);

// --- 6. Val-stijl varieert over meerdere kills -----------------------------
const valStijlen = await page.evaluate(new Function(`
  ${opruimen()}
  const gezien = new Set();
  for (let i = 0; i < 40; i++) {
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(999, 0, 999);
    d.doodOndode(o);
    gezien.add(d.stervenden[d.stervenden.length - 1].stijl);
  }
  return { verschillend: gezien.size, gezien: [...gezien] };
`));
check('Over 40 kills komen minstens 2 verschillende valstijlen voor',
  valStijlen.verschillend >= 2, valStijlen);
check('Elke geziene valstijl komt uit VAL_STIJLEN', (await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return true;
})) && valStijlen.gezien.every(s => ['voorover', 'achterover', 'zijwaarts', 'inzakken'].includes(s)), valStijlen);

// --- 7. updateStervenden(dt): de val-rotatie/verzakking verandert, en het
// lijk verdwijnt na STERVEN_DUUR definitief uit stervenden + de scene-Group -
const valAnimatie = await page.evaluate(new Function(`
  ${opruimen()}
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(999, 0, 999);
  d.doodOndode(o);
  const s = d.stervenden[0];
  const stijl = s.stijl;
  const voorRotX = s.groep.rotation.x, voorRotZ = s.groep.rotation.z, voorY = s.groep.position.y;
  d.updateStervenden(0.1);
  const naRotX = s.groep.rotation.x, naRotZ = s.groep.rotation.z, naY = s.groep.position.y;
  const veranderd = naRotX !== voorRotX || naRotZ !== voorRotZ || naY !== voorY;
  // Genoeg ticks om ruim over STERVEN_DUUR (0.7s) heen te komen.
  for (let i = 0; i < 20; i++) d.updateStervenden(0.1);
  const nogInStervenden = d.stervenden.includes(s);
  const nogInGroep = d.stervendenGroep.children.includes(s.groep);
  return { stijl, veranderd, nogInStervenden, nogInGroep };
`));
check('updateStervenden(dt) laat de valanimatie daadwerkelijk bewegen',
  valAnimatie.veranderd, valAnimatie);
check('Na STERVEN_DUUR verdwijnt het lijk definitief uit stervenden en de scene-Group',
  valAnimatie.nogInStervenden === false && valAnimatie.nogInGroep === false, valAnimatie);

// --- 8. Regressie: power-up-drops gebruiken nog steeds de doodspositie ----
const dropPositie = await page.evaluate(new Function(`
  ${opruimen()}
  for (const p of [...d.powerups]) d.raapPowerupOp(p);
  d.spelStaat.golf = 1;
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(12.5, 0, -7.5);
  let drop = null;
  for (let poging = 0; poging < 50 && !drop; poging++) {
    for (const p of [...d.powerups]) d.raapPowerupOp(p);
    d.laatstePowerupDropGolf = -Infinity;
    d.laatsteKerninslagGolf = -Infinity;
    const o2 = d.spawnOndode(0, 'normaal');
    o2.groep.position.set(12.5, 0, -7.5);
    d.raakOndode(o2, o2.groep.position, false);
    if (d.powerups.length > 0) drop = d.powerups[d.powerups.length - 1];
  }
  const uit = drop ? { gevonden: true, dx: Math.abs(drop.groep.position.x - 12.5), dz: Math.abs(drop.groep.position.z + 7.5) } : { gevonden: false };
  for (const p of [...d.powerups]) d.raapPowerupOp(p);
  return uit;
`));
check('Power-up-drop verschijnt nog steeds op de doodspositie van de ondode',
  dropPositie.gevonden && dropPositie.dx < 0.01 && dropPositie.dz < 0.01, dropPositie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
