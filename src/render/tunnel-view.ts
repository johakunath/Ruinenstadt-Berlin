// M20 tunnel content in 3D (`src/data/tunnel.ts`): station name plates, the flooded stretch, the
// maintenance bypass, the generator (static, merged into the map chunks) and what moves with the
// sim (gratings, the hold ring with its charge arc, the end platform's power). Reads sim state,
// never writes it; gratings pose from sim time.
//
// Cost: 3 sign materials (one per station name, merged per chunk); the flood is one see-through
// mesh (1 draw call, the river's scrolling ripple normal map, Qualität only); each grating is 4 merged
// meshes (panel 2, hidden once open; frame 2), frustum-culled; the hold ring is 3 unlit meshes on the
// FX layer; strip lamps 1 mesh, generator lamp 1. No new lights: the power comes from four extra spots
// in the existing light pool that stay at intensity 0 (never picked) until the generator runs.
import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Vector3, type Material } from 'three';
import { GENERATOR, lineDist, type MapDef, type Pt } from '../data/map';
import { FX_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import { paintStationSign } from './paint';
import { Builder, type Mats } from './world';

type RGB = readonly [number, number, number];

/** What a chunk builder offers (map-world's ChunkBuilder). */
interface Chunk {
  box(mat: Material, m: Matrix4, sx: number, sy: number, sz: number, color?: RGB, uvScale?: number): void;
  geo(mat: Material, geo: import('three').BufferGeometry, m: Matrix4, color?: RGB): void;
  shadowBox(m: Matrix4, sx: number, sy: number, sz: number): void;
}
interface TunnelMats extends Mats { water: LitMaterial; railSteel: LitMaterial }

/** A light spot of the map's pool (map-world `LightSpot`). */
export interface GridSpot { pos: Vector3; color: number; intensity: number; distance: number; flicker: number; phase: number }

const hex = (c: string): RGB => { const n = parseInt(c.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
/** BVG yellow and black for the grating stripes (tints on the light enamel). */
const YELLOW: RGB = [1.15, 0.62, 0.04];
const BLACK: RGB = [0.08, 0.08, 0.08];
/** Grating height and the time it takes to sink into its floor slot. */
export const GATE = { h: 3.4, sink: 1.4 } as const;

/** Line color as a vertex tint on the tiled band (the concrete texture darkens it). */
export function lineTint(color: string): RGB {
  const [r, g, b] = hex(color);
  return [r * 1.7, g * 1.7, b * 1.7];
}

/**
 * Static tunnel extras into the map chunks: name plates, bypass floor and pipes, the generator body.
 * `materials` makes the three sign materials.
 */
export function buildTunnelExtras(m: MapDef, mats: TunnelMats, materials: Materials, chunkOf: (x: number, z: number) => Chunk): void {
  const T = m.tunnel!;
  // Name plates: one material per station name, a dark frame behind.
  const signMats = new Map<string, LitMaterial>();
  const plate = new PlaneGeometry(2.8, 0.52);
  for (const s of T.signs) {
    let mat = signMats.get(s.text);
    if (!mat) {
      const t = paintStationSign(s.text);
      signMats.set(s.text, (mat = materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.45 })));
    }
    const b = chunkOf(s.x, s.z);
    const f = new Matrix4().makeRotationY(s.rot).setPosition(s.x, 2.95, s.z);
    b.box(mats.iron, f.clone().multiply(new Matrix4().makeTranslation(0, 0, -0.03)), 2.95, 0.66, 0.05, [0.6, 0.6, 0.6]);
    b.geo(mat, plate, f.clone().multiply(new Matrix4().makeTranslation(0, 0, 0.005)));
  }
  // Flooded stretch: the water itself is one mesh in the view (`buildTunnelView`); the wet foot of the
  // walls is drawn on the wall faces (map-world `buildTunnel`; the loose rims stood free at the station cap).
  // Maintenance bypass: a concrete walkway with a yellow edge and two pipes on the outer wall.
  for (const t of T.tubes) {
    if (t.kind !== 'bypass') continue;
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!, [bx, bz] = t.pts[i]!, len = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(ux, uz);
      // The ends of the passage turn back into the track bed: draw the walkway, its edge and pipes only
      // where they are off the track (playtest 2026-11-18: the slab cut across the rails there).
      const track = T.tubes.find((q) => q.kind === 'track')!;
      const off = (x: number, z: number): boolean => lineDist(track.pts, x, z) > track.width / 2 + 0.1;
      const nx = uz, nz = -ux, w = t.width / 2 - 0.12;
      const STEP = 0.5;
      for (let d = 0; d < len; d += STEP) {
        const l = Math.min(STEP, len - d), cx = ax + ux * (d + l / 2), cz = az + uz * (d + l / 2), b = chunkOf(cx, cz);
        const m = (o: number, y: number): Matrix4 => new Matrix4().makeRotationY(yaw).setPosition(cx + nx * o, y, cz + nz * o);
        // The whole width of the slab must be off the track, not only its middle.
        if (lineDist(track.pts, cx, cz) > track.width / 2 + t.width / 2) b.box(mats.concrete, m(0, 0.05), t.width - 0.3, 0.1, l + 0.02, [0.55, 0.53, 0.5]);
        // North wall (outward normal towards -z): two pipes; the yellow edge on the track side.
        if (off(cx + nx * w, cz + nz * w)) for (const [y, r] of [[1.25, 0.11], [1.6, 0.07]] as const) b.box(mats.rust, m(w, y), r * 2, r * 2, l + 0.02, [0.75, 0.62, 0.5]);
        if (off(cx - nx * (w - 0.08), cz - nz * (w - 0.08))) b.box(mats.enamel, m(-(w - 0.08), 0.11), 0.14, 0.03, l, YELLOW);
      }
    }
  }
  // Generator: a skid with the engine block, radiator grille, exhaust and a cable run to the wall.
  {
    const G = T.generator, b = chunkOf(G.x, G.z), f = new Matrix4().makeRotationY(G.rot).setPosition(G.x, 0, G.z);
    const at = (x: number, y: number, z: number): Matrix4 => f.clone().multiply(new Matrix4().makeTranslation(x, y, z));
    b.box(mats.iron, at(0, 0.1, 0), GENERATOR.hx * 2, 0.2, GENERATOR.hz * 2, [0.7, 0.7, 0.7]);
    b.box(mats.enamel, at(-0.2, 0.75, 0), GENERATOR.hx * 2 - 0.6, 1.1, GENERATOR.hz * 2 - 0.25, [0.32, 0.4, 0.3]);
    b.box(mats.iron, at(GENERATOR.hx - 0.3, 0.7, 0), 0.4, 1.0, GENERATOR.hz * 2 - 0.2, [0.5, 0.5, 0.5]);
    for (let k = -2; k <= 2; k++) b.box(mats.iron, at(GENERATOR.hx - 0.08, 0.7, k * 0.22), 0.04, 0.85, 0.06, [0.25, 0.25, 0.25]);
    b.box(mats.rust, at(-0.9, 1.7, -0.3), 0.14, 1.0, 0.14, [0.8, 0.7, 0.6]);
    b.box(mats.enamel, at(-0.2, 1.33, 0), GENERATOR.hx * 2 - 0.4, 0.06, GENERATOR.hz * 2 - 0.15, YELLOW);
    b.box(mats.rubber, at(-0.4, 0.05, -GENERATOR.hz - 0.8), 0.1, 0.08, 1.6, [0.4, 0.4, 0.4]);
    b.shadowBox(at(0, 0.7, 0), GENERATOR.hx * 2, 1.4, GENERATOR.hz * 2);
  }
}

export interface TunnelState {
  /** Sim time (interpolated) and when each grating opened (Infinity: closed). */
  time: number;
  gateT: readonly number[];
  /** Hold ring: charge 0..1 and whether the hero stands in it; null when no hold runs. */
  hold: { k: number; inside: boolean } | null;
  /** The generator encounter is current and not started yet (a faint ring invites). */
  invite: boolean;
  /** Sim time the end platform got power (null: dark). */
  power: number | null;
}

export interface TunnelView {
  readonly group: Group;
  /** Extra light spots for the pool (end platform ceiling lamps), intensity driven by `update`. */
  readonly spots: GridSpot[];
  update(s: TunnelState, dt: number): void;
}

/** Gratings, hold ring, power lamps. Built once per map; `update` every frame. */
export function buildTunnelView(m: MapDef, mats: TunnelMats, materials: Materials): TunnelView {
  const T = m.tunnel!;
  const group = new Group();
  group.name = 'tunnel';
  // Gratings: frame posts stay, the barred panel sinks into its floor slot when the fight is won.
  const gates = T.gates.map((g) => {
    const root = new Group();
    root.position.set(g.x, 0, g.z);
    root.rotation.y = g.rot;
    const b = new Builder(mats);
    const W = g.half * 2, H = GATE.h;
    // Bars across the track (local x), a stripe beam on top and at the foot.
    for (let x = -W / 2 + 0.12; x < W / 2; x += 0.24) b.box(mats.iron, new Matrix4().setPosition(x, H / 2, 0), 0.05, H, 0.05, [0.75, 0.75, 0.72]);
    for (const y of [0.9, 2.1]) b.box(mats.iron, new Matrix4().setPosition(0, y, 0), W, 0.07, 0.08, [0.6, 0.6, 0.58]);
    // The top beam is deep, so its stripes read from the camera above.
    for (const [y, h, d] of [[H - 0.16, 0.32, 0.42], [0.14, 0.28, 0.16]] as const) {
      const n = Math.ceil(W / 0.6);
      for (let i = 0; i < n; i++) b.box(mats.enamel, new Matrix4().setPosition(-W / 2 + (i + 0.5) * (W / n), y, 0), W / n + 0.002, h, d, i % 2 ? BLACK : YELLOW);
    }
    const panel = new Group();
    for (const mesh of b.solid.meshes()) { mesh.castShadow = true; mesh.receiveShadow = true; panel.add(mesh); }
    root.add(panel);
    // Fixed frame: posts against the wall faces (the panel reaches 0.6 m into the walls) and the floor slot, also BVG-striped.
    const fb = new Builder(mats);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) fb.box(mats.enamel, new Matrix4().setPosition(s * (W / 2 - 0.7), 0.32 + k * 0.58, 0), 0.26, 0.58, 0.3, k % 2 ? BLACK : YELLOW);
      fb.box(mats.enamel, new Matrix4().setPosition(s * (W / 2 - 0.7), H + 0.12, 0), 0.4, 0.24, 0.5, YELLOW);
    }
    fb.box(mats.iron, new Matrix4().setPosition(0, 0.02, 0), W + 0.5, 0.05, 0.36, [0.3, 0.3, 0.3]);
    for (const mesh of fb.solid.meshes()) { mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); }
    group.add(root);
    return { root, panel };
  });

  // Flooded stretch: one ribbon of murky, see-through water 0.17 m over the track bed (rails show
  // through). It shares the river's ripple normal map (scrolled by the map world, Qualität only).
  if (T.flood) {
    const pts = T.flood.pts, half = T.flood.width / 2, pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
    pts.forEach(([x, z], i) => {
      const [px, pz] = pts[Math.max(0, i - 1)]!, [qx, qz] = pts[Math.min(pts.length - 1, i + 1)]!;
      const l = Math.hypot(qx - px, qz - pz), ux = (qx - px) / l, uz = (qz - pz) / l;
      for (const sd of [-1, 1]) {
        const vx = x + uz * half * sd, vz = z - ux * half * sd;
        pos.push(vx, 0.17, vz);
        uv.push(vx / 700, vz / 700);
        nor.push(0, 1, 0);
      }
      // sd -1 is the south edge (2i), +1 the north edge (2i + 1); wound to face up.
      if (i > 0) idx.push(2 * i - 1, 2 * i - 2, 2 * i + 1, 2 * i - 2, 2 * i, 2 * i + 1);
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    const mat = materials.surface({ color: 0x0b2a33, emissive: 0x05202a, roughness: 0.08, metalness: 0.4, normalMap: mats.water.normalMap ?? null });
    mat.transparent = true;
    mat.opacity = 0.8;
    mat.depthWrite = false;
    const water = new Mesh(g, mat);
    water.receiveShadow = true;
    water.renderOrder = 1;
    group.add(water);
  }

  // Hold ring around the generator: dashed outer ring, the charge arc and a soft fill.
  const enc = m.encounters.find((e) => e.hold);
  const flat = (geo: RingGeometry | CircleGeometry, color: number, opacity: number): Mesh => {
    const mesh = new Mesh(geo, new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.layers.set(FX_LAYER);
    mesh.renderOrder = 2;
    return mesh;
  };
  const ring = new Group();
  const R = enc?.hold?.r ?? 8;
  const dash = new RingGeometry(R - 0.12, R, 96, 1);
  // Dashes: keep every other of 48 slices (6 indices per segment).
  { const idx = dash.getIndex()!, out: number[] = []; for (let i = 0; i < idx.count; i += 6) if (Math.floor(i / 12) % 2 === 0) for (let k = 0; k < 6; k++) out.push(idx.getX(i + k)); dash.setIndex(out); }
  const dashMesh = flat(dash, 0xf2d14b, 0.55);
  const arcGeo = new RingGeometry(R - 0.75, R - 0.3, 96, 1, Math.PI / 2, -Math.PI * 2);
  const arc = flat(arcGeo, 0xf2d14b, 0.85);
  const fill = flat(new CircleGeometry(R, 64), 0xf2d14b, 0.05);
  ring.add(fill, dashMesh, arc);
  // Above the platform tiles (0.08 m), so the ring reads on the platform edge too.
  ring.position.set(enc?.x ?? 0, 0.12, enc?.z ?? 0);
  ring.visible = false;
  group.add(ring);

  // Power: strip lamps on the end station walls (one emissive mesh) and four ceiling light spots.
  const end = T.tubes.filter((t) => t.kind === 'station').at(-1)!;
  const [a, bp] = end.pts as [Pt, Pt];
  const len = Math.hypot(bp[0] - a[0], bp[1] - a[1]), ux = (bp[0] - a[0]) / len, uz = (bp[1] - a[1]) / len, yaw = Math.atan2(ux, uz);
  const stripMat = materials.surface({ color: 0x2a3034, emissive: 0xd8ecff, emissiveIntensity: 0.02, roughness: 0.5 });
  const lb = new Builder(mats);
  for (const s of [-1, 1]) for (let d = 4; d < len - 2; d += 6) {
    const off = end.width / 2 - 0.12, x = a[0] + ux * d + uz * off * s, z = a[1] + uz * d - ux * off * s;
    lb.box(stripMat, new Matrix4().makeRotationY(yaw).setPosition(x, 3.7, z), 0.16, 0.12, 2.4);
  }
  for (const mesh of lb.solid.meshes()) group.add(mesh);
  const spots: GridSpot[] = [0.15, 0.4, 0.65, 0.9].map((k, i) => ({
    pos: new Vector3(a[0] + ux * len * k, 3.6, a[1] + uz * len * k), color: 0xd8ecff, intensity: 0, distance: 15, flicker: 0, phase: i * 1.3,
  }));
  // Generator lamp: dull amber while dead, bright yellow once running.
  const G = T.generator;
  const lampMat = materials.surface({ color: 0x3a2a10, emissive: 0xf2d14b, emissiveIntensity: 0.15, roughness: 0.4 });
  const lamp = new Mesh(new PlaneGeometry(0.9, 0.22), lampMat);
  const lf = new Matrix4().makeRotationY(G.rot).setPosition(G.x, 0, G.z).multiply(new Matrix4().makeTranslation(-0.2, 0.75, GENERATOR.hz - 0.1));
  lamp.applyMatrix4(lf);
  group.add(lamp);

  let t = 0;
  return {
    group,
    spots,
    update(s: TunnelState, dt: number): void {
      t += dt;
      gates.forEach((g, i) => {
        const k = Math.min(1, Math.max(0, (s.time - (s.gateT[i] ?? Infinity)) / GATE.sink));
        // Sinks with a short jolt at the start; hidden once down.
        const jolt = k > 0 && k < 0.15 ? Math.sin(k * 120) * 0.04 : 0;
        g.panel.position.y = -GATE.h * k * k + jolt;
        g.panel.visible = k < 1;
      });
      ring.visible = !!s.hold || s.invite;
      if (s.hold) {
        arc.visible = true;
        arcGeo.setDrawRange(0, Math.round(96 * s.hold.k) * 6);
        (dashMesh.material as MeshBasicMaterial).opacity = s.hold.inside ? 0.6 : 0.35 + 0.3 * Math.abs(Math.sin(t * 6));
        (fill.material as MeshBasicMaterial).opacity = s.hold.inside ? 0.035 : 0.015;
      } else {
        arc.visible = false;
        (dashMesh.material as MeshBasicMaterial).opacity = 0.25 + 0.1 * Math.sin(t * 2.5);
        (fill.material as MeshBasicMaterial).opacity = 0.02;
      }
      // Power comes up over a second (from sim time) with a flicker, as old tubes do.
      const power = s.power === null ? 0 : Math.min(1, Math.max(0, (s.time - s.power) / 1.2));
      const on = power <= 0 ? 0 : power < 1 ? power * (0.6 + 0.4 * Math.abs(Math.sin(t * 37))) : 1;
      stripMat.emissiveIntensity = 0.02 + 2.2 * on;
      lampMat.emissiveIntensity = 0.15 + (s.hold ? 0.6 * s.hold.k : 0) + 1.8 * on;
      for (const sp of spots) sp.intensity = 10 * on;
    },
  };
}
