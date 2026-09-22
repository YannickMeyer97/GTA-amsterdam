// Ticket 165 + 166 (v0.28, ronde 14): twee communicatietickets.
//
// Allebei lossen ze hetzelfde soort probleem op: een mechaniek die wérkt maar
// die de speler nergens te zien krijgt. En bij allebei lag de verleiding voor
// de hand om alsnog aan de getallen te gaan zitten — daarom staat hier een
// bron-assertie die bewaakt dat er GEEN balansgetal is aangeraakt.
//
// T165: gemeten is dat wie elke upgrade koopt de €2.500 voor de boot pas rond
// golf 26 haalt, terwijl wie spaart al op golf 10 weg kan. Prima spanning,
// maar de speler merkte alleen dat de boot onbereikbaar bleef. De
// vluchtroute-HUD toont nu hoe ver hij ervan af staat.
//
// T166: het barricadesysteem is een vangnet (terugtimmeren levert €20 per
// plank op én houdt een ondode tegen), maar niemand gebruikt het omdat de
// prompt alleen de opbrengst noemde. De prompt vertelt sindsdien ook het
// effect. (De eenmalige hint bij de eerste gebroken plank die dit ticket
// oorspronkelijk toevoegde is later op verzoek weer verwijderd — zie de
// git-historie voor die sectie.)
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- T165.1 De HUD-regel in al zijn standen -----------------------------
const hud = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('vluchtrouteUI');
  const lees = (onderdelen, geld) => {
    d.vluchtOnderdelenOpgepakt = onderdelen;
    d.spelStaat.geld = geld;
    d.updateVluchtrouteHUD();
    return el.textContent;
  };
  return {
    prijs: d.ONTSNAPPING_PRIJS,
    geenOnderdelen: lees(0, 0),
    geenOnderdelenRijk: lees(0, 99999),
    // Ticket 184: 1250 was op de helft van de oude €2500-prijs gekalibreerd
    // en zou nu ÓVER de nieuwe €1000-prijs zitten (dus "betaalbaar" tonen
    // i.p.v. tekort) — 500 is opnieuw ruim onder de helft.
    tekort: lees(2, 500),
    netTekort: lees(2, d.ONTSNAPPING_PRIJS - 1),
    precies: lees(2, d.ONTSNAPPING_PRIJS),
    ruim: lees(3, 99999),
  };
});
check('Vóór het eerste onderdeel blijft de regel kaal — het bedrag is dan nog niet relevant (T76-ritme)',
  hud.geenOnderdelen === 'Vluchtroute: 0/3' && hud.geenOnderdelenRijk === 'Vluchtroute: 0/3', hud);
check('Met een onderdeel en te weinig geld staat er hoeveel je nog tekortkomt',
  hud.tekort.includes('nog €500') && hud.tekort.includes('2/3'), hud);
check('Eén euro tekort telt nog als tekort — de grens klopt precies',
  hud.netTekort.includes('nog €1'), hud);
check('Bij precies genoeg geld slaat de regel om naar "boot betaalbaar"',
  /betaalbaar/.test(hud.precies) && hud.precies.includes(String(hud.prijs)), hud);
check('Met ruim voldoende geld blijft dat zo', /betaalbaar/.test(hud.ruim), hud);

// --- T165.2 De regel is niet moraliserend ------------------------------
// Sterker worden is een geldige strategie en veel spelers willen helemaal
// niet ontsnappen; de HUD toont een stand, geen advies.
check('De regel bevat geen oordeel of advies over je koopgedrag',
  !/(te veel|verspil|niet kopen|had je|beter)/i.test(hud.tekort + hud.precies), hud);

// --- T165.3 De regel beweegt mee met het geld, zonder per-frame writes --
const meebewegen = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('vluchtrouteUI');
  // Ticket 184: 500/2000 waren op de oude €2500-prijs gekalibreerd (2000 zat
  // toen nog ruim onder de prijs); met de nieuwe €1000-prijs zou 2000 al
  // "betaalbaar" tonen in plaats van een tekort. 200/700 blijven allebei
  // eronder.
  d.vluchtOnderdelenOpgepakt = 1;
  d.spelStaat.geld = 200;
  d.updateHUD();
  const na200 = el.textContent;
  d.spelStaat.geld = 700;
  d.updateHUD();               // updateHUD draait bij elke geldwijziging
  const na700 = el.textContent;

  // Per-frame-telling: schrijft de regel zichzelf niet elke frame opnieuw?
  let schrijfTeller = 0;
  const origineel = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(el, 'textContent', {
    configurable: true,
    get() { return origineel.get.call(this); },
    set(v) { schrijfTeller++; origineel.set.call(this, v); },
  });
  await new Promise(r => setTimeout(r, 400));   // echte frames, zonder geldwijziging
  delete el.textContent;
  return { na200, na700, schrijfTeller };
});
check('De regel beweegt mee zodra het geld verandert (via updateHUD, niet via een eigen timer)',
  meebewegen.na200.includes('nog €800') && meebewegen.na700.includes('nog €300'), meebewegen);
check('Zonder geldwijziging schrijft de regel zichzelf niet per frame opnieuw',
  meebewegen.schrijfTeller === 0, meebewegen);

// T166.1 (de eenmalige "Ze slopen je barricades!"-hint bij de eerste
// gebroken plank) is op verzoek verwijderd — beukBarricade() toont sindsdien
// nooit meer een melding, alleen nog de plank-breekanimatie/-geluid en de
// reparatieprompt hieronder.

// --- T166.2 De reparatieprompt noemt effect én opbrengst ---------------
const prompt = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const venster = d.VENSTERS[0];
  venster.planken = 1;
  return {
    tekst: venster.interactiePunt.prompt(),
    beloning: d.BARRICADE_REPARATIE_GELD,
    max: d.BARRICADE_MAX_PLANKEN,
  };
});
check('De reparatieprompt noemt de opbrengst én wat een plank doet',
  prompt.tekst.includes(`€${prompt.beloning}`) && /tegen/i.test(prompt.tekst), prompt);
check('...en blijft de plankenstand tonen', prompt.tekst.includes(`1/${prompt.max}`), prompt);

// --- De verwijderde hint blijft ook echt weg ----------------------------
// Regressiebewaking voor het verwijderen van T166.1: een plank breken mag
// geen enkele melding meer tonen, en geen enkele plek in het bestand mag
// de oude tekst nog aanroepen.
const geenHintMeer = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  document.getElementById('meldingUI').textContent = '';
  const venster = d.VENSTERS[0];
  venster.planken = d.BARRICADE_MAX_PLANKEN;
  d.beukBarricade(venster);
  return { meldingNa: document.getElementById('meldingUI').textContent };
});
check('Een gebroken plank toont geen melding meer', geenHintMeer.meldingNa === '', geenHintMeer);
// Toetst de FUNCTIE zelf, niet de hele pagina — een documenterende comment
// die uitlegt wat hier vroeger stond en waarom het weg is (zoals dit bestand
// dat hierboven ook doet) is prima; alleen een actieve toonMelding()-aanroep
// met die tekst zou een regressie zijn.
const functieBron = await page.evaluate(() => window.AmsterdamUndeadDebug.beukBarricade.toString());
check('beukBarricade() zelf roept de oude hinttekst nergens meer aan',
  !/Ze slopen je barricades/.test(functieBron), { functieBron });

// --- Bron-assertie: allebei zijn COMMUNICATIETICKETS -------------------
// Geen enkel balansgetal is een SLUIPENDE wijziging vanuit deze twee
// communicatietickets. Ticket 184 (later, een rechtstreekse
// eigenaarsbeslissing, expliciet toegestaan door CLAUDE.md §9.2) verlaagde
// de bootprijs bewust van €2500 naar €1000 — die verandering hoort hier dus
// wél in vastgelegd te worden, met de vermelding waarom. De barricade-
// getallen zijn door geen van beide tickets aangeraakt en blijven de
// bron-assertie tegen een sluipende wijziging.
const balans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bootprijs: d.ONTSNAPPING_PRIJS,
    plankGeld: d.BARRICADE_REPARATIE_GELD,
    maxPlanken: d.BARRICADE_MAX_PLANKEN,
    geldPerKill: d.GELD_PER_KILL,
    geldPerHit: d.GELD_PER_HIT,
  };
});
check('De bootprijs staat op €1000 (Ticket 184: bewust omlaag van €2500, een eigenaarsbeslissing, geen lek uit deze twee tickets)',
  balans.bootprijs === 1000, balans);
check('Barricadegetallen zijn onveranderd (€20 per plank, 3 planken per raam)',
  balans.plankGeld === 20 && balans.maxPlanken === 3, balans);
check('Het inkomen is onveranderd (€20 per kill, €5 per treffer)',
  balans.geldPerKill === 20 && balans.geldPerHit === 5, balans);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
