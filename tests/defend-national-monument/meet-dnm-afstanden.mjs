// Ticket D6 (SONNET_EXECUTION_PLAN_monument.md, Fase 1) — meet de looptijden
// tegen de levende pagina. Ticket D43: herzien voor de nieuwe kaart.
//
// Sinds D33 lopen robots over hun route (rijbaan, bochten, eigen baan)
// in plaats van recht op het monument af. De hemelsbrede afstand
// (afstandTotMonument) zegt dus niets meer over de looptijd. Dit script
// laat per poort één echte robot met 1 m/s zijn route aflopen
// (updateRobots) tot hij het monument raakt: de gemeten tijd is de
// werkelijke looplengte in meters.
//
// Geen check()/report(), geen exitcode-conventie, wordt bewust NIET
// opgepikt door run-all.mjs (bestandsnaam begint niet met test-/check-).
// Draaien: `node meet-dnm-afstanden.mjs` vanuit tests/defend-national-monument/.
import { openDefend } from '../helpers-defend.mjs';

const { browser, page } = await openDefend();

const metingen = await page.evaluate(() => {
  const d = window.DamChaosDebug;

  // Robotsnelheid komt uit spawnRobot(): min(1,35 + rnd·0,7 + wave·0,07,
  // 3,0) · 1,1, maal de typefactor (sprinter 1,6).
  function basisSnelheidBand(wave) {
    const min = Math.min(1.35 + 0 * 0.7 + wave * 0.07, 3.0) * 1.1;
    const max = Math.min(1.35 + 1 * 0.7 + wave * 0.07, 3.0) * 1.1;
    return { min, max };
  }
  const PLAFOND_WAVE = 30;

  // Echte looplengte: één robot per poort, alleen op de kaart, 1 m/s.
  function looplengte(poort) {
    d.resetRun();
    for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
    d.spel.teSpawnen = 0;
    d.spawnRobot(poort, 'normal');
    const robot = d.robots[d.robots.length - 1];
    robot.laanFractie = 0;   // midden van de strook
    robot.snelheid = 1;
    const DT = 1 / 20;
    let t = 0;
    while (d.robots.includes(robot) && t < 400) { d.updateRobots(DT); t += DT; }
    return t;
  }

  const poortMetingen = d.SPAWN_POORTEN.map(p => {
    const route = d.ROUTES.get(p.naam);
    const lengte = looplengte(p);
    const rijen = [1, 10, PLAFOND_WAVE].map(wave => {
      const { min, max } = basisSnelheidBand(wave);
      return { wave, snelheidMin: min, snelheidMax: max, tijdMin: lengte / max, tijdMax: lengte / min };
    });
    const sprinterPlafond = lengte / (basisSnelheidBand(PLAFOND_WAVE).max * d.ROBOT_TYPES.sprinter.snelheidMultiplier);
    // Bouwplekken van deze route: waar liggen ze, gemeten langs de route
    // vanaf de poort, en hoe ver van de monumentrand?
    const plekken = ['knooppunt', 'voorpost'].map(soort => {
      const plek = d.plekVoor(p.naam, soort);
      if (!plek) return null;
      const pr = d.projecteerOpRoute(route, plek.positie.x, plek.positie.z);
      return { soort, naam: plek.naam, sVanafPoort: pr.s, totRoute: pr.afstand, totMonument: d.afstandTotMonument(plek.positie) };
    }).filter(Boolean);
    return { naam: p.naam, hemelsbreed: d.afstandTotMonument(p.positie), routeLengte: route.lengte, lengte, rijen, sprinterPlafond, plekken };
  });
  d.resetRun();

  const spelerSnelheid = d.speler.snelheid;
  const steunpunten = d.interactiePunten.map(p => {
    const afstandVanafMonument = d.afstandTotMonument(p.positie);
    return { naam: p.naam, afstandVanafMonument, retourVanafMonument: 2 * afstandVanafMonument / spelerSnelheid };
  });

  return { poortMetingen, steunpunten, spelerSnelheid, wapenBereik: d.WAPEN_BEREIK ?? 22 };
});

console.log('=== Robot: poort -> monument, langs de route (gemeten met een echte robot) ===\n');
for (const p of metingen.poortMetingen) {
  console.log(`${p.naam} — gelopen ${p.lengte.toFixed(1)} m (route ${p.routeLengte.toFixed(1)} m, hemelsbreed ${p.hemelsbreed.toFixed(1)} m)`);
  for (const r of p.rijen) {
    console.log(`  wave ${String(r.wave).padStart(2)}: snelheid ${r.snelheidMin.toFixed(2)}–${r.snelheidMax.toFixed(2)} m/s -> ${r.tijdMin.toFixed(1)}–${r.tijdMax.toFixed(1)} s`);
  }
  console.log(`  sprinter op het plafond: ${p.sprinterPlafond.toFixed(1)} s`);
  console.log();
}

console.log(`=== Steunpunt heen-en-terug vanaf de monumentrand (speler ${metingen.spelerSnelheid} m/s) ===`);
for (const s of metingen.steunpunten) {
  console.log(`${s.naam.padEnd(34)} ${s.afstandVanafMonument.toFixed(1).padStart(5)} m · ${s.retourVanafMonument.toFixed(1)} s retour`);
}

console.log('\n=== Toetsing aan de ontwerpdoelen (D6) ===');
console.log('Doel: dichtstbijzijnde poort 15–25 s, verste tot ~35 s, korter dan 10 s = probleem (basisrobot, snelste, op het plafond).');
for (const p of metingen.poortMetingen) {
  const plafondRij = p.rijen[p.rijen.length - 1];
  const w1 = p.rijen[0];
  const status = plafondRij.tijdMin < 10 ? '✗ ONDER DE REACTIEDREMPEL' : '✓';
  console.log(`${p.naam.padEnd(14)} wave 1: ${w1.tijdMin.toFixed(1)}–${w1.tijdMax.toFixed(1)} s · plafond: ${plafondRij.tijdMin.toFixed(1)} s  ${status}`);
}

console.log(`\n=== Bouwplekken langs de route (wapenbereik ${metingen.wapenBereik} m) ===`);
for (const p of metingen.poortMetingen) {
  for (const b of p.plekken) {
    const vanafMonument = p.lengte - b.sVanafPoort;
    console.log(`${p.naam.padEnd(14)} ${b.soort.padEnd(9)} ${b.naam.padEnd(28)} ${b.totMonument.toFixed(1).padStart(5)} m van de monumentrand · ${b.sVanafPoort.toFixed(1).padStart(5)} m na de poort (${(100 * b.sVanafPoort / p.lengte).toFixed(0)} %) · ${vanafMonument.toFixed(1)} m route tot het monument · ${b.totRoute.toFixed(1)} m naast de route`);
  }
}

await browser.close();
