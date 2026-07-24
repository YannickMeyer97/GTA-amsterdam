// Ticket 51 (verkleind — afsluiter van T42-46 + T49-50, ZONDER T52-57):
// headless simulatie van golf 12-24 (ruim voorbij de HP-trap-plafond op
// golf 16) die het threat-budget-verloop, het HP-trap-verloop, de naleving
// van GOLF_MAX_ACTIEF (het perf-plafond) en de geldstroom afgezet tegen een
// bestaande late-game sink (De Ontsnapping, €2500) meet. Bewust GEEN check
// van isOntsnappingsGolf()/de gang-naar-de-gracht — die horen bij T52-57,
// die in deze ronde niet zijn uitgevoerd (zie ROADMAP.md Ticket 51).
// Zie ARCHITECTURE_NOTES.md §6 en ROADMAP.md Ticket 51.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. golfBudget() groeit strikt monotoon en volgt de formule exact -----
const budgetReeks = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const reeks = [];
  for (let golf = 12; golf <= 24; golf++) reeks.push(d.golfBudget(golf));
  return { reeks, basis: d.GOLF_BUDGET_BASIS, groei: d.GOLF_BUDGET_GROEI };
});
const budgetKlopt = budgetReeks.reeks.every((b, i) =>
  b === Math.round(budgetReeks.basis + budgetReeks.groei * (12 + i - 1)));
check('golfBudget(12..24) volgt exact GOLF_BUDGET_BASIS + GOLF_BUDGET_GROEI*(golf-1)', budgetKlopt, budgetReeks);
const budgetMonotoon = budgetReeks.reeks.every((b, i) => i === 0 || b >= budgetReeks.reeks[i - 1]);
check('Het budget daalt nooit tussen golf 12 en golf 24 (monotoon niet-dalend)', budgetMonotoon, budgetReeks);

// --- 2. HP-trap: golf 12-15 -> 3 HP, golf 16-24 -> 4 HP (hard plafond) -----
const hpTrapReeks = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const reeks = [];
  for (let golf = 12; golf <= 24; golf++) {
    d.spelStaat.golf = golf;
    reeks.push({ golf, hp: d.ondodeStartHP() });
  }
  return reeks;
});
check('Golf 12-15 geeft ondodeStartHP() === 3',
  hpTrapReeks.filter(r => r.golf >= 12 && r.golf <= 15).every(r => r.hp === 3), hpTrapReeks);
check('Golf 16-24 geeft ondodeStartHP() === 4 (hard plafond, stijgt niet verder)',
  hpTrapReeks.filter(r => r.golf >= 16).every(r => r.hp === 4), hpTrapReeks);

// --- 3. Volledige golf-simulatie 12-24: GOLF_MAX_ACTIEF nooit overschreden,
// er wordt daadwerkelijk gespawned, en de geldstroom is gezond -------------
const simulatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Late-game state: alle zones open (zoals een speler die golf 12+ haalt),
  // geen barricades in de weg, en overkill-schade zodat elke "speler"-hit
  // in de simulatie meteen een kill is (test gaat over pacing/budget, niet
  // over combat-balans — dezelfde aanpak als de bestaande golf-cyclus-tests
  // die raakOndode() rechtstreeks aanroepen).
  d.spelStaat.geld = 0;
  d.koopDeur(); d.koopDeur2(); d.koopDeur3(); d.koopDeur4();
  for (const v of [...d.VENSTERS, ...d.VENSTERS_KAMER2, ...d.VENSTERS_PLAATS, ...d.VENSTERS_BIJKEUKEN]) v.planken = 0;
  d.schadePerTreffer = 999;

  const perGolf = [];
  for (let golf = 12; golf <= 24; golf++) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.golf = golf;
    d.spelStaat.gameOver = false;
    d.startGolf();

    const budgetStart = d.spelStaat.budget;
    const eventType = d.actieveEventGolf;
    const maxActiefToegestaan = d.effectiefMaxActief();
    let maxGelijktijdig = 0;
    let stappen = 0;
    while (d.spelStaat.golfActief && stappen < 3000) {
      d.updateGolf(0.05);
      maxGelijktijdig = Math.max(maxGelijktijdig, d.ondoden.length);
      // "Combat": elke stap één levende ondode doden (overkill-schade),
      // zodat de golf ook daadwerkelijk afrondt i.p.v. permanent tegen het
      // GOLF_MAX_ACTIEF-plafond te blijven hangen.
      if (d.ondoden.length > 0) {
        const doelwit = d.ondoden[0];
        d.raakOndode(doelwit, doelwit.groep.position, false);
      }
      stappen++;
    }
    perGolf.push({
      golf, budgetStart, eventType, maxActiefToegestaan, maxGelijktijdig,
      golfAfgerond: !d.spelStaat.golfActief, stappenGebruikt: stappen,
    });
  }
  return { perGolf, geldNa: d.spelStaat.geld, ontsnappingPrijs: d.ONTSNAPPING_PRIJS };
});

check('Elke golf (12-24) rondt daadwerkelijk af binnen de stappen-limiet (geen hang-toestand)',
  simulatie.perGolf.every(g => g.golfAfgerond), simulatie.perGolf);
check('GOLF_MAX_ACTIEF (het perf-plafond) wordt op geen enkele golf overschreden',
  simulatie.perGolf.every(g => g.maxGelijktijdig <= g.maxActiefToegestaan), simulatie.perGolf);
check('Er wordt op elke golf daadwerkelijk gespawned (maxGelijktijdig > 0)',
  simulatie.perGolf.every(g => g.maxGelijktijdig > 0), simulatie.perGolf);
// Golf 15 (mist) en golf 20 (stroomuitval) horen event-golven te zijn — de
// afwisseling zelf is al gedekt door test-eventgolven.mjs/test-stroomuitval.mjs;
// hier alleen een regressie-steekproef dat de late-game-simulatie dat niet
// per ongeluk stukmaakt.
const golf15 = simulatie.perGolf.find(g => g.golf === 15);
const golf20 = simulatie.perGolf.find(g => g.golf === 20);
check('Golf 15 is (nog steeds) een Mistgolf tijdens de late-game-simulatie', golf15.eventType === 'mist', golf15);
check('Golf 20 is (nog steeds) een Stroomuitval tijdens de late-game-simulatie', golf20.eventType === 'stroomuitval', golf20);

// --- 4. Geldstroom vs. een bestaande late-game sink (De Ontsnapping,
// €2500): na golf 12-24 met een redelijk kill-tempo is dat ruimschoots op
// te brengen — puur een gezondheidscheck, geen exacte economie-tuning -----
check(`Na de golf 12-24-simulatie is er ruim voldoende geld voor De Ontsnapping (€${simulatie.ontsnappingPrijs}): €${simulatie.geldNa}`,
  simulatie.geldNa > simulatie.ontsnappingPrijs * 2, simulatie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
