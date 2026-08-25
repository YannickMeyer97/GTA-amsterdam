// Ticket 141 — gunfeel-meting: waar staat het spel VANDAAG?
//
// Geen testbestand (bewust geen test-/check-prefix, zoals de andere meet-*.mjs):
// dit meet en rapporteert, het assert niets. T142 (AMSTEL-9) en T143 (Canal
// Ripper) draaien ditzelfde script opnieuw om hun resultaat af te toetsen tegen
// de doelbanden in GUNFEEL.md — vandaar dat de uitvoer machinaal leesbaar is
// (JSON aan het eind) én leesbaar voor een mens.
//
// Wat er gemeten wordt (zie de ticket-spec):
//   A. TTK-tabel: 2 wapens x 4 HP-trappen x lichaam/kop x 3 Smederij-tiers = 48
//   B. Effectieve schotcadans en magazijnduur
//   C. Spreidingskegel in graden (empirisch bemonsterd, niet afgeleid)
//   D. Recoil-hersteltijd tot binnen 5%
//   E. Ratel-straf: de deterministische camera-klim bij te snel vuren (T142)
//   F. Progressieve spreiding over een vol magazijn (T143)
import { openAmsterdamUndead, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

// --- A. TTK-tabel ----------------------------------------------------------
// TTK = (schoten - 1) x schotCooldown: het eerste schot valt op t=0, daarna
// wacht elk volgend schot de cooldown af. Dat is de THEORETISCHE ondergrens
// (perfect getimed, elke kogel raak) — precies wat je wilt vergelijken tussen
// wapens en tiers, zonder mikvaardigheid erin te mengen. De mikkant zit in C.
//
// Het aantal schoten wordt ECHT geteld door raakOndode() aan te roepen tot de
// ondode dood is — dus via het echte schadepad, inclusief berekenSmederijBonus()
// en HEADSHOT_EXTRA, niet via een nagebouwde formule.
const ttk = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 10000000;
  if (!d.wapenStaten.drukspuit) d.koopAmstel9();
  if (!d.wapenStaten.ratelaar) d.koopRatelaar();

  const rijen = [];
  for (const wapen of ['drukspuit', 'ratelaar']) {
    // Verse staat per wapen, zodat een eerder gemeten tier niet doorlekt.
    d.wapenStaten[wapen].gesmeed = false;
    d.wapenStaten[wapen].gesmeedNiveau2 = false;
  }

  for (const wapen of ['drukspuit', 'ratelaar']) {
    for (let tier = 0; tier <= 2; tier++) {
      // Activeer het wapen en zet zijn Smederij-tier.
      d.activeerVuurwapen(wapen);
      d.wapenStaten[wapen].gesmeed = tier >= 1;
      d.wapenStaten[wapen].gesmeedNiveau2 = tier >= 2;

      for (const trap of [1, 2, 3, 4]) {
        // spelStaat.golf bepaalt de HP-trap; kies de eerste golf van elke trap.
        d.spelStaat.golf = { 1: 1, 2: 5, 3: 11, 4: 16 }[trap];
        const startHP = d.ondodeStartHP();

        for (const kop of [false, true]) {
          const o = d.spawnOndode(0, 'normaal');
          o.hp = startHP;   // expliciet: geen type-multiplier, precies de trap
          let schoten = 0;
          while (o.hp > 0 && schoten < 200) {
            d.raakOndode(o, o.groep.position, kop);
            schoten++;
          }
          d.doodOndode(o);
          const cooldown = d.wapenStaten[wapen].definitie.schotCooldown;
          rijen.push({
            wapen: d.wapenStaten[wapen].definitie.naam, tier, hpTrap: startHP,
            zone: kop ? 'kop' : 'lichaam',
            schoten,
            ttkSec: Number(((schoten - 1) * cooldown).toFixed(3)),
          });
        }
      }
    }
  }
  // Terug naar tier 0, zodat latere secties een schoon wapen meten.
  for (const wapen of ['drukspuit', 'ratelaar']) {
    d.wapenStaten[wapen].gesmeed = false;
    d.wapenStaten[wapen].gesmeedNiveau2 = false;
  }
  return rijen;
});

// --- B. Cadans en magazijnduur --------------------------------------------
const cadans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = [];
  for (const def of [d.WAPEN_DRUKSPUIT, d.WAPEN_RATELAAR]) {
    for (let tier = 0; tier <= 2; tier++) {
      // magazijnMax groeit met de Smederij-tier (smederijConfig), dus de
      // magazijnduur ook — dat is een deel van hoe een tier "voelt".
      const magMax = tier === 0 ? def.magazijnMax : def.smederijConfig[tier - 1].magazijnMax;
      uit.push({
        wapen: def.naam, tier,
        schotCooldown: def.schotCooldown,
        schotenPerSec: Number((1 / def.schotCooldown).toFixed(2)),
        magazijnMax: magMax,
        magazijnduurSec: Number((magMax * def.schotCooldown).toFixed(2)),
        herlaadNormaal: def.herlaadDuurNormaal,
        herlaadSnel: def.herlaadDuurSnel,
      });
    }
  }
  return uit;
});

// --- C. Spreidingskegel (empirisch bemonsterd) -----------------------------
// schiet() doet: raycaster.setFromCamera({ x: (rnd-0.5)*spread, y: (rnd-0.5)*spread }).
// De hoek die dat oplevert hangt af van de FOV én de aspect-ratio (NDC-x wordt
// met de aspect geschaald), dus dit wordt bemonsterd i.p.v. uitgerekend.
const spreiding = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const N = 20000;
  const eigenRaycaster = new d.THREE.Raycaster();   // eigen instantie: raakt de gedeelde niet aan
  const voorwaarts = new d.THREE.Vector3(0, 0, -1).applyQuaternion(d.camera.quaternion).normalize();
  const uit = [];
  for (const def of [d.WAPEN_DRUKSPUIT, d.WAPEN_RATELAAR]) {
    const spread = def.spreadNdc;
    let max = 0, som = 0;
    for (let i = 0; i < N; i++) {
      eigenRaycaster.setFromCamera(
        { x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread }, d.camera);
      const hoek = voorwaarts.angleTo(eigenRaycaster.ray.direction) * 180 / Math.PI;
      max = Math.max(max, hoek);
      som += hoek;
    }
    uit.push({
      wapen: def.naam, spreadNdc: spread,
      maxAfwijkingGraden: Number(max.toFixed(4)),
      gemAfwijkingGraden: Number((som / N).toFixed(4)),
      kegelBreedteGraden: Number((2 * max).toFixed(4)),
      monsters: N,
    });
  }
  return { fovGraden: d.camera.fov, aspect: Number(d.camera.aspect.toFixed(4)), perWapen: uit };
});

// --- D. Recoil-hersteltijd tot binnen 5% -----------------------------------
// Beide decays telescoperen over de SOM VAN dt, onafhankelijk van hoe die som
// in frames verdeeld is:
//   cameraKick: k *= exp(-10*dt)  ->  k0 * exp(-10*Sigma dt)
//   terugslag:  t -= dt*6         ->  t0 - 6*Sigma dt
// Daardoor is de hersteltijd exact af te leiden i.p.v. af te tellen met een
// rAF-klok die in headless Chromium onbruikbaar traag is.
//
// LET OP — "Sigma dt" is GESIMULEERDE tijd, niet wall-clock. De gameLoop klemt
// elke frame op `Math.min((nu - vorigeTijd)/1000, 0.05)` (de hitch-guard). Bij
// 60 fps (dt 16,7 ms) valt dat nooit aan, en zijn de twee gelijk — dat is de
// situatie waarvoor de getallen hieronder gelden. Bij zwaar haperen (frames
// > 50 ms, zoals in deze headless omgeving) loopt de gesimuleerde tijd ACHTER
// op de wall-clock, en duurt het recoil-herstel in echte seconden dus langer.
// De verificatie hieronder rekent daarom expliciet met de geklemde som; een
// eerdere versie vergeleek tegen wall-clock en gaf daardoor een "afwijking"
// van 14 ordes van grootte, wat niets over de formule zei en alles over de
// klem. T142/T143 moeten hun recovery-doelen in gesimuleerde tijd uitdrukken.
const recoil = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    cameraKick: {
      // exp(-10*T) = 0.05  ->  T = ln(20)/10
      hersteltijd5procent: Number((Math.log(20) / 10).toFixed(4)),
      perWapen: [
        { wapen: d.WAPEN_DRUKSPUIT.naam, kickSterkte: d.WAPEN_DRUKSPUIT.kickSterkte,
          pieksterkteGraden: Number((d.WAPEN_DRUKSPUIT.kickSterkte * 180 / Math.PI).toFixed(3)) },
        { wapen: d.WAPEN_RATELAAR.naam, kickSterkte: d.WAPEN_RATELAAR.kickSterkte,
          pieksterkteGraden: Number((d.WAPEN_RATELAAR.kickSterkte * 180 / Math.PI).toFixed(3)) },
      ],
    },
    terugslag: {
      // t0 - 6T = 0.05*t0  ->  T = 0.95*t0/6
      perWapen: [
        { wapen: d.WAPEN_DRUKSPUIT.naam, sterkte: d.WAPEN_DRUKSPUIT.terugslagSterkte,
          hersteltijd5procent: Number((0.95 * d.WAPEN_DRUKSPUIT.terugslagSterkte / 6).toFixed(4)),
          volledigTerugSec: Number((d.WAPEN_DRUKSPUIT.terugslagSterkte / 6).toFixed(4)),
          // z-uitslag in meters: position.z = basisZ + terugslag*0.08
          piekUitslagMeter: Number((d.WAPEN_DRUKSPUIT.terugslagSterkte * 0.08).toFixed(4)) },
        { wapen: d.WAPEN_RATELAAR.naam, sterkte: d.WAPEN_RATELAAR.terugslagSterkte,
          hersteltijd5procent: Number((0.95 * d.WAPEN_RATELAAR.terugslagSterkte / 6).toFixed(4)),
          volledigTerugSec: Number((d.WAPEN_RATELAAR.terugslagSterkte / 6).toFixed(4)),
          piekUitslagMeter: Number((d.WAPEN_RATELAAR.terugslagSterkte * 0.08).toFixed(4)) },
      ],
    },
  };
});

// Empirische verificatie van de twee decay-formules tegen de ECHTE gameLoop:
// zet beide waarden, laat echte frames lopen, en vergelijk de gemeten waarde
// met wat de formule voor de verstreken wall-clock tijd voorspelt.
const verificatie = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.cameraKick = 1;
  d.terugslag = 1;
  // Twee onafhankelijke rAF-ketens (die van de test en die van de gameLoop)
  // laten hun intervalgrenzen niet betrouwbaar uitlijnen, dus een externe klok
  // is hier het verkeerde gereedschap. In plaats daarvan verifiëren de twee
  // decays ELKAAR: ze lopen over exact dezelfde Sigma dt, dus als je die uit
  // allebei terugrekent moet er hetzelfde uitkomen. Klopt dat, dan gedragen
  // beide formules zich zoals afgeleid — zonder dat er ergens een tijd
  // gemeten hoeft te worden.
  //   uit cameraKick: k = exp(-10*S)   ->  S = -ln(k)/10
  //   uit terugslag:  t = 1 - 6*S      ->  S = (1-t)/6
  // Weinig frames, zodat terugslag niet op zijn nulbodem zit (dat gebeurt al
  // bij S = 1/6) en dus nog informatie draagt.
  await new Promise(resolve => {
    let i = 0;
    const tik = () => { if (++i >= 2) resolve(); else requestAnimationFrame(tik); };
    requestAnimationFrame(tik);
  });
  const kickGemeten = d.cameraKick;
  const terugslagGemeten = d.terugslag;
  d.cameraKick = 0;
  d.terugslag = 0;
  return {
    kickGemeten, terugslagGemeten,
    sigmaDtUitKick: -Math.log(kickGemeten) / 10,
    sigmaDtUitTerugslag: (1 - terugslagGemeten) / 6,
    terugslagVerzadigd: terugslagGemeten <= 0,
  };
});

// --- E. Ratel-straf (Ticket 142) -------------------------------------------
// De deterministische straf op vuren vóórdat de camera-kick hersteld is. Wat de
// speler ervan merkt is niet de kick zelf maar het EVENWICHT: waar het vizier
// staat op het moment dat de volgende kogel vertrekt. Dat is de kick in
// evenwicht, na de decay over één cadans-interval.
const ratelStraf = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = [];
  for (const def of [d.WAPEN_DRUKSPUIT, d.WAPEN_RATELAAR]) {
    const factor = (gat) => 1 + def.kickRatelStraf * (1 - Math.min(1, gat / d.KICK_HERSTELVENSTER));
    const rij = { wapen: def.naam, kickRatelStraf: def.kickRatelStraf, perCadans: [] };
    for (const cadans of [def.schotCooldown, 0.30]) {
      const kickPerSchot = def.kickSterkte * factor(cadans);
      // Evenwicht van k <- k*exp(-10*cadans) + kickPerSchot
      const evenwicht = kickPerSchot / (1 - Math.exp(-10 * cadans));
      // Stand op het moment van het volgende schot (dus ná één interval decay).
      const bijAfvuren = evenwicht * Math.exp(-10 * cadans);
      rij.perCadans.push({
        cadans, factor: Number(factor(cadans).toFixed(4)),
        evenwichtGraden: Number((evenwicht * 180 / Math.PI).toFixed(4)),
        vizierOffsetGraden: Number((bijAfvuren * 180 / Math.PI).toFixed(4)),
      });
    }
    uit.push(rij);
  }
  return { herstelvenster: d.KICK_HERSTELVENSTER, perWapen: uit };
});

// --- F. Progressieve spreiding (Ticket 143) --------------------------------
// De ANDERE soort straf: waar de AMSTEL-9 doorratelen bestraft met een leerbare
// camera-klim, doet de Canal Ripper het met willekeurige spreiding. Gemeten via
// het echte pad: schiet() hoogt de opbouw op, updateWapen() bouwt hem af.
const progressief = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 1000000;
  if (!d.wapenStaten.ratelaar) d.koopRatelaar();
  const kegelPerNdc = 0.906 / 0.012;   // uit sectie C: 0,012 NDC == 0,906 graden
  const uit = [];
  for (const naam of ['drukspuit', 'ratelaar']) {
    d.activeerVuurwapen(naam);
    const def = d.wapenStaat.definitie;
    d.wapenStaat.herladen = false;
    d.wapenStaat.magazijn = 999;
    d.wapenStaat.spreadOpbouw = 0;
    const reeks = [];
    for (let i = 0; i < 16; i++) {
      reeks.push(def.spreadNdc + d.wapenStaat.spreadOpbouw);
      d.schiet();
      d.vorigSchotKlok = d.klok;          // doorlopend vuren
      d.updateWapen(def.schotCooldown);
    }
    // Herstel na loslaten van de trekker.
    d.vorigSchotKlok = d.klok - 999;
    let stappen = 0;
    while (d.wapenStaat.spreadOpbouw > 0 && stappen < 5000) { d.updateWapen(0.005); stappen++; }
    uit.push({
      wapen: def.naam,
      schot1Ndc: reeks[0], schot16Ndc: reeks[15],
      schot1Graden: Number((reeks[0] * kegelPerNdc).toFixed(3)),
      schot16Graden: Number((reeks[15] * kegelPerNdc).toFixed(3)),
      schoonNaSec: Number((stappen * 0.005).toFixed(3)),
    });
  }
  return uit;
});

// --- rapportage ------------------------------------------------------------
const pct = (a, b) => b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / b * 100;

console.log('=== A. TTK-tabel (48 cellen) ===');
console.log('wapen                tier  hp  zone      schoten   TTK(s)');
for (const r of ttk) {
  console.log(`${r.wapen.padEnd(20)} ${String(r.tier).padEnd(5)} ${String(r.hpTrap).padEnd(3)} ${r.zone.padEnd(9)} ${String(r.schoten).padEnd(9)} ${r.ttkSec}`);
}

console.log('\n=== B. Cadans en magazijnduur ===');
for (const c of cadans) {
  console.log(`${c.wapen.padEnd(20)} tier ${c.tier}  ${c.schotenPerSec}/s  magazijn ${c.magazijnMax} (${c.magazijnduurSec}s leeg)  herlaad ${c.herlaadNormaal}s / ${c.herlaadSnel}s snel`);
}

console.log('\n=== C. Spreidingskegel (FOV ' + spreiding.fovGraden + '°, aspect ' + spreiding.aspect + ') ===');
for (const s of spreiding.perWapen) {
  console.log(`${s.wapen.padEnd(20)} spreadNdc ${s.spreadNdc}  max ±${s.maxAfwijkingGraden}°  gem ${s.gemAfwijkingGraden}°  volle kegel ${s.kegelBreedteGraden}°`);
}

console.log('\n=== D. Recoil-herstel ===');
console.log(`camera-kick hersteltijd tot binnen 5%: ${recoil.cameraKick.hersteltijd5procent}s (gelijk voor beide wapens: zelfde decay-constante)`);
for (const w of recoil.cameraKick.perWapen) {
  console.log(`  ${w.wapen.padEnd(20)} piek ${w.pieksterkteGraden}° camera-kick per schot`);
}
for (const w of recoil.terugslag.perWapen) {
  console.log(`  ${w.wapen.padEnd(20)} model-terugslag piek ${w.piekUitslagMeter}m, binnen 5% na ${w.hersteltijd5procent}s, volledig terug na ${w.volledigTerugSec}s`);
}

console.log(`\n=== E. Ratel-straf (herstelvenster ${ratelStraf.herstelvenster.toFixed(4)}s) ===`);
for (const w of ratelStraf.perWapen) {
  if (w.kickRatelStraf === 0) { console.log(`${w.wapen.padEnd(20)} geen ratel-straf (straft doorratelen met spreiding)`); continue; }
  console.log(`${w.wapen.padEnd(20)} kickRatelStraf ${w.kickRatelStraf}`);
  for (const c of w.perCadans) {
    console.log(`  cadans ${c.cadans}s -> factor ${c.factor}, evenwicht ${c.evenwichtGraden}°, vizier bij afvuren ${c.vizierOffsetGraden}°`);
  }
  const [snel, traag] = w.perCadans;
  console.log(`  -> ratelen zet het vizier ${(snel.vizierOffsetGraden / traag.vizierOffsetGraden).toFixed(2)}x zo ver van je richtpunt`);
}

console.log('\n=== F. Progressieve spreiding over een vol magazijn (16 schoten) ===');
for (const p of progressief) {
  console.log(`${p.wapen.padEnd(20)} schot 1: ${p.schot1Graden}°  ->  schot 16: ${p.schot16Graden}°  (schoon na ${p.schoonNaSec}s)`);
}

console.log('\n=== Verificatie: de twee decays impliceren dezelfde gesimuleerde tijd ===');
if (verificatie.terugslagVerzadigd) {
  console.log('  terugslag zat al op zijn nulbodem — geen zinvolle kruiscontrole deze run');
} else {
  const afw = pct(verificatie.sigmaDtUitKick, verificatie.sigmaDtUitTerugslag);
  console.log(`  Sigma dt uit cameraKick: ${verificatie.sigmaDtUitKick.toFixed(5)}s`);
  console.log(`  Sigma dt uit terugslag:  ${verificatie.sigmaDtUitTerugslag.toFixed(5)}s`);
  console.log(`  verschil ${afw.toFixed(3)}% -> ${afw < 1 ? 'beide formules gedragen zich zoals afgeleid' : 'AFWIJKING, nader onderzoeken'}`);
}

console.log('\n=== JSON ===');
console.log(JSON.stringify({ ttk, cadans, spreiding, recoil, ratelStraf, progressief, verificatie }));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
