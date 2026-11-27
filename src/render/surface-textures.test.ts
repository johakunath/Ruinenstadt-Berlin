import { describe, expect, it } from 'vitest';
import { groundSize, groundSource } from './ground-textures';
import { PROFILES } from './profile';
import { bitmapsWork, cappedSize } from './surface-textures';

const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SAFARI = (v: number): string => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v}.1 Safari/605.1.15`;
const FIREFOX = (v: number): string => `Mozilla/5.0 (X11; Linux x86_64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`;

describe('painted texture loading (T1b, P47)', () => {
  it('decodes through ImageBitmap only where createImageBitmap honours its options', () => {
    expect(bitmapsWork(CHROME, true)).toBe(true);
    expect(bitmapsWork(CHROME, false)).toBe(false);
    expect(bitmapsWork(SAFARI(17), true)).toBe(true);
    expect(bitmapsWork(SAFARI(16), true)).toBe(false);
    expect(bitmapsWork(FIREFOX(98), true)).toBe(true);
    expect(bitmapsWork(FIREFOX(97), true)).toBe(false);
  });

  it('caps the longer edge and keeps the aspect ratio', () => {
    expect(cappedSize(1024, 1024, 512)).toEqual([512, 512]);
    expect(cappedSize(2048, 1024, 1024)).toEqual([1024, 512]);
    expect(cappedSize(512, 1024, 512)).toEqual([256, 512]);
    expect(cappedSize(512, 512, 512)).toEqual([512, 512]);
    expect(cappedSize(1024, 512, Infinity)).toEqual([1024, 512]);
  });

  it('caps tiling surfaces at 512 px on Leistung only', () => {
    expect(PROFILES.leistung.tileEdge).toBe(512);
    expect(PROFILES.ausgewogen.tileEdge).toBe(Infinity);
    expect(PROFILES.qualitaet.tileEdge).toBe(Infinity);
  });

  it('takes the 512 px ground export under a 512 cap or ?ground=512, else the 1024 file', () => {
    expect(groundSource('paving', 512, undefined).url).toMatch(/paving-512\.webp/);
    expect(groundSource('paving', Infinity, undefined)).toMatchObject({ url: expect.stringMatching(/paving\.webp/), maxEdge: Infinity });
    expect(groundSource('grass', Infinity, 512).url).toMatch(/grass-512\.webp/);
    expect(groundSource('leaves', 512, 1024)).toMatchObject({ url: expect.stringMatching(/leaves\.webp/), maxEdge: Infinity });
    // Surfaces without a 512 export keep the runtime cap.
    expect(groundSource('litter', 512, undefined)).toMatchObject({ url: expect.stringMatching(/litter\.webp/), maxEdge: 512 });
    expect(groundSource('cobbles', 512, 512)).toMatchObject({ url: expect.stringMatching(/cobbles\.webp/), maxEdge: 512 });
    expect(groundSize('?ground=512')).toBe(512);
    expect(groundSize('?ground=1024&profile=Leistung')).toBe(1024);
    expect(groundSize('?ground=2048')).toBeUndefined();
  });
});
