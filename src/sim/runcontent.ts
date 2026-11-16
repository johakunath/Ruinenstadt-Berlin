// Run content (M16; 2D js/state.js event plan, js/combat.js `startEvent`, js/update.js): events on
// the way between encounters, the supply drop, hidden blessings, Litfaßsäule shrines and the trader.
// 2D scheduled by wave; here every stretch between two encounters ("leg") can carry one event, so a
// run sees every event type once. Places are 2D pixel distances at 30 px per meter.
import { CONSUMABLES } from '../data/crafting';
import { difficultyOf } from '../data/difficulty';
import { PX } from '../data/powers';
import { SHRINES, SURVIVORS, type ShrineId, type SurvivorId } from '../data/progression';
import { offerBlessings } from './blessings';
import { ELITE_MODS } from '../data/enemies';
import { pk } from './combat';
import { makeElite, spawnEnemy } from './enemies';
import { BAG_SIZE } from './inventory';
import { lootItem, makeItem, price, type Item } from './items';
import type { Level } from './level';
import { setLoadout } from './loadout';
import { creditScrap, lootContext, lootLevel, MATERIAL_IDS, spawnDrop } from './loot';
import { Rng } from './math';
import { enclosure, freeSpot, reachable } from './reach';
import { restAt } from './rest';
import { DT, type Sim } from './types';

export type RunEventKind = 'ambush' | 'trader' | 'zone' | 'cache' | 'horde' | 'rescue';
export interface TradeOffer { item: Item; price: number }

export interface RunContent {
  /** Event per leg; index = the encounter the hero walks to. */
  plan: Array<RunEventKind | 'crate' | null>;
  done: boolean[];
  /** Seconds until this leg's event starts (2D `evIn`). */
  timer: number;
  hidden: Array<{ x: number; z: number; got: boolean }>;
  shrines: Array<{ x: number; z: number; used: boolean }>;
  /** Seconds left per shrine buff. */
  shrine: Partial<Record<ShrineId, number>>;
  trader: { x: number; z: number; t: number; offers: Array<TradeOffer | null>; left: boolean } | null;
  /** The trade screen is open: the game loop pauses the sim. */
  tradeOpen: boolean;
  /** Who is trading: -1 the wandering trader, else the Späti with this rest index. */
  tradeAt: number;
  /** Späti stock per rest index, rolled on the first visit of a run (M13b). */
  shops: Array<{ offers: Array<TradeOffer | null>; left: boolean } | null>;
  captive: { x: number; z: number; survivor: SurvivorId; free: boolean } | null;
  cache: { x: number; z: number; t: number } | null;
  zone: { x: number; z: number; r: number; p: number; need: number; t: number; sp: number } | null;
  crate: { x: number; z: number; t: number } | null;
  rng: number;
}

export const CONTENT = {
  delay: 5, touch: 34 * PX, hiddenTouch: 1.2, hiddenApart: 700 * PX, shrineTouch: 46 * PX, shrineTime: 60,
  trader: { near: 260 * PX, far: 480 * PX, time: 60, touch: 1.5 },
  /** Späti counter: stand this close to the customer spot; no trade while enemies are this near. */
  shop: { touch: 1.1, calm: 12, offers: 4 },
  cache: { near: 520 * PX, far: 760 * PX, time: 50, scrap: 25 },
  zone: { near: 240 * PX, far: 420 * PX, radius: 70 * PX, need: 8, time: 45, every: 2.2, scrap: 30 },
  rescue: { near: 320 * PX, far: 520 * PX, touch: 36 * PX },
  crate: { near: 360 * PX, far: 600 * PX, time: 28, scrap: 15 },
  ambush: { ring: 190 * PX },
  /** Legs with the supply drop when no event took them (2D waves 5 and 14 of 20). */
  crateLegs: [3, 9],
} as const;

export const EVENT_TEXT: Record<RunEventKind | 'crate', { title: string; sub: string; color: string }> = {
  ambush: { title: 'Hinterhalt!', sub: '', color: '#e05050' },
  horde: { title: 'Hetzerflut!', sub: '', color: '#e05050' },
  trader: { title: 'Händler in der Nähe', sub: 'Folge dem Pfeil', color: '#8fd16a' },
  rescue: { title: 'Hilferufe', sub: 'Besiege die Wachen', color: '#ead9c0' },
  cache: { title: 'Schatzkarte', sub: 'Versteck in der Nähe · 50 s', color: '#f2d14b' },
  zone: { title: 'Funksignal', sub: 'Halte die Zone 8 s', color: '#7dd3ff' },
  crate: { title: 'Nachschub abgeworfen', sub: 'Folge dem Pfeil', color: '#f2d14b' },
};

const emptyContent = (): RunContent => ({
  plan: [], done: [], timer: CONTENT.delay, hidden: [], shrines: [], shrine: {}, trader: null, tradeOpen: false, tradeAt: -1, shops: [],
  captive: null, cache: null, zone: null, crate: null, rng: 1,
});

const freeSurvivors = (s: Sim): SurvivorId[] => SURVIVORS.map((v) => v.id).filter((id) => !s.statContext.survivors[id]);

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

const inFight = (L: Level, x: number, z: number, pad: number): boolean => L.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + pad);

/** Distance to the straight lines between consecutive encounters (a stand-in for "near the route"). */
function routeDist(L: Level, x: number, z: number): number {
  let best = Infinity;
  const pts = [L.start, ...L.encounters];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

/** Plans a run: which leg gets which event, where the hidden blessings and shrines are. Seeded. */
export function createContent(s: Sim, seed: number): RunContent {
  const c = emptyContent();
  const L = s.level;
  if (!L.expedition) return c;
  const rng = new Rng((seed ^ 0x5bd1e995) >>> 0);
  const legs = L.encounters.length;
  const kinds: RunEventKind[] = shuffle(rng, ['ambush', 'trader', 'zone', 'cache', 'horde', 'rescue']);
  // Funkmast: one more event per run.
  if (s.statContext.camp.funk) kinds.push(rng.pick(['ambush', 'cache', 'zone', 'horde'] as const));
  const slots = shuffle(rng, Array.from({ length: legs - 1 }, (_, i) => i + 1)).slice(0, kinds.length);
  c.plan = Array.from({ length: legs }, () => null);
  slots.forEach((leg, i) => { c.plan[leg] = kinds[i]!; });
  for (const leg of CONTENT.crateLegs) if (leg < legs && !c.plan[leg]) c.plan[leg] = 'crate';
  c.done = c.plan.map(() => false);

  const b = L.bounds;
  const sample = (ok: (x: number, z: number) => boolean, score: (x: number, z: number) => number): { x: number; z: number } | null => {
    let best: { x: number; z: number } | null = null;
    let bs = -Infinity;
    for (let t = 0, found = 0; t < 900 && found < 14; t++) {
      const x = rng.range(b.minX + 4, b.maxX - 4);
      const z = rng.range(b.minZ + 4, b.maxZ - 4);
      if (!reachable(L, x, z) || inFight(L, x, z, 4) || restAt(L.rests, x, z) >= 0 || !ok(x, z)) continue;
      found++;
      const sc = score(x, z);
      if (sc > bs) {
        bs = sc;
        best = { x, z };
      }
    }
    return best;
  };
  // Hidden blessings (2D `hidSpots`): three, far from the start and from each other, in corners off the route.
  for (let i = 0; i < 3; i++) {
    const spot = sample(
      (x, z) => Math.hypot(x - L.start.x, z - L.start.z) > CONTENT.hiddenApart && !c.hidden.some((h) => Math.hypot(h.x - x, h.z - z) < CONTENT.hiddenApart * 2)
        && routeDist(L, x, z) > 9 && routeDist(L, x, z) < 34 && reachable(L, x + 0.8, z) && reachable(L, x - 0.8, z) && reachable(L, x, z + 0.8) && reachable(L, x, z - 0.8),
      (x, z) => enclosure(L, x, z),
    );
    if (spot) c.hidden.push({ ...spot, got: false });
  }
  // Shrines (2D Litfaßsäule): three columns in the open beside the route.
  for (let i = 0; i < 3; i++) {
    const spot = sample(
      (x, z) => routeDist(L, x, z) > 3 && routeDist(L, x, z) < 13 && !c.shrines.some((h) => Math.hypot(h.x - x, h.z - z) < 60)
        && Math.hypot(x - L.start.x, z - L.start.z) > 25 && !c.hidden.some((h) => Math.hypot(h.x - x, h.z - z) < 10),
      (x, z) => -enclosure(L, x, z, 2),
    );
    if (spot) {
      c.shrines.push({ ...spot, used: false });
      L.add({ kind: 'circle', x: spot.x, z: spot.z, r: 0.5 });
    }
  }
  c.rng = rng.state;
  return c;
}

/** Wave strength for event enemies: the tier of the encounter ahead. */
function tier(s: Sim): { hp: number; dmg: number } {
  const enc = s.level.encounters[Math.min(s.run.index, s.level.encounters.length - 1)];
  const w = enc?.waves[0];
  const df = difficultyOf(s.difficulty);
  return { hp: (w?.hpMul ?? 1) * df.hp, dmg: (w?.dmgMul ?? 1) * df.dmg };
}

const waveE = (s: Sim): number => Math.max(1, s.lootWaves) / 2;
export const healPrice = (s: Sim): number => 20 + Math.round(waveE(s) * 4);

/** The three guards of the captive (one elite). Also called when a checkpoint with an unfinished rescue is loaded. */
export function spawnGuards(s: Sim, rng: Rng = new Rng(s.content.rng)): void {
  const C = s.content.captive;
  if (!C || C.free) return;
  const L = s.level;
  const T = tier(s);
  for (let i = 0; i < 3; i++) {
    const q = freeSpot(L, rng, C.x, C.z, 1.2, 2.6, 0.5, (x, z) => !inFight(L, x, z, 3) && restAt(L.rests, x, z) < 0) ?? C;
    const g = spawnEnemy(s, q.x, q.z, i === 0 ? 'brute' : rng.pick(['walker', 'walker', 'runner'] as const), T.hp, T.dmg);
    if (i === 0) makeElite(s, g, rng.pick(ELITE_MODS));
    g.guard = true;
  }
}

function startEvent(s: Sim, kind: RunEventKind | 'crate', rng: Rng): void {
  const c = s.content;
  const p = s.player;
  const L = s.level;
  const T = tier(s);
  const clearOf = (x: number, z: number): boolean => !inFight(L, x, z, 3) && restAt(L.rests, x, z) < 0;
  const spot = (near: number, far: number, room: number): { x: number; z: number } | null => freeSpot(L, rng, p.x, p.z, near, far, room, clearOf);
  let at: { x: number; z: number } | null = { x: p.x, z: p.z };
  switch (kind) {
    case 'ambush': {
      const n = Math.min(10, 4 + Math.round(waveE(s) / 2));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let x = p.x + Math.sin(a) * CONTENT.ambush.ring;
        let z = p.z + Math.cos(a) * CONTENT.ambush.ring;
        if (!reachable(L, x, z)) {
          const q = spot(5, 8.7, 0.5);
          if (!q) continue;
          x = q.x;
          z = q.z;
        }
        spawnEnemy(s, x, z, rng.next() < 0.7 ? 'walker' : 'brute', T.hp, T.dmg);
      }
      break;
    }
    case 'horde': {
      // 2D floods rats from one side; the 3D roster's small fast body is the Hetzer, at half life.
      const n = Math.min(14, 8 + Math.round(waveE(s)));
      const from = spot(12, 17, 1) ?? at;
      for (let i = 0; i < n; i++) {
        const q = freeSpot(L, rng, from.x, from.z, 0, 4, 0.4, clearOf);
        if (q) spawnEnemy(s, q.x, q.z, 'runner', T.hp * 0.5, T.dmg);
      }
      break;
    }
    case 'trader': {
      at = spot(CONTENT.trader.near, CONTENT.trader.far, 1.2);
      if (!at) break;
      const il = Math.max(lootLevel(s), ...Object.values(s.equipment).map((it) => it?.itemLevel ?? 0)) + 2;
      const ctx = lootContext(s);
      const n = (s.statContext.survivors.kurier ? 4 : 3) + ((s.inventory.camp?.stations.kom ?? 1) >= 3 ? 1 : 0);
      const offers: TradeOffer[] = [];
      for (let i = 0; i < n; i++) {
        const item = makeItem(rng, ctx, il + (i === 2 ? 2 : 0), i === 2 && rng.next() < 0.15 ? 3 : 2);
        offers.push({ item, price: price(item) * 5 + 15 });
      }
      c.trader = { ...at, t: CONTENT.trader.time, offers, left: true };
      break;
    }
    case 'rescue': {
      const free = freeSurvivors(s);
      if (!free.length) {
        startEvent(s, 'cache', rng);
        return;
      }
      at = spot(CONTENT.rescue.near, CONTENT.rescue.far, 2);
      if (!at) break;
      c.captive = { ...at, survivor: rng.pick(free), free: false };
      spawnGuards(s, rng);
      break;
    }
    case 'cache':
      at = spot(CONTENT.cache.near, CONTENT.cache.far, 1);
      if (at) c.cache = { ...at, t: CONTENT.cache.time };
      break;
    case 'zone':
      at = spot(CONTENT.zone.near, CONTENT.zone.far, 2.4);
      if (at) c.zone = { ...at, r: CONTENT.zone.radius, p: 0, need: CONTENT.zone.need, t: CONTENT.zone.time, sp: 0 };
      break;
    case 'crate':
      at = spot(CONTENT.crate.near, CONTENT.crate.far, 1);
      if (at) c.crate = { ...at, t: CONTENT.crate.time };
      break;
  }
  if (at) s.events.push({ type: 'runEvent', kind, phase: 'start', x: at.x, z: at.z });
}

/** Marks on the HUD: where the open events are. */
export function contentMarks(s: Sim): Array<{ x: number; z: number; kind: RunEventKind | 'crate'; t: number }> {
  const c = s.content;
  const out: Array<{ x: number; z: number; kind: RunEventKind | 'crate'; t: number }> = [];
  if (c.trader) out.push({ x: c.trader.x, z: c.trader.z, kind: 'trader', t: c.trader.t });
  if (c.captive) out.push({ x: c.captive.x, z: c.captive.z, kind: 'rescue', t: 0 });
  if (c.cache) out.push({ x: c.cache.x, z: c.cache.z, kind: 'cache', t: c.cache.t });
  if (c.zone) out.push({ x: c.zone.x, z: c.zone.z, kind: 'zone', t: c.zone.t });
  if (c.crate) out.push({ x: c.crate.x, z: c.crate.z, kind: 'crate', t: c.crate.t });
  return out;
}

function applyShrines(s: Sim): void {
  const c = s.content;
  setLoadout(s, s.equipment, { ...s.statContext, shrines: { as: (c.shrine.as ?? 0) > 0, res: (c.shrine.res ?? 0) > 0, spd: (c.shrine.spd ?? 0) > 0 } });
}

export function updateContent(s: Sim): void {
  const c = s.content;
  const p = s.player;
  const L = s.level;
  if (!L.expedition || p.state === 'dead') return;
  const near = (o: { x: number; z: number }, r: number): boolean => Math.hypot(o.x - p.x, o.z - p.z) < r;
  const rng = new Rng(c.rng);
  const il = lootLevel(s);

  for (const k of Object.keys(c.shrine) as ShrineId[]) {
    const t = c.shrine[k] ?? 0;
    if (t <= 0) continue;
    c.shrine[k] = t - DT;
    if (t - DT <= 0) {
      c.shrine[k] = 0;
      applyShrines(s);
      s.events.push({ type: 'note', text: `${SHRINES[k].name} verflogen`, color: '#9aa4b0', x: p.x, z: p.z });
    }
  }
  for (const h of c.shrines) {
    if (h.used || !near(h, CONTENT.shrineTouch)) continue;
    h.used = true;
    const id = rng.pick(Object.keys(SHRINES) as ShrineId[]);
    c.shrine[id] = CONTENT.shrineTime;
    applyShrines(s);
    s.events.push({ type: 'shrine', id, x: h.x, z: h.z });
  }
  for (const h of c.hidden) {
    if (h.got || !near(h, CONTENT.hiddenTouch) || s.abilities.offers.length) continue;
    h.got = true;
    offerBlessings(s, true);
    s.events.push({ type: 'hidden', x: h.x, z: h.z, found: c.hidden.filter((q) => q.got).length, total: c.hidden.length });
    break;
  }

  const travel = s.run.phase === 'travel';
  const leg = s.run.index;
  if (travel && c.plan[leg] && !c.done[leg] && !s.abilities.offers.length && restAt(L.rests, p.x, p.z) < 0) {
    c.timer -= DT;
    if (c.timer <= 0) {
      c.done[leg] = true;
      c.timer = CONTENT.delay;
      startEvent(s, c.plan[leg]!, rng);
    }
  }
  const done = (kind: RunEventKind | 'crate', phase: 'done' | 'lost', o: { x: number; z: number }, text?: string): void => {
    s.events.push({ type: 'runEvent', kind, phase, x: o.x, z: o.z, text });
  };
  const ctx = (): ReturnType<typeof lootContext> => lootContext(s);

  // Späti keeper: step up to the counter to trade. Stock is rolled on the first visit.
  const at = restAt(L.rests, p.x, p.z);
  for (let i = 0; i < c.shops.length; i++) if (i !== at && c.shops[i]) c.shops[i]!.left = true;
  if (at >= 0 && L.rests[at]!.desk) {
    const desk = L.rests[at]!.desk!;
    let shop = c.shops[at] ?? null;
    if (!shop) {
      const lvl = Math.max(il, ...Object.values(s.equipment).map((it) => it?.itemLevel ?? 0)) + 2;
      const n = CONTENT.shop.offers + (s.statContext.survivors.kurier ? 1 : 0) + ((s.inventory.camp?.stations.kom ?? 1) >= 3 ? 1 : 0);
      const offers: TradeOffer[] = [];
      for (let i = 0; i < n; i++) {
        const item = makeItem(rng, ctx(), lvl + (i === n - 1 ? 2 : 0), i === n - 1 && rng.next() < 0.15 ? 3 : i < 2 ? 1 : 2);
        offers.push({ item, price: price(item) * 5 + 15 });
      }
      shop = c.shops[at] = { offers, left: true };
    }
    const close = near(desk, CONTENT.shop.touch);
    if (!close) shop.left = true;
    else if (shop.left && !c.tradeOpen && !s.enemies.some((e) => e.state !== 'dead' && Math.hypot(e.x - p.x, e.z - p.z) < CONTENT.shop.calm)) {
      shop.left = false;
      c.tradeOpen = true;
      c.tradeAt = at;
      s.events.push({ type: 'trade' });
    }
  }
  if (c.trader) {
    const T = c.trader;
    if (travel) T.t -= DT;
    const close = near(T, CONTENT.trader.touch);
    if (!close) T.left = true;
    else if (T.left && !c.tradeOpen && s.enemies.every((e) => e.state === 'dead')) {
      T.left = false;
      c.tradeOpen = true;
      c.tradeAt = -1;
      s.events.push({ type: 'trade' });
    }
    if (T.t <= 0 && !c.tradeOpen) {
      done('trader', 'lost', T);
      c.trader = null;
    }
  }
  if (c.captive) {
    const C = c.captive;
    if (!C.free && !s.enemies.some((e) => e.guard && e.state !== 'dead')) {
      C.free = true;
      s.events.push({ type: 'note', text: 'Wachen besiegt', color: '#8fd16a', x: C.x, z: C.z });
    }
    if (C.free && near(C, CONTENT.rescue.touch)) {
      const who = SURVIVORS.find((v) => v.id === C.survivor)!;
      setLoadout(s, s.equipment, { ...s.statContext, survivors: { ...s.statContext.survivors, [C.survivor]: true } });
      for (let i = 0; i < 2; i++) spawnDrop(s, C.x, C.z, { kind: 'item', item: makeItem(rng, ctx(), il + 1, 1) });
      spawnDrop(s, C.x, C.z, { kind: 'material', id: rng.pick(MATERIAL_IDS) });
      done('rescue', 'done', C, `${who.name} · ${who.description}`);
      c.captive = null;
    }
  }
  if (c.cache) {
    const C = c.cache;
    if (travel) C.t -= DT;
    if (near(C, CONTENT.touch)) {
      for (let i = 0; i < 2; i++) spawnDrop(s, C.x, C.z, { kind: 'item', item: lootItem(rng, ctx(), il + 2, 1, 0.08) });
      for (let i = 0; i < 3; i++) spawnDrop(s, C.x, C.z, { kind: 'material', id: rng.pick(MATERIAL_IDS) });
      creditScrap(s, CONTENT.cache.scrap, C.x, C.z);
      done('cache', 'done', C);
      c.cache = null;
    } else if (C.t <= 0) {
      done('cache', 'lost', C);
      c.cache = null;
    }
  }
  if (c.zone) {
    const Z = c.zone;
    if (travel) Z.t -= DT;
    if (near(Z, Z.r)) {
      Z.p += DT;
      Z.sp -= DT;
      if (Z.sp <= 0) {
        Z.sp = CONTENT.zone.every;
        const T = tier(s);
        for (let i = 0; i < 2; i++) {
          const q = freeSpot(L, rng, p.x, p.z, 220 * PX, 320 * PX, 0.5);
          if (q) spawnEnemy(s, q.x, q.z, rng.next() < 0.75 ? 'walker' : 'runner', T.hp, T.dmg);
        }
      }
    }
    if (Z.p >= Z.need) {
      for (let i = 0; i < 2; i++) spawnDrop(s, Z.x, Z.z, { kind: 'item', item: makeItem(rng, ctx(), il + 1, 1) }, rng.range(-0.7, 0.7), rng.range(-0.7, 0.7));
      creditScrap(s, CONTENT.zone.scrap, Z.x, Z.z);
      done('zone', 'done', Z);
      c.zone = null;
    } else if (Z.t <= 0) {
      done('zone', 'lost', Z);
      c.zone = null;
    }
  }
  if (c.crate) {
    const C = c.crate;
    if (travel) C.t -= DT;
    if (near(C, 1)) {
      spawnDrop(s, C.x, C.z, { kind: 'item', item: makeItem(rng, ctx(), il + 1, 2) });
      creditScrap(s, CONTENT.crate.scrap, C.x, C.z);
      done('crate', 'done', C);
      c.crate = null;
    } else if (C.t <= 0) {
      done('crate', 'lost', C);
      c.crate = null;
    }
  }
  c.rng = rng.state;
}

/** Trade screen actions (2D `tradebox`). Each returns a short German message. */
/** The stock on the table: the Späti's or the wandering trader's. */
export function tradeStock(s: Sim): Array<TradeOffer | null> {
  const c = s.content;
  return (c.tradeAt >= 0 ? c.shops[c.tradeAt]?.offers : c.trader?.offers) ?? [];
}

/** Spätis also sell Verband and Molotow (2D `CONS` prices), up to three each. */
export function buyConsumable(s: Sim, id: 'verband' | 'molotow'): { ok: boolean; text: string } {
  const cost = CONSUMABLES.find((c) => c.id === id)!.scrapCost;
  const have = s.inventory.consumables?.[id] ?? 0;
  if (have >= 3) return { ok: false, text: 'Mehr als drei trägst du nicht.' };
  if (s.inventory.scrap < cost) return { ok: false, text: `Dir fehlen ${cost - s.inventory.scrap} Schrott.` };
  s.inventory.scrap -= cost;
  s.inventory.consumables = { verband: 0, molotow: 0, ...s.inventory.consumables, [id]: have + 1 };
  return { ok: true, text: 'Gekauft.' };
}

export function buyOffer(s: Sim, i: number): { ok: boolean; text: string } {
  const stock = tradeStock(s);
  const o = stock[i];
  if (!o) return { ok: false, text: '' };
  if (s.inventory.scrap < o.price) return { ok: false, text: `Dir fehlen ${o.price - s.inventory.scrap} Schrott.` };
  if (s.inventory.bag.length >= BAG_SIZE) return { ok: false, text: 'Rucksack voll.' };
  s.inventory.scrap -= o.price;
  s.inventory.bag.push(o.item);
  stock[i] = null;
  return { ok: true, text: 'Gekauft.' };
}

export function buyHeal(s: Sim): { ok: boolean; text: string } {
  const cost = healPrice(s);
  if (s.player.hp >= s.stats.maxHp) return { ok: false, text: 'Du bist unverletzt.' };
  if (s.inventory.scrap < cost) return { ok: false, text: `Dir fehlen ${cost - s.inventory.scrap} Schrott.` };
  s.inventory.scrap -= cost;
  const amount = Math.round(s.stats.maxHp - s.player.hp);
  s.player.hp = s.stats.maxHp;
  s.events.push({ type: 'heal', amount, source: 'trader' });
  return { ok: true, text: 'Geheilt.' };
}

export function closeTrade(s: Sim): void {
  s.content.tradeOpen = false;
}

/** Scrap multiplier from the run: SERO-Sammler, Goldrausch shrine, Schrottpresse. */
export function scrapFactor(s: Sim, fromEnemy: boolean): number {
  return (1 + 0.5 * pk(s, 'scrap')) * (fromEnemy && (s.content.shrine.gold ?? 0) > 0 ? 2 : 1) * (fromEnemy && s.statContext.camp.presse ? 1.15 : 1);
}
