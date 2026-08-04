// Ticket 68: richtingsfeedback bij schade — een vaste pool van DOM-
// "wedge"-elementen (zelfde effects-pool-patroon als tracerPool/impactPool),
// die oplichten aan de rand van het beeld, gedraaid naar de hoek tussen
// kijkrichting en schaderichting. relatieveHoek is (net als bij de
// boot-hoorn-pan en de kelder-waypointgraaf elders) reken kundig linksom-
// georiënteerd (atan2), maar CSS rotate() is rechtsom-positief — dus
// toonSchadeRichting() negeert relatieveHoek bewust vóór het in de
// rotate()-transform te zetten. Zie ROADMAP.md Ticket 68 en
// ARCHITECTURE_NOTES.md §7.8.2.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

function rotatieHoek(transform) {
  const m = /rotate\(([-\d.]+)rad\)/.exec(transform);
  return m ? parseFloat(m[1]) : null;
}

// --- 1. Pool bestaat: SCHADE_WEDGE_MAX elementen, echt in de DOM, klasse "schadeWedge" ---
const poolTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    aantal: d.schadeWedgePool.length,
    verwacht: d.SCHADE_WEDGE_MAX,
    allemaalInDom: d.schadeWedgePool.every(slot => document.body.contains(slot.el)),
    allemaalJuisteKlasse: d.schadeWedgePool.every(slot => slot.el.className === 'schadeWedge'),
  };
});
check('SCHADE_WEDGE_MAX is 4 en de pool heeft exact dat aantal elementen', poolTest.aantal === poolTest.verwacht && poolTest.aantal === 4, poolTest);
check('Elk pool-element zit echt in de DOM (document.body)', poolTest.allemaalInDom, poolTest);
check('Elk pool-element heeft de "schadeWedge"-klasse', poolTest.allemaalJuisteKlasse, poolTest);

// --- 2. Richting vóór: bron recht voor de speler (yaw=0 kijkt naar -z) -----
const vanVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  d.toonSchadeRichting(0, -5);   // bron op -z: recht vooruit
  const slot = d.schadeWedgePool[(d.schadeWedgeVolgende - 1 + d.SCHADE_WEDGE_MAX) % d.SCHADE_WEDGE_MAX];
  return { transform: slot.el.style.transform, opacity: slot.el.style.opacity, timer: slot.timer };
});
const hoekVoor = rotatieHoek(vanVoor.transform);
check('Bron recht vooruit: rotatiehoek ≈ 0rad', Math.abs(hoekVoor) < 0.001, { vanVoor, hoekVoor });
check('De wedge licht op (opacity 1) en de timer staat op de volle duur', vanVoor.opacity === '1', vanVoor);

// --- 3. Richting achter: bron recht achter de speler ------------------------
const vanAchter = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonSchadeRichting(0, 5);   // bron op +z: recht achter
  const slot = d.schadeWedgePool[(d.schadeWedgeVolgende - 1 + d.SCHADE_WEDGE_MAX) % d.SCHADE_WEDGE_MAX];
  return { transform: slot.el.style.transform };
});
const hoekAchter = rotatieHoek(vanAchter.transform);
check('Bron recht achter: rotatiehoek ≈ ±π (front/behind is sign-symmetrisch, maar wel 180° draai)',
  Math.abs(Math.abs(hoekAchter) - Math.PI) < 0.001, { vanAchter, hoekAchter });

// --- 4. Richting rechts vs. links: dit is de bug-klasse die front/behind
// NIET kan vangen (die zijn sign-symmetrisch) — expliciete links/rechts-check.
const vanRechts = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonSchadeRichting(5, 0);   // bron op +x: rechts van de speler (yaw=0)
  const slot = d.schadeWedgePool[(d.schadeWedgeVolgende - 1 + d.SCHADE_WEDGE_MAX) % d.SCHADE_WEDGE_MAX];
  return { transform: slot.el.style.transform };
});
const vanLinks = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonSchadeRichting(-5, 0);   // bron op -x: links van de speler
  const slot = d.schadeWedgePool[(d.schadeWedgeVolgende - 1 + d.SCHADE_WEDGE_MAX) % d.SCHADE_WEDGE_MAX];
  return { transform: slot.el.style.transform };
});
const hoekRechts = rotatieHoek(vanRechts.transform);
const hoekLinks = rotatieHoek(vanLinks.transform);
check('Bron rechts van de speler: POSITIEVE rotatiehoek (wedge draait rechtsom naar de rechterkant)',
  hoekRechts > 0.1, { vanRechts, hoekRechts });
check('Bron links van de speler: NEGATIEVE rotatiehoek (wedge draait linksom naar de linkerkant)',
  hoekLinks < -0.1, { vanLinks, hoekLinks });
check('Rechts en links geven exact tegengestelde hoeken (symmetrisch rond 0)',
  Math.abs(hoekRechts + hoekLinks) < 0.001, { hoekRechts, hoekLinks });

// --- 5. Bron exact op spelerpositie: geen NaN, geen crash, gewoon een no-op -
const geenRichting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.schadeWedgeVolgende;
  d.toonSchadeRichting(d.speler.positie.x, d.speler.positie.z);
  return { volgendeOngewijzigd: d.schadeWedgeVolgende === voor };
});
check('Bron exact op de spelerpositie: geen wedge geactiveerd (pool-cursor blijft staan)', geenRichting.volgendeOngewijzigd, geenRichting);

// --- 6. Round-robin: 5 aanroepen op een pool van 4 hergebruikt slot 0 -------
const roundRobin = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.schadeWedgeVolgende = 0;
  const slotsGeraakt = [];
  for (let i = 0; i < 5; i++) {
    d.toonSchadeRichting(0, -5 - i);   // steeds een net iets andere hoek, altijd "voor"
    slotsGeraakt.push((d.schadeWedgeVolgende - 1 + d.SCHADE_WEDGE_MAX) % d.SCHADE_WEDGE_MAX);
  }
  return { slotsGeraakt };
});
check('Round-robin: na 5 aanroepen op een pool van 4 is slot 0 opnieuw gebruikt (volgorde 0,1,2,3,0)',
  JSON.stringify(roundRobin.slotsGeraakt) === JSON.stringify([0, 1, 2, 3, 0]), roundRobin);

// --- 7. updateSchadeWedges(): lineaire uitfade over SCHADE_WEDGE_DUUR -------
const fadeTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonSchadeRichting(0, -5);
  const slot = d.schadeWedgePool[(d.schadeWedgeVolgende - 1 + d.SCHADE_WEDGE_MAX) % d.SCHADE_WEDGE_MAX];
  const voor = { opacity: slot.el.style.opacity, timer: slot.timer };
  d.updateSchadeWedges(d.SCHADE_WEDGE_DUUR / 2);
  const halverwege = { opacity: parseFloat(slot.el.style.opacity), timer: slot.timer };
  d.updateSchadeWedges(d.SCHADE_WEDGE_DUUR);   // ruim voorbij het einde
  const naAfloop = { opacity: parseFloat(slot.el.style.opacity), timer: slot.timer };
  return { voor, halverwege, naAfloop };
});
check('Vlak na het tonen staat de opacity op 1 (volle duur)', fadeTest.voor.opacity === '1' && fadeTest.voor.timer === 0.5, fadeTest);
check('Op de helft van de duur is de opacity ≈ 0.5', Math.abs(fadeTest.halverwege.opacity - 0.5) < 0.05, fadeTest);
check('Ruim na afloop: opacity en timer staan allebei op 0 (geklemd, niet negatief)',
  fadeTest.naAfloop.opacity === 0 && fadeTest.naAfloop.timer === 0, fadeTest);

// --- 8. Wedges die al op 0 staan worden niet steeds herschreven (geen
// zinloze style-writes voor slots die toch al stil liggen) ------------------
const stilstandTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const slot of d.schadeWedgePool) { slot.timer = 0; slot.el.style.opacity = '0'; }
  d.updateSchadeWedges(0.1);
  return { blijftStil: d.schadeWedgePool.every(s => s.el.style.opacity === '0' && s.timer === 0) };
});
check('Alle stilstaande (timer=0) wedges blijven op opacity 0 na updateSchadeWedges()', stilstandTest.blijftStil, stilstandTest);

// --- 9. spelerSchade() met bron-positie roept toonSchadeRichting() aan -----
const viaSpelerSchade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  for (const slot of d.schadeWedgePool) { slot.timer = 0; slot.el.style.opacity = '0'; }
  d.schadeWedgeVolgende = 0;
  const hpVoor = d.spelerStaat.hp;
  d.spelerSchade(5, 'loper', 0, -5);   // bron recht vooruit
  const slot = d.schadeWedgePool[0];
  return { hpNa: d.spelerStaat.hp, hpVoor, opacity: slot.el.style.opacity, transform: slot.el.style.transform };
});
check('spelerSchade() met bron-x/z trekt HP af zoals gewoonlijk', viaSpelerSchade.hpNa === viaSpelerSchade.hpVoor - 5, viaSpelerSchade);
check('spelerSchade() met bron-x/z activeert ook meteen een wedge (opacity 1)', viaSpelerSchade.opacity === '1', viaSpelerSchade);
check('Die wedge staat op de juiste ("vooruit") hoek', Math.abs(rotatieHoek(viaSpelerSchade.transform)) < 0.001, viaSpelerSchade);

// --- 10. spelerSchade() ZONDER bron-positie (bv. een toekomstige, nog niet
// gerichte schadebron) laat de wedge-pool met rust — geen NaN/crash -------
const zonderBron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const slot of d.schadeWedgePool) { slot.timer = 0; slot.el.style.opacity = '0'; }
  const hpVoor = d.spelerStaat.hp;
  d.spelerSchade(3, 'onbekend');   // geen bronX/bronZ meegegeven
  return {
    hpNa: d.spelerStaat.hp, hpVoor,
    geenWedgeGeraakt: d.schadeWedgePool.every(s => s.timer === 0),
  };
});
check('spelerSchade() zonder bron-positie trekt nog steeds HP af', zonderBron.hpNa === zonderBron.hpVoor - 3, zonderBron);
check('spelerSchade() zonder bron-positie activeert GEEN wedge', zonderBron.geenWedgeGeraakt, zonderBron);

// --- 11. Bron-check: geen document.createElement() in de schade-hot-path --
const bronTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    toonGeenCreateElement: !/document\.createElement/.test(d.toonSchadeRichting.toString()),
    updateGeenCreateElement: !/document\.createElement/.test(d.updateSchadeWedges.toString()),
  };
});
check('toonSchadeRichting() maakt geen nieuwe DOM-elementen aan (alleen pool-hergebruik)', bronTest.toonGeenCreateElement, bronTest);
check('updateSchadeWedges() maakt geen nieuwe DOM-elementen aan', bronTest.updateGeenCreateElement, bronTest);

// --- 12. Fix 2 (feedback: "de richtingsfeedback werkt nog niet helemaal
// goed"): de hoek werd vroeger ÉÉN keer op het hit-moment bevroren — draaide
// de speler daarna verder (bijna altijd het geval midden in gevecht), dan
// bleef de pijl op de oude schermhoek staan i.p.v. de bron te blijven volgen.
// updateSchadeWedges() moet de rotatie nu ELKE frame herberekenen met de
// ACTUELE speler.yaw. ---------------------------------------------------
const driftTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  for (const slot of d.schadeWedgePool) { slot.timer = 0; slot.el.style.opacity = '0'; }
  d.schadeWedgeVolgende = 0;
  d.toonSchadeRichting(0, -5);   // bron recht vooruit, bij yaw=0
  const slot = d.schadeWedgePool[0];
  const hoekBijHit = slot.el.style.transform;

  // Speler draait een kwartslag (zonder opnieuw geraakt te worden) terwijl
  // de wedge nog zichtbaar is.
  d.speler.yaw = Math.PI / 2;
  d.updateSchadeWedges(0.05);
  const hoekNaDraaien = slot.el.style.transform;

  return { hoekBijHit, hoekNaDraaien };
});
function rotatieHoekVanTransform(t) { const m = /rotate\(([-\d.]+)rad\)/.exec(t); return m ? parseFloat(m[1]) : null; }
check('Vlak bij de hit (yaw=0, bron recht vooruit): rotatiehoek ≈ 0',
  Math.abs(rotatieHoekVanTransform(driftTest.hoekBijHit)) < 0.001, driftTest);
check('Draait de speler daarna een kwartslag zonder nieuwe hit: de pijl volgt mee (hoek verandert, blijft niet bevroren)',
  Math.abs(rotatieHoekVanTransform(driftTest.hoekNaDraaien) - rotatieHoekVanTransform(driftTest.hoekBijHit)) > 0.5, driftTest);
check('Na het meedraaien wijst de pijl weer correct naar dezelfde WERELD-bron (bron staat nu "rechts" na de kwartslag)',
  rotatieHoekVanTransform(driftTest.hoekNaDraaien) > 0.5, driftTest);

// --- 13. berekenSchadeWedgeHoek(): pure functie, los testbaar --------------
const pureFn = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    voor: d.berekenSchadeWedgeHoek(0, -5, 0, 0, 0),
    rechts: d.berekenSchadeWedgeHoek(5, 0, 0, 0, 0),
    voorNaKwartslag: d.berekenSchadeWedgeHoek(0, -5, 0, 0, Math.PI / 2),
  };
});
check('berekenSchadeWedgeHoek(): bron recht vooruit bij yaw=0 geeft 0', Math.abs(pureFn.voor) < 0.001, pureFn);
check('berekenSchadeWedgeHoek(): bron rechts bij yaw=0 geeft -π/2 (vóór de CSS-negatie)',
  Math.abs(pureFn.rechts - (-Math.PI / 2)) < 0.001, pureFn);
check('berekenSchadeWedgeHoek(): dezelfde wereld-bron geeft een ANDERE relatieve hoek zodra de speler draait',
  Math.abs(pureFn.voorNaKwartslag - pureFn.voor) > 0.5, pureFn);

// --- 14. Fix 1 (feedback: "hij wijst naar mij toe in plaats van van mij
// af"): de driehoek zelf moet van de speler AF wijzen, niet ernaartoe. De
// CSS-driehoektruc (0x0-box + transparante zij-borders + één gekleurde
// border) bepaalt de punt-richting: `border-top` geeft een naar-BENEDEN
// wijzende driehoek (▼) — bij θ=0 hangt de wedge BOVEN het canvasmidden, dus
// zou de punt naar BENEDEN (terug naar de speler) wijzen. `border-bottom`
// geeft een naar-BOVEN wijzende driehoek (▲): bij θ=0 wijst de punt dan
// verder omhoog, WEG van de speler — de gewenste richting. --------------
const vormTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const stijl = getComputedStyle(d.schadeWedgePool[0].el);
  return {
    borderBottom: stijl.borderBottomWidth,
    borderTop: stijl.borderTopWidth,
  };
});
check('.schadeWedge gebruikt border-bottom (driehoek wijst van de speler af), NIET border-top (zou naar de speler toe wijzen)',
  vormTest.borderBottom !== '0px' && vormTest.borderTop === '0px', vormTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
