// Weapon models, built in code (M7, WP4 step 1). One model per weapon base (`src/data/weapon-look.ts`),
// built from a parts kit and merged per material into at most 3 meshes: `metal`, `matte` and `glow`.
// Paint lives in vertex colours, so a model costs 2 draw calls per pass (3 with a glow). Every model
// stands along +Y with the grip at the origin; `mountWeapon` puts it into the right hand so that the
// business end follows the hand bone's +Z (what `tools/clip-swing.mjs` measures).
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Group,
  IcosahedronGeometry, Matrix4, Mesh, Path, PlaneGeometry, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ElementId, SetId, WeaponKindId } from '../data/items';
import { WEAPON_LOOKS, weaponLookId, weaponTraits, DEFAULT_LOOK, type WeaponLookId } from '../data/weapon-look';
import { Rng } from '../sim/math';
import { HERO_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import { GRAIN_TONE, paintGrain, paintMetalAtlas } from './paint';

export type WeaponModel = WeaponLookId;

/**
 * Left hand on two-handed models (H1): grip height along the shaft, meters up the model's +Y from the
 * right-hand grip. `src/render/hand-ik.ts` puts `hand_l` there; one-handed kinds have none.
 */
export const LEFT_GRIP: Readonly<Partial<Record<WeaponKindId, number>>> = { hammer: 0.48, spear: 0.5 };

/**
 * Two-handed standing pose (H1 2b): a pack clip whose left hand already sits at the handle, and the
 * left grip height there. The spear keeps the one-handed `Sword_Idle` (Johannes, 2026-11-17).
 */
export const TWO_HAND_STAND: Readonly<Partial<Record<WeaponKindId, { clip: string; grip: number }>>> = {
  hammer: { clip: 'Pistol_Idle_Loop', grip: -0.08 },
};

/**
 * Thrust grip (C1): no pack clip holds a weapon along the facing (`Punch_Cross` and `Melee_Hook` point
 * the hand bone's +Z to the hero's left), so during `thrust` attacks the rack turns the model in the
 * right hand until the shaft points along the attack direction. `slide`: meters the shaft slides forward
 * through the hand (tip toward the hit reach); `grip`: left-hand height on the shaft (model +Y, behind
 * the right hand: rear hand of a two-handed jab); `pitch`: shaft angle below level; `tip`: tip height on +Y.
 */
export const THRUST: Readonly<Partial<Record<WeaponKindId, { slide: number; grip: number; pitch: number; tip: number }>>> = {
  spear: { slide: 0.2, grip: -0.5, pitch: 4 * (Math.PI / 180), tip: 1.81 },
};

/**
 * Thrust weight (0..1) at clip time `ct` of a thrust attack: rises over the wind-up
 * (`clipStart` → `clipSwing`), holds through the active frames and `THRUST_HOLD` s after, then lets go
 * over `THRUST_RELEASE` s of clip while the clip carries the hand back to the guard.
 */
export const THRUST_HOLD = 0.12;
export const THRUST_RELEASE = 0.3;
export function thrustWeight(a: { clipStart: number; clipSwing: number; clipHit: number }, ct: number): number {
  const s = (x: number): number => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
  if (ct <= a.clipSwing) return s((ct - a.clipStart) / Math.max(1e-3, a.clipSwing - a.clipStart));
  return 1 - s((ct - a.clipHit - THRUST_HOLD) / THRUST_RELEASE);
}

const UP = new Vector3(0, 1, 0);
const gq = new Quaternion();
const gq2 = new Quaternion();
const gq3 = new Quaternion();
const gv = new Vector3();
const BASE_POS = new Vector3(0, 0.09, 0.03);
const BASE_ROT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

/**
 * Guns (WP4 1h): mount tilt about the model's X so the barrel (−Z) lies level along the shot line in the
 * aim pose (`Pistol_Shoot` and `Pistol_Idle_Loop` hold it 11° up), the left hand on the handguard (model
 * space), the standing clip and the muzzle height over the ground in the aim pose (where shots are drawn).
 */
export const GUNS: Readonly<Partial<Record<WeaponLookId, { tilt: number; grip: readonly [number, number, number]; stand: string; muzzle: number }>>> = {
  neonfl: { tilt: -11 * (Math.PI / 180), grip: [0, 0.05, -0.09], stand: 'Pistol_Idle_Loop', muzzle: 1.5 },
};
const _mount = new Quaternion();
const mountOf = (model: WeaponModel | null): Quaternion => {
  const g = model === null ? undefined : GUNS[model];
  return g ? _mount.copy(BASE_ROT).multiply(gq.setFromAxisAngle(_x.set(1, 0, 0), g.tilt)) : _mount.copy(BASE_ROT);
};
const _x = new Vector3();

const ELEMENT_GLOW: Record<ElementId, number> = { fire: 0xff6a2a, acid: 0x97c459, shock: 0x7dd3ff };
/** Emissive intensity of an element strip and of a signature glow (neon tube, legendary edge). */
const ELEMENT_INTENSITY = 2.4;
const SIGNATURE_INTENSITY = 1.6;

/** Glow rule (D1): the element colour, else the base's signature colour, else none (glow mesh hidden). */
export function weaponGlow(model: WeaponModel, element: ElementId | undefined): { color: number; intensity: number } | null {
  if (element) return { color: ELEMENT_GLOW[element], intensity: ELEMENT_INTENSITY };
  const sig = (WEAPON_LOOKS[model] as { glow?: string }).glow;
  return sig ? { color: parseInt(sig.slice(1), 16), intensity: SIGNATURE_INTENSITY } : null;
}

// ---------------------------------------------------------------- parts kit (no WebGL: unit tested)

export type WeaponSlot = 'metal' | 'matte' | 'glow';
/** Matte grain cell of `paintGrain`: wood, cloth, plain, concrete. */
export type Grain = 0 | 1 | 2 | 3;
export interface Paint { slot: WeaponSlot; hex: number; grain: Grain }

/** Mean sRGB tone of the grey metal map; metal vertex colours are divided by it. */
const METAL_TONE = 0xa0;
export const metal = (hex: number): Paint => ({ slot: 'metal', hex, grain: 0 });
/** Clean, silvery metal: the brushed half of the metal atlas (look 2: Sichel, Hackmesser, Werkhammer). */
export const bright = (hex: number): Paint => ({ slot: 'metal', hex, grain: 1 });
export const wood = (hex: number): Paint => ({ slot: 'matte', hex, grain: 0 });
export const cloth = (hex: number): Paint => ({ slot: 'matte', hex, grain: 1 });
export const plain = (hex: number): Paint => ({ slot: 'matte', hex, grain: 2 });
export const stone = (hex: number): Paint => ({ slot: 'matte', hex, grain: 3 });
/** Glow parts: the element or signature colour; `GLOW_WHITE` glows a faint white whatever the colour (D1, Fernsehturm-Splitter). */
const GLOW: Paint = { slot: 'glow', hex: 0x000000, grain: 2 };
const GLOW_WHITE: Paint = { slot: 'glow', hex: 0xffffff, grain: 2 };
/** A faint cold-white gleam (30 % of the white mix): a fixed per-base accent, tinted by an element when there is one. */
const GLEAM: Paint = { slot: 'glow', hex: 0x959595, grain: 2 };

/** Shared paints. The first seven are the old per-material colours (pre-WP4 kit). */
const P = {
  steel: metal(0x8b9094),
  rust: metal(0x6a5a50),
  wood: wood(0x7a5636),
  wrap: cloth(0xc9b58c),
  red: plain(0xb8261c),
  rubber: plain(0x2a2320),
  leather: plain(0x5a3c26),
  iron: metal(0x5a5650),
  brass: metal(0xb08a3a),
  enamel: metal(0x34588c),
} as const;

/** One part, already in model space. `soft`: cloth, cords and bands, outside the envelope check. `tag`: the hero gear's bone (WP4 step 2). */
export interface WeaponPart { geo: BufferGeometry; slot: WeaponSlot; soft: boolean; tag: string }

const _m = new Matrix4();
const _e = new Euler();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

/** The parts kit, shared by the weapons and the hero's gear (`src/render/gear-kit.ts`). */
export class Parts {
  readonly list: WeaponPart[] = [];
  /** Copied onto every part added (the gear's bone). */
  tag = '';
  /** Extra transform for the parts added inside `frame` (a scaled hammer head). */
  private xf: Matrix4 | null = null;

  frame(m: Matrix4, parts: () => void): void {
    const prev = this.xf;
    this.xf = prev ? prev.clone().multiply(m) : m;
    parts();
    this.xf = prev;
  }

  /** Places `geo` like a Mesh at position (x, y, z) with Euler rotation (rx, ry, rz) and paints it. */
  add(geo: BufferGeometry, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, soft = false): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.clearGroups();
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s));
    if (this.xf) g.applyMatrix4(this.xf);
    // Vertex colour = paint ÷ the map's mean tone (linear), so map × colour averages to the paint.
    const tone = paint.slot === 'metal' ? METAL_TONE : paint.slot === 'matte' ? GRAIN_TONE[paint.grain] : 255;
    const div = _c.setHex(tone * 0x10101).r;
    _c.setHex(paint.hex);
    const n = g.attributes.position!.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([_c.r / div, _c.g / div, _c.b / div], i * 3);
    g.setAttribute('color', new BufferAttribute(col, 3));
    // Metal parts sample their half of the metal atlas (0 chipped and rusty, 1 clean).
    if (paint.slot === 'metal') {
      const uv = g.attributes.uv!;
      const u0 = paint.grain === 1 ? 0.5 : 0, pad = 2 / 1024, k = 0.5 - 2 * pad;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + pad + Math.min(1, Math.max(0, uv.getX(i))) * k, Math.min(1, Math.max(0, uv.getY(i))));
    }
    // Matte parts sample their cell of the grain atlas (cell 0 top left = v 0.5..1).
    if (paint.slot === 'matte') {
      const uv = g.attributes.uv!;
      const u0 = (paint.grain % 2) * 0.5, v0 = paint.grain < 2 ? 0.5 : 0, pad = 2 / 512, k = 0.5 - 2 * pad;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + pad + Math.min(1, Math.max(0, uv.getX(i))) * k, v0 + pad + Math.min(1, Math.max(0, uv.getY(i))) * k);
    }
    this.list.push({ geo: g, slot: paint.slot, soft, tag: this.tag });
    return this;
  }
}

export const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, s = 8, open = false): BufferGeometry => new CylinderGeometry(rt, rb, h, s, 1, open);
export const cone = (r: number, h: number, s = 4, open = false): BufferGeometry => new ConeGeometry(r, h, s, 1, open);
export const ball = (r: number, w = 8, h = 6): BufferGeometry => new SphereGeometry(r, w, h);
export const ring = (R: number, r: number, rs = 6, ts = 10): BufferGeometry => new TorusGeometry(R, r, rs, ts);
export const scaled = (g: BufferGeometry, x: number, y: number, z: number): BufferGeometry => g.scale(x, y, z);

/** A flat part from an outline in the model's XY plane (blades, jaws, flags), `depth` thick, centred on z = 0. */
export function flat(pts: ReadonlyArray<readonly [number, number]>, depth: number, holes: ReadonlyArray<readonly [number, number, number]> = []): BufferGeometry {
  const s = new Shape(pts.map(([x, y]) => new Vector2(x, y)));
  for (const [x, y, r] of holes) s.holes.push(new Path().absarc(x, y, r, 0, Math.PI * 2, true));
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  // Planar UVs in 0..1 over the outline's bounds (the grain atlas needs every part inside its cell).
  g.computeBoundingBox();
  const b = g.boundingBox!, size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, 1e-3);
  const p = g.attributes.position!, uv = g.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / size, (p.getY(i) - b.min.y) / size);
  return g;
}

/** A rag tied at `y` round a shaft of radius `r`: a knot and a thin, wavy strip of 5 segments that hangs (soft). */
function ribbon(b: Parts, y: number, len = 0.28, r = 0.028, paint: Paint = P.red): void {
  b.add(cyl(r + 0.005, r + 0.005, 0.025, 8), paint, 0, y, 0, 0, 0, 0, true);
  const g = new PlaneGeometry(0.025, len, 1, 5);
  g.translate(0, -len / 2, 0);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const v = -p.getY(i) / len, x = p.getX(i);
    p.setXYZ(i, x - 0.012 - 0.05 * v * v, p.getY(i) * (1 - 0.08 * v), 0.014 * Math.sin(v * Math.PI * 2.2) + x * 0.4 * v);
  }
  g.computeVertexNormals();
  b.add(g, paint, -r, y, 0, 0, 0, 0, true);
}

const _a = new Vector3(), _b = new Vector3(), _d = new Vector3();

/** A cord or band from `a` to `c` that sags by `sag` in its middle (a static curve of `n` segments, soft). */
export function cord(b: Parts, a: readonly [number, number, number], c: readonly [number, number, number], sag: number, r: number, paint: Paint, n = 5): void {
  const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - sag, (a[2] + c[2]) / 2];
  const at = (t: number, out: Vector3): Vector3 => out.set(
    (1 - t) ** 2 * a[0] + 2 * t * (1 - t) * mid[0]! + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * mid[1]! + t * t * c[1], (1 - t) ** 2 * a[2] + 2 * t * (1 - t) * mid[2]! + t * t * c[2]);
  at(0, _a);
  for (let i = 1; i <= n; i++) {
    at(i / n, _b);
    _d.subVectors(_b, _a);
    const g = cyl(r, r, _d.length() + r, 5);
    g.applyQuaternion(_q.setFromUnitVectors(UP, _d.normalize()));
    b.add(g, paint, (_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2, 0, 0, 0, true);
    _a.copy(_b);
  }
}

/** Gear teeth round (x, y) in the XY plane at z. */
function teeth(b: Parts, paint: Paint, x: number, y: number, z: number, r: number, n: number, size: number, depth = 0.01): void {
  for (let k = 0; k < n; k++) { const a = (k * 2 * Math.PI) / n; b.add(box(size, size, depth), paint, x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0, 0, a); }
}

/** A cog facing ±z: rim, teeth, hub and spokes. */
export function cog(b: Parts, paint: Paint, x: number, y: number, z: number, r: number, n: number, hub?: Paint): void {
  b.add(ring(r, r * 0.2, 4, Math.max(10, n)), paint, x, y, z);
  teeth(b, paint, x, y, z, r * 1.28, n, r * 0.32, r * 0.3);
  b.add(cyl(r * 0.32, r * 0.32, r * 0.35, 8), hub ?? paint, x, y, z, Math.PI / 2);
  for (let k = 0; k < 3; k++) b.add(box(r * 1.7, r * 0.16, r * 0.15), paint, x, y, z, 0, 0, (k * Math.PI) / 3);
}

type Builder = (b: Parts) => void;

// ---------------------------------------------------------------- normal bases

/** Stahlklinge (the pre-WP4 blade): a ground-down leaf spring with a wrench as crossguard. */
function stahl(b: Parts): void {
  b.add(box(0.066, 0.78, 0.014), P.steel, 0, 0.56, 0)
    .add(scaled(cone(0.036, 0.16), 1, 1, 0.22), P.steel, 0, 1.03, 0, 0, Math.PI / 4, 0)
    // Fuller and the darker spine.
    .add(box(0.018, 0.6, 0.018), P.rust, 0.012, 0.52, 0)
    .add(box(0.22, 0.034, 0.03), P.rust, 0, 0.16, 0)
    // The wrench ring sits 2 cm higher than before WP4, so the grip zone stays free (D1 envelope).
    .add(ring(0.028, 0.011), P.rust, 0.11, 0.18, 0)
    .add(cyl(0.021, 0.025, 0.25), P.wrap, 0, 0.02, 0)
    .add(ball(0.032), P.rust, 0, -0.12, 0)
    .add(box(0.072, 0.1, 0.02), GLOW, 0, 0.26, 0);
  ribbon(b, 0.13, 0.26, 0.025);
}

/** Rostige Klinge (starter): the leaf-spring blade gone to rust, nicks in the edge, a plain bar guard. */
function rohr(b: Parts): void {
  const edge: [number, number][] = [[-0.033, 0.17], [-0.033, 0.4], [-0.022, 0.42], [-0.033, 0.445], [-0.033, 0.66], [-0.025, 0.675], [-0.033, 0.695], [-0.033, 0.92], [0, 1.07], [0.033, 0.95], [0.033, 0.17]];
  b.add(flat(edge, 0.014), metal(0x6e5446), 0, 0, 0)
    .add(box(0.014, 0.7, 0.018), P.rust, 0.024, 0.53, 0)
    .add(box(0.16, 0.03, 0.03), P.iron, 0, 0.16, 0)
    .add(cyl(0.021, 0.025, 0.25), cloth(0x9a8466), 0, 0.02, 0)
    .add(cyl(0.027, 0.027, 0.03), P.iron, 0, -0.118, 0)
    .add(box(0.07, 0.1, 0.02), GLOW, 0, 0.3, 0);
  ribbon(b, 0.13, 0.24, 0.025);
}

/** Holzlatte (legacy saves, I01): a worn, dirty 5 cm board with chipped edges, nails through the top, wrapped grip. */
function latte(b: Parts): void {
  // Long nails driven through from the back (heads) or the side, points sticking far out.
  const nail = (x: number, y: number, side = false): void => {
    if (side) b.add(cyl(0.005, 0.005, 0.15, 5), P.iron, 0.05, y, x, 0, 0, Math.PI / 2).add(cyl(0.012, 0.012, 0.006, 6), P.rust, -0.027, y, x, 0, 0, Math.PI / 2);
    else b.add(cyl(0.005, 0.005, 0.14, 5), P.iron, x, y, 0.055, Math.PI / 2).add(cyl(0.012, 0.012, 0.006, 6), P.rust, x, y, -0.014, Math.PI / 2);
  };
  // A shorter board in warm wood with grain lines, chipped and split edges above the grip.
  const board: [number, number][] = [[-0.025, -0.1], [0.025, -0.1], [0.025, 0.28], [0.019, 0.31], [0.025, 0.34], [0.025, 0.55], [0.017, 0.58], [0.022, 0.62], [0.025, 0.76], [0.012, 0.8], [-0.008, 0.787], [-0.025, 0.8], [-0.025, 0.64], [-0.018, 0.61], [-0.025, 0.58], [-0.025, 0.42], [-0.02, 0.39], [-0.025, 0.36]];
  b.add(flat(board, 0.022), wood(0x9a6a3c), 0, 0, 0);
  for (const [x, y, h] of [[-0.012, 0.45, 0.6], [0.009, 0.38, 0.5], [0.017, 0.62, 0.22], [-0.004, 0.7, 0.16]] as const) b.add(box(0.0025, h, 0.0232), plain(0x5a3a20), x, y, 0);
  b.add(box(0.003, 0.2, 0.024), plain(0x241a12), 0.006, 0.52, 0)
    .add(box(0.03, 0.06, 0.0235), plain(0x5a4028), 0.006, 0.24, 0)
    .add(box(0.04, 0.08, 0.0238), plain(0x6a2416), 0, 0.68, 0)
    .add(cyl(0.03, 0.03, 0.24), cloth(0x8a7a5e), 0, 0.02, 0)
    .add(cyl(0.031, 0.031, 0.025), plain(0x3a2a1c), 0, 0.12, 0)
    .add(box(0.054, 0.08, 0.026), GLOW, 0, 0.45, 0);
  nail(-0.012, 0.66);
  nail(0.012, 0.71);
  nail(-0.008, 0.76);
  nail(0, 0.68, true);
  nail(0, 0.74, true);
}

/** Machete (I04): a blade widening to a rounded tip, dark handle with rivets. */
function machete(b: Parts): void {
  const blade: [number, number][] = [[0.022, 0.15], [0.022, 0.86], [0.018, 0.93], [0, 0.975], [-0.03, 0.995], [-0.055, 0.965], [-0.066, 0.9], [-0.06, 0.7], [-0.045, 0.45], [-0.03, 0.25], [-0.024, 0.15]];
  b.add(flat(blade, 0.01), metal(0xa49e92), 0, 0, 0)
    .add(box(0.008, 0.68, 0.013), metal(0x6a645a), 0.016, 0.5, 0)
    .add(box(0.04, 0.1, 0.0115), P.rust, -0.03, 0.78, 0)
    .add(box(0.03, 0.08, 0.0115), P.rust, -0.012, 0.52, 0)
    .add(box(0.05, 0.02, 0.024), P.steel, 0, 0.152, 0)
    .add(scaled(cyl(0.02, 0.023, 0.27), 1, 1, 0.75), wood(0x2a1d14), 0, 0.012, 0)
    .add(cyl(0.006, 0.006, 0.036, 6), P.brass, 0, -0.06, 0, Math.PI / 2)
    .add(cyl(0.006, 0.006, 0.036, 6), P.brass, 0, 0.07, 0, Math.PI / 2)
    .add(box(0.05, 0.09, 0.014), GLOW, -0.012, 0.4, 0);
}

/** Hackmesser (I90): a short, heavy cleaver with a square end and a hole at the spine. Kiezwache: blue grip, orange band. */
function brech(b: Parts, grip: Paint = wood(0x3a2416), band?: Paint, blade = 0xc4c8cc): void {
  const shape: [number, number][] = [[0.018, 0.16], [0.018, 0.51], [0.008, 0.53], [-0.118, 0.53], [-0.128, 0.515], [-0.128, 0.23], [-0.1, 0.185], [-0.03, 0.16]];
  // Silvery steel; the cutting edge gleams a faint cold white (look 2), an element tints it.
  b.add(flat(shape, 0.016, [[-0.012, 0.49, 0.014]]), bright(blade), 0, 0, 0)
    .add(box(0.008, 0.29, 0.0172), GLEAM, -0.125, 0.38, 0)
    .add(box(0.02, 0.33, 0.018), metal(0x8a8e92), 0.01, 0.35, 0)
    .add(box(0.03, 0.05, 0.0172), P.rust, -0.05, 0.44, 0)
    .add(box(0.042, 0.025, 0.03), P.steel, 0, 0.152, 0)
    .add(scaled(cyl(0.021, 0.023, 0.27), 1, 1, 0.8), grip, 0, 0.012, 0)
    .add(cyl(0.006, 0.006, 0.04, 6), P.steel, 0, -0.07, 0, Math.PI / 2)
    .add(cyl(0.006, 0.006, 0.04, 6), P.steel, 0, 0.0, 0, Math.PI / 2)
    .add(cyl(0.006, 0.006, 0.04, 6), P.steel, 0, 0.07, 0, Math.PI / 2);
  if (band) { b.add(cyl(0.024, 0.024, 0.03), band, 0, 0.12, 0); ribbon(b, 0.05, 0.2, 0.022, band); }
}

/** Two-handed hammers (Johannes, 2026-11-19): a third shorter than before WP4, the head a third bigger. */
const HEAD_Y = 0.71, HEAD_K = 4 / 3;

/** Builds head parts authored round y = 1.06 (the pre-WP4 head) at the shorter hammer's head, a third bigger. */
function head(b: Parts, parts: () => void, k = HEAD_K): void {
  b.frame(new Matrix4().makeTranslation(0, HEAD_Y, 0).multiply(new Matrix4().makeScale(k, k, k)).multiply(new Matrix4().makeTranslation(0, -1.06, 0)), parts);
}

/** Handle, grip wrap and left-hand wrap of a two-handed hammer (handle from −0.13 into the head). */
function handle2(b: Parts, shaft: Paint, wrap: Paint = P.wrap, wrapR = 0.031): void {
  b.add(cyl(0.024, 0.03, 0.84), shaft, 0, 0.29, 0)
    .add(cyl(wrapR, wrapR, 0.28), wrap, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.12), wrap, 0, 0.48, 0);
}

/** Vorschlaghammer (I06): a sledge, the head a lump of rail steel with bands. */
function vorschlag(b: Parts): void {
  handle2(b, P.wood);
  head(b, () => {
    b.add(box(0.34, 0.2, 0.2), P.steel, 0, 1.06, 0)
      .add(box(0.06, 0.225, 0.225), P.rust, -0.1, 1.06, 0)
      .add(box(0.06, 0.225, 0.225), P.rust, 0.1, 1.06, 0)
      .add(box(0.345, 0.05, 0.21), GLOW, 0, 1.06, 0);
  });
  b.add(cyl(0.034, 0.034, 0.04), P.rust, 0, 0.585, 0);
  ribbon(b, 0.26, 0.24, 0.026);
}

/** Pflasterhammer (I07), one-handed and half as long: a big square face on one side, a curved pick on the other. */
function pflaster(b: Parts): void {
  const pick: [number, number][] = [[-0.04, 0.59], [-0.12, 0.592], [-0.2, 0.578], [-0.27, 0.545], [-0.335, 0.47], [-0.25, 0.5], [-0.18, 0.512], [-0.11, 0.49], [-0.04, 0.47]];
  b.add(cyl(0.022, 0.027, 0.64), wood(0xa07a4a), 0, 0.19, 0)
    .add(cyl(0.029, 0.029, 0.25), P.wrap, 0, 0.0, 0)
    .add(box(0.09, 0.12, 0.1), P.iron, 0, 0.53, 0)
    .add(box(0.14, 0.14, 0.14), metal(0x8a8278), 0.11, 0.53, 0)
    .add(box(0.026, 0.155, 0.155), P.rust, 0.19, 0.53, 0)
    .add(flat(pick, 0.05), metal(0x8a8278), 0, 0, 0)
    .add(box(0.2, 0.012, 0.03), metal(0xb4b0a8), -0.16, 0.57, 0, 0, 0, -0.12)
    .add(cyl(0.034, 0.034, 0.05), P.rust, 0, 0.45, 0)
    .add(box(0.095, 0.124, 0.104), GLOW, -0.005, 0.53, 0);
}

/** Rohrzange (I08), one-handed and half as long: a red handle widening toward a thick fixed hook jaw and a sliding jaw on a knurled nut. */
function zange(b: Parts): void {
  const red = metal(0xa83224), dark = metal(0x7a2418);
  // Wider at its end (look 2) and toward the jaw, narrow where the hand holds it.
  const handle: [number, number][] = [[-0.03, -0.13], [0.03, -0.13], [0.026, -0.1], [0.023, -0.05], [0.024, 0.14], [0.032, 0.34], [0.036, 0.43], [-0.036, 0.43], [-0.032, 0.34], [-0.024, 0.14], [-0.023, -0.05], [-0.026, -0.1]];
  b.add(flat(handle, 0.03), red, 0, 0, 0)
    .add(cyl(0.03, 0.03, 0.03, 12), red, 0, -0.13, 0, Math.PI / 2)
    .add(cyl(0.012, 0.012, 0.032, 8), P.iron, 0, -0.125, 0, Math.PI / 2)
    .add(box(0.012, 0.3, 0.034), dark, 0, 0.26, 0)
    .add(box(0.06, 0.24, 0.07), P.steel, -0.005, 0.54, 0)
    .add(box(0.21, 0.08, 0.085), P.steel, -0.09, 0.62, 0)
    .add(box(0.055, 0.1, 0.085), P.steel, -0.17, 0.58, 0)
    .add(box(0.14, 0.016, 0.087), P.iron, -0.1, 0.574, 0)
    .add(box(0.17, 0.065, 0.085), P.steel, -0.08, 0.49, 0)
    .add(box(0.14, 0.016, 0.087), P.iron, -0.1, 0.527, 0)
    .add(cyl(0.046, 0.046, 0.065, 10), P.iron, -0.005, 0.44, 0)
    .add(ring(0.046, 0.007, 4, 12), P.steel, -0.005, 0.44, 0, Math.PI / 2)
    .add(box(0.05, 0.07, 0.034), GLOW, 0, 0.3, 0);
}

/** Paints of a forked slingshot; set variants and the legendary forks swap them. */
interface ForkPaint { arm: Paint; wrap: Paint; band: Paint; rubber: Paint; pouch: Paint }
const FORK: ForkPaint = { arm: P.wood, wrap: P.wrap, band: P.red, rubber: P.rubber, pouch: P.leather };
/** Fork geometry (two thirds of the pre-WP4 size): crotch height, fork tips (±x, y), the pouch behind. */
const CROTCH = 0.155, TIP_X = 0.085, TIP_Y = 0.295, POUCH: [number, number, number] = [0, 0.19, -0.05];
const ARM_LEN = Math.hypot(TIP_X, TIP_Y - CROTCH), ARM_RZ = Math.atan2(TIP_X, TIP_Y - CROTCH);
/** A point at fraction t along the arm on side sx (±1). */
const armAt = (sx: number, t: number): [number, number] => [sx * TIP_X * t, CROTCH + (TIP_Y - CROTCH) * t];

/** Jagdzwille (I09): a forked slingshot cut from a branch, bicycle tube bands from the tips to the pouch. */
function fork(b: Parts, f: ForkPaint = FORK, arms = true): void {
  // Handle a third shorter (look 2): from −0.02, still a hand's width below the crotch.
  b.add(cyl(0.021, 0.025, 0.175), f.arm, 0, 0.0675, 0)
    .add(ball(0.024, 8, 4), f.arm, 0, -0.02, 0)
    .add(cyl(0.023, 0.023, 0.1), f.wrap, 0, 0.035, 0)
    .add(cyl(0.025, 0.025, 0.025), f.band, 0, 0.115, 0);
  if (arms) for (const sx of [-1, 1]) b.add(cyl(0.013, 0.017, ARM_LEN + 0.02, 7), f.arm, (sx * TIP_X) / 2, (CROTCH + TIP_Y) / 2, 0, 0, 0, -sx * ARM_RZ);
  // Bands hang from the tips in a curve to the pouch below them.
  for (const sx of [-1, 1]) cord(b, [sx * TIP_X, TIP_Y, 0], [sx * 0.032, POUCH[1], POUCH[2]], 0.045, 0.007, f.rubber, 4);
  b.add(scaled(new SphereGeometry(0.042, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 1, 0.6, 0.45), f.pouch, ...POUCH, 0, 0, 0, true)
    .add(ball(0.018), GLOW, POUCH[0], POUCH[1], POUCH[2] + 0.004);
}

/** Nagelwerfer (I10): the fork with an iron plate and a pouch of nails on one arm (the grip stays free). */
function nagel(b: Parts): void {
  fork(b, { ...FORK, arm: wood(0x8a6038) });
  const [x, y] = armAt(1, 0.45);
  b.add(cyl(0.024, 0.024, 0.03), P.iron, 0, 0.165, 0)
    .add(box(0.026, 0.04, 0.03), P.iron, ...armAt(1, 0.8), 0, 0, 0, -ARM_RZ)
    .add(box(0.05, 0.06, 0.04), P.leather, x + 0.035, y - 0.02, 0)
    .add(box(0.053, 0.01, 0.043), P.iron, x + 0.035, y + 0.008, 0);
  for (const [dx, dz] of [[-0.012, -0.008], [0.004, 0.01], [0.016, -0.004], [-0.002, 0.012]] as const) b.add(cyl(0.005, 0.005, 0.026, 6), P.steel, x + 0.035 + dx, y + 0.02, dz);
}

/** Steinschleuder (I11): a short rope sling, two hanging cords from a knotted grip to a leather cradle with a stone. */
function stein(b: Parts): void {
  const rope = cloth(0x8a6a4a);
  b.add(cyl(0.02, 0.022, 0.1), P.leather, 0, 0, 0)
    .add(ring(0.022, 0.006, 4, 10), rope, 0, -0.075, 0)
    .add(cyl(0.024, 0.024, 0.025), GLOW, 0, 0.065, 0);
  for (const sx of [-1, 1]) cord(b, [sx * 0.01, 0.05, 0], [sx * 0.055, 0.215, 0], 0.02, 0.006, rope, 5);
  for (const sx of [-1, 1]) cord(b, [sx * 0.012, 0.06, 0.004], [sx * 0.058, 0.212, 0.004], 0.018, 0.004, rope, 4);
  b.add(scaled(new SphereGeometry(0.05, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 1.3, 0.6, 0.8), P.leather, 0, 0.245, 0, 0, 0, 0, true)
    .add(new IcosahedronGeometry(0.032, 0), stone(0x8a8478), 0, 0.245, 0);
}

/** Rohrspeer (I12): the bayonet on a thick rusty steel pipe, lashed with wire. */
function rspeer(b: Parts): void {
  b.add(cyl(0.027, 0.03, 1.95, 10), metal(0x7d7a74), 0, 0.42, 0)
    .add(scaled(cone(0.05, 0.42), 1, 1, 0.3), P.steel, 0, 1.6, 0, 0, Math.PI / 4, 0)
    .add(cyl(0.034, 0.03, 0.16, 10), P.rust, 0, 1.36, 0)
    .add(box(0.16, 0.024, 0.024), P.rust, 0, 1.31, 0)
    .add(cyl(0.032, 0.032, 0.06), GLOW, 0, 1.25, 0)
    .add(cyl(0.032, 0.032, 0.3), P.wrap, 0, 0.02, 0)
    .add(cyl(0.032, 0.032, 0.05), P.wrap, 0, 0.78, 0)
    .add(cyl(0.032, 0.032, 0.05), P.wrap, 0, 1.06, 0)
    .add(ring(0.027, 0.005, 4, 10), P.rust, 0, -0.553, 0, Math.PI / 2);
  ribbon(b, 1.18, 0.34, 0.03);
}

/** Fahnenstange (I13): a wooden pole, a long torn red flag low on the pole, a long light tip. */
function fahne(b: Parts): void {
  const flag: [number, number][] = [[-0.015, 1.3], [-0.31, 1.28], [-0.26, 1.2], [-0.33, 1.12], [-0.24, 1.06], [-0.3, 0.97], [-0.2, 0.92], [-0.24, 0.84], [-0.13, 0.86], [-0.1, 0.78], [-0.015, 0.8]];
  const rag: [number, number][] = [[-0.015, 1.42], [-0.13, 1.39], [-0.09, 1.3], [-0.015, 1.34]];
  b.add(cyl(0.018, 0.021, 2.12), wood(0x8a6a44), 0, 0.46, 0)
    .add(scaled(cone(0.03, 0.32), 1, 1, 0.5), P.steel, 0, 1.65, 0, 0, Math.PI / 4, 0)
    .add(cyl(0.024, 0.024, 0.05), P.brass, 0, 1.49, 0)
    .add(flat(flag, 0.004), plain(0xc23a2e), 0, 0, 0, 0, 0, 0, true)
    .add(flat(rag, 0.004), plain(0xd6cfc0), 0, 0, 0, 0, 0, 0, true)
    .add(cyl(0.024, 0.024, 0.03), P.wrap, 0, 1.3, 0)
    .add(cyl(0.024, 0.024, 0.03), P.wrap, 0, 0.8, 0)
    .add(cyl(0.025, 0.025, 0.3), P.wrap, 0, 0.02, 0)
    .add(cyl(0.026, 0.026, 0.05), GLOW, 0, 1.42, 0)
    .add(cone(0.022, 0.08, 6), P.iron, 0, -0.62, 0, Math.PI, 0, 0);
}

/** Harpune (I14): a dark shaft, a short wide barbed head, a long rope tied below it and coiled. */
function harpune(b: Parts): void {
  const tip: [number, number][] = [[0, 1.81], [0.075, 1.7], [0.064, 1.62], [0.02, 1.665], [0.012, 1.6], [-0.012, 1.6], [-0.02, 1.665], [-0.064, 1.62], [-0.075, 1.7]];
  const rope = cloth(0xc9a878);
  b.add(cyl(0.02, 0.023, 2.0), wood(0x4a4038), 0, 0.44, 0)
    .add(flat(tip, 0.012), P.steel, 0, 0, 0)
    .add(box(0.01, 0.17, 0.016), metal(0xb8bcc0), 0, 1.69, 0)
    .add(cyl(0.012, 0.016, 0.12), P.steel, 0, 1.55, 0)
    .add(cyl(0.026, 0.024, 0.05), P.iron, 0, 1.48, 0)
    .add(ring(0.027, 0.006, 4, 12), rope, 0, 1.43, 0, Math.PI / 2, 0, 0, true)
    .add(ring(0.032, 0.007, 4, 12), rope, 0, 0.64, 0, Math.PI / 2, 0, 0, true)
    .add(ring(0.032, 0.007, 4, 12), rope, 0, 0.66, 0, Math.PI / 2, 0, 0, true)
    .add(ring(0.032, 0.007, 4, 12), rope, 0, 0.68, 0, Math.PI / 2, 0, 0, true)
    .add(cyl(0.026, 0.026, 0.3), P.wrap, 0, 0.02, 0)
    .add(cyl(0.024, 0.024, 0.04), P.iron, 0, -0.58, 0)
    .add(cyl(0.027, 0.027, 0.05), GLOW, 0, 1.3, 0);
  cord(b, [0.028, 1.43, 0], [0.07, 1.1, 0.01], 0.06, 0.006, rope, 5);
  cord(b, [0.07, 1.1, 0.01], [0.03, 0.7, 0], 0.08, 0.006, rope, 5);
}

// ---------------------------------------------------------------- neon (Mitte) and GDR families

/** Leuchtröhre (I59), a third shorter: a fluorescent tube in metal caps on a back strip, clips and tape, dark grip. */
function leucht(b: Parts): void {
  b.add(cyl(0.022, 0.024, 0.25), P.rubber, 0, 0.015, 0)
    .add(cyl(0.028, 0.028, 0.04), P.iron, 0, -0.125, 0)
    .add(ring(0.028, 0.004, 4, 10), P.steel, 0, -0.105, 0, Math.PI / 2)
    .add(cyl(0.032, 0.03, 0.07, 10), P.iron, 0, 0.18, 0)
    .add(ring(0.032, 0.004, 4, 12), P.steel, 0, 0.2, 0, Math.PI / 2)
    .add(cyl(0.012, 0.012, 0.05, 8), plain(0x2a2a30), 0.035, 0.18, 0, 0, 0, Math.PI / 2)
    .add(cyl(0.024, 0.024, 0.53, 12), GLOW, 0, 0.47, 0)
    .add(box(0.008, 0.52, 0.01), P.iron, 0, 0.47, -0.03)
    .add(cyl(0.027, 0.027, 0.03, 10), P.wrap, 0, 0.34, 0)
    .add(cyl(0.027, 0.027, 0.03, 10), P.wrap, 0, 0.58, 0)
    .add(cyl(0.031, 0.028, 0.06, 10), P.iron, 0, 0.73, 0)
    .add(ring(0.031, 0.004, 4, 12), P.steel, 0, 0.72, 0, Math.PI / 2)
    .add(cyl(0.004, 0.004, 0.035, 4), P.steel, -0.01, 0.775, 0)
    .add(cyl(0.004, 0.004, 0.035, 4), P.steel, 0.01, 0.775, 0);
  for (const y of [0.3, 0.64]) b.add(box(0.06, 0.012, 0.01), P.steel, 0, y, -0.02).add(ring(0.026, 0.004, 4, 10), P.steel, 0, y, 0, Math.PI / 2);
  cord(b, [0.033, 0.18, 0], [0.028, 0.73, 0.006], 0.0, 0.003, plain(0x2a2a30), 4);
  ribbon(b, -0.1, 0.18, 0.024);
}

/** Boxenhammer (I60): a speaker cabinet as the big head (two-handed rule), the cone rims and level bars glow magenta. */
function boxh(b: Parts): void {
  handle2(b, wood(0x5a3a26));
  head(b, () => {
    b.add(box(0.3, 0.24, 0.2), wood(0x3a2a20), 0, 1.06, 0)
      .add(box(0.31, 0.025, 0.21), P.iron, 0, 1.17, 0)
      .add(box(0.31, 0.025, 0.21), P.iron, 0, 0.95, 0);
    for (const x of [-0.15, 0.15]) for (const y of [0.95, 1.17]) for (const z of [-0.1, 0.1]) b.add(box(0.025, 0.03, 0.025), P.brass, x, y, z);
    for (const z of [1, -1]) {
      // Woofer, tweeter and dust caps in glowing rims, three level bars beside them.
      b.add(cyl(0.07, 0.07, 0.008, 12), P.rubber, -0.045, 1.04, z * 0.102, Math.PI / 2)
        .add(cyl(0.048, 0.048, 0.01, 10), plain(0x3a3430), -0.045, 1.04, z * 0.104, Math.PI / 2)
        .add(ring(0.075, 0.008, 4, 12), GLOW, -0.045, 1.04, z * 0.104)
        .add(scaled(ball(0.022, 8, 4), 1, 1, 0.5), P.iron, -0.045, 1.04, z * 0.108)
        .add(cyl(0.022, 0.022, 0.01, 10), P.rubber, 0.095, 1.12, z * 0.104, Math.PI / 2)
        .add(ring(0.024, 0.004, 4, 8), GLOW, 0.095, 1.12, z * 0.106);
      for (const [x, h] of [[0.07, 0.05], [0.095, 0.08], [0.12, 0.06]] as const) b.add(box(0.014, h, 0.006), GLOW, x, 0.98 + h / 2, z * 0.101);
    }
    // The cabinet's sides (look 2): a vent grille of slats, an input plate with two jacks and a knob.
    for (const sx of [1, -1]) {
      const x = sx * 0.151;
      for (let k = 0; k < 3; k++) b.add(box(0.006, 0.014, 0.15), P.iron, x, 1.0 + k * 0.035, 0.0);
      b.add(box(0.004, 0.05, 0.09), metal(0x8a8a94), x, 1.135, 0)
        .add(cyl(0.008, 0.008, 0.012, 6), P.rubber, x + sx * 0.004, 1.135, -0.025, 0, 0, Math.PI / 2)
        .add(cyl(0.008, 0.008, 0.012, 6), P.rubber, x + sx * 0.004, 1.135, 0.0, 0, 0, Math.PI / 2)
        .add(cyl(0.011, 0.011, 0.014, 8), P.brass, x + sx * 0.005, 1.135, 0.028, 0, 0, Math.PI / 2);
    }
  });
  b.add(cyl(0.036, 0.036, 0.04), P.iron, 0, 0.56, 0);
  cord(b, [0.2, 0.75, 0.06], [0.2, 0.62, -0.06], 0.05, 0.005, plain(0xbd2b77), 4);
  ribbon(b, 0.26, 0.24, 0.026);
}

/**
 * Neonflinte (I61, look 2): an assault rifle in the AK shape with a neon coil. The pistol grip sits in the
 * hand at the origin; the barrel runs along −Z, where `Pistol_Idle_Loop` and `Pistol_Shoot` point the hand
 * (step 1c: thrown on the sling clip, a gun pointed at the ground, so this base shoots from pistol clips).
 */
function neonfl(b: Parts): void {
  const steel = metal(0x3a3a40), wood2 = wood(0x7a4a2a), coil = GLOW;
  // Pistol grip, slightly raked, then the receiver on top with its dust cover and rear sight.
  b.add(box(0.032, 0.13, 0.05), P.rubber, 0, 0.0, 0.006, -0.18, 0, 0)
    .add(box(0.05, 0.075, 0.26), steel, 0, 0.1, 0.0)
    .add(box(0.046, 0.02, 0.24), metal(0x5a5a62), 0, 0.145, 0.0)
    .add(box(0.012, 0.02, 0.025), steel, 0, 0.16, -0.08)
    // Trigger guard and trigger.
    .add(scaled(ring(0.022, 0.004, 4, 10), 1, 0.8, 1), steel, 0, 0.055, -0.04, 0, Math.PI / 2, 0)
    .add(box(0.006, 0.025, 0.008), steel, 0, 0.06, -0.035)
    // Stock: a plate sloping back and down, a butt plate.
    .add(box(0.04, 0.05, 0.24), wood2, 0, 0.075, 0.23, 0.22, 0, 0)
    .add(box(0.042, 0.11, 0.03), wood2, 0, 0.035, 0.35, 0.22, 0, 0)
    .add(box(0.044, 0.112, 0.008), P.rubber, 0, 0.031, 0.368, 0.22, 0, 0)
    // Curved magazine in front of the trigger guard.
    .add(box(0.03, 0.07, 0.05), steel, 0, 0.035, -0.1, -0.15, 0, 0)
    .add(box(0.03, 0.07, 0.05), steel, 0, -0.03, -0.12, -0.45, 0, 0)
    .add(box(0.03, 0.055, 0.05), steel, 0, -0.08, -0.15, -0.75, 0, 0)
    // Handguard (wood) round the barrel, gas tube above, barrel, front sight, muzzle.
    .add(box(0.048, 0.05, 0.15), wood2, 0, 0.095, -0.205)
    .add(box(0.03, 0.022, 0.17), wood2, 0, 0.14, -0.2)
    .add(cyl(0.012, 0.012, 0.34, 8), steel, 0, 0.1, -0.4, Math.PI / 2)
    .add(cyl(0.008, 0.008, 0.16, 6), steel, 0, 0.128, -0.36, Math.PI / 2)
    .add(box(0.012, 0.05, 0.02), steel, 0, 0.13, -0.5)
    .add(box(0.006, 0.02, 0.006), steel, 0, 0.165, -0.5)
    .add(cyl(0.017, 0.017, 0.05, 8), steel, 0, 0.1, -0.565, Math.PI / 2)
    // Neon: a coil along the barrel and a strip on the receiver side.
    .add(box(0.054, 0.012, 0.18), coil, 0, 0.1, 0.0);
  for (let k = 0; k < 7; k++) b.add(ring(0.02, 0.0045, 4, 10), coil, 0, 0.1, -0.3 - k * 0.025, 0, 0, 0);
}

/** Mikroständer (I62): a thin dark stand tube, the mic capsule as the tip, a clamp, cable, magenta bands, a spike at the foot. */
function mikro(b: Parts): void {
  const dark = metal(0x2a2a2e), cable = plain(0x1a1a1e);
  // Look 2: shorter (tip 1.6), the mic head wider.
  b.add(cyl(0.014, 0.016, 1.95), metal(0x3a3a40), 0, 0.375, 0)
    .add(cyl(0.022, 0.016, 0.08, 8), P.iron, 0, 1.38, 0)
    .add(cyl(0.04, 0.022, 0.06, 10), P.iron, 0, 1.445, 0)
    .add(scaled(ball(0.062, 12, 8), 1, 1.05, 1), dark, 0, 1.535, 0)
    .add(ring(0.062, 0.007, 4, 16), metal(0x8a8a94), 0, 1.535, 0, Math.PI / 2)
    .add(ring(0.055, 0.005, 4, 14), metal(0x8a8a94), 0, 1.57, 0, Math.PI / 2)
    .add(ring(0.055, 0.005, 4, 14), metal(0x8a8a94), 0, 1.5, 0, Math.PI / 2)
    .add(cyl(0.02, 0.02, 0.04), GLOW, 0, 1.3, 0)
    .add(cyl(0.019, 0.019, 0.03), GLOW, 0, 0.92, 0)
    .add(cyl(0.026, 0.026, 0.06, 10), P.iron, 0, 1.1, 0)
    .add(cyl(0.008, 0.008, 0.05, 6), P.steel, 0.04, 1.1, 0, 0, 0, Math.PI / 2)
    .add(ball(0.014, 6, 4), plain(0x2a2a30), 0.068, 1.1, 0)
    .add(cyl(0.024, 0.024, 0.3), P.rubber, 0, 0.02, 0)
    .add(cone(0.03, 0.12, 4), P.steel, 0, -0.6, 0, Math.PI, 0, 0);
  cord(b, [0.02, 1.6, 0], [0.03, 1.2, 0.01], 0.05, 0.005, cable, 4);
  cord(b, [0.03, 1.2, 0.01], [0.022, 0.65, 0], 0.06, 0.005, cable, 5);
  for (const y of [1.3, 0.8]) b.add(ring(0.03, 0.004, 4, 10), plain(0xbd2b77), 0, y, 0, Math.PI / 2.4, 0, 0, true);
  ribbon(b, 1.38, 0.26, 0.016);
}

/** Sichel (I71), smaller: a short wooden handle, red ferrule, a thick crescent blade with a bright edge. */
function sichel(b: Parts): void {
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / n) * (Math.PI / 180); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  // Outer arc from the neck over the left and the top to the tip, inner arc back.
  const blade = [...arc(0.09, 0.42, 0.29, -110, -350, 14), ...arc(0.12, 0.43, 0.225, -352, -122, 12)];
  const edge = [...arc(0.12, 0.43, 0.238, -125, -345, 12), ...arc(0.12, 0.43, 0.225, -345, -125, 12)];
  b.add(cyl(0.022, 0.025, 0.24), wood(0x7a5030), 0, 0.0, 0)
    .add(cyl(0.024, 0.02, 0.03), wood(0x5a3a22), 0, -0.13, 0)
    .add(cyl(0.026, 0.026, 0.05), plain(0xaf4237), 0, 0.15, 0)
    .add(cyl(0.005, 0.005, 0.06, 6), P.brass, 0, 0.15, 0, Math.PI / 2)
    .add(box(0.022, 0.06, 0.016), P.steel, 0.004, 0.19, 0)
    .add(flat(blade, 0.018), bright(0xc4c8cc), 0, 0, 0)
    .add(flat(edge, 0.02), bright(0xeceef0), 0, 0, 0)
    .add(box(0.05, 0.026, 0.02), GLOW, -0.15, 0.32, 0, 0, 0, 0.9);
}

/** Werkhammer (I72): a big blue enamel head (two-handed rule) with a brass cog emblem and an orange centre, black rubber grip. */
function werkh(b: Parts): void {
  // Look 2: thicker rubber grip (0.036, the widest the hand takes), shinier enamel and steel.
  handle2(b, wood(0x6a4a30), P.rubber, 0.036);
  b.add(cyl(0.037, 0.037, 0.03), P.brass, 0, 0.175, 0)
    .add(cyl(0.035, 0.035, 0.04), P.brass, 0, 0.58, 0);
  head(b, () => {
    b.add(box(0.31, 0.2, 0.2), bright(0x4a78b8), 0, 1.06, 0)
      .add(box(0.03, 0.215, 0.215), bright(0xc8ccd0), -0.16, 1.06, 0)
      .add(box(0.03, 0.215, 0.215), bright(0xc8ccd0), 0.16, 1.06, 0)
      .add(box(0.026, 0.205, 0.205), GLOW, 0.13, 1.06, 0);
    // Striking faces: a raised square plate with a chamfer ring and four bolts.
    for (const sx of [-1, 1]) {
      b.add(box(0.012, 0.16, 0.16), bright(0xdadde0), sx * 0.181, 1.06, 0)
        .add(box(0.006, 0.12, 0.12), metal(0x9a9ea4), sx * 0.19, 1.06, 0);
      for (const y of [0.98, 1.14]) for (const z of [-0.08, 0.08]) b.add(ball(0.008, 5, 3), P.brass, sx * 0.176, y, z);
    }
    for (const z of [1, -1]) {
      cog(b, P.brass, -0.02, 1.06, z * 0.104, 0.05, 10, plain(0xe7982b));
      b.add(box(0.26, 0.012, 0.004), P.brass, 0, 1.15, z * 0.101).add(box(0.26, 0.012, 0.004), P.brass, 0, 0.97, z * 0.101);
    }
  });
}

/** Aufziehwerfer (I73): a blue enamel fork with red tips, a brass clockwork (two cogs), a wind-up key and a spring; it glows. */
function aufzieh(b: Parts): void {
  fork(b, { ...FORK, arm: P.enamel, wrap: P.leather, band: P.brass, pouch: plain(0x7a5a3a) });
  for (const sx of [-1, 1]) b.add(cyl(0.02, 0.02, 0.025), P.red, ...armAt(sx, 0.92), 0, 0, 0, -sx * ARM_RZ);
  cog(b, P.brass, 0, 0.2, 0.024, 0.032, 10, GLOW);
  cog(b, metal(0xc8a050), 0.036, 0.165, 0.03, 0.017, 6);
  b.add(ball(0.024, 8, 6), P.brass, 0, -0.03, 0)
    .add(cyl(0.006, 0.006, 0.06, 6), P.brass, 0.06, 0.2, 0.02, 0, 0, Math.PI / 2)
    .add(ring(0.016, 0.006, 4, 8), P.brass, 0.1, 0.2, 0.02)
    .add(ring(0.016, 0.006, 4, 8), P.brass, 0.1, 0.2, 0.02, 0, Math.PI / 2, 0);
  for (let k = 0; k < 2; k++) b.add(ring(0.024, 0.003, 3, 8), metal(0xc8a050), 0, 0.167 + k * 0.008, -0.012, Math.PI / 2, 0, 0);
}

/** Zeigerlanze (I74): a thick blue enamel shaft with brass fittings, two meshing cogs, a wide silver clock hand as the tip. */
function zeiger(b: Parts): void {
  const hand: [number, number][] = [[-0.014, 1.42], [-0.045, 1.58], [-0.016, 1.635], [-0.055, 1.69], [0, 1.81], [0.055, 1.69], [0.016, 1.635], [0.045, 1.58], [0.014, 1.42]];
  b.add(cyl(0.026, 0.028, 2.0, 10), P.enamel, 0, 0.42, 0)
    .add(flat(hand, 0.012), metal(0xc8ccd4), 0, 0, 0)
    .add(box(0.008, 0.3, 0.014), metal(0x8a8e96), 0, 1.6, 0)
    .add(ring(0.026, 0.007, 4, 12), P.brass, 0, 1.63, 0)
    .add(cyl(0.031, 0.031, 0.05, 10), P.brass, 0, 1.4, 0)
    .add(cyl(0.031, 0.031, 0.04, 10), P.brass, 0, 0.21, 0)
    .add(cyl(0.031, 0.031, 0.04, 10), P.brass, 0, 1.0, 0)
    .add(cyl(0.031, 0.031, 0.04, 10), P.brass, 0, 0.7, 0)
    .add(cyl(0.03, 0.03, 0.05, 10), GLOW, 0, 1.18, 0)
    .add(cyl(0.032, 0.032, 0.3), P.leather, 0, 0.02, 0)
    .add(cone(0.026, 0.08, 6), P.brass, 0, -0.62, 0, Math.PI, 0, 0);
  cog(b, P.brass, 0, 1.3, 0.0, 0.05, 12, plain(0xe7982b));
  cog(b, metal(0xc8a050), 0.07, 1.24, 0.012, 0.026, 8);
}

// ---------------------------------------------------------------- legendary and set

/** Fernsehturm-Splitter (I15), a quarter shorter: a glass shard with a faint white glow, an iron claw, the tower sphere as pommel. */
function turm(b: Parts): void {
  const k = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [x, 0.2 + (y - 0.2) * 0.72]);
  const shard = k([[-0.03, 0.2], [-0.05, 0.45], [-0.075, 0.62], [-0.048, 0.8], [-0.064, 0.92], [-0.012, 1.08], [0.022, 0.98], [0.066, 0.86], [0.052, 0.66], [0.074, 0.5], [0.036, 0.3], [0.03, 0.2]]);
  const core = k([[-0.012, 0.28], [-0.03, 0.6], [-0.008, 0.98], [0.026, 0.64], [0.014, 0.28]]);
  b.add(flat(shard, 0.02), metal(0x9cc4e4), 0, 0, 0)
    .add(flat(core, 0.024), GLOW_WHITE, 0, 0, 0)
    .add(box(0.085, 0.05, 0.04), P.iron, 0, 0.17, 0)
    .add(box(0.016, 0.11, 0.03), P.iron, -0.042, 0.23, 0, 0, 0, 0.2)
    .add(box(0.016, 0.11, 0.03), P.iron, 0.042, 0.23, 0, 0, 0, -0.2)
    .add(box(0.006, 0.08, 0.032), GLOW, -0.042, 0.24, 0, 0, 0, 0.2)
    .add(box(0.006, 0.08, 0.032), GLOW, 0.042, 0.24, 0, 0, 0, -0.2)
    .add(cyl(0.024, 0.026, 0.26), P.wrap, 0, 0.015, 0)
    .add(cyl(0.027, 0.027, 0.04), P.red, 0, 0.1, 0)
    .add(ball(0.034, 10, 8), metal(0xb8bcc4), 0, -0.15, 0)
    .add(cyl(0.035, 0.035, 0.01, 10), plain(0x2a3a4a), 0, -0.15, 0)
    .add(cyl(0.004, 0.004, 0.06, 4), P.steel, 0, -0.205, 0);
  ribbon(b, 0.06, 0.22, 0.026);
}

/** Klinge der Zitadelle (I51), a quarter shorter: a straight knight sword, brass guard and pommel, a cyan gem in the guard. */
function zitklinge(b: Parts): void {
  const blade: [number, number][] = [[-0.032, 0.18], [-0.03, 0.7], [0, 0.86], [0.03, 0.7], [0.032, 0.18]];
  b.add(flat(blade, 0.012), metal(0xa8a090), 0, 0, 0)
    .add(box(0.012, 0.48, 0.0135), metal(0x6a645a), 0, 0.44, 0)
    .add(box(0.21, 0.03, 0.034), P.brass, 0, 0.168, 0)
    .add(ball(0.02, 8, 6), P.brass, -0.105, 0.168, 0)
    .add(ball(0.02, 8, 6), P.brass, 0.105, 0.168, 0)
    .add(ring(0.026, 0.007, 4, 12), P.brass, 0, 0.168, 0)
    .add(ball(0.019, 8, 6), GLOW, 0, 0.168, 0)
    .add(cyl(0.019, 0.022, 0.24), plain(0x7a2a1e), 0, 0.02, 0)
    .add(ring(0.021, 0.004, 4, 10), P.brass, 0, 0.0, 0, Math.PI / 2)
    .add(ring(0.021, 0.004, 4, 10), P.brass, 0, 0.08, 0, Math.PI / 2)
    .add(ball(0.03, 10, 8), P.brass, 0, -0.13, 0);
}

/** Chipped paint (look 2): a patch broken into small pieces with gaps, on a face at z (sign = side). */
function chips(b: Parts, x: number, y: number, w: number, h: number, z: number, hex: number, seed: number): void {
  const r = new Rng(seed), n = 3;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (r.next() < 0.28) continue;
    const cw = (w / n) * r.range(0.6, 0.95), ch = (h / n) * r.range(0.6, 0.95);
    b.add(box(cw, ch, 0.004), plain(hex), x - w / 2 + (i + 0.5) * (w / n) + r.range(-0.004, 0.004), y - h / 2 + (j + 0.5) * (h / n) + r.range(-0.004, 0.004), z, 0, 0, r.range(-0.2, 0.2));
  }
}

/** Hairline cracks: thin dark strips on both faces at ±z. */
function cracks(b: Parts, z: number, lines: ReadonlyArray<readonly [number, number, number, number]>): void {
  for (const [x, y, len, rz] of lines) for (const sz of [1, -1]) b.add(box(len, 0.004, 0.003), plain(0x2a2622), x, y, sz * z, 0, 0, rz);
}

/** Mauerbrecher (I16): a big, rugged slab of Wall concrete with graffiti, rebar ends and acid green cracks. */
function mauer(b: Parts): void {
  const c = stone(0xb8b0a0), c2 = stone(0x9a9488);
  handle2(b, wood(0x5a3a26));
  b.add(box(0.06, 0.05, 0.1), P.iron, 0, 0.6, 0);
  head(b, () => {
    b.add(box(0.32, 0.22, 0.14), c, 0, 1.06, 0)
      .add(box(0.09, 0.07, 0.12), c, 0.13, 1.14, 0, 0, 0, 0.25)
      .add(box(0.08, 0.07, 0.13), c2, -0.15, 1.01, 0, 0, 0, 0.4)
      .add(box(0.07, 0.06, 0.15), c2, 0.16, 1.0, 0.0, 0.2, 0, -0.3)
      .add(box(0.1, 0.05, 0.12), c2, -0.06, 1.16, 0.01, 0, 0.2, 0.15)
      .add(box(0.16, 0.016, 0.146), GLOW, 0.0, 1.05, 0, 0, 0, 0.3)
      .add(box(0.11, 0.016, 0.146), GLOW, -0.09, 1.1, 0, 0, 0, -0.7)
      .add(box(0.08, 0.014, 0.146), GLOW, 0.1, 0.99, 0, 0, 0, -0.4);
    for (const [x, y, z] of [[-0.18, 1.12, 0.02], [0.19, 1.02, -0.02], [0.18, 1.09, 0.03], [-0.17, 1.0, -0.03]] as const) b.add(cyl(0.007, 0.007, 0.08, 5), P.rust, x, y, z, 0, 0, Math.PI / 2 + x);
    // Look 2: graffiti as chipped paint, small fragments on the broken edges, cracks.
    chips(b, -0.07, 1.1, 0.08, 0.07, 0.071, 0xd4537e, 3);
    chips(b, 0.06, 1.0, 0.07, 0.05, 0.071, 0x7d9bff, 5);
    chips(b, 0.09, 1.12, 0.08, 0.06, 0.071, 0xe0702a, 7);
    chips(b, 0.06, 1.1, 0.1, 0.06, -0.071, 0xe8c23a, 11);
    chips(b, -0.08, 1.02, 0.06, 0.08, -0.071, 0xd4537e, 13);
    for (const [x, y, z, k] of [[-0.17, 1.16, 0.05, 0.03], [0.17, 0.96, -0.04, 0.025], [0.14, 1.18, 0.04, 0.02], [-0.16, 0.95, 0.03, 0.022], [0.0, 1.175, -0.05, 0.02]] as const) b.add(box(k, k * 0.8, k), stone(0xa49c8c), x, y, z, 0.5, 0.3, x);
    cracks(b, 0.0715, [[-0.1, 1.0, 0.07, 0.6], [0.11, 1.05, 0.05, -1.0], [-0.02, 1.14, 0.06, 0.2]]);
  });
  ribbon(b, 0.26, 0.24, 0.026);
}

/** Plattenbrecher (I52): a big, rugged Plattenbau slab with four ember windows, a broken corner and rebar. */
function pbrecher(b: Parts): void {
  const c = stone(0xb8ad98);
  handle2(b, wood(0x6a4a30));
  b.add(box(0.06, 0.05, 0.1), P.iron, 0, 0.6, 0);
  head(b, () => {
    b.add(box(0.3, 0.24, 0.12), c, 0, 1.06, 0)
      .add(box(0.31, 0.02, 0.13), stone(0x8a8274), 0, 1.06, 0)
      .add(box(0.07, 0.06, 0.13), stone(0x8a8274), 0.14, 1.16, 0, 0, 0, 0.5)
      .add(box(0.05, 0.08, 0.11), c, -0.16, 0.99, 0, 0, 0, -0.3)
      .add(box(0.32, 0.012, 0.004), stone(0x7a7264), 0, 1.0, 0.061)
      .add(box(0.32, 0.012, 0.004), stone(0x7a7264), 0, 1.0, -0.061);
    for (const x of [-0.075, 0.075]) for (const y of [1.005, 1.115]) b.add(box(0.06, 0.06, 0.126), GLOW, x, y, 0).add(box(0.07, 0.01, 0.13), stone(0x6a6458), x, y - 0.035, 0);
    for (const [x, y, z] of [[-0.17, 1.0, 0], [0.17, 1.13, 0.02], [0.17, 0.99, -0.02], [0.1, 1.19, 0.03]] as const) b.add(cyl(0.006, 0.006, 0.1, 5), P.rust, x, y, z, 0, 0, Math.PI / 2 - x);
    // Look 2: the panels' faded paint chipped, small fragments on the broken edges, cracks.
    for (const sz of [1, -1]) {
      chips(b, -0.125, 1.06, 0.035, 0.2, sz * 0.061, 0xc89a4a, sz > 0 ? 17 : 19);
      chips(b, 0.125, 1.06, 0.035, 0.2, sz * 0.061, 0x5a8a8a, sz > 0 ? 23 : 29);
      chips(b, 0, 1.165, 0.22, 0.025, sz * 0.061, 0xc89a4a, sz > 0 ? 31 : 37);
    }
    for (const [x, y, z, k] of [[-0.15, 1.17, 0.04, 0.025], [0.16, 0.95, -0.03, 0.02], [0.12, 1.19, 0.03, 0.02], [-0.17, 1.06, -0.04, 0.022]] as const) b.add(box(k, k * 0.8, k), stone(0xa49c88), x, y, z, 0.4, 0.3, x);
    cracks(b, 0.0615, [[-0.03, 0.96, 0.05, 0.7], [0.04, 1.17, 0.06, -0.4], [0.0, 1.06, 0.04, 1.3]]);
  });
  ribbon(b, 0.26, 0.24, 0.026);
}

/** Zorn der Ringbahn (I32): a smaller S-Bahn orange fork, a glowing ring between the prongs, an S badge, a hanging rag. */
function ringbahn(b: Parts): void {
  fork(b, { arm: metal(0xd8641e), wrap: P.rubber, band: plain(0xe8b23a), rubber: P.rubber, pouch: P.leather });
  for (const sx of [-1, 1]) b.add(cyl(0.02, 0.02, 0.022), plain(0xe8b23a), ...armAt(sx, 0.92), 0, 0, 0, -sx * ARM_RZ);
  b.add(ring(0.04, 0.007, 4, 16), GLOW, 0, 0.25, 0)
    .add(cyl(0.022, 0.022, 0.008, 12), plain(0x2f8a4a), 0, 0.17, 0.02, Math.PI / 2)
    .add(box(0.012, 0.024, 0.004), plain(0xf0f0e8), 0, 0.17, 0.025);
  ribbon(b, 0.1, 0.18, 0.025, plain(0xe8b23a));
}

/** Krähenschleuder (I53): a smaller dark fork, a crow skull with glowing eyes, feathers and beads on hanging cords. */
function kraehe(b: Parts): void {
  fork(b, { arm: wood(0x3a2a20), wrap: plain(0x7a2a1e), band: plain(0x7a2a1e), rubber: P.rubber, pouch: plain(0x3a2a20) });
  const bone = plain(0xd8d0b8);
  const feather: [number, number][] = [[0, 0], [0.012, -0.04], [0.011, -0.1], [0, -0.13], [-0.011, -0.09], [-0.012, -0.04]];
  const [sx, sy] = armAt(-1, 0.55);
  // Skull tied to the front of the left arm, feathers and beads on cords beside the handle.
  b.add(scaled(ball(0.024, 8, 6), 0.85, 1, 1), bone, sx, sy, 0.025)
    .add(cone(0.011, 0.05, 4), bone, sx, sy - 0.04, 0.03, Math.PI, 0, 0)
    .add(ball(0.006, 6, 4), GLOW, sx - 0.01, sy + 0.006, 0.045)
    .add(ball(0.006, 6, 4), GLOW, sx + 0.01, sy + 0.006, 0.045);
  cord(b, [sx - 0.01, sy - 0.01, 0], [-0.075, 0.12, 0.01], 0.02, 0.003, P.wrap, 3);
  for (const [x, y, rz] of [[-0.075, 0.12, 0.1], [-0.088, 0.13, 0.4], [-0.064, 0.125, -0.2]] as const) b.add(flat(feather, 0.003), plain(0x1a1a22), x, y, 0.01, 0, 0, rz, true);
  for (const y of [0.15, 0.135]) b.add(ball(0.007, 6, 4), plain(0xb8a060), -0.074, y, 0.012, 0, 0, 0, true);
}

/** Speer der Siegessäule (I56), a little shorter: a gold shaft with bands, Victoria with wings and a laurel wreath below the tip. */
function siegsp(b: Parts): void {
  const gold = metal(0xd4a62a), bright = metal(0xf2d14b), leaf = metal(0x8a9a3a);
  const wing: [number, number][] = [[0, 0], [0.05, 0.02], [0.1, 0.06], [0.14, 0.13], [0.15, 0.2], [0.11, 0.15], [0.08, 0.13], [0.09, 0.1], [0.05, 0.08], [0.012, 0.05]];
  b.add(cyl(0.017, 0.02, 1.92), gold, 0, 0.38, 0)
    .add(scaled(cone(0.042, 0.28), 1, 1, 0.3), bright, 0, 1.58, 0, 0, Math.PI / 4, 0)
    .add(flat(wing, 0.008), bright, 0.012, 1.3, -0.004)
    .add(flat(wing, 0.008), bright, -0.012, 1.3, -0.004, 0, Math.PI, 0)
    // Victoria: body, head, raised arm with the wreath.
    .add(cyl(0.012, 0.026, 0.1, 8), gold, 0, 1.33, 0.006)
    .add(ball(0.014, 8, 6), gold, 0, 1.395, 0.006)
    .add(ring(0.038, 0.008, 4, 14), gold, 0, 1.43, 0, Math.PI / 2)
    .add(ball(0.02, 8, 6), GLOW, 0, 1.43, 0)
    .add(cyl(0.026, 0.026, 0.04), gold, 0, 1.25, 0)
    .add(cyl(0.022, 0.022, 0.03), bright, 0, 0.9, 0)
    .add(cyl(0.022, 0.022, 0.03), bright, 0, 0.3, 0)
    .add(cyl(0.024, 0.024, 0.3), P.leather, 0, 0.02, 0)
    .add(ring(0.025, 0.004, 4, 10), gold, 0, 0.17, 0, Math.PI / 2)
    .add(ring(0.025, 0.004, 4, 10), gold, 0, -0.13, 0, Math.PI / 2)
    .add(cone(0.022, 0.08, 6), gold, 0, -0.62, 0, Math.PI, 0, 0);
  for (let k = 0; k < 10; k++) b.add(scaled(ball(0.011, 5, 3), 1, 0.5, 2), leaf, Math.cos(k * Math.PI / 5) * 0.038, 1.43, Math.sin(k * Math.PI / 5) * 0.038, 0, -k * Math.PI / 5, 0);
}

/** Morgenstern der Zitadelle (I48, set Zitadelle): a big spiked iron ball (two-handed rule), dark shaft, iron fittings. */
function morgen(b: Parts): void {
  const spike = metal(0x8a8f96);
  handle2(b, wood(0x4a3020), P.leather);
  b.add(cyl(0.034, 0.034, 0.05), spike, 0, 0.585, 0)
    .add(cyl(0.036, 0.036, 0.03), GLOW, 0, 0.62, 0);
  head(b, () => {
    b.add(ball(0.09, 12, 8), metal(0x6a6e76), 0, 1.06, 0)
      .add(ring(0.09, 0.008, 4, 16), spike, 0, 1.06, 0, Math.PI / 2);
    // Spikes along 13 directions (cube corners and faces, none into the shaft).
    const dirs: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) dirs.push([x, y, z]);
    for (const [x, y, z] of dirs) {
      const d = new Vector3(x, y, z).normalize();
      const g = cone(0.022, 0.06, 4);
      g.applyQuaternion(_q.setFromUnitVectors(UP, d));
      b.add(g, spike, d.x * 0.115, 1.06 + d.y * 0.115, d.z * 0.115);
    }
  });
  ribbon(b, 0.26, 0.24, 0.026);
}

const BUILD: Partial<Record<WeaponLookId, Builder>> = {
  rohr, latte, stahl, machete, brech, vorschlag, pflaster, zange, zwille: (b) => fork(b), nagel, stein, rspeer, fahne, harpune,
  leucht, boxh, neonfl, mikro, sichel, werkh, aufzieh, zeiger,
  turm, zitklinge, mauer, pbrecher, ring: ringbahn, kraehe, siegsp, morgen,
  'brech:kiez': (b) => brech(b, plain(0x3a5a8a), plain(0xe07a2a), 0xdadee2),
  'zwille:spree': (b) => {
    fork(b, { ...FORK, arm: wood(0x4f6e52), wrap: cloth(0x6a8a78), band: plain(0x2f8a80), rubber: plain(0x2a4a40), pouch: plain(0x2f5a4a) });
    // Set signature: green glow bands on the arms and at the crotch.
    for (const sx of [-1, 1]) for (const t of [0.45, 0.85]) b.add(ring(0.018, 0.004, 4, 10), GLOW, ...armAt(sx, t), 0, Math.PI / 2, 0, -sx * ARM_RZ);
    b.add(ring(0.026, 0.004, 4, 10), GLOW, 0, 0.145, 0, Math.PI / 2);
  },
};

/** True when `id` has its own builder (else `weaponModel` falls back to the kind's default). */
export const hasBuilder = (id: WeaponLookId): boolean => BUILD[id] !== undefined;

/** The parts of a model in model space (for the envelope test; `weaponGeometry` merges them). */
export function weaponParts(id: WeaponLookId): WeaponPart[] {
  const b = new Parts();
  (BUILD[id] ?? BUILD[DEFAULT_LOOK[WEAPON_LOOKS[id].kind]]!)(b);
  return b.list;
}

const geometries = new Map<WeaponLookId, Partial<Record<WeaponSlot, BufferGeometry>>>();

/** One merged geometry per material slot, built once per model and shared by every rack. */
export function weaponGeometry(id: WeaponLookId): Partial<Record<WeaponSlot, BufferGeometry>> {
  let out = geometries.get(id);
  if (out) return out;
  out = {};
  const parts = weaponParts(id);
  for (const slot of ['metal', 'matte', 'glow'] as const) {
    const list = parts.filter((p) => p.slot === slot).map((p) => p.geo);
    if (list.length) out[slot] = mergeGeometries(list)!;
  }
  geometries.set(id, out);
  return out;
}

/**
 * Largest distance from the model's +Y axis of any surface between heights y0 and y1 (exact: each
 * triangle is clipped to the slab, and distance is largest at a corner of the clipped polygon).
 */
export function slabRadius(parts: readonly WeaponPart[], y0: number, y1: number): number {
  let best = 0;
  const v: [number, number, number][] = [];
  const clip = (poly: [number, number, number][], y: number, keepAbove: boolean): [number, number, number][] => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      const ina = keepAbove ? a[1] >= y : a[1] <= y, inb = keepAbove ? b[1] >= y : b[1] <= y;
      if (ina) out.push(a);
      if (ina !== inb) { const t = (y - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t]); }
    }
    return out;
  };
  for (const p of parts) {
    const pos = p.geo.attributes.position!;
    for (let i = 0; i < pos.count; i += 3) {
      v.length = 0;
      for (let k = 0; k < 3; k++) v.push([pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)]);
      for (const [x, , z] of clip(clip(v, y0, true), y1, false)) best = Math.max(best, Math.hypot(x, z));
    }
  }
  return best;
}

// ---------------------------------------------------------------- rack

interface Shown { group: Group; glow: Mesh | null }

export class WeaponRack {
  readonly group = new Group();
  private readonly models = new Map<WeaponModel, Shown>();
  private readonly mats: Record<WeaponSlot, LitMaterial>;
  private shown: WeaponModel | null = null;
  /** Thrust weight of the current frame (`aimThrust`). */
  private thrustW = 0;

  constructor(materials: Materials) {
    const o = { flatten: materials.look.flatten, normalMaps: false, anisotropy: 1 };
    this.mats = {
      metal: materials.surface({ map: paintMetalAtlas(o).map, vertexColors: true, roughness: 0.42, metalness: 0.7 }),
      // Double-sided for ribbons and flags.
      matte: materials.surface({ map: paintGrain(o).map, vertexColors: true, roughness: 0.9, doubleSided: true }),
      // The only emissive parts: element strip or signature glow, so they read at a glance (bloom picks them up).
      glow: materials.surface({ color: 0x1a1512, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6, vertexColors: true }),
    };
    // Vertex colour 1 (`GLOW_WHITE`) turns a glow part a faint white whatever the element or signature colour.
    this.mats.glow.onBeforeCompile = (sh): void => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(0.55), vColor.r);');
    };
    this.mats.glow.customProgramCacheKey = (): string => 'weapon-glow';
    // Grip offset in the hand bone's frame (checked with `?cam=5,30` close-ups).
    this.group.position.copy(BASE_POS);
    this.group.quaternion.copy(BASE_ROT);
  }

  /** Kind of the shown model (grip tables are keyed by kind). */
  get kind(): WeaponKindId | null {
    return this.shown === null ? null : WEAPON_LOOKS[this.shown].kind;
  }

  /**
   * Thrust grip (C1): turns the shown model by `weight` (0..1) from the clip's hand toward world
   * direction `dir` (unit) and slides it forward through the hand. Call every frame after the clips,
   * before `leftGrip`; weight 0 restores the plain hand mount. Needs current world matrices of the hand.
   */
  aimThrust(weight: number, dir: Vector3): void {
    const t = this.kind === null ? undefined : THRUST[this.kind];
    this.group.position.copy(BASE_POS);
    this.group.quaternion.copy(mountOf(this.shown));
    this.thrustW = t ? weight : 0;
    if (!t || weight <= 0 || !this.group.parent) return;
    const parent = this.group.parent.getWorldQuaternion(gq2);
    const now = gq3.copy(parent).multiply(BASE_ROT);
    // Smallest turn that lays the shaft along `dir`, then back into the hand's frame.
    gq.setFromUnitVectors(gv.copy(UP).applyQuaternion(now), dir).multiply(now);
    now.slerp(gq, weight);
    this.group.quaternion.copy(parent.invert().multiply(now));
    this.group.position.addScaledVector(gv.copy(UP).applyQuaternion(this.group.quaternion), t.slide * weight);
    this.group.updateMatrixWorld(true);
  }

  /**
   * Shows the model for the equipped weapon; models are built on first use. Glow (D1): the element
   * colour when the item has one, else the base's signature colour, else the glow mesh is hidden.
   */
  show(model: WeaponModel, element: ElementId | undefined): void {
    const glow = weaponGlow(model, element);
    this.mats.glow.emissive.setHex(glow?.color ?? 0);
    this.mats.glow.emissiveIntensity = glow?.intensity ?? 0;
    let s = this.models.get(model);
    if (model !== this.shown) {
      this.shown = model;
      this.group.quaternion.copy(mountOf(model));
      for (const m of this.models.values()) m.group.visible = false;
      if (!s) {
        const group = new Group();
        let glowMesh: Mesh | null = null;
        for (const [slot, geo] of Object.entries(weaponGeometry(model)) as [WeaponSlot, BufferGeometry][]) {
          const m = new Mesh(geo, this.mats[slot]);
          m.name = `weapon-${slot}`;
          // Hero layer too: the contour behind buildings includes the weapon (`hero-outline.ts`).
          m.castShadow = true;
          m.layers.enable(HERO_LAYER);
          if (slot === 'glow') glowMesh = m;
          group.add(m);
        }
        s = { group, glow: glowMesh };
        this.models.set(model, s);
        this.group.add(group);
      }
      s.group.visible = true;
    }
    if (s?.glow) s.glow.visible = glow !== null || !!(WEAPON_LOOKS[model] as { gleam?: true }).gleam;
  }

  /** World height of the shown model's tip while a thrust turns it (C1), else NaN. The tip sits at the base's length (D8). */
  thrustTipY(): number {
    const t = this.kind === null ? undefined : THRUST[this.kind];
    if (this.thrustW <= 0 || !t || this.shown === null) return NaN;
    return this.group.localToWorld(gv.set(0, WEAPON_LOOKS[this.shown].length, 0)).y;
  }

  /** The shown gun (WP4 1h), else undefined. */
  get gun(): (typeof GUNS)[WeaponLookId] {
    return this.shown === null ? undefined : GUNS[this.shown];
  }

  /** True when the shown model is held with both hands (D8: `hands` of the base, not the kind). */
  get twoHanded(): boolean {
    return this.shown !== null && weaponTraits(this.shown).hands === 2 && (LEFT_GRIP[WEAPON_LOOKS[this.shown].kind] !== undefined || this.gun !== undefined);
  }

  /**
   * World position of the left grip and the shaft direction toward the head. Needs current world
   * matrices. `stance` (0..1) slides the grip to the standing pose's height. False for one-handed models.
   */
  leftGrip(pos: Vector3, shaft: Vector3, stance = 0): boolean {
    const g = this.gun;
    if (g) {
      // Guns: the handguard, the shaft along the barrel.
      this.group.localToWorld(pos.set(g.grip[0], g.grip[1], g.grip[2]));
      shaft.set(0, 0, -1).applyQuaternion(this.group.getWorldQuaternion(gq));
      return true;
    }
    const kind = this.kind;
    const h = kind === null || !this.twoHanded ? undefined : LEFT_GRIP[kind];
    if (h === undefined || kind === null) return false;
    const stand = TWO_HAND_STAND[kind];
    const thrust = THRUST[kind];
    let y = stand ? h + (stand.grip - h) * stance : h;
    if (thrust) y += (thrust.grip - y) * this.thrustW;
    this.group.localToWorld(pos.set(0, y, 0));
    shaft.copy(UP).applyQuaternion(this.group.getWorldQuaternion(gq));
    return true;
  }
}

/** The model for a weapon item: its base (with the set for set variants), falling back to the kind's default. */
export function weaponModel(kind: WeaponKindId, base: string, set?: SetId): WeaponModel {
  const id = weaponLookId(kind, base, set);
  return hasBuilder(id) ? id : DEFAULT_LOOK[kind];
}
