// T1 visual proof, including image-load failure fallback. Run against npm run dev.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'docs/proof/t1-ground';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const report = [];
try {
  for (const profile of ['Leistung', 'Qualität']) {
    for (const stage of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [], loaded = new Set();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => {
        if (message.type() === 'error' && !(stage === 'before' && message.text().includes('net::ERR_FAILED'))) errors.push(message.text());
      });
      page.on('response', r => {
        if (r.url().includes('/assets/textures/koepenick/') && r.ok()) loaded.add(new URL(r.url()).pathname.split('/').at(-1));
      });
      // Before = the unchanged procedural defaults; also proves all five load failures work.
      if (stage === 'before') await page.route('**/assets/textures/koepenick/**', r => r.abort());
      await page.goto(`http://localhost:5173/?autostart&seed=7&profile=${encodeURIComponent(profile)}`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 90000 });
      await page.evaluate(async () => {
        window.__game.hold(true);
        window.__game.sim().time = 0;
        // Capture fixture only: snap the existing camera to the requested location so software
        // WebGL need not render twelve expensive frames just to settle its follow interpolation.
        const { FollowCamera } = await import('/src/render/camera.ts');
        const update = FollowCamera.prototype.update;
        FollowCamera.prototype.update = function (x, z, vx, vz, dt, y) {
          this.snap(x, z, y);
          update.call(this, x, z, 0, 0, dt, y);
        };
      });
      if (stage === 'after') {
        await page.waitForFunction(() => performance.getEntriesByType('resource').filter(r => /koepenick\/.*\.webp/.test(r.name)).length === 5);
        assert.equal(loaded.size, 5, 'all five textures must load');
      }
      for (const [place, x, z] of [['altstadt', 10, -20], ['kietz', 70, 30], ['forest', 130, -120]]) {
        await page.evaluate(({ x, z }) => { Object.assign(window.__game.sim().player, { x, z, px: x, pz: z }); }, { x, z });
        await page.evaluate(async () => { for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame); });
        const path = `${out}/${stage}-${place}-${profile === 'Leistung' ? 'leistung' : 'qualitaet'}.jpg`;
        await page.screenshot({ path, type: 'jpeg', quality: 90, timeout: 180000 });
        console.log(path);
      }
      assert.deepEqual(errors, [], 'no runtime errors');
      report.push({ profile, stage, loaded: [...loaded].sort(), errors });
      await page.close();
    }
  }
  await writeFile(`${out}/loading.json`, JSON.stringify(report, null, 2) + '\n');
} finally {
  await browser.close();
}
