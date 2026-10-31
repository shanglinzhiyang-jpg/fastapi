// the single-file build boots on a portrait phone (touch pad shown), starts a pennant and skips a week without errors
import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
const pw = require('playwright');
const file = process.argv[2];
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__spr);
await page.evaluate(() => window.__pause(true));
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.evaluate(async (k) => { const g = window.__spr.g; g.input.press(k); await window.__ff(2); g.input.release(k); await window.__ff(4); }, k); };
await page.evaluate(() => window.__ff(20));
await page.screenshot({ path: '/home/user/fastapi/super-pro-yakyu-road/test/out/p_title.png' });
await key('a'); await key('a'); await key('a'); await key('a'); await page.evaluate(() => window.__ff(10));
await key('down', 2); await key('a'); await page.evaluate(() => window.__ff(10));
await page.screenshot({ path: '/home/user/fastapi/super-pro-yakyu-road/test/out/p_hub.png' });
const r = await page.evaluate(() => { const s = window.__spr.g.top; return { scene: s.constructor.name, day: s.L && s.L.day, touch: document.body.classList.contains('touch') }; });
// today's game on the 3D field
await key('up', 2); await key('a'); await page.evaluate(() => window.__ff(120));
await key('a'); await page.evaluate(() => window.__ff(60));
await page.screenshot({ path: '/home/user/fastapi/super-pro-yakyu-road/test/out/p_match.png' });
const m = await page.evaluate(() => { const g = window.__spr.g, s = g.top; return { scene: s.constructor.name, ph: s.ph, world: !!g.world, gl: g.world && g.world.canvas.style.visibility }; });
console.log(JSON.stringify(r), JSON.stringify(m), errors.length ? errors.slice(0, 5) : 'no errors');
await browser.close();
