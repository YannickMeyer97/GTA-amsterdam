// Ticket 156 (v0.26, ronde 12): de Brander leesbaar zonder kleur. Het enige
// onderscheid tussen ONDODE_TYPES.normaal en .brander was kleur — lijf en
// ogen, precies op de rood-groen-as waar deuteranopie/protanopie slecht op
// discrimineert, en tijdens een Stroomuitval het ENIGE zichtbare kanaal (de
// rest van het lichaam valt weg in het donker). Deze test bewaakt de fix:
// een permanente, zachte kernpuls op de Brander-borstkas — een helderheids-
// signaal, geen kleursignaal — die de bestaande flinch-kernpuls (T21) niet
// overschrijft maar ermee samengesteld is tot ÉÉN schrijfplek.
//
// WAAROM DIT SCRIPT NIET GEWOON updateOndoden(grote dt) DOET EN EEN
// SCREENSHOT NEEMT (gevonden tijdens het bouwen, geen "leuk weetje" maar de
// reden dat de eerste versie van deze test valse signalen van 80-100% gaf):
//   1. `ondode.loopFase` loopt op WERKELIJK AFGELEGDE AFSTAND binnen één
//      updateOndoden()-aanroep (T148), niet op tijd. Een ondode die naar de
//      speler toe loopt zwaait dus zijn armen door de gemeten crop-regio —
//      een confound die niets met de kernpuls te maken heeft, maar een
//      luminantieverschil oplevert die groter is dan het echte signaal.
//      Fix: `ondode.snelheid = 0` vóór de meting — geen AI-verplaatsing,
//      geen loopFase-drift, geen wandel-animatie.
//   2. `stroomFactor` herstelt zichzelf elk ECHT rAF-frame terug richting 1
//      tenzij `actieveEventGolf === 'stroomuitval'` — zonder die vlag drift
//      een "vaste" 0,12 tijdens een meetreeks van een paar seconden naar
//      0,22. Fix: `actieveEventGolf` mee zetten, niet alleen `stroomFactor`.
// Met beide fixes is een stilstaande, niet-aanvallende ondode van hetzelfde
// type op twee momenten BIT-VOOR-BIT identiek (geverifieerd: 10 metingen op
// een Normaal-type gaven exact dezelfde waarde) — wat overblijft is precies
// het kanaal dat dit ticket test.
import { openVoorVisueleMeting, zetVisueelStandpunt, frames, makeChecker } from './helpers.mjs';
import { PNG } from 'pngjs';

const { check, report } = makeChecker();

// Vaste traits: geen 'eenarmig'/kromme-rug/lengteverschil-ruis in de crop.
const TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
const HERHALINGEN = 10, STAP_DT = 0.05, STAPPEN_PER_METING = 6;   // 10 metingen over 3s (~1 rustpuls-periode)

function cropLuminantie(buf, cx, cy, straal) {
  const png = PNG.sync.read(buf);
  let som = 0, n = 0;
  for (let y = cy - straal; y < cy + straal; y++) {
    for (let x = cx - straal; x < cx + straal; x++) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = (png.width * y + x) << 2;
      som += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  }
  return som / n;
}

// Eén meetreeks: spawnt `type` op een vaste, stilstaande positie, en
// bemonstert de luminantie in de torso-regio (romp-bone-projectie, werkt
// voor elk type) over ~1 rustpuls-periode. `stroomuitval` schakelt de
// Stroomuitval-lichtstand in vóórdat er gespawned wordt.
async function meetLuminantieReeks(type, { stroomuitval = false } = {}) {
  const { browser, page, errs } = await openVoorVisueleMeting();
  await zetVisueelStandpunt(page, { x: 0, z: 1, yaw: 0, pitch: -0.25 });
  if (stroomuitval) {
    await page.evaluate(() => {
      const d = window.AmsterdamUndeadDebug;
      d.actieveEventGolf = 'stroomuitval';   // blokkeert de eigen recovery-logica (zie toelichting bovenaan)
      d.stroomFactor = 0.12;   // STROOMUITVAL_DIM_FACTOR
    });
    await frames(page, 3);
  }
  const setup = await page.evaluate((args) => {
    const d = window.AmsterdamUndeadDebug;
    const THREE = d.THREE;
    const o = d.spawnOndode(0, args.type, args.traits);
    o.groep.position.set(0, 0, -2.5);
    o.groep.rotation.y = 0;
    o.snelheid = 0;   // test-only: isoleert de kernpuls van AI-verplaatsing (zie toelichting bovenaan)
    d.updateOndoden(0);
    const w = new THREE.Vector3();
    o.delen.romp.getWorldPosition(w);
    const ndc = w.clone().project(d.camera);
    return {
      px: Math.round((ndc.x + 1) / 2 * innerWidth),
      py: Math.round((1 - ndc.y) / 2 * innerHeight),
      stroomFactor: d.stroomFactor,
    };
  }, { type, traits: TRAITS });

  const metingen = [];
  for (let i = 0; i < HERHALINGEN * STAPPEN_PER_METING; i++) {
    await page.evaluate((dt) => window.AmsterdamUndeadDebug.updateOndoden(dt), STAP_DT);
    if (i % STAPPEN_PER_METING === STAPPEN_PER_METING - 1) {
      await page.evaluate(() => window.AmsterdamUndeadDebug.composer.render());
      const buf = await page.screenshot({ type: 'png' });
      metingen.push(cropLuminantie(buf, setup.px, setup.py, 30));
    }
  }
  await browser.close();
  const min = Math.min(...metingen), max = Math.max(...metingen);
  return { setup, metingen, min, max, relatieveSpreiding: (max - min) / min, errs };
}

// --- 1. Normale lichtstand: Brander varieert duidelijk, Normaal blijft vlak
const branderNormaal = await meetLuminantieReeks('brander');
const normaalNormaal = await meetLuminantieReeks('normaal');
check('Brander (normale lichtstand): de torso-luminantie varieert duidelijk over tijd (>8%, gemeten ~17%)',
  branderNormaal.relatieveSpreiding > 0.08, branderNormaal);
check('Normaal (normale lichtstand): de torso-luminantie blijft vlak (<3% — geen kernpuls-kanaal aanwezig)',
  normaalNormaal.relatieveSpreiding < 0.03, normaalNormaal);
check('Geen console-fouten tijdens de Brander-meting (normaal)', branderNormaal.errs.length === 0, branderNormaal.errs);
check('Geen console-fouten tijdens de Normaal-meting', normaalNormaal.errs.length === 0, normaalNormaal.errs);

// --- 2. Stroomuitval: hetzelfde kanaal, en met MEER relatief contrast omdat
// de achtergrond donkerder is (het hele punt van "wordt in het donker
// duidelijker, niet vager") ------------------------------------------------
const branderStroom = await meetLuminantieReeks('brander', { stroomuitval: true });
check("Brander (Stroomuitval): stroomFactor bleef vastgepind op 0,12 (geen wegdrift tijdens de meetreeks)",
  branderStroom.setup.stroomFactor === 0.12, branderStroom.setup);
check('Brander (Stroomuitval): de torso-luminantie varieert nog duidelijker dan in de normale stand (>20%, gemeten ~52%)',
  branderStroom.relatieveSpreiding > 0.20, branderStroom);
check('Geen console-fouten tijdens de Brander-meting (Stroomuitval)', branderStroom.errs.length === 0, branderStroom.errs);

// --- 3. delen.kern bestaat uitsluitend voor de Brander (vorm.buik) --------
const kernAanwezigheid = await (async () => {
  const { browser, page } = await openVoorVisueleMeting();
  const res = await page.evaluate((traits) => {
    const d = window.AmsterdamUndeadDebug;
    const uitkomst = {};
    for (const type of ['normaal', 'sjouwer', 'brander', 'sluiper']) {
      const o = d.spawnOndode(0, type, traits);
      uitkomst[type] = !!o.delen.kern;
    }
    return uitkomst;
  }, TRAITS);
  await browser.close();
  return res;
})();
check('Alleen de Brander heeft delen.kern — de andere drie types blijven ongemoeid',
  kernAanwezigheid.brander === true && kernAanwezigheid.normaal === false
  && kernAanwezigheid.sjouwer === false && kernAanwezigheid.sluiper === false, kernAanwezigheid);

// --- 4. De flinch-puls (treffer) blijft duidelijk onderscheidbaar van de
// rustpuls, ANALYTISCH gegarandeerd: het minimum van de flinch-actieve
// schaal (1 - KERNPULS_RUST_AMPLITUDE + KERNPULS_SCHAAL_BONUS, dus zelfs in
// het ongunstigste rustpuls-dal) ligt ruim boven het maximum van de zuivere
// rustpuls (1 + KERNPULS_RUST_AMPLITUDE) — dit hoeft dus geen screenshot,
// een schaal-assertie direct na een overlevende treffer volstaat en is
// sneller/robuuster. ---------------------------------------------------
const flinchProef = await (async () => {
  const { browser, page } = await openVoorVisueleMeting();
  const res = await page.evaluate((traits) => {
    const d = window.AmsterdamUndeadDebug;
    const b = d.spawnOndode(0, 'brander', traits);
    b.groep.position.set(0, 0, -2.5);
    b.hp = 1000;   // overleeft de treffer gegarandeerd, ongeacht golfnummer
    d.updateOndoden(0);
    const rustPulsMax = 1 + d.KERNPULS_RUST_AMPLITUDE;
    d.raakOndode(b, b.groep.position, false);   // lichaamstreffer, geen headshot: overlevend, kernPuls: true
    // raakOndode() zet alleen `ondode.flinch` — de daadwerkelijke
    // delen.kern.scale-schrijfplek zit in updateOndoden() zelf (§Ticket 156
    // hierboven). Zonder deze aanroep lees je de schaal van VÓÓR de treffer.
    d.updateOndoden(0);
    const schaalDirectNaTreffer = b.delen.kern.scale.x;
    return { rustPulsMax, schaalDirectNaTreffer, heeftFlinch: !!b.flinch, kernPulsActief: b.flinch?.kernPuls };
  }, TRAITS);
  await browser.close();
  return res;
})();
check('Een overlevende treffer zet flinch.kernPuls op de Brander', flinchProef.heeftFlinch && flinchProef.kernPulsActief === true, flinchProef);
check('De kern-schaal direct na een treffer overschrijdt aantoonbaar het theoretische maximum van de rustpuls alleen (flinch blijft onderscheidbaar)',
  flinchProef.schaalDirectNaTreffer > flinchProef.rustPulsMax, flinchProef);

// --- 5. Regressieslot op de bug die tijdens het bouwen gevonden werd: de
// kernpuls bevroor tijdens 'windup' omdat de schrijfplek eerst ná de
// windup-tak stond, en die tak eindigt op `continue`. De schrijfplek staat
// nu vóór die tak — kernPulsTijd moet dus BLIJVEN oplopen, ook tijdens een
// volledige windup->herstel-cyclus. --------------------------------------
const windupProef = await (async () => {
  const { browser, page } = await openVoorVisueleMeting();
  const res = await page.evaluate((traits) => {
    const d = window.AmsterdamUndeadDebug;
    d.speler.positie.set(0, 0, 0);
    const b = d.spawnOndode(0, 'brander', traits);
    b.groep.position.set(0, 0, -0.5);   // binnen AANVAL_START_BEREIK: forceert windup
    b.aanvalVertraging = 0;
    const staten = [];
    let vorigeTijd = -1, altijdGestegen = true;
    for (let i = 0; i < 40; i++) {
      d.updateOndoden(0.05);
      if (b.kernPulsTijd <= vorigeTijd) altijdGestegen = false;
      vorigeTijd = b.kernPulsTijd;
      staten.push(b.aanvalStaat);
    }
    return { statenGezien: [...new Set(staten)], altijdGestegen };
  }, TRAITS);
  await browser.close();
  return res;
})();
check("De windup-/herstelcyclus werd daadwerkelijk doorlopen in deze proef (anders bewijst 'altijd gestegen' niets)",
  windupProef.statenGezien.includes('windup'), windupProef);
check('kernPulsTijd loopt STRIKT door tijdens jaag/windup/herstel — geen enkele bevriezing door een vroege `continue`',
  windupProef.altijdGestegen, windupProef);

const fails = report([]);
process.exit(fails > 0 ? 1 : 0);
