// Ticket 146: de instapfase-machine (FINALE.md §2/§3). Vóór dit ticket was
// T bij de boot instant winst; nu start T een holdout van
// FINALE_INSTAP_DUUR seconden. Oorspronkelijk telde de timer alleen af
// zolang de speler bij de boot bleef staan (positie-eis) — Ticket 185 heeft
// die eis volledig geschrapt (eigenaar: "ik vind het einde niet super goed
// werken") en er een TWEEDE fase aan toegevoegd. Zie de toelichting bij
// Ticket 185 hieronder voor de huidige twee-fasen-opzet; de secties in dit
// bestand zijn dienovereenkomstig herschreven.
//
// Bewaakt hier (fase 1, overleven): T start de fase via het ECHTE
// interactiesysteem (positie + updateInteracties() + een echte KeyT); de
// timer loopt ALTIJD door, ongeacht waar de speler staat (T185); T nogmaals
// indrukken tijdens de fase doet niets; de HUD-tekst; doodgaan tijdens de
// fase is gewoon game over, met opgeruimde state; interactiePunten blijft
// ongewijzigd (13 sinds Ticket 183, was 14 vóór dat ticket — dit bestand
// toetst de invariant zelf via een delta-check, niet via een hardgecodeerd
// getal).
//
// Ticket 185 (secties 5+): de fase ná het overleven. Zodra de 30 seconden om
// zijn, valt instapActief weg (en daarmee alle escalatie — zie T147
// hieronder) en gaat `vertrekKlaar` aan: de speler moet terug naar de boot
// en daar T indrukken om daadwerkelijk te vertrekken (voltooiOntsnapping()).
// Bewaakt: de HUD-tekst in deze fase, de prompt bij de boot, dat T alleen
// hier weer iets doet, en dat doodgaan in DEZE fase ook gewoon game over is
// met opgeruimde vertrekKlaar-state.
//
// Ticket 147 (secties 9+): de vier escalatiekanalen uit FINALE.md §2
// beslissing 4 — budget-injectie, beeld (fog/lampdip/vignet), geluid
// (dreigingsvloer/boothoorn), en het eenmalige "laatste seconden"-moment.
// Bewaakt vooral het HERSTEL op elke exitpad: voltooiing, game over, en
// (sinds T185) dat de escalatie zelf stopt zodra fase 1 overgaat in fase 2
// — geen apart mechanisme daarvoor nodig, want alles is een pure functie
// van instapActief/instapTimer, en overleefdKlaarVoorVertrek() zet
// instapActief hard op false zodra de 30s om zijn.
//
// Wat hier NIET staat: de golfgrens-uitzondering (FINALE.md §2 beslissing 6,
// nu voor BEIDE fasen) — die staat in test-ontsnapping-vensters.mjs (sectie
// 7d/7f/7e), dat bestand bewaakt de wave-complete-tak al voor de rest van de
// ontsnappingsmachine.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// Zet de speler exact op het ontsnappingspunt (of ver weg ervan), en ververs
// huidigeInteractie via de ECHTE proximity-check — geen kortere weg.
async function zetSpelerBijBoot(bijBoot) {
  await page.evaluate((bijBoot) => {
    const d = window.AmsterdamUndeadDebug;
    if (bijBoot) {
      d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
    } else {
      d.speler.positie.set(0, 0, 0);   // woonkamer, ruim buiten elke interactieradius van de boot
    }
    d.updateInteracties();
  }, bijBoot);
}

async function bereidVluchtrouteVoor() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.vluchtOnderdelenOpgepakt = 3;
    d.spelStaat.golf = 10;   // een geldige ontsnappingsgolf
    d.toonOntsnappingspuntIndienKlaar();
    d.spelStaat.geld = 10000;
  });
}

// --- 1. T bij de boot start de instapfase, via het ECHTE interactiesysteem
// (positie + updateInteracties() + een echte KeyT-keydown) -----------------
await bereidVluchtrouteVoor();
await zetSpelerBijBoot(true);
const startTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geldVoor = d.spelStaat.geld;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  return {
    instapActief: d.instapActief,
    instapTimer: d.instapTimer,
    verwachtTimer: d.FINALE_INSTAP_DUUR,
    geldNa: d.spelStaat.geld,
    geldAfgetrokken: geldVoor - d.spelStaat.geld,
    winSchermDisplay: document.getElementById('winScherm').style.display,
    hudTekst: document.getElementById('ontsnappingVensterUI').textContent,
  };
});
check('Een echte KeyT-druk bij de boot start de instapfase (instapActief true, timer op volle duur)',
  startTest.instapActief === true && startTest.instapTimer === startTest.verwachtTimer, startTest);
check('Het geld gaat DIRECT af bij het starten, niet pas bij voltooiing (Ticket 184: ONTSNAPPING_PRIJS nu €1000)',
  startTest.geldAfgetrokken === 1000, startTest);
check('Er verschijnt nog GEEN winscherm — de fase moet eerst lopen',
  startTest.winSchermDisplay !== 'flex', startTest);
check('De HUD toont de live aftelling (Ticket 185: geen positie-eis meer, dus geen "zolang bij de boot"-voorwaarde)',
  startTest.hudTekst === `Overleef nog ${startTest.verwachtTimer}s`, startTest);

// --- 2. T nogmaals indrukken tijdens de instapfase doet niets (geen dubbele
// aftrek, timer springt niet terug naar de volle duur) ---------------------
const dubbeleTTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.instapTimer = 17;   // duidelijk verschillend van de volle duur
  const geldVoor = d.spelStaat.geld;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  return { geldNa: d.spelStaat.geld, geldVoor, timerNa: d.instapTimer };
});
check('Een tweede KeyT-druk tijdens de instapfase trekt geen geld nogmaals af',
  dubbeleTTest.geldNa === dubbeleTTest.geldVoor, dubbeleTTest);
check('...en zet de timer niet terug naar de volle duur (probeerOntsnapping() deed letterlijk niets)',
  dubbeleTTest.timerNa === 17, dubbeleTTest);

// --- 3. Ticket 185: de timer telt af via de ECHTE gameLoop, ONGEACHT waar de
// speler staat — de vroegere positie-eis (FINALE.md §2 beslissing 3) is
// volledig geschrapt. Getoetst op de boot ÉN ver weg ervan, om zeker te
// weten dat dit geen toevallige nabijheid is maar een echte, bewuste
// verandering. ---------------------------------------------------------
await zetSpelerBijBoot(true);
await page.evaluate(() => { window.AmsterdamUndeadDebug.instapTimer = 25; });
const tikBijBootTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.instapTimer;
  await new Promise(res => setTimeout(res, 400));   // wall-clock, de echte gameLoop draait door
  return { voor, na: d.instapTimer };
});
check('De instapTimer loopt af terwijl de speler bij de boot staat (echte gameLoop)',
  tikBijBootTest.na < tikBijBootTest.voor, tikBijBootTest);

await zetSpelerBijBoot(false);
const tikVerWegTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.instapTimer;
  await new Promise(res => setTimeout(res, 400));
  return { voor, na: d.instapTimer };
});
check('...en loopt EVENGOED af terwijl de speler ver van de boot staat (geen pauze meer, Ticket 185)',
  tikVerWegTest.na < tikVerWegTest.voor, tikVerWegTest);

// --- 4. Zodra de timer afloopt (ongeacht positie), sluit dat fase 1 af:
// instapActief valt weg, maar het winscherm verschijnt NOG NIET —
// `vertrekKlaar` gaat aan, en de speler moet eerst terug naar de boot
// (Ticket 185, het hart van de herschrijving). --------------------------
const voltooiingTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.instapTimer = 0.05;
  await new Promise(res => setTimeout(res, 200));   // echte gameLoop, ver van de boot
  return {
    instapActief: d.instapActief,
    vertrekKlaar: d.vertrekKlaar,
    winSchermDisplay: document.getElementById('winScherm').style.display,
    hudTekst: document.getElementById('ontsnappingVensterUI').textContent,
  };
});
check('Zodra de timer nul bereikt (ver van de boot) valt instapActief weg en gaat vertrekKlaar aan',
  voltooiingTest.instapActief === false && voltooiingTest.vertrekKlaar === true, voltooiingTest);
check('Er verschijnt nog GEEN winscherm — de speler moet eerst terug naar de boot',
  voltooiingTest.winSchermDisplay !== 'flex', voltooiingTest);
check('De HUD wijst de speler naar de boot',
  voltooiingTest.hudTekst === 'Overleefd! Ga naar de boot om te vertrekken', voltooiingTest);

// --- 5. Fase 2 (vertrekKlaar): T doet NIETS op afstand, maar start de
// vertrek-cinematiek (Ticket 186) zodra de speler bij de boot staat. De
// cinematiek zelf (camera, duur, geblokkeerde besturing, boot-animatie,
// geluid) heeft zijn eigen dekking in test-vertrek-cinematiek.mjs; hier
// wordt alleen de OVERGANG tussen de drie fasen bewaakt: vertrekKlaar ->
// cinematiek -> (uiteindelijk) winscherm. --------------------------------
const tOpAfstandTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  return { vertrekKlaar: d.vertrekKlaar, winSchermDisplay: document.getElementById('winScherm').style.display };
});
check('T op afstand doet niets tijdens vertrekKlaar (geen interactiepunt binnen bereik)',
  tOpAfstandTest.vertrekKlaar === true && tOpAfstandTest.winSchermDisplay !== 'flex', tOpAfstandTest);

await zetSpelerBijBoot(true);
const promptBijBootTest = await page.evaluate(() => window.AmsterdamUndeadDebug.ontsnappingsPunt.prompt());
check('De prompt bij de boot zegt "vertrek met de boot" tijdens vertrekKlaar',
  promptBijBootTest === 'Druk T: vertrek met de boot', { promptBijBootTest });

const echtVertrekTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  return {
    vertrekKlaar: d.vertrekKlaar,
    vertrekCinematiekActief: d.vertrekCinematiekActief,
    winSchermDisplay: document.getElementById('winScherm').style.display,
  };
});
check('T bij de boot start de vertrek-cinematiek: vertrekKlaar false, cinematiek actief, NOG geen winscherm',
  echtVertrekTest.vertrekKlaar === false && echtVertrekTest.vertrekCinematiekActief === true
  && echtVertrekTest.winSchermDisplay !== 'flex', echtVertrekTest);

// Cinematiek versneld afgerond (de duur/inhoud zelf heeft zijn eigen
// dekking) — puur om met een schone lei (winscherm zichtbaar) aan sectie 6
// te beginnen.
const cinematiekAfgerondTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.vertrekCinematiekTimer = 0.01;
  await new Promise(res => setTimeout(res, 100));
  return {
    vertrekCinematiekActief: d.vertrekCinematiekActief,
    winSchermDisplay: document.getElementById('winScherm').style.display,
  };
});
check('...en ná afloop van de cinematiek verschijnt alsnog het winscherm',
  cinematiekAfgerondTest.vertrekCinematiekActief === false && cinematiekAfgerondTest.winSchermDisplay === 'flex',
  cinematiekAfgerondTest);

// "Speel door" sluit het winscherm weer, zodat de volgende secties met een
// schone lei verder kunnen (zelfde knop als test-ontsnapping.mjs sectie 7).
await page.evaluate(() => { document.getElementById('speelDoorKnop').click(); });

// --- 6. Doodgaan TIJDENS de instapfase (fase 1) is gewoon game over — geen
// aparte faalstaat (FINALE.md §2 beslissing 3), en de instap-state wordt
// opgeruimd (checklist T146). Meteen ook FINALE.md §1.3's
// interactiePunten-invariant: de instapfase zelf hergebruikt het bestaande
// ontsnappingspunt en voegt er GEEN nieuwe aan toe — dus de lengte vóór het
// starten van de instap (met het escape-punt er al bij) moet exact gelijk
// blijven aan de lengte erna. -----------------------------------------------
await bereidVluchtrouteVoor();
await zetSpelerBijBoot(true);
const gameOverTijdensInstapTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const lengteVoorInstap = d.interactiePunten.length;   // escape-punt bestaat al (bereidVluchtrouteVoor())
  d.probeerOntsnapping();
  const instapActiefVoor = d.instapActief;
  const lengteTijdensInstap = d.interactiePunten.length;
  d.gameOver();
  return {
    lengteVoorInstap, lengteTijdensInstap,
    lengteNaGameOver: d.interactiePunten.length,
    instapActiefVoor,
    gameOverSchermDisplay: document.getElementById('gameOverScherm').style.display,
    instapActiefNa: d.instapActief,
    instapTimerNa: d.instapTimer,
  };
});
check('De instapfase liep daadwerkelijk toen de speler stierf (testopzet klopt)',
  gameOverTijdensInstapTest.instapActiefVoor === true, gameOverTijdensInstapTest);
check('gameOver() tijdens de instapfase toont gewoon het bestaande gameOver-scherm — geen aparte faalstaat',
  gameOverTijdensInstapTest.gameOverSchermDisplay === 'flex', gameOverTijdensInstapTest);
check('...en ruimt de instap-state op (instapActief false, timer 0)',
  gameOverTijdensInstapTest.instapActiefNa === false && gameOverTijdensInstapTest.instapTimerNa === 0,
  gameOverTijdensInstapTest);
check('interactiePunten verandert niet door het starten van de instapfase (geen nieuw punt erbij, FINALE.md §1.3)',
  gameOverTijdensInstapTest.lengteTijdensInstap === gameOverTijdensInstapTest.lengteVoorInstap,
  gameOverTijdensInstapTest);
check('...en ook niet door game over midden in de fase',
  gameOverTijdensInstapTest.lengteNaGameOver === gameOverTijdensInstapTest.lengteVoorInstap,
  gameOverTijdensInstapTest);

// --- 7. Ticket 185: doodgaan TIJDENS fase 2 (vertrekKlaar, overleefd maar
// nog niet bij de boot) is EVENEENS gewoon game over, en ruimt vertrekKlaar
// mee op — dezelfde discipline als sectie 6, nu voor de nieuwe fase. -------
await bereidVluchtrouteVoor();
const gameOverTijdensVertrekKlaarTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.gameOver = false;
  d.instapActief = false;
  d.vertrekKlaar = true;   // simuleer: net overleefd, nog onderweg naar de boot
  d.gameOver();
  return {
    gameOverSchermDisplay: document.getElementById('gameOverScherm').style.display,
    vertrekKlaarNa: d.vertrekKlaar,
    instapActiefNa: d.instapActief,
  };
});
check('gameOver() tijdens vertrekKlaar toont gewoon het bestaande gameOver-scherm',
  gameOverTijdensVertrekKlaarTest.gameOverSchermDisplay === 'flex', gameOverTijdensVertrekKlaarTest);
check('...en ruimt vertrekKlaar op (false), instapActief blijft ook false',
  gameOverTijdensVertrekKlaarTest.vertrekKlaarNa === false && gameOverTijdensVertrekKlaarTest.instapActiefNa === false,
  gameOverTijdensVertrekKlaarTest);

// =====================================================================
// Ticket 147: de vier escalatiekanalen. Nieuwe browser/page (de vorige
// eindigde in sectie 7 met spelStaat.gameOver === true), zelfde patroon als
// test-ontsnapping-vensters.mjs's wall-clock-sectie (b2/p2).
// =====================================================================
const { browser: browser2, page: page2, errs: errs2 } = await openAmsterdamUndead({ simuleerPointerLock: true });

async function startNieuweInstap() {
  await page2.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.spelStaat.gameOver = false;
    // Forceer een schone lei: een vorige sectie kan instapActief=true hebben
    // laten staan (bv. door zelf updateFinaleEscalatie() aan te roepen zonder
    // voltooiOntsnapping()) — probeerOntsnapping() hieronder is dan een no-op
    // (T146: T nogmaals indrukken doet niets), dus zonder deze reset start
    // "een nieuwe instap" soms helemaal niet opnieuw.
    d.instapActief = false;
    d.instapTimer = 0;
    // Ticket 185: idem voor vertrekKlaar, en het winscherm zelf — sectie 9
    // (surgeEnFogTest) roept d.voltooiOntsnapping() rechtstreeks aan, wat
    // winScherm hierna gewoon op 'flex' laat staan (geen "Speel door"-klik
    // ertussen). Zonder deze reset zou sectie 15's "nog geen winscherm"-check
    // altijd stiekem slagen, ongeacht of de echte logica dat zelf
    // bewerkstelligt — precies het soort zelfvervullende test dat niets
    // bewijst. Rechtstreeks de stijl resetten i.p.v. de knop te klikken:
    // die doet ook startBesturing()/initGeluid() opnieuw, wat hier niets
    // toevoegt en alleen de foutoppervlakte van deze helper vergroot.
    d.vertrekKlaar = false;
    document.getElementById('winScherm').style.display = 'none';
    // Ruim ook eventuele ondoden en het spawnbudget op: eerdere secties
    // injecteren FINALE_SURGE_BUDGET (65) via probeerOntsnapping(), en dat
    // budget teert pas over veel wall-clock-seconden af. Zonder reset hoopt
    // dat zich op over de vele awaits/setTimeouts in dit testbestand, spawnt
    // er een leger bij de boot, en duwt duwSpelerWegVanOndoden() de speler
    // permanent van het ontsnappingspunt af — precies het soort valse
    // negatief dat sectie 15 (de echte eind-tot-eind-proef) liet falen.
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.spelStaat.budget = 0;
    d.vluchtOnderdelenOpgepakt = 3;
    d.spelStaat.golf = 10;
    // Niet alleen d.ontsnappingsPunt nullen: dat verwijdert het OUDE punt
    // niet uit interactiePunten (dat gebeurt normaal via het bestaande
    // splice-patroon bij dood/reset, dat hier bewust wordt overgeslagen).
    // Zonder deze opruiming stapelen zich meerdere "De Ontsnapping"-objecten
    // op dezelfde positie op — updateInteracties() kiest dan altijd het
    // EERSTE (oudste) als huidigeInteractie, terwijl d.ontsnappingsPunt naar
    // het NIEUWSTE object wijst. De `huidigeInteractie === ontsnappingsPunt`-
    // check in updateFinaleInstap() faalt dan permanent (andere referentie,
    // zelfde positie) — precies de valse "speler niet bij boot"-bevriezing
    // die sectie 15 liet hangen.
    for (let i = d.interactiePunten.length - 1; i >= 0; i--) {
      if (d.interactiePunten[i].naam === 'De Ontsnapping') d.interactiePunten.splice(i, 1);
    }
    d.ontsnappingsPunt = null;
    d.toonOntsnappingspuntIndienKlaar();
    d.spelStaat.geld = 10000;
    d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
    d.updateInteracties();
    d.probeerOntsnapping();
  });
}

// --- 8/9. Budget-injectie + fog-escalatie tijdens de fase, en EXACT herstel
// bij voltooiing (FINALE.md §2 beslissing 4, §1.3-precedent voor herstel) --
const surgeEnFogTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  d.toonOntsnappingspuntIndienKlaar();
  d.spelStaat.geld = 10000;
  d.spelStaat.budget = 3;   // laag, zodat de injectie duidelijk meetbaar is
  d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
  d.updateInteracties();

  const budgetVoor = d.spelStaat.budget;
  const fogVoorStart = { near: d.scene.fog.near, far: d.scene.fog.far };
  d.probeerOntsnapping();
  const budgetToename = d.spelStaat.budget - budgetVoor;
  const fogSnapshotKlopt = d.finaleFogVan.near === fogVoorStart.near && d.finaleFogVan.far === fogVoorStart.far;

  d.instapTimer = d.FINALE_INSTAP_DUUR * 0.5;   // fractie 0.5
  d.updateFinaleEscalatie(0);   // dt=0: alleen de fog-write, geen pulstriggers
  const fogHalverwege = { near: d.scene.fog.near, far: d.scene.fog.far };
  const verwachtNearHalverwege = fogVoorStart.near * (1 - 0.5 * d.FINALE_FOG_KRIMP);

  d.instapTimer = 0;
  d.voltooiOntsnapping();

  return {
    budgetToename, verwachtToename: d.FINALE_SURGE_BUDGET,
    fogSnapshotKlopt, fogVoorStart, fogHalverwege, verwachtNearHalverwege,
    fogNaVoltooiing: { near: d.scene.fog.near, far: d.scene.fog.far },
    finaleFogVanNa: d.finaleFogVan,
  };
});
check('probeerOntsnapping() injecteert FINALE_SURGE_BUDGET in het bestaande spawnbudget (geen nieuw spawnpad)',
  surgeEnFogTest.budgetToename === surgeEnFogTest.verwachtToename, surgeEnFogTest);
check('finaleFogVan is exact de fog-snapshot van vóór het starten van de instap',
  surgeEnFogTest.fogSnapshotKlopt, surgeEnFogTest);
check('Op de helft van de fase is de mist merkbaar dichterbij gekropen (near krimpt volgens FINALE_FOG_KRIMP)',
  Math.abs(surgeEnFogTest.fogHalverwege.near - surgeEnFogTest.verwachtNearHalverwege) < 1e-9, surgeEnFogTest);
check('Na voltooiing staat de fog EXACT terug op de waarde van vóór de instap',
  surgeEnFogTest.fogNaVoltooiing.near === surgeEnFogTest.fogVoorStart.near
  && surgeEnFogTest.fogNaVoltooiing.far === surgeEnFogTest.fogVoorStart.far, surgeEnFogTest);
check('finaleFogVan is opgeruimd (null) na voltooiing — geen stale snapshot',
  surgeEnFogTest.finaleFogVanNa === null, surgeEnFogTest);

// --- 10. Fog-herstel via het ANDERE exitpad: game over midden in de fase --
const fogGameOverTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.vluchtOnderdelenOpgepakt = 3;
  d.spelStaat.golf = 10;
  d.ontsnappingsPunt = null;
  d.toonOntsnappingspuntIndienKlaar();
  d.spelStaat.geld = 10000;
  d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
  d.updateInteracties();
  const fogVoorStart = { near: d.scene.fog.near, far: d.scene.fog.far };
  d.probeerOntsnapping();
  d.instapTimer = d.FINALE_INSTAP_DUUR * 0.3;
  d.updateFinaleEscalatie(0);
  d.gameOver();
  return {
    fogVoorStart,
    fogNaGameOver: { near: d.scene.fog.near, far: d.scene.fog.far },
    finaleFogVanNa: d.finaleFogVan,
  };
});
check('Fog herstelt ook via gameOver() (los exitpad van voltooiOntsnapping())',
  fogGameOverTest.fogNaGameOver.near === fogGameOverTest.fogVoorStart.near
  && fogGameOverTest.fogNaGameOver.far === fogGameOverTest.fogVoorStart.far, fogGameOverTest);
check('finaleFogVan is ook na game over opgeruimd',
  fogGameOverTest.finaleFogVanNa === null, fogGameOverTest);

// --- 11. Lamp/vignet-"hartslag": dipt bij elke puls, en het interval krimpt
// naarmate het vertrek nadert (zelf-herstellend mechanisme, zie de
// toelichting bij FINALE_PULS_INTERVAL_START in de game-code) -------------
await startNieuweInstap();
const pulsTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.lampDipFactor = 1; d.vignetFlits = 0;
  d.instapTimer = d.FINALE_INSTAP_DUUR;   // fractie 0
  d.finalePulsTimer = 0;   // forceer dat deze update() meteen een puls afvuurt
  d.updateFinaleEscalatie(0.01);
  const pulsBijStart = { lampDip: d.lampDipFactor, vignet: d.vignetFlits, nieuwInterval: d.finalePulsTimer };

  d.lampDipFactor = 1; d.vignetFlits = 0;
  d.instapTimer = 0.5;   // fractie bijna 1
  d.finalePulsTimer = 0;
  d.updateFinaleEscalatie(0.01);
  const pulsBijEinde = { lampDip: d.lampDipFactor, vignet: d.vignetFlits, nieuwInterval: d.finalePulsTimer };

  return { pulsBijStart, pulsBijEinde, verwachtLampDip: d.FINALE_PULS_LAMPDIP };
});
check('Een puls dipt de lampen naar FINALE_PULS_LAMPDIP en zet vignetFlits op 1',
  pulsTest.pulsBijStart.lampDip === pulsTest.verwachtLampDip && pulsTest.pulsBijStart.vignet === 1, pulsTest);
check('Het pulsinterval is korter vlak vóór het vertrek dan bij het begin — het hart klopt sneller',
  pulsTest.pulsBijEinde.nieuwInterval < pulsTest.pulsBijStart.nieuwInterval, pulsTest);

// --- 12. Dreigingsgain-vloer: gegarandeerd hoorbaar tijdens de fase, ook
// zonder nabije ondoden — en weg zodra de fase voorbij is (zelf-herstellend:
// zie de Math.max()-toelichting in updateDreigingsAudio()) -----------------
const dreigingsTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);   // 0 ondoden binnen bereik: de proximity-term is 0
  d.dreigingsThrottleTimer = 0;   // forceer een echte write, geen throttle-skip
  d.updateDreigingsAudio(0.016);
  const doelTijdensInstap = d.dreigingsGainDoel;

  d.voltooiOntsnapping();   // sluit de instap uit sectie 11 af
  d.dreigingsThrottleTimer = 0;
  d.updateDreigingsAudio(0.016);
  const doelNaInstap = d.dreigingsGainDoel;

  return { doelTijdensInstap, doelNaInstap };
});
check('Zonder nabije ondoden dwingt de instapfase-vloer toch een hoorbare dreigingsgain af (> 0)',
  dreigingsTest.doelTijdensInstap > 0, dreigingsTest);
check('Na voltooiing valt de vloer weg — dreigingsgain terug naar 0 (geen nabije ondoden)',
  dreigingsTest.doelNaInstap === 0, dreigingsTest);

// --- 13. Boothoorn-interval: krimpt naarmate het vertrek nadert, valt na
// afloop vanzelf terug op BOOT_HOORN_HERHAAL_INTERVAL -----------------------
await startNieuweInstap();
const hoornTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.instapTimer = d.FINALE_INSTAP_DUUR;   // fractie 0
  d.bootHoornHerhaalTimer = 0.001;
  d.updateBootHoornHerhaling(0.01);
  const intervalBijStart = d.bootHoornHerhaalTimer;

  d.instapTimer = 0.5;   // fractie bijna 1
  d.bootHoornHerhaalTimer = 0.001;
  d.updateBootHoornHerhaling(0.01);
  const intervalBijEinde = d.bootHoornHerhaalTimer;

  d.instapTimer = 0;
  d.voltooiOntsnapping();
  d.bootHoornHerhaalTimer = 0.001;
  d.updateBootHoornHerhaling(0.01);   // ontsnappingsPunt bestaat nog (tot "Speel door"), dus dit vuurt nog
  const intervalNaInstap = d.bootHoornHerhaalTimer;

  return {
    intervalBijStart, intervalBijEinde, intervalNaInstap,
    BOOT_HOORN_HERHAAL_INTERVAL: d.BOOT_HOORN_HERHAAL_INTERVAL,
  };
});
check('Bij fractie 0 is het hoorn-interval nog de normale BOOT_HOORN_HERHAAL_INTERVAL',
  Math.abs(hoornTest.intervalBijStart - hoornTest.BOOT_HOORN_HERHAAL_INTERVAL) < 1e-9, hoornTest);
check('Vlak vóór het vertrek is het hoorn-interval merkbaar korter (richting FINALE_HOORN_INTERVAL_MIN)',
  hoornTest.intervalBijEinde < hoornTest.intervalBijStart, hoornTest);
check('Na de instapfase valt het interval terug naar de normale waarde — geen restore-code nodig',
  hoornTest.intervalNaInstap === hoornTest.BOOT_HOORN_HERHAAL_INTERVAL, hoornTest);

// --- 14. "Laatste seconden": één eenmalig, herkenbaar signaal -------------
await startNieuweInstap();
const laatsteSecondenTest = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tellerVoor = d.finaleLosgooienTeller;
  d.instapTimer = d.FINALE_LAATSTE_SECONDEN + 1;   // nog NET buiten het venster
  d.updateFinaleEscalatie(0.01);
  const nogNiet = d.finaleLosgooienTeller;

  d.instapTimer = d.FINALE_LAATSTE_SECONDEN - 0.1;   // net erbinnen
  d.updateFinaleEscalatie(0.01);
  const welGevuurd = d.finaleLosgooienTeller;

  d.instapTimer = 1;   // nog steeds binnen het venster
  d.updateFinaleEscalatie(0.01);
  const nogSteeds1x = d.finaleLosgooienTeller;

  return { tellerVoor, nogNiet, welGevuurd, nogSteeds1x };
});
check('Vóór het venster van FINALE_LAATSTE_SECONDEN vuurt het signaal nog niet',
  laatsteSecondenTest.nogNiet === laatsteSecondenTest.tellerVoor, laatsteSecondenTest);
check('Zodra de timer eronder zakt, vuurt het signaal precies 1x',
  laatsteSecondenTest.welGevuurd === laatsteSecondenTest.tellerVoor + 1, laatsteSecondenTest);
check('...en niet nogmaals, ook al blijft de timer daarna binnen het venster',
  laatsteSecondenTest.nogSteeds1x === laatsteSecondenTest.welGevuurd, laatsteSecondenTest);

// --- 15. Eind-tot-eind via de ECHTE gameLoop: escalatie zichtbaar tijdens de
// fase, en volledig hersteld zodra fase 1 via de ECHTE timer afloopt (geen
// handmatige voltooiOntsnapping()-aanroep) — de doorslaggevende proef dat de
// gameLoop-bedrading (updateFinaleEscalatie NA updateFinaleInstap) klopt.
// Ticket 185: het natuurlijke aflopen van de timer voltooit de ontsnapping
// NIET meer direct — het opent alleen vertrekKlaar. Deze sectie bewaakt dus
// tot dat punt (fog hersteld, vertrekKlaar aan, nog GEEN winscherm), en
// sectie 15b hierna maakt de reis af via een echte T-druk bij de boot. -----
await startNieuweInstap();
// Fog EXACT herstellen geldt alleen op het instant van herstelFinaleEscalatie()
// zelf — updateZoneFog() blijft daarna gewoon elk frame onafhankelijk richting
// zijn eigen doel interpoleren (bestaand, ongewijzigd gedrag). Een vaste
// wall-clock wachttijd ná voltooiing laat dus willekeurig veel extra frames
// lopen vóór het uitlezen, en drijft de gemeten waarde weg van de restore.
// Poll daarom per rAF-frame en lees fog in exact hetzelfde frame waarin
// instapActief false wordt — vóór een volgend frame de kans krijgt om
// updateZoneFog() nogmaals te draaien.
const eindTotEind = await page2.evaluate(() => new Promise((resolve) => {
  const d = window.AmsterdamUndeadDebug;
  // d.finaleFogVan (niet een verse scene.fog-meting hier): startNieuweInstap()
  // en deze evaluate() zijn twee losse afgeronde trips naar de browser, en
  // de echte gameLoop tikt gewoon door in de tussenliggende tijd — updateZoneFog()
  // kan scene.fog dus al een fractie hebben laten driften vóórdat dit blok
  // start. finaleFogVan is de snapshot die herstelFinaleEscalatie() ZELF
  // gebruikt, dus dat is de enige eerlijke referentiewaarde voor "exact terug".
  const fogVoor = { near: d.finaleFogVan.near, far: d.finaleFogVan.far };
  d.instapTimer = 0.15;   // kort genoeg om via echte wall-clock snel af te lopen
  let frame = 0;
  const tik = () => {
    frame++;
    if (!d.instapActief || frame > 300) {   // 300 frames (~5s bij 60fps) is ruim voldoende, anders test-fail i.p.v. hang
      resolve({
        fogVoor,
        instapActiefNa: d.instapActief,
        vertrekKlaarNa: d.vertrekKlaar,
        winSchermDisplay: document.getElementById('winScherm').style.display,
        fogNa: { near: d.scene.fog.near, far: d.scene.fog.far },
        finaleFogVanNa: d.finaleFogVan,
      });
    } else {
      requestAnimationFrame(tik);
    }
  };
  requestAnimationFrame(tik);
}));
const eindTotEindVoor = { fogVoor: eindTotEind.fogVoor };
const eindTotEindNa = eindTotEind;
check('Via de ECHTE gameLoop loopt de timer af en gaat vertrekKlaar aan — instapActief false, NOG geen winscherm',
  eindTotEindNa.instapActiefNa === false && eindTotEindNa.vertrekKlaarNa === true
  && eindTotEindNa.winSchermDisplay !== 'flex', eindTotEindNa);
check('...en de fog staat al terug op de waarde van vóór de fase (escalatie stopt bij fase 1, niet pas bij vertrek)',
  eindTotEindNa.fogNa.near === eindTotEindVoor.fogVoor.near && eindTotEindNa.fogNa.far === eindTotEindVoor.fogVoor.far,
  { eindTotEindVoor, eindTotEindNa });
check('finaleFogVan is opgeruimd zodra fase 1 natuurlijk afloopt',
  eindTotEindNa.finaleFogVanNa === null, eindTotEindNa);

// --- 15b. Vervolg op 15: de speler loopt (in de test: teleporteert) naar de
// boot en drukt T — dat start (Ticket 186) de vertrek-cinematiek, die na
// zijn eigen duur alsnog het winscherm toont. Bewaakt dat vertrekKlaar/
// startVertrekCinematiek() ook na een ECHTE, via de gameLoop bereikte
// fase-2-start nog gewoon werkt (niet alleen na de handmatige
// page.evaluate()-opzet van sectie 5). --------------------------------------
const vertrekNaEchteFaseTest = await page2.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(d.ontsnappingsPunt.positie.x, 0, d.ontsnappingsPunt.positie.z);
  d.updateInteracties();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  const naStart = { vertrekKlaar: d.vertrekKlaar, vertrekCinematiekActief: d.vertrekCinematiekActief };
  d.vertrekCinematiekTimer = 0.01;
  await new Promise(res => setTimeout(res, 100));
  return { ...naStart, winSchermDisplay: document.getElementById('winScherm').style.display };
});
check('T bij de boot start, ná een ECHTE fase-1-afloop, de vertrek-cinematiek',
  vertrekNaEchteFaseTest.vertrekKlaar === false && vertrekNaEchteFaseTest.vertrekCinematiekActief === true,
  vertrekNaEchteFaseTest);
check('...en die maakt de reis alsnog af tot het winscherm',
  vertrekNaEchteFaseTest.winSchermDisplay === 'flex', vertrekNaEchteFaseTest);

const fails = report([...errs, ...errs2]);
await browser.close();
await browser2.close();
process.exit(fails > 0 ? 1 : 0);
