// Ticket D60 (SONNET_EXECUTION_PLAN_monument.md, §12, fase P) — meetscript
// voor de baaswaves. Geen test; wordt niet door run-all gedraaid.
//
// De verdedigingssimulatie van meet-dnm-economie schiet niet zelf, en een
// baas moet je juist zelf bevechten. Hier staat daarom een gesimuleerde
// speler aan de monumentrand: hij vuurt in het tempo van het wapen en raakt
// oververhit, allebei met de functies van de game zelf
// (huidigeSchotCooldown, warmtePerSchot, warmteAfkoeling), op de baas als
// die binnen het wapenbereik is, anders op de dichtstbijzijnde robot. Een
// schild houdt zijn schoten tegen. Per baaswave heeft hij de upgrades die
// een goede speler dan heeft (zie SCENARIO). Hij loopt niet en mikt nooit
// mis: een goede, geen perfecte speler.
//
// Per baaswave: monumentschade, of de baas sneuvelde, en hoe lang het
// duurde, voor een paar verdedigingen die je op dat moment kunt betalen.
// Draaien: `node meet-dnm-bazen.mjs` vanuit tests/defend-national-monument/.
import { openDefend } from '../helpers-defend.mjs';

const { browser, page } = await openDefend();

// Ticket D70: `node meet-dnm-bazen.mjs 20` meet alleen wave 20.
const alleenWave = Number(process.argv[2]) || null;
// Ticket D80: een tweede argument is de trefkans (standaard 1).
const trefkans = Number(process.argv[3]) || 1;
const ALLE_SCENARIO = [
  { wave: 5, upgrades: {}, configs: [['alleen de speler', []], ['2 torens niv. 1', [['geschut', 1], ['geschut', 1]]], ['2 torens niv. 2', [['geschut', 2], ['geschut', 2]]]] },
  { wave: 10, upgrades: { vuurtempo: 2, koeling: 1 }, configs: [['alleen de speler', []], ['2 torens niv. 2', [['geschut', 2], ['geschut', 2]]], ['Kanon + Hoogspanning', [['geschut', 3], ['bovenleiding', 3]]], ['2 Kanonnen', [['geschut', 3], ['geschut', 3]]]] },
  { wave: 15, upgrades: { vuurtempo: 3, koeling: 2 }, configs: [['alleen de speler', []], ['Kanon + Stroomval', [['geschut', 3], ['bovenleiding', 3, 'stroomval']]], ['2 torens niv. 2', [['geschut', 2], ['geschut', 2]]], ['Kanon + Hoogspanning', [['geschut', 3], ['bovenleiding', 3]]], ['2 Kanonnen', [['geschut', 3], ['geschut', 3]]]] },
  // Ticket D69: de Heimachine.
  { wave: 20, upgrades: { vuurtempo: 3, koeling: 2, kogels: 2 }, configs: [['alleen de speler', []], ['Kanon + Stroomval', [['geschut', 3], ['bovenleiding', 3, 'stroomval']]], ['Kanon + Hoogspanning', [['geschut', 3], ['bovenleiding', 3]]], ['2 Kanonnen', [['geschut', 3], ['geschut', 3]]]] },
];
const SCENARIO = ALLE_SCENARIO.filter(x => !alleenWave || x.wave === alleenWave);

const r = await page.evaluate(([SCENARIO, trefkans]) => {
  const d = window.DamChaosDebug;
  const DT = 1 / 20;
  const BEREIK = 22;
  function sim(wave, plekken, metSpeler, upgrades) {
    d.resetRun(); d.geldZet(1e7); Object.assign(d.upgrades, upgrades); d.startWave(wave); d.spel.monumentHP = 100000;
    for (const pn of d.spel.actievePoorten) {
      const ps = [d.plekVoor(pn, 'knooppunt'), d.plekVoor(pn, 'voorpost')];
      plekken.forEach(([type, niv, richting], i) => { if (!ps[i] || ps[i].toren) return; const t = d.bouwToren(ps[i], type); for (let n = 1; n < niv; n++) d.upgradeToren(t, n === 2 ? richting : undefined); });   // D75: optioneel een richting
    }
    let t = 0, cd = 0, warmte = 0, sinds = 99, oververhit = false, baasDood = null, baasObj = null, baasRestHp = null;
    const M = d.MONUMENT_POSITIE;
    while (t < 400 && !d.spel.waveBonusGegeven) {
      d.updateWaveSysteem(DT); d.updateRobots(DT); d.updateTorens(DT);
      const baas = d.levendeBaas();
      if (baas) baasObj = baas;
      else if (baasObj && baasDood === null) { baasDood = t; baasRestHp = baasObj.hp; }   // hp > 0: hij haalde het monument
      if (metSpeler) {
        cd -= DT; sinds += DT;
        if (sinds >= d.WARMTE_AFKOEL_VERTRAGING) warmte = Math.max(0, warmte - d.warmteAfkoeling() * DT);
        if (oververhit && warmte <= d.WARMTE_HERVAT_DREMPEL) oververhit = false;
        if (cd <= 0 && !oververhit) {
          const binnen = x => Math.hypot(x.groep.position.x - M.x, x.groep.position.z - M.z) <= BEREIK + 4;
          const doel = baas && binnen(baas) ? baas
            : d.robots.filter(binnen).sort((a, b) => a.groep.position.distanceTo(M) - b.groep.position.distanceTo(M))[0];
          if (doel) {
            cd = d.huidigeSchotCooldown(); sinds = 0;
            warmte = Math.min(100, warmte + d.warmtePerSchot());
            if (warmte >= 100) oververhit = true;
            if (!doel.schildActief && Math.random() < trefkans) d.raakRobot(doel, d.spelerSchade(), 'speler');   // D80: kogels en trefkans
          }
        }
      }
      t += DT;
    }
    return { schade: 100000 - d.spel.monumentHP, duur: t, baasDood, gehaald: baasRestHp !== null && baasRestHp > 0, restHp: baasRestHp, hpMax: baasObj?.hpMax };
  }
  const uit = [];
  for (const { wave, upgrades, configs } of SCENARIO) {
    for (const [naam, plekken] of configs) {
      const runs = [0, 1, 2].map(() => sim(wave, plekken, true, upgrades));
      uit.push({ wave, baas: d.baasVoorWave(wave), naam, schade: runs.map(x => x.schade),
        baas_: runs.map(x => x.gehaald ? `DOOR (${Math.ceil(x.restHp)}/${x.hpMax})` : `dood ${x.baasDood?.toFixed(0)} s`), duur: runs.map(x => x.duur.toFixed(0)) });
    }
  }
  d.resetRun();
  return uit;
}, [SCENARIO, trefkans]);

console.log('=== Baaswaves met een gesimuleerde speler (3 pogingen) ===');
console.log('wave  baas         verdediging              monumentschade      de baas                                   waveduur');
for (const x of r) console.log(`${String(x.wave).padStart(4)}  ${x.baas.padEnd(11)}  ${x.naam.padEnd(23)}  ${x.schade.join(' / ').padEnd(18)}  ${x.baas_.join(' / ').padEnd(40)}  ${x.duur.join(' / ')} s`);
console.log('\n"DOOR (rest/max)": de baas haalde het monument met zoveel HP over (40 / 40 / 60 / 60 schade, sinds D63 en D69). Monumentschade ≥ 100 is game over.');
await browser.close();
