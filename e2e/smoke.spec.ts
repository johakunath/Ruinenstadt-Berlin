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
  await page.goto('/?map=hof&profile=Leistung&seed=7&debug=perf');
  // U3: the start screen comes up without the game; Spielen loads it.
  await expect(page.locator('#play')).toBeEnabled({ timeout: 90_000 });
  expect(await page.evaluate(() => window.__game === undefined)).toBe(true);
  await page.locator('#play').click();
  // M17: a fresh profile sees the intro cards first.
  await page.locator('#intro .iskip').click();
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
  await page.goto('/?map=hof&profile=Qualität&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 110_000 });
  await page.screenshot({ path: testInfo.outputPath('courtyard-qualitaet.png'), timeout: 110_000 });
  expect(errors).toEqual([]);
});

test('options pause the fight and persist independent music and volume controls', async ({ page }) => {
  await page.goto('/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 90_000 });
  await page.locator('#menu-btn').click();
  await page.locator('#menu-opt').click();
  await expect(page.locator('#optv')).toBeVisible();
  const music = page.locator('#optv [data-opt="music"]');
  await expect(music).toHaveAttribute('aria-checked', 'true');
  await music.click();
  await expect(music).toHaveAttribute('aria-checked', 'false');
  await page.locator('#optv [data-opt="volume"]').fill('35');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.options') ?? '{}') as { music: boolean; volume: number });
  expect(stored.music).toBe(false);
  expect(stored.volume).toBe(.35);
  const tick = await page.evaluate(() => window.__game?.sim().tick ?? 0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__game?.sim().tick ?? 0)).toBe(tick);
  await page.locator('#opt-close').click();
  await expect(page.locator('#optv')).toBeHidden();
  await page.locator('#menu-close').click();
  await page.waitForFunction((t) => (window.__game?.sim().tick ?? 0) > t, tick, { timeout: 60_000 });
  await page.reload();
  await page.locator('#menu-btn').click();
  await page.locator('#menu-opt').click();
  await expect(music).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#optv [data-opt="volume"]')).toHaveValue('35');
  await music.click();
});

test('U3: start screen stores options without loading the game; fullscreen button and options screen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?map=hof&seed=7');
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#fsb')).toBeVisible();
  // A profile pick on the start screen is stored, the page stays (no reload, no game).
  await page.evaluate(() => { (window as unknown as { marker: number }).marker = 1; });
  await page.locator('#title [data-opt="profile"] [data-v="leistung"]').click();
  await page.locator('#title [data-opt="profile"] [data-v="qualitaet"]').click();
  await page.locator('#title [data-opt="profile"] [data-v="leistung"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.options') ?? '{}').profile)).toBe('leistung');
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  await page.locator('#title [data-opt="sound"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruinenstadt-berlin.options') ?? '{}').sound)).toBe(false);
  // The options screen opens without the game, shows the three controls graphics and syncs the switches.
  await page.locator('#open-options').click();
  await expect(page.locator('#optv [data-opt="sound"]')).toHaveAttribute('aria-checked', 'false');
  for (const d of ['touch', 'key', 'pad']) { await page.locator(`#optv [data-opt="dev"] [data-v="${d}"]`).click(); await expect(page.locator('#optv .cgfx')).toBeVisible(); }
  await expect(page.locator('#run-actions')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#optv')).toBeHidden();
  expect(await page.evaluate(() => window.__game === undefined)).toBe(true);
  // Spielen loads the game with the stored profile.
  await page.locator('#play').click();
  await page.locator('#intro .iskip').click({ timeout: 90_000 });
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#fsb')).toBeVisible();
  expect(await page.evaluate(() => window.__game!.phase())).toBe('play');
  expect(errors).toEqual([]);
});

test('Köpenick: the first encounter starts, waves spawn, the map opens and pauses', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 110_000 });
  await expect(page.locator('#objective')).toBeVisible();
  await expect(page.locator('#obj-text')).toContainText('Bahnhofsvorplatz');
  // Walk into the first encounter.
  await page.evaluate(() => {
    const s = window.__game!.sim();
    const e = s.level.encounters[0]!;
    s.player.x = s.player.px = e.x;
    s.player.z = s.player.pz = e.z;
  });
  // Sleeping lot guards exist before any fight, so wait for the encounter itself, then for its wave.
  await page.waitForFunction(() => window.__game?.sim().run.phase === 'fight', null, { timeout: 90_000 });
  await page.waitForFunction(() => (window.__game?.sim().enemies.some((e) => !e.guard) ?? false), null, { timeout: 90_000 });
  expect(await page.evaluate(() => window.__game!.sim().run.phase)).toBe('fight');
  await expect(page.locator('#obj-text')).toContainText('Welle 1/');
  await page.screenshot({ path: testInfo.outputPath('koepenick-fight.png'), timeout: 110_000 });

  await page.keyboard.press('m');
  await expect(page.locator('.map-svg svg')).toBeVisible();
  const tick = await page.evaluate(() => window.__game?.sim().tick ?? 0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__game?.sim().tick ?? 0)).toBe(tick);
  await page.screenshot({ path: testInfo.outputPath('koepenick-karte.png'), timeout: 110_000 });
  await page.locator('#menu-close').click();
  await expect(page.locator('#menu')).toBeHidden();
  await page.keyboard.press('m');
  await expect(page.locator('#touch')).toBeHidden();
  await page.locator('#menu-close').click();
  await expect(page.locator('#menu')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Köpenick renders on Qualität without errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?profile=Qualität&seed=7&autostart&at=12');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 110_000 });
  await page.screenshot({ path: testInfo.outputPath('koepenick-qualitaet.png'), timeout: 110_000 });
  expect(errors).toEqual([]);
});

test('equipment changes combat and HUD health, and survives a retry', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 90_000 });
  const result = await page.evaluate(() => {
    const g = window.__game!, sim = g.sim(), p = sim.player;
    g.hold(true);
    const enemy = sim.enemies[0]!;
    // No class: the D9 weapon-type bonus would hide the equipped damage under test.
    enemy.def = { ...enemy.def, speed: 0, attackRange: 0, knockbackTaken: 0, classes: [] };
    Object.assign(enemy, { x: 3, px: 3, z: 1.5, pz: 1.5, hp: 1000, maxHp: 1000, state: 'chase', stateT: 0, kx: 0, kz: 0 });
    sim.enemies = [enemy]; sim.spawnT = Infinity;
    Object.assign(p, { x: 3, px: 3, z: 0, pz: 0, facing: 0, pfacing: 0 });
    const weapon = { ...sim.equipment.w!, value: 20, affixes: [{ id: 'crit' as const, value: -8 }, { id: 'as' as const, value: 100 }] };
    g.setLoadout({ w: weapon, a: { ...weapon, id: 1, slot: 'a', kind: 'armor', value: 100, affixes: [] } });
    p.hp = 100; // Same absolute HP as before, now half of the equipped max.
    g.step({ attack: true }, 1);
    const timing = { windup: p.attack!.windup, active: p.attack!.active };
    g.step({}, 35);
    return { maxHp: sim.stats.maxHp, hp: p.hp, damage: 1000 - enemy.hp, timing };
  });
  expect(result).toMatchObject({ maxHp: 200, hp: 100, damage: 20 });
  expect(result.timing.windup).toBeCloseTo(.04);
  expect(result.timing.active).toBeCloseTo(.05);
  await expect(page.locator('#hp-fill')).toHaveCSS('transform', 'matrix(0.5, 0, 0, 1, 0, 0)', { timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('m3b-equipped-health.png') });

  await page.evaluate(() => {
    const g = window.__game!, p = g.sim().player;
    p.hp = 0; p.state = 'dead'; g.hold(false);
  });
  await expect(page.locator('#retry')).toBeVisible({ timeout: 90_000 });
  await page.locator('#retry').click();
  const retry = await page.evaluate(() => {
    const s = window.__game!.sim();
    return { maxHp: s.stats.maxHp, hp: s.player.hp, damage: s.stats.damage, speed: s.stats.attackSpeed };
  });
  expect(retry).toEqual({ maxHp: 200, hp: 200, damage: 20, speed: 2 });
  expect(errors).toEqual([]);
});

test('M19: the S3 tunnel loads, the first fight starts, the map shows the tubes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?map=tunnel&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 150_000 });
  await expect(page.locator('#obj-text')).toContainText('Tunnelmund');
  expect(await page.evaluate(() => window.__game!.sim().enemies.filter(e => e.sleep !== undefined).length)).toBe(1);
  await page.evaluate(() => { const s = window.__game!.sim(), e = s.level.encounters[0]!; s.player.x = s.player.px = e.x; s.player.z = s.player.pz = e.z; });
  await page.waitForFunction(() => window.__game!.sim().run.phase === 'fight', null, { timeout: 90_000 });
  await page.keyboard.press('m');
  await expect(page.locator('.map-svg svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('M15: Xhain loads on the Warschauer Brücke, the first fight starts, the map opens', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?map=xhain&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 150_000 });
  await expect(page.locator('#obj-text')).toContainText('Warschauer Straße');
  await page.evaluate(() => { const s = window.__game!.sim(), e = s.level.encounters[0]!; s.player.x = s.player.px = e.x; s.player.z = s.player.pz = e.z; });
  await page.waitForFunction(() => window.__game!.sim().run.phase === 'fight', null, { timeout: 90_000 });
  await page.keyboard.press('m');
  await expect(page.locator('.map-svg svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('M15: Alexanderplatz loads at S Hackescher Markt in afternoon light, the first fight starts, the map opens', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?map=alex&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 150_000 });
  await expect(page.locator('#obj-text')).toContainText('Lustgarten');
  await page.evaluate(() => { const s = window.__game!.sim(), e = s.level.encounters[0]!; s.player.x = s.player.px = e.x; s.player.z = s.player.pz = e.z; });
  await page.waitForFunction(() => window.__game!.sim().run.phase === 'fight', null, { timeout: 90_000 });
  await page.keyboard.press('m');
  await expect(page.locator('.map-svg svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('M15 step 7: the Weltzeituhr wakes up on its base in the final fight and fights on its legs', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?map=alex&profile=Leistung&seed=7&at=12&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 150_000 });
  await page.evaluate(() => { const s = window.__game!.sim(), e = s.level.encounters[s.run.index]!; s.player.x = s.player.px = e.x; s.player.z = s.player.pz = e.z; s.player.invuln = 1e9; });
  await page.waitForFunction(() => window.__game!.sim().enemies.some((e) => e.kind === 'weltzeituhr' && (e.wake ?? 0) > 0), null, { timeout: 90_000 });
  await page.waitForFunction(() => window.__game!.sim().enemies.some((e) => e.kind === 'weltzeituhr' && (e.wake ?? 0) <= 0 && e.state !== 'dead'), null, { timeout: 90_000 });
  await expect(page.locator('#bossbar')).toBeVisible();
  expect(errors).toEqual([]);
});

test('M15: Mitte loads at U Potsdamer Platz, the first fight starts, the map opens', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?map=mitte&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 150_000 });
  await expect(page.locator('#obj-text')).toContainText('Leipziger Straße');
  await page.evaluate(() => { const s = window.__game!.sim(), e = s.level.encounters[0]!; s.player.x = s.player.px = e.x; s.player.z = s.player.pz = e.z; });
  await page.waitForFunction(() => window.__game!.sim().run.phase === 'fight', null, { timeout: 90_000 });
  await page.keyboard.press('m');
  await expect(page.locator('.map-svg svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('H1: the inventory doll shows the live hero and turns her on drag and keys', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 5, null, { timeout: 90_000 });
  await page.keyboard.press('i');
  const doll = page.locator('canvas.inv-portrait');
  await expect(doll).toBeVisible({ timeout: 30_000 });
  /** Count of lit pixels and a hash of the picture. */
  const read = (): Promise<{ lit: number; hash: number }> => doll.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    let hash = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i]! + d[i + 1]! + d[i + 2]! > 120) lit++;
      hash = (hash * 31 + d[i]! + d[i + 1]! * 3 + d[i + 2]! * 7) % 1_000_003;
    }
    return { lit, hash };
  });
  // Not blank: the hero is drawn over the dark background.
  await expect.poll(async () => (await read()).lit, { timeout: 60_000 }).toBeGreaterThan(300);
  const before = await read();
  const box = (await doll.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await read()).hash, { timeout: 30_000 }).not.toBe(before.hash);
  // Keys turn her while the doll has focus.
  await doll.focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: testInfo.outputPath('inventory-doll.png'), timeout: 110_000 });
  expect(errors).toEqual([]);
});
