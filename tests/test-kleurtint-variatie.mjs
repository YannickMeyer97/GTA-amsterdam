// Ticket 104 (v0.22, §10.12-beslissing 87): per-mesh kleurtint-variatie op
// meubelBox() (kratten/vaten/etc.) — deterministisch, geen twee instanties
// precies gelijk, materiaal blijft gedeeld/gecachet.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. hashNaarEenheid(): deterministisch (zelfde input -> zelfde output,
// ELKE keer — geen Math.random) en levert een waarde in [0, 1).
const hashTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a1 = d.hashNaarEenheid(3.4, 0.25, 3.4);
  const a2 = d.hashNaarEenheid(3.4, 0.25, 3.4);
  const b = d.hashNaarEenheid(-3.6, 0.25, 3.6);
  return { a1, a2, b, binnenBereikA: a1 >= 0 && a1 < 1, binnenBereikB: b >= 0 && b < 1 };
});
check('hashNaarEenheid() is deterministisch: zelfde positie geeft altijd exact dezelfde waarde',
  hashTest.a1 === hashTest.a2, hashTest);
check('hashNaarEenheid() geeft een waarde in [0, 1)',
  hashTest.binnenBereikA && hashTest.binnenBereikB, hashTest);
check('Twee verschillende posities geven (in de praktijk) een verschillende hash',
  hashTest.a1 !== hashTest.b, hashTest);

// --- 2. meubelBox(): twee instanties met hetzelfde basismateriaal maar een
// andere positie krijgen een verschillende gebakken vertexkleur-factor —
// het letterlijke "twee kisten zijn niet meer identiek"-bewijs.
const tintTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const meshA = d.meubelBox(0.5, 0.5, 0.5, 0x334455, 10, 0.25, 10);
  const meshB = d.meubelBox(0.5, 0.5, 0.5, 0x334455, -20, 0.25, 30);
  const factorVan = (mesh) => mesh.geometry.getAttribute('color').getX(0);
  const uit = {
    materiaalGedeeld: meshA.material === meshB.material,   // zelfde tweeling, want zelfde basismateriaal
    factorA: factorVan(meshA),
    factorB: factorVan(meshB),
    binnenBereikA: Math.abs(factorVan(meshA) - 1) <= d.TINT_VARIATIE + 1e-6,
    binnenBereikB: Math.abs(factorVan(meshB) - 1) <= d.TINT_VARIATIE + 1e-6,
  };
  d.wereld.remove(meshA);
  d.wereld.remove(meshB);
  return uit;
});
check('Twee meubelBox()-instanties met hetzelfde basismateriaal delen hun (getweelingde) materiaal — geen materiaalcache-verdubbeling',
  tintTest.materiaalGedeeld, tintTest);
check('...maar krijgen een verschillende gebakken tint-factor (niet meer pixel-identiek)',
  tintTest.factorA !== tintTest.factorB, tintTest);
check('Beide tint-factoren blijven binnen ±TINT_VARIATIE (10%) van 1 — subtiel, geen felle verkleuring',
  tintTest.binnenBereikA && tintTest.binnenBereikB, tintTest);

// --- 3. Uniform per mesh: ELKE vertex van hetzelfde meubelBox()-mesh heeft
// dezelfde factor (geen gradient — dat is T103's occlusie, niet T104's tint).
const uniformTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const mesh = d.meubelBox(0.5, 0.5, 0.5, 0x334455, 12.34, 0.25, -5.67);
  const kleur = mesh.geometry.getAttribute('color');
  const waarden = new Set();
  for (let i = 0; i < kleur.count; i++) waarden.add(kleur.getX(i).toFixed(6));
  d.wereld.remove(mesh);
  return { aantalUniekeWaarden: waarden.size };
});
check('Alle vertices van één meubelBox()-instantie delen exact dezelfde tint-factor (uniform, geen gradient)',
  uniformTest.aantalUniekeWaarden === 1, uniformTest);

// --- 4. Bronvorm: meubelBox() gebruikt hashNaarEenheid() met x/y/z — nooit
// Math.random (dat zou tests instabiel maken en de bewering "deterministisch"
// tegenspreken).
const bronTest = await page.evaluate(() => window.AmsterdamUndeadDebug.meubelBox.toString());
check('meubelBox() gebruikt hashNaarEenheid(), nooit Math.random()',
  bronTest.includes('hashNaarEenheid') && !bronTest.includes('Math.random'), { bronTest });

// --- 5. De echte kratten/vaten in de wereld hebben inderdaad geen
// identieke tint (het scenario uit de ticket-motivatie: bouwKratten()
// plaatst 2 kratten per aanroep, 3x op de kaart).
const wereldTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const factoren = [];
  d.wereld.traverse((kind) => {
    if (!kind.isMesh) return;
    const kleur = kind.geometry.getAttribute('color');
    if (!kleur) return;
    // Alleen "uniforme" (T104-achtige) meshes: eerste en laatste vertex gelijk.
    if (kleur.getX(0) === kleur.getX(kleur.count - 1)) factoren.push(kleur.getX(0));
  });
  const uniek = new Set(factoren.map(f => f.toFixed(6)));
  return { aantal: factoren.length, uniek: uniek.size };
});
check('De wereld bevat meerdere uniform-getinte meshes met minstens twee verschillende tint-waarden (echte kratten/vaten variëren)',
  wereldTest.aantal > 1 && wereldTest.uniek > 1, wereldTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
