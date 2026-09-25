// Ticket D10 (SONNET_EXECUTION_PLAN_monument.md, fase 3) — bouwplekken.
//
// Ticket D46: 3 knooppunten op het plein. Ticket D50: 3 voorposten, elk aan
// de overkant van de weg tegenover een knooppunt (was: 5, één per straat).
// Een plek hoort bij één of twee routes (plek.routes).
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
    const eigen = d.SPAWN_POORTEN.filter(p => plek.routes.includes(p.naam));
    const eigenRoute = Math.min(...eigen.map(p => afstandTotRoute(plek.positie, p)));
    const andereRoutes = d.SPAWN_POORTEN.filter(p => !eigen.includes(p)).map(p => afstandTotRoute(plek.positie, p));
    // Hoeveel meter van elke eigen route binnen het torenbereik (niveau 1) ligt.
    const bereik = d.TOREN_TYPES.geschut.bereik;
    const dekking = eigen.map(p => d.looproute(p).filter(q => Math.hypot(q.x - plek.positie.x, q.z - plek.positie.z) <= bereik).length * 0.25);
    return {
      naam: plek.naam, soort: plek.soort, routes: plek.routes, dekking,
      x: plek.positie.x, z: plek.positie.z,
      binnenGrens: plek.positie.x >= d.GRENS.minX && plek.positie.x <= d.GRENS.maxX && plek.positie.z >= d.GRENS.minZ && plek.positie.z <= d.GRENS.maxZ,
      vrij: d.isVrijePlek(plek.positie.x, plek.positie.z, 0.7),
      buitenMonument: d.afstandTotMonument(plek.positie) > 0,
      eigenRoute, dichtsteAndereRoute: Math.min(...andereRoutes),
      totMonument: d.afstandTotMonument(plek.positie),

      interactie: d.interactiePunten.some(ip => ip.type === 'bouwplek' && ip.bouwplek === plek),
      inScene: !!plek.groep && plek.groep.parent === d.scene,
    };
  });
  const overlap = [];
  for (let i = 0; i < plekken.length; i++) for (let j = i + 1; j < plekken.length; j++) {
    const a = Math.hypot(plekken[i].x - plekken[j].x, plekken[i].z - plekken[j].z);
    if (a < 2 * d.BOUWPLEK_RADIUS) overlap.push([plekken[i].naam, plekken[j].naam, a]);
  }
  return {
    plekken, overlap, wapenBereik: d.WAPEN_BEREIK,
    overkant: d.BOUWPLEKKEN.filter(b => b.soort === 'knooppunt').map(k => {
      const v = d.BOUWPLEKKEN.filter(b => b.soort === 'voorpost' && b.overkantVan === k.naam);
      const route = d.ROUTES.get(k.routes[0]);
      const kant = p => { const pr = d.projecteerOpRoute(route, p.positie.x, p.positie.z); return Math.sign((p.positie.x - pr.x) * -pr.rz + (p.positie.z - pr.z) * pr.rx); };
      return { knooppunt: k.naam, voorposten: v.map(p => p.naam), andereKant: v.length === 1 && kant(v[0]) !== kant(k), afstand: v[0] ? v[0].positie.distanceTo(k.positie) : null };
    }),
    knooppuntPerPoort: d.SPAWN_POORTEN.map(p => d.BOUWPLEKKEN.filter(b => b.soort === 'knooppunt' && b.routes.includes(p.naam)).length),
    plekVoor: [d.plekVoor('Rokin', 'knooppunt')?.naam, d.plekVoor('Rokin', 'voorpost')?.naam],
  };
});

check('Er zijn 6 bouwplekken: 3 knooppunten en 3 voorposten (D50)', r.plekken.length === 6 && r.plekken.filter(p => p.soort === 'knooppunt').length === 3, r.plekken.map(p => [p.naam, p.soort]));
check('Elke poort heeft precies één knooppunt', r.knooppuntPerPoort.every(n => n === 1), r.knooppuntPerPoort);
for (const o of r.overkant) check(`${o.knooppunt}: één voorpost aan de overkant van de weg, ≤ 16 m verderop`, o.andereKant && o.afstand <= 16, o);
check('plekVoor vindt de plek van een soort bij een route (Rokin: de voorpost tegenover Plein zuid)', r.plekVoor[0] === 'Plein zuid' && r.plekVoor[1] === 'Kalverstraat noord', r.plekVoor);
for (const p of r.plekken) {
  check(`Bouwplek ${p.naam}: binnen GRENS, op een vrije plek, buiten de monumentdoos`, p.binnenGrens && p.vrij && p.buitenMonument, p);
  check(`Bouwplek ${p.naam}: ligt dichter bij een eigen route dan bij elke andere`, p.eigenRoute < p.dichtsteAndereRoute, p);
  check(`Bouwplek ${p.naam}: elke eigen route ligt ≥ 5 m binnen het torenbereik`, p.dekking.every(m => m >= 5), p.dekking);
    // Tegelrand (halve tegel 0,9 m) tot strookrand: 0,3 m tot 3 m.
  const tegelTotStrook = p.eigenRoute - 0.9;
  check(`Bouwplek ${p.naam}: naast de strook (tegel 0,3–3 m van de rand), niet erop`, tegelTotStrook >= 0.3 && tegelTotStrook <= 3, { tegelTotStrook, ...p });
  check(`Bouwplek ${p.naam}: is een interactiepunt en staat in de scene`, p.interactie && p.inScene, p);
}
check('Geen twee bouwplekken liggen binnen elkaars radius', r.overlap.length === 0, r.overlap);
check('Knooppunten liggen binnen het wapenbereik', r.plekken.every(p => p.soort !== 'knooppunt' || p.totMonument <= r.wapenBereik),
  r.plekken.map(p => [p.naam, p.totMonument.toFixed(1)]));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
