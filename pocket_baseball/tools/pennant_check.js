// ペナントの日程・成績・本塁打記録 (今日のホームラン)・ニュース・高速シミュレーション・マジック・
// 一括消化・セーブの移行の整合性チェック
// 使い方: node tools/pennant_check.js [自チームID] [日数] [カード数(perPair)]
"use strict";
const assert = require("assert");
const { makeHarness, playDays, playSeason, simUntil } = require("./pen_harness.js");

const H = makeHarness();
const { PB, Pen, News, Store, I, Sched } = H;
const T0 = Date.now();
const lap = (name) => console.log("[" + ((Date.now() - T0) / 1000).toFixed(1) + "s] " + name);

// 試合ごとの記録を集める (シミュレーションした全試合。QuickGame も Game.simToEnd を通る)
let games = [];
let collect = true;
const origSim = PB.Game.prototype.simToEnd;
PB.Game.prototype.simToEnd = function () {
  if (collect) games.push(this);
  return origSim.call(this);
};

const my = process.argv[2] || "t";
const days = Number(process.argv[3] || 20);
const perPair = Number(process.argv[4] || 4);
const lgOfTeam = (id) => PB.D.teamDef(id).lg;

/* ---------- 1) 試合ごと: 本塁打の記録がボックススコア・得点経過と一致する ---------- */
function checkGames(list) {
  for (const g of list) {
    const boxHR = Object.values(g.box).reduce((a, s) => a + (s.hr || 0), 0);
    assert.strictEqual(g.hrLog.length, boxHR, "hrLog と打者の本塁打数が一致しない");
    for (const id in g.box) if (g.box[id].phr) assert.strictEqual(g.hrLog.filter((e) => e.pid === id).length, g.box[id].phr, "被本塁打が一致しない");
    const sl = g.scoreLog.filter((x) => x.hr);
    assert.strictEqual(sl.length, g.hrLog.length, "得点経過の本塁打数が一致しない");
    sl.forEach((x, i) => assert.strictEqual(x.n, g.hrLog[i].n, "本塁打の打点が一致しない"));
    const count = {};
    g.hrLog.forEach((e, i) => {
      count[e.id] = (count[e.id] || 0) + 1;
      assert.strictEqual(e.game, count[e.id], "この試合何本目かが違う");
      if (e.ctx === "サヨナラ") {
        assert.ok(i === g.hrLog.length - 1 && !e.top && e.score.home > e.score.away && g.result && g.result.walkoff, "サヨナラの条件");
      }
      if (e.extra) assert.ok(e.inn > g.innings, "延長の条件");
      if (e.lead) assert.ok(e.inn === 1 && e.outs === 0, "先頭打者の条件");
      if (e.b2b) {
        const prev = g.hrLog.slice(0, i).filter((x) => x.inn === e.inn && x.top === e.top);
        assert.ok(prev.length >= e.b2b - 1, "N者連続の条件");
      }
      if (e.consec) assert.ok(count[e.id] >= e.consec, "N打席連続の条件");
      const side = e.side;
      assert.ok(e.score[side] - e.n >= 0, "得点が足りない");
      assert.ok(g.score[side] >= e.score[side], "最終得点より多い");
      assert.ok(e.nm && e.pn && e.tid, "名前の記録がない");
    });
    // 得点 = 打者の得点の合計 = スコアボード
    for (const side of ["away", "home"]) {
      const ids = new Set(g.teams[side].players.map((p) => p.id));
      const runs = Object.keys(g.box)
        .filter((id) => ids.has(id))
        .reduce((a, id) => a + (g.box[id].r || 0), 0);
      assert.strictEqual(runs, g.score[side], side + " の得点が一致しない");
    }
  }
}

/* ---------- 2〜4) 結果: 本塁打の配列・gi・号数・N試合連続 ---------- */
function checkResults(pen) {
  const byDay = {};
  for (const r of pen.results) {
    assert.ok(Array.isArray(r.hr), "本塁打の配列がない");
    const s = byDay[r.day] || (byDay[r.day] = new Set());
    assert.ok(!s.has(r.gi), "gi が重複");
    s.add(r.gi);
  }
  const seq = {};
  let total = 0;
  for (const r of pen.results) {
    for (const e of r.hr) {
      total++;
      (seq[e.id] || (seq[e.id] = [])).push(e.no);
      if (e.type === "IPHR") assert.strictEqual(e.dist, 0, "ランニング本塁打に飛距離");
      else assert.ok(e.dist >= 80 && e.dist <= 190, "飛距離が異常: " + e.dist);
      assert.ok(e.n >= 1 && e.n <= 4, "打点が異常");
    }
  }
  for (const id in seq) {
    const a = seq[id];
    a.forEach((no, i) => assert.strictEqual(no, i + 1, id + " の号数が飛んでいる: " + a.join(",")));
    assert.strictEqual(a.length, pen.stats[id].hr, id + " の本塁打数がシーズン成績と一致しない");
  }
  for (let i = 0; i < pen.results.length; i++) {
    const r = pen.results[i];
    const seen = {};
    for (const e of r.hr) {
      if (seen[e.id]) continue;
      seen[e.id] = 1;
      let n = 1;
      for (let j = i - 1; j >= 0; j--) {
        const q = pen.results[j];
        if (q.home !== e.tid && q.away !== e.tid) continue;
        if (!q.hr.some((x) => x.id === e.id)) break;
        n++;
      }
      assert.strictEqual(e.gs || 1, n, "N試合連続が違う: " + e.nm);
    }
  }
  return total;
}

/* ========== 旧来の日程 (日付なし・perPair) — 物理版 ========== */
const pen = Pen.create(my, perPair, "normal", 9);
Store.data.pennant = pen;
assert.strictEqual(pen.schedule[0].length, 6, "1日 6 試合 (セ・パ)");
assert.strictEqual(pen.v, 2, "版番号");
for (const day of pen.schedule) {
  const seen = new Set();
  for (const m of day) {
    assert.ok(!seen.has(m.home) && !seen.has(m.away), "同じ日に 2 試合");
    seen.add(m.home);
    seen.add(m.away);
    assert.strictEqual(lgOfTeam(m.home), lgOfTeam(m.away), "リーグ内の対戦");
  }
  assert.strictEqual(seen.size, 12);
}
for (let d = 0; d < days && !pen.finished; d++) {
  const m = I.myMatch(pen);
  const g = I.makeGame(pen, m, null);
  g.simToEnd();
  I.finishDay(pen, g);
}
assert.ok(
  games.every((g) => !(g instanceof PB.QuickGame)),
  "旧来の日程は物理版"
);
checkGames(games);
const total = checkResults(pen);

// 5) 両リーグの順位表
for (const lg of ["C", "P"]) {
  const st = Pen.standings(pen, lg);
  assert.strictEqual(st.length, 6);
  const g = st.reduce((a, x) => a + x.g, 0);
  assert.strictEqual(g, pen.day * 6, lg + " の試合数");
  for (const x of st) assert.strictEqual(x.g + x.rem, pen.perPair * 5, "試合数 + 残り");
}

// 6) ニュース: 毎日自チームの試合記事があり、本塁打記事は実際の本塁打を指している
for (let d = 0; d < pen.day; d++) {
  const items = pen.news.filter((n) => n.day === d);
  assert.ok(
    items.some((n) => n.kind === "game"),
    d + "日目の試合記事がない"
  );
  assert.ok(items.filter((n) => n.kind === "hr" || n.kind === "hrrun").length <= 4, "本塁打記事が多すぎる");
  for (const n of items.filter((x) => x.kind === "hr" || x.kind === "hrrun")) {
    assert.ok(
      News.dayHRs(pen, d).some((x) => x.e.id === n.pid),
      "存在しない本塁打の記事: " + n.title
    );
  }
  const keys = items.map((n) => n.key);
  assert.strictEqual(new Set(keys).size, keys.length, "記事のキーが重複");
}
// 同じ日をもう一度生成しても増えない (二重計上しない)
const before = pen.news.length;
for (let d = 0; d < pen.day; d++) News.generate(pen, d);
assert.strictEqual(pen.news.length, before, "ニュースが二重に作られた");
// 乱数を使わず、同じ記録からは同じ記事になる
const gen = (base, p, d) => {
  p.news = p.news.filter((n) => n.day !== d);
  delete p.newsState.done[d];
  const rnd = Math.random;
  Math.random = () => {
    throw new Error("ニュース生成で乱数を使った");
  };
  try {
    Store.data.pennant = p;
    News.generate(p, d);
  } finally {
    Math.random = rnd;
    Store.data.pennant = base;
  }
  return JSON.stringify(p.news.filter((n) => n.day === d));
};
const clone = (p) => JSON.parse(JSON.stringify(p));
const lastD = pen.day - 1;
assert.strictEqual(gen(pen, clone(pen), lastD), gen(pen, clone(pen), lastD), "同じ記録から違う記事");

// 7) 画面: 今日のホームランの行数が本数と一致、記録の無い日は「記録開始前」
for (let d = 0; d < pen.day; d++) {
  const html = News.screen({ day: d, tab: "hr" }).html();
  const rows = (html.match(/class="nhr"/g) || []).length;
  assert.strictEqual(rows, News.dayHRs(pen, d).length, d + "日目の行数");
  if (!rows) assert.ok(html.indexOf("今日のホームランはありません") >= 0);
  const res = News.screen({ day: d, tab: "res" }).html();
  assert.strictEqual((res.match(/class="nr( mine)?"/g) || []).length, 6, "試合結果の行数");
  assert.ok(html.indexOf("第" + (d + 1) + "日") >= 0, "日付の無い日程は 第N日");
}
{
  const p2 = clone(pen);
  for (const r of p2.results) if (r.day === 0) delete r.hr;
  Store.data.pennant = p2;
  const html = News.screen({ day: 0, tab: "hr" }).html();
  assert.ok(html.indexOf("記録開始前") >= 0, "古いデータの表示");
  assert.ok(html.indexOf("今日のホームランはありません") < 0);
  Store.data.pennant = pen;
}

// 8) セーブの大きさ
const size = JSON.stringify(pen).length;
assert.ok(size < 400000 * (pen.day / 30 + 0.2), "セーブが大きすぎる: " + size);

const sample = pen.news.filter((n) => n.day === pen.day - 1).map((n) => "  [" + n.kind + "] " + n.title + (n.body ? " — " + n.body : ""));
console.log(sample.join("\n"));
const hrs = News.dayHRs(pen, pen.day - 1).map((x) => "  " + News.caption(x.e) + "  " + News.hrLine(x.e) + " " + News.hrTags(x.e).join("/"));
console.log("今日のホームラン:\n" + hrs.join("\n"));
console.log("days=" + pen.day + " results=" + pen.results.length + " HR=" + total + " HR/G=" + (total / pen.results.length).toFixed(2) + " news=" + pen.news.length + " size=" + size);
lap("旧来の日程 (物理版)");

/* ========== 日程 (pennant_sched.js) ========== */
const byLg = { C: [], P: [] };
for (const t of H.teams) byLg[lgOfTeam(t.id)].push(t.id);
function pairCounts(sc) {
  const c = {};
  const home = {};
  for (const day of sc.days)
    for (const m of day) {
      const k = [m.home, m.away].sort().join("|");
      c[k] = (c[k] || 0) + 1;
      home[m.home + ">" + m.away] = (home[m.home + ">" + m.away] || 0) + 1;
    }
  return { c, home };
}
function checkSchedBasics(sc, label, il) {
  assert.strictEqual(sc.days.length, sc.dates.length, label + ": 日付の数");
  assert.strictEqual(sc.regDays, sc.days.length, label + ": regDays");
  for (let i = 1; i < sc.dates.length; i++) assert.ok(sc.dates[i] > sc.dates[i - 1], label + ": 日付が増えていない");
  sc.days.forEach((day, i) => {
    assert.ok(day.length > 0, label + ": 試合のない日");
    const seen = new Set();
    for (const m of day) {
      assert.ok(!seen.has(m.home) && !seen.has(m.away), label + ": 1 球団 1 日 2 試合 " + Sched.label(sc.dates[i]));
      seen.add(m.home);
      seen.add(m.away);
      if (!il) assert.strictEqual(lgOfTeam(m.home), lgOfTeam(m.away), label + ": リーグ外の対戦");
      assert.ok(!!m.il === (lgOfTeam(m.home) !== lgOfTeam(m.away)), label + ": 交流戦の印");
    }
  });
  const mondays = sc.dates.filter((n) => Sched.dow(n) === 1).length;
  assert.ok(mondays <= sc.dates.length * 0.05, label + ": 月曜の試合が多い " + mondays);
  // オールスター休み
  assert.ok(!sc.dates.some((n) => n >= Sched.ALLSTAR[0] && n <= Sched.ALLSTAR[1]), label + ": オールスター休みに試合");
}
{
  assert.strictEqual(Sched.label(Sched.doy(4, 2)), "4月2日(金)", "2004/4/2 は金曜");
  assert.strictEqual(Sched.label(Sched.doy(9, 18)), "9月18日(土)", "2004/9/18 は土曜");
  assert.strictEqual(Sched.label(Sched.doy(3, 27)), "3月27日(土)");
  const full0 = Sched.build({ len: "full", strike: false, seed: 9 }, byLg);
  const full1 = Sched.build({ len: "full", strike: true, seed: 9 }, byLg);
  checkSchedBasics(full0, "フル(中止なし)");
  checkSchedBasics(full1, "フル");
  const g0 = Sched.countGames(full0.days);
  const g1 = Sched.countGames(full1.days);
  for (const id of byLg.C) {
    assert.strictEqual(g0[id], 140, "セ 140 試合: " + id);
    assert.strictEqual(g1[id], 138, "セ 138 試合 (ストライキ): " + id);
  }
  for (const id of byLg.P) {
    assert.strictEqual(g0[id], 135, "パ 135 試合: " + id);
    assert.strictEqual(g1[id], 133, "パ 133 試合 (ストライキ): " + id);
  }
  const p0 = pairCounts(full0);
  const p1 = pairCounts(full1);
  for (const lg of ["C", "P"])
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) {
        const a = byLg[lg][i];
        const b = byLg[lg][j];
        const k = [a, b].sort().join("|");
        assert.strictEqual(p0.c[k], lg === "C" ? 28 : 27, "組ごとの試合数 " + k);
        const ha = p0.home[a + ">" + b] || 0;
        const hb = p0.home[b + ">" + a] || 0;
        assert.ok(Math.abs(ha - hb) <= 1, "主催の差 " + k + " " + ha + "/" + hb);
        // ストライキの 2 日に当たった分だけ少ない
        const struck = full0.days.filter((d, i2) => full0.dates[i2] >= Sched.STRIKE[0] && full0.dates[i2] <= Sched.STRIKE[1]).reduce((x, d) => x + d.filter((m) => [m.home, m.away].sort().join("|") === k).length, 0);
        assert.strictEqual(p1.c[k], p0.c[k] - struck, "ストライキで減った数 " + k);
      }
  assert.ok(!full1.dates.some((n) => n >= Sched.STRIKE[0] && n <= Sched.STRIKE[1]), "9/18・19 に試合");
  // 開幕日 (要確認の定数): パ 3/27・セ 4/2
  const first = {};
  full1.days.forEach((d, i) => d.forEach((m) => [m.home, m.away].forEach((id) => first[id] == null && (first[id] = full1.dates[i]))));
  for (const id of byLg.P) assert.strictEqual(first[id], Sched.OPEN.P, "パの開幕日");
  for (const id of byLg.C) assert.strictEqual(first[id], Sched.OPEN.C, "セの開幕日");
  // ハーフ・短期
  const half = Sched.build({ len: "half", seed: 3 }, byLg);
  checkSchedBasics(half, "ハーフ");
  for (const id in Sched.countGames(half.days)) assert.strictEqual(Sched.countGames(half.days)[id], 70, "ハーフ 70 試合");
  for (const [len, n] of [
    ["s10", 10],
    ["s20", 20],
    ["s30", 30],
  ]) {
    const sc = Sched.build({ len, seed: 4 }, byLg);
    checkSchedBasics(sc, len);
    const c = Sched.countGames(sc.days);
    for (const id in c) assert.strictEqual(c[id], n, len + " の試合数");
    assert.ok(
      sc.days.every((d) => d.length === 6),
      len + ": 毎日 12 球団"
    );
  }
  // 交流戦 (後年ルール・2005 年方式): 他リーグと 36・計 146
  const il = Sched.build({ len: "full", il: true, strike: false, seed: 5 }, byLg);
  checkSchedBasics(il, "交流戦", true);
  const ilc = {};
  const ilh = {};
  for (const d of il.days)
    for (const m of d)
      if (m.il) {
        ilc[m.home] = (ilc[m.home] || 0) + 1;
        ilc[m.away] = (ilc[m.away] || 0) + 1;
        ilh[m.home] = (ilh[m.home] || 0) + 1;
      }
  const cil = Sched.countGames(il.days);
  for (const t of H.teams) {
    assert.strictEqual(ilc[t.id], 36, "交流戦 36 試合: " + t.id);
    assert.strictEqual(ilh[t.id], 18, "交流戦の主催 18: " + t.id);
    assert.strictEqual(cil[t.id], 146, "交流戦ありで 146 試合: " + t.id);
  }
  const pil = pairCounts(il);
  for (const a of byLg.C) for (const b of byLg.P) assert.strictEqual(pil.c[[a, b].sort().join("|")], 6, "交流戦は各 6 試合");
  // 同じ seed なら同じ日程
  assert.strictEqual(JSON.stringify(Sched.build({ len: "full", strike: true, seed: 9 }, byLg)), JSON.stringify(full1), "日程が再現できない");
  console.log("日程: フル " + full1.days.length + "日 (" + Sched.label(full1.dates[0]) + "〜" + Sched.label(full1.dates[full1.dates.length - 1]) + ")、ハーフ " + half.days.length + "日、交流戦あり " + il.days.length + "日");
}
lap("日程");

/* ========== 高速シミュレーション: 1〜4 の検査を QuickGame の試合で ========== */
{
  games = [];
  const qp = Pen.create(my, { len: "s20", fast: "quick", seed: 21 });
  assert.ok(qp.dates && qp.dates.length === qp.schedule.length, "短期にも日付");
  playDays(H, qp, 10, true);
  assert.ok(games.length >= 50 && games.every((g) => g instanceof PB.QuickGame), "高速版で消化していない");
  checkGames(games);
  const n = checkResults(qp);
  assert.ok(qp.results.length === qp.day * 6, "高速版の試合数");
  console.log("高速版: " + games.length + "試合 本塁打 " + n);
  games = [];
}
lap("高速シミュレーション");

/* ========== フル 2004 年を高速で 1 シーズン ========== */
let fullPen;
{
  collect = false;
  const t0 = Date.now();
  fullPen = Pen.create(my, { len: "full", strike: true, fast: "quick", seed: 2004 });
  Store.data.pennant = fullPen;
  const nGames = fullPen.schedule.reduce((a, d) => a + d.length, 0);
  // パの日程が終わったあと (セはまだ続く) のパの球団のハブ
  let afterP = false;
  while (!fullPen.finished) {
    playDays(H, fullPen, 1, true);
    if (!afterP && !fullPen.finished && Pen.standings(fullPen, "P").every((x) => x.rem === 0)) {
      afterP = true;
      const keep = fullPen.my;
      fullPen.my = "h";
      const html = Pen.hub().html();
      fullPen.my = keep;
      assert.ok(html.indexOf("全133戦 終了") >= 0 && html.indexOf("今季の試合はすべて終わりました") >= 0 && html.indexOf('data-arg="next"') < 0, "パの日程が終わった後のハブ");
    }
  }
  assert.ok(afterP, "パが先に終わる日程になっていない");
  const sec = (Date.now() - t0) / 1000;
  collect = true;
  assert.ok(fullPen.finished && fullPen.regEnd, "シーズンが終わらない");
  assert.strictEqual(fullPen.results.length, nGames, "全試合が記録されていない");
  assert.strictEqual(fullPen.day, fullPen.regDays);
  for (const [lg, n] of [
    ["C", 138],
    ["P", 133],
  ]) {
    const st = Pen.standings(fullPen, lg);
    for (const x of st) {
      assert.strictEqual(x.g, n, lg + " の試合数 " + x.id);
      assert.strictEqual(x.rem, 0);
      assert.strictEqual(x.w + x.l + x.d, n);
    }
    const sum = st.reduce((a, x) => a + x.g, 0);
    const lgGames = fullPen.results.filter((r) => lgOfTeam(r.home) === lg).length;
    assert.strictEqual(sum, lgGames * 2, lg + " の試合数の合計");
    const rc = Pen.race(fullPen, lg);
    assert.strictEqual(rc.champ, st[0].id, lg + " の優勝球団");
    assert.ok(fullPen.clinch[lg] && fullPen.clinch[lg].id === st[0].id, lg + " の優勝が記録されていない");
    assert.strictEqual(fullPen.news.filter((n2) => n2.key === "clinch:" + lg).length, 1, lg + " の優勝ニュースが 1 回でない");
  }
  const po = Object.keys(fullPen.clinch.po || {});
  assert.ok(po.length >= 3, "パのプレーオフ進出");
  for (const id of Pen.standings(fullPen, "P").slice(0, 3).map((x) => x.id)) assert.ok(po.indexOf(id) >= 0, "3 位以内がプレーオフ進出になっていない");
  // 記事は自チームの試合の日だけ試合記事 (上限で古い記事が消えていなければ)、日付は「4月2日(金)」の形
  if (fullPen.news.length < News.maxNews(fullPen))
    for (let d = 0; d < fullPen.day; d++) {
      const mine = fullPen.results.some((r) => r.day === d && (r.home === my || r.away === my));
      assert.strictEqual(
        fullPen.news.some((n2) => n2.day === d && n2.kind === "game"),
        mine,
        d + "日目の試合記事"
      );
    }
  assert.ok(/^\d+月\d+日\(.\)$/.test(Pen.dayLabel(fullPen, 0)), "日付の表示");
  // ペナントレースの記事 (マジック・優勝・プレーオフ進出・可能性消滅) は同じ日を作り直しても同じ
  const RACE = /^(magic|clinch|po|out)$/;
  const raceDays = [...new Set(fullPen.news.filter((n2) => RACE.test(n2.kind)).map((n2) => n2.day))];
  assert.ok(raceDays.length >= 3, "ペナントレースの記事が少ない");
  for (const d of raceDays) {
    const want = JSON.stringify(fullPen.news.filter((n2) => n2.day === d && RACE.test(n2.kind)));
    const again = JSON.parse(gen(fullPen, clone(fullPen), d)).filter((n2) => RACE.test(n2.kind));
    assert.strictEqual(JSON.stringify(again), want, Pen.dayLabel(fullPen, d) + " のペナントレースの記事が作り直すと変わる");
  }
  assert.ok(
    fullPen.news.filter((n2) => n2.kind === "magic").every((n2) => /点灯|消滅/.test(n2.title)),
    "マジックの記事"
  );
  assert.ok(fullPen.news.length <= News.maxNews(fullPen) && News.maxNews(fullPen) >= 1500, "ニュースの上限");
  checkResults(fullPen);
  const json = JSON.stringify(fullPen);
  const kb = json.length / 1024;
  console.log("フル 2004 年 (高速): " + nGames + "試合 " + fullPen.day + "日 " + sec.toFixed(1) + "秒 (1試合 " + ((sec * 1000) / nGames).toFixed(1) + "ms)、セーブ " + kb.toFixed(0) + "KB、ニュース " + fullPen.news.length + "件");
  const champ = (lg) => Pen.team(fullPen.clinch[lg].id).short + " (" + Pen.dayLabel(fullPen, fullPen.clinch[lg].day) + ")";
  console.log("  セ優勝 " + champ("C") + " / パ1位 " + champ("P") + " / マジック・優勝の記事: " + fullPen.news.filter((n2) => /magic|clinch|po|out/.test(n2.kind)).map((n2) => Pen.dayLabel(fullPen, n2.day) + " " + n2.title).slice(0, 8).join("、"));
  assert.ok(json.length <= 1.5 * 1024 * 1024, "セーブが 1.5MB を超えた: " + kb.toFixed(0) + "KB");
  assert.ok(sec <= 60, "フルシーズンが遅い: " + sec + "秒");
}
lap("フル 2004 年");

/* ========== マジック: 小さなリーグで全組み合わせを総当たり ========== */
{
  const ids = ["g", "t", "d", "s"];
  const rng = PB.U.seeded(77);
  const pairings = [
    [
      ["g", "t"],
      ["d", "s"],
    ],
    [
      ["g", "d"],
      ["t", "s"],
    ],
    [
      ["g", "s"],
      ["t", "d"],
    ],
  ];
  let checked = 0;
  let lit = 0;
  let zero = 0;
  for (let sc = 0; sc < 150; sc++) {
    const D = 4 + rng.int(0, 10);
    const left = Math.min(D, rng.int(1, 5));
    const schedule = [];
    for (let d = 0; d < D; d++) schedule.push(rng.pick(pairings).map(([a, b]) => (rng.next() < 0.5 ? { home: a, away: b } : { home: b, away: a })));
    // 強さに差をつけた勝敗 (引き分けも少し)
    const str = { g: rng.next(), t: rng.next(), d: rng.next(), s: rng.next() };
    const results = [];
    for (let d = 0; d < D - left; d++)
      schedule[d].forEach((m, gi) => {
        const x = rng.next();
        const ph = 0.5 + (str[m.home] - str[m.away]) * 0.8;
        const hs = x < 0.04 ? 2 : x < ph ? 3 : 1;
        const as = x < 0.04 ? 2 : x < ph ? 1 : 3;
        results.push({ day: d, gi, home: m.home, away: m.away, hs, as, hr: [] });
      });
    const p = { v: 2, my: "t", lg: "C", ids, schedule, regDays: D, day: D - left, results, stats: {}, lastPitched: {}, news: [], newsState: {}, clinch: {} };
    const st = Pen.standings(p, "C");
    const A = st[0];
    const mg = Pen.magic(p, "C");
    // 残りの試合の勝敗をすべて試す
    const rem = [];
    for (let d = D - left; d < D; d++) for (const m of schedule[d]) rem.push(m);
    const base = {};
    for (const x of st) base[x.id] = { w: x.w, l: x.l };
    let witness = false;
    for (let mask = 0; mask < 1 << rem.length; mask++) {
      const f = {};
      for (const id of ids) f[id] = { w: base[id].w, l: base[id].l };
      let aw = 0;
      rem.forEach((m, i) => {
        const homeWin = (mask >> i) & 1;
        const w = homeWin ? m.home : m.away;
        const l = homeWin ? m.away : m.home;
        f[w].w++;
        f[l].l++;
        if (w === A.id) aw++;
      });
      const pct = (x) => (x.w + x.l ? x.w / (x.w + x.l) : 0);
      const first = ids.every((id) => id === A.id || pct(f[A.id]) > pct(f[id]));
      if (mg && aw >= mg.m) assert.ok(first, "マジックの数だけ勝っても 1 位でない (scenario " + sc + ")");
      if (mg && mg.m > 0 && aw === mg.m - 1 && !first) witness = true;
      if (!mg && aw === A.rem && !first) witness = true;
    }
    if (!mg || mg.m > 0) assert.ok(witness, "マジックが最小でない (scenario " + sc + " m=" + (mg && mg.m) + ")");
    if (mg) lit++;
    if (mg && mg.m === 0) zero++;
    checked++;
  }
  assert.ok(lit > 20 && zero > 3 && lit < checked, "マジックの検査の場面が偏っている " + lit + "/" + zero);
  console.log("マジック: " + checked + "場面を総当たり (点灯 " + lit + "・決定 " + zero + ")");
}
lap("マジック");

/* ========== セーブの移行: 今の形の旧セーブ (v なし) を続きから ========== */
{
  const old = Pen.create(my, 2, "normal", 9);
  playDays(H, old, 2, true);
  const raw = JSON.parse(JSON.stringify(old));
  for (const k of ["v", "opts", "year", "seed", "regDays", "clinch", "begun", "regEnd"]) delete raw[k];
  delete raw.newsState.magic;
  delete raw.newsState.out;
  // 旧セーブにはペナントレースの記事も無い
  raw.news = raw.news.filter((n) => ["magic", "clinch", "po", "out"].indexOf(n.kind) < 0);
  const keep = JSON.stringify(raw.results);
  Store.data.pennant = raw;
  Store.migrate();
  const p = Store.data.pennant;
  assert.strictEqual(p.v, 2, "移行後の版");
  assert.strictEqual(p.opts.len, "s10");
  assert.strictEqual(p.regDays, p.schedule.length);
  assert.ok(p.clinch && p.newsState.magic && !p.dates, "移行の既定値 (日付は作らない)");
  assert.strictEqual(Pen.dayLabel(p, 0), "第1日");
  const once = JSON.stringify(p);
  Store.migrate();
  assert.strictEqual(JSON.stringify(p), once, "移行を二度しても変わらない");
  playDays(H, p, 3, false);
  assert.strictEqual(p.day, 5);
  assert.strictEqual(p.results.length, 30, "移行後に続きを遊べない");
  assert.strictEqual(JSON.stringify(p.results.slice(0, 12)), keep, "移行で結果が変わった");
  for (const lg of ["C", "P"]) assert.strictEqual(Pen.standings(p, lg).reduce((a, x) => a + x.g, 0), 30);
  assert.ok(Pen.hub().html().indexOf("第6日") >= 0, "旧セーブのハブ");
}
lap("移行");

/* ========== フック・休みの日の画面・順位表 ========== */
{
  const cnt = { beforeDay: 0, afterGame: 0, afterDay: 0, regularEnd: 0 };
  const fns = {};
  for (const k in cnt) Pen.hooks[k].push((fns[k] = () => cnt[k]++));
  const hp = Pen.create(my, { len: "s10", fast: "quick", seed: 8 });
  playSeason(H, hp, true);
  assert.deepStrictEqual(cnt, { beforeDay: 10, afterGame: 60, afterDay: 10, regularEnd: 1 }, "フックの回数");
  for (const k in fns) Pen.hooks[k].splice(Pen.hooks[k].indexOf(fns[k]), 1);
  // 自チームの試合がない日のハブ (パだけの開幕日)
  const op = Pen.create("t", { len: "full", fast: "quick", seed: 12 });
  assert.ok(!I.myMatch(op), "3/27 はセの試合がない");
  let html = Pen.hub().html();
  assert.ok(html.indexOf("本日は試合がありません") >= 0 && html.indexOf('data-act="nextday"') >= 0, "休みの日のハブ");
  assert.ok(html.indexOf("3月27日(土)") >= 0 && html.indexOf("全138戦") >= 0, "ハブの見出し");
  playDays(H, op, 30, true);
  html = Pen.hub().html();
  assert.ok(/<th>差<\/th><th>残<\/th>/.test(html), "順位表の 差・残");
  const myNo = op.results.filter((r) => r.home === "t" || r.away === "t").length + 1;
  assert.ok(html.indexOf("第" + myNo + "戦") >= 0, "第N戦 (自チーム基準)");
  assert.ok(Pen.detailHTML(op, "C").indexOf("pen-l10") >= 0 && /[○●△]/.test(Pen.detailHTML(op, "C")), "直近10試合");
  const vs = Pen.vsHTML(op, "P");
  assert.strictEqual((vs.match(/<tr/g) || []).length, 7, "対戦成績の表");
  const sch = Pen.schedule();
  const sh = sch.html();
  assert.ok(sh.indexOf("ps-row") >= 0 && sh.indexOf("架空の日程") >= 0, "日程の画面");
  // 日程の画面: 月を切り替えてもエラーにならない
  for (const mo of [3, 4, 5, 9, 10]) {
    sch.onAct("mo", String(mo));
    sch.html();
  }
  // 直近10試合・連勝は結果から数え直した値と同じ
  const rc = Pen.recent(op, "t", 10);
  const mine = op.results.filter((r) => r.home === "t" || r.away === "t");
  const wl = mine.map((r) => {
    const a = r.home === "t" ? r.hs : r.as;
    const b = r.home === "t" ? r.as : r.hs;
    return a > b ? "w" : a < b ? "l" : "d";
  });
  assert.deepStrictEqual(rc.last, wl.slice(-10), "直近10試合");
  Store.data.pennant = null;
}
lap("フック・画面");

/* ========== 一括消化 (非同期) と途中の日の再開 ========== */
async function asyncChecks() {
  // 次の試合まで・1 週間・月末まで・中断・シーズン終了まで (ハーフ・高速)
  const sp = Pen.create("t", { len: "half", fast: "quick", seed: 31 });
  assert.ok(!I.myMatch(sp), "初日はセの試合がない");
  let ctl = await simUntil(H, sp, Pen.stops.nextGame());
  assert.ok(ctl.days >= 1 && I.myMatch(sp) && !I.myRecorded(sp), "次の試合までで止まらない");
  assert.strictEqual(sp.results.length, sp.schedule.slice(0, sp.day).reduce((a, d) => a + d.length, 0), "前の日がすべて記録されていない");
  const n0 = sp.dates[sp.day];
  ctl = await simUntil(H, sp, Pen.stops.week(sp));
  assert.ok(sp.dates[sp.day] - n0 >= 7 && sp.dates[sp.day - 1] - n0 < 7, "1週間: 7 日以上進んで最初の日で止まる");
  const m0 = Sched.month(sp.dates[sp.day]);
  ctl = await simUntil(H, sp, Pen.stops.month(sp));
  assert.ok(Sched.month(sp.dates[sp.day]) !== m0 && Sched.month(sp.dates[sp.day - 1]) === m0, "月末まで");
  // 中断: その日を終えてから止まる
  const d1 = sp.day;
  ctl = await simUntil(H, sp, Pen.stops.season(), (p, c) => {
    if (c.days === 2) c.stop = true;
  });
  assert.strictEqual(sp.day, d1 + 2, "中断した日");
  assert.ok(!sp.results.some((r) => r.day === sp.day), "中断で途中の日が残った");
  // 途中まで記録した日 (自分の試合が未記録) から再開しても重複しない
  while (!I.myMatch(sp)) playDays(H, sp, 1, true);
  const day = sp.day;
  const list = sp.schedule[day];
  let k = 0;
  list.forEach((m, gi) => {
    if (k < 2 && m.home !== "t" && m.away !== "t") {
      const g = I.makeGame(sp, m, null, { quick: true });
      g.simToEnd();
      I.recordGame(sp, m, g, gi);
      k++;
    }
  });
  assert.ok(Pen.partialDay(sp), "途中の日");
  await new Promise((res) => assert.ok(I.finishDayAsync(sp, null, null, res), "再開できない"));
  const rs = sp.results.filter((r) => r.day === day);
  assert.strictEqual(rs.length, list.length, "再開で試合数が違う");
  assert.strictEqual(new Set(rs.map((r) => r.gi)).size, list.length, "再開で重複");
  assert.ok(
    rs.some((r) => r.home === "t" || r.away === "t"),
    "再開で自分の試合が飛ばされた"
  );
  // シーズン終了まで
  ctl = await simUntil(H, sp, Pen.stops.season());
  assert.strictEqual(sp.day, sp.regDays, "シーズン終了までで regDays に届かない");
  assert.ok(sp.finished, "シーズンが終わっていない");
  for (const x of Pen.standings(sp, "C").concat(Pen.standings(sp, "P"))) assert.strictEqual(x.g, 70, "ハーフ 70 試合");
  console.log("一括消化: ハーフ " + sp.regDays + "日 (" + Sched.label(sp.dates[0]) + "〜" + Sched.label(sp.dates[sp.dates.length - 1]) + ")");

  // 9) 画面を止めない消化 (finishDayAsync) でも同じ規則で記録される (旧来の日程)
  const pen2 = Pen.create(my, 2, "normal", 9);
  Store.data.pennant = pen2;
  {
    const m = I.myMatch(pen2);
    const g = I.makeGame(pen2, m, null);
    g.simToEnd();
    const gi = pen2.schedule[0].indexOf(m);
    I.recordGame(pen2, m, g, gi);
    I.recordGame(pen2, m, g, gi); // 二度目は無視
    assert.ok(Pen.partialDay(pen2), "途中の日");
    I.finishDay(pen2, null);
    assert.strictEqual(pen2.results.filter((r) => r.day === 0).length, 6, "再開で試合数が違う");
    assert.strictEqual(pen2.day, 1);
  }
  for (let n2 = 0; n2 < 3 && !pen2.finished; n2++) {
    const m = I.myMatch(pen2);
    const g = I.makeGame(pen2, m, null);
    g.simToEnd();
    await new Promise((res) => {
      assert.ok(I.finishDayAsync(pen2, g, null, res), "消化が始まらない");
      // 同時に二度目を呼んでも受け付けない
      assert.strictEqual(
        I.finishDayAsync(pen2, g, null, () => assert.fail("二重に消化した")),
        false
      );
    });
  }
  assert.strictEqual(pen2.results.length, pen2.day * 6, "非同期の消化で試合数が違う");
  for (let d = 0; d < pen2.day; d++) assert.strictEqual(new Set(pen2.results.filter((r) => r.day === d).map((r) => r.gi)).size, 6, d + "日目の gi");
  assert.ok(pen2.results.every((r) => Array.isArray(r.hr)));
  checkGames(games.filter((g) => !(g instanceof PB.QuickGame)));
}
asyncChecks()
  .then(() => {
    lap("一括消化");
    console.log("OK");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
