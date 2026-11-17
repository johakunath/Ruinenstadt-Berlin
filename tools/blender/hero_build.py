# Hero mesh build (H1, docs/tasks/h1-hero.md). Run by tools/build-hero.mjs:
#
#   blender -b --factory-startup --python tools/blender/hero_build.py -- <source.gltf> <work dir>
#
# Imports the source body, exports its meshes unchanged (build-hero.mjs checks they did not move)
# and builds the clothing pieces (hero_clothes.py) in the work format of hero_lib.export_meshes.
# Saves <work dir>/hero.blend (not committed) for looking at the result.
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ in tools/blender
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import hero_clothes  # noqa: E402
import hero_lib  # noqa: E402

source, work = sys.argv[sys.argv.index('--') + 1:][:2]

hero_lib.reset()
armature, meshes = hero_lib.import_gltf(source)
body = next(m for m in meshes if m.name == 'Superhero_Female')
pieces = hero_clothes.build(armature, body)
hero_lib.export_meshes(meshes + pieces, armature, work)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(work, 'hero.blend')))
print('hero_build: done')
