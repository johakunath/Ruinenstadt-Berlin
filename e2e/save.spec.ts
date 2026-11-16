import { expect, test } from '@playwright/test';

const SAVE = {
  v: 1, difficulty: 'schwer',
  profile: {
    inventory: { bag: [], scrap: 42, materials: {}, mods: {} },
    equipment: { w: { id: 0, slot: 'w', kind: 'blade', base: 'rohr', name: 'Rostiges Rohr', rarity: 0, value: 10, itemLevel: 1, affixes: [] } },
    statContext: { upgrades: {}, perks: {}, camp: {}, survivors: {} },
  },
  run: { map: 'Köpenick', index: 1, wave: -1, hp: 30, x: 0, z: 0, facing: 0, rng: 123, nextId: 50, itemId: 0, lootWaves: 2, kills: 9, broken: [], restSeen: [], drops: [] },
};

test('M6: Weiter resumes the saved checkpoint, Neu keeps gear and drops the run', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (!localStorage.getItem('ruinenstadt-berlin.save')) localStorage.setItem('ruinenstadt-berlin.save', JSON.stringify(s));
  }, SAVE);
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#resume')).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator('#title-diff .on')).toHaveText(/Schwer/);
  await page.locator('#resume').click();
  await expect(page.locator('#hud')).toBeVisible();
  const s = await page.evaluate(() => { const g = window.__game!.sim(); return { index: g.run.index, d: g.difficulty, scrap: g.inventory.scrap, kills: g.kills, hp: Math.round(g.player.hp) }; });
  expect(s).toEqual({ index: 1, d: 'schwer', scrap: 42, kills: 9, hp: 30 });
  expect(errors).toEqual([]);

  // Second load: Neu discards the run, keeps scrap and the chosen difficulty.
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#play').click();
  const n = await page.evaluate(() => { const g = window.__game!.sim(); return { index: g.run.index, scrap: g.inventory.scrap, d: g.difficulty }; });
  expect(n).toEqual({ index: 0, scrap: 42, d: 'schwer' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.save')!).run)).toBeNull();
});

test('M6: damaged save is ignored', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ruinenstadt-berlin.save', '{"v":1,"difficulty":'));
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator('#resume')).toBeHidden();
});
