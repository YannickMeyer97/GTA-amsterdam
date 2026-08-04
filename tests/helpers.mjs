// Gedeelde testhulp voor de Amsterdam Undead headless-tests.
// Patroon uit CLAUDE.md: lokale Chromium, CDN-intercept die
// three.module.js lokaal serveert, en een check()/report()-telpaar.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
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

// Opent amsterdam-undead.html headless en geeft { browser, page, errs } terug.
// errs verzamelt console errors + pageerrors zodat elk testscript aan het
// eind kan controleren dat het spel zonder JS-fouten laadt.
export async function openAmsterdamUndead({ simuleerPointerLock = false } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
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
