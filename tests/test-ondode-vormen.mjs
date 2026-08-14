// Silhouetten per type + variatieprofielen (Ticket 19, Z2).
// Controleert: (1) de profiel-loting in kiesOndodeTraits(), (2) de
// vorm-kenmerken per type (dun/breed/bochel/buik+kern/ingedoken kop),
// (3) het hitbox-contract op elke type x profiel-combinatie (hoofd nooit
// kleiner dan sphere 0.18 — ontwerpbeslissing 16), (4) raycast-sweep per
// type x 3 profielen, en (5) dat de gameplay-stats onaangeraakt zijn.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const TYPES = ['normaal', 'loper', 'sjouwer', 'brander', 'sluiper'];

// Neutrale traits met een af te dwingen profiel; 'gebocheld' hoort met een
// kromme rug te komen (forceerKromme), dus die dwingen we hier ook af.
function vasteTraits(profiel) {
  return `{ profiel: '${profiel}', kromme: ${profiel === 'gebocheld'}, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false }`;
}

// --- 1. Profiel-loting: 100 samples bevatten >= 5 verschillende profielen -
const loting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const namen = new Set();
  let ongeldig = 0;
  for (let i = 0; i < 100; i++) {
    const t = d.kiesOndodeTraits();
    namen.add(t.profiel);
    if (!(t.profiel in d.VARIATIE_PROFIELEN)) ongeldig++;
  }
  return { verschillend: namen.size, ongeldig, totaalProfielen: Object.keys(d.VARIATIE_PROFIELEN).length };
});
check('100x kiesOndodeTraits() loot >= 5 verschillende profielen', loting.verschillend >= 5, loting);
check('Elk geloot profiel bestaat in VARIATIE_PROFIELEN', loting.ongeldig === 0, loting);
check('Er zijn 6-8 variatieprofielen gedefinieerd',
  loting.totaalProfielen >= 6 && loting.totaalProfielen <= 8, loting);

// --- 2. Vorm-kenmerken per type (met neutraal 'standaard'-profiel) -------
const vormen = await page.evaluate((vasteTraitsStandaard) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of ['normaal', 'loper', 'sjouwer', 'brander', 'sluiper']) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, type, eval(`(${vasteTraitsStandaard})`));
    let torsoBreedte = null, bollen = 0, emissiveKern = false, lights = 0, meshes = 0;
    o.groep.traverse(kind => {
      if (kind.isLight) lights++;
      if (!kind.isMesh) return;
      meshes++;
      const p = kind.geometry.parameters;
      // Ticket 69: de geometrie zelf is nu altijd de gedeelde basisvorm
      // (width 0.36) — de rompbreedte-variatie per type/profiel zit sinds
      // T69 in mesh.scale.x, dus de EFFECTIEVE breedte is width * scale.x.
      if (kind.geometry.type === 'BoxGeometry' && p.height === 0.6) torsoBreedte = p.width * kind.scale.x;
      if (kind.geometry.type === 'SphereGeometry' && p.radius > 0.05 && p.radius < 0.18) bollen++;
      if (kind.material.emissiveIntensity === 1.6) emissiveKern = true;
    });
    uit[type] = { torsoBreedte, bollen, emissiveKern, lights, meshes, hoofdZ: o.delen.hoofd.position.z, hoofdRotX: o.delen.hoofd.rotation.x };
    d.doodOndode(o);
  }
  return uit;
}, vasteTraits('standaard'));
check('Loper-torso is smaller dan normaal, Sjouwer-torso breder',
  vormen.loper.torsoBreedte < vormen.normaal.torsoBreedte && vormen.sjouwer.torsoBreedte > vormen.normaal.torsoBreedte, vormen);
check('Sjouwer heeft een bochel (extra bol), normaal niet',
  vormen.sjouwer.bollen === 1 && vormen.normaal.bollen === 0, vormen);
check('Brander heeft een buik + gloeiende kern (emissive mesh)',
  vormen.brander.bollen === 2 && vormen.brander.emissiveKern === true, vormen);
check('Geen enkel type draagt een light (kern is emissive, geen PointLight)',
  TYPES.every(t => vormen[t].lights === 0), vormen);
check('Sluiper-kop is ingedoken (naar voren en omlaag gekanteld)',
  vormen.sluiper.hoofdZ > vormen.normaal.hoofdZ && vormen.sluiper.hoofdRotX > vormen.normaal.hoofdRotX, vormen);
// Ticket 99 (v0.22, §10.10-beslissing 85) voegde vier gedeelde meshes per
// ondode toe (twee schouders + twee handen) — de budgetgrens hieronder is
// dienovereenkomstig meeverhoogd van 14 naar 15 (het nieuwe echte maximum
// voor het standaard-profiel: Brander, met zijn eigen buik+kern-bollen
// bovenop de T99-toevoegingen).
check('Mesh-budget: elk type blijft op <= 15 meshes (standaard-profiel)',
  TYPES.every(t => vormen[t].meshes <= 15), vormen);

// --- 3. Hitbox-contract op ELKE type x profiel-combinatie ----------------
const contract = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const slecht = [];
  for (const type of ['normaal', 'loper', 'sjouwer', 'brander', 'sluiper']) {
    for (const profiel of Object.keys(d.VARIATIE_PROFIELEN)) {
      for (const o of [...d.ondoden]) d.doodOndode(o);
      const traits = { profiel, kromme: profiel === 'gebocheld', slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
      const o = d.spawnOndode(0, type, traits);
      let kop = 0, meshes = 0, hoofdRadius = null;
      o.groep.traverse(kind => {
        if (!kind.isMesh) return;
        meshes++;
        if (kind.userData.lichaamsdeel === 'kop') {
          kop++;
          if (kind.geometry.parameters.radius > 0.1) hoofdRadius = kind.geometry.parameters.radius;
        }
      });
      if (kop !== 3 || hoofdRadius !== 0.18 || meshes > 16) slecht.push({ type, profiel, kop, hoofdRadius, meshes });
      d.doodOndode(o);
    }
  }
  return slecht;
});
// Ticket 99: het echte maximum over alle 35 combinaties is nu 16, niet 14 —
// 'gebocheld' forceert altijd zijn eigen bochel-mesh (VARIATIE_PROFIELEN.
// gebocheld.bochel), dus een Brander (die al zijn eigen buik+kern-bollen
// heeft) met het gebocheld-profiel stapelt tot 15 (standaard) + 1 = 16.
check("Alle 35 type x profiel-combinaties: precies 3 'kop'-meshes, hoofdradius 0.18, <= 16 meshes",
  contract.length === 0, contract);

// --- 4. Raycast-sweep: headshot per type x 3 profielen, en de rechterarm
// blijft raakbaar op het eenarmige profiel ---------------------------------
function mikCode(type, profielTraits, mikX, mikY) {
  return `
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.golf = 5;
    d.spelStaat.geld = 0;
    d.schadePerTreffer = 1;
    d.eliminatiemodusTimer = 0;
    d.wapenStaat.magazijn = 8;
    const o = d.spawnOndode(0, '${type}', ${profielTraits});
    o.hp = 1000;
    o.groep.position.set(0, 0, -3);
    o.groep.scale.setScalar(1);
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
  for (const profiel of ['mager', 'gebocheld', 'eenarmig']) {
    const kop = await page.evaluate(new Function(mikCode(type, vasteTraits(profiel), 0, 1.58)));
    check(`${type} x ${profiel}: headshot op (0, 1.58) blijft slagen (schade 2)`, kop.schade === 2, kop);
  }
  const arm = await page.evaluate(new Function(mikCode(type, vasteTraits('eenarmig'), 0.24, 1.13)));
  check(`${type} x eenarmig: de rechterarm (0.24, 1.13) blijft een lichaamstreffer (schade 1)`, arm.schade === 1, arm);
}

// --- 5. Eenarmig-profiel: linkerarm ontbreekt echt (delen + mesh-telling) -
const eenarmig = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  let meshes = 0;
  o.groep.traverse(kind => { if (kind.isMesh) meshes++; });
  const uit = { armL: o.delen.armL === undefined, armR: !!o.delen.armR, meshes };
  d.doodOndode(o);
  return uit;
}, vasteTraits('eenarmig'));
// Ticket 99: de ontbrekende linkerarm neemt sinds dit ticket ook zijn eigen
// hand mee (sibling van de arm binnen dezelfde pivot-Group, zie
// maakOndodeModel()) — twee meshes minder dan het standaard-profiel, niet
// één. Schouders blijven WEL bestaan (die zijn kind van de romp-groep, niet
// van de arm-pivot), dus alleen arm+hand vallen weg.
check('Eenarmig: delen.armL ontbreekt, delen.armR bestaat, twee meshes minder (11)',
  eenarmig.armL && eenarmig.armR && eenarmig.meshes === 11, eenarmig);

// --- 6. Stats blijven byte-voor-byte ongewijzigd --------------------------
const stats = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const [naam, info] of Object.entries(d.ONDODE_TYPES)) {
    uit[naam] = { s: info.snelheidMultiplier, h: info.hpMultiplier, g: info.geldMultiplier, hpMax: info.hpMax ?? null, schaal: info.schaal };
  }
  return uit;
});
check('ONDODE_TYPES-stats zijn ongewijzigd (snapshot v0.14)',
  JSON.stringify(stats) === JSON.stringify({
    normaal: { s: 1, h: 1, g: 1, hpMax: null, schaal: 1 },
    loper: { s: 1.47, h: 0.5, g: 0.6, hpMax: null, schaal: 0.9 },
    sjouwer: { s: 0.55, h: 2.5, g: 2.2, hpMax: 8, schaal: 1.35 },
    brander: { s: 1, h: 1, g: 1.3, hpMax: null, schaal: 1 },
    sluiper: { s: 1.35, h: 0.75, g: 1.1, hpMax: null, schaal: 0.75 },
  }), stats);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
