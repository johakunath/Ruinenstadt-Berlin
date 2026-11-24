// H3: human bases for the humanoid bosses, built like zombie.glb in tools/build-assets.mjs but without the zombie
// repaint (`npm run assets:human`). Needs assets-src/ (tools/fetch-assets.sh). human1.glb ships (Johannes'
// pick B, the male humanoid bosses); human2.glb ships for the female humanoid bosses (Spreehexe, Wurzel-Mutter; base C).
//
//   human1.glb  Superhero_Male body, simplified, natural skin, a plain shirt, trousers and boots.
//   human2.glb  Superhero_Female body (the hero's body), the same way (female bosses).
//
// Shown with `node tools/enemy-sheet.mjs out.png "kind=feldwebel&n=1&base=human1"`.
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SRC, dress, finish, readGltf, slimMaterials, stripAttributes } from './character-lib.mjs';

const SHIRT = '#8c8476';
const TROUSERS = '#55565c';
const BOOTS = '#2e2824';

// T8 (local FLUX.2 klein): decayed undead skin (bruises, veins, grime; busts X01, X04, X05, X10). FLUX moves the
// UV islands when it repaints the atlas itself, so a seamless decay tile is laid over it instead: each pixel is
// multiplied by the tile's colour relative to its mean, only on skin (the dark briefs islands stay).
const DECAY = fileURLToPath(new URL('../assets/textures/enemies/decay.webp', import.meta.url));
const DECAY_REPEAT = 2; // tiles across the atlas: veins about as thick as a finger on the body
const DECAY_STRENGTH = 0.6;

async function decay(img, size) {
  const base = await img.modulate({ saturation: 0.6, brightness: 1.35 }).removeAlpha().raw().toBuffer();
  const t = Math.round(size / DECAY_REPEAT);
  const tile = await sharp(DECAY).resize(t, t).removeAlpha().raw().toBuffer();
  const mean = [0, 1, 2].map((c) => { let s = 0; for (let i = c; i < tile.length; i += 3) s += tile[i]; return s / (tile.length / 3); });
  const out = Buffer.alloc(base.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3, j = ((y % t) * t + (x % t)) * 3;
    const lum = 0.3 * base[i] + 0.59 * base[i + 1] + 0.11 * base[i + 2];
    const skin = Math.min(1, Math.max(0, (lum - 95) / 50)) * DECAY_STRENGTH;
    for (let c = 0; c < 3; c++) {
      const ratio = Math.min(1.35, Math.max(0.35, tile[j + c] / mean[c]));
      out[i + c] = Math.min(255, Math.round(base[i + c] * (1 + (ratio - 1) * skin)));
    }
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } });
}

async function buildHuman(file, bodyName, out) {
  const doc = await readGltf(`${SRC}/body/${file}`);
  stripAttributes(doc);
  const root = doc.getRoot();
  // As the zombie: no eyebrows (the fitted gear reads the first body mesh); the eyes glow in the game.
  for (const node of root.listNodes()) if (node.getName() === 'Eyebrows') node.dispose();
  await MeshoptSimplifier.ready;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.36, error: 0.004 }));
  // Natural skin, lighter and a little muted like the zombie's base, since the game multiplies it by each boss's
  // tint (TINTS); then the T8 decay layer.
  await slimMaterials(doc, 512, decay);
  const skin = root.listSkins()[0];
  const mesh = root.listNodes().find((n) => n.getName() === bodyName).getMesh();
  const body = mesh.listPrimitives()[0];
  dress(doc, mesh, body, skin, (joint) => {
    if (/^(foot|ball)/.test(joint)) return { color: BOOTS, grow: 0.01 };
    if (/^(pelvis|thigh|calf)/.test(joint)) return { color: TROUSERS, grow: 0.006 };
    if (/^(spine|clavicle|upperarm|lowerarm)/.test(joint)) return { color: SHIRT, grow: 0.007 };
    return { color: null, grow: 0 };
  });
  for (const mat of root.listMaterials()) {
    if (/Superhero/i.test(mat.getName())) mat.setName('skin');
    if (/Eyes/i.test(mat.getName())) mat.setName('eyes').setBaseColorTexture(null).setBaseColorFactor([0.9, 0.85, 0.5, 1]);
  }
  await finish(doc, out);
}

await buildHuman('Superhero_Male_FullBody.gltf', 'SuperHero_Male', 'human1.glb');
await buildHuman('Superhero_Female_FullBody.gltf', 'Superhero_Female', 'human2.glb');
