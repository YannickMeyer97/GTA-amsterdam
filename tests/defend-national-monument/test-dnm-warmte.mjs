// Tickets D17 en D18 (SONNET_EXECUTION_PLAN_monument.md, fase 4) — het wapen
// raakt oververhit, en dat zie en hoor je.
//
// D17: opbouw per schot, afkoeling pas na een korte vertraging, blokkade bij
// 100, hervatten pas onder de hervatdrempel (hysterese), en een hogere
// vuurtempo-upgrade raakt aantoonbaar sneller oververhit.
// D18: de meter onder het richtkruis volgt de warmte, de loop gloeit mee,
// de oververhit-stand is anders dan "bijna vol", en er komt stoom.
//
// De tijd loopt via DamChaosDebug.simuleerVuren (vuurknop vasthouden of
// loslaten in stappen van 1/60 s), niet via echte frames.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const w = d.wapenWarmte;
  const uit = {};
  const schoon = () => { d.resetRun(); d.camera.position.set(0, 1.7, 30); d.camera.lookAt(0, 60, 30); d.camera.updateMatrixWorld(); };

  // 1. Eén schot: precies WARMTE_PER_SCHOT.
  schoon();
  const schot = d.simuleerVuren(1 / 60);
  uit.eenSchot = { schot, warmte: w.warmte, per: d.WARMTE_PER_SCHOT };

  // 2. Afkoelen pas na de vertraging.
  d.simuleerVuren(d.WARMTE_AFKOEL_VERTRAGING - 0.05, false);
  const tijdensVertraging = w.warmte;
  d.simuleerVuren(0.5, false);
  uit.afkoelen = { tijdensVertraging, daarna: w.warmte, verwachtDaarna: Math.max(0, d.WARMTE_PER_SCHOT - d.WARMTE_AFKOELING * (0.5 - 0.05)) };

  // 3. Onafgebroken vuren zonder upgrades: tijd tot oververhit.
  schoon();
  let t = 0, schotenTotOververhit = 0;
  while (!w.oververhit && t < 60) { schotenTotOververhit += d.simuleerVuren(1 / 60); t += 1 / 60; }
  uit.basis = { tijd: t, schoten: schotenTotOververhit, oververhit: w.oververhit, warmte: w.warmte, stat: d.runStats.oververhit };

  // 4. Blokkade: blijven vuren levert niets op tot de warmte onder de
  // hervatdrempel is; halverwege is hij nog geblokkeerd (hysterese).
  let blokkade = 0, schotenTijdensBlokkade = 0, halverwege = null;
  while (w.oververhit && blokkade < 10) {
    schotenTijdensBlokkade += d.simuleerVuren(1 / 60);
    blokkade += 1 / 60;
    if (halverwege === null && w.warmte < 60) halverwege = { warmte: w.warmte, oververhit: w.oververhit };
  }
  uit.blokkade = { duur: blokkade, schoten: schotenTijdensBlokkade, halverwege, warmteBijHervatten: w.warmte, drempel: d.WARMTE_HERVAT_DREMPEL,
    verwacht: d.WARMTE_AFKOEL_VERTRAGING + (100 - d.WARMTE_HERVAT_DREMPEL) / d.WARMTE_AFKOELING };
  uit.naBlokkade = d.simuleerVuren(0.1);   // en daarna vuurt hij weer

  // 5. Vuurtempo 5: veel sneller oververhit.
  schoon();
  d.upgrades.vuurtempo = 5;
  t = 0;
  while (!w.oververhit && t < 60) { d.simuleerVuren(1 / 60); t += 1 / 60; }
  uit.vuurtempo5 = t;

  // 6. D18: meter, gloed, oververhit-stand, stoom.
  schoon();
  const vul = document.getElementById('warmteVul');
  const ui = document.getElementById('warmteUI');
  const stoom = () => d.scene.children.filter(m => m.isMesh && m.material?.color?.getHex() === 0xe8eef2).length;
  const metingen = [];
  for (let i = 0; i < 6; i++) {
    d.simuleerVuren(0.9);   // zes stappen tot ~85 warmte
    metingen.push({ warmte: w.warmte, breedte: parseFloat(vul.style.width), gloed: d.wapenLoopMateriaal.emissiveIntensity, oververhit: ui.classList.contains('oververhit') });
  }
  uit.metingen = metingen;
  d.upgrades.vuurtempo = 5;
  const stoomVoor = stoom();
  while (!w.oververhit) d.simuleerVuren(1 / 60);
  uit.oververhitStand = {
    klasse: ui.classList.contains('oververhit'),
    tekst: getComputedStyle(document.getElementById('warmteTekst')).display,
    tekstInhoud: document.getElementById('warmteTekst').textContent,
    stoom: stoom() - stoomVoor,
  };
  // Bijna vol (99) maar niet oververhit: geen tekst.
  schoon();
  w.warmte = 99; d.updateWarmte(0);
  uit.bijnaVol = { klasse: ui.classList.contains('oververhit'), tekst: getComputedStyle(document.getElementById('warmteTekst')).display };
  // Meer stoom zolang hij oververhit is.
  d.upgrades.vuurtempo = 5;
  while (!w.oververhit) d.simuleerVuren(1 / 60);
  const s1 = stoom();
  d.simuleerVuren(0.5, false);
  uit.stoomLoopt = stoom() > s1 - 1;   // er komt steeds nieuwe bij terwijl oude verdwijnen

  // 7. Reset wist alles.
  d.resetRun();
  uit.reset = { warmte: w.warmte, oververhit: w.oververhit, klasse: ui.classList.contains('oververhit'), gloed: d.wapenLoopMateriaal.emissiveIntensity, breedte: parseFloat(vul.style.width), stat: d.runStats.oververhit };
  return uit;
});

check('Eén schot geeft precies WARMTE_PER_SCHOT warmte', r.eenSchot.schot === 1 && r.eenSchot.warmte === r.eenSchot.per, r.eenSchot);
check('Tijdens de afkoelvertraging koelt het wapen niet af', r.afkoelen.tijdensVertraging === r.eenSchot.per, r.afkoelen);
check('Daarna koelt het af met WARMTE_AFKOELING per seconde', Math.abs(r.afkoelen.daarna - r.afkoelen.verwachtDaarna) < 0.6, r.afkoelen);
// Mildere variant (zie WARMTE_PER_SCHOT): ≈25 schoten per salvo.
check('Zonder upgrades raak je pas na 5–10 s onafgebroken vuren oververhit (≈25 schoten)', r.basis.oververhit && r.basis.tijd >= 5 && r.basis.tijd <= 10 && r.basis.schoten >= 22 && r.basis.schoten <= 27, r.basis);
check('Bij 100 is het wapen oververhit en telt de run dat', r.basis.warmte === 100 && r.basis.stat === 1, r.basis);
check('Oververhit: blijven vuren levert geen enkel schot op', r.blokkade.schoten === 0, r.blokkade);
check('Hysterese: onder 60 warmte is hij nog steeds geblokkeerd', r.blokkade.halverwege?.oververhit === true, r.blokkade.halverwege);
check('Hij mag pas weer vuren onder de hervatdrempel, na ~2,6 s', r.blokkade.warmteBijHervatten <= r.blokkade.drempel && Math.abs(r.blokkade.duur - r.blokkade.verwacht) < 0.15, r.blokkade);
check('Daarna vuurt hij weer', r.naBlokkade > 0, r.naBlokkade);
check('Met vuurtempo 5 raak je veel sneller oververhit (< 3 s, minder dan de helft van de basistijd)', r.vuurtempo5 < 3 && r.vuurtempo5 < r.basis.tijd / 2, { vuurtempo5: r.vuurtempo5, basis: r.basis.tijd });
check('D18: de meter volgt de warmte', r.metingen.every(m => Math.abs(m.breedte - m.warmte) < 0.2), r.metingen);
check('D18: de loop gloeit mee: 0 bij koud, oplopend met de warmte', r.metingen.every((m, i) => i === 0 || m.warmte < r.metingen[i - 1].warmte || m.gloed >= r.metingen[i - 1].gloed) && r.reset.gloed === 0 && r.metingen.at(-1).gloed > 0.3, r.metingen);
check('D18: oververhit is anders dan bijna vol: knipperende meter en de tekst OVERVERHIT', r.oververhitStand.klasse && r.oververhitStand.tekst === 'block' && r.oververhitStand.tekstInhoud === 'OVERVERHIT' && !r.bijnaVol.klasse && r.bijnaVol.tekst === 'none', r);
check('D18: bij oververhitting komt er stoom uit het wapen, zolang hij oververhit is', r.oververhitStand.stoom >= 5 && r.stoomLoopt, r.oververhitStand);
check('Reset: warmte 0, niet oververhit, meter leeg, geen gloed, teller 0', r.reset.warmte === 0 && !r.reset.oververhit && !r.reset.klasse && r.reset.gloed === 0 && r.reset.breedte === 0 && r.reset.stat === 0, r.reset);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
