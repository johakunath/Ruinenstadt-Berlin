#!/usr/bin/env node
// Drives the local ComfyUI (docs/local-ai-assets.md) with FLUX.2 klein 4B: text to image, or an edit with
// reference images and an optional start image (img2img). Start ComfyUI first (`ComfyUI starten.bat`).
//
//   node tools/comfy.mjs --prompt "..." [--ref a.png]... [--init start.png --denoise 0.6]
//                        [--size 1024] [--count 8] [--batch 1] [--seed 1] [--steps 4] [--out dir] [--name stucco]
//
// --ref     reference image(s): style or content the model looks at (FLUX.2 ReferenceLatent, as in the
//           ComfyUI template `image_flux2_klein_image_edit_4b_distilled`)
// --batch   images per queued prompt (default 1). Measured 2026-11-22: only ~10 % faster than
//           one prompt per image, and with --init the batch images barely differ. Files are numbered from --seed
// --cut     a.png b.png ...: only cut out existing picks (writes <name>-cut.png next to each), no generation
// --cutout  1: cut the object out with BiRefNet (PNG with alpha), for icons and props
// --init    start image; the sampler begins from it with --denoise (0 keeps it, 1 ignores it). Use the
//           code placeholder here so a pattern keeps its layout and scale
// Writes <out>/<name>-<seed>.png and prints the paths. Plain Node 24 (fetch, FormData), no dependencies.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

const HOST = process.env.COMFY_URL ?? 'http://127.0.0.1:8188';
const MODEL = { unet: 'flux-2-klein-4b.safetensors', clip: 'qwen_3_4b.safetensors', vae: 'flux2-vae.safetensors' };

function args(argv) {
  const o = { ref: [], size: 1024, count: 1, batch: 1, seed: 1, steps: 4, denoise: 1, out: 'out/comfy', name: 'img' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, ''), v = argv[++i];
    if (k === 'ref') o.ref.push(v);
    else o[k] = ['size', 'count', 'batch', 'seed', 'steps', 'denoise', 'cutout'].includes(k) ? Number(v) : v;
  }
  if (o.cut) {
    // --cut a.png b.png ...: the files up to the next option.
    const rest = argv.slice(argv.indexOf(o.cut) + 1), end = rest.findIndex(a => a.startsWith('--'));
    o.cut = [o.cut, ...(end < 0 ? rest : rest.slice(0, end))];
    return o;
  }
  if (!o.prompt) throw new Error('--prompt is required');
  return o;
}

async function upload(path) {
  const form = new FormData();
  form.append('image', new Blob([await readFile(path)]), basename(path));
  form.append('overwrite', 'true');
  const r = await fetch(`${HOST}/upload/image`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`upload ${path}: ${r.status}`);
  return (await r.json()).name;
}

/** Cut-out only: BiRefNet on an existing image, PNG with alpha. */
function cutGraph(name) {
  return {
    load: { class_type: 'LoadImage', inputs: { image: name } },
    bgModel: { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: 'birefnet.safetensors' } },
    bgMask: { class_type: 'RemoveBackground', inputs: { bg_removal_model: ['bgModel', 0], image: ['load', 0] } },
    bgInv: { class_type: 'InvertMask', inputs: { mask: ['bgMask', 0] } },
    bgJoin: { class_type: 'JoinImageWithAlpha', inputs: { image: ['load', 0], alpha: ['bgInv', 0] } },
    save: { class_type: 'SaveImage', inputs: { images: ['bgJoin', 0], filename_prefix: 'ruinenstadt-cut' } },
  };
}

/** API-format graph. Node ids are strings; an input [id, slot] links to another node's output. */
export function graph({ prompt, refs, init, size, seed, steps, denoise, cutout, batch = 1 }) {
  const g = {
    unet: { class_type: 'UNETLoader', inputs: { unet_name: MODEL.unet, weight_dtype: 'default' } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: MODEL.clip, type: 'flux2', device: 'default' } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: MODEL.vae } },
    pos0: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['clip', 0] } },
    neg0: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['pos0', 0] } },
    sched: { class_type: 'Flux2Scheduler', inputs: { steps, width: size, height: size } },
    sampler: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    noise: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
  };
  let pos = 'pos0', neg = 'neg0';
  refs.forEach((name, i) => {
    g[`load${i}`] = { class_type: 'LoadImage', inputs: { image: name } };
    g[`scale${i}`] = { class_type: 'ImageScaleToTotalPixels', inputs: { image: [`load${i}`, 0], upscale_method: 'lanczos', megapixels: 1, resolution_steps: 1 } };
    g[`enc${i}`] = { class_type: 'VAEEncode', inputs: { pixels: [`scale${i}`, 0], vae: ['vae', 0] } };
    g[`pos${i + 1}`] = { class_type: 'ReferenceLatent', inputs: { conditioning: [pos, 0], latent: [`enc${i}`, 0] } };
    g[`neg${i + 1}`] = { class_type: 'ReferenceLatent', inputs: { conditioning: [neg, 0], latent: [`enc${i}`, 0] } };
    pos = `pos${i + 1}`; neg = `neg${i + 1}`;
  });
  g.guider = { class_type: 'CFGGuider', inputs: { model: ['unet', 0], positive: [pos, 0], negative: [neg, 0], cfg: 1 } };
  let sigmas = ['sched', 0], latent;
  if (init) {
    g.initLoad = { class_type: 'LoadImage', inputs: { image: init } };
    g.initScale = { class_type: 'ImageScale', inputs: { image: ['initLoad', 0], upscale_method: 'lanczos', width: size, height: size, crop: 'center' } };
    g.initEnc = { class_type: 'VAEEncode', inputs: { pixels: ['initScale', 0], vae: ['vae', 0] } };
    g.split = { class_type: 'SplitSigmasDenoise', inputs: { sigmas: ['sched', 0], denoise } };
    sigmas = ['split', 1];
    latent = ['initEnc', 0];
    if (batch > 1) { g.repeat = { class_type: 'RepeatLatentBatch', inputs: { samples: latent, amount: batch } }; latent = ['repeat', 0]; }
  } else {
    g.empty = { class_type: 'EmptyFlux2LatentImage', inputs: { width: size, height: size, batch_size: batch } };
    latent = ['empty', 0];
  }
  g.run = { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['noise', 0], guider: ['guider', 0], sampler: ['sampler', 0], sigmas, latent_image: latent } };
  g.decode = { class_type: 'VAEDecode', inputs: { samples: ['run', 0], vae: ['vae', 0] } };
  let image = ['decode', 0];
  if (cutout) {
    // BiRefNet cut-out: the mask marks the object; JoinImageWithAlpha takes 1 - mask, so invert it first.
    g.bgModel = { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: 'birefnet.safetensors' } };
    g.bgMask = { class_type: 'RemoveBackground', inputs: { bg_removal_model: ['bgModel', 0], image } };
    g.bgInv = { class_type: 'InvertMask', inputs: { mask: ['bgMask', 0] } };
    g.bgJoin = { class_type: 'JoinImageWithAlpha', inputs: { image, alpha: ['bgInv', 0] } };
    image = ['bgJoin', 0];
  }
  g.save = { class_type: 'SaveImage', inputs: { images: image, filename_prefix: 'ruinenstadt' } };
  return g;
}

async function run(prompt) {
  const r = await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) });
  const body = await r.json();
  if (!r.ok) throw new Error(`queue: ${JSON.stringify(body).slice(0, 800)}`);
  const id = body.prompt_id;
  for (;;) {
    await new Promise(res => setTimeout(res, 250));
    const h = (await (await fetch(`${HOST}/history/${id}`)).json())[id];
    if (!h) continue;
    if (h.status?.status_str === 'error') throw new Error(`run: ${JSON.stringify(h.status.messages).slice(0, 800)}`);
    const imgs = h.outputs?.save?.images;
    if (imgs?.length) return Promise.all(imgs.map(async img => (await fetch(`${HOST}/view?${new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type })}`)).arrayBuffer()));
  }
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.cut) {
    for (const f of o.cut) {
      const [png] = await run(cutGraph(await upload(f)));
      const file = f.replace(/.png$/, '-cut.png');
      await writeFile(file, Buffer.from(png));
      console.log(file);
    }
    return;
  }
  const refs = await Promise.all(o.ref.map(upload));
  const init = o.init ? await upload(o.init) : undefined;
  await mkdir(o.out, { recursive: true });
  for (let k = 0; k < o.count; k += o.batch) {
    const seed = o.seed + k, batch = Math.min(o.batch, o.count - k), t = Date.now();
    const pngs = await run(graph({ ...o, refs, init, seed, batch }));
    for (const [i, png] of pngs.entries()) {
      const file = join(o.out, `${o.name}-${seed + i}.png`);
      await writeFile(file, Buffer.from(png));
      console.log(file);
    }
    console.log(`  ${pngs.length} images in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('comfy.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
