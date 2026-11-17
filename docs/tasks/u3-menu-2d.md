# U3 Menus look exactly like 2D [Claude · Opus medium]

Status: done (2026-11-17), playtest open. Playtest Johannes, 2026-11-17: U1/U2 copied the structure, not the look. Take over the 2D layout as it is, no mockup round.

Johannes' decisions (2026-11-17) on top of the table: no dashed empty slots and no "—"; × top right instead of Weiter; Optionen as its own screen; a fullscreen icon button top right on every screen, left of the pause button or the menu ×; a light start screen that loads the game only on play.

## Handover
- Built: `src/boot.ts` (entry) shows the start screen (`src/ui/start.ts`) and `import()`s `main.ts` only on Weiter, Neue Expedition, Lager or a confirmed Spielstand löschen, then presses that button again; `?autostart` skips it. Settings shared by both screens: `src/ui/settings.ts` (one `opts`, `[data-opt]` views, hooks main.ts fills in; new stored option `sound`). Grafik on the start screen is only stored; in a run it saves the checkpoint and reloads straight back into the run (`RESUME_KEY`, mid-fight the last checkpoint as with Hauptmenü).
- Options screen `src/ui/options-screen.ts` (from the start screen and the menu cog; Expedition rows only in a run), controls graphics `src/ui/controls-gfx.ts`, line icons `src/ui/ui-icons.ts`, focus and pad navigation `src/ui/focus.ts` (option cards go row by row). Menu and inventory restyled in `style.css` (U3 block); `#fsb` in index.html.
- Reused from 2D: palette, Barlow Condensed and Pirata One (now `@fontsource` packages, no Google request), `.tabs`, `.ires`, `.stab`/`.sn` tooltips (`SINFO` texts), `.orow`/`.tgl`/`.seg`/`.osec`/`.ctl`/`.cgfx` styles, the three SVGs (`padSVG`, `keySVG`, `touchSVG`) relabelled with the 3D bindings and touch positions, the Schrott icon `R05`, the cog.
- Proof: `docs/proof/u3-menu-2d/3d-*.png` (start, Weiter, Optionen, Steuerung 0–2, Inventar with and without a selection, at 1280 × 720 and 844 × 390, some at 1280 × 800).
- Kodex as 2D (playtest 2026-11-17: "too many small symbols, not well filled"): `kodexHtml` in `src/ui/menu.ts` now builds the 2D Kodex (`js/panels.js` invTab 'kodex') as is: centred labels, two columns of cards (padding 12/14, gap 10, 14 between sections), 64 px portrait or item icon, 20 px name, 16 px line, right column for weakness or station. Order as 2D: Gegner, Endgegner, Bewohner (with the 2D hint), Legendäre Funde, Sets (3 × 44 px icons), Elite-Gegner. Unknown enemies show the 2D black silhouette with "?", unknown survivors and items the greyed art. Portraits copied from 2D `assets/portraits/` (15 files, `assets/LICENSES.md`): Schlurfer E01, Hetzer E09 (Raser), Raptor E11, Rex E12, Turmwächter X03, Hauptmann X01, survivors S01–S06; elites use the Brocken bust E02 with the elite colour ring (2D drew the in-game sprite). Art gap: Feldwebel and Schaffner have no painted bust, a code line glyph stands in (Codex task). Up/down (pad, arrow keys) scroll the Kodex since it has no controls. Proof: `docs/proof/u3-menu-2d/2d-kodex-*.png` beside `3d-kodex-*.png`.
- Open: playtest on the Tab S9 and a phone (fullscreen button, start screen fit); camp, trade, end screens keep the old panel style; with a cloud save newer than the local one the page may reload once while the game loads.

## Differences (2D left, 3D now; screens in `docs/proof/u3-menu-2d/` and `docs/proof/u1-menu/`)
| Part | 2D | 3D now |
|---|---|---|
| Tabs | Text tabs with line icons, orange underline on the active one (Inventar · Karte · Segen · Quests · Kodex) | Boxed buttons, no icons, Optionen as tab |
| Header right | Schrott with icon, Item Level, district · Welle, Versteckte Segen, cog button, orange WEITER | Text only, × button |
| Font | Barlow Condensed (2D `css/style.css`) | System sans |
| Slots | Dashed empty slots, lock on Implantat | Solid boxes with "—" |
| Stats | Icon per row and `?` tooltip | Plain rows |
| Detail | Wide right panel with hint "Tippe ein Teil an…" | Two narrow cards |
| Options | Own screen from the cog: title "Optionen", sections SPIEL / BILD UND TON / …, one card per setting with sub-line, toggles and segment buttons, ZURÜCK | Tab with checkboxes and a table |
| Vollbild in the HUD | Button `#fsb` next to the pause button while not in fullscreen, during runs and in camp (`index.html:30`, `js/input.js:64-65`) | Only a switch in Optionen |
| Steuerung | Segment Touch · Tastatur und Maus · Controller, each an SVG with labelled callouts | One table |

## Source (2D, read only)
`js/panels.js:182-197` (header, tabs, inventory), `:260-300` (options, `seg`, `padSVG`, `keySVG`, `touchSVG`), `css/style.css` (tabs, `.osec`, `.ctl`, `.cgfx`, fonts), `index.html` font links, icons in `icons/`.

## Target
`src/ui/menu.ts`, `src/ui/inventory.ts`, `src/ui/ui.ts` (options), `src/ui/style.css`, `index.html`. Port the three control SVGs and relabel them with the 3D bindings (`src/input`).

## Done when
Side-by-side screenshots (2D vs 3D) at 1280 × 720, 1280 × 800 and 844 × 390 for Inventar, Optionen and each Steuerung variant in `docs/proof/u3-menu-2d/`; e2e green; pad, touch, keyboard still work.
