// M6/Q6: optional cloud save without a login, same backend and protocol as the 2D game
// (`tools/sync/Code.gs` in the 2D repo: Google Sheet + Apps Script web app, POST text/plain JSON):
//   {a:'get',c}          -> {ok,s,t}            s = save JSON string or null
//   {a:'put',c,s,t,b}    -> {ok,t} | {ok:false,newer:true,t}   b = server t this device last saw
// A random 8 character code (XXXX-XXXX) is the only key. The browser copy stays the primary save;
// this only mirrors it. The server never validates the payload, so 2D and 3D saves can share the sheet.
// Conflict rule (2D v0.84, simplified): a push that finds a newer remote write is refused. The device
// then stops pushing and the next page load adopts the remote save, keeping the local one as backup.
import { parseSave, type SaveV1 } from './sim/save';

const URL = 'https://script.google.com/macros/s/AKfycbyUCf3slojkaYJhVemGU54EBidrXFhj2FoOANlOZQQdIxhO4YIWTW1kF9FPv3hVDXQ/exec';
const KEY = 'ruinenstadt-berlin.sync';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z2-9]{8}$/;

export type SyncState = 'off' | 'sync' | 'on' | 'slow' | 'conflict';
export const formatCode = (c: string | null): string => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
export const cleanCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

interface Stored { c?: string; b?: number; s?: number; off?: boolean }
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

export class CloudSave {
  code: string | null = null;
  /** Server time of the last write this device has seen (its own or adopted). */
  base = 0;
  /** Wall clock of the last confirmed upload (0 = none yet). */
  saved = 0;
  state: SyncState = 'off';
  onState: (s: SyncState) => void = () => {};
  private busy = false;
  private pending: SaveV1 | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disabled = false;

  /** `allowed` false (localhost, automated browsers, debug starts): nothing is read, sent or stored. */
  constructor(private readonly allowed: boolean, private readonly deps: SyncDeps = browserDeps()) {
    if (!allowed) return;
    try {
      const j = JSON.parse(deps.store.get() ?? 'null') as Stored | null;
      this.disabled = !!j?.off;
      if (j?.c && CODE_RE.test(j.c)) { this.code = j.c; this.base = Number(j.b) || 0; this.saved = Number(j.s) || 0; this.state = 'sync'; }
    } catch { /* damaged entry: start clean */ }
  }

  private keep(): void {
    if (!this.allowed) return;
    this.deps.store.set(this.code ? JSON.stringify({ c: this.code, b: this.base, s: this.saved } satisfies Stored) : JSON.stringify({ off: true } satisfies Stored));
  }
  private set(s: SyncState): void { this.state = s; this.onState(s); }

  private async call(q: object): Promise<Reply | null> {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await this.deps.fetch(URL, { method: 'POST', body: JSON.stringify(q), signal: ac.signal });
      return r.ok ? ((await r.json()) as Reply) : null;
    } catch { return null; } finally { clearTimeout(to); }
  }

  get available(): boolean { return this.allowed; }

  /** New random code (once per device, unless the player switched it off). */
  enable(): string | null {
    if (!this.allowed) return null;
    if (!this.code) {
      const r = this.deps.random(8);
      this.code = [...r].map((x) => ALPHABET[x % ALPHABET.length]).join('');
      this.base = 0; this.saved = 0; this.disabled = false;
      this.keep();
      this.set('sync');
    }
    return this.code;
  }
  /** First run on a public game: switch on unless the player turned it off before. */
  autoStart(): void { if (this.allowed && !this.code && !this.disabled) this.enable(); }
  disable(): void {
    this.code = null; this.base = 0; this.saved = 0; this.pending = null;
    clearTimeout(this.timer);
    this.disabled = true;
    this.keep();
    this.set('off');
  }

  /**
   * Startup check. Returns the remote save to adopt (another device wrote since this one last synced and
   * it is newer than the local copy), or null. Pushes the local save when the server has nothing newer.
   */
  async pull(local: SaveV1 | null): Promise<SaveV1 | null> {
    if (!this.allowed || !this.code || this.busy) return null;
    const c = this.code;
    this.busy = true;
    const r = await this.call({ a: 'get', c });
    this.busy = false;
    if (this.code !== c) return null;
    if (!r?.ok) { this.set('slow'); return null; }
    if (r.s && (r.t !== this.base || !local)) {
      const remote = parseSave(r.s);
      if (remote && (!local || remote.t > local.t)) { this.base = r.t ?? 0; this.keep(); this.set('on'); return remote; }
      // Remote unusable or older: the local save replaces it (the old remote stays in the sheet's history only).
      this.base = r.t ?? 0; this.keep();
    }
    if (!r.s) this.base = 0;
    // A save queued while this request was in flight is newer than `local`: keep it.
    if (local && (!r.s || local.t > this.base)) { if (!this.pending) this.queue(local, 0); }
    else this.set('on');
    return null;
  }

  /** Debounced upload of the latest save. */
  queue(save: SaveV1, delay = 3000): void {
    if (!this.allowed || !this.code || this.state === 'conflict') return;
    this.pending = save;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }
  async flush(): Promise<void> {
    const c = this.code;
    const save = this.pending;
    if (!c || !save) return;
    if (this.busy) { this.timer = setTimeout(() => void this.flush(), 1500); return; }
    this.pending = null;
    this.busy = true;
    const r = await this.call({ a: 'put', c, s: JSON.stringify(save), t: save.t, b: this.base });
    this.busy = false;
    if (this.code !== c) return;
    if (r?.ok) { this.base = r.t ?? save.t; this.saved = this.deps.now(); this.keep(); this.set('on'); }
    else if (r?.newer) { this.set('conflict'); }
    else { this.pending ??= save; this.set('slow'); this.timer = setTimeout(() => void this.flush(), 30000); }
  }

  /** A newer remote save arrived while playing: stop pushing, adopt it on the next load. */
  hold(): void { this.base = 0; this.keep(); this.set('conflict'); }

  /** Join an existing code: returns its save, or why not. The caller backs up the local save and adopts it. */
  async join(raw: string): Promise<{ save: SaveV1 } | { error: 'code' | 'net' | 'unknown' | 'damaged' }> {
    const c = cleanCode(raw);
    if (!this.allowed || !CODE_RE.test(c)) return { error: 'code' };
    const r = await this.call({ a: 'get', c });
    if (!r?.ok) return { error: 'net' };
    if (!r.s) return { error: 'unknown' };
    const save = parseSave(r.s);
    if (!save) return { error: 'damaged' };
    this.code = c; this.base = r.t ?? 0; this.saved = 0; this.disabled = false; this.pending = null;
    this.keep();
    this.set('on');
    return { save };
  }
}
