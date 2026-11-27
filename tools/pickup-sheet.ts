// Dev tool page (WP4 step 3, P10): the ground pickup models. Never part of the game build.
//   /tools/pickup-sheet.html?mode=export     source meshes of the reused kinds (weapon models, hero wear and gear) for
//                                            tools/pickup-models.mjs, in model or hero bind space, linear vertex colours
//   /tools/pickup-sheet.html                 every model of assets/props/pickups.glb through the game's LootView
//   &pickup=A|B|C (the G2 variants)  &rarity=0..3|set  &cols=5
import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, Scene, Vector3, WebGLRenderer, type BufferGeometry, type SkinnedMesh } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { heroLook } from '../src/data/hero-look';
import { PICKUP_MODELS, PICKUP_SAMPLES, type PickupModelId } from '../src/data/pickups';
import { loadCharacters } from '../src/render/characters';
import { GEAR } from '../src/render/gear';
import { GearKit, heroSource } from '../src/render/gear-kit';
import { HeroModel } from '../src/render/hero-model';
import { LOOK } from '../src/render/looks';
import { LootView, pickupVariant } from '../src/render/loot';
import { Materials } from '../src/render/materials';
import { GRAIN_TONE } from '../src/render/paint';
import { PROFILES } from '../src/render/profile';
import { METAL_TONE, Parts, ball, box, cloth, cone, cyl, metal, plain, ring, scaled, weaponParts, wood, type WeaponPart } from '../src/render/weapons';
import type { WeaponLookId } from '../src/data/weapon-look';
import type { Drop, DropContent } from '../src/sim/loot';
import type { Sim } from '../src/sim/types';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'sheet';
const canvas = document.getElementById('c') as HTMLCanvasElement;

/** One source mesh: positions (m), normals, linear vertex colours, optional index. */
interface Src { pos: number[]; nor: number[]; col: number[]; idx?: number[] }

const lin = (byte: number): number => new Color().setHex(byte * 0x10101).r;

/** Parts of the kit (weapons, gear), with the grain map's mean tone folded back into the colour (no map on a pickup). */
function partsMesh(parts: readonly WeaponPart[]): Src {
  const out: Src = { pos: [], nor: [], col: [] };
  for (const p of parts) {
    const g = p.geo, pos = g.attributes.position!, nor = g.attributes.normal!, col = g.attributes.color!, uv = g.attributes.uv!;
    // Matte parts sit in their grain cell of the 4 × 2 atlas (row 0 at v 0.5..1): the cell gives the grain.
    const u = uv.getX(0), v = uv.getY(0);
    const tone = p.slot === 'metal' ? lin(METAL_TONE) : p.slot === 'matte' ? lin(GRAIN_TONE[Math.min(3, Math.floor(u / 0.25)) + (v < 0.5 ? 4 : 0)] ?? 0xb4) : 1;
    for (let i = 0; i < pos.count; i++) {
      out.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      out.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      out.col.push(col.getX(i) * tone, col.getY(i) * tone, col.getZ(i) * tone);
    }
  }
  return out;
}

/** A hero piece in its look's palette (bind space), only the triangles `keep` accepts. */
function pieceMesh(geo: BufferGeometry, keep: (x: number, y: number, z: number) => boolean): Src {
  const pos = geo.attributes.position!, nor = geo.attributes.normal!, col = geo.attributes.color!, index = geo.index!;
  const out: Src = { pos: [], nor: [], col: [] };
  for (let t = 0; t < index.count; t += 3) {
    const v = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    if (!v.every((i) => keep(pos.getX(i), pos.getY(i), pos.getZ(i)))) continue;
    for (const i of v) {
      out.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      out.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      out.col.push(col.getX(i), col.getY(i), col.getZ(i));
    }
  }
  return out;
}

const materials = new Materials(LOOK, PROFILES.qualitaet);

if (mode === 'export') {
  const assets = await loadCharacters(materials, false, false, false);
  const body = new HeroModel(assets.hero, materials);
  const src = heroSource(assets.hero);
  const gear = (ids: readonly string[], keep: (c: Vector3) => boolean = () => true): Src => {
    const k = new GearKit(src);
    for (const id of ids) GEAR[id]!(k);
    const c = new Vector3();
    return partsMesh(k.parts.list.filter((p) => { p.geo.computeBoundingBox(); return keep(p.geo.boundingBox!.getCenter(c)); }));
  };
  const piece = (items: Record<string, string>, node: string, keep: (x: number, y: number, z: number) => boolean): Src => {
    body.setLook(heroLook(Object.fromEntries(Object.entries(items).map(([slot, base]) => [slot, { base }]))));
    return pieceMesh((body.model.getObjectByName(node) as SkinnedMesh).geometry, keep);
  };
  const weapon = (id: WeaponLookId): Src => partsMesh(weaponParts(id));
  const left = (c: Vector3): boolean => c.x > 0;
  const out: Record<string, Src> = {
    blade: weapon('machete'), 'blade-stahl': weapon('stahl'), 'blade-latte': weapon('latte'),
    hammer: weapon('vorschlag'), sling: weapon('zwille'), spear: weapon('rspeer'),
    head: gear(['hat-hard']), 'head-flatcap': gear(['hat-flatcap']),
    hands: piece({ g: 'handsch' }, 'g_handsch', (x) => x > 0.3), 'hands-box': gear(['boxing'], left),
    feet: piece({ f: 'stiefel' }, 'f_stiefel', (x, y) => x > 0 && y < 0.5),
    'feet-turnsch': piece({ f: 'turnsch' }, 'f_turnsch', (x, y) => x > 0 && y < 0.5),
    armor: piece({ a: 'weste' }, 'a_weste', (_x, y) => y > 0.97), 'armor-plate': gear(['plate-panzer', 'pauldrons-panzer']),
  };
  // The gear parts that sit on the piece (the sneaker stripes) join it.
  const stripes = gear(['sneaker-stripes'], left);
  for (const k of ['pos', 'nor', 'col'] as const) out['feet-turnsch']![k].push(...stripes[k]);
  // Code stand-ins (`<id>-code`) for the kinds whose Pixal3D run did not happen yet (ComfyUI down, 2026-11-26), drawn
  // after the 2D sprites (`pickup-*.webp`) and the FLUX picks; replaced by the baked Pixal3D props in phase 2.
  const code = (fn: (b: Parts) => void): Src => { const b = new Parts(); fn(b); return partsMesh(b.list); };
  out['kabel-code'] = code((b) => {
    // Three loose turns of orange cable, two frayed copper ends.
    for (let i = 0; i < 3; i++) b.add(ring(0.12 - i * 0.006, 0.024, 6, 14), plain(0xd8772a), i * 0.012, 0.026 + i * 0.042, -i * 0.01, Math.PI / 2 + (i - 1) * 0.12, 0, 0);
    b.add(cyl(0.014, 0.014, 0.07, 5), metal(0xc87533), 0.14, 0.03, 0.05, 0, 0, Math.PI / 2 - 0.3);
    b.add(cyl(0.014, 0.014, 0.06, 5), metal(0xc87533), -0.13, 0.12, 0.04, 0, 0, -Math.PI / 2 + 0.4);
  });
  out['chemie-code'] = code((b) => {
    // Round flask of green liquid with a cork, in a rusty cage of four bars and two hoops.
    b.add(ball(0.1, 10, 8), plain(0x62c83a), 0, 0.105, 0);
    b.add(cyl(0.032, 0.038, 0.08, 8), plain(0xa8d898), 0, 0.235, 0);
    b.add(cyl(0.04, 0.034, 0.045, 8), wood(0x8a5a32), 0, 0.29, 0);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; b.add(box(0.016, 0.22, 0.016), metal(0x6a4a35), Math.sin(a) * 0.106, 0.11, Math.cos(a) * 0.106); }
    for (const y of [0.04, 0.17]) b.add(ring(0.108, 0.009, 4, 16), metal(0x6a4a35), 0, y, 0, Math.PI / 2, 0, 0);
  });
  out['fleisch-code'] = code((b) => {
    // Thick marbled steak: red meat on a cream fat rim, slightly oval.
    b.add(scaled(cyl(0.15, 0.15, 0.045, 12), 1.3, 1, 1), plain(0xe6d2bd), 0, 0.0225, 0);
    b.add(scaled(cyl(0.135, 0.14, 0.05, 12), 1.28, 1, 0.94), plain(0xa82d36), 0.004, 0.03, 0);
    b.add(scaled(cyl(0.03, 0.03, 0.052, 6), 1.6, 1, 0.5), plain(0xe8c8c0), 0.05, 0.031, 0.03, 0, 0.6, 0);
  });
  out['gemuese-code'] = code((b) => {
    // Three carrots tied together with their green tops, lying against a cabbage head.
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.05;
      b.add(cone(0.032, 0.24, 7), plain(0xe8742a), -0.02, 0.034, z, 0, 0, Math.PI / 2);
      b.add(cone(0.03, 0.09, 5), plain(0x4f9a34), -0.18, 0.04, z, 0, 0, -Math.PI / 2);
    }
    b.add(ring(0.04, 0.008, 4, 10), wood(0x8a6a3a), -0.1, 0.034, 0, 0, Math.PI / 2, 0);
    b.add(scaled(ball(0.1, 10, 8), 1, 0.9, 1), plain(0x8cc86a), 0.12, 0.09, 0.02);
  });
  out['gewuerz-code'] = code((b) => {
    // Burlap sack, rope round the neck, red chilis poking out of the open top.
    b.add(cyl(0.085, 0.11, 0.17, 10), cloth(0xb8945a), 0, 0.085, 0);
    b.add(ring(0.085, 0.012, 4, 12), wood(0x6a4a2a), 0, 0.15, 0, Math.PI / 2, 0, 0);
    b.add(cyl(0.1, 0.085, 0.05, 10), cloth(0xa8844a), 0, 0.19, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.add(cone(0.016, 0.1, 5), plain(0xc8281e), Math.sin(a) * 0.04, 0.23, Math.cos(a) * 0.04, Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); }
  });
  (window as unknown as { __src: Record<string, Src> }).__src = out;
  document.title = `done ${Object.keys(out).length}`;
} else {
  // Sheet: every model through the game's LootView, one cell each, close three-quarter view from the game camera's side.
  const variant = pickupVariant(q.get('pickup'));
  const rarity = q.get('rarity') ?? '0';
  const cols = Number(q.get('cols') ?? 5), CELL = Number(q.get('cell') ?? 240), STEP = 3;
  const ids = PICKUP_MODELS;
  const rows = Math.ceil(ids.length / cols);
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(cols * CELL, rows * CELL + 30, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  const scene = new Scene();
  scene.background = new Color(0x2a2622);
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  scene.add(new HemisphereLight(0xdfeeff, 0x3a3020, 1.1));
  const sun = new DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const view = new LootView(variant);
  scene.add(view.group);
  await view.ready;
  // One landed drop per model on a grid, STEP m apart, standing still (no spin) for a fair look.
  const drops: Drop[] = ids.map((id, i) => {
    const content: DropContent = PICKUP_SAMPLES[id](rarity === 'set' ? 'set' : (Number(rarity) as 0 | 1 | 2 | 3));
    return { id: 0, x: (i % cols) * STEP, z: Math.floor(i / cols) * STEP, vx: 0, vz: 0, h: 0, vh: 0, t: 5, landed: true, content };
  });
  view.update({ drops } as unknown as Sim, 0, true);
  const cam = new OrthographicCamera(-1, 1, 1, -1, -20, 40);
  const tris = await view.triangles();
  const wrap = document.getElementById('wrap')!;
  document.getElementById('title')!.textContent = `Pickup models (P10), variant ${variant}, rarity ${rarity}: ${ids.length} kinds, one InstancedMesh each`;
  renderer.setScissorTest(true);
  ids.forEach((id, i) => {
    const cx = (i % cols) * STEP, cz = Math.floor(i / cols) * STEP, col = i % cols, row = Math.floor(i / cols);
    // The game camera looks down about 44° from the south; the sheet does the same, a little turned.
    const dir = new Vector3(0.35, 0.95, 1).normalize();
    cam.position.set(cx + dir.x * 10, 0.35 + dir.y * 10, cz + dir.z * 10);
    cam.lookAt(cx, 0.35, cz);
    const half = 0.62;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    const y = (rows - 1 - row) * CELL;
    renderer.setViewport(col * CELL, y, CELL, CELL);
    renderer.setScissor(col * CELL, y, CELL, CELL);
    renderer.render(scene, cam);
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.style.left = `${col * CELL + 6}px`;
    cap.style.top = `${30 + row * CELL + CELL - 34}px`;
    const t = tris[id as PickupModelId] ?? 0;
    cap.innerHTML = `${id}<br><i>${t > 1 ? `${t} tris` : 'no model yet: crystal'}</i>`;
    wrap.append(cap);
  });
  document.title = `done ${ids.length}`;
}
