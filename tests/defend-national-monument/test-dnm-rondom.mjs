// Ticket D39 (SONNET_EXECUTION_PLAN_monument.md, §11.5) — rond het monument:
// Bijenkorf, Krasnapolsky, Hotel TwentySeven (Industria) en het Madame
// Tussauds-blok.
//
// Het uiterlijk beoordeelt de eigenaar op schermafbeeldingen; deze test
// bewaakt per gebouw de meetbare kenmerken uit DAM_LAYOUT met stralen op de
// echte (samengevoegde) geometrie, en voor alle vier: weinig meshes, de
// hoogste maat, de textuur, de gevelnaam zichtbaar vóór de gevel, en niets
// dat op loophoogte door de botsing heen steekt.
import { openDefend, makeChecker } from '../helpers-defend.mjs';

const { browser, page, errs } = await openDefend();
const { check, report } = makeChecker();

const r = await page.evaluate(() => {
  const d = window.DamChaosDebug;
  const THREE = d.THREE;
  const ray = new THREE.Raycaster();
  const uit = {};
  const straal = d.speler.straal;
  const binnenObstakel = p => d.obstakels.some(o => p.x >= o.minX - straal && p.x <= o.maxX + straal && p.z >= o.minZ - straal && p.z <= o.maxZ + straal);
  for (const naam of ['Bijenkorf', 'Krasnapolsky', 'Hotel TwentySeven (Industria)', 'Madame Tussauds-blok']) {
    const gebouw = d.DAM_LAYOUT.gebouwen.find(g => g.naam === naam);
    const groep = d.gebouwGroepen.get(naam);
    groep.updateMatrixWorld(true);
    const meshes = [];
    groep.traverse(m => { if (m.isMesh && m.userData.onderdeel !== 'gevelnaam') meshes.push(m); });
    const raak = (o, v) => {
      ray.set(new THREE.Vector3(...o), new THREE.Vector3(...v).normalize());
      const hit = ray.intersectObjects(meshes, false)[0];
      return hit ? { naam: hit.object.name, punt: hit.point, afstand: hit.distance } : null;
    };
    const tel = (test, stralen) => {
      let stukken = 0, vorige = false;
      for (const [o, v] of stralen) { const is = test(raak(o, v)); if (is && !vorige) stukken++; vorige = is; }
      return stukken;
    };
    const [x0, z0, x1, z1] = gebouw.delen[0];
    const u = { meshes: meshes.map(m => m.name), inWereld: groep.parent === d.wereld, hoogsteDeel: gebouw.hoogsteDeel };
    u.maxY = new THREE.Box3().setFromObject(groep).max.y;
    u.textuur = meshes.find(m => m.name === 'gevel')?.material.map?.userData.canvas ? true : false;
    // Gevelnaam: de straal van het plein naar het midden van de letters raakt
    // geen gevelonderdeel vóór de letters.
    const bord = groep.children.find(m => m.userData.onderdeel === 'gevelnaam');
    if (bord) {
      const doel = bord.getWorldPosition(new THREE.Vector3());
      const van = new THREE.Vector3(-4, 1.7, 0);
      const v = doel.clone().sub(van);
      const hit = raak(van.toArray(), v.toArray());
      u.naamZichtbaar = !hit || hit.afstand > v.length() - 0.02;
    }
    // Op loophoogte: rondom stralen naar binnen; elk raakpunt binnen een
    // obstakel + spelerstraal.
    let buiten = 0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const y of [0.1, 0.8, 1.5, 2.2]) for (let i = 1; i < 200; i++) {
      const fx = x0 + (x1 - x0) * i / 200, fz = z0 + (z1 - z0) * i / 200;
      for (const [o, v] of [[[fx, y, z0 - 6], [0, 0, 1]], [[fx, y, z1 + 6], [0, 0, -1]], [[x0 - 6, y, fz], [1, 0, 0]], [[x1 + 6, y, fz], [-1, 0, 0]]]) {
        const h = raak(o, v);
        if (h && !binnenObstakel(h.punt)) buiten++;
      }
    }
    u.buitenBotsing = buiten;
    // Per gebouw de eigen kenmerken.
    if (naam === 'Bijenkorf') {
      const langsDam = (y, dz) => Array.from({ length: 800 }, (_, i) => [[x0 + 0.1 + (x1 - x0 - 0.2) * i / 799, y, z1 + dz], [0, 0, -1]]);
      u.etalages = tel(h => h?.naam === 'etalages', langsDam(2, 6));
      u.frontons = tel(h => h && h.punt.y > 17.4, Array.from({ length: 800 }, (_, i) => [[x0 + 0.1 + (x1 - x0 - 0.2) * i / 799, 40, z1 + 0.1], [0, -1, 0]]));
      const top = raak([(x0 + x1) / 2, 40, z1 - 4.5], [0, -1, 0]);
      u.koepel = top && { naam: top.naam, y: top.punt.y };
      u.textuurPatroon = meshes.find(m => m.name === 'gevel').material.map === d.vloerTextuur('baksteen');
    }
    if (naam === 'Krasnapolsky') {
      u.balkons = tel(h => h?.naam === 'smeedwerk', Array.from({ length: 900 }, (_, i) => [[x0 - 6, 5.6 + 0.73, -22 + 31 * i / 899], [1, 0, 0]]));
      const luifel = raak([x0 - 1.5, 40, -6.5], [0, -1, 0]);
      u.luifel = luifel && { naam: luifel.naam, y: luifel.punt.y };
      const kap = raak([(x0 + x1) / 2, 40, (z0 + z1) / 2], [0, -1, 0]);
      u.kap = kap && { naam: kap.naam, y: kap.punt.y };
      u.ingang = raak([x0 - 6, 1.2, -6.5], [1, 0, 0])?.naam;
    }
    if (naam === 'Hotel TwentySeven (Industria)') {
      const kap = raak([x0 + 2.85, 40, z0 + 2.85], [0, -1, 0]);
      u.kap = kap && { naam: kap.naam, y: kap.punt.y };
      u.koper = meshes.find(m => m.name === 'koepel')?.material.color.getHex();
      u.naastToren = raak([x0 + 12, 40, z0 + 2], [0, -1, 0])?.punt.y;
      u.juwelier = raak([x0 + 3, 2, z0 - 6], [0, 0, 1])?.naam;
      u.textuurPatroon = meshes.find(m => m.name === 'gevel').material.map === d.vloerTextuur('geleBaksteen');
    }
    if (naam === 'Madame Tussauds-blok') {
      u.beelden = tel(h => h?.naam === 'beelden', Array.from({ length: 600 }, (_, i) => [[x0 + 0.1 + (x1 - x0 - 0.2) * i / 599, 40, z0 + 0.1], [0, -1, 0]]));
      u.pui = tel(h => h?.naam === 'etalages' || h?.naam === 'kozijnen', Array.from({ length: 300 }, (_, i) => [[x0 + 0.5 + (x1 - x0 - 1) * i / 299, 2.5, z0 - 6], [0, 0, 1]]));
    }
    uit[naam] = u;
  }
  uit.koperKleur = d.PAL?.koper;
  return uit;
});

for (const [naam, u] of Object.entries(r)) {
  if (typeof u !== 'object' || !u?.meshes) continue;
  check(`${naam}: staat in de wereld, samengevoegd tot hooguit 14 meshes`, u.inWereld && u.meshes.length <= 14, u.meshes);
  check(`${naam}: de hoogste mesh raakt hoogsteDeel (${u.hoogsteDeel} m)`, Math.abs(u.maxY - u.hoogsteDeel) < 0.1, u.maxY);
  check(`${naam}: de gevel heeft een textuur uit de bibliotheek`, u.textuur, u);
  if (u.naamZichtbaar !== undefined) check(`${naam}: de gevelnaam staat vóór de gevel, zichtbaar vanaf het plein`, u.naamZichtbaar, u);
  check(`${naam}: op loophoogte steekt niets buiten botsing + spelerstraal`, u.buitenBotsing === 0, u.buitenBotsing);
}
const B = r['Bijenkorf'], K = r['Krasnapolsky'], I = r['Hotel TwentySeven (Industria)'], T = r['Madame Tussauds-blok'];
check('Bijenkorf: rode baksteen', B.textuurPatroon, B);
check('Bijenkorf: zes etalages van twee ruiten en de glazen hoofdingang aan de Dam (13 stukken glas op de begane grond)', B.etalages === 13, B.etalages);
check('Bijenkorf: segmentfrontons op de twee hoekpaviljoens en het midden', B.frontons === 3, B.frontons);
check('Bijenkorf: een torentje met een koepel boven het midden', B.koepel && ['koepel', 'goud'].includes(B.koepel.naam) && B.koepel.y > 21, B.koepel);
check('Krasnapolsky: vijf balkons op de eerste verdieping aan de Dam', K.balkons === 5, K.balkons);
check('Krasnapolsky: een glazen luifel boven de ingang', K.luifel && ['smeedwerk', 'etalages'].includes(K.luifel.naam) && K.luifel.y > 3.8 && K.luifel.y < 4.3, K.luifel);
check('Krasnapolsky: een ingang onder de luifel', K.ingang === 'deuren' || K.ingang === 'lijstwerk', K.ingang);
check('Krasnapolsky: een leien kap tussen 18 en 20 m', K.kap && K.kap.naam === 'dak' && K.kap.y > 18 && K.kap.y <= 20.05, K.kap);
check('Hotel TwentySeven: gele baksteen', I.textuurPatroon, I);
check('Hotel TwentySeven: het torendeel op de hoek draagt de koperen kap (boven 22 m)', I.kap && ['koepel', 'goud'].includes(I.kap.naam) && I.kap.y > 22, I.kap);
check('Hotel TwentySeven: asymmetrisch, naast de toren eindigt de gevel op ~17 m', I.naastToren < 17.5, I.naastToren);
check('Hotel TwentySeven: de juwelierspui op de hoek', ['winkelpui', 'etalages', 'kozijnen'].includes(I.juwelier), I.juwelier);
check('Madame Tussauds-blok: twee beelden op de hoeken aan de Dam', T.beelden === 2, T.beelden);
check('Madame Tussauds-blok: een grote winkelpui aan de Dam', T.pui >= 1, T.pui);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
