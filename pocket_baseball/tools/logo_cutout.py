"""球団ロゴの背景 (周囲の白や単色) を抜いて、縁をなじませた透過画像を作る。

使い方: python3 tools/logo_cutout.py <入力画像> <出力.webp> [しきい値]
  - 画像の外周の色を背景色とみなし、外周からつながっている背景色の領域だけを透明にする
    (ロゴ内部の白は残る)。
  - 境界はしきい値に応じて半透明にし、背景色の混ざりを取り除く (色の逆算)。
  - 小さな離れ島 (著作権表記など) は取り除き、ロゴの外接矩形で切り抜く。
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def cutout(path, out, t_hi=48.0, t_lo=10.0, size=512, seeds=()):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    # 外周の細い枠線 (数 px) は無視する
    a = a[3:-3, 3:-3]
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    # 外周で一番多い色 (16 段階に量子化) を背景色とする
    qz = (border // 16).astype(int)
    keys = qz[:, 0] * 256 + qz[:, 1] * 16 + qz[:, 2]
    vals, cnt = np.unique(keys, return_counts=True)
    top = vals[cnt.argmax()]
    bg = np.median(border[keys == top], axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    cand = d < t_hi
    # 外周からの塗りつぶし
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    # 追加の種 (枠線に囲まれた内側の背景など): 画像に対する比率 (fx, fy)
    for fx, fy in seeds:
        sy, sx = int(fy * h), int(fx * w)
        if cand[sy, sx] and not seen[sy, sx]:
            seen[sy, sx] = True
            q.append((sy, sx))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and cand[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    alpha = np.ones((h, w), np.float32)
    k = np.clip((d - t_lo) / (t_hi - t_lo), 0, 1)
    k = k * k * (3 - 2 * k)
    alpha[seen] = k[seen]
    # 境界を 1px ぶん柔らかく (背景側にだけ広げない)
    am = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.minimum(alpha, np.asarray(am).astype(np.float32) / 255 + 0.0) if False else np.asarray(am).astype(np.float32) / 255
    alpha[~seen] = 1.0
    # 背景色の混ざりを除く
    aa = np.clip(alpha, 1e-3, 1)[..., None]
    col = np.clip((a - (1 - aa) * bg) / aa, 0, 255)
    # 小さな島を除く
    op = alpha > 0.5
    lab = np.zeros((h, w), np.int32)
    comps = []
    cur = 0
    for y in range(h):
        for x in range(w):
            if op[y, x] and lab[y, x] == 0:
                cur += 1
                lab[y, x] = cur
                q = deque([(y, x)])
                n = 0
                ys = [y, y]
                xs = [x, x]
                while q:
                    cy, cx = q.popleft()
                    n += 1
                    ys[0], ys[1] = min(ys[0], cy), max(ys[1], cy)
                    xs[0], xs[1] = min(xs[0], cx), max(xs[1], cx)
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and op[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur
                            q.append((ny, nx))
                comps.append((n, ys, xs))
    big = max(c[0] for c in comps) if comps else 0
    # 大きな部品の外接矩形 (少し広げる) の中にある部品は文字などとして残す
    by0, by1, bx0, bx1 = h, 0, w, 0
    for n, ys_, xs_ in comps:
        if n >= big * 0.02:
            by0, by1, bx0, bx1 = min(by0, ys_[0]), max(by1, ys_[1]), min(bx0, xs_[0]), max(bx1, xs_[1])
    my, mx = (by1 - by0) * 0.12, (bx1 - bx0) * 0.12
    keep = np.zeros(cur + 1, bool)
    for i, (n, ys_, xs_) in enumerate(comps, 1):
        inside = ys_[0] >= by0 - my and ys_[1] <= by1 + my and xs_[0] >= bx0 - mx and xs_[1] <= bx1 + mx
        keep[i] = n >= big * 0.004 or (inside and n >= 6)
        # 外周を囲む細い円・枠線 (面積の割に中身が空) は背景の一部として消す
        bb = (ys_[1] - ys_[0] + 1) * (xs_[1] - xs_[0] + 1)
        if bb > 0.45 * h * w and n / bb < 0.05:
            keep[i] = False
    mask_keep = keep[lab] | (lab == 0)
    alpha = np.where(mask_keep, alpha, 0)
    # 残す画素の近くにない半透明画素も消す
    ys, xs = np.where(alpha > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    m = int(max(y1 - y0, x1 - x0) * 0.03) + 2
    y0, x0 = max(0, y0 - m), max(0, x0 - m)
    y1, x1 = min(h - 1, y1 + m), min(w - 1, x1 + m)
    rgba = np.dstack([col, alpha[..., None] * 255]).astype(np.uint8)[y0 : y1 + 1, x0 : x1 + 1]
    img = Image.fromarray(rgba, "RGBA")
    img.thumbnail((size, size), Image.LANCZOS)
    img.save(out, "WEBP", quality=92, method=6)
    return bg, img.size


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    th = float(sys.argv[3]) if len(sys.argv) > 3 else 48.0
    seeds = []
    for sd in sys.argv[4:]:
        fx, fy = sd.split(",")
        seeds.append((float(fx), float(fy)))
    print(dst, cutout(src, dst, t_hi=th, seeds=seeds))
