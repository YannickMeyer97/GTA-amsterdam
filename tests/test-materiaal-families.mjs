// Sfeer S1 (Ticket 38): materiaal-families + impactkleuren. Bewaakt:
// matFamilie() geeft een cache-hit terug (geen ongelimiteerde groei),
// userData.materiaalFamilie staat op de acht gemigreerde oppervlakken
// (binnenplaats-klinkers, bijkeuken-vloer, gang-vloer, kelderluik, de 4
// deur-panelen + hun klinken), geen enkele kleur is veranderd (alleen
// roughness/metalness), de binnenplaats is zichtbaar glanzender dan de
// gang-vloer, en een wereld-impact op hout geeft een andere deeltjeskleur
// dan op steen.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): een sectie hieronder gebruikt d.schiet() om een echte
// wereld-impact te produceren — eerst een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

// --- 1. Cache-identiteit: geen groei bij herhaald aanroepen ---------------
const cacheTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const maatVoor = d.matFamilieCache.size;
  const m1 = d.matFamilie('steen', 0x123456);
  const m2 = d.matFamilie('steen', 0x123456);
  const maatNa1 = d.matFamilieCache.size;
  for (let i = 0; i < 20; i++) d.matFamilie('steen', 0x123456);
  const maatNa20 = d.matFamilieCache.size;
  return { zelfdeInstantie: m1 === m2, maatVoor, maatNa1, maatNa20 };
});
check('matFamilie(naam, kleur) geeft bij dezelfde argumenten exact hetzelfde material terug (cache-hit)',
  cacheTest.zelfdeInstantie, cacheTest);
check('De cache groeit met precies 1 entry na de EERSTE nieuwe (familie,kleur)-combinatie',
  cacheTest.maatNa1 === cacheTest.maatVoor + 1, cacheTest);
check('20 herhaalde aanroepen met dezelfde argumenten laten de cache niet verder groeien',
  cacheTest.maatNa20 === cacheTest.maatNa1, cacheTest);

// --- 2. userData.materiaalFamilie + ongewijzigde kleuren op de acht
// gemigreerde oppervlakken --------------------------------------------------
const oppervlakken = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const meet = (mesh) => ({ familie: mesh.userData.materiaalFamilie, kleur: mesh.material.color.getHex() });
  return {
    klinkers: meet(d.klinkersMesh),
    bijkeukenVloer: meet(d.bijkeukenVloerMesh),
    gangVloer: meet(d.gangVloerMesh),
    kelderluik: meet(d.kelderluikMesh),
    deur1: meet(d.deurMesh), deur1Klink: meet(d.deurKlink),
    deur2: meet(d.deur2Mesh), deur2Klink: meet(d.deur2Klink),
    deur3: meet(d.deur3Mesh), deur3Klink: meet(d.deur3Klink),
    deur4: meet(d.deur4Mesh), deur4Klink: meet(d.deur4Klink),
  };
});
check('Binnenplaats-klinkers: familie natSteen, kleur ongewijzigd (0x3a4650)',
  oppervlakken.klinkers.familie === 'natSteen' && oppervlakken.klinkers.kleur === 0x3a4650, oppervlakken.klinkers);
check('Bijkeuken-vloer: familie tegel, kleur ongewijzigd (0x35424a)',
  oppervlakken.bijkeukenVloer.familie === 'tegel' && oppervlakken.bijkeukenVloer.kleur === 0x35424a, oppervlakken.bijkeukenVloer);
check('Gang-vloer: familie steen, kleur ongewijzigd (0x1c1a16)',
  oppervlakken.gangVloer.familie === 'steen' && oppervlakken.gangVloer.kleur === 0x1c1a16, oppervlakken.gangVloer);
check('Kelderluik: familie hout, kleur ongewijzigd (0x2a241d)',
  oppervlakken.kelderluik.familie === 'hout' && oppervlakken.kelderluik.kleur === 0x2a241d, oppervlakken.kelderluik);
check('Deur 1-paneel: familie hout, kleur ongewijzigd (0x5a3a1e); klink: familie metaal, kleur ongewijzigd (0xd8c47a)',
  oppervlakken.deur1.familie === 'hout' && oppervlakken.deur1.kleur === 0x5a3a1e &&
  oppervlakken.deur1Klink.familie === 'metaal' && oppervlakken.deur1Klink.kleur === 0xd8c47a, oppervlakken);
check('Deur 2/3/4-panelen: familie hout, kleur ongewijzigd (0x4a5058)',
  [oppervlakken.deur2, oppervlakken.deur3, oppervlakken.deur4].every(d => d.familie === 'hout' && d.kleur === 0x4a5058), oppervlakken);
check('Deur 2/3/4-klinken: familie metaal (kleuren per deur ongewijzigd)',
  [oppervlakken.deur2Klink, oppervlakken.deur3Klink, oppervlakken.deur4Klink].every(k => k.familie === 'metaal'), oppervlakken);

// --- 3. Binnenplaats (natSteen) is zichtbaar glanzender (lagere roughness)
// dan de gang-vloer (steen) — screenshotvergelijking-proxy ------------------
const glans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { binnenplaats: d.klinkersMesh.material.roughness, gang: d.gangVloerMesh.material.roughness };
});
check('De binnenplaats-vloer heeft een merkbaar lagere roughness dan de gang-vloer',
  glans.binnenplaats < glans.gang - 0.2, glans);

// --- 4. Impactkleur per familie: hout != steen, en beide kloppen met
// MATERIAAL_KLEUREN[familie] ------------------------------------------------
function raakRechtNaarBenedenCode(x, z, hoogte) {
  return `
    const d = window.AmsterdamUndeadDebug;
    d.actieveEffecten.length = 0;
    for (const slot of d.impactPool) { slot.actief = false; slot.mesh.visible = false; }
    d.speler.positie.set(${x}, ${hoogte}, ${z});
    d.speler.yaw = 0;
    d.speler.pitch = -Math.PI / 2 + 0.001;   // recht naar beneden
    d.camera.position.set(${x}, ${hoogte}, ${z});
    d.camera.rotation.y = d.speler.yaw;
    d.camera.rotation.x = d.speler.pitch;
    d.camera.updateMatrixWorld(true);
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
    d.wapenStaat.herladen = false;
    d.schiet();
    const impact = d.actieveEffecten.filter(e => e.soort === 'impact').slice(-1)[0];
    return { kleur: impact ? impact.slot.mesh.material.color.getHex() : null };
  `;
}
// Kelderluik-positie direct opvragen i.p.v. hardcoden (afhankelijk van
// de KELDERHALS-constantes).
const kelderluikPos = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { x: d.kelderluikMesh.position.x, z: d.kelderluikMesh.position.z };
});
const houtImpact2 = await page.evaluate(new Function(raakRechtNaarBenedenCode(kelderluikPos.x, kelderluikPos.z, 1.7)));
const gangPos = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { x: d.gangVloerMesh.position.x, z: d.gangVloerMesh.position.z };
});
const steenImpact = await page.evaluate(new Function(raakRechtNaarBenedenCode(gangPos.x, gangPos.z, 1.7)));

const kleuren = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { hout: d.MATERIAAL_KLEUREN.hout, steen: d.MATERIAAL_KLEUREN.steen };
});
check('Een schot recht op het kelderluik geeft de hout-impactkleur',
  houtImpact2.kleur === kleuren.hout, { houtImpact2, kleuren });
check('Een schot recht op de gang-vloer geeft de steen-impactkleur',
  steenImpact.kleur === kleuren.steen, { steenImpact, kleuren });
check('Hout- en steen-impactkleur verschillen van elkaar',
  houtImpact2.kleur !== steenImpact.kleur, { houtImpact2, steenImpact });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
