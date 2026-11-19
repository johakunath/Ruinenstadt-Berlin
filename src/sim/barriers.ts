// P25 Der Türsteher's neon bars at the Brandenburger Tor (decision and spec: docs/tasks/p25-neon-barriers.md).
// A passive rage rule on its own timer, beside his three specials: with the hero near the Tor the five
// passages get a pink ground strip, then shut, then stay open a while. The bars are real colliders
// (`Level.shut` / `Level.open`), so they stop bodies and shots both ways; the flow field is patched.
import { PLAYER } from '../data/combat';
import { BOSS } from '../data/enemies';
import { colliderBounds, colliderDistance } from './collide';
import type { Bounds } from './flowfield';
import { threatBy, threatHit } from './threats';
import { DT, type Enemy, type Sim } from './types';

const T = BOSS.tuersteher;

/** One step of the bar cycle; runs after `updateThreats`, so it freezes in hitstop with everything else. */
export function updateBarriers(sim: Sim): void {
  const bars = sim.level.barriers;
  if (bars.length === 0) return;
  const b = sim.barrier;
  const p = sim.player;
  const owner = sim.enemies.find((e) => e.kind === 'tuersteher' && e.rage && e.state !== 'dead');
  if (!owner || p.state === 'dead') {
    if (b.state !== 'idle') openBars(sim);
    b.state = 'idle';
    b.t = 0;
    return;
  }
  b.t = Math.max(0, b.t - DT);
  if (b.state === 'idle') {
    if (b.t > 0) return;
    const near = bars.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < T.barNear);
    const clear = bars.every((q) => colliderDistance(q.collider, owner.x, owner.z) > T.barClear + owner.def.radius);
    if (!near || !clear) return;
    b.state = 'wind';
    b.t = T.barWind;
    b.src = owner.id;
    sim.events.push({ type: 'barrier', phase: 'wind', ...mid(sim) });
    sim.events.push({ type: 'note', text: 'Kein Einlass!', color: '#ff4fa3', x: owner.x, z: owner.z });
    return;
  }
  if (b.state === 'wind') {
    if (b.t > 0) return;
    // The bar never shuts on him: the strip stays lit until he is off it.
    if (bars.some((q) => colliderDistance(q.collider, owner.x, owner.z) < owner.def.radius)) return;
    shutBars(sim, owner);
    b.state = 'shut';
    b.t = T.barTime;
    return;
  }
  if (b.t > 0) return;
  openBars(sim);
  b.state = 'idle';
  b.t = T.barEvery;
}

/** Middle passage (event position for sound and effects). */
function mid(sim: Sim): { x: number; z: number } {
  const q = sim.level.barriers[sim.level.barriers.length >> 1]!;
  return { x: q.x, z: q.z };
}

function shutBars(sim: Sim, owner: Enemy): void {
  const L = sim.level;
  const p = sim.player;
  // Standing on the strip: one hit, away from the bar plane (roll frames and the per-hit cap hold).
  const on = L.barriers.find((q) => colliderDistance(q.collider, p.x, p.z) < PLAYER.radius);
  if (on) {
    const nx = Math.sin(on.rot), nz = Math.cos(on.rot);
    const s = (p.x - on.x) * nx + (p.z - on.z) * nz >= 0 ? 1 : -1;
    threatHit(sim, owner, owner.def.damage * owner.dmgMul * T.barDamage, T.barFloor, nx * s, nz * s, threatBy(sim, 'barrier', owner.id));
  }
  for (const q of L.barriers) L.shut(q.collider);
  // Nobody is drawn inside a bar: the nearest face is a long one, so each body leaves to its own side.
  if (p.state !== 'dead') L.resolve(p, PLAYER.radius);
  for (const e of sim.enemies) if (e.state !== 'dead' && !e.def.fly) L.resolve(e, e.def.radius);
  patchFlow(sim);
  sim.events.push({ type: 'barrier', phase: 'shut', ...mid(sim) });
}

function openBars(sim: Sim): void {
  const L = sim.level;
  for (const q of L.barriers) L.open(q.collider);
  patchFlow(sim);
  sim.events.push({ type: 'barrier', phase: 'open', ...mid(sim) });
}

/** Re-marks the flow cells under all bars (a few hundred) instead of a new field; the next `setTarget` rebuilds. */
function patchFlow(sim: Sim): void {
  const area: Bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const q of sim.level.barriers) {
    const e = colliderBounds(q.collider);
    area.minX = Math.min(area.minX, e.minX);
    area.maxX = Math.max(area.maxX, e.maxX);
    area.minZ = Math.min(area.minZ, e.minZ);
    area.maxZ = Math.max(area.maxZ, e.maxZ);
  }
  sim.flow.patch(area, sim.level.inBox(area));
}
