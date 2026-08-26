// Mijlpaal M2 — "twee apart getunede wapens moeten sámen kloppen".
//
// Geen testbestand (bewust geen test-/check-prefix): dit meet en rapporteert.
//
// De kernvraag die T141's TTK-tabel NIET kon beantwoorden. Die tabel ging uit
// van "elke kogel raakt" en was dus puur een schade-/cadans-som. Sinds T143 mist
// de Canal Ripper een deel van zijn kogels (progressieve spreiding tot 7,7°) en
// klimt zijn richtpunt (pitchKickFractie 0,35). Zijn rauwe TTK-voordeel — in
// tier 0 en 1 was hij in élke cel even snel of sneller — hoeft dus niet meer
// te gelden.
//
// Hier wordt de trefferkans END-TO-END gemeten: een echt magazijn leegvuren op
// een echte ondode via schiet(), en tellen hoeveel kogels de echte
// hitbox-proxies raken. Twee scenario's per wapen, want daartussen zit precies
// de vaardigheidskloof die het ontwerp bedoelt:
//   ONGECOMPENSEERD — de speler trekt niet terug; de klim loopt vrij op.
//   GECOMPENSEERD   — de speler trekt de klim perfect terug; alleen de
//                     spreiding blijft over.
import { openAmsterdamUndead } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });

const AFSTANDEN = [3, 6, 10];   // m — kortbij, middellang, over de hele kamer
const HERHALINGEN = 40;         // magazijnen per cel; de spreiding is willekeurig

const trefferkans = await page.evaluate((args) => {
  const { AFSTANDEN, HERHALINGEN } = args;
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 10000000;
  if (!d.wapenStaten.drukspuit) d.koopAmstel9();
  if (!d.wapenStaten.ratelaar) d.koopRatelaar();

  // Mik op het midden van de lichaams-hitbox (y 0..1,45, midden 0,725) vanaf
  // ooghoogte 1,7 — dus iets omlaag, precies wat een speler doet.
  const OOG = d.speler.hoogte;
  const DOEL_Y = 0.725;

  const rijen = [];
  for (const wapenNaam of ['drukspuit', 'ratelaar']) {
    d.activeerVuurwapen(wapenNaam);
    const def = d.wapenStaat.definitie;
    const magazijn = def.magazijnMax;

    for (const afstand of AFSTANDEN) {
      for (const compenseert of [false, true]) {
        let raak = 0, geschoten = 0;
        const mikPitch = Math.atan2(DOEL_Y - OOG, afstand);

        for (let ronde = 0; ronde < HERHALINGEN; ronde++) {
          for (const o of [...d.ondoden]) d.doodOndode(o);
          const doel = d.spawnOndode(0, 'normaal');
          doel.hp = 1e9;                       // overleeft alles: we tellen treffers, niet kills
          doel.groep.position.set(0, 0, -afstand);
          doel.groep.rotation.y = 0;
          doel.groep.updateMatrixWorld(true);

          d.speler.positie.set(0, 0, 0);
          d.speler.yaw = 0;
          d.speler.pitch = mikPitch;
          d.wapenStaat.spreadOpbouw = 0;
          d.cameraKick = 0;
          d.wapenStaat.herladen = false;
          d.wapenStaat.magazijn = magazijn;

          const trefferVoor = d.runStats.treffers;
          for (let i = 0; i < magazijn; i++) {
            // Perfecte compensatie = het richtpunt elke keer terugzetten.
            if (compenseert) d.speler.pitch = mikPitch;
            d.updateSpeler(0);               // camera volgt speler.pitch + cameraKick
            doel.groep.updateMatrixWorld(true);
            d.schiet();
            geschoten++;
            d.vorigSchotKlok = d.klok;       // doorlopend vuren
            d.updateWapen(def.schotCooldown);
            d.updateWapenPresentatie(def.schotCooldown);
            // cameraKick vervalt NIET in updateWapenPresentatie(): hij hoort
            // bij de camera, en T140 liet camera-effecten expliciet buiten
            // scope — de decay staat in de cosmetische gameLoop-zone, die
            // hier niet draait. Zonder dit stapelt de kick ongeremd op tot
            // het beeld over de ondode heen wijst; de AMSTEL-9 (spreiding
            // exact 0) "miste" daardoor 42% van zijn kogels op 10 m, wat per
            // definitie onmogelijk is. Dit is letterlijk de gameLoop-regel,
            // en meet-gunfeel.mjs heeft al aangetoond dat deze formule zich
            // in de echte loop precies zo gedraagt.
            d.cameraKick = d.cameraKick > 0
              ? Math.max(0, d.cameraKick * Math.exp(-10 * def.schotCooldown)) : 0;
          }
          raak += d.runStats.treffers - trefferVoor;
          d.doodOndode(doel);
        }

        rijen.push({
          wapen: def.naam, afstand, compenseert,
          geschoten, raak,
          trefferkans: Number((raak / geschoten).toFixed(4)),
        });
      }
    }
  }
  return rijen;
}, { AFSTANDEN, HERHALINGEN });

// --- effectieve TTK: schoten-tot-kill gedeeld door de trefferkans ----------
// De schade zelf is door T142/T143/T144 niet aangeraakt (alle drie sluiten
// schadewaarden expliciet uit), dus het aantal RAKE kogels per kill komt nog
// steeds uit de T141-tabel. Effectieve TTK = dat aantal / trefferkans,
// x de cadans.
const effectief = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uit = [];
  for (const wapenNaam of ['drukspuit', 'ratelaar']) {
    d.activeerVuurwapen(wapenNaam);
    const def = d.wapenStaat.definitie;
    for (let tier = 0; tier <= 2; tier++) {
      d.wapenStaat.gesmeed = tier >= 1;
      d.wapenStaat.gesmeedNiveau2 = tier >= 2;
      for (const trap of [1, 2, 3, 4]) {
        d.spelStaat.golf = { 1: 1, 2: 5, 3: 11, 4: 16 }[trap];
        const o = d.spawnOndode(0, 'normaal');
        o.hp = d.ondodeStartHP();
        let schoten = 0;
        while (o.hp > 0 && schoten < 200) { d.raakOndode(o, o.groep.position, false); schoten++; }
        d.doodOndode(o);
        uit.push({ wapen: def.naam, tier, hpTrap: trap, rakeSchotenNodig: schoten, cadans: def.schotCooldown });
      }
    }
    d.wapenStaat.gesmeed = false;
    d.wapenStaat.gesmeedNiveau2 = false;
  }
  return uit;
});

// --- Fix 5 tier-2: is de beloning nog voelbaar naast de nieuwe gunfeel? ----
const tier2 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    amstel9Explosie: {
      radius: d.AMSTEL9_EXPLOSIE_RADIUS,
      schadeFactor: d.AMSTEL9_EXPLOSIE_SCHADEFACTOR,
    },
    ripperDoorboring: {
      schadeFactor: d.RIPPER_DOORBORING_SCHADEFACTOR,
      maxExtraDoelen: 1,
    },
    smederijBonus: {
      amstel9: d.WAPEN_DRUKSPUIT.smederijConfig.map(c => c.schadeBonus),
      ripper: d.WAPEN_RATELAAR.smederijConfig.map(c => c.schadeBonus),
    },
  };
});

// --- rapportage ------------------------------------------------------------
console.log('=== A. Gemeten trefferkans (echt magazijn, echte hitbox-raycast) ===');
console.log(`${HERHALINGEN} magazijnen per cel.\n`);
console.log('wapen                afstand  compensatie   treffers/schoten   kans');
for (const r of trefferkans) {
  console.log(`${r.wapen.padEnd(20)} ${String(r.afstand + 'm').padEnd(8)} ${(r.compenseert ? 'ja' : 'nee').padEnd(13)} ${String(r.raak + '/' + r.geschoten).padEnd(18)} ${(r.trefferkans * 100).toFixed(1)}%`);
}

const kansVan = (wapen, afstand, comp) =>
  trefferkans.find(r => r.wapen === wapen && r.afstand === afstand && r.compenseert === comp).trefferkans;

console.log('\n=== B. Effectieve TTK op 6 m (rake schoten / trefferkans x cadans) ===');
console.log('Vergeleken met de T141-tabel, die uitging van "elke kogel raakt".\n');
console.log('wapen                tier  hp  rauwe TTK   eff. TTK (gecomp.)  eff. TTK (ongecomp.)');
for (const e of effectief) {
  const kansC = kansVan(e.wapen, 6, true);
  const kansO = kansVan(e.wapen, 6, false);
  const rauw = (e.rakeSchotenNodig - 1) * e.cadans;
  const effC = kansC > 0 ? (e.rakeSchotenNodig / kansC - 1) * e.cadans : Infinity;
  const effO = kansO > 0 ? (e.rakeSchotenNodig / kansO - 1) * e.cadans : Infinity;
  console.log(`${e.wapen.padEnd(20)} ${String(e.tier).padEnd(5)} ${String(e.hpTrap).padEnd(3)} ${rauw.toFixed(2).padEnd(11)} ${effC.toFixed(2).padEnd(19)} ${effO.toFixed(2)}`);
}

console.log('\n=== C. Fix 5 tier-2-beloningen ===');
console.log(JSON.stringify(tier2, null, 2));

console.log('\n=== JSON ===');
console.log(JSON.stringify({ trefferkans, effectief, tier2 }));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
