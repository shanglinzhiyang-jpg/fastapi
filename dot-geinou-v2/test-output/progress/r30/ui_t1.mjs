// R30: the 生活 screen opens on every tab without errors (screenshots), for a 20-year-old and a 16-year-old high-school student
import { open, shotCanvas } from '../../r8l1/h.mjs';
const OUT = process.argv[2] || '/home/user/fastapi/dot-geinou-v2/test-output/progress/r30';
const age = Number(process.argv[3] || 20);
const { browser, page, errors } = await open('?test=1&rich=1&place=home', { viewport: { width: 1280, height: 720 } });
const r = await page.evaluate(async (age) => {
  const g = window.__game;
  g.state.flags.navi_intro = true;
  g.state.profile.age = age;
  g.state.flags.ls = undefined;
  const st = g.lifeStage();
  return { stage: st && st.id, label: st && st.label, acts: g.lifeActions().map((a) => a.id + (a.why ? '!' : '')).join(','), kids: g.lifeKids().length, parent: g.lifeParent().name };
}, age);
console.log(JSON.stringify(r));
await page.evaluate(() => { window.__bg(async (g) => { await g.lifeScreen(); }); });
await page.evaluate(() => window.__ff(20));
const tabs = ['today', 'career', 'kids', 'hist', 'money'];
for (let i = 0; i < tabs.length; i++) {
  await page.evaluate(() => window.__ff(8));
  await shotCanvas(page, `${OUT}/life_${age}_${tabs[i]}.png`);
  await page.evaluate(async () => { const g = window.__game; g.input.press('right', 't'); await window.__ff(2); g.input.release('right', 't'); await window.__ff(4); });
}
console.log(errors.length ? errors.slice(0, 6).join('\n') : 'no errors');
await browser.close();
