// Ticket 144 (Ronde 11, fase 4): treffer-, kill- en headshotfeedback per
// wapen. Doel: de twee vuurwapens moeten blind te onderscheiden zijn — "met
// de ogen dicht op het geluid" en "met het geluid uit op het beeld" — binnen
// de bestaande pools/tiers. Geen nieuwe effect-slots, geen extra lichten,
// geen schadewaarden.
//
// Dit bestand bewaakt de differentiatie zelf (audio-timbre, impact-snelheid,
// mondingsflits-schaal) en de twee harde randvoorwaarden: poolgroottes
// blijven ongewijzigd, en gemengd vuren van beide wapens tijdens een drukke
// golf verzadigt de impactPool niet. De bestaande, exacte deeltjes-/
// burst-AANTALLEN voor de AMSTEL-9 (3/5 lichaam/kop, KILL_BURST_AANTAL_*)
// staan al vast in test-effecten-pool.mjs/test-hitmarker-audio.mjs en worden
// hier bewust niet herhaald.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();
await geefSpelerVuurwapen(page);

// --- 1. "Blind op het geluid": de raak-/kop-/kill-tonen verschillen echt --
const audioProfiel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    amstel9: { raak: d.WAPEN_DRUKSPUIT.raakToon, kop: d.WAPEN_DRUKSPUIT.kopToon, kill: d.WAPEN_DRUKSPUIT.killToon },
    ripper: { raak: d.WAPEN_RATELAAR.raakToon, kop: d.WAPEN_RATELAAR.kopToon, kill: d.WAPEN_RATELAAR.killToon },
  };
});
const verschilt = (a, b) => a.type !== b.type || a.start !== b.start || a.eind !== b.eind || a.duur !== b.duur;
check('De raak-toon van de AMSTEL-9 en de Canal Ripper verschilt écht (type/frequentie/duur)',
  verschilt(audioProfiel.amstel9.raak, audioProfiel.ripper.raak), audioProfiel);
check('De kop-toon verschilt ook', verschilt(audioProfiel.amstel9.kop, audioProfiel.ripper.kop), audioProfiel);
check('De kill-toon verschilt ook', verschilt(audioProfiel.amstel9.kill, audioProfiel.ripper.kill), audioProfiel);

// --- 2. De AMSTEL-9's eigen tonen zijn LETTERLIJK de oude gedeelde waarden -
// Dit is het bit-voor-bit-contract dat test-hitmarker-audio.mjs (teller-
// checks) en het "geen versoepelde asserties"-uitgangspunt beschermt: de
// AMSTEL-9 mag door dit ticket geen ander geluid krijgen dan het al had.
check('AMSTEL-9 raakToon is exact de oude gedeelde waarde (square 320->90, 0.07s)',
  audioProfiel.amstel9.raak.type === 'square' && audioProfiel.amstel9.raak.start === 320
  && audioProfiel.amstel9.raak.eind === 90 && audioProfiel.amstel9.raak.duur === 0.07, audioProfiel);
check('AMSTEL-9 kopToon is exact de oude gedeelde waarde (square 460->140, 0.08s)',
  audioProfiel.amstel9.kop.type === 'square' && audioProfiel.amstel9.kop.start === 460
  && audioProfiel.amstel9.kop.eind === 140 && audioProfiel.amstel9.kop.duur === 0.08, audioProfiel);
check('AMSTEL-9 killToon is exact de oude gedeelde waarde (sawtooth 200->40, 0.14s)',
  audioProfiel.amstel9.kill.type === 'sawtooth' && audioProfiel.amstel9.kill.start === 200
  && audioProfiel.amstel9.kill.eind === 40 && audioProfiel.amstel9.kill.duur === 0.14, audioProfiel);

// --- 3. speelRaakTik()/speelKopTik()/speelKillKnak() lezen daadwerkelijk het
// actieve wapen — niet alleen de data-tabel, ook het GEDRAG. Bron-inspectie,
// zelfde patroon als de bestaande setTimeout-checks in test-effecten-pool.mjs
// en test-hitmarker-audio.mjs — geen nieuwe test-only machinerie in piep()
// zelf nodig.
const bronCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    raakTik: d.speelRaakTik.toString(),
    kopTik: d.speelKopTik.toString(),
    killKnak: d.speelKillKnak.toString(),
  };
});
check('speelRaakTik() leest wapenStaat.definitie.raakToon (niet een vaste waarde)',
  /wapenStaat\s*\.\s*definitie\s*\.\s*raakToon/.test(bronCheck.raakTik), bronCheck);
check('speelKopTik() leest wapenStaat.definitie.kopToon', /wapenStaat\s*\.\s*definitie\s*\.\s*kopToon/.test(bronCheck.kopTik), bronCheck);
check('speelKillKnak() leest wapenStaat.definitie.killToon', /wapenStaat\s*\.\s*definitie\s*\.\s*killToon/.test(bronCheck.killKnak), bronCheck);

// --- 4. Zonder vuurwapen (mes): de fallback is ONVERANDERD ----------------
// ontwerpbeslissing 97 laat de mes-audio hier los van beide wapens; de
// broncode moet daarvoor nog steeds de exacte oude gedeelde waarden bevatten,
// niet een van de twee nieuwe wapen-specifieke tabellen.
check('speelRaakTik() valt bij wapenStaat===null terug op RAAK_TOON_FALLBACK (ongewijzigde mes-audio)',
  /RAAK_TOON_FALLBACK/.test(bronCheck.raakTik) && /wapenStaat\s*\?/.test(bronCheck.raakTik), bronCheck);
check('speelKillKnak() valt bij wapenStaat===null terug op KILL_TOON_FALLBACK (het mes kan ook doden)',
  /KILL_TOON_FALLBACK/.test(bronCheck.killKnak) && /wapenStaat\s*\?/.test(bronCheck.killKnak), bronCheck);

// --- 5. "Blind op het beeld": impact-snelheid en mondingsflits-schaal ------
const visueleProfiel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    amstel9: { impact: d.WAPEN_DRUKSPUIT.impactSnelheidFactor, vlam: d.WAPEN_DRUKSPUIT.vlamSchaalFactor },
    ripper: { impact: d.WAPEN_RATELAAR.impactSnelheidFactor, vlam: d.WAPEN_RATELAAR.vlamSchaalFactor },
  };
});
check('AMSTEL-9 impactSnelheidFactor is 1 — ongewijzigd bestaand gedrag',
  visueleProfiel.amstel9.impact === 1, visueleProfiel);
check('Canal Ripper impactSnelheidFactor > 1 — meetbaar chaotischere spray',
  visueleProfiel.ripper.impact > 1, visueleProfiel);
check('De mondingsflits-schaalfactoren verschillen (AMSTEL-9 groter, Ripper kleiner)',
  visueleProfiel.amstel9.vlam > 1 && visueleProfiel.ripper.vlam < 1
  && visueleProfiel.amstel9.vlam !== visueleProfiel.ripper.vlam, visueleProfiel);

// --- 6. De Ripper's impact-deeltjes vliegen daadwerkelijk sneller uiteen,
// bij hetzelfde aantal deeltjes -------------------------------------------
const snelheidVergelijk = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const N = 200;
  const metenGemSnelheid = (factor) => {
    d.actieveEffecten.length = 0;
    for (const slot of d.impactPool) { slot.actief = false; slot.mesh.visible = false; }
    d.spawnImpact({ x: 0, y: 0, z: 0 }, d.MATERIAAL_KLEUREN.vijand, N, null, factor);
    const effecten = d.actieveEffecten.filter(e => e.soort === 'impact');
    const som = effecten.reduce((s, e) => s + Math.hypot(e.slot.vx, e.slot.vy, e.slot.vz), 0);
    return som / effecten.length;
  };
  return {
    amstel9: metenGemSnelheid(d.WAPEN_DRUKSPUIT.impactSnelheidFactor),
    ripper: metenGemSnelheid(d.WAPEN_RATELAAR.impactSnelheidFactor),
  };
});
check('De gemiddelde deeltjessnelheid van de Ripper-impact ligt meetbaar hoger dan de AMSTEL-9',
  snelheidVergelijk.ripper > snelheidVergelijk.amstel9 * 1.3, snelheidVergelijk);

// --- 7. Randvoorwaarde: poolgroottes blijven ongewijzigd, ook na dit ticket -
const poolMaten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { impactMax: d.IMPACT_MAX, tracerMax: d.TRACER_MAX, rookMax: d.ROOK_MAX };
});
check('IMPACT_MAX/TRACER_MAX/ROOK_MAX zijn ongewijzigd (24/8/8) — geen nieuwe effect-slots',
  poolMaten.impactMax === 24 && poolMaten.tracerMax === 8 && poolMaten.rookMax === 8, poolMaten);

// --- 8. Lichtaantal blijft 28: vlamSchaalFactor/impactSnelheidFactor voegen
// geen enkele PointLight toe (puur scalaire snelheids-/schaalfactoren) -----
const lichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let n = 0;
  d.scene.traverse(o => { if (o.isLight) n++; });
  return n;
});
check('Het totaal aantal lichten in de scene blijft 28', lichten === 28, { lichten });

// --- 9. Geen poolverzadiging bij gemengd vuren van beide wapens ------------
// Simuleert een drukke golf: 100 schoten AMSTEL-9, gevolgd door 100 schoten
// Ripper (dubbele cadans, hogere impactSnelheidFactor) — de impactPool mag
// nooit groeien, en actieve effecten blijven binnen IMPACT_MAX.
const gemengdVuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.updateSpeler(0);
  const impactPoolMaatVoor = d.impactPool.length;

  d.spelStaat.geld = 1000000;
  if (!d.wapenStaten.ratelaar) d.koopRatelaar();
  d.activeerVuurwapen('drukspuit');
  for (let i = 0; i < 100; i++) { d.wapenStaat.magazijn = d.wapenStaat.magazijnMax; d.wapenStaat.herladen = false; d.schiet(); }
  d.activeerVuurwapen('ratelaar');
  for (let i = 0; i < 100; i++) { d.wapenStaat.magazijn = d.wapenStaat.magazijnMax; d.wapenStaat.herladen = false; d.schiet(); }

  return {
    impactPoolMaatVoor, impactPoolMaatNa: d.impactPool.length, impactMax: d.IMPACT_MAX,
    actieveImpacts: d.actieveEffecten.filter(e => e.soort === 'impact').length,
  };
});
check('200 gemengde schoten (AMSTEL-9 + Ripper) laten de impactPool exact even groot (geen groei)',
  gemengdVuur.impactPoolMaatNa === gemengdVuur.impactPoolMaatVoor && gemengdVuur.impactPoolMaatNa === gemengdVuur.impactMax,
  gemengdVuur);
check('Actieve impacts blijven binnen IMPACT_MAX, ook met de Ripper\'s hogere snelheidsfactor',
  gemengdVuur.actieveImpacts <= gemengdVuur.impactMax, gemengdVuur);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
