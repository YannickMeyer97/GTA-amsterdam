// Ticket 160 (v0.27, ronde 13): archieffundament — twee valuta, opslag en
// migratie.
//
// Het zwaarste randgeval van dit ticket is de MIGRATIE. Een speler die zijn
// drie T86-cosmetica al verdiend heeft met mijlpalen (en er dus nooit voor
// betaalde) moet ze na de update BEZITTEN, niet opnieuw hoeven kopen. Dat is
// een regressie die geen enkele bestaande test vangt, dus die matrix staat
// hier vooraan.
//
// Tweede kern: `mijlpaalpunten()` is de SLEUTEL-valuta en moet monotoon
// zijn. Dat is geen toeval maar constructie — de functie leest uitsluitend
// tellers die zelf alleen kunnen stijgen (`ontsnappingen++`,
// `headshotsTotaal +=`, `hoogsteGolf = Math.max(...)`). Deze test bewaakt
// dat die eigenschap blijft gelden, ook als de weging ooit verandert.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// Helper: zet een ruwe waarde in localStorage, lees het archief opnieuw in
// en geef het resultaat terug. Zo toetsen we leesStadsarchief() tegen
// precies de vorm die er in de opslag zou kunnen staan.
async function leesMet(ruw) {
  return page.evaluate((ruw) => {
    const d = window.AmsterdamUndeadDebug;
    if (ruw === null) localStorage.removeItem(d.STADSARCHIEF_KEY);
    else localStorage.setItem(d.STADSARCHIEF_KEY, ruw);
    return d.leesStadsarchief();
  }, ruw);
}

// --- 1. De veilige uitgangsstaat -----------------------------------------
const leeg = await leesMet(null);
check('Zonder opgeslagen archief komt er een volledige, veilige staat terug (geld 0, niets gekocht, huidige versie)',
  leeg.geld === 0 && Array.isArray(leeg.gekocht) && leeg.gekocht.length === 0
  && leeg.ontsnappingen === 0 && leeg.headshotsTotaal === 0 && leeg.hoogsteGolf === 0, leeg);

// --- 2. Corrupte opslag geeft nooit een crash of "undefined" -------------
const corrupt = {};
for (const ruw of ['{}', '[]', 'null', 'geen json', '"tekst"', '42',
                   '{"geld":"veel"}', '{"geld":-500}', '{"geld":1.5}', '{"geld":null}',
                   '{"gekocht":"kleurset"}', '{"gekocht":[1,2,3]}', '{"gekocht":null}']) {
  corrupt[ruw] = await leesMet(ruw);
}
const alleCorruptGeldig = Object.values(corrupt).every(a =>
  Number.isInteger(a.geld) && a.geld >= 0
  && Array.isArray(a.gekocht)
  && Number.isInteger(a.ontsnappingen) && a.ontsnappingen >= 0
  && a.actief && typeof a.actief === 'object');
check('Elke corrupte opslagvariant (13 vormen, incl. geld als string/negatief/kommagetal en gekocht als niet-array) geeft een geldige staat',
  alleCorruptGeldig, corrupt);
check('Een negatief of niet-geheel geldbedrag valt terug op 0, niet op NaN of het ruwe getal',
  corrupt['{"geld":-500}'].geld === 0 && corrupt['{"geld":1.5}'].geld === 0, {
    negatief: corrupt['{"geld":-500}'].geld, komma: corrupt['{"geld":1.5}'].geld });
check('Niet-string-inhoud in `gekocht` wordt eruit gefilterd in plaats van overgenomen',
  corrupt['{"gekocht":[1,2,3]}'].gekocht.length === 0, corrupt['{"gekocht":[1,2,3]}']);

// --- 3. DE MIGRATIEMATRIX — het zwaarste randgeval ----------------------
// Een oud archief (geen `versie`, geen `geld`, geen `gekocht`) waarin de
// speler mijlpalen gehaald heeft, moet die cosmetica behouden.
const drempels = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    ontsnappingen: d.STADSARCHIEF_DREMPEL_ONTSNAPPINGEN,
    headshots: d.STADSARCHIEF_DREMPEL_HEADSHOTS,
    golf: d.STADSARCHIEF_DREMPEL_GOLF,
    versie: d.ARCHIEF_VERSIE,
    ids: d.ARCHIEF_LEGACY_IDS,
  };
});

const oudAllesVerdiend = await leesMet(JSON.stringify({
  ontsnappingen: drempels.ontsnappingen, headshotsTotaal: drempels.headshots, hoogsteGolf: drempels.golf,
  actief: { kleurset: true, vlamTint: true, introMelodie: true },
}));
check('Oud archief met alle drie de mijlpalen gehaald: alle drie de cosmetica staan na migratie in `gekocht`',
  [drempels.ids.kleurset, drempels.ids.vlamTint, drempels.ids.introMelodie]
    .every(id => oudAllesVerdiend.gekocht.includes(id)), oudAllesVerdiend);
check('...en het archief is opgetild naar de huidige versie',
  oudAllesVerdiend.versie === drempels.versie, oudAllesVerdiend);
check('...zonder de bestaande tellers of aan/uit-standen aan te tasten',
  oudAllesVerdiend.ontsnappingen === drempels.ontsnappingen
  && oudAllesVerdiend.headshotsTotaal === drempels.headshots
  && oudAllesVerdiend.actief.kleurset === true, oudAllesVerdiend);

const oudDeels = await leesMet(JSON.stringify({
  ontsnappingen: drempels.ontsnappingen, headshotsTotaal: 0, hoogsteGolf: 0,
}));
check('Oud archief met alléén de ontsnappingsmijlpaal: precies één item gemigreerd, niet alle drie',
  oudDeels.gekocht.length === 1 && oudDeels.gekocht.includes(drempels.ids.kleurset), oudDeels);

const oudNetNiet = await leesMet(JSON.stringify({
  ontsnappingen: drempels.ontsnappingen - 1, headshotsTotaal: drempels.headshots - 1, hoogsteGolf: drempels.golf - 1,
}));
check('Oud archief dat de drempels NET niet haalt, krijgt niets cadeau',
  oudNetNiet.gekocht.length === 0, oudNetNiet);

// De migratie mag maar ÉÉN keer iets doen: een nieuwe speler die later
// dezelfde mijlpaal haalt, hoort het item gewoon te moeten kopen.
const nieuwMetMijlpaal = await leesMet(JSON.stringify({
  versie: drempels.versie, ontsnappingen: drempels.ontsnappingen,
  headshotsTotaal: drempels.headshots, hoogsteGolf: drempels.golf, geld: 0, gekocht: [],
}));
check('Een archief dat AL op de huidige versie staat krijgt niets cadeau, ook niet als de mijlpalen gehaald zijn (anders is de winkel gratis)',
  nieuwMetMijlpaal.gekocht.length === 0, nieuwMetMijlpaal);

const migratieIdempotent = await page.evaluate((verwachteVersie) => {
  const d = window.AmsterdamUndeadDebug;
  const archief = d.leesStadsarchief();
  const eerste = [...archief.gekocht];
  d.migreerArchief(archief);
  d.migreerArchief(archief);
  return { eerste, na: archief.gekocht, versie: archief.versie, verwachteVersie };
}, drempels.versie);
check('migreerArchief() is idempotent — nog eens draaien voegt niets toe',
  migratieIdempotent.na.length === migratieIdempotent.eerste.length, migratieIdempotent);

// --- 4. Bestaande aankopen overleven een teruggerolde versie -------------
const onbekendId = await leesMet(JSON.stringify({
  versie: drempels.versie, gekocht: ['kleurset', 'een-item-uit-een-nieuwere-versie'],
}));
check('Een onbekend item-id in `gekocht` blijft staan (een oudere versie mag aankopen van een nieuwere niet wissen)',
  onbekendId.gekocht.includes('een-item-uit-een-nieuwere-versie'), onbekendId);

const dubbel = await leesMet(JSON.stringify({ versie: drempels.versie, gekocht: ['kleurset', 'kleurset', 'kleurset'] }));
check('Dubbele id\'s in `gekocht` worden ontdubbeld', dubbel.gekocht.length === 1, dubbel);

// --- 5. Bovengrenzen tegen gemanipuleerde opslag -------------------------
const grenzen = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify({
    versie: d.ARCHIEF_VERSIE, geld: 999999999999,
    gekocht: Array.from({ length: d.ARCHIEF_GEKOCHT_MAX + 250 }, (_, i) => `item${i}`),
  }));
  const a = d.leesStadsarchief();
  return { geld: a.geld, max: d.ARCHIEF_GELD_MAX, aantal: a.gekocht.length, maxAantal: d.ARCHIEF_GEKOCHT_MAX };
});
check('Een absurd geldbedrag wordt geklemd op de bovengrens', grenzen.geld === grenzen.max, grenzen);
check('Een absurd lange `gekocht`-lijst wordt afgekapt op de bovengrens', grenzen.aantal === grenzen.maxAantal, grenzen);

// --- 6. mijlpaalpunten(): puur en monotoon ------------------------------
const punten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = { ontsnappingen: 2, headshotsTotaal: 55, hoogsteGolf: 17 };
  const eerste = d.mijlpaalpunten(a);
  const tweede = d.mijlpaalpunten(a);
  const verwacht = 2 * d.MIJLPAAL_PUNTEN_PER_ONTSNAPPING
    + 17 * d.MIJLPAAL_PUNTEN_PER_GOLF
    + Math.floor(55 / d.MIJLPAAL_HEADSHOTS_PER_PUNT);
  // Monotonie: elke afzonderlijke teller ophogen mag het totaal nooit laten dalen.
  let monotoon = true;
  let vorige = d.mijlpaalpunten({ ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0 });
  const nulpunt = vorige;
  for (let stap = 1; stap <= 40; stap++) {
    const nu = d.mijlpaalpunten({ ontsnappingen: stap, headshotsTotaal: stap * 7, hoogsteGolf: stap });
    if (nu < vorige) monotoon = false;
    vorige = nu;
  }
  // Ook per as afzonderlijk, want een run hoeft niet alle drie te verhogen.
  for (const as of ['ontsnappingen', 'headshotsTotaal', 'hoogsteGolf']) {
    let v = d.mijlpaalpunten({ ontsnappingen: 3, headshotsTotaal: 30, hoogsteGolf: 9 });
    for (let stap = 1; stap <= 30; stap++) {
      const basis = { ontsnappingen: 3, headshotsTotaal: 30, hoogsteGolf: 9 };
      basis[as] += stap;
      const nu = d.mijlpaalpunten(basis);
      if (nu < v) monotoon = false;
      v = nu;
    }
  }
  return { eerste, tweede, verwacht, monotoon, nulpunt };
});
check('mijlpaalpunten() is een pure functie — twee aanroepen met hetzelfde archief geven hetzelfde getal',
  punten.eerste === punten.tweede, punten);
check('mijlpaalpunten() volgt exact de gedocumenteerde weging', punten.eerste === punten.verwacht, punten);
check('Een leeg archief levert 0 punten op', punten.nulpunt === 0, punten);
check('mijlpaalpunten() is monotoon: geen enkele teller-ophoging kan het totaal laten dalen (gezamenlijk én per as)',
  punten.monotoon, punten);

// --- 7. Verdienen: ontsnapping vult de portemonnee, game over niet -------
const verdienen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const verse = () => ({
    ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0,
    geld: 0, gekocht: [], versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  });

  // (a) Geslaagde ontsnapping met restsaldo op zak.
  d.stadsarchief = verse();
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 12;
  d.spelStaat.golf = 14;
  d.spelStaat.geld = 2895;          // gemeten restbedrag na een boot op golf 14
  d.bijwerkenStadsarchief({ ontsnapping: true });
  const naOntsnapping = {
    geld: d.stadsarchief.geld,
    ontsnappingen: d.stadsarchief.ontsnappingen,
    hoogsteGolf: d.stadsarchief.hoogsteGolf,
    headshots: d.stadsarchief.headshotsTotaal,
    winst: { ...d.archiefLaatsteWinst },
  };

  // (b) Game over: wél statistieken, GEEN geld.
  d.stadsarchief = verse();
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 8;
  d.spelStaat.golf = 11;
  d.spelStaat.geld = 4000;          // op zak bij overlijden — mag niets opleveren
  d.bijwerkenStadsarchief();
  const naGameOver = {
    geld: d.stadsarchief.geld,
    ontsnappingen: d.stadsarchief.ontsnappingen,
    hoogsteGolf: d.stadsarchief.hoogsteGolf,
    headshots: d.stadsarchief.headshotsTotaal,
    winst: { ...d.archiefLaatsteWinst },
  };

  // (c) Twee ontsnappingen achter elkaar stapelen het saldo op.
  d.stadsarchief = verse();
  d.archiefHeadshotsBasis = 0;
  d.runStats.headshots = 0;
  d.spelStaat.golf = 10;
  d.spelStaat.geld = 233;
  d.bijwerkenStadsarchief({ ontsnapping: true });
  d.spelStaat.geld = 6185;
  d.bijwerkenStadsarchief({ ontsnapping: true });
  const gestapeld = { geld: d.stadsarchief.geld, ontsnappingen: d.stadsarchief.ontsnappingen };

  // (d) De bovengrens houdt ook bij het bijschrijven stand.
  d.stadsarchief = verse();
  d.stadsarchief.geld = d.ARCHIEF_GELD_MAX - 10;
  d.spelStaat.geld = 100000;
  d.bijwerkenStadsarchief({ ontsnapping: true });
  const geklemd = { geld: d.stadsarchief.geld, max: d.ARCHIEF_GELD_MAX };

  return { naOntsnapping, naGameOver, gestapeld, geklemd };
});
check('Een geslaagde ontsnapping schrijft exact het restsaldo bij',
  verdienen.naOntsnapping.geld === 2895, verdienen.naOntsnapping);
check('...en verhoogt de ontsnappingsteller en de hoogste golf',
  verdienen.naOntsnapping.ontsnappingen === 1 && verdienen.naOntsnapping.hoogsteGolf === 14, verdienen.naOntsnapping);
check('...en legt vast wat deze run opleverde, zodat T163 dat kan tonen',
  verdienen.naOntsnapping.winst.geld === 2895 && verdienen.naOntsnapping.winst.punten > 0, verdienen.naOntsnapping);
check('Een game over levert GEEN geld op, ook niet met een vol saldo op zak',
  verdienen.naGameOver.geld === 0 && verdienen.naGameOver.winst.geld === 0, verdienen.naGameOver);
check('...maar telt wél mee voor de mijlpalen (hoogste golf en headshots), dus elke run geeft voortgang',
  verdienen.naGameOver.hoogsteGolf === 11 && verdienen.naGameOver.headshots === 8
  && verdienen.naGameOver.winst.punten > 0, verdienen.naGameOver);
check('Twee ontsnappingen stapelen het archiefsaldo op (233 + 6185)',
  verdienen.gestapeld.geld === 233 + 6185 && verdienen.gestapeld.ontsnappingen === 2, verdienen.gestapeld);
check('Bijschrijven kan het saldo nooit boven de bovengrens tillen',
  verdienen.geklemd.geld === verdienen.geklemd.max, verdienen.geklemd);

// --- 8. Rondreis: schrijven en teruglezen levert hetzelfde archief op ----
const rondreis = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bron = {
    ontsnappingen: 4, headshotsTotaal: 321, hoogsteGolf: 26,
    geld: 8123, gekocht: ['kleurset', 'vlamTint'], versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: true, vlamTint: false, introMelodie: true },
  };
  d.schrijfStadsarchief(bron);
  const terug = d.leesStadsarchief();
  return { bron, terug };
});
check('Een geschreven archief leest identiek terug (geld, gekochte items, tellers en aan/uit-standen)',
  rondreis.terug.geld === rondreis.bron.geld
  && rondreis.terug.gekocht.join(',') === rondreis.bron.gekocht.join(',')
  && rondreis.terug.ontsnappingen === rondreis.bron.ontsnappingen
  && rondreis.terug.hoogsteGolf === rondreis.bron.hoogsteGolf
  && rondreis.terug.actief.introMelodie === true, rondreis);

// --- 8b. HET ARCHIEF OVERLEEFT EEN ECHTE HERLAAD -----------------------
// Deze check bestaat door schade en schande. Tijdens T162 bleek dat
// leesStadsarchief() een verwijzing bevatte naar een tabel die verderop in
// het bestand staat, terwijl de functie al draait bij het initialiseren van
// `stadsarchief`. Dat gaf een temporal-dead-zone-fout die netjes werd
// opgeslokt door de catch die voor CORRUPTE OPSLAG bedoeld is — met als stil
// gevolg dat elke terugkerende speler zijn hele archief kwijtraakte.
// Schrijven-en-teruglezen binnen dezelfde pagina (sectie 8) vangt dit NIET,
// want dan is alles allang geïnitialiseerd. Alleen een echte herlaad doet dat.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.schrijfStadsarchief({
    ontsnappingen: 5, headshotsTotaal: 250, hoogsteGolf: 22,
    geld: 4321, gekocht: ['vlam-ijs', 'richtkruis-amber'],
    actiefPerCategorie: { mondingsvlam: 'vlam-ijs' }, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  });
});
await page.reload();
await page.waitForFunction(() => !!window.AmsterdamUndeadDebug);
const naHerladen = await page.evaluate(() => ({ ...window.AmsterdamUndeadDebug.stadsarchief }));
check('Na een ECHTE herlaad is het archief compleet ingelezen — geen stille terugval op de lege staat',
  naHerladen.geld === 4321 && naHerladen.ontsnappingen === 5
  && naHerladen.gekocht.includes('vlam-ijs') && naHerladen.gekocht.includes('richtkruis-amber')
  && naHerladen.actiefPerCategorie.mondingsvlam === 'vlam-ijs', naHerladen);
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

// --- 9. Geweigerde localStorage blijft stil falen -----------------------
const geweigerd = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const origSet = localStorage.setItem;
  const origGet = localStorage.getItem;
  localStorage.setItem = () => { throw new Error('geweigerd'); };
  localStorage.getItem = () => { throw new Error('geweigerd'); };
  let gecrasht = false;
  let staat = null;
  try {
    d.schrijfStadsarchief({ geld: 5 });
    staat = d.leesStadsarchief();
  } catch { gecrasht = true; }
  localStorage.setItem = origSet;
  localStorage.getItem = origGet;
  return { gecrasht, staat };
});
check('Een geweigerde localStorage geeft geen crash, maar een veilige lege staat (bestaand contract)',
  !geweigerd.gecrasht && geweigerd.staat && geweigerd.staat.geld === 0, geweigerd);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
