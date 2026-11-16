# M6 Save, wave checkpoint, difficulty [Claude]

Status: done (PR #16)

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

## Cloud save (Q6, same PR)
- `src/sync.ts` ports the 2D protocol (`js/sync.js`, `tools/sync/Code.gs` in the 2D repo): `get`/`put` with optimistic concurrency, code `XXXX-XXXX`, auto-start on public games, Optionen row (Kopieren, Code eingeben, Aus). The server stores any JSON string under the code, so the same sheet and script serve 2D and 3D; a 3D code typed into 2D is rejected there (no `upg`/`eq`).
- Rules: browser copy stays primary; push 3 s after a save and when the tab hides; a push that finds a newer remote write is refused, the device stops pushing (`conflict`) and the next load adopts the remote save and keeps the local one in `ruinenstadt-berlin.save.backup`. Remote wins at startup only if its `t` is newer than the local save. Adoption = write storage + reload, never mid-run.
- Off on localhost, automated browsers and debug starts. Unit tests use an in-memory server; nothing was written to the live sheet.
- Open: playtest on two devices against the live script; the 2D "more progress" guard (v0.84) is replaced by save time plus the backup, revisit if a win is ever lost; stale-tab conflicts show only as text in Optionen (no toast).
