// Ticket 154 — meet hoe hard de ruislaag daadwerkelijk klinkt t.o.v. de
// getoonde laag van hetzelfde geluid.
//
// WAAROM DIT SCRIPT BESTAAT. De eerste afstelling van T154 zette de
// ruisvolumes op ~0,6x het toonvolume, in de veronderstelling dat dat "ruis
// duidelijk onder de toon" betekende. Dat was fout, en het scheelde 5 tot 23
// dB: een lowpass op bijvoorbeeld 1300 Hz laat maar ~6% van het VERMOGEN van
// witte ruis door, terwijl piep()'s volume de piekamplitude is van een
// golfvorm waarvan alle energie in één smalle band zit. De ruis was daardoor
// bij de meeste geluiden gewoon onhoorbaar — en een test die de nominale
// getallen met elkaar vergeleek zag daar niets van.
//
// Vandaar deze meting: render elke ruislaag én de bijbehorende toonlaag apart
// in een OfflineAudioContext (dus met de échte spelcode, niet met een
// nagebouwde formule) en vergelijk de RMS. Zit een geluid buiten de band
// hieronder, dan is het ofwel onhoorbaar ofwel het overstemt de toon die de
// identiteit draagt.
//
// Draaien: `node meet-ruislaag.mjs` vanuit tests/.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { executablePathOptie } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THREE_SRC = readFileSync(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'), 'utf8');
const JSM_ROOT = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');

// Doelverhouding per geluid (dB, ruis t.o.v. toon), met de reden erbij.
// Een whoosh en een windvlaag ZIJN ruis, dus die mogen op of boven de toon;
// een treffer heeft een toon die de wapenidentiteit draagt, dus die blijft
// duidelijk leidend.
const DOEL = {
  schot: -3, droogKlik: -3, herlaad: -4, herlaadKlaar: -4, mesSteek: -5,
  raakTik: -6, kopTik: -6, killKnak: -6, slagRaak: -6, slagMis: 0,
  plankBreek: -1, explosie: -3, gangKraak: -4, bijkeukenKraak: -4, windvlaag: 2,
  // De keelruis van de grommen (GROM_PROFIELEN.ruisVolume): rasp die er
  // duidelijk is, maar waar de stemtoon overheen blijft liggen.
  grom_sjouwer: -6, grom_brander: -6, grom_normaal: -6,
};
const MARGE = 2.5;   // dB — ruimer dan de meetruis, strakker dan hoorbaar drift

const browser = await chromium.launch(executablePathOptie);
const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
const page = await context.newPage();
await page.addInitScript(() => {
  window.__r = { offset: 0 };
  const Echt = window.OfflineAudioContext;
  window.AudioContext = function () {
    const o = new Echt(1, 44100 * 320, 44100);
    window.__r.ctx = o;
    return new Proxy(o, {
      get(d, p) {
        if (p === 'currentTime') return window.__r.offset;
        if (p === 'state') return 'running';
        if (p === 'resume' || p === 'suspend') return () => Promise.resolve();
        const w = d[p];
        return typeof w === 'function' ? w.bind(d) : w;
      },
    });
  };
  window.webkitAudioContext = window.AudioContext;
});
await page.route('**/three@**', r => {
  const u = r.request().url();
  if (u.includes('/examples/jsm/')) {
    const rel = u.split('/examples/jsm/')[1].split('?')[0];
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(JSM_ROOT, rel), 'utf8') });
  }
  return r.fulfill({ status: 200, contentType: 'text/javascript', body: THREE_SRC });
});
await page.goto('file://' + path.join(__dirname, '..', 'amsterdam-undead.html'));
await page.waitForFunction(() => !!window.AmsterdamUndeadDebug, { timeout: 30000 });

const SLOT = 1.5;
const res = await page.evaluate(async (SLOT) => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const R = window.__r, G = d.GELUIDEN;
  const plan = [];
  let t = 0.2;
  // speelRuis() randomiseert afspeelsnelheid (±8%) en startpunt in de buffer,
  // dus één meting schommelt ~2 dB. Vier per conditie middelen dat weg.
  const HERHALINGEN = 4;
  for (const naam of Object.keys(G).filter(n => G[n].ruis)) {
    const g = G[naam];
    for (let i = 0; i < HERHALINGEN; i++) {
      R.offset = t;
      d.speelRuis(g.ruis, { startTijd: t });
      plan.push({ naam, soort: 'ruis', start: t }); t += SLOT;
    }
    for (let i = 0; i < HERHALINGEN; i++) {
      R.offset = t;
      if (g.start !== undefined) {
        d.piep(g.type, g.start, g.eind, g.duur, g.volume, 0, t);
        if (g.vervolg) for (const v of g.vervolg) d.piep(v.type, v.start, v.eind, v.duur, v.volume, 0, t + v.na);
      } else {
        // `schot`: toon komt per wapen uit ARSENAAL — neem de Canal Ripper.
        const s = d.WAPEN_RATELAAR ? d.WAPEN_RATELAAR.schotToon : { start: 620, eind: 210, duur: 0.06 };
        d.piep(g.type, s.start, s.eind, s.duur, g.volume, 0, t);
      }
      plan.push({ naam, soort: 'toon', start: t }); t += SLOT;
    }
  }
  // De keelruis van de grommen zit niet in GELUIDEN maar in GROM_PROFIELEN,
  // en loopt door hetzelfde filter als de oscillators. Daar is de ruis niet
  // los te renderen, dus we meten hem als verschil: één grom mét en één
  // zónder keelruis. De ruisbijdrage volgt uit het energieverschil.
  // Elke grom krijgt ±7% toonhoogtevariatie (GROM_TOONHOOGTE_VARIATIE), dus
  // één meting per conditie schommelt zo'n 2 dB. Vijf grommen per conditie
  // middelen dat weg — beter dan de marge oprekken tot de ruis erin past.
  const GROMMEN = 5;
  for (const type of Object.keys(d.GROM_PROFIELEN)) {
    const p = d.GROM_PROFIELEN[type];
    const bewaard = p.ruisVolume;
    for (const [soort, volume] of [['toon', 0], ['samen', bewaard]]) {
      p.ruisVolume = volume;
      for (let i = 0; i < GROMMEN; i++) {
        R.offset = t; d.speelOndodeGrom(type);
        plan.push({ naam: 'grom_' + type, soort, start: t }); t += SLOT;
      }
    }
    p.ruisVolume = bewaard;
  }
  const buf = await R.ctx.startRendering();
  return { plan, data: Array.from(buf.getChannelData(0).slice(0, Math.ceil((t + 0.5) * 44100))) };
}, SLOT);
await browser.close();

const sr = 44100;
const rms = (start) => {
  const a = Math.round(start * sr), b = Math.round((start + SLOT - 0.1) * sr);
  let som = 0;
  for (let i = a; i < b; i++) som += res.data[i] * res.data[i];
  return Math.sqrt(som / (b - a));
};

const gemiddeldeRms = (naam, soort) => {
  const starts = res.plan.filter(p => p.naam === naam && p.soort === soort).map(p => p.start);
  // Vermogens middelen, niet amplitudes — dat is wat optelt.
  return Math.sqrt(starts.reduce((a, s) => a + rms(s) ** 2, 0) / starts.length);
};

console.log(`${'geluid'.padEnd(16)}${'ruis'.padStart(10)}${'toon'.padStart(10)}${'gemeten'.padStart(10)}${'doel'.padStart(7)}${'afwijking'.padStart(11)}`);
let buiten = 0;
const regel = (naam, r, o) => {
  const db = 20 * Math.log10(r / o);
  const doel = DOEL[naam];
  const af = db - doel;
  const buitenMarge = Math.abs(af) > MARGE;
  if (buitenMarge) buiten++;
  console.log(`${naam.padEnd(16)}${r.toFixed(6).padStart(10)}${o.toFixed(6).padStart(10)}${(db.toFixed(1) + ' dB').padStart(10)}${String(doel).padStart(7)}${((af >= 0 ? '+' : '') + af.toFixed(1)).padStart(11)}${buitenMarge ? '  <-- buiten marge' : ''}`);
};

for (const naam of [...new Set(res.plan.filter(p => p.soort === 'ruis').map(p => p.naam))]) {
  regel(naam, gemiddeldeRms(naam, 'ruis'), gemiddeldeRms(naam, 'toon'));
}
console.log('');
for (const naam of [...new Set(res.plan.filter(p => p.soort === 'samen').map(p => p.naam))]) {
  const toon = gemiddeldeRms(naam, 'toon');
  const samen = gemiddeldeRms(naam, 'samen');
  // Ruis en toon zijn ongecorreleerd, dus hun vermogens tellen op.
  const ruis = Math.sqrt(Math.max(0, samen * samen - toon * toon));
  regel(naam, ruis, toon);
}
console.log('');
console.log(buiten === 0
  ? `Alle ${Object.keys(DOEL).length} ruislagen binnen ±${MARGE} dB van hun doel.`
  : `${buiten} ruislaag/lagen buiten de marge van ±${MARGE} dB — bijstellen in GELUIDEN resp. GROM_PROFIELEN.`);
process.exit(buiten === 0 ? 0 : 1);
