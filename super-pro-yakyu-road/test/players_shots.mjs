import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
const pw = require('playwright');
const OUT = '/home/user/fastapi/super-pro-yakyu-road/test/out';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto('http://localhost:8790/test/players.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
for (const k of ['poses', 'bat', 'face']) { await p.evaluate((k) => window.__scene(k), k); await p.screenshot({ path: `${OUT}/pl_${k}.png` }); }
console.log(errors.length ? errors.slice(0, 5).join('\n') : 'no errors');
await b.close();
