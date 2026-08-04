// Ticket 75 (v0.20, §8.6.2): muisgevoeligheid instelbaar (slider in het
// startscherm) en persistent (localStorage, zelfde beschermde patroon als
// de highscore). Dekt: (1) de slider verandert de kijksnelheid meetbaar,
// (2) de waarde overleeft een herladen, (3) klikken op de slider start/
// hervat het spel niet (stopPropagation, zelfde patroon als de
// geluidsknop), (4) een corrupte/buiten-bereik-waarde wordt geklemd.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Gevoeligheid verandert het yaw-delta bij een vaste movementX -------
const yawTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.yaw = 0;
  d.muisGevoeligheidFactor = 1;
  window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
  const yawBij1x = d.speler.yaw;

  d.speler.yaw = 0;
  d.muisGevoeligheidFactor = 2.5;
  window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
  const yawBij2_5x = d.speler.yaw;

  return { yawBij1x, yawBij2_5x };
});
check('1x-gevoeligheid geeft een niet-nul yaw-delta bij movementX=100 (testopzet klopt)',
  Math.abs(yawTest.yawBij1x) > 1e-6, yawTest);
check('2,5x-gevoeligheid geeft ~2,5x het yaw-delta van 1x bij dezelfde movementX',
  Math.abs(yawTest.yawBij2_5x - yawTest.yawBij1x * 2.5) < 1e-9, yawTest);

// --- 2. Klemming: corrupte/buiten-bereik-waarden in localStorage -----------
const klemTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const varianten = ['999', '-5', 'nietGetal', '', 'null', '{}'];
  const uit = [];
  for (const raw of varianten) {
    if (raw === '') localStorage.removeItem(d.MUIS_GEVOELIGHEID_KEY);
    else localStorage.setItem(d.MUIS_GEVOELIGHEID_KEY, raw);
    const waarde = d.leesGevoeligheid();
    uit.push({ raw, waarde });
  }
  localStorage.removeItem(d.MUIS_GEVOELIGHEID_KEY);
  return uit;
});
for (const r of klemTest) {
  check(`localStorage-waarde ${JSON.stringify(r.raw)}: leesGevoeligheid() blijft binnen [${0.25},${3}] (geklemd, nooit doorgelaten) — gemeten: ${r.waarde}`,
    Number.isFinite(r.waarde) && r.waarde >= 0.25 && r.waarde <= 3, r);
}

// --- 3. Klikken op de slider vraagt geen pointer lock aan -------------------
const klikTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let calls = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = function (...a) { calls++; return orig.apply(this, a); };
  document.getElementById('moeilijkheidKnoppen').querySelector('[data-moeilijkheid="amsterdammer"]').click();
  const naMoeilijkheidKeuze = calls;   // positieve controle: dit bubbelt WEL door (bestaand, gewenst gedrag)
  document.getElementById('gevoeligheidSlider').click();
  const naSliderKlik = calls;
  d.renderer.domElement.requestPointerLock = orig;
  return { naMoeilijkheidKeuze, naSliderKlik };
});
check('Klikken op een moeilijkheidsknop vraagt (bestaand gedrag) pointer lock aan — positieve controle voor de test hieronder',
  klikTest.naMoeilijkheidKeuze === 1, klikTest);
check('Klikken op de gevoeligheidsslider vraagt GEEN pointer lock aan (stopPropagation, net als de geluidsknop)',
  klikTest.naSliderKlik === klikTest.naMoeilijkheidKeuze, klikTest);

await browser.close();

// --- 4. Persistentie: overleeft een herladen --------------------------------
const { browser: b2, page: p2, errs: errs2 } = await openAmsterdamUndead();
await p2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.muisGevoeligheidFactor = 2.15;
  d.schrijfGevoeligheid(2.15);
});
await p2.reload();
await p2.waitForTimeout(800);
const naHerladen = await p2.evaluate(() => ({
  factor: window.AmsterdamUndeadDebug.muisGevoeligheidFactor,
  sliderWaarde: Number(document.getElementById('gevoeligheidSlider').value),
}));
check('muisGevoeligheidFactor overleeft een herladen (via localStorage, zelfde patroon als de highscore)',
  Math.abs(naHerladen.factor - 2.15) < 1e-9, naHerladen);
check('De slider zelf staat na het herladen ook weer op de bewaarde waarde',
  Math.abs(naHerladen.sliderWaarde - 2.15) < 1e-9, naHerladen);
await p2.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.MUIS_GEVOELIGHEID_KEY));
await b2.close();

const fails = report([...errs, ...errs2]);
process.exit(fails > 0 ? 1 : 0);
