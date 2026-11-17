// Left hand on two-handed weapons (H1 step 2). The clip packs have no two-handed clips, so after the
// clips are applied a two-bone solve turns `upperarm_l` and `lowerarm_l` until `hand_l` sits on the
// weapon's left grip, turns the hand around the shaft and curls the fingers. Only the left arm below
// the clavicle is touched: `hand_r` and the weapon (hit arcs, `tools/clip-swing.mjs`) never move.
import { Matrix4, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';

/** Wrist to the middle of the closed fist, in the hand bone's frame (the right hand's rack offset, mirrored). */
export const PALM = new Vector3(0, 0.09, 0.03);
/** The weight fades to 0 between these fractions of full arm reach. */
export const REACH_FADE = [0.9, 1] as const;
/** At stance 1 the fade window moves out by this much: the arm may stretch straight for the last centimetres. */
export const STANCE_STRETCH = 0.3;
/** Clip whose left fingers form the fist (equal to the right hand's grip in the sword clips). */
export const FIST_CLIP = 'Punch_Cross';

const FINGER = /^(index|middle|ring|pinky|thumb)_0[1-3]_l$/;

/** Any unit vector perpendicular to unit `u`. */
function perpendicular(u: Vector3, out: Vector3): Vector3 {
  return (Math.abs(u.y) < 0.9 ? out.set(-u.z, 0, u.x) : out.set(0, u.z, -u.y)).normalize();
}

const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();
const m = new Matrix4();

/**
 * Two-bone solve on world positions: shoulder `s`, elbow `e` and wrist `w` as the clip left them.
 * Writes an elbow and a wrist with the same bone lengths so the wrist reaches `target` (or points at it
 * when it is out of reach). The elbow stays on the side the clip bent it to; `pole` is used when the
 * clip arm is straight. Returns the reach ratio |target − s| / (upper + lower length).
 */
export function solveTwoBone(s: Vector3, e: Vector3, w: Vector3, target: Vector3, pole: Vector3, outElbow: Vector3, outWrist: Vector3): number {
  const l1 = e.distanceTo(s);
  const l2 = w.distanceTo(e);
  const toT = v1.subVectors(target, s);
  const dist = toT.length();
  const u = dist > 1e-6 ? toT.divideScalar(dist) : v1.subVectors(w, s).normalize();
  // Bend direction: the elbow's offset from the clip's shoulder–wrist line, re-projected onto the new line.
  const axis = v2.subVectors(w, s).normalize();
  const bend = v3.subVectors(e, s);
  bend.addScaledVector(axis, -bend.dot(axis));
  if (bend.lengthSq() < 1e-8) bend.copy(pole);
  bend.addScaledVector(u, -bend.dot(u));
  if (bend.lengthSq() < 1e-8) bend.copy(pole).addScaledVector(u, -pole.dot(u));
  if (bend.lengthSq() < 1e-8) perpendicular(u, bend);
  bend.normalize();
  const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9999);
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  outElbow.copy(s).addScaledVector(u, l1 * cosA).addScaledVector(bend, l1 * sinA);
  outWrist.copy(s).addScaledVector(u, d);
  return l1 + l2 > 0 ? dist / (l1 + l2) : 1;
}

/**
 * World rotation of a left hand that holds a shaft: local +Z runs along `shaft` (thumb toward the
 * weapon's head, like the right hand) and local −Y (from the fist back to the wrist) points to the
 * shoulder side, so the forearm comes in from the body and the fingers close around the far side.
 */
export function gripRotation(shaft: Vector3, toShoulder: Vector3, out: Quaternion): Quaternion {
  const z = v1.copy(shaft).normalize();
  const back = v2.copy(toShoulder).addScaledVector(z, -toShoulder.dot(z));
  if (back.lengthSq() < 1e-8) perpendicular(z, back);
  const y = back.normalize().negate();
  const x = v3.crossVectors(y, z);
  return out.setFromRotationMatrix(m.makeBasis(x, y, z));
}

/** Reach fade: 1 below 90 % of full reach, 0 at full reach; `stretch` moves the window out. */
export function reachFade(ratio: number, stretch = 0): number {
  const [a, b] = REACH_FADE;
  return Math.min(1, Math.max(0, (b + stretch - ratio) / (b - a)));
}

const S = new Vector3();
const E = new Vector3();
const W = new Vector3();
const E2 = new Vector3();
const W2 = new Vector3();
const T = new Vector3();
const POLE = new Vector3();
const qa = new Quaternion();
const qb = new Quaternion();
const qHand = new Quaternion();
const qGrip = new Quaternion();

/** Turns `bone` in world space by the rotation that takes direction `from` to `to`. */
function turn(bone: Object3D, from: Vector3, to: Vector3): void {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  qa.setFromUnitVectors(from.normalize(), to.normalize());
  bone.getWorldQuaternion(qb);
  setWorldQuaternion(bone, qa.multiply(qb));
}

function setWorldQuaternion(bone: Object3D, world: Quaternion): void {
  if (bone.parent) bone.parent.getWorldQuaternion(qb).invert();
  else qb.identity();
  bone.quaternion.copy(qb.multiply(world));
  bone.updateMatrixWorld(true);
}

/** Seconds to grab the shaft and to let go of it. */
export const GRAB_TIME = 0.12;
export const RELEASE_TIME = 0.06;

/**
 * Eases the left-hand weight toward `want` (state × reach fade): grabs over `GRAB_TIME`, lets go over
 * `RELEASE_TIME`, never jumps. `swinging` (an attack's wind-up and active frames) blocks a new grab.
 */
export function easeGrip(w: number, want: number, swinging: boolean, dt: number): number {
  if (want > w && !swinging) return Math.min(want, w + dt / GRAB_TIME);
  if (want < w) return Math.max(want, w - dt / RELEASE_TIME);
  return w;
}

/** The left-arm solve for one skinned hero: `aim` once per frame after the clips, then `pose`. */
export class LeftHandIk {
  private readonly upper: Object3D;
  private readonly lower: Object3D;
  private readonly hand: Object3D;
  private readonly fingers: Array<{ bone: Object3D; fist: Quaternion }> = [];
  /** Wrist target and hand rotation from the last `aim`. */
  private readonly target = new Vector3();
  private readonly turnTo = new Quaternion();

  constructor(root: Object3D, fist?: AnimationClip) {
    const get = (n: string): Object3D => {
      const o = root.getObjectByName(n);
      if (!o) throw new Error(`hand-ik: no bone ${n}`);
      return o;
    };
    this.upper = get('upperarm_l');
    this.lower = get('lowerarm_l');
    this.hand = get('hand_l');
    if (!fist) return;
    for (const track of fist.tracks) {
      const [name, prop] = track.name.split('.');
      if (prop !== 'quaternion' || !name || !FINGER.test(name)) continue;
      const bone = root.getObjectByName(name);
      if (!bone) continue;
      // The first key: the guard pose the clip starts in.
      const v = track.values;
      this.fingers.push({ bone, fist: new Quaternion(v[0], v[1], v[2], v[3]).normalize() });
    }
  }

  /**
   * Finds where the hand goes this frame. `grip` is the world point on the shaft, `shaft` the world
   * direction from the grip toward the weapon's head. World matrices must be current (the caller
   * updates them after the clips). `stance` (0..1) is the two-handed standing pose: the hand keeps the
   * clip's wrist roll instead of turning the wrist to the shoulder side (no twist where the clip already
   * holds), and the arm may stretch. Returns the reach fade (0..1); the caller eases its weight with it.
   */
  aim(grip: Vector3, shaft: Vector3, stance = 0): number {
    this.upper.getWorldPosition(S);
    this.lower.getWorldPosition(E);
    this.hand.getWorldPosition(W);
    this.hand.getWorldQuaternion(qHand);
    gripRotation(shaft, T.subVectors(S, grip), qGrip);
    if (stance > 0) {
      // Smallest turn that lays the clip's hand along the shaft.
      qa.setFromUnitVectors(v1.set(0, 0, 1).applyQuaternion(qHand), v2.copy(shaft).normalize()).multiply(qHand);
      qGrip.slerp(qa, stance);
    }
    this.turnTo.copy(qGrip);
    // Wrist target: the grip minus the fist offset in the turned hand.
    T.copy(PALM).applyQuaternion(qGrip);
    this.target.subVectors(grip, T);
    return reachFade(S.distanceTo(this.target) / (S.distanceTo(E) + E.distanceTo(W)), STANCE_STRETCH * stance);
  }

  /** Moves the arm, hand and fingers toward the last `aim` by `weight` (0..1). Out of reach the arm points at it. */
  pose(weight: number): void {
    if (weight <= 0) return;
    this.upper.getWorldPosition(S);
    this.lower.getWorldPosition(E);
    this.hand.getWorldPosition(W);
    this.hand.getWorldQuaternion(qHand);
    T.lerpVectors(W, this.target, weight);
    // Straight clip arm: bend the elbow down and back, away from the body.
    POLE.set(0, -1, 0);
    solveTwoBone(S, E, W, T, POLE, E2, W2);
    turn(this.upper, v1.subVectors(E, S), v2.subVectors(E2, S));
    this.hand.getWorldPosition(W);
    turn(this.lower, v1.subVectors(W, E2), v2.subVectors(W2, E2));
    setWorldQuaternion(this.hand, qHand.slerp(this.turnTo, weight));
    for (const f of this.fingers) f.bone.quaternion.slerp(f.fist, weight);
    if (this.fingers.length) this.hand.updateMatrixWorld(true);
  }

  /** `aim` and `pose` in one call at full weight times the reach fade (tools, tests). Returns the weight used. */
  apply(grip: Vector3, shaft: Vector3, weight: number, stance = 0): number {
    const w = weight * this.aim(grip, shaft, stance);
    this.pose(w);
    return w;
  }
}
