// P47 / T1b proof: one screenshot per district at the start camera (seed 7, sim held) once every texture image has
// loaded. Run against the dev server; `before` and `after` write docs/proof/p47/<stage>-<map>.jpg, `sheet` joins
// each pair side by side into docs/proof/p47/<map>.jpg (and deletes the halves).
// usage: [PORT=5179] [PROFILE=Leistung] [EXTRA=rails=old] node tools/proof-p47.mjs before|after|sheet [map ...]
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';

const [stage, ...only] = process.argv.slice(2);
const MAPS = ['koepenick', 'xhain', 'alex', 'mitte', 'charlottenburg', 'wedding', 'turm', 'tunnel'];
const maps = only.length ? only : MAPS;
const out = process.env.OUT ?? 'docs/proof/p47';
const profile = process.env.PROFILE ?? 'Leistung';
await mkdir(out, { recursive: true });

if (stage === 'sheet') {
  for (const map of maps) {
    const half = (s) => sharp(`${out}/${s}-${map}.jpg`).resize(960, 540).toBuffer();
    const [a, b] = [await half('before'), await half('after')];
    await sharp({ create: { width: 1924, height: 540, channels: 3, background: '#fff' } })
      .composite([{ input: a, left: 0, top: 0 }, { input: b, left: 964, top: 0 }])
      .jpeg({ quality: 80, mozjpeg: true }).toFile(`${out}/${map}.jpg`);
    await rm(`${out}/before-${map}.jpg`);
    await rm(`${out}/after-${map}.jpg`);
    console.log(`${out}/${map}.jpg`);
  }
  process.exit(0);
}
if (stage !== 'before' && stage !== 'after') throw new Error('stage: before | after | sheet');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const map of maps) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    const q = `autostart&seed=7&profile=${encodeURIComponent(profile)}${map === 'koepenick' ? '' : `&map=${map}`}${process.env.EXTRA ? `&${process.env.EXTRA}` : ''}`;
    await page.goto(`http://localhost:${process.env.PORT ?? 5179}/?${q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.phase() !== 'title' && document.getElementById('loading')?.hidden === true, null, { timeout: 240000 });
    await page.evaluate(() => window.__game.hold(true));
    // Every texture image requested so far has arrived and none followed for 3 s; then the swaps have run.
    let seen = -1;
    for (let still = 0; still < 3;) {
      await page.waitForTimeout(1000);
      const n = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.webp/.test(r.name)).length);
      still = n === seen ? still + 1 : 0;
      seen = n;
    }
    await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); });
    const path = `${out}/${stage}-${map}.jpg`;
    await page.screenshot({ path, type: 'jpeg', quality: 90, timeout: 180000 });
    console.log(path, seen, 'images', errors.length ? errors.slice(0, 4) : '');
    await page.close();
  }
} finally { await browser.close(); }
