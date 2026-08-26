// De Smederij (Tickets 11-12): per-wapen schadeformule, gesmeed-status.
// Zie ROADMAP.md Ticket 11/12 en ARCHITECTURE_NOTES.md §1 "Wapenschade" /
// §2 punt 7-8.
//
// Let op: wisselWapen() neemt GEEN argument — het is een pure toggle. Elke
// evaluate() hieronder die een specifiek wapen nodig heeft, toggelt dus
// alleen als d.actiefWapenNaam nog niet het gewenste wapen is.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- Ticket 11: schadePerTreffer start op 1 --------------------------------
const globaleSchade = await page.evaluate(() => window.AmsterdamUndeadDebug.schadePerTreffer);
check('schadePerTreffer start op 1', globaleSchade === 1, { globaleSchade });

// --- Ticket 11 / Fix 5: smederijConfig per wapen, nu 2 niveaus (array) -----
const configs = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { drukspuit: d.WAPEN_DRUKSPUIT.smederijConfig, ratelaar: d.WAPEN_RATELAAR.smederijConfig };
});
check('Drukspuit-smederijConfig[0] (niveau 1): schadeBonus 1.5, magazijnMax 12',
  configs.drukspuit[0].schadeBonus === 1.5 && configs.drukspuit[0].magazijnMax === 12, configs.drukspuit);
check('Ratelaar-smederijConfig[0] (niveau 1): schadeBonus 1, magazijnMax 24',
  configs.ratelaar[0].schadeBonus === 1 && configs.ratelaar[0].magazijnMax === 24, configs.ratelaar);
check('Drukspuit-smederijConfig[1] (niveau 2, Fix 5): meer schade dan niveau 1, groter magazijn',
  configs.drukspuit[1].schadeBonus > configs.drukspuit[0].schadeBonus &&
  configs.drukspuit[1].magazijnMax > configs.drukspuit[0].magazijnMax, configs.drukspuit);
check('Ratelaar-smederijConfig[1] (niveau 2, Fix 5): meer schade dan niveau 1, groter magazijn',
  configs.ratelaar[1].schadeBonus > configs.ratelaar[0].schadeBonus &&
  configs.ratelaar[1].magazijnMax > configs.ratelaar[0].magazijnMax, configs.ratelaar);

// Ticket 134: de speler start met het mes, niet met een vuurwapen — dit
// hele bestand wisselt via `kiesWapen()` voortdurend tussen Drukspuit en
// Ratelaar, en die toggle (wisselWapen()) vereist BEIDE vuurwapens bezeten
// (bezitTweeVuurwapens()). Dus eerst allebei kopen, vóór ook maar één
// `d.wapenStaat`-lezing hieronder.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (!d.wapenStaten.drukspuit) { d.spelStaat.geld = 5000; d.koopAmstel9(); }
  if (!d.ratelaarGekocht) { d.spelStaat.geld = 5000; d.koopRatelaar(); }
});

// --- Ticket 11 / Fix 5: nieuweWapenStaat() begint op beide niveaus ongesmeed
const gesmeedStart = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { gesmeed: d.wapenStaat.gesmeed, gesmeedNiveau2: d.wapenStaat.gesmeedNiveau2 };
});
check('Een nieuwe wapenstaat begint met gesmeed=false', gesmeedStart.gesmeed === false, gesmeedStart);
check('Een nieuwe wapenstaat begint met gesmeedNiveau2=false', gesmeedStart.gesmeedNiveau2 === false, gesmeedStart);

// --- Ticket 11: 16-combinaties-schadetest ----------------------------------
// wapen x gesmeed x headshot x schadePerTreffer-waarde. Elke ondode krijgt
// hoge HP zodat hij nooit sterft — zo meten we de exacte schade i.p.v. een
// afgekapte overkill-waarde.
function verwachteSchade(schadePerTreffer, gesmeed, schadeBonus, headshot) {
  return schadePerTreffer + (gesmeed ? schadeBonus : 0) + (headshot ? 1 : 0);   // HEADSHOT_EXTRA = 1
}

const schadeCombos = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  const uit = [];
  for (const wapenNaam of ['drukspuit', 'ratelaar']) {
    kiesWapen(wapenNaam);
    for (const gesmeed of [false, true]) {
      d.wapenStaat.gesmeed = gesmeed;
      for (const schadePerTreffer of [1, 1.5]) {
        d.schadePerTreffer = schadePerTreffer;
        for (const headshot of [false, true]) {
          const o = d.spawnOndode(0, 'normaal');
          o.hp = 1000;   // nooit dood, puur schade meten
          const voor = o.hp;
          d.raakOndode(o, o.groep.position, headshot);
          uit.push({ wapenNaam, gesmeed, schadePerTreffer, headshot, schade: voor - o.hp });
          d.doodOndode(o);
        }
      }
    }
    d.wapenStaat.gesmeed = false;   // opruimen per wapen
  }
  d.schadePerTreffer = 1;   // opruimen voor volgende tests
  kiesWapen('drukspuit');
  return uit;
});

const bonussen = { drukspuit: 1.5, ratelaar: 1 };
const alle16Kloppen = schadeCombos.length === 16 && schadeCombos.every(r =>
  Math.abs(r.schade - verwachteSchade(r.schadePerTreffer, r.gesmeed, bonussen[r.wapenNaam], r.headshot)) < 1e-9);
check('Alle 16 combinaties (wapen x gesmeed x headshot x schadePerTreffer-waarde) geven de verwachte schade',
  alle16Kloppen, schadeCombos);

// Losse, leesbare kern-asserts uit de schadebalans-tabel (ROADMAP Ticket 11/12):
const vind = (wapenNaam, gesmeed, schadePerTreffer, headshot) =>
  schadeCombos.find(r => r.wapenNaam === wapenNaam && r.gesmeed === gesmeed && r.schadePerTreffer === schadePerTreffer && r.headshot === headshot).schade;
check('Drukspuit ongesmeed op basisschade 1: bodyshot 1, headshot 2',
  vind('drukspuit', false, 1, false) === 1 && vind('drukspuit', false, 1, true) === 2, schadeCombos);
check('Drukspuit gesmeed op basisschade 1: bodyshot 2.5, headshot 3.5',
  vind('drukspuit', true, 1, false) === 2.5 && vind('drukspuit', true, 1, true) === 3.5, schadeCombos);
check('Drukspuit gesmeed op basisschade 1.5: bodyshot 3, headshot 4',
  vind('drukspuit', true, 1.5, false) === 3 && vind('drukspuit', true, 1.5, true) === 4, schadeCombos);
check('Ratelaar gesmeed op basisschade 1: bodyshot 2, headshot 3',
  vind('ratelaar', true, 1, false) === 2 && vind('ratelaar', true, 1, true) === 3, schadeCombos);
check('Ratelaar gesmeed op basisschade 1.5: bodyshot 2.5, headshot 3.5',
  vind('ratelaar', true, 1.5, false) === 2.5 && vind('ratelaar', true, 1.5, true) === 3.5, schadeCombos);

// --- Ticket 11: Eliminatiemodus-override blijft boven de Smederij-bonus ---
const eliminatieOverride = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.wapenStaat.gesmeed = true;
  d.schadePerTreffer = 1.5;
  d.eliminatiemodusTimer = 5;
  const o = d.spawnOndode(0, 'sjouwer');   // ruim boven de Smederij-schade in HP
  d.raakOndode(o, o.groep.position, false);
  const dood = !d.ondoden.includes(o);
  d.eliminatiemodusTimer = 0;
  d.wapenStaat.gesmeed = false;
  d.schadePerTreffer = 1;
  return { dood };
});
check('Eliminatiemodus doodt nog steeds in één treffer, ook met een gesmeed wapen',
  eliminatieOverride.dood === true, eliminatieOverride);

// --- Ticket 11: wisselen (Q) behoudt gesmeed-status per wapen onafhankelijk ---
const wisselPersistentie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  d.wapenStaat.gesmeed = true;
  kiesWapen('ratelaar');
  const ratelaarGesmeedVoor = d.wapenStaat.gesmeed;
  kiesWapen('drukspuit');
  const drukspuitGesmeedNa = d.wapenStaat.gesmeed;
  d.wapenStaat.gesmeed = false;   // opruimen
  return { ratelaarGesmeedVoor, drukspuitGesmeedNa };
});
check('Drukspuit smeden verandert de Ratelaar-status niet (per-wapen, niet globaal)',
  wisselPersistentie.ratelaarGesmeedVoor === false, wisselPersistentie);
check('Na terugwisselen is de Drukspuit nog steeds gesmeed (status overleeft het wisselen)',
  wisselPersistentie.drukspuitGesmeedNa === true, wisselPersistentie);

// --- Ticket 11: get gesmeedActief() volgt het ACTIEVE wapen ----------------
const gesmeedActiefTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  d.wapenStaat.gesmeed = true;
  const drukspuitActief = d.gesmeedActief;
  kiesWapen('ratelaar');
  const ratelaarActief = d.gesmeedActief;
  kiesWapen('drukspuit');
  d.wapenStaat.gesmeed = false;
  return { drukspuitActief, ratelaarActief };
});
check('gesmeedActief volgt het actieve wapen (true bij gesmede Drukspuit, false bij ongesmede Ratelaar)',
  gesmeedActiefTest.drukspuitActief === true && gesmeedActiefTest.ratelaarActief === false, gesmeedActiefTest);

// =====================================================================
// Ticket 12: De Smederij — koopbare machine
// =====================================================================

// --- Interactiepunt staat op een vrije plek op de binnenplaats -----------
const plek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    vrij: d.isVrijePlek(d.SMEDERIJ_X, d.SMEDERIJ_Z, 0.8),
    binnenGrens: d.SMEDERIJ_X >= d.GRENS.minX && d.SMEDERIJ_X <= d.GRENS.maxX &&
      d.SMEDERIJ_Z >= d.GRENS.minZ && d.SMEDERIJ_Z <= d.GRENS.maxZ,
    puntPositie: { x: d.smederijPunt.positie.x, z: d.smederijPunt.positie.z },
  };
});
check('smederijPunt staat op een vrije plek binnen de GRENS',
  plek.vrij === true && plek.binnenGrens === true, plek);
check('smederijPunt-positie komt overeen met SMEDERIJ_X/Z', plek.puntPositie.x !== undefined, plek);

// --- Kooppad Drukspuit: te weinig geld, dan succesvolle aankoop ----------
const drukspuitKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  d.wapenStaat.gesmeed = false;
  d.wapenStaat.magazijnMax = d.WAPEN_DRUKSPUIT.magazijnMax;
  d.wapenStaat.magazijn = d.WAPEN_DRUKSPUIT.magazijnMax;
  d.spelStaat.geld = 100;
  d.koopSmederij();   // te weinig geld: mag niets doen
  const teWeinig = { gesmeed: d.wapenStaat.gesmeed, geld: d.spelStaat.geld };
  d.spelStaat.geld = 3000;
  d.koopSmederij();   // nu wel genoeg geld
  const na = { gesmeed: d.wapenStaat.gesmeed, magazijnMax: d.wapenStaat.magazijnMax, magazijn: d.wapenStaat.magazijn, geld: d.spelStaat.geld };
  return { teWeinig, na };
});
check('koopSmederij() met te weinig geld doet niets',
  drukspuitKoop.teWeinig.gesmeed === false && drukspuitKoop.teWeinig.geld === 100, drukspuitKoop.teWeinig);
check('Drukspuit smeden: gesmeed=true, magazijn 8->12 (direct volledig bijgevuld), kost €3000',
  drukspuitKoop.na.gesmeed === true && drukspuitKoop.na.magazijnMax === 12 &&
  drukspuitKoop.na.magazijn === 12 && drukspuitKoop.na.geld === 0, drukspuitKoop.na);

// --- Fix 5: koopSmederij() een tweede keer koopt nu niveau 2 i.p.v. een
// pure no-op — met te weinig geld voor het (duurdere) niveau 2 gebeurt er
// nog steeds niets, en het wapen blijft op niveau 1 staan. Het echte
// niveau-2-kooppad zelf staat verderop in dit bestand (Fix 5-sectie).
const tweedeAankoopTeWeinig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 3000;   // genoeg voor niveau 1 (al gekocht), NIET voor niveau 2
  d.koopSmederij();
  return {
    gesmeed: d.wapenStaat.gesmeed, gesmeedNiveau2: d.wapenStaat.gesmeedNiveau2,
    magazijnMax: d.wapenStaat.magazijnMax, geld: d.spelStaat.geld,
  };
});
check('Een tweede koopSmederij()-aanroep met te weinig geld voor niveau 2 verandert niets',
  tweedeAankoopTeWeinig.gesmeed === true && tweedeAankoopTeWeinig.gesmeedNiveau2 === false &&
  tweedeAankoopTeWeinig.magazijnMax === 12 && tweedeAankoopTeWeinig.geld === 3000, tweedeAankoopTeWeinig);

// --- Schade na smeden: Drukspuit bodyshot 2.5, headshot 3.5 (Ticket 11) --
const drukspuitSchade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.schadePerTreffer = 1;
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  const voor = o.hp;
  d.raakOndode(o, o.groep.position, false);
  const schade = voor - o.hp;
  d.doodOndode(o);
  return { schade };
});
check('Gesmede Drukspuit op basisschade 1: bodyshot 2.5', drukspuitSchade.schade === 2.5, drukspuitSchade);

// --- Ratelaar onafhankelijk: smeden van de Drukspuit raakt de Ratelaar niet ---
const ratelaarOnafhankelijk = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('ratelaar');
  return { gesmeed: d.wapenStaat.gesmeed, magazijnMax: d.wapenStaat.magazijnMax };
});
check('Drukspuit smeden verandert de Ratelaar-status/magazijn niet',
  ratelaarOnafhankelijk.gesmeed === false && ratelaarOnafhankelijk.magazijnMax === 16, ratelaarOnafhankelijk);

// --- Kooppad Ratelaar: eigen smeedbeurt, eigen bonus ----------------------
const ratelaarKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 3000;
  d.koopSmederij();   // actief wapen is al 'ratelaar' (zie vorige stap)
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  const voor = o.hp;
  d.raakOndode(o, o.groep.position, false);
  const schade = voor - o.hp;
  d.doodOndode(o);
  return { gesmeed: d.wapenStaat.gesmeed, magazijnMax: d.wapenStaat.magazijnMax, magazijn: d.wapenStaat.magazijn, schade };
});
check('Ratelaar smeden: gesmeed=true, magazijn 16->24, bodyshot-schade 2 (1 + Smederij-bonus 1)',
  ratelaarKoop.gesmeed === true && ratelaarKoop.magazijnMax === 24 && ratelaarKoop.magazijn === 24 &&
  ratelaarKoop.schade === 2, ratelaarKoop);

// --- Drukspuit blijft onafhankelijk gesmeed na dit alles ------------------
const drukspuitBlijftGesmeed = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  const uit = { gesmeed: d.wapenStaat.gesmeed, magazijnMax: d.wapenStaat.magazijnMax };
  // opruimen voor eventuele volgende testruns in dezelfde page
  d.wapenStaat.gesmeed = false;
  d.wapenStaat.magazijnMax = d.WAPEN_DRUKSPUIT.magazijnMax;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  kiesWapen('ratelaar');
  d.wapenStaat.gesmeed = false;
  d.wapenStaat.magazijnMax = d.WAPEN_RATELAAR.magazijnMax;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  kiesWapen('drukspuit');
  d.schadePerTreffer = 1;
  return uit;
});
check('Na het smeden van beide wapens is de Drukspuit nog steeds gesmeed (magazijn 12)',
  drukspuitBlijftGesmeed.gesmeed === true && drukspuitBlijftGesmeed.magazijnMax === 12, drukspuitBlijftGesmeed);

// --- HUD-merkteken: ster bij een gesmeed actief wapen ---------------------
const hudMerkteken = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.gesmeed = true;
  d.updateHUD();
  const metSter = document.getElementById('wapenTekst').textContent;
  d.wapenStaat.gesmeed = false;
  d.updateHUD();
  const zonderSter = document.getElementById('wapenTekst').textContent;
  return { metSter, zonderSter };
});
check('HUD toont een sterretje bij de wapennaam als het actieve wapen gesmeed is',
  hudMerkteken.metSter.includes('★') && !hudMerkteken.zonderSter.includes('★'), hudMerkteken);

// --- Schadeformule bij een verhoogde basisschade (voorheen ontwerpbeslissing
// 13, toen nog bereikbaar via de inmiddels verwijderde globale upgrade): op
// schadePerTreffer 1.5 kost een normale ondode (HP-trap 3 op golf 11-15) 2
// bodyshots — zuivere regressiedekking van de schadeformule, geen
// bewering meer dat 1.5 zonder De Smederij in het echte spel bereikbaar is.
const balansGolf12 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 12;
  d.schadePerTreffer = 1.5;   // verhoogde basisschade, GEEN Smederij
  const o = d.spawnOndode(0, 'normaal');
  const hpBasis = o.hp;
  d.raakOndode(o, o.groep.position, false);
  const naEen = { leeft: d.ondoden.includes(o), hp: o.hp };
  if (naEen.leeft) d.raakOndode(o, o.groep.position, false);
  const naTwee = { leeft: d.ondoden.includes(o) };
  d.schadePerTreffer = 1;
  return { hpBasis, naEen, naTwee };
});
check('Golf 12 (HP-trap 3): op schadePerTreffer 1.5 kost een normale ondode 2 bodyshots (eindige TTK)',
  balansGolf12.hpBasis === 3 && balansGolf12.naEen.leeft === true && balansGolf12.naTwee.leeft === false, balansGolf12);

// =====================================================================
// Ticket 17: Smederij-visuals — per wapen een vooraf gebouwde, onzichtbare
// visual-Group die pas zichtbaar wordt na smeden, plus warmere mondings-
// vlam en een flikker-/rotatiehaakje in de gameLoop.
// =====================================================================

// Opruimen: begin met een schone lei (beide wapens ongesmeed). koopSmederij()
// is bewust eenmalig/onomkeerbaar in het echte spel (geen "ontsmeden"-pad),
// dus dit test-bestand zet de visual-Groups hier expliciet terug via hun
// live object-referenties (eerdere Ticket 11/12-tests in dit bestand hebben
// beide wapens al gesmeed op dezelfde page).
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  d.smederijVisualsDrukspuit.visible = false;
  d.smederijVisualsRatelaar.visible = false;
  for (const naam of ['drukspuit', 'ratelaar']) {
    kiesWapen(naam);
    d.wapenStaat.gesmeed = false;
    d.wapenStaat.magazijnMax = (naam === 'drukspuit' ? d.WAPEN_DRUKSPUIT : d.WAPEN_RATELAAR).magazijnMax;
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  }
  kiesWapen('drukspuit');
  d.schadePerTreffer = 1;
});

const visueelStart = await page.evaluate(() => window.AmsterdamUndeadDebug.smederijVisualsZichtbaar);
check('Vóór smeden zijn beide Smederij-visual-sets onzichtbaar',
  visueelStart.drukspuit === false && visueelStart.ratelaar === false, visueelStart);

// 8-combinaties: wapen (drukspuit/ratelaar) x gesmeed (false/true) x welk
// wapen actief is op het moment van meten (zelfde/ander) — de zichtbaarheid
// van een visual-set hoort uitsluitend van de EIGEN gesmeed-status af te
// hangen, nooit van welk wapen toevallig actief is.
const combos = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  d.spelStaat.geld = 3000;
  d.koopSmederij();   // Drukspuit gesmeed
  const uit = [];
  for (const wapenNaam of ['drukspuit', 'ratelaar']) {
    for (const actiefNaam of ['drukspuit', 'ratelaar']) {
      kiesWapen(actiefNaam);
      const zichtbaar = d.smederijVisualsZichtbaar[wapenNaam];
      const verwachtGesmeed = wapenNaam === 'drukspuit';   // alleen Drukspuit is nu gesmeed
      uit.push({ wapenNaam, actiefNaam, zichtbaar, verwachtGesmeed });
    }
  }
  kiesWapen('ratelaar');
  d.spelStaat.geld = 3000;
  d.koopSmederij();   // Ratelaar ook gesmeed
  for (const wapenNaam of ['drukspuit', 'ratelaar']) {
    for (const actiefNaam of ['drukspuit', 'ratelaar']) {
      kiesWapen(actiefNaam);
      const zichtbaar = d.smederijVisualsZichtbaar[wapenNaam];
      uit.push({ wapenNaam, actiefNaam, zichtbaar, verwachtGesmeed: true });
    }
  }
  kiesWapen('drukspuit');
  return uit;
});
check('8-combinaties (wapen x gesmeed-staat x actief wapen): zichtbaarheid volgt uitsluitend de EIGEN gesmeed-status',
  combos.length === 8 && combos.every(c => c.zichtbaar === c.verwachtGesmeed), combos);

// Wisselen (Q) toont/verbergt via de bestaande group-toggle: beide sets
// blijven .visible=true (per-wapen status), maar alleen de actieve
// wapen-Group (en dus zijn visual-kinderen) is echt zichtbaar in de scene.
const wisselToggle = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  const drukspuitActief = { eigenGroepZichtbaar: d.WAPEN_DRUKSPUIT.groep.visible, ratelaarGroepZichtbaar: d.WAPEN_RATELAAR.groep.visible };
  kiesWapen('ratelaar');
  const ratelaarActief = { eigenGroepZichtbaar: d.WAPEN_RATELAAR.groep.visible, ratelaarNietMeerActief: d.WAPEN_DRUKSPUIT.groep.visible };
  kiesWapen('drukspuit');
  return { drukspuitActief, ratelaarActief };
});
check('Wisselen togglet de wapen-Group (gratis toon/verberg van de visual-kinderen)',
  wisselToggle.drukspuitActief.eigenGroepZichtbaar === true && wisselToggle.drukspuitActief.ratelaarGroepZichtbaar === false &&
  wisselToggle.ratelaarActief.eigenGroepZichtbaar === true && wisselToggle.ratelaarActief.ratelaarNietMeerActief === false, wisselToggle);

// --- HUD-ster en visuele status zijn nooit strijdig -----------------------
const hudVsVisueel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.updateHUD();
  const wapenTekst = document.getElementById('wapenTekst').textContent;
  return { heeftSter: wapenTekst.includes('★'), visueelZichtbaar: d.smederijVisualsZichtbaar.drukspuit };
});
check('HUD-ster en Smederij-visual staan niet los van elkaar (beide gesmeed=true op de actieve Drukspuit)',
  hudVsVisueel.heeftSter === hudVsVisueel.visueelZichtbaar, hudVsVisueel);

// --- Mondingsflits warmer bij een gesmeed wapen; normale kleur ongesmeed --
const vlamKleur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');   // gesmeed (uit de combo-test hierboven)
  d.schiet();
  const gesmeedKleur = d.wapenStaat.definitie.vlamMateriaal.color.getHex();
  const basisKleur = d.wapenStaat.definitie.vlamKleurBasis;
  d.wapenStaat.gesmeed = false;
  d.schiet();
  const ongesmeedKleur = d.wapenStaat.definitie.vlamMateriaal.color.getHex();
  d.wapenStaat.gesmeed = true;   // herstellen voor eventuele volgende checks
  return { gesmeedKleur, basisKleur, ongesmeedKleur };
});
check('Mondingsflits is ember-oranje bij een gesmeed wapen en normaal bij een ongesmeed wapen',
  vlamKleur.gesmeedKleur === 0xff7a1f && vlamKleur.ongesmeedKleur === vlamKleur.basisKleur, vlamKleur);

// --- updateSmederijVisuals(dt): flikker + rotatie doen niets als onzichtbaar ---
const budgetEnFlikker = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Budget-check: max 5 meshes + 1 light per set.
  const telling = (groep) => {
    let meshes = 0, lichten = 0;
    for (const kind of groep.children) { if (kind.isPointLight) lichten++; else meshes++; }
    return { meshes, lichten };
  };
  const budgetDrukspuit = telling(d.smederijVisualsDrukspuit);
  const budgetRatelaar = telling(d.smederijVisualsRatelaar);
  // Rotatie/flikker: geen crash, en de tandwiel-rotatie verandert over tijd.
  const rotatieVoor = d.smederijVisualsRatelaar.children.find(k => !k.isPointLight && k.rotation).rotation.z;
  for (let i = 0; i < 10; i++) d.updateSmederijVisuals(0.1);
  const rotatieNa = d.smederijVisualsRatelaar.children.find(k => !k.isPointLight && k.rotation).rotation.z;
  return { budgetDrukspuit, budgetRatelaar, rotatieVoor, rotatieNa };
});
// Performance-audit (feedback): het ember-lichtje (bereik 0,9m) is uit beide
// sets verwijderd — pixelmeting liet zien dat het niets waarneembaars
// toevoegde bovenop het emissive ringmateriaal (zie ARCHITECTURE_NOTES.md
// §7.9). Budget dus 0 lichten, niet 1.
check('Budget: Drukspuit-visuals ≤ 5 meshes + 0 lichten (ember-licht verwijderd, alleen emissive materiaal)',
  budgetEnFlikker.budgetDrukspuit.meshes <= 5 && budgetEnFlikker.budgetDrukspuit.lichten === 0, budgetEnFlikker.budgetDrukspuit);
check('Budget: Ratelaar-visuals ≤ 5 meshes + 0 lichten (ember-licht verwijderd, alleen emissive materiaal)',
  budgetEnFlikker.budgetRatelaar.meshes <= 5 && budgetEnFlikker.budgetRatelaar.lichten === 0, budgetEnFlikker.budgetRatelaar);
check('updateSmederijVisuals(dt) draait het tandwiel merkbaar door over tijd',
  budgetEnFlikker.rotatieNa !== budgetEnFlikker.rotatieVoor, budgetEnFlikker);

// =====================================================================
// Fix 5: tweede Smederij-niveau (duurder, meer schade) + de per-wapen
// niveau-2-effecten — AMSTEL-9 (kleine ontploffing per schot) en Canal
// Ripper (Doorboring: een tweede, doorboord doel per schot).
// =====================================================================

// Frisse start: beide wapens terug naar hun basisstaat (geen niveau 1/2).
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  for (const naam of ['drukspuit', 'ratelaar']) {
    kiesWapen(naam);
    d.wapenStaat.gesmeed = false;
    d.wapenStaat.gesmeedNiveau2 = false;
    d.wapenStaat.magazijnMax = (naam === 'drukspuit' ? d.WAPEN_DRUKSPUIT : d.WAPEN_RATELAAR).magazijnMax;
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  }
  kiesWapen('drukspuit');
  d.schadePerTreffer = 1;
});

// --- Volledig kooppad (niveau 1 -> niveau 2) op de AMSTEL-9 (Drukspuit) ---
const volledigTraject = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  d.spelStaat.geld = 100000;

  const statusVoor = d.WINKEL_STIJLEN.smederij.status();
  const promptVoor = d.smederijPunt.prompt();

  const geldVoorT1 = d.spelStaat.geld;
  d.koopSmederij();
  const kostT1 = geldVoorT1 - d.spelStaat.geld;
  const statusNaT1 = d.WINKEL_STIJLEN.smederij.status();
  const promptNaT1 = d.smederijPunt.prompt();
  const magazijnNaT1 = d.wapenStaat.magazijnMax;

  const geldVoorT2 = d.spelStaat.geld;
  d.koopSmederij();
  const kostT2 = geldVoorT2 - d.spelStaat.geld;
  const statusNaT2 = d.WINKEL_STIJLEN.smederij.status();
  const promptNaT2 = d.smederijPunt.prompt();
  const magazijnNaT2 = d.wapenStaat.magazijnMax;

  // Derde aanroep: écht een no-op (beide niveaus al gekocht).
  const geldVoorT3 = d.spelStaat.geld;
  d.koopSmederij();
  const geldNaT3 = d.spelStaat.geld;

  d.updateHUD();
  const wapenLabel = document.getElementById('wapenTekst').textContent;

  // Cumulatieve schade: som van beide niveaus, gemeten via raakOndode().
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  d.raakOndode(o, o.groep.position, false);
  const schadeBeideNiveaus = 1000 - o.hp;
  d.doodOndode(o);

  return {
    statusVoor, promptVoor, kostT1, statusNaT1, promptNaT1, magazijnNaT1,
    kostT2, statusNaT2, promptNaT2, magazijnNaT2,
    derdeAanroepNoOp: geldVoorT3 === geldNaT3,
    wapenLabel, schadeBeideNiveaus,
    SMEDERIJ_PRIJS: d.SMEDERIJ_PRIJS, SMEDERIJ2_PRIJS: d.SMEDERIJ2_PRIJS,
    t1Bonus: d.WAPEN_DRUKSPUIT.smederijConfig[0].schadeBonus,
    t2Bonus: d.WAPEN_DRUKSPUIT.smederijConfig[1].schadeBonus,
  };
});
check('Vóór smeden: status "beschikbaar", prompt noemt SMEDERIJ_PRIJS',
  volledigTraject.statusVoor === 'beschikbaar' && volledigTraject.promptVoor.includes(String(volledigTraject.SMEDERIJ_PRIJS)),
  volledigTraject);
check('Niveau 1 kost exact SMEDERIJ_PRIJS', volledigTraject.kostT1 === volledigTraject.SMEDERIJ_PRIJS, volledigTraject);
check('Na niveau 1: status blijft "beschikbaar" (niveau 2 nog te koop), prompt noemt nu SMEDERIJ2_PRIJS',
  volledigTraject.statusNaT1 === 'beschikbaar' && volledigTraject.promptNaT1.includes(String(volledigTraject.SMEDERIJ2_PRIJS)),
  volledigTraject);
check('Niveau 1: magazijnMax naar smederijConfig[0].magazijnMax', volledigTraject.magazijnNaT1 === 12, volledigTraject);
check('Niveau 2 kost exact SMEDERIJ2_PRIJS, en dat is duurder dan niveau 1',
  volledigTraject.kostT2 === volledigTraject.SMEDERIJ2_PRIJS && volledigTraject.SMEDERIJ2_PRIJS > volledigTraject.SMEDERIJ_PRIJS,
  volledigTraject);
check('Na niveau 2: status "gekocht" (volledig gesmeed), prompt zegt dat met zoveel woorden',
  volledigTraject.statusNaT2 === 'gekocht' && volledigTraject.promptNaT2.includes('volledig gesmeed'), volledigTraject);
check('Niveau 2: magazijnMax naar smederijConfig[1].magazijnMax', volledigTraject.magazijnNaT2 === 16, volledigTraject);
check('Een derde koopSmederij()-aanroep is nu wél een echte no-op (beide niveaus al gekocht)',
  volledigTraject.derdeAanroepNoOp, volledigTraject);
check('HUD toont ★★ bij een volledig gesmeed (niveau 2) wapen', volledigTraject.wapenLabel.includes('★★'), volledigTraject);
check('Cumulatieve schadebonus = som van niveau 1 + niveau 2 (niveau 2 is het grootste deel)',
  Math.abs(volledigTraject.schadeBeideNiveaus - (1 + volledigTraject.t1Bonus + volledigTraject.t2Bonus)) < 1e-9 &&
  volledigTraject.t2Bonus > volledigTraject.t1Bonus, volledigTraject);

// --- Ticket 138 (TIERVISUALS.md §4): AMSTEL-9's tier-2-onderdelen zijn ---
// pas zichtbaar NA niveau 2. Vóór T138 was elke `koopSmederij()`-aanroep een
// "alles-of-niets" toggle op de hele Group (zie de test hierboven), waardoor
// tier 2 geen enkel zichtbaar verschil maakte t.o.v. tier 1 — precies het gat
// dat TIERVISUALS.md §1.2/§2 mat (byte-identieke render, 0,000% pixelverschil
// met verborgen HUD). Deze test bewaakt dat drie onderdelen ECHT `userData.tier`
// dragen en dat de zichtbare telling per niveau oploopt: 0 -> 2 -> 5.
const drukspuitTierZichtbaarheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  const groep = d.smederijVisualsDrukspuit;
  const tellenZichtbaar = () => groep.children.filter(k => k.visible).length;

  d.wapenStaat.gesmeed = false;
  d.wapenStaat.gesmeedNiveau2 = false;
  groep.visible = false;
  for (const kind of groep.children) kind.visible = false;
  const bijTier0 = tellenZichtbaar();

  d.spelStaat.geld = 1000000;
  d.koopSmederij();   // niveau 1
  const bijTier1 = tellenZichtbaar();
  const tier2OnderdelenBijTier1 = groep.children.filter(k => k.userData.tier === 2 && k.visible).length;

  d.spelStaat.geld = 1000000;
  d.koopSmederij();   // niveau 2
  const bijTier2 = tellenZichtbaar();

  const tierTelling = { tier1: groep.children.filter(k => k.userData.tier === 1).length,
    tier2: groep.children.filter(k => k.userData.tier === 2).length };

  return { bijTier0, bijTier1, bijTier2, tier2OnderdelenBijTier1, tierTelling, totaalKinderen: groep.children.length };
});
check('AMSTEL-9-tiervisuals: 0 zichtbare onderdelen op tier 0',
  drukspuitTierZichtbaarheid.bijTier0 === 0, drukspuitTierZichtbaarheid);
check('AMSTEL-9-tiervisuals: precies 2 zichtbare onderdelen op tier 1 (de bestaande gloeiringen)',
  drukspuitTierZichtbaarheid.bijTier1 === 2, drukspuitTierZichtbaarheid);
check('AMSTEL-9-tiervisuals: de drie tier-2-onderdelen zijn NOG onzichtbaar zolang alleen tier 1 gekocht is',
  drukspuitTierZichtbaarheid.tier2OnderdelenBijTier1 === 0, drukspuitTierZichtbaarheid);
check('AMSTEL-9-tiervisuals: alle 5 onderdelen zichtbaar op tier 2 (2 bestaand + 3 nieuw)',
  drukspuitTierZichtbaarheid.bijTier2 === 5, drukspuitTierZichtbaarheid);
check('AMSTEL-9-tiervisuals: budget exact op de grens (2 tier-1 + 3 tier-2 = 5, geen zesde)',
  drukspuitTierZichtbaarheid.tierTelling.tier1 === 2 && drukspuitTierZichtbaarheid.tierTelling.tier2 === 3
  && drukspuitTierZichtbaarheid.totaalKinderen === 5, drukspuitTierZichtbaarheid);

// --- Ticket 139 (TIERVISUALS.md §5): spiegelbeeld van de AMSTEL-9-check ----
// hierboven, nu voor de Canal Ripper (hittebandVoor/gloeipen/drijfwerkbout).
const ratelaarTierZichtbaarheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('ratelaar');
  const groep = d.smederijVisualsRatelaar;
  const tellenZichtbaar = () => groep.children.filter(k => k.visible).length;

  d.wapenStaat.gesmeed = false;
  d.wapenStaat.gesmeedNiveau2 = false;
  groep.visible = false;
  for (const kind of groep.children) kind.visible = false;
  const bijTier0 = tellenZichtbaar();

  d.spelStaat.geld = 1000000;
  d.koopSmederij();   // niveau 1
  const bijTier1 = tellenZichtbaar();
  const tier2OnderdelenBijTier1 = groep.children.filter(k => k.userData.tier === 2 && k.visible).length;

  d.spelStaat.geld = 1000000;
  d.koopSmederij();   // niveau 2
  const bijTier2 = tellenZichtbaar();

  const tierTelling = { tier1: groep.children.filter(k => k.userData.tier === 1).length,
    tier2: groep.children.filter(k => k.userData.tier === 2).length };

  return { bijTier0, bijTier1, bijTier2, tier2OnderdelenBijTier1, tierTelling, totaalKinderen: groep.children.length };
});
check('Canal Ripper-tiervisuals: 0 zichtbare onderdelen op tier 0',
  ratelaarTierZichtbaarheid.bijTier0 === 0, ratelaarTierZichtbaarheid);
check('Canal Ripper-tiervisuals: precies 2 zichtbare onderdelen op tier 1 (tandwiel + hitteband)',
  ratelaarTierZichtbaarheid.bijTier1 === 2, ratelaarTierZichtbaarheid);
check('Canal Ripper-tiervisuals: de drie tier-2-onderdelen zijn NOG onzichtbaar zolang alleen tier 1 gekocht is',
  ratelaarTierZichtbaarheid.tier2OnderdelenBijTier1 === 0, ratelaarTierZichtbaarheid);
check('Canal Ripper-tiervisuals: alle 5 onderdelen zichtbaar op tier 2 (2 bestaand + 3 nieuw)',
  ratelaarTierZichtbaarheid.bijTier2 === 5, ratelaarTierZichtbaarheid);
check('Canal Ripper-tiervisuals: budget exact op de grens (2 tier-1 + 3 tier-2 = 5, geen zesde)',
  ratelaarTierZichtbaarheid.tierTelling.tier1 === 2 && ratelaarTierZichtbaarheid.tierTelling.tier2 === 3
  && ratelaarTierZichtbaarheid.totaalKinderen === 5, ratelaarTierZichtbaarheid);

// --- AMSTEL-9 niveau 2: kleine ontploffing beschadigt OMLIGGENDE ondoden --
// (rechtstreeks via schotExplosie(), zoals schiet() 'm ook aanroept — een
// volledige camera-raycast-integratietest staat verderop bij Doorboring.)
const explosieEffect = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(1, 0, 0);   // binnen AMSTEL9_EXPLOSIE_RADIUS van (0,0)
  o.hp = 1000;
  const explosiesVoor = d.explosies.length;
  d.schotExplosie(0, 0, null);   // simuleert een grond-/muur-raakpunt vlak bij `o`
  return {
    schade: 1000 - o.hp, explosiesGespawnd: d.explosies.length - explosiesVoor,
    binnenBereik: Math.hypot(1, 0) <= d.AMSTEL9_EXPLOSIE_RADIUS,
  };
});
check('schotExplosie() beschadigt een nabije ondode die niet rechtstreeks geraakt werd',
  explosieEffect.schade > 0, explosieEffect);
check('schotExplosie() spawnt precies 1 nieuwe visuele flits (explosies-array)', explosieEffect.explosiesGespawnd === 1, explosieEffect);

// --- schiet() roept schotExplosie() alleen aan bij AMSTEL-9 MET niveau 2 --
// (bijstander vlak bij het GERAAKTE doel, binnen AMSTEL9_EXPLOSIE_RADIUS —
// zelfde soort opstelling als schotExplosie() hierboven, nu via schiet()
// zelf, zodat ook de gating-conditie in schiet() meetelt.)
const explosieGating = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('drukspuit');
  d.speler.positie.set(0, 0, 0);
  // pitch=0 (recht vooruit, ooghoogte 1,7) mikt boven de brede lichaams-
  // hitbox (HITBOX_LICHAAM_HOOGTE 1,45, dus tot y=1,45) uit en raakt alleen
  // de kleine kop-hitbox (straal 0,18) — een haarlijn-precieze treffer die
  // soms net mist. -0,3 rad mikt op de rompkern (HITBOX_LICHAAM_WERELD_Y
  // 0,725) en blijft, geverifieerd over 40 losse spawns, elke keer binnen
  // de lichaams-hitbox op zowel 2, 3 als 4m — een veel robuustere treffer.
  d.speler.yaw = 0; d.speler.pitch = -0.3;
  d.cameraKick = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);

  // kiesOndodeTraits() (het default 3e argument van spawnOndode()) loot een
  // WILLEKEURIGE lengte (0,82x-1,18x) en houding (kromme rug, eenarmig...)
  // per ondode — bij een korte/kromme "doel" kan de vaste horizontale
  // schiet()-raycast (yaw=0, pitch=0) zijn hitbox soms net missen. Expliciete,
  // vaste traits maken de rechtstreekse treffer hier deterministisch.
  const VASTE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const doel = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  doel.groep.position.set(0, 0, -3);   // recht voor de loop: rechtstreeks geraakt
  doel.groep.updateMatrixWorld(true);
  const bijstander = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  bijstander.groep.position.set(1, 0, -3);   // binnen AMSTEL9_EXPLOSIE_RADIUS van `doel`, niet zelf op het schotpad
  bijstander.groep.updateMatrixWorld(true);
  doel.hp = 1000; bijstander.hp = 1000;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;

  // Alleen niveau 1: geen explosie, bijstander blijft ongemoeid.
  d.wapenStaat.gesmeedNiveau2 = false;
  d.schiet();
  const hpNaNiveau1 = bijstander.hp;

  // Niveau 2: nu wél een explosie op het raakpunt van `doel`.
  doel.hp = 1000;   // opnieuw vol, zodat schot 2 hem ook weer rechtstreeks raakt
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;
  d.wapenStaat.gesmeedNiveau2 = true;
  d.schiet();
  const hpNaNiveau2 = bijstander.hp;

  return { hpNaNiveau1, hpNaNiveau2, hpVoor: 1000 };
});
check('schiet() met alleen niveau 1: geen ontploffing, de bijstander blijft ongemoeid',
  explosieGating.hpNaNiveau1 === explosieGating.hpVoor, explosieGating);
check('schiet() met niveau 2: de ontploffing raakt de bijstander alsnog',
  explosieGating.hpNaNiveau2 < explosieGating.hpNaNiveau1, explosieGating);

// --- Canal Ripper niveau 2 (Doorboring): een schot door zombie A raakt ook
// een colineaire zombie B erachter, met minder schade dan A. Beide ruim
// binnen de woonkamer (HALF_DIEPTE=5) zodat er geen muur tussen A en B in
// staat — de Doorboring-wandcheck in schiet() moet hier NIET blokkeren. ---
const doorboring = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  if (!d.ratelaarGekocht) d.koopRatelaar();
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  kiesWapen('ratelaar');
  d.wapenStaat.gesmeed = true;
  d.wapenStaat.gesmeedNiveau2 = true;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;
  // Ratelaar heeft een kleine, willekeurige spread (Ticket 34) — voor een
  // deterministische test op een exact colineair doel B tijdelijk op 0.
  const origSpread = d.WAPEN_RATELAAR.spreadNdc;
  d.WAPEN_RATELAAR.spreadNdc = 0;

  // kiesOndodeTraits() (het default 3e argument van spawnOndode()) loot een
  // WILLEKEURIGE lengte (0,82x-1,18x) en houding (kromme rug, eenarmig...)
  // per ondode — bij een korte/kromme A kan de vaste horizontale schiet()-
  // raycast (yaw=0, pitch=0) zijn hitbox soms net missen en in plaats daarvan
  // dieper doorschieten naar B (het EIGENLIJKE doorboringspad, maar dan al
  // vanaf het eerste doel — niet wat deze test wil isoleren). Expliciete,
  // vaste traits + loopFase=0 (willekeurige ledemaat-zwaai, v0.8, "niet
  // synchroon") maken de rechtstreekse treffer op A deterministisch.
  const VASTE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const a = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  const b = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  a.groep.position.set(0, 0, -2);   // rechtstreeks geraakt
  b.groep.position.set(0, 0, -4);   // erachter, op dezelfde lijn (doorboord), nog ruim binnen de kamer
  a.loopFase = 0; b.loopFase = 0;
  a.hp = 1000; b.hp = 1000;
  a.groep.updateMatrixWorld(true); b.groep.updateMatrixWorld(true);

  d.speler.positie.set(0, 0, 0);
  // pitch -0.3: mikt op de brede rompkern i.p.v. de kleine kop-hitbox, zie
  // de toelichting bij de eerste pitch-aanpassing hierboven in dit bestand.
  d.speler.yaw = 0; d.speler.pitch = -0.3;
  d.cameraKick = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);

  d.schiet();
  d.WAPEN_RATELAAR.spreadNdc = origSpread;
  return {
    schadeA: 1000 - a.hp, schadeB: 1000 - b.hp,
    factor: d.RIPPER_DOORBORING_SCHADEFACTOR,
  };
});
check('Doorboring: het rechtstreeks geraakte doel (A) neemt schade',
  doorboring.schadeA > 0, doorboring);
check('Doorboring: het TWEEDE, doorboorde doel (B) neemt ook schade, maar minder dan A',
  doorboring.schadeB > 0 && doorboring.schadeB < doorboring.schadeA, doorboring);
check('Doorboring-schade op B komt overeen met RIPPER_DOORBORING_SCHADEFACTOR (binnen afronding)',
  Math.abs(doorboring.schadeB / doorboring.schadeA - doorboring.factor) < 0.05, doorboring);

// --- Doorboring gebeurt NIET met alleen niveau 1 (geen gesmeedNiveau2) ----
const geenDoorboringNiveau1 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.gesmeedNiveau2 = false;   // terug naar alleen niveau 1
  const origSpread = d.WAPEN_RATELAAR.spreadNdc;
  d.WAPEN_RATELAAR.spreadNdc = 0;

  const VASTE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };
  for (const o of [...d.ondoden]) d.doodOndode(o);
  const a = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  const b = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  a.groep.position.set(0, 0, -2);
  b.groep.position.set(0, 0, -4);
  a.loopFase = 0; b.loopFase = 0;   // deterministische rusthouding, zie hierboven
  a.groep.updateMatrixWorld(true); b.groep.updateMatrixWorld(true);
  a.hp = 1000; b.hp = 1000;

  d.speler.positie.set(0, 0, 0);
  // pitch -0.3: mikt op de brede rompkern i.p.v. de kleine kop-hitbox, zie
  // de toelichting bij de eerste pitch-aanpassing hierboven in dit bestand.
  d.speler.yaw = 0; d.speler.pitch = -0.3;
  d.cameraKick = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.wapenStaat.herladen = false;

  d.schiet();
  d.WAPEN_RATELAAR.spreadNdc = origSpread;
  return { schadeA: 1000 - a.hp, schadeB: 1000 - b.hp };
});
check('Zonder niveau 2 raakt de Canal Ripper alleen doel A, B blijft ongemoeid (geen Doorboring)',
  geenDoorboringNiveau1.schadeA > 0 && geenDoorboringNiveau1.schadeB === 0, geenDoorboringNiveau1);

// Opruimen voor eventuele volgende testruns op dezelfde page.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  for (const naam of ['drukspuit', 'ratelaar']) {
    kiesWapen(naam);
    d.wapenStaat.gesmeed = false;
    d.wapenStaat.gesmeedNiveau2 = false;
  }
  kiesWapen('drukspuit');
});

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
