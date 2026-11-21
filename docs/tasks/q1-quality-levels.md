# Q1 Three quality levels [Claude · Fable high: contents after the measurements; Claude · Opus high: build]

Status: built 2026-11-20 (Johannes asked for it after the review, before checks 1 to 4); the lowest level's contents are a first guess, Johannes checks on the phone and Tab S9 (`pt-hardware-checks.md`).

## Built (2026-11-20)
| Level | Contents (`src/render/profile.ts`) | Default on |
|---|---|---|
| Qualität | Unchanged | PC |
| Ausgewogen | The former Leistung; shadow map every 2nd frame (counted in frames now), dynamic resolution down to 0.75 | Tablets (coarse pointer, short screen side ≥ 500 CSS px) |
| Leistung | Reworked 2026-11-21 (Tab S9 CPU-bound, telemetry `analysis-2026-11-21.md`): pixel ratio 1.25, no outline pre-pass (the ink reads the beauty depth, silhouettes only), caster-box shadows every 3rd frame, bloom at half size, reduced animation from 6 m, 30 embers, dynamic resolution down to 0.8 | Phones and tablets (default on touch since 2026-11-21) |

A stored `leistung` from before (no `pv: 2` in the options) loads as Ausgewogen. Dynamic resolution (`src/render/dyn-res.ts`) judges the mean of half-second windows against the frame cap (60 or 30 with Akkusparen), steps down 0.1 after 2 s late and up 0.05 after 6 s on time; a window whose CPU time (sim + render) is over 70 % of the interval counts as on time, since fewer pixels cannot help a CPU-bound frame (2026-11-21). On Ausgewogen at the lowest scale, 20 s under 40 fps show one hint per session. Not built: less decoration on Leistung (backlog P38).

Cloud counts (`tools/passes.mjs`-style, mean of 4 frames, seed 7): Köpenick start Qualität 458 calls / 348k triangles (494k before the crate fix), Ausgewogen 358 / 279k (old Leistung 455 / 494k), Leistung 281 / 236k; Xhain start Ausgewogen 294 / 168k (old Leistung 378 / 553k), Leistung 238 / 145k.

## Idea (Johannes)
| Level | For | Today |
|---|---|---|
| Qualität | PC (default there) | `qualitaet` in `src/render/profile.ts` |
| Ausgewogen (today's Leistung, renamed) | Tablet, notebook (default on coarse pointers) | `leistung` |
| Leistung (new, lowest) | Low fps or a hot device: no or very cheap shadows, lower resolution, less decoration | does not exist |

## Recommendation (Fable, 2026-11-18)
| Point | Rule |
|---|---|
| Proxy passes (P1b) | Not a quality setting: the picture is identical. They go into every level and are the main lever against draw calls |
| Shadows on the lowest level | Caster boxes only (`?shadows=boxes`, built as a test switch) or no shadow map at all with blob shadows; decide with check 3 |
| Shadow map rate | The game still draws 60 frames; only the shadow map is refreshed less often. On a 60 fps cap the even steps are 60, 30 and 20 per second; 40 would alternate fresh and stale frames and make the hero's shadow stutter. So: middle level every frame or 30 (check 4 decides), lowest level 30 or 20 |
| Resolution | Lowest level: pixel ratio 1, pre-pass at 0.5, bloom off or half size. Akkusparen (30 fps cap) stays its own switch: frame rate is a preference, not a quality level |
| Less street detail | Only decoration without a collider may differ per level (ground scatter, litter, ivy and graffiti cards, balcony life, glow halos, weather particles, embers). Props with colliders, lots and lights come from `src/data` and the sim; they must be the same on every level, or balance, the bot and saved runs differ per setting |
| Stored option | A saved `leistung` must load as the middle level (same picture as before the rename) |
| Suggestion to the player | Optional: after about 20 s under 40 fps offer one line "Auf Leistung wechseln?" |

## Not in scope
The contents of the lowest level before the measurements; any change to the sim or map data per level.
