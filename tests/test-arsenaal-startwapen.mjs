// Ticket 134 (Ronde 10, §12.3-12.5 + ontwerpbeslissing 95-100): AMSTEL-9 als
// kooppunt, de speler start met het mes. Dit bestand bewaakt precies de
// eisen uit het ticket — laadstaat, het koopPad, en de twee verschillende
// schakelsemantieken (V steekt altijd, Q wisselt alleen tussen bezeten
// vuurwapens en raakt na de eerste aankoop nooit meer het mes aan). De
// mes-MECHANIEK zelf (schade/bereik/cooldown/OB97) staat in test-mes.mjs.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Bij het laden: mes actief, geen enkel vuurwapen bezeten -----------
const laadStaat = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    actiefWapenNaam: d.actiefWapenNaam,
    drukspuitStaat: d.wapenStaten.drukspuit,
    ratelaarStaat: d.wapenStaten.ratelaar,
    ratelaarGekocht: d.ratelaarGekocht,
    wapenLabel: document.getElementById('wapenTekst').textContent,
    ammoLabel: document.getElementById('ammoUI').textContent,
    inHandGroepIsMes: d.inHandGroep === d.wapenMes,
    mesZichtbaar: d.wapenMes.visible,
  };
});
check('actiefWapenNaam start op "mes"', laadStaat.actiefWapenNaam === 'mes', laadStaat);
check('wapenStaten.drukspuit start op null (geen AMSTEL-9 bezeten)', laadStaat.drukspuitStaat === null, laadStaat);
check('wapenStaten.ratelaar start op null (geen Canal Ripper bezeten)', laadStaat.ratelaarStaat === null, laadStaat);
check('HUD-wapenlabel toont kaal "Mes" (geen ster, geen ⟳)', laadStaat.wapenLabel === 'Mes', laadStaat);
check('HUD-munitie toont "0 / 0"', laadStaat.ammoLabel === '0 / 0', laadStaat);
check('inHandGroep wijst bij het laden naar wapenMes', laadStaat.inHandGroepIsMes, laadStaat);
check('Het mesmodel is bij het laden zichtbaar (het is het gehouden startwapen)', laadStaat.mesZichtbaar === true, laadStaat);

// --- 1b. Feedback ná T134: zolang het mes het actieve wapen is, steekt de
// "schiet"-knop (linkermuisklik) ook — dezelfde knop als straks het
// vuurwapen bedient. Een echte mousedown-dispatch (niet d.steekMes()
// rechtstreeks), zodat dit ook de mousedown-handler zelf dekt, en vóór elke
// aankoop hierboven (wapenStaat moet nog steeds null zijn).
const klikSteekt = await page.evaluate(() => {
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
  d.mesStaat.cooldownTimer = 0;
  const hpVoor = doel.hp;
  const tellerVoor = d.mesSteekTeller;
  window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  return {
    hpNa: doel.hp, hpVoor, tellerNa: d.mesSteekTeller, tellerVoor,
    wapenStaatNogNull: d.wapenStaat === null,
  };
});
check('Een linkermuisklik roept met het mes actief steekMes() aan (het doel raakt schade, het geluid speelt)',
  klikSteekt.hpNa < klikSteekt.hpVoor && klikSteekt.tellerNa === klikSteekt.tellerVoor + 1, klikSteekt);
check('...zonder dat er een vuurwapen bij komt (wapenStaat blijft null)', klikSteekt.wapenStaatNogNull, klikSteekt);

// --- 2. Koop-pad: te weinig geld doet niets ---------------------------------
const teWeinig = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const geldVoor = d.AMSTEL9_PRIJS - 1;
  d.spelStaat.geld = geldVoor;
  d.koopAmstel9();
  return {
    geldVoor, geldNa: d.spelStaat.geld,
    drukspuitStaat: d.wapenStaten.drukspuit, actiefWapenNaam: d.actiefWapenNaam,
  };
});
check('Met te weinig geld (€AMSTEL9_PRIJS - 1) gebeurt er niets: geld ongewijzigd, geen aankoop, mes blijft actief',
  teWeinig.geldNa === teWeinig.geldVoor && teWeinig.drukspuitStaat === null && teWeinig.actiefWapenNaam === 'mes',
  teWeinig);

// --- 3. Koop-pad: met genoeg geld wordt de AMSTEL-9 het actieve wapen -----
const gekocht = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = d.AMSTEL9_PRIJS;
  const geldVoor = d.spelStaat.geld;
  d.koopAmstel9();
  return {
    geldNa: d.spelStaat.geld, geldVoor,
    drukspuitStaatBestaat: !!d.wapenStaten.drukspuit,
    actiefWapenNaam: d.actiefWapenNaam,
    inHandGroepIsDrukspuit: d.inHandGroep === d.WAPEN_DRUKSPUIT.groep,
    mesOnzichtbaar: d.wapenMes.visible === false,
    wapenLabel: document.getElementById('wapenTekst').textContent,
  };
});
check('Precies AMSTEL9_PRIJS wordt afgeschreven (geld gaat van AMSTEL9_PRIJS naar 0)', gekocht.geldNa === 0, gekocht);
check('wapenStaten.drukspuit bestaat na aankoop', gekocht.drukspuitStaatBestaat, gekocht);
check('De AMSTEL-9 wordt meteen het actieve wapen', gekocht.actiefWapenNaam === 'drukspuit', gekocht);
check('inHandGroep volgt mee naar de AMSTEL-9 (presentatiepad, OB100)', gekocht.inHandGroepIsDrukspuit, gekocht);
check('Het mesmodel is niet meer zichtbaar als "in de hand"', gekocht.mesOnzichtbaar, gekocht);
check('HUD toont nu het AMSTEL-9-label (niet meer "Mes")', gekocht.wapenLabel !== 'Mes', gekocht);

// --- 4. Nogmaals kopen is een no-op ----------------------------------------
const nogmaals = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const staatVoor = d.wapenStaten.drukspuit;
  d.spelStaat.geld = 100000;
  const geldVoor = d.spelStaat.geld;
  d.koopAmstel9();
  return { geldNa: d.spelStaat.geld, geldVoor, zelfdeStaatObject: d.wapenStaten.drukspuit === staatVoor };
});
check('Nogmaals koopAmstel9() aanroepen schrijft geen geld af (no-op)',
  nogmaals.geldNa === nogmaals.geldVoor, nogmaals);
check('Nogmaals kopen bouwt geen nieuwe wapenStaat (zelfde object)',
  nogmaals.zelfdeStaatObject, nogmaals);

// --- 5. Na aankoop schakelt V niet meer het actieve wapen, het steekt alleen
const vNaAankoop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const actiefVoor = d.actiefWapenNaam;
  d.mesStaat.cooldownTimer = 0;
  const tellerVoor = d.mesSteekTeller;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
  return { actiefVoor, actiefNa: d.actiefWapenNaam, tellerVoor, tellerNa: d.mesSteekTeller };
});
check('actiefWapenNaam blijft de AMSTEL-9 ná een V-druk (V wisselt het wapen niet)',
  vNaAankoop.actiefVoor === 'drukspuit' && vNaAankoop.actiefNa === 'drukspuit', vNaAankoop);
check('V riep wél steekMes() aan (de actie zelf werkt gewoon door)',
  vNaAankoop.tellerNa === vNaAankoop.tellerVoor + 1, vNaAankoop);

// --- 6. Q doet niets met precies één vuurwapen ------------------------------
const qMetEen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const actiefVoor = d.actiefWapenNaam;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
  return { actiefVoor, actiefNa: d.actiefWapenNaam };
});
check('Q doet niets zolang er maar één vuurwapen bezeten is',
  qMetEen.actiefVoor === qMetEen.actiefNa, qMetEen);

// --- 7. Q wisselt correct zodra de Canal Ripper er ook is ------------------
const qMetTwee = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = d.RATELAAR_PRIJS;
  d.koopRatelaar();
  const naAankoop = d.actiefWapenNaam;   // koopRatelaar() activeert 'm meteen
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
  const naEersteQ = d.actiefWapenNaam;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
  const naTweedeQ = d.actiefWapenNaam;
  return { naAankoop, naEersteQ, naTweedeQ };
});
check('Na het kopen van de Canal Ripper is die meteen actief',
  qMetTwee.naAankoop === 'ratelaar', qMetTwee);
check('Q wisselt nu daadwerkelijk tussen de twee bezeten vuurwapens (heen en terug)',
  qMetTwee.naEersteQ === 'drukspuit' && qMetTwee.naTweedeQ === 'ratelaar', qMetTwee);
check('Q komt nooit meer op "mes" terecht, ongeacht hoe vaak je wisselt',
  qMetTwee.naEersteQ !== 'mes' && qMetTwee.naTweedeQ !== 'mes', qMetTwee);

// --- 8. AMSTEL9_PRIJS/AMSTEL9_X/AMSTEL9_Z + het kooppunt zelf --------------
const kooppunt = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    prijs: d.AMSTEL9_PRIJS,
    x: d.AMSTEL9_X, z: d.AMSTEL9_Z,
    halfBreedte: d.HALF_BREEDTE,
    puntAanwezig: d.interactiePunten.includes(d.amstel9Punt),
    puntPositie: { x: d.amstel9Punt.positie.x, z: d.amstel9Punt.positie.z },
    obstakelsRaaktRek: d.obstakels.length,
  };
});
check('AMSTEL9_PRIJS = 450', kooppunt.prijs === 450, kooppunt);
check('AMSTEL9_X staat tegen de westmuur (-HALF_BREEDTE + 0.6)',
  Math.abs(kooppunt.x - (-kooppunt.halfBreedte + 0.6)) < 1e-9, kooppunt);
check('amstel9Punt staat in interactiePunten', kooppunt.puntAanwezig, kooppunt);
check('amstel9Punt volgt AMSTEL9_X/Z', kooppunt.puntPositie.x === kooppunt.x && kooppunt.puntPositie.z === kooppunt.z, kooppunt);
check('obstakels.length blijft 58 (het AMSTEL-9-rek heeft geen collision, net als het Ratelaar-rek)',
  kooppunt.obstakelsRaaktRek === 58, kooppunt);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
