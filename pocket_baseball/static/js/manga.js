/* 熱闘！ポケットベースボール — サクセスのキャラクター (今風のアニメ塗り)
 * 細く均一な焦げ茶の線・ベタ塗り + 影 1 段 (セル影)・大きめの瞳・小さな鼻・斜めの帯としぶきの背景。SVG の文字列を作って HTML に埋め込む。
 * 座標は 200x240 (顔の中心 x=100)。頭は少し右 (台詞の側) を向く: 顔の点は (u: 中心からの横, v: 縦, z: 奥行き) で持ち、prj() で移す。
 * 頭は首の付け根を中心に g.hk 倍に縮めて少し持ち上げる (頭のグループの transform)。帽子・服は自分のチームの色とマーク。 */
(function (PB) {
  "use strict";
  const M = {};
  const INK = "#2a1c18"; // 線 (黒に近い焦げ茶)
  const INK2 = "#5a2e24"; // 顔の中の線 (鼻・下まぶた・しわ)
  const EXPRS = ["normal", "happy", "angry", "serious", "surprised", "sad"];
  M.EXPRS = EXPRS;
  M.EX_JP = { normal: "ふつう", happy: "笑顔", angry: "怒り", serious: "真剣", surprised: "おどろき", sad: "しょんぼり" };

  /* ---------- 小さな道具 ---------- */
  const n = (v) => Math.round(v * 10) / 10;
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
  // 線の太さの倍率 (描いている間だけ使う。小さい絵は太く、縮めた頭の中はその分だけ太く)
  let K = 1;
  // 入り抜きのある線の形 (塗りの輪郭)。o: {s0, e0 (両端の太さの割合), a, b (細くなる長さの割合), per, raw (倍率をかけない)}
  function brushD(pts, w, o) {
    o = o || {};
    if (!o.raw) w *= K;
    let cl = 0;
    for (let i = 1; i < pts.length; i++) cl += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const s = sample(pts, o.per || Math.max(3, Math.min(8, Math.ceil(cl / (pts.length - 1) / 1.6))));
    const len = [0];
    for (let i = 1; i < s.length; i++) len.push(len[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
    const tot = len[len.length - 1] || 1;
    const a = o.a == null ? 0.3 : o.a;
    const b = o.b == null ? 0.35 : o.b;
    const s0 = o.s0 == null ? 0.15 : o.s0;
    const e0 = o.e0 == null ? 0.1 : o.e0;
    const ease = (x) => Math.sin((Math.min(1, Math.max(0, x)) * Math.PI) / 2);
    const L = [];
    const R = [];
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
      R.push(n(p[0] + ty * hw) + " " + n(p[1] - tx * hw));
    }
    return "M" + L.join(" ") + " " + R.reverse().join(" ") + "Z";
  }
  function brush(pts, w, o) {
    o = o || {};
    return '<path d="' + brushD(pts, w, o) + '" fill="' + (o.fill || INK) + '"' + (o.op ? ' fill-opacity="' + o.op + '"' : "") + "/>";
  }
  // 輪郭つきの塗り
  function shape(d, fill, sw, col) {
    return '<path d="' + d + '" fill="' + (fill || "none") + '"' + (sw ? ' stroke="' + (col || INK) + '" stroke-width="' + n(sw * K) + '" stroke-linejoin="round" stroke-linecap="round"' : "") + "/>";
  }
  const fillP = (d, fill, op) => '<path d="' + d + '" fill="' + fill + '"' + (op != null ? ' fill-opacity="' + op + '"' : "") + "/>";
  const poly = (pts) => "M" + pts.map((p) => n(p[0]) + " " + n(p[1])).join("L") + "Z";
  const clipOpen = (id, d) => '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath><g clip-path="url(#' + id + ')">';
  // いくつかの形を合わせた切り抜き
  const clipMany = (id, ds) => '<clipPath id="' + id + '">' + ds.map((d) => '<path d="' + d + '"/>').join("") + '</clipPath><g clip-path="url(#' + id + ')">';
  // 楕円 (sw があれば輪郭、op は塗りの濃さ)
  function ell(c, rx, ry, fill, sw, op) {
    return '<ellipse cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="' + fill + '"' + (op != null ? ' fill-opacity="' + op + '"' : "") + (sw ? ' stroke="' + INK + '" stroke-width="' + n(sw * K) + '"' : "") + "/>";
  }

  /* ---------- 線の太さ (200 幅の座標。280px の絵で ×1.4) ---------- */
  const LW = {
    sil: 1.9, // 外側の輪郭
    chin: 2.3, // あご・つばの下側 (少し重く)
    part: 1.3, // 服・帽子・耳の中の線、毛束
    fine: 0.85, // 髪の筋・しわ・二重
    mouth: 1.45, // 閉じた口
    lashM: 2.9, // 上まぶた (男)
    lashF: 3.4, // 上まぶた (女)
  };

  /* ---------- 色 ---------- */
  // セル影は 1 段だけ: 肌は赤みのある影、白い布は青みの灰色
  const skinShade = (c) => mix(c, "#a9503a", 0.36);
  const blushOf = (c) => (lum(c) < 0.72 ? "#e8706e" : lum(c) < 0.8 ? "#f47c7c" : "#ff8a8a");
  // 黒い布はそのままだと影が見えないので少し持ち上げる
  const clothBase = (c) => (lum(c) < 0.12 ? mix(c, "#3a3c4c", 0.55) : c);
  const clothShade = (c) => (lum(c) > 0.8 ? mix(c, "#6d78a8", 0.26) : lum(c) < 0.2 ? mix(c, "#000000", 0.45) : mix(c, "#2a1a4a", 0.3));
  const clothLight = (c) => (lum(c) < 0.2 ? mix(c, "#9aa4c8", 0.32) : mix(c, "#ffffff", 0.35));
  // 髪: 地・影・つや (暗い色・青みの色は青灰色のつや、茶色は暖かいつや)
  function hairPal(c, hl) {
    const base = lum(c) < 0.08 ? mix(c, "#3a3a4a", 0.2) : c;
    const [r, , b] = hex(base);
    const cool = lum(base) < 0.1 || b > r;
    return { base, shade: mix(base, "#120814", 0.42), hl: hl || (cool ? mix(base, "#a9b9dc", 0.42) : mix(base, "#f4d2b0", 0.45)) };
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
  // 差し色 (チームカラー。白・黒に近いときは黄色)
  function accentOf(L) {
    const l = lum(L.main);
    return l > 0.9 || l < 0.12 ? "#ffd23f" : L.main;
  }
  // 小物の色 (チームの色のうち、茶色の髪の上で目立つもの。なければ黄色)
  function accOf(L) {
    for (const c of [L.trim, L.main, L.sub, L.piping, L.button]) if (c && lum(c) > 0.3 && lum(c) < 0.88 && dist(c, "#8c4c2c") > 160) return c;
    return "#ffd23f";
  }

  /* ---------- 向きと頭の大きさ ---------- */
  // 点 (u, v, z) を頭の座標へ。g.sa だけ右を向く
  const prj = (g, u, v, z) => [100 + u * g.ca + (z || 0) * g.sa, v];
  // 顔の前面の奥行き (中央が前に出た放物面)
  const zf = (u) => 40 - 0.019 * u * u;
  const F = (g, u, v, dz) => prj(g, u, v, zf(u) + (dz || 0));
  // 点列を顔の面へ / 奥行きつきで移す (3 番目・4 番目が 1 なら角)
  const mapF = (g, pts, dz) =>
    pts.map((p) => {
      const q = F(g, p[0], p[1], dz);
      return p[2] ? [q[0], q[1], 1] : q;
    });
  const mapZ = (g, pts) =>
    pts.map((p) => {
      const q = prj(g, p[0], p[1], p[2]);
      return p[3] ? [q[0], q[1], 1] : q;
    });
  // 頭のグループ: 首の付け根 (100, 172) を中心に g.hk 倍して g.lift だけ上げ、表情で少し傾ける
  const headT = (g) => (g.tilt ? "rotate(" + g.tilt + " 100 158) " : "") + "translate(100 " + (172 - g.lift) + ") scale(" + g.hk + ") translate(-100 -172)";
  function headOpen(g) {
    g.inHead = true;
    K = g.k0 / g.hk;
    return '<g transform="' + headT(g) + '">';
  }
  function headClose(g) {
    g.inHead = false;
    K = g.k0;
    return "</g>";
  }
  // 頭の座標 → 絵の座標 (首に落ちるあごの影に使う)
  function h2s(g, p) {
    let x = 100 + g.hk * (p[0] - 100);
    let y = 172 - g.lift + g.hk * (p[1] - 172);
    if (g.tilt) {
      const a = (g.tilt * Math.PI) / 180;
      const dx = x - 100;
      const dy = y - 158;
      x = 100 + dx * Math.cos(a) - dy * Math.sin(a);
      y = 158 + dx * Math.sin(a) + dy * Math.cos(a);
    }
    return [x, y];
  }
  // 人物の影に使う外形を集める
  const sil = (g, d) => g.sil.push([d, g.inHead]);

  /* ---------- 背景: 斜めの帯としぶき ---------- */
  // base: 地, a: 中くらいの帯, b: 明るい帯, c: 濃い細帯, fl: しぶきの 3 色, sh: 人物の影
  const BG = {
    normal: { base: "#f8fcff", a: "#1e86c8", b: "#acd8f0", c: "#1a62a8", fl: ["#ffffff", "#fff35c", "#62b0dd"], sh: "#c3cad6" },
    happy: { base: "#fffaea", a: "#ffa22e", b: "#ffe08a", c: "#ff6a3d", fl: ["#ffffff", "#ff8fb1", "#ffd23f"], sh: "#e8d2b4" },
    angry: { base: "#fff3ee", a: "#ff5a48", b: "#ffbca8", c: "#c4242a", fl: ["#ffffff", "#ffd84a", "#ff9a7a"], sh: "#e8c4bc" },
    serious: { base: "#eef2fb", a: "#34508f", b: "#a8b9e2", c: "#1b2a5a", fl: ["#ffffff", "#8fb0ff", "#dfe8ff"], sh: "#c2c8da" },
    surprised: { base: "#f0fcff", a: "#22bde6", b: "#a8efff", c: "#1689bb", fl: ["#ffffff", "#ffe14a", "#7ae0ff"], sh: "#bcd8e2" },
    sad: { base: "#eff2f8", a: "#8797c2", b: "#cdd6ec", c: "#5a6893", fl: ["#ffffff", "#c9d6ff", "#a9b6d8"], sh: "#c8cedc" },
  };
  // 4 つの角のきらり (中央はへこんだ星)
  const star = (x, y, k) => "M" + n(x) + " " + n(y - k * 1.7) + "Q" + n(x + k * 0.15) + " " + n(y - k * 0.15) + " " + n(x + k) + " " + n(y) + "Q" + n(x + k * 0.15) + " " + n(y + k * 0.15) + " " + n(x) + " " + n(y + k * 1.7) + "Q" + n(x - k * 0.15) + " " + n(y + k * 0.15) + " " + n(x - k) + " " + n(y) + "Q" + n(x - k * 0.15) + " " + n(y - k * 0.15) + " " + n(x) + " " + n(y - k * 1.7) + "Z";
  function background(g) {
    const p = BG[g.ex] || BG.normal;
    const small = g.lod === 2;
    let s = '<rect x="-20" y="-20" width="240" height="280" fill="' + p.base + '"/>';
    const r = rng(hash(g.who + g.ex + "bg"));
    // 帯は右上がり。回した座標で横長の四角を並べ、端はかすれ (筆の毛先) にする
    s += '<g transform="rotate(-30 100 120)">';
    const band = (y, h, col, x0, x1, ragL, ragR) => {
      let out = fillP("M" + x0 + " " + y + "H" + x1 + "V" + (y + h) + "H" + x0 + "Z", col);
      if (ragL || ragR) {
        let k = "";
        const m = Math.max(3, Math.round(h / 2.2));
        for (let i = 0; i < m; i++) {
          const yy = y + (i * h) / m;
          const hh = (h / m) * (0.5 + r() * 0.45);
          if (ragL) k += "M" + n(x0 + 1) + " " + n(yy) + "h-" + n(6 + r() * 26) + "l-3 " + n(hh / 2) + "l3 " + n(hh / 2) + "h" + n(6 + r() * 26) + "Z";
          if (ragR) k += "M" + n(x1 - 1) + " " + n(yy) + "h" + n(6 + r() * 26) + "l3 " + n(hh / 2) + "l-3 " + n(hh / 2) + "h-" + n(6 + r() * 26) + "Z";
        }
        out += fillP(k, col);
      }
      return out;
    };
    s += band(-6, 34, p.b, -120, 340, 0, 0);
    if (!small) s += band(31, 3, p.c, -40, 300, 1, 0);
    s += band(108, 22, p.a, 40, 340, !small, 0);
    if (!small) s += band(134, 5, p.b, -120, 180, 0, 1);
    s += band(186, 40, p.b, -120, 340, 0, 0);
    if (!small) s += band(194, 9, p.a, 70, 340, 1, 0) + band(232, 3, p.c, -120, 150, 0, 1);
    // 帯の中の白いかすれ線 (大きい絵だけ)
    if (g.lod === 0) {
      let d = "";
      for (let i = 0; i < 9; i++) {
        const y = [111, 116, 124, 196, 199, 201, 12, 20, 210][i];
        const x = 60 + r() * 140;
        const w = 30 + r() * 90;
        d += "M" + n(x) + " " + y + "h" + n(w) + "l-3 " + n(0.6 + r() * 0.8) + "h-" + n(w - 6) + "Z";
      }
      s += fillP(d, "#ffffff", 0.75);
    }
    // チームの差し色の線 (ふつう・笑顔)
    const acc = !small && (g.ex === "normal" || g.ex === "happy") ? accentOf(g.L) : null;
    if (acc) s += band(74, 2.2, acc, 130, 340, 1, 0);
    s += "</g>";
    if (!small) {
      // しぶき (絵の具の点): 帯の近くに集める
      const d = ["", "", "", ""];
      const dot = (k, x, y, rr) => {
        d[k] += "M" + n(x - rr) + " " + n(y) + "a" + n(rr) + " " + n(rr) + " 0 1 0 " + n(rr * 2) + " 0a" + n(rr) + " " + n(rr) + " 0 1 0 -" + n(rr * 2) + " 0Z";
        // 大きい点には小さな飛び散り
        if (rr > 1.6) d[k] += "M" + n(x + rr * 1.8) + " " + n(y - rr) + "l" + n(rr * 1.6) + " -" + n(rr * 0.7) + "l-" + n(rr * 0.5) + " " + n(rr * 1.2) + "Z";
      };
      for (let i = 0; i < 54; i++) {
        const x = r() * 200;
        dot(i % 3, x, 120 - (x - 100) * 0.577 + [-70, 20, 92][i % 3] + (r() - 0.5) * 34, 0.6 + r() * r() * 3.2);
      }
      if (acc) {
        for (let i = 0; i < 10; i++) {
          const x = 120 + r() * 90;
          dot(3, x, 64 - (x - 100) * 0.577 + (r() - 0.5) * 16, 0.6 + r() * r() * 2);
        }
      }
      s += fillP(d[0], p.fl[0]) + fillP(d[1], p.fl[1]) + fillP(d[2], p.fl[2]) + (acc ? fillP(d[3], acc) : "");
      if (g.ex === "happy") {
        // きらり (白 3 つと黄色 1 つ)
        for (let i = 0; i < 4; i++) {
          const x = i % 2 ? 166 + r() * 20 : 14 + r() * 20;
          const y = 26 + r() * 90;
          s += fillP(star(x, y, 3 + r() * 4), i === 3 ? "#ffd23f" : "#ffffff");
        }
      }
    }
    return s;
  }
  // 人物の影 (背景に落ちる平らな影)。集めた外形を右下へずらして塗る
  function figShadow(g) {
    let body = "";
    let head = "";
    for (const [d, h] of g.sil) {
      if (h) head += '<path d="' + d + '"/>';
      else body += '<path d="' + d + '"/>';
    }
    return '<g transform="translate(5.5 2.5)" fill="' + (BG[g.ex] || BG.normal).sh + '">' + body + '<g transform="' + headT(g) + '">' + head + "</g></g>";
  }

  /* ---------- 体・服 ---------- */
  // 肩の線 (左半分: 首の付け根 → 肩 → 画面の端)
  const SHOULDER = {
    std: [
      [81, 174],
      [32, 191],
      [-6, 214],
    ],
    slim: [
      [83, 175],
      [36, 193],
      [-4, 216],
    ],
    goda: [
      [72, 165],
      [14, 179],
      [-14, 197],
    ],
    girl: [
      [86, 166],
      [42, 186],
      [12, 212],
    ],
  };
  function torso(sh) {
    const L = [[sh[2][0], 252], sh[2], sh[1], sh[0]];
    const R = L.slice()
      .reverse()
      .map((p) => [200 - p[0], p[1]]);
    return curve(L.concat(R), true);
  }
  // 首 (前は少し奥行きがあるので右へずれる)。あごの影 (あごの形を下へずらす) と奥側の影
  function neck(g, hw, top) {
    const cx = 100 + 10 * g.sa;
    const t = top;
    const x0 = cx - hw;
    const x1 = cx + hw;
    const d = "M" + n(x0) + " " + t + "C" + n(x0 + 1) + " " + (t + 22) + " " + n(x0 - 1) + " 178 " + n(x0 - 4) + " 196L" + n(x1 + 4) + " 196C" + n(x1 + 1) + " 178 " + n(x1 - 1) + " " + (t + 22) + " " + n(x1) + " " + t + "Z";
    sil(g, d);
    let s = clipOpen(g.id + "nk", d) + fillP(d, g.skin);
    const jl = g.jaw.filter((p) => p[1] > 136).map((p) => h2s(g, p));
    s += fillP(curve(jl.map((p) => [p[0] + 3, p[1] + 9]), false) + "L" + n(x1 + 12) + " " + (t - 16) + "L" + n(x0 - 12) + " " + (t - 16) + "Z", g.skinS);
    s += fillP("M" + n(x1 - 5) + " " + t + "C" + n(x1 - 4) + " 170 " + n(x1 - 2) + " 186 " + n(x1 + 2) + " 198H" + n(x1 + 10) + "V" + t + "Z", g.skinS);
    s += "</g>" + shape(d, "none", LW.part);
    return s;
  }
  // ユニフォーム (ホームの白地・チームカラーのパイピング・アンダーシャツ)
  function jersey(g, build, hw) {
    if (g.crop === "face") return "";
    const L = g.L;
    const sh = SHOULDER[build];
    const body = torso(sh);
    sil(g, body);
    const cx = 102;
    const vy = 218;
    const W = mix(L.jersey, "#ffffff", 0.4);
    const WS = clothShade(W);
    const y0 = sh[0][1];
    let s = "";
    // アンダーシャツ (丸首)
    const ud = clothBase(L.under);
    s += shape("M" + n(cx - hw - 3) + " " + y0 + "C" + n(cx - hw + 4) + " " + (y0 + 14) + " " + n(cx + hw - 4) + " " + (y0 + 14) + " " + n(cx + hw + 3) + " " + y0 + "L" + n(cx + hw + 14) + " 240L" + n(cx - hw - 14) + " 240Z", ud, LW.part);
    s += fillP("M" + n(cx + 2) + " " + (y0 + 12) + "C" + n(cx + hw - 2) + " " + (y0 + 10) + " " + n(cx + hw + 2) + " " + (y0 + 4) + " " + n(cx + hw + 3) + " " + y0 + "L" + n(cx + hw + 14) + " 240H" + n(cx + 8) + "Z", clothShade(ud));
    if (g.fine) s += brush([[cx - hw + 1, y0 + 5], [cx, y0 + 13], [cx + hw - 1, y0 + 5]], 1.1, { fill: clothLight(ud), op: 0.9 });
    // 身ごろ (V ネック)
    const nl = sh[0][0] - 2;
    const vd = "M" + nl + " " + (y0 - 3) + "L" + cx + " " + vy + "L" + (204 - nl) + " " + (y0 - 3) + "L" + (204 - nl) + " " + (y0 - 30) + "L" + nl + " " + (y0 - 30) + "Z";
    s += clipOpen(g.id + "bd", body);
    s += '<path d="M-20 140H220V260H-20Z' + vd + '" fill="' + W + '" fill-rule="evenodd"/>';
    if (L.stripes) {
      let pd = "";
      for (let x = -10; x < 214; x += 8) pd += "M" + x + " 150L" + n(x + (x - 100) * 0.07) + " 252";
      s += '<path d="' + pd + '" stroke="' + L.stripes + '" stroke-width="' + n(0.8 * K) + '" stroke-opacity=".8" fill="none"/>';
    }
    // セル影: 奥側 (右)・襟の下・わき・しわ
    s += fillP("M146 176C162 190 170 214 166 252H222V160Z", WS, 0.9);
    s += fillP("M" + (nl - 8) + " " + (y0 + 1) + "L" + cx + " " + (vy + 9) + "L" + (212 - nl) + " " + (y0 + 1) + "L" + (204 - nl) + " " + (y0 - 3) + "L" + cx + " " + vy + "L" + nl + " " + (y0 - 3) + "Z", WS, 0.9);
    s += fillP("M30 252C34 232 40 216 50 204C44 222 42 238 44 252Z", WS, 0.9);
    if (g.fine) s += fillP("M58 228C66 222 72 230 72 252H66C66 240 64 234 58 228Z", WS, 0.9);
    if (g.lod === 0) s += fillP("M128 226C138 220 144 228 144 252H139C139 238 136 232 128 226Z", WS, 0.9);
    s += "</g>";
    s += shape(body, "none", LW.sil);
    // V ネックの縁取り
    const pip = (a, b) => brush([a, b], 3.4, { fill: L.piping, a: 0.02, b: 0.02, s0: 1, e0: 1 });
    s += pip([nl + 1, y0 - 2], [cx, vy + 1]) + pip([cx, vy + 1], [203 - nl, y0 - 2]);
    s += shape("M" + nl + " " + (y0 - 3) + "L" + cx + " " + vy + "L" + (204 - nl) + " " + (y0 - 3), "none", LW.part);
    if (g.fine) s += shape("M" + (nl + 3.4) + " " + (y0 + 1) + "L" + cx + " " + (vy + 5) + "L" + (200.6 - nl) + " " + (y0 + 1), "none", 0.8);
    // 前立て・ボタン
    s += brush([[cx, vy], [cx, 246]], 3, { fill: L.piping, a: 0.02, b: 0.02, s0: 1, e0: 1 });
    if (g.fine) s += shape("M" + (cx - 2) + " " + vy + "V246M" + (cx + 2) + " " + vy + "V246", "none", 0.8);
    s += ell([cx + 6, vy + 14], 1.9, 1.9, "#ffffff", 1);
    // 肩のしわ
    if (g.fine) s += brush([[44, 194], [52, 204], [54, 220]], 1, { op: 0.8 }) + brush([[158, 194], [150, 204], [148, 220]], 1, { op: 0.8 });
    return s;
  }
  // ジャンパー (立ち襟・ファスナー) — 監督
  function jacket(g, build, hw) {
    const L = g.L;
    const sh = SHOULDER[build];
    const col = clothBase(L.jacket);
    const cs = clothShade(col);
    const hl = clothLight(col);
    const d = torso(sh);
    sil(g, d);
    const cx = 102;
    let s = clipOpen(g.id + "bd", d) + fillP(d, col);
    // つやと影 (くっきり)
    s += fillP("M-10 214C14 198 40 186 62 180C40 196 28 214 24 236C14 226 4 222 -10 222Z", hl, 0.9);
    s += fillP("M142 176C170 186 194 200 212 212V252H162C166 226 160 198 142 176Z", cs);
    if (g.fine) s += fillP("M58 226C66 220 72 228 72 252H66C66 238 64 232 58 226Z", cs);
    // ラグラン袖の縫い目
    if (g.fine) s += brush([[78, 178], [54, 206], [42, 252]], 1, { op: 0.9 }) + brush([[126, 178], [150, 206], [162, 252]], 1, { op: 0.9 });
    // 胸のライン
    s += brush([[-10, 236], [40, 226], [72, 224]], 4, { fill: L.trim, a: 0.05, b: 0.35, s0: 1, e0: 0.4 });
    s += brush([[212, 236], [162, 226], [132, 224]], 4, { fill: mix(L.trim, "#000000", 0.18), a: 0.05, b: 0.35, s0: 1, e0: 0.4 });
    s += "</g>" + shape(d, "none", LW.sil);
    // ファスナー
    s += brush([[cx, 192], [cx, 250]], 2.2, { a: 0.02, b: 0.02, s0: 1, e0: 1 });
    s += brush([[cx, 194], [cx, 250]], 0.8, { fill: L.trim, a: 0.02, b: 0.02, s0: 1, e0: 1 });
    // 立ち襟
    const cl = "M" + (cx - hw - 6) + " 156C" + (cx - hw - 2) + " 172 " + (cx - 10) + " 180 " + cx + " 182C" + (cx + 10) + " 180 " + (cx + hw + 2) + " 172 " + (cx + hw + 6) + " 156L" + (cx + hw + 12) + " 172C" + (cx + hw + 8) + " 190 " + (cx + 12) + " 198 " + cx + " 200C" + (cx - 12) + " 198 " + (cx - hw - 8) + " 190 " + (cx - hw - 12) + " 172Z";
    sil(g, cl);
    s += clipOpen(g.id + "cl", cl) + fillP(cl, col);
    s += fillP("M" + (cx + 4) + " 180C" + (cx + 18) + " 178 " + (cx + hw + 4) + " 168 " + (cx + hw + 6) + " 156L" + (cx + hw + 14) + " 172V204H" + (cx + 4) + "Z", cs);
    s += "</g>" + shape(cl, "none", LW.part);
    s += brush([[cx - hw - 5, 162], [cx - 10, 185], [cx, 187]], 2.2, { fill: L.trim, a: 0.1, b: 0.05, s0: 0.5, e0: 1 });
    s += brush([[cx + hw + 5, 162], [cx + 10, 185], [cx, 187]], 2.2, { fill: L.trim, a: 0.1, b: 0.05, s0: 0.5, e0: 1 });
    s += shape("M" + (cx - 2) + " 184H" + (cx + 2) + "V192H" + (cx - 2) + "Z", "#d5d9e0", 1);
    return s;
  }
  // ジャージ (前を開けて白い T シャツ・胸のワッペン) — マネージャー
  function girlJacket(g) {
    const L = g.L;
    const sh = SHOULDER.girl;
    const col = clothBase(L.jacket);
    const cs = clothShade(col);
    const hl = clothLight(col);
    const d = torso(sh);
    sil(g, d);
    const cx = 102;
    let s = "";
    // T シャツ
    const tee = "M" + (cx - 20) + " 164C" + (cx - 14) + " 180 " + (cx + 14) + " 180 " + (cx + 20) + " 164L" + (cx + 28) + " 252H" + (cx - 28) + "Z";
    s += shape(tee, "#fdfcf8", LW.part);
    s += fillP("M" + (cx - 16) + " 174C" + (cx - 8) + " 184 " + (cx + 8) + " 184 " + (cx + 16) + " 174L" + (cx + 18) + " 184C" + (cx + 8) + " 190 " + (cx - 8) + " 190 " + (cx - 18) + " 184Z", clothShade("#fdfcf8"));
    s += fillP("M" + (cx + 8) + " 192L" + (cx + 18) + " 188L" + (cx + 26) + " 252H" + (cx + 12) + "Z", clothShade("#fdfcf8"));
    const jl = "M14 252L14 214C22 198 54 182 84 168L90 182L" + (cx - 4) + " 252Z";
    const jr = "M190 252L190 214C182 198 150 182 120 168L114 182L" + (cx + 4) + " 252Z";
    s += clipOpen(g.id + "bd", d);
    s += fillP(jl, col) + fillP(jr, col);
    s += fillP("M150 186C170 196 186 210 192 222V252H160C164 228 160 204 150 186Z", cs);
    s += fillP("M18 216C28 202 48 190 68 184C50 200 40 220 38 240C30 232 24 228 18 228Z", hl, 0.9);
    if (g.fine) s += fillP("M62 222C70 216 76 226 78 252H72C72 238 68 230 62 222Z", cs);
    s += "</g>";
    s += shape(jl, "none", LW.sil) + shape(jr, "none", LW.sil);
    // 縁取り
    s += brush([[88, 180], [94, 214], [cx - 4, 252]], 2.6, { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 });
    s += brush([[116, 180], [110, 214], [cx + 4, 252]], 2.6, { fill: mix(L.trim, "#000000", 0.15), a: 0.05, b: 0.05, s0: 1, e0: 1 });
    // 折り返しの襟
    s += shape("M84 166L66 186L82 200L90 182Z", col, LW.part);
    s += shape("M120 166L138 186L122 200L114 182Z", col, LW.part);
    s += fillP("M118 170L134 186L122 196L115 183Z", cs);
    s += brush([[80, 172], [70, 186]], 1.4, { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 }) + brush([[124, 172], [134, 186]], 1.4, { fill: L.trim, a: 0.05, b: 0.05, s0: 1, e0: 1 });
    // 胸のワッペン (チームマーク)
    s += markAt(g, 152, 222, 16, true);
    return s;
  }
  // コーチのポロシャツ (チームの色、縁取りの色の襟・首から下げたストップウォッチ)
  function coachPolo(g, hw) {
    const L = g.L;
    const sh = SHOULDER.slim;
    const col = clothBase(L.jacket);
    const cs = clothShade(col);
    const hl = clothLight(col);
    const tr = L.trim;
    const d = torso(sh);
    sil(g, d);
    const cx = 102;
    let s = clipOpen(g.id + "bd", d) + fillP(d, col);
    s += fillP("M-10 214C14 200 40 188 62 182C40 198 28 214 24 236C14 226 4 222 -10 222Z", hl, 0.75);
    s += fillP("M144 178C170 188 194 202 212 212V252H162C166 226 160 200 144 178Z", cs);
    if (g.fine) s += fillP("M58 226C66 220 72 228 72 252H66C66 238 64 232 58 226Z", cs);
    s += "</g>" + shape(d, "none", LW.sil);
    // 前立て・ボタン
    s += shape("M" + (cx - 5) + " 180H" + (cx + 5) + "V214H" + (cx - 5) + "Z", col, LW.part);
    s += ell([cx, 192], 1.7, 1.7, "#ffffff", 0.9) + ell([cx, 204], 1.7, 1.7, "#ffffff", 0.9);
    // 襟 (首の後ろ → 左右に倒れる)
    s += shape("M" + (cx - hw - 4) + " 162C" + (cx - hw) + " 157 " + (cx + hw) + " 157 " + (cx + hw + 4) + " 162L" + (cx + hw + 5) + " 172L" + (cx - hw - 5) + " 172Z", clothShade(tr), LW.part);
    for (const sd of [-1, 1]) {
      const X = (u) => cx + sd * u;
      s += shape("M" + X(hw + 4) + " 161L" + X(hw + 12) + " 186L" + X(4) + " 183L" + X(hw - 4) + " 171Z", sd > 0 ? mix(tr, "#2a1a4a", 0.18) : tr, LW.part);
    }
    // ストラップとストップウォッチ
    const cord = dist(tr, col) < 120 ? "#ffffff" : tr;
    s += brush([[88, 182], [91, 202], [96, 222]], 1.8, { fill: cord, a: 0.05, b: 0.05, s0: 1, e0: 1 });
    s += brush([[116, 182], [111, 202], [102, 222]], 1.8, { fill: mix(cord, "#2a1a4a", 0.2), a: 0.05, b: 0.05, s0: 1, e0: 1 });
    s += shape("M97 220h4v4h-4z", "#9aa3b0", 0.9);
    s += ell([99, 231], 7.4, 7.4, "#cfd6de", LW.part) + ell([99, 231], 5, 5, "#f4f7fa", 0.8);
    s += fillP("M99 231l0-4.2h0.8l0 4.2z", INK) + fillP("M99 231l3-2 .4.6-3 2z", INK);
    if (g.fine) s += fillP("M94 226a7 7 0 0 1 4-2.4l-.4 1.4a5.6 5.6 0 0 0-2.8 1.8z", "#ffffff", 0.9);
    return s;
  }
  // 首にかけたタオル (チームの色に白い線) — 剛田
  function towel(g) {
    const L = g.L;
    const tc = lum(L.main) > 0.85 ? L.trim : L.main;
    const ts = clothShade(tc);
    let s = "";
    // 首の後ろから両肩へ、両端は胸の前に垂れる
    const back = "M74 170C82 160 118 160 128 170L132 178C120 170 82 170 70 178Z";
    s += shape(back, ts, LW.part);
    const near = "M70 172C78 166 86 166 90 170C88 190 84 214 86 252H64C64 222 66 192 70 172Z";
    const far = "M130 170C124 166 116 166 112 170C114 188 118 206 118 232L136 232C136 206 134 186 130 170Z";
    sil(g, near);
    sil(g, far);
    s += shape(near, tc, LW.part) + shape(far, tc, LW.part);
    s += fillP("M84 178C82 200 80 226 81 252H86C84 222 86 198 89 178Z", ts, 0.9);
    s += fillP("M126 176C130 196 131 214 131 232H136C136 206 134 188 130 172Z", ts, 0.9);
    // 白い線とふさ
    s += brush([[65, 232], [86, 232]], 2.2, { fill: "#ffffff", a: 0.02, b: 0.02, s0: 1, e0: 1 }) + brush([[65, 238], [86, 238]], 1.4, { fill: "#ffffff", a: 0.02, b: 0.02, s0: 1, e0: 1 });
    s += brush([[118, 220], [136, 220]], 2.2, { fill: "#ffffff", a: 0.02, b: 0.02, s0: 1, e0: 1 }) + brush([[118, 226], [136, 226]], 1.4, { fill: "#ffffff", a: 0.02, b: 0.02, s0: 1, e0: 1 });
    if (g.fine) {
      let d = "";
      for (let x = 120; x < 136; x += 3.2) d += "M" + n(x) + " 232v3.4";
      s += '<path d="' + d + '" stroke="' + INK + '" stroke-width="' + n(0.8 * K) + '" fill="none"/>';
    }
    return s;
  }
  // ねじったロープのネックレス (首の付け根) — 竜崎
  function necklace(g) {
    const pts = [
      [84, 170],
      [90, 182],
      [101, 186.5],
      [112, 182],
      [118, 170],
    ];
    let s = brush(pts, 1.8, { fill: "#26304a", a: 0.05, b: 0.05, s0: 0.8, e0: 0.8 });
    if (g.fine) {
      const sp = sample(pts, 4);
      let d = "";
      for (let i = 1; i < sp.length - 1; i += 1) d += "M" + n(sp[i][0] - 0.6) + " " + n(sp[i][1] - 0.6) + "l1.2 1.2";
      s += '<path d="' + d + '" stroke="#7a88b0" stroke-width="' + n(0.6 * K) + '" fill="none"/>';
    }
    return s;
  }

  /* ---------- 帽子 ---------- */
  function markAt(g, cx, cy, sz, patch) {
    const L = g.L;
    let s = "";
    if (patch) {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(sz * 0.62) + '" fill="' + L.crown + '" stroke="' + INK + '" stroke-width="' + n(1.3 * K) + '"/>';
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
    if (txt === "HT") {
      // 阪神の HT: H の上に T を載せる (文字を重ねると T の縁が H の右の縦棒を消して "IT" に見える)。three/human.js の monogramHT と同じ形
      const h = sz * 0.9;
      const x0 = cx - h / 2;
      const y0 = cy - h / 2;
      const R = (ax, ay, bx, by) => "M" + n(x0 + ax * h) + " " + n(y0 + ay * h) + "H" + n(x0 + bx * h) + "V" + n(y0 + by * h) + "H" + n(x0 + ax * h) + "Z";
      const dH = R(0, 0, 0.24, 1) + R(0.76, 0, 1, 1) + R(0.24, 0.42, 0.76, 0.58) + R(-0.07, 0.9, 0.31, 1) + R(0.69, 0.9, 1.07, 1) + R(-0.07, 0, 0.31, 0.1) + R(0.69, 0, 1.07, 0.1);
      const dT = R(-0.1, -0.02, 1.1, 0.24) + R(0.385, 0.24, 0.615, 0.84) + R(0.3, 0.76, 0.7, 0.84);
      s += '<path d="' + dH + '" fill="' + L.markColor + '"/>';
      s += '<path d="' + dT + '" fill="' + L.markColor + '" stroke="' + (patch ? L.crown : g.capCol) + '" stroke-width="' + n(sz * 0.07) + '" paint-order="stroke"/>';
      return s;
    }
    if (L.markStyle === "mono" && txt.length >= 2) {
      // 組み合わせ文字: 2 文字を重ねる (後ろの文字を帽子の色で縁取って切り抜いたように見せる)
      s += st(sz * 0.88, cx - sz * 0.2, cy - sz * 0.04, txt[0]);
      s += st(sz * 0.88, cx + sz * 0.2, cy + sz * 0.06, txt[1], patch ? L.crown : g.capCol);
    } else if (txt.length >= 2) {
      s += '<g transform="translate(' + n(cx) + " " + n(cy) + ') scale(.78 1)">' + st(sz * 0.8, 0, 0, txt) + "</g>";
    } else s += st(sz * 1.05, cx, cy, txt);
    return s;
  }
  // 帽子: 山 (クラウン) は丸く、前の縫い目・マーク・つばを顔の向きへずらす。dy: 浅くかぶる量 (負で上へ)
  function cap(g, dy) {
    const L = g.L;
    const y = dy || 0;
    const P = (u, v, z) => prj(g, u, v + y, z);
    const MZ = (pts) =>
      pts.map((p) => {
        const q = P(p[0], p[1], p[2]);
        return p[3] ? [q[0], q[1], 1] : q;
      });
    const cb = clothBase(L.crown);
    const cs = clothShade(cb);
    const lite = lum(L.crown) > 0.8;
    const crown = curve(
      MZ([
        [-46.5, 102, 2, 1],
        [-48, 82, 4],
        [-42, 61, 6],
        [-25, 47.5, 8],
        [0, 43.5, 9],
        [25, 47.5, 8],
        [42, 61, 6],
        [48, 82, 4],
        [46.5, 102, 2, 1],
      ]),
      true
    );
    sil(g, crown);
    let s = clipOpen(g.id + "cp", crown) + fillP(crown, cb);
    if (L.stripes) {
      // ピンストライプ (パネルに沿う)
      let d = "";
      for (let k = -6; k <= 6; k++) {
        const t = P(k * 1.2, 45, 10);
        const m = P(k * 6.2, 65, 34 - Math.abs(k) * 2.4);
        const b = P(k * 9.6, 104, 40 - Math.abs(k) * 4.5);
        d += "M" + n(t[0]) + " " + n(t[1]) + "Q" + n(m[0]) + " " + n(m[1]) + " " + n(b[0]) + " " + n(b[1]);
      }
      s += '<path d="' + d + '" stroke="' + L.stripes + '" stroke-width="' + n(0.6 * K) + '" stroke-opacity=".7" fill="none"/>';
    }
    // 奥のパネルは影 (縫い目で区切る)
    s += fillP(curve([P(0, 44.5, 10), P(15, 61, 30), P(25, 101, 38)], false) + "L160 " + n(101 + y) + "L160 " + n(30 + y) + "Z", cs);
    // 手前のつや
    if (!lite) s += fillP(curve([P(-31, 54, 20), P(-37, 65, 16), P(-40.5, 80, 12), P(-37.5, 81, 16), P(-34, 67, 22), P(-28, 56, 24)], true), clothLight(cb), 0.55);
    s += "</g>" + shape(crown, "none", LW.sil);
    // 縫い目
    if (g.fine) for (const k of [-1, 1]) s += brush([P(0, 45.5, 10), P(k * 15, 61, 30), P(k * 25, 99, 38)], LW.fine, { fill: lum(cb) > 0.5 ? mix(cb, INK, 0.55) : "#000000", op: 0.85, s0: 0.5, e0: 0.5 });
    s += ell(P(0, 44.5, 9), 4.6, 2.2, L.button, LW.part);
    // マーク (向いた分だけ横に縮める)
    g.capCol = L.crown;
    const mc = P(0, 73.5, 42);
    s += '<g transform="translate(' + n(mc[0]) + " " + n(mc[1]) + ") scale(" + n(g.ca * 0.96) + ' 1)">' + markAt(g, 0, 0, 25) + "</g>";
    // つば (上の面が三日月に見える)
    const top = MZ([
      [-49, 103.5, 4, 1],
      [-40, 94, 28],
      [-22, 88.5, 48],
      [0, 87, 57],
      [22, 88.5, 48],
      [40, 94, 28],
      [49, 103.5, 4, 1],
    ]);
    const bot = MZ([
      [36, 104, 32],
      [18, 103.2, 47],
      [0, 102.8, 52],
      [-18, 103.2, 47],
      [-36, 104, 32],
    ]);
    const brim = curve(top.concat(bot), true);
    sil(g, brim);
    const bc = clothBase(L.brim);
    s += clipOpen(g.id + "br", brim) + fillP(brim, bc);
    // つばの影 (奥) と光 (手前の上)
    s += fillP(curve(MZ([[8, 84, 60], [30, 90, 40], [52, 104, 4], [10, 106, 50]]), true), clothShade(bc));
    if (lum(L.brim) <= 0.8) s += fillP(curve(MZ([[-40, 95.5, 28], [-24, 90.5, 46], [-8, 89, 54], [-22, 92, 46]]), true), clothLight(bc), 0.8);
    s += "</g>" + shape(brim, "none", LW.sil);
    // つばの下のふち (少しだけ太い)
    s += brush(MZ([[-48, 103.6, 6], [-24, 103.4, 44], [0, 103.1, 52], [24, 103.4, 44], [48, 103.6, 6]]), LW.chin, { a: 0.2, b: 0.2, s0: 0.4, e0: 0.4 });
    return s;
  }
  // つばの影 (顔の上): つばの下から dep だけ下まで
  function brimShade(g, dy, dep) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const u = -54 + i * 13.5;
      pts.push(F(g, u, 103 + dy + dep + Math.abs(u) * 0.03, 0));
    }
    return fillP(curve(pts, false) + "L" + n(pts[8][0] + 6) + " 60L" + n(pts[0][0] - 6) + " 60Z", g.skinS);
  }

  /* ---------- 顔 ---------- */
  // 輪郭 (手前の半分: 上の中央 → あご)。[u, v, z]
  const JAW = {
    me: [
      [0, 86, 30],
      [-22, 87, 22],
      [-35.5, 92, 10],
      [-40, 104, 2],
      [-40.5, 116, 0],
      [-39.5, 128, 2],
      [-37, 139, 6],
      [-32, 149, 14],
      [-24, 157.5, 24],
      [-14, 164, 31],
      [-6, 167.5, 35],
      [0, 168.5, 37],
    ],
    kanto: [
      [0, 86, 30],
      [-23, 87, 22],
      [-37, 92, 10],
      [-41.5, 104, 2],
      [-42, 117, 0],
      [-42, 130, 2],
      [-41, 144, 6],
      [-37.8, 155, 14],
      [-29.6, 163, 24],
      [-16.2, 168.2, 32],
      [0, 169.6, 35],
    ],
    goda: [
      [0, 58, 30],
      [-26, 60, 22],
      [-40, 68, 10],
      [-45, 84, 2],
      [-46, 102, 0],
      [-46, 118, 1],
      [-45, 132, 4],
      [-42.5, 145, 9],
      [-37, 155.5, 16],
      [-28, 163.5, 25],
      [-15, 168.6, 32],
      [-7, 169.6, 35],
      [0, 169.8, 36],
    ],
    girl: [
      [0, 52, 30],
      [-24, 54, 22],
      [-36, 64, 10],
      [-39.5, 80, 2],
      [-40, 100, 0],
      [-39, 115, 2],
      [-36, 128, 6],
      [-30.5, 140, 14],
      [-22, 150, 22],
      [-12, 157, 30],
      [-5, 159.6, 32],
      [0, 160.2, 33],
    ],
    inukai: [
      [0, 56, 30],
      [-24, 58, 22],
      [-35, 66, 10],
      [-38.5, 82, 2],
      [-39, 102, 0],
      [-38.5, 118, 1],
      [-37, 132, 4],
      [-33.5, 145, 10],
      [-27, 156, 19],
      [-18, 164.5, 28],
      [-8, 169.5, 34],
      [0, 170.5, 36],
    ],
    ryu: [
      [0, 86, 30],
      [-21, 87, 22],
      [-34, 92, 10],
      [-38, 104, 2],
      [-38.5, 116, 0],
      [-37.5, 128, 2],
      [-35, 139, 6],
      [-30, 150, 14],
      [-22, 159, 23],
      [-13, 165.5, 30],
      [-5, 169.5, 35],
      [0, 170.5, 37],
    ],
  };
  function jawPts(g, key) {
    const h = JAW[key];
    const full = h.concat(
      h
        .slice(1, -1)
        .reverse()
        .map((p) => [-p[0], p[1], p[2]])
    );
    return full.map((p) => prj(g, p[0], p[1], p[2]));
  }
  // 顔の塗り・セル影 (奥側の頬)・輪郭。extra は顔の形で切り抜いて描く影 (前髪・つば)
  function face(g, key, extra) {
    const h = JAW[key];
    const pts = g.jaw;
    const d = curve(pts, true);
    g.faceD = d;
    sil(g, d);
    let s = clipOpen(g.id + "fc", d) + fillP(d, g.skin);
    // 奥側の影: 輪郭から内へ幅 w。頬骨のところで細くなり、あごへ消える
    const far = h.filter((p) => p[1] >= 96).map((p) => [-p[0], p[1], p[2]]);
    const m = far.length - 1;
    const outer = far.map((p) => prj(g, p[0], p[1], p[2]));
    const inner = far.map((p, i) => {
      const t = i / m;
      let w = t < 0.62 ? 7 + 6 * (t / 0.62) : 13 * Math.pow((1 - t) / 0.38, 0.9);
      w -= 4 * Math.exp(-Math.pow((t - 0.28) / 0.1, 2));
      const q = prj(g, p[0], p[1], p[2]);
      return [q[0] - Math.max(0, w), q[1] + (i === m ? 0 : 0.5)];
    });
    s += fillP(curve(inner, false) + "L" + n(outer[m][0] + 20) + " " + n(outer[m][1] + 6) + "L" + n(outer[0][0] + 20) + " " + n(outer[0][1] - 20) + "L" + n(inner[0][0]) + " " + n(inner[0][1] - 20) + "Z", g.skinS);
    if (extra) s += extra;
    s += "</g>";
    s += shape(d, "none", LW.sil);
    // あごの下側を少し太く (重さ)
    const low = pts.filter((p) => p[1] >= h[h.length - 1][1] - 22);
    low.sort((a, b) => a[0] - b[0]);
    s += brush(low, LW.chin, { a: 0.3, b: 0.3, s0: 0.4, e0: 0.4, per: 6 });
    return s;
  }
  // 耳 (side -1 手前 / 1 奥)。y0〜y1 の高さで輪郭につく
  function ear(g, side, y0, y1, w) {
    let best = null;
    const vm = (y0 + y1) / 2;
    for (const p of g.jaw) if ((side < 0 ? p[0] < 100 : p[0] > 100) && (!best || Math.abs(p[1] - vm) < Math.abs(best[1] - vm))) best = p;
    const ww = side < 0 ? w : w * 0.55;
    const x0 = best[0] + side * 1.5;
    const P = (u, v) => [x0 + side * u, v];
    const d = curve([P(-1, y0 + 2), P(ww * 0.6, y0 - 2), P(ww, y0 + 5), P(ww * 0.9, vm + 2), P(ww * 0.55, y1 - 1), P(-1, y1)], false) + "Z";
    sil(g, d);
    let s = fillP(d, g.skin);
    s += fillP(curve([P(1, y0 + 4), P(ww * 0.6, y0 + 2.5), P(ww * 0.72, y0 + 9), P(ww * 0.45, y1 - 6), P(1, y1 - 7)], false) + "Z", g.skinS);
    s += shape(d, "none", LW.part);
    if (side < 0 && g.fine) s += brush([P(ww * 0.55, y0 + 4), P(ww * 0.7, y0 + 10), P(ww * 0.42, vm + 3), P(2.5, y1 - 7)], LW.fine, { fill: INK2 });
    return s;
  }

  // 目。(u0, v0): 目の中心, s: -1 手前 (左) / 1 奥 (右)
  // o: {w, h, iris, lash, droop (目尻の下がり), fem, crease, lift (下まぶたを上げる), lo (下まぶたの長さ), cat3 (光 3 つ), line (糸目)}
  // mode: "" 開いた目 / "arc" 笑って閉じた目 / "squint" 笑って細めた目
  function eye(g, u0, v0, s, o, ex, mode) {
    const w = o.w;
    let h = o.h;
    const P = (x, y, c) => {
      const q = F(g, u0 + s * x, v0 + y, 0);
      return c ? [q[0], q[1], 1] : q;
    };
    const lash = ((o.lash || LW.lashM) * g.kl0) / g.hk;
    const dr = o.droop || 0;
    let out = "";
    if (o.line && ex !== "surprised") {
      // 糸目: 上へ反った 1 本の線
      const k = ex === "happy" ? 1.5 : ex === "sad" ? 0.4 : 1;
      const ti = ex === "angry" ? 1.4 : ex === "serious" ? 0.7 : ex === "sad" ? -0.8 : 0;
      out += brush([P(-w / 2, 0.6 + ti), P(-0.18 * w, -1.7 * k + ti * 0.5), P(0.22 * w, -1.9 * k), P(w / 2 + 1, 0.3 + dr + (ex === "sad" ? 1.2 : 0))], lash, { raw: 1, a: 0.3, b: 0.3, s0: 0.3, e0: 0.35 });
      return out;
    }
    if (o.line) h = 8;
    if (mode === "arc") {
      // 笑って閉じた目 (上に丸い弧)
      out += brush([P(-w / 2, 0.12 * h), P(-0.22 * w, -0.32 * h), P(0.2 * w, -0.36 * h), P(w / 2 + 1, 0.1 * h + dr)], lash * 0.9, { raw: 1, a: 0.3, b: 0.3, s0: 0.3, e0: 0.35 });
      if (o.fem) out += brush([P(w / 2, 0.05 * h), P(w / 2 + 3.5, -0.14 * h)], 1.6, { s0: 0.9, e0: 0.1 });
      if (g.fine) out += brush([P(-0.12 * w, 0.42 * h), P(0.14 * w, 0.36 * h), P(0.34 * w, 0.42 * h)], 0.8, { fill: INK2, op: 0.5 });
      return out;
    }
    let up;
    let lo;
    let loL = null;
    let iy = 0.06 * h;
    let ir = 1;
    const lift = o.lift || 0;
    if (mode === "squint") {
      // 笑って細めた目 (下まぶたが上がる)
      up = [P(-w / 2, 0.16 * h, 1), P(-0.3 * w, -0.36 * h), P(0.06 * w, -0.5 * h), P(0.36 * w, -0.4 * h), P(w / 2, 0.02 * h + dr, 1)];
      lo = [P(0.34 * w, -0.06 * h), P(0.04 * w, -0.14 * h), P(-0.3 * w, -0.04 * h)];
      iy = -0.12 * h;
    } else {
      let k = 1;
      if (ex === "surprised") k = 1.15;
      if (ex === "angry" || ex === "serious") k = 0.8;
      if (ex === "sad") k = 0.9;
      h *= k;
      const tl = ex === "angry" ? 0.12 * h : ex === "sad" ? -0.1 * h : 0;
      up = [P(-w / 2, 0.08 * h, 1), P(-0.3 * w, -0.42 * h + tl * 0.5), P(0.05 * w, -0.55 * h + tl * 0.2), P(0.36 * w, -0.47 * h - tl * 0.3), P(w / 2, -0.12 * h + dr - tl * 0.4, 1)];
      const lf = (ex === "happy" ? 0.1 : 0) + (ex === "surprised" ? 0 : lift);
      loL = [
        [0.4 * w, (0.26 - lf) * h + dr * 0.5],
        [0.08 * w, (0.45 - lf * 1.2) * h],
        [-0.28 * w, (0.38 - lf) * h],
      ];
      lo = loL.map((p) => P(p[0], p[1]));
      if (ex === "surprised") ir = 0.72;
    }
    const white = curve(up.concat(lo), true);
    const eid = g.id + "e" + ++g.n;
    out += clipOpen(eid, white) + fillP(white, "#ffffff");
    // 黒目: カメラを見る (少し手前へ)。奥の目は横に縮む
    const kx = Math.abs(P(0.5, 0)[0] - P(-0.5, 0)[0]);
    const ic = P(-s * 1.2, iy);
    const rx = 0.31 * w * kx * ir;
    const ry = 0.58 * o.h * ir;
    const c = o.iris;
    const iid = eid + "i";
    out += '<clipPath id="' + iid + '"><ellipse cx="' + n(ic[0]) + '" cy="' + n(ic[1]) + '" rx="' + n(rx) + '" ry="' + n(ry) + '"/></clipPath>';
    out += ell(ic, rx, ry, c);
    // 上は暗い帯、下は明るい三日月
    out += '<g clip-path="url(#' + iid + ')">' + ell([ic[0], ic[1] - ry * 0.78], rx * 1.5, ry * 0.78, mix(c, "#1a0c08", 0.55)) + ell([ic[0], ic[1] + ry * 0.62], rx * 0.78, ry * 0.42, mix(c, "#fff3c8", 0.42), 0, 0.95) + "</g>";
    // 瞳孔とふち
    out += ell([ic[0], ic[1] - ry * 0.04], rx * 0.4, ry * 0.46, mix(c, "#120806", 0.8));
    out += '<ellipse cx="' + n(ic[0]) + '" cy="' + n(ic[1]) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="none" stroke="' + mix(c, "#120806", 0.7) + '" stroke-width="' + n(0.8 * K) + '"/>';
    // 上まぶたの影 (白目と黒目の上)
    out += fillP(curve(up, false) + "L" + n(up[4][0]) + " " + n(up[4][1] + 0.24 * h) + curve(up.slice().reverse().map((p) => [p[0], p[1] + 0.26 * h]), false).replace(/^M/, "L") + "Z", "#9aa3c8", 0.4);
    out += "</g>";
    // ハイライト (両目とも左上と右下)
    if (ex === "surprised") out += ell([ic[0] - rx * 0.3, ic[1] - ry * 0.3], rx * 0.3, rx * 0.3, "#ffffff");
    else if (g.lod === 2) out += ell([ic[0] - rx * 0.34, ic[1] - ry * 0.38], rx * 0.4, ry * 0.36, "#ffffff");
    else {
      out += ell([ic[0] - rx * 0.36, ic[1] - ry * 0.4], rx * 0.34, ry * 0.3, "#ffffff");
      out += ell([ic[0] + rx * 0.38, ic[1] + ry * 0.36], rx * 0.15, rx * 0.15, "#ffffff", 0, 0.95);
      if (o.cat3) out += ell([ic[0] + rx * 0.42, ic[1] - ry * 0.48], rx * 0.1, rx * 0.1, "#ffffff");
    }
    // 上まぶた (太い線、目尻は少しはねる)
    const tail = P(w / 2 + 2.2, (mode === "squint" ? 0.05 : -0.03) * h + dr * 1.3);
    out += brush(up.concat([tail]), lash, { raw: 1, a: 0.3, b: 0.22, s0: 0.3, e0: 0.25 });
    // 目尻の黒いくさび (上まぶたの線が下へ回りこむ)
    if (mode !== "squint") out += fillP(curve([up[3], P(w / 2 + 1.2, -0.16 * h + dr), P(w / 2 - 0.2, 0.12 * h + dr), P(0.4 * w, 0.08 * h + dr), P(0.38 * w, -0.2 * h)], true), INK);
    if (o.fem) {
      // まつげ 2 本
      out += brush([P(0.4 * w, -0.4 * h), P(0.52 * w, -0.62 * h)], 1.7, { s0: 1, e0: 0.1, a: 0.1, b: 0.7 });
      out += brush([P(0.5 * w, -0.16 * h), P(0.66 * w, -0.3 * h)], 1.6, { s0: 1, e0: 0.1, a: 0.1, b: 0.7 });
    }
    // 下まぶた (外側だけ細く)
    if (mode === "squint") {
      out += brush([P(w / 2 - 0.2, 0.02 * h), P(0.34 * w, -0.06 * h), P(0.04 * w, -0.14 * h), P(-0.3 * w, -0.04 * h)], 1.4, { fill: INK, a: 0.25, b: 0.4, s0: 0.6, e0: 0.1 });
      // 頬が押し上げるしわ
      if (g.fine) out += brush([P(-0.15 * w, 0.26 * h), P(0.12 * w, 0.2 * h), P(0.32 * w, 0.24 * h)], 0.8, { fill: INK2, op: 0.5 });
    } else {
      const lw = o.fem ? 1.2 : ex === "happy" ? 1.3 : 1;
      // 切れ長の目は外側 45% だけ、ふつうは 60%
      const ll = o.lo && o.lo < 0.5 ? [[w / 2 - 0.3, 0.02 * h + dr], loL[0], [0.2 * w, (loL[0][1] + loL[1][1]) / 2 + 0.02 * h], [0.05 * w, loL[1][1] - 0.01 * h]] : [[w / 2 - 0.3, 0.02 * h + dr], loL[0], loL[1], [-0.12 * w, loL[1][1] - 0.02 * h]];
      out += brush(
        ll.map((p) => P(p[0], p[1])),
        lw,
        { fill: INK2, a: 0.3, b: 0.45, s0: 0.6, e0: 0.05 }
      );
      if (ex === "happy" && g.fine) out += brush([P(-0.12 * w, 0.62 * h), P(0.14 * w, 0.56 * h), P(0.34 * w, 0.6 * h)], 0.8, { fill: INK2, op: 0.45 });
    }
    // 二重のしわ
    if (o.crease && mode !== "squint" && g.fine) out += brush([P(-0.1 * w, -0.72 * h), P(0.2 * w, -0.78 * h), P(0.46 * w, -0.58 * h)], LW.fine, { fill: INK2, op: 0.75 });
    return out;
  }
  // 眉。(u0, v0): 中央, o: {w, t (太さ), arch, col, tip (目尻側を上げる)}
  function brow(g, u0, v0, s, o, ex) {
    let a = 0;
    let b = o.tip || 0;
    let arch = o.arch == null ? 2 : o.arch;
    if (ex === "angry") {
      a = 4;
      b += -2.5;
      arch = 0.3;
    } else if (ex === "serious") {
      a = 2.2;
      b += -1;
      arch = 0.8;
    } else if (ex === "surprised") {
      a = -4;
      b += -3;
      arch += 2.5;
    } else if (ex === "sad") {
      a = -3.5;
      b += 2.5;
      arch = 0.6;
    } else if (ex === "happy") {
      a = -1.2;
      b += -0.6;
      arch += 1;
    }
    const P = (x, y) => F(g, u0 + s * x, v0 + y, 2);
    const w = o.w;
    return brush([P(-w / 2, a), P(-w * 0.05, -arch + a * 0.4 + b * 0.3), P(w / 2, 1.5 + b)], o.t, { a: 0.12, s0: 0.75, b: 0.6, e0: 0.12, fill: o.col || INK });
  }
  // 鼻 (小さく: 奥側の短い線と鼻先の下の影)
  function nose(g, cy, k) {
    k = k || 1;
    let s = fillP(poly([F(g, 2.2, cy - 6 * k, 6), F(g, 5.5 * k, cy - 0.5, 9), F(g, 4.2 * k, cy + 2, 9), F(g, 1, cy + 1.5, 9)]), g.skinS);
    s += brush([F(g, 2, cy - 8 * k, 5), F(g, 4.4 * k, cy - 2, 9), F(g, 3.6 * k, cy + 0.6, 10), F(g, 1, cy + 1.4, 10)], 1.2 * Math.sqrt(k), { fill: INK2, s0: 0.1, e0: 0.5, a: 0.5, b: 0.15 });
    return s;
  }
  // 口。o: {w (幅), smile, grin (笑いの大きさ), deep, teeth, smirk}
  function mouth(g, cy, o, ex) {
    const w = o.w;
    const P = (u, v) => F(g, u, v, -2);
    let s = "";
    // 下くちびるの影 (肌の影の小さなくさび)
    const lip = (y) => fillP(curve(mapF(g, [[-3, y], [0, y + 1.4], [3.4, y - 0.2], [0, y + 0.5]], -2), true), g.skinS);
    if (ex === "happy" || ex === "surprised") {
      // 開いた口 (笑顔: 上は平ら、下は丸い / おどろき: 縦長の o)
      const sur = ex === "surprised";
      const ww = sur ? Math.max(7, w * 0.55) : w * (o.grin || 1.1);
      const dd = sur ? Math.max(8, (o.deep || 8) * 0.9) : o.deep || 10;
      const pts = sur ? [P(-ww / 2, cy + dd * 0.45), P(0, cy), P(ww / 2, cy + dd * 0.45), P(0, cy + dd)] : [[...P(-ww / 2, cy - 1.5), 1], P(0, cy + 0.6), [...P(ww / 2, cy - 2), 1], P(ww * 0.3, cy + dd * 0.75), P(0, cy + dd), P(-ww * 0.32, cy + dd * 0.72)];
      const d = curve(pts, true);
      const mid = g.id + "m" + ++g.n;
      s += clipOpen(mid, d) + fillP(d, "#8a2a2c");
      s += ell(P(1, cy + dd + (sur ? 0 : 1.5)), ww * (sur ? 0.36 : 0.3), dd * (sur ? 0.36 : 0.5), "#f07a7a");
      if (o.teeth && !sur) s += '<path d="M' + n(P(-ww / 2, 0)[0]) + " " + (cy - 4) + "H" + n(P(ww / 2, 0)[0]) + "V" + n(cy + 1.8) + "C" + n(P(ww * 0.2, 0)[0]) + " " + (cy + 3.4) + " " + n(P(-ww * 0.2, 0)[0]) + " " + (cy + 3.4) + " " + n(P(-ww / 2, 0)[0]) + " " + (cy + 1.6) + 'Z" fill="#ffffff"/>';
      s += "</g>" + shape(d, "none", LW.part);
      // 口角
      if (!sur && g.fine) s += brush([P(-ww / 2 - 1.6, cy - 3), P(-ww / 2 - 0.4, cy - 1)], 0.9, { fill: INK2, op: 0.8 }) + brush([P(ww / 2 + 1.6, cy - 3.4), P(ww / 2 + 0.4, cy - 1.4)], 0.9, { fill: INK2, op: 0.8 });
      return s;
    }
    const L1 = { fill: INK, s0: 0.35, e0: 0.35, a: 0.35, b: 0.35 };
    if (ex === "angry") {
      s += brush([P(-w / 2, cy + 1.6), P(-w * 0.15, cy - 0.6), P(w * 0.18, cy - 0.4), P(w / 2, cy + 1.8)], LW.mouth, L1);
      return s + lip(cy + 4.4);
    }
    if (ex === "sad") {
      s += brush([P(-w / 2, cy + 1.6), P(-w * 0.2, cy - 0.2), P(0, cy + 0.4), P(w * 0.22, cy - 0.1), P(w / 2, cy + 1.8)], LW.mouth, L1);
      return s + lip(cy + 4.4);
    }
    if (ex === "serious") {
      s += brush([P(-w / 2, cy + 0.5), P(0, cy), P(w / 2, cy + 0.4)], LW.mouth, L1);
      return s + lip(cy + 4.2);
    }
    if (o.smirk) {
      // にやり: 手前の口角だけ上がる (えくぼの線)
      s += brush([P(-w / 2, cy - 2.6), P(-w * 0.2, cy + 0.2), P(w * 0.22, cy + 0.6), P(w / 2, cy - 0.2)], LW.mouth, L1);
      s += brush([P(-w / 2 - 1.4, cy - 4.4), P(-w / 2 - 0.3, cy - 2.2)], 0.9, { fill: INK2, op: 0.85 });
      return s + lip(cy + 4.2);
    }
    // ふつう: やさしい笑み (口角が上がる)
    const k = o.smile == null ? 1 : o.smile;
    s += brush([P(-w / 2, cy - 1.6 * k), P(-w * 0.2, cy + 0.6 * k), P(w * 0.22, cy + 0.7 * k), P(w / 2, cy - 2 * k)], LW.mouth, { fill: INK, s0: 0.25, e0: 0.25, a: 0.35, b: 0.35 });
    return s + lip(cy + 4 + k * 0.4);
  }
  // ほほの赤み (楕円、笑顔は斜線 3 本)
  function blush(g, cy, op, hatch, u) {
    let s = "";
    if (!op) return s;
    for (const sd of [-1, 1]) {
      const c = F(g, sd * (u || 25), cy, 0);
      const kx = sd < 0 ? 1 : 0.85;
      s += ell(c, 8.5 * kx, 3.8, g.blushC, 0, op);
      if (hatch && g.fine) for (let i = -1; i <= 1; i++) s += brush([[c[0] + i * 3.2 * kx + 1.4, c[1] - 2], [c[0] + i * 3.2 * kx - 1.2, c[1] + 2]], 0.9, { fill: "#e05a66", op: 0.9, s0: 0.6, e0: 0.2 });
    }
    return s;
  }
  // メガネの光 (平行な 2 本の白い筋)
  function glint(c, k) {
    return brush([[c[0] - 5 * k, c[1] + 3], [c[0] - 1 * k, c[1] - 4]], 1.5, { fill: "#ffffff", op: 0.85, s0: 0.5, e0: 0.5 }) + brush([[c[0] - 1.5 * k, c[1] + 3.5], [c[0] + 1.6 * k, c[1] - 2]], 0.8, { fill: "#ffffff", op: 0.85, s0: 0.5, e0: 0.5 });
  }

  /* ---------- 髪 ---------- */
  // 毛束 1 本 (葉の形): 根元 (ru, rv) → 先 (tu, tv)。w: 根元の幅, bend: 途中で横へふくらむ量。顔の面に沿わせる
  function lock(g, ru, rv, tu, tv, w, bend, dz) {
    const ax = tu - ru;
    const ay = tv - rv;
    const len = Math.hypot(ax, ay) || 1;
    const nx = -ay / len;
    const ny = ax / len;
    const prof = [
      [0, 1],
      [0.4, 0.9],
      [0.72, 0.55],
    ];
    const side = (k) =>
      prof.map(([t, wf], i) => {
        const b = (bend || 0) * Math.sin(Math.PI * t);
        const p = [ru + ax * t + nx * (k * w * 0.5 * wf + b), rv + ay * t + ny * (k * w * 0.5 * wf + b)];
        if (i === 0) p.push(1);
        return p;
      });
    return curve(mapF(g, side(-1).concat([[tu, tv, 1]], side(1).reverse()), dz), true);
  }
  // 曲がった毛束 (点列に沿って根元から先へ細くなる)
  function sweep(g, pts, w, dz) {
    return brushD(mapF(g, pts, dz), w, { raw: 1, s0: 1, a: 0.01, b: 0.85, e0: 0.02, per: 8 });
  }
  // 毛束を重ねる: back は影の色、front は地の色。L: [根元 u, v, 先 u, v, 幅, ふくらみ]
  function locks(g, H, back, front, dz) {
    let s = "";
    const fd = [];
    for (const b of back) s += shape(lock(g, b[0], b[1], b[2], b[3], b[4], b[5], dz), H.shade, LW.part);
    for (const b of front) {
      const d = lock(g, b[0], b[1], b[2], b[3], b[4], b[5], dz);
      fd.push(d);
      s += shape(d, H.base, LW.part);
    }
    return { s, fd };
  }
  // 頭の丸みに沿ったぎざぎざの光の帯 (u0〜u1, 高さ v0 + u²/curv, 太さ th)
  function shineBand(g, u0, u1, v0, curv, th, col, dz, seed) {
    const r = rng(seed || 7);
    const top = [];
    const bot = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const u = u0 + ((u1 - u0) * i) / N;
      const v = v0 + (u * u) / curv;
      const e = i === 0 || i === N ? 0.2 : 1;
      top.push([u, v - th * 0.5 * e - (i % 3 === 1 ? 1.6 * e : 0), i === 0 || i === N ? 1 : 0]);
      // 下のふちはとがった歯 (毛の流れの向き)
      bot.push([u + 1.2, v + th * 0.5 * e + (i % 2 ? (2.5 + r() * 4) * e : 0), i % 2 ? 1 : 0]);
    }
    return fillP(curve(mapF(g, top.concat(bot.reverse()), dz), true), col);
  }
  // 頭頂の髪の塊 (帽子なし): 外側だけ輪郭、下のふちは毛束へつなぐので線なし
  function crownMass(g, H, outer, bottom, o) {
    const op = mapZ(g, outer);
    const d = curve(op.concat(mapF(g, bottom, o.dz || 3)), true);
    sil(g, d);
    const id = g.id + "cr" + ++g.n;
    let s = clipOpen(id, d) + fillP(d, H.base);
    if (o.shade) s += fillP(curve(mapZ(g, o.shade), true), H.shade);
    if (o.shine) s += shineBand(g, o.shine[0], o.shine[1], o.shine[2], 210, 3.4, H.hl, o.dz || 3, o.shine[3]);
    s += "</g>" + shape(curve(op, false), "none", LW.sil);
    return { d, s };
  }
  // 毛先のぎざぎざの縁: 角の点 (根元のくぼみと毛先) の間に、外へふくらむ点を足す (右 → 左の順に並べる)
  function zig(pts, k) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      out.push([a[0], a[1], 1]);
      const b = pts[i + 1];
      if (!b) break;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      out.push([(a[0] + b[0]) / 2 + (b[1] - a[1]) * (k || 0.1), (a[1] + b[1]) / 2 - (b[0] - a[0]) * (k || 0.1) + l * 0.02]);
    }
    return out;
  }
  // 毛束の間の筋 (先から根元へ細くなる)
  function strands(g, list, dz) {
    if (!g.fine) return "";
    let s = "";
    for (const l of list) s += brush(mapF(g, l, dz), LW.fine, { s0: 0.8, e0: 0.05, a: 0.1, b: 0.8, op: 0.8 });
    return s;
  }
  // つやの短い筋 (帽子の下の前髪)
  function dashes(g, list, col, dz) {
    let s = "";
    for (const l of list) s += brush(mapF(g, l, dz), 1.5, { fill: col, s0: 0.2, e0: 0.2, a: 0.5, b: 0.5 });
    return s;
  }
  // 襟足 (首の後ろ、耳の下から外へはねる)。len: 長さを足す, sleek: 1 本にまとめる
  function nape(g, H, len, sleek) {
    let s = "";
    for (const sd of [-1, 1]) {
      const P = (u, v, c) => {
        const q = prj(g, sd * u, v, -12);
        return c ? [q[0], q[1], 1] : q;
      };
      const d = sleek ? curve([P(36, 112, 1), P(43, 118), P(45.5, 130 + len), P(44, 144 + len, 1), P(38.5, 136 + len), P(32, 124)], true) : curve([P(37, 113, 1), P(43, 117), P(45, 123 + len * 0.5), P(46, 130 + len, 1), P(42, 127 + len * 0.6), P(40.5, 134 + len, 1), P(36.5, 127 + len * 0.4), P(33, 121)], true);
      sil(g, d);
      s += shape(d, sd > 0 ? H.shade : H.base, LW.part);
    }
    return s;
  }
  // もみあげ・横の髪 (耳の前)。len: 下へのびる量
  function sideHair(g, H, len, z) {
    let s = "";
    for (const sd of [-1, 1]) {
      const P = (u, v, c) => {
        const q = prj(g, sd * u, v, z == null ? 6 : z);
        return c ? [q[0], q[1], 1] : q;
      };
      const d = curve([P(45, 100, 1), P(36, 101), P(35.5, 106 + len * 0.3), P(36.5, 112 + len, 1), P(39.5, 108 + len * 0.6), P(42.5, 110 + len * 0.8, 1), P(44, 106), P(46.5, 103)], true);
      s += shape(d, sd > 0 ? H.shade : H.base, LW.part);
      if (sd < 0 && len > 3) s += brush([P(39, 103), P(38, 104 + len * 0.6)], 1.2, { fill: H.hl });
    }
    return s;
  }

  /* ---------- 効果 (血管マーク・汗・おどろきの線・どんより) ---------- */
  function fx(g, ex, o) {
    o = o || {};
    let s = "";
    if (ex === "angry" && o.vein !== false) {
      const x = o.veinX || 156;
      const y = o.veinY || 52;
      const arc = (a) => {
        const c = Math.cos(a);
        const si = Math.sin(a);
        const R = (u, v) => [x + c * u - si * v, y + si * u + c * v];
        return brush([R(3, -9), R(4, -4), R(9, -3)], 2.8, { fill: "#e8343a", s0: 0.5, e0: 0.5, a: 0.2, b: 0.2 });
      };
      s += arc(0) + arc(Math.PI / 2) + arc(Math.PI) + arc(-Math.PI / 2);
    }
    if (ex === "surprised" || ex === "sad") {
      // 汗 (こめかみの奥側)
      const x = o.sweatX || 150;
      const y = o.sweatY || 100;
      s += shape("M" + x + " " + (y - 9) + "C" + (x + 6) + " " + (y - 1) + " " + (x + 6) + " " + (y + 6) + " " + x + " " + (y + 6) + "C" + (x - 6) + " " + (y + 6) + " " + (x - 6) + " " + (y - 1) + " " + x + " " + (y - 9) + "Z", "#cfeaff", LW.part);
      s += fillP("M" + (x - 2.4) + " " + (y + 0.5) + "q0 3 2.2 3.8q-3.8 0-2.2-3.8Z", "#ffffff");
    }
    if (ex === "surprised" && g.fine) {
      // おどろきの線 (頭の上の手前側から外へ)
      const x = o.surX || 50;
      const y = o.surY || 50;
      for (const a of [-1.95, -2.45, -2.95]) {
        const c = Math.cos(a);
        const si = Math.sin(a);
        s += brush([[x + c * 6, y + si * 6], [x + c * 16, y + si * 16]], 2, { s0: 1, e0: 0.05, a: 0.05, b: 0.85 });
      }
    }
    if (ex === "sad" && g.fine && o.gloomY) {
      // どんよりの縦線 (おでこ)
      let d = "";
      for (let i = 0; i < 6; i++) {
        const p = F(g, -26 + i * 10, o.gloomY, 0);
        d += "M" + n(p[0]) + " " + o.gloomY + "v" + (10 + (i % 3) * 3);
      }
      s += '<g clip-path="url(#' + g.id + 'fc)"><path d="' + d + '" stroke="#5a6893" stroke-opacity=".45" stroke-width="' + n(LW.fine * K) + '" fill="none"/></g>';
    }
    return s;
  }

  /* ---------- キャラクター ---------- */
  // 自分 (サクセスで作る選手): 肌の色・目の形・髪型から組み立てる
  const ME_EYES = {
    round: { w: 18.5, h: 12.5, lash: 3.1, iris: "#8a5230", crease: 1 },
    big: { w: 19.5, h: 14, lash: 3, iris: "#7a4428", crease: 1, cat3: 1 },
    sharp: { w: 18, h: 9, lash: 3.1, droop: -1, iris: "#5a3a26", lo: 0.45, crease: 1 },
    smile: { w: 17.5, h: 10, lash: 2.9, droop: 0.6, iris: "#8a5230", smile: 1 },
    line: { w: 17, h: 4.5, lash: 3, iris: "#5a3a26", line: 1 },
    glasses: { w: 17.5, h: 11.5, lash: 2.9, iris: "#6a4128", crease: 1 },
  };
  M.ME_EYES = Object.keys(ME_EYES);
  // 前髪 (帽子のつばの下から)。hs: 0 ツンツン / 1 短髪 / 2 長め
  const ME_FRINGE = [
    {
      back: [
        [-27, 98, -31, 110, 9, -1],
        [-7, 98, -9, 112, 9, -1],
        [13, 98, 12, 111.5, 8, 1],
      ],
      front: [
        [-34, 98, -36, 107, 8, -1],
        [-17, 98, -21, 111.5, 10, -1.5],
        [2, 98, 0, 113, 10, -1],
        [20, 98, 22, 110, 9, 1],
        [32, 98, 34, 105.5, 6, 1],
      ],
      hl: [
        [
          [-18.5, 104.5],
          [-20.2, 109],
        ],
        [
          [1.4, 105],
          [0.7, 110.5],
        ],
        [
          [20.5, 104.5],
          [21.4, 108],
        ],
      ],
    },
    null,
    {
      back: [
        [-22, 98, -20, 113, 10, 1],
        [-2, 98, 6, 115, 10, 1.5],
        [16, 98, 26, 113, 9, 1],
      ],
      front: [
        [-32, 98, -36, 111, 9, -1],
        [-14, 98, -9, 116, 12, 1.6],
        [4, 98, 14, 116.5, 12, 2],
        [22, 98, 32, 112.5, 10, 1.5],
        [34, 98, 38, 106, 6, 1],
      ],
      hl: [
        [
          [-12.5, 105],
          [-11, 110.5],
        ],
        [
          [6, 105],
          [9, 111],
        ],
      ],
    },
  ];
  function drawMe(g) {
    const ex = g.ex;
    const f = g.face || {};
    const H = hairPal(f.hair || "#2b1b14");
    const hs = f.hs == null || isNaN(Number(f.hs)) ? hash(String(g.seed || "me")) % 3 : ((Number(f.hs) % 3) + 3) % 3;
    const et = ME_EYES[f.eyes] ? f.eyes : "round";
    const E = ME_EYES[et];
    g.jaw = jawPts(g, "me");
    let s = "";
    if (hs !== 1) s += headOpen(g) + nape(g, H, hs === 2 ? 12 : 0) + headClose(g);
    s += neck(g, 16.5, 136);
    s += jersey(g, "std", 16.5);
    s += headOpen(g);
    s += ear(g, 1, 109, 131, 8) + ear(g, -1, 109, 131, 9);
    // 前髪とその影 (顔に落ちる)
    const FR = ME_FRINGE[hs];
    let hairS = "";
    let fd = [];
    if (FR) {
      const L = locks(g, H, FR.back, FR.front, 3);
      hairS = L.s;
      fd = L.fd;
    } else {
      // 短髪: つばの下に生えぎわが少しだけ
      const d = curve(mapF(g, [[-44, 97], [44, 97], [42, 108.5, 1], [30, 105], [14, 104.2], [0, 104.6], [-14, 104.2], [-30, 105], [-42, 108.5, 1]], 3), true);
      fd = [d];
      hairS = shape(d, H.base, LW.part);
    }
    let sh = '<g transform="translate(2.4 4.6)">' + fd.map((d) => fillP(d, g.skinS)).join("") + "</g>";
    sh += brimShade(g, 0, 5);
    s += face(g, "me", sh);
    s += sideHair(g, H, hs === 1 ? 2 : hs === 2 ? 12 : 6);
    s += hairS;
    // つばの影が髪にかかる (根元の帯) とつや
    s += clipMany(g.id + "fr", fd) + fillP(curve(mapF(g, [[-46, 96], [46, 96], [46, 105.5], [0, 107], [-46, 105.5]], 3), true), H.shade) + "</g>";
    if (FR && g.fine) s += dashes(g, FR.hl, H.hl, 3);
    // 目・眉
    let mode = "";
    if (E.smile) mode = ex === "happy" ? "arc" : ex === "normal" ? "squint" : "";
    else if (ex === "happy") mode = "squint";
    s += eye(g, -18.5, 123, -1, E, ex, mode) + eye(g, 18.5, 123, 1, E, ex, mode);
    const BW = { w: 16.5, t: 3, arch: 1.6, col: mix(H.base, INK, 0.55), tip: et === "sharp" ? -1.2 : 0 };
    s += brow(g, -19, 112.6, -1, BW, ex) + brow(g, 19, 112.6, 1, BW, ex);
    if (et === "glasses") {
      // 丸いメガネ (細いふち)
      for (const sd of [-1, 1]) {
        const c = F(g, sd * 18.5, 123, 5);
        const kx = Math.abs(F(g, sd * 18.5 + 0.5, 123, 5)[0] - F(g, sd * 18.5 - 0.5, 123, 5)[0]);
        s += ell(c, 11.5 * kx, 10, "#dfeaf7", 1.05, 0.15);
        if (g.fine) s += glint([c[0] + 6 * kx, c[1] - 4.5], kx * 0.55);
      }
      s += brush([F(g, -7.6, 121, 5), F(g, 0, 119.4, 6), F(g, 7.6, 121, 5)], 1.05, { s0: 1, e0: 1 });
      s += brush([F(g, -29.8, 120.5, 4), prj(g, -41, 118.5, 2)], 1.05, { s0: 1, e0: 1 });
    }
    s += nose(g, 138, 1);
    if (ex === "happy") s += mouth(g, 149.5, { w: 16, grin: 1.2, deep: 10.5, teeth: 1 }, ex);
    else s += mouth(g, 151, { w: 13, smile: 1 }, ex);
    s += blush(g, 134, ex === "happy" ? 0.4 : 0, true, 25);
    s += cap(g, 0);
    s += fx(g, ex, { veinX: 158, veinY: 52, sweatX: 148, sweatY: 112, gloomY: 104, surX: 48, surY: 52 });
    return s + headClose(g);
  }

  // 監督: 鬼瓦 (きびしいけれどあたたかい 50 代。口ひげ・ふさふさの眉・目じりの笑いじわ)
  function drawKanto(g) {
    const ex = g.ex;
    const H = hairPal("#6a645f", "#b8b2aa");
    g.jaw = jawPts(g, "kanto");
    let s = neck(g, 21, 136) + jacket(g, "std", 21);
    s += headOpen(g);
    s += ear(g, 1, 108, 133, 9) + ear(g, -1, 108, 133, 10.5);
    // つばの影・ほうれい線のわきの影 (奥)
    let sh = brimShade(g, -3, 5.5);
    sh += fillP(curve(mapF(g, [[11, 138], [18, 146], [20, 156], [15.5, 150]]), true), g.skinS);
    s += face(g, "kanto", sh);
    // 白髪まじりのもみあげ
    for (const sd of [-1, 1]) {
      const P = (u, v) => prj(g, sd * u, v, 4);
      s += shape(curve([P(46, 99, 1), P(39.5, 100, 1), P(39.5, 110), P(41, 117, 1), P(44.5, 113), P(46.5, 106)], true), sd > 0 ? H.shade : H.base, LW.part);
      if (g.fine) s += brush([P(42.4, 102), P(42.2, 112)], 1.1, { fill: H.hl });
    }
    // やさしい目 (目尻が少し下がる)
    const E = { w: 16.5, h: 8.6, iris: "#6a4026", droop: 1.2, lash: 2.7 };
    const mode = ex === "happy" ? "arc" : "";
    s += eye(g, -19, 121, -1, E, ex, mode) + eye(g, 19, 121, 1, E, ex, mode);
    // 目じりの笑いじわ・目の下
    if (g.fine) {
      for (const sd of [-1, 1]) {
        const P = (x, y) => F(g, sd * (19 + x), 121 + y, 0);
        s += brush([P(10.5, -1), P(13.2, -2.6)], 0.9, { fill: INK2, op: 0.75 }) + brush([P(10.5, 1.5), P(13.2, 2.5)], 0.9, { fill: INK2, op: 0.75 });
        if (ex !== "happy") s += brush([P(-5, 6.2), P(0, 7.4), P(5, 6.4)], 0.8, { fill: INK2, op: 0.5 });
      }
    }
    // 太いげじげじ眉 (白髪まじり): 太い線 + 上へはねる毛先
    const BW = { w: 21, t: 5.5, arch: 1.4, col: "#332d2a" };
    s += brow(g, -19.5, 108.5, -1, BW, ex) + brow(g, 19.5, 108.5, 1, BW, ex);
    const by = ex === "happy" ? -1 : ex === "angry" ? 1.5 : ex === "surprised" ? -3 : 0;
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = 2 + i * 4.2;
        s += brush([F(g, sd * (19.5 + x), 106.6 + by + i * 0.5, 3), F(g, sd * (21.5 + x), 103.8 + by + i * 0.7, 3)], 1.8 - i * 0.3, { fill: "#332d2a", s0: 1, e0: 0.05, a: 0.1, b: 0.7 });
      }
      if (g.fine) s += brush([F(g, sd * 13.5, 108 + by, 3), F(g, sd * 24, 107.2 + by, 3)], 0.9, { fill: "#a9a39c", op: 0.95 });
    }
    s += nose(g, 138, 1.25);
    // ほうれい線 (短く、やさしく)
    if (g.fine) s += brush([F(g, -12, 141, 0), F(g, -15, 148, 0), F(g, -15, 154, 0)], 0.9, { fill: INK2, op: 0.55 }) + brush([F(g, 12, 141, 0), F(g, 15, 148, 0), F(g, 15, 154, 0)], 0.9, { fill: INK2, op: 0.55 });
    // 口 (ひげの下)。おどろき・しょんぼりはひげの下に見えるように下げる
    if (ex === "happy") s += mouth(g, 151.5, { w: 18, grin: 1.1, deep: 9, teeth: 1 }, ex);
    else if (ex === "surprised") s += mouth(g, 154, { w: 14, deep: 9 }, ex);
    else if (ex === "sad" || ex === "angry") s += mouth(g, 156.2, { w: 15 }, ex);
    else s += mouth(g, 154.4, { w: 17, smile: ex === "serious" ? 0 : 1.5 }, ex);
    // あごのくぼみ
    if (g.fine) s += brush([F(g, -3.5, 164.5, 0), F(g, 0, 165.3, 0), F(g, 3.5, 164.5, 0)], 0.9, { fill: INK2, op: 0.45 });
    s += blush(g, 136, ex === "happy" ? 0.4 : 0, true, 27);
    // 口ひげ (丸い山形、中央で分かれる。下の縁は毛先のぎざぎざ)
    const mu = [[0, 143.2, 1], [-6, 142], [-13, 143.6], [-18, 148.2], [-19.5, 152.5, 1], [-15.5, 150.2, 1], [-13.5, 153, 1], [-10.5, 150.4, 1], [-7.5, 152.6, 1], [-4.5, 150.2, 1], [-1.6, 151.4, 1], [0, 148, 1], [1.6, 151.4, 1], [4.5, 150.2, 1], [7.5, 152.6, 1], [10.5, 150.4, 1], [13.5, 153, 1], [15.5, 150.2, 1], [19.5, 152.5, 1], [18, 148.2], [13, 143.6], [6, 142]];
    const md = curve(
      mu.map((p) => {
        const q = F(g, p[0], p[1] - 1.4, 2);
        return p[2] ? [q[0], q[1], 1] : q;
      }),
      true
    );
    s += clipOpen(g.id + "mu", md) + fillP(md, "#3c3632");
    // 白髪の筋と奥側の影
    if (g.fine) for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) s += brush([F(g, sd * (3 + i * 4.5), 144.6 + i * 0.5, 2), F(g, sd * (5.5 + i * 4.8), 149 + i * 0.4, 2)], 1.3, { fill: "#a39b92", s0: 0.4, e0: 0.1 });
    s += fillP(poly([F(g, 5, 139, 2), F(g, 22, 139, 2), F(g, 22, 156, 2), F(g, 9, 156, 2)]), "#140f0d", 0.4);
    s += "</g>" + shape(md, "none", LW.part);
    s += cap(g, -3);
    s += fx(g, ex, { veinX: 158, veinY: 50, sweatX: 150, sweatY: 106, gloomY: 103, surX: 48, surY: 48 });
    return s + headClose(g);
  }

  // 剛田: パワー自慢の先輩 (ブラシのような坊主頭・鼻のばんそうこう・首にタオル・いつも笑顔)
  function drawGoda(g) {
    const ex = g.ex;
    const H = hairPal("#3a2a22");
    g.jaw = jawPts(g, "goda");
    let s = neck(g, 22, 134) + jersey(g, "goda", 22) + towel(g);
    s += headOpen(g);
    s += ear(g, 1, 110, 135, 9.5) + ear(g, -1, 110, 135, 11);
    // 坊主頭: 上の輪郭は短い毛でぎざぎざ (楕円の上を交互に出す)
    const outer = [];
    const N = 52;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI * (1.07 - (1.14 * i) / N);
      const tip = i % 2 === 1 && i > 1 && i < N - 1;
      const k = tip ? 1.022 : 1;
      outer.push([49.5 * Math.cos(a) * k, 96 - 58 * Math.sin(a) * k, 2 + 10 * Math.max(0, Math.sin(a)), tip || (i > 1 && i < N - 1) ? 1 : 0]);
    }
    const bottom = [[44, 104], [41, 92], [34, 84], [24, 79.5], [12, 78.6], [0, 79.6], [-12, 78.6], [-24, 79.5], [-34, 84], [-41, 92], [-44, 104]];
    // 顔に落ちる生えぎわの影
    const hd = curve(mapF(g, [[-48, 70]].concat(bottom.slice().reverse(), [[48, 70]]), 2), true);
    let sh = '<g transform="translate(2 4)">' + fillP(hd, g.skinS) + "</g>";
    s += face(g, "goda", sh);
    const C = crownMass(g, H, outer, bottom, { dz: 2, shade: [[14, 34, 12], [52, 70, 6], [50, 106, 2], [42, 104, 8], [38, 74, 20], [26, 48, 24]], shine: [-40, 40, 50, 23] });
    s += C.s;
    // 横は短く刈りあげて肌が透ける
    s += clipOpen(g.id + "sd", C.d) + fillP(curve(mapZ(g, [[-56, 86, 4], [-36, 86, 8], [-38, 112, 4], [-56, 112, 2]]), true), g.skin, 0.45) + fillP(curve(mapZ(g, [[56, 86, 4], [37, 86, 8], [39, 112, 4], [56, 112, 2]]), true), g.skinS, 0.45) + "</g>";
    if (g.fine) s += brush(mapF(g, bottom.slice(2, -2), 2), LW.fine, { op: 0.6, s0: 0.3, e0: 0.3 });
    // 前の生えぎわで立った毛の束
    const tuft = curve(mapF(g, [[-18, 74, 1], [-16, 82.5], [-15.5, 86, 1], [-11, 80.5], [-7.5, 87.5, 1], [-3, 81], [1, 87, 1], [5, 81], [8.5, 85, 1], [11, 80], [14, 74, 1], [0, 71.5]], 4), true);
    s += shape(tuft, H.base, LW.part);
    if (g.fine) s += dashes(g, [[[-8, 76], [-7.6, 82]], [[1, 76], [1.4, 82]]], H.hl, 4);
    // 目 (いつも少し笑った、下まぶたの上がった目)・太い眉
    const E = { w: 15.5, h: 9, lash: 2.8, droop: 0.6, iris: "#5a3a24", lift: 0.12 };
    const mode = ex === "happy" ? "squint" : "";
    s += eye(g, -19.5, 121, -1, E, ex, mode) + eye(g, 19.5, 121, 1, E, ex, mode);
    const BW = { w: 19, t: 4.2, arch: 0.8, col: mix(H.shade, INK, 0.4), tip: -1.6 };
    s += brow(g, -20, 108.5, -1, BW, ex) + brow(g, 20, 108.5, 1, BW, ex);
    s += nose(g, 137, 1.15);
    // 鼻のばんそうこう
    const bp = F(g, 0.5, 129.5, 6);
    s += '<g transform="rotate(-8 ' + n(bp[0]) + " " + n(bp[1]) + ')">' + shape("M" + n(bp[0] - 8) + " " + n(bp[1] - 2.5) + "h16a1.6 1.6 0 0 1 0 5h-16a1.6 1.6 0 0 1 0-5z", "#fff4e6", LW.part) + fillP("M" + n(bp[0] - 2.6) + " " + n(bp[1] - 1.8) + "h5.2v3.6h-5.2z", "#e8c49a");
    if (g.fine) s += ell([bp[0] - 5.2, bp[1]], 0.5, 0.5, "#e8c49a") + ell([bp[0] + 5.2, bp[1]], 0.5, 0.5, "#e8c49a");
    s += "</g>";
    // 口: ふだんから口を閉じてにかっと笑う
    if (ex === "happy") s += mouth(g, 150, { w: 20, grin: 1.25, deep: 13, teeth: 1 }, ex);
    else s += mouth(g, 151.5, { w: 20, smile: 1.6 }, ex);
    // 日焼けのほほ
    s += blush(g, 136, ex === "happy" ? 0.4 : 0.22, ex === "happy", 27);
    s += fx(g, ex, { veinX: 154, veinY: 50, sweatX: 152, sweatY: 100, gloomY: 84, surX: 46, surY: 50 });
    return s + headClose(g);
  }

  // 早瀬: マネージャー (高いサイドポニーテール、横に流した前髪、チームカラーのシュシュとヘアピン)
  function drawHayase(g) {
    const ex = g.ex;
    const H = hairPal("#8c4c2c");
    const acc = accOf(g.L);
    g.jaw = jawPts(g, "girl");
    let s = headOpen(g);
    // ポニーテール (頭の後ろ、奥側の高いところから下へ)
    const pd = curve([[132, 44, 1], [154, 38], [174, 50], [182, 74], [181, 104], [174, 134], [168, 156, 1], [166, 132], [158, 146, 1], [160, 116], [150, 124, 1], [154, 92], [146, 66]], true);
    sil(g, pd);
    s += clipOpen(g.id + "pt", pd) + fillP(pd, H.base) + fillP("M150 124C156 100 158 74 150 56L171 58C181 84 178 120 168 156Z", H.shade) + "</g>" + shape(pd, "none", LW.sil);
    s += brush([[152, 47], [168, 55], [176, 76]], 2, { fill: H.hl, s0: 0.1, e0: 0.1, a: 0.5, b: 0.5 });
    if (g.fine) s += brush([[160, 62], [166, 84], [164, 110]], LW.fine, { op: 0.8 }) + brush([[170, 96], [168, 120], [164, 138]], LW.fine, { op: 0.8 });
    // 後ろ髪 (肩の上まで、影の色)
    const bk = curve([[100, 32], [70, 36], [52, 54], [46, 82], [48, 112], [52, 140, 1], [60, 128], [66, 148, 1], [100, 146], [136, 148, 1], [142, 128], [150, 140, 1], [154, 112], [154, 82], [148, 54], [130, 36]].map((p) => [p[0] + 3, p[1], p[2]]), true);
    sil(g, bk);
    s += shape(bk, H.shade, LW.part);
    s += headClose(g);
    s += neck(g, 12, 138);
    s += girlJacket(g);
    s += headOpen(g);
    // 前髪: 手前寄りの分け目から左右へ流す (後ろの束は影の色)。長さはばらばら
    const back = [
      [-26, 64, -38, 100, 14, -2],
      [-4, 66, -12, 107, 14, -2],
      [16, 64, 18, 104, 13, 1.5],
      [34, 62, 41, 96, 12, 2],
    ];
    const front = [
      [-38, 62, -46, 97, 12, -2],
      [-22, 60, -31, 106, 15, -2.5],
      [-7, 62, -11, 111, 15, -2],
      [9, 62, 9, 107.5, 14, 1.5],
      [24, 60, 29, 102, 13, 2],
      [40, 60, 46, 91, 11, 1.5],
    ];
    const fl = [];
    for (const b of front) fl.push(lock(g, b[0], b[1], b[2], b[3], b[4], b[5], 3));
    const sh = '<g transform="translate(2.6 4.6)">' + fl.map((d) => fillP(d, g.skinS)).join("") + "</g>";
    s += face(g, "girl", sh);
    for (const b of back) s += shape(lock(g, b[0], b[1], b[2], b[3], b[4], b[5], 3), H.shade, LW.part);
    // 前の束の根元は頭頂の塊でかくす
    for (const d of fl) s += shape(d, H.base, LW.part);
    // 頭頂 (下のふちは線なし) と光の帯
    const C = crownMass(g, H, [[-50, 98, 2], [-53, 76, 4], [-51, 58, 6], [-42, 42, 8], [-26, 32, 10], [-6, 28, 12], [14, 29, 12], [32, 35, 10], [46, 48, 8], [52, 66, 6], [53, 84, 4], [50, 98, 2]], [[44, 74], [30, 67], [14, 65], [0, 64], [-14, 63], [-30, 65], [-44, 72]], { dz: 3, shade: [[16, 26, 12], [44, 40, 8], [58, 70, 4], [56, 100, 2], [46, 78, 16], [36, 54, 20]], shine: [-47, 49, 44, 11] });
    s += C.s;
    // 前髪にもつやの帯の続き
    if (g.fine) s += clipMany(g.id + "fl", fl) + shineBand(g, -46, 48, 66, 260, 2.6, H.hl, 3, 5) + "</g>";
    s += strands(g, [[[-31, 102], [-27, 88]], [[-11, 106], [-8, 90]], [[9, 104], [8, 88]], [[28, 99], [25, 86]]], 3);
    // 分け目
    if (g.fine) s += brush([prj(g, -16, 31, 20), prj(g, -18, 40, 24), prj(g, -21, 48, 26)], LW.fine, { s0: 0.2, e0: 0.6 });
    // 横の髪 (耳を隠して鎖骨まで)
    for (const sd of [-1, 1]) {
      const P = (u, v, c) => {
        const q = prj(g, sd * u, v, sd < 0 ? 8 : 4);
        return c ? [q[0], q[1], 1] : q;
      };
      const sl = curve([P(46, 70, 1), P(37, 86), P(36, 112), P(37, 138), P(41, 160, 1), P(43, 146), P(47.5, 154, 1), P(47, 122), P(49, 92)], true);
      sil(g, sl);
      s += clipOpen(g.id + "sl" + (sd + 1), sl) + fillP(sl, H.base) + fillP(curve([P(44, 70), P(40, 100), P(44, 150), P(52, 150), P(52, 70)], true), H.shade, sd > 0 ? 1 : 0.6) + "</g>";
      s += shape(sl, "none", LW.part);
      if (sd < 0) s += brush([P(40, 96), P(39.5, 122)], 1.6, { fill: H.hl, s0: 0.1, e0: 0.1, a: 0.5, b: 0.5 });
    }
    // シュシュ (ふりふりの輪、結び目の上)
    const sc = [139, 47];
    const ring = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? 7.2 : 9;
      ring.push([sc[0] + Math.cos(a) * rr * 0.86, sc[1] + Math.sin(a) * rr]);
    }
    s += shape(curve(ring, true), acc, LW.part);
    s += ell([sc[0] + 0.8, sc[1] + 0.6], 3.6, 4.2, clothShade(acc));
    if (g.fine) for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      s += brush([[sc[0] + Math.cos(a) * 4.6, sc[1] + Math.sin(a) * 5.2], [sc[0] + Math.cos(a) * 7, sc[1] + Math.sin(a) * 8]], 0.7, { op: 0.55 });
    }
    // ヘアピン (2 本、手前の前髪に)
    for (const dy of [0, 5]) s += shape(poly([F(g, -34, 77 + dy, 8), F(g, -22, 73 + dy, 8), F(g, -21.3, 75.6 + dy, 8), F(g, -33.3, 79.6 + dy, 8)]), acc, 0.8);
    // 目・眉・鼻・口
    const E = { w: 19, h: 13.5, iris: "#a8582a", fem: 1, lash: LW.lashF, crease: 1 };
    const mode = ex === "happy" ? "arc" : "";
    s += eye(g, -18.5, 119, -1, E, ex, mode) + eye(g, 18.5, 119, 1, E, ex, mode);
    const BW = { w: 15, t: 1.9, arch: 2.4, col: mix(H.base, INK, 0.45) };
    s += brow(g, -18.5, 103.5, -1, BW, ex) + brow(g, 18.5, 103.5, 1, BW, ex);
    s += nose(g, 134, 0.8);
    s += blush(g, 131, ex === "happy" ? 0.4 : 0.22, ex === "happy", 25);
    if (ex === "happy") s += mouth(g, 143, { w: 12, grin: 1.2, deep: 9 }, ex);
    else s += mouth(g, 144, { w: 10, smile: 1.1 }, ex);
    s += fx(g, ex, { veinX: 42, veinY: 50, sweatX: 154, sweatY: 92, gloomY: 92, surX: 44, surY: 46 });
    return s + headClose(g);
  }

  // 宇佐美 (inukai): 理論派の打撃コーチ (やわらかい横分けの髪・細い半ぶちメガネ・ストップウォッチ)
  function drawInukai(g) {
    const ex = g.ex;
    const H = hairPal("#5a4636");
    g.jaw = jawPts(g, "inukai");
    let s = neck(g, 15.5, 138) + coachPolo(g, 15.5);
    s += headOpen(g);
    s += ear(g, 1, 110, 133, 8) + ear(g, -1, 110, 133, 9);
    // 前髪: 手前の分け目から奥へ流れるやわらかい毛先 (頭頂の塊の下のふちをぎざぎざにする)
    const edge = zig([[47, 101], [42, 98], [38, 88], [30, 97], [23, 84], [14, 92], [6, 80], [-2, 87], [-9, 75], [-15, 80], [-21, 70], [-31, 82], [-34, 77], [-42, 95], [-46, 101]], 0.12);
    const sh = '<g transform="translate(2.4 4.4)">' + fillP(curve(mapF(g, [[50, 60]].concat(edge, [[-50, 60]]), 3), true), g.skinS) + "</g>";
    s += face(g, "inukai", sh);
    const C = crownMass(g, H, [[-46, 104, 2], [-49, 86, 4], [-48, 66, 6], [-40, 48, 8], [-24, 37, 10], [-4, 33, 12], [16, 34, 12], [33, 40, 10], [45, 54, 8], [50, 72, 6], [50, 90, 4], [47, 104, 2]], edge, { dz: 3, shade: [[18, 30, 12], [44, 44, 8], [58, 74, 4], [56, 106, 2], [40, 96, 10], [30, 64, 18], [22, 42, 20]], shine: [-42, 44, 46, 17] });
    s += C.s;
    s += strands(g, [[[38, 88], [27, 70]], [[23, 84], [13, 64]], [[6, 80], [-3, 62]], [[-9, 75], [-14, 60]], [[-34, 77], [-28, 62]]], 3);
    // 分け目
    if (g.fine) s += brush([prj(g, -16, 36, 22), prj(g, -18, 44, 26), prj(g, -19, 51, 28)], LW.fine, { s0: 0.2, e0: 0.6 });
    // こめかみの白髪
    s += brush([prj(g, -43, 86, 8), prj(g, -41, 94, 8), prj(g, -40.5, 104, 8)], 2.2, { fill: "#8f8a86", s0: 0.3, e0: 0.3 });
    // 目 (おだやかで少し下がり目)・眉
    const glare = ex === "serious";
    const E = { w: 15, h: 8.4, iris: "#5a4636", droop: 1, lash: 2.5 };
    const mode = ex === "happy" ? "arc" : "";
    if (!glare) s += eye(g, -18.5, 120, -1, E, ex, mode) + eye(g, 18.5, 120, 1, E, ex, mode);
    const BW = { w: 16, t: 2.2, arch: 1.1, col: mix(H.shade, INK, 0.3) };
    s += brow(g, -19, 108.5, -1, BW, ex) + brow(g, 19, 108.5, 1, BW, ex);
    s += nose(g, 137, 1.05);
    if (ex === "happy") s += mouth(g, 152, { w: 11, grin: 1.1, deep: 7 }, ex);
    else s += mouth(g, 153, { w: 12, smile: 1 }, ex);
    s += blush(g, 134, ex === "happy" ? 0.4 : 0, true, 25);
    // 半ぶちの四角いメガネ (上のふちだけ太い)
    for (const sd of [-1, 1]) {
      const u = sd * 18.5;
      const q = mapF(g, [[u - 11.5, 113.6], [u + 11.5, 113.6], [u + 11, 125.6], [u - 11, 125.6]], 5);
      const lens = curve([q[0], [(q[0][0] + q[1][0]) / 2, q[0][1] - 0.5], q[1], [q[1][0] + 0.3, (q[1][1] + q[2][1]) / 2], q[2], [(q[2][0] + q[3][0]) / 2, q[2][1] + 0.6], q[3], [q[3][0] - 0.3, (q[3][1] + q[0][1]) / 2]], true);
      const kx = Math.abs(q[1][0] - q[0][0]) / 23;
      const lc = [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[2][1]) / 2];
      if (glare) {
        // 光って目が見えない (真剣)
        s += fillP(lens, "#eef4fb") + clipOpen(g.id + "gl" + (sd + 1), lens) + brush([[lc[0] - 9 * kx, lc[1] + 7], [lc[0] + 1 * kx, lc[1] - 7]], 7, { fill: "#ffffff", s0: 1, e0: 1, a: 0.01, b: 0.01 }) + brush([[lc[0] + 2 * kx, lc[1] + 7], [lc[0] + 8 * kx, lc[1] - 7]], 4, { fill: "#ffffff", s0: 1, e0: 1, a: 0.01, b: 0.01 }) + "</g>";
      } else {
        s += fillP(lens, "#dfeaf7", 0.15);
        if (g.fine) s += glint([lc[0] + 6.5 * kx, lc[1] + 1.5], kx * 0.6);
      }
      s += shape(lens, "none", 0.8, "#4a3a30");
      s += brush([q[0], [(q[0][0] + q[1][0]) / 2, q[0][1] - 0.5], q[1]], 1.4, { fill: "#4a3a30", s0: 1, e0: 1, a: 0.02, b: 0.02 });
    }
    s += brush([F(g, -7, 114.4, 5), F(g, 0, 113.2, 6), F(g, 7, 114.4, 5)], 1, { fill: "#4a3a30", s0: 1, e0: 1 });
    s += brush([F(g, -30, 114, 4), prj(g, -41, 115, 2)], 1, { fill: "#4a3a30", s0: 1, e0: 1 });
    s += fx(g, ex, { veinX: 156, veinY: 48, sweatX: 152, sweatY: 96, gloomY: 92, surX: 46, surY: 44 });
    return s + headClose(g);
  }

  // 竜崎: 同期のライバル (細い顔・つばの下から流れる長い前髪・グレーがかった青い目・にやりと笑う)
  function drawRyu(g) {
    const ex = g.ex;
    const H = hairPal("#2a2238", mix("#2a2238", "#b8a8e0", 0.45));
    g.jaw = jawPts(g, "ryu");
    let s = headOpen(g) + nape(g, H, 4, true) + headClose(g);
    s += neck(g, 15.5, 138) + jersey(g, "std", 15.5) + necklace(g);
    s += headOpen(g);
    s += ear(g, 1, 110, 131, 7.5) + ear(g, -1, 110, 131, 8.5);
    // 前髪: 短い束 3 本と、手前からつばの下を通って奥の頬骨へ流れる長い 1 本
    const back = [
      [-30, 98, -32, 108, 8, -1],
      [-14, 98, -12, 108, 9, 1],
    ];
    const front = [
      [-34, 98, -36, 106.5, 7, -1],
      [-24, 98, -27, 109, 8, -1],
      [-4, 98, -2, 106, 7, 1],
    ];
    const long = sweep(g, [[-22, 99], [-9, 108], [6, 113.2], [22, 116], [35.5, 125]], 11, 4);
    const sh = '<g transform="translate(2.4 4.6)">' + [long].concat(front.map((b) => lock(g, b[0], b[1], b[2], b[3], b[4], b[5], 3))).map((d) => fillP(d, g.skinS)).join("") + "</g>" + brimShade(g, -1, 3.5);
    s += face(g, "ryu", sh);
    // 横の髪 (手前は耳にかかって長い)
    for (const sd of [-1, 1]) {
      const P = (u, v, c) => {
        const q = prj(g, sd * u, v, 6);
        return c ? [q[0], q[1], 1] : q;
      };
      const d = sd < 0 ? curve([P(46, 99, 1), P(38, 101), P(36, 112), P(37.5, 126, 1), P(41, 118), P(45, 128, 1), P(46.5, 114), P(48, 104)], true) : curve([P(45, 100, 1), P(37, 101), P(36.5, 110), P(38, 118, 1), P(42, 112), P(46, 104)], true);
      sil(g, d);
      s += shape(d, sd > 0 ? H.shade : H.base, LW.part);
      if (sd < 0 && g.fine) s += brush([P(40.5, 104), P(39.5, 117)], 1.3, { fill: H.hl });
    }
    const L = locks(g, H, back, front, 3);
    s += L.s;
    s += shape(long, H.base, LW.part);
    const fd = L.fd.concat([long]);
    s += clipMany(g.id + "fr", fd) + fillP(curve(mapF(g, [[-46, 95], [46, 95], [46, 104.5], [0, 106], [-46, 104.5]], 3), true), H.shade) + "</g>";
    if (g.fine) s += dashes(g, [[[-25, 104], [-26, 107.5]], [[-3.6, 103.4], [-2.6, 105.6]]], H.hl, 4);
    // 長い前髪のつや (毛の流れに沿う 2 本)
    s += brush(mapF(g, [[-8, 109.2], [4, 112.6], [16, 114.6]], 4), 1.6, { fill: H.hl, s0: 0.2, e0: 0.1, a: 0.4, b: 0.5 });
    if (g.fine) s += brush(mapF(g, [[12, 115], [24, 117.6], [30, 120.6]], 4), 1, { fill: H.hl, s0: 0.2, e0: 0.1, a: 0.4, b: 0.5 });
    // 目 (切れ長、目尻が上がる)・眉
    const E = { w: 17.5, h: 8.2, iris: "#4a6380", droop: -1.4, lash: 3, lo: 0.45, crease: 1 };
    const mode = ex === "happy" ? "squint" : "";
    s += eye(g, -18.5, 123, -1, E, ex, mode) + eye(g, 18.5, 123, 1, E, ex, mode);
    const BW = { w: 17, t: 2.4, arch: 0.8, col: mix(H.base, INK, 0.4), tip: -1.4 };
    s += brow(g, -19, 113, -1, BW, ex) + brow(g, 19, 113, 1, BW, ex);
    // 泣きぼくろ (奥の目の下)
    if (g.fine) s += ell(F(g, 25, 130.5, 0), 0.6, 0.6, INK);
    s += nose(g, 139, 1);
    if (ex === "happy") s += mouth(g, 152, { w: 14, grin: 1.15, deep: 8, teeth: 1 }, ex);
    else if (ex === "angry") s += mouth(g, 153, { w: 12 }, "serious");
    else s += mouth(g, 153, { w: 12, smirk: 1 }, ex);
    s += blush(g, 134, ex === "happy" ? 0.3 : 0, false, 24);
    s += cap(g, -1);
    s += fx(g, ex, { veinX: 158, veinY: 50, sweatX: 148, sweatY: 112, gloomY: 104, surX: 48, surY: 50 });
    return s + headClose(g);
  }

  // yaw: 右を向く量 (sin), hk: 頭の大きさ, tilt: 表情ごとの首のかしげ
  const CHARS = {
    kanto: { skin: "#f0bf96", draw: drawKanto, yaw: 0.18, hk: 0.93, tilt: { happy: -3, sad: 3 } },
    goda: { skin: "#e6b086", draw: drawGoda, yaw: 0.2, hk: 0.95, tilt: { normal: -2, happy: -4, sad: 3 } },
    hayase: { skin: "#ffe3cf", draw: drawHayase, yaw: 0.22, hk: 0.92, tilt: { normal: 3, happy: 5, angry: -3, sad: 3 } },
    inukai: { skin: "#fcd8b8", draw: drawInukai, yaw: 0.2, hk: 0.93, tilt: { happy: 2, sad: 2 } },
    ryuzaki: { skin: "#ffe0c6", draw: drawRyu, yaw: 0.26, hk: 0.93, tilt: { normal: -3, happy: -3, angry: 2, sad: 3 } },
    me: { skin: "#ffd9b8", draw: drawMe, yaw: 0.22, hk: 0.93, tilt: { happy: -3, angry: 1, sad: 3 } },
  };
  M.CHARS = Object.keys(CHARS);

  // 切り抜き (viewBox)。face は M.icon の symbol にも使うので正方形
  const CROP = {
    bust: [0, 0, 200, 240],
    square: [6, 26, 188, 188],
    face: [44, 54, 116, 116],
  };

  /* ---------- 公開: SVG の文字列 ----------
   * o: { team, ex (表情), crop: bust|square|face, size (表示の大きさ px、細部の量), face (自分の顔), seed, frame, sil, cls, label } */
  const cache = {};
  let seq = 0;
  M.svg = function (who, o) {
    o = o || {};
    const wk = CHARS[who] ? who : "me";
    const C = CHARS[wk];
    const ex = EXPRS.indexOf(o.ex) >= 0 ? o.ex : "normal";
    const crop = CROP[o.crop] ? o.crop : "bust";
    const size = o.size || 120;
    // 細部の量: 0 大 (紹介カード) / 1 中 (会話・週の画面) / 2 小 (アイコン)
    const lod = size >= 200 ? 0 : size >= 72 ? 1 : 2;
    const L = look(o.team);
    const f = o.face || {};
    const key = [wk, ex, crop, lod, o.frame === false ? 0 : 1, o.sil ? 1 : 0, L.key, f.skin || "", f.eyes || "", f.hs == null ? "" : f.hs, f.hair || "", wk === "me" ? o.seed || "" : ""].join("|");
    let body = cache[key];
    if (!body) {
      const g = { id: "§", who: wk, ex, lod, crop, fine: lod < 2, L, face: f, seed: o.seed, n: 0, sil: [], hk: C.hk, lift: 3, tilt: (C.tilt && C.tilt[ex]) || 0, sa: C.yaw, ca: Math.sqrt(1 - C.yaw * C.yaw) };
      g.k0 = lod === 2 ? 1.3 : lod === 1 ? 1.15 : 1;
      g.kl0 = lod === 2 ? 1.15 : 1;
      g.skin = wk === "me" ? f.skin || C.skin : C.skin;
      g.skinS = skinShade(g.skin);
      g.blushC = blushOf(g.skin);
      const vb = CROP[crop];
      K = g.k0;
      let fig;
      try {
        fig = C.draw(g);
      } finally {
        K = 1;
      }
      let s = background(g);
      if (o.sil) {
        // sil: まだ会っていない人は黒いシルエット
        s += '<filter id="§sil"><feColorMatrix type="matrix" values="0 0 0 0 .13 0 0 0 0 .15 0 0 0 0 .22 0 0 0 1 0"/></filter><g filter="url(#§sil)">' + fig + "</g>";
        // 小さいと形がわかりにくいので「?」を重ねる
        s += '<text x="' + n(vb[0] + vb[2] / 2) + '" y="' + n(vb[1] + vb[3] * 0.55) + '" font-family="\'Archivo Black\', sans-serif" font-size="' + n(vb[3] * 0.46) + '" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#ffffff" stroke="' + INK + '" stroke-width="' + n(vb[3] * 0.035) + '" paint-order="stroke" stroke-linejoin="round">?</text>';
      } else {
        // 人物の影 (中・大の胸から上の絵だけ)
        if (lod < 2 && crop !== "face") s += figShadow(g);
        s += fig;
      }
      if (o.frame !== false) {
        const sw = crop === "face" ? 3 : 2.6;
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
    const key = [who, o.ex || "normal", o.sil ? 1 : 0, look(o.team).key, f.skin || "", f.eyes || "", f.hs == null ? "" : f.hs, f.hair || "", o.seed || ""].join("|");
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
