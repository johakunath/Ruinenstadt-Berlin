// Fixed high three-quarter camera: smooth follow, slight look-ahead, directional shake.
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Bounds } from '../sim/flowfield';
import { clamp } from '../sim/math';

const PITCH = 44;
const DISTANCE = 18.5;
const FOV = 36;
/** The view centers a little north of the hero so more of the facades shows. */
const FRAME_Z = -1.4;
const LOOK_AHEAD = 0.22;
const LOOK_AHEAD_MAX = 1.6;
const FOLLOW = 7;
const SPRING_STEP = 1 / 120;

export class FollowCamera {
  readonly camera = new PerspectiveCamera(FOV, 16 / 9, 1, 120);
  private readonly target = new Vector3();
  private readonly ahead = new Vector3();
  private readonly kick = new Vector3();
  private readonly kickVel = new Vector3();
  /** Read by the test: current shake offset at the look-at point. */
  get kickOffset(): number {
    return Math.hypot(this.kick.x, this.kick.z);
  }
  private trauma = 0;
  private time = 0;
  private distance = DISTANCE;
  private readonly baseDistance: number;
  private readonly pitch: number;
  private readonly ray = new Raycaster();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);

  /**
   * `override` is the ?cam=distance,pitch debug option for close-up art checks. `frame` limits the
   * look-at point: the courtyard keeps the view inside the yard, maps keep it off the outer edge.
   */
  constructor(override: { distance: number; pitch: number } | undefined, private readonly frame: Bounds) {
    this.baseDistance = override?.distance ?? DISTANCE;
    this.pitch = ((override?.pitch ?? PITCH) * Math.PI) / 180;
    this.distance = this.baseDistance;
    this.camera.layers.enableAll();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    // Portrait and narrow screens pull back so the fight stays in view.
    this.distance = this.baseDistance * (aspect < 1.5 ? clamp(1.5 / aspect, 1, 1.9) : 1);
    this.camera.updateProjectionMatrix();
  }

  /** Camera position (world), for the see-through cutout. */
  get position(): Vector3 {
    return this.camera.position;
  }

  snap(x: number, z: number, y = 0): void {
    this.target.set(x, y, z + FRAME_Z);
    this.ahead.set(0, 0, 0);
  }

  /** Directional kick along a blow (meters at the look-at point) plus a little noise. */
  shake(dx: number, dz: number, amount: number): void {
    this.kickVel.x += dx * amount * 55;
    this.kickVel.z += dz * amount * 55;
    this.trauma = Math.min(1, this.trauma + amount * 2.2);
  }

  /** `y` is the ground height under the hero; the view eases up and down hills with it. */
  update(x: number, z: number, vx: number, vz: number, dt: number, y = 0): void {
    this.time += dt;
    const k = 1 - Math.exp(-FOLLOW * dt);
    const ax = clamp(vx * LOOK_AHEAD, -LOOK_AHEAD_MAX, LOOK_AHEAD_MAX);
    const az = clamp(vz * LOOK_AHEAD, -LOOK_AHEAD_MAX, LOOK_AHEAD_MAX);
    this.ahead.x += (ax - this.ahead.x) * (1 - Math.exp(-3 * dt));
    this.ahead.z += (az - this.ahead.z) * (1 - Math.exp(-3 * dt));
    // Keep the view inside the frame: the camera never shows the void behind the walls or the map edge.
    const Y = this.frame;
    const tx = clamp(x + this.ahead.x, Y.minX, Y.maxX);
    const tz = clamp(z + this.ahead.z + FRAME_Z, Y.minZ, Y.maxZ);
    this.target.x += (tx - this.target.x) * k;
    this.target.z += (tz - this.target.z) * k;
    this.target.y += (y - this.target.y) * k;
    this.ground.constant = -this.target.y;

    // Shake: a damped spring for the kick, noise scaled by trauma squared.
    // Fixed substeps: one Euler step per frame diverges below about 18 fps and throws the view off screen.
    const stiff = 320;
    const damp = 26;
    const n = Math.max(1, Math.ceil(dt / SPRING_STEP));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.kickVel.x += (-stiff * this.kick.x - damp * this.kickVel.x) * h;
      this.kickVel.z += (-stiff * this.kick.z - damp * this.kickVel.z) * h;
      this.kick.x += this.kickVel.x * h;
      this.kick.z += this.kickVel.z * h;
    }
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    const noise = this.trauma * this.trauma * 0.12;
    const sx = this.kick.x + Math.sin(this.time * 71) * noise;
    const sy = Math.sin(this.time * 93 + 1.3) * noise;
    const sz = this.kick.z + Math.sin(this.time * 57 + 2.1) * noise;

    const lookX = this.target.x + sx;
    const lookZ = this.target.z + sz;
    const lookY = this.target.y + 0.9 + sy;
    this.camera.position.set(lookX, lookY + Math.sin(this.pitch) * this.distance, lookZ + Math.cos(this.pitch) * this.distance);
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  /** World point on the ground under a screen position (normalized device coordinates). */
  groundPoint(ndcX: number, ndcY: number, out: Vector3): Vector3 | null {
    this.ray.setFromCamera(new Vector2(ndcX, ndcY), this.camera);
    return this.ray.ray.intersectPlane(this.ground, out);
  }

  /** Converts a size in meters at the look-at distance to the particle shader's pixel scale. */
  pixelScale(viewHeight: number): number {
    return viewHeight / (2 * Math.tan((FOV * Math.PI) / 360));
  }
}
