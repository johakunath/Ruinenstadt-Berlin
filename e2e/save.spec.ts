import { expect, test } from '@playwright/test';

const SAVE = {
  v: 1, difficulty: 'schwer',
  profile: {
    inventory: { bag: [], scrap: 42, materials: {}, mods: {}, tips: { intro: 1, loot: 1, perk: 1 } },
    equipment: { w: { id: 0, slot: 'w', kind: 'blade', base: 'rohr', name: 'Rostige Klinge', rarity: 0, value: 10, itemLevel: 1, affixes: [] } },
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
  await expect(page.locator('#hud')).toBeVisible({ timeout: 90_000 });
  const s = await page.evaluate(() => { const g = window.__game!.sim(); return { index: g.run.index, d: g.difficulty, scrap: g.inventory.scrap, kills: g.kills, hp: Math.round(g.player.hp) }; });
  expect(s).toEqual({ index: 1, d: 'schwer', scrap: 42, kills: 9, hp: 30 });
  expect(errors).toEqual([]);

  // Second load: Neu discards the run, keeps scrap and the chosen difficulty.
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__game?.phase() === 'play', null, { timeout: 90_000 });
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

test('M20: the walkable camp opens with the S3, spends Schrott at a station, keeps the Köpenick checkpoint; the train leads back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (!localStorage.getItem('ruinenstadt-berlin.save')) localStorage.setItem('ruinenstadt-berlin.save', JSON.stringify({ ...s, profile: { ...s.profile, inventory: { ...s.profile.inventory, scrap: 100, camp: { stations: { zeug: 1 }, stash: [], freed: [0, 100] } } } }));
  }, SAVE);
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#open-camp')).toBeVisible({ timeout: 90_000 });
  await page.locator('#open-camp').click();
  // The camp page has no title: it loads straight into the station hall.
  await page.waitForURL(/map=lager/, { timeout: 30_000 });
  await page.waitForFunction(() => window.__game?.phase() === 'play', null, { timeout: 120_000 });
  await expect(page.locator('#title')).toBeHidden();
  await page.evaluate(() => { const p = window.__game!.sim().player; p.x = p.px = 56; p.z = p.pz = 43.05; });
  await expect(page.locator('#talk-btn')).toContainText('Zeughaus', { timeout: 30_000 });
  await page.keyboard.press('KeyF');
  await expect(page.locator('#camp')).toBeVisible();
  await page.locator('[data-up="dmg"]').click();
  await expect(page.locator('.camp-msg')).toHaveText('Schärfen · Stufe 1');
  await page.locator('#camp [data-close]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.save')!));
  expect(saved.profile.inventory.scrap).toBe(81);
  expect(saved.profile.statContext.upgrades.dmg).toBe(1);
  expect(saved.run.index).toBe(1);
  // The train: the network map, Köpenick, and straight back into the waiting checkpoint.
  await page.evaluate(() => { const p = window.__game!.sim().player; p.x = p.px = 12; p.z = p.pz = 16.9; });
  await expect(page.locator('#talk-btn')).toContainText('Netzplan', { timeout: 30_000 });
  await page.keyboard.press('KeyF');
  await expect(page.locator('#netboard')).toBeVisible();
  await page.locator('#netboard [data-stop="0"]').dispatchEvent('click');
  await page.locator('#netboard [data-ride]').click();
  await page.waitForURL((u) => !/map=lager/.test(u.search), { timeout: 30_000 });
  await page.waitForFunction(() => window.__game?.phase() === 'play', null, { timeout: 120_000 });
  expect(await page.evaluate(() => ({ dmg: window.__game!.sim().statContext.upgrades.dmg, index: window.__game!.sim().run.index }))).toEqual({ dmg: 1, index: 1 });
  expect(errors).toEqual([]);
});

test('M20: before the S3 the camp is out of reach', async ({ page }) => {
  await page.addInitScript((s) => { if (!localStorage.getItem('ruinenstadt-berlin.save')) localStorage.setItem('ruinenstadt-berlin.save', JSON.stringify({ ...s, run: null, profile: { ...s.profile, inventory: { ...s.profile.inventory, camp: { stations: {}, stash: [], freed: [0] } } } })); }, SAVE);
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator('#open-camp')).toBeHidden();
  await expect(page.locator('#go-tunnel')).toBeVisible();
  await page.goto('/?profile=Leistung&map=lager');
  await page.waitForURL((u) => !/map=lager/.test(u.search), { timeout: 30_000 });
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
});

test('M17: the intro cards come once before the first run', async ({ page }) => {
  await page.goto('/?profile=Leistung');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#play').click();
  await expect(page.locator('#intro')).toBeVisible({ timeout: 90_000 });
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
  await expect(page.locator('#hud')).toBeVisible({ timeout: 90_000 });
  await page.locator('#menu-btn').click();
  await page.locator('#menu-opt').click();
  await page.locator('#to-title').click();
  await expect(page.locator('#optv')).toBeHidden();
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#resume')).toContainText('Kampf 2');
  await page.locator('#resume').click();
  expect(await page.evaluate(() => window.__game!.sim().run.index)).toBe(1);
  expect(errors).toEqual([]);
});

test('U3: a profile change in a run reloads straight back into the run', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => { if (!localStorage.getItem('ruinenstadt-berlin.save')) localStorage.setItem('ruinenstadt-berlin.save', JSON.stringify(s)); }, SAVE);
  await page.goto('/?profile=Leistung');
  await page.locator('#resume').click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 90_000 });
  await page.locator('#menu-btn').click();
  await page.locator('#menu-opt').click();
  await page.locator('#optv [data-opt="profile"] [data-v="qualitaet"]').click();
  await page.waitForURL(/profile=Qualit/);
  await page.waitForFunction(() => window.__game?.phase() === 'play', null, { timeout: 150_000 });
  expect(await page.evaluate(() => window.__game!.sim().run.index)).toBe(1);
  await expect(page.locator('#title')).toBeHidden();
  expect(errors).toEqual([]);
});
