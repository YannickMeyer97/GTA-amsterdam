// Ticket 178 (v0.34, ronde 20): de contextknop, de vaste actieknoppen en de
// besturingsuitleg die met de modus meeverandert.
//
// WAT HIER HET ECHTE RISICO IS. Twee dingen.
//
// 1. Een knop die iets ANDERS doet dan er op staat. De contextknop toont een
//    tekst ("forceer de deur") en voert een actie uit; staan die twee op
//    verschillende plekken in de code, dan lopen ze vroeg of laat uit elkaar
//    en koopt de speler iets anders dan hij leest. Daarom is er één functie
//    (`bepaalTouchContext`) voor beide, en toetst deze test dat de knop
//    letterlijk hetzelfde doet als de T-toets.
//
// 2. Tekst die niet meebeweegt. De hint-balk en het startscherm noemden
//    letterlijk WASD en de muis. Op een telefoon is dat een leugen, en dit is
//    precies het soort ding dat jarenlang blijft staan omdat geen enkele test
//    naar tekst kijkt. Vandaar dat het in het ticket een acceptatiecriterium
//    is, en hier een assertie.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ touch: true });
const { check, report } = makeChecker();

// Zelfde TouchEvent-hulp als test-touchbesturing.mjs: een echte TouchEvent
// met correct gevulde touches/targetTouches/changedTouches, verstuurd op een
// gekozen element (de knoppen hebben eigen listeners).
async function raakElement(selector, type, id = 1) {
  await page.evaluate(({ selector, type, id }) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const maak = () => new Touch({
      identifier: id, target: el, clientX: x, clientY: y, pageX: x, pageY: y,
    });
    const actief = type === 'touchend' ? [] : [maak()];
    el.dispatchEvent(new TouchEvent(type, {
      cancelable: true, bubbles: true,
      touches: actief, targetTouches: actief, changedTouches: [maak()],
    }));
  }, { selector, type, id });
}
const tik = async (selector) => {
  await raakElement(selector, 'touchstart');
  await raakElement(selector, 'touchend');
};

async function startTouchSessie() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true, get() { return null; },
    });
    d.zetBesturingModus('touch');
    d.startBesturing();
    d.laatTouchStickLos();
  });
}

// Zet de speler op een interactiepunt en werk de staat bij zoals de gameloop
// dat doet (updateInteracties eerst, dan de knoppen — die leest hij).
async function gaNaarPunt(puntNaam) {
  return page.evaluate((puntNaam) => {
    const d = window.AmsterdamUndeadDebug;
    const punt = d.interactiePunten.find(p => p.naam === puntNaam);
    if (!punt) return { gevonden: false };
    d.speler.positie.set(punt.positie.x, punt.positie.y ?? 0, punt.positie.z);
    d.updateInteracties();
    d.werkTouchActieknoppenBij();
    return {
      gevonden: true,
      inBereik: d.huidigeInteractie?.naam ?? null,
      ruw: d.huidigeInteractiePromptRuw,
      knopLabel: document.getElementById('touchContextLabel').textContent,
      knopUit: document.getElementById('touchContext').classList.contains('uit'),
      promptOpScherm: document.getElementById('interactiePrompt').textContent,
    };
  }, puntNaam);
}

// Ergens midden in het atelier, buiten elk interactiepunt.
async function gaWegVanPunten() {
  return page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    d.speler.positie.set(-3.5, 0, -6.5);
    d.updateInteracties();
    d.werkTouchActieknoppenBij();
    return {
      inBereik: d.huidigeInteractie?.naam ?? null,
      knopLabel: document.getElementById('touchContextLabel').textContent,
      knopUit: document.getElementById('touchContext').classList.contains('uit'),
      herladenKan: d.herladenMogelijk(),
    };
  });
}

/* --- 1. De prompt-conventie ---------------------------------------------
   De contextknop leunt op één afspraak die al in alle achttien prompts zat:
   "Druk T: " betekent uitvoerbaar, geen aanhef betekent mededeling. Die
   afspraak werd tot nu toe alleen geschreven, nooit gelezen — dus kon een
   nieuw interactiepunt 'm breken zonder dat iets het merkte. Deze check is
   de bewaking daarop. */
const conventie = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const uitvoerbaar = [], mededeling = [], leeg = [];
  for (const punt of d.interactiePunten) {
    const tekst = typeof punt.prompt === 'function' ? punt.prompt() : punt.prompt;
    if (typeof tekst !== 'string' || tekst.trim() === '') { leeg.push(punt.naam); continue; }
    (tekst.startsWith(d.INTERACTIE_AANHEF) ? uitvoerbaar : mededeling).push(punt.naam);
  }
  return { totaal: d.interactiePunten.length, uitvoerbaar, mededeling, leeg };
});
check('Elk interactiepunt levert een niet-lege prompt-tekst op',
  conventie.leeg.length === 0, conventie);
check('Elk interactiepunt volgt de "Druk T: "-conventie of is een expliciete mededeling — de contextknop leest die conventie',
  conventie.uitvoerbaar.length + conventie.mededeling.length === conventie.totaal
  && conventie.uitvoerbaar.length >= 10, conventie);

/* --- 2. Het ontleden en inkorten ----------------------------------------- */
const ontleed = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    actie: d.ontleedInteractiePrompt('Druk T: forceer de deur (€500)'),
    melding: d.ontleedInteractiePrompt('Canal Jug is al gedronken (MAX)'),
    nietString: d.ontleedInteractiePrompt(null),
    kortHaakje: d.kortInteractieLabel('forceer de deur (€500)'),
    kortStreep: d.kortInteractieLabel('Canal Jug — max HP verdubbelen (€2000)'),
    kortNiets: d.kortInteractieLabel('munitie bijvullen'),
    touchActie: d.touchPromptTekst('Druk T: forceer de deur (€500)'),
    touchMelding: d.touchPromptTekst('Canal Jug is al gedronken (MAX)'),
  };
});
check('Een "Druk T"-prompt wordt herkend als uitvoerbaar en de aanhef valt weg',
  ontleed.actie.uitvoerbaar === true && ontleed.actie.label === 'forceer de deur (€500)', ontleed);
check('Een mededeling is niet uitvoerbaar en blijft woord voor woord staan',
  ontleed.melding.uitvoerbaar === false && ontleed.melding.label === 'Canal Jug is al gedronken (MAX)', ontleed);
check('Een niet-string prompt kan het ontleden niet laten klappen',
  ontleed.nietString.uitvoerbaar === false && ontleed.nietString.label === '', ontleed);
check('Het knoplabel knipt bij de eerste bijzin — een volle prompt past niet op een knop',
  ontleed.kortHaakje === 'forceer de deur' && ontleed.kortStreep === 'Canal Jug'
  && ontleed.kortNiets === 'munitie bijvullen', ontleed);
check('De prompt op het scherm verwijst op touch naar de knop, niet naar een toets die daar niet bestaat',
  !/Druk T/.test(ontleed.touchActie) && /forceer de deur/.test(ontleed.touchActie)
  && ontleed.touchMelding === 'Canal Jug is al gedronken (MAX)', ontleed);

/* --- 3. De knop toont wat er nú kan -------------------------------------- */
await startTouchSessie();
const bijDeur = await gaNaarPunt('Deur');
check('Bij de deur staat de deur-actie op de contextknop, en de knop is actief',
  bijDeur.gevonden && bijDeur.inBereik === 'Deur'
  && /forceer de deur/i.test(bijDeur.knopLabel) && bijDeur.knopUit === false, bijDeur);
check('De volledige prompt (mét prijs) staat nog steeds op het scherm — de knop draagt alleen de kern',
  /€/.test(bijDeur.promptOpScherm) && !/€/.test(bijDeur.knopLabel), bijDeur);
check('De schermprompt noemt op touch geen T-toets meer',
  !/Druk T/.test(bijDeur.promptOpScherm), bijDeur);

/* --- 4. De knop DOET hetzelfde als de T-toets ----------------------------
   De gevaarlijkste variant van deze bug is een knop die iets anders koopt
   dan er op staat. Hier wordt de deur echt geforceerd door op de knop te
   tikken, en vergeleken met wat activeerHuidigeInteractie() doet. */
const deurGeld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 99999;
  return { geldVoor: d.spelStaat.geld, prijs: d.DEUR_PRIJS, open: d.deurMesh?.visible ?? null };
});
await tik('#touchContext');
const naTik = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { geldNa: d.spelStaat.geld, open: d.deurMesh?.visible ?? null };
});
check('Een tik op de contextknop voert de deur-aankoop echt uit — exact wat T zou doen',
  naTik.geldNa === deurGeld.geldVoor - deurGeld.prijs, { deurGeld, naTik });

/* --- 5. Geen punt in bereik: de knop valt terug op herladen -------------- */
const geenWapen = await gaWegVanPunten();
check('Zonder punt in bereik toont de knop "Herladen"', /herladen/i.test(geenWapen.knopLabel), geenWapen);
check('Zonder vuurwapen is herladen zinloos, dus de knop grijst uit',
  geenWapen.herladenKan === false && geenWapen.knopUit === true, geenWapen);

const metWapen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 99999;
  d.koopAmstel9();
  d.wapenStaat.magazijn = 1;          // niet vol, reserve genoeg
  d.updateInteracties();
  d.werkTouchActieknoppenBij();
  return {
    herladenKan: d.herladenMogelijk(),
    knopUit: document.getElementById('touchContext').classList.contains('uit'),
    magazijnVoor: d.wapenStaat.magazijn,
  };
});
check('Met een half leeg magazijn is de herlaadknop actief',
  metWapen.herladenKan === true && metWapen.knopUit === false, metWapen);

await tik('#touchContext');
const naHerlaadTik = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { herladenBezig: d.wapenStaat.herladen };
});
check('Een tik op de herlaadknop start echt een herlaadbeurt',
  naHerlaadTik.herladenBezig === true, naHerlaadTik);

const volMagazijn = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.herladen = false;
  d.wapenStaat.herlaadTimer = 0;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.updateInteracties();
  d.werkTouchActieknoppenBij();
  return {
    knopUit: document.getElementById('touchContext').classList.contains('uit'),
    label: document.getElementById('touchContextLabel').textContent,
  };
});
check('Een vol magazijn grijst de knop uit maar laat het label staan — hij verdwijnt niet',
  volMagazijn.knopUit === true && volMagazijn.label.trim() !== '', volMagazijn);

/* --- 6. Uitgegrijsd betekent: zelfde plek, zelfde maat, geen actie -------
   Een knop die onder je duim van plek of aanwezigheid wisselt is erger dan
   een inactieve — dan tik je de verkeerde. Dit meet dat letterlijk. */
const maatUit = await page.evaluate(() => {
  const el = document.getElementById('touchContext');
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), b: Math.round(r.width), h: Math.round(r.height),
    zichtbaar: getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' };
});
const maatAan = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.magazijn = 1;
  d.updateInteracties();
  d.werkTouchActieknoppenBij();
  const el = document.getElementById('touchContext');
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), b: Math.round(r.width), h: Math.round(r.height),
    uit: el.classList.contains('uit') };
});
check('Een uitgegrijsde knop blijft zichtbaar en behoudt exact dezelfde plek en maat',
  maatUit.zichtbaar && maatUit.x === maatAan.x && maatUit.y === maatAan.y
  && maatUit.b === maatAan.b && maatUit.h === maatAan.h, { maatUit, maatAan });

// En hij doet niets als je hem toch aantikt.
const doodTikken = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.magazijn = d.wapenStaat.magazijnMax;
  d.updateInteracties();
  d.werkTouchActieknoppenBij();
  return { magazijnVoor: d.wapenStaat.magazijn, herladenVoor: d.wapenStaat.herladen };
});
await tik('#touchContext');
const naDoodTikken = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { herladenNa: d.wapenStaat.herladen };
});
check('Een uitgegrijsde knop voert ook echt niets uit',
  doodTikken.herladenVoor === false && naDoodTikken.herladenNa === false, { doodTikken, naDoodTikken });

/* --- 7. De vaste knoppen: wapenwissel en mes ----------------------------- */
const wisselEen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.werkTouchActieknoppenBij();
  return {
    mogelijk: d.wisselWapenMogelijk(),
    uit: document.getElementById('touchWissel').classList.contains('uit'),
  };
});
check('Met één vuurwapen grijst de wisselknop uit — Q zou daar ook niets doen',
  wisselEen.mogelijk === false && wisselEen.uit === true, wisselEen);

const wisselTwee = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 99999;
  d.koopRatelaar();
  d.wapenStaat.herladen = false;
  d.werkTouchActieknoppenBij();
  return {
    mogelijk: d.wisselWapenMogelijk(),
    uit: document.getElementById('touchWissel').classList.contains('uit'),
    wapenVoor: d.actiefWapenNaam,
  };
});
check('Met twee vuurwapens wordt de wisselknop actief',
  wisselTwee.mogelijk === true && wisselTwee.uit === false, wisselTwee);

await tik('#touchWissel');
const naWissel = await page.evaluate(() => window.AmsterdamUndeadDebug.actiefWapenNaam);
check('Een tik op de wisselknop wisselt echt van wapen',
  naWissel !== wisselTwee.wapenVoor, { voor: wisselTwee.wapenVoor, na: naWissel });

const mesVoor = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.mesStaat.cooldownTimer = 0;
  d.werkTouchActieknoppenBij();
  return { uit: document.getElementById('touchMes').classList.contains('uit') };
});
check('Zonder cooldown is de mesknop actief', mesVoor.uit === false, mesVoor);
await tik('#touchMes');
const mesNa = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const cooldown = d.mesStaat.cooldownTimer;
  d.werkTouchActieknoppenBij();
  return { cooldown, uit: document.getElementById('touchMes').classList.contains('uit') };
});
check('Een tik op de mesknop steekt echt en zet de cooldown',
  mesNa.cooldown > 0, mesNa);
check('Tijdens de mes-cooldown grijst de knop uit',
  mesNa.uit === true, mesNa);

/* --- 8. Pauzeren zonder toetsenbord -------------------------------------- */
const pauzeVoor = await page.evaluate(() => window.AmsterdamUndeadDebug.besturingActief());
await tik('#touchPauze');
const pauzeNa = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { actief: d.besturingActief(), touchSessie: d.touchSessieActief };
});
check('Esc bestaat niet op een telefoon — de pauzeknop beëindigt de sessie wél',
  pauzeVoor === true && pauzeNa.actief === false && pauzeNa.touchSessie === false,
  { pauzeVoor, pauzeNa });

/* --- 9. Een actieknop start geen kijk-drag ------------------------------
   De knoppen liggen op de rechterhelft, precies waar slepen betekent
   "kijken". Zonder stopPropagation draait het beeld weg zodra je koopt. */
await startTouchSessie();
const dragTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.speler.yaw = 0; d.speler.pitch = 0;
  return { yawVoor: d.speler.yaw };
});
await raakElement('#touchMes', 'touchstart', 77);
const naKnopAanraking = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return { kijkVinger: d.touchKijkVinger, yaw: d.speler.yaw, stickVinger: d.touchStick.vinger };
});
await raakElement('#touchMes', 'touchend', 77);
check('Een duim op een actieknop start geen kijk-drag en steelt de stick niet',
  naKnopAanraking.kijkVinger === null && naKnopAanraking.stickVinger === null
  && naKnopAanraking.yaw === dragTest.yawVoor, { dragTest, naKnopAanraking });

/* --- 9c. De knoppen liggen nergens bovenop -------------------------------
   Bij de eerste opzet lag de contextknop over de HUD en de vuurknop over de
   munitieteller. Dat is op een screenshot meteen te zien maar in code niet,
   dus wordt het hier gewoon gemeten: alle zichtbare vaste UI-rechthoeken op
   een liggend telefoonformaat, en geen enkele mag elkaar raken of buiten
   beeld vallen. De HUD en de minimap zijn hier nog niet geschaald — dat is
   Ticket 179 — dus dit is meteen de ondergrens waar T179 niet onder mag. */
await page.setViewportSize({ width: 740, height: 360 });
await startTouchSessie();
const indeling = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.geld = 99999;
  const punt = d.interactiePunten.find(p => {
    const t = typeof p.prompt === 'function' ? p.prompt() : p.prompt;
    return typeof t === 'string' && t.startsWith(d.INTERACTIE_AANHEF);
  });
  d.speler.positie.set(punt.positie.x, punt.positie.y ?? 0, punt.positie.z);
  d.updateInteracties();
  d.werkTouchActieknoppenBij();
  const ids = ['touchVuur', 'touchMes', 'touchWissel', 'touchContext', 'touchPauze',
    'hudUI', 'menuLink', 'ammoUI', 'hulpUI', 'minimapUI', 'interactiePrompt'];
  const rects = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el || el.hidden) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    rects[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
  }
  const namen = Object.keys(rects);
  const botsingen = [];
  for (let i = 0; i < namen.length; i++) for (let j = i + 1; j < namen.length; j++) {
    const a = rects[namen[i]], b = rects[namen[j]];
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) botsingen.push(`${namen[i]} × ${namen[j]}`);
  }
  const buiten = namen.filter(n => rects[n][0] < 0 || rects[n][1] < 0
    || rects[n][2] > window.innerWidth || rects[n][3] > window.innerHeight);
  const knoppen = ['touchVuur', 'touchMes', 'touchWissel', 'touchContext', 'touchPauze'];
  return { rects, botsingen, buiten, alleKnoppenAanwezig: knoppen.every(k => k in rects) };
});
check('Alle vijf de touch-knoppen staan op het scherm bij een liggend telefoonformaat',
  indeling.alleKnoppenAanwezig, indeling.rects);
check('Geen enkel vast UI-element overlapt een ander op 740×360',
  indeling.botsingen.length === 0, indeling.botsingen);
check('Niets valt buiten beeld op 740×360', indeling.buiten.length === 0, indeling.buiten);

/* --- 9b. De muistekst overleeft een heen-en-weer -------------------------
   De muisvariant wordt bij het laden uit de HTML gelezen in plaats van
   overgetypt — bij het overtypen ging het meteen mis met de spaties rond de
   puntjes. Dit toetst de eigenschap die dat oplevert: na een rondje touch
   staat er BYTE VOOR BYTE weer wat er stond. */
const rondje = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('muis');
  const voor = document.getElementById('hulpUI').textContent;
  d.zetBesturingModus('touch');
  const tussen = document.getElementById('hulpUI').textContent;
  d.zetBesturingModus('muis');
  return { voor, tussen, na: document.getElementById('hulpUI').textContent };
});
check('De muis-hinttekst komt na een rondje touch byte voor byte terug',
  rondje.na === rondje.voor && rondje.tussen !== rondje.voor, rondje);

/* --- 10. De besturingsuitleg volgt de modus ------------------------------
   Het acceptatiecriterium uit het ticket: op touch mag er nergens meer WASD
   of "muis" staan, want die bestaan daar niet. */
const uitlegTouch = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('touch');
  return {
    hulp: document.getElementById('hulpUI').textContent,
    muisBlokVerborgen: document.getElementById('uitlegMuis').hidden,
    touchBlokZichtbaar: !document.getElementById('uitlegTouch').hidden,
    touchBlokTekst: document.getElementById('uitlegTouch').textContent,
    gevoeligheidKop: document.getElementById('gevoeligheidKop').textContent,
  };
});
check('De hint-balk noemt op touch geen WASD, muis, of toetsen meer',
  !/WASD/i.test(uitlegTouch.hulp) && !/\bmuis\b/i.test(uitlegTouch.hulp)
  && !/\bEsc\b/.test(uitlegTouch.hulp), uitlegTouch);
check('De hint-balk beschrijft op touch wél de echte bediening (slepen, vuur, knoppen)',
  /slepen/i.test(uitlegTouch.hulp) && /vuur/i.test(uitlegTouch.hulp)
  && /pauze/i.test(uitlegTouch.hulp), uitlegTouch);
check('Het startscherm wisselt van uitlegblok in plaats van er twee te tonen',
  uitlegTouch.muisBlokVerborgen === true && uitlegTouch.touchBlokZichtbaar === true, uitlegTouch);
check('Het touch-uitlegblok noemt geen WASD of losse toetsen',
  !/WASD/i.test(uitlegTouch.touchBlokTekst) && !/\bEsc\b/.test(uitlegTouch.touchBlokTekst)
  && !/\bmuis\b/i.test(uitlegTouch.touchBlokTekst), uitlegTouch);
check('Het kopje bij de gevoeligheidsslider heet op touch geen "Muisgevoeligheid" meer',
  /gevoeligheid/i.test(uitlegTouch.gevoeligheidKop) && !/muis/i.test(uitlegTouch.gevoeligheidKop),
  uitlegTouch);

/* --- 11. En de muismodus is onveranderd ---------------------------------- */
const uitlegMuis = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('muis');
  const canvas = d.renderer.domElement;
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true, get() { return canvas; },
  });
  // Een willekeurig punt dat nog een uitvoerbare prompt heeft — de Deur is
  // in sectie 4 al geforceerd en staat dan niet meer in de lijst.
  const punt = d.interactiePunten.find(p => {
    const t = typeof p.prompt === 'function' ? p.prompt() : p.prompt;
    return typeof t === 'string' && t.startsWith(d.INTERACTIE_AANHEF);
  });
  d.speler.positie.set(punt.positie.x, punt.positie.y ?? 0, punt.positie.z);
  d.updateInteracties();
  return {
    hulp: document.getElementById('hulpUI').textContent,
    muisBlokZichtbaar: !document.getElementById('uitlegMuis').hidden,
    touchBlokVerborgen: document.getElementById('uitlegTouch').hidden,
    gevoeligheidKop: document.getElementById('gevoeligheidKop').textContent,
    promptOpScherm: document.getElementById('interactiePrompt').textContent,
    ruw: d.huidigeInteractiePromptRuw,
    touchLaagUit: document.getElementById('touchBediening').hidden,
  };
});
check('In de muismodus staat de oude hint-tekst er woord voor woord nog',
  /WASD = lopen/.test(uitlegMuis.hulp) && /muis = kijken/.test(uitlegMuis.hulp)
  && /Esc = pauze/.test(uitlegMuis.hulp), uitlegMuis);
check('In de muismodus staat het oude uitlegblok op het startscherm',
  uitlegMuis.muisBlokZichtbaar === true && uitlegMuis.touchBlokVerborgen === true, uitlegMuis);
check('In de muismodus heet het kopje weer Muisgevoeligheid',
  uitlegMuis.gevoeligheidKop === 'Muisgevoeligheid', uitlegMuis);
check('In de muismodus is de schermprompt letterlijk ongewijzigd — inclusief "Druk T"',
  uitlegMuis.promptOpScherm === uitlegMuis.ruw && /^Druk T: /.test(uitlegMuis.promptOpScherm),
  uitlegMuis);
check('In de muismodus is de hele touch-laag (en dus elke actieknop) onzichtbaar',
  uitlegMuis.touchLaagUit === true, uitlegMuis);

// De herlaad- en wisselvoorwaarden zijn uit herladen()/wisselWapen() getrokken;
// dit toetst dat ze er niet naast zijn gaan lopen.
const eenBron = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.wapenStaat.herladen = false;
  d.wapenStaat.magazijn = 1;
  const kanVoor = d.herladenMogelijk();
  d.herladen();
  const bezig = d.wapenStaat.herladen;
  const kanNa = d.herladenMogelijk();
  return { kanVoor, bezig, kanNa };
});
check('herladenMogelijk() en herladen() blijven het eens: kan=true → start, daarna kan=false',
  eenBron.kanVoor === true && eenBron.bezig === true && eenBron.kanNa === false, eenBron);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
