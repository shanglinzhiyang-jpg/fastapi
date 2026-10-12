#!/usr/bin/env python3
"""選手写真の切り抜き: 利用者が用意した写真から選手だけを切り抜き、カード用の透過 WebP と一覧 (photos.js) を作る。

使い方:
  python3 tools/player_photo.py [入力フォルダ] [--only c_43] [--sheet 確認.jpg] [--dry-run]

入力フォルダ (既定: photos_in/ 。git には入れない):
  photos_in/<球団>/<背番号>.jpg          例: photos_in/c/43.jpg
  photos_in/<球団>/<背番号>_<何でも>.jpg  例: photos_in/yb/18_miura.png
  photos_in/<球団>/<選手名>.jpg          例: photos_in/c/ラロッカ.jpg, photos_in/t/金本.jpg, photos_in/s/IWAMURA.jpg
  photos_in/<球団>_<背番号>.jpg          例: photos_in/c_43.jpg
  <球団> は球団 id (c, yb, bu ...)・略称 (広島)・正式名 (広島東洋カープ) のどれでもよい。
  photos_in/overrides.json (任意): {"c/43.jpg": {"pick": [0.55, 0.35], "crop": [x0, y0, x1, y1], "erase": [[x0, y0, x1, y1]], "kind": "bat", "flip": false, "model": "birefnet"}}
    pick: 写っている人が複数いるとき、残す人の位置 (画像に対する比率)。crop: 先に切り出す範囲 (比率)。
    erase: 消す範囲 (crop 後の画像に対する比率) の一覧。触れ合っている別の選手 (スライディングした走者など) を消すのに使う。

出力:
  static/img/players/<球団>_<背番号>.webp  (背景を抜いただけの写真。縦 640px 以下・余白なし。--outline で白い縁取りも付けられる)
  static/js/photos.js                      PB.PHOTOS[球団][背番号] = {src, w, h, kind, cut, foot}

切り抜きは onnxruntime で動かす学習済みモデル (rembg が GitHub で配布している ONNX):
  --model isnet     ISNet (isnet-general-use, Apache-2.0) 179MB。1 枚 2〜8 秒・メモリ 1GB ほど (既定)
  --model birefnet  BiRefNet general lite (MIT) 224MB。1 枚 20〜50 秒・メモリ 7GB ほど。ぶれたバット・伸ばした腕に強い
初回だけモデルを ~/.cache/pocket_baseball/ (PB_MODEL_DIR で変更可) に取得する (sha256 で確認)。
必要なのは numpy・Pillow・onnxruntime だけ (pip install onnxruntime)。
写真は著作物なので photos_in/ は git に入れない (.gitignore 済み)。切り抜いた画像を配るかどうかは写真の持ち主が決める。
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(os.environ.get("PB_ROOT", Path(__file__).resolve().parent.parent))
STATIC = ROOT / "static"
REL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
# 名前: (ファイル, sha256, 正規化 (mean, std), 出力にシグモイドをかけるか)
MODELS = {
    # ISNet (DIS, Apache-2.0) 179MB・1 枚 5〜8 秒・速い。動きでぶれたバットを落とすことがある
    "isnet": ("isnet-general-use.onnx", "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a", ((0.5, 0.5, 0.5), (1.0, 1.0, 1.0)), False),
    # BiRefNet general lite (Swin-T, MIT) 224MB・1 枚 20〜50 秒・メモリ 4〜12GB。ぶれたバットや細部に強い
    "birefnet": ("BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx", "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333", ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)), True),
}
MODEL_DIR = Path(os.environ.get("PB_MODEL_DIR", Path.home() / ".cache" / "pocket_baseball"))
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


# ---------------------------------------------------------------- 名簿
def load_rosters(path):
    s = Path(path).read_text(encoding="utf-8")
    m = re.search(r"PB\.D\.ROSTERS = (\{.*?\});\n", s, re.S)
    return json.loads(m.group(1))


def load_team_names(path):
    """npb.js から id -> [略称, 正式名] を拾う (なくても動く)"""
    names = {}
    try:
        s = Path(path).read_text(encoding="utf-8")
        # 球団の定義 ({ id: "g", lg: .., name: .., short: .., abbr: .., en: .. }) ごとに名前を拾う
        for blk in re.split(r'\n\s*id: "', s)[1:]:
            tid = blk.split('"', 1)[0]
            head = blk[:600]
            names[tid] = [m.group(1) for k in ("short", "name", "en") for m in [re.search(rf'\n\s*{k}: "([^"]+)"', head)] if m]
    except OSError:
        pass
    return names


def norm(s):
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[\s・･\.\-_]", "", s)
    # カタカナ -> ひらがな (かなで合わせる)
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def team_of(token, rosters, tnames):
    t = norm(token)
    for tid, v in rosters.items():
        keys = [tid, v.get("name", "")] + tnames.get(tid, [])
        if any(t == norm(k) for k in keys if k):
            return tid
    return None


def player_of(tid, stem, rosters):
    """ファイル名 (拡張子なし) から選手を探す。(player, None) か (None, エラー文)"""
    ps = rosters[tid]["players"]
    m = re.match(r"^(\d{1,3})(?:[_\-\s@].*)?$", stem)
    if m:
        hit = [p for p in ps if p["num"] == int(m.group(1))]
        return (hit[0], None) if hit else (None, f"背番号 {m.group(1)} の選手がいない")
    key = norm(re.split(r"[_@]", stem)[0])
    cands = []
    for p in ps:
        full = p["name"]
        keys = {norm(full), norm(p.get("kana", "")), norm(p.get("nameEn", ""))}
        keys |= {norm(x) for x in re.split(r"[\s・]", full) if x}  # 姓だけ・カタカナ名の後半だけ
        if key in keys:
            cands.append(p)
    if len(cands) == 1:
        return cands[0], None
    if not cands:
        return None, f"「{stem}」に合う選手がいない"
    return None, f"「{stem}」は複数の選手に合う: " + ", ".join(f"{p['num']} {p['name']}" for p in cands) + " (背番号で指定してください)"


def collect(in_dir, rosters, tnames):
    jobs, errs = [], []
    for f in sorted(Path(in_dir).rglob("*")):
        if f.suffix.lower() not in EXTS or not f.is_file():
            continue
        rel = f.relative_to(in_dir)
        if len(rel.parts) == 2:
            tid = team_of(rel.parts[0], rosters, tnames)
            stem = f.stem
        elif len(rel.parts) == 1 and "_" in f.stem:
            a, b = f.stem.split("_", 1)
            tid, stem = team_of(a, rosters, tnames), b
        else:
            errs.append(f"{rel}: 球団がわからない (photos_in/<球団>/<背番号>.jpg に置いてください)")
            continue
        if not tid:
            errs.append(f"{rel}: 球団「{rel.parts[0] if len(rel.parts) == 2 else f.stem}」が見つからない")
            continue
        p, e = player_of(tid, stem, rosters)
        if e:
            errs.append(f"{rel}: {e}")
            continue
        jobs.append({"src": f, "rel": rel.as_posix(), "team": tid, "p": p})
    # 同じ選手が二つあれば後のファイル名で
    seen = {}
    for j in jobs:
        seen[(j["team"], j["p"]["num"])] = j
    return list(seen.values()), errs


# ---------------------------------------------------------------- モデル
def ensure_model(name):
    fname, sha, _norm, _sig = MODELS[name]
    path = MODEL_DIR / fname
    if path.exists():
        return path
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    print(f"モデルを取得: {REL + fname}", file=sys.stderr)
    h = hashlib.sha256()
    with urllib.request.urlopen(REL + fname, timeout=60) as r, open(tmp, "wb") as w:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            h.update(b)
            w.write(b)
    if h.hexdigest() != sha:
        tmp.unlink()
        sys.exit("モデルのハッシュが合わない (取得に失敗)")
    tmp.rename(path)
    return path


_sess = {}


def predict(img, name="isnet"):
    """前景らしさ (0..1, 元の大きさ) を返す"""
    import onnxruntime as ort

    if name not in _sess:
        so = ort.SessionOptions()
        so.log_severity_level = 3
        so.enable_cpu_mem_arena = False  # 大きいモデルでメモリを食いすぎないように
        _sess[name] = ort.InferenceSession(str(ensure_model(name)), so, providers=["CPUExecutionProvider"])
    sess = _sess[name]
    _f, _h, (mean, std), sig = MODELS[name]
    x = (np.asarray(img.convert("RGB").resize((1024, 1024), Image.BICUBIC), np.float32) / 255.0 - np.float32(mean)) / np.float32(std)
    y = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    if sig:
        y = 1 / (1 + np.exp(-y))
    y = (y - y.min()) / max(1e-6, y.max() - y.min())
    m = Image.fromarray((y * 255).astype(np.uint8)).resize(img.size, Image.BICUBIC)
    return np.asarray(m, np.float32) / 255.0


# ---------------------------------------------------------------- 後処理
def components(b):
    """二値画像の連結成分 (4 近傍)。ラベル画像と [(画素数, y0, y1, x0, x1)]"""
    h, w = b.shape
    lab = np.zeros((h, w), np.int32)
    comps = []
    for y0, x0 in zip(*np.nonzero(b)):
        if lab[y0, x0]:
            continue
        cur = len(comps) + 1
        lab[y0, x0] = cur
        q = deque([(y0, x0)])
        n, ys, xs = 0, [y0, y0], [x0, x0]
        while q:
            y, x = q.popleft()
            n += 1
            ys[0], ys[1], xs[0], xs[1] = min(ys[0], y), max(ys[1], y), min(xs[0], x), max(xs[1], x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and b[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur
                    q.append((ny, nx))
        comps.append((n, ys[0], ys[1], xs[0], xs[1]))
    return lab, comps


def dilate(a, r):
    """円形の膨張 (ずらした最大値)"""
    out = a.copy()
    h, w = a.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r + r or (dx == 0 and dy == 0):
                continue
            ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
            xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
            np.maximum(out[yd, xd], a[ys, xs], out=out[yd, xd])
    return out


def _box(a, r, axis):
    """幅 2r+1 の移動平均 (端は端の値を伸ばす)"""
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(a, r):
    """ぼかし (箱型を 3 回かけてガウスに近づける)。r はおおよその半径 px"""
    k = max(1, int(round(r / 1.7)))
    if r < 1:
        k = 1
    out = a.astype(np.float32)
    for _ in range(3):
        out = _box(_box(out, k, 0), k, 1)
    return out


def clean_mask(alpha, pick=None):
    """主役 (一番大きい人、または pick の位置の人) と、それにくっついた道具 (バット・グラブ) だけ残す"""
    h, w = alpha.shape
    s = 320 / max(h, w)
    sm = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize((max(1, int(w * s)), max(1, int(h * s))), Image.BILINEAR)) > 60
    lab, comps = components(sm)
    if not comps:
        return alpha, {"conf": 0.0}
    if pick is not None:
        py, px = int(pick[1] * sm.shape[0]), int(pick[0] * sm.shape[1])
        near = lab[max(0, py - 6) : py + 7, max(0, px - 6) : px + 7]
        ids = [i for i in np.unique(near) if i]
        main = max(ids, key=lambda i: comps[i - 1][0]) if ids else int(np.argmax([c[0] for c in comps])) + 1
    else:
        main = int(np.argmax([c[0] for c in comps])) + 1
    n0, y0, y1, x0, x1 = comps[main - 1]
    reach = dilate((lab == main).astype(np.uint8), max(2, int(0.035 * max(sm.shape))))
    keep = np.zeros(len(comps) + 1, bool)
    keep[main] = True
    for i, (n, *_r) in enumerate(comps, 1):
        if i != main and n >= n0 * 0.004 and reach[lab == i].any():
            keep[i] = True  # 主役の近くの部品 (バットの先・離れた手袋など)
    km = keep[lab].astype(np.uint8) * 255
    km = Image.fromarray(km).filter(ImageFilter.MaxFilter(5)).resize((w, h), Image.BILINEAR)
    km = np.asarray(km.filter(ImageFilter.GaussianBlur(2)), np.float32) / 255
    out = alpha * np.clip(km * 1.5, 0, 1)
    # 薄いもや (別の人の残り・背景のにじみ) を落とし、中は不透明に
    k = np.clip((out - 0.1) / 0.8, 0, 1)
    out = k * k * (3 - 2 * k)
    total = float((alpha > 0.4).sum()) or 1.0
    conf = float((out > 0.4).sum()) / total  # 主役が前景のうち何割か
    return out, {"conf": round(conf, 3), "parts": int(keep.sum())}


def decontaminate(rgb, a):
    """縁の画素から背景色の混ざりを除く (C = aF + (1-a)B を F について解く)"""
    wb = (a < 0.03).astype(np.float32)
    wf = (a > 0.97).astype(np.float32)
    bgc = np.stack([blur(rgb[..., c] * wb, 6) for c in range(3)], -1) / np.maximum(blur(wb, 6), 1e-4)[..., None]
    fgc = np.stack([blur(rgb[..., c] * wf, 3) for c in range(3)], -1) / np.maximum(blur(wf, 3), 1e-4)[..., None]
    aa = a[..., None]
    f1 = np.clip((rgb - (1 - aa) * bgc) / np.maximum(aa, 0.05), 0, 255)
    t = np.clip((aa - 0.2) / 0.5, 0, 1)  # 薄い所は内側の色を伸ばす
    f = f1 * t + fgc * (1 - t)
    edge = (a > 0.0) & (a < 0.97)
    return np.where(edge[..., None], f, rgb)


def cutout(src, model="isnet", height=640, outline=0, pick=None, crop=None, flip=False, erase=None):
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if crop:
        W, H = img.size
        img = img.crop((int(crop[0] * W), int(crop[1] * H), int(crop[2] * W), int(crop[3] * H)))
    t0 = time.time()
    raw = predict(img, model)
    t_inf = time.time() - t0
    H0, W0 = raw.shape
    for e in erase or []:
        raw[int(e[1] * H0) : int(e[3] * H0), int(e[0] * W0) : int(e[2] * W0)] = 0
    a, info = clean_mask(raw, pick)
    ys, xs = np.nonzero(a > 0.03)
    if len(ys) == 0:
        return None, dict(info, error="選手が見つからない")
    H, W = a.shape
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    # 写真の端で切れているか (足元が切れていればカードの下端に合わせる)
    edge = max(2, int(0.006 * max(H, W)))
    cut = "".join(k for k, v in (("t", y0 < edge), ("b", y1 >= H - edge), ("l", x0 < edge), ("r", x1 >= W - edge)) if v)
    rgb = decontaminate(np.asarray(img, np.float32), a)
    rgba = np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)[y0 : y1 + 1, x0 : x1 + 1]
    im = Image.fromarray(rgba, "RGBA")
    if flip:
        im = ImageOps.mirror(im)
    # 大きい写真だけ縦 height に縮める (拡大・シャープなどの加工はしない)
    pad = outline + 2 if outline > 0 else 0
    sc = min((height - 2 * pad) / im.height, 1.0)
    if sc < 1.0:
        im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (255, 255, 255, 0))
    canvas.alpha_composite(im, (pad, pad))
    if outline > 0:
        al = np.asarray(canvas, np.float32)[..., 3] / 255
        ring = dilate(al, outline)
        ring = np.asarray(Image.fromarray((ring * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255
        white = np.dstack([np.full_like(ring, 255)] * 3 + [ring * 255]).astype(np.uint8)
        base = Image.fromarray(white, "RGBA")
        base.alpha_composite(canvas)
        canvas = base
    # 写真の端で切れている辺は縁取りなしでまっすぐに (カードの端に当てる)
    if "b" in cut and pad:
        canvas = canvas.crop((0, 0, canvas.width, canvas.height - pad))
    # 足元の位置 (下端付近の不透明画素の中心, 幅に対する比率)
    al = np.asarray(canvas)[..., 3]
    rows = al[int(al.shape[0] * 0.9) :]
    fx = float(np.nonzero(rows > 128)[1].mean() / al.shape[1]) if (rows > 128).any() else 0.5
    info.update(w=canvas.width, h=canvas.height, cut=cut, foot=round(fx, 3), infer=round(t_inf, 2), scale=round(sc, 2), src_h=int(y1 - y0 + 1))
    return canvas, info


# ---------------------------------------------------------------- 一覧
def write_manifest(path, entries):
    out = {}
    for (tid, num), e in sorted(entries.items()):
        out.setdefault(tid, {})[str(num)] = e
    body = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    Path(path).write_text(
        "/* 選手写真の切り抜き (tools/player_photo.py で生成。手で直さない) */\n"
        "(function (PB) {\n"
        f"  PB.PHOTOS = {body};\n"
        "})((window.PB = window.PB || {}));\n",
        encoding="utf-8",
    )


def read_manifest(path):
    try:
        s = Path(path).read_text(encoding="utf-8")
        d = json.loads(re.search(r"PB\.PHOTOS = (\{.*\});", s).group(1))
        return {(t, int(n)): e for t, v in d.items() for n, e in v.items()}
    except (OSError, AttributeError, ValueError):
        return {}


def sheet(results, dst):
    C = 220
    cols = 5
    rows = (len(results) + cols - 1) // cols
    sh = Image.new("RGB", (cols * C, rows * (C + 30)), (24, 24, 28))
    d = ImageDraw.Draw(sh)
    for i, (job, im, info) in enumerate(results):
        x, y = (i % cols) * C, (i // cols) * (C + 30)
        g = np.repeat(np.linspace(0, 1, C)[:, None], C, axis=1)
        bg = Image.fromarray(np.dstack([200 * (1 - g) + 40 * g, 120 * (1 - g) + 20 * g, np.full_like(g, 40)]).astype(np.uint8))
        if im is not None:
            t = im.copy()
            t.thumbnail((C - 8, C - 8), Image.LANCZOS)
            bg.paste(t, ((C - t.width) // 2, C - t.height if "b" in info.get("cut", "") else (C - t.height) // 2), t)
        sh.paste(bg, (x, y))
        warn = []
        if info.get("conf", 1) < 0.8:
            warn.append("other-people?")
        if info.get("src_h", 999) < 360:
            warn.append("low-res")
        if "t" in info.get("cut", ""):
            warn.append("head-cut")
        p = job["p"]
        d.text((x + 3, y + C + 2), f"{job['team']}_{p['num']} {p['nameEn']} conf={info.get('conf')}", fill="white")
        d.text((x + 3, y + C + 15), " ".join(warn) or "ok", fill=(255, 120, 120) if warn else (140, 255, 140))
    sh.save(dst, quality=88)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("in_dir", nargs="?", default=str(ROOT / "photos_in"))
    ap.add_argument("--out", default=str(STATIC / "img" / "players"))
    ap.add_argument("--manifest", default=str(STATIC / "js" / "photos.js"))
    ap.add_argument("--rosters", default=str(STATIC / "js" / "rosters2004.js"))
    ap.add_argument("--only", help="この選手だけ (例: c_43)")
    ap.add_argument("--model", choices=sorted(MODELS), default="isnet", help="isnet: 速い / birefnet: きれい (遅い)")
    ap.add_argument("--height", type=int, default=640)
    ap.add_argument("--outline", type=int, default=0, help="白い縁取りの太さ px (既定 0: 縁取りなし)")
    ap.add_argument("--quality", type=int, default=86)
    ap.add_argument("--sheet", help="確認用の一覧画像 (jpg)")
    ap.add_argument("--dry-run", action="store_true", help="名簿との対応だけ確かめる")
    ap.add_argument("--prune", action="store_true", help="入力にない選手を一覧から消す")
    a = ap.parse_args()

    rosters = load_rosters(a.rosters)
    tnames = load_team_names(STATIC / "js" / "npb.js")
    jobs, errs = collect(a.in_dir, rosters, tnames)
    for e in errs:
        print("!", e, file=sys.stderr)
    if a.only:
        jobs = [j for j in jobs if f"{j['team']}_{j['p']['num']}" == a.only]
    ov_path = Path(a.in_dir) / "overrides.json"
    ov = json.loads(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else {}
    for j in jobs:
        print(f"{j['rel']:28s} -> {j['team']}_{j['p']['num']} {j['p']['name']} ({j['p']['pos']})")
    if a.dry_run:
        return
    Path(a.out).mkdir(parents=True, exist_ok=True)
    man = {} if a.prune else read_manifest(a.manifest)
    results = []
    for j in jobs:
        o = ov.get(j["rel"], {})
        im, info = cutout(j["src"], o.get("model", a.model), a.height, a.outline, o.get("pick"), o.get("crop"), o.get("flip", False), o.get("erase"))
        results.append((j, im, info))
        key = f"{j['team']}_{j['p']['num']}"
        if im is None:
            print("!", j["rel"], info.get("error"), file=sys.stderr)
            continue
        im.save(Path(a.out) / f"{key}.webp", "WEBP", quality=a.quality, method=6)
        kind = o.get("kind") or ("pit" if j["p"]["pos"] == "P" else "bat")
        man[(j["team"], j["p"]["num"])] = {"src": f"img/players/{key}.webp", "w": info["w"], "h": info["h"], "kind": kind, "cut": info["cut"], "foot": info["foot"], "outline": a.outline}
        print(f"  {key}: {info['w']}x{info['h']} conf={info['conf']} cut={info['cut'] or '-'} {info['infer']}s")
    write_manifest(a.manifest, man)
    if a.sheet:
        sheet(results, a.sheet)
    if results:
        print("写真は著作物です。切り抜いた画像 (static/img/players/) を公開・配布するかどうかは写真の持ち主が決めてください。", file=sys.stderr)


if __name__ == "__main__":
    main()
