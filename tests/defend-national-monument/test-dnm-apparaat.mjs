// Ticket D77 (audit 13), herzien in D86 (fase T) — de uitleg op een
// apparaat zonder muis.
//
// Sinds fase T is de game op een telefoon speelbaar. Op een apparaat zonder
// muis zegt het startscherm daarom: speel liggend, op een iPhone "Zet op
// beginscherm" (niet als je al vanaf het beginscherm speelt), en hoe je
// geluid krijgt. index.html zegt bij deze game dat hij ook op een telefoon
// werkt. Met een muis zie je die melding niet. Na de eerste aanraking volgen
// de uitleg op het startscherm en de hints de touchbediening.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
const mobiel = { isMobile: true, hasTouch: true, viewport: { width: 640, height: 400 } };

for (const [naam, opties] of [['telefoon', mobiel], ['computer', {}]]) {
  const { browser, page, errs } = await openDefend({ contextOpties: opties });
  const r = await page.evaluate(() => {
    const el = document.getElementById('apparaatMelding');
    const b = el.getBoundingClientRect();
    const m = document.getElementById('menuLink')?.getBoundingClientRect();
    const raakt = m && m.width > 0 && Math.min(b.right, m.right) - Math.max(b.left, m.left) > 0 && Math.min(b.bottom, m.bottom) - Math.max(b.top, m.top) > 0;
    const advies = el.querySelector('.beginscherm');
    return { zichtbaar: getComputedStyle(el).display !== 'none', tekst: el.textContent, adviesZichtbaar: advies && getComputedStyle(advies).display !== 'none', binnen: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, raakt };
  });
  if (naam === 'telefoon') {
    check('Telefoon: het startscherm zegt speel liggend, Zet op beginscherm en de stille modus; binnen beeld, vrij van de menuknop', r.zichtbaar && /liggend/.test(r.tekst) && /Zet op beginscherm/.test(r.tekst) && /stille modus/.test(r.tekst) && r.adviesZichtbaar && r.binnen && !r.raakt, r);
    check('De oude melding ("kun je (nog) niet spelen") is weg', !/niet spelen|toetsenbord/.test(r.tekst), r.tekst);
  } else check('Computer: geen melding', !r.zichtbaar, r);
  await page.goto(page.url().replace(/defend-national-monument\.html.*$/, 'index.html'));
  const idx = await page.evaluate(() => {
    const el = document.querySelector('.kaart p.apparaat');
    return { zichtbaar: !!el && getComputedStyle(el).display !== 'none', tekst: el?.textContent, kaart: document.querySelector('.kaart p').textContent };
  });
  if (naam === 'telefoon') check('Telefoon: index.html zegt bij Defend National Monument dat hij op je telefoon werkt', idx.zichtbaar && /telefoon/.test(idx.tekst) && /liggend/.test(idx.tekst), idx);
  else check('Computer: in index.html geen melding, en de kaart beschrijft de huidige game', !idx.zichtbaar && /torens/.test(idx.kaart) && /20 waves/.test(idx.kaart), idx);
  alleErrs.push(...errs);
  await browser.close();
}

// Vanaf het beginscherm (iPhone: navigator.standalone): geen beginscherm-advies.
{
  const { browser, page, errs } = await openDefend({ initScript: `Object.defineProperty(navigator, 'standalone', { get: () => true })`, contextOpties: mobiel });
  const r = await page.evaluate(() => getComputedStyle(document.querySelector('#apparaatMelding .beginscherm')).display);
  check('Gestart vanaf het beginscherm: het advies "Zet op beginscherm" verdwijnt', r === 'none', r);
  alleErrs.push(...errs);
  await browser.close();
}

// Na de eerste aanraking: touch-uitleg en de eenmalige touch-hint.
{
  const { browser, page, errs } = await openDefend({ contextOpties: { ...mobiel, viewport: { width: 1024, height: 768 } } });
  const muisUitleg = await page.evaluate(() => document.querySelector('#startscherm .uitleg').textContent);
  const k = await page.evaluate(() => { const r = document.querySelector('#startscherm .knop').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(...k);
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const d = window.DamChaosDebug;
    d.verbergWaveBanner();   // de hint wacht op de banner (D71)
    const hint = document.getElementById('hintUI');
    const uit = { uitleg: document.querySelector('#startscherm .uitleg').textContent, hint: hint.textContent, hintZichtbaar: hint.style.opacity === '1', gezien: d.gezieneHints.has('touch') };
    d.gezieneHints.delete('special');
    d.toonHint('special');
    uit.special = hint.textContent;
    return uit;
  });
  check('Met de muis noemt het startscherm WASD en klik', /WASD/.test(muisUitleg) && /klik/.test(muisUitleg), muisUitleg);
  check('Na de eerste aanraking noemt het startscherm de duimen, VUUR en "tik een regel"', /Linkerduim/.test(r.uitleg) && /VUUR/.test(r.uitleg) && /tik een regel/.test(r.uitleg) && !/WASD/.test(r.uitleg), r.uitleg);
  check('Eenmalige touch-hint bij het starten', r.gezien && /Linkerduim/.test(r.hint) && r.hintZichtbaar, r);
  check('Hints over toetsen zeggen op touch wat je moet tikken (Klokslag: 🔔)', /Tik op 🔔/.test(r.special) && !/Druk X/.test(r.special), r.special);
  alleErrs.push(...errs);
  await browser.close();
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
