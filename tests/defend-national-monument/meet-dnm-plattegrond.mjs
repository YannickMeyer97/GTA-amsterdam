// Ticket D31 (SONNET_EXECUTION_PLAN_monument.md §11.5) — toetst de
// plattegrond in docs/defend-national-monument/PLATTEGROND.html.
//
// De pagina rekent alles zelf uit de ingesloten indeling (JSON) en zet de
// uitkomst op window.PLATTEGROND. Dit script laadt haar headless, drukt de
// toetsen af en eindigt met exitcode 1 als er één faalt.
//
// Wordt bewust NIET opgepikt door run-all.mjs (naam begint met meet-): dit
// toetst een ontwerpdocument, niet de game. Vanaf D32 neemt
// test-dnm-layout.mjs het over, tegen DAM_LAYOUT in de game zelf.
//
// Draaien: `node meet-dnm-plattegrond.mjs [schermafbeelding.png]` vanuit
// tests/defend-national-monument/.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { executablePathOptie } from '../helpers-defend.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGINA = path.join(__dirname, '..', '..', 'docs', 'defend-national-monument', 'PLATTEGROND.html');
const schermafbeelding = process.argv[2];

const browser = await chromium.launch(executablePathOptie);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const fouten = [];
page.on('pageerror', e => fouten.push(String(e)));
page.on('console', m => { if (m.type() === 'error') fouten.push(m.text()); });
await page.goto(pathToFileURL(PAGINA).href);
const uitkomst = await page.evaluate(() => window.PLATTEGROND && {
  toetsen: window.PLATTEGROND.toetsen,
  routes: window.PLATTEGROND.routeMetingen.map(m => ({ poort: m.poort, lengte: +m.lengte.toFixed(1), poortTotRand: +m.poortTotRand.toFixed(1), inBereik: Math.round(m.fractieInBereik * 100), plafond: +m.tijdPlafond.toFixed(1) })),
  plekken: window.PLATTEGROND.plekMetingen.map(p => ({ route: p.route, soort: p.soort, totRand: +p.totRand.toFixed(1), hek: +p.hek.breedte.toFixed(1), vrij: +p.vrijVanEigenRoute.toFixed(2) })),
  kerkklokRetour: +window.PLATTEGROND.kerkklokRetour.toFixed(1),
});
if (schermafbeelding) await page.screenshot({ path: schermafbeelding, fullPage: true });
await browser.close();

if (!uitkomst) {
  console.log('window.PLATTEGROND ontbreekt — de pagina rekende niet.', fouten);
  process.exit(1);
}
console.table(uitkomst.routes);
console.table(uitkomst.plekken);
console.log('Kerkklok retour:', uitkomst.kerkklokRetour, 's');
let fails = 0;
for (const t of uitkomst.toetsen) {
  if (!t.goed) fails++;
  console.log(`${t.goed ? 'PASS' : 'FAIL'}  ${t.naam}${t.detail ? `  (${t.detail})` : ''}`);
}
if (fouten.length) { fails++; console.log('Paginafouten:', fouten); }
console.log(`\n${uitkomst.toetsen.length - fails}/${uitkomst.toetsen.length} goed`);
process.exit(fails > 0 ? 1 : 0);
