// Ticket 146: de instapfase-machine (FINALE.md §2/§3). Vóór dit ticket was
// T bij de boot instant winst; nu start T een holdout van
// FINALE_INSTAP_DUUR seconden, en pas voltooiOntsnapping() toont het
// winscherm (dat scherm zelf, met score/stats/record, blijft ONGEWIJZIGD en
// is al gedekt door test-ontsnapping.mjs sectie 5).
//
// Bewaakt hier: T start de fase via het ECHTE interactiesysteem (positie +
// updateInteracties() + een echte KeyT); de timer loopt alleen terwijl de
// speler bij de boot staat (huidigeInteractie === ontsnappingsPunt) en
// pauzeert zodra hij wegloopt; T nogmaals indrukken tijdens de fase doet
// niets; de twee nieuwe HUD-teksten; doodgaan tijdens de fase is gewoon
// game over, met opgeruimde instap-state; interactiePunten blijft op 14.
//
// Ticket 147 (secties 8+): de vier escalatiekanalen uit FINALE.md §2
// beslissing 4 — budget-injectie, beeld (fog/lampdip/vignet), geluid
// (dreigingsvloer/boothoorn), en het eenmalige "laatste seconden"-moment.
// Bewaakt vooral het HERSTEL op elke exitpad: voltooiing, game over, en
// (via de bestaande pauzelogica uit T146) dat de escalatie zelf bevriest
// zolang de speler weg is van de boot — geen apart mechanisme daarvoor
// nodig, want alles is een pure functie van instapTimer.
//
// Wat hier NIET staat: de golfgrens-uitzondering (FINALE.md §2 beslissing 6)
// — die staat in test-ontsnapping-vensters.mjs (sectie 7d/7e), dat bestand
// bewaakt de wave-complete-tak al voor de rest van de ontsnappingsmachine.
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
check('Het geld gaat DIRECT af bij het starten, niet pas bij voltooiing',
  startTest.geldAfgetrokken === 2500, startTest);
check('Er verschijnt nog GEEN winscherm — de fase moet eerst lopen',
  startTest.winSchermDisplay !== 'flex', startTest);
check('De HUD toont de live aftelling zolang de speler bij de boot staat',
  startTest.hudTekst === `Losgooien… ${startTest.verwachtTimer}s`, startTest);

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

// --- 3. De timer telt af via de ECHTE gameLoop, zolang de speler bij de
// boot blijft staan ---------------------------------------------------------
await page.evaluate(() => { window.AmsterdamUndeadDebug.instapTimer = 25; });
const tikTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.instapTimer;
  await new Promise(res => setTimeout(res, 400));   // wall-clock, de echte gameLoop draait door
  return { voor, na: d.instapTimer };
});
check('De instapTimer loopt daadwerkelijk af terwijl de speler bij de boot staat (echte gameLoop)',
  tikTest.na < tikTest.voor, tikTest);

// --- 4. Weglopen PAUZEERT de timer; terugkomen HERVAT 'm (FINALE.md §2
// beslissing 3) --------------------------------------------------------
await zetSpelerBijBoot(false);
const pauzeTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.instapTimer;
  await new Promise(res => setTimeout(res, 400));
  return { voor, na: d.instapTimer, hudTekst: document.getElementById('ontsnappingVensterUI').textContent };
});
check('Weg van de boot verandert de timer NIET, ook al draait de gameLoop door',
  pauzeTest.na === pauzeTest.voor, pauzeTest);
check('De HUD toont de opdracht "Blijf bij de boot!" terwijl de fase gepauzeerd staat',
  pauzeTest.hudTekst === 'Blijf bij de boot!', pauzeTest);

await zetSpelerBijBoot(true);
const hervatTest = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.instapTimer;
  await new Promise(res => setTimeout(res, 400));
  return { voor, na: d.instapTimer };
});
check('Terug bij de boot hervat de timer het aftellen',
  hervatTest.na < hervatTest.voor, hervatTest);

// --- 5. Zodra de timer afloopt (nog steeds bij de boot), volgt
// voltooiOntsnapping() automatisch — het winscherm verschijnt vanzelf,
// zonder dat iets anders dan tijd hoeft te verstrijken ----------------------
await page.evaluate(() => { window.AmsterdamUndeadDebug.instapTimer = 0.05; });
await frames(page, 10);
const voltooiingTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    instapActief: d.instapActief,
    winSchermDisplay: document.getElementById('winScherm').style.display,
  };
});
check('Zodra de timer nul bereikt (bij de boot) volgt de fase vanzelf op: instapActief false, winscherm zichtbaar',
  voltooiingTest.instapActief === false && voltooiingTest.winSchermDisplay === 'flex', voltooiingTest);

// "Speel door" sluit het winscherm weer, zodat de volgende secties met een
// schone lei verder kunnen (zelfde knop als test-ontsnapping.mjs sectie 7).
await page.evaluate(() => { document.getElementById('speelDoorKnop').click(); });

// --- 6. Doodgaan TIJDENS de instapfase is gewoon game over — geen aparte
// faalstaat (FINALE.md §2 beslissing 3), en de instap-state wordt opgeruimd
// (checklist T146). Meteen ook FINALE.md §1.3's interactiePunten-invariant:
// de instapfase zelf hergebruikt het bestaande ontsnappingspunt en voegt er
// GEEN nieuwe aan toe — dus de lengte vóór het starten van de instap (met
// het escape-punt er al bij) moet exact gelijk blijven aan de lengte erna. -
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

// =====================================================================
// Ticket 147: de vier escalatiekanalen. Nieuwe browser/page (de vorige
// eindigde in sectie 6 met spelStaat.gameOver === true), zelfde patroon als
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
// fase, en volledig hersteld zodra de fase via de ECHTE timer afloopt (geen
// handmatige voltooiOntsnapping()-aanroep) — de doorslaggevende proef dat de
// gameLoop-bedrading (updateFinaleEscalatie NA updateFinaleInstap) klopt. --
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
check('Via de ECHTE gameLoop loopt de timer af en voltooit de fase vanzelf (winscherm verschijnt)',
  eindTotEindNa.instapActiefNa === false && eindTotEindNa.winSchermDisplay === 'flex', eindTotEindNa);
check('...en de fog staat na afloop EXACT terug op de waarde van vóór de fase',
  eindTotEindNa.fogNa.near === eindTotEindVoor.fogVoor.near && eindTotEindNa.fogNa.far === eindTotEindVoor.fogVoor.far,
  { eindTotEindVoor, eindTotEindNa });
check('finaleFogVan is opgeruimd na de echte, natuurlijke voltooiing',
  eindTotEindNa.finaleFogVanNa === null, eindTotEindNa);

const fails = report([...errs, ...errs2]);
await browser.close();
await browser2.close();
process.exit(fails > 0 ? 1 : 0);
