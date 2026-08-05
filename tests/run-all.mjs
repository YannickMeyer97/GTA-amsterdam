// Draait alle testscripts in deze map na elkaar (check-*.mjs en test-*.mjs)
// en geeft een gezamenlijke samenvatting. Gebruik: node run-all.mjs
//
// Ticket 78 (v0.20, §8.8.1): één gedeelde Playwright-browser voor de hele
// suite i.p.v. elk script z'n eigen Chromium-launch te laten doen (was de
// dominante vaste kost bij 48+ scripts, ~1.3s launch-overhead per script).
// Elk script draait nu IN dit process via een dynamische import() i.p.v.
// als los kind-proces — helpers.mjs pakt de gedeelde browser via
// globalThis en geeft elk script alsnog zijn eigen, verse browser-context
// (zie helpers.mjs voor de isolatie-garanties). process.exit() wordt
// tijdens elke import tijdelijk vervangen door een registratie-functie
// (scripts eindigen altijd met process.exit(fails>0?1:0), dat mag de hele
// suite niet meteen afkappen) en daarna weer teruggezet.
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scripts = readdirSync(__dirname)
  .filter(f => (f.startsWith('check-') || f.startsWith('test-')) && f.endsWith('.mjs'))
  .sort();

const LOKAAL_CHROMIUM_PAD = '/opt/pw-browsers/chromium';
const executablePathOptie = existsSync(LOKAAL_CHROMIUM_PAD) ? { executablePath: LOKAAL_CHROMIUM_PAD } : {};
const browser = await chromium.launch(executablePathOptie);
globalThis.__AMSTERDAM_UNDEAD_SHARED_BROWSER__ = browser;

// Twee bekende wall-clock-timing-gevoelige scripts (zie ROADMAP.md Ticket 78
// en Ticket 77's waarschuwing over onbetrouwbare frametime in deze headless-
// omgeving) krijgen precies 1 herkansing i.p.v. de suite permanent rood te
// laten kleuren op omgevingsruis — een ECHTE regressie faalt nog steeds
// (twee keer rood telt als fail), en elke herkansing wordt expliciet
// gelogd, niet stilletjes verborgen.
const HERKANSING = new Set(['test-ontsnapping-vensters.mjs', 'test-golf-variatielimiter.mjs']);

// Draait één script IN dit process en geeft de exitcode terug die het
// script zélf aan process.exit() zou hebben meegegeven (standaard 0 als
// het script process.exit() nooit aanroept). Een cache-bustende query
// zorgt dat elke aanroep (ook een herkansing) het bestand ECHT opnieuw
// uitvoert i.p.v. de ESM-modulecache te raken.
async function draaiScript(script) {
  const origExit = process.exit;
  let exitCode = 0;
  process.exit = (code) => { exitCode = code ?? 0; };
  try {
    const url = pathToFileURL(path.join(__dirname, script)).href + '?run=' + Date.now() + '-' + Math.random();
    await import(url);
  } catch (e) {
    console.error(e);
    exitCode = 1;
  } finally {
    process.exit = origExit;
  }
  return exitCode;
}

let fails = 0;
for (const script of scripts) {
  console.log(`\n========== ${script} ==========`);
  let code = await draaiScript(script);
  if (code !== 0 && HERKANSING.has(script)) {
    console.log(`\n(herkansing: ${script} staat bekend als wall-clock-timing-gevoelig in deze omgeving — zie ROADMAP.md Ticket 78)`);
    code = await draaiScript(script);
  }
  if (code !== 0) fails++;
}

await browser.close();
console.log(`\n${scripts.length - fails}/${scripts.length} scripts groen`);
process.exit(fails > 0 ? 1 : 0);
