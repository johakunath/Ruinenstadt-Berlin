# Dev tool: renders a character GLB headless for look checks (H1, docs/tasks/h1-hero.md).
# Writes <prefix>body.png (full body, three-quarter front) and <prefix>face.png, prints the
# triangle and bone counts.
#
#   blender -b --python tools/blender/render_glb.py -- assets/characters/hero.glb docs/proof/h1-hero/now-
#
# Blender is not on PATH on Johannes' PC:
#   "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe"
import math
import os
import sys

import bpy
from mathutils import Vector

src, prefix = (os.path.abspath(p) for p in sys.argv[sys.argv.index('--') + 1:][:2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

tris = 0
for obj in scene.objects:
    if obj.type == 'MESH':
        obj.data.calc_loop_triangles()
        tris += len(obj.data.loop_triangles)
bones = sum(len(o.data.bones) for o in scene.objects if o.type == 'ARMATURE')
print(f'RESULT triangles={tris} bones={bones}')

# The engine id changed between versions (4.2 to 4.5: BLENDER_EEVEE_NEXT).
for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass

world = bpy.data.worlds.new('world')
world.use_nodes = True
background = world.node_tree.nodes['Background']
background.inputs[0].default_value = (0.12, 0.15, 0.17, 1)
background.inputs[1].default_value = 1.2
scene.world = world

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
scene.collection.objects.link(sun)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.lens = 70
scene.collection.objects.link(cam)
scene.camera = cam


def shot(position, target, name, width, height):
    cam.location = Vector(position)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.filepath = prefix + name
    bpy.ops.render.render(write_still=True)


# glTF +Z (the hero's front) is -Y in Blender.
shot((1.6, -5.2, 1.25), (0, 0, 0.92), 'body.png', 520, 760)
shot((0.25, -1.25, 1.66), (0, 0, 1.6), 'face.png', 520, 520)
