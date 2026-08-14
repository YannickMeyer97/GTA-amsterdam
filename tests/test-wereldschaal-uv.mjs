// Ticket 106 (v0.22, §10.11-beslissing 86): wereldschaal-UV's — de repeat
// verhuist van de gedeelde textuur naar het uv-attribuut van de geometrie,
// per vlak geschaald naar de wereldafmetingen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. herschaalUVNaarWereldschaal(): een PlaneGeometry (vlak) krijgt UV's
// die letterlijk de wereldafmeting in meters zijn (bij TEXELS_PER_METER=1),
// niet meer 0..1. Gecontroleerd op een echte, al gebakken vlak()-vloer
// (bv. gangVloerMesh) — geen losse THREE-constructie nodig (die is niet
// geëxposeerd op het debug-object).
const echtTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Zoek een echte, al gebakken vlak()-vloer op MET een matFamilie()-textuur
  // (bv. gangVloerMesh) — alleen die krijgen wereldschaal-UV's die er
  // daadwerkelijk toe doen; een ongetextureerd vlak (bv. de woonkamervloer,
  // die nooit via matFamilie() gaat) heeft niets aan de herschaling en is
  // dus geen geldige testkandidaat.
  let vloerMesh = null;
  d.wereld.traverse((kind) => {
    if (vloerMesh) return;
    if (kind.isMesh && kind.geometry.type === 'PlaneGeometry' && kind.geometry.getAttribute('uv') &&
        (kind.material.map || kind.material.roughnessMap)) vloerMesh = kind;
  });
  if (!vloerMesh) return { gevonden: false };
  const uv = vloerMesh.geometry.getAttribute('uv');
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i));
    minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i));
  }
  const params = vloerMesh.geometry.parameters;
  return { gevonden: true, minU, maxU, minV, maxV, breedte: params.width, diepte: params.height };
});
check('Er bestaat minstens één PlaneGeometry-mesh met een uv-attribuut om te controleren',
  echtTest.gevonden, echtTest);
check('De UV-reikwijdte van een echte vloer/plafond komt overeen met zijn wereldafmeting (niet vast 0..1)',
  echtTest.gevonden &&
  Math.abs((echtTest.maxU - echtTest.minU) - echtTest.breedte) < 0.5 &&
  Math.abs((echtTest.maxV - echtTest.minV) - echtTest.diepte) < 0.5,
  echtTest);

// --- 2. herschaalUVNaarWereldschaal() zelf: direct getest op een verse
// geometrie via de exposed THREE-achtige helpers (geoAfgeschuind geeft een
// BoxGeometry-achtige RoundedBoxGeometry — gebruik in plaats daarvan een
// echte BoxGeometry via blokAfgeschuind()'s onderliggende bouwsteen is
// omslachtig; test in plaats daarvan de FUNCTIE-BRON en het gedrag op een
// bestaande wereldmesh met bekende afmetingen (de kelder-vloer).
const kelderTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let kelderVloer = null;
  d.wereld.traverse((kind) => {
    if (kelderVloer) return;
    if (kind.isMesh && kind.geometry.type === 'PlaneGeometry' &&
        kind.position.y < -1 && kind.rotation.x < 0) kelderVloer = kind;
  });
  if (!kelderVloer) return { gevonden: false };
  const uv = kelderVloer.geometry.getAttribute('uv');
  const pos = kelderVloer.geometry.getAttribute('position');
  // Bij TEXELS_PER_METER=1 moet uv.x exact overeenkomen met de lokale
  // positie op de as die correspondeert (voor een niet-geroteerde
  // PlaneGeometry: lokaal x/y vóór rotatie).
  let kloppend = 0, totaal = 0;
  for (let i = 0; i < uv.count; i += Math.max(1, Math.floor(uv.count / 40))) {
    totaal++;
    const verwachtU = pos.getX(i) * d.TEXELS_PER_METER;
    const verwachtV = pos.getY(i) * d.TEXELS_PER_METER;
    if (Math.abs(uv.getX(i) - verwachtU) < 1e-4 && Math.abs(uv.getY(i) - verwachtV) < 1e-4) kloppend++;
  }
  return { gevonden: true, kloppend, totaal };
});
check('De kelder-vloer se UV komt exact overeen met lokale positie * TEXELS_PER_METER (de kernformule)',
  kelderTest.gevonden && kelderTest.kloppend === kelderTest.totaal, kelderTest);

// --- 3. bouwCanvasTextuur() zet geen vaste .repeat meer (die zou de
// wereldschaal-UV's weer overrulen) — gecontroleerd rechtstreeks op de
// textuur van een matFamilie()-materiaal.
const textuurTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const mat = d.matFamilie('steen', 0x123456);
  const map = mat.roughnessMap;
  return map ? { repeatX: map.repeat.x, repeatY: map.repeat.y } : { geenMap: true };
});
check('De roughnessMap van een matFamilie()-materiaal heeft GEEN vaste repeat meer (blijft op (1,1), de default)',
  !textuurTest.geenMap && textuurTest.repeatX === 1 && textuurTest.repeatY === 1, textuurTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
