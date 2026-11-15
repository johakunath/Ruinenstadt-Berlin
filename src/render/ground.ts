// Ground height for the renderer (backlog B3). Maps set it at start; the courtyard is flat.
// Characters, effects and the camera stand on it; the sim itself stays on the 2D plane.
let fn: (x: number, z: number) => number = () => 0;

export function setGround(f: (x: number, z: number) => number): void {
  fn = f;
}

export function groundY(x: number, z: number): number {
  return fn(x, z);
}
