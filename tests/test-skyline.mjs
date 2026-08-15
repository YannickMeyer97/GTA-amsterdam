// Ticket 112 (v0.22, §10.13-beslissing 88): skyline-silhouet — drie lagen
// platte, zwarte verre bebouwing (noordlaag 26/30/34m, oostlaag 30/36/40m
// vanaf het eigen T88-standpunt — zie de code-toelichting bij de plaatsing
// voor waarom dit een kleine, bewuste afwijking is t.o.v. de "30/40/45 m"
// uit de architectuurschets) rond de open kanten van de kaart. Generieke
// pandvormen, geen herkenbaar bestaand Amsterdams gebouw (CLAUDE.md
// IP-regel).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Structuur: 3 lagen x (5 noord + 4 oost) = 27 silhouetgebouwen,
// elk getagd via userData.skyline (de bouwfuncties zelf zijn lokaal aan
// hun IIFE-blok, niet rechtstreeks bereikbaar via het debug-hook).
const telling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const perLaag = [0, 0, 0];
  let totaal = 0;
  d.wereld.traverse((k) => {
    if (k.userData?.skyline) {
      totaal++;
      perLaag[k.userData.skylineLaag]++;
    }
  });
  return { totaal, perLaag };
});
check('Er staan precies 27 skyline-silhouetgebouwen in de wereld (3 lagen x (5 noord + 4 oost))',
  telling.totaal === 27, telling);
check('Elke laag (0=dichtstbij, 1=midden, 2=verst) heeft precies 9 gebouwen (5 noord + 4 oost)',
  telling.perLaag.every(n => n === 9), telling);

// --- 2. Elk silhouetgebouw is een Group met een BoxGeometry-romp (en soms
// een ShapeGeometry-puntgevel) op een gedeeld MeshBasicMaterial, met
// fog:false (eis: "niet oplossen in het niets", zelfde afweging als de
// T111-dome) en zonder lichtrespons (geen MeshStandardMaterial).
const materiaalTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const infos = [];
  d.wereld.traverse((k) => {
    if (k.userData?.skyline) {
      const rompen = k.children.filter(c => c.geometry?.type === 'BoxGeometry');
      const daken = k.children.filter(c => c.geometry?.type === 'ShapeGeometry');
      infos.push({
        aantalKinderen: k.children.length,
        rompen: rompen.length,
        daken: daken.length,
        heeftDak: k.userData.skylineDak,
        isBasicMaterial: rompen[0]?.material?.isMeshBasicMaterial,
        fog: rompen[0]?.material?.fog,
      });
    }
  });
  return infos;
});
check('Elk silhouetgebouw heeft precies één BoxGeometry-romp',
  materiaalTest.every(i => i.rompen === 1), materiaalTest);
check('userData.skylineDak komt overeen met het daadwerkelijke aantal ShapeGeometry-daken (1 als dak, anders 0)',
  materiaalTest.every(i => (i.heeftDak ? i.daken === 1 : i.daken === 0)), materiaalTest);
check('Minstens één, maar niet alle, gebouwen hebben een puntgevel-dak (variatie, geen alles-of-niets)',
  materiaalTest.some(i => i.heeftDak) && materiaalTest.some(i => !i.heeftDak), materiaalTest);
check('Alle silhouetten gebruiken MeshBasicMaterial (geen lichtrespons — een silhouet reageert niet op scene-lichten)',
  materiaalTest.every(i => i.isBasicMaterial), materiaalTest);
check('Alle silhouetten hebben fog:false (mag niet naar scene.fog.color vervagen — zelfde afweging als T111)',
  materiaalTest.every(i => i.fog === false), materiaalTest);

// --- 3. Materiaal-hergebruik: slechts 3 gedeelde materialen (één per laag/
// kleur) voor de romp/dak-meshes, niet 27 losse materialen. Raampjes
// (Ticket 113, PlaneGeometry) hebben BEWUST elk hun eigen materiaal (zie
// test-skyline-raampjes.mjs) en tellen hier niet mee — vandaar de
// geometrie-filter.
const materiaalAantal = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const materialen = new Set();
  d.wereld.traverse((k) => {
    if (k.userData?.skyline) k.children.forEach((c) => {
      if (c.material && c.geometry.type !== 'PlaneGeometry') materialen.add(c.material);
    });
  });
  return materialen.size;
});
check('Precies 3 gedeelde silhouet-materialen (één per laag) voor romp/dak, niet 27 losse', materiaalAantal === 3, materiaalAantal);

// --- 4. Het echte risico bij dit ticket is niet "staat de laag op de
// juiste afstand tot ÉÉN vast standpunt" (de speler staat daar niet aan
// vastgeklonken), maar "kan een speler ergens in de speelbare zone een
// skyline-gebouw voorbij camera.far duwen" (zichtbaar wegklappende
// gebouwen). Getest tegen de daadwerkelijke speelbare UITHOEKEN van
// binnenplaats/gracht — niet alleen het meetstandpunt — met een
// veiligheidsmarge (BAND, zie code-toelichting bij de plaatsing).
const worstCase = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const noord = [], oost = [];
  d.wereld.traverse((k) => {
    if (!k.userData?.skyline) return;
    const info = { x: k.position.x, z: k.position.z };
    if (Math.abs(k.rotation.y) < 0.01) noord.push(info); else oost.push(info);
  });
  const binnenplaatsHoeken = [
    { x: d.DEUR2_X + 0.5, z: d.PLAATS_Z_ZUID - 0.5 }, { x: d.PLAATS_X_OOST - 0.5, z: d.PLAATS_Z_ZUID - 0.5 },
    { x: d.DEUR2_X + 0.5, z: d.PLAATS_Z_NOORD + 0.5 }, { x: d.PLAATS_X_OOST - 0.5, z: d.PLAATS_Z_NOORD + 0.5 },
  ];
  const grachtHoeken = [
    { x: d.VLONDER_X_WEST + 0.3, z: d.BIJKEUKEN_CZ - d.GRACHTGANG_HALF + 0.2 },
    { x: d.VLONDER_X_OOST - 0.3, z: d.BIJKEUKEN_CZ + d.GRACHTGANG_HALF - 0.2 },
    { x: d.VLONDER_X_WEST + 0.3, z: d.BIJKEUKEN_CZ + d.GRACHTGANG_HALF - 0.2 },
    { x: d.VLONDER_X_OOST - 0.3, z: d.BIJKEUKEN_CZ - d.GRACHTGANG_HALF + 0.2 },
  ];
  function maxAfstand(hoeken, gebouwen) {
    let max = 0;
    for (const h of hoeken) for (const g of gebouwen) max = Math.max(max, Math.hypot(h.x - g.x, h.z - g.z));
    return max;
  }
  return {
    noordMax: maxAfstand(binnenplaatsHoeken, noord),
    oostMax: maxAfstand(grachtHoeken, oost),
    camera_far: d.camera.far,
  };
});
check('Vanaf ELKE speelbare uithoek van de binnenplaats blijft ELK noordlaag-gebouw ruim (>= 4m marge) binnen camera.far',
  worstCase.noordMax <= worstCase.camera_far - 4, worstCase);
check('Vanaf ELKE speelbare uithoek van de gracht/vlonder blijft ELK oostlaag-gebouw ruim (>= 4m marge) binnen camera.far',
  worstCase.oostMax <= worstCase.camera_far - 4, worstCase);

// --- 5. Geen enkel silhouetgebouw is een obstakel of interactiepunt: puur
// decoratief, ver buiten het loopgebied (§10.2-invarianten blijven intact).
const invarianten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { obstakels: d.obstakels.length, interactiePunten: d.interactiePunten.length };
});
check('obstakels.length blijft 56 (de skyline heeft geen collision)', invarianten.obstakels === 56, invarianten);
check('interactiePunten.length blijft 14', invarianten.interactiePunten === 14, invarianten);

// --- 6. Geen enkel silhouetgebouw is een licht: puur geometrie (T113
// voegt de emissieve raampjes pas later toe, dit ticket levert alleen de
// vormen).
const lichtTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0;
  d.scene.traverse((k) => { if (k.isLight) lichten++; });
  return lichten;
});
check('Lichttelling blijft op 28 (de skyline zelf is geen lichtbron — dat is T113)', lichtTest === 28, lichtTest);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
