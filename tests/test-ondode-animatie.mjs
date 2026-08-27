// Losse ledematen-animatie (Ticket 20, Z3): been/arm-pivots, romp-bob en
// hoofd-microkantel bewegen nu op elk `updateOndoden`-tick, voor ALLE
// ondoden (niet alleen strompelt). Test bewaakt: (1) delen-rotaties
// veranderen tussen twee ticks met vaste dt, (2) root-positie beweegt
// alleen door de navigatie (x/z), nooit door de animatie zelf, (3)
// strompelaars bewegen zichtbaar anders dan niet-strompelaars, (4) de
// bestaande wiebel zit nu op de romp-groep i.p.v. de root, (5) geen
// regressie in perf-budget (mesh/transform-writes) of console-fouten.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Twee ticks met vaste dt: delen-rotaties veranderen ---------------
const tweeTicks = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -10);   // ver van de speler: geen melee-continue
  d.speler.positie.set(0, 0, 0);
  const voor = {
    beenL: o.delen.beenL.rotation.x, beenR: o.delen.beenR.rotation.x,
    armL: o.delen.armL.rotation.x, armR: o.delen.armR.rotation.x,
    rompY: o.delen.romp.position.y, hoofdX: o.delen.hoofd.rotation.x,
  };
  d.updateOndoden(0.1);
  const na1 = {
    beenL: o.delen.beenL.rotation.x, beenR: o.delen.beenR.rotation.x,
    armL: o.delen.armL.rotation.x, armR: o.delen.armR.rotation.x,
    rompY: o.delen.romp.position.y, hoofdX: o.delen.hoofd.rotation.x,
  };
  d.updateOndoden(0.1);
  const na2 = {
    beenL: o.delen.beenL.rotation.x, beenR: o.delen.beenR.rotation.x,
    armL: o.delen.armL.rotation.x, armR: o.delen.armR.rotation.x,
    rompY: o.delen.romp.position.y, hoofdX: o.delen.hoofd.rotation.x,
  };
  d.doodOndode(o);
  return { voor, na1, na2 };
});
check('Been-pivots roteren tussen ticks (beenL en beenR veranderen, en tegengesteld)',
  tweeTicks.na1.beenL !== tweeTicks.voor.beenL && tweeTicks.na1.beenR !== tweeTicks.voor.beenR &&
  Math.sign(tweeTicks.na1.beenL) !== Math.sign(tweeTicks.na1.beenR), tweeTicks);
check('Arm-pivots roteren mee (tegenfase t.o.v. het been aan dezelfde kant)',
  tweeTicks.na1.armL !== tweeTicks.voor.armL && tweeTicks.na1.armR !== tweeTicks.voor.armR, tweeTicks);
check('Romp-bob beweegt (position.y wijzigt t.o.v. de rust-y)',
  tweeTicks.na1.rompY !== tweeTicks.voor.rompY, tweeTicks);
check('Hoofd kantelt subtiel mee (rotation.x wijzigt, maar blijft klein)',
  tweeTicks.na1.hoofdX !== tweeTicks.voor.hoofdX && Math.abs(tweeTicks.na1.hoofdX - tweeTicks.voor.hoofdX) < 0.05, tweeTicks);
check('Tweede tick geeft weer een andere stand (doorlopende animatie, geen bevroren pose)',
  tweeTicks.na2.beenL !== tweeTicks.na1.beenL, tweeTicks);

// --- 2. Root-positie beweegt alleen door navigatie: x/z door beweging,
// NOOIT door de animatie; root.position.y blijft 0 (bob zit op de romp) ---
const rootPositie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const voorY = o.groep.position.y;
  for (let i = 0; i < 30; i++) d.updateOndoden(0.05);
  const naY = o.groep.position.y;
  const bewogen = o.groep.position.z > -10;   // moet richting de speler gelopen zijn
  d.doodOndode(o);
  return { voorY, naY, bewogen };
});
check('root.position.y blijft 0 (animatie zit uitsluitend op kinderen van de root)',
  rootPositie.voorY === 0 && rootPositie.naY === 0, rootPositie);
check('De ondode is wel degelijk richting de speler bewogen (navigatie werkt nog)',
  rootPositie.bewogen, rootPositie);

// --- 3. Strompelaars bewegen zichtbaar anders (asymmetrische beenamplitude
// + wiebel op de romp-groep, niet meer op de root) -------------------------
const strompel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const normaalTraits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const strompelTraits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: true };
  const oNormaal = d.spawnOndode(0, 'normaal', normaalTraits);
  const oStrompel = d.spawnOndode(1, 'normaal', strompelTraits);
  oNormaal.groep.position.set(0, 0, -10);
  oStrompel.groep.position.set(5, 0, -10);
  d.speler.positie.set(0, 0, 0);
  d.updateOndoden(0.1);
  const uit = {
    normaalBeenL: oNormaal.delen.beenL.rotation.x, normaalBeenR: oNormaal.delen.beenR.rotation.x,
    normaalRompZ: oNormaal.delen.romp.rotation.z,
    strompelBeenL: oStrompel.delen.beenL.rotation.x, strompelBeenR: oStrompel.delen.beenR.rotation.x,
    strompelRompZ: oStrompel.delen.romp.rotation.z,
    strompelRootZ: oStrompel.groep.rotation.z,
  };
  d.doodOndode(oNormaal); d.doodOndode(oStrompel);
  return uit;
});
check('Strompelaar heeft ongelijke beenamplitude (asymmetrisch), normaal is symmetrisch',
  Math.abs(strompel.strompelBeenL) !== Math.abs(strompel.strompelBeenR) &&
  Math.abs(Math.abs(strompel.normaalBeenL) - Math.abs(strompel.normaalBeenR)) < 1e-9, strompel);
check('Alleen de strompelaar krijgt de romp-wiebel (rotation.z != 0), normaal niet',
  strompel.strompelRompZ !== 0 && strompel.normaalRompZ === 0, strompel);
check('De wiebel zit NIET meer op de root (rotation.z blijft 0 daar)',
  strompel.strompelRootZ === 0, strompel);

// --- 4. Eenarmig-profiel: animatie crasht niet zonder armL ----------------
const eenarmig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const traits = { profiel: 'eenarmig', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: true };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  let fout = null;
  try { for (let i = 0; i < 10; i++) d.updateOndoden(0.1); } catch (e) { fout = String(e); }
  const uit = { fout, armLOntbreekt: o.delen.armL === undefined, armRDraait: o.delen.armR.rotation.x !== d.ARM_RUST_ROTATIE_X };
  d.doodOndode(o);
  return uit;
});
check('Eenarmig + strompelt: updateOndoden() crasht niet zonder armL, armR animeert gewoon door',
  eenarmig.fout === null && eenarmig.armLOntbreekt && eenarmig.armRDraait, eenarmig);

// --- 5. Perf-notitie: 14 ondoden, 20 ticks — geen crash, indicatieve tijd -
const perf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (let i = 0; i < 14; i++) {
    const o = d.spawnOndode(i % 4, 'normaal');
    o.groep.position.set((i - 7) * 1.5, 0, -10);
  }
  d.speler.positie.set(0, 0, 0);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) d.updateOndoden(0.05);
  const duur = performance.now() - t0;
  const aantal = d.ondoden.length;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  return { duur, aantal };
});
check('14 ondoden x 20 ticks updateOndoden(): geen crash, blijft ruim binnen 500ms (indicatief, headless)',
  perf.aantal === 14 && perf.duur < 500, perf);

// --- 6. Ticket 119 (Zombie V2 fase 2): pelvis-sway/chest-lag, gedreven door
// DEZELFDE ondode.loopFase-sinus als de bestaande been-/armzwaai (geen
// nieuwe klok), met een vaste faseverschuiving voor de chest. Ticket 129:
// V1 is verwijderd, elke ondode is nu een V2-ondode — geen toggle meer nodig.
const pelvisChest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const voorPelvis = o.delen.pelvis.rotation.z, voorChest = o.delen.chest.rotation.z;
  d.updateOndoden(0.1);
  const naPelvis1 = o.delen.pelvis.rotation.z, naChest1 = o.delen.chest.rotation.z;
  const loopFaseNa1 = o.loopFase;
  d.updateOndoden(0.1);
  const naPelvis2 = o.delen.pelvis.rotation.z, naChest2 = o.delen.chest.rotation.z;
  const verwachtPelvis1 = Math.sin(loopFaseNa1) * d.PELVIS_SWAY_AMPLITUDE;
  const verwachtChest1 = Math.sin(loopFaseNa1 - d.CHEST_LAG_FASE) * d.CHEST_SWAY_AMPLITUDE;
  d.doodOndode(o);
  return {
    voorPelvis, voorChest, naPelvis1, naChest1, naPelvis2, naChest2,
    verwachtPelvis1, verwachtChest1,
  };
});
check('pelvis.rotation.z beweegt tussen ticks (in fase met de loopcyclus)',
  pelvisChest.naPelvis1 !== pelvisChest.voorPelvis && pelvisChest.naPelvis2 !== pelvisChest.naPelvis1, pelvisChest);
check('chest.rotation.z beweegt tussen ticks (fase-vertraagd t.o.v. pelvis, geen nieuwe klok)',
  pelvisChest.naChest1 !== pelvisChest.voorChest && pelvisChest.naChest2 !== pelvisChest.naChest1, pelvisChest);
check('pelvis.rotation.z matcht exact sin(loopFase) * PELVIS_SWAY_AMPLITUDE',
  Math.abs(pelvisChest.naPelvis1 - pelvisChest.verwachtPelvis1) < 1e-9, pelvisChest);
check('chest.rotation.z matcht exact sin(loopFase - CHEST_LAG_FASE) * CHEST_SWAY_AMPLITUDE (dezelfde sinus, faseverschil)',
  Math.abs(pelvisChest.naChest1 - pelvisChest.verwachtChest1) < 1e-9, pelvisChest);
check('pelvis/chest op hetzelfde tijdstip verschillen (de fase-vertraging doet echt iets)',
  pelvisChest.naPelvis1 !== pelvisChest.naChest1, pelvisChest);

// --- 7. Ticket 148: loopFase gekoppeld aan WERKELIJK afgelegde afstand
// (exact het bobFase-patroon van de speler), niet meer aan tijd — het
// dicht structurele voetslip. Een vrij lopende ondode: de faseopbouw moet
// exact matchen met de gemeten positie-delta x ONDODE_PASFREQUENTIE_PER_METER
// x gang.pasFactor. --------------------------------------------------------
const afstandGekoppeld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);   // ver genoeg weg: geen melee-windup, gewoon vrij lopen
  const voorPos = { x: o.groep.position.x, z: o.groep.position.z };
  const loopFaseVoor = o.loopFase;
  d.updateOndoden(0.1);
  const naPos = { x: o.groep.position.x, z: o.groep.position.z };
  const loopFaseNa = o.loopFase;
  const afgelegd = Math.hypot(naPos.x - voorPos.x, naPos.z - voorPos.z);
  const verwachteFaseToename = afgelegd * d.ONDODE_PASFREQUENTIE_PER_METER;   // pasFactor 1 voor 'normaal'
  d.doodOndode(o);
  return { afgelegd, faseToename: loopFaseNa - loopFaseVoor, verwachteFaseToename };
});
check('Een vrij lopende ondode legt daadwerkelijk afstand af (testopzet klopt)',
  afstandGekoppeld.afgelegd > 0, afstandGekoppeld);
check('loopFase-toename matcht exact afgelegde afstand x ONDODE_PASFREQUENTIE_PER_METER (geen tijd-koppeling meer)',
  Math.abs(afstandGekoppeld.faseToename - afstandGekoppeld.verwachteFaseToename) < 1e-9, afstandGekoppeld);

// --- 8. Ticket 148: een tegen een muur geblokkeerde ondode legt ~0m af en
// beweegt zijn benen dus niet of nauwelijks — vóór deze fix liep loopFase
// gewoon door op tijd, ook ter plekke.
//
// De zuidmuur van de woonkamer (x -4.8..4.8, z 5..5.3) is een simpel, geïsoleerd
// recht muursegment (geen deuropening/hoek in de buurt bij x=0), met de speler
// ver naar het zuiden (buiten de kaart) — de ondode probeert dus recht de muur
// in te lopen. Eén "settle"-tick eerst (niet meegeteld): de ondode spawnt op
// GRENS.maxZ, dat is de coarse buitenklem-marge, niet de exacte ONDODE_STRAAL-
// afstand tot de echte muur-obstakel, dus die allereerste tick corrigeert nog
// een (grotere) startoverlap i.p.v. de bedoelde "loopt ertegenaan"-beweging te
// meten — vergelijkbaar met hoe test-vluchtroute.mjs onderdelen al op hun
// rustvlak plaatst vóórdat het eigenlijk meten begint.
//
// Bewust maar 3 gemeten ticks x dt=0.1 (0,3s) NA de settle: de BESTAANDE
// vastTijd/ontwijk-logica (verderop in updateOndoden(), los van dit ticket)
// laat een écht al 0,5s vastzittende ondode gericht zijwaarts uitwijken om
// het obstakel heen — een goede bestaande feature, maar die zou deze test na
// ~5-6 ticks laten "verplaatsen" via een zijwaartse ontwijk-burst i.p.v. via
// de voetslip-fix zelf. Ruim binnen die 0,5s-drempel blijven bewaakt precies
// wat dit ticket beweert: de klem zelf, niet de latere ontwijk-reactie. -----
const geblokkeerd = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, d.GRENS.maxZ);
  d.speler.positie.set(0, 0, d.GRENS.maxZ + 20);
  d.updateOndoden(0.1);   // settle: los van de startoverlap, niet gemeten
  const zVoor = o.groep.position.z;
  const loopFaseVoor = o.loopFase;
  const beenLVoor = o.delen.beenL.rotation.x, beenRVoor = o.delen.beenR.rotation.x;
  const aanvalStaatVoor = o.aanvalStaat;
  for (let i = 0; i < 3; i++) d.updateOndoden(0.1);
  const zNa = o.groep.position.z;
  const loopFaseNa = o.loopFase;
  const beenLNa = o.delen.beenL.rotation.x, beenRNa = o.delen.beenR.rotation.x;
  const aanvalStaatNa = o.aanvalStaat;
  d.doodOndode(o);
  return {
    zVoor, zNa, loopFaseVoor, loopFaseNa,
    beenLVoor, beenLNa, beenRVoor, beenRNa,
    aanvalStaatVoor, aanvalStaatNa,
  };
});
check('De speler staat ver genoeg weg om melee-windup uit te sluiten (testopzet klopt)',
  geblokkeerd.aanvalStaatVoor === 'jaag' && geblokkeerd.aanvalStaatNa === 'jaag', geblokkeerd);
check('De geblokkeerde ondode blijft na de settle op dezelfde z staan (losBotsingenOp klemt hem elke tick terug)',
  Math.abs(geblokkeerd.zNa - geblokkeerd.zVoor) < 1e-6, geblokkeerd);
check('...dus loopFase bouwt niet op (3 ticks ná de settle, nog steeds ~0 toename)',
  Math.abs(geblokkeerd.loopFaseNa - geblokkeerd.loopFaseVoor) < 1e-6, geblokkeerd);
check('...en de benen bewegen dus ook niet merkbaar (was vóór T148 wél het geval — tijd-gekoppeld liep altijd door)',
  Math.abs(geblokkeerd.beenLNa - geblokkeerd.beenLVoor) < 1e-6 && Math.abs(geblokkeerd.beenRNa - geblokkeerd.beenRVoor) < 1e-6,
  geblokkeerd);

// --- 9. Ticket 148: gewichtsoverdracht — pelvis/chest zijwaartse
// verschuiving, dezelfde faseL/CHEST_LAG_FASE als de bestaande rotation.z-
// sway (zie sectie 6), nu ook op position.x. --------------------------------
const gewichtsoverdracht = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const voorPelvisX = o.delen.pelvis.position.x, voorChestX = o.delen.chest.position.x;
  const beenLBaseX = o.delen.beenL.userData.baseX, beenRBaseX = o.delen.beenR.userData.baseX;
  d.updateOndoden(0.1);
  const naPelvisX1 = o.delen.pelvis.position.x, naChestX1 = o.delen.chest.position.x;
  const naBeenLX1 = o.delen.beenL.position.x, naBeenRX1 = o.delen.beenR.position.x;
  const loopFaseNa1 = o.loopFase;
  d.updateOndoden(0.1);
  const naPelvisX2 = o.delen.pelvis.position.x, naChestX2 = o.delen.chest.position.x;
  const verwachtPelvisX1 = Math.sin(loopFaseNa1) * d.PELVIS_WEIGHT_SHIFT_AMPLITUDE;
  const verwachtChestX1 = Math.sin(loopFaseNa1 - d.CHEST_LAG_FASE) * d.CHEST_WEIGHT_SHIFT_AMPLITUDE;
  d.doodOndode(o);
  return {
    voorPelvisX, voorChestX, naPelvisX1, naChestX1, naPelvisX2, naChestX2, verwachtPelvisX1, verwachtChestX1,
    beenLBaseX, beenRBaseX, naBeenLX1, naBeenRX1,
  };
});
check('pelvis.position.x beweegt tussen ticks (zijwaartse gewichtsoverdracht)',
  gewichtsoverdracht.naPelvisX1 !== gewichtsoverdracht.voorPelvisX && gewichtsoverdracht.naPelvisX2 !== gewichtsoverdracht.naPelvisX1,
  gewichtsoverdracht);
check('chest.position.x beweegt mee (fase-vertraagd t.o.v. pelvis, zelfde CHEST_LAG_FASE als de rotation.z-sway)',
  gewichtsoverdracht.naChestX1 !== gewichtsoverdracht.voorChestX && gewichtsoverdracht.naChestX2 !== gewichtsoverdracht.naChestX1,
  gewichtsoverdracht);
check('pelvis.position.x matcht exact sin(loopFase) * PELVIS_WEIGHT_SHIFT_AMPLITUDE',
  Math.abs(gewichtsoverdracht.naPelvisX1 - gewichtsoverdracht.verwachtPelvisX1) < 1e-9, gewichtsoverdracht);
check('chest.position.x matcht exact sin(loopFase - CHEST_LAG_FASE) * CHEST_WEIGHT_SHIFT_AMPLITUDE',
  Math.abs(gewichtsoverdracht.naChestX1 - gewichtsoverdracht.verwachtChestX1) < 1e-9, gewichtsoverdracht);
// Speeltest-fix: de benen volgden de pelvis-shift eerst niet mee (v2Romp-
// Gewichten() skint de beenbotten nooit), waardoor de romp-mesh zichtbaar
// van de statische voeten losschoof. beenL/beenR moeten dus EXACT dezelfde
// shift krijgen als de pelvis, bovenop hun eigen rustpositie (baseX).
check('beenL.position.x volgt EXACT dezelfde zijwaartse shift als de pelvis (geen visuele loskoppeling meer)',
  Math.abs(gewichtsoverdracht.naBeenLX1 - (gewichtsoverdracht.beenLBaseX + gewichtsoverdracht.naPelvisX1)) < 1e-9,
  gewichtsoverdracht);
check('beenR.position.x volgt EXACT dezelfde zijwaartse shift als de pelvis',
  Math.abs(gewichtsoverdracht.naBeenRX1 - (gewichtsoverdracht.beenRBaseX + gewichtsoverdracht.naPelvisX1)) < 1e-9,
  gewichtsoverdracht);
check('beenL en beenR blijven op hun eigen, verschillende rustpositie (geen samenval)',
  gewichtsoverdracht.beenLBaseX !== gewichtsoverdracht.beenRBaseX, gewichtsoverdracht);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
