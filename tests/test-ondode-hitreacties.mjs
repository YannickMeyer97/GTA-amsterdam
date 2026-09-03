// Hitreacties (Ticket 21, Z4): flinch-state + knockback bij een overlevende
// treffer, Brander-kern-puls, en de garantie dat er nooit een flinch komt op
// een dodelijke/Eliminatiemodus-hit. raakOndode() is het drukste
// risicogebied (schade/geld/drops/buffs) — deze test controleert dat de
// bestaande volgorde/logica daar ongewijzigd blijft.
import { openAmsterdamUndead, makeChecker, geefSpelerVuurwapen } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();
// Ticket 134 (§12.8): dit bestand gebruikt d.schiet() als middel om schade
// toe te brengen — eerst een geladen vuurwapen toekennen.
await geefSpelerVuurwapen(page);

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

// --- 2b. Ticket 149: kop- vs lichaamsflinch sterker onderscheiden — andere
// curves op dezelfde fractie (sqrt voor kop, kwadraat voor lichaam) + een
// extra "ineenkrimpen" (position.y-dip) alleen bij een lichaamstreffer.
// snelheid=0 + loopFase=0 sluiten de gewone loop-idle-writes (hoofd-
// microkantel, romp-bob) uit — anders vervuilt hun eigen bijdrage (via de
// afstandsgekoppelde loopFase, Ticket 148) de exacte-formule-checks hieronder
// met een onvoorspelbare, niet-nul term. -------------------------------------
const flinchCurves = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.eliminatiemodusTimer = 0;
  d.speler.positie.set(0, 0, 0);
  const traits = eval(`(${traitsStr})`);

  // Kop vs. een ongeraakte controle-ondode, identiek opgezet: bewijst dat een
  // headshot romp.position.y niet aanraakt.
  const controle = d.spawnOndode(0, 'normaal', traits);
  controle.hp = 1000; controle.snelheid = 0; controle.loopFase = 0;
  controle.groep.position.set(0, 0, -10);
  const kop = d.spawnOndode(0, 'normaal', traits);
  kop.hp = 1000; kop.snelheid = 0; kop.loopFase = 0;
  kop.groep.position.set(0, 0, -10);
  d.raakOndode(kop, kop.groep.position, true);
  d.updateOndoden(0.001);
  // fractie wordt in de echte code gelezen NA de timer-decrement van deze
  // tick (ondode.flinch.timer -= dt vóór de write) — dus ook hier PAS na de
  // updateOndoden()-aanroep aflezen, anders klopt de verwachte waarde niet.
  const fractieKop = kop.flinch.timer / d.FLINCH_DUUR;
  const hoofdXNa = kop.delen.hoofd.rotation.x;
  const hoofdBaseX = kop.delen.hoofd.userData.baseRotX;
  const rompYControle = controle.delen.romp.position.y;
  const rompYKop = kop.delen.romp.position.y;
  d.doodOndode(controle);
  d.doodOndode(kop);

  const lichaam = d.spawnOndode(1, 'normaal', traits);
  lichaam.hp = 1000; lichaam.snelheid = 0; lichaam.loopFase = 0;
  lichaam.groep.position.set(0, 0, -10);   // zelfde bekende-vrije plek als kop/controle hierboven
  d.raakOndode(lichaam, lichaam.groep.position, false);
  d.updateOndoden(0.001);
  const fractieLichaam = lichaam.flinch.timer / d.FLINCH_DUUR;
  const rompRotYNa = lichaam.delen.romp.rotation.y;
  const dipWerkelijk = lichaam.delen.romp.userData.baseY - lichaam.delen.romp.position.y;   // loopFase=0 -> geen bob, dus dit IS de flinch-dip
  d.doodOndode(lichaam);

  return {
    fractieKop, hoofdXNa, hoofdBaseX,
    verwachtHoofdX: hoofdBaseX - d.FLINCH_HOOFD_HOEK * Math.sqrt(fractieKop),
    rompYControle, rompYKop,
    fractieLichaam, rompRotYNa,
    verwachtRompRotY: d.FLINCH_ROMP_TWIST * fractieLichaam,
    verwachtDip: d.FLINCH_LICHAAM_DIP * fractieLichaam,
    dipWerkelijk,
  };
}, NEUTRALE_TRAITS_STR);
check('Headshot-rotatie matcht exact FLINCH_HOOFD_HOEK * sqrt(fractie) (langzamer herstel dan lineair — "duizelig" nagalmen)',
  Math.abs(flinchCurves.hoofdXNa - flinchCurves.verwachtHoofdX) < 1e-9, flinchCurves);
check('Een headshot raakt romp.position.y NIET aan (identiek aan een niet-geraakte controle-ondode op dezelfde tick)',
  Math.abs(flinchCurves.rompYKop - flinchCurves.rompYControle) < 1e-9, flinchCurves);
// Speeltoets-bijstelling (na T149): dit was `fractie²`. Die curve doofde de
// romp-twist zó snel uit dat lichaams-/armtreffers niet meer aanvoelden (de
// speeltest meldde precies dat) — terug naar lineair. Het onderscheid met een
// kopschot zit nu in de KOP-curve (sqrt, blijft juist lang hangen) plus de
// dip hieronder, niet in een verzwakte lichaamsreactie.
check('Lichaamstreffer-twist matcht exact FLINCH_ROMP_TWIST * fractie (lineair uitdovend, zichtbaar over de hele flinch)',
  Math.abs(flinchCurves.rompRotYNa - flinchCurves.verwachtRompRotY) < 1e-9, flinchCurves);
check('Lichaamstreffer geeft ook een zichtbaar ineenkrimpen (romp.position.y lager dan de kale bob-basis, matcht FLINCH_LICHAAM_DIP * fractie)',
  Math.abs(flinchCurves.dipWerkelijk - flinchCurves.verwachtDip) < 1e-9, flinchCurves);
// Echte meting halverwege de flinch (niet vlak na de treffer, waar sqrt en
// lineair allebei ~1 zijn): de kop moet dan naar verhouding duidelijk verder
// doorhangen dan het lichaam. Dat is wat kop- en lichaamstreffers zonder HUD
// van elkaar onderscheidbaar maakt.
const flinchOnderscheid = await page.evaluate((traitsStr) => {
  const d = window.AmsterdamUndeadDebug;
  const traits = eval(`(${traitsStr})`);
  function meetHalverwege(kop) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    d.eliminatiemodusTimer = 0;
    d.speler.positie.set(0, 0, 0);
    const o = d.spawnOndode(0, 'normaal', traits);
    o.hp = 1000; o.snelheid = 0; o.loopFase = 0;
    o.groep.position.set(0, 0, -10);
    d.raakOndode(o, o.groep.position, kop);
    d.updateOndoden(d.FLINCH_DUUR / 2);   // exact halverwege
    const fractie = o.flinch.timer / d.FLINCH_DUUR;
    const genormaliseerd = kop
      ? Math.abs(o.delen.hoofd.rotation.x - o.delen.hoofd.userData.baseRotX) / d.FLINCH_HOOFD_HOEK
      : Math.abs(o.delen.romp.rotation.y) / d.FLINCH_ROMP_TWIST;
    d.doodOndode(o);
    return { fractie: +fractie.toFixed(3), genormaliseerd: +genormaliseerd.toFixed(3) };
  }
  return { kop: meetHalverwege(true), lichaam: meetHalverwege(false) };
}, NEUTRALE_TRAITS_STR);
check('Halverwege de flinch hangt een KOPtreffer naar verhouding duidelijk verder door dan een lichaamstreffer (sqrt- vs lineaire curve)',
  flinchOnderscheid.kop.genormaliseerd > flinchOnderscheid.lichaam.genormaliseerd + 0.15, flinchOnderscheid);

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
// Speeltoets-bijstelling (na T149): het plafond stond op 0,15m, een bewuste
// rem uit T21 toen de flinch nieuw was. De speeltest ("ik merk niet echt iets
// als ik op een arm of op het lichaam schiet") liet zien dat die rem te strak
// stond — de terugstoot is de enige trefferfeedback die óók op afstand
// zichtbaar is. KNOCKBACK_AFSTAND is daarom naar 0,22m gebracht; het plafond
// hier is mee opgehoogd naar 0,25m. Dit blijft een ECHT plafond: de
// muurklaringstest hieronder bewaakt onveranderd dat losBotsingenOp() de
// knockback nog steeds afkapt, dus een ondode wordt nooit door geometrie geduwd.
check('Knockback verplaatst de ondode, maximaal 0.25 m (bijgesteld plafond, zie toelichting)',
  knockback.afstand > 0 && knockback.afstand <= 0.25, knockback);

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
  // Ticket 156: op de tick waarop flinch.timer voor het eerst <=0 wordt, is
  // deze zelfde tick de EERSTE die geen bonus meer toevoegt — maar de
  // kern-schrijfplek in updateOndoden() leest ondode.flinch.timer VÓÓR de
  // decrement van diezelfde tick (zie de toelichting bij die schrijfplek),
  // dus die allerlaatste actieve tick draagt nog een klein residueel stukje
  // flinch-bonus (tot dt/FLINCH_DUUR * KERNPULS_SCHAAL_BONUS ≈ 0,15) bovenop
  // de rustpuls. Eén tick extra ná de while-loop leest een moment waarop
  // flinch al gegarandeerd de volle tick null was — pas dán is het zuiver
  // de rustpuls-band.
  d.updateOndoden(0.05);
  const uit = { schaalVoor, schaalDirectNa, schaalNa: o.delen.kern.scale.x, rustAmplitude: d.KERNPULS_RUST_AMPLITUDE };
  d.doodOndode(o);
  return uit;
});
check('Brander-kern zwelt op bij een treffer', kernPuls.schaalDirectNa > kernPuls.schaalVoor, kernPuls);
// Ticket 156 (v0.26): vóór dit ticket viel de kern na de flinch terug op
// EXACT 1 (er was toen geen ander proces dat delen.kern.scale schreef). Sinds
// T156 draait er een permanente rustpuls die nooit stilstaat — de kern komt
// dus niet meer op precies 1 tot rust, maar keert wel duidelijk terug binnen
// de rustpuls-band (1 ± KERNPULS_RUST_AMPLITUDE), ver onder de flinch-piek.
check('Brander-kern keert terug binnen de rustpuls-band na herstel (niet meer exact 1 sinds T156 se permanente puls)',
  Math.abs(kernPuls.schaalNa - 1) <= kernPuls.rustAmplitude + 1e-6
  && kernPuls.schaalNa < kernPuls.schaalDirectNa, kernPuls);

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
// lichaamstreffer alleen bij onderbreekbaarLichaam-types (Sluiper) --------
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

  // Sluiper (onderbreekbaarLichaam: true): lichaamstreffer breekt WEL af.
  const sluiper = windupOndode('sluiper');
  d.raakOndode(sluiper, sluiper.groep.position, false);
  uit.sluiperLichaam = sluiper.aanvalStaat;
  d.doodOndode(sluiper);

  return uit;
});
check('Sjouwer-windup: een lichaamstreffer onderbreekt NIET (onderbreekbaarLichaam: false)',
  onderbreking.sjouwerLichaam === 'windup', onderbreking);
check('Sjouwer-windup: een headshot onderbreekt ALTIJD (staat -> herstel, halve hersteltijd)',
  onderbreking.sjouwerKop === 'herstel' &&
  Math.abs(onderbreking.sjouwerKopTimer - onderbreking.sjouwerKopHerstelVerwacht) < 1e-9, onderbreking);
check('Sluiper-windup: een lichaamstreffer onderbreekt WEL (onderbreekbaarLichaam: true)',
  onderbreking.sluiperLichaam === 'herstel', onderbreking);

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

// --- Ticket 120 (Zombie V2 fase 3): onzichtbare hitbox-proxies + schiet()
// op V2 — een test-matrix over bewegingsstaten (rust, midden-loopcyclus,
// kromme rug, aanval-windup, flinch, sterven), telkens: een recht-vooruit-
// schot op de ACTUELE wereldpositie van de kop-bone raakt de kop-proxy
// (headshot-schade), en de zichtbare SkinnedMesh zelf wordt NOOIT geraakt
// (structureel via de layer-check, niet via geluk met de geometrie). Mikt op
// de LEVENDE botpositie (getWorldPosition) i.p.v. een vaste constante —
// robuust tegen elke build-tijd-positieverschuiving (kromme rug, scheve nek)
// zonder aannames over de exacte getallen te hoeven herhalen. --------------
const V2_STAAT_MATRIX = ['rust', 'loopcyclusMidden', 'krommeRug', 'windup', 'flinch', 'sterven'];
const v2HitboxMatrix = await page.evaluate((staten) => {
  const d = window.AmsterdamUndeadDebug;
  const uit = {};
  for (const staat of staten) {
    for (const o of [...d.ondoden]) d.doodOndode(o);
    for (const s of [...d.stervenden]) {}   // stervenden ruimen zichzelf op via updateStervenden, niet hier nodig
    d.schadePerTreffer = 1;
    d.eliminatiemodusTimer = 0;
    d.wapenStaat.magazijn = 8;
    const traits = staat === 'krommeRug'
      ? { profiel: 'standaard', kromme: true, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false }
      : { profiel: 'standaard', kromme: false, slepend: 0, armVerschil: 0, lengte: 1, strompelt: false };
    const o = d.spawnOndode(0, 'normaal', traits);
    o.hp = 1000;
    o.groep.position.set(0, 0, -3);
    o.groep.rotation.y = Math.PI;
    o.groep.scale.set(1, 1, 1);
    d.speler.positie.set(0, 0, 0);

    if (staat === 'loopcyclusMidden') {
      for (let i = 0; i < 6; i++) d.updateOndoden(0.08);
    } else if (staat === 'windup') {
      o.aanvalStaat = 'windup';
      o.aanvalTimer = 0.5;
      d.updateOndoden(0.05);
    } else if (staat === 'flinch') {
      d.raakOndode(o, o.groep.position, false);   // niet-dodelijke treffer -> flinch-state
      d.updateOndoden(0.02);
    } else if (staat === 'sterven') {
      // Eigen, aparte ondode voor de val-animatie: die verhuist bij het
      // sterven naar stervendenGroep/stervenden (niet meer in ondodenGroep
      // onder dezelfde vlag), maar blijft wél een levende SkinnedMesh + botten
      // — schiet() raycast toch tegen ondodenGroep, dus deze staat toetst
      // vooral "geen crash + de proxy bestaat nog" i.p.v. een echte
      // headshot (een lijk hoort geen kogels meer te vangen, zie T22/T70).
    }

    // Wereldpositie van de kop-bone NU (na de staat hierboven) — robuust
    // tegen elke build-/animatie-tijd-verschuiving.
    o.delen.hoofd.updateMatrixWorld(true);
    const kopWereld = new d.THREE.Vector3();
    o.delen.hoofd.getWorldPosition(kopWereld);
    o.delen.lichaamProxy.updateMatrixWorld(true);
    const lichaamWereld = new d.THREE.Vector3();
    o.delen.lichaamProxy.getWorldPosition(lichaamWereld);

    function mikEnSchiet(doelPunt) {
      const dx = doelPunt.x - d.speler.positie.x, dz = doelPunt.z - d.speler.positie.z;
      const afstandXZ = Math.hypot(dx, dz);
      // yaw=0 kijkt naar -z (projectconventie, zie updateSpeler()'s
      // bewegingsformule): camera.rotation.y=θ geeft forward=(-sinθ,-cosθ),
      // dus θ = atan2(-dx, -dz) om op (dx,dz) te mikken.
      d.speler.yaw = Math.atan2(-dx, -dz);
      d.speler.pitch = Math.atan2(doelPunt.y - d.speler.hoogte, afstandXZ);
      d.camera.position.set(d.speler.positie.x, d.speler.hoogte, d.speler.positie.z);
      d.camera.rotation.y = d.speler.yaw;
      d.camera.rotation.x = d.speler.pitch;
      o.groep.updateMatrixWorld(true);
      d.camera.updateMatrixWorld(true);
      const hpVoor = o.hp;
      d.schiet();
      return hpVoor - o.hp;
    }

    const kopSchade = staat === 'sterven' ? null : mikEnSchiet(kopWereld);
    const lichaamSchade = staat === 'sterven' ? null : mikEnSchiet(lichaamWereld);
    const skinnedMeshOpRaycastLayer = o.delen.skinnedMesh.layers.test(d.raycaster.layers);
    const kopProxyOpRaycastLayer = o.delen.kopProxy.layers.test(d.raycaster.layers);
    const lichaamProxyOpRaycastLayer = o.delen.lichaamProxy.layers.test(d.raycaster.layers);
    const kopProxyHeeftLichaamsdeel = o.delen.kopProxy.userData.lichaamsdeel === 'kop';
    const skinnedMeshHeeftLichaamsdeel = 'lichaamsdeel' in o.delen.skinnedMesh.userData;

    uit[staat] = {
      kopSchade, lichaamSchade,
      skinnedMeshOpRaycastLayer, kopProxyOpRaycastLayer, lichaamProxyOpRaycastLayer,
      kopProxyHeeftLichaamsdeel, skinnedMeshHeeftLichaamsdeel,
    };
    if (staat !== 'sterven') d.doodOndode(o);
  }
  return uit;
}, V2_STAAT_MATRIX);

for (const staat of ['rust', 'loopcyclusMidden', 'krommeRug', 'windup', 'flinch']) {
  const r = v2HitboxMatrix[staat];
  check(`[${staat}] Een recht-vooruit-schot op de kop-bone-positie geeft headshot-schade (2)`,
    r.kopSchade === 2, { staat, ...r });
  check(`[${staat}] Een recht-vooruit-schot op de lichaam-proxy-positie geeft lichaamsschade (1)`,
    r.lichaamSchade === 1, { staat, ...r });
}
for (const staat of V2_STAAT_MATRIX) {
  const r = v2HitboxMatrix[staat];
  check(`[${staat}] De zichtbare SkinnedMesh staat NOOIT op de raycast-layer (kan nooit geraakt worden)`,
    r.skinnedMeshOpRaycastLayer === false, { staat, ...r });
  check(`[${staat}] Kop-/lichaam-proxy staan WEL op de raycast-layer`,
    r.kopProxyOpRaycastLayer === true && r.lichaamProxyOpRaycastLayer === true, { staat, ...r });
  check(`[${staat}] De kop-proxy draagt userData.lichaamsdeel='kop', de SkinnedMesh draagt dat veld NOOIT`,
    r.kopProxyHeeftLichaamsdeel && !r.skinnedMeshHeeftLichaamsdeel, { staat, ...r });
}

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
