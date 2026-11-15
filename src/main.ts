// Game loop: fixed 60 Hz sim steps, interpolated rendering, input polled every frame.
import './ui/style.css';
import { GameAudio } from './audio/audio';
import { HIT_FEEL, PLAYER } from './data/combat';
import { Input } from './input/input';
import { readOptions, reloadWith, storeOptions } from './options';
import { LOOK } from './render/looks';
import { PROFILES } from './render/profile';
import { GameRenderer } from './render/renderer';
import { createSim, stepSim } from './sim/sim';
import { DT, NO_INPUT, type Sim, type SimInput } from './sim/types';
import { Ui } from './ui/ui';

type Phase = 'title' | 'play' | 'dead';

const opts = readOptions();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new GameAudio();
audio.setVolume(opts.volume);
const input = new Input(canvas);

let sim: Sim = createSim({ seed: opts.seed, stress: opts.stress });
let phase: Phase = 'title';
let deadFor = 0;
let renderer: GameRenderer | null = null;

const ui = new Ui(opts, {
  onPlay: () => start(),
  onRetry: () => {
    sim = createSim({ seed: (opts.seed += 1), stress: opts.stress });
    renderer?.reset(sim);
    start();
  },
  onOptionsToggle: (open) => {
    input.enabled = phase === 'play' && !open;
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
  onRumble: (on) => {
    opts.rumble = on;
    storeOptions(opts);
  },
  onShowPerf: (on) => {
    opts.showPerf = on;
    storeOptions(opts);
  },
}, input);

input.onMenu = () => {
  if (phase !== 'title') ui.toggleOptions(!ui.optionsOpen);
};

function start(): void {
  audio.start();
  phase = 'play';
  deadFor = 0;
  input.buffer.clear();
  input.enabled = true;
  ui.showGame();
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
    switch (ev.type) {
      case 'swing':
        audio.swing(ev.weight);
        break;
      case 'hit': {
        const feel = HIT_FEEL[ev.weight];
        audio.hit(ev.weight, ev.killed);
        if (opts.rumble) input.rumble(feel.rumble, feel.rumbleMs + (ev.killed ? 40 : 0));
        break;
      }
      case 'dodge':
        audio.dodge();
        if (opts.rumble) input.rumble(0.25, 30);
        break;
      case 'playerHit':
        audio.hurt();
        ui.flashHurt();
        if (opts.rumble) input.rumble(1, 120);
        break;
      case 'playerDie':
        audio.death();
        break;
      case 'enemyWindup':
        audio.growl();
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

function frame(now: number): void {
  requestAnimationFrame(frame);
  const frameMs = now - last;
  last = now;
  const dt = Math.min(0.1, frameMs / 1000);
  if (!renderer) return;
  renderer.perf.frame(frameMs);
  input.poll(dt, sim.hitstop > 0);

  const running = phase !== 'title' && !ui.optionsOpen && !held;
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
  }
  if (phase === 'dead') {
    deadFor += dt;
    if (deadFor > 1.4 && deadFor - dt <= 1.4) ui.showDead(sim.kills);
  }

  renderer.render(sim, running ? acc / DT : 1, running ? dt : Math.min(dt, 1 / 30));
  ui.hud(sim.player.hp, PLAYER.maxHp, sim.kills);
  if (opts.showPerf) {
    const pf = renderer.perf;
    ui.setPerf(
      `${pf.fps.toFixed(0)} fps · p95 ${pf.p95.toFixed(1)} ms · sim ${pf.simMs.toFixed(2)} ms\n` +
        `${pf.calls} draw calls · ${(pf.triangles / 1000).toFixed(0)}k Dreiecke · ${sim.enemies.length} Gegner\n` +
        PROFILES[opts.profile].label,
    );
  }
}

/** Hook for the smoke test and the headless perf run. Not used by the game itself. */
declare global {
  interface Window {
    __game?: {
      phase(): Phase;
      sim(): Sim;
      perf(): { fps: number; p95: number; calls: number; triangles: number; simMs: number } | null;
      start(): void;
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

GameRenderer.create(canvas, { profile: PROFILES[opts.profile], look: LOOK, debugHit: opts.debugHit, debugFlow: opts.debugFlow, cam: opts.cam })
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
