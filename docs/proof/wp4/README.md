# WP4 proof

## Step 1 weapons (2026-11-19)

Files updated for steps 1f, 1g and 1h (look 1 and 2 feedback, after the last model change).

| File | Shows |
|---|---|
| `weapons-normal.png` | 14 normal bases (incl. starter `rohr`, legacy `latte`): painted 2D icon, model, rendered icon; caption with tip height, reach, damage, hands |
| `weapons-neon-gdr.png` | 4 neon (glowing in their signature colour, no element) and 4 GDR bases |
| `weapons-legendary.png` | 7 legendaries, Morgenstern, the two set variants |
| `ik-hammer-stand.png` | Left: Vorschlaghammer (two-handed, a third shorter) with `ik=1 stance=1`, left hand on the shaft; right: one-handed Pflasterhammer on `Sword_Idle`, no left grip |
| `ik-spear-thrust.png` | Speer der Siegessäule (shorter) on `Punch_Cross` with `thrust=light1 ik=1`: shaft along the hit line |
| `inventory-1280.png`, `inventory-844.png` | Bag with 21 weapons in rendered icons at 1280 × 720 and 844 × 390; the card shows `Stark gegen` and the D8 damage |
| `neonfl-shot.png` | Step 1h: the Neonflinte (assault rifle) on `Pistol_Shoot` 0 to 0.45 s with `ik=1`: barrel level along the shot line at the shot, the kick after it, left hand at the rear of the handguard |
| `neonfl-game.png` | Step 1h: game frame (`tools/sequence.mjs`, `cam=5,30`) of the rifle's first shot, the shot at muzzle height |
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

A weapon with an element or a signature glow draws 3 per pass (the glow mesh). Triangles: 208,988 → 208,348. After step 1f (glow material with vertex colours, new models): unchanged at 232 calls, 208,380 triangles. Step 1h adds one clip to `anims.glb` (`Pistol_Shoot`): 1,198,864 → 1,212,556 bytes; `hero.glb` and `zombie.glb` unchanged; `clip-swing` output for the three reference clips still identical.

### Unchanged

- `node tools/clip-swing.mjs Sword_Regular_A 0.0333`, `Sword_Heavy_Combo`, `Punch_Cross`: output identical before and after.
- `clip-sheet` IK weights (`ik=1`) for hammer stand, hammer combo and spear thrust: identical log lines before and after.

## Step 3 pickups (P10, 2026-11-26)

Files in `step3/`. Gate G2: Johannes picked A (2026-11-27). Phase 1 built all three looks behind `?pickup=A|B|C`; phase 2 removed B, C and the switch. The A, B, C shots stay as the record of the choice.

| File | Shows |
|---|---|
| `variants-qualitaet.jpg`, `variants-leistung.jpg` | Close crop of the same 12 drops in A, B and C side by side |
| `game-{A,B,C}-{qualitaet,leistung}.jpg` | Game at 1280 × 720, Köpenick start, `?autostart&drops=12&seed=7&pickup=<v>&profile=<p>` (phase 1; today `?autostart&drops=12` shows A): 12 mixed drops of every rarity (legendary Stahlklinge and Zielchip, rare Vorschlaghammer and Siegelring, set Bauhelm, magic Schutzweste, Rohrspeer and Spreekiesel, common Jagdzwille; Verband, Döner, Stoff) |
| `pickups.jpg` | Every model close (`node tools/pickup-models.mjs sheet out.png "rarity=0"`), triangles per model; phase 2: all 20 final (12 Pixal3D, 8 reused game models) |
| `game-20-qualitaet.jpg` | Phase 2: `?autostart&drops=20&seed=7`, every kind once, look A |

### Draw calls

`node tools/passes.mjs "map=hof&autostart&seed=7&profile=<p>&drops=<n>"` (the tool now waits for the renderer: software GL needs about 30 s).

| Qualität, frame 1 | 0 drops | 12 drops (12 kinds) | 20 drops (20 kinds, phase 2) | Loot |
|---|---|---|---|---|
| Pre-pass 1280×720 | 45 | 57 | 65 | +1 per kind |
| Beauty 1280×720 | 99 | 114 | 122 | +1 per kind, glow (1), beam (2: a transparent double-sided material draws its back and front faces apart, as before step 3) |
| Sun shadow 2048 | 62 | 62 | 62 | 0: pickups cast no shadow |
| Total | 247 | 274 | 290 | +27, +43 |

Leistung: beauty 97 → 112 (+15, the same split); no pre-pass target there. Before step 3 the same 12 drops cost 4 in the beauty pass (crystal, glow, beam twice) and 1 in the pre-pass. A kind not on the ground costs nothing (`visible = count > 0`).
