# ボドゲ 3D の人と椅子を作って glb に書き出す。
# 使い方：blender -b -P bodoge3d.py -- 出力先.glb
# 単位は cm のつもり（1 = 1cm）。机の天板の上面が z=0。人は +Y を向いて座る（three.js では -Z 向き）。
import bpy, bmesh, sys, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, rgb, rough=.7):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1); p.inputs['Roughness'].default_value = rough
    return m

M = {
    'skin':  material('skin',  (.83, .58, .42), .6),
    'shirt': material('shirt', (.6, .6, .6), .85),
    'pants': material('pants', (.12, .1, .14), .9),
    'hair':  material('hair',  (.1, .06, .04), .9),
    'wood':  material('wood',  (.2, .13, .09), .75),
}

def link(o, parent=None):
    bpy.context.collection.objects.link(o)
    if parent: o.parent = parent
    return o

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None); e.location = loc
    return link(e, parent)

def rounded_box(name, size, loc, mat, parent=None, level=2, bevel=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 3
    else:
        s = o.modifiers.new('sub', 'SUBSURF'); s.levels = level; s.render_levels = level
    o.data.materials.append(mat)
    for f in o.data.polygons: f.use_smooth = True
    if parent: o.parent = parent
    return o

def limb(name, pts, radii, mat, parent=None, origin=(0, 0, 0)):
    """骨の点をつないで、スキンで肉付けした腕や脚"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(Vector(p) - Vector(origin)) for p in pts]
    for a, b in zip(vs, vs[1:]): bm.edges.new((a, b))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); link(o, parent); o.location = origin
    sk = o.modifiers.new('skin', 'SKIN')
    for v, r in zip(me.skin_vertices[0].data, radii): v.radius = (r, r)
    me.skin_vertices[0].data[0].use_root = True
    s = o.modifiers.new('sub', 'SUBSURF'); s.levels = 2; s.render_levels = 2
    o.data.materials.append(mat)
    return o

def sphere(name, r, loc, mat, parent=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=20)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

# ── 人 ──
person = empty('person')
# 胴：やわらかい箱
torso = rounded_box('torso', (30, 20, 40), (0, 0, -6), M['shirt'], person)
# 首と頭
rounded_box('neck', (8, 8, 8), (0, 0, 15), M['skin'], person)
head = sphere('head', 11, (0, 1, 26), M['skin'], person, (1, .95, 1.05))
# 髪：頭の上と後ろを覆う
bpy.ops.mesh.primitive_uv_sphere_add(radius=12, location=(0, -.6, 27.5), segments=32, ring_count=20)
hair = bpy.context.active_object; hair.name = 'hair'
bm = bmesh.new(); bm.from_mesh(hair.data)
for v in [v for v in bm.verts if v.co.z < -2 and v.co.y > -4]: bm.verts.remove(v)   # 顔の側の下は空ける
for v in [v for v in bm.verts if v.co.z < -9]: bm.verts.remove(v)
bm.to_mesh(hair.data); bm.free()
sol = hair.modifiers.new('solid', 'SOLIDIFY'); sol.thickness = 1.2
bpy.ops.object.shade_smooth(); hair.data.materials.append(M['hair']); hair.parent = person
# 耳
for s in (-1, 1): sphere('ear', 2.6, (s * 10.8, 0, 25), M['skin'], person, (.5, 1, 1.2))
# 脚（机の下へ）
for s in (-1, 1):
    limb('leg', [(s * 8, -2, -24), (s * 9, 22, -26), (s * 9, 26, -60)], [7, 6, 5], M['pants'], person)
# 腕：肩を原点にした空の箱に入れる（three.js で回して手を伸ばす）
for s, nm in ((-1, 'armL'), (1, 'armR')):
    sh = (s * 16, 0, 9)
    arm = empty(nm, sh, person)
    limb('arm', [(0, 0, 0), (s * 3, 12, -12), (-s * 4, 30, -8)], [4.6, 4, 3.6], M['shirt'], arm)
    sphere('hand', 4, (-s * 5.5, 34, -8), M['skin'], arm, (1, 1.3, .6))

# ── 椅子 ──
chair = empty('chair')
wood = M['wood']
rounded_box('seat', (42, 40, 4), (0, -2, -27), wood, chair, bevel=1.2)
rounded_box('back', (40, 4, 26), (0, -22, 0), wood, chair, bevel=1.2)
for x in (-18, 18):
    rounded_box('post', (3.5, 3.5, 30), (x, -22, -14), wood, chair, bevel=.8)
for x, y in ((-18, 15), (18, 15), (-18, -20), (18, -20)):
    rounded_box('leg', (3.5, 3.5, 46), (x, y, -52), wood, chair, bevel=.8)

# 書き出し（モディファイアは焼き込む）
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True)
print('written', out)
