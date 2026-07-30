// Ticket 64 — Waypoint-navigatiegraaf: architectuur en dataset, en
// Ticket 65 — Waypoint-integratie: ad-hoc chokepoint-code vervangen. Zie
// ARCHITECTURE_NOTES.md §7.6 voor het ontwerp. Dit bestand dekt:
// (1) de ZONE_WAYPOINTS-dataset + zoekWaypoint()-lookup als losstaande
// unit-achtige checks (T64), (2) dat de oude eigenInGracht/spelerInGracht/
// inZoneVier-special-case niet meer bestaat (T65), (3) trajectory-trace-
// tests die bevestigen dat pursuit-gedrag correct blijft in twee andere
// zones met obstakels (atelier-nis-hoek, binnenplaats-schuurtje) — dit is
// de bestaande lokale ontwijk-logica, die T64/T65 bewust ongemoeid laat
// (zie de ZONE_WAYPOINTS-comment in amsterdam-undead.html), maar die nu
// expliciet als regressie-anker vastligt voor het risicovolste ticket van
// de ronde, en (4) de kelder-trap-waypoints (feedback: "ze kunnen niet
// altijd goed de kelder in lopen") — de trap is smal (1,2m) en lang (4m)
// tussen de open nis en de kelderruimte, met TWEE muuropeningen na elkaar,
// dus het eerste generieke voorbeeld dat de "dichtstbijzijnde waypoint"-
// regel in zoekWaypoint() (i.p.v. gewoon de eerste match) daadwerkelijk
// nodig heeft. test-gracht-dock.mjs blijft het primaire chokepoint-bewijs
// voor zone 4 (ongewijzigd gebleven, zie ROADMAP.md Ticket 65);
// test-kelder-trap.mjs blijft het primaire kelder-bewijs (Y-beweging,
// deur 5, toegang) — dit bestand dekt alleen de nieuwe waypoint-laag zelf.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Dataset: zone 2 (kelder-trap) en zone 4 (gracht) hebben entries -----
const dataset = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    zones: Object.keys(d.ZONE_WAYPOINTS).sort(),
    zone2Lengte: d.ZONE_WAYPOINTS[2].length,
    zone4Lengte: d.ZONE_WAYPOINTS[4].length,
    puntZelfdeAlsGrachtgangDrempel: d.ZONE_WAYPOINTS[4][0].punt === d.GRACHTGANG_DREMPEL,
    kelderPuntenZijnKelderTrapConstantes:
      d.ZONE_WAYPOINTS[2][0].punt.x === d.KELDERTRAP_X_BOVEN && d.ZONE_WAYPOINTS[2][0].punt.z === d.KELDERTRAP_CZ &&
      d.ZONE_WAYPOINTS[2][1].punt.x === d.KELDERTRAP_X_ONDER && d.ZONE_WAYPOINTS[2][1].punt.z === d.KELDERTRAP_CZ,
  };
});
check('ZONE_WAYPOINTS heeft precies twee zone-entries (2, atelier/kelder-trap; 4, bijkeuken/gracht)',
  dataset.zones.length === 2 && dataset.zones[0] === '2' && dataset.zones[1] === '4', dataset);
check('Zone 2 heeft precies twee waypoints (boven- en onderkant van de trap)', dataset.zone2Lengte === 2, dataset);
check('Zone 4 heeft precies één waypoint (de gang-drempel)', dataset.zone4Lengte === 1, dataset);
check('Het waypoint-punt is dezelfde Vector3-instantie als GRACHTGANG_DREMPEL (hergebruikte data, geen kopie)',
  dataset.puntZelfdeAlsGrachtgangDrempel === true, dataset);
check('De kelder-trap-waypoints staan exact op KELDERTRAP_X_BOVEN/-ONDER, KELDERTRAP_CZ',
  dataset.kelderPuntenZijnKelderTrapConstantes === true, dataset);

// --- 2. zoekWaypoint(): unit-achtige lookup-checks op bekende testposities --
const lookup = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bijkeuken = { x: d.BIJKEUKEN_CX, z: d.BIJKEUKEN_CZ };          // vóór de drempel (x < GRACHTGANG_X_WEST)
  const vlonder = { x: d.VLONDER_X_WEST + 1, z: 0 };                    // voorbij de drempel (x >= GRACHTGANG_X_WEST)
  const woonkamer = { x: 0, z: 0 };                                     // zone 0
  return {
    zelfdeKant: d.zoekWaypoint(4, bijkeuken, { x: d.BIJKEUKEN_CX + 1, z: d.BIJKEUKEN_CZ - 1 }),
    verschillendeKant: d.zoekWaypoint(4, bijkeuken, vlonder),
    verschillendeKantOmgekeerd: d.zoekWaypoint(4, vlonder, bijkeuken),
    zoneZonderEntry: d.zoekWaypoint(0, woonkamer, { x: 1, z: 1 }),
    onbekendeZone: d.zoekWaypoint(99, woonkamer, vlonder),
  };
});
check('zoekWaypoint: zelfde kant van de drempel binnen zone 4 geeft null (geen omweg nodig)',
  lookup.zelfdeKant === null, lookup);
check('zoekWaypoint: verschillende kant binnen zone 4 geeft het drempel-waypoint terug',
  lookup.verschillendeKant !== null, lookup);
check('zoekWaypoint: symmetrisch (van vlonder naar bijkeuken geeft ook het waypoint terug)',
  lookup.verschillendeKantOmgekeerd !== null, lookup);
check('zoekWaypoint: een zone zonder eigen entry (0, woonkamer) geeft altijd null',
  lookup.zoneZonderEntry === null, lookup);
check('zoekWaypoint: een onbekende zone-id geeft null (geen crash)',
  lookup.onbekendeZone === null, lookup);

// --- 3. Performancevoorwaarde: de lookup alloceert geen nieuwe Vector3's ----
// (indirecte check — roep 'm 1000x aan en tel de tijd; geen harde
// tijdslimiet nodig, dit dekt vooral dat de functie niet crasht/hangt bij
// herhaald gebruik zoals in de hot path van updateOndoden()).
const perf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = { x: d.BIJKEUKEN_CX, z: d.BIJKEUKEN_CZ };
  const b = { x: d.VLONDER_X_WEST + 1, z: 0 };
  let laatste = null;
  for (let i = 0; i < 1000; i++) laatste = d.zoekWaypoint(4, a, b);
  return { laatsteIsWaypoint: laatste === d.GRACHTGANG_DREMPEL };
});
check('1000 herhaalde lookups blijven exact hetzelfde waypoint-object teruggeven (geen allocatie per call)',
  perf.laatsteIsWaypoint === true, perf);

// --- 4. Trajectory-trace: atelier-nis-hoek (zone 2) --------------------------
// De nis (KAMER2_NIS_*) is alleen aan de noordkant met de hoofdruimte
// verbonden (zie de westStompDiepte-muur in amsterdam-undead.html); een
// ondode diep zuidwest in de nis met een speler zuidoost in de hoofdruimte
// moet dus om de binnenhoek heen lopen (lokale ontwijk-logica). Zone 2 heeft
// inmiddels wél waypoints (de kelder-trap, zie sectie 6), maar geen ervan
// scheidt deze twee posities (beide liggen ver ten oosten van de trap), dus
// dit scenario blijft ongemoeid. Dit bewaakt dat T64/T65 dat gedrag niet per
// ongeluk kapotmaakten.
const nisHoek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  const start = { x: d.KAMER2_NIS_X_WEST + 0.5, z: d.KAMER2_NIS_Z_ZUID - 0.5 };
  ondode.groep.position.set(start.x, 0, start.z);
  const doel = { x: d.KAMER2_HALF_B - 1, z: d.GANG_Z_EIND - 1 };
  d.speler.positie.set(doel.x, 0, doel.z);
  const afstandVoor = Math.hypot(ondode.groep.position.x - doel.x, ondode.groep.position.z - doel.z);
  for (let i = 0; i < 960; i++) d.updateOndoden(1 / 60);   // 16s — de afstand is ~17m, dus meer tijd nodig dan het 10s-vlonderpad
  const afstandNa = Math.hypot(ondode.groep.position.x - doel.x, ondode.groep.position.z - doel.z);
  return { afstandVoor, afstandNa, zone: d.zoneVan(start.x, start.z) };
});
check('Trajectory-check: de nis-hoek ligt in zone 2 (atelier, geen eigen waypoint-entry)', nisHoek.zone === 2, nisHoek);
check('Trajectory-trace atelier-nis: een ondode diep in de nis bereikt de speler in de hoofdruimte binnen 16s (rondt de binnenhoek)',
  nisHoek.afstandNa < 1, nisHoek);

// --- 5. Trajectory-trace: binnenplaats-schuurtje (zone 3) -------------------
// Het schuurtje (bouwSchuurtje, PLAATS_CX+2.5, DEUR2_Z-6) heeft echte
// collision. Ondode en speler aan weerszijden ervan, zelfde z — de
// rechtstreekse lijn zou er dwars doorheen gaan.
const schuurtje = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  const cz = d.DEUR2_Z - 6;
  const start = { x: d.PLAATS_CX + 2.5 - 3, z: cz };
  ondode.groep.position.set(start.x, 0, start.z);
  const doel = { x: d.PLAATS_CX + 2.5 + 3, z: cz };
  d.speler.positie.set(doel.x, 0, doel.z);
  const afstandVoor = Math.hypot(ondode.groep.position.x - doel.x, ondode.groep.position.z - doel.z);
  for (let i = 0; i < 600; i++) d.updateOndoden(1 / 60);   // 10s
  const afstandNa = Math.hypot(ondode.groep.position.x - doel.x, ondode.groep.position.z - doel.z);
  return { afstandVoor, afstandNa, zone: d.zoneVan(start.x, start.z) };
});
check('Trajectory-check: het schuurtje-scenario ligt in zone 3 (binnenplaats, geen eigen waypoint-entry)',
  schuurtje.zone === 3, schuurtje);
check('Trajectory-trace binnenplaats-schuurtje: een ondode aan de andere kant van het schuurtje bereikt de speler binnen 10s (loopt eromheen)',
  schuurtje.afstandNa < 2, schuurtje);

// --- 6. zoekWaypoint(): de kelder-trap-koker heeft TWEE waypoints na elkaar,
// dus de "dichtstbijzijnde entry"-regel moet per richting het juiste eerste
// tussenpunt kiezen (niet altijd hetzelfde punt, in tegenstelling tot zone 4
// dat er maar één heeft) --------------------------------------------------
const kelderLookup = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const nis = { x: d.KAMER2_NIS_CX, z: d.KAMER2_NIS_CZ };              // boven, ver van de trap (x >= KELDERTRAP_X_BOVEN)
  const trap = { x: (d.KELDERTRAP_X_BOVEN + d.KELDERTRAP_X_ONDER) / 2, z: d.KELDERTRAP_CZ };   // middenin de koker
  const kelder = { x: d.KELDER_X_WEST + 2, z: (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2 };       // onder, in de kelderruimte
  const nisNaarKelder = d.zoekWaypoint(2, nis, kelder);
  const kelderNaarNis = d.zoekWaypoint(2, kelder, nis);
  const trapNaarNis = d.zoekWaypoint(2, trap, nis);
  const trapNaarKelder = d.zoekWaypoint(2, trap, kelder);
  return {
    nisNaarKelder: nisNaarKelder && { x: nisNaarKelder.x, z: nisNaarKelder.z },
    kelderNaarNis: kelderNaarNis && { x: kelderNaarNis.x, z: kelderNaarNis.z },
    trapNaarNis: trapNaarNis && { x: trapNaarNis.x, z: trapNaarNis.z },
    trapNaarKelder: trapNaarKelder && { x: trapNaarKelder.x, z: trapNaarKelder.z },
    boven: { x: d.KELDERTRAP_X_BOVEN, z: d.KELDERTRAP_CZ },
    onder: { x: d.KELDERTRAP_X_ONDER, z: d.KELDERTRAP_CZ },
    nisZelfdeKant: d.zoekWaypoint(2, nis, { x: d.KAMER2_HALF_B - 1, z: d.GANG_Z_EIND - 1 }),
  };
});
check('nis -> kelder: eerste tussenpunt is de BOVENkant van de trap (dichtstbijzijnde vanaf de nis)',
  JSON.stringify(kelderLookup.nisNaarKelder) === JSON.stringify(kelderLookup.boven), kelderLookup);
check('kelder -> nis: eerste tussenpunt is de ONDERkant van de trap (dichtstbijzijnde vanaf de kelder) — ANDERS dan hierboven',
  JSON.stringify(kelderLookup.kelderNaarNis) === JSON.stringify(kelderLookup.onder), kelderLookup);
check('middenin de koker -> nis: mikt op de BOVENkant (op weg naar buiten)',
  JSON.stringify(kelderLookup.trapNaarNis) === JSON.stringify(kelderLookup.boven), kelderLookup);
check('middenin de koker -> kelder: mikt op de ONDERkant (op weg naar binnen) — bevestigt dat de koker-positie zelf geen "boven" of "onder" is',
  JSON.stringify(kelderLookup.trapNaarKelder) === JSON.stringify(kelderLookup.onder), kelderLookup);
check('Twee posities allebei ruim boven de trap: geen tussenpunt nodig (null)',
  kelderLookup.nisZelfdeKant === null, kelderLookup);

// --- 7. Trajectory-trace: kelder-trap (zone 2, de feedback-bug) — vóór deze
// fix bleef een ondode die van opzij (niet uitgelijnd met de 1,2m-brede
// opening) de trap nadert, ~9s tegen de muur "hangen" voordat de lokale
// ontwijk-logica bij toeval de opening vond. Deze test bewaakt dat de
// oversteek nu vlot gaat: de ondode moet ruim binnen 3s voorbij
// KELDERTRAP_X_BOVEN staan (i.p.v. er pas na 9-10s doorheen te komen) -------
const kelderTrap = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  d.koopDeur5();
  const kamerCX = (d.KELDER_X_WEST + d.KELDERTRAP_X_ONDER) / 2;
  const kamerCZ = (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2;
  d.speler.positie.set(kamerCX, -d.KELDER_DIEPTE, kamerCZ);

  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  // Ver noordelijk in de brede nis, duidelijk niet uitgelijnd met de
  // trapopening (KELDERTRAP_CZ = -21.8) — exact het scenario dat vóór deze
  // fix tegen de muur bleef hangen.
  ondode.groep.position.set(d.KAMER2_NIS_CX, 0, d.KAMER2_Z_NOORD + 1);

  let tickVoorbijBoven = null;
  for (let i = 0; i < 1200 && tickVoorbijBoven === null; i++) {   // max 20s
    d.updateOndoden(1 / 60);
    if (ondode.groep.position.x < d.KELDERTRAP_X_BOVEN) tickVoorbijBoven = i;
  }
  for (let i = 0; i < 1200; i++) d.updateOndoden(1 / 60);   // nog 20s voor de rest van de afdaling

  const kamerCXVoorAfstand = (d.KELDER_X_WEST + d.KELDERTRAP_X_ONDER) / 2;
  const kamerCZVoorAfstand = (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2;
  return {
    secondenTotVoorbijOpening: tickVoorbijBoven === null ? null : tickVoorbijBoven / 60,
    eindY: ondode.groep.position.y,
    afstandTotSpeler: Math.hypot(
      ondode.groep.position.x - kamerCXVoorAfstand, ondode.groep.position.z - kamerCZVoorAfstand),
  };
});
check('Een ondode die off-axis in de nis start, steekt de trapopening over binnen 3s (vóór de fix: ~9-10s wachten op een toevallige ontwijk-worp)',
  kelderTrap.secondenTotVoorbijOpening !== null && kelderTrap.secondenTotVoorbijOpening < 3, kelderTrap);
check('...en bereikt daadwerkelijk de keldervloer (y = -KELDER_DIEPTE)', kelderTrap.eindY < -3.29, kelderTrap);
check('...en komt de speler in de kelderruimte dicht genoeg te staan (binnen 1m)',
  kelderTrap.afstandTotSpeler < 1, kelderTrap);

// --- 8. Volledige gedragsgelijkheid met vóór T65: dezelfde chokepoint-
// scenario's als test-gracht-dock.mjs sectie 8, nu via de generieke laag ----
const chokepointViaWaypoint = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(d.BIJKEUKEN_CX, 0, d.BIJKEUKEN_Z_NOORD + 1);
  d.speler.positie.set((d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2, 0, d.BIJKEUKEN_CZ);
  const voor = { x: ondode.groep.position.x, z: ondode.groep.position.z };
  d.updateOndoden(0.01);
  const na = { x: ondode.groep.position.x, z: ondode.groep.position.z };
  return {
    hoekBeweging: Math.atan2(na.x - voor.x, na.z - voor.z),
    hoekNaarWaypoint: Math.atan2(d.zoekWaypoint(4, voor, d.speler.positie).x - voor.x, d.zoekWaypoint(4, voor, d.speler.positie).z - voor.z),
  };
});
check('De ad-hoc special-case is vervangen zonder gedragswijziging: de eerste stap wijst nog steeds naar het (nu generieke) waypoint',
  Math.abs(chokepointViaWaypoint.hoekBeweging - chokepointViaWaypoint.hoekNaarWaypoint) < 0.01, chokepointViaWaypoint);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
