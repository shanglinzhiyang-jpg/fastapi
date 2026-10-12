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
OUT = os.environ.get("PB_MODEL_OUT") or os.path.join(ROOT, "static", "models")  # 試し書きは PB_MODEL_OUT=dir
DATA = os.path.join(mh.SRC, "data")
SCALE = 0.1  # dm → m

V0, VT, F = mh.load_obj()
VG = mh.vgroups()
RIG = mh.rig()
WRAW = mh.weights()


# ---------------------------------------------------------------- 体型
def shaped(muscle=0.55, weight=0.5, height=0.62, proportions=0.85, race=None, extra=None):
    # 筋肉 0.55 / 体重 0.5: 引き締まった野球選手の体 (以前の 0.7/0.55 は肩・胸がふくらみすぎた)
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
        elif FOOTW[vi].mean() <= 0.3:
            # 足首の面 (ふくらはぎの重みが小さく足の重みが大きい) はパンツにしない (靴の中に入っていた 8 枚の三角形)
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
    if "collar" in tags:
        # 襟ぐり: 後ろは首の付け根、前は鎖骨の間まで下がる
        nk = J["neck_01"]
        front = np.clip((c[2] - nk[2]) / 0.07, 0, 1)
        if c[1] < nk[1] - 0.004 - 0.07 * front:
            tags.add("shirt")
        else:
            tags.discard("shirt")
    if "foot" in tags and "socks" not in tags and fw < 0.85:
        tags.add("socks")
    return tags


TAGS = [classify(f) for f in BODYF]

# 首の付け根: 襟ぐりのすき間から背景が見えないよう、肌を襟の内側 3.5cm まで延ばす (シャツの下に隠れる)
NK = J["neck_01"]


def neckline_y(c):
    front = np.clip((c[2] - NK[2]) / 0.07, 0, 1)
    return NK[1] - 0.004 - 0.07 * front


for _f, _t in zip(BODYF, TAGS):
    if _t & {"head", "hand", "sleeve", "under"}:
        continue
    _c = face_center(_f)
    if ARMW[_f[0]].mean() < 0.3 and neckline_y(_c) - 0.035 < _c[1] < NK[1] + 0.08:
        _t.add("neckfill")


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

    def smooth_boundary(self, iters=6, k=0.5):
        """縁 (襟・袖口・裾) の頂点を、縁に沿って隣り合う頂点の平均へ寄せる (ギザギザを取る)。"""
        from collections import Counter, defaultdict

        e = Counter()
        for a, b, c in self.tri:
            for u, v in ((a, b), (b, c), (c, a)):
                e[(min(u, v), max(u, v))] += 1
        nb = defaultdict(list)
        for (u, v), n in e.items():
            if n == 1:
                nb[u].append(v)
                nb[v].append(u)
        idx = np.array(sorted(nb), np.int64)
        for _ in range(iters):
            avg = np.array([self.pos[nb[i]].mean(axis=0) for i in idx])
            self.pos[idx] += (avg - self.pos[idx]) * k

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
head = Part("head", faces_with("head", "neckfill"), "skin")
parts["head"] = head
# 手
hands = Part("hands", faces_with("hand"), "skin")
parts["hands"] = hands

# シャツ (胴体と半袖)
shirt = Part("shirt", faces_with("shirt"), "shirt")
y = shirt.pos[:, 1]
# 2004 年のユニフォームはゆったりめ (以前の 1.4 cm は体に貼り付いて見えた)
off = np.full(len(shirt.pos), 0.020)
# 腹まわり・背中はゆったり (ただしベルトの近くはパンツの内側に収める)
off += np.clip((J["spine_03"][1] - y) / 0.25, 0, 1) * 0.016 * np.clip((y - BELT_Y) / 0.08, 0, 1)
off -= np.clip((BELT_Y + 0.03 - y) / 0.06, 0, 1) * 0.008
off += np.clip((y - (J["spine_03"][1] + 0.05)) / 0.2, 0, 1) * 0.002
# 袖は少しゆったり (肩・上腕を風船のようにふくらませない)
armness = ARMW[shirt.src]
off += armness * 0.007
# 肩の上 (鎖骨の高さより上の外側) は体に沿わせる
_shoulder = np.clip((y - J["clavicle_l"][1] + 0.02) / 0.06, 0, 1) * np.clip((np.abs(shirt.pos[:, 0]) - 0.1) / 0.08, 0, 1)
off -= _shoulder * 0.005
# 首まわりは詰める
off -= HEADW[shirt.src] * 0.006
shirt.inflate(off)
shirt.smooth(iters=10)
shirt.smooth_boundary(12)
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
    # 2004 年のパンツはゆったりめ (以前の 2.1 cm はレギンスのように見えた)
    off = np.full(len(pt.pos), 0.024)
    lw = LEGW[pt.src]
    off += lw * 0.012
    # 股の内側はふくらませて段差をなくす (大きすぎると股がふくらんで見える)
    inner = np.clip(1 - np.abs(pt.pos[:, 0]) / 0.07, 0, 1) * np.clip(1 - np.abs(pt.pos[:, 1] - (J["pelvis"][1] - 0.08)) / 0.12, 0, 1)
    off += inner * 0.008
    # 膝下は少し絞る (ショート丈は裾がふくらむ)
    off -= CALFW[pt.src] * (0.004 if key == "pants" else 0.01)
    # 腰まわりはシャツの外側に (ベルトで締めた分だけ)
    off += np.clip(1 - abs(y - BELT_Y) / 0.06, 0, 1) * 0.004
    # お尻は丸みをならす
    back = np.clip(-(pt.pos[:, 2] - J["pelvis"][2]) / 0.08, 0, 1) * np.clip(1 - abs(y - (J["pelvis"][1] - 0.05)) / 0.15, 0, 1)
    off += back * 0.012
    pt.inflate(off)
    pt.smooth(iters=24)
    # 股: 脚の付け根のくぼみ (前から見ると V 字のふくらみ) を、股のまわりだけ強くならして消す
    crotch = np.clip(1 - np.abs(pt.pos[:, 0]) / 0.085, 0, 1) * np.clip(1 - np.abs(pt.pos[:, 1] - (J["pelvis"][1] - 0.10)) / 0.12, 0, 1)
    pt.smooth(iters=30, fix_boundary=False, mask=crotch)
    ensure_outside(pt, 0.01)
    if key == "pantsL":
        # 長いパンツは膝からまっすぐ落ちる (すねに沿わせない)。膝の高さの太さから裾へ 12% だけ細く
        for s_, sx in (("l", 1), ("r", -1)):
            kn, ft = J["calf_" + s_], J["foot_" + s_]
            m = pt.pos[:, 0] * sx > 0
            cx = np.interp(pt.pos[:, 1], [ft[1], kn[1]], [ft[0], kn[0]])
            cz = np.interp(pt.pos[:, 1], [ft[1], kn[1]], [ft[2], kn[2]])
            dx, dz = pt.pos[:, 0] - cx, pt.pos[:, 2] - cz
            r = np.hypot(dx, dz)
            Rk = r[m & (np.abs(pt.pos[:, 1] - kn[1]) < 0.01)].mean()
            tgt = Rk * (1 - 0.12 * (kn[1] - pt.pos[:, 1]) / kn[1])
            k = np.where(m & (pt.pos[:, 1] < kn[1]), np.maximum(r, tgt) / np.maximum(r, 1e-6), 1.0)
            pt.pos[:, 0] = cx + dx * k
            pt.pos[:, 2] = cz + dz * k
        # 膝のつなぎ目をならす
        knee = np.clip(1 - np.abs(pt.pos[:, 1] - J["calf_l"][1]) / 0.12, 0, 1)
        pt.smooth(iters=6, mask=knee)
    pt.smooth_boundary(8)
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


# ---------------------------------------------------------------- 襟の縁 (首まわりを折り返した細い帯)
def boundary_loops(part):
    from collections import Counter, defaultdict

    e = Counter()
    for a, b, c in part.tri:
        for u, v in ((a, b), (b, c), (c, a)):
            e[(min(u, v), max(u, v))] += 1
    nb = defaultdict(list)
    for (u, v), n in e.items():
        if n == 1:
            nb[u].append(v)
            nb[v].append(u)
    seen = set()
    loops = []
    for s in nb:
        if s in seen:
            continue
        loop = [s]
        seen.add(s)
        prev, cur = None, s
        while True:
            nxt = [w for w in nb[cur] if w != prev and w not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur)
            seen.add(cur)
        loops.append(np.array(loop, np.int64))
    return loops


def closest_on_tris(q, A, B, C):
    """点 q に最も近い三角形 (A,B,C は (n,3)) 上の点と、その三角形の番号"""
    best = None
    ab, ac = B - A, C - A
    n = np.cross(ab, ac)
    nn = np.maximum((n * n).sum(1), 1e-20)
    d = ((q - A) * n).sum(1) / nn
    p = q - n * d[:, None]
    # 平面上の重心座標
    v0, v1, v2 = ab, ac, p - A
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = np.maximum(d00 * d11 - d01 * d01, 1e-20)
    bv = (d11 * d20 - d01 * d21) / den
    bw = (d00 * d21 - d01 * d20) / den
    inside = (bv >= 0) & (bw >= 0) & (bv + bw <= 1)
    cand = np.where(inside[:, None], p, A)
    dist = np.where(inside, np.linalg.norm(q - p, axis=1), np.inf)

    def seg(P0, P1):
        dd = P1 - P0
        t = np.clip(((q - P0) * dd).sum(1) / np.maximum((dd * dd).sum(1), 1e-20), 0, 1)
        return P0 + dd * t[:, None]

    for P0, P1 in ((A, B), (B, C), (C, A)):
        s = seg(P0, P1)
        ds = np.linalg.norm(q - s, axis=1)
        better = ds < dist
        cand = np.where(better[:, None], s, cand)
        dist = np.where(better, ds, dist)
    k = int(np.argmin(dist))
    best = (cand[k], k)
    return best


def collar_band(part, N=64):
    """シャツの襟ぐりの縁 (いちばん高い位置にある縁の輪) をならし、表 → 縁 → 裏へ折り返す帯を作る。"""
    loops = boundary_loops(part)
    loop = max(loops, key=lambda L: part.pos[L, 1].mean() if len(L) > 8 else -9)
    L = part.pos[loop].copy()
    Nn = part.nrm[loop].copy()
    Wl = part.W[loop].copy()
    Sl = part.src[loop].copy()
    # 輪に沿ってならす (縮まないよう λ|μ を交互に)
    for _ in range(6):
        for k in (0.5, -0.53):
            L += (0.5 * (np.roll(L, 1, 0) + np.roll(L, -1, 0)) - L) * k
    # 弧長で等間隔に取り直す
    seg = np.linalg.norm(np.roll(L, -1, 0) - L, axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    tot = cum[-1]
    Lc = np.vstack([L, L[:1]])
    Nc = np.vstack([Nn, Nn[:1]])
    Wc = np.vstack([Wl, Wl[:1]])
    ts = np.arange(N) / N * tot
    j = np.clip(np.searchsorted(cum, ts, side="right") - 1, 0, len(L) - 1)
    f = ((ts - cum[j]) / np.maximum(seg[j], 1e-9))[:, None]
    Pp = Lc[j] * (1 - f) + Lc[j + 1] * f
    Np = Nc[j] * (1 - f) + Nc[j + 1] * f
    Np /= np.linalg.norm(Np, axis=1, keepdims=True)
    Wp = Wc[j] * (1 - f) + Wc[j + 1] * f
    Sp = Sl[np.where(f[:, 0] < 0.5, j, (j + 1) % len(L))]
    # 縁の法線はばらつくので、輪に沿ってならす
    for _ in range(8):
        Np = 0.5 * Np + 0.25 * (np.roll(Np, 1, 0) + np.roll(Np, -1, 0))
        Np /= np.linalg.norm(Np, axis=1, keepdims=True)
    Tg = np.roll(Pp, -1, 0) - np.roll(Pp, 1, 0)
    Tg /= np.linalg.norm(Tg, axis=1, keepdims=True)
    Bn = np.cross(Np, Tg)
    Bn /= np.linalg.norm(Bn, axis=1, keepdims=True)
    # Bn は穴から離れる (シャツの上へ向かう) 向きにそろえる
    cen = Pp.mean(axis=0)
    away = ((Pp - cen)[:, [0, 2]] * Bn[:, [0, 2]]).sum(1)
    if (away > 0).sum() < N / 2:
        Bn = -Bn
    # 近くの三角形 (表面への投影用)
    tc = part.pos[part.tri].mean(axis=1)
    near = np.where(np.min(np.linalg.norm(tc[:, None, :] - Pp[None, ::4, :], axis=2), axis=1) < 0.06)[0]
    TA, TB, TC = (part.pos[part.tri[near, k]] for k in range(3))
    fn = np.cross(TB - TA, TC - TA)
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)

    def on_surface(q, nref, h):
        """表面上の最も近い点 (+ 法線方向に h) と、その点の重み (三角形の頂点の重みを重心座標で補間)"""
        p, k = closest_on_tris(q, TA, TB, TC)
        n = fn[k] if np.dot(fn[k], nref) > 0 else -fn[k]
        n = n * 0.6 + nref * 0.4
        a, b, c = TA[k], TB[k], TC[k]
        v0, v1, v2 = b - a, c - a, p - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = max(d00 * d11 - d01 * d01, 1e-20)
        bv = (d11 * d20 - d01 * d21) / den
        bw = (d00 * d21 - d01 * d20) / den
        bc = np.clip([1 - bv - bw, bv, bw], 0, 1)
        bc /= bc.sum()
        t = part.tri[near[k]]
        w = bc[0] * part.W[t[0]] + bc[1] * part.W[t[1]] + bc[2] * part.W[t[2]]
        return p + n / np.linalg.norm(n) * h, w

    # 断面 (s: 縁から布の上へ, h: 表面からの高さ)。表の端 → 表 → 縁の上 → 縁の下 → 裏 → 裏の端
    prof = [(0.012, 0.0012, True), (0.0045, 0.0024, True), (-0.0008, 0.0016, False), (-0.0008, -0.0022, False), (0.0045, -0.0032, True), (0.012, -0.0036, True)]
    rows = []
    wrows = []
    for s, h, proj in prof:
        row = []
        wrow = []
        for i in range(N):
            q = Pp[i] + Bn[i] * s
            if proj:
                # 表面に沿う点は、その下の布と同じように動くよう布の重みを使う (ずれて布に埋もれないように)
                pt, w = on_surface(q, Np[i], h)
                row.append(pt)
                wrow.append(w)
            else:
                row.append(q + Np[i] * h)
                wrow.append(Wp[i])
        row = np.array(row)
        wrows.append(np.array(wrow))
        # 表面へ寄せた点は三角形の境で飛ぶので、輪に沿ってならす
        for _ in range(8):
            for k in (0.5, -0.53):
                row += (0.5 * (np.roll(row, 1, 0) + np.roll(row, -1, 0)) - row) * k
        rows.append(row)
    # 断面の弧長 (テクスチャの帯の位置)
    plen = [0.0]
    for k in range(1, len(prof)):
        plen.append(plen[-1] + float(np.median(np.linalg.norm(rows[k] - rows[k - 1], axis=1))))
    edge = (plen[2] + plen[3]) / 2
    pos = np.vstack(rows + [rows[k][:1] for k in range(len(prof))])  # 継ぎ目用に先頭の列を複製
    nr = len(prof)
    idx = lambda k, i: k * N + i if i < N else nr * N + k  # noqa: E731
    tri = []
    for k in range(nr - 1):
        for i in range(N):
            a, b, c, d = idx(k, i), idx(k, i + 1), idx(k + 1, i + 1), idx(k + 1, i)
            tri += [[a, b, c], [a, c, d]]
    tri = np.array(tri, np.int64)
    nrm = vnormals(pos, tri)
    # 表の面の法線は外 (シャツの法線と同じ向き) へ
    if (nrm[:N] * Np).sum(1).mean() < 0:
        tri = tri[:, [0, 2, 1]]
        nrm = vnormals(pos, tri)
    # 継ぎ目の法線をそろえる
    for k in range(nr):
        a, b = k * N, nr * N + k
        m = nrm[a] + nrm[b]
        nrm[a] = nrm[b] = m / max(np.linalg.norm(m), 1e-9)
    W = np.vstack(wrows + [wr[:1] for wr in wrows])
    src = np.concatenate([Sp] * nr + [Sp[:1]] * nr)
    ucol = np.concatenate([np.tile(np.arange(N) / N, nr), np.ones(nr)])
    print("collar band: loop %d verts, length %.3f m, profile %s mm" % (len(loop), tot, [round(x * 1000, 1) for x in plen]))
    return {"pos": pos, "nrm": nrm, "W": W, "src": src, "tri": tri, "ucol": ucol, "plen": plen, "edge": edge, "nr": nr, "N": N}


COLLAR = collar_band(parts["shirt"])


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


def lift_crown(cp, edge_y):
    """帽子の前の上を持ち上げて、つばから約 10 cm の高いクラウンにする (頭にぴったりの形は浅いニット帽に見えた)。
    edge_y: 前の縁の高さ (頭の骨から)"""
    rel = cp.pos - J["head"]
    top = rel[:, 1].max()
    front = np.clip((rel[:, 2] + 0.02) / 0.10, 0, 1)
    elev = np.clip((rel[:, 1] - edge_y) / (top - edge_y), 0, 1) ** 0.7
    cp.pos[:, 1] += 0.034 * front**1.5 * elev + 0.012 * elev * (1 - front)
    cp.smooth(iters=8, fix_boundary=True)
    cp.recompute_normals()


EYE_Y = mh.joint_pos(P, VG, "joint-l-eye")[1]
HEAD_Y = J["head"][1]
parts["cap"] = cap_part("cap", 0.011, EYE_Y - HEAD_Y + 0.052, EYE_Y - HEAD_Y + 0.0, "cap")
lift_crown(parts["cap"], EYE_Y - HEAD_Y + 0.052)
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
        # 角膜 (透明な膜) はテクスチャの右下の青い円を使う → 不透明で描くと白目に見えるので除く
        uvs_f = [vts[ti] for _, ti in f if ti >= 0]
        if uvs_f and all(u > 0.8 and v < 0.2 for u, v in uvs_f):
            continue
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


def joints_of(Pm):
    out = np.zeros((len(BONES), 3))
    for n, i in BI.items():
        h = RIG[n]["head"]
        out[i] = mh.joint_pos(Pm, VG, h["cube_name"]) if h.get("strategy") == "CUBE" else Pm[h["vertex_indices"]].mean(axis=0)
    return out


# 体型の違い (人種のターゲットは身長・首の長さも変える) で骨ごと動く分は差し引き、顔の形の違いだけを残す。
# 残さないと頭だけが 12〜18cm 浮き上がり、目やヘルメット (骨に付いている) とずれる。
_J0 = joints_of(P)
_WN = WD / np.maximum(WD.sum(axis=1, keepdims=True), 1e-6)
for key, Vx in ETH.items():
    Q = to_m(Vx)
    d = Q - P
    d = d - _WN @ (joints_of(Q) - _J0)
    # 頭以外は差分を消す (体格は共通)
    d = d * np.clip((HEADW[:, None] - 0.3) / 0.4, 0, 1)
    print(key, "face-only delta max %.4f m" % float(np.abs(d[head.src]).max()))
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


def section_axis(part, y_lo, y_hi, step=0.01):
    """胴体の円筒の軸: 高さ 1 cm ごとの断面 (腕を除いた中央部) の前後の中点。抜けた高さは補間し、5 点の移動平均でならす。
    (以前は骨の z をつないだ線で、体の 5〜6 cm 後ろにあった → u 0 / 0.5 が本当の脇ではなく、前身頃 57 cm・後ろ 30 cm になっていた)"""
    ys = np.arange(y_lo, y_hi + step, step)
    zc = np.full(len(ys), np.nan)
    for k, yy in enumerate(ys):
        sel = (np.abs(part.pos[:, 1] - yy) < step) & (np.abs(part.pos[:, 0]) < 0.12) & (ARMW[part.src] < 0.3)
        if sel.sum() > 6:
            zc[k] = 0.5 * (part.pos[sel, 2].min() + part.pos[sel, 2].max())
    ok = ~np.isnan(zc)
    zc = np.interp(ys, ys[ok], zc[ok])
    zc = np.convolve(np.pad(zc, 2, mode="edge"), np.ones(5) / 5, mode="valid")
    return ys, zc


def torso_center(pos):
    return np.zeros(len(pos)), np.interp(pos[:, 1], *_AX)


# シャツ: 胴体は テクスチャ上部 [0,1]x[0.3,1]、袖は下部 (左 [0,0.5], 右 [0.5,1]) x [0,0.28]
def corner_split(part, cuv):
    """三角形の角ごとの UV (ntri,3,2) に合わせて頂点を複製する。"""
    key = {}
    pos, nrm, W, uvs, src, col = [], [], [], [], [], []
    morphs = [[] for _ in part.morphs]
    tri = []
    for t in range(len(part.tri)):
        ids = []
        for c in range(3):
            vi = part.tri[t, c]
            u = cuv[t, c]
            k = (vi, round(float(u[0]) * 4096), round(float(u[1]) * 4096))
            if k not in key:
                key[k] = len(pos)
                pos.append(part.pos[vi])
                nrm.append(part.nrm[vi])
                W.append(part.W[vi])
                uvs.append(u)
                if part.src is not None:
                    src.append(part.src[vi])
                if part.color is not None:
                    col.append(part.color[vi])
                for m, (_, d) in enumerate(part.morphs):
                    morphs[m].append(d[vi])
            ids.append(key[k])
        tri.append(ids)
    part.pos = np.array(pos)
    part.nrm = np.array(nrm)
    part.W = np.array(W)
    part.uv = np.array(uvs)
    part.tri = np.array(tri, np.int64)
    if src:
        part.src = np.array(src)
    if col:
        part.color = np.array(col)
    part.morphs = [(n, np.array(m)) for (n, _), m in zip(part.morphs, morphs)]


sh = parts["shirt"]
_AX = section_axis(sh, BELT_Y - 0.08, J["neck_01"][1] + 0.02)
torso_uv = cyl_uv(sh, torso_center, v0=0.3, v1=1.0, ylo=BELT_Y - 0.08, yhi=J["neck_01"][1] + 0.02)
# 袖の三角形: 肩の付け根の面 (腕の軸を少し上へ傾けた法線、肩の関節の 1.5 cm 内側を通る) より外で、腕の重みのある所。
# 以前は腕の重み > 0.35 の頂点で分けていたので、袖と胴の境がギザギザだった
_tc = sh.pos[sh.tri].mean(axis=1)
_tarm = ARMW[sh.src][sh.tri].mean(axis=1)
sleeve_tri = np.zeros(len(sh.tri), bool)
for s_, sx in (("l", 1.0), ("r", -1.0)):
    A = J["upperarm_" + s_]
    ax = (J["lowerarm_" + s_] - A) / np.linalg.norm(J["lowerarm_" + s_] - A)
    nA = ax + np.array([0, 0.25, 0])
    nA /= np.linalg.norm(nA)
    S0 = A + np.array([-0.015 * sx, 0, 0])
    sleeve_tri |= (_tc[:, 0] * sx > 0) & ((_tc - S0) @ nA > 0) & (_tarm > 0.12)
# 袖の UV: 腕のまわり (継ぎ目は脇の下) × 腕に沿った長さ。肩の上 (関節より内側) から袖口までを v 0.272 → 0.025 に (以前は肩の上を v 0.28 の 1 行に詰めていた)
SLEEVE_TOP = 0.272
sleeve_uv = {}
_sv = []
for s_, (a0, a1) in (("l", (0.0, 0.5)), ("r", (0.5, 1.0))):
    A = J["upperarm_" + s_]
    B = J["lowerarm_" + s_]
    L = np.linalg.norm(B - A)
    ax = (B - A) / L
    rel = sh.pos - A
    t = rel @ ax
    perp = rel - np.outer(t, ax)
    # 継ぎ目は脇の下 (体の内側・下向き) に置く
    ref = np.cross(ax, [0, 0, 1.0])
    ref /= np.linalg.norm(ref)
    ref2 = np.cross(ax, ref)
    ang = np.arctan2(perp @ ref2, perp @ ref)
    lu = (ang / (2 * math.pi)) % 1.0
    mine = sleeve_tri & ((_tc[:, 0] > 0) == (s_ == "l"))
    sv_ = np.unique(sh.tri[mine])
    tmin = t[sv_].min()
    lv = SLEEVE_TOP - np.clip((t - tmin) / (0.7 * L - tmin), 0, 1) * 0.247
    sleeve_uv[s_] = (lu, lv, a0, a1)
    _sv.append((SLEEVE_TOP - (0 - tmin) / (0.7 * L - tmin) * 0.247, lv[sv_].min(), tmin))
SLEEVE_V = {"top": SLEEVE_TOP, "shoulder": round(float(np.mean([a for a, _, _ in _sv])), 4), "cuff": round(float(np.mean([b for _, b, _ in _sv])), 4)}
print("sleeve v", SLEEVE_V, "tmin", [round(float(c_), 3) for _, _, c_ in _sv], "sleeve tris", int(sleeve_tri.sum()))
cuv = np.zeros((len(sh.tri), 3, 2))
for ti, tri in enumerate(sh.tri):
    side = "l" if sh.pos[tri, 0].mean() > 0 else "r"
    if sleeve_tri[ti]:
        lu, lv, a0, a1 = sleeve_uv[side]
        us = lu[tri].copy()
        if us.max() - us.min() > 0.5:
            us = np.where(us < 0.5, 1.0, us)
        cuv[ti, :, 0] = a0 + us * (a1 - a0)
        cuv[ti, :, 1] = lv[tri]
    else:
        us = torso_uv[tri, 0].copy()
        if us.max() - us.min() > 0.5:
            us = np.where(us < 0.5, us + 1.0, us)
        cuv[ti, :, 0] = us
        cuv[ti, :, 1] = torso_uv[tri, 1]
corner_split(sh, cuv)
sh.recompute_normals = lambda: None
# 襟ぐりの UV (前立ての位置を決めるため): シャツの縁のうち首まわりの頂点
_bv = sh.boundary()
COLLAR_UV = [sh.uv[i].tolist() for i in _bv if sh.pos[i, 1] > J["spine_03"][1] + 0.12 and ARMW[sh.src[i]] < 0.3 and abs(sh.pos[i, 0]) < 0.1 and abs(sh.pos[i, 2] - NK[2]) < 0.12]
COLLAR_UV.sort(key=lambda t: t[0])
# 襟の帯をシャツに足す。テクスチャはパンツに隠れる裾の下 (v 0.283〜) に横じまの帯として描く
_ylo = BELT_Y - 0.08
_yhi = J["neck_01"][1] + 0.02
VB_OUT = 0.3 + 0.7 * (0.025 / (_yhi - _ylo))  # 裾から 2.5cm (ベルトより 5.5cm 下: 必ずパンツの中)
VB_IN = 0.283
_c = COLLAR
_vrow = [VB_OUT + (VB_IN - VB_OUT) * (l / _c["plen"][-1]) for l in _c["plen"]]
_vv = np.concatenate([np.repeat(_vrow, _c["N"]), _vrow])
_uv = np.stack([0.02 + 0.96 * _c["ucol"], _vv], axis=1)
_n0 = len(sh.pos)
sh.pos = np.vstack([sh.pos, _c["pos"]])
sh.nrm = np.vstack([sh.nrm, _c["nrm"]])
sh.W = np.vstack([sh.W, _c["W"]])
sh.uv = np.vstack([sh.uv, _uv])
sh.src = np.concatenate([sh.src, _c["src"]])
sh.tri = np.vstack([sh.tri, _c["tri"] + _n0])
COLLAR_BAND = {"vOut": round(VB_OUT, 5), "vIn": VB_IN, "vEdge": round(VB_OUT + (VB_IN - VB_OUT) * _c["edge"] / _c["plen"][-1], 5), "mmOut": round(_c["edge"] * 1000, 2), "mmIn": round((_c["plen"][-1] - _c["edge"]) * 1000, 2)}
print("collar band uv", COLLAR_BAND)


# 胴体のテクスチャの行 (v) ごとに、u → 布の上の距離 (m) の表を作る。
# 円筒 UV は角度で u を切るので、正面の中央と脇とで 1 u あたりの長さが違う。
# 胸マーク・番号を実寸で描く (human.js の jerseyTexture) ために使う
def torso_arc(part, rows, nb=64):
    uv, pos, tri = part.uv, part.pos, part.tri
    out = []
    for v0 in rows:
        dens = np.zeros(nb)
        for a, b, c in tri:
            pts = []
            for i, j in ((a, b), (b, c), (c, a)):
                vi, vj = uv[i, 1], uv[j, 1]
                if (vi - v0) * (vj - v0) < 0:
                    t = (v0 - vi) / (vj - vi)
                    pts.append((uv[i, 0] + t * (uv[j, 0] - uv[i, 0]), pos[i] + t * (pos[j] - pos[i])))
            if len(pts) != 2:
                continue
            (u1, p1), (u2, p2) = pts
            if u2 < u1:
                u1, u2 = u2, u1
            if u2 - u1 < 1e-9 or u2 - u1 > 0.5:
                continue
            seg = float(np.linalg.norm(p1 - p2))
            for k in range(int(u1 * nb), int(u2 * nb) + 1):
                lo = max(u1, k / nb)
                hi = min(u2, (k + 1) / nb)
                if hi > lo:
                    dens[k % nb] += seg * (hi - lo) / (u2 - u1)
        s = np.concatenate([[0.0], np.cumsum(dens)])
        out.append([round(float(x), 4) for x in s])
    return out


# 首の近く (肩の首の付け根・背ネームの上) まで実寸で引けるよう、0.95 の上にも 3 行
_ROWS = [round(0.4 + 0.05 * k, 2) for k in range(12)] + [0.965, 0.98, 0.99]
TORSO_ARC = {"v": _ROWS, "y": [round(float(_ylo), 4), round(float(_yhi), 4)], "s": torso_arc(sh, _ROWS)}
print("torso arc (m) at v", _ROWS[6], "circumference %.3f, front centre %.3f" % (TORSO_ARC["s"][6][-1], TORSO_ARC["s"][6][16]))

for key in ("pants", "pantsL"):
    pt = parts[key]
    # 脚ごとの円筒 (左脚 u 0..0.5, 右脚 0.5..1)。三角形ごとにどちらの脚か決めて頂点を分ける
    local = {}
    for s_ in ("l", "r"):
        cx = np.interp(pt.pos[:, 1], [J["calf_" + s_][1], J["thigh_" + s_][1]], [J["calf_" + s_][0], J["thigh_" + s_][0]])
        cz = np.interp(pt.pos[:, 1], [J["calf_" + s_][1], J["thigh_" + s_][1]], [J["calf_" + s_][2], J["thigh_" + s_][2]])
        ang = np.arctan2(pt.pos[:, 0] - cx, pt.pos[:, 2] - cz)
        local[s_] = (0.25 + ang / (2 * math.pi)) % 1.0
    vv = np.clip(pt.pos[:, 1] / (BELT_Y + 0.05), 0, 1)
    cuv = np.zeros((len(pt.tri), 3, 2))
    for ti, tri in enumerate(pt.tri):
        s_ = "l" if pt.pos[tri, 0].mean() >= 0 else "r"
        a0, a1 = (0.0, 0.5) if s_ == "l" else (0.5, 1.0)
        us = local[s_][tri].copy()
        if us.max() - us.min() > 0.5:
            us = np.where(us < 0.5, 1.0, us) if s_ == "l" else np.where(us > 0.5, 0.0, us)
        cuv[ti, :, 0] = a0 + us * (a1 - a0)
        cuv[ti, :, 1] = vv[tri]
    corner_split(pt, cuv)

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
    tot = sum(i["a3"] * (2.5 if i["p"].name == "head" else 0.7) for i in isl)
    for i in isl:
        boost = 2.5 if i["p"].name == "head" else 0.7
        i["s"] = math.sqrt(i["a3"] * boost / tot * 0.62 / i["a2"])
        i["w"] = (i["hi"][0] - i["lo"][0]) * i["s"]
        i["h"] = (i["hi"][1] - i["lo"][1]) * i["s"]
    isl.sort(key=lambda i: -i["h"])
    pad = 4 / SKIN_TEX

    def shelf(m):
        """スカイライン詰め (左下から、いちばん低く収まる位置へ置く)"""
        sky = [(0.0, 1.0, 0.0)]  # (x, 幅, 高さ)
        out = []
        top_all = 0
        for i in isl:
            w, h = i["w"] * m + pad, i["h"] * m + pad
            if w > 1:
                return 9, out
            best = None
            for si in range(len(sky)):
                x = sky[si][0]
                if x + w > 1 + 1e-9:
                    break
                y, need, sj = 0.0, w, si
                while need > 1e-12 and sj < len(sky):
                    y = max(y, sky[sj][2])
                    need -= sky[sj][1]
                    sj += 1
                if need > 1e-9:
                    continue
                if best is None or y + h < best[0] - 1e-12:
                    best = (y + h, x, y)
            top, x, y = best
            out.append((x + pad / 2, y + pad / 2))
            top_all = max(top_all, top)
            new = []
            for sx, sw, sy in sky:
                ex = sx + sw
                if sx < x:
                    new.append((sx, min(ex, x) - sx, sy))
                if ex > x + w:
                    s0 = max(sx, x + w)
                    new.append((s0, ex - s0, sy))
            new.append((x, w, top))
            new.sort()
            sky = []
            for seg in new:
                if sky and abs(sky[-1][2] - seg[2]) < 1e-12:
                    sky[-1] = (sky[-1][0], sky[-1][1] + seg[1], seg[2])
                else:
                    sky.append(seg)
        return top_all, out

    # アトラスに収まるいちばん大きい倍率を探す (以前は右半分が空いていた)。並べる順もいくつか試す
    best = None
    for key in (lambda i: -i["h"], lambda i: -i["w"], lambda i: -i["w"] * i["h"], lambda i: -max(i["w"], i["h"])):
        isl.sort(key=key)
        lo, hi = 0.1, 6.0
        for _ in range(40):
            m = (lo + hi) / 2
            if shelf(m)[0] <= 1:
                lo = m
            else:
                hi = m
        # 倍率を少しずつ上げて入る限り大きく (詰め方は倍率に対して単調ではない)
        m = lo
        for _ in range(60):
            if shelf(m * 1.01)[0] <= 1:
                m *= 1.01
        if best is None or m > best[0]:
            best = (m, list(isl))
    lo, isl[:] = best
    total_h, placed = shelf(lo)
    for i, (ox, oy) in zip(isl, placed):
        i["s"] *= lo
        i["ox"], i["oy"] = ox, oy
    print("skin atlas scale x%.2f, height %.3f" % (lo, total_h))
    k = 1.0
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

def limb_uv(part, ends, v_of, back):
    """腕・脚ごとの円筒 UV (左 u 0..0.5 / 右 0.5..1)。ends[s] = (A, B): 軸の端, v_of(t, s): 軸に沿った長さ (A から, m) → v,
    back[s]: 局所の u 0.5 (= 全体の 0.25 / 0.75) に来る向き。継ぎ目はその反対側"""
    loc, vv = {}, {}
    for s_ in ("l", "r"):
        A, B = ends[s_]
        ax = (B - A) / np.linalg.norm(B - A)
        rel = part.pos - A
        t = rel @ ax
        perp = rel - np.outer(t, ax)
        e1 = back[s_] - ax * float(back[s_] @ ax)
        e1 /= np.linalg.norm(e1)
        e2 = np.cross(ax, e1)
        loc[s_] = (0.5 + np.arctan2(perp @ e2, perp @ e1) / (2 * math.pi)) % 1.0
        vv[s_] = v_of(t, s_)
    cuv = np.zeros((len(part.tri), 3, 2))
    for ti, tri in enumerate(part.tri):
        s_ = "l" if part.pos[tri, 0].mean() >= 0 else "r"
        a0 = 0.0 if s_ == "l" else 0.5
        us = loc[s_][tri].copy()
        if us.max() - us.min() > 0.5:
            us = np.where(us < 0.5, us + 1.0, us)
            if us.min() > 1.0 - 1e-9:
                us -= 1.0
        cuv[ti, :, 0] = a0 + np.clip(us, 0, 1) * 0.5
        cuv[ti, :, 1] = vv[s_][tri]
    corner_split(part, cuv)


def palm_of(s):
    hp, mid, idx_, pk, th = (J[n + s] for n in ("hand_", "middle_01_", "index_01_", "pinky_01_", "thumb_02_"))
    nrm = np.cross(idx_ - pk, mid - hp)
    nrm /= np.linalg.norm(nrm)
    return -nrm if np.dot(th - hp, nrm) < 0 else nrm


# アンダーシャツの袖: 前腕の円筒。v 0 = 手首, 1 = ひじ (その上は 1 を超えて続く)、u 0.25 / 0.75 = 手の甲の側 (腕の外側)
_ue = {s: (J["lowerarm_" + s], J["hand_" + s]) for s in ("l", "r")}
_uL = {s: float(np.linalg.norm(_ue[s][1] - _ue[s][0])) for s in ("l", "r")}
limb_uv(parts["under"], _ue, lambda t, s: np.clip((_uL[s] - t) / _uL[s], 0, 1.6), {s: -palm_of(s) for s in ("l", "r")})
# ストッキング: すねの円筒。v 0 = 足首, 1 = 上の端、u 0.25 / 0.75 = すねの前 (継ぎ目はふくらはぎの後ろ)
_se = {s: (J["foot_" + s], J["calf_" + s]) for s in ("l", "r")}
_sp = parts["socks"]
_stop = {}
for s in ("l", "r"):
    A, B = _se[s]
    m = (_sp.pos[:, 0] >= 0) == (s == "l")
    _stop[s] = float(((_sp.pos[m] - A) @ ((B - A) / np.linalg.norm(B - A))).max())
limb_uv(_sp, _se, lambda t, s: np.clip(t / _stop[s], 0, 1), {s: np.array([0, 0, 1.0]) for s in ("l", "r")})
UNDER_V = {"wrist": 0, "elbow": 1}
# 靴は単色 (UV は簡易)
parts["shoes"].uv = np.stack([parts["shoes"].pos[:, 0] * 2 + 0.5, parts["shoes"].pos[:, 1] * 2], axis=1)


def dome_uv(p, logo_up, logo_h):
    """帽子・ヘルメット: u = 頭のまわりの角度 (0.5 が正面, 縫い目は後ろ), v = 縁 0 → てっぺん 1 (角度)。
    正面のマークの中心 (縁から表面に沿って logo_up [m] 上) の UV と、1m あたりの UV の変化量を返す。"""
    bnd = p.boundary()
    C = np.array([0.0, p.pos[bnd, 1].mean(), 0.5 * (p.pos[:, 2].min() + p.pos[:, 2].max())])

    def angles(Q):
        d = Q - C
        return np.arctan2(d[:, 0], d[:, 2]), np.arctan2(np.hypot(d[:, 0], d[:, 2]), d[:, 1])

    az, ph = angles(p.pos)
    pmax = ph.max() * 1.01

    def uvf(Q):
        a, f = angles(np.atleast_2d(Q))
        return np.stack([0.5 + a / (2 * math.pi), 1 - f / pmax], axis=1)

    p.uv = split_seam(p, uvf(p.pos))
    # 正面の中心線 (x = 0 の断面) を縁から上へたどる
    fr = np.where((np.abs(p.pos[:, 0]) < 0.014) & (p.pos[:, 2] > C[2]))[0]
    fr = fr[np.argsort(p.pos[fr, 1])]
    line = p.pos[fr].copy()
    line[:, 0] = 0
    # 前に出ている点だけ (同じ高さの内側の点を除く) を残し、なめらかにする
    keep = [0]
    for i in range(1, len(line)):
        if line[i, 1] > line[keep[-1], 1] + 0.002:
            keep.append(i)
    line = line[keep]
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
    sc = min(logo_up, s[-1] * 0.6)
    pc = np.array([np.interp(sc, s, line[:, k]) for k in range(3)])
    pa = np.array([np.interp(sc - 0.01, s, line[:, k]) for k in range(3)])
    pb = np.array([np.interp(sc + 0.01, s, line[:, k]) for k in range(3)])
    uv0 = uvf(pc)[0]
    sv = abs(uvf(pb)[0][1] - uvf(pa)[0][1]) / np.linalg.norm(pb - pa)
    su = 1 / (2 * math.pi * math.hypot(pc[0] - C[0], pc[2] - C[2]))
    print(p.name, "front arc %.3f m, logo at %.3f m" % (s[-1], sc), "uv", uv0.round(3), "su %.2f sv %.2f" % (su, sv))
    return {"u": round(float(uv0[0]), 4), "v": round(float(uv0[1]), 4), "su": round(float(su), 3), "sv": round(float(sv), 3), "h": logo_h}


CAP_LOGO = dome_uv(parts["cap"], 0.035, 0.05)
HELMET_LOGO = dome_uv(parts["helmet"], 0.04, 0.05)


# ---------------------------------------------------------------- 環境光の遮蔽 (AO) の焼き込み
# 休止姿勢の体・服・目をボクセルにして、頂点ごとに半球へ光線を飛ばす (首の下・耳の裏・わき・股・襟の内側が暗くなる)
AO_H = 0.004  # ボクセルの大きさ [m]


def voxelize(tris_pos, h):
    """三角形 (n,3,3) の表面を占有格子にする"""
    lo = tris_pos.reshape(-1, 3).min(0) - 0.2
    hi = tris_pos.reshape(-1, 3).max(0) + 0.2
    dims = np.ceil((hi - lo) / h).astype(int) + 1
    occ = np.zeros(dims, bool)
    a, b, c = tris_pos[:, 0], tris_pos[:, 1], tris_pos[:, 2]
    longest = np.maximum(np.maximum(np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1)), np.linalg.norm(a - c, axis=1))
    nsub = np.clip(np.ceil(longest / (h * 0.6)).astype(int), 1, 64)
    for n in np.unique(nsub):
        sel = nsub == n
        i, j = np.meshgrid(np.arange(n + 1), np.arange(n + 1))
        m = (i + j) <= n
        u = (i[m] / n)[None, :, None]
        v = (j[m] / n)[None, :, None]
        pts = a[sel][:, None] * (1 - u - v) + b[sel][:, None] * u + c[sel][:, None] * v
        q = np.round((pts.reshape(-1, 3) - lo) / h).astype(int)
        occ[q[:, 0], q[:, 1], q[:, 2]] = True
    return occ, lo


def hemisphere_dirs(n=32):
    """余弦重みの半球方向 (+Z まわり)"""
    k = np.arange(n) + 0.5
    r = np.sqrt(k / n)
    phi = k * math.pi * (3 - math.sqrt(5))
    return np.stack([r * np.cos(phi), r * np.sin(phi), np.sqrt(1 - r * r)], axis=1)


def bake_ao(pos, nrm, occ, lo, h, max_d, n_dirs=32):
    D = hemisphere_dirs(n_dirs)
    n = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    # 法線まわりの正規直交基底
    t = np.where(np.abs(n[:, :1]) < 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 1.0, 0]]))
    t = np.cross(n, t)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    bt = np.cross(n, t)
    dirs = D[None, :, 0:1] * t[:, None] + D[None, :, 1:2] * bt[:, None] + D[None, :, 2:3] * n[:, None]  # (nv, nd, 3)
    start = pos[:, None, :] + n[:, None, :] * (1.6 * h)
    hit_t = np.full(dirs.shape[:2], np.inf)
    steps = np.arange(h, max_d, h * 0.9)
    dims = np.array(occ.shape)
    for s_ in steps:
        q = np.round((start + dirs * s_ - lo) / h).astype(int)
        ok = np.all((q >= 0) & (q < dims), axis=2)
        qc = np.clip(q, 0, dims - 1)
        hit = occ[qc[..., 0], qc[..., 1], qc[..., 2]] & ok & np.isinf(hit_t)
        hit_t[hit] = s_
    w = np.where(np.isfinite(hit_t), 1 - (np.minimum(hit_t, max_d) / max_d) ** 2, 0)
    return 1 - w.mean(axis=1)


_occ_parts = [P[ALLTRI], parts["shirt"].pos[parts["shirt"].tri], parts["pants"].pos[parts["pants"].tri], parts["eyes"].pos[parts["eyes"].tri]]
OCC, OCC_LO = voxelize(np.concatenate(_occ_parts), AO_H)
print("ao grid", OCC.shape, int(OCC.sum()))
for key, dist in (("head", 0.06), ("hands", 0.05), ("shirt", 0.15), ("under", 0.12), ("pants", 0.15), ("pantsL", 0.15), ("socks", 0.12)):
    _p = parts[key]
    _p.ao = bake_ao(_p.pos, _p.nrm, OCC, OCC_LO, AO_H, dist)
    print("ao", key, "mean %.2f min %.2f" % (_p.ao.mean(), _p.ao.min()))
# 布は頂点色 (拡散反射に掛かる) にする。暗くなりすぎないよう弱める
for key in ("shirt", "under", "pants", "pantsL", "socks"):
    _a = 0.28 + 0.72 * parts[key].ao ** 1.3
    parts[key].color = np.repeat(np.clip(_a, 0, 1)[:, None], 3, axis=1)


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
    aob = np.ones((N, N), np.float32)
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
            if getattr(p, "ao", None) is not None:
                aob[yy, xx] = L @ p.ao[t]
    return posb, nrmb, mhb, idb, aob


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


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


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
    posb, nrmb, mhb, idb, aob = rasterize(plist, N)
    valid = idb >= 0
    pos = posb[valid]
    mhuv = mhb[valid]
    hc = J["head"]
    eyeL = mh.joint_pos(P, VG, "joint-l-eye")
    eyeR = mh.joint_pos(P, VG, "joint-r-eye")
    # 口の位置は唇マスクの重心 (joint-mouth は頭の内側の骨で、唇より上にある)
    _lm = sample_mask(MASKS["lips"], mhuv) > 0.5
    mouth = pos[_lm].mean(axis=0) if _lm.any() else mh.joint_pos(P, VG, "joint-mouth")
    rel = pos - hc
    base = np.array([0.95, 0.83, 0.74])  # 明るめの肌色 (マテリアル色で人ごとに着色)
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
    col *= 1 - lid * 0.05
    # 目の周り (眼窩) の陰り
    for e in (eyeL, eyeR):
        d = np.linalg.norm((pos - e) * [1, 1.3, 0.6], axis=1)
        sock = np.clip(1 - d / 0.03, 0, 1)[:, None] * face[:, None]
        col *= 1 - sock * 0.08
        # まつげ (上まぶたのふち)
        dl = np.abs((pos[:, 1] - (e[1] + 0.0065)) / 0.0018) + np.maximum(0, np.abs(pos[:, 0] - e[0]) - 0.013) / 0.002
        lash = np.clip(1 - dl, 0, 1) * (pos[:, 2] > e[2] - 0.004)
        del lash  # まつげの線は描かない (二重まぶたのように見えるため)
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
    # 額 ↔ こめかみ ↔ 後ろ をなめらかにつなぐ (段差があると帽子・ヘルメットの下でギザギザに見える)
    h_front = fy + 0.012 * (side / 0.05) ** 2
    h_temple = ear_y + 0.03 + (front + 0.02) * 0.6
    h_back = ear_y - 0.045 - np.clip(-front - 0.02, 0, 0.06) * 0.6
    hairline = h_back + (h_temple - h_back) * sstep(-0.032, -0.008, front)
    hairline = hairline + (h_front - hairline) * sstep(0.018, 0.042, front)
    # もみあげ (ぼかした範囲で生え際を下げる)
    sb = sstep(-0.013, -0.003, front) * (1 - sstep(0.022, 0.034, front)) * sstep(0.054, 0.064, side)
    hairline = hairline + (np.minimum(hairline, ear_y - 0.02) - hairline) * sb
    hd = (rel[:, 1] - hairline) / 0.006
    # 耳には髪を描かない
    hairmask = np.clip(hd + 0.5, 0, 1) * (idb[valid] == 0) * (1 - sample_mask(MASKS["ears"], mhuv))
    strands = 0.6 + 0.4 * vnoise(pos * [1, 2.5, 1], 700, 11)
    hairmask = hairmask * np.clip(strands + 0.25, 0, 1)
    col = col * (1 - hairmask[:, None] * 0.93) + hair_col * 1.15 * hairmask[:, None] * 0.93
    # ひげ
    if variant in ("stubble", "beard"):
        # 境目をぼかしたマスク (四角い箱にならないよう、ほおの線・あごの後ろ・のどで薄くする)
        my = mouth[1] - hc[1]
        y = rel[:, 1]
        cheek_top = my + 0.012 + np.clip((side - 0.025) / 0.04, 0, 1) * (ear_y - 0.022 - (my + 0.012))
        k_cheek = sstep(0.0, 0.009, cheek_top - y)
        k_back = sstep(-0.014, 0.002, front)
        k_mus = sstep(0.0, 0.008, 0.027 - side) * sstep(0.0, 0.004, y - (my + 0.004)) * sstep(0.0, 0.005, (my + 0.021) - y) * sstep(0.05, 0.062, front)
        k_neck = sstep(my - 0.088, my - 0.058, y)
        ears = sample_mask(MASKS["ears"], mhuv)
        area = np.maximum(k_cheek * k_back, k_mus) * k_neck * (idb[valid] == 0) * (1 - ears)
        dots = vnoise(pos, 1700, 21)
        if variant == "stubble":
            beard = area * (0.3 + 0.7 * dots) * 0.26
        else:
            patch = fbm(pos, 90, 2, 5)
            beard = area * (0.55 + 0.45 * dots) * (0.62 + 0.25 * patch)
        beard *= 1 - lips[:, 0]
        col = col * (1 - beard[:, None]) + hair_col * beard[:, None]
    # 爪
    nails = sample_mask(MASKS["fingernails"], mhuv)[:, None]
    col = col * (1 - nails * 0.5) + np.array([0.92, 0.78, 0.74]) * nails * 0.5
    # 環境光の遮蔽 (目のくぼみ・小鼻・耳の裏・あごの下・襟元)
    col *= (0.5 + 0.5 * aob[valid])[:, None]
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


# 肌の薄さ (逆光で透ける量): 耳 > 指 > 小鼻
def thickness(part):
    if part.name == "head":
        rel = part.pos - J["head"]
        eye_y = EYE_Y - J["head"][1]
        nose = np.exp(-((rel[:, 0] / 0.016) ** 2 + ((rel[:, 1] - (eye_y - 0.04)) / 0.016) ** 2)) * (rel[:, 2] > 0.07)
        return np.clip(sample_mask(MASKS["ears"], part.mhuv_v) + nose * 0.35, 0, 1)
    fw = np.zeros(len(part.pos))
    for b in BONES:
        if b["name"].startswith(("thumb", "index", "middle", "ring", "pinky")):
            fw += part.W[:, BI[b["name"]]]
    return np.clip(0.12 + 0.6 * fw, 0, 1)


for _p in (parts["head"], parts["hands"]):
    _p.thick = thickness(_p)


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


def quant_weights(w):
    """重みを 0..255 にする。合計がちょうど 255 になるよう端数を最大の重みで調整する
    (1/255 ずれると、高さ 1.5m の頂点が 6mm 動く → 襟・首の縁がギザギザになっていた)"""
    q = np.round(w * 255).astype(np.int32)
    k = np.argmax(q, axis=1)
    q[np.arange(len(q)), k] += 255 - q.sum(axis=1)
    return np.clip(q, 0, 255).astype(np.uint8)


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
        "skinWeight": binf.add(quant_weights(w), np.uint8),
    }
    if p.uv is not None:
        entry["uv"] = binf.add(p.uv.astype(np.float32), np.float32)
    if p.color is not None:
        entry["color"] = binf.add((np.clip(p.color, 0, 1) * 255).astype(np.uint8), np.uint8)
    if getattr(p, "thick", None) is not None:
        entry["thick"] = binf.add((np.clip(p.thick, 0, 1) * 255).astype(np.uint8), np.uint8)
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
# 襟ぐりの UV (前立ての位置を決めるため) と、襟の帯のテクスチャ上の位置
extra["collarUV"] = [[round(u, 4), round(v, 4)] for u, v in COLLAR_UV]
extra["collarBand"] = COLLAR_BAND
extra["torsoArc"] = TORSO_ARC
extra["capLogo"] = CAP_LOGO
extra["helmetLogo"] = HELMET_LOGO
extra["headTop"] = float(P[parts["head"].src][:, 1].max()) if parts["head"].src is not None else 1.8

manifest = {
    "version": 2,
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
