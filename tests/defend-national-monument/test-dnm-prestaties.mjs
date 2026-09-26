// Ticket D42 — het prestatiebudget.
//
// Meet met meet-dnm-prestaties.mjs (vijf vaste standpunten en een drukke
// scene met 30 robots) en toetst aan het budget uit de roadmap. Het budget
// ligt ruim boven de meting na D42, zodat een volgend ticket het merkt als
// het veel toevoegt, zonder dat kleine verschillen de test laten falen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';
import { meet } from './meet-dnm-prestaties.mjs';

export const BUDGET = {
  callsPerStandpunt: 170,     // hoofdpass, kwaliteit Hoog; gemeten na D42: 43–149
  driehoekenPerStandpunt: 120000,   // gemeten: 48k–71k
  callsDruk: 380,             // 30 robots in beeld; gemeten: 338
  meshesPerRobot: 7,          // was 11 vóór D42
  sceneMeshes: 380,           // zonder robots; gemeten: 359 (was 468)
  schaduwwerpers: 170,        // gemeten: 147 (was 200)
  geometrieen: 300,           // plan §11.7.10; gemeten: 258 (was 378)
  texturen: 32,               // plan zei 24, vóór D36 en de straatnaamborden; gemeten: 27
  textuurPixels: 1024 * 1024, // per textuur; de grootste is 1600×320
  laadtijdMs: 4000,           // headless tot de debug-hook; gemeten: ~1,6 s
};

const t0 = Date.now();
const { browser, page, errs } = await openDefend();
const laadtijd = Date.now() - t0;
const { check, report } = makeChecker();

const r = await meet(page);
const perRobot = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spawnRobot(null, 'normal');
  const robot = d.robots[d.robots.length - 1];
  let n = 0;
  robot.groep.traverse(m => { if (m.isMesh) n++; });
  d.scene.remove(robot.groep); d.robots.splice(d.robots.indexOf(robot), 1);
  return n;
});

// Geen lek: robots die komen en gaan laten geen geometrie of textuur achter
// (vóór D42 bleven er per robot vier geometrieën in het geheugen).
const lek = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const r = d.renderer;
  const telling = () => { r.render(d.scene, d.camera); return { geometrieen: r.info.memory.geometries, texturen: r.info.memory.textures }; };
  d.camera.position.set(0, 1.7, 5); d.camera.lookAt(0, 1, -8);
  const ronde = (n = 10) => {
    for (let i = 0; i < n; i++) {
      d.spawnRobot(null, ['normal', 'sprinter', 'tank', 'bomber', 'shieldbot'][i % 5]);
      d.robots[d.robots.length - 1].groep.position.set(-10 + (i % 10) * 2, 0, -8);
    }
    telling();
    for (const x of [...d.robots]) d.vernietigRobot(x, 'toren');
    for (let i = 0; i < 10; i++) d.schiet();   // vonken op de grond
  };
  // Opwarmen: alles één keer in beeld (eerste upload is geen lek), en de
  // gloed wordt één keer per accentkleur gebouwd (begrensd); een normale
  // robot kiest zijn accent willekeurig, vandaar 150.
  ronde(150);
  const voor = telling();
  for (let i = 0; i < 4; i++) ronde();
  const na = telling();
  // Textuurmaten.
  const texturen = new Set();
  d.scene.traverse(m => { for (const mat of [].concat(m.material ?? [])) if (mat.map?.image) texturen.add(mat.map); });
  const grootste = Math.max(...[...texturen].map(t => t.image.width * t.image.height));
  return { voor, na, grootste };
});

for (const s of r.standpunten) {
  check(`${s.naam}: ≤ ${BUDGET.callsPerStandpunt} draw calls in de hoofdpass`, s.callsHoofdpass <= BUDGET.callsPerStandpunt, s);
  check(`${s.naam}: ≤ ${BUDGET.driehoekenPerStandpunt / 1000}k driehoeken`, s.trianglesHoofdpass <= BUDGET.driehoekenPerStandpunt, s);
}
check(`Druk (30 robots in beeld): ≤ ${BUDGET.callsDruk} draw calls`, r.druk.calls <= BUDGET.callsDruk, r.druk);
check(`Een robot bestaat uit ≤ ${BUDGET.meshesPerRobot} meshes`, perRobot <= BUDGET.meshesPerRobot, perRobot);
check(`De scene heeft ≤ ${BUDGET.sceneMeshes} meshes en ≤ ${BUDGET.schaduwwerpers} schaduwwerpers`, r.scene.meshes <= BUDGET.sceneMeshes && r.scene.schaduwwerpers <= BUDGET.schaduwwerpers, r.scene);
check(`De scene heeft ≤ ${BUDGET.geometrieen} geometrieën en ≤ ${BUDGET.texturen} texturen`, r.scene.geometries <= BUDGET.geometrieen && r.scene.textures <= BUDGET.texturen, r.scene);
check(`Geen textuur groter dan 1024² pixels`, lek.grootste <= BUDGET.textuurPixels, lek.grootste);
// Marge van 3: een zeldzaam effect (schildvonk, stof buiten bereik) of een
// nieuwe accentkleur kan pas in de meetrondes voor het eerst in beeld komen
// en wordt dan één keer geüpload. Dat is begrensd; een echt lek geeft er
// minstens één per robot, dus ≥ 40.
check('Geen lek: 40 robots en 40 schoten laten geen geometrie of textuur achter (marge 3 voor een eerste upload)', lek.na.geometrieen - lek.voor.geometrieen <= 3 && lek.na.texturen - lek.voor.texturen <= 1, lek);
check(`Laadtijd tot de debug-hook ≤ ${BUDGET.laadtijdMs / 1000} s`, laadtijd <= BUDGET.laadtijdMs, laadtijd);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
