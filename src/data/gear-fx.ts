// WP4 step 5 (P31, D5): how legendary and set items show beyond their model. Glow edge (emissive parts in the
// weapon's or the gear's glow mesh, one pulse uniform), ambient particles and the proc flash, both drawn from
// one shared sprite pool (`src/render/gear-fx.ts`, 1 draw call, no light). Plain data, no Three.js.
// Values are start values (task file Step 5 table). G3 (Johannes, 2026-11-27): variant B, glow edge plus sparse
// particles and proc flashes; A (glow edge only) and C (plus a ground aura and a set shimmer) are gone.
import type { HeroLook } from './hero-look';
import type { LegendaryId, SlotId } from './items';

/** Sprites in the pool per profile (D3: 48 on Qualität, 24 on the lighter levels). */
export const GEAR_FX_SPRITES = { qualitaet: 48, ausgewogen: 24, leistung: 24 } as const;
/** At most this many ambient emitters at once: the weapon, the armor and one more (D5). */
export const GEAR_FX_EMITTERS = 3;

/** Sprite shapes (the shader branches on them). `ring` lies on the ground. */
export type FxSprite = 'dot' | 'glint' | 'feather' | 'drop' | 'ring';

/**
 * Where an item's effect sits on the hero.
 * - `weapon`: along the weapon model's +Y between `y0` and `y1` (model meters, grip at 0), `r` jitter.
 * - `gear`: inside the bounding sphere of the glow parts of gear `id` (the Pickelhaube's spike, the Späti's patches).
 * - `bone`: at the bind position of `bone` plus `off` (bind space: +Y up, +Z front, the hero's left +X), `r` jitter;
 *   with `to` anywhere on the line to that bone (along the forearm).
 * - `feet`: at one of the two feet. `shots`: at the hero's flying shots.
 */
export type FxAnchor =
  | { readonly at: 'weapon'; readonly y0: number; readonly y1: number; readonly r: number }
  | { readonly at: 'gear'; readonly id: string }
  | { readonly at: 'bone'; readonly bone: string; readonly off?: readonly [number, number, number]; readonly to?: string; readonly r: number }
  | { readonly at: 'feet' }
  | { readonly at: 'shots' };

/** Ambient particles: sprites per second at 48 sprites (halved on 24), life in s, size in m. */
export interface FxAmbient {
  readonly sprite: FxSprite;
  readonly color: string;
  readonly rate: number;
  readonly life: number;
  readonly size: number;
  /** Upward speed in m/s (negative sinks). */
  readonly rise: number;
  readonly gravity?: number;
  /** Random sideways speed in m/s. */
  readonly spread?: number;
  /** 0 adds light (default), 1 covers what is behind (a dark feather). */
  readonly body?: number;
  /** Only while the hero dodges, or while the Weltzeituhr's crit is armed. */
  readonly when?: 'dodge' | 'armed';
  /** Own anchor, else the item's. */
  readonly anchor?: FxAnchor;
}

/** A steady glow sprite: the glow of an item that has no 3D model (talisman, ring, implant). */
export interface FxSteady {
  readonly sprite: 'dot' | 'glint';
  readonly size: number;
  /** Heartbeat (two quick pulses) instead of the slow pulse. */
  readonly beat?: boolean;
  /** How many sprites along the anchor (bassarm: three along the forearm). */
  readonly count?: number;
}

/** What a proc flash shows (`gear-fx.ts` builds each from the pool). */
export type FxBurst = 'embers' | 'sparks' | 'splash' | 'dust' | 'glint' | 'flash' | 'sheen' | 'pulse';

/**
 * Proc flash. `legendaryProc`: the sim event of that power (`LEGENDARY_PROC_SITES`); `secondWind`, `eliteHit`
 * (a hit on an elite or boss) and `armed` (the Weltzeituhr's crit arms after a dodge) use what the sim already reports.
 * `at`: the event's ground point (hit height), the item's anchor, or both.
 */
export interface FxProc {
  readonly on: 'legendaryProc' | 'secondWind' | 'eliteHit' | 'armed';
  readonly burst: FxBurst;
  readonly color: string;
  readonly count: number;
  readonly at: 'event' | 'anchor' | 'both';
}

export interface GearFxDef {
  readonly slot: SlotId;
  /** Signature colour (the glow edge). */
  readonly color: string;
  readonly anchor: FxAnchor;
  /** Extra glow parts on the hero (gear ids, `src/render/gear-fx-parts.ts`), added to the look. */
  readonly gear?: string;
  /** Which glow pulses and flares on a proc. */
  readonly glow?: 'weapon' | 'gear';
  readonly steady?: FxSteady;
  readonly ambient?: readonly FxAmbient[];
  readonly proc?: FxProc;
}

/** Legendaries whose power pushes `{ type: 'legendaryProc' }` at its rule site (a unit test each, no rule change). */
export const LEGENDARY_PROC_SITES = ['turm', 'zitklinge', 'mauer', 'pbrecher', 'siegsp', 'panzer', 'rattenmantel', 'ritter', 'kiezbox', 'bassarm'] as const satisfies readonly LegendaryId[];

const CHEST: FxAnchor = { at: 'bone', bone: 'spine_03', off: [0, -0.05, 0.15], r: 0 };

/** Every row of the task file's Step 5 table. Die Letzte Bestellung and Telespargel keep their glow (M18, M17). */
export const GEAR_FX: Readonly<Partial<Record<LegendaryId, GearFxDef>>> = {
  // Weapons: the glow edge is part of the model (`SIG` paints in weapons.ts); the weapon glow pulses.
  turm: {
    slot: 'w', color: '#5aa8ff', glow: 'weapon', anchor: { at: 'weapon', y0: 0.3, y1: 0.8, r: 0.05 },
    ambient: [{ sprite: 'glint', color: '#a8d4ff', rate: 2.4, life: 0.6, size: 0.075, rise: 0.12, spread: 0.05 }],
    proc: { on: 'legendaryProc', burst: 'embers', color: '#ff7a2a', count: 14, at: 'both' },
  },
  zitklinge: {
    slot: 'w', color: '#7dd3ff', glow: 'weapon', anchor: { at: 'weapon', y0: 0.2, y1: 0.84, r: 0.035 },
    // Crackle: short bright flickers on the edges.
    ambient: [{ sprite: 'glint', color: '#bfeaff', rate: 4, life: 0.12, size: 0.06, rise: 0 }],
    proc: { on: 'legendaryProc', burst: 'sparks', color: '#9fe0ff', count: 10, at: 'event' },
  },
  mauer: {
    slot: 'w', color: '#97c459', glow: 'weapon', anchor: { at: 'weapon', y0: 0.96, y1: 1.12, r: 0.1 },
    ambient: [{ sprite: 'drop', color: '#9be05a', rate: 1.6, life: 0.8, size: 0.05, rise: 0, gravity: -5 }],
    proc: { on: 'legendaryProc', burst: 'splash', color: '#a8e060', count: 14, at: 'anchor' },
  },
  pbrecher: {
    slot: 'w', color: '#ff7a2a', glow: 'weapon', anchor: { at: 'weapon', y0: 0.96, y1: 1.16, r: 0.1 },
    proc: { on: 'legendaryProc', burst: 'dust', color: '#c8b8a0', count: 14, at: 'event' },
  },
  ring: {
    slot: 'w', color: '#ff8a3d', glow: 'weapon', anchor: { at: 'weapon', y0: 0.22, y1: 0.28, r: 0.025 },
    // Sparks between the prongs; the proc is the existing chain bolt.
    ambient: [{ sprite: 'glint', color: '#ffc080', rate: 3, life: 0.14, size: 0.05, rise: 0 }],
  },
  kraehe: {
    slot: 'w', color: '#97c459', glow: 'weapon', anchor: { at: 'weapon', y0: 0.1, y1: 0.2, r: 0.05 },
    ambient: [
      { sprite: 'feather', color: '#1c1c24', body: 1, rate: 0.4, life: 2.2, size: 0.08, rise: -0.25, spread: 0.3 },
      // Green trail behind every shot (rate per shot).
      { sprite: 'dot', color: '#97c459', rate: 30, life: 0.3, size: 0.08, rise: 0, anchor: { at: 'shots' } },
    ],
  },
  siegsp: {
    slot: 'w', color: '#f2d14b', glow: 'weapon', anchor: { at: 'weapon', y0: 1.55, y1: 1.72, r: 0.02 },
    proc: { on: 'legendaryProc', burst: 'glint', color: '#ffe9a0', count: 4, at: 'anchor' },
  },
  // Armor and hats: glow edges as gear parts in `gear glow`, one pulse uniform. Armor effects anchor to bones, so
  // they stay under an AI outfit (W10, which drops the armor's code gear and with it `fx-spaeti`, fitted to the code coat).
  spaeti: {
    slot: 'a', color: '#ffb060', glow: 'gear', gear: 'fx-spaeti', anchor: { at: 'bone', bone: 'spine_02', off: [0, 0.04, 0.13], r: 0.16 },
    ambient: [{ sprite: 'dot', color: '#ffc27a', rate: 1.6, life: 1.4, size: 0.05, rise: 0.28, spread: 0.06 }],
  },
  panzer: {
    slot: 'a', color: '#e8eef4', anchor: CHEST,
    proc: { on: 'legendaryProc', burst: 'flash', color: '#ffffff', count: 6, at: 'anchor' },
  },
  rattenmantel: {
    slot: 'a', color: '#97c459', anchor: { at: 'bone', bone: 'spine_02', r: 0.28 },
    proc: { on: 'legendaryProc', burst: 'sheen', color: '#a8e070', count: 14, at: 'anchor' },
  },
  ritter: {
    slot: 'a', color: '#c8c0b0', anchor: { at: 'feet' },
    proc: { on: 'legendaryProc', burst: 'dust', color: '#c8bca8', count: 14, at: 'event' },
  },
  pickel: {
    slot: 'h', color: '#ffe8a0', glow: 'gear', anchor: { at: 'gear', id: 'hat-pickel' },
    ambient: [{ sprite: 'glint', color: '#fff0c0', rate: 0.7, life: 0.35, size: 0.14, rise: 0 }],
  },
  kiezbox: {
    slot: 'g', color: '#ff5a3a', anchor: { at: 'bone', bone: 'hand_r', r: 0.03 },
    proc: { on: 'legendaryProc', burst: 'flash', color: '#fff0c0', count: 8, at: 'event' },
  },
  schaffner: {
    slot: 'f', color: '#5aa8ff', anchor: { at: 'feet' },
    // Only while rolling; bigger dots than the rest (the per-item sheet showed 0.09 m lost in the roll's dust).
    ambient: [{ sprite: 'dot', color: '#6ab4ff', rate: 48, life: 0.4, size: 0.14, rise: 0.1, when: 'dodge' }],
  },
  // Ring, talismans, implant: no 3D model (step 2 decision); their glow is a steady sprite at the bone.
  weltuhr: {
    slot: 'r', color: '#ffe0a0', anchor: { at: 'bone', bone: 'ring_01_l', to: 'ring_02_l', r: 0 },
    steady: { sprite: 'glint', size: 0.07 },
    ambient: [{ sprite: 'glint', color: '#fff2c8', rate: 3, life: 0.25, size: 0.18, rise: 0, when: 'armed' }],
    proc: { on: 'armed', burst: 'glint', color: '#fff2c8', count: 3, at: 'anchor' },
  },
  herz: {
    slot: 't', color: '#3ad1c0', anchor: CHEST,
    steady: { sprite: 'dot', size: 0.16, beat: true },
    proc: { on: 'secondWind', burst: 'pulse', color: '#5fe8d6', count: 16, at: 'anchor' },
  },
  auge: {
    slot: 't', color: '#43d1cf', anchor: CHEST,
    steady: { sprite: 'dot', size: 0.1 },
    proc: { on: 'eliteHit', burst: 'pulse', color: '#7ff0ee', count: 6, at: 'anchor' },
  },
  bassarm: {
    slot: 'i', color: '#ff4fa3', anchor: { at: 'bone', bone: 'lowerarm_l', to: 'hand_l', r: 0.015 },
    steady: { sprite: 'dot', size: 0.06, count: 3 },
    proc: { on: 'legendaryProc', burst: 'pulse', color: '#ff7ac0', count: 10, at: 'anchor' },
  },
};

/** Slot order for the emitter budget: the weapon, the armor, then one more in this order. */
export const FX_SLOT_ORDER: readonly SlotId[] = ['w', 'a', 'h', 'g', 'f', 't', 'r', 'i'];

/** The fx defs of the equipped legendaries, in `FX_SLOT_ORDER`. */
export function equippedFx(legendary: readonly LegendaryId[]): Array<{ id: LegendaryId; def: GearFxDef }> {
  const out = legendary.flatMap((id) => { const def = GEAR_FX[id]; return def ? [{ id, def }] : []; });
  return out.sort((a, b) => FX_SLOT_ORDER.indexOf(a.def.slot) - FX_SLOT_ORDER.indexOf(b.def.slot));
}

/**
 * The look with the glow parts of the equipped legendaries added (sorted like `heroLook`). An armor's glow part counts
 * as armor gear: it is fitted to the code coat, so an AI outfit (W10) drops it with the rest of the armor's gear.
 */
export function fxLook(look: HeroLook, legendary: readonly LegendaryId[]): HeroLook {
  const fx = equippedFx(legendary).filter(({ def }) => !!def.gear);
  if (!fx.length) return look;
  const armor = fx.filter(({ def }) => def.slot === 'a').map(({ def }) => def.gear!);
  return { ...look, gear: [...look.gear, ...fx.map(({ def }) => def.gear!)].sort(), armorGear: [...look.armorGear, ...armor] };
}
