// V1 proof: enemies behind a building get a red contour; talk ring and prompt at a Späti.
// usage: npm run dev, then node tools/proof-v1.mjs
import { chromium } from 'playwright';
const out = 'docs/proof/v1';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5173/?autostart&seed=7&profile=Leistung', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 120000 });
  const spot = await page.evaluate(async () => {
    window.__game.hold(true);
    const { koepenickMap } = await import('/src/data/koepenick.ts');
    const { generateLots } = await import('/src/data/map.ts');
    const lot = generateLots(koepenickMap()).find((l) => l.kind === 'altbau' && l.z < -70 && l.floors >= 2);
    const half = (Math.abs(Math.sin(lot.rot)) * lot.w + Math.abs(Math.cos(lot.rot)) * lot.d) / 2;
    return { x: lot.x, front: lot.z + half + 2.5, back: lot.z - half - 1.5 };
  });
  const url = (p) => performance.getEntriesByType('resource').find((r) => new URL(r.name).pathname === p)?.name ?? p;
  await page.evaluate(async ({ s, enemiesUrl }) => {
    const sim = window.__game.sim();
    Object.assign(sim.player, { x: s.x, z: s.front, px: s.x, pz: s.front, vx: 0, vz: 0 });
    const { spawnEnemy } = await import(enemiesUrl);
    for (const dx of [-3, 0, 3]) { const e = spawnEnemy(sim, s.x + dx, s.back, 'walker'); e.state = 'idle'; }
  }, { s: spot, enemiesUrl: await page.evaluate(url, '/src/sim/enemies.ts') });
  for (let i = 0; i < 20; i++) await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.screenshot({ path: `${out}/enemy-contour.jpg`, type: 'jpeg', quality: 90 });
  // Späti: stand on the customer spot, step the sim so the talk prompt shows.
  await page.evaluate(() => {
    const sim = window.__game.sim();
    sim.enemies.length = 0;
    const r = sim.level.rests.find((q) => q.desk);
    Object.assign(sim.player, { x: r.desk.x, z: r.desk.z + 0.6, px: r.desk.x, pz: r.desk.z + 0.6 });
    window.__game.step({}, 2);
    window.__game.hold(false);
  });
  for (let i = 0; i < 10; i++) await page.evaluate(() => new Promise(requestAnimationFrame));
  console.log('talk', await page.evaluate(() => window.__game.sim().content.talk));
  await page.screenshot({ path: `${out}/talk-prompt.jpg`, type: 'jpeg', quality: 90 });
  console.log(errors);
} finally { await browser.close(); }
