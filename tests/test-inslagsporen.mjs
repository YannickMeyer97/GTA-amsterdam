// Ticket 157 (v0.26, ronde 12): blijvende inslagsporen. Bewaakt de
// pool-architectuur (geen groei, round-robin wrap), de oriëntatiewiskunde op
// een willekeurig vlak (niet alleen axis-aligned — de kaart zelf heeft geen
// enkel echt schuin vlak: de trap bestaat uit gestapelde rechte blokjes
// "onder een oplopende lijn i.p.v. een schuin vlak", zie de toelichting bij
// VLIERINGTRAP hierboven in de bron — dus dit test bewust een SYNTHETISCH
// schuin vlak, wat de oriëntatielogica grondiger dekt dan aan één stuk decor
// gebonden te zijn), de aliasing-regel op de doorgegeven normaal, en de
// kwaliteitspreset-gate uit T159.
import { openAmsterdamUndead, openVoorVisueleMeting, makeChecker } from './helpers.mjs';
import { PNG } from 'pngjs';
import { writeFileSync } from 'fs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Basisarchitectuur: gedeelde geometrie/textuur, vaste poolgrootte -
const architectuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geometrieen = new Set(), texturen = new Set(), materialen = new Set();
  for (const mesh of d.inslagsporenPool) {
    geometrieen.add(mesh.geometry);
    materialen.add(mesh.material);
    if (mesh.material.map) texturen.add(mesh.material.map);
  }
  return {
    poolGrootte: d.inslagsporenPool.length,
    inslagspoorMax: d.INSLAGSPOOR_MAX,
    uniekeGeometrieen: geometrieen.size,
    uniekeTexturen: texturen.size,
    uniekeMaterialen: materialen.size,
    allemaalOnzichtbaarBijStart: d.inslagsporenPool.every(m => !m.visible),
  };
});
check('De pool heeft exact INSLAGSPOOR_MAX sloten', architectuur.poolGrootte === architectuur.inslagspoorMax, architectuur);
check('Alle sloten delen DEZELFDE geometrie (1 unieke instantie voor de hele pool)',
  architectuur.uniekeGeometrieen === 1, architectuur);
check('Alle sloten delen DEZELFDE textuur (1 unieke instantie voor de hele pool)',
  architectuur.uniekeTexturen === 1, architectuur);
// Elk slot heeft een EIGEN material-instantie (nodig voor een onafhankelijke
// kleur/opacity per spoor) — dat is bewust GEEN gedeeld materiaal, in
// tegenstelling tot de geometrie/textuur hierboven.
check('Elk slot heeft een eigen material-instantie (nodig voor onafhankelijke kleur per spoor)',
  architectuur.uniekeMaterialen === architectuur.poolGrootte, architectuur);
check('Alle sloten staan bij het laden nog onzichtbaar (geen sporen vóór de eerste speler-actie)',
  architectuur.allemaalOnzichtbaarBijStart, architectuur);

// --- 2. Round-robin pool-wrap: het 41e spoor hergebruikt slot 0 ----------
const wrapTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const max = d.INSLAGSPOOR_MAX;
  const posities = [];
  // (max + 1) sporen op OPKLIMMENDE, onderscheidbare X-posities, zodat elk
  // spoor een eigen, herkenbare positie krijgt.
  for (let i = 0; i < max + 1; i++) {
    d.spawnInslagspoor(new THREE.Vector3(i * 0.01, 1, 0), new THREE.Vector3(0, 0, 1), 0x111111, 0.05);
    posities.push(d.inslagsporenPool[i % max].position.x);
  }
  const slot0PositieNaWrap = d.inslagsporenPool[0].position.x;
  return { max, eersteSlot0Positie: posities[0], slot0PositieNaWrap, volgendeIndexNaAfloop: d.inslagspoorVolgende };
});
check('Slot 0 droeg aanvankelijk het EERSTE spoor (positie 0)', wrapTest.eersteSlot0Positie === 0, wrapTest);
check(`Na ${wrapTest.max + 1} spoorplaatsingen is slot 0 overschreven door het (${wrapTest.max + 1})e spoor (positie ${wrapTest.max * 0.01}, niet meer 0)`,
  Math.abs(wrapTest.slot0PositieNaWrap - wrapTest.max * 0.01) < 1e-9, wrapTest);
check('De round-robin index staat na de wrap weer op 1 (net na slot 0)', wrapTest.volgendeIndexNaAfloop === 1, wrapTest);

// --- 3. Oriëntatiewiskunde: het decal-vlak staat loodrecht op ELKE
// meegegeven normaal, ook een willekeurig schuin vlak (niet alleen de
// axis-aligned muur/vloer/plafond-gevallen) --------------------------------
const orientatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const gevallen = [
    { naam: 'vloer (recht omhoog)', normaal: new THREE.Vector3(0, 1, 0) },
    { naam: 'muur (recht naar het zuiden)', normaal: new THREE.Vector3(0, 0, 1) },
    { naam: 'muur (recht naar het westen)', normaal: new THREE.Vector3(-1, 0, 0) },
    // Synthetisch schuin vlak: 40° gekanteld t.o.v. verticaal, niet op een
    // hoofdas — precies het "dak/trap"-scenario dat de kaart zelf niet
    // biedt (zie de toelichting bovenaan dit bestand).
    { naam: 'synthetisch schuin dakvlak (40°)', normaal: new THREE.Vector3(Math.sin(40 * Math.PI / 180), Math.cos(40 * Math.PI / 180), 0.15).normalize() },
    { naam: 'willekeurige schuine hoek', normaal: new THREE.Vector3(0.4, 0.6, -0.693).normalize() },
  ];
  const uitkomsten = gevallen.map(({ naam, normaal }) => {
    const voorIndex = d.inslagspoorVolgende;
    d.spawnInslagspoor(new THREE.Vector3(0, 1, 0), normaal, 0x222222, 0.2);
    const mesh = d.inslagsporenPool[voorIndex];
    // Het vlak se EIGEN +Z-as (na de quaternion-rotatie) moet exact
    // samenvallen met de meegegeven normaal — dat IS "plat op het vlak
    // liggen": de decal-plane wijst dezelfde kant op als het geraakte
    // oppervlak.
    const eigenZAs = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    return { naam, afwijking: eigenZAs.angleTo(normaal) };
  });
  return uitkomsten;
});
for (const { naam, afwijking } of orientatie) {
  check(`Decal-oriëntatie op "${naam}": het vlak wijst exact dezelfde kant op als de normaal (hoekafwijking ${(afwijking * 180 / Math.PI).toFixed(4)}° < 0.01°)`,
    afwijking < 0.0002, { naam, afwijkingGraden: afwijking * 180 / Math.PI });
}

// --- 4. Aliasing: de doorgegeven normaal-vector mag NA de aanroep vrij
// hergebruikt worden door de aanroeper zonder het geplaatste spoor alsnog
// te veranderen (§7.9 — exact het patroon van _tmpVecNormaal in schiet()) -
const aliasingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const scratch = new THREE.Vector3(0, 1, 0);   // simuleert _tmpVecNormaal
  const voorIndex = d.inslagspoorVolgende;
  d.spawnInslagspoor(new THREE.Vector3(2, 1, 2), scratch, 0x333333, 0.2);
  const mesh = d.inslagsporenPool[voorIndex];
  const quaternionDirectNa = mesh.quaternion.clone();
  scratch.set(1, 0, 0);   // de aanroeper hergebruikt de scratch-vector, zoals schiet() dat met _tmpVecNormaal doet
  const quaternionNaHergebruik = mesh.quaternion.clone();
  return {
    ongewijzigd: quaternionDirectNa.equals(quaternionNaHergebruik),
  };
});
check('Het geplaatste spoor verandert NIET als de aanroeper de doorgegeven normaal-vector achteraf hergebruikt (geen aliasing)',
  aliasingTest.ongewijzigd, aliasingTest);

// --- 5. Kwaliteitspreset-gate (T159): geen spawns op 'laag' ---------------
const presetGate = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const uitkomsten = {};
  for (const preset of ['laag', 'normaal', 'hoog']) {
    d.pasKwaliteitToe(preset);
    const voorIndex = d.inslagspoorVolgende;
    d.spawnInslagspoor(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), 0x444444, 0.1);
    uitkomsten[preset] = d.inslagspoorVolgende !== voorIndex;
  }
  d.pasKwaliteitToe('normaal');   // opruimen: terug naar de standaard voor eventuele volgende checks
  return uitkomsten;
});
check("Op 'laag' spawnt er GEEN inslagspoor (fill-rate-gate uit T159)", presetGate.laag === false, presetGate);
check("Op 'normaal' spawnt een inslagspoor gewoon", presetGate.normaal === true, presetGate);
check("Op 'hoog' spawnt een inslagspoor gewoon", presetGate.hoog === true, presetGate);

// --- 6. Geen collision, geen extra meshes in de scene-graaf ---------------
const neveneffecten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  const obstakelsVoor = d.obstakels.length;
  let meshVoor = 0;
  d.scene.traverse(o => { if (o.isMesh) meshVoor++; });
  for (let i = 0; i < 60; i++) {
    d.spawnInslagspoor(new THREE.Vector3(Math.random(), 1, Math.random()), new THREE.Vector3(0, 1, 0), 0x555555, 0.1);
  }
  let meshNa = 0;
  d.scene.traverse(o => { if (o.isMesh) meshNa++; });
  return { obstakelsVoor, obstakelsNa: d.obstakels.length, meshVoor, meshNa };
});
check('obstakels.length blijft 58 — decals hebben nooit collision',
  neveneffecten.obstakelsVoor === 58 && neveneffecten.obstakelsNa === 58, neveneffecten);
check('60 extra spoorplaatsingen (ruim boven de poolgrootte) voegen NUL nieuwe meshes toe aan de scene',
  neveneffecten.meshNa === neveneffecten.meshVoor, neveneffecten);
await browser.close();

// --- 7. Visuele controle: een decal op het synthetische schuine vlak ligt
// daadwerkelijk plat tegen dat vlak aan, zonder z-fighting. Dit is een
// SCREENSHOT-check (het ticket zelf: "Sonnet solo: ja, met de kanttekening
// dat de z-fighting-controle een visuele beoordeling vraagt") — de
// assertie hieronder controleert een meetbaar PROXY-signaal (geen
// flikkerende/rafelige rand-pixels tussen twee opeenvolgende renders op
// exact dezelfde cameravraag), de opgeslagen PNG is voor de handmatige
// beoordeling. -------------------------------------------------------------
const { browser: browser2, page: page2 } = await openVoorVisueleMeting();
await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const THREE = d.THREE;
  // Een zichtbaar, schuin decal vlak voor de speler, op een bestaand
  // wereld-vlak (de vloer) maar met een KUNSTMATIG schuine normaal — dus
  // wél een echt gerenderd oppervlak eronder (voor de z-fighting-test
  // moet er iets zijn om tegenaan te vechten), met de oriëntatie van het
  // decal zelf schuin gezet.
  const normaal = new THREE.Vector3(Math.sin(35 * Math.PI / 180), Math.cos(35 * Math.PI / 180), 0).normalize();
  d.speler.positie.set(0, 0, 1.4);
  d.speler.yaw = 0; d.speler.pitch = -0.35;
  d.updateSpeler(0);
  // Zonder dit blijft de filmkorrel-tijd (uTijd, naverwerkingsPass) op de
  // echte wall-clock lopen (zie de toelichting bij die pass in gameLoop) —
  // dan verschillen twee "identieke" renders altijd een handvol pixels door
  // korrel-ruis, los van enige z-fighting. Zelfde bevriezing als
  // zetVisueelStandpunt() in helpers.mjs, hier los gezet omdat deze test
  // buiten die helper om een eigen, willekeurig schuin decal plaatst.
  d.visueleBevriesTijd = 0;
  d.spawnInslagspoor(new THREE.Vector3(0, 0.02, -0.6), normaal, d.INSLAGSPOOR_VLOER_KLEUR, 0.7);
});
const render1 = await page2.evaluate(() => { window.AmsterdamUndeadDebug.composer.render(); return true; });
const buf1 = await page2.screenshot({ type: 'png' });
const render2 = await page2.evaluate(() => { window.AmsterdamUndeadDebug.composer.render(); return true; });
const buf2 = await page2.screenshot({ type: 'png' });
void render1; void render2;
const png1 = PNG.sync.read(buf1), png2 = PNG.sync.read(buf2);
let maxVerschil = 0;
for (let i = 0; i < png1.data.length; i++) maxVerschil = Math.max(maxVerschil, Math.abs(png1.data[i] - png2.data[i]));
check('Twee opeenvolgende renders van hetzelfde schuine decal zijn pixel-identiek (geen depth-buffer-race/flikkering, een grof proxy-signaal voor z-fighting)',
  maxVerschil === 0, { maxVerschil });
writeFileSync('/tmp/claude-0/-home-user-GTA-amsterdam/42c9d8c5-74c5-5e54-ba43-81b0c4fb1d6a/scratchpad/t157-schuin-decal.png', buf1);
await browser2.close();

const fails = report(errs);
process.exit(fails > 0 ? 1 : 0);
