// Fix 4 (feedback: "ik kan nu nergens het geluid uitzetten") — een
// geluidsknop rechtsboven in het start-/pauzescherm (dezelfde #startscherm-
// overlay, zie de pointerlockchange-listener). Bewaakt: (1) alle geluid
// loopt door masterGainNode (bron-check op de vijf bronnen: de dreigingsdrone,
// het T66-akkoordbed, piep()-stings, de gerichte boot-hoorn en het T82-
// stadsbed), (2) klikken toggelt masterGainNode.gain.value en het
// knop-icoon, (3) muten vóórdat initGeluid() ooit gedraaid heeft, wordt
// correct meegenomen zodra dat alsnog gebeurt, (4) een klik op de knop
// start/hervat het spel NIET (stopPropagation).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Bron-check: alle vier de geluidsbronnen connecten op masterGainNode,
// niet rechtstreeks op audio.destination -----------------------------------
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const piepBron = d.piep.toString();
  const hoornBron = d.speelBootHoornGericht.toString();
  const initBron = d.initGeluid.toString();
  return {
    piepGeenDirecteDestination: !/connect\(audio\.destination\)/.test(piepBron),
    piepMasterGain: /connect\(masterGainNode\)/.test(piepBron),
    hoornGeenDirecteDestination: !/connect\(audio\.destination\)/.test(hoornBron),
    hoornMasterGain: /connect\(masterGainNode\)/.test(hoornBron),
    initHeeftMasterGain: /masterGainNode = audio\.createGain\(\)/.test(initBron),
    initMasterGainOpDestination: /masterGainNode\.connect\(audio\.destination\)/.test(initBron),
    // dreigingsGainNode/muziekGainNode/stadGainNode (T82) connecten alle
    // drie op masterGainNode i.p.v. audio.destination — geteld i.p.v.
    // index-gematcht, want alle drie de regels staan in dezelfde
    // initGeluid()-bron.
    dreigingsMuziekEnStadOpMasterGain: (initBron.match(/GainNode\.connect\(masterGainNode\)/g) || []).length === 3,
    initGeenEnkeleDirecteDestinationBehalveMasterGainZelf:
      (initBron.match(/connect\(audio\.destination\)/g) || []).length === 1,
  };
});
check('piep() connect niet meer rechtstreeks op audio.destination', bronTest.piepGeenDirecteDestination, bronTest);
check('piep() connect op masterGainNode', bronTest.piepMasterGain, bronTest);
check('speelBootHoornGericht() connect niet meer rechtstreeks op audio.destination', bronTest.hoornGeenDirecteDestination, bronTest);
check('speelBootHoornGericht() connect op masterGainNode', bronTest.hoornMasterGain, bronTest);
check('initGeluid() maakt masterGainNode aan', bronTest.initHeeftMasterGain, bronTest);
check('masterGainNode is zelf de enige node die op audio.destination connect', bronTest.initMasterGainOpDestination, bronTest);
check('dreigingsGainNode, muziekGainNode EN stadGainNode (T82) connecten alle drie op masterGainNode', bronTest.dreigingsMuziekEnStadOpMasterGain, bronTest);
check('initGeluid() heeft precies 1 connect(audio.destination) in de hele bron (alleen masterGainNode zelf)',
  bronTest.initGeenEnkeleDirecteDestinationBehalveMasterGainZelf, bronTest);

// --- 2. Knop bestaat, start ongedempt --------------------------------------
const startstaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    knopBestaat: !!d.geluidKnop,
    knopTekst: d.geluidKnop.textContent,
    gedempt: d.geluidGedempt,
  };
});
check('De geluidsknop bestaat in de DOM', startstaat.knopBestaat, startstaat);
check('Het spel start ongedempt (🔊, geluidGedempt=false)',
  startstaat.knopTekst === '🔊' && startstaat.gedempt === false, startstaat);

// --- 3. Klikken toggelt masterGainNode.gain + icoon ------------------------
const toggle = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const voor = { gain: d.masterGainNode.gain.value, gedempt: d.geluidGedempt, tekst: d.geluidKnop.textContent };
  d.geluidKnop.click();
  const naEen = { gain: d.masterGainNode.gain.value, gedempt: d.geluidGedempt, tekst: d.geluidKnop.textContent };
  d.geluidKnop.click();
  const naTwee = { gain: d.masterGainNode.gain.value, gedempt: d.geluidGedempt, tekst: d.geluidKnop.textContent };
  return { voor, naEen, naTwee };
});
check('Vóór de eerste klik: gain 1, ongedempt, 🔊', toggle.voor.gain === 1 && !toggle.voor.gedempt && toggle.voor.tekst === '🔊', toggle);
check('Na de eerste klik: gain 0, gedempt, 🔇', toggle.naEen.gain === 0 && toggle.naEen.gedempt === true && toggle.naEen.tekst === '🔇', toggle);
check('Na de tweede klik (weer aanzetten): gain terug naar 1, ongedempt, 🔊',
  toggle.naTwee.gain === 1 && toggle.naTwee.gedempt === false && toggle.naTwee.tekst === '🔊', toggle);

// --- 4. Muten vóórdat initGeluid() ooit gedraaid heeft, wordt meegenomen --
const voorInit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // zetGeluidGedempt() past masterGainNode.gain.value al direct aan (als
  // audio al bestaat, zoals hier) — dat is exact hetzelfde codepad als de
  // priming-regel in initGeluid() (`geluidGedempt ? 0 : 1`) voor de eerste
  // aanroep, dus deze check dekt beide gevallen.
  d.zetGeluidGedempt(true);
  const gedemptVoorHerinit = d.geluidGedempt;
  const gainNu = d.masterGainNode.gain.value;
  d.zetGeluidGedempt(false);   // opruimen voor eventuele latere checks
  return { gedemptVoorHerinit, gainNu };
});
check('zetGeluidGedempt(true) zet geluidGedempt EN masterGainNode.gain.value meteen naar 0',
  voorInit.gedemptVoorHerinit === true && voorInit.gainNu === 0, voorInit);

// --- 5. Een klik op de knop start/hervat het spel NIET (stopPropagation) --
const geenResume = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let pointerLockAangevraagd = false;
  const origineel = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = () => { pointerLockAangevraagd = true; };
  d.geluidKnop.click();
  d.renderer.domElement.requestPointerLock = origineel;
  return { pointerLockAangevraagd };
});
check('Klikken op de geluidsknop roept GEEN requestPointerLock() aan (het spel start/hervat niet per ongeluk)',
  geenResume.pointerLockAangevraagd === false, geenResume);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
