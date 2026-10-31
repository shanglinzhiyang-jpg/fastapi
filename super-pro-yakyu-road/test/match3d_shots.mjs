// スーパープロ野球ロード 3D: the match screens on the 3D field — batting (the pitch in flight, the meet cursor), pitching (the
// pitch menu, the aim), a ball in play (the broadcast camera), a night game — screenshots and no errors.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/fastapi/dot-geinou-v2/tools/lib.mjs');
const pw = require('playwright');
const OUT = '/home/user/fastapi/super-pro-yakyu-road/test/out';
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 760 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8790/index.html');
await page.waitForFunction(() => window.__spr && window.__ff);
await page.evaluate(() => { window.__pause(true); try { localStorage.clear(); } catch (e) {} });
const ff = (n) => page.evaluate((n) => window.__ff(n), n);
const shot = async (name) => { await ff(1); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const has3d = await page.evaluate(() => !!window.__spr.g.world);
console.log('3d', has3d);
// a match where you bat first (your club is the visitor), a day game
await page.evaluate(async () => {
  const { Match } = await import('/js/scenes/match.js');
  const g = window.__spr.g, L = window.__spr.league.newLeague({ myTeam: 'baystars', games: 30, seed: 7 });
  L.day = 3; // day game
  window.__L = L;
  const m = new Match(g, L, { home: 'tigers', away: 'baystars' });
  g.push(m); m.startPA(); m.nextPitch();
});
await ff(30); await shot('m3_bat_windup');
await page.evaluate(async () => { const m = window.__spr.g.top; while (m.ph === 'windup') await window.__ff(1); m.cur.x = m.pi.fx * 0.6; m.cur.y = m.pi.fy * 0.6; await window.__ff(Math.round(m.pi.dur * 0.7)); });
await shot('m3_bat_flight');
// a swing on time and on the ball → a ball in play
for (let tries = 0; tries < 8; tries++) {
  const ph = await page.evaluate(async () => {
    const m = window.__spr.g.top;
    while (m.ph !== 'windup' && m.ph !== 'flight') { if (m.ph === 'bip') return 'bip'; if (m.ph === 'pa' || m.ph === 'call' || m.ph === 'result' || m.ph === 'change') { window.__spr.g.input.press('a'); await window.__ff(2); window.__spr.g.input.release('a'); await window.__ff(2); } else await window.__ff(1); }
    while (m.ph === 'windup') await window.__ff(1);
    const pi = m.pi;
    while (m.ph === 'flight' && m.t < pi.dur - 1) await window.__ff(1);
    m.swing = { frame: pi.dur, x: pi.fx, y: pi.fy + 0.05, power: false };
    await window.__ff(2);
    return m.ph;
  });
  if (ph === 'bip') break;
}
await ff(1); await shot('m3_bip_start');
await ff(25); await shot('m3_bip_mid');
await page.evaluate(async () => { const m = window.__spr.g.top; while (m.ph === 'bip' && m.bip.t < m.bip.hang + 5) await window.__ff(1); });
await shot('m3_bip_end');
// pitching: your club at home, a night game
await page.evaluate(async () => {
  const { Match } = await import('/js/scenes/match.js');
  const g = window.__spr.g; g.pop();
  const L = window.__L; L.day = 4;
  const m = new Match(g, L, { home: 'baystars', away: 'giants' });
  g.push(m); m.startPA(); m.nextPitch();
});
await ff(5); await shot('m3_pit_select');
await page.evaluate(async () => { const m = window.__spr.g.top; m.sel = 1; m.set('aim'); m.aim.x = 0.7; m.aim.y = 0.5; await window.__ff(3); });
await shot('m3_pit_aim');
await page.evaluate(async () => { const m = window.__spr.g.top; m.throwPitch(); await window.__ff(40); });
await shot('m3_pit_windup');
await page.evaluate(async () => { const m = window.__spr.g.top; while (m.ph === 'windup') await window.__ff(1); await window.__ff(Math.round(m.pi.dur * 0.55)); });
await shot('m3_pit_flight');
await page.evaluate(async () => { const m = window.__spr.g.top; while (m.ph === 'flight') await window.__ff(1); await window.__ff(3); });
await shot('m3_pit_call');
console.log(errors.length ? errors.slice(0, 8).join('\n') : 'no errors');
await b.close();
