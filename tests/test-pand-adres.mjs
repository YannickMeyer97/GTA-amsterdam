// Ticket 84: het pand krijgt een adres. Bewaakt een VERZONNEN grachtnaam +
// huisnummer (IP-regel CLAUDE.md: geen bestaand Amsterdams adres) op zowel
// het startscherm als het winscherm (consistent, één bron van waarheid:
// PAND_ADRES), een klein naambordje-mesh zonder collision (obstakels blijft
// 52), en de volledige regressie.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Startscherm toont het adres, gelijk aan PAND_ADRES -----------------
const startTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    pandAdres: d.PAND_ADRES,
    startTekst: document.getElementById('pandAdresStart').textContent,
  };
});
check('PAND_ADRES is niet leeg', typeof startTest.pandAdres === 'string' && startTest.pandAdres.length > 0, startTest);
check('Startscherm toont exact PAND_ADRES', startTest.startTekst === startTest.pandAdres, startTest);

// --- 2. IP-regel: geen bestaande Amsterdamse gracht in de naam -------------
const BESTAANDE_GRACHTEN = ['herengracht', 'keizersgracht', 'prinsengracht', 'singel', 'brouwersgracht',
  'leliegracht', 'bloemgracht', 'egelantiersgracht', 'reguliersgracht', 'lijnbaansgracht'];
check('Het verzonnen adres bevat GEEN bestaande Amsterdamse grachtnaam',
  !BESTAANDE_GRACHTEN.some(g => startTest.pandAdres.toLowerCase().includes(g)), startTest);
check('Het adres bevat een huisnummer (eindigt op een cijferreeks)',
  /\d+$/.test(startTest.pandAdres.trim()), startTest);

// --- 3. Winscherm toont hetzelfde adres, gezet door toonWinScherm() --------
const winTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonWinScherm();
  const tekst = document.getElementById('pandAdresWin').textContent;
  d.winScherm.style.display = 'none';   // opruimen, geen bijeffect voor volgende checks
  return { tekst };
});
check('Winscherm toont, na toonWinScherm(), exact hetzelfde adres als het startscherm',
  winTest.tekst === startTest.pandAdres, { winTest, startTest });

// --- 4. Naambordje: precies 1 extra mesh t.o.v. de baseline, geen collision -
const obstakelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { obstakelAantal: d.obstakels.length };
});
// Het getal zelf is een kaart-brede teller (T87/De Vliering bracht 'm van 52
// naar 56); de assertie hier gaat onverminderd over hetzelfde: het naambordje
// voegt er zelf niets aan toe.
check('obstakels.length blijft de kaartbrede 58 (T131-baseline; het naambordje voegt geen collision toe)',
  obstakelTest.obstakelAantal === 58, obstakelTest);

// --- 5. Bron-check: bouwNaambordje() maakt precies 1 mesh (performance-eis) -
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bron: d.bouwNaambordje.toString(),
    geenRegistreer: !/registreer(Rechthoek|Obstakel)/.test(d.bouwNaambordje.toString()),
  };
});
check('bouwNaambordje() maakt precies 1 "new THREE.Mesh"',
  (bronTest.bron.match(/new THREE\.Mesh\(/g) || []).length === 1, bronTest);
check('bouwNaambordje() registreert geen obstakel/rechthoek', bronTest.geenRegistreer, bronTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
