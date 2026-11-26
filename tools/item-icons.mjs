// WP4 D10 and step 2: renders the icons from the 3D models (three-quarter view, studio light, transparent,
// 256 px WebP) into assets/inventory/<id>.webp: the weapons (tools/item-sheet.html) and everything worn
// (tools/look-sheet.html), and with PAGES=props the Pixal3D Aufsätze and supplies (tools/prop-icons.html). Rerun
// after every model or look change.
// usage: node tools/item-icons.mjs [outDir] ["family=normal"]   (dev server running; PORT, CHROMIUM=<path>, PAGES=weapons,wear optional)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const [outDir = 'assets/inventory', query = ''] = process.argv.slice(2);
const pages = (process.env.PAGES ?? 'weapons,wear').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
fs.mkdirSync(outDir, { recursive: true });
for (const which of pages) {
  const page = await browser.newPage({ viewport: { width: 300, height: 300 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const url = which === 'wear' ? 'look-sheet.html?mode=icons' : which === 'props' ? 'prop-icons.html' : `item-sheet.html?mode=icons&${query}`;
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/${url}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 300000 });
  const icons = await page.evaluate(() => window.__icons);
  for (const [id, data] of Object.entries(icons)) {
    const file = path.join(outDir, `${id}.webp`);
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(file, fs.statSync(file).size);
  }
  await page.close();
}
await browser.close();
