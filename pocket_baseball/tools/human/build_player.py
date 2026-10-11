"""実写寄りの野球選手モデルを MakeHuman (CC0) のデータから組み立てて、ブラウザ用のバイナリに書き出す。

出力: static/models/player.json (目録) + player.bin (頂点データ) + player_skin*.jpg (顔・手の肌テクスチャ)

構成:
  - 体: MakeHuman の基本メッシュに 若い男性・筋肉質・身長 1.80m 前後 の体型ターゲットを適用
  - 骨: MakeHuman の game_engine リグ (53 本)。休止姿勢の回転は単位 (位置だけ) で書き出す
  - 皮膚: 顔・首 (表情差分のモーフ付き) と 手 だけを残す
  - ユニフォーム: 体の表面を部位ごとに切り出し、法線方向にふくらませて平滑化した布メッシュ
                 (シャツ・アンダーシャツ・パンツ (短/長)・ソックス・スパイク・ベルト・帽子・ヘルメット)
  - 目: MakeHuman の high-poly eyes を体型に合わせて配置
"""
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
import mh  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "static", "models")
DATA = os.path.join(mh.SRC, "data")
SCALE = 0.1  # dm → m

V0, VT, F = mh.load_obj()
VG = mh.vgroups()
RIG = mh.rig()
WRAW = mh.weights()


# ---------------------------------------------------------------- 体型
def shaped(muscle=0.7, weight=0.55, height=0.62, proportions=0.85, race=None, extra=None):
    V = V0.copy()
    mh.macro(V, muscle=muscle, weight=weight, height=height, proportions=proportions, race=race)
    for k, v in (extra or {}).items():
        mh.modifier(V, k, v)
    return V


BASE = shaped()
P = BASE * SCALE
BODY_V = sorted({i for f in F["body"] for i in f[0]})
GROUND = P[BODY_V][:, 1].min()
P[:, 1] -= GROUND


def to_m(V):
    Q = V * SCALE
    Q[:, 1] -= GROUND
    return Q


# ---------------------------------------------------------------- 骨
BONES = []
BI = {}


def bone_order():
    # 親が先に来るように並べる
    names = list(RIG.keys())
    done = []
    while names:
        for n in list(names):
            par = RIG[n]["parent"]
            if not par or par in done:
                done.append(n)
                names.remove(n)
    return done


for n in bone_order():
    h = RIG[n]["head"]
    if h.get("strategy") == "CUBE":
        pos = mh.joint_pos(P, VG, h["cube_name"])
    else:
        pos = P[h["vertex_indices"]].mean(axis=0)
    BI[n] = len(BONES)
    BONES.append({"name": n, "parent": RIG[n]["parent"], "pos": pos})
for b in BONES:
    b["pi"] = BI[b["parent"]] if b["parent"] else -1


def tail_of(n):
    t = RIG[n]["tail"]
    if t.get("strategy") == "CUBE":
        return mh.joint_pos(P, VG, t["cube_name"])
    return P[t["vertex_indices"]].mean(axis=0)


# 頂点ごとの重み (上位 4)
NV = len(P)
WD = np.zeros((NV, len(BONES)), np.float32)
for bn, lst in WRAW.items():
    if bn not in BI:
        continue
    for i, w in lst:
        WD[i, BI[bn]] += w


def top4(W):
    idx = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, idx, axis=1)
    s = w.sum(axis=1, keepdims=True)
    s[s == 0] = 1
    w = w / s
    return idx.astype(np.uint8), w


def bones_weight(names):
    s = np.zeros(NV, np.float32)
    for n in names:
        if n in BI:
            s += WD[:, BI[n]]
    return s


HEADW = bones_weight(["head", "neck_01"])
HANDW = bones_weight([b["name"] for b in BONES if b["name"].startswith(("hand_", "thumb", "index", "middle", "ring", "pinky"))])
FOOTW = bones_weight(["foot_l", "foot_r", "ball_l", "ball_r"])
ARMW = bones_weight(["upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"])
LEGW = bones_weight(["thigh_l", "thigh_r", "calf_l", "calf_r"])
CALFW = bones_weight(["calf_l", "calf_r"])

J = {b["name"]: b["pos"] for b in BONES}

# ---------------------------------------------------------------- 面
BODYF = [f for f in F["body"]]


def tri_faces(quads):
    out = []
    for vi, ti in quads:
        if len(vi) == 4:
            out.append(([vi[0], vi[1], vi[2]], [ti[0], ti[1], ti[2]]))
            out.append(([vi[0], vi[2], vi[3]], [ti[0], ti[2], ti[3]]))
        else:
            out.append((vi[:3], ti[:3]))
    return out


def vnormals(pos, tris):
    n = np.zeros_like(pos)
    a = pos[tris[:, 0]]
    b = pos[tris[:, 1]]
    c = pos[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    l = np.linalg.norm(n, axis=1, keepdims=True)
    l[l == 0] = 1
    return n / l


ALLTRI = np.array([t[0] for t in tri_faces(BODYF)], np.int64)
NORM = vnormals(P, ALLTRI)


def seg_t(p, a, b):
    ab = b - a
    return float(np.dot(p - a, ab) / np.dot(ab, ab))


def face_center(f):
    return P[f[0]].mean(axis=0)


# 部位の判定 (面の中心で決める)
BELT_Y = J["pelvis"][1] + 0.085
SIDE = lambda c: "l" if c[0] > 0 else "r"  # noqa: E731


def classify(f):
    vi = f[0]
    c = face_center(f)
    hw = HEADW[vi].mean()
    hd = HANDW[vi].mean()
    fw = FOOTW[vi].mean()
    aw = ARMW[vi].mean()
    lw = LEGW[vi].mean()
    tags = set()
    if hw > 0.42:
        tags.add("head")
    if hw > 0.25 and hw < 0.75:
        tags.add("collar")
    if hd > 0.5:
        tags.add("hand")
    if hd > 0.3 and hd < 0.7:
        tags.add("wrist")
    if fw > 0.45:
        tags.add("foot")
    if aw > 0.35 and hd < 0.6 and hw < 0.4:
        s = SIDE(c)
        t = seg_t(c, J["upperarm_" + s], J["lowerarm_" + s])
        if t < 0.66:
            tags.add("sleeve")
        if t > 0.5:
            tags.add("under")
    if lw > 0.3 and fw < 0.6:
        s = SIDE(c)
        if CALFW[vi].mean() > 0.45:
            t = seg_t(c, J["calf_" + s], J["foot_" + s])
            if t < 0.42:
                tags.add("pants")
            if t < 0.93:
                tags.add("pantsL")
            if t > 0.34:
                tags.add("socks")
        else:
            tags.add("pants")
            tags.add("pantsL")
    if not tags or (not tags & {"head", "hand", "foot", "sleeve", "under", "pants", "socks"}):
        # 胴体
        if c[1] > BELT_Y - 0.06:
            tags.add("shirt")
        if c[1] < BELT_Y + 0.03:
            tags.add("pants")
            tags.add("pantsL")
    if "sleeve" in tags or ("collar" in tags and "head" not in tags):
        tags.add("shirt")
    if "collar" in tags and c[1] < J["neck_01"][1] + 0.02:
        tags.add("shirt")
    if "foot" in tags and "socks" not in tags and fw < 0.85:
        tags.add("socks")
    return tags


TAGS = [classify(f) for f in BODYF]


def faces_with(*tags):
    return [f for f, t in zip(BODYF, TAGS) if t & set(tags)]


# ---------------------------------------------------------------- 部分メッシュ
class Part:
    def __init__(self, name, quads, mat):
        self.name = name
        self.mat = mat
        tris = tri_faces(quads)
        vids = sorted({i for t in tris for i in t[0]})
        self.src = np.array(vids, np.int64)
        remap = {v: k for k, v in enumerate(vids)}
        self.tri = np.array([[remap[i] for i in t[0]] for t in tris], np.int64)
        self.pos = P[self.src].copy()
        self.mhuv = np.zeros((len(vids), 2))
        for t in tris:
            for i, ti in zip(t[0], t[1]):
                if ti >= 0:
                    self.mhuv[remap[i]] = VT[ti]
        self.uvtri = [t[1] for t in tris]
        self.nrm = NORM[self.src].copy()
        self.W = WD[self.src].copy()
        self.uv = None
        self.morphs = []
        self.color = None

    def neighbors(self):
        nb = [set() for _ in range(len(self.pos))]
        for a, b, c in self.tri:
            nb[a].update((b, c))
            nb[b].update((a, c))
            nb[c].update((a, b))
        return [np.array(sorted(s), np.int64) for s in nb]

    def boundary(self):
        from collections import Counter

        e = Counter()
        for a, b, c in self.tri:
            for u, v in ((a, b), (b, c), (c, a)):
                e[(min(u, v), max(u, v))] += 1
        bv = set()
        for (u, v), n in e.items():
            if n == 1:
                bv.update((u, v))
        return np.array(sorted(bv), np.int64)

    def smooth(self, iters=6, lam=0.5, mu=-0.53, fix_boundary=True, mask=None):
        nb = self.neighbors()
        bnd = set(self.boundary().tolist()) if fix_boundary else set()
        for _ in range(iters):
            for k in (lam, mu):
                avg = np.array([self.pos[n].mean(axis=0) if len(n) else self.pos[i] for i, n in enumerate(nb)])
                d = (avg - self.pos) * k
                if mask is not None:
                    d *= mask[:, None]
                for i in bnd:
                    d[i] = 0
                self.pos += d

    def smooth_weights(self, iters=2):
        nb = self.neighbors()
        for _ in range(iters):
            self.W = np.array([(self.W[i] + self.W[n].mean(axis=0)) * 0.5 if len(n) else self.W[i] for i, n in enumerate(nb)])

    def inflate(self, off):
        self.pos = self.pos + self.nrm * off[:, None]

    def recompute_normals(self):
        self.nrm = vnormals(self.pos, self.tri)


def ensure_outside(part, minoff):
    """布が体に食い込まないよう、元の体の点から法線方向に最低 minoff 離す。"""
    base = P[part.src]
    n = NORM[part.src]
    d = ((part.pos - base) * n).sum(axis=1)
    lack = np.maximum(0, minoff - d)
    part.pos += n * lack[:, None]


def radial_from(part, axis_pts):
    """各頂点の、体の中心軸 (y で補間) からの水平方向ベクトル"""
    ys, cx, cz = axis_pts
    y = part.pos[:, 1]
    x0 = np.interp(y, ys, cx)
    z0 = np.interp(y, ys, cz)
    return part.pos[:, 0] - x0, part.pos[:, 2] - z0


# ---------------------------------------------------------------- 各パーツ
parts = {}

# 顔・首
head = Part("head", faces_with("head"), "skin")
parts["head"] = head
# 手
hands = Part("hands", faces_with("hand"), "skin")
parts["hands"] = hands

# シャツ (胴体と半袖)
shirt = Part("shirt", faces_with("shirt"), "shirt")
y = shirt.pos[:, 1]
off = np.full(len(shirt.pos), 0.016)
# 腹まわり・背中はゆったり
off += np.clip((J["spine_03"][1] - y) / 0.25, 0, 1) * 0.016
off += np.clip((y - (J["spine_03"][1] + 0.05)) / 0.2, 0, 1) * 0.004
# 袖はゆったり
armness = ARMW[shirt.src]
off += armness * 0.014
# 首まわりは詰める
off -= HEADW[shirt.src] * 0.006
shirt.inflate(off)
shirt.smooth(iters=10)
ensure_outside(shirt, 0.008)
shirt.smooth(iters=3)
ensure_outside(shirt, 0.007)
shirt.smooth_weights(3)
parts["shirt"] = shirt

# アンダーシャツの袖 (前腕)
under = Part("under", faces_with("under", "wrist"), "under")
under.inflate(np.full(len(under.pos), 0.005))
under.smooth(iters=3)
ensure_outside(under, 0.004)
parts["under"] = under

# パンツ (ショート丈: ソックスが見える / ロング丈)
for key, tag in (("pants", "pants"), ("pantsL", "pantsL")):
    pt = Part(key, faces_with(tag), "pants")
    y = pt.pos[:, 1]
    off = np.full(len(pt.pos), 0.02)
    lw = LEGW[pt.src]
    off += lw * 0.012
    # 膝下は少し絞る (ショート丈は裾がふくらむ)
    off -= CALFW[pt.src] * (0.004 if key == "pants" else 0.01)
    # 腰はベルトで締める
    off -= np.clip(1 - abs(y - BELT_Y) / 0.05, 0, 1) * 0.006
    pt.inflate(off)
    pt.smooth(iters=10)
    ensure_outside(pt, 0.012)
    pt.smooth(iters=2)
    ensure_outside(pt, 0.01)
    pt.smooth_weights(3)
    parts[key] = pt

# ソックス (ストッキング)
socks = Part("socks", faces_with("socks"), "socks")
socks.inflate(np.full(len(socks.pos), 0.004))
socks.smooth(iters=3)
ensure_outside(socks, 0.003)
parts["socks"] = socks

# スパイク
shoes = Part("shoes", faces_with("foot"), "shoes")
shoes.inflate(np.full(len(shoes.pos), 0.013))
shoes.smooth(iters=14, fix_boundary=True)
ensure_outside(shoes, 0.008)
shoes.smooth(iters=4, fix_boundary=True)
# 靴底を平らにする
low = shoes.pos[:, 1] < 0.022
shoes.pos[low, 1] = np.maximum(shoes.pos[low, 1] * 0.25, 0.0)
shoes.pos[:, 1] = np.maximum(shoes.pos[:, 1], 0.0)
shoes.color = np.where((shoes.pos[:, 1] < 0.026)[:, None], np.array([[0.92, 0.92, 0.9]]), np.array([[1.0, 1.0, 1.0]]))
shoes.smooth_weights(2)
parts["shoes"] = shoes

for p in parts.values():
    p.recompute_normals()


# ---------------------------------------------------------------- 帽子・ヘルメット (頭にぴったり合わせる)
def cap_part(name, offset, cut_front, cut_back, mat):
    hc = J["head"]
    sel = []
    for f in BODYF:
        c = face_center(f)
        if HEADW[f[0]].mean() < 0.9:
            continue
        rel = c - hc
        # 額の上から後頭部まで (前は眉の上、後ろは襟足の上)
        ylim = cut_front + (cut_back - cut_front) * np.clip((-rel[2] + 0.03) / 0.12, 0, 1)
        if rel[1] > ylim:
            sel.append(f)
    cp = Part(name, sel, mat)
    cp.inflate(np.full(len(cp.pos), offset))
    cp.smooth(iters=12, fix_boundary=False)
    ensure_outside(cp, offset * 0.8)
    cp.smooth(iters=4, fix_boundary=False)
    ensure_outside(cp, offset * 0.75)
    # すべて頭の骨に付ける
    cp.W = np.zeros_like(cp.W)
    cp.W[:, BI["head"]] = 1
    cp.recompute_normals()
    return cp


EYE_Y = mh.joint_pos(P, VG, "joint-l-eye")[1]
HEAD_Y = J["head"][1]
parts["cap"] = cap_part("cap", 0.011, EYE_Y - HEAD_Y + 0.052, EYE_Y - HEAD_Y + 0.0, "cap")
parts["helmet"] = cap_part("helmet", 0.022, EYE_Y - HEAD_Y + 0.045, EYE_Y - HEAD_Y - 0.035, "helmet")

# ---------------------------------------------------------------- 目 (high-poly eyes を配置)
def load_eyes(Vshape):
    lines = open(os.path.join(DATA, "eyes_high.mhclo")).read().split("\n")
    sc = {}
    refs = []
    on = False
    for ln in lines:
        p = ln.split()
        if not p:
            continue
        if p[0] in ("x_scale", "y_scale", "z_scale"):
            sc[p[0][0]] = (int(p[1]), int(p[2]), float(p[3]))
        elif p[0] == "verts":
            on = True
        elif on:
            if len(p) == 9:
                refs.append(p)
            elif len(p) == 1 and p[0].isdigit():
                refs.append([p[0], p[0], p[0], "1", "0", "0", "0", "0", "0"])
            else:
                on = False
    s = {}
    for ax, k in (("x", 0), ("y", 1), ("z", 2)):
        a, b, f = sc[ax]
        s[ax] = abs(Vshape[a][k] - Vshape[b][k]) / f
    pos = []
    for r in refs:
        v = [int(r[0]), int(r[1]), int(r[2])]
        w = [float(r[3]), float(r[4]), float(r[5])]
        d = [float(r[6]) * s["x"], float(r[7]) * s["y"], float(r[8]) * s["z"]]
        pos.append(w[0] * Vshape[v[0]] + w[1] * Vshape[v[1]] + w[2] * Vshape[v[2]] + np.array(d))
    pos = np.array(pos)
    # obj の面と UV
    vs, vts, fs = [], [], []
    for ln in open(os.path.join(DATA, "eyes_high.obj")):
        if ln.startswith("vt "):
            vts.append([float(x) for x in ln.split()[1:3]])
        elif ln.startswith("f "):
            fs.append([tuple(int(x) - 1 if x else -1 for x in t.split("/")[:2]) for t in ln.split()[1:]])
    # 頂点を UV ごとに分ける
    key = {}
    outp, outuv, tri = [], [], []
    for f in fs:
        ids = []
        for vi, ti in f:
            k = (vi, ti)
            if k not in key:
                key[k] = len(outp)
                outp.append(pos[vi])
                outuv.append(vts[ti] if ti >= 0 else [0, 0])
            ids.append(key[k])
        for i in range(1, len(ids) - 1):
            tri.append([ids[0], ids[i], ids[i + 1]])
    return np.array(outp), np.array(outuv), np.array(tri, np.int64)


ep, euv, etri = load_eyes(BASE)
ep = ep * SCALE
ep[:, 1] -= GROUND
eyes = Part.__new__(Part)
eyes.name = "eyes"
eyes.mat = "eyes"
eyes.pos = ep
eyes.tri = etri
eyes.uv = euv
eyes.W = np.zeros((len(ep), len(BONES)), np.float32)
eyes.W[:, BI["head"]] = 1
eyes.morphs = []
eyes.color = None
eyes.src = None
eyes.recompute_normals = lambda: None
eyes.nrm = vnormals(ep, etri)
parts["eyes"] = eyes


# ---------------------------------------------------------------- 顔の差分 (モーフ)
FACE_MODS = [
    ("oval", "head/head-oval", 1),
    ("round", "head/head-round", 1),
    ("square", "head/head-square", 1),
    ("tri", "head/head-triangular", 1),
    ("fat", "head/head-fat-incr", 1),
    ("long", "head/head-scale-vert-incr", 1),
    ("wide", "head/head-scale-horiz-incr", 1),
    ("noseW", "nose/nose-scale-horiz-incr", 1),
    ("noseL", "nose/nose-scale-vert-incr", 1),
    ("noseHump", "nose/nose-hump-incr", 1),
    ("noseVol", "nose/nose-volume-incr", 1),
    ("mouthW", "mouth/mouth-scale-horiz-incr", 1),
    ("lipLow", "mouth/mouth-lowerlip-volume-incr", 1),
    ("lipUp", "mouth/mouth-upperlip-volume-incr", 1),
    ("chinPro", "chin/chin-prominent-incr", 1),
    ("chinW", "chin/chin-width-incr", 1),
    ("jaw", "chin/chin-jaw-drop-incr", 1),
    ("cheekB", ["cheek/l-cheek-bones-incr", "cheek/r-cheek-bones-incr"], 1),
    ("eyeS", ["eyes/l-eye-scale-incr", "eyes/r-eye-scale-incr"], 1),
    ("eyeH", ["eyes/l-eye-height2-incr", "eyes/r-eye-height2-incr"], 1),
    ("epic", ["eyes/l-eye-epicanthus-in", "eyes/r-eye-epicanthus-in"], 1),
    ("browUp", "eyebrows/eyebrows-trans-up", 1),
    ("browAng", "eyebrows/eyebrows-angle-up", 1),
    ("earS", ["ears/l-ear-scale-incr", "ears/r-ear-scale-incr"], 1),
    ("forehead", "forehead/forehead-scale-vert-incr", 1),
]


def face_delta(spec):
    V = BASE.copy()
    names = spec if isinstance(spec, list) else [spec]
    for n in names:
        mh.apply(V, n, 1.0)
    return (V - BASE) * SCALE


ETH = {
    "caucasian": shaped(race={"asian": 0, "caucasian": 1, "african": 0}),
    "african": shaped(race={"asian": 0, "caucasian": 0, "african": 1}),
}
for key, spec, _ in FACE_MODS:
    d = face_delta(spec)
    head.morphs.append((key, d[head.src]))
for key, Vx in ETH.items():
    d = (Vx - BASE) * SCALE
    # 頭以外は差分を消す (体格は共通)
    d = d * np.clip((HEADW[:, None] - 0.3) / 0.4, 0, 1)
    head.morphs.append((key, d[head.src]))
print("morphs", len(head.morphs))


# ---------------------------------------------------------------- UV
def cyl_uv(part, center_fn, u0=0.0, u1=1.0, v0=0.0, v1=1.0, ylo=None, yhi=None, front_at=0.25):
    cx, cz = center_fn(part.pos)
    ang = np.arctan2(part.pos[:, 0] - cx, part.pos[:, 2] - cz)  # 0 = 正面 (+Z), +π/2 = 左 (+X)
    # 正面から見て左→右 (選手の右→左) に u が増える向き (文字が鏡写しにならない)
    u = (front_at + ang / (2 * math.pi)) % 1.0
    ylo = part.pos[:, 1].min() if ylo is None else ylo
    yhi = part.pos[:, 1].max() if yhi is None else yhi
    v = (part.pos[:, 1] - ylo) / (yhi - ylo)
    return np.stack([u0 + u * (u1 - u0), v0 + np.clip(v, 0, 1) * (v1 - v0)], axis=1)


def split_seam(part, uv):
    """円筒 UV の継ぎ目 (u が 0↔1 で折り返す三角形) の頂点を複製する。"""
    pos, nrm, W = list(part.pos), list(part.nrm), list(part.W)
    uvs = list(uv)
    src = list(part.src) if part.src is not None else None
    col = list(part.color) if part.color is not None else None
    tri = part.tri.copy()
    dup = {}
    for t in range(len(tri)):
        us = uv[tri[t], 0]
        if us.max() - us.min() > 0.5:
            for k in range(3):
                vi = tri[t, k]
                if uv[vi, 0] < 0.5:
                    if vi not in dup:
                        dup[vi] = len(pos)
                        pos.append(part.pos[vi])
                        nrm.append(part.nrm[vi])
                        W.append(part.W[vi])
                        uvs.append([uv[vi, 0] + 1.0, uv[vi, 1]])
                        if src is not None:
                            src.append(part.src[vi])
                        if col is not None:
                            col.append(part.color[vi])
                    tri[t, k] = dup[vi]
    part.pos = np.array(pos)
    part.nrm = np.array(nrm)
    part.W = np.array(W)
    part.tri = tri
    if src is not None:
        part.src = np.array(src)
    if col is not None:
        part.color = np.array(col)
    part.morphs = [(k, np.concatenate([d, d[[i for i in sorted(dup, key=lambda x: dup[x])]]])) for k, d in part.morphs] if part.morphs else []
    return np.array(uvs)


def torso_center(pos):
    return np.zeros(len(pos)), np.interp(pos[:, 1], [0.9, 1.2, 1.5], [J["pelvis"][2], J["spine_03"][2], J["neck_01"][2] - 0.02])


# シャツ: 胴体は テクスチャ上部 [0,1]x[0.3,1]、袖は下部 (左 [0,0.5], 右 [0.5,1]) x [0,0.28]
sh = parts["shirt"]
uv = cyl_uv(sh, torso_center, v0=0.3, v1=1.0, ylo=BELT_Y - 0.08, yhi=J["neck_01"][1] + 0.02)
arm = ARMW[sh.src] > 0.35
for s, (a0, a1) in (("l", (0.0, 0.5)), ("r", (0.5, 1.0))):
    m = arm & ((sh.pos[:, 0] > 0) if s == "l" else (sh.pos[:, 0] < 0))
    A = J["upperarm_" + s]
    B = J["lowerarm_" + s]
    ax = (B - A) / np.linalg.norm(B - A)
    rel = sh.pos[m] - A
    t = rel @ ax
    perp = rel - np.outer(t, ax)
    ref = np.cross(ax, [0, 0, 1.0])
    ref /= np.linalg.norm(ref)
    ref2 = np.cross(ax, ref)
    ang = np.arctan2(perp @ ref2, perp @ ref)
    uv[m, 0] = a0 + ((ang / (2 * math.pi)) % 1.0) * (a1 - a0)
    uv[m, 1] = 0.28 - np.clip(t / np.linalg.norm(B - A) / 0.7, 0, 1) * 0.26
sh.uv = split_seam(sh, uv)
sh.recompute_normals = lambda: None

for key in ("pants", "pantsL"):
    pt = parts[key]
    # 脚ごとの円筒 (左脚 u 0..0.5, 右脚 0.5..1)
    uv = np.zeros((len(pt.pos), 2))
    for s, (a0, a1) in (("l", (0.0, 0.5)), ("r", (0.5, 1.0))):
        m = pt.pos[:, 0] >= 0 if s == "l" else pt.pos[:, 0] < 0
        cx = np.interp(pt.pos[m, 1], [J["calf_" + s][1], J["thigh_" + s][1]], [J["calf_" + s][0], J["thigh_" + s][0]])
        cz = np.interp(pt.pos[m, 1], [J["calf_" + s][1], J["thigh_" + s][1]], [J["calf_" + s][2], J["thigh_" + s][2]])
        ang = np.arctan2(pt.pos[m, 0] - cx, pt.pos[m, 2] - cz)
        uv[m, 0] = a0 + ((0.25 + ang / (2 * math.pi)) % 1.0) * (a1 - a0)
        uv[m, 1] = np.clip(pt.pos[m, 1] / (BELT_Y + 0.05), 0, 1)
    pt.uv = uv

# 肌 (顔・手) は アトラスに詰め直して焼き込む
SKIN_TEX = 1024


def uv_islands(part):
    # 同じ UV 番号を共有する三角形をつなぐ
    parent = list(range(len(part.uvtri)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    owner = {}
    for t, uvi in enumerate(part.uvtri):
        for u in uvi:
            if u in owner:
                ra, rb = find(owner[u]), find(t)
                if ra != rb:
                    parent[ra] = rb
            else:
                owner[u] = t
    groups = {}
    for t in range(len(part.uvtri)):
        groups.setdefault(find(t), []).append(t)
    return list(groups.values())


def pack_skin(partlist):
    """パーツごとの UV 島を 1 枚のアトラスに棚詰めする。"""
    isl = []
    for p in partlist:
        for g in uv_islands(p):
            uvs = np.array([VT[u] for t in g for u in p.uvtri[t]])
            lo, hi = uvs.min(0), uvs.max(0)
            area3 = 0
            for t in g:
                a, b, c = p.pos[p.tri[t]]
                area3 += np.linalg.norm(np.cross(b - a, c - a)) / 2
            area2 = 0
            for t in g:
                a, b, c = (VT[u] for u in p.uvtri[t])
                area2 += abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
            isl.append({"p": p, "tris": g, "lo": lo, "hi": hi, "a3": area3, "a2": max(area2, 1e-9)})
    # テクセル密度をそろえる (顔は 1.6 倍)
    tot = sum(i["a3"] * (2.5 if i["p"].name == "head" else 1.0) for i in isl)
    for i in isl:
        boost = 2.5 if i["p"].name == "head" else 1.0
        i["s"] = math.sqrt(i["a3"] * boost / tot * 0.62 / i["a2"])
        i["w"] = (i["hi"][0] - i["lo"][0]) * i["s"]
        i["h"] = (i["hi"][1] - i["lo"][1]) * i["s"]
    isl.sort(key=lambda i: -i["h"])
    pad = 4 / SKIN_TEX
    x = y = 0
    rowh = 0
    for i in isl:
        if x + i["w"] + pad > 1:
            x = 0
            y += rowh + pad
            rowh = 0
        i["ox"], i["oy"] = x, y
        x += i["w"] + pad
        rowh = max(rowh, i["h"])
    total_h = y + rowh
    k = 1 / max(1.0, total_h)
    # 各頂点 (三角形ごとに) の新しい UV
    for p in partlist:
        p._newuv = {}
    for i in isl:
        p = i["p"]
        for t in i["tris"]:
            for corner, u in enumerate(p.uvtri[t]):
                nu = ((VT[u] - i["lo"]) * i["s"] + [i["ox"], i["oy"]]) * k
                p._newuv[(t, corner)] = nu
    return k


k = pack_skin([parts["head"], parts["hands"]])
print("skin atlas fill scale", round(k, 3))


def split_by_uv(part):
    """三角形の角ごとの UV に合わせて頂点を分ける (UV 島の境目)。"""
    key = {}
    pos, nrm, W, uvs, mhuv, src = [], [], [], [], [], []
    morphs = [[] for _ in part.morphs]
    tri = []
    for t in range(len(part.tri)):
        ids = []
        for corner in range(3):
            vi = part.tri[t, corner]
            nu = part._newuv[(t, corner)]
            k = (vi, round(nu[0] * 8192), round(nu[1] * 8192))
            if k not in key:
                key[k] = len(pos)
                pos.append(part.pos[vi])
                nrm.append(part.nrm[vi])
                W.append(part.W[vi])
                uvs.append(nu)
                mhuv.append(VT[part.uvtri[t][corner]])
                src.append(part.src[vi])
                for m, (_, d) in enumerate(part.morphs):
                    morphs[m].append(d[vi])
            ids.append(key[k])
        tri.append(ids)
    part.pos = np.array(pos)
    part.nrm = np.array(nrm)
    part.W = np.array(W)
    part.uv = np.array(uvs)
    part.mhuv_v = np.array(mhuv)
    part.src = np.array(src)
    part.tri = np.array(tri, np.int64)
    part.morphs = [(n, np.array(m)) for (n, _), m in zip(part.morphs, morphs)]


split_by_uv(parts["head"])
split_by_uv(parts["hands"])
parts["head"].recompute_normals = lambda: None
parts["hands"].recompute_normals = lambda: None

# 帽子・ヘルメット・靴・ソックス・アンダーは単色 (UV は簡易)
for key in ("cap", "helmet", "socks", "under", "shoes"):
    p = parts[key]
    p.uv = np.stack([p.pos[:, 0] * 2 + 0.5, p.pos[:, 1] * 2], axis=1)


# ---------------------------------------------------------------- 肌テクスチャの焼き込み
def load_mask(name):
    im = Image.open(os.path.join(DATA, name)).convert("L")
    return np.asarray(im).astype(np.float32) / 255.0


MASKS = {k: load_mask("mpfb_" + k + ".jpg") for k in ("lips", "eyelids", "ears", "face", "fingernails")}


def sample_mask(m, uv):
    h, w = m.shape
    x = np.clip((uv[:, 0] * (w - 1)).astype(int), 0, w - 1)
    y = np.clip(((1 - uv[:, 1]) * (h - 1)).astype(int), 0, h - 1)
    return m[y, x]


def rasterize(parts_list, N):
    """各パーツの三角形を新 UV で塗り、画素ごとの 3D 位置・法線・MH UV・パーツ番号を返す。"""
    posb = np.zeros((N, N, 3), np.float32)
    nrmb = np.zeros((N, N, 3), np.float32)
    mhb = np.zeros((N, N, 2), np.float32)
    idb = np.full((N, N), -1, np.int16)
    for pi, p in enumerate(parts_list):
        for t in p.tri:
            uv = p.uv[t] * N
            mn = np.floor(uv.min(0)).astype(int)
            mx = np.ceil(uv.max(0)).astype(int)
            mn = np.clip(mn - 1, 0, N - 1)
            mx = np.clip(mx + 1, 0, N - 1)
            xs, ys = np.meshgrid(np.arange(mn[0], mx[0] + 1) + 0.5, np.arange(mn[1], mx[1] + 1) + 0.5)
            a, b, c = uv
            den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(den) < 1e-12:
                continue
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
            l3 = 1 - l1 - l2
            eps = -0.06
            inside = (l1 >= eps) & (l2 >= eps) & (l3 >= eps)
            if not inside.any():
                continue
            yy = ys[inside].astype(int)
            xx = xs[inside].astype(int)
            L = np.stack([l1[inside], l2[inside], l3[inside]], axis=1)
            L = np.clip(L, 0, None)
            L /= L.sum(axis=1, keepdims=True)
            posb[yy, xx] = L @ p.pos[t]
            nrmb[yy, xx] = L @ p.nrm[t]
            mhb[yy, xx] = L @ p.mhuv_v[t]
            idb[yy, xx] = pi
    return posb, nrmb, mhb, idb


def vnoise(p, scale, seed=0):
    """3D の値ノイズ (格子のハッシュを三線形補間)"""
    q = p * scale + seed * 17.13
    i = np.floor(q)
    f = q - i
    f = f * f * (3 - 2 * f)

    def h(ix, iy, iz):
        n = np.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453
        return n - np.floor(n)

    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                out = out + w * h(i[..., 0] + dx, i[..., 1] + dy, i[..., 2] + dz)
    return out


def fbm(p, scale, oct=4, seed=0):
    s = 0
    a = 0.5
    tot = 0
    for o in range(oct):
        s = s + a * vnoise(p, scale * (2 ** o), seed + o)
        tot += a
        a *= 0.5
    return s / tot


def bake_skin(variant="clean"):
    N = SKIN_TEX
    plist = [parts["head"], parts["hands"]]
    posb, nrmb, mhb, idb = rasterize(plist, N)
    valid = idb >= 0
    pos = posb[valid]
    mhuv = mhb[valid]
    hc = J["head"]
    eyeL = mh.joint_pos(P, VG, "joint-l-eye")
    eyeR = mh.joint_pos(P, VG, "joint-r-eye")
    mouth = mh.joint_pos(P, VG, "joint-mouth")
    rel = pos - hc
    base = np.array([0.80, 0.62, 0.52])  # 中間の肌色 (マテリアル色で人ごとに着色)
    col = np.tile(base, (len(pos), 1))
    # まだら・赤み
    n1 = fbm(pos, 30, 3, 1)[:, None]
    n2 = vnoise(pos, 260, 7)[:, None]
    col *= 0.94 + 0.12 * n1
    col *= 0.96 + 0.07 * n2
    face = rel[:, 2] > 0.02
    # 頬・鼻・耳の赤み
    cheek = np.exp(-(((np.abs(rel[:, 0]) - 0.045) / 0.025) ** 2 + ((rel[:, 1] - (eyeL[1] - hc[1] - 0.03)) / 0.025) ** 2)) * face
    nose = np.exp(-((rel[:, 0] / 0.012) ** 2 + ((rel[:, 1] - (eyeL[1] - hc[1] - 0.035)) / 0.02) ** 2)) * face
    red = np.clip(cheek * 0.5 + nose * 0.6 + sample_mask(MASKS["ears"], mhuv) * 0.45, 0, 1)[:, None]
    col = col * (1 - red * 0.18) + np.array([0.78, 0.44, 0.40]) * red * 0.18
    # 唇
    lips = sample_mask(MASKS["lips"], mhuv)[:, None]
    col = col * (1 - lips * 0.55) + np.array([0.66, 0.38, 0.36]) * lips * 0.55
    # まぶた (少し暗く) とまつげの線
    lid = sample_mask(MASKS["eyelids"], mhuv)[:, None]
    col *= 1 - lid * 0.12
    # 目の周り (眼窩) の陰り
    for e in (eyeL, eyeR):
        d = np.linalg.norm((pos - e) * [1, 1.3, 0.6], axis=1)
        sock = np.clip(1 - d / 0.03, 0, 1)[:, None] * face[:, None]
        col *= 1 - sock * 0.18
        # まつげ (上まぶたのふち)
        dl = np.abs((pos[:, 1] - (e[1] + 0.0065)) / 0.0018) + np.maximum(0, np.abs(pos[:, 0] - e[0]) - 0.013) / 0.002
        lash = np.clip(1 - dl, 0, 1) * (pos[:, 2] > e[2] - 0.004)
        col = col * (1 - lash[:, None] * 0.85) + np.array([0.08, 0.06, 0.05]) * lash[:, None] * 0.85
    # 眉毛
    hair_col = np.array([0.075, 0.06, 0.05])
    for e, s in ((eyeL, 1), (eyeR, -1)):
        u = (pos[:, 0] - e[0]) * s  # 外側が +
        browy = e[1] + 0.021 + 0.004 * np.clip(u / 0.02, -1, 1) - 0.006 * np.clip(u / 0.025, 0, 1) ** 2
        thick = 0.0042 * (1 - 0.45 * np.clip(u / 0.026, 0, 1))
        inb = (u > -0.017) & (u < 0.027) & (pos[:, 2] > e[2])
        d = np.abs(pos[:, 1] - browy) / thick
        strand = 0.55 + 0.45 * vnoise(pos * [1, 4, 1], 900, 3)
        brow = np.clip(1.2 - d, 0, 1) * inb * strand
        brow *= np.clip((u + 0.017) / 0.006, 0, 1)
        col = col * (1 - brow[:, None] * 0.9) + hair_col * brow[:, None] * 0.9
    # 髪 (短髪): 生え際より上・後ろ
    fy = eyeL[1] + 0.068 - hc[1]
    front = rel[:, 2]
    ear_y = eyeL[1] - hc[1] - 0.01
    side = np.abs(rel[:, 0])
    hairline = np.where(front > 0.03, fy + 0.012 * (side / 0.05) ** 2, np.where(front > -0.02, ear_y + 0.03 + (front + 0.02) * 0.6, ear_y - 0.045 - np.clip(-front - 0.02, 0, 0.06) * 0.6))
    # もみあげ
    sideburn = (front > -0.005) & (front < 0.03) & (side > 0.06) & (rel[:, 1] > ear_y - 0.02)
    hairline = np.where(sideburn, ear_y - 0.02, hairline)
    hd = (rel[:, 1] - hairline) / 0.006
    hairmask = np.clip(hd + 0.5, 0, 1) * (idb[valid] == 0)
    strands = 0.6 + 0.4 * vnoise(pos * [1, 2.5, 1], 700, 11)
    hairmask = hairmask * np.clip(strands + 0.25, 0, 1)
    col = col * (1 - hairmask[:, None] * 0.93) + hair_col * 1.15 * hairmask[:, None] * 0.93
    # ひげ
    if variant in ("stubble", "beard"):
        jaw = (rel[:, 1] < (mouth[1] - hc[1]) + 0.012) & (front > -0.01)
        upper = (rel[:, 1] < (mouth[1] - hc[1]) + 0.022) & (rel[:, 1] > (mouth[1] - hc[1]) + 0.006) & (side < 0.022) & (front > 0.06)
        area = (jaw | upper) & (idb[valid] == 0) & (rel[:, 1] > (mouth[1] - hc[1]) - 0.075)
        k = 0.28 if variant == "stubble" else 0.75
        dots = vnoise(pos, 1400, 21)
        beard = area * (0.5 + 0.5 * dots) * k
        beard *= 1 - lips[:, 0]
        col = col * (1 - beard[:, None]) + hair_col * beard[:, None]
    # 爪
    nails = sample_mask(MASKS["fingernails"], mhuv)[:, None]
    col = col * (1 - nails * 0.5) + np.array([0.92, 0.78, 0.74]) * nails * 0.5
    img = np.zeros((N, N, 3), np.float32)
    img[valid] = np.clip(col, 0, 1)
    # すき間を埋める (島の外側へにじませる)
    filled = valid.copy()
    for _ in range(8):
        im = Image.fromarray((img * 255).astype(np.uint8))
        bl = np.asarray(im.filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
        img = np.where(filled[..., None], img, bl)
        filled = filled | (np.asarray(Image.fromarray(filled.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0)
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).transpose(Image.FLIP_TOP_BOTTOM)
    return out, hairmask


os.makedirs(OUT, exist_ok=True)
for variant in ("clean", "stubble", "beard"):
    im, _ = bake_skin(variant)
    im.save(os.path.join(OUT, f"player_skin_{variant}.jpg"), quality=88)
Image.open(os.path.join(DATA, "brown_eye.png")).convert("RGB").resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "player_eye.jpg"), quality=90)


# ---------------------------------------------------------------- 書き出し
class Bin:
    def __init__(self):
        self.buf = bytearray()

    def add(self, arr, dtype):
        while len(self.buf) % 4:
            self.buf.append(0)
        off = len(self.buf)
        a = np.ascontiguousarray(arr, dtype=dtype)
        self.buf += a.tobytes()
        return off


binf = Bin()
meshes = []
for key, p in parts.items():
    n = len(p.pos)
    idx, w = top4(p.W.astype(np.float32))
    entry = {
        "name": key,
        "mat": p.mat,
        "count": n,
        "position": binf.add(p.pos.astype(np.float32), np.float32),
        "normal": binf.add(np.clip(p.nrm * 32767, -32767, 32767).astype(np.int16), np.int16),
        "skinIndex": binf.add(idx, np.uint8),
        "skinWeight": binf.add(np.round(w * 255).astype(np.uint8), np.uint8),
    }
    if p.uv is not None:
        entry["uv"] = binf.add(p.uv.astype(np.float32), np.float32)
    if p.color is not None:
        entry["color"] = binf.add((np.clip(p.color, 0, 1) * 255).astype(np.uint8), np.uint8)
    tri = p.tri.astype(np.uint16 if n < 65536 else np.uint32)
    entry["index"] = binf.add(tri, tri.dtype)
    entry["indexCount"] = int(tri.size)
    entry["index32"] = n >= 65536
    if p.morphs:
        mx = max(float(np.abs(d).max()) for _, d in p.morphs) or 1
        entry["morphScale"] = mx
        entry["morphs"] = []
        for mname, d in p.morphs:
            q = np.round(d / mx * 32767).astype(np.int16)
            entry["morphs"].append({"name": mname, "offset": binf.add(q, np.int16)})
    meshes.append(entry)

# リグの補助情報 (腕・脚の曲がる軸、手のひらの向き)
extra = {}
for s in ("l", "r"):
    sh_ = J["upperarm_" + s]
    el = J["lowerarm_" + s]
    wr = J["hand_" + s]
    extra["arm_" + s] = {"shoulder": sh_.tolist(), "elbow": el.tolist(), "wrist": wr.tolist()}
    hp = J["hand_" + s]
    mid = J["middle_01_" + s]
    idx_ = J["index_01_" + s]
    pk = J["pinky_01_" + s]
    th = J["thumb_02_" + s]
    nrm = np.cross(idx_ - pk, mid - hp)
    nrm /= np.linalg.norm(nrm)
    if np.dot(th - hp, nrm) < 0:
        nrm = -nrm
    extra["palm_" + s] = nrm.tolist()
extra["eyeL"] = mh.joint_pos(P, VG, "joint-l-eye").tolist()
extra["eyeR"] = mh.joint_pos(P, VG, "joint-r-eye").tolist()
extra["beltY"] = float(BELT_Y)
extra["headTop"] = float(P[parts["head"].src][:, 1].max()) if parts["head"].src is not None else 1.8

manifest = {
    "version": 1,
    "license": "Body mesh, targets, rig, weights and eye texture: MakeHuman (CC0). Built by tools/human/build_player.py",
    "bones": [{"name": b["name"], "parent": b["pi"], "pos": [round(float(x), 5) for x in b["pos"]], "tail": [round(float(x), 5) for x in tail_of(b["name"])]} for b in BONES],
    "meshes": meshes,
    "extra": extra,
    "skins": ["player_skin_clean.jpg", "player_skin_stubble.jpg", "player_skin_beard.jpg"],
    "eye": "player_eye.jpg",
}
open(os.path.join(OUT, "player.bin"), "wb").write(bytes(binf.buf))
json.dump(manifest, open(os.path.join(OUT, "player.json"), "w"), ensure_ascii=False)
print("bin", len(binf.buf), "bytes")
for m in meshes:
    print(m["name"], m["count"], m["indexCount"] // 3, len(m.get("morphs", [])))
