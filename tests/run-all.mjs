// Draait alle testscripts in deze map na elkaar (check-*.mjs en test-*.mjs)
// en geeft een gezamenlijke samenvatting. Gebruik: node run-all.mjs
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scripts = readdirSync(__dirname)
  .filter(f => (f.startsWith('check-') || f.startsWith('test-')) && f.endsWith('.mjs'))
  .sort();

let fails = 0;
for (const script of scripts) {
  console.log(`\n========== ${script} ==========`);
  const res = spawnSync('node', [script], { cwd: __dirname, stdio: 'inherit' });
  if (res.status !== 0) fails++;
}

console.log(`\n${scripts.length - fails}/${scripts.length} scripts groen`);
process.exit(fails > 0 ? 1 : 0);
