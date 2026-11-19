// WP4 step 2 mockup: a parametric front view of the hero in SVG. Landmarks follow hero.glb
// (1.77 m, 165 px per meter, soles at y 300): eyes 1.655 m, belt 1.08 m, knee 0.535 m, coat hem
// about 0.5 m, work boot top 0.35 m. Only for mockups; the game builds the looks in 3D.

const INK = '#140e0a';
const SKIN = '#b97a56';
const HAIR = '#22160f';

const f = (n) => Math.round(n * 10) / 10;
const hex = (c) => c.replace('#', '');
function rgb(c) {
  const h = hex(c);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function shade(c, k) {
  const a = rgb(c);
  return toHex(k <= 1 ? a.map((v) => v * k) : a.map((v) => v + (255 - v) * (k - 1)));
}

/** Gradients are collected per sheet and written once into its defs. */
const GRADS = new Map();
export function fill(c) {
  const id = 'g' + hex(c);
  if (!GRADS.has(id)) {
    GRADS.set(id, `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${shade(c, 0.68)}"/><stop offset=".42" stop-color="${c}"/><stop offset=".72" stop-color="${shade(c, 1.14)}"/><stop offset="1" stop-color="${shade(c, 0.86)}"/></linearGradient>`);
  }
  return `url(#${id})`;
}
export function defs() {
  return `<defs>${[...GRADS.values()].join('')}
<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.6"/></filter></defs>`;
}

/** Closed path through points [x, y, sharp?], smooth by the midpoint rule. */
function sp(pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const P = (p) => `${f(p[0])},${f(p[1])}`;
  let d = `M${P(pts[0][2] ? pts[0] : mid(pts[n - 1], pts[0]))}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    if (i === 0 && p[2]) continue;
    d += p[2] ? ` L${P(p)}` : ` Q${P(p)} ${P(q[2] ? q : mid(p, q))}`;
  }
  return d + 'Z';
}
/** Right half (x offsets from the centre line, top to bottom) mirrored into a closed shape. */
function sym(half, cx = 100) {
  const r = half.map(([x, y, s]) => [cx + x, y, s]);
  const l = half.slice().reverse().filter(([x]) => x !== 0).map(([x, y, s]) => [cx - x, y, s]);
  return sp([...r, ...l]);
}
const at = (pts, cx) => pts.map(([x, y, s]) => [cx + x, y, s]);
const mirror = (pts) => pts.map(([x, y, s]) => [-x, y, s]);

/** Capsule from A to B with radii ra and rb. */
function cap(ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const p = (x, y) => `${f(x)},${f(y)}`;
  return `M${p(ax + nx * ra, ay + ny * ra)} L${p(bx + nx * rb, by + ny * rb)} A${f(rb)} ${f(rb)} 0 0 0 ${p(bx - nx * rb, by - ny * rb)} L${p(ax - nx * ra, ay - ny * ra)} A${f(ra)} ${f(ra)} 0 0 0 ${p(ax + nx * ra, ay + ny * ra)}Z`;
}

const path = (d, c, extra = '') => `<path d="${d}" fill="${c.startsWith('url') || c === 'none' ? c : fill(c)}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" ${extra}/>`;
const flat = (d, c, extra = '') => `<path d="${d}" fill="${c}" ${extra}/>`;
const line = (d, c, w = 1, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
/** Union look: outlines of every shape first, then all fills, so inner seams vanish. */
function union(ds, c) {
  return ds.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`).join('')
    + ds.map((d) => `<path d="${d}" fill="${fill(c)}"/>`).join('');
}
const circ = (x, y, r, c, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}" ${extra}/>`;
const ell = (x, y, rx, ry, c, extra = '') => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" ${extra}/>`;
const glow = (s) => `<g filter="url(#glow)">${s}</g>`;

// Landmarks (y down). Arms hang in a relaxed A pose.
const SH = { x: 30, y: 66 }, EL = { x: 38, y: 108 }, WR = { x: 44, y: 148 };
const HIP = { x: 16, y: 146 }, KNEE = { x: 13, y: 212 }, ANK = { x: 11, y: 285 };
export const BELT = 118; // top of the belt band, 10 px tall

export const DEFAULT = {
  garment: 'coat', hem: 214, coat: '#8a5c33', hemCol: '#5e3c20', lining: '#3a2616',
  trousers: '#3d3a36', trouserKind: 'plain',
  belt: { kind: 'leather', col: '#3a2414', buckle: '#c9a34a' },
  boots: { kind: 'work', col: '#4a3020' },
  gloves: null, hat: null, scarf: '#b8261c', extras: [], sleeves: true,
};

let clipN = 0;

export function figure(look) {
  const L = { ...DEFAULT, ...look };
  const ex = new Set(L.extras.map((e) => (typeof e === 'string' ? e : e.kind)));
  const exOf = (k) => L.extras.find((e) => (typeof e === 'string' ? e : e.kind) === k);
  const out = [];
  const cid = `c${clipN++}`;

  // --- back layer: bun, coat back, poncho back
  out.push(circ(103, 7, 6.5, fill(HAIR), `stroke="${INK}" stroke-width="1.2"`));
  const skirt = L.garment === 'coat' || L.garment === 'kmantel';
  if (skirt) {
    const h = L.hem;
    out.push(path(sp([[74, BELT + 6, 1], [126, BELT + 6, 1], [138, h - 20], [146, h + 2, 1], [100, h + 6], [54, h + 2, 1], [62, h - 20]]), shade(L.lining, 1)));
  }
  if (L.garment === 'poncho') {
    out.push(path(sp([[86, 60, 1], [114, 60, 1], [150, 150], [152, 192, 1], [100, 200], [48, 192, 1], [50, 150]]), shade(L.coat, 0.8), 'fill-opacity=".9"'));
  }

  // --- trousers
  const legs = [];
  for (const s of [1, -1]) {
    legs.push(cap(100 + s * HIP.x, HIP.y, 100 + s * KNEE.x, KNEE.y, 12.5, 8.8));
    legs.push(cap(100 + s * KNEE.x, KNEE.y, 100 + s * ANK.x, ANK.y, 8.8, 6.3));
  }
  legs.push(sym([[0, BELT - 2, 1], [20, BELT - 2], [27, 134], [29, 150], [24, 160], [3, 168, 1], [0, 168, 1]]));
  out.push(union(legs, L.trousers));
  out.push(trouserDetails(L, ex));

  // --- boots
  out.push(boots(L.boots));

  // --- torso garment
  out.push(torso(L, ex, cid));

  // --- belt
  out.push(belt(L.belt, L));

  // --- arms
  out.push(arms(L, ex));

  // --- neck, collar, head, scarf, hat
  out.push(path(`M94,40 L106,40 L106.5,60 L93.5,60Z`, SKIN));
  out.push(collar(L, ex, exOf));
  out.push(head(L));
  if (L.scarf && !(L.hat && L.hat.kind === 'greathelm' && L.scarfHidden)) out.push(scarf(L.scarf));
  if (L.hat) out.push(hat(L.hat));

  // --- front gear
  out.push(gear(L, ex, exOf));
  return `<g>${out.join('')}</g>`;
}

function trouserDetails(L, ex) {
  const o = [];
  const c = L.trousers;
  if (L.trouserKind === 'cargo') {
    for (const s of [1, -1]) o.push(path(sp(at([[s * 15, 174, 1], [s * 25, 173, 1], [s * 25, 192, 1], [s * 15, 193, 1]], 100)), shade(c, 0.85)));
    o.push(line(`M${100 + 6},186 Q${100 + 17},189 ${100 + 28},186`, '#2a1a0e', 3));
  }
  if (L.trouserKind === 'jeans') {
    for (const s of [1, -1]) {
      o.push(path(sp(at([[s * 9, 206], [s * 15, 203], [s * 19, 209], [s * 15, 216], [s * 9, 214]], 100)), SKIN));
      o.push(line(`M${100 + s * 9},207 L${100 + s * 18},208 M${100 + s * 10},212 L${100 + s * 17},213`, '#e8e4dc', 0.9));
    }
    o.push(line('M100,120 L100,166', shade(c, 0.6), 0.8));
  }
  if (L.trouserKind === 'overall') {
    o.push(line('M88,150 L88,166 M112,150 L112,166', shade(c, 1.25), 0.8));
  }
  if (L.trouserBand) for (const s of [1, -1]) o.push(flat(`M${100 + s * 5.5},254 L${100 + s * 18},254 L${100 + s * 17},260 L${100 + s * 5.8},260Z`, L.trouserBand, `stroke="${INK}" stroke-width=".6"`));
  if (ex.has('kneepads')) {
    const kp = L.extras.find((e) => e.kind === 'kneepads');
    for (const s of [1, -1]) o.push(path(sp(at([[s * 6, 204], [s * 13, 200], [s * 20, 205], [s * 19, 219], [s * 13, 223], [s * 6, 218]], 100)), kp.col));
  }
  return o.join('');
}

function boots(B) {
  const o = [];
  for (const s of [1, -1]) {
    const x = 100 + s * ANK.x, xf = 100 + s * 12.5;
    const foot = (col, top = 284) => path(sp([[xf - 9, top, 1], [xf + 9, top, 1], [xf + 10.5, 295], [xf + 9, 300, 1], [xf - 9, 300, 1], [xf - 10.5, 295]]), col);
    const sole = (col) => flat(`M${xf - 10},298 L${xf + 10},298 L${xf + 9.5},302 L${xf - 9.5},302Z`, col, `stroke="${INK}" stroke-width="1"`);
    if (B.kind === 'work') {
      o.push(path(cap(100 + s * 11.6, 248, x, 287, 8.4, 8), B.col));
      o.push(foot(B.col, 286), sole('#1e140c'));
      o.push(line(`M${x - 3},252 L${x + 3},256 M${x + 3},252 L${x - 3},256 M${x - 3},262 L${x + 3},266 M${x + 3},262 L${x - 3},266 M${x - 3},272 L${x + 3},276 M${x + 3},272 L${x - 3},276`, '#c8b48a', 0.8));
      o.push(flat(`M${x - 8.4},248 L${x + 8.4},248 L${x + 8.4},252 L${x - 8.4},252Z`, shade(B.col, 0.7)));
    } else if (B.kind === 'sneaker') {
      o.push(path(sp([[xf - 8, 280, 1], [xf + 8, 280, 1], [xf + 10.5, 293], [xf + 9.5, 300, 1], [xf - 9.5, 300, 1], [xf - 10.5, 293]]), B.col));
      o.push(sole(B.sole || '#d8d0c0'));
      o.push(line(`M${xf - 8},292 Q${xf},287 ${xf + 8},292`, B.stripe || '#b8261c', 2.2));
      o.push(line(`M${xf - 3},283 L${xf + 3},283 M${xf - 3},286 L${xf + 3},286`, '#8a8478', 0.8));
    } else if (B.kind === 'rubber') {
      o.push(path(cap(100 + s * 12.6, 216, x, 288, 10.4, 8.6), B.col));
      o.push(foot(B.col, 288), sole(B.sole || '#7a5a2a'));
      o.push(flat(`M${100 + s * 12.6 - 10.4},214 L${100 + s * 12.6 + 10.4},214 L${100 + s * 12.6 + 10.2},219 L${100 + s * 12.6 - 10.2},219Z`, shade(B.col, 1.35), `stroke="${INK}" stroke-width=".8"`));
      o.push(line(`M${100 + s * 12.6 + s * 4},224 L${x + s * 3},282`, shade(B.col, 1.5), 1.6, 'opacity=".55"'));
    } else if (B.kind === 'riding') {
      o.push(path(sp([[100 + s * 3, 208, 1], [100 + s * 22.5, 200, 1], [100 + s * 21.5, 230], [x + s * 8.4, 286, 1], [x - s * 8.4, 286, 1], [100 + s * 4.2, 230]]), B.col));
      o.push(foot(B.col, 286), sole('#0c0e12'));
      o.push(line(`M${100 + s * 16},212 L${x + s * 3},280`, shade(B.col, 2.6), 1.8, 'opacity=".55"'));
      if (B.trim) o.push(line(`M${100 + s * 3.2},209 L${100 + s * 22.4},201`, B.trim, 1.6));
      o.push(flat(`M${100 + s * 18},266 L${100 + s * 22},266 L${100 + s * 22},271 L${100 + s * 18},271Z`, '#c9a34a', `stroke="${INK}" stroke-width=".6"`));
    } else if (B.kind === 'wrapped') {
      o.push(path(cap(100 + s * 12.6, 214, x, 288, 10.2, 8.4), B.col));
      o.push(foot(B.col, 288), sole('#1e2a26'));
      for (let y = 222; y < 284; y += 9) o.push(line(`M${x - 8.5},${y} L${x + 8.5},${y + 5}`, B.wrap, 2));
      o.push(path(sp([[100 + s * 4, 214, 1], [100 + s * 12, 204], [100 + s * 26, 198, 1], [100 + s * 22, 212], [100 + s * 21, 216, 1]]), B.fin));
      if (B.glow) o.push(glow(line(`M${x - s * 6},226 L${x - s * 5},282`, B.glow, 1.2)));
    } else if (B.kind === 'puttee') {
      o.push(path(cap(100 + s * 11.8, 236, x, 287, 8.8, 8), B.col));
      o.push(foot(B.col, 286), sole('#1e140c'));
      for (let y = 240; y < 280; y += 6) o.push(line(`M${x - 8.6},${y} L${x + 8.6},${y + 3.5}`, B.wrap, 2.2));
      o.push(path(sp([[xf - 9.5, 290, 1], [xf + 9.5, 290, 1], [xf + 10.5, 299, 1], [xf - 10.5, 299, 1]]), B.toe));
    } else if (B.kind === 'plate') {
      o.push(path(cap(100 + s * 12.6, 214, x, 286, 10, 8.2), B.col));
      o.push(line(`M${100 + s * 12.6},210 L${x},284`, shade(B.col, 1.5), 1.4));
      o.push(path(sp(at([[-10, 203], [0, 197], [10, 203], [10, 216], [0, 221], [-10, 216]], 100 + s * 13)), shade(B.col, 1.12)));
      o.push(circ(100 + s * 13, 209, 2.4, B.trim || '#e0b040', `stroke="${INK}" stroke-width=".6"`));
      for (let i = 0; i < 3; i++) o.push(path(sp([[xf - 9.5, 284 + i * 5, 1], [xf + 9.5, 284 + i * 5, 1], [xf + 10.5, 289 + i * 5, 1], [xf - 10.5, 289 + i * 5, 1]]), shade(B.col, 1 - i * 0.08)));
      o.push(sole('#2a2c30'));
      for (const y of [228, 248, 268]) o.push(circ(x + s * 6.5, y, 1.1, B.trim || '#e0b040'));
    }
  }
  return o.join('');
}

function torso(L, ex, cid) {
  const o = [];
  const c = L.coat;
  if (L.garment === 'coat' || L.garment === 'kmantel' || L.garment === 'jacket') {
    const t = sym([[0, 54, 1], [7, 50, 1], [11, 56], [24, 59], [32, 63], [35, 72], [28, 84], [25, 94], [20, 112], [21, BELT + 8, 1], [0, BELT + 8, 1]]);
    o.push(path(t, c));
    o.push(`<clipPath id="${cid}t"><path d="${t}"/></clipPath>`);
    // lapels and front edge
    o.push(line('M100,62 L100,126', shade(c, 0.55), 1.2));
    o.push(path(sp([[93, 56, 1], [100, 78, 1], [91, 72], [86, 60, 1]]), shade(c, 0.86)));
    o.push(path(sp([[107, 56, 1], [100, 78, 1], [109, 72], [114, 60, 1]]), shade(c, 0.86)));
    if (L.buttons !== false) for (const y of [86, 98, 110]) for (const s of [1, -1]) o.push(circ(100 + s * 6, y, 1.4, L.buttonCol || '#c9a34a', `stroke="${INK}" stroke-width=".5"`));
    if (L.garment === 'jacket' && L.hem > BELT + 8) {
      // Mid-length: the skirt cut on a row (hem at 0.69 or 0.79 m).
      for (const s of [1, -1]) {
        const half = [[3, BELT + 6, 1], [25, BELT + 6, 1], [31, L.hem - 12], [34, L.hem, 1], [4, L.hem, 1]];
        const d = sp(at(s > 0 ? half : mirror(half), 100));
        o.push(path(d, c));
        if (ex.has('chain')) o.push(`<path d="${d}" fill="url(#mail)" opacity=".75"/>`);
        o.push(line(`M${100 + s * 4.5},${L.hem - 1} L${100 + s * 33.5},${L.hem - 1}`, L.hemCol, 2.4));
      }
    }
  }
  if (L.garment === 'coat' || L.garment === 'kmantel') {
    const h = L.hem;
    for (const s of [1, -1]) {
      const half = [[3, BELT + 6, 1], [25, BELT + 6, 1], [31, 150], [38, h - 24], [44, h, 1], [28, h + 3], [10, h, 1], [6, 170]];
      const pts = at(s > 0 ? half : mirror(half), 100);
      o.push(path(sp(pts), c));
      o.push(line(`M${100 + s * 10.5},${h - 1} Q${100 + s * 27},${h + 3.5} ${100 + s * 43.5},${h - 1}`, L.hemCol, 2.6));
    }
    if (ex.has('pocket')) o.push(path(sp(at([[8, 160, 1], [22, 160, 1], [23, 170, 1], [9, 170, 1]], 100)), shade(c, 0.85)));
  }
  if (L.garment === 'vest' || L.garment === 'overall') {
    const t = sym([[0, 54, 1], [8, 51, 1], [10, 56], [18, 59], [22, 64], [21, 73], [25, 84], [24, 94], [20, 112], [22, BELT + 12, 1], [0, BELT + 12, 1]]);
    o.push(path(t, c));
    o.push(`<clipPath id="${cid}t"><path d="${t}"/></clipPath>`);
    if (L.garment === 'vest') {
      o.push(line('M100,60 L100,128', shade(c, 0.55), 1));
      for (const y of [80, 94]) o.push(line(`M${82},${y} L118,${y}`, L.strapCol || '#3a2414', 3.2));
      for (const y of [80, 94]) o.push(flat(`M97,${y - 2.4} L103,${y - 2.4} L103,${y + 2.4} L97,${y + 2.4}Z`, '#c9a34a', `stroke="${INK}" stroke-width=".5"`));
      o.push(line('M80,70 Q100,74 120,70', shade(c, 0.75), 1, 'opacity=".7"'));
    } else {
      // bib with straps and a pocket
      o.push(path(sp([[88, 78, 1], [112, 78, 1], [113, BELT + 2, 1], [87, BELT + 2, 1]]), shade(c, 1.08)));
      o.push(path(sp([[93, 84, 1], [107, 84, 1], [107, 96, 1], [93, 96, 1]]), shade(c, 0.9)));
      for (const s of [1, -1]) {
        o.push(line(`M${100 + s * 10},79 L${100 + s * 17},57`, shade(c, 0.8), 3.4));
        o.push(circ(100 + s * 10.5, 80, 1.8, L.buttonCol || '#c9a34a', `stroke="${INK}" stroke-width=".5"`));
      }
    }
  }
  if (L.garment === 'poncho') {
    const t = sp([[88, 56, 1], [112, 56, 1], [134, 80], [146, 130], [148, 182, 1], [128, 190], [100, 194], [72, 190], [52, 182, 1], [54, 130], [66, 80]]);
    o.push(path(t, c, 'fill-opacity=".86"'));
    o.push(`<clipPath id="${cid}t"><path d="${t}"/></clipPath>`);
    o.push(line('M100,62 L100,192', shade(c, 0.6), 1, 'opacity=".6"'));
    o.push(line('M66,98 Q100,112 134,98', shade(c, 1.4), 1.1, 'opacity=".45"'));
  }
  // Bands painted on the torso (reflective stripes, set stripes)
  for (const e of L.extras) {
    if (e.kind !== 'bands') continue;
    const g = e.glow ? glow : (s) => s;
    o.push(`<g clip-path="url(#${cid}t)">${g(e.ys.map((y) => flat(`M40,${y} L160,${y} L160,${y + (e.h || 4)} L40,${y + (e.h || 4)}Z`, e.col, e.glow ? '' : `stroke="${INK}" stroke-width=".4"`)).join(''))}</g>`);
    if (e.hem && (L.garment === 'coat' || L.garment === 'kmantel')) for (const s of [1, -1]) o.push(g(line(`M${100 + s * 9},${L.hem - 8} Q${100 + s * 27},${L.hem - 4} ${100 + s * 42},${L.hem - 8}`, e.col, e.h || 4)));
    if (e.hem && L.garment === 'jacket') for (const s of [1, -1]) o.push(g(line(`M${100 + s * 5},${L.hem - 7} L${100 + s * 33},${L.hem - 7}`, e.col, e.h || 4)));
  }
  return o.join('');
}

function belt(B, L) {
  if (!B || B.kind === 'none') return '';
  const o = [];
  const band = sp([[78, BELT, 1], [122, BELT, 1], [124, BELT + 10, 1], [76, BELT + 10, 1]]);
  if (B.kind !== 'overall') o.push(path(band, B.col));
  const bx = 100, by = BELT + 5;
  const buckle = (col, w = 7, h = 8) => flat(`M${bx - w / 2},${by - h / 2} L${bx + w / 2},${by - h / 2} L${bx + w / 2},${by + h / 2} L${bx - w / 2},${by + h / 2}Z`, col, `stroke="${INK}" stroke-width=".8"`);
  switch (B.kind) {
    case 'leather':
      o.push(buckle(B.buckle));
      o.push(path(sp([[122, BELT + 6, 1], [131, BELT + 6, 1], [131, BELT + 20, 1], [122, BELT + 20, 1]]), shade(B.col, 1.25)));
      break;
    case 'pouches':
      o.push(buckle(B.buckle));
      for (const x of [80, 110, 119]) o.push(path(sp([[x, BELT + 5, 1], [x + 8, BELT + 5, 1], [x + 8, BELT + 17, 1], [x, BELT + 17, 1]]), B.pouch || shade(B.col, 1.3)));
      break;
    case 'tool':
      o.push(buckle(B.buckle, 8, 9));
      // hammer on the right hip, pocket watch on the left
      o.push(line(`M126,${BELT + 4} L130,${BELT + 34}`, '#6a4a2a', 3));
      o.push(path(sp([[123, BELT + 32, 1], [137, BELT + 31, 1], [137, BELT + 37, 1], [123, BELT + 38, 1]]), '#7a7c80'));
      o.push(circ(84, BELT + 14, 4.8, '#c9a34a', `stroke="${INK}" stroke-width=".9"`), circ(84, BELT + 14, 3.2, '#f0e2c0'), line(`M84,${BELT + 14} L84,${BELT + 11.5} M84,${BELT + 14} L86,${BELT + 15}`, INK, 0.6));
      o.push(line(`M84,${BELT + 9} Q90,${BELT + 6} 94,${BELT + 4}`, '#c9a34a', 0.9));
      for (const x of [104, 113]) o.push(path(sp([[x, BELT + 5, 1], [x + 8, BELT + 5, 1], [x + 8, BELT + 16, 1], [x, BELT + 16, 1]]), shade(B.col, 1.3)));
      break;
    case 'studded':
      o.push(buckle(B.buckle, 9, 8));
      for (let x = 80; x < 121; x += 4.5) if (Math.abs(x - 100) > 6) o.push(circ(x, BELT + 5, 1.3, '#d8dce0', `stroke="${INK}" stroke-width=".4"`));
      o.push(line(`M118,${BELT + 9} Q126,${BELT + 22} 120,${BELT + 30}`, '#b8bcc0', 1.2));
      break;
    case 'fire':
      o.push(buckle('#b8bcc0', 9, 9));
      o.push(`<circle cx="114" cy="${BELT + 14}" r="4" fill="none" stroke="#c8ccd0" stroke-width="1.8"/>`);
      o.push(path(sp([[121, BELT + 4, 1], [129, BELT + 4, 1], [129, BELT + 22, 1], [121, BELT + 22, 1]]), '#2a2422'));
      o.push(line(`M125,${BELT + 22} L126,${BELT + 38}`, '#8a5a2a', 2.6), path(sp([[121, BELT + 34, 1], [134, BELT + 33, 1], [132, BELT + 40, 1]]), '#c03020'));
      break;
    case 'bvg':
      o.push(buckle(B.buckle, 8, 8));
      o.push(path(sp([[108, BELT + 5, 1], [120, BELT + 5, 1], [120, BELT + 19, 1], [108, BELT + 19, 1]]), '#1e2230'), line(`M110,${BELT + 9} L118,${BELT + 9}`, '#f2c230', 1.4));
      break;
    case 'duty':
      o.push(buckle(B.buckle, 8, 8));
      o.push(path(sp([[80, BELT + 4, 1], [86, BELT + 4, 1], [86, BELT + 24, 1], [80, BELT + 24, 1]]), '#2a2c30'), circ(83, BELT + 25, 2.6, '#f4f0c8', 'filter="url(#glow)"'));
      o.push(path(sp([[110, BELT + 4, 1], [121, BELT + 4, 1], [121, BELT + 18, 1], [110, BELT + 18, 1]]), shade(B.col, 1.3)), line(`M118,${BELT + 4} L118,${BELT - 6}`, '#2a2c30', 1.2));
      break;
    case 'sash':
      o.push(path(sp([[122, BELT + 4], [128, BELT + 8], [132, BELT + 34, 1], [124, BELT + 32, 1], [120, BELT + 10]]), B.col), path(sp([[118, BELT + 6], [124, BELT + 10], [124, BELT + 40, 1], [117, BELT + 36, 1]]), shade(B.col, 0.85)));
      for (const x of [86, 94, 106, 114]) o.push(circ(x, BELT + 5, 1.8, B.pearl || '#cfd8d0', `stroke="${INK}" stroke-width=".4"`));
      if (B.glow) o.push(glow(line(`M78,${BELT + 9} L122,${BELT + 9}`, B.glow, 0.9)));
      break;
    case 'knight':
      o.push(path(sp([[95, BELT - 1, 1], [105, BELT - 1, 1], [105, BELT + 11, 1], [95, BELT + 11, 1]]), B.buckle));
      o.push(line(`M104,${BELT + 10} Q106,${BELT + 30} 101,${BELT + 42}`, B.col, 2.4), circ(101, BELT + 44, 2.2, B.buckle));
      break;
    case 'rattails':
      o.push(buckle(B.buckle, 6, 7));
      for (const [x, k] of [[84, -1], [90, 1], [112, -1], [118, 1]]) o.push(line(`M${x},${BELT + 9} Q${x + k * 6},${BELT + 28} ${x - k * 2},${BELT + 46}`, '#c08a80', 1.4));
      break;
    case 'caps':
      o.push(buckle(B.buckle, 8, 8));
      o.push(line(`M118,${BELT + 10} L119,${BELT + 26}`, '#9a9ca0', 1.6), path(sp([[116, BELT + 26, 1], [122, BELT + 26, 1], [121, BELT + 31, 1], [117, BELT + 31, 1]]), '#b8bcc0'));
      break;
    case 'led':
      o.push(buckle('#2a2a32', 8, 8));
      o.push(glow([80, 85, 90, 110, 115, 120].map((x) => circ(x, BELT + 5, 1.2, B.glow)).join('')));
      break;
    case 'overall':
      o.push(line(`M120,${BELT + 2} L124,${BELT + 30}`, '#7a7c80', 2.4), path(sp([[119, BELT + 26, 1], [129, BELT + 27, 1], [128, BELT + 31, 1], [118, BELT + 30, 1]]), '#7a7c80'));
      break;
  }
  return o.join('');
}

function arms(L, ex) {
  const o = [];
  const sleeve = L.sleeves && L.garment !== 'vest' && L.garment !== 'overall';
  const parts = [];
  for (const s of [1, -1]) {
    const r = sleeve ? [8.6, 7.6, 6.6] : [6.4, 5.6, 4.6];
    parts.push(cap(100 + s * SH.x, SH.y, 100 + s * EL.x, EL.y, r[0], r[1]));
    parts.push(cap(100 + s * EL.x, EL.y, 100 + s * WR.x, WR.y, r[1], r[2]));
  }
  if (L.garment === 'poncho') {
    // Forearms come out under the poncho edge.
    const fa = [];
    for (const s of [1, -1]) fa.push(cap(100 + s * 40, 124, 100 + s * WR.x, WR.y, 7.4, 6.4));
    o.push(union(fa, L.under || '#4a4440'));
  } else {
    o.push(union(parts, sleeve ? L.coat : SKIN));
    if (sleeve && ex.has('chain')) o.push(parts.map((d) => `<path d="${d}" fill="url(#mail)" opacity=".75"/>`).join(''));
  }
  if (sleeve && L.garment !== 'poncho') {
    for (const s of [1, -1]) o.push(line(`M${100 + s * (WR.x - 6.4)},${WR.y - 6} L${100 + s * (WR.x + 6.4)},${WR.y - 3}`, L.hemCol, 2.4));
  }
  for (const e of L.extras) {
    if (e.kind === 'sleeveBands') for (const s of [1, -1]) for (const t of e.at) {
      const x = 100 + s * (EL.x + (WR.x - EL.x) * t), y = EL.y + (WR.y - EL.y) * t;
      o.push((e.glow ? glow : (z) => z)(line(`M${x - 7},${y - 1} L${x + 7},${y + 2}`, e.col, e.h || 3.2)));
    }
    if (e.kind === 'armband') o.push(line(`M${100 - 32 - 9},86 L${100 - 32 + 8},89`, e.col, 5), line(`M${100 - 32 - 9},86 L${100 - 32 + 8},89`, e.dot || '#f4f0e0', 1, 'stroke-dasharray="2 3"'));
  }
  return o.join('');
}

function hands(G) {
  const o = [];
  for (const s of [1, -1]) {
    const x = 100 + s * 46, y = 162;
    const handPath = sp([[x - 5.2, y - 11, 1], [x + 5.2, y - 11, 1], [x + 6.2, y + 2], [x + 3, y + 11], [x - 3, y + 11], [x - 6.2, y + 2]]);
    if (!G) { o.push(path(handPath, SKIN)); continue; }
    if (G.kind === 'boxing') {
      o.push(path(sp([[x - 8, y - 6], [x + 8, y - 8], [x + 11, y + 4], [x + 6, y + 15], [x - 6, y + 15], [x - 11, y + 4]]), G.col));
      o.push(path(sp([[x - 7.5, y - 13, 1], [x + 7.5, y - 13, 1], [x + 7.5, y - 5, 1], [x - 7.5, y - 5, 1]]), G.cuff));
      o.push(line(`M${x - 4},${y - 9} L${x + 4},${y - 9}`, G.lace || '#f0ece0', 1));
      o.push(line(`M${x + s * 4},${y - 2} Q${x + s * 7},${y + 5} ${x + s * 4},${y + 10}`, shade(G.col, 1.5), 1.6, 'opacity=".6"'));
      continue;
    }
    o.push(path(handPath, G.col));
    o.push(line(`M${x - 4},${y + 4} L${x - 4},${y + 10} M${x - 1.3},${y + 5} L${x - 1.3},${y + 11} M${x + 1.4},${y + 5} L${x + 1.4},${y + 11}`, shade(G.col, 0.6), 0.7));
    if (G.kind === 'work' || G.kind === 'garden' || G.kind === 'kiez') {
      o.push(path(sp([[x - 6.6, y - 16, 1], [x + 6.6, y - 16, 1], [x + 6.8, y - 9, 1], [x - 6.8, y - 9, 1]]), G.cuff || shade(G.col, 0.85)));
    }
    if (G.kind === 'kiez') o.push(path(sp([[x - 5, y - 4, 1], [x + 5, y - 4, 1], [x + 5.5, y + 1, 1], [x - 5.5, y + 1, 1]]), G.knuckle));
    if (G.kind === 'wraps') {
      for (let i = 0; i < 5; i++) {
        const yy = y - 30 + i * 6.5;
        o.push(line(`M${x - 6.6 + s * 0.6 * i},${yy} L${x + 6.6 + s * 0.6 * i},${yy + 3}`, G.col, 3.2), line(`M${x - 6.6 + s * 0.6 * i},${yy + 1.6} L${x + 6.6 + s * 0.6 * i},${yy + 4.6}`, shade(G.col, 0.7), 0.6));
      }
      if (G.stripe) o.push(line(`M${x - 6},${y - 2} L${x + 6},${y}`, G.stripe, 1.6));
    }
    if (G.kind === 'welder') {
      o.push(path(sp([[x - 6.4, y - 9, 1], [x + 6.4, y - 9, 1], [x + 10 + s * 2, y - 34, 1], [x - 10 + s * 2, y - 34, 1]]), G.cuff || G.col));
      o.push(line(`M${x - 8 + s * 1},${y - 24} L${x + 8 + s * 1.5},${y - 24}`, shade(G.col, 0.65), 0.8));
    }
  }
  return o.join('');
}

function head(L) {
  const o = [];
  o.push(ell(85.6, 30, 2.6, 4.2, fill(SKIN), `stroke="${INK}" stroke-width="1"`), ell(114.4, 30, 2.6, 4.2, fill(SKIN), `stroke="${INK}" stroke-width="1"`));
  o.push(path(sym([[0, 9], [11, 12], [14.5, 24], [13.5, 36], [8, 45], [0, 48, 1]]), SKIN));
  // face
  o.push(ell(94.5, 28.5, 2.3, 1.5, '#2a1a12'), ell(105.5, 28.5, 2.3, 1.5, '#2a1a12'));
  o.push(line('M91.5,24.8 Q94.5,23.2 97.5,24.6 M102.5,24.6 Q105.5,23.2 108.5,24.8', '#2a1a12', 1.2));
  o.push(line('M100.4,30 L101.6,35 L99.4,35.6', shade(SKIN, 0.7), 0.9));
  o.push(line('M96.5,40 Q100,41.8 103.5,40', '#7a3a30', 1.3));
  if (L.hat && L.hat.kind === 'greathelm') return o.join('');
  // hair: cap with side strands
  o.push(path(sp([[100, 5], [111, 7], [117, 17], [117.5, 30], [116, 44, 1], [113, 43], [113.5, 28], [110, 18], [101, 15.5], [95, 19], [90, 17.5], [86.5, 28], [87, 43], [84, 44, 1], [82.5, 30], [83, 17], [89, 7]]), HAIR));
  o.push(line('M95,8 Q90,12 88,20 M104,8 Q110,11 112,19', shade(HAIR, 1.6), 0.8, 'opacity=".6"'));
  return o.join('');
}

function scarf(c) {
  const o = [];
  o.push(path(sp([[86, 52], [100, 49], [114, 52], [116, 60], [110, 67], [100, 69], [90, 67], [84, 60]]), c));
  o.push(line('M88,56 Q100,61 112,56 M88,62 Q100,66 112,62', shade(c, 0.62), 1));
  o.push(path(sp([[104, 64], [111, 66], [113, 84, 1], [106, 90, 1], [103, 74]]), shade(c, 0.92)));
  return o.join('');
}

function collar(L, ex, exOf) {
  const e = exOf('collar');
  if (!e) return '';
  const o = [];
  if (e.style === 'stand') o.push(path(sp([[86, 46, 1], [114, 46, 1], [117, 60, 1], [83, 60, 1]]), e.col));
  if (e.style === 'high') o.push(path(sp([[82, 38, 1], [92, 44], [108, 44], [118, 38, 1], [121, 62, 1], [79, 62, 1]]), e.col), line('M83,42 L80,60 M117,42 L120,60', shade(e.col, 1.4), 0.8));
  if (e.style === 'fur') {
    // Shawl collar: lumps behind the neck and down both lapels, wider than the scarf.
    const lumps = [];
    for (let i = 0; i < 7; i++) lumps.push([84 + i * 5.3, 50 + (i % 2) * 1.5]);
    for (const s of [1, -1]) for (let i = 0; i < 7; i++) {
      const t = i / 6;
      lumps.push([100 + s * (31 - t * 22), 62 + t * 36 + (i % 2) * 1.5]);
    }
    for (const [x, y] of lumps) o.push(circ(x, y, 6.2, fill(e.col), `stroke="${INK}" stroke-width="1"`));
    for (const [x, y] of lumps) o.push(line(`M${x - 2},${y - 2} l1.5,4 M${x + 1.5},${y - 3} l1,4`, shade(e.col, 1.35), 0.7));
  }
  if (e.style === 'reed') {
    for (let i = 0; i < 11; i++) {
      const x = 80 + i * 4, h = 14 + (i % 3) * 4;
      o.push(path(sp([[x - 2.2, 62, 1], [x + 2.2, 62, 1], [x + (i - 5) * 0.8, 62 - h, 1]]), i % 2 ? e.col : shade(e.col, 1.25)));
    }
  }
  if (e.style === 'gorget') o.push(path(sp([[84, 50, 1], [116, 50, 1], [122, 64], [100, 70], [78, 64]]), e.col), line('M82,57 Q100,64 118,57', shade(e.col, 1.4), 0.9));
  return o.join('');
}

function hat(H) {
  const o = [];
  const c = H.col;
  switch (H.kind) {
    case 'hardhat':
      o.push(path(sym([[0, 0], [12, 2.5], [17.5, 11], [18.5, 19, 1], [0, 19, 1]]), c));
      o.push(ell(100, 19.5, 22, 3.6, fill(shade(c, 0.9)), `stroke="${INK}" stroke-width="1.2"`));
      o.push(line('M100,1 L100,18', shade(c, 1.4), 2.2));
      if (H.stripe) o.push(line('M83.5,14 Q100,10.5 116.5,14', H.stripe, 2.6));
      if (H.lamp) o.push(path(sp([[95, 9, 1], [105, 9, 1], [105, 16, 1], [95, 16, 1]]), '#3a3c40'), glow(circ(100, 12.5, 2.6, H.lamp)));
      if (H.sticker) o.push(circ(109, 11, 2.6, H.sticker, `stroke="${INK}" stroke-width=".5"`));
      break;
    case 'flatcap':
      o.push(path(sym([[0, 4], [13, 5], [19, 11], [19.5, 18, 1], [0, 18, 1]]), c));
      o.push(path(sp([[85, 17, 1], [115, 17, 1], [117, 21], [100, 23.5], [83, 21]]), shade(c, 0.8)));
      o.push(circ(100, 5, 1.8, shade(c, 0.8)), line('M86,12 Q100,8 114,12', shade(c, 1.3), 0.8, 'stroke-dasharray="1.5 2"'));
      break;
    case 'beanie':
      o.push(path(sym([[0, 1], [12, 3.5], [17.5, 12], [18, 18, 1], [0, 18, 1]]), c));
      o.push(path(sp([[81.5, 16, 1], [118.5, 16, 1], [118.5, 24, 1], [81.5, 24, 1]]), shade(c, 0.86)));
      for (let x = 84; x < 118; x += 3.4) o.push(line(`M${x},17 L${x},23`, shade(c, 0.66), 0.7));
      for (let x = 88; x < 114; x += 4) o.push(line(`M${x},5 Q${x + (x - 100) * 0.1},10 ${x + (x - 100) * 0.12},15`, shade(c, 0.75), 0.6));
      if (H.patch) o.push(circ(110, 20, 2.8, H.patch, `stroke="${INK}" stroke-width=".6"`));
      break;
    case 'gasmask':
      o.push(line('M86,24 Q100,8 114,24', '#2a2a26', 2.2), line('M85,36 Q86,30 87,24 M115,36 Q114,30 113,24', '#2a2a26', 2.2));
      o.push(path(sp([[86, 22, 1], [114, 22, 1], [116, 34], [108, 46], [100, 48], [92, 46], [84, 34]]), c));
      for (const x of [94, 106]) o.push(circ(x, 29.5, 4.6, '#d8e4e0', `stroke="${INK}" stroke-width="1.4"`), circ(x - 1, 28.5, 1.6, '#ffffff', 'opacity=".8"'));
      o.push(path(sp([[95, 37, 1], [105, 37, 1], [107, 47, 1], [93, 47, 1]]), shade(c, 0.85)));
      o.push(path(sp([[92.5, 46, 1], [107.5, 46, 1], [106.5, 56, 1], [93.5, 56, 1]]), H.filter || '#6a5a3a'));
      for (const y of [49, 52]) o.push(line(`M93.5,${y} L106.5,${y}`, INK, 0.7));
      break;
    case 'goggles':
      o.push(line('M83,28 L117,28', '#1e1e24', 5));
      o.push(path(sp([[85, 23, 1], [115, 23, 1], [117, 30], [107, 34], [100, 31.5], [93, 34], [83, 30]]), '#1e1e24'));
      o.push(glow(flat(sp([[87, 24.6, 1], [113, 24.6, 1], [114.6, 29.6], [106.6, 32.4], [100, 30], [93.4, 32.4], [85.4, 29.6]]), H.glow)));
      o.push(line('M89,26 L96,26', '#ffffff', 0.9, 'opacity=".8"'));
      break;
    case 'straw':
      o.push(ell(100, 15, 33, 6.4, fill(c), `stroke="${INK}" stroke-width="1.3"`));
      o.push(path(sym([[0, -2], [11, -1], [15, 6], [15.5, 14, 1], [0, 14, 1]]), c));
      o.push(flat('M84.6,9 L115.4,9 L115.5,14 L84.5,14Z', H.band, `stroke="${INK}" stroke-width=".6"`));
      for (let i = 0; i < 7; i++) o.push(line(`M${70 + i * 10},14 Q${70 + i * 10 + 2},17 ${70 + i * 10 + 1},19`, shade(c, 0.7), 0.6));
      if (H.flower) o.push(circ(112, 11, 2.8, H.flower, `stroke="${INK}" stroke-width=".5"`), circ(112, 11, 1, '#5a3a14'));
      break;
    case 'pickel':
      o.push(path(sym([[0, 3], [12, 4], [17.5, 12], [18, 20, 1], [0, 20, 1]]), c));
      o.push(path(sp([[86, 19, 1], [114, 19, 1], [112, 24], [100, 25.5], [88, 24]]), shade(c, 0.8)));
      o.push(path(sp([[96, 4, 1], [104, 4, 1], [101.5, -4, 1], [100, -14, 1], [98.5, -4, 1]]), H.brass));
      o.push(circ(100, 4, 4.6, fill(H.brass), `stroke="${INK}" stroke-width="1"`));
      o.push(path(sp([[95, 9], [100, 6.5], [105, 9], [104, 15], [100, 18], [96, 15]]), H.brass));
      o.push(line('M86,22 Q87,38 94,47 M114,22 Q113,38 106,47', H.brass, 1.6, 'stroke-dasharray="1.6 1"'));
      if (H.glint) o.push(glow(circ(100, -10, 1.6, '#fff4c8')));
      break;
    case 'headlamp':
      // Goggles pushed up on the forehead, a headband with a brass lamp (U-Bahn board).
      o.push(line('M83.5,19 Q100,13 116.5,19', '#2a2420', 3.6));
      for (const x of [93, 107]) o.push(circ(x, 15.5, 4.2, '#5a4a30', `stroke="${INK}" stroke-width="1"`), circ(x, 15.5, 2.6, '#9fc8c8', 'opacity=".85"'));
      o.push(path(sp([[96, 6, 1], [104, 6, 1], [105, 13, 1], [95, 13, 1]]), H.brass), glow(circ(100, 9.5, 3, H.glow)));
      break;
    case 'greathelm':
      o.push(path(sp([[82, 4, 1], [100, 0], [118, 4, 1], [119, 50, 1], [100, 53], [81, 50, 1]]), c));
      o.push(flat('M84,25 L98,25 L98,29 L84,29Z M102,25 L116,25 L116,29 L102,29Z', '#0c0c0e'));
      o.push(flat('M98,2 L102,2 L102,52 L98,52Z M82,21 L118,21 L118,23.5 L82,23.5Z', H.trim, `stroke="${INK}" stroke-width=".5"`));
      for (const [x, y] of [[107, 36], [111, 36], [107, 40], [111, 40], [107, 44], [111, 44]]) o.push(circ(x, y, 0.9, '#0c0c0e'));
      o.push(line('M84,8 L84,48', shade(c, 1.4), 1.4, 'opacity=".6"'));
      if (H.plume) o.push(path(sp([[96, 3, 1], [104, 3, 1], [108, -8], [100, -14], [92, -8]]), H.plume));
      break;
  }
  return o.join('');
}

function gear(L, ex, exOf) {
  const o = [];
  for (const e of L.extras) {
    const k = typeof e === 'string' ? e : e.kind;
    switch (k) {
      case 'studs':
        for (const s of [1, -1]) for (let i = 0; i < 5; i++) o.push(circ(100 + s * (13 + i * 4.2), 59.5 + i * 1.1, 1.3, '#dfe3e6', `stroke="${INK}" stroke-width=".4"`));
        break;
      case 'shoulderboards':
        for (const s of [1, -1]) o.push(`<path d="${sp(at(s > 0 ? [[14, 57, 1], [32, 61, 1], [32, 66, 1], [14, 62, 1]] : mirror([[14, 57, 1], [32, 61, 1], [32, 66, 1], [14, 62, 1]]), 100))}" fill="${e.col}" stroke="${INK}" stroke-width="1"/>`);
        break;
      case 'badge':
        if (e.shape === 'shield') o.push(path(sp(at([[-5, 0, 1], [5, 0, 1], [5, 6], [0, 11, 1], [-5, 6]], e.x || 112).map(([x, y, s]) => [x, y + (e.y || 82), s])), e.col), e.mark ? circ(e.x || 112, (e.y || 82) + 4.5, 2, e.mark) : '');
        else o.push(circ(e.x || 112, e.y || 88, e.r || 4.2, fill(e.col), `stroke="${INK}" stroke-width="1"`), e.mark ? circ(e.x || 112, e.y || 88, (e.r || 4.2) * 0.45, e.mark) : '');
        if (e.glow) o.push(glow(circ(e.x || 112, e.y || 88, (e.r || 4.2) * 0.5, e.glow)));
        break;
      case 'cables': {
        const g = [];
        for (const [x0, x1, y1] of [[90, 86, 112], [84, 80, 104], [112, 118, 110]]) {
          o.push(line(`M${x0},58 Q${x0 + (x0 < 100 ? -12 : 12)},76 ${x1},${y1}`, '#2a2230', 3), line(`M${x0},58 Q${x0 + (x0 < 100 ? -12 : 12)},76 ${x1},${y1}`, '#4a3e52', 1.4));
          g.push(circ(x1, y1 + 1.5, 2.2, e.glow));
        }
        o.push(glow(g.join('')));
        break;
      }
      case 'caps':
        [[91, 84, '#c8302a'], [97, 90, '#e8c838'], [93, 97, '#3a7ac0'], [106, 86, '#d8d8d0'], [110, 95, '#2f8a4a'], [104, 102, '#e07020']].forEach(([x, y, c]) => o.push(circ(x, y, 2.4, c, `stroke="${INK}" stroke-width=".7" stroke-dasharray="1 .6"`)));
        break;
      case 'patches':
        e.items.forEach(([x, y, w, h, c, r]) => o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="${INK}" stroke-width=".7" transform="rotate(${r} ${x + w / 2} ${y + h / 2})" stroke-dasharray="1.4 1"/>`));
        break;
      case 'sign':
        o.push(path(sp([[e.x - 9, e.y - 4, 1], [e.x + 9, e.y - 4, 1], [e.x + 9, e.y + 4, 1], [e.x - 9, e.y + 4, 1]]), '#1a1420'));
        o.push(glow(`<text x="${e.x}" y="${e.y + 2.3}" font-size="6.2" font-weight="700" fill="${e.glow}" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${e.text}</text>`));
        break;
      case 'chestplate':
        o.push(path(sp([[82, 64], [100, 60], [118, 64], [121, 86], [116, 108], [100, BELT + 2, 1], [84, 108], [79, 86]]), e.col));
        o.push(line('M100,62 L100,116', shade(e.col, 1.45), 1.4), line('M84,78 Q100,86 116,78', shade(e.col, 0.7), 0.9));
        for (const [x, y] of [[84, 68], [116, 68], [86, 104], [114, 104]]) o.push(circ(x, y, 1.1, e.rivet || '#d8d4c8'));
        if (e.stripe) o.push(flat('M82,96 L118,96 L117.5,101 L82.5,101Z', e.stripe, `stroke="${INK}" stroke-width=".5"`), flat('M86,96 L90,96 L88,101 L84,101Z M94,96 L98,96 L96,101 L92,101Z M102,96 L106,96 L104,101 L100,101Z M110,96 L114,96 L112,101 L108,101Z', '#1a1a1a'));
        if (e.gem) o.push(glow(path(sp([[100, 76], [104, 81], [100, 86], [96, 81]]), e.gem)));
        if (e.boss) o.push(circ(100, 84, 6, fill(e.boss), `stroke="${INK}" stroke-width="1"`), circ(100, 84, 2, shade(e.boss, 0.6)));
        break;
      case 'pauldrons':
        for (const s of [1, -1]) for (let i = (e.lames || 2) - 1; i >= 0; i--) {
          const cx = 100 + s * (31 + i * 2.2), cy = 66 + i * 8;
          o.push(path(sp([[cx - 12, cy + 4], [cx - 9, cy - 6], [cx, cy - 10], [cx + 9, cy - 6], [cx + 12, cy + 4], [cx, cy + 7]]), shade(e.col, 1 - i * 0.07)));
          if (i === 0 && e.rivet) o.push(circ(cx, cy - 4, 1.2, e.rivet));
        }
        break;
      case 'tassets':
        for (const s of [1, -1]) for (let i = 0; i < 2; i++) o.push(path(sp(at([[s * 5, BELT + 10 + i * 13, 1], [s * 26, BELT + 10 + i * 13, 1], [s * 28, BELT + 25 + i * 13], [s * 6, BELT + 25 + i * 13]], 100)), shade(e.col, 1 - i * 0.08)));
        break;
      case 'vambraces':
        for (const s of [1, -1]) o.push(path(cap(100 + s * (EL.x + 1.5), EL.y + 8, 100 + s * (WR.x - 0.2), WR.y - 3, 8, 7), e.col), line(`M${100 + s * (EL.x + 1.5)},${EL.y + 6} L${100 + s * WR.x},${WR.y - 4}`, shade(e.col, 1.5), 1));
        break;
      case 'tabard':
        o.push(path(sp([[88, 64, 1], [112, 64, 1], [113, BELT, 1], [116, L.hem - 4, 1], [100, L.hem + 4], [84, L.hem - 4, 1], [87, BELT, 1]]), e.col));
        o.push(line(`M88.5,66 L87.5,${BELT} L85,${L.hem - 5} M111.5,66 L112.5,${BELT} L115,${L.hem - 5}`, e.trim, 1.4));
        o.push(path(sp([[93, 76, 1], [107, 76, 1], [107, 88], [100, 96, 1], [93, 88]]), e.crest));
        o.push(path(sp([[97, 80, 1], [103, 80, 1], [103, 86], [100, 90, 1], [97, 86]]), e.col));
        break;
      case 'seams':
        o.push(glow(line(`M100,64 L100,${BELT}`, e.col, 1) + (L.garment === 'coat' ? [1, -1].map((s) => line(`M${100 + s * 4},${BELT + 10} L${100 + s * 9.5},${L.hem - 2} Q${100 + s * 27},${L.hem + 2.5} ${100 + s * 43},${L.hem - 2}`, e.col, 1.1)).join('') : '')));
        break;
      case 'waves':
        for (const s of [1, -1]) for (const [dy, w] of [[-16, 2.2], [-9, 2.6]]) {
          const y = L.hem + dy;
          o.push(line(`M${100 + s * 8},${y} q${s * 4},-3 ${s * 8},0 t${s * 8},0 t${s * 8},0 t${s * 8},0`, e.col, w));
        }
        break;
      case 'harness':
        // Pressure tank on the back: its cap shows over the right shoulder, straps cross the chest, a gauge on the strap, a hose.
        o.push(path(sp([[118, 40, 1], [130, 40, 1], [131, 66, 1], [117, 66, 1]]), e.tank), circ(124, 40, 3, '#7a7c80', `stroke="${INK}" stroke-width=".8"`));
        o.push(line('M84,60 L114,118 M116,60 L86,118', e.strap, 3.4));
        o.push(circ(106, 84, 5.4, fill('#c9a34a'), `stroke="${INK}" stroke-width="1"`), circ(106, 84, 3.8, '#f0e2c0'), line('M106,84 L108.5,81.5', INK, 0.8));
        o.push(line('M126,64 Q140,96 118,112', '#3a3a36', 2.2));
        o.push(path(sp([[86, 100, 1], [94, 98, 1], [95, 106, 1], [87, 108, 1]]), e.tag), `<text x="90.8" y="106" font-size="6" font-weight="700" fill="#1a1a1a" text-anchor="middle" font-family="DejaVu Sans, sans-serif">U</text>`);
        break;
      case 'radio':
        o.push(path(sp([[84, 74, 1], [92, 74, 1], [92, 86, 1], [84, 86, 1]]), '#2a2c30'), line('M86,74 L86,64', '#2a2c30', 1.4), glow(circ(90, 77, 1, '#ff3a2a')));
        break;
      case 'whistle':
        o.push(line('M108,62 Q110,76 107,84', '#f08a24', 0.9), path(sp([[104, 84, 1], [111, 84, 1], [111, 88, 1], [104, 88, 1]]), '#c8ccd0'));
        break;
      case 'chain':
        o.push(`<g clip-path="url(#c${clipN - 1}t)"><rect x="60" y="50" width="80" height="90" fill="url(#mail)" opacity=".75"/></g>`);
        break;
      case 'furtufts':
        for (let i = 0; i < 12; i++) {
          const s = i % 2 ? 1 : -1, t = Math.floor(i / 2) / 6;
          const y = BELT + 24 + t * (L.hem - BELT - 30), x = 100 + s * (10 + t * 30);
          o.push(path(sp([[x - 3, y], [x + 3, y], [x + s * 1, y + 8, 1]]), shade(e.col, 0.8 + (i % 3) * 0.1)));
        }
        break;
      case 'rivetsCoat':
        for (const s of [1, -1]) for (let y = 138; y < L.hem - 6; y += 12) o.push(circ(100 + s * (8 + (y - 130) * 0.13), y, 1, '#c8ccd0'));
        break;
      case 'glowGloves':
        for (const s of [1, -1]) o.push(glow(circ(100 + s * 46, 158, 2.4, e.col)));
        break;
    }
  }
  o.push(hands(L.gloves));
  return o.join('');
}

export const mailPattern = `<pattern id="mail" width="4" height="3.4" patternUnits="userSpaceOnUse"><path d="M0,1.7 a2,1.7 0 1,0 4,0 a2,1.7 0 1,0 -4,0" fill="none" stroke="#2a2c30" stroke-width=".7"/><path d="M2,0 a2,1.7 0 1,0 0.01,0" fill="none" stroke="#dfe3e8" stroke-width=".35" opacity=".6"/></pattern>`;
