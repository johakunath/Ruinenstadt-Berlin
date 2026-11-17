// What the hero wears for the equipped items (H1 step 4, docs/tasks/h1-hero.md). Plain data, no
// Three.js. The rule is the 2D one (`heroKeys` and `drawHero` in js/art.js): the outfit follows the
// armor base, gloves the glove slot (none = bare hands), boots the boot slot (none = boots). Until
// more pieces exist, unknown bases fall back to the closest piece.
import type { BodyRegion } from './hero-contract';
import type { SlotId } from './items';

export type { BodyRegion };

export interface HeroLook {
  outfit: string;
  boots: string;
  gloves: string | null;
  hat: string | null;
}

/** A clothing piece: its mesh node in hero.glb and the body regions it hides. */
export interface Piece {
  node: string;
  hides: readonly BodyRegion[];
}

export const PIECES: Readonly<Record<string, Piece>> = {
  mantel: { node: 'a_mantel', hides: ['torso', 'arms', 'legs'] },
  weste: { node: 'a_weste', hides: ['torso', 'legs'] },
  stiefel: { node: 'f_stiefel', hides: ['feet'] },
  turnsch: { node: 'f_turnsch', hides: ['feet'] },
  handsch: { node: 'g_handsch', hides: ['hands'] },
};

/** 2D outfits with a short hem (hem 25 to 30 in 2D `CLOTHES`): shown as the vest until they get pieces. */
const SHORT_OUTFITS: ReadonlySet<string> = new Set(['leder', 'weste', 'blaumann']);
const OUTFITS: ReadonlySet<string> = new Set(['mantel', 'weste']);
const BOOTS: ReadonlySet<string> = new Set(['stiefel', 'turnsch']);

export function heroLook(equipment: Readonly<Partial<Record<SlotId, { readonly base: string }>>>): HeroLook {
  const a = equipment.a?.base;
  const outfit = a === undefined ? 'mantel' : OUTFITS.has(a) ? a : SHORT_OUTFITS.has(a) ? 'weste' : 'mantel';
  const f = equipment.f?.base;
  const boots = f !== undefined && BOOTS.has(f) ? f : 'stiefel';
  const gloves = equipment.g ? 'handsch' : null;
  return { outfit, boots, gloves, hat: null };
}

/** Piece nodes shown for a look. */
export function lookNodes(look: HeroLook): string[] {
  return [look.outfit, look.boots, look.gloves, look.hat].flatMap((p) => (p && PIECES[p] ? [PIECES[p].node] : []));
}

/** Body regions hidden under a look's pieces. */
export function hiddenRegions(look: HeroLook): Set<BodyRegion> {
  return new Set([look.outfit, look.boots, look.gloves, look.hat].flatMap((p) => (p && PIECES[p] ? PIECES[p].hides : [])));
}

export function sameLook(a: HeroLook, b: HeroLook): boolean {
  return a.outfit === b.outfit && a.boots === b.boots && a.gloves === b.gloves && a.hat === b.hat;
}
