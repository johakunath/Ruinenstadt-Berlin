// S3 boss voices (docs/tasks/wp5-enemies.md › Step 4): renders every line in LINES to
// assets/voices/<kind>-<trigger>.ogg (Ogg Opus, mono, 24 kHz) with Piper TTS and ffmpeg.
//
// Piper is a build tool only; nothing of it ships. Voices (all CC0, see assets/LICENSES.md):
//   de_DE-thorsten-medium, de_DE-thorsten_emotional-medium (8 emotion speakers), de_DE-kerstin-low.
//
// Run:
//   pip install piper-tts==1.8.0     (puts `piper` on PATH; or set PIPER=/path/to/piper)
//   ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg), with libopus
//   npm run assets:voices            (all lines)
//   npm run assets:voices -- tuersteher grenzer-rage   (only these kinds or files)
// The models (about 200 MB) are downloaded once into assets-src/voices/ (gitignored; VOICE_MODELS
// overrides the folder). Only the generated clips are committed. The runtime reads the files it
// finds in assets/voices/ (src/audio/voices.ts); a new trigger also needs its rule there.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = 'assets/voices';
const MODELS = process.env.VOICE_MODELS ?? 'assets-src/voices';
const PIPER = process.env.PIPER ?? 'piper';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE';

/** Piper models: file stem, Hugging Face folder, sample rate. */
const MODEL = {
  thorsten: { stem: 'de_DE-thorsten-medium', dir: 'thorsten/medium', rate: 22050 },
  emo: { stem: 'de_DE-thorsten_emotional-medium', dir: 'thorsten_emotional/medium', rate: 22050 },
  kerstin: { stem: 'de_DE-kerstin-low', dir: 'kerstin/low', rate: 16000 },
};
/** thorsten_emotional speaker ids (speaker_id_map in its .onnx.json). */
const EMO = { amused: 0, angry: 1, disgusted: 2, drunk: 3, neutral: 4, sleepy: 5, surprised: 6, whisper: 7 };

// ffmpeg chains per body. `sr` is the model's rate; pitch shifts by resampling, tempo is put back with atempo.
const pitch = (sr, p, tempo = 1 / p) => `asetrate=${Math.round(sr * p)},aresample=${sr},atempo=${tempo.toFixed(3)}`;
const FX = {
  /** Undead human: pitched down, a little tanh distortion, the top rolled off. */
  undead: (sr, p = 0.86, drive = 3) => `${pitch(sr, p)},volume=${drive},asoftclip=type=tanh,lowpass=f=5200`,
  /** Ghoul with a hall (Dirigent, Bassprediger): undead plus a short room. */
  hall: (sr, p = 0.88) => `${FX.undead(sr, p, 2.5)},apad=pad_dur=0.4,aecho=0.8:0.5:45|90:0.35|0.2`,
  /** Female ghoul (Kerstin): slightly down, a slow wobble. */
  hag: (sr, p = 0.92, wobble = 5) => `${pitch(sr, p)},vibrato=f=${wobble}:d=0.12,volume=2.2,asoftclip=type=tanh`,
  /** Plant (Wurzel-Mutter): down, chorus like hollow wood. */
  plant: (sr) => `${pitch(sr, 0.84, 1.05)},chorus=0.6:0.8:40|55:0.4|0.3:0.25|0.4:2|1.5,lowpass=f=4200`,
  /** Robot (Wachdrohne): radio band, ring mod at 55 Hz, bitcrush. */
  radio: (sr) => `highpass=f=420,lowpass=f=3200,aeval='val(0)*(0.45+0.55*sin(2*PI*55*t))':c=same,acrusher=bits=7:samples=2:mix=0.55,volume=2.4,asoftclip=type=tanh`,
  /** Clockwork (Uhrwerkläufer): down, hard ring mod at 31 Hz (ticking buzz), bitcrush. */
  clockwork: (sr) => `${pitch(sr, 0.9)},aeval='val(0)*sin(2*PI*31*t)':c=same,acrusher=bits=6:samples=3:mix=0.5,volume=3,asoftclip=type=tanh,highpass=f=120`,
  /** Plattenbau machine (Koloss): far down, slow ring mod, grinding crush. */
  koloss: (sr) => `${pitch(sr, 0.72, 1.2)},aeval='val(0)*(0.35+0.65*sin(2*PI*22*t))':c=same,acrusher=bits=5:samples=4:mix=0.45,volume=3,asoftclip=type=tanh,lowpass=f=3600`,
  /** The Weltzeituhr: down, metallic ring, a long reverb tail. */
  bell: (sr) => `${pitch(sr, 0.8, 1.1)},aeval='val(0)*(0.6+0.4*sin(2*PI*110*t))':c=same,apad=pad_dur=1.1,aecho=0.8:0.7:70|160|290|430:0.5|0.38|0.26|0.16`,
};

/**
 * The line table. kind = EnemyKind, trigger = start (fight begins) | rage (bossRage) | special (its signature special;
 * which special is in SIGNATURE, src/audio/voices.ts). Reused texts: „Antreten!“, „Alarm!“, „Nicht auf der Liste!“,
 * „Gemeinde!“, „Fortissimo!“, „Stillstand“ (notes in src/sim/ai.ts), „Kein Einlass“ (task).
 * voice: model and speaker; len: Piper length scale (slower = larger); fx: chain from FX.
 */
const ANGRY = { model: 'emo', speaker: EMO.angry };
const CALM = { model: 'emo', speaker: EMO.neutral };
const FLAT = { model: 'thorsten', speaker: 0 };
const KERSTIN = { model: 'kerstin', speaker: 0 };
const LINES = [
  // Köpenick 1906: Prussian officers.
  { kind: 'feldwebel', trigger: 'start', text: 'Stillgestanden!', voice: ANGRY, len: 1.05, fx: (sr) => FX.undead(sr, 0.86) },
  { kind: 'feldwebel', trigger: 'special', text: 'Antreten!', voice: ANGRY, len: 1.1, fx: (sr) => FX.undead(sr, 0.86) },
  { kind: 'feldwebel', trigger: 'rage', text: 'Marsch, marsch!', voice: ANGRY, len: 1, fx: (sr) => FX.undead(sr, 0.86, 4) },
  { kind: 'hauptmann', trigger: 'start', text: 'Im Namen des Kaisers!', voice: CALM, len: 1.1, fx: (sr) => FX.undead(sr, 0.82) },
  { kind: 'hauptmann', trigger: 'special', text: 'Wache, antreten!', voice: ANGRY, len: 1.05, fx: (sr) => FX.undead(sr, 0.82) },
  { kind: 'hauptmann', trigger: 'rage', text: 'Sie sind verhaftet!', voice: ANGRY, len: 1.05, fx: (sr) => FX.undead(sr, 0.82, 4) },
  { kind: 'waechter', trigger: 'start', text: 'Niemand betritt den Turm.', voice: CALM, len: 1.15, fx: (sr) => FX.hall(sr, 0.84) },
  { kind: 'waechter', trigger: 'special', text: 'Feuer vom Turm!', voice: ANGRY, len: 1.05, fx: (sr) => FX.hall(sr, 0.84) },
  { kind: 'waechter', trigger: 'rage', text: 'Der Turm sieht alles!', voice: ANGRY, len: 1.05, fx: (sr) => FX.hall(sr, 0.84) },
  // Tunnel: the conductor.
  { kind: 'schaffner', trigger: 'start', text: 'Fahrkarten, bitte!', voice: CALM, len: 1.05, fx: (sr) => FX.undead(sr, 0.88) },
  { kind: 'schaffner', trigger: 'special', text: 'Zurückbleiben!', voice: ANGRY, len: 1.1, fx: (sr) => FX.undead(sr, 0.88, 4) },
  { kind: 'schaffner', trigger: 'rage', text: 'Endstation!', voice: ANGRY, len: 1.15, fx: (sr) => FX.undead(sr, 0.86, 4) },
  // Xhain 1981.
  { kind: 'grenzer', trigger: 'start', text: 'Halt! Stehen bleiben!', voice: ANGRY, len: 1, fx: (sr) => FX.undead(sr, 0.9) },
  { kind: 'grenzer', trigger: 'special', text: 'Alarm!', voice: ANGRY, len: 1.1, fx: (sr) => FX.undead(sr, 0.9, 4) },
  { kind: 'grenzer', trigger: 'rage', text: 'Keiner kommt rüber!', voice: ANGRY, len: 1.05, fx: (sr) => FX.undead(sr, 0.88, 4) },
  { kind: 'brandmeister', trigger: 'start', text: 'Wer hat hier gezündelt?', voice: CALM, len: 1.05, fx: (sr) => FX.undead(sr, 0.84, 4) },
  { kind: 'brandmeister', trigger: 'special', text: 'Feuer frei!', voice: ANGRY, len: 1.05, fx: (sr) => FX.undead(sr, 0.84, 5) },
  { kind: 'brandmeister', trigger: 'rage', text: 'Alles soll brennen!', voice: ANGRY, len: 1.05, fx: (sr) => FX.undead(sr, 0.82, 5) },
  { kind: 'rattenmutter', trigger: 'start', text: 'Wer stört mein Nest?', voice: KERSTIN, len: 1.1, fx: (sr) => FX.hag(sr, 0.9, 6) },
  { kind: 'rattenmutter', trigger: 'special', text: 'Kommt, meine Kinder!', voice: KERSTIN, len: 1.1, fx: (sr) => FX.hag(sr, 0.9, 6) },
  { kind: 'rattenmutter', trigger: 'rage', text: 'Fresst alles!', voice: KERSTIN, len: 1, fx: (sr) => FX.hag(sr, 0.88, 7) },
  { kind: 'spreehexe', trigger: 'start', text: 'Die Spree holt dich!', voice: KERSTIN, len: 1.1, fx: (sr) => `${FX.hag(sr, 0.94, 4)},apad=pad_dur=0.4,aecho=0.8:0.5:60|130:0.35|0.2` },
  { kind: 'spreehexe', trigger: 'special', text: 'Hier kommt die Welle!', voice: KERSTIN, len: 1.05, fx: (sr) => `${FX.hag(sr, 0.94, 4)},apad=pad_dur=0.4,aecho=0.8:0.5:60|130:0.35|0.2` },
  { kind: 'spreehexe', trigger: 'rage', text: 'Geh unter!', voice: KERSTIN, len: 1.1, fx: (sr) => `${FX.hag(sr, 0.92, 5)},apad=pad_dur=0.4,aecho=0.8:0.5:60|130:0.35|0.2` },
  // Mitte 2089.
  { kind: 'tuersteher', trigger: 'start', text: 'Kein Einlass!', voice: ANGRY, len: 1.1, fx: (sr) => FX.undead(sr, 0.78, 3) },
  { kind: 'tuersteher', trigger: 'special', text: 'Nicht auf der Liste!', voice: CALM, len: 1.05, fx: (sr) => FX.undead(sr, 0.78, 3) },
  { kind: 'tuersteher', trigger: 'rage', text: 'Du kommst hier nicht rein!', voice: ANGRY, len: 1, fx: (sr) => FX.undead(sr, 0.78, 4) },
  { kind: 'dirigent', trigger: 'start', text: 'Ruhe im Saal!', voice: CALM, len: 1.1, fx: (sr) => FX.hall(sr, 0.9) },
  { kind: 'dirigent', trigger: 'special', text: 'Fortissimo!', voice: ANGRY, len: 1.1, fx: (sr) => FX.hall(sr, 0.9) },
  { kind: 'dirigent', trigger: 'rage', text: 'Da capo!', voice: ANGRY, len: 1.1, fx: (sr) => FX.hall(sr, 0.88) },
  { kind: 'bassprediger', trigger: 'start', text: 'Brüder und Schwestern!', voice: CALM, len: 1.1, fx: (sr) => FX.hall(sr, 0.8) },
  { kind: 'bassprediger', trigger: 'special', text: 'Gemeinde!', voice: ANGRY, len: 1.15, fx: (sr) => FX.hall(sr, 0.8) },
  { kind: 'bassprediger', trigger: 'rage', text: 'Spürt den Bass!', voice: ANGRY, len: 1.1, fx: (sr) => FX.hall(sr, 0.78) },
  { kind: 'wachdrohne', trigger: 'start', text: 'Zielperson erfasst.', voice: FLAT, len: 1, fx: (sr) => FX.radio(sr) },
  { kind: 'wachdrohne', trigger: 'special', text: 'Ziel bekämpfen.', voice: FLAT, len: 1, fx: (sr) => FX.radio(sr) },
  { kind: 'wachdrohne', trigger: 'rage', text: 'Eskalation freigegeben.', voice: FLAT, len: 1, fx: (sr) => FX.radio(sr) },
  // Alexanderplatz: garden and clockwork.
  { kind: 'wurzelmutter', trigger: 'start', text: 'Willkommen im Garten.', voice: KERSTIN, len: 1.2, fx: (sr) => FX.plant(sr) },
  { kind: 'wurzelmutter', trigger: 'special', text: 'Wachst!', voice: KERSTIN, len: 1.2, fx: (sr) => FX.plant(sr) },
  { kind: 'wurzelmutter', trigger: 'rage', text: 'Alles wird Erde!', voice: KERSTIN, len: 1.15, fx: (sr) => FX.plant(sr) },
  { kind: 'uhrwerkgross', trigger: 'start', text: 'Tick. Tack.', voice: FLAT, len: 1.2, fx: (sr) => FX.clockwork(sr) },
  { kind: 'uhrwerkgross', trigger: 'special', text: 'Aufziehen.', voice: FLAT, len: 1.1, fx: (sr) => FX.clockwork(sr) },
  { kind: 'uhrwerkgross', trigger: 'rage', text: 'Überdreht!', voice: FLAT, len: 1, fx: (sr) => FX.clockwork(sr) },
  { kind: 'volkskoloss', trigger: 'start', text: 'Plan wird erfüllt.', voice: FLAT, len: 1.1, fx: (sr) => FX.koloss(sr) },
  { kind: 'volkskoloss', trigger: 'special', text: 'Neubau!', voice: FLAT, len: 1.1, fx: (sr) => FX.koloss(sr) },
  { kind: 'volkskoloss', trigger: 'rage', text: 'Übererfüllung!', voice: FLAT, len: 1.05, fx: (sr) => FX.koloss(sr) },
  { kind: 'weltzeituhr', trigger: 'start', text: 'Deine Zeit läuft ab.', voice: FLAT, len: 1.2, fx: (sr) => FX.bell(sr) },
  { kind: 'weltzeituhr', trigger: 'special', text: 'Die Stunde schlägt.', voice: FLAT, len: 1.2, fx: (sr) => FX.bell(sr) },
  { kind: 'weltzeituhr', trigger: 'rage', text: 'Stillstand!', voice: FLAT, len: 1.25, fx: (sr) => FX.bell(sr) },
];

function run(cmd, args, input) {
  return execFileSync(cmd, args, { input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
}

/** Downloads a model (.onnx, .onnx.json, MODEL_CARD) once; curl uses the system proxy settings. */
function ensureModel(m) {
  fs.mkdirSync(MODELS, { recursive: true });
  const files = [[`${m.stem}.onnx`, `${m.dir}/${m.stem}.onnx`], [`${m.stem}.onnx.json`, `${m.dir}/${m.stem}.onnx.json`], [`${m.stem}.MODEL_CARD`, `${m.dir}/MODEL_CARD`]];
  for (const [file, url] of files) {
    const to = path.join(MODELS, file);
    if (fs.existsSync(to)) continue;
    console.log(`download ${url}`);
    run('curl', ['-sSfL', '-o', to, `${HF}/${url}`]);
  }
  return path.join(MODELS, `${m.stem}.onnx`);
}

const only = process.argv.slice(2);
const pick = LINES.filter((l) => !only.length || only.includes(l.kind) || only.includes(`${l.kind}-${l.trigger}`));
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voices-'));
let total = 0;
for (const l of pick) {
  const m = MODEL[l.voice.model];
  const onnx = ensureModel(m);
  const wav = path.join(tmp, `${l.kind}-${l.trigger}.wav`);
  run(PIPER, ['-m', onnx, '-c', `${onnx}.json`, '-s', String(l.voice.speaker), '--length-scale', String(l.len), '-f', wav], l.text);
  const out = path.join(OUT, `${l.kind}-${l.trigger}.ogg`);
  // Trim Piper's lead-in silence, process, normalize loudness, cut the tail, encode.
  const chain = [
    'silenceremove=start_periods=1:start_threshold=-50dB',
    l.fx(m.rate),
    'loudnorm=I=-15:TP=-1.5:LRA=7',
    'aresample=24000',
    'areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse',
  ].join(',');
  run(FFMPEG, ['-y', '-loglevel', 'error', '-i', wav, '-af', chain, '-ac', '1', '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', '-map_metadata', '-1', out]);
  const size = fs.statSync(out).size;
  total += size;
  console.log(`${out}  ${(size / 1024).toFixed(1)} KB  „${l.text}“`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${pick.length} clips, ${(total / 1024).toFixed(1)} KB`);
