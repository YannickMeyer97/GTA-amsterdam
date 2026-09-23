// Ticket D29 (SONNET_EXECUTION_PLAN_monument.md §10, fase 3) — wapenbereik
// beperken.
//
// Vanaf het monument dek je het laatste stuk van een corridor, niet de poort
// zelf. Een schot dat tekort komt, krijgt een eigen zichtbaar effect —
// anders ziet het er precies zo uit als een misser.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- 1. Het bereik zelf, en geen poort binnen bereik vanaf het monument ----

const basis = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const start = d.BEGINSTAAT.speler.positie;
  return {
    bereik: d.WAPEN_BEREIK,
    far: d.raycaster.far,
    vanafMonumentrand: d.SPAWN_POORTEN.map(p => [p.naam, d.afstandTotMonument(p.positie)]),
    vanafStartplek: d.SPAWN_POORTEN.map(p => [p.naam, Math.hypot(p.positie.x - start.x, p.positie.z - start.z)]),
  };
});
check('WAPEN_BEREIK is 22 m en de raycaster gebruikt het', basis.bereik === 22 && basis.far === 22, basis);
check('Geen enkele poort ligt binnen bereik van de monumentrand', basis.vanafMonumentrand.every(([, a]) => a > basis.bereik), basis.vanafMonumentrand);
check('Geen enkele poort ligt binnen bereik van de speler-startplek', basis.vanafStartplek.every(([, a]) => a > basis.bereik), basis.vanafStartplek);

// --- 2. Een vrije schietrichting zoeken ------------------------------------
//
// Vanaf het midden van het plein: de eerste richting waarin binnen 30 m geen
// stuk `wereld` in de schotlijn staat. Zo test het bereik zich, niet een
// toevallige muur.

const richting = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const wereld = d.scene.children.find(c => c.isGroup && Math.abs(c.scale.x - d.ARENA_SCHAAL) < 1e-6);
  for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
  d.spel.teSpawnen = 0;
  const kandidaten = [
    [d.MONUMENT_POSITIE.x - 6, d.MONUMENT_POSITIE.z + 6],
    [d.BEGINSTAAT.speler.positie.x, d.BEGINSTAAT.speler.positie.z],
    [d.MONUMENT_POSITIE.x - 10, d.MONUMENT_POSITIE.z - 2],
  ];
  for (const [x, z] of kandidaten) {
    for (let i = 0; i < 72; i++) {
      d.speler.positie.set(x, 0, z);
      d.speler.yaw = (i / 72) * Math.PI * 2;
      d.speler.pitch = 0;
      d.updateSpeler(0);
      d.camera.updateMatrixWorld(true);
      d.raycaster.far = 30;
      d.raycaster.setFromCamera({ x: 0, y: 0 }, d.camera);
      const hits = d.raycaster.intersectObject(wereld, true);
      d.raycaster.far = d.WAPEN_BEREIK;
      if (hits.length === 0) return { gevonden: true, x, z, yaw: d.speler.yaw };
    }
  }
  return { gevonden: false };
});
check('Er is een vrije schietrichting van 30 m gevonden', richting.gevonden, richting);

// Plaatst een robot op afstand `afstand` recht vooruit, richt op zijn lijf en
// schiet één keer. Geeft terug of hij geraakt is en of het buiten-bereik-
// effect verscheen.
async function schietOp(afstand, pitchOverride = null) {
  return page.evaluate(({ richting, afstand, pitchOverride }) => {
    const d = window.DamChaosDebug;
    for (const r of [...d.robots]) { d.scene.remove(r.groep); d.robots.splice(d.robots.indexOf(r), 1); }
    d.speler.positie.set(richting.x, 0, richting.z);
    d.speler.yaw = richting.yaw;
    let robot = null;
    if (afstand !== null) {
      d.spawnRobot(null, 'normal');
      robot = d.robots[d.robots.length - 1];
      robot.groep.position.set(richting.x - Math.sin(richting.yaw) * afstand, 0, richting.z - Math.cos(richting.yaw) * afstand);
      robot.groep.rotation.set(0, 0, 0);
      robot.groep.updateMatrixWorld(true);
      // Iets omlaag richten, zodat de schotlijn het lijf (~1 m hoog) raakt.
      d.speler.pitch = -Math.atan((d.speler.hoogte - 1.0) / afstand);
    }
    if (pitchOverride !== null) d.speler.pitch = pitchOverride;
    d.updateSpeler(0);
    d.camera.updateMatrixWorld(true);
    const stofVoor = d.scene.children.filter(c => c.userData.buitenBereik).length;
    const treffersVoor = d.runStats.treffers;
    d.schiet();
    return {
      geraakt: d.runStats.treffers === treffersVoor + 1,
      robotVernietigd: robot ? !d.robots.includes(robot) : null,
      stofEffect: d.scene.children.filter(c => c.userData.buitenBereik).length > stofVoor,
      farNaSchot: d.raycaster.far,
    };
  }, { richting, afstand, pitchOverride });
}

// --- 3. Net binnen en net buiten bereik ------------------------------------

const binnen = await schietOp(20);
check('Robot op 20 m (binnen bereik): geraakt en in één schot vernietigd', binnen.geraakt && binnen.robotVernietigd, binnen);
check('...zonder buiten-bereik-effect', !binnen.stofEffect, binnen);

const buiten = await schietOp(24);
check('Robot op 24 m (buiten bereik): niet geraakt, blijft staan', !buiten.geraakt && buiten.robotVernietigd === false, buiten);
check('...en het buiten-bereik-effect verschijnt', buiten.stofEffect, buiten);
check('Na het controle-schot staat raycaster.far weer op WAPEN_BEREIK', buiten.farNaSchot === 22, buiten);

const lucht = await schietOp(null, 1.2);
check('Schot in de lucht (niets in de schotlijn): geen buiten-bereik-effect', !lucht.stofEffect && !lucht.geraakt, lucht);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
