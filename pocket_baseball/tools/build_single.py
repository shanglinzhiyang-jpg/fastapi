"""ゲームを 1 つの HTML ファイルにまとめる。

    python pocket_baseball/tools/build_single.py              # dist/pocket_baseball.html (3D 込み、約 9MB)
    python pocket_baseball/tools/build_single.py --lite       # 2D だけの軽い版 (約 3MB)
    python pocket_baseball/tools/build_single.py --fragment   # <html>/<head>/<body> を含まない断片

まとめた HTML はサーバー無しで動くので、スマホに送ってブラウザで開くだけで遊べる。
3D 版は three.js・選手モデル (models/) も埋め込む。書体だけは Google Fonts から読む (オフラインでは代わりの書体)。
"""

import argparse
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "static"


def data_uri(path: Path) -> str:
    mime = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".bin": "application/octet-stream"}[path.suffix]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build(fragment: bool, lite: bool = False) -> str:
    index = (STATIC / "index.html").read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", index, re.S)
    assert title, "index.html に <title> がありません"
    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts[^"]+)">', index)
    assert fonts, "フォントの <link> が見つかりません"
    body = re.search(r"<body>(.*?)<!-- build:scripts -->", index, re.S)
    assert body, "index.html の <body> が見つかりません"
    scripts = re.findall(r'<script src="((?:js|vendor)/[^"]+)"></script>', index)
    # 軽い版は 3D 表示 (three.js とモデル) を入れず 2D で動かす
    if lite:
        scripts = [s for s in scripts if not s.startswith(("js/three/", "vendor/"))]
    css = (STATIC / "css" / "style.css").read_text(encoding="utf-8")
    js = "\n".join(
        f"/* --- {name} --- */\n" + (STATIC / name).read_text(encoding="utf-8")
        for name in scripts
    )
    # 球団マークなどの画像は data URI にして埋め込む
    js = re.sub(r'"(img/[^"]+\.(?:webp|png|jpg))"', lambda m: '"' + data_uri(STATIC / m.group(1)) + '"', js)
    # </script> がスクリプト中に現れても HTML が壊れないようにする
    js = js.replace("</script", "<\\/script")
    head = (
        f"<title>{title.group(1)}</title>\n"
        f'<link rel="stylesheet" href="{fonts.group(1)}">\n'
        f"<style>\n{css}\n</style>\n"
    )
    # 名前を組み立てて読む画像 (球団マーク) は表にして渡す
    assets = {
        f"img/teams/{p.name}": data_uri(p) for p in sorted((STATIC / "img" / "teams").glob("*.webp"))
    }
    # 3D の選手モデル (human.js が models/ から読むもの)
    if not lite:
        assets.update({f"models/{p.name}": data_uri(p) for p in sorted((STATIC / "models").iterdir()) if p.suffix in (".json", ".bin", ".jpg")})
    page = (
        f"{body.group(1).strip()}\n"
        "<script>window.PB_STANDALONE = true;\n"
        f"window.PB_ASSETS = {json.dumps(assets)};</script>\n"
        f"<script>\n{js}\n</script>\n"
    )
    if fragment:
        return head + page
    return (
        "<!doctype html>\n"
        '<html lang="ja">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, '
        'maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#08111f">\n'
        f"{head}</head>\n<body>\n{page}</body>\n</html>\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fragment", action="store_true", help="断片として出力する")
    parser.add_argument("--lite", action="store_true", help="3D を入れない軽い版 (2D だけ)")
    parser.add_argument("-o", "--output", type=Path, help="出力先")
    args = parser.parse_args()
    out = args.output or ROOT / "dist" / "pocket_baseball.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(args.fragment, args.lite), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
