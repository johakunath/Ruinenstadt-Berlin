// Ported from johakunath/Ruinenstadt at 61bf9198a72f0c21ee33bd67456e252b630efc65.
// Values and German text are unchanged; source constants are named at each table.

import type { WeaponKindId } from './items';

export type CampBuildingId = 'turm' | 'sani' | 'garten' | 'halle' | 'funk' | 'presse' | 'lampe';
export type SurvivorId = 'doktor' | 'schmied' | 'kurier' | 'koechin' | 'spaeher' | 'mechaniker';
export type PerkId = 'dmg' | 'hp' | 'spd' | 'crit' | 'rate' | 'reach' | 'leech' | 'ram' | 'stun' | 'boom' | 'second'
  | 'scrap' | 'dashcd' | 'thorns' | 'skill' | 'magnet' | 'fire' | 'acid' | 'shock' | 'spread'
  | 'corrode' | 'chain' | 'elp' | 'res' | 'combo' | 'loot' | 'breaker' | 'blast' | 'breath'
  | 'exec' | 'mat' | 'rush' | 'pauke' | 'husar' | 'jagd' | 'schwel' | 'kachel' | 'stellung'
  | 'retour' | 'kimme' | 'durch' | 'd_brand' | 'd_mauer' | 'd_sturm' | 'd_kurz' | 'd_ziel'
  | 'm_rund' | 'm_dampf' | 'm_schrot' | 'm_spiess';
export type PerkFamilyId = 'boll' | 'sprint' | 'krit' | 'serie' | 'dist' | 'el' | 'glut';

/** 2D DIFF entries, in the original easy/normal/hard order. */
export interface DifficultyDefinition {
  readonly name: string;
  readonly hpMultiplier: number;
  readonly damageMultiplier: number;
  readonly luck: number;
  readonly scrapMultiplier: number;
}

/** 2D PERKS, including prerequisite, family, duo and weapon-specific metadata. */
export interface PerkDefinition {
  readonly id: PerkId;
  readonly name: string;
  readonly description: string;
  readonly max: number;
  /** 'any' means any element blessing, as in the 2D source. */
  readonly requires?: 'fire' | 'acid' | 'shock' | 'any';
  readonly families?: readonly PerkFamilyId[];
  readonly duo?: readonly [PerkFamilyId, PerkFamilyId];
  readonly weapon?: WeaponKindId;
}

/** 2D SURV entries. */
export interface SurvivorDefinition {
  readonly id: SurvivorId;
  readonly name: string;
  readonly description: string;
  readonly color: string;
}

/** 2D CAMP entries: building effects as text and scrap cost. No station geometry. */
export interface CampBuildingDefinition {
  readonly id: CampBuildingId;
  readonly name: string;
  readonly description: string;
  readonly scrapCost: number;
}

/** 2D DIFF. */
export const DIFFICULTIES: readonly [DifficultyDefinition, DifficultyDefinition, DifficultyDefinition] = [
  { name: 'Leicht', hpMultiplier: 0.7, damageMultiplier: 0.6, luck: 0, scrapMultiplier: 1 },
  { name: 'Normal', hpMultiplier: 1.75, damageMultiplier: 1.45, luck: 0, scrapMultiplier: 1 },
  { name: 'Schwer', hpMultiplier: 2.15, damageMultiplier: 1.75, luck: 4, scrapMultiplier: 1.3 },
];

/** 2D PERKS. */
export const PERKS: readonly PerkDefinition[] = [
  { id: 'dmg', name: 'Kiezwut', description: '+15% Schaden', max: 5 },
  { id: 'hp', name: 'Dickes Fell', description: '+10% maximales Leben', max: 5, families: [ 'boll' ] },
  { id: 'spd', name: 'Fersengeld', description: '+10% Lauftempo', max: 3, families: [ 'sprint' ] },
  { id: 'crit', name: 'Adlerblick', description: '+8% Krit-Chance', max: 4, families: [ 'krit' ] },
  { id: 'rate', name: 'Akkordarbeit', description: '+12% Angriffstempo', max: 4, families: [ 'serie' ] },
  { id: 'reach',
    name: 'Langer Kerl',
    description: '+20% Reichweite und Geschossgeschwindigkeit',
    max: 3,
    families: [ 'dist' ] },
  { id: 'leech', name: 'Aderlass', description: 'Jeder Kill heilt 1% Leben', max: 3, families: [ 'serie' ] },
  { id: 'ram',
    name: 'Rammbock',
    description: 'Sprint trifft Gegner auf dem Weg mit 120% Waffenschaden je Stufe',
    max: 3,
    families: [ 'sprint' ] },
  { id: 'stun',
    name: 'Kopfnuss',
    description: 'Krits betäuben Gegner 0,6 s (Endgegner kürzer)',
    max: 1,
    families: [ 'krit' ] },
  { id: 'boom',
    name: 'Splitterleichen',
    description: 'Gegner explodieren beim Tod: 35% Waffenschaden je Stufe an Nachbarn',
    max: 3,
    families: [ 'serie' ] },
  { id: 'second',
    name: 'Stehaufmännchen',
    description: 'Überlebe einmal pro Lauf einen tödlichen Treffer',
    max: 1 },
  { id: 'scrap', name: 'SERO-Sammler', description: '+50% Schrott in diesem Lauf', max: 2 },
  { id: 'dashcd', name: 'Hakenschlag', description: '-20% Sprint-Abklingzeit', max: 2, families: [ 'sprint' ] },
  { id: 'thorns',
    name: 'Igelstellung',
    description: 'Wer dich im Nahkampf trifft, nimmt 60% Waffenschaden je Stufe',
    max: 3,
    families: [ 'boll' ] },
  { id: 'skill', name: 'Notstrom', description: '-20% Abklingzeit deiner Kraft', max: 2 },
  { id: 'magnet', name: 'Elster', description: 'Größerer Aufsammelradius', max: 2 },
  { id: 'fire',
    name: 'Feuertaufe',
    description: '30% Chance je Treffer: Gegner brennen 2 s und nehmen jede Sekunde 45% des Trefferschadens',
    max: 1,
    families: [ 'el', 'glut' ] },
  { id: 'acid',
    name: 'Säurebad',
    description: '30% Chance je Treffer: Gegner sind 3 s verätzt und nehmen 25% mehr Schaden',
    max: 1,
    families: [ 'el' ] },
  { id: 'shock',
    name: 'Blitzableiter',
    description: '30% Chance je Treffer: Ein Blitz springt auf 2 Nachbarn über und macht 50% des Trefferschadens',
    max: 1,
    families: [ 'el' ] },
  { id: 'spread',
    name: 'Flächenbrand',
    description: 'Brennende Gegner entzünden beim Tod ihre Nachbarn mit 80% ihres Brandschadens',
    max: 1,
    requires: 'fire',
    families: [ 'el', 'glut' ] },
  { id: 'corrode',
    name: 'Zersetzung',
    description: 'Verätzte Gegner sind 30% langsamer',
    max: 1,
    requires: 'acid',
    families: [ 'el' ] },
  { id: 'chain',
    name: 'Kettenblitz',
    description: 'Blitze springen auf 2 weitere Gegner je Stufe',
    max: 2,
    requires: 'shock',
    families: [ 'el' ] },
  { id: 'elp',
    name: 'Pulverfass',
    description: '+25% Elementarschaden',
    max: 3,
    requires: 'any',
    families: [ 'el' ] },
  { id: 'res', name: 'Abgehärtet', description: '+6% Widerstand', max: 4, families: [ 'boll' ] },
  { id: 'combo',
    name: 'Trommelfeuer',
    description: 'Finisher kommen einen Schlag früher',
    max: 1,
    families: [ 'krit' ] },
  { id: 'loot',
    name: 'Mundraub',
    description: 'Kisten und Tonnen geben doppelt Schrott und öfter Material',
    max: 1 },
  { id: 'breaker',
    name: 'Dicke Bertha',
    description: '+25% Schaden gegen Schildträger, Elite-Gegner und Endgegner',
    max: 2,
    families: [ 'boll' ] },
  { id: 'blast',
    name: 'Sprengmeister',
    description: 'Molotows und Brandsätze brennen 50% größer, Explosionen verletzen dich nicht',
    max: 1,
    families: [ 'glut' ] },
  { id: 'breath', name: 'Atempause', description: 'Jeder Sprint heilt 3% Leben', max: 2, families: [ 'sprint' ] },
  { id: 'exec',
    name: 'Gnadenstoß',
    description: 'Normale Gegner unter 12% Leben sterben sofort',
    max: 1,
    families: [ 'serie' ] },
  { id: 'mat', name: 'Hamsterkauf', description: '+50% Materialfunde', max: 2 },
  { id: 'rush',
    name: 'Kiezrausch',
    description: '+2% Schaden je 10 Kills in der laufenden Serie',
    max: 1,
    families: [ 'serie' ] },
  { id: 'pauke',
    name: 'Paukenschlag',
    description: 'Finisher treffen immer kritisch',
    max: 1,
    families: [ 'krit' ] },
  { id: 'husar',
    name: 'Husarenritt',
    description: 'Nach einem Sprint 1 s lang +40% Schaden je Stufe',
    max: 2,
    families: [ 'sprint' ] },
  { id: 'jagd',
    name: 'Jagdfieber',
    description: 'Jeder Kill: +6% Angriffstempo für 3 s, bis zu 5-mal',
    max: 1,
    families: [ 'serie' ] },
  { id: 'schwel',
    name: 'Schwelbrand',
    description: 'Brand stapelt bis zu 3-mal und hält 1 s länger',
    max: 1,
    requires: 'fire',
    families: [ 'glut' ] },
  { id: 'kachel',
    name: 'Kachelofen',
    description: 'Brandschaden heilt dich um 5% je Stufe',
    max: 2,
    requires: 'fire',
    families: [ 'glut' ] },
  { id: 'stellung',
    name: 'Stellungskrieg',
    description: 'Im Stehen nimmst du 25% weniger Schaden',
    max: 1,
    families: [ 'boll' ] },
  { id: 'retour',
    name: 'Retourkutsche',
    description: 'Wirst du getroffen, macht dein nächster Angriff doppelten Schaden',
    max: 1,
    families: [ 'boll' ] },
  { id: 'kimme',
    name: 'Kimme und Korn',
    description: 'Je weiter das Ziel weg ist, desto mehr Schaden (bis +32%)',
    max: 1,
    families: [ 'dist' ] },
  { id: 'durch',
    name: 'Durchschlag',
    description: 'Geschosse durchbohren einen Gegner mehr je Stufe',
    max: 2,
    families: [ 'dist' ] },
  { id: 'd_brand',
    name: 'Brandstifter',
    description: 'Dein Sprint hinterlässt eine Feuerspur',
    max: 1,
    duo: [ 'glut', 'sprint' ] },
  { id: 'd_mauer',
    name: 'Brandmauer',
    description: 'Wer dich im Nahkampf trifft, fängt Feuer',
    max: 1,
    duo: [ 'boll', 'glut' ] },
  { id: 'd_sturm',
    name: 'Sturmangriff',
    description: 'Ein Kill kurz nach dem Sprint lädt den Sprint sofort auf',
    max: 1,
    duo: [ 'sprint', 'serie' ] },
  { id: 'd_kurz',
    name: 'Kurzschluss',
    description: 'Krits lösen immer dein Element aus',
    max: 1,
    duo: [ 'krit', 'el' ] },
  { id: 'd_ziel',
    name: 'Zielwasser',
    description: '+25% Krit-Chance gegen entfernte Gegner',
    max: 1,
    duo: [ 'dist', 'krit' ] },
  { id: 'm_rund',
    name: 'Rundumschlag',
    description: 'Dein Finisher trifft rundherum, +20% Reichweite',
    max: 1,
    weapon: 'blade' },
  { id: 'm_dampf',
    name: 'Dampfhammer',
    description: '30% langsamer, +70% Schaden, jeder Hieb schickt eine Druckwelle',
    max: 1,
    weapon: 'hammer' },
  { id: 'm_schrot',
    name: 'Schrotladung',
    description: 'Jeder Schuss feuert 3 Kugeln mit je 55% Schaden, kürzere Reichweite',
    max: 1,
    weapon: 'sling' },
  { id: 'm_spiess',
    name: 'Wurfspieße',
    description: 'Jeder Finisher wirft zusätzlich einen Speer, der 4 Gegner durchbohrt',
    max: 1,
    weapon: 'spear' },
];

/** 2D SURV. */
export const SURVIVORS: readonly SurvivorDefinition[] = [
  { id: 'doktor',
    name: 'Dr. Ahmet',
    description: 'Jede Expedition startet mit einem Verband mehr',
    color: '#d6cfc0' },
  { id: 'schmied',
    name: 'Mira, Tüftlerin',
    description: 'Aufsätze kosten 30% weniger Schrott',
    color: '#8a4a32' },
  { id: 'kurier', name: 'Kurier Jonas', description: 'Händler bieten ein viertes Teil an', color: '#3a6a8a' },
  { id: 'koechin', name: 'Oma Gerda', description: 'Döner und Zutaten fallen doppelt so oft', color: '#7a3a6a' },
  { id: 'spaeher', name: 'Späherin Lin', description: '+1 Beuteglück', color: '#3B6D11' },
  { id: 'mechaniker', name: 'Kalle, Mechaniker', description: '-10% Sprint-Abklingzeit', color: '#c9a227' },
];

/** 2D CAMP. */
export const CAMP_BUILDINGS: readonly CampBuildingDefinition[] = [
  { id: 'turm', name: 'Wachturm', description: '+8% Widerstand, dauerhaft', scrapCost: 150 },
  { id: 'sani',
    name: 'Sanitätszelt',
    description: 'Jede Expedition startet mit mindestens 2 Verbänden',
    scrapCost: 140 },
  { id: 'garten',
    name: 'Gemüsegarten',
    description:
     'Du startest jede Expedition satt (+10% Schaden für 60 Sekunden), +2 Gemüse nach jeder Expedition ab Welle 3',
    scrapCost: 120 },
  { id: 'halle', name: 'Lagerhalle', description: '+20 Plätze im Lager', scrapCost: 180 },
  { id: 'funk', name: 'Funkmast', description: 'Ein zusätzliches Ereignis pro Expedition', scrapCost: 200 },
  { id: 'presse', name: 'Schrottpresse', description: '+15% Schrott von Gegnern', scrapCost: 250 },
  { id: 'lampe',
    name: 'Stirnlampen-Werkstatt',
    description: 'Zweihändige Waffen bekommen in Dunkelzonen eine Stirnlampe',
    scrapCost: 160 },
];
