/* 熱闘！ポケットベースボール — 第 2 段の動き (クリップ)
 * 打撃・投球・捕手・守備・走塁・審判のクリップを A.def で登録する (A.get(名前, params) で作る)。
 * どれも右打ち・右投げ (グラブは左手) で作り、左は A.mirrorClip で反転する。
 * キーの数値は tools/anim_check.js で点検する (手足が届く・足が地面の上・バットを握ったまま・印の時刻)。
 * A.style(p, side) は選手ごとの構え・投げ方 (能力と名前で決まる)、A.swingSolve はミートの点からバットの位置を決める。
 * 試合 (view.js) はまだ使わない: 第 2 段の motion.js がここのクリップに切り替える */
(function (PB) {
  "use strict";
  const A = PB.Anim;
  const P = A.P;
  const headTo = A.headTo;
  const D2R = Math.PI / 180;
  const R3 = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const qz = (v, s) => Math.round(v / s) * s;
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

  // 打者の立つ位置: ホームベースの中心から 0.78 m (第 2 段で 0.85 から変える。外角の球にもバットが届く)
  const BOX = 0.78;
  A.BOX_X = BOX;

  /* ---------- 選手ごとの型 ----------
   * 構え: open (足を開く 度), width (足幅 m), crouch (かがみ 0..1), handsH (手の高さ m), handsBack (手を引く m),
   *       batTilt (バットの傾き 度、0 = 立てる), batAz (バットの向き 度), waggle (構えの揺れ 0..1)
   * 始動: kick ('kick' 足を上げる | 'tap' すり足 | 'none'), kickH (足を上げる高さ m), stride (踏み出し m)
   * スイング: power (0..1), finish ('two' 両手 | 'one' 片手), uppercut (0..1), slap (左打ちの走り打ち)
   * 投球: slot ('threeQ' | 'sub' (見た目だけ)), handsOver (振りかぶる), lift (足を上げる高さ 0.5..1), pause (足を上げて止める 秒),
   *       pause2 (二段モーション), headDown (投げるときに下を向く)
   * 走塁: strideMul (歩幅の倍率), headFirst (頭から滑る) */
  const STYLE0 = {
    open: 0,
    width: 0.66,
    crouch: 0.3,
    handsH: 1.43,
    handsBack: 0.2,
    batTilt: 25,
    batAz: -163,
    waggle: 0.7,
    kick: "kick",
    kickH: 0.16,
    stride: 0.26,
    power: 0.5,
    finish: "two",
    uppercut: 0,
    slap: false,
    slot: "threeQ",
    handsOver: true,
    lift: 1,
    pause: 0,
    pause2: false,
    headDown: false,
    strideMul: 1,
    headFirst: false,
  };
  const SKEYS = Object.keys(STYLE0);
  const styleKey = (s) => SKEYS.map((k) => (typeof s[k] === "number" ? R3(s[k]) : s[k] === true ? 1 : s[k] === false ? 0 : s[k])).join(",");
  STYLE0.full = true;
  STYLE0.key = styleKey(STYLE0);
  A.STYLE0 = STYLE0;
  // 足りない項目を既定値で埋めた型 (A.style の結果はそのまま)
  function sty(s) {
    if (s && s.full) return s;
    const o = Object.assign({}, STYLE0, s || {});
    o.key = styleKey(o);
    return o;
  }
  A.fullStyle = sty;

  // 2004 年の選手の型 (名前は rosters2004.js の p.name そのまま)。記憶に基づく近似で、違っていても害はない。
  // 打者は v1 の書き方 (kick 0..1 / handsY / batAngle) で書いて下で変換する。
  // 小笠原 道大の神主打法は使う前に確認する (§8 の質問): 確認できるまで入れない
  const FORMS_V1 = {
    "中村 紀洋": { crouch: 0.15, handsY: 1.5, batAngle: 25, kick: 0.7, waggle: 0.9 },
    "タフィ・ローズ": { open: 20, crouch: 0.3, kick: 0.9, batAngle: 40, handsY: 1.45 },
    "松中 信彦": { crouch: 0.35, kick: 0.9, handsY: 1.4, batAngle: 30 },
    "金本 知憲": { open: 15, crouch: 0.4, kick: 0.6, batAngle: 45 },
    "清原 和博": { crouch: 0.15, width: 0.85, handsY: 1.5, kick: 0.5, batAngle: 35 },
    "岩村 明憲": { crouch: 0.45, kick: 1.0, handsY: 1.35 },
    "福留 孝介": { crouch: 0.6, handsY: 1.3, batAngle: 55, kick: 0.5 },
    "和田 一浩": { open: 18, handsY: 1.5, batAngle: 20, crouch: 0.5 },
    "新庄 剛志": { open: 20, crouch: 0.2, handsY: 1.45, kick: 0.6 },
    "阿部 慎之助": { crouch: 0.6, width: 0.8, handsY: 1.3, batAngle: 50, kick: 0.3 },
    "高橋 由伸": { crouch: 0.35, batAngle: 45, kick: 0.5 },
    "井口 資仁": { crouch: 0.4, open: 12, kick: 0.7 },
    "城島 健司": { crouch: 0.3, open: 10, kick: 0.8 },
    "稲葉 篤紀": { crouch: 0.5, kick: 0.8, batAngle: 40 },
    "嶋 重宣": { crouch: 0.5, kick: 0.6 },
    "前田 智徳": { crouch: 0.45, kick: 0.15, batAngle: 30 },
    "谷 佳知": { crouch: 0.4, kick: 0.3 },
    "タイロン・ウッズ": { crouch: 0.2, width: 0.85, kick: 0.5, batAngle: 30 },
    "多村 仁": { crouch: 0.3, kick: 0.7 },
    "アレックス・カブレラ": { crouch: 0.2, kick: 0.9, handsY: 1.5 },
    "李 承燁": { crouch: 0.35, kick: 0.7, open: 10 },
    "小坂 誠": { crouch: 0.4, kick: 0.2, open: 8, handsY: 1.3 },
    "赤星 憲広": { crouch: 0.4, kick: 0.2, open: 8, handsY: 1.3 },
    "川崎 宗則": { crouch: 0.4, kick: 0.2, open: 8, handsY: 1.3 },
    "大村 直之": { crouch: 0.4, kick: 0.2, open: 8, handsY: 1.3 },
    "古田 敦也": { crouch: 0.5, kick: 0.2, batAngle: 20 },
  };
  const kickOf = (k) => (k >= 0.35 ? { kick: "kick", kickH: R3(0.04 + 0.22 * k) } : k >= 0.15 ? { kick: "tap" } : { kick: "none" });
  function fromV1(o) {
    const s = {};
    for (const k in o) {
      if (k === "handsY") s.handsH = o[k];
      else if (k === "batAngle") s.batTilt = o[k];
      else if (k === "kick") Object.assign(s, kickOf(o[k]));
      else s[k] = o[k];
    }
    return s;
  }
  const FORMS = {};
  for (const n in FORMS_V1) FORMS[n] = fromV1(FORMS_V1[n]);
  Object.assign(FORMS, {
    // 種田 仁 のガニ股打法 (2004 年もかは不確か)
    "種田 仁": { width: 0.95, crouch: 1.0, open: 10, handsH: 1.2, batTilt: 60 },
    // 投手 (投げ方は見た目だけ。リリースの位置は変えない)
    "渡辺 俊介": { slot: "sub" },
    "岡島 秀樹": { headDown: true },
    "三浦 大輔": { pause: 0.15, pause2: true },
    "山本 昌": { lift: 1.0, pause: 0.15 },
    "工藤 公康": { lift: 0.95 },
    "和田 毅": { lift: 0.9 },
    "岩隈 久志": { lift: 0.9, pause: 0.15 },
    "松坂 大輔": { lift: 0.8 },
    "上原 浩治": { lift: 0.5, pause: 0 },
    "佐々木 主浩": { lift: 0.8 },
    "藤川 球児": { lift: 0.9 },
    "伊良部 秀輝": { lift: 0.8 },
  });
  A.FORMS = FORMS;
  // 試合の選手は p.name が姓だけ・p.full が空白なしの名前 (data.js rosterTeam) なので、空白を除いた名前でも引く
  const FORMS_FULL = {};
  for (const n in FORMS) FORMS_FULL[n.replace(/ /g, "")] = FORMS[n];
  A.formFor = (p) => (p && (FORMS[p.name] || FORMS_FULL[String(p.full || p.name || "").replace(/ /g, "")])) || null;

  // view.js の hashStr と同じ (FNV-1a)
  function hashStr(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const STY_CACHE = new Map();
  // 選手の型: 名前のハッシュでばらつかせ、能力 (長打・ミート・走力・弾道) で型を決め、名前の型を上に重ねる。side = 打席 ('R' | 'L')
  A.style = function (p, side) {
    p = p || {};
    const bs = side === "L" || (side == null && p.bats === "L") ? "L" : "R";
    const ck = (p.id || "") + "|" + (p.full || p.name || "") + "|" + bs + "|" + [p.power, p.meet, p.speed, p.traj, p.stamina, p.role, p.pos].join(",");
    const hit = STY_CACHE.get(ck);
    if (hit) return hit;
    let x = hashStr(p.id || p.name || "") || 1;
    const rnd = () => {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return x / 4294967296;
    };
    const U = (a, b, d) => R3(qz(a + (b - a) * rnd(), d || 0.01));
    const has = (k) => !!(p.skills && p.skills.indexOf(k) >= 0);
    const pw = num(p.power, 50);
    const mt = num(p.meet, 50);
    const sp = num(p.speed, 50);
    const s = Object.assign({}, STYLE0);
    s.open = U(-6, 14, 1);
    s.width = U(0.6, 0.76);
    s.crouch = U(0.15, 0.55, 0.05);
    s.handsH = U(1.36, 1.48);
    s.handsBack = U(0.17, 0.23);
    s.batTilt = U(15, 45, 1);
    s.batAz = U(-175, -151, 1);
    s.waggle = U(0.4, 1, 0.1);
    s.kickH = U(0.08, 0.2);
    s.stride = U(0.22, 0.3);
    const hFin = rnd();
    const hHead = rnd();
    const hPause = rnd();
    const hOver = rnd();
    // 能力の型 (あとの規則ほど強い)。ばらつきは半分残す
    const mix = (a, b) => R3((a + b) / 2);
    if (pw >= 70 || has("powerHitter")) Object.assign(s, { kick: "kick", kickH: 0.22, batTilt: Math.round(mix(s.batTilt, 35)), crouch: mix(s.crouch, 0.3), handsH: mix(s.handsH, 1.48) });
    else if ((mt >= 70 && pw < 60) || has("avgHitter")) Object.assign(s, { kick: "tap", crouch: mix(s.crouch, 0.5), batTilt: Math.round(mix(s.batTilt, 20)), waggle: 0.6 });
    const slap = bs === "L" && sp >= 75 && pw <= 45;
    if (slap) Object.assign(s, { open: 10, crouch: 0.4, handsH: 1.3, kick: "tap" });
    if (p.pos === "P") Object.assign(s, { crouch: 0.15, width: 0.6, kick: "none", waggle: 0.3 });
    s.power = R3(qz(clamp((pw - 30) / 60, 0, 1), 0.05));
    s.finish = s.power > 0.65 && hFin > 0.4 ? "one" : "two";
    s.uppercut = R3(qz(clamp((num(p.traj, 2) - 1) / 3, 0, 1), 0.05));
    s.slap = slap;
    // 投球
    s.lift = R3(qz(clamp((0.6 + 0.4 * clamp((num(p.stamina, 50) - 50) / 50, 0, 1)) * (p.role === "SP" ? 1 : 0.8), 0.5, 1), 0.05));
    s.pause = hPause < 0.3 ? 0.08 : 0;
    s.handsOver = hOver < 0.6;
    // 走塁
    s.strideMul = R3(qz(0.96 + 0.08 * clamp((sp - 40) / 50, 0, 1), 0.01));
    s.headFirst = sp >= 80 && (has("steal") || has("baserun")) && hHead < 0.5;
    const F = A.formFor(p);
    if (F) Object.assign(s, F);
    s.side = bs;
    s.full = true;
    s.key = styleKey(s);
    STY_CACHE.set(ck, s);
    if (STY_CACHE.size > 512) STY_CACHE.delete(STY_CACHE.keys().next().value);
    return s;
  };

  /* ---------- 共通 ---------- */
  // バットを持つキーの手首の目標を握りにそろえる (one = 片手: 下の手だけ)。バットを離したときに手が飛ばない
  function handsOnBat(p, one) {
    const g = p.bat.g;
    const d = A.nrm(p.bat.d);
    const th = p.bat.th == null ? 0.085 : p.bat.th;
    p.armL.t = [R3(g[0]), R3(g[1]), R3(g[2])];
    if (!one) p.armR.t = [R3(g[0] + d[0] * th), R3(g[1] + d[1] * th), R3(g[2] + d[2] * th)];
  }
  /* ---------- 手足が届くようにする (A.bodyPts で肩・股関節を求める) ---------- */
  const BP = { shL: [0, 0, 0], shR: [0, 0, 0], hipL: [0, 0, 0], hipR: [0, 0, 0] };
  const REACH = A.SKEL.ARM - 0.012; // 手首の目標は腕の長さより少し手前 (ひじをわずかに曲げる)
  const LEGR = A.SKEL.LEG - 0.006;
  // 点 v を点 s から max 以内へ (動かした距離を返す)
  function pull(v, s, max) {
    const dx = v[0] - s[0];
    const dy = v[1] - s[1];
    const dz = v[2] - s[2];
    const d = Math.hypot(dx, dy, dz);
    if (d <= max) return 0;
    const k = max / d;
    v[0] = R3(s[0] + dx * k);
    v[1] = R3(s[1] + dy * k);
    v[2] = R3(s[2] + dz * k);
    return d - max;
  }
  // バットを持つキー: 握りが肩から届かなければバットを肩の方へ寄せる (体は動かさない。hrig.js の握りの補正と同じ考え)
  function fitGrip(p, one) {
    const d = A.nrm(p.bat.d);
    const th = p.bat.th == null ? 0.085 : p.bat.th;
    const g = p.bat.g;
    for (let it = 0; it < 4; it++) {
      A.bodyPts(p, BP);
      let mv = pull(g, BP.shL, REACH);
      if (!one) {
        const top = [g[0] + d[0] * th, g[1] + d[1] * th, g[2] + d[2] * th];
        const m2 = pull(top, BP.shR, REACH);
        if (m2) for (let i = 0; i < 3; i++) g[i] = R3(top[i] - d[i] * th);
        mv += m2;
      }
      handsOnBat(p, one);
      if (!mv) return;
    }
  }
  // 脚: 足首が股関節から届かなければ足を股関節の方へ (横方向に) 寄せる
  function fitLegs(p, known) {
    if (!known) A.bodyPts(p, BP);
    for (const s of ["L", "R"]) {
      const t = p["leg" + s].t;
      const h = s === "L" ? BP.hipL : BP.hipR;
      const dy = t[1] - h[1];
      const dx = t[0] - h[0];
      const dz = t[2] - h[2];
      const d = Math.hypot(dx, dy, dz);
      if (d <= LEGR) continue;
      const hz = Math.hypot(dx, dz);
      const want = Math.sqrt(Math.max(0, LEGR * LEGR - dy * dy));
      if (hz > 1e-4 && want > 0.02) {
        p["leg" + s].t = [R3(h[0] + (dx * want) / hz), t[1], R3(h[2] + (dz * want) / hz)];
      }
    }
  }
  // 持っていない手: 届かない目標は肩の方へ (keep = そのままにする手 'L' / 'R')
  function fitArms(p, keep, known) {
    if (!known) A.bodyPts(p, BP);
    if (keep !== "L") {
      const t = p.armL.t.slice();
      if (pull(t, BP.shL, A.SKEL.ARM - 0.004)) p.armL.t = t;
    }
    if (keep !== "R") {
      const t = p.armR.t.slice();
      if (pull(t, BP.shR, A.SKEL.ARM - 0.004)) p.armR.t = t;
    }
  }
  // 体 (腰の位置・前かがみ) を動かして手首の目標 reqs = [['L' | 'R', [x, y, z]], ...] に届かせる。p を書き換える。
  // lim = {x, y (下へ), z, pitch (前かがみを足す上限 度)}。届かなかった距離を返す (0 = 届いた)
  function reachBody(p, reqs, lim) {
    const r0 = p.root.slice();
    const sp0 = p.spine[0];
    let ex = 0;
    for (let add = 0; add <= (lim.pitch || 0) + 1e-6; add += 3) {
      p.spine = [R3(sp0 + add), p.spine[1], p.spine[2]];
      p.root = r0.slice();
      for (let it = 0; it < 8; it++) {
        A.bodyPts(p, BP);
        ex = 0;
        let ev = null;
        for (const [s, t] of reqs) {
          const sh = s === "L" ? BP.shL : BP.shR;
          const v = [t[0] - sh[0], t[1] - sh[1], t[2] - sh[2]];
          const d = Math.hypot(v[0], v[1], v[2]);
          if (d - REACH > ex) {
            ex = d - REACH;
            ev = [(v[0] * ex) / d, (v[1] * ex) / d, (v[2] * ex) / d];
          }
        }
        if (ex < 0.0015) return 0;
        const nx = clamp(p.root[0] + ev[0], r0[0] - lim.x, r0[0] + lim.x);
        const ny = clamp(p.root[1] + Math.min(0, ev[1]), r0[1] - lim.y, r0[1]);
        const nz = clamp(p.root[2] + ev[2], r0[2] - lim.z, r0[2] + lim.z);
        if (Math.abs(nx - p.root[0]) + Math.abs(ny - p.root[1]) + Math.abs(nz - p.root[2]) < 1e-4) break;
        p.root = [R3(nx), R3(ny), R3(nz)];
      }
    }
    return ex;
  }
  // グラブのポケットを pk に (指 f・手のひら n の向き)。届かなければ体を動かし、それでも足りなければ
  // ポケットの前後 (zr = [最小, 最大]) と左右 (xr) を肩の方へ寄せる。pk を書き換えて返す (高さは変えない)
  function reachPocket(p, side, pk, f, n, lim, zr, xr) {
    const arm = side === "L" ? "armL" : "armR";
    for (let round = 0; round < 4; round++) {
      const w = A.gloveWrist(pk, f, n);
      p[arm].t = w;
      const ex = reachBody(p, [[side, w]], lim);
      if (!ex) return pk;
      A.bodyPts(p, BP);
      const sh = side === "L" ? BP.shL : BP.shR;
      const v = [w[0] - sh[0], w[2] - sh[2]];
      const h = Math.hypot(v[0], v[1]) || 1;
      if (zr) pk[2] = R3(clamp(pk[2] - (v[1] / h) * (ex + 0.004), zr[0], zr[1]));
      if (xr) pk[0] = R3(clamp(pk[0] - (v[0] / h) * (ex + 0.004), xr[0], xr[1]));
    }
    p[arm].t = A.gloveWrist(pk, f, n);
    return pk;
  }
  // キーの並びをクリップにする: バットを持つキーの手をそろえ、届かない脚・手・握りを直す。
  // キーの one = 片手で持つ、hold = 持っている手 ('L' | 'R'。グラブで捕る瞬間など、目標を動かさない)
  function mk(kind, keys, marks, extra) {
    for (const k of keys) {
      const p = k.pose;
      if (p.bat.on) {
        handsOnBat(p, k.one);
        fitLegs(p);
        fitGrip(p, k.one);
        if (k.one) fitArms(p, "L");
      } else {
        // 脚を寄せても肩は変わらないので、肩・股関節は 1 回だけ求める
        A.bodyPts(p, BP);
        fitLegs(p, true);
        fitArms(p, k.hold, true);
      }
    }
    return A.clip(kind, keys, marks, extra);
  }
  // 目から点 S を見る頭の向き (方位, 下向き)
  function lookFrom(eye, S) {
    const v = [S[0] - eye[0], S[1] - eye[1], S[2] - eye[2]];
    return [Math.atan2(v[0], v[2]) / D2R, Math.atan2(-v[1], Math.hypot(v[0], v[2])) / D2R];
  }

  /* ======================================================
   *  打者 (右打ち。投手は +X、ホームベースの中心は +Z の 0.78 m、捕手は −X)
   * ====================================================== */
  // 1. 構え (ポーズ)。既定の型は今の STANCE と同じ (頭だけ投手の方へ)
  function stance(s) {
    s = sty(s);
    const c = 0.03;
    const w = s.width;
    const op = s.open;
    const p = P({
      root: [-0.04, R3(-0.06 - 0.14 * s.crouch), -0.02],
      hips: [0, R3(-8 + 0.6 * op), 0],
      spine: [R3(10 + 14 * s.crouch), -6, 0],
      chest: [4, R3(-8 + 0.3 * op), 0],
      armL: { p: [0.3, 0.9, -0.5], h: [0, 0, 0] },
      armR: { p: [-0.7, 1.0, -0.4], h: [0, 0, 0] },
      legL: { t: [R3(c + w / 2), 0.06, R3(0.02 - 0.006 * op)], p: [R3(0.6 + 0.1 * s.crouch), 0.5, 1], f: [0, R3(-10 + 1.5 * op), 0] },
      legR: { t: [R3(c - w / 2), 0.06, -0.02], p: [R3(-0.5 - 0.1 * s.crouch), 0.5, 1], f: [0, -20, 0] },
      bat: { g: [R3(-s.handsBack), R3(s.handsH - 0.16 * s.crouch), -0.08], d: A.batDir(-(90 - s.batTilt), s.batAz), on: 1, th: 0.085 },
    });
    headTo(p, 88, 0);
    p.kind = "idle";
    handsOnBat(p);
    return p;
  }
  A.batStance = (s) => stance(s);
  // 構えの揺れ (型の構えから。バットを小さく回す・膝で小さく弾む)。out に書く。src = −2 (位相の動き)
  const IDLE = new Map();
  A.stanceIdle = function (t, s, out) {
    s = sty(s);
    // 型ごとの構えを数値の並びで覚えておき、毎フレーム写す (オブジェクトを作らない)
    let base = IDLE.get(s.key);
    if (!base) {
      base = A.flat(stance(s), new Float64Array(A.NCH));
      IDLE.set(s.key, base);
      if (IDLE.size > 64) IDLE.delete(IDLE.keys().next().value);
    }
    const p = A.setFlat(out || A.basePose(), base);
    p.bat.on = 1;
    const w = num(s.waggle, 0.7);
    p.bat.d[0] += Math.sin(t * 2.2) * 0.08 * w;
    p.bat.d[2] += Math.cos(t * 2.2) * 0.08 * w;
    p.bat.g[1] += Math.sin(t * 1.1) * 0.01;
    p.root[1] -= 0.01 * (0.5 - 0.5 * Math.cos(t * 3.8));
    p.src = -2;
    p.st = t;
    p.kind = "idle";
    p.name = "bat.idle";
    p.flags = p.flags || A.newFlags();
    A.resetFlags(p.flags, null);
    return p;
  };

  // 2. 始動 → 踏み出し → 着地 (印: release = 投手のリリース, plant = 前足の着地)。着地のあとはそのまま保つ
  function load(s) {
    s = sty(s);
    const st = stance(s);
    const lift = s.kick === "kick" ? s.kickH : s.kick === "tap" ? 0.04 : 0.015;
    const fx = st.legL.t[0];
    const keys = A.seq(st, [
      { t: 0, over: {} },
      { t: 0.15, e: "io", over: { root: [-0.07, st.root[1], -0.02], hips: [0, st.hips[1] - 4, 0], chest: [4, st.chest[1] - 4, 0], bat: { g: [R3(st.bat.g[0] - 0.05), R3(st.bat.g[1] + 0.03), -0.12], d: A.batDir(-62, -112) } }, head: [88, 0] },
      {
        t: 0.4,
        e: "io",
        name: "gather",
        over: {
          root: [-0.09, R3(st.root[1] + 0.01), -0.02],
          hips: [0, st.hips[1] - 10, 0],
          chest: [4, st.chest[1] - 8, 0],
          legL: { t: [R3(fx - 0.12 - lift * 0.3), R3(0.06 + lift), 0.07], p: [0.45, 0.9, 1], f: [R3(lift * 120), -14, 0] },
        },
        head: [88, 0],
      },
      {
        t: 0.82,
        e: "in",
        name: "plant",
        over: {
          root: [0.05, R3(st.root[1] - 0.05), 0.0],
          hips: [0, 4, 0],
          spine: [st.spine[0] + 2, -8, 0],
          chest: [4, -18, 0],
          legL: { t: [R3(fx + s.stride), 0.06, 0.04], p: [0.7, 0.5, 1], f: [0, 8, 0] },
          bat: { g: [-0.21, R3(st.bat.g[1] - 0.04), -0.1], d: A.batDir(-52, -120) },
        },
        head: [86, 2],
      },
    ]);
    return mk("idle", keys, { release: 0.4, plant: 0.82 });
  }
  // 着地の形 (登録した始動のクリップの最後のキー。キャッシュにあればそれを使う)
  const plantOf = (s) => A.copyPose(A.get("bat.load", { style: s })[3].pose);

  // 3. スイング。ct = {S: 芯を通す点, below: ヘッドが水平から下へ (度), az: ヘッドの向き (度、+ で引っ張り)}
  // 印: contact 0.12 (= P.SWING_LAG)、finish 0.36。0.30 から kind = follow (視線が打球を追う)。片手のフィニッシュは 0.26 から上の手を離す
  const CT0 = { S: [0.28, 0.8, BOX], below: 18, az: 0 };
  function ctQ(ct) {
    ct = ct || CT0;
    const S = ct.S || CT0.S;
    return { S: [R3(qz(S[0], 0.02)), R3(qz(S[1], 0.02)), R3(qz(S[2], 0.02))], below: qz(num(ct.below, 18), 5), az: qz(num(ct.az, 0), 5) };
  }
  const ctKey = (ct) => {
    const c = ctQ(ct);
    return c.S.join(",") + "," + c.below + "," + c.az;
  };
  function contactPose(plant, ct) {
    const d = A.batDir(ct.below, ct.az);
    const g = A.gripFor(ct.S, d, A.BAT_SWEET);
    const low = Math.max(0, 0.85 - ct.S[1]);
    const away = ct.S[2] - BOX; // + = 外角
    const pose = A.M(plant, {
      root: [0.1, R3(-0.2 - low * 0.12), R3(0.04 + Math.max(0, away) * 0.3)],
      hips: [0, R3(68 + ct.az * 0.3 - away * 20), 0],
      spine: [R3(14 + low * 26), 6, R3(low * 14 + Math.max(0, away) * 30)],
      chest: [4, R3(4 + ct.az * 0.25 - away * 15), R3(low * 8)],
      armL: { p: [0.7, 0.6, -0.6], h: [0, 0, 0] },
      armR: { p: [-0.3, 0.5, 0.5], h: [0, 0, 0] },
      legL: { t: plant.legL.t.slice(), p: [0.9, 0.5, 0.6], f: [0, 35, 0] },
      legR: { t: [-0.22, 0.12, 0.06], p: [-0.05, 0.5, 1.1], f: [30, 55, 0] },
      bat: { g, d, on: 1 },
    });
    // 両手が握りに届くように腰の位置・前かがみを動かす (外角・低めの球)
    handsOnBat(pose);
    reachBody(pose, [["L", pose.armL.t], ["R", pose.armR.t]], { x: 0.12, y: 0.22, z: 0.16, pitch: 30 });
    // 頭: ミートの点を目 (おおよその位置) から見る
    const lk = lookFrom([0.12, 1.42 + pose.root[1] + 0.2, 0.22 + pose.root[2] - 0.04], ct.S);
    headTo(pose, lk[0], lk[1]);
    return pose;
  }
  function swing(s, ct0) {
    s = sty(s);
    const ct = ctQ(ct0);
    const plant = plantOf(s);
    const k1 = A.M(plant, {
      root: [0.05, R3(plant.root[1] - 0.02), 0.02],
      hips: [0, 34, 0],
      spine: [plant.spine[0], 0, 0],
      chest: [4, -10, 0],
      armR: { p: [-0.4, 0.55, 0.3] },
      legR: { t: [-0.28, 0.08, 0.0], p: [-0.2, 0.5, 1.1], f: [10, 20, 0] },
      legL: { f: [0, 20, 0] },
      bat: { g: [-0.12, 1.14, 0.06], d: A.batDir(-12, -118), on: 1 },
    });
    headTo(k1, 70, 18);
    const k2 = contactPose(plant, ct);
    const pw = s.power;
    const slap = !!s.slap;
    // 振り抜き: アッパー気味の打者ほどヘッドが上がる
    const k3 = A.M(k2, {
      root: [0.16, -0.18, 0.04],
      hips: [0, R3(88 + 10 * pw), 0],
      spine: [14, 10, 0],
      chest: [4, R3(16 + 6 * pw), 0],
      armL: { p: [0.9, 0.9, 0.2] },
      armR: { p: [0.2, 0.6, 0.6] },
      legR: slap ? { t: [0.25, 0.16, -0.25], p: [0.3, 0.6, 1], f: [20, 60, 0] } : { t: [-0.14, 0.15, 0.12], f: [38, 70, 0] },
      bat: { g: [0.24, 1.12, 0.3], d: A.batDir(R3(4 - 10 * s.uppercut), 72), on: 1 },
    });
    headTo(k3, 24, 30);
    const two = s.finish !== "one" || slap;
    const k4 = A.M(k3, {
      root: [0.22, -0.15, 0.04],
      hips: [0, R3(96 + 8 * pw), 0],
      spine: [8, 14, 0],
      chest: [0, 22, 0],
      armL: { p: [0.8, 1.0, 0.4] },
      armR: { p: [-0.1, 1.0, 0.7] },
      legL: { f: [0, 60, 0] },
      legR: slap ? { t: [0.3, 0.07, -0.3], p: [0.4, 0.5, 1], f: [0, 70, 0] } : { t: [0.0, 0.15, 0.14], p: [0.4, 0.5, 1.0], f: [40, 85, 0] },
      bat: two ? { g: [0.3, 1.46, -0.26], d: A.batDir(20, -150), on: 1 } : { g: [0.34, 1.52, -0.3], d: A.batDir(-35, -145), on: 1 },
    });
    if (!two) k4.armR.t = [0.02, 1.02, 0.3];
    headTo(k4, R3(70 + 30 * (ct.az / 35)), -4);
    // 最後は同じポーズ (接線 0: 行き過ぎない)
    const k5 = A.M(k4, {});
    const tf = slap ? 0.28 : 0.36;
    const keys = [
      { t: 0, pose: plant },
      { t: 0.055, pose: k1, e: "in" },
      { t: 0.12, pose: k2, e: "lin" },
      { t: 0.19, pose: k3, e: "out" },
      { t: tf, pose: k4, e: "out", one: !two },
      { t: tf + 0.44, pose: k5, e: "io", one: !two },
    ];
    const ev = [{ t: slap ? 0.26 : 0.3, set: { kind: "follow" } }];
    if (!two) ev.push({ t: 0.26, set: { batOne: 1 } });
    return mk("swing", keys, { contact: 0.12, finish: tf }, { events: ev, target: { t: 0.12, p: ct.S.slice(), what: "sweet" } });
  }

  // 4. 見送り: 着地の形を保ってから力を抜く (印 ballPass = ボールが捕手に届く)
  function take(s) {
    s = sty(s);
    const plant = plantOf(s);
    const keys = A.seq(plant, [
      { t: 0, over: {} },
      { t: 0.12, e: "out", over: { hips: [0, 8, 0], chest: [4, -16, 0], bat: { g: [-0.22, R3(plant.bat.g[1] - 0.04), -0.1], d: A.batDir(-50, -118) } } },
      {
        t: 0.5,
        e: "io",
        name: "relax",
        over: { root: [0.03, R3(plant.root[1] + 0.04), 0.0], hips: [0, 0, 0], spine: [12, -4, 0], chest: [4, -6, 0], legL: { t: [R3(plant.legL.t[0] - 0.12), 0.06, 0.03] }, bat: { g: [0.02, 1.0, 0.16], d: A.batDir(40, 20) } },
        head: [70, 10],
      },
      { t: 0.9, e: "io", over: { bat: { g: [0.0, 0.98, 0.18], d: A.batDir(45, 25) } }, head: [60, 8] },
    ]);
    return mk("take", keys, { ballPass: 0.3 });
  }

  // 5. ハーフスイング (印 check: バットを止める。ヘッドはベースの前に出ない)
  function check(s) {
    s = sty(s);
    const plant = plantOf(s);
    const keys = A.seq(plant, [
      { t: 0, over: {} },
      { t: 0.06, e: "in", over: { hips: [0, 22, 0], chest: [4, -12, 0], legR: { t: [-0.28, 0.07, 0.0], f: [6, 10, 0] }, bat: { g: [-0.12, 1.16, 0.04], d: A.batDir(-20, -110) } } },
      { t: 0.13, e: "out", name: "check", over: { hips: [0, 30, 0], chest: [4, -4, 0], bat: { g: [0.0, 1.08, 0.14], d: A.batDir(2, -35) } } },
      { t: 0.32, e: "io", over: { hips: [0, 12, 0], chest: [4, -12, 0], bat: { g: [-0.12, 1.16, 0.0], d: A.batDir(-30, -100) } } },
      {
        t: 0.7,
        e: "io",
        over: { root: [0.03, R3(plant.root[1] + 0.04), 0.0], hips: [0, 0, 0], chest: [4, -6, 0], legL: { t: [R3(plant.legL.t[0] - 0.12), 0.06, 0.03] }, bat: { g: [0.02, 1.0, 0.16], d: A.batDir(40, 20) } },
        head: [70, 10],
      },
    ]);
    return mk("swing", keys, { check: 0.13 });
  }

  // 6. 送りバント: 投手の方へ向き直り (square)、上の手をバットの先の方へ滑らせ (th 0.36)、カーソルの点 S で当てる
  const BUNT_ALONG = 0.55;
  function bunt(s, S0) {
    s = sty(s);
    const S = S0 ? [R3(qz(S0[0], 0.02)), R3(qz(S0[1], 0.02)), R3(qz(S0[2], 0.02))] : [0.3, 0.85, BOX + 0.07];
    const st = stance(s);
    const d = A.nrm([0.12, 0.1, 0.99]);
    const sq = A.M(st, {
      root: [0.04, -0.24, 0.06],
      hips: [0, 50, 0],
      spine: [22, 14, 0],
      chest: [6, 16, 0],
      armL: { p: [0.5, 0.7, -0.4] },
      armR: { p: [-0.4, 0.7, 0.4] },
      legL: { t: [0.36, 0.06, 0.1], p: [0.8, 0.5, 0.9], f: [0, 35, 0] },
      legR: { t: [-0.26, 0.08, 0.14], p: [-0.1, 0.5, 1], f: [20, 55, 0] },
      bat: { g: A.gripFor([0.3, 1.04, BOX + 0.07], d, BUNT_ALONG), d, on: 1, th: 0.36 },
    });
    headTo(sq, 86, 4);
    const low = Math.max(0, 1.0 - S[1]);
    const cp = A.M(sq, { root: [0.06, R3(-0.24 - low * 0.4), 0.08], spine: [R3(22 + low * 10), 14, 0], bat: { g: A.gripFor(S, d, BUNT_ALONG), d } });
    handsOnBat(cp);
    reachBody(cp, [["L", cp.armL.t], ["R", cp.armR.t]], { x: 0.12, y: 0.25, z: 0.18, pitch: 25 });
    headTo(cp, 80, 20);
    const give = A.M(cp, { bat: { g: [R3(cp.bat.g[0] - 0.05), cp.bat.g[1], R3(cp.bat.g[2] - 0.06)] } });
    const keys = [
      { t: 0, pose: st },
      { t: 0.35, pose: sq, e: "io" },
      { t: 0.75, pose: cp, e: "io" },
      { t: 0.82, pose: give, e: "out" },
    ];
    return mk("bunt", keys, { square: 0.35, contact: 0.75 }, { target: { t: 0.75, p: S, what: "bunt" } });
  }

  // 7. バットを置いて走り出す (src = 打ったあとのクリップ。最後のポーズから)。
  // 0.10 から下の手だけで持ち、腰の横まで下ろして 0.24 で離す (spawn: 'bat' で転がるバットを出す)。go で一塁へ (右打ち 44°、左打ちは反転前に 135°)
  function dropRun(s, src, lhb) {
    s = sty(s);
    const sw = src && src.length ? src : A.get("bat.swing", { style: s });
    const fin = A.copyPose(sw[sw.length - 1].pose);
    const one0 = !!(sw.events && sw.events.some((e) => e.set && e.set.batOne));
    const yaw1 = lhb ? 135 : 44;
    // 握っている手の位置をそろえる (片手なら上の手は armR.t のまま)
    if (fin.bat.on) handsOnBat(fin, one0);
    const drop = A.M(fin, {
      yaw: R3(yaw1 * 0.35),
      root: [0.2, -0.13, 0.04],
      armL: { t: [0.24, 1.02, 0.02], p: [0.7, 0.9, -0.4] },
      armR: { t: [0.12, 1.0, 0.24], p: [-0.2, 0.9, -0.4] },
      bat: { g: [0.24, 1.02, 0.02], d: A.batDir(55, -160), on: 1, th: 0.085 },
    });
    // 一歩目: 前へ倒れ、右足で踏み出す (右打ち)
    const go = P({
      yaw: yaw1,
      root: [0, -0.14, 0.06],
      hips: [0, 10, 0],
      spine: [30, -4, 0],
      chest: [6, -6, 0],
      head: [-22, 0, 0],
      armL: { t: [0.24, 1.0, -0.18], p: [0.6, 1.0, -0.9] },
      armR: { t: [-0.22, 0.95, 0.38], p: [-0.6, 0.9, -0.8] },
      legL: { t: [0.12, 0.06, -0.3], p: [0.2, 0.5, 1.2], f: [30, 0, 0] },
      legR: { t: [-0.1, 0.26, 0.3], p: [-0.15, 0.6, 1.3], f: [-10, 0, 0] },
    });
    go.bat = { g: drop.bat.g.slice(), d: drop.bat.d.slice(), on: 0, th: 0.085 };
    const keys = [
      { t: 0, pose: fin, one: one0 },
      { t: 0.24, pose: drop, e: "io", one: true },
      { t: 0.5, pose: go, e: "in" },
    ];
    const ev = [
      { t: one0 ? 0 : 0.1, set: { batOne: 1 } },
      { t: 0.24, set: { batOn: 0 }, spawn: "bat" },
    ];
    return mk("run", keys, { batDrop: 0.24, go: 0.5 }, { events: ev });
  }

  /* ======================================================
   *  投手 (右投げ。セットでは本塁が +X・三塁側が +Z。原点 = 投手板の軸足の位置)
   * ====================================================== */
  // ボールのリリース位置 (pitch.js の pc.R = [腕·0.52, 17.4, 1.8] をキャラクター空間へ。マウンドの高さ 0.258)。手首はボールの 9 cm 後ろ
  const REL_BALL = [1.04, 1.542, 0.52];
  const REL_WRIST = [0.955, 1.53, 0.5];
  A.PIT_REL_BALL = REL_BALL;
  A.PIT_REL_WRIST = REL_WRIST;
  function pitSet() {
    const p = P({
      root: [0, -0.03, 0],
      spine: [6, 0, 0],
      chest: [0, 0, 0],
      armL: { t: [0.07, 1.16, 0.25], p: [0.6, 1.0, -0.2], h: [0, 0, 80] },
      armR: { t: [0.03, 1.14, 0.22], p: [-0.6, 1.0, -0.2], h: [0, 0, -80] },
      legL: { t: [0.34, 0.07, 0.0], p: [0.6, 0.5, 1], f: [0, 10, 0] },
      legR: { t: [0.06, 0.07, 0.0], p: [-0.2, 0.5, 1], f: [0, 0, 0] },
    });
    headTo(p, 88, 4);
    return p;
  }
  // 投げる部分 (drift → 踏み出し → 最大外旋 → リリース → フォロー → 守備の構え)。t0 = drift の時刻
  function tail(t0, s) {
    const sub = s.slot === "sub";
    const hd = s.headDown ? 45 : 0;
    return [
      {
        t: t0,
        e: "io",
        name: "drift",
        over: {
          root: [0.3, -0.09, 0],
          hips: [0, -12, 0],
          spine: [2, -10, -2],
          chest: [-2, -14, -4],
          legL: { t: [0.78, 0.16, 0.04], p: [1.2, 0.7, 1], f: [5, 35, 0] },
          legR: { t: [0.07, 0.07, 0.0], p: [-0.1, 0.5, 1], f: [0, 5, 0] },
          armL: { t: [0.58, 1.3, 0.24], p: [0.8, 1.2, -0.4], h: [0, 0, 70] },
          armR: { t: [-0.24, 1.1, -0.18], p: [-0.6, 0.7, -0.6], h: [0, 0, -40] },
        },
        head: [86, 6],
      },
      {
        t: t0 + 0.14,
        e: "in",
        name: "footStrike",
        over: {
          root: [0.56, -0.16, 0],
          hips: [0, 25, 0],
          spine: sub ? [16, -8, -2] : [6, -8, -6],
          chest: [-6, -20, -6],
          legL: { t: [1.15, 0.07, 0.02], p: [1.4, 0.6, 1], f: [0, 65, 0] },
          legR: { t: [0.1, 0.09, 0.0], p: [0.0, 0.45, 1], f: [10, 15, 0] },
          armL: { t: [0.86, 1.32, 0.26], p: [0.9, 1.0, -0.3], h: [0, 0, 40] },
          armR: sub ? { t: [0.1, 1.3, -0.24], p: [0.0, 1.0, -0.9], h: [-30, 0, -20] } : { t: [0.17, 1.63, -0.1], p: [0.0, 1.35, -0.8], h: [-30, 0, -20] },
        },
        head: [88, 8 + hd],
      },
      {
        t: t0 + 0.22,
        e: "in",
        name: "mer",
        over: {
          root: [0.6, -0.17, 0.02],
          hips: [0, 70, 0],
          spine: sub ? [26, 10, -6] : [18, 10, -14],
          chest: [8, 14, -10],
          legL: { p: [1.5, 0.5, 0.6], f: [0, 70, 0] },
          legR: { t: [0.2, 0.11, -0.02], f: [25, 30, 0] },
          armL: { t: [0.84, 1.12, 0.1], p: [1.0, 0.9, -0.3], h: [0, 0, 0] },
          armR: sub ? { t: [0.6, 1.4, 0.36], p: [0.9, 1.0, 0.8], h: [-60, 0, 0] } : { t: [0.6, 1.54, 0.29], p: [0.9, 1.4, 0.6], h: [-60, 0, 0] },
        },
        head: [90, 14 + hd],
      },
      {
        t: t0 + 0.28,
        e: "in",
        name: "release",
        over: {
          root: [0.62, -0.18, 0.04],
          hips: [0, 80, 0],
          spine: sub ? [26, 6, -10] : [20, 6, -22],
          chest: [8, 4, -12],
          legL: { p: [1.6, 0.5, 0.4], f: [0, 72, 0] },
          legR: { t: [0.38, 0.17, -0.06], p: [0.6, 0.5, 1], f: [40, 45, 0] },
          armL: { t: [0.66, 1.02, -0.08], p: [0.9, 0.8, -0.4], h: [0, 0, 0] },
          armR: { t: REL_WRIST.slice(), p: sub ? [1.0, 0.9, 0.3] : [1.0, 1.1, 0.0], h: [-30, 0, 0] },
        },
        head: [92, 18 + hd],
      },
      {
        t: t0 + 0.44,
        e: "out",
        name: "follow",
        over: {
          root: [0.66, -0.25, 0.08],
          hips: [0, 92, 0],
          spine: [40, 18, -8],
          chest: [16, 10, -4],
          legL: { p: [1.6, 0.5, 0.3], f: [0, 72, 0] },
          legR: { t: [0.82, 0.3, -0.3], p: [1.2, 0.6, 0.6], f: [55, 70, 0] },
          armL: { t: [0.64, 0.98, -0.16], p: [0.9, 0.8, -0.5] },
          armR: { t: [1.0, 0.7, -0.22], p: [0.9, 1.0, 0.5], h: [0, 0, 0] },
        },
        head: [92, 26 + hd],
      },
      {
        t: t0 + 0.62,
        e: "io",
        name: "recover",
        over: {
          root: [0.84, -0.22, 0.06],
          hips: [0, 92, 0],
          spine: [30, 10, -4],
          chest: [10, 4, 0],
          legR: { t: [0.98, 0.1, 0.18], p: [1.5, 0.5, 0.6], f: [10, 80, 0] },
          armL: { t: [1.0, 0.98, -0.12], p: [1.2, 0.8, -0.6] },
          armR: { t: [1.12, 0.8, 0.02], p: [1.2, 0.9, 0.6] },
        },
        head: [90, 12],
      },
      {
        t: t0 + 0.92,
        e: "io",
        name: "fieldPos",
        over: {
          root: [1.02, -0.16, 0.0],
          hips: [0, 90, 0],
          spine: [16, 0, 0],
          chest: [4, 0, 0],
          legL: { t: [1.1, 0.07, -0.2], p: [1.6, 0.5, -0.3], f: [0, 90, 0] },
          legR: { t: [0.98, 0.07, 0.24], p: [1.5, 0.5, 0.3], f: [0, 90, 0] },
          armL: { t: [1.36, 1.0, -0.06], p: [1.2, 0.9, -0.6], h: [-20, 90, 0] },
          armR: { t: [1.32, 1.0, 0.1], p: [1.2, 0.9, 0.6], h: [-20, 90, 0] },
        },
        head: [90, 6],
      },
    ];
  }
  // 足を上げて止める (pause 秒。pause2 は途中で少し下ろしてもう一度上げる = 二段モーション)
  function holdSteps(t, pause, two, legY) {
    if (!(pause > 0.03)) return [];
    if (!two || pause < 0.08) return [{ t: t + pause, e: "io", over: {} }];
    return [
      { t: t + pause / 2, e: "io", over: { legL: { t: [0.03, R3(legY - 0.14), 0.14] } } },
      { t: t + pause, e: "io", over: { legL: { t: [0.03, legY, 0.2] } } },
    ];
  }
  // 投球のクリップに印・切り替えを付ける (セットではボールはグラブ、腕を割る所から投げる手、リリースで離す)
  function pitClip(keys, t0, marks) {
    const rel = t0 + 0.28;
    const ev = [
      { t: 0, set: { ballHand: "glove" } },
      { t: R3(t0 - 0.04), set: { ballHand: "throw" } },
      { t: R3(rel), set: { ballHand: "none" } },
    ];
    Object.assign(marks, { footStrike: R3(t0 + 0.14), mer: R3(t0 + 0.22), release: R3(rel), end: R3(t0 + 0.92) });
    return mk("pitch", keys, marks, { events: ev, target: { t: R3(rel), p: REL_BALL.slice(), what: "release", hand: "R" } });
  }
  // 9. セットポジション (クイック気味の足上げ)。今の試合のリリース 0.86 秒 (pause が無いとき)
  function stretch(s) {
    s = sty(s);
    const set = pitSet();
    const ly = R3(0.06 + 0.28 * (0.6 + 0.4 * s.lift));
    const lift = { t: 0.3, e: "io", name: "lift", over: { root: [-0.04, -0.02, 0], hips: [0, -14, 0], chest: [-2, 2, 0], legL: { t: [0.16, ly, 0.1], p: [0.35, 1.0, 1.0], f: [25, 0, 0] }, armL: { t: [0.06, 1.2, 0.24] }, armR: { t: [0.03, 1.19, 0.21] } }, head: [84, 3] };
    const pz = s.pause > 0.03 ? s.pause : 0;
    const t0 = R3(0.58 + pz);
    const keys = A.seq(set, [{ t: 0, over: {} }, lift].concat(holdSteps(0.3, pz, false, ly), tail(t0, s)));
    return pitClip(keys, t0, { start: 0, lift: 0.3 });
  }
  // 8. 振りかぶって投げる (走者なし)。本塁の方を向いて始め (腰の向き)、軸足を投手板の前へ、足を上げて (balance)、セットと同じ投げ方へ
  function windup(s) {
    s = sty(s);
    const over = s.handsOver !== false;
    const face = P({
      root: [0, -0.02, 0],
      hips: [0, 80, 0],
      spine: [6, 4, 0],
      chest: [0, 4, 0],
      armL: { t: [0.24, 1.16, 0.02], p: [0.6, 0.9, -0.6], h: [0, 90, 80] },
      armR: { t: [0.22, 1.14, -0.02], p: [0.6, 0.9, 0.6], h: [0, 90, -80] },
      legL: { t: [0.0, 0.07, -0.16], p: [0.8, 0.5, -0.2], f: [0, 90, 0] },
      legR: { t: [0.06, 0.07, 0.15], p: [0.8, 0.5, 0.2], f: [0, 90, 0] },
    });
    headTo(face, 90, 4);
    const ly = R3(0.06 + 0.6 * s.lift);
    const pz = s.pause > 0.03 ? s.pause : 0;
    const t0 = R3(1.23 + pz);
    const keys = A.seq(
      face,
      [
        { t: 0, over: {} },
        {
          t: 0.35,
          e: "io",
          name: "handsUp",
          over: {
            root: [-0.08, -0.03, 0],
            hips: [0, 76, 0],
            spine: [-4, 4, 0],
            legL: { t: [-0.3, 0.07, -0.14] },
            armL: over ? { t: [0.08, 1.92, 0.03], p: [0.7, 1.6, -0.6] } : { t: [0.18, 1.42, 0.02] },
            armR: over ? { t: [0.06, 1.9, -0.01], p: [0.7, 1.6, 0.6] } : { t: [0.16, 1.4, -0.02] },
          },
          head: [90, 2],
        },
        {
          t: 0.6,
          e: "io",
          name: "pivot",
          over: {
            root: [-0.02, -0.03, 0],
            hips: [0, 30, 0],
            spine: [2, 2, 0],
            chest: [0, 10, 0],
            legR: { t: [0.07, 0.07, 0.0], p: [-0.2, 0.5, 1], f: [0, 0, 0] },
            legL: { t: [-0.04, 0.12, -0.05], p: [0.3, 0.8, 1], f: [10, 40, 0] },
            armL: { t: [0.06, 1.48, 0.16], p: [0.6, 1.2, -0.4], h: [0, 0, 80] },
            armR: { t: [0.03, 1.46, 0.14], p: [-0.6, 1.2, -0.4], h: [0, 0, -80] },
          },
          head: [88, 2],
        },
        {
          t: 0.95,
          e: "io",
          name: "balance",
          over: {
            root: [-0.03, -0.03, 0],
            hips: [0, -14, 0],
            spine: [0, 0, 0],
            chest: [-4, 6, 0],
            legL: { t: [0.03, ly, 0.2], p: [0.2, 1.2, 1.3], f: [35, 0, 0] },
            legR: { t: [0.07, 0.07, 0.0] },
            armL: { t: [0.04, 1.24, 0.3], p: [0.6, 1.0, -0.2], h: [0, 0, 80] },
            armR: { t: [0.01, 1.22, 0.27], p: [-0.6, 1.0, -0.2], h: [0, 0, -80] },
          },
          head: [80, 2],
        },
      ].concat(holdSteps(0.95, pz, s.pause2, ly), tail(t0, s))
    );
    const c = pitClip(keys, t0, { start: 0, balance: 0.95 });
    // 振りかぶりではボールはグラブの中 (両手が離れるまで)
    return c;
  }

  /* ======================================================
   *  捕手 (+Z = 投手、+X = 三塁側)
   * ====================================================== */
  function catcherBase() {
    return P({
      root: [0, -0.52, -0.06],
      spine: [18, 0, 0],
      chest: [6, 0, 0],
      armL: { t: [0.14, 0.82, 0.36], p: [0.7, 0.6, -0.1], h: [0, 0, 0] },
      armR: { t: [-0.2, 0.55, 0.06], p: [-0.6, 0.7, -0.3], h: [0, 0, 0] },
      legL: { t: [0.32, 0.07, 0.08], p: [0.8, 0.4, 1], f: [12, 20, 0] },
      legR: { t: [-0.32, 0.07, 0.04], p: [-0.8, 0.4, 1], f: [12, -20, 0] },
    });
  }
  // ミットの手首と向き: ボールがホーム上の (x, z) に来るとき、ポケットを (−x, z, 0.42 − give) に (低い球はミットを下へ向ける)
  function mitt(x, z, give) {
    const f = z > 0.5 ? [0.0, 1, -0.15] : [0.35, -0.2, -0.1];
    const n = z > 0.5 ? [0, 0.1, 1] : [0, 0.45, 1];
    const ball = [-x, z, 0.42 - (give || 0)];
    return { t: A.gloveWrist(ball, f, n), h: A.handFrame("L", f, n), ball, f, n };
  }
  // ミットをポケット m.ball に (届かなければ腰を落として前かがみに。ポケットの前後は 0.30〜0.50 で合わせる)
  const LIM_C = { x: 0.08, y: 0.18, z: 0.1, pitch: 36 };
  function mittTo(p, m) {
    p.armL.h = m.h;
    reachPocket(p, "L", m.ball, m.f, m.n, LIM_C, [0.3, 0.5]);
    return m.ball;
  }
  // 10. 捕球 (印: target = 構え, catch = 捕る, frame = 少しストライクゾーンへ寄せる)。ball / aim = [ホーム上の x, 高さ]
  function receive(ball, aim) {
    const bx = ball ? ball[0] : 0;
    const bz = ball ? ball[1] : 0.76;
    const ax = aim ? aim[0] : bx;
    const az = aim ? aim[1] : bz;
    const base = catcherBase();
    const tg = mitt(ax, az, 0);
    const k0 = A.M(base, { root: [R3(-ax * 0.65), base.root[1], base.root[2]], spine: [18, R3(-ax * 40), 0] });
    mittTo(k0, tg);
    headTo(k0, 0, -4);
    const k1 = A.M(k0, { armL: { t: [k0.armL.t[0], R3(k0.armL.t[1] - 0.03), R3(k0.armL.t[2] - 0.02)] } });
    const c = mitt(bx, bz, 0.05);
    const k2 = A.M(k0, { root: [R3(-bx * 0.65), R3(base.root[1] + Math.max(-0.08, (bz - 0.7) * 0.12)), -0.06], spine: [18, R3(-bx * 40), 0] });
    mittTo(k2, c);
    headTo(k2, Math.atan2(-bx, 0.42) / D2R, Math.atan2(1.1 - bz, 0.42) / D2R - 10);
    // フレーミング: ゾーンの中心 (x 0, 高さ 0.76) へ 4 cm 寄せる
    const fx = bx + Math.sign(-bx) * Math.min(0.04, Math.abs(bx));
    const fz = bz + Math.sign(0.76 - bz) * Math.min(0.04, Math.abs(0.76 - bz));
    const fr = mitt(fx, fz, 0.07);
    const k3 = A.M(k2, {});
    mittTo(k3, fr);
    const keys = [
      { t: 0, pose: k0, hold: "L" },
      { t: 0.25, pose: k1, e: "io" },
      { t: 0.45, pose: k2, e: "in", hold: "L" },
      { t: 0.55, pose: k3, e: "out", hold: "L" },
      { t: 1.1, pose: A.copyPose(k3), e: "io", hold: "L" },
    ];
    return mk("idle", keys, { target: 0, track: 0.25, catch: 0.45, frame: 0.55, end: 1.1 }, { events: [{ t: 0.45, set: { ballHand: "glove" } }], target: { t: 0.45, p: c.ball, what: "pocket", hand: "L" } });
  }
  // 11. 二塁へ送球 (投げる向き +X。しゃがんだ形から立ち上がって短く投げる)
  // 始めは捕球の形 (真ん中で捕った形) を体ごと +90° 回したもの (= 投手の方を向いたまま)。
  // 呼ぶ側は捕球 (+Z = 投手) からこの向き (+X = 二塁) に切り替えるとき、グループの向きを −90° 回して rig.rebaseYaw(−90) を呼ぶ。
  // そこから跳びながら右へ回って (yaw 0)、左肩を二塁へ向けて短く投げる
  function throw2B() {
    const m = mitt(0, 0.76, 0.07);
    const crouchT = A.M(catcherBase(), { yaw: 90, armL: { t: m.t, h: m.h } });
    headTo(crouchT, 0, -4);
    const keys = A.seq(crouchT, [
      { t: 0, over: {} },
      {
        t: 0.16,
        e: "out",
        name: "transfer",
        over: {
          yaw: 0,
          root: [0.05, -0.28, 0],
          hips: [0, -15, 0],
          spine: [10, -8, 0],
          chest: [0, -8, 0],
          legR: { t: [0.02, 0.1, 0.06], p: [-0.2, 0.5, 1], f: [0, 0, 0] },
          legL: { t: [0.32, 0.12, -0.04], p: [0.6, 0.5, 1], f: [0, 20, 0] },
          armL: { t: [0.12, 1.32, 0.16], p: [0.5, 1.0, -0.3], h: [0, 0, 60] },
          armR: { t: [0.09, 1.32, 0.14], p: [-0.5, 1.0, -0.4], h: [0, 0, -60] },
        },
        head: [88, 4],
      },
      {
        t: 0.3,
        e: "in",
        name: "cock",
        over: {
          root: [0.2, -0.16, 0],
          hips: [0, -10, 0],
          spine: [4, -14, -4],
          chest: [-2, -14, -4],
          legR: { t: [0.0, 0.07, 0.0], f: [0, 5, 0] },
          legL: { t: [0.62, 0.07, 0.02], p: [0.9, 0.5, 1], f: [0, 40, 0] },
          armL: { t: [0.52, 1.36, 0.2], p: [0.8, 1.2, -0.4], h: [0, 0, 40] },
          armR: { t: [-0.24, 1.62, -0.12], p: [-0.5, 1.1, -0.7], h: [-30, 0, 0] },
        },
        head: [88, 6],
      },
      {
        t: 0.38,
        e: "in",
        name: "release",
        over: {
          root: [0.32, -0.18, 0.02],
          hips: [0, 70, 0],
          spine: [22, 14, -8],
          chest: [10, 12, -6],
          legL: { p: [1.0, 0.5, 0.5], f: [0, 60, 0] },
          legR: { t: [0.1, 0.14, -0.04], p: [0.3, 0.5, 1], f: [35, 40, 0] },
          armL: { t: [0.42, 1.04, -0.02], p: [0.8, 0.8, -0.4], h: [0, 0, 0] },
          armR: { t: [0.66, 1.56, 0.18], p: [0.7, 1.0, -0.3], h: [-30, 0, 0] },
        },
        head: [90, 12],
      },
      {
        t: 0.56,
        e: "out",
        name: "follow",
        over: {
          root: [0.4, -0.22, 0.04],
          hips: [0, 84, 0],
          spine: [34, 14, -4],
          chest: [12, 8, 0],
          legR: { t: [0.5, 0.22, -0.2], p: [0.8, 0.6, 0.6], f: [45, 60, 0] },
          armL: { t: [0.5, 1.0, -0.1], p: [0.8, 0.8, -0.5] },
          armR: { t: [0.86, 0.78, -0.22], p: [0.8, 1.0, 0.5], h: [0, 0, 0] },
        },
        head: [92, 16],
      },
    ]);
    const ev = [
      { t: 0, set: { ballHand: "glove" } },
      { t: 0.16, set: { ballHand: "throw" } },
      { t: 0.38, set: { ballHand: "none" } },
    ];
    return mk("throw", keys, { catch: 0, transfer: 0.16, release: 0.38, end: 0.56 }, { events: ev });
  }

  /* ======================================================
   *  野手 (右投げ・グラブは左手。+Z = 向いている方)
   * ====================================================== */
  // 12. ゴロを両手で捕る (グラブ側)。ball = 捕る瞬間のボールの位置 (キャラクター空間 [x, 高さ, 前])
  function grounder(ball) {
    ball = ball || [0.12, 0.04, 0.44];
    const ready = P({
      root: [0, -0.2, -0.04],
      spine: [26, 0, 0],
      chest: [8, 0, 0],
      armL: { t: [0.22, 0.72, 0.34], p: [0.6, 0.9, -0.2], h: [-20, 0, 0] },
      armR: { t: [-0.22, 0.74, 0.32], p: [-0.6, 0.9, -0.2], h: [-20, 0, 0] },
      legL: { t: [0.26, 0.06, 0.06], p: [0.6, 0.6, 1], f: [0, 10, 0] },
      legR: { t: [-0.26, 0.06, -0.02], p: [-0.6, 0.6, 1], f: [0, -10, 0] },
    });
    headTo(ready, 0, 30);
    const fg = [0.0, -0.94, 0.34]; // 指は下・前
    const ng = [0.0, 0.34, 0.94]; // ポケットはボールの方
    const wrist = A.gloveWrist(ball, fg, ng);
    // 高く跳ねた球ほど低くかがまない
    const hy = clamp((ball[1] - 0.04) / 0.86, 0, 1);
    const keys = A.seq(ready, [
      { t: 0, over: {} },
      {
        t: 0.22,
        e: "io",
        name: "breakdown",
        over: {
          root: [0.02, R3(-0.46 + 0.22 * hy), -0.06],
          spine: [R3(58 - 30 * hy), 0, 0],
          chest: [12, 0, 0],
          legL: { t: [0.32, 0.06, 0.2], p: [0.8, 0.5, 1], f: [0, 15, 0] },
          legR: { t: [-0.3, 0.06, -0.08], p: [-0.8, 0.5, 1], f: [0, -25, 0] },
          armL: { t: [R3(wrist[0] + 0.02), R3(wrist[1] + 0.12), R3(wrist[2] - 0.04)], p: [0.7, 0.6, -0.1], h: A.handFrame("L", fg, ng) },
          armR: { t: [-0.04, R3(wrist[1] + 0.28), R3(wrist[2] - 0.08)], p: [-0.7, 0.8, -0.2], h: A.handFrame("R", [0, -0.6, 0.8], [0, -0.8, -0.6]) },
        },
        head: [0, 52],
      },
      {
        t: 0.4,
        e: "in",
        name: "field",
        over: { root: [0.02, R3(-0.52 + 0.26 * hy), -0.04], spine: [R3(66 - 36 * hy), 0, 0], chest: [14, 0, 0], armL: { t: wrist, h: A.handFrame("L", fg, ng) }, armR: { t: [-0.03, R3(wrist[1] + 0.2), R3(wrist[2] - 0.02)] } },
        head: [0, R3(58 - 30 * hy)],
      },
      {
        t: 0.55,
        e: "out",
        name: "funnel",
        over: {
          root: [0.0, -0.26, -0.06],
          spine: [24, 0, 0],
          chest: [6, 0, 0],
          armL: { t: [0.06, 0.98, 0.3], p: [0.6, 0.8, -0.3], h: A.handFrame("L", [0, 0.2, 1], [-1, 0, 0]) },
          armR: { t: [-0.02, 0.98, 0.28], p: [-0.6, 0.8, -0.3], h: [0, 0, 0] },
        },
        head: [0, 10],
      },
    ]);
    // 捕る瞬間: グラブのポケットをボールの高さに (届かなければ腰・前かがみ、それでも足りなければポケットの前後・左右を寄せる)
    const kf = keys[2].pose;
    const pk = reachPocket(kf, "L", ball.slice(), fg, ng, { x: 0.12, y: 0.12, z: 0.1, pitch: 18 }, [0.3, 0.62], [-0.06, 0.45]);
    const w = kf.armL.t;
    kf.armR.t = [-0.03, R3(w[1] + 0.2), R3(w[2] - 0.02)];
    const kb = keys[1].pose;
    kb.armL.t = [R3(w[0] + 0.02), R3(w[1] + 0.12), R3(w[2] - 0.04)];
    kb.armR.t = [-0.04, R3(w[1] + 0.28), R3(w[2] - 0.08)];
    keys[2].hold = "L";
    const ev = [
      { t: 0.4, set: { ballHand: "glove" } },
      { t: 0.5, set: { ballHand: "throw" } },
    ];
    return mk("field", keys, { catch: 0.4, transfer: 0.55, end: 0.55 }, { events: ev, target: { t: 0.4, p: pk, what: "pocket", hand: "L" } });
  }

  // 13. 送球 (投げる向き +X)。variant: 'quick' (30 m 未満、ステップなし) / 'hop' (クロウホップ) / 'long' (50 m を超える: 大きく踏み出して高く)
  function throwOf(variant) {
    const hop = variant !== "quick";
    const lng = variant === "long";
    const set = P({
      root: [0, -0.12, 0],
      hips: [0, -6, 0],
      spine: [8, -8, 0],
      chest: [0, -6, 0],
      armL: { t: [0.12, 1.2, 0.26], p: [0.6, 1.0, -0.3], h: [0, 0, 70] },
      armR: { t: [0.08, 1.18, 0.24], p: [-0.6, 1.0, -0.3], h: [0, 0, -70] },
      legL: { t: [0.3, 0.06, 0.02], p: [0.6, 0.5, 1], f: [0, 30, 0] },
      legR: { t: [-0.22, 0.06, 0.0], p: [-0.5, 0.5, 1], f: [0, 0, 0] },
    });
    headTo(set, 84, 2);
    const steps = [{ t: 0, over: {} }];
    if (hop)
      steps.push({
        t: 0.12,
        e: "io",
        name: "hop",
        over: {
          root: [0.1, -0.06, 0],
          legR: { t: [0.14, 0.2, -0.02], p: [0.0, 0.6, 1], f: [10, 0, 0] },
          legL: { t: [0.36, 0.14, 0.02] },
          armL: { t: [0.42, 1.32, 0.22], p: [0.8, 1.2, -0.3], h: [0, 0, 60] },
          armR: { t: [-0.28, 1.0, -0.12], p: [-0.6, 0.7, -0.6], h: [0, 0, -40] },
        },
        head: [84, 4],
      });
    const o = hop ? 0.12 : 0;
    steps.push(
      {
        t: o + 0.1,
        e: "in",
        name: "plant",
        over: {
          root: [0.3, -0.15, 0],
          hips: [0, 10, 0],
          spine: [6, -10, -4],
          chest: [-4, -16, -4],
          legR: { t: [0.14, 0.06, -0.02], p: [0.0, 0.5, 1], f: [0, 5, 0] },
          legL: { t: [lng ? 0.966 : 0.92, 0.06, 0.04], p: [1.2, 0.5, 1], f: [0, 55, 0] },
          armL: { t: [0.74, 1.34, 0.22], p: [0.9, 1.1, -0.3], h: [0, 0, 40] },
          armR: { t: [0.04, 1.6, -0.1], p: [-0.1, 1.3, -0.8], h: [-30, 0, -20] },
        },
        head: [86, 6],
      },
      {
        t: o + 0.17,
        e: "in",
        name: "mer",
        over: {
          root: [0.38, -0.16, 0.02],
          hips: [0, 64, 0],
          spine: [16, 8, -12],
          chest: [6, 10, -8],
          legR: { t: [0.22, 0.1, -0.02], f: [25, 30, 0] },
          armL: { t: [0.66, 1.1, 0.06], p: [0.9, 0.9, -0.3], h: [0, 0, 0] },
          armR: { t: [0.4, 1.52, 0.27], p: [0.7, 1.4, 0.6], h: [-60, 0, 0] },
        },
        head: [88, 10],
      },
      {
        t: o + 0.22,
        e: "in",
        name: "release",
        over: {
          root: [0.42, -0.17, 0.04],
          hips: [0, 78, 0],
          spine: [18, 6, -18],
          chest: [8, 4, -10],
          legL: { p: [1.4, 0.5, 0.4], f: [0, 65, 0] },
          legR: { t: [0.3, 0.16, -0.06], p: [0.5, 0.5, 1], f: [40, 45, 0] },
          armL: { t: [0.5, 1.02, -0.08], p: [0.8, 0.8, -0.4] },
          armR: { t: [0.78, lng ? 1.58 : 1.52, 0.42], p: [0.9, 1.1, 0.0], h: [-30, 0, 0] },
        },
        head: [90, 12],
      },
      {
        t: o + 0.4,
        e: "out",
        name: "follow",
        over: {
          root: [0.5, -0.22, 0.08],
          hips: [0, 90, 0],
          spine: [36, 16, -6],
          chest: [14, 8, -2],
          legR: { t: [0.66, 0.26, -0.28], p: [1.0, 0.6, 0.6], f: [50, 70, 0] },
          armL: { t: [0.52, 0.98, -0.16], p: [0.8, 0.8, -0.5] },
          armR: { t: [0.88, 0.72, -0.2], p: [0.8, 1.0, 0.5], h: [0, 0, 0] },
        },
        head: [92, 20],
      },
      {
        t: o + 0.75,
        e: "io",
        name: "recover",
        over: {
          root: [0.62, -0.12, 0.06],
          hips: [0, 80, 0],
          spine: [14, 4, 0],
          chest: [4, 0, 0],
          legR: { t: [0.74, 0.06, 0.12], p: [1.2, 0.5, 0.6], f: [0, 80, 0] },
          armL: { t: [0.72, 0.95, -0.12], p: [1.0, 0.8, -0.5] },
          armR: { t: [0.78, 1.0, 0.1], p: [1.0, 0.8, 0.6] },
        },
        head: [90, 6],
      }
    );
    const keys = A.seq(set, steps);
    const rel = R3(o + 0.22);
    const marks = { plant: R3(o + 0.1), release: rel, end: R3(o + 0.75) };
    if (hop) marks.hop = 0.12;
    const ev = [
      { t: 0, set: { ballHand: "throw" } },
      { t: rel, set: { ballHand: "none" } },
    ];
    return mk("throw", keys, marks, { events: ev });
  }
  // 距離 (m) で送球の型を選ぶ
  A.throwVariant = (d) => (d == null ? "hop" : d < 30 ? "quick" : d > 50 ? "long" : "hop");

  // 14. フライ: 落下点で待ち、グラブ側の目の上で両手で捕り、引いて持ち替える (ポケットは 1.95 m)
  const FLY_CATCH_Z = 1.95;
  A.FLY_CATCH_Z = FLY_CATCH_Z;
  function fly() {
    const fc = [0.0, 0.5, -0.87]; // 指は上・少し後ろ
    const nc = [0.0, 0.87, 0.5]; // ポケットは上・前 (落ちてくるボールの方)
    const pocket = [0.16, FLY_CATCH_Z, 0.22];
    const w = A.gloveWrist(pocket, fc, nc);
    const st = P({
      root: [0, -0.06, 0],
      spine: [4, 0, 0],
      armL: { t: [0.24, 0.98, 0.12], p: [0.6, 1.1, -0.6] },
      armR: { t: [-0.24, 0.98, 0.1], p: [-0.6, 1.1, -0.6] },
      legL: { t: [0.15, 0.06, 0.06] },
      legR: { t: [-0.15, 0.06, -0.06] },
    });
    headTo(st, 0, -50);
    const keys = A.seq(st, [
      { t: 0, over: {} },
      {
        t: 0.45,
        e: "io",
        name: "raise",
        over: {
          root: [0, -0.08, 0],
          spine: [-2, 0, 0],
          armL: { t: [R3(w[0] + 0.02), R3(w[1] - 0.14), R3(w[2] - 0.02)], p: [0.8, 1.4, -0.3], h: A.handFrame("L", fc, nc) },
          armR: { t: [-0.02, R3(w[1] - 0.16), R3(w[2] + 0.02)], p: [-0.7, 1.3, -0.3], h: A.handFrame("R", [0, 0.6, -0.8], [0.3, 0.75, 0.6]) },
        },
        head: [6, -52],
      },
      { t: 0.8, e: "in", name: "catch", over: { root: [0, -0.05, 0], spine: [-4, 0, 0], armL: { t: w }, armR: { t: [0.0, R3(w[1] - 0.08), R3(w[2] - 0.02)] } }, head: [8, -40] },
      {
        t: 0.95,
        e: "out",
        name: "give",
        over: {
          root: [0, -0.12, -0.04],
          spine: [10, 0, 0],
          armL: { t: [0.12, 1.42, 0.26], p: [0.7, 1.0, -0.4], h: A.handFrame("L", [0, 0.6, 0.8], [-0.6, 0.6, -0.5]) },
          armR: { t: [-0.04, 1.4, 0.26], p: [-0.7, 1.0, -0.4] },
        },
        head: [0, 10],
      },
      { t: 1.25, e: "io", name: "transfer", over: { root: [0, -0.1, 0], spine: [8, -10, 0], chest: [0, -10, 0], armL: { t: [0.1, 1.2, 0.28] }, armR: { t: [0.06, 1.18, 0.26] } }, head: [0, 6] },
    ]);
    const ev = [
      { t: 0.8, set: { ballHand: "glove" } },
      { t: 1.1, set: { ballHand: "throw" } },
    ];
    return mk("field", keys, { catch: 0.8, transfer: 1.1, end: 1.25 }, { events: ev, target: { t: 0.8, p: pocket, what: "pocket", hand: "L" } });
  }

  // 15. 一塁手の捕球 (右足をベースに、グラブ側の足を送球の方へ大きく踏み出す)。+Z = 投げた野手の方。
  // ballZ = 届くボールの高さ、side = 横のずれ (+ = グラブ側)。lunge = false で踏み出さない (ほかの塁の捕球)
  const BAG = [-0.12, 0.07, -0.05];
  function stretch1B(ballZ, side, lunge) {
    ballZ = ballZ == null ? 1.2 : ballZ;
    side = side || 0;
    const f = [0, 0.97, 0.25];
    const n = [0, -0.25, 0.97];
    const ws = A.gloveWrist([0.12, 1.12, 0.4], f, n);
    const set = P({
      root: [0.02, -0.12, 0],
      spine: [12, 0, 0],
      armL: { t: ws, p: [0.6, 0.9, -0.3], h: A.handFrame("L", f, n) },
      armR: { t: [-0.06, 1.08, 0.34], p: [-0.6, 0.9, -0.3] },
      legL: { t: [0.2, 0.07, 0.04], p: [0.5, 0.6, 1], f: [0, 10, 0] },
      legR: { t: [-0.12, 0.07, -0.04], p: [-0.5, 0.6, 1], f: [0, -10, 0] },
    });
    headTo(set, 0, 4);
    const low = Math.max(0, 1.1 - ballZ);
    const ln = lunge !== false;
    // 低い球 (膝より下) はグラブを下向きにすくう
    const dn = ballZ < 0.75;
    const fc = dn ? [0, -0.9, 0.42] : f;
    const nc = dn ? [0, 0.42, 0.9] : n;
    const hc = A.handFrame("L", fc, nc);
    let pk;
    let over;
    if (ln) {
      pk = [R3(0.14 + side), R3(Math.max(0.3, ballZ - 0.05)), R3(1.02 - 0.5 * Math.max(0, ballZ - 1.2))];
      // 低い球は腰を落とすより前へ深くかがむ (ベースの上の後ろ足をのばしたまま)
      over = {
        root: [R3(0.04 + side * 0.5), R3(-0.3 - low * 0.1), R3(0.34 + 0.2 * clamp(low / 0.7, 0, 1))],
        spine: [R3(30 + low * 60), R3(side * -20), 0],
        chest: [6, 0, 0],
        legL: { t: [R3(0.22 + side), 0.07, 1.0], p: [0.6, 0.6, 1.8], f: [0, 0, 0] },
        legR: { t: [-0.12, 0.08, -0.06], p: [-0.5, 0.5, 1], f: [16, -10, 0] },
        armL: { p: [0.7, 0.8, 0.4], h: hc },
        armR: { p: [-0.7, 0.8, 0.2] },
      };
    } else {
      // 踏み出さない: 胸の前で捕る (低い球は膝を曲げて前かがみ)
      pk = [R3(0.14 + side), R3(clamp(ballZ - 0.05, 0.3, 1.75)), 0.5];
      const lo = Math.max(0, 1.0 - ballZ);
      over = {
        root: [R3(0.02 + side * 0.3), R3(-0.14 - lo * 0.3), 0.06],
        spine: [R3(14 + lo * 40), R3(side * -20), 0],
        chest: [4, 0, 0],
        legL: { t: [R3(0.22 + side * 0.5), 0.07, 0.3], p: [0.6, 0.6, 1.2], f: [0, 0, 0] },
        legR: { t: [-0.12, 0.07, -0.06], p: [-0.5, 0.5, 1], f: [0, -10, 0] },
        armL: { p: [0.7, 0.8, -0.2], h: hc },
        armR: { p: [-0.7, 0.8, 0.0] },
      };
    }
    const keys = A.seq(set, [
      { t: 0, over: {} },
      { t: 0.25, e: "out", name: "catch", over, head: [0, 16] },
      {
        t: 0.6,
        e: "io",
        name: "recover",
        over: { root: [0.02, -0.12, 0.04], spine: [10, 0, 0], chest: [2, 0, 0], legL: { t: [0.22, 0.07, 0.2] }, legR: { t: [-0.12, 0.07, -0.04], f: [0, -10, 0] }, armL: { t: [0.08, 1.12, 0.3], p: [0.6, 0.9, -0.3] }, armR: { t: [-0.02, 1.1, 0.28], p: [-0.6, 0.9, -0.3] } },
        head: [-20, 4],
      },
    ]);
    // 捕る瞬間のポケットを届く所に (高さはボール。前後・左右は少し寄せてよい: 置く位置はポケットを基準にする)
    const kc = keys[1].pose;
    reachPocket(kc, "L", pk, fc, nc, ln ? { x: 0.1, y: 0.08, z: 0.08, pitch: 24 } : { x: 0.1, y: 0.3, z: 0.1, pitch: 40 }, ln ? [0.5, 1.05] : [0.3, 0.6], [R3(pk[0] - 0.16), R3(pk[0] + 0.16)]);
    const wc = kc.armL.t;
    kc.armR.t = [0.0, R3(wc[1] + 0.02), R3(wc[2] - 0.12)];
    keys[1].hold = "L";
    return mk("field", keys, { catch: 0.25, end: 0.6 }, { events: [{ t: 0.25, set: { ballHand: "glove" } }], target: { t: 0.25, p: pk, what: "pocket", hand: "L" }, bag: ln ? BAG.slice() : null });
  }

  /* ======================================================
   *  走者・審判
   * ====================================================== */
  // 16. 足から滑る (+Z = 走る方向)。印: down = 尻が着く, touch = 前の足がベースに。leadZ = 前の足の Z (足を基準に置く)
  function slideRunPose() {
    const mem = { ph: Math.PI * 0.5, accT: 2, vs: 7.8, yawPrev: null, yawRate: 0 };
    return A.copyPose(A.runCycle(mem, 7.8, 0, { arms: "run" }));
  }
  function slideFeet() {
    const take = P({
      root: [0, -0.14, 0.02],
      spine: [4, 0, 0],
      head: [-6, 0, 0],
      armL: { t: [0.28, 1.12, 0.12], p: [0.7, 1.1, -0.5] },
      armR: { t: [-0.28, 1.1, 0.1], p: [-0.7, 1.1, -0.5] },
      legL: { t: [0.1, 0.32, 0.5], p: [0.2, 0.9, 1.3], f: [-20, 0, 0] },
      legR: { t: [-0.1, 0.06, -0.12], p: [-0.2, 0.5, 1], f: [20, 0, 0] },
    });
    const down = P({
      root: [0, -0.68, -0.12],
      hips: [-30, 0, 0],
      spine: [6, 0, 0],
      chest: [8, 0, 0],
      head: [26, 0, 0],
      armL: { t: [0.34, 0.86, -0.02], p: [0.8, 0.9, -0.4], h: [0, 0, 0] },
      armR: { t: [-0.34, 0.84, -0.04], p: [-0.8, 0.9, -0.4], h: [0, 0, 0] },
      legL: { t: [0.08, 0.12, 0.6], p: [0.2, 0.9, 1.2], f: [-50, 0, 0] },
      legR: { t: [-0.08, 0.08, 0.22], p: [-0.8, 0.35, 0.6], f: [-10, -40, 50] },
    });
    const touch = P({
      root: [0, -0.72, -0.14],
      hips: [-34, 0, 0],
      spine: [2, 0, 0],
      chest: [6, 0, 0],
      head: [30, 0, 0],
      armL: { t: [0.36, 0.86, -0.06], p: [0.8, 0.9, -0.4] },
      armR: { t: [-0.36, 0.84, -0.08], p: [-0.8, 0.9, -0.4] },
      legL: { t: [0.06, 0.1, 0.64], p: [0.2, 0.9, 1.2], f: [-60, 0, 0] },
      legR: { t: [-0.06, 0.07, 0.24], p: [-0.8, 0.3, 0.6], f: [-10, -40, 50] },
    });
    const rest = P({
      root: [0, -0.74, -0.16],
      hips: [-38, 0, 0],
      spine: [0, 0, 0],
      chest: [4, 0, 0],
      head: [34, 0, 0],
      armL: { t: [0.4, 0.82, -0.12], p: [0.8, 0.9, -0.4] },
      armR: { t: [-0.4, 0.8, -0.14], p: [-0.8, 0.9, -0.4] },
      legL: { t: [0.06, 0.08, 0.66], p: [0.2, 0.9, 1.2], f: [-60, 0, 0] },
      legR: { t: [-0.06, 0.07, 0.24], p: [-0.8, 0.3, 0.6], f: [-10, -40, 50] },
    });
    const keys = [
      { t: 0, pose: slideRunPose() },
      { t: 0.08, pose: take, e: "io" },
      { t: 0.18, pose: down, e: "in" },
      { t: 0.33, pose: touch, e: "out" },
      { t: 0.7, pose: rest, e: "io" },
    ];
    const leadZ = [
      [0, 0.3],
      [0.08, 0.5],
      [0.18, 0.6],
      [0.33, 0.64],
      [0.7, 0.66],
    ];
    return mk("slide", keys, { down: 0.18, touch: 0.33, end: 0.7 }, { leadZ });
  }
  // leadZ の表を時刻 t で読む (直線)
  A.leadZAt = function (clip, t) {
    const L = clip.leadZ;
    if (!L || !L.length) return 0;
    if (t <= L[0][0]) return L[0][1];
    for (let i = 1; i < L.length; i++) if (t <= L[i][0]) return L[i - 1][1] + ((L[i][1] - L[i - 1][1]) * (t - L[i - 1][0])) / Math.max(1e-6, L[i][0] - L[i - 1][0]);
    return L[L.length - 1][1];
  };

  // 17. 球審のストライク (立ち上がって右手を振り上げ、前へ突き出す)。印 rise は塁審のアウトに使う (rise から)
  function umpStrike() {
    const set = P({
      root: [0, -0.28, -0.05],
      spine: [32, 0, 0],
      chest: [6, 0, 0],
      head: [-26, 0, 0],
      armL: { t: [0.16, 0.95, 0.22], p: [0.7, 1, -0.4] },
      armR: { t: [-0.16, 0.95, 0.22], p: [-0.7, 1, -0.4] },
      legL: { t: [0.32, 0.06, 0.12], p: [0.6, 0.5, 1] },
      legR: { t: [-0.3, 0.06, -0.08], p: [-0.6, 0.5, 1] },
    });
    const keys = A.seq(set, [
      { t: 0, over: {} },
      { t: 0.2, e: "io", name: "rise", over: { root: [0, -0.08, -0.02], spine: [8, 0, 0], head: [-6, 0, 0], legL: { t: [0.24, 0.06, 0.06] }, legR: { t: [-0.24, 0.06, -0.04] }, armL: { t: [0.24, 0.95, 0.1], p: [0.6, 1.1, -0.6] }, armR: { t: [-0.26, 1.08, 0.12] } } },
      { t: 0.34, e: "in", name: "hammer", over: { spine: [4, -14, 0], chest: [0, -8, 0], armR: { t: [-0.36, 1.66, 0.12], p: [-0.9, 1.4, -0.4], h: [0, 0, 0] } }, head: [-30, 4] },
      { t: 0.46, e: "out", name: "call", over: { root: [0, -0.12, 0.0], spine: [12, -22, 0], chest: [4, -10, 0], legR: { t: [-0.34, 0.06, -0.02] }, armR: { t: [-0.46, 1.3, 0.34], p: [-0.9, 1.2, -0.2] } }, head: [-34, 6] },
      { t: 1.0, e: "io", over: {} },
    ]);
    return mk("umpire", keys, { rise: 0.2, call: 0.46, end: 1.0 });
  }
  // セーフ (両腕を交差してから大きく広げる、2 回)
  function umpSafe() {
    const st = P({ root: [0, -0.12, 0], spine: [16, 0, 0], armL: { t: [0.2, 0.9, 0.28], p: [0.6, 1, -0.4] }, armR: { t: [-0.2, 0.9, 0.28], p: [-0.6, 1, -0.4] }, legL: { t: [0.24, 0.06, 0.02] }, legR: { t: [-0.24, 0.06, 0.0] } });
    headTo(st, 0, 25);
    const wide = { armL: { t: [0.68, 1.32, 0.12], p: [0.6, 1.8, -0.4], h: [0, 0, 90] }, armR: { t: [-0.68, 1.32, 0.12], p: [-0.6, 1.8, -0.4], h: [0, 0, -90] } };
    const cross = { armL: { t: [-0.06, 1.3, 0.36], p: [0.5, 1.6, 0.2], h: [0, 0, 90] }, armR: { t: [0.04, 1.26, 0.34], p: [-0.5, 1.6, 0.2], h: [0, 0, -90] } };
    const keys = A.seq(st, [
      { t: 0, over: {} },
      { t: 0.14, e: "in", over: Object.assign({ root: [0, -0.18, 0], spine: [20, 0, 0] }, cross) },
      { t: 0.3, e: "out", name: "call", over: Object.assign({ root: [0, -0.22, 0], spine: [24, 0, 0] }, wide) },
      { t: 0.46, e: "io", over: cross },
      { t: 0.62, e: "out", over: wide },
      { t: 1.1, e: "io", over: { armL: { t: [0.3, 0.95, 0.12], p: [0.6, 1.1, -0.6], h: [0, 0, 0] }, armR: { t: [-0.3, 0.95, 0.12], p: [-0.6, 1.1, -0.6], h: [0, 0, 0] }, root: [0, -0.06, 0], spine: [6, 0, 0] } },
    ]);
    return mk("umpire", keys, { call: 0.3, end: 1.1 });
  }

  /* ---------- ミートの点からバットの位置を決める ----------
   * o = {bz: ミートの高さ, away: 外角へのずれ (m、+ が外), phi: 打球の方向 (度、pitch.js の res.phi) | null (空振り),
   *      side: 'R' | 'L', early: 早さ (秒、P.idealTime − (sw.t + 0.12)), vball: 球速 (m/秒), e, W, inside (空振りの向き)}
   * 芯を通す点 S = [0.28 + 球速·早さ, bz, 0.78 + away] (打者は 0.78 m に立つ)。ヘッドの下がり below は低い球・外角ほど大きく、
   * 向き az は打球の方向と直角 (引っ張りほど前)。空振りはタイミングとコースから (pitch.js の pull と同じ式) */
  A.swingSolve = function (o, out) {
    o = o || {};
    const r = out || {};
    const R = o.side !== "L";
    const away = clamp(num(o.away, 0), -0.3, 0.3);
    const bz = clamp(num(o.bz, 0.8), 0.4, 1.2);
    const x = clamp(0.28 + num(o.vball, 0) * num(o.early, 0), 0.12, 0.45);
    const S = [R3(x), R3(bz), R3(BOX + away)];
    const below = clamp(10 + (0.95 - bz) * 55 + Math.max(0, away) * 40, -5, 50);
    let az;
    if (o.phi != null && isFinite(o.phi)) az = clamp(R ? -o.phi : o.phi, -45, 45);
    else az = clamp((-num(o.e, 0) / num(o.W, 0.085)) * 36 + (num(o.inside, 0) / 0.25) * 9, -40, 40);
    const d = A.batDir(below, az);
    r.S = S;
    r.below = R3(below);
    r.az = R3(az);
    r.d = d;
    r.g = A.gripFor(S, d, A.BAT_SWEET);
    return r;
  };

  /* ---------- 登録 ---------- */
  const sk = (p) => sty(p && p.style).key;
  A.def("bat.stance", (p) => mk("idle", [{ t: 0, pose: stance(p.style) }], {}));
  A.def("bat.load", (p) => load(p.style));
  A.def("bat.swing", (p) => swing(p.style, p.ct), (p) => sk(p) + "|" + ctKey(p.ct));
  A.def("bat.take", (p) => take(p.style));
  A.def("bat.check", (p) => check(p.style));
  A.def("bat.bunt", (p) => bunt(p.style, p.S), (p) => sk(p) + "|" + (p.S ? p.S.map((v) => R3(qz(v, 0.02))).join(",") : "-"));
  A.def(
    "bat.dropRun",
    (p) => dropRun(p.style, p.swing, p.lhb),
    (p) => sk(p) + "|" + (p.swing ? p.swing.key || p.swing.name || "x" : "-") + "|" + (p.lhb ? 1 : 0)
  );
  A.def("pit.windup", (p) => windup(p.style));
  A.def("pit.stretch", (p) => stretch(p.style));
  A.def("cat.receive", (p) => receive(p.ball, p.aim));
  A.def("cat.throw2B", () => throw2B());
  A.def("fld.grounder", (p) => grounder(p.ball));
  A.def(
    "fld.throw",
    (p) => throwOf(p.variant || (p.hop === false || p.hop === 0 ? "quick" : A.throwVariant(p.d))),
    (p) => p.variant || (p.hop === false || p.hop === 0 ? "quick" : A.throwVariant(p.d))
  );
  A.def("fld.fly", () => fly());
  A.def("fld.firstStretch", (p) => stretch1B(p.ballZ, p.side, true));
  A.def("fld.receive", (p) => stretch1B(p.ballZ, p.side, false));
  A.def("run.slideFeet", () => slideFeet());
  A.def("ump.strike", () => umpStrike());
  A.def("ump.safe", () => umpSafe());
})((window.PB = window.PB || {}));
