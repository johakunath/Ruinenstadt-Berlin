# WP4 Hero, weapons and loot visuals [Claude · Fable high (spec) · Opus high (build) · Codex (icons)]

Status: step 0 (this spec) done 2026-11-19 (Fable 5.2 high). Step 1a to 1d built 2026-11-19 (handover at the end); 1e (icons, Codex) and steps 2 to 6 open. Step 2 (clothing) and step 4 (2D #2 close-out) built 2026-11-19 (handover at the end); tunnel set waits for Johannes' pick. Covers backlog P29, P32, P10, P31 and 2D backlog #2 and #38. Notes are Fable's; Opus writes final prose where it touches other docs.

## Goal
Every weapon base, armor, hat, glove, boot, talisman, ring and implant shows on the hero, legendaries and sets have their own look, ground loot shows what it is, and daggers come in as dual wield. Draw calls on the hero go down, not up.

## Findings (code and files checked 2026-11-19)

| Topic | Finding |
|---|---|
| Weapon cost today | Each kind model is 9 to 10 separate meshes (200 to 350 triangles): 9 to 10 draw calls per pass, in beauty, sun shadow and normal/depth pre-pass, plus the hero contour when she is hidden. About 30 draw calls per frame for one weapon |
| Weapon models | Built on first show; only the equipped one exists. 30 models cost code, not frame time |
| Hero today | Default look draws 8 skinned meshes, 19,700 triangles (budget 9 and 32,000, `src/data/hero-contract.ts`) |
| Clothing colours | Pieces carry flat vertex colours times baked occlusion, in few chroma classes (rgb ÷ max, in eighths): `a_mantel` 8,3,1 (2,329 vertices) · 8,7,6 (1,479) · 8,4,1 (216); `a_weste` 8,5,3 (1,482) · 6,8,2 (1,090) · 8,3,1 (504) · 8,4,1 (168); `f_stiefel` 8,4,2; `f_turnsch` 8,8,6 · 8,7,5; `g_handsch` 8,3,1; `scarf` 8,0,0 |
| Codex PR #56 (open) | Neutral albedo maps multiply those vertex colours ("vertex colours supply the palette"); it clones one material per piece. A recolour of the vertex colours keeps working with it |
| 2D #2 | Already ported: names (`LEGENDARY_HEAD/HAND/FOOT/RING_NAMES`), powers (`pickel`, `kiezbox`, `schaffner`, `weltuhr` in `src/sim/combat.ts`, `abilities.ts`, tests in `legendary.test.ts`), set pieces for h, g, f, r in `SETS`, icons I78 to I87, implants drop on `flavor: 'neon'` (Mitte). Open is only how they look |
| L2 | All 7 rows have code (first material by kind `src/sim/loot.ts:33`, `district` and `flavor` on the maps, ingredients drop, `eliteBonus`, one `DIFFICULTIES`). The file still says open |
| Dual-wield clips | None in UAL1 or UAL2 (all 86 names read from the packs). Left-hand candidates: `Punch_Jab` (imported; which hand strikes is not measured), `Shield_OneShot` (not looked at) |
| Pickups | 6 drop kinds (`src/sim/loot.ts`): item, heal, food, material × 4, ingredient × 3. Today 3 instanced draw calls for all |
| Blender | Not available in the cloud (not installed, not tried). Every change to `hero.glb` is a PC step |

## Reuse from 2D (read only)

| What | Where |
|---|---|
| Shape of every weapon base (code drawing) | `js/art.js:7` `WM` (30 entries, colours included) |
| Painted side view per weapon base | `assets/hero/rig/weapon-i<NN>.webp` (30 files, ids as `ITEM_ICONS`) |
| Outfit colours and flags per armor base | `js/data.js:127` `LOOK` |
| Hat shape and colour, glove and boot colours per base | `js/data.js:113` `HEADL`, `GLOVE`, `BOOT` |
| Which pieces existed | `tools/build_hero.py:39` `CLOTHES`, `HATS`, `GLOVES`, `BOOTS` |
| Implant mark on the hero | `js/art.js` `drawHero`: cyan lines along the arm (`CY`) |
| Pickup shapes | `assets/props/pickup-*.webp` (16), kinds in `js/pickup-art.js` `pickupKind` |
| Glow on legendary and element weapons | `drawHero`: additive glow at 40 % of the weapon length in element or legendary colour |

## Decisions

### D1 Weapons: one model per base, built from a parts kit per kind
- Per base, not per family. Reason: only the equipped model exists at runtime, so 30 models cost the same per frame as 4. A family (normal, neon, GDR, legendary) sets palette and accents, not the shape.
- The **kind fixes the envelope**, so hit arcs, clip timing, `LEFT_GRIP`, `TWO_HAND_STAND` and `THRUST` stay as they are and `src/data/combat.ts` is not touched:

| Kind | Tip height on +Y | Must stay free (radius ≤ 0.033) |
|---|---|---|
| blade | 0.88 to 1.11 | grip −0.12 to 0.14 |
| hammer | head centre 1.06, top ≤ 1.2 | grip −0.15 to 0.15, left grip at 0.48, stand grip at −0.08 |
| spear | 1.81 (`THRUST.spear.tip`), butt −0.6 | grip −0.13 to 0.17, left grip at 0.50 and −0.50 |
| sling | fork top ≤ 0.4 | grip −0.07 to 0.14 |

- **Merged per material**: at most 3 meshes per weapon. `metal` (vertex colour × `paintMetal` grey, metalness 0.7), `matte` (vertex colour × a neutral cloth and wood grain, metalness 0, double-sided for ribbons and flags), `glow` (emissive, hidden when the item has neither element nor signature glow). Paint goes into vertex colours.
- Glow colour: the element colour when the item has an element, else the base's signature colour (neon and legendary), else off.
- Model key: base, plus the set id for set weapons that share a base (`brech` + `kiez`, `zwille` + `spree`): same geometry, set palette. `weaponModel(kind, base, set?)` falls back to the kind's default base.
- The unused `pipe` model goes. `latte` (legacy saves) gets the nailed plank of its icon.
- Icons are rendered from the models (D10, Johannes 2026-11-19); the painted icons were the shape reference for look 1.

### D2 Equipment on the hero: three mechanisms, cheapest first

| # | Mechanism | Used for | Cost | Where built |
|---|---|---|---|---|
| 1 | **Palette**: recolour a piece's vertex colours per item base (chroma class → new colour, brightness kept, so the baked occlusion stays). One colour attribute per piece and palette, built on first use, swapped in `setLook` | Every armor, glove, boot base, set colours, scarf colour of two legendary coats | 0 draw calls, 0 triangles, about 12 KB per palette | Code, at load |
| 2 | **Gear mesh**: all rigid parts of the look merged into one `SkinnedMesh`, each vertex bound to one bone with weight 1 (two bones where a part spans a joint). Rebuilt when the look changes (equip only). A second mesh `gear glow` holds emissive parts | Hats, plates, collars, cuffs, boot shafts, talisman, ring, implants | 1 draw call for everything, +1 when a glow part is worn | Code, at equip |
| 3 | New skinned shell from the body's faces | Only what 1 and 2 cannot do: a jacket with sleeves, a poncho | Triangles of a piece, 0 draw calls (it replaces one) | Blender on the PC, **not in WP4** unless Johannes asks after the step 2 sheet |

- "Built in code, Blender only to skin" becomes: rigid parts are skinned in code. A part is authored in hero bind space (T-pose, meters, +Y up, +Z front) as an offset from its bone's bind position; bind matrices come from the clone's skeleton (`bindMatrix`, `skeleton` copied from an existing piece). No GLB change, no Blender.
- The gear mesh uses its own material: vertex colours, no map (PR #56 puts maps on the piece materials). One more shader program, compiled at load in the existing `showAll` pass.
- NPCs built from `HeroModel` get no gear mesh until a look asks for one.

Attachment points:

| Slot | Bone | Placement | Hair |
|---|---|---|---|
| Kopf (h) | `Head` | On the skull; hair is rigid on the same bone, so a hat never clips while moving. Size each hat ≥ 8 mm outside the hair at its height, or set `hideHair` and give the hat its own fringe or neck part | `hideHair` per hat: `topfhelm` yes; others decided on the sheet |
| Körper (a) parts | `spine_03` (chest and back plates, collars), `upperarm_l/r` (pauldrons), `clavicle_l/r` (shoulder boards) | Over the coat or vest shell: offsets from the measured shell, +10 mm | – |
| Hände (g) parts | `lowerarm_l/r` (cuffs, wraps) | Outside the sleeve | – |
| Füße (f) parts | `calf_l/r` (shafts), `foot_l/r` (toe caps) | Outside the boot | – |
| Talisman (t) | `spine_03` | Pendant on a cord at the chest below the scarf knot, 7 to 9 cm (1.5 × real size); `abzeichen` is pinned flat | – |
| Ring (r) | `ring_01_l` | Torus radius 11 mm (clears the glove) with a bezel, 1.6 × real size. Left hand: the right one is hidden by the weapon | – |
| Implantat (i) | krit: `Head` (lens over the left eye, chip at the temple); tempo: `lowerarm_l`, `upperarm_l` (bracer, coupler, cables); heil: `spine_03` (pump on the chest, unit on the back) | Emissive accents in `gear glow`, cyan `#43d1cf` and magenta `#ff4fa3` | – |

Readability (default camera: hero about 160 px tall at 1080p, 60 px on a phone): hats, plates and palettes read in the game; a talisman is 5 to 7 px; **a ring is under 2 px** and only shows in the inventory doll. Rings are built last; if the step 2 sheet shows nothing in the doll either, only the legendary and set rings stay (they carry a glow).

### D3 Budget, both profiles
Both profiles use the same meshes (as H1). The only profile switch is the particle count of D5.

| Piece | Triangles (max) | Draw calls per pass | Passes |
|---|---|---|---|
| Weapon, any base | 900 (legendary 1,400) | ≤ 3 (today 9 to 10) | beauty, sun shadow, pre-pass, contour when hidden |
| Off-hand weapon (step 6) | 500 | ≤ 3 | same |
| Hat | 900 | in gear mesh | |
| Armor parts | 900 | in gear mesh | |
| Glove and boot parts | 300 | in gear mesh | |
| Talisman / ring / implant | 150 / 100 / 250 | in gear mesh | |
| **Gear mesh, any look** | **2,500** | **1** | beauty, sun shadow, pre-pass, contour when hidden |
| Gear glow | 300 | 1, only with a glow part | beauty, pre-pass (no shadow) |
| Palette | 0 | 0 | – |
| Pickup model (step 3) | 160 each, ≤ 20 models | 1 per kind lying on the ground (typical 2 to 5) + 2 for glow and beam (today 3 in total) | beauty, pre-pass |
| Gear particles (step 5) | 2 per sprite | 1 for all | beauty only (`FX_LAYER`) |

| Hero budget (`HERO_BUDGET`) | Now | WP4 |
|---|---|---|
| Visible triangles | ≤ 32,000 (default look 19,700) | ≤ 32,000 (default look + full gear about 22,500) |
| Skinned draw calls | ≤ 9 | ≤ 11 (8 + gear + gear glow) |
| Joints, file size | 72, ≤ 3 MB | unchanged, `hero.glb` is not rebuilt |

Net per frame on Qualität with full gear: weapon −18 to −21 draw calls, gear +5, so fewer than today. Leistung: the same counts; its shadow pass runs at 40 Hz. Particles: 48 sprites on Qualität, 24 on Leistung. No lights anywhere; glow reads through bloom (0.7 on Leistung).

### D4 Pickups: one instanced model per kind
- 20 models: 4 weapon kinds, armor, head, hands, feet, talisman, ring, implant, heal, food, 4 materials, 3 ingredients. One `InstancedMesh` each (`visible = count > 0`), one shared vertex-colour material. No shadows (as today).
- Weapon drops show the kind, not the base.
- Ground glow ring and beam stay as the rarity signal (2 draw calls, unchanged).
- How the model itself carries rarity is a look decision: gate G2.

### D5 Legendary and set looks: four layers, each with its cost

| Layer | What | Cost |
|---|---|---|
| Mesh part | The base's own model (step 1d) or gear part (step 2) | In the D3 budget |
| Glow edge | Emissive geometry in the weapon's `glow` mesh or in `gear glow`, signature colour, slow pulse (0.8 to 1.3 ×, one uniform) | 0 extra draw calls |
| Particles | One shared instanced sprite mesh `GearFx` on `FX_LAYER`, additive. At most 3 emitters (weapon, armor, one more), each anchored to a bone or the weapon tip | 1 draw call, 48 / 24 sprites, no light |
| Proc flash | A sprite burst from the same pool when the power fires. Uses the existing sim event where one exists (`shock`, `bolt`, `secondWind`, `hit.critical`); else one new event `{ type: 'legendaryProc', id, x, z }` pushed at the `hasL` site, with a unit test and no rule change | 0 extra draw calls |

Sets: one signature colour per set on every piece through palette and gear parts (Kiezwache blue `#3a5a8a` with orange, Spreegeist green `#2f5a4a`, Zitadelle iron `#8a8f96`). How strong all of this is: gate G3.

### D6 Daggers and dual wield (2D #38): recommendation, Johannes decides (gate G4)

| | Option | Changes | Size |
|---|---|---|---|
| A | **Show the second blade** when the Umbau card Doppelklinge (G1: two cuts of 60 %) is held. No new item, no new rule | Off-hand model on `hand_l`, left-hand cut clip | Half a session |
| B | **Dolche as a blade base** (`dolch`, flag `dual`): one item, a dagger in each hand, own 4-hit chain (faster, 20 % less reach, alternating hands), powers and Umbau of the Klinge | New base, name, icon (Codex), chain in `combat.ts`, sim rule by base, bot check for damage parity ± 10 % | 1 to 2 sessions |
| C | Fifth weapon kind `dagger` | 3 powers, 3 Umbau cards, glyphs, loot weight, badge, bot | 3+ sessions, balance |
| D | Off-hand slot (dagger + sword) | New slot: save format, doll layout, loot tables, stats, bot | Largest |

Recommended: A first, then B. C and D not now. Clips for the left hand: mirror `Sword_Regular_A` and `_B` at asset build (swap `_l` and `_r` tracks, mirror the rotations and the pelvis x; **not tried**, check on strips), fallback `Punch_Jab`.

### D7 Order

| Order | Step | Needs | PR |
|---|---|---|---|
| 1 | Step 1 weapons (1a rack, then 1b to 1d) | – | A (with this spec) |
| 2 | Step 2 hero equipment and step 4 close-out | – (independent of step 1) | B |
| 3 | Step 3 pickups | G2 | C |
| 4 | Step 5 legendary and set effects | steps 1d and 2, G3 | D |
| 5 | Step 6 dual wield | step 1a, G4 | E |
| any time | Step 1e icons (Codex) | sheets of 1b to 1d | own PR |

One PR per step (review rule: one Codex review per PR). Steps 1 and 2 touch different files and can run in parallel sessions.

## Gates (Johannes)

| Gate | Step | Kind | What is shown |
|---|---|---|---|
| G1 | 1, 2 | Routine: build, show, continue | Sheets: every weapon next to its icon; every look front and back, doll and game camera |
| G2 | 3 | **Choice before the build** | Mockup, three variants of a pickup: A natural colours on the rarity ring and beam (recommended, slight emissive in rarity colour); B model tinted in the rarity colour like today's crystal; C small model above today's crystal |
| G3 | 5 | **Choice before the rollout** | Look sheet on Fernsehturm-Splitter and Mantel des letzten Späti: A glow edge only; B glow edge and sparse particles (recommended); C B plus a ground aura |
| G4 | 6 | **Design choice** | D6 table; A can be built without waiting |
| G5 | 2 | After the sheet | Rings: keep all or only legendary and set |
| G6 | 2 | After the sheet | Jacket with sleeves and poncho as Blender pieces: yes or leave |

## Target

| File | Content |
|---|---|
| `src/render/weapons.ts` | Parts kit, per-base builders, merge per material, `weaponModel(kind, base, set?)`, glow rule. Grip tables stay keyed by kind |
| `src/data/weapon-look.ts` (+ test) | Per base: kind, family, signature colour. No Three.js. Test: every weapon base in `BASES` and every set weapon resolves to a builder |
| `src/data/hero-look.ts` (+ test) | `HeroLook` gains `tint` (palette id per piece and scarf), `gear` (sorted ids) and `hideHair`; `hat` goes. `heroLook` reads `{ base, set? }` per slot. Tables `PALETTES`, `GEAR` (slot, bone). Test: every base of every slot resolves; every palette names only chroma classes that exist |
| `src/render/gear.ts` | Part builders per gear id, rigid skin merge, glow split |
| `src/render/hero-model.ts` | Palette cache and swap, gear mesh rebuild in `setLook`, hair switch, `showAll` covers the gear material |
| `src/data/hero-contract.ts`, `src/render/hero-contract.test.ts` | `skinnedDrawCalls: 11`; test for the chroma classes per piece (table in Findings) and for the gear triangle budget over every look |
| `src/render/loot.ts` | Step 3 |
| `src/render/gear-fx.ts`, `src/sim/*` (event only) | Step 5 |
| `tools/item-sheet.mjs`, `.html`, `.ts` | Like `tools/enemy-sheet.mjs`: `mode=weapons` (grid, side view, icon beside each), `mode=looks` (hero front and back per look), `mode=pickups` |
| `docs/proof/wp4/` | Sheets and `passes.mjs` numbers per step |

## Steps

### Step 1 Weapons (P29) [Claude · Opus high]

| # | Do | Done when |
|---|---|---|
| 1a | Parts kit (handle, shaft, wrap, ribbon, blade, head block, fork), vertex-colour paint, merge to `metal`, `matte`, `glow`. The 4 current models rebuilt on it, pixel-close to today. `tools/item-sheet` `mode=weapons` | `node tools/passes.mjs "map=hof&autostart"` before and after: weapon draw calls per pass 9 to 10 → ≤ 3; `clip-swing.mjs` output for `Sword_Regular_A`, `Sword_Heavy_Combo`, `Punch_Cross` unchanged; hammer and spear left hand still on the shaft (`clip-sheet`, `ik=1`) |
| 1b | Normal bases and starter (14) | Sheet `docs/proof/wp4/weapons-normal.png`, each model beside its icon |
| 1c | GDR (4) and neon (4) | Sheet; neon tubes glow without an element |
| 1d | Legendary (7), `morgen`, set variants (2) | Sheet; envelope test passes for all 30 |
| 1e | Icons [Codex], see below | Icons replaced, `docs/equipment-pipeline.md` updated |

Shapes are start values. Look at `assets/inventory/<icon>.webp` and the 2D side view before modelling each base.

| Base | Name | Kind | Icon | Shape |
|---|---|---|---|---|
| `rohr` | Rostige Klinge | blade | I88 → repaint | Today's leaf-spring blade in rust, nicked edge, plain bar guard |
| `latte` | Holzlatte | blade | I01 | Board 5 cm wide with three nails through the top, wrapped grip |
| `stahl` | Stahlklinge | blade | I89 | Today's blade with the wrench guard |
| `machete` | Machete | blade | I04 | Blade widening to a rounded tip, dark handle |
| `brech` | Hackmesser | blade | I90 | Cleaver: short, broad, square tip, hole at the spine (2D `WM.brech` is a crowbar: ignore) |
| `vorschlag` | Vorschlaghammer | hammer | I06 | Today's sledge |
| `pflaster` | Pflasterhammer | hammer | I07 | Square face on one side, pick end on the other |
| `zange` | Rohrzange | hammer | I08 | Pipe wrench: red handle, fixed and sliding jaw |
| `zwille` | Jagdzwille | sling | I09 | Today's fork |
| `nagel` | Nagelwerfer | sling | I10 | Fork with a strip of nails on the handle |
| `stein` | Steinschleuder | sling | I11 | Rope sling: two cords, leather cradle with a stone |
| `rspeer` | Rohrspeer | spear | I12 | Today's spear on a steel pipe |
| `fahne` | Fahnenstange | spear | I13 | Wooden pole, torn red flag below a light tip |
| `harpune` | Harpune | spear | I14 | Dark shaft, tip with two barbs, line coil |
| `leucht` | Leuchtröhre | blade | I59 | Glass tube (glow, cyan `#43d1cf`), end caps, dark grip |
| `boxh` | Boxenhammer | hammer | I60 | Speaker cabinet as head, cone ring glows magenta `#ff4fa3` |
| `neonfl` | Neonflinte | sling | I61 | One-hand launcher: pistol grip, short barrel with a neon coil. Look at it on the sling attack strip; if the throw reads wrong, build a neon fork and add I61 to the Codex list |
| `mikro` | Mikroständer | spear | I62 | Thin dark tube, mic capsule as tip, magenta band |
| `sichel` | Sichel | blade | I71 | Short wooden handle, red ferrule, crescent blade |
| `werkh` | Werkhammer | hammer | I72 | Olive block head, brass gear-tooth ring, orange centre |
| `aufzieh` | Aufziehwerfer | sling | I73 | Brass fork with a wind-up key and spring coils |
| `zeiger` | Zeigerlanze | spear | I74 | Brass shaft, black clock-hand tip with a ring |
| `turm` | Fernsehturm-Splitter | blade | I15 | Glass shard blade, small tower-sphere pommel, signature blue |
| `zitklinge` | Klinge der Zitadelle | blade | I51 | Straight knight sword, cyan gem in the guard |
| `mauer` | Mauerbrecher | hammer | I16 | Slab of Wall concrete with graffiti patches and rebar ends, signature acid green |
| `pbrecher` | Plattenbrecher | hammer | I52 | Plattenbau slab with four window holes, signature ember orange |
| `ring` | Zorn der Ringbahn | sling | I32 → repaint | S-Bahn orange fork, a ring between the prongs |
| `kraehe` | Krähenschleuder | sling | I53 | Dark fork, crow skull, feathers |
| `siegsp` | Speer der Siegessäule | spear | I56 | Gold shaft and tip, laurel below the tip |
| `morgen` | Morgenstern der Zitadelle | hammer | I48 | Iron ball with spikes on a dark shaft |
| `brech` + kiez | Hackmesser der Kiezwache | blade | I91 new | Hackmesser, blue grip, orange band |
| `zwille` + spree | Zwille des Spreegeists | sling | I92 new | Jagdzwille, green wood, teal band |

**Step 1e icons [Codex]** (painted, `assets/inventory/`, 128 px like the others; reference: the model on the step 1 sheet):

| Icon | Item | Change |
|---|---|---|
| I88 | Rostige Klinge | Repaint: rusty blade, not a pipe |
| I32 | Zorn der Ringbahn | Repaint: orange slingshot with a ring, not a spike on a chain |
| I91, I92 | Hackmesser der Kiezwache, Zwille des Spreegeists | New: set-coloured versions of I90 and I09 |
| I93, I94 | Weste der Kiezwache, Mantel des Spreegeists | New: set-coloured versions of I19 and I18 |
| I95, I96 | Abzeichen der Kiezwache, Kiesel des Spreegeists | New: set versions of I44 and I39 |
| I97 | Arm des Basspredigers | New: own icon (shares I58 with Kabelarm today) |
| I61 | Neonflinte | Repaint as the neon fork of the model (step 1c fell back to the fork, 2026-11-19) |

Status 2026-11-19: superseded by D10 and step 2. I61, I88, I32, I91 to I94 are rendered from the models; the painted ones left (I95, I96, I97 and the Tunnelläufer key ring I102) are K4 in `docs/asset-pipeline.md`.

Code side of the icons [Opus, step 2]: `itemIcon` looks up `base:set` before `base`; slot a with base `kette` uses `khemd` (I57). Holzlatte needs no icon change: the model follows I01.

### Step 2 Hero equipment (P32) [Claude · Opus high]

| # | Do | Done when |
|---|---|---|
| 2a | Palette mechanism and gear mesh in `HeroModel`; `HeroLook` extension; contract tests | Unit tests; `passes.mjs`: gear adds 1 draw call per pass, palettes 0; no shader compile at the first equip (programs counted before and after a swap) |
| 2b | Hats (9) | Sheet `looks-head.png`, front, side, back |
| 2c | Armor (12 bases, Kettenhemd, 2 set variants): palettes and parts | Sheet `looks-armor.png`; strips of sprint, hammer combo and roll with `panzer` and `ritter` show no plate through the body |
| 2d | Gloves (6), boots (6) | Sheet |
| 2e | Dropped (2026-11-19): talisman, ring and implant keep their painted icons, no 3D | – |

Name the chroma classes after a look at a render (which of `a_mantel`'s three is coat, trousers, strap). Colours from 2D; start values.

| Base | Piece | Palette | Gear parts |
|---|---|---|---|
| none | `mantel` | default brown leather | – |
| `mantel` Arbeitsmantel | `mantel` | canvas grey-brown `#5a5040` | – |
| `leder` Lederjacke | `weste` | dark leather `#4a2a1a`, collar `#2a160d` | stand collar |
| `weste` Schutzweste | `weste` | default olive | – |
| `feuer` Feuerwehrjacke | `mantel` | dark red `#7a2416`, two reflective bands `#e8d36a` painted by height | – |
| `bvg` BVG-Uniform | `mantel` | navy `#26304a` | yellow shoulder boards `#f2c230`, chest badge |
| `blaumann` Blaumann | `weste` | blue `#2e4a7a`, trousers `#26406a` | – |
| `poncho` Regenponcho | `mantel` | teal `#2e4450` | cyan glow bands on the chest |
| `kmantel` Kabelmantel | `mantel` | dark violet `#3a2a3a` | cables over the shoulders, magenta glow tips, collar `#bd2b77` |
| `spaeti` Mantel des letzten Späti | `mantel` | violet `#3a1a40`, scarf gold `#f2d14b` | bottle caps on the chest |
| `panzer` Panzer vom Tempelhofer Feld | `mantel` | grey `#3d3a36` | chest and back plate, pauldrons `#7a766c` |
| `rattenmantel` Mantel der Rattenmutter | `mantel` | fur brown `#4a3e36`, scarf acid green `#97c459` | lumpy fur collar |
| `ritter` Rüstung des Zitadellenritters | `mantel` | steel blue-grey `#383e48` | chest plate, gorget, pauldrons `#8a8f96` |
| `kette` Kettenhemd der Zitadelle | `mantel` | iron `#6a6e76` over `#4a4e54` | crest on the chest |
| `weste` + kiez | `weste` | Kiezwache blue `#3a5a8a`, orange band | – |
| `mantel` + spree | `mantel` | Spreegeist green `#2f5a4a` | – |

| Slot | Base → look |
|---|---|
| Kopf | `helm` hard hat `#d9a520` · `schieber` flat cap `#5a4a3a` · `muetze` beanie `#8a2a24` · `maske` gas mask `#4a4e44` with straps · `nbrille` goggles, cyan glow lens · `stroh` straw hat `#d8b860` · `pickel` Pickelhaube `#a89a68` with brass spike · `kiezhelm` hard hat `#3a5a8a` with orange stripe · `topfhelm` great helm `#8a8f96` |
| Hände | Palette on `g_handsch`: `handsch` `#8a6a3a` · `bandage` cream `#e8ddd0` plus wrap rings on the forearm · `schweiss` `#5a3a24` plus long cuffs · `gartenh` `#6a8a3a` · `kiezbox` red `#c23a2e` plus padded cuff · `kiezhand` `#3a5a8a` |
| Füße | `turnsch` own piece · `stiefel` default · `gummi` green `#2f4a2a` plus tall shaft · `schaffner` black `#1f2430` plus tall shaft · `spreestief` `#2f5a4a` · `eisenstief` `#6a6e76` plus toe caps and shin plates |
| Talisman | `kiesel` pebble · `stueck` Wall chunk with a paint patch · `feder` black feather · `kette` loop of bike chain · `beutel` herb pouch · `abzeichen` round badge (kiez: blue) · `herz` teal heart, glow · `auge` cyan eye, glow · `wappen` shield crest; `kiesel` + spree: green pebble |
| Ring | `siegel` gold, red seal · `totenk` silver skull · `mutter` steel hex nut · `draht` copper wire, two turns · `ehe` plain gold · `kupfer` copper · `weltuhr` dial disc, glow · `spreering` green |
| Implantat | `nauge` lens over the left eye · `zchip` chip at the temple · `karm` forearm bracer with cables · `reflex` coupler on the upper arm · `bherz` pump on the chest · `npumpe` unit on the back with a tube · `bassarm` speaker-cone bracer, magenta glow |

### Step 2 looks: mockup and decisions (Johannes, 2026-11-19) [Claude · Opus high]
Brief (Johannes): redo every wearable item that shows in 3D; at least one look per district in map order (Köpenick, Xhain, Alexanderplatz, Mitte), sets more elaborate, brighter and matching, legendaries their own look; simple items may be a palette on the existing pieces, hats, belts and some boots get own geometry; icons rendered from the 3D models for everything visible; one mockup per item, he then picks what to redo.

Mockup: `docs/mockups/wp4-clothes/` (`koepenick`, `xhain`, `alex-mitte`, `sets`, `legendary` as SVG and WebP; rebuild with `node docs/mockups/wp4-clothes/build.mjs`). `items.mjs` holds every look's colours, parts and route: these are the start values for the build, and they replace the colour table above where they differ. 36 items plus 4 district and 3 set combinations.

Decided in this session (Opus 5.5; open points under Questions):

| Topic | Decision |
|---|---|
| Belt, trousers | Not slots (2D has none either). Each Körper item sets its trouser colour and brings its own belt part (tool belt, studs, fire hook belt, duty belt, sash, rat tails, LED belt). A new slot would touch save, loot, doll, stats and bot |
| Gloves | Stay in scope: palette plus small parts, cheap |
| Talisman, ring, implant | No 3D; the painted icons stay (Johannes: some items need no model). Answers G5; step 2e is dropped. Legendary talismans and rings can still get a proc flash in step 5 |
| District grouping | By theme, map order. Köpenick: Arbeitsmantel, Schutzweste, Bauhelm, Schiebermütze, Arbeits- and Schweißerhandschuhe, Arbeits- and Gummistiefel. Xhain: Lederjacke, Feuerwehrjacke, BVG-Uniform, Wollmütze, Gasmaske, Boxbandagen, Turnschuhe. Alexanderplatz: the GDR bases. Mitte: the neon bases. Drops are unchanged (see Questions) |
| D2 mechanism 4: cut | A jacket is `a_mantel` without the skirt, cut in code at load (one more index range, 0 draw calls). Checked in `hero.glb`: skirt 228 vertices, 324 triangles (coat colour, below 1.09 m, dominant joint `thigh_*`, `coat_b*` or `pelvis`); the torso shell ends at 1.04 m under the belt; the trousers are a full shell under the skirt (0.052 to 1.076 m). Skirt rows at 0.98, 0.88, 0.79, 0.69, 0.59, 0.50 m; a mid-length coat cuts on a row (Feuerwehrjacke 0.79, Kettenhemd 0.69). Blender fallbacks B2, B3 in `docs/blender-pipeline.md` |
| CC0 pieces | Quaternius "Modular Character Outfits - Fantasy" Standard (CC0, free, itch.io slug `modular-character-outfits-fantasy`, same 65-joint skeleton as UBC and the hero): only Peasant and Ranger. Used: Ranger boots for the Stiefel des Spreegeists, recoloured, simplified in Node from 9,172 to ≤ 2,000 triangles (`@gltf-transform/functions` simplify), replacing `f_stiefel`. Not used: hood, pauldrons, bracers, belts (code parts match the weapon style and cost less). UBC Standard itself has no clothing. poly.pizza and kenney.nl are blocked by Cloudflare from the cloud |
| Blender | Only the Regenponcho shell (B1). Everything else is code or Node |
| Codex | T9 in `docs/asset-pipeline.md`: tweed, denim, knit, straw, chainmail, patchwork, two decals; fur from T8 |
| Icons | Every Körper, Kopf, Hände and Füße item gets a rendered icon (`tools/item-icons.mjs`): the piece on a hidden body, hats and boots alone |

Johannes, 2026-11-19 (after the mockups): "Those look pretty great": build in 3D as drawn, with a little more volume round the shoulders (`puff`, default 12 mm), "just make them look good", rewarding to find. Then three decisions:

| Topic | Decision |
|---|---|
| Regenponcho | Blender shell (B1 in `docs/blender-pipeline.md`); until it is done the coat in teal with glow bands and a hood roll |
| Item pools | Split now, built: Köpenick drops only its own normal wear, Xhain its own at 40 % else Köpenick's, later districts both (`wearNames` in `src/sim/items.ts`, `XHAIN_WEAR_NAMES`; test in `src/sim/items.test.ts`). Weapons and the flavoured pools are unchanged; item values never depended on the base |
| Tunnels | "Tunnels can have their own sets": proposal below, mockup `docs/mockups/wp4-clothes/tunnel.webp` |

Tunnel set Tunnelläufer (proposal, start values; Opus 5.5, bonus numbers want a Fable or bot pass):

| Piece | Base (set key) | Look |
|---|---|---|
| Mantel des Tunnelläufers | `mantel:tunnel` | Ochre-olive coat `#7a6a34`, BVG-yellow hem `#e0a020`, harness with a copper pressure tank on the back, gauge, hose, U key tag |
| Stirnlampe des Tunnelläufers | `nbrille:tunnel` | Headband with a warm glowing brass lamp, goggles pushed up, hair stays |
| Stiefel des Tunnelläufers | `stiefel:tunnel` | Heavy boots, puttee wraps to the calf, steel toe caps |
| Rohrzange des Tunnelläufers | `zange:tunnel` | The Rohrzange in brass, gauge on the grip, a small lantern on a strap (weapon variant like `brech:kiez`) |
| Schlüsselbund des Tunnelläufers | `kette:tunnel` (talisman) | Old tunnel keys with a yellow U tag; painted icon (Codex), no 3D |

- Bonuses (start values, built): 2 pieces −20 % Abklingzeiten; 3 pieces +50 % Schaden and +2 Leben pro Sekunde; 5 pieces +8 Beuteglück and +120 Leben (the proposal said +3 and +20; scaled to the affix ranges: regen 0.3 to 1, luck 1 to 2 per item).
- Drops: only in the tunnels; there a set drop is the Tunnelläufer at 60 %, else one of the three others. Outside the tunnels it never drops. One set for all lines now; a set per line can follow when more lines exist.
- Build after Johannes' pick: `SETS.tunnel` and `SET_BONUSES.tunnel` in `src/data/items.ts`, the tunnel rule in `makeSetItem`, WEAR and gear (Stirnlampe, harness, puttees), the weapon variant and its icon, Codex: painted key ring icon; balance bot run.

Scarf (Johannes, 2026-11-19): the red scarf only with the coats (starter, Arbeitsmantel); the Späti and Rattenmutter coats keep their coloured scarves; every other armor has none (`scarf: 'none'`). Hats never hide it (the coats' neckline under the scarf is unfinished, the fur collar sits on its ring). Neck parts refitted to sit on the bare neck (collars low at the back: the neck tilts back 33 to 46° in every clip), new `collar-fire`, neck bands on the tabard, BVG and Panzer.

Budget: belts, hats and plates go into the gear mesh (2,500 triangles, D3). The heaviest look is the Rüstung des Zitadellenritters (chest plate, gorget, three-lame pauldrons, vambraces, tassets): count it first. Cut and Quaternius boots replace a piece, so 0 extra draw calls.

### Step 3 Pickups (P10) [Claude · Opus high]
1. Mockup of G2 (SVG, three variants, example drops of each rarity) to the chat; Johannes chooses.
2. Build D4 in `src/render/loot.ts`. Shapes for heal, food, materials and ingredients from the 2D sprites.
3. Done when: sheet `pickups.png`; a screenshot with 12 mixed drops on both profiles; `passes.mjs` with those drops: at most 1 draw call per kind on the ground plus 2; unit test that every drop kind and item slot maps to a model.

### Step 4 2D #2 and L2 close-out [Claude · Sonnet, with step 2]
1. Test in `src/data/hero-look.test.ts`: the legendary and set bases of slots h, g, f, r (`pickel`, `kiezhelm`, `topfhelm`, `kiezbox`, `kiezhand`, `schaffner`, `spreestief`, `eisenstief`, `weltuhr`, `spreering`) each give a look that differs from the slot's default.
2. `docs/tasks/l2-loot-followups.md`: check the test per row, set the status to done.
3. `docs/backlog.md`: delete the 2D #2 row.

### Step 5 Legendary and set looks (P31) [Claude · Opus high]
1. `GearFx` and the pulse; look sheet for G3 on two items; Johannes chooses.
2. Roll out. Start values (ideas from `docs/equipment-pipeline.md`):

| Item | Glow | Ambient particles | Proc flash |
|---|---|---|---|
| Fernsehturm-Splitter | blue edge | – | ember burst on a crit |
| Klinge der Zitadelle | cyan edge crackle | – | spark on a kill |
| Mauerbrecher | acid green cracks | slow drip | green splash every fourth swing (`shock` acid) |
| Plattenbrecher | ember orange windows | – | dust puff on a crit kill (`shock`) |
| Zorn der Ringbahn | orange ring | spark between the prongs | – (`bolt` exists) |
| Krähenschleuder | – | one feather now and then | green shot trail |
| Speer der Siegessäule | gold tip | – | gold glint per thrust |
| Mantel des letzten Späti | warm patches | – | – |
| Panzer vom Tempelhofer Feld | – | – | white flash on a block |
| Mantel der Rattenmutter | – | – | green sheen when hit |
| Rüstung des Zitadellenritters | – | – | dust ring after a dodge (`shock` small) |
| Pickelhaube des Hauptmanns | spike glint | – | – |
| Fäuste des Kiezboxers | – | – | stun flash on the fourth hit |
| Stiefel des Schaffners | – | blue trail while dodging | – |
| Ring der Weltzeituhr | dial | – | glint at the hand when the crit is armed |
| Herz der Spree | teal pulse | – | chest burst when it saves her (`secondWind`) |
| Auge des Fernsehturms | cyan | – | pulse on an elite hit |
| Arm des Basspredigers | magenta along the arm | – | pulse on the fifth hit (`bolt`) |
| Sets | signature colour | optional shimmer at 3 pieces (part of G3 variant C) | – |

3. Done when: sheet per item; unit test per new `legendaryProc` site; `passes.mjs`: 1 draw call for all effects; a hardware check row (fps with three emitters, Tab S9).

### Step 6 Daggers and dual wield (2D #38) [Claude · Opus high, combat-animation skill]
1. 6a (option A): off-hand group on `hand_l` in `WeaponRack` (mirrored mount, measured on a strip); left-hand cut: try mirrored clips at asset build, else `Punch_Jab`. Shown while Doppelklinge is held. Done when: strips of the chain with both blades, `clip-swing` numbers of the right hand unchanged, new `anims.glb` size stated.
2. 6b (option B), only after G4: base `dolch`, name and icon, chain `dual1` to `dual4` measured per the skill, sim rule by base flag, tests for damage, reach and timing, bot run for parity with the Klinge (± 10 %). Adding a name to `WEAPON_NAMES.blade` changes seeded blade names; fix the golden values in `src/sim/items.test.ts`.

## Done when (whole package)
- `npm run check` and `npm run e2e` pass per PR; each PR carries its sheets in `docs/proof/wp4/` and one game screenshot at 1280 × 720.
- `docs/equipment-pipeline.md` updated in every PR (index columns 3D, Hero, Icon matches, Needs).
- Hardware check rows in `docs/tasks/pt-hardware-checks.md`: first equip with gear (hitch), fps with full gear and effects on the Tab S9; a Playtest row for the looks.
- Backlog rows P29, P32, P10, P31, 2D #2 and #38 deleted as their steps merge.

## Not in scope
New skinned clothing meshes or any `hero.glb` rebuild (G6), icons rendered from 3D (Q5), painted textures per item base, enemy and boss models (H2, P30), a fifth weapon kind, an off-hand slot, more implant legendaries, changes to hit arcs or clip timing of the four kinds, the Neonflinte as a rifle class.

## Questions
- Gates G2 to G6 are listed above.
- Step 2 looks (Johannes): which mockups to redo. Recommendation for the rest: build as drawn.
- Tunnelläufer: approved ("Tunnelläufer ist fein", 2026-11-19) and built; bonus numbers scaled to the item affix sizes (5 pieces: +8 Beuteglück, not +20; 3 pieces: +2 Leben pro Sekunde, not +3), to be checked by the balance bot (P33).
- D9 hit numbers: the 3D game shows no damage numbers, so an effective hit is shown by cool white hit sparks (`fx.sparks`) instead of a tinted number. Damage numbers would be a separate decision.
- D9 classes that may not fit their bodies (assignment kept): Rattenmutter (zombie body, Tiere only), Bassprediger (zombie body, Maschinen only, unlike Kabelghul and Boxenkopf), Wurzler and Wurzel-Mutter (zombie bodies under roots, Pflanzen only), the uniformed bosses (zombie bodies, Menschen: the blade gets no bonus on them).
- D8: a two-handed hammer a third shorter comes out at reach 0.9, not 0.85 (length 0.86 to 0.9 against 1.16, light1 reach 2.47).
- 1h Neonflinte: `Pistol_Shoot` and `Pistol_Idle_Loop` hold the arms fully stretched, so the left hand cannot reach the handguard proper; it holds the rear of the handguard (model z −0.09, stretched standing grip, IK weight 1 through the shot). Werfer powers other than Nagelsturm (Brandsatz, Sperrfeuer, Molotow) still play the overhand throw with the rifle in hand; its shots are still drawn as stones (at muzzle height).
- 1h Werkhammer grip 0.036 (Johannes: thicker) is wider than the D1 free radius 0.033; the envelope test allows it for this base only.

## Johannes, 2026-11-19 (step 1 look 1) and what follows from it
Verdict on the sheets: good overall. Notes are Fable's; they change D1 and add D8 to D10.

### Step 1f Model fixes [Claude · Opus high]

| Model | Change |
|---|---|
| Every weapon with a ribbon (I89, I06, I12 and the rest) | Ribbon thinner (about 2.5 cm) and wavy: a strip of 4 to 5 segments that hangs, not one stiff plane |
| Holzlatte (I01) | More worn, dirtier, darker |
| Hackmesser (I90, also the Kiezwache variant) | Blade half as long: a short, heavy cleaver |
| Vorschlaghammer (I06) | Whole weapon a third shorter, head a third bigger. Same proportions for the other two-handed hammers (Werkhammer, Boxenhammer, Mauerbrecher, Plattenbrecher, Morgenstern) unless the sheet speaks against it |
| Pflasterhammer (I07) | Half as long, one-handed, bigger head: hammer face on one side, a real pick on the other |
| Rohrzange (I08) | Half as long, one-handed, jaw part thicker, handle widening toward the jaw as in the painted icon |
| Jagdzwille (I09), Nagelwerfer (I10), all forks | Two thirds of the size; bands start exactly at the fork tips |
| Steinschleuder (I11) | Shorter |
| All slings | Bands and cords curved so they hang (a static sag built from segments, no physics) |
| Rohrspeer (I12) | Shaft thicker: it is a pipe |
| Fahnenstange (I13) | Flag lower on the pole and longer; tip longer |
| Harpune (I14) | Point shorter, barbed blade wider (a real harpoon head); the line is a rope and longer |

Look 1, sheets 2 and 3 (Johannes, 2026-11-19, second message):

| Model | Change |
|---|---|
| All neon and GDR weapons (I59 to I62, I71 to I74) | More detail: they are the rarer weapons. Triangle budget as legendary (1,400) |
| Leuchtröhre (I59), Boxenhammer (I60), Werkhammer (I72) | About a third shorter; I60 and I72 with a bigger head |
| Neon fork (I61), Aufziehwerfer (I73) | Smaller, bands that hang, and a glow |
| Sichel (I71) | Smaller overall, shorter handle, thicker blade |
| Aufziehwerfer (I73), Zeigerlanze (I74) | Add the clockwork: cogs as in the painted icons |
| Zeigerlanze (I74) | Thicker shaft so the yellow stands out; blade silver and wider |
| Mauerbrecher (I16), Plattenbrecher (I52), Morgenstern (I48), Hackmesser der Kiezwache (I90) | Shorter (hammers: the two-handed rule above; Hackmesser as the normal one) |
| Mauerbrecher (I16), Plattenbrecher (I52; Johannes said "I57", read as I52) | Bigger head, more rugged, ribbon fixed |
| Morgenstern (I48) | Bigger ball, ribbon fixed |
| Fernsehturm-Splitter (I15), Klinge der Zitadelle (I51) | About a quarter shorter |
| Fernsehturm-Splitter (I15; Johannes said "I16", read as the shard) | Faint white glow on the shard |
| Zorn der Ringbahn (I32), Krähenschleuder (I53), Zwille des Spreegeists (I09 set) | Smaller, bands and ribbons that hang, a little more detail |
| Speer der Siegessäule (I56) | More detail, a little shorter |

Johannes, 2026-11-19 (third message): reach fits the weapon's length roughly, for every weapon; the readings I15 (white glow) and I16, I52 (bigger head) are right. Rule: D8.

Done when: new sheets; hammer and spear left hand still on the shaft where the model is two-handed; `npm run check`.

### Step 1h Look 2 fixes (Johannes, 2026-11-19) [Claude · Opus high]
Verdict: rendered icons are fine as they are; the review is done by Claude, then the PR goes to ready. Remaining model points:

| Model | Change |
|---|---|
| Holzlatte (I01) | Must read as wood: wood colour and grain, board shorter, nails longer |
| Hackmesser (I90) | Too dark: silvery steel, and a faint cold-white gleam on the edge (Fable's reading of "give it a glow": low emissive on the edge only; ask again if he meant more) |
| Hackmesser der Kiezwache (I91) | Blade shinier, a ribbon on the handle |
| Rohrzange (I08) | Handle a little wider at its end |
| Every fork: Jagdzwille (I09), Nagelwerfer (I10), Aufziehwerfer (I73), Zorn der Ringbahn (I32), Krähenschleuder (I53), Zwille des Spreegeists (I92) | Handle a third shorter |
| Zwille des Spreegeists (I92) | Green glow (set signature); sparkle comes with step 5 |
| Boxenhammer (I60) | More detail on the sides of the cabinet |
| Neonflinte (I61) | **Not a fork: a gun**, an assault rifle in the AK shape (stock, receiver, curved magazine, barrel) with a neon coil. Needs gun clips, see below |
| Mikroständer (I62) | Shorter; the mic head wider |
| Sichel (I71) | Blade shinier, more silvery |
| Werkhammer (I72) | Shinier; more detail on the striking faces; thicker grip |
| Mauerbrecher (I16), Plattenbrecher (I52) | Finer detail in the coloured parts: chipped paint, smaller fragments, cracks |

Neonflinte as a gun (Fable): the throw clips point a gun at the ground (step 1c finding), so this base gets its own clips. `Pistol_Shoot` (UAL1, not imported yet) for its shots, `Pistol_Idle_Loop` (imported) for standing, left hand by IK on the handguard. The attack definition may differ per base in clip name and clip times only; sim timing, damage and shot rules of the Werfer stay. Measure with the combat-animation skill; state the new `anims.glb` size. If no pack clip holds the rifle along the shot line, stop and write it under Questions.

### D8 Size and strength per base (changes D1)
The kind still sets clips and arcs, but a base may scale them. New table (plain data, read by `src/sim/stats.ts`, unit tested):

| Base | Hands | Reach | Damage | Damage types |
|---|---|---|---|---|
| `brech` Hackmesser | 1 | × 0.75 | × 1.25 | Schnitt |
| `pflaster` Pflasterhammer | 1 | × 0.75 | × 1.1 | Wucht and Stich |
| `zange` Rohrzange | 1 | × 0.75 | × 1.15 | Wucht |
| every other base | as its kind | × 1 | × 1 | as its kind |

- Reach folds into `stats.reachFactor` (the smear follows it already), damage into `stats.damage` (so the Kampfkraft comparison sees it).
- One-handed hammers: no left-hand grip, standing clip as the blade (`hands` decides, not the kind).
- **Reach follows length for every melee base** (Johannes, third message): each base has a `length` (tip height of its model, plain data, checked against the model by the envelope test). Reach factor = 1 − (reference length of the kind − length) ÷ reach of the kind's first attack, rounded to 0.05, never under 0.6. Reference lengths are the pre-WP4 kind models (blade 1.11, hammer 1.16, spear 1.81), so `combat.ts` reach values stay. This replaces the fixed reach column above (it gives about the same for the three short bases) and covers the shorter hammers, Leuchtröhre, Sichel, Fernsehturm-Splitter, Klinge der Zitadelle and the Speer der Siegessäule. Slings: no reach change (their factor is shot speed).
- **Lost reach is paid back in damage** (Johannes, fourth message): damage factor = 1 + (1 − reach factor) for every melee base, so reach 0.75 gives damage 1.25 and reach 0.85 gives 1.15. This replaces the fixed damage column above; `hands` and the damage types of the table stay.
- Hammer knockback × 1.5 on every hammer attack (Johannes: strong, slow, pushes enemies back; the stun on every hit stays).
- All numbers are start values for Johannes' playtest.

### D9 Weapon type against enemy type (new rule)
Johannes: a reward for switching to the weapon that fits the enemy, about 30 to 50 %.

| Damage type | Weapons | Strong against (`+40 %`) |
|---|---|---|
| Schnitt | Klinge | Untote, Pflanzen |
| Wucht | Hammer | Maschinen |
| Stich | Speer (and Pflasterhammer) | Menschen |
| Geschoss | Werfer | Tiere (Fable's addition so the fourth kind has a niche; drop it if Johannes says so) |

| Enemy class | Kinds (start assignment; a kind may have two classes) |
|---|---|
| Untote | walker, runner, brute, spitter, spreehexe, zuender, schild, heuler (the last three came in with WP5); kabel and bass also count as Maschine |
| Maschinen | drone, uhrwerk, uhrwerkgross, wachdrohne, weltzeituhr, volkskoloss, bassprediger; kabel, bass |
| Pflanzen | wurzler, kernspeier, wurzelmutter |
| Menschen | feldwebel, waechter, hauptmann, schaffner, grenzer, brandmeister, tuersteher, dirigent |
| Tiere | raptor, rex, crow, rat, rattenmutter |

- Bonus only, no malus: the wrong weapon plays as today (backlog B10: never frustrating). One number, `WEAPON.typeBonus = 0.4`.
- Applied in `strike` to every hit dealt while that weapon is equipped (attacks, powers, procs); not to burn ticks.
- Shown: the hit number of a boosted hit gets its own tint (`hit` event flag `effective`); the weapon card says `Stark gegen: Maschinen`; the Kodex entry of an enemy names its class.
- Open, Johannes after playing: only bosses and guards are Menschen, so the spear's bonus shows mostly on bosses; whole districts lean to one class (Alexanderplatz Maschinen, Tiergarten Pflanzen), so the bonus can read as "weapon per district".
- Not in this step: the balance bot choosing the weapon by enemy class (add to backlog P33), recalibrating clear times.

### D10 Icons are rendered from the 3D models (answers Q5; replaces step 1e)
Johannes, 2026-11-19: no painted item icons any more.
- `tools/item-icons.mjs` (reuses `tools/item-sheet`): each model at a fixed three-quarter view, lying diagonally, fitted to the frame, studio light, transparent background, 256 px WebP into `assets/inventory/<id>.webp`.
- Step 1: all 30 weapon icons replaced, plus I91 and I92 for the two set weapons; `itemIcon` looks up `base:set` before `base`.
- Other slots keep their painted icon until their model exists; each later step renders its icons in the same PR (hats, gear, pickups). Nothing goes to Codex.
- Rerun the tool after every model change. Done when: an inventory screenshot with rendered icons at 1280 × 720 and 844 × 390; icons readable at the cell size.

### Step 1g Rules and icons [Claude · Opus high]
1. D8 table and wiring, tests (reach, damage, hands per base; `power` sees the damage factor).
2. D9: `EnemyDef.classes`, type table, `strike`, the `effective` flag, the three texts, tests (each type against each class; burn ticks excluded; two-class enemies get the bonus once).
3. D10 icon tool and the replaced icons.
4. `docs/status.md`, `docs/equipment-pipeline.md`, Playtest rows (weapon types, short weapons, hammer knockback).

## Handover step 1 (Opus 5.5, 2026-11-19)
- Built: parts kit in `src/render/weapons.ts` (vertex-colour paint, merged into `metal`, `matte`, `glow`), 30 base models plus `brech:kiez` and `zwille:spree`, `weaponModel(kind, base, set?)`, glow rule `weaponGlow`; looks in `src/data/weapon-look.ts`; `paintGrain` atlas; `tools/item-sheet` `mode=weapons`. `pipe` is gone; grip tables stay keyed by kind.
- Numbers: weapon draw calls per pass 10 → 2 (3 with a glow); `passes.mjs` total 264 → 232 (`docs/proof/wp4/README.md`); 174 to 830 triangles per model. `clip-swing` output and `ik=1` weights unchanged.
- Tests: `src/data/weapon-look.test.ts` (every weapon name in `BASES` and every set weapon resolves), `src/render/weapons.test.ts` (D1 envelope with exact slab radius, budget, glow rule). Soft parts (ribbons, bands, cords, flags, feathers) are outside the envelope check; the sling's rubber bands reach 0.47 as before WP4.
- Envelope fixes to the pre-WP4 models: Stahlklinge wrench ring 2 cm up, Jagdzwille arms 1 cm up (both reached into the grip zone); Klinge der Zitadelle guard at 0.168.
- Neonflinte: the one-hand launcher (barrel along −Z, where `Pistol_Idle_Loop` points it) is swung overhead and points at the ground on the `OverhandThrow` release, so it is a neon fork; I61 goes to Codex (1e table).
- Models follow the icons where the spec text differs: Werkhammer and Aufziehwerfer blue enamel with brass gear, Zeigerlanze blue shaft; Hackmesser and Sichel are blade-envelope long (0.9 m); Nagelwerfer's nails sit on the arm (grip zone free).
- Reused from 2D: `WM` colours (`js/art.js`) as paint start values and the painted side views for proportions.
- Not verified: look on real hardware and at the phone camera; glow strength with bloom on both profiles (Playtest row in `pt-hardware-checks.md`).

## Handover step 1f and 1g (Opus 5.5, 2026-11-19)
- 1f: every model rebuilt after look 1 (ribbons, hanging fork bands from the tips, forks two thirds, two-handed hammers a third shorter with a third bigger head via a head frame, one-handed Pflasterhammer and Rohrzange, short Hackmesser, shard white glow through a vertex-coloured glow material, cogs on Aufziehwerfer and Zeigerlanze); neon and GDR up to 1,400 triangles. Draw calls unchanged (232).
- D8: `length` per base in `weapon-look.ts`; `weaponTraits` gives hands, reach (rule, steps 0.05, floor 0.6) and damage = 2 − reach; `heroStats` folds them in, the card shows the scaled damage and DPS. Hammer knockback × 1.5 in `combat.ts`; reach values untouched.
- D9: `ENEMY_CLASSES` and `EnemyDef.classes`, `STRONG_AGAINST`, `WEAPON.typeBonus` 0.4 in `strike` (procs start from the unboosted damage, burn ticks never get it), hit flag `effective`, card line `Stark gegen`, class in the Kodex.
- D10: `tools/item-icons.mjs` renders all 32 weapon icons (I91, I92 new); `itemIcon` looks up `base:set`. Spears and blades are drawn thicker across in the icon only.
- Tests: envelope against length, D8 rule and sums, D9 per type and class, burn excluded, two classes once. Golden values of hammer tests rose by 1.1 (shorter default hammer); rule test dummies are classless.
- Deviations: effective hits tint the sparks (no hit numbers exist); Siegessäule shortened from the tip (1.72) so the thrust grip stays on the shaft.
- Reused from 2D: icon proportions as before; class names German as in the spec.
- Not verified: feel of the bonus, the reach changes and the knockback in play; icon readability on a real phone (Playtest rows).

## Handover step 1h (Opus 5.5, 2026-11-19)
- Neonflinte as an AK-shaped rifle (920 triangles, 3 draw calls), two-handed, `BASE_CLIPS` swaps only clip and clip times (`Pistol_Shoot`: shot at 0.01, kick to 0.06, measured); mount tilt −11° lays the barrel level; Nagelsturm fires from the pistol clip; shots drawn at muzzle height; `anims.glb` +13.7 KB.
- Models: Hackmesser silvery with an edge gleam (fixed accent `gleam`, not a signature), Kiezwache shinier with a ribbon, Sichel and Werkhammer clean metal (metal atlas with a brushed half), Holzlatte wood, Rohrzange end, fork handles a third shorter (sling grip zone now −0.02 to 0.14), Spreegeist green glow, Boxenhammer sides, Mikroständer shorter (reach 0.95), Mauer- and Plattenbrecher chipped paint, fragments, cracks.
- Review fix: `thrustTipY` uses the shown spear's `length` (no unit test covers it: the rack needs a canvas).
- Proof: `neonfl-shot.png`, `neonfl-game.png`; icons, the three sheets and both inventory screenshots rerun after the last model change.

## Handover step 2 and 4 (Opus 5.5, 2026-11-19)
- Built: `WEAR` and `PALETTES` (`src/data/hero-look.ts`), piece variants with roles, palettes, bands, spots, coat cut and shoulder `puff` (`src/render/hero-wear.ts`), fitted rigid gear merged into ≤ 3 skinned meshes (`gear-kit.ts`, `gear.ts`, builders `gear-head.ts`, `gear-body.ts`, `gear-body-rare.ts`, `gear-limbs.ts`, four parallel Opus builders), `HeroModel` swaps variants and gear in `setLook`; NPCs get no gear.
- Numbers: gear ≤ 3,200 triangles per full look (D3 2,500 raised), glow ≤ 400; hero ≤ 12 skinned draw calls (vest + 3 gear); heaviest hero about 22,300 triangles; gear build 3 to 11 ms per item on first equip, then cached. Puff per armor 12 to 26 mm.
- Tests: `hero-look.test.ts` (every wear base, palettes, cuts, set keys, step 4 legendaries and sets differ), `hero-wear.test.ts` (roles in hero.glb, cut, tint, puff, caching), `gear.test.ts` (builders, bones, budget of every combination, hero total), `items.test.ts` (district wear pools).
- Icons: 36 rendered (`PAGES=wear node tools/item-icons.mjs`, `tools/look-sheet.html?mode=icons`); new I93 Weste der Kiezwache, I94 Mantel des Spreegeists, I57 Kettenhemd (`kette:zit`). Sheets: `node tools/look-sheet.mjs out.png "group=sets"`; proof in `docs/proof/wp4/step2/`.
- Deviations: Spreegeist boots in code (no Quaternius); brims higher and level (the idle head tilts down); glow colours deeper than the mockup (the glow material emits 2.2×); torso plates split over spine_01..03 (sprint); tassets and jeans rips on the thighs; Kettenhemd grey darker until the T9 mail texture; Arbeitshandschuhe tan (`arbeit` palette).
- Reused from 2D: `HEADL`, `GLOVE`, `BOOT`, `LOOK` colours as palette start values; the Pickelhaube eagle outline from the Hauptmann boss.
- Not verified: hardware cost and hitch (row 39 in `pt-hardware-checks.md`), look at the phone camera; known clipping: straw brim vs a raised arm, gas-mask canister and helm edge into the scarf with the chin down, collars stand off a raised shoulder.
- Addendum (same day): scarf rule (red only with the coats, `scarf: 'none'` elsewhere, hats never hide it), neck parts refitted (`neckOf`, `collarShell`, `yoke`, `neckBand`, `coatCollar` in `gear-body.ts`; new `collar-fire`); Tunnelläufer built: `SETS.tunnel`, `SET_BONUSES.tunnel` (start values), `LootContext.tunnel` from `MapDef.tunnel`, `makeSetItem` 60 % in tunnels, never outside; gear in `gear-tunnel.ts` (1,942 triangles for the set), weapon `zange:tunnel`; icons I98 to I101 rendered, I102 (key ring) is Codex K4. Look sheet group `tunnel`.

