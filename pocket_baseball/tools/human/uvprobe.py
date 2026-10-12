"""選手モデル (static/models/player.*) の布の UV と形を測って、build_player.py の作り直しの合格条件を確かめる。

使い方: python3 -I tools/human/uvprobe.py [models のフォルダ (既定 static/models)] [比べる古いフォルダ]
合格条件 (目録 v3):
  - 袖の上の行 (sleeveV.top、v2 は 0.28) に 2 頂点以上が詰まった三角形が 0 (肩が 1 行のテクスチャを引いて灰色になる不具合)
  - 胴体の前半分 (u 0..0.5) と後ろ半分の布の長さの差が v 0.45〜0.65 で ±4 cm 以内 (円筒の軸が体の後ろにずれていない)
  - torsoArc の行が v 0.99 まである (首の近くまで実寸で引ける)
  - パンツ (短・長) に足首より下 (重心の高さ 0.1 m 未満) の三角形がない
外れると終了コード 1。胸囲・帽子の高さ・部品ごとの頂点/三角形の数・bin の大きさも表示する。
"""
import json
import os
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load(d):
    j = json.load(open(os.path.join(d, "player.json")))
    b = open(os.path.join(d, "player.bin"), "rb").read()

    def mesh(name):
        ms = [x for x in j["meshes"] if x["name"] == name]
        if not ms:
            return None
        m = ms[0]
        n = m["count"]
        pos = np.frombuffer(b, np.float32, n * 3, m["position"]).reshape(-1, 3)
        uv = np.frombuffer(b, np.float32, n * 2, m["uv"]).reshape(-1, 2) if m.get("uv") is not None else None
        idx = np.frombuffer(b, np.uint32 if m["index32"] else np.uint16, m["indexCount"], m["index"]).reshape(-1, 3).astype(np.int64)
        return pos, uv, idx

    return j, b, mesh


def tri_area(pos, t):
    a, b_, c = pos[t[:, 0]], pos[t[:, 1]], pos[t[:, 2]]
    return 0.5 * np.linalg.norm(np.cross(b_ - a, c - a), axis=1)


def probe(d, quiet=False):
    j, b, mesh = load(d)
    ex = j["extra"]
    out = {"version": j.get("version"), "bin": len(b)}
    pos, uv, idx = mesh("shirt")
    v = uv[:, 1]
    top = (ex.get("sleeveV") or {}).get("top", 0.28)
    tv = v[idx]
    clamp_s = (np.abs(tv - top) < 1e-4).sum(1) >= 2
    out["sleeveTopTris"] = int(clamp_s.sum())
    out["sleeveTopCm2"] = round(float(tri_area(pos, idx[clamp_s]).sum() * 1e4), 1)
    ta = ex["torsoArc"]
    rows = []
    for vv, s in zip(ta["v"], ta["s"]):
        nb = len(s) - 1
        front = (s[nb // 2] - s[0]) * 100
        back = (s[nb] - s[nb // 2]) * 100
        y = ta["y"][0] + (vv - 0.3) / 0.7 * (ta["y"][1] - ta["y"][0])
        rows.append((vv, y, s[nb] * 100, front, back))
    out["rows"] = rows
    out["rowsTop"] = max(ta["v"])
    out["fbDiff"] = max(abs(f - bk) for vv, _, _, f, bk in rows if 0.45 - 1e-6 <= vv <= 0.65 + 1e-6)
    # 胸囲: 胴体の頂点 (袖を除く) の高さ 1.30 m の水平の輪 (凸包の周) で測る
    sel = (np.abs(pos[:, 1] - 1.30) < 0.012) & (v > 0.3)
    q = pos[sel][:, [0, 2]]
    out["chestCm"] = round(hull_perimeter(q) * 100, 1) if len(q) > 3 else None
    low = 0
    for k in ("pants", "pantsL"):
        m = mesh(k)
        if m:
            p_, _, ix = m
            low += int((p_[ix].mean(axis=1)[:, 1] < 0.1).sum())
    out["pantsBelowAnkle"] = low
    # 帽子のクラウンの高さ (正面の縁から頭頂まで)。v3 はつば・ボタンが色見本の行 (v < 0.04) に入っている
    cp, cuv, cix = mesh("cap")
    shell = cuv[:, 1] >= ex.get("domeSwatch", {}).get("vShell", 0.0) - 1e-6
    hb = np.array([bb["pos"] for bb in j["bones"] if bb["name"] == "head"][0])
    rel = cp[shell] - hb
    edge = rel[(rel[:, 2] > 0.09) & (np.abs(rel[:, 0]) < 0.02)][:, 1].min()
    out["capCrownCm"] = round(float((rel[:, 1].max() - edge) * 100), 1)
    out["meshes"] = {m["name"]: (m["count"], m["indexCount"] // 3) for m in j["meshes"]}
    if not quiet:
        print("%s: version %s, bin %.0f KB" % (d, out["version"], out["bin"] / 1024))
        print("  sleeve-top clamped tris %d (%.0f cm2) at v %.3f" % (out["sleeveTopTris"], out["sleeveTopCm2"], top))
        for vv, y, circ, f, bk in rows:
            print("  v %.3f y %.3f circ %5.1f cm  front %5.1f  back %5.1f  diff %+5.1f" % (vv, y, circ, f, bk, f - bk))
        print("  front-back max diff (v 0.45-0.65) %.1f cm, rows to %.3f" % (out["fbDiff"], out["rowsTop"]))
        print("  chest circumference at y 1.30: %s cm" % out["chestCm"])
        print("  pants tris below the ankle: %d" % out["pantsBelowAnkle"])
        print("  cap crown above the front rim: %.1f cm" % out["capCrownCm"])
        print("  meshes (verts, tris): %s" % out["meshes"])
        print("  sleeveV %s, domeSwatch %s" % (ex.get("sleeveV"), ex.get("domeSwatch")))
    return out


def hull_perimeter(q):
    q = q[np.lexsort((q[:, 1], q[:, 0]))]

    def half(pts):
        h = []
        for p in pts:
            while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) <= 0:
                h.pop()
            h.append(p)
        return h

    lo = half(q)
    hi = half(q[::-1])
    hull = np.array(lo[:-1] + hi[:-1])
    return float(np.linalg.norm(np.roll(hull, -1, 0) - hull, axis=1).sum())


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "static", "models")
    out = probe(d)
    if len(sys.argv) > 2:
        old = probe(sys.argv[2], quiet=True)
        print("  compared with %s: chest %s -> %s cm, bin %.0f -> %.0f KB, sleeve-top tris %d -> %d, front-back diff %.1f -> %.1f cm" % (sys.argv[2], old["chestCm"], out["chestCm"], old["bin"] / 1024, out["bin"] / 1024, old["sleeveTopTris"], out["sleeveTopTris"], old["fbDiff"], out["fbDiff"]))
    fails = []
    if out["version"] and out["version"] >= 3:
        if out["sleeveTopTris"]:
            fails.append("sleeve-top clamped tris %d" % out["sleeveTopTris"])
        if out["fbDiff"] > 4:
            fails.append("front/back torso arc differ by %.1f cm" % out["fbDiff"])
        if out["rowsTop"] < 0.99 - 1e-6:
            fails.append("torsoArc rows stop at %.3f" % out["rowsTop"])
        if out["pantsBelowAnkle"]:
            fails.append("%d pants tris below the ankle" % out["pantsBelowAnkle"])
    print("FAIL: " + "; ".join(fails) if fails else "gates OK" if out["version"] and out["version"] >= 3 else "(v2: gates are for manifest v3)")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
