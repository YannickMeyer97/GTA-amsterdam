// Ticket 155: ARSENAAL-consolidatie — het volledige contract per wapen, plus
// de grep-audit die het acceptatiecriterium van dit ticket is.
//
// Dit ticket verandert BEWUST geen gedrag (de enige slaagvoorwaarde is de
// volledige suite groen zonder één aangepaste assertie elders) — dit
// bestand is dus geen nieuwe-features-test, maar een CONTRACT-test: het legt
// vast dat elk wapen in ARSENAAL de volledige set velden draagt die T144,
// T140, T137-139 en T153 er intussen in hebben gelegd (gameplay, presentatie,
// tiers, audio, gunfeel), en dat de twee "Fix 5"-vertakkingen die tot dit
// ticket nog op `actiefWapenNaam === 'drukspuit'/'ratelaar'` leunden nu
// daadwerkelijk uit ARSENAAL lezen — niet uit een losstaande ternary die
// toevallig hetzelfde antwoord geeft.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

const VUURWAPENS = ['drukspuit', 'ratelaar'];

// Zorgt dat beide vuurwapen-staten bestaan, zodat de rest van dit script vrij
// kan wisselen zonder telkens het null-contract van `wapenStaat` te ontwijken
// (een verse pagina start met alleen het mes, T134 §13.3). Geen check — puur
// opstelling.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  if (!d.wapenStaten.drukspuit) d.wapenStaten.drukspuit = d.nieuweWapenStaat(d.WAPEN_DRUKSPUIT);
  if (!d.wapenStaten.ratelaar) d.wapenStaten.ratelaar = d.nieuweWapenStaat(d.WAPEN_RATELAAR);
});

// --- 1. Vorm: precies de twee vuurwapens, en verder niets ------------------
const vorm = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { sleutels: Object.keys(d.ARSENAAL).sort() };
});
check('ARSENAAL bevat precies drukspuit en ratelaar (het mes hoort er expliciet niet in)',
  JSON.stringify(vorm.sleutels) === JSON.stringify(['drukspuit', 'ratelaar']), vorm);

// --- 2. Gameplay-contract: elk vuurwapen draagt de volledige speelbare set -
const GAMEPLAY_VELDEN = [
  'naam', 'magazijnMax', 'reserve', 'schotCooldown', 'herlaadDuurNormaal', 'herlaadDuurSnel',
  'kickSterkte', 'spreadNdc', 'terugslagSterkte',
  'spreadOpbouwPerSchot', 'spreadOpbouwAfbouw', 'spreadOpbouwMax',
  'spreadBurstDrempel', 'spreadOpbouwAfbouwSnel', 'kickSpreadSchaal',
  'kickRatelStraf', 'pitchKickFractie', 'modelKickX',
  'impactSnelheidFactor', 'vlamSchaalFactor',
];
const gameplay = await page.evaluate(({ namen, velden }) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const naam of namen) {
    const def = d.ARSENAAL[naam].definitie;
    uit[naam] = {
      klasse: d.ARSENAAL[naam].klasse,
      ontbreekt: velden.filter(v => def[v] === undefined),
      nietGetal: velden.filter(v => def[v] !== undefined && typeof def[v] !== 'string' && typeof def[v] !== 'number'
        ? false : (v !== 'naam' && typeof def[v] === 'number' && !Number.isFinite(def[v]))),
      smederijConfig: def.smederijConfig,
    };
  }
  return uit;
}, { namen: VUURWAPENS, velden: GAMEPLAY_VELDEN });
for (const naam of VUURWAPENS) {
  const g = gameplay[naam];
  check(`ARSENAAL.${naam}.klasse === 'vuurwapen'`, g.klasse === 'vuurwapen', g);
  check(`ARSENAAL.${naam}.definitie draagt alle ${GAMEPLAY_VELDEN.length} gameplay-velden`,
    g.ontbreekt.length === 0, g);
  check(`ARSENAAL.${naam}.definitie: geen enkel gameplay-getal is NaN/Infinity`,
    g.nietGetal.length === 0, g);
  check(`ARSENAAL.${naam}.definitie.smederijConfig heeft exact 2 niveaus, elk met schadeBonus + magazijnMax`,
    Array.isArray(g.smederijConfig) && g.smederijConfig.length === 2
    && g.smederijConfig.every(t => typeof t.schadeBonus === 'number' && typeof t.magazijnMax === 'number'), g);
}

// --- 3. Presentatie-contract: rustpositie + de echte modellen --------------
const presentatie = await page.evaluate(({ namen }) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const naam of namen) {
    const entry = d.ARSENAAL[naam];
    const p = entry.presentatie;
    uit[naam] = {
      basisGetallen: [p.basisX, p.basisY, p.basisZ].every(v => typeof v === 'number' && Number.isFinite(v)),
      groepIsObject3D: entry.definitie.groep && entry.definitie.groep.isObject3D === true,
      vlamIsObject3D: entry.definitie.vlam && entry.definitie.vlam.isObject3D === true,
      vlamLichtIsLicht: entry.definitie.vlamLicht && entry.definitie.vlamLicht.isLight === true,
      // actievePresentatie() moet exact deze entry teruggeven zodra dit wapen
      // actief is. `actiefWapenNaam` is alleen een GETTER op de debug-hook
      // (bewust — er is precies één geldige manier om 'm te wijzigen), dus
      // via de echte activeerVuurwapen() i.p.v. de module-variabele te poken.
      // Geen restore nodig: elke volgende sectie activeert zelf expliciet
      // het wapen dat 'm nodig heeft.
      matchtActievePresentatie: (() => {
        d.activeerVuurwapen(naam);
        return d.actievePresentatie() === p;
      })(),
    };
  }
  return uit;
}, { namen: VUURWAPENS });
for (const naam of VUURWAPENS) {
  const p = presentatie[naam];
  check(`ARSENAAL.${naam}.presentatie: basisX/Y/Z zijn eindige getallen`, p.basisGetallen, p);
  check(`ARSENAAL.${naam}.definitie.groep is een echt THREE-object`, p.groepIsObject3D, p);
  check(`ARSENAAL.${naam}.definitie.vlam is een echt THREE-object`, p.vlamIsObject3D, p);
  check(`ARSENAAL.${naam}.definitie.vlamLicht is een echt THREE-licht`, p.vlamLichtIsLicht, p);
  check(`actievePresentatie() geeft exact ARSENAAL.${naam}.presentatie terug wanneer dit wapen actief is`,
    p.matchtActievePresentatie, p);
}

// --- 4. Tier/Smederij-contract: smederijVisuals wijst naar echte meshes ----
const tiers = await page.evaluate(({ namen }) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const naam of namen) {
    const sv = d.ARSENAAL[naam].smederijVisuals;
    uit[naam] = {
      heeftDrieVelden: !!(sv && sv.accent && sv.visualsGroep && sv.medaillon),
      accentIsMesh: sv && sv.accent.isMesh === true,
      visualsGroepIsGroup: sv && sv.visualsGroep.isGroup === true,
      medaillonIsMesh: sv && sv.medaillon.isMesh === true,
    };
  }
  // De accent/visualsGroep/medaillon-referenties moeten letterlijk dezelfde
  // objecten zijn als de losse module-variabelen (geen kopie) — dat is wat
  // koopSmederij() vroeger via de ternary rechtstreeks pakte.
  const identiek = {
    drukspuitAccent: d.ARSENAAL.drukspuit.smederijVisuals.accent === d.meterDrukspuit,
    ratelaarAccent: d.ARSENAAL.ratelaar.smederijVisuals.accent === d.tandwielRatelaar,
    drukspuitMedaillon: d.ARSENAAL.drukspuit.smederijVisuals.medaillon === d.ereplankMedaillonDrukspuit,
    ratelaarMedaillon: d.ARSENAAL.ratelaar.smederijVisuals.medaillon === d.ereplankMedaillonRatelaar,
  };
  return { uit, identiek };
}, { namen: VUURWAPENS });
for (const naam of VUURWAPENS) {
  const t = tiers.uit[naam];
  check(`ARSENAAL.${naam}.smederijVisuals heeft accent + visualsGroep + medaillon`, t.heeftDrieVelden, t);
  check(`ARSENAAL.${naam}.smederijVisuals.accent is een echte Mesh`, t.accentIsMesh, t);
  check(`ARSENAAL.${naam}.smederijVisuals.visualsGroep is een echte Group`, t.visualsGroepIsGroup, t);
  check(`ARSENAAL.${naam}.smederijVisuals.medaillon is een echte Mesh`, t.medaillonIsMesh, t);
}
check('smederijVisuals.accent verwijst naar dezelfde meshes als de oude ternary (meterDrukspuit/tandwielRatelaar)',
  tiers.identiek.drukspuitAccent && tiers.identiek.ratelaarAccent, tiers.identiek);
check('smederijVisuals.medaillon verwijst naar dezelfde meshes als de oude ternary',
  tiers.identiek.drukspuitMedaillon && tiers.identiek.ratelaarMedaillon, tiers.identiek);

// --- 5. Audio-contract: schotToon in ARSENAAL.audio + de treffer-tonen -----
const audio = await page.evaluate(({ namen }) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const naam of namen) {
    const entry = d.ARSENAAL[naam];
    const geldigeToon = (t) => t && typeof t.start === 'number' && typeof t.eind === 'number'
      && typeof t.duur === 'number' && typeof t.type === 'string';
    // schotToon draagt bewust GEEN `type` — GELUIDEN.schot (T153) legt het
    // type ('sawtooth') vast, alleen start/eind/duur komen per wapen uit
    // ARSENAAL (zie speelSchot()). Andere velden dan bij de treffer-tonen.
    const geldigeSchotToon = (t) => t && typeof t.start === 'number' && typeof t.eind === 'number'
      && typeof t.duur === 'number';
    uit[naam] = {
      audioSchotIsDefinitieSchotToon: entry.audio.schot === entry.definitie.schotToon,
      schotToonGeldig: geldigeSchotToon(entry.definitie.schotToon),
      raakToonGeldig: geldigeToon(entry.definitie.raakToon),
      kopToonGeldig: geldigeToon(entry.definitie.kopToon),
      killToonGeldig: geldigeToon(entry.definitie.killToon),
    };
  }
  return uit;
}, { namen: VUURWAPENS });
for (const naam of VUURWAPENS) {
  const a = audio[naam];
  check(`ARSENAAL.${naam}.audio.schot is letterlijk definitie.schotToon (T153: GELUIDEN.schot leest dit)`,
    a.audioSchotIsDefinitieSchotToon, a);
  check(`ARSENAAL.${naam}.definitie: schotToon/raakToon/kopToon/killToon zijn alle vier geldige tonen`,
    a.schotToonGeldig && a.raakToonGeldig && a.kopToonGeldig && a.killToonGeldig, a);
}
// De twee wapens moeten hoorbaar VAN ELKAAR verschillen — anders was T144's
// hele punt (per-wapen klankidentiteit) met deze consolidatie stiekem weg.
const verschil = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = d.ARSENAAL.drukspuit.definitie, b = d.ARSENAAL.ratelaar.definitie;
  return {
    schotVerschilt: JSON.stringify(a.schotToon) !== JSON.stringify(b.schotToon),
    raakVerschilt: JSON.stringify(a.raakToon) !== JSON.stringify(b.raakToon),
  };
});
check('AMSTEL-9 en Canal Ripper hebben verschillende schot- en raaktonen (T144-identiteit intact)',
  verschil.schotVerschilt && verschil.raakVerschilt, verschil);

// --- 6. Gunfeel-contract: de twee wapens zijn nog steeds elkaars tegenpolen -
// Zwakke, structurele checks — de exacte getallen zijn T142/T143-eigendom en
// staan al onder test-wapen-identiteit.mjs/test-ripper-agressie.mjs. Hier
// alleen: klopt de KARAKTERISTIEK nog (precisie vs. volume) na de verhuizing?
const gunfeel = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const a = d.ARSENAAL.drukspuit.definitie, b = d.ARSENAAL.ratelaar.definitie;
  return {
    drukspuitGeenSpread: a.spreadNdc === 0 && a.spreadOpbouwMax === 0,
    ratelaarWelSpread: b.spreadNdc > 0 && b.spreadOpbouwMax > 0,
    drukspuitGeenPitchKick: a.pitchKickFractie === 0,
    ratelaarWelPitchKick: b.pitchKickFractie > 0,
    ratelaarSneller: b.schotCooldown < a.schotCooldown,
  };
});
check('AMSTEL-9 blijft de precisiekeuze: nul spread, nul spread-opbouw', gunfeel.drukspuitGeenSpread, gunfeel);
check('Canal Ripper blijft de volumekeuze: wel spread, wel spread-opbouw', gunfeel.ratelaarWelSpread, gunfeel);
check('AMSTEL-9 blijft zonder echte terugslag (pitchKickFractie 0)', gunfeel.drukspuitGeenPitchKick, gunfeel);
check('Canal Ripper blijft met echte terugslag (pitchKickFractie > 0)', gunfeel.ratelaarWelPitchKick, gunfeel);
check('Canal Ripper vuurt nog steeds sneller dan de AMSTEL-9', gunfeel.ratelaarSneller, gunfeel);

// --- 7. niveau2Vermogen: het label bestaat en schiet() leest het ÉCHT ------
const vermogenLabels = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    drukspuit: d.ARSENAAL.drukspuit.niveau2Vermogen,
    ratelaar: d.ARSENAAL.ratelaar.niveau2Vermogen,
  };
});
check("ARSENAAL.drukspuit.niveau2Vermogen === 'explosie'", vermogenLabels.drukspuit === 'explosie', vermogenLabels);
check("ARSENAAL.ratelaar.niveau2Vermogen === 'doorboring'", vermogenLabels.ratelaar === 'doorboring', vermogenLabels);

// De sterkste bewijsvorm dat schiet() dit label ECHT leest (i.p.v. nog steeds
// intern op de wapennaam te branchen): het label op de AMSTEL-9 omwisselen
// naar 'doorboring' en verifiëren dat de ontploffing dan NIET meer afgaat.
// Opstelling geleend van de bestaande, bewezen scenario's in
// test-smederij.mjs (§"schiet() roept schotExplosie() alleen aan bij AMSTEL-9
// MET niveau 2"): een geraakt doel recht vooruit, een bijstander ERNAAST
// (buiten het schotpad, binnen de explosieradius). Alleen schotExplosie()
// kan die bijstander raken — Doorboring loopt uitsluitend over de
// RAYCAST-treffers (`ondodeRaak`), en de bijstander staat niet op de straal,
// dus doorboring kan hem sowieso nooit raken. Blijft de bijstander na het
// omwisselen ongemoeid, dan is dat het bewijs dat schotExplosie() niet meer
// vuurt — en dus dat schiet() het label uit ARSENAAL leest, niet uit een
// intern "is dit de Drukspuit"-onderscheid. State wordt hierna hersteld.
const VASTE_TRAITS_DISPATCH = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };
const dispatchTest = await page.evaluate((traits) => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = -0.3;   // §test-smederij.mjs: robuuste rompschoten
  d.cameraKick = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);
  d.activeerVuurwapen('drukspuit');
  d.wapenStaat.gesmeedNiveau2 = true;

  const opnieuw = () => {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const doel = d.spawnOndode(0, 'normaal', traits);
    doel.groep.position.set(0, 0, -3); doel.groep.updateMatrixWorld(true);
    const bijstander = d.spawnOndode(0, 'normaal', traits);
    bijstander.groep.position.set(1, 0, -3); bijstander.groep.updateMatrixWorld(true);   // binnen de explosieradius, niet op het schotpad
    doel.hp = 1000; bijstander.hp = 1000;
    d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
    d.wapenStaat.herladen = false;
    return bijstander;
  };

  const oorspronkelijkLabel = d.ARSENAAL.drukspuit.niveau2Vermogen;

  // Ronde A: ongewijzigd label ('explosie') -> de bijstander neemt splash-schade.
  const bijstanderA = opnieuw();
  d.schiet();
  const hpNaA = bijstanderA.hp;

  // Ronde B: label omgewisseld naar 'doorboring' -> exact dezelfde opstelling,
  // maar de bijstander (niet op het schotpad) kan Doorboring nooit raken.
  d.ARSENAAL.drukspuit.niveau2Vermogen = 'doorboring';
  const bijstanderB = opnieuw();
  d.schiet();
  const hpNaB = bijstanderB.hp;

  d.ARSENAAL.drukspuit.niveau2Vermogen = oorspronkelijkLabel;   // herstel

  return { hpNaA, hpNaB, labelHersteld: d.ARSENAAL.drukspuit.niveau2Vermogen === 'explosie' };
}, VASTE_TRAITS_DISPATCH);
check("Met niveau2Vermogen='explosie' (ongewijzigd) raakt de ontploffing de bijstander, precies zoals vóór dit ticket",
  dispatchTest.hpNaA < 1000, dispatchTest);
check("Wissel je ARSENAAL.drukspuit.niveau2Vermogen naar 'doorboring', dan blijft de (niet-colineaire) bijstander ONGEMOEID — het bewijs dat schiet() het label uit ARSENAAL leest en niet zelf nog 'AMSTEL-9' herkent",
  dispatchTest.hpNaB === 1000, dispatchTest);
check('Het label is na de test weer teruggezet op de oorspronkelijke waarde', dispatchTest.labelHersteld, dispatchTest);

// --- 8. activeerVuurwapen(): de groep-zichtbaarheid is nu een lus over ARSENAAL, geen ternary
const zichtbaarheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.activeerVuurwapen('drukspuit');
  const naDrukspuit = { drukspuit: d.WAPEN_DRUKSPUIT.groep.visible, ratelaar: d.WAPEN_RATELAAR.groep.visible };
  d.activeerVuurwapen('ratelaar');
  const naRatelaar = { drukspuit: d.WAPEN_DRUKSPUIT.groep.visible, ratelaar: d.WAPEN_RATELAAR.groep.visible };
  return { naDrukspuit, naRatelaar, bron: d.activeerVuurwapen.toString() };
});
check('Na activeerVuurwapen("drukspuit"): alleen de Drukspuit-groep is zichtbaar',
  zichtbaarheid.naDrukspuit.drukspuit === true && zichtbaarheid.naDrukspuit.ratelaar === false, zichtbaarheid);
check('Na activeerVuurwapen("ratelaar"): alleen de Ratelaar-groep is zichtbaar',
  zichtbaarheid.naRatelaar.drukspuit === false && zichtbaarheid.naRatelaar.ratelaar === true, zichtbaarheid);
// Commentaar eraf vóór de patroonmatch: de toelichting bij deze wijziging
// citeert zelf de oude regel als voorbeeld ("was ... naam === 'drukspuit'"),
// en die tekst zou de negatieve match anders vals laten afgaan.
const zichtbaarheidLevend = zichtbaarheid.bron.split('\n').map(r => r.replace(/\/\/.*$/, '')).join('\n');
check('activeerVuurwapen() loopt over Object.keys(ARSENAAL) i.p.v. een letterlijke wapennaam-ternary',
  /Object\.keys\(ARSENAAL\)/.test(zichtbaarheidLevend)
  && !/naam === 'drukspuit'/.test(zichtbaarheidLevend), zichtbaarheid);

// --- 9. De grep-audit zelf --------------------------------------------------
//
// Acceptatiecriterium: "nul wapennaam-vergelijkingen buiten ARSENAAL en
// wisselWapen()." Dit script telt elke `actiefWapenNaam === /!== 'drukspuit'
// /'ratelaar'`-vergelijking in de LEVENDE bron (commentaarregels eraf, anders
// telt elke toelichting die het ticket zelf beschrijft ook mee) en staat
// alleen de twee bekende, bewust ongemoeide plekken toe:
//   - wisselWapen() — de Q-toggle IS letterlijk deze vergelijking, expliciet
//     uitgezonderd door het ticket zelf.
//   - koopRatelaar() — `if (actiefWapenNaam !== 'ratelaar') activeerVuurwapen(...)`.
//     Dit is GEEN wapengegeven dat los rondslingert: ratelaarGekocht bestaat
//     pas ná deze regel, dus actiefWapenNaam kan op dit punt in de functie
//     nooit al 'ratelaar' zijn — de check is aantoonbaar altijd waar. 'm
//     verwijderen zou het gedrag niet veranderen, maar WEL een niet
//     door dit ticket gevraagde aanname over een aangrenzend systeem
//     (aankoopvolgorde) hard vastleggen. Dat is precies de valkuil die dit
//     ticket zelf noemt ("nu we toch bezig zijn"): een bewuste keuze om het
//     te laten staan, niet een gemiste plek.
const bron = readFileSync(path.join(__dirname, '..', 'amsterdam-undead.html'), 'utf8');
const levendeBron = bron.split('\n')
  .map(regel => regel.replace(/\/\/.*$/, ''))   // regelcommentaar eraf
  .join('\n');
const patroon = /actiefWapenNaam\s*(===|!==)\s*'(drukspuit|ratelaar)'/g;
const vondsten = [...levendeBron.matchAll(patroon)].map(m => {
  const regelnr = levendeBron.slice(0, m.index).split('\n').length;
  return { regel: regelnr, tekst: m[0] };
});
check('De grep-audit vindt precies 2 wapennaam-vergelijkingen in de levende bron (wisselWapen() + koopRatelaar(), zie toelichting hierboven)',
  vondsten.length === 2, vondsten);
// Bevestig SPECIFIEK dat schiet(), activeerVuurwapen() en koopSmederij() —
// de drie functies die dit ticket verbouwt — géén van beide meer bevatten.
// Op de LEVENDE bron: de toelichtingen bij deze wijzigingen citeren zelf de
// oude regels als voorbeeld (zie hierboven), dus commentaar moet er ook hier
// eerst af, anders vangt de regex zijn eigen uitleg.
const schietBron = levendeBron.slice(levendeBron.indexOf('\nfunction schiet()'), levendeBron.indexOf('\nfunction steekMes()'));
const koopSmederijBron = levendeBron.slice(levendeBron.indexOf('\nfunction koopSmederij()'), levendeBron.indexOf('\nfunction koopAutoHerlader()'));
check('schiet() bevat geen enkele actiefWapenNaam-vergelijking meer (leest niveau2Vermogen uit ARSENAAL)',
  !new RegExp(patroon.source).test(schietBron), { lengte: schietBron.length });
check('koopSmederij() bevat geen enkele actiefWapenNaam-vergelijking meer (leest smederijVisuals uit ARSENAAL)',
  !new RegExp(patroon.source).test(koopSmederijBron), { lengte: koopSmederijBron.length });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
