// Ticket D16 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — economie meten
// vóór bijstellen.
//
// Geen check()/report(), wordt bewust NIET door run-all.mjs opgepikt
// (bestandsnaam begint met meet-). Draaien: `node meet-dnm-economie.mjs`
// vanuit tests/defend-national-monument/. Optioneel een maximum wave als
// argument: `node meet-dnm-economie.mjs 12`.
//
// Deel A — inkomsten per wave, uit de spelformules zelf (robotmix via
// echte loting met kiesRobotTypeVoorWave, gemiddelde munt uit
// MUNT_BASIS_MIN/MAX × type-beloning, wave-bonus, perfect-bonus). Twee scenario's:
//   basis: geen combo, geen perfecte waves, alle munten opgeraapt
//   goed:  gemiddelde combo x1,25 op kills, elke wave perfect
//
// Deel B — hoeveel verdediging een wave nodig heeft ZONDER speler. Per wave
// een echte simulatie (updateWaveSysteem + updateRobots + updateTorens):
// robots lopen hun route, torens schieten, en we meten de monumentschade.
// Oplopende configuraties per actieve poort; de eerste die in twee pogingen
// geen enkele monumentschade toelaat, "houdt de wave". Omdat de speler zelf
// ook schiet, is dit een BOVENGRENS van wat er nodig is.
import { openDefend } from '../helpers-defend.mjs';

const MAX_WAVE = Number(process.argv[2] || 20);
const { browser, page } = await openDefend();

const inkomsten = await page.evaluate((MAX_WAVE) => {
  const d = window.DamChaosDebug;
  const rijen = [];
  for (let wave = 1; wave <= MAX_WAVE; wave++) {
    const aantal = 7 + wave * 3;   // zelfde formule als startWave()
    const telling = {};
    const N = 20000;
    for (let i = 0; i < N; i++) { const t = d.kiesRobotTypeVoorWave(wave); telling[t] = (telling[t] || 0) + 1; }
    const gemiddeldeMunt = (d.MUNT_BASIS_MIN + d.MUNT_BASIS_MAX) / 2;
    let muntPerRobot = 0;
    for (const [type, n] of Object.entries(telling)) muntPerRobot += (n / N) * gemiddeldeMunt * d.ROBOT_TYPES[type].beloningMultiplier;
    const waveBonus = d.WAVE_BONUS_BASIS + wave * d.WAVE_BONUS_PER_WAVE;
    const perfect = d.PERFECT_BONUS_BASIS + wave * d.PERFECT_BONUS_PER_WAVE;
    rijen.push({
      wave, aantal,
      mix: Object.fromEntries(Object.entries(telling).map(([t, n]) => [t, Math.round((n / N) * 100)])),
      basis: Math.round(aantal * muntPerRobot + waveBonus),
      goed: Math.round(aantal * muntPerRobot * 1.25 + waveBonus + perfect),
    });
  }
  return rijen;
}, MAX_WAVE);

// Configuraties per actieve poort (2 bouwplekken per poort). Kosten worden
// uit de game zelf berekend (som van de niveauprijzen), niet hier hardgecodeerd.
const CONFIGS = [
  { naam: 'niets', plekken: [] },
  { naam: '1 toren niv.1', plekken: [['geschut', 1]] },
  { naam: 'toren niv.1 + hek niv.1', plekken: [['geschut', 1], ['hek', 1]] },
  { naam: '2 torens niv.1', plekken: [['geschut', 1], ['geschut', 1]] },
  { naam: '2 torens niv.2', plekken: [['geschut', 2], ['geschut', 2]] },
  { naam: 'toren niv.3 + hek niv.3', plekken: [['geschut', 3], ['hek', 3]] },
  { naam: '2 torens niv.3', plekken: [['geschut', 3], ['geschut', 3]] },
];
const kostenPerConfig = await page.evaluate((CONFIGS) => {
  const d = window.DamChaosDebug;
  const som = (type, niveau) => d.TOREN_TYPES[type].niveaus.slice(0, niveau).reduce((a, n) => a + n.prijs, 0);
  return CONFIGS.map(c => c.plekken.reduce((a, [type, niveau]) => a + som(type, niveau), 0));
}, CONFIGS);
CONFIGS.forEach((c, i) => { c.kosten = kostenPerConfig[i]; });
const VOLLEDIG_UITGERUST = CONFIGS.find(c => c.naam === '2 torens niv.2').kosten;

const verdediging = await page.evaluate(({ MAX_WAVE, CONFIGS }) => {
  const d = window.DamChaosDebug;
  const DT = 1 / 20;
  function simuleer(wave, config) {
    d.resetRun();
    d.geldZet(1e7);
    d.startWave(wave);
    d.spel.monumentHP = 100000;   // nooit game over; we tellen alleen schade
    for (const poortNaam of d.spel.actievePoorten) {
      // Knooppunt (dichter bij het monument) eerst, dan de voorpost (D46).
      const plekken = [d.plekVoor(poortNaam, 'knooppunt'), d.plekVoor(poortNaam, 'voorpost')];
      config.plekken.forEach(([type, niveau], i) => {
        if (!plekken[i] || plekken[i].toren) return;   // knooppunt al bebouwd door een andere poort
        const t = d.bouwToren(plekken[i], type);
        for (let n = 1; n < niveau; n++) d.upgradeToren(t);
      });
    }
    let t = 0;
    while (t < 300 && !d.spel.waveBonusGegeven) {
      d.updateWaveSysteem(DT);
      d.updateRobots(DT);
      d.updateTorens(DT);
      t += DT;
    }
    return { schade: 100000 - d.spel.monumentHP, duur: t, poorten: d.spel.actievePoorten.length, kills: d.runStats.torenKills };
  }
  const rijen = [];
  for (let wave = 1; wave <= MAX_WAVE; wave++) {
    const pogingen = [];
    let houdt = null;
    for (const config of CONFIGS) {
      const a = simuleer(wave, config), b = simuleer(wave, config);
      pogingen.push({ config: config.naam, schade: [a.schade, b.schade] });
      if (a.schade === 0 && b.schade === 0) { houdt = { ...config, poorten: a.poorten }; break; }
    }
    rijen.push({ wave, houdt, pogingen });
  }
  d.resetRun();
  return rijen;
}, { MAX_WAVE, CONFIGS });

console.log('=== Deel A — inkomsten per wave (€) ===');
console.log('wave  robots  basis  cum.basis   goed  cum.goed   mix (% normal/sprinter/tank/bomber/shieldbot)');
let cumBasis = 0, cumGoed = 0;
for (const r of inkomsten) {
  cumBasis += r.basis; cumGoed += r.goed;
  r.cumBasis = cumBasis; r.cumGoed = cumGoed;
  const mix = ['normal', 'sprinter', 'tank', 'bomber', 'shieldbot'].map(t => String(r.mix[t] || 0).padStart(2)).join('/');
  console.log(`${String(r.wave).padStart(4)}  ${String(r.aantal).padStart(6)}  ${String(r.basis).padStart(5)}  ${String(cumBasis).padStart(9)}  ${String(r.goed).padStart(5)}  ${String(cumGoed).padStart(8)}   ${mix}`);
}

console.log('\n=== Deel B — verdediging die de wave ZONDER speler houdt (per actieve poort) ===');
console.log('wave  poorten  houdt met                    kosten (alle actieve poorten)   schade per geprobeerde config');
for (const r of verdediging) {
  const kosten = r.houdt ? r.houdt.kosten * r.houdt.poorten : null;
  const pogingen = r.pogingen.map(p => `${p.config}: ${p.schade.join('/')}`).join(' · ');
  console.log(`${String(r.wave).padStart(4)}  ${String(r.houdt?.poorten ?? '?').padStart(7)}  ${(r.houdt?.naam ?? 'NIETS HOUDT HET').padEnd(27)}  ${String(kosten ?? '-').padStart(6)}   ${pogingen}`);
}

console.log('\n=== Toetsing aan het ontwerpdoel (plan D16) ===');
console.log('Doel: rond wave 5 kan de speler ongeveer ÉÉN poort volledig uitrusten, niet alle vijf.');
console.log(`"Volledig uitgerust" = beide plekken van één poort met een toren op niveau 2 (€${VOLLEDIG_UITGERUST}).`);
for (const w of [3, 5, 8]) {
  const r = inkomsten[w - 1];
  if (!r) continue;
  console.log(`Na wave ${w}: basis €${r.cumBasis} (${(r.cumBasis / VOLLEDIG_UITGERUST).toFixed(1)} poorten) · goed €${r.cumGoed} (${(r.cumGoed / VOLLEDIG_UITGERUST).toFixed(1)} poorten)`);
}

await browser.close();
