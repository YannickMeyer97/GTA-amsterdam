// Ticket 163 (v0.27, ronde 13): verdienfeedback op de eindschermen +
// de geijkte prijsladder.
//
// WAAROM DIT TICKET BESTAAT. Het vervallen T158 deel B haalde alle 32
// geautomatiseerde checks en sneuvelde alsnog, omdat de speler de waarde van
// de mechaniek nooit kón leren zien. Een winkel die je niet ziet vullen,
// gebruik je niet. De feedbackregel is hier dus de kern, geen versiering —
// en het "nieuw schap open"-bericht is het belangrijkste deel ervan.
//
// De prijsladder is GEIJKT op gemeten opbrengst per geslaagde run (spaarder,
// ongeveer de helft headshots):
//   ontsnappen op golf 10 -> €1.489 restgeld, golf 14 -> €5.919, golf 18 -> €9.995
//   punten na 1 run ~205-292, na 3 runs ~416-516, na 8 runs ~944-1077
// Deze test herhaalt die meting niet, maar toetst de GRENZEN die eruit volgden.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

// Het gemeten restgeld van de vroegst mogelijke ontsnapping in het
// ongunstigste profiel (zonder headshots) — de ondergrens waartegen
// "minstens één item bereikbaar" geijkt is.
const VROEGSTE_ONTSNAPPING_RESTGELD = 233;

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. De ladder: bereikbaar aan de onderkant, laat aan de bovenkant ----
const ladder = await page.evaluate((vroegsteRestgeld) => {
  const d = window.AmsterdamUndeadDebug;
  const cos = d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_COSMETISCH);
  const start = d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_START);
  // Wat is er te koop na precies één vroege ontsnapping? Eén ontsnapping op
  // golf 10 geeft 100 (ontsnapping) + 100 (golf 10) punten, plus wat headshots.
  const naEenVroegeRun = {
    ontsnappingen: 1, hoogsteGolf: 10, headshotsTotaal: 0,
    geld: vroegsteRestgeld, gekocht: [], actiefPerCategorie: {},
    versie: d.ARCHIEF_VERSIE, actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  const bereikbaarNaEenRun = d.ARCHIEF_ITEMS.filter(i =>
    d.archiefItemStatus(i, naEenVroegeRun) === d.ARCHIEF_STATUS_KOOPBAAR);
  return {
    puntenNaEenRun: d.mijlpaalpunten(naEenVroegeRun),
    bereikbaarNaEenRun: bereikbaarNaEenRun.map(i => `${i.naam} (€${i.prijs})`),
    goedkoopste: Math.min(...cos.map(i => i.prijs)),
    duursteCosmetisch: Math.max(...cos.map(i => i.prijs)),
    goedkoopsteStart: Math.min(...start.map(i => i.prijs)),
    hoogsteCosmetischePunten: Math.max(...cos.map(i => i.puntenEis)),
    laagsteStartPunten: Math.min(...start.map(i => i.puntenEis)),
    totaalCatalogus: d.ARCHIEF_ITEMS.reduce((a, i) => a + i.prijs, 0),
  };
}, VROEGSTE_ONTSNAPPING_RESTGELD);
check(`Na één vroege ontsnapping (€${VROEGSTE_ONTSNAPPING_RESTGELD}) is minstens één item daadwerkelijk te koop — je begint niet met lege handen`,
  ladder.bereikbaarNaEenRun.length >= 1, ladder);
check('De duurste items vragen aantoonbaar meer dan één vroege ontsnapping oplevert',
  ladder.goedkoopsteStart > VROEGSTE_ONTSNAPPING_RESTGELD * 10, ladder);
check('De hele catalogus kost fors meer dan één late ontsnapping (~€10.000) opbrengt, dus er blijft iets te sparen',
  ladder.totaalCatalogus > 10000 * 3, ladder);
check('Startuitrusting blijft duurder én hoger gedrempeld dan élk cosmetisch item (§9.2-verruiming intact na de ijking)',
  ladder.goedkoopsteStart > ladder.duursteCosmetisch
  && ladder.laagsteStartPunten > ladder.hoogsteCosmetischePunten, ladder);

// --- 2. De kalibratie raakt geen balansgetal ----------------------------
const bron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tekst = d.ARCHIEF_ITEMS.map(i => JSON.stringify({ ...i, schenk: undefined, uitdoofVlag: undefined })).join('\n')
    + d.toonArchiefWinst.toString() + d.nieuwOntgrendeldeItems.toString();
  const verboden = ['SPELER_HP_MAX', '_PRIJS', 'GELD_PER_HIT', 'GELD_PER_KILL',
    'schadePerTreffer', 'WAPEN_SCHADE_MAX', 'golfBudget', 'GOLF_BUDGET_',
    'ONDODE_THREAT_KOSTEN', 'GOLF_MAX_ACTIEF', 'ONDODE_HP_TRAPPEN',
    'AANVAL_PROFIELEN', 'POWERUP_DROP_KANS'];
  return { gevonden: verboden.filter(t => tekst.includes(t)) };
});
check('De geijkte prijzen en de feedbackcode raken geen enkele constante uit de §9.2-verbodenlijst',
  bron.gevonden.length === 0, bron);

// --- 3. Een geslaagde ontsnapping meldt geld ÉN punten ------------------
const naOntsnapping = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = {
    ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, geld: 0,
    gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 40;
  d.spelStaat.golf = 14;
  d.spelStaat.geld = 5919;          // gemeten restgeld bij een boot op golf 14
  d.bijwerkenStadsarchief({ ontsnapping: true });
  return {
    tekst: document.getElementById('winArchief').textContent,
    winst: { ...d.archiefLaatsteWinst },
  };
});
check('Het winscherm meldt het bijgeschreven archiefgeld', /5919/.test(naOntsnapping.tekst), naOntsnapping);
check('...én de verdiende mijlpaalpunten', /mijlpaalpunten/.test(naOntsnapping.tekst)
  && naOntsnapping.winst.punten > 0, naOntsnapping);

// --- 4. Een game over meldt óók iets — punten, geen geld ---------------
const naGameOver = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = {
    ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, geld: 0,
    gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 30;
  d.spelStaat.golf = 12;
  d.spelStaat.geld = 4000;          // op zak bij overlijden: levert niets op
  d.bijwerkenStadsarchief();
  return {
    tekst: document.getElementById('gameOverArchief').textContent,
    winst: { ...d.archiefLaatsteWinst },
  };
});
check('Het gameover-scherm toont ook een archiefregel — een verloren run levert wél punten op',
  naGameOver.tekst.length > 0 && naGameOver.winst.punten > 0, naGameOver);
check('...en legt uit waarom er geen geld bijkwam, in plaats van een kaal "+€0"',
  /geen archiefgeld/i.test(naGameOver.tekst) && /ontsnapping/i.test(naGameOver.tekst), naGameOver);
check('Het geld op zak bij overlijden wordt NIET bijgeschreven', naGameOver.winst.geld === 0, naGameOver);

// --- 5. "Nieuw schap open" is het belangrijkste bericht ----------------
const ontgrendeling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Zoek een item met een drempel die we netjes kunnen overschrijden.
  const doel = [...d.ARCHIEF_ITEMS].sort((a, b) => a.puntenEis - b.puntenEis)
    .find(i => i.puntenEis > 0);
  d.stadsarchief = {
    ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, geld: 0,
    gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 0;
  const puntenVoor = d.mijlpaalpunten();
  d.spelStaat.golf = Math.ceil((doel.puntenEis + 5) / d.MIJLPAAL_PUNTEN_PER_GOLF);
  d.spelStaat.geld = 0;
  d.bijwerkenStadsarchief();
  const tekst = document.getElementById('gameOverArchief').textContent;
  const html = document.getElementById('gameOverArchief').innerHTML;
  // En een run die NIETS nieuws ontgrendelt mag ook niets melden.
  d.bijwerkenStadsarchief();
  return {
    doelNaam: doel.naam, puntenVoor,
    tekst, html,
    lijst: [...d.archiefLaatsteWinst.nieuwOntgrendeld ?? []],
    tweedeKeerLeeg: (d.archiefLaatsteWinst.nieuwOntgrendeld ?? []).length === 0,
    tweedeTekst: document.getElementById('gameOverArchief').textContent,
  };
});
check('Een run die een nieuw item ontgrendelt meldt dat expliciet bij naam',
  ontgrendeling.tekst.includes(ontgrendeling.doelNaam)
  && /Nieuw in de winkel/i.test(ontgrendeling.tekst), ontgrendeling);
check('Dat bericht krijgt meer nadruk dan de getallen (eigen, opvallend element)',
  /class="nieuw"/.test(ontgrendeling.html), ontgrendeling);
check('Een volgende run die niets nieuws ontgrendelt meldt ook niets — geen loos bericht',
  ontgrendeling.tweedeKeerLeeg && !/Nieuw in de winkel/i.test(ontgrendeling.tweedeTekst), ontgrendeling);

// --- 6. nieuwOntgrendeldeItems(): puur, en alleen de echte overgang ----
const grens = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const doel = [...d.ARCHIEF_ITEMS].sort((a, b) => a.puntenEis - b.puntenEis).find(i => i.puntenEis > 0);
  return {
    drempel: doel.puntenEis,
    netEronder: d.nieuwOntgrendeldeItems(0, doel.puntenEis - 1).includes(doel.naam),
    precies: d.nieuwOntgrendeldeItems(0, doel.puntenEis).includes(doel.naam),
    alGehad: d.nieuwOntgrendeldeItems(doel.puntenEis, doel.puntenEis + 50).includes(doel.naam),
    geenGroei: d.nieuwOntgrendeldeItems(500, 500).length,
  };
});
check('Een item telt pas als nieuw ontgrendeld zodra de drempel ECHT gehaald is (niet één punt eerder)',
  !grens.netEronder && grens.precies, grens);
check('Een item dat al ontgrendeld was wordt niet opnieuw gemeld', !grens.alGehad, grens);
check('Zonder puntengroei is er niets nieuws te melden', grens.geenGroei === 0, grens);

// --- 7. Opruimen -------------------------------------------------------
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
