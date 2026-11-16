// Builds assets/characters/raptor.glb and rex.glb from the Quaternius "Animated Dinosaur Pack"
// (CC0, FBX). Not committed: unpack the pack so that assets-src/dinos/Trex.fbx and
// assets-src/dinos/Velociraptor.fbx exist (https://quaternius.itch.io/animated-lowpoly-dinosaurs),
// then `node tools/build-creatures.mjs`. See assets/LICENSES.md.
//
// The pack's flat colors become one vertex-colored material painted toward the Köpenick board's
// skeletal zombie dinosaurs: rotten hide, a bone-pale underside, rib stripes and open wounds.
// Eyes are a material of their own so the game can make them glow. Sizes are baked in meters.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample, weld } from '@gltf-transform/functions';
import {
  Box3, BufferAttribute, BufferGeometry, Color, Group, MeshStandardMaterial, QuaternionKeyframeTrack, SkinnedMesh, VectorKeyframeTrack,
} from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// The exporter reads its buffers through FileReader, which Node does not have.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onloadend?.(); }); }
};
globalThis.window ??= globalThis;
globalThis.document ??= { createElementNS: () => ({}) };

const SRC = process.argv[2] ?? 'assets-src/dinos';
const OUT = 'assets/characters';

const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * @param {string} file FBX name
 * @param {string} out GLB name
 * @param {number} length nose-to-tail length in meters
 * @param {{hide: number, dark: number, belly: number}} pal
 */
async function build(file, out, length, pal) {
  const data = fs.readFileSync(`${SRC}/${file}`);
  const root = new FBXLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  /** @type {SkinnedMesh} */
  let mesh;
  root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  const geo = mesh.geometry;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  // Paint in bind space (where the bones are), not in the raw mesh space.
  const pos = geo.getAttribute('position').clone().applyMatrix4(mesh.bindMatrix);
  const bb = new Box3().setFromBufferAttribute(pos);
  const size = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
  const long = Math.max(size.x, size.y, size.z);

  // Which source material a vertex belongs to (the FBX is unindexed, groups are vertex ranges).
  const matOf = new Uint8Array(pos.count);
  for (const g of geo.groups) for (let i = g.start; i < g.start + g.count; i++) matOf[i] = g.materialIndex;
  const names = mats.map((m) => m.name);

  // Body axes in mesh space from the bind pose: nose direction, up, and the side axis.
  const bindPos = (name) => {
    const i = mesh.skeleton.bones.findIndex((b) => b.name === name);
    const m = mesh.skeleton.boneInverses[i].clone().invert();
    return [m.elements[12], m.elements[13], m.elements[14]];
  };
  const head = bindPos('Head'), tail = bindPos('Tail5'), foot = bindPos('BackFootL');
  const axes = ['x', 'y', 'z'];
  const L = [0, 1, 2].reduce((a, b) => (Math.abs(head[b] - tail[b]) > Math.abs(head[a] - tail[a]) ? b : a));
  const U = [0, 1, 2].filter((a) => a !== L).reduce((a, b) => (Math.abs(head[b] - foot[b]) > Math.abs(head[a] - foot[a]) ? b : a));
  const W = [0, 1, 2].find((a) => a !== L && a !== U);
  const at = (i, a) => (a === 0 ? pos.getX(i) : a === 1 ? pos.getY(i) : pos.getZ(i));
  const lo = (a) => bb.min[axes[a]], ext = (a) => size[axes[a]];
  const flipL = head[L] < tail[L], flipU = head[U] < foot[U];
  const coord = (i) => {
    let u = (at(i, L) - lo(L)) / ext(L), v = (at(i, U) - lo(U)) / ext(U);
    if (flipL) u = 1 - u;
    if (flipU) v = 1 - v;
    return { u, v, w: Math.abs(at(i, W) - (lo(W) + ext(W) / 2)) / (ext(W) / 2) };
  };
  const isEye = (i) => { const q = coord(i); return names[matOf[i]] === 'Black' && q.u > 0.8 && q.v > 0.6; };

  const hide = new Color(pal.hide), dark = new Color(pal.dark), belly = new Color(pal.belly);
  const bone = new Color(0xd9d2b4), wound = new Color(0x7a1f18), claw = new Color(0x1c1a17), mouth = new Color(0x5a1512);
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Normalized body coordinates: u along the spine (0 tail tip, 1 nose), v height, w side.
    const { u, v, w } = coord(i);
    const n = hash(Math.round(x / long * 40), Math.round(y / long * 40), Math.round(z / long * 40));
    const name = names[matOf[i]];
    if (name === 'Black') c.copy(claw);
    else if (name === 'Red') c.copy(mouth);
    else {
      // Dark back, pale underside, blotchy rot.
      c.copy(mix(belly, hide, smooth(0.25, 0.6, v + (n - 0.5) * 0.25)));
      c.lerp(dark, smooth(0.62, 0.95, v) * 0.7 + (n > 0.7 ? 0.25 : 0));
      if (name === 'LightYellow' || name === 'LightBrown' || name === 'LightGreen') c.lerp(belly, 0.35);
      // Exposed ribs on the flanks: pale bars across the torso.
      const torso = smooth(0.42, 0.5, u) * (1 - smooth(0.66, 0.74, u)) * smooth(0.3, 0.45, v) * (1 - smooth(0.7, 0.85, v)) * smooth(0.35, 0.6, w);
      const bar = Math.abs(Math.sin(u * 95)) > 0.55 ? 1 : 0;
      c.lerp(bar ? bone : wound, torso * (bar ? 0.9 : 0.75));
      // Torn hide: wounds at hash spots, bone at the skull ridge and the tail tip.
      if (n > 0.93) c.lerp(wound, 0.8);
      c.lerp(bone, smooth(0.9, 1, u) * smooth(0.55, 0.75, v) * 0.55 + (1 - smooth(0, 0.07, u)) * 0.7);
    }
    c.offsetHSL(0, 0, (n - 0.5) * 0.05);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  // Two primitives: body (vertex colors) and eyes.
  const body = [], eyes = [];
  for (let i = 0; i < pos.count; i += 3) (isEye(i) && isEye(i + 1) && isEye(i + 2) ? eyes : body).push(i, i + 1, i + 2);
  const g2 = new BufferGeometry();
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) g2.setAttribute(k, geo.getAttribute(k));
  g2.setAttribute('color', new BufferAttribute(colors, 3));
  g2.setIndex([...body, ...eyes]);
  g2.addGroup(0, body.length, 0);
  if (eyes.length) g2.addGroup(body.length, eyes.length, 1);
  const skin = new MeshStandardMaterial({ name: 'skin', vertexColors: true, roughness: 0.85, metalness: 0 });
  const eye = new MeshStandardMaterial({ name: 'eyes', color: 0xe6d880, roughness: 0.4 });
  const sm = new SkinnedMesh(g2, eyes.length ? [skin, eye] : [skin]);
  sm.name = 'body';
  sm.bind(mesh.skeleton, mesh.bindMatrix);

  // Scene in meters: the armature keeps its transform, a parent scales everything.
  const k = length / long;
  const holder = new Group();
  holder.name = 'creature';
  holder.scale.setScalar(k);
  mesh.parent.add(sm);
  mesh.parent.remove(mesh);
  holder.add(...root.children);

  // Clips: short names, no scale tracks, bone tracks only.
  const clips = root.animations.map((a) => {
    const clip = a.clone();
    clip.name = a.name.replace(/^.*_/, '');
    clip.tracks = clip.tracks.filter((t) => t instanceof QuaternionKeyframeTrack || (t instanceof VectorKeyframeTrack && t.name.endsWith('.position')));
    return clip;
  });

  const raw = await new GLTFExporter().parseAsync(holder, { binary: true, animations: clips, onlyVisible: false });
  // Smaller file: shared vertices, no redundant keyframes.
  const io = new NodeIO();
  const doc = await io.readBinary(new Uint8Array(raw));
  await doc.transform(weld(), resample(), dedup(), prune());
  const glb = await io.writeBinary(doc);
  fs.writeFileSync(`${OUT}/${out}`, Buffer.from(glb));
  console.log(`${out}: ${(glb.byteLength / 1024).toFixed(0)} KiB, ${pos.count / 3} triangles (${eyes.length / 3} eye), scale ${k.toFixed(5)}, long ${axes[L]}${flipL ? '-' : '+'} up ${axes[U]}${flipU ? '-' : '+'}, m ${(ext(W) * k).toFixed(2)} wide, ${(ext(U) * k).toFixed(2)} high, clips ${clips.map((q) => `${q.name} ${q.duration.toFixed(2)}`).join(', ')}`);
}

await build('Velociraptor.fbx', 'raptor.glb', 2.7, { hide: 0x5c6a44, dark: 0x2e3a2a, belly: 0xa39a78 });
await build('Trex.fbx', 'rex.glb', 7.2, { hide: 0x56603c, dark: 0x27301f, belly: 0x9c9070 });
