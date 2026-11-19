# WP4 proof

## Step 1 weapons (2026-11-19)

| File | Shows |
|---|---|
| `weapons-normal.png` | 14 normal bases (incl. starter `rohr`, legacy `latte`) beside their icons |
| `weapons-neon-gdr.png` | 4 neon (glowing in their signature colour, no element) and 4 GDR bases |
| `weapons-legendary.png` | 7 legendaries, Morgenstern, the two set variants |
| `ik-hammer-stand.png` | Two-handed stand with `ik=1 stance=1`: Rohrzange, Boxenhammer; left hand on the shaft |
| `ik-spear-thrust.png` | Speer der Siegessäule on `Punch_Cross` with `thrust=light1 ik=1`: shaft along the hit line |
| `game-leucht.png` | Game at 1280 × 720, Leistung, Leuchtröhre equipped (no URL option equips a weapon: `__game.setLoadout` through the eval argument of `tools/screenshot.mjs`) |

Sheets: `node tools/item-sheet.mjs out.png "mode=weapons&family=normal"` (studio light and ACES, not the game's sky; metal reads brighter than in the game).

### Draw calls

`FRAMES=3 node tools/passes.mjs "map=hof&autostart&profile=Leistung&seed=7"`, starter weapon (Rostige Klinge), frame 1 (with the 40 Hz shadow pass). Seed fixed: without it pass sizes vary by ±2 between runs.

| Pass | Before | After | Weapon |
|---|---|---|---|
| 44 960×540 | 18 | 10 | 10 → 2 |
| 47 960×540 (pre-pass) | 53 | 45 | 10 → 2 |
| 49 1024×1024 (sun shadow) | 58 | 50 | 10 → 2 |
| 48 1280×720 (beauty) | 105 | 97 | 10 → 2 |
| Total | 264 | 232 | −32 |

A weapon with an element or a signature glow draws 3 per pass (the glow mesh). Triangles: 208,988 → 208,348.

### Unchanged

- `node tools/clip-swing.mjs Sword_Regular_A 0.0333`, `Sword_Heavy_Combo`, `Punch_Cross`: output identical before and after.
- `clip-sheet` IK weights (`ik=1`) for hammer stand, hammer combo and spear thrust: identical log lines before and after.
