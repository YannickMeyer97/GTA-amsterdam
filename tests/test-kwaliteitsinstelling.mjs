// Ticket 159 (v0.26, ronde 12): kwaliteitsinstelling Laag/Normaal/Hoog.
//
// De kernvoorwaarde van dit ticket is NIET dat Laag sneller is (dat is in
// deze SwiftShader-omgeving niet betrouwbaar meetbaar, zie
// PERFORMANCE_AUDIT.md §5), maar dat **`normaal` exact de stand van vóór
// T159 is**. Alles wat hieronder getest wordt draait om die belofte plus de
// opslag-/lek-discipline; de daadwerkelijke snelheidswinst van `laag` is een
// eigenaarsoordeel op echte hardware met de F3-overlay.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. De presettabel zelf: normaal moet de oude waarden dragen --------
const tabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { presets: d.KWALITEIT_PRESETS, standaard: d.KWALITEIT_STANDAARD, nu: d.kwaliteitNu };
});
check('Er zijn precies drie presets: laag/normaal/hoog',
  Object.keys(tabel.presets).join(',') === 'laag,normaal,hoog', tabel);
check('De standaard is `normaal`', tabel.standaard === 'normaal', tabel);
check('Zonder opgeslagen keuze start het spel op `normaal`', tabel.nu === 'normaal', tabel);
// Dit is de vertaling van "normaal == de stand van vóór T159" naar getallen:
// pixelratio-plafond 2, bloom aan, schaduwen aan, geen MSAA.
check('normaal: pixelRatioMax 2 (de waarde van vóór T159)', tabel.presets.normaal.pixelRatioMax === 2, tabel.presets.normaal);
check('normaal: bloom aan', tabel.presets.normaal.bloom === true, tabel.presets.normaal);
check('normaal: schaduwen aan', tabel.presets.normaal.schaduwen === true, tabel.presets.normaal);
check('normaal: geen MSAA (samples 0, zoals EffectComposer zelf zou doen)', tabel.presets.normaal.samples === 0, tabel.presets.normaal);
check('laag verlaagt echt iets: pixelRatioMax 1, bloom uit, schaduwen uit',
  tabel.presets.laag.pixelRatioMax === 1 && tabel.presets.laag.bloom === false && tabel.presets.laag.schaduwen === false, tabel.presets.laag);
check('hoog voegt echte MSAA toe (A2 optie B) en is verder gelijk aan normaal',
  tabel.presets.hoog.samples === 4 && tabel.presets.hoog.pixelRatioMax === 2
  && tabel.presets.hoog.bloom === true && tabel.presets.hoog.schaduwen === true, tabel.presets.hoog);
check('A3 (lichtculling) staat alleen op `laag` aan — de plek waar hij mag bestaan',
  tabel.presets.laag.lichtculling === true && tabel.presets.normaal.lichtculling === false
  && tabel.presets.hoog.lichtculling === false, tabel.presets);

// --- 2. De renderstaat op `normaal` is de stand van vóór T159 -----------
const normaalStaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const gl = d.composer.renderer.getContext();
  return {
    pixelRatio: d.renderer.getPixelRatio(),
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    rtSamples: d.composer.renderTarget1.samples,
    rtType: d.composer.renderTarget1.texture.type,
    contextAntialias: gl.getContextAttributes().antialias,
    passes: d.composer.passes.length,
  };
});
check('normaal: schaduwen daadwerkelijk aan', normaalStaat.schaduwAan === true, normaalStaat);
check('normaal: bloompass daadwerkelijk aan', normaalStaat.bloomAan === true, normaalStaat);
check('normaal: composer-rendertarget zonder MSAA (samples 0)', normaalStaat.rtSamples === 0, normaalStaat);
// EffectComposer maakt zijn eigen target met { type: HalfFloatType }; onze
// eigen target moet daar exact op uitkomen, anders is `normaal` toch niet
// identiek. 1016 === THREE.HalfFloatType.
check('normaal: rendertarget is HalfFloatType, net als de impliciete van EffectComposer',
  normaalStaat.rtType === 1016, normaalStaat);
check('De WebGL-context blijft zonder antialias (bevinding A2 optie A blijft staan)',
  normaalStaat.contextAntialias === false, normaalStaat);
check('De pipeline heeft nog steeds 4 passes', normaalStaat.passes === 4, normaalStaat);

// --- 3. Wisselen doet daadwerkelijk iets -------------------------------
const naLaag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('laag');
  return {
    nu: d.kwaliteitNu,
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    pixelRatio: d.renderer.getPixelRatio(),
  };
});
check('Wisselen naar `laag` zet de actieve preset om', naLaag.nu === 'laag', naLaag);
check('laag: schaduwen daadwerkelijk uit', naLaag.schaduwAan === false, naLaag);
check('laag: bloom daadwerkelijk uit', naLaag.bloomAan === false, naLaag);
check('laag: pixelratio nooit boven 1', naLaag.pixelRatio <= 1, naLaag);

const naHoog = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('hoog');
  return {
    nu: d.kwaliteitNu,
    rtSamples: d.composer.renderTarget1.samples,
    rt2Samples: d.composer.renderTarget2.samples,
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
  };
});
check('Wisselen naar `hoog` zet echte MSAA op de composer-target', naHoog.rtSamples === 4, naHoog);
// renderTarget2 is een clone; als samples daar niet op meekomt, ping-pongt de
// composer tussen een wél en een niet gemultisamplede buffer.
check('hoog: ook de tweede (ping-pong) target draagt de MSAA', naHoog.rt2Samples === 4, naHoog);
check('hoog: schaduwen en bloom komen terug', naHoog.schaduwAan === true && naHoog.bloomAan === true, naHoog);

// --- 4. Terug naar normaal herstelt exact de uitgangsstaat -------------
const terug = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('normaal');
  return {
    pixelRatio: d.renderer.getPixelRatio(),
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    rtSamples: d.composer.renderTarget1.samples,
    rtType: d.composer.renderTarget1.texture.type,
    passes: d.composer.passes.length,
  };
});
check('Terug op `normaal` is de renderstaat exact gelijk aan de uitgangsstaat',
  terug.pixelRatio === normaalStaat.pixelRatio && terug.schaduwAan === normaalStaat.schaduwAan
  && terug.bloomAan === normaalStaat.bloomAan && terug.rtSamples === normaalStaat.rtSamples
  && terug.rtType === normaalStaat.rtType && terug.passes === normaalStaat.passes,
  { terug, normaalStaat });

// --- 5. Wisselen lekt geen resources -----------------------------------
// De MSAA-wissel bouwt de rendertargets opnieuw op; zonder dispose() lekt
// elke wissel een framebuffer. Tien rondjes moeten op dezelfde telling
// eindigen als waar ze begonnen.
const lek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('normaal');
  d.composer.render();
  const voor = { tex: d.renderer.info.memory.textures, geo: d.renderer.info.memory.geometries };
  for (let i = 0; i < 10; i++) {
    d.pasKwaliteitToe('laag'); d.composer.render();
    d.pasKwaliteitToe('hoog'); d.composer.render();
    d.pasKwaliteitToe('normaal'); d.composer.render();
  }
  const na = { tex: d.renderer.info.memory.textures, geo: d.renderer.info.memory.geometries };
  return { voor, na };
});
check('Tien volledige preset-rondjes lekken geen texturen', lek.na.tex === lek.voor.tex, lek);
check('Tien volledige preset-rondjes lekken geen geometrieën', lek.na.geo === lek.voor.geo, lek);

// --- 6. Opslag: persistentie, corrupte waarden, ontbrekende storage -----
const opslag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uitkomsten = {};
  d.schrijfKwaliteit('laag');
  uitkomsten.naSchrijven = d.leesKwaliteit();
  localStorage.setItem(d.KWALITEIT_KEY, 'ultra-mega');   // onbekende waarde
  uitkomsten.onbekend = d.leesKwaliteit();
  localStorage.setItem(d.KWALITEIT_KEY, '{"kapot":');    // corrupte waarde
  uitkomsten.corrupt = d.leesKwaliteit();
  localStorage.removeItem(d.KWALITEIT_KEY);
  uitkomsten.leeg = d.leesKwaliteit();
  return uitkomsten;
});
check('Een geschreven keuze wordt teruggelezen', opslag.naSchrijven === 'laag', opslag);
check('Een onbekende opgeslagen waarde valt terug op `normaal`', opslag.onbekend === 'normaal', opslag);
check('Een corrupte opgeslagen waarde valt terug op `normaal`', opslag.corrupt === 'normaal', opslag);
check('Geen opgeslagen waarde geeft `normaal`', opslag.leeg === 'normaal', opslag);

// localStorage kan volledig geweigerd zijn (privacymodus). Dat mag nooit een
// exception geven — zelfde eis als T74/T75.
const zonderStorage = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const echt = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(localStorage), 'getItem')
    ?? { value: localStorage.getItem };
  const origGet = localStorage.getItem.bind(localStorage);
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.getItem = () => { throw new Error('geweigerd'); };
  localStorage.setItem = () => { throw new Error('geweigerd'); };
  let leesFout = null, schrijfFout = null, gelezen = null;
  try { gelezen = d.leesKwaliteit(); } catch (e) { leesFout = e.message; }
  try { d.schrijfKwaliteit('hoog'); } catch (e) { schrijfFout = e.message; }
  localStorage.getItem = origGet;
  localStorage.setItem = origSet;
  void echt;
  return { gelezen, leesFout, schrijfFout };
});
check('Geweigerde localStorage laat lezen niet crashen (valt terug op normaal)',
  zonderStorage.leesFout === null && zonderStorage.gelezen === 'normaal', zonderStorage);
check('Geweigerde localStorage laat schrijven niet crashen', zonderStorage.schrijfFout === null, zonderStorage);

// --- 7. De preset mag de spelbalans nergens raken ----------------------
const balans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const meet = () => ({
    obstakels: d.obstakels.length,
    interacties: d.interactiePunten.length,
    maxActief: d.effectiefMaxActief(),
    spawnInterval: d.effectiefSpawnInterval(),
  });
  d.pasKwaliteitToe('normaal');
  const opNormaal = meet();
  d.pasKwaliteitToe('laag');
  const opLaag = meet();
  d.pasKwaliteitToe('normaal');
  return { opNormaal, opLaag };
});
check('De kwaliteitspreset raakt spawn-plafond, spawn-interval, obstakels en interactiepunten niet',
  JSON.stringify(balans.opNormaal) === JSON.stringify(balans.opLaag), balans);
check('obstakels.length blijft 58', balans.opNormaal.obstakels === 58, balans);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
