// Eventgolven: basisframework (Ticket 6) + Mistgolf-fog (Ticket 7) +
// Sluiper (Ticket 8) + Mistgolf-spawngewichten (Ticket 9).
// Zie ARCHITECTURE_NOTES.md §1 "Waves" en ROADMAP.md Tickets 6-9.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- Ticket 6: isEventGolf() -----------------------------------------------
const isEvent = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { g4: d.isEventGolf(4), g5: d.isEventGolf(5), g6: d.isEventGolf(6), g10: d.isEventGolf(10), g15: d.isEventGolf(15) };
});
check('isEventGolf(): alleen veelvouden van 5 (golf 5/10/15), niet golf 4/6',
  isEvent.g5 === true && isEvent.g10 === true && isEvent.g15 === true && isEvent.g4 === false && isEvent.g6 === false, isEvent);

// --- Ticket 6: startGolf() op een eventgolf zet actieveEventGolf + banner --
const startEvent = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const el = document.getElementById('golfBanner');
  return { actief: d.actieveEventGolf, banner: el.textContent };
});
check("startGolf() op golf 5 zet actieveEventGolf op 'mist'", startEvent.actief === 'mist', startEvent);
check('startGolf() op golf 5 toont een event-banner', startEvent.banner.length > 0, startEvent);

// --- Ticket 6: golf 4/6 gedragen zich exact als voorheen (geen event) -----
const geenEvent = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.actieveEventGolf = null;
  d.spelStaat.golf = 6;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const el = document.getElementById('golfBanner');
  return { actief: d.actieveEventGolf, banner: el.textContent };
});
check('startGolf() op golf 6 laat actieveEventGolf op null', geenEvent.actief === null, geenEvent);
check('startGolf() op golf 6 toont de normale "GOLF 6"-banner', geenEvent.banner.includes('GOLF 6') && !geenEvent.banner.includes('EVENT'), geenEvent);

// --- Ticket 6: na golf-einde is actieveEventGolf weer null ----------------
const golfEinde = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 5;
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;
  d.actieveEventGolf = 'mist';
  d.updateGolf(0.1);
  return d.actieveEventGolf;
});
check('Na golf-einde is actieveEventGolf weer null', golfEinde === null, { golfEinde });

// --- Ticket 6: gameOver() ruimt een actieve eventgolf ook op --------------
const gameOverReset = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.actieveEventGolf = 'mist';
  d.spelStaat.gameOver = false;
  d.gameOver();
  const na = d.actieveEventGolf;
  d.spelStaat.gameOver = false;   // opruimen voor volgende checks
  document.getElementById('gameOverScherm').style.display = 'none';
  return na;
});
check('gameOver() zet actieveEventGolf terug naar null', gameOverReset === null, { gameOverReset });

// --- Ticket 7 + feedbackronde: fog wordt dichter tijdens een Mistgolf en
// trekt daarna GELEIDELIJK op (niet in één frame) --------------------------
const fogTijdensMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  d.spelStaat.gameOver = false;
  d.startGolf();
  return { near: d.scene.fog.near, far: d.scene.fog.far, kleur: d.scene.fog.color.getHex() };
});
check('Tijdens Mistgolf is fog.near/far gelijk aan FOG_MIST (15% dichterbij dan de eerste versie)',
  fogTijdensMist.near === 2.13 && fogTijdensMist.far === 9.35, fogTijdensMist);

const fogVlakNaGolfEinde = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;
  d.updateGolf(0.1);   // golf rondt af -> eindigEventGolf() start de uitfade
  return { near: d.scene.fog.near, far: d.scene.fog.far, uitfaseTimer: d.mistUitfaseTimer };
});
check('Vlak na golf-einde is de fog nog NIET meteen terug naar normaal (geleidelijke uitfade gestart)',
  fogVlakNaGolfEinde.near < 6 && fogVlakNaGolfEinde.uitfaseTimer > 0, fogVlakNaGolfEinde);

const fogNaVolledigeUitfade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (let i = 0; i < 100; i++) d.updateMistUitfade(0.1);   // 10s > MIST_UITFADE_DUUR (4s)
  return { near: d.scene.fog.near, far: d.scene.fog.far, uitfaseTimer: d.mistUitfaseTimer };
});
check('Na de volledige uitfade-duur staat de fog weer exact op FOG_NORMAAL',
  fogNaVolledigeUitfade.near === 6 && fogNaVolledigeUitfade.far === 24 && fogNaVolledigeUitfade.uitfaseTimer === 0, fogNaVolledigeUitfade);

const fogBuitenMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 6;
  d.spelStaat.gameOver = false;
  d.startGolf();
  return { near: d.scene.fog.near, far: d.scene.fog.far };
});
check('Golf 6 (geen event) start met normale fog', fogBuitenMist.near === 6 && fogBuitenMist.far === 24, fogBuitenMist);

const fogNaGameOverTijdensMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 10;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const tijdens = { near: d.scene.fog.near, far: d.scene.fog.far };
  d.gameOver();   // gameOver() gebruikt eindigEventGolf(true): DIRECTE reset, geen uitfade
  const na = { near: d.scene.fog.near, far: d.scene.fog.far, uitfaseTimer: d.mistUitfaseTimer };
  d.spelStaat.gameOver = false;
  document.getElementById('gameOverScherm').style.display = 'none';
  return { tijdens, na };
});
check('Fog was dichter tijdens de mist vlak vóór game over', fogNaGameOverTijdensMist.tijdens.near === 2.13, fogNaGameOverTijdensMist);
check('gameOver() midden in een Mistgolf herstelt de fog meteen (geen hangende uitfade, want het spel staat stil)',
  fogNaGameOverTijdensMist.na.near === 6 && fogNaGameOverTijdensMist.na.far === 24 && fogNaGameOverTijdensMist.na.uitfaseTimer === 0, fogNaGameOverTijdensMist);

// --- Ticket 8: Sluiper-stats -------------------------------------------
const sluiperStats = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 5;
  const sluiper = d.spawnOndode(0, 'sluiper');
  const normaal = d.spawnOndode(0, 'normaal');
  return { type: sluiper.type, snelheid: sluiper.snelheid, hp: sluiper.hp, normaalSnelheid: normaal.snelheid, normaalHp: normaal.hp };
});
check('Sluiper-snelheid is ~2.025 m/s (1.5 * 1.35, ±0.01)', Math.abs(sluiperStats.snelheid - 2.025) < 0.01, sluiperStats);
// Let op: bij hpMultiplier 0.75 op de kleine basis-HP's (1 op golf 1-4, 2
// vanaf golf 5) rondt Math.round() de sluiper-HP soms gelijk aan normaal af
// (round(2*0.75)=round(1.5)=2 in JS) — dus <= i.p.v. een harde "<".
check('Sluiper is sneller dan normaal en nooit meer HP',
  sluiperStats.snelheid > sluiperStats.normaalSnelheid && sluiperStats.hp <= sluiperStats.normaalHp, sluiperStats);

// --- Ticket 8: sluiper komt nooit voor buiten mist ------------------------
const geenSluiperBuitenMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.actieveEventGolf = null;
  const gezien = new Set();
  for (let golf = 1; golf <= 12; golf++) {
    d.spelStaat.golf = golf;
    for (let i = 0; i < 40; i++) gezien.add(d.kiesOndodeType());
  }
  return [...gezien];
});
check('kiesOndodeType() geeft nooit "sluiper" buiten een Mistgolf',
  !geenSluiperBuitenMist.includes('sluiper'), geenSluiperBuitenMist);

// --- Ticket 9: tijdens een Mistgolf is de golf 100% Sluipers -------------
const golfSpawnMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 5;
  d.actieveEventGolf = 'mist';
  for (const v of d.VENSTERS) v.planken = 0;
  const types = new Set();
  for (let i = 0; i < 100; i++) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.budget = 999;   // Ticket 13: golfSpawnStap checkt nu budget
    const o = d.golfSpawnStap();
    if (o) types.add(o.type);
  }
  d.actieveEventGolf = null;
  return [...types];
});
check('Tijdens een Mistgolf spawnt golfSpawnStap() uitsluitend Sluipers',
  golfSpawnMist.length === 1 && golfSpawnMist[0] === 'sluiper', golfSpawnMist);

const golfSpawnNormaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 6;
  d.actieveEventGolf = null;
  for (const v of d.VENSTERS) v.planken = 0;
  const types = new Set();
  for (let i = 0; i < 100; i++) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.budget = 999;   // Ticket 13: golfSpawnStap checkt nu budget
    const o = d.golfSpawnStap();
    if (o) types.add(o.type);
  }
  return [...types];
});
check('Golf 6 (geen event) spawnt nooit Sluipers', !golfSpawnNormaal.includes('sluiper'), golfSpawnNormaal);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
