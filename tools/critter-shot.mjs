// P18 proof shots: waits until the game runs, lets the animals settle, then takes a JPEG (dev server running).
//   PORT=5174 [SCARE=ms] node tools/critter-shot.mjs "<query>" out.jpg [settleMs] [width] [height]
// SCARE: moves the hero next to the nearest pigeon (a dev-tool write) and shoots that many ms later, so the flock
// is in the air. Prints the hero position, the live animals, the counts, the critter update time (ms) and the perf line.
import { chromium } from 'playwright';
import sharp from 'sharp';

const [query = '', out = 'shot.jpg', settle = '4000', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 300)); });
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game?.perf?.() && window.__game.phase() === 'play', null, { timeout: 240000, polling: 1000 })
  .catch((e) => errors.push('wait ' + e.message.slice(0, 200)));
await page.waitForTimeout(+settle);
if (process.env.SCARE) {
  await page.evaluate(() => {
    const p = window.__game.sim().player;
    const birds = globalThis.__critters.live().filter((a) => a.kind === 'pigeon' && !a.flying);
    const b = birds.sort((a, c) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(c.x - p.x, c.z - p.z))[0];
    // Right beside the bird (its spot is free ground), so a push out of a collider still leaves her inside the alarm distance.
    if (b) { p.x = p.px = b.x + 0.8; p.z = p.pz = b.z + 0.6; }
  });
  await page.waitForTimeout(+process.env.SCARE);
}
const info = await page.evaluate(() => ({
  hero: [window.__game?.sim().player.x, window.__game?.sim().player.z].map((v) => Math.round(v * 10) / 10),
  live: globalThis.__critters?.live().map((a) => `${a.kind[0]}${Math.round(a.x)},${Math.round(a.z)}${a.flying ? '^' : ''}`).join(' '),
  counts: globalThis.__critters?.counts(), ms: globalThis.__critters?.ms, perf: window.__game?.perf(), phase: window.__game?.phase(),
}));
const png = await page.screenshot({ timeout: 180000 });
await sharp(png).jpeg({ quality: 82 }).toFile(out);
console.log(JSON.stringify(info));
for (const e of errors.slice(0, 10)) console.log(e);
await browser.close();
