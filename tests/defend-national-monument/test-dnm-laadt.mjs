// Ticket D1 (SONNET_EXECUTION_PLAN_monument.md, Fase 0) — eerste rooktest
// voor defend-national-monument.html. Er bestond vóór D0/D1 geen enkele
// test voor deze game; dit bestand bewaakt alleen dat de game laadt en dat
// window.DamChaosDebug alles exporteert wat latere D-tickets nodig hebben.
//
// Bewust GEEN gedragstests hier (dat is D2): dit script assert op de
// AANWEZIGHEID van elke debug-sleutel, niet op wat de bijbehorende functie
// doet — zo vangt het meteen een vergeten export, zonder bij elke
// gedragswijziging in de game zelf mee te hoeven veranderen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- 1. De game laadt en heeft een wereld gebouwd --------------------------

const wereldStaat = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  return {
    heeftDebug: !!d,
    obstakelsAantal: d?.obstakels?.length ?? 0,
    wave: d?.spel?.wave,
    waveDoel: d?.spel?.waveDoel,
    teSpawnen: d?.spel?.teSpawnen,
    maxActieveRobots: d?.spel?.maxActieveRobots,
    monumentHP: d?.spel?.monumentHP,
    gameOver: d?.spel?.gameOver,
  };
});

check('window.DamChaosDebug bestaat na het laden', wereldStaat.heeftDebug, wereldStaat);
check('De wereld heeft obstakels geregistreerd (obstakels.length > 0)', wereldStaat.obstakelsAantal > 0, wereldStaat);
check('Wave 1 staat klaar (spel.wave === 1)', wereldStaat.wave === 1, wereldStaat);
// startWave(1): waveDoel = 7 + 1*3 = 10, teSpawnen begint gelijk aan waveDoel,
// maxActieveRobots = min(5 + floor(1*0.65), 13) = 5. Zie
// ARCHITECTURE_NOTES_monument.md §7.2 voor de formules.
check('waveDoel klopt met de wave-1-formule (7 + 1·3 = 10)', wereldStaat.waveDoel === 10, wereldStaat);
check('teSpawnen begint gelijk aan waveDoel', wereldStaat.teSpawnen === wereldStaat.waveDoel, wereldStaat);
check('maxActieveRobots klopt met de wave-1-formule (min(5 + ⌊1·0,65⌋, 13) = 5)', wereldStaat.maxActieveRobots === 5, wereldStaat);
check('Het monument staat op 100 HP', wereldStaat.monumentHP === 100, wereldStaat);
check('gameOver staat nog op false', wereldStaat.gameOver === false, wereldStaat);

// --- 2. Elke debug-sleutel die D1 belooft, bestaat ook echt -----------------
//
// Twee lijsten: wat er al was vóór D1 (moet dus al bestaan) en wat D1 zelf
// toevoegt. Apart gehouden zodat een falende check meteen zegt of het om een
// regressie in bestaande code gaat of om een gemiste D1-export.

const BESTAANDE_SLEUTELS = [
  'scene', 'camera', 'speler', 'robots', 'munten', 'spawnRobot',
  'spawnRobotVanafPoort', 'vernietigRobot', 'raakRobot', 'ROBOT_TYPES',
  'kiesRobotTypeVoorWave', 'waveBannerTekst', 'spel', 'upgrades', 'startWave',
  'geldStand', 'obstakels', 'interactiePunten', 'isVrijePlek', 'kerkklokBoost',
  'bijenkorfShopOpenStand', 'geldZet', 'getRobotSpeedMultiplier',
  'getRewardMultiplier', 'schiet', 'getComboGeldMultiplier',
  'getComboVuurtempoMultiplier', 'robotRaaktMonument', 'huidigeSchotCooldown',
  'updateWaveSysteem', 'gebruikSpecial', 'activeerKerkklokBoost',
  'updateKerkklokBoost',
];

const NIEUWE_D1_SLEUTELS = [
  'GRENS', 'MONUMENT_POSITIE', 'MONUMENT_BOX', 'MONUMENT_MAX_HP',
  'SPAWN_POORTEN', 'afstandTotMonument', 'upgradeKosten', 'losBotsingenOp',
  'updateRobots', 'koopUpgrade', 'koopMonumentReparatie', 'legMuntNeer',
  'updateInteracties', 'activeerHuidigeInteractie',
  'activeerBijenkorfUpgradeShop', 'updateMunten', 'updateSpeler',
  'probeerTeSchieten', 'klokStand', 'huidigeInteractieStand',
];

const sleutelRapport = await page.evaluate((alleSleutels) => {
  const d = window.DamChaosDebug;
  const ontbreekt = alleSleutels.filter((naam) => !(naam in d));
  return { ontbreekt, totaalAanwezig: Object.keys(d).length };
}, [...BESTAANDE_SLEUTELS, ...NIEUWE_D1_SLEUTELS]);

check(
  `Alle ${BESTAANDE_SLEUTELS.length} bestaande debug-sleutels staan er nog`,
  BESTAANDE_SLEUTELS.every((naam) => !sleutelRapport.ontbreekt.includes(naam)),
  sleutelRapport
);
check(
  `Alle ${NIEUWE_D1_SLEUTELS.length} nieuwe D1-sleutels zijn toegevoegd`,
  NIEUWE_D1_SLEUTELS.every((naam) => !sleutelRapport.ontbreekt.includes(naam)),
  sleutelRapport
);
check('Geen enkele sleutel ontbreekt (samengevat)', sleutelRapport.ontbreekt.length === 0, sleutelRapport);

// --- 3. Steekproef: de nieuwe getters/functies geven zinnige waarden terug --
//
// Nog geen gedragstest (dat is D2), maar wél een controle dat de nieuwe
// exports geen ReferenceError of undefined-brij opleveren zodra je ze
// aanroept — dat onderscheidt "sleutel bestaat" van "sleutel werkt".

const steekproef = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  return {
    grensHeeftVierHoeken: ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => typeof d.GRENS[k] === 'number'),
    monumentPositieIsVector3: typeof d.MONUMENT_POSITIE.x === 'number' && typeof d.MONUMENT_POSITIE.z === 'number',
    monumentBoxHeeftVierHoeken: ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => typeof d.MONUMENT_BOX[k] === 'number'),
    monumentMaxHp: d.MONUMENT_MAX_HP,
    spawnPoortenAantal: d.SPAWN_POORTEN.length,
    afstandTotMonumentVanZelf: d.afstandTotMonument(d.MONUMENT_POSITIE),
    upgradeKostenNiveau0: d.upgradeKosten('vuurtempo'),
    klokNu: d.klokStand(),
    huidigeInteractieNu: d.huidigeInteractieStand(),
  };
});

check('GRENS heeft de vier verwachte grenzen', steekproef.grensHeeftVierHoeken, steekproef);
check('MONUMENT_POSITIE is een Vector3-achtig object', steekproef.monumentPositieIsVector3, steekproef);
check('MONUMENT_BOX heeft de vier verwachte grenzen', steekproef.monumentBoxHeeftVierHoeken, steekproef);
check('MONUMENT_MAX_HP is 100', steekproef.monumentMaxHp === 100, steekproef);
check('SPAWN_POORTEN heeft 5 poorten', steekproef.spawnPoortenAantal === 5, steekproef);
check('afstandTotMonument(MONUMENT_POSITIE) is 0 (het middelpunt ligt IN de doos)', steekproef.afstandTotMonumentVanZelf === 0, steekproef);
check('upgradeKosten("vuurtempo") op niveau 0 is €100', steekproef.upgradeKostenNiveau0 === 100, steekproef);
check('klokStand() geeft een getal terug', typeof steekproef.klokNu === 'number', steekproef);
check('huidigeInteractieStand() geeft null terug (speler staat nog nergens bij)', steekproef.huidigeInteractieNu === null, steekproef);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
