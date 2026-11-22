// Piece variants for the hero's looks (WP4 step 2, D2 mechanisms 1 and 4): every vertex of a clothing
// piece gets a colour role from its source colour and place; a palette recolours roles (brightness, so
// baked occlusion and noise, is kept), a cut drops the coat skirt down to a row, and `puff` pushes the
// outfit out round the shoulders. A variant is a new BufferGeometry that shares every attribute of the
// source except the ones it changes, built once and shared by all hero bodies (0 draw calls, no new
// shader: the attribute set stays the same).
import { BufferAttribute, BufferGeometry, Color, type SkinnedMesh } from 'three';
import { PALETTES, type Role } from '../data/hero-look';

/** Source colours of tools/blender/hero_clothes.py (sRGB), per piece and role. */
const SOURCE: Readonly<Record<string, Readonly<Partial<Record<Role, string>>>>> = {
  a_mantel: { coat: '#8a5c33', hem: '#8a5c33', cuff: '#8a5c33', trousers: '#3d3a36', leather: '#4a2f1a', brass: '#c9973a' },
  a_poncho: { coat: '#8a5c33', hem: '#8a5c33', trousers: '#3d3a36' },
  a_weste: { vest: '#5d6b3a', cargo: '#4a3b2c', straps: '#4a2f1a', belt: '#4a2f1a', thigh: '#4a2f1a', brass: '#c9973a' },
  f_stiefel: { boot: '#2a1f17', sole: '#2a1f17' },
  f_turnsch: { upper: '#c9bea4', sole: '#e2dccb' },
  f_wickel: { boot: '#2a1f17', sole: '#2a1f17' },
  g_handsch: { glove: '#3b2717', cuff: '#3b2717' },
  scarf: { scarf: '#d22c1e' },
};

/** Chroma classes (rgb ÷ max) in the committed hero.glb, nearest wins; `hero-wear.test.ts` pins the counts. */
const CLASSES: Readonly<Record<string, ReadonlyArray<readonly [Role, number, number, number]>>> = {
  a_mantel: [['coat', 1, 0.4375, 0.125], ['coat', 1, 0.375, 0.0625], ['trousers', 1, 0.875, 0.75], ['brass', 1, 0.5625, 0.0625], ['leather', 1, 0.375, 0.125]],
  a_poncho: [['coat', 1, 0.4375, 0.125], ['coat', 1, 0.375, 0.0625], ['trousers', 1, 0.875, 0.75]],
  a_weste: [['vest', 0.75, 1, 0.25], ['cargo', 1, 0.625, 0.3125], ['straps', 1, 0.375, 0.125], ['brass', 1, 0.5625, 0.0625]],
  f_stiefel: [['boot', 1, 0.5, 0.25]],
  f_turnsch: [['sole', 1, 0.9375, 0.8125], ['upper', 1, 0.875, 0.625]],
  f_wickel: [['boot', 1, 0.5, 0.25]],
  g_handsch: [['glove', 1, 0.375, 0.125]],
  scarf: [['scarf', 1, 0.0625, 0]],
};

const ROLE_IDS: readonly Role[] = ['coat', 'hem', 'cuff', 'leather', 'brass', 'trousers', 'vest', 'straps', 'belt', 'thigh', 'cargo', 'boot', 'sole', 'upper', 'glove', 'scarf'];
const SKIRT_JOINT = /^(thigh_|coat_b|pelvis)/;
/** Top of the skirt (it hangs from the belt at 1.08 m) and the hem row of the whole coat. */
const SKIRT_TOP = 1.09;
const HEM_ROW = 0.56;

export interface PieceInfo {
  /** Role index per vertex (`ROLE_IDS`), 255 for none. */
  role: Uint8Array;
  /** 1 where the vertex belongs to the coat skirt (coat or pocket brass below the belt, on a leg or the pelvis). */
  skirt: Uint8Array;
}

const infos = new WeakMap<BufferGeometry, PieceInfo>();
const _c = new Color();

/**
 * Roles of a piece's vertices (cached per source geometry). `piece` is the node name; `geo` the source
 * geometry (not `mesh.geometry`, which is the current look's variant once a look was set).
 */
export function pieceInfo(mesh: SkinnedMesh, piece: string, geo: BufferGeometry = mesh.geometry): PieceInfo {
  let info = infos.get(geo);
  if (info) return info;
  const pos = geo.attributes.position!, col = geo.attributes.color;
  const n = pos.count;
  info = { role: new Uint8Array(n).fill(255), skirt: new Uint8Array(n) };
  const classes = CLASSES[piece];
  if (!col || !classes) { infos.set(geo, info); return info; }
  const si = geo.attributes.skinIndex!, sw = geo.attributes.skinWeight!;
  const bones = mesh.skeleton.bones;
  for (let i = 0; i < n; i++) {
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i), m = Math.max(r, g, b, 1e-6);
    let best: Role = classes[0]![0], d = Infinity;
    for (const [role, cr, cg, cb] of classes) {
      const e = (r / m - cr) ** 2 + (g / m - cg) ** 2 + (b / m - cb) ** 2;
      if (e < d) { d = e; best = role; }
    }
    const x = pos.getX(i), y = pos.getY(i);
    // Dominant joint of the vertex.
    let j = si.getX(0), w = -1;
    for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (wk > w) { w = wk; j = si.getComponent(i, k); } }
    const joint = bones[j]?.name ?? '';
    if (piece === 'a_mantel') {
      // Leather is only the belt ring and its pouch; the same chroma elsewhere is the coat in shadow.
      if (best === 'leather' && (y < 0.94 || y > 1.12)) best = 'coat';
      const skirt = (best === 'coat' && y < SKIRT_TOP) || (best === 'brass' && y < 0.97);
      if (skirt && SKIRT_JOINT.test(joint)) info.skirt[i] = 1;
      if (best === 'coat' && info.skirt[i] && y < HEM_ROW) best = 'hem';
      if (best === 'coat' && Math.abs(x) > 0.56) best = 'cuff';
    } else if (piece === 'a_poncho') {
      // The panels' last row (hem at 0.69 m, jagged by up to 3 cm) takes the hem colour.
      if (best === 'coat' && y < 0.75) best = 'hem';
    } else if (piece === 'a_weste' && best === 'straps') {
      best = y < 0.82 ? 'thigh' : y < 1.09 ? 'belt' : 'straps';
    } else if ((piece === 'f_stiefel' || piece === 'f_wickel') && y < 0.022) best = 'sole';
    else if (piece === 'g_handsch' && Math.abs(x) < 0.665) best = 'cuff'; // the wrist ring (the glove starts at |x| 0.62)
    info.role[i] = ROLE_IDS.indexOf(best);
  }
  infos.set(geo, info);
  return info;
}

/** Linear brightness of a source colour (max channel). */
function bright(hex: string): number {
  _c.set(hex);
  return Math.max(_c.r, _c.g, _c.b);
}

/** Drops every skirt triangle below `cut` (+1 cm, so the triangles of the cut row's band go). */
function cutIndex(geo: BufferGeometry, info: PieceInfo, cut: number): BufferAttribute {
  const idx = geo.index!, pos = geo.attributes.position!;
  const keep: number[] = [];
  const low = (v: number): boolean => info.skirt[v] === 1 && pos.getY(v) < cut + 0.012;
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (low(a) && low(b) && low(c)) continue;
    keep.push(a, b, c);
  }
  return new BufferAttribute(pos.count > 65535 ? new Uint32Array(keep) : new Uint16Array(keep), 1);
}

/** Colours of a palette; with a cut, the skirt vertices on the cut row take the hem colour. */
function tintColors(geo: BufferGeometry, piece: string, info: PieceInfo, paletteId: string, cut: number): BufferAttribute {
  const src = geo.attributes.color!, pos = geo.attributes.position!, nrm = geo.attributes.normal!;
  const out = new Float32Array(src.count * src.itemSize);
  const pal = PALETTES[paletteId];
  const source = SOURCE[piece] ?? {};
  const target = new Map<number, [number, number, number]>();
  const lin = (hex: string): [number, number, number] => { _c.set(hex); return [_c.r, _c.g, _c.b]; };
  for (const [role, hex] of Object.entries(pal?.roles ?? {})) target.set(ROLE_IDS.indexOf(role as Role), lin(hex));
  const refOf = ROLE_IDS.map((r) => bright(source[r] ?? '#ffffff'));
  const bands = (pal?.bands ?? []).map((b) => ({ ...b, ids: b.roles.map((r) => ROLE_IDS.indexOf(r)), rgb: lin(b.hex) }));
  const spots = (pal?.spots ?? []).map((s) => ({ ...s, ids: s.roles.map((r) => ROLE_IDS.indexOf(r)), rgb: lin(s.hex) }));
  const hemId = ROLE_IDS.indexOf('hem');
  for (let i = 0; i < src.count; i++) {
    const r = src.getX(i), g = src.getY(i), b = src.getZ(i);
    let role = info.role[i]!;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // The hem moves to the cut row.
    if (cut > 0 && role === hemId) role = ROLE_IDS.indexOf('coat');
    if (cut > 0 && info.skirt[i] && Math.abs(y - cut) < 0.03 && cut < SKIRT_TOP) role = hemId;
    let rgb = target.get(role);
    for (const band of bands) {
      if (!band.ids.includes(role)) continue;
      const v = band.axis === 'y' ? y : Math.abs(x);
      const off = band.wave ? band.wave * Math.sin(Math.atan2(x, z) * 9) : 0;
      if (v >= band.from + off && v <= band.to + off) rgb = band.rgb;
    }
    for (const s of spots) {
      if (!s.ids.includes(role)) continue;
      if (s.side === 'front' && nrm.getZ(i) < 0) continue;
      if (s.side === 'back' && nrm.getZ(i) > 0) continue;
      if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r) rgb = s.rgb;
    }
    const k = rgb ? Math.min(1.4, Math.max(r, g, b) / Math.max(1e-4, refOf[role] ?? 1)) : 1;
    const c = rgb ? [rgb[0] * k, rgb[1] * k, rgb[2] * k] : [r, g, b];
    out.set(src.itemSize === 4 ? [c[0]!, c[1]!, c[2]!, src.getW(i)] : c, i * src.itemSize);
  }
  return new BufferAttribute(out, src.itemSize);
}

/**
 * Shoulder volume: vertices of the outfit's upper body move out along their normals, most at the
 * shoulder cap (±0.19, 1.43 m) and fading over 0.2 m; the back middle (scarf tail) and the neck stay.
 */
function puffed(geo: BufferGeometry, info: PieceInfo, puff: number): BufferAttribute {
  const pos = geo.attributes.position!, nrm = geo.attributes.normal!;
  const out = new Float32Array(pos.count * 3);
  const upper = new Set(['coat', 'cuff', 'vest', 'straps'].map((r) => ROLE_IDS.indexOf(r as Role)));
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (upper.has(info.role[i]!) && y > 1.2) {
      const d = Math.hypot(Math.abs(x) - 0.19, (y - 1.43) * 1.3);
      const w = Math.max(0, 1 - d / 0.2) ** 1.5 * Math.min(1, Math.max(0, (Math.abs(x) - 0.07) / 0.06));
      x += nrm.getX(i) * puff * w; y += nrm.getY(i) * puff * w * 0.6; z += nrm.getZ(i) * puff * w;
    }
    out.set([x, y, z], i * 3);
  }
  return new BufferAttribute(out, 3);
}

const variants = new WeakMap<BufferGeometry, Map<string, BufferGeometry>>();

/**
 * The geometry of `mesh`'s piece in a look: palette, cut (coat only) and shoulder volume. Returns the
 * source geometry when nothing changes. Cached per source geometry and key.
 */
export function pieceVariant(mesh: SkinnedMesh, piece: string, source: BufferGeometry, paletteId: string, cut: number, puff: number): BufferGeometry {
  const coat = piece === 'a_mantel';
  if (!coat) cut = 0;
  if (piece !== 'a_mantel' && piece !== 'a_weste' && piece !== 'a_poncho') puff = 0;
  if (!paletteId && !cut && !puff) return source;
  let byKey = variants.get(source);
  if (!byKey) variants.set(source, (byKey = new Map()));
  const key = `${paletteId}|${cut}|${puff}`;
  let geo = byKey.get(key);
  if (geo) return geo;
  const info = pieceInfo(mesh, piece, source);
  geo = new BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes)) geo.setAttribute(name, attr);
  geo.setIndex(cut ? cutIndex(source, info, cut) : source.index);
  if (paletteId || cut) geo.setAttribute('color', tintColors(source, piece, info, paletteId, cut));
  if (puff) geo.setAttribute('position', puffed(source, info, puff));
  geo.boundingSphere = source.boundingSphere;
  geo.boundingBox = source.boundingBox;
  geo.name = `${source.name}:${key}`;
  byKey.set(key, geo);
  return geo;
}

export { ROLE_IDS };
