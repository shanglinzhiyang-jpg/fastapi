/* 熱闘！ポケットベースボール — 3D 選手のポーズとアニメーション
 * ポーズは数値パラメータ (体幹の角度・手足の IK 目標・バットの向き) で表し、
 * 線形補間でなめらかにつなぐ。手足は 2 ボーン IK で目標位置に置く。
 * ポーズ座標は「キャラクター空間」: +Z が正面, +X が左手側, Y が上 (m, 度)。
 * 打者・投手のポーズは右打ち/右投げで定義し、左はミラーで作る。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const A = {};
  const D2R = Math.PI / 180;
  const DOWN = new T.Vector3(0, -1, 0);

  /* ---------- ポーズの基本形 ---------- */
  function basePose() {
    return {
      root: [0, 0, 0], // 腰の位置オフセット
      yaw: 0, // 体全体の向き
      tilt: 0, // 体全体の前後傾 (ダイビングなど)
      roll: 0,
      hips: [0, 0, 0],
      spine: [0, 0, 0],
      chest: [0, 0, 0],
      neck: [0, 0, 0],
      head: [0, 0, 0],
      armL: { t: [0.25, 0.9, 0.02], p: [0.6, 1.1, -0.6], h: [0, 0, 0] },
      armR: { t: [-0.25, 0.9, 0.02], p: [-0.6, 1.1, -0.6], h: [0, 0, 0] },
      legL: { t: [0.11, 0.06, 0.0], p: [0.15, 0.5, 1], f: [0, 0, 0] },
      legR: { t: [-0.11, 0.06, 0.0], p: [-0.15, 0.5, 1], f: [0, 0, 0] },
      bat: { g: [-0.2, 1.4, -0.05], d: [-0.2, 0.9, -0.4], on: 0 },
    };
  }
  A.basePose = basePose;

  // 深いマージ (指定したキーだけ上書き)
  function P(over) {
    const b = basePose();
    const merge = (dst, src) => {
      for (const k in src) {
        if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) merge(dst[k], src[k]);
        else dst[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
      }
    };
    merge(b, over || {});
    return b;
  }
  A.P = P;

  function lerpPose(a, b, t, out) {
    const o = out || basePose();
    const L = (x, y) => x + (y - x) * t;
    const arr = (d, x, y) => {
      d[0] = L(x[0], y[0]);
      d[1] = L(x[1], y[1]);
      d[2] = L(x[2], y[2]);
    };
    arr(o.root, a.root, b.root);
    o.yaw = L(a.yaw, b.yaw);
    o.tilt = L(a.tilt, b.tilt);
    o.roll = L(a.roll, b.roll);
    for (const k of ["hips", "spine", "chest", "neck", "head"]) arr(o[k], a[k], b[k]);
    for (const k of ["armL", "armR"]) {
      arr(o[k].t, a[k].t, b[k].t);
      arr(o[k].p, a[k].p, b[k].p);
      arr(o[k].h, a[k].h, b[k].h);
    }
    for (const k of ["legL", "legR"]) {
      arr(o[k].t, a[k].t, b[k].t);
      arr(o[k].p, a[k].p, b[k].p);
      arr(o[k].f, a[k].f, b[k].f);
    }
    arr(o.bat.g, a.bat.g, b.bat.g);
    arr(o.bat.d, a.bat.d, b.bat.d);
    o.bat.on = t < 0.5 ? a.bat.on : b.bat.on;
    return o;
  }
  A.lerpPose = lerpPose;
  A.copyPose = (p) => lerpPose(p, p, 0);

  // 左右反転 (左投げ・左打ち用)
  function mirror(p) {
    const m = basePose();
    const mx = (v) => [-v[0], v[1], v[2]];
    const me = (v) => [v[0], -v[1], -v[2]];
    m.root = mx(p.root);
    m.yaw = -p.yaw;
    m.tilt = p.tilt;
    m.roll = -p.roll;
    for (const k of ["hips", "spine", "chest", "neck", "head"]) m[k] = me(p[k]);
    m.armL = { t: mx(p.armR.t), p: mx(p.armR.p), h: me(p.armR.h) };
    m.armR = { t: mx(p.armL.t), p: mx(p.armL.p), h: me(p.armL.h) };
    m.legL = { t: mx(p.legR.t), p: mx(p.legR.p), f: me(p.legR.f) };
    m.legR = { t: mx(p.legL.t), p: mx(p.legL.p), f: me(p.legL.f) };
    m.bat = { g: mx(p.bat.g), d: mx(p.bat.d), on: p.bat.on };
    return m;
  }
  A.mirror = mirror;

  /* ---------- キーフレーム ---------- */
  const ease = {
    lin: (t) => t,
    io: (t) => t * t * (3 - 2 * t),
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
  };
  // clip: [{t, pose, e}]
  function sample(clip, t, out) {
    if (t <= clip[0].t) return lerpPose(clip[0].pose, clip[0].pose, 0, out);
    for (let i = 0; i < clip.length - 1; i++) {
      const a = clip[i];
      const b = clip[i + 1];
      if (t <= b.t) {
        const u = (t - a.t) / (b.t - a.t);
        return lerpPose(a.pose, b.pose, (ease[b.e] || ease.io)(u), out);
      }
    }
    const last = clip[clip.length - 1];
    return lerpPose(last.pose, last.pose, 0, out);
  }
  A.sample = sample;
  A.clipLength = (clip) => clip[clip.length - 1].t;

  /* ---------- リグ (ポーズを骨に適用) ---------- */
  const _v1 = new T.Vector3();
  const _v2 = new T.Vector3();
  const _v3 = new T.Vector3();
  const _q1 = new T.Quaternion();
  const _q2 = new T.Quaternion();
  const _e = new T.Euler();
  const _m = new T.Matrix4();

  class Rig {
    constructor(player) {
      this.player = player;
      this.b = player.bones;
      const b = this.b;
      this.len = {
        ua: b["foreArm.L"].position.length(),
        fa: b["hand.L"].position.length(),
        th: b["shin.L"].position.length(),
        sh: b["foot.L"].position.length(),
      };
      this.hipsRest = b.hips.position.clone();
      this.cur = basePose();
      this.bat = player.gear.bat;
      this.batBone = null;
    }

    setE(bone, e) {
      _e.set(e[0] * D2R, e[1] * D2R, e[2] * D2R, "YXZ");
      bone.quaternion.setFromEuler(_e);
    }

    // キャラクター空間の点 → ワールド
    toWorld(v, out) {
      return out.set(v[0], v[1], v[2]).applyMatrix4(this.b.root.matrixWorld);
    }

    // ボーンの -Y 軸をワールド方向 dir に向ける
    aim(bone, dir) {
      bone.parent.getWorldQuaternion(_q1);
      _v3.copy(dir).applyQuaternion(_q1.invert()).normalize();
      bone.quaternion.setFromUnitVectors(DOWN, _v3);
      bone.updateMatrixWorld(true);
    }

    ik(a, b, c, L1, L2, tgt, pole) {
      a.updateMatrixWorld(true);
      const pA = _v1.setFromMatrixPosition(a.matrixWorld);
      const dv = _v2.copy(tgt).sub(pA);
      let d = dv.length();
      const dmin = Math.abs(L1 - L2) + 1e-3;
      const dmax = L1 + L2 - 1e-3;
      d = Math.min(dmax, Math.max(dmin, d));
      const u = dv.normalize();
      const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const pv = _v3.copy(pole).sub(pA);
      pv.addScaledVector(u, -pv.dot(u));
      if (pv.lengthSq() < 1e-8) pv.set(0, 0, 1);
      pv.normalize();
      const E = new T.Vector3().copy(pA).addScaledVector(u, L1 * cosA).addScaledVector(pv, L1 * sinA);
      const Tc = new T.Vector3().copy(pA).addScaledVector(u, d);
      this.aim(a, E.clone().sub(pA));
      this.aim(b, Tc.sub(E));
    }

    // 手首・足首の向きをキャラクター空間の角度で指定
    orient(bone, e) {
      _e.set(e[0] * D2R, e[1] * D2R, e[2] * D2R, "YXZ");
      _q2.setFromEuler(_e);
      this.b.root.getWorldQuaternion(_q1);
      _q1.multiply(_q2);
      bone.parent.getWorldQuaternion(_q2);
      bone.quaternion.copy(_q2.invert().multiply(_q1));
    }

    apply(p) {
      const b = this.b;
      this.cur = p;
      // 親 (グループ) のワールド行列を先に確定させる
      this.player.group.updateWorldMatrix(true, false);
      // 体幹
      b.root.rotation.set(p.tilt * D2R, p.yaw * D2R, p.roll * D2R, "YXZ");
      b.hips.position.set(this.hipsRest.x + p.root[0], this.hipsRest.y + p.root[1], this.hipsRest.z + p.root[2]);
      this.setE(b.hips, p.hips);
      this.setE(b.spine, p.spine);
      this.setE(b.chest, p.chest);
      this.setE(b.neck, p.neck);
      this.setE(b.head, p.head);
      for (const s of ["L", "R"]) b["clav." + s].quaternion.identity();
      b.root.updateMatrixWorld(true);
      // バット
      let armL = p.armL.t;
      let armR = p.armR.t;
      if (p.bat.on) {
        const g = p.bat.g;
        const d = _v1.set(p.bat.d[0], p.bat.d[1], p.bat.d[2]).normalize();
        const top = [g[0] + d.x * 0.085, g[1] + d.y * 0.085, g[2] + d.z * 0.085];
        // 右打者: 下の手 = 左手
        if (this.player.opts.bats === "L") {
          armR = g;
          armL = top;
        } else {
          armL = g;
          armR = top;
        }
      }
      const tw = new T.Vector3();
      const pw = new T.Vector3();
      const L = this.len;
      this.ik(b["upperArm.L"], b["foreArm.L"], b["hand.L"], L.ua, L.fa, this.toWorld(armL, tw), this.toWorld(p.armL.p, pw));
      this.orient(b["hand.L"], p.armL.h);
      this.ik(b["upperArm.R"], b["foreArm.R"], b["hand.R"], L.ua, L.fa, this.toWorld(armR, tw), this.toWorld(p.armR.p, pw));
      this.orient(b["hand.R"], p.armR.h);
      this.ik(b["thigh.L"], b["shin.L"], b["foot.L"], L.th, L.sh, this.toWorld(p.legL.t, tw), this.toWorld(p.legL.p, pw));
      this.orient(b["foot.L"], [p.legL.f[0], p.legL.f[1], p.legL.f[2]]);
      this.ik(b["thigh.R"], b["shin.R"], b["foot.R"], L.th, L.sh, this.toWorld(p.legR.t, tw), this.toWorld(p.legR.p, pw));
      this.orient(b["foot.R"], [p.legR.f[0], p.legR.f[1], p.legR.f[2]]);
      b.root.updateMatrixWorld(true);
      // バットの配置 (キャラクター空間で握りの位置と向き)
      const bat = this.bat;
      if (bat) {
        bat.visible = !!p.bat.on;
        if (p.bat.on) {
          if (bat.parent !== b.root) b.root.add(bat);
          const d = _v1.set(p.bat.d[0], p.bat.d[1], p.bat.d[2]).normalize();
          bat.position.set(p.bat.g[0] - d.x * 0.06, p.bat.g[1] - d.y * 0.06, p.bat.g[2] - d.z * 0.06);
          bat.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), d);
        }
      }
    }

    // 目標ポーズに指数的に近づける (rate: 1/秒)
    drive(target, dt, rate) {
      const k = rate == null ? 1 : 1 - Math.exp(-rate * dt);
      this.apply(lerpPose(this.cur, target, k, this._tmp || (this._tmp = basePose())));
      this.cur = A.copyPose(this._tmp);
    }
  }
  A.Rig = Rig;

  /* ======================================================
   *  ポーズライブラリ
   * ====================================================== */
  const LIB = {};
  A.LIB = LIB;

  LIB.stand = P({
    armL: { t: [0.24, 0.9, 0.04], p: [0.5, 1.1, -0.8] },
    armR: { t: [-0.24, 0.9, 0.04], p: [-0.5, 1.1, -0.8] },
    legL: { t: [0.12, 0.06, 0.01] },
    legR: { t: [-0.12, 0.06, -0.01] },
  });

  // 野手の構え (ややかがんで両手を膝の前)
  LIB.ready = P({
    root: [0, -0.16, -0.04],
    spine: [24, 0, 0],
    chest: [8, 0, 0],
    neck: [-12, 0, 0],
    head: [-14, 0, 0],
    armL: { t: [0.2, 0.62, 0.36], p: [0.6, 0.9, -0.2], h: [-20, 0, 0] },
    armR: { t: [-0.2, 0.64, 0.34], p: [-0.6, 0.9, -0.2], h: [-20, 0, 0] },
    legL: { t: [0.26, 0.06, 0.04], p: [0.5, 0.6, 1], f: [0, 8, 0] },
    legR: { t: [-0.26, 0.06, 0.0], p: [-0.5, 0.6, 1], f: [0, -8, 0] },
  });

  // 捕手の構え
  LIB.crouch = P({
    root: [0, -0.5, -0.06],
    spine: [16, 0, 0],
    chest: [6, 0, 0],
    head: [-18, 0, 0],
    armL: { t: [0.12, 0.85, 0.42], p: [0.6, 0.7, 0], h: [-60, 0, -10] },
    armR: { t: [-0.22, 0.62, 0.15], p: [-0.6, 0.8, -0.3] },
    legL: { t: [0.3, 0.07, 0.08], p: [0.7, 0.4, 1], f: [10, 18, 0] },
    legR: { t: [-0.3, 0.07, 0.04], p: [-0.7, 0.4, 1], f: [10, -18, 0] },
  });

  // 球審
  LIB.umpire = P({
    root: [0, -0.28, -0.05],
    spine: [32, 0, 0],
    chest: [6, 0, 0],
    head: [-26, 0, 0],
    armL: { t: [0.16, 0.95, 0.22], p: [0.7, 1, -0.4] },
    armR: { t: [-0.16, 0.95, 0.22], p: [-0.7, 1, -0.4] },
    legL: { t: [0.32, 0.06, 0.12], p: [0.6, 0.5, 1] },
    legR: { t: [-0.3, 0.06, -0.08], p: [-0.6, 0.5, 1] },
  });
  LIB.umpireStrike = P({
    root: [0, -0.04, 0],
    spine: [4, -10, 0],
    head: [0, -20, 0],
    armL: { t: [0.24, 0.95, 0.06], p: [0.5, 1.1, -0.8] },
    armR: { t: [-0.42, 1.38, 0.2], p: [-0.8, 1.1, -0.5], h: [0, 0, 0] },
    legL: { t: [0.16, 0.06, 0.04] },
    legR: { t: [-0.18, 0.06, -0.04] },
  });

  /* ---------- 打撃 (右打者: 投手は +X 方向, 正面 +Z はホームベース) ---------- */
  const STANCE = {
    root: [-0.04, -0.1, -0.02],
    hips: [0, -8, 0],
    spine: [14, -6, 0],
    chest: [4, -8, 0],
    neck: [-6, 30, 0],
    head: [-4, 46, 4],
    armL: { p: [0.3, 0.9, -0.5], h: [0, 0, 0] },
    armR: { p: [-0.7, 1.0, -0.4], h: [0, 0, 0] },
    legL: { t: [0.36, 0.06, 0.02], p: [0.6, 0.5, 1], f: [0, -10, 0] },
    legR: { t: [-0.3, 0.06, -0.02], p: [-0.5, 0.5, 1], f: [0, -20, 0] },
    bat: { g: [-0.2, 1.38, -0.08], d: [-0.12, 0.92, -0.4], on: 1 },
  };
  LIB.batStance = P(STANCE);
  // 構えの揺れ (バットを小さく回す)
  A.batIdle = function (t) {
    const p = P(STANCE);
    p.bat.d[0] += Math.sin(t * 2.2) * 0.08;
    p.bat.d[2] += Math.cos(t * 2.2) * 0.08;
    p.bat.g[1] += Math.sin(t * 1.1) * 0.01;
    return p;
  };
  // 始動 (足を上げて溜める)
  LIB.batLoad = P(
    Object.assign({}, STANCE, {
      root: [-0.08, -0.08, -0.02],
      hips: [0, -14, 0],
      chest: [4, -14, 0],
      legL: { t: [0.22, 0.16, 0.06], p: [0.4, 0.8, 1], f: [10, -10, 0] },
      bat: { g: [-0.25, 1.36, -0.12], d: [-0.05, 0.85, -0.52], on: 1 },
    })
  );

  /* スイング: contactZ = ミートの高さ (m, 地面から), pull = 引っ張り度 (-1..1) */
  A.swingClip = function (contactZ, pull) {
    const cz = contactZ == null ? 0.8 : contactZ;
    const pl = pull || 0;
    const low = Math.max(0, 0.85 - cz);
    const stride = {
      root: [0.02, -0.16, 0.0],
      hips: [0, -4, 0],
      chest: [6, -10, 0],
      legL: { t: [0.58, 0.06, 0.04], p: [0.8, 0.5, 1], f: [0, 10, 0] },
      legR: { t: [-0.3, 0.06, -0.02], p: [-0.5, 0.5, 1], f: [0, -25, 0] },
      bat: { g: [-0.18, 1.3, -0.12], d: [-0.3, 0.7, -0.62], on: 1 },
    };
    const contact = {
      root: [0.08, -0.17, 0.02],
      hips: [0, 48 + pl * 10, 0],
      spine: [18 + low * 30, 10, 0],
      chest: [6, 14 + pl * 12, -low * 20],
      neck: [-8, 6, 0],
      head: [low * 20, 26 - pl * 10, 0],
      armL: { p: [0.6, 0.6, -0.4], h: [0, 0, 0] },
      armR: { p: [-0.6, 0.6, -0.2], h: [0, 0, 0] },
      legL: { t: [0.6, 0.06, 0.04], p: [0.9, 0.5, 0.6], f: [0, 30, 0] },
      legR: { t: [-0.28, 0.1, -0.02], p: [-0.3, 0.5, 1], f: [20, 30, 0] },
      bat: { g: [0.04 - pl * 0.08, cz + 0.12 + low * 0.25, 0.32], d: [0.18 + pl * 0.75, -0.08 - low * 0.55, 0.95 - Math.abs(pl) * 0.4], on: 1 },
    };
    const follow = {
      root: [0.1, -0.12, 0.02],
      hips: [0, 78, 0],
      spine: [10, 16, 0],
      chest: [0, 28, 0],
      neck: [-4, 2, 0],
      head: [0, 10, 0],
      armL: { p: [0.7, 1.2, 0.2], h: [0, 0, 0] },
      armR: { p: [-0.2, 0.9, 0.6], h: [0, 0, 0] },
      legL: { t: [0.58, 0.06, 0.06], p: [1, 0.5, 0.2], f: [0, 60, 0] },
      legR: { t: [-0.2, 0.14, 0.02], p: [0, 0.5, 1], f: [30, 60, 0] },
      bat: { g: [0.28, 1.42, 0.08], d: [-0.35, 0.45, -0.82], on: 1 },
    };
    return [
      { t: 0, pose: P(STANCE) },
      { t: 0.05, pose: P(Object.assign({}, STANCE, stride)), e: "out" },
      { t: 0.12, pose: P(Object.assign({}, STANCE, contact)), e: "in" },
      { t: 0.3, pose: P(Object.assign({}, STANCE, follow)), e: "out" },
      { t: 0.7, pose: P(Object.assign({}, STANCE, follow)) },
    ];
  };
  A.SWING_CONTACT = 0.12;

  LIB.bunt = P(
    Object.assign({}, STANCE, {
      root: [0.02, -0.22, 0.04],
      hips: [0, 40, 0],
      spine: [20, 20, 0],
      chest: [6, 20, 0],
      head: [-6, 20, 0],
      legL: { t: [0.36, 0.06, 0.12], p: [0.6, 0.5, 1], f: [0, 20, 0] },
      legR: { t: [-0.22, 0.06, 0.2], p: [-0.4, 0.5, 1], f: [0, 40, 0] },
      bat: { g: [-0.12, 1.05, 0.42], d: [0.98, 0.08, 0.1], on: 1 },
    })
  );

  /* ---------- 投球 (右投手: 本塁方向は +X。セットポジションで横向き) ---------- */
  const PSET = {
    root: [0, -0.02, 0],
    spine: [4, 0, 0],
    head: [0, 70, 0],
    armL: { t: [0.06, 1.18, 0.22], p: [0.6, 1.0, -0.2], h: [0, 0, 80] },
    armR: { t: [-0.04, 1.16, 0.2], p: [-0.6, 1.0, -0.2], h: [0, 0, -80] },
    legL: { t: [0.14, 0.06, 0.02], f: [0, 0, 0] },
    legR: { t: [-0.14, 0.06, 0.0], f: [0, 0, 0] },
  };
  LIB.pitchSet = P(PSET);
  A.pitchClip = function () {
    const lift = P(
      Object.assign({}, PSET, {
        root: [-0.04, 0.0, 0],
        hips: [0, -20, 0],
        spine: [0, -10, 0],
        chest: [-4, -10, 0],
        head: [0, 76, 0],
        legL: { t: [0.0, 0.62, 0.22], p: [0.2, 1.2, 1.2], f: [30, 0, 0] },
        legR: { t: [-0.12, 0.06, 0.0], p: [-0.3, 0.5, 1] },
        armL: { t: [0.0, 1.2, 0.26], p: [0.5, 1.2, -0.2], h: [0, 0, 80] },
        armR: { t: [-0.06, 1.18, 0.24], p: [-0.5, 1.2, -0.3], h: [0, 0, -80] },
      })
    );
    const stride = P(
      Object.assign({}, PSET, {
        root: [0.18, -0.18, 0],
        hips: [0, -6, 0],
        spine: [2, -16, -6],
        chest: [0, -16, -4],
        head: [0, 74, 6],
        legL: { t: [0.86, 0.1, 0.06], p: [1.2, 0.6, 1], f: [0, 0, 0] },
        legR: { t: [-0.2, 0.06, 0.0], p: [-0.3, 0.4, 1], f: [0, 0, 0] },
        armL: { t: [0.62, 1.38, 0.1], p: [0.8, 1.3, -0.6], h: [0, 0, 60] },
        armR: { t: [-0.52, 1.5, -0.14], p: [-0.6, 0.9, -0.6], h: [0, 0, -40] },
      })
    );
    const cock = P(
      Object.assign({}, PSET, {
        root: [0.32, -0.22, 0],
        hips: [0, 30, 0],
        spine: [6, 12, -10],
        chest: [-6, 8, -8],
        head: [0, 50, 0],
        legL: { t: [0.86, 0.06, 0.06], p: [1.2, 0.5, 1], f: [0, 20, 0] },
        legR: { t: [-0.16, 0.08, 0.0], p: [-0.2, 0.4, 1], f: [10, 20, 0] },
        armL: { t: [0.5, 1.28, 0.32], p: [0.7, 1.0, -0.2], h: [0, 0, 40] },
        armR: { t: [-0.38, 1.72, -0.12], p: [-0.7, 1.3, -0.5], h: [-20, 0, 0] },
      })
    );
    const release = P(
      Object.assign({}, PSET, {
        root: [0.46, -0.24, 0.04],
        hips: [0, 72, 0],
        spine: [30, 18, 0],
        chest: [16, 14, 0],
        head: [-10, 12, 0],
        legL: { t: [0.88, 0.06, 0.06], p: [1.4, 0.5, 0.5], f: [0, 50, 0] },
        legR: { t: [-0.06, 0.18, -0.05], p: [0.2, 0.5, 1], f: [40, 40, 0] },
        armL: { t: [0.36, 1.05, 0.34], p: [0.8, 1.0, 0.0], h: [0, 0, 0] },
        armR: { t: [0.62, 1.66, 0.12], p: [0.2, 1.8, -0.6], h: [-30, 0, 0] },
      })
    );
    const follow = P(
      Object.assign({}, PSET, {
        root: [0.54, -0.3, 0.1],
        hips: [0, 86, 0],
        spine: [44, 20, 0],
        chest: [14, 10, 0],
        head: [-30, 4, 0],
        legL: { t: [0.86, 0.06, 0.08], p: [1.4, 0.5, 0.2], f: [0, 60, 0] },
        legR: { t: [0.4, 0.3, -0.34], p: [0.6, 0.6, 1], f: [60, 60, 0] },
        armL: { t: [0.3, 0.95, 0.42], p: [0.8, 0.9, 0.2] },
        armR: { t: [0.62, 0.66, 0.42], p: [0.2, 1.0, 0.6], h: [0, 0, 0] },
      })
    );
    const recover = P({
      root: [0.48, -0.14, 0.12],
      yaw: 78,
      spine: [16, 0, 0],
      head: [-8, 0, 0],
      armL: { t: [0.24, 0.92, 0.3], p: [0.6, 0.9, -0.2] },
      armR: { t: [-0.2, 0.86, 0.26], p: [-0.6, 0.9, -0.2] },
      legL: { t: [0.86, 0.06, 0.06], f: [0, 60, 0] },
      legR: { t: [0.5, 0.06, -0.3], f: [0, 60, 0] },
    });
    return [
      { t: 0, pose: P(PSET) },
      { t: 0.32, pose: lift, e: "io" },
      { t: 0.62, pose: stride, e: "io" },
      { t: 0.76, pose: cock, e: "in" },
      { t: 0.86, pose: release, e: "in" },
      { t: 1.02, pose: follow, e: "out" },
      { t: 1.5, pose: recover, e: "io" },
    ];
  };
  A.PITCH_RELEASE = 0.86;

  /* ---------- 送球 (野手。投げる方向は +X) ---------- */
  A.throwClip = function () {
    const set = P({
      yaw: 0,
      root: [0, -0.1, 0],
      spine: [6, -20, 0],
      head: [0, 70, 0],
      armL: { t: [0.3, 1.25, 0.2], p: [0.6, 1.2, -0.4] },
      armR: { t: [-0.3, 1.3, -0.1], p: [-0.6, 1.0, -0.6] },
      legL: { t: [0.36, 0.06, 0.02] },
      legR: { t: [-0.24, 0.06, 0.0] },
    });
    const back = P({
      root: [0.1, -0.14, 0],
      hips: [0, -10, 0],
      spine: [0, -20, -6],
      head: [0, 70, 0],
      armL: { t: [0.55, 1.35, 0.1], p: [0.8, 1.3, -0.6] },
      armR: { t: [-0.5, 1.55, -0.12], p: [-0.7, 1.1, -0.6] },
      legL: { t: [0.62, 0.06, 0.02] },
      legR: { t: [-0.2, 0.06, 0.0] },
    });
    const rel = P({
      root: [0.3, -0.16, 0.02],
      hips: [0, 60, 0],
      spine: [26, 14, 0],
      head: [-6, 16, 0],
      armL: { t: [0.3, 1.0, 0.36], p: [0.8, 1.0, 0.0] },
      armR: { t: [0.62, 1.6, 0.1], p: [0.2, 1.8, -0.6] },
      legL: { t: [0.62, 0.06, 0.04], f: [0, 40, 0] },
      legR: { t: [-0.08, 0.16, -0.04], f: [30, 30, 0] },
    });
    const fol = P({
      root: [0.36, -0.2, 0.06],
      hips: [0, 80, 0],
      spine: [36, 16, 0],
      head: [-20, 6, 0],
      armL: { t: [0.3, 0.95, 0.4], p: [0.8, 0.9, 0.2] },
      armR: { t: [0.58, 0.78, 0.4], p: [0.2, 1.0, 0.6] },
      legL: { t: [0.62, 0.06, 0.04], f: [0, 60, 0] },
      legR: { t: [0.24, 0.22, -0.24], f: [50, 60, 0] },
    });
    return [
      { t: 0, pose: set },
      { t: 0.14, pose: back, e: "io" },
      { t: 0.24, pose: rel, e: "in" },
      { t: 0.42, pose: fol, e: "out" },
    ];
  };
  A.THROW_RELEASE = 0.24;

  /* ---------- 走る (phase: ラジアン, speed: 0..1) ---------- */
  A.run = function (phase, speed, out) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const k = 0.4 + 0.6 * (speed == null ? 1 : speed);
    const p = out || basePose();
    const b = P({
      root: [0, -0.06 - Math.abs(c) * 0.04 * k, 0],
      hips: [0, s * 8 * k, 0],
      spine: [14 * k, -s * 6 * k, 0],
      chest: [4, -s * 10 * k, 0],
      head: [-10 * k, s * 4, 0],
      armL: { t: [0.22, 1.02 + s * 0.12 * k, 0.05 - s * 0.32 * k], p: [0.5, 1.0, -1.2], h: [0, 0, 0] },
      armR: { t: [-0.22, 1.02 - s * 0.12 * k, 0.05 + s * 0.32 * k], p: [-0.5, 1.0, -1.2], h: [0, 0, 0] },
      legL: { t: [0.1, 0.1 + Math.max(0, -c) * 0.3 * k, s * 0.42 * k], p: [0.1, 0.5, 1.2], f: [-s * 20 * k, 0, 0] },
      legR: { t: [-0.1, 0.1 + Math.max(0, c) * 0.3 * k, -s * 0.42 * k], p: [-0.1, 0.5, 1.2], f: [s * 20 * k, 0, 0] },
    });
    return lerpPose(b, b, 0, p);
  };

  // 捕球ポーズ: 手の位置 (キャラクター空間) にグラブを出す
  A.catchPose = function (glovePt, gloveHand, low) {
    const p = P(low ? LIB.ready : LIB.stand);
    const arm = gloveHand === "R" ? "armR" : "armL";
    p[arm].t = glovePt.slice();
    p[arm].p = [glovePt[0] * 2, glovePt[1] + 0.2, glovePt[2] - 0.5];
    p[arm].h = [-70, 0, gloveHand === "R" ? -20 : 20];
    if (glovePt[1] < 0.6) {
      p.root[1] = -0.38;
      p.spine[0] = 44;
      p.legL.t = [0.3, 0.06, 0.1];
      p.legR.t = [-0.3, 0.06, -0.1];
    }
    return p;
  };

  // ダイビング
  LIB.dive = P({
    root: [0, -0.62, 0.2],
    tilt: 72,
    spine: [-10, 0, 0],
    head: [-40, 0, 0],
    armL: { t: [0.18, 1.7, 0.3], p: [0.5, 1.6, -0.4] },
    armR: { t: [-0.2, 1.6, 0.2], p: [-0.5, 1.5, -0.4] },
    legL: { t: [0.14, 0.2, -0.2] },
    legR: { t: [-0.16, 0.3, -0.3] },
  });
  // スライディング (足から)
  LIB.slide = P({
    root: [0, -0.68, -0.1],
    tilt: -28,
    spine: [10, 0, 0],
    head: [-10, 0, 0],
    armL: { t: [0.3, 1.1, -0.2], p: [0.6, 1.2, -0.4] },
    armR: { t: [-0.32, 1.2, -0.1], p: [-0.6, 1.2, -0.4] },
    legL: { t: [0.1, 0.42, 0.62], p: [0.3, 1.2, 0.4], f: [-40, 0, 0] },
    legR: { t: [-0.12, 0.34, 0.4], p: [-0.3, 1.2, 0.4], f: [-30, 0, 0] },
  });
  // ガッツポーズ
  LIB.cheer = P({
    root: [0, -0.04, 0],
    spine: [-6, 0, 0],
    head: [-16, 0, 0],
    armL: { t: [0.32, 1.95, 0.1], p: [0.8, 1.6, -0.5] },
    armR: { t: [-0.3, 1.9, 0.12], p: [-0.8, 1.6, -0.5] },
    legL: { t: [0.16, 0.06, 0.02] },
    legR: { t: [-0.16, 0.06, 0.0] },
  });
  // リード (走者)
  LIB.lead = P({
    root: [0, -0.2, 0],
    spine: [26, 0, 0],
    head: [-20, 0, 0],
    armL: { t: [0.32, 0.72, 0.32], p: [0.7, 0.8, -0.3] },
    armR: { t: [-0.32, 0.72, 0.32], p: [-0.7, 0.8, -0.3] },
    legL: { t: [0.36, 0.06, 0.02] },
    legR: { t: [-0.36, 0.06, 0.0] },
  });

  PB.Anim = A;
})((window.PB = window.PB || {}));
