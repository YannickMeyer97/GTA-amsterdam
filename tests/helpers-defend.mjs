// Gedeelde testhulp voor de Defend National Monument headless-tests.
// Ticket D1 (SONNET_EXECUTION_PLAN_monument.md, Fase 0): kopie van
// helpers.mjs, aangepast voor defend-national-monument.html — zelfde
// patroon uit CLAUDE.md (lokale Chromium, CDN-intercept die
// three.module.js lokaal serveert, een check()/report()-telpaar), bewust
// als eigen bestand i.p.v. functies uit helpers.mjs te hergebruiken: de
// twee games delen geen code, dus ook hun testinfrastructuur niet.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THREE_SRC = readFileSync(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'), 'utf8');
const GAME_PATH = path.join(__dirname, '..', 'defend-national-monument.html');
// Zelfde onderschepping van de examples/jsm/**-submodules als helpers.mjs —
// deze game gebruikt ze vandaag niet, maar de intercept moet ze afvangen
// zodra dat verandert (bijvoorbeeld een postprocessing-effect), anders
// lekt een test alsnog naar het echte CDN.
const JSM_MARKER = '/examples/jsm/';
const JSM_ROOT = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');

// Zelfde CI-terugval als helpers.mjs: het vaste lokale pad bestaat alleen in
// deze dev-omgeving, CI valt terug op Playwright's eigen geïnstalleerde
// browser.
const LOKAAL_CHROMIUM_PAD = '/opt/pw-browsers/chromium';
export const executablePathOptie = existsSync(LOKAAL_CHROMIUM_PAD) ? { executablePath: LOKAAL_CHROMIUM_PAD } : {};

// Zelfde gedeelde-browser-truc als helpers.mjs: run-all.mjs launcht één
// browser voor de HELE suite (beide games, sinds Ticket D0) en zet 'm op
// deze globalThis-sleutel. De naam is historisch (dateert van vóór de
// tweede game) maar functioneel is dit gewoon "de ene gedeelde browser van
// dit run-all.mjs-proces" — hernoemen is hier bewust buiten scope gehouden,
// dat raakt run-all.mjs én helpers.mjs voor een zuiver cosmetische reden.
async function verkrijgBrowserEnContext(contextOpties = {}) {
  const gedeeld = globalThis.__AMSTERDAM_UNDEAD_SHARED_BROWSER__;
  const opties = { viewport: { width: 640, height: 400 }, ...contextOpties };
  if (gedeeld) {
    const context = await gedeeld.newContext(opties);
    return { browser: { close: () => context.close() }, context };
  }
  const browser = await chromium.launch(executablePathOptie);
  const context = await browser.newContext(opties);
  return { browser, context };
}

// Opent defend-national-monument.html headless en geeft
// { browser, page, errs } terug. errs verzamelt console errors +
// pageerrors zodat elk testscript aan het eind kan controleren dat het spel
// zonder JS-fouten laadt.
//
// Ticket D21: `contextOpties` gaat door naar browser.newContext (bijvoorbeeld
// { isMobile, hasTouch } voor een apparaat met grove aanwijzer), en
// `initScript` draait vóór het spel laadt (bijvoorbeeld localStorage vullen).
export async function openDefend({ simuleerPointerLock = false, contextOpties, initScript } = {}) {
  const { browser, context } = await verkrijgBrowserEnContext(contextOpties);
  const page = await context.newPage();
  if (initScript) await page.addInitScript(initScript);
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
      const canvas = window.DamChaosDebug.renderer.domElement;
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
      document.dispatchEvent(new Event('pointerlockchange'));
    });
  }
  return { browser, page, errs };
}

// Zelfde rAF-wachtfunctie als helpers.mjs — bewust GEEN setTimeout, om
// dezelfde reden: Three.js registreert geometrie pas bij de renderer nadat
// hij in een echt frame getekend is.
export async function frames(page, n) {
  await page.evaluate((n) => new Promise(resolve => {
    let i = 0;
    const tik = () => { if (++i >= n) resolve(); else requestAnimationFrame(tik); };
    requestAnimationFrame(tik);
  }), n);
}

// Zelfde pass/fail-teller als helpers.mjs, zelfde console-output-vorm
// ([OK]/[FAIL] per regel, samenvatting aan het eind) zodat run-all.mjs'
// output er voor beide games identiek uitziet.
export function makeChecker() {
  let pass = 0, fail = 0;
  function check(naam, ok, extra) {
    if (ok) { pass++; console.log(`[OK  ] ${naam}`); }
    else { fail++; console.log(`[FAIL] ${naam} — ${JSON.stringify(extra)}`); }
  }
  function report(errs) {
    console.log(`\n${pass} OK, ${fail} FAIL`);
    console.log('console errors:', errs.length ? errs : 'geen');
    return fail;
  }
  return { check, report };
}
