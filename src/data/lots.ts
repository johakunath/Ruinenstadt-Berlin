// M11c lot types (Johannes, 2026-11-17, `docs/mockups/m11c-lot-types.svg`): eight special lots, two per
// area group, that replace about two in five street lots. Each one is a small walkable place with its
// own props, buildings, sleeping or hidden enemies and spots where run events (captive, trader, cache)
// like to happen. Local frame: a along the street front (width w), b towards the street (front at
// b = +d/2), like the wings in `generateLots`. Pure data, deterministic per lot seed.
import type { Prop } from './courtyard';
import type { EnemyKind } from './enemies';
import type { Lot, Pt } from './map';
import { Rng } from '../sim/math';

export type SpecialKind = 'hinterhof' | 'parkplatz' | 'kleingarten' | 'teich' | 'truemmer' | 'baustelle' | 'markt' | 'kirchhof'
  // M15 Alexanderplatz (GDR clockwork gardens): a greenhouse garden and a Plattenbau courtyard.
  | 'glashaus' | 'plattenhof'
  // M15 Mitte (2089, Potsdamer Platz): a neon night market and a container village.
  | 'nachtmarkt' | 'containerdorf'
  // M15 Mitte step 7, the other zones (`docs/mockups/m15-mitte-lots.svg`, variant A): a club yard (Friedrichstadt),
  // a checkpoint zone (Regierungsviertel), a tent camp and a beer garden clearing (Tiergarten, placed by hand).
  | 'clubhof' | 'sperrzone' | 'zeltlager' | 'lichtung';
/** Sleeping guards: `lying` play dead on the ground, `hidden` wait unseen in a doorway or under rubble. */
export interface LotGuard { x: number; z: number; kind: EnemyKind; elite: boolean; wake: number; hp: number; pose: 'lying' | 'hidden'; facing: number }
/** A walkable plank path over water (pond jetty): center, facing along its length. */
export interface Pier { x: number; z: number; rot: number; len: number; width: number }
export interface LotContent {
  props: Prop[];
  /** Buildings and trees that belong to the lot (ordinary lots, rendered and collided as usual). */
  lots: Lot[];
  pond?: Pt[];
  pier?: Pier;
  guards: LotGuard[];
  /** Preferred places for run events. */
  spots: { rescue?: Pt; trader?: Pt; cache?: Pt };
  /** Ground cover drawn over the area ground. */
  ground?: 'asphalt' | 'cobbles' | 'dirt' | 'gravel';
}

/** Size ranges per type: width along the street, depth away from it. */
export const SPECIAL_SIZE: Record<SpecialKind, { w: [number, number]; d: [number, number]; max: number }> = {
  hinterhof: { w: [18, 21], d: [21, 24], max: 5 },
  parkplatz: { w: [19, 22], d: [14, 16], max: 1 },
  kleingarten: { w: [18, 21], d: [15, 17], max: 3 },
  teich: { w: [19, 22], d: [16, 19], max: 3 },
  truemmer: { w: [16, 20], d: [13, 16], max: 4 },
  baustelle: { w: [19, 22], d: [16, 18], max: 3 },
  markt: { w: [17, 20], d: [13, 15], max: 3 },
  kirchhof: { w: [19, 22], d: [16, 18], max: 2 },
  glashaus: { w: [18, 22], d: [15, 18], max: 3 },
  plattenhof: { w: [19, 23], d: [16, 19], max: 3 },
  nachtmarkt: { w: [17, 21], d: [13, 16], max: 3 },
  containerdorf: { w: [18, 22], d: [15, 18], max: 3 },
  clubhof: { w: [18, 21], d: [18, 21], max: 3 },
  sperrzone: { w: [18, 22], d: [14, 17], max: 3 },
  zeltlager: { w: [17, 20], d: [14, 16], max: 2 },
  lichtung: { w: [17, 20], d: [14, 16], max: 2 },
};
/** Chance per street slot to try a lot type (Johannes: two in five lots; many tries do not fit, so higher). */
export const SPECIAL_SHARE = 0.7;
export const SPECIAL_NAME: Record<SpecialKind, string> = {
  hinterhof: 'Hinterhof', parkplatz: 'Parkplatz', kleingarten: 'Kleingärten', teich: 'Teich', truemmer: 'Trümmerfeld', baustelle: 'Baustelle', markt: 'Markt', kirchhof: 'Kirchhof',
  glashaus: 'Gewächshausgarten', plattenhof: 'Plattenbauhof', nachtmarkt: 'Nachtmarkt', containerdorf: 'Containerdorf',
  clubhof: 'Clubhof', sperrzone: 'Sperrzone', zeltlager: 'Zeltlager', lichtung: 'Lichtung',
};

export function lotContent(l: Lot & { special: SpecialKind }): LotContent {
  const rng = new Rng(l.seed + 17);
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  const W = l.w / 2, D = l.d / 2;
  /** World point of local (a, b). */
  const P = (a: number, b: number): Pt => [l.x + c * a + s * b, l.z - s * a + c * b];
  const out: LotContent = { props: [], lots: [], guards: [], spots: {} };
  /** A prop at local (a, b); `r` is the local turn (0 = facing the street), always with a little jitter. */
  const prop = (kind: Prop['kind'], a: number, b: number, r = 0, size = 1, jit = 0.18): void => {
    const [x, z] = P(a + rng.range(-0.25, 0.25) * (jit > 0 ? 1 : 0), b + rng.range(-0.25, 0.25) * (jit > 0 ? 1 : 0));
    out.props.push({ kind, x, z, rot: l.rot + r + rng.range(-jit, jit), size });
  };
  /** A straight run (fence, wall, hedge) from local (a0, b0) to (a1, b1), split by gaps [from, to] in meters along it. */
  const run = (kind: Prop['kind'], a0: number, b0: number, a1: number, b1: number, gaps: Array<[number, number]> = [], tilt = 0.03): void => {
    const len = Math.hypot(a1 - a0, b1 - b0), r = Math.atan2(-(b1 - b0), a1 - a0);
    let at = 0;
    for (const [g0, g1] of [...gaps.sort((p, q) => p[0] - q[0]), [len, len] as [number, number]]) {
      if (g0 - at > 0.6) { const m = (at + g0) / 2, k = m / len; prop(kind, a0 + (a1 - a0) * k, b0 + (b1 - b0) * k, r, g0 - at, tilt); }
      at = g1;
    }
  };
  const building = (kind: 'altbau' | 'shop', a0: number, a1: number, b0: number, b1: number, floors: number): void => {
    const [x, z] = P((a0 + a1) / 2, (b0 + b1) / 2);
    const lot: Lot = { kind, x, z, rot: l.rot, w: a1 - a0, d: b1 - b0, floors, seed: rng.int(1e6) };
    if (rng.next() < 0.4) lot.ruin = true;
    out.lots.push(lot);
  };
  const tree = (a: number, b: number, w = rng.range(4.5, 6.5)): void => { const [x, z] = P(a, b); out.lots.push({ kind: 'tree', x, z, rot: rng.range(0, 6.28), w, d: w, floors: 0, seed: rng.int(1e6) }); };
  const guard = (kind: EnemyKind, a: number, b: number, pose: LotGuard['pose'], o: { elite?: boolean; hp?: number; wake?: number } = {}): void => {
    const [x, z] = P(a, b);
    out.guards.push({ x, z, kind, pose, elite: o.elite ?? false, hp: o.hp ?? 1, wake: o.wake ?? 4.5, facing: rng.range(0, 6.28) });
  };
  /** Drops props and trees added since the given indices whose centre lies within `half` of the local segment (a0, b0)–(a1, b1). No random draws. */
  const clearLane = (fromProp: number, fromLot: number, a0: number, b0: number, a1: number, b1: number, half: number): void => {
    const near = (x: number, z: number): boolean => {
      const dx = x - l.x, dz = z - l.z, a = c * dx - s * dz, b = s * dx + c * dz;
      const ux = a1 - a0, uz = b1 - b0, k = Math.max(0, Math.min(1, ((a - a0) * ux + (b - b0) * uz) / (ux * ux + uz * uz || 1)));
      return Math.hypot(a - a0 - ux * k, b - b0 - uz * k) < half;
    };
    out.props = [...out.props.slice(0, fromProp), ...out.props.slice(fromProp).filter((p) => p.kind === 'clothesline' || !near(p.x, p.z))];
    out.lots = [...out.lots.slice(0, fromLot), ...out.lots.slice(fromLot).filter((q) => !near(q.x, q.z))];
  };
  const side = rng.pick([-1, 1]);
  switch (l.special) {
    case 'hinterhof': {
      // Vorderhaus with a Durchfahrt, a side wing, a Quergebäude with a second passage, a back yard with
      // a Remise. Nested: street → first yard → second yard (Johannes: "verschachtelter, verwinkelter").
      const gx = rng.range(-W + 5, W - 5), qx = -side * rng.range(W - 6, W - 3.5);
      // Depths: Vorderhaus 6 m, first yard, Quergebäude 5 m, back yard with the 4.5 m Remise.
      const fb = D - 5.5, qb1 = fb - Math.max(4.5, (2 * D - 14.5) * 0.5), qb0 = qb1 - 4.5;
      building('altbau', -W, gx - 1.6, fb, D, 1 + rng.int(2));
      building('altbau', gx + 1.6, W, fb, D, 1 + rng.int(2));
      const wing = side > 0 ? [W - 5, W] : [-W, -W + 5];
      building('altbau', wing[0]!, wing[1]!, qb1, fb, 1 + rng.int(2));
      building('altbau', -W, qx - 1.4, qb0, qb1, 1 + rng.int(2));
      building('altbau', qx + 1.4, W, qb0, qb1, 1 + rng.int(2));
      const rx = side * rng.range(W - 6, W - 3.5);
      building('shop', rx - 2.5, rx + 2.5, -D, -D + 4.5, 0);
      // Yard walls where no building closes the yard.
      run('wall', -side * W, qb1, -side * W, fb, [], 0.02);
      run('wall', -W, -D + 0.2, W, -D + 0.2, [[side > 0 ? W + rx - 2.7 : W + rx - 2.7, W + rx + 2.7]], 0.02);
      run('wall', -W + 0.2, -D, -W + 0.2, qb0, [], 0.02); run('wall', W - 0.2, -D, W - 0.2, qb0, [], 0.02);
      // First yard: bins, bikes, a clothesline, a fire barrel, crates.
      const firstProp = out.props.length, firstLot = out.lots.length;
      const y1 = (qb1 + fb) / 2, ya = -side * (W - 1.2);
      prop('bins', ya, y1 + 2, Math.PI / 2 * side, 1, 0.12); prop('bikes', -side * 2, fb - 0.8, Math.PI, 1, 0.3);
      prop('clothesline', rng.range(-3, 3), y1 - 0.5, rng.range(-0.5, 0.5), rng.range(6, 9), 0.1);
      prop('fireBarrel', side * rng.range(0, 4), y1 - 2.4); prop('crates', -side * (W - 2.5), qb1 + 1.2, rng.range(0, 1));
      prop('rubble', side * (W - 7), qb1 + 1.5, 0, rng.range(0.6, 1)); tree(side * rng.range(-2, 2), y1 + rng.range(-1, 1), 4);
      // Keep a lane from the Durchfahrt to the Quergebäude passage (P21: the second yard was cut off).
      clearLane(firstProp, firstLot, gx, fb, qx, qb1, 1.6);
      // Second yard: a lost corner with the Remise, crates (loot) and a clothesline.
      const y2 = (-D + 4.5 + qb0) / 2;
      prop('crate', -rx * 0.4, y2 + rng.range(-1, 1), rng.range(0, 1)); prop('crate', -rx * 0.4 + 1.1, y2 - 0.8, rng.range(0, 1));
      prop('clothesline', -rx * 0.3, qb0 - 1.2, 0.3, 5, 0.15); prop('planks', -rx, qb0 - 1.6, 1.2);
      out.spots.rescue = P(-rx * 0.5, y2); out.spots.cache = P(gx, y1);
      // Something waits in the Remise.
      guard(rng.pick(['brute', 'runner'] as EnemyKind[]), rx, -D + 5.4, 'hidden', { elite: true, hp: 2, wake: 5 });
      out.ground = 'cobbles';
      break;
    }
    case 'parkplatz': {
      // A lane from the street with stalls on both sides, cars parked crooked, three playing dead.
      out.ground = 'asphalt';
      const stalls: Pt[] = [];
      for (const sa of [-1, 1]) for (let b = -D + 2; b < D - 2.5; b += 2.6) stalls.push([sa * (W / 2 + 1.2), b]);
      const empty: Pt[] = [];
      for (const [a, b] of stalls) {
        if (rng.next() < 0.6) prop('car', a + rng.range(-0.4, 0.4), b, Math.PI / 2 + (rng.next() < 0.5 ? Math.PI : 0) + rng.range(-0.25, 0.25), 1, 0.1);
        else empty.push([a, b]);
      }
      prop('boom', -2.4, D - 0.8, 0, 1, 0.05); prop('ticketMachine', 2.8, D - 1.2, Math.PI, 1, 0.2);
      run('hedge', -W + 0.5, -D + 1, -W + 0.5, D - 1.5); run('hedge', W - 0.5, -D + 1, W - 0.5, D - 1.5); run('hedge', -W + 1, -D + 0.5, W - 1, -D + 0.5, [[W - 1.2, W + 1.2]]);
      for (let i = 0; i < 3; i++) {
        const [a, b] = empty.length ? empty.splice(rng.int(empty.length), 1)[0]! : [rng.range(-1.2, 1.2), rng.range(-D + 2, D - 4)] as Pt;
        guard(i === 2 ? 'runner' : 'walker', a, b, 'lying', { wake: 4 });
      }
      out.spots.cache = P(0, -D + 2.5);
      break;
    }
    case 'kleingarten': {
      // Four plots off a middle path, low picket fences with gates (and gaps): Lauben, beds, gnomes, flowers.
      out.ground = 'gravel';
      const ph = D - 0.6;
      let p = 0;
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const a0 = sa > 0 ? 1.3 : -W + 0.3, a1 = sa > 0 ? W - 0.3 : -1.3, b0 = sb > 0 ? 0.4 : -D + 0.3, b1 = sb > 0 ? D - 0.4 : -0.4;
        const am = (a0 + a1) / 2, bm = (b0 + b1) / 2, gate = rng.range(1, ph - 2.5);
        const pathA = sa > 0 ? a0 : a1, outerA = sa > 0 ? a1 : a0;
        run('picket', pathA, b0, pathA, b1, [[gate, gate + 1.3]]);
        run('picket', outerA, b0, outerA, b1, rng.next() < 0.5 ? [[rng.range(1, 4), rng.range(5, 6)]] : []);
        run('picket', a0, sb > 0 ? b1 : b0, a1, sb > 0 ? b1 : b0, rng.next() < 0.4 ? [[2, 3.4]] : []);
        prop('shed', outerA - sa * 1.8, sb > 0 ? b1 - 1.6 : b0 + 1.6, rng.range(-0.3, 0.3) + (sa > 0 ? Math.PI / 2 : -Math.PI / 2));
        prop('gardenBed', am - sa * 0.6, bm + rng.range(-0.8, 0.8), Math.PI / 2 + rng.range(-0.2, 0.2), 1, 0.1);
        if (rng.next() < 0.7) prop('gardenBed', am + sa * 1.4, bm + rng.range(-1.2, 1.2), Math.PI / 2, 1, 0.15);
        prop('gnome', pathA + sa * 0.8, b0 + gate + 2, rng.range(-1, 1)); prop('flowers', am, sb > 0 ? b0 + 0.9 : b1 - 0.9, 0, rng.range(0.8, 1.3));
        prop(rng.next() < 0.5 ? 'topiary' : 'bush', outerA - sa * 0.9, sb > 0 ? b0 + 1 : b1 - 1, 0, rng.range(0.7, 1.1));
        if (p++ === 1) out.spots.rescue = P(am, bm);
      }
      out.spots.cache = P(0, -D + 1.2);
      // Something lurks in one of the Lauben.
      guard('runner', rng.pick([-1, 1]) * (W - 2.6), rng.pick([-1, 1]) * (D - 3.6), 'hidden', { elite: rng.next() < 0.5, hp: 1.6, wake: 4 });
      break;
    }
    case 'teich': {
      // An organic pond with reeds, a jetty, a bench and trees (Johannes: "nicht nur einfach rund").
      const ca = rng.range(-1.5, 1.5), cb = rng.range(-2, 0), rx = W - 4.5, rz = D - 5;
      const ph = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
      const pond: Pt[] = [];
      for (let i = 0; i < 18; i++) {
        const t = (i / 18) * Math.PI * 2;
        const k = 0.78 + 0.12 * Math.sin(2 * t + ph[0]!) + 0.08 * Math.sin(3 * t + ph[1]!) + 0.05 * Math.sin(5 * t + ph[2]!);
        pond.push(P(ca + Math.cos(t) * rx * k, cb + Math.sin(t) * rz * k));
      }
      out.pond = pond;
      // The jetty runs from the front shore into the water.
      const ja = ca + rng.range(-3, 3), jb = cb + rz * 0.82 * (0.78 + 0.12 * Math.sin(Math.PI + ph[0]!)) + 1;
      const len = rng.range(4, 5.2);
      const [jx, jz] = P(ja, jb);
      out.props.push({ kind: 'jetty', x: jx, z: jz, rot: l.rot + Math.PI, size: len / 4.5 });
      const [px, pz] = P(ja, jb - len / 2);
      out.pier = { x: px, z: pz, rot: l.rot + Math.PI, len: len + 1, width: 1.5 };
      for (let i = 0; i < 6; i++) {
        const t = rng.range(0, Math.PI * 2);
        prop('reeds', ca + Math.cos(t) * rx * 0.86, cb + Math.sin(t) * rz * 0.86, rng.range(0, 6), rng.range(0.8, 1.3), 0.5);
      }
      prop('bench', ja + 2.6, D - 1.4, Math.PI, 1, 0.25); prop('flowers', -W + 2, D - 1.5, 0, 1.2); prop('bush', W - 1.6, -D + 1.6, 0, 1.3);
      tree(-W + 2.2, -D + 2.2); tree(W - 2.4, D - 2.6); if (rng.next() < 0.6) tree(-W + 2.6, D - 3);
      out.spots.cache = P(ja + 3, D - 2.6);
      out.ground = undefined;
      break;
    }
    case 'truemmer': {
      // Rubble heaps, fallen slabs, rusty girders, wall stumps. Something waits under the rubble.
      out.ground = 'dirt';
      run('wall', -W + 0.3, -D + 0.3, -W + 0.3, rng.range(-1, 3), [[rng.range(3, 5), rng.range(6, 7)]], 0.05);
      run('wall', rng.range(-2, 2), -D + 0.3, W - 0.3, -D + 0.3, [[rng.range(1, 3), rng.range(4, 5)]], 0.05);
      for (let i = 0; i < 4; i++) prop('rubble', rng.range(-W + 3, W - 3), rng.range(-D + 3, D - 3), 0, rng.range(1.1, 2.2), 3);
      for (let i = 0; i < 3; i++) prop('slab', rng.range(-W + 3, W - 3), rng.range(-D + 3, D - 2.5), rng.range(0, 6), rng.range(0.6, 1), 3);
      for (let i = 0; i < 2; i++) prop('girder', rng.range(-W + 3, W - 3), rng.range(-D + 3, D - 3), rng.range(0, 6), rng.range(0.7, 1.1), 3);
      for (let i = 0; i < 3; i++) prop('bush', rng.range(-W + 1.5, W - 1.5), rng.range(-D + 1.5, D - 1.5), 0, rng.range(0.8, 1.5), 3);
      prop('crate', rng.range(-3, 3), rng.range(-2, 2), rng.range(0, 3));
      guard('brute', rng.range(-W / 2, W / 2), rng.range(-D / 2, 0), 'hidden', { elite: true, hp: 2.2, wake: 4.5 });
      out.spots.rescue = P(rng.range(-3, 3), D - 3);
      break;
    }
    case 'baustelle': {
      // Rohbau with scaffolding at the back, the crane in a corner, containers, pallets, Bauzaun with a gate.
      out.ground = 'dirt';
      const ra = -side * (W - 6), rb = -D + 4;
      prop('rohbau', ra, rb, 0, 1, 0.08); prop('scaffold', ra, rb + 3.9, 0, 8, 0.03);
      prop('crane', side * (W - 2.6), -D + 2.6, rng.range(0, 6), 1, 0);
      prop('container', side * (W - 2.5), rng.range(0, 2.5), Math.PI / 2 + rng.range(-0.3, 0.3), 1, 0.1);
      if (rng.next() < 0.6) prop('container', -side * rng.range(2, 4), D - 4.2, rng.range(-0.4, 0.4), 1, 0.1);
      for (let i = 0; i < 3; i++) prop('pallets', rng.range(-3, 4), rng.range(-1, 3), rng.range(0, 3), 1, 0.4);
      prop('girder', rng.range(-2, 2), rng.range(-2, 1), rng.range(0, 3), 0.9, 1); prop('workLamp', 0, rb + 5.5, rng.range(0, 6));
      const gate = rng.range(4, l.w - 7);
      run('bauzaun', -W + 0.2, D - 0.3, W - 0.2, D - 0.3, [[gate, gate + 3.4]], 0.05);
      guard('runner', side * (W - 2.5), rng.range(0, 2.5) + 3.4, 'hidden', { elite: true, hp: 1.8, wake: 4 });
      out.spots.cache = P(ra, rb + 5.5);
      break;
    }
    case 'markt': {
      // Stalls set loosely in two rows, one collapsed, spilled goods, string lights and a fire barrel.
      out.ground = 'cobbles';
      const slots: Pt[] = [];
      for (const b of [D - 3.4, -D + 3.4]) for (let a = -W + 2.6; a < W - 2; a += rng.range(3.8, 4.6)) slots.push([a, b]);
      const broken = rng.int(slots.length);
      slots.forEach(([a, b], i) => {
        const r = (b > 0 ? Math.PI : 0) + rng.range(-0.15, 0.15);
        if (i === broken) { prop('stallBroken', a, b, r, 1, 0.4); prop('spill', a + rng.range(-1, 1), b + (b > 0 ? -2 : 2), rng.range(0, 6), 1.2, 1); }
        else if (rng.next() < 0.88) prop('stall', a + rng.range(-0.5, 0.5), b + rng.range(-0.6, 0.6), r, 1, 0.12);
      });
      prop('spill', rng.range(-W / 2, W / 2), rng.range(-1, 1), rng.range(0, 6), 0.9, 1);
      prop('stringLights', 0, 0, rng.range(-0.3, 0.3), 1, 0.1); prop('fireBarrel', rng.pick([-1, 1]) * (W - 1.5), rng.range(-1, 1));
      prop('crates', rng.range(-W + 2, W - 2), rng.range(-1.5, 1.5), rng.range(0, 3), 1, 0.5);
      out.spots.trader = P(rng.range(-2, 2), 0);
      break;
    }
    case 'kirchhof': {
      // Low wall with a gate, crooked rows of graves, lindens, trimmed shrubs, candles; the dead are restless.
      out.ground = undefined;
      const gate = rng.range(W - 3, W + 1);
      run('lowWall', -W + 0.3, D - 0.3, W - 0.3, D - 0.3, [[gate, gate + 2.4]]);
      run('lowWall', -W + 0.3, -D + 0.3, W - 0.3, -D + 0.3); run('lowWall', -W + 0.3, -D + 0.3, -W + 0.3, D - 0.3, [[rng.range(4, 8), rng.range(9, 10)]]); run('lowWall', W - 0.3, -D + 0.3, W - 0.3, D - 0.3);
      const graves: Pt[] = [];
      for (let b = D - 3.6; b > -D + 2; b -= rng.range(2.4, 2.9)) for (let a = -W + 2.4; a < W - 5; a += rng.range(1.7, 2.2)) if (rng.next() < 0.82) graves.push([a + rng.range(-0.3, 0.3), b + rng.range(-0.3, 0.3)]);
      for (const [a, b] of graves) prop('gravestone', a, b, rng.range(-0.25, 0.25), 1, 0.12);
      for (let i = 0; i < 4; i++) { const [a, b] = rng.pick(graves); prop(rng.next() < 0.5 ? 'flowers' : 'topiary', a, b - 0.9, 0, rng.range(0.5, 0.8)); }
      tree(W - 2.6, D - 4, 6.5); tree(W - 2.8, -D + 3.2, 6); prop('hedge', W - 3.2, 0, Math.PI / 2, 5, 0.05);
      prop('candles', rng.range(-W / 2, 0), rng.range(-2, 2)); prop('bush', -W + 1.6, -D + 1.6, 0, 1.2);
      for (let i = 0; i < 3; i++) { const [a, b] = rng.pick(graves); guard('walker', a + 0.4, b - 1.1, 'lying', { wake: 3.8 }); }
      out.spots.rescue = P(W - 4, 0);
      break;
    }
    case 'nachtmarkt': {
      // Neon night market (2089): stalls in two loose rows facing a middle lane, crates of parts, a fire
      // barrel, string lights over the lane; the neon signs and cables over it are render dressing
      // (`mitte-world.ts`). The cable dealer trades here.
      out.ground = 'cobbles';
      for (const b of [D - 3.2, -D + 3.6]) for (let a = -W + 2.4; a < W - 2; a += rng.range(3.4, 4)) {
        const r = (b > 0 ? Math.PI : 0) + rng.range(-0.2, 0.2);
        if (rng.next() < 0.1) prop('stallBroken', a, b, r, 1, 0.3);
        else prop('stall', a + rng.range(-0.3, 0.3), b + rng.range(-0.4, 0.4), r, 1, 0.08);
      }
      prop('stringLights', 0, 0, rng.range(-0.15, 0.15), 1, 0.05);
      prop('fireBarrel', rng.pick([-1, 1]) * (W - 1.4), rng.range(-1, 1));
      for (let i = 0; i < 2; i++) prop('crates', rng.range(-W + 2, W - 2), rng.range(-1.2, 1.2), rng.range(0, 3), 0.9, 0.4);
      out.spots.trader = P(rng.range(-2, 2), 0);
      break;
    }
    case 'containerdorf': {
      // Container village (2089): shipping containers in two staggered rows along the back and one side,
      // the second tier stacked on some of them (render dressing), washing lines, a fire, bins and pallets
      // in the yard; a lane to the street stays open. Somebody sleeps in a container.
      out.ground = 'gravel';
      // A container is 2.44 × 6.1 m with its long side along its local z: the back row turns a quarter.
      for (let a = -W + 3.4; a < W - 3; a += rng.range(6.3, 6.8)) prop('container', a, -D + 1.8, Math.PI / 2 + rng.range(-0.04, 0.04), 1, 0.02);
      for (let b = -D + 6.6; b < D - 3.5; b += rng.range(6.3, 6.8)) prop('container', side * (W - 1.6), b, rng.range(-0.04, 0.04), 1, 0.02);
      prop('clothesline', -side * 2, 0.5, rng.range(-0.3, 0.3), 1, 0.2);
      prop('fireBarrel', -side * (W - 3), rng.range(1, 3));
      prop('bins', -side * (W - 1.5), D - 2.2, 0, 1, 0.3); prop('pallets', rng.range(-2, 2), D - 3.5, rng.range(0, 3), 1, 0.4);
      prop('crates', rng.range(-3, 3), -D + 4.8, rng.range(0, 3), 1, 0.4);
      guard('runner', side * (W - 1.6), -D + 6.6, 'hidden', { elite: true, hp: 1.8, wake: 4 });
      out.spots.cache = P(-side * (W - 3), -D + 4.5);
      break;
    }
    case 'clubhof': {
      // Club yard (2089): a Vorderhaus with a Durchfahrt, the club in the back house (its yard door is the
      // club door, neon by `mitte-zones.ts`), speaker stacks beside it, a queue of posts from the gate to the
      // door with ghouls still standing in line (playing dead), a fire barrel. Cache in the corner.
      out.ground = 'cobbles';
      const gx = rng.range(-W + 5, W - 5), fb = D - 5, cb = -D + 5;
      building('altbau', -W, gx - 1.6, fb, D, 1 + rng.int(2));
      building('altbau', gx + 1.6, W, fb, D, 1 + rng.int(2));
      building('altbau', -W, W, -D, cb, 2);
      run('wall', -W + 0.2, cb, -W + 0.2, fb, [], 0.02); run('wall', W - 0.2, cb, W - 0.2, fb, [], 0.02);
      for (const sa of [-1, 1]) prop('speaker', sa * 2.4, cb + 0.7, Math.PI + rng.range(-0.15, 0.15), 1.1, 0.05);
      const qa = gx * 0.4 + 1.3;
      for (let b = cb + 2.2; b < fb - 1.2; b += 1.5) prop('bollard', qa, b, 0, 1, 0.02);
      let i = 0;
      for (let b = cb + 2.4; b < fb - 1.5 && i < 4; b += 1.7, i++) guard(i === 3 ? 'runner' : 'walker', qa - 0.8 + rng.range(-0.15, 0.15), b, 'lying', { wake: 3.8 });
      prop('fireBarrel', -side * (W - 1.6), (cb + fb) / 2 + rng.range(-1, 1));
      // A storm lantern in the Durchfahrt, where the queue begins.
      prop('stormLantern', gx + 1.1, D - 0.9, 0, 1, 0);
      prop('crates', side * (W - 1.6), cb + 1.4, rng.range(0, 3), 1, 0.3); prop('bins', side * (W - 1.4), fb - 1.4, Math.PI / 2, 1, 0.2);
      prop('rubble', -side * (W - 3), cb + 1.2, 0, rng.range(0.5, 0.8));
      out.spots.cache = P(side * (W - 2.2), cb + 2.6); out.spots.rescue = P(-side * (W - 3), fb - 1.6);
      break;
    }
    case 'sperrzone': {
      // Checkpoint zone in front of a Bundesbau (2089): a sandbag wall at the back, a barrier line with a gap
      // (the holo band over it is render dressing), tank traps, a camera pole and a work lamp as the
      // searchlight. Few fires; somebody waits behind the sandbags. Cache behind the wall.
      out.ground = 'asphalt';
      const gap = rng.range(-W / 3, W / 3);
      for (let a = -W + 1.4; a < W - 1; a += 2.2) if (Math.abs(a - gap) > 1.6) prop('sandbags', a, -D + 2.6, rng.range(-0.08, 0.08), 1, 0.04);
      const hb = rng.range(-1, 1.5);
      prop('barrier', (-W + 1 + gap - 1.8) / 2, hb, 0, gap - 1.8 + W - 1, 0.01);
      prop('barrier', (gap + 1.8 + W - 1) / 2, hb, 0, W - 1 - gap - 1.8, 0.01);
      for (let k = 0; k < 3; k++) prop('tankTrap', rng.range(-W + 2.5, W - 2.5), rng.range(hb + 2.2, D - 2), rng.range(0, 3), 1, 0.4);
      prop('camPole', side * (W - 1), D - 1.2, Math.PI + side * 0.6, 1, 0.1);
      prop('workLamp', -side * (W - 1.5), -D + 4.4, side * 0.5, 1, 0.2); prop('workLamp', -side * (W - 1.4), D - 1.3, Math.PI - side * 0.5, 1, 0.2);
      prop('crates', gap + rng.range(-1, 1), -D + 1.2, rng.range(0, 3), 1, 0.3);
      guard('spitter', -side * rng.range(1, W - 3), -D + 1.3, 'hidden', { wake: 4.5 });
      out.spots.cache = P(side * (W - 2.5), -D + 1.2);
      break;
    }
    case 'zeltlager': {
      // Tent camp in the Tiergarten: tents round a cooking fire, tarps and a washing line, crates and a few
      // pallets. Survivors live here (rescue and trader spots by the fire); calm, nobody sleeps on guard.
      out.ground = 'dirt';
      const n = 5 + rng.int(2);
      for (let k = 0; k < n; k++) {
        const t = (k / n) * Math.PI * 2 + rng.range(-0.2, 0.2), ra = W - 3.2, rb = D - 3;
        const a = Math.sin(t) * ra, b = Math.cos(t) * rb;
        prop('tent', a, b, t + Math.PI / 2 + rng.range(-0.25, 0.25), rng.range(0.85, 1.05), 0.05);
      }
      prop('campfire', rng.range(-0.6, 0.6), rng.range(-0.6, 0.6), 0, 1, 0.3);
      prop('clothesline', rng.range(-2, 2), -D + 1.5, rng.range(-0.25, 0.25), rng.range(6, 8), 0.1);
      prop('crates', rng.range(-W + 2, W - 2), D - 1.2, rng.range(0, 3), 1, 0.4); prop('pallets', -side * (W - 1.3), rng.range(-2, 2), Math.PI / 2, 1, 0.3);
      prop('planks', side * (W - 1.5), -D + 2.2, 0.8);
      out.spots.trader = P(rng.range(-1.5, 1.5), 2.2); out.spots.rescue = P(rng.range(-1.5, 1.5), -2.2);
      break;
    }
    case 'lichtung': {
      // A clearing with a small beer garden: beer sets in loose rows, string lights between the trees, beer
      // crates, a barrel fire. The last guests are still here, playing dead under the tables.
      out.ground = undefined;
      for (const [a, b] of [[-W + 2, D - 2], [W - 2, D - 2.2], [-W + 1.8, -D + 2], [W - 2.2, -D + 1.8]] as Pt[]) tree(a, b, rng.range(5, 6.5));
      const sets: Pt[] = [];
      for (const b of [-2.8, 2.2]) for (const a of [-4.2, 0, 4.2]) if (rng.next() < 0.85) sets.push([a + rng.range(-0.6, 0.6), b + rng.range(-0.5, 0.5)]);
      for (const [a, b] of sets) prop('beerTable', a, b, rng.range(-0.25, 0.25), 1, 0.05);
      prop('stringLights', 0, -0.4, rng.range(-0.15, 0.15), W * 2 - 4, 0.05);
      prop('fireBarrel', side * (W - 1.8), rng.range(-1, 1)); prop('crates', -side * (W - 2), rng.range(-1.5, 1.5), rng.range(0, 3), 1, 0.4);
      for (let k = 0; k < Math.min(3, sets.length); k++) { const [a, b] = sets[k * 2 % sets.length]!; guard('walker', a + 0.4, b + (b > 0 ? 1.3 : -1.3), 'lying', { wake: 4 }); }
      out.spots.cache = P(-side * (W - 2.4), D - 3.5);
      break;
    }
    case 'glashaus': {
      // GDR clockwork gardens: one or two glass houses on brick bases, beds in rows, sunflowers that grew
      // wild, a garden shed and a water barrel. The gardener trades here; a Kernspeier waits in the flowers.
      out.ground = 'dirt';
      const two = W > 9.5;
      const houses = two ? [-W / 2 + 0.2, W / 2 - 0.2] : [rng.range(-1.5, 1.5)];
      for (const a of houses) prop('greenhouse', a, -D / 2 + 0.6, Math.PI / 2 + rng.range(-0.05, 0.05), two ? 0.95 : 1.1, 0.05);
      for (let a = -W + 2; a < W - 1.5; a += rng.range(2.2, 2.8)) prop('gardenBed', a, D - 3.6 + rng.range(-0.4, 0.4), Math.PI / 2, 1, 0.1);
      for (let i = 0; i < 5; i++) prop('sunflowers', rng.range(-W + 1.5, W - 1.5), rng.pick([D - 1.4, 0.8, -D + 1.2]) + rng.range(-0.5, 0.5), rng.range(0, 6), rng.range(0.8, 1.2), 1);
      prop('shed', side * (W - 1.8), D - 6.2, side > 0 ? -Math.PI / 2 : Math.PI / 2, 1, 0.2);
      prop('fireBarrel', -side * (W - 1.4), 1.2); prop('crates', side * (W - 2.2), 0.6, rng.range(0, 2), 1, 0.4);
      run('picket', -W + 0.3, D - 0.3, W - 0.3, D - 0.3, [[W - 2, W + 2]]);
      out.spots.trader = P(0, 1.6); out.spots.cache = P(-side * (W - 2), -D + 1.4);
      guard('spitter', rng.range(-W + 3, W - 3), D - 1.6, 'hidden', { elite: rng.next() < 0.4, hp: 1.6, wake: 4 });
      break;
    }
    case 'plattenhof': {
      // The yard between two Plattenbau slabs: the rocket climbing frame, a sandbox, benches, clotheslines,
      // bins and a parked car; the dead lie between the swings.
      out.ground = 'asphalt';
      building('shop', -W + 0.2, -W + 6.2, -D, -D + 5, 0);
      prop('climber', side * rng.range(1.5, 3.5), rng.range(-1.5, 1.5), rng.range(0, 6), 1, 0.05);
      run('lowWall', -side * 5, -D / 2 - 1.5, -side * 1.5, -D / 2 - 1.5, [], 0.02);
      run('lowWall', -side * 5, -D / 2 + 2, -side * 1.5, -D / 2 + 2, [], 0.02);
      prop('bench', -side * 3.2, D - 3, Math.PI, 1, 0.1); prop('bench', side * (W - 2.5), -1, side > 0 ? -Math.PI / 2 : Math.PI / 2, 1, 0.1);
      prop('clothesline', rng.range(-2, 2), -D + 2.4, rng.range(-0.3, 0.3), rng.range(6, 9), 0.1);
      prop('bins', W - 2, D - 1.6, Math.PI, 1, 0.12); prop('bikes', -W + 2.4, D - 1.8, Math.PI, 1, 0.3);
      prop('car', side * (W - 2.6), D - 4.4, rng.range(-0.3, 0.3), 1, 0.1);
      tree(-side * (W - 3), 1.5, 5); tree(side * 1, -D + 4.5, 4.5);
      out.spots.rescue = P(-side * 3, 0); out.spots.cache = P(-W + 3.2, -D + 2.6);
      for (let i = 0; i < 3; i++) guard(i === 0 ? 'brute' : 'walker', rng.range(-W + 3, W - 3), rng.range(-D + 3, D - 4), 'lying', { wake: 4.2, elite: i === 0 && rng.next() < 0.5, hp: i === 0 ? 1.8 : 1 });
      break;
    }
  }
  return out;
}
