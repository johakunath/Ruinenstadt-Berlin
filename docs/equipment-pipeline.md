# Equipment pipeline

Index of every equipment base and named item with its 3D model, hero look, inventory icon and what is missing.
Rule: every session that touches equipment art, models, icons or effects updates this file in the same PR.
**Plan (2026-11-19): `docs/tasks/wp4-equipment-visuals.md`** decides how every row below gets its model (one weapon model per base, rigid gear built in code, palettes per base, pickups per kind, legendary effects) and in which order. The index stays the status; the task file is the plan.
**Clothing looks (2026-11-19):** built in 3D from the approved mockups (`docs/mockups/wp4-clothes/`), decisions in the task file › Step 2 looks. Talisman, ring and implant stay icon-only. Needs: T = Codex texture T9, E = WP4 step 5 effect, M = Blender piece.
Legend: 3D `model:x` = own weapon model per base (`src/render/weapons.ts`, key from `src/data/weapon-look.ts`); `wear:x` = the look of `WEAR` in `src/data/hero-look.ts` (palette on a hero.glb piece, coat cut, gear parts from `src/render/gear*.ts`; WP4 step 2); `piece:x` = hero.glb node; `none` = nothing in 3D. Hero `yes` = equipping changes the hero mesh, `same` = shows the no-item default, `-` = not shown. Icon `yes/partly/no` compares the painted icon (`src/ui/item-icons.ts`, `assets/inventory/*.webp`) with what the game shows. Needs: M model or piece, I icon re-render, E effect, T texture.

## Facts checked in code (2026-11-18)

| Topic | Finding |
|---|---|
| Bases | 87 `BaseId`s (`src/data/items.ts`); names map to bases in `BASES` (`src/data/item-names.ts`). Set pieces carry their base in `SETS` |
| Weapons (2026-11-19) | One model per base (30) plus 2 set variants (`brech:kiez`, `zwille:spree`), `weaponModel(kind, base, set)`; sheets in `docs/proof/wp4/`. Length per base in `weapon-look.ts` sets reach and damage (D8); damage type per base (D9) |
| Weapon icons (2026-11-19) | Rendered from the models (`node tools/item-icons.mjs`, D10), 32 files incl. I91, I92; rerun after every weapon model change. Painted originals: `git show e2ed157:assets/inventory/<id>.webp` |
| Element (2026-11-19) | Element lights the weapon's glow parts (`ELEMENT_GLOW`, 2.4); without one, neon and legendary bases glow in their signature colour (1.6); else the glow mesh is hidden. No particles yet (step 5) |
| Hero look (2026-11-19, WP4 step 2) | `heroLook` reads `WEAR` per slot (`base:set` first): outfit piece (coat or vest), coat cut (jackets), palette per piece and scarf, shoulder volume, rigid gear parts, hair hidden (Topfhelm). Every Körper, Kopf, Hände and Füße base has its own look; icons rendered from it (`node tools/item-icons.mjs`, `PAGES=wear`). Sheets: `docs/proof/wp4/step2/` |
| Not on the hero | Talisman, ring, implant: painted icons, no 3D (Johannes, 2026-11-19) |
| Ground drops | `src/render/loot.ts`: one instanced crystal in rarity colour, beam for rare and up. Same for every item (backlog P10) |
| Starter | `starterEquipment()` (`src/sim/loadout.ts`): only `Rostige Klinge`, base `rohr`, kind `blade`. No armor, gloves, boots: hero starts in coat, boots, bare hands |
| Legacy | `Holzlatte` (`latte`, I01) and `Rostiges Rohr` exist only in `BASES` for old saves; no drop pool rolls them |
| M18 Wedding (2026-11-21) | One new base (`bestellung`, legendary hammer) and the set Pracht des Ewigen Gasts on five existing bases (`mantel`, `handsch`, `stiefel` with `base:gast` palettes, `feder`, `siegel`); both drop only on `fest` maps (`src/sim/items.ts`). Icons I103 to I106 rendered with `tools/item-icons.mjs`; feather and signet ring keep the plain icons. Proof `docs/proof/m18-wedding/enemies/loot-icons.png` |
| M17 Fernsehturm (2026-11-23) | One new base (`telespargel`, legendary spear, shock). Only Der Zeitwart drops it: for certain until it is in the Kodex, then a third of the time (`killDrops`). Icon I109 rendered from the model |
| Weapon cost (2026-11-19) | 2 meshes (metal, matte), 3 with a glow: 2 or 3 draw calls per pass (was 10); 174 to 830 triangles. `src/render/weapons.test.ts` checks envelope and budget |
| Head, hand, foot, ring legendaries and set pieces (2D #2) | Data, drop tables and powers are ported and tested; only their looks are missing |
| Base clash | `Kettenhemd der Zitadelle` uses base `kette` (same as `Fahrradkette`): icon I42 (bike chain); the chainmail icon I57 sits under key `khemd`, which no base uses |

## Summary

| Slot | Bases | Own 3D model | Changes hero | Icon yes / partly / no |
|---|---|---|---|---|
| Waffe (w) | 31 | 31 + 3 set variants | 31 | 34 / 0 / 0 (rendered) |
| Körper (a) | 12 (+ Kettenhemd on `kette`) | 17 looks (2 pieces, cut, palettes, gear) | 17 | 17 / 0 / 0 (rendered) |
| Kopf (h) | 9 | 10 hats (gear) | 10 | 10 / 0 / 0 (rendered) |
| Hände (g) | 6 | 7 looks (glove piece, palettes, gear) | 7 | 7 / 0 / 0 (rendered) |
| Füße (f) | 6 | 8 looks (2 pieces, palettes, gear) | 8 | 8 / 0 / 0 (rendered) |
| Talisman (t) | 9 | 0 | 0 | n/a |
| Ring (r) | 8 | 0 | 0 | n/a |
| Implantat (i) | 7 | 0 | 0 | n/a |
| Total | 88 | 31 weapon models + 3 set variants, 42 looks | 73 | |

## Index

| Name | Base | Slot | Family | 3D | Hero | Icon | Icon matches | Needs | P |
|---|---|---|---|---|---|---|---|---|---|
| Rostige Klinge | rohr | w | starter (also normal) | model:rohr | yes | I88 | yes: rendered from the model | none | 1 |
| Holzlatte | latte | w | legacy | model:latte | yes | I01 | yes: rendered from the model | none (not dropped) | 4 |
| Stahlklinge | stahl | w | normal | model:stahl | yes | I89 | yes: rendered from the model | none | 2 |
| Machete | machete | w | normal | model:machete | yes | I04 | yes: rendered from the model | none | 2 |
| Hackmesser | brech | w | normal | model:brech | yes | I90 | yes: rendered from the model | none | 2 |
| Vorschlaghammer | vorschlag | w | normal | model:vorschlag | yes | I06 | yes: rendered from the model | none | 2 |
| Pflasterhammer | pflaster | w | normal | model:pflaster | yes | I07 | yes: rendered from the model | none | 2 |
| Rohrzange | zange | w | normal | model:zange | yes | I08 | yes: rendered from the model | none | 2 |
| Jagdzwille | zwille | w | normal | model:zwille | yes | I09 | yes: rendered from the model | none | 2 |
| Nagelwerfer | nagel | w | normal | model:nagel | yes | I10 | yes: rendered from the model | none | 2 |
| Steinschleuder | stein | w | normal | model:stein | yes | I11 | yes: rendered from the model | none | 2 |
| Rohrspeer | rspeer | w | normal | model:rspeer | yes | I12 | yes: rendered from the model | none | 2 |
| Fahnenstange | fahne | w | normal | model:fahne | yes | I13 | yes: rendered from the model | none | 2 |
| Harpune | harpune | w | normal | model:harpune | yes | I14 | yes: rendered from the model | none | 2 |
| Leuchtröhre | leucht | w | neon | model:leucht | yes | I59 | yes: rendered from the model | none | 4 |
| Boxenhammer | boxh | w | neon | model:boxh | yes | I60 | yes: rendered from the model | none | 4 |
| Neonflinte | neonfl | w | neon | model:neonfl (assault rifle, 2 hands, pistol clips) | yes | I61 | yes: rendered from the model | none | 4 |
| Mikroständer | mikro | w | neon | model:mikro | yes | I62 | yes: rendered from the model | none | 4 |
| Sichel | sichel | w | GDR | model:sichel | yes | I71 | yes: rendered from the model | none | 4 |
| Werkhammer | werkh | w | GDR | model:werkh | yes | I72 | yes: rendered from the model | none | 4 |
| Aufziehwerfer | aufzieh | w | GDR | model:aufzieh | yes | I73 | yes: rendered from the model | none | 4 |
| Zeigerlanze | zeiger | w | GDR | model:zeiger | yes | I74 | yes: rendered from the model | none | 4 |
| Fernsehturm-Splitter | turm | w | legendary | model:turm | yes | I15 | yes: rendered from the model | E | 3 |
| Klinge der Zitadelle | zitklinge | w | legendary | model:zitklinge | yes | I51 | yes: rendered from the model | E | 3 |
| Mauerbrecher | mauer | w | legendary | model:mauer | yes | I16 | yes: rendered from the model | E | 3 |
| Plattenbrecher | pbrecher | w | legendary | model:pbrecher | yes | I52 | yes: rendered from the model | E | 3 |
| Die Letzte Bestellung | bestellung | w | legendary (only on `fest` maps, M18) | model:bestellung (emerald shaft, gold wish-lamp head with a ruby glow band, two tea glasses on chains) | yes | I103 | yes: rendered from the model | E (tea splash on every third hit) | 3 |
| Telespargel | telespargel | w | legendary (only from Der Zeitwart, M17) | model:telespargel (red and white banded antenna shaft, the steel sphere with a lit window ring and a brass gear rim as the guard, a red beacon at the point) | yes | I109 | yes: rendered from the model | E (Zeitzeichen: every twelfth hit stops every enemy within 5 m for 1.5 s; a shock ring) | 3 |
| Zorn der Ringbahn | ring | w | legendary | model:ring | yes | I32 | yes: rendered from the model | E | 3 |
| Krähenschleuder | kraehe | w | legendary | model:kraehe | yes | I53 | yes: rendered from the model | E | 3 |
| Speer der Siegessäule | siegsp | w | legendary | model:siegsp | yes | I56 | yes: rendered from the model | E | 3 |
| Morgenstern der Zitadelle | morgen | w | set zit | model:morgen | yes | I48 | yes: rendered from the model | E | 3 |
| Hackmesser der Kiezwache | brech | w | set kiez | model:brech:kiez | yes | I91 | yes: rendered from the model | E | 3 |
| Zwille des Spreegeists | zwille | w | set spree | model:zwille:spree | yes | I92 | yes: rendered from the model | E | 3 |
| Rohrzange des Tunnelläufers | zange | w | set tunnel | model:zange:tunnel | yes | I101 | yes: rendered from the model | E | 3 |
| Lederjacke | leder | a | normal | wear:leder | yes | I17 | yes: rendered from the look (denim, KA B2) | - | 2 |
| Arbeitsmantel | mantel | a | normal | wear:mantel | yes | I18 | yes: rendered from the look | none | 2 |
| Schutzweste | weste | a | normal | wear:weste | yes | I19 | yes: rendered from the look | none | 2 |
| Feuerwehrjacke | feuer | a | normal | wear:feuer | yes | I20 | yes: rendered from the look | none | 2 |
| BVG-Uniform | bvg | a | normal | wear:bvg | yes | I21 | yes: rendered from the look | none | 2 |
| Regenponcho | poncho | a | neon | wear:poncho (own `a_poncho` piece, B1, 2026-11-22) | yes | I63 | yes: rendered from the look | none | 4 |
| Kabelmantel | kmantel | a | neon | wear:kmantel | yes | I64 | yes: rendered from the look | none | 4 |
| Blaumann | blaumann | a | GDR | wear:blaumann | yes | I75 | yes: rendered from the look | none | 4 |
| Mantel des letzten Späti | spaeti | a | legendary | wear:spaeti | yes | I49 | yes: rendered from the look (patchwork, KA B2) | E | 3 |
| Panzer vom Tempelhofer Feld | panzer | a | legendary | wear:panzer | yes | I50 | yes: rendered from the look | E | 3 |
| Mantel der Rattenmutter | rattenmantel | a | legendary | wear:rattenmantel | yes | I54 | yes: rendered from the look | T, E | 3 |
| Rüstung des Zitadellenritters | ritter | a | legendary | wear:ritter | yes | I55 | yes: rendered from the look | E | 3 |
| Weste der Kiezwache | weste | a | set kiez | wear:weste:kiez | yes | I93 | yes: rendered from the look | none | 3 |
| Mantel des Spreegeists | mantel | a | set spree | wear:mantel:spree | yes | I94 | yes: rendered from the look | none | 3 |
| Kettenhemd der Zitadelle | kette | a | set zit | wear:kette:zit | yes | I57 | yes: rendered from the look (chainmail, KA B2) | - | 3 |
| Mantel des Tunnelläufers | mantel | a | set tunnel | wear:mantel:tunnel | yes | I98 | yes: rendered from the look | none | 3 |
| Kaftan des Ewigen Gasts | mantel | a | set gast (M18) | wear:mantel:gast (emerald coat, ruby hem and trousers, gold cuffs and buttons, plain belt) | yes | I104 | yes: rendered from the look | none | 3 |
| Bauhelm | helm | h | normal | wear:helm | yes | I22 | yes: rendered from the look | none | 2 |
| Schiebermütze | schieber | h | normal | wear:schieber | yes | I23 | yes: rendered from the look | none (T9 cell built 2026-11-24) | 2 |
| Wollmütze | muetze | h | normal | wear:muetze | yes | I24 | yes: rendered from the look | none (T9 cell built 2026-11-24) | 2 |
| Gasmaske | maske | h | normal | wear:maske | yes | I25 | yes: rendered from the look | none | 2 |
| Neonbrille | nbrille | h | neon | wear:nbrille | yes | I65 | yes: rendered from the look | E | 4 |
| Strohhut | stroh | h | GDR | wear:stroh | yes | I76 | yes: rendered from the look | none (T9 cell built 2026-11-24) | 4 |
| Pickelhaube des Hauptmanns | pickel | h | legendary | wear:pickel | yes | I78 | yes: rendered from the look | E | 3 |
| Helm der Kiezwache | kiezhelm | h | set kiez | wear:kiezhelm | yes | I79 | yes: rendered from the look | none | 3 |
| Topfhelm der Zitadelle | topfhelm | h | set zit | wear:topfhelm | yes | I83 | yes: rendered from the look | none | 3 |
| Stirnlampe des Tunnelläufers | nbrille | h | set tunnel | wear:nbrille:tunnel | yes | I99 | yes: rendered from the look | none | 3 |
| Arbeitshandschuhe | handsch | g | normal | wear:handsch | yes | I26 | yes: rendered from the look | none | 2 |
| Boxbandagen | bandage | g | normal | wear:bandage | yes | I27 | yes: rendered from the look | none | 2 |
| Schweißerhandschuhe | schweiss | g | normal | wear:schweiss | yes | I28 | yes: rendered from the look | none | 2 |
| Gartenhandschuhe | gartenh | g | GDR | wear:gartenh | yes | I77 | yes: rendered from the look | none | 4 |
| Fäuste des Kiezboxers | kiezbox | g | legendary | wear:kiezbox | yes | I85 | yes: rendered from the look | E | 3 |
| Handschuhe der Kiezwache | kiezhand | g | set kiez | wear:kiezhand | yes | I80 | yes: rendered from the look | none | 3 |
| Handschuhe des Ewigen Gasts | handsch | g | set gast (M18) | wear:handsch:gast (gold gloves, ruby cuffs) | yes | I105 | yes: rendered from the look | none | 3 |
| Turnschuhe | turnsch | f | normal | wear:turnsch | yes | I29 | yes: rendered from the look | none | 2 |
| Arbeitsstiefel | stiefel | f | normal | wear:stiefel | yes | I30 | yes: rendered from the look | none | 2 |
| Gummistiefel | gummi | f | normal | wear:gummi | yes | I31 | yes: rendered from the look | none | 2 |
| Stiefel des Schaffners | schaffner | f | legendary | wear:schaffner | yes | I86 | yes: rendered from the look | E | 3 |
| Stiefel des Spreegeists | spreestief | f | set spree | wear:spreestief (own `f_wickel` piece: Quaternius Ranger boots, LA3, 2026-11-22) | yes | I81 | yes: rendered from the look | none | 3 |
| Eisenstiefel der Zitadelle | eisenstief | f | set zit | wear:eisenstief | yes | I84 | yes: rendered from the look | none | 3 |
| Stiefel des Tunnelläufers | stiefel | f | set tunnel | wear:stiefel:tunnel | yes | I100 | yes: rendered from the look | none | 3 |
| Stiefel des Ewigen Gasts | stiefel | f | set gast (M18) | wear:stiefel:gast (ruby boots, gold soles) | yes | I106 | yes: rendered from the look | none | 3 |
| Spreekiesel | kiesel | t | normal | none | - | I39 | n/a | - | 2 |
| Mauerstück | stueck | t | normal | none | - | I40 | n/a | - | 2 |
| Rabenfeder | feder | t | normal | none | - | I41 | n/a | - | 2 |
| Fahrradkette | kette | t | normal | none | - | I42 | n/a | - | 2 |
| Kräuterbeutel | beutel | t | normal | none | - | I43 | n/a | - | 2 |
| Currywurst-Abzeichen | abzeichen | t | normal | none | - | I44 | n/a | - | 2 |
| Herz der Spree | herz | t | legendary | none | - | I45 | n/a | E | 3 |
| Auge des Fernsehturms | auge | t | legendary | none | - | I47 | n/a | E | 3 |
| Wappen der Zitadelle | wappen | t | set zit | none | - | I46 | n/a | - | 3 |
| Schlüsselbund des Tunnelläufers | kette | t | set tunnel | none | - | I102 | yes: painted (local FLUX, K4) | none | 3 |
| Abzeichen der Kiezwache | abzeichen | t | set kiez | none | - | I95 | yes: painted (local FLUX, K4) | none | 3 |
| Kiesel des Spreegeists | kiesel | t | set spree | none | - | I96 | yes: painted (local FLUX, K4) | none | 3 |
| Feder des Ewigen Gasts | feder | t | set gast (M18) | none | - | I107 | yes: painted (local FLUX, K5) | none | 3 |
| Siegelring | siegel | r | normal | none | - | I33 | n/a | - | 2 |
| Totenkopfring | totenk | r | normal | none | - | I34 | n/a | - | 2 |
| Schraubenmutter | mutter | r | normal | none | - | I35 | n/a | - | 2 |
| Drahtring | draht | r | normal | none | - | I36 | n/a | - | 2 |
| Ehering | ehe | r | normal | none | - | I37 | n/a | - | 2 |
| Kupferring | kupfer | r | normal | none | - | I38 | n/a | - | 2 |
| Ring der Weltzeituhr | weltuhr | r | legendary | none | - | I87 | n/a | E | 3 |
| Ring des Spreegeists | spreering | r | set spree | none | - | I82 | n/a | - | 3 |
| Siegelring des Ewigen Gasts | siegel | r | set gast (M18) | none | - | I108 | yes: painted (local FLUX, K5) | none | 3 |
| Neonauge | nauge | i | neon | none | - | I66 | n/a | - | 4 |
| Zielchip | zchip | i | neon | none | - | I67 | n/a | - | 4 |
| Kabelarm | karm | i | neon | none | - | I58 | n/a: shared with Bassprediger | I | 4 |
| Reflexkoppler | reflex | i | neon | none | - | I68 | n/a | - | 4 |
| Bassherz | bherz | i | neon | none | - | I69 | n/a | - | 4 |
| Nanopumpe | npumpe | i | neon | none | - | I70 | n/a | - | 4 |
| Arm des Basspredigers | bassarm | i | legendary | none | - | I97 | yes: painted (local FLUX, K4) | E | 3 |

Icon judgements are from the 128 px icons against the model code and the piece names; individual item looks still need comparison. The shared H1 coat, vest, boots, sneakers, gloves and scarf have [painted albedos and review captures](proof/h1-hero/step6/README.md). Item-specific `T` entries track variants beyond those shared textures.

## Priorities (owner order)

Order and scope are now set in `docs/tasks/wp4-equipment-visuals.md` › D7 (all 30 weapon bases in step 1, both built districts' families included). The list below stays as the source of the per-item ideas.

1. **P1 starter.** Rostige Klinge: re-render I88 from the blade model, or give `rohr` its own model; the unused `pipe` model in `weapons.ts` can go or become the Holzlatte. The starting look (coat, boots, bare hands) has no icon.
2. **P2 normal Köpenick drops.** Own weapon models per base, starting with mismatches (Rohrzange, Steinschleuder, Hackmesser, Machete). Armor: a jacket piece (Lederjacke, Feuerwehrjacke, BVG-Uniform, by colour first). First hat pieces (`h_` node, hides `hair`): Bauhelm, Schiebermütze, Wollmütze, Gasmaske. Boxbandagen as wraps. 2D lists 14 outfits, 6 hats, 4 gloves, 3 boots in `tools/build_hero.py` (reference).
3. **P3 legendaries and sets.** Each needs a look and an effect (cost stated for Leistung, constant light count):
   - Fernsehturm-Splitter: glass shard blade, faint blue edge glow, ember flash on crit.
   - Klinge der Zitadelle: crackle of shock light along the edge.
   - Mauerbrecher: concrete head, green acid drip every fourth hit.
   - Plattenbrecher: slab head, dust puff on crit kill.
   - Zorn der Ringbahn: S-Bahn orange band, spark between the prongs.
   - Krähenschleuder: feathers on the fork, green shot trail.
   - Speer der Siegessäule: gold tip, gold glint per thrust.
   - Mantel des letzten Späti: warm patch glow, bottle caps.
   - Panzer vom Tempelhofer Feld: plate piece, white flash on block.
   - Mantel der Rattenmutter: fur coat, green sheen when hit.
   - Rüstung des Zitadellenritters: plate piece, dust ring after sprint.
   - Pickelhaube des Hauptmanns: hat piece, spike glint.
   - Fäuste des Kiezboxers: red boxing glove piece, stun flash.
   - Stiefel des Schaffners: tall boots, blue sprint trail.
   - Ring der Weltzeituhr: dial glint at the hand on the guaranteed crit.
   - Herz der Spree: teal chest pulse when it saves the hero.
   - Auge des Fernsehturms: cyan pulse on elite hits.
   - Arm des Basspredigers: magenta pulse along the arm every fifth hit; own icon.
   - Sets: one signature colour per set on every piece (Kiezwache blue and orange like I79/I80, Spreegeist green, Zitadelle iron); fix Kettenhemd to I57 and a chainmail piece.
4. **P4 neon and GDR families.** Neon weapons need emissive models (tube, speaker, gun); poncho and Kabelmantel pieces; Neonbrille and Strohhut hats.

## Icons from 3D renders

Not part of WP4: there the models follow the painted icons, and Codex repaints the few that are wrong (WP4 step 1e). Rendering icons from the models stays open question Q5.

- Recommendation: yes, render icons from the in-game models for every item whose look is code-built; only a render of the shipped model guarantees that icon and hero match.
- Build `tools/item-icons.mjs` (not implemented): like `tools/enemy-sheet.mjs`, Playwright plus a page `tools/item-icons.html` that builds `WeaponRack` models or hero pieces offscreen, puts each on a slow turntable at a fixed 3/4 angle, lights it with a 3-point rig (warm key, cool fill, rim), transparent background, and writes `assets/inventory/<id>.webp` at 256 px. Cloud SwiftShader is enough; no GPU timing involved.
- The H1 inventory portrait already renders the 3D hero with the game renderer, so the code path for an offscreen render exists.
- Keep painted icons only where the 3D model is final and matches (today Stahlklinge, Vorschlaghammer, Jagdzwille, Rohrspeer, coat, vest, work gloves, both boots); slots with no 3D (head until hats exist, talisman, ring, implant) keep painted icons.
- Re-render after each model change, in the same PR; the icon map stays in `src/ui/item-icons.ts`.

## Route per job

| Job | Route |
|---|---|
| Weapon and prop models | Code: procedural geometry in TypeScript like `src/render/weapons.ts`, merged per material |
| Colours and simple surfaces | Code: vertex colours, code-painted canvas textures (`src/render/paint.ts`) |
| UI glyphs, set marks | Code: SVG |
| Effects (glow, trails, flashes) | Code: emissive parts, instanced sprites on `FX_LAYER`, no new lights |
| Painted texture images, painted icons | Local first (FLUX.2 klein on the PC, `docs/local-ai-assets.md` W1 to W3), Codex as fallback; Claude does the performance integration (`docs/asset-pipeline.md`) |
| Static pickups and props with organic detail (P10 pickups per item kind) | Image-to-3D (Pixal3D) plus Blender clean-up (`docs/local-ai-assets.md` W4 to W6) |
| Rigid hero equipment (hats, plates, cuffs, talisman, ring, implants) | Code: parts skinned rigidly to the bones at equip time and merged into one gear mesh (`src/render/gear.ts`, WP4 D2) |
| Colours per item base on existing pieces | Code: palette that recolours the piece's vertex colours (WP4 D2) |
| Hero clothing shells that deform (jacket with sleeves, poncho), retargeting | Blender on the PC, only for skinning to the UAL skeleton, rebinding the hero mesh (`npm run assets:hero`, `tools/blender/`) or retargeting animations |
| Converting CC0 packs | Node: `tools/build-creatures.mjs` (FBXLoader plus glTF export, gltf-transform). The owner found Blender slow; use Node where no skinning work is needed |
