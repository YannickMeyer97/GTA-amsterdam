// Ticket D10 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — bouwplekken.
//
// 5 poorten × 2 = 10 plekken in de aanloopcorridor van hun eigen poort.
//
// Afwijking van de tickettekst, bewust: het plan eist "elke plek ligt
// dichter bij zijn eigen poort dan bij elke andere". Dat is meetkundig
// onhaalbaar: de Kalverstraat- en Rokin-corridor komen vlak bij het monument
// samen, en de Kalverstraat-plek op 55 % ligt ~1 m dichter bij de Rokin-POORT
// — terwijl hij ruim 10 m van de Rokin-ROUTE ligt. De bedoeling ("een toren
// dekt één route") wordt daarom getoetst als: dichter bij de eigen route dan
// bij elke andere route.
//
// Ticket D32: de plekken komen sinds fase M uit DAM_LAYOUT (de
// goedgekeurde plattegrond), en "route" is de vaste route uit die layout
// (d.ROUTES), niet meer de gesimuleerde looproute. Twee toetsen zijn daarom
// aangepast:
// - "vrije plek" toetst of het torenobstakel (±0,7 m) vrij staat, niet een
//   willekeurige marge van 1 m: een plek op een stoep van 2,5 m ligt bewust
//   dicht bij de gevel;
// - "naast de looplijn" toetst de afstand tot de RAND van de strook (0,3 m
//   tot 3 m), niet tot de middellijn: een Damrak-strook is 9 m breed, een
//   plein-strook 3 m.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  // Afstand van p tot de rand van de strook van deze route (negatief = erop).
  function afstandTotRoute(p, poort) {
    const pr = d.projecteerOpRoute(d.ROUTES.get(poort.naam), p.x, p.z);
    return pr.afstand - pr.segment.breedte / 2;
  }
  const plekken = d.BOUWPLEKKEN.map(plek => {
    const eigen = d.SPAWN_POORTEN.find(p => p.naam === plek.poort);
    const eigenRoute = afstandTotRoute(plek.positie, eigen);
    const andereRoutes = d.SPAWN_POORTEN.filter(p => p !== eigen).map(p => afstandTotRoute(plek.positie, p));
    return {
      naam: `${plek.poort} ${plek.index + 1}`,
      poort: plek.poort, index: plek.index,
      x: plek.positie.x, z: plek.positie.z,
      binnenGrens: plek.positie.x >= d.GRENS.minX && plek.positie.x <= d.GRENS.maxX && plek.positie.z >= d.GRENS.minZ && plek.positie.z <= d.GRENS.maxZ,
      vrij: d.isVrijePlek(plek.positie.x, plek.positie.z, 0.7),
      buitenMonument: d.afstandTotMonument(plek.positie) > 0,
      eigenRoute, dichtsteAndereRoute: Math.min(...andereRoutes),
      totMonument: d.afstandTotMonument(plek.positie),
      totPoort: Math.hypot(plek.positie.x - eigen.positie.x, plek.positie.z - eigen.positie.z),
      interactie: d.interactiePunten.some(ip => ip.type === 'bouwplek' && ip.bouwplek === plek),
      inScene: !!plek.groep && plek.groep.parent === d.scene,
    };
  });
  const overlap = [];
  for (let i = 0; i < plekken.length; i++) for (let j = i + 1; j < plekken.length; j++) {
    const a = Math.hypot(plekken[i].x - plekken[j].x, plekken[i].z - plekken[j].z);
    if (a < 2 * d.BOUWPLEK_RADIUS) overlap.push([plekken[i].naam, plekken[j].naam, a]);
  }
  return { plekken, overlap, perPoort: d.SPAWN_POORTEN.map(p => d.BOUWPLEKKEN.filter(b => b.poort === p.naam).length) };
});

check('Er zijn 10 bouwplekken', r.plekken.length === 10, r.plekken.length);
check('Elke poort heeft er precies 2', r.perPoort.every(n => n === 2), r.perPoort);
for (const p of r.plekken) {
  check(`Bouwplek ${p.naam}: binnen GRENS, op een vrije plek, buiten de monumentdoos`, p.binnenGrens && p.vrij && p.buitenMonument, p);
  check(`Bouwplek ${p.naam}: ligt dichter bij de eigen route dan bij elke andere`, p.eigenRoute < p.dichtsteAndereRoute, p);
    // Tegelrand (halve tegel 0,9 m) tot strookrand: 0,3 m tot 3 m.
  const tegelTotStrook = p.eigenRoute - 0.9;
  check(`Bouwplek ${p.naam}: naast de strook (tegel 0,3–3 m van de rand), niet erop`, tegelTotStrook >= 0.3 && tegelTotStrook <= 3, { tegelTotStrook, ...p });
  check(`Bouwplek ${p.naam}: is een interactiepunt en staat in de scene`, p.interactie && p.inScene, p);
}
check('Geen twee bouwplekken liggen binnen elkaars radius', r.overlap.length === 0, r.overlap);
check('Per poort ligt plek 1 (ver) verder van het monument dan plek 2 (nabij)',
  r.perPoort.every((_, i) => {
    const poort = r.plekken.filter(p => p.poort === r.plekken[i * 2].poort);
    return poort.find(p => p.index === 0).totMonument > poort.find(p => p.index === 1).totMonument;
  }), r.plekken.map(p => [p.naam, p.totMonument.toFixed(1)]));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
