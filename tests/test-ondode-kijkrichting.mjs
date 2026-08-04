// Ticket 73 (v0.20, §8.5.1): de kijkrichting van een ondode volgt sinds dit
// ticket zijn daadwerkelijke looprichting (incl. ontwijk-blend) i.p.v.
// onvoorwaardelijk de speler — bij cross-zone-pathing langs een deur/
// waypoint liep dat structureel op tot ~90° mismatch (de ondode staarde de
// speler zichtbaar door een muur heen aan terwijl hij zijwaarts liep).
// Valkuil uit het Testplan: `deurGekocht = true` rechtstreeks zetten
// herbouwt NAV_VOLGENDE NIET (levert een vals-negatief op, geen echt
// cross-zone-navigatiedoel) — daarom hier altijd de echte koopDeur().
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Cross-zone-pathing: bewegingshoek vs. kijkhoek ----------------------
const hoekTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spelStaat.geld = d.DEUR_PRIJS;
  d.koopDeur();   // echte aankoop: herbouwt NAV_VOLGENDE via koopDeur() zelf
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(3, 0, 3);          // woonkamer (zone 0)
  ondode.groep.rotation.y = 0;
  d.speler.positie.set(0, 0, d.KAMER2_Z_NOORD + 1);   // atelier (zone 2) — hetzelfde scenario als de nulmeting
  const zoneOndode = d.zoneVan(ondode.groep.position.x, ondode.groep.position.z);
  const zoneSpeler = d.zoneVan(d.speler.positie.x, d.speler.positie.z);

  const verschillen = [];
  for (let i = 0; i < 120; i++) {
    const voorX = ondode.groep.position.x, voorZ = ondode.groep.position.z;
    d.updateOndoden(1 / 60);
    const dx = ondode.groep.position.x - voorX, dz = ondode.groep.position.z - voorZ;
    if (Math.hypot(dx, dz) > 1e-5) {   // sla stilstaande frames over (geen bewegingshoek gedefinieerd)
      const bewegingsHoek = Math.atan2(dx, dz);
      const kijkHoek = ondode.groep.rotation.y;
      verschillen.push(Math.abs(d.kortsteHoekVerschil(bewegingsHoek, kijkHoek)) * 180 / Math.PI);
    }
  }
  return { verschillen, laatste10: verschillen.slice(-10), zoneOndode, zoneSpeler };
});
check('Testopzet: ondode start in zone 0 (woonkamer), speler in zone 2 (atelier) — een echt cross-zone-scenario',
  hoekTest.zoneOndode === 0 && hoekTest.zoneSpeler === 2, hoekTest);
check('Na settelen (laatste 10 gemeten bewegingsstappen) is het verschil tussen bewegingshoek en kijkhoek < 15° (was 10,5°, groeiend tot ~90° rond haakse waypoints)',
  hoekTest.laatste10.length > 0 && hoekTest.laatste10.every(v => v < 15), hoekTest);

// --- 2. Windup: kijkrichting blijft (met de bestaande, beperkte
// AANVAL_DRAAI_SNELHEID-bijdraai) naar de speler wijzen, ONGEACHT de
// looprichting-logica hierboven — dat pad wordt door dit ticket niet geraakt.
const windupTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.speler.positie.set(0, 0, 0);
  d.spawnWillekeurigeOndode();
  const o = d.ondoden[0];
  o.groep.position.set(0.3, 0, -1.0);   // binnen AANVAL_START_BEREIK (1.4), niet recht vooruit
  o.groep.rotation.y = Math.PI;         // startoriëntatie expres fout, om de bijdraai te bewijzen
  o.aanvalVertraging = 0;
  d.updateOndoden(1 / 60);   // start windup
  const staatWindupMeteen = o.aanvalStaat === 'windup';
  for (let i = 0; i < 60; i++) d.updateOndoden(1 / 60);
  const dx = d.speler.positie.x - o.groep.position.x, dz = d.speler.positie.z - o.groep.position.z;
  const doelHoek = Math.atan2(dx, dz);
  const verschil = Math.abs(d.kortsteHoekVerschil(doelHoek, o.groep.rotation.y)) * 180 / Math.PI;
  return { staatWindupMeteen, verschil, aanvalStaatNa: o.aanvalStaat };
});
check('Binnen AANVAL_START_BEREIK met aanvalVertraging op 0 start de windup meteen (voorwaarde voor de rest van deze check)',
  windupTest.staatWindupMeteen === true, windupTest);
check('Tijdens windup draait de ondode (via de bestaande AANVAL_DRAAI_SNELHEID-bijdraai) alsnog bij naar de speler (<10° na 1s)',
  windupTest.verschil < 10, windupTest);
// Na 1s is de windup-duur van dit profiel al verstreken (normaal gedrag,
// niet iets wat dit ticket raakt) — 'herstel' hier bevestigt dat de aanval
// daadwerkelijk is doorgelopen terwijl de bijdraai-check hierboven al klopte.
check('De aanvalsstate-machine liep na de windup gewoon door naar herstel (ongewijzigd pad)',
  windupTest.aanvalStaatNa === 'herstel', windupTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
