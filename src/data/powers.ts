// Powers and ultimates (M8). Names, cooldowns and base ratios come from the 2D `KR` table (js/data.js);
// radii and distances are the 2D pixel values at 30 px per meter. Cast times are new: in 3D a power
// plays a clip and its effect lands on a frame of that clip.
import type { WeaponKindId } from './items';

/** 2D pixels to meters (hero radius 10 px, blade reach 60 px). */
export const PX = 1 / 30;

/** Playtest 2026-11-20: powers, ultimates and thrown fire hit 25% harder. */
export const SPECIAL_DAMAGE = 1.25;

export type PowerId = 'saege' | 'fecht' | 'saebel' | 'fall' | 'gully' | 'abriss' | 'nagel' | 'brand' | 'sperr' | 'spiess' | 'stab' | 'stand';

export interface PowerDef {
  id: PowerId;
  name: string;
  /** One short line for the HUD tooltip and the inventory. */
  description: string;
  cooldown: number;
  ultimate: boolean;
  /**
   * Seconds the hero is committed to the cast (0 = instant, the hero keeps moving) and the moment
   * inside it at which the effect happens. A dodge cancels the rest once the effect is out.
   */
  cast: number;
  fire: number;
}

const p = (id: PowerId, name: string, description: string, cooldown: number, cast = 0, fire = 0, ultimate = false): PowerDef => (
  { id, name, description, cooldown, ultimate, cast, fire }
);

/** Per weapon kind: the two regular powers, then the ultimate (2D `KR`). */
export const POWERS: Readonly<Record<WeaponKindId, readonly [PowerDef, PowerDef, PowerDef]>> = {
  blade: [
    p('saege', 'Kreissäge', '1,2 s Wirbel, trifft alles um dich', 7),
    p('fecht', 'Fechtsprung', 'Sprung durch Gegner, 225% Schaden. Kill lädt sofort auf', 6, 0.24, 0),
    p('saebel', 'Säbeltanz', '5 s +80% Angriffstempo, +25% Schaden, jeder Treffer kritisch', 24, 0, 0, true),
  ],
  hammer: [
    p('fall', 'Fallhammer', 'Druckwelle: 312,5% Schaden, betäubt', 8, 0.52, 0.3),
    p('gully', 'Gullydeckel', '3 s Deckung, 70% weniger Schaden. Danach Rundumschlag', 9),
    p('abriss', 'Abrissbirne', 'Sprung zum Ziel, 500% Schaden, betäubt lange', 22, 0.5, 0.5, true),
  ],
  sling: [
    p('nagel', 'Nagelsturm', 'Fächer aus 9 Geschossen', 6, 0.32, 0.12),
    p('brand', 'Brandsatz', 'Wurf aufs Ziel: Feuerfeld für 4 s', 8, 0.5, 0.22),
    p('sperr', 'Sperrfeuer', '8 Einschläge auf Gegner, je 275% Schaden', 22, 0.5, 0.2, true),
  ],
  spear: [
    p('spiess', 'Spießrute', 'Speerwurf, durchbohrt alles in einer Linie', 7, 0.42, 0.2),
    p('stab', 'Stabhochsprung', 'Sprung nach vorn, Landung trifft im Kreis mit 275%', 6, 0.36, 0.36),
    p('stand', 'Standarte', '8 s Standarte: +87,5% Schaden, Heilung, Gegner langsamer', 26, 0.45, 0.22, true),
  ],
};

export const POWER_BY_ID = Object.fromEntries(Object.values(POWERS).flat().map((d) => [d.id, d])) as Readonly<Record<PowerId, PowerDef>>;

/** Tuning shared by sim and renderer (meters, seconds, multiples of weapon damage). */
export const POWER = {
  saege: { time: 1.2, tick: 0.15, radius: 80 * PX, damage: 0.6 * SPECIAL_DAMAGE, knock: 160 },
  fecht: { speed: 640 * PX, time: 0.24, invuln: 0.36, pad: 18 * PX, damage: 1.8 * SPECIAL_DAMAGE, knock: 300, recharge: 0.3, aim: 300 * PX },
  saebel: { time: 5, speed: 1.8, radius: 190 * PX, damage: 1.5 * SPECIAL_DAMAGE, attackDamage: SPECIAL_DAMAGE, stun: 0.5 },
  fall: { radius: 165 * PX, damage: 2.5 * SPECIAL_DAMAGE, stun: 1.3 },
  gully: { time: 3, taken: 0.3, slow: 0.55, radius: 120 * PX, damage: 1.6 * SPECIAL_DAMAGE, stun: 0.6 },
  abriss: { aim: 320 * PX, far: 300 * PX, free: 220 * PX, radius: 210 * PX, damage: 4 * SPECIAL_DAMAGE, stun: 1.8, height: 58 * PX },
  nagel: { count: 9, spread: 0.14, damage: 0.8 * SPECIAL_DAMAGE, life: 0.8, pierce: 1 },
  brand: { aim: 340 * PX, free: 190 * PX, flight: 0.42, radius: 75 * PX, time: 4, damage: SPECIAL_DAMAGE },
  sperr: { count: 8, aim: 420 * PX, first: 0.45, gap: 0.13, radius: 62 * PX, damage: 2.2 * SPECIAL_DAMAGE, knock: 260, jitter: 14 * PX },
  spiess: { speed: 720 * PX, life: 0.9, damage: 2.6 * SPECIAL_DAMAGE, pierce: 30 },
  stab: { aim: 240 * PX, far: 200 * PX, free: 180 * PX, radius: 95 * PX, damage: 2.2 * SPECIAL_DAMAGE, stun: 0.5, height: 40 * PX },
  stand: { time: 8, radius: 170 * PX, damage: 1.5 * SPECIAL_DAMAGE, heal: 0.02, slow: 0.7 },
  /** Expanding shock rings travel this fast and hit bodies within `band` of the rim. */
  shock: { speed: 460 * PX, band: 26 * PX },
} as const;
