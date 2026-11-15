import { expect, test, type Page } from '@playwright/test';

/** Collects page errors and console errors (shader compile errors show up there). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test('scene loads, play starts, the fight runs, no page errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?profile=Leistung&seed=7&debug=perf');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#play').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#title')).toBeHidden();

  // Walk and swing: the sim must advance and consume the buffered attack.
  await page.keyboard.down('KeyW');
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 40, null, { timeout: 90_000 });
  await page.keyboard.up('KeyW');
  const state = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    const s = g.sim();
    return { phase: g.phase(), swings: s.player.swing, z: s.player.z, enemies: s.enemies.length, calls: g.perf()?.calls ?? 0 };
  });
  expect(state).not.toBeNull();
  expect(state?.phase).toBe('play');
  expect(state?.swings).toBeGreaterThan(0);
  expect(state?.z).toBeLessThan(2.5);
  expect(state?.enemies).toBeGreaterThan(0);
  expect(state?.calls).toBeGreaterThan(10);

  await page.screenshot({ path: testInfo.outputPath('courtyard-leistung.png') });
  expect(errors).toEqual([]);
});

test('Qualität renders without errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?profile=Qualität&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 110_000 });
  await page.screenshot({ path: testInfo.outputPath('courtyard-qualitaet.png'), timeout: 110_000 });
  expect(errors).toEqual([]);
});

test('options menu pauses the fight', async ({ page }) => {
  await page.goto('/?profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 90_000 });
  await page.locator('#menu-btn').click();
  await expect(page.locator('#options')).toBeVisible();
  const tick = await page.evaluate(() => window.__game?.sim().tick ?? 0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__game?.sim().tick ?? 0)).toBe(tick);
  await page.locator('#close-options').click();
  await page.waitForFunction((t) => (window.__game?.sim().tick ?? 0) > t, tick, { timeout: 60_000 });
});
