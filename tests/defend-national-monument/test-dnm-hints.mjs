// Ticket D61 — de uitleg en de eenmalige hints.
//
// Het startscherm en de hulpbalk noemen de hele game (torens, 15 waves,
// bazen, G, X, 1–5, oververhitting), met overal de titel "Defend National
// Monument". In de eerste run verschijnt elke hint één keer op het juiste
// moment, en na herladen niet opnieuw.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { check, report } = makeChecker();
const alleErrs = [];
async function met(opties, fn) {
  const { browser, page, errs } = await openDefend(opties);
  try { return await fn(page); } finally { alleErrs.push(...errs); await browser.close(); }
}

// 1. Teksten.
const teksten = await met({}, page => page.evaluate(() => ({
  titel: document.title, h1: document.querySelector('#startscherm h1').textContent,
  uitleg: document.querySelector('#startscherm .uitleg').textContent,
  hulp: document.getElementById('hulpUI').textContent,
  body: document.body.innerText,
})));
check('De titel is overal "Defend National Monument"', teksten.titel === 'Defend National Monument' && teksten.h1 === 'DEFEND NATIONAL MONUMENT' && !/dam chaos/i.test(teksten.body), teksten.h1);
check('Het startscherm noemt 20 waves (D69), bazen, torens, 1–5, G, X, oververhitting en de commandopost',
  ['20 waves', 'vier bazen', 'torens', '1–5', 'G', 'X', 'te heet', 'commandopost'].every(w => teksten.uitleg.includes(w)), teksten.uitleg);
check('De oude, onjuiste zin over "bij een bordje op T" is weg', !teksten.uitleg.includes('bordje'), teksten.uitleg);
check('De hulpbalk noemt 1–5, G en X (D74: de klokslag)', ['1–6', 'G volgende wave', 'X klokslag'].every(w => teksten.hulp.includes(w)), teksten.hulp);

// 2. Hints: elk één keer, op het juiste moment.
const hints = await met({ contextOpties: { viewport: { width: 1024, height: 640 } } }, page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  const hint = () => ({ tekst: document.getElementById('hintUI').textContent, zichtbaar: document.getElementById('hintUI').style.opacity === '1' });
  const uit = {};
  // Bouwplek: het menu opent vanzelf.
  const p = d.plekVoor('Damrak', 'knooppunt').positie;
  d.speler.positie.set(p.x + 1.4, 0, p.z); d.updateInteracties(0);
  uit.bouwplek = hint();
  document.getElementById('hintUI').textContent = '';
  d.speler.positie.set(0, 0, 30); d.updateInteracties(0);
  d.speler.positie.set(p.x + 1.4, 0, p.z); d.updateInteracties(0);
  uit.bouwplekTweedeKeer = document.getElementById('hintUI').textContent;
  // Oververhitting.
  d.upgrades.vuurtempo = 5; while (!d.wapenWarmte.oververhit) d.simuleerVuren(1 / 60);
  uit.oververhit = hint();
  // Baas.
  d.startWave(5); d.spel.maxActieveRobots = 1; d.updateWaveSysteem(0);
  uit.baas = hint();
  // Bouwfase.
  for (const x of [...d.robots]) { d.scene.remove(x.groep); d.robots.splice(d.robots.indexOf(x), 1); }
  d.spel.teSpawnen = 0; d.updateWaveSysteem(0.1);
  uit.bouwfase = hint();
  uit.gezien = [...d.gezieneHints].sort();
  // Past de hint tussen de rest (op 1024×640, met baasbalk en doelregel)?
  d.startWave(10); d.spel.maxActieveRobots = 1; d.updateWaveSysteem(0);
  document.getElementById('hintUI').style.opacity = '1';
  const r = id => document.getElementById(id).getBoundingClientRect();
  const h = r('hintUI');
  uit.overlap = ['objectiveUI', 'baasUI', 'waveUI', 'scoreUI', 'geldUI', 'specialUI'].filter(id => {
    const b = r(id); if (!b.width) return false;
    return Math.min(h.right, b.right) - Math.max(h.left, b.left) > 2 && Math.min(h.bottom, b.bottom) - Math.max(h.top, b.top) > 2;
  });
  return uit;
}));
check('Bij de eerste bouwplek verschijnt de bouwhint', hints.bouwplek.zichtbaar && /Kies een toren/.test(hints.bouwplek.tekst), hints.bouwplek);
check('...maar een tweede keer niet', hints.bouwplekTweedeKeer === '', hints.bouwplekTweedeKeer);
check('De eerste oververhitting geeft de hint over afkoelen', /Te heet/.test(hints.oververhit.tekst), hints.oververhit);
check('De eerste baas geeft de baashint', /Een baas!/.test(hints.baas.tekst), hints.baas);
check('De eerste bouwfase geeft de pauzehint', /Even pauze/.test(hints.bouwfase.tekst), hints.bouwfase);
check('De hintbox valt niet over de HUD bovenin (1024×640 met baasbalk)', hints.overlap.length === 0, hints.overlap);

// 3. Na herladen: gezien blijft gezien; een kapotte sleutel valt terug.
const herladen = await met({ initScript: `localStorage.setItem('defendNationalMonumentHints', JSON.stringify(['bouwplek','baas']))` }, page => page.evaluate(() => {
  const d = window.DamChaosDebug;
  return { bouwplek: d.toonHint('bouwplek'), baas: d.toonHint('baas'), oververhit: d.toonHint('oververhit') };
}));
check('Na herladen komen geziene hints niet terug, nieuwe wel', !herladen.bouwplek && !herladen.baas && herladen.oververhit, herladen);
const kapot = await met({ initScript: `localStorage.setItem('defendNationalMonumentHints', '{kapot')` }, page => page.evaluate(() => window.DamChaosDebug.toonHint('bouwplek')));
check('Een kapotte sleutel: alle hints komen gewoon', kapot === true, kapot);

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
