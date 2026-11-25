import { describe, expect, it } from 'vitest';
import { isSteamDeck, isSteamDeckScreen } from './options';

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

describe('isSteamDeckScreen', () => {
  it('finds the Deck at scale 1, with Chrome page zoom, with a scale factor, and with both', () => {
    expect(isSteamDeckScreen(LINUX, 1280, 800, 1, 1280, 1280)).toBe(true);
    // Chrome page zoom 125 %: screen stays, the ratio and the zoom grow.
    expect(isSteamDeckScreen(LINUX, 1280, 800, 1.25, 1280, 1024)).toBe(true);
    // Scale factor 1.25 (launch option): screen shrinks, no page zoom.
    expect(isSteamDeckScreen(LINUX, 1024, 640, 1.25, 1024, 1024)).toBe(true);
    // Scale factor 1.25 and page zoom 110 % (the Codex case).
    expect(isSteamDeckScreen(LINUX, 1024, 640, 1.375, 1024, 931)).toBe(true);
    // A window frame of a pixel or two.
    expect(isSteamDeckScreen(LINUX, 1280, 800, 1.25, 1280, 1022)).toBe(true);
  });
  it('leaves a 1920×1200 Linux laptop at 150 % alone, also with page zoom', () => {
    expect(isSteamDeckScreen(LINUX, 1280, 800, 1.5, 1280, 1280)).toBe(false);
    expect(isSteamDeckScreen(LINUX, 1280, 800, 2.25, 1280, 853)).toBe(false);
  });
});
