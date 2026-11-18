# Equipment pipeline

Index of every equipment base and named item with its 3D model, hero look, inventory icon and what is missing.
Rule: every session that touches equipment art, models, icons or effects updates this file in the same PR.
Legend: 3D `kind:blade` = shared weapon kind model (`src/render/weapons.ts`, `weaponModel` ignores the base); `piece:x` = hero.glb node from `src/data/hero-look.ts`; `none` = nothing in 3D. Hero `yes` = equipping changes the hero mesh, `same` = shows the no-item default, `-` = not shown. Icon `yes/partly/no` compares the painted icon (`src/ui/item-icons.ts`, `assets/inventory/*.webp`) with what the game shows. Needs: M model or piece, I icon re-render, E effect, T texture.

## Facts checked in code (2026-11-18)

| Topic | Finding |
|---|---|
| Bases | 87 `BaseId`s (`src/data/items.ts`); names map to bases in `BASES` (`src/data/item-names.ts`). Set pieces carry their base in `SETS` |
| Weapons | 4 kind models (`blade`, `hammer`, `spear`, `sling`) plus an unused `pipe`. No base has its own model |
| Element | Weapons with an element light one emissive strip (`ELEMENT_GLOW`). Legendaries with `LEGENDARY_ELEMENTS` get it; no legendary has its own glow, particles or mesh |
| Hero look | `heroLook`: armor `mantel`/`weste` own, `leder`/`blaumann` → vest, every other armor and no armor → coat. Any glove → `g_handsch`. Feet `turnsch` own, else `stiefel`. `hat` is always `null` (no `h_` piece) |
| Not on the hero | Head, talisman, ring, implant: nothing in 3D |
| Ground drops | `src/render/loot.ts`: one instanced crystal in rarity colour, beam for rare and up. Same for every item (backlog P10) |
| Starter | `starterEquipment()` (`src/sim/loadout.ts`): only `Rostige Klinge`, base `rohr`, kind `blade`. No armor, gloves, boots: hero starts in coat, boots, bare hands |
| Legacy | `Holzlatte` (`latte`, I01) and `Rostiges Rohr` exist only in `BASES` for old saves; no drop pool rolls them |
| Base clash | `Kettenhemd der Zitadelle` uses base `kette` (same as `Fahrradkette`): icon I42 (bike chain); the chainmail icon I57 sits under key `khemd`, which no base uses |

## Summary

| Slot | Bases | Own 3D model | Changes hero | Icon yes / partly / no |
|---|---|---|---|---|
| Waffe (w) | 30 | 0 (4 kind models) | 30 (by kind only) | 4 / 15 / 11 |
| Körper (a) | 12 (+ Kettenhemd on `kette`) | 2 pieces | 3 (vest); 1 same | 2 / 3 / 8 |
| Kopf (h) | 9 | 0 | 0 | n/a |
| Hände (g) | 6 | 1 piece (generic) | 6 (all one glove) | 1 / 3 / 2 |
| Füße (f) | 6 | 2 pieces | 1 (`turnsch`); 1 same | 2 / 4 / 0 |
| Talisman (t) | 9 | 0 | 0 | n/a |
| Ring (r) | 8 | 0 | 0 | n/a |
| Implantat (i) | 7 | 0 | 0 | n/a |
| Total | 87 | 0 item models, 5 hero pieces | 40 | |

## Index

| Name | Base | Slot | Family | 3D | Hero | Icon | Icon matches | Needs | P |
|---|---|---|---|---|---|---|---|---|---|
| Rostige Klinge | rohr | w | starter (also normal) | kind:blade | yes | I88 | no: shows a pipe | I | 1 |
| Holzlatte | latte | w | legacy | kind:blade | yes | I01 | no: nailed plank | none (not dropped) | 4 |
| Stahlklinge | stahl | w | normal | kind:blade | yes | I89 | yes: wrench crossguard | M | 2 |
| Machete | machete | w | normal | kind:blade | yes | I04 | partly: wider blade | M | 2 |
| Hackmesser | brech | w | normal | kind:blade | yes | I90 | partly: cleaver shape | M | 2 |
| Vorschlaghammer | vorschlag | w | normal | kind:hammer | yes | I06 | yes: banded sledge | M | 2 |
| Pflasterhammer | pflaster | w | normal | kind:hammer | yes | I07 | partly: pick end | M | 2 |
| Rohrzange | zange | w | normal | kind:hammer | yes | I08 | no: pipe wrench | M | 2 |
| Jagdzwille | zwille | w | normal | kind:sling | yes | I09 | yes: forked slingshot | M | 2 |
| Nagelwerfer | nagel | w | normal | kind:sling | yes | I10 | partly: nail pouch | M | 2 |
| Steinschleuder | stein | w | normal | kind:sling | yes | I11 | no: rope sling | M | 2 |
| Rohrspeer | rspeer | w | normal | kind:spear | yes | I12 | yes: pole bayonet | M | 2 |
| Fahnenstange | fahne | w | normal | kind:spear | yes | I13 | partly: flag rag | M | 2 |
| Harpune | harpune | w | normal | kind:spear | yes | I14 | partly: barbed tip | M | 2 |
| Leuchtröhre | leucht | w | neon | kind:blade | yes | I59 | no: neon tube | M, E | 4 |
| Boxenhammer | boxh | w | neon | kind:hammer | yes | I60 | no: speaker head | M, E | 4 |
| Neonflinte | neonfl | w | neon | kind:sling | yes | I61 | no: shows a gun | M, E | 4 |
| Mikroständer | mikro | w | neon | kind:spear | yes | I62 | partly: mic stand | M | 4 |
| Sichel | sichel | w | GDR | kind:blade | yes | I71 | no: sickle | M | 4 |
| Werkhammer | werkh | w | GDR | kind:hammer | yes | I72 | partly: painted head | M | 4 |
| Aufziehwerfer | aufzieh | w | GDR | kind:sling | yes | I73 | partly: gear key | M | 4 |
| Zeigerlanze | zeiger | w | GDR | kind:spear | yes | I74 | partly: clock hand | M | 4 |
| Fernsehturm-Splitter | turm | w | legendary | kind:blade | yes | I15 | no: crystal shard | M, E | 3 |
| Klinge der Zitadelle | zitklinge | w | legendary | kind:blade | yes | I51 | partly: knight sword | M, E | 3 |
| Mauerbrecher | mauer | w | legendary | kind:hammer | yes | I16 | partly: concrete head | M, E | 3 |
| Plattenbrecher | pbrecher | w | legendary | kind:hammer | yes | I52 | partly: slab head | M, E | 3 |
| Zorn der Ringbahn | ring | w | legendary | kind:sling | yes | I32 | no: spike on chain | M, I, E | 3 |
| Krähenschleuder | kraehe | w | legendary | kind:sling | yes | I53 | partly: skull, feathers | M, E | 3 |
| Speer der Siegessäule | siegsp | w | legendary | kind:spear | yes | I56 | partly: gold angel | M, E | 3 |
| Morgenstern der Zitadelle | morgen | w | set zit | kind:hammer | yes | I48 | no: spiked ball | M | 3 |
| Hackmesser der Kiezwache | brech | w | set kiez | kind:blade | yes | I90 | partly: cleaver shape | M, I | 3 |
| Zwille des Spreegeists | zwille | w | set spree | kind:sling | yes | I09 | yes: same as Jagdzwille | I (set look) | 3 |
| Lederjacke | leder | a | normal | piece:vest | yes | I17 | no: jacket vs vest | M | 2 |
| Arbeitsmantel | mantel | a | normal | piece:coat | same | I18 | yes: long coat | T | 2 |
| Schutzweste | weste | a | normal | piece:vest | yes | I19 | yes: vest | T | 2 |
| Feuerwehrjacke | feuer | a | normal | piece:coat | same | I20 | no: reflective jacket | M | 2 |
| BVG-Uniform | bvg | a | normal | piece:coat | same | I21 | no: blue jacket | M | 2 |
| Regenponcho | poncho | a | neon | piece:coat | same | I63 | no: clear poncho | M, E | 4 |
| Kabelmantel | kmantel | a | neon | piece:coat | same | I64 | partly: cables missing | T, E | 4 |
| Blaumann | blaumann | a | GDR | piece:vest | yes | I75 | no: overalls | M | 4 |
| Mantel des letzten Späti | spaeti | a | legendary | piece:coat | same | I49 | partly: patched coat | T, E | 3 |
| Panzer vom Tempelhofer Feld | panzer | a | legendary | piece:coat | same | I50 | no: plate armor | M, E | 3 |
| Mantel der Rattenmutter | rattenmantel | a | legendary | piece:coat | same | I54 | partly: fur coat | T, E | 3 |
| Rüstung des Zitadellenritters | ritter | a | legendary | piece:coat | same | I55 | no: plate armor | M, E | 3 |
| Weste der Kiezwache | weste | a | set kiez | piece:vest | yes | I19 | yes: plain vest | T, I | 3 |
| Mantel des Spreegeists | mantel | a | set spree | piece:coat | same | I18 | yes: plain coat | T, I | 3 |
| Kettenhemd der Zitadelle | kette | a | set zit | piece:coat | same | I42 | no: bike chain | M, I (use I57) | 3 |
| Bauhelm | helm | h | normal | none | - | I22 | n/a | M | 2 |
| Schiebermütze | schieber | h | normal | none | - | I23 | n/a | M | 2 |
| Wollmütze | muetze | h | normal | none | - | I24 | n/a | M | 2 |
| Gasmaske | maske | h | normal | none | - | I25 | n/a | M | 2 |
| Neonbrille | nbrille | h | neon | none | - | I65 | n/a | M, E | 4 |
| Strohhut | stroh | h | GDR | none | - | I76 | n/a | M | 4 |
| Pickelhaube des Hauptmanns | pickel | h | legendary | none | - | I78 | n/a | M, E | 3 |
| Helm der Kiezwache | kiezhelm | h | set kiez | none | - | I79 | n/a | M | 3 |
| Topfhelm der Zitadelle | topfhelm | h | set zit | none | - | I83 | n/a | M | 3 |
| Arbeitshandschuhe | handsch | g | normal | piece:gloves | yes | I26 | yes: work gloves | T | 2 |
| Boxbandagen | bandage | g | normal | piece:gloves | yes | I27 | no: wraps vs gloves | M | 2 |
| Schweißerhandschuhe | schweiss | g | normal | piece:gloves | yes | I28 | partly: long cuffs | T | 2 |
| Gartenhandschuhe | gartenh | g | GDR | piece:gloves | yes | I77 | partly: green colour | T | 4 |
| Fäuste des Kiezboxers | kiezbox | g | legendary | piece:gloves | yes | I85 | no: boxing gloves | M, E | 3 |
| Handschuhe der Kiezwache | kiezhand | g | set kiez | piece:gloves | yes | I80 | partly: blue colour | T | 3 |
| Turnschuhe | turnsch | f | normal | piece:sneakers | yes | I29 | yes: sneakers | - | 2 |
| Arbeitsstiefel | stiefel | f | normal | piece:boots | same | I30 | yes: work boots | - | 2 |
| Gummistiefel | gummi | f | normal | piece:boots | same | I31 | partly: tall rubber | M | 2 |
| Stiefel des Schaffners | schaffner | f | legendary | piece:boots | same | I86 | partly: tall black | M, E | 3 |
| Stiefel des Spreegeists | spreestief | f | set spree | piece:boots | same | I81 | partly: green colour | T | 3 |
| Eisenstiefel der Zitadelle | eisenstief | f | set zit | piece:boots | same | I84 | partly: iron plates | M | 3 |
| Spreekiesel | kiesel | t | normal | none | - | I39 | n/a | - | 2 |
| Mauerstück | stueck | t | normal | none | - | I40 | n/a | - | 2 |
| Rabenfeder | feder | t | normal | none | - | I41 | n/a | - | 2 |
| Fahrradkette | kette | t | normal | none | - | I42 | n/a | - | 2 |
| Kräuterbeutel | beutel | t | normal | none | - | I43 | n/a | - | 2 |
| Currywurst-Abzeichen | abzeichen | t | normal | none | - | I44 | n/a | - | 2 |
| Herz der Spree | herz | t | legendary | none | - | I45 | n/a | E | 3 |
| Auge des Fernsehturms | auge | t | legendary | none | - | I47 | n/a | E | 3 |
| Wappen der Zitadelle | wappen | t | set zit | none | - | I46 | n/a | - | 3 |
| Abzeichen der Kiezwache | abzeichen | t | set kiez | none | - | I44 | n/a: currywurst icon | I | 3 |
| Kiesel des Spreegeists | kiesel | t | set spree | none | - | I39 | n/a: plain pebble | I | 3 |
| Siegelring | siegel | r | normal | none | - | I33 | n/a | - | 2 |
| Totenkopfring | totenk | r | normal | none | - | I34 | n/a | - | 2 |
| Schraubenmutter | mutter | r | normal | none | - | I35 | n/a | - | 2 |
| Drahtring | draht | r | normal | none | - | I36 | n/a | - | 2 |
| Ehering | ehe | r | normal | none | - | I37 | n/a | - | 2 |
| Kupferring | kupfer | r | normal | none | - | I38 | n/a | - | 2 |
| Ring der Weltzeituhr | weltuhr | r | legendary | none | - | I87 | n/a | E | 3 |
| Ring des Spreegeists | spreering | r | set spree | none | - | I82 | n/a | - | 3 |
| Neonauge | nauge | i | neon | none | - | I66 | n/a | - | 4 |
| Zielchip | zchip | i | neon | none | - | I67 | n/a | - | 4 |
| Kabelarm | karm | i | neon | none | - | I58 | n/a: shared with Bassprediger | I | 4 |
| Reflexkoppler | reflex | i | neon | none | - | I68 | n/a | - | 4 |
| Bassherz | bherz | i | neon | none | - | I69 | n/a | - | 4 |
| Nanopumpe | npumpe | i | neon | none | - | I70 | n/a | - | 4 |
| Arm des Basspredigers | bassarm | i | legendary | none | - | I58 | n/a: shared with Kabelarm | I, E | 3 |

Icon judgements are from the 128 px icons against the model code and the piece names; colours and textures of the hero pieces were not compared in a render (unverified).

## Priorities (owner order)

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
| Painted texture images, painted icons | Codex generates and does the first integration; Claude does the performance integration (`docs/asset-pipeline.md`) |
| Hero clothing pieces, retargeting | Blender, only for rigging or skinning to the UAL skeleton, rebinding the hero mesh (`npm run assets:hero`, `tools/blender/`) or retargeting animations |
| Converting CC0 packs | Node: `tools/build-creatures.mjs` (FBXLoader plus glTF export, gltf-transform). The owner found Blender slow; use Node where no skinning work is needed |
