// Ticket 114 (v0.22, §10.14-beslissing 89): levend water — vertex-deining
// + gebroken specular op waterMesh (via onBeforeCompile, geen tweede
// scene-render/Reflector), boot die meedeint bovenop updateBootPositie(),
// en een fake lantaarnstreep i.p.v. een echte reflectie.
import { openAmsterdamUndead, openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Structuur: waterMesh is gesubdivideerd (anders is de vertex-
// deining onzichtbaar — een kale PlaneGeometry heeft maar 4 hoekpunten),
// en het materiaal is een MeshStandardMaterial met een geïnjecteerde
// onBeforeCompile (geen losse ShaderMaterial — dat zou fog/lichtrespons
// opnieuw met de hand moeten regelen, zie de T110-postmortem).
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    vertexCount: d.waterMesh.geometry.attributes.position.count,
    isStandardMaterial: d.waterMateriaal.isMeshStandardMaterial,
    heeftOnBeforeCompile: typeof d.waterMateriaal.onBeforeCompile === 'function',
    fog: d.waterMateriaal.fog,
  };
});
check('waterMesh is gesubdivideerd (veel meer dan 4 hoekpunten)', structuur.vertexCount > 100, structuur);
check('waterMateriaal is een MeshStandardMaterial (geen losse ShaderMaterial)', structuur.isStandardMaterial, structuur);
check('waterMateriaal heeft een onBeforeCompile-injectie', structuur.heeftOnBeforeCompile, structuur);
check('waterMateriaal houdt fog aan (standaard, niet expliciet uitgezet)', structuur.fog !== false, structuur);

// --- 2. Na minstens één render is de shader gecompileerd en heeft
// userData.shader een uTijd-uniform die updateWaterAnimatie() daadwerkelijk
// bijwerkt. `onBeforeCompile` vuurt pas bij de EERSTE keer dat het
// materiaal daadwerkelijk getekend wordt — de speler start in de
// woonkamer, ver van de gracht, dus eerst naar het grachtstandpunt lopen
// (camera moet waterMesh echt in beeld hebben) vóór de render-wachtlus.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set((d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2, 0, d.BIJKEUKEN_CZ);
  d.speler.yaw = -Math.PI / 2;
});
await frames(page, 3);
const uniformTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateWaterAnimatie(7.5);
  return {
    heeftShader: !!d.waterMateriaal.userData.shader,
    uTijd: d.waterMateriaal.userData.shader?.uniforms?.uTijd?.value,
  };
});
check('Na minstens één render bestaat waterMateriaal.userData.shader (onBeforeCompile is gevuurd)', uniformTest.heeftShader, uniformTest);
check('updateWaterAnimatie(7.5) zet het uTijd-uniform op 7.5', uniformTest.uTijd === 7.5, uniformTest);

// --- 3. golfHoogte(): de drie sinustermen (JS-spiegel van de GLSL) blijven
// binnen de opgegeven amplitude, en de golven mogen NOOIT boven de
// vlonderrand uitkomen (water op y=-0,05, obstakel-top rond y=0,4 — een
// ruime marge van >0,3 is geëist, ver voorbij wat de amplitude ooit kan
// bereiken).
const golfTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let max = -Infinity, min = Infinity;
  for (let x = -5; x <= 5; x += 0.5) {
    for (let z = -3; z <= 3; z += 0.5) {
      for (let t = 0; t < 20; t += 1.3) {
        const h = d.golfHoogte(x, z, t);
        if (h > max) max = h;
        if (h < min) min = h;
      }
    }
  }
  return { max, min };
});
check('golfHoogte() blijft binnen een kleine, verwachte amplitude (|h| < 0,07)',
  golfTest.max < 0.07 && golfTest.min > -0.07, golfTest);
check('De golfhoogte houdt het water ruim (>0,3m marge) onder de vlonderrand-top (±0,07 << 0,4)',
  golfTest.max < 0.4 - 0.3, golfTest);

// --- 4. Determinisme: dezelfde (x, z, klok) geeft altijd dezelfde hoogte
// (geen Math.random() in de golfformule).
const determinisme = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = d.golfHoogte(1.23, -0.45, 6.7);
  const b = d.golfHoogte(1.23, -0.45, 6.7);
  return a === b;
});
check('golfHoogte(x, z, t) is een zuivere functie — twee aanroepen met dezelfde argumenten geven exact hetzelfde resultaat', determinisme, determinisme);

// --- 5. Boot-deining: bootGroep.position.y/rotation.z veranderen mee met
// updateWaterAnimatie(klok), gestapeld BOVENOP updateBootPositie()'s
// x-only writes (niet in plaats daarvan) — de architectuureis.
const bootTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const xVoor = d.bootGroep.position.x;
  d.updateWaterAnimatie(0);
  const y0 = d.bootGroep.position.y, rot0 = d.bootGroep.rotation.z;
  d.updateWaterAnimatie(3.3);
  const y1 = d.bootGroep.position.y, rot1 = d.bootGroep.rotation.z;
  d.updateBootPositie();   // moet alleen x aanraken
  const xNa = d.bootGroep.position.x, yNaBootPositie = d.bootGroep.position.y;
  return { xVoor, xNa, y0, y1, rot0, rot1, yNaBootPositie };
});
check('bootGroep.position.y verandert mee met de klok (echte deining, geen statische 0)', bootTest.y0 !== bootTest.y1, bootTest);
check('bootGroep.rotation.z verandert mee met de klok (lichte kanteling)', bootTest.rot0 !== bootTest.rot1, bootTest);
check('updateBootPositie() laat bootGroep.position.y ONGEMOEID (raakt alleen x aan — de deining stapelt, wordt niet overschreven)',
  bootTest.yNaBootPositie === bootTest.y1, bootTest);

// --- 6. Reflectiestreep: een platte, transparante quad met vertex colors
// (geen canvas-textuur), depthWrite:false, op het wateroppervlak, en
// wobbelt mee met updateWaterAnimatie(klok).
const streepTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const m = d.reflectieStreepMesh;
  d.updateWaterAnimatie(0);
  const rot0 = m.rotation.z;
  d.updateWaterAnimatie(4.1);
  const rot1 = m.rotation.z;
  return {
    isBasicMaterial: m.material.isMeshBasicMaterial,
    vertexColors: m.material.vertexColors,
    transparent: m.material.transparent,
    depthWrite: m.material.depthWrite,
    heeftKleurAttribuut: !!m.geometry.getAttribute('color'),
    rot0, rot1,
  };
});
check('reflectieStreepMesh gebruikt MeshBasicMaterial met vertexColors (geen canvas-textuur)',
  streepTest.isBasicMaterial && streepTest.vertexColors === true, streepTest);
check('reflectieStreepMesh is transparant met depthWrite:false (zelfde conventie als de lichtvlekken)',
  streepTest.transparent && streepTest.depthWrite === false, streepTest);
check('reflectieStreepMesh heeft een eigen color-attribuut (het handgetekende verloop)', streepTest.heeftKleurAttribuut, streepTest);
check('reflectieStreepMesh wobbelt mee met de klok ("vervormt met de golfnormaal")', streepTest.rot0 !== streepTest.rot1, streepTest);

// --- 7. Determinisme onder visuele meting: klok bevriest tijdens
// openVoorVisueleMeting(), dus twee metingen op hetzelfde standpunt geven
// bit-voor-bit dezelfde screenshot — zelfde patroon als T111/T113.
const { browser: vBrowser, page: vPage } = await openVoorVisueleMeting();
const punten = await berekenVisueleStandpunten(vPage);
const gracht = punten.find(p => p.naam === 'gracht');
// Opwarmronde (Fix 1, ronde 9 — water bleed): dit is een VERSE pagina, dus
// dokwaterMateriaal (het aparte watervlak naast de vlonder, elk met een
// eigen onBeforeCompile-injectie) heeft hier nog nooit gerenderd. Onder
// zware CPU-belasting bleek één zetVisueelStandpunt() (3 frames) soms niet
// genoeg om de lazy shader-compile van BEIDE watermaterialen vóór de eerste
// meting te laten landen — dan verschilde meting1 (nog compilerend) van
// meting2 (al klaar). Eén extra, ongemeten warm-up-ronde eerst voorkomt dat:
// beide materialen zijn dan al lang klaar tegen de tijd dat de twee
// vergeleken screenshots genomen worden.
await zetVisueelStandpunt(vPage, gracht);
await zetVisueelStandpunt(vPage, gracht);
const meting1 = await vPage.screenshot({ type: 'png' });
await zetVisueelStandpunt(vPage, gracht);
const meting2 = await vPage.screenshot({ type: 'png' });
check('Twee metingen op het grachtstandpunt geven bit-voor-bit dezelfde screenshot (water/boot/streep bevriezen mee)',
  Buffer.compare(meting1, meting2) === 0, { gelijk: Buffer.compare(meting1, meting2) === 0 });
await vBrowser.close();

// --- 8. Geen enkele pageerror over meerdere echte frames (dezelfde
// proactieve shader-crash-check als na elke nieuwe ShaderMaterial/
// onBeforeCompile-injectie deze ronde — zie de T110-postmortem).
await frames(page, 6);
check('Zes echte frames met het levende water actief geven geen enkele pageerror', errs.length === 0, { fouten: errs.slice() });

// --- 9. Ronde-brede invarianten: geen nieuw lichttype, geen extra
// obstakel/interactiepunt — puur decoratief/materiaalwerk.
const invarianten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0;
  d.scene.traverse((k) => { if (k.isLight) lichten++; });
  return { lichten, obstakels: d.obstakels.length, interactiePunten: d.interactiePunten.length };
});
check('Lichttelling blijft op 28', invarianten.lichten === 28, invarianten);
check('obstakels.length blijft 58 (T131-baseline)', invarianten.obstakels === 58, invarianten);
check('interactiePunten.length blijft 14 (Ticket 134: AMSTEL-9)', invarianten.interactiePunten === 14, invarianten);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
