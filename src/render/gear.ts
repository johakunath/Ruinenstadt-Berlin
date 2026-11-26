// The hero's rigid gear (WP4 step 2, D2 mechanism 2): hats, belts, plates, cuffs, boot shafts. Every
// part rides rigidly on one bone; all parts of a look merge into at most three skinned meshes (matte,
// metal, glow), built when the look changes and shared by every hero body. Builders live in
// gear-head.ts, gear-body.ts and gear-limbs.ts; ids are named by `WEAR` in src/data/hero-look.ts.
import { BufferAttribute, BufferGeometry, Color, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GearKit, glow, metal, plain, type HeroSource } from './gear-kit';
import { HEAD_GEAR } from './gear-head';
import { BODY_GEAR } from './gear-body';
import { BODY_RARE_GEAR } from './gear-body-rare';
import { LIMB_GEAR } from './gear-limbs';
import { TUNNEL_GEAR } from './gear-tunnel';
import { FX_GEAR } from './gear-fx-parts';
import type { LitMaterial, Materials } from './materials';
import { paintGrain, paintMetalAtlas } from './paint';
import { box } from './weapons';

export type GearSlot = 'matte' | 'metal' | 'glow';
export const GEAR_SLOTS: readonly GearSlot[] = ['matte', 'metal', 'glow'];
export type GearBuilder = (k: GearKit) => void;

/** One tiny part per material: built for `showAll`, so the gear shaders compile at load. */
const WARM: GearBuilder = (k) => k.on('Head', () => {
  k.add(box(0.001, 0.001, 0.001), plain(0x808080), 0, 1.6, 0).add(box(0.001, 0.001, 0.001), metal(0x808080), 0, 1.6, 0).add(box(0.001, 0.001, 0.001), glow(0x101010), 0, 1.6, 0);
});

export const GEAR: Readonly<Record<string, GearBuilder>> = { warm: WARM, ...HEAD_GEAR, ...BODY_GEAR, ...BODY_RARE_GEAR, ...LIMB_GEAR, ...TUNNEL_GEAR, ...FX_GEAR };

/** WP4 step 5: one pulse factor on every gear glow part (the legendary glow edge, D5); set each frame by `GearFx`. */
export const GEAR_PULSE = { value: 1 };

/**
 * Triangle budget of all gear of one look and of its glow parts. D3 planned 2,500; raised to 3,200 for
 * the richer set and legendary looks (Johannes, 2026-11-19: rewarding to find). The hero stays far under
 * `HERO_BUDGET.triangles` (heaviest look without gear about 19,100; `gear.test.ts` checks the sum).
 */
export const GEAR_BUDGET = { triangles: 3200, glow: 400 } as const;

const built = new WeakMap<HeroSource, Map<string, Partial<Record<GearSlot, BufferGeometry>>>>();

/**
 * Merged gear geometry of a look per slot, skinned rigidly: `skinIndex` is the bone's index in the
 * hero skeleton (`bones`, the same order for every clone), weight 1. Cached per source and id list.
 */
export function gearGeometry(src: HeroSource, bones: readonly string[], ids: readonly string[]): Partial<Record<GearSlot, BufferGeometry>> {
  let bySrc = built.get(src);
  if (!bySrc) built.set(src, (bySrc = new Map()));
  const key = ids.join(',');
  let out = bySrc.get(key);
  if (out) return out;
  const k = new GearKit(src);
  for (const id of ids) GEAR[id]?.(k);
  out = {};
  for (const slot of GEAR_SLOTS) {
    const list = k.parts.list.filter((p) => p.slot === slot).map((p) => {
      const g = p.geo, n = g.attributes.position!.count;
      const bi = Math.max(0, bones.indexOf(p.tag || 'Head'));
      g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? bi : 0)), 4));
      g.setAttribute('skinWeight', new BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      return g;
    });
    if (list.length) out[slot] = mergeGeometries(list)!;
  }
  bySrc.set(key, out);
  return out;
}

/** Triangles of a look's gear per slot (tests and the look sheet). */
export function gearTriangles(geo: Partial<Record<GearSlot, BufferGeometry>>): Record<GearSlot, number> {
  const t = (g?: BufferGeometry): number => (g ? (g.index ? g.index.count : g.attributes.position!.count) / 3 : 0);
  return { matte: t(geo.matte), metal: t(geo.metal), glow: t(geo.glow) };
}

const mats = new WeakMap<Materials, Record<GearSlot, Material>>();

/**
 * Gear materials, one set per game: matte cloth and leather on the grain atlas, metal on the metal atlas
 * (both multiply vertex colours, like the weapons), glow takes the vertex colour as its emission.
 * Double-sided: brims, plates and collars are open shells.
 */
export function gearMaterials(materials: Materials): Record<GearSlot, Material> {
  let m = mats.get(materials);
  if (m) return m;
  const o = { flatten: materials.look.flatten, normalMaps: false, anisotropy: 1 };
  const glowMat: LitMaterial = materials.surface({ color: 0x101010, roughness: 0.6, vertexColors: true, doubleSided: true });
  glowMat.onBeforeCompile = (sh): void => {
    sh.uniforms.gearPulse = GEAR_PULSE;
    sh.fragmentShader = 'uniform float gearPulse;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance = vColor.rgb * 2.2 * gearPulse;');
  };
  glowMat.customProgramCacheKey = (): string => 'gear-glow';
  m = {
    matte: materials.surface({ map: paintGrain(o).map, vertexColors: true, roughness: 0.88, doubleSided: true }),
    metal: materials.surface({ map: paintMetalAtlas(o).map, vertexColors: true, roughness: 0.36, metalness: 0.75, doubleSided: true }),
    glow: glowMat,
  };
  mats.set(materials, m);
  return m;
}

/** sRGB hex to a number for the paints (the mockup's colour strings). */
export const hex = (s: string): number => new Color(s).getHex();
