/* 熱闘！ポケットベースボール — 捕手の防具 (マスク / ヘルメット・プロテクター・レガース・ミット)
   体の形 (ユニフォームの形状) に合わせて実行時に作る。骨の rest 姿勢は回転なし (ワールド軸と同じ向き)。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  if (!T) return;
  const G = {};

  function V(x, y, z) {
    return new T.Vector3(x, y, z);
  }
  function colorOf(c) {
    return new T.Color(c);
  }
  function lum(c) {
    const k = colorOf(c);
    return 0.299 * k.r + 0.587 * k.g + 0.114 * k.b;
  }

  /* ---------- 色: 防具はヘルメットの色、縁取りはチームカラー (近ければ金) ---------- */
  G.colors = function (st, team) {
    const base = (st.helmet && st.helmet.color) || "#16181c";
    const cands = [team && team.main, team && team.sub, team && team.sub2].filter(Boolean);
    let trim = "#c9a43a";
    let best = 0;
    for (const c of cands) {
      const d = Math.abs(lum(c) - lum(base));
      const k = colorOf(c);
      const sat = Math.max(k.r, k.g, k.b) - Math.min(k.r, k.g, k.b);
      if (d > 0.35 && sat > 0.25 && d + sat > best) {
        best = d + sat;
        trim = c;
      }
    }
    return { base, trim, wing: "#f2f2ee", metal: "#c9cdd2", pad: "#141416", strap: "#101012", lace: "#c98a2e" };
  };

  /* ---------- 幾何の小物 ---------- */
  // ジオメトリの属性を読む (正規化された整数にも対応)
  function attr(geo, name) {
    return geo.getAttribute(name);
  }
  // 頂点色つきの面を組み立てる
  class Builder {
    constructor() {
      this.p = [];
      this.c = [];
      this.i = [];
      this.si = [];
      this.sw = [];
    }
    v(p, col, skin) {
      this.p.push(p.x, p.y, p.z);
      this.c.push(col.r, col.g, col.b);
      if (skin) {
        this.si.push(...skin[0]);
        this.sw.push(...skin[1]);
      }
      return this.p.length / 3 - 1;
    }
    tri(a, b, c) {
      this.i.push(a, b, c);
    }
    quad(a, b, c, d) {
      this.i.push(a, b, c, a, c, d);
    }
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      if (this.si.length) {
        g.setAttribute("skinIndex", new T.Uint16BufferAttribute(this.si, 4));
        g.setAttribute("skinWeight", new T.Float32BufferAttribute(this.sw, 4));
      }
      g.setIndex(this.i);
      g.computeVertexNormals();
      return g;
    }
  }

  function tube(points, r, segs, closed) {
    const curve = new T.CatmullRomCurve3(points, !!closed, "catmullrom", 0.5);
    return new T.TubeGeometry(curve, segs || Math.max(8, points.length * 4), r, 7, !!closed);
  }

  /* ---------- レガース (すね当て) ---------- */
  // 脚の形: ひざ〜足首の軸と、すね当ての内側の半径 (自然な脚の太さ)
  function legShape(asset, side) {
    const bone = (n) => V(...asset.bones.find((b) => b.name === n).pos);
    const knee = bone("calf_" + side);
    const foot = bone("foot_" + side);
    const yTop = knee.y + 0.1;
    const yBot = foot.y + 0.07;
    const tOf = (y) => (knee.y - y) / (knee.y - foot.y);
    const center = (y) => {
      const t = tOf(y);
      return V(knee.x + (foot.x - knee.x) * t, y, knee.z + (foot.z - knee.z) * t - 0.004);
    };
    const rx = (y) => 0.07 - 0.024 * U01(tOf(y));
    const rz = (y) => 0.074 - 0.026 * U01(tOf(y));
    return { knee, foot, yTop, yBot, center, rx, rz, sx: side === "l" ? 1 : -1 };
  }
  function U01(t) {
    return Math.max(0, Math.min(1, t));
  }

  G.shinGuard = function (asset, side, cols) {
    const L = legShape(asset, side);
    const { knee, foot, yTop, yBot } = L;
    const cBase = colorOf(cols.base);
    const cTrim = colorOf(cols.trim);
    const cWing = colorOf(cols.wing);
    const b = new Builder();
    const NY = 26;
    const NT = 22;
    const TH = 1.95; // 前を中心に ±112°
    const ring = [];
    const inner = [];
    for (let j = 0; j <= NY; j++) {
      const y = yTop + (yBot - yTop) * (j / NY);
      const c = L.center(y);
      // ひざ当ての膨らみ・すねの縦の稜線
      const kn = Math.max(0, 1 - Math.abs(y - (knee.y + 0.01)) / 0.085);
      const row = [];
      const rowIn = [];
      for (let i = 0; i <= NT; i++) {
        const th = -TH + (2 * TH * i) / NT;
        const front = Math.cos(th);
        const ridge = 0.006 * Math.pow(Math.max(0, front), 10);
        const off = 0.008 + 0.02 * kn * Math.max(0, front) + ridge;
        const sx = Math.sin(th) * L.sx;
        const rx = L.rx(y);
        const rz = L.rz(y);
        const p = V(c.x + sx * (rx + off), y, c.z + front * (rz + off));
        const pi = V(c.x + sx * (rx + off - 0.011), y, c.z + front * (rz + off - 0.011));
        // 色: 縁取り・ひざとすねの境目は縁取り色、外側の羽は白
        const edgeT = j === 0 || j === NY || i === 0 || i === NT;
        const groove = Math.abs(y - (knee.y - 0.075)) < 0.012;
        const wing = Math.abs(th) > 1.25 && !kn;
        const col = edgeT || groove ? cTrim : wing ? cWing : cBase;
        row.push(b.v(p.sub(knee), col));
        rowIn.push(b.v(pi.sub(knee), cBase));
      }
      ring.push(row);
      inner.push(rowIn);
    }
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NT; i++) {
        b.quad(ring[j][i], ring[j + 1][i], ring[j + 1][i + 1], ring[j][i + 1]);
        b.quad(inner[j][i], inner[j][i + 1], inner[j + 1][i + 1], inner[j + 1][i]);
      }
    // 厚み (縁を内側の面とつなぐ)
    for (let j = 0; j < NY; j++) {
      b.quad(ring[j][0], inner[j][0], inner[j + 1][0], ring[j + 1][0]);
      b.quad(ring[j + 1][NT], inner[j + 1][NT], inner[j][NT], ring[j][NT]);
    }
    for (let i = 0; i < NT; i++) {
      b.quad(ring[0][i + 1], inner[0][i + 1], inner[0][i], ring[0][i]);
      b.quad(ring[NY][i], inner[NY][i], inner[NY][i + 1], ring[NY][i + 1]);
    }
    const calfGeo = b.geometry();
    if (side === "r") flipWinding(calfGeo);
    // 足の甲を覆う板 (足の骨につける)
    const fb = new Builder();
    const c0 = L.center(yBot);
    const NF = 8;
    const NA = 10;
    const fr = [];
    for (let j = 0; j <= NF; j++) {
      const t = j / NF;
      const y = yBot + 0.01 - t * 0.07;
      const fwd = t * 0.075;
      const row = [];
      for (let i = 0; i <= NA; i++) {
        const th = -1.15 + (2.3 * i) / NA;
        const sx = Math.sin(th) * L.sx;
        const r = (L.rx(yBot) + 0.012) * (1 - t * 0.2);
        const p = V(c0.x + sx * r, y, c0.z + Math.cos(th) * (L.rz(yBot) + 0.014) + fwd);
        const edge = j === 0 || j === NF || i === 0 || i === NA;
        row.push(fb.v(p.sub(foot), edge ? cTrim : cWing));
      }
      fr.push(row);
    }
    for (let j = 0; j < NF; j++) for (let i = 0; i < NA; i++) fb.quad(fr[j][i], fr[j + 1][i], fr[j + 1][i + 1], fr[j][i + 1]);
    const footGeo = fb.geometry();
    if (side === "r") flipWinding(footGeo);
    return { calfGeo, footGeo };
  };

  // ズボンのすそをすね当ての内側へ収める (捕手ごとの複製に適用)
  G.fitPants = function (geo, asset) {
    const g = geo.clone();
    const P = g.getAttribute("position");
    const shapes = { l: legShape(asset, "l"), r: legShape(asset, "r") };
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const L = shapes[x >= 0 ? "l" : "r"];
      if (y > L.yTop + 0.03 || y < L.yBot - 0.03) continue;
      // すね当ての上下の端はなめらかに
      const fade = Math.min(1, (L.yTop + 0.03 - y) / 0.04, (y - (L.yBot - 0.03)) / 0.03);
      const c = L.center(y);
      const dx = x - c.x;
      const dz = P.getZ(i) - c.z;
      const q = Math.hypot(dx / (L.rx(y) + 0.002), dz / (L.rz(y) + 0.002));
      if (q <= 1) continue;
      const k = 1 + (1 / q - 1) * Math.max(0, fade);
      P.setX(i, c.x + dx * k);
      P.setZ(i, c.z + dz * k);
    }
    P.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };
  function flipWinding(g) {
    const ix = g.getIndex();
    for (let k = 0; k < ix.count; k += 3) {
      const a = ix.getX(k + 1);
      ix.setX(k + 1, ix.getX(k + 2));
      ix.setX(k + 2, a);
    }
    g.computeVertexNormals();
  }

  /* ---------- チェストプロテクター (シャツの前面に沿わせた板・スキン付き) ---------- */
  // シャツ前面の頂点 (腕以外)
  function shirtFront(asset) {
    const geo = asset.geos.shirt;
    const P = attr(geo, "position");
    const SI = attr(geo, "skinIndex");
    const SW = attr(geo, "skinWeight");
    const names = asset.bones.map((x) => x.name);
    const pts = [];
    for (let i = 0; i < P.count; i++) {
      let arm = 0;
      for (let k = 0; k < 4; k++) if (/arm/.test(names[SI.getComponent(i, k)])) arm += SW.getComponent(i, k);
      if (arm > 0.25 || P.getZ(i) < -0.03) continue;
      pts.push({
        x: P.getX(i),
        y: P.getY(i),
        z: P.getZ(i),
        si: [SI.getComponent(i, 0), SI.getComponent(i, 1), SI.getComponent(i, 2), SI.getComponent(i, 3)],
        sw: [SW.getComponent(i, 0), SW.getComponent(i, 1), SW.getComponent(i, 2), SW.getComponent(i, 3)],
      });
    }
    return pts;
  }
  // (x, y) の前面の z (近い頂点の重み付き平均) と、いちばん近い頂点のスキン
  function projectFront(pts, x, y) {
    let best = null;
    let bd = 9;
    let zs = 0;
    let ws = 0;
    for (const q of pts) {
      const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
      if (d < bd) {
        bd = d;
        best = q;
      }
      if (d < 0.0016) {
        const w = 1 / (d + 1e-5);
        // 同じ (x, y) の背中側を拾わないよう前にあるものほど重く
        zs += q.z * w;
        ws += w;
      }
    }
    return { z: ws ? zs / ws : best.z, skin: [best.si, best.sw] };
  }
  G.protector = function (asset, cols) {
    const pts = shirtFront(asset);
    const cBase = colorOf(cols.base);
    const cTrim = colorOf(cols.trim);
    const cSeam = cBase.clone().multiplyScalar(0.55);
    const clav = asset.bones.find((x) => x.name === "clavicle_l").pos[1];
    const belt = asset.extra.beltY;
    const yBot = belt - 0.05;
    const yTop = clav + 0.03;
    // 幅の形 (腰で細く、胸で広い)
    const halfW = (y) => {
      const t = (y - yBot) / (yTop - yBot);
      if (t < 0.25) return 0.118 + (0.15 - 0.118) * (t / 0.25);
      if (t < 0.7) return 0.15 + (0.19 - 0.15) * ((t - 0.25) / 0.45);
      return 0.19 - (0.19 - 0.168) * ((t - 0.7) / 0.3);
    };
    const NU = 22;
    const NV = 26;
    const grid = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      const row = [];
      for (let i = 0; i <= NU; i++) {
        const u = -1 + (2 * i) / NU;
        let y = yBot + (yTop - yBot) * v;
        const x = u * halfW(y);
        // 上は首の U 字、下は丸く
        const top = yTop - 0.055 * Math.max(0, 1 - Math.pow(x / 0.075, 2));
        const bot = yBot + 0.035 * u * u;
        y = bot + (top - bot) * v;
        const pr = projectFront(pts, x, y);
        row.push({ u, v, p: V(x, y, pr.z), skin: pr.skin });
      }
      grid.push(row);
    }
    // 面の法線 (格子の差分) で外側へ押し出す
    const nAt = (j, i) => {
      const a = grid[Math.min(NV, j + 1)][i].p.clone().sub(grid[Math.max(0, j - 1)][i].p);
      const c = grid[j][Math.min(NU, i + 1)].p.clone().sub(grid[j][Math.max(0, i - 1)].p);
      const n = c.cross(a).normalize();
      if (n.z < 0) n.negate();
      return n;
    };
    const b = new Builder();
    const outer = [];
    const inner = [];
    for (let j = 0; j <= NV; j++) {
      const ro = [];
      const ri = [];
      for (let i = 0; i <= NU; i++) {
        const g = grid[j][i];
        const n = nAt(j, i);
        const bulge = 0.012 * (1 - g.u * g.u) * Math.sin(Math.PI * Math.min(1, g.v * 1.15));
        const po = g.p.clone().addScaledVector(n, 0.026 + bulge);
        const pi = g.p.clone().addScaledVector(n, 0.008);
        const edge = i === 0 || i === NU || j === 0 || j === NV;
        const nearEdge = i <= 1 || i >= NU - 1 || j <= 1 || j >= NV - 1;
        const seam = (j === Math.round(NV * 0.36) || j === Math.round(NV * 0.68)) && !nearEdge;
        ro.push(b.v(po, edge || (nearEdge && (j === 0 || j === NV)) ? cTrim : seam ? cSeam : cBase, g.skin));
        ri.push(b.v(pi, cTrim, g.skin));
      }
      outer.push(ro);
      inner.push(ri);
    }
    for (let j = 0; j < NV; j++)
      for (let i = 0; i < NU; i++) {
        b.quad(outer[j][i], outer[j][i + 1], outer[j + 1][i + 1], outer[j + 1][i]);
        b.quad(inner[j][i], inner[j + 1][i], inner[j + 1][i + 1], inner[j][i + 1]);
      }
    // 縁の厚み
    for (let j = 0; j < NV; j++) {
      b.quad(outer[j][0], outer[j + 1][0], inner[j + 1][0], inner[j][0]);
      b.quad(outer[j + 1][NU], outer[j][NU], inner[j][NU], inner[j + 1][NU]);
    }
    for (let i = 0; i < NU; i++) {
      b.quad(outer[0][i + 1], outer[0][i], inner[0][i], inner[0][i + 1]);
      b.quad(outer[NV][i], outer[NV][i + 1], inner[NV][i + 1], inner[NV][i]);
    }
    return b.geometry();
  };

  /* ---------- 背中のベルト (X 字・スキン付き) ---------- */
  function shirtBack(asset) {
    const geo = asset.geos.shirt;
    const P = attr(geo, "position");
    const SI = attr(geo, "skinIndex");
    const SW = attr(geo, "skinWeight");
    const names = asset.bones.map((x) => x.name);
    const pts = [];
    for (let i = 0; i < P.count; i++) {
      let arm = 0;
      for (let k = 0; k < 4; k++) if (/arm/.test(names[SI.getComponent(i, k)])) arm += SW.getComponent(i, k);
      if (arm > 0.25 || P.getZ(i) > 0.0) continue;
      pts.push({
        x: P.getX(i),
        y: P.getY(i),
        z: P.getZ(i),
        si: [SI.getComponent(i, 0), SI.getComponent(i, 1), SI.getComponent(i, 2), SI.getComponent(i, 3)],
        sw: [SW.getComponent(i, 0), SW.getComponent(i, 1), SW.getComponent(i, 2), SW.getComponent(i, 3)],
      });
    }
    return pts;
  }
  G.harness = function (asset, cols) {
    const pts = shirtBack(asset);
    const col = colorOf(cols.strap);
    const b = new Builder();
    const belt = asset.extra.beltY;
    const clav = asset.bones.find((x) => x.name === "clavicle_l").pos[1];
    const strap = (x0, y0, x1, y1, w) => {
      const N = 16;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const px = -dy / len;
      const py = dx / len;
      let prev = null;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const cx = x0 + dx * t;
        const cy = y0 + dy * t;
        const pair = [-1, 1].map((sg) => {
          const x = cx + px * (w / 2) * sg;
          const y = cy + py * (w / 2) * sg;
          const pr = projectFront(pts, x, y);
          return b.v(V(x, y, pr.z - 0.007), col, pr.skin);
        });
        if (prev) b.quad(prev[0], pair[0], pair[1], prev[1]);
        prev = pair;
      }
    };
    strap(0.12, clav + 0.01, -0.09, belt + 0.07, 0.034);
    strap(-0.12, clav + 0.01, 0.09, belt + 0.07, 0.034);
    strap(-0.15, belt + 0.07, 0.15, belt + 0.07, 0.03);
    const g = b.geometry();
    g.computeVertexNormals();
    return g;
  };

  /* ---------- 肩当て (鎖骨の骨につける・プロテクターの上の角) ---------- */
  G.shoulderCap = function (asset, side, cols) {
    const pts = shirtFront(asset);
    const bone = asset.bones.find((x) => x.name === "clavicle_" + side).pos;
    const sx = side === "l" ? 1 : -1;
    const clav = asset.bones.find((x) => x.name === "clavicle_l").pos[1];
    const x = 0.165 * sx;
    const y = clav + 0.012;
    const z = projectFront(pts, x, y).z;
    const g = new T.SphereGeometry(0.058, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    g.scale(1, 0.42, 1);
    // ドームの向き: 前・上・外
    const dir = V(0.45 * sx, 0.55, 0.7).normalize();
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    g.translate(x - bone[0], y - bone[1] + 0.01, z + 0.02 - bone[2]);
    const col = colorOf(cols.base);
    const tr = colorOf(cols.trim);
    const P = g.getAttribute("position");
    const C = [];
    const c0 = V(x - bone[0], y - bone[1] + 0.01, z + 0.02 - bone[2]);
    for (let i = 0; i < P.count; i++) {
      const h = V(P.getX(i), P.getY(i), P.getZ(i)).sub(c0).dot(dir);
      const c = h < 0.004 ? tr : col;
      C.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(C, 3));
    return g;
  };

  /* ---------- マスク (頭の骨につける) ---------- */
  // 顔の前の曲面 (縦軸まわりの円筒): u = -1..1 (左右), v = -1..1 (下..上)
  function maskSurface(asset, hb, R, cz, y0, y1, ang) {
    return (u, v, inset) => {
      const a = u * ang;
      const r = R - (inset || 0);
      return V(Math.sin(a) * r, y0 + ((v + 1) / 2) * (y1 - y0) - hb.y, cz + Math.cos(a) * r - hb.z);
    };
  }
  G.mask = function (asset, cols, style) {
    const hb = V(...asset.bones.find((b) => b.name === "head").pos);
    const eye = V(...asset.extra.eyeL);
    const grp = new T.Group();
    grp.name = "catcherMask";
    const hockey = style === "hockey";
    const metal = new T.MeshStandardMaterial({ color: hockey ? "#2a2c30" : cols.metal, roughness: hockey ? 0.45 : 0.28, metalness: hockey ? 0.4 : 0.9 });
    const padM = new T.MeshStandardMaterial({ color: cols.pad, roughness: 0.6 });
    const trimM = new T.MeshStandardMaterial({ color: cols.trim, roughness: 0.4, metalness: 0.3 });
    const S = maskSurface(asset, hb, 0.142, eye.z - 0.085, eye.y - 0.165, eye.y + 0.088, 1.08);
    const frame = [];
    for (let k = 0; k <= 40; k++) {
      const t = (k / 40) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      // 角の丸い四角 (スーパー楕円)
      const u = Math.sign(c) * Math.pow(Math.abs(c), 0.55);
      const v = Math.sign(s) * Math.pow(Math.abs(s), 0.55);
      frame.push(S(u, v));
    }
    grp.add(new T.Mesh(tube(frame, 0.0062, 120, true), metal));
    // 格子 (横 3 本・縦 2 本)
    for (const v of [-0.6, -0.22, 0.18]) {
      const w = Math.pow(1 - Math.pow(Math.abs(v), 1 / 0.55), 0.55);
      const pts = [];
      for (let k = 0; k <= 12; k++) pts.push(S(-w + (2 * w * k) / 12, v));
      grp.add(new T.Mesh(tube(pts, 0.0048, 40), metal));
    }
    for (const u of [-0.2, 0.2]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push(S(u, -0.92 + (1.32 * k) / 10));
      grp.add(new T.Mesh(tube(pts, 0.0048, 30), metal));
    }
    // パッド (額・あご・頬) と縁取り
    const pad = (pts, r) => {
      grp.add(new T.Mesh(tube(pts, r, 40), padM));
      grp.add(new T.Mesh(tube(pts.map((p) => p.clone().add(V(0, 0, 0.002))), r * 0.25 + 0.002, 40), trimM));
    };
    const arc = (v, u0, u1, inset) => {
      const pts = [];
      for (let k = 0; k <= 12; k++) pts.push(S(u0 + ((u1 - u0) * k) / 12, v, inset));
      return pts;
    };
    if (!hockey) {
      pad(arc(0.78, -0.72, 0.72, 0.018), 0.016);
      pad(arc(-0.86, -0.55, 0.55, 0.018), 0.015);
      for (const u of [-0.9, 0.9]) {
        const pts = [];
        for (let k = 0; k <= 8; k++) pts.push(S(u, -0.6 + (1.2 * k) / 8, 0.02));
        pad(pts, 0.014);
      }
      // のど当て
      const tg = new T.CylinderGeometry(0.055, 0.05, 0.06, 16, 1, true, -0.9, 1.8);
      tg.rotateY(Math.PI);
      const throat = new T.Mesh(tg, padM);
      const chin = S(0, -1);
      throat.position.set(0, chin.y - 0.04, chin.z - 0.045);
      throat.material.side = T.DoubleSide;
      grp.add(throat);
      // 頭の後ろのベルト
      for (const [v, ry] of [
        [0.55, 0.0],
        [-0.45, 0.0],
      ]) {
        const a = S(-0.98, v, 0.02);
        const c = S(0.98, v, 0.02);
        const back = V(0, a.y + ry, eye.z - hb.z - 0.215);
        const pts = [a, V(-0.075, a.y, eye.z - hb.z - 0.13), back, V(0.075, c.y, eye.z - hb.z - 0.13), c];
        grp.add(new T.Mesh(tube(pts, 0.006, 30), new T.MeshStandardMaterial({ color: cols.strap, roughness: 0.7 })));
      }
    } else {
      // ホッケー型: 頭全体を覆う殻 + 顔の前の格子
      const shell = new T.SphereGeometry(0.128, 30, 18, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.78);
      shell.scale(0.86, 1.04, 1.12);
      const shellM = new T.MeshPhysicalMaterial({ color: cols.base, roughness: 0.55, clearcoat: 0.3 });
      shellM.side = T.DoubleSide;
      const sh = new T.Mesh(shell, shellM);
      sh.position.set(0, eye.y + 0.02 - hb.y, eye.z - 0.075 - hb.z);
      grp.add(sh);
      pad(arc(0.86, -0.75, 0.75, 0.02), 0.012);
      pad(arc(-0.9, -0.6, 0.6, 0.02), 0.012);
    }
    grp.traverse((n) => {
      if (n.isMesh) n.castShadow = true;
    });
    return grp;
  };

  /* ---------- キャッチャーミット (手の骨の「標準の手」座標) ---------- */
  // 標準の手の座標: 指先が -Y、手のひらは +X (ポケットを +X に向け、背中で手の甲を包む)
  G.mitt = function (cols) {
    const grp = new T.Group();
    const leather = new T.MeshStandardMaterial({ color: "#151517", roughness: 0.45, metalness: 0.05 });
    const pocket = new T.MeshStandardMaterial({ color: "#1d1d20", roughness: 0.6 });
    const laceM = new T.MeshStandardMaterial({ color: cols.lace, roughness: 0.55 });
    const R = 0.128;
    // 本体 (丸い椀)
    const bowl = new T.SphereGeometry(R, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    bowl.scale(1, 0.66, 1.05);
    bowl.rotateZ(Math.PI / 2);
    const body = new T.Mesh(bowl, leather);
    grp.add(body);
    const inner = new T.Mesh(new T.CircleGeometry(R * 0.96, 28), pocket);
    inner.rotation.y = Math.PI / 2;
    inner.position.x = -0.004;
    inner.scale.set(1.05, 1, 1);
    grp.add(inner);
    // 縁の巻き (手首側はあける)
    const rim = new T.TorusGeometry(R * 0.98, 0.017, 10, 40, Math.PI * 1.62);
    rim.rotateZ(Math.PI * 0.69);
    rim.rotateY(Math.PI / 2);
    const rimM = new T.Mesh(rim, leather);
    rimM.scale.set(1, 1, 1.05);
    grp.add(rimM);
    // 縁のひも (巻きを縫うように)
    for (let k = 0; k < 26; k++) {
      const a = Math.PI * 0.69 + (k / 25) * Math.PI * 1.62;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ring = new T.TorusGeometry(0.019, 0.0032, 5, 10);
      const m = new T.Mesh(ring, laceM);
      m.position.set(0, s * R * 0.98, c * R * 0.98 * 1.05);
      m.rotation.x = -a;
      grp.add(m);
    }
    // ウェブ (指先側) のひも
    for (let k = 0; k < 4; k++) {
      const y = -R * (0.35 + k * 0.13);
      const pts = [V(0.006, y, -R * 0.42), V(0.012, y - 0.01, 0), V(0.006, y, R * 0.42)];
      grp.add(new T.Mesh(tube(pts, 0.0035, 16), laceM));
    }
    // 手首のベルト
    const strap = new T.Mesh(new T.BoxGeometry(0.03, 0.032, 0.11), leather);
    strap.position.set(-0.03, R * 0.92, 0);
    grp.add(strap);
    // ポケットは手のひらの前 (この座標では +X)、背中は手の甲の後ろ
    grp.position.set(0.072, -0.04, -0.008);
    grp.traverse((n) => {
      if (n.isMesh) n.castShadow = true;
    });
    return grp;
  };

  /* ---------- 野手のグラブ (手の座標は G.mitt と同じ: 指先 -Y・手のひら +X) ---------- */
  G.glove = function (kind, leatherColor, laceColor) {
    const grp = new T.Group();
    const leather = new T.MeshStandardMaterial({ color: leatherColor, roughness: 0.5, metalness: 0.03 });
    const dark = new T.MeshStandardMaterial({ color: colorOf(leatherColor).multiplyScalar(0.7), roughness: 0.55 });
    const laceM = new T.MeshStandardMaterial({ color: laceColor, roughness: 0.55 });
    const first = kind === "first";
    const R = first ? 0.1 : 0.088;
    // 背中 (手の甲側に膨らむ椀)
    const shell = new T.SphereGeometry(R, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    // 回転前の X が指の方向 (Y) に、Z が幅になる
    shell.scale(first ? 1.3 : 1.42, 0.68, first ? 0.95 : 0.9);
    shell.rotateZ(Math.PI / 2);
    grp.add(new T.Mesh(shell, leather));
    // ポケット
    const pk = new T.Mesh(new T.CircleGeometry(R * 0.88, 24), dark);
    pk.rotation.y = Math.PI / 2;
    pk.scale.set(first ? 0.95 : 0.9, first ? 1.3 : 1.42, 1);
    pk.position.x = -0.003;
    grp.add(pk);
    // 縁の巻き
    const rim = new T.TorusGeometry(R * 0.97, 0.009, 8, 36, Math.PI * 1.6);
    rim.rotateZ(Math.PI * 0.7);
    rim.rotateY(Math.PI / 2);
    const rimM = new T.Mesh(rim, leather);
    rimM.scale.set(1, first ? 1.3 : 1.42, first ? 0.95 : 0.9);
    grp.add(rimM);
    if (!first) {
      // 指袋 (指先側に 4 本)
      for (let k = 0; k < 4; k++) {
        const z = -0.045 + k * 0.024;
        const cap = new T.Mesh(new T.CapsuleGeometry(0.0125, 0.05, 4, 8), leather);
        cap.position.set(-0.008, -R * 1.3 - 0.01 + Math.abs(z + 0.006) * 0.35, z);
        cap.rotation.x = z * 2.2;
        grp.add(cap);
      }
    }
    // ウェブ (親指と人差し指のあいだ・格子のひも)
    for (let k = 0; k < 3; k++) {
      const y = -R * (0.75 + k * 0.22);
      grp.add(new T.Mesh(tube([V(0.004, y, R * 0.55), V(0.01, y - 0.006, R * 0.8), V(0.004, y, R * 1.02)], 0.003, 12), laceM));
    }
    // 縁のひも
    for (let k = 0; k < 16; k++) {
      const a = Math.PI * 0.7 + (k / 15) * Math.PI * 1.6;
      const m = new T.Mesh(new T.TorusGeometry(0.011, 0.0022, 4, 8), laceM);
      m.position.set(0, Math.sin(a) * R * 0.97 * (first ? 1.3 : 1.42), Math.cos(a) * R * 0.97 * (first ? 0.95 : 0.9));
      m.rotation.x = -a;
      grp.add(m);
    }
    grp.position.set(0.066, -0.035, -0.004);
    grp.traverse((n) => {
      if (n.isMesh) n.castShadow = true;
    });
    return grp;
  };
  G.GLOVE_COLORS = [
    ["#8a4e24", "#e0b070"],
    ["#b8743a", "#5a2e12"],
    ["#1b1b1d", "#c98a2e"],
    ["#a0521d", "#f0d090"],
    ["#c8a46a", "#7a4a20"],
  ];

  /* ---------- 捕手の防具一式を選手に付ける ---------- */
  G.attach = function (player, asset, st, team, opts) {
    const o = opts || {};
    const cols = G.colors(st, team);
    const byName = player.bones;
    const parts = [];
    const vmat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 });
    // プロテクター (スキン)
    const pg = G.protector(asset, cols);
    const prot = new T.SkinnedMesh(pg, vmat);
    prot.name = "protector";
    prot.castShadow = true;
    prot.frustumCulled = false;
    player.group.add(prot);
    prot.bind(player.skeleton, player.meshes.shirt.bindMatrix);
    parts.push(prot);
    const hm = new T.SkinnedMesh(G.harness(asset, cols), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: T.DoubleSide }));
    hm.name = "harness";
    hm.frustumCulled = false;
    player.group.add(hm);
    hm.bind(player.skeleton, player.meshes.shirt.bindMatrix);
    parts.push(hm);
    // 肩当て
    for (const s of ["l", "r"]) {
      const m = new T.Mesh(G.shoulderCap(asset, s, cols), vmat);
      m.castShadow = true;
      byName["clavicle_" + s].add(m);
      parts.push(m);
    }
    // ズボンをすね当ての内側に収める
    for (const k of ["pants", "pantsL"]) if (player.meshes[k]) player.meshes[k].geometry = G.fitPants(player.meshes[k].geometry, asset);
    // レガース
    for (const s of ["l", "r"]) {
      const sg = G.shinGuard(asset, s, cols);
      const c = new T.Mesh(sg.calfGeo, vmat);
      c.castShadow = true;
      byName["calf_" + s].add(c);
      const f = new T.Mesh(sg.footGeo, vmat);
      f.castShadow = true;
      byName["foot_" + s].add(f);
      parts.push(c, f);
    }
    // マスク
    const mask = G.mask(asset, cols, o.style);
    byName.head.add(mask);
    parts.push(mask);
    return { parts, mask, cols, style: o.style || "classic" };
  };

  PB.Gear = G;
})((window.PB = window.PB || {}));
