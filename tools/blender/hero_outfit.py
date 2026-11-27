"""W10: a Pixal3D outfit (armor, coat) as a skinned piece on the hero skeleton (docs/local-ai-assets.md W10).

The picture behind the mesh was painted over the hero's rest pose (tools/blender/front_ref.py on hero.glb, FLUX
img2img at about 0.82), so the mesh stands in that T-pose. Here it is fitted onto the hero (per-axis scale from the
extents of both, like boss_body.py), cut to what the armor slot owns (below the neck, inside the wrists, above the
boot line: head, hands and footwear stay the hero's and the other slots'), weighted from the hero body and the coat
(so a skirt swings on the coat bones) and exported with the hero armature.

    blender -b --python tools/blender/hero_outfit.py -- --hero assets/characters/hero.glb --mesh outfit-mid.glb
        --out assets/gear/outfit-ritter.glb [--name ritter] [--tris 6000] [--boot 0.30] [--gain 1.0]
"""
import argparse
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--hero", required=True)
ap.add_argument("--mesh", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--name", default="outfit")
ap.add_argument("--tris", type=int, default=6000)
ap.add_argument("--boot", type=float, default=0.30, help="cut height (m) above the floor: below it the footwear slot shows")
ap.add_argument("--neck", type=float, default=0.05, help="cut this far above the neck bone (m): a collar may stand up a little")
ap.add_argument("--gain", type=float, default=1.0)
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.hero)
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == "ARMATURE")
meshes = {o.name: o for o in scene.objects if o.type == "MESH"}
bone = lambda n: arm.matrix_world @ arm.data.bones[n].head_local  # noqa: E731

# Weight source: the bare body plus the coat (its skirt carries the coat bones), joined into one copy.
src_names = [n for n in meshes if n.startswith("body_")] + ["a_mantel"]
copies = []
for n in src_names:
    c = meshes[n].copy()
    c.data = meshes[n].data.copy()
    scene.collection.objects.link(c)
    copies.append(c)
bpy.ops.object.select_all(action="DESELECT")
for c in copies:
    c.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.join()
source = bpy.context.view_layer.objects.active
source.modifiers.clear()

# Extents of the hero in its rest pose: head, hair, body and hands.
dg = bpy.context.evaluated_depsgraph_get()


def extents(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


blo, bhi = extents([meshes[n] for n in meshes if n.startswith("body_") or n == "hair"])

before = set(scene.objects)
# Merge the vertices the importer splits at UV seams, or the decimation tears the seams open (787 islands in the first try).
bpy.ops.import_scene.gltf(filepath=a.mesh, merge_vertices=True)
new = [o for o in scene.objects if o not in before and o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in new:
    o.select_set(True)
bpy.context.view_layer.objects.active = new[0]
if len(new) > 1:
    bpy.ops.object.join()
out = bpy.context.view_layer.objects.active
out.name = a.name
out.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

mlo, mhi = extents([out])
sx = (bhi.x - blo.x) / (mhi.x - mlo.x)
sz = (bhi.z - blo.z) / (mhi.z - mlo.z)
mc, bc = (mlo + mhi) / 2, (blo + bhi) / 2
for v in out.data.vertices:
    p = v.co - Vector((mc.x, mc.y, mlo.z))
    v.co = Vector((p.x * sx + bc.x, p.y * sz + bc.y, p.z * sz + blo.z))
out.data.update()
print("OUTFIT fit sx %.3f sz %.3f" % (sx, sz))

# Cut: above the neck, outside the wrists, below the boot line.
neck_z = bone("neck_01").z + a.neck
wrist_x = abs(bone("hand_l").x) - 0.015
bm = bmesh.new()
bm.from_mesh(out.data)
gone = [v for v in bm.verts if v.co.z > neck_z or abs(v.co.x) > wrist_x or v.co.z < a.boot]
bmesh.ops.delete(bm, geom=gone, context="VERTS")
bm.to_mesh(out.data)
bm.free()
out.data.update()
print("OUTFIT cut neck %.2f wrist %.2f boot %.2f" % (neck_z, wrist_x, a.boot))

# Fewer triangles (the texture stays: collapse keeps the UVs).
out.data.calc_loop_triangles()
tris = len(out.data.loop_triangles)
if tris > a.tris:
    dec = out.modifiers.new("decimate", "DECIMATE")
    dec.ratio = a.tris / tris
    bpy.context.view_layer.objects.active = out
    bpy.ops.object.modifier_apply(modifier=dec.name)

# Weights of the body and coat at the nearest surface point; at most four bones, normalised.
for g in source.vertex_groups:
    out.vertex_groups.new(name=g.name)
mod = out.modifiers.new("weights", "DATA_TRANSFER")
mod.object = source
mod.use_vert_data = True
mod.data_types_verts = {"VGROUP_WEIGHTS"}
mod.vert_mapping = "POLYINTERP_NEAREST"
mod.layers_vgroup_select_src = "ALL"
mod.layers_vgroup_select_dst = "NAME"
bpy.context.view_layer.objects.active = out
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
used = {g.group for v in out.data.vertices for g in v.groups}
for g in [g for g in out.vertex_groups if g.index not in used]:
    out.vertex_groups.remove(g)

for slot in out.material_slots:
    if slot.material:
        slot.material.name = a.name
        if a.gain != 1.0 and slot.material.node_tree:
            import numpy as np
            for n in slot.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    px = np.array(n.image.pixels[:])
                    for c in range(3):
                        px[c::4] = np.minimum(1, px[c::4] * a.gain)
                    n.image.pixels[:] = px.tolist()
                    n.image.update()

out.parent = arm
am = out.modifiers.new("Armature", "ARMATURE")
am.object = arm
for o in list(scene.objects):
    if o not in (arm, out):
        bpy.data.objects.remove(o, do_unlink=True)
for o in scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", use_selection=True, export_skins=True,
                          export_animations=False, export_yup=True)
out.data.calc_loop_triangles()
print("OUTFIT OK %s  %d triangles, %d bone groups" % (a.out, len(out.data.loop_triangles), len(out.vertex_groups)))
