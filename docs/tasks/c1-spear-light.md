# C1 Spear light attacks: thrust forward [Claude · Opus high]

Status: done (2026-11-17), playtest open. Playtest Johannes, 2026-11-17.

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

## Handover (2026-11-17)
- Looked first: no clip in `anims.glb` or the UAL1/UAL2 packs holds a weapon along the facing (`Punch_Cross` hit yaw 100°, `Melee_Hook` 96–108° left; `Pistol_Shoot`, `Shield_Dash`, `Push_Loop` no better). Clips and sim timing stay; the measured times already match the hand's drive (Punch_Cross hand 0.19→0.28, Melee_Hook 0.20→0.29).
- New thrust grip: `THRUST` + `thrustWeight` + `WeaponRack.aimThrust` in `src/render/weapons.ts`, driven by `HeroView.thrust` (`characters.ts`). During `thrust` attacks the spear turns in the right hand toward the point at full reach on the hit line (facing plus the arc from→to), 4° below level, slides 0.2 m forward; weight rises over the wind-up, holds 0.12 s past the hit, lets go over 0.3 s of clip; a cancel decays over 0.15 s.
- Left hand: grips 0.5 m behind the right hand (`THRUST.spear.grip`), rear hand of a two-handed jab; out of reach in the Melee_Hook lunge it lets go as before.
- Smear: the thrust lance spans from→to only (the spear's path) and runs at the tip's height (`thrustTipY` → `Fx.update`). Hit arc, reach, damage unchanged (tip about 2.7 m at the light hits; hit reach 3.27 m stays from 2D).
- R1 outline sphere radius 2.7 → 3.5 m (tip about 3.45 m out in the Melee_Hook lunge): Johannes' R1 measurement should use this.
- Tools: `clip-sheet` `thrust=<attack>`, `sequence.mjs` honors `PORT`. Proof: `docs/proof/combat/c1-before.png`, `c1-after-light1-2.png`, `c1-after-light3-dash.png`, `c1-game-hit.png`. Unit test `src/render/thrust.test.ts`.
