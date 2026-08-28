// Ticket 136 (§12.9, Fix 6 afsluiter): golf-1-balans met alleen het mes.
// Geen exacte-tuning-asserties (RNG-afhankelijk: spawn-timing, aanval-
// jitter, vanaf golf 3 ook het sjouwer/normaal-mengsel) — dit bewaakt de
// CONCLUSIE van de meting (tests/t136-golf1-meting.mjs, N=20, zie ook de
// commentaar bij AMSTEL9_PRIJS): een "camp-and-melee"-speler die stilstaat
// op de startpositie en alles binnen MES_BEREIK steekt zodra de cooldown
// het toelaat, haalt €450 ruim binnen golf 2-3 en overleeft dat altijd.
// Bewust ruime marges — dit moet een ECHTE regressie vangen (bv. de
// geldAlsKop-vlag die per ongeluk wegvalt, of MES_SCHADE die de 1-hit-kill
// breekt), niet elke kleine balansschuif.
import { openAmsterdamUndead } from './helpers.mjs';

const N_TRIALS = 5;
const { browser, page, errs } = await openAmsterdamUndead();

async function simuleerTrial() {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const dt = 0.05;
    const MAX_STAPPEN = 400000;
    let stap = 0;
    let bereikt450 = false, golfBij450 = null, hpVerliesBij450 = null;

    while (stap < MAX_STAPPEN) {
      d.updateOndoden(dt);
      d.updateMes(dt);
      d.updateGolf(dt);
      d.updateSpelerRegen(dt);
      stap++;

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
        golfBij450 = d.spelStaat.golf;
        hpVerliesBij450 = d.spelerStaat.hpMax - d.spelerStaat.hp;
        break;
      }
      if (d.spelerStaat.hp <= 0 || d.spelStaat.gameOver) break;
    }
    return {
      bereikt450, golfBij450, hpVerliesBij450,
      overleefd: d.spelerStaat.hp > 0 && !d.spelStaat.gameOver,
    };
  });
}

const resultaten = [];
for (let i = 0; i < N_TRIALS; i++) {
  if (i > 0) { await page.reload(); await page.waitForTimeout(400); }
  resultaten.push(await simuleerTrial());
}

let fails = 0;
function check(label, ok, data) {
  if (ok) { console.log(`[OK  ] ${label}`); }
  else { console.log(`[FAIL] ${label} —`, JSON.stringify(data)); fails++; }
}

check(`Alle ${N_TRIALS} camp-and-melee-trials bereiken €450 (AMSTEL9_PRIJS) ruim binnen een veilig aantal golven`,
  resultaten.every(r => r.bereikt450 && r.golfBij450 >= 1 && r.golfBij450 <= 6), resultaten);
check('Geen enkele trial sterft onderweg naar €450 (de mes-opening is gespannen, niet fataal)',
  resultaten.every(r => r.overleefd), resultaten);
check('Het HP-verlies bij €450 blijft in elke trial onder de 100 (speler overleeft met marge, geen near-wipe elke run)',
  resultaten.every(r => r.hpVerliesBij450 < 100), resultaten);

console.log(`\n${N_TRIALS - fails} OK, ${fails} FAIL`);
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
process.exit(fails > 0 || errs.length > 0 ? 1 : 0);
