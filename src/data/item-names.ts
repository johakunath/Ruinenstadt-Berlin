// Ported from johakunath/Ruinenstadt at 61bf9198a72f0c21ee33bd67456e252b630efc65.
// Values and German text are unchanged; source constants are named at each table.

import type { AttributeKindId, BaseId, WeaponKindId } from './items';

/** 2D NW/NWM/NWG/LEGW: names grouped by weapon kind. */
export type WeaponNameTable = Readonly<Record<WeaponKindId, readonly string[]>>;

/** 2D NI/NR/NT: names grouped by crit, speed or healing item kind. */
export type AttributeNameTable = Readonly<Record<AttributeKindId, readonly string[]>>;

/** 2D NW. */
export const WEAPON_NAMES: WeaponNameTable = {
  blade: [ 'Rostige Klinge', 'Stahlklinge', 'Machete', 'Hackmesser' ],
  hammer: [ 'Vorschlaghammer', 'Pflasterhammer', 'Rohrzange' ],
  sling: [ 'Jagdzwille', 'Nagelwerfer', 'Steinschleuder' ],
  spear: [ 'Rohrspeer', 'Fahnenstange', 'Harpune' ],
};

/** 2D NWM. */
export const NEON_WEAPON_NAMES: WeaponNameTable = {
  blade: [ 'Leuchtröhre' ],
  hammer: [ 'Boxenhammer' ],
  sling: [ 'Neonflinte' ],
  spear: [ 'Mikroständer' ],
};

/** 2D NWG. */
export const GDR_WEAPON_NAMES: WeaponNameTable = {
  blade: [ 'Sichel' ],
  hammer: [ 'Werkhammer' ],
  sling: [ 'Aufziehwerfer' ],
  spear: [ 'Zeigerlanze' ],
};

/** 2D LEGW. */
export const LEGENDARY_WEAPON_NAMES: WeaponNameTable = {
  blade: [ 'Fernsehturm-Splitter', 'Klinge der Zitadelle' ],
  hammer: [ 'Mauerbrecher', 'Plattenbrecher' ],
  sling: [ 'Zorn der Ringbahn', 'Krähenschleuder' ],
  spear: [ 'Speer der Siegessäule' ],
};

/** M18 Wedding: on `fest` maps 40 % of legendary weapons are this hammer (`makeItem`); it drops nowhere else. */
export const FEST_LEGENDARY_WEAPON = 'Die Letzte Bestellung';

/** 2D NA. */
export const ARMOR_NAMES: readonly string[] = [
  'Lederjacke',
  'Arbeitsmantel',
  'Schutzweste',
  'Feuerwehrjacke',
  'BVG-Uniform',
];

/**
 * WP4 step 2 (Johannes, 2026-11-19): every normal wear base has a home district (the looks in
 * docs/mockups/wp4-clothes/). Köpenick drops only its own; Xhain rolls its own at 40 %, else Köpenick's;
 * later districts roll both (`wearNames` in src/sim/items.ts). These are the Xhain ones.
 */
export const XHAIN_WEAR_NAMES: ReadonlySet<string> = new Set(['Lederjacke', 'Feuerwehrjacke', 'BVG-Uniform', 'Wollmütze', 'Gasmaske', 'Boxbandagen', 'Turnschuhe']);

/** 2D NAM. */
export const NEON_ARMOR_NAMES: readonly string[] = [
  'Regenponcho',
  'Kabelmantel',
];

/** 2D NAG. */
export const GDR_ARMOR_NAMES: readonly string[] = [
  'Blaumann',
];

/** 2D LEGA. */
export const LEGENDARY_ARMOR_NAMES: readonly string[] = [
  'Mantel des letzten Späti',
  'Panzer vom Tempelhofer Feld',
  'Mantel der Rattenmutter',
  'Rüstung des Zitadellenritters',
];

/** 2D NH. */
export const HEAD_NAMES: readonly string[] = [
  'Bauhelm',
  'Schiebermütze',
  'Wollmütze',
  'Gasmaske',
];

/** 2D NHM. */
export const NEON_HEAD_NAMES: readonly string[] = [
  'Neonbrille',
];

/** 2D NHG. */
export const GDR_HEAD_NAMES: readonly string[] = [
  'Strohhut',
];

/** 2D LEGH. */
export const LEGENDARY_HEAD_NAMES: readonly string[] = [
  'Pickelhaube des Hauptmanns',
];

/** 2D NG. */
export const HAND_NAMES: readonly string[] = [
  'Arbeitshandschuhe',
  'Boxbandagen',
  'Schweißerhandschuhe',
];

/** 2D NGG. */
export const GDR_HAND_NAMES: readonly string[] = [
  'Gartenhandschuhe',
];

/** 2D NF. */
export const FOOT_NAMES: readonly string[] = [
  'Turnschuhe',
  'Arbeitsstiefel',
  'Gummistiefel',
];

/** 2D LEGG. */
export const LEGENDARY_HAND_NAMES: readonly string[] = [
  'Fäuste des Kiezboxers',
];

/** 2D LEGF. */
export const LEGENDARY_FOOT_NAMES: readonly string[] = [
  'Stiefel des Schaffners',
];

/** 2D NI. */
export const IMPLANT_NAMES: AttributeNameTable = {
  krit: [ 'Neonauge', 'Zielchip' ],
  tempo: [ 'Kabelarm', 'Reflexkoppler' ],
  heil: [ 'Bassherz', 'Nanopumpe' ],
};

/** 2D LEGI. */
export const LEGENDARY_IMPLANT_NAMES: readonly string[] = [
  'Arm des Basspredigers',
];

/** 2D NR. */
export const RING_NAMES: AttributeNameTable = {
  krit: [ 'Siegelring', 'Totenkopfring' ],
  tempo: [ 'Schraubenmutter', 'Drahtring' ],
  heil: [ 'Ehering', 'Kupferring' ],
};

/** 2D NT. */
export const TALISMAN_NAMES: AttributeNameTable = {
  krit: [ 'Spreekiesel', 'Mauerstück' ],
  tempo: [ 'Rabenfeder', 'Fahrradkette' ],
  heil: [ 'Kräuterbeutel', 'Currywurst-Abzeichen' ],
};

/** 2D LEGR. */
export const LEGENDARY_RING_NAMES: readonly string[] = [
  'Ring der Weltzeituhr',
];

/** 2D LEGT. */
export const LEGENDARY_TALISMAN_NAMES: readonly string[] = [
  'Herz der Spree',
  'Auge des Fernsehturms',
];

/** 2D SUF. */
export const RARITY_SUFFIXES: readonly [readonly string[], readonly string[], readonly string[], readonly string[]] = [
  [],
  [ 'der Glut', 'des Schutts', 'der Asche', 'des Rauchs' ],
  [ 'des Spreewächters', 'der letzten Ruine', 'des Brandes' ],
  [],
];

/** 2D BASES. */
export const BASES: Readonly<Record<string, BaseId>> = {
  Holzlatte: 'latte',
  // Klinge items are blades (Johannes, 2026-11-17); the 2D names stay for old saves.
  'Rostige Klinge': 'rohr',
  Stahlklinge: 'stahl',
  Hackmesser: 'brech',
  'Rostiges Rohr': 'rohr',
  Bewehrungsstahl: 'stahl',
  Machete: 'machete',
  Brechstange: 'brech',
  Vorschlaghammer: 'vorschlag',
  Pflasterhammer: 'pflaster',
  Rohrzange: 'zange',
  Zwille: 'zwille',
  Nagelschleuder: 'nagel',
  Jagdzwille: 'zwille',
  Nagelwerfer: 'nagel',
  Steinschleuder: 'stein',
  'Fernsehturm-Splitter': 'turm',
  Mauerbrecher: 'mauer',
  'Zorn der Ringbahn': 'ring',
  Lederjacke: 'leder',
  Bauhelm: 'helm',
  Arbeitsmantel: 'mantel',
  Schutzweste: 'weste',
  Feuerwehrjacke: 'feuer',
  'BVG-Uniform': 'bvg',
  'Mantel des letzten Späti': 'spaeti',
  'Panzer vom Tempelhofer Feld': 'panzer',
  Spreekiesel: 'kiesel',
  'Mauerstück': 'stueck',
  Rabenfeder: 'feder',
  Fahrradkette: 'kette',
  'Kräuterbeutel': 'beutel',
  'Currywurst-Abzeichen': 'abzeichen',
  'Herz der Spree': 'herz',
  'Klinge der Zitadelle': 'zitklinge',
  Plattenbrecher: 'pbrecher',
  'Krähenschleuder': 'kraehe',
  'Mantel der Rattenmutter': 'rattenmantel',
  'Rüstung des Zitadellenritters': 'ritter',
  'Auge des Fernsehturms': 'auge',
  'Morgenstern der Zitadelle': 'morgen',
  'Kettenhemd der Zitadelle': 'kette',
  'Wappen der Zitadelle': 'wappen',
  Rohrspeer: 'rspeer',
  'Schiebermütze': 'schieber',
  'Wollmütze': 'muetze',
  Gasmaske: 'maske',
  Arbeitshandschuhe: 'handsch',
  Boxbandagen: 'bandage',
  'Schweißerhandschuhe': 'schweiss',
  Turnschuhe: 'turnsch',
  Arbeitsstiefel: 'stiefel',
  Gummistiefel: 'gummi',
  Siegelring: 'siegel',
  Totenkopfring: 'totenk',
  Schraubenmutter: 'mutter',
  Drahtring: 'draht',
  Ehering: 'ehe',
  Kupferring: 'kupfer',
  Fahnenstange: 'fahne',
  Harpune: 'harpune',
  'Speer der Siegessäule': 'siegsp',
  'Leuchtröhre': 'leucht',
  Boxenhammer: 'boxh',
  Neonflinte: 'neonfl',
  'Mikroständer': 'mikro',
  Regenponcho: 'poncho',
  Kabelmantel: 'kmantel',
  Neonbrille: 'nbrille',
  Neonauge: 'nauge',
  Zielchip: 'zchip',
  Kabelarm: 'karm',
  Reflexkoppler: 'reflex',
  Bassherz: 'bherz',
  Nanopumpe: 'npumpe',
  'Arm des Basspredigers': 'bassarm',
  Sichel: 'sichel',
  Werkhammer: 'werkh',
  Aufziehschleuder: 'aufzieh',
  Aufziehwerfer: 'aufzieh',
  Zeigerlanze: 'zeiger',
  Blaumann: 'blaumann',
  Strohhut: 'stroh',
  Gartenhandschuhe: 'gartenh',
  'Pickelhaube des Hauptmanns': 'pickel',
  'Helm der Kiezwache': 'kiezhelm',
  'Handschuhe der Kiezwache': 'kiezhand',
  'Stiefel des Spreegeists': 'spreestief',
  'Ring des Spreegeists': 'spreering',
  'Topfhelm der Zitadelle': 'topfhelm',
  'Eisenstiefel der Zitadelle': 'eisenstief',
  'Fäuste des Kiezboxers': 'kiezbox',
  'Stiefel des Schaffners': 'schaffner',
  'Ring der Weltzeituhr': 'weltuhr',
  // M18 Wedding: the legendary hammer of `fest` maps (`FEST_LEGENDARY_WEAPON`).
  'Die Letzte Bestellung': 'bestellung',
};
