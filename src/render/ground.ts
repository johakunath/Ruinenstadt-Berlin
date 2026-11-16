// Ground height for the renderer (backlog B3). Maps set it at start; the courtyard is flat.
// Characters, effects and the camera stand on it; the sim itself stays on the 2D plane.
let fn: (x: number, z: number) => number = () => 0;

export function setGround(f: (x: number, z: number) => number): void {
  fn = f;
}

export function groundY(x: number, z: number): number {
  return fn(x, z);
}

/** Grid step of the ground mesh (`buildGround`). */
export const GROUND_STEP = 1.5;

/**
 * The height of the drawn ground: the map's height function sampled on the ground mesh's own
 * grid and interpolated over the same two triangles per cell. The height function curves (hills,
 * relief); the mesh is flat between its vertices. Whatever stands or lies on the ground must use
 * this, not the function itself, or it sinks into a slope or floats over it (playtest 2026-11-17,
 * Müggelberge). Water vertices count with their dry height, so banks do not pull things down.
 */
export function meshSurface(minX: number, minZ: number, height: (x: number, z: number) => number): (x: number, z: number) => number {
  const cache = new Map<number, number>();
  const at = (i: number, j: number): number => {
    const key = (i + 4096) * 16384 + (j + 4096);
    let v = cache.get(key);
    if (v === undefined) {
      v = height(minX + i * GROUND_STEP, minZ + j * GROUND_STEP);
      cache.set(key, v);
    }
    return v;
  };
  return (x, z) => {
    const gx = (x - minX) / GROUND_STEP, gz = (z - minZ) / GROUND_STEP;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const b = at(i + 1, j), c = at(i, j + 1);
    // The mesh splits each cell along the diagonal from (i+1, j) to (i, j+1).
    if (fx + fz <= 1) {
      const a = at(i, j);
      return a + (b - a) * fx + (c - a) * fz;
    }
    const d = at(i + 1, j + 1);
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  };
}
