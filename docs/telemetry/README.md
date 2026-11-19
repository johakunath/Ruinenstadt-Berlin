# Telemetry backup

`backup-2026-11-19.json` is a lossless copy of the Google Sheet tab "Telemetrie" (columns A:Q) of the spreadsheet "Ruinenstadt Sync (live)", taken on 2026-11-19. The "Saves" tab is not included (private save data).

- Format: JSON array, one object per sheet row: `empfangen` (col A), `spieler` (col B), `run` (col Q parsed as JSON), `cols` (the sheet columns C..P by header name: gespielt, v, tag, d, dn, df, m, end, welle, sek, lvl, dev, inp, fps). All values are the original sheet strings.
- Rows: 95 data rows (sheet rows 2 to 96, header excluded). 70 are 2D rows (`v` does not start with "3d-"), 25 are 3D rows (`v` starts with "3d-").
- Duplicates: 2 rows are marked `"dup": true` (same `spieler` and identical `json` as an earlier row, from re-sent queues). They are kept.
- Player ids (`spieler`) are anonymous random ids generated in the browser; no names or accounts.
- Reader: `tools/telemetry.mjs` does not exist in the repo yet, so there is nothing to check this file against. If one is added and it expects an array of run records, feed it `rows.map(r => r.run)`; this file is not a plain array of runs as is.
