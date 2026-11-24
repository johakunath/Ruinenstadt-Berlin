"""Turns a prepared static prop into a resting pose (docs/local-ai-assets.md W6), e.g. a statue that fell over.

    blender -b --python tools/blender/pose_prop.py -- --in prop.glb --out posed.glb [--yaw 0] [--roll 180] [--sink 0]

--yaw   degrees around the up axis first (so the head points along +Z, the game's local forward)
--roll  degrees around the length axis (+Z) after that: 180 = on its back, 90 / -90 = on its side
--sink  metres pushed into the ground afterwards (a fallen figure rests on its bulk, not on one point)
The result stands on the ground (lowest point y = 0) and is centred on x and z. Run before bake_low.py.
"""
import argparse
import math
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--yaw", type=float, default=0.0)
ap.add_argument("--roll", type=float, default=0.0)
ap.add_argument("--sink", type=float, default=0.0)
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Blender is Z-up; glTF +Z (forward) is Blender -Y, glTF up is Blender +Z.
rot = Matrix.Rotation(math.radians(a.roll), 4, Vector((0, -1, 0))) @ Matrix.Rotation(math.radians(a.yaw), 4, "Z")
obj.data.transform(rot)
pts = [v.co for v in obj.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
obj.data.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z - a.sink))))
obj.data.update()

bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", use_selection=False)
size = hi - lo
print("POSE OK %s  %.2f x %.2f x %.2f m (x, length, height)" % (a.out, size.x, size.y, size.z - a.sink))
