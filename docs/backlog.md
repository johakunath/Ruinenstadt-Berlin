# Backlog (3D)

Open items only; delete a row when it is done (the PR and `docs/status.md` keep the record). Done: P7 reward moment, 2D #29 set warning, 2D #31/43/44 dodge dust, flinch and death, 2D #14/27 Funde (2026-11-19); P12 remaining 2D enemies (Zünder, Schildträger, Heuler; Ratte in M12b) and 2D #18 enemy voices (S3 boss lines), WP5 2026-11-19; B3 heights (hills, terraces with stairs, M11b), B6 finishers (M7), M6 wave checkpoints; P1 controls table and pad layout; P4 equip by second tap; P5 trader comparison, P9 pad and pinch zoom, P21 and P23 reachable lot spots, P22 guard get-up (2026-11-18); prototype controller feel/rumble, PC performance and hero outline (Johannes, 2026-11-16). Scheduled work lives in `docs/migration.md` (steps M1 to M19, H1, H2); items here are pulled in when a step needs them. Owner tags as in `docs/workflow.md`. No "check on hardware" rows here (Johannes, 2026-11-19): he reports what he sees while playing; hardware checks go to `docs/tasks/pt-hardware-checks.md` only when a task needs a measurement.

Still to merge from the 2D `BACKLOG.md`, each when its migration step starts, not before:

| 2D # | Item | With step |
|---|---|---|
| 2 | Legendaries and set pieces for head, hands, feet, ring | L2 |
| 13 | Multi-level interiors | M15 |
| 16, 37, 30 | Camp as a place, stations with levels and NPCs, stash purpose | After M13 |
| 17, 34 | Umschmieden with control, smith and enchanter | M13 |
| 19 | Authored arena spots with a special reward (dark zone replacement) | M16b |
| 22 | Loot pacing check | M14 |
| 24 | Save slots | After M17 |
| 25, 33 | Meals and ingredients, garden | M13 |
| 26, 36 | Attachment follow-ups, weapons by crafting quests | M13 |
| 28 | Line of sight | Not planned |
| 38 | Daggers and dual wield | After G1 |
| 41 | Quests | After M13 |

| # | Item | Source | Earliest |
|---|---|---|---|
| B2 | Landmark view: near a landmark a button appears, the camera pulls out and shows the whole building; press again to return | Gate 1 playtest | After M11 |
| B5 | Easier start for newcomers (gate 1 is hard: about 40 to 45 kills with effort). Tune in the real game, not now | Gate 1 playtest | M14 (balance bot) |
| B7 | Head lamp or torch for very dark areas, migrated from the 2D game | Gate 1 playtest, 2D game | With the first dark area |
| B9 | Balance bot calibrated to Johannes: after the port (M14) the bot plays with his reaction time, dodge rate and damage taken, measured from playtest telemetry, so tuning targets his skill, not a perfect player | Johannes, 2026-11-15 | M14 |
| B10 | Power curve: never frustrating. Each zone the hero clearly gets stronger through drops, gear and skills, and by the district boss feels much more powerful than at the start. Target: early waves need care, late waves of the same district feel easier relative to the hero's power, bosses stay a real fight. The bot (B9) checks the curve after every balance change | Johannes, 2026-11-15 | M3, M4, M8, M14 |
| B13 | Späti trader. In 2D the trader appeared as a random event (and in the tunnels). In 3D every Späti has one. Port the 2D trader first, then extend: a trade screen with the inventory on one side and the trader on the other; weapons, equipment, especially strong Aufsätze; blessings (Hades style): swap a blessing, buy a new one or upgrade one, paid in Schrott. The balance bot must learn to trade | Johannes, 2026-11-16 | M13b |
| B14 | Switch `MapDef.strictLots` on for Köpenick and Xhain: lots then keep out of turned landmark footprints and off the full width of side paths (today they can overlap a turned landmark or straddle a path). Regenerates all their lots, so it waits for their playtests | M15 Mitte data step (2026-11-18) | After the Köpenick and Xhain playtests |
| P3 | Cars as recognizable models (Trabi, Wartburg, BVG bus) instead of boxes | Playtest 2026-11-17 | PC or Codex models |
| P10 | Pickups: own model per item type (weapon kinds, armor slots, materials, food) instead of one bag | Playtest 2026-11-17 | L2 |
| P13 | Bot for the new systems: endless waves (M18 numbers are first guesses), camp upgrades and meals in the campaign bot (M14) | Session 2026-11-17 | M14 |
| P14 | Tunnel follow-ups: the 2D generator charge (hold the platform while waves come out of the tunnel mouth) before Der Schaffner; flooded stretch and bypass of 2D route A; one tunnel per later line | Session 2026-11-17, 2D `js/ubahn.js` | After the M19 playtest |
| P15 | Camp follow-ups: quests and Erfolge (2D Kommandantur), Umschmieden (2D from Mitte) | Session 2026-11-17, M13 | After M13 playtest |
| P26 | Options from 2D: Akkusparen and Vollbild were in (U3); Auto-Angriff (default off, 2D was on for touch) and Spielstand kopieren/laden added 2026-11-18. Not ported: 2D "Alle Daten exportieren" and the backup list | Session audit 2026-11-17 (left out of U2) | With M17 (menus) |
| P27 | Decision: after a death the retry starts at the zone without blessings (2D rule, set by the PR #18 review fix); a loaded checkpoint keeps them. Keep, or keep blessings on a retry too | Session audit 2026-11-17 | Johannes decides at the next playtest |
| P17 | Spreepark dinos: detailed statues (several species, moss, cracks), more detailed enemy dinos, small pack dinos (Kompso), nests with eggs. Refined task: `docs/tasks/m11c-dinos.md` | Playtest 2026-11-17 (split off the M11c session to save tokens) | Next session |
| P18 | Ambient animals: ducks on ponds, pigeons on plazas (fly off), rats near bins and in the tunnel. Research done (Gobkit CC0 GLBs). Refined task: `docs/tasks/m11c-animals.md` | Playtest 2026-11-17 (split off the M11c session) | Next session |
| P19 | Painted textures for the lot types and plants (Codex). Task: `docs/tasks/m11c-textures.md`; reconcile its material keys with the merged M11c art first | Session 2026-11-17 | After M11c art merge |
| P29 | Weapon looks: every weapon kind has one 3D model (`src/render/weapons.ts` `weaponModel` ignores the base), while the inventory icons show 30 different weapons (Machete, Sichel, Rohrzange, Boxenhammer, Harpune, Neonflinte, Morgenstern …). Build a model per base, or at least per family (normal, neon, GDR, legendary). Icon fixes: Rostige Klinge (I88) still shows a pipe, Zorn der Ringbahn (I32, a sling) shows a spike on a chain, the starter Holzlatte shows a nailed plank but holds a blade | Session 2026-11-18 (contact sheet) | After the playtest; models Claude, icons Codex |
| P30 | Kodex portraits vs bodies: bosses from 2D (Feldwebel, Hauptmann, Schaffner, Brandmeister, Rattenmutter, Turmwächter) are the zombie body with a coloured coat, while their busts show helmets, a rat head, a tower head. Quick wins (Brocken vest, Kabelghul cyan, Speier belly) done in WP5; own boss models are WP5 step 3 (`docs/tasks/wp5-enemies.md`) | Session 2026-11-18 (contact sheet) | WP5 step 3, after the mockup pick |
| P31 | Legendary and set visuals: each legendary weapon and set piece gets its own look in 3D (glow edge, particles, a changed mesh part); ideas per item in `docs/equipment-pipeline.md` › Priorities | Johannes, 2026-11-18 | After the starter and Köpenick items (equipment pipeline P1, P2) |
| P32 | Equipment on the hero: the head slot never shows (no hat or helmet piece), 9 of 12 armors show the default coat, talisman, ring and implant have nothing in 3D. Build pieces per base in code first; Blender only to skin them (`docs/equipment-pipeline.md`) | Session 2026-11-18 | With P29 |
| P33 | Balance bot plays every system: today it picks blessings, equips by power, salvages, uses powers, Verband and Molotow. Missing: Späti and trader purchases, camp upgrades and meals, smith and Aufsätze, Umbau cards (G1), shrines, hidden blessings and events, the tunnels between districts. Then calibrate the curve over the district chain (`node tools/balance.mjs 3 normal johannes 1 --chain`) to Johannes' telemetry (B9, B10) | Session 2026-11-18 | Next balance session (Fable high) |
| P34 | Touch controls are harder than the pad (Johannes, 2026-11-18): compare deaths and fight times per input in telemetry (`inp`, `death`), then options such as a larger dodge button, aim assist strength on touch, a stick that follows the thumb, Auto-Angriff on by default for touch | Johannes, 2026-11-18 | After a few runs with the new telemetry |
| P24 | Landmarks look too clean and intact for a ruined city: every sight (Rathaus, Tor, Reichstag, Sony Center, Fernsehturm, …) gets wear: soot streaks, cracks, broken and boarded windows, missing pieces, rubble and trash at the foot, rust and moss, graffiti up to 3 m, scaffolding or tarps on some. Shape stays recognizable. All four districts; code first (geometry breaks, vertex-colour grime), dirt and grime textures via Codex | Johannes, 2026-11-18 | Before the next district playtest; new landmarks are built worn from now on |

## Ideas (not decided)

Pure ideas for later (Johannes, 2026-11-16). Nothing here is planned or decided; nobody builds from this list. An idea moves up into the table or into `docs/migration.md` only when Johannes decides it. Add new ideas as a row; do not delete a rejected one, mark it "rejected" with the date.

| # | Idea | Why it might be good | Source | State |
|---|---|---|---|---|
| I1 | Blessings bound to verbs: each family gets blessings that change one action (Schlag, Finisher, Rolle, Kraft, Ultimativ), about 20 new, the card shows the verb. Example: Glut on the finisher makes it explode | Runs with the same weapon play differently, as boons do in Hades | G1 option A (`docs/tasks/g1-build-variety.md`) | idea |
| I2 | Weapon variants: three per weapon, chosen at run start, each changes the chain or the powers. 2D already has three names per power (Kreissäge, Neonwirbel, Ernteschlacht) | A reason to pick a weapon on purpose | G1 option B | idea |
| Q1 | Three quality levels: Qualität (PC), Ausgewogen (today's Leistung: tablet, notebook), a new lowest Leistung (cheap or no shadows, lower resolution, less decoration). Contents after Johannes' hardware checks: `docs/tasks/q1-quality-levels.md` | Johannes, 2026-11-18 | After the checks in `docs/tasks/pt-hardware-checks.md` |
| I3 | Der Kabelbaum: a cable-wrapped tree as a Tiergarten boss, root lines along the ground that hold the hero (Wurzler rule) | Lost to Der Dirigent for the Neuer See (M12c) | idea |
| I4 | Mitte lot type Kontrollpunkt: container lock with a barrier, sandbags and a guard booth (cache), Friedrichstadt | Variant B of `docs/mockups/m15-mitte-lots.svg`, not picked (2026-11-18) | idea |
| I5 | Mitte lot type Ladenpassage: covered arcade under a broken glass roof, looted shops, dead escalator, sleeping elite (Friedrichstadt-Passagen) | Variant B, not picked | idea |
| I6 | Mitte lot type Aktenhof: yard behind a ministry with heaps of files, toppled cabinets and desks, wet paper, cache | Variant B, not picked | idea |
| I7 | Tiergarten lot type Windbruch: fallen trunks as a barricade, deer stand with crows, fireflies, cache | Variant B, not picked | idea |
| I8 | Regierungsviertel facade F-B: concrete ribs and shattered glass (Bundesbau look) as a second frontage next to the sandstone ministry | Variant F-B, not picked | idea |
| I9 | Bedrohung (threat levels, 2D `S.threat`/`S.tmax`): winning a district unlocks the next level; each level gives enemies more life (2D: +25 % per level) and loot more item levels (2D: +3 per level), in 3D also a higher legendary chance. Chosen before a run, separate from Leicht/Normal/Schwer. Today enemy strength is fixed per wave of a map (times difficulty) and loot item level follows the waves of the run plus 3 per district, so a replayed map gets easier as the hero grows; this gives replays a reason, together with the Funde left behind. Johannes: rewards and difficulty have to keep rising, otherwise there is not enough motivation to replay | Johannes, 2026-11-19 (2D panels.js) | idea |
| I10 | Power previews: in the Kraft cards (inventory) a short looping clip of each power and the ultimate instead of the glyph, recorded from the game (e.g. with `tools/clip-sheet` as WebM or a sprite strip) | Johannes, 2026-11-19 | idea, once the weapons and powers are final |
| PT | Running list of hardware and quality checks for Johannes; every session adds its rows: `docs/tasks/pt-hardware-checks.md` | Johannes, 2026-11-18 | Running |
