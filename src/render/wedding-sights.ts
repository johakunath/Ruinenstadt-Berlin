// M18 Wedding step 3: the six sights from photos, built worn (`docs/tasks/m18-wedding.md`, `docs/maps/landmarks.md`).
// Photos looked at on 2026-11-23 (Wikimedia Commons, scratchpad only); what they showed against the map doc's memory:
//   Alte Nazarethkirche: a Schinkel brick hall without a tower (the spire behind it is the Neue Nazarethkirche): low
//     pediment, rose window, three round-arched portals over a stair, small arched windows, a teal name board.
//   Amtsgericht Wedding: neo-Gothic, but pale plaster with sandstone, red tile roofs and green copper turrets; a tall
//     central gable with pinnacles over a pointed portal and tracery window, gabled end pavilions, small dormers.
//   Flakturm Humboldthain: only the north face stands free; two octagonal gun towers joined by a wall, railings on the
//     platforms, graffiti, trees growing up to it, the rest under the rubble hill.
//   Beamtentor: red brick; one pointed arch under a stepped gable with the gold capitals „Allgemeine Elektricitäts-
//     Gesellschaft“ along it, two square towers turning octagonal with open iron spire lanterns, blue mosaic AEG
//     monograms over small side doors, wrought-iron gates, a gear emblem. No clock bridge.
//   AEG hall (Behrens' Montagehalle for large machines): dark red brick, piers, tall steel windows between them,
//     „AEG“ in letters high on the wall. Here roofless (E3); the Hochzeitspalast inside is invented.
//   Neubau im Gerüst: invented, from the existing scaffold, tarp, crane and block parts.
// Everything merges into the shared batches (brick, stucco, roof, slate, concrete, enamel, iron, linen, lamp glass) and
// the Wedding sign atlas; lights come from `wedding-lights.ts`. Wear: the shared landmark wear (soot, cracks, moss,
// graffiti, broken panes) plus Charlottenburg's worn-surface pass (`wornBuild`) on the brick and plaster sights.
import { CircleGeometry, CylinderGeometry, ExtrudeGeometry, Matrix4, PlaneGeometry, Shape, SphereGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import { OPEN_PARTS, type Landmark } from '../data/map';
import { Rng } from '../sim/math';
import { blk, cached, cyl, dome, lm, roof, scaffold, tarp, windows, wornBuild, type Ctx, type Grime, type RGB } from './charlottenburg-world';
import { archHead, archWindow, BACK, frustum, FRONT, LEFT, pane, RIGHT, sub } from './landmarks';
import type { ChunkBuilder } from './map-world';
import type { LitMaterial } from './materials';
import { buildUrbanProp } from './props-urban';
import { cloth, sign, SIGN, W, type ClothKind } from './wedding-world';


/** `blk` for a T14 cloth piece (`cloth` in wedding-world.ts): box standing on local y, centred at local (x, z). */
function clothBlk(c: Ctx, kind: ClothKind, x: number, y: number, z: number, w: number, h: number, d: number, shade = 1, ry = 0): void {
  cloth(c.b, kind, lm(c.l, x, y + h / 2, z, ry), w, h, d, shade);
}
/** Tints from the photos (on the shared base materials). */
const T = {
  nazBrick: [1.04, 0.56, 0.42], nazDark: [0.72, 0.38, 0.3], terracotta: [1.1, 0.72, 0.5], granite: [0.66, 0.64, 0.62],
  plaster: [1.42, 1.44, 1.44], sandstone: [1.12, 1.0, 0.8], tile: [1.12, 0.48, 0.34], copper: [0.5, 1.0, 0.78],
  aegRed: [1.12, 0.46, 0.36], aegDark: [0.7, 0.3, 0.26], ironDark: [0.26, 0.26, 0.28], hall: [0.8, 0.42, 0.34], hallDark: [0.55, 0.28, 0.24],
  bunker: [0.66, 0.72, 0.78], bunkerDark: [0.5, 0.54, 0.58], white: [1.55, 1.42, 1.26], flake: [0.55, 0.36, 0.22], goldHi: [1.95, 1.38, 0.46],
} satisfies Record<string, RGB>;

/** Worn-surface recipes (Charlottenburg's pass, `wornBuild`). */
const GRIME: Record<'nazareth' | 'amtsgericht' | 'beamtentor' | 'maschinenhalle', Grime> = {
  nazareth: { tris: 260, drift: 0.2, bay: 2.2, damp: 0.9, moss: 0.5, soot: 0.5, stains: 2.2, streaks: 1.6, patch: 0.4 },
  amtsgericht: { tris: 520, drift: 0.18, bay: 2.2, damp: 1.1, moss: 0.4, soot: 0.7, sootBays: 0.2, stains: 2.4, streaks: 2.2, spall: 0.6, patch: 0.5, ghosts: 0.4 },
  beamtentor: { tris: 220, drift: 0.15, bay: 1.6, damp: 1.0, moss: 0.6, soot: 0.6, stains: 2.4, streaks: 1.6 },
  maschinenhalle: { tris: 420, drift: 0.2, bay: 3, damp: 1.0, moss: 0.4, soot: 0.9, stains: 1.6, streaks: 1.4 },
};

/** A box in the landmark's x-y plane at depth z, from (x0, y0) to (x1, y1), section th × d (raking cornices, struts). */
function rake(c: Ctx, mat: Material, x0: number, y0: number, x1: number, y1: number, z: number, th: number, d: number, tint?: RGB): void {
  const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
  c.b.box(mat, sub(lm(c.l, (x0 + x1) / 2, (y0 + y1) / 2, z), 0, 0, 0, 0, 0, a), len, th, d, tint);
}
/** A box between two local points (a rib, a rail), section s × s. */
function strut(c: Ctx, mat: Material, a: Vector3, e: Vector3, s: number, tint?: RGB): void {
  const d = e.clone().sub(a), len = d.length(), m = lm(c.l, (a.x + e.x) / 2, (a.y + e.y) / 2, (a.z + e.z) / 2);
  const q = new Matrix4().lookAt(new Vector3(), d, Math.abs(d.y) > 0.99 * len ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0));
  c.b.box(mat, m.multiply(q), s, s, len, tint);
}
/** An octagonal prism (a flat face to the front) of circumradius r, standing on local y. */
function octagon(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, r: number, h: number, tint?: RGB, open = false): void {
  c.b.geo(mat, cached(`oct${r.toFixed(2)},${h.toFixed(2)},${open}`, () => new CylinderGeometry(r, r, h, 8, 1, open, Math.PI / 8)), lm(c.l, x, y + h / 2, z), tint);
}
/** A disc of radius r facing the front (+z) at local (x, y, z). */
function disc(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, r: number, tint?: RGB, ry = 0): void {
  c.b.geo(mat, cached(`disc${r.toFixed(2)}`, () => new CircleGeometry(r, 16)), lm(c.l, x, y, z, ry), tint);
}
/** A gable triangle (faces front and back) of width w and height h on top of a block of depth d at local y. */
function gable(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, w: number, d: number, h: number, tint?: RGB): void {
  c.b.geo(mat, frustum(w, d, h, 0, d, FRONT | BACK), lm(c.l, x, y, z), tint);
}
/** A pitched roof over a gable (ridge front to back): only the two slopes. */
function pitch(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, w: number, d: number, h: number, tint?: RGB): void {
  c.b.geo(mat, frustum(w, d, h, 0, d, LEFT | RIGHT), lm(c.l, x, y, z), tint);
}
/** A spire or pinnacle: a cone of radius r and height h on local y. */
function cone(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, r: number, h: number, tint?: RGB, seg = 8): void {
  cyl(c, mat, x, y, z, r, h, tint, seg, 0.02);
}

// ---------------------------------------------------------------- Alte Nazarethkirche (backdrop)

/** Schinkel's brick hall on the Leopoldplatz (1835): the front with the portals to the square (local +z). */
function nazareth(c: Ctx): void {
  const { M, b } = c, F = 8, D = 17, Z = F - D / 2, WD = 13, H = 10;
  // Body, plinth, the dentil band and the plain stone cornice; the pediment and the low roof.
  blk(c, M.brick, 0, 0, Z, WD + 0.3, 0.7, D + 0.3, T.nazDark);
  blk(c, M.brick, 0, 0, Z, WD, H, D, T.nazBrick);
  blk(c, M.brick, 0, H - 0.75, Z, WD + 0.16, 0.28, D + 0.16, T.nazDark);
  blk(c, M.stucco, 0, H - 0.45, Z, WD + 0.5, 0.45, D + 0.5, T.sandstone);
  gable(c, M.brick, 0, H, Z, WD, D + 0.02, 3.6, T.nazBrick);
  pitch(c, M.slate, 0, H - 0.05, Z, WD + 0.8, D + 0.7, 3.95, [0.5, 0.5, 0.52]);
  for (const s of [-1, 1]) rake(c, M.stucco, s * (WD / 2 + 0.2), H + 0.05, 0, H + 3.75, F + 0.2, 0.35, 0.5, T.sandstone);
  // Rose window: a stone ring, eight spokes and a dim warm glass (candles inside).
  const rose = lm(c.l, 0, 7.0, F + 0.02);
  b.geo(M.stucco, cached('naz-ring', () => new CylinderGeometry(1.75, 1.75, 0.22, 20)), rose.clone().multiply(new Matrix4().makeRotationX(Math.PI / 2)), T.sandstone);
  disc(c, M.lampGlass, 0, 7.0, F + 0.13, 1.45, [0.3, 0.19, 0.09]);
  for (let k = 0; k < 8; k++) b.box(M.stucco, sub(rose, 0, 0, 0.16, 0, 0, (k * Math.PI) / 8), 0.12, 2.9, 0.08, T.sandstone);
  disc(c, M.stucco, 0, 7.0, F + 0.2, 0.36, T.sandstone);
  // Three round-arched portals in terracotta frames over a granite stair.
  for (const x of [-2.25, 0, 2.25]) {
    const m = lm(c.l, x, 2.95, F + 0.02);
    archHead(b, M.stucco, m, 2.2, false, 0.03, T.terracotta);
    blk(c, M.stucco, x, 0, F + 0.04, 2.2, 2.95, 0.08, T.terracotta);
    blk(c, M.darkWood, x, 0.6, F + 0.1, 1.55, 2.35, 0.06, W.wood);
    archHead(b, M.stucco, sub(m, 0, 0, 0.06), 1.55, false, 0.04, [0.82, 0.5, 0.36]);
  }
  for (const x of [-3.4, -1.12, 1.12, 3.4]) blk(c, M.stucco, x, 0.6, F + 0.12, 0.3, 2.5, 0.16, T.sandstone);
  for (let k = 0; k < 4; k++) { const z0 = F + k * 0.37; blk(c, M.concrete, 0, 0, (z0 + 9.5) / 2, 8.8, 0.6 - k * 0.15, 9.5 - z0, T.granite); }
  // Small arched windows: beside the portals and under the pediment on the front, two rows on the long sides.
  for (const s of [-1, 1]) for (const y of [2.3, 7.2]) archWindow(b, lm(c.l, s * 5.1, y, F + 0.01), 0.7, 1.35, c.rng, 0.15, false, { mat: M.stucco, color: T.sandstone });
  for (const s of [-1, 1]) for (const z of [-7, -3, 1, 5]) {
    archWindow(b, lm(c.l, s * (WD / 2 + 0.01), 6.4, z, s * Math.PI / 2), 1.3, 3.0, c.rng, 0.2, false, { mat: M.stucco, color: T.sandstone });
    archWindow(b, lm(c.l, s * (WD / 2 + 0.01), 2.3, z, s * Math.PI / 2), 0.75, 1.2, c.rng, 0.05, false);
  }
  // The iron cross on the apex, the teal name board on the lawn (photo), ivy up the west corner, fallen bricks.
  blk(c, M.iron, 0, H + 3.7, F - 0.2, 0.1, 1.4, 0.1, T.ironDark);
  blk(c, M.iron, 0, H + 4.55, F - 0.2, 0.8, 0.1, 0.1, T.ironDark);
  for (const x of [-6.7, -4.5]) blk(c, M.iron, x, 0, 9.05, 0.07, 0.9, 0.07, W.iron);
  sign(b, lm(c.l, -5.6, 0.75, 9.1), 2.6, 0.5, SIGN.nazareth, true);
  for (let i = 0; i < 6; i++) blk(c, M.ivy, -WD / 2 - 0.05, c.rng.range(0.3, 3.8), F - c.rng.range(0.3, 3), 0.2, c.rng.range(0.8, 1.6), c.rng.range(0.8, 1.8), [0.4, 0.62, 0.36]);
  for (let i = 0; i < 5; i++) b.box(M.brick, lm(c.l, c.rng.range(4.6, 6.4), 0.12, c.rng.range(8.2, 9.3), c.rng.range(0, 3)), 0.5, 0.2, 0.3, T.nazDark);
}

// ---------------------------------------------------------------- Amtsgericht Wedding (zone 2 boss backdrop)

/** The court on the Brunnenplatz (1901 to 1906): pale plaster, red tiles, copper turrets; front to the square (+z). */
function amtsgericht(c: Ctx): void {
  const { M, b } = c;
  // Main block between the pavilions, the end pavilions, the central risalit; sandstone plinth and eave bands.
  const blocks: Array<{ x: number; z: number; w: number; d: number; h: number }> = [
    { x: 0, z: -0.5, w: 21, d: 11, h: 13 }, { x: -12.5, z: 0, w: 5, d: 12, h: 14 }, { x: 12.5, z: 0, w: 5, d: 12, h: 14 }, { x: 0, z: 0.5, w: 8, d: 13, h: 15 },
  ];
  for (const k of blocks) {
    blk(c, M.stucco, k.x, 0, k.z, k.w, k.h, k.d, T.plaster);
    blk(c, M.stucco, k.x, 0, k.z, k.w + 0.2, 1.2, k.d + 0.2, T.sandstone);
    blk(c, M.stucco, k.x, k.h - 0.4, k.z, k.w + 0.35, 0.4, k.d + 0.35, T.sandstone);
  }
  // Roofs: the hip over the main block, gables on the pavilions and the risalit, with raking copings and pinnacles.
  roof(c, M.roof, 0, 13, -0.5, 21.5, 11.5, 5.2, 20, 0.6, T.tile);
  for (const k of [blocks[1]!, blocks[2]!, blocks[3]!]) {
    const gh = k.w === 8 ? 5.8 : 4.6;
    gable(c, M.stucco, k.x, k.h, k.z, k.w, k.d + 0.02, gh, T.plaster);
    pitch(c, M.roof, k.x, k.h - 0.05, k.z, k.w + 0.5, k.d + 0.5, gh + 0.25, T.tile);
    const fz = k.z + k.d / 2 + 0.12;
    for (const s of [-1, 1]) {
      rake(c, M.stucco, k.x + s * (k.w / 2 + 0.1), k.h, k.x, k.h + gh, fz, 0.3, 0.4, T.sandstone);
      cone(c, M.stucco, k.x + s * (k.w / 2 - 0.1), k.h, fz - 0.1, 0.22, 1.9, T.sandstone, 6);
    }
    cone(c, M.stucco, k.x, k.h + gh - 0.3, fz - 0.1, 0.26, 2.4, T.sandstone, 6);
  }
  // The risalit gable: three blind lancets, a small rose; the tall tracery window over the pointed portal.
  for (const x of [-1.6, 0, 1.6]) { blk(c, M.dark, x, 15.6, 7.04, 0.55, x === 0 ? 3.2 : 2.3, 0.04); archHead(b, M.dark, lm(c.l, x, 15.6 + (x === 0 ? 3.2 : 2.3), 7.04), 0.55, true, 0.02); }
  blk(c, M.stucco, 0, 0, 7.06, 4.6, 5.8, 0.24, T.sandstone);
  archHead(b, M.stucco, lm(c.l, 0, 5.8, 7.06), 4.6, true, 0.1, T.sandstone);
  blk(c, M.dark, 0, 0, 7.2, 2.7, 3.7, 0.04);
  archHead(b, M.dark, lm(c.l, 0, 3.7, 7.2), 2.7, true, 0.025);
  blk(c, M.darkWood, 0, 0, 7.24, 2.4, 3.4, 0.06, W.wood);
  sign(b, lm(c.l, 0, 4.85, 7.3), 3.4, 0.62, SIGN.amtsgericht);
  archWindow(b, lm(c.l, 0, 10.6, 7.02), 2.5, 4.4, c.rng, 0.55, true, { mat: M.stucco, color: T.sandstone });
  for (const x of [-0.42, 0.42]) blk(c, M.stucco, x, 8.4, 7.1, 0.12, 4.6, 0.08, T.sandstone);
  // Windows: four floors on the front, two bays on each pavilion, the gable windows, the outer sides.
  const trim = { mat: M.stucco, color: T.sandstone };
  for (const y of [2.6, 5.7, 8.7, 11.6]) {
    for (const x of [-9.6, -7.4, -5.2, 5.2, 7.4, 9.6]) pane(b, lm(c.l, x, y, 5.01), 1.0, 1.75, c.rng, 0.12, trim);
    for (const x of [-13.4, -11.6, 11.6, 13.4]) pane(b, lm(c.l, x, y, 6.01), 0.95, 1.75, c.rng, 0.1, trim);
    for (const x of [-2.6, 2.6]) if (y > 3) pane(b, lm(c.l, x, y, 7.01), 1.0, 1.75, c.rng, 0.15, trim);
  }
  for (const x of [-12.5, 12.5]) pane(b, lm(c.l, x, 15.4, 6.03), 0.9, 1.5, c.rng, 0.05, trim);
  windows(c, -12.5, 0, 5, 12, [2.6, 5.7, 8.7, 11.6], { sides: true }, 0.08, 0.95, 1.7, 2.6);
  windows(c, 12.5, 0, 5, 12, [2.6, 5.7, 8.7, 11.6], { sides: true }, 0.08, 0.95, 1.7, 2.6);
  // Copper: round corner turrets with domed caps at the inner pavilion corners, spires on the risalit corners,
  // small dormers on the front slope of the main roof.
  for (const s of [-1, 1]) {
    cyl(c, M.stucco, s * 10.1, 0, 5.75, 0.9, 15.2, T.plaster, 10);
    dome(c, M.slate, s * 10.1, 15.2, 5.75, 1.0, T.copper, 1.15);
    cone(c, M.slate, s * 10.1, 16.3, 5.75, 0.2, 1.7, T.copper, 6);
    octagon(c, M.stucco, s * 4.05, 15, 6.55, 0.55, 1.4, T.plaster);
    cone(c, M.slate, s * 4.05, 16.4, 6.55, 0.6, 2.8, T.copper);
    for (const x of [6.5, 8.7]) {
      blk(c, M.stucco, s * x, 13.5, 3.7, 1.0, 1.3, 1.2, T.plaster);
      roof(c, M.slate, s * x, 14.8, 3.7, 1.2, 1.4, 0.7, 0.05, 0.05, T.copper);
      pane(b, lm(c.l, s * x, 14.15, 4.31), 0.6, 0.8, c.rng, 0.05);
    }
  }
  // Damage: a slipped patch of tiles under a tarp on the west roof, a fallen pinnacle, stones at the foot.
  tarp(c, sub(lm(c.l, -7, 16.6, 2.2), 0, 0, 0, 0, -1.0), 3.4, 2.6, [0.5, 0.52, 0.46]);
  b.box(M.stucco, lm(c.l, 5.2, 0.25, 6.4, 1.2), 0.4, 0.4, 1.6, T.sandstone);
  for (let i = 0; i < 7; i++) b.box(M.stucco, lm(c.l, c.rng.range(-14, 14), 0.15, c.rng.range(5.6, 6.8), c.rng.range(0, 3)), c.rng.range(0.3, 0.7), 0.3, c.rng.range(0.3, 0.6), T.plaster);
}

// ---------------------------------------------------------------- Flakturm Humboldthain

/** The north face of the flak tower over the rubble hill: two octagonal towers, the wall between, the platforms. */
function flakturm(c: Ctx): void {
  const { M, b } = c, X = 7.3, R = 3.6, TOP = 14.6, MID = 11;
  // Bodies from below the ground (the hill covers the south side); parapets, the lower ledge round each tower.
  for (const s of [-1, 1]) {
    octagon(c, M.concrete, s * X, -3, 0, R, TOP + 3, T.bunker);
    octagon(c, M.concrete, s * X, TOP - 0.1, 0, R + 0.18, 0.55, T.bunkerDark);
    octagon(c, M.concrete, s * X, 9.2, 0, R + 0.5, 0.4, T.bunkerDark);
  }
  blk(c, M.concrete, 0, -3, -0.4, 2 * (X - R) + 1.2, MID + 3, 6.4, T.bunker);
  blk(c, M.concrete, 0, MID - 0.1, -0.4, 2 * (X - R) + 1.4, 0.4, 6.6, T.bunkerDark);
  // Railings: posts at the octagon corners, two rails and three bars per edge; on the walkway between the towers.
  for (const s of [-1, 1]) for (let k = 0; k < 8; k++) {
    const a0 = (k * Math.PI) / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4, r = R + 0.05;
    const p0 = new Vector3(s * X + Math.sin(a0) * r, TOP + 0.45, Math.cos(a0) * r), p1 = new Vector3(s * X + Math.sin(a1) * r, TOP + 0.45, Math.cos(a1) * r);
    for (const y of [0.55, 1.35]) strut(c, M.iron, p0.clone().setY(TOP + 0.45 + y), p1.clone().setY(TOP + 0.45 + y), 0.05, W.iron);
    for (const t of [0, 0.33, 0.66]) { const p = p0.clone().lerp(p1, t); strut(c, M.iron, p, p.clone().setY(TOP + 1.85), 0.045, W.iron); }
  }
  for (const z of [-3.6, 2.8]) for (const y of [MID + 0.85, MID + 1.35]) blk(c, M.iron, 0, y, z, 2 * (X - R), 0.05, 0.05, W.iron);
  // Gun slits and the shuttered openings on the faces, graffiti over the slope line and on the parapets.
  for (const s of [-1, 1]) for (const y of [7.6, 11.6]) for (const dx of [-1, 1]) {
    blk(c, M.dark, s * X + dx * 1.1, y, R * Math.cos(Math.PI / 8) + 0.02, 0.5, 1.0, 0.04);
    blk(c, M.dark, s * X + dx * 1.1, y - 4, -R * Math.cos(Math.PI / 8) - 0.02, 0.5, 1.0, 0.04);
  }
  const fz = R * Math.cos(Math.PI / 8) + 0.05;
  for (const [x, y, z, w, h] of [[-X, 6.9, fz, 2.4, 1.2], [X + 0.4, 7.4, fz, 2.6, 1.3], [0, 7.2, 2.85, 3.6, 1.4], [-X, TOP + 0.05, fz + 0.2, 2.6, 0.5], [X, 1.2, -fz, 2.6, 1.3], [-X - 0.5, 0.8, -fz, 2.4, 1.1]] as const) {
    b.geo(M.graffiti, cached(`gr${w}x${h}`, () => new PlaneGeometry(w, h)), lm(c.l, x, y + h / 2, z, z < 0 ? Math.PI : 0), [1, 1, 1]);
  }
  // The stair from the hilltop to the walkway (along the south face, rising west), with one hand rail.
  for (let k = 0; k < 10; k++) blk(c, M.concrete, 2.6 - k * 0.55, -3, 3.55, 0.56, 6 + 3 + k * 0.5 + 0.5, 1.3, T.bunkerDark);
  strut(c, M.iron, new Vector3(2.9, 7.4, 4.25), new Vector3(-2.6, 12.4, 4.25), 0.05, W.iron);
  // Trees and ivy: crowns over the walkway and the platforms, ivy down the parapets.
  const crown = cached('fl-crown', () => new SphereGeometry(1, 7, 5));
  for (const [x, y, z, r] of [[-1.6, MID + 3.2, -1.6, 2.1], [1.8, MID + 2.6, -2.4, 1.6], [-X - 1.4, TOP + 2.1, -1.8, 1.5], [X + 1.2, TOP + 1.8, 1.4, 1.3]] as const) {
    cyl(c, M.darkWood, x, y - r - 2.6, z, 0.14, 2.8, [0.9, 0.86, 0.8], 5);
    b.geo(M.ivy, crown, lm(c.l, x, y, z).multiply(new Matrix4().makeScale(r, r * 0.85, r)), [0.5, 0.72, 0.42]);
  }
  for (let i = 0; i < 10; i++) {
    const s = i % 2 ? 1 : -1, a = c.rng.range(-1.2, 1.2) + (i % 3 === 0 ? Math.PI : 0);
    blk(c, M.ivy, s * X + Math.sin(a) * (R + 0.08), c.rng.range(TOP - 3.2, TOP - 1.2), Math.cos(a) * (R + 0.08), c.rng.range(0.9, 1.8), c.rng.range(1.4, 3), 0.18, [0.4, 0.6, 0.35], a);
  }
  // The steel door on the west side (the side passage with the cache is in front of it).
  blk(c, M.rust, -X - R * Math.cos(Math.PI / 8) - 0.05, -0.5, 0, 0.1, 3.2, 1.6, [0.6, 0.45, 0.35]);
}

// ---------------------------------------------------------------- Beamtentor

/** The arch wall: one extruded piece (pointed arch 5.8 m wide, apex 7.6 m, the stepped gable to 11.8 m). */
function archWallGeo(): BufferGeometry {
  return cached('bt-arch', () => {
    const s = new Shape(), half = 2.9, spring = 4.0, R = 3.684, cx = half - R;
    s.moveTo(-3.02, 0);
    s.lineTo(-3.02, 8.6);
    s.lineTo(0, 11.8);
    s.lineTo(3.02, 8.6);
    s.lineTo(3.02, 0);
    s.lineTo(half, 0);
    s.lineTo(half, spring);
    // Right arc (centre left of the axis) up to the apex, then the left arc down.
    const top = Math.atan2(3.6, -cx);
    for (let k = 1; k <= 8; k++) { const a = (top * k) / 8; s.lineTo(cx + Math.cos(a) * R, spring + Math.sin(a) * R); }
    for (let k = 7; k >= 0; k--) { const a = (top * k) / 8; s.lineTo(-cx - Math.cos(a) * R, spring + Math.sin(a) * R); }
    s.lineTo(-half, 0);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: 4.8, bevelEnabled: false });
    g.translate(0, 0, -2.4);
    // Brick UVs as on boxes (half a unit per meter).
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.5, uv.getY(k) * 0.5);
    return g;
  });
}

/** AEG gate on the Brunnenstraße (Franz Schwechten, 1896): front to the street (+z), the yard behind (−z). */
function beamtentor(c: Ctx): void {
  const { M, b } = c, R = 3.684, cx = 2.9 - R, Z = 2.4;
  b.geo(M.brick, archWallGeo(), lm(c.l, 0, 0, 0), T.aegRed);
  for (const p of OPEN_PARTS.beamtentor!) {
    const x = p.x, s = Math.sign(x);
    // Square lower part, a dark plinth and string course, the octagonal upper part with its corbel ring.
    blk(c, M.brick, x, 0, 0, p.hx * 2, 7.2, p.hz * 2, T.aegRed);
    blk(c, M.brick, x, 0, 0, p.hx * 2 + 0.2, 0.6, p.hz * 2 + 0.2, T.aegDark);
    blk(c, M.brick, x, 7.2, 0, p.hx * 2 + 0.25, 0.35, p.hz * 2 + 0.25, T.aegDark);
    octagon(c, M.brick, x, 7.55, 0, 2.35, 4.4, T.aegRed);
    octagon(c, M.brick, x, 11.95, 0, 2.6, 0.4, T.aegDark);
    // Narrow lancets on the octagon, a small blue clock dial facing the street.
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) blk(c, M.dark, x + Math.sin(a) * 2.19, 9.2, Math.cos(a) * 2.19, 0.42, 1.3, 0.04, undefined, a);
    disc(c, M.enamel, x, 11.2, 2.2, 0.38, [0.3, 0.42, 0.85]);
    blk(c, M.enamel, x, 11.2, 2.23, 0.05, 0.3, 0.02, T.goldHi);
    // The open iron spire lantern: eight ribs to a ball, a ring halfway, a plate on the corbel ring.
    octagon(c, M.iron, x, 12.35, 0, 2.45, 0.12, T.ironDark);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + Math.PI / 8;
      strut(c, M.iron, new Vector3(x + Math.sin(a) * 2.2, 12.45, Math.cos(a) * 2.2), new Vector3(x, 15.7, 0), 0.1, T.ironDark);
    }
    octagon(c, M.iron, x, 13.9, 0, 1.25, 0.12, T.ironDark, true);
    b.geo(M.stucco, cached('bt-ball', () => new SphereGeometry(0.28, 8, 6)), lm(c.l, x, 15.95, 0), T.white);
    // Front and back: a small pointed side door, the blue mosaic with the gold monogram over it.
    for (const f of [1, -1]) {
      const zf = f * (Z + 0.02), ry = f > 0 ? 0 : Math.PI;
      blk(c, M.dark, x, 0, zf, 1.3, 2.5, 0.04);
      archHead(b, M.dark, lm(c.l, x, 2.5, zf, ry), 1.3, true, 0.01);
      blk(c, M.enamel, x, 3.75, zf, 2.0, 1.9, 0.04, [0.32, 0.46, 0.86]);
      archHead(b, M.brick, lm(c.l, x, 5.65, zf, ry), 2.4, true, 0.0, T.aegDark);
      archHead(b, M.enamel, lm(c.l, x, 5.65, zf, ry), 2.0, true, 0.02, [0.32, 0.46, 0.86]);
      sign(b, lm(c.l, x, 4.75, zf + f * 0.04, ry), 1.8, 0.8, SIGN.aegMono);
    }
    // Open gate leaves against the passage sides (yard side), wrought iron.
    const ix = s * 2.96;
    for (const y of [0.15, 2.7]) blk(c, M.iron, ix, y, -1.5, 0.05, 0.07, 1.8, T.ironDark);
    for (let k = 0; k < 7; k++) blk(c, M.iron, ix, 0.1, -2.35 + k * 0.28, 0.04, 2.7, 0.04, T.ironDark);
  }
  // The lettering along the arch (gold capitals on the brick, photo), the gear emblem in the gable, the stepped edges.
  // On a band 0.5 m outside the arch: the right arc's point at 42° (its centre lies left of the axis), mirrored left.
  const a = (42 * Math.PI) / 180, bx = cx + Math.cos(a) * (R + 0.5), by = 4.0 + Math.sin(a) * (R + 0.5);
  sign(b, sub(lm(c.l, -bx, by, Z + 0.03), 0, 0, 0, 0, 0, Math.PI / 2 - a), 2.5, 0.48, SIGN.aeg1);
  sign(b, lm(c.l, 0, 8.25, Z + 0.03), 2.6, 0.48, SIGN.aeg2);
  sign(b, sub(lm(c.l, bx, by, Z + 0.03), 0, 0, 0, 0, 0, a - Math.PI / 2), 2.5, 0.48, SIGN.aeg3);
  disc(c, M.enamel, 0, 9.85, Z + 0.03, 0.42, [1.25, 1.18, 1.05]);
  for (let k = 0; k < 8; k++) b.box(M.enamel, sub(lm(c.l, 0, 9.85, Z + 0.05), 0, 0, 0, 0, 0, (k * Math.PI) / 4).multiply(new Matrix4().makeTranslation(0, 0.5, 0)), 0.16, 0.18, 0.04, [1.25, 1.18, 1.05]);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const t = (k + 0.5) / 4, x = s * 3.02 * (1 - t), y = 8.6 + 3.2 * t;
    blk(c, M.brick, x, y - 0.15, 0, 0.55, 0.62, 4.9, T.aegDark);
  }
  blk(c, M.brick, 0, 11.5, 0, 0.9, 1.0, 4.9, T.aegDark);
  roof(c, M.slate, 0, 12.5, 0, 1.1, 5.1, 0.8, 0.1, 5.1, [0.5, 0.36, 0.3]);
}

// ---------------------------------------------------------------- AEG hall with the Hochzeitspalast (district boss)

/** Iron letters on a wall plane (frame `m`, +z out): only „A“ and „G“ are left, the „E“ lies on the floor. */
function aegLetters(c: Ctx, m: Matrix4, h: number): void {
  const t = 0.16, box = (x: number, y: number, w: number, hh: number, rz = 0): void => c.b.box(c.M.iron, sub(m, x, y, 0.06, 0, 0, rz), w, hh, 0.1, [0.42, 0.48, 0.52]);
  const a = Math.atan2(h, h * 0.32);
  box(-h * 0.16, h / 2, t, Math.hypot(h, h * 0.32), -(Math.PI / 2 - a));
  box(h * 0.16, h / 2, t, Math.hypot(h, h * 0.32), Math.PI / 2 - a);
  box(0, h * 0.38, h * 0.3, t);
  const gx = h * 1.6;
  box(gx - h * 0.3, h / 2, t, h);
  box(gx, h - t / 2, h * 0.6, t);
  box(gx, t / 2, h * 0.6, t);
  box(gx + h * 0.3, h * 0.25, t, h * 0.5);
  box(gx + h * 0.17, h * 0.45, h * 0.26, t);
}

/** Brick hall walls on the `OPEN_PARTS` (as `openHall`): piers, tall steel windows, ragged side walls, a low south wall. */
function hallWalls(c: Ctx, tall: number, low: number): void {
  const parts = OPEN_PARTS.maschinenhalle!, M = c.M, b = c.b, hz = c.l.hz;
  const hAt = (z: number): number => low + (tall - low) * Math.max(0, Math.min(1, (hz - 1 - z) / (2 * hz - 2)));
  const north = parts.find((p) => p.hz < 1 && p.z < 0)!, south = parts.find((p) => p.hz < 1 && p.z > 0)!, sides = parts.filter((p) => p.hz >= 1);
  const zi = north.z + north.hz, zo = north.z - north.hz;
  blk(c, M.brick, north.x, 0, north.z, north.hx * 2, tall, north.hz * 2, T.hall);
  blk(c, M.brick, north.x, tall - 0.4, north.z, north.hx * 2 + 0.3, 0.4, north.hz * 2 + 0.4, T.hallDark);
  // Piers every 6 m on both faces; the tall windows between them (clerestory only behind the palace front).
  for (let x = -north.hx; x <= north.hx + 0.01; x += 6) for (const z of [zi + 0.22, zo - 0.22]) blk(c, M.brick, x, 0, z, 0.9, tall + 0.2, 0.45, T.hallDark);
  for (let x = -north.hx + 3; x < north.hx; x += 6) {
    const behind = Math.abs(x) < 16, y0 = behind ? 8.9 : 3.2, h = tall - 1.4 - y0;
    for (const [z, ry] of [[zi + 0.02, 0], [zo - 0.02, Math.PI]] as const) {
      b.box(M.dark, lm(c.l, x, y0 + h / 2, z, ry), 3.6, h, 0.03);
      if (z === zi + 0.02) {
        for (const dx of [-0.6, 0.6]) blk(c, M.iron, x + dx, y0, z + 0.03, 0.08, h, 0.05, T.ironDark);
        for (let y = y0 + 1.5; y < y0 + h; y += 1.5) blk(c, M.iron, x, y, z + 0.03, 3.6, 0.07, 0.05, T.ironDark);
      }
    }
  }
  // Steel truss stubs of the lost roof on the wall top; the side walls in 2 m pieces falling toward the camera.
  for (let x = -north.hx + 6; x < north.hx; x += 12) strut(c, M.iron, new Vector3(x, tall, zi), new Vector3(x, tall + 1.4, zi + 2.6), 0.22, T.ironDark);
  for (const p of sides) {
    const n = Math.ceil(p.hz);
    for (let i = 0; i < n; i++) {
      const z0 = p.z - p.hz + (i * p.hz * 2) / n, z1 = p.z - p.hz + ((i + 1) * p.hz * 2) / n, h = Math.max(0.8, hAt((z0 + z1) / 2) * c.rng.range(0.84, 1.04));
      blk(c, M.brick, p.x, 0, (z0 + z1) / 2, p.hx * 2, h, z1 - z0 + 0.02, T.hall);
      if (i % 3 === 0) blk(c, M.brick, p.x, 0, z0 + 0.25, p.hx * 2 + 0.5, h + 0.15, 0.5, T.hallDark);
    }
  }
  const sn = Math.ceil((south.hx * 2) / 1.6);
  for (let i = 0; i < sn; i++) {
    const x0 = south.x - south.hx + (i * south.hx * 2) / sn, x1 = south.x - south.hx + ((i + 1) * south.hx * 2) / sn;
    blk(c, M.brick, (x0 + x1) / 2, 0, south.z, x1 - x0 + 0.02, c.rng.range(0.5, Math.min(low, 2.0)), south.hz * 2, T.hall);
  }
  // „AEG“ high on the inner north wall (the E fell), bricks and two fallen truss beams along the walls.
  aegLetters(c, lm(c.l, -22, tall - 3.4, zi + 0.02), 1.9);
  const e = lm(c.l, -25.5, 0.06, zi + 2.4).multiply(new Matrix4().makeRotationX(-Math.PI / 2));
  for (const [x, y, w, h] of [[-0.5, 0.95, 0.16, 1.9], [0, 1.82, 1.0, 0.16], [-0.1, 0.95, 0.8, 0.16], [0, 0.08, 1.0, 0.16]] as const) b.box(M.iron, sub(e, x, y, 0), w, h, 0.1, [0.42, 0.48, 0.52]);
  for (const [x0, z0, x1, z1] of [[-27, -14.5, -19, -12.8], [21, 14.2, 27.5, 12.6]] as const) strut(c, M.iron, new Vector3(x0, 0.25, z0), new Vector3(x1, 0.35, z1), 0.3, T.ironDark);
  for (let i = 0; i < 16; i++) {
    const s = c.rng.range(0.4, 1.1), x = c.rng.range(-c.l.hx + 1.5, c.l.hx - 1.5), z = c.rng.next() < 0.5 ? c.rng.range(-hz + 1.2, -hz + 2.4) : c.rng.range(hz - 2.6, hz - 1.2);
    if (Math.abs(x) < 16 && z < 0) continue;
    b.box(M.brick, lm(c.l, x, s * 0.22, z, c.rng.range(0, 3)), s, s * 0.45, s * c.rng.range(0.8, 1.4), T.hallDark);
  }
}

/** The invented Hochzeitspalast at the north wall: gilded Festsaal front, velvet, chandeliers, the throne on its dais. */
function palast(c: Ctx): void {
  const { M, b } = c, z0 = -c.l.hz + 1.1, F = z0 + 0.8;
  blk(c, M.enamel, 0, 0, z0 + 0.4, 30, 7.5, 0.8, W.gold);
  blk(c, M.enamel, 0, 0, z0 + 0.45, 30.4, 0.5, 1.0, [1.2, 0.8, 0.26]);
  blk(c, M.enamel, 0, 7.5, z0 + 0.4, 31, 0.6, 1.1, [1.8, 1.25, 0.4]);
  // Glowing gilded trims (the emissive lamp batch): the band over the arches and the cornice edge.
  blk(c, M.lampGlass, 0, 5.9, F + 0.04, 29, 0.12, 0.06, [0.85, 0.55, 0.2]);
  blk(c, M.lampGlass, 0, 7.45, z0 + 0.98, 31, 0.08, 0.06, [0.85, 0.55, 0.2]);
  // Five arches with drawn ruby curtains, a valance with gold fringe; gilded pilasters between them.
  for (let i = -2; i <= 2; i++) {
    const x = i * 5.6, m = lm(c.l, x, 4.6, F);
    archHead(b, M.enamel, m, 3.6, false, 0.02, T.goldHi);
    blk(c, M.enamel, x, 0, F + 0.01, 3.6, 4.6, 0.02, T.goldHi);
    blk(c, M.dark, x, 0, F + 0.03, 3, 4.6, 0.02);
    archHead(b, M.dark, m, 3, false, 0.04);
    for (const s of [-1, 1]) {
      clothBlk(c, 'velvet', x + s * 1.2, 0, F + 0.1, 0.6, 4.4, 0.14);
      blk(c, M.enamel, x + s * 1.2, 1.7, F + 0.18, 0.66, 0.14, 0.06, W.gold);
    }
    clothBlk(c, 'velvet', x, 4.15, F + 0.12, 3.2, 0.5, 0.16);
    blk(c, M.enamel, x, 4.05, F + 0.2, 3.2, 0.1, 0.04, W.gold);
  }
  for (const x of [-14, -8.4, -2.8, 2.8, 8.4, 14]) {
    // Pilasters and capitals with more red in the gold: it reads warm, not olive, under the green night sky.
    cyl(c, M.enamel, x, 0.5, F + 0.3, 0.32, 6.4, [2.0, 1.2, 0.3], 8);
    blk(c, M.enamel, x, 6.9, F + 0.3, 0.9, 0.5, 0.7, [2.0, 1.25, 0.32]);
  }
  // Balustrade with balusters, urns with lamp-glass flames; the central attic with the sign, a broken pediment and a crown.
  for (const y of [8.1, 8.85]) blk(c, M.enamel, 0, y, z0 + 0.4, 30.4, 0.15, 0.5, W.gold);
  for (let x = -14.8; x <= 14.8; x += 0.75) if (Math.abs(x) > 5.2) blk(c, M.enamel, x, 8.25, z0 + 0.4, 0.18, 0.6, 0.18, W.gold);
  for (const x of [-14, -8.4, 8.4, 14]) {
    cyl(c, M.enamel, x, 9.0, z0 + 0.4, 0.32, 0.7, T.goldHi, 8, 0.2);
    cyl(c, M.lampGlass, x, 9.7, z0 + 0.4, 0.14, 0.4, [1.8, 1.1, 0.4], 6, 0.02);
  }
  blk(c, M.enamel, 0, 8.1, z0 + 0.4, 10, 2.6, 0.8, W.gold);
  blk(c, M.enamel, 0, 10.7, z0 + 0.4, 10.4, 0.3, 1.0, T.goldHi);
  sign(b, lm(c.l, 0, 9.4, z0 + 0.82), 8.5, 1.15, SIGN.palast);
  for (const s of [-1, 1]) rake(c, M.enamel, s * 5, 11.0, s * 1.6, 12.2, z0 + 0.4, 0.35, 0.8, T.goldHi);
  b.geo(M.enamel, cached('crown', () => new CylinderGeometry(1.1, 0.95, 0.75, 12, 1, true)), lm(c.l, 0, 11.4, z0 + 0.4), T.goldHi);
  for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; cone(c, M.enamel, Math.sin(a) * 1.05, 11.75, z0 + 0.4 + Math.cos(a) * 1.05, 0.18, 0.7, T.goldHi, 5); }
  for (let k = 0; k < 3; k++) b.geo(M.lampGlass, cached('jewel', () => new SphereGeometry(0.14, 6, 4)), lm(c.l, -0.7 + k * 0.7, 11.45, z0 + 1.42), k === 1 ? [0.4, 1.3, 1.2] : [1.7, 1.2, 0.4]);
  // Worn gilding: flaked patches, one curtain torn down on the floor, a scaffold with an emerald net at the east end.
  for (let i = 0; i < 6; i++) blk(c, M.enamel, c.rng.range(-14, 14), c.rng.range(0.6, 6.8), F + 0.025, c.rng.range(0.4, 1.0), c.rng.range(0.3, 0.7), 0.02, T.flake);
  clothBlk(c, 'velvet', 9.6, 0, F + 1.2, 1.4, 0.18, 2.2, 0.8);
  scaffold(c, lm(c.l, 12.6, 0, F + 0.1), 4.6, 8.2, 0.9);
  tarp(c, lm(c.l, 12.6, 8.4, F + 1.1), 4.2, 5.6, W.emerald);
  // Dais in two steps, the throne with its round crest, the wedding cake and the gift table; the ruby runner.
  clothBlk(c, 'carpet', 0, 0, z0 + 4.5, 9, 0.25, 4.5);
  clothBlk(c, 'carpet', 0, 0.25, z0 + 4.0, 7, 0.22, 3.4);
  blk(c, M.enamel, 0, 0.24, z0 + 6.74, 9, 0.04, 0.06, W.gold);
  blk(c, M.enamel, 0, 0.47, z0 + 3.0, 2.4, 3.2, 0.5, W.gold);
  b.geo(M.enamel, cached('throne-crest', () => new CylinderGeometry(1.2, 1.2, 0.5, 14)), lm(c.l, 0, 3.6, z0 + 3.0).multiply(new Matrix4().makeRotationX(Math.PI / 2)), T.goldHi);
  clothBlk(c, 'velvet', 0, 0.47, z0 + 3.9, 1.8, 0.95, 1.3, 0.8);
  for (const s of [-1, 1]) blk(c, M.enamel, s * 1.05, 0.47, z0 + 3.9, 0.3, 1.4, 1.3, W.gold);
  for (const [r, y] of [[0.62, 0.47], [0.46, 0.92], [0.3, 1.37]] as const) cyl(c, M.linen, 3.5, y, z0 + 5.6, r, 0.45, T.white, 12);
  cyl(c, M.enamel, 3.5, 1.82, z0 + 5.6, 0.08, 0.35, W.gold, 6);
  blk(c, M.wood, -3.5, 0.47, z0 + 5.4, 1.8, 0.75, 0.9, [0.85, 0.6, 0.4]);
  for (const [dx, kind] of [[-0.5, 'velvet'], [0.1, 'brocade'], [0.6, 'brocade']] as const) clothBlk(c, kind, -3.5 + dx, 1.22, z0 + 5.4, 0.42, 0.36, 0.42);
  // The ruby runner: seven carpets end to end, so each keeps its gold border (one 20 m carpet smears).
  for (let k = 0; k < 7; k++) clothBlk(c, 'carpet', 0, 0, z0 + 5 + (k + 0.5) * (20 / 7), 3, 0.03, 20 / 7 - 0.04);
  for (const s of [-1, 1]) blk(c, M.enamel, s * 1.5, 0, z0 + 15, 0.08, 0.035, 20, W.gold);
  // Chandeliers on a wire between the side walls, in front of the palace (their light is in the plan, at the rim).
  const cz = z0 + 3.2;
  blk(c, M.iron, 0, 9.0, cz, 59, 0.04, 0.04, T.ironDark);
  for (const x of [-12, 0, 12]) {
    blk(c, M.iron, x, 6.3, cz, 0.03, 2.7, 0.03, T.ironDark);
    b.geo(M.enamel, cached('chand-ring', () => new CylinderGeometry(0.95, 0.95, 0.14, 12, 1, true)), lm(c.l, x, 5.9, cz), T.goldHi);
    b.geo(M.enamel, cached('chand-ring2', () => new CylinderGeometry(0.5, 0.5, 0.12, 10, 1, true)), lm(c.l, x, 5.4, cz), T.goldHi);
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; cyl(c, M.lampGlass, x + Math.sin(a) * 0.95, 6.0, cz + Math.cos(a) * 0.95, 0.06, 0.2, [1.9, 1.3, 0.6], 5); }
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + 0.3; cone(c, M.lampGlass, x + Math.sin(a) * 0.5, 5.05, cz + Math.cos(a) * 0.5, 0.06, 0.3, [1.2, 1.15, 1.0], 4); }
  }
}

function maschinenhalle(c: Ctx): void {
  hallWalls(c, 12.5, 1.6);
}

// ---------------------------------------------------------------- Neubau im Gerüst (invented, existing parts)

/** A concrete shell of five floors behind a scaffold with emerald nets, a crane, the banner, the site hoarding. */
function neubau(c: Ctx): void {
  const { M, b, l } = c, H = 3.2, n = 5, w = l.hx * 2 - 2, d = l.hz * 2 - 3;
  for (let f = 0; f <= n; f++) blk(c, M.concrete, 0, f * H, -0.5, w, 0.3, d, W.concrete);
  for (const x of [-w / 2 + 0.3, -w / 6, w / 6, w / 2 - 0.3]) for (const z of [-d / 2 - 0.2, d / 2 - 0.8]) blk(c, M.concrete, x, 0, z, 0.4, n * H, 0.4, W.concrete);
  blk(c, M.concrete, -w / 2 + 3, 0, -2, 5, n * H + 1.5, 4, [0.7, 0.7, 0.68]);
  // Half-built brick infill on the lower floors, rusty rebar stubs on the top slab.
  for (const [x, f, hh] of [[-w / 3, 0, H], [-w / 3, 1, 1.8], [w / 3, 0, 2.2], [0, 2, 1.2]] as const) blk(c, M.brick, x, f * H + 0.3, d / 2 - 0.9, w / 3 - 0.5, hh - 0.3, 0.24, [0.95, 0.6, 0.48]);
  for (let i = 0; i < 18; i++) blk(c, M.rust, -w / 2 + 0.5 + (i * (w - 1)) / 17, n * H + 0.3, d / 2 - 0.8 - (i % 3) * 0.4, 0.04, c.rng.range(0.6, 1.3), 0.04, [0.6, 0.42, 0.32]);
  scaffold(c, lm(l, 0, 0, l.hz - 1.2), w - 1, n * H - 1, 0.9);
  // Emerald nets over the upper scaffold (shown in reveal shots), the banner across the first floor.
  for (let i = 0; i < 4; i++) tarp(c, lm(l, -w / 2 + 2.2 + i * ((w - 4.4) / 3), n * H - 0.6, l.hz - 0.2), (w - 2) / 4, 7.5, W.emerald);
  sign(b, lm(l, 0, 3.3, l.hz + 0.05), 10, 1.6, SIGN.kommtBald);
  // The site hoarding in front: plywood panels with a gap, the „Eröffnung: bald“ board, warning stripes.
  for (let x = -w / 2; x < w / 2 - 0.5; x += 2.5) {
    if (Math.abs(x + 1.25 - 4) < 1.6) continue;
    blk(c, M.wood, x + 1.25, 0, l.hz - 0.15, 2.4, 2.2, 0.06, [0.95, 0.8, 0.56]);
  }
  sign(b, lm(l, -5, 1.25, l.hz - 0.1), 4, 0.95, SIGN.eroeffnung);
  for (const s of [-1, 1]) blk(c, M.enamel, 4 + s * 1.6, 0, l.hz - 0.15, 0.15, 2.4, 0.15, [1.4, 1.1, 0.2]);
  buildUrbanProp(b, { kind: 'crane', x: lmPoint(l, w / 2 - 3, -d / 2 + 2).x, z: lmPoint(l, w / 2 - 3, -d / 2 + 2).z, rot: l.rot + 0.6, size: 1 }, c.rng);
}

/** World x, z of a landmark's local (x, z). */
function lmPoint(l: Landmark, x: number, z: number): { x: number; z: number } {
  const p = new Vector3(x, 0, z).applyMatrix4(lm(l));
  return { x: p.x, z: p.z };
}

/** Builds one of the six sights and the Neubau; false for kinds this file does not draw. */
export function buildWeddingSight(b: ChunkBuilder, l: Landmark): boolean {
  const c: Ctx = { b, M: b.mm, l, rng: new Rng(Math.round(l.x * 31 + l.z * 17) + 1888) };
  switch (l.kind) {
    case 'nazareth': wornBuild(c, GRIME.nazareth, () => nazareth(c)); return true;
    case 'amtsgericht': wornBuild(c, GRIME.amtsgericht, () => amtsgericht(c)); return true;
    case 'flakturm': flakturm(c); return true;
    case 'beamtentor': wornBuild(c, GRIME.beamtentor, () => beamtentor(c)); return true;
    case 'maschinenhalle': wornBuild(c, GRIME.maschinenhalle, () => maschinenhalle(c)); palast(c); return true;
    case 'neubau': neubau(c); return true;
    default: return false;
  }
}
