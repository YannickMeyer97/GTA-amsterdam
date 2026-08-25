// Ticket 135 (Ronde 10, §12.6): de randgevallen-tabel volledig implementeren
// en vastleggen — één test per rij. Vervolg op T134 (test-arsenaal-
// startwapen.mjs): dat bestand bewaakt de laadstaat/het koopPad/de V-Q-
// semantiek, dit bestand bewaakt wat er gebeurt op de RANDEN van het
// mes-vs-vuurwapen-onderscheid (Smederij/Ammo-kist zonder vuurwapen, Auto
// loader die zijn effect uitstelt, HUD-details, en de "nieuwe run"-reset).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Smederij met alleen een mes: weigert, met melding, geen aankoop ---
const smederijZonderWapen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  const geldVoor = d.spelStaat.geld;
  const prompt = d.smederijPunt.prompt();
  d.koopSmederij();
  return { geldVoor, geldNa: d.spelStaat.geld, prompt, wapenStaatNogNull: d.wapenStaat === null };
});
check('smederijPunt.prompt() meldt "geen wapen om te smeden" zolang het mes actief is',
  smederijZonderWapen.prompt === 'Er is geen wapen om te smeden', smederijZonderWapen);
check('koopSmederij() met alleen een mes schrijft geen geld af',
  smederijZonderWapen.geldNa === smederijZonderWapen.geldVoor, smederijZonderWapen);
check('...en verandert wapenStaat niet (blijft null, geen half-gesmeed wapen)',
  smederijZonderWapen.wapenStaatNogNull, smederijZonderWapen);

// --- 2. Ammo-kist met alleen een mes: zelfde weigering ---------------------
const ammoZonderWapen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  const geldVoor = d.spelStaat.geld;
  // ammoPunt zelf zit niet in de debug-hook (alleen smederijPunt, T132) —
  // via interactiePunten (wél geëxporteerd) opzoeken op naam.
  const ammoPunt = d.interactiePunten.find(p => p.naam === 'Ammo-kist');
  const prompt = ammoPunt.prompt();
  const statusVoor = d.WINKEL_STIJLEN.ammo.status();
  d.koopAmmo();
  return { geldVoor, geldNa: d.spelStaat.geld, prompt, statusVoor, wapenStaatNogNull: d.wapenStaat === null };
});
check('ammoPunt.prompt() meldt "geen vuurwapen" zolang het mes actief is',
  ammoZonderWapen.prompt === 'Er is geen vuurwapen om te bevoorraden', ammoZonderWapen);
check('WINKEL_STIJLEN.ammo.status() staat op "nvt" zolang het mes actief is (geen misleidende "beschikbaar"-puls)',
  ammoZonderWapen.statusVoor === 'nvt', ammoZonderWapen);
check('koopAmmo() met alleen een mes schrijft geen geld af',
  ammoZonderWapen.geldNa === ammoZonderWapen.geldVoor, ammoZonderWapen);
check('...en verandert wapenStaat niet', ammoZonderWapen.wapenStaatNogNull, ammoZonderWapen);

// --- 3. HUD met mes: 0/0, label "Mes", geen ster en geen ⟳ -----------------
// MOET hier staan, vóór sectie 4 hieronder de AMSTEL-9 koopt — dit is de
// laatste plek in dit bestand waar het mes nog actief is. Bevestigt dat de
// HUD-null-tak robuust blijft, ook na de geweigerde koop-pogingen in
// sectie 1/2 hierboven (geen state-lek van een mislukte aankoop).
const hudMetMes = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    ammo: document.getElementById('ammoUI').textContent,
    label: document.getElementById('wapenTekst').textContent,
  };
});
check('HUD-munitie is "0 / 0" met het mes actief (herbevestiging, ook na de aankooppogingen in sectie 1-2)',
  hudMetMes.ammo === '0 / 0', hudMetMes);
check('HUD-wapenlabel is kaal "Mes" (geen ster, geen ⟳) met het mes actief',
  hudMetMes.label === 'Mes', hudMetMes);

// --- 4. Smederij ná de eerste aankoop: ongewijzigd (regressie) ------------
const smederijMetWapen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  d.koopAmstel9();
  const geldVoor = d.spelStaat.geld;
  d.koopSmederij();
  return { geldNa: d.spelStaat.geld, geldVoor, gesmeed: d.wapenStaat.gesmeed };
});
check('Zodra de AMSTEL-9 actief is, werkt koopSmederij() gewoon (schrijft geld af, smeedt)',
  smederijMetWapen.geldNa < smederijMetWapen.geldVoor && smederijMetWapen.gesmeed === true, smederijMetWapen);

// --- 5. Ammo-kist ná de eerste aankoop: ongewijzigd (regressie) -----------
const ammoMetWapen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  d.wapenStaat.reserve = 0;
  const statusVoor = d.WINKEL_STIJLEN.ammo.status();
  d.koopAmmo();
  return { reserve: d.wapenStaat.reserve, kogels: d.AMMO_KIST_KOGELS, statusVoor };
});
check('Zodra een vuurwapen actief is, is de ammo-kist weer gewoon "beschikbaar" (niet "nvt")',
  ammoMetWapen.statusVoor !== 'nvt', ammoMetWapen);
check('...en koopAmmo() vult de reserve weer gewoon', ammoMetWapen.reserve === ammoMetWapen.kogels, ammoMetWapen);

// --- 6. Auto loader met alleen een mes: geen effect, maar de vlag blijft
// staan en werkt zodra je een vuurwapen koopt ------------------------------
// Nieuwe, verse pagina nodig: sectie 4/5 hierboven hebben de AMSTEL-9 al
// gekocht, en "Auto loader met alleen een mes" moet dat AAN kunnen tonen.
const { browser: browser2, page: page2, errs: errs2 } = await openAmsterdamUndead({ simuleerPointerLock: true });
const zelfladerZonderWapen = await page2.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  const geldVoor = d.spelStaat.geld;
  const wapenStaatVoor = d.wapenStaat;
  d.koopAutoHerlader();
  const naAankoop = {
    geldNa: d.spelStaat.geld, geldVoor,
    autoHerladerGekocht: d.autoHerladerGekocht,
    wapenStaatOngewijzigd: d.wapenStaat === wapenStaatVoor,   // nog steeds null
    wapenLabel: document.getElementById('wapenTekst').textContent,
  };
  // Nu een vuurwapen kopen: de al gezette vlag moet meteen effect hebben.
  d.koopAmstel9();
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 0;
  d.updateWapen(1 / 60);
  const naVuurwapen = {
    herladenGestart: d.wapenStaat.herladen,
    wapenLabel: document.getElementById('wapenTekst').textContent,
  };
  return { naAankoop, naVuurwapen };
});
check('De Zelflader is te koop en te betalen ook zonder vuurwapen (het is een blijvende upgrade, geen per-wapen-actie)',
  zelfladerZonderWapen.naAankoop.geldNa < zelfladerZonderWapen.naAankoop.geldVoor &&
  zelfladerZonderWapen.naAankoop.autoHerladerGekocht === true, zelfladerZonderWapen.naAankoop);
check('...maar heeft nog geen zichtbaar effect: wapenStaat blijft null, HUD blijft "Mes" (geen ⟳)',
  zelfladerZonderWapen.naAankoop.wapenStaatOngewijzigd && zelfladerZonderWapen.naAankoop.wapenLabel === 'Mes',
  zelfladerZonderWapen.naAankoop);
check('Zodra je daarna een vuurwapen koopt, werkt de eerder gekochte Zelflader meteen (auto-herladen start op een leeg magazijn)',
  zelfladerZonderWapen.naVuurwapen.herladenGestart === true, zelfladerZonderWapen.naVuurwapen);
check('...en de HUD toont dan ook meteen het ⟳-teken',
  zelfladerZonderWapen.naVuurwapen.wapenLabel.includes('⟳'), zelfladerZonderWapen.naVuurwapen);
await browser2.close();

// --- 7. V tijdens herladen [van het actieve vuurwapen] werkt gewoon -------
// Het mes staat los van de vuurwapen-staat — dat is juist het punt van
// "altijd op de achtergrond beschikbaar" (§12.6).
const vTijdensHerladen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = -0.3;
  d.cameraKick = 0;
  d.updateSpeler(0);
  d.camera.updateMatrixWorld(true);
  const VASTE_TRAITS = { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1.0, strompelt: false };
  const doel = d.spawnOndode(0, 'normaal', VASTE_TRAITS);
  doel.groep.position.set(0, 0, -1);
  doel.groep.updateMatrixWorld(true);
  doel.hp = 1000;
  d.wapenStaat.magazijn = 0;
  d.wapenStaat.reserve = 48;
  d.herladen();
  const herladenActief = d.wapenStaat.herladen;
  d.mesStaat.cooldownTimer = 0;
  const hpVoor = doel.hp;
  d.steekMes();
  return { herladenActief, hpNa: doel.hp, hpVoor, herladenNogSteedsActief: d.wapenStaat.herladen };
});
check('Testopstelling: het vuurwapen is daadwerkelijk aan het herladen',
  vTijdensHerladen.herladenActief === true, vTijdensHerladen);
check('Een steek tijdens het herladen van het vuurwapen doet gewoon schade (V/klik werkt altijd)',
  vTijdensHerladen.hpNa < vTijdensHerladen.hpVoor, vTijdensHerladen);
check('...en onderbreekt het lopende herladen niet (blijft herladen === true)',
  vTijdensHerladen.herladenNogSteedsActief === true, vTijdensHerladen);

// --- 8. Game over -> nieuwe run: terug naar alleen het mes -----------------
// De AMSTEL-9/Canal Ripper zijn aankopen BINNEN een run, net als de andere
// winkelupgrades — er is geen localStorage-opslag voor wapenStaten/
// actiefWapenNaam (in tegenstelling tot stadsarchief/highscore). "Opnieuw"/
// "Speel door" na gameOver() doen een echte location.reload() — dat testen
// we hier met een ECHTE page.reload(), niet een JS-only reset.
const voorReload = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 100000;
  if (!d.wapenStaten.drukspuit) d.koopAmstel9();
  if (!d.ratelaarGekocht) d.koopRatelaar();
  return {
    drukspuitBezeten: !!d.wapenStaten.drukspuit, ratelaarBezeten: !!d.wapenStaten.ratelaar,
    actiefWapenNaam: d.actiefWapenNaam, geld: d.spelStaat.geld,
  };
});
check('Testopstelling: vóór de reload zijn beide vuurwapens bezeten en actief niet meer "mes"',
  voorReload.drukspuitBezeten && voorReload.ratelaarBezeten && voorReload.actiefWapenNaam !== 'mes', voorReload);

await page.reload();
await page.waitForTimeout(800);   // zelfde laadmarge als openAmsterdamUndead()

const naReload = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    actiefWapenNaam: d.actiefWapenNaam,
    drukspuitStaat: d.wapenStaten.drukspuit, ratelaarStaat: d.wapenStaten.ratelaar,
    ratelaarGekocht: d.ratelaarGekocht, geld: d.spelStaat.geld,
  };
});
check('Na een page-reload (zelfde mechanisme als de Opnieuw-/Speel door-knop) is de speler weer terug bij alleen het mes',
  naReload.actiefWapenNaam === 'mes' && naReload.drukspuitStaat === null && naReload.ratelaarStaat === null
  && naReload.ratelaarGekocht === false, naReload);
check('...en het geld is ook terug naar de startwaarde (€0), niet de opgespaarde €100000 van vóór de reload',
  naReload.geld === 0, naReload);

const fails = report([...errs, ...errs2]);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
