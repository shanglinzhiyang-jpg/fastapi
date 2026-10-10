/* 熱闘！ポケットベースボール — 球場の描画 (簡易3D投影)
 * ワールド座標 (m) をピンホールカメラで投影し、Canvas 2D に描く。
 * 打席視点 (捕手後方) と 守備視点 (バックネット上空) の 2 つのカメラを使う。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const F = PB.F;
  const P = PB.P;
  const Chara = PB.Chara;

  const R = {};

  /* ---------- カメラ ---------- */
  class Cam {
    constructor() {
      this.near = 0.3;
    }
    set(pos, target, f, cx, cy) {
      this.pos = pos.slice();
      this.target = target.slice();
      this.f = f;
      this.cx = cx;
      this.cy = cy;
      const fw = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
      const fl = Math.hypot(fw[0], fw[1], fw[2]);
      this.fw = [fw[0] / fl, fw[1] / fl, fw[2] / fl];
      let rt = [this.fw[1], -this.fw[0], 0];
      const rl = Math.hypot(rt[0], rt[1]) || 1;
      this.rt = [rt[0] / rl, rt[1] / rl, 0];
      const a = this.rt;
      const b = this.fw;
      this.up = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      return this;
    }
    toCam(x, y, z) {
      const dx = x - this.pos[0];
      const dy = y - this.pos[1];
      const dz = z - this.pos[2];
      return [dx * this.rt[0] + dy * this.rt[1] + dz * this.rt[2], dx * this.up[0] + dy * this.up[1] + dz * this.up[2], dx * this.fw[0] + dy * this.fw[1] + dz * this.fw[2]];
    }
    projC(c) {
      return { x: this.cx + (this.f * c[0]) / c[2], y: this.cy - (this.f * c[1]) / c[2], s: this.f / c[2], z: c[2] };
    }
    p(x, y, z) {
      const c = this.toCam(x, y, z);
      if (c[2] < this.near) return null;
      return this.projC(c);
    }
    static lerp(a, b, t) {
      const c = new Cam();
      const L = (u, v) => u.map((x, i) => U.lerp(x, v[i], t));
      return c.set(L(a.pos, b.pos), L(a.target, b.target), U.lerp(a.f, b.f, t), U.lerp(a.cx, b.cx, t), U.lerp(a.cy, b.cy, t));
    }
  }
  R.Cam = Cam;

  /* ---------- ポリゴン (ニアクリップ付き) ---------- */
  function path(ctx, cam, pts) {
    const cs = pts.map((p) => cam.toCam(p[0], p[1], p[2] || 0));
    const out = [];
    const n = cam.near;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      const b = cs[(i + 1) % cs.length];
      const ain = a[2] >= n;
      const bin = b[2] >= n;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (n - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]);
      }
    }
    if (out.length < 3) return false;
    ctx.beginPath();
    out.forEach((c, i) => {
      const q = cam.projC(c);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    return true;
  }
  function fillPoly(ctx, cam, pts, color) {
    if (path(ctx, cam, pts)) {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  function line3(ctx, cam, a, b, color, wm) {
    // 線分 (太さは距離に応じて)
    const ca = cam.toCam(a[0], a[1], a[2] || 0);
    const cb = cam.toCam(b[0], b[1], b[2] || 0);
    const n = cam.near;
    if (ca[2] < n && cb[2] < n) return;
    let A = ca;
    let B = cb;
    if (A[2] < n) {
      const t = (n - A[2]) / (B[2] - A[2]);
      A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, n];
    }
    if (B[2] < n) {
      const t = (n - B[2]) / (A[2] - B[2]);
      B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, n];
    }
    const pa = cam.projC(A);
    const pb = cam.projC(B);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.min(6, ((pa.s + pb.s) / 2) * (wm || 0.1)));
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  R.path = path;
  R.fillPoly = fillPoly;

  function circlePts(cx, cy, r, n, z) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z || 0]);
    }
    return out;
  }
  const polar = (th, r, z) => [r * Math.sin(th), r * Math.cos(th), z || 0];

  /* ---------- 球場ジオメトリ ---------- */
  const G = {};
  (function build() {
    const deg = Math.PI / 180;
    G.fenceArc = [];
    for (let a = -45; a <= 45.001; a += 3) G.fenceArc.push(polar(a * deg, F.fenceDist(a * deg)));
    G.fair = [[0, 0, 0]].concat(G.fenceArc);
    const LC = G.fenceArc[0];
    const RC = G.fenceArc[G.fenceArc.length - 1];
    const off = 18 / Math.SQRT2;
    G.W1 = [LC[0] - off, LC[1] - off, 0];
    G.W2 = [7.07 - off, -7.07 - off, 0];
    G.W3 = [-7.07 + off, -7.07 - off, 0];
    G.W4 = [RC[0] + off, RC[1] - off, 0];
    G.outline = G.fenceArc.concat([G.W4, G.W3, G.W2, G.W1]);
    // 内野の土 (マウンド中心 R=29m の円弧)
    const dirt = [[0, 0, 0]];
    for (let a = -45; a <= 45.001; a += 3) {
      // 本塁からの方向 a の線とマウンド中心円の交点
      const th = a * deg;
      const dx = Math.sin(th);
      const dy = Math.cos(th);
      const my = F.MOUND[1];
      const b = -2 * dy * my;
      const c = my * my - 29 * 29;
      const t = (-b + Math.sqrt(b * b - 4 * c)) / 2;
      dirt.push([dx * t, dy * t, 0]);
    }
    G.dirt = dirt;
    const h = F.BASE_DIST / Math.SQRT2;
    G.infieldGrass = [
      [0, 4.6, 0],
      [h - 2.6, h, 0],
      [0, 2 * h - 3.4, 0],
      [-h + 2.6, h, 0],
    ];
    G.track = [];
    for (let a = -45; a <= 45.001; a += 3) G.track.push(polar(a * deg, F.fenceDist(a * deg) - 4.5));
    for (let a = 45; a >= -45.001; a -= 3) G.track.push(polar(a * deg, F.fenceDist(a * deg)));
    // 芝の刈り込み模様 (センター方向のストライプ)
    G.stripes = [];
    for (let i = -9; i <= 9; i++) {
      if (i % 2 === 0) continue;
      const x0 = i * 7;
      G.stripes.push([
        [x0 - 3.5, -5, 0],
        [x0 + 3.5, -5, 0],
        [x0 + 3.5, 140, 0],
        [x0 - 3.5, 140, 0],
      ]);
    }
    // スタンド
    G.stands = [];
    const arc = G.fenceArc;
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i];
      const b = arc[i + 1];
      const na = Math.hypot(a[0], a[1]);
      const nb = Math.hypot(b[0], b[1]);
      const ua = [a[0] / na, a[1] / na];
      const ub = [b[0] / nb, b[1] / nb];
      G.stands.push({
        quad: [
          [a[0], a[1], F.FENCE_H],
          [b[0], b[1], F.FENCE_H],
          [b[0] + ub[0] * 34, b[1] + ub[1] * 34, 22],
          [a[0] + ua[0] * 34, a[1] + ua[1] * 34, 22],
        ],
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      });
    }
    // 内野側スタンド (ファウルゾーン)
    const side = (p1, p2, nrm) => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const u0 = i / n;
        const u1 = (i + 1) / n;
        const a = [U.lerp(p1[0], p2[0], u0), U.lerp(p1[1], p2[1], u0)];
        const b = [U.lerp(p1[0], p2[0], u1), U.lerp(p1[1], p2[1], u1)];
        G.stands.push({
          quad: [
            [a[0], a[1], 1.2],
            [b[0], b[1], 1.2],
            [b[0] + nrm[0] * 30, b[1] + nrm[1] * 30, 16],
            [a[0] + nrm[0] * 30, a[1] + nrm[1] * 30, 16],
          ],
          mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          side: true,
        });
      }
    };
    side(G.W1, G.W2, [-Math.SQRT1_2, -Math.SQRT1_2]);
    side(G.W3, G.W4, [Math.SQRT1_2, -Math.SQRT1_2]);
    // 照明塔
    G.lights = [-62, -28, 28, 62].map((a) => {
      const th = a * deg;
      const r = F.fenceDist(Math.max(-0.78, Math.min(0.78, th))) + 40;
      return polar(th, r, 0);
    });
    // 観客 (ランダムな点)
    const rnd = U.seeded(77);
    G.crowd = [];
    for (const st of G.stands) {
      const q = st.quad;
      const n = st.side ? 26 : 34;
      for (let k = 0; k < n; k++) {
        const u = rnd.next();
        const v = 0.08 + rnd.next() * 0.9;
        const p0 = [U.lerp(q[0][0], q[1][0], u), U.lerp(q[0][1], q[1][1], u), U.lerp(q[0][2], q[1][2], u)];
        const p1 = [U.lerp(q[3][0], q[2][0], u), U.lerp(q[3][1], q[2][1], u), U.lerp(q[3][2], q[2][2], u)];
        G.crowd.push({ p: [U.lerp(p0[0], p1[0], v), U.lerp(p0[1], p1[1], v), U.lerp(p0[2], p1[2], v) + 0.4], c: rnd.next(), ph: rnd.next() * 6.28 });
      }
    }
  })();
  R.G = G;

  /* ---------- 状態 ---------- */
  R.night = true;
  R.cams = {};
  R.bg = {};
  R.layout = { top: 96, bottom: 150 };

  R.init = function (canvas) {
    R.canvas = canvas;
    R.ctx = canvas.getContext("2d");
    R.resize();
  };

  R.resize = function () {
    const c = R.canvas;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const W = c.clientWidth || window.innerWidth;
    const H = c.clientHeight || window.innerHeight;
    R.W = W;
    R.H = H;
    R.dpr = dpr;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    R.computeCams();
    R.bg = {};
  };

  R.setLayout = function (top, bottom) {
    if (top === R.layout.top && bottom === R.layout.bottom) return;
    R.layout = { top, bottom };
    R.computeCams();
    R.bg = {};
  };

  R.computeCams = function () {
    const W = R.W;
    const H = R.H;
    const top = R.layout.top;
    const bottom = R.layout.bottom;
    const portrait = H >= W;
    // 打席カメラ
    const camH = portrait ? 1.3 : 1.18;
    const pos = [0, -4.2, camH];
    const tgt = [0, 18.44, 0.95];
    const tmp = new Cam().set(pos, tgt, 1, 0, 0);
    const zc = tmp.toCam(0, 0, P.ZONE.cz);
    const zl = tmp.toCam(-P.ZONE.hw, 0, P.ZONE.cz);
    const zr = tmp.toCam(P.ZONE.hw, 0, P.ZONE.cz);
    const wN = zr[0] / zr[2] - zl[0] / zl[2];
    const avail = H - top - bottom;
    let zoneW = portrait ? Math.min(W * 0.44, avail * 0.36) : Math.min(H * 0.3, W * 0.26);
    let f = zoneW / wN;
    const zoneCY = top + avail * (portrait ? 0.6 : 0.62);
    const ph = tmp.toCam(0, 18.44, 2.25);
    // 投手の頭が上端に収まるように f を制限
    const sep = ph[1] / ph[2] - zc[1] / zc[2];
    const maxF = (zoneCY - (top + 6)) / sep;
    if (f > maxF) f = maxF;
    R.zonePx = f * wN;
    const cy = zoneCY + (f * zc[1]) / zc[2];
    R.cams.bat = new Cam().set(pos, tgt, f, W / 2, cy);
    // 守備カメラ
    const fpos = portrait ? [0, -40, 74] : [0, -50, 42];
    const ftgt = portrait ? [0, 50, 0] : [0, 56, 0];
    const t2 = new Cam().set(fpos, ftgt, 1, 0, 0);
    const pts = [
      [-74, 74, 0],
      [74, 74, 0],
      [0, 126, 6],
      [0, -4, 0],
      [-45, 108, 3],
      [45, 108, 3],
    ].map((p) => {
      const c = t2.toCam(p[0], p[1], p[2]);
      return [c[0] / c[2], c[1] / c[2]];
    });
    const xs = pts.map((p) => Math.abs(p[0]));
    const ys = pts.map((p) => p[1]);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const fTop = portrait ? top + 4 : top - 10;
    const fBot = portrait ? H - bottom * 0.55 : H - 8;
    const ff = Math.min((W * 0.49) / Math.max(...xs), (fBot - fTop) / (yMax - yMin));
    const fcy = fTop + (ff * yMax) + ((fBot - fTop) - ff * (yMax - yMin)) / 2;
    R.cams.field = new Cam().set(fpos, ftgt, ff, W / 2, fcy);
  };

  /* ---------- 背景 ---------- */
  function pal() {
    return R.night
      ? { sky0: "#06101f", sky1: "#18325a", sky2: "#2c4f7c", grass: "#2e8b3e", grass2: "#37994a", foul: "#2a7a37", dirt: "#b97a45", dirt2: "#a86b3a", wall: "#163e2a", wallTop: "#f5d443", stand: "#2b3448", stand2: "#232b3d", line: "#f4f4ee" }
      : { sky0: "#5aa9e6", sky1: "#9fd0f5", sky2: "#d6ecfb", grass: "#3a9b45", grass2: "#45a952", foul: "#348d3e", dirt: "#c88a52", dirt2: "#b77b46", wall: "#1d5135", wallTop: "#f5d443", stand: "#5b6478", stand2: "#4c5468", line: "#ffffff" };
  }
  R.pal = pal;

  R.drawBackground = function (ctx, cam, teams) {
    const W = R.W;
    const H = R.H;
    const c = pal();
    // 空
    const hz = cam.p(0, 400, 0);
    const hy = hz ? hz.y : H * 0.3;
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(10, hy));
    g.addColorStop(0, c.sky0);
    g.addColorStop(0.7, c.sky1);
    g.addColorStop(1, c.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 遠景の地面
    ctx.fillStyle = R.night ? "#142233" : "#6a7b8d";
    ctx.fillRect(0, hy, W, H - hy);
    // 照明塔 (夜)
    for (const L of G.lights) {
      const base = cam.p(L[0], L[1], 0);
      const topP = cam.p(L[0], L[1], 46);
      if (!base || !topP) continue;
      ctx.strokeStyle = R.night ? "#3b4a63" : "#8592a4";
      ctx.lineWidth = Math.max(1, topP.s * 0.8);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(topP.x, topP.y);
      ctx.stroke();
      const pw = Math.max(6, topP.s * 9);
      const phh = Math.max(4, topP.s * 5);
      if (R.night) {
        const gl = ctx.createRadialGradient(topP.x, topP.y, 0, topP.x, topP.y, pw * 2.4);
        gl.addColorStop(0, "rgba(255,250,220,0.85)");
        gl.addColorStop(0.3, "rgba(255,240,190,0.25)");
        gl.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(topP.x - pw * 2.4, topP.y - pw * 2.4, pw * 4.8, pw * 4.8);
      }
      ctx.fillStyle = R.night ? "#fffbe6" : "#d9dee6";
      ctx.fillRect(topP.x - pw / 2, topP.y - phh / 2, pw, phh);
    }
    // スタンド (遠い順)
    const stands = G.stands
      .map((s) => ({ s, d: cam.toCam(s.mid[0], s.mid[1], 8)[2] }))
      .filter((o) => o.d > 0)
      .sort((a, b) => b.d - a.d);
    stands.forEach((o, i) => {
      fillPoly(ctx, cam, o.s.quad, i % 2 ? c.stand : c.stand2);
    });
    // 観客
    const cols = teams ? [teams.home.main, teams.home.sub, teams.away.main, "#e9e4da", "#f2c8a2"] : ["#e9e4da", "#f2c8a2", "#c33", "#36c"];
    for (const m of G.crowd) {
      const q = cam.p(m.p[0], m.p[1], m.p[2]);
      if (!q || q.x < -4 || q.x > W + 4 || q.y < -4 || q.y > H + 4) continue;
      const sz = Math.max(1, Math.min(3.2, q.s * 0.3));
      ctx.fillStyle = cols[Math.floor(m.c * cols.length)];
      ctx.fillRect(q.x - sz / 2, q.y - sz, sz, sz);
    }
    // バックスクリーン
    const bs = [
      [-9, 125, F.FENCE_H],
      [9, 125, F.FENCE_H],
      [9, 131, 15],
      [-9, 131, 15],
    ];
    fillPoly(ctx, cam, bs, R.night ? "#0c2418" : "#174a2c");
    // グラウンド (ファウルゾーン)
    fillPoly(ctx, cam, G.outline, c.foul);
    // フェア地域の芝 + 刈り込み
    ctx.save();
    if (path(ctx, cam, G.fair)) {
      ctx.fillStyle = c.grass;
      ctx.fill();
      ctx.clip();
      for (const st of G.stripes) fillPoly(ctx, cam, st, c.grass2);
    }
    ctx.restore();
    fillPoly(ctx, cam, G.track, c.dirt2);
    // 内野
    fillPoly(ctx, cam, G.dirt, c.dirt);
    fillPoly(ctx, cam, G.infieldGrass, c.grass);
    fillPoly(ctx, cam, circlePts(0, 0, 4.2, 28), c.dirt);
    fillPoly(ctx, cam, circlePts(F.MOUND[0], F.MOUND[1], 2.8, 24), c.dirt);
    for (let b = 1; b <= 3; b++) fillPoly(ctx, cam, circlePts(F.BASES[b][0], F.BASES[b][1], 2.2, 16), c.dirt);
    // ライン
    const LC = G.fenceArc[0];
    const RC = G.fenceArc[G.fenceArc.length - 1];
    line3(ctx, cam, [0, 0, 0.01], [LC[0], LC[1], 0.01], c.line, 0.12);
    line3(ctx, cam, [0, 0, 0.01], [RC[0], RC[1], 0.01], c.line, 0.12);
    // バッターボックス
    for (const sx of [-1, 1]) {
      const x0 = sx * 0.38;
      const x1 = sx * 1.6;
      const box = [
        [x0, -0.95, 0.01],
        [x1, -0.95, 0.01],
        [x1, 0.95, 0.01],
        [x0, 0.95, 0.01],
      ];
      for (let i = 0; i < 4; i++) line3(ctx, cam, box[i], box[(i + 1) % 4], "rgba(255,255,255,0.85)", 0.06);
    }
    // ホームベース
    fillPoly(
      ctx,
      cam,
      [
        [-0.216, 0, 0.02],
        [0.216, 0, 0.02],
        [0.216, -0.216, 0.02],
        [0, -0.43, 0.02],
        [-0.216, -0.216, 0.02],
      ],
      "#fbfbf6"
    );
    // ベース
    for (let b = 1; b <= 3; b++) {
      const [x, y] = F.BASES[b];
      fillPoly(
        ctx,
        cam,
        [
          [x, y - 0.27, 0.05],
          [x + 0.27, y, 0.05],
          [x, y + 0.27, 0.05],
          [x - 0.27, y, 0.05],
        ],
        "#fbfbf6"
      );
    }
    // プレート
    fillPoly(
      ctx,
      cam,
      [
        [-0.3, 18.36, 0.26],
        [0.3, 18.36, 0.26],
        [0.3, 18.5, 0.26],
        [-0.3, 18.5, 0.26],
      ],
      "#fbfbf6"
    );
    // フェンス
    const arc = G.fenceArc;
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i];
      const b = arc[i + 1];
      fillPoly(
        ctx,
        cam,
        [
          [a[0], a[1], 0],
          [b[0], b[1], 0],
          [b[0], b[1], F.FENCE_H],
          [a[0], a[1], F.FENCE_H],
        ],
        c.wall
      );
      line3(ctx, cam, [a[0], a[1], F.FENCE_H], [b[0], b[1], F.FENCE_H], c.wallTop, 0.35);
    }
    // 距離表示
    ctx.fillStyle = "#f5f1e0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [a, txt] of cam.pos[2] < 10 ? [] : [
      [-45, "100"],
      [0, "122"],
      [45, "100"],
      [-22, "116"],
      [22, "116"],
    ]) {
      const th = (a * Math.PI) / 180;
      const pp = polar(th, F.fenceDist(th) - 0.2, F.FENCE_H * 0.55);
      const q = cam.p(pp[0], pp[1], pp[2]);
      if (!q) continue;
      ctx.font = "700 " + Math.max(7, Math.round(q.s * 1.8)) + "px 'DotGothic16', monospace";
      ctx.fillText(txt, q.x, q.y);
    }
    // ポール
    for (const C of [LC, RC]) line3(ctx, cam, [C[0], C[1], 0], [C[0], C[1], 26], "#f7d23e", 0.5);
  };

  R.background = function (key, cam, teams) {
    const id = key + (R.night ? "n" : "d") + (teams ? teams.home.id + teams.away.id : "");
    let bg = R.bg[id];
    if (!bg) {
      bg = document.createElement("canvas");
      bg.width = R.canvas.width;
      bg.height = R.canvas.height;
      const c = bg.getContext("2d");
      c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      R.drawBackground(c, cam, teams);
      R.bg = {};
      R.bg[id] = bg;
    }
    return bg;
  };

  /* ---------- 人物 ---------- */
  function viewFrom(cam, x, y, vx, vy) {
    // 画面上での向き
    if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return "front";
    const a = cam.toCam(x, y, 0);
    const b = cam.toCam(x + vx, y + vy, 0);
    const dx = b[0] / b[2] - a[0] / a[2];
    const dz = b[2] - a[2];
    if (Math.abs(dx) * 30 > Math.abs(dz) * 0.4) return dx > 0 ? "right" : "left";
    return dz > 0 ? "back" : "front";
  }

  R.drawPerson = function (ctx, cam, x, y, o, scaleMul) {
    const q = cam.p(x, y, 0);
    if (!q) return;
    const s = q.s * (scaleMul || 1);
    if (q.x < -s * 2 || q.x > R.W + s * 2) return;
    Chara.draw(ctx, q.x, q.y, s, o);
  };

  /* ---------- ボール ---------- */
  R.drawBall = function (ctx, cam, x, y, z, opts) {
    const sh = cam.p(x, y, 0);
    const q = cam.p(x, y, z);
    if (!q) return;
    const mul = (opts && opts.mul) || 1;
    const r = Math.max(opts && opts.min != null ? opts.min : 2, 0.037 * q.s * mul);
    if (sh && z > 0.05) {
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts && opts.trail) {
      const t = opts.trail;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = r * 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.fillStyle = "#fffef8";
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 5) {
      ctx.strokeStyle = "#d33a3a";
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.arc(q.x - r * 0.9, q.y, r * 0.7, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x + r * 0.9, q.y, r * 0.7, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    return q;
  };

  /* ---------- 打席オーバーレイ ---------- */
  R.zoneRect = function (cam) {
    const Z = P.ZONE;
    const a = cam.p(-Z.hw, 0, Z.hi);
    const b = cam.p(Z.hw, 0, Z.lo);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  };
  R.plateToScreen = (cam, x, z) => cam.p(x, 0, z);
  R.screenToPlate = function (cam, sx, sy) {
    // ホームベース面 (y=0) 上の点
    const s = cam.p(0, 0, P.ZONE.cz);
    const k = s.s;
    return { x: (sx - s.x) / k, z: P.ZONE.cz - (sy - s.y) / k };
  };

  R.drawZone = function (ctx, cam, alpha) {
    const r = R.zoneRect(cam);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      const x = U.lerp(r.x0, r.x1, i / 3);
      const y = U.lerp(r.y0, r.y1, i / 3);
      ctx.moveTo(x, r.y0);
      ctx.lineTo(x, r.y1);
      ctx.moveTo(r.x0, y);
      ctx.lineTo(r.x1, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  R.drawCursor = function (ctx, cam, cur) {
    const c = cam.p(cur.x, 0, cur.z);
    if (!c) return;
    const rx = cur.rx * c.s;
    const rz = cur.rz * c.s;
    ctx.save();
    if (cur.bunt) {
      ctx.fillStyle = "rgba(255,226,92,0.25)";
      ctx.strokeStyle = "#ffe25c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx * 1.3, rz * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#d9a55b";
      ctx.lineWidth = Math.max(4, rz * 0.35);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(c.x - rx * 1.6, c.y);
      ctx.lineTo(c.x + rx * 1.6, c.y);
      ctx.stroke();
    } else {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rx);
      g.addColorStop(0, "rgba(255,240,140,0.55)");
      g.addColorStop(0.35, "rgba(255,226,92,0.3)");
      g.addColorStop(1, "rgba(255,200,40,0.12)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, rz, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cur.flash ? "#ffffff" : "#ffe25c";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 芯
      ctx.strokeStyle = "rgba(255,120,60,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx * 0.32, rz * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c.x - rx, c.y);
      ctx.lineTo(c.x - rx * 0.32, c.y);
      ctx.moveTo(c.x + rx * 0.32, c.y);
      ctx.lineTo(c.x + rx, c.y);
      ctx.strokeStyle = "rgba(255,226,92,0.7)";
      ctx.stroke();
    }
    ctx.restore();
  };

  R.drawMitt = function (ctx, cam, m, label) {
    const c = cam.p(m.x, 0, m.z);
    if (!c) return;
    const r = 0.11 * c.s;
    ctx.save();
    ctx.fillStyle = "#a8642f";
    ctx.strokeStyle = "#5e3417";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7d4520";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + r * 0.1, r * 0.55, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x - r * 1.5, c.y);
    ctx.lineTo(c.x - r * 1.15, c.y);
    ctx.moveTo(c.x + r * 1.15, c.y);
    ctx.lineTo(c.x + r * 1.5, c.y);
    ctx.moveTo(c.x, c.y - r * 1.5);
    ctx.lineTo(c.x, c.y - r * 1.15);
    ctx.moveTo(c.x, c.y + r * 1.15);
    ctx.lineTo(c.x, c.y + r * 1.5);
    ctx.stroke();
    if (label && label.dx != null) {
      // 変化の向き
      ctx.strokeStyle = "rgba(255,226,92,0.85)";
      ctx.lineWidth = 2;
      const L = 0.9 * c.s;
      const sx = c.x - label.dx * L;
      const sy = c.y + label.dz * L;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  };

  /* ---------- 守備ビュー用 ---------- */
  R.drawLanding = function (ctx, cam, x, y, t) {
    const q = cam.p(x, y, 0);
    if (!q) return;
    const r = Math.max(5, q.s * 1.4);
    ctx.save();
    ctx.strokeStyle = "rgba(255,226,92," + (0.5 + 0.4 * Math.sin(t * 10)) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- エフェクト ---------- */
  R.fx = [];
  R.burst = function (x, y, color, n, speed) {
    for (let i = 0; i < (n || 18); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (speed || 140) * (0.4 + Math.random() * 0.8);
      R.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.5, t: 0, c: color || "#ffe25c", g: 160 });
    }
  };
  R.firework = function () {
    const cols = ["#ff5d5d", "#ffe25c", "#7fe7ff", "#ff9ae0", "#9dff8a"];
    const x = U.rand(R.W * 0.15, R.W * 0.85);
    const y = U.rand(R.H * 0.12, R.H * 0.4);
    R.burst(x, y, U.pick(cols), 36, 170);
  };
  R.drawFx = function (ctx, dt) {
    for (const p of R.fx) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = 1 - p.t / p.life;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    R.fx = R.fx.filter((p) => p.t < p.life);
  };

  R.viewFrom = viewFrom;
  PB.R = R;
})((window.PB = window.PB || {}));
