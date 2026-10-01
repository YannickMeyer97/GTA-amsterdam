// Ticket D74 (audit 6) — de Klokslag, de eigen special onder X.
//
// Met een volle meter vertraagt X elke robot binnen het wapenbereik
// (KLOKSLAG.factor, KLOKSLAG.duur) en blijft het wapen KLOKSLAG.koelDuur
// seconden koel. Hij start niet meer de Kerkklok Boost (die robots sneller
// maakt). Een zwakkere vertraging (Stroomval) overschrijft hem niet. De
// meter, de hulpbalk en een eenmalige hint leggen het uit.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  const poort = naam => d.SPAWN_POORTEN.find(p => p.naam === naam);
  d.resetRun();
  localStorage.removeItem('defendNationalMonumentHints');
  d.gezieneHints.clear();
  // Twee robots: één dichtbij de speler, één ver weg.
  d.spawnRobot(poort('Damrak'), 'normal');
  const dichtbij = d.robots.at(-1);
  d.spawnRobot(poort('Rokin'), 'normal');
  const ver = d.robots.at(-1);
  d.speler.positie.set(dichtbij.groep.position.x + 5, 0, dichtbij.groep.position.z);
  uit.afstanden = [dichtbij, ver].map(x => Math.hypot(x.groep.position.x - d.speler.positie.x, x.groep.position.z - d.speler.positie.z));
  uit.bereik = d.WAPEN_BEREIK;

  // 1. Met een halve meter gebeurt er niets.
  d.spel.specialMeter = 50;
  d.gebruikSpecial();
  uit.halfVol = { meter: d.spel.specialMeter, vertraagd: !!dichtbij.vertraging };

  // 2. Meter vol: de hint, en de tekst in de HUD.
  d.spel.specialMeter = 92;
  d.spawnRobot(null, 'normal');
  d.vernietigRobot(d.robots.at(-1), 'speler');
  uit.vol = { meter: d.spel.specialMeter, hud: document.getElementById('specialUI').textContent, hint: document.getElementById('hintUI').textContent, gezien: d.gezieneHints.has('special') };

  // 3. X: vertraagt binnen bereik, niet daarbuiten; geen Kerkklok Boost.
  d.wapenWarmte.warmte = 100; d.wapenWarmte.oververhit = true;
  const geraakt = d.gebruikSpecial();
  uit.klok = {
    geraakt, meter: d.spel.specialMeter,
    dichtbij: dichtbij.vertraging, ver: ver.vertraging ?? null,
    boost: d.kerkklokBoost.active, snelheidsfactor: d.getRobotSpeedMultiplier(),
    warmte: d.wapenWarmte.warmte, oververhit: d.wapenWarmte.oververhit, perSchot: d.warmtePerSchotNu(),
    melding: /KLOKSLAG/.test(document.body.innerText),
  };
  // 4. Een Stroomval-treffer daarna overschrijft de sterkere vertraging niet.
  d.vertraagRobot(dichtbij, 0.5, 3);
  uit.stroomNa = { ...dichtbij.vertraging };
  // 5. Na de duur: weer op snelheid en weer warm.
  for (let t = 0; t < d.KLOKSLAG.duur + 0.2; t += 0.05) { d.updateRobots(0.05); d.updateKerkklokBoost(0.05); }
  uit.na = { vertraging: dichtbij.vertraging ?? null, perSchot: d.warmtePerSchotNu() };
  for (let t = 0; t < 1; t += 0.05) d.updateKerkklokBoost(0.05);
  uit.na.perSchotLater = d.warmtePerSchotNu();
  // 6. Reset: niet meer koel.
  d.spel.specialMeter = 100; d.gebruikSpecial();
  d.resetRun();
  uit.naReset = { perSchot: d.warmtePerSchotNu(), koel: d.klokslag.koelResterend };
  uit.hulp = document.getElementById('hulpUI').textContent;
  uit.start = document.querySelector('#startscherm .uitleg').textContent;
  return uit;
});

check('De proefopstelling: één robot binnen het wapenbereik, één erbuiten', r.afstanden[0] <= r.bereik && r.afstanden[1] > r.bereik, r.afstanden);
check('Met een halve meter doet X niets', r.halfVol.meter === 50 && !r.halfVol.vertraagd, r.halfVol);
check('Meter vol: "KLOKSLAG GEREED — druk X!" en een eenmalige hint die het uitlegt', r.vol.meter === 100 && /KLOKSLAG GEREED/.test(r.vol.hud) && r.vol.gezien && /Druk X/.test(r.vol.hint), r.vol);
check('X vertraagt de robot binnen bereik (factor en duur van KLOKSLAG), niet die erbuiten', r.klok.geraakt === 1 && r.klok.dichtbij?.factor === 0.4 && r.klok.dichtbij?.timer === 4 && r.klok.ver === null, r.klok);
check('X start geen Kerkklok Boost: robots worden niet sneller', !r.klok.boost && r.klok.snelheidsfactor === 1, r.klok);
check('X koelt het wapen meteen en houdt het koel; de meter is leeg; een melding', r.klok.warmte === 0 && !r.klok.oververhit && r.klok.perSchot === 0 && r.klok.meter === 0 && r.klok.melding, r.klok);
check('Een zwakkere vertraging daarna (Stroomval) overschrijft de Klokslag niet', r.stroomNa.factor === 0.4 && r.stroomNa.timer >= 3.9, r.stroomNa);
check('Na de duur loopt de robot weer op snelheid; na de koeltijd wordt het wapen weer warm', r.na.vertraging === null && r.na.perSchot === 0 && r.na.perSchotLater > 0, r.na);
check('Een reset haalt de koeling weg', r.naReset.perSchot > 0 && r.naReset.koel === 0, r.naReset);
check('Hulpbalk en startscherm noemen de klokslag', /X klokslag/.test(r.hulp) && /klokslag/.test(r.start), { hulp: r.hulp });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
