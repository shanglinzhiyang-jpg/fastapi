// the look: a phone held sideways (the pad over the picture) and the restyled tables — screenshots, no errors
import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
const pw = require('playwright');
const OUT = '/home/user/fastapi/super-pro-yakyu-road/test/out';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function run(name, vp, touch, steps) {
  const page = await b.newPage({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8790/index.html' + (touch ? '?touch=1' : ''));
  await page.waitForFunction(() => window.__spr && window.__ff);
  await page.evaluate(() => { window.__pause(true); try { localStorage.clear(); } catch (e) {} });
  const ff = (n) => page.evaluate((n) => window.__ff(n), n);
  const shot = async (n) => { await ff(2); await page.screenshot({ path: `${OUT}/${name}_${n}.png` }); };
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.evaluate(async (k) => { const g = window.__spr.g; g.input.press(k); await window.__ff(2); g.input.release(k); await window.__ff(4); }, k); };
  await steps({ page, ff, shot, key });
  await page.close();
}
await run('land', { width: 844, height: 390 }, true, async ({ page, ff, shot, key }) => {
  await ff(60); await shot('title');
  await key('a'); await key('a'); await key('a'); await key('a'); await ff(10); await shot('hub');
  await page.evaluate(async () => { const g = window.__spr.g, h = g.top; h.sel = 0; h.pick(h.items()[0]); await window.__ff(150); const m = g.top; m.startPA(); m.nextPitch(); await window.__ff(60); });
  await shot('match');
  console.log('canvas', JSON.stringify(await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return [r.width, r.height]; })));
});
await run('pc', { width: 1280, height: 760 }, false, async ({ page, ff, shot, key }) => {
  await ff(20); await key('a'); await key('a'); await key('a'); await key('a'); await ff(10);
  await page.evaluate(() => { const { advanceDay } = window.__spr.league; const L = window.__spr.g.top.L; for (let i = 0; i < 20; i++) advanceDay(L, null, true); L.front.pending = []; });
  for (const id of ['stand', 'roster', 'lead', 'res']) {
    await page.evaluate((id) => { const g = window.__spr.g, h = g.top; h.sel = h.items().findIndex((x) => x.id === id); h.pick(h.items()[h.sel]); }, id);
    await shot(id); await key('b');
  }
  // a game played to the end (auto)
  await page.evaluate(async () => { const g = window.__spr.g, h = g.top; h.sel = 0; h.pick(h.items()[0]); await window.__ff(100); const m = g.top; m.auto = { mode: 'all', inn: 1 }; for (let i = 0; i < 400 && m.ph !== 'over'; i++) await window.__ff(10); await window.__ff(30); });
  await shot('over');
});
console.log(errors.length ? errors.slice(0, 8).join('\n') : 'no errors');
await b.close();
