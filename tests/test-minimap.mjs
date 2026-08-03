// Ticket 67: minimap — "heading-up" wereld-naar-canvas-projectie (geen
// scroll/zoom), speler altijd gecentreerd en op yaw=0 "boven" op het canvas
// (feedback: "laat de minimap meedraaien met waar ik naartoe kijk" — de kaart
// zelf draait mee met ctx.rotate(speler.yaw), zie tekenMinimap()), statische
// zone-omtreklijnen (afgeleid van bestaande muur-/deurconstanten) en nabije
// ondoden als stippen. De kelder ligt structureel buiten GRENS (zie
// GRENS-commentaar in het hoofdbestand), dus toont de minimap daar een
// simpel "KELDER"-label i.p.v. een sublaag.
// Zie ROADMAP.md Ticket 67 en ARCHITECTURE_NOTES.md §7.8.1.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. minimapLokaal()/minimapSchaal(): pure functies, speler-relatief ---
const lokaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  const bijSpeler = d.minimapLokaal(0, 0);
  const west = d.minimapLokaal(d.GRENS.minX, 0);
  const oost = d.minimapLokaal(d.GRENS.maxX, 0);
  d.speler.positie.set(5, 0, 3);
  const verschoven = d.minimapLokaal(5, 3);
  const puntOostVanSpeler = d.minimapLokaal(15, 3);
  d.speler.positie.set(0, 0, 0);
  return {
    bijSpeler, west, oost, verschoven, puntOostVanSpeler,
    schaal: d.minimapSchaal(),
    canvasGrootte: d.MINIMAP_CANVAS_GROOTTE,
    padding: d.MINIMAP_PADDING,
  };
});
check('De positie van de speler zelf projecteert altijd op lokaal (0,0)',
  Math.abs(lokaal.bijSpeler.lx) < 0.01 && Math.abs(lokaal.bijSpeler.lz) < 0.01, lokaal);
check('Westgrens ligt links van de speler (negatieve lx), oostgrens rechts (positieve lx)',
  lokaal.west.lx < 0 && lokaal.oost.lx > 0, lokaal);
check('minimapSchaal() is positief en de breedste as (hier: x) vult het canvas exact tot aan de padding',
  lokaal.schaal > 0 &&
  Math.abs((lokaal.oost.lx - lokaal.west.lx) - (lokaal.canvasGrootte - 2 * lokaal.padding)) < 0.01, lokaal);
check('Als de speler verplaatst, projecteert de speler-positie zelf nog steeds op (0,0) (relatief, niet wereld-vast)',
  Math.abs(lokaal.verschoven.lx) < 0.01 && Math.abs(lokaal.verschoven.lz) < 0.01, lokaal);
check('Een punt 10m oost van de (verplaatste) speler geeft lx = 10 * schaal',
  Math.abs(lokaal.puntOostVanSpeler.lx - 10 * lokaal.schaal) < 0.01 && Math.abs(lokaal.puntOostVanSpeler.lz) < 0.01, lokaal);

// --- 1b. Heading-up rotatie: de kaart draait mee met speler.yaw, zodat een
// punt recht vóór de speler altijd op canvas-boven (0,-s) uitkomt, ongeacht
// de yaw-waarde. Test via de daadwerkelijke ctx.rotate()-transformatie
// (transformPoint), niet alleen minimapLokaal() (die roteert zelf niet). ---
const rotatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  d.speler.positie.set(0, 0, 0);
  d.deurGekocht = true; d.deur2Gekocht = true; d.deur3Gekocht = true;

  function geroteerdPuntVoorSpeler(yaw, afstand) {
    d.speler.yaw = yaw;
    // Zelfde wereldrichting als updateSpeler()'s "vooruit"-vector: (-sin(yaw), -cos(yaw)).
    const x = -Math.sin(yaw) * afstand, z = -Math.cos(yaw) * afstand;
    const l = d.minimapLokaal(x, z);
    // Pas dezelfde rotatie toe die tekenMinimap() op het canvas toepast, en
    // vertaal terug naar canvas-coördinaten t.o.v. het midden.
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    return { cx: l.lx * cosY - l.lz * sinY, cy: l.lx * sinY + l.lz * cosY };
  }
  const r0 = geroteerdPuntVoorSpeler(0, 8);
  const r1 = geroteerdPuntVoorSpeler(Math.PI / 2, 8);
  const r2 = geroteerdPuntVoorSpeler(Math.PI, 8);
  const r3 = geroteerdPuntVoorSpeler(-1.3, 8);

  // Speler-driehoek zelf: moveTo-coördinaten mogen NOOIT van yaw afhangen
  // (de driehoek staat vast, alleen de kaart eromheen draait).
  let moveToArgs = null;
  const origMoveTo = ctx.moveTo.bind(ctx);
  ctx.moveTo = (...a) => { moveToArgs = a; return origMoveTo(...a); };
  d.speler.yaw = 0;
  d.tekenMinimap();
  const moveToYaw0 = moveToArgs;
  moveToArgs = null;
  d.speler.yaw = 2.4;
  d.tekenMinimap();
  const moveToYaw24 = moveToArgs;
  ctx.moveTo = origMoveTo;
  d.speler.yaw = 0;

  return { r0, r1, r2, r3, moveToYaw0, moveToYaw24 };
});
const s = rotatie.r0 && (rotatie.r0.cy !== 0 ? -rotatie.r0.cy : 0);
check('Een punt recht vóór de speler komt bij yaw=0 uit op canvas-boven (cx≈0, cy<0)',
  Math.abs(rotatie.r0.cx) < 0.01 && rotatie.r0.cy < -0.01, rotatie);
check('Hetzelfde punt-recht-vooruit komt ook bij yaw=π/2 op canvas-boven uit (kaart is meegedraaid)',
  Math.abs(rotatie.r1.cx) < 0.01 && rotatie.r1.cy < -0.01, rotatie);
check('...ook bij yaw=π', Math.abs(rotatie.r2.cx) < 0.01 && rotatie.r2.cy < -0.01, rotatie);
check('...ook bij een willekeurige yaw (-1.3 rad)', Math.abs(rotatie.r3.cx) < 0.01 && rotatie.r3.cy < -0.01, rotatie);
check('De speler-driehoek zelf (moveTo) is onafhankelijk van yaw: exact dezelfde coördinaten bij yaw=0 en yaw=2.4',
  JSON.stringify(rotatie.moveToYaw0) === JSON.stringify(rotatie.moveToYaw24), rotatie);

// --- 2. MINIMAP_ZONES: 8 zones, elk met een bekend, herkenbaar punt EN een
// (Fix 5) `muren`-lijst van losse lijnstukken i.p.v. een volledige omtrek --
const zonesTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  function bevat(zone, x, z) {
    return x >= Math.min(zone.x0, zone.x1) && x <= Math.max(zone.x0, zone.x1) &&
      z >= Math.min(zone.z0, zone.z1) && z <= Math.max(zone.z0, zone.z1);
  }
  return {
    aantal: d.MINIMAP_ZONES.length,
    woonkamerBevatOrigin: d.MINIMAP_ZONES.some(z => bevat(z, 0, 0)),
    atelierBevatNis: d.MINIMAP_ZONES.some(z => bevat(z, d.KAMER2_NIS_CX, d.KAMER2_NIS_CZ)),
    binnenplaatsBevatMidden: d.MINIMAP_ZONES.some(z => bevat(z, (d.DEUR2_X + d.PLAATS_X_OOST) / 2, (d.PLAATS_Z_NOORD + d.PLAATS_Z_ZUID) / 2)),
    allemaalHebbenMuren: d.MINIMAP_ZONES.every(z => Array.isArray(z.muren) && z.muren.length > 0),
    totaalMuurstukken: d.MINIMAP_ZONES.reduce((som, z) => som + z.muren.length, 0),
  };
});
check('Er zijn precies 8 minimap-zones', zonesTest.aantal === 8, zonesTest);
check('De woonkamer-zone bevat de oorsprong (0,0)', zonesTest.woonkamerBevatOrigin, zonesTest);
check('Eén zone bevat het midden van de atelier-nis', zonesTest.atelierBevatNis, zonesTest);
check('Eén zone bevat het midden van de binnenplaats', zonesTest.binnenplaatsBevatMidden, zonesTest);
check('Elke zone heeft een niet-lege muren-lijst', zonesTest.allemaalHebbenMuren, zonesTest);
check('Samen 31 muurstukken (5+2+6+3+6+2+5+2, zie MINIMAP_ZONES)', zonesTest.totaalMuurstukken === 31, zonesTest);

// --- 3. tekenMinimap() tekent muur-lijnstukken (Fix 5: stroke() per
// zone.muren-segment i.p.v. strokeRect per zone) + speler-driehoek in de
// normale (boven-de-grond) stand, en NIETS daarvan in de kelder-stand ------
const tekenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let strokeAantal = 0, fillTextAantal = 0, moveToAantal = 0;
  const origStroke = ctx.stroke.bind(ctx);
  const origFillText = ctx.fillText.bind(ctx);
  const origMoveTo = ctx.moveTo.bind(ctx);
  ctx.stroke = (...a) => { strokeAantal++; return origStroke(...a); };
  ctx.fillText = (...a) => { fillTextAantal++; return origFillText(...a); };
  ctx.moveTo = (...a) => { moveToAantal++; return origMoveTo(...a); };

  // Fix 2 (fog-of-war, zie sectie 7 verderop) verbergt zones tot de
  // bijbehorende deur gekocht is — voor DEZE check (telt gewoon alle
  // muurstukken van alle acht zones) alle deuren alvast "gekocht" zetten,
  // zodat 'm los van die latere fog-of-war-dekking blijft testen.
  d.deurGekocht = true; d.deur2Gekocht = true; d.deur3Gekocht = true;
  d.speler.positie.set(0, 0, 0);
  d.tekenMinimap();
  const bovenGronds = { strokeAantal, fillTextAantal, moveToAantal };

  strokeAantal = 0; fillTextAantal = 0; moveToAantal = 0;
  d.speler.positie.set(d.KELDER_X_WEST + 2, -d.KELDER_DIEPTE, (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2);
  d.tekenMinimap();
  const kelder = { strokeAantal, fillTextAantal, moveToAantal };

  ctx.stroke = origStroke;
  ctx.fillText = origFillText;
  ctx.moveTo = origMoveTo;
  d.speler.positie.set(0, 0, 0);
  return { bovenGronds, kelder };
});
check('Boven de grond: 31 stroke()-aanroepen (1 per muurstuk, alle 8 zones gekocht)', tekenTest.bovenGronds.strokeAantal === 31, tekenTest);
check('Boven de grond: precies 32 moveTo-aanroepen (31 muurstukken + 1 speler-driehoek)',
  tekenTest.bovenGronds.moveToAantal === 32, tekenTest);
check('Boven de grond: geen "KELDER"-label (geen fillText)', tekenTest.bovenGronds.fillTextAantal === 0, tekenTest);
check('In de kelder: GEEN muurstukken (geen sublaag-tekening)', tekenTest.kelder.strokeAantal === 0, tekenTest);
check('In de kelder: GEEN speler-driehoek (vervangen door het label)', tekenTest.kelder.moveToAantal === 0, tekenTest);
check('In de kelder: het "KELDER"-label wordt getekend (fillText)', tekenTest.kelder.fillTextAantal === 1, tekenTest);

// --- 4. Nabije ondoden binnen MINIMAP_ONDODE_RADIUS krijgen een stip, verder
// weg staande niet ----------------------------------------------------------
const ondodenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  const dichtbij = d.spawnOndode(0, 'normaal');
  dichtbij.groep.position.set(5, 0, 0);   // binnen MINIMAP_ONDODE_RADIUS (25)
  const ver = d.spawnOndode(0, 'normaal');
  ver.groep.position.set(d.MINIMAP_ONDODE_RADIUS + 20, 0, 0);   // ruim buiten bereik

  const ctx = d.minimapUI.getContext('2d');
  let arcAantal = 0;
  const origArc = ctx.arc.bind(ctx);
  ctx.arc = (...a) => { arcAantal++; return origArc(...a); };
  d.tekenMinimap();
  ctx.arc = origArc;

  for (const o of [...d.ondoden]) d.doodOndode(o);
  // arc() wordt ook 1x gebruikt door... nee, alleen door ondode-stippen (de
  // speler is een driehoek via moveTo/lineTo, geen arc) — dus arcAantal moet
  // exact het aantal ondoden BINNEN bereik zijn (hier: 1).
  return { arcAantal };
});
check('Precies 1 ondode-stip getekend (de dichtbije, niet de verre)', ondodenTest.arcAantal === 1, ondodenTest);

// --- 5. updateMinimap(): throttle, zelfde patroon als de audio-throttles ---
const throttleTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let tekenAantal = 0;
  const origClearRect = ctx.clearRect.bind(ctx);
  ctx.clearRect = (...a) => { tekenAantal++; return origClearRect(...a); };

  d.minimapThrottleTimer = d.MINIMAP_TEKEN_INTERVAL;
  const perStap = d.MINIMAP_TEKEN_INTERVAL / 10;
  for (let i = 0; i < 9; i++) d.updateMinimap(perStap);
  const naNegen = tekenAantal;
  d.updateMinimap(perStap * 2);
  const naTien = tekenAantal;

  ctx.clearRect = origClearRect;
  return { naNegen, naTien };
});
check('9 aanroepen van elk 1/10e van de teken-interval tekenen NOG NIET opnieuw', throttleTest.naNegen === 0, throttleTest);
check('Zodra de opgetelde tijd de interval overschrijdt, wordt er precies 1x opnieuw getekend',
  throttleTest.naTien === 1, throttleTest);

// --- 6. HTML/zichtbaarheid: canvas bestaat, en volgt hudUI/ammoUI's
// display-toggle bij pointerlockchange --------------------------------------
const zichtbaarheidTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bestaat: !!d.minimapUI,
    isCanvas: d.minimapUI.tagName === 'CANVAS',
    tijdensSpel: d.minimapUI.style.display,
  };
});
check('#minimapUI is een <canvas>-element', zichtbaarheidTest.bestaat && zichtbaarheidTest.isCanvas, zichtbaarheidTest);
check('Tijdens actief spel staat de minimap op display:block', zichtbaarheidTest.tijdensSpel === 'block', zichtbaarheidTest);

const pauzeTest = await page.evaluate(async () => {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
  return window.AmsterdamUndeadDebug.minimapUI.style.display;
});
check('Tijdens pauze verdwijnt de minimap (display:none), zelfde patroon als hudUI/ammoUI', pauzeTest === 'none', { pauzeTest });

await page.evaluate(() => {
  const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});

// --- 7. Fix 2 (feedback): fog-of-war — nog niet gekochte zones blijven
// onzichtbaar op de minimap. Elke MINIMAP_ZONES-entry (behalve de
// woonkamer, altijd zichtbaar) heeft een `gekocht`-closure die dezelfde
// deurGekocht/deur2Gekocht/deur3Gekocht-vlaggen leest als de rest van het
// spel. Geteld via het aantal stroke()-aanroepen (Fix 5: elke zichtbare zone
// tekent nu 1 stroke() per muurstuk, zie tekenMinimap()) i.p.v. per-zone-
// matching — robuuster tegen eventuele toekomstige volgorde-wijzigingen in
// MINIMAP_ZONES. Muurstukken per zone: woonkamer 5, gang 2, atelier 6,
// atelier-nis 3, binnenplaats 6, kelderhals 2, bijkeuken 5, gracht/vlonder 2.
const fogOfWar = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let strokeAantal = 0;
  const origStroke = ctx.stroke.bind(ctx);
  ctx.stroke = (...a) => { strokeAantal++; return origStroke(...a); };

  d.speler.positie.set(0, 0, 0);
  d.deurGekocht = false; d.deur2Gekocht = false; d.deur3Gekocht = false;
  strokeAantal = 0; d.tekenMinimap();
  const alleSloten = strokeAantal;

  d.deurGekocht = true;
  strokeAantal = 0; d.tekenMinimap();
  const naDeur1 = strokeAantal;

  d.deur2Gekocht = true;
  strokeAantal = 0; d.tekenMinimap();
  const naDeur2 = strokeAantal;

  d.deur3Gekocht = true;
  strokeAantal = 0; d.tekenMinimap();
  const naDeur3 = strokeAantal;

  ctx.stroke = origStroke;
  return { alleSloten, naDeur1, naDeur2, naDeur3 };
});
check('Met alle deuren op slot: alleen de woonkamer-muurstukken (5)', fogOfWar.alleSloten === 5, fogOfWar);
check('Na deur 1 (deurGekocht): + gang(2) + atelier(6) + atelier-nis(3) = 16',
  fogOfWar.naDeur1 === 16, fogOfWar);
check('Na deur 2 erbij (deur2Gekocht): + binnenplaats(6) = 22',
  fogOfWar.naDeur2 === 22, fogOfWar);
check('Na deur 3 erbij (deur3Gekocht): + kelderhals(2) + bijkeuken(5) + gracht/vlonder(2) = 31 (alle zones)',
  fogOfWar.naDeur3 === 31, fogOfWar);

// --- 8. Fix 5 (feedback: "ik zie soms muren staan terwijl die er niet zijn,
// bijvoorbeeld van de beginruimte door de gang naar het atelier, of in het
// atelier zelf"): pixel-niveau bewijs dat de expliciete muren-lijst écht
// werkt — op een bekende ECHTE doorgang (geen deur, of een gekochte deur)
// mag GEEN zichtbare rand staan, terwijl een bekende ECHTE muur (ver van
// elke doorgang) wél een duidelijk zichtbare rand geeft. Zelfde soort
// pixelmeting-aanpak als de kelder-helderheidstuning (Fix 3), maar dan op
// de minimap-canvas i.p.v. de 3D-render. ------------------------------------
const spookmuurTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.deurGekocht = true; d.deur2Gekocht = true; d.deur3Gekocht = true;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;   // yaw=0: geen rotatie, wereld-coördinaten == lokale coördinaten
  d.tekenMinimap();

  const ctx = d.minimapUI.getContext('2d');
  const midden = d.MINIMAP_CANVAS_GROOTTE / 2;
  const schaal = d.minimapSchaal();

  // Maximale alpha in een klein venster rond een wereldpunt (vangt de
  // sub-pixel-anti-aliasing van fillRect op fractionele coördinaten op).
  function maxAlphaBij(wereldX, wereldZ) {
    const cx = Math.round(midden + (wereldX - d.speler.positie.x) * schaal);
    const cy = Math.round(midden + (wereldZ - d.speler.positie.z) * schaal);
    let maxA = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= d.MINIMAP_CANVAS_GROOTTE || y >= d.MINIMAP_CANVAS_GROOTTE) continue;
        const pix = ctx.getImageData(x, y, 1, 1).data;
        maxA = Math.max(maxA, pix[3]);
      }
    }
    return maxA;
  }

  return {
    // Zekere ECHTE muur: woonkamer-oostmuur, ver van elke deur (het midden
    // van de kamer-diepte, niet bij een hoek/deur).
    echteMuur: maxAlphaBij(d.HALF_BREEDTE, (d.DEUR_Z + d.HALF_DIEPTE) / 2),
    // Spookmuur-kandidaat 1: woonkamer <-> gang (deur 1, gekocht).
    woonkamerGang: maxAlphaBij(0, d.DEUR_Z),
    // Spookmuur-kandidaat 2: gang <-> atelier.
    gangAtelier: maxAlphaBij(0, d.GANG_Z_EIND),
    // Spookmuur-kandidaat 3: atelier <-> atelier-nis (geen deur, altijd open).
    atelierNis: maxAlphaBij(-d.KAMER2_HALF_B, (d.KAMER2_Z_NOORD + d.KAMER2_NIS_Z_ZUID) / 2),
    // Spookmuur-kandidaat 4: atelier <-> binnenplaats (deur 2 — beide zones'
    // muren-lijsten sparen expliciet het DEUR2_Z ± DEUR2_HALF-segment uit).
    atelierBinnenplaats: maxAlphaBij(d.DEUR2_X, d.DEUR2_Z),
  };
});
check('Een echte muur (woonkamer-oostmuur, ver van elke deur) geeft een duidelijk zichtbare rand',
  spookmuurTest.echteMuur > 40, spookmuurTest);
check('GEEN spookmuur op de woonkamer<->gang-doorgang (alpha ruim lager dan bij een echte muur)',
  spookmuurTest.woonkamerGang < spookmuurTest.echteMuur / 2, spookmuurTest);
check('GEEN spookmuur op de gang<->atelier-doorgang', spookmuurTest.gangAtelier < spookmuurTest.echteMuur / 2, spookmuurTest);
check('GEEN spookmuur op de atelier<->atelier-nis-doorgang (nooit een deur geweest, altijd open)',
  spookmuurTest.atelierNis < spookmuurTest.echteMuur / 2, spookmuurTest);
check('GEEN spookmuur op de atelier<->binnenplaats-doorgang (deur 2)',
  spookmuurTest.atelierBinnenplaats < spookmuurTest.echteMuur / 2, spookmuurTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
