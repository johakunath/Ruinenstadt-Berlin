// Balance runner (M14): the bot plays fresh Köpenick campaigns in Node, no browser.
//   node tools/balance.mjs [runs=5] [difficulty=normal] [skill=johannes|good|weak] [seed=1] [--miss=0.3] [--react=0.25,0.5] [--at=4] [--until=6] [--map=xhain|alex|mitte|charlottenburg|wedding|turm|tunnel0..3]
//   node tools/balance.mjs 3 normal johannes 1 --map=wedding --carry   (each run starts with the gear one hero earned in the districts before)
//   node tools/balance.mjs 3 normal johannes 1 --chain   (one hero through all six districts and the Fernsehturm; gear and camp carry over, tunnels count as cleared)
//   node tools/balance.mjs 3 normal johannes 1 --campaign   (B2: the whole game with the four tunnels and the camp; adds a Schrott table per map)
// Prints one line per run and a table per encounter: tries, time, damage taken and lowest life.
// Rerun after every balance change and compare with docs/balance.md.
import { createServer } from 'vite';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const runs = Number(args[0] ?? 5), difficulty = args[1] ?? 'normal', skillName = args[2] ?? 'johannes', seed = Number(args[3] ?? 1);
const NAME = { koepenick: 'Köpenick', xhain: 'Xhain', alex: 'Alexanderplatz', mitte: 'Mitte', charlottenburg: 'Charlottenburg', wedding: 'Wedding', turm: 'Fernsehturm', tunnel0: 'S3-Tunnel', tunnel1: 'U8-Tunnel', tunnel2: 'U2-Tunnel', tunnel3: 'U2-Tunnel West' };

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { balance, chain, CHAIN, CAMPAIGN, SKILLS } = await server.ssrLoadModule('/src/bot/run.ts');
  const skill = { ...(SKILLS[skillName] ?? SKILLS.johannes) };
  if (flag('miss')) skill.miss = Number(flag('miss'));
  if (flag('react')) skill.react = flag('react').split(',').map(Number);
  const tunnels = process.argv.includes('--campaign');
  if (tunnels || process.argv.includes('--chain')) {
    const steps = tunnels ? CAMPAIGN : CHAIN;
    console.log(`${tunnels ? 'Campaign' : 'Chain'} ${steps.map((m) => NAME[m]).join(' → ')}, ${difficulty}, skill ${skillName}, ${runs} runs from seed ${seed}`);
    const t0 = Date.now();
    const all = chain({ runs, difficulty, skill, seed, tunnels }, (i, map, r) => {
      const fights = r.encounters.filter((e) => e.time > 0);
      const worst = [...r.encounters].sort((a, b) => b.deaths - a.deaths)[0];
      const dmg = fights.length ? fights.reduce((a, e) => a + e.damage, 0) / fights.length : 0;
      const bosses = r.encounters.filter((e) => e.boss && e.time > 0);
      console.log(`${String(i + 1).padStart(3)} ${NAME[map].padEnd(15)} ${r.won ? 'WIN ' : 'stop'} ${(r.time / 60).toFixed(1).padStart(5)} min  deaths ${String(r.deaths).padStart(2)}  power ${String(r.encounters[0]?.power ?? 0).padStart(4)} → ${String(r.power).padStart(4)}  avg dmg ${Math.round(dmg * 100)}%  bosses ${bosses.map((b) => `${Math.round(b.time)}s/${Math.round(b.damage * 100)}%`).join(' ')}  ${worst && worst.deaths ? `most deaths: ${worst.name} (${worst.deaths})` : ''}${r.won ? '' : `  stuck: ${r.stuckAt}`}`);
    });
    const done = all.filter((runs) => runs.length === steps.length && runs[steps.length - 1].won).length;
    console.log(`\n${done}/${all.length} chains finished all ${steps.length} maps (${((Date.now() - t0) / 1000).toFixed(0)} s wall time)`);
    if (tunnels) {
      // B2 step 1: where the Schrott went, per map, averaged over the chains that reached it. "Camp" is the camp step before the map.
      console.log('\n| Map | Played | Won | Deaths | Min | Earned (salvage) | Items | Späti upgr. | Camp before | Left | Item level end (weapon) | Power end |');
      console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
      steps.forEach((map, d) => {
        const rows = all.map((runs) => runs[d]).filter(Boolean);
        if (!rows.length) return;
        const avg = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
        const n = (f) => Math.round(avg(f));
        console.log(`| ${NAME[map]} | ${rows.length} | ${rows.filter((r) => r.won).length} | ${avg((r) => r.deaths).toFixed(1)} | ${avg((r) => r.time / 60).toFixed(1)} | ${n((r) => r.economy.earned)} (${n((r) => r.economy.salvage)}) | ${n((r) => r.economy.items)} | ${n((r) => r.economy.upgrades)} | ${n((r) => r.economy.camp)} | ${n((r) => r.economy.left)} | ${avg((r) => r.economy.itemLevel).toFixed(1)} (${n((r) => r.economy.weaponLevel)}) | ${n((r) => r.power)} |`);
      });
    }
    process.exit(0);
  }
  const map = Object.keys(NAME).includes(flag('map')) ? flag('map') : 'koepenick';
  console.log(`${NAME[map]}, ${difficulty}, skill ${skillName} (miss ${skill.miss}, react ${skill.react.join('–')} s), ${runs} runs from seed ${seed}`);
  const pct = (v) => `${Math.round(v * 100)}%`.padStart(4);
  const t0 = Date.now();
  if (process.argv.includes('--carry')) console.log('carry: one hero plays the districts before this one first; every run starts with that gear');
  const reports = balance({ map, runs, difficulty, skill, seed, carry: process.argv.includes('--carry'), startAt: flag('at') ? Number(flag('at')) : undefined, until: flag('until') ? Number(flag('until')) : undefined }, (i, r) => {
    console.log(`${String(i + 1).padStart(3)} ${r.won ? 'WIN ' : 'stop'} ${(r.time / 60).toFixed(1).padStart(5)} min  deaths ${String(r.deaths).padStart(2)}  kills ${String(r.kills).padStart(4)}  power ${String(r.power).padStart(4)} ${r.weapon.padEnd(6)} Schrott +${r.economy.earned} −${r.economy.items + r.economy.upgrades + r.economy.camp} = ${r.economy.left}  ${r.stuckAt}`);
  });
  console.log(`\n${'Encounter'.padEnd(24)} won  deaths/run  time s  dmg taken  lowest life  power`);
  const n = reports.length;
  reports[0].encounters.forEach((e, i) => {
    const rows = reports.map((r) => r.encounters[i]);
    const wonRows = rows.filter((r) => r.time > 0);
    const avg = (k) => (wonRows.length ? wonRows.reduce((a, r) => a + r[k], 0) / wonRows.length : 0);
    console.log(`${(e.boss ? '★ ' : '  ') + e.name.padEnd(22)} ${String(wonRows.length).padStart(2)}/${n}  ${(rows.reduce((a, r) => a + r.deaths, 0) / n).toFixed(1).padStart(8)}  ${avg('time').toFixed(0).padStart(6)}  ${pct(avg('damage')).padStart(9)}  ${pct(avg('low')).padStart(11)}  ${avg('power').toFixed(0).padStart(5)}`);
  });
  const wins = reports.filter((r) => r.won).length;
  console.log(`\n${wins}/${n} campaigns won, ${(reports.reduce((a, r) => a + r.deaths, 0) / n).toFixed(1)} deaths and ${(reports.reduce((a, r) => a + r.time, 0) / n / 60).toFixed(1)} min per campaign (${((Date.now() - t0) / 1000).toFixed(0)} s wall time)`);
} finally {
  await server.close();
}
