// Gedeelde testhulp voor de Amsterdam Undead headless-tests.
// Patroon uit CLAUDE.md: lokale Chromium, CDN-intercept die
// three.module.js lokaal serveert, en een check()/report()-telpaar.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THREE_SRC = readFileSync(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'), 'utf8');
const GAME_PATH = path.join(__dirname, '..', 'amsterdam-undead.html');
// Ticket 60: naast de kern-module onderscheppen we ook de
// examples/jsm/**-submodules (postprocessing + hun eigen relatieve imports
// zoals shaders/CopyShader.js) en serveren die uit hetzelfde lokale
// node_modules/three-pakket — zelfde CDN-intercept-patroon, nu pad-bewust
// i.p.v. altijd dezelfde THREE_SRC terug te geven.
const JSM_MARKER = '/examples/jsm/';
const JSM_ROOT = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');

// Ticket 78 (v0.20, §8.8.1): het vaste lokale pad bestaat alleen in deze
// dev-omgeving — CI heeft geen /opt/pw-browsers/chromium en moet terugvallen
// op de door `npx playwright install chromium` geïnstalleerde browser
// (executablePath weglaten = Playwright's eigen default). Feature-detectie
// i.p.v. een env-var-vlag: geen extra CI-configuratie nodig, en het lokale
// pad blijft precies zo werken als vóór dit ticket.
const LOKAAL_CHROMIUM_PAD = '/opt/pw-browsers/chromium';
// Geëxporteerd voor scripts die (net als test-faalmodi.mjs) bewust hun eigen
// chromium.launch() doen i.p.v. openAmsterdamUndead() — die hebben dezelfde
// CI-fallback nodig, anders faalt precies zo'n script alsnog hard op CI.
export const executablePathOptie = existsSync(LOKAAL_CHROMIUM_PAD) ? { executablePath: LOKAAL_CHROMIUM_PAD } : {};

// Ticket 78 (v0.20, §8.8.1): run-all.mjs draait de hele suite in één
// process en launcht daar één gedeelde browser (globalThis, zie
// run-all.mjs) i.p.v. elk script zijn eigen Chromium-launch te laten doen
// (was de dominante vaste kost bij 48+ scripts, ~1.3s launch-overhead per
// script). Elk script krijgt hier alsnog zijn EIGEN, verse browser-CONTEXT
// (niet de gedeelde default-context) — dezelfde isolatie als vroeger: geen
// gedeelde cookies/opslag, geen gedeelde route-handlers. `browser.close()`
// hieronder sluit in dat geval alleen déze context, nooit de gedeelde
// browser zelf (die moet blijven leven voor het volgende script) — vandaar
// de lichte wrapper i.p.v. de echte Browser terug te geven. Draai je een
// testscript los (zonder run-all.mjs), dan ontbreekt de gedeelde browser en
// valt dit terug op een eigen, lokaal gelanceerde browser — ongewijzigd
// gedrag t.o.v. vóór dit ticket.
async function verkrijgBrowserEnContext() {
  const gedeeld = globalThis.__AMSTERDAM_UNDEAD_SHARED_BROWSER__;
  const viewport = { width: 640, height: 400 };
  if (gedeeld) {
    const context = await gedeeld.newContext({ viewport });
    // Enige methode die testscripts ooit op het geretourneerde `browser`-
    // object aanroepen is .close() (geverifieerd over alle testscripts) —
    // deze wrapper hoeft dus niets anders na te bootsen.
    return { browser: { close: () => context.close() }, context };
  }
  const browser = await chromium.launch(executablePathOptie);
  const context = await browser.newContext({ viewport });
  return { browser, context };
}

// Opent amsterdam-undead.html headless en geeft { browser, page, errs } terug.
// errs verzamelt console errors + pageerrors zodat elk testscript aan het
// eind kan controleren dat het spel zonder JS-fouten laadt.
export async function openAmsterdamUndead({ simuleerPointerLock = false } = {}) {
  const { browser, context } = await verkrijgBrowserEnContext();
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/cdn.jsdelivr.net/**', r => {
    const pathname = new URL(r.request().url()).pathname;
    const idx = pathname.indexOf(JSM_MARKER);
    if (idx !== -1) {
      const rel = pathname.slice(idx + JSM_MARKER.length);
      try {
        const src = readFileSync(path.join(JSM_ROOT, rel), 'utf8');
        return r.fulfill({ status: 200, contentType: 'application/javascript', body: src });
      } catch {
        return r.fulfill({ status: 404, body: `lokaal jsm-bestand niet gevonden: ${rel}` });
      }
    }
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE_SRC });
  });
  await page.goto('file://' + GAME_PATH);
  await page.waitForTimeout(800);
  if (simuleerPointerLock) {
    await page.evaluate(() => {
      // Ticket 67 voegde een tweede <canvas> toe (#minimapUI, statisch in de
      // HTML, dus vóór de WebGL-renderer-canvas in de DOM) — daarom expliciet
      // de renderer-canvas via het debug-object i.p.v. de eerste <canvas> in
      // de DOM (die zou nu #minimapUI zijn).
      const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
      document.dispatchEvent(new Event('pointerlockchange'));
    });
  }
  return { browser, page, errs };
}

// Ticket 77: wacht op n echte requestAnimationFrame-ticks in de pagina.
// Bewust GEEN setTimeout — Three.js registreert een geometrie pas bij de
// renderer (renderer.info.memory.*) nadat hij in een echt frame getekend is,
// dus zonder deze echte rAF-ticks meet elke resourcetest een vals-negatief.
export async function frames(page, n) {
  await page.evaluate((n) => new Promise(resolve => {
    let i = 0;
    const tik = () => { if (++i >= n) resolve(); else requestAnimationFrame(tik); };
    requestAnimationFrame(tik);
  }), n);
}

// Ticket 88 (v0.22, §10.4.1): opent het spel voor een visuele meting/opname.
// Bewust GEEN simuleerPointerLock. Die optie mockt
// `document.pointerLockElement`, en dat maakt `spelActief` in gameLoop
// permanent waar — waardoor klok, de kelderhals-druppel, de
// winkelmarkering-puls, de stofwolken én de golf-/ondoden-simulatie gewoon
// blijven lopen tijdens de meting. Dat zijn allemaal eigen, dt-gedreven
// timers die NIET onder visueleBevriesTijd/lampDipFactor/mistUitfaseTimer
// vallen (empirisch gevonden: twee identieke metingen op hetzelfde
// standpunt weken af zodra hier pointer lock werd gesimuleerd).
//
// In plaats daarvan verbergt dit ALLEEN het DOM-startscherm en toont de
// HUD-chrome — exact wat de pointerlockchange-handler in het spel zelf
// doet — zonder `document.pointerLockElement` te overschrijven. Daardoor
// blijft `spelActief` voorgoed false: alles binnen die if-tak in gameLoop
// (klok, druppel, winkelmarkeringen, stofwolken, ondoden, golf) staat na
// het laden permanent stil. `updateSpeler()` en de flikkerloop +
// `composer.render()` blijven wél elke frame draaien (die staan BUITEN die
// if-tak), dus de camera en het beeld zelf werken gewoon.
export async function openVoorVisueleMeting() {
  const { browser, page, errs } = await openAmsterdamUndead();
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    for (const id of ['hulpUI', 'richtkruis', 'ammoUI', 'hudUI', 'minimapUI']) {
      document.getElementById(id).style.display = 'block';
    }
    document.getElementById('startscherm').style.display = 'none';
    d.updateHUD();   // eenmalige ververs — spelActief blijft false, dus dit is de enige HUD-write die ooit plaatsvindt
    // Ticket 88, gevonden tijdens het bouwen (niet vooraf in het
    // architectuurdocument voorzien): `hangLamp()` geeft elke lamp een
    // WILLEKEURIGE flikkerfase (`fase: Math.random() * Math.PI * 2`) bij het
    // bouwen van de wereld — dus bij elke page-load opnieuw. Binnen één
    // pagina blijft die fase daarna vast (visueleBevriesTijd bevriest alleen
    // de TIJD-term, niet de fase zelf), dus dat gaf 0% spreiding binnen één
    // testrun maar tot 6% spreiding TUSSEN losse testruns (elke fase
    // `Math.sin(fase)` op t=0 is een andere, willekeurige constante) —
    // precies zichtbaar in kamers met meer/sterker flikkerende lampLichten
    // (woonkamer, kelder, bijkeuken, gang) en afwezig waar dat licht van
    // stabiele buitenLichten/stroomGevoeligeDaklichten komt (binnenplaats,
    // gracht, atelier, vliering — 0% verschil, bevestigt de diagnose). Elke
    // fase hier op 0 pinnen maakt de meting ook TUSSEN losse browserruns
    // deterministisch (geverifieerd: <0,05% restspreiding over 4 losse runs).
    for (const l of d.lampLichten) l.fase = 0;
  });
  return { browser, page, errs };
}

// Ticket 88 (v0.22, §10.4/§10.4.1): acht vaste camerastandpunten voor
// pixelmetingen — de vijf zoneVan()-zones (woonkamer/gang/atelier/
// binnenplaats/bijkeuken) plus kelder, vliering en gracht. Die laatste drie
// delen een zoneVan()-index met een buurzone maar zijn eigen, materieel
// onderscheiden rendercontexten (eigen lampen, eigen verdieping) die latere
// tickets expliciet meten (T98 per-zone grading, T103 hoekocclusie, T107
// texturen, T114 water) — vandaar acht in plaats van letterlijk vijf.
// Coördinaten worden IN de pagina berekend uit de bestaande constanten
// (nooit hardcoded gekopieerd), zodat deze lijst nooit uit de pas loopt met
// de kaart. yaw=0 kijkt naar -z ("noord"); alleen de gracht kijkt naar +x
// (yaw=-PI/2) om het water in beeld te krijgen.
export async function berekenVisueleStandpunten(page) {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    return [
      { naam: 'woonkamer', x: 0, z: 1, yaw: 0, pitch: 0 },
      { naam: 'gang', x: 0, z: (d.DEUR_Z + d.GANG_Z_EIND) / 2, yaw: 0, pitch: 0 },
      { naam: 'atelier', x: 0, z: d.ATELIER_MIDDEN_Z, yaw: 0, pitch: 0 },
      { naam: 'binnenplaats', x: d.PLAATS_CX, z: (d.PLAATS_Z_NOORD + d.PLAATS_Z_ZUID) / 2, yaw: 0, pitch: 0 },
      { naam: 'bijkeuken', x: (d.BIJKEUKEN_X_WEST + d.BIJKEUKEN_X_OOST) / 2, z: d.BIJKEUKEN_CZ, yaw: 0, pitch: 0 },
      { naam: 'kelder', x: (d.KELDER_X_WEST + d.KELDERTRAP_X_ONDER) / 2, z: (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2, yaw: 0, pitch: 0 },
      { naam: 'vliering', x: d.VLIERING_X_WEST + 1.5, z: (d.VLIERING_Z_NOORD + d.VLIERING_Z_ZUID) / 2, yaw: 0, pitch: 0 },
      { naam: 'gracht', x: (d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2, z: d.BIJKEUKEN_CZ, yaw: -Math.PI / 2, pitch: 0 },
    ];
  });
}

// Zet de speler/camera op een standpunt uit berekenVisueleStandpunten() EN
// bevriest de tijdafhankelijke systemen die de gemeten helderheid anders met
// 11,2% laten spreiden (§10.4.1): visueleBevriesTijd (de lampflikker-sinus,
// draait BUITEN de spelActief-tak in gameLoop, dus altijd), lampDipFactor en
// stroomFactor (defensief op hun rustwaarde, voor het geval een eerder
// testonderdeel in dezelfde page een golf/Stroomuitval startte).
// mistUitfaseTimer wordt hier ook gezet, maar is met openVoorVisueleMeting()
// (spelActief permanent false) sowieso nooit meer dan de initiële 0.
// Ticket 92: dezelfde discipline voor de nieuwe camerabeweging — een
// standpunt-`.set()` is een TELEPORT, geen echte stap, maar bobFase/
// landingsdip lezen positiedelta's en zouden een teleport anders (ondanks de
// dt-clamp-achtige begrenzing in de game zelf) als een sprint of een val
// kunnen lezen — precies genoeg om de mediane helderheid een fractie te
// verschuiven op een standpunt met een gevoelige framing (empirisch
// gevonden: binnenplaats -3,7%, vliering +7,9%, allebei buiten de 2%-band).
// Vóór updateSpeler(0) resetten, zodat de eerste post-teleport-frame een
// echt schone lei heeft — net als bobFase/vorigeVloerY hierboven.
// Gebruikt ALTIJD samen met openVoorVisueleMeting() — niet met
// simuleerPointerLock, zie de toelichting daar.
export async function zetVisueelStandpunt(page, standpunt) {
  await page.evaluate((sp) => {
    const d = window.AmsterdamUndeadDebug;
    d.speler.positie.set(sp.x, 0, sp.z);
    d.speler.yaw = sp.yaw;
    d.speler.pitch = sp.pitch;
    d.visueleBevriesTijd = 0;
    d.lampDipFactor = 1;
    d.mistUitfaseTimer = 0;
    d.stroomFactor = 1;
    d.bobFase = 0;
    // leanHoek heeft geen setter nodig: hij leest alleen `ingedrukt`, dat in
    // deze testflow nooit gezet wordt, dus hij staat hier al altijd op 0.
    d.landingsDipTimer = 0;
    d.landingsDipSterkte = 0;
    d.pieksnelheidDaling = 0;
    d.updateSpeler(0);   // synct camera.position/rotation + berekent positie.y via berekenVloerY()
    d.vorigeVloerY = d.speler.positie.y;
    d.vorigeSpelerX = d.speler.positie.x;
    d.vorigeSpelerZ = d.speler.positie.z;
  }, standpunt);
  await frames(page, 3);
}

// Ticket 132 (Ronde 10, §12.8): zorgt dat de speler een GELADEN VUURWAPEN in
// handen heeft vóór de eigenlijke test begint.
//
// Waarom deze helper bestaat: 21 testbestanden gebruiken `d.schiet()` puur als
// MIDDEL om schade toe te brengen, niet omdat ze het wapensysteem testen. Die
// gaan er impliciet van uit dat de speler bij het laden al een geladen wapen
// vasthoudt. Vanaf T134 klopt die aanname niet meer (de speler start met een
// mes), en dan moet elk van die bestanden precies één regel bijkrijgen — deze
// — in plaats van 21 losse ad-hoc oplossingen.
//
// In dit ticket is de helper nog een no-op-met-aanvulling: de Drukspuit-staat
// bestaat al bij het laden, dus hij vult alleen het magazijn en zet een
// eventueel lopend herladen stop. Nog geen enkel testbestand roept 'm aan
// (bewust — T132 is gedragsneutraal). T134 breidt 'm uit met het toekennen
// van de AMSTEL-9 zodra die niet meer standaard in bezit is.
export async function geefSpelerVuurwapen(page) {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    if (!d.wapenStaat) {
      // Vanaf T134 bereikbaar: dan moet deze helper het wapen zelf toekennen.
      // Bewust hard falen i.p.v. stil doorgaan — een test die denkt te
      // schieten maar dat niet doet, geeft een onbegrijpelijke assertie-fout
      // ver verderop.
      throw new Error('geefSpelerVuurwapen: geen vuurwapen in bezit — T134 moet deze helper uitbreiden');
    }
    d.wapenStaat.herladen = false;
    d.wapenStaat.herlaadTimer = 0;
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  });
}

// Eenvoudige pass/fail-teller met dezelfde console-output als de bestaande
// scratchpad-tests ([OK]/[FAIL] per regel, samenvatting aan het eind).
export function makeChecker() {
  let pass = 0, fail = 0;
  function check(naam, ok, extra) {
    if (ok) { pass++; console.log(`[OK  ] ${naam}`); }
    else { fail++; console.log(`[FAIL] ${naam} — ${JSON.stringify(extra)}`); }
  }
  // Print de samenvatting en geeft het aantal fails terug (voor process.exit).
  function report(errs) {
    console.log(`\n${pass} OK, ${fail} FAIL`);
    console.log('console errors:', errs.length ? errs : 'geen');
    return fail;
  }
  return { check, report };
}
