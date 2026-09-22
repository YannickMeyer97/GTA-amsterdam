// Feedback-fixes ronde 20, gevonden door op een toestel te spelen:
// staande stand, knijpzoomen, en een eindscherm waarvan de knoppen buiten
// beeld vielen.
//
// WAT DEZE VIER GEMEEN HEBBEN. Geen van alle was zichtbaar in code of in een
// test — ze kwamen alle vier uit één speelsessie op een echte telefoon. Het
// patroon is telkens hetzelfde: een aanname over het scherm die op een laptop
// altijd waar is (het is breed, je kunt scrollen, niemand zoomt in) en op een
// telefoon niet. Deze test zet die aannames om in metingen.
import { openAmsterdamUndead, makeChecker } from '../helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead({ touch: true });
const { check, report } = makeChecker();

async function naarTouch() {
  await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true, get() { return null; },
    });
    d.zetBesturingModus('touch');
  });
}

/* --- 1. De zoom-afweer geldt ook op het STARTSCHERM ----------------------
   DE BUG: de klasse `touchModus` hing aan de zichtbaarheid van de knoppen,
   en die staan alleen tijdens het spelen aan. Op het startscherm gold
   `touch-action: none` dus niet en kon je vrij knijpzoomen; zodra het spel
   begon gold hij wél, en zat je vast in die zoom mét de helft van je
   knoppen buiten beeld. De klasse hoort bij de MODUS. */
const voorAanraking = await page.evaluate(() => ({
  klasse: document.documentElement.classList.contains('touchModus'),
  modus: window.AmsterdamUndeadDebug.besturingModus,
}));
check('In de muismodus staat de touch-klasse uit — zoomen blijft op desktop gewoon werken',
  voorAanraking.klasse === false && voorAanraking.modus === 'muis', voorAanraking);

/* --- 1b. Het draaischerm werkt al VÓÓR de eerste aanraking ---------------
   Feedback: "op verticale stand moet je eerst tikken voordat je het draaien
   ziet." DE BUG: staatToestelStaand() eiste besturingModus === 'touch', en
   die modus wordt bewust pas gezet bij de EERSTE ECHTE aanraking (zie
   zetBesturingModus — "detecteer invoer, niet apparaat"). Bij het laden,
   staand, zag een speler dus zijn normale layout tot hij per ongeluk ergens
   op tikte.

   Dit toetst het nieuwe, VROEGERE signaal: (pointer: coarse) and
   (hover: none), dat op een telefoon al bij het laden waar is — geverifieerd
   dat Playwrights `hasTouch`-optie dit ook daadwerkelijk meestuurt (anders
   zou deze check per ongeluk altijd slagen, ongeacht de fix). */
await page.setViewportSize({ width: 360, height: 740 });   // staand, vóór enige tik
const voorTikStaand = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.werkOrientatieBij();
  return {
    modus: d.besturingModus,
    coarseNoHover: window.matchMedia('(pointer: coarse) and (hover: none)').matches,
    isVermoedelijkTelefoon: d.isVermoedelijkTelefoon(),
    staand: d.staatToestelStaand(),
    draaischermZichtbaar: !document.getElementById('draaiScherm').hidden,
  };
});
check('Vóór enige aanraking is de modus nog "muis" — de detectie leunt dus NIET op besturingModus',
  voorTikStaand.modus === 'muis', voorTikStaand);
check('Het coarse/no-hover-signaal staat al aan zonder dat er getikt is (zoals op een echte telefoon)',
  voorTikStaand.coarseNoHover === true, voorTikStaand);
check('isVermoedelijkTelefoon() herkent dit al vóór de eerste tik',
  voorTikStaand.isVermoedelijkTelefoon === true, voorTikStaand);
check('Het draaischerm verschijnt dus al VOORDAT de speler ergens op tikt — dit was de klacht',
  voorTikStaand.staand === true && voorTikStaand.draaischermZichtbaar === true, voorTikStaand);

// Terug naar liggend, en verder met de rest van dit bestand zoals gepland.
await page.setViewportSize({ width: 640, height: 400 });
await page.evaluate(() => window.AmsterdamUndeadDebug.werkOrientatieBij());

await naarTouch();
const opStartscherm = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    klasse: document.documentElement.classList.contains('touchModus'),
    knoppenNogVerborgen: document.getElementById('touchBediening').hidden,
    spelActief: d.besturingActief(),
    touchActionHtml: getComputedStyle(document.documentElement).touchAction,
    touchActionBody: getComputedStyle(document.body).touchAction,
  };
});
check('Zodra je het scherm aanraakt geldt de zoom-afweer al, nog vóór het spel begint',
  opStartscherm.klasse === true && opStartscherm.touchActionHtml === 'none'
  && opStartscherm.touchActionBody === 'none', opStartscherm);
check('En dat gebeurt terwijl het spel nog niet loopt en de knoppen nog verborgen zijn — de klasse volgt de modus, niet de knoppen',
  opStartscherm.spelActief === false && opStartscherm.knoppenNogVerborgen === true, opStartscherm);

// De iOS-route: Safari negeert `user-scalable=no`, dus knijpen moet via de
// gesture-events geblokkeerd worden.
const gebaar = await page.evaluate(() => {
  const evt = new Event('gesturestart', { cancelable: true, bubbles: true });
  window.dispatchEvent(evt);
  return { geblokkeerd: evt.defaultPrevented };
});
check('Een knijpgebaar wordt in de touch-modus geblokkeerd (Safari negeert user-scalable=no)',
  gebaar.geblokkeerd === true, gebaar);

const gebaarMuis = await page.evaluate(() => {
  window.AmsterdamUndeadDebug.zetBesturingModus('muis');
  const evt = new Event('gesturestart', { cancelable: true, bubbles: true });
  window.dispatchEvent(evt);
  return { geblokkeerd: evt.defaultPrevented };
});
check('In de muismodus wordt een knijpgebaar NIET geblokkeerd — een trackpad-knijp blijft werken',
  gebaarMuis.geblokkeerd === false, gebaarMuis);

// De viewport-meta draagt de eerste laag; de CSS de tweede.
const viewport = await page.evaluate(() =>
  document.querySelector('meta[name="viewport"]').getAttribute('content'));
check('De viewport-meta verbiedt zoomen en laat de pagina tot in de hoeken lopen',
  /user-scalable\s*=\s*no/.test(viewport) && /maximum-scale\s*=\s*1/.test(viewport)
  && /viewport-fit\s*=\s*cover/.test(viewport), { viewport });

/* --- 2. Staand: pauzeren en erom vragen ---------------------------------- */
await naarTouch();
await page.setViewportSize({ width: 740, height: 360 });   // liggend
const liggend = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.startBesturing();
  d.werkOrientatieBij();
  return {
    staand: d.staatToestelStaand(),
    draaischermZichtbaar: !document.getElementById('draaiScherm').hidden,
    spelActief: d.besturingActief(),
  };
});
check('Liggend speelt het spel gewoon door en blijft het draaischerm weg',
  liggend.staand === false && liggend.draaischermZichtbaar === false
  && liggend.spelActief === true, liggend);

await page.setViewportSize({ width: 360, height: 740 });   // staand
await page.evaluate(() => window.AmsterdamUndeadDebug.werkOrientatieBij());
const staand = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const el = document.getElementById('draaiScherm');
  return {
    staand: d.staatToestelStaand(),
    draaischermZichtbaar: !el.hidden,
    tekst: el.textContent.replace(/\s+/g, ' ').trim(),
    spelActief: d.besturingActief(),
    zIndex: parseInt(getComputedStyle(el).zIndex, 10),
    dektHeleScherm: (() => {
      const r = el.getBoundingClientRect();
      return r.width >= window.innerWidth && r.height >= window.innerHeight;
    })(),
  };
});
check('Staand verschijnt het draaischerm', staand.staand === true && staand.draaischermZichtbaar === true, staand);
check('En het spel PAUZEERT — anders lopen de golven door achter dat scherm',
  staand.spelActief === false, staand);
check('Het draaischerm zegt met zoveel woorden wat je moet doen',
  /draai/i.test(staand.tekst) && /liggend/i.test(staand.tekst), staand);
check('Het dekt het hele scherm en ligt boven het startscherm, dus staand start je niets per ongeluk',
  staand.dektHeleScherm && staand.zIndex > 12, staand);

// Terugdraaien laat het scherm weer los (het spel blijft gepauzeerd — je
// tikt zelf om verder te gaan, net als bij elke andere pauze).
await page.setViewportSize({ width: 740, height: 360 });
await page.evaluate(() => window.AmsterdamUndeadDebug.werkOrientatieBij());
const terugGedraaid = await page.evaluate(() => ({
  draaischermZichtbaar: !document.getElementById('draaiScherm').hidden,
  spelActief: window.AmsterdamUndeadDebug.besturingActief(),
}));
check('Terugdraaien haalt het draaischerm weg en laat het spel gepauzeerd staan',
  terugGedraaid.draaischermZichtbaar === false && terugGedraaid.spelActief === false, terugGedraaid);

// Op een ECHTE desktop mag een smal venster NOOIT dit scherm oproepen.
// Dit toetst dat in een APARTE, niet-touch browsercontext: binnen de
// touch-context van de rest van dit bestand staat (pointer: coarse) vast
// door Playwrights `hasTouch`, dus zetBesturingModus('muis') alleen (de
// oude opzet van deze check) verandert dat signaal niet — die oude opzet
// zou met de nieuwe detectie altijd zijn blijven slagen, ook zonder de
// desktopcase echt te dekken.
const { browser: bMuis, page: pMuis } = await openAmsterdamUndead();
await pMuis.setViewportSize({ width: 360, height: 740 });
const smalleDesktop = await pMuis.evaluate(() => {
  window.AmsterdamUndeadDebug.werkOrientatieBij();
  return {
    coarseNoHover: window.matchMedia('(pointer: coarse) and (hover: none)').matches,
    draaischermZichtbaar: !document.getElementById('draaiScherm').hidden,
    staand: window.AmsterdamUndeadDebug.staatToestelStaand(),
  };
});
check('Een echte (niet-touch) desktopbrowser heeft het coarse/no-hover-signaal niet',
  smalleDesktop.coarseNoHover === false, smalleDesktop);
check('Een smal browservenster op een échte desktop krijgt geen draaischerm — daar bedien je met toetsen',
  smalleDesktop.draaischermZichtbaar === false && smalleDesktop.staand === false, smalleDesktop);
await bMuis.close();

/* --- 3. Het eindscherm past, of is te scrollen --------------------------
   DE BUG: de knoppen vielen buiten beeld en scrollen kon niet. Twee
   oorzaken: `overflow` stond niet aan, én `justify-content: center` maakt
   bij overloop ook de BOVENkant onbereikbaar. */
await page.setViewportSize({ width: 740, height: 360 });
await naarTouch();
const eindscherm = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.spelStaat.golf = 14;
  d.gameOver();
  const scherm = document.getElementById('gameOverScherm');
  const knop = document.getElementById('opnieuwKnop');
  const s = getComputedStyle(scherm);
  const kr = knop.getBoundingClientRect();
  return {
    schermZichtbaar: s.display !== 'none',
    scrollbaar: s.overflowY === 'auto' || s.overflowY === 'scroll',
    touchAction: s.touchAction,
    inhoudHoogte: scherm.scrollHeight,
    zichtbareHoogte: scherm.clientHeight,
    knop: { top: Math.round(kr.top), bottom: Math.round(kr.bottom), hoogte: Math.round(kr.height) },
    schermHoogte: window.innerHeight,
    // Hoever kun je scrollen, en is de knop dan te bereiken?
    maxScroll: scherm.scrollHeight - scherm.clientHeight,
  };
});
check('Het game-over-scherm is op een laag scherm scrollbaar',
  eindscherm.scrollbaar === true, eindscherm);
check('En dat scrollen wordt niet geblokkeerd door de touch-modus (touch-action laat verticaal toe)',
  /pan-y|auto/.test(eindscherm.touchAction), eindscherm);

// De echte toets: de knop volledig in beeld krijgen.
const knopBereikbaar = await page.evaluate(() => {
  const scherm = document.getElementById('gameOverScherm');
  scherm.scrollTop = scherm.scrollHeight;   // helemaal naar beneden
  const kr = document.getElementById('opnieuwKnop').getBoundingClientRect();
  const volledigZichtbaar = kr.top >= 0 && kr.bottom <= window.innerHeight;
  // En de titel bovenaan moet ook terug te scrollen zijn.
  scherm.scrollTop = 0;
  const hr = scherm.querySelector('h1').getBoundingClientRect();
  return {
    knopVolledigZichtbaar: volledigZichtbaar,
    knop: { top: Math.round(kr.top), bottom: Math.round(kr.bottom) },
    kopTop: Math.round(hr.top),
    schermHoogte: window.innerHeight,
  };
});
check('De knop "Opnieuw beginnen" is volledig te bereiken — dit was de klacht',
  knopBereikbaar.knopVolledigZichtbaar === true, knopBereikbaar);
check('En de titel bovenaan is ook bereikbaar (een gecentreerde flexbox snijdt die anders af)',
  knopBereikbaar.kopTop >= 0, knopBereikbaar);

/* --- 4. Fullscreen wordt geprobeerd, maar is nooit een eis -------------- */
const fullscreen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const el = document.documentElement;
  const origineel = el.requestFullscreen;
  let aanroepen = 0;
  // Doe alsof het toestel weigert — precies wat een iPhone doet.
  el.requestFullscreen = () => { aanroepen++; return Promise.reject(new Error('geweigerd')); };
  let klapte = false;
  try { d.probeerFullscreen(); } catch { klapte = true; }
  el.requestFullscreen = origineel;
  return { aanroepen, klapte };
});
check('Fullscreen wordt in de touch-modus aangevraagd',
  fullscreen.aanroepen === 1, fullscreen);
check('Een weigering laat niets klappen — zonder fullscreen speel je gewoon door',
  fullscreen.klapte === false, fullscreen);

const fullscreenMuis = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.zetBesturingModus('muis');
  const el = document.documentElement;
  const origineel = el.requestFullscreen;
  let aanroepen = 0;
  el.requestFullscreen = () => { aanroepen++; return Promise.resolve(); };
  d.probeerFullscreen();
  el.requestFullscreen = origineel;
  return { aanroepen };
});
check('Op desktop wordt fullscreen NIET afgedwongen — daar beslist de speler zelf',
  fullscreenMuis.aanroepen === 0, fullscreenMuis);

// De iPhone-route hangt aan meta-tags, niet aan een los manifestbestand
// (de één-bestand-regel uit CLAUDE.md laat dat laatste niet toe).
const appMeta = await page.evaluate(() => ({
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content ?? null,
  titel: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content ?? null,
  losManifest: !!document.querySelector('link[rel="manifest"][href]:not([href^="data:"])'),
}));
check('"Zet op beginscherm" start het spel als volledig scherm-app (Apple-meta, geen los bestand)',
  appMeta.capable === 'yes' && !!appMeta.titel && appMeta.losManifest === false, appMeta);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
