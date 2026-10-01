// Ticket D71 (audit 5) — de wavebanner valt niet meer over het richtkruis.
//
// Op drie schermformaten, met de langste banner (baasaankondiging met tip
// en drie poorten), een baasbalk en een open bouwmenu: de banner overlapt
// niets van de HUD. Tijdens een wave staat hij korter in beeld dan in de
// bouwfase, en een hint wacht tot de banner weg is (ze delen de strook).
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];

for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 640]]) {
  const { browser, page, errs } = await openDefend({ contextOpties: { viewport: { width: w, height: h } } });
  const r = await page.evaluate(() => {
    const d = window.DamChaosDebug;
    d.resetRun();
    d.startWave(10);
    d.spel.maxActieveRobots = 1;
    d.updateWaveSysteem(0);   // de baas: de baasbalk staat er
    const p = d.plekVoor('Damrak', 'knooppunt').positie;
    d.speler.positie.set(p.x + 1.4, 0, p.z);
    d.updateInteracties(0);   // het bouwmenu staat open
    d.toonWaveBanner('Volgende wave: De Heimachine!\nvia Damrak, Rokin en Kalverstraat', 'De eindbaas: elke klap legt torens binnen 10 m stil. Schiet hem zelf, of van verder weg');
    const rect = id => document.getElementById(id).getBoundingClientRect();
    const b = rect('waveBanner');
    const ids = ['richtkruis', 'hitmarker', 'warmteUI', 'menuUI', 'baasUI', 'waveUI', 'objectiveUI', 'geldUI', 'scoreUI', 'specialUI', 'interactiePrompt', 'hulpUI', 'minimapUI'];
    const zichtbaar = id => getComputedStyle(document.getElementById(id)).display !== 'none' && rect(id).width > 0;
    return {
      banner: [b.left, b.top, b.right, b.bottom].map(Math.round),
      menuOpen: zichtbaar('menuUI'), baasOpen: zichtbaar('baasUI'),
      overlap: ids.filter(zichtbaar).filter(id => {
        const o = rect(id);
        return Math.min(b.right, o.right) - Math.max(b.left, o.left) > 1 && Math.min(b.bottom, o.bottom) - Math.max(b.top, o.top) > 1;
      }),
      marge: Math.round(rect('hitmarker').top - b.bottom),
      binnenBeeld: b.left >= 0 && b.right <= innerWidth,
    };
  });
  check(`${w}×${h}: de langste banner overlapt niets van de HUD (menu en baasbalk open)`, r.overlap.length === 0 && r.menuOpen && r.baasOpen, r);
  check(`${w}×${h}: ruim boven het richtkruis (≥ 20 px boven de hitmarker), en binnen beeld`, r.marge >= 20 && r.binnenBeeld, r);
  alleErrs.push(...errs);
  await browser.close();
}

const { browser, page, errs } = await openDefend();
const t = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const uit = {};
  d.resetRun();
  d.startWave(3);
  uit.wave = d.waveBannerDuur('');
  uit.tip = d.waveBannerDuur('een tip');
  d.spel.waveBonusGegeven = true;
  uit.bouwfase = d.waveBannerDuur('');
  // Een hint terwijl de banner er staat: eerst niet, daarna wel.
  localStorage.removeItem('defendNationalMonumentHints');
  d.gezieneHints.clear();
  d.toonWaveBanner('Wave 3 gehaald');
  const hint = document.getElementById('hintUI');
  d.toonHint('commandopost');
  uit.tijdensBanner = { tekst: hint.textContent, zichtbaar: hint.style.opacity === '1' };
  d.verbergWaveBanner();
  uit.naBanner = { zichtbaar: hint.style.opacity === '1', banner: document.getElementById('waveBanner').style.opacity };
  // Zonder banner verschijnt een hint meteen.
  d.toonHint('bouwfase');
  uit.zonderBanner = hint.style.opacity === '1' && /Even pauze/.test(hint.textContent);
  return uit;
});
check('Tijdens een wave korter in beeld dan in de bouwfase; met een tip het langst', t.wave < t.bouwfase && t.bouwfase < t.tip && t.wave <= 1200, t);
check('Een hint wacht tot de banner weg is, en komt dan', !t.tijdensBanner.zichtbaar && /commandopost/i.test(t.tijdensBanner.tekst) && t.naBanner.zichtbaar && t.naBanner.banner === '0', t);
check('Zonder banner verschijnt een hint meteen', t.zonderBanner, t);
alleErrs.push(...errs);
await browser.close();

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
