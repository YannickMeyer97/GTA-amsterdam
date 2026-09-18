// Verificatiepas op de openstaande punten van Ticket 179/180 (mobiel), na
// speeltest en publicatie nooit expliciet afgevinkt. Drie losse, kleine
// features die verder niets met elkaar te maken hebben behalve dat ze
// allemaal uit dezelfde twee tickets komen:
//
// 1. Wake Lock (T179): het scherm mag niet uitgaan tussen twee golven, als
//    de speler het toestel even niet aanraakt.
// 2. Kwaliteitstrap-standaard op een grof-pointer-apparaat (T180 deel B):
//    `laag` i.p.v. `normaal`, tenzij de speler al zelf iets koos.
// 3. De F3-perf-overlay bereikbaar via een querystring (T180 deel B): een
//    telefoon heeft geen fysiek toetsenbord.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { check, report } = makeChecker();
let alleErrs = [];

// ===========================================================================
// 1. Wake Lock
// ===========================================================================
{
  const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

  // --- 1a. Aanvragen/loslaten zelf. Let op: simuleerPointerLock: true
  // dispatcht bij het laden al een 'pointerlockchange'-event die
  // zetBesturingActief(true) aanroept — dus de wake lock staat op dit punt
  // al aan, "vóór enige aanvraag" is hier geen zinvolle nulmeting. --------
  const basis = await page.evaluate(async () => {
    const d = window.AmsterdamUndeadDebug;
    const ondersteund = 'wakeLock' in navigator;
    d.laatWakeLockLos();   // schone lei, ongeacht wat het laden zelf al aanvroeg
    const naLoslaten = d.wakeLock;
    await d.vraagWakeLockAan();
    const naAanvraag = d.wakeLock !== null;
    d.laatWakeLockLos();
    const naTweedeLoslaten = d.wakeLock;
    return { ondersteund, naLoslaten, naAanvraag, naTweedeLoslaten };
  });
  check('Deze Chromium ondersteunt de Wake Lock API (anders is de rest van deze sectie een stille no-op-meting)',
    basis.ondersteund, basis);
  check('laatWakeLockLos() op een lege staat crasht niet en laat null staan', basis.naLoslaten === null, basis);
  check('vraagWakeLockAan() zet een echte wake lock (wakeLock !== null)', basis.naAanvraag === true, basis);
  check('laatWakeLockLos() ruimt hem weer op (wakeLock === null)', basis.naTweedeLoslaten === null, basis);

  // --- 1b. Geweigerde aanvraag faalt STIL, geen crash -----------------------
  const geweigerd = await page.evaluate(async () => {
    const d = window.AmsterdamUndeadDebug;
    const orig = navigator.wakeLock;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: () => Promise.reject(new Error('geweigerd (test)')) },
    });
    let fout = null;
    try { await d.vraagWakeLockAan(); } catch (e) { fout = e.message; }
    const naGeweigerd = d.wakeLock;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: orig });
    return { fout, naGeweigerd };
  });
  check('Een geweigerde aanvraag geeft geen onafgehandelde exception',
    geweigerd.fout === null, geweigerd);
  check('...en wakeLock blijft null (het scherm kan dan gewoon uitgaan, zoals vóór dit ticket)',
    geweigerd.naGeweigerd === null, geweigerd);

  // --- Een onbruikbare/kapotte wakeLock-implementatie (bv. een ouder
  // toestel met een halve polyfill) faalt via dezelfde try/catch. `delete
  // navigator.wakeLock` is HIER NIET bruikbaar om "de API bestaat niet" na
  // te bootsen: het is een accessor op Navigator.prototype, dus
  // `'wakeLock' in navigator` blijft sowieso waar, ongeacht de waarde — de
  // eigen property hieronder schaduwt 'm wél, en `.request` ontbreekt dan. -
  const onbruikbaar = await page.evaluate(async () => {
    const d = window.AmsterdamUndeadDebug;
    const orig = navigator.wakeLock;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {} });   // geen .request()
    let fout = null;
    try { await d.vraagWakeLockAan(); } catch (e) { fout = e.message; }
    const resultaat = d.wakeLock;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: orig });
    return { fout, resultaat };
  });
  check('Een onbruikbare wakeLock-implementatie (geen .request()) geeft ook geen onafgehandelde exception',
    onbruikbaar.fout === null, onbruikbaar);
  check('...en laat wakeLock ook dan gewoon null (dezelfde stille terugval)',
    onbruikbaar.resultaat === null, onbruikbaar);

  // --- 1c. De ECHTE flow: zetBesturingActief() koppelt dit vanzelf aan
  // starten/pauzeren — geen losse aanroep nodig op elke plek die pauzeert. --
  const echteFlow = await page.evaluate(async () => {
    const d = window.AmsterdamUndeadDebug;
    d.zetBesturingActief(true);
    await new Promise(r => setTimeout(r, 20));   // vraagWakeLockAan() is async
    const tijdensSpel = d.wakeLock !== null;
    d.zetBesturingActief(false);
    await new Promise(r => setTimeout(r, 20));
    const naPauze = d.wakeLock;
    return { tijdensSpel, naPauze };
  });
  check('zetBesturingActief(true) vraagt vanzelf een wake lock aan (geen losse call nodig bij elke "start"-plek)',
    echteFlow.tijdensSpel === true, echteFlow);
  check('zetBesturingActief(false) (pauze) laat hem weer los',
    echteFlow.naPauze === null, echteFlow);

  // --- 1d. gameOver() loopt via zetBesturingActief (verlaatBesturing() ->
  // exitPointerLock() -> pointerlockchange), dus dat ruimt de wake lock
  // impliciet ook op — bewaakt via de ECHTE functies, niet aangenomen.
  // Ná deze sectie wordt pointerLockElement expliciet hersteld: deze test
  // zet 'm blijvend op null (zoals de echte browser na exitPointerLock()
  // zou doen), en een latere sectie in dit bestand heeft weer een genuine
  // "besturing actief"-staat nodig. ------------------------------------------
  const viaGameOver = await page.evaluate(async () => {
    const d = window.AmsterdamUndeadDebug;
    d.zetBesturingActief(true);
    await new Promise(r => setTimeout(r, 20));
    const voorGameOver = d.wakeLock !== null;
    d.spelStaat.gameOver = false;
    d.gameOver();
    // gameOver() roept verlaatBesturing() aan; in muismodus is dat alleen
    // een exitPointerLock()-AANVRAAG die via het (hier gesimuleerde)
    // pointerlockchange-event terugkomt.
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
    document.dispatchEvent(new Event('pointerlockchange'));
    await new Promise(r => setTimeout(r, 20));
    return { voorGameOver, naGameOver: d.wakeLock };
  });
  check('Vóór game over stond de wake lock daadwerkelijk aan (testopzet klopt)',
    viaGameOver.voorGameOver === true, viaGameOver);
  check('Ná game over is de wake lock losgelaten (via de bestaande zetBesturingActief(false)-koppeling)',
    viaGameOver.naGameOver === null, viaGameOver);

  alleErrs = alleErrs.concat(errs);
  await browser.close();
}

{
  // --- 1e. visibilitychange, in een VERSE sessie: de vorige sectie (1d)
  // zet document.pointerLockElement blijvend op null (zo hoort exitPointer
  // Lock() zich in het echt ook te gedragen), dus besturingActief() zou in
  // diezelfde pagina nooit meer waar worden. Een eigen sessie voorkomt die
  // kruisbesmetting i.p.v. 'm ergens stilzwijgend te herstellen. De browser
  // laat de wake-lock-sentinel ZELF los zodra het document verborgen wordt
  // (spec-gedrag) — bij terugkeer, terwijl de besturing nog actief hoort te
  // zijn, moet 'm opnieuw aangevraagd worden. --------------------------------
  const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
  const zichtbaarheid = await page.evaluate(async () => {
    const d = window.AmsterdamUndeadDebug;
    d.zetBesturingActief(true);
    await new Promise(r => setTimeout(r, 20));
    d.wakeLock = null;   // simuleert wat de browser zelf doet bij het verbergen van het document
    Object.defineProperty(document, 'visibilityState', { configurable: true, get() { return 'hidden'; } });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 20));
    const tijdensVerborgen = d.wakeLock;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get() { return 'visible'; } });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 20));
    return { tijdensVerborgen, naTerugkeer: d.wakeLock !== null };
  });
  check('Terwijl het document verborgen is, wordt er niets opnieuw aangevraagd (blijft null)',
    zichtbaarheid.tijdensVerborgen === null, zichtbaarheid);
  check('Zodra het document weer zichtbaar wordt (en besturing nog actief is), wordt de wake lock hervraagd',
    zichtbaarheid.naTerugkeer === true, zichtbaarheid);

  alleErrs = alleErrs.concat(errs);
  await browser.close();
}

// ===========================================================================
// 2. Kwaliteitstrap-standaard op een grof-pointer-apparaat
// ===========================================================================
{
  // --- 2a. Vers geladen, GEEN opgeslagen keuze, TOUCH-context (coarse
  // pointer + geen hover): valt terug op `laag`, niet `normaal`. -----------
  const { browser: bTouch, page: pTouch, errs: errsTouch } = await openAmsterdamUndead({ touch: true });
  const touchResultaat = await pTouch.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    return { grof: d.isGrofPointerApparaat(), nu: d.kwaliteitNu, gelezen: d.leesKwaliteit() };
  });
  check('Een touch-context meldt zichzelf als grof-pointer-apparaat (testopzet klopt)',
    touchResultaat.grof === true, touchResultaat);
  check('Zonder opgeslagen keuze start het spel op een touch-apparaat op `laag` (Ticket 180 deel B)',
    touchResultaat.nu === 'laag' && touchResultaat.gelezen === 'laag', touchResultaat);
  alleErrs = alleErrs.concat(errsTouch);
  await bTouch.close();

  // --- 2b. Dezelfde vers-geladen situatie, maar NIET-touch: blijft
  // `normaal` — regressie tegen T159/T187, geen ongewild neveneffect. ------
  const { browser: bMuis, page: pMuis, errs: errsMuis } = await openAmsterdamUndead({ simuleerPointerLock: true });
  const muisResultaat = await pMuis.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    return { grof: d.isGrofPointerApparaat(), nu: d.kwaliteitNu };
  });
  check('Een normale (muis/toetsenbord) context is GEEN grof-pointer-apparaat (testopzet klopt)',
    muisResultaat.grof === false, muisResultaat);
  check('Zonder opgeslagen keuze blijft het spel op een normaal apparaat gewoon op `normaal` staan',
    muisResultaat.nu === 'normaal', muisResultaat);

  // --- 2c. "Tenzij de speler zelf al iets gekozen heeft" — een opgeslagen
  // keuze wint ALTIJD, ook op een touch-apparaat. ---------------------------
  const eigenKeuzeWint = await pMuis.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    localStorage.setItem(d.KWALITEIT_KEY, 'hoog');
    return d.leesKwaliteit();
  });
  check('Een geldige opgeslagen keuze wint altijd, ongeacht apparaattype',
    eigenKeuzeWint === 'hoog', { eigenKeuzeWint });
  alleErrs = alleErrs.concat(errsMuis);
  await bMuis.close();
}

// ===========================================================================
// 3. F3-perf-overlay bereikbaar via een querystring
// ===========================================================================
{
  // --- 3a. ?perf activeert de overlay meteen bij het laden ------------------
  const { browser: bPerf, page: pPerf, errs: errsPerf } = await openAmsterdamUndead({ query: 'perf' });
  const metQuery = await pPerf.evaluate(() => ({
    actief: window.AmsterdamUndeadDebug.perfOverlayActief,
    display: document.getElementById('perfOverlayUI').style.display,
  }));
  check('?perf in de URL activeert de perf-overlay meteen bij het laden (geen F3/toetsenbord nodig)',
    metQuery.actief === true && metQuery.display === 'block', metQuery);
  // F3 moet daarna nog gewoon werken (toggle uit) — de querystring-route mag
  // het bestaande toetsenbordpad niet vervangen, alleen aanvullen.
  const f3NaQuery = await pPerf.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3' }));
    return window.AmsterdamUndeadDebug.perfOverlayActief;
  });
  check('F3 werkt daarna nog gewoon (toggelt de via ?perf gestarte overlay weer uit)',
    f3NaQuery === false, { f3NaQuery });
  alleErrs = alleErrs.concat(errsPerf);
  await bPerf.close();

  // --- 3b. Zonder querystring blijft de overlay gewoon uit (geen ongewilde
  // activatie, geen regressie op het bestaande F3-gedrag). ------------------
  const { browser: bGeen, page: pGeen, errs: errsGeen } = await openAmsterdamUndead({});
  const zonderQuery = await pGeen.evaluate(() => window.AmsterdamUndeadDebug.perfOverlayActief);
  check('Zonder querystring staat de overlay gewoon uit bij het laden',
    zonderQuery === false, { zonderQuery });
  const f3Normaal = await pGeen.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3' }));
    return window.AmsterdamUndeadDebug.perfOverlayActief;
  });
  check('F3 zelf blijft normaal werken (regressie)', f3Normaal === true, { f3Normaal });
  alleErrs = alleErrs.concat(errsGeen);
  await bGeen.close();
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
