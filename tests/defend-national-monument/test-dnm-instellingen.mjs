// Ticket D22 (SONNET_EXECUTION_PLAN_monument.md, fase 6) — instellingenscherm.
//
// Kwaliteit, muisgevoeligheid en geluid (sinds D64 een volumeschuif) op één plek in het startscherm (dat
// ook het pauzescherm is). Elke instelling werkt, overleeft een herladen,
// valt bij een corrupte sleutel stil terug, en klikken of slepen in het
// blok start het spel niet. De kwaliteit zelf toetst test-dnm-kwaliteit;
// hier alleen dat hij in hetzelfde blok staat.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
const KEY = 'defendNationalMonumentInstellingen';

async function met(opties, fn) {
  const { browser, page, errs } = await openDefend(opties);
  try { return await fn(page); } finally { alleErrs.push(...errs); await browser.close(); }
}
const bewaar = waarde => ({ initScript: `try { localStorage.setItem('${KEY}', ${JSON.stringify(waarde)}); } catch {}` });

// Draai de camera met een gesimuleerde muisbeweging van 100 px.
const draai = page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  const voor = d.speler.yaw;
  window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
  const na = d.speler.yaw;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return null; } });
  return voor - na;
});
const piepjes = page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.initGeluid();
  const voor = d.piepTeller();
  d.geldZet(0); d.koopUpgrade('vuurtempo');   // "Nog €… nodig": geen piep; dus een munt:
  d.verdienGeld(0);
  const teller0 = d.piepTeller();
  // Een geluid dat altijd klinkt: een robot kapot.
  d.spawnRobot(null, 'normal');
  d.vernietigRobot(d.robots[d.robots.length - 1], 'toren');
  return d.piepTeller() - teller0 + (teller0 - voor);
});

// 1. Standaard, en het blok staat op het startscherm.
const standaard = await met({}, async page => {
  const uit = await page.evaluate(() => {
    const blok = document.getElementById('instellingen');
    return {
      inStartscherm: !!blok?.closest('#startscherm'),
      labels: [...blok.querySelectorAll(':scope > span')].map(s => s.textContent.trim()),
      kwaliteitInBlok: !!blok.querySelector('#kwaliteitKeuze [data-kwaliteit]'),
      schuif: { min: blok.querySelector('#gevoeligheid').min, max: blok.querySelector('#gevoeligheid').max, waarde: document.getElementById('gevoeligheid').value },
      waardeTekst: document.getElementById('gevoeligheidWaarde').textContent,
      volume: document.getElementById('volume').value, volumeTekst: document.getElementById('volumeWaarde').textContent,
      instellingen: { ...window.DamChaosDebug.instellingen },
    };
  });
  // Ticket D64: het hoofdvolume volgt de schuif.
  uit.hoofd = await page.evaluate(() => { const d = window.DamChaosDebug; d.initGeluid(); d.zetVolume(40); const g = d.audio?.hoofdvolume?.gain.value; d.zetVolume(100); return g; });
  uit.draai = await draai(page);
  uit.piepjes = await piepjes(page);
  return uit;
});
check('Het instellingenblok staat op het startscherm met kwaliteit, muisgevoeligheid en geluid', standaard.inStartscherm && standaard.kwaliteitInBlok && ['Beeldkwaliteit', 'Muisgevoeligheid', 'Geluid'].every(l => standaard.labels.includes(l)), standaard);
check('Standaard: gevoeligheid 1,0× en volume 100%', standaard.instellingen.gevoeligheid === 1 && standaard.instellingen.volume === 1 && standaard.waardeTekst === '1,0×' && standaard.volume === '100' && standaard.volumeTekst === '100%', standaard);
check('D64: de volumeschuif zet het hoofdvolume waar alle geluiden doorheen gaan (40% → 0,4)', Math.abs(standaard.hoofd - 0.4) < 1e-6, standaard.hoofd);
check('Bij 1,0× draait 100 px muis de camera 0,22 rad', Math.abs(standaard.draai - 0.22) < 1e-9, standaard.draai);
check('Met geluid aan klinken er geluiden', standaard.piepjes > 0, standaard.piepjes);

// 2. Instellen via de knoppen en de schuif; het spel start niet.
const ingesteld = await met({}, async page => {
  // Volume naar 0 via de schuif (zoals slepen).
  await page.evaluate(() => { const v = document.getElementById('volume'); v.value = '0'; v.dispatchEvent(new Event('input', { bubbles: true })); });
  // De schuif naar 1,6 via het input-event (zoals slepen).
  await page.evaluate(() => { const s = document.getElementById('gevoeligheid'); s.value = '1.6'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#gevoeligheid');   // een klik op de schuif mag het spel niet starten
  const uit = await page.evaluate(() => ({
    instellingen: { ...window.DamChaosDebug.instellingen },
    tekst: document.getElementById('gevoeligheidWaarde').textContent,
    volumeTekst: document.getElementById('volumeWaarde').textContent,
    startschermZichtbaar: getComputedStyle(document.getElementById('startscherm')).display !== 'none',
    bewaard: localStorage.getItem('defendNationalMonumentInstellingen'),
  }));
  uit.draai = await draai(page);
  uit.piepjes = await piepjes(page);
  return uit;
});
check('Volume op 0 via de schuif: de tekst zegt "uit"', ingesteld.instellingen.volume === 0 && ingesteld.volumeTekst === 'uit', ingesteld);
check('Volume 0: er klinkt niets meer', ingesteld.piepjes === 0, ingesteld.piepjes);
check('Klikken op de schuif zet de gevoeligheid (hier ~1,6×; een klik midden op de schuif geeft ~1,2)', ingesteld.instellingen.gevoeligheid >= 0.3 && ingesteld.instellingen.gevoeligheid <= 2 && /×$/.test(ingesteld.tekst), ingesteld);
check('Klikken in het instellingenblok start het spel niet', ingesteld.startschermZichtbaar, ingesteld);
check('De keuze staat in localStorage', JSON.parse(ingesteld.bewaard).volume === 0, ingesteld.bewaard);

// 3. Overleeft een herladen: bewaard 1,6× en volume 35%.
const herladen = await met(bewaar(JSON.stringify({ gevoeligheid: 1.6, volume: 0.35 })), async page => {
  const uit = await page.evaluate(() => ({
    instellingen: { ...window.DamChaosDebug.instellingen },
    schuif: document.getElementById('gevoeligheid').value,
    tekst: document.getElementById('gevoeligheidWaarde').textContent,
    volume: document.getElementById('volume').value, volumeTekst: document.getElementById('volumeWaarde').textContent,
  }));
  uit.draai = await draai(page);
  uit.hoofd = await page.evaluate(() => { const d = window.DamChaosDebug; d.initGeluid(); return d.audio.hoofdvolume.gain.value; });
  return uit;
});
check('Na herladen: 1,6× en 35%, en de schuiven tonen dat', herladen.instellingen.gevoeligheid === 1.6 && herladen.instellingen.volume === 0.35 && herladen.schuif === '1.6' && herladen.tekst === '1,6×' && herladen.volume === '35' && herladen.volumeTekst === '35%', herladen);
check('Na herladen draait 100 px muis de camera 1,6 × zo ver', Math.abs(herladen.draai - 0.22 * 1.6) < 1e-9, herladen.draai);
check('Na herladen staat het hoofdvolume meteen op 35%', Math.abs(herladen.hoofd - 0.35) < 1e-6, herladen.hoofd);

// 3b. Een oude opslag (D22) met alleen "geluid: uit" wordt volume 0.
const oud = await met(bewaar(JSON.stringify({ gevoeligheid: 1, geluid: false })), async page => ({ instellingen: await page.evaluate(() => ({ ...window.DamChaosDebug.instellingen })), piepjes: await piepjes(page) }));
check('Oude opslag "geluid uit" wordt volume 0, en het blijft stil', oud.instellingen.volume === 0 && oud.piepjes === 0, oud);

// 4. Corrupte of onzinnige waarden: stille terugval, geen fout.
for (const [naam, waarde] of [['geen JSON', '{kapot'], ['buiten bereik', JSON.stringify({ gevoeligheid: 50, volume: 7 })], ['verkeerd type', JSON.stringify([1, 2])]]) {
  const r = await met(bewaar(waarde), page => page.evaluate(() => ({ ...window.DamChaosDebug.instellingen })));
  check(`Corrupte sleutel (${naam}): terugval op 1,0× en volume 100%`, r.gevoeligheid === 1 && r.volume === 1, r);
}

// 5. De kwaliteit en deze instellingen zitten elkaar niet in de weg.
const samen = await met({ initScript: `try { localStorage.setItem('defendNationalMonumentKwaliteit', 'laag'); localStorage.setItem('${KEY}', '${JSON.stringify({ gevoeligheid: 0.5, volume: 0.8 })}'); } catch {}` }, page =>
  page.evaluate(() => ({ kwaliteit: window.DamChaosDebug.kwaliteitStand(), ...window.DamChaosDebug.instellingen })));
check('Kwaliteit (eigen sleutel) en instellingen worden allebei gelezen', samen.kwaliteit === 'laag' && samen.gevoeligheid === 0.5 && samen.volume === 0.8, samen);

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
