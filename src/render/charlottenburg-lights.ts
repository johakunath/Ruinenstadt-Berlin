// M16 Charlottenburg: light for the landmarks (Johannes 2026-11-19: every sight sits in the night as a lit
// place, its light explained by its own lamps, bulbs, windows and footlights; the show pieces glow).
// Three tools, cheapest first (`docs/tasks/m16-charlottenburg.md` › Handover, landmark lighting):
//   1. Pooled light sources (`ChunkBuilder.light`) where a real source is: marquees, doors, lanterns,
//      platform lamps, shop windows. Only the nearest 2 (Leistung) or 6 (Qualität) become point lights;
//      the ground glow decal and the halo carry the rest.
//   2. Washes: additive gradient cards in the chunk's glow batch of that colour, on or just in front of a
//      front, rising from footlights, falling from a bulb row, spilling out of doors onto steps and pavement,
//      a soft glow round a dome lantern or a clock. No light, no draw call beyond that glow material.
//   3. Small lantern bodies where a model has none (gate piers, the KaDeWe hall, the stair at the station,
//      the footlights of the Ehrenhof), in the shared iron and lamp glass batches.
// Colours: the palette plus the two the district may add (task E6): BULB (marquee bulbs, pearl white) and
// PINK (stage pink, berry on the board). The plan is pure data (`landmarkLightPlan`, tested); this file only
// draws, the landmark builders stay untouched. Cost: see the handover.
import { Matrix4, PlaneGeometry, Vector3, CylinderGeometry, SphereGeometry, type Material } from 'three';
import type { Landmark, MapDef } from '../data/map';
import { CUT } from '../data/cut';
import type { ChunkBuilder } from './map-world';
import type { LightShape } from './world';

/** Marquee bulbs: pearl white (board: silver, pearl). */
export const BULB = 0xfff2ea;
/** Stage pink: berry-violet stage and hall light (board: violet, berry). */
export const PINK = 0xff58c8;
const LAMP = 0xffb060, FIRE = 0xff8a3c, SHOP = 0xffc890, COLD = 0xd8ecff, TEAL = 0x5fd8c8;

/** A pooled light at local (x, y, z) of the landmark; `yaw` is local (0 = out of the front, +z). */
export interface PlanLight { t: 'light'; x: number; y: number; z: number; color: number; i: number; d: number; pool: number; shape?: LightShape; flicker?: number }
/**
 * A vertical wash card standing at local (x, y, z) (bottom centre), facing local `ry` (0 = +z), w × h.
 * `dir`: where the bright edge is (`up`: bright at the foot, rising; `down`: bright at the top, falling;
 * `round`: a soft blob). `k`: strength (cards stacked; 1 = one card at the glow material's opacity).
 */
export interface PlanWash { t: 'wash'; x: number; y: number; z: number; ry: number; w: number; h: number; color: number; dir: 'up' | 'down' | 'round'; k: number }
/** A flat spill on the ground (or a step at height y) from a front at local (x, z) facing `ry`, w wide, d deep, bright at the front. */
export interface PlanSpill { t: 'spill'; x: number; y: number; z: number; ry: number; w: number; d: number; color: number; k: number }
/** A soft glow without a light: three crossed cards of radius r round local (x, y, z); `flat`: only the one facing up (a canopy top). */
export interface PlanGlow { t: 'glow'; x: number; y: number; z: number; r: number; color: number; k: number; flat?: boolean }
/** A small lantern body (lamp glass under an iron cap), on a bracket (`post` 0) or a post of that height. */
export interface PlanLantern { t: 'lantern'; x: number; y: number; z: number; post: number; tint?: readonly [number, number, number] }
export type PlanItem = PlanLight | PlanWash | PlanSpill | PlanGlow | PlanLantern;

const L = (x: number, y: number, z: number, color: number, i: number, d: number, pool: number, shape?: LightShape, flicker = 0.04): PlanLight => ({ t: 'light', x, y, z, color, i, d, pool, shape, flicker });
const W = (x: number, y: number, z: number, ry: number, w: number, h: number, color: number, dir: PlanWash['dir'], k = 1): PlanWash => ({ t: 'wash', x, y, z, ry, w, h, color, dir, k });
const S = (x: number, z: number, ry: number, w: number, d: number, color: number, k = 1, y = 0): PlanSpill => ({ t: 'spill', x, y, z, ry, w, d, color, k });
const G = (x: number, y: number, z: number, r: number, color: number, k = 1, flat = false): PlanGlow => ({ t: 'glow', x, y, z, r, color, k, flat });
const N = (x: number, y: number, z: number, post = 0, tint?: readonly [number, number, number]): PlanLantern => ({ t: 'lantern', x, y, z, post, tint });
const PI = Math.PI, HALF = Math.PI / 2;

/** What each sight gets, in its local frame (x along the main front, z out of it, y up from its ground). */
function plan(l: Landmark): PlanItem[] {
  const hz = l.hz, hx = l.hx;
  switch (l.kind) {
    // ---- Zone 1, Zoo & Tauentzien.
    case 'zoobahnhof':
      // Built from street level (walkUnder); the deck is at 6.5 m. Platform lamps on the deck (`lantern` at x 1.1),
      // the two end clocks, the booking-hall entrance on the Hardenbergplatz face (−x, z 8).
      return [
        ...[-9, -1.5, 8].map((z) => L(1.1, 6.5 + 3.5, z, LAMP, 18, 10, 3.8, { halo: 0.45 })),
        ...[-12.45, 12.45].map((z) => G(0, 9.15, z, 0.9, LAMP, 2)),
        L(-5.8, 3.6, 8, LAMP, 16, 9, 3.4, { yaw: -HALF, reach: 1.2, halo: 0.35 }),
        W(-5.3, 0, 8, -HALF, 3.4, 4.4, LAMP, 'up', 1.2),
      ];
    case 'loewentor':
      return [...[-2.25, 2.25].map((x) => L(x, 2.9, 0, LAMP, 16, 9, 3.4, { halo: 0.42 })), ...[-3.6, 3.6].map((x) => W(x, 0, 1.75, 0, 2.6, 4.4, LAMP, 'round', 1))];
    case 'elefantentor':
      // Two lanterns under the beam; their light falls on the pillars and the kneeling elephants.
      return [
        ...[-1.5, 1.5].map((x) => L(x, 4.9, -0.35, LAMP, 20, 10, 3.8, { halo: 0.5 })),
        ...[-4, 4].map((x) => W(x, 0, 1.75, 0, 3.2, 6, LAMP, 'round', 1.0)),
        W(0, 3.2, 0.25, 0, 7, 3.2, LAMP, 'round', 1),
      ];
    case 'aquarium':
      // Teal water light from the entrance.
      return [L(0, 2.4, hz + 0.4, TEAL, 12, 8, 3.2, { reach: 0.8, halo: 0.3 }), W(0, 0, hz - 0.15, 0, 3.4, 4.8, TEAL, 'up', 1.2)];
    case 'musikpavillon':
      return [L(0, 2.9, 0, SHOP, 14, 9, 4.6, { halo: 0.55 })];
    case 'antilopenhaus':
      return [L(0, 3.0, hz + 0.6, LAMP, 12, 8, 3, { reach: 0.8, halo: 0.3 }), W(0, 0, hz - 0.5, 0, 3.6, 5, LAMP, 'up', 1)];
    case 'ufapalast': {
      // The canopy at 3.5 m with its bulb row; doors under it, billboards and lettering over it.
      const FZ = hz - 0.6;
      return [
        L(-0.8, 3.1, FZ + 1.0, BULB, 24, 11, 4.2, { reach: 1.4, stretch: 0.8 }),
        W(-0.8, 0, FZ + 0.16, 0, 7.6, 3.3, BULB, 'down', 1.4),
        W(-0.8, 3.7, FZ + 0.4, 0, 8.4, 5.2, BULB, 'up', 0.9),
        S(-0.8, FZ, 0, 7.4, 3.2, BULB, 1.2),
      ];
    }
    case 'capitol': {
      // Shop windows of the two front blocks spill onto the pavement; the passage under the cinema front is
      // framed in bulbs; the cornice bulb rows wash down the fronts.
      const out: PlanItem[] = [];
      for (const bx of [-8, 8]) {
        for (const sx of [-4, 0, 4]) out.push(S(bx + sx - 0.55, 5.02, 0, 2.6, 2.8, SHOP, 1.3));
        out.push(L(bx, 2.0, 6.4, SHOP, 13, 8, 4.4, { stretch: 0.55, reach: 0.4 }));
        out.push(W(bx, 4.3, 5.15, 0, 12, 3.0, BULB, 'down', 0.7));
      }
      out.push(L(0, 3.8, 6.6, BULB, 22, 10, 3.6, { reach: 1.2 }), W(0, 4.3, 5.5, 0, 4.4, 6.2, BULB, 'up', 1.3), S(0, 5.0, 0, 4.0, 3.0, BULB, 1.2));
      return out;
    }
    case 'gedaechtniskirche':
      // Portal lanterns on the south side (the transept portal and the front block's), a faint wash on the
      // portals, candle light behind the transept rose window, the lit clock of the main tower.
      return [
        L(5.3, 3.2, 5.0, LAMP, 16, 9, 3.6, { reach: 1.0, halo: 0.35 }),
        L(-11.8, 2.8, 4.9, LAMP, 12, 8, 3.0, { reach: 0.8, halo: 0.3 }),
        N(6.6, 2.7, 4.55), N(4.0, 2.7, 4.55), N(-12.9, 2.4, 4.45),
        W(5.3, 0, 5.05, 0, 4.2, 4.6, LAMP, 'up', 1.3),
        W(-11.8, 0, 4.95, 0, 3.0, 3.8, LAMP, 'up', 1.1),
        W(5.3, 7.4, 4.5, 0, 4.6, 4.0, FIRE, 'round', 1.4),
        W(-7.5, 19.3, 3.3, 0, 2.8, 2.6, LAMP, 'round', 1.5),
      ];
    case 'romanischescafe': {
      const FZ = hz - 2.2;
      return [L(0, 2.2, FZ + 1.2, LAMP, 14, 9, 4.0, { stretch: 0.6, reach: 0.9 }), W(0, 0, FZ + 0.3, 0, 8, 4.4, LAMP, 'up', 1.1), S(0, FZ + 0.1, 0, 8, 2.6, LAMP, 1)];
    }
    case 'kadewe': {
      // Street face (north, local −z): shop windows and the two doors spill onto the Tauentzien pavement.
      // Inside the roofless hall: four standing lamps in the corners (outside the fight circle) light the
      // fight, their light rising up the gallery walls.
      const out: PlanItem[] = [];
      const bays = 15, bw = (2 * hx) / bays;
      for (let i = 0; i < bays; i++) {
        const x = -hx + (i + 0.5) * bw;
        if ((x > -13.5 && x < -7.5) || (x > 5.5 && x < 11.5)) continue;
        out.push(S(x, -16.05, PI, bw - 1.0, 2.6, SHOP, 1.1));
      }
      for (const x of [-10.5, 8.5]) out.push(L(x, 3.4, -17.0, LAMP, 16, 9, 3.8, { yaw: PI, reach: 1.2, halo: 0.3 }), S(x, -16.1, PI, 5, 3.4, LAMP, 1.2));
      out.push(L(-1, 2.0, -17.4, SHOP, 12, 8, 4.6, { yaw: PI, stretch: 0.5, reach: 0.6 }));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        // On the rim of the fight circle (r 13 round the hall's centre) at 60° off the axis, so the game camera
        // sees them beside the hero; the gallery walls behind them catch their light.
        const x = sx * 11.3, z = sz * 6.6;
        out.push(N(x, 2.6, z, 2.6), L(x, 2.7, z, LAMP, 26, 13, 5.5, { halo: 0.55 }, 0.06));
        if (sz < 0) out.push(W(sx * 12, 0, -14.8, 0, 14, 12, LAMP, 'up', 1.4));
        out.push(W(sx * 21.9, 0, z, -sx * HALF, 12, sz < 0 ? 9 : 5, LAMP, 'up', 0.9));
      }
      return out;
    }
    case 'wittenbergplatz':
      return [...[-3.5, 3.5].map((x) => L(x, 3.05, hz + 0.1, LAMP, 14, 8, 3.2, { halo: 0.35 })), W(0, 0, hz + 0.05, 0, 7, 4.6, LAMP, 'up', 1.1)];
    // ---- Zone 2, Ku'damm & Savignyplatz.
    case 'revuepalast': {
      // The show piece: white and pink bulbs on the half-round canopy (3.55 m, radius 3.9 from the front at
      // 1.4) wash its underside, the lit doors and the steps; the bulbs on its top light the silver fan.
      const FZ = 1.4;
      return [
        L(0, 3.1, FZ + 2.0, BULB, 32, 12, 5.2, { reach: 1.4, stretch: 1.2 }),
        ...[-1, 1].map((s) => L(s * 3.1, 3.3, FZ + 3.3, PINK, 14, 8, 3.0, { halo: 0.55 })),
        W(0, 0.45, FZ + 0.16, 0, 6.6, 3.1, BULB, 'down', 2.0),
        // The three steps (0.45, 0.3, 0.15 m), then the pavement under the canopy.
        S(0, FZ + 0.05, 0, 7.8, 0.45, BULB, 1.8, 0.45), S(0, FZ + 0.5, 0, 7.2, 0.5, BULB, 1.6, 0.3), S(0, FZ + 1.0, 0, 6.6, 0.5, BULB, 1.4, 0.15),
        S(0, FZ + 1.5, 0, 7.6, 3.6, BULB, 1.2),
        W(0, 4.0, FZ + 0.5, 0, 10.5, 6.8, BULB, 'up', 1.6),
        W(0, 4.0, FZ + 0.56, 0, 12, 4.5, PINK, 'up', 1.0),
        ...[-1, 1].map((s) => W(s * 5.8, 0, FZ + 0.2, 0, 3.8, 6.4, PINK, 'up', 1.4)),
        G(0, 3.95, FZ + 2.2, 3.8, BULB, 1, true),
        G(0, 3.95, FZ + 2.2, 2.4, PINK, 1, true),
      ];
    }
    case 'gloriapalast': {
      const FZ = hz - 1.3;
      return [
        L(0, 2.8, FZ + 1.6, BULB, 22, 10, 3.8, { reach: 1.2, stretch: 1.2 }),
        W(0, 0, FZ + 0.2, 0, 3.4, 2.9, BULB, 'down', 1.4),
        W(0, 3.25, FZ + 0.65, 0, 6, 6, BULB, 'up', 0.9),
        ...[-1, 1].map((s) => S(s * 3.2, FZ + 0.05, 0, 3.6, 1.25, LAMP, 1.2, 0.15)),
        L(-3.3, 1.8, FZ + 1.4, LAMP, 10, 7, 2.8, { stretch: 0.6 }),
      ];
    }
    case 'marmorhaus': {
      // Turned 180°: the cinema front faces the Ku'damm (north) and is cut at 4.3 m while the hero is near, so
      // only its pool on the pavement reads; the camera side gets the exit lamp.
      const FZ = hz - 0.3;
      return [
        L(0, 3.0, FZ + 1.8, BULB, 26, 11, 4.6, { reach: 1.8, stretch: 1.3 }),
        S(0, FZ + 0.2, 0, 6.2, 3.6, BULB, 1.2),
        L(2.8, 2.8, -hz - 0.5, LAMP, 10, 7, 2.6, { yaw: PI, reach: 0.9, halo: 0.28 }),
        N(2.8, 2.65, -hz - 0.25),
        W(2.8, 0, -hz - 0.2, PI, 3.0, 3.6, LAMP, 'up', 1.2),
      ];
    }
    case 'cafewestens': {
      // The globe lamp over the café door (1.6, 3.75) and the lit café windows.
      const FZ = hz - 2.4;
      return [
        L(1.6, 3.75, FZ + 0.7, LAMP, 20, 10, 4.0, { reach: 0.8, halo: 0.45 }),
        W(1.6, 0, FZ + 0.5, 0, 3.8, 4.4, LAMP, 'down', 1.4),
        S(-hx + 2.1, FZ + 0.05, 0, 3.8, 2.4, LAMP, 1.2),
        W(-hx + 2.1, 0, FZ + 0.2, 0, 3.8, 3.6, LAMP, 'up', 0.8),
      ];
    }
    case 'theaterwestens': {
      // The two iron candelabra at the entrance and the five lit arcade doors; their light climbs the arcade
      // and the balcony; the lantern of the corner tower glows for the reveal.
      const FZ = 2.6;
      return [
        ...[-5.4, 4.6].map((x) => L(x, 3.2, FZ + 1.1, LAMP, 18, 9, 3.6, { halo: 0.55 })),
        L(-0.4, 1.8, FZ + 1.0, LAMP, 14, 9, 5.0, { stretch: 0.55, reach: 1.2 }),
        W(-0.4, 0, FZ + 0.25, 0, 10.4, 7.2, LAMP, 'up', 2.2),
        S(-0.4, FZ + 0.05, 0, 10, 0.75, LAMP, 1.8, 0.3), S(-0.4, FZ + 0.8, 0, 10, 3.0, LAMP, 1.5),
        G(4.9, 18.5, FZ - 0.4, 1.3, LAMP, 1.5),
        G(-5.4, 17.8, FZ - 0.6, 0.8, LAMP, 1),
      ];
    }
    case 'variete': {
      // Violet-pink hall light from the lit stage spills through the broken glass of the long front (z 2.2)
      // and glows under the glass vault; the kiosk's pink frieze.
      const CX = -1.7;
      return [
        L(CX, 2.6, -0.8, PINK, 22, 11, 5.5, { reach: 2.6, stretch: 1.2 }),
        L(5.0, 3.0, 0.6, PINK, 10, 7, 3.0, { halo: 0.6 }),
        S(CX, 2.4, 0, 10.6, 4.2, PINK, 1.5),
        W(CX, 0.45, -3.05, 0, 9.8, 4.2, PINK, 'up', 1.3),
        W(CX, 0.45, 2.45, 0, 10.4, 4.0, PINK, 'up', 1.0),
        G(CX, 5.4, -0.7, 3.4, PINK, 1),
        G(5.0, 3.0, 0.6, 1.9, PINK, 1),
      ];
    }
    case 'opernhaus': {
      // The forecourt lamp posts (±10.5, two lanterns each), door glow up the columns, the steps lit for the boss.
      const FZ = 4.8;
      const out: PlanItem[] = [
        ...[-10.5, 10.5].map((x) => L(x, 4.5, hz - 0.6, LAMP, 26, 12, 5.0, { halo: 0.55 })),
        L(0, 2.6, FZ + 1.0, LAMP, 16, 10, 5.4, { stretch: 0.55, reach: 1.8 }),
        W(0, 1.3, FZ + 0.7, 0, 19.5, 11, LAMP, 'up', 1.5),
      ];
      // The four steps (top at 0.2 + 0.15 (i + 1)), each tread lit a little less toward the street.
      for (let i = 3; i >= 0; i--) {
        const z0 = FZ + 2.6 - 0.6 * (i + 1), y = 0.2 + 0.15 * (i + 1) + 0.02;
        out.push(S(0, i === 3 ? FZ : z0, 0, 20.5 - i * 0.4, i === 3 ? 0.8 : 0.6, LAMP, 1.6 - (3 - i) * 0.25, y));
      }
      return out;
    }
    case 'schillertheater': {
      const FZ = hz - 0.6;
      return [
        ...[-3, 3].map((x) => L(x, 2.8, FZ + 0.75, LAMP, 14, 8, 3.2, { reach: 0.5, halo: 0.35 })),
        W(0, 0, FZ + 0.2, 0, 6.4, 4.4, LAMP, 'up', 1.2),
        W(0, 4.6, FZ - 0.45, 0, 7.2, 4.0, LAMP, 'round', 1),
      ];
    }
    case 'hochschule':
      return [-3.5, 3.5].map((x) => L(x, 3.4, hz - 1, LAMP, 14, 9, 3.6, { halo: 0.4 }));
    case 'chtor':
      // A candelabrum on each colonnade half; their light on the pylons facing the camera.
      return [...[-15.1, 15.1].map((x) => L(x, 6.0, 2.6, LAMP, 18, 10, 4.0, { halo: 0.5 })), ...[-12.2, 12.2].map((x) => W(x, 0, 3.3, 0, 3.6, 7.5, LAMP, 'up', 0.9))];
    case 'chrathaus': {
      const FZ = hz - 1.2;
      return [...[3.1, -2.0].map((x) => L(x, 3.85, hz - 0.5, LAMP, 14, 9, 3.4, { halo: 0.4 })), W(hx - 2.3, 0, FZ + 0.5, 0, 3.4, 4.8, LAMP, 'up', 1.1)];
    }
    // ---- Zones 3 and 4, Schlossgarten and Spiegelschloss.
    case 'stuelerbau': {
      const FZ = hz - 0.5;
      return [L(0, 3.0, FZ + 0.7, LAMP, 14, 8, 3.2, { reach: 0.8, halo: 0.35 }), N(0, 2.85, FZ + 0.2), W(0, 0, FZ + 0.4, 0, 5, 6, LAMP, 'up', 1)];
    }
    case 'schlossmitte': {
      // The court front as a stage: footlights along its foot (bulbs at the edge), a pale wash up the centre,
      // the risalit and the links, the portal lanterns, the lit clock; the lantern on the dome is a beacon.
      const out: PlanItem[] = [
        ...[-10, 0, 10].map((x) => L(x, 0.35, 8.6, BULB, 14, 9, 4.2, { stretch: 0.5, reach: 0.4 })),
        ...[-1.75, 1.75].map((x) => L(x, 3.1, 7.9, LAMP, 14, 8, 3.0, { halo: 0.38 })),
        W(0, 0, 7.62, 0, 12.8, 11.6, BULB, 'up', 1.6),
        ...[-1, 1].map((s) => W(s * 11.5, 0, 6.85, 0, 10.6, 11.4, BULB, 'up', 1.2)),
        ...[-1, 1].map((s) => W(s * 20, 0, 8.35, 0, 6.2, 9.0, BULB, 'up', 1.0)),
        W(0, 0, 7.7, 0, 3.0, 4.6, LAMP, 'round', 1.2),
        W(0, 19.0, 3.85, 0, 2.2, 2.3, LAMP, 'round', 1.5),
        G(0, 28, 0, 2.6, LAMP, 3),
        G(0, 28, 0, 5.5, LAMP, 1),
      ];
      // Footlight bulbs along the front edge (inside the court, never in the fight circle).
      for (let x = -22; x <= 22; x += 1.1) out.push(N(x, 0, Math.abs(x) > 17 ? 8.4 : 8.0, -1, [2.0, 1.85, 1.7]));
      return out;
    }
    case 'schlossfluegel': {
      // Court fronts: west wings face +x, the east wing −x; a pale wash up each from the footlights' level.
      const side = l.variant === 2 ? -1 : 1;
      return [W(side * (hx + 0.3), 0, 0, side * HALF, 2 * hz - 0.6, 8.6, BULB, 'up', 1.0)];
    }
    case 'ehrenhoftor':
      // Lanterns on the two gate piers (x ±4.1, 5 m), toward the Schloßstraße and into the court.
      return [
        ...[-4.1, 4.1].flatMap((x) => [N(x, 3.6, 0.78), N(x, 3.6, -0.78), L(x, 3.7, 1.1, LAMP, 16, 9, 3.4, { halo: 0.45 })]),
        ...[-4.1, 4.1].map((x) => W(x, 0, 0.75, 0, 2.6, 5.4, LAMP, 'up', 1)),
      ];
    case 'neuerfluegel': {
      const FZ = hz - 1.0;
      return [L(0, 2.6, FZ + 1.0, LAMP, 12, 8, 3.6, { reach: 0.8 }), W(0, 0, FZ + 0.5, 0, 10, 9, LAMP, 'up', 0.9)];
    }
    case 'orangerie':
      // Cold light caught in the mirror gallery of the north wall (faces +z into the ruin): sparse.
      return [
        ...[-7, 6].map((x) => L(x, 3.4, -9.2, COLD, 10, 8, 3.0, { halo: 0.3 })),
        ...[-9, -3.5, 6, 10].map((x, i) => W(x, 1.2, -10.75, 0, 2.2, i % 2 ? 3.4 : 4.2, COLD, 'round', 1.2)),
      ];
    case 'gartentor':
      return [L(0, 2.8, 0, LAMP, 14, 8, 3.0, { halo: 0.4 })];
    case 'belvedere':
      // A lit window or two and the door lamp; the boss arena lies south of it.
      return [L(0, 2.8, hz + 0.3, LAMP, 14, 8, 3.2, { reach: 0.8, halo: 0.35 }), W(0, 0, hz + 0.05, 0, 4.2, 8.5, LAMP, 'up', 1), W(-1.6, 5.2, hz + 0.05, 0, 1.6, 2.4, LAMP, 'round', 1.6), W(1.4, 8.6, hz + 0.05, 0, 1.4, 2.0, LAMP, 'round', 1.2)];
    case 'mausoleum': {
      // One candle-like light at the bronze door, quiet.
      const PZ = hz - 2.3, FW = PZ - 1.7;
      return [L(0.5, 1.0, FW + 0.6, FIRE, 8, 6, 2.2, { halo: 0.22 }, 0.5), N(0.5, 0.75, FW + 0.45, -1, [1.9, 1.0, 0.4]), W(0, 0.75, FW + 0.3, 0, 2.6, 3.4, FIRE, 'up', 0.9)];
    }
    default:
      return [];
  }
}

/** Ground under a landmark, as `buildMapWorld` builds it (the Bahnhof Zoo stands on the street). */
function landmarkBase(l: Landmark, ground: (x: number, z: number) => number): number {
  if (l.walkUnder) return 0;
  const r = Math.max(l.hx, l.hz);
  return Math.min(ground(l.x, l.z), ground(l.x - r, l.z - r), ground(l.x + r, l.z - r), ground(l.x - r, l.z + r), ground(l.x + r, l.z + r));
}

/** World x, z of a landmark's local (x, z). */
export function worldOf(l: Landmark, x: number, z: number): [number, number] {
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  return [l.x + x * c + z * s, l.z - x * s + z * c];
}

/** Every light of the map's sights in world x, z with its pool centre (for the fight-circle test). */
export function landmarkLightPlan(m: MapDef): Array<{ landmark: Landmark; light: PlanLight; x: number; z: number; poolX: number; poolZ: number }> {
  const out: Array<{ landmark: Landmark; light: PlanLight; x: number; z: number; poolX: number; poolZ: number }> = [];
  for (const l of m.landmarks) {
    for (const it of plan(l)) {
      if (it.t !== 'light') continue;
      const yaw = it.shape?.yaw ?? 0, reach = it.shape?.reach ?? 0;
      const [x, z] = worldOf(l, it.x, it.z), [poolX, poolZ] = worldOf(l, it.x + Math.sin(yaw) * reach, it.z + Math.cos(yaw) * reach);
      out.push({ landmark: l, light: it, x, z, poolX, poolZ });
    }
  }
  return out;
}

/** The glow material of `color` in this chunk (the one its lamp decals use), made through `light` if missing. */
function glowMat(b: ChunkBuilder, color: number): Material {
  // `glowMats` is the chunk's private colour → material map; sharing it keeps washes in the decals' draw call.
  const mats = (b as unknown as { glowMats: Map<number, Material> }).glowMats;
  if (!mats.has(color)) b.light(new Vector3(0, -50, 0), color, 0, 0, 0, 0);
  return mats.get(color)!;
}

const CROSSED = [[0, 0], [0, HALF], [-HALF, 0]] as const, FLAT = [[-HALF, 0]] as const;
const lanternGlass = new CylinderGeometry(0.15, 0.11, 0.4, 6);
const lanternCap = new CylinderGeometry(0.02, 0.2, 0.18, 6);
const lanternPost = new CylinderGeometry(0.05, 0.08, 1, 6);
const bulb = new SphereGeometry(0.07, 5, 3);

/** Dresses every Charlottenburg sight with light (`buildCharlottenburgWorld`); other maps never call it. */
export function lightCharlottenburgLandmarks(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  for (const l of m.landmarks) {
    const items = plan(l);
    if (!items.length) continue;
    const b = chunkOf(l.x, l.z), frame = new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0, l.z);
    const pt = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(frame);
    // Cut landmarks (V1 B, the Marmorhaus): nothing above the cut height, it would float while the top is off.
    const top = l.cut ? (l.cut.h ?? CUT.floor) : Infinity;
    b.on(landmarkBase(l, ground), () => {
      for (const it of items) {
        if (it.t === 'light') {
          const sh = it.shape ? { ...it.shape, yaw: l.rot + (it.shape.yaw ?? 0) } : { yaw: l.rot };
          b.light(pt(it.x, it.y, it.z), it.color, it.i, it.d, it.flicker ?? 0.04, it.pool, sh);
        } else if (it.t === 'wash') {
          const h = Math.min(it.h, top - it.y);
          if (h <= 0.2) continue;
          wash(b, glowMat(b, it.color), pt, it, h);
        } else if (it.t === 'spill') {
          spill(b, glowMat(b, it.color), pt, it);
        } else if (it.t === 'glow') {
          const mat = glowMat(b, it.color), c = pt(it.x, it.y, it.z);
          for (let k = 0; k < Math.round(it.k * GAIN); k++) for (const [rx, ry] of it.flat ? FLAT : CROSSED) {
            b.glows.of(mat).add(new PlaneGeometry(it.r * 2, it.r * 2), new Matrix4().makeRotationY(l.rot + ry).multiply(new Matrix4().makeRotationX(rx)).setPosition(c));
          }
        } else {
          const at = (x: number, y: number, z: number): Matrix4 => new Matrix4().makeRotationY(l.rot).setPosition(pt(x, y, z));
          if (it.post < 0) { b.geo(b.mm.lampGlass, bulb, at(it.x, it.y + 0.07, it.z), it.tint); continue; }
          if (it.post > 0) b.geo(b.mm.iron, lanternPost, at(it.x, it.post / 2, it.z).multiply(new Matrix4().makeScale(1, it.post, 1)), [0.5, 0.5, 0.52]);
          b.geo(b.mm.lampGlass, lanternGlass, at(it.x, it.y + 0.2, it.z), it.tint);
          b.geo(b.mm.iron, lanternCap, at(it.x, it.y + 0.49, it.z), [0.45, 0.45, 0.47]);
        }
      }
    });
  }
}

/**
 * Card strength per unit `k`: one glow card peaks at about 12 % blend (the decals' opacity times the texture's
 * centre), too faint on a front beside a fire barrel; tuned in game (2026-11-19).
 */
const GAIN = 2.2;
/** Number of stacked cards for strength k and the peak of each (0 … 1 of the glow texture's centre). */
function stack(k0: number): { n: number; f: number } {
  const k = k0 * GAIN, n = Math.max(1, Math.ceil(k - 1e-6));
  return { n, f: Math.min(1, k / n) };
}

/** A vertical wash card (see `PlanWash`), its gradient window chosen in the round glow texture. */
function wash(b: ChunkBuilder, mat: Material, pt: (x: number, y: number, z: number) => Vector3, w: PlanWash, h: number): void {
  const { n, f } = stack(w.k);
  // Tangent to the right seen from the front, so the quad winds counter-clockwise toward the viewer.
  const tx = Math.cos(w.ry), tz = -Math.sin(w.ry);
  const at = (s: number, y: number): Vector3 => pt(w.x + tx * s, y, w.z + tz * s);
  const corners: [Vector3, Vector3, Vector3, Vector3] = [at(-w.w / 2, w.y), at(w.w / 2, w.y), at(w.w / 2, w.y + h), at(-w.w / 2, w.y + h)];
  // The bright edge sits (1 − f) / 2 off the texture's centre: a weaker card starts further out on the gradient.
  const off = (1 - f) * 0.5;
  // Cut short (`h` below the planned height): the gradient keeps its planned length.
  const cut = h / w.h;
  const uv: [number, number, number, number] = w.dir === 'up' ? [0, 0.5 + off, 1, 0.5 + off + (0.5 - off) * cut]
    : w.dir === 'down' ? [0, 0.5 - off - (0.5 - off) * cut, 1, 0.5 - off] : [0, 0, 1, 1];
  for (let i = 0; i < n; i++) b.glows.of(mat).quad(corners, uv);
}

/** A flat spill on the ground in front of a facade (see `PlanSpill`), bright along the facade. */
function spill(b: ChunkBuilder, mat: Material, pt: (x: number, y: number, z: number) => Vector3, s: PlanSpill): void {
  const { n, f } = stack(s.k);
  const nx = Math.sin(s.ry), nz = Math.cos(s.ry), tx = Math.cos(s.ry), tz = -Math.sin(s.ry), y = s.y + 0.045;
  const at = (a: number, o: number): Vector3 => pt(s.x + tx * a + nx * o, y, s.z + tz * a + nz * o);
  // Wound counter-clockwise seen from above (normal up).
  const corners: [Vector3, Vector3, Vector3, Vector3] = [at(s.w / 2, 0), at(-s.w / 2, 0), at(-s.w / 2, s.d), at(s.w / 2, s.d)];
  const off = (1 - f) * 0.5;
  for (let i = 0; i < n; i++) b.glows.of(mat).quad(corners, [0, 0.5 + off, 1, 1]);
}
