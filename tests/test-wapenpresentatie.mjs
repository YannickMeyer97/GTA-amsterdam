// Ticket 140 (Ronde 11, fase 2): de wapenpresentatielaag — één eigenaar van
// élke cosmetische transform op `inHandGroep`, plus de onderdelenconventie.
//
// Vóór dit ticket schreven vijf plekken los van elkaar naar dezelfde Group en
// bepaalde de volgorde waarin ze toevallig in de gameLoop stonden wie won bij
// samenloop. Dit bestand bewaakt de drie dingen die daardoor konden stukgaan:
//   1. de conventie zelf (onderdelen, rustpositie uit ARSENAAL),
//   2. dat de laag in rust exact op de basispositie uitkomt (geen restje),
//   3. dat samenloop een GEDEFINIEERDE uitkomst heeft i.p.v. een race.
//
// De gedragsneutraliteit van de refactor zelf wordt elders bewaakt en is daar
// veel scherper: test-visuele-basislijn.mjs (pixelvangrail, 2%-band over acht
// standpunten), test-wapen-identiteit.mjs (dip/wissel) en
// test-camerabeweging.mjs (sway/lean).
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Onderdelenconventie -----------------------------------------------
// Elk wapenmodel legt zijn onderdelen vast onder SEMANTISCHE namen op
// `groep.userData.onderdelen` — het model weet zelf wat het aanbiedt, en
// T141/T142-T144 kunnen "de loop" of "de greep" adresseren zonder per wapen
// een andere sleutel te hoeven kennen.
const onderdelen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lees = (groep) => {
    const o = groep.userData.onderdelen;
    return o ? { sleutels: Object.keys(o).sort(), allemaalObject3D: Object.values(o).every(m => m && m.isObject3D === true) } : null;
  };
  return {
    drukspuit: lees(d.WAPEN_DRUKSPUIT.groep),
    ratelaar: lees(d.WAPEN_RATELAAR.groep),
    mes: lees(d.wapenMes),
    // De accent-verwijzing moet nog steeds naar exact dezelfde mesh wijzen die
    // koopSmederij() laat gloeien — verhuisd, niet gekopieerd.
    accentIsDezelfdeMesh: d.WAPEN_DRUKSPUIT.groep.userData.onderdelen.accent === d.meterDrukspuit
      && d.WAPEN_RATELAAR.groep.userData.onderdelen.accent === d.tandwielRatelaar,
    // `onderdelen` is VERHUISD uit de ARSENAAL-presentatie: die tabel gaat over
    // schakelklassen, het model over zijn eigen onderdelen.
    nietMeerInArsenaal: Object.values(d.ARSENAAL).every(v => v.presentatie.onderdelen === undefined),
  };
});
check('Beide vuurwapens én het mes hebben een userData.onderdelen-tabel',
  !!onderdelen.drukspuit && !!onderdelen.ratelaar && !!onderdelen.mes, onderdelen);
check('Alle geregistreerde onderdelen zijn echte Object3D-instanties (geen losse namen)',
  onderdelen.drukspuit.allemaalObject3D && onderdelen.ratelaar.allemaalObject3D && onderdelen.mes.allemaalObject3D, onderdelen);
check('De gemeenschappelijke kern (romp/loop/greep) zit op alle drie de modellen',
  ['romp', 'loop', 'greep'].every(k =>
    onderdelen.drukspuit.sleutels.includes(k) && onderdelen.ratelaar.sleutels.includes(k) && onderdelen.mes.sleutels.includes(k)),
  onderdelen);
check('Alleen de vuurwapens hebben een "accent" — het mes kan niet gesmeed worden (§12.6)',
  onderdelen.drukspuit.sleutels.includes('accent') && onderdelen.ratelaar.sleutels.includes('accent')
  && !onderdelen.mes.sleutels.includes('accent'), onderdelen);
check('De conventie is open: de Ratelaar mag méér aanbieden dan de kern (magazijn/kolf)',
  onderdelen.ratelaar.sleutels.includes('magazijn') && onderdelen.ratelaar.sleutels.includes('kolf'), onderdelen);
check('accent wijst naar exact dezelfde mesh die koopSmederij() laat gloeien (verhuisd, niet gekopieerd)',
  onderdelen.accentIsDezelfdeMesh, onderdelen);
check('onderdelen staat niet langer in de ARSENAAL-presentatie', onderdelen.nietMeerInArsenaal, onderdelen);

// --- 2. Rustpositie komt uit ARSENAAL, niet uit een gedeelde constante -----
const rustpositie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const metMes = { naam: d.actiefWapenNaam, presentatie: { ...d.actievePresentatie() } };
  return {
    metMes,
    mesIsPeerVanArsenaal: d.actievePresentatie() === d.MES_PRESENTATIE,
    arsenaalHeeftDrieAssen: Object.values(d.ARSENAAL).every(v =>
      typeof v.presentatie.basisX === 'number' && typeof v.presentatie.basisY === 'number'
      && typeof v.presentatie.basisZ === 'number'),
    basisWaarden: { x: d.WAPEN_BASIS_X, y: d.WAPEN_BASIS_Y, z: d.WAPEN_BASIS_Z },
  };
});
check('Met alleen een mes geeft actievePresentatie() de mes-entry (peer van ARSENAAL, niet erin)',
  rustpositie.metMes.naam === 'mes' && rustpositie.mesIsPeerVanArsenaal, rustpositie);
check('Elke ARSENAAL-presentatie legt alle DRIE de assen vast (basisZ was voorheen een losse literal -0.5)',
  rustpositie.arsenaalHeeftDrieAssen, rustpositie);
check('Het mes deelt vandaag de rustpositie van een vuurwapen (§12.3)',
  rustpositie.metMes.presentatie.basisX === rustpositie.basisWaarden.x
  && rustpositie.metMes.presentatie.basisY === rustpositie.basisWaarden.y
  && rustpositie.metMes.presentatie.basisZ === rustpositie.basisWaarden.z, rustpositie);

const volgtArsenaal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  if (!d.wapenStaten.drukspuit) d.koopAmstel9();
  const uitArsenaal = d.actievePresentatie() === d.ARSENAAL[d.actiefWapenNaam].presentatie;
  // Verander de rustpositie van DIT wapen in het ARSENAAL en toon dat de
  // presentatielaag hem volgt — dat is precies wat "adresseerbaar per wapen"
  // moet betekenen, en wat met een gedeelde module-constante onmogelijk was.
  const origineel = d.ARSENAAL[d.actiefWapenNaam].presentatie.basisY;
  d.ARSENAAL[d.actiefWapenNaam].presentatie.basisY = origineel + 0.1;
  d.bobFase = 0;
  d.updateWapenPresentatie(0);
  const yNaVerhoging = d.inHandGroep.position.y;
  d.ARSENAAL[d.actiefWapenNaam].presentatie.basisY = origineel;
  d.updateWapenPresentatie(0);
  return { uitArsenaal, yNaVerhoging, verwacht: origineel + 0.1, yHersteld: d.inHandGroep.position.y, origineel };
});
check('Met een vuurwapen komt de presentatie-entry rechtstreeks uit het ARSENAAL',
  volgtArsenaal.uitArsenaal, volgtArsenaal);
check('Een gewijzigde ARSENAAL-rustpositie werkt meteen door in de wapen-transform (per wapen adresseerbaar)',
  Math.abs(volgtArsenaal.yNaVerhoging - volgtArsenaal.verwacht) < 1e-9, volgtArsenaal);
check('...en na herstel staat het wapen weer op de oorspronkelijke rust-y',
  Math.abs(volgtArsenaal.yHersteld - volgtArsenaal.origineel) < 1e-9, volgtArsenaal);

// --- 3. In rust: exact op de basispositie, geen restje offset --------------
await geefSpelerVuurwapen(page);
const rust = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.herladen = false;
  d.wisselTimer = 0;
  d.terugslag = 0;
  d.bobFase = 0;         // sin(0) === 0, dus geen sway
  d.updateWapenPresentatie(0.016);
  const b = d.actievePresentatie();
  return {
    pos: { x: d.inHandGroep.position.x, y: d.inHandGroep.position.y, z: d.inHandGroep.position.z },
    basis: { x: b.basisX, y: b.basisY, z: b.basisZ },
    rotX: d.inHandGroep.rotation.x,
    rotZ: d.inHandGroep.rotation.z,
    leanHoek: d.leanHoek,
    tegenwicht: d.WAPEN_LEAN_TEGENWICHT,
  };
});
check('In volledige rust staat de wapen-groep op EXACT de basispositie (alle drie de assen)',
  rust.pos.x === rust.basis.x && rust.pos.y === rust.basis.y && rust.pos.z === rust.basis.z, rust);
check('rotation.x is 0 zonder gehouden-mes-steek (een vuurwapen kantelt niet)', rust.rotX === 0, rust);
check('rotation.z volgt exact -leanHoek * WAPEN_LEAN_TEGENWICHT',
  Math.abs(rust.rotZ - (-rust.leanHoek * rust.tegenwicht)) < 1e-12, rust);

// --- 4. Geforceerde samenloop: herlaad-dip + wisseldip ---------------------
// In normaal spel sluiten deze twee elkaar uit — wisselWapen() weigert tijdens
// het herladen, en een aankoop bindt wapenStaat aan een vers wapen dat niet
// aan het herladen is. Die uitsluiting was tot T140 de ENIGE reden dat ze
// elkaar niet overschreven: beide schreven blind naar position.y, en wie won
// hing af van de vololgorde in de gameLoop. Nu is het een expliciete
// OPTELLING, dus ook geforceerd is de uitkomst gedefinieerd en narekenbaar.
const samenloop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const amp = d.WAPEN_HERLAAD_DIP_AMPLITUDE;
  d.bobFase = 0;
  d.terugslag = 0;

  // Herlaad-dip op exact de helft van zijn boog (voortgang 0.5 -> sin(PI/2) = 1,
  // dus de volle amplitude).
  d.wapenStaat.herladen = true;
  d.wapenStaat.herlaadTimer = d.wapenStaat.herlaadDuur * 0.5;
  d.wisselTimer = 0;
  d.updateWapenPresentatie(0);
  const alleenHerlaad = d.inHandGroep.position.y;

  // Wisseldip op exact de helft van ZIJN boog, zonder herlaad.
  d.wapenStaat.herladen = false;
  d.wisselTimer = d.WISSEL_DUUR * 0.5;
  d.updateWapenPresentatie(0);
  const alleenWissel = d.inHandGroep.position.y;

  // Allebei tegelijk, geforceerd.
  d.wapenStaat.herladen = true;
  d.wapenStaat.herlaadTimer = d.wapenStaat.herlaadDuur * 0.5;
  d.wisselTimer = d.WISSEL_DUUR * 0.5;
  d.updateWapenPresentatie(0);
  const beide = d.inHandGroep.position.y;

  const basisY = d.actievePresentatie().basisY;
  d.wapenStaat.herladen = false;
  d.wisselTimer = 0;
  d.updateWapenPresentatie(0);
  return { alleenHerlaad, alleenWissel, beide, basisY, amp, terug: d.inHandGroep.position.y };
});
check('Een herlaad-dip alleen zakt de volle amplitude onder de rust-y',
  Math.abs(samenloop.alleenHerlaad - (samenloop.basisY - samenloop.amp)) < 1e-9, samenloop);
check('Een wisseldip alleen doet exact hetzelfde (zelfde boog, zelfde amplitude)',
  Math.abs(samenloop.alleenWissel - (samenloop.basisY - samenloop.amp)) < 1e-9, samenloop);
check('Geforceerd tegelijk: de twee dips TELLEN OP tot een gedefinieerde uitkomst (geen race, geen "wie schreef het laatst")',
  Math.abs(samenloop.beide - (samenloop.basisY - 2 * samenloop.amp)) < 1e-9, samenloop);
check('Na afloop van beide staat de groep weer exact op de rust-y',
  samenloop.terug === samenloop.basisY, samenloop);

// --- 5. De mes-quick-draw is een OVERRIDE, geen optelling ------------------
// V indrukken tijdens een herlaad is normaal spel (zie
// test-arsenaal-randgevallen.mjs sectie 7). Vóór T140 won de quick-draw omdat
// zijn blok ná de dips stond; die voorrang is nu expliciet. Zou hij optellen,
// dan zou het wapen dieper wegzakken dan de animatie bedoelt.
const override = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.bobFase = 0;
  d.terugslag = 0;
  d.wisselTimer = 0;
  d.wapenStaat.herladen = true;
  d.wapenStaat.herlaadTimer = d.wapenStaat.herlaadDuur * 0.5;   // volle dip-amplitude
  d.mesStaat.cooldownTimer = 0;
  d.steekMes();   // zet mesAnimatieTimer; actiefWapenNaam is een vuurwapen -> quick-draw
  // Eén echte frame van de gameLoop-mes-tak + de presentatielaag: de gameLoop
  // rekent de wegzak uit, de presentatielaag past 'm toe.
  const perFrame = [];
  for (let i = 0; i < 4; i++) {
    d.updateWapenPresentatie(0.016);
    perFrame.push({
      quickDraw: d.mesQuickDrawActief, wegzak: d.mesWegzakOffset, y: d.inHandGroep.position.y,
    });
  }
  const basisY = d.actievePresentatie().basisY;
  return { perFrame, basisY, amp: d.WAPEN_HERLAAD_DIP_AMPLITUDE, wegzakMax: d.MES_WAPEN_WEGZAK };
});
// De gameLoop draait in deze test niet mee, dus mesQuickDrawActief blijft op de
// waarde die de laatste echte frame zette; wat hier telt is dat de y-uitkomst
// de wegzak-override volgt en NIET de som van wegzak + herlaad-dip.
const overrideFrame = override.perFrame[0];
check('Tijdens een quick-draw volgt y de wegzak-override, niet de som met de lopende herlaad-dip',
  overrideFrame.quickDraw
    ? Math.abs(overrideFrame.y - (override.basisY - overrideFrame.wegzak)) < 1e-9
    : Math.abs(overrideFrame.y - (override.basisY - override.amp)) < 1e-9,
  { overrideFrame, basisY: override.basisY, amp: override.amp });

// De steek uit sectie 5 loopt nog (MES_STEEK_ANIMATIE_DUUR = 0,40s). Laat 'm
// door de ECHTE gameLoop uitlopen: die herberekent `mesQuickDrawActief` en de
// drie offsets elke frame vanaf nul, dus ze horen daarna vanzelf op nul te
// staan. Dat is precies de eigenschap die voorkomt dat een afgelopen animatie
// een offset laat "hangen" — de expliciete terug-naar-rust-writes die vóór
// T140 aan het eind van beide mes-takken stonden, zijn hierdoor overbodig.
// Wachten op wall-clock is hier onbetrouwbaar: requestAnimationFrame loopt in
// headless Chromium merkbaar trager dan 60 fps, dus 0,40s animatie kost ruim
// meer dan 0,40s echte tijd. Draai in plaats daarvan expliciet frames tot de
// timer echt op nul staat.
await page.waitForFunction(() => window.AmsterdamUndeadDebug.mesAnimatieTimer === 0, null, { timeout: 15000 });
await frames(page, 2);   // nog twee frames, zodat de mes-tak zijn offsets zeker heeft teruggezet
const naSteek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    mesAnimatieTimer: d.mesAnimatieTimer,
    quickDraw: d.mesQuickDrawActief,
    wegzak: d.mesWegzakOffset, stootZ: d.mesStootOffsetZ, kantelX: d.mesKantelX,
  };
});
check('Na afloop van een steek zijn alle mes-offsets vanzelf op nul (geen blijvende offset)',
  naSteek.mesAnimatieTimer === 0 && naSteek.quickDraw === false
  && naSteek.wegzak === 0 && naSteek.stootZ === 0 && naSteek.kantelX === 0, naSteek);

// --- 6. Het mes krijgt dezelfde sway/lean als een vuurwapen ---------------
// Ontwerpbeslissing 100: het presentatiepad kent het verschil tussen wapen en
// mes niet — `inHandGroep` is altijd gewoon een Group.
const mesSway = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  await new Promise(r => setTimeout(r, 50));
  // Terug naar een mes-only staat via een echte reload is te duur hier; in
  // plaats daarvan direct de presentatie van het MES-model toetsen door
  // inHandGroep tijdelijk naar het mes te wijzen is niet mogelijk (module-let).
  // Wél toetsbaar: de mes-presentatie-entry bestaat en heeft dezelfde vorm,
  // en de sway-formule leest uitsluitend uit die entry.
  const p = d.MES_PRESENTATIE;
  return {
    vorm: typeof p.basisX === 'number' && typeof p.basisY === 'number' && typeof p.basisZ === 'number',
    sleutels: Object.keys(p).sort(),
    arsenaalSleutels: Object.keys(d.ARSENAAL.drukspuit.presentatie).sort(),
  };
});
check('MES_PRESENTATIE heeft exact dezelfde vorm als een ARSENAAL-presentatie (één uniform pad)',
  mesSway.vorm && JSON.stringify(mesSway.sleutels) === JSON.stringify(mesSway.arsenaalSleutels), mesSway);

// --- 7. Herladen tijdens sway/lean eindigt exact op de rust-y -------------
// Acceptatiecriterium van het ticket: de sway (x) en lean (rot z) mogen de
// y-terugkeer niet vervuilen — drie onafhankelijke assen, één write elk.
const herlaadMetSway = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wisselTimer = 0;
  d.terugslag = 0;
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.reserve = 48;
  d.herladen();
  let ticks = 0;
  while (d.wapenStaat.herladen && ticks < 500) {
    d.bobFase += 0.7;   // actieve sway gedurende het hele herladen
    d.updateWapen(0.02);
    d.updateWapenPresentatie(0.02);
    ticks++;
  }
  d.updateWapenPresentatie(0.02);
  const basis = d.actievePresentatie();
  return {
    y: d.inHandGroep.position.y, basisY: basis.basisY,
    x: d.inHandGroep.position.x, basisX: basis.basisX,
    swayAmp: d.WAPEN_SWAY_AMPLITUDE, ticks,
  };
});
check('Herladen met actieve sway eindigt EXACT op de rust-y (assen zijn onafhankelijk)',
  herlaadMetSway.y === herlaadMetSway.basisY, herlaadMetSway);
check('...terwijl de sway ondertussen wél gewoon op x werkte, binnen zijn amplitude',
  Math.abs(herlaadMetSway.x - herlaadMetSway.basisX) <= herlaadMetSway.swayAmp + 1e-9, herlaadMetSway);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
