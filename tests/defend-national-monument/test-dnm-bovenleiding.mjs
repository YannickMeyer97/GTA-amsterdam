// Ticket D48 (SONNET_EXECUTION_PLAN_monument.md, §11.8) — de Bovenleiding.
//
// Een tramdraadmast die per schot een stroomstoot geeft. De stoot treft de
// dichtstbijzijnde robot binnen bereik en springt over naar robots die dicht
// bij elkaar lopen, tot maximaal 4, met aflopende schade per sprong.
// Robots worden hier neergezet, niet gelopen: de test meet de toren, niet de
// routes.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const toets = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const leeg = () => { for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); } };
  d.spel.teSpawnen = 0;
  leeg();
  const plek = d.plekVoor('Damstraat', 'knooppunt');
  const P = plek.positie;
  // Robots op een rij oostwaarts vanaf de mast: afstanden in meters tot de mast.
  function rij(afstanden, type = 'normal') {
    leeg();
    return afstanden.map(a => {
      d.spawnRobot(null, type);
      const robot = d.robots[d.robots.length - 1];
      robot.groep.position.set(P.x + a, 0, P.z);
      robot.hp = 10;
      return robot;
    });
  }
  const uit = {};

  // 1. Bouwen via het menu: optie 2 op een lege plek.
  d.geldZet(500);
  d.speler.positie.set(P.x + 1.4, 0, P.z);
  d.updateInteracties(0);
  uit.menu = document.getElementById('menuUI').textContent;
  toets('Digit2');
  const t = plek.toren;
  uit.bouw = { type: t?.type, geld: d.geldStand(), prijs: d.TOREN_TYPES.bovenleiding.prijs, obstakels: t?.obstakelHandles.length, inScene: t?.groep.parent === d.scene };
  d.speler.positie.set(P.x - 40, 0, P.z);
  d.updateInteracties(0);

  // 2. Zonder doelwit vuurt hij niet; ook niet op een robot net buiten bereik.
  leeg();
  t.cooldown = 0;
  d.updateTorens(0.5);
  uit.leeg = { treffers: d.vuurBovenleiding(t).length, spoor: t.spoor.visible, cooldown: t.cooldown };
  const [ver] = rij([d.BOVENLEIDING_NIVEAUS[0].bereik + 1.5]);
  t.cooldown = 0;
  for (let i = 0; i < 10; i++) d.updateTorens(0.1);
  uit.buitenBereik = { hp: ver.hp, spoor: t.spoor.visible };

  // 3. Niveau 1: 6 robots op 3 m van elkaar, de stoot raakt er 3, van
  // dichtbij naar ver, met aflopende schade.
  const niveau1 = rij([2, 5, 8, 11, 14, 17]);
  t.cooldown = 0;
  const treffers1 = d.vuurBovenleiding(t);
  uit.niveau1 = {
    geraakt: niveau1.map(x => +(10 - x.hp).toFixed(4)),
    volgorde: treffers1.map(x => niveau1.indexOf(x.robot)),
    spoor: t.spoor.visible, cooldown: t.cooldown, interval: d.BOVENLEIDING_NIVEAUS[0].schotInterval,
  };

  // 4. Een gat groter dan de sprongafstand breekt de keten.
  const gat = rij([2, 2 + d.BOVENLEIDING_NIVEAUS[0].sprong + 1.5, 20]);
  t.cooldown = 0;
  d.vuurBovenleiding(t);
  uit.gat = gat.map(x => +(10 - x.hp).toFixed(4));

  // 5. Niveaus: meer bereik, meer doelen, meer schade; nooit meer dan 4.
  uit.niveaus = [];
  for (const niveau of [2, 3]) {
    d.geldZet(1000);
    d.upgradeToren(t);
    const cfg = d.BOVENLEIDING_NIVEAUS[niveau - 1];
    const rijN = rij([2, 5, 8, 11, 14, 17]);
    t.cooldown = 0;
    d.vuurBovenleiding(t);
    const bereik = rij([cfg.bereik - 0.5]);
    t.cooldown = 0;
    d.vuurBovenleiding(t);
    uit.niveaus.push({ niveau: t.niveau, geraakt: rijN.map(x => +(10 - x.hp).toFixed(4)), bereikGeraakt: bereik[0].hp < 10, cfg });
  }

  // 6. Een actief schild vangt de stoot op en stopt de keten.
  const schild = rij([2, 4, 6], 'shieldbot');
  schild[0].schildActief = true;
  for (const x of schild.slice(1)) x.schildActief = false;
  t.cooldown = 0;
  d.vuurBovenleiding(t);
  uit.schild = schild.map(x => +(10 - x.hp).toFixed(4));

  // 7. Tempo: met een doelwit dat blijft staan vuurt hij elke schotInterval.
  const [staand] = rij([3]);
  staand.hp = 1e6;
  t.cooldown = 0;
  let stoten = 0;
  for (let i = 0; i < 100; i++) { const voor = staand.hp; d.updateTorens(0.1); if (staand.hp < voor) stoten++; }
  uit.tempo = { stoten, verwacht: Math.floor(10 / d.BOVENLEIDING_NIVEAUS[2].schotInterval) + 1 };

  // 8. Een bomber kiest de mast als doelwit; verkopen ruimt alles op.
  leeg();
  uit.bomberDoel = d.kiesBomberDoel({ x: P.x + 3, y: 0, z: P.z })?.type;
  const spoor = t.spoor;
  d.verkoopToren(t);
  uit.naVerkoop = { plek: plek.toren, spoorWeg: spoor.parent === null, inTorens: d.torens.includes(t) };
  return uit;
});

const factor = 0.75;
check('Het bouwmenu biedt de Bovenleiding aan als optie 2', r.menu.includes(`2, Bovenleiding €${r.bouw.prijs}`), r.menu);
check('2 bouwt een Bovenleiding in het torenslot (prijs afgeschreven, obstakel, in de scene)', r.bouw.type === 'bovenleiding' && r.bouw.geld === 500 - r.bouw.prijs && r.bouw.obstakels === 1 && r.bouw.inScene, r.bouw);
check('Zonder doelwit vuurt hij niet (geen treffers, geen boog, geen wachttijd)', r.leeg.treffers === 0 && !r.leeg.spoor && r.leeg.cooldown === 0, r.leeg);
check('Een robot net buiten bereik wordt niet geraakt', r.buitenBereik.hp === 10 && !r.buitenBereik.spoor, r.buitenBereik);
check('Niveau 1: de stoot raakt precies 3 robots, van dichtbij naar ver', r.niveau1.geraakt.filter(x => x > 0).length === 3 && r.niveau1.volgorde.join() === '0,1,2', r.niveau1);
check('Niveau 1: de schade loopt per sprong af met factor 0,75', Math.abs(r.niveau1.geraakt[0] - 1) < 1e-9 && Math.abs(r.niveau1.geraakt[1] - factor) < 1e-9 && Math.abs(r.niveau1.geraakt[2] - factor ** 2) < 1e-9, r.niveau1.geraakt);
check('Na een stoot staat de vonkboog aan en wacht de mast een schotInterval', r.niveau1.spoor && r.niveau1.cooldown === r.niveau1.interval, r.niveau1);
check('Een gat groter dan de sprongafstand breekt de keten', r.gat[0] > 0 && r.gat[1] === 0 && r.gat[2] === 0, r.gat);
for (const n of r.niveaus) {
  const geraakt = n.geraakt.filter(x => x > 0);
  check(`Niveau ${n.niveau}: raakt ${n.cfg.doelen} robots (nooit meer dan 4), eerste met ${n.cfg.schade} schade`, n.niveau && geraakt.length === n.cfg.doelen && geraakt.length <= 4 && Math.abs(geraakt[0] - n.cfg.schade) < 1e-9, n);
  check(`Niveau ${n.niveau}: de schade loopt af per sprong`, geraakt.every((x, i) => i === 0 || x < geraakt[i - 1]), geraakt);
  check(`Niveau ${n.niveau}: bereik ${n.cfg.bereik} m (robot op ${n.cfg.bereik - 0.5} m geraakt)`, n.bereikGeraakt, n);
}
check('De niveaus lopen op in bereik, doelen en schade', r.niveaus[0].cfg.bereik > 10 && r.niveaus[1].cfg.bereik > r.niveaus[0].cfg.bereik && r.niveaus[0].cfg.doelen >= 3 && r.niveaus[1].cfg.schade > r.niveaus[0].cfg.schade, r.niveaus.map(n => n.cfg));
check('Een actief schild vangt de stoot op en stopt de keten', r.schild.every(x => x === 0), r.schild);
check('Met een blijvend doelwit vuurt hij elke schotInterval (10 s)', Math.abs(r.tempo.stoten - r.tempo.verwacht) <= 1, r.tempo);
check('Een bomber kiest de Bovenleiding als doelwit', r.bomberDoel === 'bovenleiding', r.bomberDoel);
check('Verkopen ruimt mast en vonkboog op en maakt het torenslot vrij', r.naVerkoop.plek === null && r.naVerkoop.spoorWeg && !r.naVerkoop.inTorens, r.naVerkoop);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
