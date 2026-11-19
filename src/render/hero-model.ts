// One hero body (H1 step 4): a clone of hero.glb with its clothing pieces and body regions found by
// node name, the look switch, and the spring chains (scarf tail, coat back panels). The game's
// HeroView and the inventory preview each own one; geometry and materials are shared. WP4 step 2:
// a look also picks each piece's variant (palette, coat cut, shoulder volume; `hero-wear.ts`) and
// the rigid gear meshes (`gear.ts`), and can hide the hair.
import { BufferGeometry, Quaternion, SkinnedMesh, Vector3, type Mesh, type Object3D } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { HERO_REGIONS, type BodyRegion } from '../data/hero-contract';
import { PIECES, hiddenRegions, lookNodes, sameLook, type HeroLook } from '../data/hero-look';
import { GEAR_SLOTS, gearGeometry, gearMaterials, type GearSlot } from './gear';
import { heroSource, type HeroSource } from './gear-kit';
import { pieceVariant } from './hero-wear';
import type { Materials } from './materials';

const q = new Quaternion();
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const legA = new Vector3();
const legB = new Vector3();
const qFrame = new Quaternion();

/**
 * Back swing (radians) of a coat back panel for a thigh along `leg` (thigh to knee, in the panel's
 * rest frame: Y up, Z forward). The panel follows a leg that swings back and never one that swings
 * forward, so the back of the coat neither lets a leg through nor stretches between the legs.
 */
export function coatSwing(leg: Vector3): number {
  return Math.max(0, Math.atan2(-leg.z, -leg.y));
}

export class HeroModel {
  readonly model: Object3D;
  private readonly pieces = new Map<string, Object3D>();
  private readonly regions = new Map<BodyRegion, Object3D>();
  private look: HeroLook | null = null;
  private readonly scarf: Array<{ bone: Object3D; rest: Quaternion; back: number; side: number }> = [];
  /** Coat back panel chains (`coat_b{l,r}_01` and `_02`), with the thigh and knee each one follows. */
  private readonly coat: Array<{ bone: Object3D; low: Object3D; rest: Quaternion; thigh: Object3D; calf: Object3D; a: number; b: number }> = [];
  private prevX = 0;
  private prevZ = 0;
  private time = 0;
  /** Source geometry of each tinted mesh (pieces and scarf), before any variant. */
  private readonly sourceGeo = new Map<SkinnedMesh, BufferGeometry>();
  private readonly hair: Object3D | undefined;
  /** Gear meshes per slot (only with `materials`: NPCs wear no gear). */
  private readonly gear = new Map<GearSlot, SkinnedMesh>();
  private readonly src: HeroSource;
  private readonly boneNames: string[] = [];

  constructor(source: Object3D, materials?: Materials) {
    this.model = cloneSkinned(source);
    this.src = heroSource(source);
    const m = this.model;
    for (const p of Object.values(PIECES)) {
      const o = m.getObjectByName(p.node);
      if (o) this.pieces.set(p.node, o);
    }
    for (const name of [...Object.values(PIECES).map((p) => p.node), 'scarf']) {
      const o = m.getObjectByName(name) as SkinnedMesh | undefined;
      if (o?.isSkinnedMesh) this.sourceGeo.set(o, o.geometry);
    }
    this.hair = m.getObjectByName('hair');
    const anchor = m.getObjectByName('a_mantel') as SkinnedMesh | undefined;
    if (anchor?.isSkinnedMesh) {
      this.boneNames = anchor.skeleton.bones.map((b) => b.name);
      if (materials) {
        const mat = gearMaterials(materials);
        for (const slot of GEAR_SLOTS) {
          const g = new SkinnedMesh(new BufferGeometry(), mat[slot]);
          g.name = `gear_${slot}`;
          g.castShadow = true;
          g.frustumCulled = false;
          g.visible = false;
          g.bind(anchor.skeleton, anchor.bindMatrix);
          anchor.parent!.add(g);
          this.gear.set(slot, g);
        }
      }
    }
    for (const r of HERO_REGIONS) {
      const o = m.getObjectByName(`body_${r}`);
      if (o) this.regions.set(r, o);
    }
    for (const name of ['scarf_01', 'scarf_02', 'scarf_03']) {
      const bone = m.getObjectByName(name);
      if (bone) this.scarf.push({ bone, rest: bone.quaternion.clone(), back: 0, side: 0 });
    }
    for (const side of ['l', 'r']) {
      const [bone, low, thigh, calf] = [`coat_b${side}_01`, `coat_b${side}_02`, `thigh_${side}`, `calf_${side}`].map((n) => m.getObjectByName(n));
      if (bone && low && thigh && calf) this.coat.push({ bone, low, rest: bone.quaternion.clone(), thigh, calf, a: 0, b: 0 });
    }
  }

  /** Every piece, region and gear material visible: for one shader compile at load, so no swap ever compiles. */
  showAll(): void {
    for (const o of this.pieces.values()) o.visible = true;
    for (const o of this.regions.values()) o.visible = true;
    if (this.hair) this.hair.visible = true;
    this.showGear(['warm']);
    this.look = null;
  }

  /**
   * Shows the look's pieces in their variant (palette, cut, shoulder volume), its gear, and hides the
   * body regions under them. Returns false if nothing changed.
   */
  setLook(look: HeroLook): boolean {
    if (this.look && sameLook(this.look, look)) return false;
    const shown = new Set(lookNodes(look));
    const hidden = hiddenRegions(look);
    for (const [node, o] of this.pieces) o.visible = shown.has(node);
    for (const [r, o] of this.regions) o.visible = !hidden.has(r);
    if (this.hair) this.hair.visible = !look.hideHair;
    const outfit = PIECES[look.outfit]?.node, boots = PIECES[look.boots]?.node, gloves = look.gloves ? PIECES[look.gloves]?.node : undefined;
    for (const [mesh, geo] of this.sourceGeo) {
      const n = mesh.name;
      const tint = n === outfit ? look.tint.outfit : n === boots ? look.tint.boots : n === gloves ? look.tint.gloves : n === 'scarf' ? look.tint.scarf : '';
      mesh.geometry = pieceVariant(mesh, n, geo, tint, n === outfit ? look.cut : 0, n === outfit ? look.puff : 0);
    }
    this.showGear(look.gear);
    this.look = { ...look, gear: [...look.gear], covers: [...look.covers] };
    return true;
  }

  /** Puts the merged gear of `ids` on the gear meshes (hidden when a slot has no part). */
  private showGear(ids: readonly string[]): void {
    if (this.gear.size === 0) return;
    const geo = gearGeometry(this.src, this.boneNames, ids);
    const layers = (this.hair as Mesh | undefined)?.layers.mask;
    for (const [slot, mesh] of this.gear) {
      const g = geo[slot];
      mesh.visible = !!g;
      if (g) mesh.geometry = g;
      // Same layers as the body (hero contour, `HeroView` sets them after construction).
      if (layers !== undefined) mesh.layers.mask = layers;
    }
  }

  /**
   * Spring chains after the clips: the scarf tail trails movement; the back of the coat swings out of
   * the way of a leg that goes back (`coatSwing` plus a little margin), trails with speed, and its
   * lower panel lags on a softer spring. `x`, `z`: ground position; `yaw`: facing.
   */
  sway(x: number, z: number, yaw: number, dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    const vx = (x - this.prevX) / dt;
    const vz = (z - this.prevZ) / dt;
    this.prevX = x;
    this.prevZ = z;
    // Velocity in the hero's frame: forward and to the left.
    const fwd = Math.min(9, Math.max(-9, vx * Math.sin(yaw) + vz * Math.cos(yaw)));
    const left = Math.min(9, Math.max(-9, vx * Math.cos(yaw) - vz * Math.sin(yaw)));
    const k = 1 - Math.exp(-dt * 9);
    this.scarf.forEach((s, i) => {
      const flutter = Math.sin(this.time * (7 + i * 2.3) + i) * (0.05 + Math.abs(fwd) * 0.012) * (i + 1);
      const back = fwd * (0.1 + i * 0.03) + flutter + (i === 0 ? 0.12 : 0.05);
      const side = -left * 0.07 + Math.sin(this.time * 3.1 + i * 1.7) * 0.05;
      s.back += (back - s.back) * k * (1 - i * 0.2);
      s.side += (side - s.side) * k * (1 - i * 0.2);
      s.bone.quaternion.copy(s.rest).multiply(q.setFromAxisAngle(X, -s.back)).multiply(q.setFromAxisAngle(Z, s.side));
    });
    if (this.coat.length === 0 || !this.pieces.get(PIECES.mantel!.node)?.visible) return;
    this.model.updateWorldMatrix(true, true);
    for (const c of this.coat) {
      // The leg in the panel's rest frame (follows the pelvis, so a leaning body does not count).
      c.bone.parent!.getWorldQuaternion(qFrame).multiply(c.rest).invert();
      const leg = legB.subVectors(c.calf.getWorldPosition(legB), c.thigh.getWorldPosition(legA)).applyQuaternion(qFrame);
      const swing = coatSwing(leg);
      const want = (swing > 0 ? swing + 0.08 : 0) + Math.max(0, fwd) * 0.02;
      c.a += (want - c.a) * (1 - Math.exp(-dt * 18));
      // The lower panel adds a quarter of the upper one's swing on a softer spring: cloth lag.
      c.b += (Math.max(0, fwd) * 0.03 + c.a * 0.25 - c.b) * (1 - Math.exp(-dt * 8));
      c.bone.quaternion.copy(c.rest).multiply(q.setFromAxisAngle(X, c.a));
      c.low.quaternion.setFromAxisAngle(X, c.b);
    }
  }
}
