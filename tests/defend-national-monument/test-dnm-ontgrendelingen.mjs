// Ticket D59 (SONNET_EXECUTION_PLAN_monument.md, §12, fase P) —
// ontgrendelingen tussen runs.
//
// Elke mijlpaal ontgrendelt het juiste: de Sloopkogel verslaan → de
// Scherpschutter, de Dijkbreker → de Stroomval, een overwinning → de
// Stadsmuur, 6 sterren → Zware nacht, 12 sterren → Avond op de Dam. Het
// overleeft herladen en een reset, een kapotte sleutel betekent niets
// ontgrendeld, en wat op slot zit is zichtbaar maar niet te kopen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
const KEY = 'defendNationalMonumentVoortgang';
async function met(opties, fn) {
  const { browser, page, errs } = await openDefend(opties);
  try { return await fn(page); } finally { alleErrs.push(...errs); await browser.close(); }
}
const bewaar = waarde => ({ initScript: `try { localStorage.setItem('${KEY}', ${JSON.stringify(waarde)}); } catch {}` });
const open = page => page.evaluate(() => Object.fromEntries(window.DamChaosDebug.ONTGRENDELINGEN.map(o => [o.id, window.DamChaosDebug.ontgrendeld(o.id)])));

// 1. Nieuw: alles op slot; B-richtingen niet te kopen; panel en knoppen tonen het.
const nieuw = await met({}, async page => {
  const uit = { open: await open(page) };
  uit.ui = await page.evaluate(() => {
    const d = window.DamChaosDebug;
    d.geldZet(1e6);
    const t = d.bouwToren(d.plekVoor('Rokin', 'knooppunt'), 'geschut');
    d.upgradeToren(t);
    const geweigerd = d.upgradeToren(t, 'scherpschutter');
    document.getElementById('ontgrendelKnop').click();
    return {
      geweigerd, niveau: t.niveau,
      knop: document.getElementById('ontgrendelKnop').textContent,
      paneel: getComputedStyle(document.getElementById('ontgrendelPaneel')).display,
      lijst: document.getElementById('ontgrendelLijst').textContent,
      nacht: document.querySelector('#nachtKeuze [data-nacht="zwaar"]').textContent,
      nachtKiezen: d.kiesZwareNacht(true),
      zwaar: d.spel.zwareNacht,
      startschermOpen: getComputedStyle(document.getElementById('startscherm')).display !== 'none',
    };
  });
  return uit;
});
check('Een nieuwe speler: alles op slot', Object.values(nieuw.open).every(v => v === false), nieuw.open);
check('Een vergrendelde richting is niet te kopen', nieuw.ui.geweigerd === false && nieuw.ui.niveau === 2, nieuw.ui);
check('Het ontgrendelpaneel opent vanaf het startscherm (0/5) en noemt hoe je elk ding krijgt', nieuw.ui.knop === 'Ontgrendelingen 0/5' && nieuw.ui.paneel === 'block' && /versla de Sloopkogel/.test(nieuw.ui.lijst) && /verzamel 12 sterren \(0\/12\)/.test(nieuw.ui.lijst) && nieuw.ui.startschermOpen, nieuw.ui);
check('Zwaar staat op slot met de voortgang, en kiezen kan niet', /^Zwaar 🔒 0\/6★/.test(nieuw.ui.nacht) && nieuw.ui.nachtKiezen === false && nieuw.ui.zwaar === false, nieuw.ui);

// 2. Mijlpalen in het spel: baas verslaan en winnen.
const spelen = await met({}, page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  // De Sloopkogel verslaan.
  d.resetRun();
  d.startWave(5);
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  d.raakRobot(d.levendeBaas(), 1000, 'speler');
  uit.naSloop = { scherp: d.ontgrendeld('scherpschutter'), stroom: d.ontgrendeld('stroomval'), melding: document.body.innerText.includes('Ontgrendeld: Scherpschutter!') };
  // De Dijkbreker.
  d.startWave(10);
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  d.raakRobot(d.levendeBaas(), 1000, 'toren');
  uit.naDijk = d.ontgrendeld('stroomval');
  // Winnen met 3 sterren.
  d.resetRun();
  d.startWave(15);
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
  uit.naWin = { muur: d.ontgrendeld('stadsmuur'), sterren: d.voortgang.sterren, winst: d.voortgang.overwinningen, regel: document.getElementById('winOntgrendeld').textContent };
  return uit;
}));
check('De Sloopkogel verslaan ontgrendelt de Scherpschutter (met een melding), niet de Stroomval', spelen.naSloop.scherp && !spelen.naSloop.stroom && spelen.naSloop.melding, spelen.naSloop);
check('De Dijkbreker verslaan ontgrendelt de Stroomval', spelen.naDijk, spelen);
check('Een overwinning ontgrendelt de Stadsmuur, telt de sterren en staat op het overwinningsscherm', spelen.naWin.muur && spelen.naWin.sterren === 3 && spelen.naWin.winst === 1 && /Ontgrendeld: Stadsmuur/.test(spelen.naWin.regel), spelen.naWin);

// 3. Overleeft herladen en een reset.
const herladen = await met(bewaar(JSON.stringify({ bazen: { sloopkogel: true, dijkbreker: false, stoomwals: false }, overwinningen: 1, sterren: 5 })), async page => {
  const a = await open(page);
  const b = await page.evaluate(() => { const d = window.DamChaosDebug; d.resetRun(); return Object.fromEntries(d.ONTGRENDELINGEN.map(o => [o.id, d.ontgrendeld(o.id)])); });
  return { a, b };
});
check('Na herladen: Scherpschutter en Stadsmuur open, de rest dicht (5 sterren < 6)', herladen.a.scherpschutter && herladen.a.stadsmuur && !herladen.a.stroomval && !herladen.a.zwareNacht && !herladen.a.avond, herladen.a);
check('Een reset van de run wist de ontgrendelingen niet', JSON.stringify(herladen.a) === JSON.stringify(herladen.b), herladen);

// 4. Zware nacht (6 sterren): meer en snellere robots, +1 ster; geldt per run.
const zwaar = await met(bewaar(JSON.stringify({ bazen: {}, overwinningen: 2, sterren: 6 })), page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = { open: d.ontgrendeld('zwareNacht') };
  const normaalDoel = d.spel.waveDoel;
  uit.kies = d.kiesZwareNacht(true);   // run nog niet begonnen: meteen
  uit.doel = { normaal: normaalDoel, zwaar: d.spel.waveDoel, verwacht: Math.round(normaalDoel * d.ZWARE_NACHT_AANTAL), hud: document.getElementById('waveUI').textContent };
  d.spel.maxActieveRobots = 1;
  d.updateWaveSysteem(0);
  uit.snelheid = d.robots[0].snelheid;
  // Winnen met 3 "gewone" sterren wordt er 4.
  d.startWave(15);
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0;
  d.updateWaveSysteem(0.1);
  uit.sterren = d.spel.sterren;
  uit.getoond = document.getElementById('winSterren').textContent.length;
  uit.besteSterren = d.leesHighscore().besteSterren;
  // Uitzetten midden in een run: geldt pas bij de volgende.
  d.resetRun();
  d.runStats.speelduur = 5;
  d.kiesZwareNacht(false);
  uit.middenInRun = d.spel.zwareNacht;
  d.resetRun();
  uit.volgendeRun = d.spel.zwareNacht;
  return uit;
}));
check('Met 6 sterren is Zware nacht open en te kiezen', zwaar.open && zwaar.kies, zwaar);
check('Zwaar (D66, was "Zware nacht"): 1,3 × zoveel robots, en de HUD zegt "zwaar"', zwaar.doel.zwaar === zwaar.doel.verwacht && zwaar.doel.zwaar > zwaar.doel.normaal && /· zwaar/.test(zwaar.doel.hud), zwaar.doel);
check('Zware nacht: een overwinning met 3 sterren wordt er 4 (en 4 plekken op het scherm)', zwaar.sterren === 4 && zwaar.getoond === 4 && zwaar.besteSterren === 4, zwaar);
check('Uitzetten midden in een run geldt pas vanaf de volgende run', zwaar.middenInRun === true && zwaar.volgendeRun === false, zwaar);

// 5. Avond op de Dam (12 sterren): alleen uiterlijk, en de Grachtenmist gaat er goed mee om.
const avond = await met(bewaar(JSON.stringify({ bazen: {}, overwinningen: 4, sterren: 12 })), page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const dag = { lucht: d.scene.background.getHex(), zon: d.zon.intensity };
  const kies = d.kiesAvond(true);
  const avond = { lucht: d.scene.background.getHex(), zon: d.zon.intensity, zonKleur: d.zon.color.getHex(), bewaard: JSON.parse(localStorage.getItem('defendNationalMonumentInstellingen')).avond };
  d.startWave(12);   // Grachtenmist
  const mist = d.scene.fog.far;
  d.startWave(13);   // weer gewoon: terug naar de avond, niet naar de dag
  const na = d.scene.background.getHex();
  d.kiesAvond(false);
  return { dag, kies, avond, mist, na, terug: d.scene.background.getHex() };
}));
check('Met 12 sterren: Avond op de Dam kiezen verandert lucht en zon, en wordt bewaard', avond.kies && avond.avond.lucht !== avond.dag.lucht && avond.avond.zon < avond.dag.zon && avond.avond.bewaard === true, avond);
check('Na de Grachtenmist komt de avondlucht terug, niet de dag; uitzetten geeft de dag terug', avond.mist === 38 && avond.na === avond.avond.lucht && avond.terug === avond.dag.lucht, avond);

// 6. Kapotte sleutel: niets ontgrendeld, geen fout.
for (const [naam, waarde] of [['geen JSON', '{kapot'], ['verkeerde typen', JSON.stringify({ bazen: 'alle', overwinningen: -3, sterren: 'veel' })], ['array', '[1,2,3]']]) {
  const r = await met(bewaar(waarde), open);
  check(`Kapotte sleutel (${naam}): niets ontgrendeld`, Object.values(r).every(v => v === false), r);
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
