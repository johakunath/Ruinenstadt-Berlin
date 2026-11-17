# Shared helpers for the hero build (H1, docs/tasks/h1-hero.md). Runs inside Blender.
#
# Contract: Blender delivers meshes only. The skeleton never leaves Blender, because its glTF
# import and export re-orient bones; tools/build-hero.mjs binds these meshes to the source
# skeleton by joint name (vertex group name = joint name).
#
# Work format written by export_meshes (read by tools/build-hero.mjs):
#   meshes.json  {"blender": "5.3.0", "meshes": [{name, material, groups, count, triangles,
#                 position, normal, uv, joints, weights, indices}]}, every array entry being
#                 {"offset": bytes, "length": elements} into meshes.bin
#   meshes.bin   little-endian: position/normal float32 x3, uv float32 x2, joints uint16 x4
#                (index into `groups`), weights float32 x4 (sum 1), indices uint32, optional
#                color float32 x3 (linear, from a point-domain colour attribute `Col`)
# Space: glTF (meters, +Y up, front +Z), relative to the armature, bind pose.
import json
import os
import struct

import bpy
from mathutils import Matrix

MAX_INFLUENCES = 4


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_gltf(path):
    """Imports a glTF as it is. Returns (armature, mesh objects in file order)."""
    before = set(bpy.data.objects)
    # No bone shape: the importer would otherwise add an icosphere object to the scene.
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path), disable_bone_shape=True, merge_vertices=False)
    new = [o for o in bpy.data.objects if o not in before]
    armature = next((o for o in new if o.type == 'ARMATURE'), None)
    meshes = [o for o in new if o.type == 'MESH']
    return armature, meshes


# Blender is Z-up with front -Y; glTF is Y-up with front +Z: (x, y, z)_gltf = (x, z, -y)_blender.
TO_GLTF = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def _weights(obj, vertex, names):
    pairs = [(names[g.group], g.weight) for g in vertex.groups if g.weight > 0]
    pairs.sort(key=lambda p: -p[1])
    pairs = pairs[:MAX_INFLUENCES]
    total = sum(w for _, w in pairs)
    if total <= 0:
        raise ValueError(f'{obj.name}: vertex {vertex.index} has no weights')
    return [(n, w / total) for n, w in pairs]


def mesh_arrays(obj, armature):
    """Triangles, split vertices (one per distinct normal and UV at a Blender vertex) and the
    top four normalized weights per vertex. A mesh imported without merging keeps its glTF
    vertex order, so the round trip can be compared vertex by vertex."""
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers[0].data if mesh.uv_layers else None
    space = TO_GLTF @ (armature.matrix_world.inverted() if armature else Matrix()) @ obj.matrix_world
    rot = space.to_3x3().normalized()
    normals = mesh.corner_normals
    names = [g.name for g in obj.vertex_groups]
    col = mesh.color_attributes.get('Col')
    if col is not None and col.domain != 'POINT':
        raise ValueError(f'{obj.name}: colour attribute Col must be on points')

    variants = [[] for _ in mesh.vertices]  # per vertex: [(normal, uv, corners)]
    corner_variant = [0] * len(mesh.loops)
    for tri in mesh.loop_triangles:
        for corner in tri.loops:
            v = mesh.loops[corner].vertex_index
            n = normals[corner].vector
            t = tuple(uv[corner].uv) if uv else (0.0, 0.0)
            for k, (vn, vt) in enumerate(variants[v]):
                if vn.dot(n) > 0.99999 and abs(vt[0] - t[0]) < 1e-6 and abs(vt[1] - t[1]) < 1e-6:
                    corner_variant[corner] = k
                    break
            else:
                corner_variant[corner] = len(variants[v])
                variants[v].append((n.copy(), t))

    first = []  # output index of each vertex's first variant
    used_groups = {}
    out = {'position': [], 'normal': [], 'uv': [], 'joints': [], 'weights': [], 'color': []}
    for vertex, vs in zip(mesh.vertices, variants):
        first.append(len(out['position']) // 3)
        if not vs:
            continue
        p = space @ vertex.co
        w = _weights(obj, vertex, names)
        joints = [used_groups.setdefault(n, len(used_groups)) for n, _ in w] + [0] * (MAX_INFLUENCES - len(w))
        weights = [x for _, x in w] + [0.0] * (MAX_INFLUENCES - len(w))
        for n, t in vs:
            nn = (rot @ n).normalized()
            out['position'] += p[:]
            out['normal'] += nn[:]
            out['uv'] += [t[0], 1.0 - t[1]]  # glTF V runs down
            out['joints'] += joints
            out['weights'] += weights
            if col is not None:
                out['color'] += col.data[vertex.index].color[:3]
    indices = []
    for tri in mesh.loop_triangles:
        for corner in tri.loops:
            indices.append(first[mesh.loops[corner].vertex_index] + corner_variant[corner])
    out['indices'] = indices
    out['groups'] = list(used_groups)
    return out


def export_meshes(objects, armature, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    blob = bytearray()
    entries = []

    def put(fmt, values):
        offset = len(blob)
        blob.extend(struct.pack(f'<{len(values)}{fmt}', *values))
        while len(blob) % 4:
            blob.append(0)
        return {'offset': offset, 'length': len(values)}

    for obj in objects:
        a = mesh_arrays(obj, armature)
        slot = obj.material_slots[0].material if obj.material_slots else None
        entries.append({
            'name': obj.name,
            'material': slot.name if slot else None,
            'groups': a['groups'],
            'count': len(a['position']) // 3,
            'triangles': len(a['indices']) // 3,
            'position': put('f', a['position']),
            'normal': put('f', a['normal']),
            'uv': put('f', a['uv']),
            'joints': put('H', a['joints']),
            'weights': put('f', a['weights']),
            'indices': put('I', a['indices']),
            **({'color': put('f', a['color'])} if a['color'] else {}),
        })
        print(f"hero_lib: {obj.name}: {entries[-1]['count']} vertices, {entries[-1]['triangles']} triangles, {len(a['groups'])} joints")
    with open(os.path.join(out_dir, 'meshes.bin'), 'wb') as f:
        f.write(blob)
    with open(os.path.join(out_dir, 'meshes.json'), 'w', encoding='utf-8') as f:
        json.dump({'blender': bpy.app.version_string, 'meshes': entries}, f, indent=1)
