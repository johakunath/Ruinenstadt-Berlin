// Rendered 3D icons of the Aufsätze and supplies (Johannes 2026-11-26: no SVG), with the old drawing as the fallback
// until a render exists (`MOD_ICONS`, `SUPPLY_ICONS` in item-icons.ts; tools/prop-icons.ts renders them).
import { MOD_ICONS, SUPPLY_ICONS } from './item-icons';

const art = import.meta.glob('../../assets/inventory/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const img = (id: string | undefined, fallback: string): string => {
  const url = id ? art[`../../assets/inventory/${id}.webp`] : undefined;
  return url ? `<img class="prop-ic" src="${url}" alt="" draggable="false">` : fallback;
};

/** Icon of an Aufsatz (`WEAPON_MODS` id). */
export const modIcon = (id: string, fallback = ''): string => img(MOD_ICONS[id], fallback);
/** Icon of a supply: Verband, Molotow or the Verbandskasten (full heal). */
export const supplyIcon = (id: keyof typeof SUPPLY_ICONS, fallback = ''): string => img(SUPPLY_ICONS[id], fallback);
