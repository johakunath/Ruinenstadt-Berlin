// Look variants for the gate 1 decision (plan-3d.md 3D9). Same scene, same lights; the look changes
// shading model, ink outline, painterly filter and color grading. Switch with ?look=.

export type LookId = 'gemalt' | 'comic' | 'tusche';

export interface Look {
  id: LookId;
  label: string;
  /** One line for the options menu. */
  hint: string;
  shading: 'pbr' | 'toon';
  /** Ink outline from depth and normal edges. 0 = off. */
  outline: number;
  outlineWidth: number;
  /** Painterly smoothing filter after lighting. */
  paintFilter: boolean;
  /** Blend of the painted textures toward their flat mean color (toon wants calmer surfaces). */
  flatten: number;
  ao: number;
  bloom: number;
  saturation: number;
  contrast: number;
  /** Split toning: shadows toward teal, highlights toward warm. */
  split: number;
  vignette: number;
  exposure: number;
}

export const LOOKS: Record<LookId, Look> = {
  gemalt: {
    id: 'gemalt', label: 'Gemalt', hint: 'Weiches Licht, gemalte Flächen',
    shading: 'pbr', outline: 0, outlineWidth: 1, paintFilter: false, flatten: 0,
    ao: 1, bloom: 1, saturation: 1.08, contrast: 1.06, split: 0.55, vignette: 0.55, exposure: 1.0,
  },
  comic: {
    id: 'comic', label: 'Comic', hint: 'Lichtstufen, kräftige Tuschelinie',
    shading: 'toon', outline: 1, outlineWidth: 1.6, paintFilter: false, flatten: 0.45,
    ao: 0.5, bloom: 0.8, saturation: 1.25, contrast: 1.1, split: 0.4, vignette: 0.4, exposure: 1.05,
  },
  tusche: {
    id: 'tusche', label: 'Tusche', hint: 'Weiches Licht, feine Linie, Pinselfilter',
    shading: 'pbr', outline: 0.75, outlineWidth: 1.1, paintFilter: true, flatten: 0.15,
    ao: 0.9, bloom: 0.9, saturation: 1.18, contrast: 1.1, split: 0.6, vignette: 0.5, exposure: 1.02,
  },
};
