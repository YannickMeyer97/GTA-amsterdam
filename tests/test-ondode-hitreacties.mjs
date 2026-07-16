// Hitreacties (Ticket 21, Z4): flinch-state + knockback bij een overlevende
// treffer, Brander-kern-puls, en de garantie dat er nooit een flinch komt op
// een dodelijke/Eliminatiemodus-hit. raakOndode() is het drukste
// risicogebied (schade/geld/drops/buffs) — deze test controleert dat de
// bestaande volgorde/logica daar ongewijzigd blijft.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// Neutrale traits (geen kromme rug/scheve nek): isoleert de flinch-rotatie
// van de willekeurige rust-houding, anders is de "terug naar rust"-check
// flaky (kiesOndodeTraits() loot 35% kans op kromme, wat de hoofd-rustRotX
// verschuift).
const NEUTRALE_TRAITS_STR =
  "{ profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false }";

// --- 1. Flinch-state vóór/tijdens/na een niet-dodelijke headshot ---------
const flinchKop = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 1;
  d.eliminatiemodusTimer = 0;
  const o = d.spawnOndode(0, 'normaal', eval(`(${traitsStr})`));
  o.hp = 1000;   // blijft leven na de treffer
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const voor = o.flinch;
  d.raakOndode(o, o.groep.position, true);   // headshot
  const directNaHit = { flinch: o.flinch !== null, timer: o.flinch.timer, soort: o.flinch.soort };
  // De visuele toepassing gebeurt pas in updateOndoden() (animatie-helft) —
  // één tick is genoeg om de flinch-rotatie zichtbaar te maken.
  d.updateOndoden(0.02);
  const directNa = { ...directNaHit, hoofdX: o.delen.hoofd.rotation.x };
  // Genoeg ticks om ruim over FLINCH_DUUR heen te komen (< 0.3s hersteltijd, criterium).
  let tikken = 0;
  const t0 = performance.now();
  while (o.flinch !== null && tikken < 20) { d.updateOndoden(0.05); tikken++; }
  const hersteldBinnen = (performance.now() - t0) >= 0 && tikken * 0.05 < 0.3;
  const uit = { voor, directNa, hersteld: o.flinch === null, hersteldBinnen, hoofdXNa: o.delen.hoofd.rotation.x };
  d.doodOndode(o);
  return uit;
}, NEUTRALE_TRAITS_STR);
check('Vóór de treffer heeft de ondode geen flinch', flinchKop.voor === null, flinchKop);
check('Direct na een headshot: flinch.soort = "kop", timer = FLINCH_DUUR',
  flinchKop.directNa.flinch === true && flinchKop.directNa.soort === 'kop', flinchKop.directNa);
check('Headshot laat het hoofd tijdelijk afwijken van de rust-hoek',
  flinchKop.directNa.hoofdX !== 0, flinchKop.directNa);
check('Flinch herstelt (wordt null) binnen < 0.3s aan updateOndoden-ticks',
  flinchKop.hersteld && flinchKop.hersteldBinnen, flinchKop);
check('Na herstel staat het hoofd weer terug op (ongeveer) de rust-microkantel',
  Math.abs(flinchKop.hoofdXNa) < 0.05, flinchKop);

// --- 2. Lichaamstreffer geeft een romp-twist die ook weer verdwijnt ------
const flinchLichaam = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  d.raakOndode(o, o.groep.position, false);   // lichaamstreffer
  const soort = o.flinch.soort;
  d.updateOndoden(0.02);   // visuele toepassing gebeurt pas in updateOndoden()
  const directNa = { soort, rompY: o.delen.romp.rotation.y };
  let tikken = 0;
  while (o.flinch !== null && tikken < 20) { d.updateOndoden(0.05); tikken++; }
  const uit = { directNa, rompYNa: o.delen.romp.rotation.y };
  d.doodOndode(o);
  return uit;
});
check('Lichaamstreffer geeft flinch.soort = "lichaam" met een romp-twist (rotation.y != 0)',
  flinchLichaam.directNa.soort === 'lichaam' && flinchLichaam.directNa.rompY !== 0, flinchLichaam);
check('Romp-twist verdwijnt weer na herstel (rotation.y terug naar 0)',
  flinchLichaam.rompYNa === 0, flinchLichaam);

// --- 3. Knockback-afstand: totale verplaatsing over de volledige flinch-duur
// blijft binnen de 0.15m-ceiling uit de acceptatiecriteria --------------
const knockback = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  o.snelheid = 0;   // navigatie uitschakelen: alleen de knockback-verplaatsing meten
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const voor = o.groep.position.clone();
  d.raakOndode(o, o.groep.position, false);
  let tikken = 0;
  while (o.flinch !== null && tikken < 20) { d.updateOndoden(0.05); tikken++; }
  const afstand = o.groep.position.distanceTo(voor);
  d.doodOndode(o);
  return { afstand };
});
check('Knockback verplaatst de ondode, maximaal 0.15 m (acceptatiecriterium)',
  knockback.afstand > 0 && knockback.afstand <= 0.15, knockback);

// --- 4. Muurtest: de knockback duwt nooit door een muur -------------------
// Isolatie: ver van echte kaartgeometrie (x=500,z=-500), zodat alleen de
// synthetische muur meetelt. De ondode start LEGAAL vrij van de muur (0.45m
// > ONDODE_STRAAL 0.4m), maar de volledige knockback (max 0.12m) zou 'm tot
// op 0.33m van de muur duwen — minder dan de vereiste 0.4m-klaring. De
// bestaande losBotsingenOp() moet dat afkappen, ruim vóór de muur.
// Twee dingen moeten voor deze isolatie tijdelijk opzij: (a) losBotsingenOp()
// klemt ook op de kaart-GRENS (bestaand, ongewijzigd gedrag) — (500,-500) valt
// daarbuiten, dus GRENS tijdelijk verruimen; (b) Ticket 30's aanvals-state-
// machine zou de ondode (0.1m van de "speler") een wind-up laten starten,
// wat de navigatie/flinch-code een aantal ticks lang overslaat — een torenhoge
// aanvalVertraging voorkomt dat en houdt de ondode in 'jaag', precies zoals
// vóór Ticket 30.
const muurtest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  o.snelheid = 0;   // navigatie uitschakelen: alleen de knockback-verplaatsing meten
  o.aanvalVertraging = 999;   // nooit een wind-up starten tijdens deze test
  o.groep.position.set(500, 0, -500);
  d.speler.positie.set(500, 0, -500.1);   // speler net zuidelijk: knockback duwt naar +z
  d.obstakels.push({ minX: 499, maxX: 501, minZ: -499.55, maxZ: -498 });
  const grensVoor = { ...d.GRENS };
  Object.assign(d.GRENS, { minX: -600, maxX: 600, minZ: -600, maxZ: 600 });
  d.raakOndode(o, o.groep.position, false);
  let tikken = 0;
  while (o.flinch !== null && tikken < 20) { d.updateOndoden(0.05); tikken++; }
  const eindZ = o.groep.position.z;
  Object.assign(d.GRENS, grensVoor);
  d.obstakels.pop();
  d.doodOndode(o);
  return { eindZ, klaring: -499.55 - eindZ };
});
check('Knockback tegen een muur: de ondode behoudt de volledige botsingsklaring (>= 0.4m, nooit door de muur)',
  muurtest.klaring >= 0.4 - 1e-6, muurtest);
check('De muur kapt de knockback ook daadwerkelijk af (minder dan de volle 0.12m vrije verplaatsing)',
  muurtest.eindZ < -499.88, muurtest);

// --- 5. Brander: kern-puls bij een treffer, dooft weer uit ----------------
const kernPuls = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  const o = d.spawnOndode(0, 'brander');
  o.hp = 1000;
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const schaalVoor = o.delen.kern.scale.x;
  d.raakOndode(o, o.groep.position, false);
  d.updateOndoden(0.02);   // visuele toepassing gebeurt pas in updateOndoden()
  const schaalDirectNa = o.delen.kern.scale.x;
  let tikken = 0;
  while (o.flinch !== null && tikken < 20) { d.updateOndoden(0.05); tikken++; }
  const uit = { schaalVoor, schaalDirectNa, schaalNa: o.delen.kern.scale.x };
  d.doodOndode(o);
  return uit;
});
check('Brander-kern zwelt op bij een treffer', kernPuls.schaalDirectNa > kernPuls.schaalVoor, kernPuls);
check('Brander-kern keert terug naar schaal 1 na herstel', kernPuls.schaalNa === 1, kernPuls);

// --- 6. Geen flinch op een dodelijke treffer (ook niet tijdens Eliminatiemodus) -
const geenFlinchOpDood = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 1;
  d.eliminatiemodusTimer = 0;
  const oNormaal = d.spawnOndode(0, 'normaal');   // 1 hp op golf 1: sterft op de eerste treffer
  oNormaal.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const overleeftNiet = oNormaal.hp;
  d.raakOndode(oNormaal, oNormaal.groep.position, true);   // headshot: dodelijk
  const nogInLeven1 = d.ondoden.includes(oNormaal);

  const oElim = d.spawnOndode(1, 'sjouwer');   // veel HP, maar Eliminatiemodus is altijd dodelijk
  oElim.groep.position.set(5, 0, -10);
  d.geefEliminatiemodus();
  d.raakOndode(oElim, oElim.groep.position, false);
  const nogInLeven2 = d.ondoden.includes(oElim);
  d.eliminatiemodusTimer = 0;
  return { overleeftNiet, nogInLeven1, nogInLeven2 };
});
check('Een dodelijke treffer verwijdert de ondode meteen (geen kans op een hangende flinch)',
  geenFlinchOpDood.nogInLeven1 === false, geenFlinchOpDood);
check('Een Eliminatiemodus-kill verwijdert de ondode ook meteen (geen flinch mogelijk)',
  geenFlinchOpDood.nogInLeven2 === false, geenFlinchOpDood);

// --- 7. Ticket 30: aanvalStaat-onderbreking + pathing tijdens een flinch --
// Een treffer op een ondode die nog niet aan het aanvallen was (aanvalStaat
// 'jaag') mag diens staat niet aanraken; pathing blijft gewoon doorlopen.
const meleeEnPathing = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  const o = d.spawnOndode(0, 'normaal');
  o.hp = 1000;
  o.groep.position.set(0, 0, -10);
  d.speler.positie.set(0, 0, 0);
  const aanvalStaatVoor = o.aanvalStaat;
  d.raakOndode(o, o.groep.position, false);
  const aanvalStaatNaTreffer = o.aanvalStaat;
  const zVoor = o.groep.position.z;
  for (let i = 0; i < 10; i++) d.updateOndoden(0.05);
  const zNa = o.groep.position.z;
  const uit = { aanvalStaatVoor, aanvalStaatNaTreffer, dichterbij: zNa > zVoor };
  d.doodOndode(o);
  return uit;
});
check('Een treffer op een jagende (niet-aanvallende) ondode raakt aanvalStaat niet aan',
  meleeEnPathing.aanvalStaatVoor === 'jaag' && meleeEnPathing.aanvalStaatNaTreffer === 'jaag', meleeEnPathing);
check('De ondode loopt tijdens een flinch gewoon door richting de speler (pathing ongewijzigd)',
  meleeEnPathing.dichterbij, meleeEnPathing);

// --- 7b. Onderbrekingsregels: headshot breekt een wind-up altijd af; een
// lichaamstreffer alleen bij onderbreekbaarLichaam-types (Loper/Sluiper) ---
const onderbreking = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  function windupOndode(type) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    const o = d.spawnOndode(0, type);
    o.hp = 1000;
    o.groep.position.set(0, 0, -10);
    d.speler.positie.set(0, 0, 0);
    o.aanvalStaat = 'windup';
    o.aanvalTimer = 5;
    return o;
  }
  const uit = {};

  // Sjouwer (onderbreekbaarLichaam: false): lichaamstreffer breekt NIET af.
  const sjouwer = windupOndode('sjouwer');
  d.raakOndode(sjouwer, sjouwer.groep.position, false);
  uit.sjouwerLichaam = sjouwer.aanvalStaat;
  d.doodOndode(sjouwer);

  // Sjouwer + headshot: breekt WEL altijd af.
  const sjouwer2 = windupOndode('sjouwer');
  d.raakOndode(sjouwer2, sjouwer2.groep.position, true);
  uit.sjouwerKop = sjouwer2.aanvalStaat;
  uit.sjouwerKopTimer = sjouwer2.aanvalTimer;
  uit.sjouwerKopHerstelVerwacht = d.AANVAL_PROFIELEN.sjouwer.herstel * 0.5;
  d.doodOndode(sjouwer2);

  // Loper (onderbreekbaarLichaam: true): lichaamstreffer breekt WEL af.
  const loper = windupOndode('loper');
  d.raakOndode(loper, loper.groep.position, false);
  uit.loperLichaam = loper.aanvalStaat;
  d.doodOndode(loper);

  return uit;
});
check('Sjouwer-windup: een lichaamstreffer onderbreekt NIET (onderbreekbaarLichaam: false)',
  onderbreking.sjouwerLichaam === 'windup', onderbreking);
check('Sjouwer-windup: een headshot onderbreekt ALTIJD (staat -> herstel, halve hersteltijd)',
  onderbreking.sjouwerKop === 'herstel' &&
  Math.abs(onderbreking.sjouwerKopTimer - onderbreking.sjouwerKopHerstelVerwacht) < 1e-9, onderbreking);
check('Loper-windup: een lichaamstreffer onderbreekt WEL (onderbreekbaarLichaam: true)',
  onderbreking.loperLichaam === 'herstel', onderbreking);

// --- 7c. Dood tijdens een wind-up laat het aanvalsslot niet lekken --------
// Een ECHTE jaag->windup-overgang (via updateOndoden) zodat actieveAanvallers
// daadwerkelijk verhoogd wordt, dan een dodelijke treffer tijdens de wind-up.
const slotVrijgave = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelStaat.golf = 1;   // 1 hp: sterft op de eerste treffer
  const voorAlleTests = d.actieveAanvallers;
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0.5, 0, 0);   // binnen AANVAL_START_BEREIK van de speler
  d.speler.positie.set(0, 0, 0);
  o.aanvalVertraging = 0;   // start de wind-up meteen, geen jitter-wachttijd
  d.updateOndoden(0.02);
  const staatVoorDood = o.aanvalStaat;
  const aanvallersVoorDood = d.actieveAanvallers;
  d.raakOndode(o, o.groep.position, true);   // headshot: dodelijk (1 hp op golf 1)
  const aanvallersNaDood = d.actieveAanvallers;
  return { voorAlleTests, staatVoorDood, aanvallersVoorDood, aanvallersNaDood };
});
check('De testondode start daadwerkelijk een wind-up (echte jaag->windup-overgang)',
  slotVrijgave.staatVoorDood === 'windup' && slotVrijgave.aanvallersVoorDood === slotVrijgave.voorAlleTests + 1,
  slotVrijgave);
check('Een dodelijke treffer tijdens de wind-up geeft het aanvalsslot vrij (actieveAanvallers daalt weer)',
  slotVrijgave.aanvallersNaDood === slotVrijgave.voorAlleTests, slotVrijgave);

// --- 8. Regressie: power-up-drops uit dezelfde functie blijven werken ----
const dropsRegressie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  for (const p of [...d.powerups]) d.raapPowerupOp(p);
  d.spelStaat.golf = 1;
  let drops = 0;
  for (let i = 0; i < 60; i++) {
    d.laatstePowerupDropGolf = -Infinity;
    d.laatsteKerninslagGolf = -Infinity;
    const voor = d.powerups.length;
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set(999, 0, 999);
    d.raakOndode(o, o.groep.position, false);   // 1 hp -> dood op golf 1
    if (d.powerups.length > voor) drops++;
  }
  for (const p of [...d.powerups]) d.raapPowerupOp(p);
  return { drops };
});
check('Power-up-drops uit raakOndode() blijven werken na de flinch-toevoeging (>= 1 drop over 60 kills)',
  dropsRegressie.drops >= 1, dropsRegressie);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
