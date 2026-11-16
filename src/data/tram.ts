// Shared wheel/rail dimensions in metres. Gauge is measured between the inner running faces.
export const TRAM_GAUGE = 1.435;
export const TRAM_HEAD_WIDTH = 0.07;
export const TRAM_WHEEL_OFFSET = (TRAM_GAUGE + TRAM_HEAD_WIDTH) / 2;
export const TRAM_WHEEL_RADIUS = 0.29;
export const TRAM_BOGIES = [-6.05, -1.65, 1.65, 6.05] as const;
export const TRAM_AXLES = [-0.52, 0.52] as const;
export const TRAM_BRIDGE_DECK = 0.05;
export const TRAM_HEAD_HEIGHT = 0.014;
