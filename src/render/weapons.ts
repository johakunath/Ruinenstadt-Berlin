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
import { WEAPON_LOOKS, weaponLookId, DEFAULT_LOOK, type WeaponLookId } from '../data/weapon-look';
import { HERO_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import { GRAIN_TONE, paintGrain, paintMetal } from './paint';

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
type Grain = 0 | 1 | 2 | 3;
interface Paint { slot: WeaponSlot; hex: number; grain: Grain }

/** Mean sRGB tone of the grey metal map; metal vertex colours are divided by it. */
const METAL_TONE = 0xa0;
const metal = (hex: number): Paint => ({ slot: 'metal', hex, grain: 2 });
const wood = (hex: number): Paint => ({ slot: 'matte', hex, grain: 0 });
const cloth = (hex: number): Paint => ({ slot: 'matte', hex, grain: 1 });
const plain = (hex: number): Paint => ({ slot: 'matte', hex, grain: 2 });
const stone = (hex: number): Paint => ({ slot: 'matte', hex, grain: 3 });
const GLOW: Paint = { slot: 'glow', hex: 0xffffff, grain: 2 };

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

/** One part, already in model space. `soft`: cloth, cords and bands, outside the envelope check. */
export interface WeaponPart { geo: BufferGeometry; slot: WeaponSlot; soft: boolean }

const _m = new Matrix4();
const _e = new Euler();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

class Parts {
  readonly list: WeaponPart[] = [];

  /** Places `geo` like a Mesh at position (x, y, z) with Euler rotation (rx, ry, rz) and paints it. */
  add(geo: BufferGeometry, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, soft = false): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.clearGroups();
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s));
    // Vertex colour = paint ÷ the map's mean tone (linear), so map × colour averages to the paint.
    const tone = paint.slot === 'metal' ? METAL_TONE : paint.slot === 'matte' ? GRAIN_TONE[paint.grain] : 255;
    const div = _c.setHex(tone * 0x10101).r;
    _c.setHex(paint.hex);
    const n = g.attributes.position!.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([_c.r / div, _c.g / div, _c.b / div], i * 3);
    g.setAttribute('color', new BufferAttribute(col, 3));
    // Matte parts sample their cell of the grain atlas (cell 0 top left = v 0.5..1).
    if (paint.slot === 'matte') {
      const uv = g.attributes.uv!;
      const u0 = (paint.grain % 2) * 0.5, v0 = paint.grain < 2 ? 0.5 : 0, pad = 2 / 512, k = 0.5 - 2 * pad;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + pad + Math.min(1, Math.max(0, uv.getX(i))) * k, v0 + pad + Math.min(1, Math.max(0, uv.getY(i))) * k);
    }
    this.list.push({ geo: g, slot: paint.slot, soft });
    return this;
  }
}

const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, s = 8, open = false): BufferGeometry => new CylinderGeometry(rt, rb, h, s, 1, open);
const cone = (r: number, h: number, s = 4, open = false): BufferGeometry => new ConeGeometry(r, h, s, 1, open);
const ball = (r: number, w = 8, h = 6): BufferGeometry => new SphereGeometry(r, w, h);
const ring = (R: number, r: number, rs = 6, ts = 10): BufferGeometry => new TorusGeometry(R, r, rs, ts);
const scaled = (g: BufferGeometry, x: number, y: number, z: number): BufferGeometry => g.scale(x, y, z);

/** A flat part from an outline in the model's XY plane (blades, jaws, flags), `depth` thick, centred on z = 0. */
function flat(pts: ReadonlyArray<readonly [number, number]>, depth: number, holes: ReadonlyArray<readonly [number, number, number]> = []): BufferGeometry {
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

/** A red rag tied at `y`: the knot and a hanging strip (soft). */
function ribbon(b: Parts, y: number, len = 0.34, paint: Paint = P.red): void {
  b.add(new PlaneGeometry(0.07, len), paint, -0.05, y - len * 0.35, 0.02, 0, 0, 0.5, true);
  b.add(cyl(0.036, 0.036, 0.05), paint, 0, y, 0, 0, 0, 0, true);
}

type Builder = (b: Parts) => void;

// ---------------------------------------------------------------- models

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
  ribbon(b, 0.13, 0.28);
}

/** Vorschlaghammer (the pre-WP4 hammer): a sledge on a long ash handle, the head a lump of rail steel with bands. */
function vorschlag(b: Parts): void {
  b.add(cyl(0.024, 0.03, 1.22), P.wood, 0, 0.42, 0)
    .add(box(0.34, 0.2, 0.2), P.steel, 0, 1.06, 0)
    .add(box(0.06, 0.225, 0.225), P.rust, -0.1, 1.06, 0)
    .add(box(0.06, 0.225, 0.225), P.rust, 0.1, 1.06, 0)
    .add(cyl(0.036, 0.036, 0.06), P.rust, 0, 0.94, 0)
    .add(box(0.345, 0.05, 0.21), GLOW, 0, 1.06, 0)
    .add(cyl(0.031, 0.031, 0.3), P.wrap, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.14), P.wrap, 0, 0.48, 0);
  ribbon(b, 0.86, 0.3);
}

/** Paints of a forked slingshot; set variants and the legendary forks swap them. */
interface ForkPaint { arm: Paint; wrap: Paint; band: Paint; rubber: Paint; pouch: Paint }
const FORK: ForkPaint = { arm: P.wood, wrap: P.wrap, band: P.red, rubber: P.rubber, pouch: P.leather };

/** Jagdzwille (the pre-WP4 sling): a forked slingshot cut from a branch, bicycle tube as band. */
function zwille(b: Parts, f: ForkPaint = FORK): void {
  const arm = (): BufferGeometry => cyl(0.016, 0.02, 0.24, 7);
  // Arms 1 cm higher than before WP4, so the grip zone stays free (D1 envelope).
  b.add(cyl(0.022, 0.026, 0.26), f.arm, 0, 0.03, 0)
    .add(arm(), f.arm, -0.07, 0.25, 0, 0, 0, 0.5)
    .add(arm(), f.arm, 0.07, 0.25, 0, 0, 0, -0.5)
    .add(cyl(0.024, 0.024, 0.14), f.wrap, 0, 0, 0)
    .add(box(0.012, 0.3, 0.02), f.rubber, -0.085, 0.36, -0.11, 0.75, 0, 0, true)
    .add(box(0.012, 0.3, 0.02), f.rubber, 0.085, 0.36, -0.11, 0.75, 0, 0, true)
    .add(box(0.2, 0.06, 0.012), f.pouch, 0, 0.26, -0.21, 0.75, 0, 0, true)
    .add(ball(0.03), GLOW, 0, 0.27, -0.2)
    .add(cyl(0.026, 0.026, 0.03), f.band, 0, 0.12, 0);
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
  ribbon(b, 0.13, 0.26);
}

/** Holzlatte (legacy saves, icon I01): a 5 cm board with nails through the top, wrapped grip. */
function latte(b: Parts): void {
  // Driven through from the back (heads) or the side, points sticking out.
  const nail = (x: number, y: number, side = false): void => {
    if (side) b.add(cyl(0.005, 0.005, 0.11, 5), P.steel, 0.03, y, x, 0, 0, Math.PI / 2).add(cyl(0.012, 0.012, 0.006, 6), P.iron, -0.027, y, x, 0, 0, Math.PI / 2);
    else b.add(cyl(0.005, 0.005, 0.1, 5), P.steel, x, y, 0.035, Math.PI / 2).add(cyl(0.012, 0.012, 0.006, 6), P.iron, x, y, -0.014, Math.PI / 2);
  };
  b.add(box(0.05, 1.03, 0.022), wood(0x9a7448), 0, 0.435, 0)
    .add(box(0.052, 0.14, 0.024), plain(0x6a2a1a), 0, 0.72, 0)
    .add(cyl(0.03, 0.03, 0.24), P.wrap, 0, 0.02, 0)
    .add(box(0.054, 0.08, 0.026), GLOW, 0, 0.5, 0);
  nail(-0.012, 0.78);
  nail(0.012, 0.84);
  nail(-0.008, 0.9);
  nail(0, 0.81, true);
  nail(0, 0.88, true);
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

/** Hackmesser (I90): a long, broad cleaver with a square end and a hole at the spine. Kiezwache: blue grip, orange band. */
function brech(b: Parts, grip: Paint = wood(0x3a2416), band?: Paint): void {
  const blade: [number, number][] = [[0.018, 0.16], [0.018, 0.88], [0.008, 0.9], [-0.1, 0.9], [-0.112, 0.885], [-0.112, 0.24], [-0.09, 0.19], [-0.03, 0.16]];
  b.add(flat(blade, 0.012, [[-0.012, 0.845, 0.014]]), metal(0x8a8278), 0, 0, 0)
    .add(box(0.012, 0.62, 0.013), metal(0xb8b8b4), -0.106, 0.56, 0)
    .add(box(0.05, 0.12, 0.0135), P.rust, -0.06, 0.62, 0)
    .add(box(0.04, 0.07, 0.0135), P.rust, -0.03, 0.4, 0)
    .add(box(0.042, 0.025, 0.03), P.steel, 0, 0.152, 0)
    .add(scaled(cyl(0.021, 0.023, 0.27), 1, 1, 0.8), grip, 0, 0.012, 0)
    .add(cyl(0.006, 0.006, 0.04, 6), P.steel, 0, -0.07, 0, Math.PI / 2)
    .add(cyl(0.006, 0.006, 0.04, 6), P.steel, 0, 0.0, 0, Math.PI / 2)
    .add(cyl(0.006, 0.006, 0.04, 6), P.steel, 0, 0.07, 0, Math.PI / 2)
    .add(box(0.09, 0.06, 0.016), GLOW, -0.045, 0.32, 0);
  if (band) b.add(cyl(0.024, 0.024, 0.03), band, 0, 0.12, 0);
}

/** Pflasterhammer (I07): square face on one side, pick end on the other, light ash handle. */
function pflaster(b: Parts): void {
  b.add(cyl(0.024, 0.03, 1.22), wood(0xa07a4a), 0, 0.42, 0)
    .add(box(0.09, 0.12, 0.1), P.iron, 0, 1.06, 0)
    .add(box(0.13, 0.13, 0.13), metal(0x8a8278), 0.1, 1.06, 0)
    .add(box(0.022, 0.142, 0.142), P.rust, 0.172, 1.06, 0)
    .add(scaled(cone(0.065, 0.3), 1, 1, 0.75).rotateY(Math.PI / 4), metal(0x8a8278), -0.19, 1.06, 0, 0, 0, Math.PI / 2)
    .add(cyl(0.036, 0.036, 0.06), P.rust, 0, 0.97, 0)
    .add(box(0.095, 0.124, 0.104), GLOW, -0.005, 1.06, 0)
    .add(cyl(0.031, 0.031, 0.3), P.wrap, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.14), P.wrap, 0, 0.48, 0);
}

/** Rohrzange (I08): a pipe wrench, red I-beam handle, fixed hook jaw, sliding jaw on a knurled nut. */
function zange(b: Parts): void {
  const red = metal(0xa83224);
  b.add(box(0.05, 1.05, 0.028), red, 0, 0.38, 0)
    .add(cyl(0.025, 0.025, 0.028, 10), red, 0, -0.145, 0, Math.PI / 2)
    .add(box(0.05, 0.3, 0.05), P.steel, -0.005, 1.03, 0)
    .add(box(0.21, 0.06, 0.06), P.steel, -0.09, 1.15, 0)
    .add(box(0.05, 0.085, 0.06), P.steel, -0.175, 1.105, 0)
    .add(box(0.13, 0.014, 0.062), P.iron, -0.1, 1.113, 0)
    .add(box(0.17, 0.05, 0.06), P.steel, -0.08, 1.02, 0)
    .add(box(0.13, 0.014, 0.062), P.iron, -0.1, 1.05, 0)
    .add(cyl(0.042, 0.042, 0.06, 10), P.iron, -0.005, 0.94, 0)
    .add(ring(0.042, 0.006, 4, 10), P.steel, -0.005, 0.94, 0, Math.PI / 2)
    .add(box(0.054, 0.08, 0.032), GLOW, 0, 0.7, 0);
}

/** Nagelwerfer (I10): the fork with iron plates and a pouch of nails on one arm (the grip stays free). */
function nagel(b: Parts): void {
  zwille(b, { ...FORK, arm: wood(0x8a6038) });
  b.add(cyl(0.027, 0.027, 0.04), P.iron, 0, 0.17, 0)
    .add(box(0.03, 0.05, 0.034), P.iron, 0.13, 0.31, 0, 0, 0, -0.5)
    .add(box(0.07, 0.08, 0.045), P.leather, 0.15, 0.2, 0)
    .add(box(0.074, 0.012, 0.049), P.iron, 0.15, 0.24, 0);
  for (const [x, z] of [[0.13, -0.01], [0.15, 0.01], [0.17, -0.005], [0.14, 0.012]] as const) b.add(cyl(0.006, 0.006, 0.03, 6), P.steel, x, 0.255, z);
}

/** Steinschleuder (I11): a rope sling, two cords up from a knotted grip to a leather cradle with a stone. */
function stein(b: Parts): void {
  const cord = cloth(0x8a6a4a);
  b.add(cyl(0.02, 0.022, 0.1), P.leather, 0, 0, 0)
    .add(ring(0.022, 0.006, 4, 10), cord, 0, -0.075, 0)
    .add(cyl(0.024, 0.024, 0.025), GLOW, 0, 0.065, 0)
    .add(cyl(0.006, 0.006, 0.27, 5), cord, -0.035, 0.18, 0, 0, 0, 0.27, true)
    .add(cyl(0.006, 0.006, 0.27, 5), cord, 0.035, 0.18, 0, 0, 0, -0.27, true)
    .add(scaled(new SphereGeometry(0.058, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 1.3, 0.6, 0.8), P.leather, 0, 0.33, 0, 0, 0, 0, true)
    .add(new IcosahedronGeometry(0.036, 0), stone(0x8a8478), 0, 0.335, 0);
}

/** Rohrspeer (I12): the bayonet on a rusty steel pipe, lashed with wire. */
function rspeer(b: Parts): void {
  b.add(cyl(0.02, 0.023, 1.95), metal(0x7d7a74), 0, 0.42, 0)
    .add(scaled(cone(0.05, 0.42), 1, 1, 0.3), P.steel, 0, 1.6, 0, 0, Math.PI / 4, 0)
    .add(cyl(0.03, 0.026, 0.16), P.rust, 0, 1.36, 0)
    .add(box(0.16, 0.024, 0.024), P.rust, 0, 1.31, 0)
    .add(cyl(0.031, 0.031, 0.06), GLOW, 0, 1.25, 0)
    .add(cyl(0.026, 0.026, 0.3), P.wrap, 0, 0.02, 0)
    .add(cyl(0.025, 0.025, 0.05), P.wrap, 0, 0.78, 0)
    .add(cyl(0.025, 0.025, 0.05), P.wrap, 0, 1.06, 0)
    .add(cone(0.026, 0.1, 6), P.rust, 0, -0.6, 0, Math.PI, 0, 0);
  ribbon(b, 1.18, 0.42);
}

/** Fahnenstange (I13): a wooden pole, a torn red flag below a light tip. */
function fahne(b: Parts): void {
  const flag: [number, number][] = [[-0.015, 1.52], [-0.29, 1.5], [-0.25, 1.44], [-0.3, 1.38], [-0.22, 1.33], [-0.27, 1.25], [-0.13, 1.28], [-0.1, 1.2], [-0.015, 1.24]];
  const rag: [number, number][] = [[-0.015, 1.15], [-0.12, 1.12], [-0.08, 1.02], [-0.015, 1.06]];
  b.add(cyl(0.018, 0.021, 2.22), wood(0x8a6a44), 0, 0.51, 0)
    .add(scaled(cone(0.028, 0.2), 1, 1, 0.5), P.steel, 0, 1.71, 0, 0, Math.PI / 4, 0)
    .add(cyl(0.024, 0.024, 0.05), P.brass, 0, 1.6, 0)
    .add(flat(flag, 0.004), plain(0xc23a2e), 0, 0, 0, 0, 0, 0, true)
    .add(flat(rag, 0.004), plain(0xd6cfc0), 0, 0, 0, 0, 0, 0, true)
    .add(cyl(0.024, 0.024, 0.04), P.wrap, 0, 1.52, 0)
    .add(cyl(0.025, 0.025, 0.3), P.wrap, 0, 0.02, 0)
    .add(cyl(0.026, 0.026, 0.05), GLOW, 0, 1.2, 0)
    .add(cone(0.022, 0.08, 6), P.iron, 0, -0.62, 0, Math.PI, 0, 0);
}

/** Harpune (I14): a dark shaft, a tip with two barbs, a coil of line. */
function harpune(b: Parts): void {
  const barb: [number, number][] = [[0, 0], [0.09, -0.13], [0.014, -0.035]];
  b.add(cyl(0.02, 0.023, 2.0), wood(0x4a4038), 0, 0.44, 0)
    .add(cyl(0.012, 0.016, 0.22), P.steel, 0, 1.5, 0)
    .add(scaled(cone(0.045, 0.2), 1, 1, 0.3), P.steel, 0, 1.71, 0, 0, Math.PI / 4, 0)
    .add(flat(barb, 0.008), P.steel, 0.01, 1.62, 0)
    .add(flat(barb, 0.008), P.steel, -0.01, 1.62, 0, 0, Math.PI, 0)
    .add(cyl(0.026, 0.024, 0.05), P.iron, 0, 1.4, 0)
    .add(ring(0.032, 0.006, 4, 12), cloth(0xc9a878), 0, 0.8, 0, Math.PI / 2, 0, 0, true)
    .add(ring(0.032, 0.006, 4, 12), cloth(0xc9a878), 0, 0.83, 0, Math.PI / 2, 0, 0, true)
    .add(ring(0.07, 0.005, 4, 14), cloth(0xc9a878), 0.075, 0.72, 0, 0, 0, 0, true)
    .add(cyl(0.026, 0.026, 0.3), P.wrap, 0, 0.02, 0)
    .add(cyl(0.024, 0.024, 0.04), P.iron, 0, -0.58, 0)
    .add(cyl(0.027, 0.027, 0.05), GLOW, 0, 1.3, 0);
}

// ---------------------------------------------------------------- neon (Mitte) and GDR families

/** Leuchtröhre (I59): a fluorescent tube as the blade (the glow part), metal end caps, taped, dark grip. */
function leucht(b: Parts): void {
  b.add(cyl(0.022, 0.024, 0.25), P.rubber, 0, 0.015, 0)
    .add(cyl(0.028, 0.028, 0.04), P.iron, 0, -0.125, 0)
    .add(cyl(0.032, 0.03, 0.07), P.iron, 0, 0.18, 0)
    .add(cyl(0.024, 0.024, 0.8, 10), GLOW, 0, 0.6, 0)
    .add(cyl(0.027, 0.027, 0.035), P.wrap, 0, 0.42, 0)
    .add(cyl(0.027, 0.027, 0.035), P.wrap, 0, 0.74, 0)
    .add(cyl(0.031, 0.028, 0.07), P.iron, 0, 1.02, 0)
    .add(cyl(0.004, 0.004, 0.04, 4), P.steel, -0.01, 1.07, 0)
    .add(cyl(0.004, 0.004, 0.04, 4), P.steel, 0.01, 1.07, 0);
  ribbon(b, -0.1, 0.2);
}

/** Boxenhammer (I60): a speaker cabinet as the head, the cone rings and level bars glow magenta. */
function boxh(b: Parts): void {
  b.add(cyl(0.024, 0.03, 1.22), wood(0x5a3a26), 0, 0.42, 0)
    .add(box(0.3, 0.24, 0.2), wood(0x3a2a20), 0, 1.06, 0)
    .add(box(0.31, 0.025, 0.21), P.iron, 0, 1.17, 0)
    .add(box(0.31, 0.025, 0.21), P.iron, 0, 0.95, 0)
    .add(cyl(0.036, 0.036, 0.06), P.iron, 0, 0.91, 0)
    .add(cyl(0.031, 0.031, 0.3), P.wrap, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.14), P.wrap, 0, 0.48, 0);
  for (const z of [1, -1]) {
    // Speaker cone and dust cap in a glowing rim, three level bars beside it.
    b.add(cyl(0.072, 0.072, 0.008, 14), P.rubber, -0.04, 1.06, z * 0.102, Math.PI / 2)
      .add(cyl(0.05, 0.05, 0.01, 12), plain(0x3a3430), -0.04, 1.06, z * 0.104, Math.PI / 2)
      .add(ring(0.078, 0.008, 4, 16), GLOW, -0.04, 1.06, z * 0.104)
      .add(scaled(ball(0.022, 8, 4), 1, 1, 0.5), P.iron, -0.04, 1.06, z * 0.108);
    for (const [x, h] of [[0.07, 0.06], [0.095, 0.1], [0.12, 0.08]] as const) b.add(box(0.014, h, 0.006), GLOW, x, 1.03 + h / 2, z * 0.101);
  }
  ribbon(b, 0.86, 0.3);
}

/**
 * Neonflinte (I61) as a neon fork. A one-hand launcher (barrel along −Z, where the pistol clip points)
 * was tried on the `OverhandThrow` strip: she swings it overhead and it points at the ground on release,
 * so it reads as throwing the gun (WP4 1c). The icon shows a rifle and goes to Codex.
 */
function neonfl(b: Parts): void {
  const arm = (): BufferGeometry => cyl(0.016, 0.02, 0.24, 7);
  const tube = (): BufferGeometry => cyl(0.009, 0.009, 0.22, 6);
  b.add(cyl(0.022, 0.026, 0.26), P.rubber, 0, 0.03, 0)
    .add(ball(0.026, 8, 6), P.brass, 0, -0.1, 0)
    .add(arm(), metal(0x3a3640), -0.07, 0.25, 0, 0, 0, 0.5)
    .add(arm(), metal(0x3a3640), 0.07, 0.25, 0, 0, 0, -0.5)
    .add(tube(), GLOW, -0.072, 0.252, 0.022, 0, 0, 0.5)
    .add(tube(), GLOW, 0.072, 0.252, 0.022, 0, 0, -0.5)
    .add(cyl(0.024, 0.024, 0.03), P.brass, 0, 0.15, 0)
    .add(box(0.045, 0.07, 0.035), P.iron, 0.055, 0.2, 0, 0, 0, -0.3)
    .add(box(0.012, 0.3, 0.02), plain(0x5a2450), -0.085, 0.36, -0.11, 0.75, 0, 0, true)
    .add(box(0.012, 0.3, 0.02), plain(0x5a2450), 0.085, 0.36, -0.11, 0.75, 0, 0, true)
    .add(box(0.2, 0.06, 0.012), P.leather, 0, 0.26, -0.21, 0.75, 0, 0, true)
    .add(ball(0.03), GLOW, 0, 0.27, -0.2);
}

/** Mikroständer (I62): a thin dark stand tube, the mic capsule as the tip, a magenta band, a spike at the foot. */
function mikro(b: Parts): void {
  b.add(cyl(0.014, 0.016, 2.15), metal(0x3a3a40), 0, 0.475, 0)
    .add(cyl(0.022, 0.016, 0.08, 8), P.iron, 0, 1.6, 0)
    .add(cyl(0.03, 0.022, 0.05, 10), P.iron, 0, 1.66, 0)
    .add(scaled(ball(0.045, 10, 8), 1, 1.2, 1), metal(0x2a2a2e), 0, 1.755, 0)
    .add(ring(0.045, 0.006, 4, 12), metal(0x8a8a94), 0, 1.755, 0, Math.PI / 2)
    .add(cyl(0.02, 0.02, 0.04), GLOW, 0, 1.52, 0)
    .add(ring(0.03, 0.004, 4, 10), plain(0xbd2b77), 0, 1.25, 0, Math.PI / 2.4, 0, 0, true)
    .add(ring(0.03, 0.004, 4, 10), plain(0xbd2b77), 0, 0.95, 0, Math.PI / 1.8, 0, 0, true)
    .add(cyl(0.024, 0.024, 0.3), P.rubber, 0, 0.02, 0)
    .add(cone(0.03, 0.12, 4), P.steel, 0, -0.6, 0, Math.PI, 0, 0);
  ribbon(b, 1.3, 0.32);
}

/** Sichel (I71): a short wooden handle, red ferrule, a big crescent blade (tip height as every blade). */
function sichel(b: Parts): void {
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / n) * (Math.PI / 180); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  // Outer arc from the neck over the left and the top to the tip, inner arc back.
  const blade = [...arc(0.12, 0.55, 0.36, -110, -350, 14), ...arc(0.16, 0.56, 0.29, -352, -122, 12)];
  b.add(cyl(0.022, 0.025, 0.3), wood(0x7a5030), 0, 0, 0)
    .add(cyl(0.026, 0.026, 0.05), plain(0xaf4237), 0, 0.17, 0)
    .add(box(0.022, 0.08, 0.012), P.steel, 0.004, 0.225, 0)
    .add(flat(blade, 0.012), metal(0x9a968c), 0, 0, 0)
    .add(box(0.06, 0.03, 0.014), GLOW, -0.19, 0.45, 0, 0, 0, 1.2);
}

/** Werkhammer (I72): a blue enamel head with a brass gear emblem and an orange centre, black rubber grip. */
function werkh(b: Parts): void {
  b.add(cyl(0.024, 0.03, 1.22), wood(0x6a4a30), 0, 0.42, 0)
    .add(cyl(0.033, 0.033, 0.3), P.rubber, 0, 0, 0)
    .add(cyl(0.034, 0.034, 0.03), P.brass, 0, 0.175, 0)
    .add(cyl(0.032, 0.032, 0.14), P.rubber, 0, 0.48, 0)
    .add(box(0.31, 0.2, 0.2), P.enamel, 0, 1.06, 0)
    .add(box(0.03, 0.215, 0.215), P.steel, -0.16, 1.06, 0)
    .add(box(0.03, 0.215, 0.215), P.steel, 0.16, 1.06, 0)
    .add(box(0.026, 0.205, 0.205), GLOW, 0.13, 1.06, 0);
  for (const z of [1, -1]) {
    b.add(ring(0.05, 0.01, 4, 12), P.brass, -0.02, 1.06, z * 0.101)
      .add(cyl(0.022, 0.022, 0.008, 10), plain(0xe7982b), -0.02, 1.06, z * 0.101, Math.PI / 2);
    for (let k = 0; k < 8; k++) b.add(box(0.016, 0.016, 0.01), P.brass, -0.02 + Math.cos(k * Math.PI / 4) * 0.064, 1.06 + Math.sin(k * Math.PI / 4) * 0.064, z * 0.101, 0, 0, k * Math.PI / 4);
  }
}

/** Aufziehwerfer (I73): a blue enamel fork with red bands, a brass gear at the crotch and a wind-up key. */
function aufzieh(b: Parts): void {
  zwille(b, { ...FORK, arm: P.enamel, wrap: P.leather, band: P.brass, pouch: plain(0x7a5a3a) });
  b.add(ball(0.026, 8, 6), P.brass, 0, -0.11, 0)
    .add(cyl(0.022, 0.022, 0.03), P.red, -0.122, 0.34, 0, 0, 0, 0.5)
    .add(cyl(0.022, 0.022, 0.03), P.red, 0.122, 0.34, 0, 0, 0, -0.5)
    .add(ring(0.032, 0.009, 4, 12), P.brass, 0, 0.2, 0)
    .add(cyl(0.02, 0.02, 0.03, 10), plain(0xe7982b), 0, 0.2, 0, Math.PI / 2)
    .add(cyl(0.006, 0.006, 0.07, 6), P.brass, 0.065, 0.2, 0, 0, 0, Math.PI / 2)
    .add(ring(0.018, 0.006, 4, 10), P.brass, 0.115, 0.2, 0);
  for (let k = 0; k < 8; k++) b.add(box(0.013, 0.013, 0.02), P.brass, Math.cos(k * Math.PI / 4) * 0.044, 0.2 + Math.sin(k * Math.PI / 4) * 0.044, 0, 0, 0, k * Math.PI / 4);
}

/** Zeigerlanze (I74): a blue enamel shaft with brass fittings and a gear, a clock hand as the tip. */
function zeiger(b: Parts): void {
  const hand: [number, number][] = [[-0.012, 1.42], [-0.032, 1.6], [-0.012, 1.64], [-0.04, 1.7], [0, 1.81], [0.04, 1.7], [0.012, 1.64], [0.032, 1.6], [0.012, 1.42]];
  b.add(cyl(0.018, 0.021, 2.0), P.enamel, 0, 0.42, 0)
    .add(flat(hand, 0.01), metal(0x2a2018), 0, 0, 0)
    .add(ring(0.024, 0.006, 4, 12), P.brass, 0, 1.62, 0)
    .add(ring(0.045, 0.01, 4, 12), P.brass, 0, 1.3, 0)
    .add(cyl(0.016, 0.016, 0.03, 8), plain(0xe7982b), 0, 1.3, 0, Math.PI / 2)
    .add(cyl(0.024, 0.024, 0.05), P.brass, 0, 1.4, 0)
    .add(cyl(0.024, 0.024, 0.04), P.brass, 0, 0.2, 0)
    .add(cyl(0.024, 0.024, 0.04), P.brass, 0, 1.0, 0)
    .add(cyl(0.022, 0.022, 0.05), GLOW, 0, 1.2, 0)
    .add(cyl(0.025, 0.025, 0.3), P.leather, 0, 0.02, 0)
    .add(cone(0.022, 0.08, 6), P.brass, 0, -0.62, 0, Math.PI, 0, 0);
  for (let k = 0; k < 8; k++) b.add(box(0.012, 0.012, 0.02), P.brass, Math.cos(k * Math.PI / 4) * 0.058, 1.3 + Math.sin(k * Math.PI / 4) * 0.058, 0, 0, 0, k * Math.PI / 4);
}

// ---------------------------------------------------------------- legendary and set (1d)

/** Fernsehturm-Splitter (I15): a glass shard in an iron claw, a glowing streak inside, the tower sphere as pommel. */
function turm(b: Parts): void {
  const shard: [number, number][] = [[-0.03, 0.2], [-0.05, 0.45], [-0.075, 0.62], [-0.048, 0.8], [-0.064, 0.92], [-0.012, 1.08], [0.022, 0.98], [0.066, 0.86], [0.052, 0.66], [0.074, 0.5], [0.036, 0.3], [0.03, 0.2]];
  const core: [number, number][] = [[-0.01, 0.3], [-0.024, 0.6], [-0.004, 0.96], [0.022, 0.62], [0.012, 0.3]];
  b.add(flat(shard, 0.02), metal(0x9cc4e4), 0, 0, 0)
    .add(flat(core, 0.024), GLOW, 0, 0, 0)
    .add(box(0.085, 0.05, 0.04), P.iron, 0, 0.17, 0)
    .add(box(0.016, 0.11, 0.03), P.iron, -0.042, 0.23, 0, 0, 0, 0.2)
    .add(box(0.016, 0.11, 0.03), P.iron, 0.042, 0.23, 0, 0, 0, -0.2)
    .add(cyl(0.024, 0.026, 0.26), P.wrap, 0, 0.015, 0)
    .add(cyl(0.027, 0.027, 0.04), P.red, 0, 0.1, 0)
    .add(ball(0.034, 10, 8), metal(0xb8bcc4), 0, -0.15, 0)
    .add(cyl(0.035, 0.035, 0.01, 10), plain(0x2a3a4a), 0, -0.15, 0)
    .add(cyl(0.004, 0.004, 0.06, 4), P.steel, 0, -0.205, 0);
  ribbon(b, 0.06, 0.24);
}

/** Klinge der Zitadelle (I51): a straight knight sword, brass guard and pommel, a cyan gem in the guard. */
function zitklinge(b: Parts): void {
  const blade: [number, number][] = [[-0.032, 0.17], [-0.03, 0.86], [0, 1.08], [0.03, 0.86], [0.032, 0.17]];
  b.add(flat(blade, 0.012), metal(0xa8a090), 0, 0, 0)
    .add(box(0.012, 0.66, 0.0135), metal(0x6a645a), 0, 0.5, 0)
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

/** Mauerbrecher (I16): a slab of Wall concrete with graffiti patches and rebar ends, acid green cracks. */
function mauer(b: Parts): void {
  const c = stone(0xb8b0a0);
  b.add(cyl(0.024, 0.03, 1.22), wood(0x5a3a26), 0, 0.42, 0)
    .add(box(0.32, 0.22, 0.14), c, 0, 1.06, 0)
    .add(box(0.09, 0.07, 0.12), c, 0.13, 1.14, 0, 0, 0, 0.25)
    .add(box(0.08, 0.08, 0.13), c, -0.15, 0.98, 0, 0, 0, 0.4)
    .add(box(0.07, 0.08, 0.18), P.iron, 0, 0.93, 0)
    .add(box(0.08, 0.07, 0.004), plain(0xd4537e), -0.07, 1.1, 0.071)
    .add(box(0.07, 0.05, 0.004), plain(0x7d9bff), 0.06, 1.0, 0.071)
    .add(box(0.1, 0.06, 0.004), plain(0xe8c23a), 0.06, 1.1, -0.071)
    .add(box(0.06, 0.08, 0.004), plain(0xd4537e), -0.08, 1.02, -0.071)
    .add(box(0.08, 0.06, 0.004), plain(0xe0702a), 0.09, 1.13, 0.071)
    .add(box(0.16, 0.016, 0.146), GLOW, 0.0, 1.05, 0, 0, 0, 0.3)
    .add(box(0.11, 0.016, 0.146), GLOW, -0.09, 1.1, 0, 0, 0, -0.7)
    .add(box(0.08, 0.014, 0.146), GLOW, 0.1, 0.99, 0, 0, 0, -0.4)
    .add(cyl(0.031, 0.031, 0.3), P.wrap, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.14), P.wrap, 0, 0.48, 0);
  for (const [x, y] of [[-0.18, 1.12], [0.19, 1.0], [0.18, 1.09]] as const) b.add(cyl(0.007, 0.007, 0.08, 5), P.rust, x, y, 0.02, 0, 0, Math.PI / 2 + x);
  ribbon(b, 0.86, 0.3);
}

/** Plattenbrecher (I52): a Plattenbau slab with four windows glowing ember orange, rebar ends. */
function pbrecher(b: Parts): void {
  const c = stone(0xb8ad98);
  b.add(cyl(0.024, 0.03, 1.22), wood(0x6a4a30), 0, 0.42, 0)
    .add(box(0.3, 0.24, 0.12), c, 0, 1.06, 0)
    .add(box(0.31, 0.02, 0.13), stone(0x8a8274), 0, 1.06, 0)
    .add(box(0.07, 0.08, 0.16), P.iron, 0, 0.92, 0)
    .add(cyl(0.031, 0.031, 0.3), P.wrap, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.14), P.wrap, 0, 0.48, 0);
  for (const x of [-0.075, 0.075]) for (const y of [1.005, 1.115]) b.add(box(0.06, 0.06, 0.126), GLOW, x, y, 0);
  for (const [x, y] of [[-0.17, 1.0], [0.17, 1.13], [0.17, 0.99]] as const) b.add(cyl(0.006, 0.006, 0.1, 5), P.rust, x, y, 0, 0, 0, Math.PI / 2);
  ribbon(b, 0.86, 0.3);
}

/** Zorn der Ringbahn (I32 → repaint): an S-Bahn orange fork with a glowing ring between the prongs. */
function ringbahn(b: Parts): void {
  zwille(b, { arm: metal(0xd8641e), wrap: P.rubber, band: plain(0xe8b23a), rubber: P.rubber, pouch: P.leather });
  b.add(ring(0.052, 0.008, 4, 16), GLOW, 0, 0.3, 0)
    .add(cyl(0.022, 0.022, 0.03), plain(0xe8b23a), -0.122, 0.34, 0, 0, 0, 0.5)
    .add(cyl(0.022, 0.022, 0.03), plain(0xe8b23a), 0.122, 0.34, 0, 0, 0, -0.5);
}

/** Krähenschleuder (I53): a dark fork, a crow skull with glowing eyes, feathers hanging from an arm. */
function kraehe(b: Parts): void {
  zwille(b, { arm: wood(0x3a2a20), wrap: plain(0x7a2a1e), band: plain(0x7a2a1e), rubber: P.rubber, pouch: plain(0x3a2a20) });
  const bone = plain(0xd8d0b8);
  const feather: [number, number][] = [[0, 0], [0.014, -0.05], [0.012, -0.12], [0, -0.16], [-0.012, -0.11], [-0.013, -0.05]];
  // Skull tied to the front of the left arm, feathers hanging beside the handle.
  b.add(scaled(ball(0.03, 8, 6), 0.85, 1, 1), bone, -0.07, 0.25, 0.03)
    .add(cone(0.014, 0.06, 4), bone, -0.07, 0.2, 0.035, Math.PI, 0, 0)
    .add(ball(0.008, 6, 4), GLOW, -0.082, 0.26, 0.054)
    .add(ball(0.008, 6, 4), GLOW, -0.058, 0.26, 0.054)
    .add(cyl(0.003, 0.003, 0.06, 4), P.wrap, -0.09, 0.2, 0, 0, 0, 0, true);
  for (const [x, rz] of [[-0.09, 0.1], [-0.105, 0.4], [-0.08, -0.2]] as const) b.add(flat(feather, 0.003), plain(0x1a1a22), x, 0.175, 0.01, 0, 0, rz, true);
}

/** Speer der Siegessäule (I56): a gold shaft and tip, Victoria's wings and a laurel wreath below the tip. */
function siegsp(b: Parts): void {
  const gold = metal(0xd4a62a), bright = metal(0xf2d14b);
  const wing: [number, number][] = [[0, 0], [0.05, 0.02], [0.11, 0.08], [0.13, 0.15], [0.09, 0.11], [0.05, 0.08], [0.012, 0.05]];
  b.add(cyl(0.017, 0.02, 2.0), gold, 0, 0.42, 0)
    .add(scaled(cone(0.042, 0.32), 1, 1, 0.3), bright, 0, 1.65, 0, 0, Math.PI / 4, 0)
    .add(flat(wing, 0.008), bright, 0.01, 1.38, 0)
    .add(flat(wing, 0.008), bright, -0.01, 1.38, 0, 0, Math.PI, 0)
    .add(cyl(0.012, 0.02, 0.1, 8), gold, 0, 1.4, 0)
    .add(ball(0.016, 8, 6), gold, 0, 1.46, 0)
    .add(ring(0.04, 0.008, 4, 14), gold, 0, 1.49, 0, Math.PI / 2)
    .add(ball(0.02, 8, 6), GLOW, 0, 1.51, 0)
    .add(cyl(0.024, 0.024, 0.04), gold, 0, 1.32, 0)
    .add(cyl(0.024, 0.024, 0.3), P.leather, 0, 0.02, 0)
    .add(cone(0.022, 0.08, 6), gold, 0, -0.62, 0, Math.PI, 0, 0);
  for (let k = 0; k < 6; k++) b.add(scaled(ball(0.012, 5, 3), 1, 0.5, 2), metal(0x8a9a3a), Math.cos(k * Math.PI / 3) * 0.042, 1.49, Math.sin(k * Math.PI / 3) * 0.042, 0, -k * Math.PI / 3, 0);
}

/** Morgenstern der Zitadelle (I48, set Zitadelle): an iron ball with spikes on a dark shaft, iron fittings. */
function morgen(b: Parts): void {
  const spike = metal(0x8a8f96);
  b.add(cyl(0.024, 0.03, 1.22), wood(0x4a3020), 0, 0.42, 0)
    .add(cyl(0.034, 0.034, 0.08), spike, 0, 0.96, 0)
    .add(ball(0.08, 12, 8), metal(0x6a6e76), 0, 1.06, 0)
    .add(cyl(0.036, 0.036, 0.03), GLOW, 0, 0.9, 0)
    .add(cyl(0.031, 0.031, 0.3), P.leather, 0, 0, 0)
    .add(cyl(0.032, 0.032, 0.14), P.leather, 0, 0.48, 0);
  // Spikes along 13 directions (cube corners and faces, none into the shaft).
  const dirs: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) dirs.push([x, y, z]);
  for (const [x, y, z] of dirs) {
    const d = new Vector3(x, y, z).normalize();
    const g = cone(0.02, 0.06, 4);
    g.applyQuaternion(_q.setFromUnitVectors(UP, d));
    b.add(g, spike, d.x * 0.105, 1.06 + d.y * 0.105, d.z * 0.105);
  }
  ribbon(b, 0.82, 0.3);
}

const BUILD: Partial<Record<WeaponLookId, Builder>> = {
  rohr, latte, stahl, machete, brech, vorschlag, pflaster, zange, zwille: (b) => zwille(b), nagel, stein, rspeer, fahne, harpune,
  leucht, boxh, neonfl, mikro, sichel, werkh, aufzieh, zeiger,
  turm, zitklinge, mauer, pbrecher, ring: ringbahn, kraehe, siegsp, morgen,
  'brech:kiez': (b) => brech(b, plain(0x3a5a8a), plain(0xe07a2a)),
  'zwille:spree': (b) => zwille(b, { ...FORK, arm: wood(0x4f6e52), wrap: cloth(0x6a8a78), band: plain(0x2f8a80), pouch: plain(0x2f5a4a) }),
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
      metal: materials.surface({ map: paintMetal('#a0a0a0', o, 73, 1).map, vertexColors: true, roughness: 0.42, metalness: 0.7 }),
      // Double-sided for ribbons and flags.
      matte: materials.surface({ map: paintGrain(o).map, vertexColors: true, roughness: 0.9, doubleSided: true }),
      // The only emissive parts: element strip or signature glow, so they read at a glance (bloom picks them up).
      glow: materials.surface({ color: 0x1a1512, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 }),
    };
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
    this.group.quaternion.copy(BASE_ROT);
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
    if (s?.glow) s.glow.visible = glow !== null;
  }

  /** World height of the shown model's tip while a thrust turns it (C1), else NaN. Needs current world matrices. */
  thrustTipY(): number {
    const t = this.kind === null ? undefined : THRUST[this.kind];
    if (this.thrustW <= 0 || !t) return NaN;
    return this.group.localToWorld(gv.set(0, t.tip, 0)).y;
  }

  /** True when the shown model is held with both hands. */
  get twoHanded(): boolean {
    return this.kind !== null && LEFT_GRIP[this.kind] !== undefined;
  }

  /**
   * World position of the left grip and the shaft direction toward the head. Needs current world
   * matrices. `stance` (0..1) slides the grip to the standing pose's height. False for one-handed models.
   */
  leftGrip(pos: Vector3, shaft: Vector3, stance = 0): boolean {
    const kind = this.kind;
    const h = kind === null ? undefined : LEFT_GRIP[kind];
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
