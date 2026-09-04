// Ticket 45: De Ontsnapping (win-conditie + winscherm). Ticket 53 verhuisde
// het punt van het kelderluik naar de boot bij de vlonder (Ticket 52) — puur
// een positie-wijziging, de rest van de flow (geld-eis, winscherm, "Speel
// door") is ongemoeid gebleven. Ticket 54 voegde golf-gating toe (zie
// test-ontsnapping-vensters.mjs voor die volledige dekking) — hier wordt
// bij het testen van het 3/3-punt simpelweg een geldige ontsnappingsgolf
// gezet, de rest van deze suite draait golf-onafhankelijk. Bewaakt: het punt
// verschijnt pas bij 3/3 vluchtroute-onderdelen (tijdens een geldige
// ontsnappingsgolf), exact bij de boot; de
// geld-eis werkt (te weinig geld = bestaande "nog €X nodig"-flow, geen
// aftrek); succesvol ontsnappen toont uiteindelijk het winscherm met
// score(+1000 vóór de scoreFactor)/stats/record, ZONDER spelStaat.gameOver
// te zetten; de schermen-guard laat het startscherm niet over het winscherm
// heen poppen; "Speel door" verwijdert het punt definitief en hervat het
// spel; de bestaande gameOver-/pauzeflow blijft byte-voor-byte werken.
//
// Ticket 146: probeerOntsnapping() wint niet meer meteen — hij start de
// instapfase (geld gaat er WEL meteen af) en pas voltooiOntsnapping() toont
// het winscherm. Sectie 5 hieronder roept daarom na probeerOntsnapping()
// expliciet voltooiOntsnapping() aan om bij het winscherm te komen: dit
// bestand bewaakt de INHOUD van dat scherm (score/stats/record), niet de
// timing van de instapfase zelf — die heeft zijn eigen dekking in
// test-finale.mjs (timer, pauzeren/hervatten, golfgrens, game over
// middenin).
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

// --- 2. Bij 3/3 ÉN een geldige ontsnappingsgolf (Ticket 54): het punt
// verschijnt, exact bij de boot (Ticket 52/53) -----------------------------
const drieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;   // Ticket 54: het punt verschijnt nu alleen tijdens een ontsnappingsgolf
  d.toonOntsnappingspuntIndienKlaar();
  return {
    puntBestaat: d.ontsnappingsPunt !== null,
    positieX: d.ontsnappingsPunt.positie.x, positieZ: d.ontsnappingsPunt.positie.z,
    // Feedback (fysieke boot-aankomst): het punt rekent nu vanaf de vaste
    // BOOT_DOK_X-constante, niet meer vanaf het live bootGroep.position.x —
    // die staat hier nog op BOOT_VERTREK_X, want deze test roept
    // updateBootPositie() bewust niet aan (dat hoort bij de aankomst-
    // animatie, niet bij de 3/3-verschijnlogica die dit blok bewaakt).
    // Feedback-fix (jetski, schuine aanvaarroute): verwachtZ was
    // `d.bootGroep.position.z`, en dat werkte zolang de boot recht van
    // opzij kwam en zijn z dus constant was. Sinds de route diagonaal
    // loopt (BOOT_VERTREK_Z -> aanlegplek) is die z een momentopname van
    // de vaarbeweging. Het ontsnappingspunt hoort bij de AANGEMEERDE
    // plek, dus staat er in de game nu expliciet BIJKEUKEN_CZ — en deze
    // test spiegelt dat, in plaats van een bewegend doel te lezen.
    verwachtX: d.BOOT_DOK_X - 1.5, verwachtZ: d.BIJKEUKEN_CZ,
    binnenVlonder: d.ontsnappingsPunt.positie.x < d.VLONDER_X_OOST,
    interactiePuntenBevat: d.interactiePunten.includes(d.ontsnappingsPunt),
  };
});
check('Bij 3/3 verschijnt het ontsnappingspunt, exact vóór de boeg van de boot',
  drieTest.puntBestaat && drieTest.positieX === drieTest.verwachtX && drieTest.positieZ === drieTest.verwachtZ, drieTest);
check('Het ontsnappingspunt ligt nog binnen de vlonder (loopbaar, niet in het water)',
  drieTest.binnenVlonder, drieTest);
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

// --- 4. Te weinig geld: prompt + geen aftrek, geen winscherm, geen instap -
const teWeinigGeldTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100;
  const promptTekst = d.ontsnappingsPunt.prompt();
  d.probeerOntsnapping();
  return {
    promptTekst,
    geldNa: d.spelStaat.geld,
    winSchermDisplay: document.getElementById('winScherm').style.display,
    instapActief: d.instapActief,
  };
});
check('Met te weinig geld toont de prompt "nog €X nodig"',
  teWeinigGeldTest.promptTekst.includes('Nog €2400 nodig'), teWeinigGeldTest);
check('probeerOntsnapping() met te weinig geld trekt niets af, toont geen winscherm en start geen instapfase',
  teWeinigGeldTest.geldNa === 100 && teWeinigGeldTest.winSchermDisplay !== 'flex'
  && teWeinigGeldTest.instapActief === false, teWeinigGeldTest);

// --- 5. Genoeg geld: instapfase start, geld gaat DIRECT af (Ticket 146) —
// pas na voltooiOntsnapping() komt het winscherm met score(+1000)/stats/
// record, GEEN game over. Deze sectie bewaakt de INHOUD van dat winscherm;
// de instapfase zelf (timer, pauzeren) staat in test-finale.mjs. -----------
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
  const naStart = {
    geldNa: d.spelStaat.geld,
    instapActiefNaStart: d.instapActief,
    instapTimerNaStart: d.instapTimer,
    verwachtInstapTimer: d.FINALE_INSTAP_DUUR,
    winSchermVoorVoltooiing: document.getElementById('winScherm').style.display,
  };
  d.spelStaat.geld = 0;   // T158: voorkomt dat de geld-score-bonus deze +1000-exacte-formuletoets verstoort (apart bewaakt in test-geldeconomie.mjs)
  d.voltooiOntsnapping();   // Ticket 146: forceert het einde van de instapfase
  return {
    promptTekst,
    ...naStart,
    instapActiefNaVoltooiing: d.instapActief,
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
check('probeerOntsnapping() trekt ONTSNAPPING_PRIJS (€2500) DIRECT af — niet pas bij voltooiing',
  ontsnapTest.geldNa === 5000 - 2500, ontsnapTest);
check('probeerOntsnapping() start de instapfase i.p.v. meteen te winnen (instapActief true, timer op volle duur, nog geen winscherm)',
  ontsnapTest.instapActiefNaStart === true && ontsnapTest.instapTimerNaStart === ontsnapTest.verwachtInstapTimer
  && ontsnapTest.winSchermVoorVoltooiing !== 'flex', ontsnapTest);
check('voltooiOntsnapping() zet instapActief weer op false',
  ontsnapTest.instapActiefNaVoltooiing === false, ontsnapTest);
check('spelStaat.gameOver blijft false — winnen is GEEN game over',
  ontsnapTest.gameOverNa === false, ontsnapTest);
check('Het winscherm wordt zichtbaar (na voltooiOntsnapping())',
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
  const hudVoor = document.getElementById('ontsnappingVensterUI').textContent;
  document.getElementById('speelDoorKnop').click();
  return {
    winSchermDisplay: document.getElementById('winScherm').style.display,
    ontsnappingsPuntNa: d.ontsnappingsPunt,
    interactiePuntenBevatNietMeer: !d.interactiePunten.includes(puntVoor),
    hudVoor,
    hudNa: document.getElementById('ontsnappingVensterUI').textContent,
  };
});
check('"Speel door" verbergt het winscherm',
  speelDoorTest.winSchermDisplay === 'none', speelDoorTest);
check('"Speel door" verwijdert het ontsnappingspunt definitief (ontsnappingsPunt === null, uit interactiePunten)',
  speelDoorTest.ontsnappingsPuntNa === null && speelDoorTest.interactiePuntenBevatNietMeer, speelDoorTest);
// Ticket 76: vóór "Speel door" stond de HUD nog op "Boot ligt aan!" (het punt
// bestond net) — die tekst mag na het klikken niet blijven hangen (de boot is
// letterlijk niet meer aangemeerd), maar moet meteen naar de accurate
// "Boot over N golven" voor het volgende venster.
check('Vóór "Speel door" toonde de HUD nog "Boot ligt aan!" (testopzet klopt)',
  speelDoorTest.hudVoor === 'Boot ligt aan!', speelDoorTest);
check('Ná "Speel door" is de stale "Boot ligt aan!"-tekst weg, vervangen door een accurate "Boot over N golven"',
  speelDoorTest.hudNa !== 'Boot ligt aan!' && speelDoorTest.hudNa.startsWith('Boot over'), speelDoorTest);

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
