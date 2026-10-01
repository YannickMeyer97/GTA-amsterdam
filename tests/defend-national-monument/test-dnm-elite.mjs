// Ticket D68 (ROADMAP_monument.md, "Na M4 en de audit") — de elite-robots.
//
// De Pantserbot krijgt van torens maar een derde van de schade, van de
// speler gewoon 1 per treffer. De Splitser valt bij zijn dood (door speler
// of toren) uiteen in twee splinters op zijn plek op de route; haalt hij het
// monument, dan niet. Beide komen pas na de eerste baas in de mix, met een
// aankondiging die hun trucje uitlegt.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const poort = naam => d.SPAWN_POORTEN.find(p => p.naam === naam);
  const opRoute = (type, naam, s) => {
    d.spawnRobot(poort(naam), type);
    const b = d.robots[d.robots.length - 1];
    b.s = s;
    const p = d.robotRoutePunt(b, s);
    b.groep.position.set(p.x, 0, p.z);
    return b;
  };
  const meshes = robot => { let n = 0; robot.groep.traverse(x => { if (x.isMesh) n++; }); return n; };

  // 1. Wanneer ze meedoen.
  const trek = wave => { const set = new Set(); for (let i = 0; i < 2000; i++) set.add(d.kiesRobotTypeVoorWave(wave)); return set; };
  const w5 = trek(5), w6 = trek(6), w7 = trek(7), w8 = trek(8), w20 = trek(20);
  uit.mix = {
    w5: [...w5].sort(), w6: [...w6].sort(), w8: [...w8].sort(),
    pantserVanaf6: !w5.has('pantserbot') && w6.has('pantserbot'),
    splitserVanaf8: !w7.has('splitser') && w8.has('splitser'),
    nooitSplinter: !w20.has('splinter'),
  };
  uit.banner = { w6: d.waveBannerTekst(6), w8: d.waveBannerTekst(8) };
  // Ticket D70: vanaf wave 11 groeit hun aandeel.
  uit.groei = [8, 10, 11, 15, 19].map(w => d.eliteGewicht(w));

  // 2. De Pantserbot: een derde van de torenschade, volle spelerschade.
  d.resetRun();
  d.geldZet(1e6);
  const pantser = opRoute('pantserbot', 'Rokin', 10);
  pantser.snelheid = 0;
  const gewoon = opRoute('normal', 'Rokin', 12);
  gewoon.snelheid = 0;
  const schutter = d.bouwToren(d.plekVoor('Kalverstraat', 'knooppunt'), 'geschut');
  const hp0 = pantser.hp;
  const vonkenVoor = d.scene.children.length;
  d.vuurToren(schutter, pantser);
  const naToren = pantser.hp;
  const vonken = d.scene.children.length - vonkenVoor;
  d.raakRobot(pantser, 1, 'speler');
  const naSpeler = pantser.hp;
  const tweede = opRoute('pantserbot', 'Rokin', 14);
  uit.pantser = {
    hp0, torenSchade: d.torenStats(schutter).schadePerSchot, naToren, naSpeler, vonken,
    platen: meshes(pantser) > meshes(gewoon),
    gedeeldeGeo: pantser.groep.children.at(-1).geometry === tweede.groep.children.at(-1).geometry,
    kleiner: d.ROBOT_TYPES.pantserbot.torenFactor,
  };

  // 3. De Splitser: twee splinters, op zijn plek, in eigen banen.
  d.resetRun();
  const splitser = opRoute('splitser', 'Damrak', 15);
  splitser.laanFractie = 0;
  { const p = d.robotRoutePunt(splitser, 15); splitser.groep.position.set(p.x, 0, p.z); }   // ook echt op die baan
  const voor = d.robots.length;
  const killsVoor = { ...d.runStats.kills };
  d.raakRobot(splitser, 1, 'speler');
  const naEen = { leeft: d.robots.includes(splitser), robots: d.robots.length };
  d.raakRobot(splitser, 1, 'speler');
  const splinters = d.robots.filter(x => x.type === 'splinter');
  uit.splits = {
    naEen, weg: !d.robots.includes(splitser), erbij: d.robots.length - voor + 1,
    aantal: splinters.length, verwacht: d.ROBOT_TYPES.splitser.splitsIn,
    opRoute: splinters.every(x => x.route === splitser.route && x.modus === 'route' && Math.abs(x.s - 15) < 1e-9),
    banen: [...new Set(splinters.map(x => x.laanFractie))].length,
    dichtbij: splinters.every(x => Math.hypot(x.groep.position.x - splitser.groep.position.x, x.groep.position.z - splitser.groep.position.z) < 4),
    klein: splinters.every(x => x.groep.scale.x < splitser.groep.scale.x && x.hp === 1),
    sneller: d.ROBOT_TYPES.splinter.snelheidMultiplier > d.ROBOT_TYPES.splitser.snelheidMultiplier,
    kill: d.runStats.kills.splitser - killsVoor.splitser,
  };
  // Een splinter splitst niet verder, en telt als kill.
  const aantalVoor = d.robots.length;
  d.raakRobot(splinters[0], 1, 'speler');
  uit.splits.splinterDood = { robots: aantalVoor - d.robots.length, kill: d.runStats.kills.splinter };

  // Ook een torenkill splitst.
  d.resetRun();
  d.geldZet(1e6);
  const splitser2 = opRoute('splitser', 'Rokin', 10);
  splitser2.snelheid = 0;
  const kanon = d.bouwToren(d.plekVoor('Kalverstraat', 'knooppunt'), 'geschut');
  d.vuurToren(kanon, splitser2);
  uit.torenSplits = { weg: !d.robots.includes(splitser2), splinters: d.robots.filter(x => x.type === 'splinter').length };

  // Haalt een Splitser het monument, dan splitst hij niet.
  d.resetRun();
  const splitser3 = opRoute('splitser', 'Damrak', 5);
  d.robotRaaktMonument(splitser3);
  uit.monument = { splinters: d.robots.filter(x => x.type === 'splinter').length, schade: d.spel.schadeOpgelopen };

  // De wave is pas klaar als de splinters ook weg zijn.
  d.resetRun();
  d.startWave(8);
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0;
  const s4 = opRoute('splitser', 'Damrak', 5);
  d.raakRobot(s4, 5, 'speler');
  for (let i = 0; i < 5; i++) d.updateWaveSysteem(0.1);
  const klaarMetSplinters = d.spel.waveBonusGegeven;
  for (const x of [...d.robots]) d.raakRobot(x, 1, 'speler');
  for (let i = 0; i < 5; i++) d.updateWaveSysteem(0.1);
  uit.wave = { klaarMetSplinters, klaarZonder: d.spel.waveBonusGegeven };

  // 4. De aankondiging legt het trucje uit.
  const aankondiging = wave => {
    d.resetRun();
    d.spel.volgendePoorten = [];
    d.startWave(wave);
    for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
    d.spel.teSpawnen = 0;
    for (let i = 0; i < 25; i++) d.updateWaveSysteem(0.1);
    const banner = document.getElementById('waveBanner');
    return { tekst: banner.textContent, tip: banner.querySelector('.tip')?.textContent ?? null };
  };
  uit.tips = { voor6: aankondiging(5), voor8: aankondiging(7) };
  uit.namen = ['pantserbot', 'splitser', 'splinter'].map(t => d.ROBOT_WEERGAVENAMEN[t]);
  // Ticket D72: elk gewoon type een Nederlandse naam, elk type uit een poort een meervoud.
  const gewoneTypes = Object.keys(d.ROBOT_TYPES).filter(t => !d.ROBOT_TYPES[t].baas);
  uit.naamset = {
    zonderNaam: gewoneTypes.filter(t => !d.ROBOT_WEERGAVENAMEN[t]),
    zonderMeervoud: Object.keys(d.ROBOT_TYPE_VANAF).filter(t => t !== 'normal' && !d.ROBOT_TYPE_MEERVOUD[t]),
    engels: [...Object.values(d.ROBOT_WEERGAVENAMEN), ...Object.values(d.ROBOT_TYPE_MEERVOUD)].filter(n => /grunt|runner|bomber\b|shield/i.test(n)),
    namen: d.ROBOT_WEERGAVENAMEN,
  };
  d.resetRun();
  uit.naReset = d.robots.length;
  return uit;
});

check('Pantserbot pas vanaf wave 6, Splitser vanaf wave 8 in de mix', r.mix.pantserVanaf6 && r.mix.splitserVanaf8, r.mix);
check('Een splinter komt nooit uit een poort', r.mix.nooitSplinter, r.mix);
check('Hun gewicht is 3 tot wave 10 en groeit daarna elke wave (D70)', r.groei[0] === 3 && r.groei[1] === 3 && r.groei[2] > 3 && r.groei[3] > r.groei[2] && r.groei[4] > r.groei[3], r.groei);
check('De wavebanner meldt ze de eerste keer', /Pantserbots/.test(r.banner.w6) && /Splitsers/.test(r.banner.w8), r.banner);
check('Pantserbot: een torenschot doet een derde van zijn schade', Math.abs((r.pantser.hp0 - r.pantser.naToren) - r.pantser.torenSchade / 3) < 1e-9, r.pantser);
check('Pantserbot: de speler doet gewoon 1 per treffer', Math.abs((r.pantser.naToren - r.pantser.naSpeler) - 1) < 1e-9, r.pantser);
check('Pantserbot: een vonk bij een torenschot, platen op het lijf, gedeelde geometrie', r.pantser.vonken > 0 && r.pantser.platen && r.pantser.gedeeldeGeo, r.pantser);
check('Splitser: overleeft één treffer, valt bij de tweede uiteen in twee splinters', r.splits.naEen.leeft && r.splits.weg && r.splits.aantal === r.splits.verwacht && r.splits.aantal === 2, r.splits);
check('Splinters: op zijn route en plek, in twee banen, dichtbij', r.splits.opRoute && r.splits.banen === 2 && r.splits.dichtbij, r.splits);
check('Splinters: klein, 1 HP, sneller dan de Splitser', r.splits.klein && r.splits.sneller, r.splits);
check('Een splinter splitst niet verder; kills tellen per type', r.splits.splinterDood.robots === 1 && r.splits.splinterDood.kill === 1 && r.splits.kill === 1, r.splits);
check('Een torenkill splitst ook', r.torenSplits.weg && r.torenSplits.splinters === 2, r.torenSplits);
check('Haalt een Splitser het monument, dan geen splinters', r.monument.splinters === 0 && r.monument.schade > 0, r.monument);
check('De wave is pas klaar als de splinters ook weg zijn', r.wave.klaarMetSplinters === false && r.wave.klaarZonder === true, r.wave);
check('Vóór wave 6 legt de aankondiging de Pantserbot uit', /Pantserbot/.test(r.tips.voor6.tip ?? ''), r.tips.voor6);
check('Vóór wave 8 legt de aankondiging de Splitser uit', /Splitser/.test(r.tips.voor8.tip ?? ''), r.tips.voor8);
check('Eigen namen in het eindscherm', r.namen.join() === 'Pantserbot,Splitser,Splinter', r.namen);
check('Eén Nederlandse naamset (D72): elk type een naam en een meervoud, geen Engelse namen meer', r.naamset.zonderNaam.length === 0 && r.naamset.zonderMeervoud.length === 0 && r.naamset.engels.length === 0 && r.naamset.namen.normal === 'Loper' && r.naamset.namen.shieldbot === 'Schildbot', r.naamset);
check('Reset ruimt alles op', r.naReset === 0, r.naReset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
