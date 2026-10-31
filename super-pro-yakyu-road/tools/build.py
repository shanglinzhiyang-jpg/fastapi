# Build one self-contained HTML file (CSS inline, the ES modules bundled by esbuild) for sharing / phones.
# usage: python3 tools/build.py OUT.html
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'super-pro-yakyu-road.html')
tmp = tempfile.mkdtemp()
js = os.path.join(tmp, 'game.js')
subprocess.run(['npx', '-y', 'esbuild@0.24.0', os.path.join(ROOT, 'js/main.js'), '--bundle', '--format=iife', '--minify', '--target=es2020', '--outfile=' + js], check=True)
css = open(os.path.join(ROOT, 'style.css'), encoding='utf-8').read()
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
code = open(js, encoding='utf-8').read()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css.replace('</', '<\\/') + '\n</style>')
html, n = re.subn(r'<script type="module" src="js/main.js"></script>', lambda m: '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>', html)
assert n == 1
# the club marks (kept out of git): embedded when assets/logos/logos.js is there, otherwise the tag is dropped
lp = os.path.join(ROOT, 'assets/logos/logos.js')
tag = '<script src="assets/logos/logos.js" onerror="void 0"></script>'
html = html.replace(tag, ('<script>\n' + open(lp, encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>') if os.path.exists(lp) else '')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html.encode()), 'bytes')
