// Ticket 173 (v0.31, ronde 17): geluiden die je écht hoort.
//
// AANLEIDING, gemeten. De eigenaar: "je krijgt alleen een kort klein
// melodietje wat je bijna niet eens merkt." De hele intro was één
// registry-ingang van vier sinustonen, samen 0,6 seconde, op volume 0,05.
// Vervangen door een beiaardfiguur van ruim vijf seconden, en het schap
// "Geluiden" heeft er twee families bij gekregen: achtergrondmuziek en
// wapenklank.
//
// TWEE DINGEN DIE DIT BESTAND BEWAAKT, en het tweede is het belangrijkste:
//
//  1. De KANALEN zijn onafhankelijk. Muziek, wapenklank en de intro delen één
//     schap maar niet één keuze — anders zou het aanzetten van een muziekset
//     je intro-tune uitschakelen. Dat is een afwijking van de "één actief item
//     per categorie"-regel, en die afwijking hoort vastgelegd te zijn.
//  2. De STANDAARD is onaangeroerd. Wie niets koopt, hoort exact wat hij
//     altijd al hoorde, en geen enkele klankset raakt een balansgetal.
//     `schotToon` (de per-wapen identiteit uit T34/T144) blijft in élke set
//     intact: een set mag de klank kleuren, niet de wapens gelijk maken.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

const rijkArchief = (gekocht, actiefPerCategorie = {}) => ({
  ontsnappingen: 20, headshotsTotaal: 9000, hoogsteGolf: 40, golvenTotaal: 900,
  geld: 99999, gekocht, actiefPerCategorie,
  actief: { kleurset: false, vlamTint: false, introMelodie: false },
});

// --- 1. De kanalen staan onafhankelijk van elkaar aan -------------------
const kanalen = await page.evaluate((archief) => {
  const d = window.AmsterdamUndeadDebug;
  const alles = ['introMelodie', 'muziek-donker', 'wapen-scherp'];
  d.stadsarchief = { ...archief, gekocht: alles, versie: d.ARCHIEF_VERSIE };
  // Alle drie aanzetten — ze horen naast elkaar te kunnen staan.
  for (const id of alles) d.zetArchiefItemActief(id, true);
  const alledrie = {
    intro: d.actiefGeluid('intro')?.id,
    muziek: d.actiefGeluid('muziek')?.id,
    wapen: d.actiefGeluid('wapen')?.id,
    sleutels: Object.keys(d.stadsarchief.actiefPerCategorie).sort(),
  };
  // Een tweede muziekset aanzetten VERVANGT de eerste (binnen het kanaal
  // geldt wél exclusiviteit), maar laat de andere kanalen met rust.
  d.stadsarchief.gekocht.push('muziek-gracht');
  d.zetArchiefItemActief('muziek-gracht', true);
  const naWissel = {
    intro: d.actiefGeluid('intro')?.id,
    muziek: d.actiefGeluid('muziek')?.id,
    wapen: d.actiefGeluid('wapen')?.id,
  };
  // En eentje uitzetten raakt de rest niet.
  d.zetArchiefItemActief('wapen-scherp', false);
  const naUit = {
    intro: d.actiefGeluid('intro')?.id,
    muziek: d.actiefGeluid('muziek')?.id,
    wapen: d.actiefGeluid('wapen')?.id,
  };
  return { alledrie, naWissel, naUit };
}, rijkArchief([]));
check('Intro, muziek en wapenklank kunnen alle drie tegelijk aanstaan — één schap, drie kanalen',
  kanalen.alledrie.intro === 'introMelodie' && kanalen.alledrie.muziek === 'muziek-donker'
  && kanalen.alledrie.wapen === 'wapen-scherp', kanalen);
check('Ze worden per KANAAL bewaard, niet per categorie (anders zouden ze elkaar verdringen)',
  kanalen.alledrie.sleutels.every(s => s.startsWith('geluid:'))
  && kanalen.alledrie.sleutels.length === 3, kanalen);
check('Binnen één kanaal geldt wél exclusiviteit: een tweede muziekset vervangt de eerste',
  kanalen.naWissel.muziek === 'muziek-gracht', kanalen);
check('...en laat de andere kanalen ongemoeid',
  kanalen.naWissel.intro === 'introMelodie' && kanalen.naWissel.wapen === 'wapen-scherp', kanalen);
check('Eén kanaal uitzetten raakt de andere twee niet',
  kanalen.naUit.wapen === undefined && kanalen.naUit.intro === 'introMelodie'
  && kanalen.naUit.muziek === 'muziek-gracht', kanalen);

// --- 2. Kleuritems blijven wél exclusief per categorie ------------------
// De afwijking hierboven mag niet doorlekken naar de kleuren: twee
// vizierkleuren tegelijk kan niet.
const kleuren = await page.evaluate((archief) => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ...archief, gekocht: ['richtkruis-ijs', 'richtkruis-groen'], versie: d.ARCHIEF_VERSIE };
  d.zetArchiefItemActief('richtkruis-ijs', true);
  d.zetArchiefItemActief('richtkruis-groen', true);
  return {
    actief: d.actiefArchiefItem('richtkruis')?.id,
    sleutels: Object.keys(d.stadsarchief.actiefPerCategorie),
  };
}, rijkArchief([]));
check('Twee vizierkleuren aanzetten laat er precies één aan — kleuren blijven exclusief per categorie',
  kleuren.actief === 'richtkruis-groen' && kleuren.sleutels.length === 1
  && kleuren.sleutels[0] === 'richtkruis', kleuren);

// --- 3. De standaard is exact onveranderd ------------------------------
const standaard = await page.evaluate((archief) => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = { ...archief, gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE };
  return {
    muziek: d.actieveMuziekStemming(),
    wapen: d.actieveWapenklank(),
    registryType: d.GELUIDEN.schot.type,
    registryRuis: { ...d.GELUIDEN.schot.ruis },
    standaardStemming: d.MUZIEK_STEMMINGEN.standaard.frequenties,
  };
}, rijkArchief([]));
check('Zonder aankopen is de muziekstemming de bestaande E3 + C#4/D4',
  JSON.stringify(standaard.muziek.frequenties) === JSON.stringify([164.82, 277.18, 293.66]), standaard);
check('Zonder aankopen is de wapenklank exact de `schot`-ingang uit de registry — geen stille verschuiving',
  standaard.wapen.type === standaard.registryType
  && standaard.wapen.ruis.filterStart === standaard.registryRuis.filterStart
  && standaard.wapen.ruis.filterEind === standaard.registryRuis.filterEind
  && standaard.wapen.ruis.Q === standaard.registryRuis.Q
  && standaard.wapen.ruis.duur === standaard.registryRuis.duur, standaard);
check('De standaardklankset heeft geen toonhoogteverschuiving', standaard.wapen.pitch === undefined, standaard);

// --- 4. Elke variant klinkt aantoonbaar anders -------------------------
const varianten = await page.evaluate((archief) => {
  const d = window.AmsterdamUndeadDebug;
  const meet = (id, kanaal) => {
    d.stadsarchief = { ...archief, gekocht: id ? [id] : [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE };
    if (id) d.zetArchiefItemActief(id, true);
    return kanaal === 'muziek'
      ? d.actieveMuziekStemming().frequenties.join(',')
      : JSON.stringify({ type: d.actieveWapenklank().type, ruis: d.actieveWapenklank().ruis, pitch: d.actieveWapenklank().pitch });
  };
  const muziek = ['', 'muziek-donker', 'muziek-gracht', 'muziek-spanning'].map(id => meet(id, 'muziek'));
  const wapen = ['', 'wapen-dof', 'wapen-scherp', 'wapen-diep'].map(id => meet(id, 'wapen'));
  return { muziek, wapen };
}, rijkArchief([]));
check('De vier muziekstemmingen zijn alle vier verschillend',
  new Set(varianten.muziek).size === 4, varianten.muziek);
check('De vier wapenklanken zijn alle vier verschillend',
  new Set(varianten.wapen).size === 4, varianten.wapen);

// --- 5. Een klankset raakt GEEN enkel balansgetal ----------------------
// Dit is de belangrijkste check van het bestand. Een wapenset mag de klank
// kleuren; zodra hij aan schade, vuursnelheid, spreiding of magazijn komt, is
// het geen cosmetisch item meer en hoort het niet in dit schap.
const balans = await page.evaluate((archief) => {
  const d = window.AmsterdamUndeadDebug;
  // ARSENAAL is een object per wapennaam; de getallen zitten in `definitie`.
  // Alles serialiseren i.p.v. een handmatig lijstje velden: zo valt ook een
  // eigenschap op die ik hier niet bij naam bedacht had.
  const meetWapens = () => Object.entries(d.ARSENAAL)
    .map(([naam, w]) => naam + ':' + JSON.stringify(w.definitie))
    .join('|');
  const voor = meetWapens();
  const gemeten = [];
  for (const id of ['wapen-dof', 'wapen-scherp', 'wapen-diep']) {
    d.stadsarchief = { ...archief, gekocht: [id], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE };
    d.zetArchiefItemActief(id, true);
    gemeten.push({ id, wapens: meetWapens() });
  }
  // En de bronnen: een klankset-definitie mag geen balansterm bevatten.
  const bron = JSON.stringify(d.WAPEN_KLANKSETS) + d.actieveWapenklank.toString() + d.speelSchot.toString();
  const verboden = ['schade', 'vuurInterval', 'magazijn', 'spreiding', 'herlaad',
    'WAPEN_SCHADE_MAX', 'schadePerTreffer', '_PRIJS', 'GELD_PER_'];
  return { voor, gemeten, gevonden: verboden.filter(t => bron.includes(t)) };
}, rijkArchief([]));
check('Geen enkele wapenset verandert ook maar één wapeneigenschap (schade, vuursnelheid, magazijn, spreiding, herladen)',
  balans.gemeten.every(g => g.wapens === balans.voor), balans.gemeten.filter(g => g.wapens !== balans.voor));
check('De klanksets en speelSchot() noemen geen enkele balansterm',
  balans.gevonden.length === 0, balans);

// --- 6. Elk wapen houdt zijn eigen identiteit in élke set --------------
// Een set die alle wapens hetzelfde laat klinken wist het onderscheid dat
// T34/T144 juist hebben aangebracht.
const identiteit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tonen = Object.values(d.ARSENAAL)
    .map(w => w.definitie.schotToon)
    .filter(Boolean)
    .map(t => `${t.start}/${t.eind}/${t.duur}`);
  return { tonen, uniek: new Set(tonen).size };
});
check('Elk wapen houdt zijn eigen schotToon — een klankset kleurt de wapens, maakt ze niet gelijk',
  identiteit.uniek === identiteit.tonen.length && identiteit.uniek >= 2, identiteit);

// --- 7. De intro is nu een echte tune ---------------------------------
const intro = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const g = d.GELUIDEN.introMelodie;
  const eindes = (g.vervolg ?? []).map(v => v.na + v.duur);
  return {
    tonen: 1 + (g.vervolg?.length ?? 0),
    lengte: Math.max(g.duur, ...eindes),
    hoogste: Math.max(g.start, ...(g.vervolg ?? []).map(v => v.start)),
    laagste: Math.min(g.start, ...(g.vervolg ?? []).map(v => v.start)),
    volumes: [g.volume, ...(g.vervolg ?? []).map(v => v.volume)],
  };
});
check(`De openingstune duurt nu ruim vijf seconden in plaats van 0,6 (gemeten: ${intro.lengte.toFixed(1)}s)`,
  intro.lengte >= 4 && intro.lengte <= 7, intro);
check('Het is een echte figuur met meerdere slagen, geen los piepje',
  intro.tonen >= 10, intro);
check('Met een groot toonbereik — klokken bovenin, een lage naklank eronder',
  intro.hoogste / intro.laagste > 8, intro);
check('En hij blijft binnen het gebalanceerde volumeniveau van de rest van het spel',
  Math.max(...intro.volumes) <= 0.12, intro);

// --- 8. Omschakelen tijdens het spel doet de muziek echt bewegen -------
const omschakelen = await page.evaluate(async (archief) => {
  const d = window.AmsterdamUndeadDebug;
  d.initGeluid();
  await new Promise(r => setTimeout(r, 60));
  const oscs = d.muziekOscillatoren;
  if (!oscs) return { overgeslagen: true };
  const voor = oscs.map(o => o.frequency.value);
  d.stadsarchief = { ...archief, gekocht: ['muziek-donker'], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE };
  d.zetArchiefItemActief('muziek-donker', true);
  d.pasGeluidsetToe({ direct: true });
  const na = oscs.map(o => o.frequency.value);
  return { voor, na, doel: d.MUZIEK_STEMMINGEN.donker.frequenties };
}, rijkArchief([]));
if (omschakelen.overgeslagen) {
  check('Muziekoscillatoren beschikbaar (audio geïnitialiseerd)', false, omschakelen);
} else {
  // AudioParam-waarden zijn float32, dus 130.81 komt terug als
  // 130.80999755859375. Vergelijken met een marge, niet op de komma.
  const raakt = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.01);
  check('Een muziekset omzetten stemt de lopende oscillatoren echt om',
    raakt(omschakelen.na, omschakelen.doel)
    && !raakt(omschakelen.voor, omschakelen.na), omschakelen);
}

// --- 9. Opruimen -------------------------------------------------------
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
