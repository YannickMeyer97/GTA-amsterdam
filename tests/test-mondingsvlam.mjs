// Ticket 90 (v0.22, §10.6-beslissing 81): de mondingsvlam wordt een
// lichtmoment. `vlamLichtDrukspuit`/`vlamLichtRatelaar` gaan van 1,1/1,6
// naar Signaal-niveau (§10.5, 15-25) voor VLAM_FLITS_DUUR (~1-2 frames
// @ 60fps) per schot — een BESTAAND licht dat harder aangaat, geen nieuw
// licht (het lichtaantal blijft 28). De vlamgeometrie wisselt van een bol
// naar twee gekruiste, met een canvas-getekende stervorm gemapte vlakken
// (bouwMondingsVlam()), per schot willekeurig geroteerd/geschaald.
//
// De kern van dit ticket is een stroboscoop-risico bij de Ratelaar
// (automatisch vuur, schotCooldown 0.1s): de flitsduur moet daar ruim
// onder blijven en NOOIT meeschalen met vuursnelheid, anders wordt
// aanhoudend vuur verblindend op precies het moment dat de speler het
// meest moet zien (§10.6, "Let op").
import { openAmsterdamUndead, makeChecker, frames, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();
// Ticket 134 (§12.8): dit bestand test de mondingsvlam via ECHTE schiet()-
// aanroepen, niet het wapensysteem zelf — de speler start sinds T134 met
// een mes, dus eerst een geladen vuurwapen (AMSTEL-9) toekennen.
await geefSpelerVuurwapen(page);

// --- 1. Structuur: vlam is een Group van twee gekruiste vlakken op één
// gedeeld materiaal (geen losse .material meer op vlam zelf) -------------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const info = (def) => ({
    kinderen: def.vlam.children.length,
    geometrieTypes: def.vlam.children.map(c => c.geometry.type),
    zelfdeMateriaal: def.vlam.children.every(c => c.material === def.vlamMateriaal),
    isMesh: def.vlam.isMesh === true,
    heeftEigenMaterialProp: 'material' in def.vlam && def.vlam.material !== undefined,
  });
  return { drukspuit: info(d.WAPEN_DRUKSPUIT), ratelaar: info(d.WAPEN_RATELAAR) };
});
check('Drukspuit-vlam: Group van precies 2 vlakken (PlaneGeometry) op één gedeeld materiaal',
  structuur.drukspuit.kinderen === 2 &&
  structuur.drukspuit.geometrieTypes.every(t => t === 'PlaneGeometry') &&
  structuur.drukspuit.zelfdeMateriaal, structuur.drukspuit);
check('Ratelaar-vlam: zelfde structuur als de Drukspuit',
  structuur.ratelaar.kinderen === 2 &&
  structuur.ratelaar.geometrieTypes.every(t => t === 'PlaneGeometry') &&
  structuur.ratelaar.zelfdeMateriaal, structuur.ratelaar);
check('vlam is GEEN Mesh meer (dus geen eigen .material) — dat zat de oude bolgeometrie in de weg',
  structuur.drukspuit.isMesh === false && structuur.ratelaar.isMesh === false, structuur);

// --- 2. Kerntijdscontract: flitsduur ruim onder het kortste vuurinterval -
const tijden = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    VLAM_FLITS_DUUR: d.VLAM_FLITS_DUUR,
    ratelaarCooldown: d.WAPEN_RATELAAR.schotCooldown,
    drukspuitCooldown: d.WAPEN_DRUKSPUIT.schotCooldown,
  };
});
check('VLAM_FLITS_DUUR is korter dan WAPEN_RATELAAR.schotCooldown (het kortste vuurinterval)',
  tijden.VLAM_FLITS_DUUR < tijden.ratelaarCooldown, tijden);
check('VLAM_FLITS_DUUR komt overeen met 1-2 frames @ 60fps (orde 0,017-0,033s)',
  tijden.VLAM_FLITS_DUUR > 0 && tijden.VLAM_FLITS_DUUR <= 0.034, tijden);

// --- 3. Eén schot met de Drukspuit: intensiteit op Signaal-niveau --------
const eenSchot = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 3);
  d.speler.yaw = 0;
  d.updateSpeler(0);
  d.schiet();
  const { vlam, vlamLicht } = d.WAPEN_DRUKSPUIT;
  return {
    vlamVisible: vlam.visible, vlamLichtVisible: vlamLicht.visible,
    intensiteit: vlamLicht.intensity, vlamTimer: d.vlamTimer,
    kleur: d.WAPEN_DRUKSPUIT.vlamMateriaal.color.getHexString(),
  };
});
check('Na één schot (Drukspuit): vlam + vlamLicht zichtbaar',
  eenSchot.vlamVisible && eenSchot.vlamLichtVisible, eenSchot);
check('Na één schot (Drukspuit): intensiteit op Signaal-niveau (15-25)',
  eenSchot.intensiteit >= 15 && eenSchot.intensiteit <= 25, eenSchot);
check('Na één schot: vlamTimer staat exact op VLAM_FLITS_DUUR',
  eenSchot.vlamTimer === tijden.VLAM_FLITS_DUUR, { eenSchot, tijden });

// --- 4. visible valt netjes terug na de flitsduur -------------------------
// Echte rAF-ticks + een ruime marge (VLAM_FLITS_DUUR is ~33ms; 20 frames
// @ 60fps is ruim 300ms, dus geen wall-clock-race met de headless-omgeving).
await frames(page, 20);
const naAfloop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const { vlam, vlamLicht } = d.WAPEN_DRUKSPUIT;
  return { vlamVisible: vlam.visible, vlamLichtVisible: vlamLicht.visible, vlamTimer: d.vlamTimer };
});
check('20 frames later: vlam + vlamLicht weer onzichtbaar (visible valt netjes terug)',
  naAfloop.vlamVisible === false && naAfloop.vlamLichtVisible === false, naAfloop);
check('20 frames later: vlamTimer is 0 (of lager, vóór de clamp in gameLoop)',
  naAfloop.vlamTimer <= 0, naAfloop);

// --- 5. Geen stapeling: twee schoten vlak na elkaar --------------------
// Architecturaal kan dit niet stapelen (één hergebruikt object per wapen,
// geen pool die per schot een nieuwe mesh/licht spawnt) — dit bewijst dat
// expliciet: object-identiteit blijft gelijk, en de intensiteit na het
// TWEEDE schot is exact gelijk aan na het eerste (nooit vermenigvuldigd).
const stapelTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const { vlam, vlamLicht } = d.WAPEN_DRUKSPUIT;
  const vlamVoor = vlam, vlamLichtVoor = vlamLicht;
  d.schiet();
  const intensiteit1 = vlamLicht.intensity;
  const timer1 = d.vlamTimer;
  d.schiet();   // meteen nog een keer, ruim binnen VLAM_FLITS_DUUR
  const intensiteit2 = vlamLicht.intensity;
  const timer2 = d.vlamTimer;
  return {
    zelfdeVlamObject: vlam === vlamVoor, zelfdeVlamLichtObject: vlamLicht === vlamLichtVoor,
    intensiteit1, intensiteit2, timer1, timer2,
    aantalLichtenOpWapen: d.WAPEN_DRUKSPUIT.groep.children.filter(c => c.isLight).length,
  };
});
check('Twee snelle schoten: hetzelfde vlam/vlamLicht-object (geen pool, dus stapelen is structureel onmogelijk)',
  stapelTest.zelfdeVlamObject && stapelTest.zelfdeVlamLichtObject, stapelTest);
check('Twee snelle schoten: intensiteit blijft exact gelijk (niet verdubbeld/opgeteld)',
  stapelTest.intensiteit1 === stapelTest.intensiteit2, stapelTest);
check('Twee snelle schoten: vlamTimer wordt gereset, niet opgeteld (blijft op VLAM_FLITS_DUUR, niet 2x)',
  stapelTest.timer1 === tijden.VLAM_FLITS_DUUR && stapelTest.timer2 === tijden.VLAM_FLITS_DUUR, { stapelTest, tijden });
check('Precies 1 PointLight aan het Drukspuit-model (vlamLicht) — geen tweede licht gespawnd',
  stapelTest.aantalLichtenOpWapen === 1, stapelTest);

// --- 6. De piek schaalt NIET mee met vuursnelheid -------------------------
// Zelfde VLAM_FLITS_DUUR en dezelfde intensiteitsformule voor beide
// wapens, ongeacht hun (sterk verschillende) schotCooldown.
const geenSchaling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 99999;
  d.koopRatelaar();   // schakelt zelf al naar de Ratelaar (was drukspuit) — GEEN extra wisselWapen() hier, dat zou weer terugtoggelen
  return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
    d.schiet();
    res({
      intensiteit: d.WAPEN_RATELAAR.vlamLicht.intensity,
      vlamTimer: d.vlamTimer,
      ratelaarCooldown: d.WAPEN_RATELAAR.schotCooldown,
      drukspuitCooldown: d.WAPEN_DRUKSPUIT.schotCooldown,
    });
  })));
});
check('Ratelaar (10x sneller vuurinterval dan Drukspuit) gebruikt exact dezelfde VLAM_FLITS_DUUR',
  geenSchaling.vlamTimer === tijden.VLAM_FLITS_DUUR, { geenSchaling, tijden });
check('Ratelaar-intensiteit zit ook op Signaal-niveau (15-25), onafhankelijk van de 10x hogere vuursnelheid',
  geenSchaling.intensiteit >= 15 && geenSchaling.intensiteit <= 25, geenSchaling);

// --- 7. Smederij-boost blijft binnen een redelijke marge -----------------
const gesmeedTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.gesmeed = true;
  d.schiet();
  return {
    intensiteit: d.WAPEN_RATELAAR.vlamLicht.intensity,
    verwacht: d.WAPEN_RATELAAR.vlamLichtBasis * d.SMEDERIJ_VLAM_BOOST,
  };
});
check('Gesmeed wapen: intensiteit = vlamLichtBasis × SMEDERIJ_VLAM_BOOST (geen dubbele toepassing)',
  Math.abs(gesmeedTest.intensiteit - gesmeedTest.verwacht) < 1e-9, gesmeedTest);

// --- 8. Willekeurige rotatie/schaal per schot ------------------------------
const variatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.gesmeed = false;
  const rotaties = [], schalen = [];
  for (let i = 0; i < 8; i++) {
    d.schiet();
    rotaties.push(d.WAPEN_RATELAAR.vlam.rotation.z);
    schalen.push(d.WAPEN_RATELAAR.vlam.scale.x);
  }
  return { rotaties, schalen };
});
const uniekeRotaties = new Set(variatie.rotaties.map(r => r.toFixed(6))).size;
check('Rotatie varieert daadwerkelijk per schot (niet 8x identiek)',
  uniekeRotaties > 1, variatie);
check('Schaal blijft binnen de bedoelde marge (0,85-1,15)',
  variatie.schalen.every(s => s >= 0.85 && s <= 1.15), variatie);

// --- 9. Invariant: het lichtaantal blijft 28 (bestaand licht, geen nieuw) -
const lichten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let n = 0, schaduwwerpers = 0;
  d.scene.traverse(o => { if (o.isLight) { n++; if (o.castShadow) schaduwwerpers++; } });
  return { n, schaduwwerpers };
});
check('Lichtaantal blijft 28 (1 hemisfeer + 27 point) — de mondingsvlam is een bestaand licht dat harder aangaat',
  lichten.n === 28, lichten);
check('Schaduwwerpers blijft 1 — vlamLicht werpt geen schaduw',
  lichten.schaduwwerpers === 1, lichten);

// --- 10. Hitch-garantie: het eerste frame na een schot wordt nooit overgeslagen
// Bug (gevonden ná dit ticket, tijdens speeltest): dt in de gameLoop is
// geclipt op 0,05s (hitch-guard tegen rare sprongen), ruimer dan
// VLAM_FLITS_DUUR (0,033s). Zonder een expliciete "net gezet"-vlag werd
// vlamTimer in hetzelfde tick waarin hij gezet wordt óók meteen afgeboekt
// met de dt van het VORIGE frame-interval — bij een hapering (bijv. een
// golf die spawnt, precies wanneer er veel geschoten wordt) kon een schot
// zo NUL zichtbare frames krijgen: gezet én alweer verborgen vóór de
// eerste render. Fix: het eerste frame na schiet() slaat de aftelling
// altijd één keer over, ongeacht hoe groot dt die tick toevallig is.
// Belangrijk: schiet() + de eerste vlamTimer-metingen gebeuren in ÉÉN
// page.evaluate(), met requestAnimationFrame-nesting i.p.v. losse
// page.evaluate()-aanroepen. gameLoop's eigen rAF-lus blijft namelijk altijd
// doorlopen (self-perpetuating), dus tussen twee LOSSE page.evaluate()-round-
// trips kan gameLoop al onopgemerkt getikt hebben — dat gaf hier eerst een
// vals-negatief (het "eerste frame" was dan stiekem al het tweede of derde).
const hitchGarantie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return new Promise(resolve => {
    d.schiet();
    const directNaSchot = d.vlamTimer;
    requestAnimationFrame(() => {
      const naEenFrame = d.vlamTimer;
      requestAnimationFrame(() => {
        const naTweeFrames = d.vlamTimer;
        resolve({ directNaSchot, naEenFrame, naTweeFrames });
      });
    });
  });
});
check('Direct na schiet(): vlamTimer staat op VLAM_FLITS_DUUR',
  hitchGarantie.directNaSchot === tijden.VLAM_FLITS_DUUR, { hitchGarantie, tijden });
check('Na het EERSTE frame erna: vlamTimer is nog steeds ONGEWIJZIGD (het gegarandeerde frame — dit is de fix)',
  hitchGarantie.naEenFrame === tijden.VLAM_FLITS_DUUR, { hitchGarantie, tijden });
check('Na het TWEEDE frame: de normale aftelling is hervat (timer is nu lager dan VLAM_FLITS_DUUR)',
  hitchGarantie.naTweeFrames < tijden.VLAM_FLITS_DUUR, { hitchGarantie, tijden });

// --- 11. wisselWapen() reset de "net gezet"-vlag mee (geen stale guarantee
// die per ongeluk overspringt naar het volgende wapen) ---------------------
const wisselNaSchot = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 99999;
  if (d.actiefWapenNaam !== 'ratelaar') d.koopRatelaar();
  d.schiet();
  const vlamNetGezetVoor = d.vlamNetGezet;
  d.wisselWapen();
  return { vlamNetGezetVoor, vlamNetGezetNa: d.vlamNetGezet, vlamTimerNa: d.vlamTimer };
});
check('Vlak na een schot staat vlamNetGezet op true (testopzet klopt)',
  wisselNaSchot.vlamNetGezetVoor === true, wisselNaSchot);
check('Na wisselWapen(): vlamNetGezet is gereset naar false, samen met vlamTimer',
  wisselNaSchot.vlamNetGezetNa === false && wisselNaSchot.vlamTimerNa === 0, wisselNaSchot);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
