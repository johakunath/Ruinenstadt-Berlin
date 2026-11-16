import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page): Promise<void> {
  await page.goto('/?map=hof&profile=Leistung&seed=7&autostart');
  await page.waitForFunction(() => (window.__game?.sim().tick ?? 0) > 1, null, {timeout:90_000});
  await page.evaluate(() => {
    const g = window.__game!;
    g.hold(true);
    const base = { slot: 'a' as const, kind: 'armor', base:'mantel', value:100, itemLevel:5, affixes:[{id:'regen' as const,value:1}] };
    g.collectItem({...base,id:101,name:'Mantel',rarity:2});
    g.collectItem({...base,id:102,name:'Ersatzmantel',rarity:0,value:10});
    g.collectItem({...base,id:103,name:'Kiez-Panzer',rarity:2,set:'kiez'});
    g.collectItem({...base,id:104,name:'Legendenmantel',rarity:3});
    g.collectItem({...base,id:105,slot:'h',kind:'head',name:'Helm',base:'helm',rarity:0,value:5});
    g.hold(false);
  });
  await page.locator('#inventory-btn').click();
}

test('inventory equips, compares, protects loot, pauses, and closes without buffered attacks', async ({page}, info) => {
  const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await setup(page);
  const tick = await page.evaluate(()=>window.__game!.sim().tick);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__game!.sim().tick)).toBe(tick);
  await page.locator('[data-bag="0"]').click();
  await expect(page.locator('.inv-deltas')).toContainText('Leben');
  await page.getByRole('button',{name:'Anlegen',exact:true}).click();
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  await page.locator('[data-bag="0"]').click();
  await page.getByRole('button',{name:'Sperren',exact:true}).click();
  await expect(page.locator('[data-action="salvage"]')).toBeDisabled();
  await page.locator('[data-bag="1"]').click();
  await expect(page.locator('.inv-detail')).toContainText('Kiez');
  await page.getByRole('button',{name:/Schrott \+/}).click();
  expect(await page.evaluate(()=>window.__game!.sim().inventory.bag.some(i=>i.id===103))).toBe(true);
  await expect(page.locator('#inventory footer')).toHaveText('Sicher? Erneut tippen.');
  await page.screenshot({path:info.outputPath('inventory-1280.png')});
  await page.getByRole('button',{name:'Gewöhnl.',exact:true}).click();
  await page.getByRole('button',{name:'Gewöhnl.',exact:true}).click();
  const ids=await page.evaluate(()=>window.__game!.sim().inventory.bag.map(i=>i.id));
  expect(ids).toContain(102); expect(ids).toContain(103); expect(ids).toContain(104); expect(ids).not.toContain(105);
  // Focus wraps inside the dialog; Tab no longer opens the map.
  await page.locator('[data-action="close"]').focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(()=>document.activeElement?.closest('#inventory')!==null)).toBe(true);
  await expect(page.locator('#karte')).toBeHidden();
  await page.keyboard.press('KeyJ');
  const swings=await page.evaluate(()=>window.__game!.sim().player.swing);
  await page.keyboard.press('Escape');
  await expect(page.locator('#inventory')).toBeHidden();
  await page.waitForFunction(t=>window.__game!.sim().tick>t,tick);
  expect(await page.evaluate(()=>window.__game!.sim().player.swing)).toBe(swings);
  expect(errors).toEqual([]);
});

test('mouse drag equips compatible gear and rejects the wrong slot',async({page})=>{
  await setup(page);
  const src=page.locator('[data-bag="0"]'), dest=page.locator('[data-slot="a"]');
  const a=(await src.boundingBox())!, b=(await dest.boundingBox())!;
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8}); await page.mouse.up();
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  const c=(await page.locator('[data-bag="0"]').boundingBox())!, d=(await page.locator('[data-slot="h"]').boundingBox())!;
  await page.mouse.move(c.x+c.width/2,c.y+c.height/2); await page.mouse.down();
  await page.mouse.move(d.x+d.width/2,d.y+d.height/2,{steps:8}); await page.mouse.up();
  expect(await page.evaluate(()=>window.__game!.sim().equipment.h)).toBeUndefined();
});

test('phone touch selection, equipping, scroll and overflow',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage(); await setup(page);
  await page.locator('[data-bag="0"]').tap();
  await page.locator('[data-action="equip"]').tap();
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  expect(await page.evaluate(()=>document.querySelector('.inv-panel')!.scrollWidth <= document.querySelector('.inv-panel')!.clientWidth)).toBe(true);
  await page.locator('.inv-panel').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:info.outputPath('inventory-phone.png')});
  await context.close();
});

test('controller Y opens, A activates and B closes',async({page})=>{
  await setup(page); await page.keyboard.press('Escape');
  await page.evaluate(()=>{
    const p={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
    (window as unknown as {testPad:typeof p}).testPad=p;
    Object.defineProperty(navigator,'getGamepads',{value:()=>[p]});
  });
  const press=async(i:number)=>{
    await page.evaluate(n=>{const p=(window as unknown as {testPad:Gamepad}).testPad; Object.assign(p.buttons[n]!,{pressed:true,value:1});},i);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.evaluate(n=>{const p=(window as unknown as {testPad:Gamepad}).testPad; Object.assign(p.buttons[n]!,{pressed:false,value:0});},i);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  await press(3); await expect(page.locator('#inventory')).toBeVisible();
  await page.locator('[data-bag="0"]').focus(); await press(0);
  await expect(page.locator('[data-action="equip"]')).toBeVisible();
  await page.locator('[data-action="equip"]').focus(); await press(0);
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  await press(1); await expect(page.locator('#inventory')).toBeHidden();
});

test('tablet long press drag equips without horizontal overflow',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
  const page=await context.newPage(); await setup(page);
  const a=(await page.locator('[data-bag="0"]').boundingBox())!, b=(await page.locator('[data-slot="a"]').boundingBox())!;
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
  await page.waitForTimeout(450);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  expect(await page.evaluate(()=>document.querySelector('.inv-panel')!.scrollWidth<=document.querySelector('.inv-panel')!.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('inventory-tablet.png')});
  await context.close();
});
