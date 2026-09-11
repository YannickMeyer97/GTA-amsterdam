// Ticket 164 (v0.28, ronde 14): het startscherm opgeruimd.
//
// Drie zones, elk met een eigen taak: instellingen rechtsboven, één keuze in
// het midden, en het archief achter één knop met een paneel erachter.
//
// TWEE DINGEN OM TE WETEN OVER ESC. Het spel heeft géén eigen Esc-handler —
// pauzeren gebeurt doordat de BROWSER pointer lock loslaat, waarna
// `pointerlockchange` het startscherm toont. Het archiefpaneel is daardoor
// alleen bereikbaar terwijl het spel al gepauzeerd is, dus de Esc-listener
// van T164 kan het spel niet per ongeluk hervatten. Wat wél moest: Esc mag
// alleen iets doen als het paneel open staat, en verder overal met rust
// worden gelaten. Allebei wordt hier getoetst.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const leegArchief = (extra = {}) => ({
  ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, geld: 0,
  gekocht: [], actiefPerCategorie: {},
  actief: { kleurset: false, vlamTint: false, introMelodie: false },
  ...extra,
});

// --- 1. De drie zones bestaan, en het midden is leeggeruimd --------------
const zones = await page.evaluate(() => {
  const hoek = document.getElementById('instellingenHoek');
  const startscherm = document.getElementById('startscherm');
  return {
    hoekBestaat: !!hoek,
    // Alle drie de instellingen zitten IN de hoek, niet meer in het midden.
    geluidInHoek: !!hoek?.querySelector('#geluidKnop'),
    kwaliteitInHoek: !!hoek?.querySelector('#kwaliteitKnoppen'),
    gevoeligheidInHoek: !!hoek?.querySelector('#gevoeligheidSlider'),
    // De oude drie-knoppenrij is weg.
    oudeArchiefRij: !!document.getElementById('archiefUI'),
    // Het midden draagt de moeilijkheidskeuze en één archiefknop.
    moeilijkheidInMidden: !!startscherm?.querySelector('#moeilijkheidKnoppen'),
    archiefKnopInMidden: !!startscherm?.querySelector('#archiefOpenKnop'),
    // De itemlijst hoort NIET meer in het startscherm te staan.
    lijstInStartscherm: !!startscherm?.querySelector('#archiefWinkelLijst'),
    lijstBestaatWel: !!document.getElementById('archiefWinkelLijst'),
  };
});
check('De instellingenhoek bestaat en bevat alle drie de instellingen (geluid, beeldkwaliteit, muisgevoeligheid)',
  zones.hoekBestaat && zones.geluidInHoek && zones.kwaliteitInHoek && zones.gevoeligheidInHoek, zones);
check('De oude drie-knoppenrij (#archiefUI) bestaat niet meer',
  zones.oudeArchiefRij === false, zones);
check('Het midden draagt nog de moeilijkheidskeuze en één archiefknop',
  zones.moeilijkheidInMidden && zones.archiefKnopInMidden, zones);
check('De itemlijst staat niet meer in het startscherm, maar bestaat wel (in het paneel)',
  !zones.lijstInStartscherm && zones.lijstBestaatWel, zones);

// --- 1b. De rijen zeggen in woorden waar ze over gaan --------------------
// Bij de eerste versie van de hoek droegen de twee rijen alleen een emoji
// (🖥️ / 🖱️). Dat bleek onleesbaar: je zag drie knopjes "Laag/Normaal/Hoog"
// zonder te weten waar ze bij hoorden. Een emoji is een accent, geen label.
const labels = await page.evaluate(() => {
  const rijen = [...document.querySelectorAll('#instellingenHoek .instelRij')];
  const lees = (kind) => {
    const rij = rijen.find(r => r.querySelector(kind));
    const kop = rij?.querySelector('.instelKop');
    const icoon = kop?.querySelector('.instelIcoon');
    // Alleen de tekst, zonder het icoontje zelf.
    const zonderIcoon = kop ? kop.textContent.replace(icoon?.textContent ?? '', '').trim() : '';
    return {
      tekst: zonderIcoon,
      icoonPx: icoon ? parseFloat(getComputedStyle(icoon).fontSize) : 0,
      basisPx: rij ? parseFloat(getComputedStyle(rij).fontSize) : 0,
      koppeling: kop?.tagName === 'LABEL' ? kop.getAttribute('for') : null,
    };
  };
  return { kwaliteit: lees('#kwaliteitKnoppen'), muis: lees('#gevoeligheidSlider') };
});
check('De beeldkwaliteitsrij draagt een uitgeschreven kopje, niet alleen een emoji',
  /beeldkwaliteit/i.test(labels.kwaliteit.tekst), labels);
check('De muisrij draagt een uitgeschreven kopje, en dat kopje hoort bij de slider (<label for>)',
  /gevoeligheid/i.test(labels.muis.tekst) && labels.muis.koppeling === 'gevoeligheidSlider', labels);
check('De icoontjes zijn groter dan de omringende tekst — accent, geen ruis',
  labels.kwaliteit.icoonPx > labels.kwaliteit.basisPx
  && labels.muis.icoonPx > labels.muis.basisPx, labels);

// --- 2. Bij het laden staat het paneel dicht ----------------------------
const beginDicht = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const paneel = document.getElementById('archiefPaneel');
  return {
    hiddenAttribuut: paneel.hidden,
    // Het `hidden`-attribuut moet ook echt tot display:none leiden — een
    // display-regel in de CSS is specifieker en zou dat kunnen overschrijven.
    // Precies die fout zat er tijdens het bouwen in: het paneel stond altijd
    // open, met het hele startscherm verduisterd tot gevolg.
    berekendeDisplay: getComputedStyle(paneel).display,
    volgensSpel: d.archiefPaneelOpen(),
  };
});
check('Bij het laden is het archiefpaneel dicht — en `hidden` leidt ook echt tot display:none',
  beginDicht.hiddenAttribuut === true && beginDicht.berekendeDisplay === 'none'
  && beginDicht.volgensSpel === false, beginDicht);

// --- 3. Openen en sluiten via de knoppen --------------------------------
const openSluit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lockCalls = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = function (...a) { lockCalls++; return orig.apply(this, a); };

  document.getElementById('archiefOpenKnop').click();
  const naOpenen = {
    open: d.archiefPaneelOpen(),
    display: getComputedStyle(document.getElementById('archiefPaneel')).display,
    lijstGevuld: document.querySelectorAll('#archiefWinkelLijst .archiefRij').length,
  };
  document.getElementById('archiefSluitKnop').click();
  const naSluiten = { open: d.archiefPaneelOpen() };

  d.renderer.domElement.requestPointerLock = orig;
  return { naOpenen, naSluiten, lockCalls };
});
check('De archiefknop opent het paneel en vult meteen de lijst',
  openSluit.naOpenen.open && openSluit.naOpenen.display !== 'none'
  && openSluit.naOpenen.lijstGevuld > 0, openSluit);
check('Het kruisje sluit het paneel weer', openSluit.naSluiten.open === false, openSluit);
check('Openen en sluiten vragen geen pointer lock aan — het spel start dus niet (stopPropagation)',
  openSluit.lockCalls === 0, openSluit);

// --- 4. ESC: sluit een open paneel, en laat de rest met rust ------------
const escTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lockCalls = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = function (...a) { lockCalls++; return orig.apply(this, a); };
  const stuurEsc = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));

  // (a) Paneel open -> Esc sluit het.
  d.zetArchiefPaneel(true);
  stuurEsc();
  const naEscMetOpenPaneel = { open: d.archiefPaneelOpen(), lockCalls };

  // (b) Paneel dicht -> Esc doet niets bijzonders, en start zeker het spel niet.
  stuurEsc();
  stuurEsc();
  const naEscZonderPaneel = { open: d.archiefPaneelOpen(), lockCalls };

  d.renderer.domElement.requestPointerLock = orig;
  return { naEscMetOpenPaneel, naEscZonderPaneel };
});
check('Esc sluit een open archiefpaneel', escTest.naEscMetOpenPaneel.open === false, escTest);
check('Esc met open paneel start of hervat het spel niet',
  escTest.naEscMetOpenPaneel.lockCalls === 0, escTest);
check('Esc met gesloten paneel doet niets — de toets blijft verder ongemoeid',
  escTest.naEscZonderPaneel.open === false && escTest.naEscZonderPaneel.lockCalls === 0, escTest);

// --- 5. Klik op de gedimde achtergrond sluit; klik binnenin niet --------
const achtergrondTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetArchiefPaneel(true);
  document.getElementById('archiefPaneelBinnen').click();
  const naKlikBinnen = d.archiefPaneelOpen();
  document.getElementById('archiefPaneel').click();
  return { naKlikBinnen, naKlikBuiten: d.archiefPaneelOpen() };
});
check('Een klik binnen het paneel sluit het niet', achtergrondTest.naKlikBinnen === true, achtergrondTest);
check('Een klik op de gedimde achtergrond sluit het paneel wel', achtergrondTest.naKlikBuiten === false, achtergrondTest);

// --- 6. De badge telt wat je NU kunt kopen ------------------------------
const badge = await page.evaluate((basis) => {
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('archiefBadge');
  const meet = (archief) => {
    d.stadsarchief = { ...archief, versie: d.ARCHIEF_VERSIE };
    d.werkArchiefBadgeBij();
    return { tekst: el.textContent, verborgen: el.hidden, telling: d.archiefKoopbaarAantal() };
  };
  const armEnGeenPunten = meet(basis);
  // Ruim geld en punten: alles wat je nog niet hebt is koopbaar.
  const rijk = meet({ ...basis, geld: 999999, ontsnappingen: 99, hoogsteGolf: 99, headshotsTotaal: 9999 });
  // Alles al gekocht: er valt niets meer te kopen.
  const allesGekocht = meet({
    ...basis, geld: 999999, ontsnappingen: 99, hoogsteGolf: 99, headshotsTotaal: 9999,
    gekocht: d.ARCHIEF_ITEMS.map(i => i.id),
  });
  // Met alles ontgrendeld zijn de drie T86-items al BEZIT via hun oude
  // mijlpaal, dus die tellen niet als koopbaar. Verwachting dus dynamisch
  // bepalen in plaats van "alle items".
  d.stadsarchief = { ...basis, geld: 999999, ontsnappingen: 99, hoogsteGolf: 99, headshotsTotaal: 9999, versie: d.ARCHIEF_VERSIE };
  const verwachtRijk = d.ARCHIEF_ITEMS.filter(i => !d.bezitArchiefItem(i)).length;
  return { armEnGeenPunten, rijk, allesGekocht, totaal: d.ARCHIEF_ITEMS.length, verwachtRijk };
}, leegArchief());
check('Zonder geld en punten is er niets te kopen en is de badge verborgen',
  badge.armEnGeenPunten.telling === 0 && badge.armEnGeenPunten.verborgen === true, badge);
check('Met ruim geld en punten telt de badge precies wat koopbaar is (de drie T86-items zijn dan al bezit via hun oude mijlpaal)',
  badge.rijk.telling === badge.verwachtRijk && badge.verwachtRijk > 0
  && badge.rijk.verborgen === false && badge.rijk.tekst === String(badge.verwachtRijk), badge);
check('Is alles al gekocht, dan verdwijnt de badge weer',
  badge.allesGekocht.telling === 0 && badge.allesGekocht.verborgen === true, badge);

// --- 7. De verhuisde instellingen werken nog gewoon ---------------------
const instellingen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lockCalls = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = function (...a) { lockCalls++; return orig.apply(this, a); };

  const kwaliteitVoor = d.kwaliteitNu;
  document.querySelector('.kwaliteitKnop[data-kwaliteit="laag"]').click();
  const naKwaliteitKlik = d.kwaliteitNu;
  document.querySelector(`.kwaliteitKnop[data-kwaliteit="${kwaliteitVoor}"]`).click();

  const slider = document.getElementById('gevoeligheidSlider');
  const gevoeligheidVoor = d.muisGevoeligheidFactor;
  slider.value = '2';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  const naSlider = d.muisGevoeligheidFactor;

  d.renderer.domElement.requestPointerLock = orig;
  return { kwaliteitVoor, naKwaliteitKlik, herstel: d.kwaliteitNu, gevoeligheidVoor, naSlider, lockCalls };
});
check('De verhuisde kwaliteitsknoppen werken nog (en zetten de preset echt om)',
  instellingen.naKwaliteitKlik === 'laag' && instellingen.herstel === instellingen.kwaliteitVoor, instellingen);
check('De verhuisde gevoeligheidsslider werkt nog', instellingen.naSlider !== instellingen.gevoeligheidVoor, instellingen);
check('Klikken/schuiven in de instellingenhoek vraagt geen pointer lock aan',
  instellingen.lockCalls === 0, instellingen);

// --- 8. Opruimen -------------------------------------------------------
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
