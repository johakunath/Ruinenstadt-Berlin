// Material factory. The look decides the shading model; everything else asks here.
import {
  Color, DoubleSide, FrontSide, MeshBasicMaterial, MeshStandardMaterial, MeshToonMaterial,
  type ColorRepresentation, type Material, type Side, type Texture,
} from 'three';
import type { Look } from './looks';
import { toonRamp } from './paint';
import type { Profile } from './profile';

export interface SurfaceParams {
  map?: Texture | null;
  normalMap?: Texture | null;
  color?: ColorRepresentation;
  roughness?: number;
  metalness?: number;
  emissive?: ColorRepresentation;
  emissiveMap?: Texture | null;
  emissiveIntensity?: number;
  vertexColors?: boolean;
  doubleSided?: boolean;
  alphaTest?: number;
}

export type LitMaterial = MeshStandardMaterial | MeshToonMaterial;

export class Materials {
  private readonly ramp: Texture;

  constructor(
    readonly look: Look,
    readonly profile: Profile,
  ) {
    this.ramp = toonRamp();
  }

  /** A lit surface in the current look. */
  surface(p: SurfaceParams): LitMaterial {
    const side: Side = p.doubleSided ? DoubleSide : FrontSide;
    const common = {
      map: p.map ?? null,
      color: new Color(p.color ?? 0xffffff),
      emissive: new Color(p.emissive ?? 0x000000),
      emissiveMap: p.emissiveMap ?? null,
      emissiveIntensity: p.emissiveIntensity ?? 1,
      vertexColors: p.vertexColors ?? false,
      side,
      alphaTest: p.alphaTest ?? 0,
    };
    if (this.look.shading === 'toon') return new MeshToonMaterial({ ...common, gradientMap: this.ramp });
    return new MeshStandardMaterial({
      ...common,
      roughness: p.roughness ?? 0.85,
      metalness: p.metalness ?? 0,
      normalMap: this.profile.normalMaps ? (p.normalMap ?? null) : null,
    });
  }

  /** Converts a loaded glTF material, keeping its texture, color and vertex colors. */
  fromGltf(src: Material): LitMaterial {
    const s = src as MeshStandardMaterial;
    return this.surface({
      map: s.map,
      color: s.color,
      roughness: s.roughness,
      vertexColors: s.vertexColors,
      doubleSided: s.side === DoubleSide,
    });
  }

  /** Unlit, for glow decals and effects. */
  static glow(map: Texture | null, color: ColorRepresentation, opacity = 1): MeshBasicMaterial {
    return new MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, fog: false });
  }
}
