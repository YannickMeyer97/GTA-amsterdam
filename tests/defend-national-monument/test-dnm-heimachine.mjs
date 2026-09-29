// Ticket D69 (ROADMAP_monument.md, "Na M4 en de audit") — De Heimachine,
// de vierde baas en de eindbaas van de run van 20 waves.
//
// Hij komt in wave 20, uit één poort. Om de HEIMACHINE_INTERVAL seconden
// valt het blok op de paal (vooraf gaat het zichtbaar omhoog); elke
// geschuttoren en Bovenleiding binnen HEIMACHINE_BEREIK ligt dan
// HEIMACHINE_STIL seconden stil, met een draaiende ring erboven. Verder weg
// schiet alles door. Verslaan telt als mijlpaal (bazen 4/4).
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const DT = 1 / 20;
  const leeg = () => { for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); } };
  const poort = naam => d.SPAWN_POORTEN.find(p => p.naam === naam);
  const opRoute = (type, naam, s) => {
    d.spawnRobot(poort(naam), type);
    const b = d.robots[d.robots.length - 1];
    b.s = s;
    const p = d.robotRoutePunt(b, s);
    b.groep.position.set(p.x, 0, p.z);
    return b;
  };

  // 1. Wave 20: de Heimachine als eerste spawn, uit één poort.
  d.resetRun();
  d.startWave(20);
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  const baas = d.levendeBaas();
  uit.wave20 = {
    baas: baas?.type, poorten: d.spel.actievePoorten.length, run: d.RUN_WAVES,
    naam: document.getElementById('baasNaam').textContent,
    blok: !!baas?.heiBlok, hp: baas?.hp, beloning: d.BAZEN.heimachine.beloning,
  };

  // 2. Het blok gaat vooraf omhoog, en valt bij de klap.
  d.resetRun();
  const hoogte = [];
  const hm = opRoute('heimachine', 'Damrak', 5);
  hm.snelheid = 0;
  const y0 = hm.heiBlok.position.y;
  for (let t = 0; t < d.HEIMACHINE_INTERVAL - 0.1; t += DT) d.updateRobots(DT);
  const yVoor = hm.heiBlok.position.y;
  for (let t = 0; t < 0.2; t += DT) d.updateRobots(DT);
  uit.blok = { y0, yVoor, yNa: hm.heiBlok.position.y };

  // 3. De klap legt torens binnen bereik stil, verder weg niet.
  d.resetRun();
  d.geldZet(1e6);
  const dichtPlek = d.plekVoor('Damrak', 'knooppunt'), stroomPlek = d.plekVoor('Damrak', 'voorpost');
  const route = d.ROUTES.get('Damrak');
  // Het punt op de route dat het dichtst bij allebei de plekken ligt.
  let s = 0, beste = Infinity;
  for (let t = 0; t < route.lengte; t += 0.25) {
    const p = d.robotRoutePunt({ route, laanFractie: 0 }, t);
    const m = Math.max(Math.hypot(p.x - dichtPlek.positie.x, p.z - dichtPlek.positie.z), Math.hypot(p.x - stroomPlek.positie.x, p.z - stroomPlek.positie.z));
    if (m < beste) { beste = m; s = t; }
  }
  const heier = opRoute('heimachine', 'Damrak', s);
  heier.snelheid = 0;
  heier.hp = 1e6;
  const dicht = d.bouwToren(dichtPlek, 'geschut');
  const stroom = d.bouwToren(stroomPlek, 'bovenleiding');
  const ver = d.bouwToren(d.plekVoor('Rokin', 'knooppunt'), 'geschut');
  const afstand = t => Math.hypot(t.plek.positie.x - heier.groep.position.x, t.plek.positie.z - heier.groep.position.z);
  const stil = d.heiKlap(heier);
  uit.klap = {
    stil, dichtAfstand: afstand(dicht), stroomAfstand: afstand(stroom), verAfstand: afstand(ver), bereik: d.HEIMACHINE_BEREIK,
    dicht: dicht.stilTimer, stroom: stroom.stilTimer, ver: ver.stilTimer ?? 0,
    ring: dicht.storing?.visible === true && dicht.storing.parent === dicht.groep,
    popup: /De Heimachine legt \d torens? stil/.test(document.body.innerText),
  };

  // 4. Een stilgelegde toren schiet niet; na HEIMACHINE_STIL weer wel.
  // (De torens richten zich op de Heimachine zelf: meet zijn HP.)
  const ringVoor = dicht.storing.rotation.y;
  const hpVoor = heier.hp;
  for (let t = 0; t < d.HEIMACHINE_STIL - 0.5; t += DT) d.updateTorens(DT);
  uit.stilSchiet = { hpVoor, hp: heier.hp, ringDraait: dicht.storing.rotation.y !== ringVoor, nogStil: dicht.stilTimer > 0 };
  for (let t = 0; t < 2; t += DT) d.updateTorens(DT);
  uit.weerAan = { geraakt: heier.hp < hpVoor, timer: dicht.stilTimer, ring: dicht.storing.visible };

  // 5. Verslaan: beloning, mijlpaal, 4/4.
  localStorage.clear();
  d.voortgang.bazen = { sloopkogel: true, dijkbreker: true, stoomwals: true, heimachine: false };
  const geldVoor = d.geldStand();
  d.raakRobot(heier, 1e7, 'speler');
  uit.verslagen = {
    geld: d.geldStand() - geldVoor, mijlpaal: d.voortgang.bazen.heimachine,
    bewaard: JSON.parse(localStorage.getItem('defendNationalMonumentVoortgang'))?.bazen?.heimachine,
    teller: document.getElementById('ontgrendelTotaal').textContent,
  };
  d.resetRun();
  leeg();
  uit.naReset = d.robots.length;
  return uit;
});

check('De run is 20 waves', r.wave20.run === 20, r.wave20);
check('Wave 20: De Heimachine als eerste spawn, uit één poort, met zijn naam in de balk', r.wave20.baas === 'heimachine' && r.wave20.poorten === 1 && r.wave20.naam === 'DE HEIMACHINE' && r.wave20.blok, r.wave20);
check('De Heimachine heeft meer HP dan de Stoomwals en de hoogste beloning', r.wave20.hp > 180 && r.wave20.beloning > 400, r.wave20);
check('Het blok gaat vooraf omhoog en valt bij de klap', r.blok.yVoor > r.blok.y0 + 1 && r.blok.yNa < r.blok.yVoor - 1, r.blok);
check('De klap legt de geschuttoren en de Bovenleiding binnen bereik stil', r.klap.dichtAfstand <= r.klap.bereik && r.klap.stroomAfstand <= r.klap.bereik && r.klap.dicht > 0 && r.klap.stroom > 0 && r.klap.stil >= 2, r.klap);
check('Een toren verder dan het bereik blijft werken', r.klap.verAfstand > r.klap.bereik && r.klap.ver === 0, r.klap);
check('Een draaiende ring boven de stilgelegde toren, en een melding', r.klap.ring && r.klap.popup, r.klap);
check('Stilgelegde torens schieten niet, ook niet op de baas naast hen', r.stilSchiet.hp === r.stilSchiet.hpVoor && r.stilSchiet.nogStil && r.stilSchiet.ringDraait, r.stilSchiet);
check('Na de stilligtijd schieten ze weer, en de ring is weg', r.weerAan.geraakt && r.weerAan.timer === 0 && !r.weerAan.ring, r.weerAan);
check('Verslaan: de beloning, en de mijlpaal wordt bewaard', r.verslagen.geld === 500 && r.verslagen.mijlpaal && r.verslagen.bewaard === true, r.verslagen);
check('Het ontgrendelpaneel telt vier bazen', /bazen verslagen: 4\/4/.test(r.verslagen.teller), r.verslagen.teller);
check('Reset ruimt alles op', r.naReset === 0, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
