// Difficulty (M6, 2D `DIFF` in js/data.js). 3D Normal is the tuned baseline (multiplier 1); the other
// two are the 2D ratios to Normal (2D Normal was hp 1.75, damage 1.45).
export type DifficultyId = 'leicht' | 'normal' | 'schwer';
export interface Difficulty { id: DifficultyId; label: string; hint: string; hp: number; dmg: number; luck: number; scrap: number }
export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'leicht', label: 'Leicht', hint: 'Weniger Schaden', hp: 0.7 / 1.75, dmg: 0.6 / 1.45, luck: 0, scrap: 1 },
  { id: 'normal', label: 'Normal', hint: 'Gedacht so', hp: 1, dmg: 1, luck: 0, scrap: 1 },
  { id: 'schwer', label: 'Schwer', hint: 'Mehr Beute', hp: 2.15 / 1.75, dmg: 1.75 / 1.45, luck: 4, scrap: 1.3 },
];
export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';
export const difficultyOf = (id: DifficultyId): Difficulty => DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]!;
export const isDifficulty = (v: unknown): v is DifficultyId => DIFFICULTIES.some((d) => d.id === v);
