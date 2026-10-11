"""ユーザー提供の参考画像から、ユニフォームの胸マーク・帽子マーク・球団旗を切り出す。

python3 tools/team_assets.py <アップロード画像のフォルダ>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from logo_cutout import cutout  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else "/root/.claude/uploads/09fee672-c40f-559d-bf94-df64273c951d"
OUT = os.path.join(os.path.dirname(__file__), "..", "static", "img")
TMP = "/tmp/claude-0/-home-user-fastapi/09fee672-c40f-559d-bf94-df64273c951d/scratchpad/logos"
os.makedirs(TMP, exist_ok=True)


def crop(name, box, scale=1.0):
    im = Image.open(os.path.join(SRC, name + "-image.jpg")).convert("RGB").crop(box)
    if scale != 1.0:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    p = os.path.join(TMP, "crop_" + name + "_" + "_".join(map(str, box)) + ".png")
    im.save(p)
    return p


def remove_thin(path, k=7):
    """細い線 (ピンストライプ・パイピング) を消す: アルファの開閉処理"""
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    a2 = a.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    a3 = Image.fromarray(np.minimum(np.asarray(a), np.asarray(a2.filter(ImageFilter.GaussianBlur(0.8)))).astype(np.uint8))
    im.putalpha(a3)
    im.save(path)


def save_flag(name, out, box=None):
    im = Image.open(os.path.join(SRC, name + "-image.jpg")).convert("RGB")
    if box:
        im = im.crop(box)
    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(out, "WEBP", quality=90)


def keep_white(path):
    """白い文字だけを残す (旗の地色が文字のすき間に残った分を消す)。"""
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    mn = a[..., :3].min(axis=2)
    k = np.clip((mn - 110) / 90, 0, 1)
    a[..., 3] *= k
    a[..., :3] = 255
    Image.fromarray(a.astype(np.uint8), "RGBA").save(path, "WEBP", quality=92)


def outline_cut(name, box, out):
    """濃い色のふちどりで囲まれたマーク: ふちどりの外側 (外周からつながる領域) を透明にする"""
    from collections import deque

    im = Image.open(os.path.join(SRC, name + "-image.jpg")).convert("RGB").crop(box)
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    lum = a.mean(axis=2)
    dark = (lum < 90) & (a[..., 2] >= a[..., 0] - 10)
    h, w = dark.shape
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)])
    for y, x in q:
        seen[y, x] = not dark[y, x]
    q = deque([p for p in q if seen[p]])
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and not dark[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    alpha = Image.fromarray((~seen).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.2))
    rgba = im.convert("RGBA")
    rgba.putalpha(alpha)
    bb = rgba.getbbox()
    rgba = rgba.crop(bb)
    rgba.thumbnail((512, 512), Image.LANCZOS)
    rgba.save(out, "WEBP", quality=92)


# 胸マーク
cutout(crop("1ef1949c", (500, 515, 1020, 752)), os.path.join(OUT, "words", "c.webp"), t_hi=70)
remove_thin(os.path.join(OUT, "words", "c.webp"), 13)
cutout(crop("94475f4a", (685, 225, 872, 422), 2.0), os.path.join(OUT, "words", "yb.webp"), t_hi=60)
cutout(crop("bca560d4", (70, 60, 700, 370)), os.path.join(OUT, "words", "d.webp"), t_hi=90)
keep_white(os.path.join(OUT, "words", "d.webp"))
cutout(crop("7f5af947", (170, 120, 715, 395)), os.path.join(OUT, "words", "m.webp"), t_hi=70)
cutout(crop("21770893", (130, 120, 245, 175), 4.0), os.path.join(OUT, "words", "yb_away.webp"), t_hi=60)
cutout(crop("ec102033", (352, 322, 416, 394), 4.0), os.path.join(OUT, "words", "bs.webp"), t_hi=60)
# 帽子のマーク
cutout(crop("4b219b60", (420, 255, 700, 540)), os.path.join(OUT, "marks", "g.webp"), t_hi=90)
outline_cut("83d6a143", (140, 170, 365, 320), os.path.join(OUT, "marks", "c.webp"))
cutout(crop("d7405586", (150, 30, 320, 280)), os.path.join(OUT, "marks", "h.webp"), t_hi=90)
cutout(crop("94475f4a", (695, 228, 852, 382), 2.0), os.path.join(OUT, "marks", "yb.webp"), t_hi=60)
# 球団旗
for nm, tid in (("bca560d4", "d"), ("7f5af947", "m"), ("d7405586", "h"), ("308dd01d", "t"), ("d050d17b", "f"), ("d50969d7", "bs")):
    save_flag(nm, os.path.join(OUT, "flags", tid + ".webp"))
# ロゴの文字 (旗・中継用)
cutout(crop("a402b7f9", (0, 0, 460, 345)), os.path.join(OUT, "words", "yb_script.webp"), t_hi=60)
cutout(crop("d50969d7", (10, 5, 200, 125)), os.path.join(OUT, "marks", "orix.webp"), t_hi=60)
print("done")
