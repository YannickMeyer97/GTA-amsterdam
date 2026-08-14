// Ticket 96 (v0.22, §10.8-beslissing 83): één eigen ShaderPass (filmkorrel +
// chromatische aberratie) ná bloomPass, vóór OutputPass — de drager die T97
// (vignet) en T98 (per-zone kleurgrading) straks uitbreiden met extra
// uniforms/regels, zonder ooit een vijfde/zesde pass toe te voegen.
// Dit bestand wordt door T97/T98 verder uitgebreid (zelfde patroon als
// test-hitmarker-audio.mjs voor T95): nieuwe secties, niet nieuwe bestanden.
import { openAmsterdamUndead, openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Structuur: precies 4 passes, in de juiste volgorde -----------------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const passes = d.composer.passes;
  return {
    aantal: passes.length,
    namen: passes.map(p => p.constructor.name),
    indexBloom: passes.indexOf(d.bloomPass),
    indexNaverwerking: passes.indexOf(d.naverwerkingsPass),
  };
});
check('composer.passes.length === 4 (RenderPass, Bloom, naverwerking, Output)',
  structuur.aantal === 4, structuur);
check('RenderPass staat eerst', structuur.namen[0] === 'RenderPass', structuur);
check('bloomPass staat vóór de naverwerkingspass',
  structuur.indexBloom !== -1 && structuur.indexNaverwerking !== -1 && structuur.indexBloom < structuur.indexNaverwerking,
  structuur);
check('OutputPass staat als laatste, ná de naverwerkingspass',
  structuur.namen[3] === 'OutputPass' && structuur.indexNaverwerking === 2,
  structuur);

// --- 2. De pass-uniforms bestaan, met de juiste defaults -------------------
const uniforms = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const u = d.naverwerkingsPass.uniforms;
  return {
    heeftTDiffuse: 'tDiffuse' in u,
    heeftUTijd: 'uTijd' in u,
    heeftUSterkte: 'uSterkte' in u,
    uSterkteDefault: u.uSterkte.value,
  };
});
check('De pass heeft tDiffuse/uTijd/uSterkte-uniforms', uniforms.heeftTDiffuse && uniforms.heeftUTijd && uniforms.heeftUSterkte, uniforms);
check('uSterkte start op 1 (volle sterkte, niets is uitgeschakeld)', uniforms.uSterkteDefault === 1, uniforms);

// --- 3. uTijd volgt dezelfde bevriesbare klok als de lampflikker -----------
// (visueleBevriesTijd) — zonder dit zou test-visuele-basislijn.mjs de
// filmkorrel niet deterministisch kunnen meten (§10.4.1).
const tijdBevroren = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.visueleBevriesTijd = 12.5;
  await new Promise(res => requestAnimationFrame(res));
  const eerste = d.naverwerkingsPass.uniforms.uTijd.value;
  await new Promise(res => requestAnimationFrame(res));
  const tweede = d.naverwerkingsPass.uniforms.uTijd.value;
  d.visueleBevriesTijd = null;
  return { eerste, tweede };
});
check('uTijd volgt visueleBevriesTijd exact (deterministisch te bevriezen)',
  tijdBevroren.eerste === 12.5 && tijdBevroren.tweede === 12.5, tijdBevroren);

// --- 4. Bronvorm: aberratie is nul in het centrum, begint pas voorbij
// ~60% van de straal (smoothstep-drempel), en de sterkte-constanten zijn
// klein genoeg om niet zelf als een zichtbaar artefact te ogen -------------
const bron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    fragmentShader: d.naverwerkingsPass.material.fragmentShader,
    KORREL_STERKTE: d.KORREL_STERKTE,
    ABERRATIE_STERKTE: d.ABERRATIE_STERKTE,
    ABERRATIE_START_RADIUS: d.ABERRATIE_START_RADIUS,
  };
});
check('Fragment-shader gebruikt smoothstep(ABERRATIE_START_RADIUS, 1.0, radius) — nul tot de drempel, daarna oplopend',
  new RegExp(`smoothstep\\(\\s*${bron.ABERRATIE_START_RADIUS.toFixed(1)}`).test(bron.fragmentShader), bron);
check('ABERRATIE_START_RADIUS ligt rond 60% van de straal (0,5-0,7)',
  bron.ABERRATIE_START_RADIUS >= 0.5 && bron.ABERRATIE_START_RADIUS <= 0.7, bron);
check('KORREL_STERKTE is klein genoeg om niet als zichtbare korrel te ogen (< 0,08)',
  bron.KORREL_STERKTE > 0 && bron.KORREL_STERKTE < 0.08, bron);
check('ABERRATIE_STERKTE is een kleine sub-pixel-orde UV-offset (< 0,02)',
  bron.ABERRATIE_STERKTE > 0 && bron.ABERRATIE_STERKTE < 0.02, bron);
check('Filmkorrel is MULTIPLICATIEF (kleur *= ...), niet additief — additief zou bijna-zwarte pixels na de sRGB-encode in OutputPass onevenredig uitvergroten',
  /kleur\s*\*=\s*korrel/.test(bron.fragmentShader), bron);

// --- 5. uSterkte is de werkelijke, schakelbare master: op 0 is de pass een
// volledige passthrough (pixel-voor-pixel identiek aan de scene zonder
// korrel/aberratie); op 1 verandert er aantoonbaar iets. -------------------
const { browser: vBrowser, page: vPage } = await openVoorVisueleMeting();
const punten = await berekenVisueleStandpunten(vPage);
const woonkamer = punten.find(p => p.naam === 'woonkamer');
await zetVisueelStandpunt(vPage, woonkamer);
const bufUit = await vPage.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.naverwerkingsPass.uniforms.uSterkte.value = 0;
  await new Promise(res => requestAnimationFrame(res));
});
const schermUit = await vPage.screenshot({ type: 'png' });
await zetVisueelStandpunt(vPage, woonkamer);   // zelfde bevroren standpunt opnieuw
await vPage.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.naverwerkingsPass.uniforms.uSterkte.value = 1;
  await new Promise(res => requestAnimationFrame(res));
});
const schermAan = await vPage.screenshot({ type: 'png' });
check('uSterkte=0 vs uSterkte=1 op hetzelfde bevroren standpunt: het beeld verandert aantoonbaar (de uniform doet echt iets)',
  !schermUit.equals(schermAan), { bytesUit: schermUit.length, bytesAan: schermAan.length });
await vBrowser.close();

// --- 6. Ticket 97: het vignet verhuist van DOM naar de naverwerkingspass -
// (§10.8-beslissing 83) — geen extra pass, #vignet is weg, .schadeWedge
// blijft ongewijzigd in DOM, en de uniform reageert op zowel HP als
// Stroomuitval (nieuw t.o.v. de oude DOM-versie, die alleen HP kende).
const vignetStructuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    domVignetBestaat: !!document.getElementById('vignet'),
    schadeWedgeBestaat: document.querySelectorAll('.schadeWedge').length,
    passLength: d.composer.passes.length,
    heeftUniforms: 'uVignetSterkte' in d.naverwerkingsPass.uniforms &&
      'uVignetKleur' in d.naverwerkingsPass.uniforms && 'uVignetRadius' in d.naverwerkingsPass.uniforms,
    VIGNET_STERKTE_MAX: d.VIGNET_STERKTE_MAX,
  };
});
check('Het DOM-element #vignet bestaat niet meer', vignetStructuur.domVignetBestaat === false, vignetStructuur);
check('.schadeWedge-pool blijft ongewijzigd in DOM (SCHADE_WEDGE_MAX elementen)',
  vignetStructuur.schadeWedgeBestaat === 4, vignetStructuur);
check('Geen extra pass door T97 (composer.passes.length blijft 4)', vignetStructuur.passLength === 4, vignetStructuur);
check('De pass heeft uVignetSterkte/uVignetKleur/uVignetRadius-uniforms', vignetStructuur.heeftUniforms, vignetStructuur);
check('Er staat een expliciete bovengrens (VIGNET_STERKTE_MAX) als constante in de code',
  typeof vignetStructuur.VIGNET_STERKTE_MAX === 'number' && vignetStructuur.VIGNET_STERKTE_MAX > 0, vignetStructuur);

// --- 6a. HP-reactie: lage HP geeft een sterker vignet dan volle HP --------
const hpReactie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stroomFactor = 1;
  d.vignetFlits = 0;
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.updateVignet(0.016);
  const bijVolleHp = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  d.spelerStaat.hp = 5;
  d.updateVignet(0.016);
  const bijLageHp = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  d.spelerStaat.hp = d.spelerStaat.hpMax;   // staat weer netjes terug voor de volgende sectie
  d.updateVignet(0.016);
  return { bijVolleHp, bijLageHp };
});
check('Volle HP: het vignet staat op (vrijwel) nul', hpReactie.bijVolleHp < 0.01, hpReactie);
check('Lage HP: het vignet is merkbaar sterker dan bij volle HP', hpReactie.bijLageHp > hpReactie.bijVolleHp, hpReactie);

// --- 6b. Stroomuitval-reactie: onafhankelijk van HP, nieuw t.o.v. de oude
// DOM-versie (die nergens op stroomFactor reageerde) ----------------------
const stroomReactie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelerStaat.hp = d.spelerStaat.hpMax;   // volle HP: isoleert het Stroomuitval-effect
  d.vignetFlits = 0;
  d.stroomFactor = 1;
  d.updateVignet(0.016);
  const normaal = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  d.stroomFactor = d.STROOMUITVAL_DIM_FACTOR;
  d.updateVignet(0.016);
  const tijdensStroomuitval = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  d.stroomFactor = 1;   // netjes terugzetten
  d.updateVignet(0.016);
  return { normaal, tijdensStroomuitval };
});
check('Tijdens een Stroomuitval (volle HP, dus geen HP-bijdrage) is het vignet toch merkbaar sterker dan normaal',
  stroomReactie.tijdensStroomuitval > stroomReactie.normaal, stroomReactie);

// --- 6c. De bovengrens klemt ook echt: HP=0 + volle flits + Stroomuitval
// samen mogen VIGNET_STERKTE_MAX niet overschrijden ------------------------
const bovengrens = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelerStaat.hp = 0;
  d.vignetFlits = 1;
  d.stroomFactor = d.STROOMUITVAL_DIM_FACTOR;
  d.updateVignet(0.001);   // verwaarloosbare dt: vignetFlits decayt niet noemenswaardig weg
  const sterkte = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.vignetFlits = 0;
  d.stroomFactor = 1;
  d.updateVignet(0.016);
  return { sterkte, VIGNET_STERKTE_MAX: d.VIGNET_STERKTE_MAX };
});
check('De worst-case-combinatie (0 HP + verse flits + volle Stroomuitval) blijft geklemd op VIGNET_STERKTE_MAX',
  bovengrens.sterkte <= bovengrens.VIGNET_STERKTE_MAX, bovengrens);

// --- 6d. spelerSchade() triggert nog steeds een flits, die vanzelf weer
// uitdooft (regressie op het bestaande gedrag, nu via de uniform i.p.v.
// DOM-opacity) --------------------------------------------------------------
const flitsGedrag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.stroomFactor = 1;
  d.vignetFlits = 0;
  d.updateVignet(0.016);
  const voorSchade = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  d.spelerSchade(1, 'test');
  d.updateVignet(0.001);
  const directNaSchade = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  let tikken = 0;
  while (d.vignetFlits > 0 && tikken < 50) { d.updateVignet(0.05); tikken++; }
  const naDoven = d.naverwerkingsPass.uniforms.uVignetSterkte.value;
  return { voorSchade, directNaSchade, naDoven, tikken };
});
check('spelerSchade() geeft een korte flits (het vignet springt meteen omhoog)',
  flitsGedrag.directNaSchade > flitsGedrag.voorSchade, flitsGedrag);
check('...die vanzelf weer uitdooft', flitsGedrag.naDoven < flitsGedrag.directNaSchade && flitsGedrag.tikken < 50, flitsGedrag);

// --- 7. Ticket 98: per-zone kleurgrading — de pass-mechanica (de
// luminantie-neutraliteit en de onderlinge kleurverschillen zelf staan in
// test-visuele-basislijn.mjs sectie 6, die de band-infrastructuur al heeft).
const kleurStructuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    passLength: d.composer.passes.length,
    zoneAantal: d.KLEUR_GRADING_ZONES.length,
    heeftUniforms: 'uGradeLift' in d.naverwerkingsPass.uniforms &&
      'uGradeGamma' in d.naverwerkingsPass.uniforms && 'uGradeGain' in d.naverwerkingsPass.uniforms,
  };
});
check('Geen extra pass door T98 (composer.passes.length blijft 4)', kleurStructuur.passLength === 4, kleurStructuur);
check('Acht zone-profielen (vijf zoneVan()-zones + kelder/vliering/gracht)', kleurStructuur.zoneAantal === 8, kleurStructuur);
check('De pass heeft uGradeLift/uGradeGamma/uGradeGain-uniforms', kleurStructuur.heeftUniforms, kleurStructuur);

// --- 7a. kleurgradingZoneVan(): de FIJNERE indeling — kelder/vliering/
// gracht wisselen los van zoneVan(), en delen zelfs een zoneVan()-index met
// een buurzone zonder verward te raken -------------------------------------
const classificatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    woonkamer: d.kleurgradingZoneVan(0, 0, 1),
    gang: d.kleurgradingZoneVan(0, 0, (d.DEUR_Z + d.GANG_Z_EIND) / 2),
    atelier: d.kleurgradingZoneVan(0, 0, d.GANG_Z_EIND - 2),
    binnenplaats: d.kleurgradingZoneVan(d.PLAATS_CX, 0, (d.PLAATS_Z_NOORD + d.PLAATS_Z_ZUID) / 2),
    bijkeuken: d.kleurgradingZoneVan(6, 0, d.BIJKEUKEN_CZ),
    kelder: d.kleurgradingZoneVan(0, -5, -20),         // y < -0,1: kelder, ongeacht x/z
    vliering: d.kleurgradingZoneVan(-8, 0, -12),       // berekenVlieringY() !== null
    gracht: d.kleurgradingZoneVan(17, 0, d.BIJKEUKEN_CZ),   // voorbij VLONDER_X_WEST
    // Kelder deelt zijn zoneVan()-index (2, "atelier") met de atelier-x/z —
    // de y-hoogte moet 'm daar toch van onderscheiden.
    zoneVanAtelierPositie: d.zoneVan(0, d.GANG_Z_EIND - 2),
  };
});
const indices = [classificatie.woonkamer, classificatie.gang, classificatie.atelier, classificatie.binnenplaats,
  classificatie.bijkeuken, classificatie.kelder, classificatie.vliering, classificatie.gracht];
check('Alle acht standpunten classificeren naar hun eigen, unieke index (0-7)',
  indices.every((v, i) => indices.indexOf(v) === i) && indices.every(v => v >= 0 && v <= 7), classificatie);
check('woonkamer/gang/atelier/binnenplaats/bijkeuken matchen exact zoneVan() (0-4)',
  classificatie.woonkamer === 0 && classificatie.gang === 1 && classificatie.atelier === 2 &&
  classificatie.binnenplaats === 3 && classificatie.bijkeuken === 4, classificatie);
check('Kelder deelt zoneVan()-index 2 (atelier) met de atelier-positie, maar krijgt een eigen kleurgrading-index (5, los van atelier se 2)',
  classificatie.zoneVanAtelierPositie === 2 && classificatie.kelder === 5 && classificatie.kelder !== classificatie.atelier,
  classificatie);
check('Vliering krijgt index 6, gracht index 7', classificatie.vliering === 6 && classificatie.gracht === 7, classificatie);

// --- 7b. Echte runtime-trigger: een echte zone-wissel (woonkamer -> kelder)
// start een zachte overgang die minstens KLEUR_GRADING_OVERGANG_DUUR duurt —
// geen instant-snap, en na afloop staat de uniform exact op het doel -------
const overgang = await page.evaluate(async (kelderPunt) => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 1);   // woonkamer
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  // Kelder-x/z uit berekenVisueleStandpunten() (T88) i.p.v. een handmatige
  // y-waarde: die wordt tóch meteen overschreven door updateSpeler()'s eigen
  // berekenVloerY()-afleiding, ELKE frame — inclusief de rAF-tick die hier
  // op wordt gewacht (de gameLoop draait al, dankzij simuleerPointerLock).
  // Bij deze x/z rekent berekenVloerY() zelf de kelder-diepte uit.
  d.speler.positie.set(kelderPunt.x, 0, kelderPunt.z);
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));   // net getriggerd
  const netNaTrigger = { timer: d.kleurgradingTimer, gain: { ...d.naverwerkingsPass.uniforms.uGradeGain.value }, y: d.speler.positie.y };
  for (let i = 0; i < 45; i++) await new Promise(res => requestAnimationFrame(res));   // ruim voorbij 0,5s @ 60fps
  const naAfloop = { timer: d.kleurgradingTimer, gain: { ...d.naverwerkingsPass.uniforms.uGradeGain.value } };
  return { netNaTrigger, naAfloop, kelderDoel: { ...d.KLEUR_GRADING_ZONES[5].gain }, OVERGANG_DUUR: d.KLEUR_GRADING_OVERGANG_DUUR };
}, await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { x: (d.KELDER_X_WEST + d.KELDERTRAP_X_ONDER) / 2, z: (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2 };
}));
check('Een echte zone-wissel (woonkamer -> kelder) triggert de overgang (timer > 0, gelijk aan de volle overgangsduur)',
  overgang.netNaTrigger.timer > 0 && Math.abs(overgang.netNaTrigger.timer - overgang.OVERGANG_DUUR) < 0.02, overgang);
check('Direct na de trigger staat de uniform nog niet meteen op het kelder-doel (geen instant-snap)',
  Math.abs(overgang.netNaTrigger.gain.y - overgang.kelderDoel.y) > 1e-4, overgang);
check('Ruim ná de overgangsduur staat de uniform exact op het kelder-doel én de timer weer op 0',
  Math.abs(overgang.naAfloop.gain.x - overgang.kelderDoel.x) < 1e-6 &&
  Math.abs(overgang.naAfloop.gain.y - overgang.kelderDoel.y) < 1e-6 &&
  Math.abs(overgang.naAfloop.gain.z - overgang.kelderDoel.z) < 1e-6 &&
  overgang.naAfloop.timer === 0, overgang);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
