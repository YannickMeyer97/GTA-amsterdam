// Ticket 133 (Ronde 10, §12.3-12.4 + ontwerpbeslissingen 95-97): het mes —
// altijd beschikbaar via V, los van het actieve vuurwapen. Dit bestand test
// uitsluitend de mes-MECHANIEK zelf (schade/bereik/cooldown/geld/OB97);
// vanaf sectie 2 wordt de speler expliciet aan de AMSTEL-9 geholpen
// (geefSpelerVuurwapen()) zodat dezelfde opstelling blijft werken die
// geschreven is toen de speler nog standaard met een vuurwapen startte.
// Ticket 134 maakte het mes het STARTWAPEN — dat gedrag (laadstaat, koopPad,
// V/Q-semantiek, HUD) wordt getest in test-arsenaal-startwapen.mjs, niet
// hier; dit bestand blijft over de steek-actie zelf gaan.
//
// Testopstelling (pitch=-0.3, VASTE_TRAITS) is empirisch geverifieerd op
// betrouwbaarheid: 40/40 treffers op afstanden 0.8-1.0m, zelfde methode als
// test-smederij.mjs gebruikt voor de vuurwapen-raycasts. kiesOndodeTraits()
// (spawnOndode()'s default 3e argument) loot anders een willekeurige
// lengte/houding die de precisie-raycast soms net laat missen.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

const VASTE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };

// Helper: zet de speler/camera in een vaste, betrouwbare mikpositie en ruim
// eerst alle bestaande ondoden op (voorkomt dat een eerdere sectie se doel
// nog in de scène/ondodenGroep hangt en de raycast van een latere sectie
// blokkeert — zie de T132-regressie-fix in test-camerabeweging.mjs voor
// precies dit mechanisme: d.ondoden.length=0 is NIET genoeg, doodOndode() wel).
function mikOpstelling() {
  return `
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.speler.positie.set(0, 0, 0);
    d.speler.yaw = 0; d.speler.pitch = -0.3;
    d.cameraKick = 0;
    d.updateSpeler(0);
    d.camera.updateMatrixWorld(true);
  `;
}

// --- 1. mesStaat is GEEN entry in wapenStaten (ontwerpbeslissing 95) ------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    mesStaatBestaat: !!d.mesStaat,
    heeftCooldownTimer: typeof d.mesStaat.cooldownTimer === 'number',
    zitInWapenStaten: 'mes' in d.wapenStaten,
    constanten: { schade: d.MES_SCHADE, bereik: d.MES_BEREIK, cooldown: d.MES_COOLDOWN },
  };
});
check('mesStaat bestaat met een numerieke cooldownTimer', structuur.mesStaatBestaat && structuur.heeftCooldownTimer, structuur);
check('mesStaat is GEEN entry in wapenStaten (ontwerpbeslissing 95)', !structuur.zitInWapenStaten, structuur);
check('MES_SCHADE=1, MES_BEREIK=1.2, MES_COOLDOWN=0.6 (§12.4)',
  structuur.constanten.schade === 1 && structuur.constanten.bereik === 1.2 && structuur.constanten.cooldown === 0.6,
  structuur.constanten);

// --- 1b. Het mesmodel is bij het laden ZICHTBAAR (Ticket 134: het mes is het
// startwapen — dit moet de allereerste keer zijn dat wapenMes/mesAnimatieTimer
// aangeraakt worden, VÓÓR geefSpelerVuurwapen()/enige steekMes()-aanroep
// hieronder, anders test dit niet de page-load-staat maar toevallig leftover
// state van een latere sectie). Zie test-arsenaal-startwapen.mjs voor de
// volledige T134-dekking (koopAmstel9(), HUD, V/Q-semantiek); dit is puur de
// randvoorwaarde die de rest van dit bestand nodig heeft: geen kale, mesloze
// handen bij het opstarten van elke sectie hieronder.
const modelBijLaden = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { zichtbaar: d.wapenMes.visible, animatieTimer: d.mesAnimatieTimer, actiefWapenNaam: d.actiefWapenNaam };
});
check('Het mesmodel is bij het laden zichtbaar (het is het startwapen, Ticket 134)',
  modelBijLaden.zichtbaar === true && modelBijLaden.animatieTimer === 0 && modelBijLaden.actiefWapenNaam === 'mes',
  modelBijLaden);

// Vanaf hier: de rest van dit bestand test de steek-MECHANIEK, niet het
// startwapen-gedrag — eerst de AMSTEL-9 toekennen zodat de bestaande
// opstelling (d.wapenStaat, d.WAPEN_DRUKSPUIT.vlam, quick-draw-animatie)
// ongewijzigd blijft werken.
await geefSpelerVuurwapen(page);

// --- 2. Schade is exact MES_SCHADE ----------------------------------------
const schadeTest = await page.evaluate(new Function(`
  ${mikOpstelling()}
  const doel = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doel.groep.position.set(0, 0, -1);   // 1.0m, ruim binnen MES_BEREIK (1.2)
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1000;
  d.mesStaat.cooldownTimer = 0;
  const hpVoor = doel.hp;
  d.steekMes();
  return { schade: hpVoor - doel.hp };
`));
check('Een steek doet exact MES_SCHADE schade', schadeTest.schade === 1, schadeTest);

// --- 3. 1-hit-kill t/m golf 4, NIET meer op golf 5 (de HP-trap) -----------
async function killTest(golf) {
  return page.evaluate(new Function('golf', `
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.speler.positie.set(0, 0, 0);
    d.speler.yaw = 0; d.speler.pitch = -0.3;
    d.cameraKick = 0;
    d.updateSpeler(0);
    d.camera.updateMatrixWorld(true);
    d.spelStaat.golf = golf;
    const doel = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
    doel.groep.position.set(0, 0, -1);
    doel.groep.updateMatrixWorld(true);
    const hpVoorTrap = doel.hp;   // volgt ondodeStartHP() op het moment van spawnen
    d.mesStaat.cooldownTimer = 0;
    d.steekMes();
    return { hpVoorTrap, hpNa: doel.hp, dood: !d.ondoden.includes(doel) };
  `), golf);
}
const golf4 = await killTest(4);
const golf5 = await killTest(5);
check('Golf 4: normale ondode heeft 1 HP en sterft in één steek',
  golf4.hpVoorTrap === 1 && golf4.dood === true, golf4);
check('Golf 5: normale ondode heeft 2 HP en overleeft één steek (HP-trap, niet meer 1-hit-kill)',
  golf5.hpVoorTrap === 2 && golf5.dood === false && golf5.hpNa === 1, golf5);

// --- 4. Een treffer buiten MES_BEREIK mist --------------------------------
const bereikTest = await page.evaluate(new Function(`
  ${mikOpstelling()}
  const doel = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doel.groep.position.set(0, 0, -1.5);   // 1.5m, buiten MES_BEREIK (1.2) maar ruim binnen normaal wapenbereik
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1000;
  d.mesStaat.cooldownTimer = 0;
  const hpVoor = doel.hp;
  d.steekMes();
  return { hpVoor, hpNa: doel.hp, raycasterFarHersteld: d.raycaster.far };
`));
check('Een doel op 1.5m (buiten MES_BEREIK) wordt niet geraakt', bereikTest.hpNa === bereikTest.hpVoor, bereikTest);
check('raycaster.far is na de steek weer op de normale waarde (30) gezet — schiet() rekent hierop',
  bereikTest.raycasterFarHersteld === 30, bereikTest);

// --- 5. Cooldown blokkeert een tweede steek binnen MES_COOLDOWN -----------
const cooldownTest = await page.evaluate(new Function(`
  ${mikOpstelling()}
  const doel = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doel.groep.position.set(0, 0, -1);
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1000;
  d.mesStaat.cooldownTimer = 0;
  d.steekMes();
  const hpNaEersteSteek = doel.hp;
  d.steekMes();   // meteen nogmaals — cooldownTimer staat nu op MES_COOLDOWN
  const hpNaTweedeSteekMeteen = doel.hp;
  d.updateMes(d.MES_COOLDOWN + 0.01);   // cooldown volledig laten aflopen
  d.steekMes();
  const hpNaDerdeSteek = doel.hp;
  return { hpNaEersteSteek, hpNaTweedeSteekMeteen, hpNaDerdeSteek };
`));
check('Een tweede steek binnen MES_COOLDOWN doet geen schade',
  cooldownTest.hpNaTweedeSteekMeteen === cooldownTest.hpNaEersteSteek, cooldownTest);
check('Na het verstrijken van MES_COOLDOWN raakt een volgende steek weer',
  cooldownTest.hpNaDerdeSteek < cooldownTest.hpNaTweedeSteekMeteen, cooldownTest);

// --- 6. Een mes-kill levert GELD_PER_KILL * HEADSHOT_GELD_MULTIPLIER op ---
const geldTest = await page.evaluate(new Function(`
  ${mikOpstelling()}
  d.dubbeleBeloningTimer = 0;   // uitsluiten dat een lopende buff het bedrag verdubbelt
  const doel = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doel.groep.position.set(0, 0, -1);
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1;   // exact één steek van een kill
  d.mesStaat.cooldownTimer = 0;
  const geldVoor = d.spelStaat.geld;
  d.steekMes();
  return { verdiend: d.spelStaat.geld - geldVoor, verwacht: d.GELD_PER_KILL * d.HEADSHOT_GELD_MULTIPLIER };
`));
check('Een mes-kill levert exact GELD_PER_KILL * HEADSHOT_GELD_MULTIPLIER op',
  geldTest.verdiend === geldTest.verwacht, geldTest);

// --- 7. Een mes-treffer op de kop geeft GEEN HEADSHOT_EXTRA (OB97) --------
// In plaats van te gokken op een pitch die toevallig de kop raakt: bereken
// de EXACTE yaw/pitch naar de wereldpositie van doel.delen.kopProxy en
// verifieer via raycaster-treffer-identiteit (hits[0].object === kopProxy)
// dat we echt op de kop mikken — empirisch bevestigd met een diagnosescript
// (dezelfde methode als test-smederij.mjs voor schiet()). Formule:
// richting = kopWereld - camPos; yaw = atan2(-richting.x, -richting.z);
// pitch = atan2(richting.y, hypot(richting.x, richting.z)) — géén negatie,
// want richting.y is al negatief (kop ligt lager dan de camera) en dat komt
// direct overeen met een omlaag gerichte (negatieve) pitch in deze engine.
const kopTest = await page.evaluate(new Function(`
  const d = window.AmsterdamUndeadDebug;
  function mikOpKop(doel) {
    const kopWereld = new d.THREE.Vector3();
    doel.delen.kopProxy.getWorldPosition(kopWereld);
    const camPos = d.camera.position.clone();
    const richting = kopWereld.clone().sub(camPos);
    const horizAfstand = Math.hypot(richting.x, richting.z);
    d.speler.yaw = Math.atan2(-richting.x, -richting.z);
    d.speler.pitch = Math.atan2(richting.y, horizAfstand);
    d.cameraKick = 0;
    d.updateSpeler(0);
    d.camera.updateMatrixWorld(true);
  }
  function raaktKopProxy(doel) {
    d.raycaster.setFromCamera({ x: 0, y: 0 }, d.camera);
    const hits = d.raycaster.intersectObject(d.ondodenGroep, true);
    return hits.length > 0 && hits[0].object === doel.delen.kopProxy;
  }

  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);

  // Eerst vaststellen dat exact-op-de-kop-mikken ook een echte headshot
  // oplevert via het vuurwapen — d.schadePerTreffer/berekenSmederijBonus
  // bepalen alleen de HOEVEELHEID, niet de vraag "was dit een kop-treffer".
  const doelVuur = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doelVuur.groep.position.set(0, 0, -1);
  doelVuur.groep.updateMatrixWorld(true);
  doelVuur.hp = 1000;
  mikOpKop(doelVuur);
  const kopGeraaktVuur = raaktKopProxy(doelVuur);
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;
  const hpVoorVuur = doelVuur.hp;
  d.schiet();
  const vuurSchade = hpVoorVuur - doelVuur.hp;

  // doelVuur MOET hier weg. Het staat op exact dezelfde coördinaat als het
  // mes-doel hieronder, en twee samenvallende hitboxen laten de raycaster
  // willekeurig kiezen welke hij als hits[0] teruggeeft — in de gedeelde
  // suite gaf dat een sporadische FAIL (mes raakte doelVuur i.p.v. doelMes,
  // mesSchade=0) terwijl los draaien wél groen was. Zelfde opruimpatroon als
  // elders in dit bestand: doodOndode(), niet ondoden.length = 0.
  for (const o of [...d.ondoden]) d.doodOndode(o);

  // Nu dezelfde exacte geometrie (nieuw doel, opnieuw op de kop gemikt), maar
  // met het mes.
  const doelMes = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doelMes.groep.position.set(0, 0, -1);
  doelMes.groep.updateMatrixWorld(true);
  doelMes.hp = 1000;
  mikOpKop(doelMes);
  const kopGeraaktMes = raaktKopProxy(doelMes);
  d.mesStaat.cooldownTimer = 0;
  const hpVoorMes = doelMes.hp;
  d.steekMes();
  const mesSchade = hpVoorMes - doelMes.hp;

  return { kopGeraaktVuur, kopGeraaktMes, vuurSchade, mesSchade, MES_SCHADE: d.MES_SCHADE,
    schadePerTreffer: d.schadePerTreffer, HEADSHOT_EXTRA: d.HEADSHOT_EXTRA };
`));
check('De testopstelling mikt daadwerkelijk op de kop-hitboxproxy (vuurwapen én mes)',
  kopTest.kopGeraaktVuur && kopTest.kopGeraaktMes, kopTest);
check('Diezelfde kop-treffer geeft het vuurwapen wél +HEADSHOT_EXTRA (referentiemeting)',
  kopTest.vuurSchade === kopTest.schadePerTreffer + kopTest.HEADSHOT_EXTRA, kopTest);
check('Een mes-steek op dezelfde kop-hitbox als een headshot doet GEEN HEADSHOT_EXTRA (OB97)',
  kopTest.mesSchade === kopTest.MES_SCHADE && kopTest.mesSchade < kopTest.vuurSchade, kopTest);

// --- 8. Geen mondingsvlam, tracer of munitieverbruik bij een steek --------
const bijeffecten = await page.evaluate(new Function(`
  ${mikOpstelling()}
  const doel = d.spawnOndode(0, 'normaal', ${JSON.stringify(VASTE_TRAITS)});
  doel.groep.position.set(0, 0, -1);
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1000;
  d.mesStaat.cooldownTimer = 0;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;
  // Expliciet geforceerde, schone baseline: eerdere secties in dit bestand
  // hebben al met het vuurwapen geschoten (kopTest, sectie 7), en
  // VLAM_FLITS_DUUR (0,033s) decayt via ECHTE rAF-frames in de altijd-
  // lopende cosmetische zone — zonder deze reset zou "vlamZichtbaarVoor"
  // toevallige, niet-deterministische leftover state meten i.p.v. de
  // eigenlijke vraag ("maakt EEN STEEK de vlam zichtbaar?").
  d.WAPEN_DRUKSPUIT.vlam.visible = false;
  d.WAPEN_DRUKSPUIT.vlamLicht.visible = false;
  const magazijnVoor = d.wapenStaat.magazijn;
  const schotenVoor = d.runStats.schoten;
  d.steekMes();
  return {
    magazijnOngewijzigd: d.wapenStaat.magazijn === magazijnVoor,
    schotenOngewijzigd: d.runStats.schoten === schotenVoor,
    vlamNogSteedsOnzichtbaar: d.WAPEN_DRUKSPUIT.vlam.visible === false,
  };
`));
check('Een steek verbruikt geen munitie van het actieve vuurwapen',
  bijeffecten.magazijnOngewijzigd, bijeffecten);
check('Een steek telt niet mee als schot (runStats.schoten ongewijzigd)',
  bijeffecten.schotenOngewijzigd, bijeffecten);
check('Een steek toont geen mondingsvlam van het actieve vuurwapen',
  bijeffecten.vlamNogSteedsOnzichtbaar, bijeffecten);

// --- 9. Steek-animatie: het mesmodel flitst kort in beeld en verdwijnt weer
// (de ECHTE "begint onzichtbaar"-vraag staat al in sectie 1b, vóór elke
// steekMes()-aanroep in dit bestand — hier forceren we bewust een schone
// beginstaat, want eerdere secties hebben het mes al meermaals gebruikt en
// de animatie kan tussen twee evaluate()-round-trips soms al deels/geheel
// afgelopen zijn, wat "zichtbaarVoor" hier anders niet-deterministisch zou
// maken).
const animatie = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.mesStaat.cooldownTimer = 0;
  d.wapenMes.visible = false;
  d.mesAnimatieTimer = 0;
  d.inHandGroep.position.y = d.WAPEN_BASIS_Y;

  const zichtbaarVoor = d.wapenMes.visible;
  d.steekMes();
  const zichtbaarDirectNa = d.wapenMes.visible;

  // Elke ECHTE gameLoop-frame bemonsteren zolang de animatie loopt (de decay
  // zit in de altijd-lopende cosmetische zone, niet achter updateMes()).
  const monsters = [];
  for (let i = 0; i < 80; i++) {
    await new Promise(res => requestAnimationFrame(res));
    monsters.push({ mes: d.wapenMes.visible, wapenY: d.inHandGroep.position.y });
    if (d.mesAnimatieTimer <= 0) break;
  }
  const metMes = monsters.filter(m => m.mes);
  const wapenWeg = d.WAPEN_BASIS_Y - d.MES_WAPEN_WEGZAK;
  return {
    zichtbaarVoor, zichtbaarDirectNa,
    aantalMesFrames: metMes.length,
    aantalFrames: monsters.length,
    // De kern: stond het vuurwapen ELKE frame dat het mes zichtbaar was,
    // volledig weggezakt? Zo ja, dan kunnen ze elkaar niet overlappen.
    wapenAltijdWegTijdensMes: metMes.every(m => m.wapenY <= wapenWeg + 0.001),
    laagsteWapenY: Math.min(...monsters.map(m => m.wapenY)),
    verwachteLaagste: wapenWeg,
    zichtbaarNaAfloop: d.wapenMes.visible,
    timerNaAfloop: d.mesAnimatieTimer,
    wapenYNaAfloop: d.inHandGroep.position.y,
    basisY: d.WAPEN_BASIS_Y,
  };
});
check('Vóór de steek staat het mesmodel op onzichtbaar (geforceerde schone start)',
  animatie.zichtbaarVoor === false, animatie);
check('Het mes komt NIET meteen in beeld — fase 1 laat eerst het vuurwapen zakken',
  animatie.zichtbaarDirectNa === false, animatie);
check('Het mes is ergens tijdens de animatie wél zichtbaar geweest (fase 2 bestaat echt)',
  animatie.aantalMesFrames > 0, animatie);
check('REGRESSIE (het clipping-probleem): op GEEN ENKELE frame staan mes en vuurwapen samen in beeld — het wapen is volledig weggezakt zolang het mes zichtbaar is',
  animatie.wapenAltijdWegTijdensMes, animatie);
check('Het vuurwapen zakt daadwerkelijk MES_WAPEN_WEGZAK omlaag',
  Math.abs(animatie.laagsteWapenY - animatie.verwachteLaagste) < 0.01, animatie);
check('Ruim na de animatieduur is het mesmodel weer onzichtbaar en de timer op 0',
  animatie.zichtbaarNaAfloop === false && animatie.timerNaAfloop === 0, animatie);
check('...en het vuurwapen staat exact terug op zijn rusthoogte (geen restje offset)',
  animatie.wapenYNaAfloop === animatie.basisY, animatie);

// --- 9b. Een steek blokkeert kort het vuren -------------------------------
// Gevolg van de gekozen presentatie: het vuurwapen is 0,4s letterlijk uit
// beeld, dus schieten zou een mondingsvlam uit het niets tonen. Dit is
// bewust ook een gameplayregel geworden (een steek kost je kort je vuurkracht).
// Let op: het gaat om mesStaat.meleeTimer (GAMEPLAY, telt af in updateMes),
// niet om mesAnimatieTimer (cosmetisch, telt door tijdens pauze).
const vuurBlokkade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.mesStaat.cooldownTimer = 0;
  d.mesStaat.meleeTimer = 0;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;
  // `laatsteSchotTijd` is niet geëxporteerd en dus niet te resetten — dat hoeft
  // hier ook niet: eerdere secties schoten via d.schiet() (die zet 'm niet, dat
  // doet alleen probeerTeSchieten()), dus hij staat nog op zijn beginwaarde en
  // de schotCooldown kan deze meting niet vertroebelen. Belangrijk, want anders
  // zou de blokkade "slagen" om de verkeerde reden.
  const magazijnStart = d.wapenStaat.magazijn;
  d.steekMes();
  const meleeTimerNaSteek = d.mesStaat.meleeTimer;
  d.probeerTeSchieten();
  const magazijnTijdensSteek = d.wapenStaat.magazijn;
  // Laat de melee-timer aflopen via het GAMEPLAY-pad.
  d.updateMes(d.MES_STEEK_ANIMATIE_DUUR + 0.01);
  const meleeTimerNaAflopen = d.mesStaat.meleeTimer;
  d.probeerTeSchieten();
  const magazijnNaSteek = d.wapenStaat.magazijn;
  return { magazijnStart, magazijnTijdensSteek, magazijnNaSteek, meleeTimerNaSteek, meleeTimerNaAflopen };
});
check('Een steek zet mesStaat.meleeTimer op de volledige animatieduur',
  vuurBlokkade.meleeTimerNaSteek > 0, vuurBlokkade);
check('Tijdens de steek is vuren geblokkeerd (magazijn blijft ongewijzigd)',
  vuurBlokkade.magazijnTijdensSteek === vuurBlokkade.magazijnStart, vuurBlokkade);
check('Zodra de melee-timer is afgelopen kan er weer gevuurd worden',
  vuurBlokkade.meleeTimerNaAflopen === 0 && vuurBlokkade.magazijnNaSteek === vuurBlokkade.magazijnStart - 1, vuurBlokkade);

// --- 10. V-toets: integratietest via een echte keydown (niet steekMes() rechtstreeks)
const vToets = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = -0.3;
  d.cameraKick = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);
  const VASTE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };
  const doel = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  doel.groep.position.set(0, 0, -1);
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1000;
  d.mesStaat.cooldownTimer = 0;
  const hpVoor = doel.hp;
  const tellerVoor = d.mesSteekTeller;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
  return { hpNa: doel.hp, hpVoor, tellerNa: d.mesSteekTeller, tellerVoor };
});
check('Een echte KeyV-keydown roept steekMes() aan (het doel raakt schade, het geluid speelt)',
  vToets.hpNa < vToets.hpVoor && vToets.tellerNa === vToets.tellerVoor + 1, vToets);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
