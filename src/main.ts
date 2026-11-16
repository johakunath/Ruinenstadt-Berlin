import { InventoryUi } from './ui/inventory';
import { collectItem } from './sim/inventory';
import type { Item } from './sim/items';
// Game loop: fixed 60 Hz sim steps, interpolated rendering, input polled every frame.
import './ui/style.css';
import { GameAudio } from './audio/audio';
import { HIT_FEEL } from './data/combat';
import { Input } from './input/input';
import { readOptions, reloadWith, storeOptions } from './options';
import { LOOK } from './render/looks';
import { PROFILES } from './render/profile';
import { GameRenderer } from './render/renderer';
import { setLoadout } from './sim/loadout';
import type { Equipment, StatContext } from './sim/stats';
import { createSim, stepSim } from './sim/sim';
import { DT, NO_INPUT, type Sim, type SimInput } from './sim/types';
import { Ui } from './ui/ui';
import { koepenickMap } from './data/koepenick';
import { generateLots, generateProps, mapLevel } from './data/map';
import { mapSvg } from './data/map-svg';
import { EdgeMarkers, Minimap } from './ui/minimap';
import { ENEMIES } from './data/enemies';
import type { Level } from './sim/level';
import { Telemetry } from './telemetry';
import { LootLabels, rarityColor } from './ui/loot-labels';
import { dropColor, importantDrops, nearestImportantDrop } from './sim/loot';
import { MATERIALS } from './data/crafting';

type Phase = 'title' | 'play' | 'dead' | 'won';

const opts = readOptions();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new GameAudio();
audio.setVolume(opts.volume);
audio.setMusic(opts.music);
audio.setEco(opts.profile === 'leistung');
const input = new Input(canvas);

// Köpenick (M11) unless ?map=hof asks for the gate 1 courtyard.
const map = opts.map === 'koepenick' ? (() => {
  const def = koepenickMap(opts.mapScale);
  const lots = generateLots(def);
  const props = generateProps(def, lots);
  return { def, lots, props, level: mapLevel(def, lots, props) };
})() : null;
const level: Level | undefined = map?.level;

let sim: Sim = createSim({ seed: opts.seed, stress: opts.stress, level, startAt: opts.startAt });
let phase: Phase = 'title';
let wonFor = -1;
/** Exit warning: 'ask' shows the modal, 'search' leads the hero to the valuable loot left behind. */
let lootExit: 'off' | 'ask' | 'search' = 'off';
const lootUi = new LootLabels();
const lootWarn = document.getElementById('lootwarn') as HTMLDivElement;
const lootChip = document.getElementById('loot-chip') as HTMLButtonElement;

function finishLootExit(leave: boolean): void {
  lootWarn.hidden = true;
  input.enabled = phase === 'play';
  input.clear();
  if (leave) {
    lootExit = 'off';
    lootChip.hidden = true;
    wonFor = 0;
  } else {
    lootExit = 'search';
  }
}
document.getElementById('loot-find')!.addEventListener('click', () => finishLootExit(false));
document.getElementById('loot-leave')!.addEventListener('click', () => finishLootExit(true));
lootChip.addEventListener('click', () => finishLootExit(true));
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
let deadFor = 0;
let renderer: GameRenderer | null = null;

const telemetry = new Telemetry(opts.telemetry, opts.autostart);

const ui = new Ui(opts, {
  onPlay: () => start(),
  onRetry: () => {
    sim = createSim({ seed: (opts.seed += 1), stress: opts.stress, level, startAt: checkpoint(), equipment: sim.equipment, statContext: sim.statContext, inventory: sim.inventory });
    renderer?.reset(sim);
    start();
  },
  onAgain: () => {
    sim = createSim({ seed: (opts.seed += 1), stress: opts.stress, level, equipment: sim.equipment, statContext: sim.statContext, inventory: sim.inventory });
    renderer?.reset(sim);
    start();
  },
  onMapToggle: (open) => {
    input.enabled = phase === 'play' && !open && !inventory.open;
    input.clear();
  },
  onOptionsToggle: (open) => {
    input.enabled = phase === 'play' && !open && !inventory.open;
    input.clear();
  },
  onProfile: (id) => {
    opts.profile = id;
    storeOptions(opts);
    reloadWith({ profile: id });
  },
  onVolume: (v) => {
    opts.volume = v;
    audio.setVolume(v);
    storeOptions(opts);
  },
  onMusic: (on) => {
    opts.music = on; audio.setMusic(on); storeOptions(opts);
  },
  onRumble: (on) => {
    opts.rumble = on;
    storeOptions(opts);
  },
  onShowPerf: (on) => {
    opts.showPerf = on;
    storeOptions(opts);
  },
  onTelemetry: (on) => {
    opts.telemetry = on;
    telemetry.enabled = on;
    storeOptions(opts);
  },
}, input);

const inventory = new InventoryUi(() => sim, open => {
  input.enabled = phase === 'play' && !open && !ui.mapOpen && !ui.optionsOpen;
  input.clear();
});
input.onInventory = () => {
  if (phase === 'play' && !ui.mapOpen && !ui.optionsOpen) inventory.toggle(!inventory.open);
};
document.getElementById('inventory-btn')!.addEventListener('click', input.onInventory);
window.addEventListener('keydown', e => {
  if (inventory.open && ['KeyM', 'Tab', 'KeyP', 'Escape'].includes(e.code)) {
    if (e.code === 'Escape' || e.code === 'KeyP') inventory.toggle(false);
    if (e.code !== 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, { capture: true });
input.onMenu = () => {
  if (inventory.open) { inventory.toggle(false); return; }
  if (phase !== 'title') ui.toggleOptions(!ui.optionsOpen);
};

const minimap = map ? new Minimap(map.def, map.lots, () => ui.toggleMap(true)) : null;
const edges = new EdgeMarkers();

if (map) {
  ui.setExpedition(true);
  ui.mapSource = () => {
    const p = sim.player;
    const svg = mapSvg(map.def, map.lots, { trees: false, done: sim.run.index });
    return svg.replace('</svg>', `<circle cx="${p.x.toFixed(1)}" cy="${p.z.toFixed(1)}" r="5" fill="#b8261c" stroke="#f0e2c8" stroke-width="1.5"/></svg>`);
  };
} else {
  const sub = document.getElementById('title-sub');
  if (sub) sub.textContent = 'Köpenick · Hinterhof bei Nacht';
}

function start(): void {
  audio.start();
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
    if (zone) ui.banner(zone.name, sim.run.index === 0 ? 'Köpenick' : 'Neustart');
  }
  input.buffer.clear();
  input.enabled = true;
  ui.showGame();
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
  return simInput;
}

function drainEvents(): void {
  for (const ev of sim.events) {
    renderer?.onEvent(ev, sim);
    audio.onEvent(ev);
    telemetry.event(ev);
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
      case 'encounterClear':
        ui.banner('Geschafft', ev.heal > 0 ? `+${ev.heal} Leben` : '');
        break;
      case 'zoneClear': {
        const zone = level?.zones[ev.zone];
        if (zone && ev.zone < 3) ui.banner(`${zone.name} befreit`, 'Weiter zum nächsten Ziel');
        break;
      }
      case 'restEnter': {
        const rest = level?.rests[ev.index];
        if (rest && ev.first) ui.banner(rest.name, 'Rast · hier heilst du');
        break;
      }
      case 'victory':
        if (importantDrops(sim).length > 0) {
          lootExit = 'ask';
          input.enabled = false;
          input.clear();
          lootWarn.hidden = false;
          document.getElementById('loot-find')?.focus();
        } else wonFor = 0;
        break;
      case 'scrap':
        if (ev.amount > 0) lootUi.float(`+${ev.amount} Schrott`, '#a8957d', ev.x, 1.2, ev.z);
        break;
      case 'legendary':
        ui.banner('Legendär!');
        break;
      case 'pickup':
        if (ev.what === 'item') lootUi.toast(`<span style="color:${rarityColor(ev.rarity, ev.set)}">${ev.name}</span>${ev.upgrade ? ' <span style="color:#8fd16a">▲</span>' : ''}`);
        else if (ev.what === 'heal') lootUi.float(`+${ev.amount} Leben`, '#8fd16a', sim.player.x, 1.8, sim.player.z);
        else if (ev.material) lootUi.float(`+1 ${MATERIALS[ev.material].name}`, MATERIALS[ev.material].color, sim.player.x, 1.8, sim.player.z);
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
let last = performance.now();
let acc = 0;

/** 60 fps cap: the sim steps at 60 Hz, so faster frames only heat the tablet (playtest 2026-11-15, 90+ fps on the Tab S9). */
const FRAME_MS = 1000 / 60;
// Deadline keeps the remainder, so 75, 90 and 144 Hz displays still average 60 fps (Codex review).
let nextAt = 0;

function frame(now: number): void {
  audio.tick(Math.min(.1, Math.max(0, (now - last) / 1000)), {
    district: 0, fighting: phase === 'play' && !ui.optionsOpen && !ui.mapOpen && !inventory.open,
    enemies: sim.enemies.filter(e => e.state !== 'dead').length,
    boss: sim.enemies.some(e => e.state !== 'dead' && !!e.def.boss), cyber: false,
  });
  requestAnimationFrame(frame);
  if (now < nextAt - 1) return;
  nextAt = Math.max(nextAt + FRAME_MS, now - FRAME_MS);
  const frameMs = now - last;
  last = now;
  const dt = Math.min(0.1, frameMs / 1000);
  if (!renderer) return;
  renderer.perf.frame(frameMs);
  input.poll(dt, sim.hitstop > 0);
  inventory.pollPad(now);

  const running = phase !== 'title' && !ui.optionsOpen && !ui.mapOpen && !inventory.open && !held && lootExit !== 'ask';
  const simStart = performance.now();
  if (running) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      stepSim(sim, readInput());
      if (sim.consumed.attack) input.buffer.consume('attack');
      if (sim.consumed.dodge) input.buffer.consume('dodge');
      drainEvents();
      acc -= DT;
      steps++;
    }
    // Too far behind (tab was hidden, slow device): drop the backlog instead of spiraling.
    if (steps === 5) acc = 0;
  }
  renderer.perf.simMs = performance.now() - simStart;

  if (phase === 'play' && sim.player.state === 'dead') {
    phase = 'dead';
    input.enabled = false;
    telemetry.end('dead');
  }
  // Telemetry gets the real frame time; `dt` is clamped for the sim and would hide slow frames.
  if (phase === 'play' && running) telemetry.frame(frameMs / 1000, sim, renderer.perf, input.device);
  if (phase === 'dead') {
    deadFor += dt;
    if (deadFor > 1.4 && deadFor - dt <= 1.4) {
      const zone = level ? level.zones[level.encounters[checkpoint()]?.zone ?? 0] : undefined;
      ui.retryHint(zone ? `Neustart: ${zone.name}` : '');
      ui.showDead(sim.kills);
    }
  }
  if (wonFor >= 0 && phase === 'play') {
    wonFor += dt;
    if (wonFor > 2.5) {
      phase = 'won';
      telemetry.end('win');
      input.enabled = false;
      ui.showWon(sim.kills);
    }
  }
  if (lootExit === 'search') {
    const left = importantDrops(sim).length;
    if (left === 0) finishLootExit(true);
    else {
      lootChip.hidden = false;
      document.getElementById('loot-n')!.textContent = String(left);
    }
  }
  if (level) expeditionHud(dt);
  lootUi.update(sim, dt, (x, y, z) => renderer!.screenOf(x, y, z), phase === 'play' && !inventory.open);

  if (!inventory.open) renderer.render(sim, running ? acc / DT : 1, running ? dt : Math.min(dt, 1 / 30));
  ui.hud(sim.player.hp, sim.stats.maxHp, sim.kills);
  if (opts.showPerf) {
    const pf = renderer.perf;
    ui.setPerf(
      `${pf.fps.toFixed(0)} fps · p95 ${pf.p95.toFixed(1)} ms · sim ${pf.simMs.toFixed(2)} ms\n` +
        `${pf.calls} draw calls · ${(pf.triangles / 1000).toFixed(0)}k Dreiecke · ${sim.enemies.length} Gegner\n` +
        PROFILES[opts.profile].label,
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
  minimap?.update(dt, sim.run.index, p, enc && travel ? enc : null, alive.map((e) => ({ x: e.x, z: e.z, boss: !!e.def.boss })), importantDrops(sim).map((d) => ({ x: d.x, z: d.z, color: dropColor(d) })));
  // Edge triangles: the objective while travelling, the last three enemies of a wave (2D rule).
  const marks: Array<{ x: number; y: number; color: string }> = [];
  if (renderer && phase === 'play') {
    if (enc && travel) marks.push({ ...renderer.screenOf(enc.x, 0, enc.z), color: '#43d1cf' });
    if (!travel && sim.run.toSpawn <= 0 && sim.run.bossesToSpawn.length === 0 && alive.length <= 3) {
      for (const e of alive) marks.push({ ...renderer.screenOf(e.x, 1, e.z), color: e.def.boss ? '#ff6a2a' : '#c23a2e' });
    }
  }
  if (lootExit === 'search' && renderer) {
    const d = nearestImportantDrop(sim);
    if (d) marks.push({ ...renderer.screenOf(d.x, 0.5, d.z), color: dropColor(d) });
  }
  edges.update(marks);
  const searchTarget = lootExit === 'search' ? nearestImportantDrop(sim) : null;
  if (searchTarget) {
    const dx = searchTarget.x - p.x;
    const dz = searchTarget.z - p.z;
    ui.objective(`Beute · ${Math.round(Math.hypot(dx, dz))} m`, Math.atan2(dx, -dz));
  } else if (!enc) {
    ui.objective('Köpenick befreit', null);
  } else if (sim.run.phase === 'travel') {
    const dx = enc.x - p.x;
    const dz = enc.z - p.z;
    // The camera looks north: world X is screen right, world -Z is screen up.
    ui.objective(`${enc.name} · ${Math.round(Math.hypot(dx, dz))} m`, Math.atan2(dx, -dz));
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

GameRenderer.create(canvas, {
  profile: PROFILES[opts.profile], look: LOOK, debugHit: opts.debugHit, debugFlow: opts.debugFlow, cam: opts.cam,
  map: map ? { def: map.def, lots: map.lots, props: map.props, breakables: map.level.breakables } : undefined,
})
  .then((r) => {
    renderer = r;
    r.reset(sim);
    window.addEventListener('resize', () => r.resize());
    ui.loaded();
    if (opts.autostart) start();
  })
  .catch((err: unknown) => {
    console.error(err);
    ui.failed('Start fehlgeschlagen. WebGL 2 nötig.');
  });
requestAnimationFrame(frame);
