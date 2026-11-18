# Q1 Three quality levels [Claude · Fable high: contents after the measurements; Claude · Opus high: build]

Status: backlog (Johannes, 2026-11-18). Do not build before the checks 1 to 4 in `docs/tasks/pt-hardware-checks.md` are answered: they decide what the lowest level has to give up.

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
