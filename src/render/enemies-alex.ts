// M15 Alexanderplatz bodies and gear (step 7, `docs/tasks/m15-alexanderplatz.md`), Pioneer palette of
// `docs/style/alexanderplatz-pioneer.png`: brass, cobalt, signal yellow, red with the hammer and sickle.
// Code-built: the Kernspeier (clay pot, stem, toothed sunflower), the Volkseigene Koloss (a Plattenbau
// slab on clockwork legs, hammer arm and compass arm, the Weltzeituhr ring on its back), the
// Weltzeituhr's four legs (two-bone reach to the ground), and gear for the mechs (clock-face shield,
// dome, chimney, wind-up key, emblem plate), the Wurzler (roots, apron, sunflower head) and the
// Brigadeghul (blue Blaumann, cap, red armband on the walker). One material per colour, parts merged.
import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry,
  type BufferGeometry, type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hammerSickle } from './alex-paint';
import type { LitMaterial, Materials } from './materials';
import { canvas } from './paint';

export interface AlexKit {
  brass: LitMaterial; cobalt: LitMaterial; yellow: LitMaterial; red: LitMaterial; iron: LitMaterial; cream: LitMaterial;
  badge: LitMaterial; clay: LitMaterial; soil: LitMaterial; stem: LitMaterial; petal: LitMaterial; seeds: LitMaterial; teeth: LitMaterial;
  root: LitMaterial; apron: LitMaterial; blau: LitMaterial; slab: LitMaterial; lit: LitMaterial; lens: LitMaterial; cab: LitMaterial;
}
export type AlexMat = keyof AlexKit;
export type Part = [BufferGeometry, AlexMat];

/** Dial (left half) and emblem (right half) in one 512 × 256 texture. */
function paintBadge(): CanvasTexture {
  const [c, k] = canvas(512, 256);
  k.fillStyle = '#efe6cc';
  k.fillRect(0, 0, 256, 256);
  k.strokeStyle = '#1c1a18';
  k.fillStyle = '#1c1a18';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
    k.lineWidth = big ? 7 : 3;
    k.beginPath();
    k.moveTo(128 + Math.sin(a) * (big ? 92 : 104), 128 - Math.cos(a) * (big ? 92 : 104));
    k.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116);
    k.stroke();
  }
  // Hands at five to twelve (2D Stillstand), red seconds hand.
  k.lineCap = 'round';
  k.lineWidth = 11;
  k.beginPath(); k.moveTo(128, 128); k.lineTo(128 - 20, 128 - 70); k.stroke();
  k.lineWidth = 7;
  k.beginPath(); k.moveTo(128, 128); k.lineTo(128 - 44, 128 - 84); k.stroke();
  k.strokeStyle = '#b93432';
  k.lineWidth = 3;
  k.beginPath(); k.moveTo(128, 150); k.lineTo(128 + 60, 128 - 70); k.stroke();
  k.beginPath(); k.arc(128, 128, 9, 0, Math.PI * 2); k.fill();
  k.fillStyle = '#b93432';
  k.fillRect(256, 0, 256, 256);
  hammerSickle(k, 384, 128, 200, '#f3ce43');
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const kits = new WeakMap<Materials, AlexKit>();
export function alexKit(m: Materials): AlexKit {
  let k = kits.get(m);
  if (k) return k;
  const badge = paintBadge();
  k = {
    brass: m.surface({ color: 0xc9a23a, roughness: 0.35, metalness: 0.8 }),
    cobalt: m.surface({ color: 0x2a4a9e, roughness: 0.5, metalness: 0.35 }),
    yellow: m.surface({ color: 0xf2c21a, roughness: 0.6, metalness: 0.1 }),
    red: m.surface({ color: 0xb93432, roughness: 0.85, doubleSided: true }),
    iron: m.surface({ color: 0x3a3c42, roughness: 0.5, metalness: 0.6 }),
    cream: m.surface({ color: 0xeadfc6, roughness: 0.8 }),
    badge: m.surface({ map: badge, roughness: 0.6, doubleSided: true }),
    clay: m.surface({ color: 0xb4623a, roughness: 0.9 }),
    soil: m.surface({ color: 0x3a2a1c, roughness: 1 }),
    stem: m.surface({ color: 0x4f7a2e, roughness: 0.8, doubleSided: true }),
    petal: m.surface({ color: 0xf2b81a, roughness: 0.7, doubleSided: true }),
    seeds: m.surface({ color: 0x3a2410, roughness: 0.9 }),
    teeth: m.surface({ color: 0xeee6d2, roughness: 0.5 }),
    root: m.surface({ color: 0x5a4024, roughness: 0.95 }),
    apron: m.surface({ color: 0x5a6a3a, roughness: 0.95, doubleSided: true }),
    blau: m.surface({ color: 0x2c4a8c, roughness: 0.95, doubleSided: true }),
    slab: m.surface({ color: 0xb8b2a4, roughness: 0.9 }),
    // Glow without a light: the light count stays constant.
    lit: m.surface({ color: 0x3a2a08, emissive: 0xffd27a, emissiveIntensity: 1.6, roughness: 0.4 }),
    lens: m.surface({ color: 0x2a1404, emissive: 0xffa030, emissiveIntensity: 3, roughness: 0.3 }),
    cab: m.surface({ color: 0x1a2a10, emissive: 0x9aff6a, emissiveIntensity: 1.4, roughness: 0.3 }),
  };
  kits.set(m, k);
  return k;
}

export const tf = (g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry => {
  if (rx || ry || rz) g.rotateX(rx).rotateY(ry).rotateZ(rz);
  return g.translate(x, y, z);
};

/** A plane facing +z with the dial (`face` 0) or the emblem (1) of the badge texture. */
function badgePlane(w: number, h: number, face: 0 | 1): BufferGeometry {
  const p = new PlaneGeometry(w, h), uv = p.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, face * 0.5 + uv.getX(i) * 0.5);
  return p;
}
/** A disc facing +z with the dial. */
function dial(r: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, 0.04, 24).rotateX(Math.PI / 2);
  const uv = g.getAttribute('uv'), pos = g.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.25 + (pos.getX(i) / r) * 0.25, 0.5 + (pos.getY(i) / r) * 0.5);
  return g;
}

/** Merges parts per material into a few meshes. */
export function assemble(k: AlexKit, parts: Part[], castShadow: boolean): Group {
  const by = new Map<AlexMat, BufferGeometry[]>();
  for (const [g, m] of parts) {
    const list = by.get(m) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    by.set(m, list);
  }
  const group = new Group();
  for (const [m, list] of by) {
    const mesh = new Mesh(mergeGeometries(list), k[m]);
    mesh.castShadow = castShadow;
    group.add(mesh);
  }
  return group;
}

// ---------------------------------------------------------------- gear on rigs

/** A clock-face shield (radius r) with a brass rim and four bolts, facing +z. */
export function shieldParts(r: number): Part[] {
  return [
    [dial(r), 'badge'],
    [tf(new TorusGeometry(r, r * 0.08, 6, 24), 0, 0, 0.01), 'brass'],
    [tf(new CylinderGeometry(r * 1.02, r * 1.02, 0.06, 24).rotateX(Math.PI / 2), 0, 0, -0.04), 'cobalt'],
    ...[0, 1, 2, 3].map((i): Part => [tf(new SphereGeometry(r * 0.06, 6, 4), Math.sin(i * Math.PI / 2 + 0.78) * r * 0.86, Math.cos(i * Math.PI / 2 + 0.78) * r * 0.86, 0.03), 'brass']),
  ];
}

/** Dome cap with a chimney and a red emblem plate (Uhrwerkläufer). */
export function domeParts(r: number): Part[] {
  return [
    [tf(new SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0), 'brass'],
    [tf(new TorusGeometry(r, r * 0.08, 5, 16), 0, 0.01, 0, Math.PI / 2), 'cobalt'],
    [tf(new CylinderGeometry(r * 0.16, r * 0.2, r * 1.1, 8), r * 0.45, r * 0.9, -r * 0.3), 'iron'],
    [tf(new CylinderGeometry(r * 0.24, r * 0.18, r * 0.18, 8), r * 0.45, r * 1.5, -r * 0.3), 'iron'],
    [tf(new SphereGeometry(r * 0.12, 6, 4), 0, r * 1.02, 0), 'yellow'],
  ];
}

export function emblemParts(w: number): Part[] {
  return [[badgePlane(w, w, 1), 'badge'], [tf(new BoxGeometry(w * 1.12, w * 1.12, 0.02), 0, 0, -0.012), 'yellow']];
}

/** A wind-up key along -z (shaft) with two flat lobes; it turns about its shaft. */
export function keyParts(s: number): Part[] {
  return [
    [tf(new CylinderGeometry(s * 0.06, s * 0.06, s * 0.6, 8).rotateX(Math.PI / 2), 0, 0, -s * 0.3), 'brass'],
    [tf(new BoxGeometry(s * 0.9, s * 0.34, s * 0.06), 0, 0, -s * 0.62), 'brass'],
    [tf(new CylinderGeometry(s * 0.2, s * 0.2, s * 0.07, 12).rotateX(Math.PI / 2), -s * 0.45, 0, -s * 0.62), 'yellow'],
    [tf(new CylinderGeometry(s * 0.2, s * 0.2, s * 0.07, 12).rotateX(Math.PI / 2), s * 0.45, 0, -s * 0.62), 'yellow'],
  ];
}

/** A sunflower facing +z: seed disc, petals, optional teeth round the mouth. */
export function sunflowerParts(r: number, teeth: boolean): Part[] {
  const out: Part[] = [
    [tf(new CylinderGeometry(r * 0.55, r * 0.55, r * 0.18, 14).rotateX(Math.PI / 2), 0, 0, 0), 'seeds'],
  ];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    out.push([tf(new ConeGeometry(r * 0.17, r * 0.62, 4).scale(1, 1, 0.25), Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.78, -0.01, 0, 0, -a), 'petal']);
  }
  if (teeth) for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    out.push([tf(new ConeGeometry(r * 0.06, r * 0.2, 4), Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.3, r * 0.14, Math.PI / 2), 'teeth']);
  }
  return out;
}

/** Twisted root strands along -y (an arm), `n` strands of length `len`. */
export function rootParts(len: number, n: number, seed: number): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const a = seed + i * 2.1;
    out.push([tf(new CylinderGeometry(0.025, 0.012, len, 5), Math.sin(a) * 0.05, -len / 2, Math.cos(a) * 0.05, Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25), 'root']);
  }
  out.push([tf(new SphereGeometry(0.035, 5, 4), 0, -len, 0), 'stem']);
  return out;
}

/** Clothing per Alexanderplatz zombie kind, mounted on bones by the caller. */
export function zombieAlexGear(kind: 'wurzler' | 'wurzelmutter' | 'brigade', mount: (bone: string, parts: Part[], dy?: number, dz?: number) => void): void {
  if (kind === 'brigade') {
    // Brigadeghul: blue work cap, red armband, a Blaumann bib over the chest.
    mount('Head', [
      [tf(new CylinderGeometry(0.14, 0.14, 0.07, 12), 0, 0.05, 0), 'blau'],
      [tf(new BoxGeometry(0.22, 0.015, 0.1), 0, 0.02, 0.13, 0.15), 'blau'],
    ], 0.12);
    mount('spine_03', [[tf(new BoxGeometry(0.3, 0.32, 0.03), 0, -0.2, 0.17), 'blau'], [tf(new BoxGeometry(0.04, 0.3, 0.02), -0.11, 0.02, 0.17), 'blau'], [tf(new BoxGeometry(0.04, 0.3, 0.02), 0.11, 0.02, 0.17), 'blau']], 0.08);
    mount('upperarm_l', [[tf(new CylinderGeometry(0.07, 0.07, 0.08, 10, 1, true), 0, -0.12, 0), 'red']]);
    return;
  }
  const big = kind === 'wurzelmutter';
  // A sunflower in place of the face; the mother wears a crown of small ones.
  mount('Head', [
    ...sunflowerParts(0.2, false).map(([g, m]): Part => [tf(g, 0, 0.1, 0.22), m]),
    ...(big ? [0, 1, 2, 3, 4].flatMap((i): Part[] => sunflowerParts(0.07, false).map(([g, m]): Part => [tf(g, Math.sin(i * 1.26 - 2.5) * 0.15, 0.2 + Math.cos(i * 1.26 - 2.5) * 0.04, -0.02, -0.5, i * 1.26 - 2.5), m])) : []),
  ], 0.05);
  mount('pelvis', [[tf(new BoxGeometry(0.36, 0.5, 0.02), 0, -0.22, 0.17, 0.1), 'apron'], [tf(new TorusGeometry(0.2, 0.012, 4, 14), 0, 0.02, 0, Math.PI / 2), 'root']]);
  mount('spine_03', [[tf(new BoxGeometry(0.28, 0.2, 0.02), 0, -0.08, 0.18), 'apron'], ...rootParts(0.4, 3, 1).map(([g, m]): Part => [tf(g, 0.12, 0.1, -0.12, 0.3), m])], 0.08);
  for (const side of ['l', 'r']) mount(`lowerarm_${side}`, rootParts(big ? 0.55 : 0.42, 4, side === 'l' ? 0 : 1.3));
}

// ---------------------------------------------------------------- Kernspeier

export interface Kern { model: Group; pot: Group; stem: Group; head: Group; mouth: Object3D }

/** Clay pot (red band with the emblem), soil, stem with two leaves, a toothed sunflower head. Along +z, 1.2 m. */
export function buildKern(m: Materials, castShadow: boolean): Kern {
  const k = alexKit(m);
  const model = new Group();
  const pot = assemble(k, [
    [tf(new CylinderGeometry(0.26, 0.19, 0.42, 12), 0, 0.21, 0), 'clay'],
    [tf(new TorusGeometry(0.255, 0.035, 5, 14), 0, 0.42, 0, Math.PI / 2), 'clay'],
    [tf(new CylinderGeometry(0.235, 0.235, 0.02, 12), 0, 0.41, 0), 'soil'],
    [tf(new CylinderGeometry(0.244, 0.232, 0.08, 12, 1, true), 0, 0.24, 0), 'red'],
    [tf(badgePlane(0.13, 0.13, 1), 0, 0.24, 0.245), 'badge'],
  ], castShadow);
  model.add(pot);
  const stem = new Group();
  stem.position.y = 0.42;
  pot.add(stem);
  stem.add(assemble(k, [
    [tf(new CylinderGeometry(0.03, 0.04, 0.55, 6), 0, 0.27, 0), 'stem'],
    [tf(new SphereGeometry(0.12, 6, 4).scale(1, 0.15, 0.5), 0.1, 0.22, 0, 0, 0, 0.4), 'stem'],
    [tf(new SphereGeometry(0.1, 6, 4).scale(1, 0.15, 0.5), -0.09, 0.36, 0, 0, 0, -0.5), 'stem'],
  ], castShadow));
  const head = new Group();
  head.position.y = 0.55;
  stem.add(head);
  const flower = assemble(k, sunflowerParts(0.24, false), castShadow);
  flower.position.z = 0.04;
  head.add(flower);
  const mouth = assemble(k, [[tf(new CylinderGeometry(0.09, 0.09, 0.02, 10).rotateX(Math.PI / 2), 0, 0, 0.03), 'soil'], ...sunflowerParts(0.24, true).slice(15)], false);
  mouth.position.z = 0.04;
  head.add(mouth);
  return { model, pot, stem, head, mouth };
}

// ---------------------------------------------------------------- Volkseigener Koloss

export interface KolossLeg { hip: Group; knee: Group }
export interface Koloss { model: Group; slab: Group; legs: KolossLeg[]; hammer: Group; compass: Group; ring: Group }

/** Slab height and the hip height of its legs. */
export const KOLOSS = { hip: 1.9, slabW: 3.6, slabH: 3.2, slabD: 1.5, thigh: 1.05, shin: 1.05 } as const;

/** A Plattenbau slab (windows, a cab with the pilot ghoul, a red banner) on two clockwork legs. Along +z. */
export function buildKoloss(m: Materials, castShadow: boolean): Koloss {
  const k = alexKit(m), K = KOLOSS;
  const model = new Group();
  const slab = new Group();
  slab.position.y = K.hip;
  model.add(slab);
  const parts: Part[] = [
    [tf(new BoxGeometry(K.slabW, K.slabH, K.slabD), 0, K.slabH / 2 + 0.25, 0), 'slab'],
    [tf(new BoxGeometry(K.slabW + 0.1, 0.25, K.slabD + 0.1), 0, 0.12, 0), 'iron'],
    [tf(new BoxGeometry(1.1, 0.5, 0.9), 0.8, K.slabH + 0.5, -0.1), 'slab'],
  ];
  // Panel joints and windows, two per panel, front and back; some lit.
  for (const side of [1, -1]) for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const x = -1.35 + col * 0.9, y = 0.95 + row * 0.95;
    if (side > 0 && row === 0 && col > 0 && col < 3) continue;
    parts.push([tf(new BoxGeometry(0.42, 0.5, 0.03), x, y, side * (K.slabD / 2 + 0.01)), (row * 4 + col + (side > 0 ? 0 : 3)) % 5 === 1 ? 'lit' : 'iron']);
  }
  for (let col = 1; col < 4; col++) parts.push([tf(new BoxGeometry(0.03, K.slabH, K.slabD + 0.02), -1.8 + col * 0.9, K.slabH / 2 + 0.25, 0), 'iron']);
  // The cab: a wide lit window low on the front, the pilot ghoul behind it.
  parts.push([tf(new BoxGeometry(1.5, 0.6, 0.04), 0, 0.85, K.slabD / 2 + 0.02), 'cab']);
  parts.push([tf(new SphereGeometry(0.2, 8, 6), 0, 0.85, K.slabD / 2 - 0.15), 'apron']);
  // Banner with the emblem, the yellow stripe.
  parts.push([tf(new PlaneGeometry(0.7, 2.2), -1.35, 2.1, K.slabD / 2 + 0.04), 'red']);
  parts.push([tf(badgePlane(0.56, 0.56, 1), -1.35, 2.7, K.slabD / 2 + 0.05), 'badge']);
  parts.push([tf(new BoxGeometry(K.slabW + 0.02, 0.14, K.slabD + 0.02), 0, K.slabH + 0.2, 0), 'yellow']);
  slab.add(assemble(k, parts, castShadow));
  // The Weltzeituhr ring on its back (turns about the z axis).
  const ring = new Group();
  ring.position.set(0, 2.1, -K.slabD / 2 - 0.25);
  slab.add(ring);
  const rp: Part[] = [[tf(new TorusGeometry(1.25, 0.08, 6, 32), 0, 0, 0), 'brass']];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rp.push([tf(new BoxGeometry(0.32, 0.36, 0.06), Math.sin(a) * 1.25, Math.cos(a) * 1.25, 0, 0, 0, -a), i % 3 ? 'cream' : 'red']);
  }
  rp.push([tf(new CylinderGeometry(0.14, 0.14, 0.4, 8).rotateX(Math.PI / 2), 0, 0, 0.1), 'iron']);
  ring.add(assemble(k, rp, castShadow));
  // Hammer arm (right) and compass arm (left), shoulders at the slab's upper corners.
  const hammer = new Group();
  hammer.position.set(K.slabW / 2 + 0.3, 3.1, 0.2);
  slab.add(hammer);
  hammer.add(assemble(k, [
    [tf(new SphereGeometry(0.32, 8, 6), 0, 0, 0), 'brass'],
    [tf(new BoxGeometry(0.28, 1.7, 0.28), 0, -0.85, 0), 'iron'],
    [tf(new BoxGeometry(0.95, 0.55, 0.6), 0, -1.85, 0.1), 'iron'],
    [tf(new BoxGeometry(1.0, 0.12, 0.65), 0, -1.6, 0.1), 'yellow'],
  ], castShadow));
  const compass = new Group();
  compass.position.set(-K.slabW / 2 - 0.25, 3.1, 0.2);
  slab.add(compass);
  compass.add(assemble(k, [
    [tf(new SphereGeometry(0.24, 8, 6), 0, 0, 0), 'brass'],
    [tf(new CylinderGeometry(0.05, 0.04, 1.9, 6), -0.18, -0.95, 0, 0, 0, -0.18), 'iron'],
    [tf(new CylinderGeometry(0.05, 0.04, 1.9, 6), 0.18, -0.95, 0, 0, 0, 0.18), 'iron'],
    [tf(new ConeGeometry(0.06, 0.3, 6), -0.36, -1.95, 0, Math.PI, 0, 0), 'brass'],
    [tf(new ConeGeometry(0.06, 0.3, 6), 0.36, -1.95, 0, Math.PI, 0, 0), 'brass'],
  ], castShadow));
  const legs: KolossLeg[] = [];
  for (const s of [-1, 1]) {
    const hip = new Group();
    hip.position.set(s * 1.1, K.hip, 0);
    model.add(hip);
    hip.add(assemble(k, [
      [tf(new SphereGeometry(0.34, 8, 6), 0, 0, 0), 'brass'],
      [tf(new BoxGeometry(0.42, K.thigh, 0.42), 0, -K.thigh / 2, 0), 'cobalt'],
      [tf(new CylinderGeometry(0.3, 0.3, 0.12, 12).rotateZ(Math.PI / 2), s * 0.24, -K.thigh * 0.45, 0), 'brass'],
    ], castShadow));
    const knee = new Group();
    knee.position.y = -K.thigh;
    hip.add(knee);
    knee.add(assemble(k, [
      [tf(new SphereGeometry(0.26, 8, 6), 0, 0, 0), 'brass'],
      [tf(new BoxGeometry(0.34, K.shin, 0.34), 0, -K.shin / 2, 0), 'iron'],
      [tf(new BoxGeometry(0.75, 0.16, 1.0), 0, -K.shin, 0.15), 'iron'],
    ], castShadow));
    legs.push({ hip, knee });
  }
  return { model, slab, legs, hammer, compass, ring };
}

// ---------------------------------------------------------------- Weltzeituhr legs

export interface ClockLeg { hip: Group; upper: Group; lower: Group; angle: number }
/** Hip radius under the drum, segment lengths, foot radius from the centre, lift when it stands. */
export const CLOCK_LEG = { hip: 2.2, upper: 1.6, lower: 3.3, foot: 3.3, lift: 1.2 } as const;

/** Four clockwork legs for the Weltzeituhr's body, hips under the drum (at drum height `y`). */
export function buildClockLegs(m: Materials, y: number, castShadow: boolean): { group: Group; legs: ClockLeg[] } {
  const k = alexKit(m), L = CLOCK_LEG;
  const group = new Group();
  const legs: ClockLeg[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    const hip = new Group();
    hip.position.set(Math.sin(angle) * L.hip, y, Math.cos(angle) * L.hip);
    hip.rotation.y = angle;
    group.add(hip);
    const upper = new Group();
    hip.add(upper);
    upper.add(assemble(k, [
      [tf(new SphereGeometry(0.28, 8, 6), 0, 0, 0), 'brass'],
      [tf(new BoxGeometry(0.3, 0.3, L.upper), 0, 0, L.upper / 2), 'brass'],
      [tf(new CylinderGeometry(0.22, 0.22, 0.1, 12).rotateZ(Math.PI / 2), 0.2, 0, L.upper * 0.5), 'iron'],
    ], castShadow));
    const lower = new Group();
    hip.add(lower);
    lower.add(assemble(k, [
      [tf(new SphereGeometry(0.22, 8, 6), 0, 0, 0), 'iron'],
      [tf(new BoxGeometry(0.22, 0.22, L.lower), 0, 0, L.lower / 2), 'iron'],
      [tf(new ConeGeometry(0.22, 0.5, 6), 0, 0, L.lower + 0.05, Math.PI / 2), 'brass'],
    ], castShadow));
    legs.push({ hip, upper, lower, angle });
  }
  return { group, legs };
}

/**
 * Two-bone reach in a leg's plane (y up, z out): the hip at the origin, the foot target at (ty, tz).
 * Writes the upper and lower segments' pitch (rotation.x: below the horizontal) and the knee position.
 */
export function reachLeg(leg: ClockLeg, ty: number, tz: number): void {
  const a = CLOCK_LEG.upper, b = CLOCK_LEG.lower;
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, Math.hypot(ty, tz)));
  const phi = Math.atan2(-ty, tz);
  const alpha = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  // Knee up and out.
  const t1 = phi - alpha;
  leg.upper.rotation.x = t1;
  const ky = -a * Math.sin(t1), kz = a * Math.cos(t1);
  leg.lower.position.set(0, ky, kz);
  leg.lower.rotation.x = Math.atan2(-(ty - ky), tz - kz);
}
