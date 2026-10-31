// 球団運営 screens in the browser: the menu, every sub-screen, a decision box, the off-season — screenshots, no errors
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
const shot = async (name) => { await ff(2); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.evaluate(async (k) => { const g = window.__spr.g; g.input.press(k); await window.__ff(2); g.input.release(k); await window.__ff(4); }, k); };
await ff(20); await key('a'); await key('a'); await key('a'); await key('a'); await ff(10);
// a week in, so there is something to see
await page.evaluate(async () => { const { advanceDay } = window.__spr.league; const L = window.__spr.g.top.L; for (let i = 0; i < 12; i++) advanceDay(L, null, true); L.front.pending = []; });
await shot('fr_hub');
await page.evaluate(async () => { const g = window.__spr.g, h = g.top; h.sel = h.items().findIndex((x) => x.id === 'front'); h.pick(h.items()[h.sel]); });
await shot('fr_menu');
const names = ['money', 'trade', 'tier', 'rw', 'waiver', 'cond', 'mgr', 'ball', 'dark', 'union', 'news'];
for (let i = 0; i < names.length; i++) {
  await page.evaluate(async (i) => { const g = window.__spr.g, m = g.top; m.sel = i; m.pick(m.items()[i]); await window.__ff(3); }, i);
  await shot(`fr_${names[i]}`);
  await page.evaluate(async () => { const g = window.__spr.g; while (g.top && g.top.o && g.top.o.title !== '球団運営' || (g.top && !g.top.o)) { g.pop(); await window.__ff(1); } });
}
// a trade flow: swap → team → player → mine
await page.evaluate(async () => { const g = window.__spr.g, m = g.top; m.sel = 1; m.pick(m.items()[1]); await window.__ff(2); const t = g.top; t.sel = 0; t.pick(t.items()[0]); await window.__ff(2); const tp = g.top; tp.sel = 2; tp.pick(tp.items()[2]); await window.__ff(2); });
await shot('fr_trade_players');
await page.evaluate(async () => { const g = window.__spr.g; while (g.top && g.top.o && g.top.o.title !== '球団運営') { g.pop(); await window.__ff(1); } });
// the dark side on, a decision box
await page.evaluate(async () => { const g = window.__spr.g, L = g.top.L; const F = await import('/js/front.js'); F.setCheat(L, 'steroid', true); L.front.pending.push({ type: 'demand', pid: L.teams[L.myTeam].roster[20] }); g.pop(); await window.__ff(2); g.top.after(); await window.__ff(3); });
await shot('fr_demand');
await page.evaluate(async () => { const g = window.__spr.g; g.top.choose(1); await window.__ff(3); });
// the off-season
await page.evaluate(async () => { const { advanceDay } = window.__spr.league; const g = window.__spr.g; while (g.top.constructor.name !== 'Hub' && g.scenes.length > 1) g.pop(); const L = g.top.L; while (!L.over) advanceDay(L, null, true); L.front.pending = []; L.endShown = true; const h = g.top; h.sel = h.items().findIndex((x) => x.id === 'off'); h.pick(h.items()[h.sel]); await window.__ff(3); });
await shot('fr_off');
for (const [i, n] of [[0, 'talk'], [1, 'fa'], [3, 'try']]) {
  await page.evaluate(async (i) => { const g = window.__spr.g, m = g.top; m.sel = i; m.pick(m.items()[i]); await window.__ff(3); }, i);
  await shot(`fr_off_${n}`);
  await page.evaluate(async () => { const g = window.__spr.g; g.pop(); await window.__ff(1); });
}
await page.evaluate(async () => { const g = window.__spr.g, m = g.top; m.sel = 5; m.pick(m.items()[5]); await window.__ff(3); g.top.choose(0); await window.__ff(5); });
await shot('fr_newseason');
console.log(JSON.stringify(await page.evaluate(() => { const g = window.__spr.g, L = g.top.L; return { top: g.top.constructor.name, year: L.year, day: L.day, over: L.over }; })));
console.log(errors.length ? errors.slice(0, 8).join('\n') : 'no errors');
await b.close();
