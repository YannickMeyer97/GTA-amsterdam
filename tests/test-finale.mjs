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
// Wat hier NIET staat: escalatie (spawn-surge, audio/beeld) — dat is T147,
// met zijn eigen dekking bovenop dit bestand. Ook de golfgrens-uitzondering
// (FINALE.md §2 beslissing 6) staat NIET hier maar in
// test-ontsnapping-vensters.mjs (sectie 7d/7e) — dat bestand bewaakt de
// wave-complete-tak al voor de rest van de ontsnappingsmachine, en de
// uitzondering hoort daar in dezelfde context.
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

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
