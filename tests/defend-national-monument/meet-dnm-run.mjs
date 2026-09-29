// Audit (na fase P) — meetscript: speelt een hele run automatisch. Geen test;
// wordt niet door run-all gedraaid.
//
// Een gesimuleerde speler staat aan de monumentrand en vuurt met de functies
// van de game zelf (huidigeSchotCooldown, warmtePerSchot, warmteAfkoeling),
// op de baas als die binnen bereik is, anders op de dichtstbijzijnde robot.
// Munten worden meteen opgeraapt (alsof de speler ze oploopt). Om de seconde
// koopt hij volgens een strategie:
//   goed: geschut op het knooppunt en een Bovenleiding op de voorpost van de
//         actieve en aangekondigde poorten, alles naar niveau 3 (richting A),
//         vuurtempo tot 3 en koeling tot 2, een drukpers, en repareren onder 80%.
//   zwak: alleen een geschuttoren niveau 1 op het knooppunt, geen upgrades.
// Hij loopt niet. Ticket D70: een derde argument is de trefkans (standaard 1,
// nooit mis); `node meet-dnm-run.mjs goed 0.6` lijkt meer op een mens.
// Draaien: `node meet-dnm-run.mjs goed`.
import { openDefend } from '../helpers-defend.mjs';

const strategie = process.argv[2] || 'goed';
const trefkans = Number(process.argv[3]) || 1;
const { browser, page, errs } = await openDefend();

const r = await page.evaluate(([strategie, trefkans]) => {
  const d = window.DamChaosDebug;
  const DT = 1 / 20, M = d.MONUMENT_POSITIE, BEREIK = 22;
  const goed = strategie !== 'zwak';
  d.resetRun();
  d.initGeluid();
  const piepVoor = d.piepTeller();
  const bazen = {}, perWave = {};
  let t = 0, cd = 0, warmte = 0, sinds = 99, oververhit = false, spelerSchoten = 0, oververhitTeller = 0;
  let maxRobots = 0, nan = 0, laatsteWave = 1, waveStart = 0;
  const geld = () => d.geldStand();
  function koop() {
    if (goed && d.spel.monumentHP < 80 && geld() >= 100) d.koopMonumentReparatie();
    const poorten = [...new Set([...d.spel.actievePoorten, ...d.spel.volgendePoorten])];
    for (const pn of poorten) {
      const kp = d.plekVoor(pn, 'knooppunt'), vp = d.plekVoor(pn, 'voorpost');
      if (kp && !kp.toren && geld() >= 150) d.bouwToren(kp, 'geschut');
      if (goed && vp && !vp.toren && geld() >= 300) d.bouwToren(vp, 'bovenleiding');
    }
    if (goed) {
      if (d.upgrades.vuurtempo < 3 && geld() >= d.upgradeKosten('vuurtempo') + 200) d.koopUpgrade('vuurtempo');
      if (d.upgrades.koeling < 2 && d.upgrades.vuurtempo >= 2 && geld() >= d.upgradeKosten('koeling') + 200) d.koopUpgrade('koeling');
      for (const pn of poorten) for (const soort of ['knooppunt', 'voorpost']) {
        const tw = d.plekVoor(pn, soort)?.toren;
        if (tw && tw.niveau < 3 && geld() >= (d.upgradePrijs(tw) ?? 300) + 100) d.upgradeToren(tw);
      }
      const pp = d.DRUKPERSPLEKKEN[0];
      if (d.spel.wave >= 2 && pp && !pp.toren && geld() >= 400) d.bouwToren(pp, 'drukpers');
    }
  }
  while (t < 1800 && !d.spel.gameOver && !d.spel.gewonnen) {
    d.updateWaveSysteem(DT); d.updateRobots(DT); d.updateTorens(DT); d.updateKerkklokBoost(DT);
    for (const m of [...d.munten]) { d.verdienGeld(m.bedrag); d.scene.remove(m.groep); d.munten.splice(d.munten.indexOf(m), 1); }
    const baas = d.levendeBaas();
    if (baas) bazen[baas.type] = baas;
    // De speler.
    cd -= DT; sinds += DT;
    if (sinds >= d.WARMTE_AFKOEL_VERTRAGING) warmte = Math.max(0, warmte - d.warmteAfkoeling() * DT);
    if (oververhit && warmte <= d.WARMTE_HERVAT_DREMPEL) oververhit = false;
    if (cd <= 0 && !oververhit) {
      const binnen = x => Math.hypot(x.groep.position.x - M.x, x.groep.position.z - M.z) <= BEREIK + 4;
      const doel = baas && binnen(baas) ? baas
        : d.robots.filter(binnen).sort((a, b) => a.groep.position.distanceTo(M) - b.groep.position.distanceTo(M))[0];
      if (doel) {
        cd = d.huidigeSchotCooldown(); sinds = 0; spelerSchoten++;
        warmte = Math.min(100, warmte + d.warmtePerSchot());
        if (warmte >= 100) { oververhit = true; oververhitTeller++; }
        if (!doel.schildActief && Math.random() < trefkans) d.raakRobot(doel, 1, 'speler');
      }
    }
    if (Math.round(t / DT) % 20 === 0) koop();
    maxRobots = Math.max(maxRobots, d.robots.length);
    for (const x of d.robots) if (!Number.isFinite(x.groep.position.x) || !Number.isFinite(x.groep.position.z)) nan++;
    if (d.spel.wave !== laatsteWave) {
      perWave[laatsteWave] = { hp: Math.round(d.spel.monumentHP), geld: geld(), duur: Math.round(t - waveStart) };
      laatsteWave = d.spel.wave; waveStart = t;
    }
    t += DT;
  }
  d.renderer.render(d.scene, d.camera);
  const kills = Object.values(d.runStats.kills).reduce((a, b) => a + b, 0);
  return {
    uitkomst: d.spel.gewonnen ? `gewonnen, ${d.spel.sterren} sterren` : d.spel.gameOver ? `verloren in wave ${d.spel.wave}` : 'tijd op',
    tijd: Math.round(t), hp: Math.round(d.spel.monumentHP), perWave,
    bazen: Object.fromEntries(Object.entries(bazen).map(([k, v]) => [k, v.hp > 0 ? `door met ${Math.ceil(v.hp)}/${v.hpMax}` : 'verslagen'])),
    kills, torenKills: d.runStats.torenKills, spelerSchoten, oververhitTeller, hoogsteCombo: d.runStats.hoogsteCombo,
    maxRobots, nan, vastloop: d.spel.vastloopTeller, geometrieen: d.renderer.info.memory.geometries,
    piepsPerMinuut: Math.round((d.piepTeller() - piepVoor) / (t / 60)),
    torens: d.torens.map(x => `${d.torenNaam(x)} ${x.niveau}`),
  };
}, [strategie, trefkans]);

console.log(`=== Automatische run, strategie "${strategie}", trefkans ${trefkans} ===`);
console.log(`Uitkomst: ${r.uitkomst} na ${Math.floor(r.tijd / 60)}:${String(r.tijd % 60).padStart(2, '0')} (monument ${r.hp}%)`);
console.log(`Bazen: ${Object.entries(r.bazen).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
console.log(`Monument na elke wave: ${Object.entries(r.perWave).map(([w, x]) => `${w}:${x.hp}`).join(' ')}`);
console.log(`Geld na elke wave:     ${Object.entries(r.perWave).map(([w, x]) => `${w}:${x.geld}`).join(' ')}`);
console.log(`Kills: ${r.kills}, waarvan ${r.torenKills} door torens (${Math.round(100 * r.torenKills / Math.max(1, r.kills))}%); schoten van de speler: ${r.spelerSchoten}; oververhit: ${r.oververhitTeller}×; hoogste combo: ${r.hoogsteCombo}`);
console.log(`Torens aan het eind: ${r.torens.join(', ')}`);
console.log(`Techniek: max ${r.maxRobots} robots tegelijk, ${r.nan} ongeldige posities, ${r.vastloop}× vastgelopen, ${r.geometrieen} geometrieën, ${r.piepsPerMinuut} geluiden per minuut`);
console.log('Console-fouten:', errs.length ? errs.slice(0, 5) : 'geen');
await browser.close();
