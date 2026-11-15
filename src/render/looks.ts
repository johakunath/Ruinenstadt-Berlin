// The look (chosen after the gate 1 playtest): physically based shading from Gemalt, a thin ink line
// from Tusche, saturated color from Comic, and a highlight shoulder so lamps and windows do not blow out.
// Districts can later get their own grade by copying LOOK and changing the color values.

export interface Look {
  /** Ink outline from depth and normal edges. 0 = off. */
  outline: number;
  /** Line width in device pixels. */
  outlineWidth: number;
  /** Blend of the painted textures toward their flat mean color. */
  flatten: number;
  ao: number;
  bloom: number;
  saturation: number;
  contrast: number;
  /** Split toning: shadows toward teal, highlights toward warm. */
  split: number;
  vignette: number;
  exposure: number;
  /** Linear luminance where the highlight shoulder starts; above it values roll off softly. */
  shoulder: number;
}

export const LOOK: Look = {
  outline: 0.9, outlineWidth: 1, flatten: 0.08,
  ao: 1, bloom: 0.75, saturation: 1.24, contrast: 1.06, split: 0.5, vignette: 0.5, exposure: 1.0, shoulder: 0.7,
};
