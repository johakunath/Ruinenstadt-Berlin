// usage: node tools/look-sheet.mjs out.png "group=koepenick&views=front,side,back"   (dev server running; PORT, CHROMIUM=<path> optional)
import { chromium } from 'playwright';
const [out = 'looks.png', query = 'group=koepenick'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/look-sheet.html?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 300000 });
console.log(await page.title());
await (await page.$('#wrap')).screenshot({ path: out });
await browser.close();
