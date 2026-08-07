// Feedback ("hoe kan de boot beter aangekondigd worden?"): optie 1
// (pulserende minimap-marker op de bootpositie, zie tekenMinimap()) + optie 3
// (herhaalde gerichte hoorn — pan/volume naar richting en afstand) samen
// doorgevoerd. berekenBootHoornPanVolume() gebruikt dezelfde relatieveHoek-
// conventie als toonSchadeRichting()/de minimap-speler-driehoek (reken kundig
// linksom-georiënteerd, dus de pan-berekening negeert bewust -sin() —
// front/behind alleen kunnen die sign-mirror-bugklasse niet vangen, vandaar
// expliciete links/rechts-checks hieronder). Zie ARCHITECTURE_NOTES.md
// §7.8.2/§7.6.5 voor de conventie-uitleg elders in de codebase.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. berekenBootHoornPanVolume(): pure functie, richting + afstand -----
const richting = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const yaw = 0;   // kijkt naar -z
  return {
    voor: d.berekenBootHoornPanVolume(0, -10, yaw),      // bron op -z: recht vooruit
    achter: d.berekenBootHoornPanVolume(0, 10, yaw),     // bron op +z: recht achter
    rechts: d.berekenBootHoornPanVolume(10, 0, yaw),     // bron op +x: rechts
    links: d.berekenBootHoornPanVolume(-10, 0, yaw),     // bron op -x: links
    dichtbij: d.berekenBootHoornPanVolume(0, -1, yaw),
    ver: d.berekenBootHoornPanVolume(0, -1000, yaw),
  };
});
check('Bron recht vooruit: pan ≈ 0', Math.abs(richting.voor.pan) < 0.01, richting);
check('Bron recht achter: |pan| ≈ 0 (front/behind is sign-symmetrisch, dus dit alleen bewijst nog niet de juiste kant)',
  Math.abs(richting.achter.pan) < 0.01, richting);
check('Bron rechts van de speler: POSITIEVE pan (rechts = +1 in StereoPannerNode-conventie)',
  richting.rechts.pan > 0.9, richting);
check('Bron links van de speler: NEGATIEVE pan', richting.links.pan < -0.9, richting);
check('Rechts en links geven exact tegengestelde pan (symmetrisch rond 0)',
  Math.abs(richting.rechts.pan + richting.links.pan) < 0.001, richting);
check('Dichtbij (1m): volume dicht bij BOOT_HOORN_VOLUME_DICHTBIJ (0.11)',
  Math.abs(richting.dichtbij.volume - 0.11) < 0.005, richting);
check('Heel ver weg (voorbij BOOT_HOORN_AFSTAND_MAX): volume geklemd op BOOT_HOORN_VOLUME_VER (0.02)',
  richting.ver.volume === 0.02, richting);
check('BOOT_HOORN_HERHAAL_INTERVAL is 7s, BOOT_HOORN_AFSTAND_MAX is 26m', await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return d.BOOT_HOORN_HERHAAL_INTERVAL === 7 && d.BOOT_HOORN_AFSTAND_MAX === 26;
}), {});

// --- 2. speelBootHoornGericht(): no-op zonder audio, telt anders op --------
const zonderAudio = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = d.bootHoornHerhaalTeller;
  d.speelBootHoornGericht();
  return { voor, na: d.bootHoornHerhaalTeller };
});
check('speelBootHoornGericht() vóór initGeluid() is een veilige no-op (geen audio, geen teller-increment)',
  zonderAudio.na === zonderAudio.voor, zonderAudio);

const metAudio = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  const voor = d.bootHoornHerhaalTeller;
  d.speelBootHoornGericht();
  return { voor, na: d.bootHoornHerhaalTeller };
});
check('speelBootHoornGericht() na initGeluid() verhoogt bootHoornHerhaalTeller met exact 1',
  metAudio.na === metAudio.voor + 1, metAudio);

// --- 3. updateBootHoornHerhaling(): cadans, alleen actief tijdens aankondiging/venster ---
const geenAankondiging = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = null;
  const voor = d.bootHoornHerhaalTeller;
  d.updateBootHoornHerhaling(100);   // ruim voorbij elk interval
  return { voor, na: d.bootHoornHerhaalTeller };
});
check('Zonder actieve aankondiging/venster: updateBootHoornHerhaling() speelt nooit, ongeacht dt',
  geenAankondiging.na === geenAankondiging.voor, geenAankondiging);

const cadansTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingAankondigingActief = true;
  d.bootHoornHerhaalTimer = d.BOOT_HOORN_HERHAAL_INTERVAL;
  const voor = d.bootHoornHerhaalTeller;
  const perStap = d.BOOT_HOORN_HERHAAL_INTERVAL / 10;
  for (let i = 0; i < 9; i++) d.updateBootHoornHerhaling(perStap);
  const naNegen = d.bootHoornHerhaalTeller - voor;
  d.updateBootHoornHerhaling(perStap * 2);
  const naTien = d.bootHoornHerhaalTeller - voor;
  d.ontsnappingAankondigingActief = false;
  return { naNegen, naTien };
});
check('9 stappen van elk 1/10e van het interval spelen nog niets af', cadansTest.naNegen === 0, cadansTest);
check('Zodra de opgetelde tijd het interval overschrijdt, speelt de volgende stap precies 1x',
  cadansTest.naTien === 1, cadansTest);

const doorlopendVenster = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = { naam: 'test' };   // simuleert een open venster (echte vorm doet er niet toe voor deze check)
  d.bootHoornHerhaalTimer = 0;
  const voor = d.bootHoornHerhaalTeller;
  d.updateBootHoornHerhaling(0.001);
  const speeldeMeteenAf = d.bootHoornHerhaalTeller > voor;
  d.ontsnappingsPunt = null;
  return { speeldeMeteenAf };
});
check('Met een open venster (ontsnappingsPunt bestaat, geen aankondiging meer) blijft de herhaling actief',
  doorlopendVenster.speeldeMeteenAf, doorlopendVenster);

// --- 4. probeerOntsnappingsVensterTeOpenen() primet de herhaaltimer --------
const priming = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = null;
  d.ontsnappingUitgelegd = true;   // voorkomt de aparte uitleg-tekst-tak, niet relevant hier
  d.vluchtOnderdelenOpgepakt = d.VLUCHT_ONDERDELEN.length;
  d.spelStaat.golf = d.ONTSNAPPING_START_GOLF;
  d.bootHoornHerhaalTimer = 0;
  const hoornVoor = d.bootHoornTeller;
  d.probeerOntsnappingsVensterTeOpenen();
  return {
    aankondigingActief: d.ontsnappingAankondigingActief,
    hoornGespeeld: d.bootHoornTeller - hoornVoor === 1,
    timerGeprimet: d.bootHoornHerhaalTimer === d.BOOT_HOORN_HERHAAL_INTERVAL,
  };
});
check('probeerOntsnappingsVensterTeOpenen() start de aankondiging en speelt de éénmalige hoorn',
  priming.aankondigingActief && priming.hoornGespeeld, priming);
check('...en primet bootHoornHerhaalTimer op het volle interval (geen dubbele hoorn boven op speelBootHoorn())',
  priming.timerGeprimet, priming);

// Opruimen voor de rest van de suite.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.ontsnappingAankondigingActief = false;
  d.ontsnappingAankondigingTimer = 0;
});

// --- 5. Minimap: amberkleurige ONTSNAPPINGS-marker (arc) verschijnt alleen
// tijdens aankondiging/venster. Ticket 83 (De Waterschouw) voegde een TWEEDE,
// ALTIJD zichtbare marker toe (een vierkantje, ctx.fillRect, nooit een arc)
// — deze assertie is daarom aangescherpt van "boot-marker" naar expliciet
// "de ONTSNAPPINGS-marker (arc)", en sectie 5b hieronder bewijst actief dat
// de schouw-marker daar los van staat (geen arc, wél altijd aanwezig). -----
const minimapMetAankondiging = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let arcAantal = 0;
  const origArc = ctx.arc.bind(ctx);
  ctx.arc = (...a) => { arcAantal++; return origArc(...a); };

  d.speler.positie.set(0, 0, 0);
  for (const o of [...d.ondoden]) d.doodOndode(o);

  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = null;
  d.tekenMinimap();
  const zonder = arcAantal;

  arcAantal = 0;
  d.ontsnappingAankondigingActief = true;
  d.tekenMinimap();
  const tijdensAankondiging = arcAantal;

  arcAantal = 0;
  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = { naam: 'test' };
  d.tekenMinimap();
  const tijdensVenster = arcAantal;

  ctx.arc = origArc;
  d.ontsnappingsPunt = null;
  return { zonder, tijdensAankondiging, tijdensVenster };
});
check('Zonder aankondiging/venster: geen ONTSNAPPINGS-marker (arc) op de minimap',
  minimapMetAankondiging.zonder === 0, minimapMetAankondiging);
check('Tijdens de aankondiging: de ONTSNAPPINGS-marker (arc) wordt precies 1x getekend',
  minimapMetAankondiging.tijdensAankondiging === 1, minimapMetAankondiging);
check('Tijdens een open venster: de ONTSNAPPINGS-marker (arc) wordt ook precies 1x getekend',
  minimapMetAankondiging.tijdensVenster === 1, minimapMetAankondiging);

// --- 5b. De Waterschouw-marker (fillRect) is hier volledig los van: telt
// nooit mee als arc, en staat er ALTIJD, in alle drie de scenario's hierboven. ---
const schouwMarkerTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ctx = d.minimapUI.getContext('2d');
  let rectAantal = 0;
  const origFillRect = ctx.fillRect.bind(ctx);
  ctx.fillRect = (...a) => { rectAantal++; return origFillRect(...a); };

  d.ontsnappingAankondigingActief = false;
  d.ontsnappingsPunt = null;
  rectAantal = 0;
  d.tekenMinimap();
  const zonder = rectAantal;

  d.ontsnappingAankondigingActief = true;
  rectAantal = 0;
  d.tekenMinimap();
  const tijdensAankondiging = rectAantal;

  ctx.fillRect = origFillRect;
  d.ontsnappingAankondigingActief = false;
  return { zonder, tijdensAankondiging };
});
check('De schouw-marker (fillRect) staat er ook ZONDER een ontsnappings-aankondiging/venster',
  schouwMarkerTest.zonder >= 1, schouwMarkerTest);
check('De schouw-marker blijft even vaak getekend tijdens een aankondiging (onafhankelijk van de ontsnapping)',
  schouwMarkerTest.tijdensAankondiging === schouwMarkerTest.zonder, schouwMarkerTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
