// Ticket 62 (v0.19, §7.5.1-beslissing 54, herzien v5): kelder-trap +
// Y-beweging + deur 5.
//
// De kelder ligt (weer) op een ECHT disjuncte footprint: alles ten westen
// van de nis-westmuur, volledig buiten GRENS. Dat is de structurele reden
// dat berekenKelderY() weer puur functioneel kan zijn, en dat de speler
// nergens anders op de kaart kan stijgen of dalen. Deze suite bewaakt
// precies die drie gebruikerseisen:
//   (1) je moet deur 5 kopen voordat je omlaag kunt,
//   (2) de trap is de ENIGE plek waar Y ooit verandert,
//   (3) geen ondode kan er ooit komen (§7.5.2-beslissing 55).
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

// --- 7. Kelderruimte-afmetingen: atelier (9 x 15 = 135 m²) + 10% ----------
const afmetingen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    breedteX: d.KELDERTRAP_X_ONDER - d.KELDER_X_WEST,
    diepteZ: d.KELDER_Z_ZUID - d.KELDER_Z_NOORD,
    hoogte: d.KELDER_HOOGTE,
    kamerHoogte: d.KAMER_HOOGTE,
    atelierOppervlak: (d.KAMER2_HALF_B * 2) * (d.GANG_Z_EIND - d.KAMER2_Z_NOORD),
    grensMinZ: d.GRENS.minZ,
    zNoord: d.KELDER_Z_NOORD,
  };
});
check('Kelderruimte is atelier + ~10% (148,5 m² tegen 135 m²)',
  Math.abs(afmetingen.breedteX * afmetingen.diepteZ - afmetingen.atelierOppervlak * 1.1) < 0.5, afmetingen);
check('Kelderplafond is even hoog als het atelier (KELDER_HOOGTE === KAMER_HOOGTE)',
  afmetingen.hoogte === afmetingen.kamerHoogte, afmetingen);
check('De kelder blijft binnen GRENS.minZ, zodat de z-klem de speler niet uit de ruimte duwt',
  afmetingen.zNoord > afmetingen.grensMinZ, afmetingen);

// --- 8. EIS 3 (beslissing 55): de GRENS-bypass werkt ALLEEN met expliciet
// magKelderBinnen=true. Een ondode-achtige aanroep (het param weggelaten,
// exact zoals updateOndoden() dat doet) mag nooit voorbij GRENS.minX komen,
// ook niet nadat deur 5 gekocht is. ---------------------------------------
const veiligheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ondode = { x: -10, z: d.KELDERTRAP_CZ };
  for (let i = 0; i < 300; i++) { ondode.x -= 0.05; d.losBotsingenOp(ondode, 0.35); }
  const speler = { x: -10, z: d.KELDERTRAP_CZ };
  for (let i = 0; i < 300; i++) { speler.x -= 0.05; d.losBotsingenOp(speler, 0.35, true); }
  return { ondodeX: ondode.x, spelerX: speler.x, grensMinX: d.GRENS.minX };
});
check('Ondode-pad (zonder magKelderBinnen) blijft altijd geklemd op GRENS.minX, ook na aankoop',
  veiligheid.ondodeX >= veiligheid.grensMinX - 1e-9, veiligheid);
check('Speler-pad (met magKelderBinnen) mag wél voorbij GRENS.minX de kelder in',
  veiligheid.spelerX < veiligheid.grensMinX, veiligheid);

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

// --- 11. Feedback: kelder-balans — zombies mogen naar beneden, maar niet
// allemaal tegelijk. Zodra de speler ondergronds is (y < -0.05): (a) een
// ondode die op dat moment al dichtbij het deurgat staat (binnen
// KELDER_NABIJ_AFSTAND) krijgt magKelderBinnen en mag daarna, net als de
// speler, voorbij GRENS.minX de trap/kelder in; (b) die toestemming is
// PERMANENT (blijft staan ook als de ondode later weer ver van de deur
// afdwaalt of de speler weer boven komt); (c) een ondode die op dat moment
// NIET dichtbij stond, blijft geklemd op GRENS.minX en dwaalt in plaats
// daarvan rond binnen zijn eigen zone (nooit een andere zone in). ----------
const kelderBalans = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  // De speler kan sowieso nooit ondergronds staan zonder deur 5 gekocht te
  // hebben (zie secties 1-7) — kopen hier houdt de simulatie representatief.
  d.spelStaat.geld = 5000;
  d.koopDeur5();

  // Simuleer "speler is de trap afgedaald": een negatieve Y is voor
  // updateOndoden() het enige signaal dat ertoe doet (spelerInKelder).
  d.speler.positie.set(d.KELDER_X_WEST + 5, -d.KELDER_DIEPTE, (d.KELDER_Z_NOORD + d.KELDER_Z_ZUID) / 2);

  // A: al dichtbij het deurgat (1m) op het moment dat de speler afdaalt.
  const dichtbij = d.spawnOndode(0);
  dichtbij.groep.position.set(d.KAMER2_NIS_X_WEST - 1, 0, d.KELDERTRAP_CZ);
  // B: ver weg in hetzelfde atelier (zone 2), in de zuidoosthoek — ruim
  // buiten KELDER_NABIJ_AFSTAND, en ver genoeg dat ook het willekeurige
  // dwaalgedrag (kiesWanderDoel, 2-6m per stap) het tijdens de simulatie
  // hieronder onmogelijk kan binnenhalen (voorkomt een flaky test).
  const verWeg = d.spawnOndode(0);
  verWeg.groep.position.set(d.KAMER2_HALF_B - 0.5, 0, d.GANG_Z_EIND - 1);
  const eigenZoneVerWeg = d.zoneVan(verWeg.groep.position.x, verWeg.groep.position.z);

  const dt = 0.1;
  const verWegPosities = [];
  for (let tick = 0; tick < 100; tick++) {
    d.updateOndoden(dt);
    verWegPosities.push({ x: verWeg.groep.position.x, z: verWeg.groep.position.z });
  }
  const naVeleFrames = {
    dichtbijMagKelderBinnen: dichtbij.magKelderBinnen,
    dichtbijGebruiktTrap: dichtbij.groep.position.x < d.KAMER2_NIS_X_WEST && dichtbij.groep.position.y < -0.01,
    verWegMagKelderBinnen: verWeg.magKelderBinnen,
    verWegBleefInEigenZone: verWegPosities.every(p => d.zoneVan(p.x, p.z) === eigenZoneVerWeg),
    verWegKwamNooitVoorbijGrens: verWegPosities.every(p => p.x >= d.GRENS.minX - 1e-9),
    verWegBewoog: Math.hypot(
      verWegPosities[verWegPosities.length - 1].x - verWegPosities[0].x,
      verWegPosities[verWegPosities.length - 1].z - verWegPosities[0].z) > 0.3,
  };

  // Permanentie: speler komt weer boven (y=0) — dichtbij-ondode moet zijn
  // toestemming BEHOUDEN (geen enkele plek in updateOndoden mag hem terug op
  // false zetten).
  d.speler.positie.set(1.8, 0, 2.2);
  d.updateOndoden(dt);
  const permanentieNaBovenkomst = dichtbij.magKelderBinnen;

  return { ...naVeleFrames, permanentieNaBovenkomst };
});
check('Ondode die al dichtbij het deurgat stond, krijgt magKelderBinnen zodra de speler afdaalt',
  kelderBalans.dichtbijMagKelderBinnen, kelderBalans);
check('Die ondode gebruikt de trap ook echt: komt voorbij het deurgat en daalt af (y < 0)',
  kelderBalans.dichtbijGebruiktTrap, kelderBalans);
check('Ondode ver van de deur (zelfde zone) krijgt GEEN magKelderBinnen',
  kelderBalans.verWegMagKelderBinnen === false, kelderBalans);
check('Die ondode blijft ALTIJD geklemd op GRENS.minX (mag niet naar binnen)',
  kelderBalans.verWegKwamNooitVoorbijGrens, kelderBalans);
check('Die ondode dwaalt rond (beweegt merkbaar) i.p.v. stil te blijven staan',
  kelderBalans.verWegBewoog, kelderBalans);
check('Die ondode blijft tijdens het dwalen altijd in zijn EIGEN zone (geen zone-lek)',
  kelderBalans.verWegBleefInEigenZone, kelderBalans);
check('magKelderBinnen is PERMANENT: blijft true ook nadat de speler weer boven is',
  kelderBalans.permanentieNaBovenkomst, kelderBalans);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
