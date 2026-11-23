// M17 echo bosses (T8, `docs/tasks/m17-fernsehturm.md`): a district boss comes back in the tower as a weaker echo of
// itself. A modifier on the existing kind: less life and damage, the name „Echo: …“, no item drops (`killDrops`), no
// Kodex entry of its own (its kills count for the kind). The render draws it pale with a clock-hand outline.
import type { Enemy } from './types';

// Shares of the boss as the director spawns it (`bossScale`). B2 step 3 raised that by about 1.9× life and 1.3× damage
// at the tower's strength; the bot recalibration of 2026-11-23 took the share from 0.45 and 0.8 to these.

export const ECHO = { hp: 0.2, dmg: 0.65 } as const;

/** Turns a freshly spawned boss into its echo. */
export function makeEcho(e: Enemy): void {
  if (e.echo) return;
  e.echo = true;
  e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * ECHO.hp));
  e.dmgMul *= ECHO.dmg;
  e.def = { ...e.def, name: `Echo: ${e.def.name}` };
}

/** Display name of a boss in a wave: the echo's or the kind's. */
export const echoName = (name: string, echo: boolean | undefined): string => (echo ? `Echo: ${name}` : name);
