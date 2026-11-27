"""Bakes a textured high-poly prop onto a fresh low-poly copy (docs/local-ai-assets.md W6).

Decimating a Pixal3D mesh with its texture breaks the texture into facets below ~6,000 triangles, so the low
mesh gets its own UVs and the colour is baked from the high mesh (Cycles, selected to active).

    blender -b --python tools/blender/bake_low.py -- --in high.glb --out low.glb --tris 2000 --tex 512
        [--tint ref.png] [--remesh 0.03]   per-channel mean of the baked texture moved to the reference picture's object pixels
                           (Pixal3D drifts greyer; the reference is the FLUX picture on black)
        [--low low.glb]    bake onto this ready low mesh instead of decimating a copy (an open Pixal3D surface can stall
                           the decimate far above a small target: `tools/pickup-models.mjs low` simplifies it with meshoptimizer)

Run `tools/comfy/prepare_toy_model.py --tris 60000` first: it merges, sizes and places the origin.
"""
import argparse
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--tris", type=int, default=2000)
ap.add_argument("--tex", type=int, default=512)
ap.add_argument("--tint", default="")
ap.add_argument("--remesh", type=float, default=0.0, help="voxel size in m: fuse loose pieces (rubble) before decimating")
ap.add_argument("--low", default="", help="a ready low mesh (GLB) to bake onto; no decimate")
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Low copy: decimate (or the given low mesh), own UVs, one new material with an empty image to bake into.
if a.low:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=a.low)
    low = next(o for o in bpy.context.scene.objects if o not in before and o.type == "MESH")
    low.name = "low"
    bpy.context.view_layer.objects.active = low
    for o in bpy.context.scene.objects:
        o.select_set(o == low)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
else:
    low = high.copy()
    low.data = high.data.copy()
    low.name = "low"
    bpy.context.scene.collection.objects.link(low)
    tris = sum(len(p.vertices) - 2 for p in high.data.polygons)
    bpy.context.view_layer.objects.active = low
    for o in bpy.context.scene.objects:
        o.select_set(o == low)
    # A glTF import splits vertices at every UV seam; merge them first, or the decimate tears the mesh into shards.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.002)
    bpy.ops.object.mode_set(mode="OBJECT")
    if a.remesh > 0:
        # Many loose pieces (a rubble heap) stop the decimate far above the target: fuse them into one surface first.
        rem = low.modifiers.new("Remesh", "REMESH")
        rem.mode = "VOXEL"
        rem.voxel_size = a.remesh
        bpy.ops.object.modifier_apply(modifier=rem.name)
        tris = sum(len(p.vertices) - 2 for p in low.data.polygons)
    dec = low.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = min(1.0, a.tris / max(1, tris))
    bpy.ops.object.modifier_apply(modifier=dec.name)
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.uv_layers.new(name="UVMap")
for o in bpy.context.scene.objects:
    o.select_set(o == low)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.shade_smooth()

# A DIFFUSE colour bake of a metallic surface is black: Pixal3D sometimes paints metallic near 1 (the Spreehexe, H4),
# so the high mesh is baked as a plain dielectric.
for slot in high.material_slots:
    m = slot.material
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                for l in list(n.inputs["Metallic"].links):
                    m.node_tree.links.remove(l)
                n.inputs["Metallic"].default_value = 0.0

img = bpy.data.images.new("baked", a.tex, a.tex, alpha=False)
mat = bpy.data.materials.new("baked")
mat.use_nodes = True
nodes = mat.node_tree.nodes
tex_node = nodes.new("ShaderNodeTexImage")
tex_node.image = img
mat.node_tree.links.new(tex_node.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
low.data.materials.clear()
low.data.materials.append(mat)
nodes.active = tex_node

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 4
scene.cycles.device = "CPU"
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = 0.03
scene.render.bake.margin = 4
for o in scene.objects:
    o.select_set(o in (high, low))
bpy.context.view_layer.objects.active = low
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})

px = np.array(img.pixels[:]).reshape(-1, 4)
if a.tint:
    ref = bpy.data.images.load(a.tint)
    r = np.array(ref.pixels[:]).reshape(-1, 4)[:, :3]
    r = r[r.max(axis=1) > 0.06]  # object pixels; the background is black
    mask = px[:, :3].max(axis=1) > 0.01  # baked texels (margin and gaps stay black)
    gain = r.mean(axis=0) / np.maximum(px[mask, :3].mean(axis=0), 1e-4)
    px[:, :3] = np.clip(px[:, :3] * gain, 0, 1)
    img.pixels[:] = px.ravel()
    print("BAKE TINT gain", np.round(gain, 2))
img.filepath_raw = a.out.replace(".glb", "-tex.png")
img.file_format = "PNG"
img.save()

bpy.data.objects.remove(high)
low.select_set(True)
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", use_selection=True, export_image_format="JPEG")
print("BAKE OK", a.out, "triangles", sum(len(p.vertices) - 2 for p in low.data.polygons))
