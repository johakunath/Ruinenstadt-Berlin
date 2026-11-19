// Builds the WP4 clothing mockup sheets: one SVG and one WebP per group (PNG with --png).
// Run from the repo root: node docs/mockups/wp4-clothes/build.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { figure, defs, mailPattern } from './figure.mjs';
import { GROUPS } from './items.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROUTE = {
  Vorhanden: '#6f665a', Farbe: '#4f8a4e', Teil: '#3f78b0', Schnitt: '#a8802e', Quaternius: '#7e5cb0',
  Blender: '#c86a2e', Codex: '#b0446a', Glühen: '#2ea8a0',
};
const FONT = 'Barlow Condensed, Arial Narrow, DejaVu Sans Condensed, sans-serif';
const CW = 330, CH = 440, GAP = 12, COLS = 3;
// Detail views per slot (figure coordinates, aspect 120:170).
const ZOOM = { Kopf: '72 -16 56 79', 'Hände': '124 128 46 65', 'Füße': '64.7 202 70.6 100', 'Körper': '50 44 100 141.6' };
const ZOOM_COMBO = '56 -14 88 124.6';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function wrap(text, max) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; } else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

function card(item, x, y) {
  const o = [];
  const combo = item.combo;
  o.push(`<g transform="translate(${x},${y})">`);
  o.push(`<rect width="${CW}" height="${CH}" rx="6" fill="${combo ? '#1e2a2c' : '#1d1712'}" stroke="${combo ? '#3f6a6a' : '#4c453a'}"/>`);
  o.push(`<text x="12" y="24" fill="#e8dccb" font-size="17" font-weight="700">${esc(item.name)}</text>`);
  o.push(`<text x="12" y="42" fill="#9a8f80" font-size="13">${esc(item.slot)}${item.base && !combo ? ' · ' + esc(item.base) : ''}</text>`);
  // Whole figure at the same scale on every card, so sizes compare; detail view on the right.
  o.push(`<svg x="4" y="48" width="196" height="304" viewBox="0 -16 200 320">${figure(item.look)}</svg>`);
  const vb = combo ? ZOOM_COMBO : ZOOM[item.slot] || ZOOM['Körper'];
  o.push(`<rect x="200" y="52" width="120" height="170" rx="4" fill="#120e0b" stroke="#3a332b"/>`);
  o.push(`<svg x="200" y="52" width="120" height="170" viewBox="${vb}">${figure(item.look)}</svg>`);
  o.push(`<text x="260" y="238" fill="#6f665a" font-size="12" text-anchor="middle">Detail</text>`);
  let cx = 12;
  const cy = 360;
  for (const r of item.route) {
    const w = r.length * 7 + 14;
    o.push(`<rect x="${cx}" y="${cy}" width="${w}" height="18" rx="9" fill="${ROUTE[r]}"/><text x="${cx + w / 2}" y="${cy + 13}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${r}</text>`);
    cx += w + 5;
  }
  wrap(item.note, 50).slice(0, 3).forEach((l, i) => o.push(`<text x="12" y="${(item.route.length ? 394 : 374) + i * 15}" fill="#cfc4b4" font-size="12.5">${esc(l)}</text>`));
  o.push('</g>');
  return o.join('');
}

function sheet(group) {
  const rows = Math.ceil(group.items.length / COLS);
  const W = COLS * CW + (COLS + 1) * GAP, H = 120 + rows * (CH + GAP);
  const body = [];
  body.push(`<rect width="${W}" height="${H}" fill="#14100c"/>`);
  body.push(`<text x="${GAP}" y="34" fill="#e9a23b" font-size="24" font-weight="700">WP4 Kleidung · ${esc(group.title)}</text>`);
  wrap(group.sub, 120).forEach((l, i) => body.push(`<text x="${GAP}" y="${58 + i * 17}" fill="#9a8f80" font-size="14">${esc(l)}</text>`));
  group.swatches.forEach((c, i) => body.push(`<rect x="${W - GAP - (group.swatches.length - i) * 26}" y="18" width="22" height="22" rx="3" fill="${c}" stroke="#4c453a"/>`));
  let lx = GAP;
  for (const [r, c] of Object.entries(ROUTE)) {
    const w = r.length * 7 + 14;
    body.push(`<rect x="${lx}" y="88" width="${w}" height="18" rx="9" fill="${c}"/><text x="${lx + w / 2}" y="101" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${r}</text>`);
    lx += w + 5;
  }
  body.push(`<text x="${lx + 6}" y="101" fill="#6f665a" font-size="12.5">Bauweg je Teil. Icons werden aus dem 3D-Modell gerendert.</text>`);
  group.items.forEach((it, i) => body.push(card(it, GAP + (i % COLS) * (CW + GAP), 120 + Math.floor(i / COLS) * (CH + GAP))));
  // defs last: gradients are registered while the figures are drawn
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${defs().replace('</defs>', mailPattern + '</defs>')}${body.join('')}</svg>` };
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const g of GROUPS) {
  const { W, H, svg } = sheet(g);
  const file = join(DIR, `${g.id}.svg`);
  writeFileSync(file, svg);
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  if (process.argv.includes('--png')) writeFileSync(join(DIR, `${g.id}.png`), png);
  await sharp(png).webp({ quality: 86 }).toFile(join(DIR, `${g.id}.webp`));
  console.log(g.id, W, H);
}
await browser.close();
