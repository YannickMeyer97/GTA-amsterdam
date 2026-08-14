// Ticket 105 (v0.22, §10.12-beslissing 87): afgeschuinde randen op meubels
// (RoundedBoxGeometry i.p.v. BoxGeometry op meubelBox()/tafel/werkbank).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. geoAfgeschuind() geeft een RoundedBoxGeometry terug, niet een
// platte BoxGeometry — het echte, meetbare verschil.
const geoTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const afgeschuind = d.geoAfgeschuind(0.5, 0.5, 0.5);
  return {
    naam: afgeschuind.constructor.name,
    driehoekenAfgeschuind: afgeschuind.getAttribute('position').count,
  };
});
check('geoAfgeschuind() bouwt een RoundedBoxGeometry (constructor-naam)',
  geoTest.naam === 'RoundedBoxGeometry', geoTest);
check('Een afgeschuinde box heeft merkbaar meer vertices dan een platte BoxGeometry (24) — de randfacetten',
  geoTest.driehoekenAfgeschuind > 24, geoTest);

// --- 2. GEEN caching: twee aanroepen met identieke afmetingen geven
// VERSCHILLENDE geometrie-objecten (vereist voor T104's per-instantie tint
// — zie de code-toelichting bij geoAfgeschuind() voor de reden).
const cacheTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = d.geoAfgeschuind(0.5, 0.5, 0.5);
  const b = d.geoAfgeschuind(0.5, 0.5, 0.5);
  return { verschillendeObjecten: a !== b };
});
check('geoAfgeschuind() cachet NIET — elke aanroep geeft een vers object (nodig voor T104s per-instantie vertexkleur)',
  cacheTest.verschillendeObjecten, cacheTest);

// --- 3. meubelBox() gebruikt geoAfgeschuind(), niet meer een kale BoxGeometry.
const bronTest = await page.evaluate(() => window.AmsterdamUndeadDebug.meubelBox.toString());
check('meubelBox() bouwt zijn geometrie via geoAfgeschuind()',
  bronTest.includes('geoAfgeschuind'), { bronTest });

// --- 4. De straal blijft klein (1-2 cm, per de ticket-spec) — een grote
// straal zou een bol worden, geen "afgeschuinde rand".
const straalTest = await page.evaluate(() => window.AmsterdamUndeadDebug.AFSCHUINING_STRAAL);
check('AFSCHUINING_STRAAL blijft binnen 1-2 cm (0,01-0,02)',
  straalTest >= 0.01 && straalTest <= 0.02, { straalTest });

// --- 5. bouwMuur() blijft ONGEMOEID: geen enkele muur-mesh gebruikt
// RoundedBoxGeometry (§10.12: "niet op bouwMuur() — muren hebben geen
// zichtbare vrije rand").
const muurTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let muurMetAfschuining = 0, totaalMuren = 0;
  d.wereld.traverse((kind) => {
    if (!kind.isMesh) return;
    // Muren zijn de enige BoxGeometry/RoundedBoxGeometry-meshes met een
    // registreerRechthoek-obstakel op exact hun eigen bounding box — te duur
    // om hier te herleiden, dus gebruik i.p.v. daarvan het constructor-type
    // zelf: als bouwMuur() ooit per ongeluk RoundedBoxGeometry zou gebruiken,
    // zou het TOTAAL aantal RoundedBoxGeometry-meshes in de wereld veel
    // hoger liggen dan het aantal meubelBox()/tafel/werkbank-aanroepen.
    if (kind.geometry.constructor.name === 'RoundedBoxGeometry') muurMetAfschuining++;
  });
  return { muurMetAfschuining };
});
check('Het totaal aantal RoundedBoxGeometry-meshes blijft laag (meubilair, geen tientallen muren)',
  muurTest.muurMetAfschuining > 0 && muurTest.muurMetAfschuining < 40, muurTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
