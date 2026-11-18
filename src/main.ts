import { AbilitiesUi } from './ui/abilities';
import { heroLook } from './data/hero-look';
import { weaponModel } from './render/weapons';
import { InventoryUi } from './ui/inventory';
import { Menu } from './ui/menu';
import { CampUi } from './ui/camp';
import { IntroUi, SIGHT_TIPS } from './ui/intro';
import { endExpedition } from './sim/camp';
import { startEndless } from './sim/director';
import { INGREDIENTS } from './data/crafting';
import { isUpgrade } from './sim/items';
import { collectItem } from './sim/inventory';
import type { Item } from './sim/items';
// Game loop: fixed 60 Hz sim steps, interpolated rendering, input polled every frame. Loaded by
// boot.ts from the start screen (U3); `ready` resolves once the renderer is up.
import { GameAudio } from './audio/audio';
import { HIT_FEEL } from './data/combat';
import { Input } from './input/input';
import { GO_KEY, reloadWith, RESUME_KEY } from './options';
import { opts, settingHooks } from './ui/settings';
import { optionsScreen } from './ui/options-screen';
import { startScreen } from './ui/start';
import { LOOK } from './render/looks';
import { PROFILES } from './render/profile';
import { GameRenderer } from './render/renderer';
import { setLoadout } from './sim/loadout';
import type { Equipment, StatContext } from './sim/stats';
import { createSim, stepSim } from './sim/sim';
import { autoAttackTarget } from './sim/player';
import { deathSummary, logHit, type DeathSummary, type HitLog } from './sim/death';
import { DT, NO_INPUT, type Sim, type SimInput } from './sim/types';
import { Ui } from './ui/ui';
import { koepenickMap } from './data/koepenick';
import { tunnelMap } from './data/tunnel';
import { campMap, campPlaceAt } from './data/camp-map';
import { campOpen, LINE_FREED, LINES, stopName } from './data/lines';
import { NetBoard, type NetGo } from './ui/netboard';
import { tunnelNotice, tunnelObjective } from './ui/tunnel-notice';
import { STATIONS } from './data/camp';
import { siteLevel } from './sim/camp';
import { xhainMap } from './data/xhain';
import { mitteMap } from './data/mitte';
import { alexMap } from './data/alexanderplatz';
import { skyFor } from './render/sky';
import { MAP_FREED, MAP_NAME, MAP_SUB, MAP_WON, wonLink, type MapId } from './ui/maps';
import { areaAt, generateLots, generateProps, mapLevel } from './data/map';
import { pickIsHere, titleNet } from './ui/title-net';
import { mapSvg } from './data/map-svg';
import { EdgeMarkers, Minimap } from './ui/minimap';
import { ENEMIES } from './data/enemies';
import type { Level } from './sim/level';
import { Telemetry, VERSION } from './telemetry';
import { LootLabels, rarityColor } from './ui/loot-labels';
import { groundY } from './render/ground';
import { dropColor, importantDrops, nearestImportantDrop } from './sim/loot';
import { MATERIALS } from './data/crafting';
import { PERKS, SHRINES } from './data/progression';
import { contentMarks, EVENT_TEXT, talkTo } from './sim/runcontent';
import { TalkPrompt } from './ui/talk';
import type { DifficultyId } from './data/difficulty';
import { backupSave, clearSave, loadSave, writeSave } from './save';
import { CloudSave, formatCode, type SyncState } from './sync';
import type { Prop } from './data/courtyard';
import { profileOf, simFromSave, snapshot, type SaveV1 } from './sim/save';


type Phase = 'title' | 'play' | 'dead' | 'won';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new GameAudio();
audio.setVolume(opts.sound ? opts.volume : 0);
audio.setMusic(opts.music);
audio.setEco(opts.profile === 'leistung');
const input = new Input(canvas);
const abilitiesUi = new AbilitiesUi(input);
/** Starts a trade with whoever is in reach; the loop then pauses on `content.tradeOpen`. */
function talk(): void {
  if (isCamp) { campAct(); return; }
  if (phase === 'play' && !menu.isOpen && talkTo(sim)) { input.clear(); drainEvents(); }
}
const talkPrompt = new TalkPrompt(() => talk());
input.onTalk = talk;
abilitiesUi.onChoose = () => { input.clear(); saveNow(true); };
abilitiesUi.onTradeClose = () => { input.clear(); saveNow(true); };

// Köpenick (M11), a tunnel (M19/M20, ?map=tunnel&line=k), Xhain (M15, ?map=xhain), Mitte (M15, ?map=mitte), the walkable camp (M20, ?map=lager) or the gate 1 courtyard (?map=hof).
const map = opts.map !== 'hof' ? (() => {
  const def = opts.map === 'lager' ? campMap() : opts.map === 'tunnel' ? tunnelMap(opts.line) : opts.map === 'xhain' ? xhainMap(opts.mapScale) : opts.map === 'alex' ? alexMap(opts.mapScale) : opts.map === 'mitte' ? mitteMap(opts.mapScale) : koepenickMap(opts.mapScale);
  const lots = generateLots(def);
  const props = generateProps(def, lots);
  // Dev showcase (`?props=crane,stall:1.5*4`, kind[:size][*count]): rows of six props near the start on the
  // nearest free ground (no building, car or container within the block), all facing south (rot 0) so fronts compare.
  const show = new URLSearchParams(location.search).get('props');
  if (show) {
    const items = show.split(',').flatMap((k) => { const [head = '', n] = k.split('*'); const [kind, size] = head.split(':'); return Array.from({ length: Number(n) || 1 }, () => ({ kind: kind as Prop['kind'], size: Number(size) || 1 })); });
    const cols = Math.min(6, items.length), rows = Math.ceil(items.length / 6), span = (cols - 1) * 5 + 6, deep = (rows - 1) * 6 + 6;
    const busy = (x0: number, z0: number): boolean => lots.some((l) => Math.abs(l.x - x0 - span / 2) < span / 2 + Math.max(l.w, l.d) / 2 && Math.abs(l.z - z0 - deep / 2) < deep / 2 + Math.max(l.w, l.d) / 2)
      || props.some((p) => (p.kind === 'car' || p.kind === 'crane' || p.kind === 'container') && p.x > x0 - 3 && p.x < x0 + span && p.z > z0 - 3 && p.z < z0 + deep);
    let ox = def.start.x + 5, oz = def.start.z - 4;
    search: for (let r = 0; r < 30; r += 3) for (let a = 0; a < 16; a++) {
      const x = def.start.x + 3 + Math.cos(a * Math.PI / 8) * r, z = def.start.z - 3 + Math.sin(a * Math.PI / 8) * r;
      if (!busy(x, z)) { ox = x; oz = z; break search; }
    }
    items.forEach((it, i) => props.push({ kind: it.kind, x: ox + (i % 6) * 5, z: oz + Math.floor(i / 6) * 6, rot: 0, size: it.size }));
  }
  return { def, lots, props, level: mapLevel(def, lots, props) };
})() : null;
const isTunnel = map?.def.tunnel !== undefined;
/** M20: the walkable camp at Warschauer Straße: no fights, rings open the stations, the train the network map. */
const isCamp = map?.def.camp !== undefined;
const line = isTunnel ? opts.line : 0;
const mapId: MapId = opts.map;
/** What a won run is called: the district freed or the line cleared. */
const winText = isTunnel && line > 0 ? `${LINES[line]?.id ?? 'S3'} frei` : MAP_WON[mapId];
const level: Level | undefined = map?.level;

// M6: debug starts (?at, ?stress, ?autostart, ?mapscale) never read or write the save.
const persist = !opts.autostart && !opts.stress && !opts.startAt && opts.mapScale === 1 && opts.spawn.length === 0;
const mapName = map ? map.def.name : 'Hof';
let save: SaveV1 | null = persist ? loadSave() : null;
/** A checkpoint of another map waits while this one is played (M20: a visit to the camp must not drop it). */
let foreignRun = save?.run && (save.run.map !== mapName || !level) ? save.run : null;
if (foreignRun) save = { ...save!, run: null };
/** Writes the save; with no run of this map, another map's waiting checkpoint stays in it. */
function store(s: SaveV1): void {
  const out = !s.run && foreignRun ? { ...s, run: foreignRun } : s;
  writeSave(out);
  cloud.queue(out);
}
// The start screen may have changed it before the game loaded; a waiting checkpoint keeps its own.
let difficulty: DifficultyId = save?.run ? save.difficulty : startScreen().difficulty;
// Cloud save (Q6): same Apps Script as 2D, no login. Not on localhost, in automated browsers or debug starts.
const cloud = new CloudSave(persist && !navigator.webdriver && !/^(localhost|127\.|0\.0\.0\.0|$)/.test(location.hostname));
function freshSim(): Sim {
  const base = { seed: opts.seed, stress: opts.stress, level, startAt: opts.startAt, spawn: opts.spawn };
  try { if (save) return simFromSave(save, base, false); } catch (err) { console.warn('Save unbrauchbar', err); save = null; clearSave(); }
  return createSim({ ...base, difficulty });
}
let sim: Sim = freshSim();
let phase: Phase = 'title';
let wonFor = -1;
/** Exit warning: 'ask' shows the modal, 'search' leads the hero to the valuable loot left behind. */
let lootExit: 'off' | 'ask' | 'search' = 'off';
/** Where the exit warning leads after "Weiterziehen". */
let afterLoot: 'again' | 'camp' | 'map' = 'again';
const lootUi = new LootLabels();
const lootWarn = document.getElementById('lootwarn') as HTMLDivElement;
const lootChip = document.getElementById('loot-chip') as HTMLButtonElement;
const exitChip = document.getElementById('exit-chip') as HTMLButtonElement;
exitChip.addEventListener('click', () => showWon());

function finishLootExit(leave: boolean): void {
  lootWarn.hidden = true;
  input.enabled = phase === 'play';
  input.clear();
  if (leave) {
    lootExit = 'off';
    lootChip.hidden = true;
    if (afterLoot === 'camp') { afterLoot = 'again'; toCamp(); return; }
    if (afterLoot === 'map') { afterLoot = 'again'; const link = wonLink(mapId, line); goMap(link?.to ?? 'koepenick', link?.line ?? 0); return; }
    again();
  } else {
    // Back into the map to fetch it.
    lootExit = 'search';
    explore();
  }
}
/**
 * Gamepad for the exit warning: D-pad or stick switches between the two buttons, A activates, B
 * searches. During the search, Select leaves. Button state is tracked all the time, so a button
 * held when the dialog opens does not fire.
 */
let lootPadDown: boolean[] = [];
function pollLootPad(): void {
  const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
  if (!pad) { lootPadDown = []; return; }
  const down = pad.buttons.map((b) => b.pressed || b.value > 0.5);
  const edge = (i: number): boolean => !!down[i] && !lootPadDown[i];
  if (lootExit === 'ask') {
    const find = document.getElementById('loot-find') as HTMLButtonElement;
    const leave = document.getElementById('loot-leave') as HTMLButtonElement;
    if (edge(12) || edge(13) || edge(14) || edge(15)) (document.activeElement === find ? leave : find).focus();
    else if (edge(0)) (document.activeElement === leave ? leave : find).click();
    else if (edge(1)) finishLootExit(false);
  } else if (lootExit === 'search' && edge(8)) {
    lootExit = 'off';
    lootChip.hidden = true;
  }
  lootPadDown = down;
}
document.getElementById('loot-find')!.addEventListener('click', () => finishLootExit(false));
document.getElementById('loot-leave')!.addEventListener('click', () => finishLootExit(true));
lootChip.addEventListener('click', () => { lootExit = 'off'; lootChip.hidden = true; });
window.addEventListener('keydown', (e) => {
  if (lootExit === 'ask' && e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    finishLootExit(false);
  }
}, { capture: true });

/** A retry starts at the first encounter of the zone the hero fell in. */
function checkpoint(): number {
  if (!level) return 0;
  const i = Math.min(sim.run.index, level.encounters.length - 1);
  const zone = level.encounters[i]?.zone ?? 0;
  return level.encounters.findIndex((e) => e.zone === zone);
}
/** M17 end screen: what the run brought (2D showEnd stats). */
let runScrap0 = 0, runT0 = 0;
/** Hits of the last seconds and the summary of the last death (death screen, telemetry). */
const hitLog: HitLog[] = [];
/** The running fight, for the reward line (P7). */
const fight = { t: 0, kills: 0, dmg: 0 };
let lastDeath: DeathSummary | null = null;
const deathLine = (d: DeathSummary | null): string => d ? `<div class="death-by">Tod durch <b>${d.by}</b></div>${d.recent.length > 1 || d.recent[0]?.by !== d.by ? `<div class="death-recent">Zuletzt: ${d.recent.map((r) => `${r.by} ${Math.round(r.share * 100)} %`).join(' · ')}</div>` : ''}` : '';
function endStats(won: boolean): string {
  const min = Math.max(1, Math.round((sim.time - runT0) / 60)), fights = Math.min(sim.run.index, level?.encounters.length ?? 0), best = sim.inventory.camp?.endlessBest ?? 0;
  const e = sim.run.endless;
  return `${e !== undefined ? `<div>Endlos · Welle <b>${e}</b> · Rekord <b>${best}</b></div>` : level ? `<div>Kampf <b>${won ? level.encounters.length : fights}</b> von ${level.encounters.length}</div>` : ''}<div><b>${sim.kills}</b> Gegner besiegt · ${min} min</div><div>Schrott <b>+${Math.max(0, sim.inventory.scrap - runScrap0)}</b></div><p class="hint">Beute und Schrott bleiben, Schrott baut das Lager aus. Segen verfallen.</p>`;
}
/** Seconds between the last boss's fall and the end screen. */
const WON_DELAY = 6;
function showWon(): void {
  phase = 'won';
  wonFor = -1;
  saveNow(false); // loot collected after the last encounter and gear changes while exploring
  input.enabled = false;
  input.clear();
  ui.showWon(sim.kills);
  document.getElementById('won-stats')!.innerHTML = endStats(true);
  (document.getElementById('won-endless') as HTMLButtonElement).hidden = !level || isTunnel || sim.run.endless !== undefined;
  document.getElementById('won-title')!.textContent = winText;
  const t = document.getElementById('won-tunnel')!, link = wonLink(mapId, line);
  t.hidden = !level || !link;
  if (link) t.innerHTML = link.html;
  showCampButtons();
  // Playtest 2026-11-18: the way on is the red button: the camp once it is open, else the next map;
  // Weiter erkunden comes after it, Nochmal is gone.
  const camp = document.getElementById('won-camp')!;
  camp.classList.toggle('primary', !camp.hidden);
  t.classList.toggle('primary', camp.hidden && !t.hidden);
  exitChip.hidden = true;
}
/** `camp.freed` id of this map's victory: districts by index, a cleared line as LINE_FREED + line. */
const FREED_ID = isTunnel ? LINE_FREED + line : MAP_FREED[mapId];
/** M19: the tunnel opens once Köpenick is freed; M15: Xhain once the tunnel is cleared; M20: the camp with the S3. */
function goMap(to: MapId, toLine = 0): void { saveProfile(); reloadWith({ map: to, line: toLine }); }
/** M20: the camp is out of reach until the S3 is cleared (Johannes, 2026-11-18): no button leads there before. */
function showCampButtons(): void {
  const open = campOpen(sim.inventory.camp?.freed);
  for (const id of ['open-camp', 'won-camp', 'dead-camp']) document.getElementById(id)!.hidden = !open;
}
// Leaving the map from the victory screen: the same loot warning as Nochmal and Ins Lager (Codex review).
document.getElementById('won-tunnel')!.addEventListener('click', () => {
  if (importantDrops(sim).length > 0 && lootExit !== 'ask') { lootExit = 'ask'; afterLoot = 'map'; document.getElementById('won')!.hidden = true; lootWarn.hidden = false; document.getElementById('loot-find')?.focus(); return; }
  const link = wonLink(mapId, line);
  goMap(link?.to ?? 'koepenick', link?.line ?? 0);
});
/** M19/M15: the title's map buttons (tunnel after Köpenick, Xhain after the tunnel). */
function showTunnelButton(): void {
  // Layout 2A (Johannes 2026-11-18): the network map on the title replaces the map buttons.
  titleNet().show(sim.inventory.camp?.freed ?? []);
  startScreen().setTarget(titleNet().label() || null);
  showCampButtons();
}

for (const id of ['go-tunnel', 'go-xhain']) document.getElementById(id)!.addEventListener('click', (e) => goMap(((e.currentTarget as HTMLElement).dataset.to as MapId | undefined) ?? 'koepenick'));
/** Stay in the freed district: walk, loot, break things, test the build. */
function explore(): void {
  document.getElementById('won')!.hidden = true;
  document.getElementById('pause-finish')!.hidden = false;
  // Playtest 2026-11-18: a visible way out while exploring (the loot chip takes its place while searching).
  exitChip.hidden = lootExit === 'search';
  phase = 'play';
  wonFor = -1;
  input.enabled = true;
  input.clear();
}
/** A new run through the district with the gear the hero has. */
function again(): void {
  lootExit = 'off';
  lootWarn.hidden = true;
  lootChip.hidden = true;
  sim = createSim({ difficulty: sim.difficulty, seed: (opts.seed += 1), stress: opts.stress, level, equipment: sim.equipment, statContext: profileOf(sim).statContext, inventory: sim.inventory });
  renderer?.reset(sim);
  start();
}
/** Everything back to the start: gear, Schrott, checkpoint. The telemetry id stays. */
export function newGame(): void {
  if (!renderer) return;
  clearSave();
  save = null;
  // A wiped save keeps no other map's checkpoint either (Codex review).
  foreignRun = null;
  sim = createSim({ seed: (opts.seed += 1), stress: opts.stress, level, difficulty });
  renderer?.reset(sim);
  ui.setResume(null, difficulty);
  if (persist) { save = snapshot(sim, mapName, false); writeSave(save); cloud.queue(save); }
  start();
}
/** U2 Expedition abbrechen: the run ends as a loss, back to the title; gear and Schrott stay. */
function abortRun(): void {
  optionsScreen().close();
  menu.close();
  if (isCamp) { goMap('koepenick'); return; }
  telemetry.end('quit');
  endExpedition(sim, false);
  saveNow(false);
  phase = 'title';
  input.enabled = false;
  input.clear();
  lootExit = 'off'; lootWarn.hidden = true; lootChip.hidden = true;
  sim = createSim({ difficulty: sim.difficulty, seed: (opts.seed += 1), stress: opts.stress, level, equipment: sim.equipment, statContext: profileOf(sim).statContext, inventory: sim.inventory });
  renderer?.reset(sim);
  ui.setResume(resumeLabel(), difficulty);
showTunnelButton();
  ui.showTitle(); showTunnelButton();
}
let deadFor = 0;
let renderer: GameRenderer | null = null;

const telemetry = new Telemetry(opts.telemetry, opts.autostart);

/** Title › Spielen: a new run keeps the hero's gear but drops the old checkpoint. */
function playNow(): void {
  sim.difficulty = difficulty;
  if (save?.run) { save = { ...save, run: null, difficulty, t: Date.now() }; writeSave(save); cloud.queue(save); ui.setResume(null, difficulty); }
  // The run starts from the profile as it is now (camp purchases: garden, Lazarett, Funkmast act in createSim).
  sim = createSim({ difficulty, seed: (opts.seed += 1), stress: opts.stress, level, spawn: opts.spawn, equipment: sim.equipment, statContext: profileOf(sim).statContext, inventory: sim.inventory });
  renderer?.reset(sim);
  start();
}
const intro = new IntroUi(() => sim, () => { if (phase === 'title') saveProfile(); });
const ui = new Ui(opts, {
  onPlay: () => {
    if (!pickIsHere()) { if (titleNet().canRide()) { saveProfile(); titleNet().rideSelected(); } return; }
    // M17: the intro cards come once, before the first run.
    if (!intro.seen('intro') && !opts.autostart) { intro.showIntro(() => playNow()); return; }
    playNow();
  },
  onResume: () => {
    if (!save?.run) return;
    try { sim = simFromSave(save, { seed: save.run.rng, stress: 0, level }, true); } catch (err) { console.warn('Save unbrauchbar', err); return; }
    renderer?.reset(sim);
    start(true);
  },
  onDifficulty: (id) => {
    if (save?.run) return;
    difficulty = id;
    sim.difficulty = id;
    ui.setDifficulty(id);
  },
  onRetry: () => {
    // Endless mode has no checkpoint: a fall ends it, the next run starts from the beginning.
    if (sim.run.endless !== undefined) { endExpedition(sim, false); again(); return; }
    sim = createSim({ difficulty: sim.difficulty, seed: (opts.seed += 1), stress: opts.stress, level, startAt: checkpoint(), equipment: sim.equipment, statContext: profileOf(sim).statContext, inventory: sim.inventory });
    renderer?.reset(sim);
    start();
  },
  onMenu: () => input.onMenu(),
}, input);

// U3: live effects of the settings (start screen and options screen share them, `ui/settings.ts`).
settingHooks.audio = () => { audio.setVolume(opts.sound ? opts.volume : 0); audio.setMusic(opts.music); };
settingHooks.perf = (on) => ui.showPerf(on);
settingHooks.eco = (on) => { FRAME_MS = 1000 / (on ? 30 : 60); renderer?.setEco(on); };
settingHooks.telemetry = (on) => { telemetry.enabled = on; };
settingHooks.profile = (id) => {
  // Materials and render targets are built once, so a new profile needs a reload. In a run it goes
  // straight back in: the checkpoint is written (mid-fight the last one stays, as with Hauptmenü).
  if (phase === 'play' && persist) {
    if (sim.run.phase === 'fight' || sim.run.endless !== undefined) saveProfile(); else saveNow(true);
    try { sessionStorage.setItem(RESUME_KEY, '1'); } catch { /* lands on the title */ }
  }
  reloadWith({ profile: id });
};

const inventory = new InventoryUi(() => sim);
// U1: one pause menu with tabs (2D layout). The sim does not step while it is open.
const menu = new Menu({
  sim: () => sim,
  inRun: () => phase === 'play',
  where: () => {
    const enc = level?.encounters[Math.min(sim.run.index, level.encounters.length - 1)];
    return level && enc ? `${level.zones[enc.zone]?.name ?? mapName} · Kampf ${Math.min(sim.run.index + 1, level.encounters.length)}/${level.encounters.length}` : mapName;
  },
  mapSvg: () => mapSource?.() ?? null,
  onToggle: (open) => {
    // Gear changes between fights are kept; during a wave they wait for its checkpoint.
    if (!open && phase === 'play' && sim.run.phase === 'travel') saveNow(true);
    else if (!open && sim.run.phase === 'won') saveNow(false);
    input.enabled = phase === 'play' && !open;
    input.clear();
  },
  options: () => optionsScreen().open(),
  blocked: () => optionsScreen().isOpen,
}, inventory);
optionsScreen().onClose = () => menu.resetPad();
input.onInventory = () => { if (phase === 'play') menu.toggle('inv'); };
// M13: the camp between expeditions, from the title and the victory screen.
const camp = new CampUi(() => sim, () => { saveProfile(); ui.setResume(resumeLabel(), difficulty); if (isCamp && phase === 'play') { input.enabled = true; input.clear(); } });
document.getElementById('open-camp')!.addEventListener('click', () => { if (isCamp) startCamp(); else goMap('lager'); });
document.getElementById('won-camp')!.addEventListener('click', () => {
  // Leaving the freed district for the camp ends the run (same loot warning as Nochmal).
  if (importantDrops(sim).length > 0 && lootExit !== 'ask') { lootExit = 'ask'; afterLoot = 'camp'; document.getElementById('won')!.hidden = true; lootWarn.hidden = false; document.getElementById('loot-find')?.focus(); return; }
  toCamp();
});
/** Back to the title with the camp open: a fresh run waits, gear and Schrott stay. */
function toCamp(): void {
  // M20: the camp is its own page (the walkable station).
  if (!isCamp) { lootExit = 'off'; goMap('lager'); return; }
  lootExit = 'off'; lootWarn.hidden = true; lootChip.hidden = true;
  phase = 'title';
  input.enabled = false; input.clear();
  sim = createSim({ difficulty: sim.difficulty, seed: (opts.seed += 1), stress: opts.stress, level, equipment: sim.equipment, statContext: profileOf(sim).statContext, inventory: sim.inventory });
  renderer?.reset(sim);
  ui.setResume(resumeLabel(), difficulty);
  ui.showTitle(); showTunnelButton();
  camp.open();
}
// ---------------------------------------------------------------- M20 walkable camp
/** The ring the hero stands in. */
const campHere = (): ReturnType<typeof campPlaceAt> => (isCamp && map?.def.camp && phase === 'play' ? campPlaceAt(map.def.camp, sim.player.x, sim.player.z) : null);
const netBoard = new NetBoard((to: NetGo) => {
  // Straight into the run on the next page (boot presses Weiter or Losziehen there).
  try { sessionStorage.setItem(GO_KEY, 'play'); } catch { /* the title waits instead */ }
  goMap(to.map, to.map === 'tunnel' ? to.line : 0);
}, () => { input.enabled = phase === 'play'; input.clear(); });
function campAct(): void {
  const p = campHere();
  if (!p || menu.isOpen || camp.isOpen || netBoard.isOpen) return;
  input.clear();
  input.enabled = false;
  if (p.id === 'abfahrt') netBoard.open(sim.inventory.camp?.freed ?? []);
  else camp.open(p.id);
}
/** The prompt over the action arc: what the ring in reach opens. */
function campPrompt(): string | null {
  const p = campHere();
  if (!p) return null;
  if (p.id === 'abfahrt') return 'Zug · Netzplan';
  const st = STATIONS.find((t) => t.id === p.id)!;
  return siteLevel(sim, st.id) === 0 ? `${st.name} · Bauplatz` : st.name;
}
/** Enters the camp: no title, no fights; gear, Schrott and the camp's state come from the profile. */
function startCamp(): void {
  camp.close();
  phase = 'play';
  wonFor = -1;
  input.buffer.clear();
  input.enabled = true;
  ui.showGame();
  ui.setExpedition(false);
  ui.banner('S+U Warschauer Straße', 'Lager');
  audio.start();
  if (opts.tp) { const p = sim.player; p.x = p.px = opts.tp.x; p.z = p.pz = opts.tp.z; }
}

input.onMap = () => { if (phase === 'play' && map && lootExit !== 'search' && !optionsScreen().isOpen) menu.toggle('karte'); };
document.getElementById('won-explore')!.addEventListener('click', explore);
// M18: endless waves around the hero after the district boss.
document.getElementById('won-endless')!.addEventListener('click', () => {
  document.getElementById('won')!.hidden = true;
  phase = 'play'; wonFor = -1;
  input.enabled = true; input.clear();
  startEndless(sim);
  ui.banner('Endlos', `Rekord: Welle ${sim.inventory.camp?.endlessBest ?? 0}`);
});
document.getElementById('dead-camp')!.addEventListener('click', () => { endExpedition(sim, false); toCamp(); });
document.getElementById('pause-finish')!.addEventListener('click', () => { optionsScreen().close(); menu.close(); showWon(); });
document.getElementById('version')!.textContent = `Ruinenstadt Berlin · ${VERSION}`;
// Hauptmenü (playtest 2026-11-16: the title was only reachable with F5): save, back to the title, Weiter resumes.
document.getElementById('to-title')!.addEventListener('click', () => {
  optionsScreen().close();
  menu.close();
  if (isCamp) { goMap('koepenick'); return; }
  // Mid-fight the last checkpoint stays; gear and Schrott are written with the profile.
  if (sim.run.phase === 'fight' || sim.run.endless !== undefined) saveProfile(); else saveNow(true);
  telemetry.end('quit');
  phase = 'title';
  input.enabled = false; input.clear();
  lootExit = 'off'; lootWarn.hidden = true; lootChip.hidden = true;
  sim = freshSim();
  renderer?.reset(sim);
  ui.boss(null);
  ui.setResume(resumeLabel(), difficulty);
  ui.showTitle(); showTunnelButton();
});
// U2: abort the expedition as a loss after a second tap; gear and Schrott stay, the checkpoint goes.
{
  const b = document.getElementById('run-abort') as HTMLButtonElement;
  let armed = 0;
  b.addEventListener('click', () => {
    if (!armed || performance.now() - armed > 4000) { armed = performance.now(); b.textContent = 'Sicher? Erneut tippen'; return; }
    armed = 0; b.textContent = 'Abbrechen';
    abortRun();
  });
}
// "Ganz neu anfangen" asks once: the second click within a few seconds wipes the save.
{
  const b = document.getElementById('new-game') as HTMLButtonElement;
  let armed = 0;
  b.addEventListener('click', () => {
    const idle = '<b>Spielstand löschen</b><small>Ausrüstung, Schrott und Lager weg</small>';
    if (armed && performance.now() - armed < 4000) { b.innerHTML = idle; armed = 0; newGame(); return; }
    armed = performance.now();
    b.innerHTML = '<b>Wirklich? Alles löschen</b><small>Nochmal tippen</small>';
    setTimeout(() => { if (armed && performance.now() - armed >= 3900) { b.innerHTML = idle; armed = 0; } }, 4000);
  });
}
// Zoom in three levels (playtest 2026-11-17): Z cycles, the mouse wheel steps.
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'z' && !e.repeat && phase === 'play') renderer?.zoom(0); });
canvas.addEventListener('wheel', (e) => { if (phase === 'play') renderer?.zoom(Math.sign(e.deltaY)); }, { passive: true });
input.onZoom = (dir) => { if (phase === 'play') renderer?.zoom(dir); };
input.onMenu = () => {
  if (optionsScreen().isOpen) optionsScreen().close();
  else if (menu.isOpen) menu.close();
  else if (phase === 'play') menu.open('inv');
  else if (phase === 'title' && startScreen().active()) optionsScreen().open();
};

const minimap = map ? new Minimap(map.def, map.lots, () => { if (phase === 'play') menu.open('karte'); }) : null;
let mapSource: (() => string) | null = null;
const edges = new EdgeMarkers();

if (map) {
  ui.setExpedition(true);
  mapSource = () => {
    const p = sim.player;
    // Live marks (U2 legend): unused Litfaßsäulen and the enemies alive.
    // Marks scale with the map (playtest 2026-11-18: in the 86 m camp the hero arrow covered a room).
    const k = Math.min(1, Math.max(map.def.bounds.maxX - map.def.bounds.minX, map.def.bounds.maxZ - map.def.bounds.minZ) / 420);
    const marks = sim.content.shrines.filter(h => !h.used).map(h => `<circle cx="${h.x.toFixed(1)}" cy="${h.z.toFixed(1)}" r="3.2" fill="#7dd3ff" stroke="#14282b" stroke-width="0.8"/>`).join('')
      + sim.enemies.filter(e => e.state !== 'dead').map(e => `<circle cx="${e.x.toFixed(1)}" cy="${e.z.toFixed(1)}" r="${e.def.boss ? 3.5 : 1.8}" fill="#c23a2e"/>`).join('');
    const svg = mapSvg(map.def, map.lots, { trees: false, encounters: false }).replace('</svg>', `${marks}</svg>`);
    // The hero: the same arrow as on the minimap, in a ring so it is found at a glance (playtest 2026-11-17).
    const at = `translate(${p.x.toFixed(1)} ${p.z.toFixed(1)}) scale(${k.toFixed(2)})`;
    return svg.replace('</svg>', `<circle transform="${at}" r="9" fill="none" stroke="#f2d14b" stroke-width="1.2" opacity="0.8"/><polygon transform="${at} rotate(${(180 - (p.facing * 180) / Math.PI).toFixed(0)})" points="0,-7 5,5 0,2.5 -5,5" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>`);
  };
  document.getElementById('title-sub')!.textContent = isTunnel && line > 0 ? `${map.def.name} · Richtung ${stopName(line + 1)}` : MAP_SUB[mapId];
} else {
  const sub = document.getElementById('title-sub');
  if (sub) sub.textContent = 'Köpenick · Hinterhof bei Nacht';
}

// A2: the 2D ui click on every menu button (pause menu, camp, intro, title, trade, end screens).
document.addEventListener('click', (e) => { if ((e.target as Element).closest('.overlay button, #menu-btn')) audio.play('ui'); }, true);

/** Wave checkpoint (B1) or, after the last encounter, the profile alone. */
function saveNow(withRun: boolean): void {
  if (!persist) return;
  // Mid-fight there is no checkpoint to write (fights are open: a shop or a hidden blessing can be
  // reached during a wave). Keep the last one instead of replacing it with "no run".
  if (withRun && level && sim.run.phase === 'fight' && sim.player.state !== 'dead') return;
  save = snapshot(sim, mapName, withRun);
  store(save);
}

/** Camp changes at the title: the profile is written, a waiting checkpoint stays. */
function saveProfile(): void {
  if (!persist) return;
  save = save ? { ...save, t: Date.now(), profile: profileOf(sim) } : snapshot(sim, mapName, false);
  store(save);
}

function resumeLabel(): string | null {
  const r = save?.run;
  if (!r || !level) return null;
  return `Kampf ${Math.min(r.index + 1, level.encounters.length)}`;
}
ui.setResume(resumeLabel(), difficulty);

const cloudRow = document.getElementById('cloud-row') as HTMLDivElement;
const cloudInfo = document.getElementById('cloud-info') as HTMLElement;
const cloudToggle = document.getElementById('cloud-toggle') as HTMLButtonElement;
function showCloud(s: SyncState = cloud.state): void {
  const label: Record<SyncState, string> = { off: 'Aus auf diesem Gerät.', sync: 'Verbindet …', on: 'Synchron.', slow: 'Nicht erreichbar, speichert lokal.', conflict: 'Anderes Gerät war neuer. Beim nächsten Start geladen.' };
  cloudInfo.textContent = cloud.code ? `Code ${formatCode(cloud.code)} · ${label[s]}` : label.off;
  (document.getElementById('cloud-copy') as HTMLButtonElement).hidden = !cloud.code;
  cloudToggle.textContent = cloud.code ? 'Ausschalten' : 'Aktivieren';
}
/** A cloud save replaces the local one: back it up, store the remote, reload into it. */
function adoptRemote(remote: SaveV1): void {
  if (save) backupSave(save);
  writeSave(remote);
  location.reload();
}
if (cloud.available) {
  cloudRow.hidden = false;
  cloud.onState = showCloud;
  cloud.autoStart();
  showCloud();
  void cloud.pull(save).then((remote) => {
    if (!remote) return;
    if (phase === 'title') adoptRemote(remote); else cloud.hold();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) void cloud.flush(); });
}
document.getElementById('cloud-copy')!.addEventListener('click', () => { void navigator.clipboard?.writeText(formatCode(cloud.code)).catch(() => prompt('Online-Code:', formatCode(cloud.code))); });
cloudToggle.addEventListener('click', () => {
  if (cloud.code) { if (confirm(`Online-Speichern ausschalten? Code ${formatCode(cloud.code)} gut aufheben.`)) cloud.disable(); } else { cloud.enable(); if (save) cloud.queue(save, 0); }
  showCloud();
});
document.getElementById('cloud-join')!.addEventListener('click', () => {
  const raw = prompt('Online-Code eingeben (z. B. ABCD-1234). Der Stand auf diesem Gerät wird ersetzt, eine Sicherung bleibt.');
  if (!raw) return;
  void cloud.join(raw).then((r) => {
    if ('save' in r) { adoptRemote(r.save); return; }
    cloudInfo.textContent = { code: 'Ungültiger Code.', net: 'Server nicht erreichbar.', unknown: 'Code unbekannt.', damaged: 'Spielstand unbrauchbar.' }[r.error];
  });
});

function start(resumed = false): void {
  audio.start();
  document.getElementById('pause-finish')!.hidden = true;
  exitChip.hidden = true;
  // Phones and tablets play in fullscreen (needs the tap that started the game; refused quietly elsewhere).
  if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement && !navigator.webdriver) void document.documentElement.requestFullscreen?.()?.catch(() => undefined);
  phase = 'play';
  deadFor = 0;
  wonFor = -1;
  lootExit = 'off';
  lootWarn.hidden = true;
  lootChip.hidden = true;
  ui.boss(null);
  if (level) {
    const enc = level.encounters[sim.run.index];
    const zone = enc ? level.zones[enc.zone] : undefined;
    if (zone) ui.banner(zone.name, resumed ? 'Weiter' : sim.run.index === 0 ? (mapId === 'xhain' ? 'Xhain · 1981' : mapId === 'alex' ? 'Alexanderplatz · 1989' : mapId === 'mitte' ? 'Mitte · 2089' : MAP_NAME[mapId]) : 'Neustart', sim.wet ? 'Regen: Strom springt weiter, Feuer brennt kürzer.' : '');
  }
  input.buffer.clear();
  input.enabled = true;
  ui.showGame();
  runScrap0 = sim.inventory.scrap; runT0 = sim.time;
  // Debug: ?tp=x,z beams the hero to a reported spot, ?god keeps her alive while looking.
  sim.god = opts.god;
  if (opts.tp && !resumed) {
    const p = sim.player;
    p.x = p.px = opts.tp.x; p.z = p.pz = opts.tp.z;
  }
  hitLog.length = 0;
  // A checkpoint can resume mid-encounter (no encounterStart then): count the fight from here.
  fight.t = sim.time; fight.kills = sim.kills; fight.dmg = 0;
  telemetry.begin(sim, { map: map ? map.def.name : 'Hof', profile: opts.profile, scale: opts.mapScale, startAt: sim.run.index, input: input.device });
}

const simInput: SimInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, aimAssist: true, attack: false, dodge: false };

function readInput(): SimInput {
  const p = sim.player;
  simInput.moveX = input.enabled ? input.moveX : 0;
  simInput.moveZ = input.enabled ? input.moveZ : 0;
  simInput.aimX = 0;
  simInput.aimZ = 0;
  simInput.aimAssist = true;
  if (input.device === 'mouse') {
    // Mouse attacks go exactly where the cursor is.
    const g = renderer?.groundPoint(input.pointerX, input.pointerY);
    if (g) {
      const dx = g.x - p.x;
      const dz = g.z - p.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.05) {
        simInput.aimX = dx / len;
        simInput.aimZ = dz / len;
        simInput.aimAssist = false;
      }
    }
  } else if (input.stickX !== 0 || input.stickZ !== 0) {
    simInput.aimX = input.stickX;
    simInput.aimZ = input.stickZ;
  }
  simInput.attack = input.buffer.has('attack');
  simInput.dodge = input.buffer.has('dodge');
  simInput.power = input.buffer.has('power');
  simInput.ultimate = input.buffer.has('ultimate');
  simInput.verband = input.buffer.has('verband');
  simInput.molotow = input.buffer.has('molotow');
  // Auto-Angriff (2D autoAtk): press for the player and aim at the target, unless they pressed anything
  // themselves this step (a power or throw keeps the player's own aim).
  if (opts.autoAttack && input.enabled && !simInput.attack && !simInput.dodge && !simInput.power && !simInput.ultimate && !simInput.verband && !simInput.molotow) {
    const t = autoAttackTarget(sim);
    if (t) {
      const len = Math.hypot(t.x - p.x, t.z - p.z);
      simInput.attack = true;
      if (len > 0.05) { simInput.aimX = (t.x - p.x) / len; simInput.aimZ = (t.z - p.z) / len; simInput.aimAssist = false; }
    }
  }
  return simInput;
}

function drainEvents(): void {
  for (const ev of sim.events) {
    renderer?.onEvent(ev, sim);
    audio.onEvent(ev, sim);
    telemetry.event(ev);
    if (ev.type === 'playerHit') { logHit(hitLog, ev.by, ev.damage, sim.time); fight.dmg += ev.damage; }
    else if (ev.type === 'encounterStart') { fight.t = sim.time; fight.kills = sim.kills; fight.dmg = 0; }
    // M20 tunnel: gratings opening, the generator and its power (2D messages).
    tunnelNotice(ev, map?.def, { banner: (t, s) => ui.banner(t, s), toast: (h, s) => lootUi.toast(h, s) });
    switch (ev.type) {
      case 'hit': {
        const feel = HIT_FEEL[ev.weight];
        if (opts.rumble) input.rumble(feel.rumble, feel.rumbleMs + (ev.killed ? 40 : 0));
        break;
      }
      case 'dodge':
        if (opts.rumble) input.rumble(0.25, 30);
        break;
      case 'playerHit':
        ui.flashHurt();
        if (opts.rumble) input.rumble(1, 120);
        break;
      case 'waveStart': {
        const enc = level?.encounters[ev.index];
        if (!enc) break;
        const boss = enc.waves[ev.wave]?.bosses[0];
        if (boss) ui.banner(ENEMIES[boss].name, enc.name);
        else ui.banner(ev.waves > 1 ? `Welle ${ev.wave + 1}/${ev.waves}` : enc.name, ev.waves > 1 ? enc.name : '');
        break;
      }
      case 'encounterClear': {
        // P7 reward moment: what the fight took, a nod for no hit, the heal.
        const secs = Math.round(sim.time - fight.t), kills = sim.kills - fight.kills;
        const line = [`${secs} s`, `${kills} besiegt`, fight.dmg === 0 ? 'ohne Treffer' : '', ev.heal > 0 ? `+${ev.heal} Leben` : ''].filter(Boolean).join(' · ');
        ui.banner(fight.dmg === 0 ? 'Makellos' : 'Geschafft', line);
        break;
      }
      case 'zoneClear': {
        const zone = level?.zones[ev.zone];
        if (zone && ev.zone < 3) ui.banner(`${zone.name} befreit`, 'Weiter zum nächsten Ziel');
        break;
      }
      case 'checkpoint':
        saveNow(true);
        break;
      case 'restEnter': {
        const rest = level?.rests[ev.index];
        if (rest && ev.first) ui.banner(rest.name, 'Rast · hier heilst du');
        break;
      }
      case 'victory':
        // Playtest 2026-11-17: no dialog over the falling boss. The run counts as won now; the
        // end screen follows after a while and offers to stay. The loot warning comes when leaving.
        // 2D tunWin: the first S3 opens the camp at its end.
        if (isTunnel && line === 0 && !campOpen(sim.inventory.camp?.freed)) lootUi.toast('<span style="color:#ef9f27">S+U Warschauer Straße</span> ist jetzt dein Lager', 6);
        endExpedition(sim, true, FREED_ID);
        saveNow(false);
        telemetry.end('win');
        ui.banner(winText);
        wonFor = 0;
        break;
      case 'scrap':
        if (ev.amount > 0) lootUi.float(`+${ev.amount} Schrott`, '#a8957d', ev.x, 1.2, ev.z);
        break;
      case 'legendary':
        ui.banner('Legendär!');
        break;
      case 'pickup':
        if (ev.what === 'item' && persist && !intro.seen('loot')) intro.showTip('loot', () => input.clear());
        if (ev.what === 'item') lootUi.toast(`<span style="color:${rarityColor(ev.rarity, ev.set)}">${ev.name}</span>${ev.upgrade ? ' <span style="color:#8fd16a">▲</span>' : ''}`);
        else if (ev.what === 'heal') lootUi.float(`+${ev.amount} Leben`, '#8fd16a', sim.player.x, 1.8, sim.player.z);
        else if (ev.what === 'food') { lootUi.toast('<span style="color:#f2a04b">Satt</span> · +10% Schaden · 30 s'); if (ev.amount > 0) lootUi.float(`+${ev.amount} Leben`, '#8fd16a', sim.player.x, 1.8, sim.player.z); }
        else if (ev.ingredient) lootUi.float(`+1 ${INGREDIENTS[ev.ingredient].name}`, INGREDIENTS[ev.ingredient].color, sim.player.x, 1.8, sim.player.z);
        else if (ev.material) lootUi.float(`+1 ${MATERIALS[ev.material].name}`, MATERIALS[ev.material].color, sim.player.x, 1.8, sim.player.z);
        break;
      case 'ability':
        if (ev.ultimate) lootUi.float(ev.name, '#f2d14b', sim.player.x, 2.4, sim.player.z);
        if (opts.rumble) input.rumble(ev.ultimate ? 0.8 : 0.4, ev.ultimate ? 120 : 50);
        break;
      case 'shock':
        if (opts.rumble) input.rumble(ev.kind === 'earth' ? 1 : 0.5, ev.kind === 'earth' ? 160 : 70);
        break;
      case 'note':
        lootUi.float(ev.text, ev.color, ev.x, 2.2, ev.z);
        break;
      case 'heal':
        if (ev.amount > 0) lootUi.float(`+${ev.amount} Leben`, '#8fd16a', sim.player.x, 1.8, sim.player.z);
        break;
      case 'secondWind':
        ui.banner('Zweiter Atem');
        break;
      case 'bossRage':
        ui.banner(`${ev.name} tobt`);
        if (opts.rumble) input.rumble(1, 220);
        break;
      case 'zoneHit':
        if (ev.hit && opts.rumble) input.rumble(1, 160);
        break;
      case 'blessing': {
        const perk = PERKS.find((p) => p.id === ev.id);
        if (perk) lootUi.toast(`Segen: <span style="color:#ef9f27">${perk.name}</span>`);
        break;
      }
      case 'streak':
        lootUi.toast(`Serie ${ev.kills} · <span style="color:#ef9f27">+${ev.scrap} Schrott</span>`);
        break;
      case 'shrine':
        lootUi.toast(`Litfaßsäule · <span style="color:#7dd3ff">${SHRINES[ev.id].name}</span>: ${SHRINES[ev.id].description} (60 s)`, 4);
        break;
      case 'runEvent': {
        const T = EVENT_TEXT[ev.kind];
        if (ev.phase === 'start') {
          if (ev.kind === 'ambush' || ev.kind === 'horde') ui.banner(T.title);
          else lootUi.toast(`<span style="color:${T.color}">${T.title}</span>${T.sub ? ` · ${T.sub}` : ''}`, 4);
        } else if (ev.phase === 'done') {
          lootUi.toast(ev.kind === 'rescue' ? `<span style="color:#8fd16a">${ev.text ?? 'Befreit'}</span>` : { cache: 'Versteck gefunden', zone: 'Signal gehalten', crate: 'Nachschub geborgen', trader: '', ambush: '', horde: '', rescue: '' }[ev.kind], 4);
          if (ev.kind === 'rescue') { ui.banner('Befreit'); saveNow(true); }
        } else {
          lootUi.toast({ cache: 'Das Versteck ist verloren', zone: 'Das Signal ist verloren', crate: 'Der Nachschub ist verloren', trader: 'Der Händler ist weitergezogen', ambush: '', horde: '', rescue: '' }[ev.kind]);
        }
        break;
      }
      case 'spawn': {
        // M12c: a one-line tip the first time a kind shows up (2D `tip`).
        const kind = sim.enemies.find((e) => e.id === ev.id)?.kind;
        const tip = kind && SIGHT_TIPS[kind];
        const tips = (sim.inventory.tips ??= {});
        if (tip && kind && !tips[`sight:${kind}`]) { tips[`sight:${kind}`] = 1; lootUi.toast(`<span style="color:#7dd3ff">Tipp</span> · ${tip}`, 5); }
        break;
      }
      case 'kodex':
        lootUi.toast(`Neu im Kodex · <span style="color:#ef9f27">${ev.name}</span>`);
        break;
      case 'endlessWave':
        if (ev.done) ui.banner(`Welle ${ev.n} geschafft`, ev.n >= (sim.inventory.camp?.endlessBest ?? 0) ? 'Neuer Rekord' : '');
        else ui.banner(`Endlos · Welle ${ev.n}`, ev.n % 5 === 0 ? 'Endgegner' : '');
        if (ev.done) saveNow(false);
        break;
      case 'bagFull':
        lootUi.toast('<span style="color:#c23a2e">Rucksack voll</span> · Beute bleibt liegen');
        break;
      default:
        break;
    }
  }
  sim.events.length = 0;
}

let held = false;

// M11d landmark reveal (Johannes 2026-11-17): the game pauses, the camera shows the landmark and waits
// for a tap, click, key or pad button; then it zooms back in and the game goes on. Presses from before
// the view held (an attack mid-fight) do not count.
const revealHint = document.getElementById('reveal-hint')!;
let revealTap = false;
let revealHeld = 0;
for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => { revealTap = true; }, { capture: true });
function revealStep(dt: number): void {
  const r = renderer?.reveal;
  const holding = !!r?.holding && phase === 'play';
  revealHeld = holding ? revealHeld + dt : 0;
  if (revealHeld > 0 && revealHeld <= dt) { revealTap = false; input.clear(); }
  revealHint.hidden = !holding;
  if (!holding) return;
  document.getElementById('reveal-name')!.textContent = r!.name;
  const pad = ['attack', 'dodge', 'power', 'ultimate', 'verband', 'molotow'].some((a) => input.buffer.has(a as Parameters<typeof input.buffer.has>[0]));
  if (revealHeld > 0.35 && (revealTap || pad)) {
    r!.release();
    revealHint.hidden = true;
    input.clear();
  }
  revealTap = false;
}
let lastArea = '', areaAt0 = 0;
let hotAt = 0;
let audioLast = performance.now();
const menuBtn = document.getElementById('menu-btn')!;
let last = performance.now();
let acc = 0;

/** 60 fps cap: the sim steps at 60 Hz, so faster frames only heat the tablet (playtest 2026-11-15, 90+ fps on the Tab S9). */
/** Frame cap: 60 fps, 30 with Akkusparen. */
let FRAME_MS = 1000 / (opts.eco ? 30 : 60);
/** Frames left until the next draw behind a still overlay (trade, blessing, cards). */
let stillSkip = 0;
// Deadline keeps the remainder, so 75, 90 and 144 Hz displays still average 60 fps (Codex review).
let nextAt = 0;

function frame(now: number): void {
  // Audio has its own clock: it ticks on every callback, before the 60 fps cap skips any (Codex review).
  const audioDt = Math.min(.1, Math.max(0, (now - audioLast) / 1000));
  audioLast = now;
  audio.tick(audioDt, {
    district: 0, fighting: phase === 'play' && !menu.isOpen,
    enemies: sim.enemies.filter(e => e.state !== 'dead').length,
    boss: sim.enemies.some(e => e.state !== 'dead' && !!e.def.boss), cyber: false,
  }, sim.player.state === 'dead' ? 1 : sim.player.hp / sim.stats.maxHp);
  // M12c: the drones' rotor whine follows the nearest one.
  let droneD = Infinity;
  if (phase === 'play' && !menu.isOpen) for (const e of sim.enemies) if (e.def.body === 'drone' && e.state !== 'dead') droneD = Math.min(droneD, Math.hypot(e.x - sim.player.x, e.z - sim.player.z));
  audio.rotors(droneD);
  requestAnimationFrame(frame);
  if (now < nextAt - 1) return;
  nextAt = Math.max(nextAt + FRAME_MS, now - FRAME_MS);
  const frameMs = now - last;
  last = now;
  const dt = Math.min(0.1, frameMs / 1000);
  if (!renderer) return;
  renderer.perf.frame(frameMs);
  input.poll(dt, sim.hitstop > 0);
  // M11c: the area name when the hero walks into another area (2D area message).
  if (map && phase === 'play' && now > areaAt0) {
    areaAt0 = now + 400;
    const a = areaAt(map.def, sim.player.x, sim.player.z);
    if (a && a.id !== lastArea) { if (lastArea !== '') lootUi.toast(`<span style="color:#ef9f27">${a.name}</span>`, 2.5); lastArea = a.id; }
  }
  menu.pollPad(now);
  camp.pollPad(now);
  netBoard.pollPad(now);
  if (now > hotAt) { hotAt = now + 500; const hot = phase === 'play' && sim.inventory.bag.some(i => isUpgrade(i, sim.equipment[i.slot])); menuBtn.classList.toggle('hot', hot); }

  // The tutorial card blocks the blessing pad; it is polled after, so its closing press is not a pick (Codex review).
  abilitiesUi.update(sim, phase === 'play' && !menu.isOpen, intro.isOpen);
  intro.pollPad();
  // After the others: a press that opens one of them is then not seen as new there (U3).
  startScreen().pollPad(now);
  optionsScreen().pollPad(now);
  if (abilitiesUi.open && persist && phase === 'play' && !intro.isOpen && !intro.seen('perk')) intro.showTip('perk');
  if (abilitiesUi.open || abilitiesUi.tradeOpen) input.clear();
    revealStep(dt);
  const running = !intro.isOpen && !abilitiesUi.open && !sim.content.tradeOpen && phase !== 'title' && !menu.isOpen && !held && lootExit !== 'ask' && !renderer?.reveal?.active && !camp.isOpen && !netBoard.isOpen;
  const simStart = performance.now();
  if (running) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      // E and Y (power) talk instead while a trader is in reach: no enemies are near then.
      if (sim.content.talk != null && input.buffer.has('power')) { input.buffer.consume('power'); talk(); break; }
      if (isCamp) {
        // The camp is peaceful: E/Y opens the ring in reach, powers and consumables wait for the next run.
        if (input.buffer.has('power') && campHere()) { input.buffer.consume('power'); campAct(); break; }
        for (const a of ['power', 'ultimate', 'verband', 'molotow'] as const) input.buffer.consume(a);
      }
      stepSim(sim, readInput());
      if (sim.consumed.attack) input.buffer.consume('attack');
      if (sim.consumed.dodge) input.buffer.consume('dodge');
      if (sim.consumed.power) input.buffer.consume('power');
      if (sim.consumed.ultimate) input.buffer.consume('ultimate');
      if (sim.consumed.verband) input.buffer.consume('verband');
      if (sim.consumed.molotow) input.buffer.consume('molotow');
      if (sim.content.tradeOpen) { input.clear(); drainEvents(); break; }
      if (sim.abilities.offers.length) input.clear();
      drainEvents();
      acc -= DT;
      steps++;
    }
    // Too far behind (tab was hidden, slow device): drop the backlog instead of spiraling.
    if (steps === 5) acc = 0;
  }
  renderer.perf.simMs = performance.now() - simStart;
  if (isCamp) talkPrompt.say(campPrompt(), running && phase === 'play' && !camp.isOpen && !netBoard.isOpen, input.device);
  else talkPrompt.update(sim.content.talk, running && phase === 'play', input.device);
  // Paused screens (trade, camp, menu) can still raise events, e.g. the coin of a purchase (A2).
  if (!running && sim.events.length) drainEvents();

  if (phase === 'play' && sim.player.state === 'dead') {
    phase = 'dead';
    // A fall ends the expedition (2D): the meal is eaten, the retry starts without it.
    endExpedition(sim, false);
    saveProfile();
    input.enabled = false;
    lastDeath = deathSummary(hitLog, sim.time, sim.stats.maxHp);
    telemetry.died(lastDeath);
    telemetry.end('dead');
  }
  // Telemetry gets the real frame time; `dt` is clamped for the sim and would hide slow frames.
  if (phase === 'play' && running) telemetry.frame(frameMs / 1000, sim, renderer.perf, input.device);
  if (phase === 'dead') {
    deadFor += dt;
    if (deadFor > 1.4 && deadFor - dt <= 1.4) {
      const zone = level ? level.zones[level.encounters[checkpoint()]?.zone ?? 0] : undefined;
      const endless = sim.run.endless !== undefined;
      ui.retryHint(endless ? '' : zone ? `Neustart: ${zone.name}` : '');
      ui.showDead(sim.kills);
      document.getElementById('dead-stats')!.innerHTML = deathLine(lastDeath) + endStats(false);
      document.getElementById('retry')!.textContent = endless ? 'Neue Expedition' : 'Ab Kontrollpunkt';
    }
  }
  if (wonFor >= 0 && phase === 'play') {
    wonFor += dt;
    if (wonFor > WON_DELAY && !abilitiesUi.open && !menu.isOpen) showWon();
  }
  if (lootExit === 'search') {
    const left = importantDrops(sim).length;
    if (left === 0) {
      lootExit = 'off';
      lootChip.hidden = true;
    } else {
      lootChip.hidden = false; exitChip.hidden = true;
      document.getElementById('loot-n')!.textContent = String(left);
      document.getElementById('loot-pad')!.hidden = input.device !== 'gamepad';
    }
  }
  if (level && !isCamp) expeditionHud(dt);
  else if (isCamp) { minimap?.show(phase === 'play' && !camp.isOpen && !netBoard.isOpen); minimap?.update(dt, sim.player, [], []); }
  pollLootPad();
  // Heights are above the local ground (hills and terraces).
  lootUi.update(sim, dt, (x, y, z) => renderer!.screenOf(x, y + groundY(x, z), z), phase === 'play' && !menu.isOpen);

  // Behind a still overlay (trade, blessing choice, cards) the world only idles: draw at about 10 fps
  // instead of full rate (playtest 2026-11-17: the tablet runs hot). The open menu draws nothing.
  // The reveal swing runs on real time while the sim waits for it.
  const still = !running && phase === 'play' && (abilitiesUi.open || abilitiesUi.tradeOpen || intro.isOpen);
  const draw = !menu.isOpen && (!still || --stillSkip <= 0);
  if (still && draw) stillSkip = Math.max(1, Math.round(100 / FRAME_MS));
  if (draw) renderer.render(sim, running ? acc / DT : 1, running ? dt : Math.min(dt, renderer.reveal?.active ? 0.1 : 1 / 30));
  ui.hud(sim.player.hp, sim.stats.maxHp, sim.kills);
  if (opts.showPerf) {
    const pf = renderer.perf;
    ui.setPerf(
      `${pf.fps.toFixed(0)} fps · p95 ${pf.p95.toFixed(1)} ms · sim ${pf.simMs.toFixed(2)} ms\n` +
        `${pf.calls} draw calls · ${(pf.triangles / 1000).toFixed(0)}k Dreiecke · ${sim.enemies.length} Gegner\n` +
        `${PROFILES[opts.profile].label} · x ${sim.player.x.toFixed(1)} z ${sim.player.z.toFixed(1)}`,
    );
  }
}

function expeditionHud(dt: number): void {
  if (!level) return;
  const p = sim.player;
  const enc = level.encounters[sim.run.index];
  const alive = sim.enemies.filter((e) => e.state !== 'dead');
  const travel = sim.run.phase === 'travel';
  minimap?.show(phase === 'play');
  minimap?.update(dt, p, alive.map((e) => ({ x: e.x, z: e.z, boss: !!e.def.boss })), importantDrops(sim).map((d) => ({ x: d.x, z: d.z, color: dropColor(d) })));
  // Edge triangles: the objective while travelling, the last three enemies of a wave (2D rule).
  const marks: Array<{ x: number; y: number; color: string }> = [];
  if (renderer && phase === 'play') {
    if (enc && travel) marks.push({ ...renderer.screenOf(enc.x, 0, enc.z), color: '#43d1cf' });
    if (!travel && sim.run.toSpawn <= 0 && sim.run.bossesToSpawn.length === 0 && alive.length <= 3) {
      for (const e of alive) marks.push({ ...renderer.screenOf(e.x, 1, e.z), color: e.def.boss ? '#ff6a2a' : '#c23a2e' });
    }
  }
  // Open events: trader, captive, cache, zone, supply drop.
  if (renderer && phase === 'play') for (const m of contentMarks(sim)) marks.push({ ...renderer.screenOf(m.x, groundY(m.x, m.z) + 1, m.z), color: EVENT_TEXT[m.kind].color });
  if (lootExit === 'search' && renderer) {
    const d = nearestImportantDrop(sim);
    if (d) marks.push({ ...renderer.screenOf(d.x, groundY(d.x, d.z) + 0.5, d.z), color: dropColor(d) });
  }
  edges.update(marks);
  const searchTarget = lootExit === 'search' ? nearestImportantDrop(sim) : null;
  if (searchTarget) {
    const dx = searchTarget.x - p.x;
    const dz = searchTarget.z - p.z;
    ui.objective(`Beute · ${Math.round(Math.hypot(dx, dz))} m`, Math.atan2(dx, -dz));
  } else if (sim.run.endless !== undefined) {
    ui.objective(`Endlos · Welle ${sim.run.endless + (sim.run.phase === 'fight' ? 1 : 0)}`, null);
  } else if (!enc) {
    ui.objective(winText, null);
  } else if (sim.run.phase === 'travel') {
    const dx = enc.x - p.x;
    const dz = enc.z - p.z;
    // The camera looks north: world X is screen right, world -Z is screen up.
    ui.objective(`${enc.name} · ${Math.round(Math.hypot(dx, dz))} m`, Math.atan2(dx, -dz));
  } else if (tunnelObjective(sim)) {
    ui.objective(tunnelObjective(sim)!, null);
  } else {
    ui.objective(enc.waves.length > 1 ? `${enc.name} · Welle ${Math.min(sim.run.wave + 1, enc.waves.length)}/${enc.waves.length}` : enc.name, null);
  }
  const boss = sim.enemies.find((e) => e.def.boss && e.state !== 'dead');
  ui.boss(boss ? boss.def.name : null, boss ? boss.hp / boss.maxHp : 0);
}

/** Hook for the smoke test and the headless perf run. Not used by the game itself. */
declare global {
  interface Window {
    __game?: {
      phase(): Phase;
      sim(): Sim;
      perf(): { fps: number; p95: number; calls: number; triangles: number; simMs: number } | null;
      start(): void;
      setLoadout(equipment: Equipment, context?: Partial<StatContext>): void;
      collectItem(item: Item): boolean;
      /** Stops the automatic sim steps so a script can step by hand. */
      hold(on: boolean): void;
      step(input: Partial<SimInput>, steps: number): void;
    };
  }
}
window.__game = {
  phase: () => phase,
  sim: () => sim,
  perf: () => (renderer ? { fps: renderer.perf.fps, p95: renderer.perf.p95, calls: renderer.perf.calls, triangles: renderer.perf.triangles, simMs: renderer.perf.simMs } : null),
  start,
  setLoadout: (equipment, context) => setLoadout(sim, equipment, context),
  collectItem: item => collectItem(sim, item),
  hold: (on) => {
    held = on;
  },
  step: (partial, steps) => {
    for (let i = 0; i < steps; i++) {
      stepSim(sim, { ...NO_INPUT, ...partial });
      drainEvents();
    }
  },
};

// The map switch shows on the first title too (a save with Köpenick freed, or the tunnel page).
showTunnelButton();

// M15: Alexanderplatz is the daylight district (`?sky=a|b|c` compares the afternoon variants); Mitte has its neon night.
const sky = skyFor(opts.map, new URLSearchParams(location.search).get('sky'));
export const ready: Promise<boolean> = GameRenderer.create(canvas, {
  profile: PROFILES[opts.profile], look: { ...LOOK, ...sky.look }, sky, debugHit: opts.debugHit, debugFlow: opts.debugFlow, cam: opts.cam, boxShadows: opts.boxShadows, cut: opts.cut, reveal: opts.reveal,
  map: map ? { def: map.def, lots: map.lots, props: map.props, breakables: map.level.breakables } : undefined,
  mechs: opts.spawn.some((k) => /^(uhrwerk|volkskoloss|weltzeituhr)/.test(k)),
})
  .then((r) => {
    renderer = r;
    r.setEco(opts.eco);
    r.reset(sim);
    // H1 step 5: the live, turnable hero replaces the painted portrait in the inventory doll.
    const preview = r.heroPreview(() => ({ look: heroLook(sim.equipment), weapon: weaponModel(sim.stats.kind, sim.equipment.w?.base ?? 'rohr'), element: sim.stats.elements[0] }));
    void preview.warm().then(() => inventory.setPortrait(preview));
    window.addEventListener('resize', () => r.resize());
    ui.loaded();
    if (isCamp) startCamp();
    else if (opts.autostart) start();
    return true;
  })
  .catch((err: unknown) => {
    console.error(err);
    ui.failed('Start fehlgeschlagen. WebGL 2 nötig.');
    return false;
  });
requestAnimationFrame(frame);
