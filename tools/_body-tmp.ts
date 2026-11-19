// Dev tool page (WP4 step 2): the hero in clothing looks, and the wearable icons. Never part of the game build.
//   /tools/look-sheet.html?group=koepenick          the mockup groups: koepenick, xhain, alex-mitte, sets, legendary, all
//   /tools/look-sheet.html?looks=a:leder,h:muetze;a:feuer   one look per `;`, items as slot:base[:set]
//   &views=front,side,back   &zoom=head|hands|feet|torso|body   &pose=Idle_Loop@0.4 (clip@time; `bind` for the T-pose)
//   /tools/look-sheet.html?mode=icons               every wearable icon (tools/item-icons.mjs saves them)
// Caption: item names, gear triangles per slot and the hero's visible skinned meshes (draw calls per pass).
import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type Mesh, type Object3D } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { heroLook, WEAR } from '../src/data/hero-look';
import { BASES } from '../src/data/item-names';
import { SETS, type SetId, type SlotId } from '../src/data/items';
import { loadCharacters, Animator } from '../src/render/characters';
import { gearGeometry, gearTriangles } from '../src/render/gear';
import { heroSource } from '../src/render/gear-kit';
import { HeroModel } from '../src/render/hero-model';
import { LOOK } from '../src/render/looks';
import { Materials } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';
import { ITEM_ICONS } from '../src/ui/item-icons';

type Item = { slot: 'a' | 'h' | 'g' | 'f'; base: string; set?: SetId };
const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'looks';

// German names: from the name tables (BASES maps name → base) and the set pieces.
const names = new Map<string, string>();
for (const [name, base] of Object.entries(BASES)) if (!names.has(base)) names.set(base, name);
for (const [id, s] of Object.entries(SETS)) for (const p of Object.values(s.pieces)) names.set(`${p.base}:${id}`, p.name);
const nameOf = (it: Item): string => names.get(it.set ? `${it.base}:${it.set}` : it.base) ?? it.base;

const parse = (spec: string): Item[] => spec.split(',').filter(Boolean).map((s) => { const [slot, base, set] = s.split(':'); return { slot: slot as Item['slot'], base: base!, set: set as SetId | undefined }; });
const GROUPS: Record<string, string> = {
  koepenick: ';a:mantel;a:weste;h:helm;h:schieber;g:handsch;g:schweiss;f:stiefel;f:gummi;a:mantel,h:helm,g:handsch,f:gummi',
  xhain: 'a:leder;a:feuer;a:bvg;h:muetze;h:maske;g:bandage;f:turnsch;a:leder,h:muetze,g:bandage,f:turnsch',
  'alex-mitte': 'a:blaumann;h:stroh;g:gartenh;a:blaumann,h:stroh,g:gartenh;a:poncho;a:kmantel;h:nbrille;a:kmantel,h:nbrille',
  sets: 'a:weste:kiez,h:kiezhelm,g:kiezhand;a:weste:kiez;h:kiezhelm;g:kiezhand;a:mantel:spree,f:spreestief;a:mantel:spree;f:spreestief;a:kette:zit,h:topfhelm,f:eisenstief;a:kette:zit;h:topfhelm;f:eisenstief',
  legendary: 'a:spaeti;a:panzer;a:rattenmantel;a:ritter;h:pickel;g:kiezbox;f:schaffner',
};
GROUPS.all = Object.values(GROUPS).join(';');

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: mode === 'icons' });
renderer.toneMapping = ACESFilmicToneMapping;
const materials = new Materials(LOOK, PROFILES.qualitaet);
const assets = await loadCharacters(materials, false, false, false);
const scene = new Scene();
scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 1.3));
const key = new DirectionalLight(0xffe2bd, 2.6);
key.position.set(1.5, 2.5, 3);
const rim = new DirectionalLight(0x9fd6d0, 1.6);
rim.position.set(-2, 2, -2.5);
scene.add(key, rim);
const body = new HeroModel(assets.hero, materials);
scene.add(body.model);
const anim = new Animator(body.model, assets.heroClips);
const [clip, time] = (q.get('pose') ?? 'Idle_Loop@0.4').split('@');
if (clip !== 'bind') { anim.pose(clip!, Number(time ?? 0), 0); anim.update(0); }
body.model.updateMatrixWorld(true);
const src = heroSource(assets.hero);
const bones = ((assets.hero.getObjectByName('a_mantel') as unknown as { skeleton: { bones: Object3D[] } }).skeleton.bones).map((b) => b.name);

const equip = (items: Item[]): Partial<Record<SlotId, { base: string; set?: SetId }>> => Object.fromEntries(items.map((it) => [it.slot, { base: it.base, set: it.set }]));

/** Visible skinned meshes of the body (draw calls per pass). */
const draws = (): number => { let n = 0; body.model.traverse((o) => { if ((o as Mesh).isMesh && o.visible && (o as Mesh).geometry.attributes.position) n++; }); return n; };

if (mode === 'icons') {
  // One icon per wearable base: only that item's piece and gear, three-quarter view, fitted, transparent.
  const S = 256;
  renderer.setSize(S, S, false);
  renderer.setClearColor(0, 0);
  scene.background = null;
  scene.environmentIntensity = 0.8;
  const cam = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const out: Record<string, string> = {};
  const items: Item[] = [];
  for (const slot of ['a', 'h', 'g', 'f'] as const) for (const key of Object.keys(WEAR[slot])) { const [base, set] = key.split(':'); items.push({ slot, base: base!, set: set as SetId | undefined }); }
  for (const it of items) {
    const look = heroLook(equip([it]));
    body.setLook(look);
    const keep = (n: string): boolean => n.startsWith('gear_') || (it.slot === 'a' && n === (look.outfit === 'weste' ? 'a_weste' : 'a_mantel')) || (it.slot === 'f' && n === (look.boots === 'turnsch' ? 'f_turnsch' : 'f_stiefel')) || (it.slot === 'g' && n === 'g_handsch' && !!look.gloves);
    const shown: Object3D[] = [];
    body.model.traverse((o) => { if ((o as Mesh).isMesh) { if (o.visible && !keep(o.name)) { o.visible = false; shown.push(o); } } });
    // Three-quarter view from the front left, a little from above; gloves: the right hand only.
    const yaw = it.slot === 'h' ? 0.7 : it.slot === 'f' ? 0.6 : it.slot === 'g' ? -0.9 : 0.45;
    body.model.rotation.y = yaw;
    body.model.updateMatrixWorld(true);
    const box = new Box3();
    body.model.traverse((o) => { if ((o as Mesh).isMesh && o.visible) box.expandByObject(o, true); });
    if (it.slot === 'g') { box.max.x = Math.min(box.max.x, box.min.x + 0.22); }
    const c = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
    const half = Math.max(size.x, size.y) / 2 / 0.92;
    cam.position.set(c.x, c.y + half * 0.25, c.z + 5);
    cam.lookAt(c.x, c.y, c.z);
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const icon = ITEM_ICONS[it.set ? `${it.base}:${it.set}` : it.base] ?? ITEM_ICONS[it.base]!;
    out[icon] = renderer.domElement.toDataURL('image/webp', 0.92);
    for (const o of shown) o.visible = true;
    body.model.rotation.y = 0;
  }
  (window as unknown as { __icons: Record<string, string> }).__icons = out;
  document.title = `done ${items.length}`;
} else {
  const looks = (q.get('looks') ?? GROUPS[q.get('group') ?? 'koepenick']!).split(';').map(parse);
  const views = (q.get('views') ?? 'front,side,back').split(',');
  const zoom = q.get('zoom') ?? 'body';
  const W = Number(q.get('w') ?? (zoom === 'body' ? 200 : 180)), H = Number(q.get('h') ?? (zoom === 'body' ? 330 : 180));
  const per = views.length, cols = Number(q.get('cols') ?? Math.max(1, Math.floor(6 / per)));
  const rows = Math.ceil(looks.length / cols);
  renderer.setSize(W * per * cols, (H + 34) * rows, false);
  renderer.setScissorTest(true);
  scene.background = new Color(0x1a130e);
  const cam = new PerspectiveCamera(zoom === 'body' ? 24 : 18, W / H, 0.1, 50);
  const Z: Record<string, [number, number]> = { body: [0.93, 4.6], head: [1.65, 1.15], hands: [1.0, 1.6], feet: [0.25, 1.6], torso: [1.2, 2.2] };
  const [cy, dist] = Z[zoom] ?? Z.body!;
  const wrap = document.getElementById('wrap')!;
  looks.forEach((items, i) => {
    const look = heroLook(equip(items));
    const pf = (q.get("puffs") ?? "").split(",")[i];
    if (pf) look.puff = Number(pf);
    body.setLook(look);
    const gt = gearTriangles(gearGeometry(src, bones, look.gear));
    const x0 = (i % cols) * W * per, y0 = Math.floor(i / cols) * (H + 34);
    views.forEach((v, j) => {
      const a = v === 'front' ? 0 : v === 'side' ? Math.PI / 2 : v === 'back' ? Math.PI : v === 'three' ? 0.6 : Number(v);
      const hx = zoom === 'hands' ? -0.36 : 0;
      cam.position.set(hx + Math.sin(a) * dist, cy + 0.05, Math.cos(a) * dist);
      cam.lookAt(hx, cy, 0);
      renderer.setViewport(x0 + j * W, (rows - 1 - Math.floor(i / cols)) * (H + 34), W, H);
      renderer.setScissor(x0 + j * W, (rows - 1 - Math.floor(i / cols)) * (H + 34), W, H);
      renderer.setClearColor(0x1a130e, 1);
      renderer.clear();
      renderer.render(scene, cam);
    });
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.style.left = `${x0 + 6}px`;
    cap.style.top = `${y0 + H + 2}px`;
    cap.innerHTML = `${items.length ? items.map(nameOf).join(' + ') : 'Ohne Rüstung'}<br><i>gear ${gt.matte}/${gt.metal}/${gt.glow} tris · ${draws()} draws</i>`;
    wrap.append(cap);
  });
  document.title = `done ${looks.length}`;
}
