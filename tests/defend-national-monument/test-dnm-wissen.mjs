// Ticket D76 (audit 11, 12) — voortgang wissen en de camera-schok.
//
// De camera-schok staat standaard aan, kan uit, en dat wordt bewaard; uit
// betekent dat de camera stil blijft. "Voortgang wissen" in het
// ontgrendelpaneel vraagt eerst om bevestiging; pas de tweede klik wist de
// voortgang, de highscore en de hints, en zet Zwaar en Avond uit. Andere
// instellingen blijven.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
async function met(opties, fn) {
  const { browser, page, errs } = await openDefend(opties);
  try { return await fn(page); } finally { alleErrs.push(...errs); await browser.close(); }
}

// 1. De camera-schok.
const schok = await met({ simuleerPointerLock: true }, async page => {
  const uit = await page.evaluate(() => {
    const d = window.DamChaosDebug;
    return { standaard: d.instellingen.schok, knoppen: [...document.querySelectorAll('#schokKeuze .kwaliteitKnop.actief')].map(k => k.textContent) };
  });
  const meetCamera = () => page.evaluate(async () => {
    const d = window.DamChaosDebug;
    const ys = [];
    for (let i = 0; i < 12; i++) {
      d.zetCameraShake?.(1);
      await new Promise(r => requestAnimationFrame(r));
      ys.push(d.camera.position.y);
    }
    return Math.max(...ys) - Math.min(...ys);
  });
  uit.spreidingAan = await meetCamera();
  await page.click('#schokKeuze [data-schok="uit"]', { force: true }).catch(() => page.evaluate(() => window.DamChaosDebug.zetSchok(false)));
  uit.naUit = await page.evaluate(() => ({ schok: window.DamChaosDebug.instellingen.schok, bewaard: JSON.parse(localStorage.getItem('defendNationalMonumentInstellingen')).schok, knoppen: [...document.querySelectorAll('#schokKeuze .kwaliteitKnop.actief')].map(k => k.textContent) }));
  uit.spreidingUit = await meetCamera();
  return uit;
});
check('De camera-schok staat standaard aan', schok.standaard === true && schok.knoppen.join() === 'Aan', schok);
check('Met schok aan beweegt de camera bij een klap', schok.spreidingAan > 0.001, schok.spreidingAan);
check('Uitzetten: bewaard, en de knop staat op Uit', schok.naUit.schok === false && schok.naUit.bewaard === false && schok.naUit.knoppen.join() === 'Uit', schok.naUit);
check('Met schok uit blijft de camera stil', schok.spreidingUit < 1e-9, schok.spreidingUit);

const herladen = await met({ initScript: `localStorage.setItem('defendNationalMonumentInstellingen', JSON.stringify({ schok: false, volume: 0.5 }))` }, page => page.evaluate(() => ({ schok: window.DamChaosDebug.instellingen.schok, volume: window.DamChaosDebug.instellingen.volume })));
check('Na herladen blijft de schok uit', herladen.schok === false && herladen.volume === 0.5, herladen);
const kapot = await met({ initScript: `localStorage.setItem('defendNationalMonumentInstellingen', JSON.stringify({ schok: 'ja' }))` }, page => page.evaluate(() => window.DamChaosDebug.instellingen.schok));
check('Een ongeldige waarde valt terug op aan', kapot === true, kapot);

// 2. Voortgang wissen.
const vol = JSON.stringify({ bazen: { sloopkogel: true, dijkbreker: true, stoomwals: true, heimachine: true }, overwinningen: 3, sterren: 12 });
const init = `localStorage.setItem('defendNationalMonumentVoortgang', '${vol}');
  localStorage.setItem('defendNationalMonumentHighscore', JSON.stringify({ score: 5000, wave: 20, gewonnen: true, besteSterren: 3 }));
  localStorage.setItem('defendNationalMonumentHints', JSON.stringify(['bouwplek', 'baas']));
  localStorage.setItem('defendNationalMonumentInstellingen', JSON.stringify({ zwareNacht: true, avond: true, volume: 0.4, schok: false, gevoeligheid: 1.5 }));`;
const wis = await met({ initScript: init }, page => page.evaluate(async () => {
  const d = window.DamChaosDebug;
  const uit = {};
  document.getElementById('ontgrendelKnop').click();
  uit.voor = { open: d.ONTGRENDELINGEN.filter(o => d.ontgrendeld(o.id)).length, zwaar: d.spel.zwareNacht, avond: d.instellingen.avond };
  const knop = document.getElementById('voortgangWis');
  knop.click();
  uit.eersteKlik = { tekst: knop.textContent, sterren: d.voortgang.sterren, highscore: !!localStorage.getItem('defendNationalMonumentHighscore') };
  d.zetWisBevestiging(false);   // (de bevestiging vervalt na 4 s)
  knop.click();
  uit.naVerlopen = { sterren: d.voortgang.sterren, tekst: knop.textContent };
  knop.click();
  uit.na = {
    voortgang: JSON.parse(localStorage.getItem('defendNationalMonumentVoortgang')),
    highscore: localStorage.getItem('defendNationalMonumentHighscore'),
    hints: localStorage.getItem('defendNationalMonumentHints'), gezien: d.gezieneHints.size,
    open: d.ONTGRENDELINGEN.filter(o => d.ontgrendeld(o.id)).length,
    zwaar: d.instellingen.zwareNacht, spelZwaar: d.spel.zwareNacht, avond: d.instellingen.avond,
    behouden: { volume: d.instellingen.volume, schok: d.instellingen.schok, gevoeligheid: d.instellingen.gevoeligheid },
    teller: document.getElementById('ontgrendelTotaal').textContent, knop: document.getElementById('ontgrendelKnop').textContent,
    tekst: knop.textContent,
  };
  return uit;
}));
check('Vooraf: alles open, Zwaar en Avond aan', wis.voor.open === 5 && wis.voor.zwaar && wis.voor.avond, wis.voor);
check('De eerste klik vraagt om bevestiging en wist nog niets', /Zeker weten/.test(wis.eersteKlik.tekst) && wis.eersteKlik.sterren === 12 && wis.eersteKlik.highscore, wis.eersteKlik);
check('Na het verlopen van de bevestiging wist één klik nog steeds niets', wis.naVerlopen.sterren === 12 && /Zeker weten/.test(wis.naVerlopen.tekst), wis.naVerlopen);
check('De tweede klik wist voortgang, highscore en hints', wis.na.voortgang.sterren === 0 && wis.na.voortgang.overwinningen === 0 && Object.values(wis.na.voortgang.bazen).every(b => b === false) && wis.na.highscore === null && wis.na.hints === null && wis.na.gezien === 0, wis.na);
check('Alles weer op slot, Zwaar en Avond uit (ook voor de run die nog moet beginnen)', wis.na.open === 0 && !wis.na.zwaar && !wis.na.spelZwaar && !wis.na.avond && /Ontgrendelingen 0\/5/.test(wis.na.knop) && /0 sterren/.test(wis.na.teller), wis.na);
check('Volume, schok en gevoeligheid blijven', wis.na.behouden.volume === 0.4 && wis.na.behouden.schok === false && wis.na.behouden.gevoeligheid === 1.5, wis.na.behouden);
check('De knop staat daarna weer op "Voortgang wissen"', wis.na.tekst === 'Voortgang wissen', wis.na.tekst);

// 3. Het startscherm past, met de extra rij, ook op lage laptopschermen.
for (const [w, h] of [[1366, 580], [1280, 600], [1024, 640], [1280, 720]]) {
  const pas = await met({ contextOpties: { viewport: { width: w, height: h } } }, page => page.evaluate(() => {
    const b = document.getElementById('ontgrendelKnop').getBoundingClientRect();
    const t = document.querySelector('#startscherm h1').getBoundingClientRect();
    return { boven: t.top, onder: b.bottom, hoogte: innerHeight };
  }));
  check(`Startscherm ${w}×${h}: titel en alle instellingen binnen beeld`, pas.boven >= 0 && pas.onder <= pas.hoogte - 4, pas);
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
