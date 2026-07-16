// Map-lus M2 (Ticket 25): koopbare deur 3 (binnenplaats -> kelderhals/
// bijkeuken). Bewaakt: vóór koop dicht, na koop open + geld afgeschreven +
// banner, dubbele koop doet niets, pacing blijft geklemd op de 3-zones-stand
// (ontwerpbeslissing 18), en de kelderdeur-spawn blijft ongemoeid.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Vóór koop: de opening is geblokkeerd (bestaande, dichte muur) -----
// Vangt meteen ook de pacing-basiswaarde: bij page-load is zones=1
// (geen enkele deur gekocht), dus effectiefSpawnInterval() geeft hier
// exact GOLF_SPAWN_INTERVAL terug (factor^0 = 1) — nodig voor check 6,
// aangezien die constante zelf niet los geëxporteerd is.
const voorKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    geblokkeerd: d.isVrijePlek(d.DEUR3_X, d.PLAATS_Z_ZUID + 0.15, 0.05) === false,
    obstakelAanwezig: d.obstakels.includes(d.deur3Obstakel),
    gekocht: d.deur3Gekocht,
    basisInterval: d.aantalOntgrendeldeZones() === 1 ? d.effectiefSpawnInterval() : null,
  };
});
check('Vóór koop: deur 3-opening is geblokkeerd', voorKoop.geblokkeerd, voorKoop);
check('Vóór koop: deur3Obstakel staat geregistreerd, deur3Gekocht is false',
  voorKoop.obstakelAanwezig && voorKoop.gekocht === false, voorKoop);

// --- 2. Te weinig geld: koopDeur3() doet niets ----------------------------
const teWeinig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 500;   // minder dan DEUR3_PRIJS (1200)
  d.koopDeur3();
  return { gekocht: d.deur3Gekocht, geld: d.spelStaat.geld };
});
check('koopDeur3() met te weinig geld doet niets (geen aankoop, geld ongewijzigd)',
  teWeinig.gekocht === false && teWeinig.geld === 500, teWeinig);

// --- 3. Na koop: geld -1200, obstakel/mesh/markering weg, deur3Punt weg,
// banner verschijnt éénmalig, en de opening is nu vrij -------------------
const naKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 2000;
  document.getElementById('golfBanner').style.opacity = '0';
  document.getElementById('golfBanner').innerHTML = '';
  d.koopDeur3();
  return {
    gekocht: d.deur3Gekocht,
    geld: d.spelStaat.geld,
    obstakelWeg: !d.obstakels.includes(d.deur3Obstakel),
    meshWeg: d.deur3Mesh.parent === null,
    puntWeg: !d.huidigeInteractie /* n.v.t., alleen ter documentatie */,
    puntUitLijst: d.deur3Punt !== undefined,   // referentie blijft bestaan (debug-export), maar...
    opening: d.isVrijePlek(d.DEUR3_X, d.PLAATS_Z_ZUID + 0.15, 0.05),
    bannerTekst: document.getElementById('golfBanner').innerHTML,
    bannerZichtbaar: document.getElementById('golfBanner').style.opacity === '1',
  };
});
check('Na koop: deur3Gekocht = true, €1200 afgeschreven (2000 -> 800)',
  naKoop.gekocht === true && naKoop.geld === 800, naKoop);
check('Na koop: deur3Obstakel weg uit obstakels[], deur3Mesh weg uit de scene',
  naKoop.obstakelWeg && naKoop.meshWeg, naKoop);
check('Na koop: de opening naar de kelderhals is nu vrij beloopbaar',
  naKoop.opening === true, naKoop);
check('Na koop: de "DE BIJKEUKEN"-banner verschijnt éénmalig',
  naKoop.bannerTekst.includes('DE BIJKEUKEN') && naKoop.bannerZichtbaar, naKoop);

// --- 4. Dubbele koop doet niets --------------------------------------------
const dubbel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geldVoor = d.spelStaat.geld;
  d.koopDeur3();
  return { geld: d.spelStaat.geld, geldVoor };
});
check('koopDeur3() opnieuw (al gekocht) doet niets: geld blijft gelijk',
  dubbel.geld === dubbel.geldVoor, dubbel);

// --- 5. deur3Punt is uit interactiePunten verwijderd ----------------------
const puntCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(d.DEUR3_X, 0, d.PLAATS_Z_ZUID - 0.7);
  d.updateInteracties();
  return { huidigeInteractie: d.huidigeInteractie ? d.huidigeInteractie.naam : null };
});
check('Op de (voormalige) deur3-positie is er geen interactiepunt meer actief',
  puntCheck.huidigeInteractie !== 'Deur 3', puntCheck);

// --- 6. Pacing blijft geklemd op de 3-zones-stand (ontwerpbeslissing 18) --
// deurGekocht/deur2Gekocht zijn read-only in de debug-export, dus de echte
// koopfuncties gebruiken (met genoeg geld) i.p.v. de state direct te zetten.
const pacing = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  d.koopDeur();
  d.koopDeur2();
  // deur3 is al gekocht (stap 3 hierboven) -> alle drie deuren open, dus 4 "zones".
  return {
    zones: d.aantalOntgrendeldeZones(),
    interval: d.effectiefSpawnInterval(),
    maxActief: d.effectiefMaxActief(),
    maxActiefBasis: d.GOLF_MAX_ACTIEF,
    zoneBonus: d.ZONE_MAX_ACTIEF_BONUS,
    intervalFactor: d.ZONE_SPAWN_INTERVAL_FACTOR,
  };
});
check('aantalOntgrendeldeZones() telt deur 3 mee: met alle drie deuren open is dat 4',
  pacing.zones === 4, pacing);
check('Plafond blijft geklemd op de 3-zones-stand: GOLF_MAX_ACTIEF + 2×ZONE_MAX_ACTIEF_BONUS = 18',
  pacing.maxActief === pacing.maxActiefBasis + 2 * pacing.zoneBonus && pacing.maxActief === 18, pacing);
check('Spawn-interval blijft geklemd op de 3-zones-stand: basisInterval × intervalFactor² (niet³, ondanks 4 "zones")',
  voorKoop.basisInterval !== null &&
  Math.abs(pacing.interval - voorKoop.basisInterval * Math.pow(pacing.intervalFactor, 2)) < 1e-9, { pacing, voorKoop });

// --- 7. De kelderdeur-spawn (20.1, -7.4) blijft ongemoeid -----------------
// VENSTERS_PLAATS is de brondefinitie (onafhankelijk van of deur2 al
// gekocht is en dus al in de live VENSTERS[] staat).
const kelderdeurSpawn = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const venster = d.VENSTERS_PLAATS.find(v => Math.abs(v.x - 20.1) < 0.05 && Math.abs(v.z - (-7.4)) < 0.05);
  return { gevonden: !!venster, zone: venster ? venster.zone : null };
});
check('De kelderdeur-spawn (20.1, −7.4) bestaat nog exact zoals voorheen (zone D)',
  kelderdeurSpawn.gevonden && kelderdeurSpawn.zone === 'D', kelderdeurSpawn);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
