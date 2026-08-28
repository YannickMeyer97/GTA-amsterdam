// Silhouetten per type + variatieprofielen (Ticket 19, Z2).
// Controleert: (1) de profiel-loting in kiesOndodeTraits(), (2) de
// vorm-kenmerken per type (dun/breed/bochel/buik+kern/ingedoken kop),
// (3) het hitbox-contract op elke type x profiel-combinatie (hoofd nooit
// kleiner dan sphere 0.18 — ontwerpbeslissing 16), (4) raycast-sweep per
// type x 3 profielen, en (5) dat de gameplay-stats onaangeraakt zijn.
// Ticket 129: de vroegere V1-architectuur is verwijderd — de vorm-/hitbox-
// checks lezen nu rechtstreeks de SkinnedMesh-architectuur (delen.vormParams,
// de vaste hitbox-proxies uit Ticket 120) i.p.v. losse geschaalde meshes.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): de raycast-sweep-sectie gebruikt d.schiet() — eerst
// een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

const TYPES = ['normaal', 'sjouwer', 'brander', 'sluiper'];

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

// --- 2. Vorm-kenmerken per type, via delen.vormParams (Ticket 124/125/126:
// een klein, met opzet bewaard veld dat de afgeleide vormparameters
// blootgeeft die anders alleen met het oog te toetsen zouden zijn — een
// bounding box wordt door de ARMEN bepaald, niet door de romp, dus is geen
// betrouwbare torsobreedte-meting) -----------------------------------------
const vormen = await page.evaluate(({ vasteTraitsStandaard, TYPES }) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const type of TYPES) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, type, eval(`(${vasteTraitsStandaard})`));
    uit[type] = {
      rompBreedte: o.delen.vormParams.rompBreedte,
      heeftBochel: o.delen.vormParams.heeftBochel,
      heeftBuik: o.delen.vormParams.heeftBuik,
      heeftKern: !!o.delen.kern,
      hoofdZ: o.delen.hoofd.position.z,
      hoofdRotX: o.delen.hoofd.rotation.x,
    };
    d.doodOndode(o);
  }
  return uit;
}, { vasteTraitsStandaard: vasteTraits('standaard'), TYPES });
check('Sjouwer-torso is breder dan normaal (vormParams.rompBreedte)',
  vormen.sjouwer.rompBreedte > vormen.normaal.rompBreedte, vormen);
check('Sjouwer heeft een bochel, normaal niet',
  vormen.sjouwer.heeftBochel === true && vormen.normaal.heeftBochel === false, vormen);
check('Brander heeft een buik + een losse gloeiende kern-mesh (delen.kern)',
  vormen.brander.heeftBuik === true && vormen.brander.heeftKern === true, vormen);
check('Alleen Brander heeft delen.kern (de bewuste uitzondering op één-SkinnedMesh-per-ondode)',
  TYPES.filter(t => vormen[t].heeftKern).join(',') === 'brander', vormen);
check('Sluiper-kop is ingedoken (naar voren en omlaag gekanteld)',
  vormen.sluiper.hoofdZ > vormen.normaal.hoofdZ && vormen.sluiper.hoofdRotX > vormen.normaal.hoofdRotX, vormen);

// --- 3. Hitbox-contract op ELKE type x profiel-combinatie: de kop-hitbox is
// een VASTE straal (HITBOX_KOP_STRAAL), niet per type/profiel afgeleide
// geometrie — een headshot moet voor elk type/profiel exact even groot
// blijven. -------------------------------------------------------------
const contract = await page.evaluate((TYPES) => {
  const d = window.AmsterdamUndeadDebug;
  const slecht = [];
  for (const type of TYPES) {
    for (const profiel of Object.keys(d.VARIATIE_PROFIELEN)) {
      for (const o of [...d.ondoden]) d.doodOndode(o);
      const traits = { profiel, kromme: profiel === 'gebocheld', slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
      const o = d.spawnOndode(0, type, traits);
      const kopOk = o.delen.kopProxy?.userData.lichaamsdeel === 'kop' &&
        o.delen.kopProxy.geometry.parameters.radius === 0.18;
      const lichaamOk = !!o.delen.lichaamProxy;
      if (!kopOk || !lichaamOk) slecht.push({ type, profiel, kopOk, lichaamOk });
      d.doodOndode(o);
    }
  }
  return slecht;
}, TYPES);
check("Alle 28 type x profiel-combinaties: kopProxy is 'kop' met straal 0.18, lichaamProxy bestaat",
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

// --- 5. Eenarmig-profiel: delen.armL ontbreekt, en de samengestelde
// geometrie heeft minder vertices dan het standaard-profiel (armGeoL +
// handGeoL worden simpelweg niet toegevoegd) -------------------------------
const eenarmig = await page.evaluate(({ traitsStr, standaardStr }) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const standaard = d.spawnOndode(0, 'normaal', eval(`(${standaardStr})`));
  const vertexStandaard = standaard.delen.skinnedMesh.geometry.attributes.position.count;
  d.doodOndode(standaard);
  const o = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  const uit = {
    armL: o.delen.armL === undefined, armR: !!o.delen.armR,
    vertexEenarmig: o.delen.skinnedMesh.geometry.attributes.position.count,
    vertexStandaard,
  };
  d.doodOndode(o);
  return uit;
}, { traitsStr: vasteTraits('eenarmig'), standaardStr: vasteTraits('standaard') });
check('Eenarmig: delen.armL ontbreekt, delen.armR bestaat, minder vertices dan het standaard-profiel',
  eenarmig.armL && eenarmig.armR && eenarmig.vertexEenarmig < eenarmig.vertexStandaard, eenarmig);

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
    sjouwer: { s: 0.55, h: 2.5, g: 2.2, hpMax: 8, schaal: 1.35 },
    brander: { s: 1, h: 1, g: 1.3, hpMax: null, schaal: 1 },
    sluiper: { s: 1.35, h: 0.75, g: 1.1, hpMax: null, schaal: 0.75 },
  }), stats);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
