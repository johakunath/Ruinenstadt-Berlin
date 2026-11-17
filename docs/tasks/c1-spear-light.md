# C1 Spear light attacks: thrust forward [Claude · Opus high]

Status: open. Playtest Johannes, 2026-11-17.

## Finding
The spear light attacks look like a throw to the front, but the spear stays mostly horizontal pointing to her left; only the light smear goes forward. Pose and hit arc disagree.

## Source
- `src/data/combat.ts` spear block (light1/2 on `Punch_Cross`, light3/dash on `Melee_Hook`), `src/render/weapons.ts` (spear model, `LEFT_GRIP`), `src/render/fx.ts` thrust smear.
- 2D: spear attack drawing in `js/art.js` / `js/combat.js` for intent (straight jab along facing).
- Skill: `.claude/skills/combat-animation/SKILL.md`.

## Scope
1. Look first: `node tools/clip-sheet.mjs out.png "clip=Punch_Cross&weapon=spear"` and the other thrust candidates in `anims.glb`; measure with `tools/clip-swing.mjs`.
2. Fix so the spear tip points along facing at `clipHit`: either a better clip, or a weapon-attachment rotation for thrust frames (two-hand grip via `LEFT_GRIP` IK), or both.
3. Re-time windup/hit to the chosen clip; smear follows the tip.

## Done when
Clip sheet in `docs/proof/combat/` shows the tip forward at the hit frame for light1–3 and dash; `npm run check` green.
