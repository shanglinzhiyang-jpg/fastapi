"""MakeHuman (CC0) のデータを読み込み、体型モーフを適用するための小さなライブラリ。

MakeHuman の座標系: Y が上, 体の正面が +Z, キャラクターの左手側が +X, 単位はデシメートル。
"""
import collections
import json
import os

import numpy as np

SRC = os.environ.get("MH_DATA", "/tmp/claude-0/-home-user-fastapi/09fee672-c40f-559d-bf94-df64273c951d/scratchpad/mh")


def load_obj(path=None):
    path = path or os.path.join(SRC, "data", "base.obj")
    vs, vts = [], []
    faces = collections.defaultdict(list)
    g = None
    for line in open(path):
        if line.startswith("v "):
            vs.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            vts.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("g "):
            g = line.split()[1]
        elif line.startswith("f "):
            vi, ti = [], []
            for t in line.split()[1:]:
                p = t.split("/")
                vi.append(int(p[0]) - 1)
                ti.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
            faces[g].append((vi, ti))
    return np.array(vs, np.float64), np.array(vts, np.float64), faces


_tcache = {}


def target(name):
    """name は targets/ からの相対パス (拡張子なし可)。疎なオフセット (idx, delta) を返す。"""
    if not name.endswith(".target"):
        name += ".target"
    if name in _tcache:
        return _tcache[name]
    path = os.path.join(SRC, "targets", name)
    idx, d = [], []
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        p = line.split()
        idx.append(int(p[0]))
        d.append([float(p[1]), float(p[2]), float(p[3])])
    r = (np.array(idx, np.int64), np.array(d, np.float64).reshape(-1, 3))
    _tcache[name] = r
    return r


def apply(V, name, w):
    if abs(w) < 1e-6:
        return
    idx, d = target(name)
    V[idx] += d * w


def three_way(x):
    """0..1 のスライダー値を (min, average, max) の重みに分ける (MakeHuman と同じ)。"""
    if x < 0.5:
        return {"min": (0.5 - x) * 2, "average": x * 2, "max": 0.0}
    return {"min": 0.0, "average": (1 - x) * 2, "max": (x - 0.5) * 2}


def macro(V, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, race=None):
    """若い男性 (age=25) の体型を適用する。race = {'asian':a, 'caucasian':c, 'african':f}"""
    race = race or {"asian": 1.0, "caucasian": 0.0, "african": 0.0}
    mw = three_way(muscle)
    ww = three_way(weight)
    for mk, mv in mw.items():
        for wk, wv in ww.items():
            w = mv * wv
            if w < 1e-6:
                continue
            apply(V, f"macrodetails/universal-male-young-{mk}muscle-{wk}weight", w)
            if height > 0.5:
                apply(V, f"macrodetails/height/male-young-{mk}muscle-{wk}weight-maxheight", w * (height - 0.5) * 2)
            elif height < 0.5:
                apply(V, f"macrodetails/height/male-young-{mk}muscle-{wk}weight-minheight", w * (0.5 - height) * 2)
            if proportions > 0.5:
                apply(V, f"macrodetails/proportions/male-young-{mk}muscle-{wk}weight-idealproportions", w * (proportions - 0.5) * 2)
            elif proportions < 0.5:
                apply(V, f"macrodetails/proportions/male-young-{mk}muscle-{wk}weight-uncommonproportions", w * (0.5 - proportions) * 2)
    for rk, rv in race.items():
        apply(V, f"macrodetails/{rk}-male-young", rv)


def modifier(V, base, value):
    """'nose/nose-scale-vert' のような 2 方向ターゲット: value>0 → incr, <0 → decr。
    ファイル名の命名が a-b 形式 (例: head-oval / head-round) のものは base に 'decr|incr' を含めて渡す。"""
    if value == 0:
        return
    if "|" in base:
        neg, pos = base.split("|")
        apply(V, pos if value > 0 else neg, abs(value))
    else:
        apply(V, base + ("-incr" if value > 0 else "-decr"), abs(value))


def rig():
    return json.load(open(os.path.join(SRC, "data", "rig.game_engine.json")))


def weights():
    return json.load(open(os.path.join(SRC, "data", "weights.game_engine.json")))["weights"]


def vgroups():
    return json.load(open(os.path.join(SRC, "data", "vgroups.json")))


def group_indices(vg, name):
    out = []
    for a, b in vg[name]:
        out.extend(range(a, b + 1))
    return np.array(out, np.int64)


def joint_pos(V, vg, name):
    return V[group_indices(vg, name)].mean(axis=0)
