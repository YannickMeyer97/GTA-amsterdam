// Ticket D82 (fase T) — lopen, kijken en vuren met twee duimen.
//
// Echte meervinger-aanrakingen via het DevTools-protocol
// (Input.dispatchTouchEvent), elk met een eigen id:
// - de stick verschijnt waar de linkerduim landt en loopt analoog;
// - rechts vegen draait de kijkrichting (gevoeligheid × 2,6);
// - de vuurknop vuurt en richt met dezelfde duim;
// - een tweede vinger steelt de stick niet;
// - pauzeren verbergt alles en laat alles los.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend({ contextOpties: { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } } });
const { check, report } = makeChecker();
const cdp = await page.context().newCDPSession(page);
const vingers = new Map();   // id → {x, y}
async function touch(type, id, x, y) {
  if (type === 'touchEnd') vingers.delete(id); else vingers.set(id, { x, y });
  const punten = [...vingers.entries()].map(([i, p]) => ({ x: p.x, y: p.y, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' && punten.length === 0 ? [] : punten });
}
const st = () => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const stick = document.getElementById('touchStick').getBoundingClientRect();
  return { ...d.touchStand(), stick: { vinger: d.touchStick.vinger, kracht: d.touchStick.kracht, x: d.touchStick.x, y: d.touchStick.y, left: stick.left, top: stick.top },
    yaw: d.speler.yaw, pitch: d.speler.pitch, pos: { x: d.speler.positie.x, z: d.speler.positie.z }, actief: d.besturingActief() };
});

// Starten met een tik op de startknop.
const knop = await page.evaluate(() => { const r = document.querySelector('#startscherm .knop').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.touchscreen.tap(knop.x, knop.y);
await page.waitForTimeout(200);
const start = await st();
check('Na de start-tik: touchbediening zichtbaar, spel actief', start.zichtbaar && start.actief, start);

// 1. De stick: verschijnt waar de duim landt.
await touch('touchStart', 1, 150, 260);
const neer = await st();
check('De stick verschijnt waar de linkerduim landt', neer.stick.vinger === 1 && Math.abs(neer.stick.left - 90) < 1 && Math.abs(neer.stick.top - 200) < 1, neer.stick);
await touch('touchMove', 1, 150, 200);   // 60 px omhoog: volle uitslag vooruit
const vol = await st();
check('Volle uitslag omhoog: kracht 1, richting vooruit', vol.stick.kracht === 1 && vol.stick.y < -0.99, vol.stick);

// Lopen: analoog. updateSpeler synchroon (de game-loop kan er niet tussen).
const loop = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const stap = () => { const x0 = d.speler.positie.x, z0 = d.speler.positie.z; d.updateSpeler(0.1); return Math.hypot(d.speler.positie.x - x0, d.speler.positie.z - z0); };
  d.speler.positie.set(d.MONUMENT_POSITIE.x + 12, 0, d.MONUMENT_POSITIE.z + 12);   // vrij op het plein
  const heel = stap();
  const yaw = d.speler.yaw, x0 = d.speler.positie.x, z0 = d.speler.positie.z;
  d.updateSpeler(0.1);
  const richting = Math.atan2(-(d.speler.positie.x - x0), -(d.speler.positie.z - z0));
  return { heel, snelheid: d.speler.snelheid * 0.1, richtingVerschil: Math.abs(Math.atan2(Math.sin(richting - yaw), Math.cos(richting - yaw))) };
});
check('Volle uitslag loopt op volle snelheid, in de kijkrichting', Math.abs(loop.heel - loop.snelheid) < 0.01 && loop.richtingVerschil < 0.01, loop);
await touch('touchMove', 1, 150, 234);   // 26 px: halve uitslag
const half = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const x0 = d.speler.positie.x, z0 = d.speler.positie.z; d.updateSpeler(0.1);
  return { stap: Math.hypot(d.speler.positie.x - x0, d.speler.positie.z - z0), snelheid: d.speler.snelheid * 0.1, kracht: d.touchStick.kracht };
});
check('Halve uitslag loopt half zo snel (analoog)', Math.abs(half.stap / half.snelheid - half.kracht) < 0.02 && half.kracht > 0.4 && half.kracht < 0.6, half);

// 2. Een tweede vinger links steelt de stick niet; rechts kijken werkt tegelijk.
await touch('touchStart', 2, 300, 150);
const tweede = await st();
check('Een tweede vinger op de linkerhelft steelt de stick niet', tweede.stick.vinger === 1, tweede.stick);
await touch('touchEnd', 2);
const yaw0 = (await st()).yaw;
await touch('touchStart', 3, 600, 200);
await touch('touchMove', 3, 700, 200);
const kijk = await st();
check('Rechts vegen (100 px) draait de kijkrichting met gevoeligheid × 2,6, terwijl de stick blijft staan', Math.abs((yaw0 - kijk.yaw) - 100 * 0.0022 * 2.6) < 1e-6 && kijk.stick.vinger === 1, { verschil: yaw0 - kijk.yaw, stick: kijk.stick.vinger });
await touch('touchEnd', 3);
await touch('touchEnd', 1);
const los = await st();
check('Loslaten: stick weg en stil, geen kijkvinger', los.stick.vinger === null && los.stick.kracht === 0 && los.stick.left === -999 && los.kijkVinger === null, los);

// 3. De vuurknop: vuren én richten met dezelfde duim.
const vuur = await page.evaluate(() => { const r = document.getElementById('touchVuur').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await touch('touchStart', 4, vuur.x, vuur.y);
const vuurNeer = await st();
check('De vuurknop: schieten aan, en hij claimt de kijkvinger', vuurNeer.schieten && vuurNeer.kijkVinger === 4, vuurNeer);
const yaw1 = vuurNeer.yaw;
await touch('touchMove', 4, vuur.x - 40, vuur.y - 10);
const vuurSleep = await st();
check('Slepen vanaf de vuurknop richt (ook als de duim van de knop af schuift)', vuurSleep.yaw > yaw1 && vuurSleep.pitch !== vuurNeer.pitch && vuurSleep.schieten, { yaw1, yaw: vuurSleep.yaw, pitch0: vuurNeer.pitch, pitch: vuurSleep.pitch });
await touch('touchEnd', 4);
const vuurLos = await st();
check('Loslaten: schieten uit, kijkvinger vrij', !vuurLos.schieten && vuurLos.kijkVinger === null, vuurLos);

// 4. Pauzeren houdt een duim op de stick niet vast.
await touch('touchStart', 5, 150, 260);
await touch('touchMove', 5, 150, 200);
await page.evaluate(() => window.DamChaosDebug.verlaatBesturing());
const pauze = await st();
check('Pauzeren: bediening weg, stick losgelaten, spel stil', !pauze.zichtbaar && pauze.stick.vinger === null && pauze.stick.kracht === 0 && !pauze.actief, pauze);
await touch('touchEnd', 5);

// 5. In de muismodus is er geen touchbediening.
await page.mouse.click(5, 5);
const muis = await st();
check('Muismodus: geen touchbediening', !muis.zichtbaar, muis);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
