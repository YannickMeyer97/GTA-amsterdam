// Map-lus M5 (Ticket 28): zone-navigatie als graaf. Bewaakt: (1) zoneVan()
// classificeert 10 proefpunten correct (incl. de nieuwe E-tak vóór de
// woonkamer-check en het binnenplaats-noordpuntje dat zone 3 blijft), (2) de
// next-hop-tabel (NAV_VOLGENDE) komt voor elke deurstand overeen met wat de
// oude lineaire spine altijd al deed (regressie-anker: met deur 3/4 dicht is
// de graaf een lijn), (3) met de lus volledig open kiest de tabel de
// kortste kant (E<->A rechtstreeks via deur 4 i.p.v. de hele ronde via
// B/C/D), (4) een reachability-simulatie (echte gameLoop-stappen) bevestigt
// dat een ondode in E/D daadwerkelijk richting het kortste deurpunt beweegt.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. zoneVan-tabel: 10 proefpunten -------------------------------------
const zoneTabel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const punten = [
    { naam: 'woonkamer-midden', x: 0, z: 0, verwacht: 0 },
    { naam: 'woonkamer-oosthoek (net binnen)', x: 4.0, z: 2, verwacht: 0 },
    { naam: 'gang-midden', x: 0, z: -6.5, verwacht: 1 },
    { naam: 'atelier-midden', x: -6, z: -12, verwacht: 2 },
    { naam: 'nis (atelier)', x: -9.5, z: -22.5, verwacht: 2 },
    { naam: 'binnenplaats-midden', x: 10, z: -15.5, verwacht: 3 },
    { naam: 'binnenplaats-noordpuntje', x: 6, z: d.GANG_Z_EIND - 0.3, verwacht: 3 },
    { naam: 'bijkeuken-midden', x: d.BIJKEUKEN_CX, z: d.BIJKEUKEN_CZ, verwacht: 4 },
    { naam: 'kelderhals-midden', x: d.DEUR3_X, z: (d.KELDERHALS_Z_NOORD + d.KELDERHALS_Z_ZUID) / 2, verwacht: 4 },
    { naam: 'deur4-drempel (bijkeukenkant)', x: d.HALF_BREEDTE + 0.5, z: d.DEUR4_Z, verwacht: 4 },
  ];
  return punten.map(p => ({ ...p, gekregen: d.zoneVan(p.x, p.z) }));
});
for (const p of zoneTabel) {
  check(`zoneVan(${p.naam}) = ${p.verwacht}`, p.gekregen === p.verwacht, p);
}

// --- 2. Nav-tabel bij init (alle deuren dicht): lijn-graaf, identiek aan
// het oude ZONE_DEURPUNTEN-gedrag (regressie-anker) ------------------------
const navInit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    tabel: d.NAV_VOLGENDE,
    DEUR_Z: d.DEUR_Z, GANG_Z_EIND: d.GANG_Z_EIND, DEUR2_X: d.DEUR2_X, DEUR2_Z: d.DEUR2_Z,
  };
});
function zelfdePunt(a, b) {
  return a && b && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9;
}
check('Vóór elke aankoop: zone A (woonkamer) is onbereikbaar vanuit elke andere zone (deur 1 dicht)',
  navInit.tabel[1][0] === null && navInit.tabel[2][0] === null &&
  navInit.tabel[3][0] === null && navInit.tabel[4][0] === null, navInit.tabel);
check('Vóór elke aankoop: gang (B) <-> atelier (C) is al open (geen deur, altijd vrij)',
  zelfdePunt(navInit.tabel[1][2], { x: 0, z: navInit.GANG_Z_EIND }) &&
  zelfdePunt(navInit.tabel[2][1], { x: 0, z: navInit.GANG_Z_EIND }), navInit.tabel);
check('Vóór elke aankoop: binnenplaats (D) en bijkeuken/kelderhals (E) zijn allebei volledig geïsoleerd',
  navInit.tabel[3].every(v => v === null) && navInit.tabel[4].every(v => v === null), navInit.tabel);

// --- 3. Na het kopen van deur 1 en deur 2 (deur 3/4 nog dicht): de graaf is
// een lijn A-B-C-D, en de next-hop komt exact overeen met de oude ternaire
// spine-logica (eigenZone < spelerZone -> deurpunt[eigenZone], eigenZone >
// spelerZone -> deurpunt[eigenZone - 1]) ------------------------------------
const lijnGraaf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  d.koopDeur();
  d.koopDeur2();
  return {
    tabel: d.NAV_VOLGENDE,
    deur3Gekocht: d.deur3Gekocht, deur4Gekocht: d.deur4Gekocht,
  };
});
check('Na deur 1+2 (deur 3/4 dicht): B->A is het A-B-deurpunt (0,0,DEUR_Z) — zelfde als vroeger ZONE_DEURPUNTEN[0]',
  zelfdePunt(lijnGraaf.tabel[1][0], { x: 0, z: navInit.DEUR_Z }), lijnGraaf.tabel);
check('Na deur 1+2: C->A is het B-C-deurpunt (0,0,GANG_Z_EIND) — zelfde als vroeger ZONE_DEURPUNTEN[eigenZone-1]',
  zelfdePunt(lijnGraaf.tabel[2][0], { x: 0, z: navInit.GANG_Z_EIND }), lijnGraaf.tabel);
check('Na deur 1+2: D->A is het C-D-deurpunt (DEUR2_X, DEUR2_Z) — zelfde als vroeger ZONE_DEURPUNTEN[eigenZone-1]',
  zelfdePunt(lijnGraaf.tabel[3][0], { x: navInit.DEUR2_X, z: navInit.DEUR2_Z }), lijnGraaf.tabel);
check('Na deur 1+2: A->D (omgekeerde richting) is het A-B-deurpunt — zelfde als vroeger ZONE_DEURPUNTEN[eigenZone]',
  zelfdePunt(lijnGraaf.tabel[0][3], { x: 0, z: navInit.DEUR_Z }), lijnGraaf.tabel);
check('Na deur 1+2: zone E blijft volledig onbereikbaar (deur 3/4 nog dicht)',
  lijnGraaf.tabel[4].every(v => v === null) &&
  [0, 1, 2, 3].every(z => lijnGraaf.tabel[z][4] === null), lijnGraaf.tabel);
check('deur3Gekocht/deur4Gekocht blijven false (dit stapje koopt ze bewust niet)',
  lijnGraaf.deur3Gekocht === false && lijnGraaf.deur4Gekocht === false, lijnGraaf);

// --- 4. Volledige lus open (alle 4 deuren): E<->A rechtstreeks via deur 4
// (kortste kant), D->A kiest de kortste van beide richtingen ---------------
const lusOpen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  d.koopDeur3();
  d.koopDeur4();
  return { tabel: d.NAV_VOLGENDE };
});
check('Lus open: E->A gaat rechtstreeks via deur 4 (kortste kant, niet de hele ronde via B/C/D)',
  zelfdePunt(lusOpen.tabel[4][0], { x: 4.5, z: 0 }), lusOpen.tabel);
check('Lus open: A->E gaat rechtstreeks via deur 4 (zelfde kant, symmetrisch)',
  zelfdePunt(lusOpen.tabel[0][4], { x: 4.5, z: 0 }), lusOpen.tabel);
check('Lus open: D->A kiest de kortste kant — via deur 3/4 (D-E-A, 2 stappen) i.p.v. via deur 2/1 (D-C-B-A, 3 stappen)',
  zelfdePunt(lusOpen.tabel[3][0], { x: 10, z: -7 }), lusOpen.tabel);
check('Lus open: A->D kiest symmetrisch dezelfde kortste kant (via deur 4/3)',
  zelfdePunt(lusOpen.tabel[0][3], { x: 4.5, z: 0 }), lusOpen.tabel);

// --- 5. Reachability-simulatie: een ondode in E beweegt daadwerkelijk
// richting deur 4 (dichter bij de speler in A) i.p.v. de hele ronde --------
const simulatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);   // speler in de woonkamer (zone A)
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(d.BIJKEUKEN_CX, 0, d.BIJKEUKEN_CZ);   // midden bijkeuken (zone E)
  const afstandVoor = Math.hypot(ondode.groep.position.x - 4.5, ondode.groep.position.z - 0);
  for (let i = 0; i < 30; i++) d.updateOndoden(1 / 60);
  const afstandNa = Math.hypot(ondode.groep.position.x - 4.5, ondode.groep.position.z - 0);
  return { afstandVoor, afstandNa, eindPositie: { x: ondode.groep.position.x, z: ondode.groep.position.z } };
});
check('Reachability-sim E->A: de ondode komt dichter bij het deur4-punt (4.5, 0) te staan, niet verder weg',
  simulatie.afstandNa < simulatie.afstandVoor, simulatie);

const simDA = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);   // speler in de woonkamer (zone A)
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  ondode.groep.position.set(10, 0, -15.5);   // midden binnenplaats (zone D)
  const afstandVoorDeur3 = Math.hypot(ondode.groep.position.x - 10, ondode.groep.position.z - (-7));
  for (let i = 0; i < 30; i++) d.updateOndoden(1 / 60);
  const afstandNaDeur3 = Math.hypot(ondode.groep.position.x - 10, ondode.groep.position.z - (-7));
  return { afstandVoorDeur3, afstandNaDeur3 };
});
check('Reachability-sim D->A: de ondode kiest de kortste kant (via deur 3, richting kelderhals) i.p.v. terug naar deur 2',
  simDA.afstandNaDeur3 < simDA.afstandVoorDeur3, simDA);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
