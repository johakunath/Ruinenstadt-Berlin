// Menu glyphs ported from the 2D game (js/items.js PG, js/glyphs.js KRG, FAMG, WCG): inline SVG, no image files.
// Generated once from johakunath/Ruinenstadt; edit by hand from here on.
import type { PerkFamilyId, PerkId } from '../data/progression';
import type { PowerId } from '../data/powers';
import type { WeaponKindId } from '../data/items';

/** Blessing glyphs on a 24 px grid: color, f(ill) or s(troke), SVG body. */
export const PERK_GLYPHS: Readonly<Partial<Record<PerkId, readonly [string, 'f' | 's', string]>>> = {
 "dmg": [
  "#ff8a3d",
  "f",
  "<path d=\"M12 3c5 5 7 9 5 14a5 5 0 0 1-10 0c-1-4 2-6 2-9 2 2 2 4 3 5 1-3 0-6 0-10z\"/>"
 ],
 "hp": [
  "#e05050",
  "f",
  "<path d=\"M12 20l-7-7a4.5 4.5 0 0 1 7-5.5A4.5 4.5 0 0 1 19 13z\"/>"
 ],
 "spd": [
  "#c9b08a",
  "s",
  "<path d=\"M3 8h7M2 12h8M3 16h7M13 6l6 6-6 6M10 6l6 6-6 6\"/>"
 ],
 "crit": [
  "#f2d14b",
  "s",
  "<path d=\"M3 12q9-9 18 0q-9 9-18 0z\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" fill=\"#f2d14b\"/>"
 ],
 "rate": [
  "#ead9c0",
  "s",
  "<circle cx=\"12\" cy=\"13\" r=\"7\"/><path d=\"M12 9v4l3 2M10 3h4\"/>"
 ],
 "reach": [
  "#c9b08a",
  "s",
  "<path d=\"M3 12h16M15 8l4 4-4 4M3 8v8\"/>"
 ],
 "leech": [
  "#c23a2e",
  "f",
  "<path d=\"M5 5h14l-5 15-2-6-2 6z\"/>"
 ],
 "ram": [
  "#c9b08a",
  "f",
  "<path d=\"M3 9h9V5l8 7-8 7v-4H3z\"/>"
 ],
 "stun": [
  "#f2d14b",
  "f",
  "<path d=\"M12 3l2.2 6H21l-5.5 4 2 7-5.5-4.2L6.5 20l2-7L3 9h6.8z\"/>"
 ],
 "boom": [
  "#ff8a3d",
  "f",
  "<path d=\"M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3z\"/>"
 ],
 "second": [
  "#8fd16a",
  "f",
  "<path d=\"M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z\"/>"
 ],
 "scrap": [
  "#b8b8c8",
  "s",
  "<path d=\"M12 4l7 4v8l-7 4-7-4V8z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>"
 ],
 "dashcd": [
  "#ead9c0",
  "s",
  "<path d=\"M3 18q8-12 17-10M15 4l5 4-4 5\"/><path d=\"M3 13l3-1M4 8l3 0\" stroke-width=\"1.4\"/>"
 ],
 "thorns": [
  "#a8b060",
  "f",
  "<path d=\"M12 2l2 6 5-3-2 6 6 1-6 2 3 5-5-2-1 6-2-5-4 4 0-6-6-1 5-3-4-4 6 0z\"/>"
 ],
 "skill": [
  "#f2a04b",
  "s",
  "<rect x=\"4\" y=\"7\" width=\"14\" height=\"10\" rx=\"1.5\"/><path d=\"M18 10h2v4h-2M12 8l-3 4h3l-2 4\" /> "
 ],
 "magnet": [
  "#b8b8c8",
  "f",
  "<path d=\"M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0z\"/><path d=\"M5 4h4v3H5zM15 4h4v3h-4z\" fill=\"#e05050\"/>"
 ],
 "fire": [
  "#ff6a2a",
  "f",
  "<path d=\"M12 3c5 5 7 9 5 14a5 5 0 0 1-10 0c-1-4 2-6 2-9 2 2 2 4 3 5 1-3 0-6 0-10z\"/>"
 ],
 "acid": [
  "#97C459",
  "f",
  "<path d=\"M12 3c4 6 7 9 7 12a7 7 0 0 1-14 0c0-3 3-6 7-12z\"/>"
 ],
 "shock": [
  "#7dd3ff",
  "f",
  "<path d=\"M14 2L5 13h6l-2 9 10-12h-6z\"/>"
 ],
 "spread": [
  "#ff6a2a",
  "f",
  "<path d=\"M8 6c3 3 4 6 3 9a3.5 3.5 0 0 1-7 0c0-3 2-4 2-6 1 1 1 2 2 3zM16 4c3 3 5 7 3 11a4 4 0 0 1-8 0c0-3 2-5 2-7 1 1 2 2 2 4 1-3 1-5 1-8z\"/>"
 ],
 "corrode": [
  "#97C459",
  "f",
  "<path d=\"M12 3c4 6 7 9 7 12a7 7 0 0 1-14 0c0-3 3-6 7-12z\"/><path d=\"M8 15h8M9 18h6\" stroke=\"#120d0a\" stroke-width=\"1.6\"/>"
 ],
 "chain": [
  "#7dd3ff",
  "f",
  "<path d=\"M9 2L3 10h4l-2 6 7-8H8zM18 8l-6 8h4l-2 6 7-8h-4z\"/>"
 ],
 "elp": [
  "#ead9c0",
  "f",
  "<circle cx=\"12\" cy=\"6\" r=\"3.4\" fill=\"#ff6a2a\"/><circle cx=\"6\" cy=\"17\" r=\"3.4\" fill=\"#97C459\"/><circle cx=\"18\" cy=\"17\" r=\"3.4\" fill=\"#7dd3ff\"/>"
 ],
 "res": [
  "#9aa4b0",
  "f",
  "<path d=\"M12 3l8 3v6c0 5-4 8-8 10-4-2-8-5-8-10V6z\"/>"
 ],
 "combo": [
  "#ead9c0",
  "s",
  "<path d=\"M4 19L10 5M10 19L16 5M16 19l4-9\" stroke-width=\"2.4\"/>"
 ],
 "loot": [
  "#c9a227",
  "s",
  "<rect x=\"4\" y=\"8\" width=\"16\" height=\"12\" rx=\"1\"/><path d=\"M4 12h16M12 8v12M7 8l2-4h6l2 4\"/>"
 ],
 "breaker": [
  "#9aa4b0",
  "f",
  "<path d=\"M12 3l8 3v6c0 5-4 8-8 10-4-2-8-5-8-10V6z\"/><path d=\"M12 4l-2 6 4 2-3 8\" stroke=\"#120d0a\" stroke-width=\"1.8\" fill=\"none\"/>"
 ],
 "blast": [
  "#ff8a3d",
  "f",
  "<path d=\"M10 9h4v2l2 3v8H8v-8l2-3z\"/><path d=\"M12 2c2 2 2 4 0 6-2-2-2-4 0-6z\" fill=\"#f2d14b\"/>"
 ],
 "breath": [
  "#9fd8c8",
  "s",
  "<path d=\"M3 9h11a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3\"/>"
 ],
 "exec": [
  "#e8ddd0",
  "f",
  "<path d=\"M5 11a7 7 0 0 1 14 0v4h-3v4H8v-4H5z\"/><circle cx=\"9\" cy=\"11\" r=\"1.8\" fill=\"#120d0a\"/><circle cx=\"15\" cy=\"11\" r=\"1.8\" fill=\"#120d0a\"/>"
 ],
 "mat": [
  "#d6cfc0",
  "f",
  "<path d=\"M8 8h8l3 10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z\"/><path d=\"M9 8l-1-4h8l-1 4\" fill=\"none\" stroke=\"#d6cfc0\" stroke-width=\"2\"/>"
 ],
 "rush": [
  "#c23a2e",
  "s",
  "<path d=\"M5 13l7-7 7 7M5 20l7-7 7 7\" stroke-width=\"2.6\"/>"
 ],
 "pauke": [
  "#c9b08a",
  "f",
  "<path d=\"M4 9v7c0 2.200 3.600 3.500 8 3.500s8-1.300 8-3.500V9z\"/><ellipse cx=\"12\" cy=\"9\" rx=\"8\" ry=\"3.200\" fill=\"#ead9c0\"/><path d=\"M5 11l2 6M10 12.500l.5 6.500M14 12.500l-.5 6.500M19 11l-2 6\" stroke=\"#1c140f\" stroke-width=\"1.200\" fill=\"none\"/><path d=\"M2 2.500l9.500 6M22 2.500L12.500 8.500\" stroke=\"#ead9c0\" stroke-width=\"1.800\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"2.500\" cy=\"2.500\" r=\"1.400\" fill=\"#ead9c0\"/><circle cx=\"21.500\" cy=\"2.500\" r=\"1.400\" fill=\"#ead9c0\"/><path d=\"M12 1v3M7.500 3.500l1 1.500\" stroke=\"#f2d14b\" stroke-width=\"1.500\" stroke-linecap=\"round\" fill=\"none\"/>"
 ],
 "husar": [
  "#9aa4b0",
  "s",
  "<path d=\"M21 2c0 6-5 12-13 15\" fill=\"#9aa4b0\" fill-opacity=\".35\"/><path d=\"M19 4.500C17 10 13 14 9 16\" stroke-width=\"1\" stroke=\"#ead9c0\" stroke-opacity=\".8\"/><path d=\"M5.500 12.500l6 6M7 16l-4 4.500\" stroke-width=\"2.600\"/><circle cx=\"2.500\" cy=\"21.500\" r=\"1.200\" fill=\"#f2d14b\" stroke=\"#f2d14b\"/><path d=\"M2 5h6M1 9h5M4 13h3\" stroke=\"#f2d14b\" stroke-width=\"1.600\"/>"
 ],
 "jagd": [
  "#c9b08a",
  "f",
  "<path d=\"M15 5l7-3v13l-7-3z\"/><path d=\"M15 8.500C8 7 3 11 4 17\" stroke=\"#c9b08a\" stroke-width=\"3.200\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M4 17c1 3 5 4 8 1\" stroke=\"#c9b08a\" stroke-width=\"2.200\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M15 5v6\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M6 11l1.500 2M10 9.500l.5 2\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><circle cx=\"11.500\" cy=\"18.500\" r=\"2\" fill=\"#f2d14b\"/><path d=\"M13.500 20.500l3 2\" stroke=\"#f2d14b\" stroke-width=\"1.500\" fill=\"none\"/><path d=\"M17 20h5M18 23h4\" stroke=\"#ff6a2a\" stroke-width=\"1.600\" stroke-linecap=\"round\" fill=\"none\"/>"
 ],
 "schwel": [
  "#ff6a2a",
  "f",
  "<path d=\"M2 21l2-5 5-1 3 3-1 3zM12 21l1-4 4-1 5 2-1 4z\"/><path d=\"M7 14l2-5 5-1 3 3-3 4-5 1z\"/><path d=\"M4 18l3 1M15 19l4 0M10 13l3-1\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M9 10c-1-3 1-4 1-7 2 1 3 3 2 5\" fill=\"#f2d14b\"/><circle cx=\"17\" cy=\"9\" r=\"1\" fill=\"#f2d14b\"/><circle cx=\"4\" cy=\"12\" r=\".9\" fill=\"#f2d14b\"/><circle cx=\"20\" cy=\"5\" r=\".9\" fill=\"#f2d14b\"/><circle cx=\"8\" cy=\"19\" r=\".9\" fill=\"#f2d14b\"/><circle cx=\"17\" cy=\"19\" r=\".9\" fill=\"#f2d14b\"/>"
 ],
 "kachel": [
  "#c9b08a",
  "f",
  "<rect x=\"4\" y=\"2\" width=\"16\" height=\"3\" rx=\".6\"/><rect x=\"5\" y=\"5\" width=\"14\" height=\"16\"/><path d=\"M3.500 21h17\" stroke=\"#c9b08a\" stroke-width=\"2\" fill=\"none\"/><path d=\"M5 9.500h14M5 14h14M9.500 5v16M14.500 5v16\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M12 19.500l-3.200-3.300a1.800 1.800 0 0 1 3.200-1.500 1.800 1.800 0 0 1 3.200 1.500z\" fill=\"#e05050\" stroke=\"#1c140f\" stroke-width=\"1\"/><path d=\"M17 1c-1 1 1 2 0 3\" stroke=\"#ead9c0\" stroke-width=\"1.200\" fill=\"none\"/>"
 ],
 "stellung": [
  "#c9b08a",
  "f",
  "<rect x=\"1.500\" y=\"15\" width=\"6.500\" height=\"5.500\" rx=\"2.500\"/><rect x=\"8.700\" y=\"15\" width=\"6.500\" height=\"5.500\" rx=\"2.500\"/><rect x=\"16\" y=\"15\" width=\"6.500\" height=\"5.500\" rx=\"2.500\"/><rect x=\"5\" y=\"9.500\" width=\"7\" height=\"5\" rx=\"2.300\"/><rect x=\"12.600\" y=\"9.500\" width=\"7\" height=\"5\" rx=\"2.300\"/><path d=\"M8 3h8l1 4.500H7z\" fill=\"#9aa4b0\"/><path d=\"M8.500 17.500h3M11 12h3M18 17.500h3M3.500 17.500h2\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M8.500 6h7\" stroke=\"#ead9c0\" stroke-width=\"1\" fill=\"none\"/>"
 ],
 "retour": [
  "#c23a2e",
  "s",
  "<path d=\"M3.500 2v20\" stroke-width=\"3\" stroke=\"#9aa4b0\"/><path d=\"M3.500 6l-1.500 1.500M3.500 12l-1.500 1.500M3.500 18l-1.500 1.500\" stroke-width=\"1.200\" stroke=\"#9aa4b0\"/><path d=\"M21 3L8 9.500\"/><path d=\"M12 5.500l-4 4 5.500 1.200\" stroke-width=\"1.800\"/><path d=\"M8 9.500l13 5.500\"/><path d=\"M16.500 11.500L21 15l-6.500 1.700\" stroke-width=\"1.800\"/><path d=\"M21 3l1 1M20 21l-2-3\" stroke=\"#f2d14b\" stroke-width=\"1.600\"/>"
 ],
 "kimme": [
  "#97C459",
  "s",
  "<path d=\"M2 22v-6h7v2.500h6V16h7v6z\" fill=\"#97C459\" fill-opacity=\".4\"/><circle cx=\"12\" cy=\"6\" r=\"3.800\" stroke-width=\"1.600\"/><circle cx=\"12\" cy=\"6\" r=\"1.200\" fill=\"#97C459\"/><path d=\"M12 11v3\" stroke-dasharray=\"1 2.400\" stroke-width=\"1.800\"/><path d=\"M5 3l-2.500-1M19 3l2.500-1\" stroke-width=\"1.400\"/>"
 ],
 "durch": [
  "#9aa4b0",
  "s",
  "<rect x=\"8\" y=\"3\" width=\"3.500\" height=\"18\" rx=\".8\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><rect x=\"14\" y=\"3\" width=\"3.500\" height=\"18\" rx=\".8\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><path d=\"M1.500 12h20\" stroke=\"#ead9c0\" stroke-width=\"2.200\"/><path d=\"M22.500 12l-4-2.800v5.600z\" fill=\"#ead9c0\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M1.500 12l-1-2.500M1.500 12l-1 2.500M4.500 12l-1-2M4.500 12l-1 2\" stroke=\"#f2d14b\" stroke-width=\"1.300\"/><path d=\"M12.500 8l-1 1.500M12.500 16l-1-1.500M19 7l-1 1.500M19 17l-1-1.500\" stroke=\"#f2d14b\" stroke-width=\"1.300\"/>"
 ],
 "d_brand": [
  "#f2d14b",
  "f",
  "<path d=\"M11 2h7v9l4.500 3.200c.8.600.5 2.800-.5 2.800H9.500C8.500 17 9 15 10 14z\"/><path d=\"M11 14.500h10\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M14 5h1M14 8h1\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M1.500 22c-1-3 1-4 1-7 2 1 3 3 3 5 1-1 1-2 1-3 2 2 3 5 1 7z\" fill=\"#ff6a2a\"/><path d=\"M5 22c-1-2 0-3 1-4 1 1 1 3 0 4z\" fill=\"#f2d14b\"/><path d=\"M9 20.500h13\" stroke=\"#ff6a2a\" stroke-width=\"1.800\" stroke-linecap=\"round\" fill=\"none\"/>"
 ],
 "d_mauer": [
  "#f2d14b",
  "f",
  "<rect x=\"1.500\" y=\"12.500\" width=\"21\" height=\"9.500\"/><path d=\"M1.500 16h21M1.500 19h21M8 12.500V16M15 12.500V16M4.500 16v3M11.500 16v3M18.500 16v3M8 19v3M15 19v3\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M3 12c-1-3 1-4 1-7 2 1 3 3 2 5 1-1 1-3 1-4 2 2 2 4 1 6zM11 12c-1-3 1-5 2-9 3 3 4 6 3 9zM18 12c-1-2 0-4 1-6 2 2 3 4 2 6z\" fill=\"#ff6a2a\"/><path d=\"M13 12c-1-2 0-3 0-5 1 1 2 3 1 5z\" fill=\"#f2d14b\" stroke=\"#f2d14b\" stroke-width=\".6\"/>"
 ],
 "d_sturm": [
  "#f2d14b",
  "f",
  "<path d=\"M2 4l8 8-8 8v-5l3.500-3L2 9z\"/><path d=\"M10 4l8 8-8 8v-5l3.500-3L10 9z\" fill-opacity=\".6\"/><path d=\"M19 3l3 3M22 3l-3 3\" stroke=\"#e05050\" stroke-width=\"1.800\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M20 10a3 3 0 1 1-.7 4.500\" stroke=\"#ead9c0\" stroke-width=\"1.600\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M18 14.500l1.600.2-.4-1.800\" stroke=\"#ead9c0\" stroke-width=\"1.200\" fill=\"none\"/>"
 ],
 "d_kurz": [
  "#f2d14b",
  "f",
  "<path d=\"M14 1L4.500 13h6L8.500 23 19.500 9.500h-6.500z\"/><path d=\"M13.500 5l-5 6.500\" stroke=\"#fff3b0\" stroke-width=\"1\" fill=\"none\"/><path d=\"M2 5l2 2M21 15l2 1M2 18l3-1M19 3l1 2.500\" stroke=\"#7dd3ff\" stroke-width=\"1.600\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"21\" cy=\"6\" r=\"1.300\" fill=\"#7dd3ff\"/>"
 ],
 "d_ziel": [
  "#f2d14b",
  "f",
  "<path d=\"M10 2h4v4l2.500 3.500V21a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V9.500L10 6z\"/><rect x=\"9.500\" y=\".8\" width=\"5\" height=\"2\" rx=\".6\" fill=\"#c9b08a\"/><rect x=\"8.500\" y=\"12\" width=\"7\" height=\"6\" fill=\"#1c140f\" fill-opacity=\".85\"/><circle cx=\"12\" cy=\"15\" r=\"2.500\" stroke=\"#e05050\" stroke-width=\"1.200\" fill=\"none\"/><path d=\"M12 11.500v2M12 16.500v2M8.500 15h2M13.500 15h2\" stroke=\"#e05050\" stroke-width=\"1\" fill=\"none\"/><circle cx=\"19.500\" cy=\"5\" r=\"1.100\" fill=\"#7dd3ff\"/><circle cx=\"21.500\" cy=\"8\" r=\".8\" fill=\"#7dd3ff\"/><circle cx=\"4\" cy=\"7\" r=\"1\" fill=\"#7dd3ff\"/>"
 ],
 "m_rund": [
  "#b48cff",
  "s",
  "<path d=\"M21 12a9 9 0 1 1-3-6.700\" stroke-width=\"2\"/><path d=\"M14.500 2.500l4 2.800-3.200 3.400\" stroke-width=\"2\"/><path d=\"M12 5l1.500 2.500v7H10.500v-7z\" fill=\"#b48cff\" fill-opacity=\".6\" stroke-width=\"1.200\"/><path d=\"M9 14.500h6M12 14.500v4\" stroke-width=\"1.800\"/>"
 ],
 "m_dampf": [
  "#b48cff",
  "f",
  "<path d=\"M10.500 1h3v8h-3z\" fill=\"#9aa4b0\"/><rect x=\"5\" y=\"9\" width=\"12\" height=\"6\" rx=\"1\"/><path d=\"M5 12h12\" stroke=\"#1c140f\" stroke-width=\"1\" fill=\"none\"/><path d=\"M2 21h16\" stroke=\"#9aa4b0\" stroke-width=\"2.600\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"19.500\" cy=\"8\" r=\"2.400\" fill=\"#ead9c0\" fill-opacity=\".85\"/><circle cx=\"21\" cy=\"12.500\" r=\"2\" fill=\"#ead9c0\" fill-opacity=\".6\"/><circle cx=\"18.500\" cy=\"4\" r=\"1.600\" fill=\"#ead9c0\" fill-opacity=\".7\"/><path d=\"M3 17l-1.500 1.500M5 18.500v2\" stroke=\"#ead9c0\" stroke-width=\"1.200\" fill=\"none\"/>"
 ],
 "m_schrot": [
  "#b48cff",
  "s",
  "<path d=\"M3 20L16 5M3 20L21 11M3 20L22 18\" stroke-width=\"1.200\" stroke-dasharray=\"1 2.600\"/><path d=\"M1 19l4 4M3 18l-1 5\" stroke-width=\"2.800\" stroke=\"#9aa4b0\"/><circle cx=\"16.500\" cy=\"4.500\" r=\"2.600\" fill=\"#b48cff\"/><circle cx=\"21\" cy=\"10.500\" r=\"2.600\" fill=\"#b48cff\"/><circle cx=\"21.500\" cy=\"18\" r=\"2.600\" fill=\"#b48cff\"/><path d=\"M15.500 3.500l1-.5\" stroke=\"#fff\" stroke-width=\"1\" opacity=\".8\"/>"
 ],
 "m_spiess": [
  "#b48cff",
  "f",
  "<path d=\"M3 22L16 9\" stroke=\"#b48cff\" stroke-width=\"2.200\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M21.500 2.500l-3 6.500-3.300.5.700-3.700z\"/><path d=\"M2 14L9 7\" stroke=\"#b48cff\" stroke-width=\"1.600\" stroke-linecap=\"round\" opacity=\".6\" fill=\"none\"/><path d=\"M13 1.500l-2.200 4.500-2.300.3.500-2.600z\" fill-opacity=\".6\"/><path d=\"M5 5v3M3.500 6.500h3\" stroke=\"#f2d14b\" stroke-width=\"1.600\" stroke-linecap=\"round\" fill=\"none\"/>"
 ]
};
/** Family glyphs on a 24 px grid: color, SVG body. */
export const FAMILY_GLYPHS: Readonly<Record<PerkFamilyId | 'mod' | 'duo', readonly [string, string]>> = {
 "el": [
  "#7dd3ff",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 7L6 17M12 7l6 10M6 17h12\" stroke=\"#7dd3ff\" stroke-width=\"1.3\" opacity=\".6\"/><circle cx=\"12\" cy=\"6.500\" r=\"4\" fill=\"#7dd3ff\" fill-opacity=\".55\" stroke=\"#7dd3ff\"/><circle cx=\"6\" cy=\"17.500\" r=\"4\" fill=\"#7dd3ff\" fill-opacity=\".55\" stroke=\"#7dd3ff\"/><circle cx=\"18\" cy=\"17.500\" r=\"4\" fill=\"#7dd3ff\" fill-opacity=\".55\" stroke=\"#7dd3ff\"/><path d=\"M10.500 5l1-1M4.500 16l1-1M16.500 16l1-1\" stroke=\"#fff\" stroke-width=\"1.4\"/></g>"
 ],
 "krit": [
  "#f2d14b",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 21L21 3\" stroke=\"#f2d14b\" stroke-width=\"3\" opacity=\".55\"/><circle cx=\"12\" cy=\"12\" r=\"6.500\" fill=\"#1c140f\" fill-opacity=\".5\" stroke=\"#f2d14b\"/><path d=\"M12 2v5M12 17v5M2 12h5M17 12h5\" stroke=\"#f2d14b\"/><circle cx=\"12\" cy=\"12\" r=\"1.200\" fill=\"#f2d14b\"/></g>"
 ],
 "sprint": [
  "#9fd8c8",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10 3h7v8l4 3v5H8c-1-4-2-10 2-10z\" fill=\"#9fd8c8\" fill-opacity=\".4\" stroke=\"#9fd8c8\"/><path d=\"M9 16h12\" stroke=\"#9fd8c8\" stroke-width=\"1.400\"/><path d=\"M1 8h5M2 12h5M1 16h5\" stroke=\"#9fd8c8\"/></g>"
 ],
 "serie": [
  "#e05050",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M5 17l7-5 7 5M5 11l7-5 7 5\" stroke=\"#e05050\" stroke-width=\"2.6\"/><path d=\"M5 22l7-4 7 4\" stroke=\"#e05050\" stroke-width=\"2\" opacity=\".55\"/></g>"
 ],
 "glut": [
  "#ff7a2a",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 20l2-6 6-2 7 2 3 5-3 3H6z\" fill=\"#ff7a2a\" fill-opacity=\".45\" stroke=\"#ff7a2a\"/><path d=\"M8 18l3-3 3 2\" stroke=\"#ff7a2a\" stroke-width=\"1.300\"/><path d=\"M12 11C9 8 12 6 12 2c3 2 5 5 3 9\" fill=\"#ff7a2a\" fill-opacity=\".8\" stroke=\"#ff7a2a\" stroke-width=\"1.500\"/></g>"
 ],
 "boll": [
  "#9aa4b0",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2 5h20v16H2zM2 10.500h20M2 16h20M8 5v5.500M15 5v5.500M5 10.500V16M12 10.500V16M19 10.500V16M8 16v5M15 16v5\" stroke=\"#9aa4b0\" stroke-width=\"1.200\" opacity=\".7\"/><path d=\"M12 6l6 2v5c0 4-3 7-6 8-3-1-6-4-6-8V8z\" fill=\"#1c140f\" stroke=\"#9aa4b0\" stroke-width=\"2\"/><path d=\"M12 9v9M8.500 12h7\" stroke=\"#9aa4b0\" stroke-width=\"1.500\"/></g>"
 ],
 "dist": [
  "#b8e05a",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2 21v-8h6v3h8v-3h6v8z\" fill=\"#b8e05a\" fill-opacity=\".4\" stroke=\"#b8e05a\"/><path d=\"M12 2v10\" stroke=\"#b8e05a\" stroke-width=\"3\"/><circle cx=\"12\" cy=\"3.500\" r=\"1.500\" fill=\"#b8e05a\"/></g>"
 ],
 "mod": [
  "#b48cff",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2 17h14l4-3h2v6H2z\" fill=\"#b48cff\" fill-opacity=\".4\" stroke=\"#b48cff\"/><path d=\"M5 17v4\" stroke=\"#b48cff\"/><path d=\"M20 3l-3 3 1 3 3 1 3-3-2-1-1-2zM17.500 8.500L6 20\" stroke=\"#b48cff\" stroke-width=\"2.400\"/></g>"
 ],
 "duo": [
  "#f2d14b",
  "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"8.500\" cy=\"12\" r=\"5.500\" stroke=\"#f2d14b\" stroke-width=\"2.600\"/><circle cx=\"15.500\" cy=\"12\" r=\"5.500\" stroke=\"#f2d14b\" stroke-width=\"2.600\"/><path d=\"M12 7.300a5.500 5.500 0 0 1 0 9.400\" stroke=\"#1c140f\" stroke-width=\"1\" opacity=\"0\"/></g>"
 ]
};
/** Power icons on a 48 px grid. */
export const POWER_GLYPHS: Readonly<Record<PowerId, string>> = {
 "saege": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"#c23a2e\" fill-opacity=\".1\"/><path d=\"M38.5 24.0L42.6 31.4L37.3 29.7L37.1 30.3L37.5 38.8L33.5 34.9L33.0 35.3L29.8 43.2L27.9 38.0L27.2 38.1L20.9 43.8L21.4 38.3L20.8 38.1L12.6 40.4L15.5 35.7L15.0 35.3L6.6 33.9L11.2 30.9L10.9 30.3L4.0 25.3L9.5 24.7L9.5 24.0L5.4 16.6L10.7 18.3L10.9 17.7L10.5 9.2L14.5 13.1L15.0 12.7L18.2 4.8L20.1 10.0L20.8 9.9L27.1 4.2L26.6 9.7L27.2 9.9L35.4 7.6L32.5 12.3L33.0 12.7L41.4 14.1L36.8 17.1L37.1 17.7L44.0 22.7L38.5 23.3Z\" fill=\"#9aa4b0\" fill-opacity=\".35\" stroke=\"#9aa4b0\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"11\" stroke=\"#c9b08a\" stroke-width=\"1\" stroke-dasharray=\"3 2.2\"/><circle cx=\"24\" cy=\"24\" r=\"12.4\" stroke=\"#9aa4b0\" stroke-width=\".9\"/><g opacity=\"1\"><circle cx=\"24\" cy=\"15\" r=\"2.6\" fill=\"#ead9c0\"/><path d=\"M24 18v8M24 20l-4 4M24 20l4 4M24 26l-3 7M24 26l3 7\" stroke=\"#ead9c0\" stroke-width=\"2.2\"/></g><path d=\"M5 17A20 20 0 0 1 17 5M43 31A20 20 0 0 1 31 43\" stroke=\"#c23a2e\" stroke-width=\"2\"/><path d=\"M5 17l-1.5 4M5 17l4-.5M43 31l1.5-4M43 31l-4 .5\" stroke=\"#c23a2e\" stroke-width=\"1.6\"/><path d=\"M12 12l2 2M36 12l-2 2\" stroke=\"#ead9c0\" stroke-width=\"1\" opacity=\".7\"/></g>",
 "fecht": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g opacity=\"0.28\"><circle cx=\"7\" cy=\"21\" r=\"2.6\" fill=\"#c9b08a\"/><path d=\"M7 24v8M7 26l-4 4M7 26l4 4M7 32l-3 7M7 32l3 7\" stroke=\"#c9b08a\" stroke-width=\"2.2\"/></g><g opacity=\"0.5\"><circle cx=\"12\" cy=\"20\" r=\"2.6\" fill=\"#c9b08a\"/><path d=\"M12 23v8M12 25l-4 4M12 25l4 4M12 31l-3 7M12 31l3 7\" stroke=\"#c9b08a\" stroke-width=\"2.2\"/></g><path d=\"M2 20h8M0 25h7M3 32h6M1 37h8\" stroke=\"#ead9c0\" stroke-width=\"1.3\" opacity=\".6\"/><path d=\"M45 21L21 25.5V30.5Z\" fill=\"#9aa4b0\" fill-opacity=\".45\" stroke=\"#9aa4b0\" stroke-width=\"1.4\"/><path d=\"M23 27.8L40 22.6\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M20 22.5l-1.5 12\" stroke=\"#c9b08a\" stroke-width=\"3\"/><path d=\"M19.5 28H11\" stroke=\"#c9b08a\" stroke-width=\"3.2\"/><path d=\"M13 26.5v3M16 26.5v3\" stroke=\"#2a1d14\" stroke-width=\"1\"/><circle cx=\"9.5\" cy=\"28\" r=\"2\" fill=\"#c9b08a\" stroke=\"#c9b08a\"/><path d=\"M44 12l-3 5M47 20l-4 1M44 31l-3-2\" stroke=\"#c23a2e\" stroke-width=\"1.6\"/><circle cx=\"46\" cy=\"21\" r=\"1.4\" fill=\"#c23a2e\"/></g>",
 "saebel": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"24\" cy=\"24\" r=\"21\" fill=\"#c23a2e\" fill-opacity=\".16\"/><path d=\"M24 1c2 4-1 6 1 9M24 47c-2-4 1-6-1-9M1 24c4 2 6-1 9 1M47 24c-4-2-6 1-9-1M7 7c4 1 5 3 7 3M41 41c-4-1-5-3-7-3M41 7c-1 4-3 5-3 7M7 41c1-4 3-5 3-7\" stroke=\"#c23a2e\" stroke-width=\"1.8\"/><circle cx=\"24\" cy=\"24\" r=\"19\" stroke=\"#c23a2e\" stroke-width=\"1\" stroke-dasharray=\"2 3\"/><g ><path d=\"M15 33C27 31 38 22 42 6C37 18 28 25 13 28Z\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.4\"/><path d=\"M17 30C28 28 36 21 40 10\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M12 36L18 24.5\" stroke=\"#f2d14b\" stroke-width=\"3\"/><path d=\"M15.5 30L7 40\" stroke=\"#c9b08a\" stroke-width=\"3\"/><path d=\"M10 33.5l3 3\" stroke=\"#2a1d14\" stroke-width=\"1\"/><circle cx=\"6\" cy=\"41.5\" r=\"2.2\" fill=\"#f2d14b\" stroke=\"#f2d14b\"/></g><g transform=\"matrix(-1 0 0 1 48 0)\"><path d=\"M15 33C27 31 38 22 42 6C37 18 28 25 13 28Z\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.4\"/><path d=\"M17 30C28 28 36 21 40 10\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M12 36L18 24.5\" stroke=\"#f2d14b\" stroke-width=\"3\"/><path d=\"M15.5 30L7 40\" stroke=\"#c9b08a\" stroke-width=\"3\"/><path d=\"M10 33.5l3 3\" stroke=\"#2a1d14\" stroke-width=\"1\"/><circle cx=\"6\" cy=\"41.5\" r=\"2.2\" fill=\"#f2d14b\" stroke=\"#f2d14b\"/></g><path d=\"M24 16l1.5 5.5L31 23l-5.5 1.5L24 30l-1.5-5.5L17 23l5.5-1.5z\" fill=\"#f2d14b\" fill-opacity=\".85\" stroke=\"#f2d14b\" stroke-width=\".8\"/></g>",
 "fall": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><ellipse cx=\"24\" cy=\"41\" rx=\"21\" ry=\"5.5\" stroke=\"#ff6a2a\" stroke-width=\"1.5\" opacity=\".7\"/><ellipse cx=\"24\" cy=\"41\" rx=\"13\" ry=\"3.4\" stroke=\"#c9b08a\" stroke-width=\"1.3\"/><path d=\"M3 40H45\" stroke=\"#c9b08a\" stroke-width=\"1.6\"/><path d=\"M24 40l-3 4-5 1M24 40l3 5 5 0M24 40l-9-2M30 40l7-2\" stroke=\"#c9b08a\" stroke-width=\"1.2\"/><path d=\"M9 33l-3-4M39 33l3-4M5 37l-4-1M43 37l4-1\" stroke=\"#ead9c0\" stroke-width=\"1.3\"/><g transform=\"rotate(22 24 33)\"><rect x=\"22.4\" y=\"2\" width=\"3.4\" height=\"27\" rx=\"1\" fill=\"#c9b08a\" fill-opacity=\".5\" stroke=\"#c9b08a\" stroke-width=\"1.3\"/><path d=\"M23 8v18\" stroke=\"#ead9c0\" stroke-width=\".8\" opacity=\".6\"/><rect x=\"13\" y=\"26\" width=\"22\" height=\"11\" rx=\"1.5\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.5\"/><path d=\"M13 29.5H35M13 33.5H35\" stroke=\"#2a1d14\" stroke-width=\"1\"/><path d=\"M16 27.5H33\" stroke=\"#ead9c0\" stroke-width=\"1\"/><circle cx=\"16.5\" cy=\"31.5\" r=\".9\" fill=\"#ead9c0\"/><circle cx=\"31.5\" cy=\"31.5\" r=\".9\" fill=\"#ead9c0\"/></g></g>",
 "gully": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 46L13 29\" stroke=\"#c9b08a\" stroke-width=\"7\" opacity=\".5\"/><path d=\"M0 44L11 27M4 48L15 31\" stroke=\"#c9b08a\" stroke-width=\"1.2\"/><circle cx=\"14\" cy=\"28\" r=\"4.2\" fill=\"#c9b08a\" fill-opacity=\".6\" stroke=\"#c9b08a\" stroke-width=\"1.3\"/><clipPath id=\"kgc\"><circle cx=\"26\" cy=\"24\" r=\"10.5\"/></clipPath><circle cx=\"26\" cy=\"24\" r=\"17\" fill=\"#9aa4b0\" fill-opacity=\".35\" stroke=\"#9aa4b0\" stroke-width=\"2\"/><circle cx=\"26\" cy=\"24\" r=\"12.5\" stroke=\"#9aa4b0\" stroke-width=\"1.3\"/><circle cx=\"26\" cy=\"24\" r=\"10.5\" fill=\"#2a1d14\" fill-opacity=\".5\"/><g clip-path=\"url(#kgc)\" stroke=\"#ead9c0\" stroke-width=\"1.5\" opacity=\".85\"><path d=\"M14 18H40M14 24H40M14 30H40M20 12V36M26 12V36M32 12V36\"/></g><circle cx=\"39.8\" cy=\"29.7\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"31.7\" cy=\"37.8\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"20.3\" cy=\"37.8\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"12.2\" cy=\"29.7\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"12.2\" cy=\"18.3\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"20.3\" cy=\"10.2\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"31.7\" cy=\"10.2\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"39.8\" cy=\"18.3\" r=\"1.1\" fill=\"#ead9c0\" stroke=\"none\"/><path d=\"M13 14A16 16 0 0 1 22 8\" stroke=\"#ead9c0\" stroke-width=\"1.4\"/><path d=\"M44 8l-3 3M46 15l-4 0M42 3l-1 4\" stroke=\"#f2d14b\" stroke-width=\"1.5\" opacity=\".0\"/><path d=\"M43 10l3-3M44 18l4 0M38 5l1-4\" stroke=\"#ead9c0\" stroke-width=\"1.4\"/></g>",
 "abriss": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 43H46\" stroke=\"#c9b08a\" stroke-width=\"1.6\"/><path d=\"M30 1L28 4\" stroke=\"#f2d14b\" stroke-width=\"3.5\"/><ellipse cx=\"32.0\" cy=\"2.0\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(-35 32.0 2.0)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><ellipse cx=\"30.0\" cy=\"5.1\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(20 30.0 5.1)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><ellipse cx=\"28.0\" cy=\"8.3\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(-35 28.0 8.3)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><ellipse cx=\"26.0\" cy=\"11.4\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(20 26.0 11.4)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><ellipse cx=\"24.0\" cy=\"14.6\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(-35 24.0 14.6)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><ellipse cx=\"22.0\" cy=\"17.7\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(20 22.0 17.7)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><ellipse cx=\"20.0\" cy=\"20.9\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(-35 20.0 20.9)\" stroke=\"#9aa4b0\" stroke-width=\"1.3\" fill=\"#9aa4b0\" fill-opacity=\".3\"/><circle cx=\"19\" cy=\"31\" r=\"10\" fill=\"#9aa4b0\" fill-opacity=\".45\" stroke=\"#9aa4b0\" stroke-width=\"2\"/><path d=\"M12 27A8.5 8.5 0 0 1 19 22\" stroke=\"#ead9c0\" stroke-width=\"1.6\"/><circle cx=\"19\" cy=\"31\" r=\"3\" fill=\"#2a1d14\" fill-opacity=\".6\" stroke=\"#f2d14b\" stroke-width=\"1.2\"/><path d=\"M19 28v-3M22 31h3M19 34v3M16 31h-3\" stroke=\"#2a1d14\" stroke-width=\"1\" opacity=\".0\"/><path d=\"M26 43l8-9 4 4 5-8 3 13Z\" fill=\"#c9b08a\" fill-opacity=\".35\" stroke=\"#c9b08a\" stroke-width=\"1.2\"/><path d=\"M30 36l2 4M39 33l1 6\" stroke=\"#c9b08a\" stroke-width=\"1\"/><path d=\"M30 24l4-6M33 29l7-3M29 32l9 0\" stroke=\"#f2d14b\" stroke-width=\"1.8\"/><path d=\"M36 14l3 3M42 20l2 1M32 14l-1 3\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><rect x=\"33\" y=\"22\" width=\"3\" height=\"3\" fill=\"#c9b08a\" stroke=\"none\" transform=\"rotate(25 34 23)\"/><rect x=\"40\" y=\"26\" width=\"2.4\" height=\"2.4\" fill=\"#ead9c0\" stroke=\"none\"/><path d=\"M4 43c3-3 5-3 8 0M40 43c2-3 4-3 6-1\" stroke=\"#ead9c0\" stroke-width=\"1.1\" opacity=\".6\"/></g>",
 "nagel": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g transform=\"rotate(-38 10 38)\"><rect x=\"1\" y=\"35\" width=\"15\" height=\"6\" rx=\"1.2\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.4\"/><path d=\"M3 38h11\" stroke=\"#ead9c0\" stroke-width=\".9\"/><circle cx=\"4\" cy=\"38\" r=\".8\" fill=\"#ead9c0\" stroke=\"none\"/><circle cx=\"13\" cy=\"38\" r=\".8\" fill=\"#ead9c0\" stroke=\"none\"/></g><path d=\"M4 45l6-6\" stroke=\"#c9b08a\" stroke-width=\"3.2\"/><path d=\"M5 41l8 5\" stroke=\"#9aa4b0\" stroke-width=\"1.2\"/><g transform=\"translate(13 35) rotate(-74)\"><path d=\"M5 0H26\" stroke=\"#ead9c0\" stroke-width=\"1.6\"/><path d=\"M26 0l3 0\" stroke=\"#ead9c0\" stroke-width=\".8\"/><path d=\"M5 -2.3v4.6\" stroke=\"#ead9c0\" stroke-width=\"2\"/></g><g transform=\"translate(13 35) rotate(-52)\"><path d=\"M5 0H30\" stroke=\"#ead9c0\" stroke-width=\"1.6\"/><path d=\"M30 0l3 0\" stroke=\"#ead9c0\" stroke-width=\".8\"/><path d=\"M5 -2.3v4.6\" stroke=\"#ead9c0\" stroke-width=\"2\"/></g><g transform=\"translate(13 35) rotate(-30)\"><path d=\"M5 0H32\" stroke=\"#9aa4b0\" stroke-width=\"1.6\"/><path d=\"M32 0l3 0\" stroke=\"#9aa4b0\" stroke-width=\".8\"/><path d=\"M5 -2.3v4.6\" stroke=\"#9aa4b0\" stroke-width=\"2\"/></g><g transform=\"translate(13 35) rotate(-10)\"><path d=\"M5 0H28\" stroke=\"#ead9c0\" stroke-width=\"1.6\"/><path d=\"M28 0l3 0\" stroke=\"#ead9c0\" stroke-width=\".8\"/><path d=\"M5 -2.3v4.6\" stroke=\"#ead9c0\" stroke-width=\"2\"/></g><g transform=\"translate(13 35) rotate(10)\"><path d=\"M5 0H22\" stroke=\"#9aa4b0\" stroke-width=\"1.6\"/><path d=\"M22 0l3 0\" stroke=\"#9aa4b0\" stroke-width=\".8\"/><path d=\"M5 -2.3v4.6\" stroke=\"#9aa4b0\" stroke-width=\"2\"/></g><path d=\"M13 33l5-3M14 36l6 0\" stroke=\"#ff6a2a\" stroke-width=\"1.6\"/></g>",
 "brand": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 33Q8 6 24 5\" stroke=\"#c9b08a\" stroke-width=\"1.3\" stroke-dasharray=\"2 3\" opacity=\".8\"/><g transform=\"translate(20 13) rotate(125)\"><path d=\"M-4 -9h8v-2h-8z\" fill=\"#c9b08a\" fill-opacity=\".6\" stroke=\"#c9b08a\" stroke-width=\"1\"/><path d=\"M-4 -9v5l-3 4v12c0 2 1.5 3 3 3h8c1.500 0 3-1 3-3V0l-3-4v-5\" fill=\"#97C459\" fill-opacity=\".3\" stroke=\"#97C459\" stroke-width=\"1.5\"/><path d=\"M-5 5H5\" stroke=\"#ff6a2a\" stroke-width=\"5\" opacity=\".6\"/><path d=\"M-4 -1h8v7h-8z\" fill=\"#ead9c0\" fill-opacity=\".5\" stroke=\"none\"/><path d=\"M-5 -4v8\" stroke=\"#ead9c0\" stroke-width=\"1\" opacity=\".7\"/></g><path d=\"M16 12c-2 2-1 4 0 5\" stroke=\"#ff6a2a\" stroke-width=\"1.6\"/><path d=\"M10 40H46\" stroke=\"#c9b08a\" stroke-width=\"1.5\"/><path d=\"M26 41c-3-4 0-7 1-10 1 3 3 3 3 6 1-2 2-4 1-8 5 4 7 9 5 12 3-2 3-5 3-8 4 5 4 11-1 14z\" fill=\"#ff6a2a\" fill-opacity=\".75\" stroke=\"#ff6a2a\" stroke-width=\"1.4\"/><path d=\"M30 41c-2-3 0-5 1-7 1 2 3 3 2 7M39 41c-1-2 0-3 1-4 1 1 1 3 0 4\" fill=\"#f2d14b\" fill-opacity=\".8\" stroke=\"#f2d14b\" stroke-width=\"1\"/><path d=\"M22 31l-2-3M45 26l2-3M24 22l-3-1\" stroke=\"#ff6a2a\" stroke-width=\"1.5\"/></g>",
 "sperr": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"24\" cy=\"24\" r=\"22\" fill=\"#f2d14b\" fill-opacity=\".05\"/><ellipse cx=\"9\" cy=\"41\" rx=\"9\" ry=\"3.6\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><ellipse cx=\"9\" cy=\"41\" rx=\"4\" ry=\"1.8\" stroke=\"#c23a2e\" stroke-width=\"1.3\"/><path d=\"M-2 41h4M16 41h4\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><ellipse cx=\"24\" cy=\"43\" rx=\"10\" ry=\"3.6\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><ellipse cx=\"24\" cy=\"43\" rx=\"5\" ry=\"1.8\" stroke=\"#c23a2e\" stroke-width=\"1.3\"/><path d=\"M12 43h4M32 43h4\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><ellipse cx=\"39\" cy=\"41\" rx=\"9\" ry=\"3.6\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><ellipse cx=\"39\" cy=\"41\" rx=\"4\" ry=\"1.8\" stroke=\"#c23a2e\" stroke-width=\"1.3\"/><path d=\"M28 41h4M46 41h4\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><path d=\"M24 2L24 20M10 6L12 22M38 4L36 21\" stroke=\"#c9b08a\" stroke-width=\"1\" stroke-dasharray=\"1.5 3\" opacity=\".7\"/><g transform=\"translate(11 17) rotate(8)\"><path d=\"M0 -9Q4.5 -3 3.4 6H-3.4Q-4.5 -3 0 -9Z\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.3\"/><path d=\"M-3.6 1H3.6M-3.5 3.6H3.5\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><path d=\"M-1.4 -5Q-2.4 -1 -2 3\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M0 6V15M-2 7V12M2 7V13\" stroke=\"#ff6a2a\" stroke-width=\"1.2\" opacity=\".7\"/></g><g transform=\"translate(24 13) rotate(0)\"><path d=\"M0 -9Q4.5 -3 3.4 6H-3.4Q-4.5 -3 0 -9Z\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.3\"/><path d=\"M-3.6 1H3.6M-3.5 3.6H3.5\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><path d=\"M-1.4 -5Q-2.4 -1 -2 3\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M0 6V15M-2 7V12M2 7V13\" stroke=\"#ff6a2a\" stroke-width=\"1.2\" opacity=\".7\"/></g><g transform=\"translate(37 19) rotate(-8)\"><path d=\"M0 -9Q4.5 -3 3.4 6H-3.4Q-4.5 -3 0 -9Z\" fill=\"#9aa4b0\" fill-opacity=\".5\" stroke=\"#9aa4b0\" stroke-width=\"1.3\"/><path d=\"M-3.6 1H3.6M-3.5 3.6H3.5\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><path d=\"M-1.4 -5Q-2.4 -1 -2 3\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M0 6V15M-2 7V12M2 7V13\" stroke=\"#ff6a2a\" stroke-width=\"1.2\" opacity=\".7\"/></g><path d=\"M5 41c2-4 4-4 6-8M43 42c-2-4-3-5-5-8M20 43c1-3 2-4 2-7\" stroke=\"#ff6a2a\" stroke-width=\"1.8\"/><circle cx=\"24\" cy=\"36\" r=\"3\" fill=\"#ff6a2a\" fill-opacity=\".5\" stroke=\"#f2d14b\" stroke-width=\"1.2\"/></g>",
 "spiess": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M0 16h8M2 31h7M0 24h5\" stroke=\"#ead9c0\" stroke-width=\"1.3\" opacity=\".6\"/><g opacity=\"0.45\"><circle cx=\"14\" cy=\"19\" r=\"2.6\" fill=\"#c23a2e\"/><path d=\"M14 22v8M14 24l-4 4M14 24l4 4M14 30l-3 7M14 30l3 7\" stroke=\"#c23a2e\" stroke-width=\"2.2\"/></g><g opacity=\"0.45\"><circle cx=\"25\" cy=\"19\" r=\"2.6\" fill=\"#c23a2e\"/><path d=\"M25 22v8M25 24l-4 4M25 24l4 4M25 30l-3 7M25 30l3 7\" stroke=\"#c23a2e\" stroke-width=\"2.2\"/></g><g opacity=\"0.45\"><circle cx=\"36\" cy=\"19\" r=\"2.6\" fill=\"#c23a2e\"/><path d=\"M36 22v8M36 24l-4 4M36 24l4 4M36 30l-3 7M36 30l3 7\" stroke=\"#c23a2e\" stroke-width=\"2.2\"/></g><path d=\"M3 25L36 21\" stroke=\"#c9b08a\" stroke-width=\"2.6\"/><path d=\"M3 25L36 21\" stroke=\"#ead9c0\" stroke-width=\".8\"/><path d=\"M12 22.5L12.6 27.5M18 22l.6 5\" stroke=\"#2a1d14\" stroke-width=\"1\" opacity=\".0\"/><path d=\"M45 20.5L35 17.5L33 22 35 26.5Z\" fill=\"#9aa4b0\" fill-opacity=\".55\" stroke=\"#9aa4b0\" stroke-width=\"1.5\"/><path d=\"M36 21.5L43 20.6\" stroke=\"#ead9c0\" stroke-width=\"1\"/><path d=\"M5 25l-3-3M5 25l-3 3M7 24l-2-4\" stroke=\"#c9b08a\" stroke-width=\"1.5\"/><path d=\"M13 31l-1 4M24 31l-1 4M35 31l-1 4\" stroke=\"#c23a2e\" stroke-width=\"1.6\"/><path d=\"M11 36l4 0M22 36l4 0\" stroke=\"#c23a2e\" stroke-width=\"1\" opacity=\".0\"/></g>",
 "stab": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 43H46\" stroke=\"#c9b08a\" stroke-width=\"1.6\"/><path d=\"M4 33Q18 -3 40 34\" stroke=\"#ead9c0\" stroke-width=\"1.4\" stroke-dasharray=\"2.5 3\"/><path d=\"M40 34l-.5-5 4.500 2\" stroke=\"#ead9c0\" stroke-width=\"1.5\" opacity=\"0\"/><path d=\"M14 40L22 14\" stroke=\"#c9b08a\" stroke-width=\"2.6\"/><path d=\"M14.5 38.5L21 17\" stroke=\"#ead9c0\" stroke-width=\".8\"/><path d=\"M14 44l-3.2-7.5 6.200-.5Z\" fill=\"#9aa4b0\" fill-opacity=\".6\" stroke=\"#9aa4b0\" stroke-width=\"1.4\"/><path d=\"M8 43l-4 2M20 43l4 2M10 41l-5-1M18 41l5-1\" stroke=\"#c9b08a\" stroke-width=\"1.2\"/><g opacity=\"0.9\"><circle cx=\"29\" cy=\"13\" r=\"2.4\" fill=\"#c23a2e\"/><path d=\"M29 16v8M29 18l-4 4M29 18l4 4M29 24l-3 7M29 24l3 7\" stroke=\"#c23a2e\" stroke-width=\"2.2\"/></g><path d=\"M35 43c2-3 4-3 6-6M41 43c2-2 4-2 6-4M32 41c-3-2-3-4-3-7\" stroke=\"#ff6a2a\" stroke-width=\"1.5\"/><ellipse cx=\"40\" cy=\"43.500\" rx=\"6\" ry=\"1.8\" stroke=\"#c9b08a\" stroke-width=\"1.2\"/></g>",
 "stand": "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><ellipse cx=\"24\" cy=\"39\" rx=\"20\" ry=\"6\" fill=\"#f2d14b\" fill-opacity=\".08\" stroke=\"#f2d14b\" stroke-width=\"1.4\"/><ellipse cx=\"24\" cy=\"39\" rx=\"14\" ry=\"4\" stroke=\"#f2d14b\" stroke-width=\"1\" stroke-dasharray=\"3 2.5\"/><path d=\"M24 8V44\" stroke=\"#c9b08a\" stroke-width=\"2.4\"/><path d=\"M24 9V43\" stroke=\"#ead9c0\" stroke-width=\".7\" opacity=\".6\"/><path d=\"M24 1l3 5h-6z\" fill=\"#f2d14b\" stroke=\"#f2d14b\" stroke-width=\"1.2\"/><circle cx=\"24\" cy=\"7.500\" r=\"1.800\" fill=\"#f2d14b\" stroke=\"none\"/><path d=\"M25 9H44V27L38.500 24 33 27 28 24.500 25 27Z\" fill=\"#c23a2e\" fill-opacity=\".65\" stroke=\"#c23a2e\" stroke-width=\"1.5\"/><path d=\"M25 9H44\" stroke=\"#f2d14b\" stroke-width=\"2\"/><path d=\"M26 25l2 .5M36 26l2 1M41 26l2 0\" stroke=\"#f2d14b\" stroke-width=\"1\" opacity=\"0\"/><path d=\"M34.500 12l1.200 3.200h3.300l-2.700 2 1 3.300-2.800-2-2.800 2 1-3.300-2.700-2h3.300z\" fill=\"#f2d14b\" fill-opacity=\".9\" stroke=\"none\"/><path d=\"M27 12v10\" stroke=\"#2a1d14\" stroke-width=\"1\" opacity=\".5\"/><path d=\"M19 14h5M19 17h5\" stroke=\"#f2d14b\" stroke-width=\"1.5\" opacity=\"0\"/><path d=\"M12 43l5-3 3 3M28 43l3-3 5 3\" fill=\"#c9b08a\" fill-opacity=\".4\" stroke=\"#c9b08a\" stroke-width=\"1.2\"/><path d=\"M6 33c-2-3-2-6 0-9M42 33c2-3 2-6 0-9\" stroke=\"#f2d14b\" stroke-width=\"1.5\"/></g>"
};
/** Weapon class badges on a 24 px grid; CUR is replaced by the color. */
export const WEAPON_GLYPHS: Readonly<Record<WeaponKindId, string>> = {
 "blade": "<path d=\"M8.4 13.4L18.2 3.6 21.500 2.500 20.500 5.800 10.600 15.600Z\" fill=\"CUR\"/><path d=\"M6.500 11.500l6 6\" stroke=\"CUR\" stroke-width=\"2.800\" stroke-linecap=\"round\"/><path d=\"M9.500 14.500L4.500 19.500\" stroke=\"CUR\" stroke-width=\"2.800\" stroke-linecap=\"round\"/><circle cx=\"3.500\" cy=\"20.500\" r=\"1.900\" fill=\"CUR\"/>",
 "hammer": "<path d=\"M4 20L16 8\" stroke=\"CUR\" stroke-width=\"2.800\" stroke-linecap=\"round\"/><g transform=\"rotate(45 16 8)\"><rect x=\"8.500\" y=\"3\" width=\"15\" height=\"9\" rx=\"1.200\" fill=\"CUR\"/><path d=\"M16 3v9\" stroke=\"#1c140f\" stroke-width=\"1\" opacity=\".55\"/></g>",
 "sling": "<path d=\"M12 7v14\" stroke=\"CUR\" stroke-width=\"3.400\" stroke-linecap=\"round\"/><path d=\"M2.500 10.500Q12 3.500 21.500 10.500\" fill=\"none\" stroke=\"CUR\" stroke-width=\"2.800\" stroke-linecap=\"round\"/><path d=\"M3 10.500L12 17.500 21 10.500\" fill=\"none\" stroke=\"CUR\" stroke-width=\"1.100\"/><path d=\"M12 1l2.500 4.500h-5z\" fill=\"CUR\"/><path d=\"M9 20.500h6\" stroke=\"CUR\" stroke-width=\"2.600\" stroke-linecap=\"round\"/>",
 "spear": "<path d=\"M3 21L14 10\" stroke=\"CUR\" stroke-width=\"2.400\" stroke-linecap=\"round\"/><path d=\"M20.700 3.300L17.700 9.500 14 10 14.500 6.300Z\" fill=\"CUR\" stroke=\"CUR\" stroke-width=\"1.600\" stroke-linejoin=\"round\"/><path d=\"M11 13l-2.500-2.500\" stroke=\"CUR\" stroke-width=\"1.600\" stroke-linecap=\"round\" opacity=\"0\"/>"
};
