// Ticket 62 (v0.19, §7.5.1-beslissing 54, herzien v5): kelder-trap +
// Y-beweging + deur 5.
//
// De kelder ligt (weer) op een ECHT disjuncte footprint: alles ten westen
// van de nis-westmuur, volledig buiten GRENS. Dat is de structurele reden
// dat berekenKelderY() weer puur functioneel kan zijn, en dat de speler
// nergens anders op de kaart kan stijgen of dalen. Deze suite bewaakt
// precies die twee structurele gebruikerseisen:
//   (1) je moet deur 5 kopen voordat je omlaag kunt,
//   (2) de trap is de ENIGE plek waar Y ooit verandert.
// Een derde eis — "geen ondode kan er ooit komen" (§7.5.2-beslissing 55) —
// is via meerdere feedbackrondes (§7.5.4, §7.5.6) uiteindelijk volledig
// teruggedraaid: sinds §7.5.7 loopt elke ondode gewoon de kelder in, zonder
// enige restrictie (zie sectie 11 hieronder).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Vóór koop: deur 5-opening is geblokkeerd --------------------------
const voorKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    geblokkeerd: d.isVrijePlek(d.KAMER2_NIS_X_WEST - 0.15, d.KELDERTRAP_CZ, 0.05) === false,
    obstakelAanwezig: d.obstakels.includes(d.deur5Obstakel),
    gekocht: d.deur5Gekocht,
  };
});
check('Vóór koop: deur 5-opening is geblokkeerd', voorKoop.geblokkeerd, voorKoop);
check('Vóór koop: deur5Obstakel staat geregistreerd, deur5Gekocht is false',
  voorKoop.obstakelAanwezig && voorKoop.gekocht === false, voorKoop);

// --- 1b. EIS 1 (gebruikersmelding): vóór aankoop kun je NIET naar beneden.
// Simuleer een speler die vanuit de nis 200 frames lang tegen de deur aan
// blijft duwen: hij moet geklemd blijven en Y moet elk frame exact 0 zijn.
const duwenVoorKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(-10, 0, d.KELDERTRAP_CZ);
  const yWaarden = [];
  for (let i = 0; i < 200; i++) {
    d.speler.positie.x -= 0.05;
    d.losBotsingenOp(d.speler.positie, d.speler.straal, true);
    d.speler.positie.y = d.berekenKelderY(d.speler.positie.x, d.speler.positie.z);
    yWaarden.push(d.speler.positie.y);
  }
  return { eindX: d.speler.positie.x, maxAbsY: Math.max(...yWaarden.map(Math.abs)), grensMinX: d.GRENS.minX };
});
check('Vóór koop: tegen de deur aan blijven duwen laat de speler nooit dalen (Y blijft exact 0)',
  duwenVoorKoop.maxAbsY === 0, duwenVoorKoop);
check('Vóór koop: de speler blijft ten oosten van GRENS.minX geklemd',
  duwenVoorKoop.eindX >= duwenVoorKoop.grensMinX, duwenVoorKoop);

// --- 2. Te weinig geld: koopDeur5() doet niets -----------------------------
const teWeinig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 500;   // minder dan DEUR5_PRIJS (900)
  d.koopDeur5();
  return { gekocht: d.deur5Gekocht, geld: d.spelStaat.geld };
});
check('koopDeur5() met te weinig geld doet niets (geen aankoop, geld ongewijzigd)',
  teWeinig.gekocht === false && teWeinig.geld === 500, teWeinig);

// --- 3. EIS 2: de trap is de ENIGE plek waar Y verandert. Dicht raster over
// alle bovengrondse ruimte (x >= nis-westmuur, de hele speelbare kaart):
// berekenKelderY moet daar overal exact 0 teruggeven. -----------------------
const bovengrondsRaster = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let gecontroleerd = 0;
  const afwijkingen = [];
  for (let x = d.KELDERTRAP_X_BOVEN; x <= 21; x += 0.25) {
    for (let z = -24; z <= 5; z += 0.25) {
      gecontroleerd++;
      const y = d.berekenKelderY(x, z);
      if (y !== 0 && afwijkingen.length < 5) afwijkingen.push({ x: +x.toFixed(2), z: +z.toFixed(2), y });
    }
  }
  return { gecontroleerd, afwijkingen };
});
check(`berekenKelderY is exact 0 op ALLE ${bovengrondsRaster.gecontroleerd} bovengrondse rasterpunten (startkamer, gang, atelier, nis, binnenplaats, bijkeuken)`,
  bovengrondsRaster.afwijkingen.length === 0, bovengrondsRaster);

// --- 4. Na koop: geld afgeschreven, obstakel/mesh weg, banner --------------
const naKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 2000;
  document.getElementById('golfBanner').style.opacity = '0';
  document.getElementById('golfBanner').innerHTML = '';
  d.koopDeur5();
  return {
    gekocht: d.deur5Gekocht,
    geld: d.spelStaat.geld,
    obstakelWeg: !d.obstakels.includes(d.deur5Obstakel),
    meshWeg: d.deur5Mesh.parent === null,
    bannerTekst: document.getElementById('golfBanner').innerHTML,
    bannerZichtbaar: document.getElementById('golfBanner').style.opacity === '1',
    puntUitLijst: !d.interactiePunten.includes(d.deur5Punt),
  };
});
check('Na koop: deur5Gekocht = true, €900 afgeschreven (2000 -> 1100)',
  naKoop.gekocht === true && naKoop.geld === 1100, naKoop);
check('Na koop: deur5Obstakel weg uit obstakels[], deur5Mesh weg uit de scene',
  naKoop.obstakelWeg && naKoop.meshWeg, naKoop);
check('Na koop: deur5Punt weg uit interactiePunten', naKoop.puntUitLijst, naKoop);
check('Na koop: de "DE KELDER"-banner verschijnt éénmalig',
  naKoop.bannerTekst.includes('DE KELDER') && naKoop.bannerZichtbaar, naKoop);

// --- 5. Na koop: de trap werkt — dezelfde loop daalt nu wél netjes af ------
const afdalen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(-10, 0, d.KELDERTRAP_CZ);
  const pad = [];
  for (let i = 0; i < 400; i++) {
    d.speler.positie.x -= 0.05;
    d.losBotsingenOp(d.speler.positie, d.speler.straal, true);
    d.speler.positie.y = d.berekenKelderY(d.speler.positie.x, d.speler.positie.z);
    pad.push(d.speler.positie.y);
  }
  // Monotoon dalend (nooit tussendoor omhoog springen) tot de keldervloer.
  let sprongOmhoog = false;
  for (let i = 1; i < pad.length; i++) if (pad[i] > pad[i - 1] + 1e-9) sprongOmhoog = true;
  return { eindX: d.speler.positie.x, eindY: d.speler.positie.y, diepste: Math.min(...pad), sprongOmhoog };
});
check('Na koop: de speler daalt via de trap tot exact -KELDER_DIEPTE (-3.3)',
  Math.abs(afdalen.diepste - (-3.3)) < 1e-9 && Math.abs(afdalen.eindY - (-3.3)) < 1e-9, afdalen);
check('De afdaling is monotoon (geen enkel frame springt de speler omhoog)',
  afdalen.sprongOmhoog === false, afdalen);
check('De speler bereikt de kelderruimte zelf (ruim voorbij de onderkant van de trap)',
  afdalen.eindX < -16, afdalen);

// --- 6. Camera-Y-koppeling via updateSpeler() ------------------------------
const cameraKoppeling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const metingen = [];
  for (const x of [d.KELDERTRAP_X_BOVEN + 0.5, (d.KELDERTRAP_X_BOVEN + d.KELDERTRAP_X_ONDER) / 2, d.KELDERTRAP_X_ONDER - 3]) {
    d.speler.positie.set(x, 0, d.KELDERTRAP_CZ);
    d.speler.yaw = 0;
    d.updateSpeler(0);
    const verwachtY = d.berekenKelderY(x, d.KELDERTRAP_CZ);
    metingen.push({
      x, spelerY: d.speler.positie.y, verwachtY,
      cameraYKlopt: Math.abs(d.camera.position.y - (verwachtY + d.speler.hoogte)) < 1e-9,
      cameraXZKlopt: d.camera.position.x === x && d.camera.position.z === d.KELDERTRAP_CZ,
    });
  }
  return metingen;
});
for (const m of cameraKoppeling) {
  check(`updateSpeler(): speler.positie.y correct op x=${m.x.toFixed(2)} (verwacht ${m.verwachtY})`,
    m.spelerY === m.verwachtY, m);
  check(`updateSpeler(): camera.position.y = speler.positie.y + speler.hoogte op x=${m.x.toFixed(2)}`,
    m.cameraYKlopt, m);
  check(`updateSpeler(): camera x/z volgt speler x/z op x=${m.x.toFixed(2)}`,
    m.cameraXZKlopt, m);
}

// --- 7. Kelderruimte-afmetingen: breedte gehalveerd op feedback ("veel te
// groot"), lengte (noord-zuid) ongewijzigd: 7,5 x 9,9 = 74,25 m² (de helft
// van de vorige 148,5 m² = atelier + 10%) --------------------------------
const afmetingen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    breedteX: d.KELDERTRAP_X_ONDER - d.KELDER_X_WEST,
    diepteZ: d.KELDER_Z_ZUID - d.KELDER_Z_NOORD,
    hoogte: d.KELDER_HOOGTE,
    kamerHoogte: d.KAMER_HOOGTE,
    grensMinZ: d.GRENS.minZ,
    zNoord: d.KELDER_Z_NOORD,
  };
});
check('Kelderruimte-breedte is gehalveerd (7,5m i.p.v. 15m)',
  Math.abs(afmetingen.breedteX - 7.5) < 1e-9, afmetingen);
check('Kelderruimte-lengte (noord-zuid) is ongewijzigd gebleven (9,9m)',
  Math.abs(afmetingen.diepteZ - 9.9) < 1e-9, afmetingen);
check('Kelderruimte-oppervlak is nu 74,25 m² (helft van de vorige 148,5 m²)',
  Math.abs(afmetingen.breedteX * afmetingen.diepteZ - 74.25) < 0.5, afmetingen);
check('Kelderplafond is even hoog als het atelier (KELDER_HOOGTE === KAMER_HOOGTE)',
  afmetingen.hoogte === afmetingen.kamerHoogte, afmetingen);
check('De kelder blijft binnen GRENS.minZ, zodat de z-klem de speler niet uit de ruimte duwt',
  afmetingen.zNoord > afmetingen.grensMinZ, afmetingen);

// --- 8. losBotsingenOp()-primitive: magKelderBinnen=false (het default,
// param weggelaten) blijft altijd geklemd op GRENS.minX. Sinds §7.5.7 geeft
// de productiecode (updateSpeler EN updateOndoden) dit param altijd expliciet
// als true door — niemand is meer beperkt — maar de primitive zelf houdt
// haar eigen veilige default, als verdedigingslinie voor toekomstige
// aanroepen die het param per ongeluk weglaten. ---------------------------
const veiligheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const zonderParam = { x: -10, z: d.KELDERTRAP_CZ };
  for (let i = 0; i < 300; i++) { zonderParam.x -= 0.05; d.losBotsingenOp(zonderParam, 0.35); }
  const metParam = { x: -10, z: d.KELDERTRAP_CZ };
  for (let i = 0; i < 300; i++) { metParam.x -= 0.05; d.losBotsingenOp(metParam, 0.35, true); }
  return { zonderParamX: zonderParam.x, metParamX: metParam.x, grensMinX: d.GRENS.minX };
});
check('losBotsingenOp() zonder het param blijft altijd geklemd op GRENS.minX (default-veiligheid)',
  veiligheid.zonderParamX >= veiligheid.grensMinX - 1e-9, veiligheid);
check('losBotsingenOp() met magKelderBinnen=true mag wél voorbij GRENS.minX de kelder in',
  veiligheid.metParamX < veiligheid.grensMinX, veiligheid);

// --- 9. Pantserdrank staat in de kelder en is alleen daar bruikbaar -------
const pantserdrank = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 5000;
  const inKelderFootprint = d.PANTSERDRANK_X < d.KELDERTRAP_X_ONDER && d.PANTSERDRANK_X > d.KELDER_X_WEST &&
    d.PANTSERDRANK_Z > d.KELDER_Z_NOORD && d.PANTSERDRANK_Z < d.KELDER_Z_ZUID;
  d.speler.positie.set(d.PANTSERDRANK_X, -d.KELDER_DIEPTE, d.PANTSERDRANK_Z);
  d.updateInteracties();
  const inKelder = d.huidigeInteractie ? d.huidigeInteractie.naam : null;
  d.speler.positie.set(d.PANTSERDRANK_X, 0, d.PANTSERDRANK_Z);
  d.updateInteracties();
  const opNul = d.huidigeInteractie ? d.huidigeInteractie.naam : null;
  return { inKelderFootprint, inKelder, opNul };
});
check('Pantserdrank staat binnen de kelder-footprint', pantserdrank.inKelderFootprint, pantserdrank);
check('Pantserdrank reageert op de keldervloer (-KELDER_DIEPTE)',
  pantserdrank.inKelder === 'Pantserdrank', pantserdrank);
check('Pantserdrank reageert NIET op y=0 (Y-marge-vangnet)',
  pantserdrank.opNul !== 'Pantserdrank', pantserdrank);

// --- 10. Herziening (feedback): de kelder is NIET meer permanent veilig
// (zie sectie 11 hieronder) — maar ZOLANG DE SPELER BOVEN BLIJFT mag er
// structureel niets veranderen: geen enkele ondode heeft dan een reden om
// magKelderBinnen te krijgen (dat vereist expliciet dat de speler onder
// y=-0.05 zakt, zie updateOndoden). Koop alle deuren (dus alle
// VENSTERS_*-arrays actief, de grootst mogelijke populatie ondoden) en
// simuleer daarna een groot aantal golven/frames, met de speler die steeds
// van zone wisselt (op de begane grond, y=0) zodat elke ondode op enig
// moment een "andere zone dan de speler"-navigatiepad probeert. Tel bij
// elke tick hoeveel ondoden binnen de kelder-footprint (of de trapband)
// staan: dat moet ALTIJD 0 zijn zolang de speler nooit afdaalt. ------------
const kelderVeiligTijdensGolven = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);

  // Alle deuren kopen: activeert VENSTERS_KAMER2/PLAATS/BIJKEUKEN en de hele
  // ZONE_GRAAF (A-B-C-D-E), het worstcasescenario voor cross-zone-pathing.
  d.spelStaat.geld = 10000;
  d.koopDeur(); d.koopDeur2(); d.koopDeur3(); d.koopDeur4(); d.koopDeur5();

  // Spawn 3 ondoden per (nu actief) spawnvenster: een flinke, gevarieerde
  // populatie verspreid over alle zones.
  for (let ronde = 0; ronde < 3; ronde++) {
    for (let i = 0; i < d.VENSTERS.length; i++) d.spawnOndode(i);
  }
  const totaalGespawnd = d.ondoden.length;

  // Speler pendelt tussen alle vijf zones (incl. de nis, vlak bij de
  // trap-ingang) terwijl ondoden bewegen — elke combinatie van
  // ondode-zone/speler-zone komt zo aan bod.
  const zonePosities = [
    { x: -1.8, z: -3 },                                    // 0: woonkamer
    { x: 0, z: d.GANG_Z_MIDDEN },                           // 1: gang
    { x: d.KAMER2_NIS_X_WEST + 0.5, z: d.KELDERTRAP_CZ },   // 2: atelier/nis (naast de trap)
    { x: d.PLAATS_CX, z: (d.PLAATS_Z_NOORD + d.PLAATS_Z_ZUID) / 2 },   // 3: binnenplaats
    { x: d.BIJKEUKEN_CX, z: d.BIJKEUKEN_CZ },               // 4: bijkeuken
  ];
  let maxInKelderTijdensRun = 0;
  let minOndodeX = Infinity;
  const dt = 0.1;
  for (let tick = 0; tick < 600; tick++) {
    const pos = zonePosities[Math.floor(tick / 40) % zonePosities.length];
    d.speler.positie.set(pos.x, 0, pos.z);
    d.updateOndoden(dt);
    let inKelderNu = 0;
    for (const o of d.ondoden) {
      const p = o.groep.position;
      minOndodeX = Math.min(minOndodeX, p.x);
      const inTrapband = p.x < d.KELDERTRAP_X_BOVEN && p.x >= d.KELDERTRAP_X_ONDER &&
        p.z > d.KELDERTRAP_CZ - d.KELDERTRAP_HALF_BREEDTE && p.z < d.KELDERTRAP_CZ + d.KELDERTRAP_HALF_BREEDTE;
      const inKelderRuimte = p.x < d.KELDERTRAP_X_ONDER && p.z > d.KELDER_Z_NOORD && p.z < d.KELDER_Z_ZUID;
      if (inTrapband || inKelderRuimte) inKelderNu++;
    }
    maxInKelderTijdensRun = Math.max(maxInKelderTijdensRun, inKelderNu);
  }
  return { totaalGespawnd, aantalNu: d.ondoden.length, maxInKelderTijdensRun, minOndodeX, grensMinX: d.GRENS.minX };
});
check(`Er zijn ${kelderVeiligTijdensGolven.totaalGespawnd} ondoden gespawnd over alle (incl. na-aankoop) vensters`,
  kelderVeiligTijdensGolven.totaalGespawnd >= 15, kelderVeiligTijdensGolven);
check('Tijdens 600 simulatieframes (met speler die van zone wisselt) staat NOOIT een ondode in de kelder-footprint of trapband',
  kelderVeiligTijdensGolven.maxInKelderTijdensRun === 0, kelderVeiligTijdensGolven);
check('Geen enkele ondode komt ooit voorbij GRENS.minX (de onderliggende safety-clamp)',
  kelderVeiligTijdensGolven.minOndodeX >= kelderVeiligTijdensGolven.grensMinX - 1e-9, kelderVeiligTijdensGolven);

// --- 11. Herziening (feedback, §7.5.7): GEEN restrictie meer — elke ondode
// loopt gewoon de kelder in, ongeacht afstand tot de deur, zodra dat de weg
// naar de speler is. Eerdere versies van deze suite testten een
// afstandsdrempel (KELDER_NABIJ_AFSTAND) en een "boven blijven dwalen"-
// gedrag; die hele mechaniek is op verzoek verwijderd (zie §7.5.2/§7.5.4/
// §7.5.6 voor de geschiedenis, §7.5.7 voor de volledige terugdraai). Deze
// test bevestigt het nieuwe gedrag: een ondode vlak bij de deur ÉN een
// ondode ver weg (dezelfde zuidoosthoek als voorheen, ~20m hemelsbreed)
// bereiken allebei de kelder zodra de speler daar is en blijft. ------------
const kelderVrijeToegang = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.geld = 5000;
  d.koopDeur5();

  // Speler daalt af en blijft in de kelderruimte staan.
  const kamerCX = (d.KELDER_X_WEST + d.KELDERTRAP_X_ONDER) / 2;
  const kamerCZ = (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2;
  d.speler.positie.set(kamerCX, -d.KELDER_DIEPTE, kamerCZ);

  // A: al dichtbij het deurgat.
  const dichtbij = d.spawnOndode(0);
  dichtbij.groep.position.set(d.KAMER2_NIS_X_WEST - 1, 0, d.KELDERTRAP_CZ);
  // B: ver weg in hetzelfde atelier (zone 2), de fysieke zuidoosthoek —
  // exact de positie die eerder juist NOOIT toegang mocht krijgen.
  const verWeg = d.spawnOndode(0);
  verWeg.groep.position.set(d.KAMER2_HALF_B - 0.5, 0, d.GANG_Z_EIND - 1);

  // Genoeg tijd voor de verste ondode om de ~20m af te leggen (bij
  // ONDODE_SNELHEID 1,5 m/s theoretisch ~14s) plus de trap af te dalen:
  // 60 sim-seconden (600 ticks) is ruim voldoende marge.
  const dt = 0.1;
  for (let tick = 0; tick < 600; tick++) d.updateOndoden(dt);

  return {
    dichtbijOnder: dichtbij.groep.position.y < -0.01,
    dichtbijVoorbijDeur: dichtbij.groep.position.x < d.KAMER2_NIS_X_WEST,
    verWegOnder: verWeg.groep.position.y < -0.01,
    verWegVoorbijDeur: verWeg.groep.position.x < d.KAMER2_NIS_X_WEST,
    dichtbijY: dichtbij.groep.position.y, verWegY: verWeg.groep.position.y,
  };
});
check('Ondode die al dichtbij de deur stond, loopt de kelder in en daalt af (y < 0)',
  kelderVrijeToegang.dichtbijOnder && kelderVrijeToegang.dichtbijVoorbijDeur, kelderVrijeToegang);
check('Ondode die ver weg stond, loopt NU OOK gewoon de kelder in en daalt af (y < 0) — geen restrictie meer',
  kelderVrijeToegang.verWegOnder && kelderVrijeToegang.verWegVoorbijDeur, kelderVrijeToegang);

// --- 12. Kelderoost (feedback: nieuwe ruimte + deur6 + verplaatste
// Scheepslantaarn). Kelderoost deelt zijn x-bereik met de trapkoker maar
// ligt op een eigen, zuidelijkere z-band — berekenKelderY() moet die
// bounding-box-check VÓÓR de trapkoker-fallback afhandelen (zie het
// commentaar in berekenKelderY zelf), anders "schiet" de speler terug naar
// Y=0 zodra hij voorbij x=KELDERTRAP_X_ONDER in kelderoost loopt. ---------
const kelderoostY = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let gecontroleerd = 0;
  const afwijkingen = [];
  for (let x = d.KELDEROOST_X_WEST + 0.05; x < d.KELDEROOST_X_OOST; x += 0.2) {
    for (let z = d.KELDEROOST_Z_NOORD + 0.05; z < d.KELDEROOST_Z_ZUID; z += 0.2) {
      gecontroleerd++;
      const y = d.berekenKelderY(x, z);
      if (y !== -d.KELDER_DIEPTE && afwijkingen.length < 5) afwijkingen.push({ x: +x.toFixed(2), z: +z.toFixed(2), y });
    }
  }
  return { gecontroleerd, afwijkingen };
});
check(`berekenKelderY is exact -KELDER_DIEPTE op alle ${kelderoostY.gecontroleerd} rasterpunten binnen kelderoost`,
  kelderoostY.afwijkingen.length === 0, kelderoostY);

// De trapkoker zelf (delend x-bereik, maar noordelijker z-band) moet zijn
// oorspronkelijke fractionele daalformule behouden — regressiecheck dat de
// kelderoost-toevoeging die andere tak niet per ongeluk heeft geraakt.
const trapkokerRegressie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const x = (d.KELDERTRAP_X_BOVEN + d.KELDERTRAP_X_ONDER) / 2;
  const verwacht = -d.KELDER_DIEPTE * ((d.KELDERTRAP_X_BOVEN - x) / (d.KELDERTRAP_X_BOVEN - d.KELDERTRAP_X_ONDER));
  return { y: d.berekenKelderY(x, d.KELDERTRAP_CZ), verwacht };
});
check('De trapkoker-fractionele-daalformule is ongewijzigd (halverwege de trap: halverwege -KELDER_DIEPTE)',
  Math.abs(trapkokerRegressie.y - trapkokerRegressie.verwacht) < 1e-9, trapkokerRegressie);

// Realistische wandeling: vanaf diep in de hoofdkelder, dwars door deur6,
// tot in kelderoost — Y mag nooit tussentijds terugspringen naar 0.
const kelderoostWandeling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const pad = [];
  const startX = d.KELDER_X_WEST + 3;
  const eindX = (d.KELDEROOST_X_WEST + d.KELDEROOST_X_OOST) / 2;
  const stappen = 200;
  for (let i = 0; i <= stappen; i++) {
    const x = startX + (eindX - startX) * (i / stappen);
    const z = d.KELDEROOST_CZ;   // recht door het deurgat
    pad.push({ x, z, y: d.berekenKelderY(x, z) });
  }
  const terugSprongen = pad.filter(p => p.y === 0 && p.x < d.KELDERTRAP_X_BOVEN);
  return { terugSprongenAantal: terugSprongen.length, eersteTerugsprong: terugSprongen[0] ?? null, laatstePunt: pad[pad.length - 1] };
});
check('Een rechte wandeling van hoofdkelder door deur6 naar kelderoost springt NOOIT terug naar Y=0',
  kelderoostWandeling.terugSprongenAantal === 0, kelderoostWandeling);
check('Aan het einde van die wandeling staat de speler op -KELDER_DIEPTE in kelderoost',
  Math.abs(kelderoostWandeling.laatstePunt.y - (-3.3)) < 1e-9, kelderoostWandeling);

// --- 13. Deur 6: koopmechaniek (zelfde patroon als deur 5 in sectie 4).
// isVrijePlek() is hier NIET bruikbaar (zoals bij deur5): de kelder ligt
// volledig buiten GRENS, dus isVrijePlek geeft daar altijd false terug,
// los van obstakels — vandaar dat "geblokkeerd/doorloopbaar" hier via de
// obstakel-registratie zelf getoetst wordt, plus een collision-gebaseerde
// doorloop-check (zelfde aanpak als de afdaling-simulatie in sectie 5). ---
const deur6VoorKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const testPos = { x: d.DEUR6_X, z: d.KELDEROOST_CZ };
  d.losBotsingenOp(testPos, 0.35, true);
  return {
    geblokkeerd: Math.abs(testPos.x - d.DEUR6_X) > 0.05,   // botsing duwt 'm weg van het deurgat
    obstakelAanwezig: d.obstakels.includes(d.deur6Obstakel),
    gekocht: d.deur6Gekocht,
    prijs: d.DEUR6_PRIJS,
  };
});
check('Vóór koop: deur6-opening is geblokkeerd (collision duwt terug), deur6Obstakel geregistreerd, deur6Gekocht false',
  deur6VoorKoop.geblokkeerd && deur6VoorKoop.obstakelAanwezig && deur6VoorKoop.gekocht === false, deur6VoorKoop);

const deur6NaKoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 2000;
  document.getElementById('golfBanner').style.opacity = '0';
  document.getElementById('golfBanner').innerHTML = '';
  const geldVoor = d.spelStaat.geld;
  d.koopDeur6();
  const testPos = { x: d.DEUR6_X, z: d.KELDEROOST_CZ };
  d.losBotsingenOp(testPos, 0.35, true);
  return {
    gekocht: d.deur6Gekocht,
    geldAfgeschreven: geldVoor - d.spelStaat.geld,
    obstakelWeg: !d.obstakels.includes(d.deur6Obstakel),
    meshWeg: d.deur6Mesh.parent === null,
    puntUitLijst: !d.interactiePunten.includes(d.deur6Punt),
    doorloopbaar: Math.abs(testPos.x - d.DEUR6_X) < 1e-9,   // nu GEEN botsing meer op exact dezelfde plek
    bannerTekst: document.getElementById('golfBanner').innerHTML,
  };
});
check(`Na koop: deur6Gekocht = true, exact €${deur6NaKoop.geldAfgeschreven} afgeschreven (= DEUR6_PRIJS)`,
  deur6NaKoop.gekocht === true && deur6NaKoop.geldAfgeschreven === 700, deur6NaKoop);
check('Na koop: deur6Obstakel weg uit obstakels[], deur6Mesh weg uit de scene, deurgat nu doorloopbaar',
  deur6NaKoop.obstakelWeg && deur6NaKoop.meshWeg && deur6NaKoop.doorloopbaar, deur6NaKoop);
check('Na koop: deur6Punt weg uit interactiePunten', deur6NaKoop.puntUitLijst, deur6NaKoop);
check('Na koop: de "KELDEROOST"-banner verschijnt', deur6NaKoop.bannerTekst.includes('KELDEROOST'), deur6NaKoop);

// --- 14. Scheepslantaarn: verhuisd naar kelderoost, reageert op de juiste Y
// (Y-aanname-audit — zie de VLUCHT_ONDERDELEN.y-toevoeging) -----------------
const lantaarnTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const onderdeel = d.VLUCHT_ONDERDELEN.find(o => o.naam === 'Scheepslantaarn');
  const inKelderoostFootprint = onderdeel.x > d.KELDEROOST_X_WEST && onderdeel.x < d.KELDEROOST_X_OOST &&
    onderdeel.z > d.KELDEROOST_Z_NOORD && onderdeel.z < d.KELDEROOST_Z_ZUID;
  const drempelVoorTest = onderdeel.drempelGolf;
  d.spelStaat.golf = 1;
  d.toonVluchtOnderdelenIndienDrempel();
  const meshY = onderdeel.mesh.position.y;
  const puntY = onderdeel.punt.positie.y;
  d.speler.positie.set(onderdeel.x, -d.KELDER_DIEPTE, onderdeel.z);
  d.updateInteracties();
  const reageertInKelder = d.huidigeInteractie ? d.huidigeInteractie.naam : null;
  d.speler.positie.set(onderdeel.x, 0, onderdeel.z);
  d.updateInteracties();
  const reageertOpNul = d.huidigeInteractie ? d.huidigeInteractie.naam : null;
  return { inKelderoostFootprint, onderdeelY: onderdeel.y, meshY, puntY, zichtbaar: onderdeel.zichtbaar, reageertInKelder, reageertOpNul, drempelVoorTest };
});
check('Scheepslantaarn ligt binnen de kelderoost-footprint', lantaarnTest.inKelderoostFootprint, lantaarnTest);
check('Scheepslantaarn.y = -KELDER_DIEPTE (niet meer 0/bijkeuken)',
  lantaarnTest.onderdeelY === -3.3, lantaarnTest);
check('Fix 4: drempelGolf staat op 1 (altijd direct zichtbaar vanaf de eerste golf)',
  lantaarnTest.drempelVoorTest === 1, lantaarnTest);
check('Al vanaf golf 1 wordt de Scheepslantaarn zichtbaar, met mesh én interactiepunt op de juiste Y (-3.3)',
  lantaarnTest.zichtbaar && lantaarnTest.meshY === -3.3 && lantaarnTest.puntY === -3.3, lantaarnTest);
check('Het interactiepunt reageert IN kelderoost (Y=-KELDER_DIEPTE)',
  lantaarnTest.reageertInKelder === 'Scheepslantaarn', lantaarnTest);
check('Het interactiepunt reageert NIET op Y=0 (Y-marge-vangnet, zelfde als Pantserdrank in sectie 9)',
  lantaarnTest.reageertOpNul !== 'Scheepslantaarn', lantaarnTest);

// --- 15. Fix 3 v2 (feedback: "het licht van de kelder lijkt door de muur
// in het atelier te schijnen"): puntlichten in deze scene casten geen
// schaduw (op de ene shadow-invariant-lamp na), dus niets blokkeert hun
// licht — de enige manier om te voorkomen dat het trap-peertje door
// deur5/de nis-westmuur heen "schijnt" is zijn bereik (afstandscutoff) kort
// genoeg te houden. Bewaakt hier de regressie: bereik moet klein blijven
// (was 9, nu 3.5 — ruim genoeg voor de trapkoker zelf, te kort om de nis
// nog merkbaar te bereiken). --------------------------------------------
const kokerLampTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const kokerLampen = d.lampLichten.filter(l => l.licht.position.z === d.KELDERTRAP_CZ);
  return {
    aantal: kokerLampen.length,
    bereiken: kokerLampen.map(l => l.licht.distance),
  };
});
check('Er is precies 1 trap-koker-lamp (op KELDERTRAP_CZ)', kokerLampTest.aantal === 1, kokerLampTest);
check('Het bereik van de trap-koker-lamp is kort (<= 4m), niet de oude 9m die tot in de nis reikte',
  kokerLampTest.bereiken.every(b => b <= 4), kokerLampTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
