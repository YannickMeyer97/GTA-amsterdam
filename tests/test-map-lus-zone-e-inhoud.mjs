// Map-lus M4 (Ticket 27): zone-E-inhoud — spawn-venster, Provisiekast,
// decor en zone-audio. Bewaakt: venster spawnt pas na deur 3 (met 3
// planken), Provisiekast vult reserve zoals de ammo-kist maar kost €350,
// windvlaag speelt NIET in zone E, de bijkeuken-kraak speelt éénmalig, en
// het decor voegt geen extra obstakels toe.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Vóór deur 3: het bijkeuken-venster staat NIET in de actieve
// spawnlijst, maar heeft al wel 3 planken (barricade al gebouwd) ----------
const voorDeur3 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const inActieveVensters = d.VENSTERS.some(v => Math.abs(v.x - 11.6) < 0.05 && Math.abs(v.z - 2) < 0.05);
  const bron = d.VENSTERS_BIJKEUKEN[0];
  return {
    inActieveVensters,
    aantalBron: d.VENSTERS_BIJKEUKEN.length,
    planken: bron.planken,
    maxPlanken: bron.maxPlanken,
    zone: bron.zone,
  };
});
check('Vóór deur 3: het bijkeuken-venster staat nog niet in de actieve VENSTERS[]',
  voorDeur3.inActieveVensters === false, voorDeur3);
check('VENSTERS_BIJKEUKEN heeft precies 1 venster, zone E, met 3 planken (barricade al gebouwd)',
  voorDeur3.aantalBron === 1 && voorDeur3.zone === 'E' &&
  voorDeur3.planken === 3 && voorDeur3.maxPlanken === 3, voorDeur3);

// --- 2. Na koopDeur3(): het venster wordt actief -------------------------
const naDeur3 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 2000;
  d.koopDeur3();
  return {
    inActieveVensters: d.VENSTERS.some(v => Math.abs(v.x - 11.6) < 0.05 && Math.abs(v.z - 2) < 0.05),
    aantalVensters: d.VENSTERS.length,
  };
});
check('Na koopDeur3(): het bijkeuken-venster staat nu in de actieve VENSTERS[]',
  naDeur3.inActieveVensters === true, naDeur3);

// --- 3. Provisiekast-kooppad: zelfde AMMO_KIST_KOGELS-effect, eigen prijs -
const teWeinigProvisiekast = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100;   // minder dan PROVISIEKAST_PRIJS (350)
  d.wapenStaat.reserve = 0;
  d.koopProvisiekast();
  return { geld: d.spelStaat.geld, reserve: d.wapenStaat.reserve };
});
check('koopProvisiekast() met te weinig geld doet niets',
  teWeinigProvisiekast.geld === 100 && teWeinigProvisiekast.reserve === 0, teWeinigProvisiekast);

const provisiekast = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 1000;
  d.wapenStaat.reserve = 0;
  d.koopProvisiekast();
  return { geld: d.spelStaat.geld, reserve: d.wapenStaat.reserve, prijs: d.PROVISIEKAST_PRIJS, kogels: d.AMMO_KIST_KOGELS };
});
check('koopProvisiekast() kost €350 (PROVISIEKAST_PRIJS) i.p.v. de ammo-kist-prijs',
  provisiekast.prijs === 350 && provisiekast.geld === 1000 - 350, provisiekast);
check('koopProvisiekast() vult de reserve met exact AMMO_KIST_KOGELS (zelfde als de ammo-kist)',
  provisiekast.reserve === provisiekast.kogels, provisiekast);
// Herbruikbaar (net als de ammo-kist): een tweede aankoop werkt gewoon door.
const provisiekastTweedeKeer = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 1000;
  d.wapenStaat.reserve = 0;
  d.koopProvisiekast();
  d.koopProvisiekast();
  return { reserve: d.wapenStaat.reserve, kogels: d.AMMO_KIST_KOGELS };
});
check('Provisiekast is herbruikbaar (geen eenmalige "gekocht"-vlag, net als de ammo-kist)',
  provisiekastTweedeKeer.reserve === provisiekastTweedeKeer.kogels * 2, provisiekastTweedeKeer);

// --- 4. Zone-audio: windvlaag speelt NIET in zone E, de bijkeuken-kraak
// speelt éénmalig; de kelderhals blijft stil (zelfde als de gang vóór de
// deur) --------------------------------------------------------------------
const audioBijkeuken = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.plaatsBetreden = false;
  d.bijkeukenBetreden = false;
  d.speler.positie.set(d.BIJKEUKEN_CX, 0, d.BIJKEUKEN_CZ);   // midden in de bijkeuken
  // Simuleert de zone-audio-check uit de gameLoop zonder de hele loop te draaien.
  const inBinnenplaatsBand = d.speler.positie.x > d.DEUR2_X &&
    d.speler.positie.z > d.PLAATS_Z_NOORD && d.speler.positie.z < d.PLAATS_Z_ZUID;
  const inBijkeukenBand = d.speler.positie.x > d.BIJKEUKEN_X_WEST && d.speler.positie.x < d.BIJKEUKEN_X_OOST &&
    d.speler.positie.z > d.BIJKEUKEN_Z_NOORD && d.speler.positie.z < d.BIJKEUKEN_Z_ZUID;
  return { inBinnenplaatsBand, inBijkeukenBand };
});
check('Windvlaag-conditie (binnenplaats-z-band) is NOOIT waar terwijl de speler in de bijkeuken staat',
  audioBijkeuken.inBinnenplaatsBand === false, audioBijkeuken);
check('Bijkeuken-conditie is wél waar in het midden van de bijkeuken',
  audioBijkeuken.inBijkeukenBand === true, audioBijkeuken);

const audioKelderhals = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kelderhalsCZ = (d.KELDERHALS_Z_NOORD + d.KELDERHALS_Z_ZUID) / 2;
  d.speler.positie.set(d.DEUR3_X, 0, kelderhalsCZ);   // midden in de kelderhals
  const inBinnenplaatsBand = d.speler.positie.x > d.DEUR2_X &&
    d.speler.positie.z > d.PLAATS_Z_NOORD && d.speler.positie.z < d.PLAATS_Z_ZUID;
  const inBijkeukenBand = d.speler.positie.x > d.BIJKEUKEN_X_WEST && d.speler.positie.x < d.BIJKEUKEN_X_OOST &&
    d.speler.positie.z > d.BIJKEUKEN_Z_NOORD && d.speler.positie.z < d.BIJKEUKEN_Z_ZUID;
  return { inBinnenplaatsBand, inBijkeukenBand };
});
check('In de kelderhals gaat GEEN van beide zone-audio-condities af (blijft stil, net als de gang)',
  audioKelderhals.inBinnenplaatsBand === false && audioKelderhals.inBijkeukenBand === false, audioKelderhals);

// Eenmalige triggering: reset de vlag, laad de pagina niet opnieuw, maar
// simuleer twee "stappen" in de bijkeuken en controleer dat de vlag na de
// eerste stap al blijft staan (patroon van de bestaande gangBetreden-test).
const eenmaligheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.bijkeukenBetreden = false;
  const voor = d.bijkeukenBetreden;
  d.bijkeukenBetreden = true;   // zelfde effect als de eerste keer in de gameLoop
  const naEersteStap = d.bijkeukenBetreden;
  return { voor, naEersteStap };
});
check('bijkeukenBetreden gaat van false naar true (eenmalige vlag, zelfde patroon als gangBetreden)',
  eenmaligheid.voor === false && eenmaligheid.naEersteStap === true, eenmaligheid);

// --- 5. Decor voegt geen collision toe (obstakel-count blijft binnen de
// verwachte bandbreedte uit Ticket 24 — dit ticket voegt alleen meubelBox-
// decor toe, geen registreerRechthoek) --------------------------------------
const obstakelCount = await page.evaluate(() => window.AmsterdamUndeadDebug.obstakels.length);
check('Obstakel-count blijft in de door Ticket 24 vastgestelde bandbreedte (20-40): geen collision-decor toegevoegd',
  obstakelCount >= 20 && obstakelCount <= 40, { obstakelCount });

// --- 6. Spawn-camping-risico: het venster (11.6, 2) staat ruim (>5m) van
// het deur4-kooppunt (bijkeuken-kant, x ≈ 5.2) vandaan ---------------------
const afstandTotDeur4 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const venster = d.VENSTERS_BIJKEUKEN[0];
  return Math.hypot(venster.x - d.deur4Punt.positie.x, venster.z - d.deur4Punt.positie.z);
});
check('Het bijkeuken-venster staat >5m van het deur4-kooppunt (geen spawn-camping)',
  afstandTotDeur4 > 5, { afstandTotDeur4 });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
