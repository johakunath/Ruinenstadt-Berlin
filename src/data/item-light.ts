// Items that give light (WP4 step 5b, Johannes 2026-11-26: the Stirnlampe must really light the way, and
// every item that should glow does too). Pure data: the render side (`src/render/hero-lamp.ts`) turns a
// beam into a spot light ahead of the hero and a glow into a tinted, stronger hero fill light.
import type { HeroLook } from './hero-look';

export interface ItemLight {
  /** Light colour (CSS hex). */
  color: string;
  /** 0..1: how strongly it lights the surroundings. */
  strength: number;
}

/** Gear parts (`GEAR` ids) that throw a beam forward from the head. */
export const BEAM_GEAR: Readonly<Record<string, ItemLight>> = {
  // Stirnlampe des Tunnelläufers: the brass lamp on the head band.
  'hat-headlamp': { color: '#fff2b0', strength: 1 },
};

/** Weapon looks (`WEAPON_LOOKS` ids) that light up around the hero: lamps and neon tubes. */
export const GLOW_WEAPONS: Readonly<Record<string, ItemLight>> = {
  leucht: { color: '#43d1cf', strength: 1 }, // Leuchtröhre: a fluorescent tube
  bestellung: { color: '#ffb060', strength: 0.9 }, // Die Letzte Bestellung: the wish-lamp head
  'zange:tunnel': { color: '#fff2b0', strength: 0.7 }, // Rohrzange des Tunnelläufers: the lantern on its strap
  boxh: { color: '#ff4fa3', strength: 0.5 }, // Boxenhammer: neon rings
  mikro: { color: '#ff4fa3', strength: 0.5 }, // Mikroständer: neon tube shaft
  neonfl: { color: '#43d1cf', strength: 0.4 }, // Neonflinte: glowing barrel
};

/** Gear parts that glow softly on the body (small worn lamps); weaker than any lamp in hand. */
export const GLOW_GEAR: Readonly<Record<string, ItemLight>> = {
  'belt-tunnel': { color: '#fff2b0', strength: 0.35 }, // Mantel des Tunnelläufers: the lantern on the hip
};

export interface HeroLight {
  beam: ItemLight | null;
  glow: ItemLight | null;
}

/** The light the hero carries: a head beam from the gear, and the strongest glow of the weapon and the gear. */
export function heroLight(look: Pick<HeroLook, 'gear'>, weapon: string): HeroLight {
  let beam: ItemLight | null = null;
  let glow: ItemLight | null = GLOW_WEAPONS[weapon] ?? null;
  for (const id of look.gear) {
    const b = BEAM_GEAR[id];
    if (b && (!beam || b.strength > beam.strength)) beam = b;
    const g = GLOW_GEAR[id];
    if (g && (!glow || g.strength > glow.strength)) glow = g;
  }
  return { beam, glow };
}
