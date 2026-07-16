// Map-lus M6 (Ticket 29): balans + eindregressie van de complete lus.
// Bewaakt: (1) pacing-plafond blijft 18 zodra alle 4 deuren gekocht zijn
// (aantalOntgrendeldeZones() == 4, maar de clamp houdt interval/max exact op
// de 3-zones-waarden, ontwerpbeslissing 18), (2) op golf 8+ vinden ondoden de
// speler in BEIDE looprichtingen (vooruit A->D via B/C, achteruit A->E->D via
// de terugdeur) — de kelderhals-plug (smalle doorgang, zone-graaf) blokkeert
// niets, (3) de deur3+deur4-economie (€2000 samen) past exact tussen deur 2
// (€1000) en de Smederij (2x€3000) zoals ARCHITECTURE_NOTES §4.8 voorschrijft.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Pacing-plafond: met alle 4 deuren gekocht (4 zones, deur 4 telt
// bewust niet mee maar is hier ook gekocht om de complete lus te simuleren)
// blijven interval/max EXACT de 3-zones-waarden (Math.min(zones,3)-clamp) --
const pacing = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Baseline: 3 zones (deur1+deur2), vóór deur3/4.
  d.spelStaat.geld = 10000;
  d.koopDeur();
  d.koopDeur2();
  const drieZones = { zones: d.aantalOntgrendeldeZones(), interval: d.effectiefSpawnInterval(), max: d.effectiefMaxActief() };
  // Volledige lus: + deur3 + deur4.
  d.koopDeur3();
  d.koopDeur4();
  const vierZones = { zones: d.aantalOntgrendeldeZones(), interval: d.effectiefSpawnInterval(), max: d.effectiefMaxActief() };
  return { drieZones, vierZones };
});
check('Vóór deur 3/4: aantalOntgrendeldeZones() == 3',
  pacing.drieZones.zones === 3, pacing);
check('Na de complete lus (alle 4 deuren): aantalOntgrendeldeZones() == 4 (deur 4 telt bewust niet mee, dus 1+1+1+1 deuren maar deur1/2/3 tellen)',
  pacing.vierZones.zones === 4, pacing);
check('Pacing-plafond ongewijzigd: effectiefSpawnInterval() met 4 zones == de 3-zones-waarde (clamp houdt stand)',
  pacing.vierZones.interval === pacing.drieZones.interval, pacing);
check('Pacing-plafond ongewijzigd: effectiefMaxActief() met 4 zones == de 3-zones-waarde (clamp houdt stand, plafond blijft 18)',
  pacing.vierZones.max === pacing.drieZones.max, pacing);

// --- 2. Economie: deur3 (€1200) + deur4 (€800) = €2000, past tussen deur2
// (€1000) en de Smederij (2x€3000 = €6000) ----------------------------------
const economie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    deur2: d.DEUR2_PRIJS, lusSamen: d.DEUR3_PRIJS + d.DEUR4_PRIJS, smederijTotaal: d.SMEDERIJ_PRIJS * 2,
  };
});
check('Deur3+deur4 samen (€2000) ligt strikt tussen deur2 (€1000) en 2x de Smederij (€6000) — mid-game aankoop, geen nieuwe eind-sink',
  economie.deur2 < economie.lusSamen && economie.lusSamen < economie.smederijTotaal, economie);

// --- 3. Reachability op golf 8+, BEIDE looprichtingen, met de volledige lus
// open. "Vooruit": ondode in binnenplaats (D), speler in de woonkamer (A) --
const golf8Vooruit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 8;
  d.speler.positie.set(0, 0, 0);   // woonkamer
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(10, 0, -15.5);   // midden binnenplaats (D)
  const afstandVoor = Math.hypot(ondode.groep.position.x - 0, ondode.groep.position.z - 0);
  for (let i = 0; i < 180; i++) d.updateOndoden(1 / 60);   // 3s gesimuleerd
  const afstandNa = Math.hypot(ondode.groep.position.x - 0, ondode.groep.position.z - 0);
  return { afstandVoor, afstandNa, hp: ondode.hp };
});
check('Golf 8+, richting "vooruit" (D -> A): de ondode komt merkbaar dichter bij de speler in de woonkamer',
  golf8Vooruit.afstandNa < golf8Vooruit.afstandVoor - 1, golf8Vooruit);

// "Achteruit": ondode in de bijkeuken/kelderhals (E), speler in de woonkamer
// (A) — moet via de smalle kelderhals + de terugdeur (kortste kant) komen.
const golf8Achteruit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 8;
  d.speler.positie.set(0, 0, 0);   // woonkamer
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(d.DEUR3_X, 0, (d.KELDERHALS_Z_NOORD + d.KELDERHALS_Z_ZUID) / 2);   // midden kelderhals
  const afstandVoor = Math.hypot(ondode.groep.position.x - 0, ondode.groep.position.z - 0);
  for (let i = 0; i < 180; i++) d.updateOndoden(1 / 60);
  const afstandNa = Math.hypot(ondode.groep.position.x - 0, ondode.groep.position.z - 0);
  // De kelderhals-plug (smalle doorgang) mag de ondode niet vastzetten: hij
  // moet minstens de kelderhals uit richting de bijkeuken/terugdeur komen.
  const uitDeKelderhals = ondode.groep.position.z > d.KELDERHALS_Z_ZUID - 0.5;
  return { afstandVoor, afstandNa, uitDeKelderhals };
});
check('Golf 8+, richting "achteruit" (E -> A via de kelderhals + terugdeur): de ondode komt merkbaar dichter bij de speler',
  golf8Achteruit.afstandNa < golf8Achteruit.afstandVoor - 1, golf8Achteruit);
check('De smalle kelderhals-plug blokkeert de ondode niet volledig: hij komt er binnen 3s uit',
  golf8Achteruit.uitDeKelderhals, golf8Achteruit);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
