// WP4 D10: renders every weapon icon from its 3D model (three-quarter view, diagonal, studio light,
// transparent, 256 px WebP) into assets/inventory/<id>.webp. Rerun after every weapon model change.
// usage: node tools/item-icons.mjs [outDir] ["family=normal"]   (dev server running; PORT, CHROMIUM=<path> optional)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const [outDir = 'assets/inventory', query = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/item-sheet.html?mode=icons&${query}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 180000 });
const icons = await page.evaluate(() => window.__icons);
fs.mkdirSync(outDir, { recursive: true });
for (const [id, url] of Object.entries(icons)) {
  const file = path.join(outDir, `${id}.webp`);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file, fs.statSync(file).size);
}
await browser.close();
