// ペナントの日程・成績・本塁打記録 (今日のホームラン)・ニュースの整合性チェック
// 使い方: node tools/pennant_check.js [自チームID] [日数] [カード数(perPair)]
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadEngine } = require("./load_engine.js");

const PB = loadEngine();
// ブラウザ側のモジュール (Store / UI) を最小限のスタブで置き換えて pennant.js / news.js を読む
const teams = PB.D.newTeams();
const Store = {
  data: { pennant: null, records: { games: 0, wins: 0, losses: 0, ties: 0 } },
  teams: () => teams,
  team: (id) => teams.find((t) => t.id === id),
  save() {},
  settings: () => ({}),
};
PB.Store = Store;
PB.UI = { mark: () => "", header: (t) => "<h1>" + t + "</h1>", go() {}, refresh() {}, showPlayer() {} };
PB.Screens = { seg: () => "" };
PB.Audio = {};
const ctx = vm.createContext({ window: { PB }, PB, console, Math, Date, JSON, Object, Array, Number, String, Set, Map, setTimeout });
for (const f of ["pennant.js", "news.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "static", "js", f), "utf8"), ctx, { filename: f });
const Pen = PB.Pennant;
const News = PB.News;
const I = Pen._internal;

// 試合ごとの記録を集める (シミュレーションした全試合)
const games = [];
const origSim = PB.Game.prototype.simToEnd;
PB.Game.prototype.simToEnd = function () {
  games.push(this);
  return origSim.call(this);
};

const my = process.argv[2] || "t";
const days = Number(process.argv[3] || 20);
const perPair = Number(process.argv[4] || 4);
const pen = Pen.create(my, perPair, "normal", 9);
assert.strictEqual(pen.schedule[0].length, 6, "1日 6 試合 (セ・パ)");
for (const day of pen.schedule) {
  const seen = new Set();
  for (const m of day) {
    assert.ok(!seen.has(m.home) && !seen.has(m.away), "同じ日に 2 試合");
    seen.add(m.home);
    seen.add(m.away);
    assert.strictEqual(PB.D.teamDef(m.home).lg, PB.D.teamDef(m.away).lg, "リーグ内の対戦");
  }
  assert.strictEqual(seen.size, 12);
}
for (let d = 0; d < days && !pen.finished; d++) {
  const m = I.myMatch(pen);
  const g = I.makeGame(pen, m, null);
  g.simToEnd();
  I.finishDay(pen, g);
}

// 1) 試合ごと: 本塁打の記録がボックススコア・得点経過と一致する
for (const g of games) {
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
}

// 2) 結果: 本塁打の配列が必ずあり、gi はその日の中で一意
const byDay = {};
for (const r of pen.results) {
  assert.ok(Array.isArray(r.hr), "本塁打の配列がない");
  const s = byDay[r.day] || (byDay[r.day] = new Set());
  assert.ok(!s.has(r.gi), "gi が重複");
  s.add(r.gi);
}

// 3) 号数がシーズン成績と一致し、選手ごとに 1, 2, 3 … と欠けずに並ぶ
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

// 4) N試合連続: 結果から数え直した値と一致
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

// 5) 両リーグの順位表
for (const lg of ["C", "P"]) {
  const st = Pen.standings(pen, lg);
  assert.strictEqual(st.length, 6);
  const g = st.reduce((a, x) => a + x.g, 0);
  assert.strictEqual(g, pen.day * 6, lg + " の試合数");
}

// 6) ニュース: 毎日自チームの試合記事があり、本塁打記事は実際の本塁打を指している
for (let d = 0; d < pen.day; d++) {
  const items = pen.news.filter((n) => n.day === d);
  assert.ok(items.some((n) => n.kind === "game"), d + "日目の試合記事がない");
  assert.ok(items.filter((n) => n.kind === "hr" || n.kind === "hrrun").length <= 4, "本塁打記事が多すぎる");
  for (const n of items.filter((x) => x.kind === "hr" || x.kind === "hrrun")) {
    assert.ok(News.dayHRs(pen, d).some((x) => x.e.id === n.pid), "存在しない本塁打の記事: " + n.title);
  }
  const keys = items.map((n) => n.key);
  assert.strictEqual(new Set(keys).size, keys.length, "記事のキーが重複");
}
// 同じ日をもう一度生成しても増えない (二重計上しない)
const before = pen.news.length;
for (let d = 0; d < pen.day; d++) News.generate(pen, d);
assert.strictEqual(pen.news.length, before, "ニュースが二重に作られた");
// 乱数を使わず、同じ記録からは同じ記事になる
const clone = () => JSON.parse(JSON.stringify(pen));
const gen = (p, d) => {
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
    Store.data.pennant = pen;
  }
  return JSON.stringify(p.news.filter((n) => n.day === d));
};
const lastD = pen.day - 1;
assert.strictEqual(gen(clone(), lastD), gen(clone(), lastD), "同じ記録から違う記事");

// 7) 画面: 今日のホームランの行数が本数と一致、記録の無い日は「記録開始前」
for (let d = 0; d < pen.day; d++) {
  const html = News.screen({ day: d, tab: "hr" }).html();
  const rows = (html.match(/class="nhr"/g) || []).length;
  assert.strictEqual(rows, News.dayHRs(pen, d).length, d + "日目の行数");
  if (!rows) assert.ok(html.indexOf("今日のホームランはありません") >= 0);
  const res = News.screen({ day: d, tab: "res" }).html();
  assert.strictEqual((res.match(/class="nr( mine)?"/g) || []).length, 6, "試合結果の行数");
}
{
  const p2 = clone();
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

// 9) 画面を止めない消化 (finishDayAsync) でも同じ規則で記録される
const pen2 = Pen.create(my, 2, "normal", 9);
Store.data.pennant = pen2;
// 途中で閉じた日: 自分の試合だけ記録された状態から再開しても重複しない
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
let n2 = 0;
const step = () => {
  if (n2++ >= 3 || pen2.finished) {
    assert.strictEqual(pen2.results.length, pen2.day * 6, "非同期の消化で試合数が違う");
    for (let d = 0; d < pen2.day; d++) assert.strictEqual(new Set(pen2.results.filter((r) => r.day === d).map((r) => r.gi)).size, 6, d + "日目の gi");
    assert.ok(pen2.results.every((r) => Array.isArray(r.hr)));
    console.log("OK");
    return;
  }
  const m = I.myMatch(pen2);
  const g = I.makeGame(pen2, m, null);
  g.simToEnd();
  assert.ok(I.finishDayAsync(pen2, g, null, step), "消化が始まらない");
  // 同時に二度目を呼んでも受け付けない
  assert.strictEqual(I.finishDayAsync(pen2, g, null, () => assert.fail("二重に消化した")), false);
};
step();
