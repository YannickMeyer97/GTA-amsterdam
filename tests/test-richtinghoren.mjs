// Ticket 80: Richtinghoren — pan op wereldgeluiden. Bewaakt de gedeelde
// berekenRelatieveHoek()/hoekNaarPan()-helpers (voorheen twee keer los
// geïmplementeerd in berekenSchadeWedgeHoek() en berekenBootHoornPanVolume()),
// de optionele pan-parameter op piep() (geen StereoPannerNode bij pan===0 of
// weggelaten), en de twee echte aanroepers (speelOndodeGrom, speelPlankBreek
// via beukBarricade()).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Pan-tekenconventie: links negatief, rechts positief, symmetrisch --
const teken = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const links = d.hoekNaarPan(d.berekenRelatieveHoek(-5, 0, 0, 0, 0));
  const rechts = d.hoekNaarPan(d.berekenRelatieveHoek(5, 0, 0, 0, 0));
  return { links, rechts };
});
check('Bron links van de speler geeft een NEGATIEVE pan', teken.links < -0.1, teken);
check('Bron rechts van de speler geeft een POSITIEVE pan', teken.rechts > 0.1, teken);
check('Links en rechts geven exact tegengestelde pan (symmetrisch rond 0)',
  Math.abs(teken.links + teken.rechts) < 0.001, teken);

// --- 2. Draait de speler, dan verandert de pan van dezelfde wereldbron mee -
const draaiTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const panYaw0 = d.hoekNaarPan(d.berekenRelatieveHoek(5, 0, 0, 0, 0));
  const panYaw90 = d.hoekNaarPan(d.berekenRelatieveHoek(5, 0, 0, 0, Math.PI / 2));
  return { panYaw0, panYaw90 };
});
check('Dezelfde wereldbron geeft een andere pan zodra de speler draait',
  Math.abs(draaiTest.panYaw0 - draaiTest.panYaw90) > 0.3, draaiTest);

// --- 3. Bron exact op de spelerpositie: pan 0, geen NaN (guard) -----------
const oorsprong = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const hoek = d.berekenRelatieveHoek(3, 4, 3, 4, 1.2);
  return { hoek, pan: d.hoekNaarPan(hoek) };
});
check('Bron exact op spelerpositie: relatieve hoek is 0 (geen NaN, geen -π-verrassing)',
  oorsprong.hoek === 0, oorsprong);
check('Bron exact op spelerpositie: pan is 0', oorsprong.pan === 0, oorsprong);

// --- 4. piep(): geen panner bij pan===0 of weggelaten, wel bij een echte pan
const monoTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const ctx = d.masterGainNode.context;
  const orig = ctx.createStereoPanner.bind(ctx);
  let teller = 0;
  ctx.createStereoPanner = (...a) => { teller++; return orig(...a); };
  d.piep('sine', 300, 300, 0.02, 0.02);          // geen pan-argument
  const naGeen = teller;
  d.piep('sine', 300, 300, 0.02, 0.02, 0);       // pan === 0
  const naNul = teller;
  d.piep('sine', 300, 300, 0.02, 0.02, 0.5);     // echte pan
  const naPan = teller;
  ctx.createStereoPanner = orig;
  return { naGeen, naNul, naPan };
});
check('piep() zonder pan-argument maakt geen StereoPannerNode aan', monoTest.naGeen === 0, monoTest);
check('piep() met pan===0 maakt ook geen StereoPannerNode aan', monoTest.naNul === 0, monoTest);
check('piep() met een echte pan-waarde maakt wel precies 1 StereoPannerNode aan', monoTest.naPan === 1, monoTest);

// --- 5. speelOndodeGrom(): echte aanroeper geeft de juiste pan door --------
const gromTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  const ctx = d.masterGainNode.context;
  const orig = ctx.createStereoPanner.bind(ctx);
  const aangemaakt = [];
  ctx.createStereoPanner = (...a) => { const p = orig(...a); aangemaakt.push(p); return p; };
  d.speelOndodeGrom('normaal', -5, 0);   // bron links
  const panLinks = aangemaakt.length ? aangemaakt[aangemaakt.length - 1].pan.value : null;
  d.speelOndodeGrom('normaal', 5, 0);    // bron rechts
  const panRechts = aangemaakt.length ? aangemaakt[aangemaakt.length - 1].pan.value : null;
  ctx.createStereoPanner = orig;
  return { aantal: aangemaakt.length, panLinks, panRechts };
});
check('speelOndodeGrom() met bronpositie maakt voor beide aanroepen een StereoPannerNode', gromTest.aantal === 2, gromTest);
check('speelOndodeGrom(): bron links geeft negatieve pan', gromTest.panLinks < -0.1, gromTest);
check('speelOndodeGrom(): bron rechts geeft positieve pan', gromTest.panRechts > 0.1, gromTest);

// --- 6. speelPlankBreek() via beukBarricade(): gerichte pan, teken klopt ---
const plankTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, 0);
  d.speler.yaw = 0;
  const venster = d.VENSTERS[0];
  const verwachtePan = d.hoekNaarPan(d.berekenRelatieveHoek(venster.x, venster.z, 0, 0, 0));
  const ctx = d.masterGainNode.context;
  const orig = ctx.createStereoPanner.bind(ctx);
  const aangemaakt = [];
  ctx.createStereoPanner = (...a) => { const p = orig(...a); aangemaakt.push(p); return p; };
  const plankenVoor = venster.planken;
  d.beukBarricade(venster);
  ctx.createStereoPanner = orig;
  return {
    aantal: aangemaakt.length,
    pan: aangemaakt.length ? aangemaakt[0].pan.value : null,
    // Alle panners van één geluid moeten dezelfde kant op wijzen; één laag
    // die de andere kant op pant zou het richtinghoren juist kapotmaken.
    allePansGelijk: aangemaakt.every(p => Math.abs(p.pan.value - aangemaakt[0].pan.value) < 1e-9),
    verwachtePan,
    plankenVoor, plankenNa: venster.planken,
  };
});
check('beukBarricade() beukt daadwerkelijk een plank eraf', plankTest.plankenNa === plankTest.plankenVoor - 1, plankTest);
// Ticket 154: speelPlankBreek heeft sindsdien TWEE klanklagen — de bestaande
// getoonde sweep én een ruislaag (versplinterend hout is in werkelijkheid
// vrijwel puur ruis). Elke laag heeft zijn eigen keten en dus zijn eigen
// panner; wat ertoe doet is dat ze dezelfde pan dragen. Vergelijk
// speelOndodeGrom hierboven: dáár deelt de ruis het filter met de
// oscillators, dus daar blijft het bij één panner per grom.
check('beukBarricade() speelt een gerichte plankbreek-pan (zelfde teken als de pure berekening)',
  plankTest.aantal === 2 && plankTest.allePansGelijk
  && Math.abs(plankTest.pan - plankTest.verwachtePan) < 0.001, plankTest);

// --- 7. Bron-check: piep()'s keten blijft exact osc -> gain -> masterGainNode
// bij afwezige/nul pan (geen extra node ertussen) -----------------------
const bronCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { bron: d.piep.toString() };
});
check('piep() connect nog steeds via masterGainNode (geen omweg om de mastermute)',
  /connect\(masterGainNode\)/.test(bronCheck.bron), bronCheck);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
