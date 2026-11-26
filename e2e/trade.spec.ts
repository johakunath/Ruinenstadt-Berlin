import { test, expect, type Page } from '@playwright/test';

/** A Späti stock on the courtyard (no expedition there): one gear offer, an Aufsatz, two blessing cards, one Stärkung. */
async function openSpati(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = window.__game!.sim(), w = s.equipment.w!;
    const piece = (id: number, rarity: 0 | 1 | 2 | 3, itemLevel: number) => ({ ...structuredClone(w), id, rarity, itemLevel, mods: [], name: `Teststück ${id}` });
    s.content.shops[0] = { offers: [{ item: piece(9001, 2, 20), price: 50 }], left: false, mod: { id: 'nagel' }, cards: [{ id: 'crit', level: 1, quality: 0 }, { id: 'rate', level: 2, quality: 1 }], ups: 1 };
    s.statContext.perks = { dmg: 2 };
    s.inventory.scrap = 5000;
    s.inventory.bag.push(piece(9101, 0, 3), piece(9102, 1, 4));
    s.content.tradeAt = 0;
    s.content.tradeOpen = true;
  });
  await expect(page.locator('#trade')).toBeVisible();
}

test('Späti trade screen: buy gear and an Aufsatz, buy, swap and strengthen blessings, sell, close', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 90000 });
  await openSpati(page);
  const sim = <T>(f: string): Promise<T> => page.evaluate(`(() => { const s = window.__game.sim(); return ${f}; })()`) as Promise<T>;
  // The sim waits while trading.
  const tick = await sim<number>('s.tick');
  await page.waitForTimeout(250);
  expect(await sim<number>('s.tick')).toBe(tick);
  await expect(page.locator('#trade .menu-tabb')).toHaveText(['Waren2', 'Segen3', 'Verkaufen2']);
  await page.screenshot({ path: info.outputPath('trade-waren-1280x720.png') });
  // Waren: the first offer shows; the first press picks it, a press on the picked tile buys it (P5).
  await page.locator('[data-pick="g0"]').click();
  expect(await sim<number>('s.inventory.bag.length')).toBe(2);
  await page.locator('[data-pick="g0"]').click();
  await expect.poll(() => sim<number>('s.inventory.bag.length')).toBe(3);
  expect(await sim<number>('s.inventory.scrap')).toBe(4950);
  await page.locator('[data-pick="mod"]').click();
  await page.locator('[data-buy]').click();
  expect(await sim<string[]>('s.equipment.w.mods')).toEqual(['nagel']);
  // Segen: buy a card, swap Kiezwut for the other (its two levels carry over), strengthen.
  await page.locator('[data-ttab="segen"]').click();
  await page.locator('[data-card="0"]').click();
  expect(await sim<number>('s.statContext.perks.crit')).toBe(1);
  await page.locator('[data-swap-start="1"]').click();
  await page.screenshot({ path: info.outputPath('trade-segen-swap-1280x720.png') });
  await page.locator('[data-swap="dmg"]').click();
  expect(await sim<number | undefined>('s.statContext.perks.dmg')).toBeUndefined();
  expect(await sim<number>('s.statContext.perks.rate')).toBe(2);
  await page.locator('[data-up="crit"]').click();
  expect(await sim<number>('s.statContext.perks.crit')).toBe(2);
  await expect(page.locator('[data-up]').first()).toBeDisabled();
  // Verkaufen: pick a bag piece, sell it.
  await page.locator('[data-ttab="verkaufen"]').click();
  await page.locator('[data-pick="b0"]').click();
  const before = await sim<number>('s.inventory.scrap');
  await page.locator('[data-sell]').click();
  expect(await sim<number>('s.inventory.bag.length')).toBe(2);
  expect(await sim<number>('s.inventory.scrap')).toBeGreaterThan(before);
  await page.screenshot({ path: info.outputPath('trade-verkaufen-1280x720.png') });
  // Escape closes; the run goes on.
  await page.keyboard.press('Escape');
  await expect(page.locator('#trade')).toBeHidden();
  expect(await sim<boolean>('s.content.tradeOpen')).toBe(false);
  await expect.poll(() => sim<number>('s.tick')).toBeGreaterThan(tick);
  expect(errors).toEqual([]);
});

test('trade screen on a phone: tabs and the second tap buys', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 90000 });
  await openSpati(page);
  // The first tap on another tile only picks it; the second buys.
  await page.locator('[data-pick="mod"]').tap();
  expect(await page.evaluate(() => window.__game!.sim().equipment.w!.mods ?? [])).toEqual([]);
  await page.locator('[data-pick="mod"]').tap();
  expect(await page.evaluate(() => window.__game!.sim().equipment.w!.mods)).toEqual(['nagel']);
  await page.locator('[data-ttab="segen"]').tap();
  await expect(page.locator('.tcard')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('trade-segen-844x390.png') });
  await page.locator('#trade .tr-x').tap();
  await expect(page.locator('#trade')).toBeHidden();
  await context.close();
});
