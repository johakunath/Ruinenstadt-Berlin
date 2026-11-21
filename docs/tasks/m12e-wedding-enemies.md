# M12e Wedding roster: Zecher, Tee-Ifrit, Baklava-Brocken, Teppichschlinger, four bosses, loot [spec and build: Claude · Opus high]

Step 2 of `docs/tasks/m18-wedding.md`. Input: `docs/maps/wedding.md` › Enemies (W5, W6, W8), board `docs/style/wedding.png`. Format of `m12d-charlottenburg-enemies.md`, kept small (Johannes, 2026-11-21: small and recycled). 2D has nothing for Wedding (checked in step 0), so every number sits on the existing 3D ladders.

Status: spec and build 2026-11-21, wired into the merged map the same day (Handover at the end).

## Rules

- **No new brain, no new rig.** Each figure is an `EnemyKind` on an existing `AiKind`, with branches by kind where the numbers differ (the M16 pattern: `own()`, the summon list). Bodies: the zombie rig, `human`, `koloss`, plus one code-built body (the carpet) on the Krähe brain, as the Drohne is.
- Normal enemies beside the existing kinds (table values, `NORMAL_HP` doubles them): caster near the Speier (24, 11), heavy near the Schildträger and Brocken (62 / 90, 19 / 26), flyer as the Krähe (14, 10).
- Bosses on the ladder: zone 1 1000, zone 2 2200, zone 3 3200, district boss 4400. Hits through `threatHit` / `hurtPlayer` (45 % cap), telegraphed hits with `floor`. Rage below 50 % as usual unless stated.
- Taste (W8): no religious sign anywhere (no crescent, no star, no minaret shape; the Sultan's crown is a plain gold band with jewels and a feather), no Zeitlose in the dress of the neighbours (the Zecher are Berlin pub regulars), no BVG motif.

## Zecher (no new kinds)

`MapDef.flavor: 'fest'` (render only, as `revue`): the plain Zeitlose wear one skin set, an overlay like the revue dress.

| Kind | Zecher look |
|---|---|
| Schlurfer | Stained white undershirt, a beer mug in the right hand |
| Hetzer | The same, shirt untucked |
| Brocken | Keeps his hi-vis vest (after work), a big mug: he is the building crew too |
| Speier | Stained shirt over the belly, a mug |

The loot context sees `fest` (the set below drops there); `cy`/`gd` name tables ignore it.

## Normal enemies

| Kind | Name | Life | Hit | Speed | Radius, scale | Brain | Special | Res (new row) | Cap |
|---|---|---|---|---|---|---|---|---|---|
| `teeifrit` | Tee-Ifrit | 26 | 11 | 2.0 | 0.36, 1.0 | `spitter` (keeps the Speier's distance) | Teeglas: instead of the spit, the Brandmeister's `molotov` block with one glass: with a clear line within 13 m, a marked circle r 1.2 m on the hero, lands after 1.0 s, hit ×1, floor 0, leaves hot tea (fire puddle r 0.9 m, 2.5 s, ×0.3 per tick); open 0.6 s; every 2.8 to 3.6 s | `tee`: fire 0.5, acid 1, shock 1.6 | 3 |
| `baklava` | Baklava-Brocken | 100 | 26 | 1.4 | 0.6, 1.3 | `brute` (the Brocken's slam on a marked circle) | Tablettschild: the Schildträger's front (`shield` arc 1.2, 20 % through, 1.6 rad/s, open 2.2 s on a stun or shock) | `baklava`: fire 1.6, acid 0.6, shock 1 | 2 |
| `teppich` | Teppichschlinger | 16 | 11 | 5 | 0.32, 1.2 | `crow` (circles, dives, rests) | Sturzflug: the dive line is locked at the start of the wind-up and marked on the ground (wind 0.55 s instead of 0.35) | `teppich`: fire 1.6, acid 1.2, shock 0.6 | none |

- Classes (D9): Tee-Ifrit `untote` (a spirit), Baklava-Brocken `pflanzen` (pastry and nuts: cut it), Teppichschlinger `tiere` (a flyer: shoot it).
- Drops: Tee-Ifrit Chemie at the Speier's chance, Baklava-Brocken Metall (the tray) at the Schildträger's, Teppichschlinger Stoff at the Krähe's.
- Bodies: the Tee-Ifrit is the zombie rig with the legs scaled away above a brass samovar, amber skin, steam wisps, a tea glass in each hand; it hovers 0.25 m (render). The Baklava-Brocken is the zombie rig in stacked filo slabs with honey drips, a block head with pistachio-green eyes, the silver tray as shield (gear [0], swings aside while open). The Teppichschlinger is a code-built carpet of eight segments that waves, a woven face with teeth at the front, tassels.

## Bosses

| Boss | Where | Life | Hit | Speed | Radius, scale | Res | Brain | Body |
|---|---|---|---|---|---|---|---|---|
| Der Zugezogene (`zugezogene`) | Inside the Magendoktor after its two waves, zone 1 (map doc W5, Johannes 2026-11-21) | 1000 | 26 | 2.5 | 0.7, 1.45 | `koloss` | `feldwebel` | `human`, slim: knit beanie, round glasses, waxed moustache, open olive jacket over a white shirt, tote bag, oat-milk coffee; an e-scooter while he charges |
| Das Hauptgericht (`hauptgericht`) | Brunnenplatz, zone 2 | 2200 | 30 | 2.0 | 1.1, 2.0 | `baklava` | `rex` | The Baklava-Brocken at boss size; the right arm is a turning meat spit, the left holds the tray |
| Der Ewige Bauherr (`bauherr`) | Beamtentor, zone 3 | 3200 | 32 | 1.4 | 1.7, 1 | `volk` | `volkskoloss` | The Koloss slab under scaffold poles and planks, green net, a hi-vis band, a cream banner, a hard hat on the cab; a cement mixer turns where the clock ring was |
| Sultan Nimmersatt (`sultan`) | Hochzeitspalast, zone 4 | 4400 | 34 | 2.4 | 0.95, 1.85 | `tee` | `diva` (glides, three phases) | `human`: crown with feather, ruby-and-emerald robe, serving trays on the shoulders with three dishes, a glass tea-urn belly that glows, a spoon sceptre, floating on a carpet |

### Der Zugezogene („Bald nur noch Hafermilch!“)
| Special | Block | Numbers |
|---|---|---|
| Zecher | `summon` every 10 s | one Schlurfer and one Hetzer; in rage also one Brocken. Note „Bald nur noch Hafermilch!“ |
| E-Scooter | `charge` (Feldwebel) with own numbers | a short run along a marked line for the tight pub: from 2.5 to 6 m, wind 0.6, 0.4 s at 12 m/s (4.8 m), hit 1.1, floor 0.25, open 1.3, every 5 to 7 s; in rage twice (second 0.6 s later, as the Ringvater) |
| Kaffeebecher | `volley` (Grenzer), his one own block | five cups across the hero's line (9 m/s, ×0.55 each) every 5 s within 8 m with a clear line |

### Das Hauptgericht („Frisch vom Spieß“)
| Special | Block | Numbers |
|---|---|---|
| Drehspieß | `tail` (Rex) | a marked ring r 3.7 m round him, wind 0.8 s, hit ×1, floor 0.25; the body turns once with the spit (render) |
| Dampfwolke | `roar` (Rex) | two rings to roll through every 8 s |
| Anlauf | `charge` (Rex) | every 4.2 s (3 s in rage) from 4 m on |

Rex numbers unchanged; no raptors (that call stays tied to the Rex). New block: none.

### Der Ewige Bauherr („Kommt bald!“)
| Special | Block | Numbers |
|---|---|---|
| Fertigteile | `slabs` (Koloss) | three slab drops, the first on the hero |
| Schraubenregen | the Koloss spin spray | the mixer spins, bolts fly out in two arms |
| Abriss | `bossSlam` within 3 m | the Koloss hammer |
| Bautrupp | the Koloss call every third cycle | two Brocken (hi-vis vests) instead of two Uhrwerkläufer. Note „Bautrupp!“ |

### Sultan Nimmersatt (district boss; „Vorspeise, Hauptgang, Nachtisch“)
The Diva's brain with own numbers (`BOSS.sultan`): her phases are his courses, at 66 % and 33 % one dish on his trays is gone.

| Special | Block | Numbers |
|---|---|---|
| Teeglasfächer | `fan` | seven glasses in a 0.5 rad cone, 9 m/s, ×0.5 each; phase 2 two fans, phase 3 three (Diva rule) |
| Teppichbahn | `prism` (line zone) | a ruby carpet strip 1.4 m wide rolls through the hero, wind 0.9 s, hit ×1.2, floor 0.25; phase 2 an X, phase 3 three; open 1.5 s |
| Nachschlag | `summon` every 12 s | two Tee-Ifrite; from phase 3 also one Teppichschlinger. Note „Nachschlag!“ |
| Gangwechsel | `roar`, one ring | at 66 % („Hauptgang!“) and 33 % („Nachtisch!“), ring to 9 m, ×0.6, floor 0.15, open 2 s |

No rage (the courses are his escalation; phase 3 cooldowns ×0.85).

## District rule „Honig klebt“ (optional, `MapDef.honey`)

Fixed honey puddles `[x, z, r]` from the map data; `Level.speedAt` returns 0.6 inside one (hero and walking enemies, as the flooded tunnel). No damage, no new hazard. Placement and the amber decal belong to step 3; without data nothing changes.

## Loot

- **Set „Pracht des Ewigen Gasts“** (`gast`): five pieces (the set rule: five pieces, bonuses at 2, 3, 5), all on existing bases with a new palette (`base:gast` in `hero-look.ts`): Kaftan (`mantel`), Handschuhe (`handsch`), Stiefel (`stiefel`), Feder (talisman `feder`, tempo), Siegelring (`siegel`, krit). Bonuses: 2 „+1,5 Leben pro Sekunde“, 3 „+45 % Schaden und +3 Leben pro Kill“, 5 „+6 Beuteglück und +150 Leben“. Drops only on `fest` maps, there in 60 % of set drops (as the Tunnelläufer).
- **Die Letzte Bestellung** (legendary Hammer, base `bestellung`, fire): „Jeder dritte Treffer verbrüht Gegner ringsum mit heißem Tee“ (fire hit at 0.5 of the hit on enemies within 2.5 m). On the Vorschlaghammer's handle with a wish-lamp head and two tea glasses on chains. On `fest` maps 40 % of legendary weapon drops are this one; nowhere else.
- Everything else from the pools of the earlier maps; no new normal bases.

## Kodex, notes, sounds

| Kind | Kodex line | Tip on first sight |
|---|---|---|
| Tee-Ifrit | Wirft heiße Teegläser. Zuerst erledigen. | Tee-Ifrite werfen Gläser. Raus aus dem Kreis. |
| Baklava-Brocken | Vorn ein Tablett, hinten nur Teig. Umgehen. | Baklava-Brocken blocken vorn. Umgehen oder betäuben. |
| Teppichschlinger | Kreist, zeigt eine Linie, stürzt herab. | Teppiche stürzen entlang der Linie. Seitlich weg. |
| Der Zugezogene | Will aus der Kneipe bald was Neues machen. Raus aus seiner Spur. | – |
| Das Hauptgericht | Frisch vom Spieß. Raus aus dem Kreis, wenn er sich dreht. | – |
| Der Ewige Bauherr | Baut seit Jahren. Fertig wird nie etwas. | – |
| Sultan Nimmersatt | Vorspeise, Hauptgang, Nachtisch. Kein Gast geht. | – |

Sounds: existing cues only (`molotov` throw for the glass, the Krähe's dive, the Diva's tier sound for a course change, summon and charge as for every boss).

## Build order (this session)

1. Data: kinds, bosses, `THREAT.tea`, `BOSS.zugezogene|sultan`, res rows, flavor `fest`, `MapDef.honey`, set and legendary. 2. Sim branches and unit tests (each special, the 45 % cap, set and legendary drops, honey). 3. Bodies and the Zecher overlay, carpet body, threat colours. 4. Kodex, tips, glyphs, portraits ids (Codex later). 5. Sheets to `docs/proof/m18-wedding/enemies/`, pipelines, handover.

## Handover 2026-11-21 (step 2) [Claude · Opus high]

- **Built as specified**, no new brain or rig: data `src/data/enemies.ts` (3 kinds, 4 bosses, `THREAT.tea|carpetDive|honey`, `BOSS.zugezogene|bauherr|sultan`), res rows `tee`, `baklava`, `teppich`; branches in `src/sim/ai.ts` (`divaOf`, the tea glass on the `molotov` block, the locked carpet line, the Zugezogene's Zecher and coffee cups, Bautrupp, Nachschlag, courses); `MapDef.flavor: 'fest'`, `MapDef.honey` → `Level.speedAt`; set `gast` and legendary `bestellung` (`src/sim/items.ts`, `LAST_ORDER` in `combat.ts`). Tests: `ai.test.ts` › Wedding roster (10), `items.test.ts` (fest-only drops), `legendary.test.ts`, `stats.test.ts` (set bonuses). Reused: 2D has nothing; the blocks named in the tables.
- **Render**: bodies in `src/render/enemies.ts` (`FEST` Zecher overlay, `buildRug`, `bauherrSet`, Sultan carpet), ruby carpet strips, amber tea circles and the marked carpet dive in `threats.ts`, the lamp hammer in `weapons.ts`. Kodex E22 to E24, X24 to X27 and icons I103 to I106 rendered from 3D; proof `docs/proof/m18-wedding/enemies/`. Draws per body in `docs/enemy-pipeline.md`. Sounds: existing cues only, no boss voices.
- **Deviations**: boss 1 was built first as Der Stammgast (the brief); main then changed it to Der Zugezogene in the pub (W5), so he replaced it in this PR (same brain, plus the coffee volley). The Hauptgericht calls no adds and has no new block (the Rex's tail ring is the spit sweep); the Bauherr's crew wears the Zecher mug (no per-call hard hat); the banner has no text (sign atlas of step 3); the death note for the spit sweep reads „Schwanzhieb“ (shared `tail` name). The `passes.mjs` readout returned 0 calls in this cloud session, so draws come from `tools/enemy-sheet.mjs` (now prints `calls=`).
- **Wired into the map (2026-11-21, after PR #81)**: `WEDDING_BOSSES` are the four real bosses; `weddingWaveTier` has the roster per zone (Tee-Ifrit from zone 1, Baklava-Brocken and Teppichschlinger from the Panke on, all three strongest in the Fest), the Humboldthöhe calm with carpets, the Magendoktor Zecher only (`pub`); no crow or rat left (`wedding.test.ts`). Honey puddles are not placed (no decal yet; step 3 may add them with one).
- **Open**: Johannes playtest (`pt-hardware-checks.md` › Playtest, Wedding roster; hardware row 54); boss voices; bot run on Wedding once the map exists.
