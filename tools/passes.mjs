// Dev tool: per-pass draw call and triangle breakdown of one frame at GL level, grouped by
// framebuffer and viewport (counts are GPU independent; software frame times are not fps).
// usage: [PORT=5173] [FRAMES=4] node tools/passes.mjs "<query>" [x,z ...]
// Measures at the start and after teleporting the hero to each x,z. FRAMES=N records N consecutive
// frames each, on a fake 60 Hz frame clock, so frame-rate dependent work (the Leistung shadow map
// rate) shows as it would at 60 fps; it prints one summary line per frame.
import { chromium } from 'playwright';
const [query, ...spots] = process.argv.slice(2);
const FRAMES = Math.max(1, Number(process.env.FRAMES ?? 1) || 1);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.addInitScript((fake60) => {
  if (fake60) {
    // Every animation frame advances the clock by exactly 1/60 s (callbacks of one frame share it).
    const raf = window.requestAnimationFrame.bind(window);
    let real = -1, t = 0;
    window.requestAnimationFrame = (cb) => raf((ts) => { if (ts !== real) { real = ts; t += 1000 / 60; } cb(t); });
  }
  const P = WebGL2RenderingContext.prototype;
  const ids = new WeakMap(); let next = 1;
  const st = { fb: 0, vp: '', rec: false, frame: [] };
  window.__gl = st;
  const bind = P.bindFramebuffer;
  P.bindFramebuffer = function (t, f) { if (f && !ids.has(f)) ids.set(f, next++); st.fb = f ? ids.get(f) : 0; return bind.call(this, t, f); };
  const vp = P.viewport;
  P.viewport = function (x, y, w, h) { st.vp = w + 'x' + h; return vp.call(this, x, y, w, h); };
  const log = (n, inst, mode) => { if (st.rec) st.frame.push([st.fb, st.vp, mode === 4 ? Math.floor(n / 3) * inst : 0, inst]); };
  const de = P.drawElements; P.drawElements = function (m, n, t, o) { log(n, 1, m); return de.call(this, m, n, t, o); };
  const da = P.drawArrays; P.drawArrays = function (m, f, n) { log(n, 1, m); return da.call(this, m, f, n); };
  const dei = P.drawElementsInstanced; P.drawElementsInstanced = function (m, n, t, o, c) { log(n, c, m); return dei.call(this, m, n, t, o, c); };
  const dai = P.drawArraysInstanced; P.drawArraysInstanced = function (m, f, n, c) { log(n, c, m); return dai.call(this, m, f, n, c); };
}, FRAMES > 1);
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 120000 });
// The renderer exists (software GL takes about 30 s to build and compile it).
await page.waitForFunction(() => window.__game?.perf() != null, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const record = (n) => page.evaluate((n) => new Promise((res) => {
  const g = window.__gl, frames = [];
  const next = () => {
    if (g.rec) frames.push(g.frame);
    if (frames.length === n) { g.rec = false; res(frames); return; }
    g.frame = []; g.rec = true; requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
}), n);
const measure = async (label) => {
  const frames = await record(FRAMES);
  if (FRAMES > 1) {
    // The sun shadow map is the only square target of profile size (2048 or 1024).
    frames.forEach((f, i) => {
      const sh = f.filter(([, vp]) => vp === '2048x2048' || vp === '1024x1024');
      console.log(`  frame ${i + 1}: calls ${f.length} tris ${f.reduce((a, d) => a + d[2], 0)} | shadow pass calls ${sh.length} tris ${sh.reduce((a, d) => a + d[2], 0)}`);
    });
  }
  const frame = frames[0];
  const by = new Map();
  for (const [fb, vp, tris, inst] of frame) {
    const k = fb + ' ' + vp; const e = by.get(k) ?? { calls: 0, tris: 0, small: 0, inst: 0 };
    e.calls++; e.tris += tris; if (tris < 200) e.small++; if (inst > 1) e.inst++; by.set(k, e);
  }
  const rows = [...by].filter(([, e]) => e.calls > 3).map(([k, e]) => `${k}: calls ${e.calls} tris ${e.tris} (<200 tris: ${e.small}, instanced: ${e.inst})`);
  const tot = frame.reduce((a, f) => a + f[2], 0);
  console.log(`## ${label}: total calls ${frame.length} tris ${tot} | perf ${JSON.stringify(await page.evaluate(() => window.__game?.perf()))}`);
  for (const r of rows) console.log('  ' + r);
};
await measure('start');
for (const s of spots) {
  const [x, z] = s.split(',').map(Number);
  await page.evaluate(([x, z]) => { const p = window.__game.sim().player; p.x = p.px = x; p.z = p.pz = z; }, [x, z]);
  await page.waitForTimeout(5000);
  await measure(s);
}
await browser.close();
