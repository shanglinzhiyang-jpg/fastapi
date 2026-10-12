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
  // 号数はレギュラーシーズンの成績、ポストシーズンは系列ごと (シリーズN号) に 1 から
  for (const r of pen.results) {
    if (r.ps) continue;
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
  const psSeq = {};
  for (const r of pen.results)
    if (r.ps)
      for (const e of r.hr) {
        assert.strictEqual(e.ps, r.ps, "シリーズの本塁打に系列の印がない");
        (psSeq[r.ps + "|" + e.id] || (psSeq[r.ps + "|" + e.id] = [])).push(e.no);
      }
  for (const k in psSeq) {
    const [sid, id] = k.split("|");
    psSeq[k].forEach((no, i) => assert.strictEqual(no, i + 1, k + " のシリーズの号数が 1 から数えられていない: " + psSeq[k].join(",")));
    assert.strictEqual(psSeq[k].length, pen.post.stats[sid][id].hr, k + " の本塁打数が系列の成績と一致しない");
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
        if ((q.ps || null) !== (r.ps || null)) continue;
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
assert.strictEqual(pen.v, Pen.V, "版番号");
assert.strictEqual(Pen.V, 3, "L2 の版番号");
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

/* ========== 日程の形: ホーム・ロードの並びと主催の半々 (20 seed × 全区分。試合はしない) ==========
 * ホーム・ロードの連続は 9 試合まで、球団ごとのホーム・ロードの差と相手ごとの主催の差は 1 以内、
 * ホームのカードのすぐ後に同じ相手とまたホームは無し、開幕から最初のホームまで 3 カード以内。
 * ストライキの有無で変わるのは主催だけ (対戦の並びは同じ) */
{
  const SEEDS = 20;
  const blockOf = (n) => {
    const w = Sched.dow(n);
    return n - ((w + 6) % 7) + (w >= 2 && w <= 4 ? "tt" : "fs");
  };
  const pairsOn = (sc) => sc.days.map((d, i) => sc.dates[i] + ":" + d.map((m) => [m.home, m.away].sort().join("-")).sort().join(","));
  const out = [];
  const keep = {};
  for (const [name, o, games] of [
    ["10試合", { len: "s10" }, { C: 10, P: 10 }],
    ["20試合", { len: "s20" }, { C: 20, P: 20 }],
    ["30試合", { len: "s30" }, { C: 30, P: 30 }],
    ["ハーフ", { len: "half" }, { C: 70, P: 70 }],
    ["フル(中止なし)", { len: "full", strike: false }, { C: 140, P: 135 }],
    ["フル", { len: "full", strike: true }, { C: 138, P: 133 }],
    ["交流戦", { len: "full", il: true, strike: false }, { C: 146, P: 146 }],
    ["交流戦・中止", { len: "full", il: true, strike: true }, { C: 144, P: 144 }],
  ]) {
    const w = { h: 0, a: 0, diff: 0, split: 0, open: 0, ms: 0 };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const t0 = Date.now();
      const sc = Sched.build(Object.assign({ seed }, o), byLg);
      w.ms += Date.now() - t0;
      if (o.len === "full") keep[name + seed] = sc;
      for (const id of byLg.C.concat(byLg.P)) {
        const lb = name + " seed " + seed + " " + id + ": ";
        // カード = 同じブロック (火〜木・金〜日) で同じ相手との続き
        const cards = [];
        sc.days.forEach((d, i) =>
          d.forEach((m) => {
            if (m.home !== id && m.away !== id) return;
            const h = m.home === id;
            const opp = h ? m.away : m.home;
            const b = blockOf(sc.dates[i]);
            const c = cards[cards.length - 1];
            if (c && c.opp === opp && c.b === b) c.g++;
            else cards.push({ opp, h, b, g: 1 });
          })
        );
        let run = 0;
        let home = 0;
        const vs = {};
        cards.forEach((c, k) => {
          const prev = cards[k - 1];
          run = prev && prev.h === c.h ? run + c.g : c.g;
          w[c.h ? "h" : "a"] = Math.max(w[c.h ? "h" : "a"], run);
          assert.ok(run <= Sched.RUN_MAX, lb + (c.h ? "ホーム" : "ロード") + "が " + run + " 試合続く");
          assert.ok(!(prev && prev.opp === c.opp && prev.h && c.h), lb + "同じ相手と続けてホーム (" + c.opp + ")");
          if (c.h) home += c.g;
          const v = vs[c.opp] || (vs[c.opp] = [0, 0]);
          v[c.h ? 0 : 1] += c.g;
        });
        const total = cards.reduce((s, c) => s + c.g, 0);
        assert.strictEqual(total, games[lgOfTeam(id)], lb + "試合数");
        w.diff = Math.max(w.diff, Math.abs(2 * home - total));
        assert.ok(Math.abs(2 * home - total) <= 1, lb + "ホーム " + home + " / ロード " + (total - home));
        for (const k in vs) {
          w.split = Math.max(w.split, Math.abs(vs[k][0] - vs[k][1]));
          assert.ok(Math.abs(vs[k][0] - vs[k][1]) <= 1, lb + k + " との主催 " + vs[k].join("/"));
        }
        const first = cards.findIndex((c) => c.h);
        w.open = Math.max(w.open, first);
        assert.ok(first >= 0 && first <= Sched.OPEN_AWAY, lb + "開幕から " + first + " カード続けてロード");
      }
    }
    out.push(name + " H" + w.h + "/A" + w.a + "・差" + w.diff + "・相手" + w.split + "・開幕ロード" + w.open + "・" + (w.ms / SEEDS).toFixed(0) + "ms");
  }
  for (let seed = 1; seed <= SEEDS; seed++)
    for (const [a, b] of [
      ["フル(中止なし)", "フル"],
      ["交流戦", "交流戦・中止"],
    ]) {
      const want = pairsOn(keep[a + seed]).filter((x) => !(+x.split(":")[0] >= Sched.STRIKE[0] && +x.split(":")[0] <= Sched.STRIKE[1]));
      assert.deepStrictEqual(pairsOn(keep[b + seed]), want, b + " seed " + seed + ": ストライキで対戦の並びが変わった");
    }
  console.log("日程の形 (" + SEEDS + " seed の最大): 連続 H/A・差・相手ごとの差・開幕からのロード (カード)\n  " + out.join("\n  "));
}
lap("日程の形");

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
  // ペナントレースの記事 (マジック・優勝・プレーオフ進出・可能性消滅) は、その日の終わりに作り直しても同じ
  const RACE = /^(magic|clinch|po|out)$/;
  let raceChecked = 0;
  while (!fullPen.finished) {
    playDays(H, fullPen, 1, true);
    const d = fullPen.day - 1;
    const want = JSON.stringify(fullPen.news.filter((n2) => n2.day === d && RACE.test(n2.kind)));
    if (want !== "[]") {
      const again = JSON.parse(gen(fullPen, clone(fullPen), d)).filter((n2) => RACE.test(n2.kind));
      assert.strictEqual(JSON.stringify(again), want, Pen.dayLabel(fullPen, d) + " のペナントレースの記事が作り直すと変わる");
      raceChecked++;
    }
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
  assert.strictEqual(Pen.regResults(fullPen).length, nGames, "全試合が記録されていない");
  assert.strictEqual(fullPen.day, fullPen.schedule.length);
  assert.ok(fullPen.schedule.length > fullPen.regDays && fullPen.awardsDay === fullPen.schedule.length - 1, "ポストシーズン・表彰式の日がない");
  assert.ok(fullPen.post.champs.JS && fullPen.awards.season && fullPen.awards.titles, "日本一・表彰がない");
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
    const lgGames = Pen.regResults(fullPen).filter((r) => lgOfTeam(r.home) === lg).length;
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
    for (let d = 0; d < fullPen.regDays; d++) {
      const mine = fullPen.results.some((r) => r.day === d && (r.home === my || r.away === my));
      assert.strictEqual(
        fullPen.news.some((n2) => n2.day === d && n2.kind === "game"),
        mine,
        d + "日目の試合記事"
      );
    }
  assert.ok(/^\d+月\d+日\(.\)$/.test(Pen.dayLabel(fullPen, 0)), "日付の表示");
  assert.ok(raceChecked >= 3, "ペナントレースの記事が少ない");
  assert.ok(
    fullPen.news.filter((n2) => n2.kind === "magic").every((n2) => /点灯|消滅/.test(n2.title)),
    "マジックの記事"
  );
  assert.ok(fullPen.news.length <= News.maxNews(fullPen) && News.maxNews(fullPen) >= 1500, "ニュースの上限");
  checkResults(fullPen);
  // v3 の記録: 守備位置ごとの出場・先発・完投/完封/QS・ホールド
  for (const lg of ["C", "P"])
    for (const x of Pen.standings(fullPen, lg)) {
      const ps = Pen.team(x.id).players.map((p) => fullPen.stats[p.id] || {});
      assert.ok(ps.reduce((a, q) => a + ((q.pos || {}).C || 0), 0) >= x.g, "捕手の出場が試合数より少ない " + x.id);
      assert.strictEqual(ps.reduce((a, q) => a + (q.gs || 0), 0), x.g, "先発の数 " + x.id);
      for (const pos of ["1B", "2B", "3B", "SS", "LF", "CF", "RF"]) assert.ok(ps.reduce((a, q) => a + ((q.pos || {})[pos] || 0), 0) >= x.g, pos + " の出場 " + x.id);
    }
  let nHld = 0;
  for (const id in fullPen.stats) {
    const q = fullPen.stats[id];
    assert.ok((q.sho || 0) <= (q.cg || 0) && (q.cg || 0) <= (q.gs || 0) && (q.qs || 0) <= (q.gs || 0), "完投・完封・QS の数");
    assert.ok((q.hld || 0) <= (q.pg || 0) - (q.gs || 0) && (q.rw || 0) <= (q.w || 0), "ホールド・救援勝利の数");
    nHld += q.hld || 0;
  }
  assert.ok(nHld > 50, "ホールドが少ない " + nHld);
  const json = JSON.stringify(fullPen);
  const kb = json.length / 1024;
  console.log("フル 2004 年 (高速): " + nGames + "試合 " + fullPen.regDays + "日 + ポストシーズン " + fullPen.results.filter((r) => r.ps).length + "試合 (" + (fullPen.schedule.length - fullPen.regDays) + "日) 計 " + sec.toFixed(1) + "秒 (1試合 " + ((sec * 1000) / fullPen.results.length).toFixed(1) + "ms)、セーブ " + kb.toFixed(0) + "KB、ニュース " + fullPen.news.length + "件");
  const js = PB.PenPost.series(fullPen, "JS");
  console.log("  日本一 " + Pen.team(js.win).short + " (" + js.w.join("-") + ") / パ優勝 " + Pen.team(fullPen.post.champs.P).short + " / MVP セ " + fullPen.awards.season.C.mvp.name + "・パ " + fullPen.awards.season.P.mvp.name + " / 沢村賞 " + (fullPen.awards.season.sawamura.none ? "該当者なし" : fullPen.awards.season.sawamura.name));
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
  for (const k of ["v", "opts", "year", "seed", "regDays", "clinch", "begun", "regEnd", "statsSince", "post", "awards", "mcur", "awardsDay"]) delete raw[k];
  delete raw.newsState.magic;
  delete raw.newsState.out;
  // 旧セーブにはペナントレースの記事も無い
  raw.news = raw.news.filter((n) => ["magic", "clinch", "po", "out"].indexOf(n.kind) < 0);
  const keep = JSON.stringify(raw.results);
  Store.data.pennant = raw;
  Store.migrate();
  const p = Store.data.pennant;
  assert.strictEqual(p.v, Pen.V, "移行後の版");
  assert.strictEqual(p.statsSince, 2, "完投などの記録開始日");
  assert.strictEqual(p.opts.post, true, "終わっていない旧セーブはポストシーズンへ");
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
  // レギュラーシーズンの分だけ数える (その後はポストシーズン・表彰式の日)
  const reg = (k, a, b, c, r) => (k === "afterGame" ? !r.ps : k === "regularEnd" || b < a.regDays);
  for (const k in cnt) Pen.hooks[k].push((fns[k] = (a, b, c, r) => reg(k, a, b, c, r) && cnt[k]++));
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

/* ========== L2: ポストシーズンの組み合わせ (作った最終順位で) ========== */
const PP = PB.PenPost;
const PA = PB.PenAwards;
// vm の配列と比べるので JSON で比べる
const same = (x, y, m) => assert.strictEqual(JSON.stringify(x), JSON.stringify(y), m);
{
  // 最終順位を作る: [[勝, 敗, 分] × 6] (上から順位)
  const mkSt = (lg, recs) => {
    const list = recs.map(([w, l, d], i) => ({ id: byLg[lg][i], w, l, d, g: w + l + d, pct: w / (w + l) }));
    list.forEach((x) => (x.gb = (list[0].w - x.w + (x.l - list[0].l)) / 2));
    return list;
  };
  const C6 = mkSt("C", [
    [80, 55, 3],
    [75, 60, 3],
    [70, 65, 3],
    [65, 70, 3],
    [60, 75, 3],
    [55, 80, 3],
  ]);
  const P45 = mkSt("P", [
    [80, 50, 3],
    [75, 54, 4],
    [70, 60, 3],
    [65, 65, 3],
    [60, 70, 3],
    [50, 80, 3],
  ]);
  const P50 = mkSt("P", [
    [80, 50, 3],
    [75, 55, 3],
    [70, 60, 3],
    [65, 65, 3],
    [60, 70, 3],
    [50, 80, 3],
  ]);
  assert.strictEqual(P45[1].gb, 4.5);
  assert.strictEqual(P50[1].gb, 5);
  const fake = { year: 2004, my: "t", post: { rules: "2004" } };
  const b45 = PP.bracket(fake, "2004", { C: C6, P: P45 });
  const b50 = PP.bracket(fake, "2004", { C: C6, P: P50 });
  const ser = (b, id) => b.series.find((s) => s.id === id);
  // 2004 年: セはプレーオフなし・パは 2 位-3 位 → 勝者-1 位
  same(
    b45.series.map((s) => s.id),
    ["P1", "P2", "JS"],
    "2004 年の系列"
  );
  assert.ok(
    b45.series.every((s) => s.lg !== "C"),
    "セにプレーオフ"
  );
  assert.strictEqual(b45.champs.C, C6[0].id, "セは 1 位が優勝");
  assert.strictEqual(b45.champs.P, null, "パの優勝はプレーオフの後");
  assert.strictEqual(b45.champs.P1st, P45[0].id, "1 位通過");
  const p1 = ser(b45, "P1");
  assert.ok(p1.hi === P45[1].id && p1.lo === P45[2].id && p1.need === 2 && p1.max === 3, "第1ステージ = 2位-3位・3 試合制");
  assert.ok(ser(b45, "P2").hi === P45[0].id && ser(b45, "P2").need === 3 && ser(b45, "P2").max === 5, "第2ステージ = 1 位・5 試合制");
  assert.strictEqual(ser(b45, "P2").adv, 0, "4.5 差はアドバンテージなし");
  same(ser(b45, "P2").w, [0, 0]);
  assert.strictEqual(ser(b50, "P2").adv, 1, "5.0 差で 1 勝のアドバンテージ");
  same(ser(b50, "P2").w, [1, 0], "1 勝から開始");
  assert.ok(/アドバンテージなし/.test(PP.advText(fake, ser(b45, "P2"))) && /1勝のアドバンテージ/.test(PP.advText(fake, ser(b50, "P2"))), "アドバンテージの説明");
  // 勝敗の進み方 (上位の本拠地で)
  const play = (s0, seq) => {
    const s = JSON.parse(JSON.stringify(s0));
    if (!s.lo) s.lo = P45[2].id;
    s.games = seq.map((k, i) => {
      const home = PP.homeOf(s, i + 1, 2004);
      const away = home === s.hi ? s.lo : s.hi;
      const hiWin = k === "h";
      const sc = k === "t" ? [2, 2] : hiWin === (home === s.hi) ? [3, 1] : [1, 3];
      return { n: i + 1, home, away, hs: sc[0], as: sc[1] };
    });
    return { s, st: PP.stateAt(s, seq.length) };
  };
  const winOf = (s0, seq) => {
    const r = play(s0, seq);
    return r.st.win === r.s.hi ? "hi" : r.st.win === r.s.lo ? "lo" : null;
  };
  for (let n = 1; n <= 3; n++) assert.strictEqual(PP.homeOf(p1, n, 2004), p1.hi, "第1ステージは全試合 2 位の本拠地");
  for (let n = 1; n <= 5; n++) assert.strictEqual(PP.homeOf(ser(b45, "P2"), n, 2004), P45[0].id, "第2ステージは全試合 1 位の本拠地");
  assert.strictEqual(winOf(p1, ["h", "h"]), "hi", "2 勝で突破");
  assert.strictEqual(play(p1, ["h", "h"]).st.n, 2, "2 勝で終わる");
  assert.strictEqual(winOf(p1, ["h"]), null);
  assert.strictEqual(winOf(p1, ["l", "h", "l"]), "lo");
  assert.strictEqual(winOf(p1, ["h", "l", "t"]), "hi", "3 試合で並んだら上位");
  assert.strictEqual(winOf(p1, ["l", "h", "t"]), "hi", "3 試合で並んだら上位 (2)");
  assert.strictEqual(winOf(p1, ["t", "t", "l"]), "lo", "勝ち数の多い方");
  assert.strictEqual(winOf(p1, ["t", "h"]), "hi", "結果が変わらなくなったら終了");
  assert.strictEqual(winOf(p1, ["t", "l"]), null, "下位が 1 勝 1 分ではまだ決まらない");
  const p2a = ser(b50, "P2");
  const p2n = ser(b45, "P2");
  assert.strictEqual(winOf(p2a, ["h", "h"]), "hi", "アドバンテージ込みで 3 勝");
  assert.strictEqual(winOf(p2n, ["h", "h"]), null, "アドバンテージなしは 3 勝が必要");
  assert.strictEqual(winOf(p2n, ["h", "h", "h"]), "hi");
  assert.strictEqual(winOf(p2a, ["l", "l", "l"]), "lo", "下位は 3 勝で突破");
  assert.strictEqual(winOf(p2a, ["l", "l", "h"]), null);
  assert.strictEqual(winOf(p2a, ["l", "l", "h", "h"]), "hi");
  assert.strictEqual(winOf(p2n, ["h", "l", "h", "l", "t"]), "hi", "5 試合で並んだら上位");
  // 日本シリーズ: 2-3-2、偶数年はセが第 1・2・6・7 戦
  const js = Object.assign(JSON.parse(JSON.stringify(ser(b45, "JS"))), { lo: P45[0].id });
  assert.strictEqual(js.hi, C6[0].id);
  const homes = (y) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (PP.homeOf(js, n, y) === js.hi ? "C" : "P")).join("");
  assert.strictEqual(homes(2004), "CCPPPCCC", "偶数年 (2004): セの本拠地で第 1・2・6・7 戦 (第 8 戦は第 1 戦と同じ)");
  assert.strictEqual(homes(2005), "PPCCCPPP", "奇数年: パの本拠地で第 1・2・6・7 戦");
  assert.strictEqual(winOf(js, ["h", "h", "h", "h"]), "hi", "4 勝で日本一");
  assert.strictEqual(play(js, ["h", "l", "h", "h", "h"]).st.n, 5);
  assert.strictEqual(winOf(js, ["h", "l", "h", "l", "h", "l", "t"]), null, "引き分けで 3 勝 3 敗 1 分なら第 8 戦へ");
  assert.strictEqual(winOf(js, ["h", "l", "h", "l", "h", "l", "t", "l"]), "lo", "第 8 戦で決着");
  assert.strictEqual(PP.maxInnings({ innings: 9 }, { ps: "JS", g: 3 }), 15, "日本シリーズの延長");
  assert.strictEqual(PP.maxInnings({ innings: 9 }, { ps: "JS", g: 8 }), 99, "第 8 戦以降は制限なし");
  assert.strictEqual(PP.maxInnings({ innings: 9 }, { ps: "P2", g: 1 }), 12, "プレーオフの延長");
  assert.strictEqual(PP.maxInnings({ innings: 3 }, { ps: "JS", g: 1 }), 5, "3 回制");
  // CS (後年ルール): 両リーグ・ファイナルは 1 位に 1 勝・リーグ優勝は 1 位
  const cs = PP.bracket(fake, "cs", { C: C6, P: P45 });
  same(
    cs.series.map((s) => s.id),
    ["C1", "C2", "P1", "P2", "JS"],
    "CS の系列"
  );
  for (const lg of ["C", "P"]) {
    const f = ser(cs, lg + "2");
    const st = lg === "C" ? C6 : P45;
    assert.ok(f.hi === st[0].id && f.adv === 1 && f.w[0] === 1 && f.need === 4 && f.max === 6, lg + " の CS ファイナル");
    assert.ok(ser(cs, lg + "1").hi === st[1].id && ser(cs, lg + "1").lo === st[2].id, lg + " の CS ファースト");
    assert.strictEqual(winOf(f, ["h", "h", "h"]), "hi", "ファイナルは 1 勝のアドバンテージ込みで 4 勝");
    assert.strictEqual(winOf(f, ["l", "h", "l", "h", "l", "t"]), "hi", "ファイナル 6 試合で並んだら 1 位");
  }
  assert.ok(cs.champs.C === C6[0].id && cs.champs.P === P45[0].id, "CS ありはリーグ優勝 = 1 位");
  console.log("組み合わせ: 2004 年 (アドバンテージ 4.5 差なし / 5.0 差あり)・日本シリーズ 2-3-2・CS (後年ルール)");
}
lap("ポストシーズンの組み合わせ");

/* ========== L2: 短期シーズンを高速でポストシーズン・表彰式まで ========== */
function runShort(o, check) {
  const p = Pen.create(o.my || my, Object.assign({ len: "s10", fast: "quick", seed: 41 }, o));
  Store.data.pennant = p;
  playDays(H, p, p.regDays, true);
  assert.strictEqual(p.day, p.regDays);
  const snap = { stats: JSON.stringify(p.stats), st: JSON.stringify(["C", "P"].map((lg) => Pen.standings(p, lg))), reg: p.results.length };
  if (check) check(p);
  playSeason(H, p, true);
  assert.ok(p.finished, "シーズンが終わらない");
  // 記録の分離: ポストシーズンの後もシーズン成績・順位表は変わらない
  assert.strictEqual(JSON.stringify(p.stats), snap.stats, "ポストシーズンの成績がシーズン成績に入った");
  assert.strictEqual(JSON.stringify(["C", "P"].map((lg) => Pen.standings(p, lg))), snap.st, "順位表が変わった");
  assert.strictEqual(Pen.regResults(p).length, snap.reg);
  checkResults(p);
  return p;
}
let shortPen;
{
  shortPen = runShort({ my: "t" }, (p) => {
    // ポストシーズンのハブ: 最初は第1ステージの開幕画面
    assert.ok(p.post && p.post.series.length === 3 && p.schedule[p.day].length === 1 && p.schedule[p.day][0].ps === "P1", "第1ステージの第 1 戦");
    assert.ok(/シリーズ開始/.test(Pen.hub().html()), "開幕の画面");
    p.post.seen.P1 = 1;
    const h = Pen.hub().html();
    assert.ok(/トーナメント表/.test(h) && /pp-card/.test(h) && /data-act="watch"/.test(h) && /シリーズを最後までおまかせ/.test(h), "ポストシーズンのハブ");
    assert.ok(/プレーオフ第1ステージ第1戦/.test(Pen.dayTag(p, p.day)), "日の呼び名: " + Pen.dayTag(p, p.day));
  });
  const p = shortPen;
  const P = p.post;
  const s1 = PP.series(p, "P1");
  const s2 = PP.series(p, "P2");
  const sj = PP.series(p, "JS");
  assert.ok(s1.win && s2.win && sj.win, "決着していない系列");
  assert.strictEqual(s2.lo, s1.win, "第2ステージは第1ステージの勝者");
  assert.strictEqual(P.champs.P, s2.win, "パ・リーグ優勝 = 第2ステージの勝者");
  assert.strictEqual(sj.hi, P.champs.C, "日本シリーズはセの優勝球団");
  assert.strictEqual(sj.lo, P.champs.P, "日本シリーズはパの優勝球団");
  assert.strictEqual(P.champs.JS, sj.win, "日本一");
  for (const s of P.series) {
    const rs = p.results.filter((r) => r.ps === s.id);
    assert.strictEqual(rs.length, s.games.length, s.id + " の試合数");
    rs.forEach((r, i) => {
      assert.strictEqual(r.gn, i + 1, "第何戦");
      assert.strictEqual(r.home, PP.homeOf(s, i + 1, 2004), s.id + " の主催球団");
      assert.ok(r.inn <= PP.maxInnings(p, { ps: s.id, g: r.gn }), "延長の上限");
    });
    const end = PP.stateAt(s, s.games.length);
    assert.strictEqual(end.win, s.win, s.id + " の勝者");
    assert.ok(!PP.stateAt(s, s.games.length - 1).win, s.id + " が決着の後も続いた");
    assert.ok(P.stats[s.id], s.id + " の成績");
  }
  assert.ok(P.mvp.JS && P.mvp.P2 && P.mvp.JS.tid === sj.win && P.mvp.JSf.tid === sj.lose, "シリーズの MVP");
  // 日付: ポストシーズンの日は増えていく
  for (let d = p.regDays; d < p.schedule.length; d++) assert.ok(p.dates[d] > p.dates[d - 1], "ポストシーズンの日付");
  assert.strictEqual(Pen.dayTag(p, p.awardsDay), "表彰式");
  same(p.schedule[p.awardsDay], [], "表彰式の日は試合なし");
  // ニュース: ポストシーズンの日に本塁打王争い・首位・マジック・連勝 (試合記事) を作らない
  const postNews = p.news.filter((n) => n.day >= p.regDays);
  assert.ok(!postNews.some((n) => /^(lead|stand|magic|clinch|po|out|game)$/.test(n.kind)), "ポストシーズンの日にレギュラーシーズンの記事");
  assert.ok(postNews.some((n) => n.key === "ps:start:JS") && postNews.some((n) => n.kind === "pswin" && /日本一/.test(n.title)), "日本シリーズの記事");
  assert.ok(postNews.some((n) => /パ・リーグ優勝/.test(n.title)), "パ・リーグ優勝の記事");
  assert.ok(p.news.some((n) => /王手/.test(n.title)), "王手の記事");
  assert.ok(postNews.some((n) => n.key === "aw:mvp:C") && postNews.some((n) => n.key === "aw:saw") && postNews.some((n) => n.key === "aw:b9:P"), "表彰の記事");
  assert.ok(p.news.some((n) => n.key === "aw:title:C" && n.day === p.regDays - 1), "タイトル確定の記事 (最終日)");
  assert.ok(p.news.some((n) => n.key === "aw:mmvp:34:C" && n.day === p.regDays), "月間 MVP (区分の後の最初の日)");
  // 同じ日をもう一度作っても増えない・同じ記録から同じ記事 (乱数なし)
  const n0 = p.news.length;
  const keys = p.news.map((n) => n.key);
  assert.strictEqual(new Set(keys).size, keys.length, "記事のキーが重複");
  for (let d = 0; d < p.day; d++) {
    delete p.newsState.done[d];
    News.generate(p, d);
  }
  assert.strictEqual(p.news.length, n0, "もう一度作ると増えた");
  for (const d of [p.regDays - 1, p.regDays, sj.end, p.awardsDay]) assert.strictEqual(gen(p, clone(p), d), gen(p, clone(p), d), Pen.dayLabel(p, d) + " の記事が作り直すと変わる");
  // ニュースの日送りに表彰式の日 (試合なし) がある
  Store.data.pennant = p;
  assert.ok(News.newsDays(p).indexOf(p.awardsDay) >= 0, "表彰式の日がニュースの日送りにない");
  const ns = News.screen({});
  const nh = ns.html();
  assert.ok(/表彰式/.test(nh) && /MVP/.test(nh), "表彰式の日のニュース");
  ns.onAct("prev");
  assert.ok(/日本シリーズ第\d戦/.test(ns.html()), "日本シリーズの日の見出し");
  // 画面: シーズン総括・表彰式・トーナメント表・タイトル争い
  const fin = Pen.final().html();
  assert.ok(/シーズン 総括/.test(fin) && /日本一/.test(fin) && /パ・リーグ1位通過/.test(fin) && /data-act="awards"/.test(fin), "シーズン総括");
  const aw = PA.screen({ ceremony: true });
  for (const t of ["main", "title", "b9", "gg", "mon"])
    for (const lg of ["C", "P"]) {
      aw.onAct("lg", lg);
      aw.onAct("tab", t);
      const h = aw.html();
      if (t === "b9") assert.strictEqual((h.match(/class="aw-p /g) || []).length, lg === "P" ? 10 : 9, "ベストナインの人数 " + lg);
      if (t === "gg") assert.strictEqual((h.match(/class="aw-p /g) || []).length, 9, "ゴールデン・グラブの人数 " + lg);
    }
  assert.ok(/pp-card/.test(PP.bracketScreen({}).html()));
  assert.ok(/tr-row/.test(Pen.leaders({ tab: "title" }).html()), "タイトル争いのタブ");
  // 表彰の中身
  const S = p.awards.season;
  for (const lg of ["C", "P"]) {
    const b9 = S[lg].b9;
    assert.strictEqual(b9.OF.length, 3, "外野は 3 人");
    assert.strictEqual("DH" in b9, lg === "P", lg === "P" ? "パは指名打者あり" : "セは指名打者なし");
    assert.ok(!("DH" in S[lg].gg) && S[lg].gg.OF.length === 3 && S[lg].gg.P, "ゴールデン・グラブは投手あり・DH なし");
    const ids = ["P", "C", "1B", "2B", "3B", "SS"].map((k) => b9[k] && b9[k].id).concat(b9.OF.map((r) => r.id), b9.DH ? [b9.DH.id] : []).filter(Boolean);
    assert.strictEqual(new Set(ids).size, ids.length, "ベストナインに同じ選手");
    for (const k of ["C", "1B", "2B", "3B", "SS"]) if (b9[k]) assert.strictEqual(PA.mainPos(Pen.findPlayer(b9[k].id).p, p.stats[b9[k].id]), k, "ベストナインの守備位置 " + k);
    assert.ok(!S[lg].roy || PA.rookieOK(p, Pen.findPlayer(S[lg].roy.id).p), "新人王の資格");
  }
  assert.ok(S.sawamura.none || (S.sawamura.id && !Array.isArray(S.sawamura)), "沢村賞は最大 1 人");
  // 月間 MVP: 区分 × リーグ × 打/投 で最大 1 人
  const mk = p.awards.monthly.filter((x) => !x.partial).map((x) => x.per + x.lg + x.kind);
  assert.ok(mk.length >= 2 && new Set(mk).size === mk.length, "月間 MVP の重複");
  // 王手・逆王手の記事 (作った日本シリーズ: 3 連勝 → 3 連敗)
  {
    const f = clone(p);
    const js = f.post.series.find((x) => x.id === "JS");
    const mkG = (n, w) => {
      const home = PP.homeOf(js, n, 2004);
      const hiHome = home === js.hi;
      const win = (w === "h") === hiHome;
      return { day: 500 + n, gi: 0, n, home, away: hiHome ? js.lo : js.hi, hs: win ? 3 : 1, as: win ? 1 : 3, inn: 9 };
    };
    js.games = ["h", "h", "h", "l", "l", "l"].map((w, i) => mkG(i + 1, w));
    js.win = null;
    js.end = null;
    f.news = [];
    for (let d = 501; d <= 506; d++) News.postNews(f, d);
    const tl = (d) => f.news.filter((x) => x.day === d && x.kind === "ps").map((x) => x.title).join(" / ");
    assert.ok(/先勝/.test(tl(501)), "先勝: " + tl(501));
    assert.ok(/日本一へ王手/.test(tl(503)), "王手: " + tl(503));
    assert.ok(/逆王手/.test(tl(506)), "逆王手: " + tl(506));
  }
  console.log("短期 + ポストシーズン: P1 " + s1.w.join("-") + " / P2 " + s2.w.join("-") + (s2.adv ? "(adv)" : "") + " / 日本シリーズ " + Pen.team(sj.win).short + " " + sj.w.join("-") + " / " + (p.schedule.length - p.regDays) + "日");
}
lap("短期 + ポストシーズン");

/* ========== L2: CS (後年ルール)・ポストシーズンなし・日付のない旧来の日程 ========== */
{
  const c = runShort({ cs: true, seed: 43 });
  same(
    c.post.series.map((s) => s.id),
    ["C1", "C2", "P1", "P2", "JS"]
  );
  assert.ok(c.post.champs.C === Pen.standings(c, "C")[0].id && c.post.champs.P === Pen.standings(c, "P")[0].id, "CS ありのリーグ優勝は 1 位");
  assert.ok(c.schedule[c.regDays].length === 2, "CS ファーストは両リーグ同じ日");
  assert.strictEqual(PP.series(c, "JS").hi, PP.series(c, "C2").win, "日本シリーズは CS の勝者");
  assert.ok(/CS/.test(Pen.final().html()), "CS の総括");
  // ポストシーズンなし: レギュラーシーズンの後は表彰式だけ
  const n = runShort({ post: false, seed: 44 });
  assert.ok(!n.post && n.awardsDay === n.regDays && n.schedule.length === n.regDays + 1 && n.awards.season, "ポストシーズンなし");
  assert.ok(/シーズン 総括/.test(Pen.final().html()));
  // 日付のない旧来の日程 (perPair): 月間 MVP なし・表彰はある
  const old = Pen.create(my, 2, "normal", 9);
  old.opts.fast = "quick"; // 時間短縮 (他球場も高速版で)
  Store.data.pennant = old;
  playSeason(H, old, true);
  assert.ok(old.finished && !old.dates && old.awards.season && old.awards.titles, "旧来の日程の表彰");
  assert.strictEqual((old.awards.monthly || []).length, 0, "日付のない日程に月間 MVP");
  assert.ok(/月間MVPはありません/.test(Object.assign(PA.screen({ tab: "mon" })).html()), "月間 MVP の画面 (日付なし)");
  assert.strictEqual(Pen.dayLabel(old, old.awardsDay), "表彰式", "日付のない表彰式の日");
  // 日付のない旧来の日程でもポストシーズン (移行した古いセーブ): 見出しは「日本シリーズ第N戦」
  const op = Pen.create(my, 2, "normal", 9);
  op.opts.fast = "quick";
  op.opts.post = true;
  Store.data.pennant = op;
  playSeason(H, op, true);
  assert.ok(op.finished && op.post.champs.JS && !op.dates, "日付のない日程のポストシーズン");
  const jsDay = PP.series(op, "JS").start;
  assert.strictEqual(Pen.dayLabel(op, jsDay), "日本シリーズ第1戦", "日付のない日のポストシーズンの見出し");
  checkResults(op);
}
lap("CS・ポストシーズンなし・旧来の日程");

/* ========== L2: タイトル (作った成績で) ========== */
{
  const tp = Pen.create("t", { len: "s10", fast: "quick", seed: 3 });
  Store.data.pennant = tp;
  // 各球団 100 試合 (作った結果)
  tp.results = [];
  let gi = 0;
  for (const lg of ["C", "P"])
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let r = 0; r < 20; r++) tp.results.push({ day: 0, gi: gi++, home: byLg[lg][i], away: byLg[lg][j], hs: 1, as: 0, hr: [] });
  assert.ok(Pen.standings(tp, "C").every((x) => x.g === 100));
  assert.strictEqual(PA.qualPA(100), 310, "規定打席 100 試合");
  assert.strictEqual(PA.qualPA(138), 428, "規定打席 138 試合 (四捨五入)");
  assert.strictEqual(PA.qualPA(133), 412, "規定打席 133 試合");
  assert.strictEqual(PA.qualOuts(100), 300, "規定投球回 100 試合");
  const T = Pen.team("t");
  const G = Pen.team("g");
  const bat = T.players.filter((p) => p.pos !== "P");
  const pit = T.players.filter((p) => p.pos === "P");
  const gb = G.players.filter((p) => p.pos !== "P");
  const gp = G.players.filter((p) => p.pos === "P");
  const S = (tp.stats = {});
  S[bat[0].id] = { pa: 310, ab: 280, h: 100, hr: 30, rbi: 80, bb: 25, sb: 3 }; // .357 規定ちょうど
  S[bat[1].id] = { pa: 309, ab: 250, h: 100, hr: 30, rbi: 70, bb: 50, sb: 20 }; // .400 規定に 1 打席足りない
  S[gb[0].id] = { pa: 330, ab: 300, h: 100, hr: 12, rbi: 90, bb: 20 }; // .333
  S[gb[1].id] = { pa: 360, ab: 330, h: 110, hr: 12, rbi: 90, bb: 20, sb: 20 }; // .333 (同率)
  S[pit[0].id] = { pg: 25, gs: 25, outs: 300, er: 20, w: 12, l: 5, pk: 150 }; // 規定ちょうど 1.80
  S[pit[1].id] = { pg: 20, gs: 20, outs: 299, er: 5, w: 12, l: 3, pk: 150 }; // 1 アウト足りない 0.45
  S[pit[2].id] = { pg: 50, outs: 60, er: 10, sv: 30, rw: 5, w: 5 }; // 35 SP
  S[gp[0].id] = { pg: 55, outs: 60, er: 8, sv: 34, rw: 0 }; // 34 SP
  S[gp[1].id] = { pg: 60, outs: 70, er: 6, hld: 30, rw: 4, w: 4 }; // 34 HP
  const ttl = (key) => PA.titles(tp, "C").find((e) => e.t.key === key);
  const names = (key) => ttl(key).holders.map((r) => r.x.p.id).sort();
  same(names("avg"), [bat[0].id], "首位打者は規定ちょうどの選手 (1 打席足りない選手は対象外)");
  assert.ok(ttl("avg").rows.some((r) => r.x.p.id === bat[1].id && !r.q), "規定未到達の印");
  assert.ok(/規定未到達/.test(PA.raceHTML(tp, "C")), "タイトル争いの規定未到達");
  same(names("hr"), [bat[0].id, bat[1].id].sort(), "本塁打王の同時受賞");
  same(names("rbi"), [gb[0].id, gb[1].id].sort(), "打点王の同時受賞");
  same(names("svp"), [pit[2].id], "最優秀救援投手はセーブポイント (セーブ+救援勝利)");
  same(names("era"), [pit[0].id], "最優秀防御率は規定投球回ちょうどの投手");
  same(names("w"), [pit[0].id, pit[1].id].sort(), "最多勝の同時受賞");
  same(names("hp"), [gp[1].id], "最優秀中継ぎ投手 (ホールド+救援勝利)");
  S[bat[1].id].pa = 310;
  same(names("avg"), [bat[1].id], "規定に届いたら首位打者");
  // 同率の首位打者 (分数で比べる)
  S[bat[0].id] = { pa: 310, ab: 300, h: 100 };
  S[bat[1].id] = { pa: 310, ab: 330, h: 110 };
  delete S[gb[0].id];
  delete S[gb[1].id];
  same(names("avg"), [bat[0].id, bat[1].id].sort(), "同率の首位打者は同時受賞");
  // 乱数を使わず、何度計算しても同じ
  const rnd = Math.random;
  Math.random = () => {
    throw new Error("タイトル・表彰で乱数を使った");
  };
  try {
    const a1 = JSON.stringify(PA.titles(tp, "C").map((e) => e.holders.map((r) => r.x.p.id)));
    const a2 = JSON.stringify(PA.titles(tp, "C").map((e) => e.holders.map((r) => r.x.p.id)));
    assert.strictEqual(a1, a2, "タイトルが計算ごとに変わる");
    const sp = clone(shortPen);
    delete sp.awards.season;
    delete sp.awards.titles;
    Store.data.pennant = sp;
    const t1 = JSON.stringify(PA.decideTitles(sp, 9));
    const s1 = JSON.stringify(PA.decideSeason(sp, sp.awardsDay));
    delete sp.awards.season;
    delete sp.awards.titles;
    assert.strictEqual(JSON.stringify(PA.decideTitles(sp, 9)), t1, "タイトルの作り直し");
    assert.strictEqual(JSON.stringify(PA.decideSeason(sp, sp.awardsDay)), s1, "表彰の作り直し");
    assert.strictEqual(JSON.stringify(sp.awards.season), JSON.stringify(shortPen.awards.season), "表彰が保存と違う");
  } finally {
    Math.random = rnd;
  }
  // 沢村賞の 7 項目
  const sw = PA.sawamuraCheck({ w: 15, l: 5, pk: 150, cg: 10, er: 50, outs: 600, pg: 25 }, 138, true);
  assert.strictEqual(sw.count, 7, "沢村賞の 7 項目");
  assert.strictEqual(PA.sawamuraCheck({ w: 14, l: 5, pk: 149, cg: 9, er: 56, outs: 597, pg: 24 }, 138, true).count, 1, "沢村賞の境界");
  assert.strictEqual(PA.sawamuraCheck({ w: 15, l: 5, pk: 150, cg: 10, er: 50, outs: 600, pg: 25 }, 138, false).cg, null, "完投の記録がないときは判定しない");
  console.log("タイトル: 規定の境界・同時受賞・セーブポイント・乱数なし");
}
lap("タイトル");

/* ========== L2: セーブの移行 (v2 → v3) ========== */
{
  // L1 の形 (v2・日付つき) で途中まで遊んだセーブ
  const a = Pen.create(my, { len: "s20", fast: "quick", seed: 52 });
  playDays(H, a, 3, true);
  const raw = clone(a);
  for (const k of ["statsSince", "post", "awards", "mcur", "awardsDay"]) delete raw[k];
  raw.v = 2;
  raw.opts.post = false;
  for (const id in raw.stats) for (const k of ["cg", "sho", "qs", "rw", "hld", "pos", "fe"]) delete raw.stats[id][k];
  Store.data.pennant = raw;
  Store.migrate();
  const p = Store.data.pennant;
  assert.ok(p.v === Pen.V && p.statsSince === 3 && p.opts.post === true && !p.legacyEnd, "v2 → v3 の移行");
  const once = JSON.stringify(p);
  Store.migrate();
  assert.strictEqual(JSON.stringify(p), once, "移行を二度しても変わらない");
  playSeason(H, p, true);
  assert.ok(p.finished && p.post.champs.JS && p.awards.season, "移行したセーブがポストシーズン・表彰まで進まない");
  assert.ok(
    p.awards.monthly.some((x) => x.per === "34" && x.partial),
    "途中から記録した月の月間 MVP は記録なし"
  );
  assert.ok(!PA.titles(p, "C").some((e) => e.t.key === "hp"), "ホールドの記録が途中からなら最優秀中継ぎなし");
  // 終わった旧セーブ: 何も足さず今までの最終画面
  const f = clone(shortPen);
  for (const k of ["statsSince", "post", "awards", "mcur", "awardsDay"]) delete f[k];
  f.v = 2;
  f.schedule = f.schedule.slice(0, f.regDays);
  f.dates = f.dates.slice(0, f.regDays);
  f.results = f.results.filter((r) => !r.ps);
  f.news = f.news.filter((n) => n.day < f.regDays - 1);
  Store.data.pennant = f;
  Store.migrate();
  const q = Store.data.pennant;
  assert.ok(q.legacyEnd && q.finished && !q.post && !q.awards, "終わった旧セーブに表彰・ポストシーズンを足した");
  assert.ok(/ペナントレース終了/.test(Pen.final().html()), "終わった旧セーブの最終画面");
  console.log("移行 (v3): 途中のセーブはポストシーズンへ・終わったセーブはそのまま");
}
lap("移行 (v3)");

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
  // シーズン終了まで (レギュラーシーズンの終わりで止まり、ポストシーズンが始まる)
  ctl = await simUntil(H, sp, Pen.stops.season());
  assert.strictEqual(sp.day, sp.regDays, "シーズン終了までで regDays に届かない");
  assert.ok(!sp.finished && sp.post && sp.post.series.length === 3 && sp.schedule.length === sp.regDays + 1, "ポストシーズンが始まっていない");
  for (const x of Pen.standings(sp, "C").concat(Pen.standings(sp, "P"))) assert.strictEqual(x.g, 70, "ハーフ 70 試合");
  // ポストシーズンを最後まで (非同期の消化)
  const st0 = JSON.stringify(sp.stats);
  ctl = await simUntil(H, sp, () => false);
  assert.ok(sp.finished && sp.post.champs.JS && sp.day === sp.schedule.length, "ポストシーズンが終わらない");
  assert.strictEqual(JSON.stringify(sp.stats), st0, "ポストシーズンの成績がシーズン成績に入った");
  for (const x of Pen.standings(sp, "C").concat(Pen.standings(sp, "P"))) assert.strictEqual(x.g, 70, "ポストシーズン後の試合数");
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
