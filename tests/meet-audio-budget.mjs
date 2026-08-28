// Ticket 152 — meetscript voor de audio-audit (browserkant).
//
// Levert de twee getallen die AUDIO.md §4 en §5 nodig hebben en die je niet
// kunt beredeneren maar moet meten:
//
//   1. LAADTIJD vs. BESTANDSGROOTTE. Injecteert een synthetische base64-blok
//      van N KB in het spelbestand (exact de vorm die ingesloten samples
//      zouden hebben: een tabel met `data:audio/mpeg;base64,...`-strings) en
//      meet hoe lang het duurt tot `window.AmsterdamUndeadDebug` bestaat.
//      Bewust met random-ish base64: echte samples zijn al gecomprimeerd, dus
//      een blok herhaalde tekens zou gzip/de parser oneerlijk voordeel geven.
//
//   2. PIEK AAN GELIJKTIJDIGE STEMMEN. Wraps createOscillator én (sinds
//      T154) createBufferSource, plus start/stop, en speelt het zwaarst
//      denkbare gevechtsmoment af (Ratelaar-vuurtempo met treffer+kop+kill+
//      doorboring, plus grommen, plus event-geluiden). Bepaalt of
//      voice-limiting/concurrency-beheer nodig is. T152 mat hier 16 zonder
//      ruislaag; T154 voegt per ruisgeluid één bufferbron toe.
//
// De codec-kant (welke bytes kost een sample nou echt) zit in het
// zusterscript `meet-audio-codecs.py` — die heeft een echte MP3/Vorbis-
// encoder nodig en kan dus niet in Node.
//
// Draaien: `node meet-audio-budget.mjs` vanuit tests/.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { openAmsterdamUndead, executablePathOptie } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const THREE_SRC = readFileSync(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'), 'utf8');
const JSM_ROOT = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');
const GAME_PATH = path.join(ROOT, 'amsterdam-undead.html');
const GAME = readFileSync(GAME_PATH, 'utf8');

// --- 1. Laadtijd vs. bestandsgrootte ---------------------------------------

const B64_ALFABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MEET_BESTANDEN = 22;   // ordegrootte van een "kern"-sampleset

function metPayload(kb) {
  if (kb === 0) return GAME;
  const perBestand = Math.round((kb * 1024) / MEET_BESTANDEN);
  let zaad = 12345;
  let blok = 'const T152_MEET_SAMPLES = {\n';
  for (let i = 0; i < MEET_BESTANDEN; i++) {
    let s = '';
    for (let j = 0; j < perBestand; j++) {
      zaad = (zaad * 1103515245 + 12345) & 0x7fffffff;
      s += B64_ALFABET[zaad % 64];
    }
    blok += `  s${i}: 'data:audio/mpeg;base64,${s}',\n`;
  }
  blok += '};\nwindow.__t152 = T152_MEET_SAMPLES;\n';
  // Vóór de module-tag, zodat het blok net als echte ingesloten samples
  // geparsed moet zijn voordat de game-module ook maar begint.
  return GAME.replace('<script type="module">', '<script>\n' + blok + '</script>\n<script type="module">');
}

async function meetLaadtijd(kb, herhalingen = 5) {
  const html = metPayload(kb);
  // Naast het echte bestand, want de CDN-intercept en de relatieve paden
  // moeten identiek blijven. Wordt altijd weer opgeruimd.
  const pad = path.join(ROOT, '__t152-meet.html');
  writeFileSync(pad, html);
  const bytes = statSync(pad).size;
  const browser = await chromium.launch(executablePathOptie);
  const tijden = [];
  try {
    for (let r = 0; r < herhalingen; r++) {
      const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
      const page = await ctx.newPage();
      await page.route('**/three@**', route => {
        const u = route.request().url();
        if (u.includes('/examples/jsm/')) {
          const rel = u.split('/examples/jsm/')[1].split('?')[0];
          return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(JSM_ROOT, rel), 'utf8') });
        }
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: THREE_SRC });
      });
      const t0 = Date.now();
      await page.goto('file://' + pad);
      await page.waitForFunction(() => !!window.AmsterdamUndeadDebug, { timeout: 30000 });
      tijden.push(Date.now() - t0);
      await ctx.close();
    }
  } finally {
    await browser.close();
    unlinkSync(pad);
  }
  tijden.sort((a, b) => a - b);
  const mediaan = tijden[Math.floor(tijden.length / 2)];
  console.log(`  +${String(kb).padStart(4)} KB base64 | bestand ${(bytes / 1024).toFixed(1).padStart(7)} KB | mediaan ${String(mediaan).padStart(5)} ms | spreiding ${tijden[0]}-${tijden[tijden.length - 1]} ms`);
  return { kb, bytes, mediaan };
}

console.log('--- 1. Laadtijd vs. bestandsgrootte (file://, 5 laadbeurten per stap) ---');
const basis = await meetLaadtijd(0);
for (const kb of [120, 250, 600]) {
  const r = await meetLaadtijd(kb);
  const dPct = ((r.mediaan / basis.mediaan - 1) * 100).toFixed(1);
  console.log(`      -> +${r.mediaan - basis.mediaan} ms t.o.v. de basis (${dPct}%)`);
}

// --- 2. Piek aan gelijktijdige oscillators ---------------------------------

console.log('');
console.log('--- 2. Piek aan gelijktijdig levende oscillators (zwaarst denkbare 3 s) ---');
const { browser, page } = await openAmsterdamUndead({ simuleerPointerLock: true });
const stemmen = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  let levend = 0, piek = 0, totaal = 0, oscillators = 0, ruisbronnen = 0;
  const volg = (knoop) => {
    const origStart = knoop.start.bind(knoop), origStop = knoop.stop.bind(knoop);
    knoop.start = (...s) => { levend++; piek = Math.max(piek, levend); return origStart(...s); };
    knoop.stop = (t) => {
      const wacht = Math.max(0, (t ?? ctx.currentTime) - ctx.currentTime);
      setTimeout(() => { levend--; }, wacht * 1000);
      return origStop(t);
    };
    return knoop;
  };
  const origOsc = ctx.createOscillator.bind(ctx);
  const origBuf = ctx.createBufferSource.bind(ctx);
  ctx.createOscillator = (...a) => { totaal++; oscillators++; return volg(origOsc(...a)); };
  ctx.createBufferSource = (...a) => { totaal++; ruisbronnen++; return volg(origBuf(...a)); };
  const t0 = performance.now();
  // 30 stappen van 100 ms = het Canal Ripper-vuurtempo (schotCooldown 0,1 s),
  // met op elk schot de volledige trefferketen. Daar bovenop grommen (2 per
  // 300 ms) en om de seconde een event-cluster. Zwaarder dan het spel zelf
  // ooit wordt: in de praktijk raakt niet elk schot, en niet elke treffer is
  // een kop- én kill-treffer.
  for (let i = 0; i < 30; i++) {
    d.piep('sawtooth', 620, 210, 0.06, 0.1);   // speelSchot (Canal Ripper) — niet geëxporteerd
    d.speelRaakTik(); d.speelKopTik(); d.speelKillKnak(); d.speelDoorboring();
    if (i % 3 === 0) { d.speelOndodeGrom('normaal'); d.speelOndodeGrom('sjouwer'); }
    if (i % 10 === 0) {
      d.speelAanvalGrom('sjouwer');
      d.piep('sawtooth', 90, 30, 0.35, 0.16);   // speelExplosie
      d.piep('sawtooth', 160, 60, 0.18, 0.11);  // speelSpelerAu
    }
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 500));
  ctx.createOscillator = origOsc;
  ctx.createBufferSource = origBuf;
  return { piek, totaal, oscillators, ruisbronnen, duurMs: Math.round(performance.now() - t0) };
});
await browser.close();

console.log(`  Piek gelijktijdig levend : ${stemmen.piek} stemmen`);
console.log(`  Totaal gestart           : ${stemmen.totaal} in ${stemmen.duurMs} ms (${(stemmen.totaal / (stemmen.duurMs / 1000)).toFixed(1)}/s)`);
console.log(`     waarvan oscillators   : ${stemmen.oscillators}`);
console.log(`     waarvan ruisbronnen   : ${stemmen.ruisbronnen}  (T154)`);
console.log('  (de 5 permanente oscillators — dreigingsdrone 2 + akkoordbed 3 — zitten in de piek meegeteld)');
