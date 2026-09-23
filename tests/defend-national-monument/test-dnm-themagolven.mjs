// Ticket D30 (SONNET_EXECUTION_PLAN_monument.md §10, fase 3) — themagolven.
//
// Afwijking van de tickettekst, bewust: themagolven starten bij wave 6, niet
// bij 4. Waves 2–5 introduceren elk een nieuw robottype (wave 4 = de bomber);
// een tank-themagolf op wave 4 zou die introductie overschrijven.
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
check('Alleen waves 6, 10, 14, 18, 22, 26 zijn themagolven',
  Object.keys(rooster).join() === '6,10,14,18,22,26', rooster);
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
      wave, thema: d.spel.thema, waveDoel: d.spel.waveDoel, basisDoel: 7 + wave * 3,
      poorten: d.spel.actievePoorten.length, typen, aantalGespawnd: d.robots.length,
      banner: document.getElementById('waveBanner').textContent,
      mist: { kleur: d.scene.fog.color.getHex(), near: d.scene.fog.near, far: d.scene.fog.far, achtergrond: d.scene.background.getHex() },
      basisMist: { ...d.MIST_BASIS },
    };
    return uit;
  }, wave);
}

const w6 = await startEnMeet(6);
check('Wave 6 = Tankkonvooi: alleen tanks, half zoveel robots, via één poort', w6.thema === 'tankkonvooi' && w6.typen.join() === 'tank' && w6.waveDoel === Math.round(w6.basisDoel * 0.5) && w6.poorten === 1, w6);
check('...met een eigen banner "Wave 6: Tankkonvooi!"', w6.banner.startsWith('Wave 6: Tankkonvooi!'), w6.banner);
const w7 = await startEnMeet(7);
check('Wave 7 is weer normaal: geen thema, normale aantallen, gemengde typen, twee poorten', w7.thema === null && w7.waveDoel === w7.basisDoel && w7.typen.length > 1 && w7.poorten === 2, w7);

const w10 = await startEnMeet(10);
check('Wave 10 = Spitsuur: alleen sprinters, 1,3× zoveel robots, via één poort', w10.thema === 'spitsuur' && w10.typen.join() === 'sprinter' && w10.waveDoel === Math.round(w10.basisDoel * 1.3) && w10.poorten === 1, w10);

const w14 = await startEnMeet(14);
check('Wave 14 = Grachtenmist: normale mix en aantallen, twee poorten', w14.thema === 'grachtenmist' && w14.typen.length > 1 && w14.waveDoel === w14.basisDoel && w14.poorten === 2, w14);
check('...de mist trekt dicht (zicht ~38 m, lucht in mistkleur)', w14.mist.far === 38 && w14.mist.near === 6 && w14.mist.achtergrond === w14.mist.kleur && w14.mist.far < w14.basisMist.far, w14.mist);
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
  const normaal = meetBonus(7);
  const thema = meetBonus(6);
  // Aankondiging: wave 5 afronden → de volgende is Tankkonvooi.
  d.spel.volgendePoorten = [];
  d.startWave(5);
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
  d.updateWaveSysteem(2.0);
  return {
    normaal, thema,
    verwachtNormaal: d.WAVE_BONUS_BASIS + 7 * d.WAVE_BONUS_PER_WAVE,
    verwachtThema: Math.round((d.WAVE_BONUS_BASIS + 6 * d.WAVE_BONUS_PER_WAVE) * d.THEMA_BONUS_FACTOR),
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
  d.startWave(14);
  d.resetRun();
  return { thema: d.spel.thema, far: d.scene.fog.far, basisFar: d.MIST_BASIS.far };
});
check('Na resetRun() midden in Grachtenmist: geen thema meer, mist terug', reset.thema === null && reset.far === reset.basisFar, reset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
