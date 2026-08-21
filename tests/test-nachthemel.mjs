// Ticket 111 (v0.22, §10.13-beslissing 88): nachthemel — een grote,
// camera-volgende SphereGeometry (side:BackSide, depthWrite:false, fog:false)
// met een eigen ShaderMaterial: verticale gradient, hash-ruis sterrenveld,
// fbm-wolkenlaag. Eerste van de drie Fase 7-tickets ("De wereld buiten").
import { openAmsterdamUndead, openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Structuur: precies één dome, een grote BackSide-bol, geen
// depth-write, geen fog (§10.13: "de dome IS de achtergrond").
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    isMesh: d.nachthemel.isMesh,
    geometryType: d.nachthemel.geometry.type,
    straal: d.nachthemel.geometry.parameters.radius,
    verwachtStraal: d.NACHTHEMEL_STRAAL,
    side: d.nachthemelMateriaal.side,
    depthWrite: d.nachthemelMateriaal.depthWrite,
    fog: d.nachthemelMateriaal.fog,
    isShaderMaterial: d.nachthemelMateriaal.isShaderMaterial,
    transparent: d.nachthemelMateriaal.transparent,
  };
});
check('nachthemel is een Mesh met SphereGeometry', structuur.isMesh && structuur.geometryType === 'SphereGeometry', structuur);
check('De straal is NACHTHEMEL_STRAAL en blijft ruim onder camera.far (50m)', structuur.straal === structuur.verwachtStraal && structuur.straal < 50, structuur);
check('Het materiaal is een eigen ShaderMaterial (geen kant-en-klaar materiaaltype)', structuur.isShaderMaterial, structuur);
// THREE.BackSide === 1 — geen import van three nodig in dit testbestand,
// dezelfde conventie als test-lichtkegels.mjs' additive-blending-check (2).
check('side: BackSide (de camera zit BINNEN de bol)', structuur.side === 1, structuur);
check('depthWrite: false (kan nooit iets vóór echte geometrie tekenen)', structuur.depthWrite === false, structuur);
check('fog: false (de dome is zelf de achtergrond, mag niet naar scene.background vervagen)', structuur.fog === false, structuur);
check('niet transparent (ondoorzichtige achtergrond, geen blend-kosten)', !structuur.transparent, structuur);

// --- 2. De dome staat in `wereld` (niet los aan `scene` gehangen) en is
// het enige object met deze geometrie/materiaal-combinatie.
const inWereld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let gevonden = 0;
  d.wereld.traverse((k) => { if (k === d.nachthemel) gevonden++; });
  return gevonden;
});
check('De dome hangt precies één keer in `wereld`', inWereld === 1, inWereld);

// --- 3. Camera-volgend: updateNachthemel() zet de dome-positie gelijk aan
// de cameragpositie, ongeacht waar de speler staat (anders wordt de
// parallax op een straal van "maar" 46m zichtbaar tijdens het lopen).
const volgTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(12.3, 0, -7.6);
  d.updateSpeler(0);
  d.updateNachthemel(0);
  const na = { x: d.nachthemel.position.x, y: d.nachthemel.position.y, z: d.nachthemel.position.z };
  const cam = { x: d.camera.position.x, y: d.camera.position.y, z: d.camera.position.z };
  return { na, cam };
});
check('updateNachthemel() zet de dome-positie exact gelijk aan camera.position',
  Math.abs(volgTest.na.x - volgTest.cam.x) < 1e-9 &&
  Math.abs(volgTest.na.y - volgTest.cam.y) < 1e-9 &&
  Math.abs(volgTest.na.z - volgTest.cam.z) < 1e-9, volgTest);

// --- 4. Het tijd-uniform is deterministisch `klok`-gedreven: bevriest
// automatisch tijdens visuele metingen (T88), geen apart bevries-mechanisme
// nodig — hetzelfde patroon als de bootpositie/lantaarnpuls.
const tijdTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateNachthemel(42.5);
  return d.nachthemelMateriaal.uniforms.tijd.value;
});
check('updateNachthemel(t) zet het tijd-uniform op de doorgegeven waarde (klok-gedreven, geen eigen klok)',
  tijdTest === 42.5, tijdTest);

// --- 5. Determinisme onder visuele meting: `openVoorVisueleMeting()` houdt
// spelActief permanent false, dus `klok` loopt nooit op en de dome-shader
// blijft bit-voor-bit identiek tussen twee metingen op hetzelfde standpunt.
const { browser: vBrowser, page: vPage, errs: vErrs } = await openVoorVisueleMeting();
const punten = await berekenVisueleStandpunten(vPage);
const binnenplaats = punten.find(p => p.naam === 'binnenplaats');
await zetVisueelStandpunt(vPage, binnenplaats);
const meting1 = await vPage.screenshot({ type: 'png' });
await zetVisueelStandpunt(vPage, binnenplaats);
const meting2 = await vPage.screenshot({ type: 'png' });
check('Twee opeenvolgende metingen op hetzelfde standpunt geven exact dezelfde screenshot-bytes (dome-shader is deterministisch bevroren)',
  Buffer.compare(meting1, meting2) === 0, { gelijk: Buffer.compare(meting1, meting2) === 0 });
await vBrowser.close();

// --- 6. Geen nieuw lichttype en geen extra obstakel/interactiepunt: de
// dome is puur decoratief, breekt geen van de ronde-brede invarianten
// (§10.2).
const invariantenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0;
  d.scene.traverse((k) => { if (k.isLight) lichten++; });
  return { lichten, obstakels: d.obstakels.length, interactiePunten: d.interactiePunten.length };
});
check('Lichttelling blijft op 28 (de dome is geen licht)', invariantenTest.lichten === 28, invariantenTest);
check('obstakels.length blijft 58 (T131-baseline; de dome heeft geen collision)', invariantenTest.obstakels === 58, invariantenTest);
check('interactiePunten.length blijft 13', invariantenTest.interactiePunten === 13, invariantenTest);

// --- 7. Zes echte frames draaien zonder pageerror (dezelfde proactieve
// shader/fog-crash-check als na de T110-postmortem — zie ARCHITECTURE_NOTES
// §10.13, "elke nieuwe ShaderMaterial krijgt een pageerror-sweep").
await frames(page, 6);
const foutenNaFrames = errs.length;
check('Zes echte frames met de dome actief geven geen enkele pageerror', foutenNaFrames === 0, { fouten: errs.slice() });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
