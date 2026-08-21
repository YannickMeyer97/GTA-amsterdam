// Ticket 87 (v0.21, §9.8-beslissing 77): De Vliering — verticaliteit met een
// DISJUNCTE footprint, volgens exact het kelder-precedent uit T62.
//
// De kern van dit ticket is niet de geometrie maar de invariant: berekenVloerY(x, z)
// moet een pure FUNCTIE van x en z blijven. Zodra één x/z twee geldige hoogtes
// heeft, moeten alle vijf de systemen uit §9.8 (speler-Y, ondode-Y,
// losBotsingenOp, zoneVan, tekenMinimap) een verdiepingsbegrip krijgen — precies
// de architectuurwijziging die T87 vermijdt en die als T88 in de backlog staat.
//
// Sectie 1 hieronder is daarom bewust het EERSTE dat geschreven en gedraaid is
// (ticket: "doe dit met de rastertest als eerste stap, niet als laatste"): een
// flood-fill over de echte collision-primitieven bepaalt wat de speler
// werkelijk kan bereiken, en toetst daar de footprint-eis tegen. `isVrijePlek()`
// is daarvoor expliciet ONGESCHIKT — die kijkt alleen naar obstakel-overlap, en
// meldt de volledig ommuurde dode hoek ten zuiden van de nis als "vrij" (221
// punten), terwijl er geen enkele route heen bestaat.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Vóór alles: het obstakelbudget, gemeten op een ONAANGERAAKTE staat. Sectie 1
// hieronder koopt alle deuren (dat verwijdert hun obstakels), dus deze meting
// moet er echt vóór staan.
const obstakelsBijStart = await page.evaluate(() => window.AmsterdamUndeadDebug.obstakels.length);

// --- 1. FOOTPRINT-EIS: flood-fill over alles wat de speler kan bereiken ----
// Alle deuren gekocht = de maximale bereikbare ruimte die het spel ooit heeft.
const floodfill = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 10 ** 7;
  for (const fn of ['koopDeur1', 'koopDeur2', 'koopDeur3', 'koopDeur4', 'koopDeur5', 'koopDeur6']) {
    if (d[fn]) d[fn]();
  }
  d.spelStaat.geld = 0;

  const STAP = 0.25, R = 0.35;   // R = speler.straal
  const iVan = (w) => Math.round(w / STAP), wVan = (i) => i * STAP;
  const key = (i, j) => i + ',' + j;
  // Exact het primitief uit losBotsingenOp(): past de speler-cirkel hier,
  // en ligt hij binnen GRENS (inclusief de kelder-x-bypass)?
  const kanStaan = (x, z) => {
    for (const o of d.obstakels) {
      const cx = Math.max(o.minX, Math.min(x, o.maxX));
      const cz = Math.max(o.minZ, Math.min(z, o.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < R * R) return false;
    }
    let minX = d.GRENS.minX;
    if (z > d.KELDER_Z_NOORD && z < d.KELDER_Z_ZUID) minX = d.KELDER_X_WEST + 0.3;
    return x >= minX && x <= d.GRENS.maxX && z >= d.GRENS.minZ && z <= d.GRENS.maxZ;
  };

  const gezien = new Set([key(iVan(0), iVan(0))]);
  const stapel = [[iVan(0), iVan(0)]];
  while (stapel.length) {
    const [i, j] = stapel.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (gezien.has(k)) continue;
      const x = wVan(ni), z = wVan(nj);
      if (x < -25 || x > 22 || z < -25 || z > 6) continue;
      if (!kanStaan(x, z)) continue;
      gezien.add(k);
      stapel.push([ni, nj]);
    }
  }

  // Per bereikbare cel: ligt hij in de vlieringfootprint, en verandert de
  // vliering daar iets aan de vloerhoogte t.o.v. de situatie vóór T87?
  let bereikbaar = 0, inVliering = 0;
  const veranderdBuitenVliering = [];
  const vlieringHoogtes = [];
  for (const k of gezien) {
    const [i, j] = k.split(',').map(Number);
    const x = wVan(i), z = wVan(j);
    bereikbaar++;
    const vlieringTerm = d.berekenVlieringY(x, z);
    if (vlieringTerm !== null) {
      inVliering++;
      vlieringHoogtes.push(+vlieringTerm.toFixed(3));
    } else if (d.berekenVloerY(x, z) !== d.berekenKelderY(x, z) && veranderdBuitenVliering.length < 5) {
      veranderdBuitenVliering.push({ x, z, vloer: d.berekenVloerY(x, z), kelder: d.berekenKelderY(x, z) });
    }
  }
  return {
    bereikbaar, inVliering, veranderdBuitenVliering,
    minVlieringHoogte: vlieringHoogtes.length ? Math.min(...vlieringHoogtes) : null,
    maxVlieringHoogte: vlieringHoogtes.length ? Math.max(...vlieringHoogtes) : null,
  };
});
check('Flood-fill vindt een plausibel groot bereikbaar gebied (testopzet klopt: > 5000 cellen, alle deuren gekocht)',
  floodfill.bereikbaar > 5000, floodfill);
check('Buiten de vlieringfootprint verandert berekenVloerY() NIETS t.o.v. berekenKelderY() — op geen enkele bereikbare cel',
  floodfill.veranderdBuitenVliering.length === 0, floodfill);

// --- 2. De twee footprints zijn onderling disjunct -------------------------
// Zou een x/z zowel een kelder- als een vlieringhoogte hebben, dan is Y geen
// functie meer en valt de hele §9.8-redenering om.
const disjunct = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let gecontroleerd = 0;
  const overlap = [];
  for (let x = -25; x <= 22; x += 0.25) {
    for (let z = -25; z <= 6; z += 0.25) {
      gecontroleerd++;
      const vliering = d.berekenVlieringY(x, z);
      if (vliering !== null && d.berekenKelderY(x, z) !== 0 && overlap.length < 5) {
        overlap.push({ x: +x.toFixed(2), z: +z.toFixed(2) });
      }
    }
  }
  return { gecontroleerd, overlap };
});
check(`Geen enkel punt van de ${disjunct.gecontroleerd} rasterpunten heeft zowel een kelder- als een vlieringhoogte (footprints disjunct)`,
  disjunct.overlap.length === 0, disjunct);

// --- 3. berekenVloerY is een echte FUNCTIE: zelfde x/z -> zelfde y ---------
const puur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const monsters = [
    [0, 0], [-8, -12], [-5, -9.5], [-11, -16], [-19, -18], [-13.5, -21.8], [10, -10], [-4.6, -12],
  ];
  const afwijkingen = [];
  for (const [x, z] of monsters) {
    const a = d.berekenVloerY(x, z);
    const b = d.berekenVloerY(x, z);
    // Ook na een compleet andere aanroep ertussen (bewijst: geen state)
    d.berekenVloerY(999, 999);
    const c = d.berekenVloerY(x, z);
    if (!(a === b && b === c)) afwijkingen.push({ x, z, a, b, c });
  }
  return { afwijkingen, aantal: monsters.length };
});
check('berekenVloerY() is puur: herhaalde aanroepen (ook met andere aanroepen ertussen) geven exact dezelfde waarde',
  puur.afwijkingen.length === 0, puur);

// --- 4. De vlieringfootprint zelf: grenzen en helling ---------------------
const vorm = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const midZ = (d.VLIERING_Z_NOORD + d.VLIERING_Z_ZUID) / 2;   // buiten de trapkoker
  return {
    buitenOost: d.berekenVlieringY(d.VLIERING_X_OOST + 0.01, midZ),
    buitenWest: d.berekenVlieringY(d.VLIERING_X_WEST - 0.01, midZ),
    buitenNoord: d.berekenVlieringY(-8, d.VLIERING_Z_NOORD - 0.01),
    buitenZuid: d.berekenVlieringY(-8, d.VLIERING_Z_ZUID + 0.01),
    vlakMidden: d.berekenVlieringY(-10, midZ),
    vlakBovenTrap: d.berekenVlieringY(d.VLIERINGTRAP_X_WEST - 0.01, d.VLIERINGTRAP_CZ),
    trapVoet: d.berekenVlieringY(d.VLIERINGTRAP_X_OOST, d.VLIERINGTRAP_CZ),
    trapTop: d.berekenVlieringY(d.VLIERINGTRAP_X_WEST, d.VLIERINGTRAP_CZ),
    trapMidden: d.berekenVlieringY((d.VLIERINGTRAP_X_OOST + d.VLIERINGTRAP_X_WEST) / 2, d.VLIERINGTRAP_CZ),
    // Bewust de NOORDkant van de koker: de zuidrand van de koker valt exact
    // samen met VLIERING_Z_ZUID, daar ligt dus geen vlieringvloer meer naast.
    naastTrap: d.berekenVlieringY(-6, d.VLIERINGTRAP_CZ - d.VLIERINGTRAP_HALF_BREEDTE - 0.01),
    kokerZuidrandIsVlieringZuidrand:
      d.VLIERINGTRAP_CZ + d.VLIERINGTRAP_HALF_BREEDTE === d.VLIERING_Z_ZUID,
    VLIERING_Y: d.VLIERING_Y,
  };
});
check('Buiten de footprint (alle vier de zijden) geeft de vlieringterm null — "geen mening", niet hoogte 0',
  vorm.buitenOost === null && vorm.buitenWest === null && vorm.buitenNoord === null && vorm.buitenZuid === null, vorm);
check('Op de vliering zelf is de vloer overal vlak op VLIERING_Y',
  vorm.vlakMidden === vorm.VLIERING_Y && vorm.vlakBovenTrap === vorm.VLIERING_Y, vorm);
check('De helling loopt van exact 0 aan de ateliervoet naar exact VLIERING_Y bovenaan',
  vorm.trapVoet === 0 && vorm.trapTop === vorm.VLIERING_Y, vorm);
check('Halverwege de helling zit de vloer er precies tussenin (lineair, geen sprong)',
  Math.abs(vorm.trapMidden - vorm.VLIERING_Y / 2) < 1e-9, vorm);
check('Naast de trapkoker (buiten de z-band) ligt de vloer al op vlieringhoogte — de koker is echt alleen de helling',
  vorm.naastTrap === vorm.VLIERING_Y, vorm);
check('De zuidrand van de trapkoker valt exact samen met de zuidrand van de vliering (één muur, geen onbereikbaar restpocket)',
  vorm.kokerZuidrandIsVlieringZuidrand === true, vorm);

// --- 5. Aansluiting op het atelier: continu, geen sprong bij de drempel ----
const drempel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const pad = [];
  for (let x = d.VLIERING_X_OOST + 0.5; x >= d.VLIERINGTRAP_X_WEST - 0.5; x -= 0.1) {
    pad.push(+d.berekenVloerY(x, d.VLIERINGTRAP_CZ).toFixed(4));
  }
  let grootsteSprong = 0;
  for (let i = 1; i < pad.length; i++) grootsteSprong = Math.max(grootsteSprong, Math.abs(pad[i] - pad[i - 1]));
  return { grootsteSprong, begin: pad[0], eind: pad[pad.length - 1], stappen: pad.length };
});
check('Van het atelier de helling op is de vloerhoogte overal continu (geen sprong > 5 cm per 10 cm stap)',
  drempel.grootsteSprong <= 0.05, drempel);
check('Dat pad begint op atelierniveau (0) en eindigt op de vliering',
  drempel.begin === 0 && drempel.eind > 0, drempel);

// --- 6. zoneVan() blijft 2D en ongewijzigd: de vliering is RUIMTE, geen zone
const zones = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const hoeken = [
    [d.VLIERING_X_WEST + 0.1, d.VLIERING_Z_NOORD + 0.1],
    [d.VLIERING_X_OOST - 0.1, d.VLIERING_Z_NOORD + 0.1],
    [d.VLIERING_X_WEST + 0.1, d.VLIERING_Z_ZUID - 0.1],
    [d.VLIERING_X_OOST - 0.1, d.VLIERING_Z_ZUID - 0.1],
    [-8, d.VLIERINGTRAP_CZ],
  ];
  return { zones: hoeken.map(([x, z]) => d.zoneVan(x, z)), aantalZoneNamen: d.ZONE_NAMEN.length };
});
check('Elk punt van de vliering valt in zone 2 (Het Atelier) — geen nieuwe zone-id, geen ZONE_GRAAF-wijziging',
  zones.zones.every(z => z === 2), zones);
check('Er zijn nog steeds precies 5 zones', zones.aantalZoneNamen === 5, zones);

// --- 7. De vliering is BEREIKBAAR (en alleen via de helling) --------------
// Flood-fill nogmaals, nu met de vraag: kan de speler er komen, en zo ja,
// hoeveel cellen liggen er op vlieringhoogte?
const bereikbaarheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const STAP = 0.25, R = 0.35;
  const iVan = (w) => Math.round(w / STAP), wVan = (i) => i * STAP;
  const key = (i, j) => i + ',' + j;
  const kanStaan = (x, z) => {
    for (const o of d.obstakels) {
      const cx = Math.max(o.minX, Math.min(x, o.maxX));
      const cz = Math.max(o.minZ, Math.min(z, o.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < R * R) return false;
    }
    let minX = d.GRENS.minX;
    if (z > d.KELDER_Z_NOORD && z < d.KELDER_Z_ZUID) minX = d.KELDER_X_WEST + 0.3;
    return x >= minX && x <= d.GRENS.maxX && z >= d.GRENS.minZ && z <= d.GRENS.maxZ;
  };
  const gezien = new Set([key(iVan(0), iVan(0))]);
  const stapel = [[iVan(0), iVan(0)]];
  while (stapel.length) {
    const [i, j] = stapel.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (gezien.has(k)) continue;
      const x = wVan(ni), z = wVan(nj);
      if (x < -25 || x > 22 || z < -25 || z > 6) continue;
      if (!kanStaan(x, z)) continue;
      gezien.add(k); stapel.push([ni, nj]);
    }
  }
  let opVlakkeVliering = 0, opHelling = 0;
  for (const k of gezien) {
    const [i, j] = k.split(',').map(Number);
    const v = d.berekenVlieringY(wVan(i), wVan(j));
    if (v === null) continue;
    if (v === d.VLIERING_Y) opVlakkeVliering++; else opHelling++;
  }
  return { opVlakkeVliering, opHelling, totaal: gezien.size };
});
check('De vliering is vanaf de startpositie daadwerkelijk te bereiken (ruime vlakke sta-ruimte gevonden)',
  bereikbaarheid.opVlakkeVliering > 200, bereikbaarheid);
check('De helling zelf is ook begaanbaar (de route ernaartoe bestaat echt)',
  bereikbaarheid.opHelling > 0, bereikbaarheid);

// --- 8. Obstakelbudget: exact vastgelegd (performancevoorwaarde) ----------
// T131 (tweede vlieringtrap verplaatst naar de noordkant, door de
// nis-afsluitmuur): +2 t.o.v. de T87-baseline van 56. De weststomp is weer
// 2 segmenten (het tweede deurgat daar is vervallen), de nis-afsluitmuur
// splitst nu wél in 2 (+1), en de nieuwe koker heeft maar één eigen wand
// nodig (+1) — zijn westkant IS de bestaande vlieringwestmuur. De
// vloerpanelen en de puur visuele vulmuur tellen niet mee: alleen echte
// collision-primitieven.
check('obstakels.length is exact 58 (56 na T87 + 2: gesplitste nis-afsluitmuur, één kokerwand bij de noordtrap)',
  obstakelsBijStart === 58, { obstakelsBijStart });

// --- 9. Geen extra PointLight (performancevoorwaarde: budget blijft 26) ---
const lichtTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let punt = 0, schaduw = 0;
  d.scene.traverse((o) => {
    if (o.isPointLight) punt++;
    if (o.castShadow && o.isLight) schaduw++;
  });
  return { punt, schaduw };
});
// Op verzoek na de eerste speeltest is er ALSNOG één lamp bijgekomen: het
// traplampje bij de ingang ("zodat je wel ziet dat er een trap is"). Dat is
// een bewuste, door de gebruiker gevraagde afwijking van de oorspronkelijke
// T87-performancevoorwaarde — 26 -> 27, en geen enkele meer dan dat.
check('Precies één nieuwe lamp t.o.v. het oude budget: 27 PointLights (26 + het traplampje)',
  lichtTest.punt === 27, lichtTest);
check('De schaduw-invariant blijft: exact 1 schaduwwerpend licht in de hele scene', lichtTest.schaduw === 1, lichtTest);

// --- 10. Ondode-navigatie: de vliering is GEEN gratis veilige plek --------
// Het ticket is expliciet: "Een vliering die een gratis, veilige plek blijkt
// waar ondoden niet komen, is een balanswijziging. Ze moeten er gewoon op
// kunnen." Trajectory-trace naar het model van test-waypoint-navigatie.mjs.
const jacht = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Speler achterin op de vliering, ver van de helling vandaan.
  const spelerX = d.VLIERING_X_WEST + 1.5;
  const spelerZ = d.VLIERING_Z_NOORD + 1.5;
  d.speler.positie.set(spelerX, d.VLIERING_Y, spelerZ);

  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  // Midden in het atelier, NIET uitgelijnd met de koker (VLIERINGTRAP_CZ):
  // exact het scenario waarin hij zonder waypoint tegen de borstwering
  // blijft duwen.
  ondode.groep.position.set(1.5, 0, -14);

  let tickOpVliering = null;
  const hoogtes = [];
  for (let i = 0; i < 3600 && tickOpVliering === null; i++) {   // max 60s
    d.updateOndoden(1 / 60);
    if (i % 120 === 0) hoogtes.push(+ondode.groep.position.y.toFixed(2));
    if (d.isVliering(ondode.groep.position.x, ondode.groep.position.z) &&
        ondode.groep.position.y >= d.VLIERING_Y - 0.01) {
      tickOpVliering = i;
    }
  }
  return {
    secondenTotOpVliering: tickOpVliering === null ? null : +(tickOpVliering / 60).toFixed(1),
    eindPositie: { x: +ondode.groep.position.x.toFixed(2), y: +ondode.groep.position.y.toFixed(2), z: +ondode.groep.position.z.toFixed(2) },
    afstandTotSpeler: +Math.hypot(ondode.groep.position.x - spelerX, ondode.groep.position.z - spelerZ).toFixed(2),
    hoogteVerloop: hoogtes,
  };
});
check('Een ondode die midden in het atelier start, staat binnen 60s daadwerkelijk BOVEN op de vliering (geen gratis veilige plek)',
  jacht.secondenTotOpVliering !== null, jacht);
check('Zijn Y volgt daarbij de helling omhoog — hij eindigt op vlieringhoogte, niet op de begane grond',
  jacht.eindPositie.y >= 1.19, jacht);

// --- 11. De waypoint-laag zelf: routeert atelier -> koker-voet ------------
const waypoint = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const opVliering = { x: d.VLIERING_X_WEST + 1.5, z: d.VLIERING_Z_NOORD + 1.5 };
  const inAtelier = { x: 1.5, z: -14 };
  const naarVliering = d.zoekWaypoint(2, inAtelier, opVliering);
  // T131: twee punten op hetzelfde VLAKKE deel hebben geen tussenstap nodig.
  // (Een punt op een van de twee trappen telt sindsdien als eigen deelruimte
  // — daarvoor is een oversteek juist wél de bedoeling, zie hieronder.)
  const binnenVliering = d.zoekWaypoint(2, { x: -6, z: -12 }, { x: -8, z: -13 });
  const vlakNaarTrap2 = d.zoekWaypoint(2, { x: -6, z: -12 }, opVliering);
  const binnenAtelier = d.zoekWaypoint(2, inAtelier, { x: -2, z: -12 });
  return {
    zone2Lengte: d.ZONE_WAYPOINTS[2].length,
    naarVlieringIsKokerVoet: naarVliering !== null,
    binnenVlieringGeenWaypoint: binnenVliering === null,
    vlakNaarTrap2HeeftWaypoint: vlakNaarTrap2 !== null,
    binnenAtelierGeenWaypoint: binnenAtelier === null,
    voetPuntBuitenTeltNietAlsVliering: d.isVliering(d.VLIERINGTRAP_ONDER_BUITEN.x, d.VLIERINGTRAP_ONDER_BUITEN.z) === false,
  };
});
check('Zone 2 heeft acht waypoints (nis-tak, drie kelder, en vier voor de vliering: het complex + de drie ketenschakels)',
  waypoint.zone2Lengte === 8, waypoint);
check('Vanuit het atelier naar de vliering routeert zoekWaypoint() via de voet van de helling',
  waypoint.naarVlieringIsKokerVoet === true, waypoint);
check('Binnen hetzelfde vlakke deel van de vliering is er geen tussenstap nodig',
  waypoint.binnenVlieringGeenWaypoint === true, waypoint);
check('Van het vlakke deel naar trap 2 is er WEL een tussenstap (de kokeroversteek)',
  waypoint.vlakNaarTrap2HeeftWaypoint === true, waypoint);
check('Binnen het atelier onderling verandert er niets (geen nieuwe tussenstap)', waypoint.binnenAtelierGeenWaypoint === true, waypoint);
// Zelfterminatie-eis (herzien): elke doorgang heeft nu een aanlooppunt aan
// BEIDE kanten, en het buitenpunt moet aantoonbaar BUITEN de vliering liggen —
// anders mikt een ondode die daar aankomt op de plek waar hij al staat.
check('Het buitenste kokervoet-punt ligt buiten de vliering (self-terminatie)',
  waypoint.voetPuntBuitenTeltNietAlsVliering === true, waypoint);

// --- 12. Minimap: één label, nooit twee overlappende zones ----------------
const minimap = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  const teksten = [];
  const origFillText = ctx.fillText.bind(ctx);
  ctx.fillText = (t, ...a) => { teksten.push(t); return origFillText(t, ...a); };
  // De plattegrond zelf bestaat uit gestreepte muursegmenten (ctx.stroke()
  // per lijnstuk) — dat is dus het signaal "er is een normale kaart getekend".
  let muurSegmenten = 0;
  const origStroke = ctx.stroke.bind(ctx);
  ctx.stroke = (...a) => { muurSegmenten++; return origStroke(...a); };

  d.speler.positie.set(d.VLIERING_X_WEST + 1.5, d.VLIERING_Y, d.VLIERING_Z_NOORD + 1.5);
  teksten.length = 0; muurSegmenten = 0;
  d.tekenMinimap();
  const opVliering = { teksten: [...teksten], muurSegmenten };

  d.speler.positie.set(0, 0, 0);
  teksten.length = 0; muurSegmenten = 0;
  d.tekenMinimap();
  const inWoonkamer = { teksten: [...teksten], muurSegmenten };

  ctx.fillText = origFillText;
  ctx.stroke = origStroke;
  return { opVliering, inWoonkamer };
});
check('Op de vliering toont de minimap het label VLIERING (en niet KELDER)',
  minimap.opVliering.teksten.includes('VLIERING') && !minimap.opVliering.teksten.includes('KELDER'), minimap);
check('Op de vliering wordt GEEN normale zone-plattegrond getekend — geen twee overlappende zones',
  minimap.opVliering.muurSegmenten === 0, minimap);
check('In de woonkamer tekent de minimap gewoon weer de normale plattegrond (geen label)',
  minimap.inWoonkamer.teksten.length === 0 && minimap.inWoonkamer.muurSegmenten > 0, minimap);

// --- 13. Geen balansgetal aangeraakt (§9.2-bronassertie) -----------------
const balans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bronnen = [d.berekenVlieringY.toString(), d.berekenVloerY.toString(), d.isVliering.toString()];
  const verboden = [
    'golfBudget', 'GOLF_BUDGET_BASIS', 'GOLF_BUDGET_GROEI', 'ONDODE_THREAT_KOSTEN',
    'GOLF_MAX_ACTIEF', 'ONDODE_HP_TRAPPEN', 'AANVAL_PROFIELEN', '_PRIJS',
    'GELD_PER_HIT', 'GELD_PER_KILL', 'POWERUP_DROP_KANS', 'SPELER_HP_MAX',
    'schadePerTreffer',
  ];
  const gevonden = [];
  for (const bron of bronnen) for (const t of verboden) if (bron.includes(t)) gevonden.push(t);
  return { gevonden, golfMaxActief: d.GOLF_MAX_ACTIEF, spelerHpMax: d.SPELER_HP_MAX };
});
check('Geen van de T87-vloerfuncties raakt een term uit de §9.2-verboden-lijst',
  balans.gevonden.length === 0, balans);

// --- 14. Plafondhoogte: atelier/nis/vliering omhoog, rest van het pand niet
// (feedback: "het plafond bij de vliering is wel heel laag"). -------------
const hoogte = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    ATELIER_HOOGTE: d.ATELIER_HOOGTE,
    KAMER_HOOGTE: d.KAMER_HOOGTE,
    KELDER_HOOGTE: d.KELDER_HOOGTE,
    hoofdruimte: d.ATELIER_HOOGTE - d.VLIERING_Y,
    spelerHoogte: d.speler.hoogte,
  };
});
check('ATELIER_HOOGTE ligt ~12,5% boven KAMER_HOOGTE (3,2 -> 3,6)',
  Math.abs(hoogte.ATELIER_HOOGTE / hoogte.KAMER_HOOGTE - 1.125) < 1e-9, hoogte);
check('De rest van het pand blijft op KAMER_HOOGTE 3,2 (alleen atelier/nis/vliering gingen omhoog)',
  hoogte.KAMER_HOOGTE === 3.2, hoogte);
check('KELDER_HOOGTE === KAMER_HOOGTE blijft gelden (invariant uit test-kelder-trap.mjs)',
  hoogte.KELDER_HOOGTE === hoogte.KAMER_HOOGTE, hoogte);
check('Op de vliering is er nu 2,4 m stahoogte — ruim boven de spelerhoogte 1,7',
  Math.abs(hoogte.hoofdruimte - 2.4) < 1e-9 && hoogte.hoofdruimte > hoogte.spelerHoogte, hoogte);

// --- 15. De Zelflader: koopbaar op de vliering, en alleen daar ------------
const zelflader = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.autoHerladerGekocht = false;
  d.spelStaat.geld = 0;

  // (a) Vanaf de begane grond ONDER de vliering mag het punt niet reageren.
  d.speler.positie.set(d.AUTOHERLADER_X, 0, d.AUTOHERLADER_Z);
  d.updateInteracties();
  const vanafBeganeGrond = d.huidigeInteractie ? d.huidigeInteractie.naam : null;

  // (b) Bovenop de vliering wél.
  d.speler.positie.set(d.AUTOHERLADER_X, d.VLIERING_Y, d.AUTOHERLADER_Z);
  d.updateInteracties();
  const opVliering = d.huidigeInteractie ? d.huidigeInteractie.naam : null;

  // (c) Te weinig geld: geen aankoop, geld onaangeroerd.
  d.spelStaat.geld = 999;
  d.koopAutoHerlader();
  const teWeinig = { gekocht: d.autoHerladerGekocht, geld: d.spelStaat.geld };

  // (d) Genoeg geld: exact AUTOHERLADER_PRIJS afgeschreven.
  d.spelStaat.geld = 1500;
  d.koopAutoHerlader();
  const naKoop = { gekocht: d.autoHerladerGekocht, geld: d.spelStaat.geld };

  // (e) Nogmaals kopen is een no-op (geen dubbel afschrijven).
  d.koopAutoHerlader();
  const nogmaals = { geld: d.spelStaat.geld };

  return { vanafBeganeGrond, opVliering, teWeinig, naKoop, nogmaals, prijs: d.AUTOHERLADER_PRIJS };
});
check('Het Zelflader-punt reageert NIET vanaf de begane grond onder de vliering',
  zelflader.vanafBeganeGrond === null, zelflader);
check('Bovenop de vliering biedt het punt zich wél aan ("Auto loader")',
  zelflader.opVliering === 'Auto loader', zelflader);
check('Met te weinig geld (€999 < €1000) gebeurt er niets en blijft het geld staan',
  zelflader.teWeinig.gekocht === false && zelflader.teWeinig.geld === 999, zelflader);
check('Met genoeg geld wordt hij gemonteerd en exact €1000 afgeschreven',
  zelflader.naKoop.gekocht === true && zelflader.naKoop.geld === 500 && zelflader.prijs === 1000, zelflader);
check('Nogmaals kopen is een veilige no-op (geen tweede afschrijving)',
  zelflader.nogmaals.geld === 500, zelflader);

// --- 16. Auto-herladen: alleen op leeg, alleen ná aankoop -----------------
const autoHerlaad = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const leegEnTick = () => {
    d.wapenStaat.herladen = false;
    d.wapenStaat.magazijn = 0;
    d.wapenStaat.reserve = 20;
    d.updateWapen(1 / 60);
    return d.wapenStaat.herladen;
  };
  d.autoHerladerGekocht = false;
  const zonderUpgrade = leegEnTick();

  d.autoHerladerGekocht = true;
  const metUpgrade = leegEnTick();

  // Volledig doorlopen: magazijn weer vol, reserve navenant gedaald.
  for (let i = 0; i < 300; i++) d.updateWapen(1 / 60);
  const naVolledigHerladen = { magazijn: d.wapenStaat.magazijn, reserve: d.wapenStaat.reserve, herladen: d.wapenStaat.herladen };

  // Half magazijn mag NIET vanzelf herladen (anders verspil je reserve).
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = Math.max(1, d.wapenStaat.magazijnMax - 2);
  d.updateWapen(1 / 60);
  const halfMagazijn = d.wapenStaat.herladen;

  // Leeg maar zonder reserve: geen eindeloze herlaadpoging.
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.reserve = 0;
  d.updateWapen(1 / 60);
  const zonderReserve = d.wapenStaat.herladen;

  return { zonderUpgrade, metUpgrade, naVolledigHerladen, halfMagazijn, zonderReserve };
});
check('Zonder De Zelflader herlaadt een leeg magazijn NIET vanzelf (bestaand gedrag ongewijzigd)',
  autoHerlaad.zonderUpgrade === false, autoHerlaad);
check('Met De Zelflader start het herladen vanzelf zodra het magazijn leeg is',
  autoHerlaad.metUpgrade === true, autoHerlaad);
check('Het automatische herladen loopt gewoon af: magazijn weer vol, reserve navenant gedaald',
  autoHerlaad.naVolledigHerladen.herladen === false &&
  autoHerlaad.naVolledigHerladen.magazijn > 0 && autoHerlaad.naVolledigHerladen.reserve < 20, autoHerlaad);
check('Een half magazijn herlaadt NIET vanzelf (alleen op leeg, anders verspil je reserve)',
  autoHerlaad.halfMagazijn === false, autoHerlaad);
check('Leeg magazijn zonder reserve start geen herlaadpoging (bestaande guard in herladen())',
  autoHerlaad.zonderReserve === false, autoHerlaad);

// --- 17. HUD-label toont het Zelflader-teken -----------------------------
const hud = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.autoHerladerGekocht = false;
  d.updateHUD();
  const zonder = document.getElementById('wapenTekst').textContent;
  d.autoHerladerGekocht = true;
  d.updateHUD();
  const met = document.getElementById('wapenTekst').textContent;
  return { zonder, met };
});
check('Het wapenlabel krijgt ⟳ zodra De Zelflader gemonteerd is (en niet ervoor)',
  !hud.zonder.includes('⟳') && hud.met.includes('⟳'), hud);

// --- 18. Feedback: ondoden op de vliering lopen niet vast als de speler
// naar een ANDERE zone gaat (bv. de binnenplaats) ---------------------------
// Vóór de fix werd zoekWaypoint() alleen geraadpleegd binnen dezelfde zone;
// een ondode op de vliering met de speler in een andere zone kreeg meteen
// het cross-zone deurpunt als doel en liep vast tegen de vlieringmuur/
// -borstwering aan (nooit meer los, "een gratis veilige plek"). Reproductie
// exact naar het scenario uit de bugmelding: speler op de binnenplaats,
// ondode op de vliering.
const vanVlieringAf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  d.koopDeur(); d.koopDeur2();
  d.speler.positie.set(d.PLAATS_CX, 0, d.DEUR2_Z + 3);   // binnenplaats, zone 3

  const starts = [
    [d.VLIERING_X_WEST + 1.5, d.VLIERING_Z_NOORD + 1.5],   // uiterste noordwesthoek
    [d.AUTOHERLADER_X, d.AUTOHERLADER_Z],                   // bij De Zelflader
  ];
  const uitkomsten = [];
  for (const [sx, sz] of starts) {
    d.ondoden.length = 0;
    d.spawnWillekeurigeOndode();
    const ondode = d.ondoden[0];
    ondode.groep.position.set(sx, d.VLIERING_Y, sz);
    let vanVlieringAfTick = null;
    for (let i = 0; i < 1200 && vanVlieringAfTick === null; i++) {   // max 20s
      d.updateOndoden(1 / 60);
      if (ondode.groep.position.y < 0.01 && !d.isVliering(ondode.groep.position.x, ondode.groep.position.z)) {
        vanVlieringAfTick = i;
      }
    }
    uitkomsten.push({ start: [sx, sz], seconden: vanVlieringAfTick === null ? null : +(vanVlieringAfTick / 60).toFixed(1) });
  }
  return uitkomsten;
});
check('Een ondode aan de noordwestkant van de vliering bereikt binnen 20s de atelierbodem, ook al staat de speler op de binnenplaats',
  vanVlieringAf[0].seconden !== null && vanVlieringAf[0].seconden < 20, vanVlieringAf);
check('Een ondode bij De Zelflader bereikt binnen 20s de atelierbodem, ook al staat de speler op de binnenplaats',
  vanVlieringAf[1].seconden !== null && vanVlieringAf[1].seconden < 20, vanVlieringAf);

// --- 19. De onderliggende routeringsregel zelf: het sub-area-waypoint wint
// altijd van het cross-zone deurpunt zodra de zijde-functie een mismatch geeft
const routering = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const opVliering = { x: d.VLIERING_X_WEST + 1.5, z: d.VLIERING_Z_NOORD + 1.5 };
  const spelerOpBinnenplaats = { x: d.PLAATS_CX, z: d.DEUR2_Z + 3 };
  const wp = d.zoekWaypoint(2, opVliering, spelerOpBinnenplaats);
  return { wpIsKokerVoet: wp !== null };
});
check('zoekWaypoint(2, ...) routeert een ondode op de vliering via de kokervoet, ook met de speler in een andere zone',
  routering.wpIsKokerVoet === true, routering);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
