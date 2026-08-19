// Map-lus M1 (Ticket 24): geometrie-schil voor zone E (bijkeuken + kelderhals).
// De nieuwe ruimtes bestaan fysiek maar zijn nog volledig dicht: geen deuren,
// geen spawns, geen interacties. Bewaakt: (1) niets van het nieuwe gebied is
// bereikbaar (de toekomstige deur 3/4-posities zijn nog gewoon bestaande,
// ongewijzigde muur), (2) alle nieuwe wand-naden sluiten echt af (probes,
// niet op het oog), (3) de nepgevel valt buiten de bijkeuken, (4) GRENS en de
// bestaande muren zijn ongewijzigd, (5) de nieuwe muren staan geregistreerd
// met exact de verwachte bounds (was 6 losse rechthoeken; Ticket 52 splitste
// de oostmuur in twee segmenten voor de nieuwe doorgang naar de gracht, dus
// nu 7 — zelfde telling-discipline als elders in de suite).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const probes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kelderhalsCZ = (d.KELDERHALS_Z_NOORD + d.KELDERHALS_Z_ZUID) / 2;
  const noordZ = d.BIJKEUKEN_Z_NOORD - 0.15;   // = -4.65, centrum van de bijkeuken-noordmuur

  function heeftRechthoek(minX, maxX, minZ, maxZ) {
    return d.obstakels.some(o =>
      Math.abs(o.minX - minX) < 1e-9 && Math.abs(o.maxX - maxX) < 1e-9 &&
      Math.abs(o.minZ - minZ) < 1e-9 && Math.abs(o.maxZ - maxZ) < 1e-9);
  }

  return {
    // --- Toekomstige deur-posities: nog gewoon bestaande, ongewijzigde muur ---
    deur3Plek: d.isVrijePlek(d.DEUR3_X, d.PLAATS_Z_ZUID + 0.15, 0.05),   // binnenplaats-zuidmuur, ongewijzigd
    deur4Plek: d.isVrijePlek(d.HALF_BREEDTE + 0.15, d.DEUR4_Z, 0.05),    // woonkamer-oostmuur, ongewijzigd
    // --- Nieuwe muren van de bijkeuken: elke naad geblokkeerd -----------------
    // Ticket 52 opende de oostmuur exact bij BIJKEUKEN_CZ (de nieuwe gang naar
    // de gracht) — de oude probe op BIJKEUKEN_CZ zelf zou nu dus per ontwerp
    // vrij zijn; deze probet een punt duidelijk BINNEN het overgebleven
    // zuidsegment van de gesplitste muur (z=BIJKEUKEN_CZ+2.5), dat nog steeds
    // gewoon dicht moet zijn.
    bijkeukenOost: d.isVrijePlek(d.BIJKEUKEN_X_OOST + 0.15, d.BIJKEUKEN_CZ + 2.5, 0.05),
    bijkeukenZuid: d.isVrijePlek(d.BIJKEUKEN_CX, d.BIJKEUKEN_Z_ZUID + 0.15, 0.05),
    bijkeukenNoordWest: d.isVrijePlek((d.BIJKEUKEN_X_WEST + d.KELDERHALS_X_WEST) / 2, noordZ, 0.05),
    bijkeukenNoordOost: d.isVrijePlek((d.KELDERHALS_X_OOST + d.BIJKEUKEN_X_OOST) / 2, noordZ, 0.05),
    // --- Bewuste open doorgang kelderhals <-> bijkeuken (zelfde zone, geen deur) ---
    kelderhalsOpening: d.isVrijePlek((d.KELDERHALS_X_WEST + d.KELDERHALS_X_OOST) / 2, d.BIJKEUKEN_Z_NOORD, 0.05),
    // --- Nieuwe muren van de kelderhals ---------------------------------------
    kelderhalsWest: d.isVrijePlek(d.KELDERHALS_X_WEST - 0.15, kelderhalsCZ, 0.05),
    kelderhalsOost: d.isVrijePlek(d.KELDERHALS_X_OOST + 0.15, kelderhalsCZ, 0.05),
    // --- Binnenkant van beide ruimtes is vrije vloer (sanity, geen reachability) ---
    bijkeukenBinnen: d.isVrijePlek(d.BIJKEUKEN_CX, d.BIJKEUKEN_CZ, 0.3),
    kelderhalsBinnen: d.isVrijePlek(d.DEUR3_X, kelderhalsCZ, 0.3),
    // --- Nepgevel blijft buiten de bijkeuken -----------------------------------
    nepgevelBuitenBijkeuken: 16 > d.BIJKEUKEN_X_OOST,
    // --- Bestaande muren: de binnenplaats-zuidmuur (Ticket 25) en de
    // woonkamer-oostmuur (Ticket 26) zijn beide ondertussen gesplitst voor
    // hun deur — nog steeds twee "bestaande" segmenten, alleen niet meer één
    // rechthoek ------------------------------------------------------------
    bestaandeZuidmuurGesplitstVoorDeur3: heeftRechthoek(4.2, d.DEUR3_X - d.DEUR3_HALF, d.PLAATS_Z_ZUID, d.PLAATS_Z_ZUID + 0.3) &&
      heeftRechthoek(d.DEUR3_X + d.DEUR3_HALF, 20.8, d.PLAATS_Z_ZUID, d.PLAATS_Z_ZUID + 0.3),
    bestaandeOostmuurGesplitstVoorDeur4: heeftRechthoek(d.HALF_BREEDTE, d.HALF_BREEDTE + 0.3, -d.HALF_DIEPTE, d.DEUR4_Z - d.DEUR4_HALF) &&
      heeftRechthoek(d.HALF_BREEDTE, d.HALF_BREEDTE + 0.3, d.DEUR4_Z + d.DEUR4_HALF, d.HALF_DIEPTE),
    // --- GRENS blijft exact ongewijzigd -----------------------------------
    GRENS: d.GRENS,
    obstakelAantal: d.obstakels.length,
    // --- De 6 nieuwe muren staan geregistreerd met exact de verwachte bounds -
    // Ticket 52 splitste de oostmuur (was 1 rechthoek) in twee segmenten rond
    // de nieuwe doorgang naar de gang-naar-de-gracht (z ∈ [BIJKEUKEN_CZ ±
    // GRACHTGANG_HALF] is nu open) — zelfde "geen deur, gewoon een gat"-
    // patroon als de al bestaande kelderhals-opening, dus hier ook als twee
    // aparte rechthoeken verwacht i.p.v. één.
    heeftBijkeukenOost: heeftRechthoek(d.BIJKEUKEN_X_OOST, d.BIJKEUKEN_X_OOST + 0.3, d.BIJKEUKEN_Z_NOORD, d.BIJKEUKEN_CZ - d.GRACHTGANG_HALF) &&
      heeftRechthoek(d.BIJKEUKEN_X_OOST, d.BIJKEUKEN_X_OOST + 0.3, d.BIJKEUKEN_CZ + d.GRACHTGANG_HALF, d.BIJKEUKEN_Z_ZUID),
    heeftBijkeukenZuid: heeftRechthoek(d.BIJKEUKEN_X_WEST, d.BIJKEUKEN_X_OOST, d.BIJKEUKEN_Z_ZUID, d.BIJKEUKEN_Z_ZUID + 0.3),
    heeftBijkeukenNoordWest: heeftRechthoek(d.BIJKEUKEN_X_WEST, d.KELDERHALS_X_WEST, d.BIJKEUKEN_Z_NOORD - 0.3, d.BIJKEUKEN_Z_NOORD),
    heeftBijkeukenNoordOost: heeftRechthoek(d.KELDERHALS_X_OOST, d.BIJKEUKEN_X_OOST, d.BIJKEUKEN_Z_NOORD - 0.3, d.BIJKEUKEN_Z_NOORD),
    heeftKelderhalsWest: heeftRechthoek(d.KELDERHALS_X_WEST - 0.3, d.KELDERHALS_X_WEST, d.KELDERHALS_Z_NOORD, d.KELDERHALS_Z_ZUID),
    heeftKelderhalsOost: heeftRechthoek(d.KELDERHALS_X_OOST, d.KELDERHALS_X_OOST + 0.3, d.KELDERHALS_Z_NOORD, d.KELDERHALS_Z_ZUID),
  };
});

check('Deur 3-positie (binnenplaats-zuidmuur) is nog bezet: bestaande muur ongewijzigd',
  probes.deur3Plek === false, probes);
check('Deur 4-positie (woonkamer-oostmuur) is nog bezet: bestaande muur ongewijzigd',
  probes.deur4Plek === false, probes);
check('Bijkeuken-oostmuur sluit af', probes.bijkeukenOost === false, probes);
check('Bijkeuken-zuidmuur sluit af', probes.bijkeukenZuid === false, probes);
check('Bijkeuken-noordmuur (westsegment) sluit af', probes.bijkeukenNoordWest === false, probes);
check('Bijkeuken-noordmuur (oostsegment) sluit af', probes.bijkeukenNoordOost === false, probes);
check('Kelderhals-westmuur sluit af', probes.kelderhalsWest === false, probes);
check('Kelderhals-oostmuur sluit af', probes.kelderhalsOost === false, probes);
check('De opening tussen kelderhals en bijkeuken is bewust vrij (zelfde zone, geen deur)',
  probes.kelderhalsOpening === true, probes);
check('Binnenkant bijkeuken is vrije vloer', probes.bijkeukenBinnen === true, probes);
check('Binnenkant kelderhals is vrije vloer', probes.kelderhalsBinnen === true, probes);
check('De nepgevel op (16, −5.95) valt buiten de bijkeuken (x=16 > BIJKEUKEN_X_OOST=12)',
  probes.nepgevelBuitenBijkeuken, probes);
check('Binnenplaats-zuidmuur is inmiddels (Ticket 25) netjes gesplitst rond deur 3, geen andere wijzigingen',
  probes.bestaandeZuidmuurGesplitstVoorDeur3, probes);
check('Woonkamer-oostmuur is inmiddels (Ticket 26) netjes gesplitst rond deur 4, geen andere wijzigingen',
  probes.bestaandeOostmuurGesplitstVoorDeur4, probes);
check('GRENS is niet gewijzigd (blijft exact de v0.11-waarden)',
  Math.abs(probes.GRENS.minX - (-11.45)) < 1e-9 && Math.abs(probes.GRENS.maxX - 20.45) < 1e-9 &&
  Math.abs(probes.GRENS.minZ - (-23.95)) < 1e-9 && Math.abs(probes.GRENS.maxZ - 4.95) < 1e-9, probes.GRENS);
check('Alle nieuwe zone-E-muren staan geregistreerd met exact de verwachte bounds (7, sinds Ticket 52 de oostmuur splitste)',
  probes.heeftBijkeukenOost && probes.heeftBijkeukenZuid && probes.heeftBijkeukenNoordWest &&
  probes.heeftBijkeukenNoordOost && probes.heeftKelderhalsWest && probes.heeftKelderhalsOost, probes);
// Band opgehoogd naar 46 (was 40): Ticket 62 voegt 6 nieuwe, legitieme
// obstakels toe (2 gesplitste nis-westmuur-segmenten + deur5Obstakel +
// 3 kelderwanden), 37 -> 43. Blijft een ruime bandbreedte, geen exacte telling.
// Band opnieuw opgehoogd naar 58 (was 52): Ticket 87 (De Vliering) voegt er 4
// toe (gesplitste atelier-weststomp + vliering-west/-zuid + kokerwand),
// 52 -> 56. De exacte telling staat in tests/test-vliering.mjs.
// Band opnieuw opgehoogd naar 62 (was 58): Ticket 130 (tweede vlieringtrap)
// voegt er 3 toe (extra weststomp-segment + twee kokerwanden i.p.v. één),
// 56 -> 59.
check('Obstakel-count-test (bijgewerkt voor Ticket 24 + Ticket 62 + Ticket 87 + Ticket 130): totaal blijft in een ruime, verwachte bandbreedte',
  probes.obstakelAantal >= 20 && probes.obstakelAantal <= 62, probes);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
