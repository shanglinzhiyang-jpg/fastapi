"""ゲームを 1 つの HTML ファイルにまとめる。

    python pocket_baseball/tools/build_single.py              # dist/pocket_baseball.html
    python pocket_baseball/tools/build_single.py --fragment   # <html>/<head>/<body> を含まない断片

まとめた HTML はサーバー無しで動くので、スマホに送ってブラウザで開くだけで遊べる。
"""

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "static"


def build(fragment: bool) -> str:
    index = (STATIC / "index.html").read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", index, re.S)
    assert title, "index.html に <title> がありません"
    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts[^"]+)">', index)
    assert fonts, "フォントの <link> が見つかりません"
    body = re.search(r"<body>(.*?)<!-- build:scripts -->", index, re.S)
    assert body, "index.html の <body> が見つかりません"
    scripts = re.findall(r'<script src="(js/[^"]+)"></script>', index)
    css = (STATIC / "css" / "style.css").read_text(encoding="utf-8")
    js = "\n".join(
        f"/* --- {name} --- */\n" + (STATIC / name).read_text(encoding="utf-8")
        for name in scripts
    )
    # </script> がスクリプト中に現れても HTML が壊れないようにする
    js = js.replace("</script", "<\\/script")
    head = (
        f"<title>{title.group(1)}</title>\n"
        f'<link rel="stylesheet" href="{fonts.group(1)}">\n'
        f"<style>\n{css}\n</style>\n"
    )
    page = (
        f"{body.group(1).strip()}\n"
        "<script>window.PB_STANDALONE = true;</script>\n"
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
    parser.add_argument("-o", "--output", type=Path, help="出力先")
    args = parser.parse_args()
    out = args.output or ROOT / "dist" / "pocket_baseball.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(args.fragment), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
