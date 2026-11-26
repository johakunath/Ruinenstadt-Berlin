// P17 step 2 (`docs/tasks/m11c-dinos.md`): more detail on the Quaternius raptor and Rex without a new download.
// The hide is repainted toward the Köpenick board's skeletal zombie dinosaurs (grey-brown rot instead of olive
// green; bone, wounds and claws stay), and code-built extras go on: bone spikes along the spine, ragged quills
// on the raptor's neck, raised rib bars on the flanks, claw scars on a thigh, the raptor's sickle claws.
// Everything is built once per loaded GLB in the rest pose and merged into the body mesh. Each extra copies the
// skin weights of the hide vertex under it, so it bends with the body; it shares the body's material, so the
// extras cost no draw call (also none in the shadow pass), only triangles (raptor 1,248 → 1,658, Rex 1,820 → 2,116),
// and a few milliseconds of ray casts once at load.
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Matrix3, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3, type Object3D, type SkinnedMesh } from 'three';

type Rgb = readonly [number, number, number];
type DinoKind = 'raptor' | 'rex';

/** Per kind: `s` scales every size from the raptor's (a 2.6 m animal) to the body. */
const LOOK: Record<DinoKind, { s: number; spikes: number; quills: number; ribs: readonly number[]; sickle: boolean; plate: number }> = {
  // Spikes from the back of the skull to the tail tip; ribs at these fractions of the Hips → Shoulders span.
  raptor: { s: 1, spikes: 15, quills: 7, ribs: [0.12, 0.28, 0.44, 0.6, 0.76], sickle: true, plate: 1 },
  rex: { s: 2.5, spikes: 17, quills: 0, ribs: [0.15, 0.3, 0.45, 0.6, 0.75], sickle: false, plate: 1.25 },
};

const srgb = (hex: number): Rgb => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const BONE = srgb(0xd8cbb0), BONE_DARK = srgb(0x8c7c66), HIDE_DARK = srgb(0x3c2f2a), QUILL = srgb(0x2e2420), SCAR = srgb(0x6e1c16), SCAR_EDGE = srgb(0xa86a5a), CLAW = srgb(0x1e1a17);

/** The hide toward the board: olive and green tones turn grey-brown at the same lightness; bone, wounds, claws stay. */
function repaint(geo: BufferGeometry): void {
  const col = geo.getAttribute('color') as BufferAttribute | undefined;
  if (!col) return;
  const c = new Color(), hsl = { h: 0, s: 0, l: 0 };
  const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    c.getHSL(hsl);
    // Yellow-green to green hues, less so for pale bone.
    const w = smooth(0.1, 0.16, hsl.h) * (1 - smooth(0.42, 0.5, hsl.h)) * (1 - smooth(0.62, 0.78, hsl.l));
    if (w <= 0) continue;
    c.setHSL(hsl.h + (0.045 - hsl.h) * w, hsl.s * (1 - 0.35 * w), hsl.l * (1 - 0.04 * w));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

interface Anchor { skin: [number, number, number, number]; weight: [number, number, number, number]; inv: Matrix4; normal: Matrix3; flip: boolean }

/** Adds the extras to the body of a loaded raptor or Rex scene (once per GLB; clones share the geometry). Returns the triangles added. */
export function dressDino(scene: Object3D, kind: DinoKind): number {
  scene.updateMatrixWorld(true);
  let body: SkinnedMesh | undefined;
  scene.traverse((o) => { const m = o as SkinnedMesh; if (m.isSkinnedMesh && !Array.isArray(m.material) && m.material.name === 'skin') body = m; });
  if (!body || body.userData.dressed) return 0;
  body.userData.dressed = true;
  const mesh = body;
  const geo = mesh.geometry;
  repaint(geo);
  const L = LOOK[kind], S = L.s;
  const pos = geo.getAttribute('position'), skinIndex = geo.getAttribute('skinIndex'), skinWeight = geo.getAttribute('skinWeight');
  const bones = mesh.skeleton.bones;
  const boneAt = (name: string): Vector3 | null => { const b = bones.find((q) => q.name === name); return b ? b.getWorldPosition(new Vector3()) : null; };

  // Rest pose in world metres: where the extras are placed (the hide as the game shows it before any clip).
  const world = new Float32Array(pos.count * 3), v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    v.toArray(world, i * 3);
  }
  const hitGeo = new BufferGeometry();
  hitGeo.setAttribute('position', new BufferAttribute(world, 3));
  hitGeo.setIndex(geo.index);
  const hitMesh = new Mesh(hitGeo, new MeshBasicMaterial({ side: DoubleSide }));
  const ray = new Raycaster();
  const mainBone = (i: number): string => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, best)) best = k;
    return bones[skinIndex.getComponent(i, best)]?.name ?? '';
  };
  // Rest skin matrix of a vertex: mesh space → world, inverted to put a world point into that vertex's bind space.
  const anchorOf = (i: number): Anchor => {
    const m = new Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), b = new Matrix4();
    const skin: Anchor['skin'] = [0, 0, 0, 0], weight: Anchor['weight'] = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const j = skinIndex.getComponent(i, k), w = skinWeight.getComponent(i, k);
      skin[k] = j;
      weight[k] = w;
      if (!w) continue;
      b.multiplyMatrices(bones[j]!.matrixWorld, mesh.skeleton.boneInverses[j]!);
      for (let e = 0; e < 16; e++) m.elements[e]! += b.elements[e]! * w;
    }
    const full = new Matrix4().copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(m).multiply(mesh.bindMatrix);
    return { skin, weight, inv: full.clone().invert(), normal: new Matrix3().setFromMatrix4(full).transpose(), flip: full.determinant() < 0 };
  };
  const nearest = (p: Vector3, ok: (bone: string) => boolean = () => true): number => {
    let best = -1, d = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const dx = world[i * 3]! - p.x, dy = world[i * 3 + 1]! - p.y, dz = world[i * 3 + 2]! - p.z, q = dx * dx + dy * dy + dz * dz;
      if (q < d && ok(mainBone(i))) { d = q; best = i; }
    }
    return best;
  };
  /** First hide hit along a ray: the point, the outward facet normal and the nearest vertex of that facet. */
  const hit = (from: Vector3, dir: Vector3): { p: Vector3; n: Vector3; i: number } | null => {
    ray.set(from, dir.clone().normalize());
    const h = ray.intersectObject(hitMesh, false)[0];
    if (!h?.face) return null;
    const n = h.face.normal.clone();
    if (n.dot(ray.ray.direction) > 0) n.negate();
    const i = [h.face.a, h.face.b, h.face.c].reduce((a, b) => (v.fromArray(world, a * 3).distanceToSquared(h.point) <= new Vector3().fromArray(world, b * 3).distanceToSquared(h.point) ? a : b));
    return { p: h.point.clone(), n, i };
  };

  // Extra triangles in world space, each with a colour per corner and the anchor whose skin it takes.
  const tris: Array<{ p: [Vector3, Vector3, Vector3]; c: [Rgb, Rgb, Rgb]; a: Anchor }> = [];
  const anchors = new Map<number, Anchor>();
  const anchor = (i: number): Anchor => { let a = anchors.get(i); if (!a) anchors.set(i, (a = anchorOf(i))); return a; };
  const tri = (a: Anchor, p0: Vector3, p1: Vector3, p2: Vector3, c0: Rgb, c1: Rgb = c0, c2: Rgb = c1): void => { tris.push({ p: [p0, p1, p2], c: [c0, c1, c2], a }); };
  /** An n-sided pyramid from a base on the hide to a tip; `side` points across the base (its flat axis). */
  const spike = (a: Anchor, base: Vector3, tip: Vector3, r: number, sides: number, side: Vector3, cBase: Rgb, cTip: Rgb, flat = 1): void => {
    const axis = tip.clone().sub(base).normalize();
    const u = side.clone().sub(axis.clone().multiplyScalar(side.dot(axis))).normalize(), w = new Vector3().crossVectors(axis, u);
    const ring = Array.from({ length: sides }, (_, k) => {
      const t = (k / sides) * Math.PI * 2;
      return base.clone().addScaledVector(u, Math.cos(t) * r * flat).addScaledVector(w, Math.sin(t) * r);
    });
    for (let k = 0; k < sides; k++) tri(a, ring[k]!, ring[(k + 1) % sides]!, tip, cBase, cBase, cTip);
  };
  /** A tapering four-sided tube along `path` (a claw or a horn): radius `r` at the root, a point at the end. */
  const horn = (a: Anchor, path: Vector3[], r: number, cRoot: Rgb, cTip: Rgb): void => {
    const rings = path.map((p, k) => {
      const f = k / (path.length - 1), t = path[Math.min(k + 1, path.length - 1)]!.clone().sub(path[Math.max(k - 1, 0)]!).normalize();
      const u = new Vector3().crossVectors(t, SIDE);
      if (u.lengthSq() < 1e-6) u.set(0, 1, 0);
      u.normalize();
      const w = new Vector3().crossVectors(t, u);
      return Array.from({ length: 4 }, (_, j) => p.clone().addScaledVector(u, Math.cos((j * Math.PI) / 2) * r * (1 - f)).addScaledVector(w, Math.sin((j * Math.PI) / 2) * r * (1 - f)));
    });
    const col = (k: number): Rgb => (k < path.length / 2 ? cRoot : cTip);
    for (let k = 0; k + 1 < rings.length; k++) for (let j = 0; j < 4; j++) {
      const a0 = rings[k]![j]!, a1 = rings[k]![(j + 1) % 4]!, b0 = rings[k + 1]![j]!, b1 = rings[k + 1]![(j + 1) % 4]!;
      tri(a, a0, a1, b1, col(k), col(k), col(k + 1));
      if (k + 2 < rings.length) tri(a, a0, b1, b0, col(k), col(k + 1), col(k + 1));
    }
  };
  /** A ribbon over the hide through `pts` (already on it), `half` wide, raised `lift` along each point's normal. */
  const ribbon = (pts: Array<{ p: Vector3; n: Vector3; i: number }>, half: number, lift: number, mid: Rgb, edge: Rgb): void => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]!, b = pts[k + 1]!, t = b.p.clone().sub(a.p).normalize();
      const side = (q: typeof a): Vector3 => new Vector3().crossVectors(t, q.n).normalize().multiplyScalar(half);
      const pa = a.p.clone().addScaledVector(a.n, lift), pb = b.p.clone().addScaledVector(b.n, lift);
      const sa = side(a), sb = side(b), an = anchor(a.i);
      // Raised centre line, edges flush with the hide: reads as a welt or a bar from any side.
      const ca = pa.clone().addScaledVector(a.n, lift), cb = pb.clone().addScaledVector(b.n, lift);
      for (const sgn of [-1, 1]) {
        const ea = pa.clone().addScaledVector(sa, sgn), eb = pb.clone().addScaledVector(sb, sgn);
        if (sgn > 0) { tri(an, ea, eb, cb, edge, edge, mid); tri(an, ea, cb, ca, edge, mid, mid); } else { tri(an, eb, ea, ca, edge, edge, mid); tri(an, eb, ca, cb, edge, mid, mid); }
      }
    }
  };
  const UP = new Vector3(0, 1, 0), BACK = new Vector3(0, 0, -1), SIDE = new Vector3(1, 0, 0);
  /** Middle of the body across a slice at `z` (the tail bones sit off centre): the mean x of the hide that is not a leg. */
  const midX = (z: number): number => {
    let sum = 0, n = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(world[i * 3 + 2]! - z) < 0.06 * S && !/Leg|Foot/.test(mainBone(i))) { sum += world[i * 3]!; n++; }
    return n ? sum / n : 0;
  };

  // Spine ridge: tail tip to the back of the skull (the bodies face +Z), heights rise over the shoulders and fall off.
  const head = boneAt('Head'), tailTip = boneAt('Tail5'), shoulders = boneAt('Shoulders'), hips = boneAt('Hips');
  if (head && tailTip && shoulders && hips) {
    const z0 = tailTip.z + 0.12 * S, z1 = head.z - 0.04 * S;
    for (let k = 0; k < L.spikes; k++) {
      const f = k / (L.spikes - 1), z = z0 + (z1 - z0) * f;
      const h = hit(new Vector3(midX(z), 20, z), new Vector3(0, -1, 0));
      if (!h) continue;
      // Biggest over the hips and shoulders, small at the tail tip and on the neck.
      const tall = (0.06 + 0.11 * Math.sin(Math.PI * Math.min(1, f * 1.15)) ** 0.7) * S * L.plate, r = tall * 0.4;
      const dir = h.n.clone().multiplyScalar(0.6).add(UP).addScaledVector(BACK, 0.55).normalize();
      spike(anchor(h.i), h.p.clone().addScaledVector(h.n, -0.01 * S), h.p.clone().addScaledVector(dir, tall), r, 4, SIDE, HIDE_DARK, k % 3 === 1 ? BONE_DARK : BONE, 0.7);
    }
    // Raptor: ragged quills down the back of the neck, fanned left and right, dark with pale tips.
    for (let k = 0; k < L.quills; k++) {
      const f = k / Math.max(1, L.quills - 1), z = shoulders.z + (head.z - shoulders.z) * (0.15 + 0.75 * f);
      for (const sx of [-1, 1]) {
        const h = hit(new Vector3(sx * 0.03 * S, 20, z), new Vector3(0, -1, 0));
        if (!h) continue;
        const len = (0.16 - 0.06 * f) * S, dir = UP.clone().addScaledVector(BACK, 1.1).addScaledVector(SIDE, sx * 0.55).normalize();
        spike(anchor(h.i), h.p.clone().addScaledVector(h.n, -0.008 * S), h.p.clone().addScaledVector(dir, len), 0.012 * S, 3, SIDE, QUILL, BONE_DARK);
      }
    }
    // Two bone horns over the eyes, swept back: the skull reads from the game camera.
    for (const sx of [-1, 1]) {
      const h = hit(new Vector3(head.x + sx * 0.05 * S, 20, head.z + 0.08 * S), new Vector3(0, -1, 0));
      if (!h || mainBone(h.i) !== 'Head') continue;
      const p0 = h.p.clone().addScaledVector(h.n, -0.005 * S);
      horn(anchor(h.i), [p0, p0.clone().add(new Vector3(sx * 0.015, 0.045, -0.02).multiplyScalar(S)), p0.clone().add(new Vector3(sx * 0.03, 0.065, -0.065).multiplyScalar(S))], 0.022 * S, BONE_DARK, BONE);
    }
    // Ribs: bars down both flanks between the hips and the shoulders, angled back; only on torso hide (not legs or arms).
    /** Hide that moves mostly with the body (a chest blended with the upper arm counts, the arm itself does not). */
    const limb = (i: number): number => { let w = 0; for (let k = 0; k < 4; k++) if (/UpLeg|LowLeg|Foot|Tail|Neck|Head/.test(bones[skinIndex.getComponent(i, k)]?.name ?? '')) w += skinWeight.getComponent(i, k); return w; };
    const torso = (b: string): boolean => !/UpLeg|LowLeg|Foot|Tail|Neck|Head/.test(b);
    for (const f of L.ribs) {
      const z = hips.z + (shoulders.z - hips.z) * f;
      const top = hit(new Vector3(0, 20, z), new Vector3(0, -1, 0)), bot = hit(new Vector3(0, -5, z), new Vector3(0, 1, 0));
      if (!top || !bot) continue;
      for (const sx of [-1, 1]) {
        const pts: Array<{ p: Vector3; n: Vector3; i: number }> = [];
        for (let k = 0; k <= 5; k++) {
          const t = 0.08 + 0.74 * (k / 5), y = top.p.y + (bot.p.y - top.p.y) * t;
          const h = hit(new Vector3(sx * 20, y, z - t * 0.1 * S), new Vector3(-sx, 0, 0));
          if (!h || limb(h.i) > 0.6) break;
          pts.push(h);
        }
        if (pts.length >= 3) ribbon(pts, 0.02 * S, 0.014 * S, BONE, BONE_DARK);
      }
    }
    // Claw scars: three parallel slashes across the right thigh and the left flank.
    const thigh = (b: string): boolean => b.startsWith('BackUpLeg') || b.startsWith('BackLeg') || torso(b);
    for (const [sx, cz, cy] of [[1, hips.z - 0.02 * S, hips.y - 0.02 * S], [-1, hips.z + (shoulders.z - hips.z) * 0.45, (hips.y + shoulders.y) / 2 + 0.06 * S]] as const) {
      for (let k = -1; k <= 1; k++) {
        const pts: Array<{ p: Vector3; n: Vector3; i: number }> = [];
        for (let q = 0; q <= 4; q++) {
          const t = q / 4 - 0.5;
          const h = hit(new Vector3(sx * 20, cy + k * 0.045 * S + t * 0.16 * S, cz + t * 0.2 * S + k * 0.02 * S), new Vector3(-sx, 0, 0));
          if (!h || !thigh(mainBone(h.i))) break;
          pts.push(h);
        }
        if (pts.length >= 3) ribbon(pts, 0.011 * S, 0.006 * S, SCAR, SCAR_EDGE);
      }
    }
  }
  // Raptor sickle claw: a hooked claw on the inner toe of each foot, held off the ground.
  if (L.sickle) {
    for (const side of ['L', 'R'] as const) {
      const foot = boneAt(`BackFoot${side}`);
      if (!foot) continue;
      const sx = side === 'L' ? 1 : -1;
      const root = foot.clone().add(new Vector3(-sx * 0.02, 0.045, 0.07));
      const i = nearest(root, (b) => b === `BackFoot${side}`);
      if (i < 0) continue;
      horn(anchor(i), [root, root.clone().add(new Vector3(0, 0.05, 0.035)), root.clone().add(new Vector3(0, 0.06, 0.09)), root.clone().add(new Vector3(0, 0.025, 0.13))], 0.024, BONE_DARK, CLAW);
    }
  }
  if (!tris.length) return 0;

  // Merge into the body geometry: bind-space positions, flat normals, the anchor's skin, the corner colours.
  const n0 = pos.count, n1 = tris.length * 3;
  // Element by element: the loader may hand out interleaved attributes.
  const grow = <T extends Float32Array | Uint16Array>(src: BufferAttribute, make: (n: number) => T): T => {
    const out = make((n0 + n1) * src.itemSize);
    for (let i = 0; i < n0; i++) for (let k = 0; k < src.itemSize; k++) out[i * src.itemSize + k] = src.getComponent(i, k);
    return out;
  };
  const P = grow(pos as BufferAttribute, (n) => new Float32Array(n)), N = grow(geo.getAttribute('normal') as BufferAttribute, (n) => new Float32Array(n));
  const SI = grow(skinIndex as BufferAttribute, (n) => new Uint16Array(n)), SW = grow(skinWeight as BufferAttribute, (n) => new Float32Array(n));
  const col = geo.getAttribute('color') as BufferAttribute | undefined;
  const C = col ? grow(col, (n) => new Float32Array(n)) : null;
  const local = [new Vector3(), new Vector3(), new Vector3()], e1 = new Vector3(), e2 = new Vector3(), nrm = new Vector3();
  tris.forEach((t, k) => {
    const order = t.a.flip ? [0, 2, 1] : [0, 1, 2];
    e1.subVectors(t.p[1], t.p[0]);
    e2.subVectors(t.p[2], t.p[0]);
    nrm.crossVectors(e1, e2).applyMatrix3(t.a.normal).normalize();
    order.forEach((o, j) => {
      const at = n0 + k * 3 + j;
      local[j]!.copy(t.p[o]!).applyMatrix4(t.a.inv).toArray(P, at * 3);
      nrm.toArray(N, at * 3);
      SI.set(t.a.skin, at * 4);
      SW.set(t.a.weight, at * 4);
      if (C) C.set(t.c[o]!, at * 3);
    });
  });
  const index = Array.from(geo.index?.array ?? Array.from({ length: n0 }, (_, i) => i));
  for (let i = 0; i < n1; i++) index.push(n0 + i);
  geo.setAttribute('position', new BufferAttribute(P, 3));
  geo.setAttribute('normal', new BufferAttribute(N, 3));
  geo.setAttribute('skinIndex', new BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new BufferAttribute(SW, 4));
  if (C) geo.setAttribute('color', new BufferAttribute(C, 3));
  geo.setIndex(index);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  hitGeo.setIndex(null);
  hitGeo.dispose();
  (hitMesh.material as MeshBasicMaterial).dispose();
  return tris.length;
}
