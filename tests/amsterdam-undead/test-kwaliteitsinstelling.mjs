// Ticket 159 (v0.26, ronde 12): kwaliteitsinstelling Laag/Normaal/Hoog.
// HERZIEN na speeltest — de trappen zijn één stap opgeschoven.
//
// De oorspronkelijke kernvoorwaarde was "`normaal` is exact de stand van vóór
// T159", met `hoog` als normaal + MSAA. De eigenaar zag tussen die twee geen
// verschil, en de meting gaf hem gelijk: over de acht vaste visuele
// standpunten week gemiddeld 1,78% van de pixels af op devicePixelRatio 2
// (wat elke telefoon en retina-laptop gebruikt), met een gemiddelde afwijking
// van 2,9-15,5 op een schaal van 765 — zichtbaar alleen bij 6-7x uitvergroten.
// Deze wereld bestaat vrijwel volledig uit asgerichte vlakken, en juist daar
// heeft MSAA het minst te doen.
//
// MSAA is daarom vervallen en de trappen dragen nu:
//   hoog    = wat hiervóór `normaal` was (de stand van vóór T159, waarop de
//             helderheidsbalans van T88 is afgestemd — dit is de referentie).
//   normaal = wat hiervóór `laag` was.
//   laag    = NIEUW en lager dan er ooit was: 75% renderresolutie plus de
//             nabewerkingslaag (kleurgrading + vignet) uit.
//
// BEWUSTE KEUZE VAN DE EIGENAAR: er wordt NIET gemigreerd. Een opgeslagen
// sleutel blijft letterlijk staan en betekent voortaan de nieuwe inhoud.
//
// De rest van dit bestand toetst wat het altijd al toetste: dat elke trap
// daadwerkelijk doet wat hij belooft, plus de opslag-/lek-discipline. De
// echte snelheidswinst blijft een eigenaarsoordeel op echte hardware.
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. De presettabel zelf: `hoog` draagt nu de oude normaal-waarden ---
const tabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { presets: d.KWALITEIT_PRESETS, standaard: d.KWALITEIT_STANDAARD, nu: d.kwaliteitNu };
});
check('Er zijn precies drie presets: laag/normaal/hoog',
  Object.keys(tabel.presets).join(',') === 'laag,normaal,hoog', tabel);
check('De standaard is `normaal`', tabel.standaard === 'normaal', tabel);
check('Zonder opgeslagen keuze start het spel op `normaal`', tabel.nu === 'normaal', tabel);
// De vertaling van "hoog == de stand van vóór T159" naar getallen:
check('hoog: pixelRatioMax 2 (de waarde van vóór T159)', tabel.presets.hoog.pixelRatioMax === 2, tabel.presets.hoog);
check('hoog: bloom aan', tabel.presets.hoog.bloom === true, tabel.presets.hoog);
check('hoog: schaduwen aan', tabel.presets.hoog.schaduwen === true, tabel.presets.hoog);
check('hoog: inslagsporen aan', tabel.presets.hoog.inslagsporen === true, tabel.presets.hoog);
check('hoog: nabewerking (kleurgrading + vignet) aan', tabel.presets.hoog.naverwerking === true, tabel.presets.hoog);

// MSAA is vervallen: geen enkele trap mag 'm nog aanzetten. Gemeten reden
// staat in de kop van dit bestand.
check('Geen enkele trap zet nog MSAA aan — die is vervallen na de meting',
  Object.values(tabel.presets).every(p => p.samples === 0), tabel.presets);

// `normaal` is nu wat `laag` was.
check('normaal: pixelRatioMax 1, bloom uit, schaduwen uit (wat `laag` hiervoor was)',
  tabel.presets.normaal.pixelRatioMax === 1 && tabel.presets.normaal.bloom === false
  && tabel.presets.normaal.schaduwen === false, tabel.presets.normaal);
check('normaal: nabewerking blijft WEL aan — dat onderscheidt hem van laag',
  tabel.presets.normaal.naverwerking === true, tabel.presets.normaal);

// `laag` is nieuw en moet echt lager liggen dan de vorige laagste stand.
check('laag: rendert onder volledige resolutie (pixelRatioMax < 1) — de grootste knop die er is',
  tabel.presets.laag.pixelRatioMax < 1, tabel.presets.laag);
check('laag: laat als enige ook de nabewerkingslaag vallen',
  tabel.presets.laag.naverwerking === false, tabel.presets.laag);
check('laag ligt op elk kanaal onder of gelijk aan normaal, en nergens erboven',
  tabel.presets.laag.pixelRatioMax < tabel.presets.normaal.pixelRatioMax
  && tabel.presets.laag.bloom === false && tabel.presets.laag.schaduwen === false
  && tabel.presets.laag.inslagsporen === false, { laag: tabel.presets.laag, normaal: tabel.presets.normaal });
check('De drie trappen lopen echt op in pixelRatioMax (0.75 < 1 < 2)',
  tabel.presets.laag.pixelRatioMax < tabel.presets.normaal.pixelRatioMax
  && tabel.presets.normaal.pixelRatioMax < tabel.presets.hoog.pixelRatioMax, tabel.presets);
check('A3 (lichtculling) staat op laag EN normaal aan, en alleen op hoog uit',
  tabel.presets.laag.lichtculling === true && tabel.presets.normaal.lichtculling === true
  && tabel.presets.hoog.lichtculling === false, tabel.presets);

// --- 2. De renderstaat op `hoog` is de stand van vóór T159 --------------
const hoogStaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('hoog');
  const gl = d.composer.renderer.getContext();
  return {
    pixelRatio: d.renderer.getPixelRatio(),
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    naverwerkingAan: d.composer.passes[2].enabled,
    rtSamples: d.composer.renderTarget1.samples,
    rtType: d.composer.renderTarget1.texture.type,
    contextAntialias: gl.getContextAttributes().antialias,
    passes: d.composer.passes.length,
  };
});
check('hoog: schaduwen daadwerkelijk aan', hoogStaat.schaduwAan === true, hoogStaat);
check('hoog: bloompass daadwerkelijk aan', hoogStaat.bloomAan === true, hoogStaat);
check('hoog: nabewerkingspass daadwerkelijk aan', hoogStaat.naverwerkingAan === true, hoogStaat);
check('hoog: composer-rendertarget zonder MSAA (samples 0) — MSAA is vervallen',
  hoogStaat.rtSamples === 0, hoogStaat);
// EffectComposer maakt zijn eigen target met { type: HalfFloatType }; onze
// eigen target moet daar exact op uitkomen. 1016 === THREE.HalfFloatType.
check('hoog: rendertarget is HalfFloatType, net als de impliciete van EffectComposer',
  hoogStaat.rtType === 1016, hoogStaat);
check('De WebGL-context blijft zonder antialias (bevinding A2 optie A blijft staan)',
  hoogStaat.contextAntialias === false, hoogStaat);
check('De pipeline heeft nog steeds 4 passes', hoogStaat.passes === 4, hoogStaat);

// De pass-vlaggen moeten AL BIJ HET LADEN uit de preset komen, niet pas bij
// een knopdruk. Dat was een echte bug: bloomPass.enabled werd uitsluitend in
// pasKwaliteitToe() gezet, dus een terugkerende speler met een preset die
// bloom verbiedt kreeg 'm bij het laden alsnog. Onzichtbaar zolang de
// standaardtrap toevallig bloom aan had — sinds de omzetting heeft de
// standaard bloom UIT, dus dan valt het meteen op.
const bijLaden = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const preset = d.KWALITEIT_PRESETS[d.KWALITEIT_STANDAARD];
  return {
    standaard: d.KWALITEIT_STANDAARD,
    presetBloom: preset.bloom,
    presetNaverwerking: preset.naverwerking,
    bronBevatInit: /bloomPass\.enabled = kwaliteitPreset\(\)\.bloom/.test(document.documentElement.innerHTML),
  };
});
check('De bloom-vlag wordt al bij het laden uit de preset gezet, niet pas bij een knopdruk',
  bijLaden.bronBevatInit === true, bijLaden);

// --- 3. Wisselen doet daadwerkelijk iets -------------------------------
const naLaag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('laag');
  return {
    nu: d.kwaliteitNu,
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    naverwerkingAan: d.composer.passes[2].enabled,
    pixelRatio: d.renderer.getPixelRatio(),
  };
});
check('Wisselen naar `laag` zet de actieve preset om', naLaag.nu === 'laag', naLaag);
check('laag: schaduwen daadwerkelijk uit', naLaag.schaduwAan === false, naLaag);
check('laag: bloom daadwerkelijk uit', naLaag.bloomAan === false, naLaag);
check('laag: nabewerkingspass daadwerkelijk uit — dit is wat `laag` nieuw maakt',
  naLaag.naverwerkingAan === false, naLaag);
check('laag: rendert daadwerkelijk onder volledige resolutie (0.75)',
  naLaag.pixelRatio === 0.75, naLaag);

const naNormaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('normaal');
  return {
    nu: d.kwaliteitNu,
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    naverwerkingAan: d.composer.passes[2].enabled,
    pixelRatio: d.renderer.getPixelRatio(),
  };
});
check('normaal: schaduwen en bloom blijven uit (het is de oude `laag`)',
  naNormaal.schaduwAan === false && naNormaal.bloomAan === false, naNormaal);
check('normaal: de nabewerkingslaag komt WEL terug — het verschil met laag',
  naNormaal.naverwerkingAan === true, naNormaal);
check('normaal: volledige resolutie (pixelratio 1, of het schermplafond)',
  naNormaal.pixelRatio === 1, naNormaal);

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
check('hoog: schaduwen en bloom komen terug', naHoog.schaduwAan === true && naHoog.bloomAan === true, naHoog);
// Beide targets blijven zonder MSAA; als ze ooit uiteen zouden lopen,
// ping-pongt de composer tussen een wél en een niet gemultisamplede buffer.
check('hoog: beide composer-targets blijven MSAA-vrij en gelijk aan elkaar',
  naHoog.rtSamples === 0 && naHoog.rt2Samples === 0, naHoog);

// --- 4. Terug naar hoog herstelt exact de uitgangsstaat ----------------
const terug = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('hoog');
  return {
    pixelRatio: d.renderer.getPixelRatio(),
    schaduwAan: d.renderer.shadowMap.enabled,
    bloomAan: d.composer.passes[1].enabled,
    naverwerkingAan: d.composer.passes[2].enabled,
    rtSamples: d.composer.renderTarget1.samples,
    rtType: d.composer.renderTarget1.texture.type,
    passes: d.composer.passes.length,
  };
});
check('Terug op `hoog` is de renderstaat exact gelijk aan de uitgangsstaat',
  terug.pixelRatio === hoogStaat.pixelRatio && terug.schaduwAan === hoogStaat.schaduwAan
  && terug.bloomAan === hoogStaat.bloomAan && terug.naverwerkingAan === hoogStaat.naverwerkingAan
  && terug.rtSamples === hoogStaat.rtSamples
  && terug.rtType === hoogStaat.rtType && terug.passes === hoogStaat.passes,
  { terug, hoogStaat });

// --- 5. Wisselen lekt geen resources -----------------------------------
// De rendertargets worden opnieuw opgebouwd zodra `samples` wijzigt; die
// wissel bestaat sinds het vervallen van MSAA niet meer, maar de check blijft
// staan als vangrail — mocht er ooit weer een target-herbouw bijkomen, dan
// vangt dit het lek. Tien rondjes moeten op dezelfde telling eindigen.
const lek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.pasKwaliteitToe('hoog');
  d.composer.render();
  const voor = { tex: d.renderer.info.memory.textures, geo: d.renderer.info.memory.geometries };
  for (let i = 0; i < 10; i++) {
    d.pasKwaliteitToe('laag'); d.composer.render();
    d.pasKwaliteitToe('normaal'); d.composer.render();
    d.pasKwaliteitToe('hoog'); d.composer.render();
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
  d.pasKwaliteitToe('hoog');
  const opHoog = meet();
  d.pasKwaliteitToe('normaal');
  const opNormaal = meet();
  d.pasKwaliteitToe('laag');
  const opLaag = meet();
  d.pasKwaliteitToe('hoog');
  return { opHoog, opNormaal, opLaag };
});
check('De kwaliteitspreset raakt spawn-plafond, spawn-interval, obstakels en interactiepunten niet — op geen enkele trap',
  JSON.stringify(balans.opHoog) === JSON.stringify(balans.opNormaal)
  && JSON.stringify(balans.opNormaal) === JSON.stringify(balans.opLaag), balans);
check('obstakels.length blijft 57', balans.opHoog.obstakels === 57, balans);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
