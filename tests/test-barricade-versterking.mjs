// Ticket 158 deel B (v0.26, ronde 12): de barricadeversterking als
// herbruikbare geldput met een oplopende prijs.
//
// WAAROM DIT NIET DE "HERSTEL ALLES"-KNOP UIT HET TICKET IS — gemeten vóór
// de bouw, en de reden dat het ontwerp is omgegooid:
//   - Alleen de twee VENSTERS-ramen worden ooit gebeukt (de andere drie
//     raamlijsten krijgen wél barricades, maar golfSpawnStap() kiest
//     uitsluitend uit VENSTERS).
//   - Hun 6 planken sneuvelen ALLEMAAL in golf 1; golf 2 t/m 25 staat de
//     mechaniek op 0 planken en 0 beuk-events.
//   - Handmatig repareren LEVERT €20 per plank OP (BARRICADE_REPARATIE_GELD).
// Een betaalde "herstel alles" was dus strikt gedomineerd door de gratis,
// geld-opleverende variant én had na golf 1 niets te herstellen. Deze aankoop
// tilt daarom BOVEN het gratis maximum uit: gratis repareren blijft op
// BARRICADE_MAX_PLANKEN (3), kopen tilt naar BARRICADE_VERSTERKT_PLANKEN (6).
// Wat je koopt is tempo — elke intacte plank slikt één spawn-stap zonder
// ondode (golfSpawnStap), dus dit is een adempauze, geen kracht.
//
// De prijscurve is geijkt op gemeten golfinkomen (zie ROADMAP T158 deel B):
// rond golf 18-25 verdient een speler €900-1100 per golf. Deze test herhaalt
// die meting niet (dat hoort bij het kalibreren), maar toetst wel de GRENZEN
// die eruit volgden.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const GEMETEN_GOLFINKOMEN_LAAT = 1100;   // €/golf op golf 22-25, bovengrens van de meting

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Structuurinvarianten uit de acceptatiecriteria -------------------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    interactiePunten: d.interactiePunten.length,
    winkelMarkeringen: d.winkelMarkeringen.length,
    obstakels: d.obstakels.length,
    puntInLijst: d.interactiePunten.includes(d.barricadeVersterkingPunt),
    stijlBestaat: !!d.WINKEL_STIJLEN.barricade,
    markeringStijl: d.barricadeMarkering.userData.stijlNaam,
    puntX: d.BARRICADE_PUNT_X,
    puntZ: d.BARRICADE_PUNT_Z,
    vensterX: d.VENSTERS.map(v => v.x),
    vensterZ: d.VENSTERS[0].z,
  };
});
check('interactiePunten groeit met exact 1 (14 -> 15)', structuur.interactiePunten === 15, structuur);
check('Het versterkingspunt staat daadwerkelijk in interactiePunten', structuur.puntInLijst, structuur);
check('obstakels.length blijft 58 — geen nieuwe collision (ticket-eis)', structuur.obstakels === 58, structuur);
check('Er is precies één markering bijgekomen (14 -> 15), met de eigen barricade-stijl',
  structuur.winkelMarkeringen === 15 && structuur.markeringStijl === 'barricade', structuur);
check('Het punt staat midden vóór de twee beukbare ramen, een meter de kamer in',
  structuur.puntX === (structuur.vensterX[0] + structuur.vensterX[1]) / 2
  && Math.abs(structuur.puntZ - (structuur.vensterZ - 1)) < 1e-9, structuur);

// --- 2. De prijs loopt aantoonbaar op per gebruik ------------------------
const prijs = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const curve = [];
  for (let i = 0; i < 6; i++) { d.barricadeVersterkingenGekocht = i; curve.push(d.barricadeVersterkPrijs()); }
  d.barricadeVersterkingenGekocht = 0;
  return { curve, basis: d.BARRICADE_VERSTERK_BASISPRIJS, factor: d.BARRICADE_VERSTERK_PRIJSFACTOR };
});
check('De prijs stijgt strikt monotoon per gebruik (de kern-eis van een oplopende geldput)',
  prijs.curve.every((p, i) => i === 0 || p > prijs.curve[i - 1]), prijs);
check('De eerste aankoop kost de basisprijs', prijs.curve[0] === prijs.basis, prijs);
check('Elke stap volgt basis * factor^n, afgerond op tientallen',
  prijs.curve.every((p, i) => p === Math.round(prijs.basis * Math.pow(prijs.factor, i) / 10) * 10), prijs);
// "Geen belasting, maar een keuze": er MOET een gebruik zijn waarna de prijs
// een vol laat-game golfinkomen overstijgt, anders koop je 'm altijd.
const eersteOnbetaalbare = prijs.curve.findIndex(p => p > GEMETEN_GOLFINKOMEN_LAAT);
check(`Er komt een moment waarop de prijs boven een vol laat-game golfinkomen (€${GEMETEN_GOLFINKOMEN_LAAT}) uitkomt — dan sla je 'm bewust over`,
  eersteOnbetaalbare !== -1, { curve: prijs.curve, eersteOnbetaalbare });
check('...en dat gebeurt niet meteen bij de eerste aankoop (de put moet wél bruikbaar zijn)',
  eersteOnbetaalbare >= 2, { curve: prijs.curve, eersteOnbetaalbare });

// --- 3. Kopen tilt boven het GRATIS maximum uit; gratis repareren blijft
// geplafonneerd op 3. Dit is precies wat de betaalde variant niet-gedomineerd
// maakt. ------------------------------------------------------------------
const koop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  const prijs = d.barricadeVersterkPrijs();
  d.koopBarricadeVersterking();
  const naKoop = {
    geldAf: 5000 - d.spelStaat.geld,
    prijs,
    planken: d.VENSTERS.map(v => v.planken),
    meshesInWereld: d.VENSTERS.map(v => v.plankMeshes.filter(m => m.parent).length),
    tellerNa: d.barricadeVersterkingenGekocht,
    volledig: d.barricadesVolledigVersterkt(),
    statusNa: d.WINKEL_STIJLEN.barricade.status(),
  };
  // Gratis repareren mag nooit boven maxPlanken uitkomen, ook niet nu de
  // versterking bestaat: anders kon je de versterking gratis nabouwen én er
  // nog €20 per plank aan verdienen.
  const v0 = d.VENSTERS[0];
  v0.planken = d.BARRICADE_MAX_PLANKEN - 1;
  const geldVoor = d.spelStaat.geld;
  for (let i = 0; i < 8; i++) d.repareerBarricade(v0);
  return {
    ...naKoop,
    plankenNaGratisRepareren: v0.planken,
    gratisOpbrengst: d.spelStaat.geld - geldVoor,
    maxPlanken: d.BARRICADE_MAX_PLANKEN,
    versterkt: d.BARRICADE_VERSTERKT_PLANKEN,
    reparatieGeld: d.BARRICADE_REPARATIE_GELD,
  };
});
check('De aankoop schrijft exact de actuele prijs af', koop.geldAf === koop.prijs, koop);
check('Beide ramen staan na de aankoop op het versterkte aantal planken',
  koop.planken.every(p => p === koop.versterkt), koop);
check('De extra planken hangen ook echt in de wereld (mesh-boekhouding klopt)',
  koop.meshesInWereld.every(n => n === koop.versterkt), koop);
check('De gebruiksteller loopt op, zodat de volgende aankoop duurder is', koop.tellerNa === 1, koop);
check("Zolang alles versterkt is meldt de stijl 'nvt' (niets te kopen, zelfde patroon als Watertap bij volle HP)",
  koop.volledig && koop.statusNa === 'nvt', koop);
check('Gratis repareren blijft geplafonneerd op BARRICADE_MAX_PLANKEN — de versterking is niet gratis na te bouwen',
  koop.plankenNaGratisRepareren === koop.maxPlanken, koop);
check('...en levert daarbij precies één plank aan reparatiegeld op, niet meer',
  koop.gratisOpbrengst === koop.reparatieGeld, koop);

// --- 4. Regressiewacht: het repareerpunt hoort er pas in zodra repareren
// ook echt KAN (onder maxPlanken). Met de oude "wasVol"-vorm leverde de
// eerste beuk op een versterkte barricade een prompt op die repareer-
// Barricade() meteen weigerde. -------------------------------------------
const beuk = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const v0 = d.VENSTERS[0];
  // Zet 'm terug op volledig versterkt
  const pi = d.interactiePunten.indexOf(v0.interactiePunt);
  if (pi !== -1) d.interactiePunten.splice(pi, 1);
  v0.planken = 0;
  d.versterkBarricade(v0);
  const verloop = [];
  for (let i = 0; i < 5; i++) {
    d.beukBarricade(v0);
    verloop.push({
      planken: v0.planken,
      puntAanwezig: d.interactiePunten.includes(v0.interactiePunt),
      aantalKeerInLijst: d.interactiePunten.filter(p => p === v0.interactiePunt).length,
    });
  }
  return { verloop, maxPlanken: d.BARRICADE_MAX_PLANKEN };
});
check('Boven het gratis maximum verschijnt GEEN repareerpunt (geen prompt die niets doet)',
  beuk.verloop.filter(s => s.planken >= beuk.maxPlanken).every(s => !s.puntAanwezig), beuk);
check('Zodra de barricade onder het gratis maximum zakt, verschijnt het repareerpunt wél',
  beuk.verloop.filter(s => s.planken < beuk.maxPlanken).every(s => s.puntAanwezig), beuk);
check('Het repareerpunt komt nooit dubbel in interactiePunten terecht',
  beuk.verloop.every(s => s.aantalKeerInLijst <= 1), beuk);

// --- 5. Het belangrijkste randgeval van het ticket: de ontsnappingsdrempel.
// Met een complete vluchtroute mag deze put het saldo niet onder
// ONTSNAPPING_PRIJS kunnen duwen. --------------------------------------
const drempel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const herstel = () => { for (const v of d.VENSTERS) { v.planken = d.BARRICADE_MAX_PLANKEN; } };

  // (a) Zonder complete vluchtroute geldt de drempel niet — dan is er nog
  // geen boot om jezelf uit te prijzen.
  d.vluchtOnderdelenOpgepakt = 0;
  d.barricadeVersterkingenGekocht = 0;
  d.spelStaat.geld = 2600;
  herstel();
  const zonderRoute = { blokkeert: d.barricadeVersterkRaaktOntsnapping() };
  d.koopBarricadeVersterking();
  zonderRoute.geldNa = d.spelStaat.geld;
  zonderRoute.gekocht = d.barricadeVersterkingenGekocht === 1;

  // (b) Mét complete vluchtroute en een saldo dat door de aankoop onder de
  // drempel zou zakken: blokkeren, geld onaangeroerd.
  d.vluchtOnderdelenOpgepakt = d.VLUCHT_ONDERDELEN.length;
  d.barricadeVersterkingenGekocht = 0;
  d.spelStaat.geld = 2600;   // prijs 400 -> zou 2200 overhouden, onder 2500
  herstel();
  const geldVoor = d.spelStaat.geld;
  const metRoute = {
    blokkeert: d.barricadeVersterkRaaktOntsnapping(),
    prompt: d.barricadeVersterkingPunt.prompt(),
    status: d.WINKEL_STIJLEN.barricade.status(),
  };
  d.koopBarricadeVersterking();
  metRoute.geldOnaangeroerd = d.spelStaat.geld === geldVoor;
  metRoute.tellerOngewijzigd = d.barricadeVersterkingenGekocht === 0;
  metRoute.plankenOngewijzigd = d.VENSTERS.every(v => v.planken === d.BARRICADE_MAX_PLANKEN);

  // (c) Ruim boven de drempel mag het wél, ook met complete vluchtroute.
  d.spelStaat.geld = 5000;   // 5000 - 400 = 4600, ruim boven 2500
  herstel();
  const ruim = { blokkeert: d.barricadeVersterkRaaktOntsnapping() };
  d.koopBarricadeVersterking();
  ruim.gekocht = d.barricadeVersterkingenGekocht === 1;
  ruim.geldNa = d.spelStaat.geld;

  return { zonderRoute, metRoute, ruim, drempel: d.ONTSNAPPING_PRIJS };
});
check('Zonder complete vluchtroute geldt de ontsnappingsdrempel niet (er is nog geen boot)',
  !drempel.zonderRoute.blokkeert && drempel.zonderRoute.gekocht, drempel);
check('Mét complete vluchtroute blokkeert de put zichzelf als het saldo eronder zou zakken',
  drempel.metRoute.blokkeert, drempel);
check('...en dan gebeurt er ook echt niets: geld, teller en planken blijven ongemoeid',
  drempel.metRoute.geldOnaangeroerd && drempel.metRoute.tellerOngewijzigd
  && drempel.metRoute.plankenOngewijzigd, drempel);
check('...de prompt legt de blokkade uit i.p.v. een dode T-toets te tonen',
  drempel.metRoute.prompt.includes(String(drempel.drempel)), drempel);
check("...en de ring pulst dan niet 'beschikbaar'", drempel.metRoute.status === 'teDuur', drempel);
check('Ruim boven de drempel mag de aankoop gewoon doorgaan, ook met complete vluchtroute',
  !drempel.ruim.blokkeert && drempel.ruim.gekocht && drempel.ruim.geldNa === 4600, drempel);

// --- 6. Wat je koopt is TEMPO: een versterkte barricade slikt aantoonbaar
// meer spawn-stappen, en is daarna weer op (geen blijvende krachtwinst). --
async function meetSpawnDruk(versterkt) {
  return page.evaluate((versterkt) => {
    const d = window.AmsterdamUndeadDebug;
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.updateStervenden(1.0);
    d.spelStaat.gameOver = false;
    d.spelStaat.golfActief = false;
    d.spelStaat.golf = 20;
    for (const v of d.VENSTERS) {
      v.planken = versterkt ? d.BARRICADE_VERSTERKT_PLANKEN : d.BARRICADE_MAX_PLANKEN;
    }
    d.startGolf();
    const uit = {};
    let t = 0;
    while (t < 20) {
      d.updateGolf(0.05);
      t += 0.05;
      const sec = Math.round(t);
      if (Math.abs(t - sec) < 0.026 && [10, 20].includes(sec)) uit[sec] = d.ondoden.length;
    }
    uit.plankenRest = d.VENSTERS.map(v => v.planken);
    return uit;
  }, versterkt);
}
const zonder = await meetSpawnDruk(false);
const met = await meetSpawnDruk(true);
check('Na 10s golf heeft een versterkte barricade nog GEEN ondode doorgelaten, een gewone wel',
  met[10] === 0 && zonder[10] > 0, { zonder, met });
check('Na 20s golf staan er met versterking aantoonbaar minder ondoden dan zonder',
  met[20] < zonder[20], { zonder, met });
check('De versterking is TIJDELIJK: na de golf zijn de planken weer op, dus er is geen blijvende krachtwinst',
  met.plankenRest.every(p => p === 0), { zonder, met });

// --- 7. Mesh-discipline (T85): geen groei door herhaald kopen/beuken ----
const meshes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geoVoor = d.renderer.info.memory.geometries;
  const texVoor = d.renderer.info.memory.textures;
  const perVensterVoor = d.VENSTERS.map(v => v.plankMeshes.length);
  for (let ronde = 0; ronde < 12; ronde++) {
    for (const v of d.VENSTERS) { v.planken = 0; d.versterkBarricade(v); }
    for (const v of d.VENSTERS) { for (let i = 0; i < 6; i++) d.beukBarricade(v); }
  }
  return {
    geoVoor, texVoor,
    geoNa: d.renderer.info.memory.geometries,
    texNa: d.renderer.info.memory.textures,
    perVensterVoor,
    perVensterNa: d.VENSTERS.map(v => v.plankMeshes.length),
    versterkt: d.BARRICADE_VERSTERKT_PLANKEN,
    // De niet-beukbare raamlijsten krijgen geen versterkingsmeshes: daar
    // gebeurt dit nooit, dus daar hoeft ook niets voor klaar te liggen.
    andereLijstenPlanken: [...d.VENSTERS_KAMER2, ...d.VENSTERS_PLAATS, ...d.VENSTERS_BIJKEUKEN]
      .map(v => v.plankMeshes.length),
    maxPlanken: d.BARRICADE_MAX_PLANKEN,
  };
});
check('12 rondes versterken + slopen voegen geen enkele geometrie of textuur toe (T85-regel)',
  meshes.geoNa === meshes.geoVoor && meshes.texNa === meshes.texVoor, meshes);
check('Het aantal plankmeshes per beukbaar raam is en blijft het versterkte aantal (vooraf gealloceerd)',
  meshes.perVensterVoor.every(n => n === meshes.versterkt)
  && meshes.perVensterNa.every(n => n === meshes.versterkt), meshes);
check('De niet-beukbare raamlijsten houden exact hun bestaande 3 planken — geen mesh voor iets dat daar nooit gebeurt',
  meshes.andereLijstenPlanken.every(n => n === meshes.maxPlanken), meshes);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
