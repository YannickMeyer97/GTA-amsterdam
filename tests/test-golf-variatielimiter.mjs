// Wave-variatie-limiter (Ticket 23, Z6): een ringbuffer (lengte 4) met
// recente profiel-indices voorkomt dat een golf per toeval 3 (bijna)
// identieke verschijningen op rij spawnt. Alleen golf-spawns
// (golfSpawnStap -> kiesOndodeTraitsVoorGolf) gebruiken de buffer; directe
// spawnOndode()-aanroepen blijven erbuiten.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Nooit 3 dezelfde profielen op rij, over ruim meer dan 100 samples -
const geenTriple = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const reeks = [];
  for (let i = 0; i < 300; i++) reeks.push(d.kiesOndodeTraitsVoorGolf().profiel);
  let maxOpRij = 1, huidigeOpRij = 1;
  for (let i = 1; i < reeks.length; i++) {
    if (reeks[i] === reeks[i - 1]) { huidigeOpRij++; maxOpRij = Math.max(maxOpRij, huidigeOpRij); }
    else huidigeOpRij = 1;
  }
  return { maxOpRij, lengte: reeks.length };
});
check('300 golf-spawn-profielen op rij bevatten nooit een reeks van 3 identieke profielen',
  geenTriple.maxOpRij < 3, geenTriple);

// --- 2. Buffer blijft binnen zijn lengte (4) en bevat geldige profielnamen -
const bufferStaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (let i = 0; i < 20; i++) d.kiesOndodeTraitsVoorGolf();
  return {
    lengte: d.golfProfielBuffer.length,
    max: d.GOLF_PROFIEL_BUFFER_LENGTE,
    allemaalGeldig: d.golfProfielBuffer.every(p => p in d.VARIATIE_PROFIELEN),
  };
});
check('golfProfielBuffer blijft nooit langer dan GOLF_PROFIEL_BUFFER_LENGTE (4)',
  bufferStaat.lengte <= bufferStaat.max && bufferStaat.max === 4, bufferStaat);
check('Elke naam in de buffer is een geldig profiel uit VARIATIE_PROFIELEN',
  bufferStaat.allemaalGeldig, bufferStaat);

// --- 3. Verdeling blijft op de lange termijn uniform (±20% van 1/7e) ------
const verdeling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tellingen = {};
  const N = 700;
  for (let i = 0; i < N; i++) {
    const p = d.kiesOndodeTraitsVoorGolf().profiel;
    tellingen[p] = (tellingen[p] || 0) + 1;
  }
  return { tellingen, N, aantalProfielen: Object.keys(d.VARIATIE_PROFIELEN).length };
});
const verwacht = verdeling.N / verdeling.aantalProfielen;
const binnenMarge = Object.values(verdeling.tellingen).every(n => Math.abs(n - verwacht) <= verwacht * 0.2 + 5);
check('Verdeling over 700 golf-spawn-loting blijft ±20% rond het uniforme gemiddelde',
  binnenMarge && Object.keys(verdeling.tellingen).length === verdeling.aantalProfielen, { verdeling, verwacht });

// --- 4. Directe spawnOndode()-aanroepen blijven buiten de buffer ----------
const directeSpawnsBuitenBuffer = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const bufferVoor = [...d.golfProfielBuffer];
  for (let i = 0; i < 10; i++) {
    const o = d.spawnOndode(0, 'normaal');   // gebruikt kiesOndodeTraits() rechtstreeks (default-param)
    o.groep.position.set(999, 0, 999);
  }
  const bufferNa = [...d.golfProfielBuffer];
  return { onveranderd: JSON.stringify(bufferVoor) === JSON.stringify(bufferNa) };
});
check('10 directe spawnOndode()-aanroepen raken golfProfielBuffer niet',
  directeSpawnsBuitenBuffer.onveranderd, directeSpawnsBuitenBuffer);

// --- 5. Integratie: golfSpawnStap() gebruikt zelf de gebufferde loting ----
const integratie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (const v of d.VENSTERS) v.planken = 0;   // geen barricades in de weg
  d.spelStaat.golf = 1;
  d.spelStaat.budget = 1000;
  const bufferVoor = [...d.golfProfielBuffer];
  const ondode = d.golfSpawnStap();
  const bufferNa = [...d.golfProfielBuffer];
  return { gespawned: ondode !== null, bufferVoor, bufferNa, gewijzigd: JSON.stringify(bufferVoor) !== JSON.stringify(bufferNa) };
});
check('golfSpawnStap() spawnt een ondode en muteert golfProfielBuffer (nieuw profiel toegevoegd)',
  integratie.gespawned && integratie.gewijzigd, integratie);

// --- 6. Typekeuze, budget en barricade-gedrag blijven ongewijzigd (steekproef) -
const nietVeranderd = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (const v of d.VENSTERS) v.planken = 0;
  d.spelStaat.golf = 10;   // alle types beschikbaar
  d.spelStaat.budget = 50;
  const budgetVoor = d.spelStaat.budget;
  const ondode = d.golfSpawnStap();
  const kosten = d.ONDODE_THREAT_KOSTEN[ondode.type] ?? 1;
  return { budgetKlopt: Math.abs((budgetVoor - kosten) - d.spelStaat.budget) < 1e-9, type: ondode.type };
});
check('golfSpawnStap() boekt het budget nog steeds af volgens ONDODE_THREAT_KOSTEN (typekeuze ongewijzigd)',
  nietVeranderd.budgetKlopt, nietVeranderd);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
