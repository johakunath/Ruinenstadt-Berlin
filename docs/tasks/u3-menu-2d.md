# U3 Menus look exactly like 2D [Claude · Opus medium]

Status: open. Playtest Johannes, 2026-11-17: U1/U2 copied the structure, not the look. Take over the 2D layout as it is, no mockup round.

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
