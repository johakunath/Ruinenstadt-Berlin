// Dev tool: GPU texture memory of one game page at GL level (GPU independent), split into image textures (anything
// uploaded: files, canvases, data) and render targets (allocated, never uploaded). Counts every mip level allocated
// with texStorage, adds a third for generateMipmap on texImage levels, and 6 faces for cube maps. Labels come from
// the upload source: the file name for images, else canvas, bitmap or data with the size.
// usage: [PORT=5173] [TOP=12] node tools/texmem.mjs "<query>" ["<query>" ...]
//   e.g. node tools/texmem.mjs "autostart&map=xhain&profile=Leistung"   (dev server running)
import { chromium } from 'playwright';

const queries = process.argv.slice(2);
const TOP = Number(process.env.TOP ?? 12);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

function hook() {
  const P = WebGL2RenderingContext.prototype, G = WebGL2RenderingContext;
  // Bytes per texel by internal format (sized, or unsized RGBA/RGB/... with the upload type).
  const SIZED = {
    [G.RGBA8]: 4, [G.SRGB8_ALPHA8]: 4, [G.RGB8]: 4, [G.SRGB8]: 4, [G.R8]: 1, [G.RG8]: 2, [G.RGBA16F]: 8, [G.RGB16F]: 8, [G.R16F]: 2, [G.RG16F]: 4,
    [G.RGBA32F]: 16, [G.RGB32F]: 16, [G.R32F]: 4, [G.RG32F]: 8, [G.R11F_G11F_B10F]: 4, [G.RGB10_A2]: 4, [G.RGBA4]: 2, [G.RGB565]: 2, [G.RGB5_A1]: 2,
    [G.DEPTH_COMPONENT16]: 2, [G.DEPTH_COMPONENT24]: 4, [G.DEPTH_COMPONENT32F]: 4, [G.DEPTH24_STENCIL8]: 4, [G.DEPTH32F_STENCIL8]: 8,
    [G.R8UI]: 1, [G.RGBA8UI]: 4, [G.R32UI]: 4, [G.R16UI]: 2,
  };
  const CH = { [G.RGBA]: 4, [G.RGB]: 3, [G.RG]: 2, [G.RED]: 1, [G.LUMINANCE]: 1, [G.ALPHA]: 1, [G.LUMINANCE_ALPHA]: 2, [G.DEPTH_COMPONENT]: 1, [G.DEPTH_STENCIL]: 1 };
  const TYPE = { [G.UNSIGNED_BYTE]: 1, [G.HALF_FLOAT]: 2, [G.FLOAT]: 4, [G.UNSIGNED_SHORT]: 2, [G.UNSIGNED_INT]: 4, [G.UNSIGNED_INT_24_8]: 4 };
  const bpp = (ifmt, type) => SIZED[ifmt] ?? (CH[ifmt] ? Math.max(CH[ifmt], CH[ifmt] === 3 ? 4 : 0) * (TYPE[type] ?? 1) : 4);
  const tex = new Map(); // WebGLTexture -> { levels: Map<level, bytes>, uploaded, label, mip }
  const bound = new Map(); // `${unit}:${target}` -> WebGLTexture
  let unit = 0;
  const info = (target) => tex.get(bound.get(`${unit}:${target === G.TEXTURE_CUBE_MAP ? target : target >= G.TEXTURE_CUBE_MAP_POSITIVE_X && target <= G.TEXTURE_CUBE_MAP_NEGATIVE_Z ? G.TEXTURE_CUBE_MAP : target}`));
  // ImageBitmaps (ImageBitmapLoader, P47 resizes) carry the file name of the fetch they were decoded from.
  const fileOf = new WeakMap();
  const blob = Response.prototype.blob;
  Response.prototype.blob = async function () { const b = await blob.call(this); if (!this.url.startsWith('blob:')) fileOf.set(b, this.url); return b; };
  const cib = self.createImageBitmap;
  if (cib) self.createImageBitmap = async function (src, ...a) { const bm = await cib.call(this, src, ...a); if (src && typeof src === 'object' && fileOf.has(src)) fileOf.set(bm, fileOf.get(src)); return bm; };
  const label = (src, w, h) => {
    if (!src || ArrayBuffer.isView(src)) return `data ${w}x${h}`;
    if (self.ImageBitmap && src instanceof ImageBitmap && fileOf.has(src)) return `${decodeURIComponent(fileOf.get(src).split('/').pop().split('?')[0])} ${src.width}`;
    if (src.currentSrc || src.src) return decodeURIComponent((src.currentSrc || src.src).split('/').pop().split('?')[0]);
    if (src instanceof HTMLCanvasElement || (self.OffscreenCanvas && src instanceof OffscreenCanvas)) return `canvas ${src.width}x${src.height}`;
    if (self.ImageBitmap && src instanceof ImageBitmap) return `bitmap ${src.width}x${src.height}`;
    return `other ${w}x${h}`;
  };
  const ct = P.createTexture; P.createTexture = function () { const t = ct.call(this); tex.set(t, { levels: new Map(), uploaded: false, label: '', mip: false, stored: false }); return t; };
  const dt = P.deleteTexture; P.deleteTexture = function (t) { tex.delete(t); return dt.call(this, t); };
  const at = P.activeTexture; P.activeTexture = function (u) { unit = u - G.TEXTURE0; return at.call(this, u); };
  const bt = P.bindTexture; P.bindTexture = function (target, t) { bound.set(`${unit}:${target}`, t); return bt.call(this, target, t); };
  const ts2 = P.texStorage2D; P.texStorage2D = function (target, levels, ifmt, w, h) {
    const i = info(target), faces = target === G.TEXTURE_CUBE_MAP ? 6 : 1;
    if (i) i.stored = true;
    if (i) for (let l = 0; l < levels; l++) i.levels.set(l, Math.max(1, w >> l) * Math.max(1, h >> l) * bpp(ifmt) * faces);
    if (i && !i.label) i.label = `${w}x${h}`;
    return ts2.call(this, target, levels, ifmt, w, h);
  };
  const ts3 = P.texStorage3D; P.texStorage3D = function (target, levels, ifmt, w, h, d) {
    const i = info(target);
    if (i) i.stored = true;
    if (i) for (let l = 0; l < levels; l++) i.levels.set(l, Math.max(1, w >> l) * Math.max(1, h >> l) * bpp(ifmt) * (target === G.TEXTURE_3D ? Math.max(1, d >> l) : d));
    if (i && !i.label) i.label = `${w}x${h}x${d}`;
    return ts3.call(this, target, levels, ifmt, w, h, d);
  };
  const ti2 = P.texImage2D; P.texImage2D = function (...a) {
    const [target, level, ifmt] = a, i = info(target);
    let w, h, type, src;
    if (a.length >= 9) { w = a[3]; h = a[4]; type = a[7]; src = a[8]; } else { type = a[4]; src = a[5]; w = src?.width ?? src?.videoWidth; h = src?.height ?? src?.videoHeight; }
    if (i) {
      // Key: level × 10 + cube face, so each face of a cube map counts once.
      i.levels.set(level * 10 + (target >= G.TEXTURE_CUBE_MAP_POSITIVE_X && target <= G.TEXTURE_CUBE_MAP_NEGATIVE_Z ? target - G.TEXTURE_CUBE_MAP_POSITIVE_X : 0), w * h * bpp(ifmt, type));
      if (src) { i.uploaded = true; i.label = label(src, w, h); } else if (!i.label) i.label = `${w}x${h}`;
    }
    return ti2.apply(this, a);
  };
  const sub = (name, at) => { const f = P[name]; P[name] = function (...a) { const i = info(a[0]); if (i) { i.uploaded = true; const src = a[a.length - 1]; if (src && !ArrayBuffer.isView(src) && typeof src === 'object') i.label = label(src); else if (!i.label.startsWith('data')) i.label = `data ${i.label}`; } return f.apply(this, a); }; };
  sub('texSubImage2D'); sub('texSubImage3D'); sub('compressedTexSubImage2D'); sub('compressedTexSubImage3D');
  const ci2 = P.compressedTexImage2D; P.compressedTexImage2D = function (...a) { const i = info(a[0]); if (i) { i.levels.set(a[1], a[6]?.byteLength ?? 0); i.uploaded = true; i.label ||= `compressed ${a[3]}x${a[4]}`; } return ci2.apply(this, a); };
  const gm = P.generateMipmap; P.generateMipmap = function (target) { const i = info(target); if (i) i.mip = true; return gm.call(this, target); };
  window.__texmem = () => {
    const rows = [];
    for (const i of tex.values()) {
      let b = 0;
      for (const v of i.levels.values()) b += v;
      if (i.mip && !i.stored) b *= 4 / 3; // texImage level 0 (per face) plus a generated chain
      rows.push({ label: i.label, bytes: b, image: i.uploaded });
    }
    return rows;
  };
}

const MiB = (b) => (b / 1048576).toFixed(1);
for (const query of queries) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(hook);
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/?` + query, { waitUntil: 'load' });
  // The run has started (`autostart`): the world, the characters and their textures are built.
  await page.waitForFunction(() => window.__game && window.__game.phase() !== 'title', null, { timeout: 240000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 6000));
  const rows = await page.evaluate(() => window.__texmem());
  const img = rows.filter((r) => r.image), rt = rows.filter((r) => !r.image);
  const sum = (l) => l.reduce((s, r) => s + r.bytes, 0);
  const byLabel = new Map();
  for (const r of img) { const e = byLabel.get(r.label) ?? { n: 0, bytes: 0 }; e.n++; e.bytes += r.bytes; byLabel.set(r.label, e); }
  const top = [...byLabel].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, TOP).map(([l, e]) => `${l}${e.n > 1 ? ` ×${e.n}` : ''} ${MiB(e.bytes)}`);
  console.log(`${query}\n  images ${MiB(sum(img))} MiB (${img.length} textures), render targets ${MiB(sum(rt))} MiB (${rt.length}), total ${MiB(sum(rows))} MiB\n  top: ${top.join(' · ')}`);
  await page.close();
}
await browser.close();
