// U3: the 2D line icons for menu tabs and stat rows (2D `js/panels.js` UIP and `ui()`).
const UIP = {
  bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  segen: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  kodex: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h5"/>',
  dmg: '<path d="M20 4L10 14M20 4h-5M20 4v5M7 12l5 5M5 19l3-3"/>',
  rate: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  crit: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  hp: '<path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/>',
  res: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  spd: '<path d="M10 4v9l6 3h4v4H9l-1-1V4z"/><path d="M2 9h4M1 13h4M2 17h4"/>',
  regen: '<path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/><path d="M12 9v6M9 12h6"/>',
  el: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-4 9-2-1-2-3-2-3-2 2-3 4-3 6 0 4 3 7 7 7z"/>',
  leech: '<path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z"/><path d="M9 15h6"/>',
  luck: '<circle cx="12" cy="12" r="8"/><path d="M12 6.5v11M14.5 9.5h-3.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9.5"/>',
  dash: '<path d="M2 12h9M4 8h6M4 16h6"/><circle cx="17" cy="12" r="5"/><path d="M17 9.5V12l1.8 1.5"/>',
  scrap: '<path d="M4 18l4-9 4 4 3-7 5 12z"/>',
} as const;
export type UiIcon = keyof typeof UIP;

export const uiIcon = (k: UiIcon, size = 18): string => `<svg class="uic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UIP[k]}</svg>`;
