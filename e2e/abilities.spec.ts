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
  await page.keyboard.press('Digit1');
  await expect(page.locator('#blessings')).toBeHidden();
  expect(await page.evaluate(()=>window.__game!.sim().statContext.perks.dmg)).toBe(1);
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
  await expect(page.locator('#btn-power')).toBeDisabled();
  await page.locator('#btn-ultimate').tap();
  await page.waitForFunction(()=>(window.__game?.sim().abilities.ultimateCd??0)>0);
  await page.screenshot({path:info.outputPath('combat-phone.png')});
  await context.close();
});
