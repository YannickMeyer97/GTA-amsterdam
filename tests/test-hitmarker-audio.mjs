// Feedback F2 (Ticket 33): hitmarker-tiers en treffer-/herlaad-audio.
// Bewaakt: DOM-tierklasse na lichaam/kop/kill-treffer, "hoogste tier wint"
// binnen het samenval-venster, dt-gedreven decay (ook tijdens pauze, zelfde
// patroon als het vignet), de herlaad-audio-splitsing (start in herladen(),
// klaar in updateWapen() op het echte voltooiingsmoment — geen setTimeout
// meer), en de leeg-magazijn-ammo-UI-knipper.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Tier-DOM-check: lichaam / kop / kill --------------------------
const tierCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);

  const o1 = d.spawnOndode(0, 'normaal');
  o1.hp = 1000;
  d.raakOndode(o1, o1.groep.position, false);   // lichaamstreffer, overleeft
  const naLichaam = { klasse: d.hitmarker.className, tier: d.hitmarkerHuidigeTier };

  d.raakOndode(o1, o1.groep.position, true);    // headshot, overleeft nog steeds (hp=1000)
  const naKop = { klasse: d.hitmarker.className, tier: d.hitmarkerHuidigeTier };

  o1.hp = d.schadePerTreffer;                   // exact genoeg voor een dodelijke lichaamstreffer
  d.raakOndode(o1, o1.groep.position, false);   // kill
  const naKill = { klasse: d.hitmarker.className, tier: d.hitmarkerHuidigeTier };

  return {
    naLichaam, naKop, naKill,
    raakTikTeller: d.raakTikTeller, kopTikTeller: d.kopTikTeller, killKnakTeller: d.killKnakTeller,
  };
});
check('Een lichaamstreffer zet de hitmarker op tier "lichaam"',
  tierCheck.naLichaam.tier === 'lichaam' && tierCheck.naLichaam.klasse.includes('lichaam'), tierCheck);
check('Een overlevende headshot zet de hitmarker op tier "kop" (anders dan lichaam)',
  tierCheck.naKop.tier === 'kop' && tierCheck.naKop.klasse.includes('kop'), tierCheck);
check('Een kill zet de hitmarker op tier "kill" (weer anders)',
  tierCheck.naKill.tier === 'kill' && tierCheck.naKill.klasse.includes('kill'), tierCheck);
check('speelRaakTik/speelKopTik/speelKillKnak zijn elk precies 1x aangeroepen',
  tierCheck.raakTikTeller === 1 && tierCheck.kopTikTeller === 1 && tierCheck.killKnakTeller === 1, tierCheck);

// --- 2. "Hoogste tier wint" binnen het samenval-venster -----------------
const samenval = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonHitmarker('kill');
  const directNa = d.hitmarkerHuidigeTier;
  d.toonHitmarker('lichaam');   // binnen hetzelfde frame: klok is nog niet verstreken
  const naDowngradePoging = d.hitmarkerHuidigeTier;
  return { directNa, naDowngradePoging };
});
check('Direct na toonHitmarker("kill") is de tier "kill"', samenval.directNa === 'kill', samenval);
check('Een "lichaam"-treffer vlak daarna (binnen het samenval-venster) downgradet de tier niet',
  samenval.naDowngradePoging === 'kill', samenval);

// Ticket 60 (v0.19): composer.render() (post-processing) kost iets meer dan
// renderer.render(), waardoor de fps in dit headless/software-gerenderde
// testklimaat daalt en de gameLoop's gecapte dt (max 0.05s/frame) verder
// achterblijft bij de echte klok — vandaar een ruimere marge dan voorheen
// (was 120ms) om zeker buiten het venster te komen.
await page.waitForTimeout(350);   // ruim buiten HITMARKER_SAMENVAL_VENSTER (60 ms), echte klok-tijd

const naVenster = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonHitmarker('lichaam');
  return d.hitmarkerHuidigeTier;
});
check('Buiten het samenval-venster wint de nieuwe (lagere) tier gewoon weer',
  naVenster === 'lichaam', { naVenster });

// --- 3. Decay: dt-gedreven, ook tijdens pauze (cosmetisch, als het vignet) -
// Let op: de DOM-opacity wordt pas op de EERSTVOLGENDE rAF-tick door
// updateHitmarker(dt) geschreven (buiten deze synchrone evaluate-aanroep om),
// dus direct na toonHitmarker() toont style.opacity nog de vorige frame-
// waarde. De interne timer/duur-state is wél meteen synchroon correct — dat
// is hier de betrouwbare bron van waarheid; de DOM-render zelf wordt
// hieronder (na de pauze-wacht) apart gecontroleerd.
const decayVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.toonHitmarker('kop');   // duur 0.18s
  return { timer: d.hitmarkerTimer, duur: d.hitmarkerDuur };
});
check('Direct na toonHitmarker() staat de interne timer op de volle tier-duur',
  decayVoor.timer === decayVoor.duur && decayVoor.timer > 0, decayVoor);

// Pauzeren: pointer lock "verliezen" — decay moet toch doorlopen (cosmetisch).
await page.evaluate(() => {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});
// Ticket 60 (v0.19): zelfde reden als hierboven — ruimere marge dan het
// oorspronkelijke 300ms i.v.m. de iets lagere fps door composer.render().
await page.waitForTimeout(800);   // ruim boven de 0.18s tier-duur, tijdens pauze
const decayNaPauze = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { opacity: d.hitmarker.style.opacity, timer: d.hitmarkerTimer };
});
check('Tijdens pauze dooft de hitmarker toch binnen zijn duur (decay loopt door, zelfde keuze als het vignet)',
  decayNaPauze.timer === 0 && parseFloat(decayNaPauze.opacity) === 0, decayNaPauze);

// Pointer lock terug aan voor de resterende secties.
await page.evaluate(() => {
  // Ticket 67 voegde #minimapUI toe (vóór de renderer-canvas in de DOM),
  // dus expliciet de renderer-canvas i.p.v. de eerste <canvas> in de DOM.
  const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});

// --- 4. Herlaad-audio-splitsing: start in herladen(), klaar in updateWapen() -
const herlaadSplit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax - 3;   // niet vol, dus herladen() mag echt starten
  const startTellerVoor = d.herlaadStartTeller;
  const klaarTellerVoor = d.herlaadKlaarTeller;
  d.herladen();
  const naStart = { herladen: d.wapenStaat.herladen, startTeller: d.herlaadStartTeller, klaarTeller: d.herlaadKlaarTeller };

  // Tick updateWapen() in kleine stapjes tot de herlaad-timer voltooid is.
  let ticks = 0;
  while (d.wapenStaat.herladen && ticks < 500) { d.updateWapen(0.02); ticks++; }
  const naVoltooid = {
    herladen: d.wapenStaat.herladen,
    magazijn: d.wapenStaat.magazijn,
    magazijnMax: d.wapenStaat.magazijnMax,
    startTeller: d.herlaadStartTeller,
    klaarTeller: d.herlaadKlaarTeller,
  };
  return { startTellerVoor, klaarTellerVoor, naStart, naVoltooid };
});
check('herladen() roept precies het start-geluid aan (herlaadStartTeller +1), nog niet het klaar-geluid',
  herlaadSplit.naStart.startTeller === herlaadSplit.startTellerVoor + 1 &&
  herlaadSplit.naStart.klaarTeller === herlaadSplit.klaarTellerVoor &&
  herlaadSplit.naStart.herladen === true, herlaadSplit);
check('Op het echte voltooiingsmoment (updateWapen) speelt precies 1x het klaar-geluid, magazijn is weer vol',
  herlaadSplit.naVoltooid.herladen === false &&
  herlaadSplit.naVoltooid.magazijn === herlaadSplit.naVoltooid.magazijnMax &&
  herlaadSplit.naVoltooid.klaarTeller === herlaadSplit.klaarTellerVoor + 1 &&
  herlaadSplit.naVoltooid.startTeller === herlaadSplit.startTellerVoor + 1, herlaadSplit);

// --- 5. Source-check: geen setTimeout meer in de herlaad-audio -----------
const bronCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    speelHerlaadHeeftSetTimeout: /setTimeout/.test(d.speelHerlaad.toString()),
    speelHerlaadKlaarHeeftSetTimeout: /setTimeout/.test(d.speelHerlaadKlaar.toString()),
  };
});
check('speelHerlaad() bevat geen setTimeout meer',
  bronCheck.speelHerlaadHeeftSetTimeout === false, bronCheck);
check('speelHerlaadKlaar() bevat geen setTimeout meer',
  bronCheck.speelHerlaadKlaarHeeftSetTimeout === false, bronCheck);

// --- 6. Leeg magazijn: droogklik + zichtbare ammo-UI-knipper -------------
const leegCue = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ammoUI.classList.remove('leeg');
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.herladen = false;
  d.probeerTeSchieten();
  return { klasse: d.ammoUI.className };
});
check('Schieten met een leeg magazijn zet de "leeg"-knipperklasse op de ammo-UI',
  leegCue.klasse.includes('leeg'), leegCue);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
