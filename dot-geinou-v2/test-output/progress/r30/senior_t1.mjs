// R31: シニア — a 58-year-old 部長: 還暦, 定年 (退職金, 再雇用 to 70 in 令和), 年金 at 65, 古希, the end of 再雇用,
// grandchildren from a grown child, the senior actions (趣味・ボランティア・孫・自分史), and 1980s rules (定年55/60)
import { open } from '../../r8l1/h.mjs';
const { browser, page, errors } = await open('?test=1&rich=1&place=home', { viewport: { width: 800, height: 600 } });
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok  ' : 'NG  ') + m); };
const r = await page.evaluate(async () => {
  const g = window.__game, st = g.state, LS = window.__ls;
  st.flags.navi_intro = true; st.profile.age = 58; st.profile.gender = 'm'; st.flags.ls = undefined; st.money = 100000;
  let seed = 11; LS.setRng(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  LS.startJob(g, 'maker'); const L = st.flags.ls; L.job.rank = 6; L.coDays = 120 * 34;
  st.flags.rom = { kids: [{ id: 'kG', n: '大輔', g: 'm', b: st.day - 27 * 120, ls: 1, by: 'player', d: { miya: 1, okui: 1, b1: 1, y2: 1, y3: 1, y6: 1, y12: 1, y15: 1, y18: 1 } }] };
  const kidS = window.__lsKids.kidState(g, st.flags.rom.kids[0]); kidS.after = { kind: 'work', ind: 'bank', since: 1 };
  const step = async () => { st.day++; st.stamina = st.maxStamina; Object.assign(st.life, { hunger: 80, stress: 20, clean: 80 }); if (st.clock) st.clock.min = 420; await g.morning(80, {}); g.morningNotes = []; };
  const out = { inbox: [], money: [], acts: {}, stages: [] };
  let lastStage = '';
  const m0 = st.money;
  for (let i = 0; i < 1500; i++) {
    await step();
    const s = g.lifeStage();
    if (s.label !== lastStage) { lastStage = s.label; out.stages.push(`${s.age}:${s.label}`); }
    for (const it of g.lifeInbox()) { out.inbox.push(`${s.age}:${it.kind}`); g.lifeRespond(it.id, 0); }
    const acts = g.lifeActions();
    const can = (id) => acts.find((a) => a.id === id && !a.why);
    if (can('work')) g.lifeAct('work');
    if (can('hobbypick') && !L.hobby) g.lifeAct('hobbypick', { pick: 1 });
    for (const id of ['hobby', 'volunteer', 'grandkid', 'jibunshi', 'exercise']) if (can(id) && i % 3 === 0) { const r0 = g.lifeAct(id); if (r0.ok) out.acts[id] = (out.acts[id] || 0) + 1; }
    if (s.age >= 71) break;
  }
  return { ...out, hist: L.hist.map((h) => `${h.a}:${h.t}`), pension: L.pension, job: L.job, grand: L.grand, stage: g.lifeStage().id, label: g.lifeStage().label, age: g.lifeStage().age, ledger: L.ledger.flatMap((w) => w.items.map((x) => x[0])), ken: L.stats.ken };
});
console.log(JSON.stringify(r.stages));
console.log(r.hist.slice(-16).join(' | '));
ok(r.hist.some((h) => /還暦/.test(h)), '還暦のお祝い');
ok(r.inbox.some((x) => /teinen/.test(x)), `定年のお知らせ ${r.inbox.filter((x) => /teinen/.test(x))}`);
ok(r.hist.some((h) => /再雇用/.test(h)) && r.hist.some((h) => /会社勤めを終えた/.test(h)), '再雇用 → 70歳で終わり');
ok(r.pension && r.pension.week > 5500 && r.hist.some((h) => /^65:年金/.test(h)), `年金（65歳から・週 ${r.pension && r.pension.week}）`);
ok(r.hist.some((h) => /古希/.test(h)), '古希のお祝い');
ok(r.stage === 'senior' && r.age >= 70, `シニア ${r.label}`);
ok((r.grand || []).length >= 1, `孫 ${JSON.stringify(r.grand)}`);
ok(['hobby', 'volunteer', 'jibunshi', 'grandkid'].every((k) => r.acts[k] > 0), `シニアの行動 ${JSON.stringify(r.acts)}`);
const E = await page.evaluate(() => { const D = window.__ls.D; return { t80: D.teinenAge(1983), t87: D.teinenAge(1987), r2000: D.rehireUntil(2000), r2010: D.rehireUntil(2010), r2022: D.rehireUntil(2022), p95: D.pensionAge(1995), p2010: D.pensionAge(2010) }; });
ok(E.t80 === 55 && E.t87 === 60 && E.r2000 === 0 && E.r2010 === 65 && E.r2022 === 70 && E.p95 === 60 && E.p2010 === 65, `時代の決まり ${JSON.stringify(E)}`);
console.log('page errors:', errors.length ? errors.slice(0, 6).join('\n') : 'none');
console.log(fails.length ? `FAIL ${fails.length}: ${fails.join(' / ')}` : 'ALL PASS');
await browser.close();
