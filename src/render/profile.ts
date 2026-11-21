// Render profiles (plan-3d.md › Render budget, Q1 three levels 2026-11-20). Qualität is the PC
// fidelity target, Ausgewogen (the Leistung of before) keeps tablets at 60 fps, Leistung is the
// lightest level for phones and hot devices. Only the picture differs: map data, colliders, lots
// and lights come from `src/data` and are the same on every level (Q1).

export type ProfileId = 'qualitaet' | 'ausgewogen' | 'leistung';

export interface Profile {
  id: ProfileId;
  label: string;
  maxDpr: number;
  msaa: number;
  shadowMap: number;
  /** The sun shadow map renders every n-th frame (`shadow-rate.ts`); 1 = every frame. */
  shadowEvery: number;
  /** Only the caster boxes throw shadows, not the merged map chunks (the `?shadows=boxes` switch). */
  boxShadows: boolean;
  /** Enemies cast real shadows; otherwise they get a blob shadow. */
  enemyShadows: boolean;
  maxPointLights: number;
  gtao: boolean;
  /** Resolution of the normal/depth pre-pass used by GTAO and the ink outline. */
  gbufferScale: number;
  bloomStrength: number;
  /** Bloom chain resolution relative to the frame. */
  bloomScale: number;
  normalMaps: boolean;
  /** Painted tiles load at half size (plants, corrugated metal, ruin brick). */
  smallTextures: boolean;
  /** Enemies farther than this (meters from the hero) animate at half / third rate. 0 = always full rate. */
  animHalfRateFrom: number;
  animThirdRateFrom: number;
  embers: number;
  anisotropy: number;
  /** Dynamic resolution: lowest render scale when frames run late (`dyn-res.ts`); 1 = off. */
  minScale: number;
  /**
   * The ink outline reads depth from the beauty pass instead of its own normal/depth pre-pass:
   * one scene render less per frame (about a third of the draw calls), silhouette lines only.
   */
  inkFromBeauty: boolean;
}

export const PROFILES: Record<ProfileId, Profile> = {
  qualitaet: {
    id: 'qualitaet', label: 'Qualität', maxDpr: 2, msaa: 4, shadowMap: 2048, shadowEvery: 1, boxShadows: false, enemyShadows: true, maxPointLights: 8,
    gtao: true, gbufferScale: 1, bloomStrength: 1, bloomScale: 1, normalMaps: true, smallTextures: false,
    animHalfRateFrom: 0, animThirdRateFrom: 0, embers: 140, anisotropy: 8, minScale: 1, inkFromBeauty: false,
  },
  ausgewogen: {
    id: 'ausgewogen', label: 'Ausgewogen', maxDpr: 1.25, msaa: 0, shadowMap: 1024, shadowEvery: 2, boxShadows: false, enemyShadows: false, maxPointLights: 4,
    gtao: false, gbufferScale: 0.75, bloomStrength: 0.7, bloomScale: 1, normalMaps: false, smallTextures: true,
    animHalfRateFrom: 6, animThirdRateFrom: 11, embers: 60, anisotropy: 2, minScale: 0.75, inkFromBeauty: false,
  },
  // Leistung (tablet playtest 2026-11-20): the Tab S9 is CPU-bound (render CPU 25 to 30 ms at 700 to
  // 800 draw calls), so fewer pixels gained nothing and only blurred. This level now cuts CPU work:
  // no outline pre-pass, box shadows every third frame; resolution and animation match Ausgewogen.
  leistung: {
    id: 'leistung', label: 'Leistung', maxDpr: 1.25, msaa: 0, shadowMap: 1024, shadowEvery: 3, boxShadows: true, enemyShadows: false, maxPointLights: 4,
    gtao: false, gbufferScale: 0.75, bloomStrength: 0.6, bloomScale: 0.5, normalMaps: false, smallTextures: true,
    animHalfRateFrom: 6, animThirdRateFrom: 11, embers: 30, anisotropy: 2, minScale: 0.8, inkFromBeauty: true,
  },
};
