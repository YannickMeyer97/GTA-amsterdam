// Ticket 42: run-statistieken, score en highscore. Bewaakt: schiet()/
// raakOndode() increments via ECHTE aanroepen, geld-uitkeerplekken
// (kill-geld, hit-geld, wave-bonus, Kerninslag) tellen mee in geldTotaal,
// power-up-pickup telt, spelerSchade zet doodDoor, de score-formule is
// exact, de highscore-helpers werken round-trip via localStorage én
// breken niet als localStorage geweigerd wordt, en gameOver() vult het
// scherm (incl. "NIEUW RECORD") correct.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): sectie 1 gebruikt d.schiet() rechtstreeks — eerst een
// geladen vuurwapen toekennen. Alle geld-checks in dit bestand meten een
// DELTA (na - voor), dus de €450 die dit uitgeeft raakt geen enkele assertie.
await geefSpelerVuurwapen(page);

// --- 0. Schone lei: localStorage leegmaken zodat deze test niet leunt op
// een record van een eerdere run in dezelfde browsercontext -----------------
await page.evaluate(() => localStorage.removeItem('amsterdamUndeadHighscore'));

// --- 1. schiet(): runStats.schoten +1 per ECHTE trekker, ongeacht raak/mis -
const schotenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.runStats.schoten = 0;
  d.speler.positie.set(0, 1.7, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.camera.position.copy(d.speler.positie);
  d.camera.rotation.set(0, 0, 0);
  d.camera.updateMatrixWorld(true);
  for (let i = 0; i < 5; i++) {
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
    d.wapenStaat.herladen = false;
    d.schiet();   // mist (leeg voor de loop) elke keer, telt toch als schot
  }
  return { schoten: d.runStats.schoten };
});
check('schiet() telt runStats.schoten precies 1x per aanroep op (ook bij missen)',
  schotenTest.schoten === 5, schotenTest);

// --- 2. raakOndode(): treffers/headshots/kills/geldTotaal via ECHTE
// aanroepen, voor zowel een overlevende treffer als een kill --------------
const raakTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.runStats.kills = 0; d.runStats.headshots = 0; d.runStats.treffers = 0; d.runStats.geldTotaal = 0;
  d.dubbeleBeloningTimer = 0; d.eliminatiemodusTimer = 0;

  const o1 = d.spawnOndode(0, 'normaal');
  o1.hp = 1000;
  const geldVoorLichaam = d.spelStaat.geld;
  d.raakOndode(o1, o1.groep.position, false);   // overlevende lichaamstreffer
  const naLichaam = { treffers: d.runStats.treffers, headshots: d.runStats.headshots, kills: d.runStats.kills,
    geldToename: d.spelStaat.geld - geldVoorLichaam, geldTotaal: d.runStats.geldTotaal };

  const o2 = d.spawnOndode(0, 'normaal');
  o2.hp = 1000;
  d.raakOndode(o2, o2.groep.position, true);    // overlevende headshot (geen kill)
  const naKopOverleeft = { treffers: d.runStats.treffers, headshots: d.runStats.headshots, kills: d.runStats.kills };

  const o3 = d.spawnOndode(0, 'normaal');
  o3.hp = 1;   // sterft op deze treffer
  const geldVoorKill = d.spelStaat.geld;
  d.runStats.geldTotaal = 0;   // isoleren: alleen het kill-geld van DEZE treffer meten
  d.raakOndode(o3, o3.groep.position, false);   // dodelijke lichaamstreffer
  const naKill = { treffers: d.runStats.treffers, kills: d.runStats.kills,
    geldToename: d.spelStaat.geld - geldVoorKill, geldTotaal: d.runStats.geldTotaal };

  return { naLichaam, naKopOverleeft, naKill };
});
check('Een overlevende lichaamstreffer: treffers+1, geen headshot/kill, geldTotaal volgt spelStaat.geld exact',
  raakTest.naLichaam.treffers === 1 && raakTest.naLichaam.headshots === 0 && raakTest.naLichaam.kills === 0 &&
  raakTest.naLichaam.geldTotaal === raakTest.naLichaam.geldToename, raakTest.naLichaam);
check('Een overlevende headshot telt als headshot-TREFFER, geen kill',
  raakTest.naKopOverleeft.treffers === 2 && raakTest.naKopOverleeft.headshots === 1 && raakTest.naKopOverleeft.kills === 0,
  raakTest.naKopOverleeft);
check('Een dodelijke treffer telt als kill, en het kill-geld telt mee in geldTotaal',
  raakTest.naKill.treffers === 3 && raakTest.naKill.kills === 1 &&
  raakTest.naKill.geldToename > 0 && raakTest.naKill.geldTotaal === raakTest.naKill.geldToename, raakTest.naKill);

// --- 3. Wave-bonus en Kerninslag tellen ook mee in geldTotaal --------------
const golfBonusTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.runStats.geldTotaal = 0;
  const geldVoor = d.spelStaat.geld;
  d.spelStaat.golfActief = true;
  d.updateGolf(0.1);   // ondoden.length === 0 -> wave-complete-tak
  return { golfBonusToename: d.spelStaat.geld - geldVoor, geldTotaalNaGolf: d.runStats.geldTotaal };
});
check('Een golf-afronding telt de wave-bonus mee in geldTotaal',
  golfBonusTest.golfBonusToename > 0 && golfBonusTest.geldTotaalNaGolf === golfBonusTest.golfBonusToename, golfBonusTest);

const kerninslagTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.runStats.geldTotaal = 0;
  d.spawnOndode(0, 'normaal');
  d.spawnOndode(0, 'normaal');
  const geldVoor = d.spelStaat.geld;
  d.geefKerninslag();
  return { toename: d.spelStaat.geld - geldVoor, geldTotaal: d.runStats.geldTotaal };
});
check('geefKerninslag() telt zijn bonus ook mee in geldTotaal',
  kerninslagTest.toename > 0 && kerninslagTest.geldTotaal === kerninslagTest.toename, kerninslagTest);

// --- 4. Power-up-pickup telt runStats.powerups op --------------------------
const powerupTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.runStats.powerups = 0;
  const drop = d.spawnPowerupDrop(d.speler.positie.x, d.speler.positie.z, 'munitievoorraad');
  d.raapPowerupOp(drop);
  return { powerups: d.runStats.powerups };
});
check('raapPowerupOp() telt runStats.powerups op',
  powerupTest.powerups === 1, powerupTest);

// --- 5. spelerSchade() zet runStats.doodDoor op de laatste aanvaller ------
const doodDoorTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.runStats.doodDoor = null;
  const hpVoor = d.spelerStaat.hp;
  d.spelerStaat.hp = 50;   // ruim boven 0, geen game over
  d.spelerSchade(5, 'sjouwer');
  const naEen = d.runStats.doodDoor;
  d.spelerSchade(5, 'sluiper');   // laatste aanvaller wint
  const naTwee = d.runStats.doodDoor;
  d.spelerStaat.hp = hpVoor;   // terug herstellen voor latere tests in deze run
  return { naEen, naTwee };
});
check('spelerSchade() zet doodDoor op de aanroepende bron, en de LAATSTE aanvaller wint',
  doodDoorTest.naEen === 'sjouwer' && doodDoorTest.naTwee === 'sluiper', doodDoorTest);

// --- 6. berekenScore(): exacte formule -------------------------------------
const scoreTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.runStats.kills = 4; d.runStats.headshots = 2; d.spelStaat.golf = 3;
  return d.berekenScore();
});
check('berekenScore() = kills*10 + headshots*15 + (golf-1)*100',
  scoreTest === 4 * 10 + 2 * 15 + 2 * 100, { scoreTest });

// --- 7. Highscore-helpers: round-trip via localStorage ---------------------
const highscoreTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.leesHighscore();
  d.schrijfHighscore({ score: 1234, golf: 7, datum: 'test' });
  const na = d.leesHighscore();
  return { voor, na };
});
check('leesHighscore() geeft null zonder eerder record',
  highscoreTest.voor === null, highscoreTest);
check('schrijfHighscore()/leesHighscore() rondtrippen exact via localStorage',
  highscoreTest.na && highscoreTest.na.score === 1234 && highscoreTest.na.golf === 7, highscoreTest);

// --- 8. Geweigerde localStorage breekt niets (guard) -----------------------
const guardTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const echt = window.localStorage;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new Error('geweigerd (privacy-modus, simulatie)'); },
  });
  let fout = null;
  let leesResultaat;
  try {
    d.schrijfHighscore({ score: 1, golf: 1, datum: 'x' });
    leesResultaat = d.leesHighscore();
  } catch (e) {
    fout = String(e);
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: echt });
  return { fout, leesResultaat };
});
check('Een gooiende localStorage-getter breekt schrijfHighscore()/leesHighscore() niet (try/catch-guard)',
  guardTest.fout === null && guardTest.leesResultaat === null, guardTest);

// --- 9. gameOver() vult het scherm: score, stats en "NIEUW RECORD" --------
const gameOverTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.schrijfHighscore({ score: 5, golf: 1, datum: 'oud' });   // laag record, moet verslagen worden
  d.runStats.kills = 3; d.runStats.headshots = 1; d.runStats.schoten = 10; d.runStats.treffers = 4;
  d.runStats.geldTotaal = 250; d.runStats.powerups = 2; d.runStats.doodDoor = 'sjouwer';
  d.spelStaat.golf = 5;
  // Ticket 158 (deel A): gameOver() telt sinds dit ticket ook een
  // geld-bonus mee in de score (zie tests/test-geldeconomie.mjs voor die
  // kant) — expliciet op 0 zodat DEZE check exact de kale
  // kills/headshots/golf-formule blijft meten, ongeacht wat eerdere
  // secties in dit bestand al aan spelStaat.geld hebben toegevoegd.
  d.spelStaat.geld = 0;
  d.spelStaat.gameOver = false;
  d.gameOver();
  return {
    scoreTekst: document.getElementById('scoreTekst').textContent,
    statsHTML: document.getElementById('gameOverStats').innerHTML,
    recordTekst: document.getElementById('gameOverRecord').textContent,
    opgeslagen: d.leesHighscore(),
    schermZichtbaar: document.getElementById('gameOverScherm').style.display,
  };
});
const verwachteScore = 3 * 10 + 1 * 15 + (5 - 1) * 100;
check('gameOver() zet de score-tekst op de exacte berekenScore()-waarde',
  gameOverTest.scoreTekst === String(verwachteScore), { gameOverTest, verwachteScore });
check('gameOver() toont kills/headshots/treffers/geld/powerups/doodDoor in de statsblok',
  gameOverTest.statsHTML.includes('Kills: 3') && gameOverTest.statsHTML.includes('Headshots: 1') &&
  gameOverTest.statsHTML.includes('Treffers: 4 / 10') && gameOverTest.statsHTML.includes('€250') &&
  gameOverTest.statsHTML.includes('Power-ups: 2') && gameOverTest.statsHTML.includes('Sjouwer'), gameOverTest);
check('gameOver() overschrijft het lage oude record en toont NIEUW RECORD',
  gameOverTest.recordTekst === 'NIEUW RECORD!' && gameOverTest.opgeslagen.score === verwachteScore, gameOverTest);
check('gameOverScherm wordt zichtbaar gemaakt',
  gameOverTest.schermZichtbaar === 'flex', gameOverTest);

// --- 10. toonStartschermRecord() reflecteert het opgeslagen record --------
const startschermTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.schrijfHighscore({ score: 999, golf: 4, datum: 'x' });
  d.toonStartschermRecord();
  return document.getElementById('startschermRecord').textContent;
});
check('toonStartschermRecord() toont score en golf van het opgeslagen record',
  startschermTest.includes('999') && startschermTest.includes('4'), { startschermTest });

// --- 11. Source-check: geen allocaties in het schiet()/raakOndode()-hot-pad
// door de nieuwe increments (blijven kale x++/+=-regels) --------------------
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const meshPatroon = /new\s+THREE\.(Mesh|.*Geometry|.*Material)\(/;
  return {
    schietHeeftAllocatie: meshPatroon.test(d.schiet.toString()),
    raakOndodeHeeftAllocatie: meshPatroon.test(d.raakOndode.toString()),
  };
});
check('schiet() alloceert nog steeds geen nieuwe mesh/geometry/material (T42 voegt alleen x++ toe)',
  bronTest.schietHeeftAllocatie === false, bronTest);
check('raakOndode() alloceert nog steeds geen nieuwe mesh/geometry/material',
  bronTest.raakOndodeHeeftAllocatie === false, bronTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
