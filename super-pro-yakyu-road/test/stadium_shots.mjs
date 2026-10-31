import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
const pw = require('playwright');
const OUT = '/home/user/fastapi/super-pro-yakyu-road/test/out';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto('http://localhost:8790/test/stadium.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
const views = (process.argv[2] || 'catcher,high,orbit,look').split(',');
for (const v of views) {
  for (const night of [false, true]) {
    await p.evaluate(([v, night]) => window.__shot(v, v === 'look' ? { from: [30, -12, 6], to: [0, 30, 0], fov: 50 } : v === 'orbit' ? { a: 2.6 } : {}, night), [v, night]);
    await p.screenshot({ path: `${OUT}/st_${v}_${night ? 'n' : 'd'}.png` });
  }
}
console.log(errors.length ? errors.slice(0, 5).join('\n') : 'no errors');
await b.close();
