// M15 Mitte step 7, the zones beside the Potsdamer Platz (`docs/mockups/m15-mitte-lots.svg`, variant A and
// facade F-A, Johannes 2026-11-18): intact Regierungsviertel lots build as worn sandstone ministries; the club
// yard, the checkpoint zone and the car graveyard get their neon and sensor dressing.
//
// Worn on purpose (Johannes 2026-11-18, guideline row: landmarks and sights are ruins too): soot streaks over
// windows, boarded and dark windows, one in a few lit cyan by a generator, a broken top corner with rubble on
// the roof, tags on the ground floor.
//
// Cost: the ministry uses sandstone, windows, stucco, wood, tar and graffiti, all already in Mitte chunks (no
// new material); one door lamp per ministry at most. Dressing: neon atlas quads (one material), one pooled
// light per club door, holo band and charging post; the light pool size never changes.
import { Matrix4, SphereGeometry, Vector3 } from 'three';
import { areaAt, type Landmark, type Lot, type MapDef } from '../data/map';
import type { Prop } from '../data/courtyard';
import { Rng } from '../sim/math';
import { blockFacades, lm, lp, type ChunkBuilder, type MapMats } from './map-world';
import { FLOOR_H, GROUND_H, PARAPET, Run, windowAt } from './world';
import { graffitiCell, isTrabi, TRABI_ROOF } from './props-urban';
import { neonCell, NEON_WORDS } from './mitte-paint';
import type { MitteMats, RGB } from './mitte-world';

const frameOf = (x: number, z: number, rot: number): Landmark => ({ kind: 'glasbau', x, z, rot, hx: 0, hz: 0, clear: 0 });
const scale = (t: RGB, k: number): RGB => [t[0] * k, t[1] * k, t[2] * k];
const CYAN: RGB = [0.45, 1.7, 1.65];

/**
 * A ministry of the Wilhelmstraße kind on lot `l` (same footprint and height as the Altbau, so cuts and
 * occluders agree): rusticated sandstone ground floor, punched windows in even bays, a cornice under the
 * parapet. Worn: soot, boarded windows, a broken corner on some.
 */
export function buildMinistryLot(b: ChunkBuilder, l: Lot): void {
  const N = b.mm.mitte;
  if (!N) return;
  const M = b.mm, rng = new Rng(l.seed + 4711), f = frameOf(l.x, l.z, l.rot);
  const H = l.floors > 0 ? GROUND_H + l.floors * FLOOR_H + PARAPET : GROUND_H + 0.4;
  const grime = rng.range(0.72, 0.9), stone: RGB = [0.86 * grime, 0.8 * grime, 0.68 * grime], base = scale(stone, 0.8), soot: RGB = [0.22, 0.2, 0.19];
  // A broken corner: the top floor is missing over a few metres at one end, rubble lies on the roof below.
  const broken = l.floors >= 2 && rng.next() < 0.45, bw = Math.min(l.w * 0.4, rng.range(3, 5)), bs = rng.pick([-1, 1]), H2 = H - FLOOR_H;
  // The body above the ground floor; the ground floor is its own darker block so its windows sit in front.
  const G = GROUND_H, up = (y0: number, y1: number, x: number, w: number): void => { if (y1 > y0 + 0.01) b.box(N.sandstone, lm(f, x, (y0 + y1) / 2, 0), w, y1 - y0, l.d, stone); };
  if (!broken) up(G, H, 0, l.w);
  else {
    up(G, H2, 0, l.w);
    up(H2, H, -bs * (bw / 2), l.w - bw);
    // A ragged edge of blocks at the break and rubble on the roof of the lower part.
    for (let i = 0; i < 7; i++) b.box(N.sandstone, lm(f, bs * (l.w / 2 - bw) + rng.range(-0.3, 0.6) * bs, H2 + rng.range(0.2, FLOOR_H - 0.4), rng.range(-l.d / 2 + 0.4, l.d / 2 - 0.4), rng.range(-0.3, 0.3)), rng.range(0.4, 0.9), rng.range(0.3, 0.7), rng.range(0.4, 0.8), scale(stone, rng.range(0.7, 1)));
    for (let i = 0; i < 9; i++) b.box(N.sandstone, lm(f, bs * (l.w / 2 - rng.range(0.4, bw - 0.4)), H2 + 0.15, rng.range(-l.d / 2 + 0.6, l.d / 2 - 0.6), rng.range(0, 3)), rng.range(0.3, 0.8), rng.range(0.2, 0.4), rng.range(0.3, 0.7), scale(stone, rng.range(0.6, 0.95)));
    b.box(M.tar, lm(f, bs * (l.w / 2 - bw / 2), H2 + 0.03, 0), bw - 0.1, 0.06, l.d - 0.1, [0.5, 0.5, 0.5]);
  }
  b.shadowBox(lm(f, 0, H / 2, 0), l.w, H, l.d);
  // Rusticated ground floor, the band over it, the cornice under the parapet.
  b.box(N.sandstone, lm(f, 0, G / 2, 0), l.w, G, l.d, base);
  b.box(N.sandstone, lm(f, 0, GROUND_H + 0.12, 0), l.w + 0.3, 0.24, l.d + 0.3, scale(stone, 1.08));
  if (l.floors > 0) {
    const cw = broken ? l.w - bw : l.w, cx = broken ? -bs * (bw / 2) : 0;
    b.box(N.sandstone, lm(f, cx, H - PARAPET - 0.2, 0), cw + 0.4, 0.4, l.d + 0.4, scale(stone, 1.05));
  }
  b.box(M.tar, lm(f, broken ? -bs * (bw / 2) : 0, H + 0.03, 0), (broken ? l.w - bw : l.w) - 0.2, 0.06, l.d - 0.2, [0.5, 0.5, 0.5]);

  const sides = blockFacades(l);
  sides.forEach((s, i) => {
    // Blockrand neighbours touch the side walls: no windows there.
    if (l.block && (s.face === 1 || s.face === 3)) return;
    if (s.len < 2.4) return;
    const run = new Run({ id: `min${l.seed}-${i}`, style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1], depth: 1, floors: l.floors, tone: 'cream', features: [], seed: (l.seed + i) % 997 });
    const n = Math.max(1, Math.floor((s.len - 1) / 2.6)), step = s.len / n;
    // The street door: one bay of the front gets a stone portal instead of its ground floor window.
    const door = s.face === 0 ? rng.int(n) : -1;
    const brokenAt = (at: number): boolean => {
      if (!broken) return false;
      // The broken end of the lot in run coordinates: compare the world point with the lot frame.
      const p = run.pt(at, 0, 0), dx = p.x - l.x, dz = p.z - l.z, a = dx * Math.cos(l.rot) - dz * Math.sin(l.rot);
      return bs * a > l.w / 2 - bw;
    };
    for (let k = 0; k < n; k++) {
      const at = (k + 0.5) * step;
      if (k === door) {
        b.box(M.door, run.mat(at, 1.35, 0.06), 1.6, 2.7, 0.08, [0.45, 0.4, 0.36]);
        b.box(N.sandstone, run.mat(at, 2.95, 0.14), 2.4, 0.5, 0.26, scale(stone, 1.1));
        for (const o of [-1, 1]) b.box(N.sandstone, run.mat(at + o * 1.0, 1.35, 0.12), 0.35, 2.7, 0.22, scale(stone, 1.05));
      } else windowAt(b, run, rng, at, 1.2, 1.1, 1.8, 0, false);
      for (let fl = 0; fl < l.floors; fl++) {
        const y = GROUND_H + fl * FLOOR_H + 0.75;
        if (fl === l.floors - 1 && brokenAt(at)) continue;
        const roll = rng.next();
        if (roll < 0.12) {
          // Boarded up: planks over the opening.
          b.box(M.darkWood, run.mat(at, y + 0.85, 0.08), 1.2, 1.8, 0.06, [0.5, 0.42, 0.34]);
          b.box(M.darkWood, run.mat(at, y + 0.85, 0.12, 0, 0.5), 1.5, 0.18, 0.04, [0.45, 0.38, 0.3]);
        } else if (roll < 0.17) {
          // A generator room: cyan light behind the glass.
          b.solid.of(N.neon).quad([run.pt(at - 0.5, y, 0.05), run.pt(at + 0.5, y, 0.05), run.pt(at + 0.5, y + 1.7, 0.05), run.pt(at - 0.5, y + 1.7, 0.05)], neonCell(-1), [scale(CYAN, 0.6)]);
        } else windowAt(b, run, rng, at, y, 1.0, 1.7, 0.03, fl === 0);
        // Soot from a fire inside: a dark streak over the window up to the next floor.
        const sh = Math.min(1.8, H - 0.15 - (y + 1.7));
        if (sh > 0.3 && rng.next() < 0.22) b.box(N.sandstone, run.mat(at, y + 1.7 + sh / 2, 0.025), rng.range(0.7, 1.1), sh, 0.03, soot);
      }
    }
    // Tags on the ground floor, below 3 m.
    if (s.face === 0 && rng.next() < 0.7) {
      const gw = rng.range(1.6, 2.4), at = rng.range(gw / 2 + 0.3, s.len - gw / 2 - 0.3);
      b.cards.of(M.graffiti).add(graffitiCell(rng.int(4)), run.mat(at, 1.1, 0.09).multiply(new Matrix4().makeScale(gw, gw * 0.5, 1)), [0.85, 0.85, 0.85]);
    }
  });
}

/** The club door on the yard front of the back house: dark double door, a pink tube frame, the sign, one light. */
function clubDoor(b: ChunkBuilder, N: MitteMats, M: MapMats, f: Landmark, a: number, bb: number, glow: number, rng: Rng): void {
  const pink: RGB = [1.8 * glow, 0.5 * glow, 1.15 * glow], P = (x: number, y: number): Vector3 => lp(f, a + x, y, bb + 0.14);
  b.box(M.iron, lm(f, a, 1.3, bb + 0.05), 2.0, 2.6, 0.1, [0.08, 0.08, 0.09]);
  const tube = (x0: number, y0: number, x1: number, y1: number): void => b.solid.of(N.neon).quad([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], neonCell(-1), [pink]);
  tube(-1.12, 0, -1.04, 2.75); tube(1.04, 0, 1.12, 2.75); tube(-1.12, 2.68, 1.12, 2.75);
  const w = NEON_WORDS.indexOf('CLUB');
  b.box(M.iron, lm(f, a, 3.35, bb + 0.06), 2.6, 0.9, 0.12, [0.1, 0.1, 0.12]);
  b.solid.of(N.neon).quad([lp(f, a - 1.2, 2.98, bb + 0.13), lp(f, a + 1.2, 2.98, bb + 0.13), lp(f, a + 1.2, 3.7, bb + 0.13), lp(f, a - 1.2, 3.7, bb + 0.13)], neonCell(w), [[1.9 * glow, 0.45 * glow, 1.1 * glow]]);
  b.light(lp(f, a, 2.6, bb + 1.4), 0xff4fa3, 10, 8, rng.next() < 0.3 ? 0.5 : 0.05, 3);
}

/**
 * Step 7 dressing of the other zones' lot types: Clubhof (club door), Sperrzone (holo band over the barrier
 * line), Parkplatz in the Regierungsviertel as the graveyard of self-driving cars (sensor domes, a charging
 * post). Called from `buildMitteWorld` (only with the wet neon sky, i.e. on Mitte).
 */
export function dressZones(m: MapDef, lots: readonly Lot[], props: readonly Prop[], N: MitteMats, M: MapMats, glow: number, chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  for (const l of lots) {
    if (l.kind !== 'special') continue;
    const sp = l.special, inLot = (p: Prop): boolean => {
      const dx = p.x - l.x, dz = p.z - l.z, c = Math.cos(l.rot), s = Math.sin(l.rot);
      return Math.abs(dx * c - dz * s) < l.w / 2 && Math.abs(dx * s + dz * c) < l.d / 2;
    };
    const rng = new Rng(l.seed + 2090), f = frameOf(l.x, l.z, l.rot), b = chunkOf(l.x, l.z), y0 = ground(l.x, l.z);
    if (sp === 'clubhof') {
      // The back house front lies on cb = -D + 5 (see `lotContent`).
      b.on(y0, () => clubDoor(b, N, M, f, 0, -l.d / 2 + 5, glow, rng));
    } else if (sp === 'sperrzone') {
      for (const p of props) {
        if (p.kind !== 'barrier' || !inLot(p)) continue;
        const pb = chunkOf(p.x, p.z), half = p.size / 2, fr = frameOf(p.x, p.z, p.rot);
        pb.on(ground(p.x, p.z), () => {
          for (const n of [-0.32, 0.32]) {
            const q = (x: number, y: number): Vector3 => lp(fr, x, y, n);
            const quad: [Vector3, Vector3, Vector3, Vector3] = n > 0 ? [q(-half, 1.25), q(half, 1.25), q(half, 1.55), q(-half, 1.55)] : [q(half, 1.25), q(-half, 1.25), q(-half, 1.55), q(half, 1.55)];
            pb.solid.of(N.neon).quad(quad, neonCell(-1), [scale(CYAN, glow * 0.7)]);
          }
          for (const x of [-half, half]) pb.box(M.iron, lm(fr, x, 0.85, 0), 0.08, 1.7, 0.08, [0.3, 0.32, 0.34]);
          pb.light(lp(fr, 0, 1.4, 0.8), 0x43d1cf, 6, 7, 0.55, 2.4);
        });
      }
    } else if (sp === 'parkplatz' && areaAt(m, l.x, l.z)?.id === 'regierung') {
      let post = false;
      for (const p of props) {
        if (p.kind !== 'car' || !inLot(p)) continue;
        const pb = chunkOf(p.x, p.z), fr = frameOf(p.x, p.z, p.rot), on = rng.next() < 0.4, up = isTrabi(p) ? TRABI_ROOF - 1.48 : 0;
        pb.on(ground(p.x, p.z), () => {
          // The roof sensor of a self-driving car; a few still glow (higher on the Trabi's roof, P3).
          pb.box(M.iron, lm(fr, 0, 1.52 + up, -0.2), 0.5, 0.08, 0.5, [0.2, 0.2, 0.22]);
          pb.geo(M.lampGlass, cachedDome, lm(fr, 0, 1.56 + up, -0.2), on ? scale(CYAN, glow * 0.5) : [0.15, 0.17, 0.2]);
          if (!post && on) {
            post = true;
            // A charging post beside it, its strip still lit, a cable to the car.
            pb.box(M.iron, lm(fr, 1.35, 0.75, 1.2), 0.35, 1.5, 0.3, [0.85, 0.86, 0.88]);
            pb.solid.of(N.neon).quad([lp(fr, 1.18, 0.5, 1.36), lp(fr, 1.52, 0.5, 1.36), lp(fr, 1.52, 1.3, 1.36), lp(fr, 1.18, 1.3, 1.36)], neonCell(-1), [scale(CYAN, glow * 0.8)]);
            pb.box(M.rubber, lm(fr, 1.05, 0.05, 0.6, 0.4), 0.04, 0.04, 1.4, [0.08, 0.08, 0.08]);
            pb.light(lp(fr, 1.35, 1.1, 1.8), 0x43d1cf, 4, 5, 0.04, 1.6);
          }
        });
      }
    }
  }
}

const cachedDome = new SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
