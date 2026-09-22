// Wave-variatie-limiter (Ticket 23, Z6): een ringbuffer (lengte 4) met
// recente profiel-indices maakt het veel onwaarschijnlijker dat een golf per
// toeval (bijna) identieke verschijningen op rij spawnt. Alleen golf-spawns
// (golfSpawnStap -> kiesOndodeTraitsVoorGolf) gebruiken de buffer; directe
// spawnOndode()-aanroepen blijven erbuiten.
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

/* --- 1. De limiter drukt herhaling echt omlaag ---------------------------
   DEZE CHECK BEWEERDE IETS DAT NIET WAAR IS. Hij deed één reeks van 300
   lotingen en eiste dat daar NOOIT drie identieke profielen op rij in zaten.
   De implementatie belooft dat nergens — die zegt letterlijk "blokkeert
   nooit: na GOLF_PROFIEL_MAX_HERLOTINGEN mislukte pogingen wordt de laatste
   loting gewoon geaccepteerd". De check was dus vanaf dag één kansgebaseerd
   en had gewoon meestal geluk.

   Gemeten, met het exacte algoritme (buffer 4, 3 herlotingen), over 100.000
   sequenties van 300:

     | profielen        | sequenties met een reeks van 3+ |
     | 7 (vóór T182)    |  7,7 %                          |
     | 6 (na  T182)     | 22,1 %                          |

   Ticket 182 haalde het 'eenarmige' profiel weg (7 -> 6) en verdrievoudigde
   daarmee de faalkans van deze check. De suite kreeg 'm met één herkansing
   nog onder de 5 %, wat precies genoeg was om het als "omgevingsruis" te
   blijven zien: het script stond in run-all's HERKANSING-lijst met het
   label "wall-clock-timing-gevoelig", en dat klopte niet — deze test heeft
   geen enkele tijdsafhankelijkheid. Hij was kansgebaseerd.

   Wat de limiter WEL garandeert is meetbaar en veel interessanter: hij
   drukt de kans op twee dezelfde op rij van 1/6 (16,7 %) naar ~4,2 %, een
   factor vier. Dát is waar deze check nu op staat. Haalt iemand de limiter
   weg, dan schiet die 4,2 % terug naar 16,7 % en valt de check om.

   En om de kans definitief uit deze test te halen: Math.random wordt tijdens
   de meting vervangen door een gezaaide generator. Zelfde zaden, elke run
   dezelfde uitkomst — geen herkansing meer nodig. */
const limiter = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const echteRandom = Math.random;
  // mulberry32: klein, snel en goed genoeg verdeeld voor deze meting.
  const zaadRng = (zaad) => {
    let a = zaad >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const SEQUENTIES = 400, LENGTE = 300;
  let metDrie = 0, grootsteReeks = 1, herhalingen = 0, overgangen = 0;
  try {
    for (let s = 0; s < SEQUENTIES; s++) {
      Math.random = zaadRng(s + 1);
      d.golfProfielBuffer.length = 0;   // elke sequentie begint schoon
      const reeks = [];
      for (let i = 0; i < LENGTE; i++) reeks.push(d.kiesOndodeTraitsVoorGolf().profiel);
      let max = 1, opRij = 1;
      for (let i = 1; i < reeks.length; i++) {
        overgangen++;
        if (reeks[i] === reeks[i - 1]) { herhalingen++; opRij++; max = Math.max(max, opRij); }
        else opRij = 1;
      }
      if (max >= 3) metDrie++;
      grootsteReeks = Math.max(grootsteReeks, max);
    }
  } finally {
    // ALTIJD terugzetten, ook als er hierboven iets klapt — de checks
    // hieronder rekenen op echte willekeur.
    Math.random = echteRandom;
    d.golfProfielBuffer.length = 0;
  }
  const aantalProfielen = Object.keys(d.VARIATIE_PROFIELEN).length;
  return {
    sequenties: SEQUENTIES, lengte: LENGTE,
    herhaalkans: herhalingen / overgangen,
    zonderLimiter: 1 / aantalProfielen,
    fractieMetDrie: metDrie / SEQUENTIES,
    grootsteReeks,
    aantalProfielen,
  };
});
check('De limiter halveert de kans op twee identieke profielen op rij ruimschoots (dit valt om zodra hij wegvalt)',
  limiter.herhaalkans < limiter.zonderLimiter / 2, limiter);
check('Math.random is na de meting netjes teruggezet',
  await page.evaluate(() => Math.random() !== Math.random()), {});
check('Een reeks van 3 blijft een uitzondering, geen regel',
  limiter.fractieMetDrie < 0.35, limiter);
check('Een reeks van 5 of langer komt in 400 sequenties van 300 niet voor',
  limiter.grootsteReeks <= 4, limiter);

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

// --- 3. Verdeling blijft op de lange termijn uniform ---------------------
// (Stond hier als "±20% van 1/7e"; sinds Ticket 182 zijn het er 6. De check
// leest het aantal profielen al dynamisch uit VARIATIE_PROFIELEN, dus alleen
// het kopje liep achter.)
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
