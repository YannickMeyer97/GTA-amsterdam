// Ticket D28 (SONNET_EXECUTION_PLAN_monument.md §10, fase 3) — aangekondigde
// poorten.
//
// Elke wave komt uit een klein, vooraf bekend aantal poorten: één in wave
// 1–2, twee vanaf wave 3, nooit exact dezelfde set als de vorige wave, en de
// set voor wave N+1 ligt vast zodra wave N compleet is.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- 1. Aantal poorten per wave, en de keuzefunctie -----------------------

const keuze = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const namen = d.SPAWN_POORTEN.map(p => p.naam);
  const aantallen = [1, 2, 3, 4, 10, 25].map(w => [w, d.aantalActievePoorten(w)]);
  let eenZelfde = 0, tweeZelfde = 0, ongeldig = 0, dubbel = 0;
  for (let i = 0; i < 300; i++) {
    const vorigeEen = [namen[i % 5]];
    const een = d.kiesActievePoorten(1, vorigeEen);
    if (een[0] === vorigeEen[0]) eenZelfde++;
    const vorigeTwee = [namen[i % 5], namen[(i + 2) % 5]];
    const twee = d.kiesActievePoorten(2, vorigeTwee);
    if (twee.length === 2 && twee.every(n => vorigeTwee.includes(n))) tweeZelfde++;
    for (const n of [...een, ...twee]) if (!namen.includes(n)) ongeldig++;
    if (new Set(twee).size !== twee.length) dubbel++;
  }
  return { aantallen, eenZelfde, tweeZelfde, ongeldig, dubbel };
});
const verwachtAantal = { 1: 1, 2: 1, 3: 2, 4: 2, 10: 2, 25: 2 };
check('Wave 1–2: één poort, vanaf wave 3: twee', keuze.aantallen.every(([w, n]) => n === verwachtAantal[w]), keuze.aantallen);
check('Eén poort: nooit dezelfde als de vorige wave (300 lotingen)', keuze.eenZelfde === 0, keuze);
check('Twee poorten: nooit exact dezelfde set als de vorige wave (300 lotingen)', keuze.tweeZelfde === 0, keuze);
check('Alleen bestaande poortnamen, nooit twee keer dezelfde poort', keuze.ongeldig === 0 && keuze.dubbel === 0, keuze);

// --- 2. Echte spawns komen alleen uit de actieve poort ---------------------

const spawns = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.actievePoorten = ['Rokin'];
  d.spel.teSpawnen = 12;
  d.spel.maxActieveRobots = 12;
  d.updateWaveSysteem(0);
  const rokin = d.SPAWN_POORTEN.find(p => p.naam === 'Rokin').positie;
  const afstanden = d.robots.map(r => Math.hypot(r.groep.position.x - rokin.x, r.groep.position.z - rokin.z));
  const loting = {};
  d.spel.actievePoorten = ['Damrak', 'Nieuwendijk'];
  for (let i = 0; i < 200; i++) { const n = d.kiesSpawnPoort().naam; loting[n] = (loting[n] || 0) + 1; }
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  return { aantal: afstanden.length, maxAfstand: Math.max(...afstanden), loting };
});
check('Het wave-systeem spawnt robots (12 stuks) bij de actieve poort', spawns.aantal === 12 && spawns.maxAfstand < 4, spawns);
check('kiesSpawnPoort() loot alleen uit de actieve poorten, en uit allebei',
  Object.keys(spawns.loting).sort().join() === 'Damrak,Nieuwendijk', spawns.loting);

// --- 3. Wave-overgangen: aankondiging ligt vast vóór de wave start --------

const overgangen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const waveUI = document.getElementById('waveUI');
  const banner = document.getElementById('waveBanner');
  const zichtbareBakens = () => [...d.poortBakens].filter(([, b]) => b.visible).map(([n]) => n).sort();
  d.startWave(1);
  const rijen = [];
  for (let w = 1; w <= 8; w++) {
    const actief = [...d.spel.actievePoorten];
    const bakensTijdensWave = zichtbareBakens();
    const hudTijdensWave = waveUI.textContent;
    // Wave leegmaken → compleet.
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.spel.teSpawnen = 0;
    d.updateWaveSysteem(0.1);
    const aangekondigd = [...d.spel.volgendePoorten];
    const bakensInPauze = zichtbareBakens();
    const hudInPauze = waveUI.textContent;
    const bannerVroeg = banner.textContent;
    d.updateWaveSysteem(1.0);   // tussenWaveTimer ≈ 1,1 — nog geen aankondiging
    const bannerNogNiet = banner.textContent;
    d.updateWaveSysteem(1.0);   // ≈ 2,1 — aankondiging
    const bannerAankondiging = banner.textContent;
    d.updateWaveSysteem(3.0);   // > 4,5 — volgende wave start
    rijen.push({
      wave: w, actief, aangekondigd, gestart: [...d.spel.actievePoorten], nieuweWave: d.spel.wave,
      bakensTijdensWave, bakensInPauze, hudTijdensWave, hudInPauze, bannerVroeg, bannerNogNiet, bannerAankondiging,
    });
  }
  return rijen;
});
const zelfde = (a, b) => a.length === b.length && a.every(n => b.includes(n));
check('Over 8 waves: elke wave start met precies de aangekondigde poorten',
  overgangen.every(r => zelfde(r.gestart, r.aangekondigd) && r.nieuweWave === r.wave + 1), overgangen.map(r => [r.wave, r.aangekondigd, r.gestart]));
check('Over 8 waves: de aangekondigde set is nooit gelijk aan die van de lopende wave',
  overgangen.every(r => !zelfde(r.aangekondigd, r.actief)), overgangen.map(r => [r.actief, r.aangekondigd]));
check('Over 8 waves: aantal aangekondigde poorten klopt met de volgende wave (1 voor wave 2, daarna 2)',
  overgangen.every(r => r.aangekondigd.length === (r.wave + 1 <= 2 ? 1 : 2)), overgangen.map(r => [r.wave + 1, r.aangekondigd.length]));
check('Tijdens een wave branden precies de bakens van de actieve poorten',
  overgangen.every(r => zelfde(r.bakensTijdensWave, r.actief)), overgangen.map(r => [r.actief, r.bakensTijdensWave]));
check('In de pauze branden precies de bakens van de aangekondigde poorten',
  overgangen.every(r => zelfde(r.bakensInPauze, r.aangekondigd)), overgangen.map(r => [r.aangekondigd, r.bakensInPauze]));
check('De HUD toont tijdens de wave "via <actieve poorten>"',
  overgangen.every(r => r.actief.every(n => r.hudTijdensWave.includes(n)) && r.hudTijdensWave.includes('via')), overgangen[3].hudTijdensWave);
check('De HUD toont in de pauze "Volgende wave via <aangekondigde poorten>"',
  overgangen.every(r => r.hudInPauze.includes('Volgende wave via') && r.aangekondigd.every(n => r.hudInPauze.includes(n))), overgangen[3].hudInPauze);
check('De aankondigingsbanner komt pas na de "gehaald"-banner (niet vóór 1,8 s)',
  overgangen.every(r => !r.bannerVroeg.startsWith('Volgende wave') && !r.bannerNogNiet.startsWith('Volgende wave')), overgangen.map(r => r.bannerNogNiet));
check('...en toont dan de aangekondigde poorten',
  overgangen.every(r => r.bannerAankondiging.startsWith('Volgende wave') && r.aangekondigd.every(n => r.bannerAankondiging.includes(n))), overgangen.map(r => r.bannerAankondiging));

// --- 4. Bakens zijn nooit raakbaar, en een reset kiest opnieuw ------------

const rest = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spawnRobot(null, 'normal');
  let echteRaycast = null;
  d.robots[d.robots.length - 1].groep.traverse(m => { if (m.isMesh && !echteRaycast) echteRaycast = m.raycast; });
  let raakbaar = 0;
  for (const baken of d.poortBakens.values()) baken.traverse(m => { if (m.isMesh && m.raycast === echteRaycast) raakbaar++; });
  d.spel.volgendePoorten = ['Damrak', 'Rokin'];
  d.resetRun();
  return { raakbaar, actief: d.spel.actievePoorten.length, volgende: d.spel.volgendePoorten.length, wave: d.spel.wave,
    bakens: [...d.poortBakens.values()].filter(b => b.visible).length };
});
check('Poortbakens houden nooit een schot tegen', rest.raakbaar === 0, rest);
check('Na resetRun(): wave 1 met één actieve poort, geen aankondiging meer open, één baken aan',
  rest.wave === 1 && rest.actief === 1 && rest.volgende === 0 && rest.bakens === 1, rest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
