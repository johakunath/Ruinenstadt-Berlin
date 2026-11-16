# M6 Save, wave checkpoint, difficulty [Claude]

Status: done (PR pending)

## Goal
A reload (tab killed, browser switch) resumes at the last wave (B1). Versioned save, no 2D import. Difficulty choice.

## Reused from 2D
`DIFF` in `js/data.js` (Leicht hp .7, dmg .6; Normal 1.75 / 1.45; Schwer 2.15 / 1.75, luck +4, scrap x1.3), applied as ratios to Normal because 3D tuning already has the Normal numbers built in.

## Handover
- `src/sim/save.ts` (pure): `SaveV1 { v, difficulty, profile{inventory,equipment,statContext}, run|null }`, `snapshot`, `parseSave` (null for unknown, newer or damaged), `simFromSave`. `src/save.ts` is the localStorage wrapper. Any format change bumps `SAVE_VERSION`; older saves are ignored, not migrated.
- Checkpoint = event `checkpoint`, pushed by the director when a wave ends (resume phase `pause`, wave = the next one) and when an encounter is won (resume phase `travel`). Saved: rng state, hp, position, loot counters, broken props, Späti visits, landed ground drops. Also saved when the inventory closes during travel; during waves gear changes wait for the next checkpoint (resuming replays the wave from the saved rng and ids).
- Death does not save; Nochmal keeps the existing zone restart. Victory saves the profile with `run: null`.
- Title: Weiter (only with a checkpoint on the same map), Neu (keeps gear, drops the run), difficulty row (locked while a checkpoint exists, since the run keeps its difficulty). Debug starts (`?autostart`, `?at`, `?stress`, `?mapscale`) never read or write the save.
- Not saved yet: Späti camp, stash, upgrades (M13), blessings and powers (M8): add them to `SaveProfile` then.
- Tests: `src/sim/save.test.ts`, `e2e/save.spec.ts`. Difficulty balance numbers are unplayed: playtest on the Tab S9.
