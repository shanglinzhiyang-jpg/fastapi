/* 熱闘！ポケットベースボール — インプレーのシミュレーション
 * 打球・野手・走者を固定ステップで動かし、フォースアウト/タッチアウト/得点を判定する。
 * 描画とは独立しており、CPU同士の試合はこのクラスを高速に回して決着させる。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const F = PB.F;
  const D = PB.D;
  const BD = F.BASE_DIST;

  const HOME_POS = {
    P: [0, 17.0],
    C: [0, -1.1],
    "1B": [19.5, 25.5],
    "2B": [9.5, 42.5],
    SS: [-10.5, 42.0],
    "3B": [-19.5, 25.0],
    LF: [-42, 80],
    CF: [0, 95],
    RF: [42, 80],
  };
  const OF = { LF: 1, CF: 1, RF: 1 };

  function makeFielder(pos, p, opts) {
    let h = HOME_POS[pos].slice();
    if (opts.holdRunner && pos === "1B") h = [17.6, 21.0];
    if (opts.dpDepth && pos === "2B") h = [8.2, 39.5];
    if (opts.dpDepth && pos === "SS") h = [-9.2, 39.5];
    if (opts.buntShift && pos === "1B") h = [14.5, 15.5];
    if (opts.buntShift && pos === "3B") h = [-15, 16];
    if (opts.infieldIn && (pos === "2B" || pos === "SS")) h = [pos === "2B" ? 7.5 : -7.5, 33];
    if (opts.infieldIn && (pos === "1B" || pos === "3B")) h = [pos === "1B" ? 17.5 : -17.5, 22];
    if (opts.shade && OF[pos]) h[0] += opts.shade;
    return {
      pos,
      p,
      x: h[0],
      y: h[1],
      hx: h[0],
      hy: h[1],
      speed: 5.3 + p.speed * 0.02 + p.field * 0.006,
      react: OF[pos] ? 0.5 - p.field * 0.0015 : 0.32 - p.field * 0.0012,
      throwV: 24 + p.arm * 0.17 + (D.has(p, "laser") ? 3.5 : 0) + (pos === "C" ? 2 : 0),
      transfer: 0.6 - p.field * 0.0026,
      task: "idle",
      tx: h[0],
      ty: h[1],
      base: null,
      hasBall: false,
      wait: 0,
      holdT: 0,
      down: 0,
      vx: 0,
      vy: 0,
      act: null, // 描画用アクション {k:'throw'|'catch'|'dive', t}
      onBase: null,
    };
  }

  class Play {
    /* opts:
     *  kind: 'batted' | 'steal'
     *  ball: {p:[x,y,z], v:[vx,vy,vz]}  (batted)
     *  defense: {P:player, C:player, ...}
     *  batter: player, batSide: 'R'|'L'
     *  runners: [null, p1, p2, p3]  走者 (塁上)
     *  stealing: {1:true,...} スタートを切っている走者
     *  outs, foul(ファウルフライ判定のみ), bunt, align(守備位置オプション) */
    constructor(opts) {
      this.o = opts;
      this.kind = opts.kind;
      this.t = 0;
      this.outs0 = opts.outs;
      this.outs = opts.outs;
      this.events = [];
      this.outList = [];
      this.scored = [];
      this.throws = 0;
      this.error = null;
      this.firstTouch = null;
      this.hr = false;
      this.done = false;
      this.result = null;
      this.foulMode = !!opts.foul;
      this.flyCaught = false;
      this.reTimer = 0;
      // 野手
      this.fielders = [];
      this.fmap = {};
      for (const pos of D.FIELD_POS) {
        const f = makeFielder(pos, opts.defense[pos], opts.align || {});
        this.fielders.push(f);
        this.fmap[pos] = f;
      }
      // 走者
      this.runners = [];
      const occ = [true, !!opts.runners[1], !!opts.runners[2], !!opts.runners[3]];
      const forced = [true, false, false, false];
      for (let b = 1; b <= 3; b++) forced[b] = occ[b] && forced[b - 1];
      if (this.kind === "batted" && !this.foulMode) {
        this.runners.push(this.makeRunner(opts.batter, 0, forced[0], true));
      }
      for (let b = 1; b <= 3; b++) {
        if (!opts.runners[b]) continue;
        const r = this.makeRunner(opts.runners[b], b, this.kind === "batted" && forced[b], false);
        if (opts.stealing && opts.stealing[b]) {
          r.state = "run";
          r.d = opts.stealLead != null ? opts.stealLead : 3.5;
          r.stealing = true;
        }
        this.runners.push(r);
      }
      if (this.kind === "batted") this.startBatted();
      else this.startSteal();
    }

    makeRunner(p, base, forced, isBatter) {
      const spd = 6.4 + p.speed * 0.026 + (D.has(p, "baserun") ? 0.2 : 0);
      return {
        p,
        isBatter,
        orig: base,
        from: base,
        d: 0,
        state: "stop",
        forcedTo: forced ? base + 1 : null,
        returnTo: null,
        speed: spd,
        wait: 0,
        tagWait: false,
        jitter: U.gauss() * 0.12,
        x: F.BASES[base][0],
        y: F.BASES[base][1],
        outHow: null,
        scoredAt: null,
      };
    }

    ev(type, data) {
      this.events.push(Object.assign({ t: this.t, type }, data || {}));
    }

    /* ---------- 開始 ---------- */
    startBatted() {
      const o = this.o;
      const b = F.newBall(o.ball.p, o.ball.v);
      this.launch = { ev: Math.hypot(o.ball.v[0], o.ball.v[1], o.ball.v[2]), la: U.deg(Math.atan2(o.ball.v[2], Math.hypot(o.ball.v[0], o.ball.v[1]))), phi: U.deg(Math.atan2(o.ball.v[0], o.ball.v[1])) };
      this.setLive(b);
      // 投手はフォロースルー
      this.fmap.P.wait = 0.45;
      for (const f of this.fielders) if (f.pos !== "P") f.wait = f.react;
      this.assign();
      if (this.foulMode) return;
      if (!this.chaser && this.pred.info.hr) {
        this.hr = true;
        this.ev("hr", {});
        this.runners.forEach((r) => {
          r.state = "run";
          r.speed = 6.2;
          r.forcedTo = null;
          r.wait = r.isBatter ? 0.7 : 0.3;
        });
        return;
      }
      const flyCatch = this.icpt && this.icpt.air;
      for (const r of this.runners) {
        if (r.isBatter) {
          r.state = "run";
          r.wait = 0.5 - r.p.speed * 0.0012 - (D.has(r.p, "infieldHit") ? 0.08 : 0) - (this.o.batSide === "L" ? 0.07 : 0) + (this.o.bunt ? -0.1 : 0);
          continue;
        }
        if (r.state === "run") continue; // 盗塁中 (エンドラン)
        // リードの分だけ先に進んだ状態でスタートする
        const lead = [0, 3.6, 4.2, 3.2][r.from] + (this.o.bunt ? 0.8 : 0);
        if (this.outs === 2) {
          r.state = "run";
          r.wait = 0.1;
          r.d = lead;
          continue;
        }
        if (flyCatch) {
          r.tagWait = true;
          continue;
        }
        if (r.forcedTo) {
          r.state = "run";
          r.wait = 0.2;
          r.d = lead;
          continue;
        }
        if (this.decideAdvance(r)) {
          r.state = "run";
          r.wait = 0.2;
          r.d = lead;
        }
      }
    }

    startSteal() {
      const c = this.fmap.C;
      c.hasBall = true;
      c.holdT = c.transfer * 0.9;
      this.ball = { mode: "held", holder: c, x: c.x, y: c.y, z: 1.0 };
      // ベースカバー
      const left = this.o.batSide === "L";
      const cov2 = left ? this.fmap.SS : this.fmap["2B"];
      cov2.task = "cover";
      cov2.base = 2;
      this.fmap["3B"].task = "cover";
      this.fmap["3B"].base = 3;
      this.fmap["1B"].task = "cover";
      this.fmap["1B"].base = 1;
      this.fmap.C.task = "hold";
      this.ev("steal", {});
    }

    setLive(ballState) {
      this.ballState = ballState;
      this.pred = F.predict(ballState, this.t, 14);
      this.ball = { mode: "live", x: ballState.x, y: ballState.y, z: ballState.z };
      this.wasAir = this.pred.samples[0].air;
    }

    /* ---------- 野手の割り当て ---------- */
    intercept(f, pred) {
      const s = pred.samples;
      const wait = Math.max(0, f.wait);
      const start = Math.max(0, Math.floor((this.t - s[0].t) / F.PRED_DT));
      for (let i = start; i < s.length; i++) {
        const q = s[i];
        if (q.hr) return null;
        const maxZ = q.air ? 2.7 : 1.1;
        if (q.z > maxZ) continue;
        if (q.air && this.foulMode === false && q.z > 2.3 && Math.hypot(q.x, q.y) < 10) continue;
        const avail = q.t - this.t - wait;
        if (avail < 0) continue;
        const d = Math.hypot(q.x - f.x, q.y - f.y);
        // 加速の遅れ (動き出し 0.25 秒ぶん)
        const run = f.speed * Math.max(0, avail - (d > 2 ? 0.25 : 0));
        // 反応する時間が無い打球は体の正面でしか捕れない
        const reach = Math.min(0.9, 0.3 + avail * 2.5);
        if (d - reach <= run) return { t: q.t, x: q.x, y: q.y, air: q.air, dive: false };
        if (avail > 0.35 && q.z < 1.9 && d - 2.0 <= run && avail < 2.2) return { t: q.t, x: q.x, y: q.y, air: q.air, dive: true };
      }
      if (pred.info.dead) return null;
      // 止まった/最後の位置まで取りに行く
      const last = s[s.length - 1];
      const d = Math.hypot(last.x - f.x, last.y - f.y);
      const t = this.t + wait + Math.max(0, d - 0.9) / f.speed;
      return { t: Math.max(t, last.t), x: last.x, y: last.y, air: false, dive: false };
    }

    assign() {
      let best = null;
      for (const f of this.fielders) {
        if (f.down > this.t) continue;
        const ic = this.intercept(f, this.pred);
        if (!ic) continue;
        // 外野手は内野ゴロを追わない / 捕手は前方の小フライとバント以外追わない
        if (f.pos === "C" && Math.hypot(ic.x, ic.y) > 22) continue;
        const pen = ic.dive ? 0.25 : 0;
        if (!best || ic.t + pen < best.t + best.pen - 1e-6) best = Object.assign({ f, pen }, ic);
      }
      for (const f of this.fielders) if (f.task === "chase") f.task = "idle";
      if (!best) {
        this.chaser = null;
        this.icpt = null;
        this.assignCovers(null);
        return;
      }
      this.chaser = best.f;
      this.icpt = best;
      best.f.task = "chase";
      best.f.tx = best.x;
      best.f.ty = best.y;
      this.assignCovers(best);
    }

    assignCovers(ic) {
      const ch = this.chaser ? this.chaser.pos : null;
      const fm = this.fmap;
      const set = (pos, base) => {
        const f = fm[pos];
        if (!f || f === this.chaser || f.hasBall) return;
        f.task = "cover";
        f.base = base;
      };
      const left = ic ? ic.x < 0 : true;
      let c2 = left ? "2B" : "SS";
      if (c2 === ch) c2 = c2 === "2B" ? "SS" : "2B";
      let c3 = ch === "3B" ? (c2 === "SS" ? "P" : "SS") : "3B";
      let c1 = ch === "1B" ? "P" : "1B";
      if (ch === "P" && c1 === "P") c1 = "2B";
      let ch4 = ch === "C" ? "P" : "C";
      if (c3 === "P" && c1 === "P") c3 = "SS";
      set(c1, 1);
      set(c2, 2);
      set(c3, 3);
      set(ch4, 4);
      // バックアップ
      for (const f of this.fielders) {
        if (f === this.chaser || f.task === "cover" || f.hasBall) continue;
        if (ic && OF[f.pos]) {
          f.task = "backup";
          f.tx = U.lerp(f.hx, ic.x, 0.55);
          f.ty = U.lerp(f.hy, ic.y, 0.55);
        } else if (ic && !OF[f.pos] && Math.hypot(ic.x, ic.y) > 50) {
          // 中継
          f.task = "backup";
          f.tx = ic.x * 0.45;
          f.ty = ic.y * 0.5;
        } else {
          f.task = "idle";
        }
      }
    }

    coverFor(base, exclude) {
      let best = null;
      let bd = 1e9;
      const [bx, by] = F.BASES[base];
      for (const f of this.fielders) {
        if (f === exclude) continue;
        let d = Math.hypot(f.x - bx, f.y - by);
        if (f.task === "cover" && f.base === base) d -= 30;
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      return best;
    }

    /* ---------- 送球 ---------- */
    effV(f, d) {
      return f.throwV * (d > 45 ? Math.max(0.72, 1 - (d - 45) / 250) : 1);
    }

    throwTo(f, base, recv) {
      const [bx, by] = F.BASES[base];
      const d = Math.hypot(bx - f.x, by - f.y);
      const T = d / this.effV(f, d) + (d > 60 ? 0.12 : 0);
      let pErr = 0.002 + (100 - f.p.field) * 0.00006 + (d > 50 ? 0.004 : 0);
      if (D.has(f.p, "throwAcc")) pErr *= 0.3;
      const wild = Math.random() < pErr;
      this.ball = { mode: "thrown", fx: f.x, fy: f.y, tx: bx, ty: by, t0: this.t, T, base, recv, wild, by: f, x: f.x, y: f.y, z: 1.6, d };
      f.hasBall = false;
      f.act = { k: "throw", t: this.t };
      f.task = "idle";
      if (recv) {
        recv.task = "cover";
        recv.base = base;
      }
      this.throws++;
      this.ev("throw", { from: f.pos, base, recv: recv ? recv.pos : null });
    }

    /* ---------- 捕球 ---------- */
    tryCatch(f) {
      const s = F.sampleAt(this.pred, this.t);
      const d = Math.hypot(s.x - f.x, s.y - f.y);
      if (d > 3.0) {
        this.assign();
        return;
      }
      const dive = this.icpt && this.icpt.dive && d > 1.1;
      const air = s.air;
      let p;
      if (air) p = dive ? 0.32 + f.p.field * 0.0035 : 0.993 - (100 - f.p.catch) * 0.00012;
      else p = dive ? 0.45 + f.p.field * 0.003 : 0.988 - (100 - f.p.catch) * 0.00014;
      if (dive) f.act = { k: "dive", t: this.t };
      if (Math.random() < p) {
        this.gainBall(f, air);
        if (dive) f.holdT += 0.55;
        return;
      }
      if (dive) {
        // ダイビングしたが届かず — ボールはそのまま抜ける
        this.ev("divemiss", { pos: f.pos });
        f.down = this.t + 1.0;
        f.task = "idle";
        this.assign();
        return;
      }
      // エラー (弾く/落とす)
      this.error = this.error || { pos: f.pos, kind: air ? "drop" : "fumble" };
      this.ev("error", { pos: f.pos, kind: air ? "drop" : "fumble" });
      if (!this.firstTouch) this.firstTouch = f.pos;
      const ang = U.rand(0, Math.PI * 2);
      const sp = U.rand(1.5, 4.5);
      const b = F.newBall([f.x, f.y, 0.3], [Math.cos(ang) * sp, Math.sin(ang) * sp, 0.5]);
      this.setLive(b);
      f.down = this.t + 0.5;
      // 捕れなかったフライ → 待機していた走者は走り出す
      this.releaseTagWaiters();
      this.assign();
    }

    gainBall(f, air) {
      f.hasBall = true;
      f.task = "hold";
      f.holdT = f.transfer;
      f.act = { k: "catch", t: this.t };
      this.ball = { mode: "held", holder: f, x: f.x, y: f.y, z: 1.0 };
      if (!this.firstTouch) {
        this.firstTouch = f.pos;
        this.firstAir = air;
        this.firstAt = [f.x, f.y];
      }
      for (const g of this.fielders) if (g.task === "chase") g.task = "idle";
      if (air && !this.flyCaught && !this.foulMode && this.kind === "batted") {
        this.flyCaught = true;
        this.onFlyOut(f);
      } else if (air && this.foulMode) {
        this.flyCaught = true;
        this.outs++;
        this.outList.push({ p: this.o.batter, how: "fly", base: 0 });
        this.ev("out", { how: "foulfly", pos: f.pos });
      } else {
        this.ev("field", { pos: f.pos });
      }
      this.checkBase(f);
      this.decide(f, true);
    }

    onFlyOut(f) {
      const batter = this.runners.find((r) => r.isBatter);
      this.ev("catch", { pos: f.pos });
      if (batter) this.retire(batter, "fly", 0);
      for (const r of this.runners) {
        if (r.isBatter || r.state === "out" || r.state === "scored") continue;
        r.forcedTo = null;
        r.tagWait = false;
        if (r.from > r.orig || r.d > 0) {
          r.state = "return";
          r.returnTo = r.orig;
        } else {
          r.state = "stop";
          // タッチアップ
          if (this.outs < 3 && this.decideAdvance(r, true)) {
            r.state = "run";
            r.wait = 0.05;
            r.tagUp = true;
            this.ev("tagup", { base: r.from });
          }
        }
      }
    }

    releaseTagWaiters() {
      for (const r of this.runners) {
        if (r.tagWait) {
          r.tagWait = false;
          if (r.forcedTo || this.decideAdvance(r)) {
            r.state = "run";
            r.wait = 0.15;
          }
        }
      }
    }

    /* ---------- アウト・塁判定 ---------- */
    retire(r, how, base) {
      if (r.state === "out") return;
      r.state = "out";
      r.outHow = how;
      this.outs++;
      this.outList.push({ p: r.p, how, base, isBatter: r.isBatter, t: this.t });
      this.ev("out", { how, base, runner: r.p.name, isBatter: r.isBatter });
      for (const q of this.runners) if (q.orig > r.orig && q.forcedTo) q.forcedTo = null;
    }

    checkBase(f) {
      f.onBase = null;
      for (let b = 1; b <= 4; b++) {
        if (Math.hypot(f.x - F.BASES[b][0], f.y - F.BASES[b][1]) <= 1.4) f.onBase = b;
      }
      if (!f.onBase || !f.hasBall) return;
      const b = f.onBase;
      for (const r of this.runners) {
        if (r.state === "run" && r.from + 1 === b && r.forcedTo === b) this.retire(r, "force", b);
        else if (r.state === "return" && r.returnTo === b && (r.from > b || r.d > 0)) this.retire(r, "doubled", b);
      }
    }

    fielderWithBallAt(b) {
      for (const f of this.fielders) if (f.hasBall && f.onBase === b) return f;
      return null;
    }

    /* ---------- 走者の判断 ---------- */
    occupiedStop(b, except) {
      return this.runners.some((q) => q !== except && q.state === "stop" && q.from === b && q.d === 0);
    }
    headingTo(b, except) {
      return this.runners.some((q) => q !== except && q.state === "run" && q.from + 1 === b);
    }

    ballTimeTo(b) {
      const [bx, by] = F.BASES[b];
      const bl = this.ball;
      if (bl.mode === "held") {
        const f = bl.holder;
        const d = Math.hypot(bx - f.x, by - f.y);
        if (d < 1.4) return 0;
        return Math.min(d / f.speed, Math.max(0, f.holdT) + d / this.effV(f, d));
      }
      if (bl.mode === "thrown") {
        const rem = Math.max(0, bl.t0 + bl.T - this.t);
        if (bl.base === b) return rem;
        const rc = bl.recv || this.coverFor(bl.base, null);
        const d = Math.hypot(bx - bl.tx, by - bl.ty);
        return rem + rc.transfer * 0.8 + d / this.effV(rc, d);
      }
      if (!this.chaser || !this.icpt) return 99;
      const ic = this.icpt;
      const f = this.chaser;
      const d = Math.hypot(bx - ic.x, by - ic.y);
      return Math.max(0, ic.t - this.t) + f.transfer + (ic.dive ? 0.55 : 0) + d / this.effV(f, d);
    }

    decideAdvance(r, tagUp) {
      const b = r.from;
      if (b >= 4) return false;
      const nb = b + 1;
      if (r.forcedTo === nb) return true;
      if (this.hr) return true;
      if (b > 0 && this.headingTo(b, r) && !this.occupiedStop(nb, r)) return true;
      if (nb <= 3 && this.occupiedStop(nb, r)) return false;
      if (nb <= 3 && this.runners.some((q) => q !== r && q.state === "return" && q.returnTo === nb)) return false;
      if (r.tagWait) return false;
      if (this.outs >= 3) return false;
      const runT = BD / r.speed + (r.state === "stop" ? 0.2 : 0);
      const ballT = this.ballTimeTo(nb) + (nb === 4 ? 0.1 : 0.15);
      let need = 0.32 + r.jitter;
      if (D.has(r.p, "baserun")) need -= 0.15;
      if (this.outs === 2) need -= 0.15;
      if (tagUp) need += 0.05;
      return ballT - runT > need;
    }

    /* ---------- 守備の判断 ---------- */
    planThrow(f) {
      const opts = [];
      for (const r of this.runners) {
        let tb;
        let remain;
        if (r.state === "run") {
          tb = r.from + 1;
          remain = (BD - r.d) / r.speed + Math.max(0, r.wait);
        } else if (r.state === "return") {
          tb = r.returnTo;
          remain = ((r.from - tb) * BD + r.d) / r.speed;
        } else continue;
        if (tb > 4 || tb < 1) continue;
        const force = r.forcedTo === tb || r.state === "return";
        const [bx, by] = F.BASES[tb];
        const d = Math.hypot(bx - f.x, by - f.y);
        let tBall;
        let mode;
        let recv = null;
        if (d < 1.4) {
          tBall = 0;
          mode = "onbase";
        } else {
          const tSelf = d / f.speed;
          recv = this.coverFor(tb, f);
          const tRecv = recv ? Math.hypot(recv.x - bx, recv.y - by) / recv.speed : 9;
          const tThrow = Math.max(Math.max(0, f.holdT) + d / this.effV(f, d), tRecv);
          if (tSelf <= tThrow || !recv) {
            tBall = tSelf;
            mode = "self";
          } else {
            tBall = tThrow;
            mode = "throw";
          }
        }
        const margin = remain - tBall - (force ? 0.03 : 0.18);
        opts.push({ r, tb, margin, mode, recv, force });
      }
      const good = opts.filter((o) => o.margin > 0);
      if (good.length) {
        const sc = (o) => (o.margin > 0.4 ? o.tb * 10 : 0) + o.margin;
        good.sort((a, b) => sc(b) - sc(a));
        return good[0];
      }
      const running = opts.filter((o) => o.r.state === "run");
      if (this.kind === "steal" && running.length && this.throws === 0) {
        // 盗塁: 間に合わなくても捕手は送球する
        running.sort((a, b) => b.tb - a.tb);
        const o = running[0];
        return { tb: o.tb, mode: "throw", recv: this.coverFor(o.tb, f) };
      }
      if (running.length && this.throws < 4) {
        const far = Math.min(...[1, 2, 3, 4].map((b) => Math.hypot(F.BASES[b][0] - f.x, F.BASES[b][1] - f.y))) > 20;
        if (far) {
          // 進塁を止めるため、最後尾の走者の次の塁へ返球
          running.sort((a, b) => a.tb - b.tb);
          const o = running[0];
          return { tb: o.tb, mode: "throw", recv: this.coverFor(o.tb, f), relay: true };
        }
      }
      return null;
    }

    decide(f, first) {
      const plan = this.planThrow(f);
      f.plan = plan;
      if (!plan || plan.mode === "onbase") {
        f.task = "hold";
        if (plan && plan.mode === "onbase") f.waitTag = true;
        return;
      }
      if (plan.mode === "self") {
        f.task = "runbase";
        f.base = plan.tb;
        return;
      }
      f.task = "hold";
      if (!first && f.holdT <= 0) this.throwTo(f, plan.tb, plan.recv);
    }

    /* ---------- 更新 ---------- */
    step(dt) {
      if (this.done) return;
      this.t += dt;
      this.updateBall(dt);
      if (this.done) return;
      this.updateFielders(dt);
      this.updateRunners(dt);
      this.checkEnd();
    }

    updateBall() {
      const bl = this.ball;
      if (bl.mode === "live") {
        const s = F.sampleAt(this.pred, this.t);
        bl.x = s.x;
        bl.y = s.y;
        bl.z = s.z;
        bl.air = s.air;
        bl.hr = s.hr;
        // フライが落ちた → タッチアップ待ちの走者が走る
        if (this.wasAir && !s.air) {
          this.wasAir = false;
          this.ev("land", { x: s.x, y: s.y });
          if (this.foulMode) {
            this.finish();
            return;
          }
          this.releaseTagWaiters();
        }
        if (this.pred.info.fenceHit && !this.fenceEv && Math.hypot(s.x, s.y) > F.fenceDist(F.angle(s.x, s.y)) - 1) {
          this.fenceEv = true;
          this.ev("fence", {});
        }
        const last = this.pred.samples[this.pred.samples.length - 1];
        if (this.foulMode && this.pred.info.dead && this.t >= last.t) this.finish();
      } else if (bl.mode === "thrown") {
        const u = U.clamp((this.t - bl.t0) / bl.T, 0, 1);
        bl.x = U.lerp(bl.fx, bl.tx, u);
        bl.y = U.lerp(bl.fy, bl.ty, u);
        bl.z = U.lerp(1.6, 1.2, u) + Math.min(3.5, bl.d * 0.035) * 4 * u * (1 - u);
        if (u >= 1) this.arrive(bl);
      } else if (bl.mode === "held") {
        bl.x = bl.holder.x;
        bl.y = bl.holder.y;
        bl.z = 1.0;
      }
    }

    arrive(bl) {
      if (bl.wild) {
        this.error = this.error || { pos: bl.by.pos, kind: "throw" };
        this.ev("error", { pos: bl.by.pos, kind: "throw" });
        const dx = bl.tx - bl.fx;
        const dy = bl.ty - bl.fy;
        const L = Math.hypot(dx, dy) || 1;
        const sp = U.rand(6, 11);
        const b = F.newBall([bl.tx, bl.ty, 0.5], [(dx / L) * sp + U.rand(-2, 2), (dy / L) * sp + U.rand(-2, 2), 1]);
        this.setLive(b);
        if (bl.recv) bl.recv.down = this.t + 0.6;
        this.assign();
        return;
      }
      const rc = bl.recv;
      if (rc && Math.hypot(rc.x - bl.tx, rc.y - bl.ty) <= 2.0) {
        rc.hasBall = true;
        rc.task = "hold";
        rc.holdT = rc.transfer * 0.75;
        rc.act = { k: "catch", t: this.t };
        rc.x = U.lerp(rc.x, bl.tx, 0.6);
        rc.y = U.lerp(rc.y, bl.ty, 0.6);
        this.ball = { mode: "held", holder: rc, x: rc.x, y: rc.y, z: 1.0 };
        this.checkBase(rc);
        this.decide(rc, true);
      } else {
        // 受け手がいない → ボールは転がる
        const b = F.newBall([bl.tx, bl.ty, 0.4], [U.rand(-1, 1), U.rand(-1, 1), 0]);
        this.setLive(b);
        this.assign();
      }
    }

    moveTo(f, tx, ty, dt, sp) {
      const dx = tx - f.x;
      const dy = ty - f.y;
      const d = Math.hypot(dx, dy);
      const step = (sp || f.speed) * dt;
      if (d <= step || d < 0.01) {
        f.x = tx;
        f.y = ty;
        f.vx = f.vy = 0;
        return true;
      }
      f.vx = (dx / d) * (sp || f.speed);
      f.vy = (dy / d) * (sp || f.speed);
      f.x += (dx / d) * step;
      f.y += (dy / d) * step;
      return false;
    }

    updateFielders(dt) {
      const bl = this.ball;
      for (const f of this.fielders) {
        if (f.wait > 0) {
          f.wait -= dt;
          f.vx = f.vy = 0;
          continue;
        }
        if (f.down > this.t) {
          f.vx = f.vy = 0;
          continue;
        }
        switch (f.task) {
          case "chase": {
            this.moveTo(f, f.tx, f.ty, dt);
            if (bl.mode === "live" && this.icpt && this.t >= this.icpt.t - 1e-9) this.tryCatch(f);
            break;
          }
          case "cover": {
            const [bx, by] = F.BASES[f.base];
            this.moveTo(f, bx, by, dt);
            break;
          }
          case "backup":
            this.moveTo(f, f.tx, f.ty, dt, f.speed * 0.85);
            break;
          case "runbase": {
            const [bx, by] = F.BASES[f.base];
            if (this.moveTo(f, bx, by, dt)) {
              this.checkBase(f);
              f.task = "hold";
              f.holdT = Math.min(f.holdT, f.transfer * 0.6);
              this.decide(f, false);
            }
            break;
          }
          case "hold": {
            f.vx = f.vy = 0;
            if (!f.hasBall) break;
            f.holdT -= dt;
            this.checkBase(f);
            if (f.holdT <= 0) {
              this.reTimer -= dt;
              if (this.reTimer <= 0) {
                this.reTimer = 0.15;
                const plan = this.planThrow(f);
                if (plan && plan.mode === "throw") this.throwTo(f, plan.tb, plan.recv);
                else if (plan && plan.mode === "self") {
                  f.task = "runbase";
                  f.base = plan.tb;
                }
              }
            }
            break;
          }
          default:
            f.vx = f.vy = 0;
        }
      }
    }

    updateRunners(dt) {
      const ballLoose = this.ball.mode !== "held";
      this.reDecide = (this.reDecide || 0) - dt;
      const doRe = this.reDecide <= 0;
      if (doRe) this.reDecide = 0.15;
      for (const r of this.runners) {
        if (r.state === "out" || r.state === "scored") continue;
        if (r.state === "stop") {
          if (doRe && ballLoose && !r.tagWait && !this.foulMode && this.outs < 3 && this.decideAdvance(r)) {
            r.state = "run";
            r.wait = 0.15;
          }
        } else if (r.wait > 0) {
          r.wait -= dt;
        } else if (r.state === "run") {
          r.d += r.speed * dt;
          if (r.d >= BD) this.touch(r, r.from + 1);
        } else if (r.state === "return") {
          r.d -= r.speed * dt;
          if (r.d <= 0) {
            if (r.from > r.returnTo) {
              r.from -= 1;
              r.d += BD;
            } else {
              r.d = 0;
              const f = this.fielderWithBallAt(r.from);
              if (f) this.retire(r, "doubled", r.from);
              else {
                r.state = "stop";
                r.returnTo = null;
              }
            }
          }
        }
        this.placeRunner(r);
      }
    }

    placeRunner(r) {
      if (r.state === "scored") {
        r.x = 0;
        r.y = 0;
        return;
      }
      const a = F.BASES[Math.min(r.from, 4)];
      const b = F.BASES[Math.min(r.from + 1, 4)];
      const u = U.clamp(r.d / BD, 0, 1);
      r.x = U.lerp(a[0], b[0], u);
      r.y = U.lerp(a[1], b[1], u);
    }

    touch(r, b) {
      r.from = b;
      r.d = 0;
      const f = this.fielderWithBallAt(b);
      if (f && b <= 4) {
        this.retire(r, r.forcedTo === b ? "force" : "tag", b);
        this.placeRunner(r);
        return;
      }
      if (r.forcedTo === b) r.forcedTo = null;
      if (b === 4) {
        r.state = "scored";
        r.scoredAt = this.t;
        this.scored.push({ r, t: this.t });
        this.ev("score", { runner: r.p.name });
        return;
      }
      this.ev("safe", { base: b, runner: r.p.name, isBatter: r.isBatter });
      if (this.decideAdvance(r)) {
        r.state = "run";
      } else {
        r.state = "stop";
      }
    }

    checkEnd() {
      if (this.outs >= 3) {
        this.finish();
        return;
      }
      if (this.foulMode) {
        if (this.flyCaught) this.finish();
        return;
      }
      if (this.hr) {
        if (this.runners.every((r) => r.state === "scored" || r.state === "out")) this.finish();
        return;
      }
      const moving = this.runners.some((r) => r.state === "run" || r.state === "return");
      if (!moving && this.ball.mode === "held") {
        const h = this.ball.holder;
        if (!h || h.task !== "runbase") this.finish();
      }
      if (this.t > 40) this.finish();
    }

    /* ---------- 結果 ---------- */
    finish() {
      if (this.done) return;
      this.done = true;
      const res = {
        kind: this.kind,
        hr: this.hr,
        outsAdded: this.outs - this.outs0,
        outList: this.outList,
        error: this.error,
        firstTouch: this.firstTouch,
        firstAir: this.firstAir,
        firstAt: this.firstAt,
        launch: this.launch,
        landing: this.pred && this.pred.info.landX != null ? [this.pred.info.landX, this.pred.info.landY] : null,
        fenceHit: this.pred ? this.pred.info.fenceHit : false,
        steals: [],
      };
      // 本塁打の飛距離 (フェンスが無かった場合の落下地点まで)
      if (this.hr && this.o.ball) res.dist = Math.round(F.carry(this.o.ball.p, this.o.ball.v));
      // 得点の有効判定
      let counted = this.scored.slice();
      if (this.outs >= 3) {
        const last = this.outList[this.outList.length - 1];
        if (last && (last.isBatter || last.how === "force")) counted = [];
        else if (last) counted = this.scored.filter((s) => s.t < last.t);
      }
      res.scorers = counted.map((s) => s.r.p);
      res.runs = counted.length;
      // 最終的な塁状況
      const bases = [null, null, null, null];
      if (this.outs < 3) {
        for (const r of this.runners) {
          if (r.state === "out" || r.state === "scored") continue;
          let b = r.from;
          if (r.d > BD / 2 && r.state === "run") b = r.from + 1;
          if (b >= 4) {
            res.scorers.push(r.p);
            res.runs++;
            continue;
          }
          if (b >= 1 && b <= 3) {
            if (bases[b]) {
              // 念のため重複を回避
              const nb = [1, 2, 3].find((x) => !bases[x] && x > b) || [3, 2, 1].find((x) => !bases[x]);
              if (nb) bases[nb] = r.p;
            } else bases[b] = r.p;
          }
        }
      }
      res.bases = bases;
      const br = this.runners.find((r) => r.isBatter);
      res.batterOut = br ? br.state === "out" : false;
      res.batterBase = br ? (br.state === "scored" ? 4 : br.state === "out" ? 0 : br.from) : 0;
      if (this.kind === "steal") {
        res.type = "STEAL";
        for (const r of this.runners) if (r.stealing) res.steals.push({ p: r.p, from: r.orig, ok: r.state !== "out" });
      } else if (this.foulMode) {
        res.type = this.flyCaught ? "FFO" : "FOUL";
      } else res.type = this.classify(br, res);
      this.result = res;
      this.ev("end", {});
    }

    classify(br, res) {
      if (this.hr) return "HR";
      const la = this.launch ? this.launch.la : 0;
      if (br && br.state === "out") {
        if (res.outsAdded >= 3) return "TP";
        if (res.outsAdded >= 2) return br.outHow === "fly" ? "DPF" : "DP";
        if (br.outHow === "fly") {
          if (res.runs > 0 && this.outs < 3) return "SF";
          if (OF[this.firstTouch]) return "FO";
          if (la < 18) return "LO";
          return "PO";
        }
        if (this.o.bunt && this.outs0 < 2 && this.runners.some((r) => !r.isBatter && r.state !== "out" && (r.from > r.orig || r.state === "scored"))) return "SAC";
        return "GO";
      }
      if (this.error) return "E";
      if (this.outList.length > 0) return "FC";
      const b = br ? (br.state === "scored" ? 4 : br.from) : 1;
      if (b >= 4) return "IPHR";
      return ["H1", "H1", "H2", "H3"][b] || "H1";
    }
  }

  Play.HOME_POS = HOME_POS;
  PB.Play = Play;
})((window.PB = window.PB || {}));
