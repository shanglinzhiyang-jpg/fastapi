/* 熱闘！ポケットベースボール — CPU の投球・打撃・采配 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const P = PB.P;
  const AI = {};

  // 難易度ごとの補正
  AI.LEVELS = {
    easy: { name: "やさしい", cpuSigma: 1.5, cpuCtl: -16, cursorMul: 1.38, windowMul: 1.3, slow: 0.78, cpuPower: -8 },
    normal: { name: "ふつう", cpuSigma: 1.18, cpuCtl: -6, cursorMul: 1.15, windowMul: 1.12, slow: 0.88, cpuPower: -3 },
    hard: { name: "つよい", cpuSigma: 1.0, cpuCtl: 0, cursorMul: 1.0, windowMul: 1.0, slow: 1.0, cpuPower: 0 },
    oni: { name: "鬼", cpuSigma: 0.86, cpuCtl: 8, cursorMul: 0.92, windowMul: 0.93, slow: 1.0, cpuPower: 4 },
  };
  AI.SIM = { name: "シミュレーション", cpuSigma: 1.0, cpuCtl: 0, cursorMul: 1.0, windowMul: 1.0, slow: 1.0, cpuPower: 0 };

  /* ---------- 配球 ---------- */
  AI.choosePitch = function (pitcher, ctx) {
    const ars = P.arsenal(pitcher);
    const b = ctx.balls;
    const s = ctx.strikes;
    const behind = (b === 3 && s < 2) || (b >= 2 && s === 0);
    const weights = ars.map((p) => {
      if (p.t === "FB") return behind ? 2.4 : s === 2 ? 0.8 : 1.25;
      let w = 0.3 + p.lv * 0.12;
      if (s === 2) w *= 1.7;
      if (behind) w *= 0.45;
      return w;
    });
    let tot = weights.reduce((a, c) => a + c, 0);
    let r = Math.random() * tot;
    let pick = ars[0];
    for (let i = 0; i < ars.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = ars[i];
        break;
      }
    }
    const type = pick.t;
    const vertical = ["FK", "SF", "CH", "SK", "CB", "SC", "VS"].indexOf(type) >= 0;
    // コース
    let mode;
    const rr = Math.random();
    if (behind) mode = rr < 0.6 ? "in" : "edge";
    else if (s === 2 && b < 3) mode = rr < 0.5 ? "chase" : rr < 0.88 ? "edge" : "in";
    else mode = rr < 0.55 ? "edge" : rr < 0.8 ? "in" : "chase";
    let x;
    let z;
    const side = U.pick([-1, 1]);
    if (mode === "in") {
      x = U.rand(-0.13, 0.13);
      z = U.rand(0.6, 0.95);
    } else if (mode === "edge") {
      x = side * U.rand(0.16, 0.28);
      z = Math.random() < 0.6 ? U.rand(0.44, 0.64) : U.rand(0.9, 1.06);
    } else {
      if (vertical || Math.random() < 0.4) {
        x = U.rand(-0.18, 0.18);
        z = U.rand(0.3, 0.44);
      } else {
        x = side * U.rand(0.28, 0.36);
        z = U.rand(0.5, 0.9);
      }
    }
    if (vertical && mode !== "chase") z -= 0.1;
    return { type, aim: { x, z } };
  };

  /* ---------- CPU 打者 ---------- */
  AI.decideSwing = function (pc, batter, pitcher, ctx) {
    const lv = ctx.level || AI.SIM;
    const cs = P.cursor(batter, pitcher, ctx);
    const breakMag = Math.hypot(pc.B[0], pc.B[1]);
    let sig = 0.028 + (100 - batter.meet) * 0.0006 + breakMag * 0.34 * (pc.pow / 2.3) + Math.max(0, pc.speedKmh - 130) * 0.0012;
    if (pc.knuckle) sig += 0.03;
    sig *= lv.cpuSigma;
    const px = pc.A[0] + U.gauss() * sig;
    const pz = pc.A[1] + U.gauss() * sig;
    const Z = P.ZONE;
    const ox = Math.max(0, Math.abs(px) - Z.hw);
    const oz = Math.max(0, Z.lo - pz, pz - Z.hi);
    const out = Math.hypot(ox, oz);
    const looks = out < 0.02;
    let p = looks ? 0.68 : 0.3 * Math.max(0, 1 - out / 0.2);
    if (ctx.strikes === 2) p = looks ? 0.9 : p + 0.12;
    if (ctx.balls === 3 && ctx.strikes < 2) p = looks ? 0.6 : p * 0.4;
    if (ctx.balls === 3 && ctx.strikes === 0) p *= 0.35;
    if (!looks && D.has(batter, "eye")) p *= 0.55;
    if (ctx.hitAndRun) p = Math.max(p, looks ? 0.95 : 0.7);
    if (Math.random() >= p) return { swing: false };
    let lift = (batter.power > 70 ? 0.08 : 0) + (D.has(batter, "powerHitter") ? 0.06 : 0);
    if (ctx.outs < 2 && ctx.runner3) lift += 0.1; // 犠牲フライ狙い
    const cz = pz - cs.rz * lift + U.gauss() * cs.rz * 0.35;
    const cx = px + U.gauss() * 0.015;
    const fb = pitcher.velo;
    const guessFB = Math.random() < (ctx.strikes === 2 ? 0.45 : 0.6);
    let bias = 0;
    const ratio = pc.speedKmh / fb;
    if (guessFB) bias = -(1 - ratio) * 0.22;
    else bias = pc.type === "FB" ? 0.022 : 0;
    if (pc.type === "FB" && D.has(pitcher, "nobi")) bias += 0.01;
    let st = 0.02 + (100 - batter.meet) * 0.00028;
    if (D.has(pitcher, "hold")) st += 0.006;
    st *= lv.cpuSigma;
    const e = bias + U.gauss() * st;
    return { swing: true, cx, cz, t: P.idealTime(pc) - P.SWING_LAG + e };
  };

  // バント時のカーソル
  AI.buntAim = function (pc) {
    return { swing: true, bunt: true, cx: pc.A[0] + U.gauss() * 0.03, cz: pc.A[1] + U.gauss() * 0.03, t: 0 };
  };

  /* ---------- 作戦 ---------- */
  AI.wantBunt = function (g) {
    const b = g.bases;
    if (g.outs !== 0 || !(b[1] || b[2]) || b[3]) return false;
    const bat = g.batter();
    if (bat.power > 52) return false;
    const diff = Math.abs(g.score.home - g.score.away);
    if (diff > 2) return false;
    const late = g.inning >= Math.max(5, g.innings - 3);
    return Math.random() < (late ? 0.6 : 0.25);
  };

  AI.wantSteal = function (g) {
    const b = g.bases;
    if (g.outs >= 2) return null;
    if (g.balls === 3 && g.strikes === 2) return null;
    if (b[1] && !b[2]) {
      const r = b[1];
      const s = r.speed + (D.has(r, "steal") ? 12 : 0);
      if (s < 66) return null;
      if (Math.random() < 0.08 + (s - 66) * 0.005) return { 1: true };
    }
    if (b[2] && !b[3] && !b[1]) {
      const r = b[2];
      const s = r.speed + (D.has(r, "steal") ? 12 : 0);
      if (s >= 80 && Math.random() < 0.04) return { 2: true };
    }
    return null;
  };

  /* ---------- 継投 ---------- */
  AI.pitchingChange = function (g, side) {
    const st = g.pstate[side];
    const ratio = st.stamina / st.max;
    const team = g.teams[side];
    const lead = side === "home" ? g.score.home - g.score.away : g.score.away - g.score.home;
    const finalInn = g.inning >= g.innings;
    const cur = g.pitcher(side);
    // 抑え
    if (finalInn && lead >= 1 && lead <= 3 && g.outs === 0 && g.balls === 0 && g.strikes === 0 && !g.bases[1] && !g.bases[2] && !g.bases[3]) {
      const cl = team.closer && team.closer !== cur.id && g.used[side].indexOf(team.closer) < 0 && !g.isTired(team.closer) ? team.closer : null;
      if (cl) return cl;
    }
    let need = ratio < 0.18 || (st.runs >= 6 && g.inning >= 3) || (st.runs >= 4 && ratio < 0.45);
    if (!need) return null;
    const avail = team.bullpen.filter((id) => g.used[side].indexOf(id) < 0 && id !== team.closer && !g.isTired(id));
    if (!avail.length) {
      if (team.closer && g.used[side].indexOf(team.closer) < 0 && ratio < 0.1) return team.closer;
      return null;
    }
    return avail[0];
  };

  PB.AI = AI;
})((window.PB = window.PB || {}));
