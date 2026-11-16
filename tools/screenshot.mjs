// Dev tool: screenshot of the running dev server (npm run dev).
// usage: node tools/screenshot.mjs "<query>" out.png [waitMs] [width] [height] [evalJs] [waitAfterEvalMs]
import { chromium } from 'playwright';
const [query = '', out = 'shot.png', wait = '2500', w = '1280', h = '720', js = '', waitAfter = '0'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 400)); });
await page.goto('http://localhost:5173/?' + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.hidden === true || /fehl/.test(document.getElementById('loading')?.textContent ?? ''), null, { timeout: 90000 }).catch((e) => errors.push('load timeout ' + e.message));
await page.waitForTimeout(+wait);
if (js) console.log('eval:', JSON.stringify(await page.evaluate(js)));
await page.waitForTimeout(+waitAfter);
await page.screenshot({ path: out, timeout: 180000 });
console.log(JSON.stringify(await page.evaluate(() => window.__game?.perf())));
for (const e of errors.slice(0, +(process.env.ERRN ?? 12))) console.log(e);
await browser.close();
