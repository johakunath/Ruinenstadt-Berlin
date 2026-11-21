// M13 camp stations, ported from 2D `CST` (js/data.js): three levels each. Level 2 needs the station's
// survivor, level 3 needs Köpenick freed (2D: Alexanderplatz; 3D has one district so far). Levels set
// the old camp building flags (`camp`, effects unchanged) and raise the workshop caps (`up`).
import type { CampBuildingId, CampUpgradeId, SurvivorId } from './progression';
import type { MaterialId } from './crafting';

export type StationId = 'zeug' | 'hack' | 'imbiss' | 'laz' | 'kom' | 'markt' | 'exer';
export interface StationLevel { readonly text: string; readonly camp?: CampBuildingId; readonly cost?: Readonly<Partial<Record<MaterialId | 'scrap', number>>> }
export interface StationDef {
  readonly id: StationId; readonly name: string;
  /** Survivor who runs it from level 2; 'ilse' is always there. */
  readonly npc: SurvivorId | 'ilse';
  readonly line: string;
  readonly up?: Partial<Record<CampUpgradeId, readonly [number, number, number]>>;
  readonly levels: readonly [StationLevel, StationLevel, StationLevel];
}
export const STATIONS: readonly StationDef[] = [
  { id: 'zeug', name: 'Zeughaus', npc: 'schmied', line: '„Zeig mal her, das kriegen wir scharf.“', up: { dmg: [5, 8, 10] }, levels: [
    { text: 'Schärfen bis Stufe 5, Aufsätze' },
    { text: 'Schärfen bis 8, Stirnlampe für zweihändige Waffen', camp: 'lampe', cost: { scrap: 220, metall: 5, kabel: 2 } },
    { text: 'Schärfen bis 10', cost: { scrap: 650, metall: 10, kabel: 4 } }] },
  { id: 'hack', name: 'Hackerspace', npc: 'mechaniker', line: '„Alles hat einen Schalter. Man muss ihn nur finden.“', up: { hp: [5, 8, 10] }, levels: [
    { text: 'Panzerung bis Stufe 5' },
    { text: 'Panzerung bis 8, Schrottpresse: +15% Schrott von Gegnern', camp: 'presse', cost: { scrap: 220, metall: 4, kabel: 3 } },
    { text: 'Panzerung bis 10, +8% Widerstand', camp: 'turm', cost: { scrap: 650, metall: 8, kabel: 6 } }] },
  { id: 'imbiss', name: 'Imbiss', npc: 'koechin', line: '„Erst essen, dann kämpfen.“', levels: [
    { text: 'Kochen' },
    { text: 'Gemüsegarten: satt in die Expedition, +2 Gemüse, Spreewaldgurken', camp: 'garten', cost: { scrap: 180, stoff: 4, chemie: 2 } },
    { text: 'Essen wirkt 20% stärker', cost: { scrap: 550, stoff: 6, chemie: 5 } }] },
  { id: 'laz', name: 'Lazarett', npc: 'doktor', line: '„Setz dich. Nein, nicht da, das ist die Spüle.“', levels: [
    { text: 'Verbände und Molotows herstellen' },
    { text: 'Jede Expedition startet mit mindestens 2 Verbänden', camp: 'sani', cost: { scrap: 200, stoff: 5, chemie: 2 } },
    { text: 'Verbände heilen 60% statt 40%', cost: { scrap: 550, stoff: 8, chemie: 5 } }] },
  { id: 'kom', name: 'Kommandantur', npc: 'ilse', line: '„Die Kiezwache hat Arbeit für dich.“', levels: [
    { text: 'Funkkontakt zur Kiezwache' },
    { text: 'Funkmast: ein Ereignis mehr pro Expedition', camp: 'funk', cost: { scrap: 240, kabel: 5, metall: 2 } },
    { text: 'Händler bieten ein Teil mehr an', cost: { scrap: 600, kabel: 8, metall: 4 } }] },
  { id: 'markt', name: 'Depot', npc: 'kurier', line: '„Was du nicht trägst, pass ich auf.“', levels: [
    { text: 'Lager mit 40 Plätzen' },
    { text: 'Lagerhalle: +20 Plätze', camp: 'halle', cost: { scrap: 200, stoff: 3, metall: 3 } },
    { text: 'Nochmal +20 Plätze', cost: { scrap: 500, stoff: 6, metall: 6 } }] },
  { id: 'exer', name: 'Exerzierplatz', npc: 'spaeher', line: '„Nochmal. Und diesmal leiser.“', up: { dash: [2, 4, 5], luck: [2, 4, 5] }, levels: [
    { text: 'Ausdauer und Spürnase bis Stufe 2, Drill' },
    { text: 'Ausdauer und Spürnase bis 4', cost: { scrap: 200, stoff: 4, kabel: 2 } },
    { text: 'Ausdauer und Spürnase bis 5', cost: { scrap: 550, stoff: 6, kabel: 5 } }] },
];
/** 2D NPCN / SURV names for the station keepers. */
export const ILSE = 'Ilse';
