# WP5 Enemies and bosses [Claude · Opus high]

Work package WP5 (Johannes, 2026-11-19): P30 quick wins, P12 remaining 2D enemies, H2 own boss models, S3 voices, P25 neon barriers. Order as listed; P25 waits for a Fable decision on dynamic colliders.

Status 2026-11-19: steps 1 and 2 built (PR on `ccr-d099d58b-xmy2l2`). Step 3 waits for Johannes' pick of the mockup looks, step 4 for his pick of the voice tool, step 5 for a Fable pass.

## Steps

| # | Step | State |
|---|---|---|
| 1 | P30 quick wins: Brocken orange vest, Kabelghul cyan cables, Speier belly (bodies match busts E02, E13, E03) | built |
| 2 | P12: Zünder, Schildträger, Heuler (Ratte was built in M12b) | built |
| 3 | H2: own models in code for Feldwebel, Hauptmann, Schaffner, Brandmeister, Rattenmutter, Turmwächter, matching busts X04, X01, X05, X10, X06, X03 | mockup round open |
| 4 | S3: short spoken lines for human and robot enemies and bosses | tool proposal open |
| 5 | P25: Türsteher neon barriers | needs a Fable decision (dynamic colliders in the level hash) |

## Handover (steps 1 and 2)

- Reused from 2D: `mkEnemy` rows `bomb`, `shield`, `howl` (radius, life, speed, hit, Schrott), the `js/update.js` rules (fuse at 58 px for 0.85 s, self blast r 84 px at ×1.3, death blast r 66 px at ×0.6, `bigHit` floor 0.22, blasts hit enemies at ×1.5 with 320 px knock; `SHD` front block ±1.2 rad at 20 %, turn 1.6 rad/s, hammer stun opens 2.2 s; howl backs off under 180 px, strafes to 260 px at 0.6, howls every 4.5 to 6 s within 460 px, drives bodies within 220 px for 4 s), `RES` rows, `EMAT`, `EZUT`, drop chances, the Kodex tips, busts E06, E07, E08, sounds (`zap` for the fuse, `horn` for the howl).
- Ratios: Zünder and Heuler on the ghoul ratios (life ×1.5, hit ×1.7, speed ×0.027), Schildträger on the brute ratios (life ×1.2, hit ×1.44, speed ×0.032).
- New for 3D: the Zünder's death blast is marked 0.3 s (2D went off at once); a stun does not put out a lit fuse; the howl has a 0.5 s wind-up and a 0.6 s open window; at most one Heuler alive (`cap: 1`); Zünder never elite; howl ring is harmless and drawn at half brightness; driven bodies show faint pink sparks.
- Code: data `src/data/enemies.ts` (`zuender`, `schild`, `heuler`, `THREAT.fuse`, `THREAT.howl`), brains `src/sim/ai.ts` (`fuse`, `howl`), blasts `Zone.blast` in `src/sim/threats.ts` (hits enemies through `strike` after the zone loop), death blast `killEnemy` in `src/sim/combat.ts`, the shield bearer reuses the M15 `EnemyDef.shield` rule. Tests: `src/sim/ai-wp5.test.ts` (17).
- Wave mix: Xhain Zünder from zone 1 (2D 0.05), Heuler only in zone 2 (Kotti, Görli); Alexanderplatz Zünder from the third wave (2D 0.03); Mitte Zünder 0.5 and Schildträger 1 in zones 0, 1, 3, taken back from Speier and Brocken (2D 0.04 and 0.08). **Decision to confirm:** 2D had the Heuler only in Spandau and Marzahn (not built); Xhain zone 2 is my pick so it appears at all.
- Bodies (zombie rig, gear in code): Brocken open orange vest with two reflective bands (shoulder plate and chest plate removed), Speier belly sphere in its skin tone, Kabelghul cyan cables, implants, eyes and a red scarf; Zünder four dynamite sticks, detonator with dial, fuse spark that flares while the fuse burns, red scarf; Schildträger riot helmet with visor, shoulder plates, a shield that swings aside while the guard is open; Heuler swollen throat that bulges on the howl, head thrown back.
- **Bug fixed on the way:** zombie-rig gear was aligned to whatever pose the pooled view held when a kind first appeared on it (often the last body's death pose; in the sheet tool the GLB rest pose), so helmets, caps, speaker heads, the Brandmeister's torch and the Turmwächter's lantern came out tilted. `EnemyView.inIdle` now builds gear in the first frame of the idle clip. Every boss on the zombie rig looks different (upright) after this; before/after sheets in the PR.
- Cost: no lights, no new draw calls beyond the gear meshes (merged per material, 3 to 5 per kind as for the other kinds), a few pooled particles over driven bodies.
- Not done: hardware look check (playtest row), balance bot run with the new kinds.

## Step 3 plan (after the mockup pick)

Bosses stay on the zombie rig and keep their clips; the new silhouette comes from heads and bodies built in code and mounted on bones (route `docs/enemy-pipeline.md` › Route per job). Each boss: what the bust shows that the body lacks today.

| Boss | Bust | Body today | Needs |
|---|---|---|---|
| Der Feldwebel | X04: Pickelhaube with eagle plate, gold epaulettes, high collar greatcoat | Pickelhaube, blue tunic, epaulettes | Eagle plate, greatcoat with collar and skirt, moustache |
| Hauptmann von Köpenick | X01: Pickelhaube gold eagle, white moustache, epaulettes, greatcoat | Pickelhaube with plume, sash | Greatcoat, moustache; drop the plume (not in the bust) |
| Der Schaffner | X05: peaked cap with badge, long double-breasted coat, signal disc held up | Cap, coat, disc | Raised disc in the right hand, longer coat, buttons |
| Der Brandmeister | X10: burning fire helmet, turnout coat with yellow bands, lamp on the chest | Fire helmet, ember coat, torch | Flames on the helmet, yellow reflective bands, chest lamp |
| Die Rattenmutter | X06: rat head with a crown, fur | Hood, moss coat, shoulder rat | Rat head (snout, ears, whiskers, teeth) and crown replacing the human head |
| Der Turmwächter | X03: Fernsehturm sphere as a helmet with a lit visor ring, tower-segment body, sparks | Wide hat, lantern, keys, robe | Tower-sphere head with cyan window ring, ribbed tower body |

## Step 4 proposal (before anything is generated)

| Point | Proposal |
|---|---|
| Tool | Piper TTS (OHF-Voice `piper1-gpl`, GPL-3.0) offline on the PC or here, as a build tool only; nothing of Piper ships in the game |
| Voices | `de_DE-thorsten-medium` (male, CC0), `de_DE-thorsten_emotional-medium` (8 emotions incl. angry and whisper, CC0), `de_DE-kerstin-low` (female, CC0). Avoid the M-AILABS voices (karlsson, ramona, eva_k): their model card only says "see URL" |
| Licence check | Per model card on Hugging Face `rhasspy/piper-voices` (2026-11-19): Thorsten and Kerstin datasets CC0. Piper itself grants no voice licence (`docs/COMMERCIAL_USE.md`); ship each `MODEL_CARD` in `assets/LICENSES.md` |
| Processing | ffmpeg per kind: pitch down and distortion for zombie bosses, radio band and bitcrush for robots (Wachdrohne, Uhrwerk, Koloss), reverb for the Weltzeituhr; Ogg Opus mono, about 5 to 10 KB per line |
| Scope | Bosses: 2 to 3 lines each (rage, special, death), humans and robots only (not ghouls or animals): about 17 bosses × 3 = 50 files, under 0.5 MB |
| Play | `enemySpecial` and `bossRage` events in `src/audio/audio.ts`, at most one line every few seconds per boss, ducking the music |
| Alternative | espeak-ng for robots only (very robotic, GPL tool, output free); or Johannes records the lines himself |
