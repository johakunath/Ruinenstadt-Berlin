// Dev tool: steps the sim by hand and saves a frame after each step group, for checking
// animation timing against hit frames. Needs the dev server (npm run dev).
// usage: node tools/sequence.mjs "<query>" outDir '<json first input>' <frames> <stepsPerFrame> ['<json setup js>']
import { chromium } from 'playwright';
const [query = '', outDir = '.', first = '{}', frames = '12', per = '2', setup = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 90000 });
await page.evaluate(() => { window.__game.start(); window.__game.hold(true); });
if (setup) await page.evaluate(setup);
await page.waitForTimeout(1500);
await page.evaluate((f) => window.__game.step(JSON.parse(f), 1), first);
for (let i = 0; i < +frames; i++) {
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => { const p = window.__game.sim().player; return `${p.state} ${p.attack?.id ?? ''} t=${p.stateT.toFixed(3)} sweep=${p.sweeping}`; });
  await page.screenshot({ path: `${outDir}/f${String(i).padStart(2, '0')}.png` });
  console.log(i, info);
  await page.evaluate((n) => window.__game.step({}, n), +per);
}
await browser.close();
