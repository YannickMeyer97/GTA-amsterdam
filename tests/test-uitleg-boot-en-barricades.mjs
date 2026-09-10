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
// prompt alleen de opbrengst noemde. Nu een eenmalige hint bij de eerste
// gebroken plank, plus een prompt die het effect vertelt.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

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
    tekort: lees(2, 1250),
    netTekort: lees(2, d.ONTSNAPPING_PRIJS - 1),
    precies: lees(2, d.ONTSNAPPING_PRIJS),
    ruim: lees(3, 99999),
  };
});
check('Vóór het eerste onderdeel blijft de regel kaal — het bedrag is dan nog niet relevant (T76-ritme)',
  hud.geenOnderdelen === 'Vluchtroute: 0/3' && hud.geenOnderdelenRijk === 'Vluchtroute: 0/3', hud);
check('Met een onderdeel en te weinig geld staat er hoeveel je nog tekortkomt',
  hud.tekort.includes('nog €1250') && hud.tekort.includes('2/3'), hud);
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
  d.vluchtOnderdelenOpgepakt = 1;
  d.spelStaat.geld = 500;
  d.updateHUD();
  const na500 = el.textContent;
  d.spelStaat.geld = 2000;
  d.updateHUD();               // updateHUD draait bij elke geldwijziging
  const na2000 = el.textContent;

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
  return { na500, na2000, schrijfTeller };
});
check('De regel beweegt mee zodra het geld verandert (via updateHUD, niet via een eigen timer)',
  meebewegen.na500.includes('nog €2000') && meebewegen.na2000.includes('nog €500'), meebewegen);
check('Zonder geldwijziging schrijft de regel zichzelf niet per frame opnieuw',
  meebewegen.schrijfTeller === 0, meebewegen);

// --- T166.1 De hint vuurt precies één keer per sessie -------------------
const hint = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.barricadeUitgelegd = false;
  const venster = d.VENSTERS[0];
  venster.planken = d.BARRICADE_MAX_PLANKEN;
  const voor = d.barricadeUitlegTeller;
  d.beukBarricade(venster);
  const naEerste = { teller: d.barricadeUitlegTeller, melding: document.getElementById('meldingUI').textContent };
  // Nog vier keer beuken (ook op een ander raam) mag niets meer opleveren.
  d.beukBarricade(venster);
  const tweede = d.VENSTERS[1] ?? venster;
  tweede.planken = d.BARRICADE_MAX_PLANKEN;
  d.beukBarricade(tweede);
  d.beukBarricade(tweede);
  return { voor, naEerste, tellerEind: d.barricadeUitlegTeller };
});
check('De barricade-hint verschijnt bij de eerste gebroken plank',
  hint.naEerste.teller === hint.voor + 1, hint);
check('...en vertelt zowel het effect (houdt een ondode tegen) als de opbrengst (geld)',
  /tegen/i.test(hint.naEerste.melding) && /geld/i.test(hint.naEerste.melding), hint);
check('Verder beuken levert geen tweede hint op — precies één keer per sessie',
  hint.tellerEind === hint.voor + 1, hint);

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

// --- Bron-assertie: allebei zijn COMMUNICATIETICKETS -------------------
// Geen enkel balansgetal is aangeraakt. Dit is de belangrijkste check van
// dit bestand: bij allebei lag de verleiding voor de hand om alsnog aan de
// getallen te gaan zitten, en dat zou het verkeerde probleem oplossen.
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
check('De bootprijs is onveranderd €2500', balans.bootprijs === 2500, balans);
check('Barricadegetallen zijn onveranderd (€20 per plank, 3 planken per raam)',
  balans.plankGeld === 20 && balans.maxPlanken === 3, balans);
check('Het inkomen is onveranderd (€20 per kill, €5 per treffer)',
  balans.geldPerKill === 20 && balans.geldPerHit === 5, balans);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
