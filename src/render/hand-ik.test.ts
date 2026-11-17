import { AnimationClip, Bone, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LeftHandIk, PALM, gripRotation, reachFade, solveTwoBone } from './hand-ik';

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

describe('reachFade', () => {
  it('is 1 below 90 % of reach, 0 at full reach, linear between', () => {
    expect(reachFade(0.5)).toBe(1);
    expect(reachFade(0.9)).toBe(1);
    expect(reachFade(0.95)).toBeCloseTo(0.5, 6);
    expect(reachFade(1)).toBe(0);
    expect(reachFade(1.3)).toBe(0);
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
});
