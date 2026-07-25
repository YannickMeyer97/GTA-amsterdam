// Ticket 57: audit van zwevende barricadeplanken. Reproduceerde eerst de
// gemelde situatie (golf 6, ná het oppakken van 1 vluchtroute-onderdeel) en
// deed daarna een volledige audit van alle gebarricadeerde vensters. Twee
// echte problemen gevonden en gefixt via de al bestaande basisY-override in
// bouwBarricade() (nu uitgebreid met een optionele plankSpacing):
// (a) VENSTERS/VENSTERS_KAMER2 gebruiken een kozijn van 1.6m/glas van 1.3m
//     hoog, maar de standaard-drieplankstapel (spant maar ~0.92m) liet een
//     duidelijke kier glas/kozijn zichtbaar boven de bovenste plank — nu
//     getuned (basisY 1.3, plankSpacing 0.6) zodat de stapel de volledige
//     glashoogte afdekt (middelste plank landt zelfs precies op het
//     kozijn-midden, y=1.9);
// (b) VENSTERS_BIJKEUKEN (de "steegdeur") had HELEMAAL GEEN kozijn-mesh — de
//     planken hingen zonder omlijnend referentiepunt, het sterkste "zweeft
//     in het niets"-kandidaat. Nu een kozijn+glas toegevoegd (zelfde
//     kozijnOost-patroon) én dezelfde plank-tuning.
// VENSTERS_PLAATS (binnenplaats-poorten/-kelderdeur, T V8/eerdere fix) blijft
// bewust ONGEWIJZIGD (regressie-check hieronder).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. VENSTERS/VENSTERS_KAMER2/VENSTERS_BIJKEUKEN: getunede basisY/
// plankSpacing, en de plankstapel dekt de volle glashoogte overtuigend af --
const volledigeVensterTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const GLAS_ONDER = 1.25, GLAS_BOVEN = 2.55;   // y-bereik van het glas (kozijn y=1.9, hoogte 1.6 -> [1.1,2.7]; glas hoogte 1.3 -> [1.25,2.55])
  const alleVensters = [...d.VENSTERS, ...d.VENSTERS_KAMER2, ...d.VENSTERS_BIJKEUKEN];
  return alleVensters.map(v => {
    const plankYs = v.plankMeshes.map(p => p.position.y);
    const onder = Math.min(...plankYs) - 0.06;   // onderkant onderste plank (plankhoogte 0.12)
    const boven = Math.max(...plankYs) + 0.06;   // bovenkant bovenste plank
    return {
      basisY: v.basisY, plankSpacing: v.plankSpacing,
      onder, boven,
      kierBoven: GLAS_BOVEN - boven,
      kierOnder: onder - GLAS_ONDER,
      bijnaVolledigAfgedekt: (GLAS_BOVEN - boven) < 0.15 && (onder - GLAS_ONDER) < 0.15,
    };
  });
});
check('VENSTERS/VENSTERS_KAMER2/VENSTERS_BIJKEUKEN hebben allemaal basisY 1.3 en plankSpacing 0.6',
  volledigeVensterTest.every(v => v.basisY === 1.3 && v.plankSpacing === 0.6), volledigeVensterTest);
check('De plankstapel dekt bij elk van deze vensters de volle glashoogte af (kier < 0.15m boven én onder — geen zichtbaar glas/kozijn meer erboven)',
  volledigeVensterTest.every(v => v.bijnaVolledigAfgedekt), volledigeVensterTest);

// --- 2. De "steegdeur" (VENSTERS_BIJKEUKEN) heeft nu een eigen kozijn+glas -
const steegdeurTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const venster = d.VENSTERS_BIJKEUKEN[0];
  return {
    kozijnBestaat: !!d.kozijnSteeg,
    glasBestaat: !!d.glasSteeg,
    kozijnInWereld: d.kozijnSteeg && d.kozijnSteeg.parent !== null,
    kozijnDichtBijVenster: d.kozijnSteeg &&
      Math.abs(d.kozijnSteeg.position.z - venster.z) < 0.1 &&
      Math.abs(d.kozijnSteeg.position.x - d.BIJKEUKEN_X_OOST) < 0.2,
  };
});
check('kozijnSteeg en glasSteeg bestaan nu (vóór Ticket 57: helemaal geen kozijn-mesh)',
  steegdeurTest.kozijnBestaat && steegdeurTest.glasBestaat, steegdeurTest);
check('kozijnSteeg staat in de scene, vlak bij de steegdeur-positie op de bijkeuken-oostmuur',
  steegdeurTest.kozijnInWereld && steegdeurTest.kozijnDichtBijVenster, steegdeurTest);

// --- 3. Regressie: VENSTERS_PLAATS blijft ONGEWIJZIGD (de eerder-gefixte
// binnenplaats-poorten/-kelderdeur, basisY 0.5, standaard plankSpacing) -----
const plaatsRegressieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.VENSTERS_PLAATS.map(v => ({
    basisY: v.basisY,
    plankSpacing: v.plankSpacing,
    plankYs: v.plankMeshes.map(p => p.position.y),
  }));
});
check('VENSTERS_PLAATS behoudt basisY 0.5 (ongewijzigd sinds de eerdere binnenplaats-fix)',
  plaatsRegressieTest.every(v => v.basisY === 0.5), plaatsRegressieTest);
check('VENSTERS_PLAATS behoudt de standaard plankSpacing (undefined -> 0.4 default), geen Ticket 57-tuning erop losgelaten',
  plaatsRegressieTest.every(v => v.plankSpacing === undefined), plaatsRegressieTest);
check('VENSTERS_PLAATS-planken staan nog exact op 0.5/0.9/1.3 (0.5 + i*0.4), byte-voor-byte hetzelfde als vóór dit ticket',
  plaatsRegressieTest.every(v => v.plankYs[0] === 0.5 && v.plankYs[1] === 0.9 && v.plankYs[2] === 1.3), plaatsRegressieTest);

// --- 4. bouwBarricade() zelf: plankSpacing-override werkt (pure
// mechaniek-check, los van de specifieke venster-arrays hierboven) --------
const mechaniekTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const nepVenster = { x: 0, z: 0, zone: 'test', spanX: true, basisY: 2, plankSpacing: 0.6 };
  d.bouwBarricade(nepVenster);
  return { plankYs: nepVenster.plankMeshes.map(p => p.position.y) };
});
check('Een venster met basisY 2 en plankSpacing 0.6 krijgt planken op exact 2.0, 2.6, 3.2',
  mechaniekTest.plankYs[0] === 2 && mechaniekTest.plankYs[1] === 2.6 && mechaniekTest.plankYs[2] === 3.2,
  mechaniekTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
