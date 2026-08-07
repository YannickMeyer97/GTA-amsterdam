// Ticket 86 (v0.21, §9.7): het stadsarchief — cosmetische meta-progressie
// over meerdere runs heen (kleurset, mondingsvlam-tint, intro-melodie).
// Testblok naar het model van test-faalmodi.mjs (corrupte-opslag-varianten)
// + test-muisgevoeligheid.mjs (klem-/defaultgedrag), plus de drie eigen
// eisen uit het ticket: onbekende sleutels blijven behouden, geen enkele
// ontgrendeling raakt een balansgetal, en bijwerkenStadsarchief() telt
// headshots nooit dubbel over een win-dan-doorspelen-dan-dood-sessie.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

const VEILIGE_STAAT = () => ({
  ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0,
  actief: { kleurset: false, vlamTint: false, introMelodie: false },
});

// --- 1. Corrupte opslag: veilige, geldige lege staat, nooit een crash ------
const corruptTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const varianten = ['{}', '[]', 'null', 'nietEensJson{{{', '"gewoonEenString"', '42'];
  const uit = [];
  for (const raw of varianten) {
    localStorage.setItem(d.STADSARCHIEF_KEY, raw);
    const record = d.leesStadsarchief();
    uit.push({ raw, record });
  }
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return uit;
});
const veilig = VEILIGE_STAAT();
for (const r of corruptTest) {
  check(`Corrupte opslag ${JSON.stringify(r.raw)}: leesStadsarchief() geeft een veilige lege staat terug (geen crash)`,
    r.record.ontsnappingen === veilig.ontsnappingen && r.record.headshotsTotaal === veilig.headshotsTotaal &&
    r.record.hoogsteGolf === veilig.hoogsteGolf &&
    r.record.actief.kleurset === false && r.record.actief.vlamTint === false && r.record.actief.introMelodie === false,
    r);
}

// --- 2. Ontbrekende sleutel (nooit eerder gespeeld) geeft ook de veilige staat
const ontbrekendTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return d.leesStadsarchief();
});
check('Ontbrekende opslag (nooit eerder geschreven) geeft dezelfde veilige lege staat',
  ontbrekendTest.ontsnappingen === 0 && ontbrekendTest.headshotsTotaal === 0 && ontbrekendTest.hoogsteGolf === 0,
  ontbrekendTest);

// --- 3. Onbekende sleutel in de opslag blijft de bekende velden behouden ---
// (voorwaarts/achterwaarts-compatibiliteit: een oudere versie mag de
// ontgrendelingen van een nieuwere versie niet wissen).
const onbekendeSleutelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify({
    ontsnappingen: 4, headshotsTotaal: 150, hoogsteGolf: 22,
    actief: { kleurset: true, vlamTint: false, introMelodie: true },
    eenToekomstigVeldDatDezeVersieNietKent: { iets: 'raars', diep: [1, 2, 3] },
  }));
  const record = d.leesStadsarchief();
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return record;
});
check('Een onbekende extra sleutel in de opslag laat de bekende velden intact (ontsnappingen/headshots/golf)',
  onbekendeSleutelTest.ontsnappingen === 4 && onbekendeSleutelTest.headshotsTotaal === 150 && onbekendeSleutelTest.hoogsteGolf === 22,
  onbekendeSleutelTest);
check('...en ook de bekende actief-substaat blijft intact',
  onbekendeSleutelTest.actief.kleurset === true && onbekendeSleutelTest.actief.vlamTint === false &&
  onbekendeSleutelTest.actief.introMelodie === true, onbekendeSleutelTest);

// Randgeval: een geldig record ZONDER het (nog niet bestaande) actief-veld
// (oudere opslagversie, of het allereerste schrijfmoment) moet gewoon werken.
const zonderActiefTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify({ ontsnappingen: 1, headshotsTotaal: 10, hoogsteGolf: 6 }));
  const record = d.leesStadsarchief();
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return record;
});
check('Een geldig record zonder actief-veld (oudere opslagversie) blijft werken en krijgt een veilige actief-substaat',
  zonderActiefTest.ontsnappingen === 1 && zonderActiefTest.headshotsTotaal === 10 && zonderActiefTest.hoogsteGolf === 6 &&
  zonderActiefTest.actief.kleurset === false && zonderActiefTest.actief.vlamTint === false && zonderActiefTest.actief.introMelodie === false,
  zonderActiefTest);

// Negatieve/niet-gehele getallen worden geklemd naar 0 (vormvalidatie).
const ongeldigeGetallenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify({ ontsnappingen: -3, headshotsTotaal: 4.5, hoogsteGolf: 'twintig' }));
  const record = d.leesStadsarchief();
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return record;
});
check('Negatieve/niet-integer/verkeerd-getypeerde tellers vallen terug op 0 (nooit NaN of "undefined")',
  ongeldigeGetallenTest.ontsnappingen === 0 && ongeldigeGetallenTest.headshotsTotaal === 0 && ongeldigeGetallenTest.hoogsteGolf === 0,
  ongeldigeGetallenTest);

// Positieve controle: een volledig geldig record blijft onaangetast.
const geldigTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  localStorage.setItem(d.STADSARCHIEF_KEY, JSON.stringify({
    ontsnappingen: 3, headshotsTotaal: 100, hoogsteGolf: 20,
    actief: { kleurset: true, vlamTint: true, introMelodie: true },
  }));
  const record = d.leesStadsarchief();
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return record;
});
check('Een volledig geldig record blijft onaangetast door de validatie',
  geldigTest.ontsnappingen === 3 && geldigTest.headshotsTotaal === 100 && geldigTest.hoogsteGolf === 20 &&
  geldigTest.actief.kleurset === true && geldigTest.actief.vlamTint === true && geldigTest.actief.introMelodie === true,
  geldigTest);

// --- 4. schrijfStadsarchief() breekt niet als localStorage geweigerd wordt -
const weigerTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const orig = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
  Storage.prototype.setItem = function () { throw new DOMException('geweigerd', 'QuotaExceededError'); };
  let fout = null;
  try {
    d.schrijfStadsarchief({ ontsnappingen: 1, headshotsTotaal: 1, hoogsteGolf: 1, actief: { kleurset: false, vlamTint: false, introMelodie: false } });
  } catch (e) {
    fout = e.message;
  }
  Object.defineProperty(Storage.prototype, 'setItem', orig);
  return { fout };
});
check('schrijfStadsarchief() met een gooiende localStorage.setItem crasht niet (try/catch-guard)',
  weigerTest.fout === null, weigerTest);

// --- 5. Milieplaal-drempels: exacte grenswaarden per categorie -------------
const drempelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const maak = (ontsnappingen, headshotsTotaal, hoogsteGolf) => ({ ontsnappingen, headshotsTotaal, hoogsteGolf, actief: { kleurset: false, vlamTint: false, introMelodie: false } });
  return {
    kleursetOnder: d.stadsarchiefOntgrendelingen(maak(2, 0, 0)).kleurset,
    kleursetOp: d.stadsarchiefOntgrendelingen(maak(3, 0, 0)).kleurset,
    kleursetErboven: d.stadsarchiefOntgrendelingen(maak(4, 0, 0)).kleurset,
    vlamOnder: d.stadsarchiefOntgrendelingen(maak(0, 99, 0)).vlamTint,
    vlamOp: d.stadsarchiefOntgrendelingen(maak(0, 100, 0)).vlamTint,
    melodieOnder: d.stadsarchiefOntgrendelingen(maak(0, 0, 19)).introMelodie,
    melodieOp: d.stadsarchiefOntgrendelingen(maak(0, 0, 20)).introMelodie,
    // Categorieën zijn onafhankelijk: alleen ontsnappingen hoog raakt geen vlam/melodie.
    onafhankelijk: d.stadsarchiefOntgrendelingen(maak(99, 0, 0)),
  };
});
check('Kleurset: net onder de drempel (2 < 3) nog gesloten', drempelTest.kleursetOnder === false, drempelTest);
check('Kleurset: exact op de drempel (3) al ontgrendeld', drempelTest.kleursetOp === true, drempelTest);
check('Kleurset: ruim boven de drempel (4) blijft ontgrendeld', drempelTest.kleursetErboven === true, drempelTest);
check('Vlamtint: net onder de drempel (99 < 100) nog gesloten', drempelTest.vlamOnder === false, drempelTest);
check('Vlamtint: exact op de drempel (100) al ontgrendeld', drempelTest.vlamOp === true, drempelTest);
check('Intro-melodie: net onder de drempel (19 < 20) nog gesloten', drempelTest.melodieOnder === false, drempelTest);
check('Intro-melodie: exact op de drempel (20) al ontgrendeld', drempelTest.melodieOp === true, drempelTest);
check('Elke categorie heeft zijn eigen teller: 99 ontsnappingen ontgrendelt geen vlam/melodie',
  drempelTest.onafhankelijk.vlamTint === false && drempelTest.onafhankelijk.introMelodie === false, drempelTest);

// --- 6. Ontgrendelingen zijn additief/onomkeerbaar: alleen tellers, geen losse vlaggen ---
const onomkeerbaarTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Geen enkel veld heet iets als "ontgrendeld"/"unlocked" in de opslagvorm zelf —
  // ontgrendelingen zijn altijd AFGELEID van de drempel-vergelijking, dus een
  // teller die alleen kan stijgen kan een ontgrendeling nooit ongedaan maken.
  const a = { ontsnappingen: 3, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  const voor = d.stadsarchiefOntgrendelingen(a).kleurset;
  a.ontsnappingen += 1;   // een teller kan alleen maar stijgen in de echte flow
  const na = d.stadsarchiefOntgrendelingen(a).kleurset;
  return { voor, na };
});
check('Eenmaal ontgrendeld blijft ontgrendeld naarmate de teller verder stijgt (additief/onomkeerbaar)',
  onomkeerbaarTest.voor === true && onomkeerbaarTest.na === true, onomkeerbaarTest);

// --- 7. Bron-assertie: geen enkele ontgrendeling raakt een balansgetal -----
// (§9.2: de verboden lijst voor deze hele ronde). Doorzoekt de bronnen van
// alle T86-kernfuncties op elke verboden constante.
const bronAssertieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bronnen = [
    d.leesStadsarchief.toString(),
    d.schrijfStadsarchief.toString(),
    d.stadsarchiefOntgrendelingen.toString(),
    d.bijwerkenStadsarchief.toString(),
    d.updateArchiefUI.toString(),
    d.speelIntroMelodie.toString(),
  ];
  const verboden = [
    'golfBudget', 'GOLF_BUDGET_BASIS', 'GOLF_BUDGET_GROEI', 'ONDODE_THREAT_KOSTEN',
    'GOLF_MAX_ACTIEF', 'ONDODE_HP_TRAPPEN', 'AANVAL_PROFIELEN', '_PRIJS',
    'GELD_PER_HIT', 'GELD_PER_KILL', 'POWERUP_DROP_KANS', 'SPELER_HP_MAX',
    'schadePerTreffer', 'WAPEN_SCHADE_MAX',
  ];
  const gevonden = [];
  for (const bron of bronnen) {
    for (const term of verboden) {
      if (bron.includes(term)) gevonden.push(term);
    }
  }
  return { gevonden };
});
check('Geen van de T86-kernfuncties bevat ook maar één term uit de §9.2-verboden-lijst',
  bronAssertieTest.gevonden.length === 0, bronAssertieTest);

// --- 8. bijwerkenStadsarchief(): delta-based, geen dubbeltelling over -------
// win → "Speel door" (géén nieuwe run) → dood, binnen dezelfde sessie.
const deltaTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.archiefHeadshotsBasis = 0;

  // Fase 1: eerste ontsnapping op golf 3, 5 headshots tot dan toe.
  d.runStats.headshots = 5;
  d.spelStaat.golf = 3;
  d.toonWinScherm();
  d.winScherm.style.display = 'none';   // opruimen, geen bijeffect voor volgende checks
  const naEersteEscape = { headshotsTotaal: d.stadsarchief.headshotsTotaal, ontsnappingen: d.stadsarchief.ontsnappingen, hoogsteGolf: d.stadsarchief.hoogsteGolf, basis: d.archiefHeadshotsBasis };

  // Fase 2: "Speel door" — zelfde sessie, golf loopt door naar 4, 3 headshots erbij.
  d.runStats.headshots = 8;
  d.spelStaat.golf = 4;
  d.spelStaat.gameOver = false;
  d.toonWinScherm();
  d.winScherm.style.display = 'none';
  const naTweedeEscape = { headshotsTotaal: d.stadsarchief.headshotsTotaal, ontsnappingen: d.stadsarchief.ontsnappingen, hoogsteGolf: d.stadsarchief.hoogsteGolf, basis: d.archiefHeadshotsBasis };

  // Fase 3: uiteindelijk toch dood op golf 5, nog eens 2 headshots erbij.
  d.runStats.headshots = 10;
  d.spelStaat.golf = 5;
  d.spelStaat.gameOver = false;
  d.gameOver();
  document.getElementById('gameOverScherm').style.display = 'none';
  const naDood = { headshotsTotaal: d.stadsarchief.headshotsTotaal, ontsnappingen: d.stadsarchief.ontsnappingen, hoogsteGolf: d.stadsarchief.hoogsteGolf, basis: d.archiefHeadshotsBasis };

  return { naEersteEscape, naTweedeEscape, naDood, eindeRunStatsHeadshots: d.runStats.headshots };
});
check('Na de eerste ontsnapping (5 headshots, golf 3): headshotsTotaal=5, ontsnappingen=1, hoogsteGolf=3',
  deltaTest.naEersteEscape.headshotsTotaal === 5 && deltaTest.naEersteEscape.ontsnappingen === 1 &&
  deltaTest.naEersteEscape.hoogsteGolf === 3 && deltaTest.naEersteEscape.basis === 5, deltaTest);
check('Na "Speel door" + tweede ontsnapping (8 headshots totaal, golf 4): headshotsTotaal=8 (delta van +3, NIET +8), ontsnappingen=2, hoogsteGolf=4',
  deltaTest.naTweedeEscape.headshotsTotaal === 8 && deltaTest.naTweedeEscape.ontsnappingen === 2 &&
  deltaTest.naTweedeEscape.hoogsteGolf === 4 && deltaTest.naTweedeEscape.basis === 8, deltaTest);
check('Na de uiteindelijke dood (10 headshots totaal, golf 5): headshotsTotaal=10 (delta van +2, NIET +10), ontsnappingen blijft 2 (gameOver telt geen ontsnapping), hoogsteGolf=5',
  deltaTest.naDood.headshotsTotaal === 10 && deltaTest.naDood.ontsnappingen === 2 &&
  deltaTest.naDood.hoogsteGolf === 5 && deltaTest.naDood.basis === 10, deltaTest);
check('Het eindtotaal in het archief is exact gelijk aan runStats.headshots, nooit meer (geen dubbeltelling)',
  deltaTest.naDood.headshotsTotaal === deltaTest.eindeRunStatsHeadshots, deltaTest);

// --- 9. UI: knoppen alleen zichtbaar zodra ontgrendeld, togglen op klik, ----
// geen pointer-lock-aanvraag (zelfde stopPropagation-patroon als de
// gevoeligheidsslider/geluidsknop).
const uiVerborgenTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.updateArchiefUI();
  return {
    archiefUIVerborgen: getComputedStyle(document.getElementById('archiefUI')).display === 'none',
    kleursetKnopVerborgen: document.getElementById('archiefKleursetKnop').style.display === 'none',
  };
});
check('Zonder enige ontgrendeling blijft de hele archief-UI verborgen', uiVerborgenTest.archiefUIVerborgen === true, uiVerborgenTest);

const uiZichtbaarTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ontsnappingen: 3, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.updateArchiefUI();
  return {
    archiefUIZichtbaar: getComputedStyle(document.getElementById('archiefUI')).display !== 'none',
    kleursetKnopZichtbaar: document.getElementById('archiefKleursetKnop').style.display !== 'none',
    vlamKnopVerborgen: document.getElementById('archiefVlamKnop').style.display === 'none',
    kleursetKnopNietActief: !document.getElementById('archiefKleursetKnop').classList.contains('actief'),
  };
});
check('Met kleurset ontgrendeld: archief-UI en de kleurset-knop worden zichtbaar, de nog-niet-ontgrendelde vlam-knop niet',
  uiZichtbaarTest.archiefUIZichtbaar && uiZichtbaarTest.kleursetKnopZichtbaar && uiZichtbaarTest.vlamKnopVerborgen &&
  uiZichtbaarTest.kleursetKnopNietActief, uiZichtbaarTest);

const uiKlikTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ontsnappingen: 3, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.updateArchiefUI();
  let pointerLockCalls = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = function (...a) { pointerLockCalls++; return orig.apply(this, a); };
  document.getElementById('archiefKleursetKnop').click();
  const naEersteKlik = { actief: d.stadsarchief.actief.kleurset, opgeslagen: JSON.parse(localStorage.getItem(d.STADSARCHIEF_KEY)).actief.kleurset, pointerLockCalls };
  document.getElementById('archiefKleursetKnop').click();
  const naTweedeKlik = { actief: d.stadsarchief.actief.kleurset };
  d.renderer.domElement.requestPointerLock = orig;
  localStorage.removeItem(d.STADSARCHIEF_KEY);
  return { naEersteKlik, naTweedeKlik };
});
check('Klikken op een ontgrendelde archief-knop togglet stadsarchief.actief.* aan en persisteert dat',
  uiKlikTest.naEersteKlik.actief === true && uiKlikTest.naEersteKlik.opgeslagen === true, uiKlikTest);
check('Nogmaals klikken togglet weer uit',
  uiKlikTest.naTweedeKlik.actief === false, uiKlikTest);
check('Klikken op een archief-knop vraagt GEEN pointer lock aan (stopPropagation)',
  uiKlikTest.naEersteKlik.pointerLockCalls === 0, uiKlikTest);

const uiGeblokkeerdKlikTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.updateArchiefUI();
  document.getElementById('archiefKleursetKnop').click();   // nog niet ontgrendeld: verborgen knop, klik mag niets doen
  return { actief: d.stadsarchief.actief.kleurset };
});
check('Klikken op een nog-verborgen (niet-ontgrendelde) knop heeft geen effect (defensieve check in de handler)',
  uiGeblokkeerdKlikTest.actief === false, uiGeblokkeerdKlikTest);

// --- 10. Cosmetische toepassing: kleurset-tint op de ondode-huidskleur -----
const kleursetToepassingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const traits = d.kiesOndodeTraits();
  const origRandom = Math.random;
  Math.random = () => 0.5;   // deterministische kleurvariatie-tint voor beide spawns

  d.stadsarchief = { ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  const zonder = d.spawnOndode(0, 'normaal', traits);
  const kleurZonder = zonder.delen.romp.children[0].material.color.clone();

  d.stadsarchief = { ontsnappingen: 3, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: true, vlamTint: false, introMelodie: false } };
  const met = d.spawnOndode(0, 'normaal', traits);
  const kleurMet = met.delen.romp.children[0].material.color.clone();

  Math.random = origRandom;
  return {
    zonder: { r: kleurZonder.r, g: kleurZonder.g, b: kleurZonder.b },
    met: { r: kleurMet.r, g: kleurMet.g, b: kleurMet.b },
    tint: { r: d.STADSARCHIEF_KLEURSET_TINT.r, g: d.STADSARCHIEF_KLEURSET_TINT.g, b: d.STADSARCHIEF_KLEURSET_TINT.b },
  };
});
const EPS = 1e-4;
check('Ontgrendeld+actief: de ondode-huidskleur is exact de basis-kleur vermenigvuldigd met STADSARCHIEF_KLEURSET_TINT',
  Math.abs(kleursetToepassingTest.met.r - kleursetToepassingTest.zonder.r * kleursetToepassingTest.tint.r) < EPS &&
  Math.abs(kleursetToepassingTest.met.g - kleursetToepassingTest.zonder.g * kleursetToepassingTest.tint.g) < EPS &&
  Math.abs(kleursetToepassingTest.met.b - kleursetToepassingTest.zonder.b * kleursetToepassingTest.tint.b) < EPS,
  kleursetToepassingTest);

// --- 11. Cosmetische toepassing: mondingsvlam-tint bij schiet() ------------
const vlamToepassingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.gesmeed = false;
  d.stadsarchief = { ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.schiet();
  const basisKleur = d.wapenStaat.definitie.vlam.material.color.getHex();
  const vlamKleurBasis = d.wapenStaat.definitie.vlamKleurBasis;

  // Ontgrendeld maar NIET actief: nog steeds de basiskleur.
  d.stadsarchief = { ontsnappingen: 0, headshotsTotaal: 100, hoogsteGolf: 0, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  d.schiet();
  const ontgrendeldNietActief = d.wapenStaat.definitie.vlam.material.color.getHex();

  // Ontgrendeld EN actief: de archief-tint.
  d.stadsarchief.actief.vlamTint = true;
  d.schiet();
  const ontgrendeldEnActief = d.wapenStaat.definitie.vlam.material.color.getHex();

  // Een gesmeed wapen wint altijd van de archief-tint (eigen ember-accent).
  d.wapenStaat.gesmeed = true;
  d.schiet();
  const gesmeedWintVanArchief = d.wapenStaat.definitie.vlam.material.color.getHex();
  d.wapenStaat.gesmeed = false;   // herstellen voor eventuele volgende checks

  return { basisKleur, vlamKleurBasis, ontgrendeldNietActief, ontgrendeldEnActief, gesmeedWintVanArchief };
});
check('Zonder ontgrendeling: de mondingsvlam is gewoon de wapen-eigen basiskleur',
  vlamToepassingTest.basisKleur === vlamToepassingTest.vlamKleurBasis, vlamToepassingTest);
check('Ontgrendeld maar niet actief gekozen: nog steeds de basiskleur (geen automatische toepassing)',
  vlamToepassingTest.ontgrendeldNietActief === vlamToepassingTest.vlamKleurBasis, vlamToepassingTest);
check('Ontgrendeld EN actief gekozen: de mondingsvlam wordt STADSARCHIEF_VLAM_TINT (0xb478ff)',
  vlamToepassingTest.ontgrendeldEnActief === 0xb478ff, vlamToepassingTest);
check('Een gesmeed wapen behoudt zijn eigen ember-accent (0xff7a1f), ook met de archief-tint actief',
  vlamToepassingTest.gesmeedWintVanArchief === 0xff7a1f, vlamToepassingTest);

// --- 12. Cosmetische toepassing: intro-melodie alleen bij ontgrendeld+actief
const introMelodieFunctieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.introMelodieTeller;
  d.speelIntroMelodie();
  return { voor, na: d.introMelodieTeller };
});
check('speelIntroMelodie() werkt en verhoogt de test-teller bij elke aanroep',
  introMelodieFunctieTest.na === introMelodieFunctieTest.voor + 1, introMelodieFunctieTest);

// De echte aanroep zit in initGeluid(), dat maar één keer per sessie de
// audio-graph opbouwt (audio is dan al gezet) — bron-assertie op de exacte
// guard i.p.v. een tweede live audio-init forceren.
const introMelodieGateTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bron = d.initGeluid.toString();
  return {
    heeftGuard: /stadsarchiefOntgrendelingen\(\)\.introMelodie\s*&&\s*stadsarchief\.actief\.introMelodie/.test(bron),
    roeptSpeelIntroMelodieAan: bron.includes('speelIntroMelodie()'),
  };
});
check('initGeluid() roept speelIntroMelodie() alleen aan achter de exacte ontgrendeld-EN-actief-guard',
  introMelodieGateTest.heeftGuard && introMelodieGateTest.roeptSpeelIntroMelodieAan, introMelodieGateTest);

// --- 13. Opruimen: geen archiefsleutel achterlaten voor andere testbestanden
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
