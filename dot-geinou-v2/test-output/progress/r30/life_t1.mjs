// R30: the life stages as careers, simulated over years with a scripted player:
//  A) a 15-year-old: 高校 (attend, study, club, report cards, 文化祭, 進路 → 私立大学, the exam) → 大学 (履修, credits, サークル, 就活,
//     内定, 卒論, 卒業) → 入社 → 出勤, 査定, ボーナス, 昇進 → (fast-forward) 中年 (health, 同窓会, 介護) — checks every step happened
//  B) 親キャリア: a married player with a newborn: 保育園, 読み聞かせ, 習いごと, 運動会, 通知表, 部活, 高校, 進路, 巣立ち, 就職
//  C) 生い立ち with the fallback io (g.auto answers 0) and the inbox defaults; D) save → reload keeps it all
import { open } from '../../r8l1/h.mjs';
const { browser, page, errors } = await open('?test=1&rich=1&place=home', { viewport: { width: 800, height: 600 } });
page.on('console', (m) => { if (m.type() === 'log' && /^\[t\]/.test(m.text())) console.log(m.text()); });
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok  ' : 'NG  ') + m); };
const A = await page.evaluate(async () => {
  const g = window.__game, st = g.state, LS = window.__ls;
  st.flags.navi_intro = true; st.profile.age = 15; st.profile.gender = 'm'; st.flags.ls = undefined; st.money = 2000000;
  // start on the 1st of April of some year so the school year lines up
  let seed = 7; LS.setRng(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  const step = async () => { st.day++; st.stamina = st.maxStamina; Object.assign(st.life, { hunger: 80, stress: 20, clean: 80 }); if (st.clock) st.clock.min = 420; await g.morning(80, {}); g.morningNotes = []; };
  const log = { stages: [], reports: 0, credits: 0, offers: 0, jobs: [], ranks: [], bonus: 0, notes: [] };
  const L = () => st.flags.ls;
  let lastStage = '';
  for (let i = 0; i < 1500; i++) {
    await step();
    const s = g.lifeStage();
    if (s.id + s.label.slice(0, 4) !== lastStage) { lastStage = s.id + s.label.slice(0, 4); log.stages.push(`${st.day}:${s.age}:${s.label}`); }
    // answer the inbox like a sensible player
    for (const it of g.lifeInbox()) {
      let i2 = 0;
      if (it.kind === 'shinro') i2 = 1; // 私立大学
      if (it.kind === 'offer') i2 = 0;
      if (it.kind === 'reunion' || it.kind === 'care' || it.kind === 'transfer' || it.kind === 'bunkasai' || it.kind === 'ronin' || it.kind === 'absent') i2 = 0;
      g.lifeRespond(it.id, i2);
    }
    const acts = g.lifeActions();
    const can = (id) => acts.find((a) => a.id === id && !a.why);
    if (can('clubpick')) g.lifeAct('clubpick', { pick: 6 }); // 演劇部
    if (s.uni && s.uni.started && !s.uni.circle && can('circlepick')) g.lifeAct('circlepick', { pick: 1 });
    if (can('school')) g.lifeAct('school');
    if (can('work')) g.lifeAct('work');
    if (can('club')) g.lifeAct('club');
    if (can('circle') && i % 3 === 0) g.lifeAct('circle');
    if (can('study')) g.lifeAct('study');
    if (can('shukatsu')) g.lifeAct('shukatsu');
    if (can('thesis')) g.lifeAct('thesis');
    if (can('exercise') && i % 2 === 0) g.lifeAct('exercise');
    if (L().job && !log.jobs.includes(L().job.ind)) log.jobs.push(L().job.ind);
    if (L().job && !log.ranks.includes(L().job.rank)) log.ranks.push(L().job.rank);
    if (L().job && L().job.rank >= 2 && s.age >= 26) break;
    if (i % 150 === 0) console.log(`[t] A ${i} ${s.age} ${s.label}`);
  }
  const H = L().high, U = L().uni;
  return { log, high: H && { type: H.type, reports: H.reports.length, plan: H.plan, exam: H.exam, grad: H.grad, club: H.club }, uni: U && { started: U.started, credits: U.credits, grad: U.grad, chosen: U.shk.chosen, offers: U.shk.offers.length, thesis: U.thesis, circle: U.circle }, job: L().job && { ind: L().job.ind, rank: L().job.rank, evals: L().job.evals.length }, hist: L().hist.map((h) => `${h.a}:${h.t}`), stats: L().stats, age: g.lifeStage().age, ledger: L().ledger.length };
});
console.log(JSON.stringify(A.log.stages));
console.log(A.hist.join(' | '));
ok(A.high && A.high.reports >= 6, `高校: 通知表 ${A.high && A.high.reports}`);
ok(A.high && A.high.grad && A.high.plan === 'shi', `高校: 卒業・進路 ${A.high && A.high.plan}・受験 ${JSON.stringify(A.high && A.high.exam)}`);
ok(A.high && A.high.club === 'engeki', '高校: 部活（演劇部）');
ok(A.uni && A.uni.grad && A.uni.credits >= 124 && A.uni.thesis >= 100, `大学: 卒業 ${JSON.stringify(A.uni)}`);
ok(A.job && A.log.jobs.length >= 1, `就職: ${JSON.stringify(A.job)}`);
ok(A.job && A.job.rank >= 1 && A.job.evals >= 2, `会社: 査定と昇進 ${JSON.stringify(A.log.ranks)}`);
ok(A.ledger > 0, `家計簿 ${A.ledger}週`);

// ---- 中年 (fast-forward to 40)
const M = await page.evaluate(async () => {
  const g = window.__game, st = g.state;
  const step = async () => { st.day++; st.stamina = st.maxStamina; Object.assign(st.life, { hunger: 80, stress: 20, clean: 80 }); if (st.clock) st.clock.min = 420; await g.morning(80, {}); g.morningNotes = []; };
  st.profile.age = 39 - Math.floor((st.day - 1) / 120);
  const ken0 = st.flags.ls.stats.ken;
  const kinds = new Set();
  for (let i = 0; i < 700; i++) { await step(); for (const it of g.lifeInbox()) { kinds.add(it.kind); g.lifeRespond(it.id, 0); } const a = g.lifeActions().find((x) => x.id === 'work' && !x.why); if (a) g.lifeAct('work'); }
  const s = g.lifeStage();
  return { stage: s.id, age: s.age, ken0, ken: s.stats.ken, kinds: [...kinds], check: st.flags.ls.mid.check, care: st.flags.ls.mid.care, reunion: st.flags.ls.mid.reunion, dock: g.lifeActions().some((x) => x.id === 'checkup') };
});
console.log(JSON.stringify(M));
ok(M.stage === 'middle' && M.age >= 41, `中年: ${M.stage} ${M.age}歳`);
ok(M.ken < M.ken0 + 5, `中年: 健康が年齢で下がる ${M.ken0}→${M.ken}`);
ok(M.check && M.check.grade, `健康診断 ${JSON.stringify(M.check)}`);
ok(M.kinds.includes('care') || M.care, `親の介護のお知らせ ${M.kinds}`);
ok(M.dock, '人間ドックの行動がある');

// ---- B) 親キャリア
const B = await page.evaluate(async () => {
  const g = window.__game, st = g.state;
  const R = window.__game.state.flags.rom || (g.state.flags.rom = {});
  st.flags.rom = { kids: [{ id: 'k1t', n: '陽葵', g: 'f', b: st.day, ls: 3, by: 'player', d: { miya: 1, okui: 1, b1: 1, y2: 1, y3: 1, y6: 1, y12: 1, y15: 1, y18: 1 } }] };
  const step = async () => { st.day++; st.stamina = st.maxStamina; Object.assign(st.life, { hunger: 80, stress: 20, clean: 80 }); if (st.clock) st.clock.min = 420; await g.morning(80, {}); g.morningNotes = []; };
  const kinds = new Set(); const seen = new Set();
  const out = { acts: {} };
  for (let i = 0; i < 2700; i++) {
    await step();
    for (const it of g.lifeInbox()) { kinds.add(it.kind); g.lifeRespond(it.id, it.kind === 'kid_plan' ? 0 : 0); }
    const k = g.lifeKids()[0];
    if (!k) break;
    seen.add(k.stage);
    for (const a of g.lifeKidActions(k.id)) {
      if (a.why) continue;
      if (a.id === 'hoiku' && !k.hoiku && k.stage === 'baby' && k.years >= 1) g.lifeKidAct(k.id, 'hoiku');
      else if (a.id === 'lesson' && !k.lesson) g.lifeKidAct(k.id, 'lesson', { pick: 0 });
      else if (a.id === 'juku' && !k.juku && k.stage === 'high') g.lifeKidAct(k.id, 'juku');
      else if (!a.set && i % 2 === 0) { const r = g.lifeKidAct(k.id, a.id); if (r.ok) out.acts[a.id] = (out.acts[a.id] || 0) + 1; }
    }
    if (k.after && (k.after.job || (k.after.kind === 'work' && k.years >= 19))) break;
  }
  const k = g.lifeKids()[0];
  return { ...out, kinds: [...kinds], stages: [...seen], kid: k && { years: k.years, stage: k.stage, club: k.club, hs: k.hs, plan: k.plan, after: k.after, reports: k.reports.length, lesson: k.lesson, stats: k.stats }, parent: g.lifeParent() };
});
console.log(JSON.stringify(B));
ok(['baby', 'elem', 'mid', 'high', 'adult'].every((s) => B.stages.includes(s)), `子ども: 全段階 ${B.stages}`);
ok(B.kid && B.kid.reports >= 3, `子ども: 通知表 ${B.kid && B.kid.reports}`);
ok(B.kid && B.kid.club && B.kid.hs, `子ども: 部活 ${B.kid && B.kid.club}・高校 ${B.kid && B.kid.hs}`);
ok(B.kinds.includes('kid_event') && B.kinds.includes('kid_plan'), `子ども: 行事と進路相談 ${B.kinds}`);
ok(B.kid && B.kid.after, `子ども: 巣立ち ${JSON.stringify(B.kid && B.kid.after)}`);
ok(B.parent && B.parent.pts >= 90, `親ポイント ${B.parent && B.parent.pts}（${B.parent && B.parent.name}）`);
ok(Object.keys(B.acts).length >= 5, `子育ての行動 ${JSON.stringify(B.acts)}`);

// ---- C) 生い立ち (fallback io: g.auto answers 0)
const C = await page.evaluate(async () => {
  const g = window.__game, st = g.state;
  st.flags.ls.origin = { done: false };
  const sk0 = JSON.stringify(st.skills);
  let n = 0;
  const io = { page: async () => { n++; }, pick: async (title, items) => (n++ === 0 ? 0 : (n * 7) % items.length) };
  const r = await g.lifeOrigin(io);
  return { done: !!(r && st.flags.ls.origin.done), hs: r && r.hs, skills: r && r.skills, sk0, sk1: JSON.stringify(st.skills), hist: st.flags.ls.hist.filter((h) => h.k === 'origin').length };
});
console.log(JSON.stringify(C));
ok(C.done && C.hist >= 6, `生い立ち: 完了・年表 ${C.hist}件`);

// ---- D) save → load (the saved text keeps it all; ensure() repairs a loaded copy)
const D2 = await page.evaluate(async () => {
  const g = window.__game;
  const before = JSON.stringify(g.state.flags.ls);
  g.save();
  const { loadGame } = await import('/js/engine/state.js');
  const s = loadGame();
  const st = s && (s.state || s);
  const ls = st && st.flags && st.flags.ls;
  return { ok: !!ls, same: !!ls && JSON.stringify(ls) === before, keys: ls ? Object.keys(ls).length : 0, size: before.length, top: s ? Object.keys(s).slice(0, 6) : null };
});
console.log(JSON.stringify(D2));
ok(D2.ok && D2.same, `セーブ→読み込みで保たれる（${D2.size}字）`);
console.log('page errors:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
console.log(fails.length ? `FAIL ${fails.length}: ${fails.join(' / ')}` : 'ALL PASS');
await browser.close();
