// Ticket D2 (SONNET_EXECUTION_PLAN_monument.md, Fase 0) — gedragstests die
// D4's herschaling moeten overleven.
//
// Het onderscheid met test-dnm-laadt.mjs (D1): dat bestand controleert dat
// de debug-hook bestaat, dit bestand controleert GEDRAG — maar uitsluitend
// in VERHOUDINGEN, nooit in absolute meters. D4 verschuift elke coördinaat;
// een check als "de poort staat op x=123" is dan na één ticket al waardeloos,
// terwijl "de poort ligt binnen GRENS" en "een robot bereikt het monument"
// dat niet zijn. Dit bestand is de referentie waartegen D4 wordt afgezet
// (zie ARCHITECTURE_NOTES_monument.md §10 punt 4 en 6).
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- 1. Spawnpoorten liggen binnen de wereldgrenzen -------------------------

const poortenControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  return d.SPAWN_POORTEN.map(p => ({
    naam: p.naam,
    binnenGrens: p.positie.x >= d.GRENS.minX && p.positie.x <= d.GRENS.maxX
      && p.positie.z >= d.GRENS.minZ && p.positie.z <= d.GRENS.maxZ,
  }));
});
check('Er zijn 5 spawnpoorten', poortenControle.length === 5, poortenControle);
for (const p of poortenControle) {
  check(`Poort "${p.naam}" ligt binnen GRENS`, p.binnenGrens, p);
}

// --- 2. Interactiepunten: binnen GRENS, bereikbaar, niet overlappend -------
//
// "Bereikbaar" is bewust NIET hetzelfde als isVrijePlek() op het exacte
// coördinaat: de Kerkklok- en Reparatie-markering liggen zelf op een kleine,
// eigen geregistreerde rechthoek (zie registreerRechthoek-aanroepen 1168/
// 1278) — dat is precies de bedoeling, je loopt niet DOORHEEN de markering.
// Wat telt is of de speler ergens binnen de interactieradius kan gaan staan.
// Daarom bemonsteren we 24 hoeken rond elk punt op 75% van zijn radius en
// eisen we minstens één vrije richting.
const puntenControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  function isBereikbaar(punt) {
    const afstand = punt.radius * 0.75;
    for (let hoek = 0; hoek < Math.PI * 2; hoek += Math.PI / 12) {
      const x = punt.positie.x + Math.cos(hoek) * afstand;
      const z = punt.positie.z + Math.sin(hoek) * afstand;
      if (d.isVrijePlek(x, z, 0)) return true;
    }
    return false;
  }
  const punten = d.interactiePunten.map(p => ({
    naam: p.naam,
    x: p.positie.x, z: p.positie.z, radius: p.radius,
    binnenGrens: p.positie.x >= d.GRENS.minX && p.positie.x <= d.GRENS.maxX
      && p.positie.z >= d.GRENS.minZ && p.positie.z <= d.GRENS.maxZ,
    bereikbaar: isBereikbaar(p),
  }));
  const overlappend = [];
  for (let i = 0; i < punten.length; i++) {
    for (let j = i + 1; j < punten.length; j++) {
      const afstand = Math.hypot(punten[i].x - punten[j].x, punten[i].z - punten[j].z);
      if (afstand < punten[i].radius + punten[j].radius) {
        overlappend.push([punten[i].naam, punten[j].naam, afstand]);
      }
    }
  }
  return { punten, overlappend };
});
// Ticket D10: 3 steunpunten + 10 bouwplekken. De overlap- en
// bereikbaarheidschecks hieronder gelden nu voor alle 13 — precies waar het
// plan ze voor bedoelde ("de radius-overlapcheck uit D2 wordt nu echt
// belangrijk").
check('Er zijn 13 interactiepunten (3 steunpunten + 10 bouwplekken)', puntenControle.punten.length === 13, puntenControle.punten.map(p => p.naam));
for (const p of puntenControle.punten) {
  check(`Interactiepunt "${p.naam}" ligt binnen GRENS`, p.binnenGrens, p);
  check(`Interactiepunt "${p.naam}" is bereikbaar binnen zijn radius`, p.bereikbaar, p);
}
check('Geen twee interactiepunten liggen binnen elkaars radius', puntenControle.overlappend.length === 0, puntenControle.overlappend);

// --- 3. Route-test: bereikt elke poort het monument? (vastloper-detector) --
//
// Dit is GEEN kopie van de echte robot-AI (die heeft tussenpunt-logica,
// zijwaarts ontwijken bij vastlopen, variabele snelheid — zie
// ARCHITECTURE_NOTES_monument.md §6.4). Het is een sterk vereenvoudigde
// simulatie — rechtdoor naar het doel, botsing oplossen, herhalen — die
// juist DAAROM een strengere stuk-detector is: als zelfs deze kale aanpak
// het monument haalt, kan een straat onmogelijk té smal zijn. Faalt hij,
// dan is dat een reden om te kijken, niet per se een bewezen bug (de echte
// AI kan wél om een obstakel heen wijken die dit script niet omzeilt).
//
// De aankomstdrempel schaalt met de botsstraal (straal + 0,15) i.p.v. de
// vaste 0,6 uit de game: die 0,6 is namelijk exact 0,45 (de echte,
// hardgecodeerde botsstraal — zie §6.4, config.schaal wordt genegeerd) plus
// 0,15 marge. Bij de tank-variant hieronder is de botsstraal groter dan de
// game ooit gebruikt (0,45 × 1,4 = 0,63) — de vaste 0,6 zou dan NOOIT
// gehaald worden, ongeacht of de straat breed genoeg is: het lichaam past
// dan letterlijk niet dichter bij de monumentdoos dan zijn eigen straal.
// Dat is een meetkundig feit over de aankomstdrempel, geen route-blokkade,
// en zou de test dus voor niets laten falen.
const routeControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const STAP = 0.25;
  const MAX_STAPPEN = 3000;
  const TUSSENPUNT_BEREIK = 6;   // zelfde constante als de echte AI (regel ~3057)

  function simuleerRoute(poort, straal) {
    const pos = { x: poort.positie.x, z: poort.positie.z };
    const tussenpunt = poort.tussenpunt || null;
    let tussenpuntBereikt = !tussenpunt;
    const aankomstDrempel = straal + 0.15;
    for (let i = 0; i < MAX_STAPPEN; i++) {
      if (tussenpunt && !tussenpuntBereikt && Math.hypot(pos.x - tussenpunt.x, pos.z - tussenpunt.z) < TUSSENPUNT_BEREIK) {
        tussenpuntBereikt = true;
      }
      const doel = (tussenpunt && !tussenpuntBereikt) ? tussenpunt : d.MONUMENT_POSITIE;
      const dx = doel.x - pos.x, dz = doel.z - pos.z;
      const lengte = Math.hypot(dx, dz);
      if (lengte < 1e-6) break;
      pos.x += (dx / lengte) * STAP;
      pos.z += (dz / lengte) * STAP;
      d.losBotsingenOp(pos, straal);
      if (d.afstandTotMonument(pos) < aankomstDrempel) {
        return { bereikt: true, stappen: i + 1 };
      }
    }
    return { bereikt: false, stappen: MAX_STAPPEN, eindpositie: { x: pos.x, z: pos.z } };
  }

  const NORMAAL_STRAAL = 0.45;   // de echte, hardgecodeerde robot-botsstraal
  const TANK_STRAAL = 0.45 * 1.4;   // grootste ROBOT_TYPES.schaal (tank) — zie §6.1

  return d.SPAWN_POORTEN.map(p => ({
    naam: p.naam,
    normaal: simuleerRoute(p, NORMAAL_STRAAL),
    tank: simuleerRoute(p, TANK_STRAAL),
  }));
});
for (const r of routeControle) {
  check(`Route vanaf "${r.naam}" (normale botsstraal) bereikt het monument`, r.normaal.bereikt, r.normaal);
  check(`Route vanaf "${r.naam}" (tank-botsstraal, strenger dan de game) bereikt het monument`, r.tank.bereikt, r.tank);
}

// --- 4. Wave-formules ------------------------------------------------------

const waveControle = await page.evaluate((waves) => {
  const d = window.DamChaosDebug;
  return waves.map(n => {
    d.startWave(n);
    return {
      wave: n,
      waveDoel: d.spel.waveDoel,
      verwachtWaveDoel: 7 + n * 3,
      teSpawnen: d.spel.teSpawnen,
      maxActieveRobots: d.spel.maxActieveRobots,
      verwachtMaxActieveRobots: Math.min(5 + Math.floor(n * 0.65), 13),
    };
  });
}, [1, 5, 10, 13, 20]);
for (const w of waveControle) {
  check(`startWave(${w.wave}): waveDoel = 7 + ${w.wave}·3`, w.waveDoel === w.verwachtWaveDoel, w);
  check(`startWave(${w.wave}): teSpawnen begint gelijk aan waveDoel`, w.teSpawnen === w.waveDoel, w);
  check(`startWave(${w.wave}): maxActieveRobots = min(5 + ⌊${w.wave}·0,65⌋, 13)`, w.maxActieveRobots === w.verwachtMaxActieveRobots, w);
}
check('Het plafond van 13 actieve robots is bereikt bij wave 13 én blijft zo bij wave 20',
  waveControle.find(w => w.wave === 13).maxActieveRobots === 13 && waveControle.find(w => w.wave === 20).maxActieveRobots === 13,
  waveControle);

// --- 5. kiesRobotTypeVoorWave: alleen ontgrendelde types per wave ----------
//
// 1000 trekkingen per wave i.p.v. één — dit is een gewogen loting
// (kiesRobotTypeVoorWave, regel 2515), dus een enkele trekking bewijst niets
// over welke types WEL en NIET voorkomen. Verzamelingen vergelijken i.p.v.
// tellen: de exacte verdeling is balans (D16's terrein), dit bewaakt alleen
// dat er nooit een nog-niet-aangekondigd type verschijnt.
const typeControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const N = 1000;
  function ontgrendeldeTypesVoorWave(wave) {
    const drempel = { normal: 1, sprinter: 2, tank: 3, bomber: 4, shieldbot: 5 };
    return new Set(Object.keys(d.ROBOT_TYPES).filter(t => wave >= drempel[t]));
  }
  return [1, 2, 3, 4, 5, 8].map(wave => {
    const getrokken = new Set();
    for (let i = 0; i < N; i++) getrokken.add(d.kiesRobotTypeVoorWave(wave));
    return { wave, getrokken: [...getrokken].sort(), verwacht: [...ontgrendeldeTypesVoorWave(wave)].sort() };
  });
});
for (const t of typeControle) {
  check(`kiesRobotTypeVoorWave(${t.wave}) trekt uitsluitend ontgrendelde types (verwacht: ${t.verwacht.join(', ')})`,
    JSON.stringify(t.getrokken) === JSON.stringify(t.verwacht), t);
}

// --- 6. Upgradekosten volgen basis + niveau·basis --------------------------

const upgradeControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const basis = { vuurtempo: 100, pickup: 150, snelheid: 200 };
  const orig = { ...d.upgrades };
  const resultaat = {};
  for (const type of Object.keys(basis)) {
    resultaat[type] = [];
    for (let niveau = 0; niveau <= 4; niveau++) {
      d.upgrades[type] = niveau;
      resultaat[type].push({ niveau, kosten: d.upgradeKosten(type), verwacht: basis[type] + niveau * basis[type] });
    }
  }
  Object.assign(d.upgrades, orig);
  return resultaat;
});
for (const [type, niveaus] of Object.entries(upgradeControle)) {
  for (const n of niveaus) {
    check(`upgradeKosten("${type}") op niveau ${n.niveau} = ${n.verwacht}`, n.kosten === n.verwacht, n);
  }
}

// --- 7. Schotcooldown daalt monotoon en respecteert het plafond ------------
//
// Let op: het plafond van 0,07s wordt NIET alleen door vuurtempo-niveau 5
// gehaald. huidigeSchotCooldown() = max(0.07, (0.26 - niveau·0,035) ×
// getComboVuurtempoMultiplier()). Op niveau 5 zonder combo is dat
// max(0.07, 0.085×1) = 0,085s — het plafond raak je pas met niveau 5 ÉN
// combo ≥ 10 (multiplier 0,7): max(0.07, 0.085×0,7) = max(0.07, 0.0595) =
// 0,07. Beide gevallen apart controleren, anders test je een formule die de
// game niet heeft.
const cooldownControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const origNiveau = d.upgrades.vuurtempo;
  const origCombo = d.spel.combo;
  d.spel.combo = 0;
  const waarden = [];
  for (let niveau = 0; niveau <= 5; niveau++) {
    d.upgrades.vuurtempo = niveau;
    waarden.push(d.huidigeSchotCooldown());
  }
  d.upgrades.vuurtempo = 5;
  d.spel.combo = 10;
  const metVolleCombo = d.huidigeSchotCooldown();
  d.upgrades.vuurtempo = origNiveau;
  d.spel.combo = origCombo;
  return { waarden, metVolleCombo };
});
check('huidigeSchotCooldown() daalt monotoon met elk vuurtempo-niveau (combo = 0)',
  cooldownControle.waarden.every((w, i) => i === 0 || w < cooldownControle.waarden[i - 1]), cooldownControle);
check('huidigeSchotCooldown() op niveau 5 zonder combo is 0,085s (nog boven het plafond)',
  Math.abs(cooldownControle.waarden[5] - 0.085) < 1e-9, cooldownControle);
check('huidigeSchotCooldown() op niveau 5 mét combo ≥ 10 raakt het plafond van 0,07s',
  Math.abs(cooldownControle.metVolleCombo - 0.07) < 1e-9, cooldownControle);

// --- 8. robotRaaktMonument(): schade, combo-reset, game-over ---------------
//
// Bewust als LAATSTE sectie: dit is de enige destructieve check (zet
// spel.gameOver op true) en niets hierna mag van een schone staat uitgaan.

const schadeControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.gameOver = false;
  d.spel.monumentHP = 100;
  d.spel.combo = 6;
  d.spel.waveGeenMonumentSchade = true;
  d.spawnRobot(null, 'bomber');
  const robot = d.robots[d.robots.length - 1];
  const verwachteSchade = d.ROBOT_TYPES.bomber.monumentSchade;
  d.robotRaaktMonument(robot);
  return {
    verwachteSchade,
    monumentHPNa: d.spel.monumentHP,
    comboNa: d.spel.combo,
    waveGeenMonumentSchadeNa: d.spel.waveGeenMonumentSchade,
    gameOverNa: d.spel.gameOver,
  };
});
check('robotRaaktMonument() trekt exact robot.monumentSchade van monumentHP af',
  schadeControle.monumentHPNa === 100 - schadeControle.verwachteSchade, schadeControle);
check('robotRaaktMonument() zet de combo op 0', schadeControle.comboNa === 0, schadeControle);
check('robotRaaktMonument() zet waveGeenMonumentSchade op false', schadeControle.waveGeenMonumentSchadeNa === false, schadeControle);
check('robotRaaktMonument() zet gameOver nog niet (HP > 0)', schadeControle.gameOverNa === false, schadeControle);

const gameOverControle = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.gameOver = false;
  d.spawnRobot(null, 'normal');
  const robot = d.robots[d.robots.length - 1];
  d.spel.monumentHP = d.ROBOT_TYPES.normal.monumentSchade;   // exact genoeg voor de doodsklap
  d.robotRaaktMonument(robot);
  return { monumentHPNa: d.spel.monumentHP, gameOverNa: d.spel.gameOver };
});
check('robotRaaktMonument() klemt monumentHP op 0, nooit negatief', gameOverControle.monumentHPNa === 0, gameOverControle);
check('robotRaaktMonument() zet gameOver op true zodra monumentHP het nulpunt raakt', gameOverControle.gameOverNa === true, gameOverControle);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
