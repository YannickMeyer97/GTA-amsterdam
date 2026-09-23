// Ticket D20 (SONNET_EXECUTION_PLAN_monument.md, na de review naar fase 2
// gehaald) — zichtbare schadestaten van het monument.
//
// Drie drempels (66 %, 33 %, 10 %). Kern van de test: elke drempel schakelt
// de juiste staat, herstel schakelt terug, en een overgang vuurt precies één
// keer per grensoverschrijding — ook bij herhaald heen-en-weer.
import { openDefend, frames, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

// --- 1. De tier-functie op en rond elke grens ------------------------------

const tiers = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  return [100, 67, 66.5, 66, 34, 33, 11, 10, 0].map(hp => [hp, d.monumentSchadeTier(hp)]);
});
const verwacht = { 100: 0, 67: 0, 66.5: 0, 66: 1, 34: 1, 33: 2, 11: 2, 10: 3, 0: 3 };
for (const [hp, tier] of tiers) {
  check(`monumentSchadeTier(${hp}) = ${verwacht[hp]}`, tier === verwacht[hp], { hp, tier });
}

// --- 2. De zichtbare staat per tier ---------------------------------------

const staten = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const m = d.monumentSchade.delen;
  const beeld = () => ({
    tier: d.monumentSchade.tier,
    top: m.top.visible,
    scheurenLicht: m.scheurenLicht.visible,
    puinLicht: m.puinLicht.visible,
    scheurenZwaar: m.scheurenZwaar.visible,
    afgebrokenTop: m.afgebrokenTop.visible,
    figuren: m.sneuvelendeFiguren.every(f => f.visible),
    rook: m.rook.visible,
    alarm: m.alarm.visible,
    scheef: m.pyloon.rotation.z,
  });
  const uit = {};
  for (const hp of [100, 60, 30, 5]) {
    d.spel.monumentHP = hp;
    d.updateMonumentSchade();
    uit[hp] = beeld();
  }
  return uit;
});
const s0 = staten[100], s1 = staten[60], s2 = staten[30], s3 = staten[5];
check('Tier 0 (100 %): monument heel — spits er, geen scheuren, puin, rook of alarm, recht',
  s0.tier === 0 && s0.top && !s0.scheurenLicht && !s0.puinLicht && !s0.scheurenZwaar && !s0.afgebrokenTop && s0.figuren && !s0.rook && !s0.alarm && s0.scheef === 0, s0);
check('Tier 1 (60 %): scheuren en wat puin, verder nog heel',
  s1.tier === 1 && s1.scheurenLicht && s1.puinLicht && !s1.scheurenZwaar && s1.top && !s1.afgebrokenTop && s1.figuren && !s1.rook && s1.scheef === 0, s1);
check('Tier 2 (30 %): spits afgebroken, figuren weg, zware scheuren, rook, scheef',
  s2.tier === 2 && !s2.top && s2.afgebrokenTop && !s2.figuren && s2.scheurenZwaar && s2.rook && !s2.alarm && s2.scheef > 0, s2);
check('Tier 3 (5 %): alles van tier 2 plus alarmlicht, en schever dan tier 2',
  s3.tier === 3 && s3.alarm && s3.rook && !s3.top && s3.scheef > s2.scheef, s3);

// --- 3. Overgangen: precies één keer per grensoverschrijding --------------

const overgangen = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  // Terug naar een schone staat via de echte reset.
  d.resetRun();
  const popups = () => [...document.querySelectorAll('#popups .popup')].map(p => p.textContent);
  document.getElementById('popups').innerHTML = '';

  const tel = (hpReeks) => {
    for (const hp of hpReeks) { d.spel.monumentHP = hp; d.updateMonumentSchade(); }
    return d.monumentSchade.overgangen;
  };
  const naBinnenTier = tel([90, 80, 70, 67]);            // blijft tier 0
  const naEersteGrens = tel([66, 60, 50, 40]);           // 0 → 1, daarna binnen tier 1
  const naHeenEnWeer = tel([67, 66, 67, 66, 67, 66]);    // zes grensoverschrijdingen
  const scheurMeldingen = popups().filter(t => t === 'Het monument scheurt!').length;
  return { naBinnenTier, naEersteGrens, naHeenEnWeer, scheurMeldingen };
});
check('Binnen dezelfde tier blijven: geen enkele overgang', overgangen.naBinnenTier === 0, overgangen);
check('Eén keer de grens over en daarna erbinnen blijven: precies één overgang', overgangen.naEersteGrens === 1, overgangen);
check('Zes keer heen en weer over 66 %: precies zes overgangen erbij', overgangen.naHeenEnWeer === 7, overgangen);
check('De melding "scheurt" komt alleen bij verslechtering (1 + 3 keer), niet bij herstel', overgangen.scheurMeldingen === 4, overgangen);

// --- 4. Echte bronnen: robottreffer en Koninklijke Reparatie --------------

const echt = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.resetRun();
  d.spel.monumentHP = 70;
  d.updateMonumentSchade();
  d.spawnRobot(null, 'normal');
  d.robotRaaktMonument(d.robots[d.robots.length - 1]);   // 70 − 8 = 62 → tier 1
  const naTreffer = { hp: d.spel.monumentHP, tier: d.monumentSchade.tier };
  d.geldZet(1000);
  d.koopMonumentReparatie();                              // 62 + 25 = 87 → tier 0
  const naReparatie = { hp: d.spel.monumentHP, tier: d.monumentSchade.tier, scheuren: d.monumentSchade.delen.scheurenLicht.visible };
  d.spel.monumentHP = 20;
  d.updateMonumentSchade();                                // tier 2
  d.koopMonumentReparatie();                              // 45 → tier 1
  const tweedeReparatie = { hp: d.spel.monumentHP, tier: d.monumentSchade.tier, top: d.monumentSchade.delen.top.visible,
    rook: d.monumentSchade.delen.rook.visible, scheef: d.monumentSchade.delen.pyloon.rotation.z };
  return { naTreffer, naReparatie, tweedeReparatie };
});
check('Een robottreffer die onder 66 % zakt, schakelt naar tier 1', echt.naTreffer.hp === 62 && echt.naTreffer.tier === 1, echt);
check('Koninklijke Reparatie boven 66 % schakelt terug naar tier 0 (scheuren weg)', echt.naReparatie.tier === 0 && !echt.naReparatie.scheuren, echt);
check('Reparatie van tier 2 naar tier 1: spits terug, rook weg, weer recht', echt.tweedeReparatie.tier === 1 && echt.tweedeReparatie.top && !echt.tweedeReparatie.rook && echt.tweedeReparatie.scheef === 0, echt);

// --- 5. Verborgen onderdelen houden geen schoten tegen ---------------------

const raycast = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const m = d.monumentSchade.delen;
  const echteRaycast = m.pyloon.children[0].raycast;   // de zuil: altijd zichtbaar, gewone raycast
  const meshes = (obj) => { const uit = []; obj.traverse(x => { if (x.isMesh) uit.push(x); }); return uit; };
  const allemaalUit = (obj) => meshes(obj).every(x => x.raycast !== echteRaycast);
  const allemaalAan = (obj) => meshes(obj).every(x => x.raycast === echteRaycast);
  d.resetRun();
  const tier0 = { afgebrokenTop: allemaalUit(m.afgebrokenTop), puinZwaar: allemaalUit(m.puinZwaar), top: allemaalAan(m.top) };
  d.spel.monumentHP = 30;
  d.updateMonumentSchade();
  const tier2 = { afgebrokenTop: allemaalAan(m.afgebrokenTop), puinZwaar: allemaalAan(m.puinZwaar), top: allemaalUit(m.top),
    figuren: m.sneuvelendeFiguren.every(allemaalUit) };
  const effecten = { rook: allemaalUit(m.rook), alarm: allemaalUit(m.alarm), scheuren: allemaalUit(m.scheurenLicht) && allemaalUit(m.scheurenZwaar) };
  return { tier0, tier2, effecten };
});
check('Tier 0: verborgen stomp en puin kunnen niet geraakt worden, de spits wel', raycast.tier0.afgebrokenTop && raycast.tier0.puinZwaar && raycast.tier0.top, raycast);
check('Tier 2: zichtbare stomp en puin wél raakbaar, verdwenen spits en figuren niet', raycast.tier2.afgebrokenTop && raycast.tier2.puinZwaar && raycast.tier2.top && raycast.tier2.figuren, raycast);
check('Rook, alarmlicht en scheuren zijn nooit raakbaar (puur effect)', raycast.effecten.rook && raycast.effecten.alarm && raycast.effecten.scheuren, raycast);

// --- 6. Rook en alarm bewegen echt (tijdens actief spel) -------------------

await page.evaluate(() => {
  const d = window.DamChaosDebug;
  d.spel.teSpawnen = 0;
  d.spel.monumentHP = 5;
  d.updateMonumentSchade();
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return canvas; } });
  document.dispatchEvent(new Event('pointerlockchange'));
});
const animatie = await page.evaluate(async () => {
  const d = window.DamChaosDebug;
  const m = d.monumentSchade.delen;
  const alarmStanden = new Set();
  let maxOpacity = 0;
  const y0 = m.wolkjes.map(w => w.position.y);
  for (let i = 0; i < 90; i++) {
    await new Promise(r => requestAnimationFrame(r));
    alarmStanden.add(m.alarm.visible);
    for (const w of m.wolkjes) maxOpacity = Math.max(maxOpacity, w.material.opacity);
  }
  const verplaatst = m.wolkjes.some((w, i) => Math.abs(w.position.y - y0[i]) > 0.01);
  return { alarmKnippert: alarmStanden.size === 2, maxOpacity, verplaatst };
});
check('Tier 3: het alarmlicht knippert (zowel aan als uit gezien)', animatie.alarmKnippert, animatie);
check('Tier 3: de rook is zichtbaar en stijgt op', animatie.maxOpacity > 0.2 && animatie.verplaatst, animatie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
