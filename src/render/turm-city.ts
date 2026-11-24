// M17 Fernsehturm city image (T6, `docs/maps/fernsehturm.md` › Light and look, „Stadtteppich“): Berlin far below the
// sphere decks, every district at its real bearing from the tower (OpenStreetMap check of the map doc) in its own
// light. Painted in code on one canvas; distances are squeezed so the districts the camera can see (it looks north
// and down) lie within the far plane. Cloud cards drift between the deck and the city.
//
// Cost: the plane is 1 draw call (unlit, no fog, FX layer, no shadow, not in the pre-pass), one 1024² texture
// (about 5 MB with mips); the clouds are 1 instanced draw call with one 128² texture. Both follow the hero's deck and
// hide on the foyer and the shaft. Same on Ausgewogen and Leistung.
import { loadPaintedTexture } from './surface-textures';
import { CanvasTexture, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from 'three';
import { Rng } from '../sim/math';
import { FX_LAYER } from './layers';
import { canvas } from './paint';

/** Half size of the painted ground (m) and how far below the deck floor it lies. */
export const CITY = { half: 260, depth: 46, px: 1024 } as const;

/** One district on the image: centre bearing (degrees, 0 north, clockwise) and spread, the compressed distance band, its light. */
interface Patch { name: string; bearing: number; spread: number; r0: number; r1: number; base: string; lights: string[]; density: number }

/**
 * Bearings from the map doc's geography table. Order on each line of sight is real: south-east Xhain then Köpenick,
 * west Mitte then Charlottenburg, north-west Wedding, east the Alexanderplatz at the foot (the only daylight).
 */
const PATCHES: Patch[] = [
  { name: 'alex', bearing: 75, spread: 40, r0: 18, r1: 95, base: '#c89a48', lights: ['#ffe0a0', '#f4c060', '#3a6ad0'], density: 0.5 },
  { name: 'xhain', bearing: 128, spread: 26, r0: 40, r1: 150, base: '#6e3016', lights: ['#ff7a20', '#ffb040', '#ff5010'], density: 1.2 },
  { name: 'koepenick', bearing: 128, spread: 22, r0: 150, r1: 260, base: '#1e3e24', lights: ['#7ad06a', '#c8e070'], density: 0.35 },
  { name: 'mitte', bearing: 250, spread: 26, r0: 34, r1: 140, base: '#4a1e5c', lights: ['#ff40c0', '#30e0ff', '#ff70e0', '#50a0ff'], density: 1.4 },
  { name: 'charlottenburg', bearing: 258, spread: 20, r0: 140, r1: 260, base: '#4a5262', lights: ['#e8ecf4', '#c0c8d8', '#ffd890'], density: 0.9 },
  { name: 'wedding', bearing: 310, spread: 24, r0: 60, r1: 220, base: '#20502e', lights: ['#ffc040', '#40d090', '#ffd870', '#e04060'], density: 1.1 },
];

const hex = (c: string): [number, number, number] => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Angular distance in degrees. */
const adiff = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

/** The Spree in plane coordinates (m, +x east, +z south): from the south-east past the tower's south-west to the west. */
const SPREE: Array<[number, number]> = [[250, 175], [170, 120], [110, 92], [60, 60], [20, 38], [-24, 30], [-70, 52], [-120, 40], [-170, 66], [-260, 60]];

/** Paints the city image (once per page). */
export function paintCity(seed = 1969): Texture {
  const S = CITY.px, H = CITY.half, rng = new Rng(seed);
  const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S), d = img.data;
  const night = hex('#161e24');
  // Base: every pixel takes the district of its bearing and distance, blended at the sector edges; a block grid shades it.
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = ((px + 0.5) / S - 0.5) * 2 * H, z = ((py + 0.5) / S - 0.5) * 2 * H;
      const r = Math.hypot(x, z), bearing = (Math.atan2(x, -z) * 180) / Math.PI;
      let col: [number, number, number] = [...night];
      let w = 0;
      for (const p of PATCHES) {
        const k = Math.max(0, 1 - adiff(bearing, p.bearing) / p.spread) * Math.max(0, Math.min(1, (r - p.r0) / 12, (p.r1 - r) / 20));
        if (k <= w) continue;
        const b = hex(p.base);
        col = [night[0] + (b[0] - night[0]) * k, night[1] + (b[1] - night[1]) * k, night[2] + (b[2] - night[2]) * k];
        w = k;
      }
      // Blocks: streets every ~22 m, turned a little per sector.
      const a = Math.round(bearing / 45) * 0.18;
      const u = x * Math.cos(a) - z * Math.sin(a), v = x * Math.sin(a) + z * Math.cos(a);
      const street = Math.abs(((u % 22) + 22) % 22) < 2.2 || Math.abs(((v % 22) + 22) % 22) < 2.2;
      const n = 0.82 + 0.3 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.06);
      const f = (street ? 0.55 : 1) * n;
      const i = (py * S + px) * 4;
      d[i] = col[0] * f; d[i + 1] = col[1] * f; d[i + 2] = col[2] * f; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const P = (x: number, z: number): [number, number] => [((x / (2 * H)) + 0.5) * S, ((z / (2 * H)) + 0.5) * S];
  // The Spree through all of them: dark water with a sky sheen.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [[26, '#0a1a28'], [18, '#1c3a52'], [4, 'rgba(180,210,240,0.35)']] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = (width * S) / (2 * H);
    ctx.beginPath();
    SPREE.forEach(([x, z], k) => { const [qx, qy] = P(x, z); if (k === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy); });
    ctx.stroke();
  }
  // Lights: warm windows and lamps per district, denser near the middle of each patch.
  for (const p of PATCHES) {
    const n = Math.round(1500 * p.density);
    for (let k = 0; k < n; k++) {
      const b = ((p.bearing + rng.range(-p.spread, p.spread) * 0.85) * Math.PI) / 180, r = rng.range(p.r0 + 4, p.r1 - 4);
      const [qx, qy] = P(Math.sin(b) * r, -Math.cos(b) * r);
      ctx.fillStyle = rng.pick(p.lights);
      ctx.globalAlpha = rng.range(0.45, 1);
      const s = rng.range(0.8, 1.7);
      ctx.fillRect(qx, qy, s, s);
    }
  }
  ctx.globalAlpha = 1;
  // Xhain: the Wall line, fire-lit; Alexanderplatz: the golden afternoon glow; Mitte: the rain veil; Köpenick: fog banks.
  const glow = (x: number, z: number, r: number, color: string, alpha: number): void => {
    const [qx, qy] = P(x, z), rr = (r * S) / (2 * H);
    const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, rr);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(qx - rr, qy - rr, rr * 2, rr * 2);
    ctx.globalAlpha = 1;
  };
  const at = (bearing: number, r: number): [number, number] => { const b = (bearing * Math.PI) / 180; return [Math.sin(b) * r, -Math.cos(b) * r]; };
  glow(...at(75, 55), 60, '#ffd070', 0.55);
  glow(...at(128, 95), 55, '#ff6a18', 0.4);
  ctx.strokeStyle = '#ffd0a0';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  for (let k = 0; k <= 12; k++) { const [x, z] = at(108 + k * 3.2, 82 + Math.sin(k) * 6); const [qx, qy] = P(x, z); if (k === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy); }
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (let k = 0; k < 7; k++) glow(...at(128 + rng.range(-16, 16), rng.range(160, 240)), rng.range(18, 34), '#9ab8a0', 0.3);
  glow(...at(250, 80), 70, '#c040c0', 0.35);
  ctx.strokeStyle = 'rgba(160,210,255,0.12)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 500; k++) {
    const [x, z] = at(250 + rng.range(-24, 24), rng.range(36, 138));
    const [qx, qy] = P(x, z);
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx - 3, qy + 9); ctx.stroke();
  }
  // Charlottenburg: searchlight beams laid on the ground; Wedding: lantern glows.
  for (let k = 0; k < 4; k++) {
    const [x, z] = at(258 + rng.range(-12, 12), rng.range(170, 230));
    const [qx, qy] = P(x, z), a = rng.range(0, Math.PI * 2);
    const g = ctx.createLinearGradient(qx, qy, qx + Math.cos(a) * 90, qy + Math.sin(a) * 90);
    g.addColorStop(0, 'rgba(230,238,255,0.5)');
    g.addColorStop(1, 'rgba(230,238,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + Math.cos(a - 0.08) * 90, qy + Math.sin(a - 0.08) * 90); ctx.lineTo(qx + Math.cos(a + 0.08) * 90, qy + Math.sin(a + 0.08) * 90); ctx.fill();
  }
  for (let k = 0; k < 14; k++) glow(...at(310 + rng.range(-18, 18), rng.range(80, 210)), rng.range(8, 16), rng.pick(['#ffc040', '#40d090']), 0.45);
  // The rim fades into haze so the plane has no edge.
  const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
  v.addColorStop(0, 'rgba(10,16,20,0)');
  v.addColorStop(1, 'rgba(10,16,20,1)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A soft cloud blot (128²). */
function paintCloud(): Texture {
  const [c, ctx] = canvas(128, 128);
  const rng = new Rng(77);
  for (let k = 0; k < 14; k++) {
    const x = rng.range(30, 98), y = rng.range(44, 84), r = rng.range(16, 34);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface CityView {
  group: Group;
  /** Puts the city under the deck at (x, z), tinted by the deck's light; `show` false hides it (foyer, shaft). */
  place(x: number, z: number, show: boolean, tint: number, cloudTint: number): void;
  update(time: number): void;
}

const CLOUDS = 18;

export function buildCityView(): CityView {
  const group = new Group();
  group.name = 'turm-city';
  const mat = new MeshBasicMaterial({ map: paintCity(), fog: false, depthWrite: false });
  // T11 (local FLUX.2 klein from the painted layout, `docs/local-ai-assets.md`): the painted city replaces the
  // canvas once loaded; the canvas stays the fallback. Same plane and material, no cost change beyond the file.
  loadPaintedTexture(new URL('../../assets/textures/turm/city.webp', import.meta.url).href, 4, (t) => {
    mat.map?.dispose();
    mat.map = t;
    mat.needsUpdate = true;
  }, false);
  const plane = new Mesh(new PlaneGeometry(CITY.half * 2, CITY.half * 2).rotateX(-Math.PI / 2), mat);
  plane.position.y = -CITY.depth;
  plane.layers.set(FX_LAYER);
  plane.renderOrder = -1;
  const cloudMat = new MeshBasicMaterial({ map: paintCloud(), transparent: true, depthWrite: false, fog: false, side: DoubleSide, opacity: 0.55 });
  const clouds = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cloudMat, CLOUDS);
  clouds.layers.set(FX_LAYER);
  clouds.frustumCulled = false;
  const rng = new Rng(19);
  const seeds = Array.from({ length: CLOUDS }, () => ({ a: rng.range(0, Math.PI * 2), r: rng.range(26, 110), y: -rng.range(14, 34), s: rng.range(18, 40), v: rng.range(0.004, 0.012) }));
  group.add(plane, clouds);
  const m = new Matrix4();
  return {
    group,
    place(x, z, show, tint, cloudTint): void {
      group.visible = show;
      group.position.set(x, 0, z);
      mat.color.setHex(tint);
      cloudMat.color.setHex(cloudTint);
    },
    update(time): void {
      if (!group.visible) return;
      seeds.forEach((c, i) => {
        const a = c.a + time * c.v;
        m.makeScale(c.s, 1, c.s * 0.6).setPosition(Math.sin(a) * c.r, c.y, Math.cos(a) * c.r);
        clouds.setMatrixAt(i, m);
      });
      clouds.instanceMatrix.needsUpdate = true;
    },
  };
}
