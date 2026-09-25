// Ticket D21 (SONNET_EXECUTION_PLAN_monument.md) — kwaliteitsinstellingen.
//
// Laag/Normaal/Hoog, gekozen op het startscherm en bewaard in localStorage.
// Deze test bewaakt: de standaard (hoog op desktop, laag op een apparaat met
// grove aanwijzer), dat een bewaarde keuze bij het LADEN al geldt, dat een
// corrupte sleutel stil terugvalt, en dat één klik op een knop runtime
// omschakelt en de keuze bewaart.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
const KEY = 'defendNationalMonumentKwaliteit';

const stand = page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const mensen = d.straatmeubilair.children.find(m => m.name === 'mensen');
  let bewaard = null;
  try { bewaard = localStorage.getItem('defendNationalMonumentKwaliteit'); } catch { /* */ }
  return {
    kwaliteit: d.kwaliteitStand(),
    schaduwen: d.renderer.shadowMap.enabled,
    schaduwResolutie: d.zon.shadow.mapSize.x,
    antialias: d.renderer.getContext().getContextAttributes().antialias,
    pixelRatio: d.renderer.getPixelRatio(),
    duiven: d.duiven.length,
    duivenInScene: d.duiven.filter(x => x.groep.parent).length,
    toeristen: mensen?.visible,
    knopActief: document.querySelector('#kwaliteitKeuze .actief')?.dataset.kwaliteit,
    knoppen: document.querySelectorAll('#kwaliteitKeuze [data-kwaliteit]').length,
    bewaard,
  };
});

async function met(opties, fn) {
  const { browser, page, errs } = await openDefend(opties);
  try { await fn(page); } finally { alleErrs.push(...errs); await browser.close(); }
}
const bewaar = waarde => ({ initScript: `try { localStorage.setItem('${KEY}', ${JSON.stringify(waarde)}); } catch {}` });

// 1. Desktop zonder keuze: hoog.
await met({}, async page => {
  const s = await stand(page);
  check('Drie knoppen op het startscherm, Hoog is actief', s.knoppen === 3 && s.knopActief === 'hoog', s);
  check('Desktop zonder keuze: hoog (schaduwen aan, 2048, anti-aliasing, 18 duiven, toeristen)', s.kwaliteit === 'hoog' && s.schaduwen && s.schaduwResolutie === 2048 && s.antialias && s.duiven === 18 && s.toeristen === true, s);

  // 4. Eén klik op Laag schakelt runtime om en bewaart de keuze.
  await page.click('#kwaliteitKeuze [data-kwaliteit="laag"]');
  const na = await stand(page);
  check('Klik op Laag: schaduwen uit, 6 duiven (ook uit de scene), toeristen weg, pixelratio ≤ 0,75', na.kwaliteit === 'laag' && !na.schaduwen && na.duiven === 6 && na.duivenInScene === 6 && na.toeristen === false && na.pixelRatio <= 0.75, na);
  check('De keuze is bewaard en de knop is actief', na.bewaard === 'laag' && na.knopActief === 'laag', na);
  const zichtbaar = await page.evaluate(() => getComputedStyle(document.getElementById('startscherm')).display !== 'none');
  check('De klik op een kwaliteitsknop start het spel niet', zichtbaar, zichtbaar);
  // En weer terug: alles herstelt.
  await page.click('#kwaliteitKeuze [data-kwaliteit="hoog"]');
  const terug = await stand(page);
  check('Terug naar Hoog: schaduwen, 2048, 18 duiven en toeristen weer terug', terug.schaduwen && terug.schaduwResolutie === 2048 && terug.duiven === 18 && terug.duivenInScene === 18 && terug.toeristen === true, terug);
  const nog = await page.evaluate(() => { window.DamChaosDebug.renderer.render(window.DamChaosDebug.scene, window.DamChaosDebug.camera); return window.DamChaosDebug.renderer.info.render.calls; });
  check('Na het wisselen rendert de scene gewoon', nog > 0, nog);
});

// 2. Bewaarde keuze 'laag' geldt al bij het laden, ook voor anti-aliasing.
await met(bewaar('laag'), async page => {
  const s = await stand(page);
  check('Bewaard laag: bij het laden schaduwen uit, geen anti-aliasing, 6 duiven, geen toeristen', s.kwaliteit === 'laag' && !s.schaduwen && !s.antialias && s.duiven === 6 && s.toeristen === false && s.knopActief === 'laag', s);
});

// 2b. Bewaarde keuze 'normaal'.
await met(bewaar('normaal'), async page => {
  const s = await stand(page);
  check('Bewaard normaal: schaduwen 1024, 12 duiven, pixelratio ≤ 1', s.kwaliteit === 'normaal' && s.schaduwen && s.schaduwResolutie === 1024 && s.duiven === 12 && s.pixelRatio <= 1, s);
});

// 3. Corrupte sleutel: stille terugval naar de standaard.
await met(bewaar('ultra{kapot'), async page => {
  const s = await stand(page);
  check('Corrupte sleutel: terugval naar hoog, zonder fout', s.kwaliteit === 'hoog' && s.knopActief === 'hoog', s);
});

// 5. Grove aanwijzer (telefoon/tablet) zonder keuze: laag; een bewaarde keuze wint.
const mobiel = { isMobile: true, hasTouch: true, viewport: { width: 640, height: 400 } };
await met({ contextOpties: mobiel }, async page => {
  const grof = await page.evaluate(() => matchMedia('(pointer: coarse) and (hover: none)').matches);
  const s = await stand(page);
  check('Grove aanwijzer zonder keuze: laag', grof && s.kwaliteit === 'laag', { grof, ...s });
});
await met({ contextOpties: mobiel, ...bewaar('hoog') }, async page => {
  const s = await stand(page);
  check('Grove aanwijzer met bewaarde keuze hoog: de keuze wint', s.kwaliteit === 'hoog', s);
});

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
