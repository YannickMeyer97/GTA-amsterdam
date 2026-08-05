// Ticket 46: eventgolf Stroomuitval — tweede eventgolf naast de Mist.
// Bewaakt: deterministische afwisseling (golf 5/15/25.. = mist, golf
// 10/20/30.. = stroomuitval), stroomFactor op lampen/peer-emissive/
// winkelLicht (gedimd tijdens, lineair hersteld erna), oogboost (ook voor
// nieuwe spawns), eigen spawngewichten, audio, en dat de Mistgolf
// byte-voor-byte blijft werken (regressie t.o.v. Ticket 6-9).
// Zie ARCHITECTURE_NOTES.md §6.5 en ROADMAP.md Ticket 46.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. kiesEventType(): deterministische afwisseling ----------------------
const afwisseling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const r = {};
  for (const golf of [5, 10, 15, 20, 25, 30]) r[golf] = d.kiesEventType(golf);
  return r;
});
check('kiesEventType(): golf 5/15/25 = mist, golf 10/20/30 = stroomuitval',
  afwisseling[5] === 'mist' && afwisseling[15] === 'mist' && afwisseling[25] === 'mist' &&
  afwisseling[10] === 'stroomuitval' && afwisseling[20] === 'stroomuitval' && afwisseling[30] === 'stroomuitval',
  afwisseling);

// --- 1b. Feedback: `stroomVloer` (kelder-kamerlampen) moet NEUTRAAL zijn
// buiten een Stroomuitval — vóórdat sectie 2 hieronder stroomFactor dimt,
// moet de kelder-lamp-fractie hetzelfde zijn als een gewone hanglamp
// (beide gestuurd door dezelfde stroomFactor=1, dus geen enkel effect van
// stroomVloer op de normale stand). -----------------------------------------
const voorStroomuitval = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kelderLamp = d.lampLichten.find(l => l.stroomVloer !== undefined);
  const gewoneLamp = d.lampLichten.find(l => l.stroomVloer === undefined);
  return {
    stroomFactor: d.stroomFactor,
    kelderFractie: kelderLamp.licht.intensity / kelderLamp.basis,
    gewoneFractie: gewoneLamp.licht.intensity / gewoneLamp.basis,
  };
});
check('Vóór elke Stroomuitval is stroomFactor nog 1',
  voorStroomuitval.stroomFactor === 1, voorStroomuitval);
// Ruimere tolerantie: beide lampen hebben een eigen willekeurige flikkerfase
// (amp1/amp2 op de sinus), dus een klein verschil op een willekeurig moment
// is normaal — het gaat hier puur om "geen structurele afwijking van
// stroomVloer", niet om identieke waarden.
check('stroomVloer heeft GEEN effect in de normale stand: kelder-lampfractie ≈ gewone-lampfractie',
  Math.abs(voorStroomuitval.kelderFractie - voorStroomuitval.gewoneFractie) < 0.15, voorStroomuitval);

// --- 2. startGolf() op golf 10 zet actieveEventGolf + eigen banner --------
const startStroom = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 10;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const el = document.getElementById('golfBanner');
  return { actief: d.actieveEventGolf, banner: el.textContent, stroomFactor: d.stroomFactor };
});
check("startGolf() op golf 10 zet actieveEventGolf op 'stroomuitval'", startStroom.actief === 'stroomuitval', startStroom);
check('De banner noemt STROOMUITVAL', startStroom.banner.includes('STROOMUITVAL'), startStroom);
check('stroomFactor staat meteen op STROOMUITVAL_DIM_FACTOR (0.12)',
  startStroom.stroomFactor === 0.12, startStroom);

// --- 3. Lampen + peer-emissive + winkelLicht dimmen tijdens de Stroomuitval,
// het gedeelte buitenlicht (bouwLantaarn, niet in lampLichten) blijft
// ongemoeid (die staat hier los van, wordt niet aangeraakt) ----------------
const dimTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lamp = d.lampLichten[0];
  return {
    stroomFactor: d.stroomFactor,
    bolEmissiefBasis: lamp.bolEmissiefBasis,
    bolMateriaalAanwezig: !!lamp.bolMateriaal,
    emissiefVerwacht: lamp.bolEmissiefBasis * d.stroomFactor,
  };
});
check('lampLichten-entries hebben nu een bolMateriaal + bolEmissiefBasis (Ticket 46)',
  dimTest.bolMateriaalAanwezig && typeof dimTest.bolEmissiefBasis === 'number', dimTest);
check('De verwachte peer-emissive tijdens de Stroomuitval is duidelijk gedimd (basis * 0.12)',
  dimTest.emissiefVerwacht < 0.15 && dimTest.emissiefVerwacht > 0, dimTest);

// --- 4. Eén echte gameLoop-tick (wall-clock) dimt de bol-emissive
// daadwerkelijk, zonder de light-count te wijzigen (pointer lock is al
// gesimuleerd via openAmsterdamUndead) --------------------------------------
await frames(page, 2);   // een echte, gegarandeerd voltooide frame i.p.v. een wandklok-gok
const naEchteTick = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lamp = d.lampLichten[0];
  return {
    bolEmissief: lamp.bolMateriaal.emissiveIntensity,
    lichttelling: d.lampLichten.length,
    // Ticket 46-fix: het ECHTE puntlicht (wat de kamer daadwerkelijk
    // verlicht) moet nu ook merkbaar gedimd zijn, niet alleen het peertje —
    // dat was de bug die de speler meldde ("geen enkel verschil te zien").
    lichtIntensiteitFractie: lamp.licht.intensity / lamp.basis,
    daklichtenFracties: d.stroomGevoeligeDaklichten.map(dl => dl.licht.intensity / dl.basis),
    hemisfeerFractie: d.hemisfeerLicht.intensity / d.HEMISFEER_BASIS,
    exposureFractie: d.renderer.toneMappingExposure / d.EXPOSURE_BASIS,
    buitenFracties: d.buitenLichten.map(bl => bl.licht.intensity / bl.basis),
    buitenTelling: d.buitenLichten.length,
  };
});
check('Na een echte gameLoop-tick tijdens Stroomuitval is de peer-emissive daadwerkelijk gedimd',
  naEchteTick.bolEmissief < 0.2, naEchteTick);
check('Het ECHTE puntlicht van een hanglamp is ook duidelijk gedimd (< 20% van de basis-intensiteit)',
  naEchteTick.lichtIntensiteitFractie < 0.2, naEchteTick);
// Ticket 46-fix (feedback 3): de dakramen dimmen sinds de derde
// feedbackronde nog EXTRA (DAKRAAM_STROOM_EXTRA, bovenop stroomFactor) —
// het atelier hield door z'n vier eigen dakraam-lichten in absolute
// wattage nog te veel over t.o.v. de andere binnenruimtes.
check('Alle vier de ateliers-dakramen volgen exact stroomFactor * DAKRAAM_STROOM_EXTRA (0.12 * 0.55 = 0.066)',
  naEchteTick.daklichtenFracties.length === 4 &&
  naEchteTick.daklichtenFracties.every(f => Math.abs(f - 0.12 * 0.55) < 0.005), naEchteTick);
// Feedback: de kelder moet ongeveer even licht als de startkamer blijven,
// óók tijdens een Stroomuitval — pixelmeting liet zien dat de generieke
// 12%-vloer (net als de startkamer-lampen) de kelder véél te donker liet
// worden t.o.v. het atelier/de startkamer (materiaalverschil, zie
// ARCHITECTURE_NOTES.md §7.5.1-addendum). De kelder-kamerlampen kregen
// daarom een eigen `stroomVloer` (0,36) — zelfde formulepatroon als
// HEMISFEER_STROOM_VLOER, dus NEUTRAAL (fractie 1) bij stroomFactor=1, en
// een hogere fractie dan de generieke 12% zodra een Stroomuitval actief is.
// Kelderoost (feedback) kreeg zijn eigen lamp met dezelfde stroomVloer-tuning
// erbij: twee in de hoofdkelder + één in kelderoost = drie.
// CI-fix: lampDipFactor is een ONGERELATEERDE ambiance-dip (druppel-tik,
// zie updateDruppel()) die ditzelfde l.licht.intensity meevermenigvuldigt
// (zie de lampflikker-loop) — deze check test bewust ALLEEN de stroomVloer-
// formule, dus lampDipFactor hier expliciet op 1 vastzetten (i.p.v. een
// toevallig actieve dip laten meetellen) en één frame laten settelen.
await page.evaluate(() => { window.AmsterdamUndeadDebug.lampDipFactor = 1; });
await frames(page, 2);
const kelderLampenTick = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kelderLampen = d.lampLichten.filter(l => l.stroomVloer !== undefined);
  return {
    aantal: kelderLampen.length,
    fracties: kelderLampen.map(l => l.licht.intensity / l.basis),
    stroomVloerWaarden: kelderLampen.map(l => l.stroomVloer),
  };
});
check('Er zijn precies 3 kelder-kamerlampen met een eigen stroomVloer (2 hoofdkelder + 1 kelderoost)',
  kelderLampenTick.aantal === 3 && kelderLampenTick.stroomVloerWaarden.every(v => v === 0.36), kelderLampenTick);
// Ruimere tolerantie dan de andere Stroomuitval-fracties hierboven: deze
// lampen zitten (anders dan hemisfeer/exposure/buiten) ook nog in de
// gewone flikkerloop (amp1/amp2 op de sinus), dus de fractie schommelt van
// nature ±~9% rond de verwachte waarde.
check('De kelder-kamerlampen volgen ongeveer stroomVloer + (1-stroomVloer)*stroomFactor (0.36 + 0.64*0.12 = 0.4368, ±flikker)',
  kelderLampenTick.fracties.every(f => Math.abs(f - (0.36 + 0.64 * 0.12)) < 0.1), kelderLampenTick);
check('De kelder-kamerlampen dimmen tijdens Stroomuitval merkbaar minder hard dan een gewone hanglamp',
  kelderLampenTick.fracties.every(f => f > naEchteTick.lichtIntensiteitFractie), { kelderLampenTick, naEchteTick });
// Bij STROOMUITVAL_DIM_FACTOR (0.12) is de verwachte fractie de vloer plus
// het resterende aandeel van stroomFactor: vloer + (1-vloer)*0.12.
check('Het algehele hemisfeerlicht volgt exact HEMISFEER_STROOM_VLOER + (1-vloer)*stroomFactor (0.35 + 0.65*0.12 = 0.428)',
  Math.abs(naEchteTick.hemisfeerFractie - (0.35 + 0.65 * 0.12)) < 0.005, naEchteTick);
check('De camera-belichting (toneMappingExposure) volgt exact EXPOSURE_STROOM_VLOER + (1-vloer)*stroomFactor (0.4 + 0.6*0.12 = 0.472)',
  Math.abs(naEchteTick.exposureFractie - (0.4 + 0.6 * 0.12)) < 0.005, naEchteTick);
// Buitenlichten (maanlicht x2 + plaatsVulling + 4 binnenplaats-lantaarns +
// 1 gracht-lantaarn (Ticket 52) + 1 boot-lichtje (Feedback: fysieke
// aankomst) = 9) hebben een
// HOGERE vloer dan binnen (0.12) — buiten blijft net iets lichter, maar
// gaat wel duidelijk mee de donkere sfeer in. De vloer is twee keer
// bijgesteld na screenshot-pixelmetingen: eerste gok 0.2 bleek te laag
// (binnenplaats was dan zelfs donkerder dan het atelier, tegen de
// bedoeling in), 0.65 bleek weer te hoog ("nog wel licht op de vloer qua
// weerkaatsing, met name buiten") — uiteindelijk 0.4, samen met
// DAKRAAM_STROOM_EXTRA hierboven, geeft de door de gebruiker opgegeven
// doelverhouding (binnenplaats > atelier > woonkamer, elk merkbaar
// donkerder dan normaal).
check('buitenLichten bevat de 9 verwachte lichten (maanlicht, maanlichtDeur, plaatsVulling, 4 binnenplaats-lantaarns, 1 gracht-lantaarn, 1 boot-lichtje)',
  naEchteTick.buitenTelling === 9, naEchteTick);
// Feedback: binnenplaats tijdens Stroomuitval ~5% helderder — BUITEN_STROOM_
// VLOER 0.4 -> 0.5 (empirisch geverifieerd via pixelhelderheid: +5.0%).
check('Alle buitenlichten volgen exact BUITEN_STROOM_VLOER + (1-vloer)*stroomFactor (0.5 + 0.5*0.12 = 0.56)',
  naEchteTick.buitenFracties.every(f => Math.abs(f - (0.5 + 0.5 * 0.12)) < 0.005), naEchteTick);
check('Buiten blijft merkbaar lichter dan binnen tijdens dezelfde Stroomuitval (buiten-fractie > lamp-fractie)',
  naEchteTick.buitenFracties[0] > naEchteTick.lichtIntensiteitFractie, naEchteTick);
check('Buiten blijft ook merkbaar lichter dan het atelier (buiten-fractie > dakraam-fractie)',
  naEchteTick.buitenFracties[0] > naEchteTick.daklichtenFracties[0], naEchteTick);

// --- 5. Oogboost geldt ook voor Stroomuitval — sinds de feedbackronde met
// een EIGEN, fellere waarde dan de Mistgolf (OOG_INTENSITEIT_STROOMUITVAL,
// niet meer OOG_INTENSITEIT_MIST) -------------------------------------------
const oogboost = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bestaand = d.spawnOndode(0, 'normaal');
  const basisVoorEvent = bestaand.oogBasisIntensiteit;
  // Nieuwe spawn tijdens het al-actieve event:
  const nieuw = d.spawnOndode(0, 'normaal');
  return {
    bestaandGeboost: basisVoorEvent === d.OOG_INTENSITEIT_STROOMUITVAL,
    nieuwGeboost: nieuw.oogBasisIntensiteit === d.OOG_INTENSITEIT_STROOMUITVAL,
    fellerDanMist: d.OOG_INTENSITEIT_STROOMUITVAL > d.OOG_INTENSITEIT_MIST,
  };
});
check('Nieuwe spawns tijdens Stroomuitval krijgen de (fellere) OOG_INTENSITEIT_STROOMUITVAL-boost',
  oogboost.nieuwGeboost, oogboost);
check('OOG_INTENSITEIT_STROOMUITVAL is feller dan de Mistgolf-boost (feedback: "ogen mogen feller")',
  oogboost.fellerDanMist, oogboost);

// --- 6. Eigen spawngewichten: uitsluitend normaal/loper/sluiper -----------
const gewichtenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const gezien = new Set();
  for (let i = 0; i < 200; i++) gezien.add(d.kiesOndodeType());
  return [...gezien].sort();
});
check('Tijdens Stroomuitval spawnen uitsluitend normaal/loper/sluiper (geen sjouwer/brander)',
  gewichtenTest.every(t => ['normaal', 'loper', 'sluiper'].includes(t)), gewichtenTest);

// --- 7. eindigEventGolf(): stroomFactor herstelt NIET direct (geleidelijk),
// behalve bij direct=true (game over) --------------------------------------
const eindeGeleidelijk = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;
  d.updateGolf(0.1);   // golf rondt af -> eindigEventGolf(false)
  return { actief: d.actieveEventGolf, stroomFactorMeteen: d.stroomFactor };
});
check('Na golf-einde is actieveEventGolf weer null', eindeGeleidelijk.actief === null, eindeGeleidelijk);
check('stroomFactor is NIET meteen terug op 1 (geleidelijk herstel, geen directe reset)',
  eindeGeleidelijk.stroomFactorMeteen < 1, eindeGeleidelijk);

const eindeDirect = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 10;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const tijdens = d.stroomFactor;
  d.gameOver();   // direct=true: meteen terug, geen hangende ramp
  const na = d.stroomFactor;
  d.spelStaat.gameOver = false;
  document.getElementById('gameOverScherm').style.display = 'none';
  return { tijdens, na };
});
check('stroomFactor was gedimd vlak vóór game over', eindeDirect.tijdens === 0.12, eindeDirect);
check('gameOver() midden in een Stroomuitval herstelt stroomFactor meteen naar 1',
  eindeDirect.na === 1, eindeDirect);

// --- 8. Audio: klap bij start, herstel-tik bij einde -----------------------
const audioTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const klapVoor = d.stroomklapTeller, herstelVoor = d.stroomHerstelTeller;
  d.spelStaat.golf = 20;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const klapNa = d.stroomklapTeller;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golfActief = true;
  d.spelStaat.budget = 0;
  d.updateGolf(0.1);
  const herstelNa = d.stroomHerstelTeller;
  return { klapVoor, klapNa, herstelVoor, herstelNa };
});
check('speelStroomklap() wordt precies 1x aangeroepen bij het starten van de Stroomuitval',
  audioTest.klapNa === audioTest.klapVoor + 1, audioTest);
check('speelStroomHerstel() wordt precies 1x aangeroepen bij het einde van de Stroomuitval',
  audioTest.herstelNa === audioTest.herstelVoor + 1, audioTest);

// --- 9. Regressie: de Mistgolf blijft byte-voor-byte werken (fog, sluiper-
// exclusiviteit) — stroomFactor blijft op 1 tijdens een Mistgolf -----------
const mistRegressie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stroomFactor = 1;
  d.spelStaat.golf = 5;
  d.spelStaat.gameOver = false;
  d.startGolf();
  const fog = { near: d.scene.fog.near, far: d.scene.fog.far };
  const gewichten = new Set();
  for (let i = 0; i < 100; i++) gewichten.add(d.kiesOndodeType());
  return { fog, gewichten: [...gewichten], stroomFactorTijdensMist: d.stroomFactor };
});
check('Mistgolf (golf 5) gebruikt nog steeds FOG_MIST', mistRegressie.fog.near === 2.13 && mistRegressie.fog.far === 9.35, mistRegressie);
check('Mistgolf spawnt nog steeds uitsluitend Sluipers', mistRegressie.gewichten.length === 1 && mistRegressie.gewichten[0] === 'sluiper', mistRegressie);
check('stroomFactor blijft op 1 tijdens een Mistgolf (geen kruisbesmetting tussen de twee eventtypes)',
  mistRegressie.stroomFactorTijdensMist === 1, mistRegressie);

// --- 10. hemisfeerLicht/toneMappingExposure staan tijdens een Mistgolf (en
// dus stroomFactor === 1) weer op hun normale, volle waarde ----------------
await frames(page, 2);   // laat de flikker-loop het echt toepassen (echte frames i.p.v. een wandklok-gok)
const hemisfeerNaMist = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    hemisfeer: d.hemisfeerLicht.intensity,
    exposure: d.renderer.toneMappingExposure,
    buitenFracties: d.buitenLichten.map(bl => bl.licht.intensity / bl.basis),
  };
});
check('hemisfeerLicht staat weer op de volle HEMISFEER_BASIS (1.5) buiten een Stroomuitval',
  Math.abs(hemisfeerNaMist.hemisfeer - 1.5) < 0.01, hemisfeerNaMist);
check('toneMappingExposure staat weer op de volle EXPOSURE_BASIS (1.0) buiten een Stroomuitval',
  Math.abs(hemisfeerNaMist.exposure - 1.0) < 0.01, hemisfeerNaMist);
check('buitenLichten staan weer op hun volle basis-intensiteit buiten een Stroomuitval',
  hemisfeerNaMist.buitenFracties.every(f => Math.abs(f - 1) < 0.01), hemisfeerNaMist);

// --- 10. Lichttelling ongewijzigd t.o.v. Ticket 46 zelf: dat ticket dimt
// alleen bestaande lampen/materialen. Ticket 62 voegt daarna bewust drie
// nieuwe lampen toe (kelder, handmatig in lampLichten geregistreerd, zie
// amsterdam-undead.html) zodat de kelder hetzelfde flikker-/Stroomuitval-
// dimgedrag krijgt als elke andere lamp, en kelderoost (feedback) voegt er
// nog één toe — vandaar 5+3+1=9. -------------------------------------------
const lichttelling = await page.evaluate(() => window.AmsterdamUndeadDebug.lampLichten.length);
check('lampLichten bevat 9 entries (5 pre-Ticket-62-baseline + 3 kelder + 1 kelderoost)', lichttelling === 9, { lichttelling });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
