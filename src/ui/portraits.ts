import type { StationDef } from '../data/camp';

const portraits = import.meta.glob('../../assets/portraits/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const portraitUrl = (id: string): string => portraits[`../../assets/portraits/${id}.webp`] ?? '';

/** The station windows and the Kodex share the same survivor art. */
export const KEEPER_PORTRAIT: Record<StationDef['npc'], string> = {
  doktor: 'S01', schmied: 'S02', kurier: 'S03', koechin: 'S04', spaeher: 'S05', mechaniker: 'S06', ilse: 'S07',
};
