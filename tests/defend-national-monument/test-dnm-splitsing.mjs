// Ticket D58 (SONNET_EXECUTION_PLAN_monument.md, §12, fase P) — torens
// splitsen op niveau 3.
//
// Per toren twee richtingen, en elke richting doet wat hij belooft: Kanon
// (ontploffing), Scherpschutter (ver en hard), Hoogspanning (meer robots),
// Stroomval (vertraagt), Prikkeldraad (schade terug), Stadsmuur (veel HP).
// Het menu biedt beide aan; de keuze ligt daarna vast en staat in de naam.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

// Ticket D59: richting B is op slot tot je hem vrijspeelt; hier alles open.
const { browser, page, errs } = await openDefend({ initScript: `try { localStorage.setItem('defendNationalMonumentVoortgang', JSON.stringify({ bazen: { sloopkogel: true, dijkbreker: true, stoomwals: true }, overwinningen: 1, sterren: 3 })); } catch {}` });
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const leeg = () => { for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); } };
  // Een toren op niveau 3 in een richting, op een vaste plek.
  const toren = (type, richting, plek = d.plekVoor('Damstraat', 'knooppunt')) => {
    d.resetRun();
    d.geldZet(1e6);
    const t = d.bouwToren(plek, type);
    d.upgradeToren(t);
    d.upgradeToren(t, richting);
    return t;
  };
  // Robots op afstanden (m) oostwaarts van punt P, met veel HP.
  const rij = (P, afstanden, type = 'normal') => { leeg(); return afstanden.map(a => { d.spawnRobot(null, type); const x = d.robots.at(-1); x.groep.position.set(P.x + a, 0, P.z); x.hp = 50; return x; }); };

  // 1. Kanon: doelwit + wie binnen 3 m staat; verder niets.
  const kanon = toren('geschut', 'kanon');
  const Pk = kanon.plek.positie;
  const [doel, naast, ver] = rij(Pk, [5, 7, 10]);
  d.vuurToren(kanon, doel);
  uit.kanon = { naam: d.torenNaam(kanon), doel: 50 - doel.hp, naast: 50 - naast.hp, ver: 50 - ver.hp, stats: d.torenStats(kanon) };

  // 2. Scherpschutter: raakt op 20 m, met veel schade; langzaam.
  const scherp = toren('geschut', 'scherpschutter');
  const [verweg] = rij(scherp.plek.positie, [20]);
  scherp.cooldown = 0;
  d.updateTorens(0);
  uit.scherp = { naam: d.torenNaam(scherp), schade: 50 - verweg.hp, stats: d.torenStats(scherp), gewoonBereik: d.TOREN_TYPES.geschut.niveaus[1].bereik };

  // 3. Hoogspanning: 5 robots in één stoot.
  const hoog = toren('bovenleiding', 'hoogspanning');
  const ketting = rij(hoog.plek.positie, [2, 5, 8, 11, 14, 17]);
  d.vuurBovenleiding(hoog);
  uit.hoog = { naam: d.torenNaam(hoog), geraakt: ketting.filter(x => x.hp < 50).length };

  // 4. Stroomval: getroffen robots lopen een tijd half zo snel.
  const val = toren('bovenleiding', 'stroomval');
  leeg();
  d.spawnRobot(d.SPAWN_POORTEN.find(p => p.naam === 'Damstraat'), 'normal');
  const loper = d.robots[0];
  loper.hp = 50;
  loper.snelheid = 2;
  const meetStap = () => { const s0 = loper.s; for (let i = 0; i < 20; i++) d.updateRobots(1 / 20); return loper.s - s0; };
  const normaal = meetStap();
  // Raak hem met de stroomval (zet hem even vlak bij de mast).
  const pos = loper.groep.position.clone();
  loper.groep.position.set(val.plek.positie.x + 2, 0, val.plek.positie.z);
  d.vuurBovenleiding(val);
  loper.groep.position.copy(pos);
  const traag = meetStap();
  for (let i = 0; i < 80; i++) d.updateRobots(1 / 20);   // 4 s later: voorbij
  const weer = meetStap();
  uit.val = { naam: d.torenNaam(val), normaal, traag, weer, verhouding: traag / normaal, vertraging: loper.vertraging };

  // 5. Prikkeldraad: een robot die op het hek slaat, verliest HP. Stadsmuur: 600 HP.
  d.resetRun();
  d.geldZet(1e6);
  let hek = null;
  for (const plek of d.BOUWPLEKKEN) {
    if (plek.soort === 'drukpers') continue;
    const h = d.bouwToren(plek, 'hek');
    if (!h) continue;
    const proef = { route: d.ROUTES.get('Damstraat'), s: 0, modus: 'route', laanFractie: 0, groep: { position: new d.THREE.Vector3() } };
    if (d.hekOpRoute(proef)) { hek = h; break; }
    d.verkoopToren(h);
  }
  d.upgradeToren(hek);
  d.upgradeToren(hek, 'prikkeldraad');
  leeg();
  d.spawnRobot(d.SPAWN_POORTEN.find(p => p.naam === 'Damstraat'), 'tank');
  const tank = d.robots[0];
  tank.hp = 50;
  tank.snelheid = 2;   // vast: een trage tank haalde het hek (~39 m) soms niet binnen 40 s
  for (let t = 0; t < 40 && !d.hekVoorRobot(tank); t += 1 / 20) d.updateRobots(1 / 20);
  const hpBijHek = tank.hp;
  for (let i = 0; i < 20 * 4; i++) d.updateRobots(1 / 20);   // 4 s slaan: ~5 klappen
  uit.prikkel = { naam: d.torenNaam(hek), verlies: hpBijHek - tank.hp, hekHp: hek.hp, hekMax: hek.hpMax };
  const muurPlek = hek.plek;
  d.verkoopToren(hek);
  const muur = d.bouwToren(muurPlek, 'hek');
  d.upgradeToren(muur);
  d.upgradeToren(muur, 'stadsmuur');
  uit.muur = { naam: d.torenNaam(muur), hp: muur.hpMax };

  // 6. Het menu: op niveau 2 twee richtingen; kiezen met 2; daarna vast.
  d.resetRun();
  d.geldZet(1e6);
  const plek = d.plekVoor('Rokin', 'knooppunt');
  const t = d.bouwToren(plek, 'geschut');
  d.upgradeToren(t);
  d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z);
  d.updateInteracties(0);
  const menuVoor = document.getElementById('menuUI').textContent;
  // Cijfertoetsen tellen alleen met pointer lock: die even simuleren.
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  d.updateInteracties(0);
  const menuNa = document.getElementById('menuUI').textContent;
  uit.menu = { voor: menuVoor, na: menuNa, richting: t.richting, niveau: t.niveau, prompt: document.getElementById('interactiePrompt').textContent,
    nogmaals: d.upgradeToren(t, 'kanon') };
  d.resetRun();
  return uit;
});

check('Kanon: het doel krijgt 3, een robot 2 m ernaast 2 (ontploffing), een robot 5 m verder niets', r.kanon.naam === 'Kanon' && r.kanon.doel === 3 && r.kanon.naast === 2 && r.kanon.ver === 0, r.kanon);
check('Scherpschutter: raakt op 20 m (verder dan elk ander geschut) met 6 schade, maar trager', r.scherp.naam === 'Scherpschutter' && r.scherp.schade === 6 && r.scherp.stats.bereik > 20 && r.scherp.gewoonBereik < 20 && r.scherp.stats.schotInterval > 1.2, r.scherp);
check('Hoogspanning: één stoot raakt 5 robots', r.hoog.naam === 'Hoogspanning' && r.hoog.geraakt === 5, r.hoog);
check('Stroomval: een getroffen robot loopt half zo snel', r.val.naam === 'Stroomval' && Math.abs(r.val.verhouding - 0.5) < 0.1, r.val);
check('Stroomval: na 3 s loopt hij weer gewoon', r.val.vertraging === null && Math.abs(r.val.weer - r.val.normaal) < 0.05, r.val);
check('Prikkeldraad: een tank die op het hek slaat, verliest zelf HP (1 per klap)', r.prikkel.naam === 'Prikkeldraad' && r.prikkel.verlies >= 4 && r.prikkel.verlies <= 6 && r.prikkel.hekHp < r.prikkel.hekMax, r.prikkel);
check('Stadsmuur: 600 HP (dubbel zo veel als niveau 3 was)', r.muur.naam === 'Stadsmuur' && r.muur.hp === 600, r.muur);
check('Het menu op niveau 2 biedt beide richtingen, met prijs (€450 sinds D65) en uitleg', /1, ● Geschuttoren → Kanon €450/.test(r.menu.voor) && /2, ● Geschuttoren → Scherpschutter €450/.test(r.menu.voor)   /* D73: stip */, r.menu.voor);
check('Toets 2 kiest de Scherpschutter; het menu en de prompt noemen hem', r.menu.richting === 'scherpschutter' && r.menu.niveau === 3 && /Scherpschutter: maximaal niveau/.test(r.menu.na) && /Scherpschutter niv\. 3/.test(r.menu.prompt), r.menu);
check('Daarna ligt de richting vast: nog een upgrade kan niet', r.menu.nogmaals === false, r.menu);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
