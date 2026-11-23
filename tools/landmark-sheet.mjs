// usage: node tools/landmark-sheet.mjs out.png "kind=rathaus&views=quarter,game"   (dev server running)
import { chromium } from 'playwright';
const [out = 'landmark.png', query = ''] = process.argv.slice(2);
const p = new URLSearchParams(query);
const views = (p.get('views') ?? 'quarter,front,game,top').split(',').length;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(p.get('w') ?? 480) * views, height: Number(p.get('h') ?? 420) }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/landmark-sheet.html?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 120000 });
await page.screenshot({ path: out });
console.log(await page.title());
await browser.close();
