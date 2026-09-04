// Ticket 158 deel A (v0.26, ronde 12): restsaldo converteert naar score.
// Vóór dit ticket kwam `spelStaat.geld` nergens voor in berekenScore() —
// twee runs met identieke kills/headshots/golf gaven exact dezelfde score,
// ongeacht hoeveel geld er nog op zak was. Deze test bewaakt de fix, het
// plafond, de lagere game-over-koers, en dat de bestaande, kale
// kills/headshots/golf-formule zelf onaangeroerd blijft (berekenScore()
// zonder bonus-argument).
//
// Koers/plafond zijn empirisch gekalibreerd (zie de toelichting bij
// GELD_SCORE_KOERS_ONTSNAPPING in de bron) op een gemeten realistisch bereik
// van €1000-2750 restgeld op golf 20-25 bij een speler die alles koopt zodra
// het kan, vrijwel ongeacht moeilijkheidsgraad — deze test herhaalt die
// meting niet (dat hoort bij het kalibreren, niet bij regressiebewaking),
// maar toetst wel de GRENZEN die daaruit volgden.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. berekenScore() zelf blijft de kale formule (geen impliciete
// geld-term binnen de functie — de bonus komt van de AANROEPER) ----------
const kaleFormule = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.runStats.kills = 4; d.runStats.headshots = 2; d.spelStaat.golf = 3;
  d.spelStaat.geld = 9999;   // moet GEEN effect hebben zonder een bonus-argument
  return d.berekenScore();
});
check('berekenScore() zonder bonus-argument blijft exact kills*10+headshots*15+(golf-1)*100, ongeacht spelStaat.geld',
  kaleFormule === 4 * 10 + 2 * 15 + 2 * 100, { kaleFormule });

// --- 2. geldScoreBonus(): koers + plafond, precies berekend --------------
const bonusFormule = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const gevallen = [0, 1000, 2000, 3333, 100000].map((geld) => {
    d.spelStaat.geld = geld;
    return {
      geld,
      ontsnapping: d.geldScoreBonus(d.GELD_SCORE_KOERS_ONTSNAPPING, d.GELD_SCORE_PLAFOND_ONTSNAPPING),
      gameOver: d.geldScoreBonus(d.GELD_SCORE_KOERS_GAME_OVER, d.GELD_SCORE_PLAFOND_GAME_OVER),
    };
  });
  return { gevallen, plafondOntsnapping: d.GELD_SCORE_PLAFOND_ONTSNAPPING, plafondGameOver: d.GELD_SCORE_PLAFOND_GAME_OVER, koersOntsnapping: d.GELD_SCORE_KOERS_ONTSNAPPING, koersGameOver: d.GELD_SCORE_KOERS_GAME_OVER };
});
for (const g of bonusFormule.gevallen) {
  const verwachtOntsnapping = Math.min(bonusFormule.plafondOntsnapping, Math.round(g.geld * bonusFormule.koersOntsnapping));
  const verwachtGameOver = Math.min(bonusFormule.plafondGameOver, Math.round(g.geld * bonusFormule.koersGameOver));
  check(`geldScoreBonus() bij €${g.geld} (ontsnapping): min(plafond, geld*koers) = ${verwachtOntsnapping}`,
    g.ontsnapping === verwachtOntsnapping, g);
  check(`geldScoreBonus() bij €${g.geld} (game over): min(plafond, geld*koers) = ${verwachtGameOver}`,
    g.gameOver === verwachtGameOver, g);
}
check('Het plafond werkt daadwerkelijk: bij €100.000 wordt het plafond geraakt, niet de lineaire koers',
  bonusFormule.gevallen.at(-1).ontsnapping === bonusFormule.plafondOntsnapping, bonusFormule);

// --- 3. Game over-koers/-plafond zijn lager dan de ontsnappingsvariant —
// overleven met geld op zak moet altijd beter scoren dan sterven met
// hetzelfde bedrag. -------------------------------------------------------
const koersenLager = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    koersGameOverLager: d.GELD_SCORE_KOERS_GAME_OVER < d.GELD_SCORE_KOERS_ONTSNAPPING,
    plafondGameOverLager: d.GELD_SCORE_PLAFOND_GAME_OVER < d.GELD_SCORE_PLAFOND_ONTSNAPPING,
  };
});
check('De game-over-koers ligt lager dan de ontsnappingskoers', koersenLager.koersGameOverLager, koersenLager);
check('Het game-over-plafond ligt lager dan het ontsnappingsplafond', koersenLager.plafondGameOverLager, koersenLager);

// --- 4. Kernbelofte: twee runs met IDENTIEKE kills/headshots/golf maar
// verschillend restsaldo geven een VERSCHILLENDE score, via de echte
// gameOver()-aanroep (niet alleen de kale formule) ------------------------
const tweeRuns = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const draaiRun = (geld) => {
    d.runStats.kills = 10; d.runStats.headshots = 3; d.runStats.schoten = 20; d.runStats.treffers = 13;
    d.runStats.geldTotaal = geld; d.runStats.powerups = 1; d.runStats.doodDoor = 'normaal';
    d.spelStaat.golf = 8;
    d.spelStaat.geld = geld;
    d.spelStaat.gameOver = false;
    d.gameOver();
    return Number(document.getElementById('scoreTekst').textContent);
  };
  const scoreArm = draaiRun(0);
  const scoreRijk = draaiRun(2000);
  return { scoreArm, scoreRijk };
});
check('Twee gameOver()-runs met identieke kills/headshots/golf maar verschillend restsaldo (€0 vs €2000) geven een VERSCHILLENDE score',
  tweeRuns.scoreRijk > tweeRuns.scoreArm, tweeRuns);
check('Het verschil komt exact overeen met geldScoreBonus(€2000) - geldScoreBonus(€0) op de game-over-koers',
  tweeRuns.scoreRijk - tweeRuns.scoreArm === Math.min(250, Math.round(2000 * 0.075)), tweeRuns);

// --- 5. Hetzelfde voor een geslaagde ontsnapping (toonWinScherm()) -------
const tweeOntsnappingen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const draaiRun = (geld) => {
    d.runStats.kills = 10; d.runStats.headshots = 3;
    d.spelStaat.golf = 8;
    d.spelStaat.geld = geld;
    d.toonWinScherm();
    return Number(document.getElementById('winScoreTekst').textContent);
  };
  const scoreArm = draaiRun(0);
  const scoreRijk = draaiRun(2000);
  return { scoreArm, scoreRijk };
});
check('Twee toonWinScherm()-runs met identieke kills/headshots/golf maar verschillend restsaldo geven een VERSCHILLENDE score',
  tweeOntsnappingen.scoreRijk > tweeOntsnappingen.scoreArm, tweeOntsnappingen);

// --- 6. De geld-bonus wordt nooit de dominante scoreterm, ook niet in het
// uiterste hoarder-scenario (harde assertie op een lategame-simulatie) ----
const dominantieCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Golf 25, een realistisch aantal kills (elke golf minstens een paar
  // treffers) en een EXTREEM hoog restsaldo (ruim boven het gemeten
  // hoarder-uiterste van ~€17.000 op golf 25) — het ongunstigste geval voor
  // deze eis.
  d.runStats.kills = 150; d.runStats.headshots = 40;
  d.spelStaat.golf = 25;
  d.spelStaat.geld = 50000;
  const scoreZonderGeld = d.berekenScore();   // dezelfde run, maar zonder de geld-bonus
  const bonusOntsnapping = d.geldScoreBonus(d.GELD_SCORE_KOERS_ONTSNAPPING, d.GELD_SCORE_PLAFOND_ONTSNAPPING);
  return { scoreZonderGeld, bonusOntsnapping };
});
check('Zelfs bij €50.000 restsaldo op golf 25 blijft de geld-bonus (ontsnapping) een KLEIN aandeel van de totale score (< 15%)',
  dominantieCheck.bonusOntsnapping / dominantieCheck.scoreZonderGeld < 0.15, dominantieCheck);

// --- 7. moeilijkheid.scoreFactor blijft ook op de geld-bonus van
// toepassing (loopt door dezelfde bonus-parameter, dus geen aparte
// difficulty-uitzondering nodig — precies zoals de bestaande +1000-
// ontsnappingsbonus al werkt) ----------------------------------------------
const scoreFactorTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.runStats.kills = 0; d.runStats.headshots = 0;
  d.spelStaat.golf = 1;
  d.spelStaat.geld = 1000;
  const bonus = d.geldScoreBonus(d.GELD_SCORE_KOERS_ONTSNAPPING, d.GELD_SCORE_PLAFOND_ONTSNAPPING);
  d.kiesMoeilijkheid('nachtwacht');
  const scoreNachtwacht = d.berekenScore(bonus);
  d.kiesMoeilijkheid('amsterdammer');
  const scoreAmsterdammer = d.berekenScore(bonus);
  return { bonus, scoreNachtwacht, scoreAmsterdammer, factor: d.MOEILIJKHEDEN.nachtwacht.scoreFactor };
});
check('De geld-bonus wordt net als de rest van de score door moeilijkheid.scoreFactor geschaald (Nachtwacht 1.5x t.o.v. Amsterdammer)',
  scoreFactorTest.scoreNachtwacht === Math.round(scoreFactorTest.bonus * scoreFactorTest.factor)
  && scoreFactorTest.scoreAmsterdammer === scoreFactorTest.bonus, scoreFactorTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
