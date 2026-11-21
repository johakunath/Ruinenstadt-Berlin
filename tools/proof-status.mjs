// E1 proof: one enemy per element status (burning, corroded, shocked with a bolt, slowed, burning + corroded)
// round the hero, against the built game (`npm run build`, `npx vite preview --port 4173`).
// usage: [PORT=4173] node tools/proof-status.mjs "map=hof&autostart&profile=Ausgewogen&spawn=walker,walker,walker,walker,brute,runner" out.png
import { chromium } from 'playwright';
const [query = '', out = 'shot.png', w = '1280', h = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 400)); });
await page.goto(`http://localhost:${process.env.PORT ?? 4173}/?` + query, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 120000 }).catch((e) => errors.push('load timeout ' + e.message));
await page.waitForTimeout(4000);
const kinds = await page.evaluate(() => {
  const g = window.__game; g.hold(true);
  const s = g.sim(); const p = s.player;
  p.hp = p.maxHp = 99999;
  const es = s.enemies.filter((e) => e.state !== 'dead');
  const spots = [[-1.6, -2.6], [-1.2, 2.8], [1.0, 2.8], [3.2, 2.2], [-2.4, -0.4], [2.6, -0.4]];
  const set = () => {
    es.forEach((e, i) => { const q = spots[i % spots.length]; e.x = e.px = p.x + q[0]; e.z = e.pz = p.z + q[1]; e.state = 'chase'; e.stateT = 0; e.kx = e.kz = 0; });
    if (es[0]) { es[0].burn = 2; es[0].bdps = 0.001; }
    if (es[1]) es[1].acid = 3;
    if (es[3]) es[3].slow = 2;
    if (es[4]) { es[4].burn = 2; es[4].bdps = 0.001; es[4].acid = 3; }
    const hit = (e) => s.events.push({ type: 'hit', id: e.id, x: e.x, z: e.z, dx: 0, dz: 1, weight: 'light', killed: false, damage: 0, element: 'shock', quiet: true });
    if (es[2]) hit(es[2]);
    if (es[2] && es[5]) { s.events.push({ type: 'bolt', x0: es[2].x, z0: es[2].z, x1: es[5].x, z1: es[5].z }); hit(es[5]); }
    g.step({}, 1);
    es.forEach((e, i) => { const q = spots[i % spots.length]; e.x = e.px = p.x + q[0]; e.z = e.pz = p.z + q[1]; });
  };
  set();
  setInterval(set, 120);
  return es.map((e) => e.kind);
});
console.log('kinds', JSON.stringify(kinds));
await page.waitForTimeout(3500);
await page.screenshot({ path: out, timeout: 180000 });
console.log(JSON.stringify(await page.evaluate(() => window.__game?.perf())));
for (const e of errors.slice(0, 12)) console.log(e);
await browser.close();
