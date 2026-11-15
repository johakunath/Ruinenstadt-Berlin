// Draws a map as SVG from the same data the game uses: the in-game map (Karte) and the design
// review image (`MAP_SVG=docs/maps/koepenick.svg npx vitest run src/data/map-svg.test.ts`).
import type { EncounterDef } from '../sim/level';
import type { GroundKind, Lot, MapDef, Pt } from './map';

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
  for (const s of m.streets) {
    const col = s.kind === 'path' ? '#6a5d45' : '#6f6656';
    out.push(`<path d="${path(s.pts)}" fill="none" stroke="${col}" stroke-width="${s.width}" stroke-linejoin="round" stroke-linecap="round" opacity="${s.kind === 'path' ? 0.7 : 0.9}"/>`);
  }
  for (const b of m.bridges) {
    const deg = (-b.rot * 180) / Math.PI;
    out.push(`<rect x="${-b.width / 2}" y="${-b.len / 2}" width="${b.width}" height="${b.len}" fill="#a99876" stroke="#14282b" stroke-width="0.6" transform="translate(${b.x} ${b.z}) rotate(${deg})"/>`);
  }
  for (const l of lots) {
    if (l.kind === 'tree') {
      if (o.trees) out.push(`<circle cx="${l.x.toFixed(1)}" cy="${l.z.toFixed(1)}" r="${(l.w * 0.45).toFixed(1)}" fill="${l.jungle ? '#4f7a35' : '#1f3324'}" opacity="0.9"/>`);
      continue;
    }
    const col = l.kind === 'altbau' ? '#9c7a5c' : l.kind === 'platte' ? '#8a8a80' : l.kind === 'shop' ? '#b08a4a' : '#8c6a50';
    const deg = (-l.rot * 180) / Math.PI;
    if (l.wing) out.push(`<rect x="${(-l.wing.w / 2).toFixed(1)}" y="${(-l.wing.d / 2).toFixed(1)}" width="${l.wing.w.toFixed(1)}" height="${l.wing.d.toFixed(1)}" fill="${col}" stroke="#14282b" stroke-width="0.5" transform="translate(${l.wing.x.toFixed(1)} ${l.wing.z.toFixed(1)}) rotate(${deg.toFixed(1)})"/>`);
    out.push(`<rect x="${(-l.w / 2).toFixed(1)}" y="${(-l.d / 2).toFixed(1)}" width="${l.w.toFixed(1)}" height="${l.d.toFixed(1)}" fill="${col}" stroke="#14282b" stroke-width="0.5" transform="translate(${l.x.toFixed(1)} ${l.z.toFixed(1)}) rotate(${deg.toFixed(1)})"/>`);
  }
  for (const l of m.landmarks) {
    const deg = (-l.rot * 180) / Math.PI;
    if (l.kind === 'dino') {
      out.push(`<path d="M-6 1Q-3-3 1-2L4-6L6-4L3-1Q4 2 2 2L2 5M-2 2L-2 5M-6 1L-9 0" fill="none" stroke="#9fd07a" stroke-width="1" transform="translate(${l.x} ${l.z})"/>`);
      continue;
    }
    if (l.kind === 'riesenrad') {
      out.push(`<circle cx="${l.x}" cy="${l.z}" r="9" fill="none" stroke="#f0b27a" stroke-width="1.2"/>`);
      continue;
    }
    out.push(`<rect x="${-l.hx}" y="${-l.hz}" width="${l.hx * 2}" height="${l.hz * 2}" fill="#f0b27a" stroke="#14282b" stroke-width="0.6" transform="translate(${l.x} ${l.z}) rotate(${deg})"/>`);
  }
  // Route and encounters.
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
  out.push(`<rect x="${m.start.x - 4}" y="${m.start.z - 4}" width="8" height="8" fill="#43d1cf"/>`);
  if (o.labels !== false) {
    for (const r of m.rivers) {
      const [x, z] = r.pts[Math.floor(r.pts.length / 2)] as Pt;
      out.push(`<text x="${x}" y="${z}" font-size="8" font-style="italic" fill="#7fb3bd">${r.name}</text>`);
    }
    for (const a of m.areas) {
      const cx = a.poly.reduce((s, p) => s + p[0], 0) / a.poly.length;
      const cz = a.poly.reduce((s, p) => s + p[1], 0) / a.poly.length;
      out.push(`<text x="${cx.toFixed(0)}" y="${cz.toFixed(0)}" font-size="10" font-weight="700" text-anchor="middle" fill="#f0e2c8" opacity="0.55">${a.name}</text>`);
    }
    out.push(`<path d="M${B.minX + 10} ${B.maxZ - 10}h50" stroke="#f0e2c8" stroke-width="1.5"/><text x="${B.minX + 10}" y="${B.maxZ - 14}" font-size="7" fill="#f0e2c8">50 m</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
