// Map-lus M3 (Ticket 26): koopbare terugdeur 4 (bijkeuken -> woonkamer).
// Bewaakt: vóór koop dicht (ook vanuit de woonkamer), na koop beide
// richtingen beloopbaar, dubbele koop doet niets, pacing verandert NIET
// door deur 4 (ontwerpbeslissing 18), en de A-vensters/ammo-kist blijven
// ongemoeid.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Vóór koop: de opening is geblokkeerd (bestaande muur, splitsing
// van Ticket 26 zelf plus de deur4-vulling) --------------------------------
const voorKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    geblokkeerd: d.isVrijePlek(d.HALF_BREEDTE + 0.15, d.DEUR4_Z, 0.05) === false,
    obstakelAanwezig: d.obstakels.includes(d.deur4Obstakel),
    gekocht: d.deur4Gekocht,
    // Pacing-basis vóór elke aankoop: zones=1 -> effectiefSpawnInterval()
    // geeft hier exact GOLF_SPAWN_INTERVAL terug (nodig voor check 5).
    basisInterval: d.aantalOntgrendeldeZones() === 1 ? d.effectiefSpawnInterval() : null,
    basisMaxActief: d.effectiefMaxActief(),
  };
});
check('Vóór koop: deur 4-opening is geblokkeerd (ook vanuit de woonkamer)',
  voorKoop.geblokkeerd, voorKoop);
check('Vóór koop: deur4Obstakel staat geregistreerd, deur4Gekocht is false',
  voorKoop.obstakelAanwezig && voorKoop.gekocht === false, voorKoop);

// --- 1b. Bugfix-regressie: vanuit de woonkamer (altijd open, zone A) mag
// deur4Punt NOOIT binnen bereik komen — de radius (1.6) mag niet dwars
// door de 0.3m-dikke muur heen reiken. Vóór de fix stond het kooppunt op
// x ≈ 5.2 (0.7m van de muur), waardoor je 'm al vanuit (4.0, 0, 0) kon
// kopen; nu staat het op x ≈ 6.8 (2.3m marge). -----------------------------
const woonkamerBug = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(4.0, 0, 0);
  d.updateInteracties();
  return {
    huidigeInteractie: d.huidigeInteractie ? d.huidigeInteractie.naam : null,
    afstandTotDeur4Punt: Math.hypot(4.0 - d.deur4Punt.positie.x, 0 - d.deur4Punt.positie.z),
    radius: d.deur4Punt.radius,
  };
});
check('Vanuit het midden van de woonkamer (4.0, 0, 0) is "Deur 4" NIET de huidige interactie (bugfix)',
  woonkamerBug.huidigeInteractie !== 'Deur 4', woonkamerBug);
check('De afstand tot deur4Punt vanuit de woonkamer is groter dan de radius: geen reach-through-wall',
  woonkamerBug.afstandTotDeur4Punt > woonkamerBug.radius, woonkamerBug);

// --- 2. Te weinig geld: koopDeur4() doet niets ----------------------------
const teWeinig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 300;   // minder dan DEUR4_PRIJS (800)
  d.koopDeur4();
  return { gekocht: d.deur4Gekocht, geld: d.spelStaat.geld };
});
check('koopDeur4() met te weinig geld doet niets (geen aankoop, geld ongewijzigd)',
  teWeinig.gekocht === false && teWeinig.geld === 300, teWeinig);

// --- 3. Na koop: geld -800, obstakel/mesh/markering weg, opening vrij in
// BEIDE richtingen, GEEN zone-banner (alleen een gewone melding) ----------
const naKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 2000;
  document.getElementById('golfBanner').style.opacity = '0';
  document.getElementById('golfBanner').innerHTML = '';
  d.koopDeur4();
  return {
    gekocht: d.deur4Gekocht,
    geld: d.spelStaat.geld,
    obstakelWeg: !d.obstakels.includes(d.deur4Obstakel),
    meshWeg: d.deur4Mesh.parent === null,
    openingVanuitWoonkamer: d.isVrijePlek(d.HALF_BREEDTE - 0.5, d.DEUR4_Z, 0.05),
    openingVanuitBijkeuken: d.isVrijePlek(d.HALF_BREEDTE + d.MUUR_DIKTE + 0.5, d.DEUR4_Z, 0.05),
    geenZoneBanner: document.getElementById('golfBanner').innerHTML === '',
  };
});
check('Na koop: deur4Gekocht = true, €800 afgeschreven (2000 -> 1200)',
  naKoop.gekocht === true && naKoop.geld === 1200, naKoop);
check('Na koop: deur4Obstakel weg uit obstakels[], deur4Mesh weg uit de scene',
  naKoop.obstakelWeg && naKoop.meshWeg, naKoop);
check('Na koop: de opening is in BEIDE richtingen vrij beloopbaar (woonkamer <-> bijkeuken)',
  naKoop.openingVanuitWoonkamer && naKoop.openingVanuitBijkeuken, naKoop);
check('Na koop: GEEN zone-banner (deur 4 ontgrendelt geen zone, ontwerpbeslissing 18)',
  naKoop.geenZoneBanner, naKoop);

// --- 4. Dubbele koop doet niets --------------------------------------------
const dubbel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geldVoor = d.spelStaat.geld;
  d.koopDeur4();
  return { geld: d.spelStaat.geld, geldVoor };
});
check('koopDeur4() opnieuw (al gekocht) doet niets: geld blijft gelijk',
  dubbel.geld === dubbel.geldVoor, dubbel);

// --- 5. Pacing verandert NIET door deur 4 (negeert 'm bewust) -------------
const pacing = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // deur4Gekocht is hierboven al true; deur1/2/3 zijn in DEZE test nooit gekocht.
  return {
    zones: d.aantalOntgrendeldeZones(),
    interval: d.effectiefSpawnInterval(),
    maxActief: d.effectiefMaxActief(),
  };
});
check('aantalOntgrendeldeZones() blijft op 1: deur 4 telt niet mee als ontgrendelde zone',
  pacing.zones === 1, pacing);
check('Pacing (interval/plafond) is exact de basisstand: deur 4 heeft geen enkel effect',
  pacing.interval === voorKoop.basisInterval && pacing.maxActief === voorKoop.basisMaxActief, pacing);

// --- 6. De A-vensters (zuidmuur) en de ammo-kist (3, -2) blijven ongemoeid -
const risicoCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    // A-vensters staan op (-2, 4.6) en (2, 4.6) — ruim buiten het deurgat z ∈ [-1, 1].
    vensterA1: d.VENSTERS.some(v => Math.abs(v.x - (-2)) < 0.05 && Math.abs(v.z - 4.6) < 0.05 && v.zone === 'A'),
    vensterA2: d.VENSTERS.some(v => Math.abs(v.x - 2) < 0.05 && Math.abs(v.z - 4.6) < 0.05 && v.zone === 'A'),
    ammoKistVrij: d.isVrijePlek(3, -2, 0.4),
  };
});
check('De twee A-vensters (zuidmuur) staan nog exact zoals voorheen',
  risicoCheck.vensterA1 && risicoCheck.vensterA2, risicoCheck);
check('De ammo-kist-plek (3, −2) blijft vrij beloopbaar (geen nieuwe muur/obstakel in de weg)',
  risicoCheck.ammoKistVrij, risicoCheck);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
