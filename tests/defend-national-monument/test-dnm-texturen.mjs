// Ticket D36 (SONNET_EXECUTION_PLAN_monument.md, §11.5) — textuurbibliotheek.
//
// Elke textuur bestaat, is deterministisch (twee keer tekenen met dezelfde
// seed geeft dezelfde bytes), sluit naadloos aan op zichzelf en heeft de
// juiste wereldschaal: een steen op het scherm is een steen op echte maat.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const PATRONEN = ['kinderkopjes', 'klinkers', 'straatklinkers', 'asfalt', 'trambaan', 'stoep',
  'baksteen', 'geleBaksteen', 'zandsteen', 'natuursteen', 'leisteen', 'glas', 'glasInLood'];

const r = await page.evaluate((PATRONEN) => {
  const d = window.DamChaosDebug;
  const n = d.TEXTUUR_PIXELS;
  function teken(patroon) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    d.TEXTUUR_TEKENAARS[patroon](c.getContext('2d'), n, d.maakZaadRandom(d.tekstZaad(patroon)));
    return c;
  }
  // Naadmaat: hoe verschilt de rand (kolom n-1 → kolom 0, rij n-1 → rij 0)
  // van een gewone stap binnen de textuur? Gemiddeld absoluut verschil in
  // helderheid; een naad springt eruit als een veel grotere sprong.
  function naad(c) {
    const px = c.getContext('2d').getImageData(0, 0, n, n).data;
    const lum = (x, y) => { const i = (y * n + x) * 4; return 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]; };
    let rand = 0, binnen = 0;
    for (let i = 0; i < n; i++) {
      rand += Math.abs(lum(n - 1, i) - lum(0, i)) + Math.abs(lum(i, n - 1) - lum(i, 0));
      binnen += Math.abs(lum(n / 2 - 1, i) - lum(n / 2, i)) + Math.abs(lum(i, n / 2 - 1) - lum(i, n / 2));
    }
    return { rand: rand / (2 * n), binnen: binnen / (2 * n) };
  }
  const uit = {};
  for (const p of PATRONEN) {
    const bestaat = typeof d.TEXTUUR_TEKENAARS[p] === 'function' && d.TEXTUUR_TEGEL[p] > 0;
    if (!bestaat) { uit[p] = { bestaat }; continue; }
    const a = teken(p).toDataURL(), b = teken(p).toDataURL();
    const tex = d.vloerTextuur(p);
    uit[p] = {
      bestaat, deterministisch: a === b, cacheGelijk: tex.userData.canvas.toDataURL() === a,
      herhaalt: tex.wrapS === d.THREE.RepeatWrapping && tex.wrapT === d.THREE.RepeatWrapping,
      naad: naad(teken(p)), tegel: d.TEXTUUR_TEGEL[p], lengte: a.length,
    };
  }
  // Wereldschaal van de stenen: een geheel aantal per tegel, en dat aantal
  // geeft de echte maat terug (binnen 5%).
  uit.stenen = Object.fromEntries(Object.entries(d.TEXTUUR_STEEN).map(([p, [b, h]]) => {
    const [bw, bh] = d.steenPixels(p, n);
    return [p, { echt: [b, h], opTegel: [d.TEXTUUR_TEGEL[p] * bw / n, d.TEXTUUR_TEGEL[p] * bh / n], perTegel: [n / bw, n / bh] }];
  }));
  // UV's op wereldschaal: een muur van 4 × 3 m in baksteen krijgt 4/1,32
  // herhalingen in de breedte en 3/1,32 in de hoogte.
  const geo = new d.THREE.BoxGeometry(4, 3, 0.2);
  geo.translate(10, 1.5, 0);
  d.textuurOpWereldschaal(geo, 'baksteen');
  const uv = geo.getAttribute('uv'), nrm = geo.getAttribute('normal');
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(nrm.getZ(i)) < 0.9) continue;   // alleen de voorgevel
    umin = Math.min(umin, uv.getX(i)); umax = Math.max(umax, uv.getX(i));
    vmin = Math.min(vmin, uv.getY(i)); vmax = Math.max(vmax, uv.getY(i));
  }
  uit.uv = { breedte: umax - umin, hoogte: vmax - vmin, verwacht: [4 / d.TEXTUUR_TEGEL.baksteen, 3 / d.TEXTUUR_TEGEL.baksteen] };
  // Materialen: gedeeld per patroon en kleur, glas glanst, steen niet.
  const m1 = d.gevelMateriaal('baksteen'), m2 = d.gevelMateriaal('baksteen'), m3 = d.gevelMateriaal('baksteen', 0x996655);
  const glas = d.gevelMateriaal('glas'), zand = d.gevelMateriaal('zandsteen');
  uit.materialen = { gedeeld: m1 === m2, eigenKleur: m1 !== m3 && m3.map === m1.map, glasGlanst: glas.roughness < 0.4 && zand.roughness > 0.8, map: m1.map === d.vloerTextuur('baksteen') };
  // Verschillende patronen zien er verschillend uit.
  uit.uniek = new Set(PATRONEN.map(p => teken(p).toDataURL())).size;
  return uit;
}, PATRONEN);

for (const p of PATRONEN) {
  const t = r[p];
  check(`${p}: bestaat, met een tegelmaat`, t.bestaat, t);
  if (!t.bestaat) continue;
  check(`${p}: deterministisch (twee keer tekenen = dezelfde bytes, ook de gecachte textuur)`, t.deterministisch && t.cacheGelijk, t);
  check(`${p}: herhaalt (RepeatWrapping) en sluit naadloos aan (randsprong ≤ 2× gewone sprong + 4)`, t.herhaalt && t.naad.rand <= 2 * t.naad.binnen + 4, t.naad);
}
for (const [p, s] of Object.entries(r.stenen)) {
  const klopt = [0, 1].every(i => Math.abs(s.opTegel[i] - s.echt[i]) / s.echt[i] <= 0.05 && Number.isInteger(Math.round(s.perTegel[i] * 1000) / 1000));
  check(`${p}: steen op wereldschaal (${s.echt.map(v => `${v * 100} cm`).join(' × ')}, binnen 5%, geheel aantal per tegel)`, klopt, s);
}
check('UV op wereldschaal: een muur van 4 × 3 m krijgt 4/tegel × 3/tegel herhalingen', Math.abs(r.uv.breedte - r.uv.verwacht[0]) < 1e-6 && Math.abs(r.uv.hoogte - r.uv.verwacht[1]) < 1e-6, r.uv);
check('gevelMateriaal deelt per patroon en kleur, glas glanst en steen niet', r.materialen.gedeeld && r.materialen.eigenKleur && r.materialen.glasGlanst && r.materialen.map, r.materialen);
check('Alle patronen zien er verschillend uit', r.uniek === PATRONEN.length, r.uniek);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
