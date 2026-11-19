// M6b: the page's one cloud save, shared by the boot (title screen, before the game loads) and main.ts.
// Off on localhost, in automated browsers and on debug starts (?autostart, ?at, ?stress, ?mapscale, ?spawn).
import { activeSlot } from './save';
import { CloudSave } from './sync';
import { opts } from './ui/settings';

let one: CloudSave | null = null;
export const persistOn = (): boolean => !opts.autostart && !opts.stress && !opts.startAt && opts.mapScale === 1 && opts.spawn.length === 0;
export function cloudSave(): CloudSave {
  if (one) return one;
  one = new CloudSave(persistOn() && !navigator.webdriver && !/^(localhost|127\.|0\.0\.0\.0|$)/.test(location.hostname));
  one.active = activeSlot();
  return one;
}
