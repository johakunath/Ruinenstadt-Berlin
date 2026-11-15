// Ported from johakunath/Ruinenstadt at 61bf9198a72f0c21ee33bd67456e252b630efc65.
// Values and German text are unchanged; source constants are named at each table.

export type RarityId = 0 | 1 | 2 | 3;
export type ElementId = 'fire' | 'acid' | 'shock';
export type EnemyKind = 'raser' | 'ghoul' | 'brute' | 'spitter' | 'koloss' | 'brand' | 'hauptmann' | 'hexe' | 'turm'
  | 'flieger' | 'rat' | 'bomb' | 'shield' | 'crow' | 'howl' | 'ratten' | 'ritter' | 'platte'
  | 'volk' | 'uhr' | 'wurz' | 'kern' | 'kabel' | 'bass';
export type AffixId = 'dmg' | 'as' | 'crit' | 'spd' | 'hp' | 'regen' | 'res' | 'el' | 'leech' | 'cdr' | 'luck';
export type SlotId = 'w' | 'h' | 'a' | 'g' | 'f' | 't' | 'r' | 'i';
export type WeaponKindId = 'blade' | 'hammer' | 'sling' | 'spear';
export type AttributeKindId = 'krit' | 'tempo' | 'heil';
export type ItemKindId = WeaponKindId | AttributeKindId | 'armor' | 'head' | 'hand' | 'feet';
export type SetId = 'kiez' | 'spree' | 'zit';
export type SetThreshold = 2 | 3 | 5;
export type BaseId = 'latte' | 'rohr' | 'stahl' | 'machete' | 'brech' | 'vorschlag' | 'pflaster' | 'zange' | 'zwille'
  | 'nagel' | 'stein' | 'turm' | 'mauer' | 'ring' | 'leder' | 'helm' | 'mantel' | 'weste'
  | 'feuer' | 'bvg' | 'spaeti' | 'panzer' | 'kiesel' | 'stueck' | 'feder' | 'kette' | 'beutel'
  | 'abzeichen' | 'herz' | 'zitklinge' | 'pbrecher' | 'kraehe' | 'rattenmantel' | 'ritter'
  | 'auge' | 'morgen' | 'wappen' | 'rspeer' | 'schieber' | 'muetze' | 'maske' | 'handsch'
  | 'bandage' | 'schweiss' | 'turnsch' | 'stiefel' | 'gummi' | 'siegel' | 'totenk' | 'mutter'
  | 'draht' | 'ehe' | 'kupfer' | 'fahne' | 'harpune' | 'siegsp' | 'leucht' | 'boxh' | 'neonfl'
  | 'mikro' | 'poncho' | 'kmantel' | 'nbrille' | 'nauge' | 'zchip' | 'karm' | 'reflex' | 'bherz'
  | 'npumpe' | 'bassarm' | 'sichel' | 'werkh' | 'aufzieh' | 'zeiger' | 'blaumann' | 'stroh'
  | 'gartenh' | 'pickel' | 'kiezhelm' | 'kiezhand' | 'spreestief' | 'spreering' | 'topfhelm'
  | 'eisenstief' | 'kiezbox' | 'schaffner' | 'weltuhr';
export type LegendaryId = 'turm' | 'mauer' | 'ring' | 'spaeti' | 'panzer' | 'herz' | 'zitklinge' | 'pbrecher' | 'kraehe'
  | 'rattenmantel' | 'ritter' | 'auge' | 'siegsp' | 'bassarm' | 'pickel' | 'kiezbox'
  | 'schaffner' | 'weltuhr';

/** 2D RAR entries: display and item-value multiplier. */
export interface RarityDefinition {
  readonly name: string;
  readonly color: string;
  readonly multiplier: number;
}

/** 2D ELC and ELN, joined by element id. */
export interface ElementDefinition {
  readonly name: string;
  readonly color: string;
}

/** 2D RES: incoming damage factors (0 = immune, >1 = vulnerable). */
export interface EnemyResistance {
  readonly fire: number;
  readonly acid: number;
  readonly shock: number;
}

/** 2D AFX: roll bounds and display settings. Flags retain the source value 1. */
export interface AffixDefinition {
  readonly name: string;
  readonly unit: '%' | '';
  readonly min: number;
  readonly max: number;
  readonly decimals?: 1;
  readonly negative?: 1;
}

/** 2D IMP pairs and MODS.a pairs. */
export interface Affix {
  readonly id: AffixId;
  readonly value: number;
}

/** 2D PACTS triplets; negative bounds describe the drawback. */
export interface AffixRange {
  readonly id: AffixId;
  readonly min: number;
  readonly max: number;
}

/** 2D SETS.p triplets. Slot ids remain the keys of the pieces table. */
export interface SetPiece {
  readonly name: string;
  readonly kind: ItemKindId;
  readonly base: BaseId;
}

/** 2D SETS: b2/b3/b5 are descriptions keyed by required piece count. */
export interface SetDefinition {
  readonly name: string;
  readonly pieces: Readonly<Partial<Record<SlotId, SetPiece>>>;
  readonly bonusDescriptions: Readonly<Record<SetThreshold, string>>;
}

/** 2D SETB entries: required pieces and the affix contribution at that threshold. */
export interface SetBonus {
  readonly pieces: SetThreshold;
  readonly affixes: Readonly<Partial<Record<AffixId, number>>>;
}

/** 2D LEGP entries; this step ports the descriptions, not their implementation. */
export interface LegendaryPower {
  readonly description: string;
}

/** 2D KIND: only name and k. Combat timing and spatial values belong to the 3D game. */
export interface WeaponKindDefinition {
  readonly name: string;
  readonly damageFactor: number;
}

/** 2D RAR. */
export const RARITIES: readonly [RarityDefinition, RarityDefinition, RarityDefinition, RarityDefinition] = [
  { name: 'Gewöhnlich', color: '#e8ddd0', multiplier: 1 },
  { name: 'Magisch', color: '#7d9bff', multiplier: 1.35 },
  { name: 'Selten', color: '#f2d14b', multiplier: 1.8 },
  { name: 'Legendär', color: '#ff8a3d', multiplier: 2.6 },
];

/** 2D ELC + ELN. */
export const ELEMENTS: Readonly<Record<ElementId, ElementDefinition>> = {
  fire: { name: 'Feuer', color: '#ff6a2a' },
  acid: { name: 'Säure', color: '#97C459' },
  shock: { name: 'Strom', color: '#7dd3ff' },
};

/** 2D RES. */
export const ENEMY_RESISTANCES: Readonly<Record<EnemyKind, EnemyResistance>> = {
  raser: { fire: 1.2, acid: 1.2, shock: 0.6 },
  ghoul: { fire: 1.6, acid: 1, shock: 1 },
  brute: { fire: 0.5, acid: 1.6, shock: 1 },
  spitter: { fire: 1, acid: 0, shock: 1.6 },
  koloss: { fire: 0.5, acid: 1, shock: 1.8 },
  brand: { fire: 0, acid: 1.6, shock: 1 },
  hauptmann: { fire: 1.3, acid: 1, shock: 1.3 },
  hexe: { fire: 1.6, acid: 0, shock: 1 },
  turm: { fire: 1, acid: 1.6, shock: 0 },
  flieger: { fire: 1, acid: 1.3, shock: 1.6 },
  rat: { fire: 1.4, acid: 1.4, shock: 1.4 },
  bomb: { fire: 1.3, acid: 1, shock: 1.4 },
  shield: { fire: 1, acid: 1.6, shock: 1.2 },
  crow: { fire: 1.3, acid: 0.8, shock: 1.6 },
  howl: { fire: 1.3, acid: 1.2, shock: 1 },
  ratten: { fire: 1.6, acid: 0.4, shock: 1 },
  ritter: { fire: 0.8, acid: 1, shock: 1.7 },
  platte: { fire: 0.5, acid: 1.7, shock: 1 },
  volk: { fire: 1, acid: 0.6, shock: 1.7 },
  uhr: { fire: 1, acid: 0.5, shock: 1.7 },
  wurz: { fire: 1.8, acid: 0.4, shock: 1 },
  kern: { fire: 1.6, acid: 0.4, shock: 1.1 },
  kabel: { fire: 1.6, acid: 1, shock: 0.3 },
  bass: { fire: 1, acid: 1.6, shock: 0.5 },
};

/** 2D AFX. */
export const AFFIXES: Readonly<Record<AffixId, AffixDefinition>> = {
  dmg: { name: 'Schaden', unit: '%', min: 6, max: 14 },
  as: { name: 'Angriffstempo', unit: '%', min: 5, max: 10 },
  crit: { name: 'Krit-Chance', unit: '%', min: 3, max: 7 },
  spd: { name: 'Lauftempo', unit: '%', min: 4, max: 9 },
  hp: { name: 'Leben', unit: '', min: 10, max: 24 },
  regen: { name: 'Leben pro Sekunde', unit: '', min: 0.3, max: 1, decimals: 1 },
  res: { name: 'Widerstand', unit: '%', min: 4, max: 9 },
  el: { name: 'Elementarschaden', unit: '%', min: 10, max: 25 },
  leech: { name: 'Leben pro Kill', unit: '', min: 1, max: 3 },
  cdr: { name: 'Abklingzeiten', unit: '%', min: 5, max: 10, negative: 1 },
  luck: { name: 'Beuteglück', unit: '', min: 1, max: 2 },
};

/** 2D PACTS. */
export const PACTS: readonly (readonly [AffixRange, AffixRange])[] = [
  [ { id: 'dmg', min: 25, max: 40 }, { id: 'as', min: -15, max: -10 } ],
  [ { id: 'as', min: 15, max: 22 }, { id: 'dmg', min: -12, max: -8 } ],
  [ { id: 'dmg', min: 25, max: 35 }, { id: 'hp', min: -30, max: -15 } ],
  [ { id: 'res', min: 15, max: 22 }, { id: 'spd', min: -12, max: -8 } ],
  [ { id: 'spd', min: 14, max: 20 }, { id: 'res', min: -12, max: -8 } ],
  [ { id: 'crit', min: 10, max: 15 }, { id: 'hp', min: -20, max: -10 } ],
  [ { id: 'luck', min: 3, max: 4 }, { id: 'dmg', min: -10, max: -8 } ],
  [ { id: 'el', min: 40, max: 60 }, { id: 'crit', min: -6, max: -4 } ],
];

/** 2D IMP. */
export const IMPLICITS: Readonly<Partial<Record<BaseId, readonly Affix[]>>> = {
  leder: [ { id: 'spd', value: 4 } ],
  helm: [ { id: 'res', value: 4 } ],
  mantel: [ { id: 'regen', value: 0.5 } ],
  weste: [ { id: 'res', value: 7 }, { id: 'spd', value: -4 } ],
  feuer: [ { id: 'res', value: 5 }, { id: 'el', value: 8 } ],
  bvg: [ { id: 'spd', value: 6 } ],
  spaeti: [ { id: 'luck', value: 2 }, { id: 'regen', value: 0.8 } ],
  panzer: [ { id: 'res', value: 12 }, { id: 'spd', value: -8 } ],
  herz: [ { id: 'regen', value: 1 } ],
  poncho: [ { id: 'res', value: 5 }, { id: 'spd', value: 3 } ],
  kmantel: [ { id: 'el', value: 10 } ],
  nbrille: [ { id: 'crit', value: 2 } ],
  nauge: [ { id: 'el', value: 10 } ],
  zchip: [ { id: 'crit', value: 3 } ],
  karm: [ { id: 'dmg', value: 6 } ],
  reflex: [ { id: 'cdr', value: 6 } ],
  bherz: [ { id: 'hp', value: 25 } ],
  npumpe: [ { id: 'leech', value: 1 } ],
  bassarm: [ { id: 'as', value: 8 }, { id: 'el', value: 15 } ],
  sichel: [ { id: 'crit', value: 3 } ],
  werkh: [ { id: 'dmg', value: 6 } ],
  aufzieh: [ { id: 'as', value: 6 } ],
  zeiger: [ { id: 'crit', value: 2 }, { id: 'as', value: 4 } ],
  blaumann: [ { id: 'res', value: 4 }, { id: 'regen', value: 0.4 } ],
  stroh: [ { id: 'luck', value: 1 } ],
  gartenh: [ { id: 'leech', value: 1 } ],
};

/** 2D SETS. */
export const SETS: Readonly<Record<SetId, SetDefinition>> = {
  kiez: { name: 'Kiezwache',
    pieces:
     { w: { name: 'Brechstange der Kiezwache', kind: 'blade', base: 'brech' },
       a: { name: 'Weste der Kiezwache', kind: 'armor', base: 'weste' },
       t: { name: 'Abzeichen der Kiezwache', kind: 'krit', base: 'abzeichen' },
       h: { name: 'Helm der Kiezwache', kind: 'head', base: 'kiezhelm' },
       g: { name: 'Handschuhe der Kiezwache', kind: 'hand', base: 'kiezhand' } },
    bonusDescriptions: { '2': '+25% Widerstand', '3': '+60% Schaden', '5': '+15% Krit-Chance und +100 Leben' } },
  spree: { name: 'Spreegeist',
    pieces:
     { w: { name: 'Zwille des Spreegeists', kind: 'sling', base: 'zwille' },
       a: { name: 'Mantel des Spreegeists', kind: 'armor', base: 'mantel' },
       t: { name: 'Kiesel des Spreegeists', kind: 'tempo', base: 'kiesel' },
       f: { name: 'Stiefel des Spreegeists', kind: 'feet', base: 'spreestief' },
       r: { name: 'Ring des Spreegeists', kind: 'tempo', base: 'spreering' } },
    bonusDescriptions:
     { '2': '+25% Angriffstempo',
       '3': 'Strom-Element und +80% Elementarschaden',
       '5': '+50% Elementarschaden und +10% Lauftempo' } },
  zit: { name: 'Zitadelle',
    pieces:
     { w: { name: 'Morgenstern der Zitadelle', kind: 'hammer', base: 'morgen' },
       a: { name: 'Kettenhemd der Zitadelle', kind: 'armor', base: 'kette' },
       t: { name: 'Wappen der Zitadelle', kind: 'krit', base: 'wappen' },
       h: { name: 'Topfhelm der Zitadelle', kind: 'head', base: 'topfhelm' },
       f: { name: 'Eisenstiefel der Zitadelle', kind: 'feet', base: 'eisenstief' } },
    bonusDescriptions: { '2': '+120 Leben', '3': '+55% Schaden und +20% Widerstand', '5': '+200 Leben und +4 Leben pro Kill' } },
};

/** 2D SETB. */
export const SET_BONUSES: Readonly<Record<SetId, readonly SetBonus[]>> = {
  kiez: [ { pieces: 2, affixes: { res: 25 } },
    { pieces: 3, affixes: { dmg: 60 } },
    { pieces: 5, affixes: { crit: 15, hp: 100 } } ],
  spree: [ { pieces: 2, affixes: { as: 25 } },
    { pieces: 3, affixes: { el: 80 } },
    { pieces: 5, affixes: { el: 50, spd: 10 } } ],
  zit: [ { pieces: 2, affixes: { hp: 120 } },
    { pieces: 3, affixes: { dmg: 55, res: 20 } },
    { pieces: 5, affixes: { hp: 200, leech: 4 } } ],
};

/** 2D SETC. */
export const SET_COLOR: string = '#8fd16a';

/** 2D LEGP. */
export const LEGENDARY_POWERS: Readonly<Record<LegendaryId, LegendaryPower>> = {
  turm: { description: 'Krits lösen eine Feuerexplosion aus' },
  mauer: { description: 'Jeder vierte Treffer erzeugt eine Säurewelle' },
  ring: { description: 'Geschosse springen auf einen weiteren Gegner über' },
  spaeti: { description: 'Gegner und Kisten lassen doppelt so oft Döner und Vorräte fallen' },
  panzer: { description: '20% Chance, einen Treffer komplett abzublocken' },
  herz: { description: 'Einmal pro Expedition überlebst du einen tödlichen Treffer mit 40% Leben' },
  zitklinge: { description: 'Jeder Kill lädt deine Kraft um 1 Sekunde auf' },
  pbrecher: { description: 'Krit-Kills lösen ein betäubendes Beben aus' },
  kraehe: { description: 'Geschosse verlangsamen Gegner 2 Sekunden lang' },
  rattenmantel: { description: 'Wirst du getroffen, schwappt eine Säurewelle um dich (alle 1,5 s)' },
  ritter: { description: 'Am Ende jedes Sprints bebt der Boden' },
  auge: { description: 'Elite-Gegner und Endgegner nehmen 25% mehr Schaden' },
  siegsp: { description: 'Jeder Stoß verschießt eine goldene Klinge' },
  bassarm: { description: 'Jeder fünfte Treffer entlädt einen Kettenblitz auf bis zu 4 Gegner' },
  pickel: { description: 'Elite-Gegner und Endgegner heilen dich beim Tod um 15% Leben' },
  kiezbox: { description: 'Jeder vierte Treffer betäubt den Gegner kurz' },
  schaffner: { description: 'Jeder Kill verkürzt die Sprint-Abklingzeit um 0,5 Sekunden' },
  weltuhr: { description: 'Dein erster Angriff nach einem Sprint ist immer ein Krit' },
};

/** 2D LEGEL. */
export const LEGENDARY_ELEMENTS: Readonly<Partial<Record<LegendaryId, ElementId>>> = {
  turm: 'fire',
  mauer: 'acid',
  ring: 'shock',
  zitklinge: 'shock',
  pbrecher: 'fire',
  kraehe: 'acid',
  siegsp: 'fire',
};

/** 2D SLOTS. */
export const SLOTS: readonly SlotId[] = [
  'w',
  'h',
  'a',
  'g',
  'f',
  't',
  'r',
  'i',
];

/** 2D SLOTN. */
export const SLOT_NAMES: Readonly<Record<SlotId, string>> = {
  w: 'Waffe',
  h: 'Kopf',
  a: 'Körper',
  g: 'Hände',
  f: 'Füße',
  t: 'Talisman',
  r: 'Ring',
  i: 'Implantat',
};

/** 2D SSTAT. */
export const SLOT_MAIN_STATS: Readonly<Partial<Record<SlotId, AffixId>>> = {
  a: 'hp',
  h: 'res',
  g: 'as',
  f: 'spd',
};

/** 2D RIL. */
export const ITEM_LEVEL_BONUS: readonly [number, number, number, number] = [
  0,
  3,
  6,
  10,
];

/** 2D KIND (name, k only). */
export const WEAPON_KINDS: Readonly<Record<WeaponKindId, WeaponKindDefinition>> = {
  blade: { name: 'Klinge', damageFactor: 1 },
  hammer: { name: 'Hammer', damageFactor: 2.3 },
  sling: { name: 'Werfer', damageFactor: 0.85 },
  spear: { name: 'Speer', damageFactor: 1.45 },
};

/** 2D TM: talisman, ring and implant main stats. */
export const ATTRIBUTE_STATS: Readonly<Record<AttributeKindId, AffixId>> = {
  krit: 'crit', tempo: 'spd', heil: 'regen',
};

/** 2D IMODE, in the stored mode order. */
export const IMPLANT_MODES: readonly { readonly id: string; readonly name: string; readonly description: string; readonly affixes: Readonly<Partial<Record<AffixId, number>>> }[] = [
  { id: 'lauf', name: 'Laufwerk', description: '+12% Lauftempo', affixes: { spd: 12 } },
  { id: 'takt', name: 'Taktgeber', description: '+10% Angriffstempo', affixes: { as: 10 } },
  { id: 'haut', name: 'Panzerhaut', description: '+8% Widerstand', affixes: { res: 8 } },
];
