import { test,expect } from '@playwright/test';

test('powers, ultimate and blessing choice work through the real UI',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(()=>(window.__game?.sim().tick??0)>5,null,{timeout:90000});
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>(window.__game?.sim().abilities.powerCd??0)>0);
  await page.keyboard.press('KeyR');
  await page.waitForFunction(()=>(window.__game?.sim().abilities.ultimateCd??0)>0);
  await page.evaluate(()=>{const s=window.__game!.sim();s.abilities.offers=[{id:'dmg',level:1,quality:0},{id:'hp',level:2,quality:1},{id:'crit',level:1,quality:0}];});
  await expect(page.locator('#blessings')).toBeVisible();
  const tick=await page.evaluate(()=>window.__game!.sim().tick);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__game!.sim().tick)).toBe(tick);
  await page.screenshot({path:info.outputPath('blessings-1280x720.png')});
  await expect(page.locator('.pcard')).toHaveCount(3);
  await expect(page.locator('.pcard.ra .prar')).toHaveText('Selten · zwei Stufen');
  await page.waitForTimeout(400);
  // The cards ignore input for 350 ms after they open (no accidental picks). On a slow CI runner
  // a frame can take seconds, so press until the choice is taken instead of exactly once.
  await expect(async () => {
    await page.keyboard.press('Digit1');
    await expect(page.locator('#blessings')).toBeHidden({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  expect(await page.evaluate(()=>window.__game!.sim().statContext.perks.dmg)).toBe(1);
  // Keyboard consumables: Q heals over time when hurt, G throws the bottle.
  await page.evaluate(()=>{const s=window.__game!.sim();s.player.hp=20;});
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(()=>window.__game!.sim().abilities.hot>0);
  await expect(page.locator('#btn-verband .act-count')).toHaveText('0');
  await page.keyboard.press('KeyX');
  expect(await page.evaluate(()=>window.__game!.sim().equipment.w?.power)).toBe(1);
  expect(errors).toEqual([]);
});

test('phone power controls accept touch without moving the stick',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const page=await context.newPage();
  await page.goto('http://localhost:4173/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(()=>(window.__game?.sim().tick??0)>5,null,{timeout:90000});
  await expect(page.locator('#btn-power')).toBeVisible();
  await page.locator('#btn-power').tap();
  await page.waitForFunction(()=>(window.__game?.sim().abilities.powerCd??0)>0);
  await expect(page.locator('#btn-power')).not.toHaveClass(/ready/);
  await expect(page.locator('#btn-power .act-cd')).not.toBeEmpty();
  await page.locator('#btn-ultimate').tap();
  await page.waitForFunction(()=>(window.__game?.sim().abilities.ultimateCd??0)>0);
  // Consumables sit in the thumb arc too: the Molotow leaves the pouch, the Verband only when hurt.
  await page.locator('#btn-verband').tap();
  expect(await page.evaluate(()=>window.__game!.sim().inventory.consumables?.verband)).toBe(1);
  await page.waitForFunction(()=>window.__game!.sim().player.state==='move');
  await page.locator('#btn-molotow').tap();
  await page.waitForFunction(()=>window.__game!.sim().inventory.consumables?.molotow===0);
  await expect(page.locator('#btn-molotow')).toHaveClass(/off/);
  await page.screenshot({path:info.outputPath('combat-phone.png')});
  await context.close();
});
