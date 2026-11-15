# S1 Sound port [Codex]

Status: open. Independent of M3 to M8; runs any time.

## Goal

Replace the gate 1 placeholder sounds with the 2D synthesized sounds and music. No audio files.

## Source (read only)

`johakunath/Ruinenstadt`, `js/audio.js` in full (81 lines): `initAudio`, `noise`, `tone`, `mal`, `BELL`, `fxRender`, `fxBuf`, `fxPlay`, `SFX`, `sfx`, `setMute`, `CHS`, `MEL`, `startMusic`, `chord`, `stopMusic`, `setEco`. Callers: `grep -n "sfx('" js/*.js` shows which game moment uses which sound.

## Target

| File | Content |
|---|---|
| `src/audio/sfx.ts` | 2D recipes typed: `SfxId` union of every `SFX` key, render and play helpers (room reverb, compressor, three takes per effect, offline pre-render as in 2D) |
| `src/audio/music.ts` | `CHS`, `MEL`, start, stop, chord |
| `src/audio/audio.ts` | `GameAudio` keeps its public API (`start`, `setVolume`, event handling) and plays the ported sounds |
| `src/ui/ui.ts`, `src/options.ts` | Options: Musik an/aus next to the volume slider |

## Event mapping

| Sim event (`src/sim/types.ts`) | 2D sound |
|---|---|
| `swing` | `swing`, `heavy` for the finisher weight |
| `hit` | 2D hit sound on the damage step (keep the current timing); `kill` when `killed` |
| `dodge` | `dash` |
| `playerHit` | `hurt` |
| `playerDie` | 2D death sound (see `die` in `js/combat.js`) |
| `encounterStart`, `waveStart` | `horn` |
| `encounterClear`, `zoneClear` | `bell`; `heal` when `heal > 0` |
| `victory` | `win` |

Sounds without an event yet (`coin`, `pick`, `legend`, `zap`, `boom`, `ignite`, `spit`, `wood`, `crash`, `pop`, `sling`, `spin`, `lvl`, `ui`, `beat`) are ported and exported for M4 to M8; add a one-line table in the PR saying which 2D moment uses each.

## Steps

1. Read `CLAUDE.md`, `docs/workflow.md`, `src/audio/audio.ts`, `src/main.ts` (event loop).
2. Port recipes with values unchanged. `Math.random` is fine in `src/audio` (not sim).
3. `setEco` maps to the Leistung profile (fewer takes or no reverb, as in 2D).
4. Keep enemy growl/wind-up sounds from gate 1 until S2.
5. `npm run check`, then `npm run build` and `npm run e2e`.

## Done when

Every event above plays its 2D sound; volume and Musik option work; checks green.

## Not in scope

Enemy and boss voices (S2, S3), new sounds, balance.

## Questions

None yet.
