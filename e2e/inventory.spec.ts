import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, useDefaultProfile = false): Promise<void> {
  await page.goto('/?map=hof&seed=7&autostart' + (useDefaultProfile ? '' : '&profile=Leistung'));
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
  // U1: the pause button opens the menu on the Inventar tab, on every device.
  await page.locator('#menu-btn').click();
  await expect(page.locator('#inventory')).toBeVisible();
}

test('inventory equips, compares, protects loot, pauses, and closes without buffered attacks', async ({page}, info) => {
  const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await setup(page);
  const tick = await page.evaluate(()=>window.__game!.sim().tick);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__game!.sim().tick)).toBe(tick);
  await page.locator('[data-bag="0"]').click();
  await expect(page.locator('.inv-detail')).toContainText('Leben');
  await expect(page.locator('.inv-detail .cmp2 .inv-card')).toHaveCount(2);
  await page.getByRole('button',{name:'Anlegen',exact:true}).click();
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  await page.locator('[data-bag="0"]').click();
  await page.getByRole('button',{name:'Sperren',exact:true}).click();
  await expect(page.locator('[data-action="salvage"]')).toBeDisabled();
  await page.locator('[data-bag="1"]').click();
  await expect(page.locator('.inv-detail')).toContainText('Kiez');
  await page.getByRole('button',{name:/Verschrotten \+/}).click();
  expect(await page.evaluate(()=>window.__game!.sim().inventory.bag.some(i=>i.id===103))).toBe(true);
  await expect(page.locator('#inventory footer')).toHaveText('Teil verschrotten? Zum Bestätigen erneut tippen.');
  await expect(page.locator('[data-action="salvage"]')).toContainText('Wirklich?');
  await page.screenshot({path:info.outputPath('inventory-1280.png')});
  await page.getByRole('button',{name:/^Gewöhnl\./}).click();
  const ids=await page.evaluate(()=>window.__game!.sim().inventory.bag.map(i=>i.id));
  expect(ids).toContain(102); expect(ids).toContain(103); expect(ids).toContain(104); expect(ids).not.toContain(105);
  // ] switches menu tabs; Tab moves focus and stays in the menu.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.activeElement?.closest('#menu')!==null)).toBe(true);
  await page.keyboard.press('BracketRight');
  await expect(page.locator('.menu-tabb.on')).not.toHaveText('Inventar');
  expect(await page.evaluate(()=>document.activeElement?.closest('#menu')!==null)).toBe(true);
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
  await expect(dest).toBeFocused();
  const c=(await page.locator('[data-bag="0"]').boundingBox())!, d=(await page.locator('[data-slot="h"]').boundingBox())!;
  await page.mouse.move(c.x+c.width/2,c.y+c.height/2); await page.mouse.down();
  await page.mouse.move(d.x+d.width/2,d.y+d.height/2,{steps:8}); await page.mouse.up();
  expect(await page.evaluate(()=>window.__game!.sim().equipment.h)).toBeUndefined();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 844, height: 390 }]) {
  test.describe(`phone ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, contextOptions: { screen: viewport }, hasTouch: true, isMobile: true });

    test('inventory scrolls to all gear and bag slots, with the phone graphics defaults', async ({ page }, info) => {
      await setup(page, true);
      const inventory = page.locator('#inventory');
      if (viewport.width === 844) {
        const bag = (await page.locator('.inv-bag').boundingBox())!;
        const bounds = (await inventory.boundingBox())!;
        const x = Math.round(bag.x + bag.width / 2);
        const y = Math.round(bounds.y + bounds.height - 16);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let dy = 15; dy <= 120; dy += 15) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(() => inventory.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await cdp.detach();
      }
      const reachable = await inventory.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        el.scrollTop = el.scrollHeight;
        const last = el.querySelector('.inv-grid > :last-child')!.getBoundingClientRect();
        const stats = el.querySelector('.inv-stats')!.getBoundingClientRect();
        return el.scrollTop > 0 && el.scrollWidth <= el.clientWidth + 1
          && last.bottom <= bounds.bottom && stats.bottom <= bounds.bottom;
      });
      expect(reachable).toBe(true);
      await page.locator('[data-bag="0"]').tap();
      await page.locator('[data-action="equip"]').tap();
      expect(await page.evaluate(() => window.__game!.sim().equipment.a?.id)).toBe(101);
      await page.screenshot({ path: info.outputPath('inventory-phone.png') });

      await page.locator('[data-t="kodex"]').tap();
      const kodex = page.locator('[data-tab="kodex"]');
      await expect(kodex).toBeVisible();
      expect(await kodex.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.locator('#menu-opt').tap();
      const options = page.locator('#optv');
      expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(options.locator('[data-opt="profile"] [data-v="leistung"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(options.getByRole('switch', { name: 'Akkusparen' })).toHaveAttribute('aria-checked', 'false');
      await expect(options.getByRole('switch', { name: 'Leistungsanzeige' })).toHaveAttribute('aria-checked', 'false');
      await options.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.locator('#opt-close').tap();
      await page.locator('#menu-opt').tap();
      expect(await options.evaluate(el => el.scrollTop)).toBe(0);
      await page.locator('#opt-close').tap();
      await page.locator('#menu-close').tap();
      await expect(page.locator('#menu')).toBeHidden();
    });
  });
}

test('controller Start opens, A activates and B closes',async({page})=>{
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
  await press(9); await expect(page.locator('#inventory')).toBeVisible();
  await page.locator('[data-bag="0"]').focus(); await press(0);
  await expect(page.locator('[data-action="equip"]')).toBeVisible();
  await page.locator('[data-action="equip"]').focus(); await press(0);
  expect(await page.evaluate(()=>window.__game!.sim().equipment.a?.id)).toBe(101);
  await expect(page.locator('[data-slot="a"]')).toBeFocused();
  await press(0); // Continue from the restored focus, without manually refocusing.
  await expect(page.locator('[data-action="unequip"]')).toBeVisible();
  await expect(page.locator('[data-slot="a"]')).toBeFocused();
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
  expect(await page.evaluate(()=>document.querySelector('.menu-panel')!.scrollWidth<=document.querySelector('.menu-panel')!.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('inventory-tablet.png')});
  await context.close();
});


test('stationary mouse holds select items without starting a drag', async ({page}) => {
  await setup(page);
  for (const [selector, name] of [['[data-bag="0"]', 'Mantel'], ['[data-bag="1"]', 'Ersatzmantel'], ['[data-slot="w"]', 'Rostige Klinge']]) {
    const cell = page.locator(selector!);
    const box = (await cell.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(400); // A deliberate click beyond the old 100 ms drag timer.
    await expect(page.locator('.dragging')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('.inv-detail h3').first()).toHaveText(name!);
    await expect(cell).toBeFocused();
  }
  expect(await page.evaluate(() => window.__game!.sim().inventory.bag.map(i => i.id))).toEqual([101,102,103,104,105]);
});

test('equip, unequip and salvage keep keyboard focus in the menu', async ({page}) => {
  await setup(page);
  await page.locator('[data-bag="0"]').click();
  await page.locator('[data-action="equip"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-slot="a"]')).toBeFocused();
  await page.locator('[data-action="unequip"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-bag="4"]')).toBeFocused();
  await page.locator('[data-bag="0"]').click();
  await page.locator('[data-action="salvage"]').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__game!.sim().inventory.bag.some(i => i.id === 102))).toBe(false);
  expect(await page.evaluate(()=>document.activeElement?.closest('#menu')!==null)).toBe(true);
  // Empty bag cells are not focusable (U1 step 4).
  await expect(page.locator('#inventory div[data-bag="24"]')).toHaveCount(1);
  await expect(page.locator('#inventory button[data-bag="24"]')).toHaveCount(0);
});

test('phone landscape: doll, bag and comparison fit; tabs Segen, Kodex and the options screen render',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const page=await context.newPage(); await setup(page);
  await page.locator('[data-bag="0"]').tap();
  await expect(page.locator('.inv-detail .cmp2')).toBeVisible();
  for (const sel of ['.inv-doll','.inv-grid','.inv-detail']) { const b=(await page.locator(sel).boundingBox())!; expect(b.y+Math.min(b.height,120)).toBeLessThanOrEqual(390); }
  expect(await page.evaluate(()=>document.scrollingElement!.scrollHeight<=window.innerHeight+1)).toBe(true);
  const name=await page.locator('.inv-detail h3').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  expect(name).toBe(16);
  await page.screenshot({path:info.outputPath('menu-844x390-inventar.png')});
  for (const [tab,check] of [['segen','.menu-tab[data-tab="segen"]'],['kodex','.cols2']] as const) {
    await page.locator(`[data-t="${tab}"]`).tap(); await expect(page.locator(check).first()).toBeVisible();
    await page.screenshot({path:info.outputPath(`menu-844x390-${tab}.png`)});
  }
  // U3: the cog opens the options screen over the menu; × goes back to the menu.
  await page.locator('#menu-opt').tap(); await expect(page.locator('#optv .cgfx')).toBeVisible();
  await page.screenshot({path:info.outputPath('menu-844x390-optionen.png')});
  await page.locator('#opt-close').tap(); await expect(page.locator('#optv')).toBeHidden(); await expect(page.locator('#menu')).toBeVisible();
  await context.close();
});

