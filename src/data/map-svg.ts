// Draws a map as SVG from the same data the game uses: the in-game map (Karte) and the design
// review image (`MAP_SVG=docs/maps/koepenick.svg npx vitest run src/data/map-svg.test.ts`).
import type { EncounterDef } from '../sim/level';
import { lotOutline, type GroundKind, type Lot, type MapDef, type Pt } from './map';

const GROUND: Record<GroundKind, string> = {
  cobbles: '#4a4238',
  asphalt: '#3d3b38',
  grass: '#34452f',
  forest: '#26382a',
  jungle: '#2f4a26',
};

const poly = (p: readonly Pt[]): string => p.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(' ');
const path = (p: readonly Pt[]): string => 'M' + p.map(([x, z]) => `${x.toFixed(1)} ${z.toFixed(1)}`).join('L');

export interface MapSvgOptions {
  /** Draw every generated tree (design review) or skip them (in-game map). */
  trees: boolean;
  /** Encounters already won (dimmed) and the current one (highlighted). */
  done?: number;
  labels?: boolean;
  /** Route line, fight circles with wave counts and their names (design review only; default on). */
  encounters?: boolean;
}

export function mapSvg(m: MapDef, lots: Lot[], o: MapSvgOptions): string {
  const B = m.bounds;
  const w = B.maxX - B.minX;
  const h = B.maxZ - B.minZ;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${B.minX} ${B.minZ} ${w} ${h}" font-family="system-ui,sans-serif">`);
  out.push(`<rect x="${B.minX}" y="${B.minZ}" width="${w}" height="${h}" fill="${GROUND[m.defaultGround]}"/>`);
  for (const a of m.areas) out.push(`<polygon points="${poly(a.poly)}" fill="${GROUND[a.ground]}"/>`);
  for (const l of m.lakes) out.push(`<polygon points="${poly(l)}" fill="#1d4a55"/>`);
  for (const r of m.rivers) out.push(`<path d="${path(r.pts)}" fill="none" stroke="#1d4a55" stroke-width="${r.width}" stroke-linejoin="round" stroke-linecap="round"/>`);
  for (const i of m.islands) out.push(`<polygon points="${poly(i)}" fill="${GROUND.grass}"/>`);
  for (const h of m.hills) {
    out.push(`<circle cx="${h.x}" cy="${h.z}" r="${h.r + h.slope}" fill="#c8b48a" fill-opacity="0.06" stroke="#c8b48a" stroke-opacity="0.35" stroke-dasharray="3 3"/>`);
    out.push(`<circle cx="${h.x}" cy="${h.z}" r="${h.r}" fill="#c8b48a" fill-opacity="0.1"/>`);
  }
  for (const t of m.terraces) {
    out.push(`<polygon points="${poly(t.poly)}" fill="#c8b48a" fill-opacity="0.18" stroke="#d8cdb4" stroke-width="1.2"/>`);
    for (const st of t.stairs) {
      const deg = (-st.rot * 180) / Math.PI;
      out.push(`<rect x="${-st.width / 2}" y="${-st.len / 2}" width="${st.width}" height="${st.len}" fill="#d8cdb4" transform="translate(${st.x} ${st.z}) rotate(${deg})"/>`);
    }
  }
  if (m.rail) out.push(`<rect x="${m.rail.minX}" y="${m.rail.z - 4}" width="${m.rail.maxX - m.rail.minX}" height="8" fill="#2a2724"/><line x1="${m.rail.minX}" y1="${m.rail.z}" x2="${m.rail.maxX}" y2="${m.rail.z}" stroke="#77706a" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  // M19 tunnel: rock everywhere, the tubes as walkable bands (stations lighter).
  if (m.tunnel) {
    out.push(`<rect x="${B.minX}" y="${B.minZ}" width="${B.maxX - B.minX}" height="${B.maxZ - B.minZ}" fill="#141414"/>`);
    for (const t of m.tunnel.tubes) out.push(`<path d="${path(t.pts)}" fill="none" stroke="${t.kind === 'station' ? '#8a8378' : t.kind === 'branch' || t.kind === 'bypass' ? '#5d564c' : '#4a4640'}" stroke-width="${t.width}" stroke-linejoin="round" stroke-linecap="${t.kind === 'track' ? 'butt' : 'round'}"/>`);
    // M20: the collapse (rubble) and the flooded stretch.
    const { rubble: r, flood: f } = m.tunnel;
    if (r) out.push(`<path d="${path(r.pts)}" fill="none" stroke="#6b5a48" stroke-width="${r.width - 1}" stroke-linecap="round"/>`);
    if (f) out.push(`<path d="${path(f.pts)}" fill="none" stroke="#2f6a86" stroke-width="${f.width}" stroke-linecap="butt" opacity="0.85"/>`);
  }
  for (const s of m.streets) {
    const col = s.kind === 'path' ? '#6a5d45' : '#6f6656';
    out.push(`<path d="${path(s.pts)}" fill="none" stroke="${col}" stroke-width="${s.width}" stroke-linejoin="round" stroke-linecap="round" opacity="${s.kind === 'path' ? 0.7 : 0.9}"/>`);
  }
  for (const b of m.bridges) {
    const deg = (-b.rot * 180) / Math.PI;
    out.push(`<rect x="${-b.width / 2}" y="${-b.len / 2}" width="${b.width}" height="${b.len}" fill="#a99876" stroke="#14282b" stroke-width="0.6" transform="translate(${b.x} ${b.z}) rotate(${deg})"/>`);
  }
  // M11c lot types under their own buildings and trees (later in the list); the pond shows through.
  const SPECIAL_COLOR: Record<string, string> = { hinterhof: '#6f6656', parkplatz: '#4a4d52', kleingarten: '#4d6a3a', teich: '#3d5a2c80', truemmer: '#5a5048', baustelle: '#6a5a44', markt: '#7a6e5c', kirchhof: '#3a4a30' };
  for (const l of lots) {
    if (l.kind === 'tree') {
      if (o.trees) out.push(`<circle cx="${l.x.toFixed(1)}" cy="${l.z.toFixed(1)}" r="${(l.w * 0.45).toFixed(1)}" fill="${l.jungle ? '#4f7a35' : '#1f3324'}" opacity="0.9"/>`);
      continue;
    }
    const col = l.special ? SPECIAL_COLOR[l.special] : l.kind === 'altbau' ? '#9c7a5c' : l.kind === 'platte' ? '#8a8a80' : l.kind === 'shop' ? '#b08a4a' : '#8c6a50';
    const deg = (-l.rot * 180) / Math.PI;
    if (l.wing) out.push(`<rect x="${(-l.wing.w / 2).toFixed(1)}" y="${(-l.wing.d / 2).toFixed(1)}" width="${l.wing.w.toFixed(1)}" height="${l.wing.d.toFixed(1)}" fill="${col}" stroke="#14282b" stroke-width="0.5" transform="translate(${l.wing.x.toFixed(1)} ${l.wing.z.toFixed(1)}) rotate(${deg.toFixed(1)})"/>`);
    // M11d shaped footprints (chamfers, risalits, courtyards) as their outline.
    if (l.shape) out.push(`<polygon points="${lotOutline(l).map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(' ')}" fill="${col}" stroke="#14282b" stroke-width="0.5"/>`);
    else out.push(`<rect x="${(-l.w / 2).toFixed(1)}" y="${(-l.d / 2).toFixed(1)}" width="${l.w.toFixed(1)}" height="${l.d.toFixed(1)}" fill="${col}" stroke="#14282b" stroke-width="0.5" transform="translate(${l.x.toFixed(1)} ${l.z.toFixed(1)}) rotate(${deg.toFixed(1)})"/>`);
  }
  for (const l of m.landmarks) {
    const deg = (-l.rot * 180) / Math.PI;
    if (l.kind === 'dino') {
      out.push(`<path d="M-6 1Q-3-3 1-2L4-6L6-4L3-1Q4 2 2 2L2 5M-2 2L-2 5M-6 1L-9 0" fill="none" stroke="#9fd07a" stroke-width="1" transform="translate(${l.x} ${l.z})"/>`);
      continue;
    }
    if (l.kind === 'spati') {
      // Rest stop: yellow frame as in 2D.
      out.push(`<rect x="-5.5" y="-4" width="11" height="8" fill="#3a2e26" stroke="#f2d14b" stroke-width="1.4" transform="translate(${l.x} ${l.z}) rotate(${deg})"/>`);
      continue;
    }
    if (l.kind === 'riesenrad') {
      out.push(`<circle cx="${l.x}" cy="${l.z}" r="9" fill="none" stroke="#f0b27a" stroke-width="1.2"/>`);
      continue;
    }
    out.push(`<rect x="${-l.hx}" y="${-l.hz}" width="${l.hx * 2}" height="${l.hz * 2}" fill="#f0b27a" stroke="#14282b" stroke-width="0.6" transform="translate(${l.x} ${l.z}) rotate(${deg})"/>`);
  }
  // Route and fight circles are a design aid only (review image). In game the compass arrow is the guide.
  if (o.encounters !== false) {
    const route = [m.start, ...m.encounters].map((e) => [e.x, e.z] as Pt);
    out.push(`<path d="${path(route)}" fill="none" stroke="#f0e2c8" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.6"/>`);
    m.encounters.forEach((e: EncounterDef, i: number) => {
      const isBoss = e.waves.some((wv) => wv.bosses.length > 0);
      const done = o.done !== undefined && i < o.done;
      const cur = o.done === i;
      const fill = isBoss ? '#c2453a' : '#14282b';
      out.push(`<circle cx="${e.x}" cy="${e.z}" r="${e.r}" fill="${fill}" fill-opacity="${done ? 0.15 : 0.35}" stroke="${cur ? '#43d1cf' : '#f0e2c8'}" stroke-width="${cur ? 2.4 : 1}" stroke-dasharray="${done ? '2 2' : ''}"/>`);
      const label = isBoss ? 'B' : String(e.waves.length);
      out.push(`<text x="${e.x}" y="${e.z + 3}" font-size="9" font-weight="700" text-anchor="middle" fill="#f0e2c8">${label}</text>`);
      if (o.labels !== false) out.push(`<text x="${e.x}" y="${e.z - e.r - 3}" font-size="7" text-anchor="middle" fill="#f0e2c8" paint-order="stroke" stroke="#14282b" stroke-width="2">${e.name}</text>`);
    });
  }
  out.push(`<rect x="${m.start.x - 4}" y="${m.start.z - 4}" width="8" height="8" fill="#43d1cf"/>`);
  if (o.labels !== false) {
    // Few labels, never overlapping: big districts first, each name once, rivers where there is room.
    const boxes: Array<[number, number, number, number]> = [];
    const place = (x: number, z: number, text: string, size: number, anchor: 'middle' | 'start'): boolean => {
      const wd = text.length * size * 0.58;
      const x0 = anchor === 'middle' ? x - wd / 2 : x;
      const box: [number, number, number, number] = [x0 - 3, z - size - 1, x0 + wd + 3, z + 3];
      if (box[0] < B.minX || box[2] > B.maxX || box[1] < B.minZ || box[3] > B.maxZ) return false;
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return false;
      boxes.push(box);
      return true;
    };
    const area = (p: readonly Pt[]): number => Math.abs(p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]!; return s + q[0] * n[1] - n[0] * q[1]; }, 0)) / 2;
    for (const a of [...m.areas].sort((p, q) => area(q.poly) - area(p.poly))) {
      const cx = a.poly.reduce((s, p) => s + p[0], 0) / a.poly.length;
      const cz = a.poly.reduce((s, p) => s + p[1], 0) / a.poly.length;
      if (place(cx, cz, a.name, 9, 'middle')) out.push(`<text x="${cx.toFixed(0)}" y="${cz.toFixed(0)}" font-size="9" font-weight="700" text-anchor="middle" fill="#f0e2c8" opacity="0.5">${a.name}</text>`);
    }
    const seen = new Set<string>();
    for (const r of m.rivers) {
      if (seen.has(r.name)) continue;
      const [x, z] = r.pts[Math.floor(r.pts.length / 2)] as Pt;
      if (place(x, z, r.name, 8, 'start')) { seen.add(r.name); out.push(`<text x="${x}" y="${z}" font-size="8" font-style="italic" fill="#7fb3bd">${r.name}</text>`); }
    }
    out.push(`<path d="M${B.minX + 10} ${B.maxZ - 10}h50" stroke="#f0e2c8" stroke-width="1.5"/><text x="${B.minX + 10}" y="${B.maxZ - 14}" font-size="7" fill="#f0e2c8">50 m</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
