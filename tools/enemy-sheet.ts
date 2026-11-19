// Dev tool page: the enemy roster side by side, or one kind as a strip of poses through a state.
// Never part of the game build.
//   /tools/enemy-sheet.html                         every kind, idle
//   /tools/enemy-sheet.html?kind=rex&state=windup&n=6          strip through the wind-up
//   /tools/enemy-sheet.html?kind=raptor&special=pounce&n=8     strip through a special
//   &size=0.35 zooms the camera (small bodies such as the rat)
//   &elite=flink  &view=game|side|front  &open=1  &neon=1 (Mitte cables)  &wind=0.8&go=0.5 (special timing)
//   &wake=strip (the Weltzeituhr waking up across the strip), &wake=0 (awake)
//   &base=human1|human2 (H3 step 2, temporary): the zombie bodies on a human base candidate (tools/build-human.mjs)
//   &revue=1 (M16 Charlottenburg dress)  &tier=1|2 (the Diva's broken gown tiers)  &guard=0 (the Logenbrecher's front down)
import { Color, DirectionalLight, GridHelper, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer, type Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ENEMIES, type EliteMod, type EnemyKind } from '../src/data/enemies';
import { loadCharacters } from '../src/render/characters';
import { EnemyView } from '../src/render/enemies';
import { LOOK } from '../src/render/looks';
import { Materials, type LitMaterial } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';
import { makeElite, spawnEnemy } from '../src/sim/enemies';
import { createSim } from '../src/sim/sim';
import type { SpecialKind } from '../src/sim/threats';
import type { EnemyState } from '../src/sim/types';

const q = new URLSearchParams(location.search);
const kind = q.get('kind') as EnemyKind | null;
const kinds = kind ? [kind] : (Object.keys(ENEMIES) as EnemyKind[]);
const n = kind ? Number(q.get('n') ?? 6) : kinds.length;
const W = Number(q.get('w') ?? (kind ? 260 : 190)), H = Number(q.get('h') ?? 320);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W * n, H, false);
canvas.style.width = `${W * n}px`;
const materials = new Materials(LOOK, PROFILES.qualitaet);
const assets = await loadCharacters(materials, true);
const base = q.get('base');
if (base === 'human1' || base === 'human2') {
  // H3 step 2: a human body on the zombie's skeleton. human1 has the zombie's proportions (its clips fit as they
  // are); human2 is the hero's body, so it takes the clips fitted to the hero.
  const g = await new GLTFLoader().loadAsync(`/assets/characters/${base}.glb`);
  g.scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as LitMaterial;
    const mat = materials.fromGltf(src);
    mat.name = src.name;
    mesh.material = mat;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  });
  // Both bodies: the ghouls (zombie) and the male humanoid bosses (human) take the candidate.
  assets.zombie = assets.human = g.scene;
  if (base === 'human2') assets.zombieClips = new Map([...assets.zombieClips.keys()].map((k) => [k, assets.heroClips.get(k)!]));
}
const scene = new Scene();
scene.background = new Color(0x26343a);
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 2.2));
const sun = new DirectionalLight(0xfff0d8, 2.5);
sun.position.set(2, 5, 3);
scene.add(sun, new GridHelper(16, 16, 0x5a6a70, 0x3a4a50));
const sim = createSim({ empty: true });
const cam = new PerspectiveCamera(32, W / H, 0.1, 80);
const view = q.get('view') ?? 'side';
renderer.setScissorTest(true);
const state = (q.get('state') ?? 'chase') as EnemyState;
const special = q.get('special') as SpecialKind | null;
for (let i = 0; i < n; i++) {
  const k = kinds[kind ? 0 : i]!;
  const def = ENEMIES[k];
  const e = spawnEnemy(sim, 0, 0, k);
  if (q.get('elite')) makeElite(sim, e, q.get('elite') as EliteMod);
  e.facing = e.pfacing = 0;
  const f = n > 1 ? i / (n - 1) : 0;
  if (special) {
    e.state = 'special';
    e.sp = { kind: special, wind: Number(q.get('wind') ?? 0.8), go: Number(q.get('go') ?? 0.5), open: 0, dx: 0, dz: 1, speed: 0, fired: false, hit: q.get('hit') === '1' };
    e.stateT = f * 1.3;
  } else if (kind) {
    e.state = state;
    e.stateT = f * (state === 'windup' ? def.windup : state === 'strike' ? def.active : state === 'recover' ? def.recovery : state === 'dead' ? 1.6 : 1);
    e.staggerDur = 0.6;
    e.speed = state === 'chase' ? Number(q.get('speed') ?? 0) : 0;
  }
  if (q.get('open')) e.open = 1;
  if (q.get('tier')) e.still = Number(q.get('tier'));
  if (q.get('guard') === '0') e.guardOpen = 2;
  if (q.get('wake') === 'strip') e.wake = (def.wake ?? 0) * (1 - f);
  else if (q.get('wake') !== null) e.wake = Number(q.get('wake'));
  const v = new EnemyView(assets, materials, def.body, false);
  v.assign(e, q.get('neon') === '1', q.get('revue') === '1');
  scene.add(v.root);
  // Let fades and springs settle on the pose.
  for (let s = 0; s < 30; s++) v.update(e, 0, 1 / 30, false, 0);
  const size = Number(q.get('size') ?? 0) || Math.max(1, def.body === 'rex' ? 3.2 : def.body === 'raptor' ? 1.3 : def.kind === 'wachdrohne' ? 1.6 : def.scale);
  if (view === 'front') cam.position.set(0, 1.3 * size, 6.2 * size); else if (view === 'back') cam.position.set(0, 1.3 * size, -6.2 * size); else if (view === 'profile') cam.position.set(6.2 * size, 1.3 * size, 0); else if (view === 'game') cam.position.set(0, 7 * size, 6.6 * size); else cam.position.set(-4.6 * size, 2.2 * size, 4.2 * size);
  cam.lookAt(0, 0.95 * size * (view === 'game' ? 0.5 : 1), 0.2);
  renderer.setViewport(i * W, 0, W, H);
  renderer.setScissor(i * W, 0, W, H);
  renderer.render(scene, cam);
  scene.remove(v.root);
  sim.enemies.length = 0;
}
document.title = `done ${kinds.join(' ')}`;
