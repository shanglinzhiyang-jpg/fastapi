// R29: every minigame whose content pool grew still starts, plays with random keys and reaches its result
import { open } from '../../r8l1/h.mjs';
const CASES = [
  ['tsukkomi', {}], ['tsukkomi', { difficulty: 3 }],
  ['talk', { topic: 'variety' }], ['talk', { topic: 'local' }], ['talk', { topic: 'radio' }], ['talk', { topic: 'news' }], ['talk', { topic: 'drama' }],
  ['announce', {}], ['announce', { difficulty: 4 }],
  ['ogiri', { mode: 'zabuton' }], ['ogiri', { mode: 'ippon' }], ['ogiri', { mode: 'flip' }],
  ['manzai', {}], ['conte', {}], ['zukko', {}], ['command', { theme: 'acting' }], ['quiz', {}], ['quiz', { category: 'osaka' }],
];
const { browser, page, errors } = await open('?test=1&rich=1&place=kyoshujo', { viewport: { width: 1000, height: 640 } });
await page.evaluate(() => { window.__game.state.flags.navi_intro = true; });
const keys = ['a', 'a', 'up', 'down', 'left', 'right', 'b', 'a'];
let bad = 0;
for (const [id, opts] of CASES) {
  const r = await page.evaluate(async ([id, opts, keys]) => {
    const g = window.__game;
    window.__res = undefined; window.__bgDone = false;
    window.__bg(async (gg) => { window.__res = await gg.minigame(id, opts); });
    let i = 0, top = '';
    while (!window.__bgDone && i < 9000) {
      await window.__ff(4);
      const k = keys[(i >> 2) % keys.length];
      g.input.press(k, 't'); await window.__ff(2); g.input.release(k, 't');
      i += 8;
      top = g.top && g.top.constructor && g.top.constructor.name;
    }
    return { done: !!window.__bgDone, frames: i, top, res: window.__res && { score: window.__res.score, grade: window.__res.grade } };
  }, [id, opts, keys]);
  const ok = r.done;
  if (!ok) bad++;
  console.log(ok ? 'OK ' : 'NG ', id, JSON.stringify(opts), JSON.stringify(r));
  await page.evaluate(async () => { if (window.__closeAll) await window.__closeAll(); });
}
console.log('page errors:', errors.length ? errors.slice(0, 8).join('\n') : 'none', '| not finished:', bad);
await browser.close();
