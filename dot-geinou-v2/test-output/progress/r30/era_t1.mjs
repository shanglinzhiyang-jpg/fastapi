// R30: the life stages follow the era — 昭和 (1980s): Saturday classes, 共通一次, no IT companies, the bubble job market, older play
import { open } from '../../r8l1/h.mjs';
const { browser, page, errors } = await open('?test=1&rich=1&place=home', { viewport: { width: 800, height: 600 } });
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok  ' : 'NG  ') + m); };
const r = await page.evaluate(async () => {
  const g = window.__game, st = g.state, D = window.__ls.D;
  st.profile.era = 'showa'; for (const k of ['politics', 'regime', 'govt']) delete st[k]; st.day = 1; st.profile.age = 16; st.flags.ls = undefined; g.pol();
  const y0 = g.gameDate().year;
  // find a Saturday in term time
  let sat = null;
  for (let d = 1; d < 60 && !sat; d++) { const du = window.__ls.dutyOf(g, d); if (du && du.half) sat = { d, label: du.label }; }
  let seed = 3; window.__ls.setRng(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  const L = st.flags.ls; L.shk = { pts: 99, offers: [], chosen: null };
  const inds = new Set();
  // 中途 offers as an adult in 1987-
  st.profile.age = 30; L.high = null;
  for (let i = 0; i < 60; i++) { st.stamina = 100; L.today.did = {}; const r0 = g.lifeAct('shukatsu'); for (const it of g.lifeInbox()) { if (it.kind === 'offer') inds.add(it.data.ind); g.lifeRespond(it.id, 1); } }
  return { y0, sat, test: D.entranceTest(y0), market: D.jobMarket(1989).name, play: D.childPlay(y0 - 20), inds: [...inds], lessons: D.lessonsFor(y0), rule: D.shukatsuRule(y0).text };
});
console.log(JSON.stringify(r));
ok(r.y0 < 1990, `昭和の年 ${r.y0}`);
ok(r.sat && /土曜/.test(r.sat.label), `土曜も授業（半日）${JSON.stringify(r.sat)}`);
ok(r.test === '共通一次試験', `入試の名前 ${r.test}`);
ok(r.market === 'バブル景気の売り手市場', `就職状況 ${r.market}`);
ok(!r.inds.includes('it') && r.inds.length >= 2, `IT企業はまだない（内定 ${r.inds}）`);
ok(!r.lessons.includes('program') && !r.lessons.includes('dance'), `習いごとの時代 ${r.lessons}`);
console.log('page errors:', errors.length ? errors.slice(0, 5).join('\n') : 'none');
console.log(fails.length ? `FAIL ${fails.length}: ${fails.join(' / ')}` : 'ALL PASS');
await browser.close();
