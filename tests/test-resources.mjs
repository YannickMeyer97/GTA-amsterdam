// Ticket 77: resource- en levensduur-regressietests — de testcategorie die
// in de audit ontbrak en die het bevestigde GPU-geheugenlek uit T69 had
// moeten vangen (zie ARCHITECTURE_NOTES.md §8.3/§8.11 en ROADMAP.md
// Ticket 77/69/70/71/72). Bewust geschreven VÓÓR T69/T70/T71/T72: dit
// script moet nu AANTOONBAAR ROOD staan op de geometrie-assertie (a), de
// dispose-assertie (a/b) en de DOM-schrijffrequentie-asserties (d) — pas
// na die tickets mag het groen worden (SONNET_EXECUTION_PLAN.md
// waarschuwing 42/50).
//
// Twee meetvalkuilen uit de audit (zie ook helpers.mjs' frames()):
//  - zonder echte rAF-frames tussen spawn en kill registreert Three.js een
//    geometrie nooit bij de renderer (vals-negatief);
//  - frustum culling kan een testobject ongerenderd laten (ook vals-
//    negatief) — daarom hieronder overal expliciet frustumCulled = false.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// Zelfde pointer-lock-simulatietechniek als helpers.mjs, hier los
// aanroepbaar omdat sectie (d) de échte per-frame keten pas halverwege
// dit script nodig heeft (secties a/b/c/e sturen de logica rechtstreeks
// aan en hebben geen actieve gameLoop nodig).
async function zetPointerLockAan() {
  await page.evaluate(() => {
    const canvas = window.AmsterdamUndeadDebug.renderer.domElement;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
}
async function zetPointerLockUit() {
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
}

/* ================================================================
   (a) Geometrie-/materiaalgroei over 100 spawn/kill-cycli (T69/T70)
   ================================================================ */
const aVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Patch Material.prototype.dispose zodat we objectief kunnen tellen of
  // .dispose() ooit wordt aangeroepen. Nulmeting uit de audit: 0 calls.
  //
  // Fix (gevonden tijdens T132): dit ging via
  // `Object.getPrototypeOf(Object.getPrototypeOf(delen.oogMateriaal))` — twee
  // vaste stappen vanaf een concreet materiaal. Sinds **Ticket 122**
  // (Zombie V2) is `delen.oogMateriaal` géén THREE.Material meer maar een plat
  // shim-object met alleen een `emissiveIntensity`-setter naar de
  // shader-uniform. Twee stappen vanaf een plat object komen uit op `null`,
  // waarna deze regel gooide en het HELE script afbrak vóór check 1 — alle
  // lek-vangrails hieronder hebben sindsdien niet meer gedraaid.
  //
  // Nu twee keer robuuster: (1) haal een ECHT materiaal uit de mesh-tree in
  // plaats van uit `delen`, zodat een shim in `delen` dit nooit meer kan
  // breken; (2) zoek de prototype die `dispose` als EIGEN property heeft, in
  // plaats van een vast aantal stappen te tellen.
  //
  // Dat tweede punt is preciezer dan het lijkt. De keten is gemeten:
  //   MeshStandardMaterial.prototype  (geen eigen dispose)
  //   Material.prototype              (eigen dispose)   <- dit willen we
  //   EventDispatcher.prototype       (geen eigen dispose)
  //   Object.prototype
  // In three.js geldt `class Material extends EventDispatcher`, dus zowel
  // "twee stappen omhoog" als "klim tot vlak vóór Object.prototype" landt
  // ernaast — die laatste komt op EventDispatcher.prototype uit, waar een
  // toegevoegde dispose door Material.prototype.dispose wordt GESCHADUWD.
  // De patch lijkt dan te werken maar telt stilletjes 0 calls.
  const proefOndode = d.spawnOndode(0);
  let proefMateriaal = null;
  proefOndode.groep.traverse(o => {
    if (!proefMateriaal && o.isMesh && o.material && o.material.isMaterial) proefMateriaal = o.material;
  });
  if (!proefMateriaal) throw new Error('test-resources: geen echt THREE.Material gevonden op een ondode');
  let materialProto = Object.getPrototypeOf(proefMateriaal);
  while (materialProto && !Object.prototype.hasOwnProperty.call(materialProto, 'dispose')) {
    materialProto = Object.getPrototypeOf(materialProto);
  }
  if (!materialProto) throw new Error('test-resources: geen prototype met een eigen dispose() gevonden');
  if (!materialProto.__origDispose) {
    materialProto.__origDispose = materialProto.dispose;
    materialProto.dispose = function (...a) {
      window.__materiaalDisposeCount = (window.__materiaalDisposeCount || 0) + 1;
      return materialProto.__origDispose.apply(this, a);
    };
  }
  window.__materiaalDisposeCount = 0;
  // De proefspawn zelf opruimen — telt niet mee in de 100-cyclusmeting.
  d.doodOndode(proefOndode);
  d.updateStervenden(1.0);
  return { voor: d.renderer.info.memory.geometries };
});
await frames(page, 2);

await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const groep = [];
  for (let i = 0; i < 100; i++) {
    const ondode = d.spawnOndode(0);
    ondode.groep.position.set(500, 0, 500);   // ver van de speler: geen aggro-interferentie
    ondode.groep.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    groep.push(ondode);
  }
  window.__testGroep100 = groep;
});
await frames(page, 3);   // écht laten renderen vóór het opruimen

const aOpruimen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of window.__testGroep100) d.doodOndode(o);
  delete window.__testGroep100;
  d.updateStervenden(1.0);   // laat de valanimatie in één klap "aflopen" (T70's opruimmoment)
  return { materiaalDispose: window.__materiaalDisposeCount };
});
await frames(page, 3);

const aNa = await page.evaluate(() => window.AmsterdamUndeadDebug.renderer.info.memory.geometries);

const geometrieGroei = aNa - aVoor.voor;
check(`(a) Geometriegroei over 100 spawn/kill-cycli (T69) blijft binnen ±10 — gemeten: ${geometrieGroei} (vóór T69: ~+900)`,
  Math.abs(geometrieGroei) <= 10, { voor: aVoor.voor, na: aNa, groei: geometrieGroei });
check(`(a) Material.dispose() wordt aantoonbaar aangeroepen ná de valanimatie (T70) — gemeten: ${aOpruimen.materiaalDispose} calls`,
  aOpruimen.materiaalDispose > 0, aOpruimen);

/* ================================================================
   (b) Explosie- en powerup-scenario's (T70)
   ================================================================ */
// N=30 i.p.v. de 200 uit T70's acceptatiecriterium: elke explosie voegt een
// écht PointLight toe, en met 200 gelijktijdig actieve PointLights (vóór
// T70's opruiming die pas ~220ms later via een setTimeout vuurt) wordt élke
// volgende frame in deze SwiftShader-headless-omgeving zo traag dat het hele
// script vastloopt (empirisch gemeten: >30s vertraging per batch). Een
// lineair lek per aanroep is bij N=30 exact zo goed aantoonbaar als bij
// N=200 — de assertie test het patroon, niet het exacte aantal.
const BRANDER_TEST_AANTAL = 30;
const bExplosiesVoor = await page.evaluate(() => window.AmsterdamUndeadDebug.renderer.info.memory.geometries);
await page.evaluate((n) => {
  const d = window.AmsterdamUndeadDebug;
  const verVanSpeler = d.speler.positie.clone();
  verVanSpeler.x += 50;   // ruim buiten BRANDER_EXPLOSIE_RADIUS (3m): geen spelerschade
  for (let i = 0; i < n; i++) {
    d.ontploiBrander({ type: 'brander', groep: { position: verVanSpeler.clone() } });
  }
  // T70 verhuist de explosie-opruiming van setTimeout naar een dt-getimede
  // cosmetische functie (updateExplosies). Vóór T70 bestaat die nog niet —
  // dan is dit een no-op en blijft de assertie hieronder terecht rood.
  d.updateExplosies?.(1.0);
}, BRANDER_TEST_AANTAL);
// Belangrijk voor de testsnelheid (niet voor de assertie): vóór T70 hangen
// de flits-PointLights nog aan een echte setTimeout(220ms) — zonder deze
// wandklok-wachttijd blijven ze de rest van het script meerenderen (elke
// frame, ook in latere secties) en duurt het script tergend langzaam.
await page.waitForTimeout(1000);
await frames(page, 3);
const bExplosiesNa = await page.evaluate(() => window.AmsterdamUndeadDebug.renderer.info.memory.geometries);
const explosieGroei = bExplosiesNa - bExplosiesVoor;
check(`(b) Geometriegroei over ${BRANDER_TEST_AANTAL} Brander-explosies (T70) blijft binnen ±10 — gemeten: ${explosieGroei} (vóór T70: ~+${BRANDER_TEST_AANTAL})`,
  Math.abs(explosieGroei) <= 10, { voor: bExplosiesVoor, na: bExplosiesNa, groei: explosieGroei });

const POWERUP_TEST_AANTAL = 30;
const bPowerupsVoor = await page.evaluate(() => window.AmsterdamUndeadDebug.renderer.info.memory.geometries);
await page.evaluate((n) => {
  const d = window.AmsterdamUndeadDebug;
  for (let i = 0; i < n; i++) d.spawnPowerupDrop(500, 500, 'munitievoorraad');
}, POWERUP_TEST_AANTAL);
await frames(page, 3);
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const drop of [...d.powerups]) d.raapPowerupOp(drop);
});
await frames(page, 3);
const bPowerupsNa = await page.evaluate(() => window.AmsterdamUndeadDebug.renderer.info.memory.geometries);
const powerupGroei = bPowerupsNa - bPowerupsVoor;
check(`(b) Geometriegroei over ${POWERUP_TEST_AANTAL} powerup-drops (T70) blijft binnen ±10 — gemeten: ${powerupGroei} (vóór T70: ~+${POWERUP_TEST_AANTAL})`,
  Math.abs(powerupGroei) <= 10, { voor: bPowerupsVoor, na: bPowerupsNa, groei: powerupGroei });

/* ================================================================
   (c) DOM-node-aantal blijft constant na veel treffers
   ================================================================ */
const cMeting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = document.querySelectorAll('*').length;
  const doelwit = d.spawnOndode(0);
  doelwit.hp = 999999;
  for (let i = 0; i < 150; i++) d.raakOndode(doelwit, doelwit.groep.position, i % 5 === 0);
  for (let i = 0; i < 50; i++) d.spelerSchade(1, 'test', d.speler.positie.x + 5, d.speler.positie.z);
  d.doodOndode(doelwit);
  d.updateStervenden(1.0);
  const na = document.querySelectorAll('*').length;
  return { voor, na };
});
check('(c) DOM-node-aantal blijft constant na 150 treffers + 50 schade-events (pools, geen nieuwe elementen)',
  cMeting.na === cMeting.voor, cMeting);

/* ================================================================
   (d) DOM-schrijffrequentie: regeneratie (T71) en interactie-prompt (T72)
   ================================================================ */
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.updateStervenden(1.0);
});
await zetPointerLockAan();

// --- T71: HUD-schrijfteller tijdens ononderbroken regeneratie -------------
// Frame-gebaseerd i.p.v. wall-clock: dt wordt in de game-loop gecapt op
// 0.05s per frame (zie CLAUDE.md/ARCHITECTURE_NOTES over onbetrouwbare
// frametime in deze SwiftShader-headless-omgeving), dus over AANTAL_FRAMES
// frames kan de simulatietijd nooit meer zijn dan 0.05*AANTAL_FRAMES s —
// dat begrenst hoeveel keer de AFGERONDE hp kan wisselen, ongeacht de
// werkelijke wandklok-framerate van de testmachine.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelerStaat.hp = d.spelerStaat.hpMax - 20;
  d.spelerStaat.laatsteSchadeTijd = -999;
  d.spelStaat.gameOver = false;
});
await frames(page, 3);   // laat de staat stabiliseren vóórdat de spy meetelt
await page.evaluate(() => {
  const el = document.getElementById('hpTekst');
  const orig = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  window.__hpSchrijfTeller = 0;
  Object.defineProperty(el, 'textContent', {
    configurable: true,
    get() { return orig.get.call(this); },
    set(v) { window.__hpSchrijfTeller++; orig.set.call(this, v); },
  });
});
const AANTAL_FRAMES_REGEN = 24;
await frames(page, AANTAL_FRAMES_REGEN);
const regenMeting = await page.evaluate(() => {
  const el = document.getElementById('hpTekst');
  delete el.textContent;   // spy opruimen: instance-property weg, prototype-accessor terug
  return { schrijven: window.__hpSchrijfTeller, hpNa: window.AmsterdamUndeadDebug.spelerStaat.hp };
});
const drempelRegen = Math.ceil(0.25 * AANTAL_FRAMES_REGEN) + 1;   // 0.25 = SPELER_REGEN_PER_SEC(5) * dt-cap(0.05)
check(`(d) T71: HUD-schrijfteller tijdens regeneratie blijft onder ${drempelRegen} over ~${AANTAL_FRAMES_REGEN} frames (T71: alleen schrijven bij écht gewijzigde hp) — gemeten: ${regenMeting.schrijven} (vóór T71: ~elke frame een write)`,
  regenMeting.schrijven < drempelRegen, regenMeting);

// --- T72: interactie-prompt-schrijfteller ----------------------------------
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(-500, 0, -500);   // buiten het bereik van elk interactiepunt
});
await frames(page, 5);   // laat de prompt-staat al stabiel verborgen zijn vóórdat de spy meetelt
await page.evaluate(() => {
  const el = document.getElementById('interactiePrompt');
  // el.style.opacity is in Chromium GEEN accessor-property (get/set) maar
  // een "own" data-property met een native interceptor — getOwnPropertyDescriptor
  // levert dus {value: undefined} i.p.v. {get, set} op. setProperty()/
  // getPropertyValue() zijn wél gewone methoden en werken hier onafhankelijk
  // van de 'opacity'-property zelf, dus die gebruiken we in de spy.
  window.__promptSchrijfTeller = 0;
  Object.defineProperty(el.style, 'opacity', {
    configurable: true,
    get() { return el.style.getPropertyValue('opacity'); },
    set(v) { window.__promptSchrijfTeller++; el.style.setProperty('opacity', v); },
  });
});
await frames(page, 60);
const buitenBereikSchrijven = await page.evaluate(() => window.__promptSchrijfTeller);
check(`(d) T72: 0 writes op interactiePrompt over 60 frames stilstand buiten bereik (T72: alleen schrijven bij wijziging) — gemeten: ${buitenBereikSchrijven}`,
  buitenBereikSchrijven === 0, { buitenBereikSchrijven });

await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  window.__promptSchrijfTeller = 0;
  d.speler.positie.copy(d.interactiePunten[0].positie);   // loop het bereik van deurPunt binnen
});
await frames(page, 3);
const binnenBereikMeting = await page.evaluate(() => {
  const el = document.getElementById('interactiePrompt');
  delete el.style.opacity;   // spy opruimen
  return window.__promptSchrijfTeller;
});
check(`(d) T72: precies 1 write op interactiePrompt bij het binnenlopen van bereik + enkele stilstaande frames erna (T72: alleen schrijven bij wijziging) — gemeten: ${binnenBereikMeting} (vóór T72: ~elke frame een write)`,
  binnenBereikMeting === 1, { binnenBereikMeting });

await zetPointerLockUit();

/* ================================================================
   (e) Lange-run-simulatie: 25 golven headless
   ================================================================ */
const golfSimulatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.updateStervenden(1.0);
  d.spelStaat.geld = 0;
  d.koopDeur(); d.koopDeur2(); d.koopDeur3(); d.koopDeur4();
  for (const v of [...d.VENSTERS, ...d.VENSTERS_KAMER2, ...d.VENSTERS_PLAATS, ...d.VENSTERS_BIJKEUKEN]) v.planken = 0;
  d.schadePerTreffer = 999;
  const interactiePuntenStart = d.interactiePunten.length;

  // Ticket 85 (Etalages): mesh-/materiaaltelling vóór de 25-golven-simulatie
  // — dit ticket wisselt materialen op golfmijlpalen (updateEtalageSporen(),
  // aangeroepen vanuit startGolf() hieronder), en mag daarbij NOOIT een
  // nieuwe mesh of een niet-gedeeld materiaal introduceren.
  let meshVoor = 0;
  const materialenVoor = new Set();
  d.scene.traverse(o => { if (o.isMesh) { meshVoor++; materialenVoor.add(o.material); } });
  const geometrieenVoor = d.renderer.info.memory.geometries;
  const obstakelsVoor = d.obstakels.length;

  const perGolf = [];
  let stervendenMax = 0, powerupsMax = 0, interactiePuntenMax = interactiePuntenStart;
  for (let golf = 1; golf <= 25; golf++) {
    d.spelStaat.golf = golf;
    d.spelStaat.gameOver = false;
    d.startGolf();
    let stappen = 0;
    while (d.spelStaat.golfActief && stappen < 3000) {
      d.updateGolf(0.05);
      d.updateStervenden(0.05);
      d.updatePowerups(0.05);
      if (d.ondoden.length > 0) d.raakOndode(d.ondoden[0], d.ondoden[0].groep.position, false);
      stervendenMax = Math.max(stervendenMax, d.stervenden.length);
      powerupsMax = Math.max(powerupsMax, d.powerups.length);
      interactiePuntenMax = Math.max(interactiePuntenMax, d.interactiePunten.length);
      stappen++;
    }
    perGolf.push({
      golf, ondodenNa: d.ondoden.length, stervendenNa: d.stervenden.length,
      powerupsNa: d.powerups.length, golfAfgerond: !d.spelStaat.golfActief, stappen,
    });
  }
  // Ticket 85: dezelfde telling ná afloop (golf 15 ligt ruim binnen deze
  // 25-golven-run, dus alle drie de etalageramen zijn dan al gewisseld).
  let meshNa = 0;
  const materialenNa = new Set();
  d.scene.traverse(o => { if (o.isMesh) { meshNa++; materialenNa.add(o.material); } });
  const geometrieenNa = d.renderer.info.memory.geometries;

  return {
    perGolf, stervendenMax, powerupsMax, interactiePuntenMax, interactiePuntenStart,
    interactiePuntenEind: d.interactiePunten.length,
    meshVoor, meshNa, materialenVoor: materialenVoor.size, materialenNa: materialenNa.size,
    geometrieenVoor, geometrieenNa, obstakelsVoor, obstakelsNa: d.obstakels.length,
    etalageVoltooid: d.etalageVoltooid,
  };
});

check('(e) Elke golf (1-25) rondt daadwerkelijk af binnen de stappen-limiet (geen hang-toestand)',
  golfSimulatie.perGolf.every(g => g.golfAfgerond), golfSimulatie.perGolf);
check(`(e) 'ondoden' groeit niet onbegrensd over 25 golven (na elke golf leeg of bijna leeg) — gemeten max ná-golf-aantal: ${Math.max(...golfSimulatie.perGolf.map(g => g.ondodenNa))}`,
  golfSimulatie.perGolf.every(g => g.ondodenNa <= 5), golfSimulatie.perGolf);
check(`(e) 'stervenden' blijft begrensd over 25 golven (opgeruimd door updateStervenden, geen opstapeling) — gemeten max: ${golfSimulatie.stervendenMax}`,
  golfSimulatie.stervendenMax <= 30, golfSimulatie);
check(`(e) 'powerups' blijft begrensd over 25 golven (max één drop-slot per golf + verval) — gemeten max: ${golfSimulatie.powerupsMax}`,
  golfSimulatie.powerupsMax <= 10, golfSimulatie);
check(`(e) 'interactiePunten' groeit niet onbegrensd over 25 golven (start ${golfSimulatie.interactiePuntenStart}, max ${golfSimulatie.interactiePuntenMax}, eind ${golfSimulatie.interactiePuntenEind})`,
  golfSimulatie.interactiePuntenMax <= golfSimulatie.interactiePuntenStart + 10, golfSimulatie);

/* ================================================================
   (f) Ticket 85 (Etalages): de etalage-mijlpalen ZELF voegen geen groei toe
   (3 raam-materiaalwissels via de gecachete matFamilie('hout', ...) — die
   combinatie bestond al vóór golf 1, via de ereplank-plank hierbeneden, dus
   levert 0 nieuwe unieke materialen op; de 2 ereplank-medaillons zijn al
   vóór golf 1 gebouwd). De marge hieronder (±150) is NIET voor dit ticket
   zelf — scene.traverse() ving onderweg ook de bestaande, opzettelijke
   per-ondode huidskleur-variatie (maakOndodeModel(), "kleine kleurvariatie
   per ondode") die BUITEN T85's scope valt en hier voor het eerst gemeten
   wordt; het ticket staat expliciet "± een vaste, kleine marge" toe. Zou
   deze marge ooit niet meer volstaan (bv. door een toekomstige, ECHTE
   leak), dan hoort dat als een apart ticket op die per-ondode-tinting
   onderzocht te worden — niet door deze marge zomaar te verruimen. --------- */
const GROEI_MARGE = 150;
check(`(f) Mesh-telling groeit niet onbegrensd over 25 golven (marge ±${GROEI_MARGE}; T85 zelf draagt 0 bij) (${golfSimulatie.meshVoor} -> ${golfSimulatie.meshNa})`,
  golfSimulatie.meshNa <= golfSimulatie.meshVoor + GROEI_MARGE, golfSimulatie);
check(`(f) Aantal UNIEKE materialen groeit niet onbegrensd over 25 golven (marge ±${GROEI_MARGE}; T85 zelf draagt 0 bij) (${golfSimulatie.materialenVoor} -> ${golfSimulatie.materialenNa})`,
  golfSimulatie.materialenNa <= golfSimulatie.materialenVoor + GROEI_MARGE, golfSimulatie);
check(`(f) renderer.info.memory.geometries groeit niet door de etalage-mijlpalen (${golfSimulatie.geometrieenVoor} -> ${golfSimulatie.geometrieenNa})`,
  golfSimulatie.geometrieenNa === golfSimulatie.geometrieenVoor, golfSimulatie);
// De kern is "voor === na" (niets groeit tijdens het spelen); het absolute
// getal is een kaartbrede teller, door T87 (De Vliering) van 52 naar 56.
check('(f) obstakels.length blijft ongewijzigd tijdens 25 golven (kaartbreed 58, T131-baseline; geen collision toegevoegd door de etalage-mijlpalen)',
  golfSimulatie.obstakelsVoor === golfSimulatie.obstakelsNa && golfSimulatie.obstakelsNa === 58, golfSimulatie);
check(`(f) Alle drie de etalageramen zijn dichtgetimmerd binnen de 25 golven (etalageVoltooid: ${golfSimulatie.etalageVoltooid})`,
  golfSimulatie.etalageVoltooid === 3, golfSimulatie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
