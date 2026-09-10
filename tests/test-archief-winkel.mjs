// Ticket 162 (v0.27, ronde 13): de winkel in het startscherm.
//
// Twee eisen staan hier centraal, en allebei komen ze uit een eerdere fout:
//
//  * ALLES IS ZICHTBAAR. Bij een leeg archief moet élk item al in beeld
//    staan, mét prijs en met wat je moet doen om het te ontgrendelen. Een
//    vergrendeld item toont "nog N punten", geen grijs vakje met een slotje.
//    Dat is de directe les uit het vervallen T158 deel B: wat je niet kunt
//    zien, streef je niet na.
//  * DE KLIK MAG HET SPEL NIET STARTEN. Het startscherm is ook het
//    pauzescherm, en de overlay heeft een click-listener die pointer lock
//    aanvraagt. Zonder stopPropagation start elke aankoop dus het spel —
//    exact de valkuil waar T159 tegenaan liep.
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// Zet een archiefstaat neer en teken de winkel opnieuw.
async function zetArchief(opzet) {
  return page.evaluate((opzet) => {
    const d = window.AmsterdamUndeadDebug;
    d.stadsarchief = {
      ontsnappingen: opzet.ontsnappingen ?? 0,
      headshotsTotaal: opzet.headshots ?? 0,
      hoogsteGolf: opzet.golf ?? 0,
      geld: opzet.geld ?? 0,
      gekocht: opzet.gekocht ?? [],
      actiefPerCategorie: opzet.actief ?? {},
      versie: d.ARCHIEF_VERSIE,
      actief: { kleurset: false, vlamTint: false, introMelodie: false },
    };
    d.tekenArchiefWinkel();
    return d.mijlpaalpunten();
  }, opzet);
}

// --- 1. Bij een LEEG archief staat de hele catalogus al in beeld ---------
const vers = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const rijen = [...document.querySelectorAll('#archiefWinkelLijst .archiefRij')];
  const teksten = Object.fromEntries(rijen.map(r => [r.dataset.item, r.textContent]));
  return {
    aantalRijen: rijen.length,
    aantalItems: d.ARCHIEF_ITEMS.length,
    alleIdsAanwezig: d.ARCHIEF_ITEMS.every(i => rijen.some(r => r.dataset.item === i.id)),
    // Elke categorie krijgt een kop, zodat 20+ items gegroepeerd blijven.
    aantalKoppen: document.querySelectorAll('#archiefWinkelLijst .archiefCategorieKop').length,
    aantalCategorieen: d.ARCHIEF_CATEGORIEEN.length,
    teksten,
    beurs: document.getElementById('archiefBeurs').textContent,
    uitleg: document.getElementById('archiefWinkelUitleg').textContent,
  };
});
await zetArchief({});
check('Bij een leeg archief staat élk catalogus-item al in de winkel — niets is verborgen',
  vers.aantalRijen === vers.aantalItems && vers.alleIdsAanwezig, vers);
check('De items zijn per categorie gegroepeerd (één kop per categorie)',
  vers.aantalKoppen === vers.aantalCategorieen, vers);
check('Saldo én punten staan in beeld', /€/.test(vers.beurs) && /punten/.test(vers.beurs), vers);
check('De uitleg vertelt hoe je béíde valuta verdient (ontsnappen voor geld, elke run voor punten)',
  /ONTSNAPPEN/.test(vers.uitleg) && /punt/i.test(vers.uitleg), vers);

// --- 2. Een vergrendeld item toont zijn drempel, geen leegte ------------
const vergrendeld = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const rijen = [...document.querySelectorAll('#archiefWinkelLijst .archiefRij.vergrendeld')];
  return {
    aantal: rijen.length,
    allemaalMetDrempel: rijen.every(r => /nog \d+ punten/.test(r.textContent)),
    voorbeeld: rijen.length ? rijen[0].textContent : null,
    // Een vergrendeld item mag geen koopknop hebben.
    geenKoopknop: rijen.every(r => !r.querySelector('[data-koop]')),
  };
});
check('Elk vergrendeld item toont concreet hoeveel punten je nog tekortkomt',
  vergrendeld.aantal > 0 && vergrendeld.allemaalMetDrempel, vergrendeld);
check('Een vergrendeld item heeft geen koopknop', vergrendeld.geenKoopknop, vergrendeld);

// --- 3. De vier toestanden zijn per item correct én zichtbaar anders ----
await zetArchief({ ontsnappingen: 4, headshots: 400, golf: 26, geld: 300, gekocht: ['richtkruis-amber'] });
const toestanden = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const perStatus = {};
  for (const rij of document.querySelectorAll('#archiefWinkelLijst .archiefRij')) {
    const item = d.archiefItem(rij.dataset.item);
    const verwacht = d.archiefItemStatus(item);
    perStatus[verwacht] = perStatus[verwacht] || [];
    perStatus[verwacht].push({
      id: rij.dataset.item,
      heeftKlasse: rij.classList.contains(verwacht),
      heeftKoopknop: !!rij.querySelector('[data-koop]'),
      heeftZetknop: !!rij.querySelector('[data-zet]'),
      tekst: rij.textContent,
    });
  }
  return perStatus;
});
const alleStatussen = Object.keys(toestanden);
check('Alle vier de toestanden komen in deze opzet voor (vergrendeld, te duur, koopbaar, in bezit)',
  alleStatussen.length === 4, { gevonden: alleStatussen });
check('Elke rij draagt de klasse van zijn eigen toestand, dus de vier zijn visueel te onderscheiden',
  Object.values(toestanden).flat().every(r => r.heeftKlasse), toestanden);
check('Alleen koopbare items hebben een koopknop; alleen items in bezit hebben een aan/uit-knop',
  (toestanden.koopbaar ?? []).every(r => r.heeftKoopknop && !r.heeftZetknop)
  && (toestanden.bezit ?? []).every(r => r.heeftZetknop && !r.heeftKoopknop)
  && (toestanden.teDuur ?? []).every(r => !r.heeftKoopknop && !r.heeftZetknop), toestanden);
check('Een te duur item toont hoeveel geld er nog nodig is',
  (toestanden.teDuur ?? []).every(r => /nog €\d+ nodig/.test(r.tekst)), toestanden.teDuur);

// --- 4. Kopen: exact één keer afboeken, en het overleeft een herladen ---
const koop = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief.geld = 1000;
  d.tekenArchiefWinkel();
  const item = d.archiefItem('vlam-ijs');
  const voor = d.stadsarchief.geld;
  const rij = document.querySelector('#archiefWinkelLijst .archiefRij[data-item="vlam-ijs"] [data-koop]');
  rij.click();
  const naEen = { geld: d.stadsarchief.geld, bezit: d.stadsarchief.gekocht.includes('vlam-ijs') };
  // Nog een keer proberen: het item is nu bezit, dus er is geen koopknop meer
  // en een directe aanroep moet ook weigeren (geen dubbele afboeking).
  const nogmaals = d.koopArchiefItem('vlam-ijs');
  return {
    voor, prijs: item.prijs, naEen,
    naTweede: d.stadsarchief.geld,
    nogmaalsGeweigerd: nogmaals === false,
    opgeslagen: JSON.parse(localStorage.getItem(d.STADSARCHIEF_KEY)),
    aantalKeerInLijst: d.stadsarchief.gekocht.filter(x => x === 'vlam-ijs').length,
  };
});
check('Een klik op de koopknop boekt exact de prijs af en zet het item in bezit',
  koop.naEen.geld === koop.voor - koop.prijs && koop.naEen.bezit, koop);
check('Een tweede aankoop van hetzelfde item wordt geweigerd — nooit dubbel afboeken',
  koop.nogmaalsGeweigerd && koop.naTweede === koop.naEen.geld && koop.aantalKeerInLijst === 1, koop);
check('De aankoop is meteen naar localStorage geschreven, dus hij overleeft een herladen',
  koop.opgeslagen.gekocht.includes('vlam-ijs') && koop.opgeslagen.geld === koop.naEen.geld, koop);

// Echt herladen en opnieuw inlezen.
await page.reload();
await page.waitForFunction(() => !!window.AmsterdamUndeadDebug);
const naHerladen = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  return {
    bezit: d.stadsarchief.gekocht.includes('vlam-ijs'),
    geld: d.stadsarchief.geld,
    rijBestaat: !!document.querySelector('#archiefWinkelLijst .archiefRij[data-item="vlam-ijs"]'),
  };
});
check('Na een échte herlaad staat het gekochte item er nog, met het bijgewerkte saldo',
  naHerladen.bezit && naHerladen.rijBestaat, naHerladen);

// --- 5. Aan/uit werkt zonder herladen, en past meteen toe --------------
const aanUit = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief.gekocht = ['richtkruis-amber'];
  d.stadsarchief.actiefPerCategorie = {};
  d.tekenArchiefWinkel();
  const knopUit = document.querySelector('.archiefRij[data-item="richtkruis-amber"] [data-zet]');
  const cssVoor = document.documentElement.style.getPropertyValue('--richtkruis-kleur');
  knopUit.click();
  const cssNa = document.documentElement.style.getPropertyValue('--richtkruis-kleur');
  const actiefNa = d.actiefArchiefItem('richtkruis')?.id;
  // En weer uit.
  document.querySelector('.archiefRij[data-item="richtkruis-amber"] [data-zet]').click();
  return {
    cssVoor, cssNa, actiefNa,
    cssTerug: document.documentElement.style.getPropertyValue('--richtkruis-kleur'),
    actiefTerug: d.actiefArchiefItem('richtkruis'),
  };
});
check('Aanzetten werkt zonder herladen en past de stijl meteen toe',
  aanUit.cssVoor === '' && aanUit.cssNa !== '' && aanUit.actiefNa === 'richtkruis-amber', aanUit);
check('Uitzetten draait dat weer terug', aanUit.cssTerug === '' && aanUit.actiefTerug === null, aanUit);

// --- 6. Startuitrusting: exclusief, en dat is VÓÓR de klik te lezen ----
const startExclusief = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const startItems = d.ARCHIEF_ITEMS.filter(i => i.soort === d.ARCHIEF_SOORT_START);
  d.stadsarchief.gekocht = startItems.map(i => i.id);
  d.stadsarchief.actiefPerCategorie = {};
  d.tekenArchiefWinkel();
  const waarschuwingVooraf = document.querySelector('#archiefWinkelLijst .archiefWaarschuwing')?.textContent ?? '';
  // Eerste aanzetten.
  document.querySelector(`.archiefRij[data-item="${startItems[0].id}"] [data-zet]`).click();
  const naEerste = d.actieveStartuitrusting()?.id;
  const waarschuwingNa = document.querySelector('#archiefWinkelLijst .archiefWaarschuwing')?.textContent ?? '';
  // Tweede aanzetten moet de eerste vervangen, niet stapelen.
  document.querySelector(`.archiefRij[data-item="${startItems[1].id}"] [data-zet]`).click();
  return {
    waarschuwingVooraf, waarschuwingNa,
    naEerste,
    naTweede: d.actieveStartuitrusting()?.id,
    aantalActiefInOpslag: Object.keys(d.stadsarchief.actiefPerCategorie)
      .filter(c => c === 'startuitrusting').length,
    eerste: startItems[0].id, tweede: startItems[1].id,
    eersteNaam: startItems[0].naam,
  };
});
check('De exclusiviteit staat er VÓÓR de eerste klik al bij (niet pas als reactie achteraf)',
  /maar één tegelijk/i.test(startExclusief.waarschuwingVooraf), startExclusief);
check('Zodra er één aanstaat, noemt de winkel welke dat is',
  startExclusief.waarschuwingNa.includes(startExclusief.eersteNaam), startExclusief);
check('Een tweede startuitrusting aanzetten VERVANGT de eerste in plaats van te stapelen',
  startExclusief.naEerste === startExclusief.eerste
  && startExclusief.naTweede === startExclusief.tweede
  && startExclusief.aantalActiefInOpslag === 1, startExclusief);
check('De winkel meldt dat startuitrusting pas bij een nieuwe run ingaat',
  /nieuwe run/i.test(startExclusief.waarschuwingNa), startExclusief);

// --- 7. Een klik in de winkel start het spel NIET ----------------------
const geenStart = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  let lockAangevraagd = 0;
  const orig = d.renderer.domElement.requestPointerLock;
  d.renderer.domElement.requestPointerLock = () => { lockAangevraagd++; };
  d.stadsarchief.geld = 5000;
  d.stadsarchief.gekocht = [];
  d.stadsarchief.actiefPerCategorie = {};
  d.tekenArchiefWinkel();
  // Een koopklik...
  document.querySelector('#archiefWinkelLijst [data-koop]')?.click();
  // ...en een aan/uit-klik.
  d.tekenArchiefWinkel();
  document.querySelector('#archiefWinkelLijst [data-zet]')?.click();
  d.renderer.domElement.requestPointerLock = orig;
  return { lockAangevraagd };
});
check('Klikken in de winkel vraagt géén pointer lock aan — het spel start dus niet (stopPropagation werkt)',
  geenStart.lockAangevraagd === 0, geenStart);

// --- 8. Sortering: het eerstvolgende haalbare item staat bovenaan ------
const sortering = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  d.stadsarchief = {
    ontsnappingen: 2, headshotsTotaal: 200, hoogsteGolf: 20, geld: 300,
    gekocht: [], actiefPerCategorie: {}, versie: d.ARCHIEF_VERSIE,
    actief: { kleurset: false, vlamTint: false, introMelodie: false },
  };
  d.tekenArchiefWinkel();
  const volgorde = {};
  for (const cat of document.querySelectorAll('#archiefWinkelLijst .archiefCategorie')) {
    const kop = cat.querySelector('.archiefCategorieKop').textContent;
    volgorde[kop] = [...cat.querySelectorAll('.archiefRij')]
      .map(r => d.archiefItemStatus(d.archiefItem(r.dataset.item)));
  }
  return volgorde;
});
const rang = { koopbaar: 0, bezit: 1, teDuur: 2, vergrendeld: 3 };
check('Binnen elke categorie staat het eerstvolgende haalbare item bovenaan (koopbaar vóór te duur vóór vergrendeld)',
  Object.values(sortering).every(lijst => lijst.every((st, i) => i === 0 || rang[lijst[i - 1]] <= rang[st])), sortering);

// --- 9. Geweigerde localStorage: winkel blijft bruikbaar --------------
const geweigerd = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const orig = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('geweigerd'); };
  d.stadsarchief.geld = 5000;
  d.stadsarchief.gekocht = [];
  d.tekenArchiefWinkel();
  let gecrasht = false;
  try { d.koopArchiefItem('vlam-ijs'); } catch { gecrasht = true; }
  const bezitInSessie = d.stadsarchief.gekocht.includes('vlam-ijs');
  localStorage.setItem = orig;
  return { gecrasht, bezitInSessie };
});
check('Met een geweigerde localStorage crasht de winkel niet en werkt de aankoop binnen de sessie gewoon',
  !geweigerd.gecrasht && geweigerd.bezitInSessie, geweigerd);

// --- 10. Opruimen voor andere testbestanden --------------------------
await page.evaluate(() => localStorage.removeItem(window.AmsterdamUndeadDebug.STADSARCHIEF_KEY));

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
