// Ticket 83: De Waterschouw — een tweede boot die permanent, los van de
// ontsnapping, patrouilleert. Bewaakt de hoofdeis uit het ticket: volledig
// onverwarbaar met de ontsnappingsboot (andere hoorn, andere minimap-marker,
// nooit een interactiepunt), en dat de schouw bootGroep/ontsnappingsPunt
// nergens aanraakt. Zie ROADMAP.md Ticket 83 en ARCHITECTURE_NOTES.md §9.5.1.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Eigen groep, ruimtelijk gescheiden van bootGroep --------------------
const ruimteTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    schouwBestaat: !!d.schouwGroep,
    bootBestaat: !!d.bootGroep,
    zijnVerschillendeObjecten: d.schouwGroep !== d.bootGroep,
    schouwZ: d.schouwGroep.position.z,
    bootZ: d.bootGroep.position.z,
    SCHOUW_Z: d.SCHOUW_Z,
  };
});
check('schouwGroep en bootGroep bestaan allebei en zijn verschillende objecten',
  ruimteTest.schouwBestaat && ruimteTest.bootBestaat && ruimteTest.zijnVerschillendeObjecten, ruimteTest);
check('De schouw vaart op een duidelijk andere Z dan de ontsnappingsboot (nooit dezelfde plek)',
  Math.abs(ruimteTest.schouwZ - ruimteTest.bootZ) > 1, ruimteTest);

// --- 2. De schouw raakt bootGroep/ontsnappingsPunt nergens aan --------------
const isolatieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingsPunt = null;
  d.ontsnappingAankondigingActief = false;
  const bootXVoor = d.bootGroep.position.x;
  const bootZVoor = d.bootGroep.position.z;
  for (let i = 0; i < 30; i++) d.updateSchouwPositie();
  return {
    bootXOngewijzigd: d.bootGroep.position.x === bootXVoor,
    bootZOngewijzigd: d.bootGroep.position.z === bootZVoor,
    ontsnappingsPuntNogSteedsNull: d.ontsnappingsPunt === null,
  };
});
check('updateSchouwPositie() laat bootGroep.position volledig ongemoeid',
  isolatieTest.bootXOngewijzigd && isolatieTest.bootZOngewijzigd, isolatieTest);
check('updateSchouwPositie() raakt ontsnappingsPunt niet aan', isolatieTest.ontsnappingsPuntNogSteedsNull, isolatieTest);

// --- 3. De schouw voegt NOOIT een interactiepunt toe, en blijft binnen zijn
// vaarbereik. --------------------------------------------------------------
const geenInteractieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const aantalVoor = d.interactiePunten.length;
  const posities = [];
  for (let i = 0; i < 40; i++) {
    d.updateSchouwPositie();
    posities.push(d.schouwGroep.position.x);
  }
  return {
    aantalVoor, aantalNa: d.interactiePunten.length,
    binnenBereik: posities.every(x => x >= d.SCHOUW_X_WEST - 0.01 && x <= d.SCHOUW_X_OOST + 0.01),
  };
});
check('interactiePunten groeit niet mee met de schouw (nooit een interactiepunt)',
  geenInteractieTest.aantalNa === geenInteractieTest.aantalVoor, geenInteractieTest);
check('De schouw blijft altijd binnen [SCHOUW_X_WEST, SCHOUW_X_OOST]', geenInteractieTest.binnenBereik, geenInteractieTest);

// --- 4. obstakels.length blijft 52 (geen collision toegevoegd) -------------
const obstakelTest = await page.evaluate(() => window.AmsterdamUndeadDebug.obstakels.length);
check('obstakels.length blijft 52', obstakelTest === 52, { obstakelTest });

// --- 5. De twee hoorns zijn aantoonbaar verschillend (frequentie/duur) -----
const hoornVerschilTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bootBron: d.speelBootHoorn.toString(),
    schouwBron: d.speelSchouwHoorn.toString(),
  };
});
check('speelBootHoorn() gebruikt nog steeds 200/140Hz over 1.1s (ongewijzigd, kritiek signaal)',
  /200/.test(hoornVerschilTest.bootBron) && /140/.test(hoornVerschilTest.bootBron) && /1\.1/.test(hoornVerschilTest.bootBron),
  hoornVerschilTest);
check('speelSchouwHoorn() gebruikt een ANDER register (480/380Hz) en een KORTERE duur (0.55s)',
  /480/.test(hoornVerschilTest.schouwBron) && /380/.test(hoornVerschilTest.schouwBron) && /0\.55/.test(hoornVerschilTest.schouwBron),
  hoornVerschilTest);

// --- 6. berekenSchouwHoornPanVolume(): pure functie, zelfde patroon als
// berekenBootHoornPanVolume (T80-conventie: rechts = +1, links = -1). ------
const panTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const yaw = 0;
  return {
    rechts: d.berekenSchouwHoornPanVolume(10, 0, yaw),
    links: d.berekenSchouwHoornPanVolume(-10, 0, yaw),
    dichtbij: d.berekenSchouwHoornPanVolume(0, -1, yaw),
    ver: d.berekenSchouwHoornPanVolume(0, -1000, yaw),
  };
});
check('Bron rechts van de speler: positieve pan', panTest.rechts.pan > 0.9, panTest);
check('Bron links van de speler: negatieve pan', panTest.links.pan < -0.9, panTest);
check('Dichtbij: volume dicht bij SCHOUW_HOORN_VOLUME_DICHTBIJ (0.05)',
  Math.abs(panTest.dichtbij.volume - 0.05) < 0.005, panTest);
check('Ver weg: volume geklemd op SCHOUW_HOORN_VOLUME_VER (0.015)', panTest.ver.volume === 0.015, panTest);
check('De schouw-hoorn is merkbaar zachter dan de ontsnappingshoorn (0.05 vs 0.11 dichtbij)',
  panTest.dichtbij.volume < 0.11, panTest);

// --- 7. speelSchouwHoorn(): no-op zonder audio, telt anders op -------------
const zonderAudio = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.schouwHoornTeller;
  d.speelSchouwHoorn();
  return { voor, na: d.schouwHoornTeller };
});
check('speelSchouwHoorn() vóór initGeluid() is een veilige no-op (geen teller-increment)',
  zonderAudio.na === zonderAudio.voor, zonderAudio);

const metAudio = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const voor = d.schouwHoornTeller;
  d.speelSchouwHoorn();
  return { voor, na: d.schouwHoornTeller };
});
check('speelSchouwHoorn() na initGeluid() verhoogt schouwHoornTeller met exact 1',
  metAudio.na === metAudio.voor + 1, metAudio);

// --- 8. updateSchouwHoorn(): cadans, volledig los van de ontsnappingsstaat --
const cadansTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = null;
  d.schouwHoornTimer = d.SCHOUW_HOORN_INTERVAL;
  const voor = d.schouwHoornTeller;
  const perStap = d.SCHOUW_HOORN_INTERVAL / 10;
  for (let i = 0; i < 9; i++) d.updateSchouwHoorn(perStap);
  const naNegen = d.schouwHoornTeller - voor;
  d.updateSchouwHoorn(perStap * 2);
  const naTien = d.schouwHoornTeller - voor;
  return { naNegen, naTien };
});
check('9 stappen van elk 1/10e van het interval spelen nog niets af', cadansTest.naNegen === 0, cadansTest);
check('Zodra de opgetelde tijd het interval overschrijdt, speelt de volgende stap precies 1x',
  cadansTest.naTien === 1, cadansTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
