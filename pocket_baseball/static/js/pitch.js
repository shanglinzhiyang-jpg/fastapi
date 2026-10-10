/* 熱闘！ポケットベースボール — 投球の軌道とミートカーソルによる打撃判定 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const P = {};

  // ストライクゾーン (ボール半径込み)
  P.ZONE = { hw: 0.253, lo: 0.46, hi: 1.06, cz: 0.76 };
  P.isStrike = (x, z) => Math.abs(x) <= P.ZONE.hw && z >= P.ZONE.lo && z <= P.ZONE.hi;
  P.RELEASE_Y = 17.4;
  P.SWING_LAG = 0.12; // ボタンを押してからバットがミートポイントに来るまで
  P.armSide = (throws) => (throws === "R" ? -1 : 1);

  // 両打ちは投手と逆の打席
  P.batSide = (batter, pitcher) => (batter.bats === "S" ? (pitcher.throws === "R" ? "L" : "R") : batter.bats);

  /* 疲労・特殊能力・状況を反映した投手能力 */
  P.effective = function (pitcher, st, ctx) {
    const ratio = st ? U.clamp(st.stamina / st.max, 0, 1) : 1;
    let velo = pitcher.velo - (1 - ratio) * 5 - (ratio < 0.15 ? 3 : 0);
    let control = pitcher.control - (1 - ratio) * 22 - (ratio < 0.2 ? 10 : 0);
    if (ctx) {
      if (ctx.risp && D.has(pitcher, "pinch")) {
        control += 12;
        velo += 2;
      }
      if (ctx.runnersOn && !D.has(pitcher, "tough")) control -= 4;
      if (ctx.inning >= 7 && D.has(pitcher, "lateGood")) {
        control += 8;
        velo += 1;
      }
      if (ctx.catcherSkill) control += 5;
      if (ctx.strikes === 2 && D.has(pitcher, "k")) velo += 2;
      if (ctx.controlBonus) control += ctx.controlBonus;
    }
    return { velo, control: U.clamp(control, 1, 110), ratio };
  };

  P.arsenal = function (pitcher) {
    return [{ t: "FB", lv: 0 }].concat(pitcher.pitches || []);
  };

  /* 投球を生成する
   * aim: 狙い {x,z} (ホームベース上) */
  P.make = function (pitcher, type, aim, st, ctx) {
    const def = D.PITCHES[type] || D.PITCHES.FB;
    const entry = (pitcher.pitches || []).find((p) => p.t === type);
    const lv = type === "FB" ? 0 : entry ? entry.lv : 1;
    const eff = P.effective(pitcher, st, ctx);
    const speedKmh = Math.round(eff.velo * def.spd(lv) + U.gauss() * 1.2);
    const vms = speedKmh / 3.6;
    const T = P.RELEASE_Y / (vms * 0.92);
    const arm = P.armSide(pitcher.throws);
    const R = [arm * 0.52, P.RELEASE_Y, 1.8];
    const bm = ctx && ctx.strikes === 2 && D.has(pitcher, "k") ? 1.15 : 1;
    let bx = def.bx(lv) * bm * -arm;
    let bz = def.bz(lv) * bm;
    let phase = 0;
    if (def.knuckle) {
      bx = U.rand(-0.16, 0.16);
      bz += U.rand(-0.07, 0.04);
      phase = U.rand(0, 6.28);
    }
    let sigma = 0.026 + (100 - eff.control) * 0.0014;
    if (type !== "FB") sigma *= 1 + 0.035 * lv;
    let ex = U.gauss() * sigma;
    let ez = U.gauss() * sigma * 0.9;
    if (D.has(pitcher, "low") && aim.z < 0.66) ez *= 0.65;
    if (ctx && ctx.noError) ex = ez = 0;
    const A = [aim.x + ex, aim.z + ez];
    let pow = def.pow;
    if (type !== "FB" && D.has(pitcher, "kire")) pow += 0.6;
    let g = def.g;
    if (type === "FB" && D.has(pitcher, "nobi")) g -= 0.12;
    return {
      type,
      name: def.name,
      lv,
      speedKmh,
      T,
      R,
      A,
      B: [bx, bz],
      g,
      pow,
      knuckle: !!def.knuckle,
      phase,
      throws: pitcher.throws,
      strike: P.isStrike(A[0], A[1]),
      aim: { x: aim.x, z: aim.z },
    };
  };

  /* 投球のリリースからの経過時間 t における位置 [x,y,z] */
  P.pos = function (pc, t) {
    const u = t / pc.T;
    const R = pc.R;
    const Ax = pc.A[0] - pc.B[0];
    const Az = pc.A[1] - pc.B[1];
    let x = R[0] + (Ax - R[0]) * u;
    const y = R[1] * (1 - u);
    let z = R[2] + (Az - R[2]) * u;
    z += 0.5 * 9.8 * pc.g * pc.T * pc.T * u * (1 - u);
    let f;
    if (u <= 0) f = 0;
    else if (u <= 1) f = Math.pow(u, pc.pow);
    else f = 1 + pc.pow * (u - 1);
    x += pc.B[0] * f;
    z += pc.B[1] * f;
    if (pc.knuckle) {
      x += 0.03 * Math.sin(u * 11 + pc.phase) * u;
      z += 0.022 * Math.cos(u * 8 + pc.phase) * u;
    }
    return [x, y, z];
  };

  // 理想のミート時刻 (ボールがベース前方 0.3m の時)
  P.idealTime = (pc) => pc.T - 0.3 / (pc.speedKmh / 3.6);

  /* ミートカーソルの大きさ (m) */
  P.cursor = function (batter, pitcher, ctx) {
    let rx = 0.07 + batter.meet * 0.0011;
    const side = P.batSide(batter, pitcher);
    if (ctx) {
      if (ctx.risp && D.has(batter, "chance")) rx *= 1.12;
      if (ctx.risp && D.has(batter, "chanceX")) rx *= 0.9;
      if (ctx.balls === 0 && ctx.strikes === 0 && D.has(batter, "firstPitch")) rx *= 1.1;
      if (ctx.cursorMul) rx *= ctx.cursorMul;
    }
    if (pitcher.throws === "L" && D.has(batter, "vsLeft")) rx *= 1.1;
    if (side === "L" && D.has(pitcher, "vsLeftP")) rx *= 0.92;
    return { rx, rz: rx * 0.72 };
  };

  P.window = (ctx) => 0.085 * ((ctx && ctx.windowMul) || 1);

  /* スイング判定
   * sw = {cx, cz, t(リリースからの押下時刻), bunt}
   * 返り値 type: whiff | foul | inplay | (bunt時) buntmiss */
  P.swing = function (pc, sw, batter, pitcher, ctx) {
    if (sw.bunt) return P.bunt(pc, sw, batter, pitcher, ctx);
    const tc = sw.t + P.SWING_LAG;
    const e = tc - P.idealTime(pc);
    const W = P.window(ctx);
    const res = { e, W };
    if (e < -W * 1.5 || e > W * 1.4) {
      res.type = "whiff";
      res.reason = e < 0 ? "early" : "late";
      return res;
    }
    // 当たり判定は「打つべき地点」(ベース手前 0.3m) を通過する位置で行う
    const bp = P.pos(pc, P.idealTime(pc));
    const bx = bp[0];
    const bz = bp[2];
    const cs = P.cursor(batter, pitcher, ctx);
    const nx = (bx - sw.cx) / (cs.rx + 0.03);
    const nz = (bz - sw.cz) / (cs.rz + 0.03);
    const d2 = nx * nx + nz * nz;
    res.bx = bx;
    res.bz = bz;
    res.d2 = d2;
    if (d2 > 1.75) {
      res.type = "whiff";
      res.reason = "miss";
      return res;
    }
    if (d2 > 1.0 || Math.abs(e) > W) {
      res.type = "foul";
      res.tip = true;
      res.ev = U.rand(12, 25);
      res.la = U.rand(-20, 60);
      res.phi = U.pick([-1, 1]) * U.rand(50, 120);
      return res;
    }
    const q = 1 - (D.has(batter, "avgHitter") ? 0.42 : 0.55) * Math.pow(d2, 0.75);
    const tq = 1 - 0.55 * (e / W) * (e / W);
    let power = batter.power;
    if (ctx && ctx.clutchSpot && D.has(batter, "clutch")) power += 10;
    if (ctx && ctx.powerBonus) power += ctx.powerBonus;
    const maxEV = 38 + power * 0.16;
    let ev = maxEV * (0.5 + 0.5 * q * tq) + (pc.speedKmh - 135) * 0.025 + U.gauss() * 0.8;
    if (D.has(pitcher, "heavy")) ev *= 0.95;
    const rel = U.clamp((bz - sw.cz) / cs.rz, -1.4, 1.4);
    let la = 3 + 32 * rel + (batter.traj - 2) * 4 + U.gauss() * 6;
    if (D.has(batter, "powerHitter")) la += (27 - la) * 0.2 + 1;
    const side = P.batSide(batter, pitcher);
    const inside = side === "R" ? -bx : bx; // 内角ほど正
    let pull = (-e / W) * 36 + (inside / 0.25) * 9 + U.gauss() * 8;
    if (pull < -10 && !D.has(batter, "spray")) ev *= 0.94;
    const phi = side === "R" ? -pull : pull;
    res.q = q * tq;
    res.ev = Math.max(5, ev);
    res.la = la;
    res.phi = phi;
    res.type = Math.abs(phi) > 45 ? "foul" : "inplay";
    return res;
  };

  P.bunt = function (pc, sw, batter, pitcher, ctx) {
    const bp = P.pos(pc, pc.T);
    const bx = bp[0];
    const bz = bp[2];
    const cs = P.cursor(batter, pitcher, ctx);
    const rx = cs.rx * 1.3;
    const rz = cs.rz * 1.3;
    const nx = (bx - sw.cx) / (rx + 0.03);
    const nz = (bz - sw.cz) / (rz + 0.03);
    const d2 = nx * nx + nz * nz;
    const res = { bunt: true, d2, bx, bz, e: 0 };
    if (d2 > 1.15) {
      res.type = "buntmiss";
      // バットに近い球は空振り扱い、離れた球はバットを引いたことにする
      res.strikeCall = pc.strike || d2 < 2.2;
      return res;
    }
    const rel = U.clamp((bz - sw.cz) / rz, -1.3, 1.3);
    res.la = -8 + 30 * rel + U.gauss() * 6;
    res.ev = 4.5 + 6 * Math.pow(d2, 0.7) + Math.random() * 3 + (rel > 0.6 ? 5 : 0);
    res.phi = U.gauss() * 16 + ((bx - sw.cx) / rx) * 14;
    res.q = 1 - d2;
    res.type = Math.abs(res.phi) > 45 ? "foul" : "inplay";
    return res;
  };

  /* 打球の初期状態 */
  P.battedBall = function (res) {
    const la = U.rad(res.la);
    const phi = U.rad(res.phi);
    const v = res.ev;
    return {
      p: [res.bx || 0, 0.5, res.bz || 0.8],
      v: [v * Math.cos(la) * Math.sin(phi), v * Math.cos(la) * Math.cos(phi), v * Math.sin(la)],
    };
  };

  // デッドボール判定 (打者の体の位置)
  P.hitByPitch = function (pc, side) {
    const x = pc.A[0];
    const z = pc.A[1];
    const body = side === "R" ? x < -0.47 && x > -1.0 : x > 0.47 && x < 1.0;
    return body && z > 0.25 && z < 1.7;
  };

  PB.P = P;
})((window.PB = window.PB || {}));
