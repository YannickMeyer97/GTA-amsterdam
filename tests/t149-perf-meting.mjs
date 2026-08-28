// Ticket 149 — perf-controle ("F3 met volle kaart tijdens meerdere
// gelijktijdige windups"). GEEN testbestand (bewust geen test-/check-prefix):
// zelfde reden als t140/t148-perf-meting.mjs — een frametijdmeting in
// headless Chromium met software-rendering is te ruisig om als harde
// assertie in de regressiesuite te hangen.
//
// 26 ondoden dicht bij de speler (binnen AANVAL_START_BEREIK), zodat
// meerdere tegelijk in windup/herstel belanden (MAX_AANVALLERS begrenst het
// AANTAL gelijktijdige windups op 2, maar de rest cyclet gewoon door via
// jaag/herstel — precies het gemengde, drukke pad dat T149's nieuwe curves
// (windup-anticipatie, impact-overshoot, flinch-differentiatie) toevoegen).
// F3 AAN ná een opbouwfase, zodat de ring buffer (PERF_FRAME_VENSTER = 90)
// alleen piek-frames bevat.
//
// Draai 'm met een stille machine, één keer op deze commit en één keer op de
// vorige (git stash), en vergelijk (zelfde workflow als t140).
//
// Dit scenario dekt het hele ondode-animatieblok en wordt daarom door
// meerdere tickets hergebruikt; de bestandsnaam verwijst naar het ticket dat
// 'm bouwde, niet naar de enige afnemer. Metingen hieronder per ticket.
//
// GEMETEN BIJ T149 (deze omgeving, 26 ondoden dicht bij de speler, 90
// opbouw- + 240 meetframes, stille machine):
//   vóór T149 (HEAD): p95 266,7 ms   gemiddelde 248,9 ms
//   ná  T149 (2x):    p95 300,0/266,6 ms   gemiddelde 264,8/234,4 ms
// Binnen dezelfde ruis-band als de vóór-meting — geen systematische stijging.
// Alle nieuwe curves (anticipatie, impact-overshoot, flinch-differentiatie,
// val-easing) zijn Math.pow()/Math.sqrt()-berekeningen op bestaande fracties,
// toegepast op dezelfde bestaande transform-writes — geen extra allocatie,
// geen extra matrixwerk, geen extra transform-writes (zie de budget-
// toelichting in updateOndoden()).
//
// GEMETEN BIJ T150 (zelfde scenario, zelfde omgeving, andere DAG-conditie):
//   vóór T150 (HEAD, 2x): p95 400,0/366,7 ms   gemiddelde 358,3/338,3 ms
//   ná  T150 (2x):        p95 333,3/333,3 ms   gemiddelde 307,0/301,3 ms
// T150 meet dus SNELLER dan zijn eigen basislijn — wat vooral laat zien dat
// de absolute getallen tussen sessies fors driften (de T149-basislijn stond
// op 266 ms, dezelfde HEAD-code meet hier 400 ms). Les voor volgende
// metingen: vergelijk ALTIJD met een vóór-meting uit dezelfde sessie
// (git stash), nooit met een getal uit een eerder ticket — anders lees je
// omgevingsdrift als een regressie. Inhoudelijk verwacht: T150 vervangt een
// module-level constante door een property-read op een object dat al was
// opgezocht, plus vier vermenigvuldigingen — nul extra werk per frame.
import { openAmsterdamUndead, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  // Verspreid in een krappe ring rond de speler — allemaal binnen
  // AANVAL_START_BEREIK, dus continu wisselend tussen jaag/windup/herstel.
  for (let i = 0; i < 26; i++) {
    const hoek = (i / 26) * Math.PI * 2;
    const straal = 1.0 + (i % 3) * 0.15;
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(Math.cos(hoek) * straal, 0, Math.sin(hoek) * straal);
  }
});

await frames(page, 90);   // opbouw: laat windup/herstel-cycli echt op gang komen

const voorMeting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const staten = {};
  for (const o of d.ondoden) staten[o.aanvalStaat] = (staten[o.aanvalStaat] || 0) + 1;
  return { aantalOndoden: d.ondoden.length, staten, actieveAanvallers: d.actieveAanvallers };
});

await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true }));
});
await frames(page, 240);

const meting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tekst = document.getElementById('perfOverlayUI').textContent;
  const p95 = /p95 ([\d.]+)ms/.exec(tekst);
  const gem = /frametijd gem ([\d.]+)ms/.exec(tekst);
  return {
    p95: p95 ? Number(p95[1]) : null,
    gemiddelde: gem ? Number(gem[1]) : null,
    aantalOndoden: d.ondoden.length,
    actief: d.perfOverlayActief,
  };
});

console.log('Vóór meting (na opbouwfase):', JSON.stringify(voorMeting));
console.log(JSON.stringify(meting, null, 2));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
