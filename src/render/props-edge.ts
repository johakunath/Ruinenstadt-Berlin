// M11d step 4: the closed map edge (Johannes 2026-11-17). Front pieces placed by `edgeProps` in
// `src/data/map.ts`; every piece draws only behind its front face (local z <= 0, local +Z faces the
// playfield), which is where its collider (`EDGE_FRONT`, `src/data/courtyard.ts`) starts, so what
// blocks is what is seen. Brandwand: an Altbau back facade or a blind fire wall, 10 m deep body with a
// tar roof. Rubble wall: a collapsed house, heap rising to a broken wall stub. Thicket and overgrowth:
// a dense wall of foliage lumps and leaf cards with saplings. Edge hedge: a tall garden hedge with
// shed roofs behind. Barricade: jersey barriers, wrecked cars, a tram stop shelter, sandbags.
// Fallen tree: a trunk with its root plate. All boxes and blobs merge per material in the chunk.
import { BufferAttribute, BufferGeometry, CircleGeometry, CylinderGeometry, DodecahedronGeometry, Matrix4 } from 'three';
import type { Facade, PlasterTone, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { graffitiCell, ivyPatch } from './props-urban';
import { blobGeo, cardGeo, fernRosette, fringe, mtx, plantMats } from './vegetation';
import { at, buildAltbau, buildProp, FLOOR_H, GROUND_H, PARAPET, Run, wallFace, windowAt, type Builder } from './world';

type RGB = readonly [number, number, number];
const g3 = (g: number, r = 1, b = 1): RGB => [g * r, g, g * b];
const mul = (t: RGB, k: number): RGB => [t[0] * k, t[1] * k, t[2] * k];
const S = (m: Matrix4, x: number, y: number, z: number): Matrix4 => m.multiply(new Matrix4().makeScale(x, y, z));
const TONES: PlasterTone[] = ['cream', 'ochre', 'oxblood', 'cream', 'ochre'];
/** Body depth of a front building, out from its face. */
const BODY = 10;

/** World point of local (x, z) in the prop frame (local X along, +Z inward). */
function world(p: Prop, x: number, z: number): [number, number] {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [p.x + c * x + s * z, p.z - s * x + c * z];
}

/** The face of a front piece as a facade run (yard side = playfield). */
function faceRun(p: Prop, x0: number, x1: number, tone: PlasterTone, floors: number, seed: number): Run {
  const [ax, az] = world(p, x0, 0), [bx, bz] = world(p, x1, 0);
  return new Run({ id: `edge${seed}`, style: 'altbau', ax, az, bx, bz, depth: BODY, floors, tone, features: [], seed });
}

// ---------------------------------------------------------------- town

/**
 * Brandwand row piece: half Hinterhaus back facades (windows, cornices, now and then balconies, the
 * Altbau facade builder), half blind fire walls with the ghost outline of a demolished neighbour, an
 * old painted ad, soot streaks and a few later-cut windows; a third of those burnt with a broken top.
 * 1 to 3 upper floors like the lots in town, so the row matches the streets in front.
 */
function brandwand(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const L = p.size;
  const tone = rng.pick(TONES);
  const plaster = m.plaster[tone] ?? m.stucco;
  const floors = 1 + rng.int(3);
  const H = GROUND_H + floors * FLOOR_H + PARAPET;
  const seed = rng.int(997);
  const blind = rng.next() < 0.5;
  const P = at(p);
  let top = H;
  if (!blind) {
    const f: Facade = { id: `edge${seed}`, style: 'altbau', ...ends(p, L), depth: BODY, floors, tone, features: [], seed };
    buildAltbau(b, f, { balconies: rng.next() < 0.6 });
  } else {
    const run = faceRun(p, -L / 2, L / 2, tone, floors, seed);
    const brick = rng.next() < 0.4;
    const mat = brick ? m.brick : plaster;
    const burnt = rng.next() < 0.33;
    if (burnt) {
      // Broken top: columns stepping down in brick teeth.
      const n = Math.max(2, Math.round(L / 0.7));
      const w = L / n;
      let h = H - rng.range(0, 1.5);
      for (let i = 0; i < n; i++) {
        h = Math.min(H, Math.max(H * 0.45, h + rng.range(-1.6, 1.2)));
        wallFace(b, run, mat, i * w, (i + 1) * w + 0.002, 0, h);
        b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(-L / 2 + (i + 0.5) * w, h + 0.12, -0.25)), w + 0.01, 0.25, 0.5, g3(0.45, 1, 0.95));
      }
      top = H * 0.45;
      // Soot over the whole face.
      b.solid.of(mat).quad([run.pt(0, H * 0.35, 0.015), run.pt(L, H * 0.35, 0.015), run.pt(L, H, 0.015), run.pt(0, H, 0.015)], [0, 0, L / 6, H / 6], [g3(0.55), g3(0.55), g3(0.18), g3(0.18)]);
    } else {
      wallFace(b, run, mat, 0, L, 0, H);
      // Coping along the top.
      b.box(m.stucco, P.clone().multiply(new Matrix4().makeTranslation(0, H + 0.06, -0.2)), L + 0.02, 0.12, 0.5, g3(0.6));
    }
    // Ghost outline of the neighbour that once stood here: its roof slope and floors as a dark stain.
    const gh = rng.range(0.45, 0.75) * H;
    const ridge = Math.min(H - 0.5, gh + rng.range(1.5, 3));
    const gx = rng.range(0.2, 0.8) * L;
    const stain = mul(brick ? g3(0.62, 1.05, 0.95) : g3(0.7, 1.02, 0.95), 1);
    b.solid.of(mat).quad([run.pt(0, 0.2, 0.01), run.pt(L, 0.2, 0.01), run.pt(L, gh, 0.01), run.pt(0, gh, 0.01)], [0, 0, L / 6, gh / 6], [stain]);
    b.solid.of(mat).quad([run.pt(0, gh, 0.01), run.pt(L, gh, 0.01), run.pt(gx + 0.01, ridge, 0.01), run.pt(gx, ridge, 0.01)], [0, gh / 6, L / 6, ridge / 6], [stain]);
    for (let k = 1; k * FLOOR_H + GROUND_H < gh; k++) b.box(mat, P.clone().multiply(new Matrix4().makeTranslation(0, GROUND_H + (k - 1) * FLOOR_H, 0.02)), L, 0.12, 0.04, g3(0.45));
    // A faded painted ad above it.
    if (rng.next() < 0.45 && H - ridge > 2.6) {
      const aw = Math.min(L - 1, rng.range(3, 6)), ah = Math.min(H - ridge - 1, rng.range(1.8, 3)), ay = ridge + 0.6 + ah / 2, ax = rng.range(-L / 2 + aw / 2 + 0.3, L / 2 - aw / 2 - 0.3);
      const ad = m.plaster[rng.pick(['oxblood', 'ochre', 'cream'])] ?? m.stucco;
      b.box(ad, P.clone().multiply(new Matrix4().makeTranslation(ax, ay, 0.02)), aw, ah, 0.02, g3(rng.range(0.55, 0.8)));
      b.box(m.stucco, P.clone().multiply(new Matrix4().makeTranslation(ax, ay, 0.035)), aw * 0.7, 0.35, 0.01, g3(1.1));
    }
    // A few windows cut later, soot streaks from old stove flues.
    const cut = rng.int(3);
    for (let i = 0; i < cut && top > GROUND_H + 2.5; i++) windowAt(b, run, rng, rng.range(1, L - 1), Math.min(top - 2, GROUND_H + rng.int(floors) * FLOOR_H + 0.95), 0.9, 1.4, 0.15, false);
    for (let i = 0; i < 1 + rng.int(3); i++) {
      const s = rng.range(0.6, L - 0.6), y0 = rng.range(2, top * 0.6);
      b.solid.of(mat).quad([run.pt(s - 0.25, y0, 0.012), run.pt(s + 0.25, y0, 0.012), run.pt(s + 0.35, top - 0.3, 0.012), run.pt(s - 0.35, top - 0.3, 0.012)], [0, 0, 0.1, 1], [g3(0.85), g3(0.85), g3(0.4), g3(0.4)]);
    }
    if (rng.next() < 0.5) ivyPatch(b, P, rng, Math.round(3 + L * 0.4), -L / 2 + 0.5, L / 2 - 0.5, 0.3, Math.min(top, 4.5), 0.05, 0.85);
    if (rng.next() < 0.6) {
      const gw = Math.min(L - 1, rng.range(2, 3.4));
      b.cards.of(m.graffiti).add(graffitiCell(rng.int(4)), S(P.clone().multiply(new Matrix4().makeTranslation(rng.range(-L / 2 + gw / 2, L / 2 - gw / 2), 1.2, 0.03)), gw, gw * 0.5, 1));
    }
    if (burnt) {
      // Roofless shell: charred walls at the sides and back, no roof.
      const k: RGB = g3(0.35, 1, 0.95);
      for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(x, top / 2, -BODY / 2)), 0.4, top, BODY - 0.2, k);
      b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(0, top / 2, -BODY + 0.2)), L, top, 0.4, k);
      b.box(m.concrete, P.clone().multiply(new Matrix4().makeTranslation(0, 0.4, -BODY / 2)), L - 0.5, 0.8, BODY - 0.8, g3(0.3));
      b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, H / 2, -BODY / 2)), L, H, BODY);
      foot(b, P, rng, L);
      return;
    }
  }
  // Body: its sides show where the neighbour is lower; a tar roof with chimneys and a roof hatch.
  const body: RGB = g3(0.62, 1, 0.97);
  b.box(plaster, P.clone().multiply(new Matrix4().makeTranslation(0, H / 2, -BODY / 2 - 0.05)), L - 0.02, H, BODY - 0.1, body);
  b.box(m.concrete, P.clone().multiply(new Matrix4().makeTranslation(0, H + 0.02, -BODY / 2)), L - 0.1, 0.1, BODY - 0.2, g3(0.32));
  for (let i = 0; i < 1 + rng.int(3); i++) b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(rng.range(-L / 2 + 0.8, L / 2 - 0.8), H + 0.75, rng.range(-BODY + 1.5, -1.5))), 0.8, 1.5, 0.55, g3(0.7));
  if (rng.next() < 0.5) b.box(m.iron, P.clone().multiply(new Matrix4().makeTranslation(rng.range(-L / 3, L / 3), H + 0.3, -BODY * 0.6)), 1.1, 0.5, 1.1, g3(0.5));
  b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, H / 2, -BODY / 2)), L, H, BODY);
  foot(b, P, rng, L);
}

/** Facade end points of a piece (A left, B right, seen from the playfield). */
function ends(p: Prop, L: number): { ax: number; az: number; bx: number; bz: number } {
  const [ax, az] = world(p, -L / 2, 0), [bx, bz] = world(p, L / 2, 0);
  return { ax, az, bx, bz };
}

/** Bricks and a bin at the foot of a wall, inside the face line. */
function foot(b: Builder, P: Matrix4, rng: Rng, L: number): void {
  const m = b.mats;
  for (let i = 0; i < Math.round(L * 0.5); i++) b.box(m.brick, P.clone().multiply(mtx(rng.range(-L / 2 + 0.3, L / 2 - 0.3), 0.05, -rng.range(0.15, 0.4), rng.range(0, 3), rng.range(-0.3, 0.3))), 0.24, 0.07, 0.115, g3(rng.range(0.6, 0.9)));
}

/** Height of a rubble heap at local (x, z): the toe at the face line, rising out to the wall stub. */
function heapAt(x: number, z: number, hh: number, seed: number): number {
  const t = Math.max(0, Math.min(1, -z / 3.2));
  const rise = t * t * (3 - 2 * t);
  const n = 0.5 + 0.5 * Math.sin(x * 1.7 + seed) * Math.cos(z * 2.3 + seed * 0.7) + 0.25 * Math.sin(x * 4.1 - z * 3.3 + seed * 1.3);
  return Math.max(0.03, hh * rise * (0.75 + 0.35 * n) + (z < -3.2 ? -0.25 * (-3.2 - z) : 0));
}

/**
 * Collapsed house: a heap of brick and plaster rubble from the face line up to a broken wall stub
 * 3 m out, beams and a fallen slab in it, the burnt side walls of the house behind. 300-500 triangles.
 */
function rubbleWall(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const L = p.size;
  const P = at(p);
  const hh = rng.range(2.3, 3.4);
  const seed = rng.range(0, 10);
  // Heap: a jittered height field over the footprint.
  const nx = Math.max(2, Math.round(L / 0.9));
  const zs = [0.15, -0.6, -1.4, -2.2, -3, -3.8, -5];
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j < zs.length; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = -L / 2 + (i / nx) * L;
      const z = zs[j]! + (j > 0 && j < zs.length - 1 ? rng.range(-0.2, 0.2) : 0);
      const y = j === 0 ? -0.05 : heapAt(x, z, hh, seed) + rng.range(-0.12, 0.12);
      pos.push(x, y, z);
      const g = rng.range(0.7, 0.95);
      col.push(1.05 * g, 0.86 * g, 0.74 * g);
      uv.push(x / 2.5, z / 2.5);
    }
  }
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, c = a + nx + 1;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.geo(m.stucco, g, P);
  // Bricks and plaster chunks on the slope.
  const chunk = new DodecahedronGeometry(0.5, 0);
  for (let i = 0; i < Math.round(L * 9); i++) {
    const x = rng.range(-L / 2 + 0.2, L / 2 - 0.2), z = -rng.range(0.2, 3.6), y = heapAt(x, z, hh, seed);
    if (rng.next() < 0.55) b.box(m.brick, P.clone().multiply(mtx(x, y + 0.05, z, rng.range(0, 3), rng.range(-0.6, 0.6), 1, 1, 1, rng.range(-0.6, 0.6))), rng.range(0.3, 0.7), rng.range(0.12, 0.3), rng.range(0.2, 0.4), g3(rng.range(0.7, 1.1), 1.05, 0.9));
    else {
      const s = rng.range(0.3, 0.8);
      b.geo(m.stucco, chunk, P.clone().multiply(mtx(x, y, z, rng.range(0, 3), rng.range(0, 3), s, s * 0.6, s)), g3(rng.range(0.7, 1)));
    }
  }
  // Broken wall stub behind the heap, brick teeth on top.
  const n = Math.max(2, Math.round(L / 0.6));
  const w = L / n;
  let h = rng.range(3.5, 6);
  for (let i = 0; i < n; i++) {
    h = Math.max(hh + 0.4, Math.min(8, h + rng.range(-1.2, 1.1)));
    const x = -L / 2 + (i + 0.5) * w;
    b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(x, h / 2 - 0.3, -3.4)), w + 0.005, h + 0.6, 0.45, g3(rng.range(0.5, 0.7), 1.05, 0.95));
    // Empty window holes as dark patches.
    if (h > 4.5 && i % 3 === 1) b.box(m.rubber, P.clone().multiply(new Matrix4().makeTranslation(x, 3.4, -3.17)), w * 0.9, 1.4, 0.02, g3(0.3));
  }
  // Charred side walls and a back wall of the house, lower; a beam and a slab in the heap.
  for (const sx of [-1, 1]) if (rng.next() < 0.7) {
    const sh = rng.range(2, 5);
    b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(sx * (L / 2 - 0.25), sh / 2, -6.5)), 0.45, sh, 6, g3(0.4, 1, 0.95));
  }
  b.box(m.brick, P.clone().multiply(new Matrix4().makeTranslation(0, 1.2, -9.5)), L, 2.4, 0.45, g3(0.42, 1, 0.95));
  b.box(m.rust, P.clone().multiply(mtx(rng.range(-L / 3, L / 3), hh * 0.7, -2.4, rng.range(-0.5, 0.5), rng.range(-0.5, -0.2))), 0.22, 0.35, 4, g3(0.7));
  if (rng.next() < 0.6) b.box(m.stucco, P.clone().multiply(mtx(rng.range(-L / 3, L / 3), hh * 0.55, -1.9, rng.range(-0.3, 0.3), rng.range(0.25, 0.45), 1, 1, 1, rng.range(-0.15, 0.15))), 2.6, 0.22, 1.6, g3(0.6));
  // Broken wall pieces lying in the heap.
  for (let i = 0; i < Math.round(L / 3); i++) {
    const x = rng.range(-L / 2 + 0.8, L / 2 - 0.8), z = -rng.range(1, 2.8);
    b.box(m.brick, P.clone().multiply(mtx(x, heapAt(x, z, hh, seed) + 0.2, z, rng.range(-0.6, 0.6), rng.range(-0.5, 0.5), 1, 1, 1, rng.range(-0.4, 0.4))), rng.range(1, 1.8), rng.range(0.6, 1.1), 0.4, g3(rng.range(0.55, 0.8), 1.05, 0.95));
  }
  if (rng.next() < 0.6) ivyPatch(b, P, rng, Math.round(3 + L * 0.5), -L / 2 + 0.3, L / 2 - 0.3, hh, hh + 2, -3.15, 0.9);
  b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, 2.5, -3.4)), L, 5, 0.5);
}

// ---------------------------------------------------------------- green fronts

/** Shrub greens, a few half dead. */
function green(rng: Rng, jungle: boolean): RGB {
  const r = rng.next(), g = rng.range(0.8, 1.12);
  if (jungle) return r < 0.6 ? [0.48 * g, 0.72 * g, 0.4 * g] : r < 0.9 ? [0.56 * g, 0.78 * g, 0.42 * g] : [0.8 * g, 0.7 * g, 0.4 * g];
  return r < 0.45 ? [0.52 * g, 0.6 * g, 0.42 * g] : r < 0.75 ? [0.68 * g, 0.66 * g, 0.42 * g] : r < 0.92 ? [0.5 * g, 0.64 * g, 0.44 * g] : [0.95 * g, 0.66 * g, 0.4 * g];
}

/**
 * Dense thicket (forest, park) or overgrowth (jungle): a wall of dark foliage lumps 2.4 to 3.6 m
 * high and 3 m deep, a ragged leaf-card skin, saplings and dead branches poking out; the jungle gets
 * fern rosettes, big leaves and hanging vines. About 70 triangles per meter.
 */
function thicket(b: Builder, p: Prop, rng: Rng, jungle: boolean): void {
  const pm = plantMats(b.mats);
  const P = at(p);
  const L = p.size;
  const n = Math.max(2, Math.round(L / 1.3));
  const seg = L / n;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * seg;
    const h = rng.range(2.3, 3.5);
    const c = green(rng, jungle);
    // Core mass (dark), then lumps on its front and top.
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(x, h * 0.45, -1.6, rng.range(0, 6), 0, seg * 0.85, h * 0.62, 1.65)), mul(c, 0.5));
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(x + rng.range(-0.3, 0.3), rng.range(0.7, 1.3), -0.62, rng.range(0, 6), 0, seg * 0.62, rng.range(0.75, 1.05), 0.6)), mul(c, 0.75));
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(x + rng.range(-0.4, 0.4), h * rng.range(0.7, 0.85), -1.2, rng.range(0, 6), 0, seg * 0.7, h * 0.3, 1.1)), c);
    fringe(b, P, x, h * 0.8, -0.9, 0.8, 2 + rng.int(2), c, rng, jungle && rng.next() < 0.5 ? 'bigLeaf' : 'leaves');
    fringe(b, P, x, 0.9, -0.45, 0.65, 1 + rng.int(2), c, rng);
    if (jungle && rng.next() < 0.6) fernRosette(b, P, x, -0.35, rng.range(1.2, 1.8), 4, [0.55, 0.78, 0.42], rng);
  }
  // Saplings (birch, pine or a jungle stem) rising out of it, and dead branches.
  for (let t = -L / 2 + rng.range(0.5, 2.5); t < L / 2 - 0.3; t += rng.range(2.2, 4)) {
    const z = -rng.range(0.9, 2.4);
    const hgt = rng.range(4, 6.5);
    const birch = !jungle && rng.next() < 0.45;
    b.box(pm.bark, P.clone().multiply(mtx(t, hgt / 2, z, 0, rng.range(-0.08, 0.08), 1, 1, 1, rng.range(-0.08, 0.08))), 0.14, hgt, 0.14, birch ? g3(1.7) : jungle ? g3(0.6) : [0.62, 0.56, 0.52]);
    const c = green(rng, jungle);
    const r = rng.range(1, 1.6);
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(t, hgt, z, rng.range(0, 6), 0, r, r * (birch ? 1.1 : 0.75), r)), c);
    fringe(b, P, t, hgt, z, r * 0.9, 2, c, rng, jungle ? 'frond' : 'leaves');
    if (jungle && rng.next() < 0.6) for (let k = 0; k < 3; k++) b.cards.of(b.mats.ivy).add(cardGeo('leaves'), P.clone().multiply(mtx(t + rng.range(-0.8, 0.8), hgt - 1.6 - k * 1.1, z + 0.6, rng.range(-0.4, 0.4), 0, 0.5, 1.2, 1)), [0.6, 0.8, 0.5]);
  }
  for (let i = 0; i < Math.round(L / 3); i++) {
    const x = rng.range(-L / 2, L / 2);
    b.box(pm.bark, P.clone().multiply(mtx(x, rng.range(1.2, 2.6), -rng.range(0.1, 0.4), rng.range(-0.8, 0.8), rng.range(-0.9, -0.3))), 0.06, 0.06, rng.range(1, 1.8), [0.55, 0.5, 0.46]);
  }
  b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, 1.4, -1.6)), L, 2.8, 2.6);
}

/**
 * Suburban garden hedge (Thuja, privet), 2.2 to 2.7 m, 1.3 m deep, grown out and patchy, with a
 * wooden fence filling the odd dead gap and a shed roof or a gable behind now and then.
 */
function edgeHedge(b: Builder, p: Prop, rng: Rng): void {
  const pm = plantMats(b.mats);
  const m = b.mats;
  const P = at(p);
  const L = p.size;
  const n = Math.max(1, Math.round(L / 1.2));
  const seg = L / n;
  const base: RGB = rng.next() < 0.6 ? [0.5, 0.66, 0.46] : [0.62, 0.7, 0.44];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * seg;
    if (rng.next() < 0.1 && i > 0 && i < n - 1) {
      // Dead gap closed by a board fence (still a wall).
      b.box(m.wood, P.clone().multiply(new Matrix4().makeTranslation(x, 0.95, -0.7)), seg, 1.9, 0.06, [0.6, 0.52, 0.44]);
      for (let k = 0; k < 3; k++) b.box(m.wood, P.clone().multiply(new Matrix4().makeTranslation(x - seg / 2 + (k + 0.5) * (seg / 3), 0.95, -0.66)), 0.1, 1.95, 0.05, [0.5, 0.44, 0.38]);
      continue;
    }
    const h = rng.range(2.2, 2.7);
    const c = mul(base, rng.range(0.82, 1.1));
    b.box(pm.foliage, P.clone().multiply(mtx(x, h / 2, -0.65 + rng.range(-0.05, 0.05), 0, rng.range(-0.03, 0.03), 1, 1, 1, rng.range(-0.02, 0.02))), seg + 0.1, h, 1.25, c, 1);
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(x + rng.range(-0.2, 0.2), h, -0.65, rng.range(0, 6), 0, seg * 0.45, rng.range(0.15, 0.35), 0.6)), mul(c, 1.08));
    if (rng.next() < 0.6) fringe(b, P, x, h * rng.range(0.4, 0.9), -0.1, 0.45, 1 + rng.int(2), c, rng);
  }
  // Behind it: a shed roof or a house gable peeks over.
  if (rng.next() < 0.45) {
    const x = rng.range(-L / 2 + 1.5, L / 2 - 1.5);
    b.box(m.wood, P.clone().multiply(new Matrix4().makeTranslation(x, 1.2, -2.6)), 2.4, 2.4, 2, [0.5, 0.42, 0.36]);
    b.box(m.corrugated, P.clone().multiply(mtx(x, 2.55, -2.6, 0, 0.18)), 2.8, 0.06, 2.5, rng.pick([g3(0.7), [0.75, 0.45, 0.38], [0.45, 0.6, 0.5]] as RGB[]));
  }
  b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, 1.2, -0.65)), L, 2.4, 1.25);
}

// ---------------------------------------------------------------- street end and fallen tree

/** Local prop at (x, z) in `p`'s frame, turned by `yaw` against it. */
function sub(p: Prop, kind: Prop['kind'], x: number, z: number, yaw: number, size = 1): Prop {
  const [wx, wz] = world(p, x, z);
  return { kind, x: wx, z: wz, rot: p.rot + yaw, size };
}

/**
 * Street end: a row of jersey barriers along the face, behind it wrecked cars pushed across the
 * street, sandbags and rubble in the gaps, a bent tram stop shelter at one end. Narrow paths get
 * sandbags and rubble only.
 */
function barricade(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const L = p.size;
  const P = at(p);
  // Jersey barriers.
  const nb = Math.max(1, Math.round(L / 2.2));
  const bw = L / nb;
  for (let i = 0; i < nb; i++) {
    const x = -L / 2 + (i + 0.5) * bw;
    if (rng.next() < 0.12) continue;
    const k = rng.range(1.05, 1.3);
    const shove = mtx(x, 0, -0.38 - rng.range(0, 0.1), rng.range(-0.08, 0.08));
    b.box(m.cobbles, P.clone().multiply(shove).multiply(new Matrix4().makeTranslation(0, 0.2, 0)), bw - 0.12, 0.4, 0.7, g3(k, 1, 0.95));
    b.box(m.cobbles, P.clone().multiply(shove).multiply(new Matrix4().makeTranslation(0, 0.62, 0)), bw - 0.16, 0.45, 0.3, g3(k, 1, 0.95));
    if (i % 2 === 0) b.box(m.awning, P.clone().multiply(shove).multiply(new Matrix4().makeTranslation(0, 0.7, 0.16)), bw * 0.5, 0.18, 0.01);
  }
  if (L < 8) {
    for (let x = -L / 2 + 1; x < L / 2; x += 2) buildProp(b, sub(p, 'sandbags', x, -1.4, rng.range(-0.15, 0.15)), rng);
    buildProp(b, sub(p, 'rubble', rng.range(-1, 1), -2.3, 0, 1.1), rng);
  } else {
    // Cars across the street, a shelter at one end, sandbags and rubble in between.
    const slots = Math.max(2, Math.floor((L - 1) / 4.7));
    const sw = L / slots;
    const shelter = rng.int(2) ? 0 : slots - 1;
    for (let i = 0; i < slots; i++) {
      const x = -L / 2 + (i + 0.5) * sw;
      if (i === shelter) tramStop(b, P, rng, x, -1.9);
      else if (rng.next() < 0.8) buildProp(b, sub(p, 'car', x + rng.range(-0.3, 0.3), -1.9 + rng.range(-0.25, 0.15), Math.PI / 2 + rng.range(-0.25, 0.25) + (rng.next() < 0.5 ? Math.PI : 0)), rng);
      else buildProp(b, sub(p, 'rubble', x, -1.9, 0, 1.3), rng);
      if (i < slots - 1) buildProp(b, sub(p, 'sandbags', x + sw / 2, -1.0, rng.range(-0.2, 0.2)), rng);
    }
  }
  // A hand-painted board on the barriers: the way is shut.
  b.box(m.wood, P.clone().multiply(mtx(rng.range(-L / 4, L / 4), 1.25, -0.3, 0, -0.08)), 1.8, 0.6, 0.04, [0.8, 0.72, 0.6]);
  b.box(m.awning, P.clone().multiply(mtx(0, 1.3, -0.27, 0, -0.08)), 1.2, 0.12, 0.01);
  b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, 0.7, -1.5)), L, 1.4, 3);
}

/** A tram stop shelter, bent and stripped: posts, roof, a smashed back panel, the round stop sign. */
function tramStop(b: Builder, P: Matrix4, rng: Rng, x: number, z: number): void {
  const m = b.mats;
  const F = P.clone().multiply(mtx(x, 0, z, rng.range(-0.15, 0.15), 0, 1, 1, 1, rng.range(-0.06, 0.06)));
  for (const sx of [-1.6, 1.6]) for (const sz of [-0.6, 0.6]) b.box(m.iron, F.clone().multiply(new Matrix4().makeTranslation(sx, 1.25, sz)), 0.08, 2.5, 0.08, g3(0.6));
  b.box(m.iron, F.clone().multiply(mtx(0, 2.55, 0, 0, 0.06)), 3.6, 0.1, 1.6, g3(0.5));
  b.box(m.carGlass, F.clone().multiply(new Matrix4().makeTranslation(0, 1.3, -0.62)), 3.1, 1.9, 0.03, [2.2, 2.3, 2.2]);
  b.box(m.wood, F.clone().multiply(new Matrix4().makeTranslation(0, 0.5, 0.2)), 2.4, 0.06, 0.4, [0.6, 0.5, 0.4]);
  b.geo(m.iron, new CylinderGeometry(0.04, 0.04, 2.8, 6), F.clone().multiply(new Matrix4().makeTranslation(1.95, 1.4, 0.6)), g3(0.6));
  b.geo(m.enamel, new CircleGeometry(0.28, 14), F.clone().multiply(new Matrix4().makeTranslation(1.95, 2.6, 0.63)), [1.25, 1.15, 0.35]);
  b.geo(m.enamel, new CircleGeometry(0.2, 14), F.clone().multiply(new Matrix4().makeTranslation(1.95, 2.6, 0.64)), [0.35, 0.75, 0.4]);
}

/** Fallen tree along local x: trunk, root plate with earth at one end, snapped branches, moss. */
function fallenTree(b: Builder, p: Prop, rng: Rng): void {
  const pm = plantMats(b.mats);
  const P = at(p);
  const L = p.size;
  const r = rng.range(0.28, 0.42);
  const dir = rng.next() < 0.5 ? 1 : -1;
  const bark: RGB = rng.next() < 0.3 ? g3(1.5) : [0.6, 0.54, 0.5];
  b.geo(pm.bark, new CylinderGeometry(r * 0.6, r, L, 8), P.clone().multiply(mtx(0, r * 0.85, 0, 0, 0, 1, 1, 1, dir * Math.PI / 2 + rng.range(-0.04, 0.04))), bark);
  // Root plate at the thick end: an earth disc on edge with root stubs.
  const ex = -dir * L / 2;
  b.geo(b.mats.burlap, new CircleGeometry(r * 3.2, 9), P.clone().multiply(mtx(ex - dir * 0.1, r * 2.2, 0, dir * Math.PI / 2)), [0.55, 0.45, 0.36]);
  b.geo(b.mats.burlap, new CircleGeometry(r * 3.2, 9), P.clone().multiply(mtx(ex - dir * 0.25, r * 2.2, 0, -dir * Math.PI / 2)), [0.45, 0.37, 0.3]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(pm.bark, P.clone().multiply(mtx(ex - dir * 0.2, r * 2.2 + Math.sin(a) * r * 2.4, Math.cos(a) * r * 2.4, 0, a)), 0.12, 0.12, 0.9, [0.45, 0.4, 0.36]);
  }
  // Snapped branches and some brown leaves on the crown end.
  for (let i = 0; i < 5; i++) {
    const x = rng.range(-L / 2 + 1, L / 2 - 0.5) * 1;
    b.box(pm.bark, P.clone().multiply(mtx(x, r * 1.5, rng.range(-0.2, 0.2), rng.range(0, Math.PI), rng.range(-1.2, -0.5))), 0.08, 0.08, rng.range(0.8, 1.8), bark);
  }
  fringe(b, P, dir * L * 0.35, r * 2, 0, 0.9, 3, rng.next() < 0.5 ? [0.9, 0.62, 0.36] : [0.6, 0.66, 0.44], rng);
  b.shadowBox(P.clone().multiply(new Matrix4().makeTranslation(0, r, 0)), L, r * 2, r * 2);
}

const KINDS: ReadonlySet<string> = new Set(['brandwand', 'rubbleWall', 'thicket', 'overgrowth', 'edgeHedge', 'barricade', 'fallenTree']);

/** Builds `p` if it is an edge front piece; false otherwise. */
export function buildEdgeProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind) {
    case 'brandwand': brandwand(b, p, rng); break;
    case 'rubbleWall': rubbleWall(b, p, rng); break;
    case 'thicket': thicket(b, p, rng, false); break;
    case 'overgrowth': thicket(b, p, rng, true); break;
    case 'edgeHedge': edgeHedge(b, p, rng); break;
    case 'barricade': barricade(b, p, rng); break;
    case 'fallenTree': fallenTree(b, p, rng); break;
  }
  return true;
}
