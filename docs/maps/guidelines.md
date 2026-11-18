# Map building guidelines

How every district map is made, so all maps grow in the same direction no matter who builds them (Claude, Codex, another session). Living document: add a dated row under *Changes* when a rule changes. Started 2026-11-15 with Köpenick (`koepenick.md`), the reference map.

## Steps

| # | Step | Output | Who decides |
|---|---|---|---|
| 1 | Concept: 2 to 3 clearly distinct layouts as SVG mockups (route, zones, encounters, landmarks, size) | Mockup in chat | Johannes picks |
| 2 | Geography check against OpenStreetMap (below) | Table in `docs/maps/<district>.md` | |
| 3 | Data: anchors, streets, water, areas, landmarks, encounters, hills, terraces in `src/data/<district>.ts` | Map SVG from the data (`map-svg.test.ts`), shown in chat before the 3D build | Johannes can redirect |
| 4 | Build: landmarks in code, generated lots, props, heights, light, ground (code-painted placeholders) | Screenshots of each landmark, one fight, one street at night | |
| 5 | Tests: the invariants below, at scale 1 and 1.3 | `npm run check` green | |
| 6 | Textures: Codex generates the images for the new surfaces (`docs/asset-pipeline.md`), Claude does the performance pass | Rows in the asset queue | |
| 7 | Playtest on PC and Tab S9 (`?debug=perf`, `?mapscale=`) | Row in `docs/playtests.md` | Johannes sets size and difficulty |

Any new visual whose form is open (layout, minimap, ground look, a building type) gets clearly distinct alternatives as an SVG mockup in the chat first; build after Johannes picks. Routine work inside a picked direction: build, show, continue.

## Johannes' standing requirements (collected 2026-11-15 to 2026-11-16)

| Topic | Requirement |
|---|---|
| Size | Tight, not empty: walking always leads somewhere within seconds. Köpenick v1 (510 × 428 m) was too big; v2 at about 0.6 of the distances works |
| Life | Every stretch of street has something: buildings, cars, props, light. No plain rectangles of ground |
| Walkable space | It must be obvious where the hero can walk: narrow streets with curbs, fences, bollards |
| Edges | No invisible walls, ever. A blocking edge is a visible object (building row, rubble wall, hedge, thicket, barricade, fence, water) or the fight ring |
| Ruins | It is a ruined city: about half the ordinary buildings are burnt-out shells; intact ones have only a few faint lit windows |
| Light | Alive at night: where one light pool ends the next begins, almost no fully dark area (the gate 1 market square is the reference). But organic, never a grid: bright pockets and dimmer stretches, clusters where people gather, different strengths, colors and directions, light at different heights (candles on the ground, barrels, door lamps, string lights over the street, halos around lamp heads). Street lamps beside the street, spaced, a third broken; the rest from fires, construction lamps, candles, string lights, door lamps, Spätis, windows |
| Vehicles | Real sizes (a bus is about 11 m), detailed enough to read; trams on tram tracks; a ferry is a real boat that shuttles and carries the hero |
| Route | Not purely linear: short side branches with surprises (M16b). A loop that never walks the same street twice |
| Rest | One enterable Späti per zone beside the route (rest stop, later the trader) |
| Look | Fits the style bible; textures may be somewhat more realistic than the comic boards. Recognizable Berlin details |
| Reuse | Recycle the 2D game's rules, numbers and art wherever they fit the 3D gameplay |

## Geography check (do it for every map)

1. List every landmark, bridge, river point and zone anchor the map uses.
2. Look up each one on OpenStreetMap: Nominatim search, `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<name>, Berlin`, one request per second, a generic user agent, no personal data in the request.
3. Convert to meters from the district's origin landmark (Köpenick: the Rathaus): `east = Δlon × 111 320 × cos(lat)`, `north = Δlat × 111 200`. Map axes: +X east, +Z south (so `z = −north`).
4. Write a table: place, real offset, map offset, note. Each direction must match (same compass octant); order along a line must match (what is between A and B stays between). Distances may be compressed freely and non-uniformly.
5. A place that is really in another district may be pulled in as a neighbour (Spreepark → Köpenick); say so in the table.
6. Mark what was **not** checked (side streets, small layouts) as placeholder.

## Layout rules

| Topic | Rule |
|---|---|
| Structure | A hub (the district's center, e.g. Altstadt) and 2 to 3 zones around it. Route visits each zone, then returns to the district landmark for the final boss |
| Size | Author at scale 1 with the `scale` factor (distances stretch, building sizes do not, water widths with √scale). Köpenick v2 at scale 1: 318 × 304 m, route about 840 m (2.3 min of pure running); v1 at 510 × 428 m felt too big and empty. Keep the hub at real building scale and pull the zones in. Tests run at 1 and 1.3 |
| Length | A full district may take 15 to 20 minutes (Johannes, 2026-11-15). A checkpoint per zone comes with the save (M6) |
| Encounters | Circle radius 13 to 16 m, at least 80 % open ground (test), no terrace edge or water inside. 2 to 3 waves each. Fixed place, triggered only when it is the objective |
| Waves and bosses | Wave count per zone is decided per district (Köpenick 6/7/7). One boss per zone, the district boss last at its landmark. Difficulty follows `waveTier` (one curve per district, rising) |
| Bosses | Der Schaffner belongs to the U-Bahn tunnels and is not used as a district boss. District bosses fit the district's era and story (`docs/story.md`) |
| Space | Streets are the main paths; buildings line them (generated lots); arenas, landmarks and stairs stay free. Every stretch has something: buildings, cars or props (test). Prefer a loop route that never walks the same street twice |
| Streets | Superseded by M11d (Johannes, 2026-11-17): real Berlin street profiles, chosen per street from the three in `docs/mockups/m11d-street-profiles.svg`. A *Hauptstraße* (about 21 m wall to wall: two lanes, tram in the middle, parking both sides, 3 m sidewalks with tree pits) for the main shopping street (Köpenick: Bahnhofstraße); C *Allee* (about 19 m: tram on a grass track in the middle, one lane each side, trees both sides, no parking) for boulevards with a tram (Köpenick: Köllnische Vorstadt to the Spreepark, with tracks); B *Kiezstraße* (about 17 m, tram shares the lane, parking one side) for dense side streets. Paths 4 m. Curbs, paved sidewalks also on bridges, asphalt with patches, zebra crossings, full sidewalks |
| Landmarks | Built in code with their recognizable silhouette first (tower, gables, roof shape, material color). 3 to 6 per district, each visible from the route. Research from photos and cues below 5 m: `docs/maps/landmarks.md` |
| Heights (B3) | Soft hills up to about 8 m (walkable everywhere), terraces 1.5 to 3 m with retaining walls and stairs (walls block in the sim). Not inside an encounter circle. Good spots: summits, platforms overlooking an arena |
| Edges | No invisible walls (Johannes, 2026-11-15): every blocking edge is visible; fights show their circle as a glowing ring; water is its own edge. Closed fronts (M11d step 4, 2026-11-17, `edgeProps` in `src/data/map.ts`): by the area 6 m inside, town (paved or Altbau frontage) gets a row of Brandwände and Hinterhaus backs (about a third collapsed houses with rubble heaps; only rubble on the south bound, which is between camera and hero), house areas a tall garden hedge with sheds, forest and parks a dense thicket with fallen trees, the jungle overgrowth; a street that runs out ends in a barricade (jersey barriers, wrecked cars, a tram stop shelter, a work lamp). Colliders start at the drawn face and reach past the bound. Beyond the bound (render only): a ground skirt, a second row of taller blocks, houses and tree rows, nothing beyond the south bound (never in view) |
| Ruins | About half of the ordinary buildings are burnt-out shells (no roof, broken wall tops, empty windows, rubble). Intact ones have few lit windows (about 10 %) |
| Light | Street lamps (Johannes 2026-11-16): evenly spaced along each street (main 24 m staggered on both sides, side 20 m on one side), right at the curb (0.45 m from the street edge), plus a corner lamp where streets meet or bend sharply. Only about 30 % still work (strength 0.8 to 1.25); the rest stand dark and bent. A blocked spot may move up to 1 m, otherwise the row keeps a gap. Same kinds keep a distance (`SAME_KIND_GAP`: campfires 16 m, string lights 30 m, construction lamps 9 m, candles 7 m); fire barrels may stand together. String lights across some side streets (every 45 to 90 m). Then a coverage pass (`fillLight` in `src/data/map.ts`): each street point needs a light within `lightCover(x, z)`, a slow noise between 6 m (bright pockets) and 13 m (dim stretches); the fill light lands at a random offset, with a random strength (0.6 to 1.4) and in 40 % a small cluster. Kinds: construction lamps and grave candles more often than barrels and campfires. Tests at scale 1 and 1.3: under 2 % dark street samples, irregular spacing of fill lights, more than 5 strengths, string lights present; lamps at the curb, over 80 % of lamp gaps whole multiples of the spacing, 20 to 45 % lit, no same-kind twins |
| Side branches | M16b (Johannes, 2026-11-17, variant A of `docs/mockups/m16b-side-branches.svg`): 2 to 3 short dead ends of 20 to 30 m beside the route between fights, in the blocks (a Hinterhof, a lane, a hangar), each ending in a surprise: hidden blessing, cache of crates, sleeping elite mini-boss. Found without the minimap: a gap in the building front and a light at the end. Data: `MapDef.hiddenSpots`, `guards` (sleep until the hero comes near, never count for a wave), crates as fixed props. Keep room for them when laying out a map |
| Blockrand (M15) | Inner-city districts may use the Berliner Blockrand (Johannes 2026-11-18, variant A of `docs/mockups/m15-altbau-visibility.svg`): `Street.block` builds closed 5-storey Altbau rows wall to wall (fire walls on the sides, Seitenflügel behind) only where they do not stand between camera and street: the north side of east–west streets and both sides of north–south streets. The camera side gets shops and ruins (one storey, rarely two). About one in seven tall slots is a Baulücke (Trümmerfeld between fire walls). The camera (44°, 13 m up, 13 m behind the hero) would otherwise be inside a 19 m building. Cutting single buildings (variant B) only in courtyards and behind flagged landmarks (row Cutaway) |
| Cutaway (V1 B) | A flagged object is cut off hard above a height while the hero is in its trigger zone: dark cap, no transparency, no fade (`src/data/cut.ts`, `docs/tasks/v1-visibility.md`). Hinterhof lots: zone = the lot, cut at 1.2 m, only the buildings on the camera side of the yard (computed). Landmarks: flag with `Landmark.cut` when they are tall enough to hide the hero or hold the camera; zone = footprint swept 20 m north, cut at the ground floor (4.3 m). Everything not flagged stays opaque with the hero contour. Cost: no draw calls, no shaders, no lights |
| Camera | Ordinary buildings: ground floor plus 1 to 2 floors, L-shaped footprints and single-storey shops for variety. World stays opaque; an amber hero contour appears only on silhouette pixels actually occluded by a building or large vehicle. No proximity effect except the cutaway of flagged objects (row Cutaway) |
| Light shape | `LightShape` in `src/render/world.ts`: `yaw`, `stretch` and `reach` make a directional pool (door lamps light the sidewalk in front, construction lamps the spot they aim at, string lights a band across the street); `halo` adds a soft glow around the lamp head (crossed additive cards in the glow batch, no extra draw call). Strength comes from `Prop.size` (intensity × size, pool × √size) |
| Height and detail | About half the street doors of intact Altbau get front steps, about 45 % a wall lamp at 2.9 m (warm, cold LED or rarely teal). Light comes from different heights: ground (candles), knee (barrels, campfires), door (wall lamps), lamp head, string lights at 4.5 m |
| Light pool | 2 fire barrels and some cover per encounter. Only a fixed pool of point lights exists (Leistung 3, Qualität 7, the nearest to the hero); every light source also gets a ground glow decal and its flame, which carry the coverage cheaply. Never change the light count at runtime. Every light color costs one glow material per chunk where it appears. Palette: fire `0xff8a3c`, lamp `0xffb060`, string lights `0xffc890`, cold LED `0xd8ecff`, teal `0x5fd8c8`; add a color only for a new kind of source |
| Water | Rivers as polylines, lakes as polygons, bridges as rectangles at least river width + 12 m long. Banks drop to the water plane. Natural banks wobble up to about 3 m; banks in cobbles or asphalt areas are straight stone quays; bridge and ferry heads keep the authored line |
| Lot types and weather (M11c) | Each zone gets two lot types the others do not have (Köpenick, Johannes 2026-11-17: Bahnhofsviertel Hinterhof and Parkplatz, Müggelberge Kleingärten and pond in a park, Spreepark Trümmerfeld and Baustelle with crane, Rathaus/Altstadt Markt and Kirchhof). Weather is fixed per zone (variant A: Bahnhof rain, Müggelberge fog with fireflies, Spreepark ash and embers, Rathaus clear moon), one particle system, no extra lights. Graffiti, puddles and an area name message when entering a zone everywhere. Lot types (`src/data/lots.ts`, mockup `docs/mockups/m11c-lot-types.svg`): about two in five street lots of a zone group (weather groups), never the same type twice in a row, Parkplatz once per map; each has something happening (sleeping or hidden guards, preferred spots for the captive, trader and cache), props never on a grid (jittered offsets and turns), fences with gates and gaps. Tight quarters (Altstadt) get hand-placed lot types (`MapDef.specialLots`) |
| Ground | Variant C: grass, dirt, paving and leaf litter blended per area with soft borders, grass overgrowing paving, plus scatter (puddles, leaves, trash, rubble, weed tufts). Textures follow `docs/asset-pipeline.md` (code placeholder first, generated images by Codex) |
| Relief | Low rolling ground in parks and forests, flat on and beside streets, near water, buildings and landmarks |
| Rest stops | One Späti per zone beside the route, front on a street, away from encounter circles (test). Lit inside and outside, readable sign from the camera. Find spots with a probe over free land near each zone's route before placing |
| Buildings | Altbau 9 to 16 m wide, ground floor plus 1 to 2 floors, L-shaped in about 40 %, single-storey shops between blocks, houses slightly askew with front fences. Only building/landmark bodies and large vehicles enter the hero-occlusion depth mask. Small props, loot, enemies, lamps, fences and trees do not |
| Vehicles | Cars every 7 to 14 m of street, off zone entries, stairs and landmarks. Wrecks: buses and vans on main streets, a tram on the tram line |

## U-Bahn tunnels (M19, M20)

| Topic | Rule |
|---|---|
| Layout | Variant B of `docs/mockups/m19-tunnel-layouts.svg` (Johannes, 2026-11-17): one curved line of about 400 m, start and end stations, a ghost station in the middle, five fights, three side passages: the hidden blessing in the first (Johannes), then a cache, then a sleeping mini-boss. Der Schaffner at the generator platform. M20 (Johannes, 2026-11-18, bottom strip of `docs/mockups/m20-tunnel-network.svg`) adds the 2D route A content of `js/ubahn.js`: a grating after each fight, the trader on the start platform, a collapse with a maintenance bypass, a flooded stretch, the generator hold, station name plates |
| Line-parametric | `tunnelMap(line)` builds every line of `LINES` (`src/data/lines.ts`) from one template: S3 (line 0, `tunnel-s3`, `S3-Tunnel`) keeps the M19 positions; other lines get a seeded curve, mirrored side passages and a seeded order of the three special stretches over three free slots (the collapse only in the first or last, away from a station cap). Names come from the line: start and end station (`stopName`), ghost station. Only S3 is reachable; the others are data with a test each (valid, sealed by its gratings, scripted run wins) |
| Data | `MapDef.tunnel` (`TunnelDef`): `tubes` (track bed 11 m, stations 20 to 24 m, passages 5 to 6 m, bypass 4 m), `line`, `color`, `gates`, `rubble` (blocks the walk grid: `tunnelWalk`), `flood` (`slow` 0.7, 2D `P.wet`), `trader`, `generator`, `signs`. Only tubes are walkable, no lots or streets; props come from `tunnelProps` (work lamps on alternating walls, crates, never in the collapse, on a grating line, at the trader or the generator, no crates in the bypass); the collapse is fixed rubble heaps, slabs and girders |
| Sim | Gratings (2D `addGate`/`openGate`): a box collider across the tube per fight, `Level.gates`; when the fight is won it opens (`openGates` in the director: collider out, heal drop, `gateOpen` event, `sim.gateT`), a retry or resume opens those behind it quietly; spawns never come from behind a closed one. Flood: `Level.speedAt` slows the hero and enemies on foot (flyers not). Generator (2D GEN): the last encounter has `hold` (`r` 8.5 m, `need` 35 s, a spawn about every 2 s from the tunnel mouth, an elite brute at half): phase `hold`, charge only inside the ring, then `power`, 2.5 s, Der Schaffner's wave; progress on `run.hold`. Trader (2D `TUN.npc`): `Level.traderSpot` puts a `fixed` trader into the run content (no timer, no mark, trades when no enemy is within 12 m); tunnels plan no leg events (2D `run.events={}`) |
| Render | Walls 4.6 m along both tube edges, open at junctions, as thick as fits before the next tube (marched in 0.5 m steps, up to 12 m) with a black top; a divider thinner than 2.5 m (beside the bypass) stays 1.4 m high so the camera sees over it. Tiles in stations with a stripe in the line color, two tracks with sleepers, tiled platforms. Walls are uneven (playtest 2026-11-18): the face swells up to 0.3 m, tint drifts, a damp foot, ribs every 8 m, refuge niches, a cable tray; caged wall lamps every 12 m alternating sides (warm and cold LED) light track and bypass instead of ground lamps. Line-parametric shape is parked: every line reuses the S3 tunnel and only renames it (Johannes, 2026-11-18). Ground outside the tubes is darkened. `src/render/tunnel-view.ts`: blue name plates on the north walls (one material per name), the bypass walkway with pipes, the generator; gratings with a BVG yellow and black top beam that sink into their floor slot from sim time; the flood as one see-through water ribbon sharing the river ripple normal map; the hold ring with its charge arc (FX layer); on power, strip lamps and four pooled ceiling spots of the end station come up (spots stay at intensity 0 and out of the pool until then: no light count change) |
| Flow | A separate page load (`?map=tunnel`): reachable from the title and the victory screen once Köpenick is freed; back the same way. Tunnel enemies +25 % life; a cleared line is stored in `camp.freed` as 100 + line. Messages (`src/ui/tunnel-notice.ts`): "Gitter offen · weiter Richtung …", "Generator anwerfen", "Strom!" |

## Camp (M20)

| Topic | Rule |
|---|---|
| Layout | A+C of `docs/mockups/m20-camp-combined.svg` (Johannes, 2026-11-18): platform hall inside (0 m), wide stairs, open track yard outside (+3 m) under the Warschauer Brücke. Every station is its own place with its own floor or object (Kachelraum, Bäckerei, Markt, Güterwagen, Brückenbogen, Stellwerk, Sandsackhof) |
| Data | `MapDef.camp` (`src/data/camp-map.ts`): floor polygons (everything else is solid), walls, stations (footprint = collider), rings. No encounters, `Level.camp` keeps it peaceful |
| Camera | Walls facing the camera stay knee high (2D cutaway rule); columns stand north of the walking line; the exercise yard nearest the camera stays low |
| Light | One fixed light spot per station plus hall and viaduct lamps; a shadow-only ceiling keeps the moon out of the hall, it falls down the stairs |
| Rings | Small and dim at the keeper's feet (`stationRing`, rule in `docs/style-bible.md` › Shared language) |
| Rooms | Fill the whole room, also the half toward the camera, with low furniture (`CampLayout.decor`); tall pieces only along side walls |

## Invariants (tests per map)

- Wave and boss counts per zone as decided; difficulty rises wave by wave.
- Start, zone entries and encounter centers walkable and free; encounter circles ≥ 80 % open.
- Bridges walkable; water and terrace walls block; stairs lead up.
- Generated buildings off streets and out of the water; a larger scale gives more lots.
- A scripted run reaches victory (`director.test.ts`).
- Every 20 m street stretch has something (under 10 % empty); lamps at the curb and evenly spaced, about 30 % lit, no same-kind twins; light coverage (under 2 % dark street samples at scale 1 and 1.3) and organic spacing (variation over 0.4, several strengths).
- No invisible walls: land at the map edge is closed by a visible front (no gap the hero fits through, tested by a flood fill), streets end in a barricade.
- One Späti per zone near its route; doors walk in, walls hold.

## Lessons from Köpenick (2026-11-15 to 2026-11-16)

| Lesson | Practice |
|---|---|
| Size first | Decide the size with a playable blockout and the minimap, not on paper. `mapscale` stretches distances only; a new layout beats scaling down (scale below 1 breaks lots) |
| Density is tested | "Every stretch has something", light coverage and closed edges are tests, so a layout change cannot quietly leave empty or dark areas |
| Data before render | Rules live in `src/data` (generators, colliders) so sim and renderer agree; the renderer only draws |
| Water | Natural banks wobble (up to about 3 m), town banks are straight quays; bridge and ferry heads keep the authored line so decks always reach land. The ground mesh slopes into the riverbed, so quay walls reach 1.5 m inland to hide it |
| Relief | Gentle (under 1.5 m) and only off streets, water, buildings and landmarks, cached on a grid because `heightAt` runs every frame |
| Moving things | A moving platform (the ferry) is a pure function of sim time; bodies on it move with it, including their rollback position |
| Placement | Hand-placed things (Späti, tram, landmarks) reserve space before the generators run; generators check water, streets, encounters, stairs and each other |
| Screenshots | Cloud screenshots render in software: take them one after another, teleport the hero, wait about 4 s, and take a second shot because the camera lags after a long jump. Measure performance only on the PC and the Tab S9 |
| Mockups first, kept | Every map-level choice (street profile, lot types, weather, side branches, tunnel layout) went through an SVG mockup with example values or real map data (`docs/maps/koepenick.svg` as the base). Mockups live in `docs/mockups/` and are reused for later districts (Johannes, 2026-11-17) |
| 2D reuse | Read the 2D code for rules and numbers (`johakunath/Ruinenstadt`), map pixels to meters by dividing by 30, and check that each rule still fits the 3D structure (example: fights lock the hero into a circle, so the 2D safe-room rule became a rest stop) |

## Performance

Headless numbers are not representative. On Leistung keep a typical view under about 200 draw calls and 200k triangles in the cloud readout until the Tab S9 says otherwise; the Tab S9 measurement sets the real limit and the map size.

## Changes

| Date | Change |
|---|---|
| 2026-11-15 | Started with Köpenick: geography check, layout rules, heights, invariants |
| 2026-11-15 | No invisible walls, half ruins, fewer and broken lamps, side branches planned (Johannes) |
| 2026-11-16 | Irregular banks and quays, relief, ground variant C, Späti rest stops (M11b part 2) |
| 2026-11-16 | Johannes' standing requirements, light coverage rule, lessons from Köpenick, skill `.claude/skills/map-building` |
| 2026-11-16 | Street lamps evenly spaced at the curb with corner lamps, about 30 % lit; same kinds keep a distance (Johannes) |
| 2026-11-16 | Organic light (Johannes): varying gap (6 to 13 m), clusters, strengths, colors, directional pools, halos, light at several heights (door lamps, string lights), front steps |
| 2026-11-17 | M11d street profiles A/B/C, M11c lot types and weather per zone, M16b side branches A, M19 tunnel rules (Johannes) |
| 2026-11-18 | Xhain (M15, concept B): the Wall (`MapDef.walls`) and viaducts (`MapDef.viaducts`) are data with colliders and keep lots and props off; the brick Stadtbahn is a visible map edge, the U1 blocks only at its pillars. Where the light fill pass finds no free sidewalk (under a viaduct, beside a tram) the map hand-places lights. Wrecks keep off zone entries. Elevated stations are `walkUnder` landmarks (lots kept off, no collider) |
| 2026-11-18 | Berliner Blockrand (`Street.block`), variant A; B only in courtyards and behind landmarks (Johannes) |
| 2026-11-18 | Cutaway of flagged objects (V1 B, engine B3): Hinterhof lots, Thomaskirche, Bethanien |
| 2026-11-18 | Mitte (M15, B2): `MapDef.strictLots` keeps lots out of turned landmark footprints and off the whole width of side paths (opt-in, backlog B14 for the older maps); walk-through and hollow landmarks block only with `OPEN_PARTS` (Brandenburger Tor pillars, Sony Center ring); the start sits beside a landmark (the U-Bahn entrance) so no generated lot lands on it; streets end at the bound, not past it; streets through parks get hand-placed lights on the verge |
| 2026-11-15 | Köpenick v2 (M11b, playtest): tighter size, loop route, narrower streets with curbs, lower and L-shaped buildings, shops, cars and props on every stretch (test) |
| 2026-11-17 | Landmarks: photo research by the building model (not cheap subagents), cues below 5 m (camera rule), reveal shot, collider covers all standing parts (`docs/maps/landmarks.md`). Water 1.7 m below street level, natural banks slope, quays reach the bed (M11d step 0) |
| 2026-11-18 | Alexanderplatz: a brick Stadtbahn is a row of solid viaduct runs with open arches where streets pass (`MapDef.viaducts`, one run per closed stretch); wide streets (Allee 22 m) get fires down the middle strip, and a light that would stand in a fight circle moves to its rim |
| 2026-11-18 | Time of day per map (`src/render/sky.ts`): every map is night except Alexanderplatz, afternoon light A "Goldene Stunde" (Johannes). The sun is the moon's light (same shadow map), lamps keep their pooled lights at a quarter strength, the light count never changes. Light coverage tests stay as they are |
| 2026-11-18 | Blockrand rows also in Plattenbau areas (Alexanderplatz): tall slabs away from the camera with lanes between them, pavilions on the camera side. Signs of camera-side buildings go on the roof edge, readable from both sides (their front faces away from the camera) |
| 2026-11-18 | A landmark that the route passes further off than 12 m may set its own reveal distance (`SHOW.near` in `reveal.ts`; Alexanderplatz Fernsehturm 32 m). Side passages, guards and hidden blessings never stand in a landmark footprint (test per map) |
| 2026-11-18 | Landmarks are ruins too (Johannes): every sight shows wear (soot, cracks, broken or boarded windows, missing pieces, rubble and trash at its foot, graffiti up to 3 m, some scaffolding or tarps) while its silhouette stays recognizable. New landmarks are built worn; the existing ones are backlog P24 |
