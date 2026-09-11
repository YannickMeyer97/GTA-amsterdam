// Ticket 169 (v0.30, ronde 16): punten tellen op per gespeelde run.
//
// WAAROM DIT TICKET BESTAAT, in één gemeten zin: de golfpunten kwamen uit
// `hoogsteGolf`, een RECORD. Eén run tot golf 25 gaf 440 punten — 250 daarvan
// uit dat record — en elke volgende run op dezelfde diepte nog maar 190. Wie
// vaak speelde werd dus nauwelijks beloond, terwijl één goede run 13 van de
// 20 items meteen ontgrendelde. Precies omgekeerd aan de bedoeling.
//
// Sinds T169 telt élke run zijn eigen gehaalde golven op bij `golvenTotaal`.
// `hoogsteGolf` blijft bestaan als record, want de intromelodie-drempel van
// T86 hangt eraan — maar hij telt niet meer mee voor punten.
//
// De ladder is geijkt op een GEMETEN representatieve run: golf 20, ~115
// headshots, ontsnapt met €1273 restgeld. Dat is 311 punten en €1273 per run.
// De doelen die daaruit volgden staan hieronder als harde grenzen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

// De representatieve run waar de hele ladder op geijkt is.
const RUN = { golf: 20, headshots: 115, restgeld: 1273 };
// Afgesproken doelen (ronde 16): het Vizier is de instapcategorie en gaat in
// run 1 open; de zwaarste startuitrusting kost ongeveer 15 runs.
const TOP_ITEM = 'start-amstel9';
const TOP_RUNS_MIN = 13, TOP_RUNS_MAX = 18;

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const leegArchief = () => ({
  ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, golvenTotaal: 0,
  geld: 0, gekocht: [], actiefPerCategorie: {},
  actief: { kleurset: false, vlamTint: false, introMelodie: false },
});

// --- 1. Herhaald spelen levert elke keer evenveel op --------------------
// Dit is de kern van het ticket. Vroeger zakte de opbrengst na run 1 in.
const herhaald = await page.evaluate(({ RUN, leeg }) => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ...leeg, versie: d.ARCHIEF_VERSIE };
  const winsten = [], totalen = [];
  for (let i = 0; i < 6; i++) {
    d.archiefHeadshotsBasis = 0;
    d.runStats.headshots = RUN.headshots;
    d.spelStaat.golf = RUN.golf;
    d.spelStaat.geld = RUN.restgeld;
    d.bijwerkenStadsarchief({ ontsnapping: true });
    winsten.push(d.archiefLaatsteWinst.punten);
    totalen.push(d.mijlpaalpunten());
  }
  return {
    winsten, totalen,
    golvenTotaal: d.stadsarchief.golvenTotaal,
    hoogsteGolf: d.stadsarchief.hoogsteGolf,
    archiefgeld: d.stadsarchief.geld,
  };
}, { RUN, leeg: leegArchief() });
check('Zes identieke runs leveren élke keer (vrijwel) dezelfde puntenwinst op — herhaald spelen loont',
  herhaald.winsten.every(w => Math.abs(w - herhaald.winsten[0]) <= 1), herhaald);
check('Het puntentotaal groeit daardoor lineair mee met het aantal runs',
  herhaald.totalen[5] > herhaald.totalen[0] * 5, herhaald);
check('De opgetelde golven zijn de som over alle runs, niet het record',
  herhaald.golvenTotaal === RUN.golf * 6 && herhaald.hoogsteGolf === RUN.golf, herhaald);
check('Het archiefgeld telt gewoon door per geslaagde ontsnapping',
  herhaald.archiefgeld === RUN.restgeld * 6, herhaald);

// --- 2. Een mislukte run telt zijn golven ook mee ----------------------
// Anders zou alleen ontsnappen vooruitgang opleveren, en dat is niet de
// bedoeling: doodgaan op golf 30 is ook gespeelde tijd.
const gameOver = await page.evaluate((leeg) => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ...leeg, versie: d.ARCHIEF_VERSIE };
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 80;
  d.spelStaat.golf = 18;
  d.spelStaat.geld = 4000;      // op zak bij overlijden
  d.bijwerkenStadsarchief();    // géén ontsnapping
  return {
    punten: d.mijlpaalpunten(),
    golvenTotaal: d.stadsarchief.golvenTotaal,
    geld: d.stadsarchief.geld,
    winst: { ...d.archiefLaatsteWinst },
  };
}, leegArchief());
check('Een run die eindigt in game over telt zijn gehaalde golven gewoon mee',
  gameOver.golvenTotaal === 18 && gameOver.winst.punten > 0, gameOver);
check('...maar levert nog steeds géén archiefgeld op — dat blijft aan ontsnappen hangen',
  gameOver.geld === 0, gameOver);

// --- 3. De ijking: hoeveel runs kost elk item? -------------------------
const ladder = await page.evaluate(({ RUN, leeg }) => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ...leeg, versie: d.ARCHIEF_VERSIE };
  const eersteRun = {};
  for (let run = 1; run <= 60; run++) {
    d.archiefHeadshotsBasis = 0;
    d.runStats.headshots = RUN.headshots;
    d.spelStaat.golf = RUN.golf;
    d.spelStaat.geld = RUN.restgeld;
    d.bijwerkenStadsarchief({ ontsnapping: true });
    const punten = d.mijlpaalpunten();
    for (const item of d.ARCHIEF_ITEMS) {
      if (!(item.id in eersteRun) && punten >= item.puntenEis) eersteRun[item.id] = run;
    }
  }
  // En apart: wat is er ontgrendeld na precies één run?
  d.stadsarchief = { ...leeg, versie: d.ARCHIEF_VERSIE };
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = RUN.headshots;
  d.spelStaat.golf = RUN.golf;
  d.spelStaat.geld = RUN.restgeld;
  d.bijwerkenStadsarchief({ ontsnapping: true });
  const puntenNa1 = d.mijlpaalpunten();
  const naEenRun = d.ARCHIEF_ITEMS.filter(i => puntenNa1 >= i.puntenEis);
  return {
    perItem: d.ARCHIEF_ITEMS.map(i => ({
      id: i.id, cat: i.categorie, naam: i.naam, prijs: i.prijs,
      punten: i.puntenEis, run: eersteRun[i.id] ?? 999,
    })),
    puntenPerRun: puntenNa1,
    naEenRunIds: naEenRun.map(i => i.id),
    naEenRunCategorieen: [...new Set(naEenRun.map(i => i.categorie))],
    totaalItems: d.ARCHIEF_ITEMS.length,
    totaalCatalogus: d.ARCHIEF_ITEMS.reduce((a, i) => a + i.prijs, 0),
  };
}, { RUN, leeg: leegArchief() });

const top = ladder.perItem.find(i => i.id === TOP_ITEM);
check(`Het zwaarste item (${TOP_ITEM}) kost ongeveer 15 runs — gemeten: ${top.run}`,
  top.run >= TOP_RUNS_MIN && top.run <= TOP_RUNS_MAX, top);
check('Er is ná één run al iets ontgrendeld — je begint niet met een volledig dichte winkel',
  ladder.naEenRunIds.length >= 1, ladder);
check('Maar niet meer dan één categorie gaat in run 1 open (het Vizier is de instap)',
  ladder.naEenRunCategorieen.length === 1
  && ladder.naEenRunCategorieen[0] === 'richtkruis', ladder);
// Dit is de regressie die het ticket veroorzaakte: 13 van de 20 in run 1.
check('Verreweg de meeste items zijn ná één run nog NIET ontgrendeld (was 13 van de 20)',
  ladder.naEenRunIds.length <= 4, {
    aantal: ladder.naEenRunIds.length, totaal: ladder.totaalItems, ids: ladder.naEenRunIds,
  });
check('De startuitrusting vraagt aantoonbaar meer runs dan élk cosmetisch item',
  Math.min(...ladder.perItem.filter(i => i.cat === 'startuitrusting').map(i => i.run))
  > Math.max(...ladder.perItem.filter(i => i.cat !== 'startuitrusting').map(i => i.run)), ladder.perItem);
check('Geen enkel item vraagt onbereikbaar veel runs (alles binnen 60)',
  ladder.perItem.every(i => i.run <= 60), ladder.perItem.filter(i => i.run > 60));
// Geld blijft de tweede rem: je kunt niet alles kopen tegen de tijd dat alles
// ontgrendeld is, dus er valt te kiezen.
check('De hele catalogus kost fors meer dan wat je in die 15 runs verdient — er valt te kiezen',
  ladder.totaalCatalogus > 15 * RUN.restgeld * 2, {
    catalogus: ladder.totaalCatalogus, verdiend: 15 * RUN.restgeld,
  });

// --- 4. De migratie naar versie 3 pakt niemand iets af -----------------
const migratie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lees = (record) => {
    localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify(record));
    return d.leesStadsarchief();
  };
  // Een archief van vóór dit ticket: versie 2, wél een golfrecord, geen som.
  const v2 = lees({
    versie: 2, ontsnappingen: 5, headshotsTotaal: 800, hoogsteGolf: 26,
    geld: 3000, gekocht: ['vlam-ijs', 'hud-koper'], actiefPerCategorie: { hud: 'hud-koper' },
  });
  // Een archief van vóór de winkel: versie 1, mijlpalen verdiend.
  const v1 = lees({
    ontsnappingen: 3, headshotsTotaal: 500, hoogsteGolf: 30, gekocht: [],
  });
  // En een archief dat al op versie 3 staat mag niet nóg eens gemigreerd worden.
  const v3 = lees({
    versie: 3, ontsnappingen: 1, headshotsTotaal: 10, hoogsteGolf: 12,
    golvenTotaal: 99, geld: 10, gekocht: [],
  });
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return { v2, v1, v3 };
});
check('Een archief van vóór dit ticket krijgt zijn golfrecord als startsom — niemand begint op nul',
  migratie.v2.golvenTotaal === 26 && migratie.v2.versie === 3, migratie.v2);
check('Gekochte items en het saldo blijven bij die migratie volledig intact',
  migratie.v2.geld === 3000 && migratie.v2.gekocht.includes('vlam-ijs')
  && migratie.v2.gekocht.includes('hud-koper')
  && migratie.v2.actiefPerCategorie.hud === 'hud-koper', migratie.v2);
check('Een archief van vóór de winkel (versie 1) krijgt én zijn T86-cosmetica én een startsom',
  migratie.v1.versie === 3 && migratie.v1.golvenTotaal === 30
  && migratie.v1.gekocht.includes('kleurset') && migratie.v1.gekocht.includes('introMelodie'),
  migratie.v1);
check('Een archief dat al op versie 3 staat wordt niet opnieuw gemigreerd',
  migratie.v3.golvenTotaal === 99, migratie.v3);

// --- 5. De opgetelde golven zijn net zo streng bewaakt als het geld ----
const grenzen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lees = (waarde) => {
    localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify({
      versie: 3, ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0,
      golvenTotaal: waarde, geld: 0, gekocht: [],
    }));
    return d.leesStadsarchief().golvenTotaal;
  };
  const uit = {
    absurd: lees(Number.MAX_SAFE_INTEGER),
    negatief: lees(-50),
    kommagetal: lees(12.7),
    tekst: lees('heel veel'),
    max: d.ARCHIEF_GOLVEN_MAX,
  };
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return uit;
});
check('Een absurd aantal opgetelde golven wordt geklemd op de bovengrens',
  grenzen.absurd === grenzen.max, grenzen);
check('Onzin (negatief, komma, tekst) valt terug op 0 in plaats van het archief te laten crashen',
  grenzen.negatief === 0 && grenzen.kommagetal === 0 && grenzen.tekst === 0, grenzen);

// --- 6. De winkel vertelt dat runs optellen ---------------------------
const uitleg = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.tekenArchiefWinkel();
  return document.getElementById('archiefWinkelUitleg').textContent;
});
check('De winkeluitleg zegt dat elke run optelt — anders is de verandering onzichtbaar',
  /telt op|optellen|vaker spelen/i.test(uitleg), { uitleg });

// --- 7. Opruimen ------------------------------------------------------
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
