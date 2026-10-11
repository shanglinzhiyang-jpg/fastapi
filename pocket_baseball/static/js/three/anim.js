/* 熱闘！ポケットベースボール — 3D 選手のポーズとアニメーション
 * ポーズは数値パラメータ (体幹の角度・手足の IK 目標・バットの向き) で表す。
 * クリップはキーの間を 3 次のスプライン (前後のキーも見て、キーで速さが途切れない) でつなぐ。
 * 手足は 2 ボーン IK で目標位置に置く。
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
      // どこから来たポーズか (sample / run / batIdle が付ける)。リグのばねが「同じ動きの続き」かを見分ける
      src: 0, // クリップの番号 (0 = なし)
      st: 0, // そのクリップの時刻 (走りは位相)
      kind: "", // "swing" / "pitch" / "throw" / "run" / "idle"
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
    // 2 つを混ぜたポーズはどのクリップの続きでもない (コピーは元の印を引き継ぐ)
    o.src = a === b ? a.src : 0;
    o.st = a.st;
    o.kind = a === b ? a.kind : "";
    return o;
  }
  A.lerpPose = lerpPose;
  A.copyPose = (p) => lerpPose(p, p, 0);

  /* ---------- ポーズ ⇔ 数値の並び (スプライン・ばねで使う) ----------
   * 0-2 root, 3 yaw, 4 tilt, 5 roll, 6-20 hips/spine/chest/neck/head,
   * 21-29 armL (t,p,h), 30-38 armR, 39-47 legL (t,p,f), 48-56 legR, 57-59 bat.g, 60-62 bat.d */
  const NCH = 63;
  A.NCH = NCH;
  const SLOTS = [
    ["root", null, 0],
    ["hips", null, 6],
    ["spine", null, 9],
    ["chest", null, 12],
    ["neck", null, 15],
    ["head", null, 18],
    ["armL", "t", 21],
    ["armL", "p", 24],
    ["armL", "h", 27],
    ["armR", "t", 30],
    ["armR", "p", 33],
    ["armR", "h", 36],
    ["legL", "t", 39],
    ["legL", "p", 42],
    ["legL", "f", 45],
    ["legR", "t", 48],
    ["legR", "p", 51],
    ["legR", "f", 54],
    ["bat", "g", 57],
    ["bat", "d", 60],
  ];
  // 毎フレーム呼ぶので、分割代入やイテレータを使わない添字のループにする
  const NSL = SLOTS.length;
  const slot = (p, j) => (SLOTS[j][1] ? p[SLOTS[j][0]][SLOTS[j][1]] : p[SLOTS[j][0]]);
  function flat(p, a, o) {
    o = o || 0;
    for (let j = 0; j < NSL; j++) {
      const v = slot(p, j);
      const i = o + SLOTS[j][2];
      a[i] = v[0];
      a[i + 1] = v[1];
      a[i + 2] = v[2];
    }
    a[o + 3] = p.yaw;
    a[o + 4] = p.tilt;
    a[o + 5] = p.roll;
    return a;
  }
  function unflat(a, p) {
    for (let j = 0; j < NSL; j++) {
      const v = slot(p, j);
      const i = SLOTS[j][2];
      v[0] = a[i];
      v[1] = a[i + 1];
      v[2] = a[i + 2];
    }
    p.yaw = a[3];
    p.tilt = a[4];
    p.roll = a[5];
    return p;
  }
  A.flat = flat;
  A.unflat = unflat;
  // 並びの種類: 0 = 位置 (m), 1 = 角度 (度), 2 = バットの向き (単位ベクトル)
  A.CH_KIND = (() => {
    const k = new Uint8Array(NCH);
    for (let c = 3; c < 21; c++) k[c] = 1;
    for (const c0 of [27, 36, 45, 54]) for (let c = c0; c < c0 + 3; c++) k[c] = 1;
    for (let c = 60; c < 63; c++) k[c] = 2;
    return k;
  })();

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
    m.src = p.src;
    m.st = p.st;
    m.kind = p.kind;
    return m;
  }
  A.mirror = mirror;

  /* ---------- キーフレーム ----------
   * clip: [{t, pose, e, v}]  e = そのキーに入る区間の緩急 (lin / io / in / out), v = キーを通る速さ (省略可)
   * 各数値は前後のキーも見た 3 次エルミート補間 (単調な所ははみ出さず、折り返すキーでは止まる)。
   * 緩急は「時間のゆがみ」として扱う: キーでの速さの倍率 r を前後の区間の緩急から決め、
   * 区間内の時間を r をつないだ 3 次式でゆがめる。キーの時刻とポーズはそのまま (ミートやリリースの瞬間は変わらない)。 */
  // 緩急ごとの区間の始め・終わりの速さ (平均の何倍か)。t*t*(3-2t) / t*t / 1-(1-t)^2 と同じ
  const EASE_V = { lin: [1, 1], io: [0, 0], in: [0, 2], out: [2, 0] };
  const easeV = (e, end) => (EASE_V[e] || EASE_V.io)[end];
  const PREP = new WeakMap();
  let clipSeq = 0;
  // はみ出さないように補間する数値 (腰の高さ・足首の目標)
  const STRICT = new Uint8Array(NCH);
  for (const c of [1, 39, 40, 41, 48, 49, 50]) STRICT[c] = 1;
  const TAU = Math.PI * 2;
  // クリップの前処理 (キーの数値・接線・速さ)。クリップは作ったあと書き換えない前提で、最初に使うときに一度だけ作る
  function prep(clip) {
    let S = PREP.get(clip);
    if (S && S.n === clip.length) return S;
    const n = clip.length;
    const ts = new Float64Array(n);
    const r = new Float64Array(n);
    const y = new Float64Array(n * NCH);
    const m = new Float64Array(n * NCH);
    const on = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      ts[k] = clip[k].t;
      flat(clip[k].pose, y, k * NCH);
      on[k] = clip[k].pose.bat.on ? 1 : 0;
      // バットの向きは (方位, 仰角) にして補間する。ベクトルのままだと振り抜きで逆回りして一瞬まっすぐ立つ
      const i = k * NCH + 60;
      const h = Math.hypot(y[i], y[i + 2]);
      let az = h > 1e-3 ? Math.atan2(y[i], y[i + 2]) : k ? y[i - NCH] : 0;
      const el = Math.atan2(y[i + 1], h);
      if (k) {
        // 前のキーから近い向きへ。ただし半周近く回るときは、それまで回っていた向きを続ける
        const pa = y[i - NCH];
        let d = Math.atan2(Math.sin(az - pa), Math.cos(az - pa));
        const pd = k > 1 ? pa - y[i - 2 * NCH] : 0;
        if (Math.abs(d) > 2.6 && pd * d < 0) d += d < 0 ? TAU : -TAU;
        az = pa + d;
      }
      y[i] = az;
      y[i + 1] = el;
      y[i + 2] = 0;
    }
    // キーでの時間の速さ (前後の区間の緩急の平均。途中のキーで止まりきらないよう下限を置く。v で指定もできる)
    for (let k = 0; k < n; k++) {
      const vin = k > 0 ? easeV(clip[k].e, 1) : null;
      const vout = k < n - 1 ? easeV(clip[k + 1].e, 0) : null;
      let v = vin == null ? vout : vout == null ? vin : Math.max(0.6, (vin + vout) / 2);
      if (clip[k].v != null) v = clip[k].v;
      r[k] = Math.min(3, Math.max(0, v == null ? 1 : v));
    }
    // 接線 (時間あたりの変化) = 前後の傾きの重み付き平均 (Catmull-Rom と同じ考え)。
    // 前後どちらかと同じポーズ (止める) のキーでは 0。足の目標・腰の高さは、はみ出すと地面にめり込むので
    // 折り返し・平らな所で 0 にして単調に保つ。ほかは少しはみ出してよい (振り抜きの勢いが残る)
    const same = (a, b) => {
      for (let c = 0; c < NCH; c++) if (Math.abs(y[a * NCH + c] - y[b * NCH + c]) > 1e-6) return false;
      return true;
    };
    for (let k = 1; k < n - 1; k++) {
      if (same(k, k - 1) || same(k, k + 1)) continue;
      const d0 = Math.max(1e-4, ts[k] - ts[k - 1]);
      const d1 = Math.max(1e-4, ts[k + 1] - ts[k]);
      for (let c = 0; c < NCH; c++) {
        const s0 = (y[k * NCH + c] - y[(k - 1) * NCH + c]) / d0;
        const s1 = (y[(k + 1) * NCH + c] - y[k * NCH + c]) / d1;
        let mk = (s0 * d1 + s1 * d0) / (d0 + d1);
        if (STRICT[c]) {
          if (s0 * s1 <= 0) mk = 0;
          else {
            const lim = 3 * Math.min(Math.abs(s0), Math.abs(s1));
            if (Math.abs(mk) > lim) mk = mk > 0 ? lim : -lim;
          }
        }
        m[k * NCH + c] = mk;
      }
    }
    // 最初と最後のキーは止まっている (前後の構えから / 構えへ)
    S = { n, ts, r, y, m, on, id: ++clipSeq };
    PREP.set(clip, S);
    return S;
  }
  const _f = new Float64Array(NCH);
  function sample(clip, t, out) {
    const S = prep(clip);
    const o = out || basePose();
    const n = S.n;
    const y = S.y;
    const f = _f;
    let on;
    if (n === 1 || t <= S.ts[0] || t >= S.ts[n - 1]) {
      const k = n === 1 || t <= S.ts[0] ? 0 : n - 1;
      for (let c = 0; c < NCH; c++) f[c] = y[k * NCH + c];
      on = S.on[k];
    } else {
      let i = 0;
      while (i < n - 2 && t > S.ts[i + 1]) i++;
      const D = S.ts[i + 1] - S.ts[i];
      const u = D > 1e-6 ? (t - S.ts[i]) / D : 1;
      // 時間のゆがみ: s(0)=0, s(1)=1, 傾きはキーの速さ r
      const a = S.r[i];
      const b = S.r[i + 1];
      const s = ((a + b - 2) * u + (3 - 2 * a - b)) * u * u + a * u;
      const s2 = s * s;
      const s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1;
      const h10 = (s3 - 2 * s2 + s) * D;
      const h01 = 3 * s2 - 2 * s3;
      const h11 = (s3 - s2) * D;
      const o0 = i * NCH;
      const o1 = o0 + NCH;
      const m = S.m;
      for (let c = 0; c < NCH; c++) f[c] = h00 * y[o0 + c] + h10 * m[o0 + c] + h01 * y[o1 + c] + h11 * m[o1 + c];
      on = s < 0.5 ? S.on[i] : S.on[i + 1];
    }
    // バットの向きをベクトルに戻す
    const az = f[60];
    const el = f[61];
    f[60] = Math.cos(el) * Math.sin(az);
    f[61] = Math.sin(el);
    f[62] = Math.cos(el) * Math.cos(az);
    unflat(f, o);
    o.bat.on = on;
    o.src = S.id;
    o.st = t;
    o.kind = clip.kind || "";
    return o;
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

  // クリップに種類の名前を付ける (リグが「スイング中は視線を動かさない」などに使う)
  function withKind(kind, clip) {
    clip.kind = kind;
    return clip;
  }

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
    p.src = -2;
    p.st = t;
    p.kind = "idle";
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
    // 踏み込み: 腰が先に開き始め、肩は閉じたまま (腰と肩のねじれ ≒ 28°)
    const stride = {
      root: [0.02, -0.16, 0.0],
      hips: [0, 6, 0],
      spine: [14, -10, 0],
      chest: [6, -18, 0],
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
    return withKind("swing", [
      { t: 0, pose: P(STANCE) },
      { t: 0.05, pose: P(Object.assign({}, STANCE, stride)), e: "out" },
      { t: 0.12, pose: P(Object.assign({}, STANCE, contact)), e: "in" },
      { t: 0.3, pose: P(Object.assign({}, STANCE, follow)), e: "out" },
      { t: 0.7, pose: P(Object.assign({}, STANCE, follow)) },
    ]);
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
    return withKind("pitch", [
      { t: 0, pose: P(PSET) },
      { t: 0.32, pose: lift, e: "io" },
      { t: 0.62, pose: stride, e: "io" },
      { t: 0.76, pose: cock, e: "in" },
      { t: 0.86, pose: release, e: "in" },
      { t: 1.02, pose: follow, e: "out" },
      { t: 1.5, pose: recover, e: "io" },
    ]);
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
    return withKind("throw", [
      { t: 0, pose: set },
      { t: 0.14, pose: back, e: "io" },
      { t: 0.24, pose: rel, e: "in" },
      { t: 0.42, pose: fol, e: "out" },
    ]);
  };
  A.THROW_RELEASE = 0.24;

  /* ---------- 走る (phase: ラジアン, speed: 0..1) ----------
   * view.js は 1 周期 (2π) で A.RUN_STRIDE (3.3 m) 進める。接地している足はキャラクター空間で同じ速さで
   * 後ろへ動かす (= 地面の上では止まっていて滑らない)。接地は 1 周期の RUN_DUTY、
   * 残りは足を前へ戻す (はじめにかかとを引き上げ、着地の前に下ろす)。 */
  A.RUN_STRIDE = 3.3;
  const RUN_DUTY = 0.27;
  const RUN_S = RUN_DUTY * A.RUN_STRIDE; // 接地のあいだに体が進む距離
  const RUN_Z0 = RUN_S * 0.4; // 着地の位置 (腰より前)
  const RUN_LIFT = 0.06 + 0.45 * 0.24; // 蹴り出したときの足首の高さ
  const RUN_BASE = P({
    armL: { p: [0.5, 1.0, -1.2], h: [0, 0, 0] },
    armR: { p: [-0.5, 1.0, -1.2], h: [0, 0, 0] },
    legL: { t: [0.1, 0.06, 0], p: [0.1, 0.5, 1.2] },
    legR: { t: [-0.1, 0.06, 0], p: [-0.1, 0.5, 1.2] },
  });
  // 片足の目標 (ph: 0..1, 0 = 着地)
  function runFoot(ph, k, t, f) {
    if (ph < RUN_DUTY) {
      const u = ph / RUN_DUTY;
      t[2] = RUN_Z0 - u * RUN_S;
      t[1] = 0.06 + Math.max(0, u - 0.55) * 0.24; // 蹴り出しでかかとが上がる
      f[0] = -6 + u * u * 40; // かかとから着いて、つま先で蹴る
    } else {
      const u = (ph - RUN_DUTY) / (1 - RUN_DUTY);
      const e = u * u * (3 - 2 * u);
      t[2] = RUN_Z0 - RUN_S + RUN_S * e;
      t[1] = RUN_LIFT + (0.06 - RUN_LIFT) * u + (0.12 + 0.26 * k) * Math.sin(Math.PI * Math.pow(u, 0.75));
      f[0] = 34 - 40 * e;
    }
  }
  A.run = function (phase, speed, out) {
    const k = 0.4 + 0.6 * (speed == null ? 1 : speed);
    const p = lerpPose(RUN_BASE, RUN_BASE, 0, out);
    const ph = (((phase || 0) / TAU) % 1 + 1) % 1;
    runFoot(ph, k, p.legL.t, p.legL.f);
    runFoot((ph + 0.5) % 1, k, p.legR.t, p.legR.f);
    // a: 左脚が前で +1。腰は前に出た脚の側が前へ、肩は逆に回り、腕は脚と逆に振る
    const a = Math.cos(TAU * (ph + 0.06));
    // 上下動: 接地の中ほどでいちばん低く、宙に浮いたときに高い (1 周期に 2 回)
    const bob = Math.cos(2 * TAU * (ph - RUN_DUTY / 2));
    p.root[1] = -0.05 - 0.03 * k - 0.025 * k * bob;
    p.hips[1] = -8 * k * a;
    p.spine[0] = 6 + 12 * k;
    p.spine[1] = 4 * k * a;
    p.chest[0] = 4;
    p.chest[1] = 8 * k * a;
    p.neck[1] = -2 * k * a;
    p.head[0] = -(4 + 12 * k);
    p.head[1] = -2 * k * a;
    const L = p.armL.t;
    const R = p.armR.t;
    L[0] = 0.21;
    L[1] = 1.0 - 0.12 * k * a;
    L[2] = 0.06 - 0.3 * k * a;
    R[0] = -0.21;
    R[1] = 1.0 + 0.12 * k * a;
    R[2] = 0.06 + 0.3 * k * a;
    p.src = -1;
    p.st = phase || 0;
    p.kind = "run";
    return p;
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
