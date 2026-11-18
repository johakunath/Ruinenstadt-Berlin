// Dev tool page: one Köpenick or Mitte landmark in daylight from several views, for art checks against the
// reference photos (M11d). Never part of the game build.
//   /tools/landmark-sheet.html?kind=rathaus                three-quarter, front, game camera, top
//   &views=quarter,game  &variant=1 (dinos)  &w=480&h=400
import { Color, DirectionalLight, GridHelper, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { koepenickMap } from '../src/data/koepenick';
import { mitteMap } from '../src/data/mitte';
import { buildMitteLandmark, MITTE_KINDS, mitteMats } from '../src/render/mitte-world';
import type { LandmarkKind } from '../src/data/map';
import { buildLandmark } from '../src/render/landmarks';
import { LOOK } from '../src/render/looks';
import { ChunkBuilder, makeMapMats } from '../src/render/map-world';
import { Materials } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';

const q = new URLSearchParams(location.search);
const kind = (q.get('kind') ?? 'rathaus') as LandmarkKind;
const variant = Number(q.get('variant') ?? 0);
const views = (q.get('views') ?? 'quarter,front,game,top').split(',');
const W = Number(q.get('w') ?? 480), H = Number(q.get('h') ?? 420);
const def = [...koepenickMap().landmarks, ...mitteMap().landmarks].find((l) => l.kind === kind && (l.variant ?? 0) === variant)!;
const l = { ...def, x: 0, z: 0, rot: 0 };
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W * views.length, H, false);
const materials = new Materials(LOOK, PROFILES.qualitaet);
const mm = makeMapMats(materials);
if (MITTE_KINDS.has(kind)) mm.mitte = mitteMats(materials);
const b = new ChunkBuilder(mm);
if (MITTE_KINDS.has(kind)) buildMitteLandmark(b, l); else buildLandmark(b, l);
const scene = new Scene();
scene.background = new Color(0x9fb4c0);
scene.add(new HemisphereLight(0xe8f0ff, 0x5a5040, 2.0));
const sun = new DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-30, 50, 40);
scene.add(sun, new GridHelper(80, 40, 0x50606a, 0x6a7a80));
for (const m of b.solid.meshes()) scene.add(m);
// Let the async ground/paint textures arrive.
await new Promise((r) => setTimeout(r, 1500));
const size = Math.max(l.hx, l.hz, 6);
const tall = ({ rathaus: 42, kirche: 36, mueggelturm: 33, riesenrad: 38, sbahnhof: 10, schloss: 18, forum: 10, dino: 5, spati: 4,
  tor: 23, reichstag: 30, bundesbau: 18, kanzleramt: 26, siegessaeule: 46, sony: 36, stage: 5, bahntower: 70, kollhoff: 68, verkehrsturm: 9, klinik: 4,
  philharmonie: 22, matthaeus: 28, stabi: 17, nng: 8, checkpoint: 4, ubahn: 3, mauerstuecke: 4, lafayette: 26 } as Record<string, number>)[kind] ?? 12;
const cam = new PerspectiveCamera(36, W / H, 0.5, 600);
renderer.setScissorTest(true);
views.forEach((v, i) => {
  const r = Math.max(size * 2.2, tall * 1.25);
  if (v === 'quarter') { cam.position.set(-r * 0.75, tall * 0.45, r * 0.95); cam.lookAt(0, tall * 0.38, 0); }
  else if (v === 'front') { cam.position.set(0, tall * 0.35, r * 1.2); cam.lookAt(0, tall * 0.4, 0); }
  else if (v === 'side') { cam.position.set(r * 1.2, tall * 0.35, 0); cam.lookAt(0, tall * 0.4, 0); }
  else if (v === 'game') {
    // The game camera (18.5 m, 44°, from the south) on a hero standing `gz` m in front of the landmark.
    const gz = Number(q.get('gz') ?? l.hz + 4);
    cam.position.set(0, 0.9 + Math.sin(0.768) * 18.5, gz - 1.4 + Math.cos(0.768) * 18.5);
    cam.lookAt(0, 0.9, gz - 1.4);
  } else { cam.up.set(0, 0, -1); cam.position.set(0, size * 4.5, 0); cam.lookAt(0, 0, 0); cam.up.set(0, 1, 0); }
  cam.updateProjectionMatrix();
  renderer.setViewport(i * W, 0, W, H);
  renderer.setScissor(i * W, 0, W, H);
  renderer.render(scene, cam);
});
document.title = `done ${kind}`;
