// Hero file contract (H1, docs/tasks/h1-hero.md): joint names and order, clip targets, budgets.
// Reads the committed GLBs directly; no Three.js loader needed.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HERO_BUDGET, HERO_CORE_JOINTS, HERO_EXTRA_JOINTS } from '../data/hero-contract';

interface Gltf {
  nodes: { name?: string; mesh?: number; skin?: number }[];
  meshes: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  accessors: { count: number }[];
  skins?: { joints: number[] }[];
  animations?: { name?: string; channels: { target: { node?: number; path: string } }[] }[];
}

const file = (name: string) => fileURLToPath(new URL(`../../assets/characters/${name}`, import.meta.url));

/** JSON chunk of a binary glTF. */
function readGlb(name: string): Gltf {
  const buf = readFileSync(file(name));
  expect(buf.toString('ascii', 0, 4)).toBe('glTF');
  const length = buf.readUInt32LE(12);
  expect(buf.toString('ascii', 16, 20)).toBe('JSON');
  return JSON.parse(buf.toString('utf8', 20, 20 + length)) as Gltf;
}

describe('hero.glb contract', () => {
  const hero = readGlb('hero.glb');
  const skinned = hero.nodes.filter((n) => n.mesh !== undefined && n.skin !== undefined);

  it('has one skin with the core UAL joints in order, then known extras in contract order', () => {
    expect(hero.skins).toHaveLength(1);
    const names = hero.skins![0]!.joints.map((i) => hero.nodes[i]!.name);
    expect(names.slice(0, HERO_CORE_JOINTS.length)).toEqual(HERO_CORE_JOINTS);
    const extras = names.slice(HERO_CORE_JOINTS.length);
    expect(extras).toEqual(HERO_EXTRA_JOINTS.filter((n) => extras.includes(n)));
    expect(extras).toEqual(expect.arrayContaining(['scarf_01', 'scarf_02', 'scarf_03']));
    expect(names.length).toBeLessThanOrEqual(HERO_BUDGET.joints);
  });

  it('keeps every mesh skinned and inside the triangle and draw call budget', () => {
    expect(skinned.length).toBe(hero.nodes.filter((n) => n.mesh !== undefined).length);
    const prims = skinned.flatMap((n) => hero.meshes[n.mesh!]!.primitives);
    const triangles = prims.reduce((s, p) => s + hero.accessors[p.indices!]!.count / 3, 0);
    expect(prims.length).toBeLessThanOrEqual(HERO_BUDGET.skinnedDrawCalls);
    expect(triangles).toBeLessThanOrEqual(HERO_BUDGET.triangles);
    for (const p of prims) {
      expect(Object.keys(p.attributes)).toEqual(expect.arrayContaining(['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']));
      expect(p.attributes.JOINTS_1).toBeUndefined();
    }
  });

  it('stays under the file size budget', () => {
    expect(statSync(file('hero.glb')).size).toBeLessThanOrEqual(HERO_BUDGET.fileBytes);
  });
});

describe('anims.glb contract', () => {
  const anims = readGlb('anims.glb');
  const core = new Set(HERO_CORE_JOINTS);

  it('targets only core joints: rotations everywhere, translation on the pelvis only', () => {
    expect(anims.animations?.length).toBeGreaterThan(0);
    for (const clip of anims.animations!) {
      for (const { target } of clip.channels) {
        const name = anims.nodes[target.node!]!.name!;
        expect(core.has(name), `${clip.name} targets ${name}`).toBe(true);
        expect(target.path === 'rotation' || (target.path === 'translation' && name === 'pelvis'), `${clip.name} ${name} ${target.path}`).toBe(true);
      }
    }
  });
});
