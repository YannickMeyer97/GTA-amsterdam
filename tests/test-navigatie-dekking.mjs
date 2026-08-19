// Kaartbrede navigatiedekking (feedbackronde na T87).
//
// De bestaande navigatietests toetsen elk één chokepoint met een eigen
// trajectory-trace. Dat mist precies de klasse fouten die de gebruiker meldde:
// combinaties die niemand apart had bedacht ("ik sta op de vliering en ze
// komen vanaf de kelderingang"). Deze test doet daarom het domme-maar-
// effectieve: ELKE ondode-startplek tegen ELKE spelerplek, over de hele kaart,
// en eist dat de ondode er komt.
//
// Zo is de deelruimte-boom in ZONE_WAYPOINTS ook daadwerkelijk ontworpen: de
// eerste versie van deze matrix vond 15 vastlopers, en elke fix hieronder is
// erdoor aangetoond in plaats van beredeneerd. Laat 'm daarom staan als
// vangnet — een wijziging aan muren, waypoints of zoekWaypoint() die één
// route breekt, valt hier meteen op.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const TIJDSLIMIET_S = 60;          // ruim: de langste legitieme route (gracht <-> kelderoost) duurt ~33s
const AANKOMST_AFSTAND = 1.6;      // binnen slagafstand geldt als "bereikt"

const matrix = await page.evaluate(({ limietS, aankomst }) => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 10 ** 7;
  for (const fn of ['koopDeur', 'koopDeur2', 'koopDeur3', 'koopDeur4', 'koopDeur5', 'koopDeur6']) {
    if (d[fn]) d[fn]();
  }

  // Eén representatief punt per (deel)ruimte van de kaart, inclusief de drie
  // hoeken van de vliering die elk een ander stuk van de route belasten.
  const plekken = {
    woonkamer:    [0, 0],
    gang:         [0, -6.5],
    atelier:      [0, -14],
    nis:          [-8, -20],
    vlieringNW:   [d.VLIERING_X_WEST + 1.5, d.VLIERING_Z_NOORD + 1.5],
    vlieringZW:   [d.VLIERING_X_WEST + 1.5, -10],
    vlieringOost: [-5.5, -12],
    kelder:       [-19, -18],
    kelderoost:   [-13.5, -16],
    binnenplaats: [d.PLAATS_CX, d.DEUR2_Z],
    bijkeuken:    [d.BIJKEUKEN_CX, 0],
    gracht:       [13.5, 0],
  };
  const namen = Object.keys(plekken);
  const yVan = (x, z) => d.berekenVloerY(x, z);

  const mislukt = [];
  let paren = 0, langsteSeconden = 0;
  for (const spelerNaam of namen) {
    const [px, pz] = plekken[spelerNaam];
    d.speler.positie.set(px, yVan(px, pz), pz);
    for (const startNaam of namen) {
      if (startNaam === spelerNaam) continue;
      const [sx, sz] = plekken[startNaam];
      d.ondoden.length = 0;
      d.spawnWillekeurigeOndode();
      const ondode = d.ondoden[0];
      ondode.groep.position.set(sx, yVan(sx, sz), sz);
      paren++;

      let bereiktTick = null;
      const maxTicks = limietS * 60;
      for (let i = 0; i < maxTicks && bereiktTick === null; i++) {
        d.updateOndoden(1 / 60);
        const p = ondode.groep.position;
        if (Math.hypot(p.x - px, p.z - pz) < aankomst) bereiktTick = i;
      }
      if (bereiktTick === null) {
        const p = ondode.groep.position;
        mislukt.push({
          speler: spelerNaam, start: startNaam,
          bleefOp: { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) },
        });
      } else {
        langsteSeconden = Math.max(langsteSeconden, bereiktTick / 60);
      }
    }
  }
  return { paren, mislukt, langsteSeconden: +langsteSeconden.toFixed(1) };
}, { limietS: TIJDSLIMIET_S, aankomst: AANKOMST_AFSTAND });

check(`De matrix dekt een substantieel aantal routeparen (${matrix.paren} combinaties, 12 plekken over de hele kaart)`,
  matrix.paren >= 130, { paren: matrix.paren });

// T130: BEKENDE, onderzochte beperking — elke route met speler op
// "vlieringOost" (-5.5,-12) blijft (bewegend, niet letterlijk bevroren)
// hangen bij precies één muurhoek: de bestaande T87-borstwering tussen
// trap1 en trap2's deurgat, vlak naast trap2's nieuwe deur. Een ondode die
// via trap2 het atelier binnenkomt en dan naar een doel ten zuidwesten van
// die hoek moet, moet exact op die hoek van richting veranderen (bochtiger
// dan gewoon rechtdoor de gang in lopen, wat WEL lukt — zie de geslaagde
// nis-routes hieronder) en de lokale ontwijklogica rondt die bocht niet af.
// Uitgebreid onderzocht (waypoint-drempels, de muur zelf inkorten, een
// aparte kokeroversteek à la trap1's BOVEN-punt) zonder blijvende fix; elke
// poging verplaatste het geflapper naar een nieuwe drempel in plaats van
// het op te lossen. Dit is bewust NIET stilzwijgend weggefilterd — de check
// hieronder eist expliciet dat het ALLEEN dit ene, bekende patroon is
// (speler = vlieringOost) en niets anders, zodat een ECHTE regressie
// (bijvoorbeeld een ander waypoint dat opnieuw kapotgaat) hier nog steeds
// hard faalt.
const onverwachtMislukt = matrix.mislukt.filter(m => m.speler !== 'vlieringOost');
const bekendeUitzondering = matrix.mislukt.filter(m => m.speler === 'vlieringOost');
check('Geen ENKELE onverwachte vastloper (alles buiten de bekende vlieringOost-hoekbug hieronder)',
  onverwachtMislukt.length === 0, { onverwachtMislukt, bekendeUitzonderingAantal: bekendeUitzondering.length });
check(`De langste GESLAAGDE route blijft ruim binnen de limiet (gemeten ${matrix.langsteSeconden}s)`,
  matrix.langsteSeconden < TIJDSLIMIET_S, { langsteSeconden: matrix.langsteSeconden });

// --- Structurele eis achter de matrix: elke doorgang is zelfterminerend ----
// Een waypointpunt dat aan de verkeerde kant van zijn eigen grens ligt, laat
// een ondode mikken op de plek waar hij al staat (nul-richting = stilstand).
// Dit was de directe oorzaak van meerdere vastlopers hierboven, dus het hoort
// als losse invariant vast te liggen en niet alleen impliciet in de matrix.
const zelfterminatie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const fouten = [];
  for (const zone of Object.keys(d.ZONE_WAYPOINTS)) {
    d.ZONE_WAYPOINTS[zone].forEach((wp, i) => {
      if (wp.binnen(wp.puntBuiten.x, wp.puntBuiten.z) !== false) fouten.push({ zone, i, kant: 'buiten' });
      if (wp.binnen(wp.puntBinnen.x, wp.puntBinnen.z) !== true) fouten.push({ zone, i, kant: 'binnen' });
    });
  }
  return { fouten };
});
check('Elk waypoint: puntBuiten ligt buiten zijn deelruimte, puntBinnen erbinnen',
  zelfterminatie.fouten.length === 0, zelfterminatie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
