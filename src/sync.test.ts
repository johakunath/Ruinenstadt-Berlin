import { describe, expect, it } from 'vitest';
import { createSim } from './sim/sim';
import { snapshot } from './sim/save';
import { CloudSave, CODE_RE, cleanCode, cleanName, formatCode, metaCode, slotCode, type SyncDeps } from './sync';

/** In-memory stand-in for the Apps Script (same rules as tools/sync/Code.gs in the 2D repo). */
function server() {
  const rows = new Map<string, { s: string; t: number }>();
  const calls: Array<Record<string, unknown>> = [];
  const fetch: SyncDeps['fetch'] = async (_u, init) => {
    const q = JSON.parse(init.body) as { a: string; c: string; s?: string; t?: number; b?: number };
    calls.push(q);
    const cur = rows.get(q.c);
    let out: object;
    if (q.a === 'get') out = { ok: true, s: cur?.s ?? null, t: cur?.t ?? 0 };
    else if (cur && cur.t && q.b !== cur.t) out = { ok: false, newer: true, t: cur.t };
    else { rows.set(q.c, { s: q.s!, t: q.t! }); out = { ok: true, t: q.t }; }
    return { ok: true, json: async () => out };
  };
  return { rows, calls, fetch };
}
function deps(srv: ReturnType<typeof server>, mem = { v: null as string | null }): SyncDeps {
  return { fetch: srv.fetch, store: { get: () => mem.v, set: (v) => { mem.v = v; } }, random: (n) => Uint8Array.from({ length: n }, (_, i) => i * 7 + 3), now: () => 1000 };
}
const save = (t: number) => snapshot(createSim({ seed: 1 }), 'Hof', false, t);

describe('cloud save', () => {
  it('codes are 8 characters from the 2D alphabet and format like XXXX-XXXX', () => {
    const c = new CloudSave(true, deps(server()));
    const code = c.enable()!;
    expect(CODE_RE.test(code)).toBe(true);
    expect(formatCode(code)).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(cleanCode('abcd-2345')).toBe('ABCD2345');
  });
  it('does nothing when not allowed (localhost, automated browsers)', async () => {
    const srv = server();
    const c = new CloudSave(false, deps(srv));
    expect(c.enable()).toBeNull();
    c.queue(save(5), 1, 0);
    await c.flush();
    expect(await c.start({ 1: save(5) })).toEqual({});
    expect(srv.calls).toHaveLength(0);
  });
  it('pushes a save and a second device adopts it with the code', async () => {
    const srv = server();
    const a = new CloudSave(true, deps(srv));
    a.enable();
    a.queue(save(100), 1, 0);
    await new Promise((r) => setTimeout(r, 5));
    expect(a.state).toBe('on');
    const b = new CloudSave(true, deps(srv));
    const r = await b.join(formatCode(a.code));
    expect('saves' in r && r.saves[1]?.t).toBe(100);
    expect(await b.join('ABCD-2345')).toEqual({ error: 'unknown' });
    expect(await b.join('x')).toEqual({ error: 'code' });
  });
  it('startup: a newer remote save from another device is adopted, an older one is replaced', async () => {
    const srv = server();
    const a = new CloudSave(true, deps(srv));
    a.enable(); a.queue(save(200), 1, 0); await new Promise((r) => setTimeout(r, 5));
    const mem = { v: JSON.stringify({ c: a.code, b: 0, s: 0 }) };
    const b = new CloudSave(true, deps(srv, mem));
    expect((await b.start({ 1: save(100) }))[1]?.t).toBe(200);
    const c = new CloudSave(true, deps(srv, { v: JSON.stringify({ c: a.code, b: 0, s: 0 }) }));
    expect(await c.start({ 1: save(300) })).toEqual({});
    await new Promise((r) => setTimeout(r, 5));
    expect(srv.rows.get(a.code!)!.t).toBe(300);
    expect((await new CloudSave(true, deps(srv, { v: JSON.stringify({ c: a.code, b: 300, s: 0 }) })).start({ 1: null }))[1]?.t).toBe(300);
  });
  it('a stale device is refused, stops pushing and never overwrites the newer save', async () => {
    const srv = server();
    const a = new CloudSave(true, deps(srv));
    a.enable(); a.queue(save(100), 1, 0); await new Promise((r) => setTimeout(r, 5));
    const stale = new CloudSave(true, deps(srv, { v: JSON.stringify({ c: a.code, b: 100, s: 0 }) }));
    a.queue(save(150), 1, 0); await new Promise((r) => setTimeout(r, 5));
    stale.queue(save(120), 1, 0); await new Promise((r) => setTimeout(r, 5));
    expect(stale.state).toBe('conflict');
    expect(srv.rows.get(a.code!)!.t).toBe(150);
    stale.queue(save(130), 1, 0); await new Promise((r) => setTimeout(r, 5));
    expect(srv.calls.filter((q) => q.a === 'put')).toHaveLength(3);
  });
  it('an unreachable server keeps the local save and reports slow', async () => {
    const c = new CloudSave(true, { ...deps(server()), fetch: async () => { throw new Error('offline'); } });
    c.enable(); c.queue(save(1), 1, 0); await new Promise((r) => setTimeout(r, 5));
    expect(c.state).toBe('slow');
  });
  it('switching off remembers the choice and clears the code', () => {
    const mem = { v: null as string | null };
    const c = new CloudSave(true, deps(server(), mem));
    c.autoStart(); expect(c.code).not.toBeNull();
    c.disable();
    const again = new CloudSave(true, deps(server(), mem));
    again.autoStart();
    expect(again.code).toBeNull();
  });
  it('a save queued during the startup pull is not replaced by the older startup snapshot', async () => {
    const srv = server();
    const c = new CloudSave(true, deps(srv));
    c.enable();
    const pulling = c.start({ 1: save(100) });
    c.queue(save(200), 1, 0);
    await pulling;
    await new Promise((r) => setTimeout(r, 10));
    expect(srv.rows.get(c.code!)!.t).toBe(200);
  });
  it('M6b: slot 1 is the account code, slots 2 and 3 and the account record have their own stable keys', () => {
    const keys = [slotCode('ABCD2345', 1), slotCode('ABCD2345', 2), slotCode('ABCD2345', 3), metaCode('ABCD2345')];
    expect(keys[0]).toBe('ABCD2345');
    expect(new Set(keys).size).toBe(4);
    for (const k of keys) expect(CODE_RE.test(k)).toBe(true);
    expect(slotCode('ABCD2345', 2)).toBe(slotCode('ABCD2345', 2));
    expect(slotCode('ABCD2346', 2)).not.toBe(slotCode('ABCD2345', 2));
  });
  it('M6b: two devices on different slots never block each other', async () => {
    const srv = server();
    const pc = new CloudSave(true, deps(srv));
    pc.enable();
    const tab = new CloudSave(true, deps(srv, { v: JSON.stringify({ c: pc.code }) }));
    pc.queue(save(100), 1, 0); tab.queue(save(110), 2, 0); await tick();
    pc.queue(save(200), 1, 0); tab.queue(save(210), 2, 0); await tick();
    expect([pc.slotState(1), tab.slotState(2)]).toEqual(['on', 'on']);
    expect(srv.rows.get(slotCode(pc.code!, 1))!.t).toBe(200);
    expect(srv.rows.get(slotCode(pc.code!, 2))!.t).toBe(210);
    const third = new CloudSave(true, deps(srv));
    const r = await third.join(pc.code!);
    expect('saves' in r && [r.saves[1]?.t, r.saves[2]?.t, r.saves[3]]).toEqual([200, 210, undefined]);
  });
  it('M6b: a sync entry from before slots keeps its code and slot 1 base', async () => {
    const srv = server();
    const a = new CloudSave(true, deps(srv));
    a.enable(); a.queue(save(100), 1, 0); await tick();
    const old = new CloudSave(true, deps(srv, { v: JSON.stringify({ c: a.code, b: 100, s: 5 }) }));
    expect(old.code).toBe(a.code);
    old.queue(save(120), 1, 0); await tick();
    expect(old.slotState(1)).toBe('on');
  });
  it('M6b: account and slot names reach every device with the code; edits on two devices merge', async () => {
    const srv = server();
    const a = new CloudSave(true, deps(srv));
    a.enable();
    await a.rename('  Johannes <b>  ');
    await a.renameSlot(2, 'Frisch Tablet');
    expect(a.name).toBe('Johannes b');
    const b = new CloudSave(true, deps(srv));
    await b.join(a.code!);
    expect([b.name, b.slotNames]).toEqual(['Johannes b', ['', 'Frisch Tablet', '']]);
    await b.renameSlot(1, 'Hauptstand');
    // `a` still holds the older record: its edit is merged onto b's, not over it.
    await a.renameSlot(3, 'Reserve');
    expect(a.slotNames).toEqual(['Hauptstand', 'Frisch Tablet', 'Reserve']);
    const c = new CloudSave(true, deps(srv, { v: JSON.stringify({ c: a.code }) }));
    await c.start({});
    expect(c.slotNames).toEqual(['Hauptstand', 'Frisch Tablet', 'Reserve']);
    expect(cleanName('x'.repeat(40))).toHaveLength(20);
  });
  it('M6b: a code with only an account record can be joined; an empty code cannot', async () => {
    const srv = server();
    const a = new CloudSave(true, deps(srv));
    a.enable(); await a.rename('Kind');
    const r = await new CloudSave(true, deps(srv)).join(a.code!);
    expect(r).toEqual({ saves: {} });
    expect(await new CloudSave(true, deps(srv)).join('ZZZZ2222')).toEqual({ error: 'unknown' });
  });
});
const tick = () => new Promise((r) => setTimeout(r, 5));
