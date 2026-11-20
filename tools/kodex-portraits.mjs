// Kodex portraits from the in-game 3D bodies: renders every enemy kind and boss in `ENEMY_PORTRAIT` and the four
// elite modifiers in `ELITE_PORTRAIT` (src/ui/menu.ts) on a Brocken host through `tools/enemy-sheet.html?portrait=1`,
// and writes `assets/portraits/<id>.webp` (256 px). Survivor portraits (S..) stay as they are.
// usage: node tools/kodex-portraits.mjs [kind ...]   (dev server running, PORT env, default 5173; no kinds: all;
//   OUT=dir writes there instead, for a preview)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const menu = readFileSync(new URL('../src/ui/menu.ts', import.meta.url), 'utf8');
const map = (name) => Object.fromEntries([...menu.match(new RegExp(`const ${name}[^=]*= \\{([\\s\\S]*?)\\};`))[1].matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
// Host of the elite portraits: the elite guard in every map.
const ELITE_HOST = 'brute';
// The Spiegelbild is not in the Kodex; its id is the Spiegelpaar's.
const jobs = [
  ...Object.entries(map('ENEMY_PORTRAIT')).filter(([k]) => k !== 'spiegelbild').map(([k, id]) => [k, id]),
  ...Object.entries(map('ELITE_PORTRAIT')).map(([m, id]) => [`${ELITE_HOST}+${m}`, id]),
];
const dir = process.env.OUT ? pathToFileURL(`${process.env.OUT}/`) : new URL('../assets/portraits/', import.meta.url);
mkdirSync(dir, { recursive: true });
const only = process.argv.slice(2);
const todo = only.length ? jobs.filter(([t]) => only.includes(t) || only.includes(t.split('+')[1])) : jobs;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// Software rendering is slow: a few kinds per page, two pages at a time.
const batches = [];
for (let i = 0; i < todo.length; i += 8) batches.push(todo.slice(i, i + 8));
async function run(batch) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const failed = new Promise((_, reject) => page.on('pageerror', (e) => reject(new Error(`${batch.map(([t]) => t)}: ${e.message}`))));
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/enemy-sheet.html?portrait=1&kinds=${encodeURIComponent(batch.map(([t]) => t).join(','))}`, { waitUntil: 'load' });
  await Promise.race([page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 600000 }), failed]);
  const shots = await page.evaluate(() => window.portraits);
  await page.close();
  for (const [token, id] of batch) {
    const png = Buffer.from(shots[token].split(',')[1], 'base64');
    const webp = await sharp(png).resize(256, 256, { kernel: 'lanczos3' }).webp({ quality: 82, effort: 6 }).toBuffer();
    writeFileSync(new URL(`${id}.webp`, dir), webp);
    console.log(`${id} ${token} ${(webp.length / 1024).toFixed(1)} KB`);
  }
}
for (let i = 0; i < batches.length; i += 2) await Promise.all(batches.slice(i, i + 2).map(run));
await browser.close();
