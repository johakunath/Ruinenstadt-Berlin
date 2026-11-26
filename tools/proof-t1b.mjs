// T1b in-game proof: Köpenick paving (Altstadt market) and leaf floor (Friedrichshagen forest) with the previous
// images (served in place of the new files by request interception) and the new ones, on Qualität and Leistung.
// Writes docs/proof/t1b/ground-<profile>.jpg (rows: Altstadt, forest; columns: before | after). Run against the dev
// server; seed 7, sim held, camera snapped to the hero (capture fixture only, as in proof-ground.mjs).
// usage: [PORT=5179] node tools/proof-t1b.mjs <old-paving.webp> <old-leaves.webp>
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const [oldPaving, oldLeaves] = process.argv.slice(2);
const old = {
  'paving.webp': await readFile(oldPaving),
  'leaves.webp': await readFile(oldLeaves),
  'paving-512.webp': await sharp(oldPaving).resize(512, 512).webp({ quality: 85 }).toBuffer(),
  'leaves-512.webp': await sharp(oldLeaves).resize(512, 512).webp({ quality: 85 }).toBuffer(),
};
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const places = [[10, -20], [130, -120]];
try {
  for (const profile of ['Qualität', 'Leistung']) {
    const shots = [];
    for (const stage of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      if (stage === 'before') {
        await page.route(/koepenick\/(paving|leaves)(-512)?\.webp/, route => {
          const name = new URL(route.request().url()).pathname.split('/').at(-1).replace(/\?.*/, '');
          return route.fulfill({ status: 200, contentType: 'image/webp', body: old[name] });
        });
      }
      await page.goto(`http://localhost:${process.env.PORT ?? 5179}/?autostart&seed=7&profile=${encodeURIComponent(profile)}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game && window.__game.phase() !== 'title' && document.getElementById('loading')?.hidden === true, null, { timeout: 240000 });
      await page.evaluate(async () => {
        window.__game.hold(true);
        const cameraUrl = performance.getEntriesByType('resource').find(r => new URL(r.name).pathname === '/src/render/camera.ts')?.name;
        const { FollowCamera } = await import(cameraUrl ?? '/src/render/camera.ts');
        const update = FollowCamera.prototype.update;
        FollowCamera.prototype.update = function (x, z, vx, vz, dt, y) { this.snap(x, z, y); update.call(this, x, z, 0, 0, dt, y); };
      });
      await page.waitForTimeout(6000);
      for (const [x, z] of places) {
        await page.evaluate(([x, z]) => Object.assign(window.__game.sim().player, { x, z, px: x, pz: z }), [x, z]);
        await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); });
        shots.push(await page.screenshot({ type: 'png', timeout: 180000 }));
      }
      if (errors.length) console.log(profile, stage, errors.slice(0, 3));
      await page.close();
    }
    // shots: before-altstadt, before-forest, after-altstadt, after-forest → rows by place, before left.
    const tiles = await Promise.all([0, 2, 1, 3].map(i => sharp(shots[i]).resize(960, 540).toBuffer()));
    const file = `docs/proof/t1b/ground-${profile === 'Leistung' ? 'leistung' : 'qualitaet'}.jpg`;
    await sharp({ create: { width: 1924, height: 1084, channels: 3, background: '#fff' } })
      .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 964, top: Math.floor(i / 2) * 544 })))
      .jpeg({ quality: 78, mozjpeg: true }).toFile(file);
    console.log(file);
  }
} finally { await browser.close(); }
