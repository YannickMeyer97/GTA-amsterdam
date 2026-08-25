// Ticket 136 — meting golf-1-balans met alleen het mes (§12.6/§12.9).
// GEEN testbestand (bewust geen test-/check-prefix: run-all(-parallel).mjs
// ontdekt scripts puur op bestandsnaam-prefix, en dit script is RNG-
// afhankelijk — geen deterministische asserties, dus hoort niet in de
// reguliere regressiesuite). Draait de ECHTE combat-loop
// (updateOndoden/updateGolf/updateSpelerRegen) zonder rendering, met een
// "camp-and-melee"-speler die stilstaat op de startpositie (0,0,-1.5) —
// expliciet "met zicht op de ramen" (speler.positie-comment) — en elke
// levende ondode binnen MES_BEREIK steekt zodra de cooldown het toelaat.
// Meet over N onafhankelijke trials (elk een verse page.reload(), dus een
// vers geseede RNG-run): op welke golf/tijd/HP-verlies €450 (AMSTEL9_PRIJS)
// voor het eerst bereikt wordt.
import { openAmsterdamUndead } from './helpers.mjs';

const N_TRIALS = 20;
const { browser, page } = await openAmsterdamUndead();

const resultaten = [];
for (let i = 0; i < N_TRIALS; i++) {
  if (i > 0) {
    await page.reload();
    await page.waitForTimeout(400);
  }
  const r = await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const dt = 0.05;
    const MAX_STAPPEN = 400000;   // 20.000 sim-seconden veiligheidsplafond
    let stap = 0;
    let simTijd = 0;
    let vorigeHp = d.spelerStaat.hp;
    let totaalSchadeOpgelopen = 0;
    let hpMinimum = d.spelerStaat.hp;
    let bereikt450 = false, tijdBij450 = null, golfBij450 = null, hpVerliesBij450 = null, killsBij450 = null;

    while (stap < MAX_STAPPEN) {
      d.updateOndoden(dt);
      d.updateMes(dt);
      d.updateGolf(dt);
      d.updateSpelerRegen(dt);
      simTijd += dt;
      stap++;

      if (d.spelerStaat.hp < vorigeHp) totaalSchadeOpgelopen += (vorigeHp - d.spelerStaat.hp);
      vorigeHp = d.spelerStaat.hp;
      hpMinimum = Math.min(hpMinimum, d.spelerStaat.hp);

      if (d.mesStaat.cooldownTimer <= 0) {
        let dichtstbij = null, dichtsteAfstand = Infinity;
        for (const o of d.ondoden) {
          const afstand = o.groep.position.distanceTo(d.speler.positie);
          if (afstand <= d.MES_BEREIK && afstand < dichtsteAfstand) { dichtstbij = o; dichtsteAfstand = afstand; }
        }
        if (dichtstbij) {
          d.raakOndode(dichtstbij, dichtstbij.groep.position, false, 1, true, d.MES_SCHADE);
          d.mesStaat.cooldownTimer = d.MES_COOLDOWN;
        }
      }

      if (!bereikt450 && d.spelStaat.geld >= 450) {
        bereikt450 = true;
        tijdBij450 = simTijd;
        golfBij450 = d.spelStaat.golf;
        hpVerliesBij450 = d.spelerStaat.hpMax - d.spelerStaat.hp;
        killsBij450 = d.runStats ? d.runStats.kills : null;
        break;
      }
      if (d.spelerStaat.hp <= 0 || d.spelStaat.gameOver) break;
    }

    return {
      bereikt450, tijdBij450, golfBij450, hpVerliesBij450, killsBij450,
      overleden: d.spelerStaat.hp <= 0 || d.spelStaat.gameOver,
      totaalSchadeOpgelopen, hpMinimum, stappenGebruikt: stap,
      geldEinde: d.spelStaat.geld,
    };
  });
  resultaten.push(r);
  console.log(`trial ${i + 1}/${N_TRIALS}:`, JSON.stringify(r));
}

await browser.close();

const geslaagd = resultaten.filter(r => r.bereikt450);
const gemiddelde = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
console.log('\n=== SAMENVATTING ===');
console.log(`Geslaagd (bereikte €450): ${geslaagd.length}/${N_TRIALS}`);
if (geslaagd.length > 0) {
  console.log(`Gem. golf bij €450: ${gemiddelde(geslaagd.map(r => r.golfBij450)).toFixed(2)}`);
  console.log(`Min/max golf bij €450: ${Math.min(...geslaagd.map(r => r.golfBij450))} / ${Math.max(...geslaagd.map(r => r.golfBij450))}`);
  console.log(`Gem. tijd (sim-seconden) bij €450: ${gemiddelde(geslaagd.map(r => r.tijdBij450)).toFixed(1)}`);
  console.log(`Gem. HP-verlies bij €450 (van 100 max): ${gemiddelde(geslaagd.map(r => r.hpVerliesBij450)).toFixed(1)}`);
  console.log(`Gem. kills bij €450: ${gemiddelde(geslaagd.map(r => r.killsBij450)).toFixed(1)}`);
}
const overleden = resultaten.filter(r => r.overleden && !r.bereikt450);
console.log(`Overleden vóór €450: ${overleden.length}/${N_TRIALS}`);
