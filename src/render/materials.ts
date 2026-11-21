// Material factory: every lit surface asks here.
import {
  Color, DoubleSide, FrontSide, MeshBasicMaterial, MeshStandardMaterial,
  type ColorRepresentation, type Material, type Side, type Texture,
} from 'three';
import type { Look } from './looks';
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

export type LitMaterial = MeshStandardMaterial;

export class Materials {
  constructor(
    readonly look: Look,
    readonly profile: Profile,
  ) {}

  /** A lit surface. */
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
    return new MeshStandardMaterial({
      ...common,
      roughness: p.roughness ?? 0.85,
      metalness: p.metalness ?? 0,
      normalMap: this.profile.normalMaps ? (p.normalMap ?? null) : null,
    });
  }

  /** Converts a loaded glTF material, keeping its texture, normal map (Qualität only), color and vertex colors. */
  fromGltf(src: Material): LitMaterial {
    const s = src as MeshStandardMaterial;
    return this.surface({
      map: s.map,
      normalMap: s.normalMap,
      color: s.color,
      roughness: s.roughness,
      vertexColors: s.vertexColors,
      doubleSided: s.side === DoubleSide,
    });
  }

  /** Unlit, for glow decals and effects. */
  static glow(map: Texture | null, color: ColorRepresentation, opacity = 1): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, fog: false });
    // M16 sky per zone: `World.setLamps` scales glow decals from this base.
    m.userData.glowBase = opacity;
    return m;
  }
}
