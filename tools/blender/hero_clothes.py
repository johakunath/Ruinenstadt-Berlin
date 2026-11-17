# Clothing pieces for the hero (H1 step 3, docs/tasks/h1-hero.md). Runs inside Blender.
#
# Tight parts (coat body and sleeves, trousers, boots, gloves) are shells made from the body's own
# faces: duplicated, pushed out along the normal, relaxed and kept outside the body, so they keep the
# body's weights exactly. Loose parts (coat skirt, collar, belt, pocket) are built here and get their
# weights from the same rule as the old code-built skirt (pelvis to thighs by height and side).
# Colours are vertex colours (linear, point domain `Col`); painted textures come in step 6.
#
# Blender space: meters, Z up, front -Y, hero's left +X.
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def srgb(hex_color):
    n = int(hex_color[1:], 16)
    return tuple(((n >> s) & 255) / 255 for s in (16, 8, 0))


def lin(hex_color):
    return tuple(math.pow(c, 2.2) for c in srgb(hex_color))


def noise(p, k=1.0):
    """Cheap position hash in 0..1 for painterly variation (no external noise in background mode)."""
    s = math.sin(p.x * 127.1 * k + p.y * 311.7 * k + p.z * 74.7 * k) * 43758.5453
    return s - math.floor(s)


COAT = lin('#8a5c33')
COAT_DARK = lin('#5e3c20')
TROUSERS = lin('#3d3a36')
BOOTS = lin('#2a1f17')
LEATHER = lin('#4a2f1a')
BRASS = lin('#c9973a')
GLOVE = lin('#3b2717')


class Body:
    """World-space view of the source body: dominant joint per vertex, joint heads, a BVH."""

    def __init__(self, obj, armature):
        self.obj = obj
        self.armature = armature
        mw = obj.matrix_world
        mesh = obj.data
        names = [g.name for g in obj.vertex_groups]
        self.co = [mw @ v.co for v in mesh.vertices]
        self.dominant = []
        for v in mesh.vertices:
            best = max(v.groups, key=lambda g: g.weight, default=None)
            self.dominant.append(names[best.group] if best else '')
        tris = []
        mesh.calc_loop_triangles()
        for t in mesh.loop_triangles:
            tris.append(tuple(t.vertices))
        self.tris = tris
        self.groups = [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in mesh.vertices]
        self.bvh = BVHTree.FromPolygons(self.co, tris, epsilon=0.0)

    def head(self, bone):
        return self.armature.matrix_world @ self.armature.data.bones[bone].head_local

    def surface(self, p):
        """Nearest body point and its outward normal."""
        loc, normal, _, _ = self.bvh.find_nearest(p)
        return loc, normal

    def weights_at(self, p):
        """Joint weights at the body point nearest p, interpolated over its triangle."""
        loc, _, index, _ = self.bvh.find_nearest(p)
        a, b, c = (self.co[i] for i in self.tris[index])
        bary = _barycentric(loc, a, b, c)
        out = {}
        for k, i in zip(bary, self.tris[index]):
            for n, w in self.groups[i].items():
                out[n] = out.get(n, 0.0) + k * w
        return out

    def extent(self, z, phi, cy):
        """Distance from the vertical axis (0, cy) to the outermost body surface at height z in
        direction phi (0 = front, -Y; pi/2 = hero's left, +X)."""
        d = Vector((math.sin(phi), -math.cos(phi), 0.0))
        origin = Vector((0.0, cy, z)) + d * 1.5
        hit, _, _, dist = self.bvh.ray_cast(origin, -d, 1.5)
        return None if hit is None else 1.5 - dist


def _barycentric(p, a, b, c):
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
    d20, d21 = v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-12:
        return (1.0, 0.0, 0.0)
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return (max(0.0, 1 - v - w), max(0.0, v), max(0.0, w))


def apply_modifiers(obj):
    """Bakes the object's modifier stack into its mesh (background mode, no operators)."""
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = mesh
    bpy.data.meshes.remove(old)


def rebind_weights(obj, body):
    """Replaces the object's weights with the body's at the nearest body point."""
    obj.vertex_groups.clear()
    groups = {}
    for v in obj.data.vertices:
        for n, w in body.weights_at(v.co).items():
            if w <= 1e-3:
                continue
            if n not in groups:
                groups[n] = obj.vertex_groups.new(name=n)
            groups[n].add([v.index], w, 'REPLACE')


def _new_object(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _ensure_groups(obj, names):
    for n in names:
        if n not in obj.vertex_groups:
            obj.vertex_groups.new(name=n)


def _paint(obj, color_of):
    """Point-domain linear colours: color_of(index, world position) -> (r, g, b)."""
    mesh = obj.data
    attr = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in mesh.vertices:
        r, g, b = color_of(v.index, v.co)
        attr.data[v.index].color = (r, g, b, 1.0)


def shell(body, name, keep, offset, relax=8, min_gap=None, smooth_face=True):
    """Body faces whose vertices all pass keep(dominant joint, world pos), pushed out by
    offset(dominant, pos) meters, then relaxed `relax` times while staying min_gap outside the body."""
    src = body.obj
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.transform(src.matrix_world)
    bm.verts.ensure_lookup_table()
    dom = body.dominant
    gone = [f for f in bm.faces if not all(keep(dom[v.index], v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    # The glTF import keeps UV seams as split vertices: weld them so the shell has no cracks.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    bm.normal_update()
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    # Dominant joint per remaining vertex, from the deform layer.
    deform = bm.verts.layers.deform.active
    names = {i: g.name for i, g in enumerate(src.vertex_groups)}

    def dom_of(v):
        groups = v[deform]
        return names[max(groups.items(), key=lambda kv: kv[1])[0]] if groups else ''

    vdom = [dom_of(v) for v in bm.verts]
    want = [offset(vdom[i], v.co) for i, v in enumerate(bm.verts)]
    for v, d in zip(bm.verts, want):
        v.co += v.normal * d
    gap = min_gap or (lambda i: want[i] * 0.8)
    boundary = {v.index for v in bm.verts if v.is_boundary}
    for _ in range(relax):
        new = []
        for v in bm.verts:
            if v.index in boundary or not v.link_edges:
                new.append(v.co.copy())
                continue
            avg = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            new.append(v.co.lerp(avg, 0.5))
        for v, c in zip(bm.verts, new):
            loc, n = body.surface(c)
            out = (c - loc).dot(n)
            g = gap(v.index)
            v.co = c + n * (g - out) if out < g else c
    for f in bm.faces:
        f.smooth = smooth_face
    obj = _new_object(name, bm)
    _ensure_groups(obj, [g.name for g in src.vertex_groups])
    # bmesh kept the deform layer with the source group indices; copy the group names in order.
    for i, g in enumerate(src.vertex_groups):
        if obj.vertex_groups[i].name != g.name:
            raise RuntimeError('vertex group order changed')
    return obj, vdom


class Piece:
    """Collects built geometry (quads and triangles) with weights and colours into one bmesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.col = self.bm.verts.layers.float_color.new('Col')
        self.groups = []

    def group(self, name):
        if name not in self.groups:
            self.groups.append(name)
        return self.groups.index(name)

    def vert(self, co, weights, color):
        v = self.bm.verts.new(co)
        total = sum(w for _, w in weights if w > 0)
        for n, w in weights:
            if w > 1e-3:
                v[self.deform][self.group(n)] = w / total
        v[self.col] = (*color, 1.0)
        return v

    def face(self, *verts, smooth=True):
        f = self.bm.faces.new(verts)
        f.smooth = smooth
        return f

    def box(self, center, x_axis, y_axis, z_axis, size, weights, color):
        """Box at center with half sizes along the three (unit) axes; flat shaded."""
        hx, hy, hz = size
        corners = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                for sz in (-1, 1):
                    corners.append(self.vert(center + x_axis * (sx * hx) + y_axis * (sy * hy) + z_axis * (sz * hz), weights, color))
        idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for a, b, c, d in idx:
            self.face(corners[a], corners[b], corners[c], corners[d], smooth=False)

    def to_object(self, name):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        obj = _new_object(name, bm)
        for n in self.groups:
            obj.vertex_groups.new(name=n)
        return obj


def skirt_weights(t, x, top, phi=0.0):
    """Skirt weights by height t (0 belt, 1 hem), side x and angle phi (0 front, pi back): the front
    follows the thigh fully from a third of the way down, so a raised knee never pokes through; the
    back follows less."""
    reach = 0.75 + 0.25 * math.cos(phi)
    leg = reach * math.pow(min(1.0, t / 0.35), 0.8)
    left = min(1.0, max(0.0, 0.5 + x / 0.16))
    w = [('pelvis', (1 - leg) * (0.5 if top else 1.0)), ('thigh_l', leg * left), ('thigh_r', leg * (1 - left))]
    if top:
        w.append(('spine_01', 0.5))
    return w


# Coat back panel chains, made in build-hero.mjs on the pelvis: _01 just below the belt, _02 at
# COAT_CHAIN_LOW meters. The back of the skirt moves with them; HeroView swings them.
COAT_CHAIN_LOW = 0.66


def with_back_chain(weights, t, x, z, phi, h1):
    """Moves the back of the skirt (fading out toward the sides) onto the coat chains."""
    back = min(1.0, max(0.0, (-math.cos(phi) - 0.2) / 0.6)) * min(1.0, t / 0.25)
    if back <= 0:
        return weights
    low = min(1.0, max(0.0, (COAT_CHAIN_LOW + 0.08 - z) / 0.16))
    left = min(1.0, max(0.0, 0.5 + x / 0.06))
    out = [(n, w * (1 - back)) for n, w in weights]
    for side, k in (('l', left), ('r', 1 - left)):
        out.append((f'coat_b{side}_01', back * k * (1 - low)))
        out.append((f'coat_b{side}_02', back * k * low))
    return out


def coat(body):
    """a_mantel: long belted leather coat (body, sleeves, skirt, belt, pocket) and trousers. No collar:
    the scarf covers the neck, as in the 2D art."""
    waist = body.head('spine_01').z - 0.005
    wrist_x = abs(body.head('hand_l').x) - 0.035
    neck_z = body.head('neck_01').z
    hem = 0.36

    def upper(d, p):
        if d.startswith(('spine', 'clavicle', 'upperarm')):
            return p.z > waist - 0.02
        if d.startswith('lowerarm'):
            return abs(p.x) < wrist_x
        return False

    def upper_off(d, p):
        return 0.012 if 'arm' in d else 0.017

    top, tdom = shell(body, 'coat_top', upper, upper_off, relax=30)
    # Turned-up cuffs: extrude the sleeve openings outward.
    bm = bmesh.new()
    bm.from_mesh(top.data)
    bm.verts.ensure_lookup_table()
    sleeve = [e for e in bm.edges if e.is_boundary and all(abs(v.co.x) > wrist_x - 0.03 for v in e.verts)]
    ret = bmesh.ops.extrude_edge_only(bm, edges=sleeve)
    for v in (g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)):
        side = 1 if v.co.x > 0 else -1
        radial = Vector((0, v.co.y - body.head('hand_l').y, v.co.z - body.head('hand_l').z)).normalized()
        v.co += Vector((-side * 0.045, 0, 0)) + radial * 0.012
    bm.to_mesh(top.data)
    bm.free()

    def top_color(i, co):
        n = noise(co, 3.0)
        k = (0.78 + 0.32 * n)
        # Darker under the arms and at the sleeve ends.
        if abs(co.x) > wrist_x - 0.05:
            k *= 0.75
        return tuple(c * k for c in COAT)

    _paint(top, top_color)

    trousers, _ = shell(body, 'trousers', lambda d, p: d.startswith(('pelvis', 'thigh', 'calf')), lambda d, p: 0.006 if d != 'pelvis' else 0.009, relax=4)
    _paint(trousers, lambda i, co: tuple(c * (0.85 + 0.25 * noise(co, 5.0)) for c in TROUSERS))

    # --- skirt: two half panels from the front edge to the back seam, welded above the back slit.
    piece = Piece()
    cy = (body.head('thigh_l').y + body.head('thigh_r').y) / 2
    rows, cols = 9, 13
    heights = [waist + 0.03 + (hem - waist - 0.03) * r / (rows - 1) for r in range(rows)]
    slit_from = 0.78
    panels = []
    for side in (1, -1):  # +1: hero's left (+X), front edge to back
        grid = []
        prev = [0.0] * (cols + 1)
        for r, z in enumerate(heights):
            t = r / (rows - 1)
            # Closed like the 2D mantel: the left panel wraps over the right one past the centre; only
            # the last quarter opens a little for walking, and the back has a short slit at the hem.
            walk = math.pow(max(0.0, (t - 0.75) / 0.25), 1.5)
            gap = -0.16 + 0.2 * walk if side > 0 else 0.04 * walk
            slit = 0.0 if t < slit_from else 0.02 + 0.06 * (t - slit_from) / (1 - slit_from)
            off = 0.034 + 0.045 * t + (0.009 if side > 0 else 0.0)
            row = []
            for c in range(cols + 1):
                u = c / cols
                phi = side * (gap + (math.pi - slit - gap) * u)
                e = body.extent(z, phi, cy)
                if e is None:
                    e = prev[c] - off if r else 0.12
                rad = max(prev[c] + 0.004, e + off) if r else e + off
                prev[c] = rad
                y_jag = (noise(Vector((c * side, r, 3.0))) - 0.35) * 0.07 if r == rows - 1 else 0.0
                co = Vector((math.sin(phi) * rad, cy - math.cos(phi) * rad, z + y_jag))
                shade = (0.75 + 0.35 * noise(co, 2.0)) * (1 - 0.22 * t)
                col = COAT_DARK if (r == rows - 1 and noise(co, 9.0) > 0.6) else COAT
                w = with_back_chain(skirt_weights(t, co.x, r == 0, phi), t, co.x, co.z, phi, waist)
                row.append(piece.vert(co, w, tuple(k * shade for k in col)))
            grid.append(row)
        for r in range(rows - 1):
            for c in range(cols):
                a, b, cc, d = grid[r][c], grid[r + 1][c], grid[r + 1][c + 1], grid[r][c + 1]
                piece.face(a, d, cc, b) if side > 0 else piece.face(a, b, cc, d)
        panels.append(grid)
    # Weld the back seam above the slit.
    seam = [panels[0][r][cols] for r in range(rows) if r / (rows - 1) < slit_from] + [panels[1][r][cols] for r in range(rows) if r / (rows - 1) < slit_from]
    bmesh.ops.remove_doubles(piece.bm, verts=seam, dist=0.002)

    # --- belt with buckle and a pouch on the right hip, over the skirt top.
    belt_z = waist + 0.03
    ring = []
    n = 28
    for k in range(n):
        phi = 2 * math.pi * k / n
        e = body.extent(belt_z, phi, cy) or 0.14
        rad = e + 0.045
        d = Vector((math.sin(phi), -math.cos(phi), 0))
        p = Vector((0, cy, 0)) + d * rad
        w = [('pelvis', 0.5), ('spine_01', 0.5)]
        shade = 0.8 + 0.4 * noise(p + Vector((0, 0, k)), 4.0)
        ring.append((piece.vert(p + Vector((0, 0, belt_z + 0.024)), w, tuple(c * shade for c in LEATHER)),
                     piece.vert(p + Vector((0, 0, belt_z - 0.024)), w, tuple(c * shade for c in LEATHER))))
    for k in range(n):
        a, b = ring[k], ring[(k + 1) % n]
        piece.face(a[0], a[1], b[1], b[0], smooth=False)
    front = Vector((0, cy - (body.extent(belt_z, 0, cy) or 0.12) - 0.05, belt_z))
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    piece.box(front, X, Y, Z, (0.026, 0.006, 0.022), [('pelvis', 0.5), ('spine_01', 0.5)], BRASS)
    rx = body.extent(belt_z - 0.06, -math.pi / 2, cy) or 0.17
    piece.box(Vector((-(rx + 0.07), cy, belt_z - 0.07)), X, Y, Z, (0.022, 0.05, 0.055), [('pelvis', 1.0)], tuple(c * 1.15 for c in LEATHER))
    piece.box(Vector((-(rx + 0.093), cy, belt_z - 0.04)), X, Y, Z, (0.004, 0.012, 0.012), [('pelvis', 1.0)], BRASS)

    # --- pocket flap on the hero's right front, on the skirt surface.
    zp = waist - 0.17
    tp = (zp - heights[0]) / (heights[-1] - heights[0])
    phi = -0.45
    e = body.extent(zp, phi, cy) or 0.17
    nrm = Vector((math.sin(phi), -math.cos(phi), 0))
    p = Vector((0, cy, zp)) + nrm * (e + 0.034 + 0.045 * tp + 0.02)
    tang = Z.cross(nrm).normalized()
    piece.box(p, tang, nrm, Z, (0.065, 0.006, 0.035), skirt_weights(tp, p.x, False, phi), tuple(c * 0.85 for c in COAT))
    piece.box(p + Z * -0.012 + nrm * 0.007, tang, nrm, Z, (0.008, 0.003, 0.008), skirt_weights(tp, p.x, False, phi), BRASS)

    # --- buttons: two columns down the chest, on the coat surface.
    tree = BVHTree.FromObject(top, bpy.context.evaluated_depsgraph_get())
    for z in (waist + 0.10, waist + 0.20, waist + 0.30):
        for x in (-0.045, 0.045):
            hit, nrm_b, _, _ = tree.ray_cast(Vector((x, cy - 1.0, z)), Vector((0, 1, 0)), 2.0)
            if hit is None:
                continue
            tb = Z.cross(nrm_b).normalized()
            piece.box(hit + nrm_b * 0.004, tb, nrm_b, nrm_b.cross(tb), (0.009, 0.004, 0.009), [('spine_02', 0.6), ('spine_01', 0.4)] if z < waist + 0.25 else [('spine_03', 0.5), ('spine_02', 0.5)], BRASS)

    loose = piece.to_object('coat_loose')
    return join('a_mantel', [top, trousers, loose])


def boots(body):
    """f_stiefel: heavy boots. The inflated feet and lower calves are closed at the top and voxel
    remeshed, which melts the toes into one boot shape; weights come from the nearest body point."""
    shaft = 0.36

    def keep(d, p):
        return d.startswith(('foot', 'ball')) or (d.startswith('calf') and p.z < shaft)

    obj, _ = shell(body, 'f_stiefel', keep, lambda d, p: 0.014, relax=3)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bm.to_mesh(obj.data)
    bm.free()
    rem = obj.modifiers.new('remesh', 'REMESH')
    rem.mode = 'VOXEL'
    rem.voxel_size = 0.007
    smooth = obj.modifiers.new('smooth', 'SMOOTH')
    smooth.factor = 0.6
    smooth.iterations = 6
    dec = obj.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = 0.1
    apply_modifiers(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # Reopen the shaft, flatten the sole, fold a cuff over the shaft top.
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.co.z > shaft - 0.008 for v in f.verts)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for v in bm.verts:
        v.co.z = max(v.co.z, 0.0)
    ret = bmesh.ops.extrude_edge_only(bm, edges=[e for e in bm.edges if e.is_boundary])
    for v in (g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)):
        calf = body.head('calf_l' if v.co.x > 0 else 'calf_r')
        out = Vector((v.co.x - calf.x, v.co.y - calf.y, 0)).normalized()
        v.co += out * 0.012 - Vector((0, 0, 0.035))
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(obj.data)
    bm.free()
    rebind_weights(obj, body)
    _paint(obj, lambda i, co: tuple(c * ((0.55 if co.z < 0.02 else 0.85) + 0.3 * noise(co, 6.0)) for c in BOOTS))
    return obj


def gloves(body):
    """g_handsch: leather gloves on hands and fingers."""
    obj, _ = shell(body, 'g_handsch', lambda d, p: d.startswith(('hand', 'index', 'middle', 'ring', 'pinky', 'thumb')), lambda d, p: 0.003, relax=2, min_gap=lambda i: 0.002)
    dec = obj.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = 0.8
    apply_modifiers(obj)
    _paint(obj, lambda i, co: tuple(c * (0.85 + 0.3 * noise(co, 8.0)) for c in GLOVE))
    return obj


SCARF = lin('#d22c1e')
SCARF_DARK = lin('#7e1610')


def scarf(body, coat_obj):
    """scarf: two lumpy wraps around the neck, a knot on the left front, a short front tail and a long
    back tail on the scarf bones that the game sways (bone positions as created in build-hero.mjs)."""
    piece = Piece()
    neck = body.head('neck_01')
    wrap_w = [('neck_01', 0.45), ('spine_03', 0.55)]

    def shade(co, k):
        return tuple(c * k * (0.85 + 0.25 * noise(co, 7.0)) for c in SCARF)

    # Wraps: tubes along a closed path, sitting lower at the front, with lumpy folds.
    for ring, (dz, rad, tube_z, tube_r) in enumerate(((0.0, 0.094, 0.04, 0.038), (-0.05, 0.108, 0.036, 0.04))):
        segs, sides = 18, 7
        grid = []
        for a in range(segs):
            phi = 2 * math.pi * a / segs
            front = math.cos(phi)  # 1 at the front (-Y)
            lump = 1 + 0.18 * math.sin(phi * 3 + ring * 1.7) + 0.08 * math.sin(phi * 7 + ring)
            c = Vector((math.sin(phi) * rad * lump, neck.y + 0.012 - front * rad * lump, neck.z - 0.012 + dz - 0.03 * front))
            out = Vector((math.sin(phi), -front, 0)).normalized()
            row = []
            for b in range(sides):
                th = 2 * math.pi * b / sides
                co = c + out * (math.cos(th) * tube_r * lump) + Vector((0, 0, math.sin(th) * tube_z))
                k = 0.7 + 0.35 * max(0.0, math.sin(th)) + 0.15 * math.cos(th)
                row.append(piece.vert(co, wrap_w, shade(co, k)))
            grid.append(row)
        for a in range(segs):
            for b in range(sides):
                p, q = grid[a], grid[(a + 1) % segs]
                piece.face(p[b], q[b], q[(b + 1) % sides], p[(b + 1) % sides])

    def knot(center, size):
        segs, rings = 8, 5
        rows = []
        for r in range(rings + 1):
            th = math.pi * r / rings
            row = []
            for a in range(segs):
                phi = 2 * math.pi * a / segs
                d = Vector((math.sin(th) * math.cos(phi), math.sin(th) * math.sin(phi), math.cos(th)))
                co = center + Vector((d.x * size[0], d.y * size[1], d.z * size[2]))
                row.append(piece.vert(co, wrap_w, shade(co, 0.75 + 0.3 * max(0.0, -d.y))))
            rows.append(row)
        for r in range(rings):
            for a in range(segs):
                piece.face(rows[r][a], rows[r][(a + 1) % segs], rows[r + 1][(a + 1) % segs], rows[r + 1][a])

    kc = Vector((0.06, neck.y - 0.1, neck.z - 0.07))
    knot(kc, (0.035, 0.03, 0.03))

    def ribbon(points, widths, weights_of, normal_of, tatter):
        """A strip along points; the last row is torn into a zig-zag."""
        rows = []
        n = len(points)
        for i, (p, w) in enumerate(zip(points, widths)):
            t = i / (n - 1)
            side = normal_of(t)
            row = []
            cols = 4
            for c in range(cols + 1):
                u = c / cols - 0.5
                co = p + side * (u * w)
                if i == n - 1:
                    co.z -= tatter * (0.5 + 0.5 * math.sin(c * 2.7 + 1.3))
                k = 0.8 + 0.3 * noise(co, 5.0) - 0.15 * abs(u)
                col = SCARF_DARK if i == n - 1 and c % 2 else SCARF
                row.append(piece.vert(co, weights_of(t), tuple(x * k for x in col)))
            rows.append(row)
        for i in range(n - 1):
            for c in range(len(rows[i]) - 1):
                piece.face(rows[i][c], rows[i][c + 1], rows[i + 1][c + 1], rows[i + 1][c])

    # Short front tail from the knot, over the chest.
    pts = [kc + Vector((0.01 * i, -0.012 * i, -0.06 * i)) for i in range(5)]
    ribbon(pts, [0.07, 0.075, 0.07, 0.065, 0.06], lambda t: [('spine_03', 1.0)], lambda t: Vector((1, -0.15, 0)).normalized(), 0.03)

    # Long back tail: follows scarf_01..03 (root 0.085 behind the neck, 0.2 m per bone).
    root = Vector((0.05, neck.y + 0.085, neck.z - 0.005))
    coat_tree = BVHTree.FromObject(coat_obj, bpy.context.evaluated_depsgraph_get())
    pts, widths = [], []
    for i in range(10):
        t = i / 9
        pt = root + Vector((0.01 * math.sin(t * 5), 0.03 * 3 * t, 0.02 - 0.6 * t))
        # Lie on the coat's back, never inside it (back is +Y): the outermost surface from behind.
        for dx in (-0.055, 0.0, 0.055):
            hit, _, _, _ = coat_tree.ray_cast(Vector((pt.x + dx, pt.y + 1.0, pt.z)), Vector((0, -1, 0)), 2.0)
            if hit is not None and pt.y < hit.y + 0.022:
                pt.y = hit.y + 0.022
        pts.append(pt)
        widths.append(0.11 * (1 - 0.3 * t))

    def tail_weights(t):
        bone = min(2, int(t * 3))
        frac = t * 3 - bone
        w = [(f'scarf_0{bone + 1}', 1 - frac * 0.5)]
        if bone < 2:
            w.append((f'scarf_0{bone + 2}', frac * 0.5))
        return w

    ribbon(pts, widths, tail_weights, lambda t: Vector((1, 0, 0)), 0.05)
    return piece.to_object('scarf')


def join(name, objects):
    """Joins objects into one (vertex groups merged by name, colour attributes kept)."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    out = bpy.context.view_layer.objects.active
    out.name = name
    out.data.name = name
    return out


def unwrap(obj):
    """Smart UV project, one layout per piece (step 6 paints over it)."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')


AO_STRENGTH = 0.7
AO_RAYS = 24
AO_REACH = 0.15


def _hemisphere(n):
    """Fixed, evenly spread directions on the upper unit hemisphere (Fibonacci spiral)."""
    out = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        out.append(Vector((math.cos(golden * i) * r, math.sin(golden * i) * r, z)))
    return out


def bake_ao(pieces, body):
    """Ambient occlusion by ray casts against the body and every piece (fixed directions, so the
    result is the same every run), multiplied into each piece's `Col`."""
    verts, polys = list(body.co), list(body.tris)
    for obj in pieces:
        base = len(verts)
        verts += [v.co.copy() for v in obj.data.vertices]
        polys += [tuple(base + i for i in p.vertices) for p in obj.data.polygons]
    tree = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    dirs = _hemisphere(AO_RAYS)
    for obj in pieces:
        col = obj.data.color_attributes['Col']
        for v in obj.data.vertices:
            n = v.normal
            t = n.orthogonal().normalized()
            b = n.cross(t)
            origin = v.co + n * 0.003
            hits = 0
            for d in dirs:
                ray = t * d.x + b * d.y + n * d.z
                if tree.ray_cast(origin, ray, AO_REACH)[0] is not None:
                    hits += 1
            k = 1 - AO_STRENGTH * hits / AO_RAYS
            r, g, bl, _ = col.data[v.index].color
            col.data[v.index].color = (r * k, g * k, bl * k, 1.0)
        print(f'hero_clothes: {obj.name}: ambient occlusion baked')


def build(armature, body_obj):
    body = Body(body_obj, armature)
    mantel = coat(body)
    pieces = [mantel, boots(body), gloves(body), scarf(body, mantel)]
    # The shells carry the body's UVs, which mean nothing on clothing (and joining them with built
    # parts leaves undefined UVs): drop them, unwrap each piece for step 6's painted textures, and
    # bake ambient occlusion into the vertex colours as placeholder shading.
    for obj in pieces:
        while obj.data.uv_layers:
            obj.data.uv_layers.remove(obj.data.uv_layers[0])
        unwrap(obj)
    bake_ao(pieces, body)
    for obj in pieces:
        # Stable output: bmesh ops (extrude) emit new faces in pointer order, which changes between
        # runs; sort faces by their vertices and triangulate with a fixed rule.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.index_update()
        bm.faces.index_update()
        order = sorted(bm.faces, key=lambda f: tuple(sorted(v.index for v in f.verts)))
        rank = {f.index: i for i, f in enumerate(order)}
        bm.faces.sort(key=lambda f: rank[f.index])
        bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method='FIXED', ngon_method='EAR_CLIP')
        bm.to_mesh(obj.data)
        bm.free()
    return pieces
