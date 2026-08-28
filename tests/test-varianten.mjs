// Ondode-varianten: Sjouwer/Brander/Sluiper (Ticket v0.7 + balanspatch
// Ticket 5). Zie ARCHITECTURE_NOTES.md §1 "Zombie-typedefinities".
// (De Loper is later op speelverzoek uit het spel verwijderd — leek qua
// kleur/gedrag te veel op de Brander en voegde te weinig eigen identiteit toe.)
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. spawnOndode() zonder type-argument blijft 'normaal' --------------
const standaard = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const o = d.spawnOndode(0);
  return { type: o.type, geldMultiplier: o.geldMultiplier };
});
check("spawnOndode(idx) zonder type is altijd 'normaal'",
  standaard.type === 'normaal' && standaard.geldMultiplier === 1, standaard);

// --- 2. ondodeTypeGewichten(): varianten pas vanaf hun eigen golf --------
const gewichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 1;
  const golf1 = d.ondodeTypeGewichten();
  d.spelStaat.golf = 4;
  const golf4 = d.ondodeTypeGewichten();
  return { golf1, golf4 };
});
check('Golf 1: alleen normaal heeft gewicht',
  gewichten.golf1.sjouwer === 0 && gewichten.golf1.brander === 0 && gewichten.golf1.normaal > 0, gewichten.golf1);
check('Golf 4: beide varianten (sjouwer/brander) hebben een gewicht > 0',
  gewichten.golf4.sjouwer > 0 && gewichten.golf4.brander > 0, gewichten.golf4);

// --- 4. Sjouwer: 5 HP op golf 5-10 (Ticket 5 + 14), trager, meer geld -----
// Ticket 14: basis-HP is nu een trap (golf 3 -> basis 1 -> sjouwer 3);
// de klassieke "sjouwer = 5" geldt op de 2-HP-trap (golf 5-10).
const sjouwerStats = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const sjouwer = d.spawnOndode(0, 'sjouwer');
  const normaal = d.spawnOndode(0, 'normaal');
  return { hp: sjouwer.hp, snelheid: sjouwer.snelheid, normaalSnelheid: normaal.snelheid, normaalHp: normaal.hp };
});
check('Op golf 5-10 (basis 2): sjouwer.hp === 5', sjouwerStats.hp === 5, sjouwerStats);
check('Sjouwer is trager en heeft meer HP dan normaal',
  sjouwerStats.snelheid < sjouwerStats.normaalSnelheid && sjouwerStats.hp > sjouwerStats.normaalHp, sjouwerStats);

// --- 4b. Ticket 14: HP-trap over golf 1-25 + Sjouwer-plafond 8 ------------
const hpTabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (let golf = 1; golf <= 25; golf++) {
    d.spelStaat.golf = golf;
    const normaal = d.spawnOndode(0, 'normaal');
    const sjouwer = d.spawnOndode(0, 'sjouwer');
    const sluiper = d.spawnOndode(0, 'sluiper');
    uit[golf] = { basis: d.ondodeStartHP(), normaal: normaal.hp, sjouwer: sjouwer.hp, sluiper: sluiper.hp };
    for (const o of [...d.ondoden]) d.doodOndode(o);
  }
  return uit;
});
const trapKlopt = [[1, 1], [4, 1], [5, 2], [10, 2], [11, 3], [15, 3], [16, 4], [25, 4]]
  .every(([golf, hp]) => hpTabel[golf].normaal === hp);
check('Normaal-HP volgt de trap: 1(g1-4) 2(g5-10) 3(g11-15) 4(g16+, plafond)', trapKlopt,
  Object.fromEntries([1, 4, 5, 10, 11, 15, 16, 25].map(g => [g, hpTabel[g].normaal])));
const sjouwerNooitBoven8 = Object.values(hpTabel).every(rij => rij.sjouwer <= 8);
check('Sjouwer-HP is nooit hoger dan 8 (golf 16+: min(round(4x2.5), 8) = 8)',
  sjouwerNooitBoven8 && hpTabel[16].sjouwer === 8 && hpTabel[11].sjouwer === 8, hpTabel[16]);
const minimum1 = Object.values(hpTabel).every(rij => rij.sluiper >= 1);
check('Sluiper zakt nooit onder 1 HP', minimum1, { golf1: hpTabel[1] });

// --- 5. Brander: normale HP, ontploft bij overlijden ----------------------
const branderType = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const brander = d.spawnOndode(0, 'brander');
  const normaal = d.spawnOndode(0, 'normaal');
  return { type: brander.type, hp: brander.hp, normaalHp: normaal.hp };
});
check("Brander heeft type 'brander' en normale HP", branderType.type === 'brander' && branderType.hp === branderType.normaalHp, branderType);

const explosie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 1;
  d.spelerStaat.hp = 100;
  d.speler.positie.set(0, 0, 0);
  const brander = d.spawnOndode(0, 'brander');
  brander.groep.position.set(0.5, 0, 0.5);
  const slachtoffer = d.spawnOndode(0, 'normaal');
  slachtoffer.groep.position.set(1.0, 0, 0.5);
  slachtoffer.hp = 1;
  const hpVoor = d.spelerStaat.hp;
  d.doodOndode(brander);
  return { hpVoor, hpNa: d.spelerStaat.hp, slachtofferNogInLeven: d.ondoden.includes(slachtoffer) };
});
check('Ontploffing van een Brander doet schade aan de speler in bereik', explosie.hpNa === explosie.hpVoor - 25, explosie);
check('Ontploffing van een Brander doodt een andere ondode in bereik', explosie.slachtofferNogInLeven === false, explosie);

// --- 6. Kill-geld schaalt mee met geldMultiplier --------------------------
const geld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.dubbeleBeloningTimer = 0;
  d.eliminatiemodusTimer = 0;
  d.spelStaat.golf = 1;
  d.spelStaat.geld = 0;
  const sjouwer = d.spawnOndode(0, 'sjouwer');   // hp = round(1*2.5) = 3 op golf 1
  for (let i = 0; i < 10 && d.ondoden.includes(sjouwer); i++) d.raakOndode(sjouwer, sjouwer.groep.position, false);
  return { geld: d.spelStaat.geld };
});
check('Sjouwer-kill levert meer geld op dan een normale kill (GELD_PER_KILL * 2.2, afgerond)',
  geld.geld === Math.round(20 * 2.2) + 5 * 2, geld);

// --- 7. golfSpawnStap() gebruikt kiesOndodeType() (echte golf-spawns) ----
const golfSpawnType = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 10;
  for (const v of d.VENSTERS) v.planken = 0;
  const types = new Set();
  for (let i = 0; i < 60; i++) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.budget = 999;   // Ticket 13: golfSpawnStap checkt nu budget
    const o = d.golfSpawnStap();
    if (o) types.add(o.type);
  }
  return [...types];
});
check('golfSpawnStap() produceert op golf 10 meerdere verschillende types over 60 spawns',
  golfSpawnType.length > 1, golfSpawnType);

// === Ticket 124/125/126 (Zombie V2 fase 5): types en variatieprofielen op
// de V2-basis. Ticket 129 verwijderde V1 en de V1/V2-toggle — elke ondode is
// nu een V2-ondode, dus de asserts hierboven (gameplay-stats, geen mesh-
// structuur) en dit blok (visuele verwerking) draaien allebei op dezelfde,
// enige werkelijkheid. ======================================================
const v2Types = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  const traits = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  for (const type of ['normaal', 'sjouwer', 'brander', 'sluiper']) {
    for (const o of [...d.ondoden]) { d.ondodenGroep.remove(o.groep); d.ruimGroepOp(o.groep); }
    d.ondoden.length = 0;
    const o = d.spawnOndode(0, type, { ...traits });
    let zichtbaar = 0;
    o.groep.traverse((k) => { if (k.isMesh && k.visible) zichtbaar++; });
    const g = o.delen.skinnedMesh.geometry;
    g.computeBoundingBox();
    uit[type] = {
      zichtbareMeshes: zichtbaar,
      // De bbox van de HELE mesh wordt door de armen bepaald (x = ±0,30),
      // niet door de romp — vandaar de expliciet bewaarde vormparameters.
      rompBreedte: o.delen.vormParams.rompBreedte,
      heeftBochel: o.delen.vormParams.heeftBochel,
      heeftKern: !!o.delen.kern,
      // Kromme rug / ingedoken kop komen als BOT-rotatie ná bind(), dus
      // meetbaar op het bot zelf i.p.v. op de geometrie.
      chestKanteling: +o.delen.chest.rotation.x.toFixed(3),
      hoofdKanteling: +o.delen.hoofd.userData.baseRotX.toFixed(3),
    };
  }
  return uit;
});
// Toetst de bouwer los van het model: reageert het rompprofiel echt op de
// breedteparameter? (Het model levert de parameter, dit levert de vorm.)
const v2RompBreedtes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const detail = d.V2_DETAIL_NIVEAUS[d.ZOMBIE_V2_DETAIL];
  const meet = (f) => {
    const g = d.bouwV2RompGeometrie(detail, f);
    g.computeBoundingBox();
    const b = +(g.boundingBox.max.x - g.boundingBox.min.x).toFixed(4);
    g.dispose();
    return b;
  };
  return { smal: meet(0.78), normaal: meet(1), breed: meet(1.3) };
});

check('V2: elk van de vier types kost 1 zichtbare draw call, behalve de Brander (2: + losse kernmesh)',
  ['normaal', 'sjouwer', 'sluiper'].every(t => v2Types[t].zichtbareMeshes === 1) &&
  v2Types.brander.zichtbareMeshes === 2, v2Types);
check('V2: alleen de Brander heeft een losse kern-mesh (delen.kern)',
  v2Types.brander.heeftKern && ['normaal', 'sjouwer', 'sluiper'].every(t => !v2Types[t].heeftKern), v2Types);
check('V2: Sjouwer past rompBreedte 1,3 toe en heeft een bochel (exact ONDODE_TYPES[..].vorm)',
  v2Types.sjouwer.rompBreedte === 1.3 && v2Types.sjouwer.heeftBochel === true &&
  v2Types.normaal.rompBreedte === 1, v2Types);
check('V2: bouwV2RompGeometrie() vertaalt die breedte ook echt naar een breder oppervlak',
  v2RompBreedtes.breed > v2RompBreedtes.normaal * 1.15 &&
  v2RompBreedtes.smal < v2RompBreedtes.normaal * 0.9, v2RompBreedtes);
check('V2: Sluiper heeft een ingedoken kop (extra hoofdkanteling t.o.v. normaal)',
  v2Types.sluiper.hoofdKanteling > v2Types.normaal.hoofdKanteling + 0.2, v2Types);

const v2Profielen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const profiel of Object.keys(d.VARIATIE_PROFIELEN)) {
    for (const o of [...d.ondoden]) { d.ondodenGroep.remove(o.groep); d.ruimGroepOp(o.groep); }
    d.ondoden.length = 0;
    const p = d.VARIATIE_PROFIELEN[profiel];
    const traits = { profiel, kromme: !!p.forceerKromme, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
    let fout = null, o = null;
    try { o = d.spawnOndode(0, 'normaal', traits); } catch (e) { fout = String(e); }
    if (!o) { uit[profiel] = { fout }; continue; }
    const g = o.delen.skinnedMesh.geometry;
    g.computeBoundingBox();
    // Loopanimatie draaien: een bot zonder gebonden vertices (eenarmig) mag
    // geen renderfout of NaN opleveren.
    o.groep.position.set(0, 0, -10);
    try { for (let i = 0; i < 5; i++) d.updateOndoden(0.05); } catch (e) { fout = String(e); }
    uit[profiel] = {
      fout,
      rompBreedte: o.delen.vormParams.rompBreedte,
      armDikte: o.delen.vormParams.armDikteFactor,
      heeftBochel: o.delen.vormParams.heeftBochel,
      heeftArmL: o.delen.armL !== undefined,
      botAantal: o.delen.skeleton.bones.length,
    };
  }
  return uit;
});
check('V2: alle zeven variatieprofielen bouwen en animeren zonder fout',
  Object.values(v2Profielen).every(p => p.fout === null), v2Profielen);
check("V2: 'mager' krijgt rompFactor 0,8 + dunnere armen, 'breed' rompFactor 1,2 (exact VARIATIE_PROFIELEN)",
  v2Profielen.mager.rompBreedte === 0.8 && v2Profielen.mager.armDikte === 0.85 &&
  v2Profielen.breed.rompBreedte === 1.2 && v2Profielen.standaard.rompBreedte === 1, v2Profielen);
check("V2: 'gebocheld' levert daadwerkelijk een bochel op",
  v2Profielen.gebocheld.heeftBochel === true && v2Profielen.standaard.heeftBochel === false, v2Profielen);
check("V2: alleen 'eenarmig' mist delen.armL; het SKELET houdt al zijn botten (een bot zonder gebonden vertices is onschuldig)",
  v2Profielen.eenarmig.heeftArmL === false &&
  Object.entries(v2Profielen).every(([n, p]) => n === 'eenarmig' || p.heeftArmL === true) &&
  Object.values(v2Profielen).every(p => p.botAantal === 9), v2Profielen);

// Regressie-anker: de type-definities zelf mogen door fase 5 NIET zijn
// aangeraakt — dit ticket verandert uitsluitend hoe ze eruitzien.
const typeData = await page.evaluate(() => {
  const t = window.AmsterdamUndeadDebug.ONDODE_TYPES;
  const plat = (x) => ({ s: x.snelheidMultiplier, hp: x.hpMultiplier, hpMax: x.hpMax ?? null, geld: x.geldMultiplier, schaal: x.schaal });
  return { sjouwer: plat(t.sjouwer), brander: plat(t.brander), sluiper: plat(t.sluiper) };
});
check('ONDODE_TYPES.sjouwer ongewijzigd (snelheid 0.55, hp 2.5, hpMax 8, geld 2.2, schaal 1.35)',
  JSON.stringify(typeData.sjouwer) === JSON.stringify({ s: 0.55, hp: 2.5, hpMax: 8, geld: 2.2, schaal: 1.35 }), typeData.sjouwer);
check('ONDODE_TYPES.brander/.sluiper ongewijzigd',
  JSON.stringify(typeData.brander) === JSON.stringify({ s: 1, hp: 1, hpMax: null, geld: 1.3, schaal: 1 }) &&
  JSON.stringify(typeData.sluiper) === JSON.stringify({ s: 1.35, hp: 0.75, hpMax: null, geld: 1.1, schaal: 0.75 }), typeData);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
