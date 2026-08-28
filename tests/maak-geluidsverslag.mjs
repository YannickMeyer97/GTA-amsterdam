// Ticket 154 — geluidsverslag: rendert ELK geluid van Amsterdam Undead naar
// een WAV, plus een manifest met wat het is en wanneer je het hoort.
//
// De truc: niet de synthese in Node nabouwen (die zou meteen uit de pas gaan
// lopen met het spel), maar window.AudioContext vervangen door een proxy om
// een OfflineAudioContext heen. initGeluid() bouwt dan zijn hele keten in die
// offline context, en elke speel*()-aanroep plant zijn tonen op de audioklok.
// Het enige dat de proxy toevoegt is een STUURBARE currentTime: door die vóór
// elke aanroep op te hogen zetten we de geluiden netjes achter elkaar op één
// tijdlijn, in plaats van allemaal op t=0. Wat er uit komt is dus letterlijk
// de output van de spelcode, niet een reconstructie.
//
// Voor de vijftien geluiden die T154 aanraakte wordt elk twee keer gerenderd:
// één keer met de ruislaag uitgezet (= exact hoe het vóór T154 klonk) en één
// keer normaal. Zo is het verschil te horen in plaats van te beweren.
//
// Draaien: `node maak-geluidsverslag.mjs` vanuit tests/.
// Uitvoer: geluidsverslag/alles.wav + geluidsverslag/manifest.json
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { executablePathOptie } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UIT = path.join(__dirname, 'geluidsverslag');
const THREE_SRC = readFileSync(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'), 'utf8');
const JSM_ROOT = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');
const SPEL = path.join(__dirname, '..', 'amsterdam-undead.html');

// Wat elk geluid IS en WANNEER je het hoort. Deze teksten zijn de helft van
// het verslag — een losse toon zonder context zegt niets.
const WANNEER = {
  // wapens
  schotAmstel:   ['AMSTEL-9 — schot', 'Elke keer dat je met het startpistool schiet. Max 5 per seconde.'],
  schotRipper:   ['Canal Ripper — schot', 'Het snelvuurwapen uit de Smederij. Tot 10 per seconde; hier hoor je waarom variatie ertoe doet.'],
  droogKlik:     ['Droge klik', 'Je haalt de trekker over met een leeg magazijn. Het signaal "herladen, nu".'],
  herlaad:       ['Herladen — start', 'Zodra je op R drukt of automatisch herlaadt.'],
  herlaadKlaar:  ['Herladen — klaar', 'Op het exacte moment dat het wapen weer kan vuren. Sinds T33 een eigen geluid, zodat het klopt met de herlaadduur per wapen.'],
  wissel:        ['Wapenwissel', 'Bij het wisselen tussen mes en vuurwapen (Q).'],
  mesSteek:      ['Messteek', 'Je slaat toe met het mes — het startwapen, en je terugval als je zonder munitie zit.'],
  raakTik:       ['Treffer — lichaam', 'Elke raak kogel in een romp of arm. Klinkt per wapen anders (T144).'],
  kopTik:        ['Treffer — hoofd', 'Koptreffer. Hoger en scherper dan de lichaamstik, zodat je zonder te kijken weet dat je goed zat.'],
  killKnak:      ['De kill', 'Een ondode gaat neer. De lage onderlaag kwam er na de T149-speeltoets bij ("de kill voelt te licht").'],
  doorboring:    ['Doorboring', 'Canal Ripper met Smederij-niveau 2: de kogel gaat door het eerste doel heen en raakt een tweede.'],
  // ondoden
  gromNormaal:   ['Grom — normaal type', 'Elke ondode gromt om de 4 tot 9 seconden. Je hoort links/rechts waar hij staat.'],
  gromSjouwer:   ['Grom — Sjouwer', 'Het zware, trage type. Laagst van de drie.'],
  gromBrander:   ['Grom — Brander', 'Het type dat explodeert als je het doodt.'],
  aanvalGromSjouwer: ['Aanvalskreet — Sjouwer', 'Het moment dat een Sjouwer zijn arm heft. Dit is je waarschuwing: nu wegduiken.'],
  aanvalGromSluiper: ['Aanvalskreet — Sluiper', 'Kort en schril. De Sluiper haalt sneller uit dan de rest (windup 0,30 s).'],
  aanvalGromNormaal: ['Aanvalskreet — normaal', 'De standaard wind-up-tell.'],
  slagRaak:      ['Klap raakt', 'Een ondode raakt je. Klinkt tegelijk met de pijnkreet en het schadevignet.'],
  slagMis:       ['Klap mist', 'Je ontweek net op tijd — de arm scheert langs je heen.'],
  // speler en wereld
  spelerAu:      ['Speler geraakt', 'Jouw schadekreet, samen met de rode randflits en de richtingspijl.'],
  plankBreek:    ['Plank breekt', 'Een ondode beukt een plank van een gebarricadeerd venster. Gepand: je hoort wélk venster.'],
  explosie:      ['Brander explodeert', 'Het explosieve type gaat af — vlakbij kost dat jou ook leven.'],
  stroomklap:    ['Stroom valt uit', 'Begin van de Stroomuitval-eventgolf. Alle lampen doven, de mist wordt dichter.'],
  stroomHerstel: ['Stroom keert terug', 'Einde van de stroomuitval.'],
  // golf en meta
  golfStart:     ['Golf begint', 'Bij elke nieuwe golf, samen met de lichtdip.'],
  golfKlaar:     ['Golf uitgeteld', 'De laatste ondode van de golf is neer — even lucht om te kopen.'],
  gameOver:      ['Game over', 'Je leven is op.'],
  finaleLosgooien: ['Losgooien', 'Je stapt de boot in en de finale-instapfase begint: 30 seconden waarin alles escaleert.'],
  introMelodie:  ['Intro-melodie', 'Eén keer per sessie, als je hem in het stadsarchief hebt ontgrendeld.'],
  // economie
  koop:          ['Aankoop', 'Deur, barricade, munitie, wapen — elke geslaagde aankoop.'],
  geenGeld:      ['Te weinig geld', 'Je drukt op kopen maar hebt het bedrag niet.'],
  smeed:         ['Smederij-upgrade', 'Zwaarder dan de gewone koop-toon, omdat een upgrade meer gewicht heeft.'],
  // omgeving
  druppelTik:    ['Druppel', 'In de kelder, elke 3 tot 6 seconden, alleen binnen 8 meter van het luik.'],
  grachtklok:    ['Grachtklok', 'Zone A, elke 40 tot 80 seconden. Ver weg, boven de gromband, dus nooit te verwarren met een ondode.'],
  gangKraak:     ['Gang kraakt', 'Je eerste stap de gang in.'],
  bijkeukenKraak:['Bijkeuken kraakt', 'Je eerste stap de bijkeuken in. Bewust lager dan de gang.'],
  windvlaag:     ['Windvlaag', 'Je eerste stap de binnenplaats op — buitenlucht.'],
  verreScheepshoorn: ['Verre scheepshoorn', 'Het stadsbed (T82): elke 50 tot 110 seconden, ver over het water. Bewust een ander register dan de échte ontsnappingsboot.'],
  verreStadsklok:['Verre stadsklok', 'Stadsbed, elke 90 tot 180 seconden.'],
  // boot
  bootHoorn:     ['Boot komt aan', 'De ontsnappingsboot meert aan. Vanaf nu telt je venster.'],
  bootVertrek:   ['Boot vaart weg', 'Je haalde het venster niet. Symmetrisch met de aankomst, korter en zachter.'],
  bootHoornGericht: ['Boothoorn — gericht', 'Herhaalt elke 7 seconden zolang de boot er is; pan en volume vertellen je waar hij ligt en hoe ver. In de instapfase gaat het interval omlaag naar 2,5 s.'],
  // permanente lagen
  dreigingsdrone:['Dreigingsdrone', 'Permanent, zwelt aan naarmate er meer ondoden dicht bij je staan. Twee sinussen op 55 en 57 Hz — die wrijving is de zweving die je hoort.'],
  nevelklok:     ['Nevelklok', 'De achtergrondmuziek: een drieklank met een halve-toon-wrijving die met een vaste cadans aanzwelt en wegsterft.'],
};

// De vijftien geluiden waar T154 een ruislaag aan toevoegde: die renderen we
// twee keer, met en zonder. `grom*` staat er los in (eigen keelruis-pad).
const AB_PAAR = ['schotAmstel', 'schotRipper', 'droogKlik', 'herlaad', 'herlaadKlaar', 'mesSteek',
  'raakTik', 'kopTik', 'killKnak', 'plankBreek', 'slagRaak', 'slagMis', 'explosie',
  'gangKraak', 'bijkeukenKraak', 'windvlaag', 'gromNormaal', 'gromSjouwer', 'gromBrander'];

const browser = await chromium.launch(executablePathOptie);
const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
const page = await context.newPage();

// De AudioContext-proxy moet bestaan vóór de module draait.
await page.addInitScript(() => {
  window.__render = { offset: 0, ctx: null, klaar: null };
  const Echt = window.OfflineAudioContext;
  window.AudioContext = function () {
    // 6 minuten ruimte; het manifest bepaalt hoeveel er echt gebruikt wordt.
    const offline = new Echt(2, 44100 * 360, 44100);
    const proxy = new Proxy(offline, {
      get(doel, prop) {
        if (prop === 'currentTime') return window.__render.offset;
        if (prop === 'state') return 'running';
        if (prop === 'resume' || prop === 'suspend') return () => Promise.resolve();
        const w = doel[prop];
        return typeof w === 'function' ? w.bind(doel) : w;
      },
    });
    window.__render.ctx = offline;
    window.__render.proxy = proxy;
    return proxy;
  };
  window.webkitAudioContext = window.AudioContext;
});

await page.route('**/three@**', route => {
  const u = route.request().url();
  if (u.includes('/examples/jsm/')) {
    const rel = u.split('/examples/jsm/')[1].split('?')[0];
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(JSM_ROOT, rel), 'utf8') });
  }
  return route.fulfill({ status: 200, contentType: 'text/javascript', body: THREE_SRC });
});
await page.goto('file://' + SPEL);
await page.waitForFunction(() => !!window.AmsterdamUndeadDebug, { timeout: 30000 });

const resultaat = await page.evaluate(async ({ AB_PAAR }) => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const R = window.__render;
  const G = d.GELUIDEN;

  // De permanente lagen staan normaal op 0 en worden per frame gestuurd;
  // voor het verslag zetten we ze even op hun eigen plafond.
  d.stadGainNode.gain.value = d.STADSBED_VOLUME_PLAFOND;

  const manifest = [];
  const STILTE = 0.35;   // tussen twee geluiden
  let t = 0.2;

  // Speelt `fn` op tijdstip t en schuift t op met `slot`.
  const plaats = (sleutel, variant, slot, fn) => {
    R.offset = t;
    fn();
    manifest.push({ sleutel, variant, start: +t.toFixed(3), lengte: +slot.toFixed(3) });
    t += slot + STILTE;
  };

  const AMSTEL = d.WAPEN_DRUKSPUIT ? d.WAPEN_DRUKSPUIT.schotToon : { start: 480, eind: 120, duur: 0.09 };
  const RIPPER = d.WAPEN_RATELAAR ? d.WAPEN_RATELAAR.schotToon : { start: 620, eind: 210, duur: 0.06 };

  // Elke bron als een losse functie, zodat de A/B-lus ze twee keer kan doen.
  const BRONNEN = {
    schotAmstel:  [0.6, () => d.speelGeluid('schot', { ...AMSTEL })],
    schotRipper:  [1.4, () => { for (let i = 0; i < 8; i++) { R.offset = t + i * 0.1; d.speelGeluid('schot', { ...RIPPER }); } }],
    droogKlik:    [0.5, () => d.speelGeluid('droogKlik')],
    herlaad:      [0.7, () => d.speelGeluid('herlaad')],
    herlaadKlaar: [0.7, () => d.speelGeluid('herlaadKlaar')],
    wissel:       [0.6, () => d.speelGeluid('wissel')],
    mesSteek:     [0.6, () => d.speelGeluid('mesSteek')],
    raakTik:      [1.1, () => { for (let i = 0; i < 4; i++) { R.offset = t + i * 0.22; d.speelGeluid('raakTik'); } }],
    kopTik:       [1.1, () => { for (let i = 0; i < 4; i++) { R.offset = t + i * 0.22; d.speelGeluid('kopTik'); } }],
    killKnak:     [0.9, () => d.speelGeluid('killKnak')],
    doorboring:   [0.8, () => d.speelGeluid('doorboring')],
    gromNormaal:  [1.6, () => { for (let i = 0; i < 3; i++) { R.offset = t + i * 0.5; d.speelOndodeGrom('normaal'); } }],
    gromSjouwer:  [1.2, () => d.speelOndodeGrom('sjouwer')],
    gromBrander:  [1.0, () => d.speelOndodeGrom('brander')],
    aanvalGromSjouwer: [1.1, () => d.speelGeluid('aanvalGromSjouwer')],
    aanvalGromSluiper: [0.7, () => d.speelGeluid('aanvalGromSluiper')],
    aanvalGromNormaal: [0.9, () => d.speelGeluid('aanvalGromNormaal')],
    slagRaak:     [0.7, () => d.speelGeluid('slagRaak')],
    slagMis:      [0.8, () => d.speelGeluid('slagMis')],
    spelerAu:     [0.7, () => d.speelGeluid('spelerAu')],
    plankBreek:   [0.7, () => d.speelGeluid('plankBreek')],
    explosie:     [1.0, () => d.speelGeluid('explosie')],
    stroomklap:   [0.9, () => d.speelGeluid('stroomklap')],
    stroomHerstel:[0.6, () => d.speelGeluid('stroomHerstel')],
    golfStart:    [0.9, () => d.speelGeluid('golfStart')],
    golfKlaar:    [0.9, () => d.speelGeluid('golfKlaar')],
    gameOver:     [1.5, () => d.speelGeluid('gameOver')],
    finaleLosgooien: [0.8, () => d.speelGeluid('finaleLosgooien')],
    introMelodie: [1.2, () => d.speelGeluid('introMelodie')],
    koop:         [0.6, () => d.speelGeluid('koop')],
    geenGeld:     [0.6, () => d.speelGeluid('geenGeld')],
    smeed:        [0.8, () => d.speelGeluid('smeed')],
    druppelTik:   [0.5, () => d.speelGeluid('druppelTik')],
    grachtklok:   [2.0, () => d.speelGeluid('grachtklok')],
    gangKraak:    [0.9, () => d.speelGeluid('gangKraak')],
    bijkeukenKraak: [0.9, () => d.speelGeluid('bijkeukenKraak')],
    windvlaag:    [2.2, () => d.speelGeluid('windvlaag')],
    verreScheepshoorn: [2.0, () => d.speelGeluid('verreScheepshoorn')],
    verreStadsklok: [2.0, () => d.speelGeluid('verreStadsklok')],
    bootHoorn:    [1.5, () => d.speelGeluid('bootHoorn')],
    bootVertrek:  [1.2, () => d.speelGeluid('bootVertrek')],
  };

  // --- A/B: eerst zonder ruislaag (= vóór T154), dan met -------------------
  const bewaardeRuis = {};
  const bewaardGrom = {};
  const zetRuisUit = () => {
    for (const naam of Object.keys(G)) if (G[naam].ruis) { bewaardeRuis[naam] = G[naam].ruis; delete G[naam].ruis; }
    for (const type of Object.keys(d.GROM_PROFIELEN)) {
      bewaardGrom[type] = d.GROM_PROFIELEN[type].ruisVolume;
      d.GROM_PROFIELEN[type].ruisVolume = 0;
    }
  };
  const zetRuisAan = () => {
    for (const naam of Object.keys(bewaardeRuis)) G[naam].ruis = bewaardeRuis[naam];
    for (const type of Object.keys(bewaardGrom)) d.GROM_PROFIELEN[type].ruisVolume = bewaardGrom[type];
  };

  zetRuisUit();
  for (const sleutel of AB_PAAR) {
    const [slot, fn] = BRONNEN[sleutel];
    plaats(sleutel, 'voor', slot, fn);
  }
  zetRuisAan();
  for (const sleutel of AB_PAAR) {
    const [slot, fn] = BRONNEN[sleutel];
    plaats(sleutel, 'na', slot, fn);
  }
  // De rest één keer.
  for (const [sleutel, [slot, fn]] of Object.entries(BRONNEN)) {
    if (AB_PAAR.includes(sleutel)) continue;
    plaats(sleutel, 'enkel', slot, fn);
  }

  // --- De gerichte boothoorn: links, midden, rechts -----------------------
  {
    const slot = 3.8;
    R.offset = t;
    // speelBootHoornGericht leest bootGroep/speler; makkelijker is de keten
    // rechtstreeks nabootsen via de gepubliceerde pure functie + piep().
    [-0.85, 0, 0.85].forEach((pan, i) => {
      R.offset = t + i * 1.2;
      d.piep('sine', 200, 140, 1.1, i === 1 ? 0.11 : 0.07, pan);
    });
    manifest.push({ sleutel: 'bootHoornGericht', variant: 'enkel', start: +t.toFixed(3), lengte: slot });
    t += slot + STILTE;
  }

  // --- De twee permanente lagen -------------------------------------------
  {
    const slot = 3.5;
    R.offset = t;
    d.dreigingsGainNode.gain.setValueAtTime(0.0001, t);
    d.dreigingsGainNode.gain.linearRampToValueAtTime(d.DREIGINGS_VOLUME_PLAFOND, t + 1.2);
    d.dreigingsGainNode.gain.setValueAtTime(d.DREIGINGS_VOLUME_PLAFOND, t + 2.3);
    d.dreigingsGainNode.gain.linearRampToValueAtTime(0.0001, t + slot);
    manifest.push({ sleutel: 'dreigingsdrone', variant: 'enkel', start: +t.toFixed(3), lengte: slot });
    t += slot + STILTE;
  }
  {
    const slot = 5.0;
    R.offset = t;
    d.muziekGainNode.gain.setValueAtTime(d.MUZIEK_VOLUME_PLAFOND, t);
    d.speelNevelklokToon();
    R.offset = t + 2.5;
    d.speelNevelklokToon();
    d.muziekGainNode.gain.setValueAtTime(0, t + slot);
    manifest.push({ sleutel: 'nevelklok', variant: 'enkel', start: +t.toFixed(3), lengte: slot });
    t += slot + STILTE;
  }

  const totaal = t + 0.5;
  const gerenderd = await R.ctx.startRendering();
  // Naar mono: het verslag is een lijst losse geluiden, en alleen de
  // gepande items hebben stereo-inhoud. Die houden we wel stereo.
  const links = Array.from(gerenderd.getChannelData(0).slice(0, Math.ceil(totaal * 44100)));
  const rechts = Array.from(gerenderd.getChannelData(1).slice(0, Math.ceil(totaal * 44100)));
  return { manifest, links, rechts, sampleRate: gerenderd.sampleRate, totaal };
}, { AB_PAAR });

await browser.close();

mkdirSync(UIT, { recursive: true });

// --- WAV schrijven (16-bit stereo PCM) --------------------------------------
const { links, rechts, sampleRate } = resultaat;
const n = links.length;
const buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
let piek = 0;
for (let i = 0; i < n; i++) piek = Math.max(piek, Math.abs(links[i]), Math.abs(rechts[i]));
// Eén gedeelde gain over het geheel: de onderlinge verhoudingen (de met de
// hand afgeregelde mix) blijven zo exact intact, alleen het geheel wordt
// bruikbaar hard. Zonder dit is bijvoorbeeld de druppeltik (0,0345)
// nauwelijks te horen op een laptop.
const gain = piek > 0 ? 0.89 / piek : 1;
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(links[i] * gain * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(rechts[i] * gain * 32767))), 46 + i * 4);
}
writeFileSync(path.join(UIT, 'alles.wav'), buf);

const manifest = resultaat.manifest.map(m => ({
  ...m,
  titel: (WANNEER[m.sleutel] || [m.sleutel, ''])[0],
  wanneer: (WANNEER[m.sleutel] || ['', ''])[1],
}));
writeFileSync(path.join(UIT, 'manifest.json'), JSON.stringify({
  sampleRate, totaal: resultaat.totaal, normalisatieGain: gain, items: manifest,
}, null, 1));

console.log(`geluidsverslag/alles.wav   ${(buf.length / 1024 / 1024).toFixed(2)} MB, ${resultaat.totaal.toFixed(1)} s`);
console.log(`geluidsverslag/manifest.json  ${manifest.length} items`);
console.log(`piek vóór normalisatie: ${piek.toFixed(4)}  ->  gain x${gain.toFixed(1)}`);
