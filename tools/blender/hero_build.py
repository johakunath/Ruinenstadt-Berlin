# Hero mesh build (H1, docs/tasks/h1-hero.md). Run by tools/build-hero.mjs:
#
#   blender -b --factory-startup --python tools/blender/hero_build.py -- <source.gltf> <work dir>
#
# Step 1 (pipeline proof): imports the source body and exports its meshes unchanged in the work
# format of hero_lib.export_meshes. Later steps build the clothing here. Saves <work dir>/hero.blend
# (not committed) for looking at the result.
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ in tools/blender
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import hero_lib  # noqa: E402

source, work = sys.argv[sys.argv.index('--') + 1:][:2]

hero_lib.reset()
armature, meshes = hero_lib.import_gltf(source)
hero_lib.export_meshes(meshes, armature, work)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(work, 'hero.blend')))
print('hero_build: done')
