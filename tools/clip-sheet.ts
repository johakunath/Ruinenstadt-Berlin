// Dev tool page: renders one clip as a strip of poses with a weapon in the hand, to pick clips and
// place attack timing (src/data/combat.ts). Never part of the game build.
// /tools/clip-sheet.html?clip=Punch_Cross&weapon=spear&from=0&to=1&n=8&view=side|left|front|top&ik=1
// ik=1: left hand on the grip of two-handed weapons at full weight, as in the game (hand-ik.ts).
import { AnimationMixer, Color, DirectionalLight, GridHelper, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadCharacters } from '../src/render/characters';
import { FIST_CLIP, LeftHandIk } from '../src/render/hand-ik';
import { LOOK } from '../src/render/looks';
import { Materials } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';
import { LEFT_GRIP, WeaponRack, type WeaponModel } from '../src/render/weapons';

const q = new URLSearchParams(location.search);
const n = Number(q.get('n') ?? 8);
const zoom = Number(q.get('zoom') ?? 1);
const W = Math.round(220 * zoom), H = Math.round(300 * zoom);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W * n, H, false);
canvas.style.width = `${W * n}px`;
const materials = new Materials(LOOK, PROFILES.qualitaet);
const assets = await loadCharacters(materials);
const scene = new Scene();
scene.background = new Color(0x26343a);
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 2.2));
const sun = new DirectionalLight(0xfff0d8, 2.5);
sun.position.set(2, 5, 3);
scene.add(sun, new GridHelper(8, 16, 0x5a6a70, 0x3a4a50));
const model = cloneSkinned(assets.hero);
scene.add(model);
// grip=0.4: try another left grip height (tuning LEFT_GRIP).
if (q.get('grip')) (LEFT_GRIP as Partial<Record<WeaponModel, number>>)[(q.get('weapon') ?? 'pipe') as WeaponModel] = Number(q.get('grip'));
const rack = new WeaponRack(materials);
rack.show((q.get('weapon') ?? 'pipe') as WeaponModel, (q.get('el') as 'fire' | null) ?? undefined);
model.getObjectByName('hand_r')?.add(rack.group);
const ik = q.get('ik') === '1' ? new LeftHandIk(model, assets.heroClips.get(FIST_CLIP)) : null;
const gripPos = new Vector3(), gripDir = new Vector3();
const mixer = new AnimationMixer(model);
const name = q.get('clip') ?? 'Sword_Regular_A';
const clip = assets.heroClips.get(name);
if (!clip) throw new Error(`No clip ${name}: ${[...assets.heroClips.keys()].join(', ')}`);
const action = mixer.clipAction(clip);
action.play();
const from = Number(q.get('from') ?? 0), to = Number(q.get('to') ?? clip.duration);
const cam = new PerspectiveCamera(Number(q.get('fov') ?? 32), W / H, 0.1, 50);
const view = q.get('view') ?? 'side';
// The model faces +Z. side: from its right front; left: from its left front; front: head-on; top: from above.
if (view === 'front') cam.position.set(0, 1.3, 6.2); else if (view === 'left') cam.position.set(4.6, 2.2, 4.2); else if (view === 'top') cam.position.set(0, 7.5, 0.6); else cam.position.set(-4.6, 2.2, 4.2);
cam.lookAt(0, view === 'top' ? 0 : Number(q.get('aim') ?? 0.95), view === 'top' ? 0.5 : 0.4);
renderer.setScissorTest(true);
for (let i = 0; i < n; i++) {
  action.time = Math.min(clip.duration - 1e-4, from + ((to - from) * i) / Math.max(1, n - 1));
  mixer.update(0);
  if (ik) {
    model.updateMatrixWorld(true);
    if (rack.leftGrip(gripPos, gripDir)) console.log(`ik ${action.time.toFixed(2)} s: weight ${ik.apply(gripPos, gripDir, 1).toFixed(2)}`);
  }
  renderer.setViewport(i * W, 0, W, H);
  renderer.setScissor(i * W, 0, W, H);
  renderer.render(scene, cam);
}
document.title = `done ${name} ${clip.duration.toFixed(2)}`;
