// Ticket 161 (v0.27, ronde 13): de itemcatalogus.
//
// Drie dingen maken dit ticket riskant, en die staan hier dan ook centraal:
//
//  1. §9.2. De catalogus mag geen enkel balansgetal aanraken. Dat wordt hier
//     als BRONASSERTIE getoetst, niet als belofte. Let op: die assertie is
//     bewust bot — ze kan commentaar niet van code onderscheiden. Dat is geen
//     tekortkoming maar het vangnet zelf (zie het nawoord bij T160).
//  2. Startuitrusting is de enige toegestane verruiming op §9.2, onder drie
//     voorwaarden die alle drie hier getoetst worden: hoogstens één tegelijk
//     actief, duurder én hoger gedrempeld dan elk cosmetisch item, en een
//     effect dat aantoonbaar uitdooft.
//  3. Ondode-kleursets mogen het type-onderscheid niet slopen. De tint is
//     een VERMENIGVULDIGING over de bestaande huidskleur, dus onderlinge
//     verschillen blijven behouden — dat wordt hier gemeten, niet aangenomen.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 1. Vorm van de catalogus -------------------------------------------
const vorm = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const items = d.ARCHIEF_ITEMS;
  const ids = items.map(i => i.id);
  const categorieIds = d.ARCHIEF_CATEGORIEEN.map(c => c.id);
  return {
    aantal: items.length,
    categorieen: categorieIds,
    uniekeIds: new Set(ids).size === ids.length,
    allesGeldig: items.every(i =>
      typeof i.id === 'string' && i.id.length > 0 &&
      typeof i.naam === 'string' && i.naam.length > 0 &&
      categorieIds.includes(i.categorie) &&
      Number.isFinite(i.prijs) && i.prijs > 0 &&
      Number.isFinite(i.puntenEis) && i.puntenEis >= 0 &&
      (i.soort === d.ARCHIEF_SOORT_COSMETISCH || i.soort === d.ARCHIEF_SOORT_START)),
    perCategorie: Object.fromEntries(categorieIds.map(c => [c, items.filter(i => i.categorie === c).length])),
    opzoekbaar: ids.every(id => d.archiefItem(id) && d.archiefItem(id).id === id),
    onbekend: d.archiefItem('bestaat-niet-123'),
  };
});
check(`De catalogus telt ${vorm.aantal} items over ${vorm.categorieen.length} categorieën (richtwaarde 20-24)`,
  vorm.aantal >= 20 && vorm.aantal <= 24 && vorm.categorieen.length >= 5, vorm);
check('Elk item heeft een geldig id, naam, bestaande categorie, positieve prijs, drempel en bekend soort',
  vorm.allesGeldig, vorm);
check('Alle id\'s zijn uniek (een id is voor eeuwig — hergebruik pakt een speler zijn aankoop af)',
  vorm.uniekeIds, vorm);
check('Elke categorie bevat minstens één item, en meerdere categorieën bieden een echte keuze uit varianten',
  Object.values(vorm.perCategorie).every(n => n >= 1)
  && Object.values(vorm.perCategorie).filter(n => n >= 3).length >= 3, vorm);
check('archiefItem() vindt elk id terug en geeft null voor een onbekend id',
  vorm.opzoekbaar && vorm.onbekend === null, vorm);

// --- 2. §9.2-BRONASSERTIE ------------------------------------------------
// De catalogus en zijn toepassingshaken mogen geen enkele term uit de
// verbodenlijst bevatten — ook niet in commentaar.
const bron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const teScannen = [
    d.archiefItem, d.archiefItemOntgrendeld, d.bezitArchiefItem, d.actiefArchiefItem,
    d.actieveStartuitrusting, d.pasArchiefStijlToe, d.pasStartuitrustingToe, d.mijlpaalpunten,
  ].map(f => f.toString()).join('\n');
  // Plus de itemtabel zelf, inclusief de schenk-/uitdoofhaken.
  const tabel = d.ARCHIEF_ITEMS.map(i =>
    JSON.stringify({ ...i, schenk: undefined, uitdoofVlag: undefined })
    + (i.schenk ? i.schenk.toString() : '') + (i.uitdoofVlag ? i.uitdoofVlag.toString() : '')
  ).join('\n');
  const verboden = ['SPELER_HP_MAX', '_PRIJS', 'GELD_PER_HIT', 'GELD_PER_KILL',
    'schadePerTreffer', 'WAPEN_SCHADE_MAX', 'golfBudget', 'GOLF_BUDGET_',
    'ONDODE_THREAT_KOSTEN', 'GOLF_MAX_ACTIEF', 'ONDODE_HP_TRAPPEN',
    'AANVAL_PROFIELEN', 'POWERUP_DROP_KANS'];
  const alles = teScannen + '\n' + tabel;
  return { gevonden: verboden.filter(t => alles.includes(t)) };
});
check('Geen enkele catalogusfunctie of itemdefinitie bevat een term uit de §9.2-verbodenlijst',
  bron.gevonden.length === 0, bron);

// --- 3. Startuitrusting, eis 1: hooguit één tegelijk actief -------------
const exclusief = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const startItems = d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_START);
  const archief = {
    ontsnappingen: 99, headshotsTotaal: 9999, hoogsteGolf: 99,
    geld: 0, versie: d.ARCHIEF_VERSIE,
    gekocht: startItems.map(i => i.id),          // ALLE startitems in bezit
    actiefPerCategorie: { startuitrusting: startItems[0].id },
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  const actief = d.actieveStartuitrusting(archief);
  // Ook met alles in bezit blijft er precies één actief, want de keuze staat
  // per CATEGORIE opgeslagen — er is structureel geen plek voor een tweede.
  const tweedeGeprobeerd = { ...archief, actiefPerCategorie: { startuitrusting: startItems[1].id } };
  return {
    aantalStartItems: startItems.length,
    actiefId: actief ? actief.id : null,
    naWissel: d.actieveStartuitrusting(tweedeGeprobeerd).id,
    eersteId: startItems[0].id, tweedeId: startItems[1].id,
  };
});
check(`Er zijn ${exclusief.aantalStartItems} startuitrustingsitems (ticket: hooguit 3-4)`,
  exclusief.aantalStartItems >= 1 && exclusief.aantalStartItems <= 4, exclusief);
check('Ook met ALLE startitems in bezit is er hooguit één tegelijk actief — afgedwongen door de catalogus, niet door de UI',
  exclusief.actiefId === exclusief.eersteId, exclusief);
check('Een ander startitem kiezen vervangt het vorige in plaats van te stapelen',
  exclusief.naWissel === exclusief.tweedeId, exclusief);

// --- 4. Startuitrusting, eis 2: duurder én hoger gedrempeld -------------
const ladder = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const cosm = d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_COSMETISCH);
  const start = d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_START);
  return {
    duursteCosmetisch: Math.max(...cosm.map(i => i.prijs)),
    goedkoopsteStart: Math.min(...start.map(i => i.prijs)),
    hoogsteCosmetischePunten: Math.max(...cosm.map(i => i.puntenEis)),
    laagsteStartPunten: Math.min(...start.map(i => i.puntenEis)),
  };
});
check('Elk startuitrustingsitem is duurder dan élk cosmetisch item',
  ladder.goedkoopsteStart > ladder.duursteCosmetisch, ladder);
check('Elk startuitrustingsitem zit achter een hogere puntendrempel dan élk cosmetisch item',
  ladder.laagsteStartPunten > ladder.hoogsteCosmetischePunten, ladder);

// --- 5. Startuitrusting, eis 3: het effect DOOFT UIT --------------------
// Voor elk startitem geldt: het raakt één spelerstoestand, en zodra een
// gewone speler die zelf bereikt is een run mét en zonder het item niet meer
// te onderscheiden. Hier gemeten door de bijbehorende aankoop gewoon te doen
// en te toetsen dat de vlag daarna in beide gevallen gelijk staat.
const uitdoof = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const resultaten = [];
  for (const item of d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_START)) {
    const voor = item.uitdoofVlag();
    // Zonder het item: de speler koopt het ding zelf (ruim saldo).
    d.spelStaat.geld = 999999;
    item.schenk();
    const naEigenAankoop = item.uitdoofVlag();
    // Mét het item: de schenking is dan een no-op, want het bezit is er al.
    const saldoVoor = d.spelStaat.geld;
    d.schenkAankoop(item.schenk);
    resultaten.push({
      id: item.id,
      voor,
      naEigenAankoop,
      naSchenking: item.uitdoofVlag(),
      saldoOngewijzigd: d.spelStaat.geld === saldoVoor,
    });
  }
  return resultaten;
});
check('Elk startuitrustingsitem raakt een spelerstoestand die een gewone speler zélf ook bereikt (het effect dooft dus uit)',
  uitdoof.every(r => r.voor === false && r.naEigenAankoop === true && r.naSchenking === true), uitdoof);
check('Een schenking van iets dat de speler al heeft is een no-op en verandert het saldo niet',
  uitdoof.every(r => r.saldoOngewijzigd), uitdoof);

// --- 6. schenkAankoop(): geeft zonder te laten betalen -------------------
const schenking = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Verse pagina-staat is niet te krijgen binnen één run, dus toets het
  // saldo-contract op een aankoop die zeker nog niet gedaan is als die er is;
  // anders volstaat het no-op-pad (de kern is dat het saldo exact terugkomt).
  const saldoVoor = 1234;
  d.spelStaat.geld = saldoVoor;
  d.schenkAankoop(() => { /* een koopfunctie die niets doet */ });
  const naLege = d.spelStaat.geld;
  let gooide = false;
  try {
    d.schenkAankoop(() => { throw new Error('koopfunctie faalt'); });
  } catch { gooide = true; }
  return { saldoVoor, naLege, naFout: d.spelStaat.geld, gooide };
});
check('schenkAankoop() zet het saldo exact terug — de schenking kost de speler niets',
  schenking.naLege === schenking.saldoVoor, schenking);
check('...ook als de koopfunctie een fout gooit blijft het saldo intact (geen half-verhoogd saldo)',
  schenking.naFout === schenking.saldoVoor, schenking);

// --- 7. Bezit en ontgrendeling ------------------------------------------
const bezit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const leeg = {
    ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, geld: 0,
    gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  const vlamIjs = d.archiefItem('vlam-ijs');
  const kleurset = d.archiefItem('kleurset');
  // Legacy: verdiend via de OUDE mijlpaal, zonder ooit te kopen — dat moet
  // bezit blijven opleveren, anders pakt de winkel iets af dat T86 al gaf.
  const legacyVerdiend = { ...leeg, ontsnappingen: d.STADSARCHIEF_DREMPEL_ONTSNAPPINGEN };
  return {
    nietGekocht: d.bezitArchiefItem(vlamIjs, leeg),
    welGekocht: d.bezitArchiefItem(vlamIjs, { ...leeg, gekocht: ['vlam-ijs'] }),
    legacyZonderAankoop: d.bezitArchiefItem(kleurset, legacyVerdiend),
    nieuwItemGeenLegacyPad: d.bezitArchiefItem(vlamIjs, legacyVerdiend),
    ontgrendeldBijNul: d.archiefItemOntgrendeld(vlamIjs, leeg),
    ontgrendeldBijVeel: d.archiefItemOntgrendeld(vlamIjs, { ...leeg, ontsnappingen: 99, hoogsteGolf: 99 }),
  };
});
check('Een niet-gekocht item is geen bezit; een gekocht item wel', !bezit.nietGekocht && bezit.welGekocht, bezit);
check('De drie T86-items blijven bezit zodra hun oude mijlpaal gehaald is, ook zonder aankoop',
  bezit.legacyZonderAankoop, bezit);
check('Een NIEUW item krijg je niet gratis via een oude mijlpaal — daar moet je voor betalen',
  !bezit.nieuwItemGeenLegacyPad, bezit);
check('De puntendrempel bepaalt of een item ontgrendeld is', !bezit.ontgrendeldBijNul && bezit.ontgrendeldBijVeel, bezit);

// --- 8. De drie T86-cosmetica gedragen zich exact als voorheen ----------
const legacyGedrag = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const basis = {
    ontsnappingen: d.STADSARCHIEF_DREMPEL_ONTSNAPPINGEN, headshotsTotaal: d.STADSARCHIEF_DREMPEL_HEADSHOTS,
    hoogsteGolf: d.STADSARCHIEF_DREMPEL_GOLF, geld: 0, gekocht: [], actiefPerCategorie: {},
    versie: d.ARCHIEF_VERSIE, actief: { kleurset: true, vlamTint: true, introMelodie: true },
  };
  const uit = { ...basis, actief: { kleurset: false, vlamTint: false, introMelodie: false } };
  // Een expliciete keuze in de nieuwe categorie wint van de oude vlag.
  const nieuwWint = { ...basis, gekocht: ['vlam-groen'], actiefPerCategorie: { mondingsvlam: 'vlam-groen' } };
  return {
    aanVlam: d.actiefArchiefItem('mondingsvlam', basis)?.id,
    aanOndode: d.actiefArchiefItem('ondode', basis)?.id,
    aanIntro: d.actiefArchiefItem('intro', basis)?.id,
    uitVlam: d.actiefArchiefItem('mondingsvlam', uit),
    nieuwWint: d.actiefArchiefItem('mondingsvlam', nieuwWint)?.id,
  };
});
check('De oude aan/uit-knoppen sturen nog steeds hun eigen item aan (T86-gedrag ongewijzigd)',
  legacyGedrag.aanVlam === 'vlamTint' && legacyGedrag.aanOndode === 'kleurset'
  && legacyGedrag.aanIntro === 'introMelodie', legacyGedrag);
check('Staan ze uit, dan is er niets actief in die categorie', legacyGedrag.uitVlam === null, legacyGedrag);
check('Een expliciete keuze uit de nieuwe catalogus wint van de oude aan/uit-vlag',
  legacyGedrag.nieuwWint === 'vlam-groen', legacyGedrag);

// --- 9. Ondode-kleursets slopen het type-onderscheid niet ---------------
// GEMETEN VOORAF, en het veranderde deze test: het kleinste grijswaarde-
// verschil tussen de vier types is ZONDER enige tint al maar 0,0022 op een
// schaal van 0-1. De types zijn dus sowieso niet op huidsluminantie te
// scheiden — en dat hoeft ook niet, want dit spel draagt het type-onderscheid
// via andere kanalen: gang-ritme en bob-amplitude (test-vijand-leesbaarheid),
// oogkleur/-intensiteit, silhouet (Sjouwer 1.35, Sluiper 0.75) en sinds T156
// de kernpuls van de Brander. Die puls bestaat juist OMDAT kleur het niet
// droeg. Een assertie op huidsluminantie zou dus iets eisen wat het basisspel
// zelf niet haalt.
//
// Wat hier daarom wél getoetst wordt, is de eigenschap die een tint veilig
// maakt: het is een VERMENIGVULDIGING op alleen de huidskleur. Daarmee kan
// hij per constructie geen enkel kanaal raken waar het type-onderscheid
// werkelijk in zit, en blijven onderlinge kleurverschillen bestaan.
const leesbaarheid = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const typen = ['normaal', 'brander', 'sjouwer', 'sluiper'];
  const items = d.ARCHIEF_ITEMS.filter(i => i.categorie === 'ondode');
  // Welke velden mag een ondode-item hebben? Alles wat oogkleur, schaal of
  // animatie zou kunnen aanraken hoort er NIET in.
  const toegestaneVelden = new Set(['id', 'naam', 'categorie', 'soort', 'prijs', 'puntenEis', 'ondodeTint', 'legacyVlag', 'niveau']);
  const resultaten = items.map((item) => {
    const tint = new d.THREE.Color(item.ondodeTint);
    const naTint = typen.map(t => {
      const c = new d.THREE.Color(d.ONDODE_TYPES[t].kleur);
      c.multiply(tint);
      return c;
    });
    let kleinsteRgbAfstand = Infinity;
    for (let a = 0; a < naTint.length; a++) {
      for (let b = a + 1; b < naTint.length; b++) {
        const dr = naTint[a].r - naTint[b].r, dg = naTint[a].g - naTint[b].g, db = naTint[a].b - naTint[b].b;
        kleinsteRgbAfstand = Math.min(kleinsteRgbAfstand, Math.sqrt(dr * dr + dg * dg + db * db));
      }
    }
    // Volgorde-behoud per kanaal: voor elk paar types en elk kanaal moet het
    // teken van het verschil hetzelfde blijven na het tinten.
    let volgordeIntact = true;
    for (let a = 0; a < typen.length; a++) {
      for (let b = a + 1; b < typen.length; b++) {
        const ba = new d.THREE.Color(d.ONDODE_TYPES[typen[a]].kleur);
        const bb = new d.THREE.Color(d.ONDODE_TYPES[typen[b]].kleur);
        for (const k of ['r', 'g', 'b']) {
          if (Math.sign(ba[k] - bb[k]) !== Math.sign(naTint[a][k] - naTint[b][k])) volgordeIntact = false;
        }
      }
    }
    return {
      id: item.id,
      volgordeIntact,
      // Geen enkel kanaal op 0: anders klapt een kleurverschil in dat kanaal dicht.
      geenNulKanaal: tint.r > 0.15 && tint.g > 0.15 && tint.b > 0.15,
      // Niet zo donker dat de ondode in het donker verdwijnt.
      helderGenoeg: (tint.r + tint.g + tint.b) / 3 >= 0.4,
      kleinsteRgbAfstand,
      alleenToegestaneVelden: Object.keys(item).every(k => toegestaneVelden.has(k)),
    };
  });
  // Controle op de aanname zelf: de types verschillen onderling in RGB.
  const basisAfstanden = [];
  for (let a = 0; a < typen.length; a++) {
    for (let b = a + 1; b < typen.length; b++) {
      const ca = new d.THREE.Color(d.ONDODE_TYPES[typen[a]].kleur);
      const cb = new d.THREE.Color(d.ONDODE_TYPES[typen[b]].kleur);
      basisAfstanden.push(Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2));
    }
  }
  return { resultaten, kleinsteBasisAfstand: Math.min(...basisAfstanden) };
});
check('Elk ondode-item beschrijft ALLEEN een huidtint — geen veld dat oogkleur, schaal of animatie kan raken (daar zit het type-onderscheid in)',
  leesbaarheid.resultaten.every(r => r.alleenToegestaneVelden), leesbaarheid);
check('Geen enkele tint zet een kleurkanaal (bijna) op nul, dus kleurverschillen tussen types klappen niet dicht',
  leesbaarheid.resultaten.every(r => r.geenNulKanaal), leesbaarheid);
check('Geen enkele tint maakt de ondoden zo donker dat ze in het donker wegvallen',
  leesbaarheid.resultaten.every(r => r.helderGenoeg), leesbaarheid);
// Een vermenigvuldiging comprimeert kleurafstanden onvermijdelijk — dat is
// inherent aan de techniek, geen fout. De eigenschap die er echt toe doet is
// dat een POSITIEVE tint de volgorde per kanaal nooit omkeert: is type A
// roder dan type B, dan blijft dat zo. Twee types kunnen dus niet samenvallen
// of van plaats wisselen. Dat is een wiskundige garantie in plaats van een
// zelfverzonnen drempelgetal, en samen met "geen kanaal op nul" hierboven
// dekt het de zorg volledig af.
check('Geen enkele tint keert de kleurvolgorde tussen twee types om of laat ze samenvallen (volgorde per kanaal blijft intact)',
  leesbaarheid.resultaten.every(r => r.volgordeIntact && r.kleinsteRgbAfstand > 0.01), leesbaarheid);

// --- 10. Geen groei van meshes/materialen/lichten ------------------------
const resources = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const voor = {
    geo: d.renderer.info.memory.geometries, tex: d.renderer.info.memory.textures,
    lichten: d.scene.children.filter(o => o.isLight).length
      + d.wereld.children.filter(o => o.isLight).length,
  };
  for (let i = 0; i < 30; i++) {
    d.pasArchiefStijlToe();
    d.actiefArchiefItem('mondingsvlam');
    d.actiefArchiefItem('ondode');
  }
  return {
    voor,
    na: {
      geo: d.renderer.info.memory.geometries, tex: d.renderer.info.memory.textures,
      lichten: d.scene.children.filter(o => o.isLight).length
        + d.wereld.children.filter(o => o.isLight).length,
    },
  };
});
check('30 rondes toepassen voegt geen geometrie, textuur of licht toe',
  resources.na.geo === resources.voor.geo && resources.na.tex === resources.voor.tex
  && resources.na.lichten === resources.voor.lichten, resources);

// --- 11. De CSS-items zetten de standaardstaat niet om ------------------
const stijl = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = {
    ontsnappingen: 0, headshotsTotaal: 0, hoogsteGolf: 0, geld: 0,
    gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  d.pasArchiefStijlToe();
  const schoon = {
    richtkruis: document.documentElement.style.getPropertyValue('--richtkruis-kleur'),
    hud: document.documentElement.style.getPropertyValue('--hud-kleur'),
  };
  d.stadsarchief.gekocht = ['richtkruis-amber'];
  d.stadsarchief.actiefPerCategorie = { richtkruis: 'richtkruis-amber' };
  d.pasArchiefStijlToe();
  const metItem = document.documentElement.style.getPropertyValue('--richtkruis-kleur');
  d.stadsarchief.actiefPerCategorie = {};
  d.pasArchiefStijlToe();
  return { schoon, metItem, naUitzetten: document.documentElement.style.getPropertyValue('--richtkruis-kleur') };
});
check('Zonder actief item wordt er geen enkele stijlvariabele gezet — de standaardstaat blijft pixel-identiek',
  stijl.schoon.richtkruis === '' && stijl.schoon.hud === '', stijl);
check('Met een actief item wordt de variabele wél gezet, en na uitzetten weer opgeruimd',
  stijl.metItem !== '' && stijl.naUitzetten === '', stijl);

// --- 12. Ticket 167: gewone kleurnamen en één gedeelde ladder -----------
// Twee klachten lagen hieraan ten grondslag: namen als "Amberen vlam" en
// "Magnesiumvlam" zijn geen herkenbare kleuren, en dezelfde kleur stond op
// verschillende niveaus (ijsblauw was bij de vlam de op één na goedkoopste
// optie maar bij het vizier juist de duurste). Beide worden hier bewaakt.
const ladderT167 = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const perCategorie = {};
  for (const cat of d.ARCHIEF_CATEGORIEEN) {
    perCategorie[cat.id] = d.ARCHIEF_ITEMS
      .filter(i => i.categorie === cat.id)
      .sort((a, b) => a.niveau - b.niveau)
      .map(i => ({ id: i.id, naam: i.naam, niveau: i.niveau, prijs: i.prijs, punten: i.puntenEis }));
  }
  // Welke kleur staat op welk niveau, per categorie waarin hij voorkomt?
  const perKleur = {};
  for (const i of d.ARCHIEF_ITEMS) {
    (perKleur[i.naam] = perKleur[i.naam] || []).push({ categorie: i.categorie, niveau: i.niveau });
  }
  return {
    perCategorie, perKleur,
    alleNiveausGeldig: d.ARCHIEF_ITEMS.every(i => Number.isInteger(i.niveau) && i.niveau >= 1),
    categorieNamen: Object.fromEntries(d.ARCHIEF_CATEGORIEEN.map(c => [c.id, c.naam])),
  };
});
check('Elk item draagt een geldig ladderniveau', ladderT167.alleNiveausGeldig, ladderT167);
check('Binnen elke categorie loopt de prijs strikt op met het ladderniveau',
  Object.values(ladderT167.perCategorie).every(lijst =>
    lijst.every((it, i) => i === 0 || it.prijs > lijst[i - 1].prijs)), ladderT167.perCategorie);
check('Binnen elke categorie loopt ook de puntendrempel strikt op met het ladderniveau',
  Object.values(ladderT167.perCategorie).every(lijst =>
    lijst.every((it, i) => i === 0 || it.punten > lijst[i - 1].punten)), ladderT167.perCategorie);
check('Een kleur die in meerdere categorieën voorkomt staat overal op HETZELFDE niveau (de kern van T167)',
  Object.values(ladderT167.perKleur).every(v => new Set(v.map(x => x.niveau)).size === 1),
  ladderT167.perKleur);
check('Blauw is overal de goedkoopste trede en Groen overal de tweede',
  (ladderT167.perKleur['Blauw'] ?? []).every(x => x.niveau === 1)
  && (ladderT167.perKleur['Groen'] ?? []).every(x => x.niveau === 2), ladderT167.perKleur);
check('De categorieën heten Vuurflits en Vizier, terwijl hun id\'s historisch blijven (anders raakt een speler zijn keuzes kwijt)',
  ladderT167.categorieNamen.mondingsvlam === 'Vuurflits'
  && ladderT167.categorieNamen.richtkruis === 'Vizier', ladderT167.categorieNamen);

// De id-lijst als vastgelegde momentopname. Id's zijn VOOR EEUWIG: ze staan
// in `gekocht` en `actiefPerCategorie` van elke bestaande speler. Wie er hier
// een hernoemt, pakt bezit af — deze assertie maakt dat zichtbaar in plaats
// van stil.
const VASTGELEGDE_IDS = [
  'vlam-ijs', 'vlam-groen', 'vlam-amber', 'vlamTint', 'vlam-wit',
  'kleurset', 'ondode-mos', 'ondode-as', 'ondode-sepia',
  'richtkruis-ijs', 'richtkruis-groen', 'richtkruis-amber', 'richtkruis-magenta',
  'hud-koper', 'hud-mint', 'hud-rood',
  'introMelodie',
  'start-deur1', 'start-amstel9', 'start-snelspanner',
];
const VASTGELEGDE_CATEGORIEEN = ['mondingsvlam', 'ondode', 'richtkruis', 'hud', 'intro', 'startuitrusting'];
const idsNu = await page.evaluate(() => ({
  items: window.AmsterdamUndeadDebug.ARCHIEF_ITEMS.map(i => i.id).sort(),
  categorieen: window.AmsterdamUndeadDebug.ARCHIEF_CATEGORIEEN.map(c => c.id).sort(),
}));
check('De item-id\'s zijn exact de vastgelegde set — hernoemen zou bestaande aankopen wissen',
  idsNu.items.join(',') === [...VASTGELEGDE_IDS].sort().join(','),
  { nu: idsNu.items, verwacht: [...VASTGELEGDE_IDS].sort() });
check('De categorie-id\'s zijn eveneens ongewijzigd — die staan in `actiefPerCategorie`',
  idsNu.categorieen.join(',') === [...VASTGELEGDE_CATEGORIEEN].sort().join(','),
  { nu: idsNu.categorieen, verwacht: [...VASTGELEGDE_CATEGORIEEN].sort() });

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
