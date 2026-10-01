// Ticket D77 (audit 13) — op een apparaat zonder muis (telefoon, tablet)
// zeggen het startscherm en de kaart in index.html dat de game een
// toetsenbord en een muis vraagt. Met een muis zie je die melding niet.
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
    return { zichtbaar: getComputedStyle(el).display !== 'none', tekst: el.textContent, binnen: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, raakt };
  });
  if (naam === 'telefoon') check('Telefoon: het startscherm meldt dat de game toetsenbord en muis vraagt, binnen beeld en vrij van de menuknop', r.zichtbaar && /toetsenbord en een muis/.test(r.tekst) && r.binnen && !r.raakt, r);
  else check('Computer: geen melding', !r.zichtbaar, r);
  // index.html, van dezelfde server.
  await page.goto(page.url().replace(/defend-national-monument\.html.*$/, 'index.html'));
  const idx = await page.evaluate(() => {
    const el = document.querySelector('.kaart p.apparaat');
    return { zichtbaar: !!el && getComputedStyle(el).display !== 'none', tekst: el?.textContent, kaart: document.querySelector('.kaart p').textContent };
  });
  if (naam === 'telefoon') check('Telefoon: in index.html staat de melding bij Defend National Monument', idx.zichtbaar && /toetsenbord en een muis/.test(idx.tekst), idx);
  else check('Computer: in index.html geen melding, en de kaart beschrijft de huidige game (torens, bazen, 20 waves)', !idx.zichtbaar && /torens/.test(idx.kaart) && /20 waves/.test(idx.kaart), idx);
  alleErrs.push(...errs);
  await browser.close();
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
