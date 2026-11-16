# G1 Weapon identity and build variety [Fable 5.2; Johannes picks the direction first]

Status: done (option C). Decided (Johannes, 2026-11-16): option C. A and B are ideas only (`docs/backlog.md` › Ideas I1, I2), not decided. Goal (Johannes, 2026-11-16): the four base weapons play clearly differently and blessings change how a run plays, as in Hades. This is the main reason to start again.

## Where the game stands (read from the code, not playtested)

| Weapon | Basic attack | Powers | Plays as |
|---|---|---|---|
| Klinge | Fast 3-chain, 130° arc, 2.2 m | Spin around the hero · dash through enemies that recharges on a kill · 5 s of fast crits | In the middle of the pack, always moving |
| Hammer | Slow, 170° arc, every hit stuns, finisher sends a shock ring | Ground slam · 3 s guard with a final blow · leap onto a target | Commit, control space, take hits |
| Speer | Narrow 3.3 m line, lunging finisher | Thrown spear through a line · vault with landing · banner zone (damage, heal, slow) | Keep distance, line enemies up, hold a spot |
| Werfer | Shots, the fourth pierces | Fan of nine · fire field · eight delayed impacts | Kite, never stand still |

The verbs differ. What is thin:

| Gap | Detail |
|---|---|
| Blessings change numbers more than play | Of 50 blessings about 35 are stats or procs that work the same on every weapon. Only the 4 Umbau cards, the 5 duos and a few others (Rammbock, Durchschlag, Kimme und Korn) change what the player does |
| One Umbau per weapon | 2D has one each; a second run with the same weapon offers the same one |
| No choice before the run | The weapon is whatever dropped; the two powers are fixed per weapon kind |
| Enemies do not ask for different answers yet | Three body types with one attack (M12) |

## Options

| | Option | What changes | Size | Risk |
|---|---|---|---|---|
| A | **Blessings on verbs** | Each family gets blessings bound to one verb (Schlag, Finisher, Rolle, Kraft, Ultimativ) that change it: Glut on the finisher = it explodes; Sprint on the Kraft = it resets the dodge; Bollwerk on the Rolle = a short guard after it. About 20 new blessings; the card shows the verb | Large, new design (2D has none of it) | Balance; needs the bot (M14) |
| B | **Weapon variants** | Three variants per weapon that change chain or powers, chosen at run start. 2D already names three per power (`KR` names: Kreissäge, Neonwirbel, Ernteschlacht …) but they only differ in name | Medium | Needs a start screen (M17) |
| C | **More Umbau cards** | Three per weapon instead of one, offered from wave three, one per run. Each changes the basic attack (as Rundumschlag, Dampfhammer, Schrotladung, Wurfspieße do) | Small, 8 new cards | Low |

Decision: C. A and B stay ideas.

## Handover (option C)

| Weapon | 2D card | New in 3D |
|---|---|---|
| Klinge | Rundumschlag | Doppelklinge (two cuts of 60 %) · Sturmklinge (1 m more lunge, +25 % tempo, -15 % damage) |
| Hammer | Dampfhammer | Erdbeben (finisher ring twice as wide, 1 s stun) · Wurfhammer (finisher throws the hammer, 150 %, through 3) |
| Speer | Wurfspieße | Fegestoß (thrusts become wide sweeps, -20 % reach) · Sturmlanze (after a dodge: double damage, +50 % reach) |
| Werfer | Schrotladung | Querschläger (shots jump once, 80 %) · Schnellfeuer (+40 % tempo, -25 % damage, finisher fan of five) |

- One Umbau per run, 22 % per choice from wave three (2D: wave five), picked from the weapon's three. Numbers: `WEAPON.umbau` in `src/data/combat.ts`; rules in `src/sim/player.ts`; tests in `src/sim/blessings.test.ts`.
- Open: own glyphs (the new cards show their weapon's 2D glyph), a hammer model for the thrown hammer (drawn as the spear shot), balance and playtest.

## Done when (whichever option)
Johannes plays two runs with the same weapon and two with different ones and says they played differently; each new rule has a unit test.
