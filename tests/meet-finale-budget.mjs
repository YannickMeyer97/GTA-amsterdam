// Ticket 145 — begroting voor de finale (instapfase).
//
// Geen testbestand (bewust geen test-/check-prefix): dit meet en rapporteert,
// zodat het ontwerp op echte getallen staat in plaats van op de aannames in
// ARCHITECTURE_NOTES §13.6. Die noemt een spawn-plafond van "max 26"; de code
// lijkt op 18 uit te komen. Dat verschil bepaalt hoeveel druk een surge van
// 30 seconden überhaupt KAN opbouwen, dus het moet kloppen voor T146/T147
// beginnen.
//
// Gemeten:
//   A. Spawn-plafond en -tempo per zonestand (hoeveel ondoden kunnen er
//      werkelijk tegelijk leven, en hoe snel komen ze binnen).
//   B. Wat een surge van 30 s aan budget kost, afgezet tegen een hele golf.
//   C. De invarianten die het ticket vraagt te begroten: interactiePunten,
//      lichten, effect-pools.
import { openAmsterdamUndead } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

const FINALE_DUUR = 30;   // s — de voorgestelde duur uit T145-beslissing 2

const meting = await page.evaluate((duur) => {
  const d = window.AmsterdamUndeadDebug;

  // --- A. Spawn-plafond en -tempo per zonestand -----------------------
  // aantalOntgrendeldeZones() telt zone A altijd mee, plus elke gekochte
  // deur; de formules clampen op 3. De zonestand wordt hier nagebootst door
  // de deur-vlaggen te zetten, want dat is precies wat die functie leest.
  const zoneStanden = [];
  const zetDeuren = (n) => {
    d.deurGekocht = n >= 2;
    d.deur2Gekocht = n >= 3;
    d.deur3Gekocht = n >= 4;
  };
  const oorspronkelijk = { a: d.deurGekocht, b: d.deur2Gekocht, c: d.deur3Gekocht };
  for (let zones = 1; zones <= 4; zones++) {
    zetDeuren(zones);
    zoneStanden.push({
      zones: d.aantalOntgrendeldeZones(),
      maxActief: d.effectiefMaxActief(),
      spawnInterval: Number(d.effectiefSpawnInterval().toFixed(3)),
      spawnsIn30s: Math.floor(duur / d.effectiefSpawnInterval()),
    });
  }
  d.deurGekocht = oorspronkelijk.a;
  d.deur2Gekocht = oorspronkelijk.b;
  d.deur3Gekocht = oorspronkelijk.c;

  // --- B. Budget: wat kost een surge van `duur` seconden? -------------
  // Een spawn kost ONDODE_THREAT_KOSTEN[type]. Het gemiddelde hangt af van
  // de type-weging per golf, dus hier drie scenario's: alles goedkoop
  // (normaal), het echte gemiddelde over de kostentabel, en alles duur
  // (sjouwer).
  const kosten = d.ONDODE_THREAT_KOSTEN;
  const alleKosten = Object.values(kosten);
  const gemKosten = alleKosten.reduce((s, k) => s + k, 0) / alleKosten.length;

  const golfBudgetten = {};
  for (const golf of [10, 13, 16, 19, 22]) golfBudgetten[golf] = d.golfBudget(golf);

  return {
    zoneStanden,
    kosten,
    gemKosten: Number(gemKosten.toFixed(2)),
    golfBudgetten,
    // C. Invarianten
    interactiePunten: d.interactiePunten.length,
    lichten: (() => { let n = 0; d.scene.traverse(o => { if (o.isLight) n++; }); return n; })(),
    poolMaten: { impact: d.IMPACT_MAX, tracer: d.TRACER_MAX, rook: d.ROOK_MAX },
    // Bestaande ritmes, ter ijking van de duur
    ritmes: {
      golfRustTijd: d.GOLF_RUST_TIJD,
      aankondigingDuur: d.ONTSNAPPING_AANKONDIGING_DUUR,
      boothoornInterval: d.BOOT_HOORN_HERHAAL_INTERVAL,
      ontsnappingPrijs: d.ONTSNAPPING_PRIJS,
    },
  };
}, FINALE_DUUR);

console.log('=== A. Spawn-plafond en -tempo per zonestand ===');
console.log('zones  maxActief  spawnInterval  spawns in ' + FINALE_DUUR + 's');
for (const z of meting.zoneStanden) {
  console.log(`${String(z.zones).padEnd(6)} ${String(z.maxActief).padEnd(10)} ${String(z.spawnInterval + 's').padEnd(14)} ${z.spawnsIn30s}`);
}
const maxPlafond = Math.max(...meting.zoneStanden.map(z => z.maxActief));
console.log(`\nHoogste plafond dat het spel kent: ${maxPlafond} gelijktijdige ondoden.`);

console.log('\n=== B. Budget voor een surge van ' + FINALE_DUUR + 's ===');
console.log('Threat-kosten per type:', JSON.stringify(meting.kosten));
console.log(`Gemiddelde kosten per spawn: ${meting.gemKosten}`);
const surgeSpawns = meting.zoneStanden[meting.zoneStanden.length - 1].spawnsIn30s;
console.log(`\nBij het snelste tempo passen er ${surgeSpawns} spawnpogingen in ${FINALE_DUUR}s.`);
console.log(`Budget daarvoor: ${surgeSpawns} x ${meting.gemKosten} = ${(surgeSpawns * meting.gemKosten).toFixed(1)}`);
console.log('\nTer vergelijking, het budget van een hele golf:');
for (const [golf, budget] of Object.entries(meting.golfBudgetten)) {
  console.log(`  golf ${golf}: ${budget}`);
}

console.log('\n=== C. Invarianten om te bewaken ===');
console.log(`interactiePunten: ${meting.interactiePunten}`);
console.log(`lichten: ${meting.lichten}`);
console.log('effect-pools:', JSON.stringify(meting.poolMaten));
console.log('bestaande ritmes:', JSON.stringify(meting.ritmes));

console.log('\n=== JSON ===');
console.log(JSON.stringify(meting));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
