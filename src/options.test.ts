import { describe, expect, it } from 'vitest';
import { isSteamDeck } from './options';

const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; 23078PND5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('isSteamDeck', () => {
  it('finds a Linux browser on the 1280×800 screen, either way round', () => {
    expect(isSteamDeck(LINUX, 1280, 800)).toBe(true);
    expect(isSteamDeck(LINUX, 800, 1280)).toBe(true);
  });
  it('leaves other screens and systems alone', () => {
    expect(isSteamDeck(LINUX, 1920, 1080)).toBe(false);
    expect(isSteamDeck(WINDOWS, 1280, 800)).toBe(false);
    expect(isSteamDeck(ANDROID, 1280, 800)).toBe(false);
  });
});
