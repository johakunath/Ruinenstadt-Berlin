import { it } from 'vitest';
import { readHeroGlb } from './hero-glb-node';
it('weights', () => {
  const g = readHeroGlb();
  for (const node of ['a_mantel', 'a_weste', 'body_head', 'hair', 'scarf']) {
    const m = g.mesh(node), geo = m.geometry, p = geo.attributes.position!, si = geo.attributes.skinIndex!, sw = geo.attributes.skinWeight!;
    const names = m.skeleton.bones.map((b) => b.name);
    const bands: Record<string, Record<string, number>> = {};
    const idx = new Set(Array.from(geo.index!.array));
    for (const i of idx) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i) + 0.045, r = Math.hypot(x, z);
      if (y < 1.38 || y > 1.56 || r > 0.14) continue;
      const a = Math.abs(Math.atan2(x, z)), key = `${(Math.round(y * 50) / 50).toFixed(2)} ${a < 0.8 ? 'front' : a < 2.3 ? 'side ' : 'back '}`;
      const b = (bands[key] ??= {});
      for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > 0.01) { const n = names[si.getComponent(i, c)]!; b[n] = (b[n] ?? 0) + w; } }
      b.__n = (b.__n ?? 0) + 1;
    }
    console.log('==', node);
    for (const k of Object.keys(bands).sort().reverse()) { const b = bands[k]!; const n = b.__n!; console.log(k, n, Object.entries(b).filter(([q]) => q !== '__n').map(([q, w]) => `${q}:${(w / n).toFixed(2)}`).join(' ')); }
  }
});
