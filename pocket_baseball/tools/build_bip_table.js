// 高速シミュレーション (quicksim.js) が使う打球結果の表 static/js/bip_table.js を作る。
// 物理版の守備 (PB.Play) を打球の初速・角度・方向の格子で何度も回し、結果の割合を数える。
//   1) 走者なし・通常の守備位置: アウト/単打/二塁打/三塁打/失策と打球の種類・最初に触った野手
//   2) 一塁走者あり (一塁手がベースに付く・併殺の位置): 打者の結果の表と、ゴロの併殺・野選の割合
//   3) 三塁走者あり (0・1 死): 外野フライでの生還 (犠飛) の割合
//   4) ファウルフライ・送りバント・盗塁の成功率
//   5) 物理版の試合を回して走者の進塁率 (単打で二塁から生還 など) と走力の効き
// 使い方: node tools/build_bip_table.js [サンプルの倍率 (既定 1)] [出力先] [--only=1,2,3,4,5]
//   --only を付けると、指定した段だけ測り直して残りは今の bip_table.js のまま (調整用)
"use strict";
const fs = require("fs");
const path = require("path");
const { loadEngine } = require("./load_engine.js");

const ARGS = process.argv.slice(2).filter((a) => a[0] !== "-");
const ONLY = (process.argv.find((a) => a.indexOf("--only=") === 0) || "").slice(7);
const RUN = (k) => !ONLY || ONLY.split(",").indexOf(String(k)) >= 0;
const SCALE = Number(ARGS[0] || 1);
const OUT = ARGS[1] || path.join(__dirname, "..", "static", "js", "bip_table.js");

// 再現できるよう乱数を固定する
let seed = 20040402;
Math.random = function () {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PB = loadEngine(["util.js", "data.js", "npb.js", "rosters2004.js", "field.js", "pitch.js", "play.js", "ai.js", "game.js"].concat(ONLY ? ["bip_table.js"] : []));
const { U, D, P, Game } = PB;
const OLD = PB.BIP || {};
const teams = D.newTeams();
const t0 = Date.now();
const lap = (name) => console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + "s");

// 表の格子 (quicksim.js と同じ定義)
const EV = [8, 4, 12]; // 8〜56 m/s
const LA = [-54, 6, 20]; // -54〜66 度
const PH = [-45, 10, 9]; // -45〜45 度
const SHIFT_LA = 24; // 一塁走者ありの守備位置で表を作り直す角度の上限 (それより上は 1) と同じ)
const FFO_LA = [20, 10, 6]; // 20〜80 度
const PH_EDGES = [45, 55, 65, 80, 100, 140]; // ファウルの |方向| の区切り
const BUNT_LA = [-60, 20, 6]; // -60〜60 度
const ST_SPD = [60, 10, 4]; // 走力 (+盗塁◯) 60〜100
const ST_ARM = [35, 15, 4]; // 捕手の肩 35〜95
const POS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const OUTC = { H1: "a", H2: "b", H3: "c", IPHR: "d", GO: "g", DP: "g", FC: "g", TP: "g", FO: "h", SF: "h", PO: "i", LO: "j", DPF: "j" };
const nCells = EV[2] * LA[2] * PH[2];
const cellIdx = (ei, li, pi) => (ei * LA[2] + li) * PH[2] + pi;
const SHIFT = { holdRunner: true, dpDepth: true };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const batters = [];
const pitchers = [];
for (const t of teams) for (const p of t.players) (p.pos === "P" ? pitchers : batters).push(p);
// 守備: 実在球団のスタメンをそのまま使う (平均的な守備になる)
function defenseOf(t) {
  const m = {};
  for (const e of D.lineupFor(t, true)) if (e.pos !== "DH" && e.pos !== "P") m[e.pos] = t.players.find((p) => p.id === e.id);
  const sp = t.rotation[Math.floor(Math.random() * t.rotation.length)];
  m.P = t.players.find((p) => p.id === sp);
  return m;
}
const defenses = teams.map(defenseOf);
// 平均的な守備力 (守備位置ごと)
const avg = { field: {}, catch: {}, arm: {} };
for (const pos of POS) for (const k of ["field", "catch", "arm"]) avg[k][pos] = Math.round((defenses.reduce((a, d) => a + d[pos][k], 0) / defenses.length) * 10) / 10;
avg.speed = Math.round((batters.reduce((a, p) => a + p.speed, 0) / batters.length) * 10) / 10;

function runPlay(o) {
  const play = new PB.Play(o);
  Game.runPlay(play);
  return play.result;
}
function batted(ev, la, phi, runners, outs, align) {
  const batter = pick(batters);
  const pit = pick(pitchers);
  const ball = P.battedBall({ ev, la, phi, bx: rnd(-0.2, 0.2), bz: rnd(0.55, 1.0) });
  return runPlay({ kind: "batted", ball, defense: pick(defenses), batter, batSide: P.batSide(batter, pit), runners, outs, align: align || {} });
}
const runnerOf = () => pick(batters);
const EMPTY = () => [null, null, null, null];
// 区分の中で一様に打球を作る
function inCell(ei, li, pi) {
  return [EV[0] + (ei + Math.random()) * EV[1], LA[0] + (li + Math.random()) * LA[1], PH[0] + (pi + Math.random()) * PH[1]];
}
// 打者の結果 → 記号 + 野手番号
function codeOf(r) {
  let pos = r.firstTouch;
  let code;
  if (r.type === "E") {
    code = r.batterBase >= 2 ? "f" : "e";
    pos = (r.error && r.error.pos) || pos;
  } else code = OUTC[r.type];
  return code ? code + (POS.indexOf(pos) + 1) : null;
}
const enc = (cnt) =>
  Object.keys(cnt)
    .sort()
    .map((k) => k + cnt[k])
    .join("");
// 実際の打球が少ない区分 (極端な角度・弱い打球) はサンプルを減らす
const nFor = (N, ei, li) => {
  const la0 = LA[0] + li * LA[1];
  return la0 < -36 || la0 >= 48 || ei < 2 ? Math.max(4, Math.round(N / 2.5)) : N;
};
// 走者なしの表を作る (align: 守備位置)
function gridCells(N, align) {
  const out = new Array(nCells).fill("");
  for (let ei = 0; ei < EV[2]; ei++)
    for (let li = 0; li < LA[2]; li++) {
      for (let pi = 0; pi < PH[2]; pi++) {
        const cnt = {};
        const n = nFor(N, ei, li);
        for (let k = 0; k < n; k++) {
          const [ev, la, phi] = inCell(ei, li, pi);
          const r = batted(ev, la, phi, EMPTY(), 0, align);
          if (r.type === "HR") continue; // 本塁打は quicksim が軌道から判定する
          const c = codeOf(r);
          if (c) cnt[c] = (cnt[c] || 0) + 1;
        }
        out[cellIdx(ei, li, pi)] = enc(cnt);
      }
    }
  return out;
}

/* ---------- 1) 走者なし・通常の守備位置 ---------- */
let cells = OLD.cells;
if (RUN(1)) {
  cells = gridCells(Math.max(4, Math.round(26 * SCALE)), {});
  lap("pass1");
}

/* ---------- 2) 一塁走者あり (0・1 死・一塁手がベースに付く・併殺の位置) ---------- */
// 打者の結果の表 (併殺・野選・ゴロはまとめて g) と、ゴロの内訳 (併殺・野選・打者アウト)
let cells1 = OLD.cells1;
let dp = OLD.dp;
if (RUN(2)) {
  const N2 = Math.max(4, Math.round(24 * SCALE));
  cells1 = new Array(nCells).fill("");
  dp = {};
  for (let ei = 0; ei < EV[2]; ei++)
    for (let li = 0; li < LA[2]; li++) {
      if (LA[0] + li * LA[1] >= SHIFT_LA) continue;
      for (let pi = 0; pi < PH[2]; pi++) {
        const cnt = {};
        const c = [0, 0, 0];
        const n = nFor(N2, ei, li);
        for (let k = 0; k < n; k++) {
          const [ev, la, phi] = inCell(ei, li, pi);
          const r = batted(ev, la, phi, [null, runnerOf(), null, null], Math.random() < 0.5 ? 0 : 1, SHIFT);
          if (r.type === "HR") continue;
          const code = codeOf(r);
          if (code) cnt[code] = (cnt[code] || 0) + 1;
          if (r.type === "DP" || r.type === "TP") c[0]++;
          else if (r.type === "FC") c[1]++;
          else if (r.type === "GO") c[2]++;
        }
        cells1[cellIdx(ei, li, pi)] = enc(cnt);
        if (c[0] + c[1] + c[2]) dp[cellIdx(ei, li, pi)] = c;
      }
    }
  lap("pass2");
}

/* ---------- 3) 三塁走者あり: 外野フライの犠飛 ---------- */
let sf = OLD.sf;
if (RUN(3)) {
  const N3 = Math.max(4, Math.round(16 * SCALE));
  sf = {};
  for (let ei = 0; ei < EV[2]; ei++)
    for (let li = 0; li < LA[2]; li++) {
      if (LA[0] + li * LA[1] < 12) continue;
      for (let pi = 0; pi < PH[2]; pi++) {
        const c = [0, 0];
        for (let k = 0; k < N3; k++) {
          const [ev, la, phi] = inCell(ei, li, pi);
          const r = batted(ev, la, phi, [null, null, null, runnerOf()], Math.random() < 0.5 ? 0 : 1, {});
          if (r.type === "SF") c[0]++;
          if (r.type === "SF" || r.type === "FO") c[1]++;
        }
        if (c[1]) sf[cellIdx(ei, li, pi)] = c;
      }
    }
  lap("pass3");
}

/* ---------- 4) ファウルフライ・送りバント・盗塁 ---------- */
let ffo = OLD.ffo && OLD.ffo.c;
let bunt = OLD.bunt && OLD.bunt.c;
let steal = OLD.steal && OLD.steal.c;
if (RUN(4)) {
  // 4a) ファウルフライ (角度 20 度以上・かすった打球以外) の捕球率と捕る野手
  ffo = [];
  const N4 = Math.max(10, Math.round(60 * SCALE));
  for (let li = 0; li < FFO_LA[2]; li++)
    for (let pj = 0; pj < PH_EDGES.length - 1; pj++) {
      let got = 0;
      const by = {};
      for (let k = 0; k < N4; k++) {
        const ev = rnd(18, 50);
        const la = FFO_LA[0] + (li + Math.random()) * FFO_LA[1];
        const ap = rnd(PH_EDGES[pj], PH_EDGES[pj + 1]);
        const phi = Math.random() < 0.5 ? -ap : ap;
        const batter = pick(batters);
        const pit = pick(pitchers);
        const r = runPlay({ kind: "batted", foul: true, ball: P.battedBall({ ev, la, phi, bx: rnd(-0.2, 0.2), bz: rnd(0.55, 1.0) }), defense: pick(defenses), batter, batSide: P.batSide(batter, pit), runners: EMPTY(), outs: 0, align: {} });
        if (r.type === "FFO") {
          got++;
          const key = (phi < 0 ? "L" : "R") + r.firstTouch;
          by[key] = (by[key] || 0) + 1;
        }
      }
      // 左右それぞれで一番多く捕った野手
      const best = (s) =>
        Object.keys(by)
          .filter((k) => k[0] === s)
          .sort((a, b) => by[b] - by[a])
          .map((k) => k.slice(1))[0] || (s === "L" ? "3B" : "1B");
      ffo.push([got, N4, best("L"), best("R")]);
    }
  lap("fouls");
  // 4b) 送りバント (一塁 or 二塁走者・無死、バントシフト): 打球の角度ごとの結果
  bunt = [];
  {
    const raw = Array.from({ length: BUNT_LA[2] }, () => ({}));
    const NB = Math.max(400, Math.round(3000 * SCALE));
    const weak = batters.filter((p) => p.power <= 52);
    for (let k = 0; k < NB; k++) {
      const t = pick(teams);
      const pit = pick(pitchers);
      const bat = pick(weak);
      const ch = PB.AI.choosePitch(pit, { balls: 0, strikes: 0, outs: 0, inning: 5 });
      const pc = P.make(pit, ch.type, ch.aim, null, { balls: 0, strikes: 0 });
      const res = P.swing(pc, PB.AI.buntAim(pc), bat, pit, { balls: 0, strikes: 0, level: PB.AI.SIM });
      if (res.type !== "inplay") continue;
      const second = Math.random() < 0.15;
      const runners = second ? [null, null, runnerOf(), null] : [null, runnerOf(), null, null];
      const r = runPlay({ kind: "batted", ball: P.battedBall(res), defense: defenseOf(t), batter: bat, batSide: P.batSide(bat, pit), runners, outs: 0, bunt: true, align: { buntShift: true, holdRunner: !second } });
      const li = U.clamp(Math.floor((res.la - BUNT_LA[0]) / BUNT_LA[1]), 0, BUNT_LA[2] - 1);
      const ty = r.type === "TP" ? "DP" : r.type === "DPF" ? "LO" : r.type;
      raw[li][ty] = (raw[li][ty] || 0) + 1;
    }
    for (const c of raw) bunt.push(c);
  }
  lap("bunts");
  // 4c) 盗塁 (走力 + 盗塁◯ × 捕手の肩 × クイック)。リードは Game.stealLead と同じ式
  steal = [];
  const NS = Math.max(20, Math.round(90 * SCALE));
  for (let from = 1; from <= 2; from++)
    for (let q = 0; q < 2; q++)
      for (let si = 0; si < ST_SPD[2]; si++)
        for (let ai = 0; ai < ST_ARM[2]; ai++) {
          let ok = 0;
          for (let k = 0; k < NS; k++) {
            const def = Object.assign({}, defenseOf(pick(teams)));
            def.C = Object.assign({}, def.C, { arm: ST_ARM[0] + (ai + Math.random()) * ST_ARM[1] });
            const pit = Object.assign({}, def.P, { skills: q ? ["quick"] : [] });
            def.P = pit;
            const run = Object.assign({}, pick(batters), { speed: ST_SPD[0] + (si + Math.random()) * ST_SPD[1], skills: [] });
            const bat = pick(batters);
            const runners = EMPTY();
            runners[from] = run;
            const stealing = { [from]: true };
            // 実際の投球 (球種で到達時間が違う) のリード
            const ch = PB.AI.choosePitch(pit, { balls: 1, strikes: 1, outs: 0, inning: 5 });
            const pc = P.make(pit, ch.type, ch.aim, null, { balls: 1, strikes: 1 });
            const lead = Game.prototype.stealLead.call({ bases: runners, pitcher: () => pit }, stealing, pc);
            const play = new PB.Play({ kind: "steal", defense: def, batter: bat, batSide: P.batSide(bat, pit), runners, stealing, stealLead: lead, outs: 0, align: {} });
            play.fmap.C.holdT += 0.25;
            Game.runPlay(play);
            const s = play.result.steals.find((x) => x.from === from);
            if (s && s.ok) ok++;
          }
          steal.push(Math.round((ok / NS) * 1000) / 1000);
        }
  lap("steals");
}

/* ---------- 5) 物理版の試合から走者の進塁率 ---------- */
// 走者ありの安打は、物理版では送球の間に打者が二塁へ進む (= 二塁打) ことがあるので、
// 打球の区分の「単打/二塁打/三塁打の割合」(w1, w2, w3) を重みにして、単打を引いたときの割合を求める:
//   実際の結果 y の期待値 = w1 × p + (二塁打以上なら必ず起きる分)  →  y - 必ず起きる分 = p·w1 を最小二乗で解く
let adv = OLD.adv;
if (RUN(5)) {
  adv = {};
  const acc = {};
  const spdOf = (p) => p.speed + (D.has(p, "baserun") ? 8 : 0);
  // k: 割合の名前、s: 走力、y: 起きたか、w: 重み、off: 必ず起きる分
  const rec = (k, s, y, w, off) => (acc[k] || (acc[k] = [])).push([s, y ? 1 : 0, w == null ? 1 : w, off || 0]);
  const parse = (str) => {
    const c = { a: 0, b: 0, c: 0 };
    const re = /([a-j])(\d)(\d+)/g;
    let m;
    while ((m = re.exec(str || ""))) {
      const n = Number(m[3]);
      if (m[1] === "a" && Number(m[2]) >= 7) c.a += n;
      else if (m[1] === "b") c.b += n;
      else if (m[1] === "c" || m[1] === "d") c.c += n;
    }
    const tot = c.a + c.b + c.c;
    return tot ? { w1: c.a / tot, w2: c.b / tot, w3: c.c / tot } : null;
  };
  const P0 = cells.map(parse);
  const P1 = cells.map((s, i) => (cells1 && cells1[i] ? parse(cells1[i]) : P0[i]));
  const bin = (v, g) => U.clamp(Math.floor((v - g[0]) / g[1]), 0, g[2] - 1);
  const origMk = Game.prototype.makeBattedPlay;
  Game.prototype.makeBattedPlay = function (jr, sw, steal) {
    this._ball = sw && sw.bunt ? null : jr.res;
    return origMk.call(this, jr, sw, steal);
  };
  const orig = Game.prototype.applyPlay;
  Game.prototype.applyPlay = function (res) {
    const b = this.bases.slice();
    const bat = this.batter();
    const o2 = this.outs === 2 ? "2" : "01";
    const t = res.type;
    const where = (p) => {
      if (res.scorers.indexOf(p) >= 0) return 4;
      for (let i = 1; i <= 3; i++) if (res.bases[i] === p) return i;
      return 0;
    };
    const ofTouch = ["LF", "CF", "RF"].indexOf(res.firstTouch) >= 0;
    const ball = this._ball;
    this._ball = null;
    const hit = t === "H1" || t === "H2" || t === "H3" || t === "IPHR";
    if (hit && ofTouch && ball && (b[1] || b[2] || b[3])) {
      const idx = (bin(ball.ev, EV) * LA[2] + bin(ball.la, LA)) * PH[2] + bin(ball.phi, PH);
      const w = (b[1] ? P1 : P0)[idx];
      if (w) {
        const more = w.w2 + w.w3; // 二塁打以上を引けば必ず起きる
        if (b[2]) rec("h1r2_" + o2, spdOf(b[2]), where(b[2]) === 4, w.w1, more);
        if (b[1] && (!b[2] || where(b[2]) === 4)) rec("h1r1_" + o2, spdOf(b[1]), where(b[1]) >= 3, w.w1, more);
        // 送球の間に打者が二塁へ (二塁が空いたときだけ)。送球先で割合が違うので走者の状況で分ける
        if (![b[1], b[2], b[3]].some((p) => p && where(p) === 2)) rec("h1bat_" + (b[2] ? "2" : b[1] ? "1" : "3"), spdOf(bat), (res.batterBase || 0) >= 2, w.w1, more);
        if (b[1]) rec("h2r1_" + o2, spdOf(b[1]), where(b[1]) === 4, w.w2, w.w3);
      }
    }
    if ((t === "GO" || t === "DP" || t === "FC") && this.outs < 2) {
      if (b[3] && !(b[1] && b[2])) rec("goR3", spdOf(b[3]), where(b[3]) === 4);
      if (b[2] && !b[1] && !b[3]) rec("goR2", spdOf(b[2]), where(b[2]) >= 3);
    }
    if ((t === "FO" || t === "SF") && this.outs < 2) {
      if (b[3]) rec("foR3", spdOf(b[3]), where(b[3]) === 4);
      if (b[2] && !b[3]) rec("foR2", spdOf(b[2]), where(b[2]) === 3);
    }
    return orig.call(this, res);
  };
  const NG = Math.max(20, Math.round(240 * SCALE));
  for (let i = 0; i < NG; i++) {
    const a = teams[i % 12];
    let h = teams[(i * 5 + 1 + Math.floor(i / 12)) % 12];
    if (h === a) h = teams[(i + 1) % 12];
    const g = new Game({ away: U.clone(a), home: U.clone(h), innings: 9 });
    g.simToEnd();
  }
  Game.prototype.applyPlay = orig;
  Game.prototype.makeBattedPlay = origMk;
  // y - off = p·w + k·w·(走力 - 平均) を最小二乗で解く
  for (const k in acc) {
    const a = acc[k];
    const sw = a.reduce((s, x) => s + x[2], 0);
    if (sw <= 0) continue;
    const ms = a.reduce((s, x) => s + x[0] * x[2], 0) / sw;
    let s11 = 0;
    let s12 = 0;
    let s22 = 0;
    let t1 = 0;
    let t2 = 0;
    for (const [s, y, w, off] of a) {
      const x2 = w * (s - ms);
      const z = y - off;
      s11 += w * w;
      s12 += w * x2;
      s22 += x2 * x2;
      t1 += w * z;
      t2 += x2 * z;
    }
    const det = s11 * s22 - s12 * s12;
    let p0 = s11 > 0 ? t1 / s11 : 0;
    let slope = 0;
    if (det > 1e-9) {
      p0 = (t1 * s22 - t2 * s12) / det;
      slope = (s11 * t2 - s12 * t1) / det;
    }
    adv[k] = [Math.round(U.clamp(p0, 0, 1) * 1000) / 1000, Math.round(U.clamp(slope, -0.02, 0.02) * 10000) / 10000, Math.round(ms * 10) / 10, Math.round(sw)];
  }
  lap("games");
}

const table = {
  v: 2,
  ev: EV,
  la: LA,
  ph: PH,
  cells,
  cells1,
  dp,
  sf,
  ffo: { la: FFO_LA, ph: PH_EDGES, c: ffo },
  bunt: { la: BUNT_LA, c: bunt },
  steal: { spd: ST_SPD, arm: ST_ARM, c: steal },
  adv,
  avg,
};
const src =
  "/* 熱闘！ポケットベースボール — 高速シミュレーションの打球結果の表\n" +
  " * tools/build_bip_table.js が物理版の守備 (play.js) を回して作ったデータ。手で直さない。\n" +
  " * cells[(初速 × 角度 × 方向の区分)] = 「結果の記号 + 野手の番号 + 回数」の並び (cells1 は一塁走者がいるときの守備位置)\n" +
  " *   結果: a 単打 b 二塁打 c 三塁打 d ランニング本塁打 e 失策(一塁へ) f 失策(二塁以上) g ゴロ h 外野フライ i 内野フライ j ライナー\n" +
  " *   野手: 1 投 2 捕 3 一 4 二 5 三 6 遊 7 左 8 中 9 右 */\n" +
  "(function (PB) {\n" +
  '  "use strict";\n' +
  "  PB.BIP = " +
  JSON.stringify(table) +
  ";\n" +
  "})((window.PB = window.PB || {}));\n";
fs.writeFileSync(OUT, src);
console.log("wrote", OUT, (src.length / 1024).toFixed(1) + "KB", "in", ((Date.now() - t0) / 1000).toFixed(1) + "s");
