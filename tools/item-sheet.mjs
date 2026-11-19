// usage: node tools/item-sheet.mjs out.png "mode=weapons&family=normal"   (dev server running; PORT, CHROMIUM=<path> optional)
// family: normal, neon, gdr, legendary, set (comma list; default all). el=fire|acid|shock lights every glow part. cols=3.
import { chromium } from 'playwright';
const [out = 'items.png', query = 'mode=weapons'] = process.argv.slice(2);
const p = new URLSearchParams(query);
const cols = Number(p.get('cols') ?? 3);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: cols * 600 + 16, height: 400 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/item-sheet.html?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 180000 });
console.log(await page.title());
await page.screenshot({ path: out, fullPage: true });
await browser.close();
