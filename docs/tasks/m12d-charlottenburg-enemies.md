# M12d Charlottenburg roster: Scherbentänzerin, Logenbrecher, Spiegelsouffleur, four bosses, shard rule [spec: Claude · Fable high; build: Claude · Opus high]

Step 5 of `docs/tasks/m16-charlottenburg.md` (spec). Step 6 builds from this file; format and blocks as in `m12c-mitte-enemies.md`. Board: `docs/style/charlottenburg.png` (`docs/district-design-directions.md` › Final · Charlottenburg). 2D has nothing for this district (only the era string), so every number here is new and sits on the existing 3D ladders.

Status: spec written 2026-11-19, not built. Short notes; Opus writes final German text where a draft is marked.

## Design aims

- Three kinds, three answers, one order of play (B2, Johannes 2026-11-18: slow but strong enemies so there is an order): kill the **Spiegelsouffleur** first (he drives the others on), dodge the **Logenbrecher**'s blow and hit him while he is open, and place the **Scherbentänzerinnen** so their shards work for you.
- One district rule that the player can use, not only suffer: glass bursts (below).
- Everything from existing blocks where possible; new sim work is listed per figure and kept small.

## Rules for every number below

- Normal enemies sit beside the existing kinds: light bodies near the Kabelghul (22 life, hit 10), the heavy one above the Brocken (90, 26), the caster near the Speier (24, 11).
- Boss life and hit on the existing ladder (Mitte 1000 / 2200 / 1400 mini / 4400); the wave tier (`hpMul`, `dmgMul`) scales to the district.
- Every hit through `threatHit` or `hurtPlayer` (45 % cap holds), telegraphed hits use `floor`. All bosses rage below 50 % (speed ×1.3, cooldowns ×1.35) unless stated.
- Every special: readable wind-up on the ground, action, punish window (`open`, +30 %).

## Normal enemies

| Kind (`EnemyKind`) | Name | Life | Hit | Speed | Radius, scale | Brain | Special | Res (new rows) | Cap |
|---|---|---|---|---|---|---|---|---|---|
| `scherbe` | Scherbentänzerin | 20 | 10 | 3.6 | 0.3, 0.95 | `pouncer` with own numbers (`THREAT.pirouette`) | Pirouette: within 5 m and clear line, marked line 0.45 s, spins 0.35 s at 13 m/s (4.5 m), hit 1.0, open 0.6 s, cooldown 2.4 to 3.2 s (per body from `jitter`) | `glas`: fire 1, acid 0.5, shock 1.6 | none |
| `loge` | Logenbrecher | 130 | 30 | 1.2 | 0.65, 1.35 | `brute` with own slam numbers (`THREAT.faust`) and the shield rule | Glasfront: `shield` as the Uhrwerkläufer (arc 70°, front 0.2, turn 90°/s). Faustschlag: within 3.2 m, wind 1.1 s (fists raised, marked circle r 2.4 m in front), hit 1.3, floor 0.25, open 1.6 s; while open the front is down. Poise, knockback taken 0.35 | `rauchglas`: fire 1, acid 1.6, shock 0.5 | 2 alive |
| `souffleur` | Spiegelsouffleur | 34 | 12 | 2.4 | 0.36, 1.1 | `heuler` with own numbers plus a `fan` volley | Keeps 6 to 9 m. Stichwort: the Heuler's howl (`howl` block: wind 0.5, enemies within 7.3 m are driven on for 4 s), every 5 to 6.5 s. Between two cues one Scherbenfächer: `fan` of five shards, spread 0.3, 7.7 m/s, hit 0.5 each, wind 0.6, open 1.0 | `spiegel`: fire 1.6, acid 0.6, shock 1 | 2 alive |

- All three are `glass: true` (new `EnemyDef` flag) for the district rule.
- The Souffleur hovers 0.3 m in the render only (`fly` stays false: walls and hedges stop him, so the maze stays readable).
- Zeitlose in 1920s dress: no new kinds. On maps with `flavor: 'revue'` (new value of `MapDef.flavor`, render only for now, no loot table yet) the Schlurfer wears tails or an usher's jacket, the Hetzer a page's uniform, the Brocken a stagehand's apron, the Speier a cigarette girl's tray. As the cyber cables on `neon` maps.
- Existing kinds used unchanged: Krähe (Zoo, garden), Ratte (Stadtbahn arches).
- Drops: `scherbe` and `souffleur` the nearest existing light material, `loge` Metall, at the chances of Kabelghul and Boxenkopf. A material „Kristall“ is a loot decision for later (see Loot).

## District rule: Glas splittert (`MapDef.shards`)

| Rule | Numbers |
|---|---|
| A `glass` enemy that dies bursts | 0.5 s after death a marked circle r 1.5 m at the body (white-violet rim), then one hit |
| On the hero | 0.5 × the dead kind's hit (through `threatHit`, floor 0) |
| On other enemies in the circle | 40 % of the dead kind's base life × the wave's `hpMul`; a kill by shards bursts as well (chains are wanted) |
| Bosses | Take shard damage like any enemy, capped at 2 % of their life per burst |
| Not affected | Non-glass kinds do not burst; adds called by a boss do |

- `sim.shards` is set from the map at run start (other maps, tunnels and the camp: off). Tests: a burst hits hero and enemies once, a chain of three dancers resolves in order and ends, the boss cap, no burst on other maps.
- Banner line (draft): „Glas splittert: Wer zerspringt, trifft alle ringsum.“
- Render: one pooled ring decal per burst and a short shard spray on `FX_LAYER`; no light. State the cost.

## Wave mix (replaces the stand-ins in `charlottenburgWaveTier`)

Walker weight 6 as elsewhere; `g` is the wave index as in Mitte's mix.

| Zone | Mix weights | Note |
|---|---|---|
| 1 Zoo & Tauentzien | runner 1.2 + g·0.1, scherbe 1.6 + g·0.06, spitter 0.8 + g·0.05, brute 0.4 + g·0.05, crow 0.6 | The dancers are introduced alone; the KaDeWe fight adds 1.0 to scherbe (mannequins) |
| 2 Ku'damm & Savignyplatz | scherbe 2.2 + g·0.06, souffleur 0.7, loge 0.5 + g·0.04, spitter 1, runner 1, rat 0.5 | The full trio from the Café des Westens on |
| 3 Schlossgarten | scherbe 1.6, souffleur 0.9, loge 0.5, crow 0.8, brute 0.4 | Karpfenteich (calm, 0.7 count, no elites): crow 1, runner 1, scherbe 1 only |
| 4 Spiegelschloss | scherbe 2, souffleur 1.1, loge 0.9 | Glass only besides walkers: the rule is at its strongest |

Count, `maxAlive`, `hpMul`, `dmgMul` and elites stay as in the stand-in mix; tier 32 to 54 until the balance decision (map doc C4).

## Bosses

| Boss | Where | Life | Hit | Speed | Radius, scale | Res | Body |
|---|---|---|---|---|---|---|---|
| Der Conférencier (`conferencier`) | Auguste-Viktoria-Platz at the Gedächtniskirche, zone 1 | 1000 | 26 | 2.6 | 0.7, 1.4 | `spiegel` | `human` base: tailcoat, top hat, half mask of mirror shards, a cane with a cut-glass knob |
| Der Ringvater (`ringvater`) | In front of the Opernhaus, zone 2 | 2200 | 30 | 2.3 | 0.85, 1.6 | `brute` | `human` base, broad: fur-collar coat, bowler, heavy signet rings, a sash of his (invented) Ringverein „Treue Hand“ |
| Das Spiegelpaar (`spiegelpaar` and its reflection `spiegelbild`) | Belvedere, zone 3 | 3200 | 28 | 3.0 | 0.6, 1.3 | `glas` | `female` base twice: a revue dancer in silver and violet, and her reflection in cold blue-silver, mirrored left to right |
| Die Diamantene Diva (`diva`) | Ehrenhof, zone 4 | 4400 | 34 | 2.4 | 0.9, 1.8 | `glas` | `female` base: tiered cut-glass fan gown (three tiers), feather and diamond halo, floating fan blades, violet cape, a lit crystal heart, stage mask |

### Der Conférencier („Die nächste Nummer!“)

| Special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Nummer | `summon` | 10 s | Alternates two acts: „Tanz“ three Scherbentänzerinnen, „Kraftakt“ one Logenbrecher (respecting `cap`). In rage both together. Note „Die nächste Nummer!“ |
| Spotlicht | `Spot` (Wachdrohne block) | always one spot; two in rage | r 1.8 m, follows the hero at 2.6 m/s; 0.6 s inside locks it, 0.3 s flash, then Applaus on the spot |
| Applaus | `barrage` with own numbers | from a spot lock only | four marked circles r 1.6 m on and round the spot, step 0.15 s, hit 0.9, floor 0.2 |
| Stockstoß | `lunge` with own numbers | 3.5 to 5.5 m, clear line, 6 s | marked line 0.5 s, 0.35 s at 12 m/s, hit 1.1, open 1.2 |

- Melee strike as a boss (reach 2.4). He teaches the district: his acts are the three kinds, and bursts of his dancers hurt him (2 % cap).

### Der Ringvater („Erst die Leibwache!“)

| Special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Leibwache | new small rule `guarded` | passive | He enters with two Logenbrecher. While at least one Logenbrecher lives he takes half damage (`THREAT.armored`), shown by a ring at his feet and a note „Erst die Leibwache!“ on the first blocked hit |
| Ringschlag | `charge` (Feldwebel block) with own numbers | 4.5 s, within 12 m, clear line | wind 0.75, 0.6 s at 16 m/s, hit 1.1, floor 0.25, open 1.3 |
| Schutzgeld | `summon` | 12 s | three Hetzer (his collectors); once at 50 % life one Logenbrecher (respecting `cap`), which brings `guarded` back |
| Rage | | below 50 % | the Ringschlag comes twice in a row (second 0.6 s after the first, new line) |

- New sim work: `guarded` (damage ×0.5 while a kind listed in `BOSS.ringvater.guards` is alive). Test: half damage with a guard, full without, the 50 % guard brings it back.
- Order of play: guards first (dodge their blows, hit them open), then him. This is the B2 heavy-enemy lesson as a boss.

### Das Spiegelpaar („Nur ein Spiegelbild“)

One boss with a life bar and its reflection, a second body that cannot be hurt.

| Rule or special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Spiegelbild | new: `mirror` link | always | The reflection stands at the point reflection of the real one through the arena centre (`pos' = 2c − pos`), faces the mirrored way and copies her animation. It takes no damage (hits flash it, note „Nur ein Spiegelbild“ at most every 3 s) and dies with her. Tell: the real one has a red sash and a warm heart glow and a ring at her feet; the reflection is blue-silver without ring |
| Doppelpirouette | `lunge` with own numbers, both bodies at once | 4 s, clear line | each marks its own line at the hero 0.55 s, 0.35 s at 13 m/s, hit 1.0 (reflection 0.7), open 1.0. The two lines cross at the hero: roll sideways |
| Scherbenregen | `barrage` | 9 s | six circles r 1.4 m round the hero, step 0.12 s, hit 0.9, floor 0.2; in rage the reflection casts a second set 0.5 s later |
| Tausch | new: swap | 12 s (8 s in rage) | wind 0.8 s (both shimmer white), then they swap places: the real one is where the reflection was. Open 0.6 s after. The sash and ring move with the real one |

- New sim work: an enemy with `mirrorOf` (position is a pure function of its host and the encounter centre, so no extra state in the rollback; untargetable for damage and for powers' target picks; does not count as an add or for wave ends), and the swap. Tests: reflection position, no damage, dies with the host, swap exchanges positions and keeps life, the reflection's hits obey the 45 % cap.
- If `mirrorOf` turns out to fight the director or the hit code: fallback is a plain second boss body with shared life (`sharedLife`), no swap. Say so in the handover.

### Die Diamantene Diva (district boss, Ehrenhof)

Three gown tiers are three phases: at 66 % and 33 % life a tier shatters.

| Special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Fächerschlag | `fan` with own numbers | 3.5 s | seven blades in a 0.5 rad cone, 9 m/s, hit 0.5 each, wind 0.6. Phase 2: a second fan 0.4 s later, turned by half a gap. Phase 3: three fans, each turned 20° |
| Prismenstrahl | new: line zone | 8 s | a marked line 1.2 m wide through the hero from wall to wall, wind 0.9 s (a thin prism ray on the ground), then it hits for 0.3 s: hit 1.2, floor 0.25. Phase 2: two lines crossing in an X. Phase 3: three lines 25° apart. Open 1.5 s after (she holds the pose) |
| Zugabe | `summon` | 12 s | three Scherbentänzerinnen; in phase 3 also one Spiegelsouffleur (respecting `cap`). Note „Zugabe!“ |
| Vorhang (tier break) | `roar`, one ring | at 66 % and 33 % | the tier bursts: one ring to 9 m, hit 0.6, floor 0.15, all blades in flight fall; she is open 2 s. Note „Der Vorhang fällt“ at 33 % |

- Glides (does not run), keeps 4 to 8 m, fan strike in melee (reach 2.8). No extra rage: the phases are her escalation (phase 3 cooldowns ×0.85).
- New sim work: a `Zone` shape `line` (segment with width, same life cycle as the circle zones: marked, active, gone). Tests: hits only inside the strip, the 45 % cap, three lines in phase 3.
- Render ties: the stage lights of the Ehrenhof follow her phases; if the sky per zone (task E1) exists, the dawn brightens with each phase. Optional, not part of the sim.

## Maze riddles (task E7, zone 3; optional beside the route)

| Riddle | Parts | Rule |
|---|---|---|
| Kristallsockel | hold rings and a gate, generalised from the tunnel (`hold`, `Level.gates`) | Three lit plinths in the maze's dead ends. Standing in a plinth's ring (r 1.5 m) for 2 s lights it for good. With all three lit, a hedge gate opens to the hidden blessing in the maze's fourth pocket. No enemies needed, no timer, progress saved with the run. Message „Sockel 2 von 3“, then „Das Heckentor öffnet sich“ |
| Spiegelpfad | data and render only | At two forks stand three mirror panels. Only the one at the true way shows the hero (a lit silhouette card that mirrors his side-to-side position); the wrong ways end in a dead end with a sleeping Spiegelsouffleur (`guards`). No sim rule |

- New sim work for the plinths: `MapDef.plinths` and one gate that opens when all are lit; reuse the hold ring drawing. Tests: order free, progress never drops, the gate opens once, the blessing is unreachable before.
- Build this as its own small step (6c) after the roster; it needs the maze dead ends of the data.

## Kodex, notes, sounds (German drafts, one line each; Opus finalises)

| Kind | Kodex line | Weak | Tip on first sight |
|---|---|---|---|
| Scherbentänzerin | Dreht sich durch dich hindurch. Zerspringt und trifft alle ringsum. | Strom | Tänzerinnen zerspringen. Lass sie zwischen den anderen fallen. |
| Logenbrecher | Vorn aus Glas, schlägt langsam und hart. Ausweichen, dann zuschlagen. | Säure | Logenbrecher sind vorn gepanzert. Nach dem Schlag sind sie offen. |
| Spiegelsouffleur | Flüstert den anderen ihr Stichwort zu. Zuerst erledigen. | Feuer | Der Souffleur treibt alle an. Zuerst erledigen. |
| Der Conférencier | Sagt die Nummern an. Raus aus dem Spotlicht. | Feuer | – |
| Der Ringvater | Lässt sich schützen. Erst die Leibwache. | – | – |
| Das Spiegelpaar | Nur eine ist echt: die mit der roten Schärpe. | Strom | – |
| Die Diamantene Diva | Fächer, Prismen, drei Vorhänge. Nach dem Strahl ist sie offen. | Strom | – |

- Notes: „Die nächste Nummer!“, „Erst die Leibwache!“, „Nur ein Spiegelbild“, „Zugabe!“, „Der Vorhang fällt“.
- Sounds (`src/audio/sfx.ts`, synth): glass chime on a burst (pitch by size), a dancer's whirr, the Logenbrecher's creak and crash, the Souffleur's whisper hiss, a drum roll for „Nummer“, applause burst for the barrage, a cash-register bell for „Schutzgeld“, a shimmer for the swap, a rising glass tone before the prism ray, a curtain thud on a tier break.
- Kodex busts: glyphs until Codex art; add rows to `docs/enemy-pipeline.md` in the build PR.

## Loot (not built with the roster)

- The board's set „Ornat des Letzten Vorhangs“ and the weapon „Schlussapplaus“ (fan-blade glaive on the Speer base) need item data that 2D never had. Proposal for a later step, after B2 has settled the economy: Schlussapplaus throws a fan of five shards on every third hit; the set's two-piece bonus makes the hit after a roll a sure crit, the four-piece bonus lets your kills burst like glass on every map. Decide numbers with the balance bot, not here.
- Until then the district boss drops as the other district bosses do.

## Build order for step 6 (one session, Opus high; riddles as 6c)

1. Data: `ENEMIES.scherbe|loge|souffleur`, the four bosses and `spiegelbild`, `THREAT.pirouette|faust` and the bosses' own numbers, `EnemyDef.glass`, res rows `glas`, `rauchglas`, `spiegel`, `MapDef.shards`, `flavor: 'revue'`; replace `CHARLOTTENBURG_BOSS_STANDIN` and the stand-in mix.
2. Sim: the burst rule, `guarded`, `mirrorOf` and the swap, the line zone, the Conférencier's spot-to-barrage; tests in `ai.test.ts` › Charlottenburg roster (each special fires and opens, caps, the 45 % cap at ten times the damage for all kinds) and `combat.test.ts` (bursts, chains, boss cap).
3. Bodies in `src/render/enemies.ts`: the three kinds and the four bosses on the existing bases (zombie rig, `human`, `female`) with code-built glass panels, fans and feathers; 1920s dress on `revue` maps; burst ring and shard spray, line zone decal, the guarded ring.
4. Kodex, notes, sounds, banner line; smoke check `?map=charlottenburg&spawn=scherbe,loge,souffleur` and each boss via `?spawn=`.
5. Clip timing: look at the pirouette and the heavy blow with `tools/clip-sheet.mjs` (skill `combat-animation`) before fixing wind-ups.
6. Bot: `node tools/balance.mjs --map=charlottenburg` once, note the result; calibration stays step 8. The bot must learn two things: do not stand in a burst circle, and hit the guards first.
7. Indexes: `docs/enemy-pipeline.md` (every new body and Kodex entry) in the same PR.
