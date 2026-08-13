// Ticket 88 (v0.22, §10.14.4-beslissing 93): maakt een genummerde set
// screenshots vanaf de acht vaste, bevroren camerastandpunten uit
// helpers.mjs (zelfde standpunten en dezelfde bevriezing als
// test-visuele-basislijn.mjs — zie die daar voor de twee/drie meetvallen
// die dit mechanisme oplost). Elk ticket in ronde 8 (v0.22) hoort dit vóór
// en ná zijn wijziging te draaien; de set die dit script bij T88 zelf
// produceert is de "voor"-referentie voor de hele ronde.
//
// GEEN testscript: geen check()/report(), geen exitcode-conventie, wordt
// bewust NIET automatisch opgepikt door run-all.mjs (de bestandsnaam begint
// niet met test-/check-). Handmatig draaien.
//
// Gebruik:
//   node maak-beeldverslag.mjs [label]
//   node maak-beeldverslag.mjs voor-T90
//   node maak-beeldverslag.mjs na-T90
//
// Output: tests/beeldverslag/<label>/<standpunt>.png (dat pad is
// gitignored — zie .gitignore: tientallen PNG's per ticket hebben geen
// historische waarde zodra het volgende ticket eroverheen bouwt).
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const label = process.argv[2] ?? new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(__dirname, 'beeldverslag', label);
mkdirSync(outDir, { recursive: true });

console.log(`Beeldverslag "${label}" → ${outDir}`);

const { browser, page } = await openVoorVisueleMeting();
const punten = await berekenVisueleStandpunten(page);

let i = 1;
for (const sp of punten) {
  await zetVisueelStandpunt(page, sp);
  const bestand = `${String(i).padStart(2, '0')}-${sp.naam}.png`;
  await page.screenshot({ path: path.join(outDir, bestand) });
  console.log(`  [${i}/${punten.length}] ${bestand}`);
  i++;
}

await browser.close();
console.log(`Klaar: ${punten.length} opnamen in ${outDir}`);
