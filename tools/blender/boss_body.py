"""H4: turns a baked Pixal3D boss mesh into a skinned body on the enemy skeleton (docs/local-ai-assets.md W8).

The picture behind the mesh was painted over a front view of the base body in its rest pose (T-pose,
tools/blender/front_ref.py), so the mesh stands in that pose. Here it is fitted onto the base body (per-axis scale
from the extents of both), gets the body's skin weights at the nearest surface point (Data Transfer), and is exported
with the base's armature: same bone names and rest pose, so every clip of the base plays on it.

    blender -b --python tools/blender/boss_body.py -- --base assets/characters/human1.glb --mesh low.glb
        --out assets/characters/boss-feldwebel.glb [--name feldwebel] [--gain 1.25]
"""
import argparse
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True)
ap.add_argument("--mesh", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--name", default="boss")
ap.add_argument("--gain", type=float, default=1.0, help="brighten the baked texture (the bake reads darker in the game light)")
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.base)
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == "ARMATURE")
body = max((o for o in scene.objects if o.type == "MESH" and not o.name.startswith("Icosphere") and o.name != "Eyes"),
           key=lambda o: len(o.data.vertices))
dg = bpy.context.evaluated_depsgraph_get()


def extents(obj, evaluated=True):
    o = obj.evaluated_get(dg) if evaluated else obj
    pts = [obj.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


blo, bhi = extents(body)

before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=a.mesh)
new = [o for o in scene.objects if o not in before and o.type == "MESH"]
for o in new:
    o.select_set(True)
bpy.context.view_layer.objects.active = new[0]
if len(new) > 1:
    bpy.ops.object.join()
boss = bpy.context.view_layer.objects.active
boss.name = a.name
boss.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Fit: x (arm span) and z (height) separately to the base's rest pose, depth with the height scale.
mlo, mhi = extents(boss, evaluated=False)
sx = (bhi.x - blo.x) / (mhi.x - mlo.x)
sz = (bhi.z - blo.z) / (mhi.z - mlo.z)
mc, bc = (mlo + mhi) / 2, (blo + bhi) / 2
for v in boss.data.vertices:
    p = v.co - Vector((mc.x, mc.y, mlo.z))
    v.co = Vector((p.x * sx + bc.x, p.y * sz + bc.y, p.z * sz + blo.z))
boss.data.update()
print("BOSS fit sx %.3f sz %.3f  base %.2f x %.2f m" % (sx, sz, bhi.x - blo.x, bhi.z - blo.z))

# Weights of the base body at the nearest surface point; then at most four bones per vertex, normalised.
for g in body.vertex_groups:
    boss.vertex_groups.new(name=g.name)
mod = boss.modifiers.new("weights", "DATA_TRANSFER")
mod.object = body
mod.use_vert_data = True
mod.data_types_verts = {"VGROUP_WEIGHTS"}
mod.vert_mapping = "POLYINTERP_NEAREST"
mod.layers_vgroup_select_src = "ALL"
mod.layers_vgroup_select_dst = "NAME"
bpy.context.view_layer.objects.active = boss
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
empty = [g for g in boss.vertex_groups if not any(g.index in [x.group for x in v.groups] for v in boss.data.vertices)]
for g in empty:
    boss.vertex_groups.remove(g)

# Material named after the boss (the game tints only `skin` and `cloth`), texture brightened by --gain.
for slot in boss.material_slots:
    if slot.material:
        slot.material.name = a.name
        if a.gain != 1.0 and slot.material.node_tree:
            import numpy as np
            for n in slot.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    px = np.array(n.image.pixels[:])
                    px[0::4] = np.minimum(1, px[0::4] * a.gain)
                    px[1::4] = np.minimum(1, px[1::4] * a.gain)
                    px[2::4] = np.minimum(1, px[2::4] * a.gain)
                    n.image.pixels[:] = px.tolist()
                    n.image.update()

boss.parent = arm
am = boss.modifiers.new("Armature", "ARMATURE")
am.object = arm

# Only the armature and the new body go out; clips come from anims.glb in the game.
for o in list(scene.objects):
    if o not in (arm, boss):
        bpy.data.objects.remove(o, do_unlink=True)
for o in scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", use_selection=True, export_skins=True,
                          export_animations=False, export_yup=True)
boss.data.calc_loop_triangles()
print("BOSS OK %s  %d triangles, %d bone groups" % (a.out, len(boss.data.loop_triangles), len(boss.vertex_groups)))
