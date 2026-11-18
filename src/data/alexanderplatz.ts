// Alexanderplatz, the third district (M15, layout C "Großer Ring um den Turm", Johannes 2026-11-18,
// `docs/mockups/alex-layouts.svg`, `docs/maps/alexanderplatz.md`, `docs/tasks/m15-alexanderplatz.md`).
// 1989, frozen in autumn: the GDR kept going and grew wild. Anchors checked against OpenStreetMap on
// 2026-11-18 (origin the Weltzeituhr), distances compressed to about 0.15 to 0.2.
// Route, one loop around the Fernsehturm without doubling back: S Hackescher Markt → over the
// Kupfergraben onto the Museumsinsel (Lustgarten, Schlossplatz, Palastgarten, boss at the Palast der
// Republik) → Rathausbrücke → Nikolaiviertel → along the Spree → through a Stadtbahn arch → Jannowitzbrücke
// (boss) → north up the Lichtenberger Straße → Karl-Marx-Allee (the Koloss) → Weltzeituhr (final boss).
// The Fernsehturm, Marienkirche and Neptunbrunnen stand inside the loop: visible from every fight, free
// for side branches. Meters, +X east, +Z south, origin the map centre. `scale` stretches distances only.
import { THREAT, type BossKind, type EnemyKind } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { type Area, type Bridge, type Landmark, type MapDef, type Pt, type River, type Street, type Viaduct } from './map';
import type { Prop } from './courtyard';
import { lane } from './koepenick';

/** Normal waves in the district: 9 per zone. */
export const ALEX_WAVES = 27;
/** Alexanderplatz picks up where Xhain's middle was and climbs past its end (calibrate with the bot). */
export const ALEX_TIER = { from: 16, to: 38 } as const;

/**
 * Bosses until the district's own are built (step 7 of the task): zone 1 Wurzel-Mutter, zone 2 Großer
 * Uhrwerkläufer, zone 3 Volkseigener Koloss, final the Weltzeituhr itself. Stand-ins keep the blockout playable.
 */
export const ALEX_BOSS_STANDIN: Record<'insel' | 'spree' | 'allee' | 'uhr', BossKind> = { insel: 'rattenmutter', spree: 'waechter', allee: 'brandmeister', uhr: 'hauptmann' };

/**
 * Difficulty of wave `g` (16 … 38) in `zone`. Until the district types exist (Uhrwerkläufer, Wurzler,
 * Kernspeier, Brigadeghul) the mix leans on brutes (stand in for the shield walkers) and spitters
 * (for the Kernspeier); crows over the Museumsinsel gardens.
 */
export function alexWaveTier(g: number, bosses: BossKind[] = [], zone = 0): WaveDef {
  const mix: Partial<Record<EnemyKind, number>> = {
    walker: 6,
    runner: 1 + g * 0.2,
    spitter: 1.2 + g * 0.08 + (zone === 0 ? 0.6 : 0),
    brute: 0.6 + g * 0.08 + (zone === 2 ? 0.8 : 0),
    crow: zone === 0 ? 0.8 : 0,
  };
  return {
    count: Math.round(5 + g * 0.45),
    maxAlive: Math.min(12, 6 + Math.floor(g / 3)),
    mix,
    hpMul: 1 + g * 0.13,
    dmgMul: 1 + g * 0.06,
    bosses,
    elite: THREAT.eliteChance(g),
  };
}

const NORMAL_HEAL = 0.3;

/** The Stadtbahn polyline (unscaled); the viaduct is cut into pieces with open arches where streets pass. */
const STADTBAHN: Array<[number, number]> = [[-205, -132], [-112, -128], [-40, -108], [20, -78], [55, -25], [95, 40], [125, 100], [137, 160]];
/** Arches the hero walks through: distance along the line (unscaled) and opening width. */
const ARCHES: Array<{ name: string; w: number }> = [
  { name: 'Karl-Liebknecht-Straße', w: 16 },
  { name: 'Rathausstraße', w: 16 },
  { name: 'Spreeufer', w: 16 },
];

export function alexMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);

  let g = 0;
  const tier = (n: number): number => ALEX_TIER.from + (n * (ALEX_TIER.to - ALEX_TIER.from)) / (ALEX_WAVES - 1);
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(alexWaveTier(tier(g++), [], Math.min(zone, 2)));
    return { id, name, zone, x: x * s, z: z * s, r, waves: list, heal: NORMAL_HEAL };
  };
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x: x * s, z: z * s, r, waves: [{ ...alexWaveTier(tier(Math.max(0, g - 1)), [kind], Math.min(zone, 2)), count: adds, maxAlive: 4, elite: 0 }], heal: 1 }
  );

  const encounters: EncounterDef[] = [
    // Zone 0: Museumsinsel (9 waves), the Wurzel-Mutter grown out of the Palast glass house.
    enc('lustgarten', 'Lustgarten', 0, -150, -62, 14, 3),
    enc('schlossplatz', 'Schlossplatz', 0, -165, -2, 13, 3),
    enc('palastgarten', 'Palastgarten', 0, -164, 42, 13, 3),
    boss('palast', 'Palast der Republik', 0, -125, 78, 15, ALEX_BOSS_STANDIN.insel, 3),
    // Zone 1: Nikolaiviertel and the Spree bank (9 waves), the Großer Uhrwerkläufer at the Jannowitzbrücke.
    enc('nikolaiviertel', 'Nikolaiviertel', 1, -40, 88, 13, 3),
    enc('molkenmarkt', 'Molkenmarkt', 1, 22, 98, 13, 3),
    enc('rolandufer', 'Rolandufer', 1, 68, 96, 13, 3),
    boss('jannowitz', 'Jannowitzbrücke', 1, 150, 90, 15, ALEX_BOSS_STANDIN.spree, 4),
    // Zone 2: Karl-Marx-Allee (9 waves), the Volkseigener Koloss on the Allee.
    enc('holzmarkt', 'Holzmarktstraße', 2, 176, 50, 13, 3),
    enc('moskau', 'Café Moskau', 2, 178, -2, 13, 3),
    enc('kino', 'Kino International', 2, 168, -64, 13, 3),
    boss('allee', 'Karl-Marx-Allee', 2, 130, -34, 15, ALEX_BOSS_STANDIN.allee, 4),
    // Zone 3: the Weltzeituhr wakes up. The circle sits just south of the clock (its centre stays free).
    boss('weltzeituhr', 'Weltzeituhr', 3, 72, -50, 16, ALEX_BOSS_STANDIN.uhr, 6),
  ];

  const zones: ZoneDef[] = [
    // Start below S Hackescher Markt, north of the Kupfergraben.
    { id: 'insel', name: 'Museumsinsel', entry: { x: -150 * s, z: -117 * s } },
    { id: 'spree', name: 'Nikolaiviertel', entry: { x: -66 * s, z: 62 * s } },
    { id: 'allee', name: 'Karl-Marx-Allee', entry: { x: 185.4 * s, z: 78 * s } },
    { id: 'alex', name: 'Alexanderplatz', entry: { x: 104 * s, z: -60 * s } },
  ];

  // The Spree from the Jannowitzbrücke (south-east) west along the Märkisches Ufer, north past the
  // Nikolaiviertel and the Spreeinsel, out at the north edge. The Kupfergraben closes the island to the west.
  const rivers: River[] = [
    { name: 'Spree', width: rw(22), pts: line([[205, 128], [130, 124], [60, 128], [0, 132], [-45, 120], [-80, 88], [-100, 40], [-108, -20], [-112, -80], [-114, -155]]) },
    { name: 'Kupfergraben', width: rw(11), pts: line([[-111, -100], [-150, -102], [-182, -85], [-190, -30], [-188, 40], [-172, 85], [-135, 104], [-72, 104]]) },
  ];

  // Bridges cross square to the river.
  const across = (ax: number, az: number, bx: number, bz: number): number => {
    const dx = bx - ax, dz = bz - az;
    return Math.atan2(dz, -dx); // facing perpendicular to the river direction (dx, dz)
  };
  const bridges: Bridge[] = [
    { name: 'Monbijoubrücke', x: -150 * s, z: -101 * s, rot: 0, len: rw(11) + 12, width: 8 },
    { name: 'Liebknechtbrücke', x: -110 * s, z: -50 * s, rot: across(-108, -20, -112, -80), len: rw(22) + 12, width: 12 },
    { name: 'Rathausbrücke', x: -90 * s, z: 64 * s, rot: across(-80, 88, -100, 40), len: rw(22) + 12, width: 10 },
  ];

  const streets: Street[] = [
    // Zone 0: the start strip under the Stadtbahn and the island.
    { name: 'Burgstraße', kind: 'side', width: 6.5, pts: line([[-198, -117], [-150, -117], [-127, -117]]) },
    { name: 'Am Lustgarten', kind: 'side', width: 7, pts: line([[-150, -112], [-150, -86], [-152, -45], [-162, -20], [-165, 18], [-164, 60], [-148, 76], [-125, 82], [-106, 70]]) },
    // Unter den Linden ends at the Lustgarten; across the Liebknechtbrücke it runs on through the forum to the Alex.
    { name: 'Karl-Liebknecht-Straße', kind: 'main', width: 14, profile: 'haupt', sidewalk: 3, pts: line([[-152, -45], [-110, -50], [-60, -68], [-2, -74], [40, -66], [60, -62]]) },
    // Zone 1: Nikolaiviertel and the Spree bank.
    { name: 'Spandauer Straße', kind: 'side', width: 8, pts: line([[-74, 58], [-70, 30], [-66, 16]]) },
    { name: 'Poststraße', kind: 'side', width: 6, pts: line([[-72, 60], [-50, 74], [-40, 88], [-30, 104]]) },
    { name: 'Spreeufer', kind: 'side', width: 8, sidewalk: 3, pts: line([[-30, 110], [22, 112], [68, 110], [100, 104], [124, 96], [150, 92], [199, 96]]) },
    { name: 'Jüdenstraße', kind: 'side', width: 6, pts: line([[0, 18], [2, 60], [10, 98], [22, 112]]) },
    // Around the forum: the Rathausstraße south of it, through an arch to the Alexanderstraße.
    { name: 'Rathausstraße', kind: 'main', width: 10, pts: line([[-66, 16], [-20, 18], [20, 16], [70, 2], [108, -12]]) },
    // Zone 2: east of the Stadtbahn.
    { name: 'Alexanderstraße', kind: 'main', width: 12, pts: line([[104, -40], [108, -12], [118, 30], [134, 70], [150, 92]]) },
    { name: 'Lichtenberger Straße', kind: 'side', width: 8, pts: line([[186, 96], [184, 40], [184, -30]]) },
    // The Allee: a wide boulevard with a green middle strip (real 90 m, here 22 m), no tram.
    { name: 'Karl-Marx-Allee', kind: 'main', width: 22, profile: 'allee', sidewalk: 3, pts: line([[104, -38], [150, -34], [199, -30]]) },
    { name: 'Schillingstraße', kind: 'side', width: 7, pts: line([[150, -45], [150, -110]]) },
    { name: 'Otto-Braun-Straße', kind: 'side', width: 9, pts: line([[100, -46], [98, -100], [96, -153]]) },
    // North of the viaduct: the old Spandauer Vorstadt behind the station (not on the route).
    { name: 'Neue Promenade', kind: 'side', width: 7, pts: line([[-100, -143], [-40, -134], [24, -120], [60, -112]]) },
    { name: 'Mollstraße', kind: 'side', width: 8, pts: line([[98, -112], [150, -112], [199, -114]]) },
    // M16b side passages: the hidden blessing in the churchyard of the Marienkirche, a cache in a
    // Nikolaiviertel yard, a sleeping elite in a Plattenbau courtyard.
    { name: 'Kirchhof', kind: 'path', width: 4, pts: line([[-50, -66], [-58, -50], [-60, -38]]) },
    { name: 'Hofgasse', kind: 'path', width: 4, pts: line([[2, 60], [-14, 54], [-20, 44]]) },
    { name: 'Plattenhof', kind: 'path', width: 4.5, pts: line([[150, -100], [166, -92], [178, -86]]) },
  ];

  // The Stadtbahn on its brick viaduct, cut at the arches the streets pass through.
  const rail = line(STADTBAHN);
  const lenOf = (pts: readonly Pt[]): number[] => {
    const out = [0];
    for (let i = 1; i < pts.length; i++) out.push(out[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    return out;
  };
  const acc = lenOf(rail);
  /** Distance along the rail of its point nearest to (x, z). */
  const project = (x: number, z: number): number => {
    let best = Infinity, at = 0;
    for (let i = 1; i < rail.length; i++) {
      const [ax, az] = rail[i - 1]!, [bx, bz] = rail[i]!, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; at = acc[i - 1]! + Math.sqrt(l2) * t; }
    }
    return at;
  };
  /** The rail between two distances along it. */
  const cut = (a: number, b: number): Pt[] => {
    const at = (d: number): Pt => {
      for (let i = 1; i < rail.length; i++) if (d <= acc[i]! || i === rail.length - 1) {
        const t = (d - acc[i - 1]!) / (acc[i]! - acc[i - 1]!), [ax, az] = rail[i - 1]!, [bx, bz] = rail[i]!;
        return [ax + (bx - ax) * t, az + (bz - az) * t];
      }
      return rail[rail.length - 1]!;
    };
    return [at(a), ...rail.filter((_, i) => acc[i]! > a && acc[i]! < b), at(b)];
  };
  const crossing = (name: string): number => {
    const st = streets.find((q) => q.name === name)!;
    // The street point closest to the rail.
    let best = Infinity, at = 0;
    for (let i = 1; i < st.pts.length; i++) {
      const [ax, az] = st.pts[i - 1]!, [bx, bz] = st.pts[i]!;
      for (let t = 0; t <= 1; t += 0.02) {
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t, d = project(x, z), [rx, rz] = cut(d, d)[0]!;
        const dd = Math.hypot(x - rx, z - rz);
        if (dd < best) { best = dd; at = d; }
      }
    }
    return at;
  };
  const arches = ARCHES.map((a) => ({ ...a, at: crossing(a.name) })).sort((p, q) => p.at - q.at);
  const viaducts: Viaduct[] = [];
  let from = 0;
  for (const a of arches) {
    viaducts.push({ name: 'Stadtbahn', kind: 'stadtbahn', width: 10, h: 6.5, pts: cut(from, a.at - a.w / 2) });
    from = a.at + a.w / 2;
  }
  viaducts.push({ name: 'Stadtbahn', kind: 'stadtbahn', width: 10, h: 6.5, pts: cut(from, acc[acc.length - 1]!) });

  // First area that contains a point wins.
  const areas: Area[] = [
    { id: 'hackescher', name: 'Hackescher Markt', ground: 'asphalt', frontage: 'altbau', trees: 0.3, specials: ['hinterhof'], poly: line([[-210, -160], [-100, -160], [-100, -106], [-210, -106]]) },
    { id: 'museumsinsel', name: 'Museumsinsel', ground: 'cobbles', frontage: null, trees: 0.7, specials: ['kleingarten', 'markt'], poly: line([[-200, -106], [-112, -106], [-104, 40], [-78, 92], [-70, 112], [-140, 112], [-200, 96]]) },
    { id: 'spandauer', name: 'Spandauer Vorstadt', ground: 'cobbles', frontage: 'altbau', trees: 0.4, specials: ['hinterhof'], poly: line([[-100, -160], [96, -160], [32, -88], [-2, -82], [-60, -78], [-100, -62]]) },
    { id: 'forum', name: 'Rathausforum', ground: 'grass', frontage: null, trees: 1, specials: ['kirchhof'], poly: line([[-100, -62], [-60, -78], [-2, -82], [32, -88], [62, -22], [70, 6], [20, 10], [-66, 10], [-100, 30]]) },
    { id: 'alexanderplatz', name: 'Alexanderplatz', ground: 'cobbles', frontage: null, trees: 0.2, specials: ['markt'], poly: line([[96, -160], [96, -46], [108, -20], [70, 6], [62, -22], [32, -88]]) },
    { id: 'nikolaiviertel', name: 'Nikolaiviertel', ground: 'cobbles', frontage: 'altbau', trees: 0.3, specials: ['hinterhof', 'markt'], poly: line([[-100, 30], [-66, 10], [40, 10], [50, 160], [-100, 160]]) },
    { id: 'rolandufer', name: 'Rolandufer', ground: 'asphalt', frontage: 'platte', trees: 0.5, specials: ['baustelle', 'parkplatz'], poly: line([[40, 10], [70, 6], [108, -20], [118, 40], [150, 160], [50, 160]]) },
    { id: 'holzmarkt', name: 'Holzmarkt', ground: 'asphalt', frontage: 'platte', trees: 0.6, specials: ['baustelle', 'parkplatz'], poly: line([[118, 40], [108, -20], [210, -20], [210, 160], [150, 160]]) },
    { id: 'allee', name: 'Karl-Marx-Allee', ground: 'asphalt', frontage: 'platte', trees: 0.8, specials: ['kleingarten', 'parkplatz'], poly: line([[96, -46], [96, -160], [210, -160], [210, -20], [108, -20]]) },
  ];

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 3, extra: Partial<Landmark> = {}): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear, ...extra });
  const landmarks: Landmark[] = [
    // Museumsinsel.
    L('altesmuseum', -150, -88, 0, 16, 4.5, 1),
    L('dom', -135, -28, 90 * DEG, 12, 13, 2),
    L('palast', -138, 38, 270 * DEG, 9, 18, 2),
    // The forum inside the loop.
    L('fernsehturm', -25, -28, 0, 9, 9, 6),
    L('marienkirche', -70, -38, 270 * DEG, 5, 11, 2),
    L('neptunbrunnen', -42, -2, 0, 5, 5, 2),
    // Nikolaiviertel and the Rathaus.
    L('rotesrathaus', -40, 40, 0, 20, 12, 2),
    L('nikolaikirche', -12, 80, 0, 5.5, 10, 2),
    // Alexanderplatz: the clock (it wakes up as the final boss), the fountain, the hotel tower, the station on the viaduct.
    L('weltzeituhr', 72, -62, 0, 2.5, 2.5, 4),
    L('brunnen', 70, -100, 0, 7, 7, 2),
    L('hotelstadtberlin', 66, -142, 0, 14, 7, 2),
    L('sbahnalex', 28, -64, Math.atan2(35, 53), 6, 20, 0, { walkUnder: true, name: 'Alexanderplatz' }),
    L('sbahnhackescher', -150, -130, 90 * DEG, 5, 16, 0, { walkUnder: true, name: 'Hackescher Markt' }),
    // Karl-Marx-Allee: tall on the north side, low on the camera side.
    L('hausdeslehrers', 124, -68, 0, 11, 11, 2),
    L('kongresshalle', 126, -6, 0, 10, 7, 2),
    L('kino', 168, -92, 0, 15, 7, 2),
    L('cafemoskau', 148, 4, 0, 11, 7, 2),
    // Späti rest stops, one per zone beside the route (front to the street).
    { ...L('spati', -128, -74, 270 * DEG, 5.5, 4, 2), name: 'Späti am Lustgarten' },
    { ...L('spati', -9, 40, 90 * DEG, 5.5, 4, 2), name: 'Späti an der Jüdenstraße' },
    { ...L('spati', 162, 30, 90 * DEG, 5.5, 4, 2), name: 'Späti an der Holzmarktstraße' },
    { ...L('spati', 40, -120, 0, 5.5, 4, 2), name: 'Späti am Alex' },
  ];

  const endOf = (name: string, back: number, side: number): { x: number; z: number } => {
    const pts = streets.find((st) => st.name === name)!.pts, [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    const ux = (ex - px) / l, uz = (ez - pz) / l;
    return { x: ex - ux * back + uz * side, z: ez - uz * back - ux * side };
  };
  // Light under the viaduct arches and along the Allee middle strip: fires where people gather.
  const lights: Prop[] = [];
  for (const a of arches) {
    const [x, z] = cut(a.at, a.at)[0]!;
    lights.push({ kind: 'fireBarrel', x: x + 3, z: z - 3, rot: 0, size: 1 });
  }
  // Down the middle of the wide streets (Allee green strip, Liebknechtstraße), where curb lamps do not reach.
  const middle = (name: string, step: number, first: number, off: number): void => {
    const pts = streets.find((q) => q.name === name)!.pts;
    let at = first, i = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; at < len; at += step, i++) {
        const o = (i % 2 ? 1 : -1) * off;
        let x = ax + ux * at - uz * o, z = az + uz * at + ux * o;
        // A light inside a fight circle moves out to its rim (the fight stays open, its edge stays lit).
        const e = encounters.find((q) => Math.hypot(x - q.x, z - q.z) < q.r + 1);
        if (e) {
          const d = Math.hypot(x - e.x, z - e.z) || 1;
          x = e.x + ((x - e.x) / d) * (e.r + 1.5);
          z = e.z + ((z - e.z) / d) * (e.r + 1.5);
          if (lights.some((l) => Math.hypot(l.x - x, l.z - z) < 6)) continue;
        }
        if (zones.some((q) => Math.hypot(x - q.entry.x, z - q.entry.z) < 4)) continue;
        lights.push({ kind: 'fireBarrel', x, z, rot: i * 1.7, size: 0.7 + ((i * 37) % 7) / 10 });
      }
      at -= len;
    }
  };
  middle('Karl-Marx-Allee', 11 * Math.sqrt(s), 6, 2.5);
  middle('Karl-Liebknecht-Straße', 16 * Math.sqrt(s), 8, 3);
  middle('Alexanderstraße', 18 * Math.sqrt(s), 9, 2);
  // Streets that run out of the map get fires before their barricade; the corner of the Rathaus gets one too.
  for (const st of streets) {
    if (st.kind === 'path') continue;
    for (const [e, f] of [[st.pts[0]!, st.pts[1]!], [st.pts[st.pts.length - 1]!, st.pts[st.pts.length - 2]!]] as Array<[Pt, Pt]>) {
      const B = { minX: -195 * s, maxX: 195 * s, minZ: -150 * s, maxZ: 145 * s };
      if (Math.min(e[0] - B.minX, B.maxX - e[0], e[1] - B.minZ, B.maxZ - e[1]) > 12) continue;
      const l = Math.hypot(f[0] - e[0], f[1] - e[1]), ux = (f[0] - e[0]) / l, uz = (f[1] - e[1]) / l, side = st.width / 2 - 1.2;
      // The barricade at the end brings its own work lamp (`edgeProps`); fires stand a little further in.
      for (const k of [0, 1]) { const t = 4 * s + 7 + k * 12; lights.push({ kind: 'fireBarrel', x: e[0] + ux * t - uz * side, z: e[1] + uz * t + ux * side, rot: 0.6, size: k ? 0.8 : 1 }); }
    }
  }
  // The Koloss arena spans the whole Allee: fires on both curbs at its rim.
  const allee = encounters.find((e) => e.id === 'allee')!;
  for (const k of [-1, 1]) lights.push({ kind: 'fireBarrel', x: allee.x, z: allee.z + k * (allee.r + 1.5), rot: k, size: 1.2 });
  lights.push({ kind: 'fireBarrel', x: -48 * s, z: 11 * s, rot: 0, size: 1.1 }, { kind: 'candles', x: -150 * s, z: -40 * s, rot: 0, size: 0.8 });
  const yards: Prop[] = [
    { kind: 'crates', ...endOf('Hofgasse', 1.2, 0), rot: 0.4, size: 1.2 }, { kind: 'crate', ...endOf('Hofgasse', 3, -1.2), rot: 1, size: 1 }, { kind: 'crate', ...endOf('Hofgasse', 3, 1.2), rot: -0.3, size: 1 },
    { kind: 'workLamp', ...endOf('Hofgasse', 5, 1.4), rot: -0.8, size: 1 }, { kind: 'candles', ...endOf('Kirchhof', 3.5, 1.2), rot: 0, size: 1 }, { kind: 'fireBarrel', ...endOf('Plattenhof', 5, -1.3), rot: 0, size: 1 },
    ...lane(streets.find((st) => st.name === 'Hofgasse')!, 'fence'),
    ...lane(streets.find((st) => st.name === 'Kirchhof')!, 'fence'),
    ...lane(streets.find((st) => st.name === 'Plattenhof')!, 'bauzaun'),
  ];

  return {
    id: 'alex',
    name: 'Alexanderplatz',
    bounds: { minX: -195 * s, maxX: 195 * s, minZ: -150 * s, maxZ: 145 * s },
    start: zones[0]!.entry,
    rivers,
    lakes: [],
    islands: [],
    bridges,
    streets,
    areas,
    defaultGround: 'cobbles',
    landmarks,
    encounters,
    zones,
    rail: null,
    hills: [],
    terraces: [],
    district: 2,
    flavor: 'gdr',
    viaducts,
    hiddenSpots: [endOf('Kirchhof', 1.2, 0)],
    guards: [{ ...endOf('Plattenhof', 2, 0), kind: 'brute', elite: true, wake: 8, hp: 2.6 }],
    fixedProps: [...yards, ...lights],
    seed: 1989,
  };
}
