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

// --- 6. Lichttelling: 2 nieuwe permanente lampen (23 -> 25), geen schaduw,
// niet in lampLichten (buitenlicht-precedent) --------------------------------
// Feedback: naast de gracht-lantaarn (Ticket 52) kreeg de boot zelf ook een
// klein lichtje ("een lichtje erop") — zelfde buitenlicht-precedent, maar nu
// een KIND van bootGroep (vaart automatisch mee met de aan-/wegvaar-animatie).
const lichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const alleLichten = [];
  d.scene.traverse(o => { if (o.isLight) alleLichten.push({ type: o.type, castShadow: o.castShadow }); });
  // Feedback-fix (jetski): dit stond op `bl.licht.parent === d.bootGroep`.
  // Sinds het vaartuig een eigen romp-subgroep heeft (bootRomp, die binnen
  // bootGroep om zijn eigen as gedraaid wordt voor de koers) hangt het
  // lampje één niveau dieper. De EIS is niet "direct kind" maar "vaart mee
  // met de aan-/wegvaar-animatie", en dat is precies "zit ergens ONDER
  // bootGroep" — dus toetst dit nu de voorouderketen.
  const onderBoot = (o) => { for (let p = o.parent; p; p = p.parent) if (p === d.bootGroep) return true; return false; };
  const bootLichtEntry = d.buitenLichten.find(bl => onderBoot(bl.licht));
  return {
    totaal: alleLichten.length,
    buitenLichtenLengte: d.buitenLichten.length,
    lantaarnInBuitenLichten: d.buitenLichten.some(bl => bl.licht === d.grachtLantaarnLicht),
    lantaarnHeeftSchaduw: d.grachtLantaarnLicht.castShadow,
    lantaarnInLampLichten: d.lampLichten.some(l => l.licht === d.grachtLantaarnLicht),
    bootLichtBestaat: !!bootLichtEntry,
    bootLichtHeeftSchaduw: bootLichtEntry ? bootLichtEntry.licht.castShadow : null,
    bootLichtInLampLichten: d.lampLichten.some(l => l.licht === bootLichtEntry?.licht),
  };
});
// Performance-audit (feedback): de 28 hierboven was correct tot de twee
// Smederij-ember-lichtjes (bereik 0,9m, visueel niet te onderscheiden van
// alleen het emissive materiaal — zie ARCHITECTURE_NOTES.md §7.9) zijn
// verwijderd: 28 -> 26. Kelderoost (feedback) voegt daarna zijn eigen
// kamerlamp toe: 26 -> 27 (de Scheepslantaarn zelf is puur emissive
// materiaal, geen echte PointLight, dus die verhuizing telt niet mee).
// +1 sinds het vliering-traplampje (op verzoek toegevoegd na T87): 27 -> 28.
check('Lichttelling: 26 (na de Smederij-opruiming) + 1 kelderoost-kamerlamp + 1 vliering-traplampje = 28',
  lichten.totaal === 28, lichten);
check('De nieuwe gracht-lantaarn zit in buitenLichten (dimt mee tijdens Stroomuitval, buiten-vloer)',
  lichten.lantaarnInBuitenLichten === true, lichten);
check('De gracht-lantaarn werpt GEEN schaduw (schaduw===1-invariant blijft bij de bestaande lamp)',
  lichten.lantaarnHeeftSchaduw === false, lichten);
check('De gracht-lantaarn zit NIET in lampLichten (buitenlicht-precedent, zelfde als de binnenplaats-lantaarns)',
  lichten.lantaarnInLampLichten === false, lichten);
check('Het boot-lichtje hangt ONDER bootGroep (vaart automatisch mee met de aan-/wegvaar-animatie) en zit in buitenLichten',
  lichten.bootLichtBestaat === true, lichten);
check('Het boot-lichtje werpt GEEN schaduw (zelfde lichte-buitenlamp-patroon)',
  lichten.bootLichtHeeftSchaduw === false, lichten);
check('Het boot-lichtje zit NIET in lampLichten (buitenlicht-precedent)',
  lichten.bootLichtInLampLichten === false, lichten);

// --- 7. Nieuwe meshes bestaan en staan op de verwachte plek -----------------
const meshes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const waterWestrand = d.waterMesh.position.x - d.waterMesh.geometry.parameters.width / 2;
  const waterOostrand = d.waterMesh.position.x + d.waterMesh.geometry.parameters.width / 2;
  const waterNoordrand = d.waterMesh.position.z - d.waterMesh.geometry.parameters.height / 2;
  const dokwaterWestrand = d.dokwaterMesh.position.x - d.dokwaterMesh.geometry.parameters.width / 2;
  const dokwaterOostrand = d.dokwaterMesh.position.x + d.dokwaterMesh.geometry.parameters.width / 2;
  const dokwaterNoordrand = d.dokwaterMesh.position.z - d.dokwaterMesh.geometry.parameters.height / 2;
  return {
    vlonderMesh: !!d.vlonderMesh,
    waterMesh: !!d.waterMesh,
    dokwaterMesh: !!d.dokwaterMesh,
    waterVoorbijVlonder: d.waterMesh.position.x > d.VLONDER_X_OOST,
    waterWestrand,
    waterOostrand,
    waterNoordrand,
    dokwaterWestrand,
    dokwaterOostrand,
    dokwaterNoordrand,
    VLONDER_X_OOST: d.VLONDER_X_OOST,
    VLONDER_X_WEST: d.VLONDER_X_WEST,
    WATER_VLAK_OOST: d.WATER_VLAK_OOST,
    PLAATS_Z_ZUID: d.PLAATS_Z_ZUID,
    BOOT_VERTREK_X: d.BOOT_VERTREK_X,
    bootGroep: !!d.bootGroep,
    bootVoorbijVlonder: d.bootGroep.position.x > d.VLONDER_X_OOST,
    vlonderMeshFamilie: d.vlonderMesh.userData.materiaalFamilie,
  };
});
check('vlonderMesh bestaat', meshes.vlonderMesh === true, meshes);
check('waterMesh bestaat', meshes.waterMesh === true, meshes);
check('dokwaterMesh bestaat', meshes.dokwaterMesh === true, meshes);
check('bootGroep bestaat en ligt voorbij de vlonderrand (bij het water)', meshes.bootGroep && meshes.bootVoorbijVlonder, meshes);
check("vlonderMesh gebruikt de 'hout'-materiaalfamilie (Ticket 38)", meshes.vlonderMeshFamilie === 'hout', meshes);
// Feedback-fix 1 (gebruiker: "tijdens de mistgolf zie ik duidelijk dat er
// geen water om de vlonder heen ligt"): eerst opgelost door de ÉNE
// waterMesh se westrand te verbreden tot VLONDER_X_WEST. Feedback-fix 2
// (gebruiker: "ik zie af en toe water door de binnenplaats lopen"): die
// verbreding liep te ver noordwaarts door en overlapte de binnenplaatsvloer.
// Opgelost door de steiger-omringing in een APARTE, smalle dokwaterMesh te
// zetten (x: VLONDER_X_WEST..VLONDER_X_OOST, eigen materiaal-instantie, zie
// DOKWATER_LENGTE in amsterdam-undead.html) die pas bij z=-5 begint — 2m
// voor de binnenplaats-zuidmuur (PLAATS_Z_ZUID=-7) — zodat de steiger nog
// steeds water rondom en eronder heeft, zonder dat een van beide
// watervlakken de binnenplaats (z <= PLAATS_Z_ZUID) bereikt.
check('dokwaterMesh dekt de steiger van west tot oost (VLONDER_X_WEST..VLONDER_X_OOST)',
  Math.abs(meshes.dokwaterWestrand - meshes.VLONDER_X_WEST) < 1e-9 &&
  Math.abs(meshes.dokwaterOostrand - meshes.VLONDER_X_OOST) < 1e-9, meshes);
check('waterMesh sluit naadloos aan op dokwaterMesh (geen gat, geen overlap bij VLONDER_X_OOST)',
  Math.abs(meshes.waterWestrand - meshes.VLONDER_X_OOST) < 1e-9, meshes);
check('Geen van beide watervlakken loopt door tot in de binnenplaats (noordrand blijft zuidelijker dan PLAATS_Z_ZUID)',
  meshes.dokwaterNoordrand > meshes.PLAATS_Z_ZUID && meshes.waterNoordrand > meshes.PLAATS_Z_ZUID, meshes);
check('De oostrand van het water blijft ongewijzigd op WATER_VLAK_OOST (de oever/skyline-aansluiting van Fix A verschuift niet mee)',
  Math.abs(meshes.waterOostrand - meshes.WATER_VLAK_OOST) < 1e-9, meshes);
check('De oostrand van het water reikt voorbij BOOT_VERTREK_X (de boot past met marge in het verweg-vaarwater)',
  meshes.waterOostrand > meshes.BOOT_VERTREK_X + 1, meshes);

// --- 8. Feedback: ondoden liepen "raar aangeschoven" tegen de muur naast de
// gang-opening i.p.v. de hoek goed om te lopen. De gang+vlonder telt voor
// zoneVan() bewust als DEEL van zone 4 (check 5 hierboven), dus NAV_VOLGENDE
// (dat alleen tussen zones routeert) liet een ondode in de open bijkeuken
// rechtstreeks op een speler in de smalle gang/vlonder afgaan. De fix stuurt
// zo'n ondode eerst naar GRACHTGANG_DREMPEL (het midden van de opening) i.p.v.
// rechtstreeks, maar ALLEEN als ondode en speler aan weerszijden van de
// opening staan — blijft het rechtstreeks gedrag ongewijzigd wanneer ze al
// aan dezelfde kant zijn. ---------------------------------------------------
const chokepoint = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;

  function eersteStap(ondodePos, spelerPos) {
    d.ondoden.length = 0;
    d.spawnWillekeurigeOndode();
    const ondode = d.ondoden[0];
    ondode.groep.position.set(ondodePos.x, 0, ondodePos.z);
    d.speler.positie.set(spelerPos.x, 0, spelerPos.z);
    const voor = { x: ondode.groep.position.x, z: ondode.groep.position.z };
    d.updateOndoden(0.01);   // kleine dt: alleen de richting van de eerste stap telt, geen botsingsruis
    const na = { x: ondode.groep.position.x, z: ondode.groep.position.z };
    return {
      zelfdeZone: d.zoneVan(voor.x, voor.z) === d.zoneVan(spelerPos.x, spelerPos.z),
      hoekBeweging: Math.atan2(na.x - voor.x, na.z - voor.z),
      hoekNaarDrempel: Math.atan2(d.GRACHTGANG_DREMPEL_BUITEN.x - voor.x, d.GRACHTGANG_DREMPEL_BUITEN.z - voor.z),
      hoekNaarSpeler: Math.atan2(spelerPos.x - voor.x, spelerPos.z - voor.z),
    };
  }

  return {
    // Ondode in de open bijkeuken (ver van de gang-z-band), speler op de vlonder.
    overDeDrempel: eersteStap(
      { x: d.BIJKEUKEN_CX, z: d.BIJKEUKEN_Z_NOORD + 1 },
      { x: (d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2, z: d.BIJKEUKEN_CZ }
    ),
    // Beide al in de open bijkeuken: geen drempel-omweg nodig.
    zelfdeKantBijkeuken: eersteStap(
      { x: d.BIJKEUKEN_CX, z: d.BIJKEUKEN_Z_NOORD + 1 },
      { x: d.BIJKEUKEN_CX + 1, z: d.BIJKEUKEN_Z_ZUID - 1 }
    ),
    // Beide al op de vlonder: ook geen drempel-omweg nodig.
    zelfdeKantVlonder: eersteStap(
      { x: d.VLONDER_X_WEST + 0.3, z: -0.5 },
      { x: d.VLONDER_X_OOST - 0.3, z: 0.5 }
    ),
    // Bugfix-regressie (Feedback): de binnenplaats (zone 3) loopt van
    // DEUR2_X tot PLAATS_X_OOST, ruim over x=GRACHTGANG_X_WEST (12) heen —
    // dus een ondode aan de westkant (x<12) van de binnenplaats met een
    // speler aan de oostkant (x>=12) van DEZELFDE binnenplaats MOET gewoon
    // rechtstreeks op de speler af blijven gaan, niet naar GRACHTGANG_DREMPEL
    // (dat hoort alleen bij zone 4). Zonder de zone-guard liepen ondoden op
    // de binnenplaats naar de zuidwesthoek i.p.v. naar de speler.
    binnenplaatsOverDeTwaalf: eersteStap(
      { x: d.DEUR2_X + 1, z: d.DEUR2_Z },
      { x: d.PLAATS_CX, z: d.DEUR2_Z }
    ),
  };
});
check('Chokepoint-testopzet: alle drie de gracht-gevallen blijven binnen dezelfde zone (4, bijkeuken) — dit bewaakt de intra-zone-fix, niet NAV_VOLGENDE',
  chokepoint.overDeDrempel.zelfdeZone && chokepoint.zelfdeKantBijkeuken.zelfdeZone && chokepoint.zelfdeKantVlonder.zelfdeZone,
  chokepoint);
check('Bugfix-testopzet: het binnenplaats-scenario blijft in dezelfde zone (3, binnenplaats), NIET zone 4',
  chokepoint.binnenplaatsOverDeTwaalf.zelfdeZone === true, chokepoint.binnenplaatsOverDeTwaalf);
check('Bugfix: een ondode op de binnenplaats (x<12) met de speler verderop op dezelfde binnenplaats (x>=12) loopt rechtstreeks op de speler af, niet naar GRACHTGANG_DREMPEL',
  Math.abs(chokepoint.binnenplaatsOverDeTwaalf.hoekBeweging - chokepoint.binnenplaatsOverDeTwaalf.hoekNaarSpeler) < 0.01,
  chokepoint.binnenplaatsOverDeTwaalf);
check('Ondode in de open bijkeuken met speler op de vlonder loopt eerst naar de gang-drempel, niet rechtstreeks naar de speler',
  Math.abs(chokepoint.overDeDrempel.hoekBeweging - chokepoint.overDeDrempel.hoekNaarDrempel) < 0.01 &&
  Math.abs(chokepoint.overDeDrempel.hoekBeweging - chokepoint.overDeDrempel.hoekNaarSpeler) > 0.1,
  chokepoint.overDeDrempel);
check('Ondode en speler allebei in de open bijkeuken: onveranderd rechtstreeks gedrag (geen drempel-omweg)',
  Math.abs(chokepoint.zelfdeKantBijkeuken.hoekBeweging - chokepoint.zelfdeKantBijkeuken.hoekNaarSpeler) < 0.01,
  chokepoint.zelfdeKantBijkeuken);
check('Ondode en speler allebei op de vlonder: onveranderd rechtstreeks gedrag (geen drempel-omweg)',
  Math.abs(chokepoint.zelfdeKantVlonder.hoekBeweging - chokepoint.zelfdeKantVlonder.hoekNaarSpeler) < 0.01,
  chokepoint.zelfdeKantVlonder);

// --- 9. Reachability: een ondode in de open bijkeuken bereikt daadwerkelijk
// de gang/vlonder (rondt de hoek) als de speler op de vlonder staat, i.p.v.
// permanent tegen de muur naast de opening te blijven hangen ---------------
const rondom = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(d.BIJKEUKEN_CX, 0, d.BIJKEUKEN_Z_NOORD + 1);
  d.speler.positie.set((d.VLONDER_X_WEST + d.VLONDER_X_OOST) / 2, 0, d.BIJKEUKEN_CZ);
  for (let i = 0; i < 300; i++) d.updateOndoden(1 / 60);   // 5s
  return {
    eindX: ondode.groep.position.x,
    eindZ: ondode.groep.position.z,
    inGracht: ondode.groep.position.x >= d.GRACHTGANG_X_WEST,
  };
});
check('Na 5s simulatie is de ondode daadwerkelijk de gang/vlonder in gelopen (rondde de hoek i.p.v. tegen de muur te blijven hangen)',
  rondom.inGracht === true, rondom);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
