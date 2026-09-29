// Ticket D30 (SONNET_EXECUTION_PLAN_monument.md §10, fase 3) — themagolven.
//
// Afwijking van de tickettekst, bewust: themagolven starten bij wave 6, niet
// bij 4. Waves 2–5 introduceren elk een nieuw robottype (wave 4 = de bomber);
// een tank-themagolf op wave 4 zou die introductie overschrijven.
// Ticket D55: binnen de run van 15 waves liggen de thema's vast op 7, 9 en
// 12 (om de baaswaves 5, 10 en 15 heen); daarna weer om de 4, vanaf 18.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const LEEG = `(() => { const d = window.DamChaosDebug; for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); } })()`;

// --- 1. Welke waves, welk thema, in welke volgorde ------------------------

const rooster = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  for (let w = 1; w <= 26; w++) { const s = d.themaSleutelVoorWave(w); if (s) uit[w] = s; }
  return uit;
});
check('Alleen waves 7, 9, 12, 18, 22, 26 zijn themagolven (D55)',
  Object.keys(rooster).join() === '7,9,12,18,22,26', rooster);
check('Thema’s rouleren in vaste volgorde: Tankkonvooi, Spitsuur, Grachtenmist, en dan opnieuw',
  JSON.stringify(Object.values(rooster)) === JSON.stringify(['tankkonvooi', 'spitsuur', 'grachtenmist', 'tankkonvooi', 'spitsuur', 'grachtenmist']), rooster);

// --- 2. Elk thema: overrides gelden, en alleen voor die wave ---------------

async function startEnMeet(wave) {
  await page.evaluate(LEEG);
  return page.evaluate((wave) => {
    const d = window.DamChaosDebug;
    d.spel.volgendePoorten = [];
    d.startWave(wave);
    d.spel.maxActieveRobots = 30;
    d.updateWaveSysteem(0);
    const typen = [...new Set(d.robots.map(r => r.type))];
    const uit = {
      wave, thema: d.spel.thema, waveDoel: d.spel.waveDoel, basisDoel: d.waveBasisAantal(wave),
      poorten: d.spel.actievePoorten.length, typen, aantalGespawnd: d.robots.length,
      banner: document.getElementById('waveBanner').textContent,
      mist: { kleur: d.scene.fog.color.getHex(), near: d.scene.fog.near, far: d.scene.fog.far, achtergrond: d.scene.background.getHex() },
      basisMist: { ...d.MIST_BASIS },
    };
    return uit;
  }, wave);
}

const w7 = await startEnMeet(7);
check('Wave 7 = Tankkonvooi: alleen tanks, half zoveel robots, via één poort', w7.thema === 'tankkonvooi' && w7.typen.join() === 'tank' && w7.waveDoel === Math.round(w7.basisDoel * 0.5) && w7.poorten === 1, w7);
check('...met een eigen banner "Wave 7: Tankkonvooi!"', w7.banner.startsWith('Wave 7: Tankkonvooi!'), w7.banner);
const w8 = await startEnMeet(8);
check('Wave 8 is weer normaal: geen thema, normale aantallen, gemengde typen, twee poorten', w8.thema === null && w8.waveDoel === w8.basisDoel && w8.typen.length > 1 && w8.poorten === 2, w8);

const w9 = await startEnMeet(9);
check('Wave 9 = Spitsuur: alleen sprinters, 1,3× zoveel robots, via één poort', w9.thema === 'spitsuur' && w9.typen.join() === 'sprinter' && w9.waveDoel === Math.round(w9.basisDoel * 1.3) && w9.poorten === 1, w9);

const w12 = await startEnMeet(12);
check('Wave 12 = Grachtenmist: normale mix en aantallen, drie poorten (D67: vanaf wave 11)', w12.thema === 'grachtenmist' && w12.typen.length > 1 && w12.waveDoel === w12.basisDoel && w12.poorten === 3, w12);
check('...de mist trekt dicht (zicht ~38 m, lucht in mistkleur)', w12.mist.far === 38 && w12.mist.near === 6 && w12.mist.achtergrond === w12.mist.kleur && w12.mist.far < w12.basisMist.far, w12.mist);
const w15 = await startEnMeet(15);
check('Wave 15: de mist is exact terug op de basiswaarden', JSON.stringify(w15.mist) === JSON.stringify(w15.basisMist), { mist: w15.mist, basis: w15.basisMist });

// --- 3. Bonus en aankondiging ---------------------------------------------

await page.evaluate(LEEG);
const bonus = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const meetBonus = (wave) => {
    d.spel.volgendePoorten = [];
    d.startWave(wave);
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.spel.teSpawnen = 0;
    d.spel.waveGeenMonumentSchade = false;   // perfect-bonus buiten beschouwing
    const voor = d.runStats.verdiendGeld;
    d.updateWaveSysteem(0.1);
    return d.runStats.verdiendGeld - voor;
  };
  const normaal = meetBonus(8);
  const thema = meetBonus(7);
  // Aankondiging: wave 6 afronden → de volgende is Tankkonvooi.
  d.spel.volgendePoorten = [];
  d.startWave(6);
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
  d.updateWaveSysteem(2.0);
  return {
    normaal, thema,
    verwachtNormaal: d.WAVE_BONUS_BASIS + 8 * d.WAVE_BONUS_PER_WAVE,
    verwachtThema: Math.round((d.WAVE_BONUS_BASIS + 7 * d.WAVE_BONUS_PER_WAVE) * d.THEMA_BONUS_FACTOR),
    aankondiging: document.getElementById('waveBanner').textContent,
    aangekondigdePoorten: d.spel.volgendePoorten.length,
  };
});
check('Een themagolf geeft een hogere wave-bonus (× 1,5)', bonus.thema === bonus.verwachtThema && bonus.normaal === bonus.verwachtNormaal, bonus);
check('De aankondiging in de pauze noemt het thema van de volgende wave', bonus.aankondiging.startsWith('Volgende wave: Tankkonvooi'), bonus.aankondiging);
check('...en er wordt maar één poort aangekondigd (het thema bepaalt het aantal)', bonus.aangekondigdePoorten === 1, bonus);

// --- 4. Reset ----------------------------------------------------------------

const reset = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.volgendePoorten = [];
  d.startWave(12);
  d.resetRun();
  return { thema: d.spel.thema, far: d.scene.fog.far, basisFar: d.MIST_BASIS.far };
});
check('Na resetRun() midden in Grachtenmist: geen thema meer, mist terug', reset.thema === null && reset.far === reset.basisFar, reset);

// Ticket D54: de aankondiging van een themagolf koppelt hem aan een toren.
const tips = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const aankondiging = wave => {
    d.resetRun();
    d.spel.volgendePoorten = [];
    d.startWave(wave);
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.spel.teSpawnen = 0;
    for (let i = 0; i < 25; i++) d.updateWaveSysteem(0.1);   // voorbij 1,8 s: de aankondiging
    const banner = document.getElementById('waveBanner');
    return { tekst: banner.textContent, tip: banner.querySelector('.tip')?.textContent ?? null };
  };
  const uit = { voorTank: aankondiging(6), voorSpits: aankondiging(8), gewoon: aankondiging(12), derdePoort: aankondiging(10) };
  d.resetRun();
  return uit;
});
check('Vóór het Tankkonvooi noemt de aankondiging de Geschuttoren', /Tankkonvooi/.test(tips.voorTank.tekst) && /Geschuttoren/.test(tips.voorTank.tip ?? ''), tips.voorTank);
check('Vóór Spitsuur noemt de aankondiging de Bovenleiding', /Spitsuur/.test(tips.voorSpits.tekst) && /Bovenleiding/.test(tips.voorSpits.tip ?? ''), tips.voorSpits);
check('Een gewone wave krijgt geen tip', tips.gewoon.tip === null, tips.gewoon);
check('Vóór wave 11 (D67) meldt de aankondiging de derde poort', /drie poorten/.test(tips.derdePoort.tip ?? ''), tips.derdePoort);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
