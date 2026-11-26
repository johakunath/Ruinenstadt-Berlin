// WP4 step 5 proof sheets of the legendary and set effects, rendered in the real game (dev server running).
//   PORT=5178 node tools/gear-fx-sheet.mjs g3 docs/proof/wp4/step5        G3: g3-A.jpg, g3-B.jpg, g3-C.jpg, g3-compare.jpg
//   PORT=5178 node tools/gear-fx-sheet.mjs items docs/proof/wp4/step5     every item of the step 5 table: items-weapons.jpg, items-wear.jpg (ONLY=wear: the second)
//   PORT=5178 VARIANTS=C node tools/gear-fx-sheet.mjs strip docs/proof/wp4/step5   re-render only the proc strips into the g3 sheets
//   PORT=5178 node tools/gear-fx-sheet.mjs probe out-prefix "map=xhain&cam=7,16" 0,-10   frames with the hero moved north (framing)
// Frames run on a gated 60 Hz clock: the sim is held and stepped by hand, one rendered frame per step, so particles
// and clips are the same on every run. The variant switches at runtime (`__game.gearFx`), one load per spot and camera.
// The HUD is hidden (only the game canvas is read). CHROMIUM=<path> optional.
import fs, { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const [mode = 'g3', outDir = 'docs/proof/wp4/step5', extra, more] = process.argv.slice(2);
const PORT = process.env.PORT ?? 5173;
// G3 frames at 1280 × 720 (the spec size); the item grid at 960 × 540 (SwiftShader takes seconds per frame at full size).
const W = mode === 'items' ? 960 : 1280, H = mode === 'items' ? 540 : 720;
/** Dark: Xhain at night; bright: Alexanderplatz by day. `dz`: the hero moved this far north of the start (0: the start itself). */
const SPOTS = [['dunkel', 'xhain', Number(process.env.DARK_DZ ?? 0)], ['hell', 'alex', Number(process.env.BRIGHT_DZ ?? 0)]];
const CLOSE_CAM = process.env.CLOSE_CAM ?? '7,16';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** Gated clock: free 60 Hz while loading; with `on`, only `budget` more frames run. */
function gate() {
  const g = (window.__gate = { on: false, budget: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  g.raf = raf;
  let real = -1, t = 0;
  window.requestAnimationFrame = (cb) => raf(function run(ts) {
    if (g.on && g.budget <= 0 && ts !== real) return raf(run);
    if (ts !== real) { real = ts; t += 1000 / 60; if (g.on) g.budget--; }
    cb(t);
    // The game's frame just rendered: read the canvas in the same task (no preserveDrawingBuffer needed).
    if (g.grab && cb.name === 'frame') { g.png = document.getElementById('game').toDataURL('image/png'); g.grab = false; }
  });
}

async function open(q, dz = 0) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.addInitScript(gate);
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(`http://localhost:${PORT}/?autostart&god&seed=7&profile=Qualit%C3%A4t&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('loading')?.hidden === true && window.__game?.phase() === 'play', null, { timeout: 300000 });
  await page.evaluate(async (dz) => {
    window.__game.hold(true);
    window.__gate.on = true;
    // Debug helpers from the dev server's module graph (same instances as the game's).
    window.__dbg = { ...(await import('/src/sim/debug-gear.ts')), ...(await import('/src/sim/enemies.ts')) };
    window.__base = structuredClone(window.__game.sim().equipment);
    const p = window.__game.sim().player;
    p.z = p.pz = p.z + dz;
  }, dz);
  await frames(page, 60);
  return page;
}

/** Runs `n` frames; with `inp`, one sim step with that input before each frame. */
async function frames(page, n, inp = null) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(async (inp) => {
      if (inp) window.__game.step(inp, 1);
      const g = window.__gate;
      g.budget = 1;
      await new Promise((res) => { const chk = () => (g.budget <= 0 ? g.raf(() => res()) : setTimeout(chk, 2)); chk(); });
    }, inp);
  }
}
/** The canvas after one more frame (sim held, so only effects and clips move by 1/60 s). */
async function shot(page) {
  const url = await page.evaluate(async () => {
    const g = window.__gate;
    g.grab = true; g.png = null; g.budget = 1;
    await new Promise((res) => { const chk = () => (g.png ? res() : setTimeout(chk, 5)); chk(); });
    return g.png;
  });
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

/** Variant, then `words` (?gear= syntax) over the start loadout; the hero turned to `facing`, standing. */
async function wear(page, variant, words, facing = 0.6) {
  await page.evaluate(([variant, words, facing]) => {
    const s = window.__game.sim();
    window.__game.gearFx(variant);
    window.__game.setLoadout({ ...structuredClone(window.__base), ...window.__dbg.debugGear(words) });
    s.player.facing = s.player.pfacing = facing;
    s.player.state = 'move'; s.player.vx = s.player.vz = 0; s.player.attack = null; s.player.chain = null;
    s.abilities.dcrit = false;
    s.enemies.length = 0;
  }, [variant, words, facing]);
}

const label = (w, h, text, size = 15) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#000" opacity="0.55"/><text x="6" y="${Math.round(h * 0.72)}" font-family="Arial" font-size="${size}" fill="#fff">${text.replace(/&/g, '&amp;')}</text></svg>`);
const cell = async (png, w, h, text, crop) => {
  let img = sharp(png);
  if (crop) img = img.extract(crop);
  const buf = await img.resize(w, h).png().toBuffer();
  return sharp(buf).composite([{ input: label(w, 20, text, 13), left: 0, top: 0 }]).png().toBuffer();
};
async function sheet(out, width, rows, title) {
  const parts = [{ input: label(width, 30, title, 17), left: 0, top: 0 }];
  let y = 30, height = 30;
  for (const row of rows) { let x = 0, rh = 0; for (const c of row) { const m = await sharp(c).metadata(); parts.push({ input: c, left: x, top: y }); x += m.width; rh = Math.max(rh, m.height); } y += rh; height = y; }
  await sharp({ create: { width, height, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
  console.log(out);
}

/** Crop round the hero in a close frame (she stands a little below the middle). */
const HERO = { left: Math.round(W / 2 - 400), top: Math.round(H * 0.61 - 225), width: 800, height: 450 };
const VARIANTS = ['A', 'B', 'C'];

/**
 * Proc strip: a crit on a training dummy beside her (Fernsehturm-Splitter: ember burst, the glow flares), 8 frames
 * over 2.3 s. Element procs are off for the dummy: a burning body's flame card covers a close camera (E1 status marks).
 */
async function procStrip(page, v) {
  await page.evaluate(() => {
    const s = window.__game.sim(), p = s.player, f = 1.3;
    const e = window.__dbg.spawnEnemy(s, p.x + Math.sin(f) * 1.5, p.z + Math.cos(f) * 1.5, 'walker');
    e.hp = e.maxHp = 1e6;
    e.def = { ...e.def, speed: 0, attackRange: 0, knockbackTaken: 0, ai: 'melee' };
    p.facing = p.pfacing = f;
    s.stats.crit = 1;
    s.stats.elementChance = 0;
  });
  await frames(page, 20);
  const strip = [];
  let t = 0;
  for (let i = 0; i < 8; i++) {
    const n = i === 0 ? 1 : 20;
    await frames(page, n, i === 0 ? { attack: true } : {});
    t += n;
    strip.push(await cell(await shot(page), 320, 180, `${v} · ${(t / 60).toFixed(2)} s`, HERO));
  }
  return strip;
}

if (mode === 'probe') {
  const page = await open(extra ?? '');
  for (const dz of (more ?? '0').split(',').map(Number)) {
    await page.evaluate((dz) => { const p = window.__game.sim().player; p.z = p.pz = p.z + dz; }, dz);
    await frames(page, 90);
    await sharp(await shot(page)).toFile(`${outDir}-${dz}.png`);
    console.log(`${outDir}-${dz}.png`);
    await page.evaluate((dz) => { const p = window.__game.sim().player; p.z = p.pz = p.z - dz; }, dz);
  }
} else if (mode === 'g3') {
  mkdirSync(outDir, { recursive: true });
  const gear = ['turm', 'spaeti'];
  const pics = Object.fromEntries(VARIANTS.map((v) => [v, {}]));
  for (const [spot, map, dz] of SPOTS) {
    for (const [view, cam] of [['Spielkamera', ''], ['nah', `&cam=${CLOSE_CAM}`]]) {
      const page = await open(`map=${map}&gear=${gear.join(',')}${cam}`, dz);
      for (const v of VARIANTS) {
        await wear(page, v, gear, 0.6);
        await frames(page, 90);
        pics[v][`${spot} ${view}`] = await shot(page);
        if (spot !== 'dunkel' || view !== 'nah') continue;
        pics[v].strip = await procStrip(page, v);
      }
      await page.close();
    }
  }
  for (const v of VARIANTS) {
    const p = pics[v], big = (k) => cell(p[k], 640, 360, `${v} · ${k}`);
    await sheet(join(outDir, `g3-${v}.jpg`), 1280, [[await big('dunkel Spielkamera'), await big('hell Spielkamera')], [await big('dunkel nah'), await big('hell nah')], p.strip.slice(0, 4), p.strip.slice(4)],
      `G3 Variante ${v}: Fernsehturm-Splitter + Mantel des letzten Späti · Xhain Nacht, Alexanderplatz Tag · Qualität 1280×720 · unten Krit-Proc, 0 bis 2,3 s`);
  }
  const row = (k, crop, text = k) => Promise.all(VARIANTS.map((v) => cell(pics[v][k], 426, 240, `${v} · ${text}`, crop)));
  const procRow = (i) => Promise.all(VARIANTS.map((v) => pics[v].strip[i]).map((c) => sharp(c).resize(426, 240).png().toBuffer()));
  await sheet(join(outDir, 'g3-compare.jpg'), 1278, [await row('dunkel nah', HERO), await row('hell nah', HERO), await procRow(1), await procRow(2)],
    'G3 A | B | C: nah in Xhain und am Alexanderplatz (Ausschnitt), Krit-Proc nach 0,35 und 0,68 s');
} else if (mode === 'strip') {
  // Re-renders only the proc strips (`VARIANTS=C`) and pastes them into the existing g3 sheets.
  const [spot, map, dz] = SPOTS[0];
  const page = await open(`map=${map}&gear=turm,spaeti&cam=${CLOSE_CAM}`, dz);
  for (const v of (process.env.VARIANTS ?? 'C').split(',')) {
    await wear(page, v, ['turm', 'spaeti'], 0.6);
    await frames(page, 90);
    const strip = await procStrip(page, v);
    const g3 = join(outDir, `g3-${v}.jpg`), cmp = join(outDir, 'g3-compare.jpg'), col = VARIANTS.indexOf(v) * 426;
    const at = (buf, left, top) => ({ input: buf, left, top });
    const a = await sharp(g3).composite(strip.map((c, i) => at(c, (i % 4) * 320, 750 + Math.floor(i / 4) * 180))).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    fs.writeFileSync(g3, a);
    const big = await Promise.all([1, 2].map((i) => sharp(strip[i]).resize(426, 240).png().toBuffer()));
    const b = await sharp(cmp).composite([at(big[0], col, 510), at(big[1], col, 750)]).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    fs.writeFileSync(cmp, b);
    console.log(g3, cmp, spot);
  }
  await page.close();
} else if (mode === 'items') {
  mkdirSync(outDir, { recursive: true });
  // Item, word for ?gear, how its flash is triggered.
  const EV = (id) => ({ ev: { type: 'legendaryProc', id } });
  const WEAPONS = [
    ['Fernsehturm-Splitter', 'turm', EV('turm')], ['Klinge der Zitadelle', 'zitklinge', EV('zitklinge')], ['Mauerbrecher', 'mauer', EV('mauer')],
    ['Plattenbrecher', 'pbrecher', EV('pbrecher')], ['Zorn der Ringbahn', 'ring', null], ['Krähenschleuder', 'kraehe', { shoot: true }], ['Speer der Siegessäule', 'siegsp', EV('siegsp')],
  ];
  const WEAR = [
    ['Mantel des letzten Späti', 'spaeti', null], ['Panzer vom Tempelhofer Feld', 'panzer', EV('panzer')], ['Mantel der Rattenmutter', 'rattenmantel', EV('rattenmantel')],
    ['Rüstung des Zitadellenritters', 'ritter', EV('ritter')], ['Pickelhaube des Hauptmanns', 'pickel', null], ['Fäuste des Kiezboxers', 'kiezbox', EV('kiezbox')],
    ['Stiefel des Schaffners', 'schaffner', { dodge: true }], ['Ring der Weltzeituhr', 'weltuhr', { arm: true }], ['Herz der Spree', 'herz', { ev: { type: 'secondWind' } }],
    ['Auge des Fernsehturms', 'auge', { elite: true }], ['Arm des Basspredigers', 'bassarm', EV('bassarm')],
    ['Set Kiezwache (C)', 'kiez', null, 'C'], ['Set Spreegeist (C)', 'spree', null, 'C'], ['Set Zitadelle (C)', 'zit', null, 'C'],
  ];
  const SQ = { left: Math.round(W / 2 - 200), top: Math.round(H * 0.61 - 200), width: 400, height: 400 };
  const page = await open(`map=${SPOTS[0][1]}&cam=${CLOSE_CAM}`, SPOTS[0][2]);
  const run = async (list) => {
    const out = [];
    for (const [name, word, trig, variant = 'B'] of list) {
      // Left hand items face her left side to the camera.
      await wear(page, variant, [word], word === 'weltuhr' || word === 'bassarm' ? -0.9 : 0.6);
      await frames(page, 45);
      const calm = await cell(await shot(page), 300, 300, `${name}`, SQ);
      if (trig?.ev) {
        await page.evaluate((ev) => { const s = window.__game.sim(), p = s.player, f = p.facing; s.events.push({ x: p.x + Math.sin(f) * 1.2, z: p.z + Math.cos(f) * 1.2, ...ev }); }, trig.ev);
        await frames(page, 7);
      } else if (trig?.dodge) await frames(page, 10, { dodge: true, moveX: 1 });
      else if (trig?.shoot) { await frames(page, 1, { attack: true }); await frames(page, 24, {}); }
      else if (trig?.arm) { await page.evaluate(() => { window.__game.sim().abilities.dcrit = true; }); await frames(page, 6); }
      else if (trig?.elite) {
        await page.evaluate(() => {
          const s = window.__game.sim(), p = s.player, e = window.__dbg.spawnEnemy(s, p.x + 1.4, p.z + 0.6, 'walker');
          e.elite = 'flink'; e.def = { ...e.def, speed: 0, attackRange: 0 };
          s.events.push({ type: 'hit', id: e.id, x: e.x, z: e.z, dx: 1, dz: 0, weight: 'light', killed: false, damage: 1 });
        });
        await frames(page, 6);
      } else await frames(page, 40);
      out.push([calm, await cell(await shot(page), 300, 300, trig ? 'Proc' : '0,7 s später', SQ)]);
    }
    return out;
  };
  const pairs = (cells, per) => { const rows = []; for (let i = 0; i < cells.length; i += per) rows.push(cells.slice(i, i + per).flat()); return rows; };
  if (process.env.ONLY !== 'wear') await sheet(join(outDir, 'items-weapons.jpg'), 1800, pairs(await run(WEAPONS), 3), 'Step 5 Waffen (Variante B, Xhain nah): je Ruhe | Proc');
  await sheet(join(outDir, 'items-wear.jpg'), 1800, pairs(await run(WEAR), 3), 'Step 5 Kleidung, Ring, Talismane, Implantat (B) und Sets (C, alle Teile): je Ruhe | Proc');
  await page.close();
}
await browser.close();
