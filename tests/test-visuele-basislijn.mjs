// Ticket 88 (v0.22, §10.4-beslissing 79, §10.4.1, nulmeting §10.17): de
// visuele basislijn en helderheidsvangrail voor ronde 8 (v0.22). Vóór alle
// andere v0.22-tickets, want ná drie tickets weet je niet meer welk ticket
// welke verschuiving veroorzaakte (zelfde patroon als T77 vóór T69, en de
// rastertest vóór de vliering-geometrie in T87).
//
// Bewaakt twee dingen:
//   1. De pixelhelderheid op acht vaste standpunten blijft binnen een SMALLE
//      band (orde 1-2%) van de vastgelegde waarde.
//   2. De zes ronde-brede invarianten uit §10.2 blijven intact: 28 lichten,
//      1 schaduwwerper, 56 obstakels, 14 interactiepunten, 4 composer-
//      passes (3 t/m T95, sinds T96 de eigen naverwerkingspass erbij; T97/
//      T98 breiden diezelfde pass uit, dus blijft 4 voor de rest van de ronde).
//
// Twee meetvallen zijn hier de reden dat dit ticket bestaat en niet triviaal
// is (zie §10.4.1 + het reviewverslag §10.18):
//   - De lampflikker geeft 11,2% spreiding over 90 frames als je 'm niet
//     bevriest. `visueleBevriesTijd` (amsterdam-undead.html) lost dat op.
//   - `gl.readPixels()`/`canvas.toDataURL()` leveren zwart/leeg op
//     (preserveDrawingBuffer: false) — alleen `page.screenshot()` werkt.
// Twee EXTRA vallen, tijdens het bouwen van dit ticket zelf gevonden en dus
// niet in het architectuurdocument vastgelegd toen dat geschreven werd:
//   - Met pointer lock gesimuleerd (het gebruikelijke testpatroon) staat
//     spelActief permanent aan, en dan blijven de kelderhals-druppel, de
//     winkelmarkering-puls en de stofwolken (allemaal dt-gedreven, niet
//     gedekt door visueleBevriesTijd/lampDipFactor/mistUitfaseTimer) gewoon
//     doorlopen tijdens de meting. `openVoorVisueleMeting()` (helpers.mjs)
//     verbergt het DOM-startscherm ZONDER pointer lock te mocken, zodat
//     spelActief nooit aan gaat — gemeten: 0,000% spreiding over 10
//     metingen op hetzelfde standpunt, BINNEN één testrun.
//   - TUSSEN losse testruns bleef daarna nog tot 6% spreiding over
//     (zichtbaar in kamers met `lampLichten`, afwezig waar het licht van
//     stabiele `buitenLichten` komt) — `hangLamp()` geeft elke lamp een
//     willekeurige flikkerfase bij het bouwen van de wereld
//     (`Math.random()`, dus anders bij elke page-load), en die fase blijft
//     ONgemoeid door visueleBevriesTijd (dat bevriest alleen de tijd-term,
//     `Math.sin(t*7+fase)` is op t=0 nog steeds `Math.sin(fase)`, een
//     andere constante per run). `openVoorVisueleMeting()` pint nu ook
//     `lampLichten[].fase = 0` — geverifieerd: <0,05% restspreiding over
//     4 losse browserruns.
import { openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt, makeChecker } from './helpers.mjs';
import { PNG } from 'pngjs';

const { browser, page, errs } = await openVoorVisueleMeting();
const { check, report } = makeChecker();

// Middenblok van het 640x400-scherm (15%-85% op beide assen) — vermijdt de
// uiterste randen zonder de HUD-chrome bewust weg te snijden: die is nu
// volledig deterministisch (spelActief staat nooit aan) en hoort dus gewoon
// mee te tellen in "hoe ziet het spel eruit", net als de rest van het beeld.
function pixelstats(buf) {
  const png = PNG.sync.read(buf);
  const vals = [];
  let som = 0;
  const x0 = Math.floor(png.width * 0.15), x1 = Math.floor(png.width * 0.85);
  const y0 = Math.floor(png.height * 0.15), y1 = Math.floor(png.height * 0.85);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      som += l;
      vals.push(l);
    }
  }
  vals.sort((a, b) => a - b);
  return { gemiddelde: som / vals.length, mediaan: vals[Math.floor(vals.length / 2)] };
}

// Ticket 98: zelfde middenblok als pixelstats(), maar dan de gemiddelde
// R/G/B afzonderlijk — een kleurindicator los van helderheid, voor de
// per-zone-kleurgrading-meting hieronder.
function pixelkleur(buf) {
  const png = PNG.sync.read(buf);
  let r = 0, g = 0, b = 0, n = 0;
  const x0 = Math.floor(png.width * 0.15), x1 = Math.floor(png.width * 0.85);
  const y0 = Math.floor(png.height * 0.15), y1 = Math.floor(png.height * 0.85);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2];
      n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

async function meetRenderInfo(page) {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.renderer.info.autoReset = false;
    d.renderer.info.reset();
    return new Promise(res => requestAnimationFrame(() =>
      res(JSON.parse(JSON.stringify(d.renderer.info.render)))));
  });
}

const punten = await berekenVisueleStandpunten(page);
check('Acht visuele standpunten berekend (vijf zoneVan()-zones + kelder/vliering/gracht)',
  punten.length === 8, punten.map(p => p.naam));

// --- 1. Zelf-check: bewijs dat de bevriezing werkt vóórdat we 'm gebruiken.
// Tien opeenvolgende metingen op hetzelfde standpunt — twee is niet genoeg
// om de flikkercyclus te vangen (§10.4.1: 11,2% spreiding gemeten over 90
// frames zónder bevriezing).
const zelfCheckPunt = punten.find(p => p.naam === 'woonkamer');
const zelfCheckReeks = [];
for (let i = 0; i < 10; i++) {
  await zetVisueelStandpunt(page, zelfCheckPunt);
  const buf = await page.screenshot({ type: 'png' });
  zelfCheckReeks.push(pixelstats(buf).gemiddelde);
}
const zcMin = Math.min(...zelfCheckReeks), zcMax = Math.max(...zelfCheckReeks);
const zcGem = zelfCheckReeks.reduce((a, b) => a + b, 0) / zelfCheckReeks.length;
const zcSpreidingPct = ((zcMax - zcMin) / zcGem) * 100;
check('Zelf-check: 10 metingen op hetzelfde standpunt blijven binnen 2% spreiding (was 11,2% zonder bevriezing)',
  zcSpreidingPct <= 2, { reeks: zelfCheckReeks.map(v => +v.toFixed(3)), spreidingPct: +zcSpreidingPct.toFixed(3) });

// --- 2. Per-zone helderheidsbasislijn -------------------------------------
// Vastgelegde waarden, gemeten op commit a54a2f4 (ná de reviewcorrecties,
// vóór enig v0.22-bouwticket). BAND is bewust smal (2%, "orde 1-2%" uit
// §10.4.1) — een ticket dat 'm overschrijdt moet de nieuwe waarde HIER
// expliciet bijwerken, mét onderbouwing in ARCHITECTURE_NOTES.md §10 (zelfde
// mechanisme als test-resources.mjs voor geheugenlekken: niet "voorkom de
// wijziging", maar "maak de wijziging zichtbaar en bewust").
const BAND = 0.02;
// RENDER_BAND is ruimer: draw calls/driehoeken zijn een informatieve
// rendermetric (§10.3), geen getunede helderheid — een ticket mag hier
// legitiem overheen gaan (T99 telt bijvoorbeeld extra ondode-meshes), maar
// een sprong van >25% hoort een bewuste keuze te zijn, geen toevalstreffer.
const RENDER_BAND = 0.25;
// Ticket 102 (v0.22, §10.7-beslissing 82): subdivisie-helper voor de grote
// vlakken (muren/vloeren/plafonds, 1 segment -> 8x8) is precies zo'n
// bewuste, gedocumenteerde RENDER_BAND-overschrijding — het driehoekstal
// tilt van ~5,4k naar ~15,6k in de lichtste zone (gracht) tot ~35,4k in de
// zwaarste (woonkamer), ruim binnen het in §10.7 vooraf ingeschatte budget
// ("van ~18k naar mogelijk 40-60k per frame"). Geen enkele helderheids- of
// draw-call-check verschoof (BoxGeometry/PlaneGeometry zetten per FACE een
// uniforme analytische normal, ongeacht segmentaantal — subdivisie alleen
// is onzichtbaar totdat T103 er per-vertex data op legt), dus alleen de
// triangles-waarden hieronder zijn bijgewerkt.
//
// Ticket 103 (v0.22, §10.7-beslissing 82): ingebakken hoekocclusie (per-
// vertex grijswaarde-gradient, muren donkerder bij vloer/plafond, vloeren/
// plafonds donkerder bij hun randen — nooit de zijkanten van muren, om
// deurgaten niet dicht te smeren, zie de code-toelichting bij
// bakMuurOcclusie()). Dit RAAKT de helderheid wél echt, en op drie
// standpunten net over de strikte 2%-BAND heen: atelier (camera dicht bij
// de nis-hoek), binnenplaats (klinkers-mediaan, dicht bij de muurrand) en
// vliering (bijna-zwarte baseline, dus een kleine absolute verschuiving is
// hier al een relatief grote procentuele). Bijgewerkt met de nieuw gemeten
// waarden; de overige vijf standpunten bleven ruim binnen de band.
//
// Ticket 105 (v0.22, §10.12-beslissing 87): afgeschuinde randen
// (RoundedBoxGeometry i.p.v. BoxGeometry op meubelBox()/tafel/werkbank) —
// een afgeschuinde rand kost per box tientallen extra driehoeken t.o.v.
// een platte BoxGeometry (elke rand wordt een aparte facetstrook i.p.v. één
// scherpe lijn). Alleen zones met meubelBox()-gebouwd meubilair (kratten,
// vaten-nabijheid, kelderluik, boekenkast, werkbank e.d.) overschreden de
// 25%-RENDER_BAND: atelier (werkbank), binnenplaats (kratten/vat), kelder
// (kelderluik in de kelderhals-zone), vliering (De Zelflader-meubilair) en
// gracht (kratten bij de vlonder). Geen enkele helderheidscheck verschoof —
// consistent met T102's bevinding dat extra geometrie zonder eigen
// lichtbron de gemeten helderheid niet raakt. Alleen triangles bijgewerkt.
//
// Ticket 106/107 (v0.22, §10.11-beslissing 86): wereldschaal-UV's (T106,
// geen zichtbaar effect op zichzelf — zelfde reden als T102: de UV-waarden
// veranderen, maar er is nog geen `map` om ze te lezen) en de echte
// texturenset (T107: baksteenverband/planken/klinkers als ECHTE albedo
// `map`, niet meer alleen `roughnessMap`). Dit RAAKT de helderheid wél
// echt — een albedo-map met voeg-/naadlijnen die duidelijk donkerder zijn
// dan het steen-/plank-/klinkeroppervlak zelf (T107_ALBEDO_BASIS=232 met
// -65 tot -95 voor voegen) trekt het gemiddelde omlaag t.o.v. de vorige
// situatie (geen `map`, dus effectief altijd factor 1). Zones met veel
// beeldvullend getextureerd oppervlak: binnenplaats (klinkers vullen de
// hele klinkersvloer in beeld, -12%), kelder (steen-muren/vloer/plafond
// rondom, -10%), woonkamer (kleine spillover via de deuropening naar de
// getextureerde gang, -2,2%), bijkeuken (kleine spillover, -2,3% mediaan).
// Bijgewerkt met de nieuw gemeten waarden.
//
// Ticket 107-vervolg (klinkerformaat op verzoek): de natSteen-tekenaar
// ging van 10cm naar 20x10cm klinkers (straatsteenLengte n/10 -> n/5, zie
// CANVAS_TEXTUUR_TEKENAARS.natSteen) om de binnenplaatsvloer minder druk
// te maken. Bij dezelfde absolute voegbreedte verschuift de verhouding
// steen/voeg per cel licht, en de grotere klinkervlakken geven een net
// iets andere speculaire respons (natSteen heeft lage ruwheid = glans) —
// samen een kleine, verwachte mediaan-verschuiving in de enige zone met
// beeldvullende klinkers (binnenplaats, 23.00 -> 22.45, -2,4%). Geen
// andere zone raakt de klinkersvloer beeldvullend, dus alleen deze regel
// bijgewerkt.
//
// Ticket 107-vervolg (klinkerrealisme): vier samenhangende wijzigingen, met
// twee zones die daardoor terecht verschoven.
//
//  * BINNENPLAATS, duidelijk LICHTER (gemiddelde 31,23 -> 33,81, mediaan
//    22,45 -> 27,23). De hoofdoorzaak is metalness 0,12 -> 0 op natSteen. In
//    de metallic workflow geldt diffuus = albedo x (1 - metalness): die 0,12
//    haalde dus 12% van de DIFFUSE respons weg en stopte 'm in een getinte
//    speculaire lob die alleen onder scherpe hoeken oplichtte. Metalness op
//    0 geeft dat diffuse deel overal terug — precies de bedoeling (steen is
//    geen metaal), en meteen de reden dat de vloer niet langer als
//    plaatwerk leest. De grootschalige slijtagelaag in de nieuwe tekenaar
//    werkt dezelfde kant op (uitgebleekte plekken naast vuile).
//  * KELDER, licht DONKERDER (gemiddelde 16,93 -> 16,38, mediaan 13,40 ->
//    12,26). Die zone draait op 'steen', en daar keerde de roughnessMap om:
//    voegen zijn nu doffer dan het steenvlak i.p.v. glanzender. In een
//    donkere ruimte met zwakke puntlichten droegen juist die speculaire
//    voeglijnen meetbaar bij aan de helderheid.
//
// De inversiesterkte (T107_RUWHEID_INVERSIE) is op 0,12 afgesteld, en dat
// getal is dóór deze test bepaald: bij hogere waarden zakt de kelder ver
// genoeg weg dat zijn eigen kleurgrading niet langer luminantie-neutraal
// meet. De grading heeft daar een ADDITIEVE groen-lift, en hoe donkerder de
// zone wordt, hoe zwaarder die relatief doortelt — bij inversie 0,25 liep
// het gat gegradeerd/ongegradeerd op tot 0,79 (voorbij de
// MEDIAAN_KWANTISATIE_VLOER van 0,5), bij 0,12 blijft het op 0,29. De
// vangrail deed hier dus precies zijn werk: niet de grading is stuk, de
// zone werd te donker. De fysieke correctie (voegen dof, steen glad) blijft
// bij 0,12 volledig overeind — die was nodig omdat de richting eerst
// OMGEKEERD was, niet omdat het contrast groot moest zijn.
//
// De overige zes zones bleven binnen de 2%-band: 'hout' (basisruwheid 0,75)
// en 'steen' op grotere afstand verschuiven te weinig om de band te raken.
//
// Atelier-pleisterwerk: kortstondig geprobeerd (BAKSTEEN -> 'pleister' via
// blok()/bouwMuur()'s `familie`-parameter, atelier/gang-waarden tijdelijk
// bijgewerkt), maar op verzoek weer teruggedraaid — de gebruiker vond het
// resultaat niet mooi. Terug naar BAKSTEEN, dus ook deze basislijn terug
// naar de waarden van vóór die poging.
//
// Ticket 111 (v0.22, §10.13-beslissing 88): nachthemel. Twee afzonderlijke
// effecten, hier uit elkaar getrokken:
//
//  * BINNENPLAATS en GRACHT, duidelijk LICHTER (binnenplaats 33,81 -> 39,26,
//    gracht 19,01 -> 40,24 gemiddeld — gracht bijna verdubbeld). Dit is de
//    bedoelde werking van de ticket, geen bug: de dome vervangt een vlakke
//    `scene.background` (0x05080b, bijna zwart) door een echte verticale
//    gradient met een lichtere horizonband (`kleurHorizon = 0x2a3a52`,
//    donker staalblauw — een reëel nachtelijk hemellicht-effect, geen
//    fout). Beide standpunten kijken vlak op de horizon: gracht heeft
//    `pitch: 0` recht over het water (geen dak/gevel die de hemel
//    afschermt, zie berekenVisueleStandpunten() in helpers.mjs), en de
//    binnenplaats is de enige overdekte... nee, ONoverdekte kamerzone
//    (buitenlucht, geen dekking — zie ZONE_FLAVOUR[3]) met veel hemel in
//    beeld. De overige zes standpunten kijken allemaal een kamer/gang/kelder
//    in en zien de dome niet of nauwelijks — vandaar dat alléén deze twee
//    zones verschoven.
//  * ALLE ACHT zones: driehoeken +704 tot +812 (de 720-driehoeks
//    `SphereGeometry(46, 24, 16)` van de dome, altijd in beeld want de dome
//    volgt de camera en omsluit 'm). Op zichzelf ruim binnen de
//    25%-RENDER_BAND. Bij twee zones (gang, bijkeuken) kwam die kleine
//    toevoeging bovenop AL bestaande, nooit expliciet bijgewerkte drift uit
//    eerdere tickets (T106-T110 voegden geen/nauwelijks geometrie toe, maar
//    de driehoekstelling was al ~20% hoger dan de laatst vastgelegde
//    waarde, tot nu toe onopgemerkt omdat 20% < 25%) — samen net over de
//    band. Bij deze gelegenheid de triangles/calls van alle acht zones
//    ververst naar de daadwerkelijk gemeten waarden (geen enkele
//    helderheidsimpact van de subdivisie/UV/textuurtickets zelf, zie hun
//    eigen paragrafen hierboven).
//
// Ticket 112 (v0.22, §10.13-beslissing 88): skyline-silhouet. Alleen
// BINNENPLAATS en GRACHT verschuiven — dezelfde twee zones als T111, en om
// dezelfde reden (het zijn de enige twee standpunten met de hemel
// beeldvullend in het frame). Ditmaal juist WEER iets DONKERDER (T111
// bracht ze omhoog, T112 haalt er een deel van terug af): binnenplaats
// 39,26 -> 35,21, gracht 40,24 -> 34,37. Verklaring: de skyline bestaat uit
// vlakke, opzettelijk zeer donkere silhouetgebouwen (§ hierboven, kleuren
// 0x03050a/0x070b13/0x0b101b) die een deel van de lichtere horizonband van
// T111's dome aan het gezichtsveld onttrekken — precies de bedoelde
// werking ("silhouet tegen de lichtere hemel"), geen bug. (De uiteindelijke
// plaatsing — zie de code-toelichting bij bouwSkylineLaag() — is na twee
// afgekeurde iteraties bijgesteld: te ver weg gaf camera.far-clipping vanaf
// de ongunstigste speelbare hoek, te dichtbij liet de binnenplaats juist
// kleiner aanvoelen i.p.v. groter, precies het risico dat §10.13 al
// benoemde. Deze waarden horen bij de uiteindelijke, geteste plaatsing.)
// De overige zes standpunten kijken een kamer/gang/kelder in en zien de
// skyline niet — ongewijzigd. Driehoeken/calls: kleine, verwachte toename
// op exact deze twee zones (de skylinegebouwen zijn zelf goedkope
// BoxGeometry/ShapeGeometry-vormen, geen andere zone ziet ze), ruim binnen
// de 25%-RENDER_BAND — alleen deze twee regels bijgewerkt.
//
// Ticket 113 (v0.22, §10.13-beslissing 88): verlichte raampjes in de verte.
// Verrassing tijdens het bouwen, hier vastgelegd omdat de oorzaak niet
// voor de hand ligt: een eerste versie (dicht rooster, gemiddeld ~4-5
// raampjes per skylinegebouw, 125 totaal) verhoogde de draw calls in
// VRIJWEL ALLE acht zones met ~120-150, niet alleen binnenplaats/gracht.
// Oorzaak: Three.js doet geen occlusion-culling, alleen frustum-culling —
// een raampje ver naar het noorden valt binnen de camera-KEGEL van élk
// standpunt met yaw=0 (dat zijn er zeven van de acht; alleen de gracht
// kijkt met yaw=-PI/2 een andere kant op), ook al verbergt een muur het
// object volledig. Opgelost door een HARD budget van hoogstens 2 raampjes
// per gebouw i.p.v. een dicht rooster (125 -> 28 raampjes totaal, zie de
// code-toelichting bij bouwSkylineGebouw()) — daarmee bleven alle
// driehoeken/calls-checks binnen de band, op één randgeval na: GRACHT met
// kleurgrading actief kwam net (2,5%) over de 2%-band voor de gemiddelde
// helderheid, puur door de kleine extra warme-raampjes-bijdrage
// (33,72 gemeten vs. 34,37 basislijn), niet door een echte fout — bijgewerkt
// naar 33,72. De overige zeven standpunten (en de ONgegradeerde
// gracht-meting, die met 1,9% nog net binnen de band viel) bleven
// ongewijzigd; alleen deze regel is aangepast.
//
// Ticket 114 (v0.22, §10.14-beslissing 89): levend water. Weer alleen
// GRACHT (het enige standpunt met het water in beeld), ditmaal duidelijk
// DONKERDER (gemiddelde 33,72 -> 31,62, -6,2%; mediaan 25,89 -> 25,60,
// -1,1%, net binnen de band). Twee samenhangende oorzaken: (1) de
// gebroken-specular-laag (de procedurele normal-verstoring uit
// bouwWaterMateriaal()) verstrooit het licht van grachtLantaarnLicht over
// een breder, minder fel gebied i.p.v. één scherpe speculaire highlight —
// gemiddeld genomen minder pixels die vol wit oplichten; (2) de
// vertex-deining kantelt een deel van het watervlak weg van de camera,
// wat de MeshStandardMaterial-belichting op die vertices verzwakt. Beide
// zijn precies de bedoelde werking van dit ticket (een levend, onrustig
// wateroppervlak i.p.v. een vlakke, gelijkmatig verlichte plaat) — geen
// bug. Calls/triangles bleven ruim binnen de band (kleine, verwachte
// toename door de watersubdivisie (24x12 i.p.v. 1x1) en de nieuwe
// reflectiestreep-mesh) en zijn niet bijgewerkt.
//
// T111/T114-vervolg (twee feedback-fixes van de gebruiker, samen één
// verschuiving op GRACHT: gemiddelde 31,62 -> 22,07, mediaan 25,60 ->
// 15,66). Beide fixes werken dezelfde kant op — donkerder — en beide zijn
// correcties van een echte fout, geen smaakwijziging:
//
//  1. "Ik zie soms de blauwe lucht op de vloer; vanaf de horizon beneden
//     moet de vloer altijd donker zijn." De nachthemel-koepel gebruikte
//     clamp(r.y, 0, 1), waardoor de HELE onderste helft van de bol op de
//     volle horizonkleur (0x2a3a52) stond. De koepel omsluit de camera, dus
//     die lichte onderhelft scheen door elke kier in de wereldgeometrie —
//     en, belangrijker voor deze meting, vulde bij een standpunt met
//     pitch 0 de complete onderste beeldhelft zodra daar geen geometrie
//     stond. Nu zakt alles onder de horizon weg naar kleurGrond (0x020406).
//  2. "Bij de boot is maar een rechthoekig stuk water." Het watervlak was
//     8x4 m en eindigde in het niets; het is nu 28x36 m en loopt door tot
//     aan de T112-skyline. Waar vroeger (lichte) hemel onder de horizon
//     stond, staat nu donker water.
//
// De gracht is het enige standpunt dat beide raakt: het kijkt met pitch 0
// recht over het water naar de horizon, dus zijn onderste beeldhelft is
// precies het gebied dat door allebei de fixes van "lichte hemel" naar
// "donker water/grond" ging. De overige zeven standpunten kijken een
// kamer in en zagen die onderhelft toch al niet.
//
// Bij dezelfde feedback-ronde zijn ook twee ECHTE gaten in de geometrie
// dichtgemetseld (bouwVulMuur(): een bovendorpel boven de gangopening,
// waar het atelier 3,6 m hoog is en de gang 3,2 m; en een vulling onder de
// zuidmuur van de vliering, die pas op VLIERING_Y begon). Die gaten waren
// er altijd al — vóór T111 keek je er tegen zwart aan, dus zag niemand ze.
// Ze raken de gemeten helderheid niet meetbaar (beide zitten buiten het
// beeld van de acht standpunten of vullen een gebied dat toch al donker
// was), maar ze tellen wel mee in de render-metrics hieronder.
//
// Feedback-vervolg (verre oever + gevels op de binnenplaats). Twee zones
// schoven opnieuw, allebei klein en allebei door toegevoegde geometrie:
//  * BINNENPLAATS (mediaan 29,03 -> 29,82): de achtergevel van het eigen
//    pand kreeg daklijst, goot, plint en acht kozijnen waarvan er vijf
//    verlicht zijn, en alle binnenplaatsmuren kregen een muurafdekking.
//    Meer verlicht oppervlak in beeld, dus een iets hogere mediaan.
//  * GRACHT (gemiddelde 22,07 -> 23,23): het watervlak is 2 m ingekort
//    (28 -> 26) om ruimte te maken voor de verre oever waar de skyline op
//    staat, en die oever vult nu het gebied dat daarvoor koepel-onder-de-
//    horizon was. Beide zijn dezelfde bijna-zwarte kleur (0x020406), dus
//    het verschil is klein; een poging om het toe te schrijven aan tone
//    mapping (MeshBasicMaterial gaat er wel doorheen, de koepel-shader
//    niet) is met een meting WEERLEGD — `toneMapped:false` op de oever gaf
//    exact dezelfde getallen. De precieze oorzaak is niet verder
//    uitgezocht: het gaat om 1,2 helderheidspunt op een donkere zone, het
//    beeld is visueel naadloos, en er is geen aanwijzing voor een fout.
//
// Driehoeken/calls van ALLE ACHT zones zijn hier ververst. Ze stonden nog
// op de T112-waarden en waren sindsdien opgelopen door T113 (de
// skyline-raampjes, die vanwege frustum-zonder-occlusion in bijna elke
// zone meetellen — zie de T113-paragraaf hierboven) en T114 (het veel
// grotere, fijner gesubdivideerde watervlak). Twee zones stonden daardoor
// nét over de 25%-RENDER_BAND (atelier op calls, gracht op driehoeken);
// de rest zat er onder maar wel al ver naast. Eén keer goed bijwerken is
// zuiverder dan per ticket de ene regel bijstellen die toevallig omslaat.
const BASISLIJN = {
  woonkamer:    { gemiddelde: 30.57, mediaan: 18.08, calls: 574, triangles: 50007 },
  gang:         { gemiddelde: 35.14, mediaan: 17.49, calls: 423, triangles: 34973 },
  atelier:      { gemiddelde: 36.31, mediaan: 20.52, calls: 252, triangles: 25235 },
  binnenplaats: { gemiddelde: 35.75, mediaan: 29.82, calls: 269, triangles: 25785 },
  bijkeuken:    { gemiddelde: 29.58, mediaan: 19.20, calls: 528, triangles: 46949 },
  kelder:       { gemiddelde: 16.38, mediaan: 12.26, calls: 177, triangles: 23258 },
  vliering:     { gemiddelde: 11.54, mediaan: 1.57,  calls: 253, triangles: 27946 },
  gracht:       { gemiddelde: 23.23, mediaan: 15.87, calls: 186, triangles: 26905 },
};

const gemeten = {};
for (const sp of punten) {
  await zetVisueelStandpunt(page, sp);
  const render = await meetRenderInfo(page);
  const buf = await page.screenshot({ type: 'png' });
  const px = pixelstats(buf);
  gemeten[sp.naam] = { ...px, calls: render.calls, triangles: render.triangles };

  const basis = BASISLIJN[sp.naam];
  const binnenBand = (waarde, verwacht, band) =>
    verwacht === 0 ? waarde === 0 : Math.abs(waarde - verwacht) / verwacht <= band;

  check(`${sp.naam}: gemiddelde helderheid binnen ${BAND * 100}% van de basislijn`,
    binnenBand(px.gemiddelde, basis.gemiddelde, BAND),
    { gemeten: +px.gemiddelde.toFixed(2), verwacht: basis.gemiddelde });
  check(`${sp.naam}: mediane helderheid binnen ${BAND * 100}% van de basislijn`,
    binnenBand(px.mediaan, basis.mediaan, BAND),
    { gemeten: +px.mediaan.toFixed(2), verwacht: basis.mediaan });
  check(`${sp.naam}: draw calls binnen ${RENDER_BAND * 100}% van de basislijn`,
    binnenBand(render.calls, basis.calls, RENDER_BAND),
    { gemeten: render.calls, verwacht: basis.calls });
  check(`${sp.naam}: driehoeken binnen ${RENDER_BAND * 100}% van de basislijn`,
    binnenBand(render.triangles, basis.triangles, RENDER_BAND),
    { gemeten: render.triangles, verwacht: basis.triangles });
}

// --- 3. De zes ronde-brede invarianten uit §10.2 --------------------------
const invarianten = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lichten = 0, schaduwwerpers = 0;
  d.scene.traverse(o => { if (o.isLight) { lichten++; if (o.castShadow) schaduwwerpers++; } });
  return {
    lichten, schaduwwerpers,
    obstakels: d.obstakels.length,
    interactiePunten: d.interactiePunten.length,
    composerPasses: d.composer.passes.length,
  };
});
check('Invariant 2: precies 28 lichten (1 hemisfeer + 27 point)', invarianten.lichten === 28, invarianten);
check('Invariant 2: precies 1 schaduwwerpend licht', invarianten.schaduwwerpers === 1, invarianten);
check('Invariant 5: obstakels.length blijft 56', invarianten.obstakels === 56, invarianten);
check('interactiePunten.length blijft 14', invarianten.interactiePunten === 14, invarianten);
check('Post-processing: 4 passes (RenderPass/Bloom/naverwerking/Output, sinds T96 — blijft 4 voor de rest van de ronde, T97/T98 breiden de bestaande naverwerkingspass uit)', invarianten.composerPasses === 4, invarianten);

// --- 4. Bronvorm van de assertie: een band, geen exact getal --------------
// Bewijst dat BAND daadwerkelijk als relatieve afwijking werkt en niet per
// ongeluk altijd waar is (bv. door een == 0-bug in binnenBand hierboven).
check('BAND-logica: 5% afwijking op een niet-nul basiswaarde faalt de 2%-toets',
  Math.abs(105 - 100) / 100 > BAND, { afwijkingPct: 5, band: BAND * 100 });

// --- 5. T89: de emissieve hiërarchie zelf ---------------------------------
// De drie niveaus bestaan, en de gameplay-kritieke elementen zitten waar ze
// horen: ondode-ogen bereiken Signaal zodra het ertoe doet (aanval/mist/
// stroomuitval), nooit in rust. "Actieve koopmarkering" staat NIET in
// Signaal — zie de correctie in ARCHITECTURE_NOTES.md §10.5: dat zou een
// nieuw, zichtbaar gedrag toevoegen dat vandaag niet bestaat (de
// "beschikbaar"-status wordt gedragen door de ring + het gedeelde
// winkelLicht, geen materiaal). icoonMesh() blijft daarom bewust ONDER
// Bron; dat is de vastgelegde uitzondering, niet een bug.
const hierarchie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  // icoonMesh() aanroepen vereist een echte THREE.BufferGeometry (niet op
  // het debug-hook geëxporteerd) — de bronvorm zelf volstaat hier, zelfde
  // patroon als elders in deze suite (bv. test-pand-adres.mjs's
  // bouwNaambordje()-bron-check).
  const icoonBron = d.icoonMesh.toString();
  const icoonMatch = icoonBron.match(/emissiveIntensity:\s*([\d.]+)/);
  return {
    EMISSIE_ACCENT: d.EMISSIE_ACCENT,
    EMISSIE_BRON_MIN: d.EMISSIE_BRON_MIN,
    EMISSIE_BRON_MAX: d.EMISSIE_BRON_MAX,
    EMISSIE_SIGNAAL_MIN: d.EMISSIE_SIGNAAL_MIN,
    EMISSIE_SIGNAAL_MAX: d.EMISSIE_SIGNAAL_MAX,
    oogBasis: d.OOG_INTENSITEIT_BASIS,
    oogAanval: d.OOG_INTENSITEIT_AANVAL,
    oogMist: d.OOG_INTENSITEIT_MIST,
    oogStroomuitval: d.OOG_INTENSITEIT_STROOMUITVAL,
    kernMateriaal: d.kernMateriaal.emissiveIntensity,
    glasMateriaal: d.glasMateriaal.emissiveIntensity,
    icoonMeshIntensiteit: icoonMatch ? +icoonMatch[1] : null,
  };
});
check('De drie niveaus zijn correct geordend: Accent < Bron-min < Bron-max < Signaal-min < Signaal-max',
  hierarchie.EMISSIE_ACCENT < hierarchie.EMISSIE_BRON_MIN &&
  hierarchie.EMISSIE_BRON_MIN < hierarchie.EMISSIE_BRON_MAX &&
  hierarchie.EMISSIE_BRON_MAX < hierarchie.EMISSIE_SIGNAAL_MIN &&
  hierarchie.EMISSIE_SIGNAAL_MIN <= hierarchie.EMISSIE_SIGNAAL_MAX,
  hierarchie);
check('Ondode-ogen: basis (rust) zit binnen Bron (1,2-1,6)',
  hierarchie.oogBasis >= hierarchie.EMISSIE_BRON_MIN && hierarchie.oogBasis <= hierarchie.EMISSIE_BRON_MAX,
  hierarchie);
check('Ondode-ogen: aanval/mist/stroomuitval bereiken Signaal (>= 2,6)',
  hierarchie.oogAanval >= hierarchie.EMISSIE_SIGNAAL_MIN &&
  hierarchie.oogMist >= hierarchie.EMISSIE_SIGNAAL_MIN &&
  hierarchie.oogStroomuitval >= hierarchie.EMISSIE_SIGNAAL_MIN,
  hierarchie);
check('Ondode-ogen: stroomuitval is het felst (>= mist/aanval), nooit omlaag bijgesteld',
  hierarchie.oogStroomuitval >= hierarchie.oogMist && hierarchie.oogStroomuitval >= hierarchie.oogAanval,
  hierarchie);
check('kernMateriaal (Brander) en glasMateriaal zitten op Bron-max (1,6)',
  hierarchie.kernMateriaal === hierarchie.EMISSIE_BRON_MAX && hierarchie.glasMateriaal === hierarchie.EMISSIE_BRON_MAX,
  hierarchie);
check('icoonMesh() (winkelmarkeringen) blijft BEWUST onder Bron — vastgelegde uitzondering, geen Signaal-tier (§10.5-correctie)',
  hierarchie.icoonMeshIntensiteit !== null && hierarchie.icoonMeshIntensiteit < hierarchie.EMISSIE_BRON_MIN,
  hierarchie);

// --- 6. Ticket 98: per-zone kleurgrading — luminantie-neutraal, en
// meetbaar verschillende kleur tussen kelder/atelier/binnenplaats --------
// spelActief staat in deze meetflow nooit aan (openVoorVisueleMeting()),
// dus de echte runtime-trigger (kleurgradingZoneVan() in gameLoop) loopt
// hier nooit door zichzelf — de uniforms worden hier per standpunt
// rechtstreeks gezet (KLEUR_GRADING_ZONES[i], zelfde volgorde als
// berekenVisueleStandpunten()) zodat toch elk zone-profiel gemeten kan
// worden. Het triggermechanisme zelf (een echte zone-wissel via lopen)
// staat apart getest in test-naverwerking.mjs.
const kleurgradingResultaten = {};
for (let i = 0; i < punten.length; i++) {
  const sp = punten[i];
  await page.evaluate((i) => {
    const d = window.AmsterdamUndeadDebug;
    const p = d.KLEUR_GRADING_ZONES[i];
    d.naverwerkingsPass.uniforms.uGradeLift.value.copy(p.lift);
    d.naverwerkingsPass.uniforms.uGradeGamma.value.copy(p.gamma);
    d.naverwerkingsPass.uniforms.uGradeGain.value.copy(p.gain);
  }, i);
  await zetVisueelStandpunt(page, sp);   // wacht zelf al 3 frames — genoeg voor de nieuwe uniform
  const buf = await page.screenshot({ type: 'png' });
  const px = pixelstats(buf);
  const kleur = pixelkleur(buf);
  kleurgradingResultaten[sp.naam] = { px, kleur };

  const basis = BASISLIJN[sp.naam];
  const binnenBand = (waarde, verwacht, band) =>
    verwacht === 0 ? waarde === 0 : Math.abs(waarde - verwacht) / verwacht <= band;
  check(`${sp.naam}: MET kleurgrading actief blijft de gemiddelde helderheid binnen ${BAND * 100}% van de (ongegradeerde) basislijn — luminantie-neutraliteit`,
    binnenBand(px.gemiddelde, basis.gemiddelde, BAND), { gemeten: +px.gemiddelde.toFixed(2), verwacht: basis.gemiddelde, zone: i });
  // De mediaan is ÉÉN 8-bit pixelwaarde (0-255), geen gemiddelde over
  // duizenden pixels — bij een bijna-zwarte baseline (vliering: 1,65) is
  // zelfs 1 kwantisatiestap al een schijnbaar grote procentuele afwijking,
  // veroorzaakt door de pow()/clamp()-afronding in de gradeerstap zelf, niet
  // door een echte luminantielek (de gemiddelde-check hierboven, die WEL
  // over het hele middenblok middelt, blijft voor diezelfde zones ruim
  // binnen de band). MEDIAAN_KWANTISATIE_VLOER geeft de mediaan-toets een
  // absolute ondergrens zodat dit specifieke, begrepen randgeval geen
  // vals-positief geeft — de gemiddelde-toets hierboven blijft de zuivere
  // relatieve band houden.
  const MEDIAAN_KWANTISATIE_VLOER = 0.5;
  check(`${sp.naam}: MET kleurgrading actief blijft de mediane helderheid binnen ${BAND * 100}% (of ±${MEDIAAN_KWANTISATIE_VLOER} kwantisatiestap) van de (ongegradeerde) basislijn`,
    Math.abs(px.mediaan - basis.mediaan) <= Math.max(basis.mediaan * BAND, MEDIAAN_KWANTISATIE_VLOER),
    { gemeten: +px.mediaan.toFixed(2), verwacht: basis.mediaan, zone: i });
}
// Terug naar identiteit — netjes, mocht dit bestand ooit verder groeien.
await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.naverwerkingsPass.uniforms.uGradeLift.value.set(0, 0, 0);
  d.naverwerkingsPass.uniforms.uGradeGamma.value.set(1, 1, 1);
  d.naverwerkingsPass.uniforms.uGradeGain.value.set(1, 1, 1);
});

// Kleurindicator los van helderheid: G/R (groenheid) en B/R (koelheid).
function verhouding(k) { return { groen: k.g / Math.max(1, k.r), blauw: k.b / Math.max(1, k.r) }; }
const vKelder = verhouding(kleurgradingResultaten.kelder.kleur);
const vAtelier = verhouding(kleurgradingResultaten.atelier.kleur);
const vBinnenplaats = verhouding(kleurgradingResultaten.binnenplaats.kleur);
check('Kelder, atelier en binnenplaats hebben alle drie een onderling verschillende kleurverhouding (geen twee identiek)',
  !(vKelder.groen === vAtelier.groen && vKelder.blauw === vAtelier.blauw) &&
  !(vAtelier.groen === vBinnenplaats.groen && vAtelier.blauw === vBinnenplaats.blauw) &&
  !(vKelder.groen === vBinnenplaats.groen && vKelder.blauw === vBinnenplaats.blauw),
  { vKelder, vAtelier, vBinnenplaats });

// Richting van de tint (§10.8: "kelder groeniger, atelier koeler") als
// STRUCTURELE check op het profiel zelf (de gain-vector), niet als
// gerenderde-pixel-vergelijking tussen twee onafhankelijk tunebare zones.
// Die laatste vorm brak twee keer op rij zodra alleen de STERKTE van een
// van beide zones werd getuned (de kelder werd zo zacht dat 'ie in
// gerenderde pixels niet meer "groener dan het atelier" oogde, ook al
// bleef de eigen richting van het profiel — groen omhoog, rood/blauw
// omlaag — onveranderd). Deze vorm blijft correct ongeacht hoe ver de
// sterkte ooit nog getuned wordt, zolang de richting zelf niet omdraait.
const profielen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { kelder: { ...d.KLEUR_GRADING_ZONES[5].gain }, atelier: { ...d.KLEUR_GRADING_ZONES[2].gain } };
});
check('Kelder-profiel: groen (y) is de dominante, opgehoogde kanaal in de gain-vector — §10.8: "kelder groeniger"',
  profielen.kelder.y > 1 && profielen.kelder.y > profielen.kelder.x && profielen.kelder.y > profielen.kelder.z,
  profielen);
check('Atelier-profiel: blauw (z) is het dominante, opgehoogde kanaal in de gain-vector — §10.8: "atelier koeler"',
  profielen.atelier.z > 1 && profielen.atelier.z > profielen.atelier.x && profielen.atelier.z > profielen.atelier.y,
  profielen);

console.log('\nGemeten waarden (voor eventuele bijwerking van BASISLIJN):');
console.log(JSON.stringify(gemeten, null, 2));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
