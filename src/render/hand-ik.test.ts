import { AnimationClip, AnimationMixer, Bone, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GRAB_TIME, LeftHandIk, PALM, RELEASE_TIME, STANCE_STRETCH, easeGrip, gripRotation, reachFade, solveTwoBone } from './hand-ik';

const near = (a: Vector3, b: Vector3, eps = 1e-5): void => expect(a.distanceTo(b)).toBeLessThan(eps);

describe('solveTwoBone', () => {
  const s = new Vector3(0, 1.4, 0);
  const e = new Vector3(0.24, 1.4, -0.04);
  const w = new Vector3(0.48, 1.4, 0);
  const pole = new Vector3(0, -1, 0);

  it('keeps both bone lengths and puts the wrist on a target in reach', () => {
    const target = new Vector3(0.2, 1.1, 0.25);
    const e2 = new Vector3(), w2 = new Vector3();
    const ratio = solveTwoBone(s, e, w, target, pole, e2, w2);
    near(w2, target);
    expect(e2.distanceTo(s)).toBeCloseTo(e.distanceTo(s), 6);
    expect(w2.distanceTo(e2)).toBeCloseTo(w.distanceTo(e), 6);
    expect(ratio).toBeCloseTo(s.distanceTo(target) / (e.distanceTo(s) + w.distanceTo(e)), 6);
  });

  it('keeps the elbow on the side the clip bent it to', () => {
    // The clip elbow sits behind the shoulder–wrist line (−Z); a target straight ahead must keep it behind.
    const target = new Vector3(0.3, 1.4, 0.1);
    const e2 = new Vector3(), w2 = new Vector3();
    solveTwoBone(s, e, w, target, pole, e2, w2);
    const u = target.clone().sub(s).normalize();
    const bend = e2.clone().sub(s);
    bend.addScaledVector(u, -bend.dot(u));
    expect(bend.z).toBeLessThan(0);
    expect(bend.length()).toBeGreaterThan(0.01);
  });

  it('uses the pole when the clip arm is straight', () => {
    const straight = new Vector3(0.24, 1.4, 0);
    const target = new Vector3(0.3, 1.4, 0.1);
    const e2 = new Vector3(), w2 = new Vector3();
    solveTwoBone(s, straight, w, target, pole, e2, w2);
    expect(e2.y).toBeLessThan(1.4 - 0.01);
    near(w2, target);
  });

  it('stretches toward a target out of reach without growing the arm', () => {
    const target = new Vector3(1.5, 1.4, 0.4);
    const e2 = new Vector3(), w2 = new Vector3();
    const ratio = solveTwoBone(s, e, w, target, pole, e2, w2);
    expect(ratio).toBeGreaterThan(1);
    const len = e.distanceTo(s) + w.distanceTo(e);
    expect(w2.distanceTo(s)).toBeLessThanOrEqual(len + 1e-6);
    const dir = target.clone().sub(s).normalize();
    expect(w2.clone().sub(s).normalize().dot(dir)).toBeGreaterThan(0.9999);
  });
});

describe('gripRotation', () => {
  it('lays local +Z along the shaft and points the wrist (−Y) to the shoulder side', () => {
    const shaft = new Vector3(0.3, 0.8, 0.5).normalize();
    const toShoulder = new Vector3(-0.4, 0.2, -0.3);
    const q = gripRotation(shaft, toShoulder, new Quaternion());
    near(new Vector3(0, 0, 1).applyQuaternion(q), shaft);
    const back = new Vector3(0, -1, 0).applyQuaternion(q);
    expect(back.dot(shaft)).toBeCloseTo(0, 6);
    expect(back.dot(toShoulder)).toBeGreaterThan(0);
  });
});

describe('easeGrip', () => {
  const dt = 1 / 60;

  it('grabs and lets go over their times, never faster than one frame step', () => {
    let w = 0;
    let frames = 0;
    while (w < 1) { const n = easeGrip(w, 1, false, dt); expect(n - w).toBeLessThanOrEqual(dt / GRAB_TIME + 1e-9); w = n; frames++; }
    expect(frames).toBe(Math.ceil(GRAB_TIME / dt - 1e-9));
    frames = 0;
    // The shaft leaves reach at once (reach fade 1 → 0): the hand still eases off.
    while (w > 0) { const n = easeGrip(w, 0, false, dt); expect(w - n).toBeLessThanOrEqual(dt / RELEASE_TIME + 1e-9); w = n; frames++; }
    expect(frames).toBe(Math.ceil(RELEASE_TIME / dt - 1e-9));
  });

  it('does not grab anew during wind-up and active frames, but may keep holding or let go', () => {
    expect(easeGrip(0.2, 1, true, dt)).toBe(0.2);
    expect(easeGrip(1, 1, true, dt)).toBe(1);
    expect(easeGrip(1, 0.5, true, dt)).toBeLessThan(1);
  });
});

describe('reachFade', () => {
  it('is 1 below 90 % of reach, 0 at full reach, linear between', () => {
    expect(reachFade(0.5)).toBe(1);
    expect(reachFade(0.9)).toBe(1);
    expect(reachFade(0.95)).toBeCloseTo(0.5, 6);
    expect(reachFade(1)).toBe(0);
    expect(reachFade(1.3)).toBe(0);
  });

  it('moves out with the standing stretch', () => {
    expect(reachFade(1, STANCE_STRETCH)).toBe(1);
    expect(reachFade(1 + STANCE_STRETCH)).toBe(0);
    expect(reachFade(1 + STANCE_STRETCH, STANCE_STRETCH)).toBe(0);
  });
});

/** A T-posed left arm like the hero's (`upperarm_l` at x 0.15, bones along +X) plus a right hand. */
function rig(): { root: Bone; hand: Bone; handR: Bone; index: Bone } {
  const root = new Bone();
  const upper = new Bone(); upper.name = 'upperarm_l'; upper.position.set(0.152, 1.418, -0.054);
  const lower = new Bone(); lower.name = 'lowerarm_l'; lower.position.set(0.24, 0, -0.03);
  const hand = new Bone(); hand.name = 'hand_l'; hand.position.set(0.25, 0, 0.02);
  const index = new Bone(); index.name = 'index_01_l'; index.position.set(0.09, 0, 0.02);
  const handR = new Bone(); handR.name = 'hand_r'; handR.position.set(-0.64, 1.418, -0.05);
  root.add(upper, handR);
  upper.add(lower);
  lower.add(hand);
  hand.add(index);
  root.updateMatrixWorld(true);
  return { root, hand, handR, index };
}

describe('LeftHandIk', () => {
  const fistQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.3);
  const fist = new AnimationClip('fist', 1, [
    new QuaternionKeyframeTrack('index_01_l.quaternion', [0], [fistQ.x, fistQ.y, fistQ.z, fistQ.w]),
  ]);

  it('puts the fist on the grip, the hand along the shaft, and curls the fingers', () => {
    const { root, hand, index } = rig();
    const ik = new LeftHandIk(root, fist);
    const grip = new Vector3(0.05, 1.15, 0.35);
    const shaft = new Vector3(0.2, 0.7, 0.3).normalize();
    expect(ik.apply(grip, shaft, 1)).toBe(1);
    root.updateMatrixWorld(true);
    // The fist centre (wrist + PALM in the hand frame) sits on the grip.
    near(hand.localToWorld(PALM.clone()), grip, 1e-4);
    near(new Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(new Quaternion())), shaft, 1e-4);
    expect(index.quaternion.angleTo(fistQ)).toBeLessThan(1e-5);
  });

  it('never moves the right hand', () => {
    const { root, handR } = rig();
    const before = handR.matrixWorld.clone();
    new LeftHandIk(root, fist).apply(new Vector3(0, 1.2, 0.3), new Vector3(0, 1, 0), 1);
    root.updateMatrixWorld(true);
    expect(handR.matrixWorld.equals(before)).toBe(true);
  });

  it('lets go of a grip out of reach and blends with the weight', () => {
    const { root, hand } = rig();
    const ik = new LeftHandIk(root, fist);
    const rest = hand.getWorldPosition(new Vector3());
    expect(ik.apply(new Vector3(-1.2, 1.3, 0.6), new Vector3(0, 1, 0), 1)).toBe(0);
    root.updateMatrixWorld(true);
    near(hand.getWorldPosition(new Vector3()), rest);
    const grip = new Vector3(0.05, 1.15, 0.35);
    expect(ik.apply(grip, new Vector3(0, 1, 0), 0.5)).toBe(0.5);
    root.updateMatrixWorld(true);
    const half = hand.getWorldPosition(new Vector3());
    expect(half.distanceTo(rest)).toBeGreaterThan(0.05);
    expect(hand.localToWorld(PALM.clone()).distanceTo(grip)).toBeGreaterThan(0.05);
  });

  it('keeps the clip wrist roll in the standing stance (smallest turn onto the shaft)', () => {
    const { root, hand } = rig();
    const ik = new LeftHandIk(root, fist);
    const before = hand.getWorldQuaternion(new Quaternion());
    // Shaft tilted 20° away from the hand's own +Z: the hand turns about 20°, no roll around the shaft.
    const shaft = new Vector3(0, Math.sin(0.35), Math.cos(0.35));
    expect(ik.apply(new Vector3(0.55, 1.35, 0.1), shaft, 1, 1)).toBe(1);
    root.updateMatrixWorld(true);
    const after = hand.getWorldQuaternion(new Quaternion());
    near(new Vector3(0, 0, 1).applyQuaternion(after), shaft, 1e-4);
    expect(after.angleTo(before)).toBeCloseTo(0.35, 3);
  });

  /** A clip that holds the arm still (constant keys), like a held idle key or hitstop's update(0). */
  function heldClip(root: Bone): AnimationClip {
    const tracks = ['upperarm_l', 'lowerarm_l', 'hand_l', 'index_01_l'].map((n) => {
      const q = (root.getObjectByName(n) as Bone).quaternion;
      return new QuaternionKeyframeTrack(`${n}.quaternion`, [0, 1], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]);
    });
    return new AnimationClip('held', 1, tracks);
  }

  it('restores the clip pose before the mixer, so a partial grip does not stack frame after frame', () => {
    const run = (restore: boolean): Vector3[] => {
      const { root, hand } = rig();
      const ik = new LeftHandIk(root, fist);
      const mixer = new AnimationMixer(root);
      mixer.clipAction(heldClip(root)).play();
      const out: Vector3[] = [];
      for (let i = 0; i < 6; i++) {
        if (restore) ik.restore();
        mixer.update(0);
        root.updateMatrixWorld(true);
        ik.aim(new Vector3(0.05, 1.15, 0.35), new Vector3(0, 1, 0));
        ik.pose(0.5);
        out.push(hand.getWorldPosition(new Vector3()));
      }
      return out;
    };
    const fixed = run(true);
    for (const w of fixed) near(w, fixed[0] as Vector3, 1e-6);
    // Without restore the mixer leaves the held bones alone and the hand creeps toward the grip.
    const stacked = run(false);
    expect((stacked[5] as Vector3).distanceTo(stacked[0] as Vector3)).toBeGreaterThan(0.01);
  });

  it('gives the clip its arm and fingers back once the grip is off', () => {
    const { root, hand, index } = rig();
    const clipHand = hand.quaternion.clone(), clipIndex = index.quaternion.clone();
    const ik = new LeftHandIk(root, fist);
    const mixer = new AnimationMixer(root);
    mixer.clipAction(heldClip(root)).play();
    mixer.update(0);
    root.updateMatrixWorld(true);
    ik.apply(new Vector3(0.05, 1.15, 0.35), new Vector3(0, 1, 0), 1);
    ik.restore();
    mixer.update(0);
    expect(hand.quaternion.angleTo(clipHand)).toBeLessThan(1e-6);
    expect(index.quaternion.angleTo(clipIndex)).toBeLessThan(1e-6);
  });

  it('posing at weight 0 changes nothing', () => {
    const { root, hand } = rig();
    const ik = new LeftHandIk(root, fist);
    const before = hand.matrixWorld.clone();
    ik.aim(new Vector3(0.05, 1.15, 0.35), new Vector3(0, 1, 0));
    ik.pose(0);
    root.updateMatrixWorld(true);
    expect(hand.matrixWorld.equals(before)).toBe(true);
  });
});
