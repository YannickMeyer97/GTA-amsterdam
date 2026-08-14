// Feedback F2 (Ticket 33): hitmarker-tiers en treffer-/herlaad-audio.
// Bewaakt: DOM-tierklasse na lichaam/kop/kill-treffer, "hoogste tier wint"
// binnen het samenval-venster, dt-gedreven decay (ook tijdens pauze, zelfde
// patroon als het vignet), de herlaad-audio-splitsing (start in herladen(),
// klaar in updateWapen() op het echte voltooiingsmoment — geen setTimeout
// meer), en de leeg-magazijn-ammo-UI-knipper.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// CI-fix: de decay/samenval-venster-mechanismen hieronder draaien op de
// gameLoop's ECHTE, gecapte dt (max 0.05s/frame) — een vaste wandklok-marge
// gokt hoeveel gesimuleerde tijd dat op de testmachine daadwerkelijk
// oplevert, en bleek op GitHub Actions te krap. Poll tot de conditie klopt
// i.p.v. een marge gokken (zelfde aanpak als test-wapen-identiteit.mjs).
async function wachtTotConditie(evalFn, klaarFn, { timeoutMs = 10000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let laatste = await page.evaluate(evalFn);
  while (!klaarFn(laatste) && Date.now() < deadline) {
    await page.waitForTimeout(intervalMs);
    laatste = await page.evaluate(evalFn);
  }
  return laatste;
}

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

// Elke toonHitmarker()-aanroep herstart zijn eigen samenval-venster
// (hitmarkerLaatsteTijd = klok, óók bij een geblokkeerde downgrade, zie de
// bron) — een poll die zelf herhaald toonHitmarker('lichaam') aanroept is
// dus alleen zelfcorrigerend als het poll-interval ZELF ruim boven het
// venster (60ms) ligt. Met een te kort interval (bv. 150ms) accumuleert
// hooguit 1 gecapte frame (~0.05s) gesimuleerde tijd tussen twee pogingen —
// net ONDER de 60ms-drempel — waardoor elke poging zijn eigen baseline
// reset en de test nooit convergeert (empirisch gevonden op CI). 500ms
// geeft in de praktijk meerdere gecapte frames (~0.1-0.15s) headroom.
const naVenster = await wachtTotConditie(
  () => { const d = window.AmsterdamUndeadDebug; d.toonHitmarker('lichaam'); return d.hitmarkerHuidigeTier; },
  (tier) => tier === 'lichaam',
  { intervalMs: 500 },
);
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
const decayNaPauze = await wachtTotConditie(
  () => { const d = window.AmsterdamUndeadDebug; return { opacity: d.hitmarker.style.opacity, timer: d.hitmarkerTimer }; },
  (u) => u.timer === 0,
);
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

// --- 7. Ticket 95 (De kill als gebeurtenis): kill-flits + kill-burst -----
// Elke dodelijke treffer krijgt een korte emissive flits op de PER-INSTANCE
// huidmaterialen (nooit kernMateriaal, nooit de gedeelde been-/vod-
// materialen via mat()) plus een groter impact-burst dan een gewone
// treffer. KILL_BURST_SAMENVAL_VENSTER (zelfde sjabloon als
// HITMARKER_SAMENVAL_VENSTER hierboven) degradeert de burst-grootte bij
// snel-op-elkaar-volgende kills, zodat een Brander-kettingreactie de
// 24-slots impactPool niet in één klap leegtrekt.
const NEUTRALE_TRAITS_STR_T95 =
  "{ profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false }";

const structuurT95 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    KILL_FLITS_PIEK: d.KILL_FLITS_PIEK, KILL_FLITS_DUUR: d.KILL_FLITS_DUUR,
    KILL_BURST_AANTAL_GROOT: d.KILL_BURST_AANTAL_GROOT, KILL_BURST_AANTAL_KLEIN: d.KILL_BURST_AANTAL_KLEIN,
    KILL_BURST_SAMENVAL_VENSTER: d.KILL_BURST_SAMENVAL_VENSTER,
  };
});
check('KILL_BURST_AANTAL_GROOT > KILL_BURST_AANTAL_KLEIN (het samenval-venster degradeert echt naar minder)',
  structuurT95.KILL_BURST_AANTAL_GROOT > structuurT95.KILL_BURST_AANTAL_KLEIN, structuurT95);
check('KILL_FLITS_PIEK/KILL_FLITS_DUUR/KILL_BURST_SAMENVAL_VENSTER zijn positieve, eindige waarden',
  structuurT95.KILL_FLITS_PIEK > 0 && structuurT95.KILL_FLITS_DUUR > 0 && structuurT95.KILL_BURST_SAMENVAL_VENSTER > 0, structuurT95);

// --- 7a. Eén kill: de PER-INSTANCE huidmaterialen flitsen naar
// KILL_FLITS_PIEK, kernMateriaal (gedeeld) zit er nooit tussen, en de
// burst is groter dan een gewone (overlevende) treffer -------------------
const eenKill = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  d.laatsteKillBurstTijd = -999;   // buiten elk samenval-venster: gegarandeerd de volle burst
  // CI-fix: eerdere secties in dit bestand kunnen nog niet-vervallen impact-
  // deeltjes in de pool hebben staan (IMPACT_LEVENSDUUR/0,3s verstrijkt alleen
  // via echte rAF-frames, die tussen twee synchrone evaluate()-blokken door
  // niet gegarandeerd zijn) — expliciet leegvegen i.p.v. op reële frametijd
  // gokken, zodat de exacte burst-grootte-checks hieronder niet flaky worden.
  for (let i = d.actieveEffecten.length - 1; i >= 0; i--) {
    if (d.actieveEffecten[i].soort === 'impact') {
      d.actieveEffecten[i].slot.actief = false;
      d.actieveEffecten[i].slot.mesh.visible = false;
      d.actieveEffecten.splice(i, 1);
    }
  }
  d.speler.positie.set(0, 0, 0);
  const impactVoor = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  const o = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  o.hp = d.schadePerTreffer;   // exact genoeg voor een dodelijke lichaamstreffer
  o.groep.position.set(0, 0, -10);
  const materialen = o.delen.huidMaterialen;
  const kernNietErbij = !materialen.includes(d.kernMateriaal);
  d.raakOndode(o, o.groep.position, false);   // kill
  const impactNa = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  return {
    kernNietErbij, aantalMaterialen: materialen.length,
    intensiteitenNaKill: materialen.map(m => m.emissiveIntensity),
    burstGrootte: impactNa - impactVoor,
    KILL_BURST_AANTAL_GROOT: d.KILL_BURST_AANTAL_GROOT, KILL_FLITS_PIEK: d.KILL_FLITS_PIEK,
  };
}, NEUTRALE_TRAITS_STR_T95);
check('delen.huidMaterialen bevat de verwachte 4 per-instance materialen (torso/hoofd/armL/armR) voor een normaal/standaard-ondode',
  eenKill.aantalMaterialen === 4, eenKill);
check('kernMateriaal (gedeeld) zit nooit in delen.huidMaterialen',
  eenKill.kernNietErbij, eenKill);
check('Direct na de kill staan ALLE huidmaterialen op KILL_FLITS_PIEK emissiveIntensity',
  eenKill.intensiteitenNaKill.every(i => i === eenKill.KILL_FLITS_PIEK), eenKill);
check('De kill-burst spawnt precies KILL_BURST_AANTAL_GROOT nieuwe impact-deeltjes (buiten het samenval-venster)',
  eenKill.burstGrootte === eenKill.KILL_BURST_AANTAL_GROOT, eenKill);

// --- 7b. De flits dooft weer uit via updateStervenden(), ruim vóór
// STERVEN_DUUR (de val-animatie) klaar is ---------------------------------
const flitsDooft = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  d.laatsteKillBurstTijd = -999;
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  o.hp = d.schadePerTreffer;
  o.groep.position.set(0, 0, -10);
  const materialen = o.delen.huidMaterialen;
  d.raakOndode(o, o.groep.position, false);   // impactPool-bezetting is hier niet relevant (geen burst-grootte-check in dit blok)
  const stervende = d.stervenden[d.stervenden.length - 1];
  const piek = materialen[0].emissiveIntensity;
  let tikken = 0;
  while (stervende.killFlitsTimer > 0 && tikken < 30) { d.updateStervenden(0.02); tikken++; }
  const naDoven = materialen.map(m => m.emissiveIntensity);
  return { piek, naDoven, tikken, KILL_FLITS_PIEK: d.KILL_FLITS_PIEK, STERVEN_DUUR: d.STERVEN_DUUR };
}, NEUTRALE_TRAITS_STR_T95);
check('De flits start op KILL_FLITS_PIEK', flitsDooft.piek === flitsDooft.KILL_FLITS_PIEK, flitsDooft);
check('...en dooft binnen een handvol updateStervenden()-ticks volledig uit (emissiveIntensity -> 0)',
  flitsDooft.naDoven.every(i => i === 0) && flitsDooft.tikken < 30, flitsDooft);

// --- 7c. Samenval-venster: twee kills vlak na elkaar (zelfde klok binnen
// hetzelfde synchrone testblok) degraderen de tweede burst -----------------
const samenvalKills = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  d.laatsteKillBurstTijd = -999;
  for (let i = d.actieveEffecten.length - 1; i >= 0; i--) {   // zie de CI-fix-toelichting bij 7a
    if (d.actieveEffecten[i].soort === 'impact') {
      d.actieveEffecten[i].slot.actief = false;
      d.actieveEffecten[i].slot.mesh.visible = false;
      d.actieveEffecten.splice(i, 1);
    }
  }
  d.speler.positie.set(0, 0, 0);
  const impact0 = d.actieveEffecten.filter(e => e.soort === 'impact').length;

  const o1 = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  o1.hp = d.schadePerTreffer;
  o1.groep.position.set(0, 0, -10);
  d.raakOndode(o1, o1.groep.position, false);   // eerste kill: buiten het venster -> volle burst
  const impact1 = d.actieveEffecten.filter(e => e.soort === 'impact').length;

  const o2 = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  o2.hp = d.schadePerTreffer;
  o2.groep.position.set(0, 0, -10);
  d.raakOndode(o2, o2.groep.position, false);   // meteen daarna, zelfde klok -> binnen het venster
  const impact2 = d.actieveEffecten.filter(e => e.soort === 'impact').length;

  return {
    eersteBurst: impact1 - impact0, tweedeBurst: impact2 - impact1,
    GROOT: d.KILL_BURST_AANTAL_GROOT, KLEIN: d.KILL_BURST_AANTAL_KLEIN,
  };
}, NEUTRALE_TRAITS_STR_T95);
check('De eerste kill (buiten het venster) krijgt de volle KILL_BURST_AANTAL_GROOT-burst',
  samenvalKills.eersteBurst === samenvalKills.GROOT, samenvalKills);
check('Een tweede kill vlak daarna (binnen het samenval-venster) degradeert naar KILL_BURST_AANTAL_KLEIN',
  samenvalKills.tweedeBurst === samenvalKills.KLEIN, samenvalKills);

// --- 7d. Echte Brander-kettingreactie: 5 gelijktijdige kills (Brander +
// 4 slachtoffers binnen BRANDER_EXPLOSIE_RADIUS) via ontploiBrander()'s
// bestaande directe doodOndode()-aanroepen (bypassen raakOndode() geheel,
// zie ARCHITECTURE_NOTES) — het scenario dat de samenval-degradatie
// motiveert. Bevestigt: geen crash, alle 5 sterven, en de impactPool blijft
// exact zijn vaste grootte (geen groei, ook niet als de aangevraagde
// burst-som de pool-capaciteit zou overschrijden zonder degradatie).
const branderKetting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  d.laatsteKillBurstTijd = -999;
  for (let i = d.actieveEffecten.length - 1; i >= 0; i--) {   // zie de CI-fix-toelichting bij 7a
    if (d.actieveEffecten[i].soort === 'impact') {
      d.actieveEffecten[i].slot.actief = false;
      d.actieveEffecten[i].slot.mesh.visible = false;
      d.actieveEffecten.splice(i, 1);
    }
  }
  d.speler.positie.set(999, 0, 999);   // ver weg: geen spelerschade/afleiding in deze test

  const brander = d.spawnOndode(0, 'brander');
  brander.hp = d.schadePerTreffer;   // sterft op de eerstvolgende treffer
  brander.groep.position.set(0, 0, -10);
  const branderMaterialen = brander.delen.huidMaterialen;

  const slachtoffers = [];
  for (let i = 0; i < 4; i++) {
    const o = d.spawnOndode(0, 'normaal');
    o.hp = d.BRANDER_EXPLOSIE_SCHADE_ONDODE;   // exact genoeg om te sterven aan de kettingexplosie
    o.groep.position.set(-0.9 + i * 0.6, 0, -10);   // ruim binnen BRANDER_EXPLOSIE_RADIUS (3.0)
    slachtoffers.push(o);
  }

  const ondodenVoor = d.ondoden.length;   // 5: de Brander + 4 slachtoffers
  const impactVoor = d.actieveEffecten.filter(e => e.soort === 'impact').length;
  const impactPoolMaatVoor = d.impactPool.length;
  let fout = null;
  try {
    d.raakOndode(brander, brander.groep.position, false);   // dodelijk -> doodOndode() -> ontploiBrander() -> kettingreactie
  } catch (e) { fout = String(e); }
  const ondodenNa = d.ondoden.length;
  const impactNa = d.actieveEffecten.filter(e => e.soort === 'impact').length;

  return {
    fout, ondodenVoor, ondodenNa, kills: ondodenVoor - ondodenNa,
    impactVoor, impactNa, impactPoolMaatVoor, impactPoolMaatNa: d.impactPool.length,
    IMPACT_MAX: d.IMPACT_MAX, GROOT: d.KILL_BURST_AANTAL_GROOT,
    branderNietGeflitst: branderMaterialen.every(m => m.emissiveIntensity !== d.KILL_FLITS_PIEK),
  };
});
check('De Brander-kettingreactie loopt zonder fouten (geen throw in doodOndode()/ontploiBrander())',
  branderKetting.fout === null, branderKetting);
check('Alle 5 ondoden (Brander + 4 slachtoffers) sterven in deze ene kettingreactie',
  branderKetting.kills === 5, branderKetting);
check('impactPool blijft exact IMPACT_MAX groot (geen groei door de 5 gelijktijdige kill-bursts)',
  branderKetting.impactPoolMaatNa === branderKetting.impactPoolMaatVoor && branderKetting.impactPoolMaatNa === branderKetting.IMPACT_MAX,
  branderKetting);
check('De gezamenlijke burst-omvang blijft ruim onder het "5x de volle burst"-scenario (het samenval-venster degradeert echt)',
  (branderKetting.impactNa - branderKetting.impactVoor) < 5 * branderKetting.GROOT, branderKetting);
check('De Brander zelf slaat de material-flits over (mesh is al uit de scene voordat dat blok zou lopen)',
  branderKetting.branderNietGeflitst, branderKetting);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
