// Ticket 50: zone-naambanners + HUD-zonelabel. Bewaakt: het HUD-label
// wisselt mee met zoneVan(), een banner verschijnt precies 1x per zone per
// run (bij het eerste bezoek), een herbezoek toont GEEN nieuwe banner, en er
// wordt geen per-frame DOM-write gedaan (schrijfteller i.p.v. per-frame).
// Zie ARCHITECTURE_NOTES.md §6.8 en ROADMAP.md Ticket 50.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Namen/indices kloppen: elke testpositie valt in de bedoelde zone --
const posities = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    woonkamer: d.zoneVan(0, d.DEUR_Z + 2),
    gang: d.zoneVan(0, (d.DEUR_Z + d.GANG_Z_EIND) / 2),
    atelier: d.zoneVan(0, d.GANG_Z_EIND - 2),
    binnenplaats: d.zoneVan(d.DEUR2_X + 2, d.PLAATS_Z_ZUID - 2),
    bijkeuken: d.zoneVan(d.DEUR2_X + 2, d.PLAATS_Z_ZUID + 2),
    namen: d.ZONE_NAMEN,
  };
});
check('Testposities vallen exact in de verwachte zones (0-4)',
  posities.woonkamer === 0 && posities.gang === 1 && posities.atelier === 2 &&
  posities.binnenplaats === 3 && posities.bijkeuken === 4, posities);
check("ZONE_NAMEN[0..4] = Woonkamer/Gang/Atelier/Binnenplaats/Bijkeuken (exact volgens zoneVan-indices)",
  posities.namen[0] === 'De Woonkamer' && posities.namen[1] === 'De Gang' &&
  posities.namen[2] === 'Het Atelier' && posities.namen[3] === 'De Binnenplaats' &&
  posities.namen[4] === 'De Bijkeuken', posities);

// --- 2. Bij het laden: de speler start al in zone 0, dus die is al
// "bezocht" en het label staat meteen goed (geen overbodige banner) -------
const laadTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    laatsteZone: d.laatsteZone,
    bezocht: [...d.bezochteZones],
    label: document.getElementById('zoneLabelUI').textContent,
    schrijfteller: d.zoneLabelSchrijfTeller,
  };
});
check('Bij het laden is laatsteZone al 0 en zone 0 staat al in bezochteZones',
  laadTest.laatsteZone === 0 && laadTest.bezocht.includes(0), laadTest);
check('Het HUD-label toont meteen "De Woonkamer"', laadTest.label === 'De Woonkamer', laadTest);
check('De schrijfteller staat bij het laden nog op 0 (de initiële zet gebeurt buiten de gameLoop-write-plek)',
  laadTest.schrijfteller === 0, laadTest);

// --- 3. Eerste bezoek aan de gang: label wisselt, banner verschijnt 1x ----
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.x = 0;
  d.speler.positie.z = (d.DEUR_Z + d.GANG_Z_EIND) / 2;
});
await page.waitForTimeout(150);   // echte gameLoop-tick(s)
const naGang = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    laatsteZone: d.laatsteZone,
    label: document.getElementById('zoneLabelUI').textContent,
    banner: document.getElementById('golfBanner').textContent,
    bezocht: [...d.bezochteZones],
    schrijfteller: d.zoneLabelSchrijfTeller,
  };
});
check('Na de eerste stap in de gang: laatsteZone === 1', naGang.laatsteZone === 1, naGang);
check('Het HUD-label toont nu "De Gang"', naGang.label === 'De Gang', naGang);
check('De banner noemt "De Gang" + de bijbehorende flavour-tekst',
  naGang.banner.includes('De Gang') && naGang.banner.includes('smal en donker'), naGang);
check('Zone 1 (gang) staat nu ook in bezochteZones (naast de startzone 0)',
  naGang.bezocht.includes(0) && naGang.bezocht.includes(1), naGang);
check('De schrijfteller staat na deze ene zonewissel op exact 1', naGang.schrijfteller === 1, naGang);

// --- 4. Blijven staan in dezelfde zone (meerdere echte frames): GEEN
// nieuwe write, GEEN nieuwe banner (source-of-truth: de teller) -----------
await page.waitForTimeout(300);   // meerdere echte gameLoop-ticks, positie ongewijzigd
const stilstaand = await page.evaluate(() => ({
  schrijfteller: window.AmsterdamUndeadDebug.zoneLabelSchrijfTeller,
  label: document.getElementById('zoneLabelUI').textContent,
}));
check('Na meerdere frames stilstaand in dezelfde zone blijft de schrijfteller op 1 (geen per-frame writes)',
  stilstaand.schrijfteller === 1, stilstaand);
check('Het label blijft "De Gang"', stilstaand.label === 'De Gang', stilstaand);

// --- 5. Naar het atelier (nieuwe zone, nieuwe banner) ----------------------
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.z = d.GANG_Z_EIND - 2;
});
await page.waitForTimeout(150);
const naAtelier = await page.evaluate(() => ({
  laatsteZone: window.AmsterdamUndeadDebug.laatsteZone,
  label: document.getElementById('zoneLabelUI').textContent,
  bannerHtml: document.getElementById('golfBanner').innerHTML,
  schrijfteller: window.AmsterdamUndeadDebug.zoneLabelSchrijfTeller,
}));
check('Na de stap naar het atelier: laatsteZone === 2, label "Het Atelier"',
  naAtelier.laatsteZone === 2 && naAtelier.label === 'Het Atelier', naAtelier);
check('De banner-inhoud is nu die van het atelier', naAtelier.bannerHtml.includes('Het Atelier'), naAtelier);
check('De schrijfteller staat nu op 2 (tweede echte zonewissel)', naAtelier.schrijfteller === 2, naAtelier);

// --- 6. Terug naar de gang (HERBEZOEK): label wisselt weer mee, MAAR er
// verschijnt GEEN nieuwe banner (de banner-inhoud blijft die van het atelier,
// er wordt geen toonGolfBanner() voor de gang aangeroepen) -----------------
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.z = (d.DEUR_Z + d.GANG_Z_EIND) / 2;
});
await page.waitForTimeout(150);
const herbezoek = await page.evaluate(() => ({
  laatsteZone: window.AmsterdamUndeadDebug.laatsteZone,
  label: document.getElementById('zoneLabelUI').textContent,
  bannerHtml: document.getElementById('golfBanner').innerHTML,
  schrijfteller: window.AmsterdamUndeadDebug.zoneLabelSchrijfTeller,
}));
check('Bij het herbezoek van de gang wisselt het label WEL mee (laatsteZone === 1, label "De Gang")',
  herbezoek.laatsteZone === 1 && herbezoek.label === 'De Gang', herbezoek);
check('De schrijfteller telt de labelwissel wél mee (nu op 3) — het label volgt zoneVan(), los van bezochteZones',
  herbezoek.schrijfteller === 3, herbezoek);
check('De banner-INHOUD is ongewijzigd gebleven (nog steeds "Het Atelier") — geen nieuwe banner voor een herbezoek',
  herbezoek.bannerHtml.includes('Het Atelier') && !herbezoek.bannerHtml.includes('De Gang'), herbezoek);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
