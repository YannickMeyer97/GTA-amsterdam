// Ticket 92 (v0.22, §10.9-beslissing 84): camerabeweging als cosmetische
// laag — loopwiegen (aan afgelegde afstand, niet aan tijd), landingsdip en
// lean bij strafen. Het wapenmodel wiegt tegen. De drie architecturale
// eisen uit §10.9: (1) wiegen hangt aan afstand, niet tijd, (2) de
// camerabeweging staat volledig buiten updateSpeler()/losBotsingenOp()/
// schiet() — een schot raakt exact hetzelfde als vóór dit ticket, (3) het
// wapenmodel wiegt tegen (niet 1-op-1 mee).
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Constantensanity: amplitude in centimeters, lean ruim onder 1° ----
const constanten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    BOB_AMPLITUDE: d.BOB_AMPLITUDE,
    LEAN_MAX_HOEK_GRADEN: d.LEAN_MAX_HOEK * 180 / Math.PI,
    LANDING_DIP_MAX: d.LANDING_DIP_MAX,
    WAPEN_SWAY_AMPLITUDE: d.WAPEN_SWAY_AMPLITUDE,
  };
});
check('BOB_AMPLITUDE zit in de orde van centimeters (0,5-10 cm)',
  constanten.BOB_AMPLITUDE >= 0.005 && constanten.BOB_AMPLITUDE <= 0.1, constanten);
check('LEAN_MAX_HOEK blijft ruim onder 1°',
  constanten.LEAN_MAX_HOEK_GRADEN < 1, constanten);
check('LANDING_DIP_MAX zit in de orde van centimeters',
  constanten.LANDING_DIP_MAX >= 0.005 && constanten.LANDING_DIP_MAX <= 0.1, constanten);
check('WAPEN_SWAY_AMPLITUDE zit in de orde van centimeters',
  constanten.WAPEN_SWAY_AMPLITUDE >= 0.001 && constanten.WAPEN_SWAY_AMPLITUDE <= 0.05, constanten);

// --- 2. Bij stilstand: camera-y blijft constant, bobFase verandert niet ---
const stilstand = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  for (const k in d.ingedrukt) d.ingedrukt[k] = false;
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  const bobFaseVoor = d.bobFase;
  const ys = [];
  for (let i = 0; i < 10; i++) {
    await new Promise(res => requestAnimationFrame(res));
    ys.push(d.camera.position.y);
  }
  return { ys, bobFaseVoor, bobFaseNa: d.bobFase };
});
const stilstandUniek = new Set(stilstand.ys.map(y => y.toFixed(9))).size;
check('Bij stilstand (geen enkele beweegtoets ingedrukt) blijft camera.position.y constant over 10 frames',
  stilstandUniek === 1, stilstand);
check('Bij stilstand verandert bobFase niet (geen afgelegde afstand, dus geen fase-opbouw)',
  stilstand.bobFaseVoor === stilstand.bobFaseNa, stilstand);

// --- 3. Bij lopen: camera-y varieert binnen een band, bobFase loopt op ----
const lopen = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  for (const k in d.ingedrukt) d.ingedrukt[k] = false;
  d.updateSpeler(0);
  d.ingedrukt['KeyW'] = true;
  const ys = [];
  for (let i = 0; i < 40; i++) {
    await new Promise(res => requestAnimationFrame(res));
    ys.push(d.camera.position.y);
  }
  d.ingedrukt['KeyW'] = false;
  return { ys, bobFaseNa: d.bobFase, eindPositieZ: d.speler.positie.z };
});
const lopenUniek = new Set(lopen.ys.map(y => y.toFixed(9))).size;
const lopenBand = Math.max(...lopen.ys) - Math.min(...lopen.ys);
check('Tijdens het lopen varieert camera.position.y daadwerkelijk (niet constant)',
  lopenUniek > 1, lopen);
check('De variatie blijft binnen een smalle band (<= 2x BOB_AMPLITUDE, geen onbegrensde drift)',
  lopenBand <= constanten.BOB_AMPLITUDE * 2 + 1e-6, { lopenBand, ...constanten });
check('bobFase is opgelopen (afgelegde afstand > 0, speler is echt verplaatst)',
  lopen.bobFaseNa > 0 && lopen.eindPositieZ !== 0, lopen);

// --- 4. Lean: interpoleert naar het zijwaartse-invoerdoel en terug --------
const lean = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  for (const k in d.ingedrukt) d.ingedrukt[k] = false;
  d.updateSpeler(0);
  d.ingedrukt['KeyD'] = true;
  for (let i = 0; i < 60; i++) await new Promise(res => requestAnimationFrame(res));
  const leanRechts = d.leanHoek;
  d.ingedrukt['KeyD'] = false;
  d.ingedrukt['KeyA'] = true;
  for (let i = 0; i < 60; i++) await new Promise(res => requestAnimationFrame(res));
  const leanLinks = d.leanHoek;
  d.ingedrukt['KeyA'] = false;
  for (let i = 0; i < 60; i++) await new Promise(res => requestAnimationFrame(res));
  const leanNeutraal = d.leanHoek;
  return { leanRechts, leanLinks, leanNeutraal, LEAN_MAX_HOEK: d.LEAN_MAX_HOEK };
});
check('KeyD ingedrukt: leanHoek nadert LEAN_MAX_HOEK (positief)',
  Math.abs(lean.leanRechts - lean.LEAN_MAX_HOEK) < 0.001, lean);
check('KeyA ingedrukt: leanHoek nadert -LEAN_MAX_HOEK (negatief)',
  Math.abs(lean.leanLinks + lean.LEAN_MAX_HOEK) < 0.001, lean);
check('Geen enkele toets ingedrukt: leanHoek keert terug naar ~0',
  Math.abs(lean.leanNeutraal) < 0.001, lean);

// --- 5. Landingsdip: forceer een trigger via de testhaak, verifieer boog --
const landing = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  for (const k in d.ingedrukt) d.ingedrukt[k] = false;
  d.updateSpeler(0);
  // Eén frame laten "settelen": de .set()-teleport hierboven laat de interne
  // vorigeSpelerX/Z (bob-tracking) nog op de OUDE positie van de vorige
  // sectie staan, dus dit ene frame leest een schijnbare sprint. Die wordt
  // hier bewust verbruikt en pas DAARNA weggegooid (d.bobFase = 0), zodat de
  // rest van deze sectie met een echt schone lei begint.
  await new Promise(res => requestAnimationFrame(res));
  d.vorigeVloerY = d.speler.positie.y;   // exacte baseline, geen ruis van eerdere secties
  d.bobFase = 0;   // isoleer van de loopfase die eerdere secties al hebben opgebouwd
  d.pieksnelheidDaling = -1.0;   // simuleert een stevige, net afgeronde daling
  await new Promise(res => requestAnimationFrame(res));
  const netNaTrigger = { timer: d.landingsDipTimer, sterkte: d.landingsDipSterkte, y: d.camera.position.y };
  const baseline = d.speler.positie.y + d.speler.hoogte;
  // 40 echte frames (~0,65s @ 60fps) ligt ruim voorbij LANDING_DIP_DUUR (0,35s).
  for (let i = 0; i < 40; i++) await new Promise(res => requestAnimationFrame(res));
  const naAfloop = { timer: d.landingsDipTimer, y: d.camera.position.y };
  return { netNaTrigger, naAfloop, baseline, LANDING_DIP_MAX: d.LANDING_DIP_MAX };
});
check('Direct na de trigger staat landingsDipTimer > 0 en landingsDipSterkte > 0',
  landing.netNaTrigger.timer > 0 && landing.netNaTrigger.sterkte > 0, landing);
check('landingsDipSterkte blijft geklemd op LANDING_DIP_MAX',
  landing.netNaTrigger.sterkte <= landing.LANDING_DIP_MAX + 1e-9, landing);
check('Ruim na LANDING_DIP_DUUR is landingsDipTimer weer op 0',
  landing.naAfloop.timer === 0, landing);
check('...en camera.position.y is weer terug op de kale baseline (geen blijvende dip)',
  Math.abs(landing.naAfloop.y - landing.baseline) < 1e-6, landing);

// --- 6. Het wapenmodel wiegt tegen (eigen sway + tegengestelde lean) -----
const wapenTegenwicht = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  for (const k in d.ingedrukt) d.ingedrukt[k] = false;
  d.updateSpeler(0);
  d.ingedrukt['KeyW'] = true;
  d.ingedrukt['KeyD'] = true;
  const wapenXen = [];
  for (let i = 0; i < 60; i++) {
    await new Promise(res => requestAnimationFrame(res));
    wapenXen.push(d.wapenStaat.definitie.groep.position.x);
  }
  const rotatieZ = d.wapenStaat.definitie.groep.rotation.z;
  d.ingedrukt['KeyW'] = false; d.ingedrukt['KeyD'] = false;
  return { wapenXen, rotatieZ, leanHoek: d.leanHoek, WAPEN_BASIS_X: d.WAPEN_BASIS_X, WAPEN_SWAY_AMPLITUDE: d.WAPEN_SWAY_AMPLITUDE };
});
const wapenXUniek = new Set(wapenTegenwicht.wapenXen.map(x => x.toFixed(9))).size;
check('Het wapenmodel krijgt een eigen, variërende zijwaartse sway (position.x varieert)',
  wapenXUniek > 1, wapenTegenwicht);
check('De sway blijft binnen WAPEN_BASIS_X ± WAPEN_SWAY_AMPLITUDE',
  wapenTegenwicht.wapenXen.every(x => Math.abs(x - wapenTegenwicht.WAPEN_BASIS_X) <= wapenTegenwicht.WAPEN_SWAY_AMPLITUDE + 1e-9),
  wapenTegenwicht);
check('De wapenrotatie staat TEGENGESTELD aan de camera-lean (ander teken, kleinere fractie)',
  Math.sign(wapenTegenwicht.rotatieZ) === -Math.sign(wapenTegenwicht.leanHoek) &&
  Math.abs(wapenTegenwicht.rotatieZ) < Math.abs(wapenTegenwicht.leanHoek), wapenTegenwicht);

// --- 7. HET BELANGRIJKSTE: de raycast-oorsprong van schiet() beweegt niet -
// Eerst het precieze mechanisme: updateSpeler() moet camera.position.y EN
// camera.rotation.z onvoorwaardelijk terugzetten naar de kale baseline, wat
// er ook nog in stond — dat is de garantie dat schiet() (dat in dezelfde
// gameLoop-tick ná updateSpeler() maar VÓÓR deze cosmetische zone loopt)
// nooit iets anders ziet dan de ongewiegde staat, ongeacht wat de vórige
// tick's cosmetische zone erin had gezet.
const resetGarantie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Fix (flaky test, gevonden bij T132): met simuleerPointerLock:true staat
  // spelActief de hele test aan, dus het golfsysteem kan tijdens de vele
  // rAF-waits in de secties hierboven (60+40+... frames) echt golf 1 starten
  // en ondoden spawnen. updateSpeler() roept ALTIJD ook
  // duwSpelerWegVanOndoden() aan (ongeacht dt) — staat er toevallig een
  // ondode binnen SPELER_ONDODE_BOTSING_STRAAL van (1.5, -2.5), dan schuift
  // de speler een fractie weg en faalt de exacte-positie-check hieronder.
  // Dat heeft niets met de camerabeweging van dit ticket te maken (de
  // garantie die hier bewezen wordt gaat over updateSpeler()'s eigen reset,
  // niet over speler-ondode-botsing), dus leegmaken i.p.v. tolereren.
  //
  // BEWUST doodOndode() i.p.v. `d.ondoden.length = 0`: die laatste leegt
  // alleen de TRACKING-array, niet de SCÈNE-graaf — de mesh van een
  // "gecleared" ondode blijft dan gewoon in `ondodenGroep` hangen. Dat is
  // hier onschadelijk (deze check doet geen raycast), maar corrumpeert de
  // scène voor de eropvolgende schiet-sectie verderop in dit bestand, die
  // WEL raycast tegen `ondodenGroep` — een stale mesh kan dan een latere
  // raycast blokkeren. doodOndode() haalt het object ook echt uit de scène
  // (naar stervendenGroep, buiten schiet()'s raycast-doel), zelfde patroon
  // als elders in de suite (`for (const o of [...d.ondoden]) d.doodOndode(o)`).
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(1.5, 0, -2.5);
  d.speler.yaw = 0.7; d.speler.pitch = -0.1;
  // "Corrumpeer" camera opzettelijk met waarden die duidelijk NIET de
  // baseline zijn — alsof een vorige tick's bob/lean was blijven hangen.
  d.camera.position.set(999, 999, 999);
  d.camera.rotation.set(1, 1, 1);
  d.updateSpeler(0);
  return {
    positieX: d.camera.position.x, positieY: d.camera.position.y, positieZ: d.camera.position.z,
    rotatieX: d.camera.rotation.x, rotatieY: d.camera.rotation.y, rotatieZ: d.camera.rotation.z,
    verwachtY: d.speler.positie.y + d.speler.hoogte,
  };
});
check('updateSpeler() zet camera.position volledig vers, ongeacht een "corrupte" vorige staat',
  resetGarantie.positieX === 1.5 && resetGarantie.positieZ === -2.5 &&
  Math.abs(resetGarantie.positieY - resetGarantie.verwachtY) < 1e-9, resetGarantie);
check('updateSpeler() zet camera.rotation.y (yaw) en rotation.x (pitch) vers',
  resetGarantie.rotatieY === 0.7 && resetGarantie.rotatieX === -0.1, resetGarantie);
check('updateSpeler() zet camera.rotation.z EXACT terug naar 0 (geen restant-lean kan een raycast raken)',
  resetGarantie.rotatieZ === 0, resetGarantie);

// Realistische integratietest: terwijl bob ECHT actief is (meetbaar niet-
// nul, opgebouwd via echte beweging), moeten schoten nog steeds normaal
// raken. Elk schot herhaalt hier expliciet de ECHTE gameLoop-tick-volgorde
// (updateSpeler() → schiet(), zie de reset-garantie hierboven) i.p.v. te
// vertrouwen op reëel-tijd rAF-timing (onvoorspelbaar traag/variabel in
// deze headless omgeving, en dus een bron van test-flakiness die niets met
// de architectuur te maken had — bobFase bleef intussen gewoon "actief"
// staan, puur cosmetisch, precies wat hier bewezen moet worden).
const treffersTijdensBeweging = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  for (const k in d.ingedrukt) d.ingedrukt[k] = false;
  d.updateSpeler(0);
  // Alleen KeyW (recht vooruit): KeyD zou de speler opzij laten drijven, en
  // pas ná de warmup wordt de positie toch weer expliciet vastgezet. Lean
  // is al apart en grondig getest in sectie 4, en de kern-garantie (geen
  // enkele bob/lean-waarde raakt een raycast) is generiek en as-
  // onafhankelijk bewezen in sectie 7 hierboven — deze sectie hoeft lean
  // dus niet nogmaals te reproduceren.
  d.ingedrukt['KeyW'] = true;
  for (let i = 0; i < 20; i++) await new Promise(res => requestAnimationFrame(res));
  d.ingedrukt['KeyW'] = false;
  const bobFaseActief = d.bobFase;   // bewijs dat bob écht actief was (testopzet klopt)

  // Expliciet neutrale traits (met name lengte: 1): kiesOndodeTraits() loot
  // normaliter een lengte-multiplier van 0,9-1,12 die de hele groep.scale.y
  // schaalt (maakOndodeModel()) — bij een ongelukkige (korte) roll zakt het
  // hoofd ver genoeg onder de camera-ooghoogte (1,7m) dat een kaarsrechte
  // raycast recht vooruit het hoofd net mist. Dat is RNG-gedreven test-
  // flakiness, los van deze T92-camerabeweging zelf (die de raycast-bron
  // niet aanraakt, zie de reset-garantie hierboven) — vastzetten op de
  // gemiddelde/neutrale hoogte maakt de treffer-garantie deterministisch.
  const NEUTRALE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  // Fix (flaky test, gevonden bij T132, zelfde mechanisme als de
  // resetGarantie-fix hierboven): het golfsysteem kan tijdens de vele
  // rAF-waits eerder in dit script écht zombies gespawnd hebben. Staat er
  // toevallig een echte ondode tussen de camera (0,0,0) en het testdoel
  // (0,0,-3), dan raakt de raycast in schiet() DIE ondode i.p.v. `o` — o.hp
  // blijft dan alle 20 schoten lang ongewijzigd (exact het symptoom
  // hieronder). doodOndode() i.p.v. `.length = 0`: die laatste leegt alleen
  // de tracking-array, niet `ondodenGroep` (de scène-graaf die schiet()'s
  // raycast doorloopt) — een "gecleared" mesh zou dan gewoon blijven staan
  // en de raycast alsnog kunnen blokkeren. Vóór de spawn van `o`, niet erna
  // (dat zou `o` zelf ook meteen weer verwijderen).
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal', NEUTRALE_TRAITS);
  o.hp = 100000;
  const hpVoor = o.hp;
  const AANTAL_SCHOTEN = 20;
  for (let i = 0; i < AANTAL_SCHOTEN; i++) {
    // Exact de tick-volgorde van de echte gameLoop: updateSpeler() ZET de
    // camera vers (inclusief de rotation.z=0-reset uit sectie 7), pas
    // DAARNA schiet() — bobFase zelf blijft intact (blijft "actief"), maar
    // de raycast-bron is elke keer opnieuw gegarandeerd de kale baseline.
    d.speler.positie.set(0, 0, 0);
    d.speler.yaw = 0; d.speler.pitch = 0;
    // cameraKick (bestaande recoil, Ticket 34) decayt normaliter in de
    // cosmetische gameLoop-zone via echte dt — die draait hier nooit (geen
    // enkel rAF-frame tussen deze synchrone schoten), dus zonder reset zou
    // 'ie ongehinderd opstapelen en de pitch geleidelijk laten wegdrijven.
    // Dat is een bestaand, ongerelateerd mechanisme (opzettelijke
    // recoil-climb tijdens aanhoudend vuur) — dit is niet wat deze T92-test
    // moet meten, dus expliciet neutraliseren.
    d.cameraKick = 0;
    d.updateSpeler(0);
    d.camera.updateMatrixWorld(true);
    o.groep.position.set(0, 0, -3);
    o.groep.updateMatrixWorld(true);   // algemene Three.js-valkuil (zie sectie hierboven): stale matrixWorld zonder render ertussen
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
    d.wapenStaat.herladen = false;
    d.schiet();
  }
  return { hpVoor, hpNa: o.hp, AANTAL_SCHOTEN, bobFaseActief };
});
check('Vóór de schotenreeks was bob daadwerkelijk actief (testopzet klopt)',
  treffersTijdensBeweging.bobFaseActief > 0, treffersTijdensBeweging);
check('Alle schoten raakten, elk voorafgegaan door een echte updateSpeler()-tick met actieve bob (HP daalde met minstens AANTAL_SCHOTEN x de laagste schade)',
  treffersTijdensBeweging.hpVoor - treffersTijdensBeweging.hpNa >= treffersTijdensBeweging.AANTAL_SCHOTEN, treffersTijdensBeweging);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
