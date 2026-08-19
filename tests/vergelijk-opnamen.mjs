// Ticket 121-hulpmiddel: telt hoeveel procent van de pixels verschilt tussen
// twee PNG's, en hoe sterk. Bedoeld om een "is dit verschil op scherm
// aantoonbaar?"-vraag met een GETAL te beantwoorden i.p.v. met een gevoel —
// precies wat de ticket-spec vraagt ("onderbouwd met een screenshot-
// vergelijking, niet alleen een getal" werkt ook andersom: niet alleen een
// plaatje, maar ook de meting eronder).
//
// Gebruik: node vergelijk-opnamen.mjs <a.png> <b.png> [drempel]
// drempel = minimaal kanaalverschil (0-255) om een pixel als "anders" te
// tellen; default 8, ruwweg de grens van wat op een normaal scherm opvalt.
import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import { executablePathOptie } from './helpers.mjs';

const [padA, padB] = process.argv.slice(2, 4);
const drempel = Number(process.argv[4] ?? 8);
if (!padA || !padB) {
  console.error('Gebruik: node vergelijk-opnamen.mjs <a.png> <b.png> [drempel]');
  process.exit(2);
}
const naarDataUrl = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');

const browser = await chromium.launch(executablePathOptie);
const page = await browser.newPage();
const uit = await page.evaluate(async ({ a, b, drempel }) => {
  const laad = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
  const [ia, ib] = await Promise.all([laad(a), laad(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { fout: 'afmetingen verschillen' };
  const c = document.createElement('canvas');
  c.width = ia.width; c.height = ia.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ia, 0, 0);
  const da = ctx.getImageData(0, 0, c.width, c.height).data;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(ib, 0, 0);
  const db = ctx.getImageData(0, 0, c.width, c.height).data;

  let anders = 0, somVerschil = 0, maxVerschil = 0;
  const totaal = c.width * c.height;
  for (let i = 0; i < totaal; i++) {
    const o = i * 4;
    const dr = Math.abs(da[o] - db[o]);
    const dg = Math.abs(da[o + 1] - db[o + 1]);
    const dbl = Math.abs(da[o + 2] - db[o + 2]);
    const m = Math.max(dr, dg, dbl);
    somVerschil += m;
    if (m > maxVerschil) maxVerschil = m;
    if (m >= drempel) anders++;
  }
  return {
    breedte: c.width, hoogte: c.height, totaal,
    andersPixels: anders,
    andersProcent: +(anders / totaal * 100).toFixed(2),
    gemiddeldVerschil: +(somVerschil / totaal).toFixed(2),
    maxVerschil,
  };
}, { a: naarDataUrl(padA), b: naarDataUrl(padB), drempel });

console.log(JSON.stringify(uit, null, 2));
await browser.close();
