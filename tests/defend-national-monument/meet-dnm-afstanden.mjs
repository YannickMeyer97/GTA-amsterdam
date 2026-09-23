// Ticket D6 (SONNET_EXECUTION_PLAN_monument.md, Fase 1) — meet de looptijden
// die D4/D5 op berekening hebben aangenomen, tegen de levende pagina.
//
// Geen check()/report(), geen exitcode-conventie, wordt bewust NIET
// opgepikt door run-all.mjs (bestandsnaam begint niet met test-/check-).
// Draaien: `node meet-dnm-afstanden.mjs` vanuit tests/defend-national-monument/.
import { openDefend } from '../helpers-defend.mjs';

const { browser, page } = await openDefend();

const metingen = await page.evaluate(() => {
  const d = window.DamChaosDebug;

  // Robotsnelheid komt uit spawnRobot(), niet uit maakRobot() (die waarde is
  // dode code — zie ARCHITECTURE_NOTES_monument.md §6.2). Reconstrueer de
  // echte formule hier voor de min/max-band per wave, i.p.v. een robot te
  // spawnen en typeMultiplier per type te moeten uitpluizen.
  function basisSnelheidBand(wave) {
    const min = Math.min(1.35 + 0 * 0.7 + wave * 0.07, 3.0) * 1.1;
    const max = Math.min(1.35 + 1 * 0.7 + wave * 0.07, 3.0) * 1.1;
    return { min, max };
  }
  const PLAFOND_WAVE = 30; // ruim voorbij het punt waarop het plafond (3,0, Ticket D6) sowieso geraakt is

  const poortMetingen = d.SPAWN_POORTEN.map(p => {
    const afstand = d.afstandTotMonument(p.positie);
    const rijen = [1, 10, PLAFOND_WAVE].map(wave => {
      const { min, max } = basisSnelheidBand(wave);
      return { wave, snelheidMin: min, snelheidMax: max, tijdMin: afstand / max, tijdMax: afstand / min };
    });
    return { naam: p.naam, afstand, rijen };
  });

  const spelerSnelheid = d.speler.snelheid;
  const diagonaal = Math.hypot(d.GRENS.maxX - d.GRENS.minX, d.GRENS.maxZ - d.GRENS.minZ);
  const langeAsTijd = (d.GRENS.maxX - d.GRENS.minX) / spelerSnelheid;

  const steunpunten = d.interactiePunten.map(p => {
    const afstand = Math.hypot(p.positie.x - d.speler.positie.x, p.positie.z - d.speler.positie.z);
    // Retour vanaf het monument (realistischer dan vanaf de startplek): de
    // speler komt telkens terug bij het monument om te verdedigen.
    const afstandVanafMonument = Math.hypot(p.positie.x - d.MONUMENT_POSITIE.x, p.positie.z - d.MONUMENT_POSITIE.z);
    return { naam: p.naam, afstandVanafSpelerStart: afstand, retourVanafMonument: 2 * afstandVanafMonument / spelerSnelheid };
  });

  // Ticket D29: afstand van de monumentrand tot de twee toekomstige
  // bouwplekken per poort (25 % en 55 % van de lijn poort → monument, zie
  // D10). Kalverstraat loopt via zijn tussenpunt: de lijn is dan poort →
  // tussenpunt → monument, en 25/55 % is een fractie van die hele route.
  function puntOpRoute(poort, fractie) {
    const punten = [poort.positie, ...(poort.tussenpunt ? [poort.tussenpunt] : []), d.MONUMENT_POSITIE];
    const stukken = [];
    for (let i = 0; i < punten.length - 1; i++) stukken.push(Math.hypot(punten[i + 1].x - punten[i].x, punten[i + 1].z - punten[i].z));
    let rest = fractie * stukken.reduce((a, b) => a + b, 0);
    for (let i = 0; i < stukken.length; i++) {
      if (rest <= stukken[i]) {
        const t = rest / stukken[i];
        return { x: punten[i].x + (punten[i + 1].x - punten[i].x) * t, z: punten[i].z + (punten[i + 1].z - punten[i].z) * t };
      }
      rest -= stukken[i];
    }
    return { x: d.MONUMENT_POSITIE.x, z: d.MONUMENT_POSITIE.z };
  }
  const bouwplekAfstanden = d.SPAWN_POORTEN.map(p => ({
    naam: p.naam,
    poort: d.afstandTotMonument(p.positie),
    plek25: d.afstandTotMonument(puntOpRoute(p, 0.25)),
    plek55: d.afstandTotMonument(puntOpRoute(p, 0.55)),
  }));

  return { poortMetingen, langeAsTijd, diagonaal, steunpunten, grens: d.GRENS, bouwplekAfstanden };
});

console.log('=== Robot: poort -> monument (afstandTotMonument, dus tot de doos) ===\n');
for (const p of metingen.poortMetingen) {
  console.log(`${p.naam} — ${p.afstand.toFixed(1)} m`);
  for (const r of p.rijen) {
    console.log(`  wave ${String(r.wave).padStart(2)}: snelheid ${r.snelheidMin.toFixed(2)}–${r.snelheidMax.toFixed(2)} m/s -> ${r.tijdMin.toFixed(1)}–${r.tijdMax.toFixed(1)} s`);
  }
  console.log();
}

console.log('=== Speler: lange as (GRENS-breedte) ===');
console.log(`${metingen.langeAsTijd.toFixed(1)} s (diagonaal ${metingen.diagonaal.toFixed(1)} m)\n`);

console.log('=== Steunpunt heen-en-terug (vanaf het monument) ===');
for (const s of metingen.steunpunten) {
  console.log(`${s.naam}: ${s.retourVanafMonument.toFixed(1)} s retour`);
}

console.log('\n=== Toetsing aan de ontwerpdoelen ===');
console.log('Doel: dichtstbijzijnde poort 15-25s, verste tot ~35s, korter dan 10s = probleem.');
for (const p of metingen.poortMetingen) {
  const plafondRij = p.rijen[p.rijen.length - 1];
  const status = plafondRij.tijdMin < 10 ? '✗ ONDER DE REACTIEDREMPEL' : '✓';
  console.log(`${p.naam.padEnd(14)} bij plafond: ${plafondRij.tijdMin.toFixed(1)}s  ${status}`);
}

console.log('\n=== Ticket D29: monumentrand → bouwplekken (25 % / 55 %) en poort ===');
for (const b of metingen.bouwplekAfstanden) {
  console.log(`${b.naam.padEnd(14)} plek 55 %: ${b.plek55.toFixed(1)} m · plek 25 %: ${b.plek25.toFixed(1)} m · poort: ${b.poort.toFixed(1)} m`);
}

await browser.close();
