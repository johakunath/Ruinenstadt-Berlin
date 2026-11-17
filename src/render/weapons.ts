// Weapon models, built in code (M7). One model per weapon kind, plus the starter pipe. Every model
// stands along +Y with the grip at the origin; `mountWeapon` puts it into the right hand so that the
// business end follows the hand bone's +Z (what `tools/clip-swing.mjs` measures).
import {
  BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry,
  Vector3, type BufferGeometry, type Object3D,
} from 'three';
import type { ElementId, WeaponKindId } from '../data/items';
import { HERO_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import { paintCloth, paintMetal, paintWood } from './paint';

export type WeaponModel = WeaponKindId | 'pipe';

/**
 * Left hand on two-handed models (H1): grip height along the shaft, meters up the model's +Y from the
 * right-hand grip. `src/render/hand-ik.ts` puts `hand_l` there; one-handed models have none.
 */
export const LEFT_GRIP: Readonly<Partial<Record<WeaponModel, number>>> = { hammer: 0.48, spear: 0.5 };

const UP = new Vector3(0, 1, 0);
const gq = new Quaternion();

const ELEMENT_GLOW: Record<ElementId, number> = { fire: 0xff6a2a, acid: 0x97c459, shock: 0x7dd3ff };

interface Kit {
  steel: LitMaterial;
  rust: LitMaterial;
  wood: LitMaterial;
  wrap: LitMaterial;
  red: LitMaterial;
  rubber: LitMaterial;
  leather: LitMaterial;
  glow: LitMaterial;
}

function kit(materials: Materials): Kit {
  const o = { flatten: materials.look.flatten, normalMaps: false, anisotropy: 1 };
  return {
    steel: materials.surface({ map: paintMetal('#8b9094', o, 73, 0.6).map, roughness: 0.38, metalness: 0.75 }),
    rust: materials.surface({ map: paintMetal('#6a5a50', o, 71, 1.2).map, roughness: 0.5, metalness: 0.6 }),
    wood: materials.surface({ map: paintWood(o, '#7a5636', 47).map, roughness: 0.9 }),
    wrap: materials.surface({ map: paintCloth('#c9b58c', o, 53).map, roughness: 0.95 }),
    red: materials.surface({ color: 0xb8261c, roughness: 0.9, doubleSided: true }),
    rubber: materials.surface({ color: 0x2a2320, roughness: 0.7 }),
    leather: materials.surface({ color: 0x5a3c26, roughness: 0.85 }),
    // Element strip: the only emissive part, so an imbued weapon reads at a glance (bloom picks it up).
    glow: materials.surface({ color: 0x1a1512, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 }),
  };
}

const at = (geo: BufferGeometry, mat: LitMaterial, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Mesh => {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
};

function ribbon(k: Kit, y: number, len = 0.34): Object3D[] {
  return [at(new PlaneGeometry(0.07, len), k.red, -0.05, y - len * 0.35, 0.02, 0, 0, 0.5), at(new CylinderGeometry(0.036, 0.036, 0.05, 8), k.red, 0, y, 0)];
}

/** The starter weapon (2D base `rohr`): a length of pipe with an elbow joint. */
function pipe(k: Kit): Object3D[] {
  return [
    at(new CylinderGeometry(0.026, 0.026, 1.05, 8), k.rust, 0, 0.42, 0),
    at(new CylinderGeometry(0.034, 0.034, 0.2, 8), k.rust, 0.07, 0.94, 0, 0, 0, Math.PI / 2),
    at(new CylinderGeometry(0.04, 0.04, 0.06, 8), k.rust, 0, 0.9, 0),
    at(new CylinderGeometry(0.033, 0.033, 0.26, 8), k.wrap, 0, 0.02, 0),
    ...ribbon(k, 0.74),
  ];
}

/** Klinge: a ground-down leaf spring with a wrench as crossguard. */
function blade(k: Kit): Object3D[] {
  const tip = new ConeGeometry(0.036, 0.16, 4);
  tip.scale(1, 1, 0.22);
  return [
    at(new BoxGeometry(0.066, 0.78, 0.014), k.steel, 0, 0.56, 0),
    at(tip, k.steel, 0, 1.03, 0, 0, Math.PI / 4, 0),
    // Fuller and the darker spine.
    at(new BoxGeometry(0.018, 0.6, 0.018), k.rust, 0.012, 0.52, 0),
    at(new BoxGeometry(0.22, 0.034, 0.03), k.rust, 0, 0.16, 0),
    at(new TorusGeometry(0.028, 0.011, 6, 10), k.rust, 0.11, 0.16, 0),
    at(new CylinderGeometry(0.021, 0.025, 0.25, 8), k.wrap, 0, 0.02, 0),
    at(new SphereGeometry(0.032, 8, 6), k.rust, 0, -0.12, 0),
    at(new BoxGeometry(0.072, 0.1, 0.02), k.glow, 0, 0.26, 0),
    ...ribbon(k, 0.13, 0.28),
  ];
}

/** Hammer: a sledge on a long ash handle, the head a lump of rail steel with bands. */
function hammer(k: Kit): Object3D[] {
  return [
    at(new CylinderGeometry(0.024, 0.03, 1.22, 8), k.wood, 0, 0.42, 0),
    at(new BoxGeometry(0.34, 0.2, 0.2), k.steel, 0, 1.06, 0),
    at(new BoxGeometry(0.06, 0.225, 0.225), k.rust, -0.1, 1.06, 0),
    at(new BoxGeometry(0.06, 0.225, 0.225), k.rust, 0.1, 1.06, 0),
    at(new CylinderGeometry(0.036, 0.036, 0.06, 8), k.rust, 0, 0.94, 0),
    at(new BoxGeometry(0.345, 0.05, 0.21), k.glow, 0, 1.06, 0),
    at(new CylinderGeometry(0.031, 0.031, 0.3, 8), k.wrap, 0, 0, 0),
    at(new CylinderGeometry(0.032, 0.032, 0.14, 8), k.wrap, 0, 0.48, 0),
    ...ribbon(k, 0.86, 0.3),
  ];
}

/** Speer: a pole with a bayonet tip, lashed with wire. */
function spear(k: Kit): Object3D[] {
  const tip = new ConeGeometry(0.05, 0.42, 4);
  tip.scale(1, 1, 0.3);
  return [
    at(new CylinderGeometry(0.02, 0.023, 1.95, 8), k.wood, 0, 0.42, 0),
    at(tip, k.steel, 0, 1.6, 0, 0, Math.PI / 4, 0),
    at(new CylinderGeometry(0.03, 0.026, 0.16, 8), k.rust, 0, 1.36, 0),
    at(new BoxGeometry(0.16, 0.024, 0.024), k.rust, 0, 1.31, 0),
    at(new CylinderGeometry(0.031, 0.031, 0.06, 8), k.glow, 0, 1.25, 0),
    at(new CylinderGeometry(0.026, 0.026, 0.3, 8), k.wrap, 0, 0.02, 0),
    at(new ConeGeometry(0.026, 0.1, 6), k.rust, 0, -0.6, 0, Math.PI, 0, 0),
    ...ribbon(k, 1.18, 0.42),
  ];
}

/** Werfer: a forked slingshot (Zwille) cut from a branch, bicycle tube as band. */
function sling(k: Kit): Object3D[] {
  const arm = new CylinderGeometry(0.016, 0.02, 0.24, 7);
  return [
    at(new CylinderGeometry(0.022, 0.026, 0.24, 8), k.wood, 0, 0.02, 0),
    at(arm, k.wood, -0.07, 0.24, 0, 0, 0, 0.5),
    at(arm, k.wood, 0.07, 0.24, 0, 0, 0, -0.5),
    at(new CylinderGeometry(0.024, 0.024, 0.14, 8), k.wrap, 0, 0, 0),
    at(new BoxGeometry(0.012, 0.3, 0.02), k.rubber, -0.085, 0.36, -0.11, 0.75, 0, 0),
    at(new BoxGeometry(0.012, 0.3, 0.02), k.rubber, 0.085, 0.36, -0.11, 0.75, 0, 0),
    at(new BoxGeometry(0.2, 0.06, 0.012), k.leather, 0, 0.26, -0.21, 0.75, 0, 0),
    at(new SphereGeometry(0.03, 8, 6), k.glow, 0, 0.27, -0.2),
    at(new CylinderGeometry(0.026, 0.026, 0.03, 8), k.red, 0, 0.12, 0),
  ];
}

const BUILD: Record<WeaponModel, (k: Kit) => Object3D[]> = { pipe, blade, hammer, spear, sling };

export class WeaponRack {
  readonly group = new Group();
  private readonly models = new Map<WeaponModel, Group>();
  private readonly kit: Kit;
  private shown: WeaponModel | null = null;

  constructor(materials: Materials) {
    this.kit = kit(materials);
    // Grip offset in the hand bone's frame (checked with `?cam=5,30` close-ups).
    this.group.position.set(0, 0.09, 0.03);
    this.group.rotation.set(Math.PI / 2, 0, 0);
  }

  /** Shows the model for the equipped weapon; models are built on first use. */
  show(model: WeaponModel, element: ElementId | undefined): void {
    this.kit.glow.emissive.setHex(element ? ELEMENT_GLOW[element] : 0x000000);
    this.kit.glow.emissiveIntensity = element ? 2.4 : 0;
    if (model === this.shown) return;
    this.shown = model;
    for (const g of this.models.values()) g.visible = false;
    let g = this.models.get(model);
    if (!g) {
      g = new Group();
      g.add(...BUILD[model](this.kit));
      // Hero layer too: the contour behind buildings includes the weapon (`hero-outline.ts`).
      g.traverse((o) => { o.castShadow = true; o.layers.enable(HERO_LAYER); });
      this.models.set(model, g);
      this.group.add(g);
    }
    g.visible = true;
  }

  /** True when the shown model is held with both hands. */
  get twoHanded(): boolean {
    return this.shown !== null && LEFT_GRIP[this.shown] !== undefined;
  }

  /**
   * World position of the left grip and the shaft direction toward the head. Needs current world
   * matrices. Returns false for one-handed models.
   */
  leftGrip(pos: Vector3, shaft: Vector3): boolean {
    const h = this.shown === null ? undefined : LEFT_GRIP[this.shown];
    if (h === undefined) return false;
    this.group.localToWorld(pos.set(0, h, 0));
    shaft.copy(UP).applyQuaternion(this.group.getWorldQuaternion(gq));
    return true;
  }
}

/** The model for a weapon item: the starter pipe keeps its own look. */
export function weaponModel(kind: WeaponKindId, base: string): WeaponModel {
  return kind === 'blade' && base === 'rohr' ? 'pipe' : kind;
}
