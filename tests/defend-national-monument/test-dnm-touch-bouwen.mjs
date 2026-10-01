// Ticket D83 (fase T) — knoppen en aantikbare menu's.
//
// Alles wat aan een toets hing, met alleen aanrakingen: een toren bouwen en
// upgraden door menuregels aan te tikken, het menu sluiten en openen met de
// actieknop, de Kerkklok, de Klokslag (alleen met een volle meter), volgende
// wave (alleen in de bouwfase) en pauze. De teksten zeggen op touch "tik",
// met de muis blijven ze zoals ze waren.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend({ contextOpties: { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } } });
const { check, report } = makeChecker();
const cdp = await page.context().newCDPSession(page);
let id = 10;
async function tik(x, y) {
  const i = id++;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: i }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(30);
}
const midden = (sel) => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const tikOp = async sel => { const m = await midden(sel); await tik(m.x, m.y); };
const knop = id => page.evaluate(id => { const k = document.getElementById(id); return { uit: k.classList.contains('uit'), tekst: k.textContent.trim(), vol: k.classList.contains('vol') }; }, id);

// Starten.
await page.touchscreen.tap(...Object.values(await midden('#startscherm .knop')));
await page.waitForTimeout(200);

// 1. Naar een bouwplek: het menu opent, met tik-teksten.
const bouw = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.resetRun(); d.geldZet(2000);
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0;
  const p = d.plekVoor('Damrak', 'knooppunt').positie;
  d.speler.positie.set(p.x + 1.4, 0, p.z); d.updateInteracties(0); d.werkTouchKnoppenBij();
  return { menu: document.getElementById('menuUI').textContent, prompt: document.getElementById('interactiePrompt').textContent };
});
check('Het menu en de prompt zeggen "tik", niet "druk een cijfer" of "T"', /tik een optie/.test(bouw.menu) && !/cijfer|T om te sluiten/.test(bouw.menu) && !/cijfer|\bT\b/.test(bouw.prompt), bouw);
check('De actieknop toont "Sluiten" bij een open bouwmenu', (await knop('touchActie')).tekst === '✕ Sluiten' && !(await knop('touchActie')).uit, await knop('touchActie'));

// 2. Bouwen en upgraden door regels aan te tikken.
await tikOp('#menuUI [data-optie="0"]');
const gebouwd = await page.evaluate(() => { const d = window.DamChaosDebug; const t = d.plekVoor('Damrak', 'knooppunt').toren; return { type: t?.type, niveau: t?.niveau, geld: d.geldStand() }; });
check('Een tik op regel 1 bouwt de geschuttoren (geld omlaag; het spel loopt door, dus een wavebonus kan erbij)', gebouwd.type === 'geschut' && gebouwd.niveau === 1 && gebouwd.geld < 2000, gebouwd);
await tikOp('#menuUI [data-optie="0"]');
const upgrade = await page.evaluate(() => window.DamChaosDebug.plekVoor('Damrak', 'knooppunt').toren.niveau);
check('Nog een tik op regel 1 upgradet hem naar niveau 2 (het menu bleef open)', upgrade === 2, upgrade);

// 3. De actieknop sluit en opent het menu.
await tikOp('#touchActie');
const dicht = await page.evaluate(() => ({ menu: document.getElementById('menuUI').style.display, label: document.getElementById('touchActieLabel').textContent }));
check('De actieknop sluit het menu, en heet dan "Bouwen"', dicht.menu === 'none' && dicht.label === '🔧 Bouwen', dicht);
await tikOp('#touchActie');
const open = await page.evaluate(() => document.getElementById('menuUI').style.display);
check('Nog een tik opent het weer', open === 'block', open);

// 4. Nergens in de buurt: de actieknop grijst uit (en blijft staan).
await page.evaluate(() => { const d = window.DamChaosDebug; d.speler.positie.set(d.MONUMENT_POSITIE.x + 14, 0, d.MONUMENT_POSITIE.z + 14); d.updateInteracties(0); d.werkTouchKnoppenBij(); });
const leeg = await knop('touchActie');
const leegRect = await midden('#touchActie');
check('Geen interactiepunt: de actieknop is uitgegrijsd, maar staat er nog', leeg.uit && leegRect.x > 0, leeg);

// 5. De Kerkklok.
await page.evaluate(() => { const d = window.DamChaosDebug; const k = d.DAM_LAYOUT.kerkklok.positie; d.speler.positie.set(k[0] + 2.6, 0, k[1]); d.updateInteracties(0); d.werkTouchKnoppenBij(); });
check('Bij de kerk heet de actieknop "Kerkklok"', (await knop('touchActie')).tekst === '🔔 Kerkklok', await knop('touchActie'));
await tikOp('#touchActie');
check('Een tik luidt de Kerkklok', await page.evaluate(() => window.DamChaosDebug.kerkklokBoost.active), null);

// 6. De Klokslag: alleen met een volle meter.
await page.evaluate(() => { const d = window.DamChaosDebug; d.spel.specialMeter = 50; d.werkTouchKnoppenBij(); });
const half = await knop('touchKlokslag');
await tikOp('#touchKlokslag');
const naHalf = await page.evaluate(() => window.DamChaosDebug.spel.specialMeter);
check('Halve meter: Klokslag uitgegrijsd, een tik doet niets', half.uit && naHalf === 50, { half, naHalf });
await page.evaluate(() => { const d = window.DamChaosDebug; d.spel.specialMeter = 100; d.werkTouchKnoppenBij(); });
const vol = await knop('touchKlokslag');
await tikOp('#touchKlokslag');
const naVol = await page.evaluate(() => ({ meter: window.DamChaosDebug.spel.specialMeter, koel: window.DamChaosDebug.klokslag.koelResterend }));
check('Volle meter: de knop licht op, een tik geeft de Klokslag', vol.vol && !vol.uit && naVol.meter === 0 && naVol.koel > 0, { vol, naVol });

// 7. Volgende wave: alleen in de bouwfase.
await page.evaluate(() => window.DamChaosDebug.werkTouchKnoppenBij());
const tijdensWave = await knop('touchVolgende');
const wave0 = await page.evaluate(() => { const d = window.DamChaosDebug; d.updateWaveSysteem(0.1); d.werkTouchKnoppenBij(); return d.spel.wave; });
const bouwfase = await knop('touchVolgende');
await tikOp('#touchVolgende');
const wave1 = await page.evaluate(() => window.DamChaosDebug.spel.wave);
check('Volgende wave: uit tijdens een wave, aan in de bouwfase, en een tik start hem', bouwfase.uit === false && wave1 === wave0 + 1, { tijdensWave, bouwfase, wave0, wave1 });

// 8. Pauze.
await tikOp('#touchPauze');
const pauze = await page.evaluate(() => ({ actief: window.DamChaosDebug.besturingActief(), start: getComputedStyle(document.getElementById('startscherm')).display, bediening: document.getElementById('touchBediening').hidden }));
check('De pauzeknop pauzeert: startscherm, bediening weg', !pauze.actief && pauze.start !== 'none' && pauze.bediening, pauze);

// 9. Met de muis blijven de teksten zoals ze waren.
await page.mouse.click(5, 5);
const muis = await page.evaluate(() => window.DamChaosDebug.voorInvoer('Bouwplek X, kies een cijfer, T om te sluiten'));
check('Muismodus: teksten ongewijzigd', muis === 'Bouwplek X, kies een cijfer, T om te sluiten', muis);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
