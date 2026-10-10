/* 熱闘！ポケットベースボール — 3D 選手モデル (プロシージャル生成)
 * 実在の体型に近い 8 頭身。骨格 (Skeleton) にスキニングした胴体・手足と、
 * 頭部・帽子/ヘルメット・グラブ・バット・スパイクなどの剛体パーツで構成する。
 * 外部モデルファイルを使わず、すべてコードで形状とテクスチャを生成する。
 * 座標系 (three.js): Y 上, キャラクターは +Z を向く。キャラクターの左手側が +X。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const M = {};

  /* ---------- 骨格 ---------- */
  // [name, parent, 親からの相対位置 (m)]
  const SKEL = [
    ["root", null, [0, 0, 0]],
    ["hips", "root", [0, 0.98, 0]],
    ["spine", "hips", [0, 0.11, 0]],
    ["chest", "spine", [0, 0.17, 0]],
    ["neck", "chest", [0, 0.21, -0.005]],
    ["head", "neck", [0, 0.075, 0.014]],
  ];
  for (const s of ["L", "R"]) {
    const x = s === "L" ? 1 : -1;
    SKEL.push(
      ["clav." + s, "chest", [0.03 * x, 0.165, -0.01]],
      ["upperArm." + s, "clav." + s, [0.165 * x, 0.0, 0]],
      ["foreArm." + s, "upperArm." + s, [0, -0.29, 0]],
      ["hand." + s, "foreArm." + s, [0, -0.255, 0]],
      ["thigh." + s, "hips", [0.095 * x, -0.045, 0]],
      ["shin." + s, "thigh." + s, [0, -0.45, 0.005]],
      ["foot." + s, "shin." + s, [0, -0.425, -0.01]],
      ["toe." + s, "foot." + s, [0, -0.045, 0.135]]
    );
  }
  M.SKEL = SKEL;
  M.BONES = SKEL.map((s) => s[0]);

  function restWorld() {
    const w = {};
    for (const [n, p, o] of SKEL) {
      const base = p ? w[p] : [0, 0, 0];
      w[n] = [base[0] + o[0], base[1] + o[1], base[2] + o[2]];
    }
    return w;
  }
  const REST = restWorld();
  M.REST = REST;

  /* ---------- 色 ---------- */
  M.SKINS = ["#e9c3a0", "#dcb08a", "#c99772", "#b07d5a", "#f1d0b1", "#8d5e3f"];
  function col(hex) {
    return new T.Color(hex);
  }

  /* ---------- メッシュ生成ヘルパー ---------- */
  class Builder {
    constructor() {
      this.pos = [];
      this.col = [];
      this.uv = [];
      this.si = [];
      this.sw = [];
      this.idx = [];
    }
    vert(p, c, uv, wts) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(c.r, c.g, c.b);
      this.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
      const w = (wts || [[0, 1]]).slice(0, 4);
      while (w.length < 4) w.push([0, 0]);
      let tot = 0;
      for (const x of w) tot += x[1];
      for (const x of w) {
        this.si.push(x[0]);
        this.sw.push(tot ? x[1] / tot : 0);
      }
      return this.pos.length / 3 - 1;
    }
    tri(a, b, c) {
      this.idx.push(a, b, c);
    }
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.col, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2));
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(this.si, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(this.sw, 4));
      g.setIndex(this.idx);
      g.computeVertexNormals();
      return g;
    }
    /* 輪切りの断面をつないだチューブ
     * rings: [{c:[x,y,z], rx, rz, color, w:[[bone,weight]...], zo, xo}]
     * 断面は XZ 平面 (縦方向の部位用) */
    tube(rings, n, opts) {
      const o = opts || {};
      const start = this.pos.length / 3;
      for (let r = 0; r < rings.length; r++) {
        const R = rings[r];
        for (let k = 0; k <= n; k++) {
          const th = (k / n) * Math.PI * 2;
          const cx = Math.cos(th);
          const sz = Math.sin(th);
          // 前 (+Z) を少し張り出させる / 背中を平らに
          let rz = R.rz * (sz > 0 ? R.front || 1 : R.back || 1);
          const x = R.c[0] + cx * R.rx;
          const z = R.c[2] + sz * rz;
          const c = R.colorAt ? R.colorAt(th) : R.color;
          const wts = R.wAt ? R.wAt(x, R.c[1], z) : R.w;
          this.vert([x, R.c[1], z], c, [1 - k / n, o.v ? o.v(R.c[1]) : r / (rings.length - 1)], wts);
        }
      }
      for (let r = 0; r < rings.length - 1; r++) {
        for (let k = 0; k < n; k++) {
          const a = start + r * (n + 1) + k;
          const b = a + 1;
          const c = a + (n + 1);
          const d = c + 1;
          if (o.flip) {
            this.tri(a, b, c);
            this.tri(b, d, c);
          } else {
            this.tri(a, c, b);
            this.tri(b, c, d);
          }
        }
      }
      // ふた
      if (o.capTop || o.capBottom) {
        const cap = (ri, up) => {
          const R = rings[ri];
          const ci = this.vert(R.c, R.color, [0.5, 0.5], R.w);
          for (let k = 0; k < n; k++) {
            const a = start + ri * (n + 1) + k;
            if (up !== !!o.flip) this.tri(ci, a + 1, a);
            else this.tri(ci, a, a + 1);
          }
        };
        if (o.capBottom) cap(0, false);
        if (o.capTop) cap(rings.length - 1, true);
      }
    }
  }

  // 2つの骨の間をなめらかに補間するウェイト
  function blendW(bA, bB, y, y0, y1) {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    const s = t * t * (3 - 2 * t);
    return [
      [bA, 1 - s],
      [bB, s],
    ];
  }

  // 制御断面を Catmull-Rom で補間して、なめらかな輪郭の断面列を作る
  function smoothRings(ctrl, sub) {
    const keys = Object.keys(ctrl[0]).filter((k) => typeof ctrl[0][k] === "number");
    const out = [];
    const get = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
    for (let i = 0; i < ctrl.length - 1; i++) {
      for (let j = 0; j < sub; j++) {
        const t = j / sub;
        const r = {};
        for (const k of keys) {
          const p0 = get(i - 1)[k] != null ? get(i - 1)[k] : get(i)[k];
          const p1 = get(i)[k];
          const p2 = get(i + 1)[k] != null ? get(i + 1)[k] : p1;
          const p3 = get(i + 2)[k] != null ? get(i + 2)[k] : p2;
          const t2 = t * t;
          const t3 = t2 * t;
          r[k] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        }
        out.push(r);
      }
    }
    out.push(Object.assign({}, ctrl[ctrl.length - 1]));
    return out;
  }

  /* ---------- テクスチャ (ユニフォーム) ---------- */
  function jerseyTexture(o) {
    const W = 512;
    const H = 512;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    const V = (y) => (1 - (y - 0.84) / (1.6 - 0.84)) * H; // 体の高さ → キャンバス y
    // パンツ
    g.fillStyle = o.pants;
    g.fillRect(0, V(1.05), W, H - V(1.05));
    if (o.pinstripe) {
      g.strokeStyle = o.pinColor || "rgba(20,30,60,0.35)";
      g.lineWidth = 1.5;
      for (let x = 4; x < W; x += 12) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      }
    }
    // パンツのサイドライン
    g.fillStyle = o.trim;
    for (const u of [0, 0.5, 1]) g.fillRect(u * W - 5, V(1.03), 10, H);
    // ジャージ
    g.fillStyle = o.jersey;
    g.fillRect(0, 0, W, V(1.06));
    if (o.pinstripe) {
      g.strokeStyle = o.pinColor || "rgba(20,30,60,0.35)";
      for (let x = 4; x < W; x += 12) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, V(1.06));
        g.stroke();
      }
    }
    // 前立てのライン (ボタン) と襟
    g.fillStyle = o.trim;
    g.fillRect(0.75 * W - 3, 0, 6, V(1.07));
    g.fillStyle = o.jersey2 || o.trim;
    g.fillRect(0, V(1.505), W, V(1.48) - V(1.505));
    // ベルト
    g.fillStyle = "#1c1c22";
    g.fillRect(0, V(1.065), W, V(1.025) - V(1.065));
    g.fillStyle = "#b8b8c0";
    g.fillRect(0.75 * W - 9, V(1.06), 18, V(1.03) - V(1.06));
    // 胸のチームロゴ
    const fit = (txt, maxW, size, weight) => {
      let s = size;
      g.font = weight + " " + s + "px 'Dela Gothic One','M PLUS Rounded 1c','Hiragino Sans',sans-serif";
      while (g.measureText(txt).width > maxW && s > 8) {
        s -= 2;
        g.font = weight + " " + s + "px 'Dela Gothic One','M PLUS Rounded 1c','Hiragino Sans',sans-serif";
      }
      return s;
    };
    g.textAlign = "center";
    g.textBaseline = "middle";
    const chest = o.chest || "";
    if (chest) {
      fit(chest, W * 0.3, 54, "900");
      g.lineWidth = 7;
      g.strokeStyle = o.trim;
      g.strokeText(chest, 0.75 * W, V(1.33));
      g.fillStyle = o.letter;
      g.fillText(chest, 0.75 * W, V(1.33));
    }
    // 胸番号 (左胸下)
    if (o.num != null) {
      g.font = "900 34px 'Dela Gothic One',sans-serif";
      g.lineWidth = 5;
      g.strokeStyle = o.trim;
      g.strokeText(String(o.num), 0.79 * W, V(1.2));
      g.fillStyle = o.letter;
      g.fillText(String(o.num), 0.79 * W, V(1.2));
      // 背番号
      g.font = "900 150px 'Dela Gothic One',sans-serif";
      g.lineWidth = 10;
      g.strokeText(String(o.num), 0.25 * W, V(1.22));
      g.fillText(String(o.num), 0.25 * W, V(1.22));
    }
    if (o.name) {
      fit(o.name, W * 0.26, 34, "800");
      g.lineWidth = 5;
      g.strokeText(o.name, 0.25 * W, V(1.42));
      g.fillStyle = o.letter;
      g.fillText(o.name, 0.25 * W, V(1.42));
    }
    // 布の陰影 (ノイズ)
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    let seed = 1234;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const n = ((seed >> 8) % 9) - 4;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function capLogoTexture(mark, fg, bg) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.font = "900 96px 'Dela Gothic One','Hiragino Sans',sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 10;
    g.strokeStyle = bg;
    g.strokeText(mark, 64, 70);
    g.fillStyle = fg;
    g.fillText(mark, 64, 70);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ---------- 共有ジオメトリ (頭部・道具) ---------- */
  const shared = {};
  function geoCache(key, make) {
    if (!shared[key]) shared[key] = make();
    return shared[key];
  }

  function headGeometry() {
    if (shared.head) return shared.head;
    const g = new T.SphereGeometry(0.1, 40, 32);
    const p = g.attributes.position;
    const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let x = v.x * 0.79;
      let y = v.y * 1.12;
      let z = v.z * 0.98;
      // あご: 下に行くほど細く、首側を引っ込める
      if (y < -0.02) {
        const t = Math.min(1, (-0.02 - y) / 0.092);
        x *= 1 - 0.36 * Math.pow(t, 1.4);
        if (z < 0) z *= 1 - 0.55 * t;
        else z *= 1 - 0.1 * t;
        // あご先
        if (y < -0.075 && z > 0.035) z += 0.01 * (1 - Math.abs(x) / 0.04);
      }
      // 後頭部のふくらみ
      if (z < -0.03 && y > -0.035) z *= 1.07;
      // 顔の前面を平らに (横顔の凹凸は別パーツ)
      if (z > 0.052) z = 0.052 + (z - 0.052) * 0.55;
      // 眉の骨
      if (z > 0.04 && y > 0.018 && y < 0.05) z += 0.005 * Math.sin(((y - 0.018) / 0.032) * Math.PI) * (1 - Math.min(1, Math.abs(x) / 0.06));
      // 頬骨
      if (y > -0.035 && y < 0.015 && z > 0.025 && Math.abs(x) > 0.045) x *= 1.035;
      // こめかみ
      if (y > 0.02 && z > 0.0 && Math.abs(x) > 0.06) x *= 0.97;
      // 目のくぼみ
      if (z > 0.035) {
        const ex = Math.abs(x) - 0.032;
        const ey = y - 0.012;
        const dd = (ex * ex) / (0.022 * 0.022) + (ey * ey) / (0.013 * 0.013);
        if (dd < 1) z -= 0.008 * (1 - dd);
      }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    shared.head = g;
    return g;
  }

  function noseGeometry() {
    if (shared.nose) return shared.nose;
    // 球を変形して、鼻筋 (細く低い) から鼻先 (丸く高い)・小鼻へつながる形にする
    const g = new T.SphereGeometry(0.016, 28, 20);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const t = (y + 0.016) / 0.032; // 0 = 鼻先側 (下), 1 = 眉間側 (上)
      y = y * 1.95;
      const wx = 0.62 + 0.55 * (1 - t) * (1 - t); // 下ほど幅広 (小鼻)
      x *= wx;
      const pz = 0.32 + 0.75 * Math.pow(1 - t, 1.6); // 下ほど前に出る
      z = z > 0 ? z * pz : z * 0.4;
      // 鼻の下を少し上向きに
      if (t < 0.15 && z > 0) y += 0.004 * (0.15 - t) / 0.15;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    shared.nose = g;
    return g;
  }

  function mergeGeos(list) {
    const pos = [];
    const nrm = [];
    const idx = [];
    let off = 0;
    for (const g0 of list) {
      const g = g0.index ? g0 : g0;
      const p = g.attributes.position;
      const n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      }
      const ix = g.index;
      if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    out.setIndex(idx);
    return out;
  }

  // 色付きパーツを 1 つのジオメトリにまとめる (描画回数を減らす)
  function mergeColored(parts) {
    const pos = [];
    const nrm = [];
    const colr = [];
    const idx = [];
    let off = 0;
    const m = new T.Matrix4();
    const nm = new T.Matrix3();
    const v = new T.Vector3();
    for (const part of parts) {
      const g = part.geo;
      m.compose(
        new T.Vector3().fromArray(part.pos || [0, 0, 0]),
        new T.Quaternion().setFromEuler(new T.Euler().fromArray((part.rot || [0, 0, 0]).concat(["XYZ"]))),
        new T.Vector3().fromArray(part.scale || [1, 1, 1])
      );
      nm.getNormalMatrix(m);
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const c = new T.Color(part.color);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        nrm.push(v.x, v.y, v.z);
        colr.push(c.r, c.g, c.b);
      }
      const ix = g.index;
      if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    out.setAttribute("color", new T.Float32BufferAttribute(colr, 3));
    out.setIndex(idx);
    return out;
  }
  M.mergeColored = mergeColored;

  function batGeometry() {
    if (shared.bat) return shared.bat;
    const pts = [];
    const prof = [
      [0, 0.0],
      [0.026, 0.005],
      [0.026, 0.02],
      [0.014, 0.035],
      [0.0125, 0.1],
      [0.013, 0.3],
      [0.017, 0.45],
      [0.026, 0.6],
      [0.0315, 0.72],
      [0.033, 0.82],
      [0.031, 0.85],
      [0.022, 0.862],
      [0, 0.865],
    ];
    for (const [r, y] of prof) pts.push(new T.Vector2(r, y));
    const g = new T.LatheGeometry(pts, 16);
    shared.bat = g;
    return g;
  }

  function gloveGeometry(kind) {
    const key = "glove_" + kind;
    if (shared[key]) return shared[key];
    // 手のひら側が -X (グラブ手の内側) を向くお椀型
    const big = kind === "catcher" ? 1.25 : kind === "first" ? 1.15 : 1;
    const g = new T.SphereGeometry(0.075 * big, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
    g.scale(1.0, 1.25, 0.55);
    g.rotateZ(Math.PI / 2);
    g.translate(0.015, -0.03, 0);
    shared[key] = g;
    return g;
  }

  /* ---------- 選手の生成 ----------
   * o = { team:{main, sub, cap, mark, text?, pants?}, num, name, skin, bats:'R'|'L', throws:'R'|'L',
   *       role:'batter'|'pitcher'|'fielder'|'catcher'|'umpire'|'runner', pos, helmet:bool, chest, home:bool } */
  M.createPlayer = function (o) {
    o = o || {};
    const team = o.team || { main: "#c8102e", sub: "#ffffff", cap: "#1b1b1b", mark: "P" };
    const umpire = o.role === "umpire";
    const jersey = umpire ? "#1b2230" : o.home === false ? team.away || team.sub2 || "#9aa3b0" : team.jersey || "#f4f2ec";
    const jerseyIsWhite = !umpire && (o.home !== false ? !team.jersey : false);
    const letter = umpire ? "#e9e9ee" : jerseyIsWhite ? team.main : team.sub || "#ffffff";
    const trim = umpire ? "#3a465a" : team.main;
    const pants = umpire ? "#3b3f48" : o.home === false ? team.awayPants || "#c9ccd2" : team.pants || "#f4f2ec";
    const sleeve = umpire ? "#1b2230" : team.under || team.cap || team.main;
    const sock = umpire ? "#111" : team.sock || team.cap || team.main;
    const skin = col(o.skin || M.SKINS[0]);
    const cSleeve = col(sleeve);
    const cJersey = col(jersey);
    const cSock = col(sock);
    const cPants = col(pants);
    const cSkin = skin;

    // 骨
    const bones = {};
    const list = [];
    for (const [n, p, off] of SKEL) {
      const b = new T.Bone();
      b.name = n;
      b.position.set(off[0], off[1], off[2]);
      if (p) bones[p].add(b);
      bones[n] = b;
      list.push(b);
    }
    const bi = (n) => M.BONES.indexOf(n);
    const group = new T.Group();
    group.name = "player";
    const rootBone = bones.root;
    group.add(rootBone);
    // 逆バインド行列は rest 姿勢のワールド行列から計算する
    group.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(list);

    /* --- 胴体 (テクスチャ付き) --- */
    const tb = new Builder();
    const H = bi("hips");
    const S = bi("spine");
    const C = bi("chest");
    const N = bi("neck");
    const torso = smoothRings(
      [
        { y: 0.84, rx: 0.15, rz: 0.105, back: 1.05, front: 1, cz: -0.008 },
        { y: 0.9, rx: 0.172, rz: 0.122, back: 1.12, front: 0.95, cz: -0.008 },
        { y: 0.98, rx: 0.166, rz: 0.118, back: 1.08, front: 1, cz: 0 },
        { y: 1.04, rx: 0.152, rz: 0.108, back: 1, front: 1, cz: 0 },
        { y: 1.1, rx: 0.156, rz: 0.11, back: 1, front: 1, cz: 0 },
        { y: 1.2, rx: 0.17, rz: 0.118, back: 1, front: 1.04, cz: 0.002 },
        { y: 1.3, rx: 0.188, rz: 0.124, back: 1, front: 1.08, cz: 0.008 },
        { y: 1.38, rx: 0.2, rz: 0.118, back: 1.02, front: 1.04, cz: 0.006 },
        { y: 1.435, rx: 0.2, rz: 0.104, back: 1.02, front: 1, cz: 0 },
        { y: 1.47, rx: 0.168, rz: 0.09, back: 1.02, front: 1, cz: -0.004 },
        { y: 1.495, rx: 0.108, rz: 0.074, back: 1, front: 1, cz: -0.006 },
        { y: 1.52, rx: 0.076, rz: 0.07, back: 1, front: 1, cz: -0.006 },
        { y: 1.58, rx: 0.068, rz: 0.066, back: 1, front: 1, cz: -0.004 },
      ],
      3
    );
    const torsoW = (x, y) => {
      let w;
      if (y < 0.97) w = [[H, 1]];
      else if (y < 1.12) w = blendW(H, S, y, 0.97, 1.12);
      else if (y < 1.3) w = blendW(S, C, y, 1.12, 1.3);
      else if (y < 1.46) w = [[C, 1]];
      else w = blendW(C, N, y, 1.46, 1.54);
      // 肩の外側は腕に少し追従
      if (y > 1.33 && y < 1.47 && Math.abs(x) > 0.13) {
        const arm = x > 0 ? bi("upperArm.L") : bi("upperArm.R");
        const k = Math.min(1, (Math.abs(x) - 0.13) / 0.07) * 0.45;
        w = w.map(([b, ww]) => [b, ww * (1 - k)]).concat([[arm, k]]);
      }
      // 股は太ももに追従
      if (y < 0.93 && Math.abs(x) > 0.03) {
        const th = x > 0 ? bi("thigh.L") : bi("thigh.R");
        const k = Math.min(1, (0.93 - y) / 0.09) * Math.min(1, (Math.abs(x) - 0.03) / 0.08) * 0.6;
        w = w.map(([b, ww]) => [b, ww * (1 - k)]).concat([[th, k]]);
      }
      return w;
    };
    tb.tube(
      torso.map((r) => ({
        c: [0, r.y, r.cz],
        rx: r.rx,
        rz: r.rz,
        front: r.front,
        back: r.back,
        color: r.y > 1.505 ? cSkin : new T.Color(1, 1, 1),
        wAt: (x, y) => torsoW(x, y),
      })),
      36,
      { v: (y) => (y - 0.84) / (1.6 - 0.84), capBottom: true }
    );
    // 首から上の肌色部分はテクスチャを使わず頂点色で塗るため、別メッシュにしない (テクスチャは白で乗算)
    const torsoGeo = tb.geometry();
    const jerseyTex = jerseyTexture({
      jersey,
      jersey2: trim,
      pants,
      trim,
      letter,
      chest: umpire ? "" : o.chest != null ? o.chest : team.en || team.short || "",
      num: umpire ? null : o.num,
      name: umpire ? "" : o.nameEn || "",
      pinstripe: !umpire && team.pinstripe && o.home !== false,
    });
    const matTorso = new T.MeshStandardMaterial({ map: jerseyTex, vertexColors: true, roughness: 0.82, metalness: 0 });
    // 首 (肌) の頂点は白テクスチャ部分を使うよう UV を上端へ
    {
      const pos = torsoGeo.attributes.position;
      const uv = torsoGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 1.505) uv.setY(i, 1.0);
    }
    const torsoMesh = new T.SkinnedMesh(torsoGeo, matTorso);

    /* --- 手足 (頂点色) --- */
    const lb = new Builder();
    for (const s of ["L", "R"]) {
      const sx = s === "L" ? 1 : -1;
      const th = bi("thigh." + s);
      const sh = bi("shin." + s);
      const ft = bi("foot." + s);
      const X = 0.095 * sx;
      const leg = smoothRings(
        [
          { y: 0.99, rx: 0.084, rz: 0.092, cz: 0 },
          { y: 0.9, rx: 0.088, rz: 0.094, cz: 0 },
          { y: 0.76, rx: 0.08, rz: 0.086, cz: 0.002 },
          { y: 0.62, rx: 0.068, rz: 0.074, cz: 0.004 },
          { y: 0.53, rx: 0.061, rz: 0.066, cz: 0.006 },
          { y: 0.45, rx: 0.061, rz: 0.068, cz: 0.002 },
          { y: 0.37, rx: 0.065, rz: 0.073, cz: -0.004 },
          { y: 0.335, rx: 0.06, rz: 0.066, cz: -0.004 },
          { y: 0.322, rx: 0.05, rz: 0.058, cz: -0.006 },
          { y: 0.24, rx: 0.046, rz: 0.054, cz: -0.008 },
          { y: 0.14, rx: 0.036, rz: 0.042, cz: -0.004 },
          { y: 0.06, rx: 0.033, rz: 0.038, cz: 0 },
        ],
        2
      );
      lb.tube(
        leg.map((r) => ({
          c: [X, r.y, r.cz],
          rx: r.rx,
          rz: r.rz,
          color: r.y > 0.328 ? cPants : cSock,
          w: r.y > 0.94 ? blendW(H, th, r.y, 1.0, 0.92) : r.y > 0.43 ? (r.y > 0.56 ? [[th, 1]] : blendW(th, sh, r.y, 0.56, 0.44)) : r.y > 0.09 ? [[sh, 1]] : blendW(sh, ft, r.y, 0.09, 0.05),
        })),
        18,
        { capBottom: true }
      );
      // 腕
      const ua = bi("upperArm." + s);
      const fa = bi("foreArm." + s);
      const hd = bi("hand." + s);
      const AX = 0.195 * sx;
      const arm = smoothRings(
        [
          { y: 1.5, rx: 0.03, rz: 0.036, cx: -0.045 },
          { y: 1.47, rx: 0.05, rz: 0.058, cx: -0.014 },
          { y: 1.43, rx: 0.063, rz: 0.066, cx: 0 },
          { y: 1.38, rx: 0.06, rz: 0.062, cx: 0 },
          { y: 1.33, rx: 0.056, rz: 0.058, cx: 0 },
          { y: 1.24, rx: 0.046, rz: 0.049, cx: 0 },
          { y: 1.15, rx: 0.038, rz: 0.041, cx: 0 },
          { y: 1.07, rx: 0.041, rz: 0.043, cx: 0 },
          { y: 0.97, rx: 0.033, rz: 0.035, cx: 0 },
          { y: 0.9, rx: 0.026, rz: 0.03, cx: 0 },
          { y: 0.885, rx: 0.025, rz: 0.028, cx: 0 },
        ],
        2
      );
      lb.tube(
        arm.map((r) => ({
          c: [AX - 0.004 * sx * (1.47 - r.y) + r.cx * sx, r.y, 0],
          rx: r.rx,
          rz: r.rz,
          color: r.y > 1.322 ? cJersey : r.y > 0.892 ? cSleeve : cSkin,
          w: r.y > 1.2 ? (r.y > 1.4 ? blendW(bi("clav." + s), ua, r.y, 1.47, 1.41) : [[ua, 1]]) : r.y > 1.1 ? blendW(ua, fa, r.y, 1.19, 1.11) : r.y > 0.92 ? [[fa, 1]] : blendW(fa, hd, r.y, 0.92, 0.885),
        })),
        16,
        { capBottom: true }
      );
    }
    const limbGeo = lb.geometry();
    const matLimb = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const limbMesh = new T.SkinnedMesh(limbGeo, matLimb);

    for (const m of [torsoMesh, limbMesh]) {
      group.add(m);
      m.updateMatrixWorld(true);
      m.bind(skeleton, m.matrixWorld);
      m.castShadow = true;
      m.frustumCulled = false;
    }

    const matSkin = new T.MeshStandardMaterial({ color: cSkin, roughness: 0.55, metalness: 0, emissive: new T.Color("#3a1408"), emissiveIntensity: 0.12 });
    const add = (bone, mesh, pos, rot, scale) => {
      if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      mesh.castShadow = true;
      bones[bone].add(mesh);
      return mesh;
    };

    /* --- 頭部 (パーツを 1 メッシュに統合) --- */
    const head = new T.Group();
    head.position.set(0, 0.068, 0.012);
    bones.head.add(head);
    const skinHex = "#" + cSkin.getHexString();
    const lidHex = "#" + new T.Color(o.skin || M.SKINS[0]).multiplyScalar(0.62).getHexString();
    const lipHex = "#" + new T.Color(o.skin || M.SKINS[0]).lerp(new T.Color("#8a3c32"), 0.45).getHexString();
    const hairHex = o.hair || "#1d1712";
    const parts = [
      { geo: headGeometry(), color: skinHex },
      { geo: noseGeometry(), color: skinHex, pos: [0, -0.004, 0.066], scale: [1.3, 1.3, 1.3] },
      { geo: geoCache("lip", () => new T.CapsuleGeometry(0.0036, 0.026, 3, 8)), color: lipHex, pos: [0, -0.051, 0.07], rot: [0, 0, Math.PI / 2] },
      { geo: geoCache("hair", () => new T.SphereGeometry(0.1, 28, 14, Math.PI, Math.PI, 0, Math.PI * 0.62)), color: hairHex, pos: [0, 0.004, -0.004], scale: [0.82, 1.12, 1.03] },
    ];
    for (const sd of [1, -1]) {
      parts.push(
        { geo: geoCache("ear", () => new T.SphereGeometry(0.02, 12, 8)), color: skinHex, pos: [0.077 * sd, -0.002, -0.006], rot: [0, 0.35 * sd, 0], scale: [0.42, 1.25, 0.9] },
        { geo: geoCache("eyeW", () => new T.SphereGeometry(0.0105, 14, 10)), color: "#efe9e0", pos: [0.032 * sd, 0.012, 0.066], scale: [1.3, 0.72, 0.62] },
        { geo: geoCache("iris", () => new T.SphereGeometry(0.0058, 12, 8)), color: o.eye || "#2b1a10", pos: [0.031 * sd, 0.0115, 0.0715], scale: [1, 1.05, 0.55] },
        { geo: geoCache("lid", () => new T.CapsuleGeometry(0.0034, 0.024, 3, 8)), color: lidHex, pos: [0.032 * sd, 0.0195, 0.0695], rot: [0, 0, Math.PI / 2 + 0.1 * sd], scale: [1, 1, 0.8] },
        { geo: geoCache("lid2", () => new T.CapsuleGeometry(0.0016, 0.02, 3, 6)), color: skinHex, pos: [0.032 * sd, 0.0055, 0.0695], rot: [0, 0, Math.PI / 2] },
        { geo: geoCache("brow", () => new T.CapsuleGeometry(0.0032, 0.026, 3, 6)), color: hairHex, pos: [0.034 * sd, 0.031, 0.073], rot: [0, 0, Math.PI / 2 - 0.16 * sd] },
        { geo: geoCache("burn", () => new T.SphereGeometry(0.012, 8, 8)), color: hairHex, pos: [0.073 * sd, 0.024, 0.02], scale: [0.35, 1.5, 0.9] }
      );
    }
    const headMesh = new T.Mesh(mergeColored(parts), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: new T.Color("#3a1408"), emissiveIntensity: 0.1 }));
    headMesh.castShadow = true;
    head.add(headMesh);

    /* --- 帽子 / ヘルメット --- */
    const capGroup = new T.Group();
    head.add(capGroup);
    const capColor = umpire ? "#1b2230" : team.cap || team.main;
    const matCap = new T.MeshStandardMaterial({ color: capColor, roughness: 0.78 });
    const matHelmet = new T.MeshStandardMaterial({ color: capColor, roughness: 0.18, metalness: 0.2 });
    const matCapV = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    const matHelmetV = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.2 });
    const matLogo = new T.MeshStandardMaterial({ map: capLogoTexture(team.mark || "", team.capMark || team.sub || "#fff", capColor), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    const makeCap = (helmet) => {
      capGroup.clear();
      const m = helmet ? matHelmet : matCap;
      const sh = new T.Shape();
      sh.absellipse(0, 0, helmet ? 0.074 : 0.084, helmet ? 0.05 : 0.074, 0, Math.PI, false);
      const brimGeo = geoCache(helmet ? "brimH" : "brimC", () => {
        const g = new T.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false, curveSegments: 20 });
        g.rotateX(Math.PI / 2);
        return g.toNonIndexed ? g : g;
      });
      const side = o.bats === "L" ? -1 : 1;
      const cparts = [
        { geo: geoCache("crown", () => new T.SphereGeometry(0.1, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)), color: capColor, pos: helmet ? [0, 0.022, -0.004] : [0, 0.04, -0.003], scale: helmet ? [0.95, 0.98, 1.1] : [0.87, 0.76, 1.05] },
        { geo: brimGeo, color: capColor, pos: [0, helmet ? 0.03 : 0.044, helmet ? 0.088 : 0.084], rot: [helmet ? 0.12 : 0.2, 0, 0] },
      ];
      if (helmet) cparts.push({ geo: geoCache("flap", () => new T.SphereGeometry(0.055, 16, 10)), color: capColor, pos: [0.082 * side, -0.018, -0.004], scale: [0.42, 0.95, 1.0] });
      else cparts.push({ geo: geoCache("btn", () => new T.SphereGeometry(0.008, 8, 6)), color: capColor, pos: [0, 0.122, -0.002] });
      const capMesh = new T.Mesh(mergeColored(cparts), helmet ? matHelmetV : matCapV);
      capMesh.castShadow = true;
      capGroup.add(capMesh);
      if (!umpire && team.mark) {
        const logo = new T.Mesh(geoCache("logoPlane", () => new T.PlaneGeometry(0.046, 0.046)), matLogo);
        logo.position.set(0, helmet ? 0.066 : 0.074, helmet ? 0.106 : 0.0985);
        logo.rotation.x = -0.5;
        capGroup.add(logo);
      }
      void m;
    };
    makeCap(!!o.helmet);

    /* --- 手 --- */
    const batGloveHex = team.glove2 || "#f2f2f2";
    const hands = {};
    const handGeo = (sx, colr) =>
      mergeColored([
        { geo: geoCache("palm", () => new T.BoxGeometry(0.055, 0.085, 0.03)), color: colr, pos: [0, -0.045, 0.005] },
        { geo: geoCache("fing", () => new T.BoxGeometry(0.05, 0.045, 0.028)), color: colr, pos: [0, -0.09, 0.012], rot: [0.5, 0, 0] },
        { geo: geoCache("thumb", () => new T.CapsuleGeometry(0.009, 0.03, 4, 8)), color: colr, pos: [-0.026 * sx, -0.04, 0.02], rot: [0, 0, 0.5 * sx] },
      ]);
    const matHand = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    for (const sd of ["L", "R"]) {
      const sx = sd === "L" ? 1 : -1;
      const bare = handGeo(sx, skinHex);
      const gloved = handGeo(sx, batGloveHex);
      const hm = new T.Mesh(bare, matHand);
      hm.castShadow = true;
      bones["hand." + sd].add(hm);
      hands[sd] = { mesh: hm, bare, gloved };
    }

    /* --- 靴 --- */
    const shoeHex = umpire ? "#111111" : team.shoe || "#141418";
    const shoeGeo = mergeColored([
      { geo: geoCache("shoe", () => new T.SphereGeometry(0.06, 16, 10)), color: shoeHex, pos: [0, -0.025, 0.055], scale: [0.82, 0.62, 2.05] },
      { geo: geoCache("sole", () => new T.BoxGeometry(0.085, 0.014, 0.25)), color: "#e8e8e8", pos: [0, -0.055, 0.055] },
    ]);
    const matShoeV = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 });
    for (const sd of ["L", "R"]) {
      const shoe = new T.Mesh(shoeGeo, matShoeV);
      shoe.castShadow = true;
      bones["foot." + sd].add(shoe);
    }

    /* --- 道具 --- */
    const gear = {};
    const leather = new T.MeshStandardMaterial({ color: team.gloveColor || "#8a4e24", roughness: 0.55, metalness: 0.02 });
    const gloveHand = o.throws === "L" ? "R" : "L";
    const kind = o.pos === "C" ? "catcher" : o.pos === "1B" ? "first" : "fielder";
    const glove = new T.Mesh(gloveGeometry(kind), leather);
    glove.castShadow = true;
    glove.position.set(0, -0.07, 0.015);
    glove.rotation.set(0, 0, gloveHand === "L" ? 0 : Math.PI);
    bones["hand." + gloveHand].add(glove);
    gear.glove = glove;
    const batMat = new T.MeshStandardMaterial({ color: o.batColor || "#c99a5b", roughness: 0.4, metalness: 0.05 });
    const bat = new T.Mesh(batGeometry(), batMat);
    bat.castShadow = true;
    gear.bat = bat;
    // バットは右打者なら右手 (下の手は左手) で握るが、表示は下側の手に付ける
    const bottomHand = o.bats === "L" ? "R" : "L";
    bat.position.set(0, -0.06, 0.02);
    bat.rotation.set(Math.PI / 2, 0, 0);
    bones["hand." + bottomHand].add(bat);
    bat.visible = false;
    // 捕手のマスク・プロテクター
    if (o.pos === "C" && o.role === "catcher") {
      const pad = new T.Mesh(new T.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), new T.MeshStandardMaterial({ color: team.cap || "#222", roughness: 0.6 }));
      pad.scale.set(1, 1.4, 0.55);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(0, 0.05, 0.1);
      bones.chest.add(pad);
      const mask = new T.Mesh(new T.TorusGeometry(0.07, 0.008, 6, 16), new T.MeshStandardMaterial({ color: "#222", roughness: 0.4, metalness: 0.5 }));
      mask.position.set(0, -0.01, 0.105);
      head.add(mask);
      gear.mask = mask;
      makeCap(true);
    }
    if (umpire) {
      const mask = new T.Mesh(new T.TorusGeometry(0.068, 0.007, 6, 16), new T.MeshStandardMaterial({ color: "#111", roughness: 0.4, metalness: 0.5 }));
      mask.position.set(0, -0.012, 0.104);
      head.add(mask);
      glove.visible = false;
    }

    const player = {
      group,
      bones,
      skeleton,
      head,
      gear,
      hands,
      opts: o,
      setHelmet: (h) => makeCap(h),
      showBat(v) {
        bat.visible = v;
      },
      showGlove(v) {
        glove.visible = v && !umpire;
      },
      setBattingGloves(v) {
        for (const sd of ["L", "R"]) hands[sd].mesh.geometry = v ? hands[sd].gloved : hands[sd].bare;
      },
      dispose() {
        group.traverse((n) => {
          if (n.geometry && !Object.values(shared).includes(n.geometry)) n.geometry.dispose();
          if (n.material) {
            const ms = Array.isArray(n.material) ? n.material : [n.material];
            for (const m of ms) {
              if (m.map) m.map.dispose();
              m.dispose();
            }
          }
        });
      },
    };
    return player;
  };

  PB.Model3D = M;
})((window.PB = window.PB || {}));
