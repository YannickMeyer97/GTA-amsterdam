// Ticket 168 (v0.29, ronde 15): het archiefpaneel leesbaar en af.
//
// WAAROM DIT BESTAND BESTAAT. T164 leverde 22 groene checks op terwijl het
// paneel in de praktijk onleesbaar was: zwarte tekst op een bijna-zwart
// paneel, contrast 1,05:1. Al die checks keken naar STRUCTUUR — bestaat het
// element, zit het op de juiste plek, draagt het de juiste klasse — en geen
// enkele naar de BEREKENDE eindtoestand. Dezelfde les als de
// `hidden`/`display:flex`-bug van T164 zelf, nu in omgekeerde richting.
//
// De contrastmeting hieronder is daarom geen bijzaak maar de kern van dit
// bestand: hij rekent de werkelijke tekstkleur uit (inclusief alpha en
// overgeërfde opacity), stapelt de achtergronden van alle voorouders op tot
// de eerste dekkende, en toetst de WCAG-ratio. Met het blote oog beoordelen
// is precies wat hier misging.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

// WCAG 2.1 AA voor gewone tekst.
const CONTRAST_EIS = 4.5;

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// Een realistische halverwege-staat waarin alle vier de toestanden voorkomen.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // Een speler met een stuk of tien runs achter de rug: genoeg punten om een
  // deel van de winkel open te hebben, te weinig geld om alles te kopen, en
  // de zwaarste items nog op slot. Zo komen alle vier de toestanden voor.
  // `golvenTotaal` is sinds T169 de puntenbron; `hoogsteGolf` staat er nog als
  // record naast en telt niet mee.
  d.stadsarchief = {
    ontsnappingen: 3, headshotsTotaal: 620, hoogsteGolf: 24, golvenTotaal: 180,
    geld: 940,
    gekocht: ['richtkruis-ijs', 'richtkruis-groen', 'hud-koper'],
    actiefPerCategorie: { richtkruis: 'richtkruis-groen', hud: 'hud-koper' },
    versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  d.zetArchiefPaneel(true);
});

// --- 1. Contrast: élk tekstelement in het paneel ------------------------
const contrast = await page.evaluate((eis) => {
  const ontleed = (kleur) => {
    const m = /rgba?\(([^)]+)\)/.exec(kleur);
    if (!m) return null;
    const d = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: d[0], g: d[1], b: d[2], a: d.length > 3 ? d[3] : 1 };
  };
  const over = (voor, achter) => ({          // `voor` over `achter` leggen
    r: voor.r * voor.a + achter.r * (1 - voor.a),
    g: voor.g * voor.a + achter.g * (1 - voor.a),
    b: voor.b * voor.a + achter.b * (1 - voor.a),
    a: 1,
  });
  // De werkelijke achtergrond: stapel voorouders op tot de eerste dekkende.
  const achtergrondVan = (el) => {
    const lagen = [];
    for (let n = el; n; n = n.parentElement) {
      const bg = ontleed(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0) {
        lagen.push(bg);
        if (bg.a >= 0.999) break;
      }
    }
    // Onderop ligt altijd de pagina zelf.
    let basis = ontleed(getComputedStyle(document.body).backgroundColor);
    if (!basis || basis.a < 0.999) basis = { r: 5, g: 7, b: 10, a: 1 };
    let uit = basis;
    for (let i = lagen.length - 1; i >= 0; i--) uit = over(lagen[i], uit);
    return uit;
  };
  const luminantie = ({ r, g, b }) => {
    const k = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b);
  };
  const ratio = (a, b) => {
    const [hoog, laag] = [luminantie(a), luminantie(b)].sort((x, y) => y - x);
    return (hoog + 0.05) / (laag + 0.05);
  };

  const resultaten = [];
  const paneel = document.getElementById('archiefPaneel');
  for (const el of paneel.querySelectorAll('*')) {
    // Alleen elementen met eigen zichtbare tekst (geen containers).
    const eigenTekst = [...el.childNodes]
      .filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (!eigenTekst) continue;
    const s = getComputedStyle(el);
    const tekst = ontleed(s.color);
    if (!tekst) continue;
    const bg = achtergrondVan(el);
    // Overgeërfde opacity blend de tekst óók richting de achtergrond.
    let opac = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      opac *= parseFloat(getComputedStyle(n).opacity);
    }
    const werkelijk = over({ ...tekst, a: tekst.a * opac }, bg);
    resultaten.push({
      wat: el.id || el.className || el.tagName,
      tekst: eigenTekst.slice(0, 28),
      kleur: s.color,
      ratio: +ratio(werkelijk, bg).toFixed(2),
    });
  }
  return {
    aantal: resultaten.length,
    slechtste: resultaten.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 4),
    onvoldoende: resultaten.filter(r => r.ratio < eis),
    bodyKleur: getComputedStyle(document.body).color,
    paneelKleur: getComputedStyle(document.getElementById('archiefPaneelBinnen')).color,
  };
}, CONTRAST_EIS);
check(`Er staat daadwerkelijk tekst in het paneel om te meten (${contrast.aantal} elementen)`,
  contrast.aantal >= 15, { aantal: contrast.aantal });
check(`Élk tekstelement in het paneel haalt minstens ${CONTRAST_EIS}:1 contrast tegen zijn échte achtergrond`,
  contrast.onvoldoende.length === 0, contrast);
// De regressie zélf, expliciet vastgelegd: het paneel mag zijn kleur niet
// van body erven, want die is zwart.
check('Het paneel zet zijn tekstkleur zelf en erft die niet van body (dát was de bug)',
  contrast.paneelKleur !== contrast.bodyKleur
  && contrast.paneelKleur !== 'rgb(0, 0, 0)', contrast);

// --- 2. Het kleurstaal komt uit de échte itemdata -----------------------
const stalen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ontleed = (kleur) => {
    const m = /rgba?\(([^)]+)\)/.exec(kleur);
    return m ? m[1].split(',').map(s => Math.round(parseFloat(s.trim()) * 1000) / 1000) : null;
  };
  const perItem = d.ARCHIEF_ITEMS.map(item => {
    const rij = document.querySelector(`.archiefRij[data-item="${item.id}"]`);
    const staal = rij?.querySelector('.archiefStaal');
    const verwacht = d.archiefItemKleur(item);
    let klopt = null;
    if (verwacht && staal) {
      // Zet de verwachte kleur op een los element en vergelijk de BEREKENDE
      // waarden — zo werkt zowel '#7fd4ff' als 'rgba(127,212,255,0.9)'.
      const proef = document.createElement('div');
      proef.style.background = verwacht;
      document.body.appendChild(proef);
      const a = ontleed(getComputedStyle(proef).backgroundColor);
      const b = ontleed(getComputedStyle(staal).backgroundColor);
      proef.remove();
      klopt = JSON.stringify(a) === JSON.stringify(b);
    }
    return {
      id: item.id,
      categorie: item.categorie,
      heeftStaal: !!staal,
      verwacht,
      kloptMetData: klopt,
      icoon: staal?.classList.contains('icoon') ? staal.textContent : null,
    };
  });
  return {
    alleRijenHebbenStaal: perItem.every(i => i.heeftStaal),
    metKleur: perItem.filter(i => i.verwacht),
    zonderKleur: perItem.filter(i => !i.verwacht),
    fout: perItem.filter(i => i.verwacht && i.kloptMetData !== true),
  };
});
check('Elke rij in de winkel draagt een staal (kleur of icoon)',
  stalen.alleRijenHebbenStaal, stalen);
check(`Elk gekleurd item toont exact de kleur die het item in het spel oplevert (${stalen.metKleur.length} items)`,
  stalen.metKleur.length >= 16 && stalen.fout.length === 0, stalen.fout);
check('Items zonder kleur (Intro, Startuitrusting) tonen een icoon in plaats van een leeg vlakje',
  stalen.zonderKleur.length > 0 && stalen.zonderKleur.every(i => !!i.icoon), stalen.zonderKleur);
// Het staal mag geen tweede waarheid worden: de kleurbron is de itemdata.
const kleurBron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const tekst = d.archiefItemKleur.toString();
  return {
    tekst,
    // Geen losse hexcodes in de functie — die zou een tweede tabel zijn.
    losseHex: (tekst.match(/#[0-9a-fA-F]{6}/g) ?? []),
    leestVelden: ['vlamKleur', 'ondodeTint', 'cssWaarde'].every(v => tekst.includes(v)),
  };
});
check('De staalkleur wordt uit de itemvelden gelezen, niet uit een tweede tabel met eigen kleurcodes',
  kleurBron.leestVelden && kleurBron.losseHex.length === 0, kleurBron);

// --- 3. De categoriekop blijft in beeld tijdens het scrollen ------------
const plakkend = await page.evaluate(() => {
  const lijst = document.getElementById('archiefWinkelLijst');
  const eerste = lijst.querySelector('.archiefCategorieKop');
  const stijl = getComputedStyle(eerste);
  const bg = getComputedStyle(eerste).backgroundColor;
  lijst.scrollTop = 0;
  const bovenVoor = eerste.getBoundingClientRect().top - lijst.getBoundingClientRect().top;
  // De eigenschap die ertoe doet is niet "de EERSTE kop blijft plakken" — die
  // schuift terecht weg zodra je zijn categorie voorbij bent — maar "er staat
  // altijd een kop bovenaan, dus je bent nooit kwijt waar je zit". Toets dat,
  // en op meerdere scrolldieptes, zodat de check niet afhangt van hoeveel
  // items er toevallig in de eerste categorie zitten.
  const koppen = [...lijst.querySelectorAll('.archiefCategorieKop')];
  // De HELE scrollrange aflopen in stapjes van 20px, niet een paar
  // steekproeven: het gat dat dit ticket blootlegde was maar ~5px scroll
  // breed en zat precies op de overgang tussen twee categorieën. Vier
  // willekeurige dieptes vinden zoiets alleen per ongeluk.
  const dieptes = [];
  for (let y = 0; y <= lijst.scrollHeight - lijst.clientHeight; y += 20) dieptes.push(y);
  const metingen = [];
  for (const diepte of dieptes) {
    lijst.scrollTop = diepte;
    const lijstBoven = lijst.getBoundingClientRect().top;
    // Bedekt er een kop de bovenrand van de lijst? Let op de nuance: "precies
    // op 0" is te streng. Een uitgaande kop wordt door de volgende omhoog
    // geduwd en staat dan even op een negatieve top — dat is correct
    // sticky-gedrag en visueel precies goed. Wat moet gelden is dat de
    // bovenrand nooit onbedekt is, want dán ben je kwijt waar je zit.
    const vastgeprikt = koppen.some(k => {
      const r = k.getBoundingClientRect();
      return r.top <= lijstBoven + 1 && r.bottom > lijstBoven;
    });
    metingen.push({ diepte, vastgeprikt, echtGescrold: lijst.scrollTop === diepte });
  }
  lijst.scrollTop = 0;
  return { positie: stijl.position, top: stijl.top, bg, bovenVoor, metingen };
});
check('De categoriekop is plakkend opgezet (position: sticky, top: 0)',
  plakkend.positie === 'sticky' && plakkend.top === '0px', plakkend);
check(`Op élke scrolldiepte bedekt een categoriekop de bovenrand van de lijst (${plakkend.metingen.length} standen getoetst)`,
  plakkend.metingen.filter(m => m.echtGescrold).every(m => m.vastgeprikt)
  && plakkend.metingen.filter(m => m.echtGescrold).length >= 10, {
    aantal: plakkend.metingen.length,
    onbedekt: plakkend.metingen.filter(m => m.echtGescrold && !m.vastgeprikt),
  });
// Zonder dekkende achtergrond schemeren de rijen door de kop heen.
check('De kop heeft een dekkende achtergrond, anders scrollen de rijen er zichtbaar doorheen',
  /^rgb\(/.test(plakkend.bg), plakkend);

// --- 4. De voortgangsbalk klopt met de werkelijke afstand --------------
const voortgang = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const punten = d.mijlpaalpunten();
  const rijen = [...document.querySelectorAll('.archiefRij')].map(rij => {
    const item = d.archiefItem(rij.dataset.item);
    const status = d.archiefItemStatus(item);
    const balk = rij.querySelector('.archiefVoortgang');
    const verwacht = status === d.ARCHIEF_STATUS_VERGRENDELD
      ? punten / item.puntenEis
      : status === d.ARCHIEF_STATUS_TEDUUR ? d.stadsarchief.geld / item.prijs : null;
    return {
      id: item.id, status,
      heeftBalk: !!balk,
      soort: balk ? (balk.classList.contains('geld') ? 'geld' : 'punten') : null,
      fractie: balk ? parseFloat(balk.dataset.fractie) / 100 : null,
      verwacht,
    };
  });
  return {
    metBalk: rijen.filter(r => r.heeftBalk),
    zonderBalk: rijen.filter(r => !r.heeftBalk),
    fout: rijen.filter(r => r.verwacht !== null
      && (!r.heeftBalk || Math.abs(r.fractie - r.verwacht) > 0.005)),
    balkBijAfgerond: rijen.filter(r => r.verwacht === null && r.heeftBalk),
    soortFout: rijen.filter(r => r.heeftBalk
      && r.soort !== (r.status === 'teDuur' ? 'geld' : 'punten')),
    randen: {
      niets: d.archiefVoortgangFractie(0, 500),
      halverwege: d.archiefVoortgangFractie(250, 500),
      precies: d.archiefVoortgangFractie(500, 500),
      erover: d.archiefVoortgangFractie(900, 500),
      geenDrempel: d.archiefVoortgangFractie(0, 0),
    },
  };
});
check('Elk item dat je nog niet kunt krijgen toont een voortgangsbalk',
  voortgang.metBalk.length > 0 && voortgang.fout.length === 0, voortgang);
check('Items die je wél kunt krijgen of al hebt tonen géén balk — geen loze versiering',
  voortgang.balkBijAfgerond.length === 0, voortgang.balkBijAfgerond);
check('De balk loopt van leeg naar vol en klemt netjes af (0 → 0,5 → 1, nooit boven 1)',
  voortgang.randen.niets === 0 && voortgang.randen.halverwege === 0.5
  && voortgang.randen.precies === 1 && voortgang.randen.erover === 1
  && voortgang.randen.geenDrempel === 1, voortgang.randen);

// --- 5. Geld en punten zijn ook zónder de tekst te onderscheiden -------
// Twee valuta die door elkaar lopen was de tweede klacht over dit paneel.
const valuta = await page.evaluate(() => {
  const kleurVan = (sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).backgroundColor : null;
  };
  const maak = (klasse) => {
    const houder = document.createElement('span');
    houder.className = `archiefVoortgang ${klasse}`;
    const balk = document.createElement('span');
    balk.className = 'archiefVoortgangBalk';
    houder.appendChild(balk);
    document.getElementById('archiefPaneelBinnen').appendChild(houder);
    const kleur = getComputedStyle(balk).backgroundColor;
    houder.remove();
    return kleur;
  };
  return {
    balkGeld: maak('geld'), balkPunten: maak('punten'),
    chipGeld: kleurVan('.beursChip.geld'), chipPunten: kleurVan('.beursChip.punten'),
    beursTekst: document.getElementById('archiefBeurs').textContent,
  };
});
check('De geld- en puntenbalk hebben elk een eigen kleur — het tekort is ook zonder de tekst te lezen',
  valuta.balkGeld !== valuta.balkPunten && !!valuta.balkGeld, valuta);
check('Saldo en punten staan als twee losse chips met elk hun eigen kleur',
  valuta.chipGeld !== valuta.chipPunten && !!valuta.chipGeld && !!valuta.chipPunten, valuta);
check('En het saldo is nog steeds gewoon af te lezen', /€/.test(valuta.beursTekst)
  && /punten/.test(valuta.beursTekst), valuta);

// --- 6. Presentatieticket: er is geen enkel getal aangeraakt -----------
// Dit is een OPMAAKticket. De verleiding om "meteen even" aan een prijs te
// draaien is precies wat scope creep is; deze momentopname sluit dat af.
// Ronde 16 (T169/T170) herijkte deze tabel op de gemeten representatieve run
// (golf 20, ~115 headshots, ontsnapt: 311 punten en €1273 per run). AMSTEL-9
// en Fast Hands wisselden daarbij van plek — het wapen op zak is nu de
// zwaarste trede. De id's bleven ongemoeid; alleen de ladder verschoof.
const CATALOGUS_MOMENTOPNAME = [
  'vlam-ijs:650:900', 'vlam-groen:800:1250', 'vlam-amber:900:1600',
  'vlamTint:1000:2000', 'vlam-wit:1500:2800',
  'kleurset:800:1000', 'ondode-mos:900:1400', 'ondode-as:1000:1800', 'ondode-sepia:1200:2400',
  'richtkruis-ijs:200:0', 'richtkruis-groen:300:150', 'richtkruis-amber:400:350',
  'richtkruis-magenta:500:550', 'richtkruis-wit:600:800',
  'hud-koper:600:800', 'hud-mint:800:1100', 'hud-rood:2500:2600',
  'introMelodie:1000:1500',
  'muziek-donker:1100:1700', 'muziek-gracht:1200:1900', 'muziek-spanning:1300:2100',
  'wapen-dof:1400:2300', 'wapen-scherp:1500:2500', 'wapen-diep:1600:2700',
  'start-deur1:8000:3400', 'start-snelspanner:10000:4000', 'start-amstel9:12000:4650',
];
const catalogus = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    nu: d.ARCHIEF_ITEMS.map(i => `${i.id}:${i.prijs}:${i.puntenEis}`),
    categorieIds: d.ARCHIEF_CATEGORIEEN.map(c => c.id),
  };
});
check('Geen enkele prijs, drempel of id is aangeraakt — dit ticket is puur opmaak',
  JSON.stringify(catalogus.nu) === JSON.stringify(CATALOGUS_MOMENTOPNAME), {
    verwacht: CATALOGUS_MOMENTOPNAME, gevonden: catalogus.nu,
  });

// --- 7. De vier toestanden blijven visueel onderscheidbaar (T162-eis) --
const toestanden = await page.evaluate(() => {
  const zichtbaar = (klasse) => {
    const rij = document.querySelector(`.archiefRij.${klasse}`);
    if (!rij) return null;
    const s = getComputedStyle(rij);
    return `${s.backgroundColor}|${s.borderLeftColor}|${s.color}`;
  };
  return {
    koopbaar: zichtbaar('koopbaar'), bezit: zichtbaar('bezit'),
    teDuur: zichtbaar('teDuur'), vergrendeld: zichtbaar('vergrendeld'),
  };
});
const handtekeningen = Object.values(toestanden);
check('Alle vier de toestanden komen in deze opzet voor',
  handtekeningen.every(v => v !== null), toestanden);
check('En elke toestand ziet er aantoonbaar anders uit dan de andere drie',
  new Set(handtekeningen).size === 4, toestanden);

// --- 8. Opruimen -------------------------------------------------------
await page.evaluate(() => {
  window.AmsterdamUndeadDebug.zetArchiefPaneel(false);
  localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY);
});

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
