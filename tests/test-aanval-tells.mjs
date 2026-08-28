// Aanval A2 (Ticket 31): zichtbare en hoorbare tells bovenop T30's
// aanvals-state-machine. Bewaakt: armen lerpen naar de windup-houding en
// bereiken die op het slag-moment, de ogen pulsen tijdens de wind-up en
// keren gegarandeerd terug naar de basiswaarde na herstel, het hoofd
// kantelt licht achterover, een eenarmige ondode crasht niet, en de drie
// nieuwe audiofuncties worden daadwerkelijk aangeroepen (via debug-tellers).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Armpose lerpt tijdens de wind-up en bereikt de doelhoek op het
// slag-moment ---------------------------------------------------------------
const armPose = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const armVoorWindup = o.delen.armL.rotation.x;
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  // Halverwege de wind-up.
  const stappenTotHalverwege = Math.round((windupDuur / 2) / dt);
  for (let i = 0; i < stappenTotHalverwege; i++) d.updateOndoden(dt);
  const armHalverwege = o.delen.armL.rotation.x;
  // Vlak vóór het slag-moment (net niet over de rand).
  const overigeStappen = Math.floor((windupDuur / 2 - dt) / dt);
  for (let i = 0; i < overigeStappen; i++) d.updateOndoden(dt);
  const armVlakVoorSlag = o.delen.armL.rotation.x;
  // Nog één stap: dit IS het slag-moment.
  d.updateOndoden(dt);
  const armOpSlagmoment = o.delen.armL.rotation.x;
  const armROpSlagmoment = o.delen.armR.rotation.x;
  d.doodOndode(o);
  return {
    armVoorWindup, armHalverwege, armVlakVoorSlag, armOpSlagmoment, armROpSlagmoment,
    rustHoek: d.ARM_RUST_ROTATIE_X, doelHoek: d.AANVAL_ARM_HOEK_WINDUP,
  };
});
check('Vóór de wind-up staat de arm nog rond de rust-/loop-zwaai-hoek (niet al bij de aanvalshoek)',
  armPose.armVoorWindup > armPose.doelHoek + 0.3, armPose);
check('Halverwege de wind-up is de arm merkbaar verder richting de aanvalshoek bewogen dan aan het begin',
  armPose.armHalverwege < armPose.armVoorWindup - 0.3, armPose);
check('Vlak vóór het slag-moment is de arm dichter bij de aanvalshoek dan halverwege',
  armPose.armVlakVoorSlag < armPose.armHalverwege, armPose);
check('Op het slag-moment bereikt de linkerarm de aanvalshoek (-1.9 ± 0.1 rad, acceptatiecriterium)',
  Math.abs(armPose.armOpSlagmoment - armPose.doelHoek) <= 0.1, armPose);
check('Op het slag-moment bereikt ook de rechterarm de aanvalshoek',
  Math.abs(armPose.armROpSlagmoment - armPose.doelHoek) <= 0.1, armPose);

// --- 2. Oog-intensiteit: basis vóór, >2.0 halverwege de wind-up, exact terug
// op de basiswaarde na herstel ----------------------------------------------
const oogIntensiteit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const oogVoor = o.delen.oogMateriaal.emissiveIntensity;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  for (let i = 0; i < Math.round((windupDuur / 2) / dt); i++) d.updateOndoden(dt);
  const oogHalverwege = o.delen.oogMateriaal.emissiveIntensity;
  // Doortikken tot en met het slag-moment (windup -> herstel), en dan
  // precies tot en met de EERSTE tick waarop herstel -> jaag omslaat — vóór
  // een eventuele volgende aanval opnieuw kan starten (de ondode blijft
  // binnen bereik, dus die chaint anders meteen door naar een nieuwe wind-up).
  let stappenHerstel = 0;
  while (o.aanvalStaat !== 'herstel' && stappenHerstel < 100) { d.updateOndoden(dt); stappenHerstel++; }
  let stappenTerugNaarJaag = 0;
  while (o.aanvalStaat === 'herstel' && stappenTerugNaarJaag < 100) { d.updateOndoden(dt); stappenTerugNaarJaag++; }
  const oogNaHerstel = o.delen.oogMateriaal.emissiveIntensity;
  const staatNaHerstel = o.aanvalStaat;
  d.doodOndode(o);
  return { oogVoor, oogHalverwege, oogNaHerstel, staatNaHerstel, basis: d.OOG_INTENSITEIT_BASIS, piek: d.OOG_INTENSITEIT_AANVAL };
});
check('Vóór de wind-up staat de oogintensiteit op de basiswaarde (1.4)',
  Math.abs(oogIntensiteit.oogVoor - oogIntensiteit.basis) < 0.01, oogIntensiteit);
check('Halverwege de wind-up is de oogintensiteit > 2.0 (acceptatiecriterium)',
  oogIntensiteit.oogHalverwege > 2.0, oogIntensiteit);
check('Na afloop van herstel is de ondode weer terug in "jaag" en de oogintensiteit EXACT terug op de basiswaarde',
  oogIntensiteit.staatNaHerstel === 'jaag' && oogIntensiteit.oogNaHerstel === oogIntensiteit.basis, oogIntensiteit);

// --- 3. Hoofd kantelt licht achterover tijdens de wind-up ------------------
const hoofdKantel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const baseRotX = o.delen.hoofd.userData.baseRotX;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  for (let i = 0; i < Math.round((windupDuur * 0.9) / dt); i++) d.updateOndoden(dt);
  const hoofdRotXTegenEinde = o.delen.hoofd.rotation.x;
  d.doodOndode(o);
  return { baseRotX, hoofdRotXTegenEinde };
});
check('Tegen het einde van de wind-up wijkt het hoofd merkbaar af van de rust-rotatie (achterover kantelen)',
  Math.abs(hoofdKantel.hoofdRotXTegenEinde - hoofdKantel.baseRotX) > 0.05, hoofdKantel);

// --- 4. Eenarmig profiel: geen crash, alleen de rechterarm krijgt een write -
const eenarmig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const traits = { profiel: 'eenarmig', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const armLOntbreekt = o.delen.armL === undefined;
  const dt = 1 / 60;
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  const herstelDuur = d.AANVAL_PROFIELEN.normaal.herstel;
  const totaalStappen = Math.ceil((windupDuur + herstelDuur) / dt) + 5;
  let fout = null;
  try {
    for (let i = 0; i < totaalStappen; i++) d.updateOndoden(dt);
  } catch (e) {
    fout = e.message;
  }
  const armRGeschreven = o.delen.armR.rotation.x !== d.ARM_RUST_ROTATIE_X;
  d.doodOndode(o);
  return { armLOntbreekt, fout, armRGeschreven };
});
check('Eenarmig-profiel: delen.armL ontbreekt zoals verwacht',
  eenarmig.armLOntbreekt, eenarmig);
check('Eenarmig-profiel: de wind-up/herstel-tell crasht niet (geen console-/JS-fout)',
  eenarmig.fout === null, eenarmig);
check('Eenarmig-profiel: de aanwezige rechterarm krijgt wel gewoon de tell-pose',
  eenarmig.armRGeschreven, eenarmig);

// --- 5. Audio: windup-start speelt een grom, raak/mis spelen verschillende
// geluiden (via debug-tellers) ----------------------------------------------
const audioRaak = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'sjouwer');   // apart register (laag/lang) — ook zelf te controleren
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const gromVoor = d.aanvalGromTeller, raakVoor = d.slagRaakTeller, misVoor = d.slagMisTeller;
  const dt = 1 / 60;
  const windupDuur = d.AANVAL_PROFIELEN.sjouwer.windup;
  const totaalStappen = Math.ceil(windupDuur / dt) + 3;
  for (let i = 0; i < totaalStappen; i++) d.updateOndoden(dt);
  const uit = { gromNa: d.aanvalGromTeller - gromVoor, raakNa: d.slagRaakTeller - raakVoor, misNa: d.slagMisTeller - misVoor };
  d.doodOndode(o);
  return uit;
});
check('Windup-start roept speelAanvalGrom() precies één keer aan',
  audioRaak.gromNa === 1, audioRaak);
check('Een geraakte aanval roept speelSlagRaak() aan en NIET speelSlagMis()',
  audioRaak.raakNa === 1 && audioRaak.misNa === 0, audioRaak);

const audioMis = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const dt = 1 / 60;
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  for (let i = 0; i < Math.floor((windupDuur - dt) / dt); i++) d.updateOndoden(dt);
  d.speler.positie.set(50, 0, 50);   // vlak vóór het slag-moment: ver weg, dus mis
  const raakVoor = d.slagRaakTeller, misVoor = d.slagMisTeller;
  for (let i = 0; i < 5; i++) d.updateOndoden(dt);
  const uit = { raakNa: d.slagRaakTeller - raakVoor, misNa: d.slagMisTeller - misVoor };
  d.doodOndode(o);
  return uit;
});
check('Een ontweken aanval roept speelSlagMis() aan en NIET speelSlagRaak()',
  audioMis.misNa === 1 && audioMis.raakNa === 0, audioMis);

// --- 6. Ticket 149: windup-anticipatie — de arm-heffing volgt een ease-in-
// curve (windupFractie ^ AANVAL_ANTICIPATIE_EXPONENT) i.p.v. de lineaire
// windupFractie zelf. Hoofd/oog blijven bewust lineair (zie de code-
// toelichting) — sectie 2/3 hierboven bewaken die AL, dit toetst specifiek
// dat de arm-curve daadwerkelijk wordt toegepast en exact matcht. -----------
const anticipatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  // Vaste standaard-traits: kiesOndodeTraits() kan 'eenarmig' opleveren, en
  // dan bestaat delen.armL niet — deze sectie meet juist die arm.
  const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  for (let i = 0; i < Math.round((windupDuur / 2) / dt); i++) d.updateOndoden(dt);
  const armHalverwege = o.delen.armL.rotation.x;
  const windupFractie = Math.min(1, 1 - Math.max(0, o.aanvalTimer) / windupDuur);
  const windupArmFractieVerwacht = Math.pow(windupFractie, d.AANVAL_ANTICIPATIE_EXPONENT);
  const armVerwacht = d.ARM_RUST_ROTATIE_X + (d.AANVAL_ARM_HOEK_WINDUP - d.ARM_RUST_ROTATIE_X) * windupArmFractieVerwacht;
  const armLineairVerwacht = d.ARM_RUST_ROTATIE_X + (d.AANVAL_ARM_HOEK_WINDUP - d.ARM_RUST_ROTATIE_X) * windupFractie;
  d.doodOndode(o);
  return { armHalverwege, armVerwacht, armLineairVerwacht, windupFractie };
});
check('De arm-heffing matcht exact de ease-in-curve (windupFractie ^ AANVAL_ANTICIPATIE_EXPONENT)',
  Math.abs(anticipatie.armHalverwege - anticipatie.armVerwacht) < 1e-9, anticipatie);
check('...en wijkt merkbaar af van de oude lineaire formule (bewijst dat de curve echt iets doet)',
  Math.abs(anticipatie.armHalverwege - anticipatie.armLineairVerwacht) > 0.05, anticipatie);

// --- 7. Ticket 149: impact-overshoot in herstel — de arm zwaait net voorbij
// de rusthoek (follow-through) vóórdat hij settelt, via easeOutBack(). ------
const overshoot = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  // Zelfde reden als hierboven: deze sectie leest delen.armL uit.
  const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', traits);
  o.groep.position.set(0, 0, -10);   // ver weg: geen nieuwe windup tijdens deze meting
  const herstelDuur = d.AANVAL_PROFIELEN.normaal.herstel;
  o.aanvalStaat = 'herstel';
  o.aanvalTimer = herstelDuur * 0.7;   // geeft herstelFractie rond het overshoot-piekpunt
  d.updateOndoden(0.001);
  const armNa = o.delen.armL.rotation.x;
  const herstelFractieNa = Math.min(1, (herstelDuur - o.aanvalTimer) / (herstelDuur / 2));
  const armVerwacht = d.AANVAL_ARM_HOEK_WINDUP + (d.ARM_RUST_ROTATIE_X - d.AANVAL_ARM_HOEK_WINDUP) * d.easeOutBack(herstelFractieNa);
  const eindpunten = { bij0: d.easeOutBack(0), bij1: d.easeOutBack(1) };
  d.doodOndode(o);
  return { armNa, armVerwacht, herstelFractieNa, rustHoek: d.ARM_RUST_ROTATIE_X, eindpunten };
});
check('De arm-terugzwaai matcht exact easeOutBack(herstelFractie)',
  Math.abs(overshoot.armNa - overshoot.armVerwacht) < 1e-9, overshoot);
check('...en overschiet daadwerkelijk voorbij de rusthoek (follow-through, > ARM_RUST_ROTATIE_X)',
  overshoot.armNa > overshoot.rustHoek, overshoot);
check('easeOutBack(0) = 0 en easeOutBack(1) = 1 (op drijvende-komma-precisie na — geen sprong bij het slag-moment of de handoff naar de loop-zwaai)',
  Math.abs(overshoot.eindpunten.bij0) < 1e-9 && Math.abs(overshoot.eindpunten.bij1 - 1) < 1e-9, overshoot);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
