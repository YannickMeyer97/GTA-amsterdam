// Ticket D57 (SONNET_EXECUTION_PLAN_monument.md, §12, fase P) — de drie
// bazen en hun eigen gedrag.
//
// De Sloopkogel slaat torens binnen bereik kapot (en laat verdere torens
// staan); de Dijkbreker breekt een hek in één klap en heeft een schild dat
// open en dicht gaat (dicht: geen schade van toren of stroom); de Stoomwals
// laat robots los op zijn route en wordt onder de helft woedend (sneller).
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const leeg = () => { for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); } };
  const poort = naam => d.SPAWN_POORTEN.find(p => p.naam === naam);
  const baasOp = (type, naam, s) => {
    d.spawnRobot(poort(naam), type);
    const b = d.robots[d.robots.length - 1];
    b.s = s;
    const p = d.robotRoutePunt(b, s);
    b.groep.position.set(p.x, 0, p.z);
    return b;
  };
  const tik = (sec, f = () => d.updateRobots(1 / 20)) => { for (let t = 0; t < sec; t += 1 / 20) f(); };

  // 1. De Sloopkogel: vorm, en torens binnen bereik gaan eraan.
  d.resetRun();
  d.geldZet(1e6);
  const knoop = d.plekVoor('Damrak', 'knooppunt');
  const voorpost = d.plekVoor('Damrak', 'voorpost');
  const dichtbij = d.bouwToren(knoop, 'geschut');
  const ver = d.bouwToren(voorpost, 'geschut');
  // Zet de kogel stil op het routepunt dat het dichtst bij de knooppunttoren ligt.
  const route = d.ROUTES.get('Damrak');
  const s = d.projecteerOpRoute(route, knoop.positie.x, knoop.positie.z).s;
  const sloop = baasOp('sloopkogel', 'Damrak', s);
  sloop.snelheid = 0;
  const hoekVoor = sloop.kogelPivot.rotation.y;
  tik(d.SLOOPKOGEL_INTERVAL + 0.2);
  uit.sloop = {
    heeftKogel: !!sloop.kogelPivot, draait: sloop.kogelPivot.rotation.y !== hoekVoor,
    afstandDichtbij: Math.hypot(knoop.positie.x - sloop.groep.position.x, knoop.positie.z - sloop.groep.position.z),
    afstandVer: Math.hypot(voorpost.positie.x - sloop.groep.position.x, voorpost.positie.z - sloop.groep.position.z),
    dichtbijWeg: !d.torens.includes(dichtbij), verStaat: d.torens.includes(ver), verHp: ver.hp, verHpMax: d.torenStats(ver).hp,
    bereik: d.SLOOPKOGEL_BEREIK,
  };

  // 2. De Dijkbreker: een hek van niveau 3 in één klap.
  d.resetRun();
  d.geldZet(1e6);
  // Een hek dat de route van de Dijkbreker echt afsluit: zoek over alle
  // bouwplekken de eerste waarvan het hek op de Damstraat-route ligt.
  let hek = null;
  for (const plek of d.BOUWPLEKKEN) {
    if (plek.soort === 'drukpers' || plek.hek) continue;
    const h = d.bouwToren(plek, 'hek');
    if (!h) continue;
    const proef = { route: d.ROUTES.get('Damstraat'), s: 0, modus: 'route', laanFractie: 0, groep: { position: new d.THREE.Vector3() } };
    if (d.hekOpRoute(proef)) { hek = h; break; }
    d.verkoopToren(h);
  }
  d.upgradeToren(hek); d.upgradeToren(hek);
  const hekHp = hek.hp;
  const dijk = baasOp('dijkbreker', 'Damstraat', 0);
  let t = 0, aanHek = null;
  while (d.torens.includes(hek) && t < 60) {
    d.updateRobots(1 / 20); t += 1 / 20;
    if (aanHek === null && d.hekVoorRobot(dijk)) aanHek = t;
  }
  uit.dijk = { hekWeg: !d.torens.includes(hek), hekHp, klapNa: aanHek === null ? null : t - aanHek, heeftSchild: !!dijk.schildMesh };

  // 3. Het schild: dicht blokkeert torenschoten en stroom, open niet.
  d.resetRun();
  const dijk2 = baasOp('dijkbreker', 'Rokin', 10);
  dijk2.snelheid = 0;
  dijk2.schildActief = true; dijk2.schildTimer = 99;
  const hp0 = dijk2.hp;
  d.geldZet(1e6);
  const schutter = d.bouwToren(d.plekVoor('Kalverstraat', 'knooppunt'), 'geschut');
  d.vuurToren(schutter, dijk2);
  const naDicht = dijk2.hp;
  dijk2.schildActief = false;
  d.vuurToren(schutter, dijk2);
  const naOpen = dijk2.hp;
  // De schildcyclus loopt: dicht en open wisselen.
  dijk2.schildActief = true; dijk2.schildTimer = d.ROBOT_TYPES.dijkbreker.schildDuur;
  const standen = new Set();
  tik(d.ROBOT_TYPES.dijkbreker.schildDuur + d.ROBOT_TYPES.dijkbreker.schildPauze + 0.5, () => { d.updateRobots(1 / 20); standen.add(dijk2.schildActief + ':' + dijk2.schildMesh.visible); });
  uit.schild = { hp0, naDicht, naOpen, standen: [...standen] };

  // 4. De Stoomwals: vorm, robots loslaten, woede.
  d.resetRun();
  const wals = baasOp('stoomwals', 'Kalverstraat', 5);
  const walsSnelheid = wals.snelheid;
  const voor = d.robots.length;
  tik(d.STOOMWALS_LOSLAAT_INTERVAL + 0.2);
  const losgelaten = d.robots.filter(x => x !== wals);
  uit.wals = {
    heeftWals: !!wals.wals, erbij: d.robots.length - voor, verwacht: d.STOOMWALS_LOSLAAT_AANTAL,
    opZijnRoute: losgelaten.every(x => x.route === wals.route && x.modus === 'route' && x.s <= wals.s),
    dichtbij: losgelaten.every(x => x.groep.position.distanceTo(wals.groep.position) < 6),
  };
  d.raakRobot(wals, Math.ceil(wals.hpMax * (1 - d.STOOMWALS_WOEDE_DREMPEL)) + 1);
  d.updateRobots(1 / 20);
  uit.woede = { woedend: wals.woedend, verwacht: d.STOOMWALS_WOEDE_SNELHEID, factor: wals.snelheid / walsSnelheid, banner: document.getElementById('waveBanner').textContent };
  d.updateRobots(1 / 20);
  uit.woede.eenmaal = wals.snelheid / walsSnelheid;

  // 5. Rook uit de schoorsteen, en alles ruimt op bij een reset.
  uit.rook = d.scene.children.filter(m => m.isMesh && m.material?.color?.getHex() === 0x5b5f66).length;
  d.resetRun();
  uit.naReset = { robots: d.robots.length };
  leeg();
  return uit;
});

check('Sloopkogel: een kogel aan een ketting, die rond draait', r.sloop.heeftKogel && r.sloop.draait, r.sloop);
check('Sloopkogel: de toren binnen bereik gaat kapot', r.sloop.afstandDichtbij <= r.sloop.bereik && r.sloop.dichtbijWeg, r.sloop);
check('Sloopkogel: een toren verder weg blijft heel', r.sloop.afstandVer > r.sloop.bereik && r.sloop.verStaat && r.sloop.verHp === r.sloop.verHpMax, r.sloop);
check('Dijkbreker: een hek op niveau 3 breekt in één klap (binnen één slaginterval)', r.dijk.hekWeg && r.dijk.hekHp >= 200 && r.dijk.klapNa !== null && r.dijk.klapNa <= 0.9, r.dijk);
check('Dijkbreker: een schild dat dicht toren- en stroomschade tegenhoudt, open niet', r.schild.naDicht === r.schild.hp0 && r.schild.naOpen < r.schild.naDicht, r.schild);
check('Dijkbreker: het schild gaat vanzelf open en dicht, en je ziet het', r.schild.standen.includes('true:true') && r.schild.standen.includes('false:false'), r.schild.standen);
check('Stoomwals: een wals voorop', r.wals.heeftWals, r.wals);
check('Stoomwals: laat na het interval robots los, op zijn eigen route, achter hem', r.wals.erbij === r.wals.verwacht && r.wals.opZijnRoute && r.wals.dichtbij, r.wals);
check('Stoomwals: onder de helft woedend, sneller, met een banner — en maar één keer', r.woede.woedend && Math.abs(r.woede.factor - r.woede.verwacht) < 1e-9 && Math.abs(r.woede.eenmaal - r.woede.verwacht) < 1e-9 && /woedend/.test(r.woede.banner), r.woede);
check('Stoomwals: de schoorsteen rookt', r.rook > 0, r.rook);
check('Reset ruimt alle bazen en losgelaten robots op', r.naReset.robots === 0, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
