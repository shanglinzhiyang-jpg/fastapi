// 巨人の特色「本塁打がソロに偏る」(pitch.js の P.SOLO_HR / P.soloShift) のチェック
//  1) 柵越えの境目の打球だけが動く (走者ありは柵越えをフェンス手前へ・走者なしは届かない打球を柵越えへ)
//  2) Game.ctx: 攻撃側が巨人のときだけ (人もCPUも)。ホームラン競争など 99 回制の遊びは対象外
//  3) 巨人の本塁打のソロの割合 (高速版・物理版) と本数 (特色なしとの比)
//  4) 巨人の出ない試合は特色の有無で結果がまったく同じ
// 使い方: node tools/solo_hr_check.js [高速版の試合数 (既定 1000)] [物理版の試合数 (既定 120)] [乱数の種]
"use strict";
const assert = require("assert");
const { loadEngine } = require("./load_engine.js");

const NQ = Number(process.argv[2] || 1000);
const NP = Number(process.argv[3] || 120);
const SEED = Number(process.argv[4] || 7);

// 結果を再現できるように乱数を固定する (エンジンは Math.random を使う)
let seed = 1;
const reseed = (s) => (seed = s >>> 0 || 1);
Math.random = function () {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PB = loadEngine();
const P = PB.P;
const U = PB.U;
const teams = PB.D.newTeams();
const GIANTS = teams.find((t) => t.id === "g");
const others = teams.filter((t) => t.id !== "g");
const STRENGTH = P.SOLO_HR.g;
assert.ok(STRENGTH > 0, "巨人に特色がない");
const setTrait = (on) => {
  if (on) P.SOLO_HR.g = STRENGTH;
  else delete P.SOLO_HR.g;
};
const T0 = Date.now();
const lap = () => "[" + ((Date.now() - T0) / 1000).toFixed(1) + "s]";

/* ---------- 1) 境目の打球だけが動く ---------- */
{
  const ball = (ev, la) => ({ type: "inplay", ev, la, phi: 0, bx: 0, bz: 0.8 });
  // 角度 30 度・センター方向でちょうど柵越えになる打球速度
  let lo = 30;
  let hi = 60;
  while (hi - lo > 0.01) {
    const m = (lo + hi) / 2;
    if (P.clears(ball(m, 30), m)) hi = m;
    else lo = m;
  }
  const thr = hi;
  const K = P.SOLO;
  const on = { soloHR: STRENGTH, runnersOn: true };
  const empty = { soloHR: STRENGTH, runnersOn: false };
  const shift = (ev, ctx, la) => {
    const r = ball(ev, la == null ? 30 : la);
    P.soloShift(r, ctx);
    return r;
  };
  // 走者あり: 境目の柵越えはフェンス手前へ、文句なしの当たりはそのまま
  const a = shift(thr + 1, on);
  assert.ok(!P.clears(a, a.ev) && a.ev < thr && a.ev > thr - 3, "走者ありの境目の柵越えがフェンス手前に戻らない: " + a.ev.toFixed(2));
  assert.strictEqual(shift(thr + K.pull * STRENGTH + 0.5, on).ev, thr + K.pull * STRENGTH + 0.5, "文句なしの当たりまで戻している");
  assert.strictEqual(shift(thr - 1, on).ev, thr - 1, "走者ありで柵越えでない打球が変わった");
  // 走者なし: あと少しの打球は柵越えへ、遠い打球・もともとの柵越えはそのまま
  const b = shift(thr - 1, empty);
  assert.ok(P.clears(b, b.ev) && b.ev <= thr - 1 + K.push * STRENGTH + 1e-9, "走者なしの惜しい打球が柵越えにならない: " + b.ev.toFixed(2));
  assert.strictEqual(shift(thr - K.push * STRENGTH - 0.5, empty).ev, thr - K.push * STRENGTH - 0.5, "届かない打球まで柵越えにした");
  assert.strictEqual(shift(thr + 1, empty).ev, thr + 1, "走者なしの柵越えが変わった");
  // ゴロ・ライナーは変えない
  assert.strictEqual(shift(50, on, -5).ev, 50);
  assert.strictEqual(shift(50, empty, 8).ev, 50);
  // 打球速度の上限は超えない
  const c = shift(P.EV.maxEV - 0.5, empty, 15);
  assert.ok(c.ev <= P.EV.maxEV, "打球速度の上限を超えた");
  console.log(lap() + " 境目の打球: 柵越えの打球速度 " + thr.toFixed(2) + "m/s (角度30度・センター)  走者あり " + (thr + 1).toFixed(2) + "→" + a.ev.toFixed(2) + "  走者なし " + (thr - 1).toFixed(2) + "→" + b.ev.toFixed(2));
}

/* ---------- 2) Game.ctx ---------- */
{
  const t = teams.find((x) => x.id === "t");
  const g = new PB.Game({ away: U.clone(GIANTS), home: U.clone(t), innings: 9, user: "away" });
  assert.strictEqual(g.ctx("bat").soloHR, STRENGTH, "人が巨人で打つときに特色がない");
  assert.strictEqual(g.ctx("cpuBat").soloHR, STRENGTH, "CPU の巨人に特色がない");
  g.top = false;
  assert.ok(!g.ctx("cpuBat").soloHR, "巨人以外の攻撃に特色が付いた");
  const d = new PB.Game({ away: U.clone(GIANTS), home: U.clone(t), innings: 99, user: "away" });
  assert.ok(!d.ctx("bat").soloHR, "ホームラン競争 (99 回制) に特色が付いた");
  console.log(lap() + " Game.ctx: 巨人の攻撃だけ (人・CPU)。99 回制は対象外");
}

/* ---------- 3) 巨人の本塁打のソロの割合 ---------- */
function play(Cls, n, on, s) {
  setTrait(on);
  reseed(s);
  const tal = () => ({ g: 0, r: 0, hr: 0, solo: 0 });
  const T = { g: tal(), opp: tal() };
  for (let i = 0; i < n; i++) {
    const o = others[i % others.length];
    const away = i % 2 ? o : GIANTS;
    const home = i % 2 ? GIANTS : o;
    const g = new Cls({ away: U.clone(away), home: U.clone(home), innings: 9 });
    g.simToEnd();
    for (const side of ["away", "home"]) {
      const x = g.teams[side].id === "g" ? T.g : T.opp;
      x.g++;
      x.r += g.score[side];
    }
    for (const e of g.hrLog) {
      const x = e.tid === "g" ? T.g : T.opp;
      x.hr++;
      if (e.n === 1) x.solo++;
    }
  }
  setTrait(true);
  return T;
}
const fmt = (x) => "試合 " + x.g + "  本塁打 " + x.hr + "  HR/G " + (x.hr / x.g).toFixed(2) + "  ソロ " + ((x.solo / x.hr) * 100).toFixed(1) + "%  R/G " + (x.r / x.g).toFixed(2);

const qOn = play(PB.QuickGame, NQ, true, SEED);
const qOff = play(PB.QuickGame, NQ, false, SEED + 1);
console.log(lap() + " 高速 巨人 特色あり " + fmt(qOn.g));
console.log(lap() + " 高速 巨人 特色なし " + fmt(qOff.g));
console.log(lap() + " 高速 相手 特色あり " + fmt(qOn.opp));
const pOn = play(PB.Game, NP, true, SEED + 2);
console.log(lap() + " 物理 巨人 特色あり " + fmt(pOn.g));
console.log(lap() + " 物理 相手 特色あり " + fmt(pOn.opp));

const share = (x) => x.solo / x.hr;
const ratio = qOn.g.hr / qOn.g.g / (qOff.g.hr / qOff.g.g);
console.log("本塁打数の比 (特色あり / なし, 高速) " + ratio.toFixed(3));
assert.ok(qOn.g.hr >= 300 && pOn.g.hr >= 150, "本塁打が少なすぎて判定できない (試合数を増やす)");
assert.ok(share(qOn.g) >= 0.8, "高速版で巨人のソロの割合が 8 割未満: " + share(qOn.g).toFixed(3));
assert.ok(share(pOn.g) >= 0.8, "物理版で巨人のソロの割合が 8 割未満: " + share(pOn.g).toFixed(3));
assert.ok(share(qOff.g) < 0.65, "特色なしでもソロに偏っている (特色の切り替えが効いていない?)");
assert.ok(ratio > 0.95 && ratio < 1.2, "巨人の本塁打の本数が大きく変わった: " + ratio.toFixed(3));
for (const x of [qOn.opp, pOn.opp]) assert.ok(share(x) > 0.4 && share(x) < 0.68, "相手球団のソロの割合が普通でない: " + share(x).toFixed(3));

/* ---------- 4) 巨人の出ない試合は特色の有無で同じ ---------- */
function control(Cls, n, on) {
  setTrait(on);
  reseed(SEED + 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = others[i % others.length];
    const h = others[(i + 1 + (Math.floor(i / others.length) % (others.length - 1))) % others.length];
    const g = new Cls({ away: U.clone(a), home: U.clone(h), innings: 9 });
    g.simToEnd();
    out.push(JSON.stringify([g.score, g.line, g.hrLog.map((e) => [e.id, e.n, e.inn, e.dist])]));
  }
  setTrait(true);
  return out;
}
assert.deepStrictEqual(control(PB.QuickGame, 60, true), control(PB.QuickGame, 60, false), "巨人の出ない試合 (高速版) の結果が変わった");
assert.deepStrictEqual(control(PB.Game, 12, true), control(PB.Game, 12, false), "巨人の出ない試合 (物理版) の結果が変わった");
console.log(lap() + " 巨人の出ない試合: 特色の有無で結果が同じ (高速 60 試合・物理 12 試合)");
console.log("OK");
