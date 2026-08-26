// Ticket 137, vervolgmeting. `meet-tiervisuals.mjs` liet zien dat de Canal
// Ripper tussen tier 1 en tier 2 tot +3,7% aan pixelhelderheid verschuift op de
// donkerste standpunten, terwijl draw calls en driehoeken tussen die twee tiers
// BYTE-IDENTIEK zijn (639/51809 in beide gevallen). Er komt dus geen geometrie
// bij — tier 2 is visueel leeg, precies het gat dat T137 moet dichten.
//
// Blijft de vraag waar die pixels dan vandaan komen. Het vermoeden: de HUD.
// Smeden verandert de munitietekst (24 -> 32 voor de Ripper, 12 -> 16 voor de
// AMSTEL-9) en het wapenlabel (★ -> ★★), en de HUD-chrome valt bewust binnen
// het 15-85%-meetvenster van pixelstats(). Dat precedent is in dit project al
// gemeten: alleen het vervangen van de HUD-TEKST "Drukspuit" door "AMSTEL-9"
// verschoof de vliering-mediaan van 7,69 naar 9,06.
//
// Deze meting scheidt de twee: dezelfde tier-overgang, één keer met HUD en één
// keer met de HUD verborgen. Blijft het verschil met verborgen HUD over, dan is
// het geen HUD-effect en klopt het vermoeden niet.
import { openVoorVisueleMeting, berekenVisueleStandpunten, zetVisueelStandpunt } from './helpers.mjs';
import { PNG } from 'pngjs';

const { browser, page, errs } = await openVoorVisueleMeting();

function gemiddeldeHelderheid(buf) {
  const png = PNG.sync.read(buf);
  let som = 0, n = 0;
  const x0 = Math.floor(png.width * 0.15), x1 = Math.floor(png.width * 0.85);
  const y0 = Math.floor(png.height * 0.15), y1 = Math.floor(png.height * 0.85);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      som += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  }
  return som / n;
}

const punten = await berekenVisueleStandpunten(page);
// De twee donkerste, dus gevoeligste standpunten uit de vorige meting.
const doelPunten = punten.filter(p => p.naam === 'vliering' || p.naam === 'kelder');

async function meet(hudVerborgen) {
  const uit = {};
  for (const sp of doelPunten) {
    await zetVisueelStandpunt(page, sp);
    await page.evaluate((verberg) => {
      const d = window.AmsterdamUndeadDebug;
      d.updateWapenPresentatie(0);
      // Alle HUD-chrome in één klap; de scene zelf blijft onaangeraakt.
      for (const el of document.querySelectorAll('body > div, body > canvas ~ *')) {
        if (el.tagName === 'CANVAS') continue;
        el.style.visibility = verberg ? 'hidden' : '';
      }
    }, hudVerborgen);
    uit[sp.naam] = gemiddeldeHelderheid(await page.screenshot({ type: 'png' }));
  }
  return uit;
}

async function zetWapenEnTier(wapenNaam, tier) {
  await page.evaluate(({ naam, t }) => {
    const d = window.AmsterdamUndeadDebug;
    d.spelStaat.geld = 10000000;
    if (naam === 'drukspuit' && !d.wapenStaten.drukspuit) d.koopAmstel9();
    if (naam === 'ratelaar' && !d.wapenStaten.ratelaar) d.koopRatelaar();
    d.activeerVuurwapen(naam);
    d.wisselTimer = 0; d.terugslag = 0; d.wapenKickX = 0; d.bobFase = 0;
    d.updateWapenPresentatie(0);
    let veiligheid = 0;
    while ((d.gesmeedActief ? 1 : 0) + (d.gesmeedNiveau2Actief ? 1 : 0) < t && veiligheid++ < 4) {
      d.spelStaat.geld = 10000000;
      d.koopSmederij();
    }
  }, { naam: wapenNaam, t: tier });
}

const resultaat = {};
for (const wapen of ['drukspuit', 'ratelaar']) {
  for (const tier of [1, 2]) {
    await zetWapenEnTier(wapen, tier);
    resultaat[`${wapen}-t${tier}-metHUD`] = await meet(false);
    resultaat[`${wapen}-t${tier}-zonderHUD`] = await meet(true);
  }
}

// Herhaalbaarheid: dezelfde staat twee keer meten. Alles wat hier overblijft is
// ruis en vormt de ondergrens waaronder een "verschuiving" niets betekent.
await zetWapenEnTier('ratelaar', 2);
const herhaling = [await meet(false), await meet(false)];

console.log('=== Tier 1 -> tier 2, met en zonder HUD (gemiddelde helderheid) ===\n');
console.log('wapen        standpunt   t1        t2        verschuiving');
for (const wapen of ['drukspuit', 'ratelaar']) {
  for (const modus of ['metHUD', 'zonderHUD']) {
    for (const sp of doelPunten) {
      const a = resultaat[`${wapen}-t1-${modus}`][sp.naam];
      const b = resultaat[`${wapen}-t2-${modus}`][sp.naam];
      const pct = ((b - a) / a) * 100;
      console.log(`${wapen.padEnd(12)} ${sp.naam.padEnd(11)} ${a.toFixed(3).padEnd(9)} ${b.toFixed(3).padEnd(9)} `
        + `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%   (${modus})`);
    }
  }
}

console.log('\n=== Ruisondergrens: twee metingen van exact dezelfde staat ===');
for (const sp of doelPunten) {
  const a = herhaling[0][sp.naam], b = herhaling[1][sp.naam];
  console.log(`${sp.naam.padEnd(12)} ${a.toFixed(4)} vs ${b.toFixed(4)} -> ${(((b - a) / a) * 100).toFixed(3)}%`);
}

console.log('\n=== JSON ===');
console.log(JSON.stringify({ resultaat, herhaling }));
console.log('console errors:', errs.length ? errs.join(' | ') : 'geen');
await browser.close();
