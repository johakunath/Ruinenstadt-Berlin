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
import { SRC, decay, dress, finish, readGltf, slimMaterials, stripAttributes } from './character-lib.mjs';

const SHIRT = '#8c8476';
const TROUSERS = '#55565c';
const BOOTS = '#2e2824';

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
  await slimMaterials(doc, 512, (img, size) => decay(img.modulate({ saturation: 0.6, brightness: 1.35 }), size));
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
