// スーパープロ野球ロード: title → new pennant → hub → a played game (batting, pitching, a ball in play) → auto to the end →
// standings, players, leaders — screenshots and no errors
import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const OUT = '/home/user/fastapi/super-pro-yakyu-road/test/out';
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
const touch = process.argv.includes('touch');
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: touch ? { width: 412, height: 915 } : { width: 1280, height: 760 }, hasTouch: touch, isMobile: touch });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8790/index.html' + (touch ? '?touch=1' : ''));
await page.waitForFunction(() => window.__spr && window.__ff);
await page.evaluate(() => { window.__pause(true); try { localStorage.clear(); } catch (e) {} });
const ff = (n) => page.evaluate((n) => window.__ff(n), n);
const key = async (k, n = 1, hold = 2) => { for (let i = 0; i < n; i++) await page.evaluate(async ([k, hold]) => { const g = window.__spr.g; g.input.press(k); await window.__ff(hold); g.input.release(k); await window.__ff(4); }, [k, hold]); };
const shot = async (name) => { await ff(2); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }); };
const top = () => page.evaluate(() => { const s = window.__spr.g.top; return { name: s && s.constructor.name, ph: s && s.ph, step: s && s.step }; });
await ff(30); await shot('01_title');
await key('a'); await ff(5); await shot('02_team');
await key('right', 2); await key('a'); await shot('03_games');
await key('down'); await key('a'); await shot('04_balance');
await key('a'); await ff(10); await shot('05_hub');
console.log('hub', JSON.stringify(await top()));
// play today's game
await key('a'); await ff(100); await shot('06_intro');
let batShot = 0, pitShot = 0, bipShot = 0, steps = 0;
for (let i = 0; i < 400 && steps < 60; i++) {
  const t = await top();
  if (t.name !== 'Match') break;
  if (t.ph === 'flight') {
    const my = await page.evaluate(() => window.__spr.g.top.myBat);
    if (my) { if (!batShot) { await ff(12); await shot('07_batting'); batShot = 1; } await page.evaluate(async () => { const m = window.__spr.g.top; const pi = m.pi; m.cur.x = pi.fx; m.cur.y = pi.fy - 0.15; while (m.ph === 'flight' && m.t < pi.dur - 1) await window.__ff(1); }); await key('a', 1, 1); }
    else await ff(10);
  } else if (t.ph === 'select') { if (!pitShot) { await shot('08_select'); pitShot = 1; } await key('down'); await key('a'); }
  else if (t.ph === 'aim') { await key('right', 3); if (pitShot === 1) { await shot('09_aim'); pitShot = 2; } await key('a'); steps++; }
  else if (t.ph === 'bip') { if (bipShot < 2) { await ff(bipShot ? 60 : 20); await shot(`10_bip${bipShot}`); bipShot++; } await ff(30); }
  else if (t.ph === 'result' && bipShot && bipShot < 3) { await shot('11_result'); bipShot = 3; await key('a'); }
  else await key('a');
}
console.log('after manual', JSON.stringify(await top()), await page.evaluate(() => { const GS = window.__spr.g.top.GS; return GS ? `${GS.inning}${GS.top ? '表' : '裏'} ${GS.score.away}-${GS.score.home}` : ''; }));
// START → auto to the end
await key('start'); await shot('12_menu');
await key('down', 2); await key('a');
for (let i = 0; i < 300; i++) { const t = await top(); if (t.ph === 'over') break; await ff(20); }
await ff(40); await shot('13_over');
await key('a'); await ff(10); await shot('14_hub_after');
console.log('back', JSON.stringify(await top()), await page.evaluate(() => { const L = window.__spr.g.top.L; return `day ${L.day} ${JSON.stringify(L.teams[L.myTeam].w)}-${L.teams[L.myTeam].l}`; }));
// skip a week, standings, roster, leaders
await key('down', 2); await key('a'); await ff(10);
await key('down'); await key('a'); await shot('15_standings'); await key('b');
await key('down'); await key('a'); await shot('16_roster'); await key('a'); await key('down', 2); await shot('17_roster_p'); await key('b');
await key('down'); await key('a'); await shot('18_leaders'); await key('right'); await shot('19_leaders_hr'); await key('b');
console.log(errors.length ? errors.slice(0, 8).join('\n') : 'no errors');
await browser.close();
