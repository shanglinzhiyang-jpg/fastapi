// R30: the 生活 screen by keys: do an action (info modal), 子育て with two children, 生い立ち through the screen's own modals,
// a company worker's キャリア, the 家計 after some weeks; then a portrait phone (the lower screen) — screenshots + no errors
import { open, shotCanvas } from '../../r8l1/h.mjs';
const OUT = '/home/user/fastapi/dot-geinou-v2/test-output/progress/r30';
const portrait = process.argv.includes('portrait');
const { browser, page, errors } = await open('?test=1&rich=1&place=home' + (portrait ? '&touch=1' : ''), { viewport: portrait ? { width: 412, height: 915 } : { width: 1280, height: 720 } });
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.evaluate(async (k) => { const g = window.__game; g.input.press(k, 't'); await window.__ff(2); g.input.release(k, 't'); await window.__ff(5); }, k); };
const shot = async (n) => { await page.evaluate(() => window.__ff(6)); if (portrait) await page.screenshot({ path: `${OUT}/p_${n}.png` }); else await shotCanvas(page, `${OUT}/u2_${n}.png`); };
const top = () => page.evaluate(() => { const s = window.__lifeui.scene(); return s ? { tab: s.tabId, modal: s.modal && s.modal.kind, sel: s.sel[s.tabId] | 0, title: s.modal && s.modal.title } : null; });
await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.flags.navi_intro = true; st.profile.age = 34; st.profile.gender = 'f'; st.flags.ls = undefined; st.money = 300000;
  st.flags.rom = { kids: [{ id: 'kA', n: '湊', g: 'm', b: st.day - 7 * 120 - 30, ls: 1, by: 'player', d: { miya: 1, okui: 1, b1: 1, y2: 1, y3: 1, y6: 1 } }, { id: 'kB', n: '紬', g: 'f', b: st.day - 13 * 120 - 10, ls: 2, by: 'player', d: { miya: 1, okui: 1, b1: 1, y2: 1, y3: 1, y6: 1, y12: 1 } }] };
  window.__ls.startJob(g, 'koukoku');
  const L = st.flags.ls; L.job.rank = 3; L.job.evals = [{ d: 1, score: 4 }]; L.job.leave = 12;
  L.ledger = [{ w: 1, items: [['給料', 54000], ['家賃の支払い', -8000]] }, { w: 2, items: [['給料', 54000], ['湊のピアノ', -2500], ['紬の塾', -4800]] }, { w: 3, items: [['給料', 43200], ['夏のボーナス', 120000]] }];
  window.__ls.addInbox(g, { kind: 'reunion', title: '同窓会の案内', text: '高校の同窓会の案内がきた。', choices: ['参加する（¥6,000）', '今回は欠席する'], def: 1, days: 10 });
  window.__bg(async (gg) => { await gg.lifeScreen(); });
});
await page.evaluate(() => window.__ff(20));
console.log('open', JSON.stringify(await top()));
await shot('today');
// the inbox item → pick → result
await key('a'); await shot('inbox_pick'); console.log(JSON.stringify(await top()));
await key('a'); await page.evaluate(() => window.__ff(20)); await shot('inbox_result'); console.log(JSON.stringify(await top()));
await key('a');
// an action: 出勤する is first (work day?) — go down to 運動する and do it
await key('down', 3); await key('a'); await page.evaluate(() => window.__ff(30)); await shot('act_result'); console.log(JSON.stringify(await top())); await key('a');
// キャリア
await key('right'); await shot('career');
// 子育て: select the second child, do something
await key('right'); await shot('kids');
await key('down'); await shot('kids_sel2');
await key('down', 2); await key('a'); await page.evaluate(() => window.__ff(20)); await shot('kid_act'); console.log(JSON.stringify(await top())); await key('a');
// 年表 → 生い立ち
await key('right');
const hsel = await page.evaluate(() => { const s = window.__lifeui.scene(); return s.sel[s.tabId] | 0; });
await key('up', hsel); // to the top row (生い立ち)
await key('a'); await shot('origin_start'); console.log(JSON.stringify(await top()));
let pages = 0, picks = 0, shotPage = false, shotPick = false;
for (let i = 0; i < 160; i++) {
  const t = await top();
  if (!t || !t.modal) break;
  if (t.modal === 'page' || t.modal === 'info' || t.modal === 'scene') { pages++; await page.evaluate(() => window.__ff(14)); if (!shotPage && pages === 2) { await shot('origin_page'); shotPage = true; } if (pages === 9) await shot('origin_page_school'); await key('a'); }
  else { picks++; if (!shotPick && picks === 4) { await shot('origin_pick'); shotPick = true; } if (picks > 1) await key('down', picks % 3); await key('a'); }
}
console.log('origin pages', pages, 'picks', picks, JSON.stringify(await page.evaluate(() => window.__game.state.flags.ls.origin)));
await shot('hist_after');
await key('right'); await shot('money');
// B closes
await key('b');
console.log('closed', JSON.stringify(await top()), 'top', await page.evaluate(() => window.__game.top && window.__game.top.constructor.name));
console.log(errors.length ? errors.slice(0, 6).join('\n') : 'no errors');
await browser.close();
