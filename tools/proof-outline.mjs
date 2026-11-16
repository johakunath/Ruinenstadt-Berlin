import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'docs/proof/hero-outline';
const only = process.argv[2];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const fixture = await browser.newPage();
  const errors = [];
  fixture.on('pageerror', e => errors.push(e.message));
  fixture.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let cases;
  for (let attempt = 0; attempt < 3; attempt++) {
    await fixture.goto('http://localhost:5173/tools/outline-cases.html', { waitUntil: 'networkidle' });
    errors.length = 0;
    try {
      cases = await fixture.evaluate(async () => (await import('/tools/outline-cases.ts')).runCases());
      break;
    } catch (error) {
      // Vite may reload the tool page once while discovering its development-only dependencies.
      if (attempt === 2 || !String(error).includes('Execution context was destroyed')) throw error;
    }
  }
  assert(cases);
  console.log(JSON.stringify(cases));
  for (const c of cases) assert.equal(c.changedPixels > 0, c.expected, `${c.name}, scale ${c.scale}`);
  assert.deepEqual(errors, []);
  await writeFile(`${out}/render-cases.json`, JSON.stringify(cases, null, 2) + '\n');
  await fixture.close();
  const reports = [];
  for (const profile of ['Leistung', 'Qualität']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:5173/?autostart&seed=7&profile=${encodeURIComponent(profile)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 120000 });
    const building = await page.evaluate(async () => {
      window.__game.hold(true);
      // Use the exact module URL loaded by the game, including Vite's hot-reload timestamp.
      const cameraUrl = performance.getEntriesByType('resource').find(r => new URL(r.name).pathname === '/src/render/camera.ts')?.name;
      const { FollowCamera } = await import(cameraUrl ?? '/src/render/camera.ts');
      const update = FollowCamera.prototype.update;
      FollowCamera.prototype.update = function (x, z, vx, vz, dt, y) { this.snap(x, z, y); update.call(this, x, z, 0, 0, dt, y); };
      const { koepenickMap } = await import('/src/data/koepenick.ts');
      const { generateLots } = await import('/src/data/map.ts');
      const lot = generateLots(koepenickMap()).find(l => l.kind === 'altbau' && l.z < -70 && l.floors >= 1);
      return { x: lot.x, z: lot.z - (Math.abs(Math.sin(lot.rot)) * lot.w + Math.abs(Math.cos(lot.rot)) * lot.d) / 2 - 0.8 };
    });
    for (const [name, x, z] of [['behind-tram', 7.3, -48], ['beside-tram', 10.5, -48], ['behind-building', building.x, building.z]]) {
      if (only && only !== name) continue;
      await page.evaluate(({ x, z }) => Object.assign(window.__game.sim().player, { x, z, px: x, pz: z, vx: 0, vz: 0, facing: 0, pfacing: 0 }), { x, z });
      await page.evaluate(async () => { for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame); });
      const path = `${out}/${name}-${profile === 'Leistung' ? 'leistung' : 'qualitaet'}.jpg`;
      await page.screenshot({ path, type: 'jpeg', quality: 95, timeout: 180000 });
      console.log(path);
    }
    assert.deepEqual(errors, []);
    reports.push({ profile, building, errors });
    await page.close();
  }
  await writeFile(`${out}/screenshots${only ? '-' + only : ''}.json`, JSON.stringify(reports, null, 2) + '\n');
} finally { await browser.close(); }
