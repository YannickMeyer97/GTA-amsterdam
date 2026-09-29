// Ticket D55 (SONNET_EXECUTION_PLAN_monument.md, §12, fase P) — een run van
// 15 waves met een overwinning.
//
// Winnen na wave 15, sterren per drempel, het overwinningsscherm, het spel
// staat stil tot je kiest, doorspelen (eindeloos, met de oude themacyclus),
// opnieuw, de highscore-roundtrip (gewonnen en beste sterren), en geen
// overwinning bij game over of vóór wave 15.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Rond de lopende wave af: geen robots meer, niets meer te spawnen.
const rondAf = () => page.evaluate(() => {
  const d = window.DamChaosDebug;
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
});
const stand = () => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const zichtbaar = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  return {
    wave: d.spel.wave, gewonnen: d.spel.gewonnen, sterren: d.spel.sterren, open: d.spel.overwinningOpen, gameOver: d.spel.gameOver,
    scherm: zichtbaar('overwinningscherm'), startscherm: zichtbaar('startscherm'), eindscherm: zichtbaar('eindscherm'),
    hud: document.getElementById('waveUI').textContent,
    sterrenTekst: document.getElementById('winSterren').textContent,
    gevuld: document.getElementById('winSterren').textContent.length - (document.querySelector('#winSterren .leeg')?.textContent.length ?? 0),
    ondertitel: document.getElementById('winOndertitel').textContent,
    record: document.getElementById('winRecord').textContent,
    stats: document.getElementById('winStats').textContent,
    highscore: d.leesHighscore(),
  };
});
// D62: sterren volgen de opgelopen schade; `hp` zet beide (100 − hp opgelopen).
const naarWave = (wave, hp = 100) => page.evaluate(([wave, hp]) => {
  const d = window.DamChaosDebug;
  d.resetRun();
  d.spel.volgendePoorten = [];
  d.startWave(wave);
  d.spel.monumentHP = hp;
  d.spel.schadeOpgelopen = 100 - hp;
}, [wave, hp]);

// 1. Sterren per drempel (pure functie).
const sterren = await page.evaluate(() => [0, 10, 10.1, 50, 50.1, 95].map(s => window.DamChaosDebug.sterrenVoor(s)));
check('Sterren naar opgelopen schade (D62, D63): ≤ 10% → 3, ≤ 50% → 2, anders 1', JSON.stringify(sterren) === JSON.stringify([3, 3, 2, 2, 1, 1]), sterren);

// 2. De run is 15 waves; de HUD toont dat.
await naarWave(7);
const hud7 = (await stand()).hud;
check('HUD tijdens de run: "Wave 7 / 15"', hud7.startsWith('Wave 7 / 15,'), hud7);

// 3. Wave 14 afronden: nog geen overwinning.
await naarWave(14);
await rondAf();
const na14 = await stand();
check('Na wave 14: nog geen overwinning, geen scherm', !na14.gewonnen && !na14.open && !na14.scherm, na14);

// 4. Wave 15 afronden met 40% opgelopen schade (monument op 60%): gewonnen, 2 sterren.
await naarWave(15, 60);
await rondAf();
const gewonnen = await stand();
check('Na wave 15: gewonnen, het overwinningsscherm staat open', gewonnen.gewonnen && gewonnen.open && gewonnen.scherm && !gewonnen.startscherm && !gewonnen.eindscherm, gewonnen);
check('40% opgelopen: 2 van de 3 sterren, en dat staat op het scherm', gewonnen.sterren === 2 && gewonnen.gevuld === 2 && gewonnen.sterrenTekst.length === 3, gewonnen);
check('De ondertitel noemt 15 waves, de opgelopen schade (40%) en de drempels', /15 waves/.test(gewonnen.ondertitel) && /40% schade opgelopen/.test(gewonnen.ondertitel) && /≤ 10%/.test(gewonnen.ondertitel) && /≤ 50%/.test(gewonnen.ondertitel), gewonnen.ondertitel);
check('Eerste overwinning: dat staat erbij, met de statistieken van de run', gewonnen.record === 'EERSTE OVERWINNING!' && /Score/.test(gewonnen.stats) && /Speelduur/.test(gewonnen.stats), gewonnen);
check('De overwinning is bewaard: gewonnen, beste sterren 2', gewonnen.highscore?.gewonnen === true && gewonnen.highscore?.besteSterren === 2, gewonnen.highscore);

// 5. Het spel staat stil zolang het scherm open is, en een klik op het
// startscherm hervat niets.
const stil = await page.evaluate(async () => {
  const d = window.DamChaosDebug;
  const voor = d.spel.tussenWaveTimer;
  document.getElementById('startscherm').click();
  await new Promise(r => setTimeout(r, 400));
  return { voor, na: d.spel.tussenWaveTimer, open: d.spel.overwinningOpen, wave: d.spel.wave };
});
check('Zolang het overwinningsscherm open is, loopt de bouwfase niet door', stil.na === stil.voor && stil.open && stil.wave === 15, stil);

// 6. Doorspelen: scherm dicht, de bouwfase gaat verder naar wave 16, HUD
// zonder "/ 15", en er volgt geen tweede overwinning.
await page.click('#doorspeelKnop');
const door = await stand();
// (Het startscherm is alleen het vangnet als de pointer lock geweigerd wordt;
// met de gesimuleerde lock gaat het spel meteen verder.)
check('Doorspelen sluit het scherm en het spel gaat verder, nog steeds gewonnen', !door.open && !door.scherm && !door.eindscherm && door.gewonnen, door);
const verder = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.updateWaveSysteem(d.BOUWFASE_DUUR + 0.1);
  d.updateWaveSysteem(0);
  return { wave: d.spel.wave, hud: document.getElementById('waveUI').textContent };
});
check('Na de bouwfase start wave 16, en de HUD zegt "Wave 16" zonder "/ 15"', verder.wave === 16 && verder.hud.startsWith('Wave 16,'), verder);
await page.evaluate(() => { const d = window.DamChaosDebug; d.spel.wave = 29; d.startWave(30); });
await rondAf();
const geenTweede = await stand();
check('Doorspelen tot wave 30: geen tweede overwinning of scherm', !geenTweede.open && !geenTweede.scherm, geenTweede);

// 7. Game over na doorspelen: het eindscherm noemt de overwinning.
const eind = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.monumentHP = 0;
  d.eindigRun();
  return document.getElementById('eindOndertitel').textContent;
});
check('Game over na doorspelen: het eindscherm noemt "De Dam gered" en de sterren', /De Dam gered \(★★\)/.test(eind) && /wave 30/.test(eind), eind);

// 8. Tweede overwinning: minder sterren houdt het record, meer sterren is
// een nieuw sterrenrecord. Een nieuw scorerecord laat "gewonnen" staan.
await naarWave(15, 30);
await rondAf();
const minder = await stand();
check('Tweede overwinning met 1 ster: beste blijft 2, geen "nieuw"', minder.sterren === 1 && minder.highscore.besteSterren === 2 && minder.record === 'Beste: ★★', minder);
await page.click('#winOpnieuwKnop');
const opnieuw = await stand();
check('Opnieuw vanaf het overwinningsscherm: terug naar wave 1, niet gewonnen, scherm dicht', opnieuw.wave === 1 && !opnieuw.gewonnen && !opnieuw.open && !opnieuw.scherm, opnieuw);
await naarWave(15, 95);
await rondAf();
const meer = await stand();
check('Overwinning met 3 sterren: NIEUW STERRENRECORD en beste wordt 3', meer.sterren === 3 && meer.record === 'NIEUW STERRENRECORD!' && meer.highscore.besteSterren === 3, meer);
const scoreRecord = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.score = 999999;
  d.verwerkHighscore();
  return d.leesHighscore();
});
check('Een nieuw scorerecord laat "gewonnen" en de beste sterren staan', scoreRecord.score === 999999 && scoreRecord.gewonnen && scoreRecord.besteSterren === 3, scoreRecord);

// 9. Game over vóór wave 15: geen overwinning.
const verloren = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.resetRun();
  d.startWave(8);
  d.spel.monumentHP = 0;
  d.eindigRun();
  return { gewonnen: d.spel.gewonnen, open: d.spel.overwinningOpen, ondertitel: document.getElementById('eindOndertitel').textContent };
});
check('Game over in wave 8: geen overwinning, het gewone eindscherm', !verloren.gewonnen && !verloren.open && /Wave 8 bereikt/.test(verloren.ondertitel), verloren);

// 10. Themagolven: vast binnen de run, om de baaswaves heen; daarna de
// oude cyclus.
const themas = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  for (let w = 1; w <= 30; w++) { const t = d.themaSleutelVoorWave(w); if (t) uit[w] = t; }
  return uit;
});
check('Thema\'s in de run: Tankkonvooi 7, Spitsuur 9, Grachtenmist 12; niets op 5, 10 of 15',
  JSON.stringify(Object.entries(themas).filter(([w]) => w <= 15)) === JSON.stringify([['7', 'tankkonvooi'], ['9', 'spitsuur'], ['12', 'grachtenmist']]), themas);
check('Na de run weer om de 4 waves: 18, 22, 26, 30', JSON.stringify(Object.keys(themas).filter(w => w > 15)) === JSON.stringify(['18', '22', '26', '30']) && themas[18] === 'tankkonvooi', themas);

// 11. Een corrupt highscorerecord met rare velden: gewonnen en sterren vallen stil terug.
const corrupt = await page.evaluate(() => {
  localStorage.setItem(window.DamChaosDebug.HIGHSCORE_KEY, JSON.stringify({ score: 10, gewonnen: 'ja', besteSterren: 7 }));
  return window.DamChaosDebug.leesHighscore();
});
check('Ongeldige "gewonnen" of sterren kosten het record niet, alleen dat veld', corrupt.score === 10 && corrupt.gewonnen === false && corrupt.besteSterren === 0, corrupt);

// 12. Ticket D62: repareren koopt geen sterren. 5 robots halen het monument
// (5 × 8 = 40%), dan terugrepareren naar 100%: nog steeds 2 sterren.
const repareren = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  localStorage.clear();
  d.resetRun();
  d.startWave(15);
  for (let i = 0; i < 5; i++) { d.spawnRobot(null, 'normal'); d.robotRaaktMonument(d.robots[d.robots.length - 1]); }
  const na = { hp: d.spel.monumentHP, opgelopen: d.spel.schadeOpgelopen };
  d.geldZet(1000);
  d.koopMonumentReparatie(); d.koopMonumentReparatie();
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
  return { na, hpBijWinst: d.spel.monumentHP, opgelopen: d.spel.schadeOpgelopen, sterren: d.spel.sterren };
});
check('Repareren koopt geen sterren: 40% opgelopen, teruggerepareerd naar 100%, blijft 2 sterren', repareren.na.opgelopen === 40 && repareren.hpBijWinst === 100 && repareren.opgelopen === 40 && repareren.sterren === 2, repareren);
const naReset = await page.evaluate(() => { const d = window.DamChaosDebug; d.resetRun(); return d.spel.schadeOpgelopen; });
check('Een nieuwe run begint met 0% opgelopen schade', naReset === 0, naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
