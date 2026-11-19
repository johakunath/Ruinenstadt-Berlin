// Dev tool page: every weapon model next to its painted reference and its rendered icon (WP4 step 1), and the
// icon renderer of D10. Never part of the game build.
//   /tools/item-sheet.html?mode=weapons                      all weapon looks
//   &family=normal,neon (weapon-look.ts families)  &el=fire (element glow on all)  &cols=3  &spin=0.6
//   /tools/item-sheet.html?mode=icons                        renders every weapon icon (tools/item-icons.mjs saves them)
// Sheet: models drawn from the side, turned 0.6 rad about their own axis, the tip up right like the icons,
// each fitted to its panel; the caption gives the tip height (D8 length), reach and damage factors, the
// triangle count and the meshes drawn (draw calls per pass). Left: the painted 2D icon when a copy sits in
// `assets-src/painted-icons/` (git-ignored; `git show e2ed157:assets/inventory/<id>.webp`), right: the rendered icon.
// Studio environment light, ACES tone mapping, no bloom.
import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, Quaternion, Scene, Vector3, WebGLRenderer, type Mesh } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BASES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES, NEON_WEAPON_NAMES, WEAPON_NAMES } from '../src/data/item-names';
import { SETS, type ElementId, type SetId } from '../src/data/items';
import { WEAPON_LOOKS, weaponTraits, type WeaponLookId } from '../src/data/weapon-look';
import { LOOK } from '../src/render/looks';
import { Materials } from '../src/render/materials';
import { PROFILES } from '../src/render/profile';
import { GUNS, WeaponRack, hasBuilder, weaponGeometry } from '../src/render/weapons';
import { ITEM_ICONS } from '../src/ui/item-icons';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'weapons';
const families = (q.get('family') ?? '').split(',').filter(Boolean);
const el = (q.get('el') ?? undefined) as ElementId | undefined;
const cols = Number(q.get('cols') ?? 3);
const W = 300, H = 190, ICON = 256;
const spin = Number(q.get('spin') ?? 0.6);

// German name per look: the current name tables first (BASES also keeps legacy names), sets by piece.
const names = new Map<string, string>();
for (const t of [WEAPON_NAMES, NEON_WEAPON_NAMES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES]) for (const list of Object.values(t)) for (const n of list) names.set(BASES[n]!, n);
names.set('latte', 'Holzlatte');
for (const [id, s] of Object.entries(SETS)) if (s.pieces.w) names.set(names.has(s.pieces.w.base) ? `${s.pieces.w.base}:${id}` : s.pieces.w.base, s.pieces.w.name);
/** Icon id of a look: `base:set` first, as `itemIcon` does. */
const iconOf = (id: WeaponLookId): string => ITEM_ICONS[id] ?? ITEM_ICONS[id.split(':')[0]!]!;

const ids = (Object.keys(WEAPON_LOOKS) as WeaponLookId[]).filter((id) => !families.length || families.includes(WEAPON_LOOKS[id].family));
const grid = document.getElementById('grid')!;
if (mode === 'weapons') {
  document.getElementById('title')!.textContent = `Weapon models (WP4 step 1): painted 2D icon, model (tip up right, fitted to its panel), rendered icon${el ? `, element ${el}` : ''}`;
  grid.style.gridTemplateColumns = `repeat(${cols}, 590px)`;
}

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setSize(mode === 'icons' ? ICON : W, mode === 'icons' ? ICON : H, false);
renderer.toneMapping = ACESFilmicToneMapping;
const materials = new Materials(LOOK, PROFILES.qualitaet);
const scene = new Scene();
scene.background = mode === 'icons' ? null : new Color(0x4a4a50);
renderer.setClearColor(0x000000, 0);
// Studio light: the game's sky environment is not available here; metal needs something to reflect.
scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = mode === 'icons' ? 0.8 : 0.35;
scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, mode === 'icons' ? 1.6 : 1.2));
const sun = new DirectionalLight(0xfff0d8, mode === 'icons' ? 3 : 2.6);
sun.position.set(-2, 4, 5);
// Icons: a cool rim from behind so dark parts separate from the dark inventory cell.
const rim = new DirectionalLight(0x9fd6dc, mode === 'icons' ? 2.2 : 0);
rim.position.set(3, 1, -4);
scene.add(sun, rim);
const rack = new WeaponRack(materials);
scene.add(rack.group);
const cam = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
cam.position.set(0, 0, 5);
const box = new Box3(), c = new Vector3(), size = new Vector3();

/** Poses the look and fits the camera to a w × h frame (margin: share of the frame left free). */
function frame(id: WeaponLookId, w: number, h: number, rot: [number, number, number], margin: number, thick = 1): Mesh[] {
  rack.show(id, el);
  rack.group.position.set(0, 0, 0);
  // Spin about the model's own axis first, then the tilt, then the diagonal.
  rack.group.rotation.set(rot[0], rot[1], rot[2], 'ZXY');
  // A gun lies along its barrel (−Z): turn the barrel onto +Y, the grip below it.
  if (GUNS[id]) rack.group.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)));
  rack.group.scale.set(thick, 1, thick);
  rack.group.updateMatrixWorld(true);
  const shown = rack.group.children.find((g) => g.visible)!;
  box.setFromObject(shown, true).getCenter(c);
  box.getSize(size);
  const half = (Math.max(size.x / w, size.y / h) / 2) / (1 - margin);
  cam.left = c.x - half * w; cam.right = c.x + half * w; cam.top = c.y + half * h; cam.bottom = c.y - half * h;
  cam.updateProjectionMatrix();
  return (shown.children as Mesh[]).filter((m) => m.visible);
}

if (mode === 'icons') {
  // D10: three-quarter view, lying diagonally (grip bottom left, tip top right), fitted, transparent.
  // Long weapons are drawn thicker across (not longer), so a spear still reads at the inventory cell size.
  const THICK: Record<string, number> = { spear: 2.2, blade: 1.35, hammer: 1, sling: 1 };
  const out: Record<string, string> = {};
  for (const id of ids) {
    frame(id, ICON, ICON, [0.2, 0.45, -Math.PI / 4], 0.04, THICK[WEAPON_LOOKS[id].kind]);
    renderer.render(scene, cam);
    out[iconOf(id)] = renderer.domElement.toDataURL('image/webp', 0.92);
  }
  (window as unknown as { __icons: Record<string, string> }).__icons = out;
  document.title = `done ${ids.length}`;
} else {
  for (const id of ids) {
    const look = WEAPON_LOOKS[id], set = id.split(':')[1] as SetId | undefined, tr = weaponTraits(id);
    // Tip up right along the panel diagonal; spin turns it about its own axis so bands and depth show.
    const meshes = frame(id, W, H, [0, spin, -(Math.PI / 2 - Math.atan2(H, W))], 0.08).length;
    renderer.render(scene, cam);
    const tris = Object.values(weaponGeometry(id)).reduce((a, g) => a + g.attributes.position!.count / 3, 0);
    const cell = document.createElement('div');
    cell.className = 'cell';
    const painted = document.createElement('img');
    painted.src = `/assets-src/painted-icons/${iconOf(id)}.webp`;
    painted.onerror = (): void => { painted.style.visibility = 'hidden'; };
    const icon = document.createElement('img');
    icon.src = `/assets/inventory/${iconOf(id)}.webp`;
    const pic = document.createElement('div');
    pic.className = 'pic';
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    const cap = document.createElement('div');
    cap.className = 'cap';
    const pct = (k: number): string => `${Math.round(k * 100)} %`;
    cap.innerHTML = `<b>${names.get(id) ?? id}</b><br><i>${id} · ${look.kind} · ${look.family}${hasBuilder(id) ? '' : ' · fallback'}${set ? ` · set ${set}` : ''} · ${tr.hands} Hand<br>${iconOf(id)} · tip ${Math.round(look.length * 100)} cm · reach ${pct(tr.reach)} · damage ${pct(tr.damage)} · ${tris} tris · ${meshes} draws</i>`;
    pic.append(cv, cap);
    cell.append(painted, pic, icon);
    grid.append(cell);
  }
  await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)));
  document.title = `done ${ids.length}`;
}
