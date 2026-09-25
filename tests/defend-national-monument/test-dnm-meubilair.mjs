// Ticket D41 (SONNET_EXECUTION_PLAN_monument.md, §11.5) — sfeer en
// straatmeubilair.
//
// Lantaarns, Amsterdammertjes, banken, fietsenrekken, de tramhalte en
// groepjes toeristen: alles uit DAM_LAYOUT.meubilair. Deze test bewaakt dat
// het decor het spel niet raakt: niets op een rijbaan of routestrook, niets
// bij een interactiepunt of vlak bij het monument, geen schoten
// tegenhouden, en weinig meshes.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const THREE = d.THREE;
  const M = d.DAM_LAYOUT.meubilair;
  const g = d.straatmeubilair;
  const meshes = g.children.filter(m => m.isMesh);
  const uit = { inWereld: g.parent === d.wereld, meshes: meshes.map(m => m.name), aantallen: g.userData.aantallen };
  // Afstand van een punt tot de rand van de dichtstbijzijnde routestrook.
  const totStrook = (x, z) => Math.min(...d.SPAWN_POORTEN.map(p => {
    const pr = d.projecteerOpRoute(d.ROUTES.get(p.naam), x, z);
    return pr.afstand - pr.segment.breedte / 2;
  }));
  const punten = [
    ...M.lantaarns.map(([x, z]) => ['lantaarn', x, z, 0.2]),
    ...M.banken.map(([x, z]) => ['bank', x, z, 0.95]),
    ...M.fietsenrekken.map(([x0, z, x1]) => ['fietsenrek', (x0 + x1) / 2, z, (x1 - x0) / 2]),
    ...M.toeristen.map(([x, z]) => ['toeristen', x, z, 0.9]),
    ['abri', (M.tramhalte.abri[0] + M.tramhalte.abri[2]) / 2, (M.tramhalte.abri[1] + M.tramhalte.abri[3]) / 2, 2],
  ];
  uit.teDichtBijRoute = punten.filter(([, x, z, h]) => totStrook(x, z) - h < 0.5).map(p => p.slice(0, 3));
  // Niet op een rijbaan of de trambaan.
  const heilig = d.DAM_LAYOUT.vlakken.filter(v => v.soort === 'asfalt' || v.soort === 'trambaan');
  uit.opRijbaan = punten.filter(([, x, z]) => heilig.some(v => x >= v.rect[0] && x <= v.rect[2] && z >= v.rect[1] && z <= v.rect[3])).map(p => p.slice(0, 3));
  // Niet bij een interactiepunt (bouwplek, drukpers, commandopost, Kerkklok).
  uit.bijInteractie = punten.filter(([, x, z, h]) => d.interactiePunten.some(ip => Math.hypot(ip.positie.x - x, ip.positie.z - z) < ip.radius + h * 0.5)).map(p => p.slice(0, 3));
  // Rustig rond het strijdtoneel.
  uit.dichtstBijMonument = Math.min(...punten.map(([, x, z, h]) => Math.hypot(x, z) - h));
  // Houdt geen schoten tegen: een straal door een lantaarn raakt niets van het decor.
  const [lx, lz] = M.lantaarns[0];
  const ray = new THREE.Raycaster(new THREE.Vector3(lx - 5, 2, lz), new THREE.Vector3(1, 0, 0));
  uit.raakbaar = ray.intersectObject(g, true).length;
  // De lampen gloeien.
  uit.lampGloed = meshes.find(m => m.name === 'lampen')?.material.emissiveIntensity ?? 0;
  // Fietsen en mensen hebben verschillende kleuren (vertexkleuren).
  const kleuren = naam => {
    const c = meshes.find(m => m.name === naam)?.geometry.getAttribute('color');
    const s = new Set();
    if (c) for (let i = 0; i < c.count; i += 6) s.add(`${c.getX(i).toFixed(2)}${c.getY(i).toFixed(2)}${c.getZ(i).toFixed(2)}`);
    return s.size;
  };
  uit.fietsKleuren = kleuren('fietsen');
  uit.menskleuren = kleuren('mensen');
  return uit;
});

check('Het straatmeubilair staat in de wereld, samengevoegd tot hooguit 16 meshes', r.inWereld && r.meshes.length <= 16, r.meshes);
check('Alles is er: 33 lantaarns, 144 Amsterdammertjes, 4 banken, fietsen en 11 toeristen', r.aantallen.lantaarns === 33 && r.aantallen.paaltjes === 144 && r.aantallen.banken === 4 && r.aantallen.fietsen >= 10 && r.aantallen.mensen === 11, r.aantallen);
check('Niets staat binnen 0,5 m van een routestrook', r.teDichtBijRoute.length === 0, r.teDichtBijRoute);
check('Niets staat op een rijbaan of de trambaan', r.opRijbaan.length === 0, r.opRijbaan);
check('Niets staat in de interactiestraal van een bouwplek, drukpers, commandopost of de Kerkklok', r.bijInteractie.length === 0, r.bijInteractie);
check('Het strijdtoneel blijft rustig: niets binnen 10 m van het monumentmidden', r.dichtstBijMonument >= 10, r.dichtstBijMonument);
check('Het decor houdt geen schoten tegen', r.raakbaar === 0, r.raakbaar);
check('De lampen gloeien (emissive)', r.lampGloed > 0.3, r.lampGloed);
check('Fietsen en toeristen hebben verschillende kleuren', r.fietsKleuren >= 3 && r.menskleuren >= 5, r);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
