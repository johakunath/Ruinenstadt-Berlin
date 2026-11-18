# M12c Mitte roster: Kabelghul, Boxenkopf, Drohne, four bosses, rain rule [Claude · Opus xhigh]

Step 5 of `docs/tasks/m15-mitte.md` (spec). Johannes, 2026-11-18: Opus 5.5 xhigh is enough for the enemies and bosses (the task file had asked for Fable). Step 6 builds from this file; format and blocks as in `m12b-xhain-enemies.md`.

Status: built 2026-11-18 (step 6, see Handover at the end). Johannes playtest open.

## Rules for every number below

- 2D to 3D: 30 px = 1 m. Normal enemies use the 2D-ghoul-to-Schlurfer ratios (life ×1.5, hit ×1.7) for light bodies and the 2D-brute-to-Brocken ratios (life ×1.2, hit ×1.44, speed ×0.032) for heavy ones, as the rat did.
- Boss life and hit sit on the existing ladder (Köpenick 900 / 2000 / 3600 / 4400, Xhain 950 / 2100 / 3200 / 4400); the wave tier (`hpMul`, `dmgMul`) does the scaling to Mitte.
- Every hit goes through `threatHit` or `hurtPlayer`, so the 45 % cap holds; telegraphed hits use `floor` as before. All bosses rage below 50 % (speed ×1.3, cooldowns ×1.35).
- Every special: readable wind-up on the ground, action, punish window (`open`, +30 %).

## Normal enemies

| Kind (`EnemyKind`) | Name | 2D source | Life | Hit | Speed | Radius | Brain | Special | Res | Drops |
|---|---|---|---|---|---|---|---|---|---|---|
| `kabel` | Kabelghul | `kabel`: r 9 px, life 15, 92–104 px/s, hit 6 | 22 | 10 | 3.3 | 0.3 | `pouncer` with own numbers (`THREAT.leap`) | Sprung: within 6.7 m and clear line, marked line 0.4 s, 0.3 s at 14.7 m/s (4.4 m), hit 1.0, open 0.5 s, cooldown 2.2–3 s (per body from `jitter`) | `kabel` (fire 1.6, acid 1, shock 0.3) | Kabel (2D `EMAT`) |
| `bass` | Boxenkopf | `bass`: r 15 px, life 62, 44 px/s, hit 13 | 75 | 19 | 1.4 | 0.5 | `bass` (new, `brute` without the slam) | Basswelle: every 2–4 s when the hero is within 9 m, wind 0.8 s (speaker swells, pink ring on the ground), one ring 0.4 → 9 m at 0.9 hit, floor 0; enemies within 7.3 m are driven on for 3 s (`buff`); open 1.1 s | `bass` (fire 1, acid 1.6, shock 0.5) | Metall |
| `drone` | Drohne | new (2D only as the power „Drohnenschwarm“) | 14 | 10 | 5 | 0.3 | `crow` (circles, dives, sits dazed) | Sturzflug as the crow; dazed means it sinks to 0.6 m and sparks | `crow` (shock 1.6) | Kabel |

- Kabelbrocken: no new kind. On maps with `flavor: 'neon'` every Schlurfer, Hetzer and Brocken gets pink cables and two lit implant dots (2D `D.cyber`), render only.
- `bass` limit: at most 2 alive at once (new `EnemyDef.cap`, honoured by the director's pick and by `?spawn`), so rings never stack into a wall. Test it.
- Not in this step: Zünder (2D 0.04 of the Mitte mix) and Schildträger (0.08). They stay in backlog P12; their share goes to Speier and Brocken.

## Wave mix (replaces the stand-ins in `mitteWaveTier`)

2D Mitte: spitter 0.14, brute 0.16, kabel 0.2, bass 0.07, the rest ghouls. Per zone:

| Zone | Mix weights (walker = 6) | Note |
|---|---|---|
| 0 Friedrichstraße | runner 1 + g·0.1, kabel 2.2 + g·0.06, spitter 1 + g·0.05, brute 0.4 + g·0.06, bass 0.6 | Kabelghule are the zone's face |
| 1 Regierungsviertel | kabel 1.4, spitter 1.2 + g·0.05, brute 0.5 + g·0.06, bass 0.5, drone 1.2 | drones over the government buildings |
| 2 Tiergarten (calm, 0.7 count, no elites) | kabel 1, crow 0.8, runner 1 | no Boxenkopf, no drones: nature |
| 3 Potsdamer Platz | kabel 2, spitter 1 + g·0.05, brute 0.6 + g·0.08, bass 1.1 | the loudest zone |

Count, `maxAlive`, `hpMul`, `dmgMul` and elites stay as now; tier 24 … 46 until the bot calibration (step 8).

## Rain rule (`MapDef.wet`, 2D `D.wet`)

| Rule | Dry | Wet (Mitte) |
|---|---|---|
| Burn time (`STATUS.burnTime`) | 2 s | 1.4 s (Schwelbrand still adds its second) |
| Chain range (`STATUS.chainRange`) | 4.7 m | 6.3 m |
| Chain jumps | n | n + 1 |

- `sim.wet` is set from the map at run start (tunnels and the camp are dry). Two unit tests: burn time and chain reach/jumps differ with `wet`.
- One line on the map start banner: „Regen: Strom springt weiter, Feuer brennt kürzer.“ (2D text).

## Bosses

| Boss | Where | Life | Hit | Speed | Radius, scale | Res | Body |
|---|---|---|---|---|---|---|---|
| Der Türsteher (`tuersteher`) | Pariser Platz, zone 0 | 1000 | 26 | 2.4 | 0.8, 1.6 | `koloss` | Kabelbrocken in a bomber jacket, pink cables, a clipboard (the guest list) |
| Die Wachdrohne (`wachdrohne`) | Kanzleramt, zone 1 | 2200 | 28 | 2.2 | 0.9, flies at 2.4 m | `ritter` (shock 1.7: rain helps) | Flat surveillance drone, four rotors, one cyan lens, a searchlight under it |
| Der Dirigent (`dirigent`) | Neuer See, zone 2 (mini-boss) | 1400 | 24 | 2.2 | 0.7, 1.4 | `bass` | Ghoul in a torn tailcoat with a baton of rebar and a speaker on his back |
| Der Bassprediger (`bassprediger`) | Sony Center, zone 3 | 4400 | 34 | 2.8 | 0.85, 1.7 | `bass` (2D: no own row) | Speaker head, pink cables, cyan eyes (2D `bassprediger` art) |

### Der Türsteher („Kein Einlass“)

| Special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Schubser | new `shove`: one circle zone 1.6 m in front of him, r 2.2 m | hero within 3.5 m, 3.2 s | wind 0.7, hit 1.0, floor 0.15, knockback ×3 (new `Zone.push`), open 0.8 |
| Griff | `lunge` with own numbers, then root | 3.5–8 m, clear line, 6 s | marked line 0.5 s, 0.35 s at 12 m/s; on contact hit 0.5 and the hero is held 1.0 s (new `player.root`: no walking, attacks and powers still work, a roll breaks free), then hit 0.6 unless the hero rolled free; open 1.2 |
| Gästeliste | `summon` | 10 s | two Kabelghule (three in rage); note „Nicht auf der Liste!“ |

- Rage: the Schubser comes twice in a row (second one 0.5 s after the first).
- Dropped: neon barriers that close the Tor passages (dynamic colliders in the level hash are new work for one boss); backlog row.
- `player.root` is a new hero rule: test that a roll clears it, that it never outlasts 1.0 s and that hitstop does not extend it.

### Die Wachdrohne

| Special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Suchlicht | new `Spot` in `threats.ts`: a lit circle r 1.8 m that follows the hero at 2.6 m/s (the hero walks about 4.5) | always one spot while she flies; two in rage | standing inside for 0.6 s in a row locks it: 0.3 s red flash, then the laser volley at the hero |
| Laser-Salve | `volley` (Grenzer block, own numbers) | from the spot lock, or every 4 s with clear line | five shots, spread 0.18, 9 m/s, hit 0.5 |
| Drohnenschwarm | `summon` | 11 s | three Drohnen (max adds 8 as for every boss) |
| Landen | new `land`: wind 0.8 (she sinks, the light goes out), a marked circle r 2.5 m under her hits on touchdown (hit 1.0, floor 0.2), then 2.5 s on the ground | every third special | open 2.5 s, no spot while landed; this is the window for melee weapons |

- She flies (`fly: true`, ignores walls), has no melee strike (`attackRange 0`) and keeps 6–10 m away like the Grenzer.
- Spot rule: it moves on the ground plane only and is drawn on `FX_LAYER` (one decal, one pooled light; state the cost).

### Der Dirigent (mini-boss, Neuer See)

Chosen over Der Kabelbaum: it reuses roar and summon only, ties the Boxenköpfe in and fits the beer garden band stand. Kabelbaum (root lines along the ground) goes to the backlog ideas.

| Special | Block | Trigger, cooldown | Numbers |
|---|---|---|---|
| Takt | `roar`, one ring | every 4 s (the beat) | wind 0.6, ring to 7 m, hit 0.6, floor 0.12 |
| Fortissimo | `roar`, two rings, and every Boxenkopf alive pulses at once | every fourth beat | gap 4 m, to 9 m, hit 0.7, floor 0.18; open 1.5 |
| Orchester | `summon` | at the start and once at 50 % life | two Boxenköpfe (respecting `cap`) |

- Melee strike as a boss (reach 2.6). Counterplay: kill the Boxenköpfe or roll through the rings on the beat.

### Der Bassprediger (district boss, Sony Center stage)

| Special | Block | Trigger, cooldown | Numbers (2D v 2) |
|---|---|---|---|
| Stromstoß | `charge` with own numbers | 3.8 s, within 13 m, clear line | wind 0.7 (sparks, marked line), 0.55 s at 18.7 m/s (about 10 m), hit 1.1, floor 0.25, open 1.25 |
| Basspredigt | `roar`, two rings | after every second Stromstoß, every one in rage | gap 5 m, to 11 m, hit 0.7, floor 0.18 (2D v0.99: two rings, not three) |
| Gemeinde | `summon` | 13 s | three Kabelghule; in rage two Boxenköpfe instead |

- Rain makes his arena wet like the rest of Mitte: shock builds are good against him (`bass` res: shock 0.5, so not too good).

## Kodex, notes, sounds, loot

| Kind | Kodex line (German, one line) | Weak | Tip on first sight (2D `tip`) |
|---|---|---|---|
| Kabelghul | Verkabelt und flink, springt dich an. Brennt gut, Strom perlt ab. | Feuer | Kabelghule springen dich an (Linie am Boden). |
| Boxenkopf | Wummert Basswellen und treibt andere an. Durch die Welle rollen. | Säure | Boxenköpfe wummern rosa Ringe. Durchrollen. |
| Drohne | Kreist und stößt herab. Strom holt sie runter. | Strom | – |
| Der Türsteher | Hält die Tür am Tor. Wer gepackt wird, rollt sich frei. | – | – |
| Die Wachdrohne | Sucht dich mit dem Licht. Raus aus dem Kegel, schlag zu, wenn sie landet. | Strom | – |
| Der Dirigent | Gibt den Takt vor. Die Boxen folgen ihm. | Säure | – |
| Der Bassprediger | Predigt mit Strom und Bass. Nach dem Stoß ist er offen. | – | – |

- Kodex busts: 2D E13 (Kabelghul), E14 (Boxenkopf); the bosses get glyphs until Codex art.
- Sounds (`src/audio/sfx.ts`, synth): Kabelghul crackle on the leap, Boxenkopf sub thump on the ring, drone rotor whine (one shared loop, volume by nearest drone), Türsteher grunt, Wachdrohne lock beep (rising) and laser zap, Dirigent tap of the baton on each beat, Bassprediger zap on the charge and the 2D `boom` on the rings.
- Loot: material drops as the 2D `EMAT`; boss drops as the other bosses. 2D Mitte items (Neonbrille, Kabelarm, Bassherz, Arm des Basspredigers, `NI` implants) are checked against `src/data/items.ts` in step 6; whatever is missing is a row in the step 6 handover, not built here.

## Build order for step 6 (one session, Opus high)

1. Data: `ENEMIES.kabel|bass|drone` and four boss defs, `THREAT.leap`, `BOSS.tuersteher|wachdrohne|dirigent|bassprediger`, `EnemyDef.cap`, `MapDef.wet`; replace `MITTE_BOSS_STANDIN` and the stand-in mix.
2. Sim: `bass` brain, `shove`, `land`, `Spot`, `player.root`, wet rule; tests in `ai.test.ts` › Mitte roster (each special fires, punish windows, cap, root cleared by a roll, 45 % cap at ten times the damage), `combat.test.ts` (wet).
3. Bodies in `src/render/enemies.ts`: Kabelghul and Boxenkopf on the zombie rig (speaker head in code), drone body in code (shared geometry, rotors spun from time), cyber cables on neon maps, the four bosses; spot decal.
4. Kodex, notes, sounds, banner line; smoke check `?map=mitte&spawn=kabel,bass,drone` and each boss via `?spawn=`.
5. Clip timing: look at the leap and the grab with `tools/clip-sheet.mjs` (skill `combat-animation`) before setting wind-ups in stone.
6. Bot: `node tools/balance.mjs --map=mitte` once, note the result; calibration stays step 8.

## Handover 2026-11-18 (step 6) [Claude · Opus high]

Built in parallel to the Mitte lot session; `src/data/mitte.ts` only changed in `MITTE_BOSSES` (was `MITTE_BOSS_STANDIN`), `mitteWaveTier` and `wet: true`.

- **Data** `src/data/enemies.ts`: `ENEMIES.kabel|bass|drone`, the four bosses, `THREAT.leap|bass`, `BOSS.tuersteher|wachdrohne|dirigent|bassprediger`, `EnemyDef.cap` (Boxenkopf 2). `MapDef.wet` → `Level.wet` → `sim.wet`. Per-zone mix in `mitteWaveTier` as specified.
- **Sim**: brains in `src/sim/ai.ts` (`bass`, the Kabelghul branch of `pouncer`, four boss cases; `own()` and `roarOf()` give shared blocks their own numbers; `Enemy.queue` runs a follow-up special: the rage shove, the Basspredigt). New specials `leap`, `bass`, `shove`, `grab`, `land`, `beat`. `src/sim/threats.ts`: `Zone.push` and `pushPlayer` (new hero knock velocity `Player.kx/kz`, damped, at most 0.36 m per step so walls hold), `Spot` (searchlight) and `laserVolley`. Hero root: `Player.root/rootBy` in `src/sim/player.ts` (no walking, attacks and powers work, a roll clears it, counts down in hitstop steps too, released on the holder's death or the hero's). Cap: `capped()` in `src/sim/enemies.ts`, used by `pickKind`, boss calls and `?spawn`. Wet rule in `src/sim/combat.ts` (`burnTime`, `chain`). Loot rows in `src/sim/loot.ts` (Kabel, Metall, Kabel; Bassprediger drops as a district boss).
- **Tests**: `ai.test.ts` › Mitte roster (each special fires and opens, cap, root: no walking, attack works, roll frees, ≤ 1 s, hitstop does not stretch it; shove push, rage double shove, spot follow/lock/volley, landing, Fortissimo pulse, sermon after every second charge, 45 % cap at ten times the damage for all seven kinds); `combat.test.ts` (wet burn, chain reach and jumps, the map flag); `mitte.test.ts` (wet).
- **Render** `src/render/enemies.ts`: Kabelghul (thin, crouched, four lit cables arching off the back, implants, pink eyes), Boxenkopf (speaker box on the neck with lit rim and pulsing rings, purple rags, hazard band; the box swells on the wind-up), pink cables and implant dots on Schlurfer, Hetzer and Brocken on `flavor: 'neon'` maps (`assign(e, neon)`), Türsteher (Brocken build, bomber jacket with orange lining, glasses, clipboard), Dirigent (tailcoat, bow tie, rebar baton, speaker on the back), Bassprediger (speaker head, five cables, preacher's collar and chest mixer from the X09 bust). Drones in code: shared geometry, rotors one instanced mesh spun from time, the small one dazed at 0.6 m with sparks, the Wachdrohne hovers at 2.4 m and sinks on `land`, searchlight off. `src/render/threats.ts`: spot decal and beam, pink ring under a winding Boxenkopf or beat, a closing pink ring round a held hero, eight ring slots (was four).
- **UI, sound**: Kodex lines and order (`src/ui/menu.ts`, busts E13, E14 and X09 from 2D, glyphs for Türsteher, Wachdrohne, Dirigent, Drohne), first-sight tips for Kabelghul and Boxenkopf (`SIGHT_TIPS` in `src/ui/intro.ts`, toast in `main.ts`), banner line „Regen: Strom springt weiter, Feuer brennt kürzer.“ (third banner line on wet maps). Notes „Nicht auf der Liste!“, „Festgehalten“, „Fortissimo!“, „Gemeinde!“. Synth cues in `src/audio/sfx.ts` (crackle, bass hum and sub thump, grunt, lock beep, laser, baton tap) and one shared rotor whine (`GameAudio.rotors`, volume by the nearest drone).
- **Bot** `src/bot/bot.ts`: walks out of searchlights, rolls free of a grab.

### Reused from 2D
Kabelghul stats, leap (0.4 s line, 0.3 s at 440 px/s, open 0.5 s, cooldown 2.2–3 s), resistances, drop chance 0.12 and Kabel; Boxenkopf stats, ring (0.9 of its hit, 12 → 270 px), buff 3 s within 220 px, open 1.1 s, cooldowns (first 2–4 s, then 5–6.5 s), drop chance 0.45 and Metall; Bassprediger charge (0.7 s, 0.55 s at 560 px/s, open 1.25 s, 3.8 s), two rings 150 px apart to 340 px after every second charge, every charge in rage (v0.99); rain rule (1.4 s burn, 190 px chain, +1 jump) and its banner text; root from the 2D Wurzler (`P.root`, a dash frees, „Festgehalten“); 2D tips (shortened as specified); Kodex busts E13, E14, X09; 2D `D.cyber` cables on ghouls and brutes (three and four cables, two implant dots); speaker head, rings and cyan strip from the 2D `bass` and Bassprediger drawings. All 2D Mitte items (Neonbrille, Kabelarm, Bassherz, Arm des Basspredigers, `NI` implants) already exist in `src/data/item-names.ts`; nothing missing.

### Numbers changed against the spec (why)
| What | Spec | Built | Why |
|---|---|---|---|
| Kabelghul leap trigger | within 6.7 m | within 5 m | 2D hurt by touch after the leap; here the leap itself hits. 4.4 m of travel plus 0.8 m contact: from 6.7 m it lands 2 m short of a hero who stands still |
| Türsteher grab trigger | 3.5–8 m | 3.5–5.5 m | 0.35 s at 12 m/s covers 4.2 m plus 1.3 m contact; beyond 5.5 m it always whiffs |
| Boxenkopf ring cooldown | every 2–4 s | first after 2–4 s, then 5–6.5 s | the 2D code (`pc=R(5,6.5)`); 2–4 s with two Boxenköpfe and their buff is a wall of rings |
| Schubser knockback ×3 | – | `push` 4 m (3 × the 2D ring push of 40 px), damped hero knock | no hero knockback existed; this defines it |
| Throw after the hold | hit 0.6 | hit 0.6 and a 2 m push | reads as being thrown out; new number |
| Wachdrohne cooldown volley | – | wind 0.5 s, life 1.8 s; a lock fires after the 0.3 s flash, then 1.5 s before the spot can lock again; the rage spot circles the hero at 2.8 m | not specified; two spots on the same path would merge into one |
| Spot light | one pooled light | decal and beam only, no light | the map's light pool already uses every slot; one more light changes the count on every map |
| Basspredigt | after every second charge | after the charge's punish window, with the roar's 0.8 s wind-up | rhythm: Stoß, open, then roll through the rings (2D started the rings with the charge) |
| Fortissimo pulse | every Boxenkopf pulses | every Boxenkopf alive is put into its ring wind-up with the Dirigent's 0.6 s, so all rings leave together | readable on the ground (pink ring under each) |
| Drone body | – | scale 1.3 | the 0.5 m quadcopter was lost on screen |

Fix outside the spec: boss calls counted sleeping side-passage guards as adds. Mitte has fifteen of them (lot types), so no boss could call anyone (`summon` in `src/sim/ai.ts`; also affected other maps with many guards). They no longer count; test in Mitte roster.

### Cost (cloud readout, Leistung, courtyard, all passes / main pass)
Kabelghul +4.5 / +1.5 draws over a Schlurfer (cables and implants are two merged meshes, no shadow); Boxenkopf +7.5 / +2.5 over a Brocken; a cyber Schlurfer on neon maps +2 meshes; a drone 3 draws (frame, lit parts, instanced rotors) and −33 / −11 against a Krähe; the Wachdrohne 4; each searchlight 3 (rim, fill, beam; at most two); ring slots and the held ring one each while shown. No lights, no shadow from emissive parts. Fps only on hardware (rows 22 to 24 in `docs/tasks/pt-hardware-checks.md`).

### Bot (`node tools/balance.mjs --map=mitte`, normal, johannes, five fresh campaigns)
5/5 won, 3.2 deaths and 20.5 min per campaign; all deaths at the first fight (Leipziger Straße, fresh gear, power 130, 132 % damage taken); after that nothing is hard: bosses fall in 24 s (Türsteher), 31 s (Wachdrohne), 15 s (Dirigent), 28 s (Bassprediger), lowest life 83–93 %. Calibration (tier start, boss life) is step 8; the start needs the gear from Alexanderplatz.

### Open
- Bodies are code placeholders on the zombie rig; Kodex glyphs for Türsteher, Wachdrohne, Dirigent and Drohne until Codex busts.
- Grab and shove reuse clips (Zombie_Scratch at 0.68, Shield_Dash to 0.25, chosen from `tools/enemy-sheet.mjs` strips); a real grab clip would read better.
- Backlog: P25 neon barriers, I3 Kabelbaum, P12 Zünder and Schildträger.
- Check: `?map=mitte&autostart&spawn=kabel,bass,drone`, `?spawn=tuersteher` (and `wachdrohne`, `dirigent`, `bassprediger`); `node tools/enemy-sheet.mjs out.png "kind=bass&n=3&neon=1"`, `"kind=tuersteher&special=grab&hit=1&n=2"`. Proof: `docs/proof/m15-mitte/m12c-*.jpg`.
