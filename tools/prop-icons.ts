// Dev tool page (Johannes 2026-11-26: real 3D icons for the Aufsätze and supplies, no SVG). Renders each Pixal3D
// prop in assets-src/ai/props/<file>.glb like the item icons (look-sheet.ts icon mode: same light, three-quarter view
// from a little above, fitted, transparent, 256 px WebP) and hands them to tools/item-icons.mjs (PAGES=props).
//   /tools/prop-icons.html            every prop with a GLB    ?show=1  a sheet on screen instead
import { ACESFilmicToneMapping, Box3, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, Scene, SRGBColorSpace, Vector3, WebGLRenderer, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MOD_ICONS, SUPPLY_ICONS } from '../src/ui/item-icons';

const q = new URLSearchParams(location.search);
const files: Array<[string, string]> = [
  ...Object.entries(MOD_ICONS).map(([id, icon]) => [`mod-${id}`, icon] as [string, string]),
  ...Object.entries(SUPPLY_ICONS).map(([id, icon]) => [`sup-${id}`, icon] as [string, string]),
  // Two painted icons that read flat next to the rest, replaced by renders: the Abzeichen der Kiezwache and the
  // Ring der Weltzeituhr (the painted one showed the clock without a ring).
  ['eq-abzeichen-kiez', 'I95'],
  ['eq-weltuhr', 'I87'],
];
const S = 256;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.toneMapping = ACESFilmicToneMapping;
renderer.setSize(S, S, false);
renderer.setClearColor(0, 0);
const scene = new Scene();
scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 1.3));
const key = new DirectionalLight(0xffe2bd, 2.6);
key.position.set(1.5, 2.5, 3);
const rim = new DirectionalLight(0x9fd6d0, 1.6);
rim.position.set(-2, 2, -2.5);
scene.add(key, rim);
const cam = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
const loader = new GLTFLoader();
const out: Record<string, string> = {};
const sheet: HTMLImageElement[] = [];
for (const [file, icon] of files) {
  let root: Object3D;
  try { root = (await loader.loadAsync(`/assets-src/ai/props/${file}.glb`)).scene; } catch { continue; }
  root.traverse((o) => {
    const m = (o as Mesh).material as { map?: { colorSpace: string } | null; metalness?: number } | undefined;
    if (m?.map) m.map.colorSpace = SRGBColorSpace;
    // Pixal3D sometimes paints metalness near 1: a fully metallic texture reads black in a studio light.
    if (m && (m.metalness ?? 0) > 0.6) m.metalness = 0.6;
  });
  // The picture is a three-quarter view already: turn it a little further so the icon shows depth.
  root.rotation.y = -0.35;
  scene.add(root);
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const c = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
  const half = Math.max(size.x, size.y, size.z) / 2 / 0.9;
  cam.position.set(c.x, c.y + half * 0.35, c.z + 5);
  cam.lookAt(c.x, c.y, c.z);
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  out[icon] = renderer.domElement.toDataURL('image/webp', 0.92);
  if (q.has('show')) { const img = new Image(); img.src = out[icon]!; img.title = file; sheet.push(img); }
  scene.remove(root);
}
if (q.has('show')) { canvas.style.display = 'none'; document.body.append(...sheet); }
(window as unknown as { __icons: Record<string, string> }).__icons = out;
document.title = `done ${Object.keys(out).length}`;
