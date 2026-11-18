// M15 Mitte (2089) code-painted placeholder textures (no image files; Codex replaces them in step 9 of
// `docs/tasks/m15-mitte.md`). Sandstone ashlar (Reichstag, Brandenburger Tor), a glass curtain wall
// with mullions and lit floors (Potsdamer Platz towers, Bundestag buildings) and gold aluminium panels
// (Philharmonie, Staatsbibliothek). All are light bases: the vertex tint gives the final colour.
import type { Texture } from 'three';
import { Rng } from '../sim/math';
import { canvas, flatten, mottle, shade, strokes, toTexture, type PaintOptions } from './paint';

/** Sandstone ashlar: 1.0 × 0.5 m courses at the 0.5 uv box scale, soot in the joints, weathered. */
export function paintSandstone(o: PaintOptions): { map: Texture } {
  const S = 512, rng = new Rng(2089), base = '#e2d6bc';
  const [c, g] = canvas(S, S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  mottle(g, rng, S, S, 60, [shade(base, 0.06), shade(base, -0.08), '#cbbd9e'], [20, 90], 0.25);
  const ch = 64, cw = 128;
  for (let y = 0; y < S; y += ch) {
    const off = (y / ch) % 2 ? cw / 2 : 0;
    for (let x = -off; x < S; x += cw) {
      g.fillStyle = shade(base, rng.range(-0.06, 0.05), 0.5);
      g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    }
    g.fillStyle = 'rgba(70,60,45,0.45)';
    g.fillRect(0, y, S, 3);
    for (let x = -off; x < S; x += cw) g.fillRect(x, y, 3, ch);
  }
  // Soot runs from the cornices.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, S), grd = g.createLinearGradient(x, 0, x, S);
    grd.addColorStop(0, 'rgba(40,34,28,0.3)');
    grd.addColorStop(1, 'rgba(40,34,28,0)');
    g.fillStyle = grd;
    g.fillRect(x, rng.range(0, S / 3), rng.range(3, 10), rng.range(80, 300));
  }
  strokes(g, rng, S, S, { count: 1400, colors: [shade(base, 0.12), shade(base, -0.16)], len: [3, 14], width: [1, 3], alpha: [0.08, 0.2] });
  flatten(g, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/**
 * Glass curtain wall, one tile = 4 bays × 4 floors (6 × 7 m at a 0.5 uv box scale would be too coarse,
 * so builders set uv scale 1/6 per tile). Dark blue-grey glass with sky reflection bands, thin light
 * mullions, a few lit offices (emissive map), most dark (2089: the grid is down, generators run the lobbies).
 */
export function paintCurtain(seed = 7): { map: Texture; emissiveMap: Texture } {
  const S = 512, rng = new Rng(seed), bay = S / 4, fl = S / 4;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, S, S);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = rng.range(-0.08, 0.1), grd = g.createLinearGradient(0, y * fl, 0, (y + 1) * fl);
    grd.addColorStop(0, shade('#5d7487', 0.15 + t));
    grd.addColorStop(0.55, shade('#34475a', t));
    grd.addColorStop(1, shade('#26313d', t));
    g.fillStyle = grd;
    g.fillRect(x * bay, y * fl, bay, fl);
    const lit = rng.next();
    if (lit < 0.16) {
      const warm = rng.next() < 0.5;
      ge.fillStyle = warm ? 'rgba(255,190,120,0.85)' : 'rgba(150,230,255,0.8)';
      ge.fillRect(x * bay + 6, y * fl + fl * 0.3, bay - 12, fl * 0.62);
      g.fillStyle = warm ? 'rgba(255,200,140,0.6)' : 'rgba(170,230,255,0.55)';
      g.fillRect(x * bay + 6, y * fl + fl * 0.3, bay - 12, fl * 0.62);
    } else if (lit < 0.3) {
      // Broken pane: dark hole with a crack star.
      g.fillStyle = 'rgba(12,14,18,0.85)';
      g.fillRect(x * bay + 10, y * fl + 14, bay * rng.range(0.3, 0.7), fl * rng.range(0.3, 0.7));
    }
  }
  // Spandrel bands (floor slabs) and mullions.
  g.fillStyle = '#9aa3a8';
  for (let y = 0; y < 4; y++) g.fillRect(0, y * fl, S, 10);
  g.fillStyle = '#b9c0c3';
  for (let x = 0; x < 4; x++) g.fillRect(x * bay, 0, 5, S);
  return { map: toTexture(c, true, 4), emissiveMap: toTexture(e, true, 4) };
}

/** Gold anodised aluminium panels (Philharmonie, Staatsbibliothek), 2 × 1 m with dark joints. */
export function paintGoldPanels(o: PaintOptions): { map: Texture } {
  const S = 256, rng = new Rng(1963), base = '#e3c070';
  const [c, g] = canvas(S, S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 64) {
    g.fillStyle = shade(base, rng.range(-0.12, 0.08));
    g.fillRect(x + 1, y + 1, 62, 30);
    // Embossed star-like facet (the Philharmonie's polyester panels): a soft diagonal highlight.
    g.fillStyle = 'rgba(255,240,200,0.18)';
    g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + 40, y + 4); g.lineTo(x + 4, y + 24); g.fill();
  }
  g.fillStyle = 'rgba(60,45,20,0.6)';
  for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 2);
  for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 2, S);
  flatten(g, S, S, o.flatten * 0.5);
  return { map: toTexture(c, true, o.anisotropy) };
}
