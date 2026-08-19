// Ondode-model (Ticket 18, Z1): hitbox-/headshot-contract en silhouet-ankers.
// Oorspronkelijk geschreven tegen het oude één-blok-model, later uitgebreid
// (Ticket 128) met een parallelle V2-sectie tegen T120's layer-gebaseerde
// hitbox-proxies. Ticket 129 verwijderde de vroegere V1-architectuur en de
// V1/V2-toggle — dit bestand toetst nu uitsluitend de (enige) V2-werkelijkheid;
// de V1-only silhouet-/geoCache-secties (schouder/hand/vodGerafeld — geometrie
// die alleen door de verwijderde maakOndodeModelV1() werd opgebouwd) zijn
// vervallen, niet vervangen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const TYPES = ['normaal', 'loper', 'sjouwer', 'brander', 'sluiper'];

// --- 1. Hitbox-contract: precies 1 'kop'-hitbox (kopProxy) per model, al het
// andere ongemarkeerd — voor elk van de vijf types --------------------------
const contract = await page.evaluate((TYPES) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of TYPES) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, type);
    let kop = 0, lichaam = 0, anders = 0;
    o.groep.traverse(kind => {
      if (!kind.isMesh) return;
      if (kind.userData.lichaamsdeel === 'kop') kop++;
      else if (kind.userData.lichaamsdeel === undefined) lichaam++;
      else anders++;
    });
    uit[type] = { kop, lichaam, anders };
    d.doodOndode(o);
  }
  return uit;
}, TYPES);
check("Elk type heeft precies 1 'kop'-hitbox (kopProxy — geen losse oog-meshes meer, die zijn shader-region)",
  TYPES.every(t => contract[t].kop === 1), contract);
check("Geen enkel ander mesh-deel draagt een lichaamsdeel-markering",
  TYPES.every(t => contract[t].anders === 0), contract);

// --- 2. Hoofd-hoogte-anker: het hoofd-mesh zit op ±1.58 (schaal 1) --------
const hoofdHoogte = await page.evaluate((TYPES) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of TYPES) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, type);
    o.groep.position.set(0, 0, -3);
    o.groep.scale.setScalar(1);
    o.groep.updateMatrixWorld(true);
    let hoofdY = null;
    o.groep.traverse(kind => {
      if (kind.isMesh && kind.userData.lichaamsdeel === 'kop' && kind.geometry.type === 'SphereGeometry' &&
          kind.geometry.parameters.radius > 0.1) {
        const wereldPos = kind.getWorldPosition(new d.scene.position.constructor());
        hoofdY = wereldPos.y;
      }
    });
    uit[type] = hoofdY;
    d.doodOndode(o);
  }
  return uit;
}, TYPES);
check('Hoofd-mesh staat per type op wereldhoogte ±1.58 (schaal 1, ±0.03 voor kromme-rug-variatie)',
  TYPES.every(t => hoofdHoogte[t] !== null && Math.abs(hoofdHoogte[t] - 1.58) <= 0.03), hoofdHoogte);

// --- 3. End-to-end raycast per type: hoofd = headshot, torso/arm/been =
// lichaamstreffer (zelfde mik-patroon als de balans-tests) ------------------
function mikCode(type, mikX, mikY) {
  return `
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.golf = 5;
    d.spelStaat.geld = 0;
    d.schadePerTreffer = 1;
    d.eliminatiemodusTimer = 0;
    d.wapenStaat.magazijn = 8;
    const o = d.spawnOndode(0, '${type}');
    o.hp = 1000;   // nooit dood: schade-delta = kop- vs. lichaamstreffer
    o.groep.position.set(0, 0, -3);
    o.groep.scale.setScalar(1);      // deterministisch
    d.speler.positie.set(0, 0, 0);
    d.speler.yaw = Math.atan2(-(${mikX}), 3);
    d.speler.pitch = Math.atan2(${mikY} - d.speler.hoogte, 3);
    d.camera.position.set(0, d.speler.hoogte, 0);
    d.camera.rotation.y = d.speler.yaw;
    d.camera.rotation.x = d.speler.pitch;
    o.groep.updateMatrixWorld(true);
    d.camera.updateMatrixWorld(true);
    d.schiet();
    const schade = 1000 - o.hp;
    d.doodOndode(o);
    return { schade };
  `;
}

for (const type of TYPES) {
  const kop = await page.evaluate(new Function(mikCode(type, 0, 1.58)));
  check(`${type}: mik op het hoofd (0, 1.58) = headshot (schade 2)`, kop.schade === 2, kop);
  const torso = await page.evaluate(new Function(mikCode(type, 0, 1.1)));
  check(`${type}: mik op de torso (0, 1.1) = lichaamstreffer (schade 1)`, torso.schade === 1, torso);
  const arm = await page.evaluate(new Function(mikCode(type, 0.24, 1.13)));
  check(`${type}: mik op de arm (0.24, 1.13) = lichaamstreffer (schade 1)`, arm.schade === 1, arm);
  const been = await page.evaluate(new Function(mikCode(type, 0.07, 0.4)));
  check(`${type}: mik op het been (0.07, 0.4) = lichaamstreffer (schade 1)`, been.schade === 1, been);
}

// --- 4. Kleinere schaal (Sluiper-achtig) verschuift de headshot mee -------
const geschaald = await page.evaluate(new Function(`
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 5;
  d.schadePerTreffer = 1;
  d.wapenStaat.magazijn = 8;
  const o = d.spawnOndode(0, 'sluiper');
  o.hp = 1000;
  o.groep.position.set(0, 0, -3);
  o.groep.scale.setScalar(0.75);   // de nominale Sluiper-schaal
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  d.speler.pitch = Math.atan2(1.58 * 0.75 - d.speler.hoogte, 3);
  d.camera.position.set(0, d.speler.hoogte, 0);
  d.camera.rotation.y = 0;
  d.camera.rotation.x = d.speler.pitch;
  o.groep.updateMatrixWorld(true);
  d.camera.updateMatrixWorld(true);
  d.schiet();
  const schade = 1000 - o.hp;
  d.doodOndode(o);
  return { schade };
`));
check('Sluiper op schaal 0.75: headshot op 1.58 x 0.75 blijft een headshot (schade 2)',
  geschaald.schade === 2, geschaald);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
