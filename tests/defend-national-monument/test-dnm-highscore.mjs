// Ticket D8 (SONNET_EXECUTION_PLAN_monument.md, Fase 2) — highscore.
//
// Eén bewaard record in localStorage. Het belangrijkste deel van deze test
// is het NIET-crashen: corrupte waarden en een geweigerde localStorage
// mogen het spel nooit breken, alleen "geen record" opleveren.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

async function wachtOpSpel() {
  await page.waitForFunction(() => !!window.DamChaosDebug);
}

// --- 1. Schrijven en teruglezen --------------------------------------------

const basis = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  localStorage.removeItem(d.HIGHSCORE_KEY);
  const leeg = d.leesHighscore();
  d.schrijfHighscore({ score: 1234, wave: 5, datum: '2026-01-01' });
  const terug = d.leesHighscore();
  localStorage.setItem(d.HIGHSCORE_KEY, JSON.stringify({ score: 10, wave: 2, datum: 'x', vreemd: 'weg', ook: [1] }));
  const extra = d.leesHighscore();
  localStorage.setItem(d.HIGHSCORE_KEY, JSON.stringify({ score: 50, wave: 'vijf' }));
  const slechteWave = d.leesHighscore();
  return { key: d.HIGHSCORE_KEY, leeg, terug, extra, slechteWave };
});
check('De sleutel heet defendNationalMonumentHighscore', basis.key === 'defendNationalMonumentHighscore', basis);
check('Zonder opgeslagen waarde is er geen record', basis.leeg === null, basis);
check('Schrijven en teruglezen geeft hetzelfde record', JSON.stringify(basis.terug) === JSON.stringify({ score: 1234, wave: 5, datum: '2026-01-01' }), basis);
check('Onbekende extra velden worden genegeerd', basis.extra && Object.keys(basis.extra).sort().join() === 'datum,score,wave' && basis.extra.score === 10, basis);
check('Een ongeldige wave kost niet het hele record, alleen dat veld', basis.slechteWave && basis.slechteWave.score === 50 && basis.slechteWave.wave === null, basis);

// --- 2. Corrupte vormen: nooit een crash, altijd "geen record" ------------

const corrupt = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const vormen = {
    'niet-JSON': '{score: 12',
    'array': '[100, 5]',
    'null': 'null',
    'score als string': JSON.stringify({ score: '100', wave: 3 }),
    'negatieve score': JSON.stringify({ score: -5, wave: 3 }),
    'NaN-score (letterlijk)': '{"score": NaN, "wave": 3}',
    'NaN-score (via JSON.stringify → null)': JSON.stringify({ score: NaN, wave: 3 }),
    'kaal getal': '42',
    'kale string': '"hoi"',
    'leeg object': '{}',
  };
  const uitkomst = {};
  for (const [naam, raw] of Object.entries(vormen)) {
    localStorage.setItem(d.HIGHSCORE_KEY, raw);
    try { uitkomst[naam] = { waarde: d.leesHighscore(), crash: false }; }
    catch (e) { uitkomst[naam] = { crash: true, fout: String(e) }; }
  }
  return uitkomst;
});
for (const [naam, u] of Object.entries(corrupt)) {
  check(`Corrupte vorm "${naam}": geen crash, geen record`, !u.crash && u.waarde === null, u);
}

// --- 3. Game over: nieuw record, bestaand record, score 0 ------------------

const eersteRun = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  localStorage.removeItem(d.HIGHSCORE_KEY);
  d.spel.score = 500;
  d.spel.wave = 4;
  d.eindigRun();
  return {
    tekst: document.getElementById('eindRecord').textContent,
    nieuwKlasse: document.getElementById('eindRecord').classList.contains('nieuw'),
    opgeslagen: d.leesHighscore(),
  };
});
check('Eerste run met score > 0 zonder record: "NIEUW RECORD!"', eersteRun.tekst === 'NIEUW RECORD!' && eersteRun.nieuwKlasse, eersteRun);
check('...en het record is bewaard met score en wave', eersteRun.opgeslagen && eersteRun.opgeslagen.score === 500 && eersteRun.opgeslagen.wave === 4, eersteRun);
check('...met een datum in JJJJ-MM-DD-vorm', /^\d{4}-\d{2}-\d{2}$/.test(eersteRun.opgeslagen?.datum ?? ''), eersteRun);

await page.reload();
await wachtOpSpel();
const tweedeRun = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.score = 300;
  d.spel.wave = 3;
  d.eindigRun();
  return {
    tekst: document.getElementById('eindRecord').textContent,
    nieuwKlasse: document.getElementById('eindRecord').classList.contains('nieuw'),
    opgeslagen: d.leesHighscore(),
  };
});
check('Het record overleeft een herlaadbeurt', tweedeRun.opgeslagen && tweedeRun.opgeslagen.score === 500, tweedeRun);
check('Slechtere run: "Record: 500 (wave 4)", niet als nieuw gemarkeerd', tweedeRun.tekst === 'Record: 500 (wave 4)' && !tweedeRun.nieuwKlasse, tweedeRun);

await page.reload();
await wachtOpSpel();
const nulRun = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  localStorage.removeItem(d.HIGHSCORE_KEY);
  d.spel.score = 0;
  d.eindigRun();
  return { tekst: document.getElementById('eindRecord').textContent, opgeslagen: localStorage.getItem(d.HIGHSCORE_KEY) };
});
check('Score 0 zonder record: geen "NIEUW RECORD!" en niets bewaard', nulRun.tekst === '' && nulRun.opgeslagen === null, nulRun);

await page.reload();
await wachtOpSpel();
const corrupteRun = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  localStorage.setItem(d.HIGHSCORE_KEY, '[kapot');
  d.spel.score = 120;
  d.spel.wave = 2;
  d.eindigRun();
  return { tekst: document.getElementById('eindRecord').textContent, opgeslagen: d.leesHighscore() };
});
check('Corrupt record + game over: telt als geen record, wordt netjes overschreven', corrupteRun.tekst === 'NIEUW RECORD!' && corrupteRun.opgeslagen?.score === 120, corrupteRun);

// --- 4. Geweigerde localStorage ---------------------------------------------

await page.reload();
await wachtOpSpel();
const geweigerd = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const weiger = () => { throw new DOMException('geweigerd', 'SecurityError'); };
  Storage.prototype.getItem = weiger;
  Storage.prototype.setItem = weiger;
  const uit = {};
  try { uit.lees = d.leesHighscore(); uit.leesCrash = false; } catch { uit.leesCrash = true; }
  try { d.schrijfHighscore({ score: 1, wave: 1, datum: 'x' }); uit.schrijfCrash = false; } catch { uit.schrijfCrash = true; }
  try {
    d.spel.score = 800;
    d.eindigRun();
    uit.gameOverCrash = false;
  } catch (e) { uit.gameOverCrash = true; uit.fout = String(e); }
  uit.eindschermZichtbaar = getComputedStyle(document.getElementById('eindscherm')).display !== 'none';
  return uit;
});
check('Geweigerde localStorage: leesHighscore crasht niet en geeft null', !geweigerd.leesCrash && geweigerd.lees === null, geweigerd);
check('Geweigerde localStorage: schrijfHighscore crasht niet', !geweigerd.schrijfCrash, geweigerd);
check('Geweigerde localStorage: game over werkt gewoon en toont het eindscherm', !geweigerd.gameOverCrash && geweigerd.eindschermZichtbaar, geweigerd);

// Opruimen, zodat een volgende run van deze test (of een andere test in
// dezelfde gedeelde browser) schoon begint.
await page.reload();
await wachtOpSpel();
await page.evaluate(() => localStorage.removeItem(window.DamChaosDebug.HIGHSCORE_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
