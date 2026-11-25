import { describe, expect, it } from 'vitest';
import { pickPad } from './pad';

const pad = (index: number, mapping = 'standard', o: { press?: boolean; stick?: number; connected?: boolean } = {}) => ({
  index,
  mapping: mapping as GamepadMappingType,
  connected: o.connected ?? true,
  axes: [o.stick ?? 0, 0, 0, 0],
  buttons: [{ pressed: !!o.press, touched: !!o.press, value: o.press ? 1 : 0 }],
});

describe('pickPad', () => {
  it('returns null without a connected pad', () => {
    expect(pickPad([], -1)).toBeNull();
    expect(pickPad([null, pad(1, 'standard', { connected: false })], -1)).toBeNull();
  });

  it('first choice: a pressed pad, else a standard one before a raw one (Steam Deck)', () => {
    const raw = pad(0, ''), virt = pad(1);
    expect(pickPad([raw, virt], -1)).toBe(virt);
    const rawPressed = pad(0, '', { press: true });
    expect(pickPad([rawPressed, virt], -1)).toBe(rawPressed);
  });

  it('keeps the chosen pad while another carries the same input (no swap, no repeated presses)', () => {
    const a = pad(0, 'standard', { press: true }), b = pad(1, 'standard', { press: true });
    expect(pickPad([a, b], 1)).toBe(b);
    expect(pickPad([a, b], 0)).toBe(a);
  });

  it('switches when the chosen pad is idle and another is used', () => {
    const idle = pad(0), used = pad(1, 'standard', { stick: 0.9 });
    expect(pickPad([idle, used], 0)).toBe(used);
    expect(pickPad([idle, pad(1)], 0)).toBe(idle);
  });

  it('chooses again when the chosen pad is gone', () => {
    const b = pad(1);
    expect(pickPad([null, b], 0)).toBe(b);
  });
});
