/* 熱闘！ポケットベースボール — 選手リグ (human.js から分離)
 * anim.js のポーズを MakeHuman の骨に適用する (2 本の骨の IK・ばね・足の固定・視線・待機中の動き)。
 * human.js の後に読み込む (RIG は human.js の H.load が埋める同じ表を参照する) */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const A = PB.Anim;
  const H = PB.Human;
  const D2R = Math.PI / 180;
  const { RIG, frame, hash, mulberry } = H._int;

  /* ======================================================
   *  リグ: anim.js のポーズ (キャラクター空間) を MakeHuman の骨に適用する
   * ====================================================== */
  const _v1 = new T.Vector3();
  const _v2 = new T.Vector3();
  const _v3 = new T.Vector3();
  const _q1 = new T.Quaternion();
  const _q2 = new T.Quaternion();
  const _q3 = new T.Quaternion();
  const _e = new T.Euler();
  const _m1 = new T.Matrix4();
  const _m2 = new T.Matrix4();
  // 毎フレームの計算で使い回す作業用 (ガベージを出さない)
  const _fx = new T.Vector3();
  const _fy = new T.Vector3();
  const _fz = new T.Vector3();
  const _pA = new T.Vector3();
  const _u = new T.Vector3();
  const _pv = new T.Vector3();
  const _E = new T.Vector3();
  const _W = new T.Vector3();
  const _eA = new T.Vector3();
  const _wE = new T.Vector3();
  const _n = new T.Vector3();
  const _tw = new T.Vector3();
  const _pw = new T.Vector3();
  // frame() と同じ基底を、作業用のベクトルで m に書き込む
  function frameInto(m, a, b) {
    _fx.copy(a).normalize();
    _fy.copy(b).addScaledVector(_fx, -b.dot(_fx)).normalize();
    _fz.crossVectors(_fx, _fy);
    return m.makeBasis(_fx, _fy, _fz);
  }

  /* ---------- 動きのばね (drive) ----------
   * ポーズの数値 (anim.js の並び) ごとに臨界減衰に近いばねで目標を追う。前の動きの勢いが残るので、
   * ポーズが切り替わっても急に向きを変えない。同じクリップの続き (印 src/st が続いている) のときは
   * 目標の速さを先取りして遅れなく追う (ミート・リリースの瞬間がずれない)。ばねは厳密解なので低い fps でも発散しない */
  const NCH = A.NCH || 63;
  const CHK = A.CH_KIND || new Uint8Array(NCH);
  // 減衰比: 腕・バットは 0.8 (少し弾む)、体幹・脚は 1 (足が地面にめり込まない)
  const ZARM = new Uint8Array(NCH);
  for (let c = 21; c < 39; c++) ZARM[c] = 1;
  for (let c = 57; c < 63; c++) ZARM[c] = 1;
  // 1 フレームで「飛んだ」と見なす差 (基準 + 加速度 × dt²) と、先取りする速さの上限。位置 m / 角度 度 / 向き。
  // バットの向き (単位ベクトル) はスイングで 1 秒に 10 回転近く回るので、向きの変化そのものは飛びと見なさない
  const J0 = [0.06, 6, 0.15];
  const JA = [400, 40000, 9000];
  const VMX = [30, 3000, 160];
  // 臨界減衰 (z=1) と減衰振動 (z<1) の 1 ステップの係数: e1 = K0 e0 + K1 de0, de1 = K2 e0 + K3 de0
  function springK(K, om, z, dt) {
    if (z >= 0.999) {
      const E = Math.exp(-om * dt);
      K[0] = (1 + om * dt) * E;
      K[1] = dt * E;
      K[2] = -om * om * dt * E;
      K[3] = (1 - om * dt) * E;
    } else {
      const wd = om * Math.sqrt(1 - z * z);
      const al = z * om;
      const E = Math.exp(-al * dt);
      const c = Math.cos(wd * dt);
      const s = Math.sin(wd * dt);
      K[0] = E * (c + (al * s) / wd);
      K[1] = (E * s) / wd;
      K[2] = (-E * om * om * s) / wd;
      K[3] = E * (c - (al * s) / wd);
    }
  }
  const TAU = Math.PI * 2;
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const _ne = [0, 0, 0];
  const _he = [0, 0, 0];
  const _tl = [0, 0, 0];
  const _tr = [0, 0, 0];
  const _fl = [0, 0, 0];
  const _fr = [0, 0, 0];
  const _mi = new T.Matrix4();
  const _wf = new T.Vector3();
  const _cf = new T.Vector3();

  class HRig {
    constructor(player) {
      this.player = player;
      this.b = player.bones;
      this.rest = {};
      for (const k in this.b) this.rest[k] = this.b[k].position.clone();
      this.cur = A.basePose();
      this.bat = player.gear.bat;
      this.grip = { L: 0.3, R: 0.3 };
      // ばねの状態 (drive で使う)
      this.sp = null;
      this._out = null;
      this._dt = 0;
      this._drv = false; // drive() から apply() しているあいだ true (足の固定・視線・呼吸は drive のときだけ)
      // 足の固定 (接地して止まっている足をワールドに留める)
      const foot = () => ({ lock: false, w: new T.Vector3(), prev: new T.Vector3(), pc: [0, 0, 0], has: false, yaw: 0, rel: 0, relT: 0.1, lift: 0 });
      this.ft = { l: foot(), r: foot() };
      // 視線 (ボールを追う) と待機中の動き (呼吸・重心の移動・よそ見)
      const o = player.opts || {};
      const rnd = mulberry(hash("rig:" + (o.seed != null ? o.seed : (o.nameEn || "") + (o.num || ""))));
      this.rnd = rnd;
      this.lk = { pos: new T.Vector3(), has: false, w: 0, y: 0, p: 0 };
      this.lf = { t: rnd() * 20, bf: 0.22 + rnd() * 0.08, ph: rnd() * 6.28, idle: 0, gy: 0, gp: 0, gT: 1 + rnd() * 3 };
      this.lifeOn = true;
    }
    // 視線の目標 (ワールド座標, null で無し)、重み (0..1)、待機中の動きを付けるか (低画質では切る)
    setLook(pos, w, life) {
      const L = this.lk;
      L.has = !!pos && w > 0;
      L.w = L.has ? w : 0;
      if (L.has) L.pos.copy(pos);
      this.lifeOn = life !== false;
    }
    setE(bone, e, k) {
      const s = k == null ? 1 : k;
      _e.set(e[0] * D2R * s, e[1] * D2R * s, e[2] * D2R * s, "YXZ");
      bone.quaternion.setFromEuler(_e);
    }
    toWorld(v, out) {
      return out.set(v[0], v[1], v[2]).applyMatrix4(this.b.Root.matrixWorld);
    }
    // 休止姿勢の (主軸 r, 曲げ軸 a) を ワールドの (d, n) に合わせる
    aimFrame(bone, r, a, d, n) {
      frameInto(_m1, r, a);
      frameInto(_m2, d, n);
      _m2.multiply(_m1.transpose());
      _q1.setFromRotationMatrix(_m2);
      bone.parent.getWorldQuaternion(_q2);
      bone.quaternion.copy(_q2.invert().multiply(_q1));
      bone.updateMatrixWorld(true);
    }
    limb(a, b, c, R, tgt, pole) {
      a.updateMatrixWorld(true);
      const pA = _pA.setFromMatrixPosition(a.matrixWorld);
      const u = _u.copy(tgt).sub(pA);
      let d = u.length();
      const L1 = R.L1;
      const L2 = R.L2;
      d = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, d));
      u.normalize();
      const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const pv = _pv.copy(pole).sub(pA);
      pv.addScaledVector(u, -pv.dot(u));
      if (pv.lengthSq() < 1e-8) pv.set(0, 0, 1);
      pv.normalize();
      const E = _E.copy(pA).addScaledVector(u, L1 * cosA).addScaledVector(pv, L1 * sinA);
      const W = _W.copy(pA).addScaledVector(u, d);
      const eA = _eA.copy(E).sub(pA);
      const wE = _wE.copy(W).sub(E);
      // 曲げの平面の法線
      const n = _n.crossVectors(eA, wE);
      if (n.lengthSq() < 1e-8) n.copy(u).cross(pv).negate();
      n.normalize();
      // 休止姿勢の曲げ軸と符号をそろえる (ワールドに写した休止軸と同じ向き)
      this.aimFrame(a, R.ru, R.au, eA, n);
      this.aimFrame(b, R.rf, R.af, wE, n);
    }
    orientHand(bone, side, e) {
      _e.set(e[0] * D2R, e[1] * D2R, e[2] * D2R, "YXZ");
      _q2.setFromEuler(_e);
      this.b.Root.getWorldQuaternion(_q1);
      _q1.multiply(_q2).multiply(RIG["hand_" + side]);
      bone.parent.getWorldQuaternion(_q3);
      bone.quaternion.copy(_q3.invert().multiply(_q1));
    }
    orientFoot(bone, e) {
      _e.set(e[0] * D2R, e[1] * D2R, e[2] * D2R, "YXZ");
      _q2.setFromEuler(_e);
      this.b.Root.getWorldQuaternion(_q1);
      _q1.multiply(_q2);
      bone.parent.getWorldQuaternion(_q3);
      bone.quaternion.copy(_q3.invert().multiply(_q1));
    }
    fingers(side, k) {
      const F = RIG["fingers_" + side];
      for (const f in F) {
        const thumb = f === "thumb";
        const ang = thumb ? [12, 22, 28] : [62, 88, 55];
        F[f].forEach((ax, i) => {
          const bn = this.b[f + "_0" + (i + 1) + "_" + side];
          if (bn) bn.quaternion.setFromAxisAngle(ax.axis, ang[i] * k * D2R);
        });
      }
    }
    apply(p) {
      const b = this.b;
      this.cur = p;
      // drive() を通らずに置いたポーズ (最初・瞬間移動・カード) では、ばね・足の固定・視線をやり直す
      const drv = this._drv;
      if (!drv) this.resetMotion();
      this.player.group.updateWorldMatrix(true, false);
      b.Root.rotation.set(p.tilt * D2R, p.yaw * D2R, p.roll * D2R, "YXZ");
      const hr = this.rest.pelvis;
      b.pelvis.position.set(hr.x + p.root[0], hr.y + p.root[1], hr.z + p.root[2]);
      this.setE(b.pelvis, p.hips);
      this.setE(b.spine_01, p.spine, 0.5);
      this.setE(b.spine_02, p.spine, 0.5);
      this.setE(b.spine_03, p.chest);
      this.setE(b.neck_01, p.neck);
      this.setE(b.head, p.head);
      b.Root.updateMatrixWorld(true);
      // 視線: 首と頭をボールへ (または待機中のよそ見)。下の 2 回目の updateMatrixWorld で反映される
      if (drv && this.lifeOn) {
        this.lookAt(p, _ne, _he);
        this.setE(b.neck_01, _ne);
        this.setE(b.head, _he);
      }
      // バットの握り
      let armL = p.armL.t;
      let armR = p.armR.t;
      if (p.bat.on) {
        const g = p.bat.g;
        const d = _v1.set(p.bat.d[0], p.bat.d[1], p.bat.d[2]).normalize();
        const top = [g[0] + d.x * 0.085, g[1] + d.y * 0.085, g[2] + d.z * 0.085];
        if (this.player.opts.bats === "L") {
          armR = g;
          armL = top;
        } else {
          armL = g;
          armR = top;
        }
      }
      // 鎖骨: 手を高く上げるほど肩をすくめる
      for (const s of ["l", "r"]) {
        const t = s === "l" ? armL : armR;
        const lift = Math.max(0, Math.min(1, (t[1] - 1.25) / 0.6));
        const fw = Math.max(-0.5, Math.min(1, t[2] / 0.5));
        const sg = s === "l" ? 1 : -1;
        _e.set(-fw * 8 * D2R, 0, sg * lift * 16 * D2R, "YXZ");
        b["clavicle_" + s].quaternion.setFromEuler(_e);
      }
      b.Root.updateMatrixWorld(true);
      const tw = _tw;
      const pw = _pw;
      this.limb(b.upperarm_l, b.lowerarm_l, b.hand_l, RIG.arm_l, this.toWorld(armL, tw), this.toWorld(p.armL.p, pw));
      this.orientHand(b.hand_l, "l", p.armL.h);
      this.limb(b.upperarm_r, b.lowerarm_r, b.hand_r, RIG.arm_r, this.toWorld(armR, tw), this.toWorld(p.armR.p, pw));
      this.orientHand(b.hand_r, "r", p.armR.h);
      // 足首の位置は Rig (簡易モデル) と同じ定義。drive のときは接地した足をワールドに留める
      let tL = p.legL.t;
      let tR = p.legR.t;
      let fL = p.legL.f;
      let fR = p.legR.f;
      if (drv) {
        this._inv = false;
        // 体 (Root) のワールドでの速さ
        const me = b.Root.matrixWorld.elements;
        const bp = this._bp || (this._bp = new T.Vector3(me[12], me[13], me[14]));
        this._bs = Math.hypot(me[12] - bp.x, me[14] - bp.z) / this._dt;
        bp.set(me[12], me[13], me[14]);
        for (let i = 0; i < 3; i++) {
          _fl[i] = fL[i];
          _fr[i] = fR[i];
        }
        tL = this.plant("l", p, tL, _tl, _fl);
        tR = this.plant("r", p, tR, _tr, _fr);
        fL = _fl;
        fR = _fr;
      }
      this.limb(b.thigh_l, b.calf_l, b.foot_l, RIG.leg_l, this.toWorld(tL, tw), this.toWorld(p.legL.p, pw));
      this.orientFoot(b.foot_l, fL);
      this.limb(b.thigh_r, b.calf_r, b.foot_r, RIG.leg_r, this.toWorld(tR, tw), this.toWorld(p.legR.p, pw));
      this.orientFoot(b.foot_r, fR);
      // 指
      const gl = this.player.gear.glove && this.player.gear.glove.visible;
      const gh = this.player.opts.throws === "L" ? "r" : "l";
      for (const s of ["l", "r"]) {
        let k = this.grip[s.toUpperCase()];
        if (p.bat.on) k = 1;
        else if (gl && s === gh) k = this.player.gear.glove.isGroup ? 0.1 : 0.5; // グラブの中では指をのばす
        this.fingers(s, k);
        // グラブをはめた手の指は中に収まるよう小さくする (外から見えない)
        const hide = gl && s === gh && this.player.gear.glove.isGroup ? 0.55 : 1;
        for (const f of ["index", "middle", "ring", "pinky", "thumb"]) {
          const bn = this.b[f + "_01_" + s];
          if (bn && bn.scale.x !== hide) bn.scale.setScalar(hide);
        }
      }
      b.Root.updateMatrixWorld(true);
      // バット
      const bat = this.bat;
      if (bat) {
        bat.visible = !!p.bat.on;
        if (p.bat.on) {
          if (bat.parent !== b.Root) b.Root.add(bat);
          const d = _v1.set(p.bat.d[0], p.bat.d[1], p.bat.d[2]).normalize();
          bat.position.set(p.bat.g[0] - d.x * 0.06, p.bat.g[1] - d.y * 0.06, p.bat.g[2] - d.z * 0.06);
          bat.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), d);
        }
      }
    }
    // 目標ポーズへばねで近づける (rate: 1/秒。ばねの固有角振動数は 2×rate で、遅れは以前の指数補間と同じくらい)
    drive(target, dt, rate) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      if (!dt) return this.apply(target);
      let S = this.sp;
      if (!S) {
        const f = () => new Float64Array(NCH);
        // x: 出力, e/ed: 目標からのずれとその速さ, v: 出力の速さ, tp/vtp: 前の目標とその速さ, trk: 前のフレームで目標の速さを先取りしたか
        S = this.sp = { x: f(), e: f(), ed: f(), v: f(), tp: f(), vtp: f(), xt: f(), trk: new Uint8Array(NCH), KA: f(), KB: f(), src: 0, st: 0, ok: false };
      }
      const xt = A.flat(target, S.xt);
      const x = S.x;
      const e = S.e;
      const ed = S.ed;
      const v = S.v;
      const tp = S.tp;
      const vtp = S.vtp;
      const trk = S.trk;
      if (!S.ok) {
        // 直前に apply() で置いたポーズから、止まった状態で始める
        A.flat(this.cur, x);
        for (let c = 0; c < NCH; c++) e[c] = x[c] - xt[c];
        ed.fill(0);
        v.fill(0);
        vtp.fill(0);
        trk.fill(0);
        tp.set(xt);
        S.src = 0;
      }
      const om = 2 * (rate == null ? 14 : rate);
      springK(S.KA, om, 1, dt);
      springK(S.KB, om, 0.8, dt);
      // 同じクリップの続きか (時刻が少しだけ進んでいる)。走り・構えの揺れ (src < 0) は位相なので幅を広く
      const ds = target.st - S.st;
      const cont = S.ok && !!target.src && target.src === S.src && ds > -1e-6 && ds < (target.src < 0 ? 2.5 : 0.25);
      const dt2 = dt * dt;
      for (let c = 0; c < NCH; c++) {
        const d = xt[c] - tp[c];
        const kd = CHK[c];
        let vt = 0;
        // 続きでも、その数値だけ急に飛んだ (あとからポーズを書き換えた) ときは、ばねでつなぐ
        if (cont && Math.abs(d - v[c] * dt) < J0[kd] + JA[kd] * dt2) {
          // 目標の動き (加速も) はそのまま追い、ずれ e だけをばねで減らす
          vt = clampN(d / dt, -VMX[kd], VMX[kd]);
          if (!trk[c]) ed[c] += vtp[c] - vt;
          trk[c] = 1;
        } else {
          // 飛んだ・別のポーズ: いまの位置と速さ (勢い) を保ったまま、新しい目標からのずれにする
          e[c] += tp[c] - xt[c];
          ed[c] += vtp[c];
          trk[c] = 0;
        }
        const K = ZARM[c] ? S.KB : S.KA;
        const e0 = e[c];
        const de0 = ed[c];
        e[c] = K[0] * e0 + K[1] * de0;
        ed[c] = K[2] * e0 + K[3] * de0;
        x[c] = xt[c] + e[c];
        v[c] = vt + ed[c];
        tp[c] = xt[c];
        vtp[c] = vt;
      }
      S.src = target.src || 0;
      S.st = target.st || 0;
      S.ok = true;
      const out = this._out || (this._out = A.basePose());
      A.unflat(x, out);
      out.bat.on = target.bat.on;
      out.src = target.src;
      out.st = target.st;
      out.kind = target.kind;
      if (this.lifeOn) this.life(out, dt);
      this._dt = dt;
      this._drv = true;
      try {
        this.apply(out);
      } finally {
        this._drv = false;
      }
    }
    resetMotion() {
      if (this.sp) this.sp.ok = false;
      for (const s of ["l", "r"]) {
        const F = this.ft[s];
        F.lock = false;
        F.rel = 0;
        F.has = false;
      }
      this.lk.y = this.lk.p = 0;
    }

    /* 待機中の動き: 呼吸 (胸がわずかに起きる)・左右の重心の移動・ときどきよそ見 (ボールが無いとき) */
    life(p, dt) {
      const L = this.lf;
      const v = this.sp.v;
      // 動きの大きさ (腰・両手の目標の速さ m/秒、腰の回転 度/秒)
      const act = Math.hypot(v[0], v[1], v[2]) + 0.5 * (Math.hypot(v[21], v[22], v[23]) + Math.hypot(v[30], v[31], v[32])) + 0.004 * Math.abs(v[7]);
      const want = act < 0.25 && p.kind !== "run" && p.kind !== "swing" && Math.abs(p.tilt) < 5 ? 1 : 0;
      L.idle += (want - L.idle) * (1 - Math.exp(-dt * (want ? 1.2 : 6)));
      L.t += dt;
      const br = Math.sin(L.t * TAU * L.bf);
      const kb = 0.35 + 0.65 * L.idle;
      p.chest[0] -= 1.1 * br * kb;
      p.root[1] += 0.004 * br * kb;
      const ws = Math.sin(L.t * TAU * 0.15 + L.ph) * L.idle;
      p.root[0] += 0.015 * ws;
      p.hips[2] += 1.6 * ws;
      p.chest[2] -= 1.0 * ws;
      // よそ見: 1〜4.5 秒ごとに、正面か左右・上下の少し違う所を見る
      L.gT -= dt;
      if (L.gT <= 0) {
        const away = this.rnd() < 0.55;
        L.gy = away ? (this.rnd() * 2 - 1) * 35 : 0;
        L.gp = away ? (this.rnd() * 2 - 1) * 8 : 0;
        L.gT = 1 + this.rnd() * 3.5;
      }
    }

    /* 視線: 目標の方向を胸の座標で求め、首 40%・頭 60% に分けて足す (左右 ±70°・上下 ±40°、胸に対して ±80° まで)。
     * 足す角度はなめらかに追わせる (ボールより少し遅れる) */
    lookAt(p, ne, he) {
      const L = this.lk;
      const b = this.b;
      let ty = 0;
      let tp = 0;
      let w = 0;
      if (L.has) {
        b.spine_03.getWorldQuaternion(_q1).invert();
        _v1.setFromMatrixPosition(b.head.matrixWorld);
        _v2.copy(L.pos).sub(_v1).applyQuaternion(_q1);
        // いまの頭の正面 (+Z) を胸の座標で
        _e.set(p.neck[0] * D2R, p.neck[1] * D2R, p.neck[2] * D2R, "YXZ");
        _q2.setFromEuler(_e);
        _e.set(p.head[0] * D2R, p.head[1] * D2R, p.head[2] * D2R, "YXZ");
        _q3.setFromEuler(_e);
        _v3.set(0, 0, 1).applyQuaternion(_q2.multiply(_q3));
        const yd = Math.atan2(_v2.x, _v2.z);
        const pd = Math.atan2(-_v2.y, Math.hypot(_v2.x, _v2.z));
        const yf = Math.atan2(_v3.x, _v3.z) / D2R;
        const pf = Math.atan2(-_v3.y, Math.hypot(_v3.x, _v3.z)) / D2R;
        const yl = Math.max(80, Math.abs(yf));
        ty = clampN(yf + clampN(wrapA(yd - yf * D2R) / D2R, -70, 70), -yl, yl) - yf;
        tp = clampN(pf + clampN(pd / D2R - pf, -40, 40), Math.min(-40, pf), Math.max(45, pf)) - pf;
        // 背中側の目標は追わない (体ごと向きを変えるのは view.js の役目)
        w = L.w * (1 - clampN((Math.abs(yd) / D2R - 110) / 40, 0, 1));
      }
      const lf = this.lf;
      const gw = lf.idle * (1 - w);
      const k = 1 - Math.exp(-this._dt * 6);
      L.y += (ty * w + lf.gy * gw - L.y) * k;
      L.p += (tp * w + lf.gp * gw - L.p) * k;
      ne[0] = p.neck[0] + L.p * 0.35;
      ne[1] = p.neck[1] + L.y * 0.4;
      ne[2] = p.neck[2];
      he[0] = p.head[0] + L.p * 0.65;
      he[1] = p.head[1] + L.y * 0.6;
      he[2] = p.head[2];
    }

    /* 足の固定: 地面に着いていて (足首が低い)、ポーズの中で止まっている足 (体が回る・動くだけ) か、
     * ワールドで止まっている足 (走りの接地) をその場に留める。
     * 体が回る・動いて足が 15cm (もう片方が踏み出し中なら 30cm) 離れる / 34° ねじれたら、少し持ち上げて踏み直す。
     * 足が上がる・ポーズが足を動かすと短い時間でもとの目標へ戻す。t: キャラクター空間の目標, out: 書き込み先, fo: 足の角度 (向きを足す) */
    plant(s, p, t, out, fo) {
      const F = this.ft[s];
      const dt = this._dt;
      const M = this.b.Root.matrixWorld;
      const w = _wf.set(t[0], t[1], t[2]).applyMatrix4(M);
      // ワールドでの速さと、ポーズの中 (キャラクター空間) での速さ
      const sp = F.has ? Math.hypot(w.x - F.prev.x, w.z - F.prev.z) / dt : 99;
      const sc = F.has ? Math.hypot(t[0] - F.pc[0], t[2] - F.pc[2]) / dt : 99;
      F.prev.copy(w);
      F.pc[0] = t[0];
      F.pc[2] = t[2];
      F.has = true;
      const yaw = Math.atan2(M.elements[8], M.elements[10]);
      const flat = Math.abs(p.tilt) < 6 && Math.abs(p.roll) < 6;
      const low = t[1] < 0.095;
      // 体ごと速く動いている (走りのポーズでなく滑っていく) ときは留めない。引きずるより自然
      const bs = this._bs;
      if (F.lock) {
        const dx = Math.hypot(w.x - F.w.x, w.z - F.w.z);
        const other = this.ft[s === "l" ? "r" : "l"];
        const tw = Math.abs(wrapA(yaw - F.yaw));
        if (!flat || !low || (sp > 0.8 && (sc > 0.8 || bs > 1.6)) || dx > 0.6) this.release(F, dx > 0.6 ? 0 : 0.08, 0);
        // 踏み直しは片足ずつ (もう片方が動いているあいだは、かなり離れるまで待つ)
        else if (dx > 0.42 || tw > 1.5 || ((dx > 0.15 || tw > 0.6) && other.rel <= 0)) this.release(F, 0.18, 0.08);
      }
      if (!F.lock && F.rel <= 0 && flat && low && (sp < 0.45 || (sc < 0.3 && bs < 1.2))) {
        F.lock = true;
        F.w.copy(w);
        F.yaw = yaw;
      }
      if (!F.lock && F.rel <= 0) return t;
      if (!this._inv) {
        _mi.copy(M).invert();
        this._inv = true;
      }
      const c = _cf.copy(F.w).applyMatrix4(_mi);
      const dyaw = wrapA(F.yaw - yaw) / D2R;
      if (F.lock) {
        out[0] = c.x;
        out[1] = t[1];
        out[2] = c.z;
        fo[1] += dyaw;
        return out;
      }
      // 離した足を目標へ戻す (なめらかに。踏み直しは少し持ち上げる)
      F.rel = Math.max(0, F.rel - dt / F.relT);
      const k = 1 - F.rel;
      const e = k * k * (3 - 2 * k);
      out[0] = c.x + (t[0] - c.x) * e;
      out[1] = t[1] + F.lift * Math.sin(Math.PI * k);
      out[2] = c.z + (t[2] - c.z) * e;
      fo[1] += dyaw * (1 - e);
      return out;
    }
    release(F, time, lift) {
      F.lock = false;
      F.rel = time > 0 ? 1 : 0;
      F.relT = time || 0.1;
      F.lift = lift;
    }
  }
  H.Rig = HRig;
  void _v3;
})((window.PB = window.PB || {}));
