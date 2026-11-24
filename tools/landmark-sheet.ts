// Dev tool page: one Köpenick, Xhain, Alexanderplatz, Mitte, Charlottenburg or Wedding landmark in daylight from several views, for art checks against the
// reference photos (M11d). Never part of the game build.
//   /tools/landmark-sheet.html?kind=rathaus                three-quarter, front, game camera, top
//   &views=quarter,game  &variant=1 (dinos)  &w=480&h=400
//   ?props=car*6,bus  a row of props instead (seeded 1, 2, …, 5 m apart, all facing +z; `&kind` unused);
//   &only=6,7 keeps those of the row, &size=4 frames closer, &code without the local AI props
import { Color, DirectionalLight, GridHelper, Group, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { koepenickMap } from '../src/data/koepenick';
import { alexMap } from '../src/data/alexanderplatz';
import { ALEX_KINDS, buildAlexLandmark } from '../src/render/alex-world';
import { paintAlexAtlas } from '../src/render/alex-paint';
import { mitteMap } from '../src/data/mitte';
import { buildMitteLandmark, MITTE_KINDS, mitteMats } from '../src/render/mitte-world';
import { charlottenburgMap } from '../src/data/charlottenburg';
import { weddingMap } from '../src/data/wedding';
import { buildKneipe, buildWeddingLandmark, makeWeddingMats, WEDDING_KINDS } from '../src/render/wedding-world';
import { buildGlbProps } from '../src/render/glb-props';
import { buildCharlottenburgLandmark, CHARLOTTENBURG_KINDS, CHARLOTTENBURG_WEAR } from '../src/render/charlottenburg-world';
import type { LandmarkKind } from '../src/data/map';
import { buildLandmark } from '../src/render/landmarks';
import { makeLandmarkFinishes } from '../src/render/landmark-finishes';
import { makeLandmarkWearMaterial } from '../src/render/landmark-wear';
import { LOOK } from '../src/render/looks';
import { ChunkBuilder, makeMapMats } from '../src/render/map-world';
import { buildProp } from '../src/render/world';
import type { Prop } from '../src/data/courtyard';
import { Rng } from '../src/sim/math';
import { Materials } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';

const q = new URLSearchParams(location.search);
const kind = (q.get('kind') ?? 'rathaus') as LandmarkKind;
const variant = Number(q.get('variant') ?? 0);
const views = (q.get('views') ?? 'quarter,front,game,top').split(',');
const W = Number(q.get('w') ?? 480), H = Number(q.get('h') ?? 420);
const propList = (q.get('props') ?? '').split(',').filter(Boolean).flatMap((k) => { const [kd = '', n] = k.split('*'); return Array.from({ length: Number(n) || 1 }, () => kd as Prop['kind']); });
const def = propList.length ? { ...koepenickMap().landmarks[0]!, hx: propList.length * 2.5, hz: 3 } : [...koepenickMap().landmarks, ...alexMap().landmarks, ...mitteMap().landmarks, ...charlottenburgMap().landmarks, ...weddingMap().landmarks].find((l) => l.kind === kind && (l.variant ?? 0) === variant)!;
const l = { ...def, x: 0, z: 0, rot: 0 };
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W * views.length, H, false);
const materials = new Materials(LOOK, PROFILES.qualitaet);
// ?old keeps the common stucco on Charlottenburg sights (before/after of the T9a image, LA1).
const mm = makeMapMats(materials, CHARLOTTENBURG_KINDS.has(kind) && !q.has('old') ? 'charlottenburg' : undefined);
if (ALEX_KINDS.has(kind)) { const t = paintAlexAtlas(); mm.alex = materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffe0a0, emissiveIntensity: 0.8, roughness: 0.6 }); }
if (MITTE_KINDS.has(kind)) mm.mitte = mitteMats(materials);
const wedding = WEDDING_KINDS.has(kind) || kind === 'kneipe';
if (wedding) mm.wedding = makeWeddingMats(materials);
if (!q.has('clean')) {
  mm.landmarkWear = makeLandmarkWearMaterial(materials);
  if (!ALEX_KINDS.has(kind) && !MITTE_KINDS.has(kind) && !CHARLOTTENBURG_KINDS.has(kind)) mm.landmarkFinishes = makeLandmarkFinishes(materials, mm.slate);
}
// &code: no local AI props (the code fallbacks, for before/after).
if (q.has('code')) (mm as { glbProps?: unknown }).glbProps = undefined;
const b = new ChunkBuilder(mm), up = new ChunkBuilder(mm);
// &only=6,7 builds only those (same seeds), side by side round the origin.
const only = q.get('only')?.split(',').map(Number);
if (propList.length) propList.forEach((k, i) => {
  if (only && !only.includes(i)) return;
  const n = only ? only.indexOf(i) : i, of = only ? only.length : propList.length;
  buildProp(b, { kind: k, x: (n - (of - 1) / 2) * 5, z: 0, rot: 0, size: 1 } as Prop, new Rng(i + 1));
});
else b.wearLandmark(l, () => {
  // M18: Wedding sights (`?kind=kneipe&up=0` hides the pub's roof and upper walls as the game does inside).
  if (kind === 'kneipe') buildKneipe(b, up, l);
  else if (wedding) buildWeddingLandmark(b, l);
  else if (ALEX_KINDS.has(kind)) buildAlexLandmark(b, l);
  else if (MITTE_KINDS.has(kind)) buildMitteLandmark(b, l);
  else if (CHARLOTTENBURG_KINDS.has(kind)) buildCharlottenburgLandmark(b, l);
  else buildLandmark(b, l);
}, CHARLOTTENBURG_KINDS.has(kind) ? CHARLOTTENBURG_WEAR : undefined);
const scene = new Scene();
scene.background = new Color(0x9fb4c0);
scene.add(new HemisphereLight(0xe8f0ff, 0x5a5040, 2.0));
const sun = new DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-30, 50, 40);
scene.add(sun, new GridHelper(80, 40, 0x50606a, 0x6a7a80));
const parts = [b, ...(q.get('up') === '0' ? [] : [up])];
for (const m of parts.flatMap((p) => [...p.solid.meshes(), ...p.cards.meshes(), ...p.glows.meshes()])) scene.add(m);
if (mm.glbProps?.length) { const g = new Group(); buildGlbProps(materials, mm.glbProps, g, mm.stucco.map); scene.add(g); }
// Let the async ground/paint textures arrive.
await new Promise((r) => setTimeout(r, Number(q.get('wait') ?? 1500)));
const size = Number(q.get('size') ?? Math.max(l.hx, l.hz, 6));
const tall = propList.length ? 4 : ({ rathaus: 42, kirche: 36, mueggelturm: 33, riesenrad: 38, sbahnhof: 10, schloss: 18, forum: 10, dino: 5, spati: 4,
  weltzeituhr: 11, dom: 32, rotesrathaus: 42, fernsehturm: 30, marienkirche: 32, neptunbrunnen: 6, nikolaikirche: 28, brunnen: 7, hotelstadtberlin: 50,
  sbahnalex: 12, sbahnhackescher: 12, hausdeslehrers: 36, kongresshalle: 9, kino: 13, cafemoskau: 14, altesmuseum: 12, palast: 16,
  tor: 23, reichstag: 30, bundesbau: 18, kanzleramt: 26, siegessaeule: 50, sony: 36, stage: 5, bahntower: 70, kollhoff: 68, verkehrsturm: 9, klinik: 4,
  philharmonie: 22, matthaeus: 28, stabi: 17, nng: 8, checkpoint: 4, ubahn: 3, mauerstuecke: 4, lafayette: 26,
  zoobahnhof: 16, gedaechtniskirche: 61, kadewe: 18, opernhaus: 28, schlossmitte: 36, belvedere: 19, ehrenhoftor: 8, orangerie: 11, revuepalast: 18,
  loewentor: 7, elefantentor: 11, aquarium: 12, musikpavillon: 8, antilopenhaus: 12, ufapalast: 16, capitol: 9, romanischescafe: 24, gloriapalast: 21,
  marmorhaus: 17, wittenbergplatz: 12, cafewestens: 22, theaterwestens: 24, variete: 14, schillertheater: 21, hochschule: 22, chtor: 16, stuelerbau: 19,
  schlossfluegel: 15, neuerfluegel: 16, gartentor: 6, mausoleum: 10, chrathaus: 45,
  nazareth: 15, neubau: 30, kneipe: 7, amtsgericht: 24, flakturm: 18, beamtentor: 16, maschinenhalle: 14 } as Record<string, number>)[kind] ?? 12;
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
// Triangles of the landmark (solid and card batches), for budget checks: read from the title.
const tris = parts.flatMap((p) => [...p.solid.meshes(), ...p.cards.meshes()]).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
const draws = parts.reduce((n, p) => n + p.solid.meshes().length + p.cards.meshes().length, 0);
document.title = `done ${kind} tris=${tris} draws=${draws}`;
