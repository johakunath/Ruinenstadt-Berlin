// M15 Alexanderplatz sign atlas (code-painted placeholder, `docs/asset-pipeline.md`): every lettered or
// emblem surface of the district in one texture, so they share one material and one draw call per chunk.
// Pioneer palette (`docs/style-bible.md` › GDR / Pioneer direction): cobalt `#2463a5`, yellow `#f3ce43`,
// emblem red `#b93432`, cream `#eadfc6`; hammer and sickle as a real crossed hammer and curved sickle.
import { canvas, toTexture, type Ctx, type EmissiveSurface } from './paint';

export const ATLAS_W = 2048, ATLAS_H = 1024;
/** Atlas regions in pixels (x, y from the top left, w, h). */
export const ATLAS = {
  hours: [0, 0, 2048, 128],
  cities: [0, 128, 2048, 128],
  frieze: [0, 256, 2048, 256],
  kino: [0, 512, 1024, 128],
  moskau: [1024, 512, 1024, 128],
  alex: [0, 640, 1024, 128],
  hackescher: [1024, 640, 1024, 128],
  emblem: [0, 768, 256, 256],
  banner: [256, 768, 128, 256],
  stripe: [384, 768, 128, 256],
  curtain: [512, 768, 512, 256],
  bronze: [1024, 768, 512, 256],
  foyer: [1536, 768, 512, 256],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type AtlasKey = keyof typeof ATLAS;

/** UV rectangle [u0, v0, u1, v1] of a region (v up, as Three.js samples it). */
export function atlasUv(key: AtlasKey): [number, number, number, number] {
  const [x, y, w, h] = ATLAS[key];
  return [x / ATLAS_W, 1 - (y + h) / ATLAS_H, (x + w) / ATLAS_W, 1 - y / ATLAS_H];
}

const RED = '#b93432', YELLOW = '#f3ce43', BLUE = '#2463a5', CREAM = '#eadfc6', ALU = '#bdbab0';

/** Crossed hammer and sickle in `color`, centred at (cx, cy), size s (about the emblem's height). */
export function hammerSickle(k: Ctx, cx: number, cy: number, s: number, color: string): void {
  k.save();
  k.translate(cx, cy);
  k.fillStyle = color;
  k.strokeStyle = color;
  // Sickle: a thick crescent opening to the upper right, its handle to the lower left.
  k.lineCap = 'round';
  k.lineWidth = s * 0.1;
  k.beginPath();
  k.arc(s * 0.04, -s * 0.04, s * 0.32, Math.PI * 0.05, Math.PI * 1.45);
  k.stroke();
  k.lineWidth = s * 0.09;
  k.beginPath();
  k.moveTo(-s * 0.2, s * 0.2);
  k.lineTo(-s * 0.36, s * 0.38);
  k.stroke();
  // Hammer: handle from lower right to upper left, head across its top.
  k.rotate(-Math.PI / 4);
  k.fillRect(-s * 0.045, -s * 0.28, s * 0.09, s * 0.62);
  k.fillRect(-s * 0.18, -s * 0.36, s * 0.36, s * 0.13);
  k.restore();
}

function text(k: Ctx, t: string, x: number, y: number, w: number, h: number, color: string, weight = 'bold', size = 0.62): void {
  k.fillStyle = color;
  k.font = `${weight} ${Math.round(h * size)}px Arial, sans-serif`;
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  k.fillText(t, x + w / 2, y + h / 2 + h * 0.04, w - 16);
}

// City names on the Weltzeituhr panels (a selection of the real ones), three per panel.
const CITIES = [
  'REYKJAVIK', 'DUBLIN', 'LONDON', 'AZOREN', 'KAP VERDE', 'RIO', 'BERLIN', 'MADRID', 'PARIS', 'HELSINKI', 'RIGA', 'WILNA',
  'MOSKAU', 'MURMANSK', 'SOFIA', 'BAKU', 'TIFLIS', 'ERIWAN', 'TASCHKENT', 'KABUL', 'KARACHI', 'DELHI', 'COLOMBO', 'DHAKA',
  'HANOI', 'BANGKOK', 'PEKING', 'HAVANNA', 'TOKIO', 'MANILA', 'SYDNEY', 'WLADIWOSTOK', 'MAGADAN', 'WELLINGTON', 'ANADYR', 'SAMOA',
];

/** The atlas: base colours and an emissive mask (lettering and numerals glow a little at dusk). */
export function paintAlexAtlas(): EmissiveSurface {
  const [c, k] = canvas(ATLAS_W, ATLAS_H);
  const [e, ek] = canvas(ATLAS_W, ATLAS_H);
  ek.fillStyle = '#000';
  ek.fillRect(0, 0, ATLAS_W, ATLAS_H);

  // Weltzeituhr hour band: 24 cells, gold numerals on red (once round the drum).
  {
    const [x0, y0, w, h] = ATLAS.hours, cw = w / 24;
    k.fillStyle = RED;
    k.fillRect(x0, y0, w, h);
    for (let i = 0; i < 24; i++) {
      k.fillStyle = 'rgba(0,0,0,0.25)';
      k.fillRect(x0 + i * cw, y0, 3, h);
      for (const [kk, col] of [[k, YELLOW], [ek, '#c8a040']] as Array<[Ctx, string]>) text(kk, String(((i + 9) % 24) + 1), x0 + i * cw, y0, cw, h, col, 'bold', 0.7);
    }
  }
  // City panels: brushed aluminium with three engraved names each.
  {
    const [x0, y0, w, h] = ATLAS.cities, cw = w / 12;
    for (let i = 0; i < 12; i++) {
      const g = k.createLinearGradient(x0 + i * cw, 0, x0 + (i + 1) * cw, 0);
      g.addColorStop(0, '#cfccc2');
      g.addColorStop(0.5, ALU);
      g.addColorStop(1, '#a9a69c');
      k.fillStyle = g;
      k.fillRect(x0 + i * cw, y0, cw, h);
      k.fillStyle = 'rgba(0,0,0,0.35)';
      k.fillRect(x0 + i * cw, y0, 4, h);
      for (let j = 0; j < 3; j++) text(k, CITIES[(i * 3 + j) % CITIES.length]!, x0 + i * cw, y0 + 14 + j * 34, cw, 34, '#1d1a16', 'bold', 0.5);
    }
  }
  // Haus des Lehrers frieze ("Unser Leben", Walter Womacka): bands of figures in blue, yellow, red and cream.
  {
    const [x0, y0, w, h] = ATLAS.frieze;
    k.fillStyle = BLUE;
    k.fillRect(x0, y0, w, h);
    const cols = [YELLOW, RED, CREAM, '#36585d', '#e7982b', BLUE];
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = x0; x < x0 + w; x += 18 + rnd() * 40) {
      k.fillStyle = cols[Math.floor(rnd() * cols.length)]!;
      k.fillRect(x, y0 + rnd() * h * 0.5, 16 + rnd() * 50, h * (0.3 + rnd() * 0.6));
    }
    // Standing figures: workers, a scientist, children, mothers (simple silhouettes).
    for (let i = 0; i < 26; i++) {
      const fx = x0 + 40 + i * 78 + rnd() * 20, fy = y0 + h * 0.28;
      k.fillStyle = i % 3 === 0 ? CREAM : i % 3 === 1 ? '#f0d6b0' : YELLOW;
      k.beginPath();
      k.arc(fx, fy, 13, 0, Math.PI * 2);
      k.fill();
      k.fillStyle = cols[i % cols.length]!;
      k.fillRect(fx - 18, fy + 14, 36, 90);
      k.fillStyle = '#1d2a3a';
      k.fillRect(fx - 14, fy + 104, 12, 60);
      k.fillRect(fx + 2, fy + 104, 12, 60);
    }
    k.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = y0; y < y0 + h; y += 6) k.fillRect(x0, y, w, 1);
  }
  // Lettering.
  for (const [key, t, bg, fg] of [['kino', 'KINO  INTERNATIONAL', '#ece6d4', '#3a3a36'], ['moskau', 'CAFÉ MOSKAU', '#2b3338', '#f2d14b'], ['alex', 'ALEXANDERPLATZ', '#f4f2ea', '#141414'], ['hackescher', 'HACKESCHER MARKT', '#f4f2ea', '#141414']] as Array<[AtlasKey, string, string, string]>) {
    const [x, y, w, h] = ATLAS[key];
    k.fillStyle = bg;
    k.fillRect(x, y, w, h);
    text(k, t, x, y, w, h, fg, 'bold', 0.62);
    text(ek, t, x, y, w, h, key === 'kino' || key === 'moskau' ? '#d0c080' : '#303030', 'bold', 0.62);
  }
  // Emblem: yellow hammer and sickle on red; banner: red with the emblem and a yellow fringe; stripe: blue and yellow.
  {
    const [x, y, w, h] = ATLAS.emblem;
    k.fillStyle = RED;
    k.fillRect(x, y, w, h);
    hammerSickle(k, x + w / 2, y + h / 2, w * 0.8, YELLOW);
    hammerSickle(ek, x + w / 2, y + h / 2, w * 0.8, '#806020');
  }
  {
    const [x, y, w, h] = ATLAS.banner;
    k.fillStyle = RED;
    k.fillRect(x, y, w, h);
    k.fillStyle = YELLOW;
    k.fillRect(x, y, w, 12);
    k.fillRect(x, y + h - 10, w, 10);
    hammerSickle(k, x + w / 2, y + h * 0.3, w * 0.7, YELLOW);
  }
  {
    const [x, y, w, h] = ATLAS.stripe;
    k.fillStyle = BLUE;
    k.fillRect(x, y, w, h);
    k.fillStyle = YELLOW;
    k.fillRect(x, y + h * 0.4, w, h * 0.2);
  }
  // Glass fronts: a grid of panes (4 × 4 per region) with mullions, sky reflection and a few lit rooms.
  const grid = (key: AtlasKey, top: string, bottom: string, mull: string, lit: number, warm: string): void => {
    const [x0, y0, w, h] = ATLAS[key], cw = w / 4, ch = h / 4;
    let seed = x0 + 11;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const g = k.createLinearGradient(0, y0 + j * ch, 0, y0 + (j + 1) * ch);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      k.fillStyle = g;
      k.fillRect(x0 + i * cw, y0 + j * ch, cw, ch);
      // A diagonal sky streak.
      k.fillStyle = 'rgba(255,255,255,0.12)';
      k.beginPath();
      k.moveTo(x0 + i * cw + cw * 0.2, y0 + j * ch);
      k.lineTo(x0 + i * cw + cw * 0.45, y0 + j * ch);
      k.lineTo(x0 + i * cw + cw * 0.1, y0 + (j + 1) * ch);
      k.lineTo(x0 + i * cw - cw * 0.15, y0 + (j + 1) * ch);
      k.fill();
      if (rnd() < lit) {
        k.fillStyle = warm;
        k.fillRect(x0 + i * cw + 6, y0 + j * ch + 6, cw - 12, ch - 12);
        ek.fillStyle = '#5a4020';
        ek.fillRect(x0 + i * cw + 6, y0 + j * ch + 6, cw - 12, ch - 12);
      }
    }
    k.fillStyle = mull;
    for (let i = 0; i <= 4; i++) k.fillRect(x0 + i * cw - 3, y0, 6, h);
    for (let j = 0; j <= 4; j++) k.fillRect(x0, y0 + j * ch - 4, w, 8);
  };
  grid('curtain', '#9fbccc', '#4f6a78', '#d8d8d2', 0.03, '#c8a070');
  grid('bronze', '#c88a50', '#6a3c20', '#e8e2d4', 0.08, '#f0b060');
  grid('foyer', '#7a8e96', '#2e3a40', '#3a3c3c', 0.12, '#c89a60');
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}
