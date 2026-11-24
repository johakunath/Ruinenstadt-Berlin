"""Orthographic front view of a character GLB in its rest pose (T-pose), on black, evenly lit: the start
picture for FLUX img2img and Pixal3D (H4 boss bodies, docs/local-ai-assets.md). Prints the framing so the
Pixal3D mesh can be fitted back onto the skeleton.

    blender -b --python tools/blender/front_ref.py -- assets/characters/human1.glb out.png [--size 1024] [--side]
"""
import argparse
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("out")
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--side", action="store_true", help="from the character's left instead of the front")
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
scene = bpy.context.scene
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass

# Extent of the posed (evaluated) vertices: a skinned mesh's bound_box does not follow its armature.
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
dg = bpy.context.evaluated_depsgraph_get()
for o in scene.objects:
    if o.type != "MESH":
        continue
    if o.name.startswith("Icosphere"):  # a stray unit sphere in the UBC exports: not drawn, never framed
        o.hide_render = True
        continue
    ev = o.evaluated_get(dg)
    for v in ev.data.vertices:
        w = o.matrix_world @ v.co
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
span = max(hi.x - lo.x, hi.z - lo.z) * 1.08
mid = (lo + hi) / 2

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
scene.world = world
# Even light from the camera side plus a soft fill, so the picture carries no strong shading.
for name, rot, energy in (("key", (1.2, 0, 0.3), 3.0), ("fill", (1.4, 0, -0.6), 1.5)):
    d = bpy.data.lights.new(name, "SUN")
    d.energy = energy
    ob = bpy.data.objects.new(name, d)
    ob.rotation_euler = rot
    scene.collection.objects.link(ob)

cam = bpy.data.cameras.new("cam")
cam.type = "ORTHO"
cam.ortho_scale = span
co = bpy.data.objects.new("cam", cam)
scene.collection.objects.link(co)
if a.side:
    co.location = (mid.x + 10, mid.y, mid.z)
    co.rotation_euler = (1.5708, 0, 1.5708)
else:
    co.location = (mid.x, mid.y - 10, mid.z)
    co.rotation_euler = (1.5708, 0, 0)
scene.camera = co
scene.render.resolution_x = scene.render.resolution_y = a.size
scene.render.filepath = a.out
scene.view_settings.view_transform = "Standard"
bpy.ops.render.render(write_still=True)
print("FRONT_REF span %.4f mid %.4f %.4f %.4f  (Blender: z up, -y front)" % (span, mid.x, mid.y, mid.z))
