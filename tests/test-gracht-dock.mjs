// Ticket 52 (Doel D5): Gang naar de Gracht — een nieuwe, korte gang vanuit
// de bijkeuken-oostmuur naar een vlonder-plateau met water, boot en
// lantaarnpaal. Testplan uit ROADMAP.md: bereikbaarheid, isVrijePlek-
// probes, geen overlap met bestaande geometrie, en de lichttelling die
// bewust van 23 naar 24 gaat (zie ook de bijgewerkte
// test-v016-integratie.mjs). Zie ARCHITECTURE_NOTES.md §6 / ROADMAP.md
// Ticket 52.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Constanten: sane waarden, ruim binnen GRENS.maxX -------------------
const constanten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    half: d.GRACHTGANG_HALF,
    xWest: d.GRACHTGANG_X_WEST,
    lengte: d.GRACHTGANG_LENGTE,
    vlonderXWest: d.VLONDER_X_WEST,
    vlonderDiepte: d.VLONDER_DIEPTE,
    vlonderXOost: d.VLONDER_X_OOST,
    grensMaxX: d.GRENS.maxX,
    bijkeukenXOost: d.BIJKEUKEN_X_OOST,
  };
});
check('GRACHTGANG_X_WEST valt exact op de bijkeuken-oostmuur (BIJKEUKEN_X_OOST)',
  constanten.xWest === constanten.bijkeukenXOost, constanten);
check('GRACHTGANG_HALF is exact 1 (zelfde breedte als DEUR_HALF)', constanten.half === 1, constanten);
check('VLONDER_X_WEST = GRACHTGANG_X_WEST + GRACHTGANG_LENGTE (= 15)',
  constanten.vlonderXWest === constanten.xWest + constanten.lengte, constanten);
check('VLONDER_X_OOST = VLONDER_X_WEST + VLONDER_DIEPTE (= 19.5)',
  constanten.vlonderXOost === constanten.vlonderXWest + constanten.vlonderDiepte, constanten);
check('VLONDER_X_OOST blijft ruim binnen GRENS.maxX — geen GRENS-wijziging nodig',
  constanten.vlonderXOost < constanten.grensMaxX, constanten);

// --- 2. isVrijePlek-probes: gang + vlonder vrij, muursegmenten nog dicht ---
const probes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const gangMidX = (d.GRACHTGANG_X_WEST + d.VLONDER_X_WEST) / 2;
  const vlonderMidX = (d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2;
  return {
    gangMidden: d.isVrijePlek(gangMidX, 0),
    vlonderMidden: d.isVrijePlek(vlonderMidX, 0),
    doorgang: d.isVrijePlek(d.BIJKEUKEN_X_OOST + 0.2, 0),
    // Net oost van de oostmuur, buiten de doorgang-opening: moet nog dicht zijn
    // (de muur is gesplitst in twee segmenten, niet weggehaald).
    muurNoordSegment: d.isVrijePlek(d.BIJKEUKEN_X_OOST + 0.2, -3),
    muurZuidSegment: d.isVrijePlek(d.BIJKEUKEN_X_OOST + 0.2, 3),
  };
});
check('De gang zelf is vrij (isVrijePlek)', probes.gangMidden === true, probes);
check('Het midden van de vlonder is vrij (isVrijePlek)', probes.vlonderMidden === true, probes);
check('De nieuwe doorgang in de bijkeuken-oostmuur is vrij (isVrijePlek)', probes.doorgang === true, probes);
check('Het noordsegment van de gespleten oostmuur blokkeert nog steeds (isVrijePlek false)',
  probes.muurNoordSegment === false, probes);
check('Het zuidsegment van de gespleten oostmuur blokkeert nog steeds (isVrijePlek false)',
  probes.muurZuidSegment === false, probes);

// --- 3. Bereikbaarheid: een aaneengesloten pad van de bijkeuken tot aan de
// vlonder is overal vrij (geen onverwachte blokkade halverwege) ------------
// (x=19 valt bewust buiten dit pad: dat ligt al binnen de isVrijePlek-marge
// van het vlonderrand-obstakel, zie check 4 hieronder voor de échte
// speler-botsingstest daar.)
const pad = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const xen = [9, 10, 11, 11.5, 12.5, 13, 14, 15, 16, 17, 18];
  return xen.map(x => ({ x, vrij: d.isVrijePlek(x, 0) }));
});
check('Elk punt op het pad van bijkeuken -> gang -> vlonder (z=0) is vrij',
  pad.every(p => p.vrij === true), pad);

// --- 4. Het obstakel aan de vlonderrand houdt de speler echt uit het water:
// simuleer een speler die met normale snelheid (4.5 m/s), in kleine
// per-frame-stapjes (zelfde grootteorde als updateSpeler's dt), richting het
// water blijft lopen — losBotsingenOp moet 'm elke keer opnieuw terugduwen
// vóórdat de rand bereikt wordt (i.p.v. één grote sprong recht het water in,
// wat het randgeval van de botsingsoplossing zou raken).
const waterBotsing = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const positie = { x: d.VLONDER_X_WEST + 0.5, y: 1.7, z: 0 };   // duidelijk op de vlonder, ver van de rand
  const stap = d.speler.snelheid * (1 / 60);   // 4.5 m/s bij 60fps
  let maxX = positie.x;
  for (let i = 0; i < 120; i++) {   // 2s lang "vasthouden" richting het water
    positie.x += stap;
    d.losBotsingenOp(positie, d.speler.straal);
    maxX = Math.max(maxX, positie.x);
  }
  return { eindX: positie.x, maxX, vlonderXOost: d.VLONDER_X_OOST };
});
check('Een speler die met normale, kleine stapjes richting het water blijft lopen komt nooit voorbij de vlonderrand',
  waterBotsing.maxX < waterBotsing.vlonderXOost, waterBotsing);

// --- 5. Zone: de vlonder valt onder zone 4 (bijkeuken/"de weg naar de
// gracht"), geen wijziging aan zoneVan()/ZONE_NAMEN nodig -------------------
const zoneCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const vlonderMidX = (d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2;
  return {
    zone: d.zoneVan(vlonderMidX, 0),
    naam: d.ZONE_NAMEN[d.zoneVan(vlonderMidX, 0)],
    flavour: d.ZONE_FLAVOUR[d.zoneVan(vlonderMidX, 0)],
  };
});
check('De vlonder valt onder zone 4 (De Bijkeuken)', zoneCheck.zone === 4, zoneCheck);
check('ZONE_FLAVOUR[4] beschrijft dit al als "de weg naar de gracht"',
  zoneCheck.flavour === 'de weg naar de gracht', zoneCheck);

// --- 6. Lichttelling: precies 1 nieuwe permanente lamp (23 -> 24), geen
// schaduw, niet in lampLichten (buitenlicht-precedent) ----------------------
const lichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const alleLichten = [];
  d.scene.traverse(o => { if (o.isLight) alleLichten.push({ type: o.type, castShadow: o.castShadow }); });
  return {
    totaal: alleLichten.length,
    buitenLichtenLengte: d.buitenLichten.length,
    lantaarnInBuitenLichten: d.buitenLichten.some(bl => bl.licht === d.grachtLantaarnLicht),
    lantaarnHeeftSchaduw: d.grachtLantaarnLicht.castShadow,
    lantaarnInLampLichten: d.lampLichten.some(l => l.licht === d.grachtLantaarnLicht),
  };
});
check('Lichttelling gaat van 23 naar 24 (precies 1 nieuwe permanente lamp)', lichten.totaal === 24, lichten);
check('De nieuwe gracht-lantaarn zit in buitenLichten (dimt mee tijdens Stroomuitval, buiten-vloer)',
  lichten.lantaarnInBuitenLichten === true, lichten);
check('De gracht-lantaarn werpt GEEN schaduw (schaduw===1-invariant blijft bij de bestaande lamp)',
  lichten.lantaarnHeeftSchaduw === false, lichten);
check('De gracht-lantaarn zit NIET in lampLichten (buitenlicht-precedent, zelfde als de binnenplaats-lantaarns)',
  lichten.lantaarnInLampLichten === false, lichten);

// --- 7. Nieuwe meshes bestaan en staan op de verwachte plek -----------------
const meshes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    vlonderMesh: !!d.vlonderMesh,
    waterMesh: !!d.waterMesh,
    waterVoorbijVlonder: d.waterMesh.position.x > d.VLONDER_X_OOST,
    bootGroep: !!d.bootGroep,
    bootVoorbijVlonder: d.bootGroep.position.x > d.VLONDER_X_OOST,
    vlonderMeshFamilie: d.vlonderMesh.userData.materiaalFamilie,
  };
});
check('vlonderMesh bestaat', meshes.vlonderMesh === true, meshes);
check('waterMesh bestaat en ligt voorbij de vlonderrand', meshes.waterMesh && meshes.waterVoorbijVlonder, meshes);
check('bootGroep bestaat en ligt voorbij de vlonderrand (bij het water)', meshes.bootGroep && meshes.bootVoorbijVlonder, meshes);
check("vlonderMesh gebruikt de 'hout'-materiaalfamilie (Ticket 38)", meshes.vlonderMeshFamilie === 'hout', meshes);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
