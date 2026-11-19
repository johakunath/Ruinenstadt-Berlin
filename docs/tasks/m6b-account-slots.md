# M6b Account and three save slots [Claude · Opus high]

Status: in progress (2026-11-19). Asked by Johannes the same day: sync visible on the title screen, an account with a name, three named slots synced across devices.

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
2. Open: title screen UI after Johannes picks mockup A or B (`docs/mockups/m6b-account-slots.html`): account name, code, state, three slot cards, rename, Code eingeben, Slot löschen per slot.
3. Open: playtest on two devices against the live script (row in `docs/tasks/pt-hardware-checks.md`).

## Security note (for a game for others)
The code is the only key: anyone with it can read and overwrite that account. Fine for family; for strangers it would need real login (out of scope).
