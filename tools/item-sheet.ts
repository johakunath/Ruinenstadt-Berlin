// Dev tool page: every weapon model next to its painted icon (WP4 step 1), to compare model and icon.
// Never part of the game build.
//   /tools/item-sheet.html?mode=weapons                      all weapon looks
//   &family=normal,neon (weapon-look.ts families)  &el=fire (element glow on all)  &cols=3
// Models are drawn in side view (the model's XY profile), turned so the tip points up right like the
// icons, each fitted to its panel; the caption gives the real length, the triangle count and the meshes
// drawn (draw calls per pass). Studio environment light, ACES tone mapping, no bloom.
import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, Scene, Vector3, WebGLRenderer, type Mesh } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BASES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES, NEON_WEAPON_NAMES, WEAPON_NAMES } from '../src/data/item-names';
import { SETS, type ElementId, type SetId } from '../src/data/items';
import { WEAPON_LOOKS, type WeaponLookId } from '../src/data/weapon-look';
import { LOOK } from '../src/render/looks';
import { Materials } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';
import { WeaponRack, hasBuilder, weaponGeometry } from '../src/render/weapons';
import { ITEM_ICONS } from '../src/ui/item-icons';

const q = new URLSearchParams(location.search);
const families = (q.get('family') ?? '').split(',').filter(Boolean);
const el = (q.get('el') ?? undefined) as ElementId | undefined;
const cols = Number(q.get('cols') ?? 3);
const W = 300, H = 190;

// German name per look: the current name tables first (BASES also keeps legacy names), sets by piece.
const names = new Map<string, string>();
for (const t of [WEAPON_NAMES, NEON_WEAPON_NAMES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES]) for (const list of Object.values(t)) for (const n of list) names.set(BASES[n]!, n);
names.set('latte', 'Holzlatte');
for (const [id, s] of Object.entries(SETS)) if (s.pieces.w) names.set(names.has(s.pieces.w.base) ? `${s.pieces.w.base}:${id}` : s.pieces.w.base, s.pieces.w.name);

const ids = (Object.keys(WEAPON_LOOKS) as WeaponLookId[]).filter((id) => !families.length || families.includes(WEAPON_LOOKS[id].family));
document.getElementById('title')!.textContent = `Weapon models (WP4 step 1) beside their icons: side view, tip up right, each fitted to its panel${el ? `, element ${el}` : ''}`;
const grid = document.getElementById('grid')!;
grid.style.gridTemplateColumns = `repeat(${cols}, 446px)`;

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.toneMapping = ACESFilmicToneMapping;
const materials = new Materials(LOOK, PROFILES.qualitaet);
const scene = new Scene();
scene.background = new Color(0x4a4a50);
// Studio light: the game's sky environment is not available here; metal needs something to reflect.
scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 1.2));
const sun = new DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-2, 4, 5);
scene.add(sun);
const rack = new WeaponRack(materials);
scene.add(rack.group);
const cam = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
cam.position.set(0, 0, 5);
const box = new Box3(), c = new Vector3(), size = new Vector3();

for (const id of ids) {
  const look = WEAPON_LOOKS[id];
  const base = id.split(':')[0]!, set = id.split(':')[1] as SetId | undefined;
  rack.show(id, el);
  rack.group.position.set(0, 0, 0);
  // Tip up right along the panel diagonal (icons: grip bottom left, tip top right).
  rack.group.rotation.set(0, 0, -(Math.PI / 2 - Math.atan2(H, W)));
  rack.group.updateMatrixWorld(true);
  const shown = rack.group.children.find((g) => g.visible)!;
  box.setFromObject(shown, true).getCenter(c);
  box.getSize(size);
  const half = Math.max(size.x / W, size.y / H) * 0.54;
  cam.left = c.x - half * W; cam.right = c.x + half * W; cam.top = c.y + half * H; cam.bottom = c.y - half * H;
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const tris = Object.values(weaponGeometry(id)).reduce((a, g) => a + g.attributes.position!.count / 3, 0);
  const meshes = (shown.children as Mesh[]).filter((m) => m.visible).length;
  const len = weaponGeometry(id);
  const yb = new Box3();
  for (const g of Object.values(len)) { g.computeBoundingBox(); yb.union(g.boundingBox!); }
  const cell = document.createElement('div');
  cell.className = 'cell';
  const img = document.createElement('img');
  img.src = `/assets/inventory/${ITEM_ICONS[base]}.webp`;
  const pic = document.createElement('div');
  pic.className = 'pic';
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.innerHTML = `<b>${names.get(id) ?? id}</b><br><i>${id} · ${look.kind} · ${look.family}${hasBuilder(id) ? '' : ' · fallback'}<br>${ITEM_ICONS[base]} · ${Math.round((yb.max.y - yb.min.y) * 100)} cm · ${tris} tris · ${meshes} draws${set ? ` · set ${set}` : ''}</i>`;
  pic.append(cv, cap);
  cell.append(img, pic);
  grid.append(cell);
}
await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)));
document.title = `done ${ids.length}`;
