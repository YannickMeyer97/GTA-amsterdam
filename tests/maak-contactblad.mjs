// Zet meerdere beeldverslag-opnamen naast/onder elkaar in één PNG met
// bijschriften, zodat "wat heeft elk ticket toegevoegd?" in één blik te zien
// is i.p.v. door losse bestanden te moeten bladeren.
//
// Gebruik: node maak-contactblad.mjs <uit.png> <titel> <pad1::bijschrift1> …
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { executablePathOptie } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [uitPad, titel, ...paren] = process.argv.slice(2);
if (!uitPad || !paren.length) {
  console.error('Gebruik: node maak-contactblad.mjs <uit.png> <titel> <pad::bijschrift> …');
  process.exit(2);
}
const items = paren.map((p) => {
  const [pad, bijschrift] = p.split('::');
  return { src: 'data:image/png;base64,' + readFileSync(path.resolve(__dirname, pad)).toString('base64'), bijschrift };
});

const browser = await chromium.launch(executablePathOptie);
const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
const buffer = await page.evaluate(async ({ items, titel }) => {
  const laad = (src) => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  const imgs = await Promise.all(items.map((it) => laad(it.src)));
  const kolommen = Math.min(items.length, 2);
  const rijen = Math.ceil(items.length / kolommen);
  const bw = imgs[0].width, bh = imgs[0].height;
  const marge = 14, bijschriftH = 30, titelH = 46;
  const c = document.createElement('canvas');
  c.width = kolommen * bw + (kolommen + 1) * marge;
  c.height = titelH + rijen * (bh + bijschriftH) + (rijen + 1) * marge;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#15171c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#f2f4f8';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(titel, marge, titelH / 2 + 4);
  imgs.forEach((img, i) => {
    const kol = i % kolommen, rij = Math.floor(i / kolommen);
    const x = marge + kol * (bw + marge);
    const y = titelH + marge + rij * (bh + bijschriftH + marge);
    ctx.drawImage(img, x, y);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = '#cfd6e4';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(items[i].bijschrift, x, y + bh + bijschriftH / 2);
  });
  return c.toDataURL('image/png').split(',')[1];
}, { items, titel });

const { writeFileSync } = await import('fs');
writeFileSync(path.resolve(__dirname, uitPad), Buffer.from(buffer, 'base64'));
console.log('Geschreven:', path.resolve(__dirname, uitPad));
await browser.close();
