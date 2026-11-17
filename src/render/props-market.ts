// M11c lot type props, market and garden set: stalls (intact, broken), spilled goods, garden sheds (Lauben),
// beds, gnomes, the pond jetty and low picket fences. Footprints: `propCollider` in `src/data/courtyard.ts`.
// Goods, Laube walls, felt and soil come from the `market` atlas (`MARKET_TILES` in paint.ts), tarps from
// `tarp`; lit lanterns and bulbs use the emissive `lampGlass` (no lights here: the lead adds string lights).
import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, PlaneGeometry, TorusGeometry } from 'three';
import type { MarketPropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { buildCrate } from './breakable-parts';
import { MARKET_TILES } from './paint';
import { at, type Builder } from './world';

type RGB = readonly [number, number, number];
type Tile = keyof typeof MARKET_TILES;

const KINDS: ReadonlySet<string> = new Set<MarketPropKind>(['stall', 'stallBroken', 'spill', 'shed', 'gardenBed', 'gnome', 'jetty', 'picket']);

// ---------------------------------------------------------------- geometry helpers

/** Local transform, rotation order Y, X, Z like `at`. */
function L(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Matrix4 {
  const m = new Matrix4().makeRotationY(ry);
  if (rx) m.multiply(new Matrix4().makeRotationX(rx));
  if (rz) m.multiply(new Matrix4().makeRotationZ(rz));
  return m.setPosition(x, y, z);
}
const M = (base: Matrix4, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Matrix4 => base.clone().multiply(L(x, y, z, rx, ry, rz));
const S = (m: Matrix4, sx: number, sy: number, sz: number): Matrix4 => m.clone().multiply(new Matrix4().makeScale(sx, sy, sz));

/** UV rect of an atlas tile (inset against mip bleed); `half` 0/1 picks the left/right half. */
function rect(tile: Tile, half = -1): [number, number, number, number] {
  const i = MARKET_TILES[tile];
  const e = 0.006;
  let u0 = (i % 4) / 4 + e, u1 = (i % 4 + 1) / 4 - e;
  if (half >= 0) [u0, u1] = half ? [(u0 + u1) / 2 + e, u1] : [u0, (u0 + u1) / 2 - e];
  return [u0, 1 - (Math.floor(i / 4) + 1) / 4 + e, u1, 1 - Math.floor(i / 4) / 4 - e];
}
function remap(g: BufferGeometry, r: readonly number[], faces?: Array<readonly number[]>): BufferGeometry {
  const uv = g.getAttribute('uv');
  for (let k = 0; k < uv.count; k++) {
    const q = faces?.[Math.floor(k / 4)] ?? r;
    uv.setXY(k, q[0]! + uv.getX(k) * (q[2]! - q[0]!), q[1]! + uv.getY(k) * (q[3]! - q[1]!));
  }
  return g;
}
const cache = new Map<string, BufferGeometry>();
const cached = (key: string, make: () => BufferGeometry): BufferGeometry => { let g = cache.get(key); if (!g) cache.set(key, (g = make())); return g; };
/** Unit box mapped to `tile`; `top` maps the +y face elsewhere, `front` the +z face. */
const boxG = (tile: Tile, top: Tile = tile, front: Tile = tile, half = -1): BufferGeometry =>
  cached(`b${tile}${top}${front}${half}`, () => { const s = rect(tile); return remap(new BoxGeometry(1, 1, 1), s, [s, s, rect(top), s, rect(front, half), s]); });
const cylG = (tile: Tile, seg = 8): BufferGeometry => cached(`c${tile}${seg}`, () => remap(new CylinderGeometry(1, 1, 1, seg), rect(tile)));
const ballG = (tile: Tile, detail = 0): BufferGeometry => cached(`s${tile}${detail}`, () => remap(new IcosahedronGeometry(1, detail), rect(tile)));
const planeG = (tile: Tile, half = -1): BufferGeometry => cached(`p${tile}${half}`, () => remap(new PlaneGeometry(1, 1), rect(tile, half)));
const coneG = (seg: number): BufferGeometry => cached(`k${seg}`, () => remap(new ConeGeometry(1, 1, seg), rect('plain')));
const card = cached('card', () => new PlaneGeometry(1, 1).translate(0, 0.5, 0));

function tbox(b: Builder, m: Matrix4, sx: number, sy: number, sz: number, tile: Tile, tint?: RGB, top?: Tile, front?: Tile, half = -1): void {
  b.geo(b.mats.market, boxG(tile, top, front, half), S(m, sx, sy, sz), tint);
}
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** A grid sheet whose corners follow `f(u, v)`; band 0..3 of the tarp texture, right half when torn. */
function sheet(b: Builder, base: Matrix4, nx: number, ny: number, band: number, torn: boolean, f: (u: number, v: number) => [number, number, number], tint: RGB): void {
  const g = new PlaneGeometry(1, 1, nx, ny);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const [u0, u1] = torn ? [0.5, 1] : [0, 0.5];
  const [v0, v1] = [1 - (band + 1) / 4 + 0.01, 1 - band / 4 - 0.01];
  for (let k = 0; k < pos.count; k++) {
    const u = uv.getX(k), v = uv.getY(k);
    pos.setXYZ(k, ...f(u, v));
    uv.setXY(k, u0 + u * (u1 - u0), v0 + v * (v1 - v0));
  }
  g.computeVertexNormals();
  b.geo(b.mats.tarp, g, base, tint);
}

// ---------------------------------------------------------------- goods

const PRODUCE: Array<[Tile, number, RGB, number]> = [['apples', 0.07, [0.85, 0.25, 0.18], 5], ['cabbage', 0.12, [0.6, 0.78, 0.42], 3], ['potatoes', 0.06, [0.7, 0.55, 0.36], 5]];

/** Cheap slatted crate (three boxes): planked body plus two dark gaps; `buildCrate` is ten times the cost. */
function crate(b: Builder, base: Matrix4, s: number, rng: Rng): void {
  const k = s / 0.72, t: RGB = [rng.range(0.75, 0.95), rng.range(0.72, 0.85), 0.7];
  b.box(b.mats.wood, M(base, 0, 0.37 * k, 0, 0, rng.range(-0.03, 0.03)), 0.72 * k, 0.74 * k, 0.72 * k, t, 1);
  for (const y of [0.26, 0.5]) b.box(b.mats.wood, M(base, 0, y * k, 0), 0.735 * k, 0.03 * k, 0.735 * k, [0.25, 0.22, 0.2]);
}

/** Crate of produce: crate, heaped top in the produce tile, a few loose pieces for the silhouette. */
function produceCrate(b: Builder, base: Matrix4, s: number, rng: Rng, kind = rng.int(3)): void {
  crate(b, base, s, rng);
  const k = s / 0.72;
  const [tile, r, col, n] = PRODUCE[kind]!;
  tbox(b, M(base, 0, 0.66 * k, 0), 0.62 * k, 0.1, 0.62 * k, tile, [1, 1, 1]);
  for (let i = 0; i < n; i++) b.geo(b.mats.market, ballG('plain'), S(M(base, rng.range(-0.22, 0.22) * k, 0.73 * k + r * 0.6, rng.range(-0.22, 0.22) * k, rng.next(), rng.next()), r, r * 0.85, r), shade(col, rng.range(0.85, 1.1)));
}

/** A pyramid of cans or jars, rows shrinking upward; one or two missing or knocked over. */
function pyramid(b: Builder, base: Matrix4, rng: Rng, tile: Tile, rows: number): void {
  const r = tile === 'jars' ? 0.075 : 0.065, h = tile === 'jars' ? 0.18 : 0.15;
  for (let row = 0; row < rows; row++) {
    const n = rows - row;
    for (let i = 0; i < n; i++) {
      if (row > 0 && rng.next() < 0.1) continue;
      b.geo(b.mats.market, cylG(tile, 8), S(M(base, (i - (n - 1) / 2) * r * 2.1 + rng.range(-0.01, 0.01), h / 2 + row * h, rng.range(-0.015, 0.015), 0, rng.range(0, 6.3)), r, h, r));
    }
  }
  if (rng.next() < 0.6) b.geo(b.mats.market, cylG(tile, 8), S(M(base, rows * r + 0.08, r, 0.12, Math.PI / 2, rng.range(-1, 1)), r, h, r));
}

/** Shirt or trousers hanging from a rail at `base` (hook point). */
function garment(b: Builder, base: Matrix4, rng: Rng): void {
  const tile: Tile = rng.next() < 0.5 ? 'plaid' : 'knit';
  const tint: RGB = rng.pick<RGB>([[1, 1, 1], [0.8, 0.9, 0.7], [1.1, 0.95, 0.7], [0.7, 0.7, 0.75], [1.2, 1.1, 1]]);
  b.box(b.mats.iron, M(base, 0, -0.06, 0), 0.34, 0.02, 0.02, [0.5, 0.5, 0.5]);
  if (rng.next() < 0.65) {
    tbox(b, M(base, 0, -0.42, 0), 0.4, 0.66, 0.04, tile, tint);
    for (const sx of [-1, 1]) tbox(b, M(base, sx * 0.24, -0.3, 0, 0, 0, sx * 0.35), 0.12, 0.42, 0.035, tile, shade(tint, 0.9));
  } else {
    for (const sx of [-1, 1]) tbox(b, M(base, sx * 0.09, -0.48, 0, 0, 0, sx * 0.05), 0.16, 0.86, 0.04, 'knit', shade(tint, 0.85));
  }
}

function lantern(b: Builder, base: Matrix4, hanging: boolean): void {
  const m = b.mats;
  b.geo(m.lampGlass, cylG('plain', 6), S(M(base, 0, 0.12, 0), 0.065, 0.16, 0.065));
  b.box(m.iron, M(base, 0, 0.03, 0), 0.17, 0.04, 0.17, [0.6, 0.5, 0.4]);
  b.geo(m.iron, coneG(6), S(M(base, 0, 0.24, 0), 0.11, 0.08, 0.11), [0.6, 0.5, 0.4]);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) b.box(m.iron, M(base, x * 0.07, 0.12, z * 0.07), 0.015, 0.18, 0.015);
  if (hanging) b.box(m.iron, M(base, 0, 0.36, 0), 0.012, 0.22, 0.012);
}

/** Goods on a counter top at `top` (y = counter height, x along the counter, +z toward the customer). */
function goods(b: Builder, top: Matrix4, w: number, rng: Rng, kind: number): void {
  const m = b.mats;
  const x = (f: number): number => (f - 0.5) * (w - 0.3);
  switch (kind) {
    case 0: { // fruit and vegetables: crates tipped toward the customer, a sack on the side
      const n = 2 + rng.int(2);
      for (let i = 0; i < n; i++) produceCrate(b, M(top, x((i + 0.5) / n) + rng.range(-0.05, 0.05), 0, rng.range(-0.05, 0.1), 0.22, rng.range(-0.15, 0.15)), rng.range(0.44, 0.52), rng, (i + rng.int(3)) % 3);
      break;
    }
    case 1: { // cans and jars, two pyramids and a loose jar row
      pyramid(b, M(top, x(0.25), 0, 0.05, 0, rng.range(-0.2, 0.2)), rng, 'cans', 4 + rng.int(2));
      pyramid(b, M(top, x(0.78), 0, 0.0, 0, rng.range(-0.2, 0.2)), rng, 'jars', 3);
      break;
    }
    case 2: { // clothes: folded stacks on the table (the rail is added by the stall)
      for (let i = 0; i < 4; i++) {
        const h = rng.range(0.08, 0.2);
        tbox(b, M(top, x((i + 0.5) / 4), h / 2, rng.range(-0.1, 0.15), 0, rng.range(-0.2, 0.2)), 0.38, h, 0.32, i % 2 ? 'plaid' : 'knit', rng.pick<RGB>([[1, 1, 1], [0.8, 0.9, 0.7], [1.1, 1, 0.75]]));
      }
      break;
    }
    case 3: { // scrap electronics: a TV, radios, coiled cables
      const tx = x(rng.range(0.15, 0.3));
      tbox(b, M(top, tx, 0.22, 0, 0, rng.range(-0.3, 0.2)), 0.52, 0.44, 0.42, 'plain', [0.42, 0.4, 0.37], 'plain', 'tv');
      for (let i = 0; i < 2; i++) tbox(b, M(top, x(0.55 + i * 0.3), 0.13 + i * 0.03, rng.range(-0.05, 0.12), 0, rng.range(-0.4, 0.4)), 0.42 - i * 0.08, 0.26 + i * 0.05, 0.16, 'plain', [0.42, 0.26, 0.16], 'plain', 'radio');
      for (let i = 0; i < 2; i++) b.geo(m.rubber, cached('coil', () => new TorusGeometry(0.11, 0.022, 4, 10)), M(top, x(rng.range(0.4, 0.95)), 0.03, 0.22, Math.PI / 2, 0, 0), [1, 1, 1]);
      b.box(m.rust, M(top, x(0.9), 0.06, -0.15, 0, 0.3), 0.3, 0.12, 0.2, [0.8, 0.8, 0.8]);
      break;
    }
    case 4: { // books: standing rows and lying stacks
      tbox(b, M(top, x(0.25), 0.13, -0.05, 0, rng.range(-0.1, 0.1)), 0.7, 0.26, 0.18, 'books', [1, 1, 1], 'paper', 'books');
      for (let s = 0; s < 3; s++) {
        let y = 0;
        const n = 2 + rng.int(4);
        for (let i = 0; i < n; i++) {
          const h = rng.range(0.035, 0.06);
          tbox(b, M(top, x(0.55 + s * 0.17), y + h / 2, 0.12 - s * 0.05, 0, rng.range(-0.3, 0.3)), rng.range(0.2, 0.28), h, rng.range(0.15, 0.2), 'plain', rng.pick<RGB>([[0.5, 0.15, 0.12], [0.2, 0.3, 0.4], [0.35, 0.38, 0.2], [0.75, 0.62, 0.42], [0.3, 0.25, 0.22]]));
          y += h;
        }
      }
      break;
    }
    default: { // candles and lanterns: always glowing
      for (let i = 0; i < 9; i++) {
        const h = rng.range(0.08, 0.3), cx = x(rng.next()), cz = rng.range(-0.2, 0.2);
        b.geo(m.market, cylG('plain', 6), S(M(top, cx, h / 2, cz), 0.035, h, 0.035), rng.pick<RGB>([[1, 0.95, 0.8], [0.9, 0.3, 0.2], [1, 0.85, 0.55]]));
        b.geo(m.lampGlass, coneG(4), S(M(top, cx, h + 0.03, cz), 0.018, 0.05, 0.018));
      }
      lantern(b, M(top, x(0.1), 0, 0.1, 0, 0.4), false);
      lantern(b, M(top, x(0.85), 0, -0.1, 0, -0.3), false);
    }
  }
}

// ---------------------------------------------------------------- stalls

/** Trestle table with a plank top; height to the top surface `h`. Returns the top frame. */
function table(b: Builder, base: Matrix4, w: number, d: number, h: number, rng: Rng): Matrix4 {
  const m = b.mats;
  for (let i = 0; i < 4; i++) b.box(m.wood, M(base, 0, h - 0.025, (i - 1.5) * (d / 4), 0, rng.range(-0.01, 0.01)), w + rng.range(-0.06, 0.04), 0.05, d / 4 - 0.015, [rng.range(0.75, 0.95), 0.8, 0.72]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.box(m.darkWood, M(base, sx * (w / 2 - 0.15), (h - 0.05) / 2, sz * (d / 2 - 0.1), sz * 0.08, 0, 0), 0.06, h - 0.05, 0.06);
    b.box(m.darkWood, M(base, sx * (w / 2 - 0.15), 0.25, 0), 0.04, 0.05, d - 0.2);
  }
  return M(base, 0, h, 0);
}

function stall(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const w = rng.range(2.9, 3.2), d = rng.range(1.9, 2.1);
  const hf = rng.range(2.0, 2.45), hb = hf + rng.range(0.1, 0.45);
  const gable = rng.next() < 0.35;
  const band = rng.int(4), torn = rng.next() < 0.35;
  const postMat = rng.next() < 0.5 ? m.darkWood : m.iron;
  const roofY = (z: number): number => gable ? hf + 0.45 * (1 - Math.abs(z) / (d / 2)) : hb + (hf - hb) * (z / d + 0.5);
  // Posts, each a little off plumb.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const z = sz * (d / 2 - 0.08), h = roofY(z);
    b.box(postMat, M(base, sx * (w / 2 - 0.08), h / 2, z, rng.range(-0.03, 0.03), 0, rng.range(-0.03, 0.03)), 0.07, h, 0.07, [0.85, 0.82, 0.78]);
  }
  for (const sz of [-1, 1]) b.box(postMat, M(base, 0, roofY(sz * (d / 2 - 0.08)) - 0.04, sz * (d / 2 - 0.08)), w - 0.1, 0.05, 0.05, [0.8, 0.78, 0.75]);
  if (gable) b.box(postMat, M(base, 0, hf + 0.42, 0), w - 0.1, 0.05, 0.05, [0.8, 0.78, 0.75]);
  // Tarp: sags between the posts, overhangs at the front; a torn one droops at one corner.
  const droop = torn ? rng.pick([-1, 1]) : 0;
  const tint: RGB = shade([1, 1, 1], rng.range(0.82, 1.02));
  const W = w + 0.25, D = d + 0.3;
  sheet(b, base, 8, 6, band, torn, (u, v) => {
    const x = (u - 0.5) * W, z = (0.5 - v) * D - 0.1;
    const t = Math.max(0, Math.min(1, gable ? 2 * Math.abs(z) / d : (z + d / 2) / d));
    const sag = 0.15 * Math.sin(Math.PI * Math.max(0, Math.min(1, (x + w / 2) / w))) * Math.sin(Math.PI * t);
    const flop = droop && droop * (u - 0.5) > 0.2 && z > 0 ? (droop * (u - 0.5) - 0.2) * 2.2 * (z / (D / 2)) : 0;
    return [x, roofY(Math.max(-d / 2, Math.min(d / 2, z))) + 0.07 - sag - flop + (z > d / 2 ? -(z - d / 2) * 0.5 : 0), z];
  }, tint);
  // Front valance with a scalloped hem (just a short hanging strip).
  const fz = D / 2 - 0.1, fy = roofY(d / 2) + 0.07 - (fz - d / 2) * 0.5;
  sheet(b, base, 6, 1, band, torn && rng.next() < 0.5, (u, v) => [(u - 0.5) * W, fy - (1 - v) * (0.22 + 0.05 * Math.cos(u * Math.PI * 12)) - (droop && droop * (u - 0.5) > 0.2 ? (droop * (u - 0.5) - 0.2) * 2.2 : 0), fz + 0.01], shade(tint, 0.9));
  b.shadowBox(M(base, 0, (hf + hb) / 2, -0.1), W, 0.08, D);
  // Counter: trestle table or a wall of crates; goods on top; stock behind.
  const kind = rng.int(6);
  const tw = w - rng.range(0.3, 0.6), tz = rng.range(0.35, 0.6);
  const top = rng.next() < 0.7 ? table(b, M(base, rng.range(-0.1, 0.1), 0, tz, 0, rng.range(-0.06, 0.06)), tw, rng.range(0.7, 0.85), rng.range(0.78, 0.9), rng) : (() => {
    for (let i = 0; i < 4; i++) crate(b, M(base, (i - 1.5) * (tw / 4), 0, tz + rng.range(-0.05, 0.05), 0, rng.range(-0.15, 0.15)), 0.68, rng);
    b.box(m.wood, M(base, 0, 0.72, tz, 0, rng.range(-0.04, 0.04)), tw, 0.04, 0.72, [0.7, 0.62, 0.55]);
    return M(base, 0, 0.74, tz);
  })();
  goods(b, top, tw, rng, kind);
  if (kind === 2) {
    // Clothes rail across the back, garments of mixed length.
    const ry = Math.min(hf, hb) - 0.25;
    for (const sx of [-1, 1]) b.box(m.iron, M(base, sx * (w / 2 - 0.4), ry / 2, -d / 2 + 0.4), 0.035, ry, 0.035, [0.6, 0.6, 0.6]);
    b.box(m.iron, M(base, 0, ry, -d / 2 + 0.4), w - 0.7, 0.03, 0.03, [0.6, 0.6, 0.6]);
    const n = 4 + rng.int(3);
    for (let i = 0; i < n; i++) garment(b, M(base, (i / (n - 1) - 0.5) * (w - 1.1) + rng.range(-0.05, 0.05), ry, -d / 2 + 0.4, 0, rng.range(-0.25, 0.25)), rng);
  } else {
    for (let i = 0, n = 1 + rng.int(3); i < n; i++) {
      const bx = rng.range(-w / 2 + 0.4, w / 2 - 0.4), bz = -d / 2 + 0.35;
      if (rng.next() < 0.5) crate(b, M(base, bx, 0, bz, 0, rng.range(-0.4, 0.4)), rng.range(0.5, 0.65), rng);
      else b.box(m.burlap, M(base, bx, 0.25, bz, rng.range(-0.1, 0.1), rng.range(0, 3), rng.range(-0.1, 0.1)), 0.45, 0.5, 0.35, [0.95, 0.9, 0.85]);
    }
  }
  if (kind === 0 && rng.next() < 0.7) produceCrate(b, M(base, rng.range(-0.9, 0.9), 0, d / 2 + 0.25, 0, rng.range(-0.3, 0.3)), 0.5, rng);
  // Light: bulbs along the front beam, a hanging lantern, or nothing (candle stalls always glow).
  const light = kind === 5 ? 1 + rng.int(2) : rng.next() < 0.6 ? 1 + rng.int(2) : 0;
  const by = roofY(d / 2 - 0.08) - 0.08;
  if (light === 1) {
    const n = 5 + rng.int(3);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = (u - 0.5) * (w - 0.2), y = by - 0.12 * Math.sin(Math.PI * u);
      b.geo(m.lampGlass, ballG('plain'), S(M(base, x, y - 0.06, d / 2 - 0.08), 0.05, 0.065, 0.05));
      b.box(m.iron, M(base, x, y, d / 2 - 0.08), 0.012, 0.06, 0.012, [0.3, 0.3, 0.3]);
    }
  } else if (light === 2) lantern(b, M(base, rng.range(-0.8, 0.8), by - 0.62, d / 2 - 0.08, 0, rng.range(0, 1)), true);
}

/** Small loose goods on the ground around `base`, within `r` meters; `n` items. */
function scatter(b: Builder, base0: Matrix4, r: number, n: number, rng: Rng): void {
  const m = b.mats;
  const base = S(base0, 1.3, 1.3, 1.3); // slightly oversized so loose goods read from the game camera
  r /= 1.3;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), d = r * Math.sqrt(rng.next()), x = Math.cos(a) * d, z = Math.sin(a) * d, yaw = rng.range(0, 6.3);
    const t = rng.int(7);
    if (t === 0 || t === 1) b.geo(m.market, cylG(t ? 'jars' : 'cans', 8), S(M(base, x, 0.065, z, Math.PI / 2, yaw), 0.065, 0.15, 0.065));
    else if (t <= 3) { const [, rr, col] = PRODUCE[rng.int(3)]!; b.geo(m.market, ballG('plain'), S(M(base, x, rr * 0.8, z, rng.next(), yaw), rr, rr * 0.85, rr), shade(col, rng.range(0.8, 1))); }
    else if (t === 4) b.geo(m.market, planeG('paper'), S(M(base, x, 0.015, z, -Math.PI / 2 + rng.range(-0.08, 0.08), yaw), rng.range(0.25, 0.4), rng.range(0.3, 0.45), 1), [0.95, 0.92, 0.85]);
    else if (t === 5) b.box(m.wood, M(base, x, 0.02, z, 0, yaw, rng.range(-0.1, 0.1)), rng.range(0.4, 0.65), 0.025, 0.09, [0.85, 0.75, 0.62]);
    else tbox(b, M(base, x, 0.025, z, 0, yaw), rng.range(0.15, 0.22), 0.04, rng.range(0.12, 0.18), 'plain', rng.pick<RGB>([[0.5, 0.15, 0.12], [0.2, 0.3, 0.4], [0.75, 0.62, 0.42]]));
  }
}

function stallBroken(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const band = rng.int(4), postMat = rng.next() < 0.5 ? m.darkWood : m.iron;
  // One back post still stands (leaning), the beam hangs from it to the ground; the others lie around.
  const side = rng.pick([-1, 1]);
  const hb = rng.range(2.1, 2.5), lean = side * rng.range(0.1, 0.25);
  b.box(postMat, M(base, side * 1.45, hb / 2, -0.95, rng.range(-0.08, 0.08), 0, lean), 0.07, hb, 0.07, [0.85, 0.82, 0.78]);
  const topX = side * 1.45 - Math.sin(lean) * hb, topY = Math.cos(lean) * hb;
  const bLen = Math.hypot(topX + side * 1.4, topY);
  b.box(postMat, M(base, (topX - side * 1.4) / 2, topY / 2, -0.9, 0, 0, Math.atan2(topY, topX + side * 1.4)), bLen, 0.05, 0.05, [0.8, 0.78, 0.75]);
  for (let i = 0; i < 3; i++) b.box(postMat, M(base, rng.range(-1.2, 1.2), 0.04, rng.range(-0.6, 1.0), 0, rng.range(-0.5, 0.5) + (i ? Math.PI / 2 : 0), Math.PI / 2), 0.07, rng.range(1.6, 2.3), 0.07, [0.8, 0.78, 0.74]);
  // Torn tarp: from the standing post top down over the ground, rumpled.
  sheet(b, base, 8, 6, band, true, (u, v) => {
    const x = (u - 0.5) * 3.1, z = (0.5 - v) * 2.2;
    const up = Math.max(0, side * x / 1.55) * Math.max(0, -z / 1.1);
    const y = 0.03 + 0.08 * (Math.sin(u * 13 + v * 5) * 0.5 + 0.5) + up * up * (topY - 0.4);
    return [x, y, z];
  }, shade([1, 1, 1], rng.range(0.7, 0.9)));
  // Toppled table on its edge, legs sticking out.
  const tb = M(base, rng.range(-0.4, 0.4), 0, rng.range(0.2, 0.5), 0, rng.range(-0.4, 0.4));
  const tw = rng.range(2.0, 2.4);
  b.box(m.wood, M(tb, 0, 0.38, 0, -0.12), tw, 0.75, 0.05, [0.75, 0.68, 0.6]);
  for (const sx of [-1, 1]) b.box(m.darkWood, M(tb, sx * (tw / 2 - 0.2), 0.62, 0.38, 0, 0, 0), 0.06, 0.06, 0.75);
  b.shadowBox(M(tb, 0, 0.38, 0), tw, 0.75, 0.1);
  if (rng.next() < 0.7) buildCrate(b, M(base, rng.range(-1, 1), 0.3, -0.5, 0, rng.next(), Math.PI / 2 - 0.1), 0.55, rng);
  scatter(b, M(base, 0, 0, 0.6), 1.6, 14 + rng.int(8), rng);
}

function spill(b: Builder, p: Prop, rng: Rng): void {
  const base = at(p);
  if (rng.next() < 0.6) {
    // Broken crate: a few slats and a corner.
    const cx = rng.range(-0.4, 0.4), cz = rng.range(-0.4, 0.4), yaw = rng.range(0, 6.3);
    for (let i = 0; i < 3; i++) b.box(b.mats.wood, M(base, cx, 0.12 + i * 0.03, cz + (i - 1) * 0.16, rng.range(-0.3, 0.3), yaw, rng.range(-0.4, 0.4)), rng.range(0.4, 0.62), 0.025, 0.1, [0.85, 0.75, 0.62]);
    b.box(b.mats.wood, M(base, cx + 0.25, 0.18, cz, 0, yaw, 0.2), 0.06, 0.36, 0.06, [0.7, 0.6, 0.5]);
  }
  scatter(b, base, 0.9 * p.size, Math.round((9 + rng.int(6)) * p.size), rng);
}

// ---------------------------------------------------------------- allotments

const SHED_COLORS: RGB[] = [[0.5, 0.72, 0.46], [1, 0.98, 0.94], [0.62, 0.44, 0.3], [0.58, 0.72, 0.86]];

function gable(b: Builder, base: Matrix4, w: number, h: number, tint: RGB): void {
  const g = new BufferGeometry();
  const r = rect('planks');
  g.setAttribute('position', new BufferAttribute(new Float32Array([-w / 2, 0, 0, w / 2, 0, 0, 0, h, 0]), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([r[0], r[1], r[2], r[1], (r[0] + r[2]) / 2, r[1] + (r[3] - r[1]) * 0.35]), 2));
  b.geo(b.mats.market, g, base, tint);
}

function shed(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p, 0, 0, 0, 0, rng.range(-0.04, 0.04));
  const W = 2.3, D = 1.95, H = rng.range(1.85, 2.0), R = rng.range(0.6, 0.85);
  const col = shade(rng.pick(SHED_COLORS), rng.range(0.85, 1.02));
  const trim: RGB = rng.next() < 0.5 ? [0.95, 0.93, 0.88] : shade(col, 0.6);
  const overgrown = rng.next() < 0.4, broken = rng.next() < 0.3;
  tbox(b, M(base, 0, 0.07, 0), W + 0.12, 0.14, D + 0.12, 'plain', [0.5, 0.5, 0.48]);
  tbox(b, M(base, 0, 0.14 + H / 2, 0), W, H, D, 'planks', col);
  for (const sz of [-1, 1]) gable(b, M(base, 0, 0.14 + H, sz * D / 2, 0, sz > 0 ? 0 : Math.PI), W, R, col);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tbox(b, M(base, sx * W / 2, 0.14 + H / 2, sz * D / 2), 0.08, H, 0.08, 'plain', trim);
  // Felt gable roof (ridge along z), fascia boards, a sagging patch.
  const half = W / 2 + 0.2, ang = Math.atan2(R, W / 2), len = half / Math.cos(ang);
  for (const sx of [-1, 1]) {
    const roof = M(base, sx * half / 2, 0.14 + H + R - (half / 2) * Math.tan(ang) + 0.04, 0, 0, 0, -sx * ang);
    tbox(b, roof, len, 0.05, D + 0.4, 'felt', [1, 1, 1]);
    for (const sz of [-1, 1]) b.box(m.wood, M(roof, 0, -0.03, sz * (D / 2 + 0.2)), len, 0.12, 0.03, trim);
  }
  b.box(m.darkWood, M(base, 0, 0.14 + H + R + 0.06, 0), 0.1, 0.06, D + 0.42);
  b.shadowBox(M(base, 0, (0.14 + H + R) / 2, 0), W, 0.14 + H + R * 0.6, D);
  // Door (contrast color, sometimes ajar) and the curtained window on the front.
  const fz = D / 2 + 0.02, dx = rng.pick([-0.5, 0.5]);
  const doorCol = shade(rng.pick(SHED_COLORS), 0.75);
  const ajar = rng.next() < 0.25 ? -0.7 : 0;
  const door = M(base, dx - 0.38, 0.14, fz, 0, ajar);
  tbox(b, M(door, 0.38, 0.88, 0.02), 0.76, 1.76, 0.04, 'planks', doorCol);
  for (const y of [0.4, 1.4]) b.box(m.iron, M(door, 0.38, y, 0.05), 0.6, 0.04, 0.015, [0.5, 0.45, 0.4]);
  b.box(m.iron, M(door, 0.66, 0.95, 0.06), 0.04, 0.12, 0.03, [0.7, 0.6, 0.5]);
  if (ajar) b.box(m.dark, M(base, dx, 0.14 + 0.88, fz - 0.005), 0.74, 1.74, 0.01);
  const wx = -dx * 1.1;
  b.geo(m.market, planeG('window', broken ? 1 : 0), S(M(base, wx, 0.14 + 1.2, fz + 0.005), 0.55, 0.7, 1));
  for (const [x, y, sx, sy] of [[0, 0.36, 0.66, 0.06], [0, -0.36, 0.72, 0.07], [-0.3, 0, 0.06, 0.72], [0.3, 0, 0.06, 0.72]] as const) tbox(b, M(base, wx + x, 0.14 + 1.2 + y, fz + 0.03), sx, sy, 0.05, 'plain', trim);
  // Side window on +x, the rain barrel by a back corner.
  b.geo(m.market, planeG('window', broken && rng.next() < 0.5 ? 1 : 0), S(M(base, W / 2 + 0.005, 0.14 + 1.2, rng.range(-0.3, 0.3), 0, Math.PI / 2), 0.5, 0.6, 1));
  const bx = rng.pick([-1, 1]) * (W / 2 + 0.35), bz = -D / 2 + 0.35;
  const metal = rng.next() < 0.4;
  b.geo(metal ? m.rust : m.market, cylG('plain', 10), S(M(base, bx, 0.42, bz), 0.3, 0.84, 0.3), metal ? [0.9, 0.85, 0.8] : rng.pick<RGB>([[0.3, 0.45, 0.32], [0.3, 0.38, 0.5], [0.25, 0.25, 0.24]]));
  b.geo(m.dark, cached('disc', () => new CylinderGeometry(0.27, 0.27, 0.01, 10)), M(base, bx, 0.8, bz));
  for (const y of [0.2, 0.62]) b.geo(m.iron, cached('hoop', () => new CylinderGeometry(1, 1, 1, 10, 1, true)), S(M(base, bx, y, bz), 0.31, 0.04, 0.31), [0.6, 0.6, 0.6]);
  b.box(m.rust, M(base, bx * 0.82, 0.14 + H * 0.5, bz - 0.15), 0.06, H, 0.06, [0.7, 0.7, 0.7]);
  // Overgrown: ivy on a wall and the roof edge, ferns at the foot.
  if (overgrown) {
    const s = rng.pick([-1, 1]);
    for (let i = 0; i < 9; i++) {
      const sz = rng.range(0.6, 1.2), g = rng.range(0.6, 1);
      b.cards.of(m.ivy).add(card, S(M(base, s * (W / 2 + 0.06), rng.range(0.0, H - 0.3), rng.range(-D / 2, D / 2), rng.range(-0.3, 0.3), s * Math.PI / 2, rng.range(-0.4, 0.4)), sz, sz, 1), [g * 0.9, g, g * 0.7]);
    }
  }
  for (let i = 0; i < (overgrown ? 7 : 3); i++) {
    const sx = rng.range(-W / 2 - 0.2, W / 2 + 0.2), sz = rng.pick([-1, 1]) * (D / 2 + 0.15), s = rng.range(0.4, 0.8), g = rng.range(0.6, 1);
    for (const r of [0, Math.PI / 2]) b.cards.of(m.fern).add(card, S(M(base, sx, 0, sz, 0, r + i), s * 1.3, s, 1), [g * 0.9, g, g * 0.75]);
  }
}

function gardenBed(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p, 0, 0, 0, 0, rng.range(-0.05, 0.05));
  const Lb = rng.range(2.3, 2.6), Wb = rng.range(0.75, 0.9);
  const overgrown = rng.next() < 0.3;
  tbox(b, M(base, 0, 0.06, 0), Lb, 0.12, Wb, 'soil', [1, 1, 1]);
  for (const sz of [-1, 1]) b.box(m.wood, M(base, rng.range(-0.03, 0.03), 0.08, sz * (Wb / 2 + 0.02), rng.range(-0.04, 0.04)), Lb + 0.08, 0.16, 0.04, [0.7, 0.62, 0.52]);
  for (const sx of [-1, 1]) b.box(m.wood, M(base, sx * (Lb / 2 + 0.02), 0.08, 0), 0.04, 0.16, Wb + 0.08, [0.7, 0.62, 0.52]);
  const crop = rng.int(4);
  const plant = (x: number, z: number, r: number, col: RGB, hs = 0.7): void => b.geo(m.market, ballG('cabbage', r > 0.12 ? 1 : 0), S(M(base, x, 0.12 + r * hs * 0.6, z, 0, rng.range(0, 6.3)), r * rng.range(0.85, 1.15), r * hs, r * rng.range(0.85, 1.15)), shade(col, rng.range(0.85, 1.1)));
  if (crop === 0 || crop === 3) { // cabbage, 2 rows
    for (const z of [-0.2, 0.2]) for (let i = 0; i < 5; i++) if (rng.next() > (overgrown ? 0.35 : 0.08)) plant(((i + 0.5) / 5 - 0.5) * (Lb - 0.2) + rng.range(-0.05, 0.05), z * Wb / 0.8 + rng.range(-0.04, 0.04), 0.16, [1, 1, 1]);
  }
  if (crop === 1) { // lettuce, 3 rows of small light heads
    for (const z of [-0.25, 0, 0.25]) for (let i = 0; i < 7; i++) if (rng.next() > (overgrown ? 0.35 : 0.08)) plant(((i + 0.5) / 7 - 0.5) * (Lb - 0.2), z * Wb / 0.8, 0.1, [1.1, 1.25, 0.6], 0.55);
  }
  if (crop === 2 || crop === 3) { // beans on stick tents along the bed (in half the bed when mixed)
    const n = crop === 3 ? 3 : 5, x0 = crop === 3 ? 0.1 : -Lb / 2 + 0.2, span = crop === 3 ? Lb / 2 - 0.3 : Lb - 0.4;
    for (let i = 0; i < n; i++) {
      const x = crop === 3 ? -x0 - (i / (n - 1)) * span : x0 + (i / (n - 1)) * span;
      for (const sz of [-1, 1]) {
        const tilt = sz * 0.22;
        b.box(m.wood, M(base, x, 0.12 + 0.75, sz * 0.17, tilt, 0, rng.range(-0.05, 0.05)), 0.03, 1.55, 0.03, [1.0, 0.88, 0.68]);
        const g = rng.range(0.65, 1);
        if (rng.next() > 0.15) b.cards.of(m.ivy).add(card, S(M(base, x, 0.12, sz * 0.2, tilt, rng.range(0, 3), 0), rng.range(0.4, 0.55), rng.range(1.1, 1.5), 1), [g * 0.8, g, g * 0.6]);
      }
    }
    b.box(m.wood, M(base, crop === 3 ? -x0 - span / 2 : 0, 1.58, 0), (crop === 3 ? span : Lb - 0.4) + 0.2, 0.025, 0.025, [0.8, 0.7, 0.55]);
  }
  if (overgrown) for (let i = 0; i < 6; i++) {
    const s = rng.range(0.35, 0.7), g = rng.range(0.6, 1), x = rng.range(-Lb / 2, Lb / 2), z = rng.range(-Wb / 2, Wb / 2);
    for (const r of [0, Math.PI / 2]) b.cards.of(m.fern).add(card, S(M(base, x, 0.1, z, 0, r + i), s * 1.3, s, 1), [g * 0.9, g, g * 0.75]);
  }
}

/** Garden gnome, about 0.45 m, origin at its feet; `head` false leaves a broken neck. */
function gnomeBody(b: Builder, base: Matrix4, rng: Rng, head: boolean): void {
  const mk = b.mats.market;
  const coat = rng.pick<RGB>([[0.25, 0.4, 0.7], [0.3, 0.55, 0.3], [0.65, 0.5, 0.25]]);
  for (const sx of [-1, 1]) tbox(b, M(base, sx * 0.045, 0.025, 0.015), 0.07, 0.05, 0.1, 'plain', [0.2, 0.14, 0.1]);
  b.geo(mk, cylG('plain', 8), S(M(base, 0, 0.13, 0), 0.1, 0.16, 0.09), coat);
  b.geo(mk, cylG('plain', 8), S(M(base, 0, 0.13, 0), 0.105, 0.025, 0.095), [0.2, 0.14, 0.1]);
  for (const sx of [-1, 1]) b.geo(mk, cylG('plain', 6), S(M(base, sx * 0.1, 0.17, 0.02, 0.4, 0, sx * 0.35), 0.03, 0.12, 0.03), coat);
  if (!head) { b.geo(mk, ballG('plain'), S(M(base, 0, 0.215, 0), 0.07, 0.03, 0.06), [0.85, 0.82, 0.78]); return; }
  gnomeHead(b, M(base, 0, 0.2, 0), rng);
}
function gnomeHead(b: Builder, base: Matrix4, rng: Rng): void {
  const mk = b.mats.market;
  b.geo(mk, coneG(8), S(M(base, 0, 0.0, 0.055, Math.PI, 0, 0), 0.075, 0.14, 0.05), [1.1, 1.1, 1.08]);
  b.geo(mk, ballG('plain'), S(M(base, 0, 0.07, 0), 0.07, 0.07, 0.065), [0.98, 0.72, 0.58]);
  b.geo(mk, ballG('plain'), S(M(base, 0, 0.065, 0.065), 0.022, 0.022, 0.022), [1.05, 0.55, 0.45]);
  b.geo(mk, coneG(8), S(M(base, 0, 0.21, -0.01, -0.15 + rng.range(-0.1, 0.1), 0, rng.range(-0.2, 0.2)), 0.085, 0.24, 0.085), [0.85, 0.12, 0.08]);
}

function gnome(b: Builder, p: Prop, rng: Rng): void {
  const base = at(p, 0, 0, 0, 0, rng.range(-0.6, 0.6));
  const pose = rng.int(4);
  if (pose === 0) gnomeBody(b, M(base, 0, 0, 0, rng.range(-0.06, 0.06), 0, rng.range(-0.06, 0.06)), rng, true);
  else if (pose === 1) gnomeBody(b, M(base, 0, 0.1, 0, 0, 0, Math.PI / 2), rng, true);
  else {
    gnomeBody(b, M(base, 0, 0, 0, rng.range(-0.08, 0.08)), rng, false);
    if (pose === 2) gnomeHead(b, M(base, rng.range(0.2, 0.3), 0.07, rng.range(0.05, 0.2), 0, rng.range(0, 6), Math.PI / 2 + 0.2), rng);
    for (let i = 0; i < 3; i++) b.geo(b.mats.market, ballG('plain'), S(M(base, rng.range(-0.25, 0.25), 0.01, rng.range(-0.2, 0.25), rng.next(), rng.next()), 0.03, 0.012, 0.025), [0.85, 0.12, 0.08]);
  }
}

/** Wooden jetty from the shore along +z: deck at 0.3, posts into the lake bed, some planks missing. */
function jetty(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const len = 4.5 * p.size, W = 1.4;
  for (const sx of [-1, 1]) b.box(m.darkWood, M(base, sx * 0.55, 0.2, len / 2), 0.12, 0.14, len, [0.7, 0.65, 0.6]);
  const posts = Math.max(2, Math.round(len / 1.5));
  for (let i = 0; i <= posts; i++) for (const sx of [-1, 1]) {
    const z = (i / posts) * (len - 0.15) + 0.07, top = i === posts || i === 0 ? 0.55 + rng.range(0, 0.15) : 0.25;
    b.geo(m.darkWood, cylG('plain', 6), S(M(base, sx * 0.66, (top - 1.6) / 2, z, rng.range(-0.03, 0.03), 0, rng.range(-0.03, 0.03)), 0.09, top + 1.6, 0.09), [0.45, 0.4, 0.36]);
  }
  // Slime and wet line on the posts at the water surface.
  for (const sx of [-1, 1]) b.box(m.darkWood, M(base, sx * 0.66, -0.5, len / 2), 0.2, 0.12, len - 0.1, [0.25, 0.3, 0.2]);
  const step = 0.2;
  for (let z = 0.1; z < len - 0.05; z += step) {
    const r = rng.next();
    if (r < 0.07 && z > 0.6) continue;
    const loose = r > 0.93;
    b.box(m.wood, M(base, rng.range(-0.03, 0.03) + (loose ? rng.range(-0.15, 0.15) : 0), 0.3 + (loose ? 0.03 : 0), z, 0, rng.range(-0.02, 0.02) + (loose ? rng.range(-0.15, 0.15) : 0), loose ? rng.range(-0.06, 0.06) : 0), W - rng.range(0, 0.12), 0.05, step - 0.025, [rng.range(0.6, 0.85), rng.range(0.58, 0.75), rng.range(0.52, 0.65)]);
  }
  if (rng.next() < 0.5) b.box(m.iron, M(base, 0.55 * rng.pick([-1, 1]), 0.4, len - 0.3), 0.12, 0.12, 0.2, [0.5, 0.5, 0.5]);
}

/** Low garden fence along local x: Jägerzaun criss-cross or plain pickets, light and slightly leaning. */
function picket(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p, 0, 0, 0, rng.range(-0.05, 0.05));
  const len = p.size, H = rng.range(0.8, 0.95);
  const tint: RGB = rng.pick<RGB>([[0.85, 0.75, 0.6], [0.65, 0.5, 0.38], [1, 0.98, 0.9]]);
  const posts = Math.max(1, Math.round(len / 1.25));
  for (let i = 0; i <= posts; i++) b.box(m.darkWood, M(base, (i / posts - 0.5) * len, (H + 0.1) / 2, 0, rng.range(-0.04, 0.04), 0, rng.range(-0.04, 0.04)), 0.06, H + 0.1, 0.06, [0.75, 0.7, 0.65]);
  if (rng.next() < 0.55) {
    // Jägerzaun: two layers of diagonal laths crossing, clipped to the fence height.
    const sp = 0.32, run = H * 0.85, y0 = 0.08;
    for (let x = -len / 2 - run; x < len / 2; x += sp) for (const dir of [1, -1]) {
      if (rng.next() < 0.07) continue;
      const xa = Math.max(-len / 2, x), xb = Math.min(len / 2, x + run);
      if (xb - xa < 0.08) continue;
      const fa = (xa - x) / run, fb = (xb - x) / run;
      const [ya, yb] = dir > 0 ? [y0 + fa * run, y0 + fb * run] : [y0 + run - fa * run, y0 + run - fb * run];
      const l = Math.hypot(xb - xa, yb - ya);
      b.box(m.wood, M(base, (xa + xb) / 2, (ya + yb) / 2, dir * 0.02, 0, 0, Math.atan2(yb - ya, xb - xa)), l, 0.055, 0.015, shade(tint, rng.range(0.85, 1.05)));
    }
    b.box(m.wood, M(base, 0, y0 + run + 0.03, 0), len, 0.04, 0.03, tint);
  } else {
    for (const y of [0.25, H - 0.2]) b.box(m.wood, M(base, 0, y, -0.03), len, 0.06, 0.025, shade(tint, 0.85));
    for (let x = -len / 2 + 0.08; x < len / 2; x += 0.14) {
      if (rng.next() < 0.1) continue;
      const h = H - rng.range(0, 0.06), lean = rng.next() < 0.08 ? rng.range(-0.3, 0.3) : rng.range(-0.02, 0.02);
      b.box(m.wood, M(base, x, h / 2, 0.0, 0, 0, lean), 0.07, h, 0.018, shade(tint, rng.range(0.85, 1.05)));
    }
  }
}

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildMarketProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind as MarketPropKind) {
    case 'stall': stall(b, p, rng); break;
    case 'stallBroken': stallBroken(b, p, rng); break;
    case 'spill': spill(b, p, rng); break;
    case 'shed': shed(b, p, rng); break;
    case 'gardenBed': gardenBed(b, p, rng); break;
    case 'gnome': gnome(b, p, rng); break;
    case 'jetty': jetty(b, p, rng); break;
    case 'picket': picket(b, p, rng); break;
  }
  return true;
}
