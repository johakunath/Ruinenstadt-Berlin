// usage: node tools/clip-sheet.mjs out.png "clip=Punch_Cross&weapon=spear&from=0&to=1&n=8&view=side"   (dev server running)
import { chromium } from 'playwright';
const [out = 'clip.png', query = ''] = process.argv.slice(2);
const n = Number(new URLSearchParams(query).get('n') ?? 8);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 220 * n, height: 300 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/tools/clip-sheet.html?' + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 120000 });
console.log(await page.title());
await page.screenshot({ path: out });
await browser.close();
