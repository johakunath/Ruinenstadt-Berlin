// T1b rail look: `?rails=old` (roughness 0.34) against the default (0.5) near lamps in Köpenick, per profile one
// sheet docs/proof/t1b/rails-<profile>.jpg (rows: start square, street at 10, -86; columns: old | new). Run against
// the dev server; seed 7, sim held, the camera snapped to the hero (capture fixture only, as in proof-tram.mjs).
// usage: [PORT=5179] node tools/proof-rails.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = 'docs/proof/t1b';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const places = [['start', null], ['street', [10, -86]]];
try {
  for (const profile of ['Qualität', 'Leistung']) {
    const shots = [];
    for (const rails of ['old', 'new']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://localhost:${process.env.PORT ?? 5179}/?autostart&seed=7&profile=${encodeURIComponent(profile)}&rails=${rails}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game && window.__game.phase() !== 'title' && document.getElementById('loading')?.hidden === true, null, { timeout: 240000 });
      await page.evaluate(async () => {
        window.__game.hold(true);
        const cameraUrl = performance.getEntriesByType('resource').find(r => new URL(r.name).pathname === '/src/render/camera.ts')?.name;
        const { FollowCamera } = await import(cameraUrl ?? '/src/render/camera.ts');
        const update = FollowCamera.prototype.update;
        FollowCamera.prototype.update = function (x, z, vx, vz, dt, y) { this.snap(x, z, y); update.call(this, x, z, 0, 0, dt, y); };
      });
      await page.waitForTimeout(6000);
      for (const [, at] of places) {
        if (at) await page.evaluate(([x, z]) => Object.assign(window.__game.sim().player, { x, z, px: x, pz: z }), at);
        await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); });
        shots.push({ rails, img: await page.screenshot({ type: 'png', timeout: 180000 }) });
      }
      if (errors.length) console.log(profile, rails, errors.slice(0, 3));
      await page.close();
    }
    // shots: old-start, old-street, new-start, new-street → rows by place, old left, new right.
    const order = [0, 2, 1, 3].map(i => shots[i].img);
    const tiles = await Promise.all(order.map(b => sharp(b).resize(960, 540).toBuffer()));
    const file = `${out}/rails-${profile === 'Leistung' ? 'leistung' : 'qualitaet'}.jpg`;
    await sharp({ create: { width: 1924, height: 1084, channels: 3, background: '#fff' } })
      .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 964, top: Math.floor(i / 2) * 544 })))
      .jpeg({ quality: 78, mozjpeg: true }).toFile(file);
    console.log(file);
  }
} finally { await browser.close(); }
