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
// Feedback (gebruiker: "kan de full regressie ingekort worden?"): dit
// script blijft ONGEWIJZIGD van gedrag bij een kale `node run-all.mjs`
// (alle scripts, één browser, sequentieel) — dat blijft de betrouwbare,
// makkelijk te lezen vorm voor als je een falend script wil isoleren.
// De WINST zit in `run-all-parallel.mjs` (nieuw), dat dit bestand een paar
// keer als kind-proces spawnt, elk met een eigen "shard" (een deel van de
// scripts, via de twee env vars hieronder) en dus een eigen browser — zie
// de toelichting daar voor waarom dat sneller EN even betrouwbaar is dan
// scripts binnen één proces proberen te parallelliseren (dat laatste kan
// niet veilig: draaiScript() hieronder zet tijdelijk het GLOBALE
// `process.exit` om, en twee gelijktijdige scripts in hetzelfde proces
// zouden elkaars ompatching overschrijven).
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let scripts = readdirSync(__dirname)
  .filter(f => (f.startsWith('check-') || f.startsWith('test-')) && f.endsWith('.mjs'))
  .sort();

// Sharding, uitsluitend via env vars — geen CLI-args, zodat een kale
// `node run-all.mjs` (bestaande gewoonte, ROADMAP.md/SONNET_EXECUTION_
// PLAN.md/CLAUDE.md verwijzen er allemaal naar) exact ongewijzigd blijft.
// AMSTERDAM_UNDEAD_SHARD = "index/aantal", bijv. "0/4" = elk vierde script
// vanaf index 0. Ontbreekt de env var, dan is dit een volledige run.
const shardEnv = process.env.AMSTERDAM_UNDEAD_SHARD;
let shardIndex = 0, shardAantal = 1;
if (shardEnv) {
  const [i, n] = shardEnv.split('/').map(Number);
  if (Number.isInteger(i) && Number.isInteger(n) && n > 0 && i >= 0 && i < n) {
    shardIndex = i; shardAantal = n;
    scripts = scripts.filter((_, idx) => idx % shardAantal === shardIndex);
  } else {
    console.error(`Ongeldige AMSTERDAM_UNDEAD_SHARD="${shardEnv}" (verwacht "index/aantal"), val terug op een volledige run.`);
  }
}

const LOKAAL_CHROMIUM_PAD = '/opt/pw-browsers/chromium';
const executablePathOptie = existsSync(LOKAAL_CHROMIUM_PAD) ? { executablePath: LOKAAL_CHROMIUM_PAD } : {};
const browser = await chromium.launch(executablePathOptie);
globalThis.__AMSTERDAM_UNDEAD_SHARED_BROWSER__ = browser;

// Bekende wall-clock-timing-gevoelige scripts (zie ROADMAP.md Ticket 78
// en Ticket 77's waarschuwing over onbetrouwbare frametime in deze headless-
// omgeving) krijgen precies 1 herkansing i.p.v. de suite permanent rood te
// laten kleuren op omgevingsruis — een ECHTE regressie faalt nog steeds
// (twee keer rood telt als fail), en elke herkansing wordt expliciet
// gelogd, niet stilletjes verborgen.
// test-omgeving-sfeer.mjs (Fix 2, ronde 9): ontdekt tijdens het bouwen van
// run-all-parallel.mjs — zijn lampDipFactor-hersteltoets (een strikte
// `=== 1` na een vaste page.waitForTimeout(850)) faalde 2 van de 3 keer bij
// standalone, SEQUENTIËLE runs (dus niet eens onder parallelle CPU-druk),
// exact het bekende patroon van de andere twee scripts hier.
// test-texturenset.mjs (Fix 2, ronde 9): heeft één harde perf-budget-toets
// (< 100ms) die standalone ruim binnen budget blijft (~90ms) maar onder de
// CPU-druk van 3 gelijktijdige shards ruim overschrijdt (~340ms) — een
// contentie-artefact van het parallel draaien, geen echte regressie. Onder
// AANHOUDENDE 4-voudige belasting (de hele suite-duur, niet een kort
// piekje) kan zelfs de herkansing nog eens roodkleuren — zie de toelichting
// in tests/README.md over wanneer je terugvalt op de kale, sequentiële vorm.
// test-achtergrondmuziek.mjs + test-hitmarker-audio.mjs (Fix 2, ronde 9):
// beide hebben een "vlak-na-het-triggeren-moment" page.waitForTimeout()-
// venster (nevelklok-zwel resp. hitmarker-tier-samenval) dat standalone
// altijd groen is (3/3 herhaald) maar onder parallelle CPU-druk af en toe
// net misgrijpt — zelfde contentie-patroon als de twee scripts hierboven.
// test-levend-water.mjs (Fix 1, ronde 9 — water bleed): de bit-voor-bit-
// determinismetoets opent een VERSE pagina waar de nieuwe dokwaterMateriaal
// (het aparte watervlak naast de vlonder) voor het eerst moet compileren
// (lazy onBeforeCompile); een extra warm-up-ronde in het script zelf
// verkleint het risico al fors, maar onder aanhoudende zware belasting kan
// die compile nog steeds net over de twee vergeleken screenshots heen
// lopen — zelfde contentie-patroon als de rest van deze set.
const HERKANSING = new Set([
  'test-ontsnapping-vensters.mjs', 'test-golf-variatielimiter.mjs',
  'test-omgeving-sfeer.mjs', 'test-texturenset.mjs',
  'test-achtergrondmuziek.mjs', 'test-hitmarker-audio.mjs',
  'test-levend-water.mjs',
]);

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
// Machine-leesbare regel voor run-all-parallel.mjs — de mens-leesbare regel
// hierboven blijft ONGEWIJZIGD (bestaande gewoonte/tooling elders leest
// mogelijk die exacte tekst), dit is puur een extra, apart te herkennen
// trailer voor de orkestrator.
if (shardEnv) console.log(`SHARD_RESULTAAT ${JSON.stringify({ shardIndex, shardAantal, totaal: scripts.length, fails })}`);
process.exit(fails > 0 ? 1 : 0);
