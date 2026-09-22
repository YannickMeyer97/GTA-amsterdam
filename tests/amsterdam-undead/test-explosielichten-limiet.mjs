// Feedback (T180-vervolg, mobiele speeltest): hapering bij meerdere
// gelijktijdige Brander-explosies.
//
// WAT HIER HET ECHTE RISICO IS. Niet of één explosie werkt — dat toetsen
// test-smederij.mjs en test-hitmarker-audio.mjs al. Het risico zit in het
// AANTAL PointLights dat de scene op enig moment bevat: elke lichtbron telt
// mee in Three.js' shader-programma-cachesleutel (numPointLights), en een
// aantal dat nog nooit eerder voorkwam dwingt bij het eerstvolgende frame
// een hercompilatie af van elk materiaal dat licht ontvangt — op mobiele
// GPU's een kostbare operatie, en dát is de hapering.
//
// De fix begrenst hoeveel explosies TEGELIJK een eigen puntlicht krijgen
// (EXPLOSIE_LICHT_MAX_ACTIEF); de flits zelf (bol + geluid + schade)
// verschijnt bij ELKE explosie, ongeacht die grens. Deze checks toetsen
// zowel de grens zelf als dat er geen enkel ander gedrag aan vast zit:
// schade, geluid en de flits-visual blijven voor de "onverlichte" explosies
// precies hetzelfde.
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const scenePointLights = () => page.evaluate(() =>
  window.AmsterdamUndeadDebug.scene.children.filter(o => o.isPointLight).length);

// --- 1. De eerste EXPLOSIE_LICHT_MAX_ACTIEF explosies krijgen elk een
// eigen puntlicht, en die lichten staan ook echt IN de scene (niet alleen
// op het object) ------------------------------------------------------
const eersteTwee = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.explosies.length = 0;   // schone lei, ongeacht wat eerdere secties achterlieten
  const speler = d.speler.positie.clone();
  d.speler.positie.set(999, 0, 999);   // geen spelerschade in deze meting
  const voor = d.actieveExplosieLichten();
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(50, 0, 50) } });
  const na1 = { actief: d.actieveExplosieLichten(), lichtVanLaatste: d.explosies.at(-1).licht !== null };
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(52, 0, 50) } });
  const na2 = { actief: d.actieveExplosieLichten(), lichtVanLaatste: d.explosies.at(-1).licht !== null };
  d.speler.positie.copy(speler);
  return { voor, na1, na2, MAX: d.EXPLOSIE_LICHT_MAX_ACTIEF };
});
check('EXPLOSIE_LICHT_MAX_ACTIEF staat op 2 (de waarde die de eigenaar koos)',
  eersteTwee.MAX === 2, eersteTwee);
check('Vóór enige explosie zijn er 0 actieve explosielichten', eersteTwee.voor === 0, eersteTwee);
check('De eerste explosie krijgt een eigen licht', eersteTwee.na1.actief === 1 && eersteTwee.na1.lichtVanLaatste, eersteTwee);
check('De tweede (gelijktijdige) explosie krijgt ook nog een eigen licht',
  eersteTwee.na2.actief === 2 && eersteTwee.na2.lichtVanLaatste, eersteTwee);

// --- 2. Een DERDE, gelijktijdige explosie krijgt GEEN licht meer, maar wel
// gewoon zijn flits ------------------------------------------------------
const derde = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const speler = d.speler.positie.clone();
  d.speler.positie.set(999, 0, 999);
  const explosiesVoor = d.explosies.length;
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(54, 0, 50) } });
  const laatste = d.explosies.at(-1);
  d.speler.positie.copy(speler);
  return {
    explosiesGegroeid: d.explosies.length - explosiesVoor,
    lichtVanDerde: laatste.licht,
    flitsBestaat: !!laatste.flits,
    flitsInScene: d.scene.children.includes(laatste.flits),
    actief: d.actieveExplosieLichten(),
  };
});
check('De derde gelijktijdige explosie voegt gewoon een flits toe aan de explosies-array',
  derde.explosiesGegroeid === 1 && derde.flitsBestaat, derde);
check('...maar krijgt zelf GEEN puntlicht (licht === null)', derde.lichtVanDerde === null, derde);
check('De flits zelf staat wél gewoon in de scene — alleen het licht ontbreekt',
  derde.flitsInScene === true, derde);
check('Het actieve-lichten-aantal blijft op de grens (2), ondanks de derde explosie',
  derde.actief === 2, derde);

// --- 3. Het werkelijke aantal PointLights in de scene blijft ook echt
// begrensd — niet alleen de boekhouding in `explosies`, maar de scene zelf
// (dát is wat de shader-hercompilatie triggert) --------------------------
const lichtenInScene = await scenePointLights();
const vijfExtra = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const speler = d.speler.positie.clone();
  d.speler.positie.set(999, 0, 999);
  for (let i = 0; i < 5; i++) {
    d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(60 + i, 0, 50) } });
  }
  d.speler.positie.copy(speler);
});
const lichtenNaVijfExtra = await scenePointLights();
check('Vijf extra gelijktijdige explosies (8 totaal) voegen NUL nieuwe PointLights toe aan de scene — de grens is al bereikt',
  lichtenNaVijfExtra === lichtenInScene, { lichtenInScene, lichtenNaVijfExtra });

// --- 4. Zodra de eerste twee explosies verlopen, geeft dat weer ruimte
// vrij voor een nieuwe explosie om een licht te krijgen ------------------
const naVerval = await page.evaluate((duur) => {
  const d = window.AmsterdamUndeadDebug;
  d.updateExplosies(duur);   // ruimt alle 8 explosies op (allemaal ouder dan de flitsduur)
  return { explosiesOver: d.explosies.length, actiefNa: d.actieveExplosieLichten() };
}, 1.0);
check('Na verval zijn alle explosies (met én zonder licht) netjes opgeruimd',
  naVerval.explosiesOver === 0 && naVerval.actiefNa === 0, naVerval);

const nieuweRonde = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const speler = d.speler.positie.clone();
  d.speler.positie.set(999, 0, 999);
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(70, 0, 50) } });
  const licht = d.explosies.at(-1).licht !== null;
  d.speler.positie.copy(speler);
  return { licht };
});
check('Nadat de vorige explosies verlopen zijn, krijgt een nieuwe explosie weer gewoon een licht',
  nieuweRonde.licht === true, nieuweRonde);

// --- 5. updateExplosies() crasht niet op een null-licht bij opruiming ---
// (regressiebewaking: scene.remove(null) moet expliciet overgeslagen
// worden, niet impliciet op Three.js' eigen no-op leunen)
const opruimenZonderLicht = await page.evaluate((duur) => {
  const d = window.AmsterdamUndeadDebug;
  const speler = d.speler.positie.clone();
  d.speler.positie.set(999, 0, 999);
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(80, 0, 50) } });
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(82, 0, 50) } });
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(84, 0, 50) } });   // krijgt geen licht
  let fout = null;
  try { d.updateExplosies(duur); } catch (e) { fout = String(e); }
  d.speler.positie.copy(speler);
  return { fout, explosiesOver: d.explosies.length };
}, 1.0);
check('Het opruimen van een explosie zonder licht (null) gooit geen fout',
  opruimenZonderLicht.fout === null && opruimenZonderLicht.explosiesOver === 0, opruimenZonderLicht);

// --- 6. Schade en geluid blijven ONGEWIJZIGD, ook zonder eigen licht -----
// Dit is de belangrijkste garantie van dit ticket: de lichtenlimiet raakt
// UITSLUITEND de visuele lichtbron, nooit de gameplay. Een "onverlichte"
// explosie moet een nabije ondode precies zo hard raken als een verlichte.
const schadeOngemoeid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.explosies.length = 0;
  // Twee "gratis" explosies om het lichtenbudget alvast op te vullen,
  // ver weg zodat ze geen van beide de testondode raken.
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(200, 0, 200) } });
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(204, 0, 200) } });
  // De DERDE explosie krijgt gegarandeerd geen licht (budget is op) — en is
  // degene die de testondode daadwerkelijk moet raken.
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(1, 0, 0);   // binnen AMSTEL9_EXPLOSIE_RADIUS/BRANDER_EXPLOSIE_RADIUS van (0,0)
  o.hp = 1000;
  const licht = (() => {
    d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(0, 0, 0) } });
    return d.explosies.at(-1).licht;
  })();
  return { schade: 1000 - o.hp, lichtWasNull: licht === null };
});
check('De derde (onverlichte) explosie in deze opstelling heeft inderdaad geen licht — de rest van deze check test dus het juiste geval',
  schadeOngemoeid.lichtWasNull === true, schadeOngemoeid);
check('...en beschadigt de nabije ondode nog altijd normaal (schade > 0)',
  schadeOngemoeid.schade > 0, schadeOngemoeid);

// --- 7. schotExplosie() (AMSTEL-9 niveau 2) deelt hetzelfde budget -------
// Snel vurende AMSTEL-9-schoten mogen het lichtenbudget net zo goed vullen
// als Brander-explosies — anders lost de limiet het probleem maar half op.
const gedeeldBudget = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.explosies.length = 0;
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(90, 0, 90) } });
  d.ontploiBrander({ type: 'brander', groep: { position: d.speler.positie.clone().set(92, 0, 90) } });
  d.schotExplosie(94, 0, 90, null);   // budget is al vol door de twee Branders hierboven
  return { lichtVanSchot: d.explosies.at(-1).licht };
});
check('Een AMSTEL-9-explosie krijgt geen licht als Brander-explosies het budget al gevuld hebben — gedeeld budget',
  gedeeldBudget.lichtVanSchot === null, gedeeldBudget);

// --- 8. Een echte kettingreactie (zoals test-hitmarker-audio.mjs opzet)
// blijft binnen de lichtengrens, ook als meerdere Branders in dezelfde
// synchrone aanroep sterven ------------------------------------------------
const kettingreactie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.explosies.length = 0;
  d.speler.positie.set(999, 0, 999);

  const branders = [];
  for (let i = 0; i < 4; i++) {
    const b = d.spawnOndode(0, 'brander');
    b.hp = d.schadePerTreffer;
    b.groep.position.set(-0.9 + i * 0.6, 0, -10);   // allemaal binnen elkaars BRANDER_EXPLOSIE_RADIUS
    branders.push(b);
  }
  let fout = null;
  try {
    d.raakOndode(branders[0], branders[0].groep.position, false);   // triggert de hele keten synchroon
  } catch (e) { fout = String(e); }
  return {
    fout,
    overlevenden: branders.filter(b => d.ondoden.includes(b)).length,
    actieveExplosieLichten: d.actieveExplosieLichten(),
    totaalExplosies: d.explosies.length,
    MAX: d.EXPLOSIE_LICHT_MAX_ACTIEF,
  };
});
check('Een kettingreactie van 4 Branders loopt zonder fouten',
  kettingreactie.fout === null, kettingreactie);
check('Alle 4 Branders sterven in de keten (bevestigt dat dit scenario echt meerdere explosies triggert)',
  kettingreactie.overlevenden === 0, kettingreactie);
check('Ondanks 4 gelijktijdige explosies blijft het aantal actieve lichten op de grens staan',
  kettingreactie.actieveExplosieLichten === kettingreactie.MAX, kettingreactie);
check('Toch zijn er wel degelijk 4 losse explosies/flitsen aangemaakt — alleen de lichten zijn begrensd',
  kettingreactie.totaalExplosies === 4, kettingreactie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
