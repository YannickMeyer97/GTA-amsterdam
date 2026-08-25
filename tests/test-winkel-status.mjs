// Winkel W3 (Ticket 37): statusweergave, winkelLicht en koop-feedback.
// Bewaakt: status() per stijl reageert op geld/HP/gekocht-flags, de
// update-loop pulst 'beschikbaar' maar staat stil bij 'teDuur', dooft
// eenmalig bij 'gekocht' en slaat gedoofde markeringen daarna over (behalve
// tijdens hun koop-flits), de Smederij-status volgt het actieve wapen,
// winkelLicht hecht zich aan de dichtstbijzijnde niet-gedoofde winkel
// binnen 6 m en dooft daarbuiten, en koop-functies triggeren flitsMarkering.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();
// Ticket 135 (§12.6): de ammo-kist-status is nu 'nvt' zonder vuurwapen (de
// speler start met een mes) — eerst een geladen vuurwapen toekennen zodat
// sectie 1 hieronder daadwerkelijk de GELD-afhankelijke status test, niet
// de nieuwe wapen-afhankelijke 'nvt'-tak (die heeft zijn eigen dekking in
// test-arsenaal-randgevallen.mjs).
await geefSpelerVuurwapen(page);

// --- 1. Statusovergangen op geld ------------------------------------------
const geldStatus = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 0;
  const teDuur = d.WINKEL_STIJLEN.ammo.status();
  d.spelStaat.geld = d.AMMO_PRIJS;
  const beschikbaar = d.WINKEL_STIJLEN.ammo.status();
  return { teDuur, beschikbaar };
});
check('Met €0 is de ammo-kist "teDuur"', geldStatus.teDuur === 'teDuur', geldStatus);
check('Met genoeg geld is de ammo-kist "beschikbaar"', geldStatus.beschikbaar === 'beschikbaar', geldStatus);

// --- 2. Statusovergangen op eenmalige gekocht-vlaggen ---------------------
const vlagStatus = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  const uit = {};

  // snelspannerGekocht/pantserdrankGekocht/ratelaarGekocht zijn read-only
  // debug-getters (geen setter) — de status via de ECHTE koop-functie
  // triggeren is zowel de enige werkende weg als de realistischere test.
  uit.werkbankVoor = d.WINKEL_STIJLEN.werkbank.status();
  d.koopSnelspanner();
  uit.werkbankNa = d.WINKEL_STIJLEN.werkbank.status();

  uit.pantserdrankVoor = d.WINKEL_STIJLEN.pantserdrank.status();
  d.koopPantserdrank();
  uit.pantserdrankNa = d.WINKEL_STIJLEN.pantserdrank.status();

  uit.ratelaarVoor = d.WINKEL_STIJLEN.ratelaar.status();
  d.koopRatelaar();
  uit.ratelaarNa = d.WINKEL_STIJLEN.ratelaar.status();

  uit.deur1Voor = d.WINKEL_STIJLEN.deur1.status();
  d.koopDeur();
  uit.deur1Na = d.WINKEL_STIJLEN.deur1.status();

  return uit;
});
check('Werkbank (Snelheidselixer): "beschikbaar" voor, "gekocht" na snelspannerGekocht',
  vlagStatus.werkbankVoor === 'beschikbaar' && vlagStatus.werkbankNa === 'gekocht', vlagStatus);
check('Pantserdrank: "beschikbaar" voor, "gekocht" na pantserdrankGekocht',
  vlagStatus.pantserdrankVoor === 'beschikbaar' && vlagStatus.pantserdrankNa === 'gekocht', vlagStatus);
check('Ratelaar: "beschikbaar" voor, "gekocht" na ratelaarGekocht',
  vlagStatus.ratelaarVoor === 'beschikbaar' && vlagStatus.ratelaarNa === 'gekocht', vlagStatus);
check('Deur 1: "beschikbaar" voor, "gekocht" na koopDeur()',
  vlagStatus.deur1Voor === 'beschikbaar' && vlagStatus.deur1Na === 'gekocht', vlagStatus);

// --- 3. Smederij-status volgt het ACTIEVE wapen (randgeval) ---------------
// Fix 5: twee Smederij-niveaus per wapen — 'gekocht' pas na BEIDE niveaus,
// dus koopSmederij() hier bewust tweemaal per wapen aangeroepen.
const smederijStatus = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  // Ticket 134: de speler start met het mes — eerst garanderen dat de
  // AMSTEL-9 bezeten is (wisselWapen() no-opt anders stilzwijgend).
  if (!d.wapenStaten.drukspuit) d.koopAmstel9();
  if (d.actiefWapenNaam !== 'drukspuit') d.wisselWapen();
  const voorSmeden = d.WINKEL_STIJLEN.smederij.status();
  d.koopSmederij();   // niveau 1 van de ACTIEVE Drukspuit
  const naNiveau1 = d.WINKEL_STIJLEN.smederij.status();
  d.koopSmederij();   // niveau 2: nu pas volledig gesmeed
  const naDrukspuitGesmeed = d.WINKEL_STIJLEN.smederij.status();
  if (!d.ratelaarGekocht) d.koopRatelaar(); else d.wisselWapen();   // wisselt naar de Ratelaar
  const opNietGesmedeRatelaar = d.WINKEL_STIJLEN.smederij.status();
  d.koopSmederij();   // niveau 1
  d.koopSmederij();   // niveau 2: smeedt nu ook de Ratelaar volledig
  const naBeideGesmeed = d.WINKEL_STIJLEN.smederij.status();
  d.wisselWapen();   // terug naar de (al gesmede) Drukspuit
  const terugOpGesmedeDrukspuit = d.WINKEL_STIJLEN.smederij.status();
  return { voorSmeden, naNiveau1, naDrukspuitGesmeed, opNietGesmedeRatelaar, naBeideGesmeed, terugOpGesmedeDrukspuit };
});
check('Vóór smeden: "beschikbaar"', smederijStatus.voorSmeden === 'beschikbaar', smederijStatus);
check('Na niveau 1 van de actieve Drukspuit: nog steeds "beschikbaar" (niveau 2 nog te koop)',
  smederijStatus.naNiveau1 === 'beschikbaar', smederijStatus);
check('Na beide niveaus van de actieve Drukspuit: "gekocht"',
  smederijStatus.naDrukspuitGesmeed === 'gekocht', smederijStatus);
check('Na wisselen naar de nog niet gesmede Ratelaar: weer "beschikbaar" (volgt het actieve wapen)',
  smederijStatus.opNietGesmedeRatelaar === 'beschikbaar', smederijStatus);
check('Zijn beide wapens volledig gesmeed, dan blijft de status "gekocht"',
  smederijStatus.naBeideGesmeed === 'gekocht', smederijStatus);
check('Terug op de (nog steeds volledig gesmede) Drukspuit: weer "gekocht"',
  smederijStatus.terugOpGesmedeDrukspuit === 'gekocht', smederijStatus);

// --- 4. Watertap: "nvt" bij volle HP, herstelt zodra HP < max -------------
const watertapStatus = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  const vol = d.WINKEL_STIJLEN.watertap.status();
  d.spelerStaat.hp = d.spelerStaat.hpMax - 10;
  const nietVol = d.WINKEL_STIJLEN.watertap.status();
  return { vol, nietVol };
});
check('Watertap bij volle HP: "nvt"', watertapStatus.vol === 'nvt', watertapStatus);
check('Watertap zodra HP < max: weer normale status (niet "nvt")',
  watertapStatus.nietVol !== 'nvt', watertapStatus);

// --- 5. updateWinkelMarkeringen(): puls bij beschikbaar, stilstand bij
// teDuur, gedoofd + geskipt bij gekocht -------------------------------------
// Let op: klok telt alleen op in de ECHTE gameLoop (gameLoop's eigen
// `klok += dt`, buiten updateWinkelMarkeringen om) — losse, synchrone
// d.updateWinkelMarkeringen(dt)-aanroepen binnen één evaluate() laten klok
// dus niet vorderen (geen sin-puls), terwijl de dt-gedreven icoon-rotatie
// wél gewoon optelt. De rotatie-/stilstand-checks gebruiken daarom losse
// ticks; de opacity-puls-check leunt op de ECHTE, al draaiende gameLoop
// (simuleerPointerLock: true) via een korte, echte wachttijd.
const animatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Verse, nog nooit-geziene markering voor een schoon "vóór"-nulmeting: de
  // watertap staat altijd op 'beschikbaar' of 'teDuur', nooit 'gekocht'.
  d.spelStaat.geld = 100000;
  const icoon = d.watertapMarkering.children[1];
  const rotVoor = icoon.rotation.y;
  for (let i = 0; i < 5; i++) d.updateWinkelMarkeringen(0.1);
  const rotNa = icoon.rotation.y;

  d.spelStaat.geld = 0;
  const rotVoorTeDuur = icoon.rotation.y;
  const opaciteitenTeDuur = [];
  const ring = d.watertapMarkering.children[0];
  for (let i = 0; i < 5; i++) { d.updateWinkelMarkeringen(0.1); opaciteitenTeDuur.push(ring.material.opacity); }
  const rotNaTeDuur = icoon.rotation.y;

  return {
    rotVoor, rotNa,
    rotVoorTeDuur, rotNaTeDuur,
    opaciteitTeDuurVast: new Set(opaciteitenTeDuur.map(o => Math.round(o * 1000))).size === 1,
    opaciteitTeDuurWaarde: opaciteitenTeDuur[0],
  };
});
check('Beschikbaar: het icoon draait door (rotation.y neemt toe over 5 ticks)',
  animatie.rotNa > animatie.rotVoor, animatie);
check('TeDuur: het icoon draait NIET door (stilstand)',
  animatie.rotNaTeDuur === animatie.rotVoorTeDuur, animatie);
check('TeDuur: de ring-opacity staat vast op 0.35',
  animatie.opaciteitTeDuurVast && Math.abs(animatie.opaciteitTeDuurWaarde - 0.35) < 0.001, animatie);

const opacityVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;   // weer 'beschikbaar' zetten
  return d.watertapMarkering.children[0].material.opacity;
});
await page.waitForTimeout(250);   // echte klok-tijd: de al draaiende gameLoop pulst intussen door
const opacityNa = await page.evaluate(() => window.AmsterdamUndeadDebug.watertapMarkering.children[0].material.opacity);
check('Beschikbaar: de ring-opacity pulst over echte tijd (verandert via de draaiende gameLoop)',
  Math.abs(opacityNa - opacityVoor) > 0.001, { opacityVoor, opacityNa });

const gedoofdSkip = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  d.autoHerladerGekocht = true;   // rechtstreeks, buiten koopAutoHerlader() om: De Zelflader nu 'gekocht'
  d.updateWinkelMarkeringen(0.1);   // eerste tick: dooft 'm
  const ring = d.autoHerladerMarkering.children[0];
  const kleurNaDoven = ring.material.color.getHex();
  const opacityNaDoven = ring.material.opacity;
  // Nog 5 ticks: als de skip werkt, verandert er niets meer aan de kleur.
  for (let i = 0; i < 5; i++) d.updateWinkelMarkeringen(0.1);
  return {
    kleurNaDoven, opacityNaDoven,
    kleurBlijftGedoofd: ring.material.color.getHex() === kleurNaDoven,
    laatsteStatus: d.autoHerladerMarkering.userData.laatsteStatus,
  };
});
check('Gekocht: de ring wordt gedoofd (grijs, 0x555555)',
  gedoofdSkip.kleurNaDoven === 0x555555, gedoofdSkip);
check('Gekocht: eenmaal gedoofd blijft de kleur stabiel gedoofd (skip-logica werkt)',
  gedoofdSkip.kleurBlijftGedoofd, gedoofdSkip);
check('Gekocht: userData.laatsteStatus staat op "gekocht"',
  gedoofdSkip.laatsteStatus === 'gekocht', gedoofdSkip);

// --- 6. koop-flits: timer + zichtbare puls, ook als de status meteen
// 'gekocht' wordt (De Zelflader: 1 aankoop volstaat al) ---------------------
// Let op: Pantserdrank/Werkbank/Ratelaar zijn al "verbruikt" door sectie 2
// hierboven (hun koop-functies zijn eenmalig) — De Zelflader is hier bewust
// vers, via een expliciete reset van autoHerladerGekocht (sectie 5 zette 'm
// al op true zonder koopAutoHerlader() aan te roepen).
const flitsTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  d.autoHerladerGekocht = false;
  const voorAankoop = { flitsTimer: d.autoHerladerMarkering.userData.flitsTimer ?? 0 };
  d.koopAutoHerlader();   // status meteen 'gekocht'
  const direcNaAankoop = { flitsTimer: d.autoHerladerMarkering.userData.flitsTimer };
  d.updateWinkelMarkeringen(0.05);   // status is al 'gekocht', maar de flits moet nog spelen
  const ring = d.autoHerladerMarkering.children[0];
  const tijdensFlits = { schaal: ring.scale.x, laatsteStatus: d.autoHerladerMarkering.userData.laatsteStatus };
  // Tik door tot de flits voorbij is.
  let ticks = 0;
  while ((d.autoHerladerMarkering.userData.flitsTimer ?? 0) > 0 && ticks < 100) { d.updateWinkelMarkeringen(0.05); ticks++; }
  const naFlits = { schaal: ring.scale.x, kleur: ring.material.color.getHex() };
  return { voorAankoop, direcNaAankoop, tijdensFlits, naFlits };
});
check('Vóór aankoop staat er geen koop-flits-timer',
  flitsTest.voorAankoop.flitsTimer === 0, flitsTest);
check('koopAutoHerlader() zet de flits-timer meteen aan (WINKEL_FLITS_DUUR)',
  flitsTest.direcNaAankoop.flitsTimer > 0, flitsTest);
check('Tijdens de flits schaalt de ring op (> 1), OOK al is de status meteen "gekocht"',
  flitsTest.tijdensFlits.schaal > 1 && flitsTest.tijdensFlits.laatsteStatus === 'gekocht', flitsTest);
check('Na afloop van de flits is de ring weer op schaal 1 en blijft gedoofd',
  Math.abs(flitsTest.naFlits.schaal - 1) < 0.01 && flitsTest.naFlits.kleur === 0x555555, flitsTest);

// --- 7. winkelLicht: kleur/intensiteit volgen de dichtstbijzijnde winkel --
const winkelLichtDichtbij = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 0;   // watertap blijft 'beschikbaar'/'teDuur', nooit gedoofd -> altijd kandidaat
  d.speler.positie.set(d.watertapMarkering.position.x, 0, d.watertapMarkering.position.z);
  d.winkelLicht.intensity = 0;
  for (let i = 0; i < 30; i++) d.updateWinkelMarkeringen(0.05);   // 1.5s "speeltijd"
  return {
    intensiteit: d.winkelLicht.intensity,
    kleur: d.winkelLicht.color.getHex(),
    verwachteKleur: d.WINKEL_STIJLEN.watertap.kleur,
  };
});
check('winkelLicht neemt binnen ~1.5s een merkbare intensiteit aan bij een winkel binnen 6 m',
  winkelLichtDichtbij.intensiteit > 0.5, winkelLichtDichtbij);
check('winkelLicht neemt de kleur van de dichtstbijzijnde winkel aan',
  Math.abs(winkelLichtDichtbij.kleur - winkelLichtDichtbij.verwachteKleur) < 0x050505, winkelLichtDichtbij);

const winkelLichtVerAf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(1000, 0, 1000);   // ver van elke winkel
  for (let i = 0; i < 60; i++) d.updateWinkelMarkeringen(0.05);   // 3s "speeltijd"
  return { intensiteit: d.winkelLicht.intensity };
});
check('winkelLicht dooft (intensiteit < 0.05) zonder winkel binnen 6 m',
  winkelLichtVerAf.intensiteit < 0.05, winkelLichtVerAf);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
