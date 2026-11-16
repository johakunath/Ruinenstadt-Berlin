// Run before/after a track change against npm run dev; camera snapping is a capture fixture only.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const stage = process.argv[2];
assert(['before', 'after', 'aligned'].includes(stage));
const out = 'docs/proof/tram-rails';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
try {
  for (const profile of ['Leistung', 'Qualität']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:5173/?autostart&seed=7&profile=${encodeURIComponent(profile)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 120000 });
    await page.evaluate(async () => {
      window.__game.hold(true);
      const { FollowCamera } = await import('/src/render/camera.ts');
      const update = FollowCamera.prototype.update;
      FollowCamera.prototype.update = function (x, z, vx, vz, dt, y) {
        this.snap(x, z, y); update.call(this, x, z, 0, 0, dt, y);
      };
    });
    const places = stage === 'aligned' ? [['bridge', 9, -39]] : [['street', 10, -86], ['bridge', 9, -39]];
    for (const [place, x, z] of places) {
      await page.evaluate(({ x, z }) => Object.assign(window.__game.sim().player, { x, z, px: x, pz: z }), { x, z });
      await page.evaluate(async () => { for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame); });
      const path = `${out}/${stage}-${place}-${profile === 'Leistung' ? 'leistung' : 'qualitaet'}.jpg`;
      await page.screenshot({ path, type: 'jpeg', quality: 90, timeout: 180000 });
      console.log(path);
    }
    assert.deepEqual(errors, []);
    report.push({ stage, profile, errors });
    await page.close();
  }
  await writeFile(`${out}/${stage}.json`, JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
