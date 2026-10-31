// スーパープロ野球ロード 3D: the menus over the 3D stadium (title with the practice batter and pitcher, team select, hub,
// standings) — screenshots and no errors
import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
const pw = require('playwright');
const OUT = '/home/user/fastapi/super-pro-yakyu-road/test/out';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 760 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8790/index.html');
await page.waitForFunction(() => window.__spr && window.__ff);
await page.evaluate(() => { window.__pause(true); try { localStorage.clear(); } catch (e) {} });
const ff = (n) => page.evaluate((n) => window.__ff(n), n);
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.evaluate(async (k) => { const g = window.__spr.g; g.input.press(k); await window.__ff(2); g.input.release(k); await window.__ff(4); }, k); };
const shot = async (name) => { await ff(1); await page.screenshot({ path: `${OUT}/${name}.png` }); };
await ff(200); await shot('mn_title');
await ff(170); await shot('mn_title2');
await key('a'); await ff(5); await shot('mn_team');
await key('a'); await key('a'); await key('a'); await ff(10); await shot('mn_hub');
await key('down', 3); await key('a'); await ff(5); await shot('mn_standings'); await key('b');
// a match, then back to the menus (the stadium must come back to the orbit)
await key('up', 3); await key('a'); await ff(60);
await page.evaluate(async () => { const m = window.__spr.g.top; m.menu = null; m.auto = { mode: 'all', inn: 1 }; for (let i = 0; i < 400 && m.ph !== 'over'; i++) await window.__ff(10); });
await ff(40); await key('a'); await ff(30); await shot('mn_hub_after');
console.log(JSON.stringify(await page.evaluate(() => ({ top: window.__spr.g.top.constructor.name, mode: window.__spr.g.world.mode }))));
console.log(errors.length ? errors.slice(0, 8).join('\n') : 'no errors');
await b.close();
