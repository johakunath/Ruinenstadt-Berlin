# WP4 proof

## Step 1 weapons (2026-11-19)

Files updated for steps 1f and 1g (look 1 feedback, after the last model change).

| File | Shows |
|---|---|
| `weapons-normal.png` | 14 normal bases (incl. starter `rohr`, legacy `latte`): painted 2D icon, model, rendered icon; caption with tip height, reach, damage, hands |
| `weapons-neon-gdr.png` | 4 neon (glowing in their signature colour, no element) and 4 GDR bases |
| `weapons-legendary.png` | 7 legendaries, Morgenstern, the two set variants |
| `ik-hammer-stand.png` | Left: Vorschlaghammer (two-handed, a third shorter) with `ik=1 stance=1`, left hand on the shaft; right: one-handed Pflasterhammer on `Sword_Idle`, no left grip |
| `ik-spear-thrust.png` | Speer der Siegessäule (shorter) on `Punch_Cross` with `thrust=light1 ik=1`: shaft along the hit line |
| `inventory-1280.png`, `inventory-844.png` | Bag with 21 weapons in rendered icons at 1280 × 720 and 844 × 390; the card shows `Stark gegen` and the D8 damage |
| `game-boxh.png` | Game at 1280 × 720, Leistung, Boxenhammer equipped (no URL option equips a weapon: `__game.setLoadout` through the eval argument of `tools/screenshot.mjs`) |

Sheets: `node tools/item-sheet.mjs out.png "mode=weapons&family=normal"` (studio light and ACES, not the game's sky; metal reads brighter than in the game). The painted column needs the originals in `assets-src/painted-icons/` (git-ignored; `git show e2ed157:assets/inventory/<id>.webp`). Icons: `node tools/item-icons.mjs`.

### Draw calls

`FRAMES=3 node tools/passes.mjs "map=hof&autostart&profile=Leistung&seed=7"`, starter weapon (Rostige Klinge), frame 1 (with the 40 Hz shadow pass). Seed fixed: without it pass sizes vary by ±2 between runs.

| Pass | Before | After | Weapon |
|---|---|---|---|
| 44 960×540 | 18 | 10 | 10 → 2 |
| 47 960×540 (pre-pass) | 53 | 45 | 10 → 2 |
| 49 1024×1024 (sun shadow) | 58 | 50 | 10 → 2 |
| 48 1280×720 (beauty) | 105 | 97 | 10 → 2 |
| Total | 264 | 232 | −32 |

A weapon with an element or a signature glow draws 3 per pass (the glow mesh). Triangles: 208,988 → 208,348. After step 1f (glow material with vertex colours, new models): unchanged at 232 calls, 208,380 triangles.

### Unchanged

- `node tools/clip-swing.mjs Sword_Regular_A 0.0333`, `Sword_Heavy_Combo`, `Punch_Cross`: output identical before and after.
- `clip-sheet` IK weights (`ik=1`) for hammer stand, hammer combo and spear thrust: identical log lines before and after.
