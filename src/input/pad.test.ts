import { describe, expect, it } from 'vitest';
import { pickPad } from './pad';

const pad = (mapping: string, timestamp: number, connected = true): { mapping: GamepadMappingType; timestamp: number; connected: boolean } =>
  ({ mapping: mapping as GamepadMappingType, timestamp, connected });

describe('pickPad', () => {
  it('returns null without a connected pad', () => {
    expect(pickPad([])).toBeNull();
    expect(pickPad([null, pad('standard', 5, false)])).toBeNull();
  });

  it('prefers a standard pad over an earlier non-standard one (Steam Deck: raw controller first)', () => {
    const raw = pad('', 900), virt = pad('standard', 10);
    expect(pickPad([raw, virt])).toBe(virt);
  });

  it('among standard pads takes the one with the latest input', () => {
    const idle = pad('standard', 10), used = pad('standard', 50);
    expect(pickPad([idle, used])).toBe(used);
    expect(pickPad([used, idle])).toBe(used);
  });

  it('takes a non-standard pad when it is the only one', () => {
    const raw = pad('', 1);
    expect(pickPad([null, raw])).toBe(raw);
  });
});
