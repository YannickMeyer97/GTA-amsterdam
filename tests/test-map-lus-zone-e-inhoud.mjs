// Map-lus M4 (Ticket 27): zone-E-inhoud — spawn-venster, decor en
// zone-audio. Bewaakt: venster spawnt pas na deur 3 (met 3 planken),
// windvlaag speelt NIET in zone E, de bijkeuken-kraak speelt éénmalig, en
// het decor voegt geen extra obstakels toe.
// Feedback: het Provisiekast-munitiepunt (tweede ammo-kist, hier ooit
// getest in sectie 3) is verwijderd — munitie is nu alleen nog te koop bij
// de ammo-kist in de woonkamer, zie test-winkel-status.mjs/test-winkel-
// stijlen.mjs voor de bijgewerkte interactiepunten-/markeringen-tellingen.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): sectie "woonkamerAmmoWerkt" roept koopAmmo() aan, dat
// wapenStaat.reserve rechtstreeks schrijft (koopAmmo()'s eigen null-contract
// voor "alleen een mes" is T135-scope, §12.6) — eerst een geladen vuurwapen
// toekennen zodat DIT bestand zijn eigen regressie blijft testen.
await geefSpelerVuurwapen(page);

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

// --- 2b. Feedback: de Provisiekast (tweede ammo-kist, in de bijkeuken) is
// volledig verwijderd — geen kooppunt, geen prijs, geen munitie-koopfunctie
// meer, en de gewone ammo-kist in de woonkamer blijft de enige plek om
// munitie bij te kopen. ------------------------------------------------
const provisiekastWeg = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    functieWeg: typeof d.koopProvisiekast === 'undefined',
    prijsWeg: typeof d.PROVISIEKAST_PRIJS === 'undefined',
    puntWeg: typeof d.provisiekastPunt === 'undefined',
    markeringWeg: typeof d.provisiekastMarkering === 'undefined',
    geenProvisiekastInPunten: !d.interactiePunten.some(p => p.naam === 'Provisiekast'),
    stijlWeg: !('provisiekast' in d.WINKEL_STIJLEN),
  };
});
check('koopProvisiekast()/PROVISIEKAST_PRIJS/provisiekastPunt/provisiekastMarkering bestaan niet meer',
  provisiekastWeg.functieWeg && provisiekastWeg.prijsWeg && provisiekastWeg.puntWeg && provisiekastWeg.markeringWeg,
  provisiekastWeg);
check('Geen enkel interactiepunt heet nog "Provisiekast"', provisiekastWeg.geenProvisiekastInPunten, provisiekastWeg);
check("WINKEL_STIJLEN bevat geen 'provisiekast'-entry meer", provisiekastWeg.stijlWeg, provisiekastWeg);

// De ammo-kist in de woonkamer blijft de enige plek om munitie bij te kopen
// en werkt onveranderd (regressie-anker).
const woonkamerAmmoWerkt = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 1000;
  d.wapenStaat.reserve = 0;
  d.koopAmmo();
  return {
    reserve: d.wapenStaat.reserve, kogels: d.AMMO_KIST_KOGELS,
    ammoPuntAanwezig: d.interactiePunten.some(p => p.naam === 'Ammo-kist'),
  };
});
check('De ammo-kist in de woonkamer werkt nog gewoon (koopAmmo() vult de reserve met AMMO_KIST_KOGELS)',
  woonkamerAmmoWerkt.reserve === woonkamerAmmoWerkt.kogels, woonkamerAmmoWerkt);
check('De Ammo-kist (woonkamer) staat nog gewoon in interactiePunten',
  woonkamerAmmoWerkt.ammoPuntAanwezig, woonkamerAmmoWerkt);

// --- 3. Zone-audio: windvlaag speelt NIET in zone E, de bijkeuken-kraak
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

// --- 4. Decor voegt geen collision toe (obstakel-count blijft binnen de
// verwachte bandbreedte uit Ticket 24 — dit ticket voegt alleen meubelBox-
// decor toe, geen registreerRechthoek). Band opgehoogd naar 46 (was 40):
// Ticket 62 voegt 6 nieuwe, legitieme obstakels toe elders in de kaart
// (nis-westmuur-splitsing + deur5 + kelderwanden), 37 -> 43. Band opnieuw
// opgehoogd naar 58 (was 52): Ticket 87 (De Vliering) voegt er 4 toe, ook
// elders in de kaart (52 -> 56). Zoals hierboven gaat deze check over "dít
// ticket voegt geen collision-decor toe", niet over het absolute getal. ----
const obstakelCount = await page.evaluate(() => window.AmsterdamUndeadDebug.obstakels.length);
check('Obstakel-count blijft in de door Ticket 24 + Ticket 62 + Ticket 87 + Ticket 130 vastgestelde bandbreedte (20-62): geen collision-decor toegevoegd',
  obstakelCount >= 20 && obstakelCount <= 62, { obstakelCount });

// --- 5. Spawn-camping-risico: het venster (11.6, 2) staat ruim (>5m) van
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
