// Ticket 153: de audioregistry — data-driven en GEDRAGSNEUTRAAL.
//
// Het acceptatiecriterium van dit ticket is letterlijk "er mag niets anders
// klinken". Dat is met headless tests niet te horen, dus dit script bewijst
// het op de enige manier die wel kan: een volledige, met de hand overgetypte
// waardetabel van hoe elk geluid vóór T153 klonk (de piep()-argumenten uit
// commit 6eab2b2, zie AUDIO.md §1), één-op-één vergeleken met GELUIDEN.
// Verandert er ooit een getal in de registry, dan faalt dit script — en dan
// hoort dat een bewuste speeltoets-bijstelling te zijn met een reden erbij,
// niet een verschuiving die niemand opmerkt.
//
// Daarnaast: de tellers blijven tellen, de vervolgtonen lopen niet meer via
// setTimeout maar over de audioklok, en er zijn geen categorie-gains
// binnengeslopen (T152 §6.2).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Diff-audit: elk piep()-argument van vóór T153 -----------------------
//
// Formaat: naam -> [type, start, eind, duur, volume, [vervolg...]]
// waarbij vervolg = [na, type, start, eind, duur, volume].
// `na` was vóór T153 een setTimeout in MILLIseconden; hier in seconden.
const VOOR_T153 = {
  droogKlik:     ['square',   200,    180,    0.04, 0.06],
  herlaad:       ['sine',     300,    500,    0.15, 0.06],
  herlaadKlaar:  ['sine',     500,    700,    0.12, 0.06],
  wissel:        ['triangle', 260,    420,    0.08, 0.06],
  mesSteek:      ['sawtooth', 380,    90,     0.08, 0.09],
  raakTik:       ['square',   320,    90,     0.07, 0.08],
  kopTik:        ['square',   460,    140,    0.08, 0.09],
  killKnak:      ['sawtooth', 200,    40,     0.14, 0.16, [0,    'sine',     95,  42,   0.26, 0.13]],
  doorboring:    ['triangle', 620,    110,    0.16, 0.07],
  aanvalGromSjouwer: ['sawtooth', 70,  110,   0.5,  0.09],
  aanvalGromSluiper: ['sawtooth', 320, 440,   0.16, 0.07],
  aanvalGromNormaal: ['sawtooth', 150, 220,   0.3,  0.08],
  slagRaak:      ['square',   100,    40,     0.12, 0.1],
  slagMis:       ['sine',     240,    90,     0.22, 0.05],
  spelerAu:      ['sawtooth', 160,    60,     0.18, 0.11],
  plankBreek:    ['sawtooth', 180,    60,     0.09, 0.09],
  explosie:      ['sawtooth', 90,     30,     0.35, 0.16, [0.04, 'square',   60,  25,   0.25, 0.08]],
  stroomklap:    ['square',   700,    380,    0.03, 0.1,  [0.03, 'sawtooth', 120, 40,   0.3,  0.1]],
  stroomHerstel: ['sine',     300,    500,    0.1,  0.06],
  golfStart:     ['sawtooth', 130,    260,    0.18, 0.08, [0.13, 'square',   200, 340,  0.22, 0.06]],
  golfKlaar:     ['sine',     520,    780,    0.14, 0.06, [0.15, 'sine',     780, 1040, 0.16, 0.05]],
  gameOver:      ['sawtooth', 300,    70,     0.5,  0.12, [0.22, 'sine',     160, 50,   0.7,  0.09]],
  finaleLosgooien: ['sawtooth', 90,   260,    0.35, 0.12],
  introMelodie:  ['sine',     440,    440,    0.12, 0.05, [0.13, 'sine', 554.37, 554.37, 0.12, 0.05],
                                                          [0.26, 'sine', 659.25, 659.25, 0.12, 0.05],
                                                          [0.39, 'sine', 880,    880,    0.2,  0.06]],
  koop:          ['triangle', 420,    900,    0.1,  0.07],
  geenGeld:      ['square',   220,    120,    0.12, 0.06],
  smeed:         ['sawtooth', 180,    60,     0.18, 0.09, [0.09, 'triangle', 700, 1100, 0.09, 0.08]],
  druppelTik:    ['sine',     900,    500,    0.05, 0.0345],
  grachtklok:    ['sine',     440,    380,    0.9,  0.0575, [0.55, 'sine',   660, 560,  0.9,  0.04]],
  gangKraak:     ['sawtooth', 90,     40,     0.35, 0.069],
  bijkeukenKraak:['sawtooth', 70,     30,     0.4,  0.0633],
  windvlaag:     ['sine',     200,    260,    1.1,  0.04, [0.3,  'sine',     180, 140,  1.3,  0.0345]],
  verreScheepshoorn: ['triangle', 92, 68,     1.6,  0.8],
  verreStadsklok:['sine',     480,    450,    1.3,  0.6,  [0.38, 'sine',     640, 600,  1.1,  0.4]],
  bootHoorn:     ['sine',     200,    140,    1.1,  0.1],
  bootVertrek:   ['sine',     150,    100,    0.8,  0.08],
};

const registry = await page.evaluate(() => window.AmsterdamUndeadDebug.GELUIDEN);

let afwijkingen = [];
for (const [naam, verwacht] of Object.entries(VOOR_T153)) {
  const g = registry[naam];
  if (!g) { afwijkingen.push(`${naam}: ontbreekt in GELUIDEN`); continue; }
  const [type, start, eind, duur, volume, ...vervolgen] = verwacht;
  if (g.type !== type)     afwijkingen.push(`${naam}.type ${g.type} !== ${type}`);
  if (g.start !== start)   afwijkingen.push(`${naam}.start ${g.start} !== ${start}`);
  if (g.eind !== eind)     afwijkingen.push(`${naam}.eind ${g.eind} !== ${eind}`);
  if (g.duur !== duur)     afwijkingen.push(`${naam}.duur ${g.duur} !== ${duur}`);
  if (g.volume !== volume) afwijkingen.push(`${naam}.volume ${g.volume} !== ${volume}`);
  const heeft = g.vervolg || [];
  if (heeft.length !== vervolgen.length) {
    afwijkingen.push(`${naam}: ${heeft.length} vervolgtonen, verwacht ${vervolgen.length}`);
    continue;
  }
  vervolgen.forEach((v, i) => {
    const [na, vtype, vstart, veind, vduur, vvolume] = v;
    const h = heeft[i];
    // Marge op `na`: de oude waarden waren gehele milliseconden.
    if (Math.abs(h.na - na) > 1e-9) afwijkingen.push(`${naam}.vervolg[${i}].na ${h.na} !== ${na}`);
    if (h.type !== vtype)     afwijkingen.push(`${naam}.vervolg[${i}].type ${h.type} !== ${vtype}`);
    if (h.start !== vstart)   afwijkingen.push(`${naam}.vervolg[${i}].start ${h.start} !== ${vstart}`);
    if (h.eind !== veind)     afwijkingen.push(`${naam}.vervolg[${i}].eind ${h.eind} !== ${veind}`);
    if (h.duur !== vduur)     afwijkingen.push(`${naam}.vervolg[${i}].duur ${h.duur} !== ${vduur}`);
    if (h.volume !== vvolume) afwijkingen.push(`${naam}.vervolg[${i}].volume ${h.volume} !== ${vvolume}`);
  });
}
check(`Alle ${Object.keys(VOOR_T153).length} geluiden hebben exact hun waarden van vóór T153 (diff-audit)`,
  afwijkingen.length === 0, afwijkingen.slice(0, 12));

// De per-wapen tonen komen uit ARSENAAL, niet uit de tabel — GELUIDEN.schot
// draagt alleen het gedeelde volume.
const schot = registry.schot;
check('GELUIDEN.schot draagt alleen type+volume (toon komt per wapen uit ARSENAAL)',
  schot.type === 'sawtooth' && schot.volume === 0.1 && schot.start === undefined && schot.duur === undefined, schot);

// --- 2. Dekking: elk geluid heeft een categorie, geen enkele een gain-bus --
const dekking = await page.evaluate(() => {
  const G = window.AmsterdamUndeadDebug.GELUIDEN;
  const namen = Object.keys(G);
  return {
    aantal: namen.length,
    zonderCategorie: namen.filter(n => !G[n].categorie),
    categorieen: [...new Set(namen.map(n => G[n].categorie))].sort(),
    metGain: namen.filter(n => G[n].gain !== undefined || G[n].gainNode !== undefined),
    stadBus: namen.filter(n => G[n].bus === 'stad').sort(),
  };
});
check('Elk registry-geluid heeft een categorie', dekking.zonderCategorie.length === 0, dekking);
check('Precies de twee stadsbed-gebeurtenissen staan op bus "stad"',
  dekking.stadBus.length === 2 && dekking.stadBus[0] === 'verreScheepshoorn' && dekking.stadBus[1] === 'verreStadsklok', dekking);
check('Geen enkel geluid draagt een eigen gain-bus (T152 §6.2: geen categorie-gains)',
  dekking.metGain.length === 0, dekking);

// --- 3. De eigen ketens staan BEWUST buiten de registry --------------------
const buitenTabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const G = d.GELUIDEN;
  return {
    geenOndodeGrom: G.ondodeGrom === undefined,
    geenNevelklok: G.nevelklok === undefined && G.nevelklokToon === undefined,
    geenBootHoornGericht: G.bootHoornGericht === undefined,
    gromNogSteedsEigenKeten: /createBiquadFilter/.test(d.speelOndodeGrom.toString()),
    gerichteHoornNogSteedsEigenKeten: /createStereoPanner/.test(d.speelBootHoornGericht.toString()),
  };
});
check('speelOndodeGrom staat niet in de tabel en houdt zijn eigen filterketen',
  buitenTabel.geenOndodeGrom && buitenTabel.gromNogSteedsEigenKeten, buitenTabel);
check('speelNevelklokToon (akkoordbed-envelope) staat niet in de tabel', buitenTabel.geenNevelklok, buitenTabel);
check('speelBootHoornGericht staat niet in de tabel en houdt zijn eigen panner',
  buitenTabel.geenBootHoornGericht && buitenTabel.gerichteHoornNogSteedsEigenKeten, buitenTabel);

// --- 4. De tellers blijven exact tellen ------------------------------------
const tellers = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const meet = (naam, fn) => {
    const voor = d[naam];
    fn();
    return d[naam] - voor;
  };
  return {
    herlaadStart: meet('herlaadStartTeller', () => d.speelHerlaad()),
    herlaadKlaar: meet('herlaadKlaarTeller', () => d.speelHerlaadKlaar()),
    wissel: meet('wisselTeller', () => d.speelWissel()),
    mesSteek: meet('mesSteekTeller', () => d.speelMesSteek()),
    raakTik: meet('raakTikTeller', () => d.speelRaakTik()),
    kopTik: meet('kopTikTeller', () => d.speelKopTik()),
    killKnak: meet('killKnakTeller', () => d.speelKillKnak()),
    doorboring: meet('doorboringTeller', () => d.speelDoorboring()),
    aanvalGrom: meet('aanvalGromTeller', () => d.speelAanvalGrom('sjouwer')),
    slagRaak: meet('slagRaakTeller', () => d.speelSlagRaak()),
    slagMis: meet('slagMisTeller', () => d.speelSlagMis()),
    stroomklap: meet('stroomklapTeller', () => d.speelStroomklap()),
    stroomHerstel: meet('stroomHerstelTeller', () => d.speelStroomHerstel()),
    druppelTik: meet('druppelTikTeller', () => d.speelDruppelTik()),
    stadHoorn: meet('stadHoornTeller', () => d.speelVerreScheepshoorn()),
    stadKlok: meet('stadKlokTeller', () => d.speelVerreStadsklok()),
    introMelodie: meet('introMelodieTeller', () => d.speelIntroMelodie()),
    bootHoorn: meet('bootHoornTeller', () => d.speelBootHoorn()),
    finaleLosgooien: meet('finaleLosgooienTeller', () => d.speelFinaleLosgooien()),
  };
});
const nietEen = Object.entries(tellers).filter(([, v]) => v !== 1);
check('Elke wrapper verhoogt zijn eigen teller nog steeds met exact 1',
  nietEen.length === 0, { nietEen, tellers });

// --- 5. Vervolgtonen lopen over de audioklok, niet meer via setTimeout -----
const klokTest = await page.evaluate(() => new Promise((resolve) => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  const orig = ctx.createOscillator.bind(ctx);
  const starts = [];
  ctx.createOscillator = (...a) => {
    const o = orig(...a);
    const origStart = o.start.bind(o);
    o.start = (t) => { starts.push(t === undefined ? ctx.currentTime : t); return origStart(t); };
    return o;
  };
  const nu = ctx.currentTime;
  d.speelGeluid('gameOver');   // hoofdtoon + vervolg na 0,22 s
  // GEEN wachttijd: als de vervolgtoon nog via setTimeout liep, was hij nu
  // nog niet aangemaakt. Beide oscillators moeten er meteen al staan.
  const meteen = starts.length;
  ctx.createOscillator = orig;
  resolve({ meteen, offsets: starts.map(t => +(t - nu).toFixed(3)) });
}));
check('speelGeluid() plant hoofdtoon én vervolgtoon meteen (geen setTimeout meer)',
  klokTest.meteen === 2, klokTest);
check('De vervolgtoon van gameOver staat exact 0,22 s ná de hoofdtoon op de audioklok',
  Math.abs((klokTest.offsets[1] - klokTest.offsets[0]) - 0.22) < 0.002, klokTest);

// Niet alle tien staan op de debug-hook, dus dit gaat over de broncode zelf:
// er mag in het HELE bestand geen `setTimeout(() => piep(...))` meer staan.
const bron = readFileSync(path.join(__dirname, '..', 'amsterdam-undead.html'), 'utf8');
const resterendeTimers = bron.match(/setTimeout\(\(\) => (piep|stadPiep)\(/g) || [];
check('Nergens in het bestand staat nog een setTimeout-vervolgtoon (waren er 12 in 10 functies)',
  resterendeTimers.length === 0, resterendeTimers);

const geenTimers = await page.evaluate(() => ({
  speelGeluidGeenSetTimeout: !/setTimeout/.test(window.AmsterdamUndeadDebug.speelGeluid.toString()),
}));
check('speelGeluid() zelf gebruikt geen setTimeout', geenTimers.speelGeluidGeenSetTimeout, geenTimers);

// --- 6. pitch-variatie werkt door tot in de vervolgtonen -------------------
const pitchTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  const orig = ctx.createOscillator.bind(ctx);
  const freqs = [];
  ctx.createOscillator = (...a) => {
    const o = orig(...a);
    const origSet = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { freqs.push(v); return origSet(v, t); };
    return o;
  };
  d.speelGeluid('killKnak', { pitch: 2 });
  ctx.createOscillator = orig;
  return { freqs };
});
// killKnak: hoofdtoon start 200, onderlaag start 95 — beide x2.
check('pitch schaalt de hoofdtoon (200 -> 400)', pitchTest.freqs[0] === 400, pitchTest);
check('pitch schaalt óók de vervolgtoon/onderlaag (95 -> 190)', pitchTest.freqs[1] === 190, pitchTest);

// --- 7. piep()'s kale keten blijft ongewijzigd (T153-acceptatie) -----------
const keten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bron = d.piep.toString();
  return {
    masterGain: /connect\(masterGainNode\)/.test(bron),
    geenDestination: !/connect\(audio\.destination\)/.test(bron),
    startTijdParam: /function piep\(type, startHz, eindHz, duur, volume, pan, startTijd\)/.test(bron),
  };
});
check('piep() connect nog steeds op masterGainNode', keten.masterGain, keten);
check('piep() connect nog steeds nooit rechtstreeks op audio.destination', keten.geenDestination, keten);
check('piep() heeft de nieuwe optionele startTijd-parameter', keten.startTijdParam, keten);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
