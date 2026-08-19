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
    grachtPuntenZijnDeConstantes:
      d.ZONE_WAYPOINTS[4][0].puntBuiten === d.GRACHTGANG_DREMPEL_BUITEN &&
      d.ZONE_WAYPOINTS[4][0].puntBinnen === d.GRACHTGANG_DREMPEL_BINNEN,
    // De kelder-waypoints staan sinds de nis-tak op index 1 t/m 3; hun
    // aanlooppunten liggen aan weerszijden van KELDERTRAP_X_BOVEN/-ONDER op
    // de kokeras (KELDERTRAP_CZ).
    kelderPuntenOpDeKokeras:
      d.ZONE_WAYPOINTS[2][1].puntBuiten.z === d.KELDERTRAP_CZ &&
      d.ZONE_WAYPOINTS[2][1].puntBinnen.z === d.KELDERTRAP_CZ &&
      d.ZONE_WAYPOINTS[2][2].puntBuiten.z === d.KELDERTRAP_CZ &&
      d.ZONE_WAYPOINTS[2][2].puntBinnen.z === d.KELDERTRAP_CZ,
    kelderoostPuntenRondDeDrempel:
      d.ZONE_WAYPOINTS[2][3].puntBuiten === d.KELDEROOST_DEUR_BUITEN &&
      d.ZONE_WAYPOINTS[2][3].puntBinnen === d.KELDEROOST_DEUR_BINNEN &&
      d.ZONE_WAYPOINTS[2][3].puntBuiten.x < d.KELDEROOST_X_WEST &&
      d.ZONE_WAYPOINTS[2][3].puntBinnen.x > d.KELDEROOST_X_WEST,
    // Zelfterminatie-eis: puntBuiten ligt aantoonbaar BUITEN de deelruimte en
    // puntBinnen erbinnen. Zonder dat mikt een ondode die aankomt op de plek
    // waar hij al staat en staat hij permanent stil.
    alleAanlooppuntenAanDeJuisteKant: Object.keys(d.ZONE_WAYPOINTS).every(z =>
      d.ZONE_WAYPOINTS[z].every(wp =>
        wp.binnen(wp.puntBuiten.x, wp.puntBuiten.z) === false &&
        wp.binnen(wp.puntBinnen.x, wp.puntBinnen.z) === true)),
    // Nesting: binnen één zone is elk niveau uniek per tak, en dieper geneste
    // deelruimtes liggen volledig binnen hun ouder.
    niveausOplopend: d.ZONE_WAYPOINTS[2].map(wp => wp.niveau).join(','),
  };
});
check('ZONE_WAYPOINTS heeft precies twee zone-entries (2, atelier/kelder-trap/kelderoost; 4, bijkeuken/gracht)',
  dataset.zones.length === 2 && dataset.zones[0] === '2' && dataset.zones[1] === '4', dataset);
// Zone 2 is inmiddels een BOOM van deelruimtes: nis-tak (die het hele
// keldercomplex omvat) -> keldercomplex -> kelderruimte -> kelderoost, plus
// een aparte vlieringtak (complex -> vlak deel). Zes doorgangen in totaal.
check('Zone 2 heeft precies zes waypoints (nis, keldercomplex, kelderruimte, kelderoost, vliering, vlieringvlak)',
  dataset.zone2Lengte === 6, dataset);
check('Zone 4 heeft precies één waypoint (de gang-drempel)', dataset.zone4Lengte === 1, dataset);
check('De gracht-aanlooppunten zijn dezelfde Vector3-instanties als de constanten (hergebruikte data, geen kopie)',
  dataset.grachtPuntenZijnDeConstantes === true, dataset);
check('De kelder-trap-aanlooppunten liggen op de kokeras (KELDERTRAP_CZ)',
  dataset.kelderPuntenOpDeKokeras === true, dataset);
check('De kelderoost-aanlooppunten liggen aan weerszijden van de isKelderoost-drempel (KELDEROOST_X_WEST)',
  dataset.kelderoostPuntenRondDeDrempel === true, dataset);
check('ELK waypoint: puntBuiten ligt buiten zijn deelruimte en puntBinnen erbinnen (zelfterminatie-eis)',
  dataset.alleAanlooppuntenAanDeJuisteKant === true, dataset);
check('De zone-2-niveaus lopen op volgens de boomstructuur (nis 1, kelder 2/3/4, vliering 1/2)',
  dataset.niveausOplopend === '1,2,3,4,1,2', dataset);

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
  return { laatsteIsBestaandPunt: laatste === d.GRACHTGANG_DREMPEL_BUITEN || laatste === d.GRACHTGANG_DREMPEL_BINNEN };
});
check('1000 herhaalde lookups blijven exact hetzelfde waypoint-object teruggeven (geen allocatie per call)',
  perf.laatsteIsBestaandPunt === true, perf);

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
    // Twee posities binnen DEZELFDE deelruimte (allebei in de nis) hebben
    // geen tussenstap nodig.
    binnenDeNis: d.zoekWaypoint(2, nis, { x: d.KAMER2_NIS_CX + 1, z: d.KAMER2_NIS_CZ + 1 }),
  };
});
// De aanlooppunten liggen ±0,7 m aan weerszijden van de drempels; de checks
// hieronder toetsen daarom aan WELKE KANT van de drempel het gekozen punt
// ligt — dat is precies de oorspronkelijke bedoeling ("welke opening neemt
// hij het eerst"), los van de exacte offset.
check('nis -> kelder: eerste tussenpunt hoort bij de BOVENkant van de trap (de opening naast de nis)',
  Math.abs(kelderLookup.nisNaarKelder.x - kelderLookup.boven.x) < 1 &&
  kelderLookup.nisNaarKelder.z === kelderLookup.boven.z, kelderLookup);
check('kelder -> nis: eerste tussenpunt hoort bij de ONDERkant van de trap — ANDERS dan hierboven',
  Math.abs(kelderLookup.kelderNaarNis.x - kelderLookup.onder.x) < 1 &&
  kelderLookup.kelderNaarNis.z === kelderLookup.onder.z, kelderLookup);
check('middenin de koker -> nis: mikt op de BOVENkant (op weg naar buiten)',
  Math.abs(kelderLookup.trapNaarNis.x - kelderLookup.boven.x) < 1, kelderLookup);
check('middenin de koker -> kelder: mikt op de ONDERkant (op weg naar binnen) — bevestigt dat de koker-positie zelf geen "boven" of "onder" is',
  Math.abs(kelderLookup.trapNaarKelder.x - kelderLookup.onder.x) < 1, kelderLookup);
check('Twee posities binnen dezelfde deelruimte (allebei in de nis): geen tussenpunt nodig (null)',
  kelderLookup.binnenDeNis === null, kelderLookup);

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

// --- 9. zoekWaypoint(): de kelderoost-deur (feedback: "zombies lopen niet
// goed in de kelder", nadat kelderoost — een nieuwe kelderkamer — een DERDE
// chokepoint aan zone 2 toevoegde). isKelderoost() moet KELDERTRAP_ONDER_
// PUNT ervan weerhouden zich met kelderoost-verkeer te bemoeien (anders
// leest elke kelderoost-positie als "andere kant" dan de hoofdkelder,
// met een magneet-effect bij de trapvoet tot gevolg — zie de uitgebreide
// geschiedenis in amsterdam-undead.html / ARCHITECTURE_NOTES.md §7.6.5) ----
const kelderoostLookup = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const hoofdkelder = { x: d.KELDER_X_WEST + 3, z: (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2 };
  const trapvoet = { x: d.KELDERTRAP_X_ONDER, z: d.KELDERTRAP_CZ };
  const koCX = (d.KELDEROOST_X_WEST + d.KELDEROOST_X_OOST) / 2;
  const kelderoost = { x: koCX, z: d.KELDEROOST_CZ };
  const nis = { x: d.KAMER2_NIS_CX, z: d.KAMER2_NIS_CZ };

  const hoofdkelderNaarKelderoost = d.zoekWaypoint(2, hoofdkelder, kelderoost);
  const trapvoetNaarKelderoost = d.zoekWaypoint(2, trapvoet, kelderoost);
  const kelderoostNaarNis = d.zoekWaypoint(2, kelderoost, nis);
  // Puur hoofdkelder<->nis-verkeer (niets met kelderoost te maken) mag NIET
  // via KELDEROOST_DEUR_PUNT gerouteerd worden — dat zou een omweg zijn.
  const hoofdkelderNaarNis = d.zoekWaypoint(2, hoofdkelder, nis);
  return {
    hoofdkelderNaarKelderoost: hoofdkelderNaarKelderoost && { x: hoofdkelderNaarKelderoost.x, z: hoofdkelderNaarKelderoost.z },
    trapvoetNaarKelderoost: trapvoetNaarKelderoost && { x: trapvoetNaarKelderoost.x, z: trapvoetNaarKelderoost.z },
    kelderoostNaarNis: kelderoostNaarNis && { x: kelderoostNaarNis.x, z: kelderoostNaarNis.z },
    hoofdkelderNaarNis: hoofdkelderNaarNis && { x: hoofdkelderNaarNis.x, z: hoofdkelderNaarNis.z },
    deur: { x: d.KELDEROOST_X_WEST, z: d.KELDEROOST_CZ },
    onder: { x: d.KELDERTRAP_X_ONDER, z: d.KELDERTRAP_CZ },
    boven: { x: d.KELDERTRAP_X_BOVEN, z: d.KELDERTRAP_CZ },
  };
});
check('hoofdkelder -> kelderoost: mikt op de kelderoost-deur (niet op de trapvoet — isKelderoost-OR voorkomt dat)',
  kelderoostLookup.hoofdkelderNaarKelderoost.z === kelderoostLookup.deur.z, kelderoostLookup);
// Bijgesteld na de deelruimte-refactor: vanaf de kokermond gaat de eerste
// stap de KELDER in, niet rechtstreeks naar deur6. Dat is geen versoepeling
// maar een correctie — de rechte lijn van de kokermond naar deur6 gaat dwars
// door de massieve muur ertussen, en dat was precies de gemeten vastloper.
check('trapvoet (net de trap af) -> kelderoost: eerste stap gaat de kelder in (de muur tussen kokermond en deur6 wordt niet geclipt), niet naar zichzelf',
  kelderoostLookup.trapvoetNaarKelderoost.z === kelderoostLookup.onder.z &&
  kelderoostLookup.trapvoetNaarKelderoost.x < kelderoostLookup.onder.x, kelderoostLookup);
check('kelderoost -> nis: eerste tussenpunt hoort bij de kelderoost-deur (op weg naar buiten)',
  kelderoostLookup.kelderoostNaarNis.z === kelderoostLookup.deur.z, kelderoostLookup);
check('hoofdkelder -> nis (niets met kelderoost te maken): mikt gewoon op de trapvoet, NIET op de kelderoost-deur',
  kelderoostLookup.hoofdkelderNaarNis.z === kelderoostLookup.onder.z, kelderoostLookup);

// --- 10. Trajectory-trace: kelderoost, realistische start-/doelposities in
// BEIDE richtingen. "heen" (net de trap af, moet naar kelderoost) is het
// scenario dat twee eerdere ontwerpen (zie amsterdam-undead.html-commentaar)
// alsnog liet vastlopen — een STATISCH hub-punt gaf een pingpong tegen de
// kelderoost-deur, en een variant zonder hub clipte de muur tussen trapvoet
// en deur6. De uiteindelijke, simpelere oplossing (alleen de deur-drempel
// fixen, geen apart hub-punt) leunt op de bestaande lokale ontwijk-logica
// (dezelfde die de kelder-trap zelf al zonder waypoint kon vinden) om de
// muur te omzeilen — vandaar een ruimere tijdslimiet (30s) dan de kelder-
// trap-eigen 3s-eis in sectie 7 hierboven (die IS met een eigen waypoint
// opgelost). "terug" (vanaf de kelderoost-deur, moet naar de nis) bewaakt de
// eerste mislukte ontwerpversie (KELDEROOST_DEUR_PUNT op DEUR6_X i.p.v. de
// isKelderoost-drempel), die daar voor altijd bleef hangen. -----------------
const kelderoostTrajectHeen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  d.koopDeur5(); d.koopDeur6();
  const koCX = (d.KELDEROOST_X_WEST + d.KELDEROOST_X_OOST) / 2;
  d.speler.positie.set(koCX, -d.KELDER_DIEPTE, d.KELDEROOST_CZ);
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  // Realistisch: net de trap af (zoals na een echte nis->trap->hoofdkelder-
  // afdaling), niet kunstmatig al diep in kelderoost.
  ondode.groep.position.set(d.KELDERTRAP_X_ONDER, -d.KELDER_DIEPTE, d.KELDERTRAP_CZ);
  let tickBinnen = null;
  for (let i = 0; i < 1800 && tickBinnen === null; i++) {   // max 30s
    d.updateOndoden(1 / 60);
    if (d.isKelderoost(ondode.groep.position.x, ondode.groep.position.z)) tickBinnen = i;
  }
  return { secondenTotBinnen: tickBinnen === null ? null : +(tickBinnen / 60).toFixed(2) };
});
check('"Heen" (trapvoet -> kelderoost): bereikt kelderoost binnen 30s (nooit permanent vast, in tegenstelling tot vóór de fix)',
  kelderoostTrajectHeen.secondenTotBinnen !== null, kelderoostTrajectHeen);

const kelderoostTrajectTerug = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(d.KAMER2_NIS_CX, 0, d.KAMER2_NIS_CZ);
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  // Realistisch: vlak voorbij de deur, niet op een exacte waypoint-coördinaat.
  ondode.groep.position.set(d.KELDEROOST_X_WEST + 0.5, -d.KELDER_DIEPTE, d.KELDEROOST_CZ);
  let tickBoven = null;
  for (let i = 0; i < 1800 && tickBoven === null; i++) {   // max 30s
    d.updateOndoden(1 / 60);
    if (ondode.groep.position.x >= d.KELDERTRAP_X_BOVEN) tickBoven = i;
  }
  return { secondenTotBoven: tickBoven === null ? null : +(tickBoven / 60).toFixed(2) };
});
check('"Terug" (net voorbij de kelderoost-deur -> nis): bereikt de nis binnen 30s (vóór de fix: bleef permanent op de deur hangen)',
  kelderoostTrajectTerug.secondenTotBoven !== null, kelderoostTrajectTerug);

// --- 11. Volledige gedragsgelijkheid met vóór T65: dezelfde chokepoint-
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

// --- 12. T130: de vliering heeft sinds de tweede (noord-)trap TWEE ingangen.
// De niveau-1 waypoint-entry (index 4, "de vlieringtak") heeft nu
// `kandidaten`; doorgangPunt() moet daarvan de kandidaat kiezen wiens BUITEN-
// punt het dichtst bij de ondode ligt, in plaats van altijd trap 1 (index 0)
// te pakken. Dit dekt zowel de dataset-vorm (zelfterminatie geldt voor BEIDE
// kandidaten) als het daadwerkelijke keuzegedrag en een echte trajectory. ---
const vlieringTweeIngangen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const wp = d.ZONE_WAYPOINTS[2].find(w => w.niveau === 1 && w.kandidaten);
  const zelfterminatieBeideKandidaten = wp.kandidaten.every(k =>
    wp.binnen(k.buiten.x, k.buiten.z) === false &&
    wp.binnen(k.binnen.x, k.binnen.z) === true);

  const doelInVlak = { x: d.VLIERING_X_WEST + 2, z: d.VLIERING_Z_NOORD + 1 };
  const bijTrap1 = { x: d.VLIERINGTRAP_ONDER_BUITEN.x + 1, z: d.VLIERINGTRAP_ONDER_BUITEN.z };
  const bijTrap2 = { x: d.VLIERINGTRAP2_ONDER_BUITEN.x + 1, z: d.VLIERINGTRAP2_ONDER_BUITEN.z };
  const puntVanuitTrap1 = d.zoekWaypoint(2, bijTrap1, doelInVlak);
  const puntVanuitTrap2 = d.zoekWaypoint(2, bijTrap2, doelInVlak);

  return {
    zelfterminatieBeideKandidaten,
    kiestTrap1BijTrap1: puntVanuitTrap1 === d.VLIERINGTRAP_ONDER_BUITEN || puntVanuitTrap1 === d.VLIERINGTRAP_ONDER_BINNEN,
    kiestTrap2BijTrap2: puntVanuitTrap2 === d.VLIERINGTRAP2_ONDER_BUITEN || puntVanuitTrap2 === d.VLIERINGTRAP2_ONDER_BINNEN,
  };
});
check('Vliering-niveau-1-waypoint: zelfterminatie geldt voor beide trap-kandidaten (buiten ligt buiten, binnen erbinnen)',
  vlieringTweeIngangen.zelfterminatieBeideKandidaten === true, vlieringTweeIngangen);
check('Een ondode bij trap 1 (zuid) mikt op trap 1, niet op trap 2',
  vlieringTweeIngangen.kiestTrap1BijTrap1 === true, vlieringTweeIngangen);
check('Een ondode bij trap 2 (noord) mikt op trap 2, niet altijd op trap 1 (de kern van deze fix)',
  vlieringTweeIngangen.kiestTrap2BijTrap2 === true, vlieringTweeIngangen);

// Echte trajectory: een ondode die in het atelier vlak bij de noordtrap
// staat, met de speler op het vlakke deel van de vliering, moet daadwerkelijk
// via trap 2 naar boven lopen (i.p.v. eerst helemaal naar trap 1 om te lopen).
const trap2Traject = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(d.VLIERINGTRAP2_ONDER_BUITEN.x + 0.5, 0, d.VLIERINGTRAP2_CZ);
  const doel = { x: d.VLIERING_X_WEST + 2, z: d.VLIERING_Z_NOORD + 1 };
  d.speler.positie.set(doel.x, d.VLIERING_Y, doel.z);
  for (let i = 0; i < 900; i++) d.updateOndoden(1 / 60);   // 15s
  const afstandNa = Math.hypot(ondode.groep.position.x - doel.x, ondode.groep.position.z - doel.z);
  return { afstandNa, eindY: ondode.groep.position.y };
});
check('Trajectory-trace trap 2: een ondode vlak bij de noordtrap bereikt de speler op het vlakke deel binnen 15s',
  trap2Traject.afstandNa < 1.5, trap2Traject);
check('...en komt daadwerkelijk boven aan (y dicht bij VLIERING_Y, niet op atelierniveau blijven hangen)',
  trap2Traject.eindY > 0.9, trap2Traject);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
