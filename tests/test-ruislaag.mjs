// Ticket 154: de ruislaag — de kwaliteitspas die uit de T152-audit volgde.
//
// De bevinding was dat er in het hele spel geen ruisbron zat: elk geluid was
// een zuivere getoonde golfvorm, en een breedbandige transiënt (een knal,
// versplinterend hout, wind, een dreun) is met een enkele oscillator
// principieel niet te maken. Dit script bewaakt dat de oplossing er is en
// blijft: één gedeelde ruisbuffer, een filter-envelope per geluid, en — het
// belangrijkste — dat de ruis ONDER de bestaande getoonde laag blijft. Die
// toon draagt de identiteit (per-wapen schotToon uit T34/T144) en de met de
// hand afgeregelde mix; de ruis mag hem aanvullen, niet overstemmen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Eén gedeelde buffer, één keer gemaakt, geen enkele byte op schijf --
const buffer = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voorInit = d.ruisBuffer;
  d.initGeluid();
  const b = d.ruisBuffer;
  const ctx = d.masterGainNode.context;
  const data = b.getChannelData(0);
  let min = Infinity, max = -Infinity, som = 0;
  for (let i = 0; i < data.length; i++) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); som += data[i]; }
  // Tweede initGeluid()-aanroep mag de buffer niet opnieuw bouwen.
  const zelfdeObject = (d.initGeluid(), d.ruisBuffer === b);
  return {
    voorInitLeeg: voorInit === null,
    kanalen: b.numberOfChannels,
    lengte: b.length,
    verwachteLengte: Math.floor(ctx.sampleRate * d.RUIS_BUFFER_DUUR),
    duur: d.RUIS_BUFFER_DUUR,
    min, max, gemiddelde: som / data.length,
    zelfdeObject,
  };
});
check('Vóór initGeluid() bestaat er nog geen ruisbuffer', buffer.voorInitLeeg, buffer);
check('De ruisbuffer is mono en exact RUIS_BUFFER_DUUR lang',
  buffer.kanalen === 1 && buffer.lengte === buffer.verwachteLengte, buffer);
check('De buffer bevat echte witte ruis (vult vrijwel het hele bereik -1..1)',
  buffer.min < -0.98 && buffer.max > 0.98, buffer);
check('De ruis is symmetrisch rond nul (geen DC-offset die als plop hoorbaar is)',
  Math.abs(buffer.gemiddelde) < 0.01, buffer);
check('Een tweede initGeluid()-aanroep hergebruikt dezelfde buffer (niet opnieuw vullen)',
  buffer.zelfdeObject, buffer);

// --- 2. De keten: bron -> filter -> gain -> masterGainNode ----------------
const keten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bron = d.speelRuis.toString();
  return {
    bufferSource: /createBufferSource\(\)/.test(bron),
    filter: /createBiquadFilter\(\)/.test(bron),
    masterGain: /connect\(masterGainNode\)/.test(bron),
    geenDestination: !/connect\(audio\.destination\)/.test(bron),
    envelope: /frequency\.exponentialRampToValueAtTime/.test(bron),
    hergebruiktBuffer: /bron\.buffer = ruisBuffer/.test(bron),
  };
});
check('speelRuis() gebruikt een AudioBufferSourceNode', keten.bufferSource, keten);
check('speelRuis() gebruikt een BiquadFilter met frequentie-envelope',
  keten.filter && keten.envelope, keten);
check('speelRuis() connect op masterGainNode (dus de mastermute werkt erop)', keten.masterGain, keten);
check('speelRuis() connect NOOIT rechtstreeks op audio.destination', keten.geenDestination, keten);
check('speelRuis() hergebruikt de gedeelde buffer (maakt er geen nieuwe per afspeling)',
  keten.hergebruiktBuffer, keten);

// --- 3. Dekking: precies de geluiden uit AUDIO.md §3.2 hebben een ruislaag -
const RUIS_VERWACHT = ['schot', 'droogKlik', 'herlaad', 'herlaadKlaar', 'mesSteek',
  'raakTik', 'kopTik', 'killKnak', 'plankBreek', 'slagRaak', 'slagMis', 'explosie',
  'gangKraak', 'bijkeukenKraak', 'windvlaag'];

const dekking = await page.evaluate((verwacht) => {
  const G = window.AmsterdamUndeadDebug.GELUIDEN;
  const metRuis = Object.keys(G).filter(n => G[n].ruis).sort();
  return {
    metRuis,
    ontbreekt: verwacht.filter(n => !G[n] || !G[n].ruis),
    teveel: metRuis.filter(n => !verwacht.includes(n)),
    stadMetRuis: Object.keys(G).filter(n => G[n].bus === 'stad' && G[n].ruis),
    // Elke ruislaag heeft de vier verplichte velden.
    onvolledig: metRuis.filter(n => {
      const r = G[n].ruis;
      return !(r.filterStart > 0 && r.filterEind > 0 && r.duur > 0 && r.volume > 0);
    }),
  };
}, RUIS_VERWACHT);
check(`Precies de ${RUIS_VERWACHT.length} SYNTH+-geluiden uit AUDIO.md §3.2 hebben een ruislaag`,
  dekking.ontbreekt.length === 0 && dekking.teveel.length === 0, dekking);
check('Elke ruislaag heeft filterStart, filterEind, duur en volume', dekking.onvolledig.length === 0, dekking);
check('De twee stadsbed-gebeurtenissen krijgen bewust GEEN ruislaag (ijl en ver)',
  dekking.stadMetRuis.length === 0, dekking);

// --- 4. De mix ------------------------------------------------------------
//
// LET OP wat hier NIET staat. De eerste versie van deze test vergeleek
// `ruis.volume` rechtstreeks met `volume` en eiste een verhouding tussen 0,4
// en 0,9. Dat leek redelijk en was aantoonbaar fout: een lowpass op 1300 Hz
// laat maar ~6% van het VERMOGEN van witte ruis door, terwijl piep()'s volume
// de piekamplitude is van een golfvorm waarvan alle energie in één band zit.
// De ruislaag zat daardoor 5 tot 23 dB onder de toon en was bij de meeste
// geluiden onhoorbaar — terwijl deze test groen stond. Nominale gains van
// twee verschillende soorten bronnen zijn simpelweg niet vergelijkbaar.
//
// De echte verhouding wordt gemeten door `meet-ruislaag.mjs`, dat beide lagen
// apart rendert in een OfflineAudioContext en de RMS vergelijkt. Wat hier
// overblijft is een grofmazige vangrail op de absolute waarden: ver buiten
// deze band is er iets structureel mis en hoort de meting opnieuw te draaien.
const mix = await page.evaluate(() => {
  const G = window.AmsterdamUndeadDebug.GELUIDEN;
  const rijen = Object.keys(G).filter(n => G[n].ruis).map(n => ({
    naam: n, toon: G[n].volume, ruis: G[n].ruis.volume,
  }));
  return {
    rijen,
    buitenBereik: rijen.filter(r => r.ruis < 0.05 || r.ruis > 0.7),
    gemiddeldeRuisGain: rijen.reduce((a, r) => a + r.ruis, 0) / rijen.length,
  };
});
check('Elke ruislaag-gain ligt binnen de grofmazige vangrail 0,05-0,7',
  mix.buitenBereik.length === 0, mix.buitenBereik);
// Vangt de terugval naar de oorspronkelijke, onhoorbare afstelling (gemiddeld
// ~0,06). Per geluid verschilt de benodigde gain sterk — hoe lager het filter
// staat, hoe meer vermogen het wegneemt en hoe hoger de gain moet — dus dit
// kan alleen als groepsvangrail, niet per geluid.
check('De gemiddelde ruislaag-gain ligt boven 0,15 (niet teruggezakt naar de onhoorbare afstelling)',
  mix.gemiddeldeRuisGain > 0.15, { gemiddelde: +mix.gemiddeldeRuisGain.toFixed(3) });

// --- 5. speelGeluid() speelt de ruislaag daadwerkelijk mee ----------------
const meespelen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  const origBuf = ctx.createBufferSource.bind(ctx);
  let bronnen = 0;
  ctx.createBufferSource = (...a) => { bronnen++; return origBuf(...a); };
  d.speelGeluid('explosie');          // heeft ruis
  const naExplosie = bronnen;
  d.speelGeluid('koop');              // heeft GEEN ruis
  const naKoop = bronnen;
  ctx.createBufferSource = origBuf;
  return { naExplosie, naKoop };
});
check('Een geluid MET ruislaag start precies één bufferbron', meespelen.naExplosie === 1, meespelen);
check('Een geluid ZONDER ruislaag start er geen', meespelen.naKoop === 1, meespelen);

// --- 6. Variatie: twee afspelingen klinken niet identiek ------------------
const variatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  const orig = ctx.createBufferSource.bind(ctx);
  const snelheden = [];
  const offsets = [];
  ctx.createBufferSource = (...a) => {
    const b = orig(...a);
    const origStart = b.start.bind(b);
    b.start = (t, offset) => { snelheden.push(b.playbackRate.value); offsets.push(offset); return origStart(t, offset); };
    return b;
  };
  for (let i = 0; i < 24; i++) d.speelGeluid('schot', { start: 620, eind: 210, duur: 0.06 });
  ctx.createBufferSource = orig;
  const uniekeSnelheden = new Set(snelheden.map(s => s.toFixed(6))).size;
  const uniekeOffsets = new Set(offsets.map(o => o.toFixed(6))).size;
  return {
    aantal: snelheden.length, uniekeSnelheden, uniekeOffsets,
    minSnelheid: Math.min(...snelheden), maxSnelheid: Math.max(...snelheden),
    maxOffset: Math.max(...offsets), variatieGrens: d.RUIS_VARIATIE_STANDAARD,
  };
});
check('24 schoten leveren 24 verschillende afspeelsnelheden (geen monotonie)',
  variatie.uniekeSnelheden === variatie.aantal, variatie);
check('24 schoten starten alle 24 op een ander punt in de buffer',
  variatie.uniekeOffsets === variatie.aantal, variatie);
check('De afspeelsnelheid blijft binnen ±RUIS_VARIATIE_STANDAARD (geen hoorbaar toonhoogteverschil)',
  variatie.minSnelheid >= 1 - variatie.variatieGrens - 1e-9
  && variatie.maxSnelheid <= 1 + variatie.variatieGrens + 1e-9, variatie);
check('Het startpunt valt altijd binnen de buffer', variatie.maxOffset < 1.0, variatie);

// --- 7. De grom: keelruis via HETZELFDE filter, dus geen tweede panner ----
const grom = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  const ctx = d.masterGainNode.context;
  const origBuf = ctx.createBufferSource.bind(ctx);
  const origPan = ctx.createStereoPanner.bind(ctx);
  let bronnen = 0, panners = 0;
  ctx.createBufferSource = (...a) => { bronnen++; return origBuf(...a); };
  ctx.createStereoPanner = (...a) => { panners++; return origPan(...a); };
  d.speelOndodeGrom('normaal', -5, 0);
  ctx.createBufferSource = origBuf;
  ctx.createStereoPanner = origPan;
  const bron = d.speelOndodeGrom.toString();
  return {
    bronnen, panners,
    ruisOpFilter: /ruisBron\.connect\(ruisGain\)\.connect\(filter\)/.test(bron),
    profielen: d.GROM_PROFIELEN,
  };
});
check('speelOndodeGrom() voegt precies één keelruis-bron toe', grom.bronnen === 1, grom);
check('speelOndodeGrom() houdt het bij precies ÉÉN panner (ruis deelt het filter)',
  grom.panners === 1, grom);
check('De keelruis loopt aantoonbaar door hetzelfde filter als de oscillators',
  grom.ruisOpFilter, grom);
const zonderRuis = Object.entries(grom.profielen).filter(([, p]) => !(p.ruisVolume > 0));
check('Elk gromprofiel heeft een ruisVolume', zonderRuis.length === 0, zonderRuis);
// De keelruis gaat door dezelfde lowpass (900-1000 Hz aflopend naar 240-340)
// als de oscillators, en die neemt het leeuwendeel van het ruisvermogen weg.
// Een ruisVolume boven 1 is daarom normaal en géén teken dat de ruis de stem
// overstemt — dat kun je alleen meten, niet aan dit getal aflezen. Gemeten
// verhouding: ongeveer -5 dB, zie meet-ruislaag.mjs. Deze vangrail is dus
// grofmazig en vangt alleen ordegrootte-fouten.
const buitenBand = Object.entries(grom.profielen).filter(([, p]) => p.ruisVolume < 0.5 || p.ruisVolume > 8);
check('Elk gromprofiel houdt zijn keelruis-gain binnen de grofmazige band 0,5-8',
  buitenBand.length === 0, buitenBand);

// --- 8. Grom-toonhoogtevariatie: elke ondode klinkt anders ----------------
const gromVariatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  const orig = ctx.createOscillator.bind(ctx);
  const eersteFreqs = [];
  ctx.createOscillator = (...a) => {
    const o = orig(...a);
    const origSet = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { eersteFreqs.push(v); return origSet(v, t); };
    return o;
  };
  for (let i = 0; i < 20; i++) d.speelOndodeGrom('normaal');
  ctx.createOscillator = orig;
  // Twee oscillators per grom, allebei op dezelfde startHz.
  const perGrom = eersteFreqs.filter((_, i) => i % 2 === 0);
  return {
    aantal: perGrom.length,
    uniek: new Set(perGrom.map(f => f.toFixed(4))).size,
    min: Math.min(...perGrom), max: Math.max(...perGrom),
    basis: d.GROM_PROFIELEN.normaal.startHz,
    grens: d.GROM_TOONHOOGTE_VARIATIE,
  };
});
check('20 grommen leveren 20 verschillende toonhoogtes op', gromVariatie.uniek === gromVariatie.aantal, gromVariatie);
check('De grom-toonhoogte blijft binnen ±GROM_TOONHOOGTE_VARIATIE van het profiel',
  gromVariatie.min >= gromVariatie.basis * (1 - gromVariatie.grens) - 1e-6
  && gromVariatie.max <= gromVariatie.basis * (1 + gromVariatie.grens) + 1e-6, gromVariatie);

// --- 9. Zonder AudioContext valt alles stil terug (geen crash) ------------
const zonderAudio = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let fout = null;
  try {
    // ruisBuffer bestaat, maar speelRuis moet ook een leeg opties-object aan.
    d.speelRuis({ filterStart: 1000, filterEind: 100, duur: 0.05, volume: 0.05 });
    d.speelRuis({ filterStart: 1000, filterEind: 100, duur: 0.05, volume: 0.05 }, { pan: 0.5 });
  } catch (e) { fout = String(e); }
  return { fout };
});
check('speelRuis() draait zonder opties én met een pan zonder fout', zonderAudio.fout === null, zonderAudio);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
