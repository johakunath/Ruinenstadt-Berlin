// M6/Q6/M6b: optional cloud save without a login, same backend and protocol as the 2D game
// (`tools/sync/Code.gs` in the 2D repo: Google Sheet + Apps Script web app, POST text/plain JSON):
//   {a:'get',c}          -> {ok,s,t}            s = stored JSON string or null
//   {a:'put',c,s,t,b}    -> {ok,t} | {ok:false,newer:true,t}   b = server t this device last saw
// The server is a key-value store (one row per key in the tab "Saves", the value chunked), so M6b needs
// no server change. A random 8 character account code (XXXX-XXXX) is the only secret. Keys under it:
//   slot 1        the account code itself (a save from before M6b is slot 1 without moving)
//   slot 2, 3     derived codes (hash of code + slot), each its own row with its own conflict rule
//   account       derived code (hash of code + "konto"): {k:'konto',v:1,n:name,s:[slot names]}
// Each slot syncs on its own, so playing slot 1 on the PC never blocks slot 2 on the tablet.
// The browser copy stays the primary save; this only mirrors it. Conflict rule (2D v0.84, simplified):
// a push that finds a newer remote write is refused; that slot stops pushing and the next page load
// adopts the remote save, keeping the local one as backup.
import { SLOTS, type Slot } from './save';
import { parseSave, type SaveV1 } from './sim/save-format';

const URL = 'https://script.google.com/macros/s/AKfycbyUCf3slojkaYJhVemGU54EBidrXFhj2FoOANlOZQQdIxhO4YIWTW1kF9FPv3hVDXQ/exec';
const KEY = 'ruinenstadt-berlin.sync';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z2-9]{8}$/;
export const NAME_MAX = 20;

export type SyncState = 'off' | 'sync' | 'on' | 'slow' | 'conflict';
export const formatCode = (c: string | null): string => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
export const cleanCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const cleanName = (s: string): string => s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);

/** 8 characters of the code alphabet from a string (cyrb53-style hash, two 32-bit lanes). */
function derive(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[(((i < 4 ? h1 : h2) >>> ((i % 4) * 8)) & 255) % ALPHABET.length];
  return out;
}
/** Server key of a slot. */
export const slotCode = (acct: string, slot: Slot): string => (slot === 1 ? acct : derive(`${acct}:${slot}`));
/** Server key of the account record (name, slot names). */
export const metaCode = (acct: string): string => derive(`${acct}:konto`);

interface Meta { k: 'konto'; v: 1; n: string; s: string[] }
function withEdit(m: Meta, e: MetaEdit | null): Meta {
  if (!e) return m;
  const s = [...m.s];
  for (const [i, v] of Object.entries(e.s ?? {})) if (+i >= 0 && +i < s.length) s[+i] = cleanName(String(v));
  return { ...m, n: e.n !== undefined ? cleanName(e.n) : m.n, s };
}
function parseMeta(text: string | null | undefined): Meta | null {
  try {
    const m = JSON.parse(text ?? 'null') as Partial<Meta> | null;
    if (!m || m.k !== 'konto') return null;
    return { k: 'konto', v: 1, n: cleanName(String(m.n ?? '')), s: SLOTS.map((_, i) => cleanName(String(m.s?.[i] ?? ''))) };
  } catch { return null; }
}

/** Name edits not yet confirmed by the server (sent again on the next start). */
interface MetaEdit { n?: string; s?: Record<number, string> }
interface Stored { c?: string; n?: string; sn?: string[]; b?: number | Partial<Record<Slot, number>>; mb?: number; md?: MetaEdit; s?: number; off?: boolean }
export interface SyncDeps {
  fetch: (url: string, init: { method: 'POST'; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  store: { get(): string | null; set(v: string | null): void };
  random: (n: number) => Uint8Array;
  now: () => number;
}
const browserDeps = (): SyncDeps => ({
  fetch: (u, i) => fetch(u, i),
  store: {
    get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
    set: (v) => { try { v === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch { /* no persistence */ } },
  },
  random: (n) => crypto.getRandomValues(new Uint8Array(n)),
  now: () => Date.now(),
});

interface Reply { ok?: boolean; s?: string | null; t?: number; newer?: boolean }

/** One slot's mirror: its server key, the last server time seen, a debounced upload. */
class Channel {
  /** Server time of the last write this device has seen (its own or adopted). */
  base = 0;
  state: SyncState = 'off';
  pending: SaveV1 | null = null;
  timer: ReturnType<typeof setTimeout> | undefined;
  busy = false;
  constructor(readonly slot: Slot, private readonly cs: CloudSave) {}

  set(s: SyncState): void { this.state = s; this.cs.changed(); }
  reset(): void { this.base = 0; this.pending = null; clearTimeout(this.timer); this.busy = false; }

  /**
   * `take` stores a newer remote save locally and returns true, or returns false to hold it (a run is
   * being played). The server time is stored only after `take` (Codex review: a reload in between must
   * not leave the old local save next to the acknowledged remote time).
   */
  async pull(local: SaveV1 | null, take: (remote: SaveV1) => boolean): Promise<SaveV1 | null> {
    const c = this.cs.code;
    if (!c || this.busy) return null;
    this.busy = true;
    const r = await this.cs.call({ a: 'get', c: slotCode(c, this.slot) });
    this.busy = false;
    if (this.cs.code !== c) return null;
    if (!r?.ok) { this.set('slow'); return null; }
    if (r.s && (r.t !== this.base || !local)) {
      const remote = parseSave(r.s);
      if (remote && (!local || remote.t > local.t)) {
        if (take(remote)) { this.base = r.t ?? 0; this.cs.keep(); this.set('on'); }
        else { this.base = 0; this.cs.keep(); this.set('conflict'); }
        return remote;
      }
      // Remote unusable or older: the local save replaces it (the old remote stays in the sheet's history only).
      this.base = r.t ?? 0; this.cs.keep();
    }
    if (!r.s) this.base = 0;
    // A save queued while this request was in flight is newer than `local`: keep it.
    if (local && (!r.s || local.t > this.base)) { if (!this.pending) this.queue(local, 0); }
    else this.set('on');
    return null;
  }

  queue(save: SaveV1, delay: number): void {
    if (!this.cs.code || this.state === 'conflict') return;
    this.pending = save;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  async flush(): Promise<void> {
    const c = this.cs.code;
    const save = this.pending;
    if (!c || !save) return;
    if (this.busy) { clearTimeout(this.timer); this.timer = setTimeout(() => void this.flush(), 1500); return; }
    this.pending = null;
    this.busy = true;
    const r = await this.cs.call({ a: 'put', c: slotCode(c, this.slot), s: JSON.stringify(save), t: save.t, b: this.base });
    this.busy = false;
    if (this.cs.code !== c) return;
    if (r?.ok) { this.base = r.t ?? save.t; this.cs.saved = this.cs.deps.now(); this.cs.keep(); this.set('on'); }
    else if (r?.newer) { this.set('conflict'); }
    else { this.pending ??= save; this.set('slow'); clearTimeout(this.timer); this.timer = setTimeout(() => void this.flush(), 30000); }
  }
}

export type JoinResult = { saves: Partial<Record<Slot, SaveV1>> } | { error: 'code' | 'net' | 'unknown' | 'damaged' };

export class CloudSave {
  /** Account code (slot 1's key). */
  code: string | null = null;
  /** Account name and slot names ('' = not named yet). */
  name = '';
  slotNames: string[] = SLOTS.map(() => '');
  /** Wall clock of the last confirmed upload of any slot (0 = none yet). */
  saved = 0;
  /** The slot this device plays; `state` reports it. */
  active: Slot = 1;
  /** Called on any change of state, code or names. */
  onChange: () => void = () => {};
  private readonly ch: Record<Slot, Channel>;
  private metaBase = 0;
  private metaEdit: MetaEdit | null = null;
  private disabled = false;

  /** `allowed` false (localhost, automated browsers, debug starts): nothing is read, sent or stored. */
  constructor(private readonly allowed: boolean, readonly deps: SyncDeps = browserDeps()) {
    this.ch = { 1: new Channel(1, this), 2: new Channel(2, this), 3: new Channel(3, this) };
    if (!allowed) return;
    try {
      const j = JSON.parse(deps.store.get() ?? 'null') as Stored | null;
      this.disabled = !!j?.off;
      if (j?.c && CODE_RE.test(j.c)) {
        this.code = j.c;
        this.name = cleanName(j.n ?? '');
        this.slotNames = SLOTS.map((_, i) => cleanName(j.sn?.[i] ?? ''));
        // Before M6b `b` was one number: slot 1's.
        const b = typeof j.b === 'number' ? { 1: j.b } : j.b ?? {};
        for (const s of SLOTS) { this.ch[s].base = Number(b[s]) || 0; this.ch[s].state = 'sync'; }
        this.metaBase = Number(j.mb) || 0;
        this.metaEdit = j.md && typeof j.md === 'object' ? j.md : null;
        this.saved = Number(j.s) || 0;
      }
    } catch { /* damaged entry: start clean */ }
  }

  get available(): boolean { return this.allowed; }
  get state(): SyncState { return this.code ? this.ch[this.active].state : 'off'; }
  slotState(slot: Slot): SyncState { return this.code ? this.ch[slot].state : 'off'; }

  /** @internal */
  changed(): void { this.onChange(); }
  /** @internal */
  keep(): void {
    if (!this.allowed) return;
    const st: Stored = this.code
      ? { c: this.code, n: this.name, sn: this.slotNames, b: { 1: this.ch[1].base, 2: this.ch[2].base, 3: this.ch[3].base }, mb: this.metaBase, ...(this.metaEdit ? { md: this.metaEdit } : {}), s: this.saved }
      : { off: true };
    this.deps.store.set(JSON.stringify(st));
  }
  /** @internal */
  async call(q: object): Promise<Reply | null> {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await this.deps.fetch(URL, { method: 'POST', body: JSON.stringify(q), signal: ac.signal });
      return r.ok ? ((await r.json()) as Reply) : null;
    } catch { return null; } finally { clearTimeout(to); }
  }

  /** New random account code (once per device, unless the player switched it off). */
  enable(): string | null {
    if (!this.allowed) return null;
    if (!this.code) {
      const r = this.deps.random(8);
      this.code = [...r].map((x) => ALPHABET[x % ALPHABET.length]).join('');
      for (const s of SLOTS) { this.ch[s].reset(); this.ch[s].state = 'sync'; }
      this.metaBase = 0; this.metaEdit = null; this.saved = 0; this.disabled = false;
      this.keep();
      this.changed();
    }
    return this.code;
  }
  /** First run on a public game: switch on unless the player turned it off before. */
  autoStart(): void { if (this.allowed && !this.code && !this.disabled) this.enable(); }
  disable(): void {
    this.code = null; this.metaBase = 0; this.metaEdit = null; this.saved = 0; this.name = ''; this.slotNames = SLOTS.map(() => '');
    for (const s of SLOTS) { this.ch[s].reset(); this.ch[s].state = 'off'; }
    this.disabled = true;
    this.keep();
    this.changed();
  }

  /**
   * Startup check of every slot and the account record. Returns the remote saves to adopt (another
   * device wrote since this one last synced, and it is newer than the local copy). Pushes local saves
   * the server has nothing newer for.
   */
  async start(locals: Partial<Record<Slot, SaveV1 | null>>, take: (slot: Slot, remote: SaveV1) => boolean = () => true): Promise<Partial<Record<Slot, SaveV1>>> {
    if (!this.allowed || !this.code) return {};
    const [, ...got] = await Promise.all([this.pullMeta(), ...SLOTS.map((s) => this.ch[s].pull(locals[s] ?? null, (r) => take(s, r)))]);
    const out: Partial<Record<Slot, SaveV1>> = {};
    SLOTS.forEach((s, i) => { const g = got[i]; if (g) out[s] = g; });
    return out;
  }
  /** Debounced upload of a slot's latest save. */
  queue(save: SaveV1, slot: Slot = this.active, delay = 3000): void { if (this.allowed) this.ch[slot].queue(save, delay); }
  /** Sends every waiting upload now (tab hidden). */
  async flush(): Promise<void> { await Promise.all(SLOTS.map((s) => this.ch[s].flush())); }
  /** A newer remote save of a slot arrived while playing: stop pushing it, adopt it on the next load. */
  hold(slot: Slot = this.active): void { this.ch[slot].base = 0; this.keep(); this.ch[slot].set('conflict'); }

  /** Account name, shown on every device with this code. */
  rename(name: string): Promise<void> { return this.pushMeta({ n: cleanName(name) }); }
  renameSlot(slot: Slot, name: string): Promise<void> { return this.pushMeta({ s: { [slot - 1]: cleanName(name) } }); }

  private meta(): Meta { return { k: 'konto', v: 1, n: this.name, s: [...this.slotNames] }; }
  private adoptMeta(m: Meta, t: number): void { this.name = m.n; this.slotNames = m.s; this.metaBase = t; this.keep(); this.changed(); }
  private async pullMeta(): Promise<void> {
    const c = this.code;
    if (!c) return;
    const r = await this.call({ a: 'get', c: metaCode(c) });
    if (this.code !== c || !r?.ok) return;
    const m = parseMeta(r.s);
    if (m && r.t !== this.metaBase) this.adoptMeta(withEdit(m, this.metaEdit), r.t ?? 0);
    // A rename that never reached the server, or names given while the record was missing: send them.
    if (this.metaEdit || (!r.s && (this.name || this.slotNames.some(Boolean)))) void this.pushMeta({});
  }
  /** Name writes run one after another, so two quick renames never send the same base (Codex review). */
  private metaQueue: Promise<void> = Promise.resolve();
  /**
   * Applies an edit locally at once and keeps it as pending, then writes the record; a newer remote record
   * is merged first. Pending edits are cleared only when the server confirmed exactly what was sent.
   */
  private pushMeta(edit: MetaEdit): Promise<void> {
    if (!this.allowed || !this.code) return Promise.resolve();
    this.metaEdit = { n: edit.n ?? this.metaEdit?.n, s: { ...this.metaEdit?.s, ...edit.s } };
    if (this.metaEdit.n === undefined) delete this.metaEdit.n;
    const m = withEdit(this.meta(), this.metaEdit);
    this.name = m.n; this.slotNames = m.s; this.keep(); this.changed();
    const c = this.code;
    return this.metaQueue = this.metaQueue.then(() => this.sendMeta(c));
  }
  private async sendMeta(c: string): Promise<void> {
    for (let tries = 0; tries < 2; tries++) {
      if (this.code !== c || !this.metaEdit) return;
      const sent = JSON.stringify(this.metaEdit);
      const m = withEdit(this.meta(), this.metaEdit);
      const t = Math.max(this.deps.now(), this.metaBase + 1);
      const r = await this.call({ a: 'put', c: metaCode(c), s: JSON.stringify(m), t, b: this.metaBase });
      if (this.code !== c) return;
      if (r?.ok) { this.metaBase = r.t ?? t; if (JSON.stringify(this.metaEdit) === sent) this.metaEdit = null; this.keep(); return; }
      if (!r?.newer) return;
      const g = await this.call({ a: 'get', c: metaCode(c) });
      if (this.code !== c || !g?.ok) return;
      this.adoptMeta(withEdit(parseMeta(g.s) ?? this.meta(), this.metaEdit), g.t ?? 0);
    }
  }

  /** Join an existing account: returns its saves per slot, or why not. The caller backs up local saves and adopts them. */
  async join(raw: string): Promise<JoinResult> {
    const c = cleanCode(raw);
    if (!this.allowed || !CODE_RE.test(c)) return { error: 'code' };
    const [meta, ...rs] = await Promise.all([this.call({ a: 'get', c: metaCode(c) }), ...SLOTS.map((s) => this.call({ a: 'get', c: slotCode(c, s) }))]);
    if (!meta?.ok || rs.some((r) => !r?.ok)) return { error: 'net' };
    const m = parseMeta(meta.s);
    const saves: Partial<Record<Slot, SaveV1>> = {};
    SLOTS.forEach((s, i) => { const v = parseSave(rs[i]!.s ?? null); if (v) saves[s] = v; });
    if (!m && !Object.keys(saves).length) return { error: rs.some((r) => r!.s) ? 'damaged' : 'unknown' };
    this.code = c; this.saved = 0; this.disabled = false; this.metaEdit = null;
    SLOTS.forEach((s, i) => { this.ch[s].reset(); this.ch[s].base = rs[i]!.t ?? 0; this.ch[s].state = 'on'; });
    if (m) this.adoptMeta(m, meta.t ?? 0); else { this.name = ''; this.slotNames = SLOTS.map(() => ''); this.metaBase = 0; this.keep(); this.changed(); }
    return { saves };
  }
}
