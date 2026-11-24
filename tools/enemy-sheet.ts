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
//   &portrait=1&kinds=walker,rex,brute+flink   Kodex portraits (tools/kodex-portraits.mjs): one square per kind,
//     framed on the top of the body's bounding box (PORTRAIT overrides), warm key and cool rim light, Kodex card
//     background; `kind+mod` renders the kind as that elite. PNG data URLs land in `window.portraits`.
import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, GridHelper, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type InstancedMesh, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ELITES, ENEMIES, type EliteMod, type EnemyKind } from '../src/data/enemies';
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

/** Kodex portrait framing per kind: `top` share of the body's height from its top (default 0.42; 1 = whole body),
 * `yaw` camera angle from the front in degrees (default 28), `pitch` camera height (default 0.04, hunched ghouls -0.08 to see their faces), `zoom` (>1 closer), `lift` shifts the frame up (share of the frame). */
const PORTRAIT: Partial<Record<EnemyKind, { top?: number; yaw?: number; pitch?: number; zoom?: number; lift?: number }>> = {
  rat: { top: 1, yaw: 40 }, crow: { top: 1, yaw: 65, pitch: 0.25 }, kernspeier: { top: 1 },
  // Flat drones from above, so they fill the square.
  drone: { top: 1, pitch: 0.55, zoom: 1.15 }, wachdrohne: { top: 1, pitch: 0.55, zoom: 1.15 },
  // The shield from its open side.
  schild: { yaw: -30 },
  // Thin bodies under tall plumes and crests, the Diva inside her feather fans: closer, a little lower.
  scherbe: { zoom: 1.4, lift: -0.1 }, spreehexe: { zoom: 1.3, lift: -0.08 }, spiegelpaar: { zoom: 1.4, lift: -0.1 }, diva: { zoom: 2.3, lift: -0.08, yaw: 8 },
};

/** Bounding box of the visible meshes, skinned ones in their current pose. */
function visibleBox(root: Object3D): Box3 {
  const box = new Box3(), b = new Box3();
  root.updateMatrixWorld(true);
  root.traverseVisible((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (mat && (mat.blending === 2 || mat.depthWrite === false)) return; // additive glows and flat decals
    // Skinned and instanced meshes bound their posed or instanced geometry.
    const own = (m as SkinnedMesh).isSkinnedMesh || (m as unknown as InstancedMesh).isInstancedMesh ? (m as SkinnedMesh) : null;
    if (own) { own.computeBoundingBox(); b.copy(own.boundingBox!); }
    else { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); b.copy(m.geometry.boundingBox!); }
    box.union(b.applyMatrix4(m.matrixWorld));
  });
  return box;
}

async function portraits(): Promise<void> {
  const S = Number(q.get('size') ?? 512);
  const tokens = (q.get('kinds') ?? Object.keys(ENEMIES).join(',')).split(',').filter(Boolean);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(S, S, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = Number(q.get('exposure') ?? 1.5);
  canvas.style.display = 'none';
  const materials = new Materials(LOOK, PROFILES.qualitaet);
  const assets = await loadCharacters(materials, true);
  // Painted kit maps (T8 fur and wool, T10 carpet) load after the first body is built: build one, then wait.
  {
    const sim0 = createSim({ empty: true });
    new EnemyView(assets, materials, ENEMIES.walker.body, false).assign(spawnEnemy(sim0, 0, 0, 'walker'), false, null);
    await new Promise((r) => setTimeout(r, Number(q.get('wait') ?? 1500)));
  }
  const scene = new Scene();
  const fill = new HemisphereLight(0x9aa8c0, 0x2a1e14, 1.1);
  const key = new DirectionalLight(0xffd3a0, 3.6);
  const rim = new DirectionalLight(0x86b4ff, 7);
  scene.add(fill, key, rim, key.target, rim.target);
  const sim = createSim({ empty: true });
  const fov = 26, t = Math.tan((fov / 2) * Math.PI / 180);
  const cam = new PerspectiveCamera(fov, 1, 0.05, 200);
  const out: Record<string, string> = {};
  for (const token of tokens) {
    const [k, mod] = token.split('+') as [EnemyKind, EliteMod | undefined];
    const def = ENEMIES[k];
    const e = spawnEnemy(sim, 0, 0, k);
    if (mod) makeElite(sim, e, mod);
    e.facing = e.pfacing = 0;
    e.state = 'chase';
    e.speed = 0;
    if (def.wake) e.wake = 0;
    const v = new EnemyView(assets, materials, def.body, false);
    v.assign(e, false, null);
    scene.add(v.root);
    for (let s = 0; s < 30; s++) v.update(e, 0, 1 / 30, false, 0);
    const o = PORTRAIT[k] ?? {};
    const box = visibleBox(v.root);
    const h = box.max.y - box.min.y;
    const region = box.clone();
    region.min.y = box.max.y - h * (o.top ?? 0.42);
    // Long bodies (the Rex, mechs, the Weltzeituhr): only the front part, as deep as the frame is high.
    const rh = region.max.y - region.min.y;
    if (region.max.z - region.min.z > rh) region.min.z = region.max.z - rh;
    const c = region.getCenter(new Vector3());
    const yaw = ((o.yaw ?? 28) * Math.PI) / 180;
    // Camera slightly above the frame centre, turned to the body's left (its right side lit by the key).
    const d = new Vector3(Math.sin(yaw), o.pitch ?? (def.body === 'zombie' ? -0.08 : 0.04), Math.cos(yaw)).normalize();
    const up = new Vector3(0, 1, 0), r = new Vector3().crossVectors(up, d).normalize(), u = new Vector3().crossVectors(d, r);
    let dist = 0;
    for (let i = 0; i < 8; i++) {
      const p = new Vector3(i & 1 ? region.max.x : region.min.x, i & 2 ? region.max.y : region.min.y, i & 4 ? region.max.z : region.min.z).sub(c);
      const depth = p.dot(d);
      dist = Math.max(dist, depth + Math.abs(p.dot(u)) / t, depth + Math.abs(p.dot(r)) / t);
    }
    dist /= o.zoom ?? 1;
    c.addScaledVector(u, (o.lift ?? 0) * 2 * t * dist);
    cam.position.copy(c).addScaledVector(d, dist);
    cam.near = dist * 0.05;
    cam.far = dist * 4;
    cam.updateProjectionMatrix();
    cam.lookAt(c);
    // Key from the camera's left and above, rim from behind on the right; both follow the frame size.
    key.target.position.copy(c);
    key.position.copy(c).addScaledVector(r, -dist * 0.6).addScaledVector(up, dist * 0.5).addScaledVector(d, dist);
    rim.target.position.copy(c);
    rim.position.copy(c).addScaledVector(r, dist * 1.1).addScaledVector(up, dist * 0.6).addScaledVector(d, -dist);
    rim.color.set(mod ? ELITES[mod].color : 0x86b4ff);
    renderer.clear();
    renderer.render(scene, cam);
    // Kodex card background (`.kimg` in src/ui/style.css), then the body.
    const c2 = document.createElement('canvas');
    c2.width = c2.height = S;
    const g = c2.getContext('2d')!;
    const grad = g.createRadialGradient(S / 2, S * 0.6, 0, S / 2, S * 0.6, S * 0.72 * Math.SQRT2 * 0.5 * 1.42);
    grad.addColorStop(0, '#3a2c22');
    grad.addColorStop(1, '#120d0a');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.drawImage(canvas, 0, 0);
    out[token] = c2.toDataURL('image/png');
    c2.style.width = c2.style.height = '256px';
    c2.title = token;
    document.body.append(c2);
    scene.remove(v.root);
    sim.enemies.length = 0;
  }
  (window as unknown as { portraits: Record<string, string> }).portraits = out;
  document.title = `done ${tokens.length}`;
}

async function sheet(): Promise<void> {
const kind = q.get('kind') as EnemyKind | null;
const kinds = kind ? [kind] : (Object.keys(ENEMIES) as EnemyKind[]);
const n = kind ? Number(q.get('n') ?? 6) : kinds.length;
let tris = 0, calls = 0;
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
// `bg=000000`: plain background without the grid (pictures for image-to-3D, H4).
scene.background = new Color(q.get('bg') ? parseInt(q.get('bg')!, 16) : 0x26343a);
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 2.2));
const sun = new DirectionalLight(0xfff0d8, 2.5);
sun.position.set(2, 5, 3);
scene.add(sun);
if (!q.get('bg')) scene.add(new GridHelper(16, 16, 0x5a6a70, 0x3a4a50));
const sim = createSim({ empty: true });
const cam = new PerspectiveCamera(32, W / H, 0.1, 80);
const view = q.get('view') ?? 'side';
renderer.setScissorTest(true);
const state = (q.get('state') ?? 'chase') as EnemyState;
const special = q.get('special') as SpecialKind | null;
// `wait=ms`: build one view first so the gear kit loads its painted maps (T8 fur), then render with them.
if (q.get('wait')) {
  new EnemyView(assets, materials, ENEMIES[kinds[0]!].body, false).assign(spawnEnemy(sim, 0, 0, kinds[0]!), false, null);
  sim.enemies.length = 0;
  await new Promise((r) => setTimeout(r, Number(q.get('wait'))));
}
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
  v.assign(e, q.get('neon') === '1', q.get('revue') === '1' ? 'revue' : q.get('fest') === '1' ? 'fest' : null);
  scene.add(v.root);
  // Let fades and springs settle on the pose.
  for (let s = 0; s < 30; s++) v.update(e, 0, 1 / 30, false, 0);
  const size = Number(q.get('size') ?? 0) || Math.max(1, def.body === 'rex' ? 3.2 : def.body === 'raptor' ? 1.3 : def.kind === 'wachdrohne' ? 1.6 : def.scale);
  if (view === 'front') cam.position.set(0, 1.3 * size, 6.2 * size); else if (view === 'back') cam.position.set(0, 1.3 * size, -6.2 * size); else if (view === 'profile') cam.position.set(6.2 * size, 1.3 * size, 0); else if (view === 'game') cam.position.set(0, 7 * size, 6.6 * size); else cam.position.set(-4.6 * size, 2.2 * size, 4.2 * size);
  cam.lookAt(0, 0.95 * size * (view === 'game' ? 0.5 : 1), 0.2);
  renderer.setViewport(i * W, 0, W, H);
  renderer.setScissor(i * W, 0, W, H);
  renderer.render(scene, cam);
  tris += renderer.info.render.triangles;
  calls += renderer.info.render.calls;
  scene.remove(v.root);
  sim.enemies.length = 0;
}
// Triangles drawn per view (all views summed; divide by n), for cost checks.
document.title = `done ${kinds.join(' ')} tris=${Math.round(tris / Math.max(1, n))} calls=${Math.round(calls / Math.max(1, n))}`;
}

if (q.get('portrait')) await portraits();
else await sheet();
