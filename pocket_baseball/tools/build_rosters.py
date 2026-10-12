"""static/data/npb2004/*.json (2004 年の実在選手の名簿) を 1 本の JS にまとめる。

python3 tools/build_rosters.py  →  static/js/rosters2004.js (PB.D.ROSTERS)
"""
import glob
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "static")
out = {}
for f in sorted(glob.glob(os.path.join(ROOT, "data", "npb2004", "*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    out[d["id"]] = d
js = "/* 2004 年の NPB 12 球団の名簿 (tools/build_rosters.py で static/data/npb2004/*.json から生成) */\n"
js += "(function (PB) {\n  PB.D.ROSTERS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n})((window.PB = window.PB || {}));\n"
open(os.path.join(ROOT, "js", "rosters2004.js"), "w", encoding="utf-8").write(js)
print(len(out), "teams", len(js), "bytes")
