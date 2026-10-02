// Ticket D84 (fase T) — liggend, safe-area, een HUD die op een telefoon past.
//
// - Overlapmeting (les uit Undead): op vier formaten (iPhone SE, iPhone 14,
//   iPhone Pro Max, iPad liggend), in de touchmodus, met baasbalk, banner met
//   tip, Kerkklok-banner, prompt, combo en alle knoppen, één keer met het
//   grootste bouwmenu open en één keer midden in een wave: geen enkele
//   zichtbare vaste UI-rechthoek overlapt of valt buiten beeld. (Richtkruis,
//   hitmarker en warmtemeter horen samen in het midden; de popups zweven
//   bewust kort over het midden.)
// - Het startscherm past en zegt "Tik"; staand verschijnt het draaischerm en
//   pauzeert het spel; de iPhone-meta-tags staan erin; de wake lock wordt
//   aangevraagd, losgelaten bij pauze en opnieuw aangevraagd na terugkomen.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
const tikStart = async page => {
  const k = await page.evaluate(() => { const r = document.querySelector('#startscherm .knop').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(...k);
  await page.waitForTimeout(200);
};

for (const [w, h] of [[667, 375], [844, 390], [932, 430], [1024, 768]]) {
  const { browser, page, errs } = await openDefend({ contextOpties: { isMobile: true, hasTouch: true, viewport: { width: w, height: h } } });
  await tikStart(page);
  for (const staat of ['menu', 'wave']) {
    const r = await page.evaluate((staat) => {
      const d = window.DamChaosDebug;
      d.resetRun(); d.startWave(10); d.spel.maxActieveRobots = 1; d.updateWaveSysteem(0);
      d.geldZet(5000);
      const plek = d.plekVoor('Damrak', 'knooppunt');
      if (staat === 'menu') {
        const t = d.bouwToren(plek, 'geschut'); d.upgradeToren(t); d.voortgang.bazen.sloopkogel = true;   // twee lange richtingsregels
        d.speler.positie.set(plek.positie.x + 1.4, 0, plek.positie.z);
      } else d.speler.positie.set(d.DAM_LAYOUT.kerkklok.positie[0] + 2.6, 0, d.DAM_LAYOUT.kerkklok.positie[1]);
      d.updateInteracties(0); d.renderMenu();
      d.spel.combo = 6; d.updateArcadeUI(); d.werkTouchKnoppenBij();
      d.toonWaveBanner('Volgende wave: De Heimachine!\nvia Damrak, Rokin en Kalverstraat', 'De eindbaas: elke klap legt torens binnen 10 m stil. Schiet hem zelf, of van verder weg');
      for (const id of ['kerkklokBanner', 'interactiePrompt']) document.getElementById(id).style.opacity = '1';
      const midden = new Set(['richtkruis', 'hitmarker', 'warmteUI']);
      const negeer = ['startscherm', 'eindscherm', 'overwinningscherm', 'ontgrendelPaneel', 'touchBediening', 'touchStick', 'draaiScherm', 'hintUI', 'apparaatMelding', 'popups'];
      const els = [...document.querySelectorAll('body > div[id], body > a[id], #touchBediening > div[id]')].filter(el => {
        if (negeer.includes(el.id) || el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none') return false;
        const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0;
      }).map(el => { const b = el.getBoundingClientRect(); return { id: el.id, r: [b.left, b.top, b.right, b.bottom] }; });
      const overlap = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i], c = els[j];
        if (midden.has(a.id) && midden.has(c.id)) continue;
        if (a.r[0] < c.r[2] - 0.5 && c.r[0] < a.r[2] - 0.5 && a.r[1] < c.r[3] - 0.5 && c.r[1] < a.r[3] - 0.5) overlap.push(`${a.id}×${c.id}`);
      }
      const buiten = els.filter(x => x.r[0] < -0.5 || x.r[1] < -0.5 || x.r[2] > innerWidth + 0.5 || x.r[3] > innerHeight + 0.5).map(x => x.id);
      const zichtbaar = new Set(els.map(x => x.id));
      return { overlap, buiten, aantal: els.length, heeft: ['menuUI', 'baasUI', 'waveBanner', 'touchVuur', 'touchActie', 'touchKlokslag', 'touchVolgende', 'touchPauze', 'interactiePrompt'].filter(x => zichtbaar.has(x)) };
    }, staat);
    const verwacht = staat === 'menu' ? ['menuUI', 'baasUI', 'waveBanner', 'touchVuur', 'touchActie', 'touchKlokslag', 'touchVolgende', 'touchPauze', 'interactiePrompt'] : ['baasUI', 'waveBanner', 'touchVuur', 'touchActie', 'touchKlokslag', 'touchVolgende', 'touchPauze', 'interactiePrompt'];
    check(`${w}×${h}, ${staat === 'menu' ? 'bouwmenu open' : 'midden in een wave'}: alles in beeld, niets overlapt (${r.aantal} elementen)`, r.overlap.length === 0 && r.buiten.length === 0 && verwacht.every(x => r.heeft.includes(x)), r);
  }
  // Het pauzescherm past en zegt "Tik".
  await page.evaluate(() => window.DamChaosDebug.verlaatBesturing());
  const p = await page.evaluate(() => { const o = document.getElementById('ontgrendelKnop').getBoundingClientRect(); const t = document.querySelector('#startscherm h1').getBoundingClientRect(); return { knop: document.querySelector('#startscherm .knop').textContent, kop: document.querySelector('#startscherm h2').textContent, boven: t.top, onder: o.bottom, h: innerHeight }; });
  check(`${w}×${h}: het pauzescherm past en zegt "Tik"`, p.knop === 'Tik om te spelen' && /tik om verder/.test(p.kop) && p.boven >= 0 && p.onder <= p.h, p);
  alleErrs.push(...errs);
  await browser.close();
}

// Staand: draaischerm en pauze. Meta-tags. Wake lock (met een nagebootste API).
// D87: ook requestFullscreen is nagebootst (telt alleen). De headless shell van
// CI gaat bij de eerste tik écht fullscreen, en dan weigert setViewportSize
// het draaien naar staand. Een iPhone heeft geen fullscreen, dus zo lijkt het
// ook meer op het doeltoestel.
const wakeStub = `
  window.__fullscreen = 0;
  Element.prototype.requestFullscreen = function () { window.__fullscreen++; return Promise.resolve(); };
  window.__wake = { aanvragen: 0, losgelaten: 0 };
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wake.aanvragen++; const l = new EventTarget(); l.release = async () => { window.__wake.losgelaten++; l.dispatchEvent(new Event('release')); }; return l; } } });`;
const { browser, page, errs } = await openDefend({ initScript: wakeStub, contextOpties: { isMobile: true, hasTouch: true, viewport: { width: 844, height: 390 } } });
const meta = await page.evaluate(() => ({
  viewport: document.querySelector('meta[name=viewport]').content,
  apple: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content,
  balk: document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.content,
}));
check('Meta-tags voor de iPhone: viewport-fit=cover en "Zet op beginscherm" als volledig scherm', /viewport-fit=cover/.test(meta.viewport) && meta.apple === 'yes' && meta.balk === 'black-translucent', meta);
const voorTik = await page.evaluate(() => !document.getElementById('draaiScherm').hidden);
await tikStart(page);
await page.waitForTimeout(100);
const wake1 = await page.evaluate(() => ({ ...window.__wake, stand: window.DamChaosDebug.wakeLockStand(), fullscreenAanvragen: window.__fullscreen }));
check('Bij het starten wordt de wake lock aangevraagd', wake1.aanvragen === 1 && wake1.stand, wake1);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const staand = await page.evaluate(() => ({ draai: !document.getElementById('draaiScherm').hidden, actief: window.DamChaosDebug.besturingActief(), wake: { ...window.__wake } }));
check('Liggend geen draaischerm; staand wel, en het spel pauzeert (wake lock los)', !voorTik && staand.draai && !staand.actief && staand.wake.losgelaten === 1, { voorTik, staand });
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(300);
const terug = await page.evaluate(() => ({ draai: !document.getElementById('draaiScherm').hidden, start: getComputedStyle(document.getElementById('startscherm')).display }));
check('Terug liggend: draaischerm weg, het pauzescherm wacht op een tik', !terug.draai && terug.start !== 'none', terug);
await tikStart(page);
const wake2 = await page.evaluate(async () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  window.DamChaosDebug.wakeLockStand();
  return { ...window.__wake };
});
check('Hervatten vraagt de wake lock opnieuw aan', wake2.aanvragen === 2, wake2);
alleErrs.push(...errs);
await browser.close();

// Een laptopvenster dat smal en hoog is (muis): geen draaischerm.
{
  const { browser, page, errs } = await openDefend({ contextOpties: { viewport: { width: 500, height: 900 } } });
  const r = await page.evaluate(() => !document.getElementById('draaiScherm').hidden);
  check('Een smal venster met een muis krijgt geen draaischerm', r === false, r);
  alleErrs.push(...errs);
  await browser.close();
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
