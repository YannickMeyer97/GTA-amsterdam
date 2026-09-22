// Ticket 186: het wegvaren, in eerste persoon. Afhankelijk van Ticket 185
// (de finale is dan al opgesplitst in fase 1 "overleven" en fase 2
// "vertrekKlaar"). Dit ticket voegt een DERDE fase toe: zodra de speler
// bij de boot T indrukt tijdens vertrekKlaar, start startVertrekCinematiek()
// in plaats van meteen voltooiOntsnapping() aan te roepen. Pas ná
// VERTREK_CINEMATIEK_DUUR seconden volgt alsnog het echte eindpunt.
//
// Bouwt bewust op wat er al bestaat: de boot-wegvaar-animatie zelf is
// dezelfde die al draaide wanneer het ontsnappingsvenster ongebruikt sloot
// (bootUitvarenActief/-Timer, updateBootPositie()) — er komt geen nieuwe
// bootbeweging bij, alleen een camera die 'm volgt. Bewaakt hier: dat de
// besturing/HUD ECHT hard uit gaan (het "ticket-let-op"), dat de camera
// daadwerkelijk met de boot meevaart en terugkijkt naar de kade, dat de
// cinematiek zichzelf na zijn duur afsluit naar het winscherm, en een
// regressietest voor een bug die tijdens het bouwen zelf gevonden is (de
// boot snapt terug naar de kade als bootUitvarenTimer eerder afloopt dan de
// cinematiek zelf).
import { openAmsterdamUndead, makeChecker, frames } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Brengt het spel naar precies vertrekKlaar: 3/3 vluchtroute, geldige
// ontsnappingsgolf, boot aangemeerd, 30 seconden al overleefd. Zet de speler
// exact bij de boot, ververst huidigeInteractie via de ECHTE proximity-check
// (geen kortere weg) — zelfde patroon als test-finale.mjs.
async function zetVertrekKlaarBijDeBoot() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.vluchtOnderdelenOpgepakt = 3;
    d.spelStaat.golf = 10;
    d.toonOntsnappingspuntIndienKlaar();
    d.spelStaat.geld = 10000;
    d.instapActief = false;
    d.instapTimer = 0;
    d.vertrekCinematiekActief = false;
    d.vertrekCinematiekTimer = 0;
    d.vertrekKlaar = true;
    d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
    d.updateInteracties();
  });
}

// --- 1. T bij de boot start de cinematiek, niet meteen het winscherm -------
await zetVertrekKlaarBijDeBoot();
const startTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geldVoor = d.spelStaat.geld;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  return {
    vertrekKlaar: d.vertrekKlaar,
    vertrekCinematiekActief: d.vertrekCinematiekActief,
    vertrekCinematiekTimer: d.vertrekCinematiekTimer,
    verwachtDuur: d.VERTREK_CINEMATIEK_DUUR,
    geldAfgetrokken: geldVoor - d.spelStaat.geld,
    winSchermDisplay: document.getElementById('winScherm').style.display,
    bootUitvarenActief: d.bootUitvarenActief,
  };
});
check('T bij de boot tijdens vertrekKlaar start de cinematiek (vertrekKlaar false, vertrekCinematiekActief true)',
  startTest.vertrekKlaar === false && startTest.vertrekCinematiekActief === true, startTest);
check('De timer staat op de volle VERTREK_CINEMATIEK_DUUR',
  startTest.vertrekCinematiekTimer === startTest.verwachtDuur, startTest);
check('Er wordt GEEN geld nogmaals afgeschreven (dat gebeurde al bij probeerOntsnapping())',
  startTest.geldAfgetrokken === 0, startTest);
check('Er verschijnt nog GEEN winscherm — de cinematiek moet eerst lopen',
  startTest.winSchermDisplay !== 'flex', startTest);
check('De bestaande boot-wegvaar-animatie is gestart (bootUitvarenActief true) — geen nieuwe bootbeweging gebouwd',
  startTest.bootUitvarenActief === true, startTest);

// --- 2. "De besturing moet hier hard uit, ook de touch-knoppen" -----------
const hudTest = await page.evaluate(() => ({
  hulpUI: document.getElementById('hulpUI').style.display,
  richtkruis: document.getElementById('richtkruis').style.display,
  ammoUI: document.getElementById('ammoUI').style.display,
  hudUI: document.getElementById('hudUI').style.display,
  minimapUI: document.getElementById('minimapUI').style.display,
  interactiePromptOpacity: document.getElementById('interactiePrompt').style.opacity,
  startschermDisplay: document.getElementById('startscherm').style.display,
}));
check('hulpUI/richtkruis/ammoUI/hudUI/minimapUI staan allemaal op display:none',
  hudTest.hulpUI === 'none' && hudTest.richtkruis === 'none' && hudTest.ammoUI === 'none'
  && hudTest.hudUI === 'none' && hudTest.minimapUI === 'none', hudTest);
check('Een eventueel zichtbare interactieprompt is verborgen (opacity 0) — sibling van hulpUI, niet vanzelf mee-verborgen',
  hudTest.interactiePromptOpacity === '0', hudTest);
check('De pauze-overlay (startscherm) popt NIET over de cinematiek heen',
  hudTest.startschermDisplay !== 'flex', hudTest);

// --- 3. Combat/besturing bevriest: spelActief valt weg zodra de cinematiek
// loopt, dus updateOndoden/updateWapen/schieten draaien niet meer. ---------
const bevriesTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ondoden.length = 0;
  d.spawnWillekeurigeOndode();
  const ondode = d.ondoden[0];
  const posVoor = { x: ondode.groep.position.x, z: ondode.groep.position.z };
  const geldVoor = d.spelStaat.geld;
  const spelerXVoor = d.speler.positie.x;
  // Simuleer invoer die tijdens normaal spel zou bewegen/schieten.
  d.ingedrukt['KeyW'] = true;
  d.schietKnopIngedrukt = true;
  return { posVoor, geldVoor, spelerXVoor };
});
await frames(page, 20);   // 20 echte gameLoop-frames, met "invoer" ingedrukt
const naBevriezing = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ondode = d.ondoden[0];
  d.ingedrukt['KeyW'] = false;
  d.schietKnopIngedrukt = false;
  return {
    posNa: { x: ondode.groep.position.x, z: ondode.groep.position.z },
    geldNa: d.spelStaat.geld,
    spelerXNa: d.speler.positie.x,
  };
});
check('De ondode beweegt niet (updateOndoden draait niet — spelActief false tijdens de cinematiek)',
  naBevriezing.posNa.x === bevriesTest.posVoor.x && naBevriezing.posNa.z === bevriesTest.posVoor.z,
  { voor: bevriesTest.posVoor, na: naBevriezing.posNa });
check('speler.positie verandert niet ondanks "KeyW ingedrukt" (updateSpeler() vertakt vroeg naar de cinematiek)',
  naBevriezing.spelerXNa === bevriesTest.spelerXVoor, { voor: bevriesTest.spelerXVoor, na: naBevriezing.spelerXNa });
check('Er wordt niet geschoten ondanks "vuurknop ingedrukt" (geen geldwijziging door raken/missen/munitiekosten)',
  naBevriezing.geldNa === bevriesTest.geldVoor, naBevriezing);

// --- 4. Herhaalde T-druk tijdens de cinematiek doet NIETS: geen dubbele
// afschrijving, geen herstart van probeerOntsnapping() (huidigeInteractie
// staat bevroren op ontsnappingsPunt, dus zonder guard zou dit opnieuw de
// hele overleef-fase kunnen starten middenin het vertrek). ------------------
const herhaaldeTTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geldVoor = d.spelStaat.geld;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  return {
    geldNa: d.spelStaat.geld,
    geldVoor,
    instapActief: d.instapActief,
    vertrekCinematiekActief: d.vertrekCinematiekActief,
  };
});
check('Een herhaalde T-druk tijdens de cinematiek schrijft geen geld nogmaals af',
  herhaaldeTTest.geldNa === herhaaldeTTest.geldVoor, herhaaldeTTest);
check('...en herstart NIET de overleef-fase (instapActief blijft false)',
  herhaaldeTTest.instapActief === false && herhaaldeTTest.vertrekCinematiekActief === true, herhaaldeTTest);

// --- 5. De camera vaart daadwerkelijk MET de boot mee, en kijkt TERUG naar
// de kade (zodat de kade/ondoden zichtbaar kleiner worden — het hele punt
// van "eerste persoon"). -----------------------------------------------------
await frames(page, 30);
const cameraVolgtBootTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    camX: d.camera.position.x, camZ: d.camera.position.z,
    bootX: d.bootGroep.position.x, bootZ: d.bootGroep.position.z,
    camYaw: d.camera.rotation.y, verwachtYaw: d.VERTREK_KIJK_YAW,
    camPitch: d.camera.rotation.x, camRoll: d.camera.rotation.z,
  };
});
check('camera.position.x/z volgt bootGroep.position.x/z exact',
  cameraVolgtBootTest.camX === cameraVolgtBootTest.bootX && cameraVolgtBootTest.camZ === cameraVolgtBootTest.bootZ,
  cameraVolgtBootTest);
check('camera.rotation.y staat vast op VERTREK_KIJK_YAW (terugkijken naar de kade)',
  cameraVolgtBootTest.camYaw === cameraVolgtBootTest.verwachtYaw, cameraVolgtBootTest);
check('Geen losse aim tijdens de cinematiek: pitch en roll staan vlak op 0',
  cameraVolgtBootTest.camPitch === 0 && cameraVolgtBootTest.camRoll === 0, cameraVolgtBootTest);

// Sanity-check op de kijkrichting zelf: het atan2(-fx,-fz)-recept moet echt
// naar de kade wijzen, niet er per ongeluk van weg. Onafhankelijk van de
// exacte constante herberekend uit de forward-vector-conventie van
// updateSpeler() (bewegingX/Z = (-sin,-cos) bij stapVooruit=1).
const kijkrichtingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const forward = { x: -Math.sin(d.VERTREK_KIJK_YAW), z: -Math.cos(d.VERTREK_KIJK_YAW) };
  const naarKade = { x: d.BOOT_DOK_X - d.BOOT_VERTREK_X, z: d.BIJKEUKEN_CZ - d.BOOT_VERTREK_Z };
  const lengte = Math.hypot(naarKade.x, naarKade.z);
  return { dot: (forward.x * naarKade.x + forward.z * naarKade.z) / lengte };
});
check('De camera-forward-vector wijst (nagenoeg) exact naar de kade (dot product ≈ 1)',
  Math.abs(kijkrichtingTest.dot - 1) < 1e-9, kijkrichtingTest);

// --- 6. Instap-dip: het beeld zakt van de normale stahoogte naar de lagere
// boothoogte in de eerste VERTREK_INSTAP_DUUR seconden. ---------------------
const { browser: browser2, page: page2, errs: errs2 } = await openAmsterdamUndead({ simuleerPointerLock: true });
async function zetVertrekKlaarBijDeBoot2() {
  await page2.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.vluchtOnderdelenOpgepakt = 3;
    d.spelStaat.golf = 10;
    d.toonOntsnappingspuntIndienKlaar();
    d.spelStaat.geld = 10000;
    d.vertrekKlaar = true;
    d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
    d.updateInteracties();
  });
}
await zetVertrekKlaarBijDeBoot2();
const dipTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Direct na de keydown, VÓÓR de eerste gameLoop-tick van de cinematiek
  // zelf: camera.position.y is op dit exacte synchrone moment nog gewoon de
  // normale speler-camera (updateVertrekCinematiek() heeft nog niet
  // gedraaid). Vergelijk daarom rechtstreeks met speler.hoogte, NIET met
  // bootGroep.position.y erbij — de boot heeft zijn eigen, onafhankelijke
  // deining (golfHoogte()) en die twee waarden hebben op dit instant nog
  // niets met elkaar te maken.
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  const camYBijStart = d.camera.position.y;
  d.vertrekCinematiekTimer = d.VERTREK_CINEMATIEK_DUUR - d.VERTREK_INSTAP_DUUR;   // exact aan het eind van de dip
  d.updateVertrekCinematiek(0);
  // Ná deze aanroep zet updateVertrekCinematiek() camera.position.y WEL
  // expliciet als bootGroep.position.y + oogHoogte, dus hier is aftrekken
  // om alleen de oogHoogte-component te isoleren correct.
  const camYNaDip = d.camera.position.y - d.bootGroep.position.y;
  return {
    camYBijStart, camYNaDip,
    verwachtBijStart: d.speler.hoogte,
    verwachtNaDip: d.VERTREK_OOGHOOGTE_BOOT,
  };
});
// Ruimere tolerantie dan de andere gelijkheidschecks hier: camYBijStart is
// de normale speler-camera zoals het LAATSTE voltooide gameLoop-frame 'm
// achterliet, inclusief het bestaande loopwieg-restje (Ticket 92,
// camera.position.y += bobOffset) — dat is geen bug van deze cinematiek,
// gewoon ruis die er al was vóórdat T186's eigen code ooit draait.
check('Bij de start van de cinematiek staat het oog nog op de normale stahoogte (boven de boot)',
  Math.abs(dipTest.camYBijStart - dipTest.verwachtBijStart) < 0.05, dipTest);
check('Aan het eind van de instap-dip staat het oog op de lagere boothoogte',
  Math.abs(dipTest.camYNaDip - dipTest.verwachtNaDip) < 1e-9, dipTest);

// --- 7. Regressie: de boot snapt NIET terug naar de kade als
// bootUitvarenTimer (5s, ONTSNAPPING_AANKONDIGING_DUUR) afloopt terwijl de
// cinematiek (6s, VERTREK_CINEMATIEK_DUUR) nog loopt. Gevonden tijdens het
// bouwen: ontsnappingsPunt bestaat op dat moment nog gewoon (blijft tot
// "Speel door"), dus zonder de vertrekCinematiekActief-uitzondering in
// updateBootPositie() koos de else-if-keten daar de "aangemeerd"-tak. -------
const snapBackTest = await page2.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.bootUitvarenTimer = 0.01;      // vlak vóór het vanzelf aflopen
  d.vertrekCinematiekTimer = 2;    // de cinematiek zelf heeft nog ruim de tijd
  await new Promise(res => setTimeout(res, 150));   // ruim genoeg voor bootUitvarenTimer om te verlopen
  return {
    bootUitvarenActief: d.bootUitvarenActief,
    bootX: d.bootGroep.position.x,
    verwacht: d.BOOT_VERTREK_X,
    vertrekCinematiekActief: d.vertrekCinematiekActief,
  };
});
check('Zodra bootUitvarenActief vanzelf afloopt is bootUitvarenActief false (testopzet klopt)',
  snapBackTest.bootUitvarenActief === false, snapBackTest);
check('De boot blijft op BOOT_VERTREK_X staan — GEEN snap terug naar de kade zolang de cinematiek nog loopt',
  snapBackTest.bootX === snapBackTest.verwacht, snapBackTest);

// --- 8. De cinematiek sluit zichzelf af: na VERTREK_CINEMATIEK_DUUR volgt
// automatisch voltooiOntsnapping() (winscherm), via de ECHTE gameLoop. -----
const eindeTest = await page2.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.vertrekCinematiekTimer = 0.1;
  let frame = 0;
  await new Promise((resolve) => {
    const tik = () => {
      frame++;
      if (!d.vertrekCinematiekActief || frame > 60) resolve();
      else requestAnimationFrame(tik);
    };
    requestAnimationFrame(tik);
  });
  return {
    vertrekCinematiekActief: d.vertrekCinematiekActief,
    winSchermDisplay: document.getElementById('winScherm').style.display,
  };
});
check('Ná afloop van de cinematiek is vertrekCinematiekActief false en verschijnt het winscherm',
  eindeTest.vertrekCinematiekActief === false && eindeTest.winSchermDisplay === 'flex', eindeTest);

// --- 9. "De fase moet netjes opruimen als er iets tussenkomt": gameOver()
// tijdens de cinematiek ruimt vertrekCinematiekActief op. In de praktijk kan
// de speler hier niet sterven (spelActief valt weg zodra de cinematiek
// start), maar de opruimdiscipline moet net als bij instapActief/vertrekKlaar
// hiervoor beschermen. ------------------------------------------------------
await zetVertrekKlaarBijDeBoot2();
const gameOverTijdensCinematiekTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  const cinematiekActiefVoor = d.vertrekCinematiekActief;
  d.spelStaat.gameOver = false;
  d.gameOver();
  return {
    cinematiekActiefVoor,
    gameOverSchermDisplay: document.getElementById('gameOverScherm').style.display,
    vertrekCinematiekActiefNa: d.vertrekCinematiekActief,
  };
});
check('De cinematiek liep daadwerkelijk toen gameOver() werd aangeroepen (testopzet klopt)',
  gameOverTijdensCinematiekTest.cinematiekActiefVoor === true, gameOverTijdensCinematiekTest);
check('gameOver() toont gewoon het bestaande gameOver-scherm',
  gameOverTijdensCinematiekTest.gameOverSchermDisplay === 'flex', gameOverTijdensCinematiekTest);
check('...en ruimt vertrekCinematiekActief op (false)',
  gameOverTijdensCinematiekTest.vertrekCinematiekActiefNa === false, gameOverTijdensCinematiekTest);

// --- 10. Geluid: de motor is een eigen, nieuw registry-geluid (geen bestaand
// geluid hergebruikt voor een andere betekenis), met een ruislaag voor het
// motorkarakter (T154-primitief, geen nieuwe audio-machinerie). -------------
const geluidTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const motor = d.GELUIDEN.bootMotor;
  return {
    bestaat: motor !== undefined,
    categorie: motor?.categorie,
    heeftRuis: motor?.ruis !== undefined,
    duurRuimVoldoendeVoorDeCinematiek: motor?.duur > 0 && motor?.duur <= d.VERTREK_CINEMATIEK_DUUR,
  };
});
check('GELUIDEN.bootMotor bestaat, categorie "boot", met een ruislaag (motorgeronk)',
  geluidTest.bestaat && geluidTest.categorie === 'boot' && geluidTest.heeftRuis, geluidTest);
check('De motorduur past binnen de cinematiek (geen geluid dat na het winscherm nog doorloopt)',
  geluidTest.duurRuimVoldoendeVoorDeCinematiek, geluidTest);

const fails = report([...errs, ...errs2]);
await browser.close();
await browser2.close();
process.exit(fails > 0 ? 1 : 0);
