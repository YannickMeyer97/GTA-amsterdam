// Ticket 43: moeilijkheidsgraden (Toerist/Amsterdammer/Nachtwacht). Bewaakt:
// de drie inhaakplekken (golfBudget, speler-regen, score) schalen exact per
// graad, 'amsterdammer' is byte-voor-byte het bestaande gedrag (ook als
// default vóórdat er ooit gekozen is), de knoppenklik kent startGeld toe en
// verbergt de knoppen daarna permanent, een klik naast de knoppen start het
// spel NIET vóór de eerste keuze, en de moeilijkheidsnaam komt terecht in
// het gameOver-scherm en het highscore-record.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Default vóór elke keuze = amsterdammer, en dat is exact het oude,
// ongewijzigde gedrag (factor 1 overal, startGeld 0) -----------------------
const defaultTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    naam: d.moeilijkheid.naam,
    gekozen: d.moeilijkheidGekozen,
    budgetGolf5: d.golfBudget(5),
    budgetOud: Math.round(d.GOLF_BUDGET_BASIS + d.GOLF_BUDGET_GROEI * 4),
  };
});
check('Vóór elke keuze is de moeilijkheid al "Amsterdammer" (default) en moeilijkheidGekozen === false',
  defaultTest.naam === 'Amsterdammer' && defaultTest.gekozen === false, defaultTest);
check('golfBudget() geeft met de default-moeilijkheid exact de oude, ongewijzigde waarde',
  defaultTest.budgetGolf5 === defaultTest.budgetOud, defaultTest);

// --- 2. golfBudget() schaalt exact met budgetFactor per graad --------------
const budgetTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const basis = d.GOLF_BUDGET_BASIS + d.GOLF_BUDGET_GROEI * 4;   // golf 5
  const uitkomsten = {};
  for (const naam of Object.keys(d.MOEILIJKHEDEN)) {
    d.moeilijkheid = d.MOEILIJKHEDEN[naam];
    uitkomsten[naam] = { verwacht: Math.round(basis * d.MOEILIJKHEDEN[naam].budgetFactor), echt: d.golfBudget(5) };
  }
  d.moeilijkheid = d.MOEILIJKHEDEN.amsterdammer;   // opruimen voor latere checks
  return uitkomsten;
});
check('golfBudget() schaalt exact met budgetFactor voor alle drie de graden',
  Object.values(budgetTest).every(u => u.echt === u.verwacht), budgetTest);

// --- 3. Speler-regen schaalt exact met regenFactor -------------------------
const regenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uitkomsten = {};
  for (const naam of Object.keys(d.MOEILIJKHEDEN)) {
    d.moeilijkheid = d.MOEILIJKHEDEN[naam];
    d.spelerStaat.hp = 50;
    d.spelerStaat.laatsteSchadeTijd = -999;   // ruim voorbij SPELER_REGEN_VERTRAGING
    d.updateSpelerRegen(1);   // 1s regen
    uitkomsten[naam] = { hpNa: d.spelerStaat.hp, verwacht: 50 + d.SPELER_REGEN_PER_SEC * d.MOEILIJKHEDEN[naam].regenFactor };
  }
  d.moeilijkheid = d.MOEILIJKHEDEN.amsterdammer;
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  return uitkomsten;
});
check('updateSpelerRegen() schaalt exact met regenFactor voor alle drie de graden',
  Object.values(regenTest).every(u => Math.abs(u.hpNa - u.verwacht) < 1e-9), regenTest);

// --- 4. Score schaalt exact met scoreFactor (afgerond) ---------------------
const scoreTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.runStats.kills = 4; d.runStats.headshots = 2; d.spelStaat.golf = 3;
  const basis = 4 * 10 + 2 * 15 + 2 * 100;
  const uitkomsten = {};
  for (const naam of Object.keys(d.MOEILIJKHEDEN)) {
    d.moeilijkheid = d.MOEILIJKHEDEN[naam];
    uitkomsten[naam] = { verwacht: Math.round(basis * d.MOEILIJKHEDEN[naam].scoreFactor), echt: d.berekenScore() };
  }
  d.moeilijkheid = d.MOEILIJKHEDEN.amsterdammer;
  return uitkomsten;
});
check('berekenScore() schaalt exact met scoreFactor (afgerond) voor alle drie de graden',
  Object.values(scoreTest).every(u => u.echt === u.verwacht), scoreTest);

// --- 5. kiesMoeilijkheid(): kent startGeld toe en verbergt de knoppen ------
// Feedback: "Kies je moeilijkheidsgraad" bleef staan bij elke latere pauze
// (Esc), ook nadat de keuze al gemaakt was — het startscherm/pauzescherm is
// hetzelfde `#startscherm`-element, dus die tekst moet na de eerste keuze
// permanent vervangen worden door "Klik op het scherm om door te gaan".
const labelVoor = await page.evaluate(() => document.getElementById('moeilijkheidLabel').textContent);
check('Vóór de keuze toont het label "Kies je moeilijkheidsgraad"',
  labelVoor === 'Kies je moeilijkheidsgraad', { labelVoor });

const keuzeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.moeilijkheid = d.MOEILIJKHEDEN.amsterdammer;
  d.spelStaat.geld = 999;   // moet overschreven worden door startGeld
  d.kiesMoeilijkheid('toerist');
  return {
    naam: d.moeilijkheid.naam,
    geld: d.spelStaat.geld,
    knoppenDisplay: document.getElementById('moeilijkheidKnoppen').style.display,
    label: document.getElementById('moeilijkheidLabel').textContent,
  };
});
check('kiesMoeilijkheid("toerist") zet de moeilijkheid en kent startGeld (€200) toe',
  keuzeTest.naam === 'Toerist' && keuzeTest.geld === 200, keuzeTest);
check('Na de keuze zijn de moeilijkheidsknoppen verborgen',
  keuzeTest.knoppenDisplay === 'none', keuzeTest);
check('Na de keuze toont het label (dus ook bij elke latere pauze) "Klik op het scherm om door te gaan" i.p.v. "Kies je moeilijkheidsgraad"',
  keuzeTest.label === 'Klik op het scherm om door te gaan', keuzeTest);

// --- 6. Vóór een klik op een specifieke knop start een klik ernaast het
// spel niet; een klik op een knop wél (en pauze-hervatting toont daarna
// geen knoppen meer) --------------------------------------------------------
const { browser: b2, page: p2, errs: errs2 } = await openAmsterdamUndead();
const buitenKlikTest = await p2.evaluate(() => {
  const canvas = document.querySelector('canvas');
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.getElementById('startscherm').click();   // klik NIET op een knop
  return { gekozen: window.AmsterdamUndeadDebug.moeilijkheidGekozen };
});
check('Een klik op het startscherm buiten de knoppen kiest geen moeilijkheid (moeilijkheidGekozen blijft false)',
  buitenKlikTest.gekozen === false, buitenKlikTest);

const knopKlikTest = await p2.evaluate(() => {
  document.querySelector('[data-moeilijkheid="amsterdammer"]').click();
  return {
    gekozen: window.AmsterdamUndeadDebug.moeilijkheidGekozen,
    naam: window.AmsterdamUndeadDebug.moeilijkheid.naam,
  };
});
check('Een klik op een specifieke moeilijkheidsknop kiest die graad en zet moeilijkheidGekozen op true',
  knopKlikTest.gekozen === true && knopKlikTest.naam === 'Amsterdammer', knopKlikTest);
await b2.close();

// --- 7. Moeilijkheidsnaam komt terecht in het gameOver-scherm en het
// highscore-record -----------------------------------------------------------
const gameOverMoeilijkheidTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.moeilijkheid = d.MOEILIJKHEDEN.nachtwacht;
  localStorage.removeItem(d.HIGHSCORE_KEY);
  d.spelStaat.gameOver = false;
  d.gameOver();
  return {
    statsHTML: document.getElementById('gameOverStats').innerHTML,
    opgeslagen: d.leesHighscore(),
  };
});
check('Het gameOver-scherm toont de gekozen moeilijkheidsnaam',
  gameOverMoeilijkheidTest.statsHTML.includes('Moeilijkheid: Nachtwacht'), gameOverMoeilijkheidTest);
check('Het highscore-record bevat de gekozen moeilijkheidsnaam',
  gameOverMoeilijkheidTest.opgeslagen && gameOverMoeilijkheidTest.opgeslagen.moeilijkheid === 'Nachtwacht',
  gameOverMoeilijkheidTest);

const fails = report([...errs, ...errs2]);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
