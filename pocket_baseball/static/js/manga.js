/* 熱闘！ポケットベースボール — マンガ風のキャラクター (サクセス用)
 * 太い墨の輪郭・ベタの影・スクリーントーンで描く胸から上の絵。SVG の文字列を作って HTML に埋め込む。
 * 座標は 200x240 (顔の中心 x=100)。帽子・服は自分のチームの色とマーク。 */
(function (PB) {
  "use strict";
  const M = {};
  const INK = "#161412";
  const EXPRS = ["normal", "happy", "angry", "serious", "surprised", "sad"];
  M.EXPRS = EXPRS;
  M.EX_JP = { normal: "ふつう", happy: "笑顔", angry: "怒り", serious: "真剣", surprised: "おどろき", sad: "しょんぼり" };

  /* ---------- 小さな道具 ---------- */
  const n = (v) => Math.round(v * 10) / 10;
  const mx = (p) => [200 - p[0], p[1], p[2]];
  function hex(c) {
    let s = String(c || "#888").replace("#", "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const v = parseInt(s, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  // a と b を t の割合で混ぜる
  function mix(a, b, t) {
    const x = hex(a);
    const y = hex(b);
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function lum(c) {
    const [r, g, b] = hex(c);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function dist(a, b) {
    const x = hex(a);
    const y = hex(b);
    return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
  }
  // 影の色 (明るい色は暗く、暗い色は少しだけ)
  const shadeOf = (c, k) => mix(c, "#1a1030", (k || 0.28) * (lum(c) < 0.25 ? 0.6 : 1));
  const lightOf = (c, k) => mix(c, "#ffffff", k || 0.3);
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const escA = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  // 点列をなめらかにつなぐ (Catmull-Rom → 3 次ベジェ)。点の 3 番目が 1 なら角にする
  function curve(pts, closed) {
    const m = pts.length;
    let d = "M" + n(pts[0][0]) + " " + n(pts[0][1]);
    const segs = closed ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % m];
      const p0 = closed ? pts[(i - 1 + m) % m] : pts[Math.max(0, i - 1)];
      const p3 = closed ? pts[(i + 2) % m] : pts[Math.min(m - 1, i + 2)];
      const k1 = p1[2] ? 0 : 1 / 6;
      const k2 = p2[2] ? 0 : 1 / 6;
      d += "C" + n(p1[0] + (p2[0] - p0[0]) * k1) + " " + n(p1[1] + (p2[1] - p0[1]) * k1) + " " + n(p2[0] - (p3[0] - p1[0]) * k2) + " " + n(p2[1] - (p3[1] - p1[1]) * k2) + " " + n(p2[0]) + " " + n(p2[1]);
    }
    return d + (closed ? "Z" : "");
  }
  // 左半分 (中心線上の点から始まり中心線上の点で終わる) から左右対称の閉じた形を作る
  const sym = (half) => half.concat(half.slice(1, -1).reverse().map(mx));

  // Catmull-Rom の上の点を細かく取る
  function sample(pts, per) {
    const out = [];
    const m = pts.length;
    if (m === 2) {
      for (let s = 0; s <= per; s++) out.push([pts[0][0] + ((pts[1][0] - pts[0][0]) * s) / per, pts[0][1] + ((pts[1][1] - pts[0][1]) * s) / per]);
      return out;
    }
    for (let i = 0; i < m - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(m - 1, i + 2)];
      for (let s = 0; s < per; s++) {
        const t = s / per;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[m - 1].slice(0, 2));
    return out;
  }
  // 筆の線: 入りと抜きが細くなる塗りの形。o: {s0, e0 (両端の太さの割合), a, b (細くなる長さの割合), fill}
  function brush(pts, w, o) {
    o = o || {};
    const s = sample(pts, o.per || 8);
    const len = [0];
    for (let i = 1; i < s.length; i++) len.push(len[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
    const tot = len[len.length - 1] || 1;
    const a = o.a == null ? 0.3 : o.a;
    const b = o.b == null ? 0.35 : o.b;
    const s0 = o.s0 == null ? 0.15 : o.s0;
    const e0 = o.e0 == null ? 0.1 : o.e0;
    const ease = (x) => Math.sin((Math.min(1, Math.max(0, x)) * Math.PI) / 2);
    const L = [];
    const Rr = [];
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      const q0 = s[Math.max(0, i - 1)];
      const q1 = s[Math.min(s.length - 1, i + 1)];
      let tx = q1[0] - q0[0];
      let ty = q1[1] - q0[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const t = len[i] / tot;
      const f1 = t < a ? s0 + (1 - s0) * ease(t / a) : 1;
      const f2 = 1 - t < b ? e0 + (1 - e0) * ease((1 - t) / b) : 1;
      const hw = (w * f1 * f2) / 2;
      L.push(n(p[0] - ty * hw) + " " + n(p[1] + tx * hw));
      Rr.push(n(p[0] + ty * hw) + " " + n(p[1] - tx * hw));
    }
    return '<path d="M' + L.join("L") + "L" + Rr.reverse().join("L") + 'Z" fill="' + (o.fill || INK) + '"' + (o.op ? ' fill-opacity="' + o.op + '"' : "") + "/>";
  }
  // 輪郭つきの塗り
  function shape(d, fill, sw, extra) {
    return '<path d="' + d + '" fill="' + (fill || "none") + '"' + (sw ? ' stroke="' + INK + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"' : "") + (extra || "") + "/>";
  }
  const fillP = (d, fill, op) => '<path d="' + d + '" fill="' + fill + '"' + (op != null ? ' fill-opacity="' + op + '"' : "") + "/>";
  // 平行な斜線 (ハッチング): 線分 (x0,y0)-(x1,y1) に沿って k 本、角度 ang・長さ len
  function hatch(x0, y0, x1, y1, k, len, ang, w, col, op) {
    let s = "";
    const c = Math.cos(ang);
    const si = Math.sin(ang);
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 0.5 : i / (k - 1);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const l = len * (0.75 + 0.25 * Math.sin(i * 2.3 + 1));
      s += brush(
        [
          [x - (c * l) / 2, y - (si * l) / 2],
          [x + (c * l) / 2, y + (si * l) / 2],
        ],
        w,
        { fill: col, op, a: 0.4, b: 0.5, s0: 0.2, e0: 0.05, per: 4 }
      );
    }
    return s;
  }

  /* ---------- チームの見た目 ---------- */
  const DEF_TEAM = { main: "#3c4654", sub: "#ffffff", cap: "#1d222b", mark: "K" };
  function look(team) {
    const t = team || DEF_TEAM;
    const D = PB.D || {};
    const def = (t.id && D.teamDef && D.teamDef(t.id)) || null;
    const cs = (def && def.capStyle) || {};
    const home = (def && def.home) || {};
    const main = t.main || DEF_TEAM.main;
    const sub = t.sub || "#ffffff";
    const cap = t.cap || DEF_TEAM.cap;
    const mark = cs.mark ? (D.asset ? D.asset(cs.mark) : cs.mark) : null;
    // ジャンパーは帽子の色、縁取りはチームカラー (同じ色なら副色)
    const jacket = dist(cap, "#ffffff") < 60 ? main : cap;
    let trim = main;
    if (dist(trim, jacket) < 90) trim = sub;
    if (dist(trim, jacket) < 90) trim = "#ffffff";
    let piping = (home.piping && home.piping[0]) || main;
    if (dist(piping, home.jersey || "#f6f5f0") < 90) piping = cap;
    return {
      key: (t.id || "x") + main + cap + (t.mark || ""),
      main,
      sub,
      cap,
      crown: cs.crown || cap,
      brim: cs.brim || cs.crown || cap,
      button: cs.button || cs.crown || cap,
      stripes: cs.stripes || null,
      mark,
      markText: cs.markText || t.mark || "",
      markStyle: cs.markStyle || "",
      markColor: cs.markColor || (dist(sub, cs.crown || cap) < 90 ? "#ffffff" : sub),
      markOutline: cs.markOutline || null,
      markFont: cs.markFont || "Graduate",
      jersey: home.jersey || "#f6f5f0",
      piping,
      under: (def && def.under) || cap,
      jacket,
      trim,
    };
  }
  M.look = look;

  /* ---------- 背景のコマ ---------- */
  function panel(g) {
    const id = g.id;
    const ex = g.ex;
    const bgc = { normal: "#f6f0e1", happy: "#fff3d2", angry: "#ffe2d2", serious: "#e6e9ee", surprised: "#eef3f7", sad: "#e2e7ef" }[ex] || "#f6f0e1";
    let s = '<rect x="-20" y="-20" width="240" height="280" fill="' + bgc + '"/>';
    if (!g.det) return s;
    // スクリーントーン (網点) は下からぼかす
    s += '<rect x="-20" y="-20" width="240" height="280" fill="url(#' + id + 'dot)" mask="url(#' + id + 'fm)"/>';
    const r = rng(hash(g.who + ex));
    if (ex === "angry") {
      // ベタフラッシュ: 外側から黒い棘
      let d = "";
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2 + r() * 0.05;
        const r0 = 92 + r() * 30;
        const w = 0.035 + r() * 0.03;
        const P = (aa, rr) => n(100 + Math.cos(aa) * rr) + " " + n(112 + Math.sin(aa) * rr * 1.15);
        d += "M" + P(a - w, 190) + "L" + P(a, r0) + "L" + P(a + w, 190) + "Z";
      }
      s += fillP(d, INK, 0.9);
    } else if (ex === "serious") {
      // 斜めの効果線 (張りつめた空気)
      let d = "";
      for (let i = 0; i < 34; i++) {
        const x = -60 + i * 9.5 + r() * 3;
        const w = 0.6 + r() * 1.4;
        d += "M" + n(x) + " -20l" + n(w) + " 0l-150 280l-" + n(w) + " 0Z";
      }
      s += fillP(d, "#2a3448", 0.45);
      s += fillP("M-20 -20H220V70C150 40 60 40 -20 70Z", "#2a3448", 0.18);
    } else if (ex === "surprised") {
      // 集中線
      let d = "";
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + r() * 0.06;
        const r0 = 88 + r() * 34;
        const w = 0.006 + r() * 0.01;
        const P = (aa, rr) => n(100 + Math.cos(aa) * rr) + " " + n(112 + Math.sin(aa) * rr * 1.15);
        d += "M" + P(a - w, 190) + "L" + P(a, r0) + "L" + P(a + w, 190) + "Z";
      }
      s += fillP(d, INK, 0.85);
    } else if (ex === "happy") {
      // きらきら
      for (let i = 0; i < 6; i++) {
        const x = i % 2 ? 160 + r() * 30 : 8 + r() * 30;
        const y = 20 + r() * 120;
        const k = 4 + r() * 6;
        s += fillP("M" + n(x) + " " + n(y - k * 1.6) + "Q" + n(x + k * 0.18) + " " + n(y - k * 0.18) + " " + n(x + k) + " " + n(y) + "Q" + n(x + k * 0.18) + " " + n(y + k * 0.18) + " " + n(x) + " " + n(y + k * 1.6) + "Q" + n(x - k * 0.18) + " " + n(y + k * 0.18) + " " + n(x - k) + " " + n(y) + "Q" + n(x - k * 0.18) + " " + n(y - k * 0.18) + " " + n(x) + " " + n(y - k * 1.6) + "Z", i % 3 ? "#ffffff" : "#ffd23f") + "";
      }
      s += fillP("M-20 -20H220V40C150 62 50 62 -20 40Z", "#ffffff", 0.35);
    } else if (ex === "sad") {
      // どんより縦線
      let d = "";
      for (let i = 0; i < 26; i++) {
        const x = 4 + i * 7.6 + r() * 2;
        const h = 30 + r() * 60;
        d += "M" + n(x) + " -2h" + n(0.8 + r() * 0.9) + "V" + n(h) + "Z";
      }
      s += fillP(d, "#3a4660", 0.55);
    }
    return s;
  }
  function defs(g) {
    const id = g.id;
    if (!g.det) return "";
    return (
      "<defs>" +
      '<pattern id="' +
      id +
      'dot" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1.15" fill="#1a2030" fill-opacity=".38"/></pattern>' +
      '<linearGradient id="' +
      id +
      'fg" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
      '<mask id="' +
      id +
      'fm"><rect x="-20" y="-20" width="240" height="280" fill="url(#' +
      id +
      'fg)"/></mask>' +
      '<pattern id="' +
      id +
      'tone" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="1.6" cy="1.6" r=".8" fill="#000" fill-opacity=".35"/></pattern>' +
      "</defs>"
    );
  }

  /* ---------- 体・服 ---------- */
  // 首: hw = 首の半分の幅
  function neck(g, hw, top) {
    const sk = g.skin;
    const x0 = 100 - hw;
    const x1 = 100 + hw;
    const t = top || 140;
    const d = "M" + x0 + " " + t + "C" + (x0 + 1) + " " + (t + 20) + " " + (x0 - 1) + " 180 " + (x0 - 3) + " 200L" + (x1 + 3) + " 200C" + (x1 + 1) + " 180 " + (x1 - 1) + " " + (t + 20) + " " + x1 + " " + t + "Z";
    let s = shape(d, sk, 3);
    // あごの下の影
    s += fillP("M" + (x0 + 1) + " " + (t + 8) + "C" + (x0 + 10) + " " + (t + 30) + " " + (x1 - 10) + " " + (t + 30) + " " + (x1 - 1) + " " + (t + 8) + "V" + t + "H" + (x0 + 1) + "Z", g.skinS);
    if (g.det && g.male) {
      // 首すじ
      s += brush(
        [
          [x0 + 4, t + 22],
          [x0 + 9, t + 34],
          [x0 + 13, t + 42],
        ],
        1.6,
        { op: 0.8 }
      );
      s += brush(
        [
          [x1 - 4, t + 22],
          [x1 - 9, t + 34],
          [x1 - 13, t + 42],
        ],
        1.6,
        { op: 0.8 }
      );
      s += hatch(x1 - 9, t + 24, x1 - 3, t + 40, 4, 8, -1.1, 1, INK, 0.6);
    }
    return s;
  }
  // 肩から下の形 (左半分の肩の線: 首の付け根 → 画面の外)
  function torso(sh) {
    // sh: [[首の付け根 x, y], [肩 x, y], [画面の端 x, y]]
    const L = [[sh[2][0], 250], sh[2], sh[1], sh[0]];
    const R = L.slice().reverse().map(mx);
    return curve(L.concat(R), true);
  }
  const SHOULDER = {
    std: [
      [74, 170],
      [24, 192],
      [-6, 212],
    ],
    big: [
      [66, 164],
      [16, 182],
      [-8, 198],
    ],
    slim: [
      [79, 172],
      [28, 196],
      [-4, 216],
    ],
    girl: [
      [84, 168],
      [38, 192],
      [14, 214],
    ],
  };
  // ユニフォーム (ホームの白地にチームカラーのパイピング、アンダーシャツ)
  function jersey(g, build, hw) {
    const L = g.L;
    const sh = SHOULDER[build];
    const cid = g.id + "cl";
    const body = torso(sh);
    const vy = 210;
    let s = "";
    // アンダーシャツ (丸首)
    s += shape("M" + (100 - hw - 4) + " 166C" + (100 - hw + 4) + " 182 " + (100 + hw - 4) + " 182 " + (100 + hw + 4) + " 166L" + (100 + hw + 12) + " 230L" + (100 - hw - 12) + " 230Z", L.under, 2.6);
    s += brush(
      [
        [100 - hw + 1, 172],
        [100, 181],
        [100 + hw - 1, 172],
      ],
      1.4,
      { fill: lum(L.under) < 0.3 ? "#ffffff" : INK, op: 0.35 }
    );
    // 身ごろ (V ネック)
    const neckL = sh[0][0] - 2;
    const d = body.replace("Z", "") + "Z";
    s += '<clipPath id="' + cid + '"><path d="' + d + '"/></clipPath>';
    const vd = "M" + neckL + " " + (sh[0][1] - 3) + "L100 " + vy + "L" + (200 - neckL) + " " + (sh[0][1] - 3) + "L" + (200 - neckL) + " " + (sh[0][1] - 30) + "L" + neckL + " " + (sh[0][1] - 30) + "Z";
    s += '<g clip-path="url(#' + cid + ')">';
    s += '<path d="M-20 140H220V260H-20Z' + vd + '" fill="' + L.jersey + '" fill-rule="evenodd"/>';
    if (L.stripes) {
      // ピンストライプ
      let pd = "";
      for (let x = -8; x < 210; x += 9) pd += "M" + x + " 150L" + (x + (x - 100) * 0.08) + " 250";
      s += '<path d="' + pd + '" stroke="' + L.stripes + '" stroke-width="1.1" stroke-opacity=".75" fill="none"/>';
    }
    // 影 (右側と襟の下)
    s += fillP("M150 170C170 190 176 220 172 250H220V160Z", shadeOf(L.jersey, 0.22));
    s += fillP("M" + (neckL - 6) + " " + (sh[0][1] + 2) + "L100 " + (vy + 6) + "L" + (206 - neckL) + " " + (sh[0][1] + 2) + "L" + (200 - neckL) + " " + (sh[0][1] - 3) + "L100 " + vy + "L" + neckL + " " + (sh[0][1] - 3) + "Z", shadeOf(L.jersey, 0.25));
    if (g.det) {
      s += hatch(158, 196, 170, 236, 6, 12, -1.2, 1.1, INK, 0.45);
      s += '<path d="M-20 200H220V260H-20Z" fill="url(#' + g.id + 'tone)" opacity=".18"/>';
    }
    s += "</g>";
    // 輪郭
    s += shape(d, "none", 3.4);
    // V ネックの縁取り (パイピング)
    s += brush(
      [
        [neckL + 1, sh[0][1] - 2],
        [100, vy + 1],
      ],
      4.4,
      { fill: L.piping, a: 0.02, b: 0.02, s0: 1, e0: 1 }
    );
    s += brush(
      [
        [100, vy + 1],
        [199 - neckL, sh[0][1] - 2],
      ],
      4.4,
      { fill: L.piping, a: 0.02, b: 0.02, s0: 1, e0: 1 }
    );
    s += shape("M" + neckL + " " + (sh[0][1] - 3) + "L100 " + vy + "L" + (200 - neckL) + " " + (sh[0][1] - 3), "none", 2.6);
    // 前立て・ボタン
    s += brush(
      [
        [100, vy],
        [100, 244],
      ],
      3.6,
      { fill: L.piping, a: 0.02, b: 0.02, s0: 1, e0: 1 }
    );
    s += shape("M97.5 " + vy + "V244M102.5 " + vy + "V244", "none", 1.2);
    s += '<circle cx="106" cy="' + (vy + 14) + '" r="2.2" fill="#fff" stroke="' + INK + '" stroke-width="1.2"/><circle cx="106" cy="' + (vy + 28) + '" r="2.2" fill="#fff" stroke="' + INK + '" stroke-width="1.2"/>';
    // 肩のしわ
    s += brush(
      [
        [40, 196],
        [52, 206],
        [56, 222],
      ],
      1.8,
      { op: 0.85 }
    );
    s += brush(
      [
        [160, 196],
        [148, 206],
        [144, 222],
      ],
      1.8,
      { op: 0.85 }
    );
    return s;
  }
  // ジャンパー (立ち襟、ファスナー) — 監督
  function jacket(g, build, hw) {
    const L = g.L;
    const sh = SHOULDER[build];
    const col = L.jacket;
    const cs = shadeOf(col, 0.3);
    const hl = lightOf(col, lum(col) < 0.25 ? 0.22 : 0.35);
    const cid = g.id + "cl";
    const d = torso(sh);
    let s = '<clipPath id="' + cid + '"><path d="' + d + '"/></clipPath>';
    s += shape(d, col, 0);
    s += '<g clip-path="url(#' + cid + ')">';
    // 光と影
    s += fillP("M-10 205C20 190 46 182 66 178C40 196 26 220 22 250H-10Z", hl, 0.55);
    s += fillP("M146 176C176 188 196 204 210 214V250H160C164 224 160 196 146 176Z", cs);
    // ラグラン袖の縫い目
    s += brush(
      [
        [76, 178],
        [52, 206],
        [40, 250],
      ],
      1.8,
      { op: 0.9 }
    );
    s += brush(
      [
        [124, 178],
        [148, 206],
        [160, 250],
      ],
      1.8,
      { op: 0.9 }
    );
    // 胸の縁取りライン
    s += brush(
      [
        [-10, 232],
        [40, 222],
        [70, 220],
      ],
      4,
      { fill: L.trim, a: 0.05, b: 0.4, s0: 1, e0: 0.4 }
    );
    s += brush(
      [
        [210, 232],
        [160, 222],
        [130, 220],
      ],
      4,
      { fill: L.trim, a: 0.05, b: 0.4, s0: 1, e0: 0.4 }
    );
    if (g.det) s += hatch(150, 200, 166, 240, 6, 12, -1.15, 1.1, lum(col) < 0.3 ? "#ffffff" : INK, 0.35);
    s += "</g>";
    s += shape(d, "none", 3.4);
    // ファスナー
    s += brush(
      [
        [100, 186],
        [100, 246],
      ],
      2.4,
      { fill: INK, a: 0.02, b: 0.02, s0: 1, e0: 1 }
    );
    s += brush(
      [
        [100, 188],
        [100, 246],
      ],
      1,
      { fill: L.trim, a: 0.02, b: 0.02, s0: 1, e0: 1 }
    );
    // 立ち襟
    const cl = "M" + (100 - hw - 6) + " 154C" + (100 - hw - 2) + " 170 " + (100 - 10) + " 178 100 180C" + (100 + 10) + " 178 " + (100 + hw + 2) + " 170 " + (100 + hw + 6) + " 154L" + (100 + hw + 12) + " 170C" + (100 + hw + 8) + " 188 " + (100 + 12) + " 196 100 198C" + (100 - 12) + " 196 " + (100 - hw - 8) + " 188 " + (100 - hw - 12) + " 170Z";
    s += shape(cl, col, 3);
    s += brush(
      [
        [100 - hw - 4, 160],
        [100 - 10, 183],
        [100, 185],
      ],
      2.6,
      { fill: L.trim, a: 0.1, b: 0.05, s0: 0.5, e0: 1 }
    );
    s += brush(
      [
        [100 + hw + 4, 160],
        [100 + 10, 183],
        [100, 185],
      ],
      2.6,
      { fill: L.trim, a: 0.1, b: 0.05, s0: 0.5, e0: 1 }
    );
    s += fillP("M" + (100 + hw + 6) + " 156L" + (100 + hw + 11) + " 170C" + (100 + hw + 8) + " 186 " + (100 + 12) + " 194 100 197L104 186C" + (100 + 20) + " 182 " + (100 + hw + 2) + " 172 " + (100 + hw + 6) + " 156Z", cs, 0.7);
    s += shape("M98 182H102V190H98Z", "#c9cdd3", 1.3);
    return s;
  }
  // ジャンパー (開いた襟、中に白い T シャツ) — マネージャー
  function girlJacket(g) {
    const L = g.L;
    const sh = SHOULDER.girl;
    const col = L.jacket;
    const cs = shadeOf(col, 0.3);
    const cid = g.id + "cl";
    const d = torso(sh);
    let s = "";
    // T シャツ
    s += shape("M80 166C86 180 114 180 120 166L128 250H72Z", "#fbfbf8", 2.4);
    s += fillP("M84 176C92 186 108 186 116 176L118 186C108 192 92 192 82 186Z", "#d9dde6");
    s += '<clipPath id="' + cid + '"><path d="' + d + '"/></clipPath>';
    const jl = "M14 250L14 214C22 198 54 182 84 168L90 182L96 250Z";
    const jr = "M186 250L186 214C178 198 146 182 116 168L110 182L104 250Z";
    s += '<g clip-path="url(#' + cid + ')">';
    s += shape(jl, col, 0) + shape(jr, col, 0);
    s += fillP("M150 186C170 196 186 210 190 222V250H158C162 226 160 204 150 186Z", cs);
    s += fillP("M20 214C30 200 50 190 70 182C50 200 40 222 38 250H20Z", lightOf(col, 0.3), 0.5);
    if (g.det) s += hatch(160, 204, 172, 240, 5, 11, -1.15, 1, lum(col) < 0.3 ? "#ffffff" : INK, 0.35);
    s += "</g>";
    s += shape(jl, "none", 3.2) + shape(jr, "none", 3.2);
    // 縁取り
    s += brush(
      [
        [88, 180],
        [93, 214],
        [96, 250],
      ],
      3,
      { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 }
    );
    s += brush(
      [
        [112, 180],
        [107, 214],
        [104, 250],
      ],
      3,
      { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 }
    );
    // 折り返しの襟
    s += shape("M84 166L66 186L82 200L90 182Z", col, 2.6);
    s += shape("M116 166L134 186L118 200L110 182Z", col, 2.6);
    s += fillP("M114 170L130 186L118 196L111 183Z", cs, 0.6);
    s += brush(
      [
        [80, 172],
        [70, 186],
      ],
      1.6,
      { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 }
    );
    s += brush(
      [
        [120, 172],
        [130, 186],
      ],
      1.6,
      { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 }
    );
    // 胸のワッペン (チームマーク)
    s += markAt(g, 150, 222, 16, true);
    return s;
  }
  // コーチのポロシャツ (チームカラー、濃い色の襟と笛)
  function coachJacket(g, hw) {
    const L = g.L;
    const sh = SHOULDER.slim;
    const col = lum(L.main) > 0.85 ? L.jacket : L.main;
    const cs = shadeOf(col, 0.3);
    const collar = dist(L.jacket, col) < 90 ? "#ffffff" : L.jacket;
    const edge = dist(collar, "#ffffff") < 90 ? col : "#ffffff";
    const cid = g.id + "cl";
    const d = torso(sh);
    let s = '<clipPath id="' + cid + '"><path d="' + d + '"/></clipPath>';
    s += shape(d, col, 0);
    s += '<g clip-path="url(#' + cid + ')">';
    s += fillP("M148 180C176 192 196 206 210 214V250H162C166 226 162 200 148 180Z", cs);
    s += fillP("M-10 210C20 196 44 186 64 180C42 200 30 222 26 250H-10Z", lightOf(col, 0.3), 0.45);
    if (g.det) s += hatch(156, 196, 170, 238, 6, 12, -1.15, 1.1, lum(col) < 0.3 ? "#ffffff" : INK, 0.35);
    s += "</g>";
    s += shape(d, "none", 3.4);
    // 前立て・ボタン
    s += shape("M95 176H105V216H95Z", col, 2.2);
    s += '<circle cx="100" cy="194" r="2" fill="#fff" stroke="' + INK + '" stroke-width="1.1"/><circle cx="100" cy="207" r="2" fill="#fff" stroke="' + INK + '" stroke-width="1.1"/>';
    // 襟 (首の後ろ → 左右に倒れる)
    s += shape("M" + (100 - hw - 4) + " 160C" + (100 - hw) + " 156 " + (100 + hw) + " 156 " + (100 + hw + 4) + " 160L" + (100 + hw + 5) + " 172L" + (100 - hw - 5) + " 172Z", shadeOf(collar, 0.35), 2.2);
    for (const sd of [-1, 1]) {
      const X = (u) => 100 + sd * u;
      s += shape("M" + X(hw + 4) + " 160L" + X(hw + 20) + " 194L" + X(3) + " 190L" + X(hw - 4) + " 172Z", collar, 2.6);
      s += brush([[X(hw + 7), 166], [X(hw + 18), 191]], 1.6, { fill: edge, a: 0.05, b: 0.05, s0: 1, e0: 1 });
    }
    // 笛のひも
    const cord = L.trim === "#ffffff" ? "#d63a3a" : L.trim === col ? "#ffffff" : L.trim;
    s += brush([[86, 182], [96, 210], [111, 228]], 1.6, { fill: cord, a: 0.05, b: 0.05, s0: 1, e0: 1 });
    s += brush([[114, 182], [116, 210], [113, 228]], 1.6, { fill: cord, a: 0.05, b: 0.05, s0: 1, e0: 1 });
    s += shape("M106 228h14a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-10l-6-5z", "#c8ccd4", 1.8);
    s += fillP("M109 230h10v2h-10z", "#ffffff", 0.8);
    return s;
  }

  /* ---------- 帽子 ---------- */
  function markAt(g, cx, cy, sz, patch) {
    const L = g.L;
    let s = "";
    if (patch) {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(sz * 0.62) + '" fill="' + L.crown + '" stroke="' + INK + '" stroke-width="1.6"/>';
      sz *= 0.82;
    }
    if (L.mark) {
      s += '<image href="' + escA(L.mark) + '" x="' + n(cx - sz / 2) + '" y="' + n(cy - sz / 2) + '" width="' + n(sz) + '" height="' + n(sz) + '" preserveAspectRatio="xMidYMid meet"/>';
      return s;
    }
    const txt = L.markText || "";
    if (!txt) return s;
    const font = "'" + L.markFont + "', 'Archivo Black', sans-serif";
    const st = (fs, x, y, ch, cut) =>
      '<text x="' +
      n(x) +
      '" y="' +
      n(y) +
      '" font-family="' +
      escA(font) +
      '" font-size="' +
      n(fs) +
      '" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="' +
      L.markColor +
      '" stroke="' +
      (cut || L.markOutline || "none") +
      '" stroke-width="' +
      (cut ? n(fs * 0.12) : L.markOutline ? n(fs * 0.09) : 0) +
      '" paint-order="stroke" stroke-linejoin="round">' +
      escA(ch) +
      "</text>";
    if (L.markStyle === "mono" && txt.length >= 2) {
      // 組み合わせ文字: 2 文字を重ねる (後ろの文字を帽子の色で縁取って切り抜いたように見せる)
      s += st(sz * 0.88, cx - sz * 0.2, cy - sz * 0.04, txt[0]);
      s += st(sz * 0.88, cx + sz * 0.2, cy + sz * 0.06, txt[1], patch ? L.crown : g.capCol);
    } else if (txt.length >= 2) {
      s += '<g transform="translate(' + n(cx) + " " + n(cy) + ') scale(.78 1)">' + st(sz * 0.8, 0, 0, txt) + "</g>";
    } else s += st(sz * 1.05, cx, cy, txt);
    return s;
  }
  // dy: 帽子を深くかぶる量
  function cap(g, dy) {
    const L = g.L;
    const y = dy || 0;
    const T = (s) => (y ? '<g transform="translate(0 ' + y + ')">' + s + "</g>" : s);
    const crown = "M53 100C51 70 64 42 100 40C136 42 149 70 147 100Z";
    const cid = g.id + "cap";
    let s = '<clipPath id="' + cid + '"><path d="' + crown + '"/></clipPath>';
    s += shape(crown, L.crown, 3.6);
    s += '<g clip-path="url(#' + cid + ')">';
    if (L.stripes) {
      let d = "";
      for (let k = -5; k <= 5; k++) d += "M100 38Q" + n(100 + k * 6.5) + " 56 " + n(100 + k * 10.5) + " 102";
      s += '<path d="' + d + '" stroke="' + L.stripes + '" stroke-width="1.1" fill="none"/>';
    }
    // 光沢と影
    s += fillP("M60 90C60 64 72 48 94 43C80 52 70 66 67 92Z", "#ffffff", lum(L.crown) > 0.7 ? 0.5 : 0.28);
    s += fillP("M147 102C150 70 138 48 112 42C130 54 140 74 138 102Z", "#000000", 0.28);
    s += "</g>";
    // 縫い目
    s += brush(
      [
        [100, 42],
        [80, 58],
        [73, 96],
      ],
      1.3,
      { fill: shadeOf(L.crown, 0.5), op: 0.8 }
    );
    s += brush(
      [
        [100, 42],
        [120, 58],
        [127, 96],
      ],
      1.3,
      { fill: shadeOf(L.crown, 0.5), op: 0.8 }
    );
    s += '<ellipse cx="100" cy="41" rx="5.5" ry="2.6" fill="' + L.button + '" stroke="' + INK + '" stroke-width="1.6"/>';
    g.capCol = L.crown;
    s += markAt(g, 100, 70, 28);
    // つば (正面から少し見上げた弧)
    const brim = "M45 104C56 83 144 83 155 104C144 108 124 101.5 100 101.5C76 101.5 56 108 45 104Z";
    s += shape(brim, L.brim, 3.6);
    s += fillP("M50 101C64 88 136 88 150 101C138 95 120 91 100 91C80 91 62 95 50 101Z", "#ffffff", lum(L.brim) > 0.7 ? 0.0 : 0.22);
    s += brush(
      [
        [51, 102],
        [76, 98],
        [100, 97.8],
        [124, 98],
        [149, 102],
      ],
      1.8,
      { fill: lum(L.brim) > 0.6 ? INK : "#000", op: 0.6, a: 0.2, b: 0.2 }
    );
    // つばの下側の太い墨 (強弱)
    s += brush(
      [
        [46, 104],
        [72, 103],
        [100, 103],
        [128, 103],
        [154, 104],
      ],
      3.4,
      { a: 0.15, b: 0.15, s0: 0.3, e0: 0.3 }
    );
    return T(s);
  }
  // つばの影 (顔の上)
  function brimShadow(g, dy) {
    const y = dy || 0;
    return fillP("M20 96H180V" + (104 + y) + "C150 " + (104 + y) + " 128 " + (111 + y) + " 100 " + (111 + y) + "C72 " + (111 + y) + " 50 " + (104 + y) + " 20 " + (104 + y) + "Z", g.skinS);
  }

  /* ---------- 顔のパーツ ---------- */
  function ear(g, side, y0, y1, big) {
    const s1 = side;
    const xb = 100 + s1 * 41;
    const w = big ? 11 : 9;
    const P = (u, v) => [100 + s1 * u, v];
    const d = curve([P(41, y0), P(41 + w * 0.7, y0 - 3), P(41 + w, y0 + 6), P(41 + w * 0.9, (y0 + y1) / 2 + 2), P(41 + w * 0.5, y1 - 1), P(40, y1)], false) + "Z";
    let s = shape(d, g.skin, 3);
    s += fillP(curve([P(42, y0 + 3), P(41 + w * 0.7, y0 + 2), P(41 + w * 0.75, y0 + 10), P(43, y1 - 6)], false) + "Z", g.skinS);
    s += brush([P(41 + w * 0.55, y0 + 3), P(41 + w * 0.75, y0 + 9), P(41 + w * 0.5, (y0 + y1) / 2 + 3), P(43, y1 - 6)], 1.8);
    void xb;
    return s;
  }

  // 目。(cx, cy) 目の中心, s: -1 左目 / 1 右目, o: {w, h, r, lid, tilt, lash, iris, hl}
  function eye(g, cx, cy, s, o, ex) {
    const P = (u, v) => [cx + s * u, cy + v];
    const w = o.w;
    let out = "";
    let h = o.h;
    let tilt = o.tilt || 0;
    let r = o.r;
    // 黒目は上まぶたにかかる高さ (驚いたときだけ白目の真ん中)
    let iy = -Math.max(0, h - r) * 0.55 + 0.6;
    let iu = -0.8;
    const style = o.style || "std";
    if (style === "smile" && ex !== "surprised" && ex !== "angry" && ex !== "serious") ex = "happy";
    if (style === "line" && ex !== "surprised") {
      // 細目: 1 本の線
      const k = ex === "angry" || ex === "serious" ? 2 : ex === "sad" ? -2 : ex === "happy" ? -1 : 0;
      out += brush([P(-w / 2, 0.5 + k * 0.5), P(0, -2.2 - (ex === "happy" ? 2 : 0)), P(w / 2 + 1, 0.5 - k)], o.lid, { a: 0.3, b: 0.3, s0: 0.3, e0: 0.5 });
      return out;
    }
    if (ex === "happy") {
      // 笑い目: 上に丸い弧
      const k = o.lash ? 1.2 : 1;
      out += brush([P(-w / 2, 1.5), P(-w * 0.18, -h * 0.55 * k), P(w * 0.22, -h * 0.55 * k), P(w / 2 + 1, 1.8)], o.lid * 1.05, { a: 0.3, b: 0.3, s0: 0.35, e0: 0.45 });
      if (o.lash) out += brush([P(w / 2, 0.5), P(w / 2 + 4, -1.5)], 1.6, { s0: 0.8, e0: 0.1 });
      if (g.det && !o.lash) out += brush([P(-w * 0.2, 4.2), P(w * 0.25, 4)], 1.1, { op: 0.7 });
      return out;
    }
    if (ex === "angry") {
      h *= o.lash ? 0.85 : 0.72;
      tilt += 3;
      r *= 0.82;
      iu = -1.6;
      iy = -Math.max(0, h - r) * 0.3 + 0.8;
    } else if (ex === "serious") {
      // 真剣: 目を細めてまっすぐ見る
      h *= o.lash ? 0.88 : 0.78;
      tilt += 1.5;
      r *= 0.95;
      iu = -1.2;
      iy = -Math.max(0, h - r) * 0.4 + 0.6;
    } else if (ex === "surprised") {
      h *= 1.35;
      r *= 0.55;
      iu = 0;
      iy = 0.4;
    } else if (ex === "sad") {
      tilt -= 3;
      h *= 0.85;
      iy = 2;
    }
    const bot = h * (o.lash ? 0.62 : 0.55) * (ex === "surprised" ? 1.3 : 1);
    // 上まぶたの曲線 (目尻ほど tilt だけ上がる)
    const tv = (u) => -tilt * ((u + w / 2) / w);
    const up = [P(-w / 2, 1 + tv(-w / 2)), P(-w * 0.25, -h * 0.82 + tv(-w * 0.25)), P(w * 0.15, -h + tv(w * 0.15)), P(w / 2, -h * 0.3 + tv(w / 2) + 0.5), P(w / 2 + 2.5, 1.2 + tv(w / 2))];
    if (ex === "angry" || ex === "serious") up[1][1] += ex === "angry" ? 1.6 : 0.9;
    const lo = [P(w / 2 + 1, 1 + tv(w / 2) * 0.4), P(w * 0.2, bot), P(-w * 0.25, bot * 0.95), P(-w / 2, 1 + tv(-w / 2))];
    const white = curve(up.slice(0, 4).concat(lo.slice(1)), true);
    const eid = g.id + "e" + ++g.n;
    out += '<clipPath id="' + eid + '"><path d="' + white + '"/></clipPath>';
    out += fillP(white, "#ffffff");
    // 黒目
    const ic = P(iu, iy);
    out += '<g clip-path="url(#' + eid + ')">';
    if (o.iris) {
      out += '<circle cx="' + n(ic[0]) + '" cy="' + n(ic[1]) + '" r="' + n(r) + '" fill="' + o.iris + '" stroke="' + INK + '" stroke-width="1.4"/>';
      out += '<circle cx="' + n(ic[0]) + '" cy="' + n(ic[1] + r * 0.15) + '" r="' + n(r * 0.55) + '" fill="' + INK + '"/>';
      out += fillP("M" + n(ic[0] - r) + " " + n(ic[1]) + "A" + n(r) + " " + n(r) + " 0 0 0 " + n(ic[0] + r) + " " + n(ic[1]) + "A" + n(r) + " " + n(r * 0.5) + " 0 0 1 " + n(ic[0] - r) + " " + n(ic[1]) + "Z", lightOf(o.iris, 0.35), 0.8);
    } else {
      out += '<circle cx="' + n(ic[0]) + '" cy="' + n(ic[1]) + '" r="' + n(r) + '" fill="' + INK + '"/>';
    }
    // まぶたの影
    out += fillP(curve(up.slice(0, 4), false) + "L" + n(up[3][0]) + " " + n(up[3][1] + 2.4) + "L" + n(up[0][0]) + " " + n(up[0][1] + 2.4) + "Z", "#8a8fa3", 0.35);
    out += "</g>";
    if (ex !== "surprised" || o.lash) {
      const hr = Math.max(1.1, r * 0.34);
      out += '<circle cx="' + n(ic[0] - s * r * 0.3) + '" cy="' + n(ic[1] - r * 0.38) + '" r="' + n(hr) + '" fill="#fff"/>';
      if (o.hl === 2) out += '<circle cx="' + n(ic[0] + s * r * 0.35) + '" cy="' + n(ic[1] + r * 0.4) + '" r="' + n(hr * 0.5) + '" fill="#fff"/>';
    }
    // 上まぶた (太い墨、目尻が太い)
    out += brush(up, o.lid, { a: 0.35, b: 0.25, s0: 0.25, e0: 0.55 });
    if (o.lash) {
      // まつげ
      out += brush([P(w / 2 - 0.5, -h * 0.3 + tv(w / 2)), P(w / 2 + 3.5, -h * 0.55 + tv(w / 2))], 2, { s0: 1, e0: 0.1, a: 0.1, b: 0.7 });
      out += brush([P(w / 2 + 1.5, tv(w / 2) - 0.2), P(w / 2 + 5, -1.2 + tv(w / 2))], 1.8, { s0: 1, e0: 0.1, a: 0.1, b: 0.7 });
    }
    if (o.crease && ex !== "surprised") out += brush([P(-w * 0.15, -h - 2.6 + tv(-w * 0.15)), P(w * 0.2, -h - 3.6 + tv(w * 0.2)), P(w / 2 + 1, -h * 0.5 - 3 + tv(w / 2))], 1.3, { op: 0.85 });
    // 下まぶた
    out += brush(lo.slice(0, 3), o.lash ? 1.6 : 1.4, { a: 0.3, b: 0.4, s0: 0.6, e0: 0.1 });
    if (ex === "surprised" && g.det) out += brush([P(-w * 0.1, -h - 3.5), P(w * 0.3, -h - 3)], 1, { op: 0.7 });
    return out;
  }
  // 眉。cy: 基準の高さ, o: {w, t (太さ), arch, bushy}
  function brow(g, cx, cy, s, o, ex) {
    let a = 0;
    let b = o.lift || 0;
    let arch = o.arch == null ? 2 : o.arch;
    if (ex === "angry") {
      a = 5.5;
      b -= 3;
      arch = 0.2;
    } else if (ex === "serious") {
      a = 3.2;
      b -= 1.5;
      arch = 0.4;
    } else if (ex === "surprised") {
      a = -6;
      b -= 4.5;
      arch += 3;
    } else if (ex === "sad") {
      a = -4.5;
      b += 3;
      arch = 0.5;
    } else if (ex === "happy") {
      a = -1.5;
      b -= 1.5;
      arch += 1.5;
    }
    const P = (u, v) => [cx + s * u, cy + v];
    const w = o.w;
    const pts = [P(-w / 2, a), P(-w * 0.05, -arch + a * 0.5 + b * 0.3), P(w / 2 + 2, b + 1.5)];
    const col = o.col || INK;
    let out = brush(pts, o.t, { a: 0.12, s0: 0.75, b: 0.55, e0: 0.12, fill: col });
    if (o.bushy && g.det) {
      // 毛並み
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const x = -w / 2 + w * t;
        const yy = a + (b - a) * t - arch * Math.sin(t * Math.PI) * 0.8;
        out += brush([P(x, yy + o.t * 0.3), P(x + 4.5, yy - o.t * 0.75)], 1.4 + (i % 2) * 0.4, { fill: col, s0: 0.9, e0: 0.05 });
      }
      out += brush([P(-w * 0.3, a - 0.2), P(w * 0.3, (a + b) / 2 - arch * 0.8)], 1, { fill: "#9a9a9a", op: 0.9 });
    }
    return out;
  }

  /* ---------- キャラクター ---------- */
  // 首をかしげる (あごの下を中心に回す)
  const headOpen = (g) => (g.tilt ? '<g transform="rotate(' + g.tilt + ' 100 158)">' : "");
  const headClose = (g) => (g.tilt ? "</g>" : "");
  const rot = (g, str) => headOpen(g) + str + headClose(g);
  // 顔の形 (左半分: 中心線上の点から始まり、あごの先で終わる)
  const JAW = {
    std: [
      [100, 74],
      [78, 76],
      [62, 84],
      [58, 98],
      [57, 112],
      [59, 128],
      [63, 142],
      [71, 155],
      [85, 165],
      [100, 168],
    ],
    oni: [
      [100, 74],
      [76, 76],
      [61, 84],
      [57, 98],
      [56, 114],
      [57, 130],
      [60, 145],
      [66, 157],
      [78, 166],
      [90, 170],
      [100, 171],
    ],
    goda: [
      [100, 38],
      [80, 40],
      [64, 48],
      [56, 62],
      [53, 82],
      [52, 104],
      [53, 124],
      [56, 142],
      [63, 157],
      [77, 168],
      [90, 172],
      [100, 173],
    ],
    girl: [
      [100, 46],
      [80, 48],
      [66, 58],
      [60, 74],
      [59, 96],
      [60, 114],
      [62, 128],
      [68, 142],
      [78, 153],
      [90, 160],
      [100, 162],
    ],
    slim: [
      [100, 40],
      [80, 42],
      [66, 50],
      [59, 66],
      [58, 88],
      [58, 108],
      [60, 124],
      [64, 138],
      [72, 152],
      [85, 163],
      [100, 167],
    ],
    vee: [
      [100, 74],
      [78, 76],
      [62, 84],
      [58, 98],
      [58, 114],
      [60, 128],
      [65, 142],
      [75, 154],
      [88, 163],
      [100, 167],
    ],
  };
  function faceShape(g, jaw) {
    const pts = sym(JAW[jaw]);
    const d = curve(pts, true);
    const fid = g.id + "fc";
    g.faceD = d;
    let s = '<clipPath id="' + fid + '"><path d="' + d + '"/></clipPath>';
    s += fillP(d, g.skin);
    return s;
  }
  // 顔の陰 (右側・鼻の下・下くちびるの下)。clip の中で描く
  function faceShade(g, o) {
    let s = '<g clip-path="url(#' + g.id + 'fc)">';
    const jaw = JAW[o.jaw];
    // 右の頬の陰 (光は左上から)
    const R = jaw.map(mx).filter((p) => p[1] > 92);
    const inner = R.map((p) => [p[0] - (p[1] > 150 ? 6 : 9) + (p[1] - 100) * 0.02, p[1]]);
    s += fillP(curve(inner, false) + "L" + n(R[R.length - 1][0] + 30) + " " + R[R.length - 1][1] + "L" + (R[0][0] + 30) + " " + R[0][1] + "Z", g.skinS);
    if (g.det && o.hatch !== false) {
      // 影の境目の斜線
      for (let y = 112; y <= 150; y += 4.5) {
        let k = 0;
        while (k < inner.length - 2 && inner[k + 1][1] < y) k++;
        const p0 = inner[k];
        const p1 = inner[k + 1];
        const t = Math.max(0, Math.min(1, (y - p0[1]) / ((p1[1] - p0[1]) || 1)));
        const x = p0[0] + (p1[0] - p0[0]) * t;
        s += brush([[x + 1.5, y + 2.5], [x - 5, y - 3]], 1.1, { op: 0.55, s0: 0.6, e0: 0.05, a: 0.2, b: 0.6, per: 3 });
      }
    }
    // 頬骨の下のハッチング
    if (g.det && o.cheekHatch) s += hatch(o.cheekHatch[0], o.cheekHatch[1], o.cheekHatch[0] + 4, o.cheekHatch[1] + 12, 4, 7, -1.05, 1, INK, 0.55);
    if (o.extraShade) s += o.extraShade;
    if (o.cap) s += brimShadow(g, o.capDy);
    s += "</g>";
    // 輪郭 (下側を太く)
    s += shape(g.faceD, "none", 3.2);
    const J = JAW[o.jaw];
    const low = J.filter((p) => p[1] >= 128);
    s += brush(low.concat(low.slice(0, -1).reverse().map(mx)), 3.4, { a: 0.25, b: 0.25, s0: 0, e0: 0, per: 6 });
    return s;
  }
  // 鼻。type: std / big / broad / small / long / sharp
  function nose(g, cy, type, ex) {
    let s = "";
    const sh = g.skinS;
    if (type === "small") {
      s += brush(
        [
          [102, cy - 4],
          [103.5, cy],
          [101, cy + 1],
        ],
        1.8,
        { s0: 0.3, e0: 0.4 }
      );
      return s;
    }
    const k = type === "big" ? 1.35 : type === "broad" ? 1.25 : type === "long" ? 0.9 : 1;
    const top = type === "long" ? cy - 22 : cy - 16;
    // 鼻すじの影
    s += fillP("M" + (103 + k) + " " + top + "C" + (106 + k * 2) + " " + (cy - 8) + " " + (108 + k * 3) + " " + (cy - 2) + " " + (106 + k * 2) + " " + (cy + 2) + "L" + (101 + k) + " " + (cy + 2) + "C" + (103 + k) + " " + (cy - 6) + " " + (103 + k) + " " + (cy - 10) + " " + (102 + k) + " " + top + "Z", sh);
    s += brush(
      [
        [103 + k, top],
        [106 + k * 2.2, cy - 6],
        [107 + k * 3, cy + 1],
      ],
      type === "sharp" ? 2.2 : 1.8,
      { s0: 0.1, e0: 0.8, a: 0.6, b: 0.1 }
    );
    // 鼻先・小鼻
    s += brush(
      [
        [93 - k * 3, cy + 1],
        [98, cy + 3.5],
        [103, cy + 3.5],
        [107 + k * 3, cy + 1],
      ],
      type === "broad" || type === "big" ? 2.4 : 2,
      { s0: 0.4, e0: 0.7, a: 0.3, b: 0.2 }
    );
    if (type === "big" || type === "broad") {
      s += brush(
        [
          [91 - k * 2, cy - 4],
          [89 - k * 2, cy],
          [92 - k * 2, cy + 2.5],
        ],
        2,
        { s0: 0.3, e0: 0.8 }
      );
      s += brush(
        [
          [109 + k * 2, cy - 4],
          [111 + k * 2, cy],
          [108 + k * 2, cy + 2.5],
        ],
        2.2,
        { s0: 0.3, e0: 0.8 }
      );
    }
    s += '<ellipse cx="96" cy="' + (cy + 1.2) + '" rx="2" ry="1.1" fill="' + INK + '"/><ellipse cx="104.5" cy="' + (cy + 1.2) + '" rx="2" ry="1.1" fill="' + INK + '"/>';
    // 鼻の下の影
    s += fillP("M98 " + (cy + 4.5) + "C102 " + (cy + 5.5) + " 106 " + (cy + 5) + " 109 " + (cy + 3) + "C108 " + (cy + 8) + " 102 " + (cy + 9) + " 98 " + (cy + 4.5) + "Z", sh, 0.9);
    void ex;
    return s;
  }
  // 口。o: {w, style}, ex: 表情
  function mouth(g, cy, o, ex) {
    const w = o.w;
    const x0 = 100 - w / 2;
    const x1 = 100 + w / 2;
    const sh = g.skinS;
    let s = "";
    const lip = (yy) => brush([[100 - w * 0.22, yy], [100 + w * 0.22, yy]], 1.8, { op: 0.8, a: 0.4, b: 0.4 });
    if (ex === "happy") {
      // 大きく開けた笑い (上の歯と舌)
      const dw = w * (o.grin || 1.1);
      const a = 100 - dw / 2;
      const b = 100 + dw / 2;
      const dd = o.deep || 13;
      const d = "M" + n(a) + " " + (cy - 2) + "C" + n(a + dw * 0.25) + " " + (cy + 1) + " " + n(b - dw * 0.25) + " " + (cy + 1) + " " + n(b) + " " + (cy - 2) + "C" + n(b - 2) + " " + (cy + dd * 0.8) + " " + n(100 + dw * 0.18) + " " + (cy + dd) + " 100 " + (cy + dd) + "C" + n(100 - dw * 0.18) + " " + (cy + dd) + " " + n(a + 2) + " " + (cy + dd * 0.8) + " " + n(a) + " " + (cy - 2) + "Z";
      const mid = g.id + "m";
      s += '<clipPath id="' + mid + '"><path d="' + d + '"/></clipPath>';
      s += fillP(d, "#5a1416");
      s += '<g clip-path="url(#' + mid + ')">';
      s += '<ellipse cx="100" cy="' + (cy + dd + 1) + '" rx="' + n(dw * 0.3) + '" ry="' + n(dd * 0.45) + '" fill="#e0626a"/>';
      if (o.teeth !== false) s += '<rect x="' + n(a) + '" y="' + (cy - 4) + '" width="' + n(dw) + '" height="' + n(dd * 0.32 + 3) + '" fill="#fff"/>';
      s += "</g>";
      s += shape(d, "none", 2.4);
      // 口角のしわ
      s += brush([[a - 1, cy - 5], [a - 2.5, cy - 1], [a - 1, cy + 2]], 1.4, { op: 0.8 });
      s += brush([[b + 1, cy - 5], [b + 2.5, cy - 1], [b + 1, cy + 2]], 1.4, { op: 0.8 });
      s += lip(cy + dd + 6);
      return s;
    }
    if (ex === "angry") {
      if (o.pout) {
        s += brush([[100 - w * 0.45, cy + 2], [100 - w * 0.15, cy - 1], [100 + w * 0.15, cy + 1], [100 + w * 0.45, cy - 1]], 2.2, { s0: 0.5, e0: 0.5 });
        return s + lip(cy + 6);
      }
      // 歯を食いしばる
      const hw = w * 0.62;
      const top = cy - 4;
      const bt = cy + 7;
      const d = "M" + n(100 - hw) + " " + (top + 2) + "Q100 " + (top - 1.5) + " " + n(100 + hw) + " " + (top + 2) + "L" + n(100 + hw - 1) + " " + (bt - 1) + "Q100 " + (bt + 2) + " " + n(100 - hw + 1) + " " + (bt - 1) + "Z";
      s += shape(d, "#fff", 2.4);
      s += shape("M" + n(100 - hw + 1) + " " + (cy + 1.5) + "Q100 " + (cy + 0.5) + " " + n(100 + hw - 1) + " " + (cy + 1.5), "none", 1.4);
      let tl = "";
      for (let i = 1; i < 6; i++) {
        const x = 100 - hw + (hw * 2 * i) / 6;
        tl += "M" + n(x) + " " + (top + 1) + "V" + (bt - 1);
      }
      s += '<path d="' + tl + '" stroke="' + INK + '" stroke-width="1" fill="none"/>';
      s += brush([[100 - hw - 4, top + 4], [100 - hw - 1, cy + 2], [100 - hw - 3, bt + 1]], 1.4, { op: 0.8 });
      s += brush([[100 + hw + 4, top + 4], [100 + hw + 1, cy + 2], [100 + hw + 3, bt + 1]], 1.4, { op: 0.8 });
      return s + lip(bt + 5);
    }
    if (ex === "surprised") {
      const rx = w * 0.26;
      const ry = 7;
      s += '<ellipse cx="100" cy="' + (cy + 3) + '" rx="' + n(rx) + '" ry="' + ry + '" fill="#5a1416" stroke="' + INK + '" stroke-width="2.4"/>';
      s += '<ellipse cx="100" cy="' + (cy + 6.5) + '" rx="' + n(rx * 0.6) + '" ry="2.6" fill="#e0626a"/>';
      return s + lip(cy + 14);
    }
    if (ex === "sad") {
      s += brush([[x0 + 2, cy + 3], [100 - w * 0.15, cy - 0.5], [100 + w * 0.12, cy + 0.5], [x1 - 2, cy + 3.5]], 2.2, { s0: 0.4, e0: 0.3 });
      return s + lip(cy + 7);
    }
    // ふつう
    const st = ex === "serious" ? "firm" : o.style || "flat";
    if (st === "firm") {
      // 口をきゅっと結ぶ
      s += brush([[x0 - 1, cy + 2.4], [x0 + 3, cy + 0.6], [100, cy], [x1 - 3, cy + 0.6], [x1 + 1, cy + 2.4]], 2.8, { s0: 0.6, e0: 0.6 });
    } else if (st === "smirk") {
      s += brush([[x0 + 1, cy + 1], [100, cy + 1.2], [x1 - 1, cy - 2.5], [x1 + 2, cy - 5]], 2.4, { s0: 0.4, e0: 0.2 });
      s += brush([[x1 + 1, cy - 2], [x1 + 3, cy + 1]], 1.4, { op: 0.8 });
    } else if (st === "frown") {
      s += brush([[x0 - 1, cy + 3], [x0 + 4, cy], [100, cy - 0.6], [x1 - 4, cy], [x1 + 1, cy + 3]], 2.8, { s0: 0.5, e0: 0.5 });
    } else if (st === "grin") {
      // 口を閉じたままにやり
      s += brush([[x0 - 1, cy - 3], [x0 + 5, cy + 1.5], [100, cy + 2.5], [x1 - 5, cy + 1.5], [x1 + 1, cy - 3]], 2.8, { s0: 0.3, e0: 0.3 });
      s += brush([[x0 - 2, cy - 6], [x0 - 3, cy - 2]], 1.4, { op: 0.8 });
      s += brush([[x1 + 2, cy - 6], [x1 + 3, cy - 2]], 1.4, { op: 0.8 });
    } else if (st === "soft") {
      s += brush([[x0 + 1, cy - 1.5], [100, cy + 1.6], [x1 - 1, cy - 1.5]], 2.2, { s0: 0.4, e0: 0.4 });
    } else {
      s += brush([[x0, cy + 0.5], [100, cy - 0.3], [x1, cy + 0.8]], 2.4, { s0: 0.4, e0: 0.4 });
    }
    s += fillP("M" + (100 - w * 0.25) + " " + (cy + 6) + "Q100 " + (cy + 9) + " " + (100 + w * 0.3) + " " + (cy + 5.5) + "Q100 " + (cy + 6.5) + " " + (100 - w * 0.25) + " " + (cy + 6) + "Z", sh);
    s += lip(cy + 6.5);
    return s;
  }
  // 表情の効果 (血管マーク・汗・ほほの赤み)
  function fx(g, ex, o) {
    let s = "";
    if (ex === "angry" && o.vein !== false) {
      // 怒りマーク
      const x = o.veinX || 156;
      const y = o.veinY || 56;
      const arc = (a) => {
        const c = Math.cos(a);
        const si = Math.sin(a);
        const R = (u, v) => [x + c * u - si * v, y + si * u + c * v];
        return brush([R(3, -9), R(4, -4), R(9, -3)], 3.2, { fill: "#d42a2a", s0: 0.5, e0: 0.5, a: 0.2, b: 0.2 });
      };
      s += arc(0) + arc(Math.PI / 2) + arc(Math.PI) + arc(-Math.PI / 2);
    }
    if (ex === "surprised" || ex === "sad") {
      // 汗
      const x = o.sweatX || 150;
      const y = o.sweatY || 104;
      s += shape("M" + x + " " + (y - 9) + "C" + (x + 6) + " " + (y - 1) + " " + (x + 6) + " " + (y + 6) + " " + x + " " + (y + 6) + "C" + (x - 6) + " " + (y + 6) + " " + (x - 6) + " " + (y - 1) + " " + x + " " + (y - 9) + "Z", "#cfe9ff", 2);
      s += fillP("M" + (x - 2) + " " + (y + 1) + "q0 3 2 3.5q-3.5 0-2-3.5Z", "#ffffff");
    }
    if (ex === "surprised" && g.det) {
      s += '<text x="34" y="58" font-family="\'Dela Gothic One\', sans-serif" font-size="30" fill="' + INK + '" stroke="#fff" stroke-width="5" paint-order="stroke" transform="rotate(-12 34 58)">!</text>';
    }
    if (ex === "sad" && g.det && o.gloomY) {
      // おでこに縦線
      let d = "";
      for (let i = 0; i < 9; i++) d += "M" + (72 + i * 7) + " " + o.gloomY + "v" + (10 + (i % 3) * 4) + "h1.1v-" + (10 + (i % 3) * 4) + "Z";
      s += '<g clip-path="url(#' + g.id + 'fc)">' + fillP(d, "#3a4660", 0.6) + "</g>";
    }
    return s;
  }
  function blush(g, cy, strong) {
    let s = "";
    for (const sd of [-1, 1]) {
      const cx = 100 + sd * 26;
      s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="9" ry="4.5" fill="#ff7a8a" fill-opacity="' + (strong ? 0.45 : 0.28) + '"/>';
      if (strong || g.det) s += hatch(cx - 5, cy, cx + 5, cy, 4, 6, -1.15, 1.1, "#c8344a", strong ? 0.9 : 0.6);
    }
    return s;
  }

  /* 髪 (帽子の下から出る部分) */
  function sideburn(g, col, len) {
    let s = "";
    for (const sd of [-1, 1]) {
      const P = (u, v) => [100 + sd * u, v];
      s += shape(curve([P(42.5, 96), P(37, 98), P(39, 106), P(40, 96 + len)], false) + "L" + n(100 + sd * 44) + " " + (96 + len - 1) + "L" + n(100 + sd * 43.5) + " 96Z", col, 2);
    }
    return s;
  }
  function capHair(g, style, col) {
    let s = "";
    const hl = lightOf(col, 0.25);
    if (style === 0) {
      // 前髪がつばの下から少し出る
      s += sideburn(g, col, 14);
      const d = "M72 100L76 112L82 103L90 114L95 103L102 113L107 102L114 112L118 102L126 109L128 100Z";
      s += shape(d, col, 2.4);
      s += brush([[86, 103], [90, 110]], 1.2, { fill: hl, op: 0.9 });
    } else if (style === 1) {
      // 短く刈り込む
      s += sideburn(g, col, 10);
    } else {
      // 長めの横髪と襟足
      for (const sd of [-1, 1]) {
        const P = (u, v) => [100 + sd * u, v];
        const d = curve([P(44, 94, 1), P(47, 108), P(46, 124), P(42, 140, 1), P(40, 128), P(34, 134, 1), P(37, 118), P(31, 116, 1), P(37, 104), P(41, 94, 1)], true);
        s += shape(d, col, 2.4);
        s += brush([P(43, 104), P(43, 120)], 1.2, { fill: hl });
      }
      s += shape("M78 100L84 111L92 103L100 113L108 103L116 110L122 100Z", col, 2.4);
    }
    return s;
  }
  function napeHair(g, col, wide) {
    // 襟足 (首の後ろからはみ出す毛先)
    let s = "";
    for (const sd of [-1, 1]) {
      const P = (u, v) => [100 + sd * u, v];
      const d = curve([P(30, 128, 1), P(42, 120), P(46, 98, 1), P(54, 92), P(52, 130), P(44, 152, 1), P(42, 140), P(36, 150, 1), P(36, 138), P(26, 142, 1), P(32, 132)], true);
      s += shape(d, col, 2.6);
    }
    void wide;
    return s;
  }

  // 監督: 鬼瓦 (厳しい 50 代、太い眉・口ひげ・頬の古傷)
  function drawOni(g) {
    const ex = g.ex;
    let s = "";
    s += neck(g, 23, 140);
    s += jacket(g, "std", 23);
    s += headOpen(g);
    s += ear(g, -1, 106, 134, true) + ear(g, 1, 106, 134, true);
    s += faceShape(g, "oni");
    s += faceShade(g, {
      jaw: "oni",
      cap: true,
      cheekHatch: [64, 124],
      extraShade:
        // 目のくぼみ
        fillP("M66 108C74 104 88 105 94 110C88 108 76 109 66 112Z", g.skinS) + fillP("M134 108C126 104 112 105 106 110C112 108 124 109 134 112Z", g.skinS),
    });
    // 白髪まじりのもみあげ
    s += sideburn(g, "#8c8a88", 18);
    const E = { w: 17, h: 5.6, r: 3.9, lid: 4.2, tilt: -0.6 };
    s += eye(g, 81, 119, -1, E, ex) + eye(g, 119, 119, 1, E, ex);
    // 目の下のたるみ・目尻のしわ
    if (ex !== "happy") {
      s += brush([[74, 126], [82, 128], [90, 126]], 1.1, { op: 0.75 });
      s += brush([[126, 126], [118, 128], [110, 126]], 1.1, { op: 0.75 });
    }
    s += brush([[68, 118], [64, 120]], 1.3, { op: 0.8 }) + brush([[68, 122], [64, 125]], 1.2, { op: 0.8 });
    s += brush([[132, 118], [136, 120]], 1.3, { op: 0.8 }) + brush([[132, 122], [136, 125]], 1.2, { op: 0.8 });
    const B = { w: 24, t: 7.6, arch: 1.4, bushy: true, col: "#24201e" };
    s += brow(g, 80, 108, -1, B, ex) + brow(g, 120, 108, 1, B, ex);
    // 眉間のしわ
    if (ex !== "happy") s += brush([[96.5, 108], [97.5, 116]], 1.4, { op: 0.85 }) + brush([[103.5, 108], [102.5, 116]], 1.4, { op: 0.85 });
    s += nose(g, 135, "big", ex);
    // ほうれい線
    s += brush([[88, 134], [80, 146], [79, 158]], 1.8, { op: 0.9 }) + brush([[112, 134], [120, 146], [121, 158]], 1.8, { op: 0.9 });
    // 口 (ひげの下)
    const my = 155;
    if (ex === "happy") s += mouth(g, my, { w: 24, grin: 1, deep: 9 }, ex);
    else if (ex === "angry") {
      // 怒鳴る
      const d = "M84 151C92 149 108 149 116 151C117 160 110 170 100 170C90 170 83 160 84 151Z";
      s += shape(d, "#5a1416", 2.6);
      s += fillP("M85.5 152C92 150.5 108 150.5 114.5 152L114 156C108 155 92 155 86 156Z", "#ffffff");
      s += '<ellipse cx="100" cy="165" rx="8" ry="3.2" fill="#e0626a"/>';
    } else s += mouth(g, my, { w: 20, style: "frown" }, ex);
    // 口ひげ
    const mu = "M100 141C94 139 84 140 76 147C74 152 77 155 79 152L81 155L84 151L87 154L90 150L94 152L97 149L100 150L103 149L106 152L110 150L113 154L116 151L119 155L121 152C123 155 126 152 124 147C116 140 106 139 100 141Z";
    s += shape(mu, "#2b2826", 2.6);
    s += brush([[82, 146], [92, 143.5]], 1.2, { fill: "#a3a09c" }) + brush([[108, 143.5], [118, 146]], 1.2, { fill: "#a3a09c" });
    // あごのしわ
    s += brush([[93, 168], [100, 166.5], [107, 168]], 1.3, { op: 0.8 });
    // 頬の古傷
    s += brush([[64, 129], [70, 135], [75, 141]], 1.8, { fill: "#8c3c2c" });
    if (g.det) s += brush([[65, 136], [70, 131]], 1, {}) + brush([[69, 139], [73, 134]], 1, {});
    s += cap(g, 1);
    s += fx(g, ex, { veinX: 158, veinY: 52 });
    return s + headClose(g);
  }

  // 剛田: パワー自慢の先輩 (角ばったあご、丸刈り、大きな歯を見せて笑う)
  function drawGoda(g) {
    const ex = g.ex;
    let s = "";
    s += neck(g, 28, 138);
    s += jersey(g, "big", 28);
    s += headOpen(g);
    s += ear(g, -1, 98, 130, true) + ear(g, 1, 98, 130, true);
    s += faceShape(g, "goda");
    s += faceShade(g, { jaw: "goda", cheekHatch: [62, 126] });
    // 丸刈り
    const hair = "M52 104C51 76 58 50 76 42C88 37 112 37 124 42C142 50 149 76 148 104L142 104C142 92 140 84 136 78C126 72 112 70 100 70C88 70 74 72 64 78C60 84 58 92 58 104Z";
    const hid = g.id + "hr";
    s += '<clipPath id="' + hid + '"><path d="' + hair + '"/></clipPath>';
    s += fillP(hair, "#33343c");
    s += '<g clip-path="url(#' + hid + ')">';
    s += fillP("M60 62C70 48 88 42 104 42C90 48 76 58 70 74Z", "#6c7080", 0.9);
    if (g.det) {
      let d = "";
      const r = rng(77);
      for (let i = 0; i < 70; i++) {
        const x = 54 + r() * 92;
        const y = 40 + r() * 40;
        d += "M" + n(x) + " " + n(y) + "h1.2v1.2h-1.2Z";
      }
      s += fillP(d, "#9aa0b0", 0.7);
    }
    s += "</g>";
    s += shape("M52 104C51 76 58 50 76 42C88 37 112 37 124 42C142 50 149 76 148 104", "none", 3.4);
    s += brush([[60, 92], [66, 78], [82, 71], [100, 70], [118, 71], [134, 78], [140, 92]], 1.6, { op: 0.75 });
    const E = { w: 16, h: 6, r: 4.4, lid: 4.2, tilt: 1.4 };
    s += eye(g, 80, 114, -1, E, ex) + eye(g, 120, 114, 1, E, ex);
    const B = { w: 24, t: 7.8, arch: 0.6, lift: -1 };
    s += brow(g, 79, 102, -1, B, ex) + brow(g, 121, 102, 1, B, ex);
    s += nose(g, 134, "broad", ex);
    // 鼻のばんそうこう
    s += '<g transform="rotate(-10 100 121)"><rect x="86" y="117" width="28" height="9" rx="3" fill="#f2d7ac" stroke="' + INK + '" stroke-width="1.8"/><rect x="95" y="118.5" width="10" height="6" fill="#e3bf8a"/><circle cx="90" cy="121.5" r=".7" fill="' + INK + '"/><circle cx="110" cy="121.5" r=".7" fill="' + INK + '"/></g>';
    // 口: ふだんからニカッと笑う
    if (ex === "normal") s += mouth(g, 151, { w: 34, grin: 1, deep: 9 }, "happy");
    else s += mouth(g, 151, { w: 30, grin: 1.25, deep: 16 }, ex);
    // あごの割れ目
    s += brush([[100, 166], [100, 171]], 1.4, { op: 0.8 });
    if (ex === "happy" || ex === "normal") s += brush([[68, 140], [70, 150]], 1.4, { op: 0.6 }) + brush([[132, 140], [130, 150]], 1.4, { op: 0.6 });
    s += fx(g, ex, { veinX: 152, veinY: 52, sweatX: 154, sweatY: 96, gloomY: 76 });
    return s + headClose(g);
  }

  // 早瀬: マネージャー (ポニーテール、大きな瞳、元気)
  function drawHayase(g) {
    const ex = g.ex;
    const hc = "#5a3324";
    const hs = shadeOf(hc, 0.35);
    const hl = lightOf(hc, 0.35);
    let s = headOpen(g);
    // ポニーテール (頭の後ろから右へ)
    s += shape(curve([[136, 50, 1], [158, 46], [176, 60], [180, 86], [172, 116, 1], [170, 100], [162, 118, 1], [160, 98], [150, 106, 1], [152, 84], [142, 70]], true), hc, 3);
    s += brush([[148, 56], [166, 64], [172, 84]], 1.4, { fill: hl });
    s += brush([[150, 64], [160, 78], [160, 96]], 1.2, { op: 0.7 });
    // 後ろ髪
    const back = curve([[100, 36], [72, 40], [54, 58], [48, 84], [50, 112], [56, 134, 1], [60, 122], [64, 140, 1], [100, 140], [136, 140, 1], [140, 122], [144, 134, 1], [150, 112], [152, 84], [146, 58], [128, 40]], true);
    s += shape(back, hs, 3);
    s += headClose(g);
    s += neck(g, 13, 140);
    s += girlJacket(g);
    s += headOpen(g);
    s += faceShape(g, "girl");
    s += faceShade(g, { jaw: "girl", hatch: false });
    // シュシュ
    s += shape("M136 44c6-4 14-2 16 4c2 6-2 12-8 12c-6 0-10-6-8-16z", g.L.trim === "#ffffff" ? g.L.main : g.L.trim, 2.4);
    s += brush([[140, 48], [146, 54]], 1.2, { op: 0.6 }) + brush([[146, 46], [150, 52]], 1.2, { op: 0.6 });
    // 前髪 (ぎざぎざの束)
    const bang = curve([[54, 110, 1], [52, 80], [62, 56], [82, 42], [104, 39], [126, 44], [142, 58], [149, 80], [147, 110, 1], [142, 90], [136, 101, 1], [128, 76], [118, 96, 1], [108, 68], [101, 90, 1], [94, 66], [84, 101, 1], [76, 74], [66, 97, 1], [60, 86]], true);
    s += shape(bang, hc, 3.2);
    // 天使の輪 (つや)
    s += fillP("M64 64C78 54 94 52 104 52L102 56L106 58L98 60C86 60 74 64 66 70Z", hl, 0.95);
    s += fillP("M112 52C124 52 134 56 140 64L134 66L130 62L124 64C120 58 116 56 112 56Z", hl, 0.95);
    s += brush([[92, 44], [88, 66], [84, 96]], 1.2, { op: 0.6 }) + brush([[114, 44], [118, 70], [118, 92]], 1.2, { op: 0.6 }) + brush([[130, 50], [136, 72], [136, 96]], 1.1, { op: 0.5 }) + brush([[72, 52], [68, 74], [66, 92]], 1.1, { op: 0.5 });
    // 横の髪 (耳を隠す)
    for (const sd of [-1, 1]) {
      const P = (u, v) => [100 + sd * u, v];
      s += shape(curve([P(44, 84, 1), P(48, 110), P(48, 136), P(42, 156, 1), P(40, 138), P(36, 146, 1), P(38, 120), P(38, 96)], true), hc, 2.8);
      s += brush([P(43, 100), P(44, 128)], 1.2, { fill: hl });
    }
    const E = { w: 19, h: 13, r: 8, lid: 4, lash: 1, iris: "#5a2c1c", hl: 2, tilt: 0.6 };
    s += eye(g, 81.5, 117, -1, E, ex) + eye(g, 118.5, 117, 1, E, ex);
    const B = { w: 16, t: 2.6, arch: 2.6 };
    s += brow(g, 81, 101, -1, B, ex) + brow(g, 119, 101, 1, B, ex);
    s += nose(g, 132, "small", ex);
    s += blush(g, 130, ex === "happy");
    if (ex === "happy") s += mouth(g, 142, { w: 14, grin: 1.2, deep: 10, teeth: false }, ex);
    else if (ex === "angry") s += mouth(g, 143, { w: 14, pout: true }, ex);
    else s += mouth(g, 142, { w: 14, style: "soft" }, ex);
    s += fx(g, ex, { veinX: 42, veinY: 50, sweatX: 154, sweatY: 92 });
    return s + headClose(g);
  }

  // 犬飼: 理論派の打撃コーチ (細面にメガネ、七三分け)
  function drawInukai(g) {
    const ex = g.ex;
    const hc = "#2a2a31";
    const grey = "#9298a4";
    let s = "";
    s += neck(g, 16, 140);
    s += coachJacket(g, 16);
    s += headOpen(g);
    s += ear(g, -1, 104, 128) + ear(g, 1, 104, 128);
    s += faceShape(g, "slim");
    s += faceShade(g, { jaw: "slim", extraShade: fillP("M64 126C68 136 70 146 72 152L62 150Z", g.skinS, 0.8) });
    // 七三分けの髪
    const hair = curve([[52, 106, 1], [49, 84], [53, 60], [66, 44], [86, 34], [112, 31], [136, 40], [149, 60], [152, 84], [149, 106, 1], [143, 106, 1], [143, 96], [136, 88], [130, 94, 1], [128, 82], [114, 70], [98, 64], [84, 56], [78, 48, 1], [74, 60], [66, 72], [61, 86], [60, 106, 1]], true);
    s += shape(hair, hc, 3.2);
    s += fillP("M60 98C58 88 60 80 64 76L66 102Z", grey, 0.95) + fillP("M140 100C142 90 140 82 136 78L135 102Z", grey, 0.95);
    s += brush([[79, 36], [79, 44], [78, 50]], 2, {});
    s += fillP("M86 40C106 36 128 42 142 58C130 50 112 44 92 46Z", "#6a7080", 0.9);
    s += brush([[84, 46], [104, 50], [124, 60], [138, 80]], 1.3, { fill: "#7c8190" });
    s += brush([[86, 54], [108, 60], [126, 72], [132, 90]], 1.1, { fill: "#7c8190" });
    s += brush([[58, 70], [66, 52], [76, 42]], 1.2, { fill: "#7c8190" });
    const E = { w: 15, h: 5, r: 3.6, lid: 3.2, tilt: -0.4 };
    const glare = ex === "serious";
    if (!glare) s += eye(g, 82, 116, -1, E, ex) + eye(g, 118, 116, 1, E, ex);
    const B = { w: 18, t: 3.2, arch: 1.2 };
    s += brow(g, 82, 101, -1, B, ex) + brow(g, 118, 101, 1, B, ex);
    s += nose(g, 134, "long", ex);
    // ほほのこけた線
    s += brush([[68, 134], [71, 146]], 1.2, { op: 0.6 }) + brush([[132, 134], [129, 146]], 1.2, { op: 0.6 });
    if (ex === "happy") s += mouth(g, 150, { w: 16, grin: 1, deep: 8 }, ex);
    else if (ex === "angry") s += mouth(g, 150, { w: 18, style: "frown" }, "normal");
    else s += mouth(g, 150, { w: 18, style: "soft" }, ex);
    // メガネ (つるは耳へ)
    const lens = (cx) => "M" + (cx - 13) + " 110Q" + (cx - 13) + " 107 " + (cx - 10) + " 107H" + (cx + 10) + "Q" + (cx + 13) + " 107 " + (cx + 13) + " 110V119Q" + (cx + 13) + " 124 " + (cx + 8) + " 124H" + (cx - 8) + "Q" + (cx - 13) + " 124 " + (cx - 13) + " 119Z";
    if (glare) {
      // 光るメガネ (目が見えない)
      s += fillP(lens(82), "#ffffff") + fillP(lens(118), "#ffffff");
      s += fillP("M70 120L84 107H90L74 124Z", "#cfe0f5", 0.9) + fillP("M106 120L120 107H126L110 124Z", "#cfe0f5", 0.9);
    } else {
      s += fillP(lens(82), "#dfeaf7", 0.22) + fillP(lens(118), "#dfeaf7", 0.22);
      s += fillP("M72 118L82 108H86L76 122Z", "#ffffff", 0.55) + fillP("M108 118L118 108H122L112 122Z", "#ffffff", 0.55);
    }
    s += shape(lens(82), "none", 2.4) + shape(lens(118), "none", 2.4);
    s += shape("M95 112Q100 109 105 112", "none", 2.2);
    s += shape("M69 110L58 108M131 110L142 108", "none", 2.2);
    s += fx(g, ex, { vein: false, sweatX: 152, sweatY: 92, gloomY: 76 });
    return s + headClose(g);
  }

  // 竜崎: 同期のライバル (鋭い目、つばの下から前髪、不敵な笑み)
  function drawRyu(g) {
    const ex = g.ex;
    const hc = "#1f1c28";
    const hl = "#5a6488";
    let s = "";
    s += rot(g, napeHair(g, hc));
    s += neck(g, 18, 140);
    s += jersey(g, "std", 18);
    s += headOpen(g);
    s += ear(g, -1, 106, 130) + ear(g, 1, 106, 130);
    s += faceShape(g, "vee");
    s += faceShade(g, { jaw: "vee", cap: true, capDy: 3 });
    // 横の髪 (耳にかかる)
    for (const sd of [-1, 1]) {
      const P = (u, v) => [100 + sd * u, v];
      s += shape(curve([P(44, 96, 1), P(46, 112), P(45, 128), P(41, 149, 1), P(39, 134), P(32, 140, 1), P(35, 122), P(28, 122, 1), P(35, 108), P(37, 97, 1)], true), hc, 2.6);
      s += brush([P(41, 104), P(41, 122)], 1.2, { fill: hl });
    }
    const E = { w: 21, h: 7, r: 5.6, lid: 4.6, tilt: 2.8, crease: 1 };
    s += eye(g, 80.5, 120, -1, E, ex) + eye(g, 119.5, 120, 1, E, ex);
    const B = { w: 22, t: 3.8, arch: 1, lift: -2.5 };
    s += brow(g, 80, 108, -1, B, ex) + brow(g, 120, 108, 1, B, ex);
    s += nose(g, 136, "sharp", ex);
    // ほお骨
    s += brush([[66, 130], [70, 134]], 1.1, { op: 0.6 }) + brush([[134, 130], [130, 134]], 1.1, { op: 0.6 });
    if (ex === "normal") s += mouth(g, 151, { w: 17, style: "smirk" }, ex);
    else if (ex === "happy") s += mouth(g, 150, { w: 18, grin: 1.05, deep: 8 }, ex);
    else s += mouth(g, 151, { w: 18 }, ex);
    // 前髪 (つばの下から鋭く)
    const bang = curve([[74, 103, 1], [77, 111], [79, 118, 1], [84, 107], [90, 127, 1], [95, 108], [103, 123, 1], [108, 107], [117, 135, 1], [118, 108], [125, 117, 1], [128, 103, 1]], true);
    s += shape(bang, hc, 2.4);
    s += brush([[90, 106], [92, 116]], 1.2, { fill: hl }) + brush([[110, 106], [114, 120]], 1.2, { fill: hl });
    s += cap(g, 3);
    s += fx(g, ex, { veinX: 160, veinY: 50, sweatX: 152, sweatY: 102 });
    return s + headClose(g);
  }

  // 自分 (サクセスで作る選手): 肌の色・目の形・髪型から組み立てる
  const ME_EYES = {
    round: { w: 17, h: 8, r: 5.4, lid: 3.8, tilt: 0 },
    big: { w: 19, h: 11, r: 7, lid: 3.8, hl: 2, iris: "#3b2a22", tilt: 0.4 },
    sharp: { w: 20, h: 6, r: 4.8, lid: 4.4, tilt: 2.6 },
    smile: { w: 18, h: 7, r: 5, lid: 4, style: "smile" },
    line: { w: 17, h: 6, r: 4.4, lid: 3.6, style: "line" },
    glasses: { w: 16, h: 7.5, r: 4.8, lid: 3.4, tilt: 0 },
  };
  M.ME_EYES = Object.keys(ME_EYES);
  function drawMe(g) {
    const ex = g.ex;
    const f = g.face || {};
    const hc = f.hair || "#2b1b14";
    const hs = f.hs == null ? hash(String(g.seed || "me")) % 3 : f.hs % 3;
    const E = ME_EYES[f.eyes] || ME_EYES.round;
    let s = "";
    if (hs === 2) s += rot(g, napeHair(g, hc));
    s += neck(g, 19, 140);
    s += jersey(g, "std", 19);
    s += headOpen(g);
    s += ear(g, -1, 106, 132) + ear(g, 1, 106, 132);
    s += faceShape(g, "std");
    s += faceShade(g, { jaw: "std", cap: true });
    s += capHair(g, hs, hc);
    s += eye(g, 81, 118, -1, E, ex) + eye(g, 119, 118, 1, E, ex);
    const B = { w: 21, t: 4.8, arch: 2 };
    s += brow(g, 80, 106, -1, B, ex) + brow(g, 120, 106, 1, B, ex);
    s += nose(g, 135, "std", ex);
    if (f.eyes === "glasses") {
      s += '<circle cx="81" cy="118" r="11" fill="#dfeaf7" fill-opacity=".2" stroke="' + INK + '" stroke-width="2.4"/><circle cx="119" cy="118" r="11" fill="#dfeaf7" fill-opacity=".2" stroke="' + INK + '" stroke-width="2.4"/>';
      s += shape("M92 116Q100 112 108 116M70 116L58 112M130 116L142 112", "none", 2.2);
      s += fillP("M74 122L84 110H88L78 124Z", "#ffffff", 0.5) + fillP("M112 122L122 110H126L116 124Z", "#ffffff", 0.5);
    }
    if (ex === "normal") s += mouth(g, 151, { w: 18, style: "soft" }, ex);
    else s += mouth(g, 150, { w: 18, grin: 1.15, deep: 11 }, ex);
    s += cap(g, 0);
    s += fx(g, ex, { veinX: 158, veinY: 50 });
    return s + headClose(g);
  }

  const CHARS = {
    kanto: { skin: "#d9a274", male: true, draw: drawOni, tilt: { happy: -3, sad: 3 } },
    goda: { skin: "#e2ad7e", male: true, draw: drawGoda, tilt: { normal: -3, happy: -5, sad: 4 } },
    hayase: { skin: "#ffe2cc", male: false, draw: drawHayase, tilt: { normal: 5, happy: 6, angry: -3, sad: 4 } },
    inukai: { skin: "#f1c8a4", male: true, draw: drawInukai, tilt: { happy: 2, sad: 3 } },
    ryuzaki: { skin: "#ffd9b8", male: true, draw: drawRyu, tilt: { normal: -5, happy: -4, angry: 2, sad: 4 } },
    me: { skin: "#ffd9b8", male: true, draw: drawMe, tilt: { happy: -3, angry: 2, sad: 4 } },
  };
  M.CHARS = Object.keys(CHARS);

  // 切り抜き (viewBox)
  const CROP = {
    bust: [0, 0, 200, 240],
    square: [6, 26, 188, 188],
    face: [40, 40, 120, 120],
  };

  /* ---------- 公開: SVG の文字列 ----------
   * o: { team, ex (表情), crop: bust|square|face, size (表示の大きさ px、細部の量), face (自分の顔), seed, frame, cls } */
  const cache = {};
  let seq = 0;
  M.svg = function (who, o) {
    o = o || {};
    const C = CHARS[who] || CHARS.me;
    const ex = EXPRS.indexOf(o.ex) >= 0 ? o.ex : "normal";
    const crop = CROP[o.crop] ? o.crop : "bust";
    const det = (o.size || 120) >= 72;
    const L = look(o.team);
    const f = o.face || {};
    const key = [who, ex, crop, det ? 1 : 0, o.frame === false ? 0 : 1, o.sil ? 1 : 0, L.key, f.skin || "", f.eyes || "", f.hs == null ? "" : f.hs, f.hair || "", who === "me" ? o.seed || "" : ""].join("|");
    let body = cache[key];
    if (!body) {
      const g = { id: "§", who, ex, det, L, face: f, seed: o.seed, n: 0, male: C.male, tilt: (C.tilt && C.tilt[ex]) || 0 };
      g.skin = who === "me" ? f.skin || C.skin : C.skin;
      g.skinS = mix(g.skin, "#9a4f3c", 0.32);
      const vb = CROP[crop];
      let s = defs(g);
      s += panel(g);
      // sil: まだ会っていない人は黒いシルエット
      if (o.sil) s += '<filter id="§sil"><feColorMatrix type="matrix" values="0 0 0 0 .13 0 0 0 0 .15 0 0 0 0 .22 0 0 0 1 0"/></filter><g filter="url(#§sil)">' + C.draw(g) + "</g>";
      else s += C.draw(g);
      if (o.frame !== false) {
        const sw = crop === "face" ? 4 : 3.2;
        s += '<rect x="' + (vb[0] + sw / 2) + '" y="' + (vb[1] + sw / 2) + '" width="' + (vb[2] - sw) + '" height="' + (vb[3] - sw) + '" fill="none" stroke="' + INK + '" stroke-width="' + sw + '"/>';
      }
      body = '<svg class="mg ' + "§cls" + '" viewBox="' + vb.join(" ") + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="§label">' + s + "</svg>";
      cache[key] = body;
    }
    const uid = "mg" + (++seq).toString(36) + "_";
    return body
      .replace("§cls", escA(o.cls || ""))
      .replace("§label", escA(o.label || ""))
      .split("§")
      .join(uid);
  };

  // 小さなアイコン (顔のアップ): 文書に 1 つの SVG スプライトへ symbol を置き、<use> で参照する
  const syms = {};
  M.icon = function (who, o) {
    o = o || {};
    const f = o.face || {};
    const key = [who, o.ex || "normal", o.sil ? 1 : 0, look(o.team).key, f.skin || "", f.eyes || "", f.hs == null ? "" : f.hs, o.seed || ""].join("|");
    let id = syms[key];
    if (!id || !document.getElementById(id)) {
      let sp = document.getElementById("mg-sprite");
      if (!sp) {
        sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sp.id = "mg-sprite";
        sp.setAttribute("aria-hidden", "true");
        // display:none にすると中の clipPath が効かなくなるので、大きさ 0 で置く
        sp.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
        document.body.appendChild(sp);
      }
      id = "mgs" + (++seq).toString(36);
      const inner = M.svg(who, Object.assign({}, o, { crop: "face", size: 40, frame: false }))
        .replace(/^<svg[^>]*>/, "")
        .replace(/<\/svg>$/, "");
      sp.insertAdjacentHTML("beforeend", '<symbol id="' + id + '" viewBox="' + CROP.face.join(" ") + '">' + inner + "</symbol>");
      syms[key] = id;
    }
    return '<svg class="mg mg-ic ' + escA(o.cls || "") + '" viewBox="0 0 120 120" aria-hidden="true"><use href="#' + id + '" width="120" height="120"/></svg>';
  };

  // 台詞から表情を決める (台詞に face があればそれを使う)
  M.faceOf = function (text, face) {
    if (face && EXPRS.indexOf(face) >= 0) return face;
    const t = String(text || "");
    if (/！？|!\?|えっ|なっ|まさか|うそ/.test(t)) return "surprised";
    if (/チッ|くそ|ふざけ|許さ|甘い|ゆるさ|ばかもん|バカモン/.test(t)) return "angry";
    if (/うう|ごめん|残念|落ち込|しょんぼり|つらい/.test(t)) return "sad";
    if (/^…|……|任せられん|鍛え直せ|以上だ/.test(t)) return "serious";
    if (/やった|おめでとう|ありがとう|うれし|嬉し|最高|すごい|いいぞ|！/.test(t)) return "happy";
    return "normal";
  };

  PB.Manga = M;
})((window.PB = window.PB || {}));
