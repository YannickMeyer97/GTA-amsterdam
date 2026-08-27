// Doodsanimaties (Ticket 22, Z5): een dode ondode valt zichtbaar neer i.p.v.
// meteen te verdwijnen. Bewaakt de drie contracten uit ontwerpbeslissing 17:
// (1) golf-einde telt `ondoden`, niet lijken; (2) `schiet()`-raycast raakt
// `ondodenGroep`, een lijk mag geen kogels meer vangen; (3) melee/collision
// itereren `ondoden`, een lijk kan niet meer slaan. Brander behoudt zijn
// directe explosie zonder lijk.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): dit bestand gebruikt d.schiet() als middel om schade
// toe te brengen — eerst een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

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

// --- 6. Val-stijl varieert over meerdere MES-kills -------------------------
// Speeltoets-bijstelling (na T149): een SCHOT kiest voortaan altijd een
// van-de-speler-af-val (zie sectie 6b), dus de variatie-eis geldt nu voor het
// mes — dat duwt niet, en van dichtbij oogt elke valrichting geloofwaardig.
const valStijlen = await page.evaluate(new Function(`
  ${opruimen()}
  const gezien = new Set();
  for (let i = 0; i < 40; i++) {
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(999, 0, 999);
    d.doodOndode(o, null, false, true);   // doorMes = true
    gezien.add(d.stervenden[d.stervenden.length - 1].stijl);
  }
  return { verschillend: gezien.size, gezien: [...gezien] };
`));
check('Over 40 MES-kills komen minstens 2 verschillende valstijlen voor',
  valStijlen.verschillend >= 2, valStijlen);

// --- 6b. Speeltoets-bijstelling: een SCHOT laat het lichaam ALTIJD van de
// speler af vallen. De speeltest meldde "vallen ze naar mij toe als ik ze
// neerschiet"; gemeten was dat de stijl 'voorover' de kop 1,71m NAAR de
// speler bracht en in 25% van de kills werd geloot. Omdat de ondode de speler
// aankijkt, is lokaal 'achterover' per definitie van de speler af. --------
//
// Speeltoets-bijstelling (ronde 2): de EERSTE versie van deze fix
// (VAL_STIJLEN_SCHOT = alleen 'achterover') loste het probleem niet echt op —
// de speler meldde daarna "ze vallen nu bijna allemaal naar mij toe". Root
// cause: THREE's standaard Euler-volgorde 'XYZ' past rotation.y (kijkrichting)
// TOE VOORDAT rotation.x (de val-kantel) toegepast wordt, en het hoofd-botpunt
// ligt vrijwel exact op de Y-as — een rotatie om een as raakt een punt op die
// as niet. De kijkrichting deed dus feitelijk niets: de val verschoof altijd
// in dezelfde WERELD-richting, ongeacht waar de ondode heen keek. Deze test
// testte destijds slechts ÉÉN geometrie (ondode pal ten noorden van de
// speler, altijd op (0,0,-3), met rotation.y hard op 0 gezet) — daar viel
// "altijd dezelfde wereldrichting" toevallig samen met "van de speler af",
// dus de test gaf een vals-positieve bevestiging. Fix: rotation.order =
// 'YXZ' (kantel EERST, kijkrichting DAARNA) + expliciet rotation.y vastzetten
// op de kijkrichting-naar-de-speler op het moment van sterven (i.p.v. te
// vertrouwen op de AI-rotatie, die tijdens chaotisch gevecht kan interrumperen
// achterlopen). Deze test dekt nu MEERDERE aanlooprichtingen (noord, zuid,
// oost, west, diagonaal) én een WILLEKEURIGE (niet naar de speler gerichte)
// AI-kijkrichting bij het moment van sterven, om precies dit soort
// richtingsafhankelijke bug niet nog eens te missen. -----------------------
const schotRichtingen = [
  { naam: 'noord', ox: 0, oz: -3 },
  { naam: 'zuid', ox: 0, oz: 3 },
  { naam: 'oost', ox: 3, oz: 0 },
  { naam: 'west', ox: -3, oz: 0 },
  { naam: 'noordoost', ox: 2.2, oz: -2.2 },
  { naam: 'zuidwest', ox: -2.2, oz: 2.2 },
];
for (const r of schotRichtingen) {
  const schotRichting = await page.evaluate(new Function('args', `
    const { ox, oz } = args;
    ${opruimen()}
    const gezien = new Set();
    const leunwaarden = new Set();
    let naarSpelerToe = 0;
    d.speler.positie.set(0, 0, 0);
    for (let i = 0; i < 40; i++) {
      d.stervenden.length = 0;
      const o = d.spawnOndode(0, 'normaal');
      o.groep.position.set(ox, 0, oz);
      // Willekeurige (mogelijk 'stale') AI-kijkrichting — de fix mag hier NIET
      // van afhangen, want bij een schot wordt de kijkrichting bij sterven
      // expliciet vastgezet op "naar de speler toe".
      o.groep.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const kop = o.delen.hoofd;
      o.groep.updateMatrixWorld(true);
      const voor = new d.THREE.Vector3(); kop.getWorldPosition(voor);
      d.doodOndode(o);                       // geen doorMes => schot-pad
      const s = d.stervenden[d.stervenden.length - 1];
      gezien.add(s.stijl);
      leunwaarden.add(s.zijleun);
      for (let t = 0; t < 60; t++) d.updateStervenden(0.05);
      o.groep.updateMatrixWorld(true);
      const na = new d.THREE.Vector3(); kop.getWorldPosition(na);
      if (na.distanceTo(d.speler.positie) < voor.distanceTo(d.speler.positie) - 0.05) naarSpelerToe++;
    }
    return { gezien: [...gezien], naarSpelerToe, verschillendeLeun: leunwaarden.size };
  `), { ox: r.ox, oz: r.oz });
  check(`[${r.naam}] Een schot-kill kiest uitsluitend uit VAL_STIJLEN_SCHOT (nooit een naar-de-speler-toe-val)`,
    schotRichting.gezien.every(s => ['achterover'].includes(s)), schotRichting);
  check(`[${r.naam}] Over 40 schot-kills (willekeurige AI-kijkrichting) valt er NIET ÉÉN naar de speler toe`,
    schotRichting.naarSpelerToe === 0, schotRichting);
  check(`[${r.naam}] ...maar de val oogt wél per lijk anders, via een gelote zijwaartse leun`,
    schotRichting.verschillendeLeun >= 35, schotRichting);
}
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

// --- 7b. Speeltoets-bijstelling (na T149): de val moet VERSNELLEN (ease-IN).
// T149 had hier per ongeluk een ease-OUT staan mét een comment dat het
// tegenovergestelde beweerde: gemeten was 75% van de val al voltooid op de
// helft van de tijd, wat de speeltest meldde als "vallen soms heel snel neer".
// Rechtop staand is het zwaartekrachtmoment klein; het loopt op naarmate het
// lichaam doorslaat. 'zijwaarts' valt bovendien willekeurig links/rechts. ---
const valEasingEnRichting = await page.evaluate(new Function(`
  ${opruimen()}
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(999, 0, 999);
  d.doodOndode(o);
  const s = d.stervenden[0];
  s.stijl = 'voorover';   // forceer een voorspelbare stijl voor de exacte-formule-check
  d.updateStervenden(d.STERVEN_DUUR / 2);   // exact op de helft van de duur
  const hoekHalverwege = s.groep.rotation.x;
  const voortgangLineair = 0.5;
  const voortgangVerwacht = Math.pow(voortgangLineair, d.VAL_EASE_EXPONENT);
  const hoekVerwacht = voortgangVerwacht * (Math.PI / 2);
  const hoekLineairVerwacht = voortgangLineair * (Math.PI / 2);

  // Richting: over 60 zijwaartse MES-vallen moeten beide kanten voorkomen
  // (een schot geeft nooit 'zijwaarts' meer, zie sectie 6b).
  const kanten = new Set();
  for (let i = 0; i < 60; i++) {
    const o2 = d.spawnOndode(0, 'normaal');
    o2.groep.position.set(999, 0, 999);
    d.doodOndode(o2, null, false, true);   // doorMes = true
    const s2 = d.stervenden[d.stervenden.length - 1];
    if (s2.stijl === 'zijwaarts') kanten.add(s2.zijkant);
  }
  return { hoekHalverwege, hoekVerwacht, hoekLineairVerwacht, kanten: [...kanten] };
`));
check('De val-rotatie op de helft van STERVEN_DUUR matcht exact de ease-IN-curve (voortgang^VAL_EASE_EXPONENT)',
  Math.abs(valEasingEnRichting.hoekHalverwege - valEasingEnRichting.hoekVerwacht) < 1e-9, valEasingEnRichting);
check('De val is op de helft van de tijd nog duidelijk ACHTER op lineair (versnelt, klapt niet meteen om)',
  valEasingEnRichting.hoekHalverwege < valEasingEnRichting.hoekLineairVerwacht - 0.05, valEasingEnRichting);
check('Zijwaarts vallen komt in beide richtingen voor (links en rechts, over 60 mes-kills)',
  valEasingEnRichting.kanten.includes(1) && valEasingEnRichting.kanten.includes(-1), valEasingEnRichting);
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
