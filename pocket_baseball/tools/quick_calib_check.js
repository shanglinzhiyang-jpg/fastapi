// 高速シミュレーション (quicksim.js) と物理版の成績を同じ対戦で比べる
// 使い方: node tools/quick_calib_check.js [試合数 (既定 300)]
"use strict";
const assert = require("assert");
const { loadEngine } = require("./load_engine.js");

const PB = loadEngine();
const N = Number(process.argv[2] || 300);
const teams = PB.D.newTeams();
const U = PB.U;

// 同じ対戦の組 (全球団の総当たりを順に)
const pairs = [];
for (let i = 0; pairs.length < N; i++) {
  const a = i % 12;
  const h = (a + 1 + (Math.floor(i / 12) % 11)) % 12;
  pairs.push([teams[a], teams[h]]);
}

function run(Cls) {
  const tot = { g: 0, pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, r: 0, sb: 0, cs: 0, d: 0, sf: 0, sac: 0, e: 0, ms: 0 };
  for (const [a, h] of pairs) {
    const t0 = process.hrtime.bigint();
    const g = new Cls({ away: U.clone(a), home: U.clone(h), innings: 9 });
    g.simToEnd();
    tot.ms += Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(g.over && g.result, "試合が終わらない");
    tot.g++;
    tot.r += g.score.away + g.score.home;
    tot.e += g.errors.away + g.errors.home;
    for (const id in g.box) {
      const s = g.box[id];
      for (const k of ["pa", "ab", "h", "hr", "bb", "k", "sb", "cs", "d", "sf", "sac"]) tot[k] += s[k] || 0;
    }
    // 得点 = 打者の得点の合計 = スコアボード
    for (const side of ["away", "home"]) {
      const ids = new Set(g.teams[side].players.map((p) => p.id));
      const runs = Object.keys(g.box)
        .filter((id) => ids.has(id))
        .reduce((x, id) => x + (g.box[id].r || 0), 0);
      assert.strictEqual(runs, g.score[side], "得点が一致しない");
      const line = g.line[side].reduce((x, v) => x + (typeof v === "number" ? v : 0), 0);
      assert.strictEqual(line, g.score[side], "スコアボードが一致しない");
    }
  }
  const per = (k) => tot[k] / tot.g / 2; // 1 チーム 1 試合あたり
  return {
    avg: tot.h / tot.ab,
    hr: per("hr"),
    r: per("r"),
    k: (tot.k / tot.pa) * 100,
    bb: (tot.bb / tot.pa) * 100,
    sb: per("sb"),
    cs: per("cs"),
    d: per("d"),
    sf: per("sf"),
    sac: per("sac"),
    e: per("e"),
    ms: tot.ms / tot.g,
  };
}

const phys = run(PB.Game);
const quick = run(PB.QuickGame);
const fmt = (x) => "AVG " + x.avg.toFixed(3) + "  HR/G " + x.hr.toFixed(2) + "  R/G " + x.r.toFixed(2) + "  K% " + x.k.toFixed(1) + "  BB% " + x.bb.toFixed(1) + "  SB/G " + x.sb.toFixed(2) + "  CS/G " + x.cs.toFixed(2) + "  2B/G " + x.d.toFixed(2) + "  SF/G " + x.sf.toFixed(2) + "  SAC/G " + x.sac.toFixed(2) + "  E/G " + x.e.toFixed(2) + "  " + x.ms.toFixed(1) + "ms/試合";
console.log("物理 " + fmt(phys));
console.log("高速 " + fmt(quick));
const lim = { avg: 0.015, hr: 0.25, r: 0.6, k: 2, bb: 1.5, sb: 0.3 };
const bad = [];
for (const k in lim) if (Math.abs(phys[k] - quick[k]) >= lim[k]) bad.push(k + " の差 " + Math.abs(phys[k] - quick[k]).toFixed(3) + " (上限 " + lim[k] + ")");
if (quick.ms > phys.ms / 5) bad.push("高速版が遅い: " + quick.ms.toFixed(1) + "ms (物理版の 1/5 = " + (phys.ms / 5).toFixed(1) + "ms)");
assert.deepStrictEqual(bad, [], bad.join("\n"));
console.log("速さ: 物理版の " + (phys.ms / quick.ms).toFixed(1) + " 倍");
console.log("OK");
