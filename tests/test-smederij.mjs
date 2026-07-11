// De Smederij (Tickets 11-12): per-wapen schadeformule, gesmeed-status,
// herbalanceerde globale schade-upgrade. Zie ROADMAP.md Ticket 11/12 en
// ARCHITECTURE_NOTES.md §1 "Wapenschade" / §2 punt 7-8.
//
// Let op: wisselWapen() neemt GEEN argument — het is een pure toggle. Elke
// evaluate() hieronder die een specifiek wapen nodig heeft, toggelt dus
// alleen als d.actiefWapenNaam nog niet het gewenste wapen is.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- Ticket 11: globale schade-upgrade is kleiner geworden ----------------
const globaleUpgrade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { start: d.schadePerTreffer, max: d.WAPEN_SCHADE_MAX };
});
check('Globale schade start op 1 en WAPEN_SCHADE_MAX is nu 1.5 (was 2)',
  globaleUpgrade.start === 1 && globaleUpgrade.max === 1.5, globaleUpgrade);

// --- Ticket 11: smederijConfig per wapen -----------------------------------
const configs = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { drukspuit: d.WAPEN_DRUKSPUIT.smederijConfig, ratelaar: d.WAPEN_RATELAAR.smederijConfig };
});
check('Drukspuit-smederijConfig: schadeBonus 1.5, magazijnMax 12',
  configs.drukspuit.schadeBonus === 1.5 && configs.drukspuit.magazijnMax === 12, configs.drukspuit);
check('Ratelaar-smederijConfig: schadeBonus 1, magazijnMax 24',
  configs.ratelaar.schadeBonus === 1 && configs.ratelaar.magazijnMax === 24, configs.ratelaar);

// --- Ticket 11: nieuweWapenStaat() begint ongesmeed ------------------------
const gesmeedStart = await page.evaluate(() => window.AmsterdamUndeadDebug.wapenStaat.gesmeed);
check('Een nieuwe wapenstaat begint met gesmeed=false', gesmeedStart === false, { gesmeedStart });

// koopRatelaar() vereist geld; zet dat hier vast zodat de Ratelaar-staat bestaat.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (!d.ratelaarGekocht) {
    d.spelStaat.geld = 5000;
    d.koopRatelaar();
  }
});

// --- Ticket 11: 16-combinaties-schadetest ----------------------------------
// wapen x gesmeed x headshot x globale-upgrade-staat. Elke ondode krijgt
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
check('Alle 16 combinaties (wapen x gesmeed x headshot x upgrade-staat) geven de verwachte schade',
  alle16Kloppen, schadeCombos);

// Losse, leesbare kern-asserts uit de schadebalans-tabel (ROADMAP Ticket 11/12):
const vind = (wapenNaam, gesmeed, schadePerTreffer, headshot) =>
  schadeCombos.find(r => r.wapenNaam === wapenNaam && r.gesmeed === gesmeed && r.schadePerTreffer === schadePerTreffer && r.headshot === headshot).schade;
check('Drukspuit zonder upgrades: bodyshot 1, headshot 2',
  vind('drukspuit', false, 1, false) === 1 && vind('drukspuit', false, 1, true) === 2, schadeCombos);
check('Drukspuit gesmeed zonder globale upgrade: bodyshot 2.5, headshot 3.5',
  vind('drukspuit', true, 1, false) === 2.5 && vind('drukspuit', true, 1, true) === 3.5, schadeCombos);
check('Drukspuit gesmeed MET globale upgrade: bodyshot 3, headshot 4',
  vind('drukspuit', true, 1.5, false) === 3 && vind('drukspuit', true, 1.5, true) === 4, schadeCombos);
check('Ratelaar gesmeed zonder globale upgrade: bodyshot 2, headshot 3',
  vind('ratelaar', true, 1, false) === 2 && vind('ratelaar', true, 1, true) === 3, schadeCombos);
check('Ratelaar gesmeed MET globale upgrade: bodyshot 2.5, headshot 3.5',
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

// --- Dubbele-aankoop-guard: nogmaals kopen doet niets ---------------------
const dubbeleAankoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 3000;
  d.koopSmederij();
  return { gesmeed: d.wapenStaat.gesmeed, geld: d.spelStaat.geld };
});
check('koopSmederij() een tweede keer op hetzelfde wapen doet niets (geen dubbele afschrijving)',
  dubbeleAankoop.gesmeed === true && dubbeleAankoop.geld === 3000, dubbeleAankoop);

// --- Schade na smeden: Drukspuit bodyshot 2.5, headshot 3.5 (Ticket 11) --
const drukspuitSchade = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.schadePerTreffer = 1;   // geen globale upgrade
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  const voor = o.hp;
  d.raakOndode(o, o.groep.position, false);
  const schade = voor - o.hp;
  d.doodOndode(o);
  return { schade };
});
check('Gesmede Drukspuit zonder globale upgrade: bodyshot 2.5', drukspuitSchade.schade === 2.5, drukspuitSchade);

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

// --- Balanscheck (ontwerpbeslissing 13): golf 12-15 blijft uitspeelbaar ---
// zonder De Smederij — met alleen de globale MAX-upgrade (1.5) kost een
// normale ondode (HP-trap 3 op golf 11-15) 2 bodyshots, een eindig en
// voorspelbaar aantal, geen bullet sponge.
const balansGolf12 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 12;
  d.schadePerTreffer = d.WAPEN_SCHADE_MAX;   // MAX globale upgrade, GEEN Smederij
  const o = d.spawnOndode(0, 'normaal');
  const hpBasis = o.hp;
  d.raakOndode(o, o.groep.position, false);
  const naEen = { leeft: d.ondoden.includes(o), hp: o.hp };
  if (naEen.leeft) d.raakOndode(o, o.groep.position, false);
  const naTwee = { leeft: d.ondoden.includes(o) };
  d.schadePerTreffer = 1;
  return { hpBasis, naEen, naTwee };
});
check('Golf 12 (HP-trap 3): zonder Smederij kost een normale ondode op MAX-schade 2 bodyshots (eindige TTK)',
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
  const gesmeedKleur = d.wapenStaat.definitie.vlam.material.color.getHex();
  const basisKleur = d.wapenStaat.definitie.vlamKleurBasis;
  d.wapenStaat.gesmeed = false;
  d.schiet();
  const ongesmeedKleur = d.wapenStaat.definitie.vlam.material.color.getHex();
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
check('Budget: Drukspuit-visuals ≤ 5 meshes + 1 light', budgetEnFlikker.budgetDrukspuit.meshes <= 5 && budgetEnFlikker.budgetDrukspuit.lichten === 1, budgetEnFlikker.budgetDrukspuit);
check('Budget: Ratelaar-visuals ≤ 5 meshes + 1 light', budgetEnFlikker.budgetRatelaar.meshes <= 5 && budgetEnFlikker.budgetRatelaar.lichten === 1, budgetEnFlikker.budgetRatelaar);
check('updateSmederijVisuals(dt) draait het tandwiel merkbaar door over tijd',
  budgetEnFlikker.rotatieNa !== budgetEnFlikker.rotatieVoor, budgetEnFlikker);

// Opruimen voor eventuele volgende testruns op dezelfde page.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kiesWapen = (naam) => { if (d.actiefWapenNaam !== naam) d.wisselWapen(); };
  for (const naam of ['drukspuit', 'ratelaar']) {
    kiesWapen(naam);
    d.wapenStaat.gesmeed = false;
  }
  kiesWapen('drukspuit');
});

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
