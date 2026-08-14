// Ticket 93 (v0.22, §10.13-beslissing 88): fog-profiel per zone. Binnen
// blijft benauwd (FOG_NORMAAL, 6/24), buiten (de Binnenplaats, zone 3)
// opent naar ~40m (FOG_BUITEN). Zachte overgang op een echte binnen/buiten-
// grensovergang (ZONE_FOG_OVERGANG_DUUR, 2s), zelfde sjabloon als
// mistUitfaseTimer. Een actieve Mistgolf blijft leidend (FOG_MIST,
// ongewijzigd) tot hij eindigt; daarna keert de fog terug naar het profiel
// van de HUIDIGE zone, niet naar een vaste FOG_NORMAAL.
import { openAmsterdamUndead, makeChecker, frames } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ simuleerPointerLock: true });
const { check, report } = makeChecker();

// --- 1. Structuur: de twee profielen + de zone-classificatie -------------
const structuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    FOG_NORMAAL: { ...d.FOG_NORMAAL },
    FOG_BUITEN: { ...d.FOG_BUITEN },
    ZONE_BUITEN: d.ZONE_BUITEN,
  };
});
check('FOG_NORMAAL blijft ongewijzigd (6/24, niet aangeraakt door dit ticket)',
  structuur.FOG_NORMAAL.near === 6 && structuur.FOG_NORMAAL.far === 24, structuur);
check('FOG_BUITEN opent naar ~40m (far), zelfde kleur/near als binnen',
  structuur.FOG_BUITEN.far === 40 && structuur.FOG_BUITEN.near === structuur.FOG_NORMAAL.near &&
  structuur.FOG_BUITEN.kleur === structuur.FOG_NORMAAL.kleur, structuur);
check('ZONE_BUITEN: alleen index 3 (Binnenplaats) is buiten',
  JSON.stringify(structuur.ZONE_BUITEN) === JSON.stringify([false, false, false, true, false]), structuur);

// --- 2. Elke zone komt (na de overgang) uit op het juiste profiel --------
async function zetPositieEnWacht(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const d = window.AmsterdamUndeadDebug;
    d.speler.positie.set(x, 0, z);
    d.updateSpeler(0);
  }, { x, z });
  // Ruim voorbij ZONE_FOG_OVERGANG_DUUR (2s) @ 60fps.
  await frames(page, 150);
}

const zones = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    woonkamer: [0, d.DEUR_Z + 2],
    gang: [0, (d.DEUR_Z + d.GANG_Z_EIND) / 2],
    atelier: [0, d.GANG_Z_EIND - 2],
    binnenplaats: [d.DEUR2_X + 2, d.PLAATS_Z_ZUID - 2],
    bijkeuken: [d.DEUR2_X + 2, d.PLAATS_Z_ZUID + 2],
  };
});

for (const [naam, [x, z]] of Object.entries(zones)) {
  await zetPositieEnWacht(page, x, z);
  const staat = await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    return {
      zoneNu: d.zoneVan(d.speler.positie.x, d.speler.positie.z),
      near: d.scene.fog.near, far: d.scene.fog.far, kleur: d.scene.fog.color.getHex(),
      timer: d.zoneFogTimer,
    };
  });
  const verwachtBuiten = naam === 'binnenplaats';
  const verwachtProfiel = verwachtBuiten
    ? { near: structuur.FOG_BUITEN.near, far: structuur.FOG_BUITEN.far, kleur: structuur.FOG_BUITEN.kleur }
    : { near: structuur.FOG_NORMAAL.near, far: structuur.FOG_NORMAAL.far, kleur: structuur.FOG_NORMAAL.kleur };
  check(`Zone "${naam}" komt na de overgang uit op het ${verwachtBuiten ? 'buiten' : 'binnen'}-profiel`,
    Math.abs(staat.near - verwachtProfiel.near) < 1e-6 && Math.abs(staat.far - verwachtProfiel.far) < 1e-6 &&
    staat.kleur === verwachtProfiel.kleur, { naam, staat, verwachtProfiel });
  check(`Zone "${naam}": de overgang is voltooid (zoneFogTimer terug op 0)`,
    staat.timer === 0, staat);
}

// --- 3. Zachte overgang: middenin niet al op de eindwaarde ----------------
const overgang = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  // Begin binnen (woonkamer), dan naar buiten (binnenplaats) stappen.
  d.speler.positie.set(0, 0, d.DEUR_Z + 2);
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  const voorFar = d.scene.fog.far;
  d.speler.positie.set(d.DEUR2_X + 2, 0, d.PLAATS_Z_ZUID - 2);
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));   // 1 frame: net getriggerd
  const netNaTrigger = { far: d.scene.fog.far, timer: d.zoneFogTimer };
  // Nog een handvol frames, ruim vóór ZONE_FOG_OVERGANG_DUUR (2s) verstreken is.
  for (let i = 0; i < 10; i++) await new Promise(res => requestAnimationFrame(res));
  const middenin = { far: d.scene.fog.far, timer: d.zoneFogTimer };
  return { voorFar, netNaTrigger, middenin, FOG_BUITEN_far: d.FOG_BUITEN.far };
});
check('Direct na het oversteken is de overgang getriggerd (zoneFogTimer > 0)',
  overgang.netNaTrigger.timer > 0, overgang);
check('Middenin de overgang zit far tussen binnen (24) en buiten (40) in — geen instant-snap',
  overgang.middenin.far > 24 && overgang.middenin.far < 40, overgang);
check('Middenin de overgang loopt de timer nog steeds af (nog niet klaar)',
  overgang.middenin.timer > 0, overgang);

// --- 4. Twee binnenzones na elkaar triggeren GEEN overgang -----------------
const geenOverbodigeOvergang = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(0, 0, d.DEUR_Z + 2);   // woonkamer
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  d.zoneFogTimer = 0;   // eventuele restanten van eerdere secties wegvegen
  d.speler.positie.set(0, 0, (d.DEUR_Z + d.GANG_Z_EIND) / 2);   // gang — ook binnen
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  return { timer: d.zoneFogTimer, zoneNu: d.zoneVan(d.speler.positie.x, d.speler.positie.z) };
});
check('Woonkamer -> Gang (beide binnen): geen fog-overgang getriggerd (zoneFogTimer blijft 0)',
  geenOverbodigeOvergang.timer === 0 && geenOverbodigeOvergang.zoneNu === 1, geenOverbodigeOvergang);

// --- 5. Mistgolf blijft leidend, ongeacht zone; wint van een lopende
// zone-overgang; en de terugkeer gaat naar de HUIDIGE zone --------------
const mistSamenspel = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  // Buiten starten (Binnenplaats), Mistgolf starten: FOG_MIST moet exact
  // gelden, ongeacht dat we buiten staan.
  d.speler.positie.set(d.DEUR2_X + 2, 0, d.PLAATS_Z_ZUID - 2);
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  d.startEventGolf('mist');
  const tijdensMist = { near: d.scene.fog.near, far: d.scene.fog.far, kleur: d.scene.fog.color.getHex(), zoneFogTimer: d.zoneFogTimer };

  // Terwijl de mist actief is: naar binnen lopen (woonkamer) — de fog moet
  // FOG_MIST blijven, geen zone-overgang mag hierdoor triggeren.
  d.speler.positie.set(0, 0, d.DEUR_Z + 2);
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  const tijdensMistBinnen = { near: d.scene.fog.near, far: d.scene.fog.far, zoneFogTimer: d.zoneFogTimer };

  // Mist eindigen (direct, voor een deterministische test): moet teruggaan
  // naar FOG_NORMAAL, want de speler staat NU binnen (woonkamer) — niet naar
  // FOG_BUITEN (waar de mist ooit begon).
  d.eindigEventGolf(true);
  const naMistBinnen = { near: d.scene.fog.near, far: d.scene.fog.far };

  return { tijdensMist, tijdensMistBinnen, naMistBinnen, FOG_MIST: { ...d.FOG_MIST }, FOG_NORMAAL: { ...d.FOG_NORMAAL } };
});
check('Tijdens een Mistgolf (buiten gestart): fog is exact FOG_MIST',
  mistSamenspel.tijdensMist.near === mistSamenspel.FOG_MIST.near &&
  mistSamenspel.tijdensMist.far === mistSamenspel.FOG_MIST.far &&
  mistSamenspel.tijdensMist.kleur === mistSamenspel.FOG_MIST.kleur, mistSamenspel);
check('Tijdens diezelfde Mistgolf, ook al is de speler naar binnen gelopen: fog blijft FOG_MIST (geen zone-overgang triggert)',
  mistSamenspel.tijdensMistBinnen.near === mistSamenspel.FOG_MIST.near &&
  mistSamenspel.tijdensMistBinnen.far === mistSamenspel.FOG_MIST.far &&
  mistSamenspel.tijdensMistBinnen.zoneFogTimer === 0, mistSamenspel);
check('Na het einde van de Mistgolf (speler nu binnen): fog keert terug naar FOG_NORMAAL, niet naar het buiten-profiel van waar de mist begon',
  mistSamenspel.naMistBinnen.near === mistSamenspel.FOG_NORMAAL.near &&
  mistSamenspel.naMistBinnen.far === mistSamenspel.FOG_NORMAAL.far, mistSamenspel);

// --- 6. Zelfde, maar dan eindigend TERWIJL de speler nog buiten staat ----
const mistEindigtBuiten = await page.evaluate(async () => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.positie.set(d.DEUR2_X + 2, 0, d.PLAATS_Z_ZUID - 2);   // binnenplaats
  d.updateSpeler(0);
  await new Promise(res => requestAnimationFrame(res));
  d.startEventGolf('mist');
  d.eindigEventGolf(true);   // direct, speler staat nog steeds buiten
  return { near: d.scene.fog.near, far: d.scene.fog.far, FOG_BUITEN: { ...d.FOG_BUITEN } };
});
check('Mistgolf eindigt terwijl de speler buiten staat: fog keert terug naar FOG_BUITEN (far 40), niet naar FOG_NORMAAL',
  mistEindigtBuiten.near === mistEindigtBuiten.FOG_BUITEN.near &&
  mistEindigtBuiten.far === mistEindigtBuiten.FOG_BUITEN.far, mistEindigtBuiten);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
