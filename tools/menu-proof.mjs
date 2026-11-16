// Dev tool (U1/U2): menu screenshots at phone landscape, tablet and desktop against `npm run preview`.
// usage: node tools/menu-proof.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'docs/proof/u1-menu';
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, touch] of [[844, 390, true], [1280, 800, true], [1280, 720, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('http://localhost:4173/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 1, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__game, s = g.sim();
    const it = (o) => g.collectItem({ kind: 'armor', base: 'mantel', value: 60, itemLevel: 6, affixes: [{ id: 'regen', value: 1 }, { id: 'res', value: 4 }], rarity: 1, ...o });
    it({ id: 201, slot: 'a', name: 'Mantel des Spreegeists', rarity: 2, set: 'spree' });
    it({ id: 202, slot: 'w', kind: 'hammer', base: 'vorschlag', name: 'Schwerer Vorschlaghammer', value: 22, affixes: [{ id: 'dmg', value: 9 }, { id: 'crit', value: 3 }] });
    it({ id: 203, slot: 'h', kind: 'head', base: 'helm', name: 'Bauhelm', rarity: 0 });
    it({ id: 204, slot: 'r', kind: 'krit', base: 'ring', name: 'Leuchtender Ring', rarity: 3 });
    it({ id: 205, slot: 'f', kind: 'feet', base: 'stiefel', name: 'Stiefel', rarity: 0 });
    for (let i = 0; i < 6; i++) it({ id: 210 + i, slot: 'g', kind: 'hand', base: 'handschuh', name: 'Handschuhe', rarity: i % 3 });
    s.statContext.perks = { dmg: 2, crit: 1, fire: 1, second: 1, d_brand: 1 }; s.abilities.quality = { dmg: 1, fire: 2 };
    s.inventory.kodex = { kills: { walker: 12, runner: 3, 'e:flink': 1, feldwebel: 1 }, found: { herz: 1, mantel: 1 } };
  });
  await page.locator('#menu-btn').click();
  await page.locator('[data-bag="1"]').click();
  await page.screenshot({ path: `${out}/inventar-${w}x${h}.png` });
  for (const t of ['segen', 'kodex', 'opt']) { await page.locator(`[data-t="${t}"]`).click(); await page.screenshot({ path: `${out}/${t}-${w}x${h}.png` }); }
  await ctx.close();
}
await b.close();
