// Snelle variant van run-all.mjs: draait de suite verdeeld over N kind-
// processen (elk een eigen `node run-all.mjs --shard`, dus elk zijn eigen
// Chromium-instantie) i.p.v. alle scripts sequentieel in één proces.
// Gebruik: node run-all-parallel.mjs
//
// Waarom kind-processen i.p.v. gewoon binnen dit proces parallelliseren:
// run-all.mjs's draaiScript() zet tijdelijk het GLOBALE process.exit om om
// de exitcode van elk dynamisch geïmporteerde testscript op te vangen
// (scripts eindigen zelf met process.exit(...)). Dat patroon is niet
// re-entrant — twee scripts die tegelijk in hetzelfde proces draaien zouden
// elkaars ompatching overschrijven en willekeurige exitcodes opleveren.
// Losse OS-processen hebben elk hun eigen process.exit, dus dat probleem
// bestaat dan niet — de prijs is een aparte Chromium-launch per shard
// (~1-2s), ruimschoots goedgemaakt door de N-voudige parallelliteit bij
// 80+ scripts.
//
// Gedrag blijft verder identiek aan run-all.mjs: zelfde scriptselectie
// (check-*/test-*.mjs), zelfde herkansingslogica (zit al in run-all.mjs
// zelf, per shard), exitcode 0 alleen als alle shards groen zijn.
import { spawn } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scriptAantal = readdirSync(__dirname)
  .filter(f => (f.startsWith('check-') || f.startsWith('test-')) && f.endsWith('.mjs')).length;

// Niet meer shards dan scripts (lege shards zijn zinloos), en een
// redelijke bovengrens zodat dit ook op een kleine machine niet meer
// Chromium-instanties start dan er kernen zijn.
const shardAantal = Math.max(1, Math.min(cpus().length, scriptAantal, 8));

console.log(`run-all-parallel: ${scriptAantal} scripts over ${shardAantal} shard(s) (${cpus().length} kernen gedetecteerd)\n`);

function draaiShard(index) {
  return new Promise((resolve) => {
    const kind = spawn(process.execPath, ['run-all.mjs'], {
      cwd: __dirname,
      env: { ...process.env, AMSTERDAM_UNDEAD_SHARD: `${index}/${shardAantal}` },
    });
    let stdout = '';
    let stderr = '';
    kind.stdout.on('data', (d) => { stdout += d; });
    kind.stderr.on('data', (d) => { stderr += d; });
    kind.on('close', (code) => resolve({ index, code, stdout, stderr }));
  });
}

const shards = await Promise.all(Array.from({ length: shardAantal }, (_, i) => draaiShard(i)));
shards.sort((a, b) => a.index - b.index);

// Output per shard na elkaar afdrukken (niet live interleaved — met N
// gelijktijdige processen zou dat de losse scriptblokken door elkaar
// husselen en onleesbaar maken). Wie een specifiek falend script wil
// isoleren gebruikt nog steeds `node run-all.mjs` (kale, sequentiële vorm,
// ongewijzigd, zie de toelichting daar).
let totaalScripts = 0, totaalFails = 0, kapotteShards = 0;
for (const s of shards) {
  console.log(`\n\n########## SHARD ${s.index}/${shardAantal} ##########`);
  console.log(s.stdout);
  if (s.stderr) console.error(s.stderr);

  const match = s.stdout.match(/SHARD_RESULTAAT (\{.*\})/);
  if (match) {
    const r = JSON.parse(match[1]);
    totaalScripts += r.totaal;
    totaalFails += r.fails;
  } else {
    // Shard leverde geen machine-leesbare trailer (bv. crash vóór het einde
    // van run-all.mjs) — tel 'm als volledig kapot i.p.v. stilzwijgend
    // negeren, anders verdwijnt een hele shard se falen uit de samenvatting.
    kapotteShards++;
    totaalFails++;
  }
  if (s.code !== 0 && match && JSON.parse(match[1]).fails === 0) {
    // Exitcode non-zero terwijl de shard zelf 0 fails rapporteerde kan alleen
    // door een crash ná de samenvatting — ook dat telt als een probleem.
    kapotteShards++;
    totaalFails++;
  }
}

console.log(`\n\n${totaalScripts - totaalFails}/${totaalScripts} scripts groen (${shardAantal} shards)`);
if (kapotteShards > 0) console.log(`${kapotteShards} shard(s) leverden geen bruikbaar resultaat (crash of ontbrekende trailer) — zie hun output hierboven.`);

process.exit(totaalFails > 0 ? 1 : 0);
