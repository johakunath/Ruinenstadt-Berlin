// usage: node tools/enemy-sheet.mjs out.png "kind=rex&state=windup&n=6"   (dev server running; no query: the whole roster)
import { chromium } from 'playwright';
const [out = 'clip.png', query = ''] = process.argv.slice(2);
const n = Number(new URLSearchParams(query).get('n') ?? 6);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(new URLSearchParams(query).get("w") ?? (new URLSearchParams(query).get("kind") ? 260 : 190)) * (new URLSearchParams(query).get("kind") ? n : 10), height: Number(new URLSearchParams(query).get("h") ?? 320) }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
// SEED=n: seeded Math.random in the page, so the random per-view tints match between a before and an after render.
if (process.env.SEED) await page.addInitScript((s) => { let a = s >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, Number(process.env.SEED));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/enemy-sheet.html?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 120000 });
console.log(await page.title());
await page.screenshot({ path: out });
await browser.close();
