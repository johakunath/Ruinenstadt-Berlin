// Builds assets/characters/zombie.glb and anims.glb from the CC0 source packs in assets-src/
// (not committed; fetch them with tools/fetch-assets.sh). See assets/LICENSES.md.
// The hero is built by tools/build-hero.mjs (`npm run assets:hero`, needs Blender).
//
//   zombie.glb  Superhero_Male body, simplified, grey-green skin, rags.
//   anims.glb   Skeleton plus the clips the game uses from Universal Animation Library 1 and 2.
import { mergeDocuments, resample, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { SRC, dress, finish, hash, io, readGltf, slimMaterials, stripAttributes } from './character-lib.mjs';

const CLIPS = {
  'UAL1_Standard.glb': ['Idle_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Roll', 'Hit_Chest', 'Death01', 'Sword_Idle',
    // M7/M8/M16: spear thrusts, casts, leaps, interactions.
    'Punch_Jab', 'Punch_Cross', 'Sword_Attack', 'Spell_Simple_Shoot', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Interact'],
  'UAL2_Standard.glb': [
    'Sword_Regular_A', 'Sword_Regular_A_Rec', 'Sword_Regular_B', 'Sword_Regular_B_Rec', 'Sword_Regular_C', 'Sword_Dash',
    'Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Zombie_Scratch', 'Hit_Knockback',
    // M7/M8/M16: hammer swings, throws, guard, consumables.
    'Sword_Heavy_Combo', 'Sword_Regular_Combo', 'TreeChopping_Loop', 'OverhandThrow', 'Sword_Block', 'Consume',
    'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'Shield_Dash', 'Melee_Hook', 'Idle_Shield_Loop', 'Chest_Open',
  ],
};

// ---------------------------------------------------------------- zombie

async function buildZombie() {
  const doc = await readGltf(`${SRC}/body/Superhero_Male_FullBody.gltf`);
  stripAttributes(doc);
  const root = doc.getRoot();
  // No eyebrows; the eyes stay and glow in the game.
  for (const node of root.listNodes()) if (node.getName() === 'Eyebrows') node.dispose();
  await MeshoptSimplifier.ready;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.36, error: 0.004 }));
  await slimMaterials(doc, 512, async (img, size) => {
    // Dead skin: grey-green, darker, with bruises and wounds.
    let blots = '';
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 1, 2) * size;
      const y = hash(i, 5, 3) * size;
      const r = 6 + hash(i, 8, 1) * 26;
      const kind = hash(i, 2, 9);
      const fill = kind < 0.4 ? '#3a1512' : kind < 0.75 ? '#2c3f3a' : '#55603a';
      blots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${(0.25 + hash(i, 4, 4) * 0.45).toFixed(2)}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="b"><feGaussianBlur stdDeviation="4"/></filter><g filter="url(#b)">${blots}</g></svg>`;
    const base = await img.modulate({ saturation: 0.25, brightness: 1.35 }).tint({ r: 196, g: 200, b: 176 }).toBuffer();
    return sharp(base).composite([{ input: Buffer.from(svg), blend: 'multiply' }]);
  });
  const skin = root.listSkins()[0];
  const bodyNode = root.listNodes().find((n) => n.getName() === 'SuperHero_Male');
  const mesh = bodyNode.getMesh();
  const body = mesh.listPrimitives()[0];
  const RAGS = '#4f5a52';
  const SHIRT = '#7a6a55';
  dress(doc, mesh, body, skin, (joint, x, y, z) => {
    // Torn trousers: one leg longer than the other.
    if (/^(pelvis|thigh)/.test(joint) || (/^calf/.test(joint) && y > (x > 0 ? 0.42 : 0.24))) return { color: RAGS, grow: 0.006 };
    // What is left of a shirt: one shoulder and part of the back.
    if (/^(spine_02|spine_03|clavicle_l|upperarm_l)/.test(joint) && (x > 0.02 || z < -0.02) && hash(Math.round(x * 9), Math.round(y * 9), 3) > 0.2) {
      return { color: SHIRT, grow: 0.008 };
    }
    return { color: null, grow: 0 };
  });
  for (const mat of root.listMaterials()) {
    if (/Superhero/i.test(mat.getName())) mat.setName('skin');
    if (/Eyes/i.test(mat.getName())) mat.setName('eyes').setBaseColorTexture(null).setBaseColorFactor([0.9, 0.85, 0.5, 1]);
  }
  await finish(doc, 'zombie.glb');
}

// ---------------------------------------------------------------- animations

async function buildAnims() {
  let target = null;
  for (const [file, wanted] of Object.entries(CLIPS)) {
    const doc = await io.read(`${SRC}/${file}`);
    for (const anim of doc.getRoot().listAnimations()) {
      if (!wanted.includes(anim.getName())) {
        for (const sampler of anim.listSamplers()) sampler.dispose();
        for (const ch of anim.listChannels()) ch.dispose();
        anim.dispose();
        continue;
      }
      for (const ch of anim.listChannels()) {
        const p = ch.getTargetPath();
        const bone = ch.getTargetNode()?.getName();
        // Bones only rotate; the pelvis also moves. Dropping the rest lets the clips fit other proportions.
        if (p === 'rotation' || (p === 'translation' && bone === 'pelvis')) continue;
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
    for (const node of doc.getRoot().listNodes()) {
      if (node.getMesh()) node.setMesh(null).setSkin(null);
    }
    if (!target) {
      target = doc;
      continue;
    }
    const own = new Set(target.getRoot().listNodes());
    const byName = new Map([...own].map((n) => [n.getName(), n]));
    mergeDocuments(target, doc);
    for (const anim of target.getRoot().listAnimations()) {
      for (const ch of anim.listChannels()) {
        const node = ch.getTargetNode();
        if (node && !own.has(node)) ch.setTargetNode(byName.get(node.getName()));
      }
    }
    for (const node of target.getRoot().listNodes()) if (!own.has(node)) node.dispose();
    for (const scene of target.getRoot().listScenes().slice(1)) scene.dispose();
  }
  for (const skin of target.getRoot().listSkins()) skin.dispose();
  for (const mat of target.getRoot().listMaterials()) mat.dispose();
  await target.transform(resample({ tolerance: 0.0005 }));
  await finish(target, 'anims.glb');
}

await buildZombie();
await buildAnims();
