import { expect, test } from '@playwright/test';

const SAVE = {
  v: 1, difficulty: 'schwer',
  profile: {
    inventory: { bag: [], scrap: 42, materials: {}, mods: {}, tips: { intro: 1, loot: 1, perk: 1 } },
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

test('M13: the camp spends Schrott, keeps the checkpoint and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (!localStorage.getItem('ruinenstadt-berlin.save')) localStorage.setItem('ruinenstadt-berlin.save', JSON.stringify({ ...s, profile: { ...s.profile, inventory: { ...s.profile.inventory, scrap: 100 } } }));
  }, SAVE);
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#open-camp')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#open-camp').click();
  await page.locator('[data-up="dmg"]').click();
  await expect(page.locator('.camp-msg')).toHaveText('Schärfen · Stufe 1');
  await page.locator('[data-close]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.save')!));
  expect(saved.profile.inventory.scrap).toBe(81);
  expect(saved.profile.statContext.upgrades.dmg).toBe(1);
  expect(saved.run.index).toBe(1);
  await page.reload();
  await expect(page.locator('#resume')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#resume').click();
  expect(await page.evaluate(() => window.__game!.sim().statContext.upgrades.dmg)).toBe(1);
  expect(errors).toEqual([]);
});

test('M17: the intro cards come once before the first run', async ({ page }) => {
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#play').click();
  await expect(page.locator('#intro')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.locator('#intro [data-intro="next"]').click();
  await expect(page.locator('#intro h2')).toHaveText('Steuerung');
  await page.locator('#intro [data-intro="done"]').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.save')!).profile.inventory.tips.intro)).toBe(1);
});

test('Hauptmenü in the pause menu returns to the title; Weiter resumes there', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => { if (!localStorage.getItem('ruinenstadt-berlin.save')) localStorage.setItem('ruinenstadt-berlin.save', JSON.stringify(s)); }, SAVE);
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#resume')).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator('#play')).toContainText('Ausrüstung bleibt');
  await page.locator('#resume').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#menu-btn').click();
  await page.locator('[data-t="opt"]').click();
  await page.locator('#to-title').click();
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#resume')).toContainText('Kampf 2');
  await page.locator('#resume').click();
  expect(await page.evaluate(() => window.__game!.sim().run.index)).toBe(1);
  expect(errors).toEqual([]);
});
