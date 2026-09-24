// Ticket D15 (SONNET_EXECUTION_PLAN_monument.md, fase 3; na de review direct
// na D11 uitgevoerd) — bouwfase tussen waves.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// Maakt de lopende wave compleet: geen robots meer, niets meer te spawnen.
const RONDWAVEAF = `(() => {
  const d = window.DamChaosDebug;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
})()`;

// --- 1. Geen spawns, de aftelling loopt, na 20 s start de wave -----------

await page.evaluate(RONDWAVEAF);
const fase = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const waveUI = document.getElementById('waveUI');
  const wave = d.spel.wave;
  const uit = { duur: d.BOUWFASE_DUUR, inFase: d.inBouwfase(), metingen: [] };
  for (let t = 1; t <= 19; t++) {
    d.updateWaveSysteem(1.0);
    uit.metingen.push({ t, robots: d.robots.length, teSpawnen: d.spel.teSpawnen, wave: d.spel.wave, hud: waveUI.textContent });
  }
  d.updateWaveSysteem(1.0);   // tussenWaveTimer ≈ 20,1
  d.updateWaveSysteem(0);     // eerste spawns van de nieuwe wave
  uit.na = { wave: d.spel.wave, robots: d.robots.length, inFase: d.inBouwfase(), startWave: wave };
  return uit;
});
check('De bouwfase duurt 20 s', fase.duur === 20, fase.duur);
check('Na een voltooide wave staat het spel in de bouwfase', fase.inFase, fase);
check('Tijdens 19 s bouwfase spawnt er geen enkele robot en blijft het dezelfde wave',
  fase.metingen.every(m => m.robots === 0 && m.teSpawnen === 0 && m.wave === fase.na.startWave), fase.metingen.map(m => [m.t, m.robots, m.wave]));
check('De aftelling in de HUD loopt af (na ~5 s: "over 15 s")', fase.metingen[4].hud.includes('over 15 s'), fase.metingen[4].hud);
check('...en noemt de G-toets', fase.metingen[4].hud.includes('G = nu starten'), fase.metingen[4].hud);
check('Na 20 s start de volgende wave en komen er robots', fase.na.wave === fase.na.startWave + 1 && fase.na.robots > 0 && !fase.na.inFase, fase.na);

// --- 2. Vroeg starten geeft een bonus ------------------------------------

await page.evaluate(RONDWAVEAF);
const vroeg = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.updateWaveSysteem(5.0);   // tussenWaveTimer ≈ 5,1 → nog ≈ 14,9 s
  const geldVoor = d.geldStand(), verdiendVoor = d.runStats.verdiendGeld, wave = d.spel.wave;
  const verwacht = Math.round(d.bouwfaseResterend() * d.VROEGE_START_BONUS_PER_SECONDE);
  const bonus = d.startVolgendeWaveNu();
  return { bonus, verwacht, geld: d.geldStand() - geldVoor, verdiend: d.runStats.verdiendGeld - verdiendVoor,
    wave: d.spel.wave, startWave: wave, inFase: d.inBouwfase() };
});
check('Vroeg starten na ~5 s: bonus = resterende seconden × €2 (≈ €30)', vroeg.bonus === vroeg.verwacht && vroeg.bonus === 30, vroeg);
check('...de bonus komt bij het geld en telt als verdiend', vroeg.geld === 30 && vroeg.verdiend === 30, vroeg);
check('...en de volgende wave is meteen gestart', vroeg.wave === vroeg.startWave + 1 && !vroeg.inFase, vroeg);

// --- 3. Buiten de bouwfase doet vroeg starten niets ----------------------

const buiten = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.updateWaveSysteem(0);
  const wave = d.spel.wave, geld = d.geldStand();
  const bonus = d.startVolgendeWaveNu();
  return { inFase: d.inBouwfase(), bonus, waveGelijk: d.spel.wave === wave, geldGelijk: d.geldStand() === geld };
});
check('Tijdens een lopende wave doet vroeg starten niets', !buiten.inFase && buiten.bonus === 0 && buiten.waveGelijk && buiten.geldGelijk, buiten);

// --- 4. De G-toets -------------------------------------------------------

await page.evaluate(RONDWAVEAF);
const toets = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const wave = d.spel.wave;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyG' }));
  return { wave: d.spel.wave, startWave: wave, hulp: document.getElementById('hulpUI').textContent };
});
check('G tijdens de bouwfase start de volgende wave', toets.wave === toets.startWave + 1, toets);
// Ticket D35: de hulptekst is ingekort tot één regel ("G volgende wave").
check('De besturingshulp noemt G', toets.hulp.includes('G volgende wave'), toets.hulp);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
