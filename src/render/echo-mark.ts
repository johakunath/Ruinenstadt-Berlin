// M17 marks under the tower bosses (render only, FX layer, unlit, 2 draw calls per body that has one).
// An echo boss (T8) stands on a pale clock dial whose second hand is frozen (board 2: „a frozen second hand“);
// Der Zeitwart stands on a dial in the colour of his era pair (board 2: one colour variant per phase), and while he
// is in the movement (a gear hold) the dial turns fast and glows.
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import type { Enemy } from '../sim/types';
import { FX_LAYER } from './layers';

/** Era colours of the Zeitwart's phases: Urzeit and 1920 jungle green, 1981 and 1989 fire orange, 2089 and kommt bald magenta. */
export const ERA_COLORS = [0x5ad07a, 0xff8a2a, 0xff4fa3] as const;
const ECHO_COLOR = 0xbcd8ec;

/** Twelve hour ticks and a hand from the centre (local +z), flat on the ground. */
function marks(r: number): BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  const quad = (a: number, r0: number, r1: number, w: number): void => {
    const n = pos.length / 3, s = Math.sin(a), c = Math.cos(a);
    pos.push(s * r0 - c * w, 0, c * r0 + s * w, s * r0 + c * w, 0, c * r0 - s * w, s * r1 + c * w, 0, c * r1 - s * w, s * r1 - c * w, 0, c * r1 + s * w);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  for (let k = 0; k < 12; k++) quad((k * Math.PI) / 6, r * 0.82, r * 0.96, k % 3 ? 0.03 : 0.06);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

function handGeo(r: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-0.04, 0, 0, 0.04, 0, 0, 0.012, 0, r * 0.9, -0.012, 0, r * 0.9]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** A dial mark of radius `r` (the body's radius plus a margin), hidden until `updateDialMark`. */
export function buildDialMark(r: number): Group {
  const g = new Group();
  const mat = new MeshBasicMaterial({ color: ECHO_COLOR, transparent: true, opacity: 0.55, depthWrite: false, side: DoubleSide, fog: false });
  const ring = new Mesh(new RingGeometry(r * 0.96, r, 40).rotateX(-Math.PI / 2), mat);
  const ticks = new Mesh(marks(r), mat);
  const hand = new Mesh(handGeo(r), mat);
  for (const m of [ring, ticks, hand]) { m.layers.set(FX_LAYER); m.renderOrder = 2; m.position.y = 0.04; }
  hand.name = 'hand';
  g.add(ring, ticks, hand);
  g.userData.mat = mat;
  return g;
}

/** Colour, glow and the hand of the mark for this body this frame. */
export function updateDialMark(g: Group, e: Enemy, time: number): void {
  const mat = g.userData.mat as MeshBasicMaterial, hand = g.getObjectByName('hand')!;
  if (e.kind === 'zeitwart') {
    const holding = !!e.zw?.hold;
    mat.color.setHex(ERA_COLORS[Math.min(2, e.zw?.phase ?? 0)]!);
    mat.opacity = e.state === 'dead' ? 0 : holding ? 0.7 + 0.3 * Math.sin(time * 10) : 0.5;
    hand.rotation.y = holding ? time * 9 : time * 0.6;
    return;
  }
  // The echo's second hand stands still: always the same second.
  mat.color.setHex(ECHO_COLOR);
  mat.opacity = e.state === 'dead' ? 0 : 0.45 + 0.1 * Math.sin(time * 2);
  hand.rotation.y = 0.9;
}
