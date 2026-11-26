// P17 Spreepark props (`docs/tasks/m11c-dinos.md` step 4). The nest: a low mound of branches, straw and moss, about
// 2 m across, with big pale eggs, some cracked, one hatched shell. On maps with local AI props it is the Pixal3D model
// `assets/props/dino-nest.glb` (`glb-props.ts`: one instanced mesh for every nest of the map, so one draw call and one
// in the shadow pass, 2,000 triangles per copy); elsewhere (the tools' plain builders) a small code nest in the
// shared wood and stucco batches. Footprint: `propCollider` (circle of `NEST_RADIUS` × size, `src/data/courtyard.ts`).
import { Matrix4, SphereGeometry, TorusGeometry } from 'three';
import type { DinoPropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';

const KINDS: ReadonlySet<string> = new Set<DinoPropKind>(['nest']);
const EGG = new SphereGeometry(0.17, 8, 6).scale(1, 1.35, 1);

function nest(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, s = p.size;
  if (m.glbProps) {
    // The batches add the chunk's height offset themselves; the GLB placement needs it too (as the bus).
    const k = rng.range(0.9, 1.05);
    m.glbProps.push({ kind: 'nest', m: new Matrix4().makeTranslation(0, b.solid.lift, 0).multiply(at(p)).multiply(new Matrix4().makeScale(s, s, s)), tint: [k, k * rng.range(0.96, 1.02), k * 0.97] });
    return;
  }
  // Code fallback: two rings of branches, eggs in the hollow, one lying broken.
  for (const [r, y, t] of [[0.78, 0.18, 0.2], [0.62, 0.34, 0.14]] as const) {
    b.geo(m.darkWood, new TorusGeometry(r * s, t * s, 5, 14).rotateX(Math.PI / 2), at(p, 0, y * s, 0), [0.7, 0.6, 0.48]);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
    b.geo(m.stucco, EGG, at(p, Math.cos(a) * 0.22 * s, 0.24 * s, Math.sin(a) * 0.22 * s, rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)).multiply(new Matrix4().makeScale(s, s, s)), [1.25, 1.2, 1.05]);
  }
  b.geo(m.stucco, new SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), at(p, 0.5 * s, 0.1 * s, -0.4 * s, Math.PI * 0.8).multiply(new Matrix4().makeScale(s, s * 1.35, s)), [1.2, 1.15, 1]);
  b.shadowBox(at(p, 0, 0.25 * s, 0), 1.8 * s, 0.5 * s, 1.8 * s);
}

/** Builds a P17 Spreepark prop; false when `p` is another kind. */
export function buildDinoProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind as DinoPropKind) {
    case 'nest': nest(b, p, rng); break;
  }
  return true;
}
