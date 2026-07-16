// Aanval A1 (Ticket 30): aanvals-state-machine met wind-up. Bewaakt dat een
// ondode nooit meer schade toepast zonder een volledig verstreken wind-up
// (geen contactschade meer), dat de speler kan ontwijken door afstand of
// zijwaartse beweging (hoek-kegel), dat een aanval nooit door een muur heen
// raakt, dat maximaal MAX_AANVALLERS ondoden tegelijk in wind-up staan, en
// dat de DPS-pariteit uit ARCHITECTURE_NOTES §5.2 klopt voor een stilstaand
// doelwit zonder reactie.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Geen schade vóór het einde van de wind-up, wel daarna -------------
const windupTiming = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);   // binnen raakBereik (1.6) en AANVAL_START_BEREIK (1.4)
  o.aanvalVertraging = 0;             // wind-up start zonder jitter-wachttijd
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  const dt = 1 / 60;
  let stappenTotWindup = 0;
  // Eerste tick(s): jaag -> windup-overgang (zelfde frame kan al de overgang
  // triggeren als de jitter al 0 was); daarna tikken tot vlak vóór het einde.
  while (o.aanvalStaat !== 'windup' && stappenTotWindup < 5) { d.updateOndoden(dt); stappenTotWindup++; }
  const inWindupNaStart = o.aanvalStaat === 'windup';
  const hpVoorWindup = d.spelerStaat.hp;
  const stappenBinnenWindup = Math.floor((windupDuur - dt) / dt);   // net vóór het slag-moment
  for (let i = 0; i < stappenBinnenWindup; i++) d.updateOndoden(dt);
  const hpVlakVoorSlag = d.spelerStaat.hp;
  // Nog een handvol ticks om zeker over het slag-moment heen te komen.
  for (let i = 0; i < 5; i++) d.updateOndoden(dt);
  const hpNaSlag = d.spelerStaat.hp;
  d.doodOndode(o);
  return { inWindupNaStart, hpVoorWindup, hpVlakVoorSlag, hpNaSlag, windupDuur };
});
check('De ondode start daadwerkelijk een wind-up (aanvalStaat wordt "windup")',
  windupTiming.inWindupNaStart, windupTiming);
check('Geen schade zolang de wind-up nog niet is verstreken',
  windupTiming.hpVlakVoorSlag === windupTiming.hpVoorWindup, windupTiming);
check('Na het volledige verstrijken van de wind-up valt schade (15 HP, normaal-profiel)',
  windupTiming.hpNaSlag === windupTiming.hpVoorWindup - 15, windupTiming);

// --- 2. Ontwijken door afstand: speler stapt vlak vóór het slag-moment weg -
const ontwijkAfstand = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  const raakBereik = d.AANVAL_PROFIELEN.normaal.raakBereik;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const stappenBinnenWindup = Math.floor((windupDuur - dt) / dt);
  for (let i = 0; i < stappenBinnenWindup; i++) d.updateOndoden(dt);
  // Vlak vóór het slag-moment: de speler stapt ver weg, buiten raakBereik.
  d.speler.positie.set(0, 0, -(raakBereik + 2));
  const hpVoor = d.spelerStaat.hp;
  for (let i = 0; i < 5; i++) d.updateOndoden(dt);
  const hpNa = d.spelerStaat.hp;
  d.doodOndode(o);
  return { hpVoor, hpNa };
});
check('Ontwijken door afstand: de speler stapt vlak vóór het slag-moment buiten bereik en blijft ongedeerd',
  ontwijkAfstand.hpNa === ontwijkAfstand.hpVoor, ontwijkAfstand);

// --- 3. Ontwijken door zijwaartse beweging: hoek-kegel ---------------------
// De ondode kan zijn kijkrichting maar beperkt bijsturen (AANVAL_DRAAI_
// SNELHEID); een speler die vlak vóór het slag-moment naar de zijkant
// springt (blijft wél binnen raakBereik) laat de hoekcheck falen.
const ontwijkHoek = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const stappenBinnenWindup = Math.floor((windupDuur - dt) / dt);
  for (let i = 0; i < stappenBinnenWindup; i++) d.updateOndoden(dt);
  // Vlak vóór het slag-moment: de speler springt zijwaarts (90°), blijft op
  // ongeveer dezelfde afstand tot de ondode (dus binnen raakBereik).
  d.speler.positie.set(1.0, 0, -1.0);
  const hpVoor = d.spelerStaat.hp;
  for (let i = 0; i < 3; i++) d.updateOndoden(dt);
  const hpNa = d.spelerStaat.hp;
  d.doodOndode(o);
  return { hpVoor, hpNa };
});
check('Ontwijken door zijwaartse beweging: de speler springt vlak vóór het slag-moment uit de hoek-kegel en blijft ongedeerd',
  ontwijkHoek.hpNa === ontwijkHoek.hpVoor, ontwijkHoek);

// --- 4. Muur-tussenin: een aanval raakt nooit door een obstakel heen ------
const muurCheck = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  // Obstakel exact op het middelpunt tussen ondode en speler (0,-0.5).
  d.obstakels.push({ minX: -0.3, maxX: 0.3, minZ: -0.6, maxZ: -0.4 });
  const windupDuur = d.AANVAL_PROFIELEN.normaal.windup;
  const dt = 1 / 60;
  let stappen = 0;
  while (o.aanvalStaat !== 'windup' && stappen < 5) { d.updateOndoden(dt); stappen++; }
  const totaalStappen = Math.ceil(windupDuur / dt) + 5;
  const hpVoor = d.spelerStaat.hp;
  for (let i = 0; i < totaalStappen; i++) d.updateOndoden(dt);
  const hpNa = d.spelerStaat.hp;
  d.obstakels.pop();
  d.doodOndode(o);
  return { hpVoor, hpNa };
});
check('Een muur/obstakel tussen ondode en speler blokkeert de slag (geen schade)',
  muurCheck.hpNa === muurCheck.hpVoor, muurCheck);

// --- 5. Nooit meer dan MAX_AANVALLERS gelijktijdig in wind-up -------------
const maxAanvallers = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  const ondoden = [];
  for (let i = 0; i < 4; i++) {
    const o = d.spawnOndode(0, 'normaal');
    o.groep.position.set((i - 1.5) * 0.3, 0, -1.0);   // vier op een rijtje, allemaal dichtbij
    o.aanvalVertraging = 0;
    ondoden.push(o);
  }
  const dt = 1 / 60;
  let maxGelijktijdig = 0;
  for (let i = 0; i < 30; i++) {
    d.updateOndoden(dt);
    const aantalInWindup = ondoden.filter(o => o.aanvalStaat === 'windup').length;
    maxGelijktijdig = Math.max(maxGelijktijdig, aantalInWindup);
  }
  for (const o of ondoden) d.doodOndode(o);
  const actieveAanvallersEindstand = d.actieveAanvallers;
  return { maxGelijktijdig, actieveAanvallersEindstand, maxAanvallersConstante: d.MAX_AANVALLERS };
});
check('Nooit meer dan MAX_AANVALLERS ondoden tegelijk in wind-up, ook met 4 kandidaten dichtbij',
  maxAanvallers.maxGelijktijdig <= maxAanvallers.maxAanvallersConstante, maxAanvallers);
check('actieveAanvallers-teller is na het opruimen van alle ondoden weer op 0',
  maxAanvallers.actieveAanvallersEindstand === 0, maxAanvallers);

// --- 6. DPS-pariteit: een stilstaand doelwit zonder reactie krijgt ongeveer
// 15 HP schade per (windup + herstel) = 1.25s (normaal-profiel) -----------
const dpsPariteit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  for (const o of [...d.ondoden]) d.doodOndode(o);
  d.spelerStaat.hp = d.spelerStaat.hpMax;
  d.speler.positie.set(0, 0, 0);
  const o = d.spawnOndode(0, 'normaal');
  o.groep.position.set(0, 0, -1.0);
  o.aanvalVertraging = 0;
  const profiel = d.AANVAL_PROFIELEN.normaal;
  const cyclusDuur = profiel.windup + profiel.herstel;   // 1.25s: verwachte tijd tussen twee treffers
  const totaleTijd = cyclusDuur * 4;   // 4 volledige cycli simuleren
  const dt = 1 / 60;
  const stappen = Math.round(totaleTijd / dt);
  const hpVoor = d.spelerStaat.hp;
  for (let i = 0; i < stappen; i++) d.updateOndoden(dt);
  const hpNa = d.spelerStaat.hp;
  const schadeTotaal = hpVoor - hpNa;
  d.doodOndode(o);
  return { schadeTotaal, verwachteSchade: profiel.schade * 4, cyclusDuur, totaleTijd };
});
check('DPS-pariteit: over 4 volledige aanvalscycli (1.25s elk) valt ongeveer 4x de profielschade (±1 treffer marge)',
  Math.abs(dpsPariteit.schadeTotaal - dpsPariteit.verwachteSchade) <= 15, dpsPariteit);

// --- 7. Sjouwer heeft een langere wind-up en meer schade dan Loper/Sluiper -
const profielVerschillen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    sjouwer: d.AANVAL_PROFIELEN.sjouwer, loper: d.AANVAL_PROFIELEN.loper, sluiper: d.AANVAL_PROFIELEN.sluiper,
  };
});
check('Sjouwer: wind-up >= 0.85s en schade 25 (trage dreun, acceptatiecriterium)',
  profielVerschillen.sjouwer.windup >= 0.85 && profielVerschillen.sjouwer.schade === 25, profielVerschillen);
check('Loper en Sluiper hebben een kortere wind-up dan de Sjouwer en zijn onderbreekbaar via lichaamstreffer',
  profielVerschillen.loper.windup < profielVerschillen.sjouwer.windup &&
  profielVerschillen.sluiper.windup < profielVerschillen.sjouwer.windup &&
  profielVerschillen.loper.onderbreekbaarLichaam && profielVerschillen.sluiper.onderbreekbaarLichaam,
  profielVerschillen);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
