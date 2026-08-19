// Ticket 100 (v0.22, §10.10-beslissing 85): fresnel-rimlight op de ondoden,
// geïnjecteerd via onBeforeCompile in een NIEUWE materiaalfabriek
// (maakOndodeMateriaal()) — die fabriek moest eerst gebouwd worden, want
// §7.9 (materiaal-mutatiediscipline) eist dat onBeforeCompile in de fabriek
// zit, nooit achteraf op een instantie, en maakOndodeModel() maakte tot nu
// toe elke huid-materiaal-instantie los inline aan.
import { openAmsterdamUndead, openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Geen extra Light — dit is pure shaderwerk op het materiaal ---------
const lichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let n = 0;
  d.scene.traverse(o => { if (o.isLight) n++; });
  return n;
});
check('Lichtaantal blijft 28 (1 hemisfeer + 27 point) — de rimlight is geen Light', lichten === 28, { lichten });

// --- 2. De injectie zit UITSLUITEND op ondode-huidmaterialen --------------
const injectie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const NEUTRALE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', NEUTRALE_TRAITS);

  // THREE.Material.onBeforeCompile is bij ELK material standaard al een
  // no-op functie (Three.js' eigen default, niet `undefined`) — een
  // `typeof === 'function'`-check zou dus altijd waar zijn, ongeacht of dit
  // ticket 'm ooit heeft aangeraakt. De echte marker is de INHOUD: alleen
  // materialen die door maakOndodeMateriaal() gebouwd zijn, hebben de
  // `uRimSterkte`-uniform-naam in hun onBeforeCompile-broncode. Ticket 122's
  // V2 `delen.oogMateriaal` is geen echt Material (geen onBeforeCompile) —
  // zo'n object kan per definitie geen eigen injectie dragen.
  const heeftInjectie = (m) => !!m.onBeforeCompile && m.onBeforeCompile.toString().includes('uRimSterkte');

  // Wereldmaterialen: verzamel een steekproef via `wereld` (de group die
  // alle kaartgeometrie bevat, nooit via de ondode-fabriek gebouwd, dus mag
  // NOOIT een onBeforeCompile-injectie hebben).
  const wereldMaterialen = new Set();
  d.wereld.traverse(kind => { if (kind.isMesh && kind.material) wereldMaterialen.add(kind.material); });
  const wereldHeeftInjectie = [...wereldMaterialen].some(heeftInjectie);

  const huidMaterialenHebbenInjectie = o.delen.huidMaterialen.every(heeftInjectie);
  const kernHeeftGeenInjectie = !heeftInjectie(d.kernMateriaal);
  const oogHeeftGeenInjectie = !heeftInjectie(o.delen.oogMateriaal);

  const uit = {
    wereldMaterialenAantal: wereldMaterialen.size,
    wereldHeeftInjectie,
    huidMaterialenAantal: o.delen.huidMaterialen.length,
    huidMaterialenHebbenInjectie,
    kernHeeftGeenInjectie,
    oogHeeftGeenInjectie,
  };
  d.doodOndode(o);
  return uit;
});
check('Geen enkel wereldmateriaal (kaartgeometrie) heeft de rimlight-injectie',
  injectie.wereldMaterialenAantal > 0 && injectie.wereldHeeftInjectie === false, injectie);
check('ALLE per-instance huidmaterialen van een verse ondode hebben de injectie (V2: één hele-lichaam-materiaal)',
  injectie.huidMaterialenAantal > 0 && injectie.huidMaterialenHebbenInjectie, injectie);
check('kernMateriaal (gedeeld, Brander-kern) blijft ongemoeid — geen injectie',
  injectie.kernHeeftGeenInjectie, injectie);
check('oogMateriaal (eigen T89-Signaal-systeem) krijgt geen tweede, overlappende laag',
  injectie.oogHeeftGeenInjectie, injectie);

// --- 3. Rimkleur wijkt zichtbaar af van warm lamplicht én koel maanlicht --
const kleur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const rim = d.RIM_KLEUR;
  return { r: rim.r, g: rim.g, b: rim.b };
});
// Vaste referentiewaarden (0-1, matchend met de hex-kleuren in de bron):
// warm lamplicht 0xffc06a, koel maanlicht 0xc8ddff.
function afstand(a, b) { return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2); }
const lampKleur = { r: 0xff / 255, g: 0xc0 / 255, b: 0x6a / 255 };
const maanKleur = { r: 0xc8 / 255, g: 0xdd / 255, b: 0xff / 255 };
check('RIM_KLEUR wijkt merkbaar af van het warme lamplicht (0xffc06a)',
  afstand(kleur, lampKleur) > 0.3, { kleur, lampKleur, afstand: afstand(kleur, lampKleur) });
check('RIM_KLEUR wijkt merkbaar af van het koele maanlicht (0xc8ddff)',
  afstand(kleur, maanKleur) > 0.3, { kleur, maanKleur, afstand: afstand(kleur, maanKleur) });

// --- 4. Functioneel bewijs: de gedeelde sterkte-uniform doet echt iets ----
// (RIM_UNIFORMS.sterkte op 0 vs. een uitvergrote waarde, zelfde bevroren
// standpunt, met een ondode er middenin) — zelfde toggle-techniek als T96's
// uSterkte-test.
const { browser: vBrowser, page: vPage } = await openVoorVisueleMeting();
const punten = await berekenVisueleStandpunten(vPage);
const woonkamer = punten.find(p => p.naam === 'woonkamer');
await vPage.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const NEUTRALE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
  const o = d.spawnOndode(0, 'normaal', NEUTRALE_TRAITS);
  o.groep.position.set(0, 0, -2);
  d.RIM_UNIFORMS.sterkte.value = 0;
});
await zetVisueelStandpunt(vPage, woonkamer);
const schermUit = await vPage.screenshot({ type: 'png' });
await vPage.evaluate(() => { window.AmsterdamUndeadDebug.RIM_UNIFORMS.sterkte.value = 4; });
await zetVisueelStandpunt(vPage, woonkamer);
const schermAan = await vPage.screenshot({ type: 'png' });
check('RIM_UNIFORMS.sterkte = 0 vs. uitvergroot: het beeld verandert aantoonbaar (de gedeelde uniform stuurt echt het materiaal aan)',
  !schermUit.equals(schermAan), { bytesUit: schermUit.length, bytesAan: schermAan.length });
await vPage.evaluate(() => { window.AmsterdamUndeadDebug.RIM_UNIFORMS.sterkte.value = window.AmsterdamUndeadDebug.RIM_STERKTE_BASIS; });
await vBrowser.close();

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
