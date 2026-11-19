# M6b Account and three save slots [Claude · Opus high]

Status: built, playtest open (2026-11-19). Asked by Johannes the same day: sync visible on the title screen, an account with a name, three named slots synced across devices.

## Why three slots
Slot 1: main save across all devices (furthest progress, best gear). Slot 2: kept for fresh characters (new game on the tablet, telemetry of a first run). Slot 3: spare. Telemetry rows carry `slot`.

## Decisions
- Server unchanged (the 2D Apps Script `tools/sync/Code.gs` is a key-value store, one row per key, values chunked at 45k). No sheet or tab per account: a tab per account does not scale (cell and tab limits) and new fields would mean new columns; JSON values grow without schema changes.
- Keys: slot 1 = the account code (old saves are slot 1 with no migration); slots 2, 3 and the account record `{k:'konto',v:1,n,s:[names]}` use codes derived from the account code (`slotCode`, `metaCode` in `src/sync.ts`). Each slot has its own conflict rule, so two devices on different slots never block each other.
- Local: slot 1 keeps `ruinenstadt-berlin.save`, slots 2 and 3 use `.save.2`, `.save.3`; the active slot `ruinenstadt-berlin.slot` is per device. Switching slots reloads the page.
- Code eingeben replaces all three local slots (old ones kept as `.backup`); remote-empty slots are cleared locally so old device progress does not leak into the account.
- Sync starts in the boot (`src/ui/account.ts`), before the game loads. A newer remote save of the active slot is adopted on the title (reload), held during a run.
- Saves carry `dev` (PC, Tablet, Handy) for the slot card.

## Steps
1. Done: slot storage (`src/save.ts`), save format split out of the sim (`src/sim/save-format.ts`), sync per slot plus account record (`src/sync.ts`, tests), shared instance (`src/cloud.ts`), boot start, telemetry `slot`.
2. Done: title screen Konto card, layout A (Johannes 2026-11-19, `docs/mockups/m6b-account-slots.html`): account name, code, state, three slot rows (progress, device, time), ✎ per slot, Umbenennen, Code kopieren, Konto wechseln; Slot löschen per slot. Tapping a slot reloads into it. Compact steps at 620 and 500 px height. Checked with a fake Apps Script at 1280×720, 1195×550, 390×844 (slot switch, uploads of slots 1, 2 and the record).
3. Open: playtest on two devices against the live script (Playtest row in `docs/tasks/pt-hardware-checks.md`).

## Handover
Built: steps 1 and 2. Reused from 2D: Apps Script protocol and sheet, code alphabet, conflict rule. Not tested against the live script or on real devices. The old Optionen row "Online speichern" stays (on/off switch). Names live only in the cloud record: with sync off or on localhost slots show as "Slot N" and cannot be renamed.

## Security note (for a game for others)
The code is the only key: anyone with it can read and overwrite that account. Fine for family; for strangers it would need real login (out of scope).
