// Dev tool (M13b): screenshots of the Späti trade screen, every tab at 1280×720 (mouse), 844×390 (touch) and
// 1280×800 (Steam Deck: a fake pad, so the pad hints show and RB, D-pad and A drive the screen).
// usage: npx vite --port 5176 --strictPort (dev server: the page imports sim modules for real items), then
//        node tools/trade-proof.mjs [outDir=docs/proof/m13b] [port=5176]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = process.argv[2] ?? 'docs/proof/m13b';
const port = process.argv[3] ?? '5176';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shot = async (page, name) => sharp(await page.screenshot()).webp({ quality: 86 }).toFile(`${out}/${name}.webp`);

for (const [w, h, mode] of [[1280, 720, 'mouse'], [844, 390, 'touch'], [1280, 800, 'deck']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mode === 'touch', isMobile: mode === 'touch' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  if (mode === 'deck') {
    // A standard pad that a script can press: window.__pad.press(i) holds button i for two frames.
    await page.addInitScript(() => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
      const pad = { id: 'Steam Deck', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0, vibrationActuator: null };
      window.__pad = { press: (i) => { buttons[i].pressed = true; buttons[i].value = 1; setTimeout(() => { buttons[i].pressed = false; buttons[i].value = 0; }, 120); } };
      navigator.getGamepads = () => [pad];
    });
  }
  await page.goto(`http://localhost:${port}/?profile=Leistung&seed=7&autostart`);
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 1, null, { timeout: 240000 });
  await page.evaluate(async () => {
    const g = window.__game, s = g.sim();
    const { makeItem } = await import('/src/sim/items.ts');
    const { Rng } = await import('/src/sim/math.ts');
    const rng = new Rng(5);
    // A hero halfway through Köpenick: some blessings, a mixed bag, hurt, Schrott in the pocket.
    s.lootWaves = 8;
    for (let i = 0; i < 11; i++) s.inventory.bag.push(makeItem(rng, s.lootCtx, 4 + (i % 5), i % 6 === 0 ? 2 : i % 3 === 0 ? 1 : 0));
    g.setLoadout(s.equipment, { perks: { dmg: 2, crit: 1, rate: 3, second: 1, hp: 1 } });
    s.abilities.quality = { dmg: 1 };
    s.inventory.scrap = 840;
    const r = s.level.rests.find((x) => x.desk);
    s.player.x = s.player.px = r.desk.x; s.player.z = s.player.pz = r.desk.z;
    g.step({}, 2);
    s.player.hp = Math.round(s.stats.maxHp * 0.62);
    s.content.tradeAt = s.level.rests.indexOf(r);
    s.content.tradeOpen = true;
  });
  await page.waitForSelector('#trade:not([hidden])');
  await page.waitForTimeout(600);
  const tab = async (t) => {
    if (mode === 'deck') {
      // RB until the tab is on (the pad path, not a click).
      for (let i = 0; i < 3 && !(await page.locator(`[data-ttab="${t}"].on`).count()); i++) { await page.evaluate(() => window.__pad.press(5)); await page.waitForTimeout(400); }
    } else if (mode === 'touch') await page.locator(`[data-ttab="${t}"]`).tap();
    else await page.locator(`[data-ttab="${t}"]`).click();
    await page.waitForTimeout(300);
  };
  // Waren: pick the second offer (mouse click, touch tap, pad D-pad right).
  if (mode === 'deck') { await page.evaluate(() => window.__pad.press(15)); await page.waitForTimeout(400); }
  else if (mode === 'touch') await page.locator('[data-pick="g1"]').tap();
  else await page.locator('[data-pick="g1"]').click();
  await page.waitForTimeout(300);
  await shot(page, `waren-${w}x${h}`);
  await tab('segen');
  await shot(page, `segen-${w}x${h}`);
  if (mode === 'mouse') {
    await page.locator('[data-swap-start="0"]').click();
    await page.waitForTimeout(300);
    await shot(page, `segen-tauschen-${w}x${h}`);
    await page.keyboard.press('Escape');
  }
  await tab('verkaufen');
  if (mode === 'deck') { for (const b of [15, 15, 13]) { await page.evaluate((i) => window.__pad.press(i), b); await page.waitForTimeout(300); } }
  else if (mode === 'touch') await page.locator('[data-pick="b2"]').tap();
  else await page.locator('[data-pick="b2"]').click();
  await page.waitForTimeout(300);
  await shot(page, `verkaufen-${w}x${h}`);
  await ctx.close();
  console.log(`${w}x${h} done`);
}
await browser.close();
