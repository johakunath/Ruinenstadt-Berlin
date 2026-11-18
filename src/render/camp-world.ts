// M20: the static set of the walkable camp at S+U Warschauer Straße (`src/data/camp-map.ts`,
// mockup `docs/mockups/m20-camp-combined.svg`). Inside: a tiled platform hall with green iron
// columns, the yellow train, the old toilets and the station bakery; a shadow-only ceiling keeps the
// moon out, so lamps carry the hall. Outside: the open track yard (+3 m) in the cutting under the
// Warschauer Brücke, brick arches, graffiti on the retaining wall, house fronts above it.
// Stations themselves change with their level and live in `camp-stations.ts`.
// Cost: merged boxes per material and chunk (the camp is two chunks wide), five painted textures,
// a fixed number of light spots for the shared pool; no new lights at runtime.
import { CylinderGeometry, Matrix4, Vector3, type Material } from 'three';
import { CAMP_LAYOUT, YARD_H } from '../data/camp-map';
import type { MapDef } from '../data/map';
import { Rng } from '../sim/math';
import type { Materials, LitMaterial } from './materials';
import type { ChunkBuilder, MapMats } from './map-world';
import { canvas, flatten, mottle, paintLettering, shade, strokes, toTexture, type PaintOptions } from './paint';
type RGB = readonly [number, number, number];

export interface CampMats {
  wallTile: LitMaterial;
  creamTile: LitMaterial;
  floorTile: LitMaterial;
  whiteTile: LitMaterial;
  checker: LitMaterial;
  ballast: LitMaterial;
  nameplate: LitMaterial;
  exitSign: LitMaterial;
  trainSide: LitMaterial;
}

// ---------------------------------------------------------------- textures (code-painted placeholders)

/** Rectangular glazed tiles with grout, grime toward the floor, a few missing. `rows` × `cols` per texture. */
function paintTiles(o: PaintOptions, base: string, cols: number, rows: number, seed: number, grout = '#2c2a26', band?: { row: number; color: string }, gaps = 0.008): HTMLCanvasElement {
  const S = 512;
  const rng = new Rng(seed);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, S, S);
  const tw = S / cols, th = S / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const off = rows > cols ? (r % 2) * tw * 0.5 : 0;
      const x = k * tw + off, y = r * th;
      const missing = rng.next() < gaps;
      const col = band && r === band.row ? band.color : base;
      ctx.fillStyle = missing ? '#1c1916' : shade(col, rng.range(-0.12, 0.08));
      for (const ox of x + tw > S ? [0, -S] : [0]) {
        ctx.fillRect(x + ox + 2, y + 2, tw - 4, th - 4);
        if (!missing) {
          // Glaze: a light top edge, a dark lower edge.
          ctx.fillStyle = 'rgba(255,250,230,0.16)';
          ctx.fillRect(x + ox + 2, y + 2, tw - 4, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x + ox + 2, y + th - 5, tw - 4, 2);
          ctx.fillStyle = shade(col, rng.range(-0.12, 0.08));
        }
      }
    }
  }
  mottle(ctx, rng, S, S, 26, ['#3a2a1a', '#20201a', '#5a4a30'], [20, 90], 0.12);
  strokes(ctx, rng, S, S, { count: 500, colors: ['#2a2018', shade(base, 0.2)], len: [4, 22], width: [1, 3], alpha: [0.05, 0.16] });
  flatten(ctx, S, S, o.flatten * 0.5);
  return c;
}

function paintBallast(o: PaintOptions): HTMLCanvasElement {
  const S = 512;
  const rng = new Rng(808);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#2b2824';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = rng.pick(['#3a3631', '#4a443c', '#24211d', '#56504a', '#3d3426']);
    const r = rng.range(2, 6);
    ctx.beginPath();
    ctx.ellipse(rng.range(0, S), rng.range(0, S), r, r * rng.range(0.6, 1), rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  mottle(ctx, rng, S, S, 20, ['#5a3a20', '#1a1714'], [30, 110], 0.15);
  flatten(ctx, S, S, o.flatten * 0.5);
  return c;
}

/** Side of a BVG car: yellow body, a dark window band, doors, the Berlin bear on the middle panel. */
function paintTrainSide(): { map: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const W = 1024, H = 256;
  const rng = new Rng(77);
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = '#e3a224';
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  // Windows and doors.
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 162;
    const door = i % 2 === 1;
    ctx.fillStyle = '#1a1612';
    ctx.fillRect(x, door ? 46 : 60, door ? 70 : 120, door ? 190 : 80);
    // A few windows still glow from lanterns inside.
    if (!door && rng.next() < 0.5) {
      ectx.fillStyle = 'rgba(255,170,90,0.7)';
      ectx.fillRect(x + 6, 66, 108, 68);
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(x + 6, 66, 108, 68);
    }
  }
  // Bear on a white roundel between the second and third window.
  ctx.fillStyle = '#efe6d0';
  ctx.beginPath(); ctx.arc(512, 200, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1612';
  ctx.beginPath(); ctx.ellipse(512, 204, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(504, 186, 4, 0, Math.PI * 2); ctx.arc(520, 186, 4, 0, Math.PI * 2); ctx.fill();
  // Rust, soot and peeling paint.
  mottle(ctx, rng, W, H, 60, ['#8a4a20', '#3a2a1a', '#c08030'], [10, 60], 0.3);
  strokes(ctx, rng, W, H, { count: 900, colors: ['#5a3a1a', '#f0c060'], len: [4, 30], width: [1, 4], alpha: [0.08, 0.25] });
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(0, 238, W, 18);
  return { map: c, glow: e };
}

export function makeCampMats(materials: Materials, o: PaintOptions): CampMats {
  const tex = (c: HTMLCanvasElement): ReturnType<typeof toTexture> => toTexture(c, true, o.anisotropy);
  const plate = paintLettering('Warschauer Straße', '#f2efe4', '#1d2a4a', 0.12);
  const exit = paintLettering('Ausgang · Warschauer Brücke', '#1d3a8a', '#ffffff', 0.55);
  const train = paintTrainSide();
  return {
    wallTile: materials.surface({ map: tex(paintTiles(o, '#647872', 4, 8, 11)), roughness: 0.35, vertexColors: true }),
    creamTile: materials.surface({ map: tex(paintTiles(o, '#d9c9a0', 4, 8, 12, '#3a3428')), roughness: 0.35, vertexColors: true }),
    floorTile: materials.surface({ map: tex(paintTiles(o, '#6a6860', 6, 6, 13, '#2a2824')), roughness: 0.55, vertexColors: true }),
    whiteTile: materials.surface({ map: tex(paintTiles(o, '#d8d4c6', 10, 10, 14, '#8a867a', undefined, 0.002)), roughness: 0.3, vertexColors: true }),
    checker: materials.surface({ map: tex((() => { const c = paintTiles(o, '#cbbfa8', 8, 8, 15, '#3a2a20', undefined, 0.002); const ctx = c.getContext('2d')!; ctx.globalAlpha = 0.85; ctx.fillStyle = '#7a3a2a'; for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) if ((r + k) % 2) ctx.fillRect(k * 64 + 2, r * 64 + 2, 60, 60); ctx.globalAlpha = 1; return c; })()), roughness: 0.4, vertexColors: true }),
    ballast: materials.surface({ map: tex(paintBallast(o)), roughness: 0.95, vertexColors: true }),
    nameplate: materials.surface({ map: plate.map, emissiveMap: plate.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.4 }),
    exitSign: materials.surface({ map: exit.map, emissiveMap: exit.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.4 }),
    trainSide: materials.surface({ map: toTexture(train.map, false), emissiveMap: toTexture(train.glow, false), emissive: 0xffb060, emissiveIntensity: 0.9, roughness: 0.55 }),
  };
}

// ---------------------------------------------------------------- set

const M = (x: number, y: number, z: number, ry = 0): Matrix4 => new Matrix4().makeRotationY(ry).setPosition(x, y, z);

export function buildCampWorld(m: MapDef, mats: MapMats, cm: CampMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const c = m.camp ?? CAMP_LAYOUT;
  const rng = new Rng(m.seed);
  const at = (x: number, z: number): ChunkBuilder => chunkOf(x, z);
  const box = (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB, uv = 0.5, ry = 0): void =>
    at(x, z).box(mat, M(x, y, z, ry), sx, sy, sz, color, uv);
  /** A tiled wall: teal dado, yellow band, cream tiles above, dark top. Runs along x (`alongX`) or z. */
  const tiledWall = (x: number, z: number, len: number, thick: number, h: number, alongX: boolean): void => {
    const [sx, sz] = alongX ? [len, thick] : [thick, len];
    const dado = Math.min(h, 2.1);
    box(cm.wallTile, x, dado / 2, z, sx, dado, sz, undefined, 0.5);
    if (h > 2.1) {
      box(mats.concrete, x, 2.2, z, sx + 0.02, 0.2, sz + 0.02, [0.95, 0.62, 0.15]);
      box(cm.creamTile, x, 2.3 + (h - 2.3) / 2, z, sx, h - 2.3, sz, undefined, 0.5);
    }
    box(mats.concrete, x, h + 0.04, z, sx + 0.06, 0.08, sz + 0.06, [0.1, 0.1, 0.1]);
    at(x, z).shadowBox(M(x, h / 2, z), sx, h, sz);
  };

  // --- hall floor, platform edge, track bed
  box(cm.floorTile, 17.25, 0.02, 23.2, 33.5, 0.06, 14.6, [0.95, 0.93, 0.9], 1 / 2.4);
  box(mats.concrete, 17.25, 0.08, 16.05, 33.5, 0.16, 0.5, [0.95, 0.66, 0.16]);
  for (let x = 1; x < 34; x += 0.9) box(mats.concrete, x, 0.165, 16.05, 0.32, 0.01, 0.5, [0.12, 0.1, 0.08]);
  box(cm.ballast, 16, 0.015, 10.6, 36, 0.03, 9.4, [0.9, 0.9, 0.9], 1 / 3);
  const trackZ = c.train.z;
  for (let x = -6; x < 34; x += 0.7) box(mats.trunk, x, 0.05, trackZ, 0.22, 0.07, 2.5, [0.55, 0.45, 0.38]);
  for (const r of [-0.72, 0.72]) box(mats.railSteel, 14, 0.12, trackZ + r, 40, 0.14, 0.08, [0.7, 0.68, 0.64]);

  // --- the train: two yellow BVG cars on the hall track (the departure), doors open toward the platform
  const T = c.train, carLen = T.len / 2 - 0.3;
  for (const k of [0, 1]) {
    const cx = T.x - T.len / 4 + k * (T.len / 2), b = at(cx, T.z);
    b.solid.captureOccluder(() => {
      b.box(cm.trainSide, M(cx, 1.95, T.z), carLen, 2.5, 2.6, undefined, 1);
      b.box(mats.concrete, M(cx, 3.32, T.z), carLen - 0.1, 0.24, 2.4, [0.55, 0.5, 0.42]);
      b.box(mats.iron, M(cx, 0.5, T.z), carLen - 1, 0.5, 2.2, [0.12, 0.11, 0.1]);
      for (const e of [-1, 1]) b.box(mats.iron, M(cx + e * (carLen / 2 - 1.6), 0.38, T.z), 2.2, 0.5, 2.4, [0.18, 0.16, 0.14]);
    });
    b.shadowBox(M(cx, 1.8, T.z), carLen, 3.4, 2.6);
  }
  // Coupling and the dark cab windows at both ends.
  box(mats.iron, T.x, 1.2, T.z, 0.8, 0.3, 0.4, [0.2, 0.2, 0.2]);
  for (const e of [-1, 1]) box(mats.dark, T.x + e * (T.len / 2 - 0.25), 2.4, T.z, 0.06, 0.9, 2);

  // --- hall walls
  tiledWall(17, 5.5, 34, 1, 5.4, true);
  tiledWall(0, 23.1, 14.6, 1, 5.4, false);
  tiledWall(34.2, 11, 1.2, 16, 5.4, false);
  tiledWall(33.9, 29.7, 0.6, 1.4, 5.4, false);
  // Tunnel mouth west of the hall: a lintel over the track, darkness beyond.
  box(cm.creamTile, -0.1, 4.8, 10.8, 1.2, 1.2, 9.6, [0.8, 0.8, 0.8]);
  box(mats.dark, -2.5, 2.4, 10.8, 3.6, 4.8, 9.6);
  // Station name plates, a clock and an S roundel on the back wall above the train.
  for (const x of [4, 17, 30]) {
    box(mats.iron, x, 3.35, 6.05, 4.4, 0.75, 0.06, [0.25, 0.25, 0.28]);
    at(x, 6).box(cm.nameplate, M(x, 3.35, 6.1), 4.2, 0.6, 0.04, undefined, 1 / 4.2);
  }
  at(10.5, 6).box(mats.clock, M(10.5, 4.3, 6.08), 0.9, 0.9, 0.05, undefined, 1 / 0.9);
  at(23.5, 6).box(mats.sRoundel, M(23.5, 4.3, 6.08), 0.9, 0.9, 0.05, undefined, 1 / 0.9);

  // --- partition and room walls (from the layout: their colliders are in the sim)
  for (const w of c.walls) {
    if (w.kind === 'column') {
      // Green riveted iron column with a capital and a foot; the yellow band marks the camp station (2D).
      const b = at(w.x, w.z);
      b.box(mats.iron, M(w.x, 2.7, w.z), 0.42, 5.4, 0.42, [0.24, 0.42, 0.29]);
      b.box(mats.iron, M(w.x, 0.15, w.z), 0.62, 0.3, 0.62, [0.17, 0.29, 0.2]);
      b.box(mats.iron, M(w.x, 5.15, w.z), 0.8, 0.3, 0.8, [0.17, 0.29, 0.2]);
      b.box(mats.iron, M(w.x, 4.85, w.z), 0.6, 0.3, 0.6, [0.2, 0.36, 0.25]);
      b.box(mats.concrete, M(w.x, 1.6, w.z), 0.45, 0.3, 0.45, [0.95, 0.62, 0.15]);
      for (const y of [1, 2.2, 3.4, 4.4]) for (const s of [-1, 1]) b.box(mats.iron, M(w.x + s * 0.22, y, w.z), 0.03, 0.05, 0.3, [0.3, 0.5, 0.35]);
      b.shadowBox(M(w.x, 2.7, w.z), 0.42, 5.4, 0.42);
      continue;
    }
    if (w.kind === 'tile' && w.z > 6 && w.x > 1 && w.x < 34) { tiledWall(w.x, w.z, 2 * w.hz, 2 * w.hx, w.h, false); continue; }
    if (w.kind === 'tile') continue;
    const alongX = w.hx > w.hz;
    const [sx, sz] = [2 * w.hx, 2 * w.hz];
    if (w.kind === 'low') {
      tiledWall(w.x, w.z, alongX ? sx : sz, alongX ? sz : sx, 1.2, alongX);
    } else {
      // Bakery shop window: a low tiled base, a frame and dusty glass panes up to 2.4 m.
      box(cm.wallTile, w.x, 0.4, w.z, sx, 0.8, sz);
      box(mats.glass, w.x, 1.6, w.z, sx - 0.2, 1.6, 0.05);
      for (let k = 0; k <= 4; k++) box(mats.iron, w.x - sx / 2 + (k * sx) / 4, 1.6, w.z, 0.08, 1.6, 0.12, [0.2, 0.2, 0.2]);
      box(mats.iron, w.x, 2.42, w.z, sx, 0.1, 0.14, [0.2, 0.2, 0.2]);
    }
  }
  // Room floors: white tiles in the old toilets, the bakery's checker.
  box(cm.whiteTile, 7.5, 0.025, 36.75, 13, 0.05, 12.5, [0.95, 0.95, 0.92], 1 / 1.5);
  box(cm.checker, 21, 0.025, 35.75, 12, 0.05, 10.5, [0.95, 0.95, 0.92], 1 / 2);
  // Outer room walls: the west wall is tall (side), the walls toward the camera stay knee high and broken (2D cutaway).
  tiledWall(0.6, 36.75, 12.5, 0.5, 2.8, false);
  for (const [x0, x1, z] of [[1, 14.3, 43.3], [14.7, 27.3, 41.3]] as const) {
    for (let x = x0; x < x1; x += 1) box(cm.whiteTile, x + 0.5, 0.35 + rng.range(-0.15, 0.25), z, 1, 0.7 + rng.range(-0.3, 0.5), 0.3, [0.8, 0.78, 0.74]);
  }
  // The closed kiosk east of the bakery: shutter down, a faded sign.
  box(mats.corrugated, 30.9, 1.4, 31.2, 6.4, 2.8, 0.15, [0.55, 0.5, 0.42], 1 / 2);
  box(mats.dark, 30.9, 1.4, 37, 6.4, 2.8, 11.5);
  box(mats.concrete, 27.4, 1.4, 36, 0.3, 2.8, 10, [0.4, 0.4, 0.38]);

  // Ceiling: shadow only (never drawn, the camera looks in from above), so the moon stays out of the hall.
  at(17, 24).shadowBox(M(17, 5.8, 24), 36, 0.3, 40);

  // --- concrete masses beside the stairs; their tops continue the yard
  for (const [z0, z1] of [[-8, 18.8], [29.2, 52]] as const) {
    const z = (z0 + z1) / 2, d = z1 - z0;
    box(mats.concrete, 39.2, YARD_H / 2, z, 9.4, YARD_H, d, [0.42, 0.4, 0.38]);
    box(cm.ballast, 39.2, YARD_H + 0.02, z, 9.4, 0.04, d, [0.75, 0.75, 0.75], 1 / 3);
    at(39.2, z).shadowBox(M(39.2, YARD_H / 2, z), 9.4, YARD_H, d);
  }
  // Stair cheeks with a handrail, the exit sign over the bottom step.
  for (const z of [18.75, 29.25]) {
    for (let k = 0; k < 10; k++) {
      const x = 34 + k + 0.5, top = (YARD_H * (k + 1)) / 10 + 0.9;
      box(cm.wallTile, x, top / 2, z, 1.02, top, 0.3);
    }
    const rail = new Matrix4().makeRotationZ(Math.atan2(YARD_H, 10)).setPosition(38.5, YARD_H / 2 + 1.05, z);
    at(38.5, z).box(mats.iron, rail, 10.4, 0.06, 0.06, [0.6, 0.6, 0.6]);
  }
  box(mats.iron, 34.6, 3.6, 24, 0.08, 0.7, 6.4, [0.2, 0.2, 0.25]);
  at(34.7, 24).box(cm.exitSign, M(34.7, 3.6, 24, Math.PI / 2), 6.2, 0.55, 0.04, undefined, 1 / 6.2);

  // --- the yard: cutting wall in the north with buttresses and graffiti, houses above, a parapet toward the camera
  for (let x = 43.5; x < 80; x += 6) {
    const w = Math.min(6, 80 - x);
    box(mats.brick, x + w / 2, YARD_H + 3, 1.6, w, 6, 3.2, [0.7, 0.62, 0.58], 0.35);
    box(mats.concrete, x + 0.4, YARD_H + 3, 3.3, 0.8, 6, 0.6, [0.5, 0.48, 0.45]);
    at(x + w / 2, 1.6).shadowBox(M(x + w / 2, YARD_H + 3, 1.6), w, 6, 3.2);
    if (rng.next() < 0.75) box(mats.graffiti, x + w / 2 + 0.4, YARD_H + 1.6, 3.22, w - 1.6, 2.2, 0.02, [1, 1, 1], 1 / 4);
  }
  // Iron fence on the wall top and house fronts beyond (skyline above the cutting).
  for (let x = 44; x < 80; x += 1.5) box(mats.iron, x, YARD_H + 6.6, 0.4, 0.05, 1.2, 0.05, [0.3, 0.3, 0.3]);
  box(mats.iron, 62, YARD_H + 7.15, 0.4, 36, 0.06, 0.06, [0.3, 0.3, 0.3]);
  let hx = 40;
  while (hx < 84) {
    const w = rng.range(9, 15), h = rng.range(12, 19);
    const tone = rng.pick(['cream', 'ochre', 'oxblood'] as const);
    box(mats.plaster[tone] ?? mats.stucco, hx + w / 2, h / 2, -6, w, h, 8, [0.42, 0.4, 0.38]);
    // Lit windows here and there (about one in ten).
    for (let fy = 6; fy < h - 1.5; fy += 3) for (let fx = hx + 1.5; fx < hx + w - 1; fx += 2.4) {
      const lit = rng.next() < 0.1;
      box(lit ? mats.lampGlass : mats.dark, fx, fy, -1.98, 1, 1.5, 0.04, lit ? [1.4, 1, 0.5] : undefined);
    }
    hx += w + rng.range(0, 1.5);
  }
  for (let x = 43.5; x < 66; x += 1.2) box(mats.concrete, x + 0.6, YARD_H + 0.45, 47.2, 1.2, 0.9 + (rng.next() < 0.2 ? -0.4 : 0), 0.5, [0.45, 0.43, 0.4]);
  // Yard floor: ballast and trodden earth instead of the map ground.
  box(cm.ballast, 54.75, YARD_H + 0.012, 25.5, 22.5, 0.02, 43, [0.72, 0.68, 0.62], 1 / 4);
  box(cm.ballast, 68.3, YARD_H + 0.012, 22, 5.6, 0.02, 10, [0.6, 0.58, 0.55], 1 / 4);
  // Old S-Bahn tracks across the yard: the freight car stands on the northern one.
  for (const [z, x1] of [[8.5, 76], [16.5, 66]] as const) {
    box(cm.ballast, (43.5 + x1) / 2, YARD_H + 0.03, z, x1 - 43.5, 0.05, 3.2, [0.85, 0.85, 0.85], 1 / 3);
    for (let x = 44; x < x1; x += 0.7) box(mats.trunk, x, YARD_H + 0.07, z, 0.22, 0.06, 2.5, [0.5, 0.42, 0.36]);
    for (const r of [-0.72, 0.72]) box(mats.railSteel, (43.5 + x1) / 2, YARD_H + 0.14, z + r, x1 - 43.5, 0.12, 0.08, [0.55, 0.45, 0.38]);
  }

  // --- Warschauer Brücke: brick arches on the east, the deck overhead with railings and lamps
  const B = c.bridge, bx = (B.x0 + B.x1) / 2, top = YARD_H + B.h;
  const arches: Array<[number, number]> = [[5, 14.5], [16.5, 27.5], [30, 40]];
  const piers: Array<[number, number]> = [[-12, 5], [14.5, 16.5], [27.5, 30], [40, 56]];
  for (const [z0, z1] of piers) {
    const z = (z0 + z1) / 2;
    box(mats.brick, bx + 0.5, YARD_H + (B.h - 1) / 2, z, B.x1 - B.x0 - 1, B.h - 1, z1 - z0, [0.62, 0.5, 0.44], 0.35);
    at(bx, z).shadowBox(M(bx + 0.5, YARD_H + (B.h - 1) / 2, z), B.x1 - B.x0 - 1, B.h - 1, z1 - z0);
  }
  for (const [z0, z1] of arches) {
    const z = (z0 + z1) / 2, span = z1 - z0;
    // A segmental arch in three steps; the back of the arch is dark (except the Hackerspace one).
    for (const [y, f] of [[B.h - 1.6, 1], [B.h - 2.3, 0.75], [B.h - 2.8, 0.42]] as const) {
      for (const s of [-1, 1]) box(mats.brick, bx + 0.5, YARD_H + y + (B.h - 1 - y) / 2, z + s * (span / 2 - (span * (1 - f)) / 4), B.x1 - B.x0 - 1, B.h - 1 - y, (span * (1 - f)) / 2 + 0.01, [0.6, 0.48, 0.42], 0.35);
    }
    box(mats.brick, bx + 0.5, YARD_H + B.h - 1.3, z, B.x1 - B.x0 - 1, 0.6, span, [0.6, 0.48, 0.42], 0.35);
    if (z0 !== 16.5) box(mats.dark, 72.5, YARD_H + (B.h - 1.6) / 2, z, 7, B.h - 1.6, span - 0.2);
    else box(mats.brick, 74.5, YARD_H + (B.h - 1.6) / 2, z, 3, B.h - 1.6, span, [0.36, 0.3, 0.27], 0.35);
  }
  // Deck: slab, steel girders on its face, railings and two working lamps.
  const deck = at(bx, 24);
  deck.solid.captureOccluder(() => {
    for (let z = -16; z < 60; z += 12) {
      deck.box(mats.concrete, M(bx, top + 0.6, z + 6), B.x1 - B.x0 + 2, 1.2, 12, [0.5, 0.48, 0.46]);
      deck.box(mats.iron, M(B.x0 - 0.9, top + 0.3, z + 6), 0.3, 1.2, 12, [0.32, 0.36, 0.34]);
    }
  });
  for (let z = -14; z < 58; z += 1.6) box(mats.iron, B.x0 - 0.8, top + 1.7, z, 0.05, 1, 0.05, [0.3, 0.3, 0.3]);
  box(mats.iron, B.x0 - 0.8, top + 2.2, 22, 0.06, 0.06, 72, [0.3, 0.3, 0.3]);
  for (const z of [10, 36]) {
    const b = at(B.x0, z);
    b.geo(mats.iron, new CylinderGeometry(0.06, 0.09, 4.2, 6), M(B.x0 - 0.5, top + 3.3, z), [0.3, 0.3, 0.3]);
    b.box(mats.lampGlass, M(B.x0 - 0.9, top + 5.3, z), 0.5, 0.18, 0.3, [1.6, 1.2, 0.5]);
    b.light(new Vector3(B.x0 - 1.4, top + 4.8, z), 0xffb060, 30, 16, 0.02, 6, { halo: 0.5 });
  }

  // --- fixed light spots for the stations (the pool picks the nearest; their glow decals carry the rest)
  const COLOR: Record<string, number> = { zeug: 0xff8a3c, hack: 0x5fd8c8, laz: 0xd8ecff, imbiss: 0xffb060, kom: 0xffb060, markt: 0xffc890, exer: 0xff8a3c };
  for (const s of c.stations) {
    const y0 = s.inside ? 0 : YARD_H;
    const fx = s.x + Math.sin(s.rot) * (s.d / 2 + 1.2), fz = s.z + Math.cos(s.rot) * (s.d / 2 + 1.2);
    at(fx, fz).light(new Vector3(fx, y0 + 2.6, fz), COLOR[s.id] ?? 0xffb060, s.inside ? 20 : 26, 10, s.id === 'zeug' || s.id === 'exer' ? 0.6 : 0.03, 4.5, { halo: 0.3 });
  }
  // Hall lamps hanging at the columns.
  for (const w of c.walls) if (w.kind === 'column') at(w.x, w.z).light(new Vector3(w.x, 4.3, w.z + 0.6), 0xffb060, 18, 11, 0.02, 5, { halo: 0.35 });
}
