// M13b trade screen: three layout variants as HTML mockups in the game's menu style (U3 palette, Barlow Condensed,
// Pirata One, item icons, blessing glyphs), filled with a real Späti stock rolled by `src/sim/trade.ts` and its
// prices. Each variant is shot at 1280×720, 844×390 (phone landscape) and 1280×800 (Steam Deck, pad hints and
// focus ring); a sheet per variant (SVG beside the shots, WebP rendered) shows the three with notes. `bg.webp` is
// the Späti interior (Köpenick, Leistung) captured once from the game for the dimmed world behind the menu.
// Run from the repo root: node docs/mockups/m13b-trade/build.mjs   (needs `npm ci`; no dev server)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createServer } from 'vite';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '../../..');
const REL = '../../..';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- model: a real Späti stock from the sim

const server = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const load = (p) => server.ssrLoadModule(p);
const { createSim } = await load('/src/sim/sim.ts');
const T = await load('/src/sim/trade.ts');
const { setLoadout } = await load('/src/sim/loadout.ts');
const { makeItem, shownLevel, scrapValue } = await load('/src/sim/items.ts');
const { Rng } = await load('/src/sim/math.ts');
const { statLine } = await load('/src/ui/inventory.ts');
const { PERK_GLYPHS, FAMILY_GLYPHS } = await load('/src/ui/glyphs.ts');
const { ITEM_ICONS } = await load('/src/ui/item-icons.ts');
const { PERKS, CAMP_UPGRADES } = await load('/src/data/progression.ts');
const { WEAPON_MODS, CONSUMABLES } = await load('/src/data/crafting.ts');
const { RARITIES, SLOT_NAMES, AFFIXES, SLOTS } = await load('/src/data/items.ts');
const { SPATI_UPGRADE, spatiUpgradeCost } = await load('/src/sim/camp.ts');
const { rerollCost } = await load('/src/sim/blessings.ts');

const s = createSim({ empty: true, seed: 11 });
s.lootCtx.district = 1; // Xhain: strong Aufsätze on the shelf
s.lootWaves = 8;
const gearRng = new Rng(5);
const eq = { ...s.equipment };
for (const slot of ['h', 'a', 'g', 'f', 't', 'r']) eq[slot] = makeItem(gearRng, s.lootCtx, 9, 1, slot);
eq.w = makeItem(gearRng, s.lootCtx, 9, 2, 'w', 'blade');
setLoadout(s, eq, { perks: { dmg: 2, crit: 1, fire: 1, rate: 3, second: 1 } });
s.abilities.quality = { dmg: 1, fire: 2 };
s.inventory.scrap = 840;
s.player.hp = Math.round(s.stats.maxHp * 0.62);
for (let i = 0; i < 12; i++) s.inventory.bag.push(makeItem(gearRng, s.lootCtx, 6 + (i % 5), i % 7 === 0 ? 2 : 0));
s.inventory.consumables = { verband: 1, molotow: 1 };
// A stock that shows everything: a strong Aufsatz and one two-level card.
let shop;
for (let k = 1; k < 400; k++) {
  const st = T.rollSpati(s, new Rng(k));
  const mod = WEAPON_MODS.find((m) => m.id === st.mod?.id);
  if (mod?.spati && st.cards.some((c) => c.level === 2) && st.cards.every((c) => !PERKS.find((p) => p.id === c.id).requires) && st.offers.some((o) => o.item.rarity === 3)) { shop = st; break; }
}
s.content.shops[0] = shop;
s.content.tradeOpen = true;
s.content.tradeAt = 0;
await server.close();

const iconUrl = (it) => { const id = (it.set ? ITEM_ICONS[`${it.base}:${it.set}`] : undefined) ?? ITEM_ICONS[it.base]; return id ? `${REL}/assets/inventory/${id}.webp` : ''; };
const QUALITY_COLOR = ['#e8ddd0', '#7d9bff', '#f2d14b', '#b48cff'];
const perkHex = (id, quality = 0) => {
  const g = PERK_GLYPHS[id] ?? PERK_GLYPHS.dmg, stroke = g[1] === 's';
  return `<svg class="hex" viewBox="0 0 32 32"><path d="M16 1.5L29 9v14l-13 7.5L3 23V9z" fill="#1c140f" stroke="${QUALITY_COLOR[quality]}" stroke-width="2"/><g transform="translate(6 6) scale(.8333)" fill="${stroke ? 'none' : g[0]}" stroke="${stroke ? g[0] : 'none'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g[2]}</g></svg>`;
};
const modIcon = `<svg class="hex" viewBox="0 0 24 24">${FAMILY_GLYPHS.mod[1]}</svg>`;
// Verband and Molotow as the action bar draws them (`src/ui/abilities.ts` VERBAND, MOLOTOW).
const VERBAND = '<svg viewBox="0 0 48 48" style="width:70%;height:70%"><path d="M9 21h30v8H9z" fill="#ead9c0"/><path d="M20 10h8v28h-8z" fill="#ead9c0"/><path d="M21 18h6v12h-6zM16 22h16v4H16z" fill="#c23a2e"/></svg>';
const MOLOTOW = '<svg viewBox="0 0 48 48" style="width:70%;height:70%"><path d="M19 20h10l3 7v13a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V27z" fill="#6a8a5a"/><path d="M21 12h6v8h-6z" fill="#8a9a7a"/><path d="M24 2c4 4 4 7 1 10-4-2-4-6-1-10z" fill="#ff8a3d"/><path d="M17 30h14v6H17z" fill="#c9b58c"/></svg>';
const supIcon = (u) => (u.svg ?? (u.icon ? `<img src="${u.icon}" alt="">` : ''));
const cardLabel = (c) => (c.level > 1 ? '2 Stufen' : c.quality >= 2 ? 'Doppelsegen' : 'Neu');
const affixText = (a) => { const d = AFFIXES[a.id]; return `${(a.value > 0) !== !!d.negative ? '+' : '−'}${+Math.abs(a.value).toFixed(1)}${d.unit} ${d.name}`; };
const perk = (id) => PERKS.find((p) => p.id === id);
const M = {
  name: 'Späti am Wrangelkiez', quote: '„Wat darf’s sein?“', scrap: s.inventory.scrap,
  hp: Math.round(s.player.hp), maxHp: Math.round(s.stats.maxHp),
  gear: shop.offers.map((o) => {
    const it = o.item, worn = s.equipment[it.slot];
    return { icon: iconUrl(it), name: it.name, color: RARITIES[it.rarity].color, rar: RARITIES[it.rarity].name, slot: SLOT_NAMES[it.slot], il: shownLevel(it), delta: worn ? shownLevel(it) - shownLevel(worn) : null, price: o.price, stat: statLine(it), affixes: it.affixes.slice(0, 3).map(affixText), worn: worn ? { name: worn.name, color: RARITIES[worn.rarity].color, il: shownLevel(worn), stat: statLine(worn), icon: iconUrl(worn) } : null };
  }),
  mod: (() => { const m = WEAPON_MODS.find((x) => x.id === shop.mod.id); return { name: m.name, desc: m.description, price: T.modPrice(s, m.id), base: WEAPON_MODS.find((x) => x.id === m.base)?.name }; })(),
  cards: shop.cards.map((c) => ({ id: c.id, name: perk(c.id).name, desc: perk(c.id).description, level: c.level, max: perk(c.id).max, quality: c.quality, hex: perkHex(c.id, c.quality), buy: T.blessPrice(s, 'buy', c), swap: T.blessPrice(s, 'swap') })),
  up: T.blessPrice(s, 'up'), reroll: rerollCost(s),
  held: Object.entries(s.statContext.perks).map(([id, l]) => ({ id, name: perk(id).name, level: l, max: perk(id).max, hex: perkHex(id, s.abilities.quality[id] ?? 0), up: T.strengthenable(s).includes(id) })),
  supplies: [
    ...SPATI_UPGRADE.ids.map((id) => { const u = CAMP_UPGRADES.find((q) => q.id === id); return { name: u.name, sub: `+${u.perLevel}% ${id === 'dmg' ? 'Schaden' : 'Leben'}, bleibt`, have: `${s.statContext.upgrades[id] ?? 0}/${SPATI_UPGRADE.max}`, price: spatiUpgradeCost(s, id), icon: `${REL}/assets/inventory/R02.webp` }; }),
    ...CONSUMABLES.map((c) => ({ name: c.name, sub: c.description, have: `${s.inventory.consumables[c.id]}/3`, price: c.scrapCost, svg: c.id === 'verband' ? VERBAND : MOLOTOW })),
    { name: 'Verbandskasten', sub: 'Heilt dich vollständig', have: '', price: T.healPrice(s), svg: VERBAND },
  ],
  bag: s.inventory.bag.map((it) => ({ icon: iconUrl(it), color: RARITIES[it.rarity].color, il: shownLevel(it), name: it.name, rar: RARITIES[it.rarity].name, slot: SLOT_NAMES[it.slot], stat: statLine(it), sell: scrapValue(it), up: s.equipment[it.slot] ? shownLevel(it) > shownLevel(s.equipment[it.slot]) : true })),
  worn: SLOTS.map((k) => { const it = s.equipment[k]; return { slot: SLOT_NAMES[k], icon: it ? iconUrl(it) : '', color: it ? RARITIES[it.rarity].color : '', il: it ? shownLevel(it) : 0 }; }),
};
M.bagSize = 30;
M.chips = [0, 1, 2].map((r) => ({ name: ['Gewöhnl.', 'Magisch', 'Selten'][r], color: RARITIES[r].color, v: s.inventory.bag.filter((i) => i.rarity === r).reduce((a, i) => a + scrapValue(i), 0) })).filter((c) => c.v > 0);

// ---------------------------------------------------------------- shared look (game palette from src/ui/style.css U3 block)

const FONT = `${REL}/node_modules/@fontsource`;
const CSS = `
@font-face { font-family: 'Barlow Condensed'; font-weight: 400; src: url(${FONT}/barlow-condensed/files/barlow-condensed-latin-400-normal.woff2); }
@font-face { font-family: 'Barlow Condensed'; font-weight: 600; src: url(${FONT}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2); }
@font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url(${FONT}/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2); }
@font-face { font-family: 'Pirata One'; src: url(${FONT}/pirata-one/files/pirata-one-latin-400-normal.woff2); }
:root { --ash:#17110d; --panel:#1d1611; --soot:#2a211b; --rust:#993c1d; --ember:#ef9f27; --bone:#ead9c0; --dim:#a8957d; --edge:#4a3a2e; --good:#8fd16a; --bad:#e05050; --f:'Barlow Condensed','Arial Narrow',sans-serif; --d:'Pirata One',serif; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body { font: 400 16px var(--f); color: var(--bone); letter-spacing: .02em; background: #0b0806 url(bg.webp) center/cover; }
body::before { content: ''; position: fixed; inset: 0; background: rgba(12, 8, 6, .8); }
.scr { position: fixed; inset: 0; display: flex; flex-direction: column; padding: 14px 18px 12px; gap: 10px; }
.hd { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--edge); padding-bottom: 8px; }
.hd h1 { margin: 0; font: 400 30px var(--d); color: var(--ember); letter-spacing: .04em; line-height: 1; }
.hd .q { color: var(--dim); font-size: 16px; }
.hd .sp { flex: 1; }
.res { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 18px; color: var(--dim); }
.res b { color: var(--bone); }
.res img { width: 26px; height: 26px; vertical-align: middle; }
.life { width: 120px; height: 12px; border: 1px solid var(--edge); background: #120d0a; border-radius: 2px; position: relative; }
.life i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(#c94a3a, #8b2a20); }
.x { width: 44px; height: 44px; border: 1px solid var(--edge); background: rgba(13,9,7,.7); color: var(--bone); font-size: 24px; border-radius: 3px; display: grid; place-items: center; }
.tabs { display: flex; gap: 22px; }
.tab { font: 600 19px var(--f); color: var(--dim); padding: 4px 0 6px; border-bottom: 3px solid transparent; display: flex; gap: 6px; align-items: center; }
.tab.on { color: var(--ember); border-bottom-color: var(--ember); }
.tab small { font-size: 14px; color: var(--dim); font-weight: 400; }
h2 { margin: 0 0 6px; font: 600 14px var(--f); letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
.box { background: rgba(29, 22, 17, .92); border: 1px solid var(--edge); border-radius: 4px; }
.cell { position: relative; aspect-ratio: 1; border: 2px solid var(--rc, #3a2e26); border-radius: 3px; background: radial-gradient(circle, color-mix(in srgb, var(--rc, #312b25) 20%, transparent), #120d0a 70%); display: grid; place-items: center; }
.cell img { width: 82%; height: 82%; object-fit: contain; }
.cell.empty { border: 1px solid #3a2e26; background: rgba(18,13,10,.82); }
.cell small { position: absolute; right: 3px; bottom: 1px; font-size: 12px; font-weight: 600; }
.cell .upm { position: absolute; right: 2px; top: 2px; width: 0; height: 0; border: 6px solid transparent; border-bottom: 10px solid var(--good); border-top: 0; }
.cell.sel { outline: 2px solid var(--bone); outline-offset: 1px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 6px 12px; background: rgba(13,9,7,.6); border: 1px solid var(--edge); border-radius: 3px; color: var(--bone); font: 600 15px var(--f); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.btn.p { background: var(--rust); border-color: var(--ember); }
.btn.off { opacity: .45; }
.btn img { width: 20px; height: 20px; }
.focus { outline: 3px solid var(--bone) !important; outline-offset: 2px; box-shadow: 0 0 0 6px rgba(239,159,39,.35); }
.pos { color: var(--good); } .neg { color: var(--bad); }
.hex { width: 44px; height: 44px; flex: none; }
.pad { display: none; gap: 18px; justify-content: flex-end; color: var(--dim); font-size: 15px; }
.pad b { display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 5px; border-radius: 12px; background: #2a211b; border: 1px solid var(--edge); color: var(--bone); font-size: 13px; margin-right: 5px; }
body.deck .pad { display: flex; }
.scroll { overflow: hidden; position: relative; }
.scroll::after { content: ''; position: absolute; right: 2px; top: 4px; width: 4px; height: 38%; background: var(--edge); border-radius: 2px; }
.lvl { display: inline-flex; gap: 3px; vertical-align: middle; }
.lvl i { width: 9px; height: 9px; transform: rotate(45deg); border: 1px solid var(--ember); }
.lvl i.on { background: var(--ember); }
.toast { color: var(--good); font-size: 15px; }
@media (max-height: 560px) {
  .scr { padding: 8px 12px 8px; gap: 6px; }
  .hd { padding-bottom: 5px; gap: 10px; }
  .hd h1 { font-size: 22px; } .hd .q { display: none; }
  .res { font-size: 16px; } .res img { width: 22px; height: 22px; } .life { width: 70px; }
  .x { width: 36px; height: 36px; font-size: 20px; }
  .tab { font-size: 17px; padding: 2px 0 4px; } .tabs { gap: 16px; }
  .btn { min-height: 32px; padding: 4px 9px; font-size: 13px; }
  .hex { width: 34px; height: 34px; }
  h2 { font-size: 12px; margin-bottom: 3px; }
}
`;

const scrapIcon = `<img src="${REL}/assets/inventory/R05.webp" alt="">`;
const header = (mid = '') => `<header class="hd"><h1>${esc(M.name)}</h1><span class="q">${esc(M.quote)}</span>${mid}<span class="sp"></span>
  <div class="res">${scrapIcon}<span>Schrott <b>${M.scrap}</b></span><span class="life"><i style="width:${Math.round((100 * M.hp) / M.maxHp)}%"></i></span><span>${M.hp}/${M.maxHp}</span></div><span class="x">×</span></header>`;
const cell = (it, extra = '') => it ? `<div class="cell ${extra}" style="--rc:${it.color}">${it.icon ? `<img src="${it.icon}" alt="">` : ''}<small style="color:${it.color}">${it.il}</small>${it.up ? '<i class="upm"></i>' : ''}</div>` : '<div class="cell empty"></div>';
const delta = (d) => d == null ? '<span class="pos">neu</span>' : d > 0 ? `<span class="pos">▲ +${d}</span>` : d < 0 ? `<span class="neg">▼ ${d}</span>` : '<span>= 0</span>';
const price = (v, p = false, cls = '') => `<span class="btn ${p ? 'p' : ''} ${M.scrap < v ? 'off' : ''} ${cls}">${scrapIcon}${v}</span>`;
const pad = (items) => `<footer class="pad">${items.map(([k, t]) => `<span><b>${k}</b>${t}</span>`).join('')}</footer>`;
const page = (title, cls, body, extraCss) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${CSS}${extraCss}</style></head>
<body class="${cls}"><div class="scr">${body}</div>
<script>const q = new URLSearchParams(location.search); if (q.has('deck')) document.body.classList.add('deck'); for (const v of (q.get('show') || '').split(',')) if (v) document.body.classList.add('show-' + v);</script></body></html>`;

// ---------------------------------------------------------------- A: two columns, inventory | trader

const A_CSS = `
.a { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 40fr) minmax(0, 60fr); gap: 14px; }
.a-me, .a-shop { display: flex; flex-direction: column; min-height: 0; padding: 10px 12px; }
.worn { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; margin-bottom: 8px; }
.bag { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
.sel { margin-top: auto; padding-top: 8px; border-top: 1px solid var(--edge); display: grid; grid-template-columns: 52px 1fr; gap: 4px 10px; align-items: center; }
.sel .nm { font-weight: 700; font-size: 17px; }
.sel .acts { grid-column: 1 / -1; display: flex; gap: 8px; }
.list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; padding-right: 12px; }
.row { display: grid; grid-template-columns: 46px 1fr auto; gap: 10px; align-items: center; padding: 5px 8px; border: 1px solid transparent; border-radius: 3px; background: rgba(13,9,7,.45); }
.row .nm { font-weight: 700; font-size: 17px; line-height: 1.1; }
.row .sb { color: var(--dim); font-size: 14px; }
.row.hot { border-color: var(--ember); }
.row .cell small { font-size: 11px; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.card { display: grid; grid-template-columns: 44px 1fr; gap: 4px 10px; padding: 8px; border-radius: 4px; border: 1px solid var(--qc); background: linear-gradient(160deg, rgba(60,45,30,.5), rgba(18,13,10,.9)); }
.card .nm { font: 400 20px var(--d); color: var(--qc); line-height: 1; }
.card .ds { font-size: 14px; color: var(--bone); line-height: 1.15; }
.card .acts { grid-column: 1 / -1; display: flex; gap: 6px; }
.card .ql { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--qc); }
@media (max-height: 560px) {
  .a { gap: 8px; grid-template-columns: minmax(0, 37fr) minmax(0, 63fr); }
  .a-me, .a-shop { padding: 6px 8px; }
  .worn { display: none; }
  .bag { grid-template-columns: repeat(6, 1fr); gap: 3px; }
  .bag .cell:nth-child(n+19) { display: none; }
  .sel { grid-template-columns: 34px 1fr; padding-top: 5px; gap: 2px 8px; }
  .sel .nm { font-size: 14px; } .sel .st { display: none; }
  .row { grid-template-columns: 34px 1fr auto; gap: 7px; padding: 3px 6px; }
  .row .nm { font-size: 14px; } .row .sb { font-size: 12px; }
  .list { gap: 4px; }
  .card { grid-template-columns: 34px 1fr; padding: 5px; } .card .nm { font-size: 16px; } .card .ds { font-size: 12px; } .card .ql { display: none; }
}`;
function variantA() {
  const sel = M.bag[2];
  const gear = M.gear.map((g, i) => `<div class="row ${i === 1 ? 'hot' : ''}">${cell({ ...g, up: false })}<div><div class="nm" style="color:${g.color}">${esc(g.name)}</div><div class="sb">${g.rar} · ${g.slot} · Stufe ${g.il} ${delta(g.delta)}</div></div>${price(g.price, i === 1, i === 1 ? 'fx' : '')}</div>`).join('');
  const mod = `<div class="row"><div class="cell" style="--rc:#f2d14b">${modIcon}</div><div><div class="nm">${esc(M.mod.name)} <span class="sb">· stark</span></div><div class="sb">${esc(M.mod.desc)}</div></div>${price(M.mod.price)}</div>`;
  const cards = `<div class="cards">${M.cards.map((c) => `<div class="card" style="--qc:${QUALITY_COLOR[c.quality]}">${c.hex}<div><div class="ql">${cardLabel(c)}</div><div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.desc)}</div></div><div class="acts">${price(c.buy).replace('</span>', ' Kaufen</span>')}<span class="btn">⇄ Tauschen · ${c.swap}</span></div></div>`).join('')}</div>`;
  const up = `<div class="row"><div class="cell" style="--rc:#ef9f27">${M.held[0].hex}</div><div><div class="nm">Stärkung</div><div class="sb">Ein Segen +1 Stufe · 1 übrig</div></div><span class="btn">Wählen · ${M.up}</span></div>`;
  const sup = M.supplies.map((u) => `<div class="row"><div class="cell empty">${supIcon(u)}</div><div><div class="nm">${esc(u.name)} <span class="sb">${u.have}</span></div><div class="sb">${esc(u.sub)}</div></div>${price(u.price)}</div>`).join('');
  const bag = Array.from({ length: M.bagSize }, (_, i) => cell(M.bag[i], i === 2 ? 'sel' : '')).join('');
  const body = `${header()}<main class="a">
  <section class="a-me box"><h2>Du · Rucksack ${M.bag.length}/${M.bagSize}</h2>
    <div class="worn">${M.worn.map((w) => w.icon ? cell({ ...w, up: false }) : '<div class="cell empty"></div>').join('')}</div>
    <div class="bag">${bag}</div>
    <div class="sel">${cell({ ...sel, up: false })}<div><div class="nm" style="color:${sel.color}">${esc(sel.name)}</div><div class="sb st" style="color:var(--dim)">${sel.rar} · ${sel.slot} · ${esc(sel.stat)}</div></div>
      <div class="acts"><span class="btn p">${scrapIcon}Verkaufen +${sel.sell}</span><span class="btn">Anlegen</span></div></div>
  </section>
  <section class="a-shop box"><h2>Händler</h2><div class="list scroll">
    <h2>Waren</h2>${gear}<h2>Aufsatz</h2>${mod}<h2>Segen</h2>${cards}${up}<h2>Vorräte</h2>${sup}
  </div></section></main>
  ${pad([['A', 'Kaufen'], ['X', 'Verkaufen'], ['Y', 'Tauschen'], ['◀ ▶', 'Spalte'], ['B', 'Zurück']])}`;
  return page('M13b A · Zwei Spalten', 'va', body, A_CSS + 'body.deck .fx { outline: 3px solid var(--bone); outline-offset: 2px; box-shadow: 0 0 0 6px rgba(239,159,39,.35); }');
}

// ---------------------------------------------------------------- B: shelf on top, inventory below

const B_CSS = `
.b { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 300px; grid-template-rows: minmax(0, 1fr) auto; gap: 10px; }
.shelf { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; min-height: 0; background: linear-gradient(rgba(42,33,27,.94), rgba(29,22,17,.94)); }
.shelf .rowx { display: flex; gap: 10px; align-items: stretch; }
.grp { display: flex; flex-direction: column; gap: 4px; }
.grp > div { display: flex; gap: 8px; flex: 1; }
.ware { width: 118px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 6px 6px; border-radius: 4px; border: 1px solid var(--edge); background: rgba(13,9,7,.55); text-align: center; position: relative; }
.ware::after { content: ''; position: absolute; left: -6px; right: -6px; bottom: -7px; height: 5px; background: #5a3f2e; border-radius: 2px; }
.ware .cell { width: 56px; }
.grp { gap: 2px; }
.ware .nm { font-weight: 700; font-size: 14px; line-height: 1.05; height: 30px; overflow: hidden; }
.ware .sb { font-size: 13px; color: var(--dim); }
.ware .btn { margin-top: auto; min-height: 30px; padding: 3px 8px; }
.ware.hot { border-color: var(--ember); box-shadow: 0 0 0 1px var(--ember) inset; }
.ware.bless { width: 150px; border-color: var(--qc); }
.ware.bless .nm { font: 400 18px var(--d); color: var(--qc); height: auto; }
.ware.bless .ds { font-size: 12.5px; line-height: 1.1; }
.ware.small { width: 104px; }
.ware.small .cell { width: 44px; }
.ware.small .nm { height: 18px; }
.ware.small .sb { display: none; }
.det { grid-row: 1 / 3; grid-column: 2; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.det .nm { font-weight: 700; font-size: 20px; }
.det .cmp { border-top: 1px solid var(--edge); padding-top: 6px; color: var(--dim); font-size: 14px; }
.det .big { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
.det .big .btn { min-height: 46px; font-size: 17px; }
.strip { grid-column: 1; padding: 8px 12px; display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; }
.strip .bagrow { display: grid; grid-auto-flow: column; grid-auto-columns: 46px; gap: 5px; overflow: hidden; }
@media (max-height: 560px) {
  .b { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto auto; gap: 6px; }
  .shelf { padding: 6px 8px; gap: 10px; overflow: hidden; flex-direction: row; align-items: flex-start; }
  .shelf .rowx { display: contents; }
  .ware { width: 96px; padding: 4px; } .ware .cell { width: 44px; } .ware .nm { font-size: 12.5px; height: 27px; } .ware .sb { font-size: 11.5px; }
  .ware.bless { width: 120px; } .ware.bless .ds { display: none; } .ware.bless .nm { font-size: 15px; }
  .det { grid-row: auto; grid-column: 1; flex-direction: row; align-items: center; padding: 5px 10px; gap: 10px; }
  .det .cmp, .det .aff { display: none; } .det .nm { font-size: 15px; } .det .big { margin: 0 0 0 auto; flex-direction: row; } .det .big .btn { min-height: 34px; font-size: 14px; }
  .strip { padding: 4px 8px; gap: 8px; } .strip .bagrow { grid-auto-columns: 34px; gap: 3px; }
}`;
function variantB() {
  const g = M.gear;
  const ware = (x, i) => `<div class="ware ${i === 1 ? 'hot' : ''}">${cell({ ...x, up: false })}<div class="nm" style="color:${x.color}">${esc(x.name)}</div><div class="sb">${x.slot} · ${delta(x.delta)}</div>${price(x.price, i === 1, i === 1 ? 'fx' : '')}</div>`;
  const mod = `<div class="ware"><div class="cell" style="--rc:#f2d14b">${modIcon}</div><div class="nm">${esc(M.mod.name)}</div><div class="sb">Aufsatz · stark</div>${price(M.mod.price)}</div>`;
  const bl = M.cards.map((c) => `<div class="ware bless" style="--qc:${QUALITY_COLOR[c.quality]}">${c.hex}<div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.desc)}</div><div class="sb">${cardLabel(c)} · ⇄ ${c.swap}</div>${price(c.buy)}</div>`).join('');
  const up = `<div class="ware bless" style="--qc:#ef9f27">${M.held[0].hex}<div class="nm">Stärkung</div><div class="ds">Ein Segen +1 Stufe</div><div class="sb">1 übrig</div>${price(M.up)}</div>`;
  const sup = M.supplies.map((u) => `<div class="ware small"><div class="cell empty">${supIcon(u)}${u.have ? `<small style="color:var(--dim)">${u.have}</small>` : ''}</div><div class="nm">${esc(u.name)}</div><div class="sb">${u.have || 'voll heilen'}</div>${price(u.price)}</div>`).join('');
  const sel = g[1];
  const det = `<aside class="det box"><h2>Ausgewählt</h2><div style="display:flex;gap:10px;align-items:center"><div class="cell" style="--rc:${sel.color};width:64px"><img src="${sel.icon}" alt=""></div><div><div class="nm" style="color:${sel.color}">${esc(sel.name)}</div><div class="sb" style="color:var(--dim)">${sel.rar} · ${sel.slot} · Stufe ${sel.il}</div></div></div>
    <div class="aff">${esc(sel.stat)}<br>${sel.affixes.map(esc).join('<br>')}</div>
    <div class="cmp">Angelegt: <span style="color:${sel.worn?.color}">${esc(sel.worn?.name ?? '–')}</span> · Stufe ${sel.worn?.il ?? '–'}<br>${esc(sel.worn?.stat ?? '')}</div>
    <div class="big"><span class="btn p fx">${scrapIcon}Kaufen · ${sel.price}</span></div></aside>`;
  const bag = M.bag.map((it, i) => cell(it, i === 2 ? 'sel' : '')).join('') + Array.from({ length: 6 }, () => cell(null)).join('');
  const body = `${header()}<main class="b">
  <section class="shelf box">
    <div class="rowx"><div class="grp"><h2>Waren</h2><div>${g.map(ware).join('')}</div></div><div class="grp"><h2>Aufsatz</h2><div>${mod}</div></div></div>
    <div class="rowx"><div class="grp"><h2>Segen</h2><div>${bl}${up}</div></div></div>
    <div class="rowx"><div class="grp"><h2>Vorräte</h2><div>${sup}</div></div></div>
  </section>
  ${det}
  <section class="strip box"><h2 style="margin:0">Rucksack<br>${M.bag.length}/${M.bagSize}</h2><div class="bagrow">${bag}</div><span class="btn">${scrapIcon}Verkaufen +${M.bag[2].sell}</span></section>
  </main>${pad([['A', 'Kaufen'], ['◀ ▶', 'Regal'], ['▲ ▼', 'Reihe / Rucksack'], ['LB RB', 'Gruppe'], ['B', 'Zurück']])}`;
  // Phone: one shelf row that scrolls sideways through every group (Segen peeks in at the right edge).
  const phone = `@media (max-height: 560px) { .shelf::after { content: '›'; position: absolute; right: 6px; top: 40%; font-size: 30px; color: var(--ember); } .shelf { position: relative; } }`;
  return page('M13b B · Regal oben', 'vb', body, B_CSS + phone + 'body.deck .fx { outline: 3px solid var(--bone); outline-offset: 2px; box-shadow: 0 0 0 6px rgba(239,159,39,.35); }');
}

// ---------------------------------------------------------------- C: tabs Waren · Segen · Verkaufen

const C_CSS = `
.c { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 14px; }
.pane { display: none; } .pane.on { display: contents; }
.lst { padding: 10px 12px; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 110px)); gap: 8px; }
.tile { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.tile .cell { width: 100%; }
.tile .btn { width: 100%; min-height: 30px; padding: 3px 6px; }
.tile .nm { font-size: 13px; color: var(--dim); text-align: center; line-height: 1.05; height: 28px; overflow: hidden; }
.dcard { padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.ic { border: 1px solid var(--edge); border-radius: 4px; padding: 8px 10px; background: rgba(13,9,7,.5); }
.ic .lb { font-size: 12px; letter-spacing: .12em; color: var(--dim); text-transform: uppercase; }
.ic .nm { font-weight: 700; font-size: 19px; }
.ic .sb { color: var(--dim); font-size: 14px; }
.ic .st { font-weight: 600; margin-top: 4px; }
.dcard .big { margin-top: auto; display: flex; gap: 8px; } .dcard .big .btn { flex: 1; min-height: 46px; font-size: 17px; }
.bcards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 4px; }
.bc { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 14px 12px 12px; border-radius: 6px; border: 2px solid var(--qc); background: linear-gradient(160deg, rgba(70,52,34,.55), rgba(18,13,10,.92)); box-shadow: 0 0 18px color-mix(in srgb, var(--qc) 35%, transparent); }
.bc .hex { width: 64px; height: 64px; }
.bc .ql { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--qc); }
.bc .nm { font: 400 26px var(--d); color: var(--qc); line-height: 1; }
.bc .ds { font-size: 16px; min-height: 40px; }
.bc .acts { display: flex; gap: 8px; width: 100%; margin-top: auto; } .bc .acts .btn { flex: 1; }
.held { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.hr { display: grid; grid-template-columns: 38px 1fr auto; gap: 8px; align-items: center; padding: 4px 6px; border-radius: 3px; background: rgba(13,9,7,.45); border: 1px solid transparent; }
.hr .hex { width: 36px; height: 36px; }
.hr .nm { font-weight: 700; font-size: 16px; }
.hr.swap { border-color: #7d9bff; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 4px 10px; border-radius: 14px; border: 1px solid var(--edge); font-weight: 600; font-size: 14px; background: rgba(13,9,7,.6); }
.sbag { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
@media (max-height: 560px) {
  .c { grid-template-columns: minmax(0, 1fr) 250px; gap: 8px; }
  .lst, .dcard, .held { padding: 6px 8px; gap: 5px; }
  .tiles { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 5px; }
  .tile .nm { display: none; } .tile .btn { min-height: 26px; font-size: 12px; } .tile .btn img { width: 16px; height: 16px; }
  .ic { padding: 5px 7px; } .ic .nm { font-size: 15px; } .ic .sb { font-size: 12px; } .ic .aff { display: none; }
  .dcard .big .btn { min-height: 36px; font-size: 14px; }
  .bcards { gap: 8px; padding: 0; } .bc { padding: 6px 8px; gap: 3px; } .bc .hex { width: 40px; height: 40px; } .bc .nm { font-size: 19px; } .bc .ds { font-size: 13px; min-height: 0; } .bc .ql { font-size: 11px; }
  .hr { grid-template-columns: 30px 1fr auto; padding: 2px 5px; gap: 6px; } .hr .hex { width: 28px; height: 28px; } .hr .nm { font-size: 14px; }
  .sbag { grid-template-columns: repeat(8, 1fr); gap: 3px; }
}`;
function variantC() {
  const tabs = `<nav class="tabs" style="margin-left:22px"><span class="tab t-waren">Waren <small>${M.gear.length + 1 + M.supplies.length}</small></span><span class="tab t-segen">Segen <small>${M.cards.length + 1}</small></span><span class="tab t-verkaufen">Verkaufen</span></nav>`;
  const g = M.gear, sel = g[1];
  const tile = (x, i) => `<div class="tile">${cell({ ...x, up: x.delta > 0 }, i === 1 ? 'sel' : '')}<div class="nm">${esc(x.name)}</div>${price(x.price, false, '')}</div>`;
  const supTile = (u) => `<div class="tile"><div class="cell empty">${supIcon(u)}${u.have ? `<small style="color:var(--dim)">${u.have}</small>` : ''}</div><div class="nm">${esc(u.name)}</div>${price(u.price)}</div>`;
  const waren = `<div class="pane p-waren"><section class="lst box"><h2>Ausrüstung und Aufsatz</h2><div class="tiles">${g.map(tile).join('')}<div class="tile"><div class="cell" style="--rc:#f2d14b">${modIcon}</div><div class="nm">${esc(M.mod.name)} (stark)</div>${price(M.mod.price)}</div></div>
    <h2>Vorräte</h2><div class="tiles">${M.supplies.map(supTile).join('')}</div></section>
    <aside class="dcard box"><div class="ic"><div class="lb">Angebot</div><div class="nm" style="color:${sel.color}">${esc(sel.name)}</div><div class="sb">${sel.rar} · ${sel.slot} · Stufe ${sel.il} ${delta(sel.delta)}</div><div class="st">${esc(sel.stat)}</div><div class="aff sb">${sel.affixes.map(esc).join('<br>')}</div></div>
    <div class="ic"><div class="lb">Angelegt</div><div class="nm" style="color:${sel.worn?.color}">${esc(sel.worn?.name ?? '–')}</div><div class="sb">Stufe ${sel.worn?.il ?? '–'}</div><div class="st">${esc(sel.worn?.stat ?? '')}</div></div>
    <div class="big"><span class="btn p fx">${scrapIcon}Kaufen · ${sel.price}</span></div></aside></div>`;
  const segen = `<div class="pane p-segen"><section class="lst box"><h2>Neue Segen · gelten bis zum Ende der Expedition</h2><div class="bcards">${M.cards.map((c, i) => `<div class="bc" style="--qc:${QUALITY_COLOR[c.quality]}"><div class="ql">${cardLabel(c)}</div>${c.hex.replace('class="hex"', 'class="hex"')}<div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.desc)}</div><div class="acts">${price(c.buy, i === 0, i === 0 ? 'fx' : '').replace('</span>', ' Kaufen</span>')}<span class="btn">⇄ Tauschen · ${c.swap}</span></div></div>`).join('')}</div></section>
    <aside class="held box"><h2>Deine Segen · Stärkung ${M.up} (1 übrig)</h2>${M.held.map((h, i) => `<div class="hr ${i === 2 ? 'swap' : ''}">${h.hex}<div><div class="nm">${esc(h.name)}</div><span class="lvl">${Array.from({ length: h.max }, (_, k) => `<i class="${k < h.level ? 'on' : ''}"></i>`).join('')}</span></div>${h.up ? `<span class="btn">+1</span>` : '<span class="sb" style="color:var(--dim);font-size:13px">voll</span>'}</div>`).join('')}<div class="sb" style="color:var(--dim);font-size:13px">Tauschen: erst Karte, dann deinen Segen wählen. Die Stufen gehen mit.</div></aside></div>`;
  const bag = Array.from({ length: M.bagSize }, (_, i) => cell(M.bag[i], i === 2 ? 'sel' : '')).join('');
  const s2 = M.bag[2];
  const verk = `<div class="pane p-verkaufen"><section class="lst box"><div class="chips"><h2 style="margin:4px 8px 0 0">Rucksack ${M.bag.length}/${M.bagSize}</h2>${M.chips.map((c) => `<span class="chip" style="color:${c.color}">${c.name} +${c.v}</span>`).join('')}</div><div class="sbag">${bag}</div></section>
    <aside class="dcard box"><div class="ic"><div class="lb">Ausgewählt</div><div class="nm" style="color:${s2.color}">${esc(s2.name)}</div><div class="sb">${s2.rar} · ${s2.slot} · Stufe ${s2.il}</div><div class="st">${esc(s2.stat)}</div></div>
    <div class="sb" style="color:var(--dim);font-size:14px">Verkaufen zahlt so viel wie Zerlegen, mit Material.</div>
    <div class="big"><span class="btn p fx">${scrapIcon}Verkaufen +${s2.sell}</span><span class="btn">Anlegen</span></div></aside></div>`;
  const body = `${header(tabs)}<main class="c">${waren}${segen}${verk}</main>${pad([['A', 'Kaufen'], ['Y', 'Tauschen'], ['LB RB', 'Reiter'], ['✚', 'Auswahl'], ['B', 'Zurück']])}`;
  const sw = ['waren', 'segen', 'verkaufen'].map((t) => `body.show-${t} .p-${t} { display: contents; } body.show-${t} .t-${t} { color: var(--ember); border-bottom-color: var(--ember); }`).join('\n');
  return page('M13b C · Reiter', 'vc', body, C_CSS + sw + ' body.deck .fx { outline: 3px solid var(--bone); outline-offset: 2px; box-shadow: 0 0 0 6px rgba(239,159,39,.35); }');
}

// ---------------------------------------------------------------- shots and sheets

const VARIANTS = [
  { id: 'a', file: 'a-zwei-spalten', html: variantA(), title: 'A · Zwei Spalten: Rucksack | Händler', shows: ['', '', ''],
    notes: [
      ['Aufbau', 'Links du: angelegte Teile, Rucksack, gewähltes Teil mit Verkaufen. Rechts der Händler als eine Liste: Waren, Aufsatz, Segen, Vorräte.'],
      ['Fokus (Deck)', 'Steuerkreuz hoch/runter in der Spalte, links/rechts wechselt die Spalte. A kauft, X verkauft, Y tauscht einen Segen, B schließt. Rechter Stick scrollt die Liste.'],
      ['Stark', 'Wie Diablo: Rucksack immer sichtbar, Verkaufen und Kaufen ohne Umschalten.'],
      ['Schwach', 'Die Händlerliste ist lang und scrollt; Segen-Karten sind klein. Am Handy eng.'],
    ] },
  { id: 'b', file: 'b-regal', html: variantB(), title: 'B · Regal oben, Rucksack unten', shows: ['', '', ''],
    notes: [
      ['Aufbau', 'Oben das Regal des Späti: Waren und Aufsatz, darunter Segen und Vorräte als Karten. Rechts das gewählte Angebot mit Vergleich. Unten der Rucksack als Leiste.'],
      ['Fokus (Deck)', 'Links/rechts durchs Regal, hoch/runter zwischen den Reihen und zum Rucksack. LB/RB springt zur nächsten Gruppe. A kauft, B schließt.'],
      ['Stark', 'Alles Angebot auf einen Blick, wie ein Ladentisch; wenig Text.'],
      ['Schwach', 'Am Handy passt nur eine Regalreihe (wischen); Vergleich nur als Leiste. Verkaufen ist zweitrangig.'],
    ] },
  { id: 'c', file: 'c-reiter', html: variantC(), title: 'C · Reiter: Waren · Segen · Verkaufen', shows: ['waren', 'segen', 'verkaufen'],
    notes: [
      ['Aufbau', 'Reiter wie im Pausenmenü. Waren: Kacheln links, Vergleich rechts (wie Inventar). Segen: zwei große Karten wie die Segenwahl, rechts deine Segen mit +1 und Tauschen. Verkaufen: Rucksack mit Sammel-Chips.'],
      ['Fokus (Deck)', 'LB/RB wechselt den Reiter (wie im Menü), Steuerkreuz bewegt in den Kacheln, A kauft, Y tauscht, B schließt.'],
      ['Stark', 'Jeder Teil hat Platz, auch am Handy; Segen sehen aus wie die Segenwahl. Am meisten Code aus Inventar und Segenwahl wiederverwendbar.'],
      ['Schwach', 'Ein Druck mehr zwischen Kaufen und Verkaufen; Segen sind einen Reiter weit weg.'],
    ] },
];
const SIZES = [[1280, 720, ''], [844, 390, ''], [1280, 800, 'deck']];

const browser = await chromium.launch();
for (const v of VARIANTS) {
  const htmlPath = join(DIR, `${v.file}.html`);
  writeFileSync(htmlPath, v.html);
  for (const [i, [w, h, mode]] of SIZES.entries()) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    const q = new URLSearchParams();
    if (mode) q.set('deck', '1');
    if (v.shows[i]) q.set('show', v.shows[i]);
    await pg.goto(`${pathToFileURL(htmlPath).href}?${q}`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(200);
    const png = await pg.screenshot();
    await sharp(png).webp({ quality: 84 }).toFile(join(DIR, `${v.file}-${w}x${h}.webp`));
    await ctx.close();
  }
  // The sheet: 1280×720 large on the left with the notes below, phone and Deck on the right.
  const W = 1880, H = 1010;
  const wrap = (t, n) => { const out = []; let line = ''; for (const word of t.split(' ')) { if ((line + ' ' + word).trim().length > n) { out.push(line.trim()); line = word; } else line += ' ' + word; } if (line.trim()) out.push(line.trim()); return out; };
  let y = 700;
  const notes = v.notes.map(([k, t]) => { const lines = wrap(t, 118); const o = `<text x="24" y="${y}" fill="#ef9f27" font-size="17" font-weight="700">${esc(k)}</text>${lines.map((l, j) => `<text x="150" y="${y + j * 21}" fill="#ead9c0" font-size="17">${esc(l)}</text>`).join('')}`; y += lines.length * 21 + 12; return o; }).join('');
  const shot = (f, x, yy, w, h, label) => `<text x="${x}" y="${yy - 8}" fill="#a8957d" font-size="15">${label}</text><rect x="${x - 1}" y="${yy - 1}" width="${w + 2}" height="${h + 2}" fill="none" stroke="#4a3a2e"/><image href="${f}" x="${x}" y="${yy}" width="${w}" height="${h}"/>`;
  const lab = (i) => (v.shows[i] ? ` · Reiter ${v.shows[i][0].toUpperCase()}${v.shows[i].slice(1)}` : '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Barlow Condensed, Arial Narrow, sans-serif">
<style>@font-face { font-family: 'Barlow Condensed'; src: url(${FONT}/barlow-condensed/files/barlow-condensed-latin-400-normal.woff2); } @font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url(${FONT}/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2); } @font-face { font-family: 'Pirata One'; src: url(${FONT}/pirata-one/files/pirata-one-latin-400-normal.woff2); }</style>
<rect width="${W}" height="${H}" fill="#120d0a"/>
<text x="24" y="40" fill="#ef9f27" font-size="30" font-weight="700">M13b Händler · ${esc(v.title)}</text>
<text x="24" y="64" fill="#a8957d" font-size="16">Echtes Späti-Angebot aus src/sim/trade.ts (Xhain, Welle 8, 840 Schrott). Text Deutsch, kurz. Ränder: Rarität; heller Rahmen: Fokus.</text>
${shot(`${v.file}-1280x720.webp`, 24, 96, 1024, 576, `1280 × 720 (PC)${lab(0)}`)}
${shot(`${v.file}-844x390.webp`, 1084, 96, 772, 357, `844 × 390 (Handy quer)${lab(1)}`)}
${shot(`${v.file}-1280x800.webp`, 1084, 490, 772, 483, `1280 × 800 (Steam Deck, Pad)${lab(2)}`)}
${notes}
</svg>`;
  const svgPath = join(DIR, `${v.file}.svg`);
  writeFileSync(svgPath, svg);
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const pg = await ctx.newPage();
  await pg.goto(pathToFileURL(svgPath).href);
  await pg.waitForTimeout(500);
  const png = await pg.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  await sharp(png).webp({ quality: 86 }).toFile(join(DIR, `${v.file}.webp`));
  await ctx.close();
  console.log(`${v.file}: html, svg, webp, 3 shots`);
}
await browser.close();
