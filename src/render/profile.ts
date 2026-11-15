// Render profiles (plan-3d.md › Render budget). Qualität is the PC fidelity target,
// Leistung keeps tablets and phones at 60 fps.

export type ProfileId = 'qualitaet' | 'leistung';

export interface Profile {
  id: ProfileId;
  label: string;
  maxDpr: number;
  msaa: number;
  shadowMap: number;
  /** Enemies cast real shadows; otherwise they get a blob shadow. */
  enemyShadows: boolean;
  maxPointLights: number;
  gtao: boolean;
  /** Resolution of the normal/depth pre-pass used by GTAO and the ink outline. */
  gbufferScale: number;
  bloomStrength: number;
  normalMaps: boolean;
  /** Enemies farther than this (meters from the hero) animate at half / third rate. 0 = always full rate. */
  animHalfRateFrom: number;
  animThirdRateFrom: number;
  embers: number;
  anisotropy: number;
}

export const PROFILES: Record<ProfileId, Profile> = {
  qualitaet: {
    id: 'qualitaet', label: 'Qualität', maxDpr: 2, msaa: 4, shadowMap: 2048, enemyShadows: true, maxPointLights: 8,
    gtao: true, gbufferScale: 1, bloomStrength: 1, normalMaps: true,
    animHalfRateFrom: 0, animThirdRateFrom: 0, embers: 140, anisotropy: 8,
  },
  leistung: {
    id: 'leistung', label: 'Leistung', maxDpr: 1.25, msaa: 0, shadowMap: 1024, enemyShadows: false, maxPointLights: 4,
    gtao: false, gbufferScale: 0.75, bloomStrength: 0.7, normalMaps: false,
    animHalfRateFrom: 6, animThirdRateFrom: 11, embers: 60, anisotropy: 2,
  },
};
