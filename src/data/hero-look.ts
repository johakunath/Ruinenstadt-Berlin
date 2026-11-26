// What the hero wears for the equipped items (H1 step 4, WP4 step 2; docs/tasks/wp4-equipment-visuals.md).
// Plain data, no Three.js. The rule is the 2D one (`heroKeys` and `drawHero` in js/art.js): the outfit
// follows the armor base, gloves the glove slot (none = bare hands), boots the boot slot (none = boots).
// WP4 step 2 adds per base: a palette on the pieces (`PALETTES`), a cut of the coat skirt (jackets and
// mid-length coats), shoulder volume, and rigid gear parts (`src/render/gear.ts`). Looks follow the
// approved mockups in docs/mockups/wp4-clothes/ (Johannes, 2026-11-19).
import type { BodyRegion } from './hero-contract';
import type { SetId, SlotId } from './items';

export type { BodyRegion };

/** Coat skirt cut heights (m): the whole skirt off (jacket), or cut on one of its rows. */
export const CUT = { none: 0, jacket: 1.2, hip: 0.88, thigh: 0.79, knee: 0.69 } as const;

export interface HeroLook {
  outfit: string;
  /** Coat skirt cut (`CUT`); 0 keeps the whole coat. Only the `mantel` piece has a skirt. */
  cut: number;
  boots: string;
  gloves: string | null;
  /** Palette ids (`PALETTES`) of the outfit, boots, gloves and scarf; '' keeps the source colours. */
  tint: { readonly outfit: string; readonly boots: string; readonly gloves: string; readonly scarf: string };
  /** Shoulder volume (m): the outfit pushed out along its normals around the shoulders. */
  puff: number;
  /** Rigid gear parts (`GEAR` ids in src/render/gear.ts), sorted. */
  gear: readonly string[];
  hideHair: boolean;
  /** No scarf: the look has its own collar or neck piece, or the scarf does not fit (Johannes, 2026-11-19). */
  hideScarf: boolean;
  /** Body regions under gear (boxing gloves cover the hands). */
  covers: readonly BodyRegion[];
  /**
   * W10: the armor's Pixal3D outfit (`assets/gear/outfit-<id>.glb`), or null. While it is loaded the renderer shows
   * it instead of the outfit piece and drops `armorGear`; until then (and without it) the code look above stands.
   */
  aiOutfit: string | null;
  /** The armor's own gear ids (dropped under an AI outfit, which has its own plates and belts). */
  armorGear: readonly string[];
}

/** A clothing piece: its mesh node in hero.glb and the body regions it hides. */
export interface Piece {
  node: string;
  hides: readonly BodyRegion[];
}

export const PIECES: Readonly<Record<string, Piece>> = {
  mantel: { node: 'a_mantel', hides: ['torso', 'arms', 'legs'] },
  weste: { node: 'a_weste', hides: ['torso', 'legs'] },
  // B1 (LA3): rain poncho over a dark shirt and trousers (tools/blender/hero_clothes.py `poncho`).
  poncho: { node: 'a_poncho', hides: ['torso', 'arms', 'legs'] },
  stiefel: { node: 'f_stiefel', hides: ['feet'] },
  turnsch: { node: 'f_turnsch', hides: ['feet'] },
  // LA3: wrapped knee boots, Quaternius Outfits Fantasy (Female_Ranger_Feet), `ranger_boots` in hero_clothes.py.
  wickel: { node: 'f_wickel', hides: ['feet'] },
  handsch: { node: 'g_handsch', hides: ['hands'] },
};

/**
 * Colour roles of the pieces' vertices (`src/render/hero-wear.ts` sorts each vertex into one by its
 * source colour and place). A palette sets a role's colour; brightness (baked occlusion, noise) is kept.
 * a_mantel: coat (body, sleeves, skirt), hem (last skirt row, or the row at a cut), cuff (sleeve ends),
 * leather (belt, pouch), brass, trousers. a_weste: vest, straps (chest), belt, thigh (strap), brass,
 * cargo (trousers). f_stiefel: boot, sole. f_turnsch: upper, sole. g_handsch: glove, cuff. scarf: scarf.
 */
export type Role = 'coat' | 'hem' | 'cuff' | 'leather' | 'brass' | 'trousers' | 'vest' | 'straps' | 'belt' | 'thigh' | 'cargo' | 'boot' | 'sole' | 'upper' | 'glove' | 'scarf';

/** A stripe painted on roles by height (`y`) or by distance from the body's middle (`x`, for sleeves). `wave`: amplitude (m) of a wavy edge. */
export interface Band { roles: readonly Role[]; axis: 'y' | 'x'; from: number; to: number; hex: string; wave?: number }
/** A patch painted on roles round a point of the bind pose (m); `front`/`back` limit it to one side. */
export interface Spot { roles: readonly Role[]; x: number; y: number; r: number; hex: string; side?: 'front' | 'back' }
/**
 * KA part B (`docs/tasks/kit-texture-atlas.md`): a second, tiling material on chosen roles of a detail piece
 * (`DETAIL_PIECES` in `src/render/hero-wear.ts`). One packed texture holds the four, one per channel (LA4: fur in alpha).
 */
export type DetailId = 'denim' | 'mail' | 'patch' | 'fur';
/** Channel in the packed detail texture (= its cell in `detail.webp`), tile size (m), and the cell's mean sRGB tone (measured; a test reads the file again). */
export const DETAILS: Readonly<Record<DetailId, { channel: 0 | 1 | 2 | 3; tile: number; tone: number }>> = {
  denim: { channel: 0, tile: 0.5, tone: 180 }, mail: { channel: 1, tile: 0.3, tone: 180 }, patch: { channel: 2, tile: 0.5, tone: 180 },
  fur: { channel: 3, tile: 0.4, tone: 180 },
};
export interface Palette { roles: Partial<Record<Role, string>>; bands?: readonly Band[]; spots?: readonly Spot[]; detail?: Partial<Record<Role, DetailId>> }

const COAT: readonly Role[] = ['coat', 'hem', 'cuff'];

/** Palettes. Colours are the mockup's (docs/mockups/wp4-clothes/items.mjs). */
export const PALETTES: Readonly<Record<string, Palette>> = {
  // Körper: Köpenick
  mantel: { roles: { coat: '#6b6538', hem: '#4a4626', cuff: '#4a4626', trousers: '#4a4038', leather: '#3a2414' } },
  // Körper: Xhain
  // KA B2: denim jeans with worn, lighter knees.
  leder: { roles: { coat: '#2a2426', hem: '#1a1416', cuff: '#1a1416', trousers: '#3a4a6a', leather: '#141012', brass: '#d8dce0' }, detail: { trousers: 'denim' },
    spots: [{ roles: ['trousers'], x: 0.1, y: 0.5, r: 0.06, hex: '#5a6e94', side: 'front' }, { roles: ['trousers'], x: -0.1, y: 0.5, r: 0.06, hex: '#5a6e94', side: 'front' }] },
  feuer: { roles: { coat: '#a8281a', hem: '#e8d36a', cuff: '#6a160e', trousers: '#2a2c38', leather: '#1e1a1a', brass: '#b8bcc0' },
    bands: [{ roles: COAT, axis: 'y', from: 1.24, to: 1.275, hex: '#e8d36a' }, { roles: COAT, axis: 'x', from: 0.47, to: 0.5, hex: '#e8d36a' }, { roles: ['trousers'], axis: 'y', from: 0.25, to: 0.285, hex: '#e8d36a' }] },
  bvg: { roles: { coat: '#26304a', hem: '#f2c230', cuff: '#f2c230', trousers: '#222a40', leather: '#141620', brass: '#f2c230' } },
  // Körper: Alexanderplatz, Mitte
  blaumann: { roles: { vest: '#2463a5', cargo: '#2463a5', straps: '#1c4f86', belt: '#1c4f86', thigh: '#1c4f86', brass: '#b58a3d' } },
  // The mockup's lower glowing hem band, painted (the skirt bends with the legs: no rigid part there).
  poncho: { roles: { coat: '#3a6070', hem: '#2e4c5a', cuff: '#2e4c5a', trousers: '#2a2c34', leather: '#22262c', brass: '#43d1cf' },
    bands: [{ roles: COAT, axis: 'y', from: 0.78, to: 0.8, hex: '#2fa6a8' }] },
  kmantel: { roles: { coat: '#3e2c48', hem: '#bd2b77', cuff: '#bd2b77', trousers: '#24222a', leather: '#1a1820', brass: '#43d1cf' } },
  // Körper: sets
  'weste:kiez': { roles: { vest: '#2f62b0', straps: '#f08a24', belt: '#141a2a', thigh: '#141a2a', cargo: '#1e2a48', brass: '#f08a24' },
    bands: [{ roles: ['vest'], axis: 'y', from: 1.13, to: 1.16, hex: '#f08a24' }, { roles: ['vest'], axis: 'y', from: 1.19, to: 1.22, hex: '#f08a24' }] },
  'mantel:spree': { roles: { coat: '#1f7a6a', hem: '#0e4a40', cuff: '#0e4a40', trousers: '#1e3a36', leather: '#2aa890', brass: '#cfe8e0' },
    bands: [{ roles: COAT, axis: 'y', from: 0.6, to: 0.635, hex: '#7fe0c8', wave: 0.018 }, { roles: COAT, axis: 'y', from: 0.665, to: 0.69, hex: '#5ac8b0', wave: 0.018 }] },
  // Steel darker than the mockup's base; the mail rings (KA B2 detail) sit on coat, hem and cuffs.
  'kette:zit': { roles: { coat: '#6c727a', hem: '#4a5058', cuff: '#4a5058', trousers: '#3a3c42', leather: '#5a2a1a', brass: '#e0b040' }, detail: { coat: 'mail', hem: 'mail', cuff: 'mail' } },
  // Körper: legendaries
  // KA B2: patchwork squares under the coloured patches.
  spaeti: { roles: { coat: '#5a2a78', hem: '#3a1a50', cuff: '#3a1a50', trousers: '#2a2430', leather: '#2a1a1a', brass: '#f2d14b' }, detail: { coat: 'patch', hem: 'patch', cuff: 'patch' },
    spots: [
      { roles: COAT, x: -0.12, y: 0.98, r: 0.045, hex: '#e07020', side: 'front' }, { roles: COAT, x: 0.13, y: 0.84, r: 0.05, hex: '#2f8a4a', side: 'front' },
      { roles: COAT, x: -0.16, y: 0.66, r: 0.05, hex: '#d8c040', side: 'front' }, { roles: COAT, x: 0.1, y: 0.6, r: 0.045, hex: '#c8302a', side: 'front' },
      { roles: COAT, x: 0.09, y: 0.9, r: 0.05, hex: '#3a7ac0', side: 'back' }, { roles: COAT, x: -0.1, y: 0.7, r: 0.05, hex: '#e07020', side: 'back' },
      { roles: COAT, x: 0.44, y: 1.42, r: 0.04, hex: '#d8c040' }, { roles: COAT, x: -0.36, y: 1.42, r: 0.04, hex: '#2f8a4a' },
    ] },
  panzer: { roles: { coat: '#4a4640', hem: '#2e2c28', cuff: '#2e2c28', trousers: '#33312c', leather: '#2a2420', brass: '#c8ccd0' } },
  // LA4: the T8 rat fur (KA B2 detail, alpha channel) on coat, hem and cuffs.
  rattenmantel: { roles: { coat: '#5a4c40', hem: '#3a3028', cuff: '#3a3028', trousers: '#2e2a26', leather: '#2a2018', brass: '#97c459' }, detail: { coat: 'fur', hem: 'fur', cuff: 'fur' },
    spots: [
      { roles: COAT, x: 0.12, y: 0.78, r: 0.07, hex: '#4a3e34' }, { roles: COAT, x: -0.1, y: 0.62, r: 0.07, hex: '#6a5a4c' },
      { roles: COAT, x: -0.14, y: 0.9, r: 0.06, hex: '#4a3e34' }, { roles: COAT, x: 0.08, y: 1.2, r: 0.06, hex: '#6a5a4c' },
      { roles: COAT, x: 0.4, y: 1.42, r: 0.05, hex: '#4a3e34' }, { roles: COAT, x: -0.45, y: 1.42, r: 0.05, hex: '#6a5a4c' },
    ] },
  ritter: { roles: { coat: '#383e48', hem: '#262a32', cuff: '#262a32', trousers: '#2a2e36', leather: '#22262e', brass: '#d8dce0' } },
  // Hände
  arbeit: { roles: { glove: '#8a6a3a', cuff: '#6e5430' } },
  schweiss: { roles: { glove: '#5a3a24', cuff: '#6a4630' } },
  bandage: { roles: { glove: '#e8ddd0', cuff: '#e8ddd0' } },
  gartenh: { roles: { glove: '#5a8a3a', cuff: '#f3ce43' } },
  kiezhand: { roles: { glove: '#2f62b0', cuff: '#f08a24' } },
  // Füße
  gummi: { roles: { boot: '#2f5a32', sole: '#7a5a2a' } },
  schaffner: { roles: { boot: '#1f2430', sole: '#0c0e12' } },
  spreestief: { roles: { boot: '#1e5a4a', sole: '#1e2a26' }, bands: [{ roles: ['boot'], axis: 'y', from: 0.5, to: 0.535, hex: '#2aa890' }] },
  eisenstief: { roles: { boot: '#7a8088', sole: '#2a2c30' } },
  turnsch: { roles: { upper: '#ece6da', sole: '#d8d0c0' } },
  // Scarves of the legendary coats
  'scarf:gold': { roles: { scarf: '#f2d14b' } },
  'scarf:acid': { roles: { scarf: '#97c459' } },
  // Tunnelläufer (mockup `tunnel`): ochre-olive coat, BVG-yellow hem and cuffs, cargo trousers; heavy boots.
  // Brass buttons as the mockup's (the yellow buckle is the gear belt's).
  'mantel:tunnel': { roles: { coat: '#7a6a34', hem: '#e0a020', cuff: '#e0a020', trousers: '#3a3c36', leather: '#3a2414', brass: '#c9a34a' } },
  'stiefel:tunnel': { roles: { boot: '#3a2a1c', sole: '#1e140c' } },
  // M18 Pracht des Ewigen Gasts (board Wedding): emerald kaftan, ruby hem and trousers, gold brass; gold gloves, ruby boots.
  'mantel:gast': { roles: { coat: '#1f6a4a', hem: '#9a1c3a', cuff: '#d4a62a', trousers: '#7a1830', leather: '#4a2a18', brass: '#f2d14b' } },
  'handsch:gast': { roles: { glove: '#c8a040', cuff: '#9a1c3a' } },
  'stiefel:gast': { roles: { boot: '#8a1c34', sole: '#c8a040' } },
};

/** What one item base puts on the hero. Every field is optional; the slot's default fills the rest. */
interface Wear {
  outfit?: 'mantel' | 'weste' | 'poncho';
  cut?: number;
  boots?: 'stiefel' | 'turnsch' | 'wickel';
  gloves?: 'handsch' | null;
  palette?: string;
  /** Scarf palette, or 'none' for no scarf. Without an entry the red scarf stays (the coats). */
  scarf?: string;
  puff?: number;
  gear?: readonly string[];
  hideHair?: boolean;
  covers?: readonly BodyRegion[];
  /** W10: Pixal3D outfit id (the armor slot only). */
  ai?: string;
}

/** Shoulder volume of every outfit (Johannes, 2026-11-19: more volume round the shoulders). */
const PUFF = 0.012;

/**
 * Wear per slot and base; a set piece on a shared base is keyed `base:set` (looked up first). Bases
 * missing here fall back to the slot default (all are listed; `hero-look.test.ts` checks it).
 */
export const WEAR: Readonly<Record<'a' | 'h' | 'g' | 'f', Readonly<Record<string, Wear>>>> = {
  a: {
    mantel: { palette: 'mantel', puff: 0.02, gear: ['belt-tool'], ai: 'mantel' },
    weste: { outfit: 'weste', scarf: 'none', gear: ['kneepads-dark'] },
    leder: { cut: CUT.jacket, palette: 'leder', scarf: 'none', puff: 0.016, gear: ['studs', 'belt-studded', 'patches-punk', 'rips'], ai: 'leder' },
    feuer: { cut: CUT.thigh, palette: 'feuer', scarf: 'none', puff: 0.024, gear: ['belt-fire', 'collar-fire'] },
    bvg: { cut: CUT.hip, palette: 'bvg', scarf: 'none', puff: 0.018, gear: ['boards-bvg', 'badge-bvg', 'belt-bvg'] },
    blaumann: { outfit: 'weste', palette: 'blaumann', scarf: 'none', gear: ['bib', 'patch-gear', 'wrench'], ai: 'blaumann' },
    poncho: { outfit: 'poncho', palette: 'poncho', scarf: 'none', puff: 0.026, gear: ['poncho-bands', 'hood-roll'] },
    kmantel: { palette: 'kmantel', scarf: 'none', puff: 0.018, gear: ['collar-high', 'cables', 'belt-led'], ai: 'kmantel' },
    spaeti: { palette: 'spaeti', scarf: 'scarf:gold', gear: ['caps', 'sign-spaeti', 'belt-caps'], ai: 'spaeti' },
    panzer: { palette: 'panzer', scarf: 'none', puff: 0.006, gear: ['plate-panzer', 'pauldrons-panzer', 'belt-plain'], ai: 'panzer' },
    rattenmantel: { palette: 'rattenmantel', scarf: 'scarf:acid', puff: 0.018, gear: ['collar-fur', 'belt-rattails'], ai: 'rattenmantel' },
    ritter: { palette: 'ritter', scarf: 'none', puff: 0.006, gear: ['gorget', 'plate-ritter', 'pauldrons-ritter', 'vambraces', 'tassets', 'belt-knight'], ai: 'ritter' },
    'weste:kiez': { outfit: 'weste', palette: 'weste:kiez', scarf: 'none', gear: ['collar-stand', 'radio', 'whistle', 'armband', 'belt-duty', 'print-kiez', 'kneepads-orange'], ai: 'weste-kiez' },
    'mantel:spree': { palette: 'mantel:spree', scarf: 'none', gear: ['collar-reed', 'seams-spree', 'belt-sash'], ai: 'mantel-spree' },
    'kette:zit': { cut: CUT.knee, palette: 'kette:zit', scarf: 'none', gear: ['tabard', 'belt-knight-short'], ai: 'kette-zit' },
    'mantel:tunnel': { palette: 'mantel:tunnel', scarf: 'none', gear: ['harness', 'kneepads-teal', 'belt-tunnel'], ai: 'mantel-tunnel' },
    'mantel:gast': { palette: 'mantel:gast', scarf: 'none', puff: 0.024, gear: ['belt-plain'] },
  },
  h: {
    helm: { gear: ['hat-hard'] },
    schieber: { gear: ['hat-flatcap'] },
    muetze: { gear: ['hat-beanie'] },
    maske: { gear: ['hat-gasmask'] },
    nbrille: { gear: ['hat-goggles'] },
    stroh: { gear: ['hat-straw'] },
    pickel: { gear: ['hat-pickel'] },
    kiezhelm: { gear: ['hat-kiez'] },
    topfhelm: { gear: ['hat-greathelm'], hideHair: true },
    'nbrille:tunnel': { gear: ['hat-headlamp'] },
  },
  g: {
    handsch: { palette: 'arbeit', gear: ['wrist-work'] },
    bandage: { palette: 'bandage', gear: ['wraps'] },
    schweiss: { palette: 'schweiss', gear: ['cuffs-welder'] },
    gartenh: { palette: 'gartenh', gear: ['wrist-garden'] },
    kiezbox: { gloves: null, gear: ['boxing'], covers: ['hands'] },
    kiezhand: { palette: 'kiezhand', gear: ['knuckles-kiez', 'wrist-kiez'] },
    'handsch:gast': { palette: 'handsch:gast' },
  },
  f: {
    turnsch: { boots: 'turnsch', palette: 'turnsch', gear: ['sneaker-stripes'] },
    stiefel: {},
    gummi: { palette: 'gummi', gear: ['shaft-rubber'] },
    schaffner: { palette: 'schaffner', gear: ['shaft-riding'] },
    spreestief: { boots: 'wickel', palette: 'spreestief' },
    eisenstief: { palette: 'eisenstief', gear: ['greaves'] },
    'stiefel:tunnel': { palette: 'stiefel:tunnel', gear: ['puttees'] },
    'stiefel:gast': { palette: 'stiefel:gast' },
  },
};

type Equipped = { readonly base: string; readonly set?: SetId };

/** The wear entry of an item: `base:set` first, then the base. */
function wearOf(slot: 'a' | 'h' | 'g' | 'f', item: Equipped | undefined): Wear | undefined {
  if (!item) return undefined;
  const t = WEAR[slot];
  return (item.set && t[`${item.base}:${item.set}`]) || t[item.base];
}

export function heroLook(equipment: Readonly<Partial<Record<SlotId, Equipped>>>): HeroLook {
  const a = wearOf('a', equipment.a), h = wearOf('h', equipment.h), g = wearOf('g', equipment.g), f = wearOf('f', equipment.f);
  // No armor: the starter coat in its own colours. An unknown armor base: the coat as well.
  const outfit = a?.outfit ?? 'mantel';
  const gear = [...(a?.gear ?? []), ...(h?.gear ?? []), ...(g?.gear ?? []), ...(f?.gear ?? [])].sort();
  return {
    outfit,
    cut: outfit === 'mantel' ? a?.cut ?? 0 : 0,
    boots: f?.boots ?? 'stiefel',
    gloves: equipment.g ? (g && 'gloves' in g ? g.gloves ?? null : 'handsch') : null,
    tint: { outfit: a?.palette ?? '', boots: f?.palette ?? '', gloves: g?.palette ?? '', scarf: a?.scarf && a.scarf !== 'none' ? a.scarf : '' },
    puff: a?.puff ?? PUFF,
    gear,
    hideHair: !!h?.hideHair,
    hideScarf: a?.scarf === 'none',
    covers: [...(g?.covers ?? [])],
    aiOutfit: a?.ai ?? null,
    armorGear: [...(a?.gear ?? [])],
  };
}

/** Piece nodes shown for a look. */
export function lookNodes(look: HeroLook): string[] {
  return [look.outfit, look.boots, look.gloves].flatMap((p) => (p && PIECES[p] ? [PIECES[p].node] : []));
}

/** Body regions hidden under a look's pieces and gear. */
export function hiddenRegions(look: HeroLook): Set<BodyRegion> {
  return new Set([...[look.outfit, look.boots, look.gloves].flatMap((p) => (p && PIECES[p] ? PIECES[p].hides : [])), ...look.covers]);
}

export function sameLook(a: HeroLook, b: HeroLook): boolean {
  return a.outfit === b.outfit && a.cut === b.cut && a.boots === b.boots && a.gloves === b.gloves && a.puff === b.puff && a.hideHair === b.hideHair && a.hideScarf === b.hideScarf
    && a.tint.outfit === b.tint.outfit && a.tint.boots === b.tint.boots && a.tint.gloves === b.tint.gloves && a.tint.scarf === b.tint.scarf
    && a.gear.length === b.gear.length && a.gear.every((id, i) => id === b.gear[i]) && a.covers.join() === b.covers.join() && a.aiOutfit === b.aiOutfit;
}
