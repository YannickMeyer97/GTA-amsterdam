// Ticket D79 (audit 16, 17) — een lichte test die een run speelt.
//
// Een gesimuleerde speler (zoals in meet-dnm-run, maar korter) speelt van
// wave 1 tot en met wave 6, met de baas van wave 5: hij schiet aan de
// monumentrand, raapt munten op en bouwt een geschuttoren per actieve poort.
// Geen console-fouten, geen ongeldige posities, geen vastgelopen robots, en
// de waves lopen echt door. Daarna: torens bouwen en verkopen laat geen
// geometrie achter (dispose sinds D79), en na een reset blijft het geheugen
// binnen het budget van D42.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const DT = 1 / 20, M = d.MONUMENT_POSITIE, BEREIK = 22;
  function speelRun() {
  d.resetRun();
  let t = 0, cd = 0, nan = 0, maxRobots = 0, langsteWave = 0, waveStart = 0, laatsteWave = 1;
  const geld = () => d.geldStand();
  while (t < 900 && !d.spel.gameOver && d.spel.wave <= 6) {
    d.updateWaveSysteem(DT); d.updateRobots(DT); d.updateTorens(DT); d.updateKerkklokBoost(DT);
    for (const m of [...d.munten]) { d.verdienGeld(m.bedrag); d.scene.remove(m.groep); d.munten.splice(d.munten.indexOf(m), 1); }
    cd -= DT;
    if (cd <= 0) {
      const baas = d.levendeBaas();
      const binnen = x => Math.hypot(x.groep.position.x - M.x, x.groep.position.z - M.z) <= BEREIK + 4;
      const doel = baas && binnen(baas) ? baas : d.robots.filter(binnen).sort((a, b) => a.groep.position.distanceTo(M) - b.groep.position.distanceTo(M))[0];
      if (doel) { cd = d.huidigeSchotCooldown(); if (!doel.schildActief) d.raakRobot(doel, d.spelerSchade(), 'speler'); }
    }
    if (Math.round(t / DT) % 20 === 0) {
      for (const pn of [...new Set([...d.spel.actievePoorten, ...d.spel.volgendePoorten])]) {
        const kp = d.plekVoor(pn, 'knooppunt');
        if (kp && !kp.toren && geld() >= 150) d.bouwToren(kp, 'geschut');
      }
    }
    maxRobots = Math.max(maxRobots, d.robots.length);
    for (const x of d.robots) if (!Number.isFinite(x.groep.position.x) || !Number.isFinite(x.groep.position.z)) nan++;
    if (d.spel.wave !== laatsteWave) { langsteWave = Math.max(langsteWave, t - waveStart); waveStart = t; laatsteWave = d.spel.wave; }
    t += DT;
  }
  return {
    wave: d.spel.wave, gameOver: d.spel.gameOver, tijd: Math.round(t), nan, maxRobots, langsteWave: Math.round(langsteWave),
    vastloop: d.spel.vastloopTeller, sloopkogel: d.voortgang.bazen.sloopkogel || d.runStats.bazenVerslagen > 0 || null,
    kills: Object.values(d.runStats.kills).reduce((a, b) => a + b, 0), torens: d.torens.length,
  };
  }
  const geos = () => { d.renderer.render(d.scene, d.camera); return d.renderer.info.memory.geometries; };
  const uit = speelRun();
  d.resetRun();
  const naEersteRun = geos();

  // Bouwen en verkopen: geen geometrie achter (D79).
  d.resetRun();
  d.geldZet(1e6);
  d.renderer.render(d.scene, d.camera);
  const voor = d.renderer.info.memory.geometries;
  const plekken = d.BOUWPLEKKEN.filter(p => p.soort !== 'drukpers');
  for (let ronde = 0; ronde < 5; ronde++) {
    const gebouwd = [];
    for (const [i, plek] of plekken.entries()) {
      const tw = d.bouwToren(plek, i % 2 ? 'bovenleiding' : 'geschut');
      if (tw) { d.upgradeToren(tw); gebouwd.push(tw); }
      const hek = d.bouwToren(plek, 'hek');
      if (hek) gebouwd.push(hek);
    }
    d.renderer.render(d.scene, d.camera);
    if (ronde === 0) uit.metTorens = d.renderer.info.memory.geometries;
    for (const tw of gebouwd) d.verkoopToren(tw);
    d.renderer.render(d.scene, d.camera);
  }
  uit.bouwVerkoop = { voor, met: uit.metTorens, na: d.renderer.info.memory.geometries };
  // Een tweede run: de caches (robotdelen per kleur, bazen) zijn al gevuld,
  // dus na een reset hoort het aantal gelijk te blijven.
  uit.tweede = speelRun();
  d.resetRun();
  uit.naReset = { geos: geos(), naEersteRun, robots: d.robots.length, torens: d.torens.length };
  return uit;
});

check('De run komt voorbij wave 6 (met de Sloopkogel in wave 5), zonder game over', r.wave >= 7 && !r.gameOver, r);
check('Er wordt echt gespeeld: kills en torens', r.kills > 50 && r.torens >= 2, r);
check('Geen ongeldige posities en geen vastgelopen robots', r.nan === 0 && r.vastloop === 0, r);
check('Geen wave duurt eindeloos (≤ 180 s)', r.langsteWave <= 180, r);
check('Bouwen en verkopen (5 rondes) laat geen geometrie achter', r.bouwVerkoop.met > r.bouwVerkoop.voor && r.bouwVerkoop.na - r.bouwVerkoop.voor <= 3, r.bouwVerkoop);
check('Een tweede run gaat net zo (voorbij wave 6, geen fouten)', r.tweede.wave >= 7 && !r.tweede.gameOver && r.tweede.nan === 0 && r.tweede.vastloop === 0, r.tweede);
check('Na twee runs en een reset: alles opgeruimd, niet gegroeid sinds de eerste run (alleen de kleurcache), binnen het budget van D42 (300)', r.naReset.robots === 0 && r.naReset.torens === 0 && r.naReset.geos <= 300 && r.naReset.geos - r.naReset.naEersteRun <= 8, r.naReset);   // marge: een robotkleur die de eerste run niet tegenkwam vult de cache één keer (zes accentkleuren)

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
