// Dev tool: prints where the weapon points over a clip, to place attack timing in src/data/combat.ts.
// yaw: degrees left of the character's forward axis (same sign as the sim), pitch: degrees above the ground.
// usage: node tools/clip-swing.mjs Sword_Regular_A [stepSeconds]
// P17: a creature's bite. GLB=assets/characters/raptor.glb BONE=Head node tools/clip-swing.mjs Attack 0.0333
//   prints the bone's position over the clip (z: ahead of the body, metres) and how far it is ahead of the rest
//   pose, so the frame where the jaws reach furthest forward (the bite) can be read off.
import fs from 'node:fs';
import { AnimationMixer, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const [name = 'Sword_Regular_A', step = '0.0333'] = process.argv.slice(2);
const file = process.env.GLB ?? 'assets/characters/anims.glb';
const boneName = process.env.BONE ?? 'hand_r';
const data = fs.readFileSync(file);
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '', resolve, reject));
const clip = gltf.animations.find((c) => c.name === name);
if (!clip) throw new Error(`No clip ${name}. Have: ${gltf.animations.map((c) => c.name).join(', ')}`);
const hand = gltf.scene.getObjectByName(boneName);
if (!hand) throw new Error(`No bone ${boneName}`);
const q = new Quaternion();
const dir = new Vector3();
const pos = new Vector3();
gltf.scene.updateMatrixWorld(true);
const rest = hand.getWorldPosition(new Vector3());
const mixer = new AnimationMixer(gltf.scene);
const action = mixer.clipAction(clip);
action.play();
console.log(`${name}  ${clip.duration.toFixed(2)} s  (${boneName}, rest at ${rest.toArray().map((v) => v.toFixed(2)).join(', ')})`);
for (let t = 0; t <= clip.duration + 1e-6; t += +step) {
  action.time = Math.min(t, clip.duration - 1e-4);
  mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  hand.getWorldQuaternion(q);
  hand.getWorldPosition(pos);
  // The pipe points along the hand bone's local +Z (see HeroView).
  dir.set(0, 0, 1).applyQuaternion(q);
  const yaw = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
  const pitch = (Math.asin(dir.y) * 180) / Math.PI;
  const ahead = process.env.BONE ? `  ahead=${(pos.z - rest.z).toFixed(2)}  drop=${(rest.y - pos.y).toFixed(2)}` : '';
  console.log(`t=${t.toFixed(3)}  yaw=${yaw.toFixed(0).padStart(5)}  pitch=${pitch.toFixed(0).padStart(4)}  ${boneName === 'hand_r' ? 'hand' : 'bone'}=(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})${ahead}`);
}
