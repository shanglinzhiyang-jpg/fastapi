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
      // th: 上の手の位置 (握りからバットに沿った距離 m。バントは 0.36)
      bat: { g: [-0.2, 1.4, -0.05], d: [-0.2, 0.9, -0.4], on: 0, th: 0.085 },
      // どこから来たポーズか (sample / run / batIdle が付ける)。リグのばねが「同じ動きの続き」かを見分ける
      src: 0, // クリップの番号 (0 = なし)
      st: 0, // そのクリップの時刻 (走りは位相)
      kind: "", // "swing" / "pitch" / "throw" / "run" / "idle"
      name: "", // 登録したクリップの名前 (A.get のクリップを sample したとき)
      flags: null, // クリップの印 (events) で決まる切り替え (A.sample が付ける。昔のクリップは null)
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
    o.bat.th = L(a.bat.th == null ? 0.085 : a.bat.th, b.bat.th == null ? 0.085 : b.bat.th);
    // 2 つを混ぜたポーズはどのクリップの続きでもない (コピーは元の印を引き継ぐ)
    o.src = a === b ? a.src : 0;
    o.st = a.st;
    o.kind = a === b ? a.kind : "";
    o.name = a === b ? a.name || "" : "";
    return o;
  }
  A.lerpPose = lerpPose;
  A.copyPose = (p) => lerpPose(p, p, 0);

  /* ---------- ポーズ ⇔ 数値の並び (スプライン・ばねで使う) ----------
   * 0-2 root, 3 yaw, 4 tilt, 5 roll, 6-20 hips/spine/chest/neck/head,
   * 21-29 armL (t,p,h), 30-38 armR, 39-47 legL (t,p,f), 48-56 legR, 57-59 bat.g, 60-62 bat.d, 63 bat.th */
  const NCH = 64;
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
    a[o + 63] = p.bat.th == null ? 0.085 : p.bat.th;
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
    p.bat.th = a[63];
    return p;
  }
  A.flat = flat;
  A.unflat = unflat;
  // 並びの種類: 0 = 位置 (m), 1 = 角度 (度), 2 = バットの向き (単位ベクトル)。63 (上の手の位置) は 0
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
    m.bat = { g: mx(p.bat.g), d: mx(p.bat.d), on: p.bat.on, th: p.bat.th == null ? 0.085 : p.bat.th };
    m.src = p.src;
    m.st = p.st;
    m.kind = p.kind;
    m.name = p.name || "";
    m.flags = p.flags || null;
    return m;
  }
  A.mirror = mirror;

  /* ---------- 頭の向き ----------
   * 体幹 (腰→背→胸) がどう回っていても、首と頭で頭をキャラクター空間の (方位 yaw, 仰角 pitch) に向ける (度, 下向きが正)。
   * 胸に対する回転を首 40%・頭 60% に分ける。胸に対して左右 ±88°・上下 -50°〜+55° まで。
   * スイング・投球・送球のキーに使う: 体が回ってもミートの点・捕手から目を離さない (頭は体に連れ回らない) */
  const _hq = new T.Quaternion();
  const _hc = new T.Quaternion();
  const _hr = new T.Quaternion();
  const _hn = new T.Quaternion();
  const _he = new T.Euler();
  const _hI = new T.Quaternion();
  const clampD = (v, a, b) => (v < a ? a : v > b ? b : v);
  function headTo(p, yaw, pitch) {
    const E = (v, k) => _he.set(v[0] * D2R * k, v[1] * D2R * k, v[2] * D2R * k, "YXZ");
    // 胸の向き (リグは背骨の角度を 2 つの骨に半分ずつ掛ける)
    _hc.setFromEuler(E(p.hips, 1));
    _hc.multiply(_hq.setFromEuler(E(p.spine, 0.5)));
    _hc.multiply(_hq.setFromEuler(E(p.spine, 0.5)));
    _hc.multiply(_hq.setFromEuler(E(p.chest, 1)));
    // 目標の向き → 胸に対する回転 (角度を制限)
    _hq.setFromEuler(_he.set(pitch * D2R, yaw * D2R, 0, "YXZ"));
    _hr.copy(_hc).invert().multiply(_hq);
    _he.setFromQuaternion(_hr, "YXZ");
    _he.x = clampD(_he.x, -50 * D2R, 55 * D2R);
    _he.y = clampD(_he.y, -88 * D2R, 88 * D2R);
    _he.z = clampD(_he.z, -20 * D2R, 20 * D2R);
    _hr.setFromEuler(_he);
    // 首 40%、残りを頭
    _hn.copy(_hI).slerp(_hr, 0.4);
    _he.setFromQuaternion(_hn, "YXZ");
    p.neck = [_he.x / D2R, _he.y / D2R, _he.z / D2R];
    _hq.copy(_hn).invert().multiply(_hr);
    _he.setFromQuaternion(_hq, "YXZ");
    p.head = [_he.x / D2R, _he.y / D2R, _he.z / D2R];
    return p;
  }
  A.headTo = headTo;

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
    // 新しい形のクリップ (印・切り替えあり): 切り替え (events) を時刻順に重ねて flags に書く
    if (clip.marks || clip.events || clip.name) {
      const F = o.flags || (o.flags = newFlags());
      resetFlags(F, clip.init);
      const ev = clip.events;
      if (ev) {
        for (let i = 0; i < ev.length && ev[i].t <= t + 1e-9; i++) {
          setFlags(F, ev[i].set);
          if (ev[i].spawn) F.spawn = ev[i].spawn;
          F.fired.push(i);
        }
      }
      if (F.batOn != null) o.bat.on = F.batOn ? 1 : 0;
      if (F.kind) o.kind = F.kind;
      o.name = clip.name || "";
    } else {
      o.name = "";
      if (o.flags) o.flags = null;
    }
    return o;
  }
  A.sample = sample;
  // flags: batOn (null = キーのまま) / batOne (下の手だけで持つ) / ballHand ('glove'|'throw'|'none') / kind / spawn / fired (起きた events の番号)
  // effort / smile / noBlink は表情用 (第 3 段以降で使う)
  function newFlags() {
    return { batOn: null, batOne: 0, ballHand: "none", kind: null, spawn: null, fired: [], effort: 0, smile: 0, noBlink: false };
  }
  function resetFlags(F, init) {
    F.batOn = null;
    F.batOne = 0;
    F.ballHand = "none";
    F.kind = null;
    F.spawn = null;
    F.fired.length = 0;
    F.effort = 0;
    F.smile = 0;
    F.noBlink = false;
    if (init) setFlags(F, init);
  }
  function setFlags(F, s) {
    for (const k in s) F[k] = s[k];
  }
  A.newFlags = newFlags;
  A.resetFlags = resetFlags;
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
  // 始動 (足を上げて溜める)。肩が閉じても頭は投手に向けたまま
  LIB.batLoad = headTo(
    P(
      Object.assign({}, STANCE, {
        root: [-0.08, -0.08, -0.02],
        hips: [0, -14, 0],
        chest: [4, -14, 0],
        legL: { t: [0.22, 0.16, 0.06], p: [0.4, 0.8, 1], f: [10, -10, 0] },
        bat: { g: [-0.25, 1.36, -0.12], d: [-0.05, 0.85, -0.52], on: 1 },
      })
    ),
    55,
    1
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
    // 頭は体に連れ回らない: ミートではボール (ベースの上) を見下ろし、振り抜いたら打球の方 (引っ張ればその側) を見送る
    const kContact = headTo(P(Object.assign({}, STANCE, contact)), 24 - pl * 6, 30 + low * 22);
    const kFollow = headTo(P(Object.assign({}, STANCE, follow)), 80 + pl * 30, -6);
    return withKind("swing", [
      { t: 0, pose: P(STANCE) },
      { t: 0.05, pose: P(Object.assign({}, STANCE, stride)), e: "out" },
      { t: 0.12, pose: kContact, e: "in" },
      { t: 0.3, pose: kFollow, e: "out" },
      { t: 0.7, pose: A.copyPose(kFollow) },
    ]);
  };
  A.SWING_CONTACT = 0.12;

  // バント (頭は投手の方)
  LIB.bunt = headTo(
    P(
      Object.assign({}, STANCE, {
        root: [0.02, -0.22, 0.04],
        hips: [0, 40, 0],
        spine: [20, 20, 0],
        chest: [6, 20, 0],
        legL: { t: [0.36, 0.06, 0.12], p: [0.6, 0.5, 1], f: [0, 20, 0] },
        legR: { t: [-0.22, 0.06, 0.2], p: [-0.4, 0.5, 1], f: [0, 40, 0] },
        bat: { g: [-0.12, 1.05, 0.42], d: [0.98, 0.08, 0.1], on: 1 },
      })
    ),
    86,
    6
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
    // 頭は捕手 (+X) から離さない: 足を上げて肩が閉じても首の限界まで向け、リリース〜フォローでは少し見下ろす
    headTo(lift, 78, 2);
    headTo(stride, 82, 6);
    headTo(cock, 88, 8);
    headTo(release, 92, 20);
    headTo(follow, 94, 30);
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
    // 頭は投げる相手 (+X) に向けたまま
    headTo(set, 72, 2);
    headTo(back, 76, 4);
    headTo(rel, 90, 12);
    headTo(fol, 92, 18);
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

  /* ======================================================
   *  第 2 段: 時刻合わせ・クリップの登録・重ね合わせ・作るための道具・走り v2
   *  (ここまでの LIB / swingClip / pitchClip / throwClip / run / batIdle は今の試合用にそのまま残す)
   * ====================================================== */
  const clampV = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => {
    const u = clampV((x - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  };
  const nowMs = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  // 開発時 (Node の点検 / ?dev=1) だけクリップを作るたびに点検する
  const DEV = typeof location === "undefined" || /[?&]dev=1/.test(String(location.search || ""));
  A.DEV = DEV;

  /* ---------- 時刻合わせ ----------
   * syncs: [[印の名前 | クリップの時刻, 試合の時刻], ...] (試合の時刻の順)。now の時のクリップの時刻を返す。
   * 最初の合わせ目より前と最後より後は実時間、合わせ目の間は直線で伸び縮みさせる */
  const markT = (clip, m) => (typeof m === "number" ? m : clip.marks[m]);
  A.timeAt = function (clip, syncs, now) {
    const n = syncs.length;
    if (now <= syncs[0][1]) return Math.max(0, markT(clip, syncs[0][0]) - (syncs[0][1] - now));
    for (let i = 0; i < n - 1; i++) {
      if (now <= syncs[i + 1][1]) {
        const e0 = syncs[i][1];
        const l0 = markT(clip, syncs[i][0]);
        const l1 = markT(clip, syncs[i + 1][0]);
        return l0 + ((l1 - l0) * (now - e0)) / Math.max(1e-4, syncs[i + 1][1] - e0);
      }
    }
    return markT(clip, syncs[n - 1][0]) + (now - syncs[n - 1][1]);
  };
  // tTrig に始めたクリップの印 mark を tMark に合わせる。間に合うなら遅れて始め (伸び縮みなし)、
  // 足りなければ印より前を縮める (印の直前 keepReal 秒は実時間のまま)。out を渡すと配列を使い回す
  function putSync(r, i, a, b) {
    const e = r[i] || (r[i] = [0, 0]);
    e[0] = a;
    e[1] = b;
  }
  A.syncFrom = function (clip, mark, tTrig, tMark, opt, out) {
    const M = clip.marks[mark];
    const avail = tMark - tTrig;
    const keep = (opt && opt.keepReal) || 0;
    const r = out || [];
    if (avail >= M) {
      putSync(r, 0, mark, tMark);
      r.length = 1;
    } else if (keep > 0 && keep < M && avail > keep + 0.05) {
      putSync(r, 0, 0, tTrig);
      putSync(r, 1, M - keep, tMark - keep);
      putSync(r, 2, mark, tMark);
      r.length = 3;
    } else {
      putSync(r, 0, 0, tTrig);
      putSync(r, 1, mark, tMark);
      r.length = 2;
    }
    return r;
  };
  // 役者ごとのクリップの時刻 (戻らない): 合わせ目が後から変わっても同じクリップのあいだは時刻を減らさない。
  // mem = {clip, local}。syncs が無ければ now をそのままクリップの時刻にする
  A.local = function (mem, clip, syncs, now) {
    let t = syncs && syncs.length ? A.timeAt(clip, syncs, now) : now;
    if (mem.clip !== clip) mem.clip = clip;
    else if (t < mem.local) t = mem.local;
    mem.local = t;
    return t;
  };

  /* ---------- クリップの登録 ----------
   * A.def(name, build(params) → clip, keyFn?) で作り方を登録し、A.get(name, params) で作る (最近使った 256 個を覚える)。
   * 鍵は params を丸めた値 (長さ 0.05 m・ボールの位置 0.02 m・角度 5°・比 0.1)。作るのも丸めた値で作るので、同じ鍵なら同じクリップになる。
   * key を持つ値 (A.style の結果) は丸めずに key で見分ける */
  const DEFS = {};
  const CACHE = new Map();
  A.CACHE_MAX = 256;
  A.stats = { hit: 0, miss: 0, ms: 0, maxMs: 0 };
  const QANG = /^(az|below|phi|yaw|deg|ang|open|batTilt|batAz|tilt|roll|turn)$/;
  const QRATIO = /^(power|crouch|lift|pause|uppercut|waggle|w|k|early)$/;
  // ボール・ミートの点は 2 cm (グラブ・バットの芯がボールからずれて見えないように)
  const QFINE = /^(S|ball|aim|pocket|bag)$/;
  function qv(k, v, parts) {
    if (typeof v === "number") {
      const q = QANG.test(k) ? 5 : QRATIO.test(k) ? 0.1 : QFINE.test(k) ? 0.02 : 0.05;
      const s = (Math.round(v / q) * q).toFixed(q < 0.1 ? 2 : q < 1 ? 1 : 0);
      parts.push(s);
      return +s;
    }
    if (Array.isArray(v)) return v.map((x) => qv(k, x, parts));
    if (v && typeof v === "object") {
      if (v.key) {
        parts.push(v.key);
        return v;
      }
      const o = {};
      for (const kk of Object.keys(v).sort()) {
        parts.push(kk);
        o[kk] = qv(kk, v[kk], parts);
      }
      return o;
    }
    parts.push(String(v));
    return v;
  }
  A.def = function (name, build, keyFn) {
    DEFS[name] = { build, keyFn: keyFn || null };
    return name;
  };
  A.defined = (name) => !!DEFS[name];
  A.clipNames = () => Object.keys(DEFS);
  A.get = function (name, params) {
    const D = DEFS[name];
    if (!D) throw new Error("A.get: unknown clip " + name);
    let p = params || {};
    let key;
    if (D.keyFn) key = name + "|" + D.keyFn(p);
    else {
      const parts = [];
      p = qv("", p, parts);
      key = name + "|" + parts.join(",");
    }
    let c = CACHE.get(key);
    if (c) {
      CACHE.delete(key);
      CACHE.set(key, c);
      A.stats.hit++;
      return c;
    }
    const t0 = nowMs();
    c = D.build(p);
    if (!c.name) c.name = name;
    if (!c.marks) c.marks = {};
    c.key = key;
    const ms = nowMs() - t0;
    A.stats.miss++;
    A.stats.ms += ms;
    if (ms > A.stats.maxMs) A.stats.maxMs = ms;
    if (DEV) A.validate(c, true);
    CACHE.set(key, c);
    if (CACHE.size > A.CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    return c;
  };
  A.clearCache = () => CACHE.clear();
  A.cacheSize = () => CACHE.size;

  // クリップの点検: 違うポーズのキーが 0.03 秒より近い (エルミートの接線が暴れる) / 印・切り替えの時刻が範囲外 → エラー。
  // 手首・足首の角度が 1 つのキーで 180° を超えて変わる (手首が回って見える) → 注意
  const _va = new Float64Array(NCH);
  const _vb = new Float64Array(NCH);
  const EUL = [
    ["armL", "h"],
    ["armR", "h"],
    ["legL", "f"],
    ["legR", "f"],
  ];
  A.validate = function (clip, strict) {
    const errors = [];
    const warns = [];
    const n = clip.length;
    const end = clip[n - 1].t;
    for (let i = 1; i < n; i++) {
      const dt = clip[i].t - clip[i - 1].t;
      if (dt < 0) errors.push("keys " + (i - 1) + "/" + i + " out of order");
      flat(clip[i - 1].pose, _va);
      flat(clip[i].pose, _vb);
      let diff = false;
      for (let c = 0; c < NCH; c++) if (Math.abs(_va[c] - _vb[c]) > 1e-6) diff = true;
      if (diff && dt < 0.03) errors.push("keys " + (i - 1) + "/" + i + " differ but are " + dt.toFixed(3) + " s apart");
      for (const [s, k] of EUL) {
        const a = clip[i - 1].pose[s][k];
        const b = clip[i].pose[s][k];
        for (let j = 0; j < 3; j++) if (Math.abs(b[j] - a[j]) > 180) warns.push(s + "." + k + "[" + j + "] jumps " + Math.round(b[j] - a[j]) + "° at key " + i);
      }
    }
    const M = clip.marks || {};
    for (const m in M) if (!(M[m] >= -1e-9 && M[m] <= end + 1e-9)) errors.push("mark " + m + "=" + M[m] + " outside [0," + end + "]");
    for (const e of clip.events || []) if (!(e.t >= -1e-9 && e.t <= end + 1e-9)) errors.push("event at " + e.t + " outside [0," + end + "]");
    if (strict && errors.length) throw new Error((clip.name || "clip") + ": " + errors.join("; "));
    return { errors, warns };
  };

  // 左右反転したクリップ (覚えておく)。キーは A.mirror、印・切り替え・leadZ はそのまま、名前は name+"~m"
  const MIRC = new WeakMap();
  const mirTarget = (g) => Object.assign({}, g, { hand: g.hand === "L" ? "R" : g.hand === "R" ? "L" : g.hand, p: [-g.p[0], g.p[1], g.p[2]] });
  A.mirrorClip = function (clip) {
    let m = MIRC.get(clip);
    if (m) return m;
    m = clip.map((k) => ({ t: k.t, pose: mirror(k.pose), e: k.e, v: k.v }));
    for (const f of ["kind", "marks", "events", "init", "mask"]) if (clip[f] !== undefined) m[f] = clip[f];
    if (clip.leadZ) m.leadZ = clip.leadZ.map((r) => r.slice());
    if (clip.anchor) m.anchor = [-clip.anchor[0], clip.anchor[1], clip.anchor[2]];
    if (clip.target) m.target = mirTarget(clip.target);
    if (clip.bag) m.bag = [-clip.bag[0], clip.bag[1], clip.bag[2]];
    m.name = (clip.name || "") + "~m";
    if (clip.key) m.key = clip.key + "~m";
    m.mirrored = !clip.mirrored;
    MIRC.set(clip, m);
    MIRC.set(m, clip);
    return m;
  };

  /* ---------- 重ね合わせ ----------
   * MASK: 数値ごとの重み。upper = 背骨 (半分)・胸・首・頭・腕・バット、lower = 腰の位置・体の向き・腰・脚 (背骨は半分)
   * A.layer(base, layer, mask, w, out): out = base + (layer − base)·w·mask (バットの向きは長さ 1 に直す)。
   *   バット・印・ばねの続き (src) は重みの大きい方から
   * A.addDelta(base, pose, ref, w, out, mask?): out = base + (pose − ref)·w (バットの向きは base のまま)。ガッツポーズ・首振りなど */
  A.MASK = (() => {
    const full = new Float32Array(NCH).fill(1);
    const upper = new Float32Array(NCH);
    for (let c = 9; c < 12; c++) upper[c] = 0.5;
    for (let c = 12; c < 39; c++) upper[c] = 1;
    for (let c = 57; c < NCH; c++) upper[c] = 1;
    const lower = new Float32Array(NCH);
    for (let c = 0; c < NCH; c++) lower[c] = 1 - upper[c];
    return { full, upper, lower };
  })();
  const _la = new Float64Array(NCH);
  const _lb = new Float64Array(NCH);
  const _lc = new Float64Array(NCH);
  function normBat(a) {
    const n = Math.hypot(a[60], a[61], a[62]) || 1;
    a[60] /= n;
    a[61] /= n;
    a[62] /= n;
  }
  function tagFrom(o, s) {
    o.src = s.src;
    o.st = s.st;
    o.kind = s.kind;
    o.name = s.name || "";
    o.flags = s.flags || null;
  }
  A.layer = function (base, layer, mask, w, out) {
    const o = out || basePose();
    const M = typeof mask === "string" ? A.MASK[mask] : mask || A.MASK.full;
    flat(base, _la);
    flat(layer, _lb);
    for (let c = 0; c < NCH; c++) _la[c] += (_lb[c] - _la[c]) * w * M[c];
    normBat(_la);
    const on = (w * M[57] >= 0.5 ? layer : base).bat.on;
    const dom = w >= 0.5 ? layer : base;
    unflat(_la, o);
    o.bat.on = on;
    tagFrom(o, dom);
    return o;
  };
  A.addDelta = function (base, pose, ref, w, out, mask) {
    const o = out || basePose();
    const M = typeof mask === "string" ? A.MASK[mask] : mask || A.MASK.full;
    flat(base, _la);
    flat(pose, _lb);
    flat(ref, _lc);
    for (let c = 0; c < NCH; c++) if (c < 60 || c > 62) _la[c] += (_lb[c] - _lc[c]) * w * M[c];
    const on = base.bat.on;
    unflat(_la, o);
    o.bat.on = on;
    if (o !== base) tagFrom(o, base);
    return o;
  };

  /* ---------- クリップを作るための道具 ----------
   * A.M(base, over): base の写しに over を深く重ねる (Object.assign では腕・脚のまとまりごと置き換わってしまう)
   * A.seq(base, steps): steps = [{t, over | abs, e, v, name, head:[方位, 下向き]}]。各キーは 1 つ前のキーに over を重ねる
   * A.clip(kind, keys, marks, extra): クリップにする (events は時刻順に並べ、手首・足首の角度を前のキーに続ける) */
  function deepMerge(dst, src) {
    for (const k in src) {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
        if (!dst[k] || typeof dst[k] !== "object") dst[k] = {};
        deepMerge(dst[k], src[k]);
      } else dst[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
    }
  }
  A.M = function (base, over) {
    const b = A.copyPose(base);
    if (over) deepMerge(b, over);
    return b;
  };
  A.seq = function (base, steps) {
    const keys = [];
    let prev = base;
    for (const s of steps) {
      const pose = s.abs ? A.copyPose(s.abs) : A.M(prev, s.over);
      if (s.head) headTo(pose, s.head[0], s.head[1]);
      const k = { t: s.t, pose };
      if (s.e) k.e = s.e;
      if (s.v != null) k.v = s.v;
      if (s.name) k.name = s.name;
      keys.push(k);
      prev = pose;
    }
    return keys;
  };
  // 角度の組 e を前の組 prev に近い表し方にする (180° を超えて離れる成分は ±360)
  A.unwrap = function (prev, e) {
    for (let j = 0; j < 3; j++) {
      while (e[j] - prev[j] > 180) e[j] -= 360;
      while (e[j] - prev[j] < -180) e[j] += 360;
    }
    return e;
  };
  A.clip = function (kind, keys, marks, extra) {
    const c = keys.slice();
    c.kind = kind;
    c.marks = marks || {};
    if (extra) Object.assign(c, extra);
    if (c.events) c.events = c.events.slice().sort((a, b) => a.t - b.t);
    for (let i = 1; i < c.length; i++) {
      if (c[i].pose === c[i - 1].pose) continue;
      for (const [s, k] of EUL) A.unwrap(c[i - 1].pose[s][k], c[i].pose[s][k]);
    }
    return c;
  };
  const nrm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  A.nrm = nrm;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  // 手の向き (armX.h): 指を f、手のひらを n の方へ (キャラクター空間)。標準の手は指 −Y・手のひら −X (左) / +X (右)・親指 +Z
  A.handFrame = function (side, f, n) {
    f = nrm(f);
    n = nrm(n);
    const d = f[0] * n[0] + f[1] * n[1] + f[2] * n[2];
    n = nrm([n[0] - d * f[0], n[1] - d * f[1], n[2] - d * f[2]]);
    const f0 = new T.Vector3(0, -1, 0);
    const n0 = new T.Vector3(side === "L" ? -1 : 1, 0, 0);
    const f1 = new T.Vector3(f[0], f[1], f[2]);
    const n1 = new T.Vector3(n[0], n[1], n[2]);
    const m0 = new T.Matrix4().makeBasis(f0, n0, new T.Vector3().crossVectors(f0, n0));
    const m1 = new T.Matrix4().makeBasis(f1, n1, new T.Vector3().crossVectors(f1, n1));
    const e = new T.Euler().setFromRotationMatrix(m1.multiply(m0.transpose()), "YXZ");
    return [Math.round(e.x / D2R), Math.round(e.y / D2R), Math.round(e.z / D2R)];
  };
  // グラブのポケット (指に沿って 8.5 cm・手のひらから 3 cm) を ball に置く手首の目標
  A.gloveWrist = function (ball, f, n) {
    f = nrm(f);
    n = nrm(n);
    return [r3(ball[0] - 0.085 * f[0] - 0.03 * n[0]), r3(ball[1] - 0.085 * f[1] - 0.03 * n[1]), r3(ball[2] - 0.085 * f[2] - 0.03 * n[2])];
  };
  // バットの向き: below = 水平から下へ (度、+ でヘッドが下), az = +Z から +X への方位 (度)
  A.batDir = function (below, az) {
    const v = below * D2R;
    const a = az * D2R;
    return [r3(Math.cos(v) * Math.sin(a)), r3(-Math.sin(v)), r3(Math.cos(v) * Math.cos(a))];
  };
  // 握り (下の手) の位置: 握りから d に along 進んだ点が S に来る (芯 = 0.65, 先 = 0.805)
  A.gripFor = function (S, d, along) {
    d = nrm(d);
    return [r3(S[0] - along * d[0]), r3(S[1] - along * d[1]), r3(S[2] - along * d[2])];
  };
  A.BAT_SWEET = 0.65;
  A.BAT_TIP = 0.805;

  /* ---------- 体の点 (肩・股関節) ----------
   * 骨の休止位置は models/player.json と同じ (tools/anim_check.js が一致を確かめる)。hrig.js の apply と同じ順に回す
   * (腰 → 背骨を半分ずつ 2 本 → 胸 → 鎖骨は手の高さ・前後ですくめる)。クリップを作るときに手足が届くかを見る */
  const SK = {
    Root: [0, 0.0012, 0],
    pelvis: [0, 0.9761, -0.0039],
    spine_01: [0, 1.0644, -0.0362],
    spine_02: [0, 1.129, -0.0274],
    spine_03: [0, 1.1918, -0.0365],
    clavicle_l: [0.0228, 1.4666, 0.0157],
    upperarm_l: [0.2112, 1.4358, 0.0118],
    thigh_l: [0.1094, 0.971, -0.0148],
  };
  // 腕 (上腕 + 前腕) と脚 (腿 + すね) の長さ
  A.SKEL = { bones: SK, ARM: 0.5369, LEG: 0.9027 };
  const _bm = [new T.Matrix4(), new T.Matrix4(), new T.Matrix4(), new T.Matrix4(), new T.Matrix4()];
  const _bl = new T.Matrix4();
  const _bq = new T.Quaternion();
  const _bp = new T.Vector3();
  const _bs = new T.Vector3(1, 1, 1);
  const _bE = new T.Euler();
  const _bv = new T.Vector3();
  // 骨 a の親 b からの位置 (+ add)
  const lc = (a, b, add) => _bp.set(SK[a][0] - SK[b][0] + (add ? add[0] : 0), SK[a][1] - SK[b][1] + (add ? add[1] : 0), SK[a][2] - SK[b][2] + (add ? add[2] : 0));
  function bmul(dst, par, pos, e, k) {
    if (e) _bq.setFromEuler(_bE.set(e[0] * D2R * k, e[1] * D2R * k, e[2] * D2R * k, "YXZ"));
    else _bq.identity();
    _bl.compose(pos, _bq, _bs);
    return par ? dst.multiplyMatrices(par, _bl) : dst.copy(_bl);
  }
  const _cE = [0, 0, 0];
  function shoulder(M3, s, t, out) {
    // 鎖骨のすくめ (hrig.js と同じ式)
    const lift = clampV((t[1] - 1.25) / 0.6, 0, 1);
    const fw = clampV(t[2] / 0.5, -0.5, 1);
    _cE[0] = -fw * 8;
    _cE[1] = 0;
    _cE[2] = s * lift * 16;
    const cl = SK.clavicle_l;
    const ua = SK.upperarm_l;
    const sp = SK.spine_03;
    bmul(_bm[4], M3, _bp.set(s * cl[0] - sp[0], cl[1] - sp[1], cl[2] - sp[2]), _cE, 1);
    _bv.set(s * (ua[0] - cl[0]), ua[1] - cl[1], ua[2] - cl[2]).applyMatrix4(_bm[4]);
    out[0] = _bv.x;
    out[1] = _bv.y;
    out[2] = _bv.z;
  }
  // out = {shL, shR, hipL, hipR} (キャラクター空間の [x, y, z])。hl / hr = 左右の手首の目標 (鎖骨のすくめに使う。省略でポーズの armX.t)
  A.bodyPts = function (p, out, hl, hr) {
    const o = out || { shL: [0, 0, 0], shR: [0, 0, 0], hipL: [0, 0, 0], hipR: [0, 0, 0] };
    const M0 = bmul(_bm[0], null, lc("pelvis", "Root", p.root), p.hips, 1);
    const M1 = bmul(_bm[1], M0, lc("spine_01", "pelvis"), p.spine, 0.5);
    const M2 = bmul(_bm[2], M1, lc("spine_02", "spine_01"), p.spine, 0.5);
    const M3 = bmul(_bm[3], M2, lc("spine_03", "spine_02"), p.chest, 1);
    shoulder(M3, 1, hl || p.armL.t, o.shL);
    shoulder(M3, -1, hr || p.armR.t, o.shR);
    const th = SK.thigh_l;
    const pe = SK.pelvis;
    for (const s of [1, -1]) {
      _bv.set(s * th[0] - pe[0], th[1] - pe[1], th[2] - pe[2]).applyMatrix4(M0);
      const h = s > 0 ? o.hipL : o.hipR;
      h[0] = _bv.x;
      h[1] = _bv.y;
      h[2] = _bv.z;
    }
    return o;
  };

  /* ---------- 走り v2 (速さで歩幅・接地の割合・腕の振り・前傾が変わる) ----------
   * A.runCycle(mem, v, dt, opt, out): mem = {ph, accT, yawPrev, yawRate, vs} は役者ごと、v = いまの速さ (m/秒)。
   * 歩幅 (2 歩) L = 1.1 + 0.34v (1.6〜4.0 m)、接地の割合 0.44 − 0.02v (歩きは 0.6 で両足が着く時間がある)。
   * 走り出し 1 秒は前傾を強く歩幅を狭く、曲がるときは内側へ傾く。opt = {arms:'run'|'trot'|'walk', strideMul, reset, yaw (ラジアン)} */
  A.RUN_L = (v) => clampV(1.1 + 0.34 * v, 1.6, 4.0);
  // 着地の位置 (接地の長さに対する割合)・腰の落とし方 (基本・速さ・歩き)
  let RUN_Z = 0.36;
  let RUN_DROP0 = 0.045;
  let RUN_DROPK = 0.07;
  let RUN_DROPW = 0.025;
  A._runTune = (o) => {
    if (o.z != null) RUN_Z = o.z;
    if (o.d0 != null) RUN_DROP0 = o.d0;
    if (o.dk != null) RUN_DROPK = o.dk;
    if (o.dw != null) RUN_DROPW = o.dw;
  };
  const RC0 = {};
  // 走りの基本形を数値の並びで持っておく (毎フレーム写すだけ。オブジェクトを作らない)
  const RUN_FLAT = flat(RUN_BASE, new Float64Array(NCH));
  // ポーズ p を数値の並び f の形にする (src などの印は呼ぶ側が書く)
  A.setFlat = function (p, f) {
    unflat(f, p);
    p.bat.on = 0;
    return p;
  };
  // 片足の目標 (ph: 0..1, 0 = 着地)。D = 接地の割合, S = 接地のあいだに体が進む距離, z0 = 着地の位置,
  // hm = 蹴り出しでかかとを上げる角度 (度), pk = 振り出しで足を引き上げる高さ
  const TOE = 0.14; // 足首からつま先の付け根まで
  function runFoot2(ph, D, S, z0, hm, pk, t, f) {
    if (ph < D) {
      // 接地: 体の下を後ろへ (地面では止まっている)。後半はつま先を支点にかかとが上がる (足首が前・上へ)
      const u = ph / D;
      const th = hm * smooth(0.35, 1, u) * D2R;
      t[2] = z0 - u * S + TOE * (1 - Math.cos(th));
      t[1] = 0.06 + TOE * Math.sin(th);
      f[0] = -6 * (1 - u) + th / D2R;
    } else {
      // 振り出し: かかとを引き上げて前へ、着地の前に下ろす
      const u = (ph - D) / (1 - D);
      const e = u * u * (3 - 2 * u);
      const z1 = z0 - S + TOE * (1 - Math.cos(hm * D2R));
      const y1 = 0.06 + TOE * Math.sin(hm * D2R);
      t[2] = z1 + (z0 - z1) * e;
      t[1] = y1 + (0.06 - y1) * u + pk * Math.sin(Math.PI * Math.pow(u, 0.75));
      f[0] = hm + (-6 - hm) * e;
    }
  }
  A.runCycle = function (mem, v, dt, opt, out) {
    opt = opt || RC0;
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    v = Math.max(0, v || 0);
    if (mem.vs == null || opt.reset) {
      if (mem.ph == null) mem.ph = 0;
      mem.accT = 0;
      mem.vs = v;
      mem.yawPrev = null;
      mem.yawRate = 0;
    }
    // 速さはなめらかに (0.1 秒)。止まりかけたら走り出しからやり直す
    mem.vs += (v - mem.vs) * (1 - Math.exp(-dt / 0.1));
    const vs = Math.max(0, mem.vs);
    if (vs < 0.3) mem.accT = 0;
    else mem.accT += dt;
    // 向きの変わる速さ (度/秒) → 体を内側へ傾ける
    if (opt.yaw != null) {
      if (mem.yawPrev != null && dt > 0) {
        const r = Math.atan2(Math.sin(opt.yaw - mem.yawPrev), Math.cos(opt.yaw - mem.yawPrev)) / dt / D2R;
        mem.yawRate += (r - mem.yawRate) * (1 - Math.exp(-dt / 0.15));
      }
      mem.yawPrev = opt.yaw;
    }
    const k = clampV((vs - 1.5) / 7, 0, 1);
    const kk = 0.4 + 0.6 * k;
    const wk = 1 - smooth(1.8, 2.2, vs); // 歩き 1 → 走り 0
    const acc = smooth(0, 0.9, mem.accT);
    const accLean = 14 * (1 - smooth(0, 1.0, mem.accT)) * clampV((v - 2) / 3, 0, 1);
    const L = A.RUN_L(vs) * (opt.strideMul || 1) * (0.65 + 0.35 * acc);
    mem.ph += ((vs * dt) / L) * TAU;
    const D = 0.6 * wk + clampV(0.44 - 0.02 * vs, 0.27, 0.42) * (1 - wk);
    const S = D * L;
    const z0 = S * (RUN_Z + 0.02 * wk);
    const hm = 40 + 25 * k;
    const pk = (0.12 + 0.26 * k) * (1 - 0.5 * wk);
    const p = A.setFlat(out || basePose(), RUN_FLAT);
    const ph = ((mem.ph / TAU) % 1 + 1) % 1;
    runFoot2(ph, D, S, z0, hm, pk, p.legL.t, p.legL.f);
    runFoot2((ph + 0.5) % 1, D, S, z0, hm, pk, p.legR.t, p.legR.f);
    // a: 左脚が前で +1。腰は前の脚の側が前へ、肩は逆に回り、腕は脚と逆に振る
    const a = Math.cos(TAU * (ph + 0.06));
    // 上下動: 走りは接地の中ほどで低く、歩きは高い (1 周期に 2 回)
    const bob = Math.cos(2 * TAU * (ph - D / 2)) * (1 - 2 * wk);
    p.root[1] = -RUN_DROP0 - RUN_DROPK * k - (0.015 + 0.03 * k) * bob - 0.04 * (1 - acc) * clampV((v - 2) / 3, 0, 1) - RUN_DROPW * wk;
    p.roll = clampV(-0.12 * (mem.yawRate || 0), -12, 12);
    p.hips[1] = -8 * kk * a;
    p.spine[0] = 6 + 12 * k + accLean;
    p.spine[1] = 4 * kk * a;
    p.chest[0] = 4;
    p.chest[1] = 8 * kk * a;
    p.neck[1] = -2 * kk * a;
    p.head[0] = -(4 + 12 * k + 0.8 * accLean);
    p.head[1] = -2 * kk * a;
    // 腕: 走りは肘を曲げて前後に、流し (トロット) は小さく低く、歩きは下ろして小さく
    const arms = wk > 0.5 ? "walk" : opt.arms || "run";
    // 前へ振った手はあごの方へ (肘を曲げる)、後ろへ振った手は腰の横へ
    let az = 0.12 + 0.22 * k;
    let ay = 0.05 + 0.13 * k;
    let hy = 1.0 + 0.06 * k;
    let hz = 0.0;
    if (arms === "trot") {
      az *= 0.7;
      ay *= 0.7;
      hy = 0.96;
    } else if (arms === "walk") {
      az = 0.1;
      ay = 0.02;
      hy = 0.88;
      hz = 0.02;
      p.armL.p[2] = p.armR.p[2] = -0.6;
    }
    // 前傾した分だけ肩が前・下へ出るので、手もその分ずらす (後ろへ振った手が届かなくならない)
    const ln = (p.spine[0] + p.chest[0]) * D2R;
    hz += 0.4 * Math.sin(ln) - 0.03;
    hy -= 0.4 * (1 - Math.cos(ln));
    const HL = p.armL.t;
    const HR = p.armR.t;
    // 後ろへ振る幅は前の 7 割 (伸びきらない)
    const bl = a > 0 ? 0.7 : 1;
    const br = a < 0 ? 0.7 : 1;
    HL[0] = 0.21;
    HL[1] = hy - ay * a * bl;
    HL[2] = hz - az * a * bl;
    HR[0] = -0.21;
    HR[1] = hy + ay * a * br;
    HR[2] = hz + az * a * br;
    p.src = -1;
    p.st = mem.ph;
    p.kind = "run";
    p.name = "run.cycle";
    if (p.flags) {
      resetFlags(p.flags, null);
      p.flags.kind = "run";
    }
    return p;
  };

  PB.Anim = A;
})((window.PB = window.PB || {}));
