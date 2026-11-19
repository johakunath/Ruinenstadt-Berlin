import { Matrix4, MeshStandardMaterial, Vector3, type Material } from 'three';
import type { Landmark } from '../data/map';
import { Rng } from '../sim/math';
import { boxGeo } from './batch';
import type { ChunkBuilder } from './map-world';
import type { Materials } from './materials';
import { canvas, toTexture } from './paint';
import { swapPaintedMap } from './surface-textures';

const SOOT = 0, CRACK = 1, MOSS = 2, GRAFFITI = 3;
const SCAFFOLDED = new Set<Landmark['kind']>(['rathaus', 'ostbahnhof', 'palast', 'reichstag']);
const wearUrl = new URL('../../assets/textures/landmarks/wear.webp', import.meta.url).href;

/** A single atlas and alpha-tested batch per landmark chunk, with a painted loading fallback. */
export function makeLandmarkWearMaterial(materials: Materials) {
  const [c, ctx] = canvas(256, 256);
  const rng = new Rng(2167);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = '#292520';
    const x = 23 + rng.next() * 80;
    const g = ctx.createLinearGradient(0, 10, 0, 118);
    g.addColorStop(0, '#292520ad');
    g.addColorStop(1, '#29252000');
    ctx.fillStyle = g;
    ctx.fillRect(x, 10 + rng.next() * 24, 1 + rng.next() * 4, 35 + rng.next() * 62);
  }
  ctx.strokeStyle = '#332f2ac4';
  ctx.lineWidth = 2;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(190, 22);
    for (let i = 0; i < 9; i++) ctx.lineTo(190 + dir * (i * 3 + rng.next() * 8), 24 + i * 10);
    ctx.stroke();
  }
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = i % 2 ? '#4d552eae' : '#625941c6';
    ctx.fillRect(10 + rng.next() * 108, 177 + rng.next() * 34, 2 + rng.next() * 8, 2 + rng.next() * 6);
  }
  ctx.strokeStyle = '#507582c7';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(140, 214);
  ctx.lineTo(155, 174);
  ctx.lineTo(168, 210);
  ctx.lineTo(204, 176);
  ctx.lineTo(195, 213);
  ctx.lineTo(235, 185);
  ctx.stroke();
  const mat = materials.surface({ map: toTexture(c, false, materials.profile.anisotropy), alphaTest: 0.38, roughness: 0.92 });
  swapPaintedMap([mat], wearUrl, materials.profile.anisotropy, false);
  return mat;
}

function cell(index: number): [number, number, number, number] {
  const pad = 0.005;
  const u = (index % 2) * 0.5, v = index < 2 ? 0.5 : 0;
  return [u + pad, v + pad, u + 0.5 - pad, v + 0.5 - pad];
}

const shard = boxGeo(1, 1, 1, 0.5);

export class LandmarkWear {
  private readonly rng: Rng;
  private walls = 0;
  private feet = 0;
  private panes = 0;
  private scaffold = false;

  constructor(private readonly b: ChunkBuilder, private readonly landmark: Landmark) {
    this.rng = new Rng((Math.round(landmark.x * 799) ^ Math.round(landmark.z * 211) ^ landmark.kind.length) >>> 0);
    this.panes = this.rng.int(6);
  }

  /** Attach stains to the real facade planes, which can differ from the map footprint. */
  wall(mat: Material, transform: Matrix4, sx: number, sy: number, sz: number): void {
    const finish = this.b.mm.landmarkWear;
    if (!finish || this.walls >= 12 || sy < 2.1 || Math.max(sx, sz) < 3.0 || Math.min(sx, sz) < 0.24) return;
    if (!(mat instanceof MeshStandardMaterial) || mat.roughness < 0.64 || mat.metalness > 0.34 || mat.alphaTest > 0 || mat.emissiveMap) return;
    const axes = transform.elements;
    if (Math.abs(axes[5]! - 1) > 0.015) return;
    this.walls++;
    const floor = axes[13]! - sy / 2;
    // On wide structures both long elevations get weathering. Compact piers get the side treatment as well.
    const faces = sx > sz * 1.5 ? [0, 2] : sz > sx * 1.5 ? [1, 3] : [0, 1, 2, 3];
    for (const face of faces) {
      const width = face % 2 ? sz : sx, depth = face % 2 ? sx : sz;
      if (width < 2.4) continue;
      const f = transform.clone().multiply(new Matrix4().makeRotationY(face * Math.PI / 2));
      const low = floor < 0.8 && floor > -1;
      const texture = low ? (this.walls + face) % 4 === 1 ? GRAFFITI : MOSS : (this.walls + face) % 2 ? SOOT : CRACK;
      const span = Math.min(width * 0.46, low ? 4.6 : 3.6);
      const rise = Math.min(sy * 0.84, texture === MOSS ? 1.55 : texture === GRAFFITI ? Math.min(2.35, 3 - floor - 0.14) : 4.3);
      const x = (this.rng.next() - 0.5) * (width - span) * 0.85;
      const y = low ? -sy / 2 + rise / 2 + 0.14 : (this.rng.next() - 0.5) * (sy - rise);
      this.decal(f, x, y, depth / 2, span, rise, texture);
      if (low && sy >= 5 && face % 2 === 0) {
        this.decal(f, -x, sy * 0.14, depth / 2 + 0.01, span * 0.9, Math.min(sy * 0.58, 4.5), face ? CRACK : SOOT);
      }
      if (low && this.feet < 3 && !this.landmark.walkUnder) {
        this.feet++;
        this.rubble(f, x, -sy / 2, depth / 2);
      }
      if (low && sy >= 4.6 && width >= 8 && !this.scaffold && SCAFFOLDED.has(this.landmark.kind)) {
        this.scaffold = true;
        this.scaffolding(f, -width * 0.29, -sy / 2, depth / 2);
      }
    }
  }

  private decal(face: Matrix4, x: number, y: number, z: number, w: number, h: number, tile: number): void {
    const point = (u: number, v: number) => new Vector3(x + u * w, y + v * h, z + 0.024).applyMatrix4(face);
    this.b.cards.of(this.b.mm.landmarkWear!).quad([point(-0.5, -0.5), point(0.5, -0.5), point(0.5, 0.5), point(-0.5, 0.5)], cell(tile));
  }

  private scaffolding(face: Matrix4, x: number, y: number, z: number): void {
    const { cards, mm } = this.b;
    const piece = (dx: number, dy: number, sx: number, sy: number, sz: number, angle = 0): void => {
      const transform = new Matrix4().makeRotationZ(angle).scale(new Vector3(sx, sy, sz));
      transform.setPosition(x + dx, y + dy, z + 0.18);
      cards.of(mm.rust).add(shard, face.clone().multiply(transform), [0.64, 0.55, 0.45]);
    };
    for (const dx of [-1.25, 1.25]) piece(dx, 1.95, 0.09, 3.9, 0.09);
    for (const dy of [0.48, 2.06, 3.8]) piece(0, dy, 2.64, 0.09, 0.09);
    piece(0, 2.93, 2.99, 0.065, 0.065, 0.59);
    const p = (u: number, v: number, depth: number) => new Vector3(x + u, y + v, z + depth).applyMatrix4(face);
    cards.of(mm.burlap).quad([p(-1.08, 2.13, 0.27), p(0.85, 2.43, 0.23), p(1.14, 3.8, 0.23), p(-1.21, 3.8, 0.24)], [0, 0, 1, 1], [[0.63, 0.73, 0.64]]);
  }

  private rubble(face: Matrix4, x: number, y: number, z: number): void {
    for (let i = 0; i < 5; i++) {
      const size = 0.17 + this.rng.next() * 0.32;
      const m = new Matrix4().makeRotationY(this.rng.next() * Math.PI).scale(new Vector3(size, size * 0.55, size * 0.68));
      m.setPosition(x + (this.rng.next() - 0.5) * 1.5, y + size * 0.26, z + 0.13 + this.rng.next() * 0.44);
      this.b.cards.of(this.b.mm.rust).add(shard, face.clone().multiply(m), [0.82, 0.74, 0.68]);
    }
  }

  /** Existing visible panes keep the authored trim. A few exchange lit glass for dark holes or boards. */
  window(m: Matrix4, w: number, h: number, board = false): boolean {
    if (w < 0.65 || h < 0.75 || (!board && ++this.panes % 9 !== 4)) return false;
    const point = (x: number, y: number, z = 0.044) => new Vector3(x * w, y * h, z).applyMatrix4(m);
    this.b.solid.of(this.b.mm.dark).quad([point(-0.5, -0.5), point(0.5, -0.5), point(0.5, 0.5), point(-0.5, 0.5)]);
    if (board || this.panes % 2 === 0) {
      const boards = this.b.solid.of(this.b.mm.wood);
      boards.quad([point(-0.48, -0.22, 0.072), point(0.48, -0.32, 0.072), point(0.48, -0.1, 0.072), point(-0.48, 0.0, 0.072)], [0, 0, 1, 0.3]);
      boards.quad([point(-0.47, 0.2, 0.072), point(0.47, 0.32, 0.072), point(0.47, 0.49, 0.072), point(-0.47, 0.38, 0.072)], [0, 0.3, 1, 0.6]);
    } else {
      const glass = this.b.solid.of(this.b.mm.glass);
      glass.quad([point(-0.5, -0.5, 0.058), point(0.48, -0.5, 0.058), point(0.08, -0.19, 0.058), point(-0.5, -0.32, 0.058)]);
    }
    return true;
  }

  /** Narrow towers and sculptural landmarks can have no qualifying facade box. */
  finish(): void {
    if (this.feet || this.landmark.walkUnder) return;
    const { x, z, rot, hx, hz } = this.landmark;
    const face = new Matrix4().makeRotationY(rot).setPosition(x, 0, z);
    this.rubble(face, hx * 0.42, 0, Math.min(hz, 3));
  }
}
