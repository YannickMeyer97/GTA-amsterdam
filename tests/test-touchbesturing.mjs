// Ticket 177 (v0.34, ronde 20): lopen, kijken en vuren op touch.
//
// WAT HIER HET ECHTE RISICO IS. Niet of één vinger werkt, maar of DRIE
// vingers tegelijk werken: lopen met links, kijken met rechts en vuren met
// de knop gebeurt in de praktijk allemaal op hetzelfde moment. Daar gaat dit
// soort besturing normaal op stuk — een tweede vinger die de stick steelt,
// of een losgelaten vinger die de verkeerde invoer stopzet. Elke aanraking
// wordt daarom bijgehouden op zijn eigen `identifier`, en dat is wat de
// meeste checks hieronder toetsen.
//
// Playwright kan echte TouchEvents versturen in een context met `hasTouch`
// (zie helpers.mjs) — multi-touch is dus gewoon headless te toetsen, en juist
// dat maakt deze test de moeite waard.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ touch: true });
const { check, report } = makeChecker();

// Stuurt een echte TouchEvent met een willekeurig aantal actieve vingers.
// `vingers` is een lijst van { id, x, y }; alle drie de lijsten
// (touches/targetTouches/changedTouches) worden correct gevuld, want de
// handlers lezen changedTouches en dat moet kloppen per event-type.
async function raak(type, vingers, alleActief = vingers) {
  await page.evaluate(({ type, vingers, alleActief }) => {
    const maak = (v) => new Touch({
      identifier: v.id, target: document.body,
      clientX: v.x, clientY: v.y, pageX: v.x, pageY: v.y,
    });
    const evt = new TouchEvent(type, {
      cancelable: true, bubbles: true,
      touches: alleActief.map(maak),
      targetTouches: alleActief.map(maak),
      changedTouches: vingers.map(maak),
    });
    document.body.dispatchEvent(evt);
  }, { type, vingers, alleActief });
}

// Zet het spel in de touch-modus en start een sessie, zonder pointer lock.
async function startTouchSessie() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true, get() { return null; },
    });
    d.zetBesturingModus('touch');
    d.startBesturing();
    d.speler.positie.set(0, 0, 0);
    d.speler.yaw = 0; d.speler.pitch = 0;
    d.laatTouchStickLos();
  });
}

const breedte = await page.evaluate(() => window.innerWidth);
const LINKS = Math.round(breedte * 0.25), RECHTS = Math.round(breedte * 0.75);

// --- 1. De modus springt om door een échte aanraking --------------------
const modusWissel = await page.evaluate(() => window.AmsterdamUndeadDebug.besturingModus);
check('Vóór de eerste aanraking staat het spel nog in de muismodus', modusWissel === 'muis', { modusWissel });

await raak('touchstart', [{ id: 1, x: LINKS, y: 200 }]);
await raak('touchend', [{ id: 1, x: LINKS, y: 200 }], []);
const naAanraking = await page.evaluate(() => window.AmsterdamUndeadDebug.besturingModus);
check('Eén echte aanraking zet de besturingsmodus op touch — geen apparaatdetectie nodig',
  naAanraking === 'touch', { naAanraking });

// --- 2. De stick verschijnt waar je duim landt --------------------------
await startTouchSessie();
await raak('touchstart', [{ id: 10, x: LINKS, y: 300 }]);
const stickGeplaatst = await page.evaluate((x) => {
  const el = document.getElementById('touchStick');
  const r = el.getBoundingClientRect();
  return {
    midX: Math.round(r.left + r.width / 2), midY: Math.round(r.top + r.height / 2),
    vinger: window.AmsterdamUndeadDebug.touchStick.vinger,
    zichtbaar: !document.getElementById('touchBediening').hidden,
  };
}, LINKS);
check('De stick springt naar de plek van de duim (beweeglijk, geen vaste positie)',
  Math.abs(stickGeplaatst.midX - LINKS) <= 2 && Math.abs(stickGeplaatst.midY - 300) <= 2, stickGeplaatst);
check('De stick is aan die ene vinger gekoppeld, en de bedieningslaag staat aan',
  stickGeplaatst.vinger === 10 && stickGeplaatst.zichtbaar, stickGeplaatst);

// --- 3. Lopen: analoog, en in de juiste richting ------------------------
const lopen = await page.evaluate(async ({ LINKS }) => {
  const d = window.AmsterdamUndeadDebug;
  const meet = async (dx, dy) => {
    d.speler.positie.set(0, 0, 0);
    d.speler.yaw = 0;
    const maak = (v) => new Touch({ identifier: v.id, target: document.body, clientX: v.x, clientY: v.y });
    const vinger = { id: 10, x: LINKS + dx, y: 300 + dy };
    document.body.dispatchEvent(new TouchEvent('touchmove', {
      cancelable: true, bubbles: true,
      touches: [maak(vinger)], targetTouches: [maak(vinger)], changedTouches: [maak(vinger)],
    }));
    d.updateSpeler(0.1);
    return { z: d.speler.positie.z, x: d.speler.positie.x, kracht: d.touchStick.kracht };
  };
  return {
    vooruit: await meet(0, -60),     // duim omhoog = vooruit
    achteruit: await meet(0, 60),
    rechts: await meet(60, 0),
    half: await meet(0, -26),        // halve uitslag op straal 52
    dodeZone: await meet(0, -3),     // binnen de dode zone
  };
}, { LINKS });
check('Duim omhoog loopt vooruit, duim omlaag achteruit (schermassen correct omgeklapt)',
  lopen.vooruit.z < -0.1 && lopen.achteruit.z > 0.1, lopen);
check('Duim opzij loopt opzij', Math.abs(lopen.rechts.x) > 0.1, lopen);
check('Volle uitslag geeft kracht 1, halve uitslag ongeveer de helft — de stick is analoog',
  Math.abs(lopen.vooruit.kracht - 1) < 0.01 && lopen.half.kracht > 0.4 && lopen.half.kracht < 0.6, lopen);
check('Halve uitslag legt ook echt ongeveer de halve afstand af',
  Math.abs(lopen.half.z) > Math.abs(lopen.vooruit.z) * 0.35
  && Math.abs(lopen.half.z) < Math.abs(lopen.vooruit.z) * 0.65, lopen);
check('Binnen de dode zone beweegt de speler niet',
  lopen.dodeZone.kracht === 0 && Math.abs(lopen.dodeZone.z) < 1e-9, lopen);

// --- 4. Kijken met de rechterhelft, via de bestaande gevoeligheid -------
await raak('touchend', [{ id: 10, x: LINKS, y: 300 }], []);
const kijken = await page.evaluate(async ({ RECHTS }) => {
  const d = window.AmsterdamUndeadDebug;
  const maak = (v) => new Touch({ identifier: v.id, target: document.body, clientX: v.x, clientY: v.y });
  const stuur = (type, v, actief) => document.body.dispatchEvent(new TouchEvent(type, {
    cancelable: true, bubbles: true,
    touches: actief.map(maak), targetTouches: actief.map(maak), changedTouches: [maak(v)],
  }));
  const meet = (factor) => {
    d.muisGevoeligheidFactor = factor;
    d.speler.yaw = 0; d.speler.pitch = 0;
    const start = { id: 20, x: RECHTS, y: 200 };
    stuur('touchstart', start, [start]);
    const eind = { id: 20, x: RECHTS - 50, y: 240 };
    stuur('touchmove', eind, [eind]);
    const uit = { yaw: d.speler.yaw, pitch: d.speler.pitch, vinger: d.touchKijkVinger };
    stuur('touchend', eind, []);
    return uit;
  };
  const normaal = meet(1);
  const dubbel = meet(2);
  // Pitch mag nooit buiten de klem komen, hoe ver je ook veegt.
  d.muisGevoeligheidFactor = 1;
  d.speler.pitch = 0;
  const start = { id: 21, x: RECHTS, y: 50 };
  stuur('touchstart', start, [start]);
  for (let i = 0; i < 20; i++) stuur('touchmove', { id: 21, x: RECHTS, y: 50 + i * 200 }, [{ id: 21, x: RECHTS, y: 50 + i * 200 }]);
  const pitchNaVeelVegen = d.speler.pitch;
  stuur('touchend', { id: 21, x: RECHTS, y: 300 }, []);
  return { normaal, dubbel, pitchNaVeelVegen };
}, { RECHTS });
check('Slepen op de rechterhelft draait de kijkrichting in beide assen',
  kijken.normaal.yaw !== 0 && kijken.normaal.pitch !== 0, kijken);
check('De kijk-vinger wordt op zijn eigen identifier bijgehouden',
  kijken.normaal.vinger === 20, kijken);
check('De bestaande gevoeligheidsinstelling (T75) werkt gewoon door: dubbel = dubbel',
  Math.abs(kijken.dubbel.yaw - kijken.normaal.yaw * 2) < 1e-9, kijken);
check('De pitch blijft geklemd, hoe ver je ook veegt',
  Math.abs(kijken.pitchNaVeelVegen) <= 1.45 + 1e-9, kijken);

// --- 5. DE KERN: drie vingers tegelijk, elk op zijn eigen identifier ----
const gelijktijdig = await page.evaluate(async ({ LINKS, RECHTS }) => {
  const d = window.AmsterdamUndeadDebug;
  d.laatTouchStickLos();
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0; d.speler.pitch = 0;
  const maak = (v) => new Touch({ identifier: v.id, target: document.body, clientX: v.x, clientY: v.y });
  const stuur = (type, gewijzigd, actief) => document.body.dispatchEvent(new TouchEvent(type, {
    cancelable: true, bubbles: true,
    touches: actief.map(maak), targetTouches: actief.map(maak), changedTouches: gewijzigd.map(maak),
  }));

  // Vinger A op de stick, vinger B op de kijkhelft — tegelijk neergezet.
  const a = { id: 30, x: LINKS, y: 300 };
  const b = { id: 31, x: RECHTS, y: 200 };
  stuur('touchstart', [a, b], [a, b]);
  const naBeide = { stick: d.touchStick.vinger, kijk: d.touchKijkVinger };

  // Allebei bewegen in hetzelfde event.
  const a2 = { id: 30, x: LINKS, y: 240 };
  const b2 = { id: 31, x: RECHTS - 40, y: 200 };
  stuur('touchmove', [a2, b2], [a2, b2]);
  d.updateSpeler(0.1);
  const naBeweging = { kracht: d.touchStick.kracht, yaw: d.speler.yaw, z: d.speler.positie.z };

  // En de vuurknop erbij, terwijl die twee blijven staan.
  const knop = document.getElementById('touchVuur');
  const r = knop.getBoundingClientRect();
  const c = { id: 32, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  knop.dispatchEvent(new TouchEvent('touchstart', {
    cancelable: true, bubbles: true,
    touches: [maak(a2), maak(b2), maak(c)], targetTouches: [maak(c)], changedTouches: [maak(c)],
  }));
  const metVuur = {
    vuur: d.schietKnopIngedrukt,
    stickIntact: d.touchStick.vinger === 30 && d.touchStick.kracht > 0,
    kijkIntact: d.touchKijkVinger === 31,
  };

  // Alleen de KIJK-vinger loslaten: de stick en de vuurknop moeten blijven.
  stuur('touchend', [b2], [a2, c]);
  const naKijkLos = {
    kijk: d.touchKijkVinger, stickKracht: d.touchStick.kracht, vuur: d.schietKnopIngedrukt,
  };

  // Daarna de stick loslaten: het vuren moet nog steeds doorgaan.
  stuur('touchend', [a2], [c]);
  const naStickLos = { stickKracht: d.touchStick.kracht, vuur: d.schietKnopIngedrukt };

  knop.dispatchEvent(new TouchEvent('touchend', { cancelable: true, bubbles: true, touches: [], targetTouches: [], changedTouches: [maak(c)] }));
  const naAlles = { vuur: d.schietKnopIngedrukt };
  return { naBeide, naBeweging, metVuur, naKijkLos, naStickLos, naAlles };
}, { LINKS, RECHTS });
check('Twee vingers tegelijk neerzetten geeft elk hun eigen rol (stick links, kijken rechts)',
  gelijktijdig.naBeide.stick === 30 && gelijktijdig.naBeide.kijk === 31, gelijktijdig);
check('Ze bewegen ook onafhankelijk: lopen én draaien in hetzelfde event',
  gelijktijdig.naBeweging.kracht > 0 && gelijktijdig.naBeweging.yaw !== 0
  && gelijktijdig.naBeweging.z < 0, gelijktijdig);
check('De vuurknop erbij laat de andere twee volledig ongemoeid — drie vingers tegelijk',
  gelijktijdig.metVuur.vuur && gelijktijdig.metVuur.stickIntact && gelijktijdig.metVuur.kijkIntact, gelijktijdig);
check('Alleen de kijk-vinger loslaten stopt alleen het kijken',
  gelijktijdig.naKijkLos.kijk === null && gelijktijdig.naKijkLos.stickKracht > 0
  && gelijktijdig.naKijkLos.vuur === true, gelijktijdig);
check('Daarna de stick loslaten stopt alleen het lopen, niet het vuren',
  gelijktijdig.naStickLos.stickKracht === 0 && gelijktijdig.naStickLos.vuur === true, gelijktijdig);
check('En de knop loslaten stopt het vuren', gelijktijdig.naAlles.vuur === false, gelijktijdig);

// --- 6. Een tweede vinger op de linkerhelft steelt de stick niet --------
const stickSteel = await page.evaluate(({ LINKS }) => {
  const d = window.AmsterdamUndeadDebug;
  d.laatTouchStickLos();
  const maak = (v) => new Touch({ identifier: v.id, target: document.body, clientX: v.x, clientY: v.y });
  const stuur = (type, gewijzigd, actief) => document.body.dispatchEvent(new TouchEvent(type, {
    cancelable: true, bubbles: true,
    touches: actief.map(maak), targetTouches: actief.map(maak), changedTouches: gewijzigd.map(maak),
  }));
  const eerste = { id: 40, x: LINKS, y: 300 };
  stuur('touchstart', [eerste], [eerste]);
  const tweede = { id: 41, x: LINKS + 30, y: 150 };
  stuur('touchstart', [tweede], [eerste, tweede]);
  return { vinger: d.touchStick.vinger, oorsprongY: d.touchStick.oorsprongY };
}, { LINKS });
check('Een tweede duim op de linkerhelft steelt de stick niet — die blijft bij de eerste vinger',
  stickSteel.vinger === 40 && stickSteel.oorsprongY === 300, stickSteel);

// --- 7. Pauzeren laat geen hangende invoer achter ----------------------
const naPauze = await page.evaluate(({ LINKS }) => {
  const d = window.AmsterdamUndeadDebug;
  // Sectie 6 liet bewust een vinger op de stick staan (dat wás de check);
  // zonder dit loslaten weigert de stick hieronder terecht de nieuwe vinger
  // en meet deze sectie niets.
  d.laatTouchStickLos();
  const maak = (v) => new Touch({ identifier: v.id, target: document.body, clientX: v.x, clientY: v.y });
  const vinger = { id: 50, x: LINKS, y: 300 };
  document.body.dispatchEvent(new TouchEvent('touchstart', {
    cancelable: true, bubbles: true,
    touches: [maak(vinger)], targetTouches: [maak(vinger)], changedTouches: [maak(vinger)],
  }));
  const beweeg = { id: 50, x: LINKS, y: 240 };
  document.body.dispatchEvent(new TouchEvent('touchmove', {
    cancelable: true, bubbles: true,
    touches: [maak(beweeg)], targetTouches: [maak(beweeg)], changedTouches: [maak(beweeg)],
  }));
  const krachtVoor = d.touchStick.kracht;
  d.verlaatBesturing();   // pauzeren terwijl de duim nog op de stick staat
  d.speler.positie.set(0, 0, 0);
  d.updateSpeler(0.2);
  return {
    krachtVoor, krachtNa: d.touchStick.kracht,
    verplaatst: Math.abs(d.speler.positie.z) > 1e-9,
    laagVerborgen: document.getElementById('touchBediening').hidden,
  };
}, { LINKS });
check('Pauzeren met de duim op de stick laat geen hangende beweging achter',
  naPauze.krachtVoor > 0 && naPauze.krachtNa === 0 && naPauze.verplaatst === false, naPauze);
check('En de bedieningslaag verdwijnt bij het pauzeren', naPauze.laagVerborgen === true, naPauze);

// --- 8. De muismodus is niet aangeraakt --------------------------------
// Het kijkpad is samengevoegd tot één functie; die moet voor de muis exact
// dezelfde uitkomst geven als vóór dit ticket (schaal 1).
const muisIntact = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('muis');
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return canvas; },
  });
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.muisGevoeligheidFactor = 1;
  window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
  const yawNa = d.speler.yaw;
  return { yawNa, verwacht: -100 * d.MUIS_GEVOELIGHEID_BASIS, touchLaagUit: document.getElementById('touchBediening').hidden };
});
check('De muisbesturing geeft nog exact dezelfde draaiing als vóór dit ticket',
  Math.abs(muisIntact.yawNa - muisIntact.verwacht) < 1e-12, muisIntact);
check('In de muismodus is de touch-bediening onzichtbaar', muisIntact.touchLaagUit === true, muisIntact);

/* --- De duim op VUUR richt óók -------------------------------------------
   GEVONDEN DOOR TE SPELEN, NIET DOOR TE TESTEN. T177 zette hier bewust
   `stopPropagation` neer "zodat een duim op deze knop geen kijk-drag start".
   Dat klinkt netjes en is fout: op een telefoon heb je twee duimen, links op
   de loopstick en rechts op VUUR. Er is dan geen derde vinger over, dus
   schieten sloot rondkijken volledig uit.

   Waarom geen enkele test dit ving: ze gebruikten allemaal LOSSE vingers,
   één per functie. Met drie identifiers werkt alles prima — alleen heeft een
   mens er twee. De opzet hieronder gebruikt daarom precies twee vingers, in
   de houding waarin je het toestel echt vasthoudt. */
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('touch');
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return null; },
  });
  d.startBesturing();
  d.speler.yaw = 0; d.speler.pitch = 0;
  d.laatTouchStickLos();
});

const vuurKnopMidden = await page.evaluate(() => {
  const r = document.getElementById('touchVuur').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
});

// Duim 1: links op de stick, en meteen vooruit geduwd — een duim die stil op
// de stick LIGT heeft terecht kracht 0, je loopt pas als je hem verschuift.
await raak('touchstart', [{ id: 40, x: LINKS, y: 300 }]);
await raak('touchmove', [{ id: 40, x: LINKS, y: 260 }]);
await page.evaluate(({ x, y }) => {
  const el = document.getElementById('touchVuur');
  const maak = () => new Touch({ identifier: 41, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  el.dispatchEvent(new TouchEvent('touchstart', {
    cancelable: true, bubbles: true,
    touches: [maak()], targetTouches: [maak()], changedTouches: [maak()],
  }));
}, vuurKnopMidden);

const tweeDuimen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    schiet: d.schietKnopIngedrukt,
    stickVinger: d.touchStick.vinger,
    kijkVinger: d.touchKijkVinger,
    yawVoor: d.speler.yaw,
  };
});
check('Met twee duimen (stick + VUUR) loopt, schiet én richt de speler: de vuurduim claimt de kijkvinger',
  tweeDuimen.schiet === true && tweeDuimen.stickVinger === 40 && tweeDuimen.kijkVinger === 41,
  tweeDuimen);

// Sleep de vuurduim opzij — dat hoort het beeld te draaien terwijl hij vuurt.
await page.evaluate(({ x, y }) => {
  const el = document.getElementById('touchVuur');
  const maak = () => new Touch({ identifier: 41, target: el, clientX: x - 70, clientY: y, pageX: x - 70, pageY: y });
  el.dispatchEvent(new TouchEvent('touchmove', {
    cancelable: true, bubbles: true,
    touches: [maak()], targetTouches: [maak()], changedTouches: [maak()],
  }));
}, vuurKnopMidden);

const naSleep = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { yaw: d.speler.yaw, schiet: d.schietKnopIngedrukt, kracht: d.touchStick.kracht };
});
check('Slepen vanaf de vuurknop draait het beeld — dit was de bug',
  naSleep.yaw !== tweeDuimen.yawVoor, { tweeDuimen, naSleep });
check('En tijdens dat richten blijft hij gewoon vuren en lopen',
  naSleep.schiet === true && naSleep.kracht > 0, naSleep);

// Vuurduim loslaten: schieten stopt, kijken stopt, de stick blijft staan.
await page.evaluate(({ x, y }) => {
  const el = document.getElementById('touchVuur');
  const maak = () => new Touch({ identifier: 41, target: el, clientX: x - 70, clientY: y, pageX: x - 70, pageY: y });
  el.dispatchEvent(new TouchEvent('touchend', {
    cancelable: true, bubbles: true, touches: [], targetTouches: [], changedTouches: [maak()],
  }));
}, vuurKnopMidden);

const naLos = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { schiet: d.schietKnopIngedrukt, kijkVinger: d.touchKijkVinger, stickVinger: d.touchStick.vinger };
});
check('De vuurduim loslaten stopt schieten én kijken, maar laat de loopduim met rust',
  naLos.schiet === false && naLos.kijkVinger === null && naLos.stickVinger === 40, naLos);

// En een kijkvinger die er al ligt, mag de vuurknop niet afpakken.
await page.evaluate(() => { window.AmsterdamUndeadDebug.laatTouchStickLos(); });
await raak('touchstart', [{ id: 50, x: RECHTS, y: 150 }]);
await page.evaluate(({ x, y }) => {
  const el = document.getElementById('touchVuur');
  const maak = () => new Touch({ identifier: 51, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
  el.dispatchEvent(new TouchEvent('touchstart', {
    cancelable: true, bubbles: true,
    touches: [maak()], targetTouches: [maak()], changedTouches: [maak()],
  }));
}, vuurKnopMidden);
const nietStelen = await page.evaluate(() => ({
  kijkVinger: window.AmsterdamUndeadDebug.touchKijkVinger,
  schiet: window.AmsterdamUndeadDebug.schietKnopIngedrukt,
}));
check('Ligt er al een kijkvinger, dan pakt de vuurknop die niet af (hij vuurt wel)',
  nietStelen.kijkVinger === 50 && nietStelen.schiet === true, nietStelen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
