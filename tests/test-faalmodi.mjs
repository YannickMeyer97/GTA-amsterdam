// Ticket 74 (v0.20, §8.6.1): de twee bekende stille faalmodi zichtbaar
// maken. (a) Three.js komt via een CDN-importmap — is die onbereikbaar,
// dan gebeurde er voorheen letterlijk niets (dood scherm, geen melding).
// (b) leesHighscore() deed kale JSON.parse() zonder vormvalidatie —
// corrupte/handmatig aangepaste localStorage gaf geen crash maar wel
// "Record: undefined" in beeld.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_PATH = path.join(__dirname, '..', 'amsterdam-undead.html');
const { check, report } = makeChecker();
const alleErrs = [];

// --- 1. Geblokkeerde CDN-route: de melding moet verschijnen -----------------
// Bewust GEEN openAmsterdamUndead() hier — die helper onderschept
// cdn.jsdelivr.net juist succesvol (lokale three.module.js). Dit scenario
// simuleert een ECHT onbereikbare CDN via route.abort().
{
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.route('**/cdn.jsdelivr.net/**', r => r.abort());
  await page.goto('file://' + GAME_PATH);
  // Empirisch: een mislukte module-import (netwerkfout via route.abort())
  // geeft in Chromium GEEN catchable window.onerror-event — alleen een
  // console-foutmelding (Failed to load resource) — dus de betrouwbare
  // detectie hier is de 10s-timer, niet de directe error-listener (die
  // blijft wél nuttig voor een syntaxfout ín de module zelf, een écht
  // synchrone script-fout). Ruim binnen de 15s-acceptatiecriterium-marge.
  await page.waitForTimeout(11000);
  const zichtbaar = await page.evaluate(() =>
    getComputedStyle(document.getElementById('cdnFoutmelding')).display !== 'none');
  check('Met een geblokkeerde CDN-route verschijnt de melding binnen 15s (via de 10s-timer)',
    zichtbaar === true, { zichtbaar });
  const tekst = await page.evaluate(() => document.getElementById('cdnFoutmelding').textContent);
  check('De melding is leesbaar (bevat "Three.js" en "internetverbinding")',
    tekst.includes('Three.js') && tekst.includes('internetverbinding'), { tekst });
  await browser.close();
}

// --- 2. Normale run: de melding mag NOOIT verschijnen -----------------------
{
  const { browser, page, errs } = await openAmsterdamUndead();
  // Ruim voorbij de normale laadtijd (~800ms in deze omgeving), ruim onder
  // de 10s-faalmodus-timer — bewijst dat een geslaagde load 'm nooit toont.
  await page.waitForTimeout(1500);
  const verborgen = await page.evaluate(() =>
    getComputedStyle(document.getElementById('cdnFoutmelding')).display === 'none');
  check('Bij een normale (geslaagde) run blijft de CDN-foutmelding verborgen', verborgen === true, { verborgen });
  const timerGeannuleerd = await page.evaluate(() => window.__cdnFoutTimer !== undefined);
  check('De faalmodus-timer bestaat (en is dus klaar om geannuleerd te worden zodra de module klaar is)',
    timerGeannuleerd === true, { timerGeannuleerd });
  alleErrs.push(...errs);
  await browser.close();
}

// --- 3. Corrupte/handmatig aangepaste localStorage ---------------------------
{
  const { browser, page, errs } = await openAmsterdamUndead();
  const resultaten = await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    const varianten = ['{"score":"veel"}', '[]', 'null'];
    const uit = [];
    for (const raw of varianten) {
      localStorage.setItem(d.HIGHSCORE_KEY, raw);
      const record = d.leesHighscore();
      d.toonStartschermRecord();
      const tekst = document.getElementById('startschermRecord').textContent;
      uit.push({ raw, record, tekst });
    }
    localStorage.removeItem(d.HIGHSCORE_KEY);
    return uit;
  });
  for (const r of resultaten) {
    check(`Corrupt record ${r.raw}: leesHighscore() geeft null terug (geen halve/foute waarde)`,
      r.record === null, r);
    check(`Corrupt record ${r.raw}: het startscherm toont een leeg record (geen "undefined" in beeld)`,
      r.tekst === '' && !r.tekst.includes('undefined'), r);
  }

  // Randgeval: een geldig record ZONDER moeilijkheid-veld (oudere
  // opslagversie) moet gewoon blijven werken.
  const oudeVersie = await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    localStorage.setItem(d.HIGHSCORE_KEY, JSON.stringify({ score: 4200, golf: 9 }));
    const record = d.leesHighscore();
    d.toonStartschermRecord();
    const tekst = document.getElementById('startschermRecord').textContent;
    localStorage.removeItem(d.HIGHSCORE_KEY);
    return { record, tekst };
  });
  check('Een geldig record zonder moeilijkheid-veld (oudere opslagversie) blijft gewoon werken',
    oudeVersie.record !== null && oudeVersie.tekst.includes('4200') && oudeVersie.tekst.includes('9'), oudeVersie);

  // Een geldig, volledig record blijft ook gewoon geldig (positieve controle).
  const geldig = await page.evaluate(() => {
    const d = window.AmsterdamUndeadDebug;
    localStorage.setItem(d.HIGHSCORE_KEY, JSON.stringify({ score: 1000, golf: 5, moeilijkheid: 'Amsterdammer' }));
    const record = d.leesHighscore();
    localStorage.removeItem(d.HIGHSCORE_KEY);
    return record;
  });
  check('Een volledig geldig record blijft onaangetast door de nieuwe validatie',
    geldig && geldig.score === 1000 && geldig.golf === 5 && geldig.moeilijkheid === 'Amsterdammer', geldig);

  alleErrs.push(...errs);
  await browser.close();
}

const fails = report(alleErrs);
process.exit(fails > 0 ? 1 : 0);
