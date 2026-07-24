// Ticket 45: De Ontsnapping (win-conditie + winscherm). Bewaakt: het punt
// verschijnt pas bij 3/3 vluchtroute-onderdelen, bij het kelderluik; de
// geld-eis werkt (te weinig geld = bestaande "nog €X nodig"-flow, geen
// aftrek); succesvol ontsnappen toont het winscherm met score(+1000 vóór
// de scoreFactor)/stats/record, ZONDER spelStaat.gameOver te zetten; de
// schermen-guard laat het startscherm niet over het winscherm heen poppen;
// "Speel door" verwijdert het punt definitief en hervat het spel; de
// bestaande gameOver-/pauzeflow blijft byte-voor-byte werken.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Vóór 3/3: geen ontsnappingspunt --------------------------------
const voorDrieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 2;
  d.ontsnappingsPunt = null;
  d.toonOntsnappingspuntIndienKlaar();
  return { punt: d.ontsnappingsPunt, interactiePuntenBevat: d.interactiePunten.some(p => p.naam === 'De Ontsnapping') };
});
check('Bij 2/3 opgepakte onderdelen verschijnt het ontsnappingspunt nog niet',
  voorDrieTest.punt === null && voorDrieTest.interactiePuntenBevat === false, voorDrieTest);

// --- 2. Bij 3/3: het punt verschijnt, exact bij het kelderluik -----------
const drieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.toonOntsnappingspuntIndienKlaar();
  return {
    puntBestaat: d.ontsnappingsPunt !== null,
    positieX: d.ontsnappingsPunt.positie.x, positieZ: d.ontsnappingsPunt.positie.z,
    kelderluikX: d.kelderluikMesh.position.x, kelderluikZ: d.kelderluikMesh.position.z,
    interactiePuntenBevat: d.interactiePunten.includes(d.ontsnappingsPunt),
  };
});
check('Bij 3/3 verschijnt het ontsnappingspunt, exact op de positie van het kelderluik',
  drieTest.puntBestaat && drieTest.positieX === drieTest.kelderluikX && drieTest.positieZ === drieTest.kelderluikZ, drieTest);
check('Het ontsnappingspunt staat in interactiePunten',
  drieTest.interactiePuntenBevat, drieTest);

// --- 3. Idempotent: nogmaals aanroepen voegt niets dubbel toe -------------
const idempotentTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lengteVoor = d.interactiePunten.length;
  for (let i = 0; i < 5; i++) d.toonOntsnappingspuntIndienKlaar();
  return { lengteNa: d.interactiePunten.length, lengteVoor };
});
check('Herhaald aanroepen na verschijnen voegt het punt niet nogmaals toe',
  idempotentTest.lengteNa === idempotentTest.lengteVoor, idempotentTest);

// --- 4. Te weinig geld: prompt + geen aftrek, geen winscherm --------------
const teWeinigGeldTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100;
  const promptTekst = d.ontsnappingsPunt.prompt();
  d.probeerOntsnapping();
  return {
    promptTekst,
    geldNa: d.spelStaat.geld,
    winSchermDisplay: document.getElementById('winScherm').style.display,
  };
});
check('Met te weinig geld toont de prompt "nog €X nodig"',
  teWeinigGeldTest.promptTekst.includes('Nog €2400 nodig'), teWeinigGeldTest);
check('probeerOntsnapping() met te weinig geld trekt niets af en toont geen winscherm',
  teWeinigGeldTest.geldNa === 100 && teWeinigGeldTest.winSchermDisplay !== 'flex', teWeinigGeldTest);

// --- 5. Genoeg geld: aftrek, winscherm, score(+1000)/stats/record, GEEN
// game over -------------------------------------------------------------
const ontsnapTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.removeItem(d.HIGHSCORE_KEY);
  d.spelStaat.geld = 5000;
  d.spelStaat.golf = 6;
  d.runStats.kills = 10; d.runStats.headshots = 4; d.runStats.treffers = 14; d.runStats.schoten = 20;
  d.runStats.geldTotaal = 500; d.runStats.powerups = 1;
  d.moeilijkheid = d.MOEILIJKHEDEN.amsterdammer;
  const verwachteScore = Math.round((10 * 10 + 4 * 15 + 5 * 100 + 1000) * 1);
  const promptTekst = d.ontsnappingsPunt.prompt();
  d.probeerOntsnapping();
  return {
    promptTekst,
    geldNa: d.spelStaat.geld,
    gameOverNa: d.spelStaat.gameOver,
    winSchermDisplay: document.getElementById('winScherm').style.display,
    scoreTekst: document.getElementById('winScoreTekst').textContent,
    verwachteScore,
    statsHTML: document.getElementById('winStats').innerHTML,
    recordTekst: document.getElementById('winRecord').textContent,
    opgeslagen: d.leesHighscore(),
  };
});
check('Met genoeg geld toont de prompt "ontsnap over het water"',
  ontsnapTest.promptTekst.includes('ontsnap over het water'), ontsnapTest);
check('probeerOntsnapping() trekt ONTSNAPPING_PRIJS (€2500) af',
  ontsnapTest.geldNa === 5000 - 2500, ontsnapTest);
check('spelStaat.gameOver blijft false — winnen is GEEN game over',
  ontsnapTest.gameOverNa === false, ontsnapTest);
check('Het winscherm wordt zichtbaar',
  ontsnapTest.winSchermDisplay === 'flex', ontsnapTest);
check('De score bevat exact de +1000-ontsnappingsbonus vóór de scoreFactor',
  ontsnapTest.scoreTekst === String(ontsnapTest.verwachteScore), ontsnapTest);
check('Het winscherm toont kills/headshots/treffers/geld/powerups/moeilijkheid',
  ontsnapTest.statsHTML.includes('Kills: 10') && ontsnapTest.statsHTML.includes('Headshots: 4') &&
  ontsnapTest.statsHTML.includes('Treffers: 14 / 20') && ontsnapTest.statsHTML.includes('€500') &&
  ontsnapTest.statsHTML.includes('Power-ups: 1') && ontsnapTest.statsHTML.includes('Amsterdammer'), ontsnapTest);
check('Het record wordt opgeslagen als NIEUW RECORD (geen eerder record)',
  ontsnapTest.recordTekst === 'NIEUW RECORD!' && ontsnapTest.opgeslagen.score === ontsnapTest.verwachteScore, ontsnapTest);

// --- 6. Schermen-guard: het startscherm popt NIET over het winscherm heen
// wanneer de pointer lock loslaat (dezelfde guard als game over) ----------
const guardTest = await page.evaluate(() => {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return {
    startschermDisplay: document.getElementById('startscherm').style.display,
    winSchermNogZichtbaar: document.getElementById('winScherm').style.display === 'flex',
  };
});
check('Zolang het winscherm zichtbaar is, blijft het startscherm verborgen (popt er niet overheen)',
  guardTest.startschermDisplay !== 'flex' && guardTest.winSchermNogZichtbaar, guardTest);

// --- 7. "Speel door": winscherm dicht, punt definitief weg, spel hervat --
const speelDoorTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const puntVoor = d.ontsnappingsPunt;
  document.getElementById('speelDoorKnop').click();
  return {
    winSchermDisplay: document.getElementById('winScherm').style.display,
    ontsnappingsPuntNa: d.ontsnappingsPunt,
    interactiePuntenBevatNietMeer: !d.interactiePunten.includes(puntVoor),
  };
});
check('"Speel door" verbergt het winscherm',
  speelDoorTest.winSchermDisplay === 'none', speelDoorTest);
check('"Speel door" verwijdert het ontsnappingspunt definitief (ontsnappingsPunt === null, uit interactiePunten)',
  speelDoorTest.ontsnappingsPuntNa === null && speelDoorTest.interactiePuntenBevatNietMeer, speelDoorTest);

// --- 8. "Opnieuw"-knop op het winscherm bestaat en is klikbaar (reload
// zelf niet headless-testbaar zonder de pagina te breken; alleen de
// aanwezigheid/klikbaarheid van de knop wordt hier bewaakt) ----------------
const opnieuwKnopTest = await page.evaluate(() => {
  const knop = document.getElementById('opnieuwKnopWin');
  return { bestaat: knop !== null, tekst: knop ? knop.textContent : null };
});
check('De "Opnieuw"-knop op het winscherm bestaat',
  opnieuwKnopTest.bestaat && opnieuwKnopTest.tekst === 'Opnieuw', opnieuwKnopTest);

// --- 9. Regressie: de bestaande gameOver-flow blijft byte-voor-byte werken
// (guard-uitbreiding mag 'm niet raken) -------------------------------------
const { browser: b2, page: p2, errs: errs2 } = await openAmsterdamUndead();
const gameOverRegressie = await p2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.gameOver = false;
  d.gameOver();
  const naGameOver = { gameOverSchermDisplay: document.getElementById('gameOverScherm').style.display };
  // De bestaande guard: pointer-lock-verlies na game over mag het
  // startscherm niet laten terugpoppen.
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return { ...naGameOver, startschermDisplay: document.getElementById('startscherm').style.display };
});
check('gameOver() toont nog steeds het gameOver-scherm (regressie, T45 raakt gameOver() niet aan)',
  gameOverRegressie.gameOverSchermDisplay === 'flex', gameOverRegressie);
check('Na game over popt het startscherm nog steeds niet terug (bestaande guard blijft werken)',
  gameOverRegressie.startschermDisplay !== 'flex', gameOverRegressie);
await b2.close();

// --- 10. Regressie: normale pauze-hervatting (geen winscherm, geen game
// over) laat het startscherm nog gewoon verschijnen/verdwijnen -------------
const { browser: b3, page: p3, errs: errs3 } = await openAmsterdamUndead();
const pauzeRegressie = await p3.evaluate(() => {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return { startschermDisplay: document.getElementById('startscherm').style.display };
});
check('Zonder game over/winscherm verschijnt het startscherm nog gewoon bij pauze',
  pauzeRegressie.startschermDisplay === 'flex', pauzeRegressie);
await b3.close();

const fails = report([...errs, ...errs2, ...errs3]);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
