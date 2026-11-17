// usage: node tools/clip-sheet.mjs out.png "clip=Punch_Cross&weapon=spear&from=0&to=1&n=8&view=side"   (dev server running)
import { chromium } from 'playwright';
const [out = 'clip.png', query = ''] = process.argv.slice(2);
const params = new URLSearchParams(query);
const n = Number(params.get('n') ?? 8);
const zoom = Number(params.get('zoom') ?? 1);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Math.round(220 * zoom) * n, height: Math.round(300 * zoom) }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.text().startsWith('ik ')) console.log(m.text()); });
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/clip-sheet.html?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 120000 });
console.log(await page.title());
await page.screenshot({ path: out });
await browser.close();
