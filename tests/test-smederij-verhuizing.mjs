// Winkel W1 (Ticket 35): de Smederij verhuist van de noordwest-binnenplaats
// naar de bijkeuken-zuidwand (6.8, 3.5) — ARCHITECTURE_NOTES §5.8,
// ontwerpbeslissing 28. Bewaakt: de oude plek geeft geen interactie meer,
// de nieuwe plek werkt voor beide wapens, vanuit de woonkamer verschijnt
// geen prompt door de muur heen (de deur4Punt-les), de route terugdeur <->
// kelderhals blijft vrij, en het aantal interactiepunten blijft 12.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Constanten + markering staan op de nieuwe positie -----------------
const posities = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const oudeX = d.DEUR2_X + 2.5, oudeZ = d.PLAATS_Z_NOORD + 1.2;
  return {
    SMEDERIJ_X: d.SMEDERIJ_X, SMEDERIJ_Z: d.SMEDERIJ_Z,
    oudeX, oudeZ,
    smederijPuntPos: { x: d.smederijPunt.positie.x, z: d.smederijPunt.positie.z },
    markeringPos: { x: d.smederijMarkering.position.x, z: d.smederijMarkering.position.z },
  };
});
check('SMEDERIJ_X/Z staan op de nieuwe bijkeuken-positie (6.8, 3.5)',
  posities.SMEDERIJ_X === 6.8 && posities.SMEDERIJ_Z === 3.5, posities);
check('SMEDERIJ_X/Z zijn NIET meer de oude binnenplaats-formule (DEUR2_X+2.5, PLAATS_Z_NOORD+1.2)',
  posities.SMEDERIJ_X !== posities.oudeX || posities.SMEDERIJ_Z !== posities.oudeZ, posities);
check('smederijPunt (kooppunt) volgt de nieuwe SMEDERIJ_X/Z',
  posities.smederijPuntPos.x === posities.SMEDERIJ_X && posities.smederijPuntPos.z === posities.SMEDERIJ_Z, posities);
check('smederijMarkering (vloerring + hamer-icoon) staat ook op de nieuwe positie',
  posities.markeringPos.x === posities.SMEDERIJ_X && posities.markeringPos.z === posities.SMEDERIJ_Z, posities);

// --- 2. Oude plek is leeg: updateInteracties() levert daar geen Smederij --
const oudePlek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const oudeX = d.DEUR2_X + 2.5, oudeZ = d.PLAATS_Z_NOORD + 1.2;
  d.speler.positie.set(oudeX, 0, oudeZ);
  d.updateInteracties();
  return { huidigeIsSmederij: d.huidigeInteractie === d.smederijPunt };
});
check('Op de oude positie levert updateInteracties() nooit de Smederij als interactie',
  oudePlek.huidigeIsSmederij === false, oudePlek);

// --- 3. Nieuwe plek: interactie werkt en beide wapens zijn smeedbaar ------
const nieuwePlek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(d.SMEDERIJ_X, 0, d.SMEDERIJ_Z);
  d.updateInteracties();
  const opNieuwePlek = d.huidigeInteractie === d.smederijPunt;

  d.spelStaat.geld = 100000;
  if (d.actiefWapenNaam !== 'drukspuit') d.wisselWapen();
  d.koopSmederij();
  const drukspuitGesmeed = d.wapenStaat.gesmeed;

  if (d.actiefWapenNaam !== 'ratelaar') { if (!d.ratelaarGekocht) d.koopRatelaar(); else d.wisselWapen(); }
  d.koopSmederij();
  const ratelaarGesmeed = d.wapenStaat.gesmeed;

  return { opNieuwePlek, drukspuitGesmeed, ratelaarGesmeed };
});
check('Op de nieuwe positie (6.8, 3.5) levert updateInteracties() wél de Smederij',
  nieuwePlek.opNieuwePlek === true, nieuwePlek);
check('Het volledige smeedpad werkt op de nieuwe plek voor de Drukspuit',
  nieuwePlek.drukspuitGesmeed === true, nieuwePlek);
check('Het volledige smeedpad werkt op de nieuwe plek voor de Ratelaar',
  nieuwePlek.ratelaarGesmeed === true, nieuwePlek);

// --- 4. Muur-check: vanuit de woonkamer (4.4, 3.5) GEEN Smederij-prompt ---
// Zelfde les als de deur4Punt-bugfix (Ticket 26): updateInteracties() is
// puur afstand-vs-radius, dus dit moet kloppen puur door de marge
// (afstand 2.4 m > interactieradius 1.6 m).
const muurCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(4.4, 0, 3.5);
  d.updateInteracties();
  const afstand = Math.hypot(d.SMEDERIJ_X - 4.4, d.SMEDERIJ_Z - 3.5);
  return { huidigeIsSmederij: d.huidigeInteractie === d.smederijPunt, afstand, radius: d.smederijPunt.radius };
});
check('Vanuit de woonkamer op (4.4, 3.5) verschijnt GEEN Smederij-prompt (afstand > radius)',
  muurCheck.huidigeIsSmederij === false && muurCheck.afstand > muurCheck.radius, muurCheck);

// --- 5. Route terugdeur <-> kelderhals blijft vrij (isVrijePlek-probes) ---
const route = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bijDeur4Punt: d.isVrijePlek(6.8, 0, 0.3),
    tussenDeur4EnKelderhals: d.isVrijePlek(8, -1, 0.3),
    inDeKelderhals: d.isVrijePlek(10, -3, 0.3),
    bijDeSmederijZelf: d.isVrijePlek(d.SMEDERIJ_X, d.SMEDERIJ_Z, 0.3),
  };
});
check('De route terugdeur -> kelderhals blijft volledig vrij beloopbaar (geen nieuwe collision)',
  route.bijDeur4Punt && route.tussenDeur4EnKelderhals && route.inDeKelderhals, route);
check('De Smederij zelf heeft geen collision (net als voorheen) — de plek is vrij beloopbaar',
  route.bijDeSmederijZelf, route);

// --- 6. Interactiepunten-telling blijft 11 (geen nieuwe/verdwenen punten
// t.o.v. de verhuizing zelf — was 12, maar Feedback verwijderde sindsdien
// het Provisiekast-punt, zie test-map-lus-zone-e-inhoud.mjs) --------------
const telling = await page.evaluate(() => window.AmsterdamUndeadDebug.interactiePunten.length);
check('Er staan nog steeds precies 11 interactiepunten geregistreerd',
  telling === 11, { telling });

// --- 7. Precies één Smederij(-punt) — nooit een tweede --------------------
const uniciteit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.interactiePunten.filter(p => p === d.smederijPunt).length;
});
check('smederijPunt komt precies 1x voor in interactiePunten (geen dubbele Smederij)',
  uniciteit === 1, { uniciteit });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
