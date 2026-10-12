// 高速シミュレーション (quicksim.js) が使う打球結果の表 static/js/bip_table.js を作る。
// 物理版の守備 (PB.Play) を打球の初速・角度・方向の格子で何度も回し、結果の割合を数える。
//   1) 走者なし: アウト/単打/二塁打/三塁打/失策と打球の種類・最初に触った野手
//   2) 一塁走者あり (0・1 死): ゴロの併殺・野選の割合
//   3) 三塁走者あり (0・1 死): 外野フライでの生還 (犠飛) の割合
//   4) ファウルフライ・送りバント・盗塁の成功率
//   5) 物理版の試合を回して走者の進塁率 (単打で二塁から生還 など) と走力の効き
// 使い方: node tools/build_bip_table.js [サンプルの倍率 (既定 1)] [出力先]
"use strict";
const fs = require("fs");
const path = require("path");
const { loadEngine } = require("./load_engine.js");

const SCALE = Number(process.argv[2] || 1);
const OUT = process.argv[3] || path.join(__dirname, "..", "static", "js", "bip_table.js");

// 再現できるよう乱数を固定する
let seed = 20040402;
Math.random = function () {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PB = loadEngine(["util.js", "data.js", "npb.js", "rosters2004.js", "field.js", "pitch.js", "play.js", "ai.js", "game.js"]);
const { U, D, P, Game } = PB;
const teams = D.newTeams();
const t0 = Date.now();

// 表の格子 (quicksim.js と同じ定義)
const EV = [8, 4, 12]; // 8〜56 m/s
const LA = [-54, 6, 20]; // -54〜66 度
const PH = [-45, 10, 9]; // -45〜45 度
const POS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const OUTC = { H1: "a", H2: "b", H3: "c", IPHR: "d", GO: "g", FO: "h", PO: "i", LO: "j" };
const nCells = EV[2] * LA[2] * PH[2];
const cellIdx = (ei, li, pi) => (ei * LA[2] + li) * PH[2] + pi;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const batters = [];
const catchers = [];
const pitchers = [];
for (const t of teams)
  for (const p of t.players) {
    if (p.pos === "P") pitchers.push(p);
    else batters.push(p);
    if (p.pos === "C") catchers.push(p);
  }
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
for (const pos of POS) {
  for (const k of ["field", "catch", "arm"]) avg[k][pos] = Math.round((defenses.reduce((a, d) => a + d[pos][k], 0) / defenses.length) * 10) / 10;
}
const batSpd = Math.round((batters.reduce((a, p) => a + p.speed, 0) / batters.length) * 10) / 10;

function runPlay(o) {
  const play = new PB.Play(o);
  Game.runPlay(play);
  return play.result;
}
function batted(ev, la, phi, runners, outs, align, bat) {
  const batter = bat || pick(batters);
  const pit = pick(pitchers);
  const ball = P.battedBall({ ev, la, phi, bx: rnd(-0.2, 0.2), bz: rnd(0.55, 1.0) });
  return runPlay({ kind: "batted", ball, defense: pick(defenses), batter, batSide: P.batSide(batter, pit), runners, outs, align: align || {} });
}
const runnerOf = () => pick(batters);

/* ---------- 1) 走者なし ---------- */
const N1 = Math.max(4, Math.round(26 * SCALE));
const cells = new Array(nCells).fill("");
let hrSkip = 0;
for (let ei = 0; ei < EV[2]; ei++)
  for (let li = 0; li < LA[2]; li++)
    for (let pi = 0; pi < PH[2]; pi++) {
      const cnt = {};
      // 実際の打球が少ない区分 (極端な角度・弱い打球) はサンプルを減らす
      const la0 = LA[0] + li * LA[1];
      const n1 = la0 < -36 || la0 >= 48 || ei < 2 ? Math.max(4, Math.round(N1 / 2.5)) : N1;
      for (let k = 0; k < n1; k++) {
        const ev = EV[0] + (ei + Math.random()) * EV[1];
        const la = LA[0] + (li + Math.random()) * LA[1];
        const phi = PH[0] + (pi + Math.random()) * PH[1];
        const r = batted(ev, la, phi, [null, null, null, null], 0, {});
        if (r.type === "HR") {
          hrSkip++;
          continue; // 本塁打は quicksim が軌道から判定する
        }
        let code;
        let pos = r.firstTouch;
        if (r.type === "E") {
          code = r.batterBase >= 2 ? "f" : "e";
          pos = (r.error && r.error.pos) || pos;
        } else code = OUTC[r.type];
        if (!code) continue;
        const key = code + (POS.indexOf(pos) + 1);
        cnt[key] = (cnt[key] || 0) + 1;
      }
      cells[cellIdx(ei, li, pi)] = Object.keys(cnt)
        .sort()
        .map((k) => k + cnt[k])
        .join("");
    }
console.log("pass1", ((Date.now() - t0) / 1000).toFixed(1) + "s", "HR skipped", hrSkip);

/* ---------- 2) 一塁走者あり: ゴロの併殺・野選 ---------- */
const N2 = Math.max(4, Math.round(16 * SCALE));
const dp = {};
for (let ei = 0; ei < EV[2]; ei++)
  for (let li = 0; li < LA[2]; li++) {
    const la0 = LA[0] + li * LA[1];
    if (la0 >= 12) continue;
    for (let pi = 0; pi < PH[2]; pi++) {
      const c = [0, 0, 0];
      for (let k = 0; k < N2; k++) {
        const ev = EV[0] + (ei + Math.random()) * EV[1];
        const la = la0 + Math.random() * LA[1];
        const phi = PH[0] + (pi + Math.random()) * PH[1];
        const outs = Math.random() < 0.5 ? 0 : 1;
        const r = batted(ev, la, phi, [null, runnerOf(), null, null], outs, { holdRunner: true, dpDepth: true });
        if (r.type === "DP" || r.type === "TP") c[0]++;
        else if (r.type === "FC") c[1]++;
        else if (r.type === "GO") c[2]++;
      }
      if (c[0] + c[1] + c[2]) dp[cellIdx(ei, li, pi)] = c;
    }
  }
console.log("pass2", ((Date.now() - t0) / 1000).toFixed(1) + "s");

/* ---------- 3) 三塁走者あり: 外野フライの犠飛 ---------- */
const sf = {};
for (let ei = 0; ei < EV[2]; ei++)
  for (let li = 0; li < LA[2]; li++) {
    const la0 = LA[0] + li * LA[1];
    if (la0 < 12) continue;
    for (let pi = 0; pi < PH[2]; pi++) {
      const c = [0, 0];
      for (let k = 0; k < N2; k++) {
        const ev = EV[0] + (ei + Math.random()) * EV[1];
        const la = la0 + Math.random() * LA[1];
        const phi = PH[0] + (pi + Math.random()) * PH[1];
        const outs = Math.random() < 0.5 ? 0 : 1;
        const r = batted(ev, la, phi, [null, null, null, runnerOf()], outs, {});
        if (r.type === "SF") c[0]++;
        if (r.type === "SF" || r.type === "FO") c[1]++;
      }
      if (c[1]) sf[cellIdx(ei, li, pi)] = c;
    }
  }
console.log("pass3", ((Date.now() - t0) / 1000).toFixed(1) + "s");

/* ---------- 4a) ファウルフライ (角度 20 度以上・かすった打球以外) ---------- */
const FFO_LA = [20, 10, 6]; // 20〜80 度
const FFO_PH = [45, 0, 5]; // |方向| 45-55, 55-65, 65-80, 80-100, 100〜
const PH_EDGES = [45, 55, 65, 80, 100, 140];
const ffo = [];
const N4 = Math.max(10, Math.round(60 * SCALE));
for (let li = 0; li < FFO_LA[2]; li++)
  for (let pj = 0; pj < FFO_PH[2]; pj++) {
    let got = 0;
    const by = {};
    for (let k = 0; k < N4; k++) {
      const ev = rnd(18, 50);
      const la = FFO_LA[0] + (li + Math.random()) * FFO_LA[1];
      const ap = rnd(PH_EDGES[pj], PH_EDGES[pj + 1]);
      const phi = Math.random() < 0.5 ? -ap : ap;
      const batter = pick(batters);
      const pit = pick(pitchers);
      const r = runPlay({ kind: "batted", foul: true, ball: P.battedBall({ ev, la, phi, bx: rnd(-0.2, 0.2), bz: rnd(0.55, 1.0) }), defense: pick(defenses), batter, batSide: P.batSide(batter, pit), runners: [null, null, null, null], outs: 0, align: {} });
      if (r.type === "FFO") {
        got++;
        const side = phi < 0 ? "L" : "R";
        const key = side + r.firstTouch;
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
console.log("fouls", ((Date.now() - t0) / 1000).toFixed(1) + "s");

/* ---------- 4b) 送りバント (一塁走者・無死、バントシフト) ---------- */
const BUNT_LA = [-60, 20, 6]; // -60〜60 度
const bunt = [];
{
  const raw = Array.from({ length: BUNT_LA[2] }, () => ({}));
  const NB = Math.max(400, Math.round(3000 * SCALE));
  for (let k = 0; k < NB; k++) {
    const t = pick(teams);
    const pit = pick(pitchers);
    const bat = pick(batters.filter((p) => p.power <= 52));
    const ch = PB.AI.choosePitch(pit, { balls: 0, strikes: 0, outs: 0, inning: 5 });
    const pc = P.make(pit, ch.type, ch.aim, null, { balls: 0, strikes: 0 });
    const sw = PB.AI.buntAim(pc);
    const res = P.swing(pc, sw, bat, pit, { balls: 0, strikes: 0, level: PB.AI.SIM });
    if (res.type !== "inplay") continue;
    const second = Math.random() < 0.15;
    const runners = second ? [null, null, runnerOf(), null] : [null, runnerOf(), null, null];
    const r = runPlay({ kind: "batted", ball: P.battedBall(res), defense: defenseOf(t), batter: bat, batSide: P.batSide(bat, pit), runners, outs: 0, bunt: true, align: { buntShift: true, holdRunner: !second } });
    const li = U.clamp(Math.floor((res.la - BUNT_LA[0]) / BUNT_LA[1]), 0, BUNT_LA[2] - 1);
    const ty = r.type === "TP" ? "DP" : r.type;
    raw[li][ty] = (raw[li][ty] || 0) + 1;
  }
  for (const c of raw) bunt.push(c);
}
console.log("bunts", ((Date.now() - t0) / 1000).toFixed(1) + "s");

/* ---------- 4c) 盗塁 (走力 + 盗塁◯ × 捕手の肩 × クイック) ---------- */
const ST_SPD = [60, 10, 4]; // 60〜100
const ST_ARM = [35, 15, 4]; // 35〜95
const steal = [];
{
  const NS = Math.max(20, Math.round(90 * SCALE));
  for (let from = 1; from <= 2; from++)
    for (let q = 0; q < 2; q++)
      for (let si = 0; si < ST_SPD[2]; si++)
        for (let ai = 0; ai < ST_ARM[2]; ai++) {
          let ok = 0;
          for (let k = 0; k < NS; k++) {
            const t = pick(teams);
            const def = Object.assign({}, defenseOf(t));
            def.C = Object.assign({}, def.C, { arm: ST_ARM[0] + (ai + Math.random()) * ST_ARM[1] });
            const pit = Object.assign({}, def.P, { skills: q ? ["quick"] : [] });
            def.P = pit;
            const run = Object.assign({}, pick(batters), { speed: ST_SPD[0] + (si + Math.random()) * ST_SPD[1], skills: [] });
            const bat = pick(batters);
            const runners = [null, null, null, null];
            runners[from] = run;
            const stealing = { [from]: true };
            const pc = { T: rnd(0.4, 0.52) };
            const lead = Game.prototype.stealLead.call({ bases: runners, pitcher: () => pit }, stealing, pc);
            const play = new PB.Play({ kind: "steal", defense: def, batter: bat, batSide: P.batSide(bat, pit), runners, stealing, stealLead: lead, outs: 0, align: {} });
            play.fmap.C.holdT += 0.25;
            Game.runPlay(play);
            const s = play.result.steals.find((x) => x.from === from);
            if (s && s.ok) ok++;
          }
          steal.push(Math.round((ok / NS) * 1000) / 1000);
        }
}
console.log("steals", ((Date.now() - t0) / 1000).toFixed(1) + "s");

/* ---------- 5) 物理版の試合から走者の進塁率 ---------- */
const adv = {};
{
  const acc = {};
  const rec = (k, spd, ok) => (acc[k] || (acc[k] = [])).push([spd, ok ? 1 : 0]);
  const orig = Game.prototype.applyPlay;
  Game.prototype.applyPlay = function (res) {
    const b = this.bases.slice();
    const o2 = this.outs === 2 ? "2" : "01";
    const t = res.type;
    const where = (p) => {
      if (res.scorers.indexOf(p) >= 0) return 4;
      for (let i = 1; i <= 3; i++) if (res.bases[i] === p) return i;
      return 0;
    };
    const inf = ["P", "C", "1B", "2B", "3B", "SS"].indexOf(res.firstTouch) >= 0;
    if (t === "H1" && !inf) {
      if (b[2]) rec("h1r2_" + o2, b[2].speed, where(b[2]) === 4);
      // 三塁が空くときだけ (前の走者が止まると進めない)
      if (b[1] && (!b[2] || where(b[2]) === 4)) rec("h1r1_" + o2, b[1].speed, where(b[1]) >= 3);
    }
    if (t === "H2" && b[1]) rec("h2r1_" + o2, b[1].speed, where(b[1]) === 4);
    if ((t === "GO" || t === "DP" || t === "FC") && this.outs < 2) {
      if (b[3] && !(b[1] && b[2])) rec("goR3", b[3].speed, where(b[3]) === 4);
      if (b[2] && !b[1] && !b[3]) rec("goR2", b[2].speed, where(b[2]) >= 3);
    }
    if ((t === "FO" || t === "SF") && this.outs < 2) {
      if (b[3]) rec("foR3", b[3].speed, where(b[3]) === 4);
      if (b[2] && !b[3]) rec("foR2", b[2].speed, where(b[2]) === 3);
    }
    if (t === "GO" && b[1] && this.outs < 2) rec("dpSpd", this.batter().speed, false);
    if (t === "DP" && b[1]) rec("dpSpd", this.batter().speed, true);
    return orig.call(this, res);
  };
  const NG = Math.max(20, Math.round(160 * SCALE));
  for (let i = 0; i < NG; i++) {
    const a = teams[i % 12];
    let h = teams[(i * 5 + 1 + Math.floor(i / 12)) % 12];
    if (h === a) h = teams[(i + 1) % 12];
    const g = new Game({ away: U.clone(a), home: U.clone(h), innings: 9 });
    g.simToEnd();
  }
  Game.prototype.applyPlay = orig;
  // 割合と走力の傾き (最小二乗)
  for (const k in acc) {
    const a = acc[k];
    const n = a.length;
    const ms = a.reduce((s, x) => s + x[0], 0) / n;
    const my = a.reduce((s, x) => s + x[1], 0) / n;
    let cov = 0;
    let vs = 0;
    for (const [s, y] of a) {
      cov += (s - ms) * (y - my);
      vs += (s - ms) * (s - ms);
    }
    const slope = vs > 0 ? cov / vs : 0;
    adv[k] = [Math.round(my * 1000) / 1000, Math.round(U.clamp(slope, -0.02, 0.02) * 10000) / 10000, Math.round(ms * 10) / 10, n];
  }
}
console.log("games", ((Date.now() - t0) / 1000).toFixed(1) + "s");

const table = {
  v: 1,
  ev: EV,
  la: LA,
  ph: PH,
  cells,
  dp,
  sf,
  ffo: { la: FFO_LA, ph: PH_EDGES, c: ffo },
  bunt: { la: BUNT_LA, c: bunt },
  steal: { spd: ST_SPD, arm: ST_ARM, c: steal },
  adv,
  avg: Object.assign(avg, { speed: batSpd }),
};
const src =
  "/* 熱闘！ポケットベースボール — 高速シミュレーションの打球結果の表\n" +
  " * tools/build_bip_table.js が物理版の守備 (play.js) を回して作ったデータ。手で直さない。\n" +
  " * cells[(初速 × 角度 × 方向の区分)] = 「結果の記号 + 野手の番号 + 回数」の並び\n" +
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
