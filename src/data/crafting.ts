// Ported from johakunath/Ruinenstadt at 61bf9198a72f0c21ee33bd67456e252b630efc65.
// Values and German text are unchanged; source constants are named at each table.

import type { Affix, ElementId, EnemyKind } from './items';
import type { CampBuildingId } from './progression';

export type MaterialId = 'stoff' | 'metall' | 'chemie' | 'kabel';
export type IngredientId = 'fleisch' | 'gemuese' | 'gewuerz';
export type WeaponModId = 'nagel' | 'gewicht' | 'batt' | 'tank' | 'phiole' | 'dorn'
  // M13b: strong Aufsätze, sold only at a Späti (`spati`), never built in the Zeughaus.
  | 'stahlnagel' | 'blei' | 'starkstrom' | 'brandsatz' | 'saeure' | 'nato';
export type MealId = 'suppe' | 'curry' | 'kaffee' | 'soljanka' | 'gurke';
export type ConsumableId = 'verband' | 'molotow';

/** 2D MATS pairs. */
export interface MaterialDefinition {
  readonly name: string;
  readonly color: string;
}

/** 2D MODS: recipe, scrap price and optional mechanical effects. */
export interface WeaponModDefinition {
  readonly id: WeaponModId;
  readonly name: string;
  readonly description: string;
  readonly costs: Readonly<Partial<Record<MaterialId, number>>>;
  readonly scrapCost: number;
  readonly affixes?: readonly Affix[];
  readonly eliteBossBonus?: number;
  readonly heavyHitEvery?: number;
  readonly element?: ElementId;
  /** M13b: a strong Aufsatz the Späti sells (no recipe, the Zeughaus cannot build it); `base` is the normal one it outdoes (icon, bot score). */
  readonly spati?: true;
  readonly base?: WeaponModId;
}

/** 2D ZUT triplets, including the non-SVG ingredient glyph. */
export interface IngredientDefinition {
  readonly name: string;
  readonly color: string;
  readonly emoji: string;
}

/** 2D MEALS: ingredient recipe and optional camp-building requirement. */
export interface MealDefinition {
  readonly id: MealId;
  readonly name: string;
  readonly description: string;
  readonly costs: Readonly<Partial<Record<IngredientId, number>>>;
  readonly requiredBuilding?: CampBuildingId;
}

/** 2D CONS entries. */
export interface ConsumableDefinition {
  readonly id: ConsumableId;
  readonly name: string;
  readonly description: string;
  readonly scrapCost: number;
}

/** 2D MATS. */
export const MATERIALS: Readonly<Record<MaterialId, MaterialDefinition>> = {
  stoff: { name: 'Stoff', color: '#d6cfc0' },
  metall: { name: 'Metall', color: '#9aa4b0' },
  chemie: { name: 'Chemie', color: '#97C459' },
  kabel: { name: 'Kabel', color: '#f2a04b' },
};

/** 2D EMAT. */
export const ENEMY_MATERIAL_DROPS: Readonly<Partial<Record<EnemyKind, MaterialId>>> = {
  ghoul: 'stoff',
  rat: 'stoff',
  brute: 'metall',
  shield: 'metall',
  spitter: 'chemie',
  bomb: 'chemie',
  raser: 'kabel',
  crow: 'kabel',
  howl: 'kabel',
  kabel: 'kabel',
  bass: 'metall',
  uhr: 'metall',
  wurz: 'stoff',
  kern: 'chemie',
};

/** 2D MODS. */
export const WEAPON_MODS: readonly WeaponModDefinition[] = [
  { id: 'nagel',
    name: 'Nagelband',
    description: '+20% Schaden, gegen Elite und Endgegner zusätzlich +20%',
    costs: { metall: 4, stoff: 2 },
    scrapCost: 60,
    affixes: [ { id: 'dmg', value: 20 } ],
    eliteBossBonus: 0.2 },
  { id: 'gewicht',
    name: 'Gegengewicht',
    description: 'Jeder 4. Angriff ist ein Wuchttreffer: sicherer Krit, doppelter Rückstoß, kurz betäubt',
    costs: { metall: 5, kabel: 1 },
    scrapCost: 60,
    heavyHitEvery: 4 },
  { id: 'batt',
    name: 'Autobatterie',
    description: 'Strom-Element, auch als zweites Element. +35% Elementarschaden, Element bei jedem 2. statt 3. Treffer',
    costs: { kabel: 4, metall: 2 },
    scrapCost: 70,
    element: 'shock' },
  { id: 'tank',
    name: 'Benzintank',
    description: 'Feuer-Element, auch als zweites Element. +35% Elementarschaden, Element bei jedem 2. statt 3. Treffer',
    costs: { chemie: 3, metall: 3 },
    scrapCost: 70,
    element: 'fire' },
  { id: 'phiole',
    name: 'Säurephiole',
    description: 'Säure-Element, auch als zweites Element. +35% Elementarschaden, Element bei jedem 2. statt 3. Treffer',
    costs: { chemie: 4, stoff: 2 },
    scrapCost: 70,
    element: 'acid' },
  { id: 'dorn',
    name: 'Stacheldraht',
    description: '+5 Leben pro Kill, +10% Widerstand',
    costs: { metall: 3, kabel: 3 },
    scrapCost: 60,
    affixes: [ { id: 'leech', value: 5 }, { id: 'res', value: 10 } ] },
  // M13b (backlog B13, Johannes 2026-11-16: "especially strong Aufsätze"): one step above each 2D mod, only at a
  // Späti from Xhain on. `scrapCost` is the base the Späti markup multiplies (`SPATI_UPGRADE.markup`), twice the 2D one.
  { id: 'stahlnagel', name: 'Stahlnagelband', description: '+30% Schaden, gegen Elite und Endgegner zusätzlich +30%',
    costs: {}, scrapCost: 120, affixes: [ { id: 'dmg', value: 30 } ], eliteBossBonus: 0.3, spati: true, base: 'nagel' },
  { id: 'blei', name: 'Bleigewicht', description: 'Jeder 3. Angriff ist ein Wuchttreffer: sicherer Krit, doppelter Rückstoß, kurz betäubt',
    costs: {}, scrapCost: 120, heavyHitEvery: 3, spati: true, base: 'gewicht' },
  { id: 'starkstrom', name: 'Starkstromakku', description: 'Strom-Element, auch als zweites Element. +60% Elementarschaden, Element bei jedem 2. Treffer',
    costs: {}, scrapCost: 140, element: 'shock', affixes: [ { id: 'el', value: 25 } ], spati: true, base: 'batt' },
  { id: 'brandsatz', name: 'Brandsatz', description: 'Feuer-Element, auch als zweites Element. +60% Elementarschaden, Element bei jedem 2. Treffer',
    costs: {}, scrapCost: 140, element: 'fire', affixes: [ { id: 'el', value: 25 } ], spati: true, base: 'tank' },
  { id: 'saeure', name: 'Säurekanister', description: 'Säure-Element, auch als zweites Element. +60% Elementarschaden, Element bei jedem 2. Treffer',
    costs: {}, scrapCost: 140, element: 'acid', affixes: [ { id: 'el', value: 25 } ], spati: true, base: 'phiole' },
  { id: 'nato', name: 'NATO-Draht', description: '+8 Leben pro Kill, +15% Widerstand',
    costs: {}, scrapCost: 120, affixes: [ { id: 'leech', value: 8 }, { id: 'res', value: 15 } ], spati: true, base: 'dorn' },
];

/** 2D ZUT. */
export const INGREDIENTS: Readonly<Record<IngredientId, IngredientDefinition>> = {
  fleisch: { name: 'Fleisch', color: '#c0614a', emoji: '🍖' },
  gemuese: { name: 'Gemüse', color: '#8fd16a', emoji: '🥕' },
  gewuerz: { name: 'Gewürze', color: '#e0a43a', emoji: '🌶️' },
};

/** 2D EZUT. */
export const ENEMY_INGREDIENT_DROPS: Readonly<Partial<Record<EnemyKind, IngredientId>>> = {
  ghoul: 'fleisch',
  rat: 'fleisch',
  brute: 'fleisch',
  crow: 'fleisch',
  howl: 'fleisch',
  wurz: 'gemuese',
  kern: 'gemuese',
  spitter: 'gemuese',
  shield: 'gemuese',
};

/** 2D MEALS; effects roughly halved after the playtest of 2026-11-20 (too strong). */
export const MEALS: readonly MealDefinition[] = [
  { id: 'suppe', name: 'Erbsensuppe', description: '+20% Leben', costs: { gemuese: 3 } },
  { id: 'curry', name: 'Currywurst', description: '+12% Schaden', costs: { fleisch: 2, gewuerz: 1 } },
  { id: 'kaffee', name: 'Filterkaffee', description: '+10% Angriffs- und Lauftempo', costs: { gewuerz: 2 } },
  { id: 'soljanka',
    name: 'Soljanka',
    description: '+1,5 Leben pro Sekunde, +5% Widerstand',
    costs: { fleisch: 2, gemuese: 2 } },
  { id: 'gurke',
    name: 'Spreewaldgurken',
    description: '+4 Beuteglück, +50% Material und Zutaten',
    costs: { gemuese: 3, gewuerz: 1 },
    requiredBuilding: 'garten' },
];

/** 2D CONS. */
export const CONSUMABLES: readonly ConsumableDefinition[] = [
  { id: 'verband', name: 'Verband', description: 'Heilt 40% Leben über 3 Sekunden', scrapCost: 15 },
  { id: 'molotow',
    name: 'Molotow',
    description: 'Wirft ein Feuerfeld, das Gegner in Brand setzt',
    scrapCost: 25 },
];
