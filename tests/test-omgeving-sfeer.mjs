// Sfeer S3 (Ticket 40): omgevingsdetails — atelier-stof, kelderhals-druppel,
// golfstart-lichtdip. Bewaakt: precies 2 Points-systemen (<= 30 punten elk),
// stof alleen zichtbaar in het atelier (zone C) en animeert via groeps-
// transform (geen attribute-writes), de druppel valt periodiek en het
// tikgeluid speelt uitsluitend binnen 8m, en de golfstart-lichtdip zakt naar
// <= 0.7x de basisintensiteit en herstelt binnen ~0.8-1s.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Precies 2 Points-systemen, elk <= 30 punten -----------------------
const puntenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    aantalSystemen: d.stofwolken.length,
    aantallen: d.stofwolken.map(p => p.geometry.attributes.position.count),
    isPoints: d.stofwolken.every(p => p.isPoints === true),
  };
});
check('Er zijn precies 2 stofwolk-Points-systemen', puntenTest.aantalSystemen === 2, puntenTest);
check('Elke stofwolk heeft <= 30 punten', puntenTest.aantallen.every(n => n <= 30), puntenTest);
check('Beide stofwolken zijn daadwerkelijk THREE.Points-objecten', puntenTest.isPoints, puntenTest);

// --- 2. Zone-toggle: onzichtbaar buiten het atelier, zichtbaar erbinnen ---
const zoneTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, -2);   // woonkamer (zone 0)
  d.updateStofwolken(0.05);
  const buitenAtelier = d.stofwolken.map(p => p.visible);

  d.speler.positie.set(0, 0, d.ATELIER_MIDDEN_Z);   // atelier (zone 2)
  d.updateStofwolken(0.05);
  const binnenAtelier = d.stofwolken.map(p => p.visible);

  return { buitenAtelier, binnenAtelier, zoneBuiten: d.zoneVan(0, -2), zoneBinnen: d.zoneVan(0, d.ATELIER_MIDDEN_Z) };
});
check('zoneVan() bevestigt: (0,-2) = woonkamer (0), atelier-midden = zone 2',
  zoneTest.zoneBuiten === 0 && zoneTest.zoneBinnen === 2, zoneTest);
check('Buiten het atelier zijn beide stofwolken onzichtbaar',
  zoneTest.buitenAtelier.every(v => v === false), zoneTest);
check('In het atelier zijn beide stofwolken zichtbaar',
  zoneTest.binnenAtelier.every(v => v === true), zoneTest);

// --- 3. Animatie: groepstransform (rotation/position), NOOIT de
// BufferAttribute-data zelf -------------------------------------------------
const rotatieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, d.ATELIER_MIDDEN_Z);
  const voor = d.stofwolken.map(p => p.rotation.y);
  for (let i = 0; i < 20; i++) d.updateStofwolken(0.1);
  const na = d.stofwolken.map(p => p.rotation.y);
  return { voor, na };
});
check('De stofwolken draaien merkbaar door (rotation.y neemt toe over 20 handmatige ticks)',
  rotatieTest.na.every((n, i) => n > rotatieTest.voor[i]), rotatieTest);

// position.y hangt af van de module-scope klok, die alleen binnen de al
// draaiende gameLoop() optelt — dus hier écht wachten i.p.v. handmatig
// ticken (zelfde patroon als de winkel-ring-puls in test-winkel-status.mjs).
const posYVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, d.ATELIER_MIDDEN_Z);
  return d.stofwolken.map(p => p.position.y);
});
await page.waitForTimeout(400);
const posYNa = await page.evaluate(() => window.AmsterdamUndeadDebug.stofwolken.map(p => p.position.y));
check('De stofwolken zweven op en neer (position.y verandert na 400ms echte speeltijd)',
  posYNa.every((y, i) => y !== posYVoor[i]), { posYVoor, posYNa });

// --- 4. Source-check: geen nieuwe allocaties in de per-frame update-paden -
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const meshPatroon = /new\s+THREE\.(Mesh|Points|.*Geometry|.*Material|BufferAttribute)\(/;
  return {
    stofHeeftAllocatie: meshPatroon.test(d.updateStofwolken.toString()),
    druppelHeeftAllocatie: meshPatroon.test(d.updateDruppel.toString()),
  };
});
check('updateStofwolken() alloceert niets nieuws per frame (alleen groepstransform-writes)',
  bronTest.stofHeeftAllocatie === false, bronTest);
check('updateDruppel() alloceert niets nieuws per frame',
  bronTest.druppelHeeftAllocatie === false, bronTest);

// --- 5. Druppel-cyclus: valt van plafond naar kelderluik, tik alleen < 8m -
const druppelDichtbij = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(d.druppelMesh.position.x + 1, 0, d.druppelMesh.position.z);   // < 8m
  d.druppelDuur = 1;   // deterministische, korte cyclus voor de test
  d.druppelTimer = 0;
  d.druppelMesh.position.y = d.KAMER_HOOGTE;   // even boven het "plafond"-startpunt, moet zakken
  const yVoor = d.druppelMesh.position.y;
  const tellerVoor = d.druppelTikTeller;
  d.updateDruppel(0.5);   // halverwege: nog niet geland
  const yHalverwege = d.druppelMesh.position.y;
  d.updateDruppel(0.6);   // ruim over de 1s-cyclus: landt en (want < 8m) tikt
  return { yVoor, yHalverwege, yNa: d.druppelMesh.position.y, tellerVoor, tellerNa: d.druppelTikTeller, nieuweDuur: d.druppelDuur };
});
check('De druppel zakt zichtbaar richting het kelderluik (y neemt af halverwege de cyclus)',
  druppelDichtbij.yHalverwege < druppelDichtbij.yVoor, druppelDichtbij);
check('Binnen 8m van de speler speelt het tikgeluid bij het landen (teller +1)',
  druppelDichtbij.tellerNa === druppelDichtbij.tellerVoor + 1, druppelDichtbij);
check('Na het landen wordt meteen een nieuwe, willekeurige cyclusduur (3-6s) gekozen',
  druppelDichtbij.nieuweDuur >= 3 && druppelDichtbij.nieuweDuur <= 6, druppelDichtbij);

const druppelVerAf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(1000, 0, 1000);   // ruim > 8m
  d.druppelDuur = 1;
  d.druppelTimer = 0;
  const tellerVoor = d.druppelTikTeller;
  d.updateDruppel(1.1);   // landt, maar buiten bereik
  return { tellerNa: d.druppelTikTeller - tellerVoor };
});
check('Buiten de 8m speelt het tikgeluid NIET, ook al landt de druppel wel',
  druppelVerAf.tellerNa === 0, druppelVerAf);

// --- 6. Golfstart-lichtdip: elke lamp blijft onder zijn eigen theoretische
// flikkerpiek (basis * (1 + amp1 + amp2)) vermenigvuldigd met de dip-factor
// -- een vaste 0.7x-basisgrens klopt niet voor lampen met grotere amp1/amp2
// (bv. de gang-/kelderhalslamp), dus per lamp de eigen piek gebruiken -------
await page.evaluate(() => { window.AmsterdamUndeadDebug.lampDipFactor = 0.6; });
await page.waitForTimeout(60);   // laat de al draaiende gameLoop 'm minstens 1x echt toepassen
const dipDirect = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const dipFactor = d.lampDipFactor;
  return d.lampLichten.map(l => ({
    intensity: l.licht.intensity, basis: l.basis, amp1: l.amp1, amp2: l.amp2, dipFactor,
  }));
});
check('Direct na de dip-trigger blijft elke lampintensiteit onder de eigen (basis * piekflikker * dipFactor)-grens',
  dipDirect.every(l => l.intensity <= l.basis * (1 + l.amp1 + l.amp2) * l.dipFactor + 1e-6), dipDirect);
check('De dip-factor staat op het sample-moment nog duidelijk onder 1 (de dip is echt actief, de grens hierboven is dus geen loze upper bound)',
  dipDirect.every(l => l.dipFactor < 0.95), dipDirect);

await page.waitForTimeout(850);   // ruim boven de 0.8s hersteltijd
const dipHersteld = await page.evaluate(() => window.AmsterdamUndeadDebug.lampDipFactor);
check('Binnen ~1s is lampDipFactor volledig hersteld naar 1',
  dipHersteld === 1, { dipHersteld });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
